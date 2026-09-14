'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Coins, Scale, Receipt, Download, Clock, Calendar, Printer, FileText } from 'lucide-react';
import { isFirebaseConfigured } from '@/lib/auth';
import { getLoan } from '@/lib/db/loans';
import { getGoldByLoan } from '@/lib/db/gold';
import { getPaymentsByLoan } from '@/lib/db/payments';
import PDFPreviewModal from '@/components/PDFPreviewModal';
import { getPdfApiUrl, downloadPdfDocument, printPdfDocument } from '@/lib/pdfHelper';

export default function CustomerLoanDetail() {
 const router = useRouter();
 const params = useParams();
 const id = (params?.id as string) || '';

 const [loan, setLoan] = useState<any>(null);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);

 // PDF Preview States
 const [isPreviewOpen, setIsPreviewOpen] = useState(false);
 const [previewUrl, setPreviewUrl] = useState('');
 const [previewTitle, setPreviewTitle] = useState('');

 useEffect(() => {
 async function loadLoanDetails() {
 if (!id) return;
 setLoading(true);
 setError(null);
 try {
 if (!isFirebaseConfigured()) {
 setError('Firebase not configured. Please check environment variables.');
 setLoading(false);
 return;
 }

 const ln = await getLoan(id, { withCustomer: true });
 if (!ln) {
 setError('Loan not found.');
 setLoading(false);
 return;
 }

 const col = await getGoldByLoan(id);
 const pay = await getPaymentsByLoan(id);

 const mappedGold = col.map((g: any) => ({
 id: g.id,
 name: `${g.ornament_type || 'Gold Asset'} - ${g.purity_karat || '22K'}`,
 netWeight: `${(g.net_weight || g.weight_grams || 0).toFixed(2)}g`,
 purity: g.purity_karat,
 valuation: g.valuation_inr,
 }));

 const mappedPayments = pay.map((p: any) => ({
 id: p.receipt_number || p.id,
 paymentId: p.id,
 receiptNumber: p.receipt_number || p.id,
 date: p.payment_date ? new Date(p.payment_date).toLocaleDateString('en-IN') : 'N/A',
 amount: p.amount_paid,
 type: p.payment_type,
 mode: p.mode,
 }));

 const remainingPrincipal = (ln.principal_amount || 0) - (ln.total_principal_paid || 0);
 const outstandingInterest = ln.outstanding_interest || 0;

 setLoan({
 id: ln.loan_number,
 status: ln.status,
 principal: ln.principal_amount,
 outstanding: remainingPrincipal + outstandingInterest,
 interestAccrued: outstandingInterest,
 apr: ln.interest_rate_apr,
 dailyRate: Math.round(((ln.principal_amount * (ln.interest_rate_apr / 100)) / 365) * 100) / 100,
 dueDate: ln.maturity_date ? new Date(ln.maturity_date).toLocaleDateString('en-IN') : 'N/A',
 disbursedDate: ln.origination_date ? new Date(ln.origination_date).toLocaleDateString('en-IN') : 'N/A',
 nextInterestDue: ln.grace_expiry_date ? new Date(ln.grace_expiry_date).toLocaleDateString('en-IN') : 'N/A',
 goldItems: mappedGold,
 payments: mappedPayments,
 });
 } catch (err) {
 console.error('Failed to load loan details:', err);
 setError(err instanceof Error ? err.message : 'Failed to load loan details');
 } finally {
 setLoading(false);
 }
 }
 loadLoanDetails();
 }, [id]);

 // Loading state
 if (loading) {
 return (
 <div className="space-y-6">
 <div className="flex items-center gap-2 text-gray-400">
 <div className="w-5 h-5 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin" />
 <span className="text-xs">Loading loan details...</span>
 </div>
 </div>
 );
 }

 // Error state
 if (error || !loan) {
 return (
 <div className="space-y-6">
 <button onClick={() => router.push('/customer/loans')} className="flex items-center gap-2 text-gray-500 hover:text-[#2563EB] text-sm">
 <ArrowLeft size={16} /> Back to My Loans
 </button>
 <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
 <p className="text-sm text-red-600 font-medium">{error || 'Loan not found.'}</p>
 <button onClick={() => router.push('/customer/loans')} className="mt-3 px-4 py-2 bg-[#2563EB] text-white text-xs font-bold rounded-lg">
 Back to Loans
 </button>
 </div>
 </div>
 );
 }

 const totalCollateralValue = loan.goldItems.reduce((sum: number, g: any) => sum + (g.valuation || 0), 0);

 return (
 <div className="space-y-6">
 {/* Back Button */}
 <button
 onClick={() => router.push('/customer/loans')}
 className="flex items-center gap-2 text-gray-500 hover:text-[#2563EB] transition text-sm font-medium group"
 >
 <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
 Back to My Loans
 </button>

 {/* Hero Card */}
 <div className="bg-gradient-to-br from-white to-slate-50 border border-[#2563EB]/20 rounded-xl p-6 relative overflow-hidden">
 <div className="absolute top-0 right-0 w-24 h-24 bg-[#2563EB]/10 rounded-full blur-xl" />

 <div className="space-y-4">
 <div className="flex justify-between items-start">
 <div>
 <span className="text-[10px] text-gray-500 uppercase tracking-widest block font-medium">
 Loan Account
 </span>
 <h2 className="text-lg font-bold text-gray-900 font-mono mt-1">{loan.id}</h2>
 </div>
 <span className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${
 loan.status === 'Active' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
 loan.status === 'Settled' ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' :
 'bg-amber-500/10 text-amber-600 border-amber-500/20'
 }`}>
 {loan.status}
 </span>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <div>
 <span className="text-gray-400 block text-[9px] uppercase tracking-wider">
 Principal Amount
 </span>
 <span className="text-xl sm:text-2xl font-bold text-gray-900 font-outfit">
 Rs. {(loan.principal || 0).toLocaleString('en-IN')}
 </span>
 </div>
 <div className="text-right">
 <span className="text-gray-400 block text-[9px] uppercase tracking-wider">
 Outstanding Balance
 </span>
 <span className="text-xl sm:text-2xl font-bold text-amber-600 font-outfit">
 Rs. {(loan.outstanding || 0).toLocaleString('en-IN')}
 </span>
 </div>
 </div>

 <div className="flex justify-between items-center bg-gray-50 border border-gray-200 p-3 rounded-lg text-xs">
 <div className="flex items-center gap-2">
 <Calendar size={14} className="text-[#2563EB]" />
 <div>
 <span className="text-gray-400 block text-[9px]">Disbursed</span>
 <span className="text-gray-900 font-medium">{loan.disbursedDate}</span>
 </div>
 </div>
 <div className="text-right">
 <span className="text-gray-400 block text-[9px]">Maturity Due</span>
 <span className="text-gray-900 font-medium">{loan.dueDate}</span>
 </div>
 </div>
 </div>
 </div>

 {/* Gold Collateral Details */}
 <div className="space-y-3">
 <h3 className="text-sm font-semibold text-gray-900 tracking-wide border-b border-gray-200 pb-2 flex items-center gap-2">
 <Scale size={14} className="text-[#2563EB]" />
 Gold Collateral Details
 </h3>

 {loan.goldItems.map((item: any) => (
 <div
 key={item.id}
 className="bg-white border border-gray-200 rounded-xl p-4 flex justify-between items-center transition hover:border-[#2563EB]/20"
 >
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded bg-gray-100 border border-[#2563EB]/20 flex items-center justify-center text-[#2563EB]">
 <Coins size={20} />
 </div>
 <div>
 <h4 className="text-xs font-semibold text-gray-900">{item.name}</h4>
 <div className="flex items-center gap-3 mt-1">
 <span className="text-[10px] text-gray-500">
 Net Wt: <span className="text-gray-900 font-medium">{item.netWeight}</span>
 </span>
 <span className="text-[10px] text-gray-500">
 Purity: <span className="text-[#2563EB] font-medium">{item.purity}</span>
 </span>
 </div>
 </div>
 </div>
 <div className="text-right">
 <span className="text-gray-400 block text-[9px] uppercase tracking-wider">
 Valuation
 </span>
 <span className="text-gray-900 font-semibold text-xs">
 Rs. {(item.valuation || 0).toLocaleString('en-IN')}
 </span>
 </div>
 </div>
 ))}

 <div className="flex justify-between items-center text-xs bg-gray-50 border border-gray-200 p-3 rounded-lg">
 <span className="text-gray-500">Total Collateral Value</span>
 <span className="text-[#2563EB] font-bold">
 Rs. {totalCollateralValue.toLocaleString('en-IN')}
 </span>
 </div>
 </div>

 {/* Interest Section */}
 <div className="space-y-3">
 <h3 className="text-sm font-semibold text-gray-900 tracking-wide border-b border-gray-200 pb-2 flex items-center gap-2">
 <Clock size={14} className="text-[#2563EB]" />
 Interest Details
 </h3>

 <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
 <div>
 <span className="text-gray-400 block text-[9px] uppercase tracking-wider">
 Accrued Interest
 </span>
 <span className="text-amber-600 font-bold text-lg font-outfit">
 Rs. {(loan.interestAccrued || 0).toLocaleString('en-IN')}
 </span>
 </div>
 <div>
 <span className="text-gray-400 block text-[9px] uppercase tracking-wider">
 Daily Rate
 </span>
 <span className="text-gray-900 font-semibold">
 Rs. {loan.dailyRate?.toFixed(2) || '0.00'}
 </span>
 <span className="text-gray-400 block text-[9px]">@ {loan.apr}% APR</span>
 </div>
 <div>
 <span className="text-gray-400 block text-[9px] uppercase tracking-wider">
 Next Due Date
 </span>
 <div className="flex items-center gap-1 mt-0.5">
 <Calendar size={10} className="text-[#2563EB]" />
 <span className="text-gray-900 font-semibold">{loan.nextInterestDue}</span>
 </div>
 </div>
 </div>
 </div>
 </div>

 {/* Payment History Timeline */}
 <div className="space-y-3">
 <h3 className="text-sm font-semibold text-gray-900 tracking-wide border-b border-gray-200 pb-2 flex items-center gap-2">
 <Receipt size={14} className="text-[#2563EB]" />
 Payment History
 </h3>

  <div className="relative">
    {/* Timeline line */}
    <div className="absolute left-[19px] top-0 bottom-0 w-px bg-gray-200" />

    {loan.payments && loan.payments.map((payment: any) => (
      <div key={payment.id} className="relative flex gap-4 pb-4">
        {/* Timeline dot */}
        <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600 shrink-0 z-10">
          <Receipt size={16} />
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 flex-1 hover:border-[#2563EB]/20 transition">
          <div className="flex justify-between items-start">
            <div>
              <span className="font-semibold text-gray-900 text-sm font-mono">
                {payment.id}
              </span>
              <span className="text-[10px] text-gray-400 block mt-0.5">{payment.type}</span>
            </div>
            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 text-[10px] font-bold">
              {payment.mode} Verified
            </span>
          </div>

          <div className="flex justify-between items-center mt-3 text-xs">
            <div>
              <span className="text-gray-400 block text-[9px] uppercase tracking-wider">
                Amount Paid
              </span>
              <span className="text-gray-900 font-bold">
                Rs. {(payment.amount || 0).toLocaleString('en-IN')}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-gray-500 text-[10px]">
              <Calendar size={12} className="text-[#2563EB]" />
              <span>{payment.date}</span>
            </div>
          </div>

          <div className="flex flex-wrap justify-end items-center mt-3 pt-2 border-t border-slate-100 text-xs gap-2">
            <button
              onClick={() => {
                const url = getPdfApiUrl({ type: 'receipt', paymentId: payment.paymentId, loanId: id });
                setPreviewUrl(url);
                setPreviewTitle(`Payment Receipt - ${payment.receiptNumber}`);
                setIsPreviewOpen(true);
              }}
              className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded border border-blue-200 text-[10px] font-semibold inline-flex items-center gap-1 cursor-pointer"
            >
              <Printer size={10} />
              Receipt
            </button>
            <button
              onClick={() => {
                downloadPdfDocument({ type: 'receipt', paymentId: payment.paymentId, loanId: id }, `PGF_Receipt_${payment.receiptNumber}.pdf`);
              }}
              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-300 text-[10px] font-semibold inline-flex items-center gap-1 cursor-pointer"
            >
              <Download size={10} />
              PDF
            </button>
          </div>
        </div>
      </div>
    ))}

    {(!loan.payments || loan.payments.length === 0) && (
      <div className="text-center py-8 text-gray-400 text-xs">
        No payments recorded yet.
      </div>
    )}
  </div>
  </div>

  {/* Download Actions */}
  <div className="space-y-3">
  <h3 className="text-sm font-semibold text-gray-900 tracking-wide border-b border-gray-200 pb-2">
  Loan Documents & Statements
  </h3>

  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
  {/* Pawn Ticket */}
  <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
  <div className="flex items-center gap-3">
  <div className="w-10 h-10 rounded bg-[#2563EB]/10 border border-[#2563EB]/20 flex items-center justify-center text-[#2563EB]">
  <Printer size={18} />
  </div>
  <div>
  <span className="text-gray-900 text-xs font-semibold block">Pawn Ticket / Agreement</span>
  <span className="text-[10px] text-gray-400">Official pledge certificate</span>
  </div>
  </div>
  <div className="flex gap-2 pt-1 border-t border-gray-100">
  <button
  onClick={() => {
  setPreviewUrl(getPdfApiUrl({ type: 'ticket', loanId: id }));
  setPreviewTitle(`Gold Loan Pawn Ticket - ${loan.id}`);
  setIsPreviewOpen(true);
  }}
  className="flex-1 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded text-xs font-bold transition text-center cursor-pointer"
  >
  Preview
  </button>
  <button
  onClick={() => {
  downloadPdfDocument({ type: 'ticket', loanId: id }, `PGF_PawnTicket_${loan.id}.pdf`);
  }}
  className="flex-1 py-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded text-xs font-bold transition text-center flex items-center justify-center gap-1 cursor-pointer"
  >
  <Download size={12} />
  Download
  </button>
  </div>
  </div>

  {/* Loan Application Dossier */}
  <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
  <div className="flex items-center gap-3">
  <div className="w-10 h-10 rounded bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
  <FileText size={18} />
  </div>
  <div>
  <span className="text-gray-900 text-xs font-semibold block">Application & Appraisal</span>
  <span className="text-[10px] text-gray-400">KYC & ornament appraisal</span>
  </div>
  </div>
  <div className="flex gap-2 pt-1 border-t border-gray-100">
  <button
  onClick={() => {
  setPreviewUrl(getPdfApiUrl({ type: 'loan_application', loanId: id }));
  setPreviewTitle(`Application & Appraisal - ${loan.id}`);
  setIsPreviewOpen(true);
  }}
  className="flex-1 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded text-xs font-bold transition text-center cursor-pointer"
  >
  Preview
  </button>
  <button
  onClick={() => {
  downloadPdfDocument({ type: 'loan_application', loanId: id }, `PGF_Application_${loan.id}.pdf`);
  }}
  className="flex-1 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-bold transition text-center flex items-center justify-center gap-1 cursor-pointer"
  >
  <Download size={12} />
  Download
  </button>
  </div>
  </div>

  {/* Outstanding Statement */}
  <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
  <div className="flex items-center gap-3">
  <div className="w-10 h-10 rounded bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
  <FileText size={18} />
  </div>
  <div>
  <span className="text-gray-900 text-xs font-semibold block">Loan Ledger Statement</span>
  <span className="text-[10px] text-gray-400">Payment ledger & interest audit</span>
  </div>
  </div>
  <div className="flex flex-col gap-1.5 pt-1 border-t border-gray-100">
  <button
  onClick={() => router.push(`/customer/statement?loanId=${id}`)}
  className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-bold transition text-center flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
  >
  <FileText size={12} /> View Live Statement
  </button>
  <div className="flex gap-2">
  <button
  onClick={() => {
  setPreviewUrl(getPdfApiUrl({ type: 'statement', loanId: id }));
  setPreviewTitle(`Loan Account Statement - ${loan.id}`);
  setIsPreviewOpen(true);
  }}
  className="flex-1 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-[11px] font-semibold transition text-center cursor-pointer"
  >
  Preview PDF
  </button>
  <button
  onClick={() => {
  downloadPdfDocument({ type: 'statement', loanId: id }, `PGF_Statement_${loan.id}.pdf`);
  }}
  className="flex-1 py-1 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded text-[11px] font-semibold transition text-center flex items-center justify-center gap-1 cursor-pointer"
  >
  <Download size={11} /> PDF
  </button>
  </div>
  </div>
  </div>
  </div>
  </div>

 {/* Support Footer */}
 <div className="p-4 rounded-lg border border-gray-200 bg-gray-50 text-center space-y-2">
 <p className="text-[10px] text-gray-500 leading-relaxed">
 For discrepancies in interest calculation or collateral valuation, contact the branch
 desk with your Loan ID.
 </p>
 <span className="text-[9px] text-[#2563EB] font-semibold block uppercase tracking-widest font-mono">
 Call Support: +91 452 234567
 </span>
 </div>

 <PDFPreviewModal
 isOpen={isPreviewOpen}
 onClose={() => setIsPreviewOpen(false)}
 pdfUrl={previewUrl}
 title={previewTitle}
 />
 </div>
 );
}
