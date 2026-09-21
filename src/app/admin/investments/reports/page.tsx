// src/app/admin/investments/reports/page.tsx
// Investment Reports Center — Daily, Monthly, Yearly, Consolidated capital reports with CSV export.

'use client';

import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Download,
  Calendar,
  Printer,
  RefreshCw,
  AlertCircle,
  TrendingUp,
  DollarSign,
  Users,
  Clock,
} from 'lucide-react';
import { getInvestmentConsolidatedReport } from '@/lib/db/investments';
import type { InvestmentConsolidatedItem } from '@/types/database';

export default function InvestmentReportsPage() {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [reportData, setReportData] = useState<InvestmentConsolidatedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getInvestmentConsolidatedReport(startDate, endDate);
      setReportData(data);
    } catch (err: any) {
      console.error('Error loading investment report:', err);
      setError(err.message || 'Failed to load report data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, [startDate, endDate]);

  const formatINR = (val?: number) => {
    return '₹' + (val || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  };

  const handleExportCSV = () => {
    if (reportData.length === 0) return;
    let csv = `Date,New Investors,Investments,Additional Funds,Withdrawals,Accrued Returns,Net Position\r\n`;
    reportData.forEach((r) => {
      csv += `${r.date},${r.newInvestorsCount},${r.investmentsAmount},${r.additionalFundsAmount},${r.withdrawalsAmount},${r.returnsAmount},${r.netPosition}\r\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `PGF_Investment_Report_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalNewInvestors = reportData.reduce((s, r) => s + r.newInvestorsCount, 0);
  const totalInvestments = reportData.reduce((s, r) => s + r.investmentsAmount, 0);
  const totalAdditional = reportData.reduce((s, r) => s + r.additionalFundsAmount, 0);
  const totalWithdrawals = reportData.reduce((s, r) => s + r.withdrawalsAmount, 0);
  const totalNet = reportData.reduce((s, r) => s + r.netPosition, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm print:hidden">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-100 text-blue-800">
              Reports & MIS
            </span>
            <span className="text-xs text-gray-500 font-semibold">{reportData.length} Day(s) Analyzed</span>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 font-outfit">Investment Reports Center</h1>
          <p className="text-xs text-gray-500">
            Consolidated daily, monthly, and custom date range capital movement and net liquidity positions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-all cursor-pointer"
          >
            <Printer size={15} />
            Print Report
          </button>
          <button
            onClick={handleExportCSV}
            disabled={reportData.length === 0}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/20 transition-all cursor-pointer disabled:opacity-50"
          >
            <Download size={15} />
            Export Excel / CSV
          </button>
        </div>
      </div>

      {/* Date Filter Bar */}
      <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm print:hidden">
        <div className="flex items-center gap-2">
          <Calendar size={15} className="text-gray-400" />
          <span className="text-xs font-bold text-gray-700">Date Range:</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-mono"
          />
          <span className="text-xs text-gray-400 font-semibold">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-mono"
          />
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={() => {
              const d = new Date();
              d.setDate(d.getDate() - 7);
              setStartDate(d.toISOString().split('T')[0]);
              setEndDate(new Date().toISOString().split('T')[0]);
            }}
            className="px-2.5 py-1 text-xs rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold"
          >
            Last 7 Days
          </button>
          <button
            onClick={() => {
              const d = new Date();
              d.setDate(d.getDate() - 30);
              setStartDate(d.toISOString().split('T')[0]);
              setEndDate(new Date().toISOString().split('T')[0]);
            }}
            className="px-2.5 py-1 text-xs rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold"
          >
            Last 30 Days
          </button>
          <button
            onClick={() => {
              const d = new Date();
              d.setMonth(d.getMonth() - 12);
              setStartDate(d.toISOString().split('T')[0]);
              setEndDate(new Date().toISOString().split('T')[0]);
            }}
            className="px-2.5 py-1 text-xs rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold"
          >
            Last 1 Year
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-3">
          <AlertCircle size={18} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Aggregate KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
          <span className="text-[10px] text-gray-500 font-bold uppercase block">New Investors</span>
          <span className="text-xl font-extrabold text-blue-700 font-mono mt-1 block">+{totalNewInvestors}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
          <span className="text-[10px] text-gray-500 font-bold uppercase block">Initial Capital Inflow</span>
          <span className="text-xl font-extrabold text-emerald-700 font-mono mt-1 block">{formatINR(totalInvestments)}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
          <span className="text-[10px] text-gray-500 font-bold uppercase block">Additional Funds</span>
          <span className="text-xl font-extrabold text-cyan-700 font-mono mt-1 block">{formatINR(totalAdditional)}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
          <span className="text-[10px] text-gray-500 font-bold uppercase block">Withdrawals Settled</span>
          <span className="text-xl font-extrabold text-purple-700 font-mono mt-1 block">{formatINR(totalWithdrawals)}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
          <span className="text-[10px] text-gray-500 font-bold uppercase block">Net Capital Position</span>
          <span className={`text-xl font-extrabold font-mono mt-1 block ${totalNet >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
            {formatINR(totalNet)}
          </span>
        </div>
      </div>

      {/* Report Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-gray-50/80 text-gray-500 font-bold border-b border-gray-100 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Date</th>
                <th className="px-5 py-3.5">New Investors</th>
                <th className="px-5 py-3.5">Initial Investments</th>
                <th className="px-5 py-3.5">Additional Funds</th>
                <th className="px-5 py-3.5">Withdrawals</th>
                <th className="px-5 py-3.5 text-right">Net Liquidity Position</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-gray-400">
                    <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-blue-600" />
                    Generating report data...
                  </td>
                </tr>
              ) : reportData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-gray-400">
                    No investment activity recorded for the selected date range.
                  </td>
                </tr>
              ) : (
                reportData.map((row) => (
                  <tr key={row.date} className="hover:bg-gray-50/50">
                    <td className="px-5 py-3.5 font-mono font-bold text-gray-900">{row.date}</td>
                    <td className="px-5 py-3.5 text-gray-700">
                      {row.newInvestorsCount > 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-bold text-[10px]">
                          +{row.newInvestorsCount}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-5 py-3.5 font-mono font-semibold text-emerald-600">
                      {row.investmentsAmount > 0 ? formatINR(row.investmentsAmount) : '—'}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-cyan-600">
                      {row.additionalFundsAmount > 0 ? formatINR(row.additionalFundsAmount) : '—'}
                    </td>
                    <td className="px-5 py-3.5 font-mono font-semibold text-purple-600">
                      {row.withdrawalsAmount > 0 ? formatINR(row.withdrawalsAmount) : '—'}
                    </td>
                    <td
                      className={`px-5 py-3.5 font-mono font-extrabold text-right ${
                        row.netPosition >= 0 ? 'text-emerald-700' : 'text-red-600'
                      }`}
                    >
                      {formatINR(row.netPosition)}
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
