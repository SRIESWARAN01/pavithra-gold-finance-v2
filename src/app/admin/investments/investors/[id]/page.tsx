// src/app/admin/investments/investors/[id]/page.tsx
// 360° Investor Dossier — Complete profile, portfolio breakdown, lots, transactions, and withdrawals.

'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  MapPin,
  TrendingUp,
  DollarSign,
  Clock,
  FileText,
  Calendar,
  Building,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Download,
  Printer,
  ChevronRight,
} from 'lucide-react';
import {
  getInvestorPortfolio,
  getInvestorLots,
  getInvestorTransactions,
  getInvestorWithdrawalRequests,
} from '@/lib/db/investments';
import type {
  InvestorPortfolioSummary,
  InvestmentLot,
  InvestmentTransaction,
  WithdrawalRequest,
} from '@/types/database';

export default function InvestorDossierPage() {
  const params = useParams();
  const router = useRouter();
  const investorId = params?.id as string;

  const [portfolio, setPortfolio] = useState<InvestorPortfolioSummary | null>(null);
  const [lots, setLots] = useState<InvestmentLot[]>([]);
  const [transactions, setTransactions] = useState<InvestmentTransaction[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [activeTab, setActiveTab] = useState<'lots' | 'transactions' | 'withdrawals'>('lots');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDossier = async () => {
    if (!investorId) return;
    setLoading(true);
    setError(null);
    try {
      const [p, l, t, w] = await Promise.all([
        getInvestorPortfolio(investorId),
        getInvestorLots(investorId),
        getInvestorTransactions(investorId),
        getInvestorWithdrawalRequests(investorId),
      ]);

      setPortfolio(p);
      setLots(l);
      setTransactions(t);
      setWithdrawals(w);
    } catch (err: any) {
      console.error('Error loading investor dossier:', err);
      setError(err.message || 'Failed to load investor dossier.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDossier();
  }, [investorId]);

  const formatINR = (val?: number) => {
    return '₹' + (val || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-gray-500 space-y-3">
        <RefreshCw size={24} className="animate-spin mx-auto text-blue-600" />
        <p className="text-xs font-semibold">Loading 360° Investor Dossier...</p>
      </div>
    );
  }

  if (error || !portfolio) {
    return (
      <div className="p-8 text-center space-y-4">
        <div className="p-4 rounded-xl bg-red-50 text-red-700 text-xs inline-block max-w-md">
          {error || 'Investor record not found.'}
        </div>
        <div>
          <Link
            href="/admin/investments/investors"
            className="text-xs font-bold text-blue-600 hover:underline inline-flex items-center gap-1"
          >
            <ArrowLeft size={14} /> Back to Directory
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/admin/investments/investors"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft size={14} /> Back to Investor Directory
        </Link>
      </div>

      {/* Profile Header Card */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 p-6 sm:p-8 rounded-2xl text-white shadow-xl shadow-blue-950/20 border border-blue-900/30">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-black text-2xl flex items-center justify-center shadow-lg shadow-amber-500/20">
              {portfolio.investor_name.charAt(0)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  {portfolio.investor_number}
                </span>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {portfolio.status}
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
                {portfolio.investor_name}
              </h1>
              <div className="flex flex-wrap items-center gap-4 text-xs text-blue-200/80 mt-1">
                <span className="flex items-center gap-1 font-mono">
                  <Phone size={12} className="text-amber-400" />
                  {portfolio.investor_phone}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar size={12} className="text-amber-400" />
                  Since: {portfolio.start_date} ({portfolio.duration_text})
                </span>
              </div>
            </div>
          </div>

          <div className="text-right sm:border-l sm:border-white/10 sm:pl-6">
            <span className="text-xs text-blue-200 block">Current Portfolio Valuation</span>
            <span className="text-3xl font-extrabold font-mono text-amber-300">
              {formatINR(portfolio.current_value)}
            </span>
            <span className="text-[11px] text-blue-200/70 block mt-1">
              Applicable Rate: <strong className="text-white">{portfolio.annual_rate}% p.a.</strong>
            </span>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
          <span className="text-[11px] text-gray-500 font-semibold uppercase block">Total Invested</span>
          <span className="text-xl font-extrabold text-gray-900 font-mono mt-1 block">
            {formatINR(portfolio.total_invested)}
          </span>
          <span className="text-[10px] text-gray-400">Initial + Additional</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
          <span className="text-[11px] text-gray-500 font-semibold uppercase block">Accrued Return</span>
          <span className="text-xl font-extrabold text-emerald-600 font-mono mt-1 block">
            {formatINR(portfolio.accrued_return)}
          </span>
          <span className="text-[10px] text-emerald-600 font-semibold">Compounded Growth</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
          <span className="text-[11px] text-gray-500 font-semibold uppercase block">Total Withdrawn</span>
          <span className="text-xl font-extrabold text-purple-600 font-mono mt-1 block">
            {formatINR(portfolio.total_withdrawn)}
          </span>
          <span className="text-[10px] text-gray-400">Settled to Bank</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
          <span className="text-[11px] text-gray-500 font-semibold uppercase block">Active Lots</span>
          <span className="text-xl font-extrabold text-gray-900 font-mono mt-1 block">
            {portfolio.active_lots_count}
          </span>
          <span className="text-[10px] text-blue-600 font-semibold">
            {portfolio.pending_withdrawals_count} Pending Withdrawals
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('lots')}
          className={`py-3 px-5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'lots'
              ? 'border-amber-500 text-amber-600 bg-amber-50/20'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          Investment Lots ({lots.length})
        </button>
        <button
          onClick={() => setActiveTab('transactions')}
          className={`py-3 px-5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'transactions'
              ? 'border-amber-500 text-amber-600 bg-amber-50/20'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          Transactions Ledger ({transactions.length})
        </button>
        <button
          onClick={() => setActiveTab('withdrawals')}
          className={`py-3 px-5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeTab === 'withdrawals'
              ? 'border-amber-500 text-amber-600 bg-amber-50/20'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          Withdrawal Requests ({withdrawals.length})
        </button>
      </div>

      {/* TAB CONTENT: INVESTMENT LOTS */}
      {activeTab === 'lots' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50/80 text-gray-500 font-bold border-b border-gray-100 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Lot Number</th>
                  <th className="px-5 py-3.5">Investment Date</th>
                  <th className="px-5 py-3.5">Principal Amount</th>
                  <th className="px-5 py-3.5">Withdrawn</th>
                  <th className="px-5 py-3.5">Rate</th>
                  <th className="px-5 py-3.5">Accrued Return</th>
                  <th className="px-5 py-3.5">Current Value</th>
                  <th className="px-5 py-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lots.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-8 text-center text-gray-400">
                      No investment lots found for this account.
                    </td>
                  </tr>
                ) : (
                  lots.map((l) => (
                    <tr key={l.id} className="hover:bg-gray-50/50">
                      <td className="px-5 py-3.5 font-mono font-bold text-gray-900">{l.lot_number}</td>
                      <td className="px-5 py-3.5 font-mono text-gray-600">{l.investment_date}</td>
                      <td className="px-5 py-3.5 font-mono font-bold text-gray-900">
                        {formatINR(l.principal_amount)}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-purple-600">
                        {formatINR(l.withdrawn_amount || 0)}
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-blue-700">{l.applicable_rate}%</td>
                      <td className="px-5 py-3.5 font-mono font-bold text-emerald-600">
                        {formatINR(l.accrued_return || 0)}
                      </td>
                      <td className="px-5 py-3.5 font-mono font-extrabold text-amber-600">
                        {formatINR(l.current_value || l.principal_amount)}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            l.status === 'Active'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-gray-100 text-gray-600'
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
      )}

      {/* TAB CONTENT: TRANSACTIONS */}
      {activeTab === 'transactions' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50/80 text-gray-500 font-bold border-b border-gray-100 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Date</th>
                  <th className="px-5 py-3.5">Transaction ID</th>
                  <th className="px-5 py-3.5">Type</th>
                  <th className="px-5 py-3.5">Amount</th>
                  <th className="px-5 py-3.5">Mode / UTR</th>
                  <th className="px-5 py-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-gray-400">
                      No transactions recorded.
                    </td>
                  </tr>
                ) : (
                  transactions.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50/50">
                      <td className="px-5 py-3.5 font-mono text-gray-600">{t.transaction_date}</td>
                      <td className="px-5 py-3.5 font-mono font-bold text-gray-900">{t.transaction_number}</td>
                      <td className="px-5 py-3.5 font-semibold text-gray-800">{t.type.replace(/_/g, ' ')}</td>
                      <td className="px-5 py-3.5 font-mono font-bold text-gray-900">{formatINR(t.amount)}</td>
                      <td className="px-5 py-3.5 font-mono text-gray-500">
                        {t.payment_mode || '—'} {t.utr_number ? `(${t.utr_number})` : ''}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          {t.status}
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

      {/* TAB CONTENT: WITHDRAWAL REQUESTS */}
      {activeTab === 'withdrawals' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50/80 text-gray-500 font-bold border-b border-gray-100 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Request ID</th>
                  <th className="px-5 py-3.5">Request Date</th>
                  <th className="px-5 py-3.5">Requested Amount</th>
                  <th className="px-5 py-3.5">Paid Amount</th>
                  <th className="px-5 py-3.5">Payment Date</th>
                  <th className="px-5 py-3.5">UTR / Ref</th>
                  <th className="px-5 py-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {withdrawals.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-gray-400">
                      No withdrawal requests submitted.
                    </td>
                  </tr>
                ) : (
                  withdrawals.map((w) => (
                    <tr key={w.id} className="hover:bg-gray-50/50">
                      <td className="px-5 py-3.5 font-mono font-bold text-gray-900">{w.withdrawal_number}</td>
                      <td className="px-5 py-3.5 font-mono text-gray-600">{w.request_date}</td>
                      <td className="px-5 py-3.5 font-mono font-bold text-gray-900">
                        {formatINR(w.requested_amount)}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-purple-600">
                        {w.paid_amount ? formatINR(w.paid_amount) : '—'}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-gray-600">{w.payment_date || '—'}</td>
                      <td className="px-5 py-3.5 font-mono text-gray-500">{w.utr_number || '—'}</td>
                      <td className="px-5 py-3.5">
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
