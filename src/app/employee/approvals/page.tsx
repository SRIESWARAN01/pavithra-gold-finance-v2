'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  User,
  Coins,
  FileText,
  Eye,
  Check,
  X,
  Search,
  RefreshCw,
  TrendingUp,
  Scale
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, getDocs } from 'firebase/firestore';
import { getCurrentProfile } from '@/lib/auth';
import { reviewApprovalRequest } from '@/lib/db/approvals';
import type { ApprovalRequest, Profile } from '@/types/database';

export default function ApprovalsQueuePage() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [pendingRequests, setPendingRequests] = useState<ApprovalRequest[]>([]);
  const [historyRequests, setHistoryRequests] = useState<ApprovalRequest[]>([]);
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
  const [searchQuery, setSearchQuery] = useState('');

  // Review Modal State
  const [selectedRequest, setSelectedRequest] = useState<ApprovalRequest | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [kycVerified, setKycVerified] = useState(false);
  const [goldVerified, setGoldVerified] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4000);
  };

  useEffect(() => {
    let unsubPending: (() => void) | undefined;

    async function initApprovals() {
      try {
        const prof = await getCurrentProfile();
        if (prof) setProfile(prof);

        // Real-time listener for pending approval requests
        const pendingQ = query(collection(db, 'approval_requests'), where('status', '==', 'Pending'));
        unsubPending = onSnapshot(pendingQ, (snap) => {
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ApprovalRequest));
          list.sort((a, b) => (b.requested_at || '').localeCompare(a.requested_at || ''));
          setPendingRequests(list);
          setLoading(false);
        });

        // Load historical reviewed requests
        loadHistory();
      } catch (err) {
        console.error('Error loading approvals:', err);
        setLoading(false);
      }
    }

    initApprovals();

    return () => {
      if (unsubPending) unsubPending();
    };
  }, []);

  const loadHistory = async () => {
    try {
      const snap = await getDocs(collection(db, 'approval_requests'));
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as ApprovalRequest))
        .filter((r) => r.status === 'Approved' || r.status === 'Rejected');
      list.sort((a, b) => (b.reviewed_at || '').localeCompare(a.reviewed_at || ''));
      setHistoryRequests(list);
    } catch (err) {
      console.error('Error loading approval history:', err);
    }
  };

  const handleDecision = async (requestId: string, decision: 'Approved' | 'Rejected') => {
    if (!profile) {
      showToast('You must be logged in to review requests.', 'error');
      return;
    }

    if (decision === 'Approved' && (!kycVerified || !goldVerified)) {
      showToast('Please confirm KYC verification and physical gold appraisal before approving.', 'error');
      return;
    }

    setProcessingId(requestId);
    try {
      await reviewApprovalRequest(requestId, decision, reviewNotes, profile);
      showToast(`Request successfully ${decision.toLowerCase()}!`);
      setSelectedRequest(null);
      setReviewNotes('');
      setKycVerified(false);
      setGoldVerified(false);
      await loadHistory();
    } catch (err: any) {
      console.error('Failed to review request:', err);
      showToast(err.message || 'Failed to review request', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const formatINR = (val: number) => '₹' + (val || 0).toLocaleString('en-IN');

  const filteredPending = pendingRequests.filter((r) => {
    const q = searchQuery.toLowerCase();
    const cust = r.details?.customer_name?.toLowerCase() || '';
    const loanNum = r.details?.loan_number?.toLowerCase() || '';
    const reqType = r.request_type.toLowerCase();
    return cust.includes(q) || loanNum.includes(q) || reqType.includes(q);
  });

  const filteredHistory = historyRequests.filter((r) => {
    const q = searchQuery.toLowerCase();
    const cust = r.details?.customer_name?.toLowerCase() || '';
    const loanNum = r.details?.loan_number?.toLowerCase() || '';
    return cust.includes(q) || loanNum.includes(q);
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Toast */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 text-xs font-bold ${
            toastMessage.type === 'success'
              ? 'bg-emerald-600 text-white'
              : 'bg-red-600 text-white'
          }`}
        >
          {toastMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          {toastMessage.text}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#2563EB] font-bold uppercase tracking-wider">
            <ShieldCheck size={14} /> Management Sanctioning Authority
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 font-outfit">Approvals &amp; Sanction Queue</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Review employee-submitted loan applications, verify KYC, ornament weights, purity, rate, and approve/reject disbursements.
          </p>
        </div>

        {/* Search & Tabs */}
        <div className="flex items-center gap-3">
          <div className="flex p-1 bg-gray-200/80 rounded-xl text-xs font-bold">
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-3.5 py-1.5 rounded-lg transition ${
                activeTab === 'pending'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Pending ({pendingRequests.length})
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-3.5 py-1.5 rounded-lg transition ${
                activeTab === 'history'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              History ({historyRequests.length})
            </button>
          </div>
        </div>
      </div>

      {/* Search Filter */}
      <div className="relative">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search by customer name, loan number, or request type..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-gray-900 outline-none focus:border-[#2563EB] shadow-sm"
        />
      </div>

      {/* Main Tab Content */}
      {activeTab === 'pending' ? (
        <div className="space-y-4">
          {loading ? (
            <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center space-y-3">
              <div className="w-8 h-8 border-3 border-[#2563EB] border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-xs text-gray-500 font-medium">Loading approval requests from Firebase...</p>
            </div>
          ) : filteredPending.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center space-y-3">
              <div className="w-12 h-12 bg-emerald-50 border border-emerald-200 rounded-full flex items-center justify-center text-emerald-600 mx-auto">
                <CheckCircle2 size={24} />
              </div>
              <h3 className="font-bold text-sm text-gray-900 font-outfit">No Pending Approval Requests</h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto">
                All employee loan applications and financial change requests have been reviewed and sanctioned.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {filteredPending.map((req) => (
                <div
                  key={req.id}
                  className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-4 hover:border-blue-300 transition"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                        {req.request_type.replace(/_/g, ' ')}
                      </span>
                      <span className="text-xs font-mono text-gray-500">
                        {req.details?.loan_number ? `Loan #${req.details.loan_number}` : `Req ID: ${req.id.substring(0, 8)}`}
                      </span>
                    </div>

                    <span className="text-[11px] text-gray-400">
                      Submitted: {req.requested_at ? new Date(req.requested_at).toLocaleString('en-IN') : 'Just now'}
                    </span>
                  </div>

                  {/* Core Details Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                    <div className="space-y-1">
                      <span className="text-gray-400 text-[10px] uppercase font-bold tracking-wider">Customer</span>
                      <span className="font-bold text-gray-900 block">{req.details?.customer_name || 'Customer'}</span>
                      <span className="text-[11px] text-gray-500 font-mono">{req.details?.customer_id || '—'}</span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-gray-400 text-[10px] uppercase font-bold tracking-wider">Requested Loan</span>
                      <span className="font-bold text-gray-900 text-sm block font-outfit text-[#2563EB]">
                        {formatINR(req.requested_amount || 0)}
                      </span>
                      {req.eligible_amount && (
                        <span className="text-[11px] text-gray-500">
                          Max Safe LTV: <strong>{formatINR(req.eligible_amount)}</strong>
                        </span>
                      )}
                    </div>

                    <div className="space-y-1">
                      <span className="text-gray-400 text-[10px] uppercase font-bold tracking-wider">Collateral Wt</span>
                      <span className="font-bold text-gray-900 block">
                        {req.details?.total_collateral_net_weight ? `${req.details.total_collateral_net_weight}g Net` : '—'}
                      </span>
                      <span className="text-[11px] text-gray-500">
                        Valuation: {formatINR(req.details?.total_valuation || 0)}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-gray-400 text-[10px] uppercase font-bold tracking-wider">Submitted By</span>
                      <span className="font-bold text-gray-900 block">{req.requested_by_name}</span>
                      <span className="text-[11px] text-gray-500">Role: {req.requested_by_role}</span>
                    </div>
                  </div>

                  {/* Reason Banner */}
                  {req.reason && (
                    <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900">
                      <strong>Submission Note:</strong> {req.reason}
                    </div>
                  )}

                  {/* Action Row */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <button
                      onClick={() => {
                        setSelectedRequest(req);
                        setReviewNotes('');
                        setKycVerified(false);
                        setGoldVerified(false);
                      }}
                      className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-[#2563EB] text-xs font-bold rounded-xl transition flex items-center gap-1.5"
                    >
                      <Eye size={14} /> Inspect &amp; Verify Loan Application
                    </button>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDecision(req.id, 'Rejected')}
                        disabled={processingId === req.id}
                        className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold rounded-xl transition flex items-center gap-1.5"
                      >
                        <X size={14} /> Reject
                      </button>
                      <button
                        onClick={() => {
                          setSelectedRequest(req);
                          setKycVerified(true);
                          setGoldVerified(true);
                        }}
                        disabled={processingId === req.id}
                        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-sm shadow-emerald-600/20"
                      >
                        <Check size={14} /> Sanction &amp; Approve
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* History Tab */
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Customer / Loan</th>
                <th className="px-5 py-3.5">Request Type</th>
                <th className="px-5 py-3.5">Amount</th>
                <th className="px-5 py-3.5">Decision</th>
                <th className="px-5 py-3.5">Reviewed By</th>
                <th className="px-5 py-3.5">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-700">
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-gray-400">
                    No historical approval decisions recorded yet.
                  </td>
                </tr>
              ) : (
                filteredHistory.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/80">
                    <td className="px-5 py-3 font-bold text-gray-900">
                      {item.details?.customer_name || 'Customer'}
                      <span className="block text-[10px] text-gray-400 font-mono">
                        {item.details?.loan_number || item.entity_id}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700">
                        {item.request_type.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-bold text-gray-900 font-outfit">
                      {formatINR(item.requested_amount || 0)}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          item.status === 'Approved'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {item.reviewed_by_name || 'Authority'}
                      <span className="block text-[10px] text-gray-400">
                        {item.reviewed_at ? new Date(item.reviewed_at).toLocaleDateString('en-IN') : '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-500 max-w-xs truncate">
                      {item.review_notes || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Review Verification Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-gray-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#2563EB]">
                  Sanction Verification Checklist
                </span>
                <h3 className="font-bold text-base text-gray-900 font-outfit">
                  {selectedRequest.request_type.replace(/_/g, ' ')}
                </h3>
              </div>
              <button
                onClick={() => setSelectedRequest(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>

            {/* Loan Overview */}
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Customer:</span>
                <span className="font-bold text-gray-900">{selectedRequest.details?.customer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Sanction Requested:</span>
                <span className="font-bold text-[#2563EB] text-sm font-outfit">
                  {formatINR(selectedRequest.requested_amount || 0)}
                </span>
              </div>
              {selectedRequest.eligible_amount && (
                <div className="flex justify-between">
                  <span className="text-gray-500">LTV Normal Eligible:</span>
                  <span className="font-bold text-gray-700">{formatINR(selectedRequest.eligible_amount)}</span>
                </div>
              )}
              {selectedRequest.details?.total_collateral_net_weight && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Pledged Collateral Net Wt:</span>
                  <span className="font-bold text-gray-900">{selectedRequest.details.total_collateral_net_weight}g</span>
                </div>
              )}
            </div>

            {/* Manager Verification Checkboxes */}
            <div className="space-y-2.5">
              <span className="text-xs font-bold text-gray-900 uppercase tracking-wider block font-outfit">
                Statutory Verification (Required for Approval)
              </span>

              <label className="flex items-start gap-2.5 p-3 rounded-xl border border-gray-200 hover:bg-gray-50 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={kycVerified}
                  onChange={(e) => setKycVerified(e.target.checked)}
                  className="w-4 h-4 mt-0.5 accent-[#2563EB] rounded cursor-pointer"
                />
                <span className="text-gray-700 leading-relaxed font-medium">
                  I have verified customer identity, residential address, Aadhaar/PAN, and ownership declaration.
                </span>
              </label>

              <label className="flex items-start gap-2.5 p-3 rounded-xl border border-gray-200 hover:bg-gray-50 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={goldVerified}
                  onChange={(e) => setGoldVerified(e.target.checked)}
                  className="w-4 h-4 mt-0.5 accent-[#2563EB] rounded cursor-pointer"
                />
                <span className="text-gray-700 leading-relaxed font-medium">
                  I have verified physical ornament weights, karat purity testing, storage bin custody, and valuation rate.
                </span>
              </label>
            </div>

            {/* Review Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                Manager / Sanctioning Notes
              </label>
              <textarea
                rows={2}
                placeholder="Enter remarks or approval reason..."
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                className="w-full bg-[#F3F4F6] border border-[#E5E7EB] rounded-xl p-3 text-xs text-gray-900 outline-none focus:border-[#2563EB]"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                className="px-4 py-2 border border-gray-300 text-gray-700 text-xs font-semibold rounded-xl hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDecision(selectedRequest.id, 'Rejected')}
                disabled={processingId === selectedRequest.id}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition"
              >
                Reject Request
              </button>
              <button
                type="button"
                onClick={() => handleDecision(selectedRequest.id, 'Approved')}
                disabled={processingId === selectedRequest.id || !kycVerified || !goldVerified}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:text-gray-500 text-white text-xs font-bold rounded-xl transition shadow-md shadow-emerald-600/20"
              >
                {processingId === selectedRequest.id ? 'Processing...' : 'Sanction & Disburse'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
