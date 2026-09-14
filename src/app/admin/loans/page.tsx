'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Plus, ChevronRight, Coins, Eye } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, doc, getDoc, getDocs, query, orderBy } from 'firebase/firestore';
import type { Loan } from '@/types/database';

export default function LoansDirectory() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const statusColors: Record<string, string> = {
    Active: 'bg-emerald-500/10 text-emerald-600',
    Due: 'bg-amber-500/10 text-amber-400',
    Overdue: 'bg-red-50 text-red-500',
    Closed: 'bg-slate-500/10 text-gray-500',
    Settled: 'bg-slate-500/10 text-gray-500',
  };

  const fetchLoans = async () => {
    setLoading(true);
    try {
      const q = query(collection(db, 'loans'), orderBy('created_at', 'desc'));
      const snapshot = await getDocs(q);

      const allLoans: any[] = [];
      for (const d of snapshot.docs) {
        const loan: any = { id: d.id, ...d.data() };
        if (loan.customer_id) {
          const custSnap = await getDoc(doc(db, 'profiles', loan.customer_id));
          if (custSnap.exists()) {
            loan.customer = { name: custSnap.data().name };
          }
        }
        allLoans.push(loan);
      }

      const filtered = allLoans.filter((l: any) =>
        l.loan_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (l.customer?.name || '').toLowerCase().includes(searchQuery.toLowerCase())
      );

      setLoans(filtered);
    } catch (err) {
      console.error('Failed to load loans ledger:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => {
      fetchLoans();
    }, 0);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const getLoansByStatus = (status: string) => {
    return loans.filter((l) => l.status === status).length;
  };

  const getTotalDisbursed = () => {
    return loans.reduce((sum, l) => sum + (l.principal_amount || 0), 0);
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs text-[#2563EB] font-semibold tracking-wider uppercase">
        <span>Admin Panel</span>
        <ChevronRight size={12} className="text-gray-400" />
        <span className="text-gray-500">Loan Management</span>
        <ChevronRight size={12} className="text-gray-400" />
        <span>All Loans</span>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#E5E7EB] pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 tracking-wide font-outfit">Loan Ledger Directory</h2>
          <p className="text-gray-500 text-xs mt-1">Search, track, and manage all gold pledge loan accounts.</p>
        </div>
        <button
          onClick={() => router.push('/admin/loans/new')}
          className="flex items-center gap-2 px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-[#F8FAFC] text-xs font-bold rounded-lg transition shadow-lg shadow-[#2563EB]/10 w-full sm:w-auto justify-center"
        >
          <Plus size={14} />
          Create New Loan
        </button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          placeholder="Filter by Loan ID or Customer Name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-[#ffffff] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 text-sm rounded-lg pl-12 pr-4 py-3 outline-none transition"
        />
        <Search size={18} className="absolute left-4 top-3.5 text-gray-500" />
      </div>

      {/* Summary Stat Chips */}
      <div className="flex flex-wrap gap-3">
        {['Active', 'Due', 'Overdue', 'Closed'].map((s) => {
          const count = getLoansByStatus(s);
          return (
            <div
              key={s}
              className="flex items-center gap-2 px-3 py-1.5 bg-[#ffffff] border border-[#E5E7EB] rounded-lg text-xs"
            >
              <span className={`w-2 h-2 rounded-full ${
                s === 'Active' ? 'bg-emerald-600' : s === 'Due' ? 'bg-amber-400' : s === 'Overdue' ? 'bg-red-500' : 'bg-slate-400'
              }`} />
              <span className="text-gray-500">{s}:</span>
              <span className="text-gray-900 font-semibold">{count}</span>
            </div>
          );
        })}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#ffffff] border border-[#2563EB]/20 rounded-lg text-xs">
          <Coins size={12} className="text-[#2563EB]" />
          <span className="text-gray-500">Total Disbursed:</span>
          <span className="text-[#2563EB] font-bold">Rs. {getTotalDisbursed().toLocaleString()}</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-12 text-center text-gray-500 text-xs flex flex-col items-center gap-3">
            <div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin"></div>
            <span>Loading loan ledger...</span>
          </div>
        ) : loans.length === 0 ? (
          <div className="p-12 text-center text-gray-500 text-xs font-semibold">
            No loan accounts found
          </div>
        ) : (
          <div className="responsive-table-wrap">
          <table className="w-full text-left text-xs min-w-[600px]">
            <thead>
              <tr className="text-gray-400 uppercase tracking-wider border-b border-[#E5E7EB] bg-[#F8FAFC]/20">
                <th className="p-4 font-semibold">Loan ID</th>
                <th className="p-4 font-semibold">Customer Name</th>
                <th className="p-4 font-semibold">Loan Amount</th>
                <th className="p-4 font-semibold hidden md:table-cell">Interest Rate</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold hidden md:table-cell">Due Date</th>
                <th className="p-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB]/30">
              {loans.map((loan) => (
                <tr key={loan.id} className="text-gray-600 hover:bg-[#F3F4F6]/20 transition-all">
                  <td className="p-4 font-mono font-semibold text-[#2563EB]">{loan.loan_number}</td>
                  <td className="p-4 font-semibold text-gray-900">{loan.customer?.name || 'Customer'}</td>
                  <td className="p-4 font-semibold text-gray-900">Rs. {loan.principal_amount.toLocaleString()}</td>
                  <td className="p-4 hidden md:table-cell">{loan.interest_rate_apr.toFixed(1)}% APR</td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${statusColors[loan.status] || 'bg-slate-500/10 text-gray-500'}`}>
                      {loan.status}
                    </span>
                  </td>
                  <td className="p-4 text-gray-500 hidden md:table-cell">
                    {loan.maturity_date ? new Date(loan.maturity_date).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => router.push(`/admin/loans/${loan.id}`)}
                      className="p-2 rounded bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#2563EB] hover:text-gray-900 transition-all flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider ml-auto"
                    >
                      <Eye size={12} />
                      View Details
                      <ChevronRight size={10} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}
