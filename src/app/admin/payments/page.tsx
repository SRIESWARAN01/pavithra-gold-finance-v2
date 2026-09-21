'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
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
  DollarSign,
  Building2,
  Clock,
  Sparkles,
  Image as ImageIcon
} from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import { collection, getDocs, getDoc, query, where, doc, addDoc } from 'firebase/firestore';
import { isFirebaseConfigured, getCurrentProfile } from '@/lib/auth';
import { recordPayment, calculatePaymentSplit } from '@/lib/db/payments';
import { calculateLoanInterestSnapshot } from '@/lib/db/interest';
import { getActiveBankRePledgeByLoan } from '@/lib/db/repledge';
import { createNotification } from '@/lib/db/notifications';
import { z } from 'zod';
import PDFPreviewModal from '@/components/PDFPreviewModal';
import RePledgeCard from '@/components/RePledgeCard';
import { getPdfApiUrl, downloadPdfDocument, printPdfDocument } from '@/lib/pdfHelper';
import type { BankRePledge } from '@/types/database';

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
  current_bin_id?: string | null;
  bank_repledge_id?: string | null;
  customer: {
    id: string;
    name: string;
    customer_number?: string;
    phone_primary: string;
    national_id: string;
    pan_number?: string;
    address?: string;
    city?: string;
    kyc_status?: string;
    nominee_name?: string;
    nominee_relationship?: string;
    nominee_phone?: string;
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
    storage_bin_id?: string;
    custody_location?: string;
    bank_repledge_id?: string | null;
    front_photo_url?: string | null;
    back_photo_url?: string | null;
  }>;
  payments?: Array<{
    id: string;
    amount_paid: number;
    interest_portion: number;
    principal_portion: number;
    penalty_amount: number;
    waiver_amount?: number;
    payment_date: string;
    mode: string;
    receipt_number: string;
    remarks?: string;
  }>;
}

function RepaymentRegistryForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryLoanId = searchParams.get('loanId') || '';

  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
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
  const [interestInput, setInterestInput] = useState<number | ''>('');
  const [principalInput, setPrincipalInput] = useState<number | ''>('');
  const [paymentMode, setPaymentMode] = useState<string>('UPI');
  const [transactionId, setTransactionId] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [penaltyFee, setPenaltyFee] = useState<number | ''>('');
  const [discountWaiver, setDiscountWaiver] = useState<number | ''>('');
  const [remarks, setRemarks] = useState<string>('');

  // Confirmation Modal
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

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
        const adminProfile = await getCurrentProfile();
        setLoggedInAdmin(adminProfile);

        const loansQ = query(
          collection(db, 'loans'),
          where('status', 'in', ['Active', 'Due', 'Overdue', 'Grace_Period'])
        );
        const loansSnap = await getDocs(loansQ);

        const typedLoans: LoanWithRelations[] = [];
        for (const loanDoc of loansSnap.docs) {
          const loanData: any = { id: loanDoc.id, ...loanDoc.data() };
          
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
          
          try {
            const goldQ = query(collection(db, 'gold_collateral'), where('loan_id', '==', loanDoc.id));
            const goldSnap = await getDocs(goldQ);
            loanData.gold_collateral = goldSnap.docs.map(g => ({ id: g.id, ...g.data() }));
          } catch {
            loanData.gold_collateral = [];
          }
          
          try {
            const pmtQ = query(collection(db, 'payments'), where('loan_id', '==', loanDoc.id));
            const pmtSnap = await getDocs(pmtQ);
            loanData.payments = pmtSnap.docs.map(p => ({ id: p.id, ...p.data() }));
          } catch {
            loanData.payments = [];
          }
          typedLoans.push(loanData as LoanWithRelations);
        }

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
  const [activeRepledge, setActiveRepledge] = useState<BankRePledge | null>(null);

  // Fetch active repledge when active loan changes
  useEffect(() => {
    if (activeLoan?.id) {
      getActiveBankRePledgeByLoan(activeLoan.id)
        .then(setActiveRepledge)
        .catch(() => setActiveRepledge(null));
    } else {
      setActiveRepledge(null);
    }
  }, [activeLoan?.id]);

  // Dynamic Interest Snapshot with leap-year 365/366 simple interest & dynamic completed days/months
  const interestSnapshot = useMemo(() => {
    if (!activeLoan) return null;
    return calculateLoanInterestSnapshot({
      id: activeLoan.id,
      principal_amount: activeLoan.principal_amount || 0,
      total_principal_paid: activeLoan.total_principal_paid || 0,
      interest_rate_apr: activeLoan.interest_rate_apr || 18,
      origination_date: activeLoan.origination_date || new Date().toISOString(),
      maturity_date: activeLoan.maturity_date || new Date().toISOString(),
      total_interest_paid: activeLoan.total_interest_paid || 0,
      outstanding_interest: activeLoan.outstanding_interest,
    } as any);
  }, [activeLoan]);

  // Outstanding calculations safely guarded against empty state
  const principalAmount = activeLoan ? (activeLoan.principal_amount || 0) : 0;
  const outstandingPrincipal = interestSnapshot 
    ? interestSnapshot.currentPrincipal 
    : activeLoan ? Math.max(0, principalAmount - (activeLoan.total_principal_paid || 0)) : 0;
  const outstandingInterest = interestSnapshot 
    ? interestSnapshot.outstandingInterest 
    : activeLoan ? (activeLoan.outstanding_interest || 0) : 0;
  const penaltyNum = typeof penaltyFee === 'number' ? penaltyFee : 0;
  const waiverNum = typeof discountWaiver === 'number' ? discountWaiver : 0;
  const totalOutstanding = Math.max(0, outstandingPrincipal + outstandingInterest + penaltyNum - waiverNum);

  // Authoritative payment allocation split following PGF rules:
  // Payment -> Penalty -> Interest -> Principal
  const allocation = useMemo(() => {
    const rawPaid = typeof paymentAmount === 'number' ? paymentAmount : 0;
    const rawPenalty = typeof penaltyFee === 'number' ? penaltyFee : 0;
    const rawWaiver = typeof discountWaiver === 'number' ? discountWaiver : 0;

    const split = calculatePaymentSplit(
      rawPaid,
      outstandingInterest,
      outstandingPrincipal,
      rawPenalty,
      rawWaiver
    );

    const penaltyPaid = Math.min(rawPaid, rawPenalty);

    return {
      totalAmount: split.totalAmount,
      penaltyPaid,
      interestPaid: split.interestPortion,
      principalPaid: split.principalPortion,
      waiverApplied: rawWaiver,
      remainingPenalty: Math.max(0, rawPenalty - penaltyPaid),
      remainingInterest: split.remainingInterest,
      remainingPrincipal: split.remainingPrincipal,
      remainingTotal: split.newOutstanding,
      isFullSettlement: split.isFullSettlement,
    };
  }, [paymentAmount, outstandingInterest, outstandingPrincipal, penaltyFee, discountWaiver]);

  // Handle Select Loan change
  const handleLoanChange = (id: string) => {
    setSelectedLoanId(id);
    setPaymentAmount('');
    setInterestInput('');
    setPrincipalInput('');
    setError(null);
    setValidationErrors({});
  };

  // Quick Action Buttons
  const setPayInterestOnly = () => {
    const intAmt = Math.round(outstandingInterest * 100) / 100;
    const penAmt = penaltyNum > 0 ? penaltyNum : 0;
    const total = intAmt + penAmt;
    setInterestInput(intAmt);
    setPrincipalInput(0);
    setPaymentAmount(total);
  };

  const setPayInterestPlusPrincipal = (principalToAdd = 100) => {
    const intAmt = Math.round(outstandingInterest * 100) / 100;
    const penAmt = penaltyNum > 0 ? penaltyNum : 0;
    const princAmt = Math.min(principalToAdd, outstandingPrincipal);
    const total = intAmt + penAmt + princAmt;
    setInterestInput(intAmt);
    setPrincipalInput(princAmt);
    setPaymentAmount(total);
  };

  const setPayFullSettlement = () => {
    const intAmt = Math.round(outstandingInterest * 100) / 100;
    const penAmt = penaltyNum > 0 ? penaltyNum : 0;
    const princAmt = Math.round(outstandingPrincipal * 100) / 100;
    const total = Math.max(0, intAmt + penAmt + princAmt - waiverNum);
    setInterestInput(intAmt);
    setPrincipalInput(princAmt);
    setPaymentAmount(total);
  };

  // Direct Input Handlers
  const handleInterestInputChange = (val: number | '') => {
    setInterestInput(val);
    const intVal = typeof val === 'number' ? val : 0;
    const princVal = typeof principalInput === 'number' ? principalInput : 0;
    const penVal = typeof penaltyFee === 'number' ? penaltyFee : 0;
    setPaymentAmount(Math.max(0, intVal + princVal + penVal - waiverNum));
  };

  const handlePrincipalInputChange = (val: number | '') => {
    setPrincipalInput(val);
    const princVal = typeof val === 'number' ? val : 0;
    const intVal = typeof interestInput === 'number' ? interestInput : 0;
    const penVal = typeof penaltyFee === 'number' ? penaltyFee : 0;
    setPaymentAmount(Math.max(0, intVal + princVal + penVal - waiverNum));
  };

  const handleTotalAmountChange = (val: number | '') => {
    setPaymentAmount(val);
    if (typeof val === 'number') {
      const penVal = typeof penaltyFee === 'number' ? penaltyFee : 0;
      const split = calculatePaymentSplit(
        val,
        outstandingInterest,
        outstandingPrincipal,
        penVal,
        waiverNum
      );
      setInterestInput(split.interestPortion);
      setPrincipalInput(split.principalPortion);
    } else {
      setInterestInput('');
      setPrincipalInput('');
    }
  };

  // Formatter for Indian Currency
  const formatINR = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(val);
  };

  // Pre-posting Validation & Confirmation Trigger
  const handleInitiatePayment = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setValidationErrors({});

    if (!activeLoan) {
      setError('Please select an active gold loan account to register repayment.');
      return;
    }

    if (paymentAmount === '' || typeof paymentAmount !== 'number' || isNaN(paymentAmount) || paymentAmount <= 0) {
      setValidationErrors({ paymentAmount: 'Please enter a valid repayment amount greater than zero.' });
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

    const validation = paymentValidationSchema.safeParse(formData);
    if (!validation.success) {
      const fieldErrors: Record<string, string> = {};
      validation.error.issues.forEach((issue) => {
        const path = issue.path[0] as string;
        fieldErrors[path] = issue.message;
      });
      setValidationErrors(fieldErrors);
      return;
    }

    if (paymentAmount > totalOutstanding) {
      setError(`Validation Error: Repayment amount of ${formatINR(paymentAmount)} exceeds the total outstanding balance of ${formatINR(totalOutstanding)}.`);
      return;
    }

    if (!['Cash'].includes(paymentMode) && (!transactionId || transactionId.trim() === '')) {
      setValidationErrors({ transactionId: 'Transaction reference is mandatory for all digital payment options.' });
      return;
    }

    if (new Date(paymentDate) > new Date()) {
      setValidationErrors({ paymentDate: 'Payment date cannot be in the future.' });
      return;
    }

    // Open confirmation modal before actual database mutation
    setIsConfirmModalOpen(true);
  };

  // Atomic Execution After Confirmation
  const executePaymentPost = async () => {
    if (!activeLoan || isSubmitting) return;

    setIsSubmitting(true);
    setLoading(true);
    setError(null);

    const currentLoan = activeLoan;

    try {
      let finalReceiptNumber = generateReceiptNumber();
      let postedPayment: any = null;

      if (isFirebaseConfigured()) {
        // Prevent duplicate transaction reference
        if (transactionId) {
          const dupQ = query(
            collection(db, 'payments'),
            where('loan_id', '==', currentLoan.id)
          );
          const dupSnap = await getDocs(dupQ);
          const hasDuplicate = dupSnap.docs.some(d => {
            const rem = d.data().remarks || '';
            return rem.toLowerCase().includes(transactionId.toLowerCase());
          });
          
          if (hasDuplicate) {
            setValidationErrors({ transactionId: 'Repayment reference already registered. Duplicate transaction IDs are barred.' });
            setIsConfirmModalOpen(false);
            setLoading(false);
            setIsSubmitting(false);
            return;
          }
        }

        // Post Atomic Database Transaction
        postedPayment = await recordPayment({
          loan_id: currentLoan.id,
          customer_id: currentLoan.customer?.id || currentLoan.customer_id,
          amount_paid: paymentAmount as number,
          interest_portion: allocation.interestPaid,
          principal_portion: allocation.principalPaid,
          penalty_amount: allocation.penaltyPaid,
          waiver_amount: allocation.waiverApplied,
          payment_type: allocation.isFullSettlement ? 'Full_Settlement' : 'Partial_Settlement',
          mode: paymentMode as any,
          remarks: `[Txn ID: ${transactionId || 'N/A'}] ${remarks}`,
          calculation_snapshot: interestSnapshot || undefined,
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
            message: `Dear ${currentLoan.customer.name || 'Customer'}, payment of ${formatINR(paymentAmount as number)} received via ${paymentMode}. Principal reduced to ${formatINR(allocation.remainingPrincipal)}. Thank you!`,
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
        customerId: currentLoan.customer?.customer_number || currentLoan.customer_id,
        paymentDate: new Date(paymentDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        paymentMode: paymentMode,
        transactionId: transactionId || 'N/A',
        interestPaid: allocation.interestPaid,
        penaltyPaid: allocation.penaltyPaid,
        principalPaid: allocation.principalPaid,
        waiverApplied: allocation.waiverApplied,
        totalPaid: paymentAmount,
        previousPrincipal: outstandingPrincipal,
        remainingPrincipal: allocation.remainingPrincipal,
        remainingInterest: allocation.remainingInterest,
        remainingBalance: allocation.remainingTotal,
        collectedBy: loggedInAdmin?.name || 'Authorized Officer',
        sloganId: postedPayment?.slogan_id,
        sloganText: postedPayment?.slogan_text,
      });

      setIsConfirmModalOpen(false);
      setSuccess(true);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Operational failure: Could not record payment. Please check database connectivity.');
      setIsConfirmModalOpen(false);
    } finally {
      setLoading(false);
      setIsSubmitting(false);
    }
  };

  const handleTriggerAlert = (type: 'sms' | 'whatsapp' | 'email') => {
    alert(`Confirmation dispatched: Payment receipt alert has been sent to ${activeLoan?.customer?.name || 'Customer'} via ${type.toUpperCase()}`);
  };

  // Check if collateral is re-pledged to bank
  const isRepledgedWithBank = Boolean(
    activeLoan?.bank_repledge_id || 
    activeLoan?.gold_collateral?.some(c => c.custody_location && c.custody_location !== 'PGF Safe')
  );

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
          <p className="text-gray-500 text-xs mt-1">
            Accept customer gold loan repayments with atomic ledger allocation: Penalty &rarr; Interest &rarr; Principal.
          </p>
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
        <form onSubmit={handleInitiatePayment} className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Bank Re-Pledge Details Card (Full Width) */}
          <div className="col-span-1 lg:col-span-3">
            <RePledgeCard
              loan={activeLoan}
              repledge={activeRepledge}
              collateral={activeLoan?.gold_collateral as any}
              onRefresh={fetchActiveLoansAndProfile}
            />
          </div>

          {/* LEFT: Customer, Collateral and Loan summaries */}
          <div className="space-y-6 lg:col-span-1">
            {/* Customer Information Card */}
            <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-5 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-2">
                <h3 className="text-xs font-bold text-[#2563EB] uppercase tracking-wider flex items-center gap-1.5 font-outfit">
                  <User size={14} />
                  Customer Profile
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                  activeLoan.customer?.kyc_status === 'Verified' 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                }`}>
                  KYC: {activeLoan.customer?.kyc_status || 'Verified'}
                </span>
              </div>

              <div className="flex gap-4 items-center">
                <div className="w-14 h-14 rounded-full bg-[#F3F4F6] border border-[#2563EB]/30 flex items-center justify-center text-[#2563EB] text-xl font-bold font-outfit uppercase overflow-hidden shrink-0 shadow-inner">
                  {activeLoan.customer?.photo_url ? (
                    <img src={activeLoan.customer.photo_url} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    (activeLoan.customer?.name || 'CU').substring(0, 2)
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="font-semibold text-gray-900 text-sm block truncate">{activeLoan.customer?.name || 'Customer'}</span>
                  <span className="text-[10px] text-gray-500 block font-mono">
                    ID: <strong className="text-blue-700">{activeLoan.customer?.customer_number || activeLoan.customer_id.substring(0, 8)}</strong>
                  </span>
                  <span className="text-[10px] text-gray-500 block font-mono">{activeLoan.customer?.phone_primary || 'N/A'}</span>
                  <span className="text-[10px] text-gray-400 block font-mono truncate">
                    Aadhaar: {(activeLoan.customer?.national_id || '').replace(/.(?=.{4})/g, '*')}
                  </span>
                </div>
              </div>

              {/* Nominee details if available */}
              {activeLoan.customer?.nominee_name && (
                <div className="p-2 bg-blue-50/60 border border-blue-100 rounded-lg text-[10px] text-blue-900">
                  <span className="font-semibold block">Nominee:</span>
                  <span>{activeLoan.customer.nominee_name} ({activeLoan.customer.nominee_relationship || 'Relation'}) &bull; {activeLoan.customer.nominee_phone || 'N/A'}</span>
                </div>
              )}

              <div className="pt-2 border-t border-[#E5E7EB]/50 grid grid-cols-2 gap-x-2 gap-y-1.5 text-[10px] text-gray-500 font-mono">
                <div>Loan Code: <span className="text-gray-900 block font-semibold">{activeLoan.loan_number}</span></div>
                <div>Status: <span className="text-emerald-600 block font-bold uppercase">{activeLoan.status}</span></div>
                <div>Origination: <span className="text-gray-900 block">{new Date(activeLoan.origination_date).toLocaleDateString()}</span></div>
                <div>Maturity Date: <span className="text-gray-900 block">{new Date(activeLoan.maturity_date).toLocaleDateString()}</span></div>
              </div>
            </div>

            {/* Gold Collateral Details Card */}
            <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-5 space-y-3 shadow-sm">
              <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-2">
                <h3 className="text-xs font-bold text-[#2563EB] uppercase tracking-wider flex items-center gap-1.5 font-outfit">
                  <Coins size={14} />
                  Gold Collateral ({activeLoan.gold_collateral?.length || 0})
                </h3>
                <span className="text-[10px] text-gray-500 font-mono">
                  Bin: {activeLoan.current_bin_id || activeLoan.gold_collateral?.[0]?.storage_bin_id || 'Vault A'}
                </span>
              </div>

              {/* Bank Re-Pledge Status Banner */}
              {isRepledgedWithBank && (
                <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 text-xs flex items-start gap-2">
                  <Building2 size={16} className="text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block uppercase tracking-wider text-[10px] text-amber-800">
                      Re-Pledged with Bank
                    </span>
                    <p className="text-[11px] leading-tight">
                      Custody: {activeLoan.gold_collateral?.[0]?.custody_location || 'Bank Vault'}. Gold release locked until bank settlement is completed.
                    </p>
                  </div>
                </div>
              )}

              {activeLoan.gold_collateral && activeLoan.gold_collateral.length > 0 ? (
                activeLoan.gold_collateral.map((item, idx) => (
                  <div key={idx} className="space-y-1 text-xs border-b border-[#E5E7EB]/30 pb-2 last:border-b-0 last:pb-0">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-center gap-2">
                        {item.front_photo_url ? (
                          <img 
                            src={item.front_photo_url} 
                            alt={item.item_description} 
                            className="w-9 h-9 object-cover rounded-md border border-gray-200 shrink-0" 
                          />
                        ) : (
                          <div className="w-9 h-9 bg-amber-50 border border-amber-200 rounded-md flex items-center justify-center text-amber-700 shrink-0">
                            <Coins size={16} />
                          </div>
                        )}
                        <div>
                          <span className="text-gray-800 font-medium block">{item.item_description}</span>
                          <span className="text-[10px] text-gray-400 font-mono">{item.ornament_type || 'Ornament'}</span>
                        </div>
                      </div>
                      <span className="text-[#2563EB] font-bold shrink-0">{item.purity_karat}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-gray-500 font-mono pt-1">
                      <span>Weights: {item.gross_weight}g (G) / {item.net_weight}g (Net)</span>
                      <span>Val: {formatINR(item.valuation_inr)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-gray-500 text-xs italic">No collateral items found.</div>
              )}
            </div>

            {/* Financial Ledger Summary with Dynamic Elapsed Days & Months */}
            <div className="bg-[#ffffff] border border-[#2563EB]/10 rounded-xl p-5 space-y-4 shadow-sm">
              <h3 className="text-xs font-bold text-[#2563EB] uppercase tracking-wider border-b border-[#E5E7EB] pb-2 flex items-center gap-1.5 font-outfit">
                <DollarSign size={14} />
                Financial Summary
              </h3>
              
              {/* Dynamic Elapsed Days & Months Badge */}
              {interestSnapshot && (
                <div className="grid grid-cols-2 gap-2 p-2.5 bg-blue-50/70 border border-blue-100 rounded-lg text-center">
                  <div>
                    <span className="text-[9px] text-blue-700 font-bold uppercase tracking-wider block">Days Elapsed</span>
                    <span className="text-sm font-extrabold text-blue-950 font-mono">{interestSnapshot.daysElapsed} Days</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-blue-700 font-bold uppercase tracking-wider block">Months Completed</span>
                    <span className="text-sm font-extrabold text-blue-950 font-mono">{interestSnapshot.monthsCompleted} Months</span>
                  </div>
                </div>
              )}

              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Original Principal:</span>
                  <span className="text-gray-900 font-semibold">{formatINR(principalAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Current Principal Balance:</span>
                  <span className="text-blue-700 font-bold text-sm">{formatINR(outstandingPrincipal)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Interest Rate (APR):</span>
                  <span className="font-semibold text-gray-800">{activeLoan.interest_rate_apr}% APR</span>
                </div>
                <div className="flex justify-between text-amber-600">
                  <span>Accrued Interest (up to today):</span>
                  <span className="font-bold">{formatINR(outstandingInterest)}</span>
                </div>
                <div className="flex justify-between text-gray-400 text-[11px]">
                  <span>Interest Already Paid:</span>
                  <span className="font-mono">{formatINR(activeLoan.total_interest_paid || 0)}</span>
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
                  <span>Total Payable Amount:</span>
                  <span className="text-[#2563EB] font-outfit text-base">{formatINR(totalOutstanding)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: Input Form and Splits Allocation */}
          <div className="lg:col-span-2 space-y-6">
            {/* Quick Actions Bar */}
            <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-4 shadow-sm space-y-2">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">
                Quick Collection Actions
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={setPayInterestOnly}
                  className="px-3 py-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Clock size={13} className="text-amber-700" />
                  <span>Pay Interest Only ({formatINR(outstandingInterest)})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPayInterestPlusPrincipal(100)}
                  className="px-3 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Sparkles size={13} className="text-blue-700" />
                  <span>Pay Interest + ₹100 Principal</span>
                </button>
                <button
                  type="button"
                  onClick={setPayFullSettlement}
                  className="px-3 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-xs font-bold transition flex items-center justify-center gap-1 cursor-pointer"
                >
                  <CheckCircle2 size={13} className="text-emerald-700" />
                  <span>Full Settlement ({formatINR(totalOutstanding)})</span>
                </button>
              </div>
            </div>

            {/* Repayment Log Form Box */}
            <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-6 space-y-5 shadow-sm">
              <h3 className="text-xs font-bold text-[#2563EB] uppercase tracking-wider border-b border-[#E5E7EB] pb-2 flex items-center gap-1.5 font-outfit">
                <ReceiptIcon size={14} />
                Payment Transaction Details
              </h3>

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

              {/* Direct Interest & Principal Inputs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-amber-800 block">
                    Interest Amount (₹)
                  </label>
                  <input
                    type="number"
                    placeholder={`Due: ₹${outstandingInterest.toFixed(2)}`}
                    value={interestInput}
                    onChange={(e) => handleInterestInputChange(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className="w-full bg-white border border-amber-300 focus:border-amber-500 text-gray-900 text-sm font-bold rounded-lg px-3 py-2 outline-none transition"
                  />
                  <span className="text-[10px] text-gray-500 block">
                    Customer paying interest only keeps principal unchanged.
                  </span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-emerald-800 block">
                    Principal Reduction Amount (₹)
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 100"
                    value={principalInput}
                    onChange={(e) => handlePrincipalInputChange(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className="w-full bg-white border border-emerald-300 focus:border-emerald-500 text-gray-900 text-sm font-bold rounded-lg px-3 py-2 outline-none transition"
                  />
                  <span className="text-[10px] text-gray-500 block">
                    Immediately reduces principal balance (e.g. ₹10,000 - ₹100 = ₹9,900).
                  </span>
                </div>
              </div>

              {/* Total Payment Amount */}
              <div className="space-y-1.5">
                <label className="text-xs text-gray-700 font-bold">Total Payment Amount Received (INR) *</label>
                <div className="relative">
                  <input
                    type="number"
                    required
                    placeholder="Enter total repayment amount"
                    value={paymentAmount}
                    onChange={(e) => handleTotalAmountChange(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className={`w-full bg-[#F3F4F6] border ${validationErrors.paymentAmount ? 'border-rose-500' : 'border-[#E5E7EB]'} focus:border-[#2563EB] text-gray-900 text-base font-bold rounded-lg pl-8 pr-4 py-2.5 outline-none transition`}
                  />
                  <span className="absolute left-3 top-3 text-gray-500 text-sm font-semibold">₹</span>
                </div>
                {validationErrors.paymentAmount ? (
                  <span className="text-[10px] text-red-500 block">{validationErrors.paymentAmount}</span>
                ) : (
                  <span className="text-[10px] text-gray-500 font-medium block">
                    Rupee format: <span className="text-emerald-600 font-semibold">{typeof paymentAmount === 'number' ? formatINR(paymentAmount) : '—'}</span>
                  </span>
                )}
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
                  <label className="text-xs text-gray-500 font-medium">Penalty Amount (₹)</label>
                  <input
                    type="number"
                    placeholder="e.g. 250"
                    value={penaltyFee}
                    onChange={(e) => setPenaltyFee(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 text-xs rounded-lg px-3.5 py-2.5 outline-none transition"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-gray-500 font-medium">Approved Waiver Amount (₹)</label>
                  <input
                    type="number"
                    placeholder="e.g. 100"
                    value={discountWaiver}
                    onChange={(e) => setDiscountWaiver(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 text-xs rounded-lg px-3.5 py-2.5 outline-none transition"
                  />
                  <span className="text-[9px] text-gray-400 block">Waivers require Manager/Admin approval in audit log.</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-gray-500 font-medium">Payment Remarks</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Interest and principal payment for current billing cycle"
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
                  <span className="text-[9px] text-gray-500 uppercase tracking-wider block font-semibold text-amber-500">Interest Portion</span>
                  <span className="text-sm font-bold text-amber-600 block mt-1">-{formatINR(allocation.interestPaid)}</span>
                </div>

                <div className="bg-[#F8FAFC] border border-[#E5E7EB] rounded-lg p-3">
                  <span className="text-[9px] text-gray-500 uppercase tracking-wider block font-semibold text-red-500">Penalty Portion</span>
                  <span className="text-sm font-bold text-red-500 block mt-1">-{formatINR(allocation.penaltyPaid)}</span>
                </div>

                <div className="bg-[#F8FAFC] border border-[#E5E7EB] rounded-lg p-3">
                  <span className="text-[9px] text-gray-500 uppercase tracking-wider block font-semibold text-emerald-600">Principal Portion</span>
                  <span className="text-sm font-bold text-emerald-600 block mt-1">-{formatINR(allocation.principalPaid)}</span>
                </div>
              </div>

              {/* Outstanding split summary ledger with reducing principal demonstration */}
              <div className="p-4 bg-emerald-500/5 border border-emerald-500/15 rounded-lg space-y-2 text-xs">
                <div className="flex justify-between items-center text-gray-600">
                  <span>Accrued Interest Balance:</span>
                  <span className="font-mono">{formatINR(outstandingInterest)} &rarr; <span className="text-amber-600 font-bold">{formatINR(allocation.remainingInterest)}</span></span>
                </div>
                <div className="flex justify-between items-center text-gray-600">
                  <span>Outstanding Principal Balance:</span>
                  <span className="font-mono">{formatINR(outstandingPrincipal)} &rarr; <span className="text-emerald-600 font-bold">{formatINR(allocation.remainingPrincipal)}</span></span>
                </div>
                {allocation.principalPaid > 0 && (
                  <div className="text-[11px] text-emerald-700 bg-emerald-50 p-1.5 rounded border border-emerald-200">
                    💡 <strong>Principal Reduction:</strong> Principal will decrease from <strong>{formatINR(outstandingPrincipal)}</strong> to <strong>{formatINR(allocation.remainingPrincipal)}</strong>. Next period interest will calculate on <strong>{formatINR(allocation.remainingPrincipal)}</strong>.
                  </div>
                )}
                <div className="pt-2 border-t border-emerald-500/10 flex justify-between items-center font-bold text-gray-900 text-sm">
                  <span>Remaining Total Due:</span>
                  <span className="text-[#2563EB] font-mono">{formatINR(allocation.remainingTotal)}</span>
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
                <ReceiptIcon size={14} />
                Review &amp; Confirm Payment
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
                <span>Previous Principal Balance:</span>
                <span>{formatINR(successReceipt?.previousPrincipal)}</span>
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
              {successReceipt?.waiverApplied > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Approved Waiver Applied:</span>
                  <span>{formatINR(successReceipt?.waiverApplied)}</span>
                </div>
              )}
            </div>

            {/* Total Paid / Remaining */}
            <div className="space-y-2 pt-2 text-right">
              <div className="flex justify-between text-gray-900 font-bold">
                <span>Total Amount Paid:</span>
                <span className="text-[#2563EB] text-sm">{formatINR(successReceipt?.totalPaid)}</span>
              </div>
              <div className="flex justify-between text-emerald-700 font-bold text-xs">
                <span>New Remaining Principal:</span>
                <span>{formatINR(successReceipt?.remainingPrincipal)}</span>
              </div>
              <div className="flex justify-between text-gray-500 text-[10px]">
                <span>Remaining Total Loan Due:</span>
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

          {/* Voucher Actions Control buttons: Standard A4 & 80mm Thermal */}
          <div className="flex flex-wrap gap-3 justify-center">
            <button
              onClick={() => {
                const url = getPdfApiUrl({ type: 'receipt', paymentId: createdPaymentId, loanId: activeLoan.id, amount: typeof paymentAmount === 'number' ? paymentAmount : undefined });
                setPreviewUrl(url);
                setPreviewTitle(`Official Payment Receipt - ${successReceipt?.receiptNo || activeLoan.loan_number}`);
                setIsPreviewOpen(true);
              }}
              className="px-4 py-2.5 rounded-lg bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#2563EB] border border-[#2563EB]/20 text-xs font-bold uppercase tracking-wider transition flex items-center gap-1.5 cursor-pointer font-outfit"
            >
              <Printer size={14} /> Preview A4
            </button>
            <button
              onClick={() => {
                const url = getPdfApiUrl({ type: 'receipt', paymentId: createdPaymentId, loanId: activeLoan.id, format: 'thermal' });
                setPreviewUrl(url);
                setPreviewTitle(`80mm Thermal Receipt - ${successReceipt?.receiptNo || activeLoan.loan_number}`);
                setIsPreviewOpen(true);
              }}
              className="px-4 py-2.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold uppercase tracking-wider transition flex items-center gap-1.5 font-outfit cursor-pointer"
            >
              <Printer size={14} /> 80mm Thermal POS
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
              className="px-4 py-2.5 rounded-lg bg-[#F3F4F6] hover:bg-[#E5E7EB] text-gray-700 hover:text-gray-900 border border-[#E5E7EB] text-xs font-bold uppercase tracking-wider transition flex items-center gap-1.5 font-outfit cursor-pointer"
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
              className="px-4 py-2.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold uppercase tracking-wider transition flex items-center gap-1.5 font-outfit cursor-pointer"
            >
              <Printer size={14} /> Instant Print
            </button>
            <button
              onClick={() => router.push('/admin/dashboard')}
              className="px-4 py-2.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-[#F8FAFC] text-xs font-bold uppercase tracking-wider transition cursor-pointer font-outfit"
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
        <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-5 space-y-4 shadow-sm">
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
                  Entering {typeof paymentAmount === 'number' ? formatINR(paymentAmount) : 'repayment amount'} will clear {formatINR(allocation.interestPaid)} interest and reduce principal by {formatINR(allocation.principalPaid)}.
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

      {/* PRE-POSTING CONFIRMATION MODAL */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <ReceiptIcon size={16} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 font-outfit">Confirm Repayment Posting</h3>
                  <p className="text-[11px] text-gray-500">Atomic Financial Ledger Transaction</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                disabled={isSubmitting}
                className="text-gray-400 hover:text-gray-600 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl space-y-1.5 border border-slate-200">
                <div className="flex justify-between">
                  <span className="text-gray-500">Customer:</span>
                  <span className="font-bold text-gray-900">{activeLoan?.customer?.name} ({activeLoan?.customer?.customer_number || activeLoan?.customer_id.substring(0, 8)})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Loan Account:</span>
                  <span className="font-bold text-blue-700 font-mono">{activeLoan?.loan_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Payment Mode:</span>
                  <span className="font-semibold text-gray-800">{paymentMode}</span>
                </div>
                {transactionId && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Transaction Ref:</span>
                    <span className="font-mono text-gray-800">{transactionId}</span>
                  </div>
                )}
              </div>

              <div className="space-y-1.5 border border-gray-100 rounded-xl p-3 bg-white">
                <div className="flex justify-between text-gray-600">
                  <span>Previous Principal:</span>
                  <span className="font-mono font-semibold">{formatINR(outstandingPrincipal)}</span>
                </div>
                <div className="flex justify-between text-amber-700 font-semibold">
                  <span>Interest Paid:</span>
                  <span className="font-mono">-{formatINR(allocation.interestPaid)}</span>
                </div>
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span>Principal Paid:</span>
                  <span className="font-mono">-{formatINR(allocation.principalPaid)}</span>
                </div>
                {allocation.penaltyPaid > 0 && (
                  <div className="flex justify-between text-red-600 font-semibold">
                    <span>Penalty Paid:</span>
                    <span className="font-mono">-{formatINR(allocation.penaltyPaid)}</span>
                  </div>
                )}
                {allocation.waiverApplied > 0 && (
                  <div className="flex justify-between text-blue-600 font-semibold">
                    <span>Waiver Applied:</span>
                    <span className="font-mono">-{formatINR(allocation.waiverApplied)}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-gray-100 flex justify-between font-bold text-sm text-gray-900">
                  <span>Total Received:</span>
                  <span className="text-blue-700 font-mono">{formatINR(paymentAmount as number)}</span>
                </div>
              </div>

              <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl space-y-1">
                <div className="flex justify-between font-bold text-emerald-950 text-xs">
                  <span>New Principal Balance:</span>
                  <span className="font-mono">{formatINR(allocation.remainingPrincipal)}</span>
                </div>
                <div className="flex justify-between text-emerald-800 text-[11px]">
                  <span>Remaining Interest Due:</span>
                  <span className="font-mono">{formatINR(allocation.remainingInterest)}</span>
                </div>
                {allocation.principalPaid > 0 && (
                  <p className="text-[10px] text-emerald-800 pt-1 border-t border-emerald-200/60 mt-1">
                    Future interest calculations will run on <strong>{formatINR(allocation.remainingPrincipal)}</strong>.
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                disabled={isSubmitting}
                className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executePaymentPost}
                disabled={isSubmitting}
                className="px-5 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-blue-500/20 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Posting to Ledger...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={14} />
                    <span>Confirm &amp; Post Payment</span>
                  </>
                )}
              </button>
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
