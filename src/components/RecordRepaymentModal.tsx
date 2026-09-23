// src/components/RecordRepaymentModal.tsx
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  Receipt, 
  Coins, 
  CreditCard, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  Printer, 
  ArrowRight,
  ShieldCheck,
  FileText,
  Eye,
  Share2,
  Edit3,
  Clock,
  Sparkles
} from 'lucide-react';
import { getCurrentProfile } from '@/lib/auth';
import { recordPayment, calculatePaymentSplit, peekNextReceiptNumber } from '@/lib/db/payments';
import { peekNextBillSlogan, AssignedSlogan } from '@/lib/db/slogans';
import { calculateLoanInterestSnapshot } from '@/lib/db/interest';
import { auditCreate } from '@/lib/db/audit';
import { createNotification } from '@/lib/db/notifications';
import { downloadPdfDocument, printPdfDocument, getPdfApiUrl } from '@/lib/pdfHelper';
import PDFPreviewModal from '@/components/PDFPreviewModal';

interface RecordRepaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: {
    id: string;
    name: string;
    customer_number?: string;
    phone_primary?: string;
  } | null;
  loans: any[];
  defaultLoanId?: string;
  onPaymentSuccess?: (payment: any) => void;
}

export default function RecordRepaymentModal({
  isOpen,
  onClose,
  customer,
  loans,
  defaultLoanId,
  onPaymentSuccess,
}: RecordRepaymentModalProps) {
  const [selectedLoanId, setSelectedLoanId] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentAmount, setPaymentAmount] = useState<number | ''>(''); // Blank by default as per numeric rules!
  const [paymentMode, setPaymentMode] = useState<string>('Cash');
  const [transactionRef, setTransactionRef] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPeeking, setIsPeeking] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [completedPayment, setCompletedPayment] = useState<any | null>(null);

  // Billing Preview Modal State (Pre-Commit)
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewReceiptNo, setPreviewReceiptNo] = useState<string>('');
  const [previewSlogan, setPreviewSlogan] = useState<AssignedSlogan | null>(null);

  // PDF Preview State (Post-Commit)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');

  // Auto-select loan when modal opens
  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setCompletedPayment(null);
      setShowPreviewModal(false);
      setPaymentAmount(''); // Reset to blank
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setPaymentMode('Cash');
      setTransactionRef('');
      setRemarks('');

      if (defaultLoanId && loans.some((l) => l.id === defaultLoanId)) {
        setSelectedLoanId(defaultLoanId);
      } else if (loans.length > 0) {
        setSelectedLoanId(loans[0].id);
      } else {
        setSelectedLoanId('');
      }
    }
  }, [isOpen, defaultLoanId, loans]);

  // Selected Loan
  const currentLoan = useMemo(() => {
    return loans.find((l) => l.id === selectedLoanId) || null;
  }, [loans, selectedLoanId]);

  // Dynamic Interest Snapshot
  const interestSnapshot = useMemo(() => {
    if (!currentLoan) return null;
    return calculateLoanInterestSnapshot({
      id: currentLoan.id,
      principal_amount: currentLoan.principal_amount || 0,
      total_principal_paid: currentLoan.total_principal_paid || 0,
      interest_rate_apr: currentLoan.interest_rate_apr || 18,
      origination_date: currentLoan.origination_date || new Date().toISOString(),
      maturity_date: currentLoan.maturity_date || new Date().toISOString(),
      total_interest_paid: currentLoan.total_interest_paid || 0,
      outstanding_interest: currentLoan.outstanding_interest,
    } as any);
  }, [currentLoan]);

  // Live Loan Balances
  const loanPrincipal = currentLoan?.principal_amount || 0;
  const remainingPrincipal = interestSnapshot 
    ? interestSnapshot.currentPrincipal 
    : Math.max(0, loanPrincipal - (currentLoan?.total_principal_paid || 0));
  const outstandingInterest = interestSnapshot 
    ? interestSnapshot.outstandingInterest 
    : (currentLoan?.outstanding_interest || 0);
  const totalDue = remainingPrincipal + outstandingInterest;

  // Strict Payment Allocation using calculatePaymentSplit:
  // Payment → Penalty → Interest → Principal
  const allocation = useMemo(() => {
    const amt = typeof paymentAmount === 'number' ? Math.max(0, paymentAmount) : 0;
    const split = calculatePaymentSplit(
      amt,
      outstandingInterest,
      remainingPrincipal,
      0,
      0
    );

    return {
      amt,
      interestPortion: split.interestPortion,
      principalPortion: split.principalPortion,
      penaltyPortion: 0,
      newOutstandingInterest: split.remainingInterest,
      newRemainingPrincipal: split.remainingPrincipal,
      newTotalOutstanding: split.newOutstanding,
      isFullSettlement: split.isFullSettlement,
    };
  }, [paymentAmount, outstandingInterest, remainingPrincipal]);

  if (!isOpen) return null;

  // Step 2: Open Billing Preview before saving payment
  const handleOpenPreview = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!customer) {
      setErrorMsg('Please select a valid customer.');
      return;
    }

    if (!currentLoan) {
      setErrorMsg('Please select an active loan to record payment.');
      return;
    }

    if (['Settled', 'Closed', 'Cancelled', 'Auctioned'].includes(currentLoan.status)) {
      setErrorMsg(`Cannot record repayment on a ${currentLoan.status} loan.`);
      return;
    }

    if (paymentAmount === '' || typeof paymentAmount !== 'number' || paymentAmount <= 0) {
      setErrorMsg('Please enter a valid payment amount greater than ₹0.');
      return;
    }

    setIsPeeking(true);
    try {
      const [nextReceipt, nextSlogan] = await Promise.all([
        peekNextReceiptNumber().catch(() => 'RCP-PREVIEW'),
        peekNextBillSlogan().catch(() => null)
      ]);
      setPreviewReceiptNo(nextReceipt);
      setPreviewSlogan(nextSlogan);
      setShowPreviewModal(true);
    } catch (err) {
      console.warn('Error peeking next receipt/slogan:', err);
      setShowPreviewModal(true);
    } finally {
      setIsPeeking(false);
    }
  };

  // Step 3: Confirm and atomic save
  const handleConfirmAndSavePayment = async () => {
    if (!customer || !currentLoan) return;
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const activeAdmin = await getCurrentProfile();
      const adminId = activeAdmin?.id || 'admin_counter';

      // 1. Record payment in Firestore (atomic batch with loan balance updates)
      const recorded = await recordPayment({
        loan_id: currentLoan.id,
        customer_id: customer.id,
        amount_paid: allocation.amt,
        interest_portion: allocation.interestPortion,
        principal_portion: allocation.principalPortion,
        penalty_amount: 0,
        waiver_amount: 0,
        payment_type: allocation.isFullSettlement
          ? 'Full_Settlement'
          : allocation.principalPortion > 0
          ? 'Principal'
          : 'Interest',
        payment_date: new Date(paymentDate).toISOString(),
        mode: paymentMode as any,
        remarks: remarks.trim()
          ? `${remarks.trim()} | Ref: ${transactionRef || 'Counter'}`
          : `Ref: ${transactionRef || 'Counter Payment'}`,
        calculation_snapshot: interestSnapshot || undefined,
      });

      // 2. Create Audit Log
      await auditCreate(adminId, 'payments', recorded.id, {
        loan_id: currentLoan.id,
        loan_number: currentLoan.loan_number,
        customer_id: customer.id,
        customer_name: customer.name,
        amount_paid: allocation.amt,
        interest_portion: allocation.interestPortion,
        principal_portion: allocation.principalPortion,
        receipt_number: recorded.receipt_number,
        mode: paymentMode,
        allocation: 'Payment -> Penalty -> Interest -> Principal',
      });

      // 3. Trigger Customer Notification
      await createNotification({
        recipient_id: customer.id,
        title: `Payment Received: ₹${allocation.amt.toLocaleString('en-IN')}`,
        message: `Your payment of ₹${allocation.amt.toLocaleString('en-IN')} for Gold Loan ${currentLoan.loan_number} has been recorded. Interest Cleared: ₹${allocation.interestPortion.toLocaleString('en-IN')}, Principal Reduced: ₹${allocation.principalPortion.toLocaleString('en-IN')}. Receipt: ${recorded.receipt_number}.`,
        type: 'Payment_Received',
        channel: 'In_App',
        related_entity_type: 'payments',
        related_entity_id: recorded.id,
      });

      setShowPreviewModal(false);
      setCompletedPayment(recorded);
      if (onPaymentSuccess) onPaymentSuccess(recorded);
    } catch (err: any) {
      console.error('Failed to record repayment:', err);
      setErrorMsg(err.message || 'Failed to record repayment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 4 & 5: Post-Commit Download & Print Handlers
  const handleDownloadBill = () => {
    if (!completedPayment) return;
    downloadPdfDocument(
      { type: 'receipt', paymentId: completedPayment.id },
      `Bill_${completedPayment.receipt_number || 'receipt'}.pdf`
    );
  };

  const handlePreviewBill = () => {
    if (!completedPayment) return;
    setPreviewUrl(getPdfApiUrl({ type: 'receipt', paymentId: completedPayment.id }));
    setPreviewTitle(`Payment Bill Receipt - ${completedPayment.receipt_number}`);
    setIsPreviewOpen(true);
  };

  const handlePrintCustomerCopy = () => {
    if (!completedPayment) return;
    printPdfDocument({
      type: 'receipt',
      paymentId: completedPayment.id,
      copy: 'customer'
    });
  };

  const handlePrintOfficeCopy = () => {
    if (!completedPayment) return;
    printPdfDocument({
      type: 'receipt',
      paymentId: completedPayment.id,
      copy: 'office'
    });
  };

  const handlePrintThermal = () => {
    if (!completedPayment) return;
    printPdfDocument({
      type: 'receipt',
      paymentId: completedPayment.id,
      format: 'thermal'
    });
  };

  const handleShareWhatsApp = () => {
    if (!completedPayment || !customer) return;
    const phone = customer.phone_primary ? customer.phone_primary.replace(/[^0-9]/g, '') : '';
    const text = encodeURIComponent(
      `*Pavithra Gold Finance - Payment Receipt*\n` +
      `Receipt No: ${completedPayment.receipt_number}\n` +
      `Loan No: ${currentLoan?.loan_number}\n` +
      `Date: ${new Date(completedPayment.payment_date || Date.now()).toLocaleDateString('en-IN')}\n` +
      `Amount Paid: ₹${Number(completedPayment.amount_paid).toLocaleString('en-IN')}\n` +
      `Interest Cleared: ₹${Number(completedPayment.interest_portion || 0).toLocaleString('en-IN')}\n` +
      `Principal Reduced: ₹${Number(completedPayment.principal_portion || 0).toLocaleString('en-IN')}\n` +
      `Remaining Principal: ₹${Number(completedPayment.remaining_principal || 0).toLocaleString('en-IN')}\n` +
      `Next Due Date: ${currentLoan?.maturity_date ? new Date(currentLoan.maturity_date).toLocaleDateString('en-IN') : 'N/A'}\n\n` +
      `Thank you for banking with Pavithra Gold Finance!`
    );
    const url = phone ? `https://wa.me/91${phone.slice(-10)}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(url, '_blank');
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-2xl overflow-hidden max-h-[92vh] flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 bg-gradient-to-r from-blue-700 to-indigo-800 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center border border-white/20">
                <Receipt className="w-5 h-5 text-amber-300" />
              </div>
              <div>
                <h2 className="text-lg font-bold font-outfit">Record Loan Repayment</h2>
                <p className="text-xs text-blue-100">
                  Payment Entry → Billing Preview → Confirm → Receipt &amp; Print
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Success State */}
          {completedPayment ? (
            <div className="p-6 space-y-6 overflow-y-auto">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3 text-emerald-900">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-sm">Repayment Successfully Recorded &amp; Committed!</h3>
                  <p className="text-xs text-emerald-700 mt-1">
                    Atomic transaction completed. Sequential Receipt <strong>{completedPayment.receipt_number}</strong> created with Tamil Slogan assigned. Dual receipt copies are ready.
                  </p>
                </div>
              </div>

              {/* Transaction Summary Card */}
              <div className="bg-gray-50 rounded-xl p-5 border border-gray-200 space-y-3 text-xs">
                <div className="flex justify-between py-1 border-b border-gray-200">
                  <span className="text-gray-500">Customer:</span>
                  <span className="font-bold text-gray-900">{customer?.name} ({customer?.customer_number || 'N/A'})</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-200">
                  <span className="text-gray-500">Loan Number:</span>
                  <span className="font-bold font-mono text-blue-700">{currentLoan?.loan_number}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-200">
                  <span className="text-gray-500">Total Paid:</span>
                  <span className="font-bold text-gray-900 text-sm">₹ {completedPayment.amount_paid?.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-200">
                  <span className="text-gray-500">Waterfall Allocation:</span>
                  <span className="font-bold text-gray-800">Penalty (₹0) → Interest (₹{completedPayment.interest_portion?.toLocaleString('en-IN')}) → Principal (₹{completedPayment.principal_portion?.toLocaleString('en-IN')})</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-200">
                  <span className="text-gray-500">Remaining Balance:</span>
                  <span className="font-bold text-emerald-700">₹ {(completedPayment.remaining_principal || allocation.newRemainingPrincipal).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-200">
                  <span className="text-gray-500">Payment Mode:</span>
                  <span className="font-medium text-gray-800">{completedPayment.mode}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-500">Receipt Number:</span>
                  <span className="font-bold font-mono text-blue-800 text-sm">{completedPayment.receipt_number}</span>
                </div>
              </div>

              {/* 5. Download / Print Options */}
              <div className="space-y-2 pt-1">
                <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">
                  Official Document &amp; Printing Desk:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={handlePreviewBill}
                    className="py-2.5 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border border-blue-200 cursor-pointer"
                  >
                    <Eye className="w-4 h-4" />
                    Preview Receipt
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadBill}
                    className="py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    Download PDF
                  </button>

                  <button
                    type="button"
                    onClick={handlePrintCustomerCopy}
                    className="py-2.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border border-emerald-200 cursor-pointer"
                  >
                    <Printer className="w-4 h-4 text-emerald-600" />
                    Print Customer Copy
                  </button>

                  <button
                    type="button"
                    onClick={handlePrintOfficeCopy}
                    className="py-2.5 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border border-indigo-200 cursor-pointer"
                  >
                    <Printer className="w-4 h-4 text-indigo-600" />
                    Print Office Copy
                  </button>

                  <button
                    type="button"
                    onClick={handlePrintThermal}
                    className="py-2.5 px-3 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border border-amber-200 cursor-pointer"
                  >
                    <Printer className="w-4 h-4 text-amber-600" />
                    Print 80mm Thermal
                  </button>

                  <button
                    type="button"
                    onClick={handleShareWhatsApp}
                    className="py-2.5 px-3 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border border-teal-200 cursor-pointer"
                  >
                    <Share2 className="w-4 h-4 text-teal-600" />
                    Share / Send
                  </button>
                </div>
              </div>

              <div className="flex justify-end pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={onClose}
                  className="py-2.5 px-6 bg-gray-900 hover:bg-black text-white rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Done &amp; Return
                </button>
              </div>
            </div>
          ) : (
            /* Step 1 & 2: Payment Entry Form */
            <form onSubmit={handleOpenPreview} className="p-6 space-y-5 overflow-y-auto flex-1">
              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Customer & Loan Selection Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 p-3.5 rounded-xl border border-gray-200 text-xs">
                <div>
                  <span className="text-gray-500 block font-medium">Customer:</span>
                  <span className="text-gray-900 font-bold text-sm block truncate">
                    {customer?.name || 'No customer selected'}
                  </span>
                  <span className="text-gray-500 text-[11px] font-mono">
                    ID: {customer?.customer_number || customer?.id?.substring(0, 8)} &middot; {customer?.phone_primary || ''}
                  </span>
                </div>

                <div>
                  <label className="text-gray-500 block font-medium mb-1">Select Loan Account: *</label>
                  <select
                    value={selectedLoanId}
                    onChange={(e) => setSelectedLoanId(e.target.value)}
                    className="w-full bg-white border border-gray-300 text-gray-900 text-xs font-bold rounded-lg px-2.5 py-1.5 outline-none focus:border-blue-600 font-mono"
                  >
                    {loans.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.loan_number} — Disbursed: ₹{(l.principal_amount || 0).toLocaleString('en-IN')} ({l.status})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Current Dues Snapshot */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl">
                  <span className="text-amber-800 text-[10px] font-bold block uppercase tracking-wider">Interest Due</span>
                  <span className="text-base font-bold text-amber-900 block mt-0.5">
                    ₹ {outstandingInterest.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl">
                  <span className="text-blue-800 text-[10px] font-bold block uppercase tracking-wider">Principal Due</span>
                  <span className="text-base font-bold text-blue-900 block mt-0.5">
                    ₹ {remainingPrincipal.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl">
                  <span className="text-indigo-800 text-[10px] font-bold block uppercase tracking-wider">Total Outstanding</span>
                  <span className="text-base font-bold text-indigo-900 block mt-0.5">
                    ₹ {totalDue.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Payment Input Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Payment Amount — Initially blank / empty */}
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">
                    Payment Amount (INR) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-gray-400 font-bold text-sm">₹</span>
                    <input
                      type="number"
                      placeholder="Enter amount (e.g. 5000)"
                      value={paymentAmount}
                      onChange={(e) => {
                        setPaymentAmount(e.target.value === '' ? '' : parseFloat(e.target.value));
                      }}
                      className="w-full pl-8 pr-3 py-2 bg-white border border-gray-300 rounded-xl text-sm font-bold text-gray-900 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                    />
                  </div>
                  {/* Quick-fill helper buttons */}
                  <div className="flex gap-2 mt-1.5">
                    {outstandingInterest > 0 && (
                      <button
                        type="button"
                        onClick={() => setPaymentAmount(outstandingInterest)}
                        className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 hover:bg-amber-200 transition cursor-pointer"
                      >
                        Clear Interest (₹{outstandingInterest.toLocaleString('en-IN')})
                      </button>
                    )}
                    {totalDue > 0 && (
                      <button
                        type="button"
                        onClick={() => setPaymentAmount(totalDue)}
                        className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 hover:bg-indigo-200 transition cursor-pointer"
                      >
                        Full Settlement (₹{totalDue.toLocaleString('en-IN')})
                      </button>
                    )}
                  </div>
                </div>

                {/* Payment Date */}
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">
                    Payment Date *
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
                    <input
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-semibold text-gray-900 outline-none focus:border-blue-600"
                    />
                  </div>
                </div>

                {/* Payment Mode */}
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">
                    Payment Mode *
                  </label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs font-semibold text-gray-900 outline-none focus:border-blue-600"
                  >
                    <option value="Cash">Cash Counter</option>
                    <option value="UPI">UPI / QR Code</option>
                    <option value="Card">Debit / Credit Card</option>
                    <option value="Bank_Transfer">Bank Transfer / IMPS / NEFT</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>

                {/* Transaction Reference */}
                <div>
                  <label className="text-xs font-bold text-gray-700 block mb-1">
                    Transaction Reference (UTR / Cheque No)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. UPI Ref, Cheque #, or Counter"
                    value={transactionRef}
                    onChange={(e) => setTransactionRef(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs text-gray-900 outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="text-xs font-bold text-gray-700 block mb-1">Remarks / Internal Notes</label>
                <input
                  type="text"
                  placeholder="Optional notes regarding this repayment"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-gray-300 rounded-xl text-xs text-gray-900 outline-none focus:border-blue-600"
                />
              </div>

              {/* Real-time Payment Allocation Feedback */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-blue-700" />
                    Payment Allocation Waterfall (Penalty → Interest → Principal)
                  </span>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 bg-blue-200 text-blue-800 rounded">
                    Strict Order
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                  <div className="bg-white/80 p-2 rounded-lg border border-blue-100">
                    <span className="text-[10px] text-gray-500 block">Towards Interest:</span>
                    <span className="font-bold text-amber-700 text-sm">₹ {allocation.interestPortion.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="bg-white/80 p-2 rounded-lg border border-blue-100">
                    <span className="text-[10px] text-gray-500 block">Towards Principal:</span>
                    <span className="font-bold text-emerald-700 text-sm">₹ {allocation.principalPortion.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="bg-white/80 p-2 rounded-lg border border-blue-100">
                    <span className="text-[10px] text-gray-500 block">New Rem. Principal:</span>
                    <span className="font-bold text-gray-900 text-sm">₹ {allocation.newRemainingPrincipal.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="bg-white/80 p-2 rounded-lg border border-blue-100">
                    <span className="text-[10px] text-gray-500 block">New Rem. Interest:</span>
                    <span className="font-bold text-gray-900 text-sm">₹ {allocation.newOutstandingInterest.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {allocation.isFullSettlement && (
                  <div className="p-2 bg-emerald-100 text-emerald-900 text-xs font-bold rounded-lg flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                    Full Loan Settlement: Account will be marked as &apos;Settled&apos; upon confirmation.
                  </div>
                )}
              </div>

              {/* Form Footer Buttons */}
              <div className="flex justify-end gap-3 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={onClose}
                  className="py-2.5 px-4 text-xs font-semibold text-gray-700 hover:bg-gray-100 rounded-xl transition border border-gray-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPeeking || paymentAmount === '' || paymentAmount <= 0}
                  className="py-2.5 px-6 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition flex items-center gap-2 shadow-md cursor-pointer"
                >
                  {isPeeking ? (
                    'Preparing Preview...'
                  ) : (
                    <>
                      <Eye className="w-4 h-4" />
                      Preview Billing &amp; Allocation
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* 2. Billing & Payment Preview Modal (Pre-Commit) */}
      {showPreviewModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-2xl overflow-hidden max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 bg-gradient-to-r from-blue-700 to-indigo-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center border border-white/20">
                  <Eye className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h3 className="text-base font-bold font-outfit">Payment &amp; Billing Preview</h3>
                  <p className="text-xs text-blue-100">Review calculated allocation before committing to database</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
              {/* Customer & Loan Dossier */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 grid grid-cols-2 gap-3">
                <div>
                  <span className="text-gray-400 block text-[10px] uppercase tracking-wider">Customer Name &amp; ID</span>
                  <strong className="text-gray-900 block text-sm">{customer?.name}</strong>
                  <span className="text-blue-700 font-mono text-xs">
                    {customer?.customer_number || customer?.id?.substring(0, 8)} &middot; {customer?.phone_primary || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[10px] uppercase tracking-wider">Loan / Pawn Ticket No.</span>
                  <strong className="text-blue-800 font-mono block text-sm">{currentLoan?.loan_number}</strong>
                  <span className="text-gray-500 text-[11px]">
                    Disbursed: ₹{(currentLoan?.principal_amount || 0).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Payment Details & Timestamp */}
              <div className="grid grid-cols-3 gap-3 bg-blue-50/50 border border-blue-100 rounded-xl p-3.5">
                <div>
                  <span className="text-blue-900 font-semibold block text-[10px] uppercase tracking-wider">Payment Amount</span>
                  <strong className="text-gray-900 text-base font-outfit">₹ {allocation.amt.toLocaleString('en-IN')}</strong>
                </div>
                <div>
                  <span className="text-blue-900 font-semibold block text-[10px] uppercase tracking-wider">Payment Mode</span>
                  <strong className="text-gray-900 text-sm block">{paymentMode}</strong>
                  {transactionRef && <span className="text-[10px] text-gray-500 font-mono truncate block">Ref: {transactionRef}</span>}
                </div>
                <div>
                  <span className="text-blue-900 font-semibold block text-[10px] uppercase tracking-wider">Payment Date</span>
                  <strong className="text-gray-900 text-sm block">{new Date(paymentDate).toLocaleDateString('en-IN')}</strong>
                </div>
              </div>

              {/* Outstanding Balance Breakdown Before Payment */}
              <div className="border border-gray-200 rounded-xl p-3.5 space-y-2">
                <span className="font-bold text-gray-700 block text-[11px] uppercase tracking-wider">
                  Outstanding Dues Prior to Payment:
                </span>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-gray-50 p-2 rounded-lg border border-gray-100">
                    <span className="text-[10px] text-gray-500 block">Principal</span>
                    <strong className="text-gray-800 text-xs">₹ {remainingPrincipal.toLocaleString('en-IN')}</strong>
                  </div>
                  <div className="bg-amber-50/70 p-2 rounded-lg border border-amber-100">
                    <span className="text-[10px] text-amber-700 block">Accrued Interest</span>
                    <strong className="text-amber-900 text-xs">₹ {outstandingInterest.toLocaleString('en-IN')}</strong>
                  </div>
                  <div className="bg-rose-50/70 p-2 rounded-lg border border-rose-100">
                    <span className="text-[10px] text-rose-700 block">Penalty / Late Fee</span>
                    <strong className="text-rose-900 text-xs">₹ 0.00</strong>
                  </div>
                </div>
              </div>

              {/* Waterfall Allocation (Penalty → Interest → Principal) */}
              <div className="bg-indigo-50/80 border border-indigo-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-indigo-950 flex items-center gap-1.5 text-xs">
                    <ShieldCheck className="w-4 h-4 text-indigo-700" />
                    Payment Waterfall Allocation Breakdown
                  </span>
                  <span className="text-[10px] uppercase font-bold bg-indigo-200 text-indigo-900 px-2 py-0.5 rounded">
                    Penalty &rarr; Interest &rarr; Principal
                  </span>
                </div>

                <div className="space-y-2 bg-white p-3 rounded-lg border border-indigo-100">
                  <div className="flex justify-between items-center py-1 border-b border-gray-100">
                    <span className="text-gray-600 font-medium">1. Allocated to Penalty / Default Charges:</span>
                    <strong className="text-gray-900 font-mono">₹ 0.00</strong>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-gray-100">
                    <span className="text-amber-800 font-medium">2. Allocated to Accrued Interest:</span>
                    <strong className="text-amber-800 font-mono font-bold">₹ {allocation.interestPortion.toLocaleString('en-IN')}</strong>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-emerald-800 font-medium">3. Allocated to Principal Reduction:</span>
                    <strong className="text-emerald-800 font-mono font-bold">₹ {allocation.principalPortion.toLocaleString('en-IN')}</strong>
                  </div>
                </div>
              </div>

              {/* Balances Remaining After Payment */}
              <div className="border border-emerald-200 bg-emerald-50/40 rounded-xl p-3.5 space-y-2">
                <span className="font-bold text-emerald-950 block text-[11px] uppercase tracking-wider">
                  Balances Remaining After Payment:
                </span>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-white p-2 rounded-lg border border-emerald-100">
                    <span className="text-[10px] text-gray-500 block">Remaining Principal</span>
                    <strong className="text-gray-900 text-xs">₹ {allocation.newRemainingPrincipal.toLocaleString('en-IN')}</strong>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-emerald-100">
                    <span className="text-[10px] text-gray-500 block">Remaining Interest</span>
                    <strong className="text-gray-900 text-xs">₹ {allocation.newOutstandingInterest.toLocaleString('en-IN')}</strong>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-emerald-100">
                    <span className="text-[10px] text-gray-500 block">Total Balance</span>
                    <strong className="text-emerald-800 text-xs font-bold">₹ {allocation.newTotalOutstanding.toLocaleString('en-IN')}</strong>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-1 text-[11px]">
                  <span className="text-gray-600">Next Due / Maturity Date:</span>
                  <strong className="text-gray-900 font-medium">
                    {currentLoan?.maturity_date ? new Date(currentLoan.maturity_date).toLocaleDateString('en-IN') : 'N/A'}
                  </strong>
                </div>
              </div>

              {/* Receipt Number & Tamil Slogan Preview */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 space-y-2">
                <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                  <span className="text-gray-500">Upcoming Sequential Receipt Number:</span>
                  <strong className="text-blue-700 font-mono text-xs">{previewReceiptNo || 'Sequential # Auto'}</strong>
                </div>
                {previewSlogan && (
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-500 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      Assigned Tamil Slogan:
                    </span>
                    <span className="font-bold text-amber-900">{previewSlogan.sloganText}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setShowPreviewModal(false)}
                className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 hover:bg-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              >
                <Edit3 className="w-4 h-4" />
                Edit / Return to Form
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmAndSavePayment}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-emerald-600/20 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Recording &amp; Generating...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Confirm &amp; Save Payment
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post-Commit PDF Preview Modal */}
      <PDFPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        pdfUrl={previewUrl}
        title={previewTitle}
      />
    </>
  );
}
