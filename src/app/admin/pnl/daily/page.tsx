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
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Receipt,
  FileText,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  ChevronDown,
} from 'lucide-react';
import { getDailyPnL } from '@/lib/db/pnl';
import { listBranches } from '@/lib/db/branches';
import { getCurrentProfile } from '@/lib/auth';
import type { DailyPnLReport, Branch, Profile, Expense } from '@/types/database';

export default function DailyPnLPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [branches, setBranches] = useState<Array<Branch & { manager?: string }>>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [report, setReport] = useState<DailyPnLReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Drilldown filter
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string | null>(null);

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
        console.error('Error initializing Daily P&L:', err);
      }
    }
    init();
  }, []);

  const fetchDailyReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const branchParam = selectedBranchId === 'all' ? undefined : selectedBranchId;
      const res = await getDailyPnL({
        date: selectedDate,
        branchId: branchParam,
      });
      setReport(res);
      setSelectedCategoryFilter(null);
    } catch (err: any) {
      console.error('Error fetching Daily P&L report:', err);
      setError('Failed to load Daily P&L report. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDailyReport();
  }, [selectedDate, selectedBranchId]);

  // Date Navigation
  const handlePrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  const formatINR = (val: number) => {
    return '₹ ' + (val || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatDisplayDate = (dStr: string) => {
    if (!dStr) return '';
    const parts = dStr.split('-');
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    return dStr;
  };

  // CSV Export
  const handleExportCSV = () => {
    if (!report) return;
    let csv = `PAVITHRA GOLD FINANCE - DAILY PROFIT & LOSS REPORT\r\n`;
    csv += `Report Reference,${report.reportReference}\r\n`;
    csv += `Date,${formatDisplayDate(report.date)}\r\n`;
    csv += `Generated At,${report.generatedAt}\r\n\r\n`;

    csv += `FINANCIAL SUMMARY\r\n`;
    csv += `Particular,Amount (INR)\r\n`;
    csv += `Total Recognized Income,${report.summary.totalIncome}\r\n`;
    csv += `Total Operating Expenses,${report.summary.totalExpenses}\r\n`;
    csv += `${report.summary.isProfit ? 'Net Profit' : 'Net Loss'},${report.summary.netProfitLoss}\r\n\r\n`;

    csv += `INCOME BREAKDOWN\r\n`;
    csv += `Source,Amount (INR)\r\n`;
    csv += `Interest Income,${report.incomeBreakdown.interestIncome}\r\n`;
    csv += `Penalty Income,${report.incomeBreakdown.penaltyIncome}\r\n`;
    csv += `Other Income / Processing Fees,${report.incomeBreakdown.otherIncome}\r\n\r\n`;

    csv += `EXPENSE CATEGORY BREAKDOWN\r\n`;
    csv += `Category Head,Entries Count,Total Amount (INR)\r\n`;
    report.expenseBreakdown.forEach((e) => {
      csv += `"${e.category}",${e.count},${e.amount}\r\n`;
    });
    csv += `Total,${report.expenseBreakdown.reduce((s, e) => s + e.count, 0)},${report.summary.totalExpenses}\r\n\r\n`;

    csv += `EXPENSE TRANSACTIONS\r\n`;
    csv += `Expense No,Category,Description,Amount,Payment Mode,Vendor,Status\r\n`;
    report.expenseItems.forEach((item) => {
      csv += `${item.expense_number},"${item.category}","${item.description}",${item.amount},${item.payment_mode},"${item.vendor_name || '-'}",${item.status}\r\n`;
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

  // Filtered expense drilldown
  const filteredExpenseItems = report?.expenseItems.filter((item) => {
    if (!selectedCategoryFilter) return true;
    return item.category === selectedCategoryFilter;
  }) || [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 print:p-0 print:m-0 print:max-w-none">
      {/* 1. Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs print:border-none print:shadow-none print:p-0">
        <div>
          <div className="flex items-center gap-2 text-blue-800 text-xs font-bold uppercase tracking-wider">
            <Calendar size={16} />
            <span>Profit &amp; Loss Statement</span>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight mt-1 flex items-center gap-2.5">
            Daily P&amp;L Report
            {report && (
              <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700 border border-gray-200">
                {report.reportReference}
              </span>
            )}
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Detailed daily income and expense analysis with category drill-downs.
          </p>
        </div>

        {/* Filters & Actions */}
        <div className="flex flex-wrap items-center gap-2.5 print:hidden">
          {/* Date Picker */}
          <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl p-1 shadow-2xs">
            <button
              onClick={handlePrevDay}
              title="Previous Day"
              className="p-1.5 rounded-lg text-gray-600 hover:bg-white hover:text-gray-900 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="flex items-center gap-1.5 px-2">
              <Calendar size={14} className="text-gray-500" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="text-xs font-bold text-gray-800 bg-transparent border-none focus:outline-hidden cursor-pointer"
              />
            </div>
            <button
              onClick={handleNextDay}
              title="Next Day"
              className="p-1.5 rounded-lg text-gray-600 hover:bg-white hover:text-gray-900 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
            <button
              onClick={handleToday}
              className="ml-1 px-2.5 py-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
            >
              Today
            </button>
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
            onClick={fetchDailyReport}
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
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-2xs transition-all"
          >
            <Printer size={14} />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* Print-only Header */}
      <div className="hidden print:block mb-4 pb-3 border-b border-gray-300 text-center">
        <h2 className="text-xl font-bold text-gray-900">PAVITHRA GOLD FINANCE</h2>
        <p className="text-xs text-gray-600 font-semibold uppercase tracking-wider mt-0.5">
          Daily Profit &amp; Loss Statement • {report?.reportReference}
        </p>
        <p className="text-[11px] text-gray-500 mt-1">
          Date: <span className="font-bold text-gray-900">{formatDisplayDate(selectedDate)}</span> | Generated:{' '}
          {report?.generatedAt ? new Date(report.generatedAt).toLocaleString('en-IN') : 'N/A'}
        </p>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex justify-between items-center">
          <span>{error}</span>
          <button onClick={fetchDailyReport} className="font-bold underline hover:text-rose-900">
            Retry
          </button>
        </div>
      )}

      {/* 2. Primary Financial Position Summary Card */}
      {report && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-1">
              Total Recognized Income
            </span>
            <span className="font-mono font-extrabold text-2xl text-emerald-700 block">
              {formatINR(report.summary.totalIncome)}
            </span>
            <span className="text-[11px] text-gray-400 mt-1 block">
              Interest, penalties &amp; processing charges
            </span>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-1">
              Total Operating Expenses
            </span>
            <span className="font-mono font-extrabold text-2xl text-rose-700 block">
              {formatINR(report.summary.totalExpenses)}
            </span>
            <span className="text-[11px] text-gray-400 mt-1 block">
              Approved operational business expenses
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
              {report.summary.isProfit ? "Today's Net Profit" : "Today's Net Loss"}
            </span>
            <span
              className={`font-mono font-extrabold text-2xl block ${
                report.summary.isProfit ? 'text-emerald-800' : 'text-rose-800'
              }`}
            >
              {formatINR(report.summary.netProfitLoss)}
            </span>
            <span className="text-[11px] text-gray-500 mt-1 block">
              Income − Expenses (Principal repayment excluded)
            </span>
          </div>
        </div>
      )}

      {/* 3. Detailed Particulars: Income vs Expense Breakdown */}
      {report && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Income Breakdown */}
          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-emerald-50/30">
              <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <TrendingUp size={16} className="text-emerald-600" />
                Income Breakdown
              </h2>
              <span className="text-xs font-mono font-bold text-emerald-700">
                Total: {formatINR(report.summary.totalIncome)}
              </span>
            </div>

            <div className="p-4 space-y-3 text-xs">
              <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
                <span className="text-gray-600 font-medium">Interest Income:</span>
                <span className="font-mono font-bold text-gray-900">
                  {formatINR(report.incomeBreakdown.interestIncome)}
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
                <span className="text-gray-600 font-medium">Penalty Income:</span>
                <span className="font-mono font-bold text-gray-900">
                  {formatINR(report.incomeBreakdown.penaltyIncome)}
                </span>
              </div>
              <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
                <span className="text-gray-600 font-medium">Other Income / Processing Fees:</span>
                <span className="font-mono font-bold text-gray-900">
                  {formatINR(report.incomeBreakdown.otherIncome)}
                </span>
              </div>
              <div className="pt-2 text-[11px] text-gray-400 italic">
                * Note: Customer principal repayments are asset balance-sheet movements and are never credited as income.
              </div>
            </div>
          </div>

          {/* Expense Category Breakdown Table */}
          <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-rose-50/30">
              <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <TrendingDown size={16} className="text-rose-600" />
                Expense Category Breakdown
              </h2>
              <span className="text-xs font-mono font-bold text-rose-700">
                Total: {formatINR(report.summary.totalExpenses)}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase text-[10px] font-bold">
                  <tr>
                    <th className="p-2.5 pl-4">Expense Head</th>
                    <th className="p-2.5 text-center">Entries</th>
                    <th className="p-2.5 text-right pr-4">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {report.expenseBreakdown.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="p-4 text-center text-gray-400">
                        No expenses recorded for this date.
                      </td>
                    </tr>
                  ) : (
                    report.expenseBreakdown.map((cat) => (
                      <tr
                        key={cat.category}
                        onClick={() =>
                          setSelectedCategoryFilter(
                            selectedCategoryFilter === cat.category ? null : cat.category
                          )
                        }
                        className={`cursor-pointer transition-colors ${
                          selectedCategoryFilter === cat.category
                            ? 'bg-rose-50 font-bold'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <td className="p-2.5 pl-4 flex items-center gap-1.5 text-gray-900">
                          <span>{cat.category}</span>
                          {selectedCategoryFilter === cat.category && (
                            <span className="text-[10px] text-rose-600 font-semibold">(Filtered)</span>
                          )}
                        </td>
                        <td className="p-2.5 text-center font-mono text-gray-600">{cat.count}</td>
                        <td className="p-2.5 text-right pr-4 font-mono font-bold text-rose-700">
                          {formatINR(cat.amount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4. Underlying Expense Transactions Drill-Down */}
      {report && (
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Receipt size={18} className="text-blue-600" />
                Underlying Expense Transactions
                {selectedCategoryFilter && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200">
                    Filtered: {selectedCategoryFilter}
                  </span>
                )}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {filteredExpenseItems.length} transaction(s) recorded on {formatDisplayDate(selectedDate)}
              </p>
            </div>

            {selectedCategoryFilter && (
              <button
                onClick={() => setSelectedCategoryFilter(null)}
                className="text-xs font-bold text-blue-600 hover:underline self-start sm:self-auto"
              >
                Clear Category Filter
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3 pl-4">Expense No</th>
                  <th className="p-3">Expense Head</th>
                  <th className="p-3">Description</th>
                  <th className="p-3">Vendor / Payee</th>
                  <th className="p-3">Payment Mode</th>
                  <th className="p-3 text-right">Amount</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredExpenseItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-gray-400">
                      No expense transactions found for this date.
                    </td>
                  </tr>
                ) : (
                  filteredExpenseItems.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="p-3 pl-4 font-mono font-bold text-blue-700">
                        {item.expense_number}
                      </td>
                      <td className="p-3 font-semibold text-gray-900">{item.category}</td>
                      <td className="p-3 text-gray-600 max-w-xs truncate" title={item.description}>
                        {item.description}
                      </td>
                      <td className="p-3 text-gray-600">{item.vendor_name || '-'}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-800 text-[10px] font-semibold">
                          {item.payment_mode}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-rose-700">
                        {formatINR(item.amount)}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            item.status === 'Approved' || item.status === 'Posted'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {item.status}
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
