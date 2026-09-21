'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  Calendar,
  Building2,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Printer,
  Download,
  Receipt,
  FileText,
  DollarSign,
  ChevronRight,
  PieChart,
  ShieldCheck,
  Coins,
  ArrowRight,
} from 'lucide-react';
import { getPnLDashboardMetrics, getBranchWisePnL } from '@/lib/db/pnl';
import { listBranches } from '@/lib/db/branches';
import { getCurrentProfile } from '@/lib/auth';
import type { PnLDashboardMetrics, BranchWisePnLItem, Branch, Profile } from '@/types/database';

export default function PnLDashboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [branches, setBranches] = useState<Array<Branch & { manager?: string }>>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
  const [metrics, setMetrics] = useState<PnLDashboardMetrics | null>(null);
  const [branchPnL, setBranchPnL] = useState<BranchWisePnLItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const isAdminOrOwner = profile?.role === 'Admin' || profile?.role === 'Owner';

  useEffect(() => {
    async function init() {
      try {
        const prof = await getCurrentProfile();
        setProfile(prof);

        if (prof?.role === 'Admin' || prof?.role === 'Owner') {
          const brList = await listBranches();
          setBranches(brList);
        } else if (prof?.branch_id) {
          setSelectedBranchId(prof.branch_id);
          const brList = await listBranches();
          setBranches(brList.filter((b) => b.id === prof.branch_id));
        }
      } catch (err) {
        console.error('Error initializing P&L dashboard:', err);
      }
    }
    init();
  }, []);

  const fetchMetrics = async () => {
    setLoading(true);
    setError(null);
    try {
      const branchParam = selectedBranchId === 'all' ? undefined : selectedBranchId;
      const [m, bPnL] = await Promise.all([
        getPnLDashboardMetrics(branchParam),
        getBranchWisePnL('month'),
      ]);
      setMetrics(m);
      setBranchPnL(bPnL);
    } catch (err: any) {
      console.error('Error fetching P&L metrics:', err);
      setError('Failed to load P&L dashboard metrics. Please refresh.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, [selectedBranchId]);

  const formatINR = (val: number) => {
    return '₹ ' + (val || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* 1. Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold uppercase tracking-wider">
            <BarChart3 size={16} />
            <span>Financial Management &amp; P&amp;L</span>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight mt-1 flex items-center gap-2.5">
            Profit &amp; Loss Dashboard
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              Live Financial Overview
            </span>
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Authoritative financial position calculated from recognized income (interest &amp; fees) and approved operational expenses.
          </p>
        </div>

        {/* Filters and Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Branch Dropdown */}
          <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 shadow-2xs">
            <Building2 size={14} className="text-gray-500 mr-2 shrink-0" />
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              disabled={!isAdminOrOwner}
              className="text-xs font-semibold text-gray-800 bg-transparent border-none focus:outline-hidden cursor-pointer disabled:cursor-not-allowed"
            >
              {isAdminOrOwner && <option value="all">All Branches (Consolidated)</option>}
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={fetchMetrics}
            disabled={loading}
            title="Refresh Data"
            className="p-2.5 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-gray-900 shadow-2xs transition-colors disabled:opacity-50"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin text-blue-600' : ''} />
          </button>

          <Link
            href="/admin/expenses/new"
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-2xs transition-all"
          >
            <Receipt size={14} />
            <span>New Expense</span>
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex justify-between items-center">
          <span>{error}</span>
          <button onClick={fetchMetrics} className="font-bold underline hover:text-rose-900">
            Retry
          </button>
        </div>
      )}

      {/* 2. Core Rule Info Banner */}
      <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 text-blue-900 text-xs flex items-start gap-3">
        <div className="p-1 rounded-lg bg-blue-100 text-blue-700 shrink-0 mt-0.5">
          <ShieldCheck size={16} />
        </div>
        <div>
          <span className="font-bold block">Authoritative P&amp;L Accounting Integrity:</span>
          Income strictly comprises recognized revenue (interest collected, penalties, and processing fees).
          Customer principal repayment is a balance-sheet asset movement and is <span className="font-bold underline">strictly excluded</span> from income calculations to prevent artificial profit inflation.
        </div>
      </div>

      {/* 3. High Level Metrics Cards: TODAY, THIS MONTH, THIS YEAR */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* TODAY */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
              <Calendar size={14} className="text-blue-600" />
              Today&apos;s Position
            </span>
            <Link
              href="/admin/pnl/daily"
              className="text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-0.5"
            >
              Daily View <ArrowRight size={12} />
            </Link>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-gray-600">Recognized Income:</span>
              <span className="font-mono font-bold text-sm text-emerald-700">
                {metrics ? formatINR(metrics.today.income) : '...'}
              </span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-gray-600">Operating Expenses:</span>
              <span className="font-mono font-bold text-sm text-rose-700">
                {metrics ? formatINR(metrics.today.expenses) : '...'}
              </span>
            </div>
            <div className="pt-3 border-t border-gray-100 flex justify-between items-baseline">
              <span className="text-xs font-bold text-gray-900">
                {metrics?.today.isProfit ? "Today's Net Profit:" : "Today's Net Loss:"}
              </span>
              <span
                className={`font-mono font-extrabold text-base sm:text-lg ${
                  metrics?.today.isProfit ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {metrics ? formatINR(metrics.today.netProfitLoss) : '...'}
              </span>
            </div>
          </div>
        </div>

        {/* THIS MONTH */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
              <TrendingUp size={14} className="text-indigo-600" />
              This Month ({metrics?.thisMonth.monthName || 'Current'})
            </span>
            <Link
              href="/admin/pnl/monthly"
              className="text-[11px] font-bold text-indigo-600 hover:underline flex items-center gap-0.5"
            >
              Monthly View <ArrowRight size={12} />
            </Link>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-gray-600">Total Income:</span>
              <span className="font-mono font-bold text-sm text-emerald-700">
                {metrics ? formatINR(metrics.thisMonth.income) : '...'}
              </span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-gray-600">Total Expenses:</span>
              <span className="font-mono font-bold text-sm text-rose-700">
                {metrics ? formatINR(metrics.thisMonth.expenses) : '...'}
              </span>
            </div>
            <div className="pt-3 border-t border-gray-100 flex justify-between items-baseline">
              <span className="text-xs font-bold text-gray-900">
                {metrics?.thisMonth.isProfit ? 'Monthly Net Profit:' : 'Monthly Net Loss:'}
              </span>
              <span
                className={`font-mono font-extrabold text-base sm:text-lg ${
                  metrics?.thisMonth.isProfit ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {metrics ? formatINR(metrics.thisMonth.netProfitLoss) : '...'}
              </span>
            </div>
          </div>
        </div>

        {/* THIS YEAR */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
              <BarChart3 size={14} className="text-purple-600" />
              This Year ({metrics?.thisYear.financialYear || 'Current FY'})
            </span>
            <Link
              href="/admin/pnl/yearly"
              className="text-[11px] font-bold text-purple-600 hover:underline flex items-center gap-0.5"
            >
              Yearly View <ArrowRight size={12} />
            </Link>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-gray-600">Annual Income:</span>
              <span className="font-mono font-bold text-sm text-emerald-700">
                {metrics ? formatINR(metrics.thisYear.income) : '...'}
              </span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-gray-600">Annual Expenses:</span>
              <span className="font-mono font-bold text-sm text-rose-700">
                {metrics ? formatINR(metrics.thisYear.expenses) : '...'}
              </span>
            </div>
            <div className="pt-3 border-t border-gray-100 flex justify-between items-baseline">
              <span className="text-xs font-bold text-gray-900">
                {metrics?.thisYear.isProfit ? 'Annual Net Profit:' : 'Annual Net Loss:'}
              </span>
              <span
                className={`font-mono font-extrabold text-base sm:text-lg ${
                  metrics?.thisYear.isProfit ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {metrics ? formatINR(metrics.thisYear.netProfitLoss) : '...'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Quick Navigation Modules */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Link
          href="/admin/pnl/daily"
          className="p-4 rounded-xl bg-white border border-gray-200/80 hover:border-blue-500 hover:bg-blue-50/30 transition-all text-center group shadow-2xs"
        >
          <Calendar size={20} className="mx-auto text-blue-600 group-hover:scale-110 transition-transform mb-2" />
          <span className="text-xs font-bold text-gray-900 block">Daily P&amp;L</span>
          <span className="text-[10px] text-gray-500">Day-by-day detail</span>
        </Link>

        <Link
          href="/admin/pnl/monthly"
          className="p-4 rounded-xl bg-white border border-gray-200/80 hover:border-indigo-500 hover:bg-indigo-50/30 transition-all text-center group shadow-2xs"
        >
          <TrendingUp size={20} className="mx-auto text-indigo-600 group-hover:scale-110 transition-transform mb-2" />
          <span className="text-xs font-bold text-gray-900 block">Monthly P&amp;L</span>
          <span className="text-[10px] text-gray-500">Month trends</span>
        </Link>

        <Link
          href="/admin/pnl/yearly"
          className="p-4 rounded-xl bg-white border border-gray-200/80 hover:border-purple-500 hover:bg-purple-50/30 transition-all text-center group shadow-2xs"
        >
          <BarChart3 size={20} className="mx-auto text-purple-600 group-hover:scale-110 transition-transform mb-2" />
          <span className="text-xs font-bold text-gray-900 block">Yearly P&amp;L</span>
          <span className="text-[10px] text-gray-500">Financial Year view</span>
        </Link>

        <Link
          href="/admin/expenses/history"
          className="p-4 rounded-xl bg-white border border-gray-200/80 hover:border-emerald-500 hover:bg-emerald-50/30 transition-all text-center group shadow-2xs"
        >
          <Receipt size={20} className="mx-auto text-emerald-600 group-hover:scale-110 transition-transform mb-2" />
          <span className="text-xs font-bold text-gray-900 block">Expense History</span>
          <span className="text-[10px] text-gray-500">All vouchers</span>
        </Link>

        <Link
          href="/admin/expenses/categories"
          className="p-4 rounded-xl bg-white border border-gray-200/80 hover:border-amber-500 hover:bg-amber-50/30 transition-all text-center group shadow-2xs"
        >
          <PieChart size={20} className="mx-auto text-amber-600 group-hover:scale-110 transition-transform mb-2" />
          <span className="text-xs font-bold text-gray-900 block">Expense Heads</span>
          <span className="text-[10px] text-gray-500">Manage categories</span>
        </Link>

        <Link
          href="/admin/consolidated"
          className="p-4 rounded-xl bg-white border border-gray-200/80 hover:border-slate-500 hover:bg-slate-50/30 transition-all text-center group shadow-2xs"
        >
          <Building2 size={20} className="mx-auto text-slate-600 group-hover:scale-110 transition-transform mb-2" />
          <span className="text-xs font-bold text-gray-900 block">Consolidated</span>
          <span className="text-[10px] text-gray-500">Pledge &amp; releases</span>
        </Link>
      </div>

      {/* 5. Branch-Wise P&L Comparison (Admin/Owner) */}
      {isAdminOrOwner && (
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Building2 size={18} className="text-indigo-600" />
                Branch-Wise Financial Performance (Current Month)
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Comparative breakdown of recognized revenue, operational expenses, and net profit by branch.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-3.5 pl-5">Branch Name</th>
                  <th className="p-3.5 text-right">Recognized Income</th>
                  <th className="p-3.5 text-right">Operational Expenses</th>
                  <th className="p-3.5 text-right pr-5">Net Profit / Loss</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {branchPnL.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-gray-400">
                      No branch performance data available.
                    </td>
                  </tr>
                ) : (
                  branchPnL.map((b) => (
                    <tr key={b.branchId} className="hover:bg-gray-50/80 transition-colors">
                      <td className="p-3.5 pl-5 font-bold text-gray-900">
                        {b.branchName}
                      </td>
                      <td className="p-3.5 text-right font-mono font-bold text-emerald-700">
                        {formatINR(b.income)}
                      </td>
                      <td className="p-3.5 text-right font-mono font-bold text-rose-700">
                        {formatINR(b.expenses)}
                      </td>
                      <td className="p-3.5 text-right pr-5 font-mono font-extrabold text-sm">
                        <span
                          className={`px-2 py-0.5 rounded-lg ${
                            b.isProfit
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {b.isProfit ? '+' : '-'} {formatINR(b.netProfitLoss)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
