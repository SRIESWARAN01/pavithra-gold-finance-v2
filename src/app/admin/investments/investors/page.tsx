// src/app/admin/investments/investors/page.tsx
// Investor Directory — Search, filter, and inspect all registered investor accounts.

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Users,
  Search,
  PlusCircle,
  TrendingUp,
  Filter,
  Eye,
  ExternalLink,
  ChevronRight,
  Phone,
  Calendar,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import type { Profile, InvestmentAccount } from '@/types/database';

interface InvestorListItem {
  id: string;
  investor_number: string;
  name: string;
  phone: string;
  email?: string | null;
  status: string;
  created_at: string;
  total_invested: number;
  current_value: number;
  total_withdrawn: number;
  accrued_return: number;
}

export default function InvestorDirectoryPage() {
  const [investors, setInvestors] = useState<InvestorListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');

  const loadInvestors = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch all profiles with role == 'Investor'
      const profSnap = await getDocs(
        query(collection(db, 'profiles'), where('role', '==', 'Investor'), orderBy('created_at', 'desc'))
      );

      // 2. Fetch all investment accounts
      const acctSnap = await getDocs(collection(db, 'investment_accounts'));
      const acctMap: Record<string, InvestmentAccount> = {};
      acctSnap.docs.forEach((d) => {
        acctMap[d.id] = d.data() as InvestmentAccount;
      });

      const items: InvestorListItem[] = profSnap.docs.map((d) => {
        const p = d.data() as Profile;
        const acct = acctMap[d.id];
        return {
          id: d.id,
          investor_number: p.customer_number || d.id,
          name: p.name || 'Valued Investor',
          phone: p.phone_primary || '',
          email: p.email || null,
          status: p.status || 'Active',
          created_at: p.created_at || '',
          total_invested: acct?.total_invested || 0,
          current_value: acct?.current_value || 0,
          total_withdrawn: acct?.total_withdrawn || 0,
          accrued_return: acct?.accrued_return || 0,
        };
      });

      setInvestors(items);
    } catch (err: any) {
      console.error('Error loading investors:', err);
      setError(err.message || 'Failed to load investor directory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvestors();
  }, []);

  const filteredInvestors = useMemo(() => {
    return investors.filter((inv) => {
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        inv.name.toLowerCase().includes(q) ||
        inv.investor_number.toLowerCase().includes(q) ||
        inv.phone.includes(q);

      const matchStatus = statusFilter === 'All' || inv.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [investors, search, statusFilter]);

  const formatINR = (val?: number) => {
    return '₹' + (val || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-800">
              Investor Master
            </span>
            <span className="text-xs text-gray-500 font-semibold">{investors.length} Total Accounts</span>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 font-outfit mt-1">Investor Directory</h1>
          <p className="text-xs text-gray-500">Comprehensive list of all registered investor profiles and wealth portfolios.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadInvestors}
            disabled={loading}
            className="p-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 transition-all cursor-pointer"
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <Link
            href="/admin/investments/investors/new"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-lg shadow-amber-500/20 transition-all"
          >
            <PlusCircle size={15} />
            Create Investor
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-3">
          <AlertCircle size={18} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <div className="relative flex-1 w-full">
          <Search size={16} className="absolute left-3.5 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search by Investor ID, Name, or Mobile Number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-600"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter size={15} className="text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-3 py-2.5 rounded-xl border border-gray-200 text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            <option value="All">All Statuses</option>
            <option value="Active">Active Only</option>
            <option value="Inactive">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* Investor Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-gray-50/80 text-gray-500 font-bold border-b border-gray-100 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Investor ID</th>
                <th className="px-5 py-3.5">Investor Name</th>
                <th className="px-5 py-3.5">Mobile</th>
                <th className="px-5 py-3.5">Total Invested</th>
                <th className="px-5 py-3.5">Current Value</th>
                <th className="px-5 py-3.5">Total Withdrawn</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-gray-400">
                    <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-blue-600" />
                    Loading investor records...
                  </td>
                </tr>
              ) : filteredInvestors.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-gray-400">
                    No investors matching your search criteria.
                  </td>
                </tr>
              ) : (
                filteredInvestors.map((inv) => (
                  <tr key={inv.id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-5 py-4 font-mono font-bold text-gray-900">
                      <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100">
                        {inv.investor_number}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-bold text-gray-900">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-800 font-bold flex items-center justify-center text-xs">
                          {inv.name.charAt(0)}
                        </div>
                        <div>
                          <div>{inv.name}</div>
                          {inv.email && <div className="text-[10px] text-gray-400 font-normal">{inv.email}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-mono text-gray-600">
                      <div className="flex items-center gap-1.5">
                        <Phone size={12} className="text-gray-400" />
                        {inv.phone}
                      </div>
                    </td>
                    <td className="px-5 py-4 font-mono font-semibold text-gray-900">
                      {formatINR(inv.total_invested)}
                    </td>
                    <td className="px-5 py-4 font-mono font-bold text-amber-600">
                      {formatINR(inv.current_value)}
                    </td>
                    <td className="px-5 py-4 font-mono text-gray-500">
                      {formatINR(inv.total_withdrawn)}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          inv.status === 'Active'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        href={`/admin/investments/investors/${inv.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold transition-all text-xs"
                      >
                        <Eye size={13} />
                        View Dossier
                      </Link>
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
