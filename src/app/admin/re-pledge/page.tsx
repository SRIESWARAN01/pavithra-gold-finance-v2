'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Building2,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  Coins,
  ArrowUpRight,
  Calendar,
  Lock,
  RotateCcw,
  FileText
} from 'lucide-react';
import { listenBankRePledges, calculateRePledgeMetrics, approveBankRePledge } from '@/lib/db/repledge';
import type { BankRePledge, BankRePledgeStatus } from '@/types/database';
import { getCurrentProfile } from '@/lib/auth';

export default function RePledgeDashboardPage() {
  const [repledges, setRepledges] = useState<BankRePledge[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [currentProfile, setCurrentProfile] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfile() {
      const p = await getCurrentProfile();
      setCurrentProfile(p);
    }
    loadProfile();

    // Subscribe to live Firestore updates
    const unsubscribe = listenBankRePledges((items) => {
      setRepledges(items);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const metrics = calculateRePledgeMetrics(repledges);

  const filteredRepledges = repledges.filter((item) => {
    // Status Filter
    if (statusFilter !== 'ALL') {
      if (statusFilter === 'ACTIVE' && item.status !== 'Active' && item.status !== 'Pledged with Bank') return false;
      if (statusFilter === 'PENDING' && item.status !== 'Pending Approval') return false;
      if (statusFilter === 'RELEASED' && item.status !== 'Released' && item.status !== 'Closed') return false;
    }

    // Search Query
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      item.repledge_number.toLowerCase().includes(query) ||
      item.bank_name.toLowerCase().includes(query) ||
      item.bank_branch.toLowerCase().includes(query) ||
      item.customer_name.toLowerCase().includes(query) ||
      item.loan_number.toLowerCase().includes(query) ||
      (item.bank_account_number && item.bank_account_number.toLowerCase().includes(query))
    );
  });

  const handleQuickApprove = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Approve this Bank Re-Pledge and transfer physical gold custody to the bank?')) return;
    try {
      setActionLoading(id);
      await approveBankRePledge(
        id,
        currentProfile?.id || 'admin_user',
        currentProfile?.name || 'Administrator',
        'Direct sanction from Re-Pledge Dashboard'
      );
    } catch (err: any) {
      alert(err.message || 'Failed to approve bank re-pledge');
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: BankRePledgeStatus) => {
    switch (status) {
      case 'Active':
      case 'Pledged with Bank':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300"><CheckCircle2 size={12} /> Pledged with Bank</span>;
      case 'Pending Approval':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300"><Clock size={12} /> Pending Approval</span>;
      case 'Released':
      case 'Closed':
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300"><RotateCcw size={12} /> Gold in Safe</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-300">{status}</span>;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200">
              <Building2 size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Bank Re-Pledge Management</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Custody and financial tracking for customer gold collateral re-pledged to institutional banks.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/admin/re-pledge/new"
            className="inline-flex items-center justify-center gap-2 bg-[#2563EB] hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-sm transition-all hover:shadow"
          >
            <Plus size={16} />
            New Bank Re-Pledge
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Active Pledges */}
        <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Active Bank Pledges</span>
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <CheckCircle2 size={16} />
            </span>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-black text-gray-900">{metrics.activePledgesCount}</span>
            <span className="text-xs text-gray-400 ml-2">/ {metrics.totalPledges} Total</span>
          </div>
        </div>

        {/* Amount with Banks */}
        <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount with Banks</span>
            <span className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Building2 size={16} />
            </span>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-black text-blue-600">
              ₹{metrics.activeAmountPledged.toLocaleString('en-IN')}
            </span>
            <span className="text-xs text-gray-400 block mt-0.5">Active Principal</span>
          </div>
        </div>

        {/* Gold in Bank Custody */}
        <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Gold in Bank Custody</span>
            <span className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <Coins size={16} />
            </span>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-black text-amber-700">
              {metrics.goldWithBanks.toFixed(2)} <span className="text-sm font-semibold">grams</span>
            </span>
            <span className="text-xs text-emerald-600 block mt-0.5 font-medium">
              {metrics.goldReturnedToSafe.toFixed(2)}g in PGF Safe
            </span>
          </div>
        </div>

        {/* Bank Due / Overdue */}
        <div className="bg-white p-5 rounded-xl border border-gray-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Upcoming Due Dates</span>
            <span className="p-2 bg-purple-50 text-purple-600 rounded-lg">
              <Calendar size={16} />
            </span>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-black text-gray-900">{metrics.upcomingDueCount}</span>
            <span className="text-xs text-amber-600 ml-2 font-medium">
              {metrics.overdueCount > 0 ? `(${metrics.overdueCount} Overdue)` : '(Next 30 Days)'}
            </span>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0">
          {[
            { key: 'ALL', label: 'All Pledges', count: repledges.length },
            { key: 'PENDING', label: 'Pending Approval', count: metrics.pendingApprovalsCount },
            { key: 'ACTIVE', label: 'Active with Bank', count: metrics.activePledgesCount },
            { key: 'RELEASED', label: 'Released to Safe', count: metrics.releasedPledgesCount },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                statusFilter === tab.key
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search bank, customer, loan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>
      </div>

      {/* Bank Re-Pledge Registry Table */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-500 font-semibold uppercase tracking-wider">
                <th className="px-5 py-3.5">Re-Pledge #</th>
                <th className="px-5 py-3.5">Customer & Loan</th>
                <th className="px-5 py-3.5">Bank & Branch</th>
                <th className="px-5 py-3.5">Gold Weight</th>
                <th className="px-5 py-3.5">Bank Pledge Amount</th>
                <th className="px-5 py-3.5">Bank Rate</th>
                <th className="px-5 py-3.5">Physical Custody</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="w-7 h-7 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-xs">Loading bank re-pledge records...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredRepledges.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <Building2 size={32} className="text-gray-300" />
                      <p className="text-sm font-semibold text-gray-700">No bank re-pledge records found</p>
                      <p className="text-xs text-gray-400">
                        {searchQuery ? 'Try clearing your search filters.' : 'Click "New Bank Re-Pledge" to initiate your first institutional pledge.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRepledges.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/60 transition-colors">
                    {/* Re-Pledge # */}
                    <td className="px-5 py-4 font-bold text-gray-900 whitespace-nowrap">
                      <Link
                        href={`/admin/re-pledge/${item.id}`}
                        className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                      >
                        {item.repledge_number}
                        <ArrowUpRight size={12} />
                      </Link>
                      <span className="text-[10px] text-gray-400 block font-normal mt-0.5">
                        {new Date(item.pledge_date || item.created_at).toLocaleDateString('en-IN')}
                      </span>
                    </td>

                    {/* Customer & Loan */}
                    <td className="px-5 py-4">
                      <div className="font-semibold text-gray-900">{item.customer_name}</div>
                      <div className="text-[11px] text-gray-500 flex items-center gap-1.5 mt-0.5">
                        <span className="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-[10px] text-gray-600">
                          {item.loan_number}
                        </span>
                      </div>
                    </td>

                    {/* Bank & Branch */}
                    <td className="px-5 py-4">
                      <div className="font-semibold text-gray-900">{item.bank_name}</div>
                      <div className="text-[11px] text-gray-500">{item.bank_branch}</div>
                      {item.bank_account_number && (
                        <span className="text-[10px] font-mono text-gray-400 block">
                          A/C: {item.bank_account_number}
                        </span>
                      )}
                    </td>

                    {/* Gold Weight */}
                    <td className="px-5 py-4">
                      <div className="font-semibold text-amber-800">
                        {item.total_net_weight ? item.total_net_weight.toFixed(2) : '0.00'}g Net
                      </div>
                      <div className="text-[10px] text-gray-400">
                        {item.ornament_details?.length || 0} Ornaments
                      </div>
                    </td>

                    {/* Bank Pledge Amount */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="font-bold text-gray-900">
                        ₹{(item.bank_pledge_amount || 0).toLocaleString('en-IN')}
                      </div>
                      <div className="text-[10px] text-gray-400">
                        Balance: ₹{(item.bank_outstanding || item.bank_pledge_amount || 0).toLocaleString('en-IN')}
                      </div>
                    </td>

                    {/* Bank Rate */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className="font-semibold text-purple-700">{item.bank_interest_rate}%</span>
                      <span className="text-[10px] text-gray-400 block">{item.interest_type || 'Simple'}</span>
                    </td>

                    {/* Custody Location */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${item.custody_location === 'PGF Safe' ? 'bg-emerald-500' : 'bg-blue-500'}`}></span>
                        <span className="font-medium text-gray-800 text-[11px] truncate max-w-[150px]">
                          {item.custody_location || 'PGF Safe'}
                        </span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-4 whitespace-nowrap">
                      {getStatusBadge(item.status)}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        {item.status === 'Pending Approval' && (
                          <button
                            onClick={(e) => handleQuickApprove(item.id, e)}
                            disabled={actionLoading === item.id}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-lg text-xs font-semibold shadow-xs disabled:opacity-50"
                          >
                            {actionLoading === item.id ? 'Approving...' : 'Approve'}
                          </button>
                        )}
                        <Link
                          href={`/admin/re-pledge/${item.id}`}
                          className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors"
                        >
                          Details
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
