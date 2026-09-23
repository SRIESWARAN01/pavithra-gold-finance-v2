'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { 
  Receipt, 
  Coins, 
  Search, 
  Printer, 
  AlertCircle, 
  CheckCircle2, 
  XCircle, 
  Download,
  FileText,
  Building2,
  Calendar,
  CreditCard,
  QrCode,
  ShieldAlert,
  Sparkles,
  ArrowRight,
  Eye,
  RefreshCw,
  Clock,
  Check,
  User,
  Image as ImageIcon
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, doc, getDoc, getDocs, query, where, limit, orderBy } from 'firebase/firestore';
import { isFirebaseConfigured, getCurrentProfile } from '@/lib/auth';
import { recordPayment, calculatePaymentSplit } from '@/lib/db/payments';
import { calculateLoanInterestSnapshot, toPaise, fromPaise } from '@/lib/db/interest';
import { getActiveBankRePledgeByLoan } from '@/lib/db/repledge';
import { createNotification } from '@/lib/db/notifications';
import PDFPreviewModal from '@/components/PDFPreviewModal';
import RePledgeCard from '@/components/RePledgeCard';
import { getPdfApiUrl, downloadPdfDocument, printPdfDocument } from '@/lib/pdfHelper';
import { exportPageToExcel } from '@/lib/excel-enterprise';
import type { GoldCollateral, BankRePledge } from '@/types/database';

