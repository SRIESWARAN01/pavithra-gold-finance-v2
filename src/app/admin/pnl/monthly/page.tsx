'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Building2,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Printer,
  Download,
  ShieldCheck,
  Receipt,
  FileText,
  AlertTriangle,
  ArrowRight,
  PieChart,
} from 'lucide-react';
import { getMonthlyPnL } from '@/lib/db/pnl';
import { listBranches } from '@/lib/db/branches';
import { getCurrentProfile } from '@/lib/auth';
import type { MonthlyPnLReport, Branch, Profile } from '@/types/database';

export default function MonthlyPnLPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [branches, setBranches] = useState<Array<Branch & { manager?: string }>>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1); // 1-12

  const [report, setReport] = useState<MonthlyPnLReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const isAdminOrOwner = profile?.role === 'Admin' || profile?.role === 'Owner';

  const months = [
    { value: 1, name: 'January' },
    { value: 2, name: 'February' },
    { value: 3, name: 'March' },
    { value: 4, name: 'April' },
    { value: 5, name: 'May' },
    { value: 6, name: 'June' },
    { value: 7, name: 'July' },
    { value: 8, name: 'August' },
    { value: 9, name: 'September' },
    { value: 10, name: 'October' },
    { value: 11, name: 'November' },
    { value: 12, name: 'December' },
  ];

  const years = [2024, 2025, 2026, 2027, 2028];

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
        console.error('Error initializing Monthly P&L:', err);
      }
    }
    init();
  }, []);

  const fetchMonthlyReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const branchParam = selectedBranchId === 'all' ? undefined : selectedBranchId;
      const res = await getMonthlyPnL({
        year: selectedYear,
        month: selectedMonth,
        branchId: branchParam,
      });
      setReport(res);
    } catch (err: any) {
      console.error('Error fetching Monthly P&L report:', err);
      setError('Failed to load Monthly P&L report. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMonthlyReport();
  }, [selectedYear, selectedMonth, selectedBranchId]);

  const formatINR = (val: number) => {
    return '₹ ' + (val || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const handleExportCSV = () => {
    if (!report) return;
    let csv = `PAVITHRA GOLD FINANCE - MONTHLY PROFIT & LOSS REPORT\r\n`;
    csv += `Report Reference,${report.reportReference}\r\n`;
    csv += `Month,${report.monthName} ${report.year}\r\n`;
    csv += `Generated At,${report.generatedAt}\r\n\r\n`;

    csv += `FINANCIAL SUMMARY\r\n`;
    csv += `Particular,Amount (INR)\r\n`;
    csv += `Total Recognized Income,${report.summary.totalIncome}\r\n`;
    csv += `Total Operating Expenses,${report.summary.totalExpenses}\r\n`;
    csv += `${report.summary.isProfit ? 'Net Profit' : 'Net Loss'},${report.summary.netProfitLoss}\r\n\r\n`;

    csv += `EXPENSE CATEGORY BREAKDOWN\r\n`;
    csv += `Expense Head,Transaction Count,Monthly Amount (INR)\r\n`;
    report.expenseBreakdown.forEach((e) => {
      csv += `"${e.category}",${e.count},${e.amount}\r\n`;
    });
    csv += `Total,${report.expenseBreakdown.reduce((s, e) => s + e.count, 0)},${report.summary.totalExpenses}\r\n\r\n`;

    csv += `DAILY REVENUE & EXPENSE TREND\r\n`;
    csv += `Date,Income (INR),Expense (INR),Net Profit / Loss (INR)\r\n`;
    report.dailyTrend.forEach((d) => {
      csv += `${d.date},${d.income},${d.expenses},${d.netProfitLoss}\r\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${report.reportReference}.csv`;
    link.click();
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 print:p-0 print:m-0 print:max-w-none">
      {/* 1. Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs print:border-none print:shadow-none print:p-0">
        <div>
          <div className="flex items-center gap-2 text-indigo-800 text-xs font-bold uppercase tracking-wider">
            <TrendingUp size={16} />
            <span>Monthly Performance</span>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight mt-1 flex items-center gap-2.5">
            Monthly P&amp;L Report
            {report && (
              <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                {report.reportReference}
              </span>
            )}
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Full monthly statement with category breakdowns and day-by-day profitability trend.
          </p>
        </div>

        {/* Filters & Actions */}
        <div className="flex flex-wrap items-center gap-2.5 print:hidden">
          {/* Month Selector */}
          <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 shadow-2xs">
            <Calendar size={14} className="text-gray-500 mr-2 shrink-0" />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="text-xs font-semibold text-gray-800 bg-transparent border-none focus:outline-hidden cursor-pointer"
            >
              {months.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>

          {/* Year Selector */}
          <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 shadow-2xs">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="text-xs font-semibold text-gray-800 bg-transparent border-none focus:outline-hidden cursor-pointer"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Branch Dropdown */}
          <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 shadow-2xs">
            <Building2 size={14} className="text-gray-500 mr-2 shrink-0" />
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              disabled={!isAdminOrOwner}
              className="text-xs font-semibold text-gray-800 bg-transparent border-none focus:outline-hidden cursor-pointer disabled:cursor-not-allowed"
            >
              {isAdminOrOwner && <option value="all">All Branches</option>}
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={fetchMonthlyReport}
            disabled={loading}
            title="Refresh Data"
            className="p-2.5 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-gray-900 shadow-2xs transition-colors disabled:opacity-50"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin text-blue-600' : ''} />
          </button>

          <button
            onClick={handleExportCSV}
            title="Export CSV"
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 shadow-2xs transition-colors"
          >
            <Download size={14} />
            <span>Export</span>
          </button>

          <button
            onClick={handlePrint}
            title="Print Report"
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-2xs transition-all"
          >
            <Printer size={14} />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* Print Header */}
      <div className="hidden print:block mb-4 pb-3 border-b border-gray-300 text-center">
        <h2 className="text-xl font-bold text-gray-900">PAVITHRA GOLD FINANCE</h2>
        <p className="text-xs text-gray-600 font-semibold uppercase tracking-wider mt-0.5">
          Monthly Profit &amp; Loss Statement • {report?.monthName} {report?.year} ({report?.reportReference})
        </p>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex justify-between items-center">
          <span>{error}</span>
          <button onClick={fetchMonthlyReport} className="font-bold underline hover:text-rose-900">
            Retry
          </button>
        </div>
      )}

      {/* 2. Monthly Summary Cards */}
      {report && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-1">
              Monthly Recognized Income
            </span>
            <span className="font-mono font-extrabold text-2xl text-emerald-700 block">
              {formatINR(report.summary.totalIncome)}
            </span>
            <span className="text-[11px] text-gray-400 mt-1 block">
              Earned from interest collections &amp; fees
            </span>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-1">
              Monthly Operating Expenses
            </span>
            <span className="font-mono font-extrabold text-2xl text-rose-700 block">
              {formatINR(report.summary.totalExpenses)}
            </span>
            <span className="text-[11px] text-gray-400 mt-1 block">
              Approved operational business expenditures
            </span>
          </div>

          <div
            className={`rounded-2xl border p-5 shadow-xs ${
              report.summary.isProfit
                ? 'bg-emerald-50/70 border-emerald-200'
                : 'bg-rose-50/70 border-rose-200'
            }`}
          >
            <span className="text-xs font-bold uppercase tracking-wider text-gray-700 block mb-1">
              {report.summary.isProfit ? 'Monthly Net Profit' : 'Monthly Net Loss'}
            </span>
            <span
              className={`font-mono font-extrabold text-2xl block ${
                report.summary.isProfit ? 'text-emerald-800' : 'text-rose-800'
              }`}
            >
              {formatINR(report.summary.netProfitLoss)}
            </span>
            <span className="text-[11px] text-gray-500 mt-1 block">
              Income − Expenses (Principal repayments excluded)
            </span>
          </div>
        </div>
      )}

      {/* 3. Monthly Expense Head Breakdown */}
      {report && (
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <PieChart size={18} className="text-indigo-600" />
                Monthly Expense Head Breakdown
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Distribution of expenses across operational heads for {report.monthName} {report.year}
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-rose-700">
              Total: {formatINR(report.summary.totalExpenses)}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-3.5 pl-5">Expense Head</th>
                  <th className="p-3.5 text-center">Number of Transactions</th>
                  <th className="p-3.5 text-right pr-5">Monthly Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {report.expenseBreakdown.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-6 text-center text-gray-400">
                      No expenses recorded for this month.
                    </td>
                  </tr>
                ) : (
                  report.expenseBreakdown.map((cat) => (
                    <tr key={cat.category} className="hover:bg-gray-50/80 transition-colors">
                      <td className="p-3.5 pl-5 font-bold text-gray-900">{cat.category}</td>
                      <td className="p-3.5 text-center font-mono text-gray-600">{cat.count}</td>
                      <td className="p-3.5 text-right pr-5 font-mono font-bold text-rose-700">
                        {formatINR(cat.amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. Monthly Daily Trend Table */}
      {report && (
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Calendar size={18} className="text-blue-600" />
                Daily Profitability Trend ({report.monthName} {report.year})
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Day-by-day breakdown of recognized revenue, operational expenses, and net profit/loss.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-3.5 pl-5">Date</th>
                  <th className="p-3.5 text-right">Recognized Income</th>
                  <th className="p-3.5 text-right">Operational Expenses</th>
                  <th className="p-3.5 text-right pr-5">Net Profit / Loss</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {report.dailyTrend.map((d) => (
                  <tr key={d.date} className="hover:bg-gray-50/80 transition-colors">
                    <td className="p-3.5 pl-5 font-mono text-gray-800 font-semibold">{d.date}</td>
                    <td className="p-3.5 text-right font-mono font-bold text-emerald-700">
                      {d.income > 0 ? formatINR(d.income) : '—'}
                    </td>
                    <td className="p-3.5 text-right font-mono font-bold text-rose-700">
                      {d.expenses > 0 ? formatINR(d.expenses) : '—'}
                    </td>
                    <td className="p-3.5 text-right pr-5 font-mono font-extrabold text-sm">
                      {d.income === 0 && d.expenses === 0 ? (
                        <span className="text-gray-400 font-normal">—</span>
                      ) : (
                        <span
                          className={`px-2 py-0.5 rounded-lg ${
                            d.isProfit
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {d.isProfit ? '+' : '-'} {formatINR(d.netProfitLoss)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
