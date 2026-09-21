'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Layers,
  Calendar,
  Building2,
  RefreshCw,
  Download,
  Printer,
  FileText,
  Search,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Coins,
  ShieldCheck,
  Scale,
  Receipt,
  ArrowUpRight,
  Info,
  ChevronDown,
  ArrowRight,
  ExternalLink,
  BarChart3,
} from 'lucide-react';
import {
  getConsolidatedDailyPosition,
  ConsolidatedDailyData,
  extractDatePart,
} from '@/lib/db/consolidated';
import { listBranches } from '@/lib/db/branches';
import { getCurrentProfile } from '@/lib/auth';
import type { Branch, Profile } from '@/types/database';

export default function ConsolidatedPage() {
  // Current logged in profile and roles
  const [profile, setProfile] = useState<Profile | null>(null);
  const [branches, setBranches] = useState<Array<Branch & { manager?: string }>>([]);

  // Filters: Date and Branch
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');

  // Data state
  const [data, setData] = useState<ConsolidatedDailyData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Active Drill-down Tab
  const [activeTab, setActiveTab] = useState<
    'pledges' | 'releases' | 'payments' | 'current' | 'repledge'
  >('pledges');
  const [tabSearch, setTabSearch] = useState<string>('');

  // Is user Admin / Owner
  const isAdminOrOwner = useMemo(() => {
    return profile?.role === 'Admin' || profile?.role === 'Owner';
  }, [profile]);

  // Initial load: Profile & Branches
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
        console.error('Error initializing consolidated profile:', err);
      }
    }
    init();
  }, []);

  // Fetch Consolidated Data whenever Date or Branch changes
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getConsolidatedDailyPosition({
        date: selectedDate,
        branchId: selectedBranchId,
      });
      setData(result);
    } catch (err: any) {
      console.error('Error loading consolidated daily position:', err);
      setError('Unable to load consolidated position. Please click refresh.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedDate, selectedBranchId]);

  // Date Navigation Helpers
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

  // Format date to Indian display: DD-MM-YYYY
  const formatDisplayDate = (dStr: string) => {
    if (!dStr) return '';
    const parts = dStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dStr;
  };

  // Number Formatters
  const formatINR = (val: number) => {
    return '₹ ' + (val || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatGrams = (val: number) => {
    return (val || 0).toFixed(2) + ' g';
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (!data) return;

    let csvContent = 'data:text/csv;charset=utf-8,';

    // Header & Summary
    csvContent += `PAVITHRA GOLD FINANCE - CONSOLIDATED DAILY POSITION\r\n`;
    csvContent += `Date,${formatDisplayDate(data.date)}\r\n`;
    csvContent += `Branch,${data.branchName}\r\n`;
    csvContent += `Generated At,${data.generatedAt}\r\n\r\n`;

    // Main Table
    csvContent += `DAILY CONSOLIDATED MOVEMENT\r\n`;
    csvContent += `Category,Count / Pockets,Amount (INR),Net Weight (g)\r\n`;
    csvContent += `Today's Pledge,${data.todayPledge.count},${data.todayPledge.totalAmount},${data.todayPledge.totalNetWeight}\r\n`;
    csvContent += `Today's Release,${data.todayRelease.count},${data.todayRelease.totalSettlementAmount},${data.todayRelease.totalNetWeight}\r\n`;
    csvContent += `Today's Part Payment / Principal Collection,${data.todayPartPayment.uniqueLoansCount},${data.todayPartPayment.totalPrincipalCollected},-\r\n`;
    csvContent += `Current Position (Active Loans),${data.currentPosition.activePocketsCount},${data.currentPosition.totalOutstanding},${data.currentPosition.totalGoldWeight}\r\n`;
    csvContent += `Re-Pledge Position (Bank Custody),${data.repledgePosition.repledgePocketsCount},${data.repledgePosition.repledgeAmount},${data.repledgePosition.repledgeWeight}\r\n\r\n`;

    // Detailed Today Pledges
    csvContent += `TODAY'S PLEDGES\r\n`;
    csvContent += `S.No,Loan Number,Customer Name,Origination Date,Principal Amount,Net Weight (g),APR %,Status\r\n`;
    data.todayPledge.items.forEach((item, idx) => {
      csvContent += `${idx + 1},${item.loanNumber},"${item.customerName}",${item.originationDate},${item.principalAmount},${item.netWeight},${item.interestRateApr}%,${item.status}\r\n`;
    });
    csvContent += `\r\n`;

    // Detailed Today Releases
    csvContent += `TODAY'S RELEASES\r\n`;
    csvContent += `S.No,Loan Number,Customer Name,Release Date,Settlement Amount,Principal Closed,Interest Collected,Net Weight (g),Release Voucher\r\n`;
    data.todayRelease.items.forEach((item, idx) => {
      csvContent += `${idx + 1},${item.loanNumber},"${item.customerName}",${item.releaseDate},${item.settlementAmount},${item.principalClosed},${item.interestCollected},${item.netWeight},${item.releaseNumber || '-'}\r\n`;
    });
    csvContent += `\r\n`;

    // Detailed Today Principal Payments
    csvContent += `TODAY'S PRINCIPAL PAYMENTS\r\n`;
    csvContent += `S.No,Receipt Number,Loan Number,Customer Name,Date,Total Paid,Principal Portion,Interest Portion,Mode,Staff\r\n`;
    data.todayPartPayment.items.forEach((item, idx) => {
      csvContent += `${idx + 1},${item.receiptNumber},${item.loanNumber},"${item.customerName}",${item.paymentDate},${item.totalAmount},${item.principalPortion},${item.interestPortion},${item.mode},"${item.collectedBy || '-'}"\r\n`;
    });
    csvContent += `\r\n`;

    // Detailed Re-Pledges
    csvContent += `ACTIVE BANK RE-PLEDGES\r\n`;
    csvContent += `S.No,Re-Pledge Number,Customer Name,Customer Loan #,Bank,Branch,Pledge Date,Bank Pledge Amount,Bank Rate %,Weight (g),Custody\r\n`;
    data.repledgePosition.items.forEach((item, idx) => {
      csvContent += `${idx + 1},${item.repledgeNumber},"${item.customerName}",${item.customerLoanNumber},"${item.bankName}","${item.bankBranch}",${item.pledgeDate},${item.bankPledgeAmount},${item.bankInterestRate}%,${item.totalNetWeight},"${item.custodyLocation}"\r\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `PGF_Consolidated_Daily_Position_${data.date}_${data.branchId || 'All'}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print Handler
  const handlePrint = () => {
    window.print();
  };

  // Filtered Drill-Down Items based on tab search query
  const filteredTabItems = useMemo(() => {
    if (!data) return [];
    const q = tabSearch.trim().toLowerCase();

    if (activeTab === 'pledges') {
      return data.todayPledge.items.filter(
        (i) =>
          !q ||
          i.loanNumber.toLowerCase().includes(q) ||
          i.customerName.toLowerCase().includes(q)
      );
    }
    if (activeTab === 'releases') {
      return data.todayRelease.items.filter(
        (i) =>
          !q ||
          i.loanNumber.toLowerCase().includes(q) ||
          i.customerName.toLowerCase().includes(q) ||
          (i.releaseNumber && i.releaseNumber.toLowerCase().includes(q))
      );
    }
    if (activeTab === 'payments') {
      return data.todayPartPayment.items.filter(
        (i) =>
          !q ||
          i.receiptNumber.toLowerCase().includes(q) ||
          i.loanNumber.toLowerCase().includes(q) ||
          i.customerName.toLowerCase().includes(q)
      );
    }
    if (activeTab === 'current') {
      return data.currentPosition.items.filter(
        (i) =>
          !q ||
          i.loanNumber.toLowerCase().includes(q) ||
          i.customerName.toLowerCase().includes(q)
      );
    }
    if (activeTab === 'repledge') {
      return data.repledgePosition.items.filter(
        (i) =>
          !q ||
          i.repledgeNumber.toLowerCase().includes(q) ||
          i.customerLoanNumber.toLowerCase().includes(q) ||
          i.customerName.toLowerCase().includes(q) ||
          i.bankName.toLowerCase().includes(q)
      );
    }
    return [];
  }, [data, activeTab, tabSearch]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 print:p-0 print:m-0 print:max-w-none">
      {/* 1. Header & Filters Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs print:border-none print:shadow-none print:p-0">
        <div>
          <div className="flex items-center gap-2 text-amber-800 text-xs font-bold uppercase tracking-wider">
            <Layers size={16} />
            <span>Operational Management Report</span>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight mt-1 flex items-center gap-2.5">
            Consolidated Daily Position
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 print:hidden">
              Live Position
            </span>
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Daily snapshot of branch gold loan movement, active portfolio, and bank re-pledge position.
          </p>
        </div>

        {/* Date & Branch Controls */}
        <div className="flex flex-wrap items-center gap-2.5 print:hidden">
          {/* Date Picker Group */}
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
              {isAdminOrOwner && <option value="all">All Branches (Consolidated)</option>}
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </div>

          {/* Action Buttons */}
          <button
            onClick={fetchData}
            disabled={loading}
            title="Refresh Data"
            className="p-2.5 rounded-xl bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-gray-900 shadow-2xs transition-colors disabled:opacity-50"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin text-blue-600' : ''} />
          </button>

          <button
            onClick={handleExportCSV}
            title="Export CSV / Excel"
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
          Consolidated Daily Position Report • {data?.branchName || 'All Branches'}
        </p>
        <p className="text-[11px] text-gray-500 mt-1">
          Date: <span className="font-bold text-gray-900">{formatDisplayDate(selectedDate)}</span> | Generated At:{' '}
          {data?.generatedAt ? new Date(data.generatedAt).toLocaleString('en-IN') : 'N/A'}
        </p>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-rose-800 text-xs">
          <div className="flex items-center gap-2.5">
            <AlertTriangle size={16} />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchData}
            className="font-bold underline hover:text-rose-900"
          >
            Retry
          </button>
        </div>
      )}

      {/* 2. Management Summary Sentence Card */}
      {data && (
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-white/10 text-amber-300 shrink-0 mt-0.5">
              <TrendingUp size={20} />
            </div>
            <div>
              <span className="text-[11px] font-extrabold uppercase tracking-widest text-amber-300/90 block mb-1">
                Executive Position Summary • {formatDisplayDate(data.date)}
              </span>
              <p className="text-sm sm:text-base font-medium leading-relaxed text-blue-50">
                As of <span className="font-bold text-white underline decoration-amber-400/60">{formatDisplayDate(data.date)}</span>, the branch has{' '}
                <span className="font-bold text-amber-300 font-mono">{data.currentPosition.activePocketsCount.toLocaleString('en-IN')}</span> active pockets with{' '}
                <span className="font-bold text-emerald-300 font-mono">{formatINR(data.currentPosition.totalOutstanding)}</span> outstanding against{' '}
                <span className="font-bold text-amber-200 font-mono">{formatGrams(data.currentPosition.totalGoldWeight)}</span> of gold. Today&apos;s movement:{' '}
                <span className="font-bold text-white font-mono">{data.todayPledge.count}</span> pledges ({formatINR(data.todayPledge.totalAmount)}),{' '}
                <span className="font-bold text-white font-mono">{data.todayRelease.count}</span> releases ({formatINR(data.todayRelease.totalSettlementAmount)}) and{' '}
                <span className="font-bold text-emerald-300 font-mono">{formatINR(data.todayPartPayment.totalPrincipalCollected)}</span> principal collection.{' '}
                <span className="font-bold text-amber-300 font-mono">{data.repledgePosition.repledgePocketsCount}</span> pockets are currently re-pledged with banks for{' '}
                <span className="font-bold text-white font-mono">{formatINR(data.repledgePosition.repledgeAmount)}</span>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 2.5 Financial Position (Income, Expense, Profit/Loss) */}
      {data?.financialPosition && (
        <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4 pb-3 border-b border-gray-100">
            <div>
              <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold uppercase tracking-wider">
                <BarChart3 size={16} />
                <span>Financial Position</span>
              </div>
              <h2 className="text-base font-bold text-gray-900 mt-0.5">
                Today&apos;s Revenue, Expenses &amp; Profit / Loss
              </h2>
            </div>
            <Link
              href="/admin/pnl/daily"
              className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1 self-start sm:self-auto print:hidden"
            >
              <span>Full Daily P&amp;L</span>
              <ArrowRight size={13} />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 block mb-1">
                Today&apos;s Income
              </span>
              <span className="font-mono font-extrabold text-xl text-emerald-700 block">
                {formatINR(data.financialPosition.todayIncome)}
              </span>
              <span className="text-[10px] text-emerald-600 mt-0.5 block">
                Interest collected &amp; recognized fees (Principal excluded)
              </span>
            </div>

            <div className="p-4 rounded-xl bg-rose-50/60 border border-rose-200">
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-800 block mb-1">
                Today&apos;s Expenses
              </span>
              <span className="font-mono font-extrabold text-xl text-rose-700 block">
                {formatINR(data.financialPosition.todayExpenses)}
              </span>
              <span className="text-[10px] text-rose-600 mt-0.5 block">
                Approved operating &amp; office expenses
              </span>
            </div>

            <div
              className={`p-4 rounded-xl border ${
                data.financialPosition.isProfit
                  ? 'bg-blue-50/60 border-blue-200'
                  : 'bg-amber-50/60 border-amber-200'
              }`}
            >
              <span
                className={`text-[11px] font-bold uppercase tracking-wider block mb-1 ${
                  data.financialPosition.isProfit ? 'text-blue-800' : 'text-amber-800'
                }`}
              >
                {data.financialPosition.isProfit ? "Today's Net Profit" : "Today's Net Loss"}
              </span>
              <span
                className={`font-mono font-extrabold text-xl block ${
                  data.financialPosition.isProfit ? 'text-blue-700' : 'text-amber-700'
                }`}
              >
                {formatINR(data.financialPosition.todayProfitLoss)}
              </span>
              <span className="text-[10px] text-gray-500 mt-0.5 block">
                Recognized Income − Operating Expenses
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 3. Main Consolidated Table (Desktop & Mobile Responsive) */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Scale size={18} className="text-blue-600" />
              Daily Consolidated Position Table
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Select any row to drill down into transaction item details below.
            </p>
          </div>
          <span className="text-xs text-gray-400 font-mono hidden sm:inline-block">
            Position Date: {formatDisplayDate(selectedDate)}
          </span>
        </div>

        {loading && !data ? (
          <div className="p-12 text-center text-xs text-gray-500 space-y-3">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <div>Loading consolidated daily position...</div>
          </div>
        ) : !data ? (
          <div className="p-12 text-center text-xs text-gray-500">
            No data available for the selected date.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider text-[11px]">
                  <th className="p-3.5 pl-5">Category / Position</th>
                  <th className="p-3.5 text-center">Number / Pockets</th>
                  <th className="p-3.5 text-right">Amount (₹)</th>
                  <th className="p-3.5 text-right pr-5">Gold Weight (Net)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-900">
                {/* 1. Today's Pledge */}
                <tr
                  onClick={() => setActiveTab('pledges')}
                  className={`cursor-pointer transition-colors ${
                    activeTab === 'pledges' ? 'bg-amber-50/60 font-semibold' : 'hover:bg-slate-50/70'
                  }`}
                >
                  <td className="p-3.5 pl-5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
                      <div>
                        <span className="font-bold text-gray-900 block text-xs sm:text-sm">Today&apos;s Pledge</span>
                        <span className="text-[11px] text-gray-500 block">
                          New loans originated on {formatDisplayDate(selectedDate)}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="p-3.5 text-center font-mono font-bold text-sm">
                    <span className="px-2.5 py-1 rounded-lg bg-amber-100/80 text-amber-900">
                      {data.todayPledge.count}
                    </span>
                  </td>
                  <td className="p-3.5 text-right font-mono font-bold text-sm text-blue-700">
                    {formatINR(data.todayPledge.totalAmount)}
                  </td>
                  <td className="p-3.5 text-right pr-5 font-mono font-bold text-sm text-amber-900">
                    {formatGrams(data.todayPledge.totalNetWeight)}
                  </td>
                </tr>

                {/* 2. Today's Release */}
                <tr
                  onClick={() => setActiveTab('releases')}
                  className={`cursor-pointer transition-colors ${
                    activeTab === 'releases' ? 'bg-emerald-50/60 font-semibold' : 'hover:bg-slate-50/70'
                  }`}
                >
                  <td className="p-3.5 pl-5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                      <div>
                        <span className="font-bold text-gray-900 block text-xs sm:text-sm">Today&apos;s Release</span>
                        <span className="text-[11px] text-gray-500 block">
                          Loans fully settled &amp; gold discharged today
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="p-3.5 text-center font-mono font-bold text-sm">
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-100/80 text-emerald-900">
                      {data.todayRelease.count}
                    </span>
                  </td>
                  <td className="p-3.5 text-right font-mono font-bold text-sm text-emerald-700">
                    {formatINR(data.todayRelease.totalSettlementAmount)}
                    <span className="text-[10px] text-gray-400 block font-normal">
                      Principal Closed: {formatINR(data.todayRelease.totalPrincipalClosed)}
                    </span>
                  </td>
                  <td className="p-3.5 text-right pr-5 font-mono font-bold text-sm text-gray-800">
                    {formatGrams(data.todayRelease.totalNetWeight)}
                  </td>
                </tr>

                {/* 3. Today's Part Payment / Principal Payment */}
                <tr
                  onClick={() => setActiveTab('payments')}
                  className={`cursor-pointer transition-colors ${
                    activeTab === 'payments' ? 'bg-indigo-50/60 font-semibold' : 'hover:bg-slate-50/70'
                  }`}
                >
                  <td className="p-3.5 pl-5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-indigo-500"></div>
                      <div>
                        <span className="font-bold text-gray-900 block text-xs sm:text-sm">
                          Today&apos;s Part Payment / Principal Collection
                        </span>
                        <span className="text-[11px] text-gray-500 block">
                          Principal reduction repayments collected today
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="p-3.5 text-center font-mono font-bold text-sm">
                    <span className="px-2.5 py-1 rounded-lg bg-indigo-100/80 text-indigo-900">
                      {data.todayPartPayment.uniqueLoansCount} Loans
                    </span>
                  </td>
                  <td className="p-3.5 text-right font-mono font-bold text-sm text-indigo-700">
                    {formatINR(data.todayPartPayment.totalPrincipalCollected)}
                    <span className="text-[10px] text-gray-400 block font-normal">
                      Total Paid: {formatINR(data.todayPartPayment.totalAmountCollected)}
                    </span>
                  </td>
                  <td className="p-3.5 text-right pr-5 font-mono text-gray-400">
                    —
                  </td>
                </tr>

                {/* 4. Current Position (Separator / Highlight) */}
                <tr
                  onClick={() => setActiveTab('current')}
                  className={`cursor-pointer transition-colors border-t-2 border-gray-300 ${
                    activeTab === 'current' ? 'bg-blue-50/80 font-semibold' : 'bg-slate-50/50 hover:bg-blue-50/40'
                  }`}
                >
                  <td className="p-4 pl-5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-3 h-3 rounded-full bg-blue-600 shadow-xs"></div>
                      <div>
                        <span className="font-extrabold text-blue-900 block text-sm sm:text-base">
                          Current Position (Active Portfolio)
                        </span>
                        <span className="text-[11px] text-gray-600 block">
                          Authoritative live active loans &amp; collateral held in custody
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-center font-mono font-extrabold text-base text-blue-950">
                    <span className="px-3 py-1 rounded-xl bg-blue-100 text-blue-900 border border-blue-200">
                      {data.currentPosition.activePocketsCount.toLocaleString('en-IN')} Pockets
                    </span>
                  </td>
                  <td className="p-4 text-right font-mono font-extrabold text-base text-blue-800">
                    {formatINR(data.currentPosition.totalOutstanding)}
                    <div className="text-[10px] text-gray-500 font-normal space-y-0.5 mt-0.5">
                      <span>Principal: {formatINR(data.currentPosition.principalOutstanding)}</span>
                      <span className="mx-1">•</span>
                      <span>Interest: {formatINR(data.currentPosition.accruedInterest)}</span>
                    </div>
                  </td>
                  <td className="p-4 text-right pr-5 font-mono font-extrabold text-base text-amber-900">
                    {formatGrams(data.currentPosition.totalGoldWeight)}
                  </td>
                </tr>

                {/* 5. Re-Pledge Position */}
                <tr
                  onClick={() => setActiveTab('repledge')}
                  className={`cursor-pointer transition-colors ${
                    activeTab === 'repledge' ? 'bg-purple-50/60 font-semibold' : 'hover:bg-slate-50/70'
                  }`}
                >
                  <td className="p-3.5 pl-5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-purple-600"></div>
                      <div>
                        <span className="font-bold text-purple-900 block text-xs sm:text-sm">
                          Re-Pledge Position (Institutional Borrowing)
                        </span>
                        <span className="text-[11px] text-gray-500 block">
                          Customer gold pledged with commercial banks for working capital
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="p-3.5 text-center font-mono font-bold text-sm">
                    <span className="px-2.5 py-1 rounded-lg bg-purple-100/80 text-purple-900">
                      {data.repledgePosition.repledgePocketsCount} Pockets
                    </span>
                  </td>
                  <td className="p-3.5 text-right font-mono font-bold text-sm text-purple-800">
                    {formatINR(data.repledgePosition.repledgeAmount)}
                  </td>
                  <td className="p-3.5 text-right pr-5 font-mono font-bold text-sm text-purple-900">
                    {formatGrams(data.repledgePosition.repledgeWeight)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. Interactive Drill-Down Section with Tabs */}
      {data && (
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden print:border-none print:shadow-none">
          {/* Tab Navigation & Search */}
          <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-gray-50/50 print:hidden">
            {/* Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
              <button
                onClick={() => {
                  setActiveTab('pledges');
                  setTabSearch('');
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 ${
                  activeTab === 'pledges'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                <span>Today&apos;s Pledges</span>
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-black/10 text-white">
                  {data.todayPledge.count}
                </span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('releases');
                  setTabSearch('');
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 ${
                  activeTab === 'releases'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                <span>Today&apos;s Releases</span>
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-black/10 text-white">
                  {data.todayRelease.count}
                </span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('payments');
                  setTabSearch('');
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 ${
                  activeTab === 'payments'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                <span>Part Payments</span>
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-black/10 text-white">
                  {data.todayPartPayment.uniqueLoansCount}
                </span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('current');
                  setTabSearch('');
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 ${
                  activeTab === 'current'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                <span>Active Pockets</span>
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-black/10 text-white">
                  {data.currentPosition.activePocketsCount}
                </span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('repledge');
                  setTabSearch('');
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 ${
                  activeTab === 'repledge'
                    ? 'bg-purple-600 text-white shadow-2xs'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                <span>Re-Pledge Portfolio</span>
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-black/10 text-white">
                  {data.repledgePosition.repledgePocketsCount}
                </span>
              </button>
            </div>

            {/* In-tab Search Bar */}
            <div className="relative min-w-[240px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={tabSearch}
                onChange={(e) => setTabSearch(e.target.value)}
                placeholder="Search by Loan #, Customer, Receipt..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-gray-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Drill-down Table View */}
          <div className="overflow-x-auto">
            {activeTab === 'pledges' && (
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase">
                  <tr>
                    <th className="p-3 pl-4 w-12">#</th>
                    <th className="p-3">Loan Number</th>
                    <th className="p-3">Customer Name</th>
                    <th className="p-3">Pledge Date</th>
                    <th className="p-3 text-right">Principal Amount</th>
                    <th className="p-3 text-right">Net Weight</th>
                    <th className="p-3 text-center">APR Rate</th>
                    <th className="p-3">Branch</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredTabItems.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-6 text-center text-gray-400">
                        No pledges recorded for this date.
                      </td>
                    </tr>
                  ) : (
                    (filteredTabItems as any[]).map((item, idx) => (
                      <tr key={item.loanId} className="hover:bg-amber-50/30 transition-colors">
                        <td className="p-3 pl-4 text-gray-400 font-mono">{idx + 1}</td>
                        <td className="p-3 font-mono font-bold text-blue-700">
                          <Link
                            href={`/admin/loans/${item.loanId}`}
                            className="hover:underline flex items-center gap-1"
                          >
                            {item.loanNumber}
                            <ExternalLink size={11} className="text-gray-400 print:hidden" />
                          </Link>
                        </td>
                        <td className="p-3 font-bold text-gray-900">{item.customerName}</td>
                        <td className="p-3 text-gray-600 font-mono">
                          {formatDisplayDate(extractDatePart(item.originationDate))}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-blue-700">
                          {formatINR(item.principalAmount)}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-amber-900">
                          {formatGrams(item.netWeight)}
                        </td>
                        <td className="p-3 text-center font-mono font-semibold text-gray-700">
                          {item.interestRateApr}%
                        </td>
                        <td className="p-3 text-gray-600">{item.branchName || 'Main Hub'}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 uppercase">
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {activeTab === 'releases' && (
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase">
                  <tr>
                    <th className="p-3 pl-4 w-12">#</th>
                    <th className="p-3">Loan Number</th>
                    <th className="p-3">Customer Name</th>
                    <th className="p-3">Release Date</th>
                    <th className="p-3 text-right">Settlement Amount</th>
                    <th className="p-3 text-right">Principal Closed</th>
                    <th className="p-3 text-right">Interest Collected</th>
                    <th className="p-3 text-right">Gold Weight</th>
                    <th className="p-3">Release Voucher</th>
                    <th className="p-3">Staff</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredTabItems.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-6 text-center text-gray-400">
                        No releases recorded for this date.
                      </td>
                    </tr>
                  ) : (
                    (filteredTabItems as any[]).map((item, idx) => (
                      <tr key={item.loanId} className="hover:bg-emerald-50/30 transition-colors">
                        <td className="p-3 pl-4 text-gray-400 font-mono">{idx + 1}</td>
                        <td className="p-3 font-mono font-bold text-blue-700">
                          <Link
                            href={`/admin/loans/${item.loanId}`}
                            className="hover:underline flex items-center gap-1"
                          >
                            {item.loanNumber}
                            <ExternalLink size={11} className="text-gray-400 print:hidden" />
                          </Link>
                        </td>
                        <td className="p-3 font-bold text-gray-900">{item.customerName}</td>
                        <td className="p-3 text-gray-600 font-mono">
                          {formatDisplayDate(extractDatePart(item.releaseDate))}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-emerald-700">
                          {formatINR(item.settlementAmount)}
                        </td>
                        <td className="p-3 text-right font-mono text-gray-700">
                          {formatINR(item.principalClosed)}
                        </td>
                        <td className="p-3 text-right font-mono text-gray-700">
                          {formatINR(item.interestCollected)}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-amber-900">
                          {formatGrams(item.netWeight)}
                        </td>
                        <td className="p-3 font-mono text-gray-800 font-semibold">
                          {item.releaseNumber || 'VOUCHER-RELEASE'}
                        </td>
                        <td className="p-3 text-gray-600">{item.staffName || 'Staff'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {activeTab === 'payments' && (
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase">
                  <tr>
                    <th className="p-3 pl-4 w-12">#</th>
                    <th className="p-3">Receipt Number</th>
                    <th className="p-3">Loan Number</th>
                    <th className="p-3">Customer Name</th>
                    <th className="p-3">Date</th>
                    <th className="p-3 text-right">Total Payment</th>
                    <th className="p-3 text-right">Principal Portion</th>
                    <th className="p-3 text-right">Interest Portion</th>
                    <th className="p-3">Mode</th>
                    <th className="p-3">Staff</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredTabItems.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-6 text-center text-gray-400">
                        No principal reduction payments recorded for this date.
                      </td>
                    </tr>
                  ) : (
                    (filteredTabItems as any[]).map((item, idx) => (
                      <tr key={item.paymentId} className="hover:bg-indigo-50/30 transition-colors">
                        <td className="p-3 pl-4 text-gray-400 font-mono">{idx + 1}</td>
                        <td className="p-3 font-mono font-bold text-gray-900">{item.receiptNumber}</td>
                        <td className="p-3 font-mono font-bold text-blue-700">
                          <Link
                            href={`/admin/loans/${item.loanId}`}
                            className="hover:underline flex items-center gap-1"
                          >
                            {item.loanNumber}
                            <ExternalLink size={11} className="text-gray-400 print:hidden" />
                          </Link>
                        </td>
                        <td className="p-3 font-bold text-gray-900">{item.customerName}</td>
                        <td className="p-3 text-gray-600 font-mono">
                          {formatDisplayDate(extractDatePart(item.paymentDate))}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-gray-900">
                          {formatINR(item.totalAmount)}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-indigo-700">
                          {formatINR(item.principalPortion)}
                        </td>
                        <td className="p-3 text-right font-mono text-gray-600">
                          {formatINR(item.interestPortion)}
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-gray-100 text-gray-800">
                            {item.mode}
                          </span>
                        </td>
                        <td className="p-3 text-gray-600">{item.collectedBy || 'Staff'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {activeTab === 'current' && (
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase">
                  <tr>
                    <th className="p-3 pl-4 w-12">#</th>
                    <th className="p-3">Loan Number</th>
                    <th className="p-3">Customer Name</th>
                    <th className="p-3">Originated</th>
                    <th className="p-3 text-right">Disbursed (₹)</th>
                    <th className="p-3 text-right">Current Principal</th>
                    <th className="p-3 text-right">Accrued Interest</th>
                    <th className="p-3 text-right">Total Outstanding</th>
                    <th className="p-3 text-right">Gold Weight</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredTabItems.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-6 text-center text-gray-400">
                        No active loans found.
                      </td>
                    </tr>
                  ) : (
                    (filteredTabItems as any[]).map((item, idx) => (
                      <tr key={item.loanId} className="hover:bg-blue-50/30 transition-colors">
                        <td className="p-3 pl-4 text-gray-400 font-mono">{idx + 1}</td>
                        <td className="p-3 font-mono font-bold text-blue-700">
                          <Link
                            href={`/admin/loans/${item.loanId}`}
                            className="hover:underline flex items-center gap-1"
                          >
                            {item.loanNumber}
                            <ExternalLink size={11} className="text-gray-400 print:hidden" />
                          </Link>
                        </td>
                        <td className="p-3 font-bold text-gray-900">{item.customerName}</td>
                        <td className="p-3 text-gray-600 font-mono">
                          {formatDisplayDate(extractDatePart(item.originationDate))}
                        </td>
                        <td className="p-3 text-right font-mono text-gray-600">
                          {formatINR(item.principalAmount)}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-gray-900">
                          {formatINR(item.currentPrincipal)}
                        </td>
                        <td className="p-3 text-right font-mono text-gray-600">
                          {formatINR(item.accruedInterest)}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-blue-700">
                          {formatINR(item.totalOutstanding)}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-amber-900">
                          {formatGrams(item.netWeight)}
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase">
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {activeTab === 'repledge' && (
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase">
                  <tr>
                    <th className="p-3 pl-4 w-12">#</th>
                    <th className="p-3">Re-Pledge #</th>
                    <th className="p-3">Customer Name</th>
                    <th className="p-3">Customer Loan #</th>
                    <th className="p-3">Bank &amp; Branch</th>
                    <th className="p-3">Pledge Date</th>
                    <th className="p-3 text-right">Bank Pledge Amount</th>
                    <th className="p-3 text-center">Bank Rate</th>
                    <th className="p-3 text-right">Net Weight</th>
                    <th className="p-3">Custody Location</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredTabItems.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="p-6 text-center text-gray-400">
                        No active bank re-pledges found.
                      </td>
                    </tr>
                  ) : (
                    (filteredTabItems as any[]).map((item, idx) => (
                      <tr key={item.repledgeId} className="hover:bg-purple-50/30 transition-colors">
                        <td className="p-3 pl-4 text-gray-400 font-mono">{idx + 1}</td>
                        <td className="p-3 font-mono font-bold text-purple-700">
                          <Link
                            href={`/admin/re-pledge/${item.repledgeId}`}
                            className="hover:underline flex items-center gap-1"
                          >
                            {item.repledgeNumber}
                            <ExternalLink size={11} className="text-gray-400 print:hidden" />
                          </Link>
                        </td>
                        <td className="p-3 font-bold text-gray-900">{item.customerName}</td>
                        <td className="p-3 font-mono text-gray-700">{item.customerLoanNumber}</td>
                        <td className="p-3 font-medium text-gray-900">
                          {item.bankName} ({item.bankBranch})
                        </td>
                        <td className="p-3 text-gray-600 font-mono">
                          {formatDisplayDate(extractDatePart(item.pledgeDate))}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-purple-800">
                          {formatINR(item.bankPledgeAmount)}
                        </td>
                        <td className="p-3 text-center font-mono font-semibold text-gray-700">
                          {item.bankInterestRate}%
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-amber-900">
                          {formatGrams(item.totalNetWeight)}
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-purple-50 text-purple-800 border border-purple-200">
                            {item.custodyLocation}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 uppercase">
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* 5. Data Reconciliation & Integrity Alert Banner */}
      {data && (
        <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs print:hidden">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {data.reconciliation.isReconciled ? (
                <CheckCircle2 size={18} className="text-emerald-600" />
              ) : (
                <AlertTriangle size={18} className="text-amber-600" />
              )}
              <h3 className="text-sm font-bold text-gray-900">
                Data Reconciliation &amp; Integrity Status
              </h3>
            </div>
            <span
              className={`text-[11px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                data.reconciliation.isReconciled
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}
            >
              {data.reconciliation.isReconciled ? '✓ All Records Reconciled' : '⚠ Attention Required'}
            </span>
          </div>

          {data.reconciliation.isReconciled ? (
            <p className="text-xs text-gray-500">
              All loan records, collateral links, custody locations, and payment principal reductions
              are fully reconciled with zero discrepancies detected.
            </p>
          ) : (
            <div className="space-y-2 pt-1">
              {data.reconciliation.warnings.map((w, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-xs text-amber-900"
                >
                  <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block">{w.message}</span>
                    {w.entityId && (
                      <span className="text-[10px] text-amber-700 font-mono">
                        Reference: {w.entityType} / {w.entityId}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
