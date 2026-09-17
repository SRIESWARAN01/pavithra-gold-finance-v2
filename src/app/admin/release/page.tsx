'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  ShieldCheck, 
  CheckCircle2, 
  Coins, 
  Calendar, 
  Clock, 
  AlertTriangle, 
  Printer, 
  Download, 
  FileText, 
  User, 
  Scale, 
  Sparkles, 
  ArrowRight,
  ChevronRight,
  DollarSign,
  Receipt
} from 'lucide-react';
import { db, auth } from '@/lib/firebase';
import { collection, getDocs, getDoc, query, where, doc, addDoc } from 'firebase/firestore';
import { isFirebaseConfigured, getCurrentProfile } from '@/lib/auth';
import { recordLoanRelease, generateReleaseNumber } from '@/lib/db/payments';
import { calculateReleaseDues } from '@/lib/db/loans';
import { getGoldByLoan } from '@/lib/db/gold';
import PDFPreviewModal from '@/components/PDFPreviewModal';
import { getPdfApiUrl, downloadPdfDocument, printPdfDocument } from '@/lib/pdfHelper';
import type { GoldCollateral, PaymentMode } from '@/types/database';

function GoldReleaseContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryLoanId = searchParams.get('loanId') || '';

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Active Loans Directory
  const [loans, setLoans] = useState<any[]>([]);
  const [selectedLoanId, setSelectedLoanId] = useState<string>('');

  // Selected Loan Full Relations
  const [activeLoan, setActiveLoan] = useState<any | null>(null);
  const [goldItems, setGoldItems] = useState<GoldCollateral[]>([]);

  // Release Form State
  const [releaseDate, setReleaseDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('Cash');
  const [transactionRef, setTransactionRef] = useState<string>('');
  const [penaltyFee, setPenaltyFee] = useState<number | ''>('');
  const [discountWaiver, setDiscountWaiver] = useState<number | ''>('');
  const [remarks, setRemarks] = useState<string>('Full settlement and gold collateral discharge upon closure');
  const [borrowerAcknowledged, setBorrowerAcknowledged] = useState(true);

  // Release Result
  const [releaseResult, setReleaseResult] = useState<any | null>(null);

  // PDF Preview
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');

  // Formatter for Indian Rupee
  const formatINR = (val: number) => {
    return '₹ ' + (val || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  };

  // 1. Fetch Active/Due Loans
  useEffect(() => {
    async function loadLoans() {
      setLoading(true);
      try {
        if (!isFirebaseConfigured()) {
          setLoading(false);
          return;
        }

        const q = query(
          collection(db, 'loans'),
          where('status', 'in', ['Active', 'Due', 'Overdue', 'Grace_Period'])
        );
        const snap = await getDocs(q);

        const list: any[] = [];
        for (const d of snap.docs) {
          const l: any = { id: d.id, ...d.data() };
          if (l.customer_id) {
            try {
              const cSnap = await getDoc(doc(db, 'profiles', l.customer_id));
              if (cSnap.exists()) l.customer = cSnap.data();
            } catch {}
          }
          list.push(l);
        }

        list.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
        setLoans(list);

        if (list.length > 0) {
          const match = list.find((l) => l.id === queryLoanId || l.loan_number === queryLoanId);
          setSelectedLoanId(match ? match.id : list[0].id);
        }
      } catch (err) {
        console.error('Failed to load loans for release desk:', err);
      } finally {
        setLoading(false);
      }
    }
    loadLoans();
  }, [queryLoanId]);

  // 2. Fetch Details for Selected Loan
  useEffect(() => {
    if (!selectedLoanId) {
      setActiveLoan(null);
      setGoldItems([]);
      return;
    }

    async function loadLoanDetails() {
      try {
        const snap = await getDoc(doc(db, 'loans', selectedLoanId));
        if (snap.exists()) {
          const lData: any = { id: snap.id, ...snap.data() };
          if (lData.customer_id) {
            const cSnap = await getDoc(doc(db, 'profiles', lData.customer_id));
            if (cSnap.exists()) lData.customer = { id: cSnap.id, ...cSnap.data() };
          }
          setActiveLoan(lData);

          const items = await getGoldByLoan(selectedLoanId);
          setGoldItems(items);
        }
      } catch (err) {
        console.error('Failed to load active loan details:', err);
      }
    }
    loadLoanDetails();
  }, [selectedLoanId]);

  // 3. Live Release Dues Calculation up to the selected release date
  const releaseDues = useMemo(() => {
    if (!activeLoan) return null;

    const principal = activeLoan.principal_amount || 0;
    const principalPaid = activeLoan.total_principal_paid || 0;
    const remainingPrincipal = Math.max(0, principal - principalPaid);
    const apr = activeLoan.interest_rate_apr || 18;

    const origDateStr = (activeLoan.origination_date || activeLoan.created_at || releaseDate).split('T')[0];
    const origTime = new Date(origDateStr).getTime();
    const relTime = new Date(releaseDate).getTime();
    const daysElapsed = Math.max(1, Math.ceil(Math.max(0, relTime - origTime) / (1000 * 60 * 60 * 24)));

    // Total interest accrued up to release date
    const totalInterestAccrued = Math.round(((remainingPrincipal * (apr / 100) * daysElapsed) / 365) * 100) / 100;
    const totalInterestPaid = activeLoan.total_interest_paid || 0;

    // Unpaid interest
    const trackedOutstanding = activeLoan.outstanding_interest || 0;
    const unpaidInterest = Math.max(0, Math.max(trackedOutstanding, totalInterestAccrued - totalInterestPaid));

    const penaltyNum = typeof penaltyFee === 'number' ? penaltyFee : 0;
    const waiverNum = typeof discountWaiver === 'number' ? discountWaiver : 0;

    const finalReleaseAmount = Math.max(0, Math.round((remainingPrincipal + unpaidInterest + penaltyNum - waiverNum) * 100) / 100);

    return {
      principal,
      principalPaid,
      remainingPrincipal,
      apr,
      origDateStr,
      daysElapsed,
      totalInterestAccrued,
      totalInterestPaid,
      unpaidInterest,
      penaltyNum,
      waiverNum,
      finalReleaseAmount,
    };
  }, [activeLoan, releaseDate, penaltyFee, discountWaiver]);

  // Handle Loan Change
  const handleLoanSelect = (loanId: string) => {
    setSelectedLoanId(loanId);
    setError(null);
  };

  // Submit Loan Release & Closure
  const handleExecuteRelease = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLoan || !releaseDues) return;

    if (!borrowerAcknowledged) {
      setError('Borrower handover acknowledgment must be confirmed before release.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const activeAdmin = await getCurrentProfile();

      const result = await recordLoanRelease({
        loan_id: activeLoan.id,
        customer_id: activeLoan.customer?.id || activeLoan.customer_id,
        release_date: releaseDate,
        final_amount_paid: releaseDues.finalReleaseAmount,
        interest_portion: releaseDues.unpaidInterest,
        principal_portion: releaseDues.remainingPrincipal,
        penalty_amount: releaseDues.penaltyNum,
        waiver_amount: releaseDues.waiverNum,
        mode: paymentMode,
        transaction_ref: ['Cash'].includes(paymentMode) ? undefined : transactionRef,
        remarks: remarks,
        actor: {
          id: activeAdmin?.id || 'admin',
          name: activeAdmin?.name || 'Authorized Officer',
          role: activeAdmin?.role || 'Admin',
        },
      });

      setReleaseResult({
        ...result,
        customerName: activeLoan.customer?.name || 'Customer',
        loanNumber: activeLoan.loan_number,
        goldCount: goldItems.length,
        finalAmountPaid: releaseDues.finalReleaseAmount,
        releaseDate: releaseDate,
      });

      setSuccess(true);
    } catch (err: any) {
      console.error('Release execution error:', err);
      setError(err.message || 'Failed to process gold release and loan closure.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[10px] text-blue-600 font-bold tracking-wider uppercase">
        <span>PGF Office</span>
        <ChevronRight size={10} className="text-gray-400" />
        <span>Vault & Collateral</span>
        <ChevronRight size={10} className="text-gray-400" />
        <span className="text-gray-500">Gold Release & Closure Desk</span>
      </div>

      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold font-outfit text-gray-900">Gold Release & Loan Closure</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Calculate live dues up to the release date, collect final closure payment, discharge loan lien, and hand over gold jewellery.
            </p>
          </div>
        </div>

        {activeLoan && (
          <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold font-mono">
            Active Loan: {activeLoan.loan_number}
          </span>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs flex items-center gap-2">
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-2xl p-16 text-center border border-gray-200 text-gray-500 text-xs space-y-3">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <span>Loading active loan records for release desk...</span>
        </div>
      ) : loans.length === 0 ? (
        <div className="bg-white rounded-2xl p-16 text-center border border-gray-200 text-gray-500 space-y-3">
          <Coins size={36} className="mx-auto text-gray-300" />
          <h3 className="text-base font-bold text-gray-800 font-outfit">No Active Loans Found</h3>
          <p className="text-xs text-gray-500">All loan accounts are currently closed or settled.</p>
        </div>
      ) : !success ? (
        <form onSubmit={handleExecuteRelease} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* LEFT: Customer & Collateral Dossier */}
          <div className="space-y-6 lg:col-span-1">
            {/* Account Selector */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3 shadow-sm">
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block font-outfit">
                Select Active Loan for Release *
              </label>
              <select
                value={selectedLoanId}
                onChange={(e) => handleLoanSelect(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 focus:border-blue-600 text-gray-900 text-xs font-semibold rounded-xl px-3.5 py-2.5 outline-none"
              >
                {loans.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.customer?.name || 'Customer'} — {l.loan_number} ({formatINR(l.principal_amount - (l.total_principal_paid || 0))})
                  </option>
                ))}
              </select>
            </div>

            {/* Customer Particulars */}
            {activeLoan && (
              <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                  <h3 className="text-xs font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1.5 font-outfit">
                    <User size={14} /> Pledgor Particulars
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200">
                    KYC Verified
                  </span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Customer Name:</span>
                    <strong className="text-gray-900">{activeLoan.customer?.name || 'Customer'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Customer ID:</span>
                    <strong className="text-blue-700 font-mono">{activeLoan.customer?.customer_number || activeLoan.customer?.id || '—'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Registered Phone:</span>
                    <span className="text-gray-800">{activeLoan.customer?.phone_primary ? `+91 ${activeLoan.customer.phone_primary}` : '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Aadhaar Card:</span>
                    <span className="text-gray-800 font-mono">{activeLoan.customer?.national_id || 'On File'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">PAN Card:</span>
                    <span className="text-gray-800 font-mono">{activeLoan.customer?.pan_number || 'On File'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Gold Collateral in Safe */}
            <div className="bg-white border border-amber-200/80 rounded-2xl p-5 space-y-3 shadow-sm">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                <h3 className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5 font-outfit">
                  <Scale size={14} className="text-amber-600" />
                  Collateral Held in Vault ({goldItems.length})
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-50 text-amber-800 rounded-full border border-amber-200">
                  Ready for Handover
                </span>
              </div>

              {goldItems.length === 0 ? (
                <div className="text-xs text-gray-500 italic py-2">No gold items linked.</div>
              ) : (
                <div className="space-y-3">
                  {goldItems.map((g, idx) => (
                    <div key={g.id || idx} className="p-2.5 bg-amber-50/40 rounded-xl border border-amber-200/60 text-xs space-y-1">
                      <div className="flex justify-between font-bold text-gray-900">
                        <span>{idx + 1}. {g.item_description || g.ornament_type}</span>
                        <span className="text-amber-800">{g.purity_karat || '22K'}</span>
                      </div>
                      <div className="flex justify-between text-[11px] text-gray-600">
                        <span>Gross: {g.gross_weight}g &bull; Net: {g.net_weight}g</span>
                        <strong className="text-emerald-700">{formatINR(g.valuation_inr)}</strong>
                      </div>
                      {g.front_photo_url && (
                        <div className="pt-1 flex gap-2">
                          <img 
                            src={g.front_photo_url} 
                            alt="Collateral" 
                            className="w-16 h-12 object-cover rounded-lg border border-amber-200" 
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Live Release Calculation & Settlement Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Live Settlement Calculator Banner */}
            {releaseDues && (
              <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-5 shadow-sm">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <h3 className="text-xs font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1.5 font-outfit">
                    <Receipt size={14} />
                    Live Settlement Calculation up to Release Date
                  </h3>
                  <span className="text-xs font-bold text-gray-500">
                    Tenure Elapsed: <strong>{releaseDues.daysElapsed} days</strong>
                  </span>
                </div>

                {/* Dues Breakdown Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl">
                    <span className="text-[10px] text-gray-500 uppercase font-bold block">Sanctioned Principal</span>
                    <strong className="text-sm text-blue-900 block mt-1">{formatINR(releaseDues.principal)}</strong>
                    <span className="text-[10px] text-gray-400 block mt-0.5">Paid: {formatINR(releaseDues.principalPaid)}</span>
                  </div>

                  <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl">
                    <span className="text-[10px] text-gray-500 uppercase font-bold block">Remaining Principal</span>
                    <strong className="text-sm text-indigo-900 block mt-1">{formatINR(releaseDues.remainingPrincipal)}</strong>
                    <span className="text-[10px] text-emerald-600 block mt-0.5 font-bold">To Clear</span>
                  </div>

                  <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl">
                    <span className="text-[10px] text-gray-500 uppercase font-bold block">Live Accrued Interest</span>
                    <strong className="text-sm text-amber-900 block mt-1">{formatINR(releaseDues.unpaidInterest)}</strong>
                    <span className="text-[10px] text-gray-500 block mt-0.5">Rate: {releaseDues.apr}% APR</span>
                  </div>

                  <div className="p-3 bg-emerald-50/70 border border-emerald-300 rounded-xl">
                    <span className="text-[10px] text-emerald-800 uppercase font-bold block">Final Release Amount</span>
                    <strong className="text-base text-emerald-900 block mt-1 font-outfit">{formatINR(releaseDues.finalReleaseAmount)}</strong>
                    <span className="text-[10px] text-emerald-700 block mt-0.5 font-bold">ZERO Balance Target</span>
                  </div>
                </div>

                {/* Release Date Selector */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-gray-100">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700 block">Actual Release Date *</label>
                    <input
                      type="date"
                      required
                      value={releaseDate}
                      onChange={(e) => setReleaseDate(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-300 focus:border-blue-600 text-gray-900 text-xs font-bold rounded-xl px-3 py-2 outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700 block">Late Fee / Penalty (₹)</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={penaltyFee}
                      onChange={(e) => setPenaltyFee(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      className="w-full bg-gray-50 border border-gray-300 focus:border-blue-600 text-gray-900 text-xs rounded-xl px-3 py-2 outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-700 block">Discount / Waiver (₹)</label>
                    <input
                      type="number"
                      placeholder="0"
                      value={discountWaiver}
                      onChange={(e) => setDiscountWaiver(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      className="w-full bg-gray-50 border border-gray-300 focus:border-blue-600 text-gray-900 text-xs rounded-xl px-3 py-2 outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Payment & Settlement Confirmation */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-5 shadow-sm">
              <h3 className="text-xs font-bold text-emerald-700 uppercase tracking-wider border-b border-gray-100 pb-2.5 flex items-center gap-2 font-outfit">
                <CheckCircle2 size={15} />
                Settlement Payment & Collateral Handover Verification
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 block">Payment Mode *</label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
                    className="w-full bg-gray-50 border border-gray-300 focus:border-blue-600 text-gray-900 text-xs rounded-xl px-3.5 py-2.5 outline-none font-semibold"
                  >
                    <option value="Cash">Cash (Physical Counter)</option>
                    <option value="UPI">UPI / QR Payment</option>
                    <option value="Bank_Transfer">IMPS / NEFT / RTGS</option>
                    <option value="Debit_Card">Debit Card</option>
                    <option value="Credit_Card">Credit Card</option>
                    <option value="Cheque">Bank Cheque</option>
                    <option value="Demand_Draft">Demand Draft</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 block">
                    Transaction ID / Reference {['Cash'].includes(paymentMode) ? '(Optional)' : '*'}
                  </label>
                  <input
                    type="text"
                    placeholder="UTR / Bank Ref / Cheque No"
                    value={transactionRef}
                    onChange={(e) => setTransactionRef(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-300 focus:border-blue-600 text-gray-900 text-xs rounded-xl px-3.5 py-2.5 outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 block">Settlement Remarks</label>
                <input
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 focus:border-blue-600 text-gray-900 text-xs rounded-xl px-3.5 py-2.5 outline-none"
                />
              </div>

              {/* Handover Undertaking Checkbox */}
              <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-emerald-950">
                <input
                  type="checkbox"
                  id="acknowledge"
                  checked={borrowerAcknowledged}
                  onChange={(e) => setBorrowerAcknowledged(e.target.checked)}
                  className="mt-0.5 w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500 cursor-pointer"
                />
                <label htmlFor="acknowledge" className="cursor-pointer font-medium leading-relaxed">
                  I confirm that all {goldItems.length} pledged gold ornament(s) have been verified against the physical vault tray and are ready for safe handover to the borrower upon receipt of the final settlement amount.
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting || !releaseDues}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer font-outfit"
              >
                {submitting ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <ShieldCheck size={16} />
                )}
                Execute Full Loan Release & Generate Discharge Certificate ({formatINR(releaseDues?.finalReleaseAmount || 0)})
              </button>
            </div>
          </div>
        </form>
      ) : (
        /* SUCCESS VIEW: Gold Released & Discharge Voucher */
        <div className="bg-white border border-emerald-200 rounded-2xl p-8 max-w-2xl mx-auto text-center space-y-6 shadow-xl">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <CheckCircle2 size={36} />
          </div>

          <div>
            <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold uppercase tracking-wider">
              Loan Account Fully Closed & Settled
            </span>
            <h2 className="text-2xl font-bold text-gray-900 font-outfit mt-3">
              Gold Released Successfully!
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Official Discharge Voucher has been generated. All gold items have been released to the borrower with zero outstanding balance.
            </p>
          </div>

          {/* Voucher Summary Card */}
          <div className="p-5 bg-gray-50 rounded-2xl border border-gray-200 text-left text-xs space-y-2.5 font-mono">
            <div className="flex justify-between border-b border-gray-200 pb-2">
              <span className="text-gray-500 font-sans">Release Voucher No:</span>
              <strong className="text-blue-700 text-sm">{releaseResult?.release_number}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 font-sans">Loan Account:</span>
              <strong className="text-gray-900">{releaseResult?.loanNumber}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 font-sans">Borrower Name:</span>
              <strong className="text-gray-900 font-sans">{releaseResult?.customerName}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 font-sans">Final Settlement Paid:</span>
              <strong className="text-emerald-700 font-sans text-sm">{formatINR(releaseResult?.finalAmountPaid)}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 font-sans">Remaining Balance:</span>
              <strong className="text-emerald-800 font-sans">₹ 0.00 (ZERO BALANCE)</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 font-sans">Collateral Released:</span>
              <span className="font-sans text-gray-800">{releaseResult?.goldCount} ornaments handed over</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 justify-center pt-2">
            <button
              type="button"
              onClick={() => {
                const url = getPdfApiUrl({
                  type: 'release',
                  loanId: activeLoan?.id,
                  paymentId: releaseResult?.payment?.id,
                });
                setPreviewUrl(url);
                setPreviewTitle(`Official Gold Release Certificate - ${releaseResult?.release_number}`);
                setIsPreviewOpen(true);
              }}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-wider transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-blue-600/20 font-outfit"
            >
              <FileText size={14} /> Preview Release Certificate
            </button>

            <button
              type="button"
              onClick={() => {
                downloadPdfDocument(
                  {
                    type: 'release',
                    loanId: activeLoan?.id,
                    paymentId: releaseResult?.payment?.id,
                  },
                  `Release_Certificate_${releaseResult?.release_number}.pdf`
                );
              }}
              className="px-5 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-300 text-xs font-bold uppercase tracking-wider transition flex items-center gap-1.5 cursor-pointer font-outfit"
            >
              <Download size={14} /> Download PDF
            </button>

            <button
              type="button"
              onClick={() => {
                printPdfDocument({
                  type: 'release',
                  loanId: activeLoan?.id,
                  paymentId: releaseResult?.payment?.id,
                });
              }}
              className="px-5 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold uppercase tracking-wider transition flex items-center gap-1.5 cursor-pointer font-outfit"
            >
              <Printer size={14} /> Print Certificate
            </button>

            <button
              type="button"
              onClick={() => router.push('/admin/statement')}
              className="px-5 py-2.5 rounded-xl bg-gray-900 hover:bg-black text-white text-xs font-bold uppercase tracking-wider transition cursor-pointer font-outfit"
            >
              View Customer Statement &rarr;
            </button>
          </div>
        </div>
      )}

      {/* PDF Document Preview Modal */}
      <PDFPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        pdfUrl={previewUrl}
        title={previewTitle}
      />
    </div>
  );
}

export default function GoldReleasePage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs font-bold text-gray-500">Loading Gold Release Desk...</div>}>
      <GoldReleaseContent />
    </Suspense>
  );
}
