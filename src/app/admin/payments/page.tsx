'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  Receipt as ReceiptIcon, 
  CheckCircle2, 
  ChevronRight, 
  Printer, 
  AlertTriangle, 
  Download, 
  MessageSquare, 
  Mail, 
  Coins, 
  User, 
  ShieldAlert, 
  Calendar,
  DollarSign
} from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import { collection, getDocs, getDoc, query, where, orderBy, doc, addDoc } from 'firebase/firestore';
import { isFirebaseConfigured, getCurrentProfile } from '@/lib/auth';
import { recordPayment } from '@/lib/db/payments';
import { createNotification } from '@/lib/db/notifications';
import { z } from 'zod';
import PDFPreviewModal from '@/components/PDFPreviewModal';
import { getPdfApiUrl, downloadPdfDocument, printPdfDocument } from '@/lib/pdfHelper';

// Helper to generate receipt number outside component scope
const generateReceiptNumber = () => {
  return `PGF-REC-${Date.now().toString().substring(6)}`;
};

// Zod validation schema for form submission
const paymentValidationSchema = z.object({
  paymentAmount: z.number().positive('Payment amount must be greater than zero'),
  paymentMode: z.string().min(1, 'Payment mode is required'),
  transactionId: z.string().optional(),
  paymentDate: z.string().min(1, 'Payment date is required'),
  penaltyFee: z.number().min(0, 'Penalty must be zero or positive').optional(),
  discountWaiver: z.number().min(0, 'Discount must be zero or positive').optional(),
  remarks: z.string().optional()
});

interface LoanWithRelations {
  id: string;
  loan_number: string;
  customer_id: string;
  principal_amount: number;
  interest_rate_apr: number;
  status: string;
  origination_date: string;
  maturity_date: string;
  grace_expiry_date: string;
  total_interest_paid: number;
  total_principal_paid: number;
  outstanding_interest: number;
  customer: {
    id: string;
    name: string;
    phone_primary: string;
    national_id: string;
    photo_url: string | null;
  };
  gold_collateral?: Array<{
    id: string;
    ornament_type?: string;
    item_description: string;
    gross_weight: number;
    stone_weight: number;
    net_weight: number;
    purity_karat: string;
    valuation_inr: number;
  }>;
  payments?: Array<{
    id: string;
    amount_paid: number;
    interest_portion: number;
    principal_portion: number;
    penalty_amount: number;
    payment_date: string;
    mode: string;
    receipt_number: string;
  }>;
}

function RepaymentRegistryForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryLoanId = searchParams.get('loanId') || '';

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Active Loans List from DB
  const [loans, setLoans] = useState<LoanWithRelations[]>([]);
  const [selectedLoanId, setSelectedLoanId] = useState('');
  
  // Logged-in admin
  const [loggedInAdmin, setLoggedInAdmin] = useState<any>(null);

  // Form State variables
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [paymentMode, setPaymentMode] = useState<string>('UPI');
  const [transactionId, setTransactionId] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [penaltyFee, setPenaltyFee] = useState<number | ''>('');
  const [discountWaiver, setDiscountWaiver] = useState<number | ''>('');
  const [remarks, setRemarks] = useState<string>('');

  // Generated receipt structure upon success
  const [successReceipt, setSuccessReceipt] = useState<any>(null);
  const [createdPaymentId, setCreatedPaymentId] = useState<string>('');

  // PDF Preview Modal States
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');

  const fetchActiveLoansAndProfile = async () => {
    try {
      if (isFirebaseConfigured()) {
        // Get Admin Profile
        const adminProfile = await getCurrentProfile();
        setLoggedInAdmin(adminProfile);

        // Fetch active loans with associations
        // Fetch active loans from Firestore without index-dependent orderBy
        const loansQ = query(
          collection(db, 'loans'),
          where('status', 'in', ['Active', 'Due', 'Overdue', 'Grace_Period'])
        );
        const loansSnap = await getDocs(loansQ);

        const typedLoans: LoanWithRelations[] = [];
        for (const loanDoc of loansSnap.docs) {
          const loanData: any = { id: loanDoc.id, ...loanDoc.data() };
          // Fetch customer
          if (loanData.customer_id) {
            try {
              const custSnap = await getDoc(doc(db, 'profiles', loanData.customer_id));
              if (custSnap.exists()) {
                loanData.customer = { id: custSnap.id, ...custSnap.data() };
              }
            } catch {
              // ignore
            }
          }
          // Fetch gold collateral
          try {
            const goldQ = query(collection(db, 'gold_collateral'), where('loan_id', '==', loanDoc.id));
            const goldSnap = await getDocs(goldQ);
            loanData.gold_collateral = goldSnap.docs.map(g => ({ id: g.id, ...g.data() }));
          } catch {
            loanData.gold_collateral = [];
          }
          // Fetch payments
          try {
            const pmtQ = query(collection(db, 'payments'), where('loan_id', '==', loanDoc.id));
            const pmtSnap = await getDocs(pmtQ);
            loanData.payments = pmtSnap.docs.map(p => ({ id: p.id, ...p.data() }));
          } catch {
            loanData.payments = [];
          }
          typedLoans.push(loanData as LoanWithRelations);
        }

        // Sort in memory
        typedLoans.sort((a: any, b: any) => (b.created_at || '').localeCompare(a.created_at || ''));
        setLoans(typedLoans);

        if (typedLoans.length > 0) {
          const match = typedLoans.find((l) => l.id === queryLoanId || l.loan_number === queryLoanId);
          const initialSelectionId = match ? match.id : typedLoans[0].id;
          setSelectedLoanId(initialSelectionId);
        } else {
          setLoans([]);
          setSelectedLoanId('');
        }
      } else {
        setLoans([]);
        setSelectedLoanId('');
      }
    } catch (err) {
      console.error('Failed to load repayments workspace details:', err);
      setLoans([]);
      setSelectedLoanId('');
    }
  };

  useEffect(() => {
    const t = setTimeout(() => {
      fetchActiveLoansAndProfile();
    }, 0);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Find the currently selected active loan ledger
  const activeLoan: LoanWithRelations | null = loans.find((l) => l.id === selectedLoanId) || (loans.length > 0 ? loans[0] : null);

  // Outstanding calculations safely guarded against empty state
  const principalAmount = activeLoan ? (activeLoan.principal_amount || 0) : 0;
  const outstandingPrincipal = activeLoan ? Math.max(0, principalAmount - (activeLoan.total_principal_paid || 0)) : 0;
  const outstandingInterest = activeLoan ? (activeLoan.outstanding_interest || 0) : 0;
  const penaltyNum = typeof penaltyFee === 'number' ? penaltyFee : 0;
  const waiverNum = typeof discountWaiver === 'number' ? discountWaiver : 0;
  const totalOutstanding = activeLoan ? Math.max(0, outstandingPrincipal + outstandingInterest + penaltyNum - waiverNum) : 0;

  // Live split calculator following business rules:
  // 1. Outstanding Interest first
  // 2. Penalty charges next
  // 3. Principal reduction last
  const calculateLiveAllocation = () => {
    let remaining = typeof paymentAmount === 'number' ? paymentAmount : 0;
    
    // Allocate to Interest Portion
    const interestCleared = Math.min(remaining, outstandingInterest);
    remaining = Math.max(0, remaining - interestCleared);

    // Allocate to Penalty Portion
    const penaltyCleared = Math.min(remaining, penaltyNum);
    remaining = Math.max(0, remaining - penaltyCleared);

    // Allocate to Principal Portion
    const principalCleared = Math.min(remaining, outstandingPrincipal);
    remaining = Math.max(0, remaining - principalCleared);

    const updatedPrincipal = Math.max(0, outstandingPrincipal - principalCleared);
    const updatedInterest = Math.max(0, outstandingInterest - interestCleared);
    const updatedPenalty = Math.max(0, penaltyNum - penaltyCleared);

    return {
      interestCleared,
      penaltyCleared,
      principalCleared,
      remainingPrincipal: updatedPrincipal,
      remainingInterest: updatedInterest,
      remainingPenalty: updatedPenalty,
      newTotalOutstanding: updatedPrincipal + updatedInterest + updatedPenalty,
    };
  };

  const allocation = calculateLiveAllocation();

  // Handle Select Loan change
  const handleLoanChange = (id: string) => {
    setSelectedLoanId(id);
  };

  // Formatter for Indian Currency
  const formatINR = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  const handleRegisterPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setValidationErrors({});

    if (!activeLoan) {
      setError('Please select an active gold loan account to register repayment.');
      setLoading(false);
      return;
    }

    const currentLoan = activeLoan;

    if (paymentAmount === '' || typeof paymentAmount !== 'number' || isNaN(paymentAmount) || paymentAmount <= 0) {
      setValidationErrors({ paymentAmount: 'Please enter a valid repayment amount greater than zero.' });
      setLoading(false);
      return;
    }

    const formData = {
      paymentAmount,
      paymentMode,
      transactionId: ['Cash'].includes(paymentMode) ? undefined : transactionId,
      paymentDate,
      penaltyFee: typeof penaltyFee === 'number' ? penaltyFee : undefined,
      discountWaiver: typeof discountWaiver === 'number' ? discountWaiver : undefined,
      remarks,
    };

    // 1. Zod Schema Verification
    const validation = paymentValidationSchema.safeParse(formData);
    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.issues.forEach((issue) => {
        const path = issue.path[0] as string;
        fieldErrors[path] = issue.message;
      });
      setValidationErrors(fieldErrors);
      setLoading(false);
      return;
    }

    // 2. Strict Financial Business Logic Checks
    if (paymentAmount > totalOutstanding) {
      setError(`Validation Error: Repayment amount of ${formatINR(paymentAmount)} exceeds the total outstanding balance of ${formatINR(totalOutstanding)}.`);
      setLoading(false);
      return;
    }

    if (!['Cash'].includes(paymentMode) && (!transactionId || transactionId.trim() === '')) {
      setValidationErrors({ transactionId: 'Transaction reference is mandatory for all digital payment options.' });
      setLoading(false);
      return;
    }

    if (new Date(paymentDate) > new Date()) {
      setValidationErrors({ paymentDate: 'Payment date cannot be in the future.' });
      setLoading(false);
      return;
    }

    try {
      let finalReceiptNumber = generateReceiptNumber();
      let postedPayment: any = null;

      if (isFirebaseConfigured()) {
        // Check for duplicate transaction ID if entered
        if (transactionId) {
          const dupQ = query(
            collection(db, 'payments'),
            where('loan_id', '==', currentLoan.id)
          );
          const dupSnap = await getDocs(dupQ);
          const hasDuplicate = dupSnap.docs.some(d => {
            const remarks = d.data().remarks || '';
            return remarks.toLowerCase().includes(transactionId.toLowerCase());
          });
          
          if (hasDuplicate) {
            setValidationErrors({ transactionId: 'Repayment reference already registered. Duplicate transaction IDs are barred.' });
            setLoading(false);
            return;
          }
        }

        // Post Database Transaction
        postedPayment = await recordPayment({
          loan_id: currentLoan.id,
          customer_id: currentLoan.customer?.id || currentLoan.customer_id,
          amount_paid: paymentAmount,
          interest_portion: allocation.interestCleared,
          principal_portion: allocation.principalCleared,
          ...(typeof penaltyFee === 'number' && penaltyFee > 0 ? { penalty_amount: allocation.penaltyCleared } : {}),
          ...(typeof discountWaiver === 'number' && discountWaiver > 0 ? { waiver_amount: discountWaiver } : {}),
          payment_type: allocation.remainingPrincipal === 0 ? 'Full_Settlement' : 'Partial_Settlement',
          mode: paymentMode as any,
          remarks: `[Txn ID: ${transactionId || 'N/A'}] ${remarks}`,
        });

        if (postedPayment?.receipt_number) {
          finalReceiptNumber = postedPayment.receipt_number;
        }
        if (postedPayment?.id) {
          setCreatedPaymentId(postedPayment.id);
        }

        // Write Audit Log Entry
        const currentUserId = auth.currentUser?.uid;
        if (currentUserId) {
          await addDoc(collection(db, 'audit_logs'), {
            actor_id: currentUserId,
            action_type: 'Repayment Registered',
            affected_entity: 'loans',
            affected_entity_id: currentLoan.id,
            old_state: { outstanding_interest: outstandingInterest, outstanding_principal: outstandingPrincipal },
            new_state: { outstanding_interest: allocation.remainingInterest, outstanding_principal: allocation.remainingPrincipal },
            timestamp: new Date().toISOString(),
          });
        }

        // Trigger SMS & In-App Notifications
        if (currentLoan.customer?.id) {
          await createNotification({
            recipient_id: currentLoan.customer.id,
            type: 'Payment_Received',
            title: `Repayment Successful — ${finalReceiptNumber}`,
            message: `Dear ${currentLoan.customer.name || 'Customer'}, we have successfully received your payment of ${formatINR(paymentAmount)} via ${paymentMode}. Outstanding balance reduced to ${formatINR(allocation.remainingPrincipal)}. Thank you!`,
          });
        }
      } else {
        throw new Error('Firebase connection is not configured or unavailable. Real database connection is required.');
      }

      // Generate Receipt Preview state object
      setSuccessReceipt({
        receiptNo: finalReceiptNumber,
        loanNumber: currentLoan.loan_number,
        customerName: currentLoan.customer?.name || 'Customer',
        paymentDate: new Date(paymentDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        paymentMode: paymentMode,
        transactionId: transactionId || 'N/A',
        interestPaid: allocation.interestCleared,
        penaltyPaid: allocation.penaltyCleared,
        principalPaid: allocation.principalCleared,
        totalPaid: paymentAmount,
        remainingBalance: allocation.newTotalOutstanding,
        collectedBy: loggedInAdmin?.name || 'Authorized Officer',
        sloganId: postedPayment?.slogan_id,
        sloganText: postedPayment?.slogan_text,
      });

      setSuccess(true);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Operational failed to save payment record. Please check database logs.');
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerAlert = (type: 'sms' | 'whatsapp' | 'email') => {
    alert(`Confirmation dispatched: Confirm payment receipt alert has been sent to ${activeLoan?.customer?.name || 'Customer'} via ${type.toUpperCase()}`);
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Breadcrumbs Banner */}
      <div className="flex items-center gap-2 text-[10px] text-[#2563EB] font-bold tracking-wider uppercase">
        <span>PGF Office</span>
        <ChevronRight size={10} className="text-gray-400" />
        <span>Operations Portal</span>
        <ChevronRight size={10} className="text-gray-400" />
        <span className="text-gray-500">Repayment Entry</span>
      </div>

      {/* Header title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-[#E5E7EB] pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 tracking-wide font-outfit">Log Loan Repayment</h2>
          <p className="text-gray-500 text-xs mt-1">Accept customer gold loan repayments and split values across ledgers.</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-rose-500/20 rounded-lg text-red-500 text-xs flex items-center gap-2">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {loans.length === 0 || !activeLoan ? (
        <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-12 text-center text-gray-400 space-y-3 shadow-sm">
          <ReceiptIcon size={36} className="mx-auto text-gray-300" />
          <h3 className="text-base font-bold text-gray-800 font-outfit">No Active Loans Found</h3>
          <p className="text-xs text-gray-500 max-w-md mx-auto">There are currently no active gold loan accounts pending repayment in the system.</p>
        </div>
      ) : !success ? (
        <form onSubmit={handleRegisterPayment} className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* LEFT: Customer and loan summaries */}
          <div className="space-y-6 lg:col-span-1">
            {/* Customer Information Card */}
            <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-5 space-y-4">
              <h3 className="text-xs font-bold text-[#2563EB] uppercase tracking-wider border-b border-[#E5E7EB] pb-2 flex items-center gap-1.5 font-outfit">
                <User size={14} />
                Customer Profile
              </h3>
              <div className="flex gap-4 items-center">
                <div className="w-14 h-14 rounded-full bg-[#F3F4F6] border border-[#2563EB]/30 flex items-center justify-center text-[#2563EB] text-xl font-bold font-outfit uppercase overflow-hidden">
                  {activeLoan.customer?.photo_url ? (
                    <img src={activeLoan.customer.photo_url} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    (activeLoan.customer?.name || 'CU').substring(0, 2)
                  )}
                </div>
                <div>
                  <span className="font-semibold text-gray-900 text-sm block">{activeLoan.customer?.name || 'Customer'}</span>
                  <span className="text-[10px] text-gray-500 block font-mono">{activeLoan.customer?.phone_primary || 'N/A'}</span>
                  <span className="text-[10px] text-gray-400 block font-mono">Aadhaar: {(activeLoan.customer?.national_id || '').replace(/.(?=.{4})/g, '*')}</span>
                </div>
              </div>
              <div className="pt-2 border-t border-[#E5E7EB]/50 grid grid-cols-2 gap-x-2 gap-y-1.5 text-[10px] text-gray-500 font-mono">
                <div>Loan Code: <span className="text-gray-900 block font-semibold">{activeLoan.loan_number}</span></div>
                <div>Status: <span className="text-emerald-600 block font-bold uppercase">{activeLoan.status}</span></div>
                <div>Origination: <span className="text-gray-900 block">{new Date(activeLoan.origination_date).toLocaleDateString()}</span></div>
                <div>Maturity Date: <span className="text-gray-900 block">{new Date(activeLoan.maturity_date).toLocaleDateString()}</span></div>
              </div>
            </div>

            {/* Gold Collateral Details Card */}
            <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-5 space-y-3">
              <h3 className="text-xs font-bold text-[#2563EB] uppercase tracking-wider border-b border-[#E5E7EB] pb-2 flex items-center gap-1.5 font-outfit">
                <Coins size={14} />
                Gold Collateral details
              </h3>
              {activeLoan.gold_collateral && activeLoan.gold_collateral.length > 0 ? (
                activeLoan.gold_collateral.map((item, idx) => (
                  <div key={idx} className="space-y-1 text-xs border-b border-[#E5E7EB]/30 pb-2 last:border-b-0 last:pb-0">
                    <div className="flex justify-between">
                      <span className="text-gray-600 font-medium">{item.item_description}</span>
                      <span className="text-[#2563EB] font-semibold">{item.purity_karat}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-400 font-mono">
                      <span>Weights: {item.gross_weight}g (G) / {item.net_weight}g (N)</span>
                      <span>Value: {formatINR(item.valuation_inr)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-gray-500 text-xs italic">No collateral items found.</div>
              )}
            </div>

            {/* Financial Ledger Summary */}
            <div className="bg-[#ffffff] border border-[#2563EB]/10 rounded-xl p-5 space-y-4">
              <h3 className="text-xs font-bold text-[#2563EB] uppercase tracking-wider border-b border-[#E5E7EB] pb-2 flex items-center gap-1.5 font-outfit">
                <DollarSign size={14} />
                Financial Summary
              </h3>
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Principal Disbursed:</span>
                  <span className="text-slate-200 font-semibold">{formatINR(principalAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Outstanding Principal:</span>
                  <span className="text-slate-200 font-semibold">{formatINR(outstandingPrincipal)}</span>
                </div>
                <div className="flex justify-between text-amber-400">
                  <span>Accrued Interest:</span>
                  <span className="font-semibold">{formatINR(outstandingInterest)}</span>
                </div>
                <div className="flex justify-between text-red-500">
                  <span>Penalty Charges (+):</span>
                  <span className="font-semibold">{typeof penaltyFee === 'number' ? formatINR(penaltyFee) : '—'}</span>
                </div>
                {typeof discountWaiver === 'number' && discountWaiver > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Discount / Waiver (-):</span>
                    <span className="font-semibold">{formatINR(discountWaiver)}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-[#E5E7EB] flex justify-between items-center text-sm font-bold text-gray-900">
                  <span>Total Outstanding:</span>
                  <span className="text-[#2563EB] font-outfit text-base">{formatINR(totalOutstanding)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: Input Form and Splits Allocation */}
          <div className="lg:col-span-2 space-y-6">
            {/* Repayment Log Form Box */}
            <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-6 space-y-5">
              <h3 className="text-xs font-bold text-[#2563EB] uppercase tracking-wider border-b border-[#E5E7EB] pb-2 flex items-center gap-1.5 font-outfit">
                <ReceiptIcon size={14} />
                Payment Transaction Details
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-gray-500 font-medium">Active Loan Account *</label>
                  <select
                    value={selectedLoanId}
                    onChange={(e) => handleLoanChange(e.target.value)}
                    className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 text-xs rounded-lg px-3.5 py-2.5 outline-none transition"
                  >
                    {loans.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.customer?.name} - {l.loan_number} ({formatINR(l.principal_amount - l.total_principal_paid + l.outstanding_interest)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-gray-500 font-medium">Repayment Value (INR) *</label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      placeholder="Enter repayment amount"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      className={`w-full bg-[#F3F4F6] border ${validationErrors.paymentAmount ? 'border-rose-500' : 'border-[#E5E7EB]'} focus:border-[#2563EB] text-gray-900 text-sm font-semibold rounded-lg pl-8 pr-4 py-2.5 outline-none transition`}
                    />
                    <span className="absolute left-3 top-3 text-gray-500 text-xs font-semibold">₹</span>
                  </div>
                  {validationErrors.paymentAmount ? (
                    <span className="text-[10px] text-red-500 block">{validationErrors.paymentAmount}</span>
                  ) : (
                    <span className="text-[10px] text-gray-500 font-medium block">
                      Rupee format: <span className="text-emerald-600 font-semibold">{typeof paymentAmount === 'number' ? formatINR(paymentAmount) : '—'}</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-gray-500 font-medium">Payment Mode *</label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 text-xs rounded-lg px-3.5 py-2.5 outline-none transition"
                  >
                    <option value="UPI">UPI Transfer</option>
                    <option value="Cash">Cash</option>
                    <option value="Bank_Transfer">Bank Transfer</option>
                    <option value="Debit_Card">Debit Card</option>
                    <option value="Credit_Card">Credit Card</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Demand_Draft">Demand Draft</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-gray-500 font-medium">Payment Date *</label>
                  <input
                    type="date"
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 text-xs rounded-lg px-3.5 py-2.5 outline-none transition"
                  />
                  {validationErrors.paymentDate && (
                    <span className="text-[10px] text-red-500 block">{validationErrors.paymentDate}</span>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-gray-500 font-medium">
                    Transaction Reference {['Cash'].includes(paymentMode) ? '' : '*'}
                  </label>
                  <input
                    type="text"
                    placeholder="Ref ID / Cheque No"
                    disabled={['Cash'].includes(paymentMode)}
                    value={['Cash'].includes(paymentMode) ? 'CASH TRANSACTION' : transactionId}
                    onChange={(e) => setTransactionId(e.target.value)}
                    className={`w-full ${['Cash'].includes(paymentMode) ? 'bg-[#F3F4F6]/40 text-gray-400 cursor-not-allowed' : 'bg-[#F3F4F6] text-gray-900'} border ${validationErrors.transactionId ? 'border-rose-500' : 'border-[#E5E7EB]'} focus:border-[#2563EB] text-xs rounded-lg px-3.5 py-2.5 outline-none transition`}
                  />
                  {validationErrors.transactionId && (
                    <span className="text-[10px] text-red-500 block">{validationErrors.transactionId}</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-gray-500 font-medium">Adjust Penalty Charged (₹)</label>
                  <input
                    type="number"
                    placeholder="e.g. 250"
                    value={penaltyFee}
                    onChange={(e) => setPenaltyFee(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 text-xs rounded-lg px-3.5 py-2.5 outline-none transition"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-gray-500 font-medium">Discount / Waiver (₹)</label>
                  <input
                    type="number"
                    placeholder="e.g. 100"
                    value={discountWaiver}
                    onChange={(e) => setDiscountWaiver(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 text-xs rounded-lg px-3.5 py-2.5 outline-none transition"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-gray-500 font-medium">Payment Remarks</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Interest and principal reduced for July cycle"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 text-xs rounded-lg px-3.5 py-2 outline-none transition resize-none font-outfit"
                />
              </div>
            </div>

            {/* LIVE DYNAMIC REPAYMENT ALLOCATION SPLIT CARD */}
            <div className="bg-[#ffffff] border border-[#2563EB]/25 rounded-xl p-5 space-y-4 shadow-lg">
              <h3 className="text-xs font-bold text-[#2563EB] uppercase tracking-wider border-b border-[#E5E7EB] pb-2 flex items-center gap-2 font-outfit">
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
                Repayment Allocation Split Preview
              </h3>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 text-center">
                <div className="bg-[#F8FAFC] border border-[#E5E7EB] rounded-lg p-3">
                  <span className="text-[9px] text-gray-500 uppercase tracking-wider block font-semibold">Payment Received</span>
                  <span className="text-sm font-bold text-gray-900 block mt-1">{typeof paymentAmount === 'number' ? formatINR(paymentAmount) : '—'}</span>
                </div>

                <div className="bg-[#F8FAFC] border border-[#E5E7EB] rounded-lg p-3">
                  <span className="text-[9px] text-gray-500 uppercase tracking-wider block font-semibold text-amber-400">Interest Portion</span>
                  <span className="text-sm font-bold text-amber-400 block mt-1">-{formatINR(allocation.interestCleared)}</span>
                </div>

                <div className="bg-[#F8FAFC] border border-[#E5E7EB] rounded-lg p-3">
                  <span className="text-[9px] text-gray-500 uppercase tracking-wider block font-semibold text-red-500">Penalty Portion</span>
                  <span className="text-sm font-bold text-red-500 block mt-1">-{formatINR(allocation.penaltyCleared)}</span>
                </div>

                <div className="bg-[#F8FAFC] border border-[#E5E7EB] rounded-lg p-3">
                  <span className="text-[9px] text-gray-500 uppercase tracking-wider block font-semibold text-emerald-600">Principal Portion</span>
                  <span className="text-sm font-bold text-emerald-600 block mt-1">-{formatINR(allocation.principalCleared)}</span>
                </div>
              </div>

              {/* Outstanding split summary ledger */}
              <div className="p-4 bg-emerald-500/5 border border-emerald-500/15 rounded-lg space-y-2 text-xs">
                <div className="flex justify-between items-center text-gray-600">
                  <span>Accrued Interest Balance:</span>
                  <span className="font-mono">{formatINR(outstandingInterest)} &rarr; <span className="text-emerald-600 font-bold">{formatINR(allocation.remainingInterest)}</span></span>
                </div>
                <div className="flex justify-between items-center text-gray-600">
                  <span>Outstanding Principal Balance:</span>
                  <span className="font-mono">{formatINR(outstandingPrincipal)} &rarr; <span className="text-emerald-600 font-bold">{formatINR(allocation.remainingPrincipal)}</span></span>
                </div>
                <div className="pt-2 border-t border-emerald-500/10 flex justify-between items-center font-bold text-gray-900 text-sm">
                  <span>Remaining Ledger Balance:</span>
                  <span className="text-[#2563EB] font-mono">{formatINR(allocation.newTotalOutstanding)}</span>
                </div>
              </div>
            </div>

            {/* ACTION TRIGGERS */}
            <div className="flex gap-4">
              <button
                type="submit"
                disabled={loading || typeof paymentAmount !== 'number' || paymentAmount <= 0}
                className="flex-1 py-3 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-[#2563EB]/35 text-[#F8FAFC] font-bold text-xs uppercase tracking-wider rounded-lg transition flex items-center justify-center gap-2 shadow-lg shadow-[#2563EB]/10 cursor-pointer font-outfit"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-[#F8FAFC] border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <ReceiptIcon size={14} />
                )}
                Save Repayment Transaction
              </button>
            </div>
          </div>
        </form>
      ) : (
        /* SUCCESS RECEIPT VIEW */
        <div className="space-y-6 max-w-2xl mx-auto">
          {/* Green Confirmation Header */}
          <div className="bg-[#ffffff] border border-emerald-500/20 rounded-xl p-6 text-center space-y-4 shadow-xl">
            <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto text-emerald-600">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 font-outfit">Repayment Logged & Saved</h3>
              <p className="text-gray-500 text-xs mt-1 font-outfit">
                Transaction splits posted successfully. Remaining principal reduced to {formatINR(allocation.remainingPrincipal)}.
              </p>
            </div>
            
            {/* Dispatch details */}
            <div className="flex justify-center gap-2 pt-2 border-t border-[#E5E7EB]">
              <button 
                onClick={() => handleTriggerAlert('sms')}
                className="px-3 py-1.5 rounded bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[10px] text-gray-600 font-bold uppercase tracking-wider transition flex items-center gap-1 cursor-pointer font-outfit"
              >
                <MessageSquare size={12} className="text-[#2563EB]" /> Send SMS
              </button>
              <button 
                onClick={() => handleTriggerAlert('whatsapp')}
                className="px-3 py-1.5 rounded bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[10px] text-gray-600 font-bold uppercase tracking-wider transition flex items-center gap-1 cursor-pointer font-outfit"
              >
                <MessageSquare size={12} className="text-emerald-600" /> WhatsApp
              </button>
              <button 
                onClick={() => handleTriggerAlert('email')}
                className="px-3 py-1.5 rounded bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[10px] text-gray-600 font-bold uppercase tracking-wider transition flex items-center gap-1 cursor-pointer font-outfit"
              >
                <Mail size={12} className="text-blue-400" /> Email Alert
              </button>
            </div>
          </div>

          {/* BANKING STYLE RECEIPT PREVIEW PANEL */}
          <div id="receipt-preview-container" className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl overflow-hidden shadow-2xl p-6 space-y-6 text-xs text-gray-600 font-mono">
            {/* Receipt Header Banner */}
            <div className="text-center space-y-1.5 border-b border-[#E5E7EB] pb-4">
              <h4 className="text-sm font-bold text-[#2563EB] tracking-wider uppercase font-outfit">PAVITHRA GOLD FINANCE</h4>
              <p className="text-[9px] text-gray-500">Licensed Pawn Broker &bull; Madurai, Tamil Nadu</p>
              <span className="inline-block px-2.5 py-0.5 rounded bg-[#F3F4F6] border border-[#2563EB]/20 text-[9px] text-[#2563EB] font-semibold tracking-wider uppercase">Repayment Receipt</span>
            </div>

            {/* Receipt metadata grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4 border-b border-[#E5E7EB] pb-4">
              <div>Receipt No  : <span className="text-gray-900 font-bold">{successReceipt?.receiptNo}</span></div>
              <div>Payment Date: <span className="text-gray-900">{successReceipt?.paymentDate}</span></div>
              <div>Loan Account: <span className="text-gray-900">{successReceipt?.loanNumber}</span></div>
              <div>Payment Mode: <span className="text-gray-900">{successReceipt?.paymentMode}</span></div>
              <div className="col-span-2">Customer Name: <span className="text-gray-900">{successReceipt?.customerName}</span></div>
              <div className="col-span-2">Reference ID : <span className="text-gray-900">{successReceipt?.transactionId}</span></div>
            </div>

            {/* Split Portions Table */}
            <div className="space-y-1.5 border-b border-[#E5E7EB] pb-4">
              <div className="flex justify-between text-gray-400 font-bold uppercase tracking-wider text-[9px] pb-1">
                <span>Description</span>
                <span>Amount Paid</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Accrued Interest Settled:</span>
                <span>{formatINR(successReceipt?.interestPaid)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Overdue Penalty Paid:</span>
                <span>{formatINR(successReceipt?.penaltyPaid)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Principal Reduction Paid:</span>
                <span>{formatINR(successReceipt?.principalPaid)}</span>
              </div>
            </div>

            {/* Total Paid / Remaining */}
            <div className="space-y-2 pt-2 text-right">
              <div className="flex justify-between text-gray-900 font-bold">
                <span>Total Amount Paid:</span>
                <span className="text-[#2563EB] text-sm">{formatINR(successReceipt?.totalPaid)}</span>
              </div>
              <div className="flex justify-between text-gray-500 text-[10px]">
                <span>Remaining Loan Outstanding:</span>
                <span>{formatINR(successReceipt?.remainingBalance)}</span>
              </div>
            </div>

            {/* Rotational Tamil Slogan Banner */}
            {successReceipt?.sloganText && (
              <div className="py-2.5 px-3.5 bg-amber-50/80 border border-amber-200/90 rounded-lg text-center space-y-1 my-2">
                <div className="text-[9px] uppercase font-bold text-amber-800 tracking-wider">
                  {successReceipt?.sloganId ? `BILL SLOGAN • ${successReceipt.sloganId}` : 'PAVITHRA GOLD FINANCE SLOGAN'}
                </div>
                <div className="text-xs font-semibold text-amber-950 font-sans">
                  “{successReceipt.sloganText}”
                </div>
              </div>
            )}

            {/* Sign-off footer */}
            <div className="pt-4 border-t border-[#E5E7EB] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-[10px] text-gray-400">
              <span>Collected By: {successReceipt?.collectedBy}</span>
              <span className="italic">Thank You</span>
            </div>
          </div>

          {/* Voucher Actions Control buttons */}
          <div className="flex flex-wrap gap-3 justify-center">
            <button
              onClick={() => {
                const url = getPdfApiUrl({ type: 'receipt', paymentId: createdPaymentId, loanId: activeLoan.id, amount: typeof paymentAmount === 'number' ? paymentAmount : undefined });
                setPreviewUrl(url);
                setPreviewTitle(`Official Payment Receipt - ${successReceipt?.receiptNo || activeLoan.loan_number}`);
                setIsPreviewOpen(true);
              }}
              className="px-5 py-2.5 rounded-lg bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#2563EB] hover:text-gray-900 border border-[#2563EB]/20 text-xs font-bold uppercase tracking-wider transition flex items-center gap-1.5 cursor-pointer font-outfit"
            >
              <Printer size={14} /> Preview Receipt
            </button>
            <button
              onClick={() => {
                downloadPdfDocument({
                  type: 'receipt',
                  paymentId: createdPaymentId,
                  loanId: activeLoan.id,
                  amount: typeof paymentAmount === 'number' ? paymentAmount : undefined,
                }, `PGF_Receipt_${successReceipt?.receiptNo || activeLoan.loan_number}.pdf`);
              }}
              className="px-5 py-2.5 rounded-lg bg-[#F3F4F6] hover:bg-[#E5E7EB] text-gray-700 hover:text-gray-900 border border-[#E5E7EB] text-xs font-bold uppercase tracking-wider transition flex items-center gap-1.5 font-outfit cursor-pointer"
            >
              <Download size={14} /> Download PDF
            </button>
            <button
              onClick={() => {
                printPdfDocument({
                  type: 'receipt',
                  paymentId: createdPaymentId,
                  loanId: activeLoan.id,
                  amount: typeof paymentAmount === 'number' ? paymentAmount : undefined,
                });
              }}
              className="px-5 py-2.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold uppercase tracking-wider transition flex items-center gap-1.5 font-outfit cursor-pointer"
            >
              <Printer size={14} /> Instant Print
            </button>
            <button
              onClick={() => router.push('/admin/dashboard')}
              className="px-5 py-2.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-[#F8FAFC] text-xs font-bold uppercase tracking-wider transition cursor-pointer font-outfit"
            >
              Back Dashboard
            </button>
          </div>

          <PDFPreviewModal
            isOpen={isPreviewOpen}
            onClose={() => setIsPreviewOpen(false)}
            pdfUrl={previewUrl}
            title={previewTitle}
          />
        </div>
      )}

      {/* REPAYMENTS HISTORY TIMELINE */}
      {!success && (
        <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-5 space-y-4">
          <h3 className="text-xs font-bold text-[#2563EB] uppercase tracking-wider border-b border-[#E5E7EB] pb-2 font-outfit">
            Payment Log History
          </h3>

          <div className="relative border-l border-[#E5E7EB] ml-3 pl-6 space-y-6 text-xs">
            {/* Live split preview node */}
            <div className="relative">
              <span className="absolute -left-[30px] top-1 bg-emerald-500/20 border-2 border-emerald-600 w-3 h-3 rounded-full"></span>
              <div className="space-y-1">
                <span className="font-semibold text-gray-900 font-outfit">Pending Repayment Log (Preview)</span>
                <p className="text-gray-500 text-[10px]">
                  Entering {typeof paymentAmount === 'number' ? formatINR(paymentAmount) : 'repayment amount'} will clear {formatINR(allocation.interestCleared)} interest and reduce principal by {formatINR(allocation.principalCleared)}.
                </p>
              </div>
            </div>

            {/* Historical repayments */}
            {activeLoan && activeLoan.payments && activeLoan.payments.length > 0 ? (
              activeLoan.payments.map((pmt, idx) => (
                <div key={idx} className="relative group">
                  <span className="absolute -left-[30px] top-1 bg-[#F3F4F6] border-2 border-slate-500 w-3 h-3 rounded-full"></span>
                  <div className="space-y-1 bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-gray-800 font-outfit">Repayment of {formatINR(pmt.amount_paid)} via {pmt.mode}</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            setPreviewUrl(getPdfApiUrl({ type: 'receipt', paymentId: pmt.id || pmt.receipt_number, loanId: activeLoan.id }));
                            setPreviewTitle(`Payment Receipt - ${pmt.receipt_number}`);
                            setIsPreviewOpen(true);
                          }}
                          className="px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-semibold border border-blue-200 flex items-center gap-1 transition cursor-pointer"
                        >
                          <Printer size={10} /> Preview
                        </button>
                        <button
                          onClick={() => {
                            downloadPdfDocument({
                              type: 'receipt',
                              paymentId: pmt.id || pmt.receipt_number,
                              loanId: activeLoan.id,
                            }, `PGF_Receipt_${pmt.receipt_number}.pdf`);
                          }}
                          className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-semibold border border-slate-300 flex items-center gap-1 transition cursor-pointer"
                        >
                          <Download size={10} /> Download PDF
                        </button>
                      </div>
                    </div>
                    <span className="text-[10px] text-gray-500 block font-mono">{new Date(pmt.payment_date).toLocaleDateString()} &bull; Receipt: <strong className="text-gray-900">{pmt.receipt_number}</strong></span>
                    <p className="text-gray-500 text-[10px] leading-relaxed">
                      Split allocation: Interest portion {formatINR(pmt.interest_portion)}, principal portion {formatINR(pmt.principal_portion)}, penalty {formatINR(pmt.penalty_amount || 0)}.
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="relative">
                <span className="absolute -left-[30px] top-1 bg-[#F3F4F6] border-2 border-slate-500 w-3 h-3 rounded-full"></span>
                <span className="text-gray-500 italic">No previous payments logged.</span>
              </div>
            )}

            {/* Loan origination node */}
            <div className="relative">
              <span className="absolute -left-[30px] top-1 bg-[#F3F4F6] border-2 border-[#2563EB]/40 w-3 h-3 rounded-full"></span>
              <div className="space-y-0.5">
                <span className="font-semibold text-gray-600 font-outfit">Loan Folder Originated</span>
                <span className="text-[10px] text-gray-400 block font-mono">Disbursed: {formatINR(principalAmount)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PaymentRegistry() {
  return (
    <Suspense fallback={
      <div className="p-12 text-center text-gray-500 text-xs flex flex-col items-center gap-3 justify-center min-h-[50vh]">
        <div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin"></div>
        <span>Initializing repayment log...</span>
      </div>
    }>
      <RepaymentRegistryForm />
    </Suspense>
  );
}
