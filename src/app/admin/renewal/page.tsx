'use client';

import React, { useState, useEffect, useTransition, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  Calendar,
  Coins,
  ArrowRight,
  ArrowLeft,
  Printer,
  Download,
  FileText,
  Building2,
  Check,
  AlertTriangle,
  QrCode,
  Sparkles,
  Info
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, doc, getDoc, getDocs, query, where, limit } from 'firebase/firestore';
import { getCurrentProfile } from '@/lib/auth';
import { calculateLoanInterestSnapshot, toPaise, fromPaise } from '@/lib/db/interest';
import { processLoanRenewal } from '@/lib/db/renewal';
import { calculatePaymentSplit } from '@/lib/db/payments';
import type { Loan, GoldCollateral, RenewalType } from '@/types/database';
import { getPdfApiUrl, downloadPdfDocument, printPdfDocument } from '@/lib/pdfHelper';
import PDFPreviewModal from '@/components/PDFPreviewModal';

function RenewalWizardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryLoanId = searchParams.get('loanId') || '';

  // Wizard state: Steps 1 to 6
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isPending, startTransition] = useTransition();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Loaded Loan & Collateral data
  const [loan, setLoan] = useState<any | null>(null);
  const [collateral, setCollateral] = useState<GoldCollateral[]>([]);
  const [customer, setCustomer] = useState<any | null>(null);
  const [currentUser, setCurrentUser] = useState<any | null>(null);

  // Interest Snapshot
  const [interestSnapshot, setInterestSnapshot] = useState<any | null>(null);

  // Step 2: Financial Settlement Form
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [amountReceived, setAmountReceived] = useState<number | ''>('');
  const [penaltyAmount, setPenaltyAmount] = useState<number | ''>('');
  const [waiverAmount, setWaiverAmount] = useState<number | ''>('');
  const [paymentMode, setPaymentMode] = useState<string>('Cash');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');

  // Step 3: Renewal Configuration
  const [renewalType, setRenewalType] = useState<RenewalType>('INTEREST_ONLY');
  const [tenureMonths, setTenureMonths] = useState<number>(12);
  const [newApr, setNewApr] = useState<number>(18);
  const [additionalDisbursement, setAdditionalDisbursement] = useState<number | ''>('');

  // Step 4: Collateral Verification
  const [physicalVerified, setPhysicalVerified] = useState<boolean>(false);
  const [appraiserConfirmed, setAppraiserConfirmed] = useState<boolean>(false);

  // Step 6: Final result
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [renewalResult, setRenewalResult] = useState<any | null>(null);

  // PDF Modal
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');

  const handleSearchById = async (targetId: string) => {
    setSearchLoading(true);
    setSearchError(null);
    try {
      const loanDoc = await getDoc(doc(db, 'loans', targetId));
      let loanData: any = null;

      if (loanDoc.exists()) {
        loanData = { id: loanDoc.id, ...loanDoc.data() };
      } else {
        // Try searching by loan_number
        const qSnap = await getDocs(
          query(collection(db, 'loans'), where('loan_number', '==', targetId.trim()), limit(1))
        );
        if (!qSnap.empty) {
          loanData = { id: qSnap.docs[0].id, ...qSnap.docs[0].data() };
        }
      }

      if (!loanData) {
        setSearchError(`Loan '${targetId}' not found. Please verify the loan number.`);
        setLoan(null);
        return;
      }

      if (['Settled', 'Closed', 'Cancelled'].includes(loanData.status)) {
        setSearchError(`Loan ${loanData.loan_number} is already ${loanData.status}. Only active loans can be renewed.`);
        setLoan(null);
        return;
      }

      // Load customer
      if (loanData.customer_id) {
        const cSnap = await getDoc(doc(db, 'profiles', loanData.customer_id));
        if (cSnap.exists()) {
          setCustomer({ id: cSnap.id, ...cSnap.data() });
        }
      }

      // Load collateral
      const colSnap = await getDocs(
        query(collection(db, 'gold_collateral'), where('loan_id', '==', loanData.id))
      );
      const items = colSnap.docs.map((d) => ({ id: d.id, ...d.data() } as GoldCollateral));
      setCollateral(items);

      // Load payment history for accurate interest calculation
      const paySnap = await getDocs(
        query(collection(db, 'payments'), where('loan_id', '==', loanData.id))
      );
      const payments = paySnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // Centralized interest calculation snapshot
      const snapshot = calculateLoanInterestSnapshot(loanData, new Date().toISOString().split('T')[0], payments);
      setInterestSnapshot(snapshot);
      setLoan(loanData);
      setNewApr(loanData.interest_rate_apr || 18);
      setTenureMonths(loanData.tenure_months || 12);

      // Default amount to accrued interest
      const accrued = snapshot.outstandingInterest;
      setAmountReceived(accrued);
    } catch (err: any) {
      console.error('Error fetching loan for renewal:', err);
      setSearchError(err.message || 'Failed to search loan.');
    } finally {
      setSearchLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    getCurrentProfile().then(setCurrentUser).catch(() => {});
    if (queryLoanId) {
      handleSearchById(queryLoanId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryLoanId]);

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    handleSearchById(searchQuery.trim());
  };

  // Financial calculations
  const remainingPrincipal = loan
    ? Math.max(0, (loan.principal_amount || 0) - (loan.total_principal_paid || 0))
    : 0;
  const accruedInterest = interestSnapshot
    ? interestSnapshot.outstandingInterest
    : (loan?.outstanding_interest || 0);

  const numReceived = typeof amountReceived === 'number' ? amountReceived : 0;
  const numPenalty = typeof penaltyAmount === 'number' ? penaltyAmount : 0;
  const numWaiver = typeof waiverAmount === 'number' ? waiverAmount : 0;

  const split = calculatePaymentSplit(
    numReceived,
    accruedInterest,
    remainingPrincipal,
    numPenalty,
    numWaiver
  );

  const interestCleared = split.interestPortion;
  const principalReduction = split.principalPortion;
  const penaltyCleared = Math.min(numReceived, numPenalty);
  const newPrincipalBalance = Math.max(0, remainingPrincipal - principalReduction);

  // New maturity date calculation
  const getNewMaturityDate = (): string => {
    const base = new Date();
    base.setMonth(base.getMonth() + Number(tenureMonths));
    return base.toISOString().split('T')[0];
  };

  // Execution: Post the Renewal to Firestore
  const handleExecuteRenewal = async () => {
    if (!loan) return;
    if (numReceived < accruedInterest && renewalType !== 'FULL_SETTLEMENT_AND_NEW') {
      alert(`For loan renewal, the minimum required payment is the accrued interest of ₹${accruedInterest.toLocaleString('en-IN')}.`);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const result = await processLoanRenewal(
        {
          loan_id: loan.id,
          customer_id: customer?.id || loan.customer_id,
          renewal_type: renewalType,
          renewal_date: paymentDate,
          old_principal: remainingPrincipal,
          new_principal: newPrincipalBalance,
          principal_paid: principalReduction,
          additional_disbursement: typeof additionalDisbursement === 'number' ? additionalDisbursement : 0,
          interest_due: accruedInterest,
          interest_paid: interestCleared,
          penalty_paid: penaltyCleared,
          total_paid: numReceived,
          old_maturity_date: loan.maturity_date || '',
          new_maturity_date: getNewMaturityDate(),
          new_tenure_months: Number(tenureMonths),
          apr_applied: Number(newApr),
          remarks: remarks || `Loan Renewal via ${renewalType}`,
          created_by: currentUser?.id || 'admin',
          created_by_name: currentUser?.name || 'Authorized Officer',
        },
        {
          mode: paymentMode as any,
          transaction_ref: referenceNumber,
          collected_by: currentUser?.name || 'Authorized Officer',
          branch_id: currentUser?.branch_id || loan.branch_id || 'MDU-01',
        }
      );

      setRenewalResult(result);
      setCurrentStep(6);
    } catch (err: any) {
      console.error('Failed to process loan renewal:', err);
      setSubmitError(err.message || 'Renewal transaction failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <RefreshCw size={20} className="animate-spin-slow" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight font-outfit">
              Loan Renewal & Extension Module
            </h1>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Re-pledge, extend tenure, reduce principal, or settle and recreate gold loans with atomic audit trails.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/billing"
            className="px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-xs font-semibold text-gray-700 transition"
          >
            Go to Billing Counter
          </Link>
          <Link
            href="/admin/re-pledge"
            className="px-3 py-2 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-xs font-semibold text-amber-800 transition flex items-center gap-1.5"
          >
            <Building2 size={14} />
            Bank Re-Pledge
          </Link>
        </div>
      </div>

      {/* Step Wizard Breadcrumb */}
      <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4 shadow-sm">
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center text-xs font-medium">
          {[
            { step: 1, label: '1. Verify Loan' },
            { step: 2, label: '2. Settlement' },
            { step: 3, label: '3. Configure' },
            { step: 4, label: '4. Collateral' },
            { step: 5, label: '5. Review' },
            { step: 6, label: '6. Print' },
          ].map((s) => (
            <div
              key={s.step}
              onClick={() => {
                if (loan && s.step < currentStep && currentStep !== 6) {
                  setCurrentStep(s.step);
                }
              }}
              className={`py-2 px-1 rounded-lg transition cursor-pointer flex flex-col items-center justify-center gap-1 ${
                currentStep === s.step
                  ? 'bg-emerald-600 text-white font-bold shadow-sm'
                  : currentStep > s.step
                  ? 'bg-emerald-50 text-emerald-700 font-semibold'
                  : 'bg-gray-50 text-gray-400'
              }`}
            >
              <span className="text-[11px] truncate w-full">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* STEP 1: LOAN VERIFICATION & SEARCH */}
      {currentStep === 1 && (
        <div className="space-y-6">
          {/* Prominent Search Bar */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-3">
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
              <Search size={14} className="text-emerald-600" />
              Search Loan Account For Renewal
            </h3>
            <form onSubmit={handleManualSearch} className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Enter Loan Number (e.g. PGF-LN-1001), Customer ID, or Mobile..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 focus:border-emerald-600 focus:bg-white text-gray-900 rounded-lg text-xs outline-none transition"
                />
                <Search size={15} className="absolute left-3 top-3 text-gray-400" />
              </div>
              <button
                type="submit"
                disabled={searchLoading}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-sm"
              >
                {searchLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Search size={14} />
                    Search Loan
                  </>
                )}
              </button>
              {loan && (
                <button
                  type="button"
                  onClick={() => {
                    setLoan(null);
                    setCustomer(null);
                    setCollateral([]);
                    setSearchQuery('');
                  }}
                  className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold transition"
                >
                  Clear
                </button>
              )}
            </form>

            {searchError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0 text-rose-600" />
                <span>{searchError}</span>
              </div>
            )}
          </div>

          {/* Customer & Loan Overview Card */}
          {loan && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Customer Dossier */}
              <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Customer Dossier</h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    KYC {customer?.kyc_status || 'Verified'}
                  </span>
                </div>
                <div className="space-y-2.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Name:</span>
                    <span className="font-semibold text-gray-900">{customer?.name || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Customer ID:</span>
                    <span className="font-mono text-gray-900">{customer?.customer_number || customer?.id || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Mobile:</span>
                    <span className="font-semibold text-gray-900">+91 {customer?.phone_primary || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Branch:</span>
                    <span className="text-gray-900">{loan.branch_name || 'Madurai Main'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Aadhaar / UID:</span>
                    <span className="text-gray-900 font-mono">
                      {customer?.national_id ? `XXXX-XXXX-${customer.national_id.slice(-4)}` : 'On File'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Loan Financial Position */}
              <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 shadow-sm lg:col-span-2">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                    Loan Status: {loan.loan_number}
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    {loan.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <span className="text-[10px] text-gray-500 uppercase block">Sanctioned Principal</span>
                    <span className="text-sm font-bold text-gray-900 block mt-0.5">
                      ₹{(loan.principal_amount || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <span className="text-[10px] text-blue-700 uppercase block font-semibold">Remaining Principal</span>
                    <span className="text-sm font-bold text-blue-900 block mt-0.5">
                      ₹{remainingPrincipal.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
                    <span className="text-[10px] text-amber-700 uppercase block font-semibold">Accrued Interest</span>
                    <span className="text-sm font-bold text-amber-900 block mt-0.5">
                      ₹{accruedInterest.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                    <span className="text-[10px] text-emerald-700 uppercase block font-semibold">Annual Rate (APR)</span>
                    <span className="text-sm font-bold text-emerald-900 block mt-0.5">
                      {loan.interest_rate_apr || 18}% p.a.
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-xs text-gray-500 pt-2 border-t border-gray-100 gap-2">
                  <span>Pledge Date: {loan.origination_date ? new Date(loan.origination_date).toLocaleDateString('en-IN') : '—'}</span>
                  <span>Maturity Date: {loan.maturity_date ? new Date(loan.maturity_date).toLocaleDateString('en-IN') : '—'}</span>
                  <span className="font-semibold text-emerald-700">
                    Total Due for Full Settlement: ₹{(remainingPrincipal + accruedInterest).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Action to proceed to step 2 */}
          {loan && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-2 shadow-sm cursor-pointer"
              >
                <span>Proceed to Financial Settlement</span>
                <ArrowRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* STEP 2: FINANCIAL SETTLEMENT */}
      {currentStep === 2 && loan && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-5">
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-3">
              Step 2: Collect Interest & Settle Dues
            </h3>

            {/* Live Financial Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                <span className="text-xs text-gray-500 block">Principal Outstanding</span>
                <span className="text-lg font-bold text-gray-900 block mt-1">
                  ₹{remainingPrincipal.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                <span className="text-xs text-amber-700 font-semibold block">Accrued Interest Due</span>
                <span className="text-lg font-bold text-amber-900 block mt-1">
                  ₹{accruedInterest.toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] text-amber-600">Calculated as of today</span>
              </div>
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                <span className="text-xs text-blue-700 font-semibold block">Minimum Required to Renew</span>
                <span className="text-lg font-bold text-blue-900 block mt-1">
                  ₹{accruedInterest.toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] text-blue-600">Interest must be cleared</span>
              </div>
            </div>

            {/* Payment Input Form */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-gray-700 font-semibold">Payment Date *</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 outline-none focus:border-emerald-600"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-gray-700 font-semibold">Total Amount Received (₹) *</label>
                <input
                  type="number"
                  placeholder="e.g. 1500"
                  value={amountReceived}
                  onChange={(e) => setAmountReceived(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 font-bold outline-none focus:border-emerald-600"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-gray-700 font-semibold">Payment Mode *</label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 outline-none focus:border-emerald-600"
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Debit Card">Debit Card</option>
                  <option value="Credit Card">Credit Card</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Demand Draft">Demand Draft</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-gray-700 font-semibold">Late Fee / Penalty (₹)</label>
                <input
                  type="number"
                  placeholder="0"
                  value={penaltyAmount}
                  onChange={(e) => setPenaltyAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 outline-none focus:border-emerald-600"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-gray-700 font-semibold">Approved Waiver / Discount (₹)</label>
                <input
                  type="number"
                  placeholder="0"
                  value={waiverAmount}
                  onChange={(e) => setWaiverAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 outline-none focus:border-emerald-600"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-gray-700 font-semibold">Transaction / UTR Reference</label>
                <input
                  type="text"
                  placeholder="e.g. UPI-20240920-89482"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 outline-none focus:border-emerald-600"
                />
              </div>
            </div>

            {/* Real-Time Payment Allocation Breakdown */}
            <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-4 space-y-3">
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">
                Automatic Allocation Preview
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-white p-2.5 rounded-lg border border-emerald-100">
                  <span className="text-gray-500 block text-[10px]">Penalty Cleared</span>
                  <span className="font-bold text-gray-900 block mt-0.5">₹{penaltyCleared.toLocaleString('en-IN')}</span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-emerald-100">
                  <span className="text-gray-500 block text-[10px]">Interest Cleared</span>
                  <span className="font-bold text-emerald-700 block mt-0.5">₹{interestCleared.toLocaleString('en-IN')}</span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-emerald-100">
                  <span className="text-gray-500 block text-[10px]">Principal Reduction</span>
                  <span className="font-bold text-blue-700 block mt-0.5">₹{principalReduction.toLocaleString('en-IN')}</span>
                </div>
                <div className="bg-white p-2.5 rounded-lg border border-emerald-100">
                  <span className="text-gray-500 block text-[10px]">New Principal Balance</span>
                  <span className="font-bold text-gray-900 block mt-0.5">₹{newPrincipalBalance.toLocaleString('en-IN')}</span>
                </div>
              </div>

              {numReceived > accruedInterest && (
                <div className="p-2 bg-emerald-100/60 rounded text-[11px] text-emerald-800 flex items-center gap-1.5">
                  <Sparkles size={13} className="text-emerald-700 shrink-0" />
                  <span>
                    Excess payment of ₹{(numReceived - accruedInterest).toLocaleString('en-IN')} will reduce the loan principal from ₹{remainingPrincipal.toLocaleString('en-IN')} to ₹{newPrincipalBalance.toLocaleString('en-IN')}.
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold transition flex items-center gap-1.5"
            >
              <ArrowLeft size={14} />
              Back
            </button>
            <button
              type="button"
              onClick={() => setCurrentStep(3)}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-2 shadow-sm"
            >
              <span>Proceed to Renewal Configuration</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: RENEWAL CONFIGURATION */}
      {currentStep === 3 && loan && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-5">
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-3">
              Step 3: Select Renewal Option & Terms
            </h3>

            {/* 4 Renewal Options */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Option A */}
              <div
                onClick={() => setRenewalType('INTEREST_ONLY')}
                className={`p-4 rounded-xl border transition cursor-pointer space-y-2 ${
                  renewalType === 'INTEREST_ONLY'
                    ? 'border-emerald-600 bg-emerald-50/40 ring-2 ring-emerald-600/20'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-900">Option A: Interest-Only Renewal</span>
                  {renewalType === 'INTEREST_ONLY' && (
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">
                      <Check size={12} />
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  Borrower pays full accrued interest. Principal balance remains unchanged at ₹{remainingPrincipal.toLocaleString('en-IN')}. Maturity date is extended.
                </p>
              </div>

              {/* Option B */}
              <div
                onClick={() => setRenewalType('INTEREST_AND_PRINCIPAL')}
                className={`p-4 rounded-xl border transition cursor-pointer space-y-2 ${
                  renewalType === 'INTEREST_AND_PRINCIPAL'
                    ? 'border-emerald-600 bg-emerald-50/40 ring-2 ring-emerald-600/20'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-900">Option B: Interest + Principal Renewal</span>
                  {renewalType === 'INTEREST_AND_PRINCIPAL' && (
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">
                      <Check size={12} />
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  Borrower pays interest plus additional principal. Principal is reduced to ₹{newPrincipalBalance.toLocaleString('en-IN')}. Future interest accrues on reduced principal.
                </p>
              </div>

              {/* Option C */}
              <div
                onClick={() => setRenewalType('FULL_SETTLEMENT_AND_NEW')}
                className={`p-4 rounded-xl border transition cursor-pointer space-y-2 ${
                  renewalType === 'FULL_SETTLEMENT_AND_NEW'
                    ? 'border-emerald-600 bg-emerald-50/40 ring-2 ring-emerald-600/20'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-900">Option C: Settle & Create New Loan</span>
                  {renewalType === 'FULL_SETTLEMENT_AND_NEW' && (
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">
                      <Check size={12} />
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  Existing loan is closed with zero balance. A new linked pawn ticket is generated with fresh terms and existing collateral reassigned.
                </p>
              </div>

              {/* Option D */}
              <div
                onClick={() => setRenewalType('ADDITIONAL_DISBURSEMENT')}
                className={`p-4 rounded-xl border transition cursor-pointer space-y-2 ${
                  renewalType === 'ADDITIONAL_DISBURSEMENT'
                    ? 'border-emerald-600 bg-emerald-50/40 ring-2 ring-emerald-600/20'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-900">Option D: Renewal with Top-Up Disbursement</span>
                  {renewalType === 'ADDITIONAL_DISBURSEMENT' && (
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">
                      <Check size={12} />
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  Collateral valuation allows top-up. Additional disbursement is released to customer subject to LTV policy.
                </p>
              </div>
            </div>

            {/* Configuration Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs pt-4 border-t border-gray-100">
              <div className="space-y-1.5">
                <label className="text-gray-700 font-semibold">New Loan Tenure (Months) *</label>
                <select
                  value={tenureMonths}
                  onChange={(e) => setTenureMonths(Number(e.target.value))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 outline-none focus:border-emerald-600"
                >
                  <option value={3}>3 Months</option>
                  <option value={6}>6 Months</option>
                  <option value={9}>9 Months</option>
                  <option value={12}>12 Months (Standard)</option>
                  <option value={24}>24 Months</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-gray-700 font-semibold">New Maturity Date</label>
                <input
                  type="text"
                  disabled
                  value={getNewMaturityDate()}
                  className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2 text-gray-600 cursor-not-allowed font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-gray-700 font-semibold">New Annual Rate (APR %) *</label>
                <select
                  value={newApr}
                  onChange={(e) => setNewApr(Number(e.target.value))}
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 outline-none focus:border-emerald-600"
                >
                  <option value={18}>18% p.a. (1.5% / month)</option>
                  <option value={20}>20% p.a. (1.67% / month)</option>
                  <option value={22}>22% p.a. (1.83% / month)</option>
                  <option value={24}>24% p.a. (2.0% / month)</option>
                  <option value={30}>30% p.a. (2.5% / month)</option>
                </select>
              </div>

              {renewalType === 'ADDITIONAL_DISBURSEMENT' && (
                <div className="space-y-1.5 sm:col-span-3">
                  <label className="text-emerald-800 font-bold">Additional Cash Disbursed (₹) *</label>
                  <input
                    type="number"
                    placeholder="Enter additional loan amount to disburse"
                    value={additionalDisbursement}
                    onChange={(e) => setAdditionalDisbursement(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full bg-emerald-50 border border-emerald-300 rounded-lg px-3 py-2 text-emerald-900 font-bold outline-none focus:border-emerald-600"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold transition flex items-center gap-1.5"
            >
              <ArrowLeft size={14} />
              Back
            </button>
            <button
              type="button"
              onClick={() => setCurrentStep(4)}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-2 shadow-sm"
            >
              <span>Proceed to Collateral Verification</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: COLLATERAL VERIFICATION */}
      {currentStep === 4 && loan && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                Step 4: Pledged Gold Collateral & Custody Verification
              </h3>
              <span className="text-xs text-gray-500 font-mono">
                Vault Bin: {collateral[0]?.storage_bin_id || 'VAULT-TRAY-A1'}
              </span>
            </div>

            {/* Collateral Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200">
                  <tr>
                    <th className="p-3">#</th>
                    <th className="p-3">Ornament Description</th>
                    <th className="p-3">Purity</th>
                    <th className="p-3">Gross Wt</th>
                    <th className="p-3">Stone Wt</th>
                    <th className="p-3">Net Wt</th>
                    <th className="p-3">Valuation</th>
                    <th className="p-3">Custody</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {collateral.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="p-3 font-semibold">{idx + 1}</td>
                      <td className="p-3 font-medium text-gray-900">
                        {item.item_description || item.ornament_type || 'Gold Item'}
                      </td>
                      <td className="p-3 font-semibold text-amber-700">{item.purity_karat || '22K'}</td>
                      <td className="p-3">{(item.gross_weight || 0).toFixed(2)}g</td>
                      <td className="p-3">{(item.stone_weight || 0).toFixed(2)}g</td>
                      <td className="p-3 font-bold text-gray-900">{(item.net_weight || 0).toFixed(2)}g</td>
                      <td className="p-3 font-semibold text-emerald-700">
                        ₹{(item.valuation_inr || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {item.custody_location || 'PGF Safe Vault'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mandatory Verification Checkboxes */}
            <div className="space-y-3 pt-3 border-t border-gray-100 text-xs">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={physicalVerified}
                  onChange={(e) => setPhysicalVerified(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
                />
                <span className="text-gray-800 font-semibold">
                  Physical verification of gold ornaments in computerized vault tray completed.
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={appraiserConfirmed}
                  onChange={(e) => setAppraiserConfirmed(e.target.checked)}
                  className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500"
                />
                <span className="text-gray-800 font-semibold">
                  Appraiser confirmation: Collateral weight and purity remain intact and verified.
                </span>
              </label>
            </div>
          </div>

          <div className="flex justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep(3)}
              className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold transition flex items-center gap-1.5"
            >
              <ArrowLeft size={14} />
              Back
            </button>
            <button
              type="button"
              disabled={!physicalVerified || !appraiserConfirmed}
              onClick={() => setCurrentStep(5)}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold transition flex items-center gap-2 shadow-sm"
            >
              <span>Review & Confirm Renewal</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: REVIEW & CONFIRM */}
      {currentStep === 5 && loan && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-5">
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-3">
              Step 5: Review Side-By-Side Comparison
            </h3>

            {/* Side-by-side comparison */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              {/* Old Terms */}
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                <span className="font-bold text-gray-700 uppercase tracking-wider block border-b border-gray-200 pb-2">
                  Existing Loan Terms
                </span>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Loan Number:</span>
                    <span className="font-semibold text-gray-900">{loan.loan_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Current Principal:</span>
                    <span className="font-semibold text-gray-900">₹{remainingPrincipal.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Accrued Interest Cleared:</span>
                    <span className="font-semibold text-emerald-700">₹{interestCleared.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Current APR:</span>
                    <span className="text-gray-900">{loan.interest_rate_apr || 18}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Existing Maturity Date:</span>
                    <span className="text-gray-900 font-mono">
                      {loan.maturity_date ? new Date(loan.maturity_date).toLocaleDateString('en-IN') : '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* New Terms Post-Renewal */}
              <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200 space-y-3">
                <span className="font-bold text-emerald-800 uppercase tracking-wider block border-b border-emerald-200 pb-2">
                  New Terms Post-Renewal
                </span>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Renewal Policy:</span>
                    <span className="font-bold text-emerald-800">{renewalType}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">New Principal Balance:</span>
                    <span className="font-bold text-gray-900">₹{newPrincipalBalance.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Total Paid at Counter:</span>
                    <span className="font-bold text-emerald-700">₹{numReceived.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">New APR:</span>
                    <span className="font-bold text-gray-900">{newApr}% p.a.</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Extended Maturity Date:</span>
                    <span className="font-bold text-emerald-800 font-mono">{getNewMaturityDate()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Warning / Audit Notice */}
            <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs flex items-start gap-2.5">
              <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="font-bold block">Important Financial Acknowledgment</span>
                <p>
                  Please verify all settlement amounts and renewal terms before confirming. Once executed, an atomic transaction updates the loan balance, records payment ledgers, and logs an immutable audit trail.
                </p>
              </div>
            </div>

            {submitError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0 text-rose-600" />
                <span>{submitError}</span>
              </div>
            )}
          </div>

          <div className="flex justify-between">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setCurrentStep(4)}
              className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold transition flex items-center gap-1.5"
            >
              <ArrowLeft size={14} />
              Back
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleExecuteRenewal}
              className="px-7 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Posting Atomic Renewal...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} />
                  <span>Confirm & Execute Renewal</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 6: FINALIZE & PRINT */}
      {currentStep === 6 && renewalResult && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm text-center space-y-5">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 size={36} />
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-bold text-gray-900 font-outfit">
                Loan Successfully Renewed!
              </h2>
              <p className="text-xs text-gray-500">
                Receipt Number: <span className="font-mono font-bold text-gray-800">{renewalResult.receiptNumber || renewalResult.renewal?.receipt_number || 'PGF-REC-SUCCESS'}</span> &middot; Renewal ID: <span className="font-mono font-bold text-gray-800">{renewalResult.renewal?.renewal_number || renewalResult.renewal?.id || 'PGF-REN-SUCCESS'}</span>
              </p>
            </div>

            {/* Financial Summary */}
            <div className="max-w-md mx-auto p-4 bg-gray-50 rounded-xl border border-gray-200 text-xs space-y-2 text-left">
              <div className="flex justify-between">
                <span className="text-gray-500">Loan Number:</span>
                <span className="font-bold text-gray-900">{loan.loan_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Interest Cleared:</span>
                <span className="font-bold text-emerald-700">₹{interestCleared.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Principal Repaid:</span>
                <span className="font-bold text-blue-700">₹{principalReduction.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-2 font-bold">
                <span className="text-gray-900">New Principal Balance:</span>
                <span className="text-gray-900">₹{newPrincipalBalance.toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* Print & Download Action Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
              {/* A4 Format Receipt */}
              <button
                type="button"
                onClick={() => {
                  setPreviewUrl(
                    getPdfApiUrl({
                      type: 'renewal_receipt',
                      loanId: loan.id,
                      paymentId: renewalResult.renewal?.id,
                    })
                  );
                  setPreviewTitle(`Loan Renewal Receipt - ${loan.loan_number}`);
                  setIsPreviewOpen(true);
                }}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Printer size={14} />
                <span>Print A4 Renewal Receipt</span>
              </button>

              {/* 80mm Thermal POS Receipt */}
              <button
                type="button"
                onClick={() => {
                  setPreviewUrl(
                    getPdfApiUrl({
                      type: 'renewal_receipt',
                      loanId: loan.id,
                      paymentId: renewalResult.renewal?.id,
                      format: 'thermal',
                    })
                  );
                  setPreviewTitle(`80mm Thermal Receipt - ${loan.loan_number}`);
                  setIsPreviewOpen(true);
                }}
                className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Printer size={14} />
                <span>Print 80mm Thermal POS</span>
              </button>

              {/* Download PDF */}
              <button
                type="button"
                onClick={() => {
                  downloadPdfDocument(
                    {
                      type: 'renewal_receipt',
                      loanId: loan.id,
                      paymentId: renewalResult.renewal?.id,
                    },
                    `PGF_Renewal_${loan.loan_number}.pdf`
                  );
                }}
                className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition flex items-center gap-1.5 border border-gray-200"
              >
                <Download size={14} />
                <span>Download PDF</span>
              </button>
            </div>

            <div className="pt-4 border-t border-gray-100 flex justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setLoan(null);
                  setCustomer(null);
                  setCollateral([]);
                  setRenewalResult(null);
                  setCurrentStep(1);
                  setSearchQuery('');
                }}
                className="px-5 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 transition"
              >
                Start Another Renewal
              </button>
              <Link
                href={`/admin/loans/${loan.id}`}
                className="px-5 py-2 text-xs font-bold text-emerald-700 hover:underline"
              >
                View Updated Loan Dossier &rarr;
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* PDF Preview Modal */}
      <PDFPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        pdfUrl={previewUrl}
        title={previewTitle}
      />
    </div>
  );
}

export default function RenewalPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-gray-500">Loading renewal wizard...</div>}>
      <RenewalWizardContent />
    </Suspense>
  );
}
