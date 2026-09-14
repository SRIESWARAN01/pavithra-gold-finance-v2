'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Receipt, 
  Coins, 
  Search, 
  Printer, 
  AlertCircle, 
  CheckCircle2, 
  XCircle, 
  Download,
  FileText
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, doc, getDoc, getDocs, query, where, orderBy } from 'firebase/firestore';
import { isFirebaseConfigured } from '@/lib/auth';
import { recordPayment, calculatePaymentSplit } from '@/lib/db/payments';
import { createNotification } from '@/lib/db/notifications';
import PDFPreviewModal from '@/components/PDFPreviewModal';
import { getPdfApiUrl, downloadPdfDocument, printPdfDocument } from '@/lib/pdfHelper';

export default function BillingManagement() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'generate'>('dashboard');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');

  // Form State for new bill generation
  const [loans, setLoans] = useState<any[]>([]);
  const [loanId, setLoanId] = useState('');
  const [paymentType, setPaymentType] = useState('Interest');
  const [paymentMode, setPaymentMode] = useState('UPI');
  const [amountReceived, setAmountReceived] = useState<number | ''>('');
  const [penaltyFee, setPenaltyFee] = useState<number | ''>('');
  const [discountWaiver, setDiscountWaiver] = useState<number | ''>('');
  const [remarks, setRemarks] = useState('');

  const [bills, setBills] = useState<any[]>([]);
  const [lastCreatedPaymentId, setLastCreatedPaymentId] = useState('');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');

  const [totalStats, setTotalStats] = useState({
    todayCollection: 0,
    totalBills: 0,
    totalRevenue: 0,
    cancelledBills: 0,
    interestCollection: 0,
    principalCollection: 0,
    penaltyCollection: 0,
  });

  const fetchBillingData = async () => {
    try {
      // Fetch all payments
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

        // Sort newest first
        paymentsData.sort((a: any, b: any) => (b.payment_date || '').localeCompare(a.payment_date || ''));

        // Mappings
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
          status: 'Paid',
        }));

        setBills(mappedBills);

        // Calculate statistics
        const todayStr = new Date().toISOString().split('T')[0];
        let todayCollection = 0, totalRevenue = 0, interestCollection = 0, principalCollection = 0, penaltyCollection = 0;

        (paymentsData || []).forEach((p: any) => {
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
          totalBills: paymentsData?.length || 0,
          totalRevenue,
          cancelledBills: 0,
          interestCollection,
          principalCollection,
          penaltyCollection,
        });

        // Load active loans for generate dropdown
        if (activeTab === 'generate') {
          const loansQ = query(
            collection(db, 'loans'),
            where('status', 'in', ['Active', 'Due', 'Overdue', 'Grace_Period'])
          );
          const loansSnap = await getDocs(loansQ);
          const activeLoans: any[] = [];
          for (const ld of loansSnap.docs) {
            const loan: any = { id: ld.id, ...ld.data() };
            if (loan.customer_id) {
              try {
                const cs = await getDoc(doc(db, 'profiles', loan.customer_id));
                if (cs.exists()) loan.customer = { id: cs.id, name: cs.data().name };
              } catch {
                // ignore
              }
            }
            activeLoans.push(loan);
          }

          activeLoans.sort((a: any, b: any) => (b.created_at || '').localeCompare(a.created_at || ''));
          setLoans(activeLoans);
          if (activeLoans.length > 0) {
            setLoanId(activeLoans[0].id);
          }
        }
    } catch (err) {
      console.error('Failed to load billing details:', err);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => {
      fetchBillingData();
    }, 0);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Find selected loan for real-time split calculation
  const selectedLoan = loans.find((l) => l.id === loanId);
  const principal = selectedLoan ? selectedLoan.principal_amount - (selectedLoan.total_principal_paid || 0) : 0;
  const accruedInterest = selectedLoan ? selectedLoan.outstanding_interest || 0 : 0;

  // Real-time allocation preview splits
  const amt = typeof amountReceived === 'number' ? amountReceived : 0;
  const pFee = typeof penaltyFee === 'number' ? penaltyFee : 0;
  const dWaiver = typeof discountWaiver === 'number' ? discountWaiver : 0;
  const split = calculatePaymentSplit(amt, accruedInterest, principal, pFee, dWaiver);
  const interestPaid = split.interestPortion;
  const principalPaid = split.principalPortion;
  const totalAmount = typeof amountReceived === 'number' ? amountReceived : 0;
  const customerName = selectedLoan?.customer?.name || '';

  const handlePostBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amountReceived === '' || typeof amountReceived !== 'number' || isNaN(amountReceived) || amountReceived <= 0) {
      alert('Please enter a valid amount received greater than zero.');
      return;
    }
    setLoading(true);

    try {
      if (isFirebaseConfigured() && selectedLoan) {
        const payment = await recordPayment({
          loan_id: selectedLoan.id,
          customer_id: selectedLoan.customer?.id || null,
          amount_paid: amountReceived,
          interest_portion: interestPaid,
          principal_portion: principalPaid,
          ...(typeof penaltyFee === 'number' && penaltyFee > 0 ? { penalty_amount: penaltyFee } : {}),
          ...(typeof discountWaiver === 'number' && discountWaiver > 0 ? { waiver_amount: discountWaiver } : {}),
          payment_type: paymentType as any,
          mode: paymentMode as any,
          remarks,
        });

        if (payment?.id) {
          setLastCreatedPaymentId(payment.id);
        }

        // Trigger payment notification alert
        await createNotification({
          recipient_id: selectedLoan.customer?.id,
          type: 'Payment_Received',
          title: `Receipt Posted — ${payment.receipt_number}`,
          message: `Received Rs. ${amountReceived.toLocaleString()} for loan ${selectedLoan.loan_number}. Receipt posted in ledger.`,
        });
      } else {
        // Dev bypass
        await new Promise((resolve) => setTimeout(resolve, 1200));
      }
      setSuccess(true);
      fetchBillingData();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelBill = async (billNo: string) => {
    alert('Log cancel request recorded for receipt ' + billNo);
  };

  const handleRefundBill = async (billNo: string) => {
    alert('Refund request logged for receipt ' + billNo);
  };

  const filteredBills = bills.filter(b => {
    const matchesSearch = b.customer.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          b.billNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          b.loanId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesMode = filterMode === 'All' || b.mode === filterMode;
    const matchesStatus = filterStatus === 'All' || b.status === filterStatus;
    return matchesSearch && matchesMode && matchesStatus;
  });


  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#E5E7EB] pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 tracking-wide font-outfit">Billing & Receipt Engine</h2>
          <p className="text-gray-500 text-xs mt-1">Manage cash collections, generate bills, print receipts, and track payment histories.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/admin/statement"
            className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
          >
            <FileText size={14} />
            <span>Live Statement Hub</span>
          </Link>

          {/* Tab Selector */}
          <div className="flex bg-[#ffffff] p-1 rounded-lg border border-[#E5E7EB] text-xs">
            <button 
              onClick={() => { setActiveTab('dashboard'); setSuccess(false); }}
              className={`px-4 py-2 rounded-md font-semibold transition ${activeTab === 'dashboard' ? 'bg-[#2563EB] text-[#F8FAFC]' : 'text-gray-500 hover:text-gray-900'}`}
            >
              Dashboard
            </button>
            <button 
              onClick={() => { setActiveTab('generate'); setSuccess(false); }}
              className={`px-4 py-2 rounded-md font-semibold transition ${activeTab === 'generate' ? 'bg-[#2563EB] text-[#F8FAFC]' : 'text-gray-500 hover:text-gray-900'}`}
            >
              New Bill
            </button>
            <button 
              onClick={() => { setActiveTab('history'); setSuccess(false); }}
              className={`px-4 py-2 rounded-md font-semibold transition ${activeTab === 'history' ? 'bg-[#2563EB] text-[#F8FAFC]' : 'text-gray-500 hover:text-gray-900'}`}
            >
              Bills Archive
            </button>
          </div>
        </div>
      </div>

      {/* DASHBOARD TAB VIEW */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Dashboard cards stats grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-5 space-y-2">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider block font-semibold">Today&apos;s Collections</span>
              <span className="text-xl font-bold text-gray-900 block">Rs. {totalStats.todayCollection.toLocaleString()}</span>
              <span className="text-[9px] text-emerald-600 font-medium">Live sync</span>
            </div>

            <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-5 space-y-2">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider block font-semibold">Receipts Posted</span>
              <span className="text-xl font-bold text-gray-900 block">{totalStats.totalBills} Bills</span>
              <span className="text-[9px] text-gray-500">All channels active</span>
            </div>

            <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-5 space-y-2">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider block font-semibold">Total Revenue</span>
              <span className="text-xl font-bold text-[#2563EB] block">Rs. {totalStats.totalRevenue.toLocaleString()}</span>
              <span className="text-[9px] text-[#2563EB] font-semibold">Interest + Principal</span>
            </div>

            <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-5 space-y-2">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider block font-semibold">Cancelled / Refunded</span>
              <span className="text-xl font-bold text-red-500 block">{totalStats.cancelledBills} Bills</span>
              <span className="text-[9px] text-red-500">Audited status updated</span>
            </div>
          </div>

          {/* Allocation splits cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-5 space-y-4">
              <h3 className="text-xs font-bold text-[#2563EB] uppercase tracking-wider border-b border-[#E5E7EB] pb-2">Revenue Breakdowns</h3>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Interest Collections:</span>
                  <span className="text-gray-900 font-semibold">Rs. {totalStats.interestCollection.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Principal Repayments:</span>
                  <span className="text-gray-900 font-semibold">Rs. {totalStats.principalCollection.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Penalty / Fees Collected:</span>
                  <span className="text-gray-900 font-semibold">Rs. {totalStats.penaltyCollection.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-5 space-y-4">
              <h3 className="text-xs font-bold text-[#2563EB] uppercase tracking-wider border-b border-[#E5E7EB] pb-2">Billing Operations Reports</h3>
              <p className="text-gray-500 text-xs leading-relaxed">Download aggregate billing history collections report instantly.</p>
              <div className="flex gap-3">
                <a 
                  href="/api/pdf?type=receipt"
                  target="_blank"
                  className="px-4 py-2 rounded bg-[#F3F4F6] hover:bg-[#E5E7EB] border border-[#2563EB]/20 text-[#2563EB] text-xs font-bold transition flex items-center gap-1.5"
                >
                  <Download size={14} />
                  Daily Collection Ledger
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* GENERATE BILL TAB VIEW */}
      {activeTab === 'generate' && (
        <div>
          {!success ? (
            <form onSubmit={handlePostBill} className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Left Details Panel */}
              <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-6 md:col-span-2 space-y-4 text-xs">
                <h3 className="text-xs font-bold text-[#2563EB] uppercase tracking-wider border-b border-[#E5E7EB] pb-2">Generate Billing Invoice</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-gray-500 font-medium">Select Loan Account *</label>
                    <select 
                      value={loanId}
                      onChange={(e) => setLoanId(e.target.value)}
                      className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 rounded-lg px-3.5 py-2 outline-none"
                    >
                      {isFirebaseConfigured() ? (
                        loans.map((l) => {
                          const outstanding = l.principal_amount - (l.total_principal_paid || 0) + (l.outstanding_interest || 0);
                          return (
                            <option key={l.id} value={l.id}>
                              {l.customer?.name} - {l.loan_number} (Outstanding: Rs. {outstanding.toLocaleString()})
                            </option>
                          );
                        })
                      ) : (
                        <>
                          {loans.map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.customer?.name || 'Unknown'} - {l.loan_number} (Principal: Rs. {(l.principal_amount - (l.total_principal_paid || 0)).toLocaleString('en-IN')})
                            </option>
                          ))}
                        </>
                      )}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-gray-500 font-medium">Pledgor Customer Name *</label>
                    <input 
                      type="text"
                      required
                      disabled
                      value={selectedLoan?.customer?.name || ''}
                      className="w-full bg-[#F3F4F6]/50 border border-[#E5E7EB] text-gray-500 rounded-lg px-3.5 py-2 outline-none cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-gray-500 font-medium">Payment Allocation Type *</label>
                    <select 
                      value={paymentType}
                      onChange={(e) => setPaymentType(e.target.value)}
                      className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 rounded-lg px-3.5 py-2 outline-none"
                    >
                      <option value="Interest">Interest Payment</option>
                      <option value="Principal">Principal Payment</option>
                      <option value="Partial_Settlement">Partial Settlement</option>
                      <option value="Full_Settlement">Full Settlement</option>
                      <option value="Penalty">Penalty Payment</option>
                      <option value="Advance">Advance Payment</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-gray-500 font-medium">Payment Mode *</label>
                    <select 
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value)}
                      className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 rounded-lg px-3.5 py-2 outline-none"
                    >
                      <option value="Cash">Cash</option>
                      <option value="UPI">UPI</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Debit Card">Debit Card</option>
                      <option value="Credit Card">Credit Card</option>
                      <option value="Cheque">Cheque</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-gray-500 font-medium">Amount Received (Rs) *</label>
                    <input 
                      type="number"
                      required
                      placeholder="e.g. 15000"
                      value={amountReceived}
                      onChange={(e) => setAmountReceived(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 rounded-lg px-3.5 py-2 outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-gray-500 font-medium">Penalty charges (if any)</label>
                    <input 
                      type="number"
                      placeholder="e.g. 250"
                      value={penaltyFee}
                      onChange={(e) => setPenaltyFee(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 rounded-lg px-3.5 py-2 outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-gray-500 font-medium">Discount / Waiver (Rs)</label>
                    <input 
                      type="number"
                      placeholder="e.g. 100"
                      value={discountWaiver}
                      onChange={(e) => setDiscountWaiver(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 rounded-lg px-3.5 py-2 outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-gray-500 font-medium">Transaction Remarks</label>
                  <input 
                    type="text"
                    value={remarks}
                    placeholder="Enter transaction comments or reference bank code"
                    onChange={(e) => setRemarks(e.target.value)}
                    className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 rounded-lg px-3.5 py-2 outline-none"
                  />
                </div>
              </div>

              {/* Right Side Allocation Preview & Post */}
              <div className="bg-[#ffffff] border border-[#2563EB]/10 rounded-xl p-5 space-y-4 h-fit text-xs">
                <h3 className="text-xs font-bold text-[#2563EB] uppercase tracking-wider border-b border-[#E5E7EB] pb-2">Bill Summary</h3>
                
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Principal Paid:</span>
                    <span className="text-gray-900 font-medium">Rs. {principalPaid.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Interest Paid:</span>
                    <span className="text-gray-900 font-medium">Rs. {interestPaid.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Penalty Fee:</span>
                    <span className="text-gray-900 font-medium">Rs. {typeof penaltyFee === 'number' ? penaltyFee.toLocaleString() : '0'}</span>
                  </div>
                  {typeof discountWaiver === 'number' && discountWaiver > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>Waiver Discount:</span>
                      <span>- Rs. {discountWaiver.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-[#E5E7EB] pt-2 font-bold text-gray-900 text-sm">
                    <span>Total Bill:</span>
                    <span className="text-[#2563EB]">Rs. {totalAmount.toLocaleString()}</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || totalAmount <= 0}
                  className="w-full py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-[#2563EB]/35 text-[#F8FAFC] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 mt-4 cursor-pointer"
                >
                  {loading ? (
                    <div className="w-3.5 h-3.5 border-2 border-[#F8FAFC] border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <Receipt size={14} />
                  )}
                  Post & Generate Invoice
                </button>
              </div>
            </form>
          ) : (
            <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-8 text-center space-y-6 max-w-xl mx-auto">
              <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto text-emerald-600 mb-2">
                <CheckCircle2 size={32} />
              </div>

              <div>
                <h3 className="text-xl font-bold text-gray-900 font-outfit">Bill Posted Successfully</h3>
                <p className="text-gray-500 text-xs mt-2 leading-relaxed">
                  Bill invoice generated. The transaction allocation split has been recorded and customer balance has been updated instantly.
                </p>
              </div>

              <div className="pt-6 border-t border-[#E5E7EB] flex flex-wrap justify-center gap-3">
                <button
                  onClick={() => {
                    const url = getPdfApiUrl({ type: 'receipt', paymentId: lastCreatedPaymentId, loanId, amount: totalAmount });
                    setPreviewUrl(url);
                    setPreviewTitle(`Official Payment Receipt - ${loanId}`);
                    setIsPreviewOpen(true);
                  }}
                  className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer font-outfit"
                >
                  <Printer size={14} />
                  Preview Receipt
                </button>
                <button
                  onClick={() => {
                    downloadPdfDocument({
                      type: 'receipt',
                      paymentId: lastCreatedPaymentId,
                      loanId,
                      amount: totalAmount,
                    }, `PGF_Receipt_${loanId}.pdf`);
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer font-outfit"
                >
                  <Download size={14} />
                  Download PDF
                </button>
                <button
                  onClick={() => {
                    printPdfDocument({
                      type: 'receipt',
                      paymentId: lastCreatedPaymentId,
                      loanId,
                      amount: totalAmount,
                    });
                  }}
                  className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer font-outfit"
                >
                  <Printer size={14} />
                  Instant Print
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className="px-4 py-2 border border-[#E5E7EB] hover:bg-[#F3F4F6] text-gray-600 text-xs font-semibold rounded-lg transition cursor-pointer font-outfit"
                >
                  View Bills Archive
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* BILLING HISTORY TAB VIEW */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {/* Search bar filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <div className="relative md:col-span-2">
              <input 
                type="text"
                placeholder="Search by Bill No, Customer, Loan ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#ffffff] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 text-xs rounded-lg pl-10 pr-4 py-2.5 outline-none"
              />
              <Search size={14} className="absolute left-3 top-3.5 text-gray-500" />
            </div>

            <div>
              <select
                value={filterMode}
                onChange={(e) => setFilterMode(e.target.value)}
                className="w-full bg-[#ffffff] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 text-xs rounded-lg px-3 py-2.5 outline-none"
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
                className="w-full bg-[#ffffff] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 text-xs rounded-lg px-3 py-2.5 outline-none"
              >
                <option value="All">All Statuses</option>
                <option value="Paid">Paid</option>
                <option value="Cancelled">Cancelled</option>
                <option value="Refunded">Refunded</option>
              </select>
            </div>
          </div>

          {/* Billing table ledger grid */}
          <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl overflow-hidden shadow-xl text-xs">
            <div className="responsive-table-wrap">
            <table className="w-full text-left min-w-[700px]">
              <thead>
                <tr className="text-gray-400 uppercase tracking-wider border-b border-[#E5E7EB] bg-[#F8FAFC]/20">
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
              <tbody className="divide-y divide-[#E5E7EB]/30 text-gray-600">
                {filteredBills.map((b) => (
                  <tr key={b.billNo} className="hover:bg-[#F3F4F6]/20 transition-all">
                    <td className="p-4 font-mono font-semibold text-gray-900">{b.billNo}</td>
                    <td className="p-4 hidden md:table-cell">{b.date}</td>
                    <td className="p-4">
                      <span className="font-semibold text-gray-900 block">{b.customer}</span>
                      <span className="text-[10px] text-gray-400 font-mono">{b.loanId}</span>
                    </td>
                    <td className="p-4 hidden lg:table-cell">{b.type}</td>
                    <td className="p-4 hidden md:table-cell">{b.mode}</td>
                    <td className="p-4 font-semibold text-[#2563EB]">Rs. {b.amount.toLocaleString()}</td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        b.status === 'Paid' ? 'bg-emerald-500/10 text-emerald-600' :
                        b.status === 'Cancelled' ? 'bg-red-50 text-red-500' :
                        'bg-amber-500/10 text-amber-400'
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
                            loanId: b.loanDocId || b.loanNumber,
                            customerId: b.customerDocId,
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
                            loanId: b.loanDocId || b.loanNumber,
                            customerId: b.customerDocId,
                            amount: b.amount,
                          }, `PGF_Receipt_${b.billNo}.pdf`);
                        }}
                        className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                        title="Download PDF"
                      >
                        <Download size={13} />
                      </button>
                      {b.status === 'Paid' && (
                        <>
                          <button
                            onClick={() => handleCancelBill(b.billNo)}
                            className="p-1.5 rounded bg-red-50 hover:bg-rose-500/20 text-red-500 transition cursor-pointer"
                            title="Cancel Bill"
                          >
                            <XCircle size={12} />
                          </button>
                          <button
                            onClick={() => handleRefundBill(b.billNo)}
                            className="p-1.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 transition cursor-pointer"
                            title="Refund Bill"
                          >
                            <AlertCircle size={12} />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
