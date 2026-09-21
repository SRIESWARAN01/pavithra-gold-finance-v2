// src/app/admin/investments/payments/page.tsx
// Pending Investment Payments Verification Queue.
// Review UTR, screenshot, payment mode, and execute atomic approval/rejection.

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Eye,
  RefreshCw,
  AlertCircle,
  Calendar,
  Phone,
  DollarSign,
  FileImage,
  ExternalLink,
  Search,
  Filter,
} from 'lucide-react';
import { db, auth } from '@/lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { approveInvestmentPayment, rejectInvestmentPayment } from '@/lib/db/investments';
import type { InvestmentPaymentRequest } from '@/types/database';

export default function InvestmentPaymentsPage() {
  const [requests, setRequests] = useState<InvestmentPaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filter & Search
  const [statusFilter, setStatusFilter] = useState<string>('Pending_Verification');
  const [search, setSearch] = useState('');

  // Screenshot preview modal
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Reject modal
  const [rejectModal, setRejectModal] = useState<{ id: string; name: string } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const loadRequests = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = query(collection(db, 'investment_payment_requests'), orderBy('created_at', 'desc'));
      const snap = await getDocs(q);
      const list: InvestmentPaymentRequest[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<InvestmentPaymentRequest, 'id'>),
      }));
      setRequests(list);
    } catch (err: any) {
      console.error('Error loading payment requests:', err);
      setError(err.message || 'Failed to load payment requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const handleApprove = async (requestId: string) => {
    if (!confirm('Are you sure you want to approve this investment payment? An investment lot will be created and posted atomically.')) {
      return;
    }

    setProcessingId(requestId);
    setError(null);
    setSuccessMsg(null);

    try {
      const adminUid = auth.currentUser?.uid || 'admin';
      const res = await approveInvestmentPayment(requestId, adminUid);
      setSuccessMsg(`Payment approved successfully! Created Lot: ${res.lot.lot_number}`);
      await loadRequests();
    } catch (err: any) {
      console.error('Error approving payment:', err);
      setError(err.message || 'Failed to approve payment.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectModal || !rejectReason.trim()) return;

    setProcessingId(rejectModal.id);
    setError(null);
    setSuccessMsg(null);

    try {
      const adminUid = auth.currentUser?.uid || 'admin';
      await rejectInvestmentPayment(rejectModal.id, rejectReason.trim(), adminUid);
      setSuccessMsg(`Payment request rejected.`);
      setRejectModal(null);
      setRejectReason('');
      await loadRequests();
    } catch (err: any) {
      console.error('Error rejecting payment:', err);
      setError(err.message || 'Failed to reject payment.');
    } finally {
      setProcessingId(null);
    }
  };

  const formatINR = (val?: number) => {
    return '₹' + (val || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  };

  const filteredRequests = requests.filter((r) => {
    const matchStatus = statusFilter === 'All' || r.status === statusFilter;
    const q = search.toLowerCase().trim();
    const matchSearch =
      !q ||
      r.investor_name.toLowerCase().includes(q) ||
      r.investor_number.toLowerCase().includes(q) ||
      r.utr_number.toLowerCase().includes(q) ||
      r.request_number.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-800">
              Payment Verification Queue
            </span>
            <span className="text-xs text-gray-500 font-semibold">
              {requests.filter((r) => r.status === 'Pending_Verification').length} Awaiting Approval
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 font-outfit">Investment Payment Approvals</h1>
          <p className="text-xs text-gray-500">
            Verify investor bank transfers, UTR references, and screenshots before activating investment lots.
          </p>
        </div>

        <button
          onClick={loadRequests}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-all cursor-pointer"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          Refresh Queue
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-3">
          <AlertCircle size={18} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-3">
          <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="relative flex-1 w-full">
          <Search size={16} className="absolute left-3.5 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search by Investor Name, ID, UTR, or Request Number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter size={15} className="text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-gray-200 text-xs text-gray-700 bg-white focus:outline-none"
          >
            <option value="Pending_Verification">Pending Verification</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
            <option value="All">All Requests</option>
          </select>
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-gray-50/80 text-gray-500 font-bold border-b border-gray-100 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Request No</th>
                <th className="px-5 py-3.5">Investor</th>
                <th className="px-5 py-3.5">Amount</th>
                <th className="px-5 py-3.5">Date / Mode</th>
                <th className="px-5 py-3.5">UTR / Ref</th>
                <th className="px-5 py-3.5">Proof</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-gray-400">
                    <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-blue-600" />
                    Loading payment queue...
                  </td>
                </tr>
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-gray-400">
                    No payment requests found in this view.
                  </td>
                </tr>
              ) : (
                filteredRequests.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-4 font-mono font-bold text-gray-900">{r.request_number}</td>
                    <td className="px-5 py-4">
                      <div className="font-bold text-gray-900">{r.investor_name}</div>
                      <div className="text-[10px] text-gray-500 font-mono">
                        {r.investor_number} &bull; {r.investor_phone}
                      </div>
                    </td>
                    <td className="px-5 py-4 font-mono font-extrabold text-emerald-700 text-sm">
                      {formatINR(r.amount)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-mono text-gray-900">{r.payment_date}</div>
                      <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                        {r.payment_mode}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-mono font-bold text-gray-800">{r.utr_number}</td>
                    <td className="px-5 py-4">
                      {r.screenshot_url ? (
                        <button
                          onClick={() => setPreviewUrl(r.screenshot_url || null)}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
                        >
                          <FileImage size={13} /> View
                        </button>
                      ) : (
                        <span className="text-gray-400 text-[11px]">None</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          r.status === 'Approved'
                            ? 'bg-emerald-100 text-emerald-800'
                            : r.status === 'Rejected'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {r.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      {r.status === 'Pending_Verification' ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleApprove(r.id)}
                            disabled={processingId === r.id}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm transition-all cursor-pointer disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => setRejectModal({ id: r.id, name: r.investor_name })}
                            disabled={processingId === r.id}
                            className="px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs transition-all cursor-pointer disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-gray-400">Processed</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Screenshot Preview Modal */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900">Payment Screenshot Proof</h3>
              <button
                onClick={() => setPreviewUrl(null)}
                className="text-gray-400 hover:text-gray-600 text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
            <div className="border border-gray-200 rounded-xl overflow-hidden max-h-[70vh] flex items-center justify-center bg-gray-50">
              <img src={previewUrl} alt="Payment Proof" className="max-h-full max-w-full object-contain" />
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm">
          <form onSubmit={handleRejectSubmit} className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-gray-900">Reject Payment Verification</h3>
            <p className="text-xs text-gray-500">
              Investor: <strong className="text-gray-900">{rejectModal.name}</strong>. Please provide a clear reason for rejecting this payment submission.
            </p>
            <textarea
              required
              rows={3}
              placeholder="e.g. UTR number does not match bank statement / Amount mismatch..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full p-3 text-xs rounded-xl border border-gray-200 focus:ring-2 focus:ring-red-100 focus:border-red-500 outline-none"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectModal(null)}
                className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={processingId === rejectModal.id}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
              >
                Confirm Rejection
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
