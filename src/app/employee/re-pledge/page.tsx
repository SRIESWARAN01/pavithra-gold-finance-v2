'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Building2,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  RotateCcw,
  Coins,
  ArrowUpRight,
  ShieldCheck,
  Lock
} from 'lucide-react';
import { listenBankRePledges, calculateRePledgeMetrics } from '@/lib/db/repledge';
import type { BankRePledge, BankRePledgeStatus } from '@/types/database';

export default function EmployeeRePledgePage() {
  const [repledges, setRepledges] = useState<BankRePledge[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  useEffect(() => {
    const unsubscribe = listenBankRePledges((items) => {
      setRepledges(items);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const metrics = calculateRePledgeMetrics(repledges);

  const filtered = repledges.filter((item) => {
    if (statusFilter !== 'ALL') {
      if (statusFilter === 'ACTIVE' && item.status !== 'Active' && item.status !== 'Pledged with Bank') return false;
      if (statusFilter === 'PENDING' && item.status !== 'Pending Approval') return false;
      if (statusFilter === 'RELEASED' && item.status !== 'Released' && item.status !== 'Closed') return false;
    }

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.repledge_number.toLowerCase().includes(q) ||
      item.bank_name.toLowerCase().includes(q) ||
      item.customer_name.toLowerCase().includes(q) ||
      item.loan_number.toLowerCase().includes(q)
    );
  });

  const getStatusBadge = (status: BankRePledgeStatus) => {
    switch (status) {
      case 'Active':
      case 'Pledged with Bank':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
            <CheckCircle2 size={12} /> Pledged with Bank
          </span>
        );
      case 'Pending Approval':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
            <Clock size={12} /> Pending Approval
          </span>
        );
      case 'Released':
      case 'Closed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
            <RotateCcw size={12} /> Gold in Safe
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-200">
              <Building2 size={22} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 tracking-tight">Bank Re-Pledge Registry</h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Staff custody directory for customer gold pledged with institutional partner banks.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/admin/re-pledge/new"
            className="inline-flex items-center justify-center gap-2 bg-[#2563EB] hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-sm transition-all"
          >
            <Plus size={15} />
            Submit Re-Pledge Request
          </Link>
        </div>
      </div>

      {/* Staff Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-gray-500 block">Active with Banks</span>
          <span className="text-xl font-black text-gray-900 block mt-1">{metrics.activePledgesCount} Pledges</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-gray-500 block">Gold in Bank Custody</span>
          <span className="text-xl font-black text-amber-700 block mt-1">{metrics.goldWithBanks.toFixed(2)}g</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-gray-500 block">Gold Returned to Safe</span>
          <span className="text-xl font-black text-emerald-700 block mt-1">{metrics.goldReturnedToSafe.toFixed(2)}g</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm">
          <span className="text-[10px] uppercase font-bold text-gray-500 block">Pending Approvals</span>
          <span className="text-xl font-black text-purple-700 block mt-1">{metrics.pendingApprovalsCount}</span>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="bg-white p-4 rounded-xl border border-gray-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
          {['ALL', 'ACTIVE', 'PENDING', 'RELEASED'].map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                statusFilter === f ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search bank, customer, loan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase">
              <tr>
                <th className="px-5 py-3">Re-Pledge #</th>
                <th className="px-5 py-3">Customer & Loan</th>
                <th className="px-5 py-3">Bank & Branch</th>
                <th className="px-5 py-3">Gold Transferred</th>
                <th className="px-5 py-3">Physical Custody</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">
                    Loading bank pledges...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">
                    No bank re-pledge records found.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/50">
                    <td className="px-5 py-3.5 font-bold text-gray-900 font-mono">
                      {item.repledge_number}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-semibold text-gray-900 block">{item.customer_name}</span>
                      <span className="text-[11px] text-gray-500 font-mono">{item.loan_number}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-semibold text-gray-900 block">{item.bank_name}</span>
                      <span className="text-[11px] text-gray-500">{item.bank_branch}</span>
                    </td>
                    <td className="px-5 py-3.5 font-bold text-amber-800">
                      {item.total_net_weight.toFixed(2)}g Net
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="font-medium text-gray-800 text-[11px]">
                        {item.custody_location || 'PGF Safe'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">{getStatusBadge(item.status)}</td>
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        href={`/admin/re-pledge/${item.id}`}
                        className="text-blue-600 hover:text-blue-800 font-semibold inline-flex items-center gap-1"
                      >
                        View <ArrowUpRight size={12} />
                      </Link>
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
