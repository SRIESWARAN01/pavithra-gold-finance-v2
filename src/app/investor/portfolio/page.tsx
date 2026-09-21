// src/app/investor/portfolio/page.tsx
// Comprehensive Investor Portfolio page — Detailed holding breakdown by lot, performance comparison, and document downloads.

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  PieChart,
  TrendingUp,
  DollarSign,
  ArrowDownLeft,
  Calendar,
  FileText,
  Download,
  PlusCircle,
  RefreshCw,
  AlertCircle,
  ShieldCheck,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { auth } from '@/lib/firebase';
import {
  getInvestorPortfolio,
  getInvestorLots,
  getInvestmentSettings,
} from '@/lib/db/investments';
import type {
  InvestorPortfolioSummary,
  InvestmentLot,
  InvestmentSettings,
} from '@/types/database';

export default function InvestorPortfolioPage() {
  const [portfolio, setPortfolio] = useState<InvestorPortfolioSummary | null>(null);
  const [lots, setLots] = useState<InvestmentLot[]>([]);
  const [settings, setSettings] = useState<InvestmentSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    const user = auth.currentUser;
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [p, l, s] = await Promise.all([
        getInvestorPortfolio(user.uid),
        getInvestorLots(user.uid),
        getInvestmentSettings(),
      ]);

      setPortfolio(p);
      setLots(l);
      setSettings(s);
    } catch (err: any) {
      console.error('Error loading portfolio:', err);
      setError(err.message || 'Failed to load portfolio.');
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

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-400 space-y-3">
        <RefreshCw size={28} className="animate-spin mx-auto text-amber-500" />
        <p className="text-xs font-mono tracking-wider uppercase text-amber-400">
          Loading Portfolio Breakdown...
        </p>
      </div>
    );
  }

  if (error || !portfolio) {
    return (
      <div className="p-8 text-center space-y-4">
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs inline-block max-w-md">
          {error || 'Unable to access portfolio.'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0D1630] p-6 rounded-3xl border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-3 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-amber-400/15 text-amber-300 border border-amber-400/30">
              Wealth Portfolio
            </span>
            <span className="text-xs text-slate-400 font-semibold">{lots.length} Active Lots</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white font-outfit">
            Portfolio Holdings & Performance
          </h1>
          <p className="text-xs text-slate-400">
            Granular inspection of all capital contributions, compounding returns, and liquidation history.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/investor/invest"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold shadow-lg shadow-amber-500/20 transition-all"
          >
            <PlusCircle size={15} />
            Add Fund
          </Link>
          <Link
            href="/investor/withdraw"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-all"
          >
            <ArrowDownLeft size={15} className="text-purple-400" />
            Withdraw
          </Link>
        </div>
      </div>

      {/* Summary Matrix */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-[#0D1630] p-4 rounded-2xl border border-slate-800">
          <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Capital</span>
          <span className="text-lg font-extrabold font-mono text-white mt-1 block">
            {formatINR(portfolio.total_invested)}
          </span>
        </div>

        <div className="bg-[#0D1630] p-4 rounded-2xl border border-slate-800">
          <span className="text-[10px] text-slate-400 uppercase font-bold block">Additional Funds</span>
          <span className="text-lg font-extrabold font-mono text-cyan-400 mt-1 block">
            {formatINR(portfolio.additional_investments)}
          </span>
        </div>

        <div className="bg-[#0D1630] p-4 rounded-2xl border border-slate-800">
          <span className="text-[10px] text-slate-400 uppercase font-bold block">Accrued Returns</span>
          <span className="text-lg font-extrabold font-mono text-emerald-400 mt-1 block">
            {formatINR(portfolio.accrued_return)}
          </span>
        </div>

        <div className="bg-[#0D1630] p-4 rounded-2xl border border-slate-800">
          <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Withdrawn</span>
          <span className="text-lg font-extrabold font-mono text-purple-400 mt-1 block">
            {formatINR(portfolio.total_withdrawn)}
          </span>
        </div>

        <div className="bg-[#0D1630] p-4 rounded-2xl border border-slate-800">
          <span className="text-[10px] text-slate-400 uppercase font-bold block">Net Invested</span>
          <span className="text-lg font-extrabold font-mono text-white mt-1 block">
            {formatINR(portfolio.net_invested_capital)}
          </span>
        </div>

        <div className="bg-[#0D1630] p-4 rounded-2xl border border-amber-500/30 bg-amber-500/5">
          <span className="text-[10px] text-amber-300 uppercase font-bold block">Current Value</span>
          <span className="text-lg font-extrabold font-mono text-amber-300 mt-1 block">
            {formatINR(portfolio.current_value)}
          </span>
        </div>
      </div>

      {/* Lot-by-Lot Holding Table */}
      <div className="bg-[#0D1630] rounded-3xl border border-slate-800 shadow-xl overflow-hidden">
        <div className="p-6 border-b border-slate-800">
          <h2 className="text-lg font-bold text-white">Investment Lots Breakdown</h2>
          <p className="text-xs text-slate-400">
            Every investment amount maintains its own independent lot, rate, and calendar duration.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-900/80 text-slate-400 font-bold border-b border-slate-800 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Lot ID</th>
                <th className="px-6 py-4">Pledge / Investment Date</th>
                <th className="px-6 py-4">Principal Deposited</th>
                <th className="px-6 py-4">Withdrawn Principal</th>
                <th className="px-6 py-4">Annual Rate</th>
                <th className="px-6 py-4">Accrued Return</th>
                <th className="px-6 py-4">Current Valuation</th>
                <th className="px-6 py-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {lots.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                    No investment lots on record.
                  </td>
                </tr>
              ) : (
                lots.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-amber-400">{l.lot_number}</td>
                    <td className="px-6 py-4 font-mono text-slate-300">{l.investment_date}</td>
                    <td className="px-6 py-4 font-mono font-bold text-white">{formatINR(l.principal_amount)}</td>
                    <td className="px-6 py-4 font-mono text-purple-400">{formatINR(l.withdrawn_amount || 0)}</td>
                    <td className="px-6 py-4 font-semibold text-blue-400">{l.applicable_rate}%</td>
                    <td className="px-6 py-4 font-mono font-bold text-emerald-400">{formatINR(l.accrued_return || 0)}</td>
                    <td className="px-6 py-4 font-mono font-extrabold text-amber-300 text-sm">
                      {formatINR(l.current_value || l.principal_amount)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          l.status === 'Active'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {l.status}
                      </span>
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
