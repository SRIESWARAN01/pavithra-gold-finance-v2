// src/app/admin/investments/page.tsx
// Executive Admin Dashboard for PGF Investment Management.
// Real-time tracking of capital, portfolio valuation, returns, approvals, and withdrawals.

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  Users,
  ShieldCheck,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  DollarSign,
  FileText,
  Settings,
  AlertCircle,
  RefreshCw,
  PlusCircle,
  CheckCircle2,
  Calendar,
  Building2,
  ChevronRight,
  QrCode,
  FileSpreadsheet
} from 'lucide-react';
import {
  getAdminInvestmentDashboardMetrics,
  getInvestmentSettings,
  getInvestmentConsolidatedReport,
} from '@/lib/db/investments';
import type {
  AdminInvestmentDashboardMetrics,
  InvestmentSettings,
  InvestmentConsolidatedItem,
} from '@/types/database';

export default function AdminInvestmentsDashboard() {
  const [metrics, setMetrics] = useState<AdminInvestmentDashboardMetrics | null>(null);
  const [settings, setSettings] = useState<InvestmentSettings | null>(null);
  const [recentConsolidated, setRecentConsolidated] = useState<InvestmentConsolidatedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const startStr = thirtyDaysAgo.toISOString().split('T')[0];

      const [m, s, c] = await Promise.all([
        getAdminInvestmentDashboardMetrics(),
        getInvestmentSettings(),
        getInvestmentConsolidatedReport(startStr, todayStr),
      ]);

      setMetrics(m);
      setSettings(s);
      setRecentConsolidated(c.slice(0, 7));
    } catch (err: any) {
      console.error('Error loading investment dashboard data:', err);
      setError(err.message || 'Failed to load investment data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const formatINR = (val?: number) => {
    return '₹' + (val || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 p-6 rounded-2xl text-white shadow-xl shadow-blue-950/20 border border-blue-900/30">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-amber-400/20 text-amber-300 border border-amber-400/30">
              PGF Wealth & Capital
            </span>
            <span className="text-xs text-blue-200/80">
              Applicable Rate: <strong className="text-amber-300">{settings?.annual_rate || 12}% p.a.</strong>
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-outfit text-white">
            Investment Management
          </h1>
          <p className="text-xs sm:text-sm text-blue-100/75 mt-0.5">
            Enterprise investor portfolio oversight, atomic capital postings, and withdrawal settlement queue.
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-blue-200 hover:text-white border border-white/10 transition-all cursor-pointer"
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <Link
            href="/admin/investments/investors/new"
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-lg shadow-amber-500/25 transition-all"
          >
            <PlusCircle size={15} />
            Create Investor
          </Link>
          <Link
            href="/admin/investments/payments"
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/25 transition-all"
          >
            <ShieldCheck size={15} />
            Verify Payments
            {metrics && metrics.pendingInvestmentApprovals > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-amber-400 text-slate-950 rounded-full text-[10px] font-extrabold">
                {metrics.pendingInvestmentApprovals}
              </span>
            )}
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-3">
          <AlertCircle size={18} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Investment Capital */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm shadow-gray-200/50 hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Investment Capital</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <DollarSign size={18} />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-gray-900 font-mono">
            {formatINR(metrics?.totalInvestmentCapital)}
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-500">
            <span className="text-emerald-600 font-bold flex items-center gap-0.5">
              <ArrowUpRight size={14} />
              Today: {formatINR(metrics?.todayInvestments)}
            </span>
          </div>
        </div>

        {/* Current Portfolio Valuation */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm shadow-gray-200/50 hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Current Liability / Portfolio</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-gray-900 font-mono text-amber-600">
            {formatINR(metrics?.totalCurrentPortfolioValue)}
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-500">
            <span>Accrued Returns: <strong className="text-gray-900">{formatINR(metrics?.totalReturns)}</strong></span>
          </div>
        </div>

        {/* Total Investors */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm shadow-gray-200/50 hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Investor Accounts</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <Users size={18} />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-gray-900 font-mono">
            {metrics?.totalInvestors || 0}
          </div>
          <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
              {metrics?.activeInvestors || 0} Active
            </span>
            <Link href="/admin/investments/investors" className="text-blue-600 hover:underline text-[11px] font-semibold">
              View Directory &rarr;
            </Link>
          </div>
        </div>

        {/* Pending Withdrawals */}
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm shadow-gray-200/50 hover:shadow-md transition-all">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Withdrawal Queue</span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <Clock size={18} />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-gray-900 font-mono text-purple-600">
            {metrics?.pendingWithdrawalRequests || 0}
          </div>
          <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
            <span>Completed: <strong className="text-gray-900">{metrics?.completedWithdrawals || 0}</strong></span>
            <Link href="/admin/investments/withdrawals" className="text-purple-600 hover:underline text-[11px] font-semibold">
              Process &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* Submodule Quick Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Link
          href="/admin/investments/investors"
          className="p-4 rounded-xl bg-white border border-gray-200/80 hover:border-blue-300 hover:shadow-md transition-all text-center group"
        >
          <div className="w-10 h-10 mx-auto rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
            <Users size={20} />
          </div>
          <span className="text-xs font-bold text-gray-800 block">Directory</span>
          <span className="text-[10px] text-gray-500">All Investors</span>
        </Link>

        <Link
          href="/admin/investments/payments"
          className="p-4 rounded-xl bg-white border border-gray-200/80 hover:border-blue-300 hover:shadow-md transition-all text-center group relative"
        >
          {metrics && metrics.pendingInvestmentApprovals > 0 && (
            <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-amber-500 rounded-full animate-ping" />
          )}
          <div className="w-10 h-10 mx-auto rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
            <ShieldCheck size={20} />
          </div>
          <span className="text-xs font-bold text-gray-800 block">Payments</span>
          <span className="text-[10px] text-gray-500">{metrics?.pendingInvestmentApprovals || 0} Pending</span>
        </Link>

        <Link
          href="/admin/investments/withdrawals"
          className="p-4 rounded-xl bg-white border border-gray-200/80 hover:border-blue-300 hover:shadow-md transition-all text-center group"
        >
          <div className="w-10 h-10 mx-auto rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
            <Clock size={20} />
          </div>
          <span className="text-xs font-bold text-gray-800 block">Withdrawals</span>
          <span className="text-[10px] text-gray-500">{metrics?.pendingWithdrawalRequests || 0} Awaiting</span>
        </Link>

        <Link
          href="/admin/investments/transactions"
          className="p-4 rounded-xl bg-white border border-gray-200/80 hover:border-blue-300 hover:shadow-md transition-all text-center group"
        >
          <div className="w-10 h-10 mx-auto rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
            <FileText size={20} />
          </div>
          <span className="text-xs font-bold text-gray-800 block">Transactions</span>
          <span className="text-[10px] text-gray-500">Full Register</span>
        </Link>

        <Link
          href="/admin/investments/reports"
          className="p-4 rounded-xl bg-white border border-gray-200/80 hover:border-blue-300 hover:shadow-md transition-all text-center group"
        >
          <div className="w-10 h-10 mx-auto rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
            <FileSpreadsheet size={20} />
          </div>
          <span className="text-xs font-bold text-gray-800 block">Reports</span>
          <span className="text-[10px] text-gray-500">Daily, P&L, Statement</span>
        </Link>

        <Link
          href="/admin/investments/settings"
          className="p-4 rounded-xl bg-white border border-gray-200/80 hover:border-blue-300 hover:shadow-md transition-all text-center group"
        >
          <div className="w-10 h-10 mx-auto rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center mb-2 group-hover:scale-105 transition-transform">
            <Settings size={20} />
          </div>
          <span className="text-xs font-bold text-gray-800 block">Settings & QR</span>
          <span className="text-[10px] text-gray-500">Rate, WhatsApp, SLA</span>
        </Link>
      </div>

      {/* Recent Activity & Consolidated Position */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900">Recent Capital Position (Last 7 Days)</h2>
            <p className="text-xs text-gray-500">Daily movements of new capital, withdrawals, and net position.</p>
          </div>
          <Link
            href="/admin/investments/reports"
            className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            Full Consolidated Report <ChevronRight size={14} />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-gray-50/80 text-gray-500 font-bold border-b border-gray-100 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">New Investors</th>
                <th className="px-5 py-3">Investments</th>
                <th className="px-5 py-3">Additional Funds</th>
                <th className="px-5 py-3">Withdrawals</th>
                <th className="px-5 py-3 text-right">Net Capital Position</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentConsolidated.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-gray-400">
                    No investment movements recorded in the last 7 days.
                  </td>
                </tr>
              ) : (
                recentConsolidated.map((item) => (
                  <tr key={item.date} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3.5 font-semibold text-gray-900 font-mono">
                      {item.date}
                    </td>
                    <td className="px-5 py-3.5 text-gray-700">
                      {item.newInvestorsCount > 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold">
                          +{item.newInvestorsCount}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-emerald-600 font-semibold">
                      {item.investmentsAmount > 0 ? formatINR(item.investmentsAmount) : '—'}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-cyan-600">
                      {item.additionalFundsAmount > 0 ? formatINR(item.additionalFundsAmount) : '—'}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-purple-600 font-semibold">
                      {item.withdrawalsAmount > 0 ? formatINR(item.withdrawalsAmount) : '—'}
                    </td>
                    <td className={`px-5 py-3.5 font-mono font-bold text-right ${
                      item.netPosition >= 0 ? 'text-emerald-700' : 'text-red-600'
                    }`}>
                      {formatINR(item.netPosition)}
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
