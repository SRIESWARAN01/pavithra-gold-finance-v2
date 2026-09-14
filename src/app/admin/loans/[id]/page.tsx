'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ChevronRight, Coins, Scale, Clock, Download, XCircle, Printer, FileText, CheckCircle2 } from 'lucide-react';
import PDFPreviewModal from '@/components/PDFPreviewModal';
import { getPdfApiUrl, downloadPdfDocument, printPdfDocument } from '@/lib/pdfHelper';
// Firebase: all queries go through src/lib/db/* modules (already migrated)
import { isFirebaseConfigured } from '@/lib/auth';
import { getLoan, updateLoanStatus } from '@/lib/db/loans';
import { getGoldByLoan } from '@/lib/db/gold';
import { getPaymentsByLoan } from '@/lib/db/payments';
import type { Loan, GoldCollateral, Payment } from '@/types/database';

export default function LoanDetail() {
  const router = useRouter();
  const params = useParams();
  const id = (params?.id as string) || '';

  const [loan, setLoan] = useState<any | null>(null);
  const [collateral, setCollateral] = useState<GoldCollateral[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  // PDF Preview States
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');

  const statusColors: Record<string, string> = {
    Active: 'bg-emerald-500/10 text-emerald-600',
    Due: 'bg-amber-500/10 text-amber-400',
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
      } else {
        setLoan(null);
        setCollateral([]);
        setPayments([]);
      }
    } catch (err) {
      console.error('Failed to load loan detail page data:', err);
    } finally {
      setLoading(false);
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

  const handleCloseLoan = async () => {
    if (!confirm('Are you sure you want to close this loan folder? This will mark the loan status as Settled.')) return;
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

  // Calculate timelines dynamically
  const timeline: any[] = [];
  if (loan.origination_date) {
    timeline.push({
      event: 'Loan Account Originated',
      description: `Gold pledge of ${collateral.reduce((sum, c) => sum + (c.net_weight || 0), 0).toFixed(2)}g appraised. Loan disbursed to borrower. Pawn ticket generated.`,
      date: new Date(loan.origination_date).toLocaleString(),
      color: 'bg-blue-400',
      dotBorder: 'border-blue-400/30',
    });
  }

  // Add payments to timeline
  payments.forEach((p) => {
    timeline.push({
      event: `Payment Received — Rs. ${p.amount_paid.toLocaleString()}`,
      description: `Payment type: ${p.payment_type}. Cleared Rs. ${p.interest_portion.toLocaleString()} interest and Rs. ${p.principal_portion.toLocaleString()} principal via ${p.mode}. Receipt: ${p.receipt_number || 'N/A'}.`,
      date: new Date(p.payment_date).toLocaleString(),
      color: 'bg-emerald-600',
      dotBorder: 'border-emerald-600/30',
      paymentId: p.id,
      receiptNumber: p.receipt_number,
      amount: p.amount_paid,
    });
  });

  // Outstanding interest
  const remainingPrincipal = loan.principal_amount - (loan.total_principal_paid || 0);
  const totalOutstanding = remainingPrincipal + (loan.outstanding_interest || 0);

  // Collateral aggregates
  const totalGrossWeight = collateral.reduce((sum, c) => sum + (c.gross_weight || 0), 0);
  const totalStoneWeight = collateral.reduce((sum, c) => sum + (c.stone_weight || 0), 0);
  const totalNetWeight = collateral.reduce((sum, c) => sum + (c.net_weight || 0), 0);
  const totalValuation = collateral.reduce((sum, c) => sum + (c.valuation_inr || 0), 0);
  const averageLtv = totalValuation > 0 ? ((loan.principal_amount / totalValuation) * 100).toFixed(2) : '0.00';

  return (
    <div className="space-y-6 pb-12">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs text-[#2563EB] font-semibold tracking-wider uppercase">
        <span>Admin Panel</span>
        <ChevronRight size={12} className="text-gray-400" />
        <button onClick={() => router.push('/admin/loans')} className="text-gray-500 hover:text-gray-900 transition">
          Loans
        </button>
        <ChevronRight size={12} className="text-gray-400" />
        <span>{loan.loan_number}</span>
      </div>

      {/* Header Card */}
      <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-6 flex flex-col md:flex-row gap-6 items-start md:items-center">
        <div className="w-16 h-16 rounded-full bg-[#F3F4F6] border border-[#2563EB]/35 flex items-center justify-center text-[#2563EB]">
          <Coins size={28} />
        </div>
        <div className="flex-1 space-y-1">
          <h2 className="text-2xl font-bold text-gray-900 tracking-wide font-outfit">{loan.customer?.name || 'Customer'}</h2>
          <p className="text-gray-500 text-xs font-mono">
            Loan ID: {loan.loan_number} &middot; Phone: {loan.customer?.phone_primary || 'N/A'}
          </p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${statusColors[loan.status] || 'bg-slate-500/10 text-gray-500'}`}>
          {loan.status}
        </span>
      </div>

      {/* Two-Column: Loan Summary + Collateral */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Loan Summary */}
        <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-5 space-y-4">
          <h3 className="text-xs font-bold text-[#2563EB] uppercase tracking-wider border-b border-[#E5E7EB] pb-2">
            Loan Summary
          </h3>
          <div className="space-y-3 text-xs">
            {[
              { label: 'Principal Amount', value: `Rs. ${loan.principal_amount.toLocaleString()}`, highlight: true },
              { label: 'Remaining Principal', value: `Rs. ${remainingPrincipal.toLocaleString()}`, highlight: true },
              { label: 'Interest Rate', value: `${loan.interest_rate_apr}% APR` },
              { label: 'Disbursed Date', value: loan.origination_date ? new Date(loan.origination_date).toLocaleDateString() : 'N/A' },
              { label: 'Maturity / Due Date', value: loan.maturity_date ? new Date(loan.maturity_date).toLocaleDateString() : 'N/A' },
              { label: 'Loan Duration', value: `${loan.loan_period_months || 12} Months` },
              { label: 'Accrued Interest Due', value: `Rs. ${(loan.outstanding_interest || 0).toLocaleString()}`, color: 'text-amber-400' },
              { label: 'Total Outstanding Balance', value: `Rs. ${totalOutstanding.toLocaleString()}`, color: 'text-[#2563EB]', bold: true },
            ].map((item, i) => (
              <div key={i} className="flex justify-between items-center">
                <span className="text-gray-400">{item.label}</span>
                <span className={`font-semibold ${item.color || (item.highlight ? 'text-gray-900' : 'text-gray-600')} ${item.bold ? 'font-bold text-sm' : ''}`}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Gold Collateral */}
        <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-5 space-y-4">
          <h3 className="text-xs font-bold text-[#2563EB] uppercase tracking-wider border-b border-[#E5E7EB] pb-2 flex items-center gap-2">
            <Scale size={14} />
            Gold Collateral Specifications
          </h3>
          <div className="space-y-3 text-xs">
            {[
              { label: 'Total Items Appraised', value: `${collateral.length} Ornaments` },
              { label: 'Ornament Descriptions', value: collateral.map(c => c.item_description).join(', ') },
              { label: 'Total Gross Weight', value: `${totalGrossWeight.toFixed(2)} grams` },
              { label: 'Total Stone Deduction', value: `${totalStoneWeight.toFixed(2)} grams`, color: 'text-red-500' },
              { label: 'Net Gold Deposit Weight', value: `${totalNetWeight.toFixed(2)} grams`, color: 'text-[#2563EB]' },
              { label: 'Average Purity Karat', value: collateral[0]?.purity_karat || '22K' },
              { label: 'Gold Appraised Valuation', value: `Rs. ${totalValuation.toLocaleString()}`, color: 'text-emerald-600' },
              { label: 'Computed Loan-to-Value (LTV)', value: `${averageLtv}%` },
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
                          className="h-20 w-full object-cover rounded shadow-sm hover:scale-105 transition cursor-pointer"
                          onClick={() => window.open(c.front_photo_url!, '_blank')}
                        />
                        <span className="text-[9px] text-gray-500 font-medium block truncate">
                          #{cIdx + 1} Front View
                        </span>
                      </div>
                    )}
                    {c.back_photo_url && (
                      <div className="bg-gray-50 p-1.5 rounded-lg border border-gray-200 text-center space-y-1">
                        <img
                          src={c.back_photo_url}
                          alt={`${c.item_description} Back/Scale`}
                          className="h-20 w-full object-cover rounded shadow-sm hover:scale-105 transition cursor-pointer"
                          onClick={() => window.open(c.back_photo_url!, '_blank')}
                        />
                        <span className="text-[9px] text-gray-500 font-medium block truncate">
                          #{cIdx + 1} Back/Hallmark
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

      {/* Timeline */}
      <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-6 space-y-5">
        <h3 className="text-xs font-bold text-[#2563EB] uppercase tracking-wider border-b border-[#E5E7EB] pb-2 flex items-center gap-2">
          <Clock size={14} />
          Loan Activity Timeline
        </h3>

        <div className="relative space-y-0">
          {/* Vertical line */}
          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-[#E5E7EB]" />

          {timeline.length === 0 ? (
            <p className="text-xs text-gray-400 pl-8">No events recorded in folder timeline.</p>
          ) : (
            timeline.map((event, i) => (
              <div key={i} className="relative pl-8 pb-6 last:pb-0">
                {/* Dot */}
                <div className={`absolute left-0 top-1 w-[15px] h-[15px] rounded-full ${event.color} border-2 ${event.dotBorder} bg-opacity-80`} />

                <div className="bg-[#F8FAFC]/60 border border-[#E5E7EB] hover:border-[#2563EB]/10 rounded-lg p-4 transition space-y-2">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-1">
                    <h4 className="font-semibold text-gray-900 text-xs">{event.event}</h4>
                    <span className="text-[10px] text-gray-400 font-mono">{event.date}</span>
                  </div>
                  <p className="text-gray-500 text-[11px] leading-relaxed">{event.description}</p>
                  
                  {event.paymentId && (
                    <div className="pt-2 border-t border-slate-200/60 flex items-center gap-2">
                      <button
                        onClick={() => {
                          const url = getPdfApiUrl({ type: 'receipt', paymentId: event.paymentId, loanId: loan.id });
                          setPreviewUrl(url);
                          setPreviewTitle(`Official Payment Receipt - ${event.receiptNumber || loan.loan_number}`);
                          setIsPreviewOpen(true);
                        }}
                        className="px-2.5 py-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-semibold border border-blue-200 flex items-center gap-1 transition cursor-pointer"
                      >
                        <Printer size={11} /> View Receipt
                      </button>
                      <button
                        onClick={() => {
                          downloadPdfDocument({
                            type: 'receipt',
                            paymentId: event.paymentId,
                            loanId: loan.id,
                          }, `PGF_Receipt_${event.receiptNumber || loan.loan_number}.pdf`);
                        }}
                        className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-semibold border border-slate-300 flex items-center gap-1 transition cursor-pointer"
                      >
                        <Download size={11} /> Download PDF
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-5">
        <h3 className="text-xs font-bold text-[#2563EB] uppercase tracking-wider border-b border-[#E5E7EB] pb-2 mb-4">
          Financial Documents & Quick Actions
        </h3>
        <div className="flex flex-wrap gap-3">
          {!['Settled', 'Closed', 'Cancelled'].includes(loan.status) && (
            <>
              <button
                onClick={() => router.push(`/admin/payments?loanId=${loan.id}`)}
                className="px-4 py-2.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-[#F8FAFC] text-xs font-bold uppercase tracking-wider transition flex items-center gap-1.5 shadow-lg shadow-[#2563EB]/10 cursor-pointer"
              >
                <Coins size={14} />
                Log Repayment
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
            className="px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-wider transition flex items-center gap-1.5 font-outfit cursor-pointer shadow-sm"
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
    </div>
  );
}