function BillingContent() {
  const searchParams = useSearchParams();
  const queryLoanId = searchParams.get('loanId') || '';

  const [activeTab, setActiveTab] = useState<'collect' | 'dashboard' | 'history'>('collect');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any | null>(null);

  // Search State
  const [searchLoanNumber, setSearchLoanNumber] = useState(queryLoanId);
  const [searchMobile, setSearchMobile] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Active Loan & Collateral Data
  const [activeLoan, setActiveLoan] = useState<any | null>(null);
  const [activeCustomer, setActiveCustomer] = useState<any | null>(null);
  const [activeCollateral, setActiveCollateral] = useState<GoldCollateral[]>([]);
  const [activeRepledge, setActiveRepledge] = useState<BankRePledge | null>(null);
  const [interestSnapshot, setInterestSnapshot] = useState<any | null>(null);

  // Form State for Payment
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [interestInput, setInterestInput] = useState<number | ''>('');
  const [principalInput, setPrincipalInput] = useState<number | ''>('');
  const [amountReceived, setAmountReceived] = useState<number | ''>('');
  const [penaltyFee, setPenaltyFee] = useState<number | ''>('');
  const [discountWaiver, setDiscountWaiver] = useState<number | ''>('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [remarks, setRemarks] = useState('');
  const [lastCreatedPayment, setLastCreatedPayment] = useState<any | null>(null);

  // Confirmation Modal State
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  // PDF Preview State
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');

  // Dashboard Stats & Archive State
  const [bills, setBills] = useState<any[]>([]);
  const [archiveSearch, setArchiveSearch] = useState('');
  const [filterMode, setFilterMode] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [totalStats, setTotalStats] = useState({
    todayCollection: 0,
    totalBills: 0,
    totalRevenue: 0,
    cancelledBills: 0,
    interestCollection: 0,
    principalCollection: 0,
    penaltyCollection: 0,
  });

  // Primary Loan Search Handler
  const handleSearchLoan = async (searchTerm?: string) => {
    const term = (searchTerm || searchLoanNumber).trim();
    const mob = searchMobile.trim();

    if (!term && !mob) return;

    setSearchLoading(true);
    setSearchError(null);
    setSuccess(false);

    try {
      let foundLoan: any = null;

      if (term) {
        // 1. Search by document ID
        const docRef = doc(db, 'loans', term);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          foundLoan = { id: docSnap.id, ...docSnap.data() };
        } else {
          // 2. Search by loan_number
          const qSnap = await getDocs(
            query(collection(db, 'loans'), where('loan_number', '==', term), limit(1))
          );
          if (!qSnap.empty) {
            foundLoan = { id: qSnap.docs[0].id, ...qSnap.docs[0].data() };
          }
        }
      } else if (mob) {
        // Search by customer mobile
        const cSnap = await getDocs(
          query(collection(db, 'profiles'), where('phone_primary', '==', mob), limit(1))
        );
        if (!cSnap.empty) {
          const custId = cSnap.docs[0].id;
          const lSnap = await getDocs(
            query(collection(db, 'loans'), where('customer_id', '==', custId), limit(1))
          );
          if (!lSnap.empty) {
            foundLoan = { id: lSnap.docs[0].id, ...lSnap.docs[0].data() };
          }
        }
      }

      if (!foundLoan) {
        setSearchError(`No active loan found for '${term || mob}'. Please check the loan number.`);
        setActiveLoan(null);
        return;
      }

      // Check status
      if (['Settled', 'Closed', 'Cancelled'].includes(foundLoan.status)) {
        setSearchError(`Loan ${foundLoan.loan_number} is ${foundLoan.status}. No balance is due.`);
        setActiveLoan(null);
        return;
      }

      // Fetch Customer
      if (foundLoan.customer_id) {
        const custDoc = await getDoc(doc(db, 'profiles', foundLoan.customer_id));
        if (custDoc.exists()) {
          setActiveCustomer({ id: custDoc.id, ...custDoc.data() });
        }
      }

      // Fetch Collateral
      const colSnap = await getDocs(
        query(collection(db, 'gold_collateral'), where('loan_id', '==', foundLoan.id))
      );
      const items = colSnap.docs.map((d) => ({ id: d.id, ...d.data() } as GoldCollateral));
      setActiveCollateral(items);

      // Fetch linked Bank Re-Pledge
      try {
        const rep = await getActiveBankRePledgeByLoan(foundLoan.id);
        setActiveRepledge(rep);
      } catch {
        setActiveRepledge(null);
      }

      // Fetch Payment history for interest calculation
      const paySnap = await getDocs(
        query(collection(db, 'payments'), where('loan_id', '==', foundLoan.id))
      );
      const paymentHistory = paySnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // Calculate centralized interest snapshot
      const calcDate = paymentDate || new Date().toISOString().split('T')[0];
      const snapshot = calculateLoanInterestSnapshot(foundLoan, calcDate, paymentHistory);
      setInterestSnapshot(snapshot);
      setActiveLoan(foundLoan);

      // Default amount received to accrued interest
      const interestDue = snapshot.outstandingInterest;
      setInterestInput(interestDue > 0 ? interestDue : '');
      setPrincipalInput('');
      setAmountReceived(interestDue > 0 ? interestDue : '');
    } catch (err: any) {
      console.error('Loan search error:', err);
      setSearchError(err.message || 'Error searching loan.');
      setActiveRepledge(null);
    } finally {
      setSearchLoading(false);
    }
  };

  // Load current user profile
  useEffect(() => {
    getCurrentProfile().then(setCurrentUser).catch(() => {});
  }, []);

  // Handle URL query loanId
  useEffect(() => {
    if (queryLoanId) {
      handleSearchLoan(queryLoanId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryLoanId]);

  // Load dashboard / archive data
  const fetchBillingData = async () => {
    try {
      const pmtSnap = await getDocs(collection(db, 'payments'));
      const paymentsData: any[] = [];
      for (const d of pmtSnap.docs) {
        const p: any = { id: d.id, ...d.data() };
        if (p.loan_id) {
          const loanSnap = await getDoc(doc(db, 'loans', p.loan_id));
          if (loanSnap.exists()) p.loan = loanSnap.data();
        }
        if (p.customer_id) {
          const custSnap = await getDoc(doc(db, 'profiles', p.customer_id));
          if (custSnap.exists()) p.customer = { name: custSnap.data().name };
        }
        paymentsData.push(p);
      }

      paymentsData.sort((a: any, b: any) => (b.payment_date || '').localeCompare(a.payment_date || ''));

      const mappedBills = paymentsData.map((p: any) => ({
        id: p.id,
        paymentId: p.id,
        loanDocId: p.loan_id,
        loanNumber: p.loan?.loan_number || 'N/A',
        customerDocId: p.customer_id,
        billNo: p.receipt_number || `PGF-REC-${p.id.substring(0, 6).toUpperCase()}`,
        date: p.payment_date ? new Date(p.payment_date).toLocaleDateString('en-IN') : 'N/A',
        customer: p.customer?.name || 'Customer',
        loanId: p.loan?.loan_number || 'N/A',
        amount: p.amount_paid,
        type: (p.payment_type || 'Repayment') + ' Payment',
        mode: p.mode || 'Cash',
        status: p.status || 'Paid',
      }));

      setBills(mappedBills);

      const todayStr = new Date().toISOString().split('T')[0];
      let todayCollection = 0, totalRevenue = 0, interestCollection = 0, principalCollection = 0, penaltyCollection = 0;

      paymentsData.forEach((p: any) => {
        totalRevenue += p.amount_paid || 0;
        interestCollection += p.interest_portion || 0;
        principalCollection += p.principal_portion || 0;
        penaltyCollection += p.penalty_amount || 0;

        if (p.payment_date && p.payment_date.split('T')[0] === todayStr) {
          todayCollection += p.amount_paid || 0;
        }
      });

      setTotalStats({
        todayCollection,
        totalBills: paymentsData.length,
        totalRevenue,
        cancelledBills: paymentsData.filter((p: any) => p.status === 'REVERSED').length,
        interestCollection,
        principalCollection,
        penaltyCollection,
      });
    } catch (err) {
      console.error('Failed to load billing history:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'dashboard' || activeTab === 'history') {
      fetchBillingData();
    }
  }, [activeTab]);



  // Recalculate interest if payment date changes
  useEffect(() => {
    if (activeLoan) {
      const calcDate = paymentDate || new Date().toISOString().split('T')[0];
      const snapshot = calculateLoanInterestSnapshot(activeLoan, calcDate, []);
      setInterestSnapshot(snapshot);
    }
  }, [paymentDate, activeLoan]);

  // Financial Calculations
  const currentPrincipal = activeLoan
    ? Math.max(0, (activeLoan.principal_amount || 0) - (activeLoan.total_principal_paid || 0))
    : 0;
  const currentInterest = interestSnapshot
    ? interestSnapshot.outstandingInterest
    : (activeLoan?.outstanding_interest || 0);

  const numReceived = typeof amountReceived === 'number' ? amountReceived : 0;
  const numPenalty = typeof penaltyFee === 'number' ? penaltyFee : 0;
  const numWaiver = typeof discountWaiver === 'number' ? discountWaiver : 0;

  // Split calculations
  const split = calculatePaymentSplit(
    numReceived,
    currentInterest,
    currentPrincipal,
    numPenalty,
    numWaiver
  );

  const penaltyCleared = Math.min(numReceived, numPenalty);
  const interestCleared = split.interestPortion;
  const principalReduction = split.principalPortion;
  const newPrincipalBalance = Math.max(0, currentPrincipal - principalReduction);
  const remainingInterest = Math.max(0, currentInterest - interestCleared);
  const totalRemainingOutstanding = newPrincipalBalance + remainingInterest;

  // Re-Pledge Status
  const isRePledged = activeCollateral.some(c => 
    Boolean(c.bank_repledge_id) || 
    (c.custody_location || '').toLowerCase().includes('bank')
  ) || Boolean((activeLoan as any)?.bank_repledge_id);

  // Quick Action Setters
  const handleInterestInputChange = (val: number | '') => {
    setInterestInput(val);
    const intVal = typeof val === 'number' ? val : 0;
    const prinVal = typeof principalInput === 'number' ? principalInput : 0;
    const penVal = typeof penaltyFee === 'number' ? penaltyFee : 0;
    const waivVal = typeof discountWaiver === 'number' ? discountWaiver : 0;
    setAmountReceived(Math.max(0, intVal + prinVal + penVal - waivVal));
  };

  const handlePrincipalInputChange = (val: number | '') => {
    setPrincipalInput(val);
    const intVal = typeof interestInput === 'number' ? interestInput : 0;
    const prinVal = typeof val === 'number' ? val : 0;
    const penVal = typeof penaltyFee === 'number' ? penaltyFee : 0;
    const waivVal = typeof discountWaiver === 'number' ? discountWaiver : 0;
    setAmountReceived(Math.max(0, intVal + prinVal + penVal - waivVal));
  };

  const handleTotalAmountChange = (val: number | '') => {
    setAmountReceived(val);
    if (typeof val === 'number' && val > 0) {
      const liveSplit = calculatePaymentSplit(
        val,
        currentInterest,
        currentPrincipal,
        typeof penaltyFee === 'number' ? penaltyFee : 0,
        typeof discountWaiver === 'number' ? discountWaiver : 0
      );
      setInterestInput(liveSplit.interestPortion);
      setPrincipalInput(liveSplit.principalPortion);
    } else {
      setInterestInput('');
      setPrincipalInput('');
    }
  };

  const setPayInterestOnly = () => {
    setInterestInput(currentInterest);
    setPrincipalInput(0);
    const penVal = typeof penaltyFee === 'number' ? penaltyFee : 0;
    const waivVal = typeof discountWaiver === 'number' ? discountWaiver : 0;
    setAmountReceived(Math.max(0, currentInterest + penVal - waivVal));
  };

  const setPayInterestPlusPrincipal = (prinAmount = 100) => {
    setInterestInput(currentInterest);
    setPrincipalInput(prinAmount);
    const penVal = typeof penaltyFee === 'number' ? penaltyFee : 0;
    const waivVal = typeof discountWaiver === 'number' ? discountWaiver : 0;
    setAmountReceived(Math.max(0, currentInterest + prinAmount + penVal - waivVal));
  };

  const setPayFullSettlement = () => {
    setInterestInput(currentInterest);
    setPrincipalInput(currentPrincipal);
    const penVal = typeof penaltyFee === 'number' ? penaltyFee : 0;
    const waivVal = typeof discountWaiver === 'number' ? discountWaiver : 0;
    setAmountReceived(Math.max(0, currentInterest + currentPrincipal + penVal - waivVal));
  };

  // Confirmation Trigger
  const handleOpenConfirmModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLoan) return;
    if (numReceived <= 0) {
      alert('Please enter a valid amount received greater than zero.');
      return;
    }
    setIsConfirmModalOpen(true);
  };

  // Atomic Payment Execution
  const handleConfirmAndPostPayment = async () => {
    setIsConfirmModalOpen(false);
    setLoading(true);

    try {
      const idempotencyKey = `pmt_${activeLoan.id}_${Date.now()}`;
      const paymentRecord = await recordPayment({
        loan_id: activeLoan.id,
        customer_id: activeCustomer?.id || activeLoan.customer_id,
        amount_paid: numReceived,
        interest_portion: interestCleared,
        principal_portion: principalReduction,
        penalty_amount: penaltyCleared,
        waiver_amount: numWaiver,
        payment_type: principalReduction > 0 ? (newPrincipalBalance === 0 ? 'Full_Settlement' : 'Principal') : 'Interest',
        mode: paymentMode as any,
        remarks: remarks || `Interest and principal collection at counter`,
        transaction_ref: referenceNumber,
        idempotency_key: idempotencyKey,
        calculation_snapshot: interestSnapshot,
      });

      setLastCreatedPayment(paymentRecord);
      setSuccess(true);

      // Notification
      if (activeCustomer?.id) {
        await createNotification({
          recipient_id: activeCustomer.id,
          type: 'Payment_Received',
          title: `Payment Receipt: ${paymentRecord.receipt_number}`,
          message: `Received ₹${numReceived.toLocaleString('en-IN')} for loan ${activeLoan.loan_number}. Interest cleared: ₹${interestCleared.toLocaleString('en-IN')}, Principal reduction: ₹${principalReduction.toLocaleString('en-IN')}.`,
        });
      }

      // Refresh loan details
      await handleSearchLoan(activeLoan.id);
    } catch (err: any) {
      console.error('Payment posting error:', err);
      alert(err.message || 'Failed to post financial payment.');
    } finally {
      setLoading(false);
    }
  };

  const filteredBills = bills.filter(b => {
    const matchesSearch = b.customer.toLowerCase().includes(archiveSearch.toLowerCase()) || 
                          b.billNo.toLowerCase().includes(archiveSearch.toLowerCase()) ||
                          b.loanId.toLowerCase().includes(archiveSearch.toLowerCase());
    const matchesMode = filterMode === 'All' || b.mode === filterMode;
    const matchesStatus = filterStatus === 'All' || b.status === filterStatus;
    return matchesSearch && matchesMode && matchesStatus;
  });

  return (
    <div className="space-y-6 pb-16">
      {/* Top Banner & Tab Navigation */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Receipt size={22} />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight font-outfit">
              Interest Collection & Cash Counter
            </h1>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Collect interest, adjust principal with excess payments, issue official A4 and 80mm POS receipts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/admin/renewal"
            className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
          >
            <RefreshCw size={14} />
            <span>Loan Renewal</span>
          </Link>
          <div className="flex bg-white p-1 rounded-lg border border-gray-200 text-xs shadow-sm">
            <button
              onClick={() => { setActiveTab('collect'); setSuccess(false); }}
              className={`px-3.5 py-1.5 rounded-md font-semibold transition ${
                activeTab === 'collect' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Collect Payment
            </button>
            <button
              onClick={() => { setActiveTab('dashboard'); setSuccess(false); }}
              className={`px-3.5 py-1.5 rounded-md font-semibold transition ${
                activeTab === 'dashboard' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Analytics
            </button>
            <button
              onClick={() => { setActiveTab('history'); setSuccess(false); }}
              className={`px-3.5 py-1.5 rounded-md font-semibold transition ${
                activeTab === 'history' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Bills Archive
            </button>
          </div>
        </div>
      </div>

      {/* COLLECT PAYMENT VIEW */}
      {activeTab === 'collect' && (
        <div className="space-y-6">
          {/* Prominent Search Bar */}
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-3">
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
              <Search size={14} className="text-blue-600" />
              Loan Account Search
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="relative sm:col-span-2">
                <input
                  type="text"
                  placeholder="Enter Loan Number (e.g. PGF-LN-1001)..."
                  value={searchLoanNumber}
                  onChange={(e) => setSearchLoanNumber(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSearchLoan(); }}
                  className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 focus:border-blue-600 focus:bg-white text-gray-900 rounded-lg text-xs outline-none transition font-medium"
                />
                <Search size={15} className="absolute left-3 top-3 text-gray-400" />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={searchLoading}
                  onClick={() => handleSearchLoan()}
                  className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {searchLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Search size={14} />
                      Find Loan
                    </>
                  )}
                </button>
                {activeLoan && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveLoan(null);
                      setActiveCustomer(null);
                      setActiveCollateral([]);
                      setSearchLoanNumber('');
                      setSuccess(false);
                    }}
                    className="px-3.5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold transition"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {searchError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-xs flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0 text-rose-600" />
                <span>{searchError}</span>
              </div>
            )}
          </div>

          {/* Customer Dossier & Collateral Overview */}
          {activeLoan && !success && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Customer Info Card */}
              <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div className="flex items-center gap-2">
                    <User size={16} className="text-blue-600" />
                    <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">Customer Dossier</h3>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    KYC {activeCustomer?.kyc_status || 'Verified'}
                  </span>
                </div>

                {/* Customer Photo & Quick Header */}
                <div className="flex items-center gap-3.5 pb-2 border-b border-gray-100">
                  <div className="w-14 h-14 rounded-full bg-gray-100 border border-blue-200 flex items-center justify-center text-blue-600 font-bold text-lg font-outfit uppercase overflow-hidden shadow-xs">
                    {activeCustomer?.photo_url ? (
                      <img
                        src={activeCustomer.photo_url}
                        alt={activeCustomer.name || 'Customer'}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      (activeCustomer?.name || 'CU').substring(0, 2)
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 text-sm">{activeCustomer?.name || 'Customer'}</h4>
                    <p className="text-[11px] text-gray-500 font-mono">ID: {activeCustomer?.customer_number || activeCustomer?.id || '—'}</p>
                    <p className="text-[11px] text-blue-600 font-semibold font-mono">+91 {activeCustomer?.phone_primary || '—'}</p>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Address:</span>
                    <span className="font-medium text-gray-900 text-right max-w-[60%] truncate">
                      {activeCustomer?.address ? `${activeCustomer.address}${activeCustomer.city ? ', ' + activeCustomer.city : ''}` : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Aadhaar (National ID):</span>
                    <span className="font-mono text-gray-900">
                      {activeCustomer?.national_id ? activeCustomer.national_id.replace(/.(?=.{4})/g, '*') : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">PAN Number:</span>
                    <span className="font-mono text-gray-900">{activeCustomer?.pan_number || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Nominee:</span>
                    <span className="text-gray-900 font-medium">
                      {activeCustomer?.nominee_name ? `${activeCustomer.nominee_name} (${activeCustomer.nominee_relation || 'Nominee'})` : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-gray-100 pt-2">
                    <span className="text-gray-500">Branch:</span>
                    <span className="text-gray-900 font-semibold">{activeLoan.branch_name || 'Madurai Main'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Pledge Date:</span>
                    <span className="text-gray-900 font-mono">
                      {activeLoan.origination_date ? new Date(activeLoan.origination_date).toLocaleDateString('en-IN') : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Maturity Date:</span>
                    <span className="text-gray-900 font-mono">
                      {activeLoan.maturity_date ? new Date(activeLoan.maturity_date).toLocaleDateString('en-IN') : '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Financial Balance Summary Card */}
              <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 shadow-sm lg:col-span-2">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Coins size={14} className="text-blue-600" />
                    Current Loan Balance &amp; Dynamically Computed Dues
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    {activeLoan.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <span className="text-[10px] text-gray-500 uppercase block font-medium">Sanctioned Principal</span>
                    <span className="text-sm font-bold text-gray-900 block mt-0.5 font-outfit">
                      ₹{(activeLoan.principal_amount || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <span className="text-[10px] text-blue-700 uppercase block font-bold">Remaining Principal</span>
                    <span className="text-sm font-bold text-blue-900 block mt-0.5 font-outfit">
                      ₹{currentPrincipal.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
                    <span className="text-[10px] text-amber-700 uppercase block font-bold">Accrued Interest Due</span>
                    <span className="text-sm font-bold text-amber-900 block mt-0.5 font-outfit">
                      ₹{currentInterest.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                    <span className="text-[10px] text-emerald-700 uppercase block font-bold">Annual Rate (APR)</span>
                    <span className="text-sm font-bold text-emerald-900 block mt-0.5 font-outfit">
                      {activeLoan.interest_rate_apr || 18}% p.a.
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
                  <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                    <span className="text-[10px] text-gray-500 uppercase block">Days Elapsed:</span>
                    <strong className="text-gray-900 font-mono text-xs">{interestSnapshot?.daysElapsed || 0} Days</strong>
                  </div>
                  <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                    <span className="text-[10px] text-gray-500 uppercase block">Months Completed:</span>
                    <strong className="text-gray-900 font-mono text-xs">
                      {interestSnapshot?.monthsCompleted || 0} Mos ({interestSnapshot?.fractionalMonths || 0} mos)
                    </strong>
                  </div>
                  <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                    <span className="text-[10px] text-gray-500 uppercase block">Interest Already Paid:</span>
                    <strong className="text-emerald-700 font-mono text-xs">₹{(activeLoan.total_interest_paid || 0).toLocaleString('en-IN')}</strong>
                  </div>
                  <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                    <span className="text-[10px] text-gray-500 uppercase block">Penalty / Late Fee:</span>
                    <strong className="text-rose-600 font-mono text-xs">₹{(activeLoan.penalty_amount || 0).toLocaleString('en-IN')}</strong>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-xs text-gray-600 pt-3 border-t border-gray-100 gap-2">
                  <span className="text-gray-500">
                    Contractual daily simple interest calculation (365/366 leap-year compliant)
                  </span>
                  <span className="font-bold text-blue-700 text-sm">
                    Total Due: ₹{(currentPrincipal + currentInterest + (activeLoan.penalty_amount || 0)).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Pledged Ornaments Collateral Display */}
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm lg:col-span-3 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-100 pb-2 gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                      Pledged Gold Collateral ({activeCollateral.length} Ornaments)
                    </h3>
                    {isRePledged && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 animate-pulse">
                        Re-Pledged with Bank
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 font-mono">
                    Vault Bin: {activeCollateral[0]?.storage_bin_id || 'VAULT-TRAY-A1'}
                  </span>
                </div>

                {/* Bank Re-Pledge Status Notice */}
                {isRePledged && (
                  <div className="p-3 bg-amber-50/90 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
                    <ShieldAlert size={16} className="text-amber-700 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <strong className="text-amber-950">Bank Custody Notice:</strong>
                        <span className="font-mono text-[11px] text-amber-800">
                          {activeCollateral[0]?.custody_location || 'Institutional Bank Vault'}
                        </span>
                      </div>
                      <p className="text-[11px] text-amber-800 leading-relaxed">
                        Collateral is currently re-pledged with an institutional bank. Customer interest and principal payments update the customer ledger normally. Upon full settlement, collateral release to the customer requires bank re-pledge settlement and physical return to PGF Safe.
                      </p>
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border border-gray-200 rounded-lg overflow-hidden">
                    <thead className="bg-gray-50 text-gray-700 font-semibold border-b border-gray-200">
                      <tr>
                        <th className="p-3">#</th>
                        <th className="p-3">Ornament &amp; Photos</th>
                        <th className="p-3">Purity</th>
                        <th className="p-3">Gross Wt</th>
                        <th className="p-3">Stone Wt</th>
                        <th className="p-3">Net Wt</th>
                        <th className="p-3">Valuation</th>
                        <th className="p-3">Vault / Custody</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {activeCollateral.map((item, idx) => (
                        <tr key={item.id || idx} className="hover:bg-gray-50">
                          <td className="p-3 font-semibold">{idx + 1}</td>
                          <td className="p-3">
                            <div className="flex items-center gap-2.5">
                              {item.front_photo_url ? (
                                <img
                                  src={item.front_photo_url}
                                  alt="Collateral"
                                  className="w-9 h-9 object-cover rounded-md border border-gray-200 cursor-pointer shadow-2xs hover:scale-105 transition"
                                  onClick={() => window.open(item.front_photo_url!, '_blank')}
                                />
                              ) : (
                                <div className="w-9 h-9 rounded-md bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                                  <Coins size={15} />
                                </div>
                              )}
                              <div>
                                <span className="font-semibold text-gray-900 block">
                                  {item.item_description || item.ornament_type || 'Gold Ornament'}
                                </span>
                                <span className="text-[10px] text-gray-400 font-mono">
                                  Qty: {item.quantity || 1} &middot; {item.hallmark ? 'BIS 916 Hallmark' : 'Traditional'}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="p-3 font-semibold text-amber-700">{item.purity_karat || '22K'}</td>
                          <td className="p-3 font-mono">{(item.gross_weight || 0).toFixed(2)}g</td>
                          <td className="p-3 font-mono text-red-500">{(item.stone_weight || 0).toFixed(2)}g</td>
                          <td className="p-3 font-bold text-gray-900 font-mono">{(item.net_weight || 0).toFixed(2)}g</td>
                          <td className="p-3 font-semibold text-emerald-700 font-mono">
                            ₹{(item.valuation_inr || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              (item.custody_location || '').toLowerCase().includes('bank')
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}>
                              {item.custody_location || 'PGF Safe Vault'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bank Re-Pledge Details Card (Prominent unified card) */}
              <div className="lg:col-span-3">
                <RePledgeCard
                  loan={activeLoan}
                  repledge={activeRepledge}
                  collateral={activeCollateral}
                  onRefresh={() => handleSearchLoan(activeLoan.id)}
                />
              </div>

              {/* Payment Collection Form */}
              <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm lg:col-span-3 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-100 pb-3 gap-3">
                  <div>
                    <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                      Payment Collection &amp; Real-Time Allocation
                    </h3>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      Statutory Rule: Payment clears Penalty first, then Interest, with excess directly reducing Principal Balance.
                    </p>
                  </div>

                  {/* Quick Action Presets */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={setPayInterestOnly}
                      className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-xs font-bold border border-amber-200 transition cursor-pointer"
                    >
                      Pay Interest Only (₹{currentInterest.toLocaleString('en-IN')})
                    </button>
                    <button
                      type="button"
                      onClick={() => setPayInterestPlusPrincipal(100)}
                      className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold border border-blue-200 transition cursor-pointer"
                    >
                      Pay Interest + ₹100 Principal
                    </button>
                    <button
                      type="button"
                      onClick={setPayFullSettlement}
                      className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg text-xs font-bold border border-emerald-200 transition cursor-pointer"
                    >
                      Full Settlement (₹{(currentPrincipal + currentInterest).toLocaleString('en-IN')})
                    </button>
                  </div>
                </div>

                <form onSubmit={handleOpenConfirmModal} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-4 text-xs">
                    <div className="space-y-1.5">
                      <label className="text-gray-700 font-semibold">Payment Date *</label>
                      <input
                        type="date"
                        value={paymentDate}
                        onChange={(e) => setPaymentDate(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 outline-none focus:border-blue-600 font-medium"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-amber-800 font-semibold flex items-center justify-between">
                        <span>Interest Amount (₹)</span>
                        <span className="text-[10px] text-gray-400">Due: ₹{currentInterest.toLocaleString('en-IN')}</span>
                      </label>
                      <input
                        type="number"
                        placeholder="0"
                        value={interestInput}
                        onChange={(e) => handleInterestInputChange(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 font-bold outline-none focus:border-blue-600"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-blue-800 font-semibold flex items-center justify-between">
                        <span>Principal Reduction (₹)</span>
                        <span className="text-[10px] text-gray-400">Bal: ₹{currentPrincipal.toLocaleString('en-IN')}</span>
                      </label>
                      <input
                        type="number"
                        placeholder="e.g. 100"
                        value={principalInput}
                        onChange={(e) => handlePrincipalInputChange(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-blue-900 font-bold outline-none focus:border-blue-600"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-gray-900 font-bold flex items-center justify-between">
                        <span>Total Received (₹) *</span>
                        <span className="text-[10px] text-blue-600 font-normal">Auto-summed</span>
                      </label>
                      <input
                        type="number"
                        placeholder="0"
                        required
                        value={amountReceived}
                        onChange={(e) => handleTotalAmountChange(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full bg-blue-50/50 border border-blue-300 rounded-lg px-3 py-2 text-blue-950 font-extrabold text-sm outline-none focus:border-blue-600"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-gray-700 font-semibold">Payment Mode *</label>
                      <select
                        value={paymentMode}
                        onChange={(e) => setPaymentMode(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 outline-none focus:border-blue-600 font-medium"
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
                      <label className="text-gray-700 font-semibold">Penalty / Late Fee (₹)</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={penaltyFee}
                        onChange={(e) => setPenaltyFee(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 outline-none focus:border-blue-600"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-gray-700 font-semibold">Approved Waiver (₹)</label>
                      <input
                        type="number"
                        placeholder="0"
                        value={discountWaiver}
                        onChange={(e) => setDiscountWaiver(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 outline-none focus:border-blue-600"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-gray-700 font-semibold">Transaction / UTR Reference</label>
                      <input
                        type="text"
                        placeholder="e.g. UPI-REF-9842"
                        value={referenceNumber}
                        onChange={(e) => setReferenceNumber(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 outline-none focus:border-blue-600"
                      />
                    </div>

                    <div className="space-y-1.5 sm:col-span-3 lg:col-span-4">
                      <label className="text-gray-700 font-semibold">Remarks / Internal Comments</label>
                      <input
                        type="text"
                        placeholder="e.g. Customer interest payment with ₹100 principal reduction"
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-900 outline-none focus:border-blue-600"
                      />
                    </div>
                  </div>

                  {/* Real-time Allocation Box */}
                  <div className="bg-blue-50/50 border border-blue-200 rounded-xl p-4 space-y-3">
                    <span className="text-xs font-bold text-blue-900 uppercase tracking-wider block">
                      Live Repayment Allocation Split (Penalty → Interest → Principal)
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="bg-white p-2.5 rounded-lg border border-blue-100">
                        <span className="text-gray-500 block text-[10px]">Penalty Cleared</span>
                        <span className="font-bold text-gray-900 block mt-0.5 font-mono">₹{penaltyCleared.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-blue-100">
                        <span className="text-gray-500 block text-[10px]">Interest Cleared</span>
                        <span className="font-bold text-emerald-700 block mt-0.5 font-mono">₹{interestCleared.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-blue-100">
                        <span className="text-gray-500 block text-[10px]">Principal Reduction</span>
                        <span className="font-bold text-blue-700 block mt-0.5 font-mono">₹{principalReduction.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="bg-white p-2.5 rounded-lg border border-blue-100">
                        <span className="text-gray-500 block text-[10px]">New Principal Balance</span>
                        <span className="font-bold text-gray-900 block mt-0.5 font-mono">₹{newPrincipalBalance.toLocaleString('en-IN')}</span>
                      </div>
                    </div>

                    {principalReduction > 0 && (
                      <div className="p-2.5 bg-blue-100/70 border border-blue-200 rounded-lg text-[11px] text-blue-950 flex items-center gap-2">
                        <Sparkles size={14} className="text-blue-700 shrink-0" />
                        <span>
                          <strong>Principal Reduction:</strong> ₹{principalReduction.toLocaleString('en-IN')} will be deducted immediately from Principal Balance (₹{currentPrincipal.toLocaleString('en-IN')} → ₹{newPrincipalBalance.toLocaleString('en-IN')}). Next day&apos;s interest will accrue strictly on <strong>₹{newPrincipalBalance.toLocaleString('en-IN')}</strong>.
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={loading || numReceived <= 0}
                      className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-2 shadow-sm cursor-pointer disabled:opacity-50"
                    >
                      <Receipt size={15} />
                      <span>Review &amp; Post Repayment</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Success Screen after posting */}
          {success && lastCreatedPayment && activeLoan && (
            <div className="bg-white border border-gray-200 rounded-xl p-8 text-center space-y-5 shadow-sm max-w-lg mx-auto">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 size={36} />
              </div>

              <div className="space-y-1">
                <h2 className="text-xl font-bold text-gray-900 font-outfit">
                  Repayment Posted Successfully!
                </h2>
                <p className="text-xs text-gray-500">
                  Official Receipt No: <span className="font-mono font-bold text-gray-800">{lastCreatedPayment.receipt_number}</span>
                </p>
              </div>

              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-xs space-y-2 text-left">
                <div className="flex justify-between">
                  <span className="text-gray-500">Total Received:</span>
                  <span className="font-bold text-gray-900">₹{numReceived.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Interest Cleared:</span>
                  <span className="font-bold text-emerald-700">₹{interestCleared.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Principal Paid:</span>
                  <span className="font-bold text-blue-700">₹{principalReduction.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between border-t border-gray-200 pt-2 font-bold">
                  <span className="text-gray-900">Remaining Principal:</span>
                  <span className="text-gray-900">₹{newPrincipalBalance.toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Receipt Buttons */}
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setPreviewUrl(
                      getPdfApiUrl({
                        type: 'receipt',
                        loanId: activeLoan.id,
                        paymentId: lastCreatedPayment.id,
                      })
                    );
                    setPreviewTitle(`A4 Payment Receipt - ${lastCreatedPayment.receipt_number}`);
                    setIsPreviewOpen(true);
                  }}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Printer size={14} />
                  <span>Print A4 Receipt</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPreviewUrl(
                      getPdfApiUrl({
                        type: 'receipt',
                        loanId: activeLoan.id,
                        paymentId: lastCreatedPayment.id,
                        format: 'thermal',
                      })
                    );
                    setPreviewTitle(`80mm Thermal Receipt - ${lastCreatedPayment.receipt_number}`);
                    setIsPreviewOpen(true);
                  }}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Printer size={14} />
                  <span>Print 80mm Thermal</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    downloadPdfDocument(
                      {
                        type: 'receipt',
                        loanId: activeLoan.id,
                        paymentId: lastCreatedPayment.id,
                      },
                      `PGF_Receipt_${lastCreatedPayment.receipt_number}.pdf`
                    );
                  }}
                  className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition flex items-center gap-1.5 border border-gray-200"
                >
                  <Download size={14} />
                  <span>Download PDF</span>
                </button>
              </div>

              <div className="pt-3 border-t border-gray-100 flex justify-center gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setSuccess(false);
                    setAmountReceived('');
                    setRemarks('');
                    setReferenceNumber('');
                  }}
                  className="text-xs font-semibold text-blue-600 hover:underline"
                >
                  Record Another Payment
                </button>
                <Link
                  href={`/admin/loans/${activeLoan.id}`}
                  className="text-xs font-semibold text-gray-600 hover:text-gray-900"
                >
                  View Loan Details &rarr;
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* DASHBOARD TAB VIEW */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-2 shadow-sm">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider block font-semibold">Today&apos;s Collections</span>
              <span className="text-xl font-bold text-gray-900 block">₹{totalStats.todayCollection.toLocaleString('en-IN')}</span>
              <span className="text-[10px] text-emerald-600 font-medium">Live sync active</span>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-2 shadow-sm">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider block font-semibold">Receipts Posted</span>
              <span className="text-xl font-bold text-gray-900 block">{totalStats.totalBills} Bills</span>
              <span className="text-[10px] text-gray-500">All channels active</span>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-2 shadow-sm">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider block font-semibold">Total Revenue</span>
              <span className="text-xl font-bold text-blue-600 block">₹{totalStats.totalRevenue.toLocaleString('en-IN')}</span>
              <span className="text-[10px] text-blue-600 font-semibold">Interest + Principal</span>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-2 shadow-sm">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider block font-semibold">Cancelled / Reversed</span>
              <span className="text-xl font-bold text-rose-500 block">{totalStats.cancelledBills} Bills</span>
              <span className="text-[10px] text-rose-500">Audited status</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 shadow-sm">
              <h3 className="text-xs font-bold text-blue-600 uppercase tracking-wider border-b border-gray-100 pb-2">Revenue Breakdowns</h3>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Interest Collections:</span>
                  <span className="text-gray-900 font-semibold">₹{totalStats.interestCollection.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Principal Repayments:</span>
                  <span className="text-gray-900 font-semibold">₹{totalStats.principalCollection.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Penalty / Fees Collected:</span>
                  <span className="text-gray-900 font-semibold">₹{totalStats.penaltyCollection.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4 shadow-sm">
              <h3 className="text-xs font-bold text-blue-600 uppercase tracking-wider border-b border-gray-100 pb-2">Billing Ledger Reports</h3>
              <p className="text-gray-500 text-xs leading-relaxed">Download aggregate billing history collections report instantly.</p>
              <div className="flex gap-3">
                <button 
                  type="button"
                  onClick={() => {
                    if (bills.length === 0) {
                      alert('No billing records found to export for the ledger.');
                      return;
                    }
                    exportPageToExcel(bills, `PGF_Daily_Collection_Ledger_${new Date().toISOString().split('T')[0]}`, 'Billing Ledger');
                  }}
                  className="px-4 py-2 rounded bg-gray-50 hover:bg-gray-100 border border-gray-200 text-blue-600 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Download size={14} />
                  Export Daily Collection Ledger (Excel)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BILLING HISTORY TAB VIEW */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div className="relative md:col-span-2">
              <input 
                type="text"
                placeholder="Search by Bill No, Customer, Loan ID..."
                value={archiveSearch}
                onChange={(e) => setArchiveSearch(e.target.value)}
                className="w-full bg-white border border-gray-200 focus:border-blue-600 text-gray-900 text-xs rounded-lg pl-10 pr-4 py-2.5 outline-none"
              />
              <Search size={14} className="absolute left-3 top-3.5 text-gray-500" />
            </div>

            <div>
              <select
                value={filterMode}
                onChange={(e) => setFilterMode(e.target.value)}
                className="w-full bg-white border border-gray-200 focus:border-blue-600 text-gray-900 text-xs rounded-lg px-3 py-2.5 outline-none"
              >
                <option value="All">All Payment Modes</option>
                <option value="UPI">UPI</option>
                <option value="Cash">Cash</option>
                <option value="Debit Card">Debit Card</option>
                <option value="Bank Transfer">Bank Transfer</option>
              </select>
            </div>

            <div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full bg-white border border-gray-200 focus:border-blue-600 text-gray-900 text-xs rounded-lg px-3 py-2.5 outline-none"
              >
                <option value="All">All Statuses</option>
                <option value="POSTED">Posted</option>
                <option value="REVERSED">Reversed</option>
              </select>
            </div>
          </div>

          {/* Billing table ledger grid */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm text-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[700px]">
                <thead>
                  <tr className="text-gray-400 uppercase tracking-wider border-b border-gray-200 bg-gray-50">
                    <th className="p-4 font-semibold">Bill No</th>
                    <th className="p-4 font-semibold hidden md:table-cell">Date</th>
                    <th className="p-4 font-semibold">Customer (Loan ID)</th>
                    <th className="p-4 font-semibold hidden lg:table-cell">Type</th>
                    <th className="p-4 font-semibold hidden md:table-cell">Mode</th>
                    <th className="p-4 font-semibold">Amount</th>
                    <th className="p-4 font-semibold">Status</th>
                    <th className="p-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-600">
                  {filteredBills.map((b) => (
                    <tr key={b.id} className="hover:bg-gray-50 transition">
                      <td className="p-4 font-mono font-semibold text-gray-900">{b.billNo}</td>
                      <td className="p-4 hidden md:table-cell">{b.date}</td>
                      <td className="p-4">
                        <span className="font-semibold text-gray-900 block">{b.customer}</span>
                        <span className="text-[10px] text-gray-400 font-mono">{b.loanId}</span>
                      </td>
                      <td className="p-4 hidden lg:table-cell">{b.type}</td>
                      <td className="p-4 hidden md:table-cell">{b.mode}</td>
                      <td className="p-4 font-semibold text-blue-600">₹{b.amount.toLocaleString('en-IN')}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          b.status === 'POSTED' || b.status === 'Paid' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' :
                          'bg-rose-50 text-rose-500 border border-rose-200'
                        }`}>
                          {b.status}
                        </span>
                      </td>
                      <td className="p-4 text-right flex justify-end items-center gap-1.5 mt-1">
                        <button 
                          onClick={() => {
                            const url = getPdfApiUrl({
                              type: 'receipt',
                              paymentId: b.paymentId || b.id,
                              amount: b.amount,
                            });
                            setPreviewUrl(url);
                            setPreviewTitle(`Official Payment Receipt - ${b.billNo}`);
                            setIsPreviewOpen(true);
                          }}
                          className="p-1.5 rounded bg-blue-50 hover:bg-blue-100 text-blue-600 transition cursor-pointer"
                          title="Preview Receipt"
                        >
                          <Printer size={13} />
                        </button>
                        <button 
                          onClick={() => {
                            downloadPdfDocument({
                              type: 'receipt',
                              paymentId: b.paymentId || b.id,
                              amount: b.amount,
                            }, `PGF_Receipt_${b.billNo}.pdf`);
                          }}
                          className="p-1.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 transition cursor-pointer"
                          title="Download PDF"
                        >
                          <Download size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* PAYMENT CONFIRMATION MODAL */}
      {isConfirmModalOpen && activeLoan && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-gray-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                  <Receipt size={18} />
                </span>
                <h3 className="font-bold text-gray-900 text-sm">Confirm Payment Posting</h3>
              </div>
              <button
                onClick={() => setIsConfirmModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                &times;
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Loan Account:</span>
                  <span className="font-bold text-gray-900">{activeLoan.loan_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Borrower:</span>
                  <span className="font-semibold text-gray-900">{activeCustomer?.name || 'Customer'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Payment Date:</span>
                  <span className="font-mono text-gray-900">{paymentDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Payment Mode:</span>
                  <span className="text-gray-900 font-semibold">{paymentMode} {referenceNumber ? `(Ref: ${referenceNumber})` : ''}</span>
                </div>
              </div>

              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200 space-y-2">
                <div className="flex justify-between text-gray-700">
                  <span>Previous Principal Balance:</span>
                  <span className="font-bold text-gray-900 font-mono">₹{currentPrincipal.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between font-bold text-blue-900 border-t border-blue-100 pt-1.5">
                  <span>Total Received:</span>
                  <span className="font-mono">₹{numReceived.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-emerald-800">
                  <span>Interest Cleared:</span>
                  <span className="font-mono font-semibold">₹{interestCleared.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-blue-800">
                  <span>Principal Reduction:</span>
                  <span className="font-mono font-bold">₹{principalReduction.toLocaleString('en-IN')}</span>
                </div>
                {penaltyCleared > 0 && (
                  <div className="flex justify-between text-amber-800">
                    <span>Penalty Paid:</span>
                    <span className="font-mono">₹{penaltyCleared.toLocaleString('en-IN')}</span>
                  </div>
                )}
                {numWaiver > 0 && (
                  <div className="flex justify-between text-purple-800">
                    <span>Approved Waiver:</span>
                    <span className="font-mono">₹{numWaiver.toLocaleString('en-IN')}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-blue-200 pt-2 font-bold text-gray-900">
                  <span>New Principal Balance:</span>
                  <span className="font-mono text-blue-900 text-sm">₹{newPrincipalBalance.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-gray-600 text-[11px]">
                  <span>Remaining Outstanding Interest:</span>
                  <span className="font-mono font-semibold">₹{remainingInterest.toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 flex items-start gap-2">
                <AlertCircle size={15} className="shrink-0 text-amber-600 mt-0.5" />
                <span>
                  <strong>Important:</strong> Please verify the payment allocation before confirming. Once posted, financial corrections require authorized reversal.
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleConfirmAndPostPayment}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
              >
                {loading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Posting...</span>
                  </>
                ) : (
                  <>
                    <Check size={14} />
                    <span>Confirm & Post</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Embedded PDF Preview Modal */}
      <PDFPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        pdfUrl={previewUrl}
        title={previewTitle}
      />
    </div>
  );
}

export default function BillingManagement() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-gray-500">Loading Billing Counter...</div>}>
      <BillingContent />
    </Suspense>
  );
}
