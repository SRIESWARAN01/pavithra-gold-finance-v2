'use client';

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Users,
  Coins,
  AlertTriangle,
  TrendingUp,
  Calendar,
  Download,
  Filter,
  ChevronRight,
  FileSpreadsheet,
  Database,
  Shield,
  BookOpen,
  BarChart3,
  Gavel,
  Building2,
  UserCog,
  Receipt,
  Loader2,
  CheckCircle2,
  FileJson,
  Table
} from 'lucide-react';
import { isFirebaseConfigured, getCurrentProfile } from '@/lib/auth';
import { generateEnterpriseWorkbook, exportPageToExcel, exportToCSV, exportToJSON } from '@/lib/excel-enterprise';

export default function ReportsDashboard() {
  const [fromDate, setFromDate] = useState('2026-06-01');
  const [toDate, setToDate] = useState('2026-06-30');
  const [exportFormat, setExportFormat] = useState('PDF');
  const [branchId, setBranchId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'reports' | 'enterprise' | 'scheduled'>('reports');
  const [enterpriseExporting, setEnterpriseExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  useEffect(() => {
    async function loadAdminInfo() {
      if (isFirebaseConfigured()) {
        try {
          const profile = await getCurrentProfile();
          if (profile?.branch_id) {
            setBranchId(profile.branch_id);
          }
        } catch (err) {
          console.error('Failed to load admin profile for reports:', err);
        }
      }
    }
    loadAdminInfo();
  }, []);

  // Report categories with cards
  const financialReports = [
    { title: 'Daily Collection', description: 'Day-wise collection summary of principal and interest payments received.', icon: Calendar, type: 'daily-collection' },
    { title: 'Monthly Collection', description: 'Month-wise consolidated collection report with trend comparison.', icon: Calendar, type: 'monthly-collection' },
    { title: 'Outstanding Loans', description: 'Aggregate outstanding principal and interest across active loans.', icon: TrendingUp, type: 'outstanding' },
    { title: 'Interest Collection', description: 'Breakdown of interest revenue collected across all loans.', icon: Coins, type: 'interest-collection' },
    { title: 'Loan Register', description: 'Complete register of all loans with status, principal, and dates.', icon: BookOpen, type: 'loan-register' },
    { title: 'Auction Report', description: 'Overdue loans eligible for auction with gold valuation details.', icon: Gavel, type: 'auction-report' },
    { title: 'Customer Statement', description: 'Individual customer account statement with all transactions.', icon: FileText, type: 'customer-statement' },
    { title: 'Profit & Loss', description: 'Income and expenses summary with net profit calculation.', icon: TrendingUp, type: 'profit-loss' },
    { title: 'Balance Sheet', description: 'Assets, liabilities, and equity position statement.', icon: FileSpreadsheet, type: 'balance-sheet' },
    { title: 'Trial Balance', description: 'Debit and credit totals of all ledger accounts.', icon: Table, type: 'trial-balance' },
  ];

  const customerReports = [
    { title: 'Customer Register', description: 'Complete list of all onboarded clients with KYC and loan status.', icon: Users, type: 'customers' },
    { title: 'KYC Pending', description: 'Customers with incomplete or expired KYC documentation.', icon: Shield, type: 'kyc-pending' },
    { title: 'Gold Register', description: 'All gold collateral items with weight, purity, and valuation.', icon: Coins, type: 'gold-register' },
    { title: 'Due Report', description: 'Loans approaching maturity dates sorted by urgency.', icon: AlertTriangle, type: 'due' },
  ];

  const operationalReports = [
    { title: 'Employee Report', description: 'Employee attendance, performance, and salary details.', icon: UserCog, type: 'employee-report' },
    { title: 'Branch Report', description: 'Branch-wise performance, collection, and revenue comparison.', icon: Building2, type: 'branch-report' },
    { title: 'Audit Report', description: 'Complete audit trail of all admin actions and system changes.', icon: Shield, type: 'audit-report' },
    { title: 'GST Report', description: 'GST liability calculation with CGST/SGST breakdown.', icon: Receipt, type: 'gst-report' },
  ];

  // Enterprise download options
  const enterpriseDownloads = [
    { name: 'Complete Enterprise Excel', description: 'All 50 sheets — Dashboard, Customers, Loans, Payments, Gold, Accounting, HR, Analytics, Risk, and more.', sheets: 50, action: 'enterprise' },
    { name: 'Customer Statement', description: 'Individual customer account with loan and payment history.', sheets: 3, action: 'customer-statement' },
    { name: 'Loan Statement', description: 'Detailed loan register with interest accrual and payment split.', sheets: 4, action: 'loan-statement' },
    { name: 'Gold Register', description: 'Complete gold inventory with photos, purity, and valuation.', sheets: 2, action: 'gold-register' },
    { name: 'Interest Register', description: 'Daily interest accrual ledger for all active loans.', sheets: 1, action: 'interest-register' },
    { name: 'Payment Register', description: 'Payment transaction log with receipt numbers and split.', sheets: 1, action: 'payment-register' },
    { name: 'Cash Book', description: 'Cash-only transaction register with running balance.', sheets: 1, action: 'cash-book' },
    { name: 'General Ledger', description: 'Complete ledger with debit/credit entries for all accounts.', sheets: 1, action: 'ledger' },
    { name: 'Trial Balance', description: 'Account-wise debit and credit totals.', sheets: 1, action: 'trial-balance' },
    { name: 'Profit & Loss', description: 'Income/expenses financial statement.', sheets: 1, action: 'profit-loss' },
    { name: 'Balance Sheet', description: 'Assets, liabilities, and equity statement.', sheets: 1, action: 'balance-sheet' },
    { name: 'GST Report', description: 'Tax liability with CGST/SGST calculation.', sheets: 1, action: 'gst' },
    { name: 'Employee Report', description: 'Staff master with attendance and payroll.', sheets: 3, action: 'employee' },
    { name: 'Branch Report', description: 'Branch-wise performance comparison.', sheets: 2, action: 'branch' },
    { name: 'Audit Report', description: 'Admin action logs and login history.', sheets: 2, action: 'audit' },
  ];

  const scheduledReports = [
    { name: 'Daily Collection Report', schedule: 'Every day at 9:00 PM', format: 'PDF', status: 'Active' },
    { name: 'Weekly Outstanding Summary', schedule: 'Every Monday at 8:00 AM', format: 'Excel', status: 'Active' },
    { name: 'Monthly Financial Report', schedule: '1st of every month', format: 'PDF + Excel', status: 'Active' },
    { name: 'Yearly Audit Export', schedule: 'April 1st (Financial Year Start)', format: 'Enterprise Excel', status: 'Scheduled' },
  ];

  const handleGeneratePDF = (type: string) => {
    const params = new URLSearchParams({
      type: 'report',
      report: type,
      from: fromDate,
      to: toDate,
      format: exportFormat.toLowerCase(),
    });
    if (branchId) params.append('branchId', branchId);
    window.open(`/api/pdf?${params.toString()}`, '_blank');
  };

  const handleEnterpriseExport = async () => {
    setEnterpriseExporting(true);
    setExportProgress(0);
    setExportSuccess(false);

    try {
      // Simulate progress stages
      const progressInterval = setInterval(() => {
        setExportProgress(prev => {
          if (prev >= 90) { clearInterval(progressInterval); return 90; }
          return prev + Math.random() * 15;
        });
      }, 300);

      await generateEnterpriseWorkbook();

      clearInterval(progressInterval);
      setExportProgress(100);
      setExportSuccess(true);

      setTimeout(() => {
        setExportSuccess(false);
        setExportProgress(0);
      }, 4000);
    } catch (err) {
      console.error('Enterprise export failed:', err);
      alert('Export failed. Check console for details.');
    } finally {
      setEnterpriseExporting(false);
    }
  };

  const renderReportCard = (report: typeof financialReports[0]) => {
    const Icon = report.icon;
    return (
      <div
        key={report.type}
        className="bg-[#ffffff] border border-[#E5E7EB] hover:border-[#2563EB]/20 transition rounded-xl p-5 flex flex-col justify-between space-y-4 animate-card-entrance"
      >
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <div className="p-2.5 rounded-lg bg-[#F3F4F6]/50 border border-[#2563EB]/10 text-[#2563EB]">
              <Icon size={20} />
            </div>
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 font-outfit">{report.title}</h3>
            <p className="text-gray-500 text-[11px] mt-1.5 leading-relaxed">{report.description}</p>
          </div>
        </div>
        <button
          onClick={() => handleGeneratePDF(report.type)}
          className="w-full py-2.5 bg-[#F3F4F6] hover:bg-[#E5E7EB] border border-[#2563EB]/20 text-[#2563EB] hover:text-gray-900 rounded-lg text-[10px] font-bold tracking-wider uppercase transition flex items-center justify-center gap-1.5"
        >
          <Download size={12} />
          Generate {exportFormat}
        </button>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs text-[#2563EB] font-semibold tracking-wider uppercase">
        <span>Admin Panel</span>
        <ChevronRight size={12} className="text-gray-400" />
        <span className="text-gray-500">Reports</span>
        <ChevronRight size={12} className="text-gray-400" />
        <span>Export Center</span>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#E5E7EB] pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 tracking-wide font-outfit">Reports & Export Center</h2>
          <p className="text-gray-500 text-xs mt-1">Generate reports, download enterprise workbooks, and schedule automated exports.</p>
        </div>
        {/* Enterprise Export CTA */}
        <button
          onClick={handleEnterpriseExport}
          disabled={enterpriseExporting}
          className={`flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-bold transition-all shadow-lg ${
            exportSuccess
              ? 'bg-emerald-500 text-gray-900 shadow-emerald-500/20'
              : enterpriseExporting
                ? 'bg-[#F3F4F6] text-[#2563EB] border border-[#2563EB]/30 cursor-wait'
                : 'bg-[#2563EB] hover:bg-[#1D4ED8] text-[#F8FAFC] shadow-[#2563EB]/20'
          }`}
        >
          {exportSuccess ? (
            <><CheckCircle2 size={16} /> Downloaded Successfully!</>
          ) : enterpriseExporting ? (
            <><Loader2 size={16} className="animate-spin" /> Generating 50 Sheets...</>
          ) : (
            <><Database size={16} /> Export Enterprise Excel</>
          )}
        </button>
      </div>

      {/* Export Progress Bar */}
      {(enterpriseExporting || exportSuccess) && (
        <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-4 animate-slide-up">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-[#2563EB]">
              {exportSuccess ? '✅ Enterprise Export Complete' : '⏳ Generating PGF_Enterprise Workbook...'}
            </span>
            <span className="text-xs text-gray-500">{Math.round(exportProgress)}%</span>
          </div>
          <div className="w-full bg-[#F3F4F6] rounded-full h-2">
            <div
              className="h-2 rounded-full transition-all duration-300"
              style={{
                width: `${exportProgress}%`,
                background: exportSuccess ? '#22c55e' : 'linear-gradient(90deg, #2563EB, #1D4ED8)'
              }}
            />
          </div>
          <p className="text-[10px] text-gray-400 mt-2">
            {exportSuccess
              ? 'PGF_Enterprise_' + new Date().toISOString().split('T')[0].replace(/-/g, '_') + '.xlsx — 50 sheets, all data included.'
              : 'Fetching data from Firestore... Customers, Loans, Payments, Gold, Interest, Accounting, Audit, Settings...'}
          </p>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex border-b border-[#E5E7EB] text-xs">
        {[
          { key: 'reports', label: 'Individual Reports', icon: FileText },
          { key: 'enterprise', label: 'Enterprise Downloads', icon: Database },
          { key: 'scheduled', label: 'Scheduled Reports', icon: Calendar },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`flex items-center gap-2 px-5 py-2.5 font-bold font-outfit transition-all ${
              activeTab === tab.key
                ? 'text-[#2563EB] border-b-2 border-[#2563EB]'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'reports' && (
        <div className="space-y-8">
          {/* Date Range Filter */}
          <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-5">
            <div className="flex items-center gap-2 text-xs font-bold text-[#2563EB] uppercase tracking-wider mb-4">
              <Filter size={14} />
              Report Filters
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs text-gray-500 font-medium">From Date</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 text-sm rounded-lg px-4 py-2.5 outline-none transition"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-gray-500 font-medium">To Date</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 text-sm rounded-lg px-4 py-2.5 outline-none transition"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-gray-500 font-medium">Export Format</label>
                <select
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value)}
                  className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 text-sm rounded-lg px-4 py-2.5 outline-none transition"
                >
                  <option value="PDF">PDF Document</option>
                  <option value="XLSX">Excel (.xlsx)</option>
                  <option value="CSV">CSV Spreadsheet</option>
                  <option value="JSON">JSON Data</option>
                </select>
              </div>
              <div className="flex items-end">
                <div className="px-4 py-2.5 bg-[#F8FAFC]/60 border border-[#E5E7EB] rounded-lg text-xs text-gray-500 w-full text-center">
                  Period: <span className="text-gray-900 font-semibold">{fromDate}</span> → <span className="text-gray-900 font-semibold">{toDate}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Monthly Statutory Auditor Report Generator — User Highlight Feature */}
          <div className="bg-gradient-to-r from-blue-900 via-slate-900 to-indigo-950 text-white rounded-2xl p-6 sm:p-8 shadow-xl border border-blue-800/40 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="space-y-2 max-w-xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-400/20 border border-amber-400/40 rounded-full text-amber-300 text-[10px] font-bold uppercase tracking-wider">
                  <Shield size={12} /> Statutory Regulatory Compliance
                </div>
                <h3 className="text-xl sm:text-2xl font-bold font-outfit text-white">Monthly Auditor & Portfolio Report</h3>
                <p className="text-xs text-blue-200/80 leading-relaxed">
                  Generates an official RBI-compliant statutory auditor statement with Capital Disbursed, Realized Interest & Principal, Gold Vault Physical Audit Reconciliation, and standard/substandard NPA provisioning matrices with embedded QR verification.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                <button
                  onClick={() => {
                    const params = new URLSearchParams({
                      type: 'monthly_auditor_report',
                      report: 'monthly_auditor_report',
                      from: fromDate,
                      to: toDate,
                    });
                    if (branchId) params.append('branchId', branchId);
                    window.open(`/api/pdf?${params.toString()}`, '_blank');
                  }}
                  className="w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-gray-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <FileText size={16} />
                  Generate Auditor PDF Report
                </button>
                <button
                  onClick={handleEnterpriseExport}
                  className="w-full sm:w-auto px-5 py-3.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  <FileSpreadsheet size={16} />
                  Full Audit Excel (.xlsx)
                </button>
              </div>
            </div>
          </div>

          {/* Financial Reports */}
          <div>
            <h3 className="text-sm font-bold text-[#2563EB] uppercase tracking-wider mb-4 flex items-center gap-2">
              <BarChart3 size={14} /> Financial Reports
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {financialReports.map(renderReportCard)}
            </div>
          </div>

          {/* Customer Reports */}
          <div>
            <h3 className="text-sm font-bold text-[#2563EB] uppercase tracking-wider mb-4 flex items-center gap-2">
              <Users size={14} /> Customer Reports
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {customerReports.map(renderReportCard)}
            </div>
          </div>

          {/* Operational Reports */}
          <div>
            <h3 className="text-sm font-bold text-[#2563EB] uppercase tracking-wider mb-4 flex items-center gap-2">
              <Shield size={14} /> Operational Reports
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {operationalReports.map(renderReportCard)}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'enterprise' && (
        <div className="space-y-6">
          {/* Enterprise Header */}
          <div className="bg-gradient-to-r from-[#ffffff] to-[#F3F4F6] border border-[#2563EB]/20 rounded-xl p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-[#2563EB]/10 border border-[#2563EB]/20">
                <Database size={24} className="text-[#2563EB]" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 font-outfit">Enterprise Data Export</h3>
                <p className="text-gray-500 text-xs mt-1 leading-relaxed max-w-2xl">
                  Download structured Excel workbooks containing all your operational, financial, HR, loan, customer, and reporting data.
                  Each export generates a professional, audit-ready workbook with formatted headers, auto-filters, and totals rows.
                </p>
                <div className="flex gap-4 mt-3 text-[10px] text-gray-400 uppercase tracking-wider">
                  <span className="flex items-center gap-1"><FileSpreadsheet size={10} className="text-emerald-600" /> Excel (.xlsx)</span>
                  <span className="flex items-center gap-1"><Table size={10} className="text-blue-400" /> CSV (.csv)</span>
                  <span className="flex items-center gap-1"><FileText size={10} className="text-red-500" /> PDF (.pdf)</span>
                  <span className="flex items-center gap-1"><FileJson size={10} className="text-amber-400" /> JSON (.json)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Download Cards */}
          <div className="space-y-3">
            {enterpriseDownloads.map((item, index) => (
              <div
                key={item.action}
                className={`bg-[#ffffff] border rounded-xl p-4 flex items-center justify-between transition hover:border-[#2563EB]/20 ${
                  item.action === 'enterprise' ? 'border-[#2563EB]/30 bg-gradient-to-r from-[#ffffff] to-[#F3F4F6]' : 'border-[#E5E7EB]'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                    item.action === 'enterprise'
                      ? 'bg-[#2563EB] text-[#F8FAFC]'
                      : 'bg-[#F3F4F6] text-[#2563EB] border border-[#E5E7EB]'
                  }`}>
                    {index + 1}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-900">{item.name}</h4>
                    <p className="text-[10px] text-gray-500 mt-0.5">{item.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-gray-400 bg-[#F3F4F6] px-2 py-1 rounded font-mono">
                    {item.sheets} {item.sheets === 1 ? 'sheet' : 'sheets'}
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={item.action === 'enterprise' ? handleEnterpriseExport : () => handleGeneratePDF(item.action)}
                      disabled={enterpriseExporting && item.action === 'enterprise'}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition flex items-center gap-1 ${
                        item.action === 'enterprise'
                          ? 'bg-[#2563EB] hover:bg-[#1D4ED8] text-[#F8FAFC]'
                          : 'bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#2563EB] border border-[#2563EB]/20'
                      }`}
                    >
                      {enterpriseExporting && item.action === 'enterprise' ? (
                        <Loader2 size={10} className="animate-spin" />
                      ) : (
                        <Download size={10} />
                      )}
                      XLSX
                    </button>
                    <button
                      onClick={() => handleGeneratePDF(item.action)}
                      className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-[#F3F4F6] hover:bg-[#E5E7EB] text-gray-500 border border-[#E5E7EB] transition flex items-center gap-1"
                    >
                      <FileText size={10} />
                      PDF
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'scheduled' && (
        <div className="space-y-6">
          <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-6">
            <h3 className="text-sm font-bold text-[#2563EB] uppercase tracking-wider mb-4 flex items-center gap-2">
              <Calendar size={14} /> Scheduled Report Configuration
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-gray-400 uppercase tracking-wider border-b border-[#E5E7EB]/60">
                    <th className="pb-3 font-semibold">Report Name</th>
                    <th className="pb-3 font-semibold">Schedule</th>
                    <th className="pb-3 font-semibold">Format</th>
                    <th className="pb-3 font-semibold">Status</th>
                    <th className="pb-3 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB]/40">
                  {scheduledReports.map((report, i) => (
                    <tr key={i} className="text-gray-600">
                      <td className="py-3.5 font-medium text-gray-900">{report.name}</td>
                      <td className="py-3.5 font-mono text-[10px]">{report.schedule}</td>
                      <td className="py-3.5">
                        <span className="px-2 py-0.5 rounded bg-[#F3F4F6] text-[#2563EB] text-[10px] font-bold">
                          {report.format}
                        </span>
                      </td>
                      <td className="py-3.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          report.status === 'Active' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-400'
                        }`}>
                          {report.status}
                        </span>
                      </td>
                      <td className="py-3.5 text-right">
                        <button className="text-[10px] text-gray-500 hover:text-[#2563EB] transition">
                          Configure
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Email Configuration */}
          <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-6">
            <h3 className="text-sm font-bold text-[#2563EB] uppercase tracking-wider mb-4">Email Delivery Settings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs text-gray-500 font-medium">Recipient Email</label>
                <input
                  type="email"
                  defaultValue="admin@pavithragold.com"
                  className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 text-sm rounded-lg px-4 py-2.5 outline-none transition"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-gray-500 font-medium">CC Email</label>
                <input
                  type="email"
                  defaultValue=""
                  placeholder="optional@email.com"
                  className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 text-sm rounded-lg px-4 py-2.5 outline-none transition placeholder-slate-600"
                />
              </div>
            </div>
            <button className="mt-4 px-5 py-2.5 bg-[#F3F4F6] hover:bg-[#E5E7EB] border border-[#2563EB]/20 text-[#2563EB] rounded-lg text-xs font-bold transition">
              Save Email Settings
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
