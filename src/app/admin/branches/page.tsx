'use client';

import React, { useState, useEffect, useTransition } from 'react';
import {
  ChevronRight, Building2, Plus, BarChart3, Users, Coins,
  TrendingUp, MapPin, Phone, Eye, Settings, CheckCircle2,
  Trash2, Edit3, X, Loader2, Mail, ShieldCheck, AlertCircle,
  Sparkles, RefreshCw
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, getDoc, where, query } from 'firebase/firestore';
import { createBranch, updateBranch, deleteBranch, listBranches, type BranchInsert } from '@/lib/db/branches';
import type { Branch } from '@/types/database';

export interface BranchWithMetrics extends Branch {
  status: string;
  employees: number;
  manager: string;
  revenue: number;
  expenses: number;
  activeLoans: number;
  customers: number;
  goldWeight: number;
  goldValue: number;
  totalPrincipal: number;
  collection: number;
  city?: string;
  email?: string;
}

export default function BranchManagement() {
  const [activeTab, setActiveTab] = useState<'master' | 'dashboard' | 'comparison'>('master');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingBranch, setEditingBranch] = useState<BranchWithMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [branches, setBranches] = useState<BranchWithMetrics[]>([]);

  // Form State
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formManager, setFormManager] = useState('');

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadBranches = async () => {
    setLoading(true);
    try {
      const branchesSnap = await getDocs(collection(db, 'branches'));
      
      // If no branches exist, seed default Head Office
      if (branchesSnap.empty) {
        await createBranch({
          name: 'Madurai Main Headquarters',
          code: 'MDU-01',
          address: '45, Temple Street, Madurai',
          city: 'Madurai',
          phone: '9998887776',
          email: 'contact@pavithragold.com',
          manager: 'Senior Operations Manager',
          is_active: true
        });
      }

      const freshSnap = await getDocs(collection(db, 'branches'));
      const branchesData: BranchWithMetrics[] = [];

      // Pre-fetch all loans, payments, profiles for efficient in-memory metric aggregation
      const [allLoansSnap, allProfilesSnap] = await Promise.all([
        getDocs(collection(db, 'loans')).catch(() => ({ docs: [] as any[] })),
        getDocs(collection(db, 'profiles')).catch(() => ({ docs: [] as any[] }))
      ]);

      const allLoans = allLoansSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const allProfiles = allProfilesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      for (const d of freshSnap.docs) {
        const raw = d.data() as any;
        const branchId = d.id;

        // Match loans
        const branchLoans = allLoans.filter(l => l.branch_id === branchId || (!l.branch_id && branchId === freshSnap.docs[0].id));
        let activeLoans = 0;
        let totalPrincipal = 0;
        let totalCollection = 0;
        let goldWeight = 0;
        let goldValue = 0;

        for (const loan of branchLoans) {
          if (['Active', 'Due', 'Overdue', 'Grace_Period'].includes(loan.status)) {
            activeLoans++;
            totalPrincipal += loan.principal_amount || 0;
          }
          totalCollection += (loan.total_principal_paid || 0) + (loan.total_interest_paid || 0);
        }

        // Match profiles
        const branchCusts = allProfiles.filter(p => p.role === 'Customer' && (p.branch_id === branchId || (!p.branch_id && branchId === freshSnap.docs[0].id)));
        const branchStaff = allProfiles.filter(p => p.role !== 'Customer' && (p.branch_id === branchId || (!p.branch_id && branchId === freshSnap.docs[0].id)));

        const revenue = totalCollection * 0.18; // Est yield
        const expenses = Math.max(branchStaff.length, 1) * 30000 + 45000;

        branchesData.push({
          id: branchId,
          name: raw.name || 'Branch Office',
          code: raw.code || 'B-01',
          address: raw.address || 'Address',
          city: raw.city || 'Tamil Nadu',
          phone: raw.phone || '9998887776',
          email: raw.email || 'branch@pavithragold.com',
          is_active: raw.is_active !== false,
          created_at: raw.created_at || new Date().toISOString(),
          updated_at: raw.updated_at || new Date().toISOString(),
          status: raw.is_active !== false ? 'Active' : 'Inactive',
          employees: Math.max(branchStaff.length, 1),
          manager: raw.manager || 'Branch Manager',
          revenue,
          expenses,
          activeLoans,
          customers: branchCusts.length,
          goldWeight: goldWeight || (activeLoans * 24.5),
          goldValue: goldValue || (totalPrincipal * 1.35),
          totalPrincipal,
          collection: totalCollection,
        });
      }

      // Sort by Name
      branchesData.sort((a, b) => a.name.localeCompare(b.name));
      setBranches(branchesData);
    } catch (err) {
      console.error('Failed to load branches:', err);
      showToast('Error loading branch directory', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBranches();
  }, []);

  const handleSaveBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      showToast('Branch name is required', 'error');
      return;
    }

    setSaving(true);
    try {
      if (editingBranch) {
        await updateBranch(editingBranch.id, {
          name: formName.trim(),
          code: formCode.trim().toUpperCase() || editingBranch.code,
          address: formAddress.trim(),
          city: formCity.trim(),
          phone: formPhone.trim(),
          email: formEmail.trim(),
          manager: formManager.trim() || 'Branch Manager',
        });
        showToast(`Branch "${formName}" updated successfully!`);
      } else {
        await createBranch({
          name: formName.trim(),
          code: formCode.trim().toUpperCase(),
          address: formAddress.trim(),
          city: formCity.trim(),
          phone: formPhone.trim(),
          email: formEmail.trim(),
          manager: formManager.trim() || 'Branch Manager',
          is_active: true,
        });
        showToast(`Branch "${formName}" added successfully!`);
      }

      // Reset form
      setFormName('');
      setFormCode('');
      setFormAddress('');
      setFormCity('');
      setFormPhone('');
      setFormEmail('');
      setFormManager('');
      setShowAddForm(false);
      setEditingBranch(null);
      await loadBranches();
    } catch (err: any) {
      console.error('Error saving branch:', err);
      showToast(err.message || 'Failed to save branch.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleEditClick = (b: BranchWithMetrics) => {
    setEditingBranch(b);
    setFormName(b.name);
    setFormCode(b.code);
    setFormAddress(b.address || '');
    setFormCity(b.city || '');
    setFormPhone(b.phone || '');
    setFormEmail(b.email || '');
    setFormManager(b.manager || '');
    setShowAddForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleStatus = async (branch: BranchWithMetrics) => {
    try {
      const newActive = branch.status !== 'Active';
      await updateBranch(branch.id, { is_active: newActive });
      showToast(`Branch ${branch.name} is now ${newActive ? 'Active' : 'Inactive'}`);
      await loadBranches();
    } catch (err) {
      showToast('Failed to update branch status', 'error');
    }
  };

  const handleDelete = async (branchId: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete branch "${name}"?`)) return;
    try {
      await deleteBranch(branchId);
      showToast(`Branch "${name}" deleted.`);
      await loadBranches();
    } catch (err) {
      showToast('Failed to delete branch', 'error');
    }
  };

  const activeBranches = branches.filter((b) => b.is_active !== false);

  const totalMetrics = branches.reduce(
    (acc, b) => ({
      totalLoans: acc.totalLoans + b.activeLoans,
      totalCustomers: acc.totalCustomers + b.customers,
      totalPrincipal: acc.totalPrincipal + b.totalPrincipal,
      totalCollection: acc.totalCollection + b.collection,
      totalRevenue: acc.totalRevenue + b.revenue,
      totalGoldWeight: acc.totalGoldWeight + b.goldWeight,
      totalGoldValue: acc.totalGoldValue + b.goldValue,
    }),
    {
      totalLoans: 0,
      totalCustomers: 0,
      totalPrincipal: 0,
      totalCollection: 0,
      totalRevenue: 0,
      totalGoldWeight: 0,
      totalGoldValue: 0,
    }
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-xs font-semibold animate-slide-up ${
          notification.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
        }`}>
          {notification.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{notification.message}</span>
        </div>
      )}

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-[#2563EB] font-semibold tracking-wider uppercase">
        <span>Admin Panel</span>
        <ChevronRight size={12} className="text-gray-400" />
        <span className="text-gray-500">Management</span>
        <ChevronRight size={12} className="text-gray-400" />
        <span>Branch Management</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-[#E5E7EB] pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 tracking-wide font-outfit flex items-center gap-2">
            <Building2 className="text-[#2563EB]" size={24} />
            Multi-Branch Management
          </h2>
          <p className="text-gray-500 text-xs mt-1">Manage physical branches, local managers, capital allocation, and consolidated yield.</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => loadBranches()}
            disabled={loading}
            className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition"
            title="Refresh"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => {
              if (showAddForm && editingBranch) {
                setEditingBranch(null);
                setFormName('');
                setFormCode('');
                setFormAddress('');
                setFormCity('');
                setFormPhone('');
                setFormEmail('');
                setFormManager('');
              } else {
                setShowAddForm(!showAddForm);
              }
            }}
            className="flex items-center gap-2 px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-[#F8FAFC] text-xs font-bold rounded-lg transition shadow-lg shadow-[#2563EB]/10 flex-1 sm:flex-none justify-center"
          >
            <Plus size={14} /> {showAddForm ? 'Close Form' : 'Add Branch'}
          </button>
        </div>
      </div>

      {/* Consolidated Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {[
          { label: 'Active Branches', value: activeBranches.length, icon: Building2, color: 'text-blue-600' },
          { label: 'Total Active Loans', value: totalMetrics.totalLoans, icon: Coins, color: 'text-amber-600' },
          { label: 'Total Customers', value: totalMetrics.totalCustomers, icon: Users, color: 'text-indigo-600' },
          { label: 'Deployed Capital', value: `₹${(totalMetrics.totalPrincipal / 100000).toFixed(1)}L`, icon: TrendingUp, color: 'text-emerald-600' },
          { label: 'Total Collection', value: `₹${(totalMetrics.totalCollection / 100000).toFixed(1)}L`, icon: BarChart3, color: 'text-purple-600' },
          { label: 'Gold Custody', value: `${totalMetrics.totalGoldWeight.toFixed(1)}g`, icon: ShieldCheck, color: 'text-amber-700' },
        ].map((m, i) => (
          <div key={i} className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-4 shadow-sm hover:shadow-md transition">
            <div className="flex justify-between items-start mb-2">
              <m.icon size={18} className={m.color} />
            </div>
            <p className="text-xl font-bold text-gray-900 font-mono">{m.value}</p>
            <p className="text-[10px] font-medium text-gray-500 mt-0.5">{m.label}</p>
          </div>
        ))}
      </div>

      {/* Add / Edit Branch Form Modal / Accordion */}
      {showAddForm && (
        <form onSubmit={handleSaveBranch} className="bg-[#ffffff] border-2 border-[#2563EB]/30 rounded-2xl p-6 shadow-xl animate-slide-up space-y-4">
          <div className="flex justify-between items-center border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-[#2563EB]">
                <Building2 size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">{editingBranch ? `Edit Branch: ${editingBranch.name}` : 'Register New Branch'}</h3>
                <p className="text-[11px] text-gray-500">Configure physical branch location, assigned manager, and contact lines.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setEditingBranch(null);
              }}
              className="p-1 text-gray-400 hover:text-gray-700 rounded-md"
            >
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700">Branch Name <span className="text-red-500">*</span></label>
              <input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
                className="w-full bg-gray-50 border border-gray-200 focus:border-[#2563EB] focus:bg-white text-gray-900 text-sm rounded-lg px-3.5 py-2.5 outline-none transition"
                placeholder="e.g. Chennai T. Nagar Branch"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700">Branch Code <span className="text-gray-400 font-normal">(Optional, Auto-generated)</span></label>
              <input
                value={formCode}
                onChange={(e) => setFormCode(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 focus:border-[#2563EB] focus:bg-white text-gray-900 text-sm rounded-lg px-3.5 py-2.5 outline-none transition font-mono uppercase"
                placeholder="e.g. CHE-01"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700">City / Region</label>
              <input
                value={formCity}
                onChange={(e) => setFormCity(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 focus:border-[#2563EB] focus:bg-white text-gray-900 text-sm rounded-lg px-3.5 py-2.5 outline-none transition"
                placeholder="e.g. Chennai"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700">Branch Manager</label>
              <input
                value={formManager}
                onChange={(e) => setFormManager(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 focus:border-[#2563EB] focus:bg-white text-gray-900 text-sm rounded-lg px-3.5 py-2.5 outline-none transition"
                placeholder="e.g. R. Subramanian"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700">Phone Number</label>
              <input
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 focus:border-[#2563EB] focus:bg-white text-gray-900 text-sm rounded-lg px-3.5 py-2.5 outline-none transition"
                placeholder="e.g. 9876543210"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700">Branch Email</label>
              <input
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                type="email"
                className="w-full bg-gray-50 border border-gray-200 focus:border-[#2563EB] focus:bg-white text-gray-900 text-sm rounded-lg px-3.5 py-2.5 outline-none transition"
                placeholder="e.g. chennai@pavithragold.com"
              />
            </div>

            <div className="md:col-span-3 space-y-1.5">
              <label className="text-xs font-semibold text-gray-700">Full Address</label>
              <input
                value={formAddress}
                onChange={(e) => setFormAddress(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 focus:border-[#2563EB] focus:bg-white text-gray-900 text-sm rounded-lg px-3.5 py-2.5 outline-none transition"
                placeholder="Street address, building, landmark, pincode"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold rounded-lg transition shadow-md disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              {editingBranch ? 'Update Branch' : 'Save & Activate Branch'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setEditingBranch(null);
              }}
              className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Tabs */}
      <div className="flex border-b border-[#E5E7EB] text-xs">
        {[
          { key: 'master', label: `Branch Directory (${branches.length})` },
          { key: 'dashboard', label: 'Branch Dashboards' },
          { key: 'comparison', label: 'Performance & Capital Comparison' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-5 py-2.5 font-bold font-outfit transition-all ${
              activeTab === tab.key ? 'text-[#2563EB] border-b-2 border-[#2563EB]' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Branch Directory */}
      {activeTab === 'master' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {branches.map(branch => (
            <div
              key={branch.id}
              className={`bg-[#ffffff] border rounded-2xl p-5 space-y-4 shadow-sm hover:shadow-md transition-all ${
                branch.status === 'Active' ? 'border-[#E5E7EB] hover:border-[#2563EB]/40' : 'border-[#E5E7EB] opacity-60 bg-gray-50'
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-gray-900">{branch.name}</h4>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      branch.status === 'Active' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-gray-200 text-gray-600'
                    }`}>
                      {branch.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 font-mono mt-0.5">{branch.code} • {branch.city}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleEditClick(branch)}
                    className="p-1.5 text-gray-500 hover:text-[#2563EB] hover:bg-blue-50 rounded-md transition"
                    title="Edit Branch"
                  >
                    <Edit3 size={14} />
                  </button>
                  <button
                    onClick={() => handleToggleStatus(branch)}
                    className={`px-2 py-1 text-[10px] font-bold rounded transition ${
                      branch.status === 'Active' ? 'text-amber-700 bg-amber-50 hover:bg-amber-100' : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                    }`}
                  >
                    {branch.status === 'Active' ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => handleDelete(branch.id, branch.name)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition"
                    title="Delete Branch"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="space-y-1 text-[11px] text-gray-600 bg-gray-50/70 p-2.5 rounded-lg">
                <div className="flex items-center gap-2">
                  <MapPin size={12} className="text-gray-400 shrink-0" />
                  <span className="truncate">{branch.address || 'Address not configured'}</span>
                </div>
                <div className="flex items-center gap-4 text-gray-500">
                  <span className="flex items-center gap-1"><Phone size={11} /> {branch.phone || '—'}</span>
                  <span className="flex items-center gap-1"><Mail size={11} /> {branch.email || '—'}</span>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <div className="bg-[#F3F4F6] rounded-lg p-2 text-center">
                  <p className="text-[10px] text-gray-500">Staff</p>
                  <p className="text-sm font-bold text-gray-900">{branch.employees}</p>
                </div>
                <div className="bg-[#F3F4F6] rounded-lg p-2 text-center">
                  <p className="text-[10px] text-gray-500">Loans</p>
                  <p className="text-sm font-bold text-gray-900">{branch.activeLoans}</p>
                </div>
                <div className="bg-[#F3F4F6] rounded-lg p-2 text-center">
                  <p className="text-[10px] text-gray-500">Customers</p>
                  <p className="text-sm font-bold text-gray-900">{branch.customers}</p>
                </div>
                <div className="bg-[#F3F4F6] rounded-lg p-2 text-center">
                  <p className="text-[10px] text-gray-500">Capital</p>
                  <p className="text-xs font-bold text-gray-900 font-mono">₹{(branch.totalPrincipal / 100000).toFixed(1)}L</p>
                </div>
              </div>

              <div className="flex justify-between items-center pt-2 border-t border-[#E5E7EB]">
                <div>
                  <span className="text-[10px] text-gray-500">Manager: </span>
                  <span className="text-xs text-gray-900 font-medium">{branch.manager}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-gray-500">Revenue Yield: </span>
                  <span className="text-xs text-[#2563EB] font-bold font-mono">₹{(branch.revenue / 1000).toFixed(0)}K</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 2: Branch Dashboards */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {activeBranches.map(branch => (
            <div key={branch.id} className="bg-[#ffffff] border border-[#E5E7EB] rounded-2xl p-6 space-y-4 shadow-sm">
              <div className="flex justify-between items-center border-b border-[#E5E7EB] pb-3">
                <div>
                  <h4 className="text-sm font-bold text-gray-900">{branch.name}</h4>
                  <p className="text-[11px] text-gray-500">{branch.code} • Manager: {branch.manager} • {branch.phone}</p>
                </div>
                <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600">{branch.status}</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { label: 'Active Loans', value: branch.activeLoans },
                  { label: 'Customers', value: branch.customers },
                  { label: 'Deployed Capital', value: `₹${(branch.totalPrincipal / 100000).toFixed(1)}L` },
                  { label: 'Total Collection', value: `₹${(branch.collection / 100000).toFixed(1)}L` },
                  { label: 'Interest Yield', value: `₹${(branch.revenue / 1000).toFixed(0)}K` },
                  { label: 'Net Profit', value: `₹${((branch.revenue - branch.expenses) / 1000).toFixed(0)}K` },
                ].map((m, i) => (
                  <div key={i} className="bg-[#F3F4F6] rounded-xl p-3">
                    <p className="text-[10px] text-gray-500 font-medium">{m.label}</p>
                    <p className="text-base font-bold text-gray-900 mt-1 font-mono">{m.value}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 3: Performance Comparison */}
      {activeTab === 'comparison' && (
        <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-[#E5E7EB] bg-gray-50/50">
            <h3 className="text-sm font-bold text-[#2563EB]">Branch Financial & Recovery Performance Comparison</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-gray-400 uppercase tracking-wider border-b border-[#E5E7EB]/60 bg-gray-50/40">
                  <th className="px-4 py-3">Branch</th>
                  <th className="px-4 py-3">Staff</th>
                  <th className="px-4 py-3">Loans</th>
                  <th className="px-4 py-3">Customers</th>
                  <th className="px-4 py-3">Capital</th>
                  <th className="px-4 py-3">Collection</th>
                  <th className="px-4 py-3">Revenue</th>
                  <th className="px-4 py-3">Profit</th>
                  <th className="px-4 py-3">Recovery %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]/40">
                {activeBranches.sort((a, b) => b.revenue - a.revenue).map((b, i) => (
                  <tr key={b.id} className="text-gray-600 hover:bg-gray-50/50 transition">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className={`w-5 h-5 rounded-full inline-flex items-center justify-center text-[9px] font-bold ${
                          i === 0 ? 'bg-[#2563EB] text-white' : 'bg-[#F3F4F6] text-gray-500'
                        }`}>
                          {i + 1}
                        </span>
                        <div>
                          <span className="text-gray-900 font-semibold">{b.name}</span>
                          <span className="text-[10px] text-gray-400 font-mono ml-2">({b.code})</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">{b.employees}</td>
                    <td className="px-4 py-3.5 font-bold text-gray-900">{b.activeLoans}</td>
                    <td className="px-4 py-3.5">{b.customers}</td>
                    <td className="px-4 py-3.5 font-mono">₹{(b.totalPrincipal / 100000).toFixed(1)}L</td>
                    <td className="px-4 py-3.5 font-mono">₹{(b.collection / 100000).toFixed(1)}L</td>
                    <td className="px-4 py-3.5 font-mono text-[#2563EB] font-bold">₹{(b.revenue / 1000).toFixed(0)}K</td>
                    <td className="px-4 py-3.5 font-mono text-emerald-600 font-semibold">₹{((b.revenue - b.expenses) / 1000).toFixed(0)}K</td>
                    <td className="px-4 py-3.5">
                      <span className="text-emerald-600 font-bold">
                        {b.totalPrincipal > 0 ? ((b.collection / b.totalPrincipal) * 100).toFixed(0) : 0}%
                      </span>
                    </td>
                  </tr>
                ))}
                <tr className="text-gray-900 font-bold bg-blue-50/30 border-t-2 border-gray-200">
                  <td className="px-4 py-3.5">CONSOLIDATED TOTAL</td>
                  <td className="px-4 py-3.5">{branches.reduce((s, b) => s + b.employees, 0)}</td>
                  <td className="px-4 py-3.5">{totalMetrics.totalLoans}</td>
                  <td className="px-4 py-3.5">{totalMetrics.totalCustomers}</td>
                  <td className="px-4 py-3.5 font-mono">₹{(totalMetrics.totalPrincipal / 100000).toFixed(1)}L</td>
                  <td className="px-4 py-3.5 font-mono">₹{(totalMetrics.totalCollection / 100000).toFixed(1)}L</td>
                  <td className="px-4 py-3.5 font-mono text-[#2563EB]">₹{(totalMetrics.totalRevenue / 1000).toFixed(0)}K</td>
                  <td className="px-4 py-3.5 font-mono text-emerald-600">
                    ₹{((totalMetrics.totalRevenue - branches.reduce((s, b) => s + b.expenses, 0)) / 1000).toFixed(0)}K
                  </td>
                  <td className="px-4 py-3.5 text-emerald-600">
                    {totalMetrics.totalPrincipal > 0 ? ((totalMetrics.totalCollection / totalMetrics.totalPrincipal) * 100).toFixed(0) : 0}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
