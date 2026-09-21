// src/app/admin/investments/withdrawals/page.tsx
// Withdrawal Requests & Approvals Queue for Admin.
// 2-stage workflow: Review/Approve -> Mark Payment Completed with UTR & settlement details.

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Search,
  Filter,
  CreditCard,
  Building,
  Phone,
  User,
  ArrowDownLeft,
  DollarSign,
  ChevronRight,
  FileCheck,
} from 'lucide-react';
import { db, auth } from '@/lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import {
  approveWithdrawalRequest,
  completeWithdrawalPayment,
} from '@/lib/db/investments';
import type { WithdrawalRequest, WithdrawalStatus } from '@/types/database';

export default function AdminWithdrawalsPage() {
  const [requests, setRequests] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('Pending');
  const [search, setSearch] = useState('');

  // Complete Payment Modal state
  const [completeModal, setCompleteModal] = useState<WithdrawalRequest | null>(null);
  const [paidAmount, setPaidAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentMode, setPaymentMode] = useState('IMPS');
  const [utrNumber, setUtrNumber] = useState('');
  const [adminNotes, setAdminNotes] = useState('');

  const loadRequests = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = query(collection(db, 'withdrawal_requests'), orderBy('created_at', 'desc'));
      const snap = await getDocs(q);
      const list: WithdrawalRequest[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<WithdrawalRequest, 'id'>),
      }));
      setRequests(list);
    } catch (err: any) {
      console.error('Error loading withdrawal requests:', err);
      setError(err.message || 'Failed to load withdrawal requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const handleApprove = async (withdrawalId: string) => {
    if (!confirm('Approve this withdrawal request for payment processing?')) return;
    setProcessingId(withdrawalId);
    setError(null);
    setSuccessMsg(null);

    try {
      const adminUid = auth.currentUser?.uid || 'admin';
      await approveWithdrawalRequest(withdrawalId, adminUid);
      setSuccessMsg(`Withdrawal ${withdrawalId} approved for payment processing.`);
      await loadRequests();
    } catch (err: any) {
      console.error('Error approving withdrawal:', err);
      setError(err.message || 'Failed to approve withdrawal.');
    } finally {
      setProcessingId(null);
    }
  };

  const openCompleteModal = (req: WithdrawalRequest) => {
    setCompleteModal(req);
    setPaidAmount(String(req.approved_amount || req.requested_amount));
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentMode('IMPS');
    setUtrNumber('');
    setAdminNotes('');
  };

  const handleCompleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completeModal || !utrNumber.trim()) {
      setError('Please enter a valid UTR / Bank Reference Number.');
      return;
    }

    setProcessingId(completeModal.id);
    setError(null);
    setSuccessMsg(null);

    try {
      const adminUid = auth.currentUser?.uid || 'admin';
      await completeWithdrawalPayment({
        withdrawal_id: completeModal.id,
        paid_amount: Number(paidAmount),
        payment_date: paymentDate,
        payment_mode: paymentMode,
        utr_number: utrNumber.trim(),
        admin_notes: adminNotes.trim(),
        completed_by: adminUid,
      });

      setSuccessMsg(`Withdrawal payment completed and settled successfully!`);
      setCompleteModal(null);
      await loadRequests();
    } catch (err: any) {
      console.error('Error completing withdrawal payment:', err);
      setError(err.message || 'Failed to complete withdrawal payment.');
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
      r.withdrawal_number.toLowerCase().includes(q) ||
      (r.utr_number && r.utr_number.toLowerCase().includes(q));
    return matchStatus && matchSearch;
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-purple-100 text-purple-800">
              Withdrawal Management
            </span>
            <span className="text-xs text-gray-500 font-semibold">
              {requests.filter((r) => r.status === 'Pending' || r.status === 'Payment_Processing').length} Active Requests
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 font-outfit">Withdrawal Requests & Settlement</h1>
          <p className="text-xs text-gray-500">
            Review investor redemption requests, authorize bank disbursements, and record atomic settlement UTRs.
          </p>
        </div>

        <button
          onClick={loadRequests}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-all cursor-pointer"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          Refresh
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

      {/* Filter & Search */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="relative flex-1 w-full">
          <Search size={16} className="absolute left-3.5 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search by Investor Name, ID, or Withdrawal Number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-100"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter size={15} className="text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-gray-200 text-xs text-gray-700 bg-white focus:outline-none"
          >
            <option value="Pending">Pending Review</option>
            <option value="Payment_Processing">Payment Processing</option>
            <option value="Completed">Completed</option>
            <option value="Rejected">Rejected</option>
            <option value="All">All Requests</option>
          </select>
        </div>
      </div>

      {/* Withdrawals Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-gray-50/80 text-gray-500 font-bold border-b border-gray-100 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Request No</th>
                <th className="px-5 py-3.5">Investor</th>
                <th className="px-5 py-3.5">Requested Amount</th>
                <th className="px-5 py-3.5">Bank / UPI Details</th>
                <th className="px-5 py-3.5">Request Date</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-gray-400">
                    <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-purple-600" />
                    Loading withdrawal requests...
                  </td>
                </tr>
              ) : filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-gray-400">
                    No withdrawal requests in this category.
                  </td>
                </tr>
              ) : (
                filteredRequests.map((w) => (
                  <tr key={w.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-4 font-mono font-bold text-gray-900">{w.withdrawal_number}</td>
                    <td className="px-5 py-4">
                      <div className="font-bold text-gray-900">{w.investor_name}</div>
                      <div className="text-[10px] text-gray-500 font-mono">
                        {w.investor_number} &bull; {w.investor_phone}
                      </div>
                    </td>
                    <td className="px-5 py-4 font-mono font-extrabold text-purple-700 text-sm">
                      {formatINR(w.requested_amount)}
                    </td>
                    <td className="px-5 py-4">
                      {w.bank_account_details ? (
                        <div className="text-[11px] text-gray-700 font-mono">
                          {w.bank_account_details.bank_name && (
                            <div className="font-bold text-gray-900">{w.bank_account_details.bank_name}</div>
                          )}
                          {w.bank_account_details.account_number && (
                            <div>A/C: {w.bank_account_details.account_number}</div>
                          )}
                          {w.bank_account_details.ifsc_code && (
                            <div>IFSC: {w.bank_account_details.ifsc_code}</div>
                          )}
                          {w.bank_account_details.upi_id && (
                            <div className="text-blue-600">UPI: {w.bank_account_details.upi_id}</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-[11px]">Primary Bank on File</span>
                      )}
                    </td>
                    <td className="px-5 py-4 font-mono text-gray-600">{w.request_date}</td>
                    <td className="px-5 py-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          w.status === 'Completed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : w.status === 'Payment_Processing'
                            ? 'bg-blue-100 text-blue-800'
                            : w.status === 'Rejected'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {w.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      {w.status === 'Pending' && (
                        <button
                          onClick={() => handleApprove(w.id)}
                          disabled={processingId === w.id}
                          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-sm transition-all cursor-pointer disabled:opacity-50"
                        >
                          Approve Request
                        </button>
                      )}

                      {w.status === 'Payment_Processing' && (
                        <button
                          onClick={() => openCompleteModal(w)}
                          disabled={processingId === w.id}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm transition-all cursor-pointer disabled:opacity-50"
                        >
                          Mark Paid & Settle
                        </button>
                      )}

                      {w.status === 'Completed' && (
                        <div className="text-[11px] text-gray-500 font-mono">
                          Paid: {w.payment_date} &bull; UTR: {w.utr_number}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Complete Payment Settlement Modal */}
      {completeModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4 backdrop-blur-sm">
          <form onSubmit={handleCompleteSubmit} className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-gray-900">Record Withdrawal Settlement</h3>
                <span className="text-xs text-gray-500 font-mono">Request: {completeModal.withdrawal_number}</span>
              </div>
              <button
                type="button"
                onClick={() => setCompleteModal(null)}
                className="text-gray-400 hover:text-gray-600 font-bold text-sm"
              >
                &times;
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-purple-50 border border-purple-100 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-600 font-semibold">Investor:</span>
                <span className="font-bold text-gray-900">{completeModal.investor_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 font-semibold">Requested Amount:</span>
                <span className="font-mono font-bold text-purple-700">{formatINR(completeModal.requested_amount)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">Settled / Paid Amount (₹)</label>
                <input
                  type="number"
                  required
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 font-mono font-bold text-emerald-700"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">Payment Date</label>
                <input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">Payment Mode</label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200"
                >
                  <option value="IMPS">IMPS Transfer</option>
                  <option value="NEFT">NEFT</option>
                  <option value="RTGS">RTGS</option>
                  <option value="UPI">UPI</option>
                  <option value="Bank_Transfer">Direct Bank Transfer</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">UTR / Ref Number *</label>
                <input
                  type="text"
                  required
                  placeholder="Bank UTR Number"
                  value={utrNumber}
                  onChange={(e) => setUtrNumber(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 font-mono font-semibold"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600">Admin Notes / Remarks</label>
              <textarea
                rows={2}
                placeholder="Optional settlement notes..."
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                className="w-full p-2 text-xs rounded-xl border border-gray-200"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setCompleteModal(null)}
                className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={processingId === completeModal.id}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50"
              >
                Confirm Settlement & Deduct Balance
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
