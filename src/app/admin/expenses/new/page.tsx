'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Receipt,
  ArrowLeft,
  Calendar,
  DollarSign,
  Building2,
  CheckCircle2,
  AlertCircle,
  FileText,
  Upload,
  User,
  CreditCard,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { createExpense, getExpenseCategories } from '@/lib/db/expenses';
import { listBranches } from '@/lib/db/branches';
import { getCurrentProfile } from '@/lib/auth';
import type { ExpenseCategory, Branch, Profile, ExpensePaymentMode } from '@/types/database';

export default function NewExpensePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);

  // Form State
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState<string>('');
  const [subcategory, setSubcategory] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<ExpensePaymentMode>('Cash');
  const [account, setAccount] = useState<string>('Vault Petty Cash');
  const [transactionRef, setTransactionRef] = useState<string>('');
  const [vendorName, setVendorName] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [invoiceDate, setInvoiceDate] = useState<string>('');
  const [supportingDocUrl, setSupportingDocUrl] = useState<string>('');
  const [branchId, setBranchId] = useState<string>('');
  const [directApprove, setDirectApprove] = useState<boolean>(true);

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  useEffect(() => {
    async function init() {
      try {
        const prof = await getCurrentProfile();
        setProfile(prof);
        const adminRole = prof?.role === 'Admin' || prof?.role === 'Owner';
        setIsAdmin(adminRole);

        const [catList, brList] = await Promise.all([
          getExpenseCategories(),
          listBranches(),
        ]);

        setCategories(catList);
        if (catList.length > 0) {
          setCategory(catList[0].name);
          if (catList[0].subcategories && catList[0].subcategories.length > 0) {
            setSubcategory(catList[0].subcategories[0]);
          }
        }

        setBranches(brList);
        if (prof?.branch_id) {
          setBranchId(prof.branch_id);
        } else if (brList.length > 0) {
          setBranchId(brList[0].id);
        }
      } catch (err) {
        console.error('Error initializing expense entry:', err);
      }
    }
    init();
  }, []);

  // Update subcategories when category changes
  const handleCategoryChange = (catName: string) => {
    setCategory(catName);
    const selected = categories.find((c) => c.name === catName);
    if (selected && selected.subcategories && selected.subcategories.length > 0) {
      setSubcategory(selected.subcategories[0]);
    } else {
      setSubcategory('');
    }
  };

  // Update default account when payment mode changes
  const handlePaymentModeChange = (mode: ExpensePaymentMode) => {
    setPaymentMode(mode);
    if (mode === 'Cash') {
      setAccount('Vault Petty Cash');
    } else {
      setAccount('Bank Clearing Account');
    }
  };

  const currentCategory = categories.find((c) => c.name === category);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      setError('Please enter a valid expense amount greater than 0.');
      return;
    }

    if (!description.trim()) {
      setError('Description / remarks are required.');
      return;
    }

    setSubmitting(true);
    try {
      const selectedBranch = branches.find((b) => b.id === branchId);

      await createExpense(
        {
          date,
          category,
          subcategory,
          description: description.trim(),
          amount: amt,
          payment_mode: paymentMode,
          account,
          transaction_ref: transactionRef.trim() || undefined,
          vendor_name: vendorName.trim() || undefined,
          invoice_number: invoiceNumber.trim() || undefined,
          invoice_date: invoiceDate || undefined,
          supporting_doc_url: supportingDocUrl.trim() || undefined,
          branch_id: branchId || undefined,
          branch_name: selectedBranch?.name || undefined,
          created_by: profile?.id || 'staff',
          created_by_name: profile?.name || 'Staff Member',
        },
        isAdmin && directApprove
      );

      setSuccess(true);
      setTimeout(() => {
        router.push('/admin/expenses');
      }, 1200);
    } catch (err: any) {
      console.error('Failed to create expense:', err);
      setError(err.message || 'Failed to save expense entry. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* Back Button & Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/expenses"
            className="p-2 rounded-xl bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors shadow-2xs"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
              Record Office Expense
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Enter operational expenses to automatically update expense ledgers, Cash/Bank books, and Profit &amp; Loss.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-rose-800 text-xs">
          <AlertCircle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-emerald-800 text-xs font-bold">
          <CheckCircle2 size={18} className="shrink-0" />
          <span>Expense successfully saved and posted to accounting ledger! Redirecting...</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-6 space-y-5">
          <div className="pb-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
              Expense Particulars
            </h2>
            <span className="text-xs text-gray-400 font-mono">
              Auto-Generated: PGF-EXP-XXXXXX
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-xs">
            {/* Expense Date */}
            <div>
              <label className="block font-bold text-gray-700 uppercase mb-1.5">
                Expense Date *
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-mono focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                required
              />
            </div>

            {/* Expense Head / Category */}
            <div>
              <label className="block font-bold text-gray-700 uppercase mb-1.5">
                Expense Head (Category) *
              </label>
              <select
                value={category}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 font-semibold"
                required
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Sub-Category */}
            <div>
              <label className="block font-bold text-gray-700 uppercase mb-1.5">
                Sub-Category
              </label>
              {currentCategory && currentCategory.subcategories?.length > 0 ? (
                <select
                  value={subcategory}
                  onChange={(e) => setSubcategory(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                >
                  {currentCategory.subcategories.map((sub, idx) => (
                    <option key={idx} value={sub}>
                      {sub}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="e.g. General"
                  value={subcategory}
                  onChange={(e) => setSubcategory(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                />
              )}
            </div>

            {/* Amount */}
            <div>
              <label className="block font-bold text-gray-700 uppercase mb-1.5">
                Amount (₹) *
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-mono font-bold text-rose-700 text-sm focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                required
              />
            </div>

            {/* Payment Mode */}
            <div>
              <label className="block font-bold text-gray-700 uppercase mb-1.5">
                Payment Mode *
              </label>
              <select
                value={paymentMode}
                onChange={(e: any) => handlePaymentModeChange(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                required
              >
                <option value="Cash">Cash</option>
                <option value="Bank Transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
                <option value="UPI">UPI / GPay / PhonePe</option>
                <option value="Cheque">Cheque</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Account Credited */}
            <div>
              <label className="block font-bold text-gray-700 uppercase mb-1.5">
                Cash / Bank Account
              </label>
              <input
                type="text"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-gray-700"
              />
            </div>

            {/* Transaction Ref / Cheque # */}
            <div>
              <label className="block font-bold text-gray-700 uppercase mb-1.5">
                Transaction Ref / Cheque #
              </label>
              <input
                type="text"
                placeholder="e.g. UTR-998822 / CHQ-1002"
                value={transactionRef}
                onChange={(e) => setTransactionRef(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-mono focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>

            {/* Vendor / Payee Name */}
            <div>
              <label className="block font-bold text-gray-700 uppercase mb-1.5">
                Vendor / Payee Name
              </label>
              <input
                type="text"
                placeholder="e.g. Tamil Nadu Electricity Board, Landlord Name..."
                value={vendorName}
                onChange={(e) => setVendorName(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>

            {/* Branch */}
            <div>
              <label className="block font-bold text-gray-700 uppercase mb-1.5">
                Branch *
              </label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                disabled={!isAdmin}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 disabled:cursor-not-allowed"
                required
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Bill / Invoice # */}
            <div>
              <label className="block font-bold text-gray-700 uppercase mb-1.5">
                Bill / Invoice Number
              </label>
              <input
                type="text"
                placeholder="e.g. INV-2026-99"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-mono focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>

            {/* Bill Date */}
            <div>
              <label className="block font-bold text-gray-700 uppercase mb-1.5">
                Bill Date
              </label>
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-mono focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>

            {/* Supporting Document URL */}
            <div>
              <label className="block font-bold text-gray-700 uppercase mb-1.5">
                Supporting Document URL
              </label>
              <input
                type="text"
                placeholder="Link to bill / receipt scan / PDF"
                value={supportingDocUrl}
                onChange={(e) => setSupportingDocUrl(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl font-mono focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>

            {/* Description / Remarks */}
            <div className="sm:col-span-2 md:col-span-3">
              <label className="block font-bold text-gray-700 uppercase mb-1.5">
                Description / Purpose of Expense *
              </label>
              <textarea
                rows={2}
                placeholder="Detailed reason for expense, voucher details, or approval notes..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                required
              />
            </div>
          </div>

          {/* Admin Direct Sanction Toggle */}
          {isAdmin && (
            <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-emerald-600" />
                <div>
                  <span className="text-xs font-bold text-gray-900 block">
                    Direct Admin Approval &amp; Ledger Posting
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Immediately post to accounting ledger (Dr: {category || 'Expense'}, Cr: {account}).
                  </span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={directApprove}
                onChange={(e) => setDirectApprove(e.target.checked)}
                className="w-4 h-4 text-rose-600 rounded focus:ring-rose-500 cursor-pointer"
              />
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3">
          <Link
            href="/admin/expenses"
            className="px-5 py-2.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs hover:shadow transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Saving Expense...</span>
              </>
            ) : (
              <>
                <Check size={16} />
                <span>{isAdmin && directApprove ? 'Save & Post Expense' : 'Submit for Approval'}</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
