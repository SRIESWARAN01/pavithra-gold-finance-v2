'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Search,
  User,
  Phone,
  MapPin,
  ShieldCheck,
  Calendar,
  Layers,
  Scale,
  Coins,
  Receipt,
  FileText,
  Printer,
  Download,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  X,
  ExternalLink,
  ArrowRight,
  Clock,
  Eye,
  Building2,
  RefreshCw,
  ImageIcon,
} from 'lucide-react';
import {
  searchCustomersForKYC,
  getKYCConsultation,
  extractDatePart,
} from '@/lib/db/kyc-consultation';
import { getCurrentProfile } from '@/lib/auth';
import type {
  Profile,
  KYCConsultationData,
  CustomerPledgeHistoryItem,
  KYCOrnamentItem,
} from '@/types/database';

export default function KYCConsultationPage() {
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searching, setSearching] = useState<boolean>(false);
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [hasSearched, setHasSearched] = useState<boolean>(false);

  // Selected customer & consultation data
  const [selectedCustomer, setSelectedCustomer] = useState<Profile | null>(null);
  const [data, setData] = useState<KYCConsultationData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // UI toggles
  const [kycDetailsOpen, setKycDetailsOpen] = useState<boolean>(false);
  const [sortOrder, setSortOrder] = useState<
    'date_asc' | 'date_desc' | 'amount_desc' | 'amount_asc'
  >('date_asc');

  // Pledge Details Modal
  const [selectedPledge, setSelectedPledge] = useState<CustomerPledgeHistoryItem | null>(null);
  const [selectedPhotoOrnament, setSelectedPhotoOrnament] = useState<KYCOrnamentItem | null>(null);

  // Optional "As Of Date" filter
  const [asOfDate, setAsOfDate] = useState<string>('');

  useEffect(() => {
    async function init() {
      try {
        const prof = await getCurrentProfile();
        setCurrentUser(prof);
      } catch (err) {
        console.error('Error fetching current user:', err);
      }
    }
    init();
  }, []);

  // Formatters
  const formatINR = (val: number) => {
    return '₹ ' + (val || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatGrams = (val: number) => {
    return (val || 0).toFixed(2) + ' g';
  };

  const formatDisplayDate = (dStr?: string | null) => {
    if (!dStr) return '—';
    const parts = dStr.split('-');
    if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
    return dStr;
  };

  // Perform Customer Search
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;

    setSearching(true);
    setError(null);
    setHasSearched(true);
    setSearchResults([]);

    try {
      const branchId = currentUser?.role === 'Admin' || currentUser?.role === 'Owner'
        ? undefined
        : currentUser?.branch_id || undefined;

      const results = await searchCustomersForKYC(q, branchId);
      setSearchResults(results);

      // If exactly one match found, immediately load that customer
      if (results.length === 1) {
        await loadCustomerConsultation(results[0].id);
      } else if (results.length === 0) {
        setData(null);
        setSelectedCustomer(null);
      }
    } catch (err: any) {
      console.error('Search error:', err);
      setError(err.message || 'Search failed. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  // Load complete consultation for selected customer
  const loadCustomerConsultation = async (customerId: string, targetAsOfDate?: string) => {
    setLoading(true);
    setError(null);
    try {
      const branchId = currentUser?.role === 'Admin' || currentUser?.role === 'Owner'
        ? undefined
        : currentUser?.branch_id || undefined;

      const consultation = await getKYCConsultation(customerId, branchId, targetAsOfDate || asOfDate);
      setData(consultation);
      setSelectedCustomer(consultation.customer);
    } catch (err: any) {
      console.error('Error loading KYC consultation:', err);
      setError(err.message || 'Failed to load KYC consultation.');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  // Handle As-Of Date Change
  const handleAsOfDateChange = (newDate: string) => {
    setAsOfDate(newDate);
    if (selectedCustomer) {
      loadCustomerConsultation(selectedCustomer.id, newDate);
    }
  };

  // Sorted Pledge History
  const sortedPledges = useMemo(() => {
    if (!data?.pledgeHistory) return [];
    const list = [...data.pledgeHistory];

    if (sortOrder === 'date_asc') {
      list.sort((a, b) => a.pledgeDate.localeCompare(b.pledgeDate));
    } else if (sortOrder === 'date_desc') {
      list.sort((a, b) => b.pledgeDate.localeCompare(a.pledgeDate));
    } else if (sortOrder === 'amount_desc') {
      list.sort((a, b) => b.originalPledgeAmount - a.originalPledgeAmount);
    } else if (sortOrder === 'amount_asc') {
      list.sort((a, b) => a.originalPledgeAmount - b.originalPledgeAmount);
    }

    return list;
  }, [data, sortOrder]);

  // Print Handler
  const handlePrint = () => {
    window.print();
  };

  // CSV Export Handler
  const handleExportCSV = () => {
    if (!data) return;

    let csv = `PAVITHRA GOLD FINANCE - KYC CONSULTATION REPORT\r\n`;
    csv += `Customer ID,${data.customer.customer_number || data.customer.id}\r\n`;
    csv += `Customer Name,"${data.customer.name}"\r\n`;
    csv += `Mobile,${data.customer.phone_primary}\r\n`;
    csv += `Address,"${[data.customer.address, data.customer.city, data.customer.district, data.customer.state, data.customer.pin_code].filter(Boolean).join(', ')}"\r\n`;
    csv += `Generated At,${data.generatedAt}\r\n\r\n`;

    csv += `LIFETIME SUMMARY\r\n`;
    csv += `Metric,Value\r\n`;
    csv += `Total Historical Pledges,${data.summary.totalPledges}\r\n`;
    csv += `Total Releases,${data.summary.totalReleases}\r\n`;
    csv += `Current Active Pledges,${data.summary.currentActivePledges}\r\n`;
    csv += `Total Historical Pledge Amount,${data.summary.totalHistoricalPledgeAmount}\r\n`;
    csv += `Current Principal Outstanding,${data.summary.currentPrincipalOutstanding}\r\n`;
    csv += `Current Total Outstanding,${data.summary.currentTotalOutstanding}\r\n`;
    csv += `Current Active Gold Weight,${data.summary.currentActiveGoldWeight} g\r\n\r\n`;

    csv += `CUSTOMER PLEDGE HISTORY\r\n`;
    csv += `Pledge Date,Loan Number,Pledge Amount,Release Date,Days Active,Status,Current Outstanding,Net Weight (g),Bank Re-Pledged\r\n`;
    sortedPledges.forEach((p) => {
      csv += `${formatDisplayDate(p.pledgeDate)},${p.loanNumber},${p.originalPledgeAmount},${p.releaseDate ? formatDisplayDate(p.releaseDate) : 'Not Released'},"${p.daysActiveText}",${p.status},${p.totalOutstanding},${p.totalNetWeight},${p.repledge ? 'Yes' : 'No'}\r\n`;
    });
    csv += `\r\n`;

    csv += `ALL ORNAMENT DETAILS\r\n`;
    csv += `Loan Number,Item Description,Quantity,Gross Weight (g),Stone Weight (g),Net Weight (g),Purity\r\n`;
    sortedPledges.forEach((p) => {
      p.ornaments.forEach((o) => {
        csv += `${p.loanNumber},"${o.item_description}",${o.quantity},${o.gross_weight},${o.stone_weight},${o.net_weight},${o.purity_karat}\r\n`;
      });
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `PGF_KYC_Consultation_${data.customer.customer_number || data.customer.id}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 print:p-0 print:m-0 print:max-w-none">
      {/* 1. Header & Quick Consultation Search */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs print:border-none print:shadow-none print:p-0">
        <div>
          <div className="flex items-center gap-2 text-amber-800 text-xs font-bold uppercase tracking-wider">
            <ShieldCheck size={16} />
            <span>Customer Due Diligence &amp; History</span>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight mt-1 flex items-center gap-2.5">
            KYC Consultation
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 print:hidden">
              Read-Only
            </span>
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Complete 360° customer profile: identity, lifetime pledges, releases, active portfolio, and ornament history.
          </p>
        </div>

        {/* Search Input Bar */}
        <div className="w-full lg:w-auto min-w-[320px] print:hidden">
          <form onSubmit={handleSearch} className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Mobile / Customer ID / Name..."
                className="w-full pl-10 pr-4 py-2 text-xs font-medium bg-gray-50 border border-gray-200 rounded-xl focus:outline-hidden focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={searching || !searchQuery.trim()}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-2xs transition-all disabled:opacity-50 flex items-center gap-1.5 shrink-0"
            >
              {searching ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <Search size={14} />
              )}
              <span>Search</span>
            </button>
          </form>
        </div>
      </div>

      {/* Print-only Header */}
      {data && (
        <div className="hidden print:block mb-4 pb-3 border-b border-gray-300 text-center">
          <h2 className="text-xl font-bold text-gray-900">PAVITHRA GOLD FINANCE</h2>
          <p className="text-xs text-gray-600 font-semibold uppercase tracking-wider mt-0.5">
            KYC CONSULTATION REPORT • {data.customer.customer_number || data.customer.id}
          </p>
          <p className="text-[11px] text-gray-500 mt-1">
            Customer: <span className="font-bold text-gray-900">{data.customer.name}</span> | Mobile: {data.customer.phone_primary} | Date: {formatDisplayDate(new Date().toISOString().split('T')[0])}
          </p>
        </div>
      )}

      {/* Multiple Matching Customers Selection Card */}
      {hasSearched && searchResults.length > 1 && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 print:hidden">
          <div className="flex items-center gap-2 mb-2 text-amber-900 font-bold text-xs">
            <AlertTriangle size={15} />
            <span>Multiple customers found for &quot;{searchQuery}&quot;. Please select:</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {searchResults.map((cust) => (
              <button
                key={cust.id}
                onClick={() => loadCustomerConsultation(cust.id)}
                className="p-3 rounded-xl bg-white border border-amber-200 hover:border-blue-500 hover:bg-blue-50/30 transition-all text-left shadow-2xs group"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-xs text-blue-700">
                    {cust.customer_number || cust.id}
                  </span>
                  <ArrowRight size={13} className="text-gray-400 group-hover:text-blue-600 transition-colors" />
                </div>
                <div className="font-bold text-gray-900 text-xs mt-1 truncate">{cust.name}</div>
                <div className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
                  <Phone size={11} />
                  <span>{cust.phone_primary}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* No Customer Found Message */}
      {hasSearched && !searching && searchResults.length === 0 && !data && (
        <div className="bg-white rounded-2xl border border-gray-200/80 p-8 text-center shadow-xs">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto text-gray-400 mb-3">
            <User size={24} />
          </div>
          <h2 className="text-base font-bold text-gray-900">Customer Not Found</h2>
          <p className="text-xs text-gray-500 max-w-md mx-auto mt-1">
            No active customer records matched &quot;{searchQuery}&quot;.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2 mt-4 text-xs">
            <span className="text-gray-400">Search suggestions:</span>
            <span className="px-2.5 py-1 bg-gray-100 rounded-lg text-gray-700 font-mono">10-Digit Mobile</span>
            <span className="px-2.5 py-1 bg-gray-100 rounded-lg text-gray-700 font-mono">Customer ID (PGF-CUST-...)</span>
            <span className="px-2.5 py-1 bg-gray-100 rounded-lg text-gray-700 font-mono">Customer Name</span>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => selectedCustomer && loadCustomerConsultation(selectedCustomer.id)} className="font-bold underline hover:text-rose-900">
            Retry
          </button>
        </div>
      )}

      {/* Loading Indicator */}
      {loading && (
        <div className="p-12 text-center text-xs text-gray-500 space-y-3">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <div>Loading customer consultation dossier...</div>
        </div>
      )}

      {/* 2. Customer Profile & KYC Information */}
      {data && !loading && (
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-amber-400 font-extrabold text-lg shrink-0">
                {data.customer.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                    {data.customer.customer_number || data.customer.id}
                  </span>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      data.customer.kyc_status === 'Approved'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    KYC: {data.customer.kyc_status || 'Pending'}
                  </span>
                </div>
                <h2 className="text-xl font-extrabold text-white mt-1">
                  {data.customer.name}
                </h2>
                <div className="flex flex-wrap items-center gap-4 text-xs text-blue-100/80 mt-1">
                  <span className="flex items-center gap-1">
                    <Phone size={12} className="text-amber-300" />
                    {data.customer.phone_primary}
                    {data.customer.phone_alt && ` / ${data.customer.phone_alt}`}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin size={12} className="text-amber-300" />
                    {[data.customer.address, data.customer.city, data.customer.state, data.customer.pin_code].filter(Boolean).join(', ') || 'Address on file'}
                  </span>
                </div>
              </div>
            </div>

            {/* Print, Export & As-Of Date Actions */}
            <div className="flex flex-wrap items-center gap-2 print:hidden">
              {/* As Of Date Selector */}
              <div className="flex items-center bg-white/10 border border-white/20 rounded-xl px-2.5 py-1 text-xs">
                <span className="text-[11px] text-blue-200 mr-1.5">As Of:</span>
                <input
                  type="date"
                  value={asOfDate}
                  onChange={(e) => handleAsOfDateChange(e.target.value)}
                  className="bg-transparent text-white font-mono text-xs border-none focus:outline-hidden cursor-pointer"
                />
              </div>

              <button
                onClick={handleExportCSV}
                title="Export Excel / CSV"
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-gray-900 bg-white hover:bg-gray-100 rounded-xl shadow-2xs transition-colors"
              >
                <Download size={13} />
                <span>Export</span>
              </button>

              <button
                onClick={handlePrint}
                title="Print Consultation Report"
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-2xs transition-colors"
              >
                <Printer size={13} />
                <span>Print</span>
              </button>
            </div>
          </div>

          {/* Collapsible KYC Details Section */}
          <div className="border-t border-gray-100">
            <button
              onClick={() => setKycDetailsOpen(!kycDetailsOpen)}
              className="w-full px-5 py-2.5 bg-gray-50/70 hover:bg-gray-100/70 flex items-center justify-between text-xs font-bold text-gray-700 transition-colors"
            >
              <div className="flex items-center gap-2">
                <ShieldCheck size={15} className="text-blue-600" />
                <span>KYC &amp; Verification Details</span>
              </div>
              {kycDetailsOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>

            {kycDetailsOpen && (
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs bg-white">
                <div>
                  <span className="text-gray-500 block mb-0.5">Customer Unique ID:</span>
                  <span className="font-mono font-bold text-gray-900">
                    {data.customer.customer_number || data.customer.id}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block mb-0.5">Aadhaar / National ID:</span>
                  <span className="font-mono font-bold text-gray-900">
                    {data.customer.national_id || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block mb-0.5">PAN Number:</span>
                  <span className="font-mono font-bold text-gray-900">
                    {data.customer.pan_number || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block mb-0.5">KYC Status:</span>
                  <span className="font-semibold text-emerald-700">
                    {data.customer.kyc_status || 'Pending Verification'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block mb-0.5">Primary Mobile:</span>
                  <span className="font-mono text-gray-900">{data.customer.phone_primary}</span>
                </div>
                <div>
                  <span className="text-gray-500 block mb-0.5">Secondary Contact:</span>
                  <span className="font-mono text-gray-900">{data.customer.phone_alt || '—'}</span>
                </div>
                <div>
                  <span className="text-gray-500 block mb-0.5">Email Address:</span>
                  <span className="text-gray-900">{data.customer.email || '—'}</span>
                </div>
                <div>
                  <span className="text-gray-500 block mb-0.5">Account Status:</span>
                  <span className="font-semibold text-blue-700">{data.customer.status}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. Overall Customer Summary Dashboard */}
      {data && !loading && (
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
              <Layers size={14} className="text-blue-600" />
              Lifetime &amp; Overall Position
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white rounded-xl border border-gray-200/80 p-3.5 shadow-xs">
              <span className="text-[11px] font-bold text-gray-500 uppercase block mb-1">
                Total Pledges
              </span>
              <span className="font-mono font-extrabold text-xl text-gray-900 block">
                {data.summary.totalPledges}
              </span>
              <span className="text-[10px] text-gray-400">All historical loans</span>
            </div>

            <div className="bg-white rounded-xl border border-gray-200/80 p-3.5 shadow-xs">
              <span className="text-[11px] font-bold text-gray-500 uppercase block mb-1">
                Total Releases
              </span>
              <span className="font-mono font-extrabold text-xl text-emerald-700 block">
                {data.summary.totalReleases}
              </span>
              <span className="text-[10px] text-gray-400">Fully closed loans</span>
            </div>

            <div className="bg-white rounded-xl border border-gray-200/80 p-3.5 shadow-xs">
              <span className="text-[11px] font-bold text-gray-500 uppercase block mb-1">
                Historical Pledged
              </span>
              <span className="font-mono font-extrabold text-lg text-blue-700 block truncate" title={formatINR(data.summary.totalHistoricalPledgeAmount)}>
                {formatINR(data.summary.totalHistoricalPledgeAmount)}
              </span>
              <span className="text-[10px] text-gray-400">Cumulative sanctioned</span>
            </div>

            <div className="bg-white rounded-xl border border-gray-200/80 p-3.5 shadow-xs">
              <span className="text-[11px] font-bold text-gray-500 uppercase block mb-1">
                Active Pockets
              </span>
              <span className="font-mono font-extrabold text-xl text-amber-700 block">
                {data.summary.currentActivePledges}
              </span>
              <span className="text-[10px] text-gray-400">Open active loans</span>
            </div>

            <div className="bg-white rounded-xl border border-gray-200/80 p-3.5 shadow-xs">
              <span className="text-[11px] font-bold text-gray-500 uppercase block mb-1">
                Current Outstanding
              </span>
              <span className="font-mono font-extrabold text-lg text-rose-700 block truncate" title={formatINR(data.summary.currentTotalOutstanding)}>
                {formatINR(data.summary.currentTotalOutstanding)}
              </span>
              <span className="text-[10px] text-gray-400">Principal: {formatINR(data.summary.currentPrincipalOutstanding)}</span>
            </div>

            <div className="bg-white rounded-xl border border-gray-200/80 p-3.5 shadow-xs">
              <span className="text-[11px] font-bold text-gray-500 uppercase block mb-1">
                Active Gold
              </span>
              <span className="font-mono font-extrabold text-xl text-amber-900 block">
                {formatGrams(data.summary.currentActiveGoldWeight)}
              </span>
              <span className="text-[10px] text-gray-400">Net gold held in custody</span>
            </div>
          </div>
        </div>
      )}

      {/* 4. Customer Pledge History Table */}
      {data && !loading && (
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Coins size={18} className="text-amber-600" />
                Customer Pledge History
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Every pledge transaction appears separately. Click &quot;View&quot; for complete ornament, payment, and re-pledge details.
              </p>
            </div>

            {/* Sort Controls */}
            <div className="flex items-center gap-2 print:hidden">
              <span className="text-xs text-gray-500 font-medium">Sort By:</span>
              <select
                value={sortOrder}
                onChange={(e: any) => setSortOrder(e.target.value)}
                className="text-xs font-semibold text-gray-800 bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 focus:outline-hidden cursor-pointer"
              >
                <option value="date_asc">Oldest First (Date Ascending)</option>
                <option value="date_desc">Newest First (Date Descending)</option>
                <option value="amount_desc">Highest Amount First</option>
                <option value="amount_asc">Lowest Amount First</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="p-3.5 pl-5">Pledge Date</th>
                  <th className="p-3.5">Loan Number</th>
                  <th className="p-3.5 text-right">Original Amount</th>
                  <th className="p-3.5">Release Date</th>
                  <th className="p-3.5 text-center">Days Active</th>
                  <th className="p-3.5 text-right">Current Outstanding</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-center pr-5 print:hidden">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sortedPledges.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-gray-400">
                      No pledges found for this customer.
                    </td>
                  </tr>
                ) : (
                  sortedPledges.map((p) => {
                    const isReleased = p.status === 'Settled' || Boolean(p.releaseDate);
                    return (
                      <tr key={p.loanId} className="hover:bg-gray-50/80 transition-colors">
                        <td className="p-3.5 pl-5 font-mono text-gray-800 font-semibold">
                          {formatDisplayDate(p.pledgeDate)}
                        </td>
                        <td className="p-3.5 font-mono font-bold text-blue-700">
                          <Link
                            href={`/admin/loans/${p.loanId}`}
                            className="hover:underline flex items-center gap-1"
                          >
                            {p.loanNumber}
                            <ExternalLink size={11} className="text-gray-400 print:hidden" />
                          </Link>
                        </td>
                        <td className="p-3.5 text-right font-mono font-bold text-gray-900">
                          {formatINR(p.originalPledgeAmount)}
                        </td>
                        <td className="p-3.5 font-mono text-gray-600">
                          {p.releaseDate ? (
                            <span className="text-emerald-700 font-semibold">
                              {formatDisplayDate(p.releaseDate)}
                            </span>
                          ) : (
                            <span className="text-amber-700 font-semibold">Active</span>
                          )}
                        </td>
                        <td className="p-3.5 text-center font-mono">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                              isReleased
                                ? 'bg-gray-100 text-gray-800'
                                : 'bg-amber-100 text-amber-900'
                            }`}
                          >
                            {p.daysActiveText}
                          </span>
                        </td>
                        <td className="p-3.5 text-right font-mono font-bold">
                          {isReleased ? (
                            <span className="text-gray-400 font-normal">₹ 0.00</span>
                          ) : (
                            <span className="text-rose-700">{formatINR(p.totalOutstanding)}</span>
                          )}
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              isReleased
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-blue-50 text-blue-700 border border-blue-200'
                            }`}
                          >
                            {isReleased ? 'RELEASED' : 'ACTIVE'}
                          </span>
                        </td>
                        <td className="p-3.5 text-center pr-5 print:hidden">
                          <button
                            onClick={() => setSelectedPledge(p)}
                            className="px-3 py-1 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors flex items-center gap-1 mx-auto"
                          >
                            <Eye size={12} />
                            <span>View</span>
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
      )}

      {/* 5. Customer Loan Timeline Card */}
      {data && sortedPledges.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs print:hidden">
          <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-4">
            <Clock size={16} className="text-blue-600" />
            Customer Loan Progression Timeline
          </h2>
          <div className="relative border-l-2 border-blue-200 ml-4 space-y-6">
            {sortedPledges.map((p, idx) => {
              const isReleased = p.status === 'Settled' || Boolean(p.releaseDate);
              return (
                <div key={p.loanId} className="relative pl-6">
                  {/* Timeline Dot */}
                  <div
                    className={`absolute -left-[9px] top-1.5 w-4 h-4 rounded-full border-2 border-white ${
                      isReleased ? 'bg-emerald-500 shadow-emerald-200' : 'bg-amber-500 shadow-amber-200'
                    } shadow-xs`}
                  ></div>

                  <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
                    <div>
                      <span className="font-mono font-bold text-xs text-blue-700">
                        {p.loanNumber}
                      </span>
                      <span className="mx-2 text-gray-300">•</span>
                      <span className="font-bold text-gray-900 text-xs">
                        Pledged: {formatINR(p.originalPledgeAmount)}
                      </span>
                      <span className="text-[11px] text-gray-500 ml-2 font-mono">
                        ({formatDisplayDate(p.pledgeDate)})
                      </span>
                    </div>

                    <div className="text-xs">
                      {isReleased ? (
                        <span className="text-emerald-700 font-semibold font-mono">
                          Released on {formatDisplayDate(p.releaseDate)} ({p.daysActive} Days)
                        </span>
                      ) : (
                        <span className="text-amber-700 font-semibold font-mono">
                          Currently Active ({p.daysActive} Days elapsed)
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 6. Pledge Details Modal / Drawer */}
      {selectedPledge && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-gray-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-slate-900 text-white shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    {selectedPledge.loanNumber}
                  </span>
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                      selectedPledge.status === 'Settled' || selectedPledge.releaseDate
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {selectedPledge.status}
                  </span>
                </div>
                <h3 className="text-lg font-extrabold text-white mt-1">
                  Pledge Details &amp; Ornament Inventory
                </h3>
              </div>
              <button
                onClick={() => setSelectedPledge(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-6 text-xs">
              {/* Summary Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50 p-4 rounded-xl border border-gray-200/80">
                <div>
                  <span className="text-gray-500 block mb-0.5">Original Loan Amount:</span>
                  <span className="font-mono font-bold text-sm text-gray-900">
                    {formatINR(selectedPledge.originalPledgeAmount)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block mb-0.5">Pledge Date:</span>
                  <span className="font-mono font-semibold text-gray-900">
                    {formatDisplayDate(selectedPledge.pledgeDate)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block mb-0.5">Release Date:</span>
                  <span className="font-mono font-semibold text-gray-900">
                    {selectedPledge.releaseDate ? formatDisplayDate(selectedPledge.releaseDate) : 'Active'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block mb-0.5">Duration:</span>
                  <span className="font-mono font-bold text-amber-800">
                    {selectedPledge.daysActiveText}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block mb-0.5">Annual Interest Rate:</span>
                  <span className="font-mono font-semibold text-gray-900">
                    {selectedPledge.interestRateApr}% APR
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block mb-0.5">Principal Paid:</span>
                  <span className="font-mono font-semibold text-emerald-700">
                    {formatINR(selectedPledge.principalPaid)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block mb-0.5">Current Principal:</span>
                  <span className="font-mono font-bold text-gray-900">
                    {formatINR(selectedPledge.currentPrincipal)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block mb-0.5">Total Outstanding:</span>
                  <span className="font-mono font-extrabold text-sm text-rose-700">
                    {formatINR(selectedPledge.totalOutstanding)}
                  </span>
                </div>
              </div>

              {/* Bank Re-Pledge Alert if active */}
              {selectedPledge.repledge && (
                <div className="p-4 rounded-xl bg-purple-50 border border-purple-200 text-purple-900">
                  <div className="flex items-center gap-2 font-bold text-xs mb-1">
                    <Building2 size={16} className="text-purple-700" />
                    <span>Collateral Currently Re-Pledged with Commercial Bank</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mt-2">
                    <div>
                      <span className="text-purple-600 block text-[11px]">Bank &amp; Branch:</span>
                      <span className="font-bold">{selectedPledge.repledge.bank_name} ({selectedPledge.repledge.bank_branch})</span>
                    </div>
                    <div>
                      <span className="text-purple-600 block text-[11px]">Re-Pledge #:</span>
                      <span className="font-mono font-bold">{selectedPledge.repledge.repledge_number}</span>
                    </div>
                    <div>
                      <span className="text-purple-600 block text-[11px]">Bank Amount:</span>
                      <span className="font-mono font-bold">{formatINR(selectedPledge.repledge.bank_pledge_amount)}</span>
                    </div>
                    <div>
                      <span className="text-purple-600 block text-[11px]">Custody Location:</span>
                      <span className="font-semibold">{selectedPledge.repledge.custody_location}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Ornament Details Table */}
              <div>
                <h4 className="text-sm font-bold text-gray-900 flex items-center gap-1.5 mb-2.5">
                  <Scale size={15} className="text-amber-600" />
                  Ornament Inventory ({selectedPledge.ornaments.length} items)
                </h4>

                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="p-2.5 pl-3 w-8">#</th>
                        <th className="p-2.5">Ornament / Item</th>
                        <th className="p-2.5 text-center">Qty</th>
                        <th className="p-2.5 text-right">Gross Wt</th>
                        <th className="p-2.5 text-right">Stone Wt</th>
                        <th className="p-2.5 text-right">Net Wt</th>
                        <th className="p-2.5 text-center">Purity</th>
                        <th className="p-2.5 text-center pr-3">Photos</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {selectedPledge.ornaments.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-4 text-center text-gray-400">
                            No ornament records attached to this loan.
                          </td>
                        </tr>
                      ) : (
                        selectedPledge.ornaments.map((orn, idx) => (
                          <tr key={orn.id} className="hover:bg-gray-50/80">
                            <td className="p-2.5 pl-3 font-mono text-gray-400">{idx + 1}</td>
                            <td className="p-2.5 font-bold text-gray-900">{orn.item_description}</td>
                            <td className="p-2.5 text-center font-mono">{orn.quantity}</td>
                            <td className="p-2.5 text-right font-mono">{formatGrams(orn.gross_weight)}</td>
                            <td className="p-2.5 text-right font-mono">{formatGrams(orn.stone_weight)}</td>
                            <td className="p-2.5 text-right font-mono font-bold text-amber-900">
                              {formatGrams(orn.net_weight)}
                            </td>
                            <td className="p-2.5 text-center font-semibold text-gray-700">
                              {orn.purity_karat || '22K'}
                            </td>
                            <td className="p-2.5 text-center pr-3">
                              {orn.photos && orn.photos.length > 0 ? (
                                <button
                                  onClick={() => setSelectedPhotoOrnament(orn)}
                                  className="p-1 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                                  title="View Photos"
                                >
                                  <ImageIcon size={14} />
                                </button>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot className="bg-amber-50/50 font-bold border-t border-gray-200 text-gray-900">
                      <tr>
                        <td colSpan={3} className="p-2.5 pl-3 text-right">Total Weight:</td>
                        <td className="p-2.5 text-right font-mono">{formatGrams(selectedPledge.totalGrossWeight)}</td>
                        <td className="p-2.5 text-right font-mono">{formatGrams(selectedPledge.totalStoneWeight)}</td>
                        <td className="p-2.5 text-right font-mono text-amber-900 font-extrabold">
                          {formatGrams(selectedPledge.totalNetWeight)}
                        </td>
                        <td colSpan={2}></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Payment History Section */}
              <div>
                <h4 className="text-sm font-bold text-gray-900 flex items-center gap-1.5 mb-2.5">
                  <Receipt size={15} className="text-blue-600" />
                  Payment History ({selectedPledge.payments.length} transactions)
                </h4>

                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="p-2.5 pl-3">Date</th>
                        <th className="p-2.5">Receipt #</th>
                        <th className="p-2.5 text-right">Paid</th>
                        <th className="p-2.5 text-right">Interest</th>
                        <th className="p-2.5 text-right">Principal</th>
                        <th className="p-2.5 text-right">Penalty</th>
                        <th className="p-2.5 text-right">Waiver</th>
                        <th className="p-2.5 text-center pr-3">Mode</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {selectedPledge.payments.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-4 text-center text-gray-400">
                            No payment transactions recorded for this loan.
                          </td>
                        </tr>
                      ) : (
                        selectedPledge.payments.map((pmt) => (
                          <tr key={pmt.id} className="hover:bg-gray-50/80">
                            <td className="p-2.5 pl-3 font-mono text-gray-700">
                              {formatDisplayDate(pmt.payment_date)}
                            </td>
                            <td className="p-2.5 font-mono font-bold text-gray-900">{pmt.receipt_number}</td>
                            <td className="p-2.5 text-right font-mono font-bold text-gray-900">
                              {formatINR(pmt.amount_paid)}
                            </td>
                            <td className="p-2.5 text-right font-mono text-gray-600">
                              {formatINR(pmt.interest_portion)}
                            </td>
                            <td className="p-2.5 text-right font-mono font-bold text-indigo-700">
                              {formatINR(pmt.principal_portion)}
                            </td>
                            <td className="p-2.5 text-right font-mono text-gray-600">
                              {formatINR(pmt.penalty_amount)}
                            </td>
                            <td className="p-2.5 text-right font-mono text-gray-600">
                              {formatINR(pmt.waiver_amount)}
                            </td>
                            <td className="p-2.5 text-center pr-3">
                              <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-800 text-[10px] font-semibold">
                                {pmt.mode}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end shrink-0">
              <button
                onClick={() => setSelectedPledge(null)}
                className="px-4 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Ornament Photo Gallery Modal */}
      {selectedPhotoOrnament && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h4 className="text-sm font-bold text-gray-900">{selectedPhotoOrnament.item_description}</h4>
                <p className="text-xs text-gray-500">Net Weight: {formatGrams(selectedPhotoOrnament.net_weight)}</p>
              </div>
              <button
                onClick={() => setSelectedPhotoOrnament(null)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
              >
                <X size={16} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {selectedPhotoOrnament.photos && selectedPhotoOrnament.photos.length > 0 ? (
                selectedPhotoOrnament.photos.map((ph, idx) => (
                  <div key={ph.id || idx} className="rounded-xl overflow-hidden border border-gray-200 aspect-square bg-gray-100">
                    <img src={ph.photo_url} alt="Ornament" className="w-full h-full object-cover" />
                  </div>
                ))
              ) : (
                <div className="col-span-2 p-6 text-center text-gray-400 text-xs">
                  No photos available.
                </div>
              )}
            </div>

            <button
              onClick={() => setSelectedPhotoOrnament(null)}
              className="w-full py-2 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
            >
              Close Gallery
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
