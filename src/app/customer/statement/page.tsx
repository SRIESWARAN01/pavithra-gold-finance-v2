'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  FileText, 
  Download, 
  Printer, 
  Coins, 
  Calendar, 
  Clock, 
  ShieldCheck, 
  User, 
  Phone, 
  MapPin, 
  Receipt, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingUp, 
  CreditCard, 
  Sparkles, 
  RefreshCw, 
  Share2, 
  ArrowLeft,
  Scale,
  Percent,
  Check,
  ChevronDown
} from 'lucide-react';
import { isFirebaseConfigured, getCurrentProfile } from '@/lib/auth';
import { db } from '@/lib/firebase';
import { 
  doc, 
  onSnapshot, 
  collection, 
  query, 
  where 
} from 'firebase/firestore';
import PDFPreviewModal from '@/components/PDFPreviewModal';
import { getPdfApiUrl, downloadPdfDocument } from '@/lib/pdfHelper';

export default function CustomerStatementPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const targetLoanIdFromUrl = searchParams.get('loanId') || '';
  const targetCustIdFromUrl = searchParams.get('customerId') || '';

  const [loading, setLoading] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());
  const [justUpdated, setJustUpdated] = useState(false);

  // Core Real-time State
  const [customer, setCustomer] = useState<any>(null);
  const [loans, setLoans] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [goldCollateral, setGoldCollateral] = useState<any[]>([]);

  // Selection: 'ALL' or a specific loan ID
  const [selectedLoanId, setSelectedLoanId] = useState<string>('ALL');

  // PDF Preview State
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');

  // 1. Authenticate & Setup Live Firestore Listeners
  useEffect(() => {
    let unsubProfile: (() => void) | undefined;
    let unsubLoans: (() => void) | undefined;
    let unsubPayments: (() => void) | undefined;
    let unsubGold: (() => void) | undefined;

    async function initLiveSubscriptions() {
      setLoading(true);
      try {
        if (!isFirebaseConfigured()) {
          setLoading(false);
          return;
        }

        const profile = await getCurrentProfile();
        if (!profile) {
          router.replace('/');
          return;
        }

        // Security rule: Customers can NEVER view another customer's information.
        // Only Admin / Manager can view a specific customer via query parameter.
        let activeCustId = profile.id;
        if ((profile.role === 'Admin' || profile.role === 'Manager') && targetCustIdFromUrl) {
          activeCustId = targetCustIdFromUrl;
        }

        if (!activeCustId) {
          setLoading(false);
          return;
        }

        // ── A. REAL-TIME LISTENER: CUSTOMER PROFILE ──
        unsubProfile = onSnapshot(doc(db, 'profiles', activeCustId), (snap) => {
          if (snap.exists()) {
            setCustomer({ id: snap.id, ...snap.data() });
            triggerSyncPulse();
          }
        });

        // ── B. REAL-TIME LISTENER: LOANS ──
        const loansQuery = query(
          collection(db, 'loans'),
          where('customer_id', '==', activeCustId)
        );
        unsubLoans = onSnapshot(loansQuery, (snapshot) => {
          const loadedLoans: any[] = [];
          snapshot.forEach((d) => {
            loadedLoans.push({ id: d.id, ...d.data() });
          });
          // Sort newest origination first
          loadedLoans.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
          setLoans(loadedLoans);
          triggerSyncPulse();

          // Auto-select loan if provided in URL or if only 1 loan exists
          if (targetLoanIdFromUrl) {
            setSelectedLoanId(targetLoanIdFromUrl);
          } else if (loadedLoans.length === 1) {
            setSelectedLoanId(loadedLoans[0].id);
          }
        });

        // ── C. REAL-TIME LISTENER: PAYMENTS ──
        const paymentsQuery = query(
          collection(db, 'payments'),
          where('customer_id', '==', activeCustId)
        );
        unsubPayments = onSnapshot(paymentsQuery, (snapshot) => {
          const loadedPayments: any[] = [];
          snapshot.forEach((d) => {
            loadedPayments.push({ id: d.id, ...d.data() });
          });
          // Sort newest payment first
          loadedPayments.sort((a, b) => (b.payment_date || '').localeCompare(a.payment_date || ''));
          setPayments(loadedPayments);
          triggerSyncPulse();
        });

        // ── D. REAL-TIME LISTENER: GOLD COLLATERAL ──
        const goldQuery = query(
          collection(db, 'gold_collateral'),
          where('customer_id', '==', activeCustId)
        );
        unsubGold = onSnapshot(goldQuery, (snapshot) => {
          const loadedGold: any[] = [];
          snapshot.forEach((d) => {
            loadedGold.push({ id: d.id, ...d.data() });
          });
          setGoldCollateral(loadedGold);
          triggerSyncPulse();
        });

      } catch (err) {
        console.error('Failed to initialize live statement subscriptions:', err);
      } finally {
        setLoading(false);
      }
    }

    initLiveSubscriptions();

    return () => {
      if (unsubProfile) unsubProfile();
      if (unsubLoans) unsubLoans();
      if (unsubPayments) unsubPayments();
      if (unsubGold) unsubGold();
    };
  }, [router, targetCustIdFromUrl, targetLoanIdFromUrl]);

  const triggerSyncPulse = () => {
    setLastSyncTime(new Date());
    setJustUpdated(true);
    setTimeout(() => setJustUpdated(false), 2500);
  };

  // Selected Loan Object (or null for Consolidated)
  const currentLoan = useMemo(() => {
    if (selectedLoanId === 'ALL') return null;
    return loans.find((l) => l.id === selectedLoanId) || null;
  }, [loans, selectedLoanId]);

  // Filtered Gold Collateral for selected loan / consolidated
  const relevantGold = useMemo(() => {
    if (!currentLoan) return goldCollateral;
    return goldCollateral.filter((g) => g.loan_id === currentLoan.id);
  }, [goldCollateral, currentLoan]);

  // Filtered Payments for selected loan / consolidated
  const relevantPayments = useMemo(() => {
    if (!currentLoan) return payments;
    return payments.filter((p) => p.loan_id === currentLoan.id);
  }, [payments, currentLoan]);

  // Financial Computations (Live calculation)
  const financials = useMemo(() => {
    if (currentLoan) {
      const principal = currentLoan.principal_amount || 0;
      const principalPaid = currentLoan.total_principal_paid || 0;
      const remainingPrincipal = Math.max(0, principal - principalPaid);
      const interestPaid = currentLoan.total_interest_paid || 0;
      const outstandingInterest = currentLoan.outstanding_interest || 0;
      const apr = currentLoan.interest_rate_apr || 18;
      const monthlyRate = apr / 12;
      const dailyRate = Math.round(((remainingPrincipal * (apr / 100)) / 365) * 100) / 100;
      const totalOutstanding = remainingPrincipal + outstandingInterest;
      const totalPaid = principalPaid + interestPaid;

      return {
        isConsolidated: false,
        principal,
        principalPaid,
        remainingPrincipal,
        interestPaid,
        outstandingInterest,
        totalOutstanding,
        totalPaid,
        apr,
        monthlyRate,
        dailyRate,
        loanCount: 1,
        status: currentLoan.status,
      };
    } else {
      // Consolidated across all loans
      const principal = loans.reduce((acc, l) => acc + (l.principal_amount || 0), 0);
      const principalPaid = loans.reduce((acc, l) => acc + (l.total_principal_paid || 0), 0);
      const remainingPrincipal = Math.max(0, principal - principalPaid);
      const interestPaid = loans.reduce((acc, l) => acc + (l.total_interest_paid || 0), 0);
      const outstandingInterest = loans.reduce((acc, l) => acc + (l.outstanding_interest || 0), 0);
      const totalOutstanding = remainingPrincipal + outstandingInterest;
      const totalPaid = principalPaid + interestPaid;
      const avgApr = loans.length > 0 ? loans.reduce((acc, l) => acc + (l.interest_rate_apr || 18), 0) / loans.length : 18;

      return {
        isConsolidated: true,
        principal,
        principalPaid,
        remainingPrincipal,
        interestPaid,
        outstandingInterest,
        totalOutstanding,
        totalPaid,
        apr: avgApr,
        monthlyRate: avgApr / 12,
        dailyRate: Math.round(((remainingPrincipal * (avgApr / 100)) / 365) * 100) / 100,
        loanCount: loans.length,
        status: loans.some((l) => l.status === 'Overdue') ? 'Overdue' : loans.some((l) => l.status === 'Due') ? 'Due' : 'Active',
      };
    }
  }, [currentLoan, loans]);

  // Customer Dynamic Portfolio Totals (from actual Firestore documents)
  const totalDisbursed = useMemo(() => {
    return loans.reduce((acc, l) => acc + (l.principal_amount || 0), 0);
  }, [loans]);

  const totalPrincipalCleared = useMemo(() => {
    return loans.reduce((acc, l) => acc + (l.total_principal_paid || 0), 0);
  }, [loans]);

  const activeOutstandingBalance = useMemo(() => {
    return Math.max(0, totalDisbursed - totalPrincipalCleared);
  }, [totalDisbursed, totalPrincipalCleared]);

  const totalAccruedInterest = useMemo(() => {
    return loans
      .filter((l) => l.status !== 'Settled' && l.status !== 'Closed')
      .reduce((acc, l) => acc + (l.outstanding_interest || 0), 0);
  }, [loans]);

  // Collateral Totals
  const collateralTotals = useMemo(() => {
    const gross = relevantGold.reduce((acc, g) => acc + (g.gross_weight || g.weight_grams || 0), 0);
    const stone = relevantGold.reduce((acc, g) => acc + (g.stone_weight || 0), 0);
    const net = relevantGold.reduce((acc, g) => acc + (g.net_weight || g.weight_grams || 0), 0);
    const valuation = relevantGold.reduce((acc, g) => acc + (g.valuation_inr || 0), 0);
    const ltv = valuation > 0 ? Math.round((financials.principal / valuation) * 100) : 0;

    return { gross, stone, net, valuation, ltv };
  }, [relevantGold, financials.principal]);

  // Handle PDF Actions
  const handlePreviewPdf = () => {
    if (currentLoan) {
      const url = getPdfApiUrl({ type: 'statement', loanId: currentLoan.id, customerId: customer?.id });
      setPreviewUrl(url);
      setPreviewTitle(`Loan Account Statement - ${currentLoan.loan_number}`);
    } else {
      const url = getPdfApiUrl({ type: 'customer_statement', customerId: customer?.id });
      setPreviewUrl(url);
      setPreviewTitle(`Consolidated Portfolio Statement - ${customer?.name || 'Customer'}`);
    }
    setPreviewOpen(true);
  };

  const handleDownloadPdf = () => {
    if (currentLoan) {
      downloadPdfDocument(
        { type: 'statement', loanId: currentLoan.id, customerId: customer?.id },
        `PGF_Statement_${currentLoan.loan_number}.pdf`
      );
    } else {
      downloadPdfDocument(
        { type: 'customer_statement', customerId: customer?.id },
        `PGF_Portfolio_Statement_${customer?.customer_number || 'PGF'}.pdf`
      );
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handlePawnTicketPdf = () => {
    const targetLoan = currentLoan || (loans.length > 0 ? loans[0] : null);
    if (!targetLoan) {
      alert('No active loan available for generating a Pawn Ticket.');
      return;
    }
    const url = getPdfApiUrl({ type: 'ticket', loanId: targetLoan.id, customerId: customer?.id });
    setPreviewUrl(url);
    setPreviewTitle(`Official Pawn Ticket (Receipt of Pledge) - ${targetLoan.loan_number}`);
    setPreviewOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        <p className="text-xs text-gray-500 font-medium">Connecting to live database & verifying account ledger...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16 animate-fade-in print:p-0 print:space-y-4">
      {/* ── TOP LIVE-STATUS SYNC BAR ── */}
      <div className="bg-gradient-to-r from-slate-900 to-blue-950 text-white rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 font-mono">
              Live Database Connected — Real-Time Synchronized
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold font-outfit tracking-tight text-white">
            Official Customer Statement
          </h1>
          <p className="text-xs text-slate-300">
            Real-time ledger statement reflecting all approved disbursements, interest accruals, and repayments.
          </p>
        </div>

        {/* Sync Status Badge */}
        <div className="flex items-center gap-2.5 bg-white/10 px-3 py-1.5 rounded-xl border border-white/10 text-xs font-mono">
          <Clock size={13} className="text-blue-400" />
          <span className="text-slate-300 text-[11px]">
            Updated: {lastSyncTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>
      </div>

      {/* ── ACCOUNT SELECTOR & ACTION TOOLBAR ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
        {/* Account Selector */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <span className="text-xs font-bold text-gray-700 whitespace-nowrap">Statement Scope:</span>
          <div className="relative flex-1 sm:w-80">
            <select
              value={selectedLoanId}
              onChange={(e) => setSelectedLoanId(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 hover:border-blue-500 text-gray-900 text-xs rounded-xl px-3.5 py-2 outline-none font-semibold cursor-pointer appearance-none pr-8"
            >
              <option value="ALL">Consolidated Portfolio (All {loans.length} Loans)</option>
              {loans.map((ln) => (
                <option key={ln.id} value={ln.id}>
                  {ln.loan_number} — ₹{(ln.principal_amount || 0).toLocaleString('en-IN')} ({ln.status})
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-3 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={handlePreviewPdf}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-[#2563EB] border border-blue-200 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            <FileText size={14} />
            <span>Preview PDF</span>
          </button>
          <button
            onClick={handleDownloadPdf}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-xl text-xs font-bold transition shadow-md shadow-blue-600/20 cursor-pointer"
          >
            <Download size={14} />
            <span>Statement PDF</span>
          </button>
          <button
            onClick={handlePawnTicketPdf}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold transition cursor-pointer"
          >
            <Printer size={14} />
            <span>Pawn Ticket</span>
          </button>
          <button
            onClick={handlePrint}
            className="hidden sm:flex items-center justify-center gap-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition cursor-pointer"
            title="Print Statement"
          >
            <Printer size={14} />
          </button>
        </div>
      </div>

      {/* ── SECTION 1: CUSTOMER INFORMATION ── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <User size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 font-outfit">Customer Information</h3>
              <p className="text-[11px] text-gray-500 font-mono">
                Customer ID: <strong className="text-blue-600">{customer?.customer_number || customer?.id || '—'}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 border ${
              customer?.kyc_status === 'Approved' || customer?.kyc_status === 'Verified'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}>
              <ShieldCheck size={12} />
              KYC {customer?.kyc_status || 'Verified'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="space-y-1 bg-gray-50/70 p-3 rounded-xl border border-gray-100">
            <span className="text-gray-400 text-[10px] font-medium block uppercase tracking-wider">Customer Name</span>
            <span className="text-gray-900 font-bold text-sm block">{customer?.name || '—'}</span>
            <span className="text-gray-400 text-[11px]">{customer?.email || '—'}</span>
          </div>

          <div className="space-y-1 bg-gray-50/70 p-3 rounded-xl border border-gray-100">
            <span className="text-gray-400 text-[10px] font-medium block uppercase tracking-wider">Registered Mobile</span>
            <span className="text-gray-900 font-bold font-mono text-sm block">
              {customer?.phone_primary ? `+91 ${customer.phone_primary}` : '—'}
            </span>
            {customer?.phone_alt && (
              <span className="text-gray-400 text-[11px] font-mono">Alt: +91 {customer.phone_alt}</span>
            )}
          </div>

          <div className="space-y-1 bg-gray-50/70 p-3 rounded-xl border border-gray-100">
            <span className="text-gray-400 text-[10px] font-medium block uppercase tracking-wider">Aadhaar & PAN Status</span>
            <div className="space-y-0.5 font-mono text-[11px]">
              <div className="text-gray-700">
                Aadhaar: <strong>{customer?.national_id || '—'}</strong>
              </div>
              <div className="text-gray-700">
                PAN: <strong>{customer?.pan_number || '—'}</strong>
              </div>
            </div>
          </div>

          <div className="space-y-1 bg-gray-50/70 p-3 rounded-xl border border-gray-100">
            <span className="text-gray-400 text-[10px] font-medium block uppercase tracking-wider">Residential Address</span>
            <p className="text-gray-700 leading-relaxed text-[11px]">
              {customer?.address ? `${customer.address}${customer.city ? ', ' + customer.city : ''}${customer.pin_code ? ' - ' + customer.pin_code : ''}` : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* ── SECTION 2: FINANCIAL SUMMARY ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* TOTAL DISBURSED */}
        <div className="bg-white border border-blue-100 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex justify-between items-center text-xs text-blue-600 font-bold uppercase tracking-wider">
            <span>TOTAL DISBURSED</span>
            <Coins size={18} />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-gray-900 font-outfit">
            ₹{totalDisbursed.toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-gray-500 pt-1 border-t border-gray-100">
            Sum of actual disbursed/sanctioned principal ({loans.length} {loans.length === 1 ? 'account' : 'accounts'})
          </p>
        </div>

        {/* TOTAL PRINCIPAL CLEARED */}
        <div className="bg-white border border-emerald-100 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex justify-between items-center text-xs text-emerald-600 font-bold uppercase tracking-wider">
            <span>TOTAL PRINCIPAL CLEARED</span>
            <CheckCircle2 size={18} />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-600 font-outfit">
            ₹{totalPrincipalCleared.toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-gray-500 pt-1 border-t border-gray-100">
            Sum of actual principal payments
          </p>
        </div>

        {/* ACTIVE OUTSTANDING BALANCE */}
        <div className="bg-gradient-to-br from-slate-900 to-blue-950 text-white rounded-2xl p-5 shadow-lg shadow-blue-950/20 space-y-2">
          <div className="flex justify-between items-center text-xs text-amber-400 font-bold uppercase tracking-wider">
            <span>ACTIVE OUTSTANDING BALANCE</span>
            <Receipt size={18} />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white font-outfit">
            ₹{activeOutstandingBalance.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-300 flex justify-between pt-1 border-t border-white/10 font-mono">
            <span>Live Accrued Interest:</span>
            <strong className="text-amber-300">₹{totalAccruedInterest.toLocaleString('en-IN')}</strong>
          </div>
        </div>
      </div>

      {/* ── SECTION 3: LOAN ACCOUNTS TABLE ── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex justify-between items-center border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Coins size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 font-outfit">
                Loan Accounts ({loans.length})
              </h3>
              <p className="text-[11px] text-gray-500">
                All real loan accounts belonging to the selected customer.
              </p>
            </div>
          </div>
        </div>

        {loans.length === 0 ? (
          <div className="text-center py-10 text-gray-500 text-xs font-semibold">
            No loan accounts found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/70 text-gray-500 text-[10px] font-bold uppercase tracking-wider">
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Loan Number</th>
                  <th className="py-2.5 px-3">Disbursal Date</th>
                  <th className="py-2.5 px-3 text-right">Sanctioned Principal</th>
                  <th className="py-2.5 px-3 text-right">Principal Paid</th>
                  <th className="py-2.5 px-3 text-right">Balance Due</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-mono">
                {loans.map((ln, idx) => {
                  const bal = Math.max(0, (ln.principal_amount || 0) - (ln.total_principal_paid || 0));
                  return (
                    <tr 
                      key={ln.id} 
                      onClick={() => setSelectedLoanId(ln.id === selectedLoanId ? 'ALL' : ln.id)}
                      className={`hover:bg-blue-50/40 transition cursor-pointer ${selectedLoanId === ln.id ? 'bg-blue-50/70 font-semibold' : ''}`}
                    >
                      <td className="py-3 px-3 text-gray-400 text-[11px]">{idx + 1}</td>
                      <td className="py-3 px-3 font-bold text-blue-700 font-mono">{ln.loan_number}</td>
                      <td className="py-3 px-3 text-gray-600 font-sans">
                        {ln.origination_date ? new Date(ln.origination_date).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td className="py-3 px-3 text-right text-gray-900 font-bold">
                        ₹{(ln.principal_amount || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-3 text-right text-emerald-700 font-bold">
                        ₹{(ln.total_principal_paid || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-3 text-right text-rose-700 font-bold">
                        ₹{bal.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider font-sans border ${
                          ln.status === 'Settled'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : ln.status === 'Overdue'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}>
                          {ln.status || 'Active'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── SECTION 4: LIFETIME REPAYMENT HISTORY TABLE ── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex justify-between items-center border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Receipt size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 font-outfit">
                Lifetime Repayment History ({relevantPayments.length})
              </h3>
              <p className="text-[11px] text-gray-500">
                All real repayment documents for the customer.
              </p>
            </div>
          </div>
        </div>

        {relevantPayments.length === 0 ? (
          <div className="text-center py-10 text-gray-500 text-xs font-semibold">
            No repayment transactions found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/70 text-gray-500 text-[10px] font-bold uppercase tracking-wider">
                  <th className="py-2.5 px-3">Receipt No</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Mode</th>
                  <th className="py-2.5 px-3 text-right">Interest Paid</th>
                  <th className="py-2.5 px-3 text-right">Principal Paid</th>
                  <th className="py-2.5 px-3 text-right">Total Amount</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-mono">
                {relevantPayments.map((p) => (
                  <tr key={p.id} className="hover:bg-blue-50/40 transition">
                    <td className="py-3 px-3 font-bold text-blue-700">{p.receipt_number || p.id?.substring(0, 8)}</td>
                    <td className="py-3 px-3 text-gray-600 font-sans">
                      {p.payment_date ? new Date(p.payment_date).toLocaleDateString('en-IN') : '—'}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-800 text-[10px] font-bold font-sans">
                        {p.mode || 'Cash'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right text-amber-700 font-bold">
                      ₹{(p.interest_portion || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-3 text-right text-emerald-700 font-bold">
                      ₹{(p.principal_portion || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-3 text-right text-gray-900 font-bold text-sm">
                      ₹{(p.amount_paid || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-3 text-right font-sans">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            const url = getPdfApiUrl({ type: 'receipt', paymentId: p.id, loanId: p.loan_id, customerId: customer?.id });
                            setPreviewUrl(url);
                            setPreviewTitle(`Repayment Bill Receipt - ${p.receipt_number || p.id}`);
                            setPreviewOpen(true);
                          }}
                          className="px-2.5 py-1 text-[11px] font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition inline-flex items-center gap-1 cursor-pointer"
                        >
                          <FileText size={11} /> View
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            downloadPdfDocument(
                              { type: 'receipt', paymentId: p.id, loanId: p.loan_id, customerId: customer?.id },
                              `Bill_${p.receipt_number || p.id.substring(0, 8)}.pdf`
                            );
                          }}
                          className="px-2.5 py-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition inline-flex items-center gap-1 border border-blue-200 cursor-pointer"
                        >
                          <Download size={11} /> Download Bill PDF
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

      {/* ── SECTION 5: PLEDGED GOLD COLLATERAL SPECIFICATIONS ── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Scale size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 font-outfit">
                Pledged Gold Collateral Specifications
              </h3>
              <p className="text-[11px] text-gray-500">
                Audited weights, hallmark verification, purity assay, and vault custody status.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs bg-amber-50/70 border border-amber-200 px-3 py-1.5 rounded-xl font-mono">
            <span className="text-amber-800">
              Net Gold Weight: <strong className="text-amber-900 text-sm font-bold">{collateralTotals.net.toFixed(2)}g</strong>
            </span>
            <span className="text-amber-300">•</span>
            <span className="text-amber-800">
              Valuation: <strong className="text-amber-900 text-sm font-bold">₹{collateralTotals.valuation.toLocaleString('en-IN')}</strong>
            </span>
          </div>
        </div>

        {relevantGold.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-xs">
            No gold collateral ornaments attached to this selection.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/70 text-gray-500 text-[10px] font-bold uppercase tracking-wider">
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Item Description</th>
                  <th className="py-2.5 px-3">Purity</th>
                  <th className="py-2.5 px-3">Gross Wt (g)</th>
                  <th className="py-2.5 px-3">Stone Wt (g)</th>
                  <th className="py-2.5 px-3 font-bold text-gray-900">Net Wt (g)</th>
                  <th className="py-2.5 px-3">Gold Rate (₹/g)</th>
                  <th className="py-2.5 px-3 text-right">Valuation (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-mono">
                {relevantGold.map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-blue-50/30 transition">
                    <td className="py-3 px-3 text-gray-400 text-[11px]">{idx + 1}</td>
                    <td className="py-3 px-3 font-sans font-semibold text-gray-900">
                      {item.item_description || item.ornament_type || 'Gold Asset'}
                      {item.hallmark && (
                        <span className="ml-1.5 px-1.5 py-0.2 bg-emerald-100 text-emerald-800 rounded text-[9px] font-bold font-sans">
                          916 BIS
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-amber-700 font-bold">{item.purity_karat || '22K'}</td>
                    <td className="py-3 px-3 text-gray-600">{(item.gross_weight || item.weight_grams || 0).toFixed(2)}g</td>
                    <td className="py-3 px-3 text-gray-400">{(item.stone_weight || 0).toFixed(2)}g</td>
                    <td className="py-3 px-3 text-emerald-700 font-bold text-sm">{(item.net_weight || item.weight_grams || 0).toFixed(2)}g</td>
                    <td className="py-3 px-3 text-gray-600">₹{(item.gold_rate_per_gram || 7100).toLocaleString('en-IN')}</td>
                    <td className="py-3 px-3 text-right font-bold text-gray-900">₹{(item.valuation_inr || 0).toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50 text-xs font-bold font-mono">
                  <td colSpan={3} className="py-3 px-3 font-sans uppercase">Total Collateral Sum:</td>
                  <td className="py-3 px-3">{collateralTotals.gross.toFixed(2)}g</td>
                  <td className="py-3 px-3 text-gray-400">{collateralTotals.stone.toFixed(2)}g</td>
                  <td className="py-3 px-3 text-emerald-700 text-sm">{collateralTotals.net.toFixed(2)}g</td>
                  <td className="py-3 px-3">LTV: {collateralTotals.ltv}%</td>
                  <td className="py-3 px-3 text-right text-gray-900">₹{collateralTotals.valuation.toLocaleString('en-IN')}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ── FOOTER STATUTORY NOTE ── */}
      <div className="text-center text-gray-400 text-[11px] space-y-1 font-mono pt-4 border-t border-gray-200">
        <p>PAVITHRA GOLD FINANCE • Licensed Pawnbrokers & Gold Financiers under Govt of Tamil Nadu.</p>
        <p>This statement is auto-generated in real time directly from the core ledger. Certified accurate without physical signature.</p>
      </div>

      {/* ── PDF PREVIEW MODAL ── */}
      <PDFPreviewModal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        pdfUrl={previewUrl}
        title={previewTitle}
      />
    </div>
  );
}
