'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { 
  ChevronRight, 
  Coins, 
  Scale, 
  Clock, 
  Download, 
  XCircle, 
  Printer, 
  FileText, 
  CheckCircle2, 
  ShieldAlert, 
  Percent, 
  ChevronDown, 
  AlertTriangle,
  User,
  ShieldCheck,
  Building2,
  Receipt,
  Eye,
  Calendar,
  Sparkles
} from 'lucide-react';
import PDFPreviewModal from '@/components/PDFPreviewModal';
import { getPdfApiUrl, downloadPdfDocument, printPdfDocument } from '@/lib/pdfHelper';
import { isFirebaseConfigured, getCurrentProfile } from '@/lib/auth';
import { getLoan, updateLoanStatus, updateLoanApr, VALID_LOAN_APR_RATES } from '@/lib/db/loans';
import { getGoldByLoan } from '@/lib/db/gold';
import { getPaymentsByLoan } from '@/lib/db/payments';
import { calculateLoanInterestSnapshot } from '@/lib/db/interest';
import { getActiveBankRePledgeByLoan } from '@/lib/db/repledge';
import RePledgeCard from '@/components/RePledgeCard';
import type { Loan, GoldCollateral, Payment, BankRePledge } from '@/types/database';

export default function LoanDetail() {
  const router = useRouter();
  const params = useParams();
  const id = (params?.id as string) || '';

  const [loan, setLoan] = useState<any | null>(null);
  const [collateral, setCollateral] = useState<GoldCollateral[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [repledge, setRepledge] = useState<BankRePledge | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any | null>(null);

  // APR Modification Modal State
  const [isAprModalOpen, setIsAprModalOpen] = useState(false);
  const [selectedNewApr, setSelectedNewApr] = useState<number | ''>('');
  const [aprChangeReason, setAprChangeReason] = useState('');
  const [aprSubmitting, setAprSubmitting] = useState(false);
  const [aprModalError, setAprModalError] = useState<string | null>(null);

  // PDF Preview States
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');

  // Selected payment for transaction details modal
  const [selectedPaymentDetail, setSelectedPaymentDetail] = useState<any | null>(null);

  const statusColors: Record<string, string> = {
    Active: 'bg-emerald-500/10 text-emerald-600',
    Due: 'bg-amber-500/10 text-amber-500',
    Overdue: 'bg-red-50 text-red-500',
    Closed: 'bg-slate-500/10 text-gray-500',
    Settled: 'bg-slate-500/10 text-gray-500',
  };

  const loadLoanDetails = async () => {
    setLoading(true);
    try {
      const ln = await getLoan(id, { withCustomer: true });
      if (ln) {
        setLoan(ln);
        const col = await getGoldByLoan(id);
        setCollateral(col);
        const pay = await getPaymentsByLoan(id);
        setPayments(pay);
        const rep = await getActiveBankRePledgeByLoan(id);
        setRepledge(rep);

        const prof = await getCurrentProfile();
        if (prof) setCurrentUser(prof);
      } else {
        setLoan(null);
        setCollateral([]);
        setPayments([]);
        setRepledge(null);
      }
    } catch (err) {
      console.error('Failed to load loan detail page data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateApr = async () => {
    if (selectedNewApr === '' || !VALID_LOAN_APR_RATES.includes(selectedNewApr as any)) {
      setAprModalError('Please select an Annual Interest Rate (APR %) from the available options (18%, 20%, 22%, 24%, 30%).');
      return;
    }
    if (selectedNewApr === loan.interest_rate_apr) {
      setAprModalError('Selected APR is identical to the current rate. Please select a different rate.');
      return;
    }
    if (!aprChangeReason.trim()) {
      setAprModalError('An administrative justification / reason is mandatory.');
      return;
    }

    setAprSubmitting(true);
    setAprModalError(null);
    try {
      await updateLoanApr(
        loan.id,
        Number(selectedNewApr),
        {
          id: currentUser?.id || 'admin',
          name: currentUser?.name || 'Authorized Officer',
          role: currentUser?.role || 'Admin',
        },
        aprChangeReason
      );

      alert(`Loan APR successfully modified to ${selectedNewApr}%. Audit log recorded.`);
      setIsAprModalOpen(false);
      setSelectedNewApr('');
      setAprChangeReason('');
      await loadLoanDetails();
    } catch (err: any) {
      setAprModalError(err.message || 'Failed to update loan APR.');
    } finally {
      setAprSubmitting(false);
    }
  };

  useEffect(() => {
    if (id) {
      const t = setTimeout(() => {
        loadLoanDetails();
      }, 0);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Check if collateral is currently re-pledged to bank
  const isRepledgedWithBank = Boolean(
    loan?.bank_repledge_id ||
    collateral.some(c => c.custody_location && c.custody_location !== 'PGF Safe')
  );

  const handleCloseLoan = async () => {
    if (isRepledgedWithBank) {
      alert('Action Blocked: This loan is currently RE-PLEDGED with a bank. PGF security controls prevent gold release until the bank settlement is executed and physical collateral returns to PGF Safe.');
      return;
    }
    if (!confirm('Are you sure you want to close this loan folder? This will mark the loan status as Settled and initiate gold release.')) return;
    try {
      if (isFirebaseConfigured() && loan?.id) {
        await updateLoanStatus(loan.id, 'Settled');
      }
      alert('Loan folder successfully closed and gold collateral marked for release.');
      loadLoanDetails();
    } catch (err: any) {
      alert(err.message || 'Failed to close loan folder.');
    }
  };

  // Dynamic Interest Snapshot
  const interestSnapshot = useMemo(() => {
    if (!loan) return null;
    return calculateLoanInterestSnapshot({
      id: loan.id,
      principal_amount: loan.principal_amount || 0,
      total_principal_paid: loan.total_principal_paid || 0,
      interest_rate_apr: loan.interest_rate_apr || 18,
      origination_date: loan.origination_date || new Date().toISOString(),
      maturity_date: loan.maturity_date || new Date().toISOString(),
      total_interest_paid: loan.total_interest_paid || 0,
      outstanding_interest: loan.outstanding_interest,
    } as any);
  }, [loan]);

  // Formatter for Indian Currency
  const formatINR = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(val);
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-gray-500 text-xs flex flex-col items-center gap-3 justify-center min-h-[50vh]">
        <div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin"></div>
        <span>Loading loan file details...</span>
      </div>
    );
  }

  if (!loan) {
    return (
      <div className="p-12 text-center text-gray-500 text-xs">
        Loan file record not found.
      </div>
    );
  }

  // Outstanding amounts
  const remainingPrincipal = interestSnapshot ? interestSnapshot.currentPrincipal : (loan.principal_amount - (loan.total_principal_paid || 0));
  const dynamicOutstandingInterest = interestSnapshot ? interestSnapshot.outstandingInterest : (loan.outstanding_interest || 0);
  const totalOutstanding = remainingPrincipal + dynamicOutstandingInterest;

  // Collateral aggregates
  const totalGrossWeight = collateral.reduce((sum, c) => sum + (c.gross_weight || 0), 0);
  const totalStoneWeight = collateral.reduce((sum, c) => sum + (c.stone_weight || 0), 0);
  const totalNetWeight = collateral.reduce((sum, c) => sum + (c.net_weight || 0), 0);
  const totalValuation = collateral.reduce((sum, c) => sum + (c.valuation_inr || 0), 0);
  const averageLtv = totalValuation > 0 ? ((loan.principal_amount / totalValuation) * 100).toFixed(2) : '0.00';

  // Sort payments chronologically (oldest to newest for statement trail, or newest to oldest for display)
  const sortedPayments = [...payments].sort((a, b) => 
    new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime()
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs text-[#2563EB] font-semibold tracking-wider uppercase">
        <span>Admin Panel</span>
        <ChevronRight size={12} className="text-gray-400" />
        <button onClick={() => router.push('/admin/loans')} className="text-gray-500 hover:text-gray-900 transition cursor-pointer">
          Loans
        </button>
        <ChevronRight size={12} className="text-gray-400" />
        <span>{loan.loan_number}</span>
      </div>

      {/* Header Card with Customer Photograph, KYC & Re-Pledge Badge */}
      <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-6 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-[#F3F4F6] border border-[#2563EB]/35 flex items-center justify-center text-[#2563EB] overflow-hidden shrink-0 shadow-inner">
            {loan.customer?.photo_url ? (
              <img src={loan.customer.photo_url} alt={loan.customer.name} className="w-full h-full object-cover" />
            ) : (
              <Coins size={28} />
            )}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold text-gray-900 tracking-wide font-outfit">{loan.customer?.name || 'Customer'}</h2>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase flex items-center gap-1 ${
                loan.customer?.kyc_status === 'Verified'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}>
                <ShieldCheck size={12} />
                KYC: {loan.customer?.kyc_status || 'Verified'}
              </span>
            </div>
            <p className="text-gray-500 text-xs font-mono">
              Loan Account: <strong className="text-blue-700">{loan.loan_number}</strong> &middot; Customer ID: {loan.customer?.customer_number || loan.customer_id.substring(0, 8)} &middot; Phone: {loan.customer?.phone_primary || 'N/A'}
            </p>
            {loan.customer?.national_id && (
              <p className="text-gray-400 text-[11px] font-mono">
                Aadhaar: {(loan.customer.national_id || '').replace(/.(?=.{4})/g, '*')}
                {loan.customer?.pan_number && ` &bull; PAN: ${(loan.customer.pan_number || '').replace(/.(?=.{4})/g, '*')}`}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {isRepledgedWithBank && (
            <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-1.5 shadow-xs">
              <Building2 size={13} />
              Re-Pledged with Bank
            </span>
          )}
          <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${statusColors[loan.status] || 'bg-slate-500/10 text-gray-500'}`}>
            {loan.status}
          </span>
        </div>
      </div>

      {/* Re-Pledge Detailed Banner if applicable */}
      {isRepledgedWithBank && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-start gap-3 shadow-xs">
          <Building2 size={20} className="text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-sm text-amber-950 block">Bank Re-Pledge Custody Notice</span>
            <p className="leading-relaxed">
              This loan&apos;s pledged gold collateral is currently re-pledged with <strong>{collateral[0]?.custody_location || 'Bank Facility'}</strong> (Re-Pledge Ref: {loan.bank_repledge_id || 'Active'}).
              Customer repayments update the loan balance normally. However, physical gold release is <strong>strictly locked</strong> until bank settlement and return of gold to PGF Safe is completed.
            </p>
          </div>
        </div>
      )}

      {/* Two-Column: Loan Summary + Collateral */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Loan Summary with Dynamic Days & Months */}
        <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-2">
            <h3 className="text-xs font-bold text-[#2563EB] uppercase tracking-wider">
              Loan Financial Metrics
            </h3>
            {interestSnapshot && (
              <span className="text-[10px] font-mono text-gray-500">
                Calculated up to Today
              </span>
            )}
          </div>

          {/* Dynamic Elapsed Days & Months Badge */}
          {interestSnapshot && (
            <div className="grid grid-cols-2 gap-3 p-3 bg-blue-50/70 border border-blue-100 rounded-xl text-center">
              <div>
                <span className="text-[10px] text-blue-700 font-bold uppercase tracking-wider block">Elapsed Days</span>
                <span className="text-base font-extrabold text-blue-950 font-mono">{interestSnapshot.daysElapsed} Days</span>
              </div>
              <div>
                <span className="text-[10px] text-blue-700 font-bold uppercase tracking-wider block">Completed Months</span>
                <span className="text-base font-extrabold text-blue-950 font-mono">{interestSnapshot.monthsCompleted} Months</span>
              </div>
            </div>
          )}

          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Original Loan Amount:</span>
              <span className="font-semibold text-gray-900">{formatINR(loan.principal_amount)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Current Outstanding Principal:</span>
              <span className="font-bold text-blue-700 text-sm">{formatINR(remainingPrincipal)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Annual Interest Rate (APR %):</span>
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-900">{loan.interest_rate_apr}% APR</span>
                {(currentUser?.role === 'Admin' || currentUser?.role === 'Manager' || !currentUser) && (
                  <button
                    onClick={() => {
                      setSelectedNewApr('');
                      setAprChangeReason('');
                      setAprModalError(null);
                      setIsAprModalOpen(true);
                    }}
                    className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-[#2563EB] text-[10px] font-bold rounded flex items-center gap-1 border border-blue-200 cursor-pointer transition"
                    title="Authorized Admin Action: Adjust APR %"
                  >
                    <Percent size={10} />
                    Adjust APR
                  </button>
                )}
              </div>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Monthly Interest:</span>
              <span className="font-medium text-gray-800">
                {formatINR(Math.round((remainingPrincipal * (loan.interest_rate_apr / 100)) / 12))} ({((loan.interest_rate_apr || 18)/12).toFixed(2)}%/mo)
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Loan Start Date:</span>
              <span className="text-gray-800 font-medium">{loan.origination_date ? new Date(loan.origination_date).toLocaleDateString('en-IN') : 'N/A'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Maturity / Due Date:</span>
              <span className="text-gray-800 font-medium">{loan.maturity_date ? new Date(loan.maturity_date).toLocaleDateString('en-IN') : 'N/A'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Interest Accrued up to Today:</span>
              <span className="font-bold text-amber-600">{formatINR(dynamicOutstandingInterest)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Interest Already Paid:</span>
              <span className="font-medium text-gray-800">{formatINR(loan.total_interest_paid || 0)}</span>
            </div>
            <div className="pt-2 border-t border-gray-200 flex justify-between items-center">
              <span className="font-bold text-gray-900 text-sm">Total Payable Amount:</span>
              <span className="font-extrabold text-[#2563EB] text-base">{formatINR(totalOutstanding)}</span>
            </div>
          </div>
        </div>

        {/* Right: Gold Collateral */}
        <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-2">
            <h3 className="text-xs font-bold text-[#2563EB] uppercase tracking-wider flex items-center gap-2">
              <Scale size={14} />
              Gold Collateral Specifications
            </h3>
            <span className="text-[10px] text-gray-500 font-mono">
              Vault Bin: <strong className="text-gray-800">{loan.current_bin_id || collateral[0]?.storage_bin_id || 'Vault A'}</strong>
            </span>
          </div>

          <div className="space-y-3 text-xs">
            {[
              { label: 'Total Items Appraised', value: `${collateral.length} Ornaments` },
              { label: 'Ornament Descriptions', value: collateral.map(c => c.item_description).join(', ') || 'N/A' },
              { label: 'Total Gross Weight', value: `${totalGrossWeight.toFixed(2)} grams` },
              { label: 'Total Stone Deduction', value: `${totalStoneWeight.toFixed(2)} grams`, color: 'text-red-500' },
              { label: 'Net Gold Deposit Weight', value: `${totalNetWeight.toFixed(2)} grams`, color: 'text-[#2563EB]' },
              { label: 'Average Purity Karat', value: collateral[0]?.purity_karat || '22K' },
              { label: 'Appraisal Valuation', value: formatINR(totalValuation), color: 'text-emerald-600' },
              { label: 'Computed Loan-to-Value (LTV)', value: `${averageLtv}%` },
              { label: 'Custody Location', value: collateral[0]?.custody_location || 'PGF Safe', color: isRepledgedWithBank ? 'text-amber-700 font-bold' : 'text-gray-700' },
            ].map((item, i) => (
              <div key={i} className="flex justify-between items-center">
                <span className="text-gray-400">{item.label}</span>
                <span className={`font-semibold ${item.color || 'text-gray-600'} text-right max-w-[60%] truncate`}>{item.value}</span>
              </div>
            ))}
          </div>

          {/* Pledged Gold Photographs Grid */}
          {collateral.some(c => c.front_photo_url || c.back_photo_url) && (
            <div className="pt-3 border-t border-gray-100 space-y-2">
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block">
                Pledged Ornament Photographic Evidence
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {collateral.map((c, cIdx) => (
                  <React.Fragment key={c.id || cIdx}>
                    {c.front_photo_url && (
                      <div className="bg-gray-50 p-1.5 rounded-lg border border-gray-200 text-center space-y-1">
                        <img
                          src={c.front_photo_url}
                          alt={`${c.item_description} Front`}
                          className="h-20 w-full object-cover rounded shadow-xs hover:scale-105 transition cursor-pointer"
                          onClick={() => window.open(c.front_photo_url!, '_blank')}
                        />
                        <span className="text-[9px] text-gray-500 font-medium block truncate">
                          #{cIdx + 1} Front
                        </span>
                      </div>
                    )}
                    {c.back_photo_url && (
                      <div className="bg-gray-50 p-1.5 rounded-lg border border-gray-200 text-center space-y-1">
                        <img
                          src={c.back_photo_url}
                          alt={`${c.item_description} Back/Scale`}
                          className="h-20 w-full object-cover rounded shadow-xs hover:scale-105 transition cursor-pointer"
                          onClick={() => window.open(c.back_photo_url!, '_blank')}
                        />
                        <span className="text-[9px] text-gray-500 font-medium block truncate">
                          #{cIdx + 1} Hallmark/Scale
                        </span>
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 7 & 8: RE-PLEDGE DETAILS & RE-PLEDGED ORNAMENT LINKAGE */}
      <RePledgeCard
        loan={loan}
        repledge={repledge}
        collateral={collateral}
        onRefresh={loadLoanDetails}
      />

      {/* SECTION 9: CHRONOLOGICAL PAYMENT HISTORY TABLE */}
      <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-6 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-[#E5E7EB] pb-3">
          <div>
            <h3 className="text-sm font-bold text-[#2563EB] uppercase tracking-wider flex items-center gap-2 font-outfit">
              <Receipt size={16} />
              Chronological Payment History ({payments.length})
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Complete transaction register showing interest settled, principal reductions, and official receipts.
            </p>
          </div>
          <button
            onClick={() => router.push(`/admin/billing?loanId=${loan.id}`)}
            className="px-3 py-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg text-xs font-bold uppercase tracking-wider transition flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Coins size={13} />
            Collect Payment
          </button>
        </div>

        {payments.length === 0 ? (
          <div className="py-10 text-center text-gray-400 text-xs">
            No repayment transactions recorded for this loan yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/70 text-gray-500 text-[10px] font-bold uppercase tracking-wider">
                  <th className="py-2.5 px-3">Receipt No</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Mode</th>
                  <th className="py-2.5 px-3 text-right">Total Payment</th>
                  <th className="py-2.5 px-3 text-right">Interest Settled</th>
                  <th className="py-2.5 px-3 text-right">Principal Reduced</th>
                  <th className="py-2.5 px-3 text-right">Penalty</th>
                  <th className="py-2.5 px-3">Transaction Ref</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-mono">
                {sortedPayments.map((p: any) => (
                  <tr 
                    key={p.id}
                    onClick={() => setSelectedPaymentDetail(p)}
                    className="hover:bg-blue-50/40 transition cursor-pointer"
                  >
                    <td className="py-3 px-3 font-bold text-blue-700">
                      {p.receipt_number || p.id.substring(0, 8)}
                    </td>
                    <td className="py-3 px-3 text-gray-700 font-sans">
                      {p.payment_date ? new Date(p.payment_date).toLocaleDateString('en-IN') : '—'}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-800 font-sans">
                        {p.mode || 'Cash'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-gray-900">
                      {formatINR(p.amount_paid || 0)}
                    </td>
                    <td className="py-3 px-3 text-right text-amber-700 font-medium">
                      {formatINR(p.interest_portion || 0)}
                    </td>
                    <td className="py-3 px-3 text-right text-emerald-700 font-medium">
                      {formatINR(p.principal_portion || 0)}
                    </td>
                    <td className="py-3 px-3 text-right text-red-500 font-medium">
                      {p.penalty_amount ? formatINR(p.penalty_amount) : '—'}
                    </td>
                    <td className="py-3 px-3 text-gray-500 text-[11px] truncate max-w-[120px]">
                      {p.remarks ? p.remarks.replace(/^\[Txn ID:\s*/, '').replace(/\].*$/, '') : 'N/A'}
                    </td>
                    <td className="py-3 px-3 text-right font-sans" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewUrl(getPdfApiUrl({ type: 'receipt', paymentId: p.id, loanId: loan.id }));
                            setPreviewTitle(`Official Payment Receipt - ${p.receipt_number}`);
                            setIsPreviewOpen(true);
                          }}
                          className="px-2 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-semibold border border-blue-200 flex items-center gap-1 transition cursor-pointer"
                        >
                          <Printer size={10} /> A4
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewUrl(getPdfApiUrl({ type: 'receipt', paymentId: p.id, loanId: loan.id, format: 'thermal' }));
                            setPreviewTitle(`80mm Thermal Receipt - ${p.receipt_number}`);
                            setIsPreviewOpen(true);
                          }}
                          className="px-2 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 text-[10px] font-semibold border border-amber-200 flex items-center gap-1 transition cursor-pointer"
                        >
                          <Printer size={10} /> POS
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            downloadPdfDocument({
                              type: 'receipt',
                              paymentId: p.id,
                              loanId: loan.id,
                            }, `PGF_Receipt_${p.receipt_number}.pdf`);
                          }}
                          className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-semibold border border-slate-300 flex items-center gap-1 transition cursor-pointer"
                        >
                          <Download size={10} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-5 shadow-sm">
        <h3 className="text-xs font-bold text-[#2563EB] uppercase tracking-wider border-b border-[#E5E7EB] pb-2 mb-4">
          Financial Documents &amp; Quick Actions
        </h3>
        <div className="flex flex-wrap gap-3">
          {!['Settled', 'Closed', 'Cancelled'].includes(loan.status) && (
            <>
              <button
                onClick={() => router.push(`/admin/billing?loanId=${loan.id}`)}
                className="px-4 py-2.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-[#F8FAFC] text-xs font-bold uppercase tracking-wider transition flex items-center gap-1.5 shadow-lg shadow-[#2563EB]/10 cursor-pointer"
              >
                <Coins size={14} />
                Collect Interest &amp; Principal
              </button>
              <button
                onClick={() => router.push(`/admin/renewal?loanId=${loan.id}`)}
                className="px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-wider transition flex items-center gap-1.5 shadow-lg shadow-emerald-600/10 cursor-pointer"
              >
                <Coins size={14} />
                Renew Loan
              </button>
              <button
                onClick={() => router.push(`/admin/re-pledge?loanId=${loan.id}`)}
                className="px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold uppercase tracking-wider transition flex items-center gap-1.5 shadow-lg shadow-amber-600/10 cursor-pointer"
              >
                <Building2 size={14} />
                Bank Re-Pledge
              </button>
              <button
                onClick={handleCloseLoan}
                className="px-4 py-2.5 rounded-lg bg-[#F3F4F6] hover:bg-red-50 text-red-500 border border-rose-500/20 text-xs font-bold uppercase tracking-wider transition flex items-center gap-1.5 cursor-pointer"
              >
                <XCircle size={14} />
                Close Loan Folder
              </button>
            </>
          )}

          {/* Pawn Ticket */}
          <button
            onClick={() => {
              setPreviewUrl(getPdfApiUrl({ type: 'ticket', loanId: loan.id }));
              setPreviewTitle(`Gold Loan Pawn Ticket - ${loan.loan_number}`);
              setIsPreviewOpen(true);
            }}
            className="px-4 py-2.5 rounded-lg bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#2563EB] border border-[#2563EB]/20 text-xs font-bold uppercase tracking-wider transition flex items-center gap-1.5 font-outfit cursor-pointer"
          >
            <Printer size={14} />
            Preview Pawn Ticket
          </button>
          <button
            onClick={() => {
              downloadPdfDocument({ type: 'ticket', loanId: loan.id }, `PGF_PawnTicket_${loan.loan_number}.pdf`);
            }}
            className="px-4 py-2.5 rounded-lg bg-[#F3F4F6] hover:bg-[#E5E7EB] text-gray-700 border border-[#E5E7EB] text-xs font-bold uppercase tracking-wider transition flex items-center gap-1.5 font-outfit cursor-pointer"
          >
            <Download size={14} />
            Download Ticket PDF
          </button>

          {/* Live Customer Statement */}
          <button
            onClick={() => router.push(`/admin/statement?customerId=${loan.customer_id}&loanId=${loan.id}`)}
            className="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-wider transition flex items-center gap-1.5 font-outfit cursor-pointer shadow-xs"
          >
            <FileText size={14} />
            View Live Statement
          </button>

          {/* Loan Ledger Statement */}
          <button
            onClick={() => {
              setPreviewUrl(getPdfApiUrl({ type: 'statement', loanId: loan.id }));
              setPreviewTitle(`Loan Account Statement - ${loan.loan_number}`);
              setIsPreviewOpen(true);
            }}
            className="px-4 py-2.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold uppercase tracking-wider transition flex items-center gap-1.5 font-outfit cursor-pointer"
          >
            <Printer size={14} />
            Statement PDF
          </button>

          {/* Closure Certificate if Settled/Closed */}
          {['Settled', 'Closed'].includes(loan.status) && (
            <button
              onClick={() => {
                setPreviewUrl(getPdfApiUrl({ type: 'closure', loanId: loan.id }));
                setPreviewTitle(`Loan Closure & Gold Release Certificate - ${loan.loan_number}`);
                setIsPreviewOpen(true);
              }}
              className="px-4 py-2.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold uppercase tracking-wider transition flex items-center gap-1.5 font-outfit cursor-pointer"
            >
              <CheckCircle2 size={14} />
              Closure Certificate PDF
            </button>
          )}

          {/* Loan Application */}
          <button
            onClick={() => {
              setPreviewUrl(getPdfApiUrl({ type: 'loan_application', loanId: loan.id }));
              setPreviewTitle(`Loan Application Printout - ${loan.loan_number}`);
              setIsPreviewOpen(true);
            }}
            className="px-4 py-2.5 rounded-lg bg-[#F3F4F6] hover:bg-[#E5E7EB] text-gray-600 border border-[#E5E7EB] text-xs font-bold uppercase tracking-wider transition flex items-center gap-1.5 font-outfit cursor-pointer"
          >
            <Printer size={14} />
            Loan Application
          </button>
        </div>
      </div>

      <PDFPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        pdfUrl={previewUrl}
        title={previewTitle}
      />

      {/* Transaction Details Modal (Section 9 Requirement) */}
      {selectedPaymentDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Receipt size={16} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 font-outfit">Transaction Details</h3>
                  <p className="text-[11px] text-gray-500 font-mono">{selectedPaymentDetail.receipt_number}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPaymentDetail(null)}
                className="text-gray-400 hover:text-gray-600 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl space-y-1.5 border border-slate-200 font-mono">
                <div className="flex justify-between">
                  <span className="text-gray-500">Receipt No:</span>
                  <span className="font-bold text-blue-700">{selectedPaymentDetail.receipt_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Date:</span>
                  <span className="text-gray-900">{new Date(selectedPaymentDetail.payment_date).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Mode:</span>
                  <span className="text-gray-900 font-sans">{selectedPaymentDetail.mode}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Payment Type:</span>
                  <span className="text-gray-900 font-sans">{selectedPaymentDetail.payment_type}</span>
                </div>
              </div>

              <div className="p-3 bg-white border border-gray-200 rounded-xl space-y-1.5">
                <div className="flex justify-between text-gray-600">
                  <span>Interest Settled:</span>
                  <span className="font-bold text-amber-700">{formatINR(selectedPaymentDetail.interest_portion || 0)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Principal Reduced:</span>
                  <span className="font-bold text-emerald-700">{formatINR(selectedPaymentDetail.principal_portion || 0)}</span>
                </div>
                {selectedPaymentDetail.penalty_amount > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Penalty Paid:</span>
                    <span className="font-bold">{formatINR(selectedPaymentDetail.penalty_amount)}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-gray-100 flex justify-between font-bold text-sm text-gray-900">
                  <span>Total Amount Paid:</span>
                  <span className="text-blue-700">{formatINR(selectedPaymentDetail.amount_paid)}</span>
                </div>
              </div>

              {selectedPaymentDetail.remarks && (
                <div className="p-2.5 bg-gray-50 rounded-lg text-[11px] text-gray-600 border border-gray-200">
                  <span className="font-bold block text-gray-700">Remarks / References:</span>
                  <p className="mt-0.5">{selectedPaymentDetail.remarks}</p>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  setPreviewUrl(getPdfApiUrl({ type: 'receipt', paymentId: selectedPaymentDetail.id, loanId: loan.id, format: 'thermal' }));
                  setPreviewTitle(`80mm Thermal Receipt - ${selectedPaymentDetail.receipt_number}`);
                  setIsPreviewOpen(true);
                }}
                className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl text-xs font-bold transition flex items-center gap-1 border border-amber-200 cursor-pointer"
              >
                <Printer size={12} /> Thermal POS
              </button>
              <button
                type="button"
                onClick={() => {
                  setPreviewUrl(getPdfApiUrl({ type: 'receipt', paymentId: selectedPaymentDetail.id, loanId: loan.id }));
                  setPreviewTitle(`Official Payment Receipt - ${selectedPaymentDetail.receipt_number}`);
                  setIsPreviewOpen(true);
                }}
                className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition flex items-center gap-1 border border-blue-200 cursor-pointer"
              >
                <Printer size={12} /> A4 Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Authorized APR Adjustment Modal */}
      {isAprModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 space-y-5">
            <div className="flex items-start justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                  <ShieldAlert size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 font-outfit">Authorized Loan APR Modification</h3>
                  <p className="text-[11px] text-gray-500">PGF Audit &amp; Compliance Registry</p>
                </div>
              </div>
              <button
                onClick={() => setIsAprModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Audit Warning */}
            <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
              <AlertTriangle size={16} className="text-amber-700 shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed">
                <strong>Statutory Notice:</strong> Modifying the APR rate alters contractual daily interest accrual. This action requires an authorized administrative reason and will be permanently recorded in the system audit log.
              </p>
            </div>

            {aprModalError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-medium flex items-center gap-2">
                <AlertTriangle size={14} className="shrink-0" />
                <span>{aprModalError}</span>
              </div>
            )}

            {/* Loan Context */}
            <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 rounded-xl text-xs border border-gray-100">
              <div>
                <span className="text-gray-400 text-[10px] block">Loan Number</span>
                <span className="font-bold text-gray-800 font-mono">{loan.loan_number}</span>
              </div>
              <div>
                <span className="text-gray-400 text-[10px] block">Current APR Rate</span>
                <span className="font-bold text-gray-800">{loan.interest_rate_apr}% APR</span>
              </div>
            </div>

            {/* APR Dropdown Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-800 block">
                Annual Interest Rate (APR %) *
              </label>
              <div className="relative">
                <select
                  value={selectedNewApr}
                  onChange={(e) => setSelectedNewApr(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-white border border-gray-200 focus:border-[#2563EB] text-gray-900 text-sm font-bold rounded-lg pl-3 pr-9 py-2.5 outline-none transition cursor-pointer appearance-none"
                >
                  <option value="" disabled>Select Annual Interest Rate (APR %)...</option>
                  <option value={18}>18% (1.50% / month)</option>
                  <option value={20}>20% (1.67% / month)</option>
                  <option value={22}>22% (1.83% / month)</option>
                  <option value={24}>24% (2.00% / month)</option>
                  <option value={30}>30% (2.50% / month)</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                  <ChevronDown size={16} />
                </div>
              </div>
            </div>

            {/* Dynamic Comparison Preview */}
            {typeof selectedNewApr === 'number' && (
              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs space-y-1 text-blue-950">
                <span className="text-[10px] uppercase font-bold text-blue-800 block">Rate Impact Preview:</span>
                <div className="flex justify-between text-xs pt-1">
                  <span>Monthly Interest on Remaining Principal:</span>
                  <strong className="text-blue-900">
                    {formatINR(Math.round((remainingPrincipal * (selectedNewApr / 100)) / 12))} / mo
                  </strong>
                </div>
                <div className="flex justify-between text-[11px] text-blue-800">
                  <span>Daily Accrual Rate:</span>
                  <span>₹{((remainingPrincipal * (selectedNewApr / 100)) / 365).toFixed(2)} / day</span>
                </div>
              </div>
            )}

            {/* Reason for Change (Mandatory) */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-800 block">
                Administrative Justification / Reason *
              </label>
              <textarea
                rows={3}
                value={aprChangeReason}
                onChange={(e) => setAprChangeReason(e.target.value)}
                placeholder="State the regulatory or approved business reason for altering this loan's APR (e.g., Manager rate concession, borrower restructuring agreement)..."
                className="w-full bg-white border border-gray-200 focus:border-[#2563EB] text-gray-900 text-xs rounded-lg p-3 outline-none transition"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setIsAprModalOpen(false)}
                disabled={aprSubmitting}
                className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpdateApr}
                disabled={aprSubmitting}
                className="px-5 py-2 bg-[#2563EB] hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
              >
                {aprSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Recording...
                  </>
                ) : (
                  <>
                    <ShieldAlert size={14} />
                    Confirm &amp; Log Audit
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
