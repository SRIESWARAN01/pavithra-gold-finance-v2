// src/app/admin/investments/transactions/page.tsx
// Investment Transactions Register — Complete audit of capital inflows, returns, and withdrawal settlements.

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Coins,
  Search,
  Filter,
  Download,
  RefreshCw,
  AlertCircle,
  Calendar,
  Phone,
  User,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import type { InvestmentTransaction } from '@/types/database';

export default function InvestmentTransactionsPage() {
  const [transactions, setTransactions] = useState<InvestmentTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [search, setSearch] = useState('');

  const loadTransactions = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = query(collection(db, 'investment_transactions'), orderBy('created_at', 'desc'));
      const snap = await getDocs(q);
      const list: InvestmentTransaction[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<InvestmentTransaction, 'id'>),
      }));
      setTransactions(list);
    } catch (err: any) {
      console.error('Error loading transactions:', err);
      setError(err.message || 'Failed to load transaction register.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, []);

  const formatINR = (val?: number) => {
    return '₹' + (val || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const matchType = typeFilter === 'All' || t.type === typeFilter;
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        t.transaction_number.toLowerCase().includes(q) ||
        t.investor_number.toLowerCase().includes(q) ||
        (t.utr_number && t.utr_number.toLowerCase().includes(q)) ||
        (t.notes && t.notes.toLowerCase().includes(q));
      return matchType && matchSearch;
    });
  }, [transactions, typeFilter, search]);

  const handleExportCSV = () => {
    if (filteredTransactions.length === 0) return;
    let csv = `Date,Transaction Number,Investor ID,Type,Amount,Rate,Payment Mode,UTR,Status,Notes\r\n`;
    filteredTransactions.forEach((t) => {
      csv += `${t.transaction_date},${t.transaction_number},${t.investor_number},${t.type},${t.amount},${t.rate || 0},${t.payment_mode || ''},"${t.utr_number || ''}",${t.status},"${t.notes || ''}"\r\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `PGF_Investment_Transactions_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
              Financial Audit Register
            </span>
            <span className="text-xs text-gray-500 font-semibold">{transactions.length} Total Postings</span>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 font-outfit">Investment Transactions</h1>
          <p className="text-xs text-gray-500">
            Immutable chronological ledger of all capital investments, return accruals, and withdrawal payouts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadTransactions}
            disabled={loading}
            className="p-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-all cursor-pointer"
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={handleExportCSV}
            disabled={filteredTransactions.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/20 transition-all cursor-pointer disabled:opacity-50"
          >
            <Download size={14} />
            Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-3">
          <AlertCircle size={18} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter & Search */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="relative flex-1 w-full">
          <Search size={16} className="absolute left-3.5 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search by Transaction ID, Investor ID, UTR, or Notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter size={15} className="text-gray-400" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2.5 rounded-xl border border-gray-200 text-xs text-gray-700 bg-white focus:outline-none"
          >
            <option value="All">All Transaction Types</option>
            <option value="Initial_Investment">Initial Investment</option>
            <option value="Additional_Investment">Additional Investment</option>
            <option value="Withdrawal_Paid">Withdrawal Paid</option>
            <option value="Return_Accrual">Return Accrual</option>
            <option value="Adjustment">Adjustment</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-gray-50/80 text-gray-500 font-bold border-b border-gray-100 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Date</th>
                <th className="px-5 py-3.5">Transaction ID</th>
                <th className="px-5 py-3.5">Investor ID</th>
                <th className="px-5 py-3.5">Type</th>
                <th className="px-5 py-3.5">Amount</th>
                <th className="px-5 py-3.5">Mode / UTR</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-gray-400">
                    <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-blue-600" />
                    Loading transaction records...
                  </td>
                </tr>
              ) : filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-gray-400">
                    No transactions found.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-4 font-mono text-gray-600">{t.transaction_date}</td>
                    <td className="px-5 py-4 font-mono font-bold text-gray-900">{t.transaction_number}</td>
                    <td className="px-5 py-4 font-mono font-bold text-blue-700">
                      <Link href={`/admin/investments/investors/${t.investor_id}`} className="hover:underline">
                        {t.investor_number}
                      </Link>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center gap-1 font-bold text-[11px] ${
                          t.type === 'Withdrawal_Paid' ? 'text-purple-700' : 'text-emerald-700'
                        }`}
                      >
                        {t.type === 'Withdrawal_Paid' ? <ArrowDownLeft size={13} /> : <ArrowUpRight size={13} />}
                        {t.type.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td
                      className={`px-5 py-4 font-mono font-extrabold text-sm ${
                        t.type === 'Withdrawal_Paid' ? 'text-purple-700' : 'text-emerald-700'
                      }`}
                    >
                      {formatINR(t.amount)}
                    </td>
                    <td className="px-5 py-4 font-mono text-gray-600">
                      <div>{t.payment_mode || '—'}</div>
                      {t.utr_number && <div className="text-[10px] text-gray-400">UTR: {t.utr_number}</div>}
                    </td>
                    <td className="px-5 py-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {t.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-500 text-[11px] max-w-xs truncate">
                      {t.notes || '—'}
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
