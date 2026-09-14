'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Building2,
  ArrowLeft,
  CheckCircle2,
  Clock,
  RotateCcw,
  Coins,
  ShieldCheck,
  AlertTriangle,
  User,
  FileText,
  Calendar,
  Lock,
  ArrowRight,
  ExternalLink,
  DollarSign,
  Printer,
  FileSpreadsheet
} from 'lucide-react';
import { getBankRePledgeById, approveBankRePledge, recordBankRepledgeRelease } from '@/lib/db/repledge';
import { getCurrentProfile } from '@/lib/auth';
import type { BankRePledge, BankRePledgeStatus, Profile } from '@/types/database';

export default function BankRePledgeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [repledge, setRepledge] = useState<BankRePledge | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Approval Modal / State
  const [approving, setApproving] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState('');

  // Release Modal / State
  const [showReleaseModal, setShowReleaseModal] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [bankAmountRepaid, setBankAmountRepaid] = useState<string>('');
  const [bankInterestSettled, setBankInterestSettled] = useState<string>('');
  const [bankReleaseReference, setBankReleaseReference] = useState('');
  const [releaseRemarks, setReleaseRemarks] = useState('');
  const [releaseError, setReleaseError] = useState<string | null>(null);

  // Load record
  const loadRecord = async () => {
    try {
      setLoading(true);
      const prof = await getCurrentProfile();
      setCurrentProfile(prof);
      setIsAdmin(prof?.role === 'Admin' || prof?.role === 'Owner');

      const data = await getBankRePledgeById(id);
      setRepledge(data);

      if (data) {
        setBankAmountRepaid(String(data.bank_outstanding || data.bank_pledge_amount || ''));
        setBankInterestSettled('');
      }
    } catch (err) {
      console.error('Error loading bank re-pledge record:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadRecord();
    }
  }, [id]);

  // Handle Approve Action
  const handleApprove = async () => {
    if (!repledge) return;
    if (!confirm(`Approve Bank Re-Pledge ${repledge.repledge_number} with ${repledge.bank_name}? Ornaments will be marked as in Bank Custody.`)) return;

    setApproving(true);
    try {
      await approveBankRePledge(
        repledge.id,
        currentProfile?.id || 'admin_user',
        currentProfile?.name || 'Administrator',
        approvalNotes
      );
      await loadRecord();
    } catch (err: any) {
      alert(err.message || 'Approval failed');
    } finally {
      setApproving(false);
    }
  };

  // Handle Release Action
  const handleRecordRelease = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repledge) return;

    const principalRepaid = parseFloat(bankAmountRepaid);
    const interestSettled = parseFloat(bankInterestSettled || '0');

    if (isNaN(principalRepaid) || principalRepaid < 0) {
      setReleaseError('Please enter a valid principal amount repaid to the bank.');
      return;
    }

    if (!bankReleaseReference.trim()) {
      setReleaseError('Please enter the Bank Release / Settlement Reference Number.');
      return;
    }

    setReleasing(true);
    setReleaseError(null);

    try {
      const totalSettlement = principalRepaid + (isNaN(interestSettled) ? 0 : interestSettled);

      await recordBankRepledgeRelease(
        repledge.id,
        {
          bank_amount_repaid: principalRepaid,
          bank_interest_settled: isNaN(interestSettled) ? 0 : interestSettled,
          total_bank_settlement: totalSettlement,
          bank_release_reference: bankReleaseReference.trim(),
          release_remarks: releaseRemarks.trim() || undefined,
        },
        currentProfile?.id || 'staff_user',
        currentProfile?.name || 'Staff Member'
      );

      setShowReleaseModal(false);
      await loadRecord();
    } catch (err: any) {
      setReleaseError(err.message || 'Failed to record release.');
    } finally {
      setReleasing(false);
    }
  };

  const getStatusBadge = (status: BankRePledgeStatus) => {
    switch (status) {
      case 'Active':
      case 'Pledged with Bank':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 size={14} /> Pledged with Bank (Active)
          </span>
        );
      case 'Pending Approval':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <Clock size={14} /> Pending Approval
          </span>
        );
      case 'Released':
      case 'Closed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300">
            <RotateCcw size={14} /> Released to PGF Safe
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

  if (loading) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Loading Bank Re-Pledge Details...
        </p>
      </div>
    );
  }

  if (!repledge) {
    return (
      <div className="max-w-xl mx-auto p-12 text-center bg-white rounded-2xl border border-gray-200 shadow-sm space-y-4">
        <AlertTriangle size={36} className="mx-auto text-amber-500" />
        <h2 className="text-lg font-bold text-gray-900">Re-Pledge Record Not Found</h2>
        <p className="text-xs text-gray-500">The requested bank re-pledge document does not exist.</p>
        <Link
          href="/admin/re-pledge"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold"
        >
          Return to Dashboard
        </Link>
      </div>
    );
  }

  const isCustodyInSafe = repledge.status === 'Released' || repledge.status === 'Closed';

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200/80 shadow-sm">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/re-pledge"
            className="p-2 rounded-xl bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-black text-gray-900 tracking-tight font-mono">
                {repledge.repledge_number}
              </h1>
              {getStatusBadge(repledge.status)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Created on {new Date(repledge.created_at).toLocaleString('en-IN')} by {repledge.created_by_name}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {repledge.status === 'Pending Approval' && isAdmin && (
            <button
              onClick={handleApprove}
              disabled={approving}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              <CheckCircle2 size={14} />
              {approving ? 'Approving...' : 'Approve Re-Pledge'}
            </button>
          )}

          {(repledge.status === 'Active' || repledge.status === 'Pledged with Bank') && (
            <button
              onClick={() => setShowReleaseModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5"
            >
              <RotateCcw size={14} />
              Release Gold to PGF Safe
            </button>
          )}
        </div>
      </div>

      {/* Custody Location Banner */}
      <div
        className={`p-5 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-4 ${
          isCustodyInSafe
            ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
            : 'bg-blue-50/70 border-blue-200 text-blue-950'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isCustodyInSafe ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white'
            }`}
          >
            {isCustodyInSafe ? <RotateCcw size={20} /> : <Building2 size={20} />}
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-75 block">
              Physical Gold Custody Status
            </span>
            <div className="text-base font-extrabold flex items-center gap-2">
              <span>{isCustodyInSafe ? 'Returned to PGF Safe Room' : `In Custody: ${repledge.custody_location}`}</span>
            </div>
            <p className="text-xs opacity-80 mt-0.5">
              {isCustodyInSafe
                ? `Released on ${new Date(repledge.release_date || repledge.released_at || '').toLocaleDateString('en-IN')} by ${repledge.released_by_name}. Reference: ${repledge.bank_release_reference || 'N/A'}`
                : `Pledged on ${new Date(repledge.pledge_date).toLocaleDateString('en-IN')}. Due date: ${repledge.due_date ? new Date(repledge.due_date).toLocaleDateString('en-IN') : 'N/A'}`}
            </p>
          </div>
        </div>

        <div className="text-right shrink-0 bg-white/70 px-4 py-2 rounded-xl border border-current/10">
          <span className="text-[10px] font-bold uppercase tracking-wider block opacity-70">Total Net Weight</span>
          <span className="text-lg font-black text-amber-800 font-mono">
            {repledge.total_net_weight.toFixed(2)}g
          </span>
        </div>
      </div>

      {/* Main Grid: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Bank Pledge Terms & Segregated Finances */}
        <div className="space-y-6">
          {/* Institutional Bank Terms */}
          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Building2 size={18} className="text-blue-600" />
                Bank / Institutional Terms
              </h2>
              <span className="text-xs font-semibold px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md">
                Institutional Ledger
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-semibold">Bank Name</span>
                <span className="font-bold text-gray-900 text-sm">{repledge.bank_name}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-semibold">Bank Branch</span>
                <span className="font-bold text-gray-900 text-sm">{repledge.bank_branch}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-semibold">Bank Account / Loan A/C</span>
                <span className="font-mono font-bold text-gray-800">{repledge.bank_account_number || 'N/A'}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-semibold">Pledge Date</span>
                <span className="font-semibold text-gray-800">
                  {new Date(repledge.pledge_date).toLocaleDateString('en-IN')}
                </span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-semibold">Bank Interest Rate</span>
                <span className="font-bold text-purple-700 text-sm">
                  {repledge.bank_interest_rate}% p.a.
                </span>
                <span className="text-[10px] text-gray-400 block">({repledge.interest_type || 'Simple'})</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-semibold">Due Date</span>
                <span className="font-semibold text-gray-800">
                  {repledge.due_date ? new Date(repledge.due_date).toLocaleDateString('en-IN') : 'N/A'}
                </span>
              </div>
              {repledge.bank_reference_number && (
                <div>
                  <span className="text-gray-400 block text-[10px] uppercase font-semibold">Bank Reference #</span>
                  <span className="font-mono font-semibold text-gray-800">{repledge.bank_reference_number}</span>
                </div>
              )}
              {repledge.bank_pledge_ticket_number && (
                <div>
                  <span className="text-gray-400 block text-[10px] uppercase font-semibold">Ticket / Sanction #</span>
                  <span className="font-mono font-semibold text-gray-800">{repledge.bank_pledge_ticket_number}</span>
                </div>
              )}
            </div>

            {repledge.remarks && (
              <div className="pt-3 border-t border-gray-100">
                <span className="text-gray-400 block text-[10px] uppercase font-semibold mb-1">Remarks / Handover Notes</span>
                <p className="text-xs text-gray-700 bg-gray-50 p-3 rounded-xl border border-gray-100">
                  {repledge.remarks}
                </p>
              </div>
            )}
          </div>

          {/* Segregated Financial Ledger */}
          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <DollarSign size={18} className="text-emerald-600" />
                Segregated Bank Financial Ledger
              </h2>
              <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                Isolated from Customer Loan
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                <span className="text-[10px] font-semibold text-gray-500 uppercase block">Sanctioned by Bank</span>
                <span className="text-lg font-black text-gray-900 block mt-0.5">
                  ₹{repledge.bank_pledge_amount.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                <span className="text-[10px] font-semibold text-gray-500 uppercase block">Bank Outstanding</span>
                <span className="text-lg font-black text-blue-700 block mt-0.5">
                  ₹{(repledge.bank_outstanding || (isCustodyInSafe ? 0 : repledge.bank_pledge_amount)).toLocaleString('en-IN')}
                </span>
              </div>

              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                <span className="text-[10px] font-semibold text-gray-500 uppercase block">Bank Interest Paid</span>
                <span className="text-lg font-black text-purple-700 block mt-0.5">
                  ₹{(repledge.interest_paid || repledge.bank_interest_settled || 0).toLocaleString('en-IN')}
                </span>
              </div>

              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                <span className="text-[10px] font-semibold text-gray-500 uppercase block">Bank Principal Repaid</span>
                <span className="text-lg font-black text-emerald-700 block mt-0.5">
                  ₹{(repledge.principal_repaid || repledge.bank_amount_repaid || 0).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {isCustodyInSafe && repledge.total_bank_settlement && (
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between text-xs">
                <span className="font-bold text-emerald-900">Total Bank Settlement:</span>
                <span className="font-black text-sm text-emerald-800">
                  ₹{repledge.total_bank_settlement.toLocaleString('en-IN')}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Permanent Linkage & Transferred Ornaments */}
        <div className="space-y-6">
          {/* Permanent Customer & Loan Linkage */}
          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <User size={18} className="text-purple-600" />
                Original Customer & Loan Linkage
              </h2>
              <Link
                href={`/admin/loans/${repledge.loan_id}`}
                className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
              >
                View Loan <ExternalLink size={12} />
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-semibold">Customer Name</span>
                <span className="font-bold text-gray-900 text-sm">{repledge.customer_name}</span>
                <span className="text-[10px] text-gray-400 block">ID: {repledge.customer_id}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-semibold">Original Loan #</span>
                <span className="font-mono font-bold text-blue-700 text-sm">{repledge.loan_number}</span>
                <span className="text-[10px] text-gray-400 block">
                  Originated: {new Date(repledge.original_loan_date).toLocaleDateString('en-IN')}
                </span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-semibold">Customer Loan Sanctioned</span>
                <span className="font-bold text-gray-900 text-sm">
                  ₹{repledge.original_loan_amount.toLocaleString('en-IN')}
                </span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-semibold">Customer Outstanding</span>
                <span className="font-bold text-emerald-700 text-sm">
                  ₹{repledge.current_loan_outstanding.toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          </div>

          {/* Transferred Ornaments Table */}
          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Coins size={18} className="text-amber-600" />
                Collateral Ornaments ({repledge.ornament_details?.length || 0})
              </h2>
              <span className="text-xs font-bold text-amber-800">
                {repledge.total_net_weight.toFixed(2)}g Net
              </span>
            </div>

            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-500 font-semibold uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Description</th>
                    <th className="p-3">Purity</th>
                    <th className="p-3">Net Wt</th>
                    <th className="p-3 text-right">Valuation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {repledge.ornament_details?.map((orn, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50">
                      <td className="p-3 font-semibold text-gray-900">{orn.description}</td>
                      <td className="p-3 font-medium text-amber-700">{orn.purity_karat}</td>
                      <td className="p-3 font-bold text-gray-900">{orn.net_weight.toFixed(2)}g</td>
                      <td className="p-3 text-right font-medium text-gray-900">
                        ₹{orn.valuation_inr.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50/70 font-bold text-gray-900 border-t border-gray-200 text-xs">
                  <tr>
                    <td colSpan={2} className="p-3">Total Collateral Transferred:</td>
                    <td className="p-3 text-amber-800 font-extrabold">{repledge.total_net_weight.toFixed(2)}g</td>
                    <td className="p-3 text-right text-blue-700 font-extrabold">
                      ₹{repledge.total_valuation.toLocaleString('en-IN')}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Release from Bank Modal */}
      {showReleaseModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-gray-100">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2 text-gray-900 font-bold text-lg">
                <RotateCcw size={20} className="text-blue-600" />
                Release Gold & Return to Safe
              </div>
              <button
                onClick={() => setShowReleaseModal(false)}
                className="text-gray-400 hover:text-gray-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {releaseError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs">
                {releaseError}
              </div>
            )}

            <form onSubmit={handleRecordRelease} className="space-y-4 text-xs">
              <p className="text-gray-600">
                Settling bank pledge <span className="font-bold">{repledge.repledge_number}</span> with{' '}
                <span className="font-bold">{repledge.bank_name}</span>. This will return all {repledge.ornament_details?.length || 0} ornaments (
                {repledge.total_net_weight.toFixed(2)}g) to the PGF Safe room.
              </p>

              <div>
                <label className="block font-bold text-gray-700 uppercase mb-1">
                  Bank Principal Repaid (₹) *
                </label>
                <input
                  type="number"
                  value={bankAmountRepaid}
                  onChange={(e) => setBankAmountRepaid(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-bold text-gray-900 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 uppercase mb-1">
                  Bank Interest Settled (₹)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 15000"
                  value={bankInterestSettled}
                  onChange={(e) => setBankInterestSettled(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-semibold text-gray-900 text-sm"
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 uppercase mb-1">
                  Bank Release Reference / Closure Voucher # *
                </label>
                <input
                  type="text"
                  placeholder="e.g. CLOSURE-SBI-991283"
                  value={bankReleaseReference}
                  onChange={(e) => setBankReleaseReference(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-900"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 uppercase mb-1">
                  Safe Room Verification Remarks
                </label>
                <textarea
                  rows={2}
                  placeholder="Confirmed physical return of packets, seal numbers verified by safe officer..."
                  value={releaseRemarks}
                  onChange={(e) => setReleaseRemarks(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-gray-900"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowReleaseModal(false)}
                  className="px-4 py-2 rounded-xl border border-gray-200 font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={releasing}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold disabled:opacity-50"
                >
                  {releasing ? 'Releasing & Returning Gold...' : 'Confirm Release to Safe'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
