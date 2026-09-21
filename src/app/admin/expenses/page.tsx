'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Receipt,
  Plus,
  History,
  FolderTree,
  TrendingDown,
  Calendar,
  Building2,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronRight,
  Download,
  Filter,
  ArrowUpRight,
  Eye,
  FileText,
} from 'lucide-react';
import { listExpenses, getExpenseCategories, updateExpenseStatus } from '@/lib/db/expenses';
import { getCurrentProfile } from '@/lib/auth';
import type { Expense, ExpenseCategory, Profile } from '@/types/database';

export default function ExpensesHubPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);

  // Selected Expense for Detail Modal
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

      const [expList, catList] = await Promise.all([
        listExpenses(),
        getExpenseCategories(),
      ]);

      setExpenses(expList);
      setCategories(catList);
    } catch (err) {
      console.error('Failed to load expenses data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute Metrics
  const todayStr = new Date().toISOString().split('T')[0];
  const currentMonthStr = todayStr.slice(0, 7);

  const todayExpenses = expenses.filter(
    (e) => e.date === todayStr && (e.status === 'Posted' || e.status === 'Approved')
  );
  const todayTotal = todayExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  const monthExpenses = expenses.filter(
    (e) => (e.date || '').startsWith(currentMonthStr) && (e.status === 'Posted' || e.status === 'Approved')
  );
  const monthTotal = monthExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  const pendingExpenses = expenses.filter((e) => e.status === 'Pending Approval');
  const pendingTotal = pendingExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  // Category breakdown for current month
  const categoryTotals = new Map<string, number>();
  monthExpenses.forEach((e) => {
    const cat = e.category || 'Other';
    categoryTotals.set(cat, (categoryTotals.get(cat) || 0) + (e.amount || 0));
  });

  const handleApprove = async (expId: string) => {
    if (!profile) return;
    setActionLoading(true);
    try {
      await updateExpenseStatus(expId, 'Posted', {
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

  const handleCancel = async (expId: string) => {
    if (!profile) return;
    const reason = prompt('Enter reason for cancelling this expense:');
    if (!reason) return;
    setActionLoading(true);
    try {
      await updateExpenseStatus(
        expId,
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

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header & Quick Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2 text-rose-700 text-xs font-bold uppercase tracking-wider">
            <Receipt size={16} />
            <span>Financial ERP • Operations</span>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight mt-1">
            Office &amp; Operational Expenses
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Record, approve, and track salary, rent, utilities, stationery, maintenance, and administrative expenses.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/admin/expenses/new"
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-all"
          >
            <Plus size={15} />
            <span>Record Expense</span>
          </Link>

          <Link
            href="/admin/expenses/history"
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 shadow-2xs transition-all"
          >
            <History size={14} />
            <span>Expense History</span>
          </Link>

          <Link
            href="/admin/expenses/categories"
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 shadow-2xs transition-all"
          >
            <FolderTree size={14} />
            <span>Categories</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Today's Expense */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Today&apos;s Expenses
            </span>
            <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
              <Calendar size={18} />
            </div>
          </div>
          <div className="mt-2 font-extrabold text-2xl font-mono text-gray-900">
            {formatINR(todayTotal)}
          </div>
          <div className="mt-1 text-[11px] text-gray-500">
            {todayExpenses.length} transaction{todayExpenses.length === 1 ? '' : 's'} today
          </div>
        </div>

        {/* Card 2: This Month's Total */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              This Month&apos;s Total
            </span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <TrendingDown size={18} />
            </div>
          </div>
          <div className="mt-2 font-extrabold text-2xl font-mono text-rose-700">
            {formatINR(monthTotal)}
          </div>
          <div className="mt-1 text-[11px] text-gray-500">
            {monthExpenses.length} posted expense{monthExpenses.length === 1 ? '' : 's'}
          </div>
        </div>

        {/* Card 3: Pending Approvals */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Pending Approvals
            </span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Clock size={18} />
            </div>
          </div>
          <div className="mt-2 font-extrabold text-2xl font-mono text-amber-600">
            {pendingExpenses.length}
          </div>
          <div className="mt-1 text-[11px] text-gray-500 font-mono">
            Amount: {formatINR(pendingTotal)}
          </div>
        </div>

        {/* Card 4: Total Categories */}
        <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Expense Heads
            </span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <FolderTree size={18} />
            </div>
          </div>
          <div className="mt-2 font-extrabold text-2xl font-mono text-gray-900">
            {categories.length}
          </div>
          <div className="mt-1 text-[11px] text-gray-500">
            Active operational categories
          </div>
        </div>
      </div>

      {/* Monthly Category Breakdown */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs space-y-3">
        <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
          <span>This Month&apos;s Expense Distribution by Head</span>
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {categories.map((cat) => {
            const amt = categoryTotals.get(cat.name) || 0;
            return (
              <div
                key={cat.id}
                className="p-3.5 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-rose-50/30 transition-colors"
              >
                <span className="text-[11px] font-bold text-gray-600 block truncate" title={cat.name}>
                  {cat.name}
                </span>
                <span className="font-extrabold font-mono text-sm text-gray-900 mt-1 block">
                  {formatINR(amt)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent 10 Expenses Table */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-900">Recent Expense Entries</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Latest operational expenses recorded across office branches.
            </p>
          </div>
          <Link
            href="/admin/expenses/history"
            className="text-xs font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1"
          >
            <span>View All</span>
            <ChevronRight size={14} />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase">
              <tr>
                <th className="p-3.5 pl-5">Expense #</th>
                <th className="p-3.5">Date</th>
                <th className="p-3.5">Category / Head</th>
                <th className="p-3.5">Description</th>
                <th className="p-3.5 text-right">Amount (₹)</th>
                <th className="p-3.5">Payment Mode</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-center pr-5">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-400">
                    Loading expenses...
                  </td>
                </tr>
              ) : expenses.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-400">
                    No expense entries found. Click &quot;Record Expense&quot; to add one.
                  </td>
                </tr>
              ) : (
                expenses.slice(0, 10).map((item) => (
                  <tr key={item.id} className="hover:bg-rose-50/20 transition-colors">
                    <td className="p-3.5 pl-5 font-mono font-bold text-rose-700">
                      {item.expense_number}
                    </td>
                    <td className="p-3.5 text-gray-600 font-mono">{item.date}</td>
                    <td className="p-3.5 font-bold text-gray-900">
                      <span>{item.category}</span>
                      {item.subcategory && (
                        <span className="text-[10px] text-gray-400 block font-normal">
                          {item.subcategory}
                        </span>
                      )}
                    </td>
                    <td className="p-3.5 text-gray-700 max-w-[200px] truncate" title={item.description}>
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
                    <td className="p-3.5 text-center pr-5">
                      <button
                        onClick={() => setSelectedExpense(item)}
                        className="px-2.5 py-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Expense Detail Modal */}
      {selectedExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-rose-600 tracking-wider block">
                  Expense Particulars
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
                <span className="text-gray-400 block text-[10px] uppercase font-semibold">Category (Head)</span>
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
                <span className="text-gray-400 block text-[10px] uppercase font-semibold">Account Credited</span>
                <span className="text-gray-700">{selectedExpense.account}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-semibold">Vendor / Payee</span>
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

            {/* Actions in Modal */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
              {selectedExpense.status === 'Pending Approval' && (profile?.role === 'Admin' || profile?.role === 'Owner' || profile?.role === 'Manager') && (
                <button
                  onClick={() => handleApprove(selectedExpense.id)}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs disabled:opacity-50"
                >
                  {actionLoading ? 'Approving...' : 'Approve & Post to Ledger'}
                </button>
              )}

              {(selectedExpense.status === 'Posted' || selectedExpense.status === 'Approved') && (profile?.role === 'Admin' || profile?.role === 'Owner') && (
                <button
                  onClick={() => handleCancel(selectedExpense.id)}
                  disabled={actionLoading}
                  className="px-3.5 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold rounded-xl text-xs disabled:opacity-50"
                >
                  {actionLoading ? 'Cancelling...' : 'Cancel & Reverse JV'}
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
