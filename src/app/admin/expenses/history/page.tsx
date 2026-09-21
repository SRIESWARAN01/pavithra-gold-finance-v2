'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Receipt,
  ArrowLeft,
  Search,
  Filter,
  Download,
  Printer,
  Calendar,
  Building2,
  CheckCircle2,
  AlertCircle,
  FileText,
  ExternalLink,
  ChevronRight,
  Eye,
  RefreshCw,
  Plus,
} from 'lucide-react';
import { listExpenses, getExpenseCategories, updateExpenseStatus } from '@/lib/db/expenses';
import { listBranches } from '@/lib/db/branches';
import { getCurrentProfile } from '@/lib/auth';
import type { Expense, ExpenseCategory, Branch, Profile, ExpenseStatus } from '@/types/database';

export default function ExpenseHistoryPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [selectedMode, setSelectedMode] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Selected for Modal
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const formatINR = (val: number) => {
    return '₹ ' + (val || 0).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const prof = await getCurrentProfile();
      setProfile(prof);
      const adminRole = prof?.role === 'Admin' || prof?.role === 'Owner';
      setIsAdmin(adminRole);

      const [expList, catList, brList] = await Promise.all([
        listExpenses({
          category: selectedCategory !== 'all' ? selectedCategory : undefined,
          branchId: selectedBranch !== 'all' ? selectedBranch : undefined,
          paymentMode: selectedMode !== 'all' ? selectedMode : undefined,
          status: selectedStatus !== 'all' ? (selectedStatus as ExpenseStatus) : undefined,
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
          searchQuery: searchQuery || undefined,
        }),
        getExpenseCategories(),
        listBranches(),
      ]);

      setExpenses(expList);
      setCategories(catList);
      setBranches(brList);

      if (!adminRole && prof?.branch_id) {
        setSelectedBranch(prof.branch_id);
      }
    } catch (err) {
      console.error('Failed to load expense history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedCategory, selectedBranch, selectedMode, selectedStatus, fromDate, toDate]);

  // Handle Search submit
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  // Export to CSV
  const handleExportCSV = () => {
    let csv = 'data:text/csv;charset=utf-8,';
    csv += 'PAVITHRA GOLD FINANCE - EXPENSE REGISTER\r\n';
    csv += 'Date,Expense Number,Category,Subcategory,Description,Amount (INR),Payment Mode,Account,Vendor,Invoice Number,Branch,Status,Entered By\r\n';

    expenses.forEach((e) => {
      csv += `${e.date},${e.expense_number},"${e.category}","${e.subcategory || ''}","${(e.description || '').replace(/"/g, '""')}",${e.amount},${e.payment_mode},"${e.account}","${e.vendor_name || ''}","${e.invoice_number || ''}","${e.branch_name || ''}",${e.status},"${e.created_by_name}"\r\n`;
    });

    const encodedUri = encodeURI(csv);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `PGF_Expenses_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Status changes
  const handleApprove = async (id: string) => {
    if (!profile) return;
    setActionLoading(true);
    try {
      await updateExpenseStatus(id, 'Posted', {
        id: profile.id,
        name: profile.name,
        role: profile.role,
      });
      await loadData();
      setSelectedExpense(null);
    } catch (err: any) {
      alert(err.message || 'Failed to approve expense');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!profile) return;
    const reason = prompt('Reason for cancelling this expense:');
    if (!reason) return;
    setActionLoading(true);
    try {
      await updateExpenseStatus(
        id,
        'Cancelled',
        { id: profile.id, name: profile.name, role: profile.role },
        reason
      );
      await loadData();
      setSelectedExpense(null);
    } catch (err: any) {
      alert(err.message || 'Failed to cancel expense');
    } finally {
      setActionLoading(false);
    }
  };

  const totalAmount = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16 print:p-0 print:m-0 print:max-w-none">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs print:hidden">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/expenses"
            className="p-2 rounded-xl bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors shadow-2xs"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
              Expense History &amp; Register
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Complete chronological audit trail of all operational expenses and voucher records.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/admin/expenses/new"
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-all"
          >
            <Plus size={14} />
            <span>New Expense</span>
          </Link>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 shadow-2xs transition-all"
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 shadow-2xs transition-all"
          >
            <Printer size={14} />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-4 shadow-xs space-y-3 print:hidden">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
          {/* Search Query */}
          <div className="sm:col-span-2">
            <label className="block font-bold text-gray-600 uppercase mb-1">Search</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Expense #, vendor, description..."
                className="w-full pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block font-bold text-gray-600 uppercase mb-1">Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Branch */}
          <div>
            <label className="block font-bold text-gray-600 uppercase mb-1">Branch</label>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              disabled={!isAdmin}
              className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 disabled:cursor-not-allowed"
            >
              {isAdmin && <option value="all">All Branches</option>}
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Mode */}
          <div>
            <label className="block font-bold text-gray-600 uppercase mb-1">Payment Mode</label>
            <select
              value={selectedMode}
              onChange={(e) => setSelectedMode(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
            >
              <option value="all">All Modes</option>
              <option value="Cash">Cash</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="UPI">UPI</option>
              <option value="Cheque">Cheque</option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block font-bold text-gray-600 uppercase mb-1">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
            >
              <option value="all">All Statuses</option>
              <option value="Posted">Posted / Approved</option>
              <option value="Pending Approval">Pending Approval</option>
              <option value="Cancelled">Cancelled</option>
              <option value="Draft">Draft</option>
            </select>
          </div>

          {/* From Date */}
          <div>
            <label className="block font-bold text-gray-600 uppercase mb-1">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-hidden font-mono"
            />
          </div>

          {/* To Date */}
          <div>
            <label className="block font-bold text-gray-600 uppercase mb-1">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-hidden font-mono"
            />
          </div>
        </form>

        <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs text-gray-500">
          <span>
            Found <strong className="text-gray-900">{expenses.length}</strong> records • Total Amount:{' '}
            <strong className="text-rose-700 font-mono">{formatINR(totalAmount)}</strong>
          </span>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('all');
              setSelectedBranch(isAdmin ? 'all' : (profile?.branch_id || 'all'));
              setSelectedMode('all');
              setSelectedStatus('all');
              setFromDate('');
              setToDate('');
            }}
            className="text-xs text-blue-600 hover:underline font-semibold"
          >
            Reset Filters
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden print:border-none print:shadow-none">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase">
              <tr>
                <th className="p-3.5 pl-5">Date</th>
                <th className="p-3.5">Expense #</th>
                <th className="p-3.5">Category (Head)</th>
                <th className="p-3.5">Description</th>
                <th className="p-3.5 text-right">Amount (₹)</th>
                <th className="p-3.5">Payment Mode</th>
                <th className="p-3.5">Branch</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-center pr-5 print:hidden">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-10 text-center text-gray-400">
                    Loading expense records...
                  </td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-10 text-center text-gray-400">
                    No expense records matching the selected filters.
                  </td>
                </tr>
              ) : (
                expenses.map((item) => (
                  <tr key={item.id} className="hover:bg-rose-50/20 transition-colors">
                    <td className="p-3.5 pl-5 text-gray-600 font-mono">{item.date}</td>
                    <td className="p-3.5 font-mono font-bold text-rose-700">
                      {item.expense_number}
                    </td>
                    <td className="p-3.5 font-bold text-gray-900">
                      {item.category}
                      {item.subcategory && (
                        <span className="text-[10px] text-gray-400 block font-normal">
                          {item.subcategory}
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-gray-700 max-w-[220px] truncate" title={item.description}>
                      {item.description}
                    </td>
                    <td className="p-3.5 text-right font-mono font-bold text-gray-900 text-sm">
                      {formatINR(item.amount)}
                    </td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-gray-100 text-gray-800">
                        {item.payment_mode}
                      </span>
                    </td>
                    <td className="p-3.5 text-gray-600">{item.branch_name || 'Main Hub'}</td>
                    <td className="p-3.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          item.status === 'Posted' || item.status === 'Approved'
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.status === 'Pending Approval'
                            ? 'bg-amber-100 text-amber-800'
                            : item.status === 'Cancelled'
                            ? 'bg-gray-100 text-gray-600 line-through'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-center pr-5 print:hidden">
                      <button
                        onClick={() => setSelectedExpense(item)}
                        className="px-2.5 py-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {expenses.length > 0 && (
              <tfoot className="bg-gray-50 border-t-2 border-gray-200 font-bold text-gray-900">
                <tr>
                  <td colSpan={4} className="p-3.5 pl-5 text-right">
                    Total Filtered Expenses:
                  </td>
                  <td className="p-3.5 text-right font-mono text-sm text-rose-700 font-extrabold">
                    {formatINR(totalAmount)}
                  </td>
                  <td colSpan={4}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150 print:hidden">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-rose-600 tracking-wider block">
                  Expense Details
                </span>
                <h3 className="text-base font-bold text-gray-900 font-mono">
                  {selectedExpense.expense_number}
                </h3>
              </div>
              <button
                onClick={() => setSelectedExpense(null)}
                className="text-gray-400 hover:text-gray-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-semibold">Date</span>
                <span className="font-bold text-gray-900 font-mono">{selectedExpense.date}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-semibold">Amount</span>
                <span className="font-extrabold text-rose-700 font-mono text-sm">
                  {formatINR(selectedExpense.amount)}
                </span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-semibold">Category</span>
                <span className="font-bold text-gray-900">{selectedExpense.category}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-semibold">Sub-Category</span>
                <span className="text-gray-700">{selectedExpense.subcategory || '—'}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-semibold">Payment Mode</span>
                <span className="font-semibold text-gray-900">{selectedExpense.payment_mode}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-semibold">Account</span>
                <span className="text-gray-700">{selectedExpense.account}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-semibold">Vendor</span>
                <span className="text-gray-700">{selectedExpense.vendor_name || '—'}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-semibold">Invoice #</span>
                <span className="font-mono text-gray-700">{selectedExpense.invoice_number || '—'}</span>
              </div>
              <div className="col-span-2">
                <span className="text-gray-400 block text-[10px] uppercase font-semibold">Description</span>
                <span className="text-gray-900">{selectedExpense.description}</span>
              </div>
              {selectedExpense.supporting_doc_url && (
                <div className="col-span-2">
                  <span className="text-gray-400 block text-[10px] uppercase font-semibold">Supporting Document</span>
                  <a
                    href={selectedExpense.supporting_doc_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 hover:underline font-mono text-[11px] truncate block"
                  >
                    {selectedExpense.supporting_doc_url}
                  </a>
                </div>
              )}
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-semibold">Status</span>
                <span className="font-bold uppercase text-[11px]">{selectedExpense.status}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-semibold">Entered By</span>
                <span className="text-gray-700">{selectedExpense.created_by_name}</span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
              {selectedExpense.status === 'Pending Approval' && (isAdmin || profile?.role === 'Manager') && (
                <button
                  onClick={() => handleApprove(selectedExpense.id)}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs disabled:opacity-50"
                >
                  {actionLoading ? 'Approving...' : 'Approve & Post'}
                </button>
              )}

              {(selectedExpense.status === 'Posted' || selectedExpense.status === 'Approved') && isAdmin && (
                <button
                  onClick={() => handleCancel(selectedExpense.id)}
                  disabled={actionLoading}
                  className="px-3.5 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold rounded-xl text-xs disabled:opacity-50"
                >
                  {actionLoading ? 'Cancelling...' : 'Cancel & Reverse'}
                </button>
              )}

              <button
                onClick={() => setSelectedExpense(null)}
                className="px-4 py-2 border border-gray-200 text-gray-700 rounded-xl text-xs font-semibold hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
