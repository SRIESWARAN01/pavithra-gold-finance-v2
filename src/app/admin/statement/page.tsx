// src/app/admin/statement/page.tsx
'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
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
  Search,
  Scale,
  Percent,
  Check,
  ChevronDown,
  ArrowRight,
  PlusCircle,
  Eye
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { 
  doc, 
  onSnapshot, 
  collection, 
  query, 
  where,
  getDocs,
  orderBy
} from 'firebase/firestore';
import PDFPreviewModal from '@/components/PDFPreviewModal';
import RecordRepaymentModal from '@/components/RecordRepaymentModal';
import { getPdfApiUrl, downloadPdfDocument } from '@/lib/pdfHelper';
import { getNumericSetting } from '@/lib/db/settings';

function AdminLiveStatementContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryCustId = searchParams.get('customerId') || '';
  const queryLoanId = searchParams.get('loanId') || '';

  const [loading, setLoading] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date());
  const [justUpdated, setJustUpdated] = useState(false);
  const [configuredLtv, setConfiguredLtv] = useState<number>(75);

  useEffect(() => {
    async function loadLtvSetting() {
      try {
        const ltv = await getNumericSetting('ltv_percentage', 75);
        if (ltv > 0) setConfiguredLtv(ltv);
      } catch {}
    }
    loadLtvSetting();
  }, []);

  // Customer Search & Directory
  const [allCustomers, setAllCustomers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');

  // Core Real-time State
  const [customer, setCustomer] = useState<any>(null);
  const [loans, setLoans] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [goldCollateral, setGoldCollateral] = useState<any[]>([]);

  // Selected Loan: 'ALL' or specific loan doc id
  const [selectedLoanId, setSelectedLoanId] = useState<string>('ALL');

  // Modals State
  const [isRepaymentModalOpen, setIsRepaymentModalOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');

  // 1. Initial Load: Fetch list of customers for fast selector
  useEffect(() => {
    async function loadCustomersList() {
      try {
        const q = query(collection(db, 'profiles'), orderBy('name', 'asc'));
        const snap = await getDocs(q);
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setAllCustomers(list);

        // Auto-select from query param or pick first customer
        if (queryCustId && list.some((c) => c.id === queryCustId)) {
          setSelectedCustomerId(queryCustId);
        } else if (list.length > 0 && !selectedCustomerId) {
          setSelectedCustomerId(list[0].id);
        }
      } catch (err) {
        console.error('Failed to load customers directory:', err);
      } finally {
        setLoading(false);
      }
    }
    loadCustomersList();
  }, [queryCustId]);

  // 2. Setup Real-time Listeners (onSnapshot) for selected customer
  useEffect(() => {
    if (!selectedCustomerId) return;

    const triggerSyncPulse = () => {
      setLastSyncTime(new Date());
      setJustUpdated(true);
      setTimeout(() => setJustUpdated(false), 2000);
    };

    // A. Real-time Profile Listener
    const unsubProfile = onSnapshot(doc(db, 'profiles', selectedCustomerId), (snap) => {
      if (snap.exists()) {
        setCustomer({ id: snap.id, ...snap.data() });
        triggerSyncPulse();
      }
    });

    // B. Real-time Loans Listener
    const loansQuery = query(
      collection(db, 'loans'),
      where('customer_id', '==', selectedCustomerId)
    );
    const unsubLoans = onSnapshot(loansQuery, (snap) => {
      const loadedLoans: any[] = [];
      snap.forEach((d) => {
        loadedLoans.push({ id: d.id, ...d.data() });
      });
      loadedLoans.sort((a, b) => (b.origination_date || b.created_at || '').localeCompare(a.origination_date || a.created_at || ''));
      setLoans(loadedLoans);
      triggerSyncPulse();

      // Auto-select loan if provided in URL or if only 1 loan exists
      if (queryLoanId && loadedLoans.some((l) => l.id === queryLoanId)) {
        setSelectedLoanId(queryLoanId);
      } else if (loadedLoans.length === 1) {
        setSelectedLoanId(loadedLoans[0].id);
      } else if (selectedLoanId !== 'ALL' && !loadedLoans.some((l) => l.id === selectedLoanId)) {
        setSelectedLoanId('ALL');
      }
    });

    // C. Real-time Payments Listener
    const paymentsQuery = query(
      collection(db, 'payments'),
      where('customer_id', '==', selectedCustomerId)
    );
    const unsubPayments = onSnapshot(paymentsQuery, (snap) => {
      const loadedPmts: any[] = [];
      snap.forEach((d) => {
        loadedPmts.push({ id: d.id, ...d.data() });
      });
      loadedPmts.sort((a, b) => (b.payment_date || '').localeCompare(a.payment_date || ''));
      setPayments(loadedPmts);
      triggerSyncPulse();
    });

    // D. Real-time Gold Collateral Listener
    const goldQuery = query(
      collection(db, 'gold_collateral'),
      where('customer_id', '==', selectedCustomerId)
    );
    const unsubGold = onSnapshot(goldQuery, (snap) => {
      const loadedGold: any[] = [];
      snap.forEach((d) => {
        loadedGold.push({ id: d.id, ...d.data() });
      });
      setGoldCollateral(loadedGold);
      triggerSyncPulse();
    });

    return () => {
      if (unsubProfile) unsubProfile();
      if (unsubLoans) unsubLoans();
      if (unsubPayments) unsubPayments();
      if (unsubGold) unsubGold();
    };
  }, [selectedCustomerId, queryLoanId]);

  // Selected Loan Object (or null for Consolidated)
  const currentLoan = useMemo(() => {
    if (selectedLoanId === 'ALL') return null;
    return loans.find((l) => l.id === selectedLoanId) || null;
  }, [loans, selectedLoanId]);

  // Filtered Gold Collateral for selected loan or all loans
  const relevantGold = useMemo(() => {
    if (!currentLoan) return goldCollateral;
    return goldCollateral.filter((g) => g.loan_id === currentLoan.id);
  }, [goldCollateral, currentLoan]);

  // Filtered Payments for selected loan or all loans
  const relevantPayments = useMemo(() => {
    if (!currentLoan) return payments;
    return payments.filter((p) => p.loan_id === currentLoan.id);
  }, [payments, currentLoan]);

  // Aggregate Gold Collateral Metrics
  const collateralMetrics = useMemo(() => {
    const grossWeight = relevantGold.reduce((acc, g) => acc + (g.gross_weight || g.weight_grams || 0), 0);
    const stoneWeight = relevantGold.reduce((acc, g) => acc + (g.stone_weight || 0), 0);
    const netWeight = relevantGold.reduce((acc, g) => acc + (g.net_weight || g.weight_grams || 0), 0);
    const valuation = relevantGold.reduce((acc, g) => acc + (g.valuation_inr || 0), 0);

    // Primary purity of items
    const purities = Array.from(new Set(relevantGold.map((g) => g.purity_karat || '22K')));
    const displayPurity = purities.length > 0 ? purities.join(', ') : '22K';

    // Appraisal Gold Rate used
    const goldRates = relevantGold.map((g) => g.gold_rate_per_gram || g.market_rate_per_gram).filter(Boolean);
    const avgGoldRate = goldRates.length > 0 ? Math.round(goldRates.reduce((a, b) => a + b, 0) / goldRates.length) : 6850;

    return {
      grossWeight: Math.round(grossWeight * 100) / 100,
      stoneWeight: Math.round(stoneWeight * 100) / 100,
      netWeight: Math.round(netWeight * 100) / 100,
      valuation: Math.round(valuation),
      purity: displayPurity,
      goldRate: avgGoldRate,
      ltv: configuredLtv,
    };
  }, [relevantGold]);

  // Financial Balances & Schedule Metrics
  const financials = useMemo(() => {
    if (currentLoan) {
      const principal = currentLoan.principal_amount || 0;
      const principalPaid = currentLoan.total_principal_paid || 0;
      const remainingPrincipal = Math.max(0, principal - principalPaid);
      const interestPaid = currentLoan.total_interest_paid || 0;
      const outstandingInterest = currentLoan.outstanding_interest || 0;
      const totalOutstanding = remainingPrincipal + outstandingInterest;
      const totalAmountPaid = principalPaid + interestPaid;
      const apr = currentLoan.interest_rate_apr || 18;
      const monthlyRate = apr / 12;

      const lastPayment = relevantPayments.length > 0 ? relevantPayments[0].payment_date : null;
      const nextDueDate = currentLoan.maturity_date || currentLoan.grace_expiry_date || null;

      return {
        isConsolidated: false,
        principal,
        principalPaid,
        remainingPrincipal,
        interestPaid,
        outstandingInterest,
        totalOutstanding,
        totalAmountPaid,
        apr,
        monthlyRate,
        status: currentLoan.status || 'Active',
        loanNumber: currentLoan.loan_number,
        loanDate: currentLoan.origination_date ? new Date(currentLoan.origination_date).toLocaleDateString('en-IN') : 'N/A',
        nextDueDate: nextDueDate ? new Date(nextDueDate).toLocaleDateString('en-IN') : 'Monthly Cycle',
        lastPaymentDate: lastPayment ? new Date(lastPayment).toLocaleDateString('en-IN') : 'No payments yet',
      };
    } else {
      // Consolidated across all customer loans
      const principal = loans.reduce((acc, l) => acc + (l.principal_amount || 0), 0);
      const principalPaid = loans.reduce((acc, l) => acc + (l.total_principal_paid || 0), 0);
      const remainingPrincipal = Math.max(0, principal - principalPaid);
      const interestPaid = loans.reduce((acc, l) => acc + (l.total_interest_paid || 0), 0);
      const outstandingInterest = loans.reduce((acc, l) => acc + (l.outstanding_interest || 0), 0);
      const totalOutstanding = remainingPrincipal + outstandingInterest;
      const totalAmountPaid = principalPaid + interestPaid;
      const avgApr = loans.length > 0 ? loans.reduce((acc, l) => acc + (l.interest_rate_apr || 18), 0) / loans.length : 18;

      const lastPayment = relevantPayments.length > 0 ? relevantPayments[0].payment_date : null;

      return {
        isConsolidated: true,
        principal,
        principalPaid,
        remainingPrincipal,
        interestPaid,
        outstandingInterest,
        totalOutstanding,
        totalAmountPaid,
        apr: Math.round(avgApr * 10) / 10,
        monthlyRate: Math.round((avgApr / 12) * 10) / 10,
        status: loans.some((l) => l.status === 'Overdue') ? 'Overdue' : loans.some((l) => l.status === 'Due') ? 'Due' : 'Active',
        loanNumber: `Consolidated (${loans.length} Accounts)`,
        loanDate: 'Various Portfolio Dates',
        nextDueDate: 'Monthly Due Schedule',
        lastPaymentDate: lastPayment ? new Date(lastPayment).toLocaleDateString('en-IN') : 'No payments yet',
      };
    }
  }, [currentLoan, loans, relevantPayments]);

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

  // Customer Filter List for Dropdown Search
  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return allCustomers.slice(0, 15);
    const q = searchQuery.toLowerCase();
    return allCustomers.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.customer_number?.toLowerCase().includes(q) ||
        c.phone_primary?.includes(q)
    );
  }, [allCustomers, searchQuery]);

  // Chronological Statement of Accounts Ledger for selected loan (Requirement 17)
  const chronologicalLedger = useMemo(() => {
    if (!currentLoan) return [];

    const entries: any[] = [];
    const origDate = currentLoan.origination_date
      ? new Date(currentLoan.origination_date).toLocaleDateString('en-IN')
      : '—';
    const origPrincipal = currentLoan.principal_amount || 0;

    // 1. Origination entry
    entries.push({
      date: origDate,
      description: `Gold Loan Disbursed (${currentLoan.loan_number})`,
      openingPrincipal: 0,
      interestAccrued: 0,
      amountReceived: 0,
      interestPaid: 0,
      principalPaid: 0,
      closingPrincipal: origPrincipal,
      receiptNumber: 'Pawn Ticket',
      isCurrent: false,
    });

    // 2. Sort payments chronologically (oldest first)
    const sortedPaymentsAsc = [...relevantPayments].sort(
      (a, b) => new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime()
    );

    let runningPrincipal = origPrincipal;

    sortedPaymentsAsc.forEach((p) => {
      const openPrinc = runningPrincipal;
      const intPaid = p.interest_portion || 0;
      const princPaid = p.principal_portion || 0;
      const closePrinc = Math.max(0, openPrinc - princPaid);
      runningPrincipal = closePrinc;

      entries.push({
        date: p.payment_date ? new Date(p.payment_date).toLocaleDateString('en-IN') : '—',
        description: `Repayment via ${p.mode || 'Cash'}`,
        openingPrincipal: openPrinc,
        interestAccrued: intPaid,
        amountReceived: p.amount_paid || (intPaid + princPaid),
        interestPaid: intPaid,
        principalPaid: princPaid,
        closingPrincipal: closePrinc,
        receiptNumber: p.receipt_number || p.id?.substring(0, 8),
        isCurrent: false,
      });
    });

    // 3. Current Live Position (if loan not settled)
    if (currentLoan.status !== 'Settled' && currentLoan.status !== 'Closed') {
      entries.push({
        date: new Date().toLocaleDateString('en-IN'),
        description: 'Current Position (Live Balance & Accrued Interest)',
        openingPrincipal: runningPrincipal,
        interestAccrued: currentLoan.outstanding_interest || 0,
        amountReceived: 0,
        interestPaid: 0,
        principalPaid: 0,
        closingPrincipal: runningPrincipal,
        receiptNumber: 'Live Snapshot',
        isCurrent: true,
      });
    }

    return entries;
  }, [currentLoan, relevantPayments]);

  // PDF Action Handlers
  const handleStatementPdf = () => {
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

  const handleDownloadStatementPdf = () => {
    if (currentLoan) {
      downloadPdfDocument(
        { type: 'statement', loanId: currentLoan.id, customerId: customer?.id },
        `PGF_Statement_${currentLoan.loan_number}.pdf`
      );
    } else {
      downloadPdfDocument(
        { type: 'customer_statement', customerId: customer?.id },
        `PGF_Statement_${customer?.customer_number || 'Consolidated'}.pdf`
      );
    }
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

  const handleDownloadBillPdf = (payment: any) => {
    downloadPdfDocument(
      { type: 'receipt', paymentId: payment.id, loanId: payment.loan_id },
      `Bill_${payment.receipt_number || payment.id.substring(0, 8)}.pdf`
    );
  };

  const handlePreviewBillPdf = (payment: any) => {
    const url = getPdfApiUrl({ type: 'receipt', paymentId: payment.id, loanId: payment.loan_id });
    setPreviewUrl(url);
    setPreviewTitle(`Repayment Bill Receipt - ${payment.receipt_number || payment.id.substring(0, 8)}`);
    setPreviewOpen(true);
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Top Header & Fast Customer Selector */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold font-outfit text-gray-900">Customer Live Statement & Billing</h1>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase transition-all duration-300 ${
                  justUpdated ? 'bg-emerald-500 text-white scale-105' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Sync {lastSyncTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Real-time synchronized customer ledger, loan terms, collateral valuation, and official PDF documents.
            </p>
          </div>
        </div>

        {/* Customer Directory Selector */}
        <div className="w-full md:w-80 relative">
          <label className="text-[11px] font-bold text-gray-600 block mb-1">Select Customer Record:</label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, ID, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-300 rounded-xl text-xs font-semibold text-gray-900 outline-none focus:border-blue-600 focus:bg-white transition"
            />
          </div>

          {/* Quick Selection Dropdown when typing */}
          {searchQuery.trim() && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl max-h-56 overflow-y-auto z-30">
              {filteredCustomers.length === 0 ? (
                <div className="p-3 text-xs text-gray-500 text-center">No matching customer found</div>
              ) : (
                filteredCustomers.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setSelectedCustomerId(c.id);
                      setSearchQuery('');
                    }}
                    className={`w-full p-2.5 text-left text-xs hover:bg-blue-50 border-b border-gray-100 flex items-center justify-between transition ${
                      selectedCustomerId === c.id ? 'bg-blue-50/80 font-bold' : ''
                    }`}
                  >
                    <div>
                      <div className="text-gray-900 font-bold">{c.name}</div>
                      <div className="text-[10px] text-gray-500">{c.customer_number || 'ID: ' + c.id.substring(0, 8)} &middot; {c.phone_primary}</div>
                    </div>
                    <span className="text-[9px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded font-semibold">
                      {c.kyc_status || 'Verified'}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Customer Information Dossier Card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-bold text-xl shadow-md">
              {customer?.name ? customer.name.charAt(0).toUpperCase() : <User className="w-7 h-7" />}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-bold text-gray-900 font-outfit">{customer?.name || '—'}</h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  KYC: {customer?.kyc_status || 'Verified'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 mt-1">
                <span className="font-mono font-medium text-gray-700">
                  Customer ID: <strong className="text-blue-700">{customer?.customer_number || customer?.id || '—'}</strong>
                </span>
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3 text-gray-400" />
                  {customer?.phone_primary ? `+91 ${customer.phone_primary}` : '—'}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-gray-400" />
                  {customer?.address ? `${customer.address}${customer.city ? ', ' + customer.city : ''}${customer.pin_code ? ' - ' + customer.pin_code : ''}` : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons Bar */}
          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            {/* Record Repayment Button */}
            <button
              type="button"
              onClick={() => setIsRepaymentModalOpen(true)}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm shadow-blue-600/20 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 text-amber-300" />
              Record Repayment
            </button>

            {/* Statement PDF Button */}
            <button
              type="button"
              onClick={handleStatementPdf}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              Statement PDF
            </button>

            {/* Pawn Ticket Button */}
            <button
              type="button"
              onClick={handlePawnTicketPdf}
              className="flex-1 sm:flex-none px-4 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Pawn Ticket
            </button>
          </div>
        </div>

        {/* Extended Customer Metadata Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-gray-50/70 p-3.5 rounded-xl border border-gray-100">
          <div>
            <span className="text-gray-400 text-[10px] uppercase font-bold block">Aadhaar Status / Number</span>
            <strong className="text-gray-800 font-mono text-xs">{customer?.national_id || '—'}</strong>
          </div>
          <div>
            <span className="text-gray-400 text-[10px] uppercase font-bold block">PAN Status / Number</span>
            <strong className="text-gray-800 font-mono text-xs">{customer?.pan_number || '—'}</strong>
          </div>
          <div>
            <span className="text-gray-400 text-[10px] uppercase font-bold block">Registered Address</span>
            <span className="text-gray-700 text-xs">
              {customer?.address ? `${customer.address}${customer.city ? ', ' + customer.city : ''}${customer.pin_code ? ' - ' + customer.pin_code : ''}` : '—'}
            </span>
          </div>
        </div>

        {/* Account Tabs: Switch between loans or view consolidated portfolio */}
        <div className="flex items-center gap-2 pt-2 overflow-x-auto">
          <span className="text-xs font-bold text-gray-500 mr-2 shrink-0">Accounts:</span>
          <button
            type="button"
            onClick={() => setSelectedLoanId('ALL')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition shrink-0 ${
              selectedLoanId === 'ALL'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            All Accounts ({loans.length})
          </button>

          {loans.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => setSelectedLoanId(l.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition shrink-0 flex items-center gap-1.5 ${
                selectedLoanId === l.id
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              <span>{l.loan_number}</span>
              <span
                className={`w-2 h-2 rounded-full ${
                  l.status === 'Settled'
                    ? 'bg-emerald-400'
                    : l.status === 'Overdue'
                    ? 'bg-red-400'
                    : 'bg-amber-400'
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      {/* ── FINANCIAL SUMMARY (Dynamic from Firestore) ── */}
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
            Sum of actual disbursed principal ({loans.length} {loans.length === 1 ? 'account' : 'accounts'})
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
            Sum of actual principal payments received
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

      {/* 2-Column Live Statement Dossier: Loan Terms & Collateral vs Financial Position */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Loan Particulars & Collateral Appraisal */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h3 className="text-sm font-bold text-gray-900 font-outfit uppercase tracking-wider flex items-center gap-2">
              <Coins className="w-4 h-4 text-blue-600" />
              Loan & Collateral Particulars
            </h3>
            <span className="text-xs font-bold px-2.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full">
              Status: {financials.status}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
              <span className="text-gray-500 block text-[11px]">Loan Account Number:</span>
              <span className="text-gray-900 font-bold font-mono text-sm block mt-0.5">
                {financials.loanNumber}
              </span>
            </div>
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
              <span className="text-gray-500 block text-[11px]">Disbursal Loan Date:</span>
              <span className="text-gray-900 font-bold text-sm block mt-0.5">
                {financials.loanDate}
              </span>
            </div>
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
              <span className="text-gray-500 block text-[11px]">Principal Loan Amount:</span>
              <span className="text-gray-900 font-bold text-sm block mt-0.5">
                ₹ {financials.principal.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
              <span className="text-gray-500 block text-[11px]">Loan-to-Value (LTV):</span>
              <span className="text-blue-700 font-bold text-sm block mt-0.5">
                {collateralMetrics.ltv}% LTV
              </span>
            </div>
          </div>

          {/* Gold Collateral Specifications Box */}
          <div className="p-4 bg-amber-50/50 border border-amber-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                <Scale className="w-4 h-4 text-amber-700" />
                Pledged Gold Specifications
              </span>
              <span className="text-xs font-bold text-amber-800">
                Purity: {collateralMetrics.purity}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2 bg-white rounded-lg border border-amber-200">
                <span className="text-[10px] text-gray-500 block">Gross Weight:</span>
                <span className="text-xs font-bold text-gray-900">{collateralMetrics.grossWeight.toFixed(2)} g</span>
              </div>
              <div className="p-2 bg-white rounded-lg border border-amber-200">
                <span className="text-[10px] text-gray-500 block">Stone Weight:</span>
                <span className="text-xs font-bold text-gray-900">{collateralMetrics.stoneWeight.toFixed(2)} g</span>
              </div>
              <div className="p-2 bg-white rounded-lg border border-amber-200">
                <span className="text-[10px] text-gray-500 block">Net Gold Weight:</span>
                <span className="text-xs font-bold text-amber-900">{collateralMetrics.netWeight.toFixed(2)} g</span>
              </div>
            </div>

            <div className="flex justify-between items-center text-xs pt-1 border-t border-amber-200/60 text-amber-950">
              <span>Appraisal Gold Rate: <strong>₹{collateralMetrics.goldRate.toLocaleString('en-IN')}/g</strong></span>
              <span>Total Collateral Value: <strong>₹{collateralMetrics.valuation.toLocaleString('en-IN')}</strong></span>
            </div>
          </div>

          {/* Due Timestamps */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl">
              <span className="text-gray-500 block text-[11px] flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-blue-600" /> Next Due Date:
              </span>
              <span className="text-gray-900 font-bold text-xs block mt-1">
                {financials.nextDueDate}
              </span>
            </div>
            <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl">
              <span className="text-gray-500 block text-[11px] flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-blue-600" /> Last Payment Date:
              </span>
              <span className="text-gray-900 font-bold text-xs block mt-1">
                {financials.lastPaymentDate}
              </span>
            </div>
          </div>
        </div>

        {/* Right Column: Live Financial Balances & Interest Accounting */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-sm font-bold text-gray-900 font-outfit uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                Live Financial Summary & Dues
              </h3>
              <span className="text-xs text-gray-500">
                Interest: <strong>{financials.apr}% APR</strong> ({financials.monthlyRate.toFixed(2)}%/mo)
              </span>
            </div>

            {/* Balances Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-4 text-xs">
              <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-xl">
                <span className="text-blue-800 text-[11px] font-bold block uppercase tracking-wider">
                  Remaining Principal
                </span>
                <span className="text-lg font-bold text-blue-950 block mt-1">
                  ₹ {financials.remainingPrincipal.toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] text-blue-700 block mt-0.5">
                  Paid: ₹{financials.principalPaid.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl">
                <span className="text-amber-800 text-[11px] font-bold block uppercase tracking-wider">
                  Accrued Interest
                </span>
                <span className="text-lg font-bold text-amber-950 block mt-1">
                  ₹ {financials.outstandingInterest.toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] text-amber-700 block mt-0.5">
                  Paid: ₹{financials.interestPaid.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="p-3.5 bg-rose-50/80 border border-rose-200 rounded-xl col-span-2 sm:col-span-1">
                <span className="text-rose-800 text-[11px] font-bold block uppercase tracking-wider">
                  Total Outstanding
                </span>
                <span className="text-lg font-bold text-rose-950 block mt-1">
                  ₹ {financials.totalOutstanding.toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] text-rose-700 block mt-0.5">
                  Principal + Interest
                </span>
              </div>
            </div>

            {/* Lifetime Collections Summary */}
            <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-2 text-xs">
              <span className="font-bold text-gray-800 block text-xs">Lifetime Payment Settlement Breakdown:</span>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-gray-500 block text-[11px]">Principal Paid:</span>
                  <span className="font-bold text-emerald-700">₹ {financials.principalPaid.toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[11px]">Interest Paid:</span>
                  <span className="font-bold text-amber-700">₹ {financials.interestPaid.toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[11px]">Total Amount Paid:</span>
                  <span className="font-bold text-gray-900 text-sm">₹ {financials.totalAmountPaid.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Action Footer in Card */}
          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={handleDownloadStatementPdf}
              className="flex-1 py-2.5 px-3 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border border-gray-300"
            >
              <Download className="w-3.5 h-3.5" />
              Download Statement PDF
            </button>
            <button
              type="button"
              onClick={() => setIsRepaymentModalOpen(true)}
              className="flex-1 py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
            >
              <CreditCard className="w-3.5 h-3.5" />
              Pay Towards Loan
            </button>
          </div>
        </div>
      </div>

      {/* ── LOAN ACCOUNTS TABLE ── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
        <div className="flex justify-between items-center border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-blue-600" />
            <div>
              <h3 className="text-base font-bold text-gray-900 font-outfit">
                Loan Accounts ({loans.length})
              </h3>
              <p className="text-xs text-gray-500">
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

      {/* ── CHRONOLOGICAL STATEMENT OF ACCOUNTS / FINANCIAL LEDGER (Requirement 17) ── */}
      {currentLoan && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-gray-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <h3 className="text-base font-bold text-gray-900 font-outfit">
                  Statement of Accounts &bull; {currentLoan.loan_number}
                </h3>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Authoritative chronological ledger trail: Opening Principal &rarr; Interest Accrued &rarr; Payment Received &rarr; Interest Paid &rarr; Principal Paid &rarr; Closing Principal.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleStatementPdf}
                className="px-3 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition inline-flex items-center gap-1 border border-blue-200 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-blue-600" /> Statement PDF
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/70 text-gray-500 text-[10px] font-bold uppercase tracking-wider">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Transaction / Description</th>
                  <th className="py-2.5 px-3 text-right">Opening Principal</th>
                  <th className="py-2.5 px-3 text-right">Interest Accrued</th>
                  <th className="py-2.5 px-3 text-right">Amount Received</th>
                  <th className="py-2.5 px-3 text-right">Interest Paid</th>
                  <th className="py-2.5 px-3 text-right">Principal Paid</th>
                  <th className="py-2.5 px-3 text-right">Closing Principal</th>
                  <th className="py-2.5 px-3 text-right">Receipt / Ref</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-mono">
                {chronologicalLedger.map((row, idx) => (
                  <tr key={idx} className={`hover:bg-blue-50/30 transition ${row.isCurrent ? 'bg-amber-50/40 font-semibold' : ''}`}>
                    <td className="py-3 px-3 text-gray-600 font-sans">{row.date}</td>
                    <td className="py-3 px-3 font-medium text-gray-900 font-sans">{row.description}</td>
                    <td className="py-3 px-3 text-right text-gray-800">
                      ₹{row.openingPrincipal.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-3 text-right text-amber-700">
                      {row.interestAccrued > 0 ? `₹${row.interestAccrued.toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-gray-900">
                      {row.amountReceived > 0 ? `₹${row.amountReceived.toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td className="py-3 px-3 text-right text-amber-700">
                      {row.interestPaid > 0 ? `₹${row.interestPaid.toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td className="py-3 px-3 text-right text-emerald-700 font-bold">
                      {row.principalPaid > 0 ? `₹${row.principalPaid.toLocaleString('en-IN')}` : '—'}
                    </td>
                    <td className="py-3 px-3 text-right font-extrabold text-blue-700">
                      ₹{row.closingPrincipal.toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-3 text-right text-gray-500 font-mono text-[11px]">
                      {row.receiptNumber || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── LIFETIME REPAYMENT HISTORY ── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-gray-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-gray-900 font-outfit">
              Lifetime Repayment History ({relevantPayments.length})
            </h3>
            <p className="text-xs text-gray-500">
              All real repayment documents for the customer.
            </p>
          </div>
        </div>

        {relevantPayments.length === 0 ? (
          <div className="py-12 text-center text-gray-500 text-xs font-semibold">
            No repayment transactions found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500 uppercase text-[10px] tracking-wider bg-gray-50/70">
                  <th className="py-3 px-3">Receipt No</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Mode</th>
                  <th className="py-3 px-3 text-right">Interest Paid</th>
                  <th className="py-3 px-3 text-right">Principal Paid</th>
                  <th className="py-3 px-3 text-right">Total Amount</th>
                  <th className="py-3 px-3 text-right">Official Bill Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-mono">
                {relevantPayments.map((p) => (
                  <tr key={p.id} className="hover:bg-blue-50/30 transition">
                    <td className="py-3 px-3 font-bold text-blue-700">
                      {p.receipt_number || p.id?.substring(0, 8)}
                    </td>
                    <td className="py-3 px-3 text-gray-700 font-sans">
                      {p.payment_date ? new Date(p.payment_date).toLocaleDateString('en-IN') : '—'}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-800 font-sans">
                        {p.mode || 'Cash'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-medium text-amber-700">
                      ₹{(p.interest_portion || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-3 text-right font-medium text-emerald-700">
                      ₹{(p.principal_portion || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-gray-900 text-sm">
                      ₹{(p.amount_paid || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-3 text-right font-sans">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handlePreviewBillPdf(p)}
                          className="px-2.5 py-1 text-[11px] font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3 h-3 text-gray-500" /> View Bill
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadBillPdf(p)}
                          className="px-2.5 py-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition inline-flex items-center gap-1 border border-blue-200 cursor-pointer"
                        >
                          <Download className="w-3 h-3 text-blue-600" /> Download Bill PDF
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

      {/* Record Repayment Modal */}
      <RecordRepaymentModal
        isOpen={isRepaymentModalOpen}
        onClose={() => setIsRepaymentModalOpen(false)}
        customer={customer}
        loans={loans}
        defaultLoanId={selectedLoanId !== 'ALL' ? selectedLoanId : undefined}
      />

      {/* PDF Document Preview Modal */}
      <PDFPreviewModal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        pdfUrl={previewUrl}
        title={previewTitle}
      />
    </div>
  );
}

export default function AdminLiveStatementPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500 text-xs font-bold">Loading Live Statement...</div>}>
      <AdminLiveStatementContent />
    </Suspense>
  );
}
