'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  FileText,
  Search,
  Filter,
  Download,
  Calendar,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getInvestorPortfolio, getInvestorTransactions } from '@/lib/db/investments';
import { InvestorPortfolioSummary, InvestmentTransaction } from '@/types/database';

export default function InvestorTransactionsPage() {
  const { user } = useAuth();
  const [portfolio, setPortfolio] = useState<InvestorPortfolioSummary | null>(null);
  const [transactions, setTransactions] = useState<InvestmentTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  useEffect(() => {
    async function loadData() {
      if (!user?.uid) return;
      try {
        setLoading(true);
        const [portData, txnData] = await Promise.all([
          getInvestorPortfolio(user.uid),
          getInvestorTransactions(user.uid)
        ]);
        setPortfolio(portData);
        setTransactions(txnData);
      } catch (err) {
        console.error('Error loading transactions:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [user]);

  const filteredTransactions = transactions.filter((t: InvestmentTransaction) => {
    const txnId = t.transaction_number || t.transactionId || '';
    const utrVal = t.utr_number || t.utr || '';
    const lotVal = t.lot_id || t.lotId || '';
    const matchesSearch =
      txnId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      utrVal.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lotVal.toLowerCase().includes(searchTerm.toLowerCase());

    const tType = t.type || t.transactionType || '';
    const matchesType = filterType === 'ALL' || tType === filterType;
    const matchesStatus = filterStatus === 'ALL' || t.status === filterStatus;

    return matchesSearch && matchesType && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Approved':
      case 'Completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" />
            {status}
          </span>
        );
      case 'Pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3 h-3" />
            Pending
          </span>
        );
      case 'Rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="w-3 h-3" />
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
            {status}
          </span>
        );
    }
  };

  const getTypeIcon = (type: string) => {
    if (type.includes('Investment')) {
      return (
        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
          <ArrowDownLeft className="w-4 h-4" />
        </div>
      );
    }
    if (type.includes('Withdrawal')) {
      return (
        <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
          <ArrowUpRight className="w-4 h-4" />
        </div>
      );
    }
    return (
      <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
        <TrendingUp className="w-4 h-4" />
      </div>
    );
  };

  const handleDownloadReceipt = (txn: InvestmentTransaction) => {
    const txnId = txn.transaction_number || txn.transactionId || txn.id;
    const invId = portfolio?.investor_number || portfolio?.investor?.investorId || '';
    window.open(`/api/pdf?type=investment_receipt&id=${txnId}&investorId=${invId}`, '_blank');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin mb-4" />
        <p className="text-slate-400 font-medium text-sm tracking-wide">Loading transaction ledger...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-widest">
              Ledger Audit
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mt-1 font-serif tracking-tight">
            Transaction History
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Immutable, date-wise audit record of all capital investments, returns, and withdrawals.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/investor/statement"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-semibold text-xs transition-all shadow-sm"
          >
            <FileText className="w-4 h-4 text-amber-400" />
            Download Statement
          </Link>
          <Link
            href="/investor/invest"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-amber-500/20"
          >
            <ArrowDownLeft className="w-4 h-4" />
            + Add Investment
          </Link>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col md:flex-row gap-4 items-center justify-between backdrop-blur-sm">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by Txn ID, UTR, or Lot ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-amber-400 transition-all"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Filter className="w-3.5 h-3.5 text-amber-400" />
            <span>Type:</span>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-400"
            >
              <option value="ALL">All Types</option>
              <option value="Initial_Investment">Initial Investment</option>
              <option value="Additional_Investment">Additional Investment</option>
              <option value="Withdrawal_Approved">Withdrawal Approved</option>
              <option value="Withdrawal_Paid">Withdrawal Paid</option>
              <option value="Return_Accrual">Return Accrual</option>
            </select>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>Status:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-400"
            >
              <option value="ALL">All Statuses</option>
              <option value="Approved">Approved</option>
              <option value="Completed">Completed</option>
              <option value="Pending">Pending</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="rounded-3xl bg-slate-900/80 border border-slate-800 overflow-hidden shadow-xl backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold">
                <th className="py-4 px-5">Date & Time</th>
                <th className="py-4 px-5">Transaction ID</th>
                <th className="py-4 px-5">Type</th>
                <th className="py-4 px-5 text-right">Amount</th>
                <th className="py-4 px-5">Reference / UTR</th>
                <th className="py-4 px-5">Status</th>
                <th className="py-4 px-5 text-center">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300 font-medium">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-500">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-30 text-slate-400" />
                    <p className="text-sm font-semibold text-slate-400">No transactions found</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {searchTerm || filterType !== 'ALL' || filterStatus !== 'ALL'
                        ? 'Try adjusting your search criteria or filters.'
                        : 'Your investment activity will appear here once registered.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((txn: InvestmentTransaction) => {
                  const tType = txn.type || txn.transactionType || '';
                  const isCredit = tType.includes('Investment');
                  const txnId = txn.transaction_number || txn.transactionId || txn.id;
                  const lotId = txn.lot_id || txn.lotId;
                  const tDate = txn.transaction_date || txn.transactionDate;
                  const utr = txn.utr_number || txn.utr;

                  return (
                    <tr
                      key={txnId}
                      className="hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-4 px-5 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                          <span>{tDate}</span>
                        </div>
                      </td>

                      <td className="py-4 px-5 whitespace-nowrap">
                        <span className="font-mono text-amber-400 font-semibold">
                          {txnId}
                        </span>
                        {lotId && (
                          <span className="block text-[10px] text-slate-500 font-mono">
                            Lot: {lotId}
                          </span>
                        )}
                      </td>

                      <td className="py-4 px-5 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          {getTypeIcon(tType)}
                          <div>
                            <p className="text-white font-semibold">{tType.replace(/_/g, ' ')}</p>
                            <p className="text-[10px] text-slate-500">
                              {txn.payment_mode || txn.paymentMode || 'Direct Transfer'}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="py-4 px-5 whitespace-nowrap text-right">
                        <span
                          className={`font-mono text-sm font-bold ${
                            isCredit ? 'text-emerald-400' : 'text-amber-400'
                          }`}
                        >
                          {isCredit ? '+' : '-'}₹{txn.amount.toLocaleString('en-IN')}
                        </span>
                      </td>

                      <td className="py-4 px-5 whitespace-nowrap font-mono text-slate-400">
                        {utr ? (
                          <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-[11px] text-slate-300">
                            {utr}
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>

                      <td className="py-4 px-5 whitespace-nowrap">
                        {getStatusBadge(txn.status)}
                      </td>

                      <td className="py-4 px-5 whitespace-nowrap text-center">
                        <button
                          onClick={() => handleDownloadReceipt(txn)}
                          title="Download Official PDF Receipt"
                          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all inline-flex items-center justify-center border border-slate-700/60 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5 text-amber-400" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
