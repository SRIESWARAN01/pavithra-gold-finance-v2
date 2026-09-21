// src/app/investor/dashboard/page.tsx
// Professional Investor Wealth Dashboard — Luxury PGF design, KPI cards, growth chart, lot holdings, and quick actions.

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  DollarSign,
  PlusCircle,
  ArrowDownLeft,
  Calendar,
  Clock,
  ShieldCheck,
  ChevronRight,
  RefreshCw,
  AlertCircle,
  MessageSquare,
  FileText,
  PieChart,
  ArrowUpRight,
  Lock,
} from 'lucide-react';
import { auth } from '@/lib/firebase';
import {
  getInvestorPortfolio,
  getInvestorLots,
  getInvestorTransactions,
  getInvestmentSettings,
  generatePortfolioGrowthChart,
} from '@/lib/db/investments';
import type {
  InvestorPortfolioSummary,
  InvestmentLot,
  InvestmentTransaction,
  InvestmentSettings,
  InvestmentGrowthPoint,
} from '@/types/database';

export default function InvestorDashboardPage() {
  const [portfolio, setPortfolio] = useState<InvestorPortfolioSummary | null>(null);
  const [lots, setLots] = useState<InvestmentLot[]>([]);
  const [transactions, setTransactions] = useState<InvestmentTransaction[]>([]);
  const [settings, setSettings] = useState<InvestmentSettings | null>(null);
  const [growthPoints, setGrowthPoints] = useState<InvestmentGrowthPoint[]>([]);
  const [chartPeriod, setChartPeriod] = useState<'1Y' | '2Y' | '3Y' | '5Y' | 'All'>('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    const user = auth.currentUser;
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [p, l, t, s] = await Promise.all([
        getInvestorPortfolio(user.uid),
        getInvestorLots(user.uid),
        getInvestorTransactions(user.uid),
        getInvestmentSettings(),
      ]);

      setPortfolio(p);
      setLots(l);
      setTransactions(t.slice(0, 5));
      setSettings(s);

      const points = generatePortfolioGrowthChart(l, s);
      setGrowthPoints(points);
    } catch (err: any) {
      console.error('Error loading investor dashboard:', err);
      setError(err.message || 'Failed to load portfolio information.');
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

  const whatsappHelpLink = useMemo(() => {
    const number = settings?.helpdesk_whatsapp_number || '919876543210';
    const text = encodeURIComponent(
      `Hello PGF Investment Helpdesk,\nInvestor ID: ${portfolio?.investor_number || ''}\nName: ${portfolio?.investor_name || ''}\nI need assistance regarding my investment portfolio.`
    );
    return `https://wa.me/${number}?text=${text}`;
  }, [settings, portfolio]);

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-400 space-y-3">
        <RefreshCw size={28} className="animate-spin mx-auto text-amber-500" />
        <p className="text-xs font-mono tracking-wider uppercase text-amber-400">
          Calculating Real-time Portfolio Valuation...
        </p>
      </div>
    );
  }

  if (error || !portfolio) {
    return (
      <div className="p-8 text-center space-y-4">
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs inline-block max-w-md">
          {error || 'Unable to access portfolio records.'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Top Welcome & Wealth Highlight Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0F1B3E] via-[#0B1530] to-[#060B18] p-6 sm:p-10 border border-amber-500/30 shadow-2xl shadow-black/60">
        {/* Subtle decorative glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase bg-amber-400/15 text-amber-300 border border-amber-400/30">
                {portfolio.investor_number}
              </span>
              <span className="text-xs text-slate-400">
                Since {portfolio.start_date} &bull; <strong className="text-slate-200">{portfolio.duration_text}</strong>
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight font-outfit">
              {portfolio.investor_name}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl leading-relaxed">
              Your capital is actively managed and compounded at{' '}
              <strong className="text-amber-400">{portfolio.annual_rate}% annual return</strong> with independent lot accounting.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/investor/invest"
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-extrabold shadow-xl shadow-amber-500/25 transition-all transform hover:scale-[1.02]"
            >
              <PlusCircle size={17} />
              + Add Investment
            </Link>
            <Link
              href="/investor/withdraw"
              className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-slate-800/90 hover:bg-slate-800 text-slate-100 border border-slate-700 text-xs font-bold transition-all"
            >
              <ArrowDownLeft size={17} className="text-purple-400" />
              Withdraw Funds
            </Link>
          </div>
        </div>
      </div>

      {/* Main KPI Wealth Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Invested */}
        <div className="bg-[#0D1630] p-6 rounded-2xl border border-slate-800 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Invested Capital</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <DollarSign size={18} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono">
            {formatINR(portfolio.total_invested)}
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            {portfolio.additional_investments > 0 ? (
              <span>Includes {formatINR(portfolio.additional_investments)} additional funds</span>
            ) : (
              <span>Primary investment principal</span>
            )}
          </div>
        </div>

        {/* Current Investment Value */}
        <div className="bg-[#0D1630] p-6 rounded-2xl border border-amber-500/30 shadow-xl shadow-amber-500/5 relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-300">
              Current Portfolio Value
            </span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-amber-300 font-mono">
            {formatINR(portfolio.current_value)}
          </div>
          <div className="mt-2 text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
            <ArrowUpRight size={14} />
            Accrued: {formatINR(portfolio.accrued_return)}
          </div>
        </div>

        {/* Total Returns */}
        <div className="bg-[#0D1630] p-6 rounded-2xl border border-slate-800 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Compounded Returns</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <PieChart size={18} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400 font-mono">
            {formatINR(portfolio.accrued_return)}
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            Applicable Rate: <strong className="text-white">{portfolio.annual_rate}% p.a.</strong>
          </div>
        </div>

        {/* Active Pockets / Withdrawals */}
        <div className="bg-[#0D1630] p-6 rounded-2xl border border-slate-800 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Lots & Status</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Clock size={18} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono">
            {portfolio.active_lots_count} <span className="text-xs font-normal text-slate-400">Lots</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between">
            <span>Withdrawn: <strong className="text-purple-400">{formatINR(portfolio.total_withdrawn)}</strong></span>
            {portfolio.pending_withdrawals_count > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold text-[10px]">
                {portfolio.pending_withdrawals_count} Pending
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Portfolio Growth Projection Section */}
      <div className="bg-[#0D1630] rounded-3xl border border-slate-800 p-6 sm:p-8 shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-400/15 text-amber-300">
                Wealth Projection
              </span>
              <span className="text-xs text-slate-400">Dynamic Multi-Year Compounding Model</span>
            </div>
            <h2 className="text-xl font-bold text-white mt-1">Portfolio Growth Trajectory</h2>
          </div>

          {/* Timeframe filters */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-900 rounded-xl border border-slate-800">
            {(['1Y', '2Y', '3Y', '5Y', 'All'] as const).map((period) => (
              <button
                key={period}
                onClick={() => setChartPeriod(period)}
                className={`px-3 py-1 text-xs rounded-lg font-bold transition-all cursor-pointer ${
                  chartPeriod === period
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {period}
              </button>
            ))}
          </div>
        </div>

        {/* Growth Points Table / Visual Trajectory */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {growthPoints.map((pt, idx) => (
            <div
              key={pt.label}
              className={`p-4 rounded-2xl border transition-all ${
                pt.label === 'Today'
                  ? 'bg-amber-400/10 border-amber-400/40 shadow-lg shadow-amber-500/5'
                  : pt.is_projected
                  ? 'bg-slate-900/60 border-slate-800'
                  : 'bg-slate-900 border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                <span className="font-bold text-slate-300">{pt.label}</span>
                <span className="font-mono text-[10px]">{pt.date}</span>
              </div>
              <div className="text-lg font-extrabold font-mono text-white mt-1">
                {formatINR(pt.total_value)}
              </div>
              <div className="text-[10px] text-emerald-400 font-semibold mt-1">
                +{formatINR(pt.accrued_return)} Return
              </div>
              {pt.is_projected && (
                <span className="mt-2 block text-[9px] uppercase font-bold tracking-wider text-amber-400/80 bg-amber-400/10 px-2 py-0.5 rounded text-center">
                  Projected
                </span>
              )}
            </div>
          ))}
        </div>

        <p className="text-[11px] text-slate-500 italic">
          * Note: Projections are illustrative calculations based on the currently configured annual return rate of {portfolio.annual_rate}%.
        </p>
      </div>

      {/* Active Holdings By Lot Section */}
      <div className="bg-[#0D1630] rounded-3xl border border-slate-800 shadow-xl overflow-hidden">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">Investment Holdings by Lot</h3>
            <p className="text-xs text-slate-400">
              Each capital deposit is tracked independently to ensure precise compounding and withdrawal settlement.
            </p>
          </div>
          <Link
            href="/investor/portfolio"
            className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1"
          >
            Full Portfolio <ChevronRight size={14} />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-900/80 text-slate-400 font-bold border-b border-slate-800 uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Lot ID</th>
                <th className="px-6 py-4">Investment Date</th>
                <th className="px-6 py-4">Principal Deposited</th>
                <th className="px-6 py-4">Withdrawn</th>
                <th className="px-6 py-4">Rate</th>
                <th className="px-6 py-4">Accrued Return</th>
                <th className="px-6 py-4">Current Valuation</th>
                <th className="px-6 py-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {lots.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                    No active investment lots. Click "+ Add Investment" above to start.
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

      {/* 24x7 WhatsApp Helpdesk Card */}
      <div className="bg-gradient-to-r from-emerald-950/40 via-[#0D1D24] to-slate-900 p-6 sm:p-8 rounded-3xl border border-emerald-500/30 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="space-y-1 text-center sm:text-left">
          <div className="flex items-center justify-center sm:justify-start gap-2">
            <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 font-mono">
              24×7 Investment Helpdesk
            </span>
          </div>
          <h3 className="text-xl font-bold text-white">Need Assistance with Deposits or Withdrawals?</h3>
          <p className="text-xs text-slate-300 max-w-lg">
            Our dedicated investment desk is available 24 hours a day on WhatsApp. If your withdrawal or payment is pending beyond 24 hours, connect directly.
          </p>
        </div>

        <a
          href={whatsappHelpLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-xl shadow-emerald-600/30 transition-all cursor-pointer whitespace-nowrap"
        >
          <MessageSquare size={17} />
          Chat on WhatsApp Now
        </a>
      </div>
    </div>
  );
}
