'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  FileText,
  Calendar,
  Download,
  Printer,
  TrendingUp,
  ArrowDownLeft,
  ArrowUpRight,
  Filter,
  CheckCircle2,
  RefreshCw,
  Building2
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getInvestorPortfolio, getInvestorTransactions } from '@/lib/db/investments';
import { InvestorPortfolioSummary, InvestmentTransaction } from '@/types/database';

export default function InvestorStatementPage() {
  const { user } = useAuth();
  const [portfolio, setPortfolio] = useState<InvestorPortfolioSummary | null>(null);
  const [transactions, setTransactions] = useState<InvestmentTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  // Date filters
  const now = new Date();
  const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  const [fromDate, setFromDate] = useState<string>(oneYearAgo.toISOString().split('T')[0]);
  const [toDate, setToDate] = useState<string>(now.toISOString().split('T')[0]);

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
        console.error('Error loading statement data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [user]);

  // Compute period transactions
  const periodTxns = transactions.filter((t: InvestmentTransaction) => {
    const tDate = t.transaction_date || t.transactionDate || '';
    return tDate >= fromDate && tDate <= toDate;
  });

  // Calculate opening balance before fromDate
  const priorTxns = transactions.filter((t: InvestmentTransaction) => (t.transaction_date || t.transactionDate || '') < fromDate);
  const priorInvested = priorTxns
    .filter((t: InvestmentTransaction) => (t.type || t.transactionType || '').includes('Investment') && t.status === 'Completed')
    .reduce((sum, t) => sum + t.amount, 0);
  const priorWithdrawn = priorTxns
    .filter((t: InvestmentTransaction) => (t.type || t.transactionType || '').includes('Withdrawal') && t.status === 'Completed')
    .reduce((sum, t) => sum + t.amount, 0);
  const openingBalance = Math.max(0, priorInvested - priorWithdrawn);

  // Period totals
  const periodInvestments = periodTxns
    .filter((t: InvestmentTransaction) => (t.type || t.transactionType || '').includes('Investment') && t.status === 'Completed')
    .reduce((sum, t) => sum + t.amount, 0);

  const periodWithdrawals = periodTxns
    .filter((t: InvestmentTransaction) => (t.type || t.transactionType || '').includes('Withdrawal') && t.status === 'Completed')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalAccruedReturns = portfolio?.totalReturns || portfolio?.accrued_return || 0;
  const closingBalance = Math.max(0, openingBalance + periodInvestments + totalAccruedReturns - periodWithdrawals);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = ['Date', 'Transaction ID', 'Type', 'Amount (INR)', 'UTR', 'Status'];
    const rows = periodTxns.map((t: InvestmentTransaction) => [
      t.transaction_date || t.transactionDate || '',
      t.transaction_number || t.transactionId || t.id,
      t.type || t.transactionType || '',
      t.amount,
      t.utr_number || t.utr || '',
      t.status
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const invId = portfolio?.investor_number || portfolio?.investor?.investorId || 'INV';
    link.setAttribute('href', url);
    link.setAttribute('download', `PGF_Statement_${invId}_${fromDate}_to_${toDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadPDF = () => {
    const invId = portfolio?.investor_number || portfolio?.investor?.investorId || '';
    window.open(
      `/api/pdf?type=investor_statement&investorId=${invId}&fromDate=${fromDate}&toDate=${toDate}`,
      '_blank'
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin mb-4" />
        <p className="text-slate-400 font-medium text-sm tracking-wide">Compiling investment statement...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 print:p-0 print:space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-widest">
              Financial Summary
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mt-1 font-serif tracking-tight">
            My Investment Statement
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Periodic account balance reconciliation, capital contributions, accrued returns, and withdrawals.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all"
          >
            <Printer className="w-4 h-4 text-slate-400" />
            Print
          </button>
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all"
          >
            <Download className="w-4 h-4 text-slate-400" />
            Export CSV
          </button>
          <button
            onClick={handleDownloadPDF}
            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-all shadow-lg shadow-amber-500/20"
          >
            <FileText className="w-4 h-4" />
            Download PDF
          </button>
        </div>
      </div>

      {/* Date Filter Bar */}
      <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Calendar className="w-4 h-4 text-amber-400" />
            <span>From:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-400"
            />
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>To:</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-amber-400"
            />
          </div>
        </div>

        <div className="text-xs text-slate-500">
          Statement Period: <span className="text-slate-300 font-mono">{fromDate}</span> to{' '}
          <span className="text-slate-300 font-mono">{toDate}</span>
        </div>
      </div>

      {/* Printable Statement Document Header */}
      <div className="p-8 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl space-y-8 print:bg-white print:text-black print:border-none print:shadow-none print:p-0">
        {/* Company & Investor Banner */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-slate-800 print:border-gray-300 gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-serif text-xl font-bold tracking-tight text-white print:text-black">
                PAVITHRA GOLD FINANCE
              </span>
            </div>
            <p className="text-xs text-amber-400 print:text-amber-800 font-medium mt-0.5">
              Enterprise Wealth & Investment Portfolio Division
            </p>
            <p className="text-[11px] text-slate-500 print:text-gray-500 mt-1">
              Registered Office: Main Branch, Pavithra Gold Finance
            </p>
          </div>

          <div className="sm:text-right">
            <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-widest print:border-gray-400 print:text-black">
              Official Statement
            </span>
            <p className="text-xs font-mono text-slate-400 print:text-gray-600 mt-1.5">
              Investor ID: <span className="font-bold text-white print:text-black">{portfolio?.investor_number || portfolio?.investor?.investorId}</span>
            </p>
            <p className="text-xs font-semibold text-white print:text-black mt-0.5">
              {portfolio?.investor_name || portfolio?.investor?.name}
            </p>
            <p className="text-[11px] text-slate-400 print:text-gray-500 font-mono">
              +91 {portfolio?.investor_phone || portfolio?.investor?.phone}
            </p>
          </div>
        </div>

        {/* Financial Accounting Equation Card */}
        <div className="p-6 rounded-2xl bg-slate-950/80 border border-slate-800 print:bg-gray-50 print:border-gray-300">
          <h2 className="text-xs uppercase tracking-wider font-semibold text-slate-400 print:text-gray-600 mb-4">
            Balance Movement & Accounting Reconciliation
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-center items-center">
            <div className="p-3 rounded-xl bg-slate-900/60 print:bg-white border border-slate-800/80 print:border-gray-200">
              <p className="text-[11px] uppercase tracking-wider text-slate-500 print:text-gray-500 font-medium">Opening Balance</p>
              <p className="text-base sm:text-lg font-bold text-white print:text-black mt-1 font-mono">
                ₹{openingBalance.toLocaleString('en-IN')}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/60 print:bg-white border border-slate-800/80 print:border-gray-200">
              <p className="text-[11px] uppercase tracking-wider text-emerald-500 print:text-emerald-700 font-medium">+ Investments</p>
              <p className="text-base sm:text-lg font-bold text-emerald-400 print:text-emerald-700 mt-1 font-mono">
                ₹{periodInvestments.toLocaleString('en-IN')}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/60 print:bg-white border border-slate-800/80 print:border-gray-200">
              <p className="text-[11px] uppercase tracking-wider text-blue-400 print:text-blue-700 font-medium">+ Accrued Returns</p>
              <p className="text-base sm:text-lg font-bold text-blue-400 print:text-blue-700 mt-1 font-mono">
                ₹{totalAccruedReturns.toLocaleString('en-IN')}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/60 print:bg-white border border-slate-800/80 print:border-gray-200">
              <p className="text-[11px] uppercase tracking-wider text-amber-500 print:text-amber-700 font-medium">− Withdrawals</p>
              <p className="text-base sm:text-lg font-bold text-amber-400 print:text-amber-700 mt-1 font-mono">
                ₹{periodWithdrawals.toLocaleString('en-IN')}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-amber-500/10 print:bg-amber-50 border border-amber-500/30 print:border-amber-200 col-span-2 sm:col-span-1">
              <p className="text-[11px] uppercase tracking-wider text-amber-400 print:text-amber-800 font-semibold">= Closing Value</p>
              <p className="text-lg sm:text-xl font-bold text-amber-400 print:text-amber-900 mt-1 font-mono">
                ₹{closingBalance.toLocaleString('en-IN')}
              </p>
            </div>
          </div>
        </div>

        {/* Transactions in Period */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-white print:text-black uppercase tracking-wider">
            Period Activity Ledger ({periodTxns.length} records)
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 print:border-gray-300 bg-slate-950/60 print:bg-gray-100 text-slate-400 print:text-gray-700 uppercase tracking-wider font-semibold">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Transaction ID</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4 text-right">Credit (₹)</th>
                  <th className="py-3 px-4 text-right">Debit (₹)</th>
                  <th className="py-3 px-4">Reference / UTR</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 print:divide-gray-200 text-slate-300 print:text-black font-medium">
                {periodTxns.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500 print:text-gray-500">
                      No transaction activity registered in the selected period.
                    </td>
                  </tr>
                ) : (
                  periodTxns.map((t: InvestmentTransaction) => {
                    const tType = t.type || t.transactionType || '';
                    const isCredit = tType.includes('Investment');
                    const txnId = t.transaction_number || t.transactionId || t.id;
                    const tDate = t.transaction_date || t.transactionDate;
                    const utr = t.utr_number || t.utr;

                    return (
                      <tr key={txnId} className="hover:bg-slate-800/20 print:hover:bg-transparent">
                        <td className="py-3 px-4 whitespace-nowrap font-mono">{tDate}</td>
                        <td className="py-3 px-4 whitespace-nowrap font-mono text-amber-400 print:text-amber-800">
                          {txnId}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">{tType.replace(/_/g, ' ')}</td>
                        <td className="py-3 px-4 whitespace-nowrap text-right font-mono text-emerald-400 print:text-emerald-700">
                          {isCredit ? `₹${t.amount.toLocaleString('en-IN')}` : '—'}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-right font-mono text-amber-400 print:text-amber-800">
                          {!isCredit ? `₹${t.amount.toLocaleString('en-IN')}` : '—'}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-400 print:text-gray-600">
                          {utr || '—'}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 print:bg-gray-200 text-slate-300 print:text-black">
                            {t.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Legal Disclaimer & Compliance Footer */}
        <div className="pt-6 border-t border-slate-800 print:border-gray-300 text-[10px] text-slate-500 print:text-gray-500 leading-relaxed">
          <p className="font-semibold text-slate-400 print:text-gray-700 uppercase tracking-wider mb-1">
            Important Legal & Compliance Notice
          </p>
          <p>
            This statement reflects posted capital investments, accrued returns calculated per configured plan parameters, and official settlement disbursements. Accrued returns are subject to applicable business and compounding terms. This is a computer-generated statement issued by Pavithra Gold Finance and does not require physical signature.
          </p>
        </div>
      </div>
    </div>
  );
}
