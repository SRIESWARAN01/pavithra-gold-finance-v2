'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  FolderTree,
  ArrowLeft,
  Plus,
  Edit2,
  CheckCircle2,
  AlertCircle,
  FolderPlus,
  Tag,
  Save,
} from 'lucide-react';
import { getExpenseCategories, saveExpenseCategory } from '@/lib/db/expenses';
import { getCurrentProfile } from '@/lib/auth';
import type { ExpenseCategory, Profile } from '@/types/database';

export default function ExpenseCategoriesPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);

  // New Category Form Modal
  const [showModal, setShowModal] = useState(false);
  const [editCategory, setEditCategory] = useState<ExpenseCategory | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [subcategoriesText, setSubcategoriesText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const prof = await getCurrentProfile();
      setProfile(prof);
      setIsAdmin(prof?.role === 'Admin' || prof?.role === 'Owner');

      const list = await getExpenseCategories();
      setCategories(list);
    } catch (err) {
      console.error('Failed to load expense categories:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const handleOpenNew = () => {
    setEditCategory(null);
    setCategoryName('');
    setSubcategoriesText('');
    setError(null);
    setShowModal(true);
  };

  const handleOpenEdit = (cat: ExpenseCategory) => {
    setEditCategory(cat);
    setCategoryName(cat.name);
    setSubcategoriesText(cat.subcategories.join(', '));
    setError(null);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryName.trim()) {
      setError('Category name is required.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const subs = subcategoriesText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      await saveExpenseCategory({
        id: editCategory?.id,
        name: categoryName.trim(),
        subcategories: subs,
      });

      setShowModal(false);
      await loadCategories();
    } catch (err: any) {
      console.error('Error saving category:', err);
      setError(err.message || 'Failed to save category.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-gray-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/expenses"
            className="p-2 rounded-xl bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors shadow-2xs"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2">
              Expense Categories &amp; Heads
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Manage operational expense heads and subcategories for accurate financial ledger grouping.
            </p>
          </div>
        </div>

        {isAdmin && (
          <button
            onClick={handleOpenNew}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-all"
          >
            <Plus size={15} />
            <span>Add Category</span>
          </button>
        )}
      </div>

      {/* Category Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-3 p-12 text-center text-xs text-gray-400">
            Loading expense heads...
          </div>
        ) : (
          categories.map((cat) => (
            <div
              key={cat.id}
              className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-xs space-y-3 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-900 text-sm">{cat.name}</span>
                  {isAdmin && (
                    <button
                      onClick={() => handleOpenEdit(cat)}
                      className="p-1 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      title="Edit Category"
                    >
                      <Edit2 size={13} />
                    </button>
                  )}
                </div>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {cat.subcategories.map((sub, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-100 text-[11px] font-medium text-gray-700"
                    >
                      <Tag size={10} className="text-gray-400" />
                      {sub}
                    </span>
                  ))}
                </div>
              </div>
              <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
                <span>{cat.subcategories.length} subcategories</span>
                <span className="font-mono text-emerald-600 font-semibold">Active</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add / Edit Category Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-gray-900">
                {editCategory ? 'Edit Expense Head' : 'New Expense Head'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 uppercase mb-1">
                  Category Name (Expense Head) *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Legal &amp; Audit Fees"
                  value={categoryName}
                  onChange={(e) => setCategoryName(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 font-semibold"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-gray-700 uppercase mb-1">
                  Subcategories (Comma separated)
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Lawyer Consultation, Court Stamp, Document Franking"
                  value={subcategoriesText}
                  onChange={(e) => setSubcategoriesText(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                />
                <span className="text-[10px] text-gray-400 mt-1 block">
                  Separate multiple subcategories with a comma (,).
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Save size={14} />
                  <span>{saving ? 'Saving...' : 'Save Category'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
