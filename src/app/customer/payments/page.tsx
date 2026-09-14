'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Receipt, Download, Calendar, Printer, FileText } from 'lucide-react';
import { isFirebaseConfigured, getCurrentProfile } from '@/lib/auth';
import { getPaymentsByCustomer } from '@/lib/db/payments';
import PDFPreviewModal from '@/components/PDFPreviewModal';
import { getPdfApiUrl, downloadPdfDocument, printPdfDocument } from '@/lib/pdfHelper';

export default function CustomerPayments() {
  const [paymentsList, setPaymentsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [customerName, setCustomerName] = useState('Customer');
  const [customerId, setCustomerId] = useState('');

  // PDF Preview State
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');

  useEffect(() => {
    async function loadPayments() {
      setLoading(true);
      try {
        const profile = await getCurrentProfile();
        if (!profile) return;

        setCustomerName(profile.name || 'Customer');
        setCustomerId(profile.id || '');

        const pmts = await getPaymentsByCustomer(profile.id);
        const list = pmts.map(p => ({
          id: p.id,
          paymentId: p.id,
          loanId: p.loan_id,
          receiptNumber: p.receipt_number || p.id,
          date: new Date(p.payment_date).toLocaleDateString('en-IN'),
          totalAmount: p.amount_paid,
          interestPortion: p.interest_portion,
          principalPortion: p.principal_portion,
          remainingPrincipal: p.loan ? (p.loan.principal_amount - (p.principal_portion || 0)) : 0,
          mode: p.mode
        }));
        setPaymentsList(list);
      } catch (err) {
        console.error('Failed to load customer payments:', err);
      } finally {
        setLoading(false);
      }
    }
    loadPayments();
  }, []);

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 tracking-wide font-outfit">My Repayment History</h2>
          <p className="text-gray-500 text-xs mt-1">Audit ledger logs of cash and online interest/principal payments received.</p>
        </div>
        <Link
          href="/customer/statement"
          className="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-[#2563EB] border border-blue-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
        >
          <FileText size={14} />
          <span>View Live Statement</span>
        </Link>
      </div>

      <div className="space-y-4">
        {paymentsList.length === 0 && !loading && (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-500 text-xs">
            No repayment receipts found in your account ledger.
          </div>
        )}

        {paymentsList.map((pay) => (
          <div 
            key={pay.id}
            className="bg-[#ffffff] border border-[#E5E7EB] hover:border-[#2563EB]/10 transition-all rounded-xl p-5 space-y-4 shadow-sm"
          >
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                <Receipt size={16} className="text-[#2563EB]" />
                <span className="font-semibold text-gray-900 text-sm font-mono">{pay.receiptNumber}</span>
              </div>
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 text-[10px] font-bold">
                {pay.mode} Verified
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs bg-[#F8FAFC]/40 p-4 rounded-lg border border-[#E5E7EB]">
              <div className="space-y-2">
                <div>
                  <span className="text-gray-400 block text-[9px] uppercase tracking-wider">Total Repayment Paid</span>
                  <span className="text-gray-900 font-bold text-sm">Rs. {pay.totalAmount.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex gap-4">
                  <div>
                    <span className="text-gray-400 block text-[9px]">Interest Portion</span>
                    <span className="text-amber-500 font-semibold">Rs. {pay.interestPortion.toLocaleString('en-IN')}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[9px]">Principal Portion</span>
                    <span className="text-emerald-600 font-semibold">Rs. {pay.principalPortion.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>
              
              <div className="text-right flex flex-col justify-between items-end">
                <div className="flex items-center gap-1.5 text-gray-500">
                  <Calendar size={12} className="text-[#2563EB]" />
                  <span>{pay.date}</span>
                </div>
                <div>
                  <span className="text-gray-400 block text-[9px]">Remaining Principal</span>
                  <span className="text-gray-900 font-semibold">Rs. {pay.remainingPrincipal.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <button
                onClick={() => {
                  const url = getPdfApiUrl({ type: 'receipt', paymentId: pay.paymentId, loanId: pay.loanId, customerId });
                  setPreviewUrl(url);
                  setPreviewTitle(`Official Payment Receipt - ${pay.receiptNumber}`);
                  setIsPreviewOpen(true);
                }}
                className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold transition border border-blue-200 cursor-pointer font-outfit"
              >
                <Printer size={12} />
                Preview Receipt
              </button>
              <button
                onClick={() => {
                  downloadPdfDocument({
                    type: 'receipt',
                    paymentId: pay.paymentId,
                    loanId: pay.loanId,
                    customerId,
                  }, `PGF_Receipt_${pay.receiptNumber}.pdf`);
                }}
                className="flex items-center gap-1 px-3.5 py-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-[#F8FAFC] rounded-lg text-xs font-bold transition shadow cursor-pointer font-outfit"
              >
                <Download size={12} />
                Download PDF
              </button>
            </div>
          </div>
        ))}
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
