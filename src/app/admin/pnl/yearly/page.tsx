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
  BarChart3,
  PieChart,
} from 'lucide-react';
import { getYearlyPnL } from '@/lib/db/pnl';
import { listBranches } from '@/lib/db/branches';
import { getCurrentProfile } from '@/lib/auth';
import type { YearlyPnLReport, Branch, Profile } from '@/types/database';

export default function YearlyPnLPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [branches, setBranches] = useState<Array<Branch & { manager?: string }>>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');

  const now = new Date();
  const currentFyStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const [selectedStartYear, setSelectedStartYear] = useState<number>(currentFyStart);

  const [report, setReport] = useState<YearlyPnLReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const isAdminOrOwner = profile?.role === 'Admin' || profile?.role === 'Owner';

  const fyOptions = [
    { startYear: 2024, label: 'Financial Year 2024–25' },
    { startYear: 2025, label: 'Financial Year 2025–26' },
    { startYear: 2026, label: 'Financial Year 2026–27' },
    { startYear: 2027, label: 'Financial Year 2027–28' },
  ];

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
        console.error('Error initializing Yearly P&L:', err);
      }
    }
    init();
  }, []);

  const fetchYearlyReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const branchParam = selectedBranchId === 'all' ? undefined : selectedBranchId;
      const res = await getYearlyPnL({
        financialYearStart: selectedStartYear,
        branchId: branchParam,
      });
      setReport(res);
    } catch (err: any) {
      console.error('Error fetching Yearly P&L report:', err);
      setError('Failed to load Yearly P&L report. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchYearlyReport();
  }, [selectedStartYear, selectedBranchId]);

  const formatINR = (val: number) => {
    return '₹ ' + (val || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const handleExportCSV = () => {
    if (!report) return;
    let csv = `PAVITHRA GOLD FINANCE - YEARLY PROFIT & LOSS REPORT\r\n`;
    csv += `Report Reference,${report.reportReference}\r\n`;
    csv += `Financial Year,${report.financialYear}\r\n`;
    csv += `Generated At,${report.generatedAt}\r\n\r\n`;

    csv += `ANNUAL FINANCIAL SUMMARY\r\n`;
    csv += `Particular,Amount (INR)\r\n`;
    csv += `Annual Recognized Income,${report.summary.totalIncome}\r\n`;
    csv += `Annual Operating Expenses,${report.summary.totalExpenses}\r\n`;
    csv += `${report.summary.isProfit ? 'Annual Net Profit' : 'Annual Net Loss'},${report.summary.netProfitLoss}\r\n\r\n`;

    csv += `12-MONTH FINANCIAL PERFORMANCE (APRIL TO MARCH)\r\n`;
    csv += `Month,Income (INR),Expenses (INR),Net Profit / Loss (INR)\r\n`;
    report.monthlyBreakdown.forEach((m) => {
      csv += `${m.monthName},${m.income},${m.expenses},${m.netProfitLoss}\r\n`;
    });
    csv += `\r\n`;

    csv += `YEARLY EXPENSE HEAD ANALYSIS\r\n`;
    csv += `Expense Head,Annual Amount (INR)\r\n`;
    report.expenseHeadAnalysis.forEach((e) => {
      csv += `"${e.category}",${e.amount}\r\n`;
    });
    csv += `Total Annual Expenses,${report.summary.totalExpenses}\r\n`;

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
          <div className="flex items-center gap-2 text-purple-800 text-xs font-bold uppercase tracking-wider">
            <BarChart3 size={16} />
            <span>Annual Financial Statement</span>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight mt-1 flex items-center gap-2.5">
            Yearly P&amp;L Report
            {report && (
              <span className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                {report.reportReference}
              </span>
            )}
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Full financial year performance (April to March) with 12-month trajectory and category analysis.
          </p>
        </div>

        {/* Filters & Actions */}
        <div className="flex flex-wrap items-center gap-2.5 print:hidden">
          {/* FY Selector */}
          <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 shadow-2xs">
            <Calendar size={14} className="text-gray-500 mr-2 shrink-0" />
            <select
              value={selectedStartYear}
              onChange={(e) => setSelectedStartYear(Number(e.target.value))}
              className="text-xs font-semibold text-gray-800 bg-transparent border-none focus:outline-hidden cursor-pointer"
            >
              {fyOptions.map((fy) => (
                <option key={fy.startYear} value={fy.startYear}>
                  {fy.label}
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
            onClick={fetchYearlyReport}
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
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-2xs transition-all"
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
          Yearly Profit &amp; Loss Statement • {report?.financialYear} ({report?.reportReference})
        </p>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex justify-between items-center">
          <span>{error}</span>
          <button onClick={fetchYearlyReport} className="font-bold underline hover:text-rose-900">
            Retry
          </button>
        </div>
      )}

      {/* 2. Annual Summary Cards */}
      {report && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-1">
              Annual Recognized Income
            </span>
            <span className="font-mono font-extrabold text-2xl text-emerald-700 block">
              {formatINR(report.summary.totalIncome)}
            </span>
            <span className="text-[11px] text-gray-400 mt-1 block">
              Recognized interest &amp; other operational earnings
            </span>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 block mb-1">
              Annual Operating Expenses
            </span>
            <span className="font-mono font-extrabold text-2xl text-rose-700 block">
              {formatINR(report.summary.totalExpenses)}
            </span>
            <span className="text-[11px] text-gray-400 mt-1 block">
              Total operational expenditures across heads
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
              {report.summary.isProfit ? 'Annual Net Profit' : 'Annual Net Loss'}
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

      {/* 3. 12-Month Performance Table (April to March) */}
      {report && (
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Calendar size={18} className="text-purple-600" />
                12-Month Financial Performance ({report.financialYear})
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Indian Financial Year sequence from April to March.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-3.5 pl-5">Month</th>
                  <th className="p-3.5 text-right">Recognized Income</th>
                  <th className="p-3.5 text-right">Operational Expenses</th>
                  <th className="p-3.5 text-right pr-5">Net Profit / Loss</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {report.monthlyBreakdown.map((m) => (
                  <tr key={m.monthName} className="hover:bg-gray-50/80 transition-colors">
                    <td className="p-3.5 pl-5 font-bold text-gray-900">{m.monthName}</td>
                    <td className="p-3.5 text-right font-mono font-bold text-emerald-700">
                      {m.income > 0 ? formatINR(m.income) : '—'}
                    </td>
                    <td className="p-3.5 text-right font-mono font-bold text-rose-700">
                      {m.expenses > 0 ? formatINR(m.expenses) : '—'}
                    </td>
                    <td className="p-3.5 text-right pr-5 font-mono font-extrabold text-sm">
                      {m.income === 0 && m.expenses === 0 ? (
                        <span className="text-gray-400 font-normal">—</span>
                      ) : (
                        <span
                          className={`px-2 py-0.5 rounded-lg ${
                            m.isProfit
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {m.isProfit ? '+' : '-'} {formatINR(m.netProfitLoss)}
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

      {/* 4. Yearly Expense Head Analysis */}
      {report && (
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <PieChart size={18} className="text-purple-600" />
                Yearly Expense Head Analysis ({report.financialYear})
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Annual totals by expense category.
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
                  <th className="p-3.5 text-right pr-5">Annual Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {report.expenseHeadAnalysis.length === 0 ? (
                  <tr>
                    <td colSpan={2} className="p-6 text-center text-gray-400">
                      No expenses recorded for this financial year.
                    </td>
                  </tr>
                ) : (
                  report.expenseHeadAnalysis.map((head) => (
                    <tr key={head.category} className="hover:bg-gray-50/80 transition-colors">
                      <td className="p-3.5 pl-5 font-bold text-gray-900">{head.category}</td>
                      <td className="p-3.5 text-right pr-5 font-mono font-bold text-rose-700">
                        {formatINR(head.amount)}
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
