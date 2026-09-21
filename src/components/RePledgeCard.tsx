'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  CheckCircle2,
  Clock,
  RotateCcw,
  Coins,
  ShieldCheck,
  AlertTriangle,
  FileText,
  Printer,
  Download,
  ExternalLink,
  Eye,
  Lock,
  ArrowRight,
  Info
} from 'lucide-react';
import PDFPreviewModal from '@/components/PDFPreviewModal';
import { getPdfApiUrl, downloadPdfDocument, printPdfDocument } from '@/lib/pdfHelper';
import type { BankRePledge, BankRePledgeStatus, GoldCollateral } from '@/types/database';

interface RePledgeCardProps {
  loan: any;
  repledge: BankRePledge | null;
  collateral?: GoldCollateral[];
  onRefresh?: () => void;
  showNewButton?: boolean;
}

export default function RePledgeCard({
  loan,
  repledge,
  collateral = [],
  onRefresh,
  showNewButton = true,
}: RePledgeCardProps) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [printing, setPrinting] = useState(false);

  // Status badge helper
  const getStatusBadge = (status: BankRePledgeStatus) => {
    switch (status) {
      case 'Active':
      case 'Pledged with Bank':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 size={13} /> Pledged with Bank (Active)
          </span>
        );
      case 'Pending Approval':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <Clock size={13} /> Pending Approval
          </span>
        );
      case 'Released':
      case 'Closed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300">
            <RotateCcw size={13} /> Released to PGF Safe
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-800 border border-gray-300">
            {status}
          </span>
        );
    }
  };

  // If no re-pledge exists for this loan
  if (!repledge) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 text-slate-500 flex items-center justify-center shrink-0">
              <Building2 size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                  Bank Re-Pledge Details
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-600 border border-gray-200">
                  No Re-Pledge Available
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                All pledged gold ornaments for this loan are held under secure physical custody in{' '}
                <span className="font-semibold text-emerald-700">PGF Safe Room</span>.
              </p>
            </div>
          </div>

          {showNewButton && loan && (
            <Link
              href={`/admin/re-pledge/new?loanId=${loan.id}`}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors shrink-0"
            >
              <Building2 size={14} />
              Re-Pledge to Bank
            </Link>
          )}
        </div>
      </div>
    );
  }

  const isCustodyInSafe = repledge.status === 'Released' || repledge.status === 'Closed';
  const pdfUrl = getPdfApiUrl({
    type: 'repledge',
    repledgeId: repledge.id,
    loanId: loan?.id || repledge.loan_id,
  });

  // Handle Download PDF
  const handleDownloadPdf = async () => {
    try {
      setDownloading(true);
      await downloadPdfDocument(
        {
          type: 'repledge',
          repledgeId: repledge.id,
          loanId: loan?.id || repledge.loan_id,
          download: true,
        },
        `repledge_${repledge.repledge_number}.pdf`
      );
    } catch (err) {
      console.error('Download error:', err);
    } finally {
      setDownloading(false);
    }
  };

  // Handle Print PDF
  const handlePrintPdf = async () => {
    try {
      setPrinting(true);
      await printPdfDocument({
        type: 'repledge',
        repledgeId: repledge.id,
        loanId: loan?.id || repledge.loan_id,
      });
    } catch (err) {
      console.error('Print error:', err);
    } finally {
      setPrinting(false);
    }
  };

  // Match re-pledged ornaments with full collateral data if available
  const linkedOrnamentItems = repledge.ornament_details || [];

  return (
    <div className="bg-white rounded-2xl border-2 border-amber-300/80 shadow-sm overflow-hidden space-y-0">
      {/* Header Bar */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 p-5 text-white flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-300 flex items-center justify-center shrink-0">
            <Building2 size={22} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-amber-300">
                Institutional Bank Re-Pledge
              </span>
              {getStatusBadge(repledge.status)}
            </div>
            <div className="flex items-center gap-3 mt-0.5">
              <h2 className="text-xl font-black font-mono tracking-tight text-white">
                {repledge.repledge_number}
              </h2>
              <span className="text-sm font-semibold text-slate-300">
                • {repledge.bank_name} ({repledge.bank_branch})
              </span>
            </div>
          </div>
        </div>

        {/* Receipt & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsPreviewOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold border border-white/20 transition-colors"
          >
            <Eye size={14} /> View Receipt
          </button>
          <button
            type="button"
            onClick={handlePrintPdf}
            disabled={printing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold border border-white/20 transition-colors disabled:opacity-50"
          >
            <Printer size={14} /> {printing ? 'Preparing...' : 'Print'}
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={downloading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-black transition-colors disabled:opacity-50"
          >
            <Download size={14} /> {downloading ? 'Downloading...' : 'Download PDF'}
          </button>
          <Link
            href={`/admin/re-pledge/${repledge.id}`}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors"
          >
            Dossier <ExternalLink size={12} />
          </Link>
        </div>
      </div>

      {/* Custody Alert Banner */}
      <div
        className={`px-6 py-3.5 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
          isCustodyInSafe
            ? 'bg-emerald-50 text-emerald-950 border-emerald-200'
            : 'bg-amber-50/90 text-amber-950 border-amber-200'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
              isCustodyInSafe ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
            }`}
          >
            {isCustodyInSafe ? <RotateCcw size={16} /> : <Lock size={16} />}
          </div>
          <div>
            <span className="font-bold block">
              {isCustodyInSafe
                ? 'Physical Gold Custody: Safely Returned to PGF Safe Room'
                : `Physical Gold Custody: In Commercial Bank Branch (${repledge.custody_location})`}
            </span>
            <span className="text-[11px] opacity-80 block">
              {isCustodyInSafe
                ? `Settled on ${new Date(repledge.release_date || repledge.released_at || '').toLocaleDateString('en-IN')}. Reference: ${repledge.bank_release_reference || 'N/A'}`
                : 'Customer gold release remains locked until bank settlement and physical return to PGF Safe.'}
            </span>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <span className="text-[10px] uppercase font-bold text-gray-500 block">Total Re-Pledged Weight</span>
          <span className="text-sm font-black text-amber-800 font-mono">
            {repledge.total_net_weight.toFixed(2)}g Net
          </span>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* KPI Financial Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-100">
            <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">
              Bank Pledge Amount
            </span>
            <span className="text-lg font-black text-gray-900 block mt-0.5">
              ₹{repledge.bank_pledge_amount.toLocaleString('en-IN')}
            </span>
            <span className="text-[10px] text-gray-500 block">Sanctioned Institutional</span>
          </div>

          <div className="p-3.5 bg-purple-50/60 rounded-xl border border-purple-100">
            <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">
              Bank Interest Rate
            </span>
            <span className="text-lg font-black text-purple-900 block mt-0.5">
              {repledge.bank_interest_rate}% p.a.
            </span>
            <span className="text-[10px] text-gray-500 block">Type: {repledge.interest_type || 'Simple'}</span>
          </div>

          <div className="p-3.5 bg-amber-50/60 rounded-xl border border-amber-100">
            <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider block">
              Bank Outstanding
            </span>
            <span className="text-lg font-black text-amber-950 block mt-0.5">
              ₹{(repledge.bank_outstanding || (isCustodyInSafe ? 0 : repledge.bank_pledge_amount)).toLocaleString('en-IN')}
            </span>
            <span className="text-[10px] text-gray-500 block">
              Principal Repaid: ₹{(repledge.principal_repaid || 0).toLocaleString('en-IN')}
            </span>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider block">
              Pledge & Due Date
            </span>
            <span className="text-xs font-bold text-gray-900 block mt-1">
              Pledged: {new Date(repledge.pledge_date).toLocaleDateString('en-IN')}
            </span>
            <span className="text-[11px] text-gray-600 block mt-0.5">
              Due: {repledge.due_date ? new Date(repledge.due_date).toLocaleDateString('en-IN') : '12 Months'}
            </span>
          </div>
        </div>

        {/* Detailed Bank & Ownership Information Grid */}
        <div className="bg-slate-50/70 rounded-xl border border-slate-200/80 p-4">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 size={14} className="text-blue-600" />
              Bank & Ownership Specifications
            </h4>
            <span className="text-[10px] font-semibold text-blue-700 bg-blue-100/60 px-2 py-0.5 rounded">
              Institutional Refinancing
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
            <div>
              <span className="text-[10px] font-semibold text-gray-400 uppercase block">Bank Name & Branch</span>
              <span className="font-bold text-gray-900">{repledge.bank_name}</span>
              <span className="text-[11px] text-gray-500 block">{repledge.bank_branch}</span>
            </div>

            <div>
              <span className="text-[10px] font-semibold text-gray-400 uppercase block">Bank Account Number</span>
              <span className="font-mono font-bold text-gray-800">{repledge.bank_account_number || 'N/A'}</span>
            </div>

            <div>
              <span className="text-[10px] font-semibold text-gray-400 uppercase block">Bank Loan / Pledge #</span>
              <span className="font-mono font-bold text-blue-800">
                {repledge.bank_loan_number || repledge.bank_pledge_ticket_number || repledge.bank_reference_number || 'N/A'}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-semibold text-gray-400 uppercase block">Gold Pledged In Name Of</span>
              <span className="font-bold text-purple-900">
                {repledge.pledge_name || 'Pavithra Gold Finance / Authorized Signatory'}
              </span>
            </div>

            <div>
              <span className="text-[10px] font-semibold text-gray-400 uppercase block">Underlying Customer Loan</span>
              <span className="font-mono font-bold text-emerald-800">{repledge.loan_number}</span>
              <span className="text-[10px] text-gray-500 block">
                {repledge.customer_name} ({repledge.customer_id})
              </span>
            </div>

            <div>
              <span className="text-[10px] font-semibold text-gray-400 uppercase block">Responsible Branch</span>
              <span className="font-semibold text-gray-800">
                {repledge.branch_name || 'Madurai Main Hub (MDU-01)'}
              </span>
            </div>
          </div>
        </div>

        {/* Exact Re-Pledged Ornament Linkage Table */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-1.5">
              <Coins size={14} className="text-amber-600" />
              Re-Pledged Ornament Linkage ({linkedOrnamentItems.length} Items)
            </h4>
            <span className="text-xs font-semibold text-amber-800">
              Customer Loan ({repledge.loan_number}) → {repledge.bank_name}
            </span>
          </div>

          <div className="border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-600 font-semibold uppercase text-[10px]">
                <tr>
                  <th className="p-2.5">#</th>
                  <th className="p-2.5">Ornament Description</th>
                  <th className="p-2.5">Purity</th>
                  <th className="p-2.5">Gross Wt</th>
                  <th className="p-2.5">Stone Wt</th>
                  <th className="p-2.5">Net Wt</th>
                  <th className="p-2.5 text-right">Valuation</th>
                  <th className="p-2.5">Custody Location</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {linkedOrnamentItems.map((item, idx) => {
                  // Check if matching collateral item has photo
                  const matchingCol = collateral.find((c) => c.id === item.item_id);
                  const rawPhoto = matchingCol?.front_photo_url || matchingCol?.photos?.[0];
                  const photoUrl = typeof rawPhoto === 'string' ? rawPhoto : (rawPhoto as any)?.url;

                  return (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="p-2.5 text-gray-400 font-mono">{idx + 1}</td>
                      <td className="p-2.5 font-bold text-gray-900">
                        <div className="flex items-center gap-2">
                          {photoUrl && (
                            <img
                              src={photoUrl}
                              alt={item.description}
                              className="w-7 h-7 rounded object-cover border border-gray-200 shrink-0"
                            />
                          )}
                          <div>
                            <span>{item.description}</span>
                            <span className="text-[10px] text-gray-400 block font-mono">
                              ID: {item.item_id}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="p-2.5 font-medium text-amber-700">{item.purity_karat}</td>
                      <td className="p-2.5 font-mono text-gray-700">{(item.gross_weight || 0).toFixed(2)}g</td>
                      <td className="p-2.5 font-mono text-gray-500">{(item.stone_weight || 0).toFixed(2)}g</td>
                      <td className="p-2.5 font-mono font-bold text-amber-900">
                        {(item.net_weight || 0).toFixed(2)}g
                      </td>
                      <td className="p-2.5 font-mono text-right font-medium text-gray-900">
                        ₹{(item.valuation_inr || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="p-2.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                            isCustodyInSafe
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {isCustodyInSafe ? 'PGF Safe' : `${repledge.bank_name}`}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50 font-bold text-gray-900 border-t border-gray-200 text-xs">
                <tr>
                  <td colSpan={3} className="p-2.5">
                    Total Re-Pledged Collateral:
                  </td>
                  <td className="p-2.5 font-mono">
                    {linkedOrnamentItems.reduce((acc, i) => acc + (i.gross_weight || 0), 0).toFixed(2)}g
                  </td>
                  <td className="p-2.5 font-mono">
                    {linkedOrnamentItems.reduce((acc, i) => acc + (i.stone_weight || 0), 0).toFixed(2)}g
                  </td>
                  <td className="p-2.5 font-mono text-amber-800 font-extrabold">
                    {repledge.total_net_weight.toFixed(2)}g
                  </td>
                  <td className="p-2.5 font-mono text-right text-blue-700 font-extrabold">
                    ₹{repledge.total_valuation.toLocaleString('en-IN')}
                  </td>
                  <td className="p-2.5 text-[10px] text-gray-500">
                    {isCustodyInSafe ? 'Returned' : 'In Bank'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Dual-Ledger & Release Lock Disclaimer */}
        <div className="p-3.5 bg-blue-50/70 rounded-xl border border-blue-200/80 flex items-start gap-2.5 text-xs text-blue-950">
          <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">
              Institutional Dual-Ledger Protocol & Release Safeguard:
            </p>
            <p className="text-[11px] text-blue-900/90 leading-relaxed">
              1. <strong>Dual Ledger:</strong> Customer loan repayments update the customer loan ledger only. Bank borrowing and interest remain strictly isolated on the institutional ledger.
              <br />
              2. <strong>Release Lock:</strong> Collateral cannot be physically handed over to the customer until the bank re-pledge is settled and ornaments safely return to the PGF Safe room.
            </p>
          </div>
        </div>
      </div>

      {/* PDF Preview Modal */}
      {isPreviewOpen && (
        <PDFPreviewModal
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
          pdfUrl={pdfUrl}
          title={`Bank Re-Pledge Receipt — ${repledge.repledge_number}`}
        />
      )}
    </div>
  );
}
