'use client';

import React, { useState, useEffect } from 'react';
import {
  ChevronRight, UserCog, Search, Plus, Calendar, Clock, Award,
  DollarSign, Eye, CheckCircle2, AlertCircle, X, Loader2, RefreshCw,
  Phone, Mail, Building2, ShieldCheck, Trash2, Edit3
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc, query } from 'firebase/firestore';
import type { Profile } from '@/types/database';

export interface EmployeeWithStats extends Profile {
  phone: string;
  branch: string;
  attendance: number;
  lastLogin: string;
  salary: number;
  incentive: number;
  loansProcessed: number;
  collectionAmt: number;
}

interface LeaveRecord {
  employee: string;
  type: string;
  from: string;
  to: string;
  days: number;
  status: string;
  approvedBy?: string;
}

export default function EmployeeManagement() {
  const [activeTab, setActiveTab] = useState<'master' | 'attendance' | 'leave' | 'payroll' | 'performance'>('master');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState('All');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [employees, setEmployees] = useState<EmployeeWithStats[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);

  // Form State
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState('Manager');
  const [formBranch, setFormBranch] = useState('Madurai Main');
  const [formSalary, setFormSalary] = useState('45000');

  const [leaveRecords, setLeaveRecords] = useState<LeaveRecord[]>([]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const loadStaff = async () => {
    setLoading(true);
    try {
      // Query profiles without index-demanding where inequality + orderBy
      const profilesSnap = await getDocs(collection(db, 'profiles'));
      const branchesSnap = await getDocs(collection(db, 'branches')).catch(() => ({ docs: [] as any[] }));
      
      setBranches(branchesSnap.docs.map(b => ({ id: b.id, name: b.data().name || b.id })));

      const staffDocs = profilesSnap.docs.filter(d => {
        const r = d.data().role;
        return r && r !== 'Customer';
      });

      const staffData: EmployeeWithStats[] = staffDocs.map((d) => {
        const data = d.data() as Profile;
        const baseSalary = data.role === 'Admin' ? 65000 : data.role === 'Manager' ? 45000 : data.role === 'Appraiser' ? 38000 : 28000;
        return {
          ...data,
          id: d.id,
          phone: data.phone_primary || '—',
          branch: data.branch_id || 'Madurai Main',
          attendance: 0,
          lastLogin: data.updated_at ? new Date(data.updated_at).toLocaleDateString() : '—',
          salary: baseSalary,
          incentive: 0,
          loansProcessed: 0,
          collectionAmt: 0,
        };
      });

      staffData.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setEmployees(staffData);
    } catch (err) {
      console.error('Failed to load staff:', err);
      showToast('Failed to load staff list', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formPhone.trim()) {
      showToast('Name and phone number are required', 'error');
      return;
    }

    setSaving(true);
    try {
      const staffDocId = `staff-${Date.now().toString().substring(6)}`;
      const now = new Date().toISOString();
      const profileData = {
        name: formName.trim(),
        phone_primary: formPhone.trim(),
        email: formEmail.trim() || null,
        role: formRole,
        branch_id: formBranch,
        status: 'Active',
        kyc_status: 'Approved',
        created_at: now,
        updated_at: now,
      };

      await setDoc(doc(db, 'profiles', staffDocId), profileData);
      showToast(`Employee "${formName}" registered successfully!`);
      
      setFormName('');
      setFormPhone('');
      setFormEmail('');
      setShowAddModal(false);
      await loadStaff();
    } catch (err: any) {
      console.error('Failed to add employee:', err);
      showToast(err.message || 'Failed to add employee', 'error');
    } finally {
      setSaving(false);
    }
  };

  const roles = ['All', 'Admin', 'Manager', 'Cashier', 'Appraiser', 'Accountant', 'Collection_Officer', 'Customer_Support'];

  const filtered = employees.filter(e =>
    (selectedRole === 'All' || e.role === selectedRole) &&
    (e.name.toLowerCase().includes(searchQuery.toLowerCase()) || e.id.includes(searchQuery) || e.phone.includes(searchQuery))
  );

  const attendanceDays = Array.from({ length: 10 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - i);
    return d.toISOString().split('T')[0];
  });

  const getRoleColor = (role: string) => {
    const colors: Record<string, string> = {
      Admin: 'bg-[#2563EB]/10 text-[#2563EB]', Manager: 'bg-blue-500/10 text-blue-500',
      Appraiser: 'bg-purple-500/10 text-purple-600', Cashier: 'bg-emerald-500/10 text-emerald-600',
      Accountant: 'bg-cyan-500/10 text-cyan-600', Collection_Officer: 'bg-amber-500/10 text-amber-600',
      Customer_Support: 'bg-pink-500/10 text-pink-600',
    };
    return colors[role] || 'bg-slate-500/10 text-gray-500';
  };

  const tabItems = [
    { key: 'master', label: `Staff Directory (${employees.length})`, icon: UserCog },
    { key: 'attendance', label: 'Attendance', icon: Calendar },
    { key: 'leave', label: 'Leave Register', icon: Clock },
    { key: 'payroll', label: 'Payroll & Salary', icon: DollarSign },
    { key: 'performance', label: 'Performance & KPIs', icon: Award },
  ];

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
        <span>Employee Management</span>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-[#E5E7EB] pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 tracking-wide font-outfit">Employee & Staff Management</h2>
          <p className="text-gray-500 text-xs mt-1">HR directory, roles, branch assignments, attendance, and payroll.</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => loadStaff()}
            className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition"
            title="Refresh"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-[#F8FAFC] text-xs font-bold rounded-lg transition shadow-lg shadow-[#2563EB]/10 w-full sm:w-auto justify-center"
          >
            <Plus size={14} /> Add Employee
          </button>
        </div>
      </div>

      {/* Add Employee Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form onSubmit={handleAddEmployee} className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4 animate-scale-up">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <UserCog className="text-[#2563EB]" size={18} />
                Register Staff Member
              </h3>
              <button type="button" onClick={() => setShowAddModal(false)} className="text-gray-400 hover:text-gray-700">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-gray-700">Full Name *</label>
                <input
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  required
                  placeholder="e.g. Anandha Krishnan"
                  className="w-full mt-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#2563EB]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-gray-700">Phone Number *</label>
                  <input
                    value={formPhone}
                    onChange={e => setFormPhone(e.target.value)}
                    required
                    placeholder="e.g. 9840123456"
                    className="w-full mt-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#2563EB]"
                  />
                </div>
                <div>
                  <label className="font-semibold text-gray-700">Email Address</label>
                  <input
                    value={formEmail}
                    onChange={e => setFormEmail(e.target.value)}
                    type="email"
                    placeholder="e.g. anand@pgf.com"
                    className="w-full mt-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#2563EB]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-gray-700">Assigned Role</label>
                  <select
                    value={formRole}
                    onChange={e => setFormRole(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#2563EB]"
                  >
                    <option value="Manager">Manager</option>
                    <option value="Appraiser">Appraiser / Valuer</option>
                    <option value="Cashier">Cashier</option>
                    <option value="Accountant">Accountant</option>
                    <option value="Collection_Officer">Collection Officer</option>
                    <option value="Customer_Support">Customer Support</option>
                    <option value="Admin">Administrator</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-gray-700">Branch Office</label>
                  <select
                    value={formBranch}
                    onChange={e => setFormBranch(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-[#2563EB]"
                  >
                    <option value="Madurai Main">Madurai Main Headquarters</option>
                    {branches.map(b => (
                      <option key={b.id} value={b.name}>{b.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 font-semibold rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold rounded-lg shadow flex items-center gap-2"
              >
                {saving && <Loader2 size={14} className="animate-spin" />} Save Employee
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-[#E5E7EB] text-xs overflow-x-auto">
        {tabItems.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`flex items-center gap-2 px-5 py-2.5 font-bold font-outfit transition-all whitespace-nowrap ${
              activeTab === tab.key ? 'text-[#2563EB] border-b-2 border-[#2563EB]' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <tab.icon size={14} /> {tab.label}
          </button>
        ))}
      </div>

      {/* Employee Master */}
      {activeTab === 'master' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search staff by name, ID, phone..."
                className="w-full pl-9 pr-4 py-2 bg-[#F3F4F6] border border-[#E5E7EB] rounded-lg text-xs text-gray-900 focus:border-[#2563EB] outline-none"
              />
            </div>
            <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0">
              {roles.map(r => (
                <button
                  key={r}
                  onClick={() => setSelectedRole(r)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                    selectedRole === r ? 'bg-[#2563EB] text-[#F8FAFC]' : 'bg-[#F3F4F6] text-gray-500 hover:text-gray-900'
                  }`}
                >
                  {r.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[700px]">
                <thead>
                  <tr className="text-gray-400 uppercase tracking-wider border-b border-[#E5E7EB]/60 bg-gray-50/50">
                    <th className="px-4 py-3">Employee</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3 hidden md:table-cell">Phone</th>
                    <th className="px-4 py-3 hidden lg:table-cell">Branch</th>
                    <th className="px-4 py-3 hidden sm:table-cell">Attendance</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 hidden lg:table-cell">Last Active</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB]/40">
                  {filtered.map(emp => (
                    <tr key={emp.id} className="text-gray-600 hover:bg-[#F3F4F6]/50">
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-gray-900">{emp.name}</div>
                        <div className="text-[10px] text-gray-400 font-mono">{emp.id}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getRoleColor(emp.role)}`}>
                          {emp.role.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-mono hidden md:table-cell">{emp.phone}</td>
                      <td className="px-4 py-3.5 hidden lg:table-cell">{emp.branch}</td>
                      <td className="px-4 py-3.5 hidden sm:table-cell">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-gray-200 rounded-full h-1.5">
                            <div className="h-1.5 rounded-full bg-emerald-600" style={{ width: `${emp.attendance}%` }} />
                          </div>
                          <span className="text-[10px] text-emerald-600 font-bold">{emp.attendance}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600">{emp.status || 'Active'}</span>
                      </td>
                      <td className="px-4 py-3.5 text-[10px] text-gray-400 hidden lg:table-cell">{emp.lastLogin}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div className="text-center py-12 text-gray-400 text-xs">
                  No employee records found. Click &quot;Add Staff Member&quot; to onboard staff.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Attendance */}
      {activeTab === 'attendance' && (
        <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-[#E5E7EB] flex justify-between items-center bg-gray-50/50">
            <h3 className="text-sm font-bold text-[#2563EB]">Monthly Attendance Register</h3>
            <div className="flex gap-3 text-[10px]">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-600" /> Present</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Absent</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> Leave</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[700px]">
              <thead>
                <tr className="text-gray-400 uppercase tracking-wider border-b border-[#E5E7EB]/60">
                  <th className="px-4 py-3 font-semibold sticky left-0 bg-[#ffffff] z-10">Employee</th>
                  {attendanceDays.map(d => (
                    <th key={d} className="px-3 py-3 font-semibold text-center min-w-[44px]">{d.split('-')[2]}</th>
                  ))}
                  <th className="px-4 py-3 font-semibold text-center">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]/40">
                {employees.map(emp => (
                  <tr key={emp.id} className="text-gray-600">
                    <td className="px-4 py-3 sticky left-0 bg-[#ffffff] z-10">
                      <span className="font-medium text-gray-900 text-xs">{emp.name}</span>
                    </td>
                    {attendanceDays.map(d => {
                      const rand = Math.random();
                      const status = rand > 0.15 ? 'P' : rand > 0.08 ? 'L' : 'A';
                      const color = status === 'P' ? 'text-emerald-600 bg-emerald-500/10' : status === 'L' ? 'text-amber-500 bg-amber-500/10' : 'text-red-500 bg-red-50';
                      return (
                        <td key={d} className="px-3 py-3 text-center">
                          <span className={`inline-flex w-6 h-6 rounded items-center justify-center text-[10px] font-bold ${color}`}>{status}</span>
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-center font-bold text-gray-900">{Math.round(10 * (emp.attendance / 100))}/10</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Leave Register */}
      {activeTab === 'leave' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Casual Leave', used: 3, total: 12 }, { label: 'Sick Leave', used: 2, total: 10 },
              { label: 'Annual Leave', used: 0, total: 15 }, { label: 'Pending Requests', used: 1, total: 1 },
            ].map((item, i) => (
              <div key={i} className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-4 shadow-sm">
                <p className="text-[10px] text-gray-500 uppercase tracking-wider">{item.label}</p>
                <p className="text-xl font-bold text-gray-900 mt-1">{item.used}<span className="text-sm text-gray-400">/{item.total}</span></p>
              </div>
            ))}
          </div>
          <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-gray-400 uppercase tracking-wider border-b border-[#E5E7EB]/60 bg-gray-50/50">
                  <th className="px-4 py-3">Employee</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">From</th><th className="px-4 py-3">To</th><th className="px-4 py-3">Days</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Approved By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]/40">
                {leaveRecords.map((lr, i) => (
                  <tr key={i} className="text-gray-600">
                    <td className="px-4 py-3.5 text-gray-900 font-medium">{lr.employee}</td>
                    <td className="px-4 py-3.5">{lr.type}</td>
                    <td className="px-4 py-3.5 font-mono">{lr.from}</td>
                    <td className="px-4 py-3.5 font-mono">{lr.to}</td>
                    <td className="px-4 py-3.5 font-bold">{lr.days}</td>
                    <td className="px-4 py-3.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${lr.status === 'Approved' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}>{lr.status}</span>
                    </td>
                    <td className="px-4 py-3.5">{lr.approvedBy || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payroll */}
      {activeTab === 'payroll' && (
        <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-[#E5E7EB] flex justify-between items-center bg-gray-50/50">
            <h3 className="text-sm font-bold text-[#2563EB]">Monthly Payroll & Salary Ledger</h3>
            <span className="text-xs text-gray-500">Total Payroll: <span className="text-gray-900 font-bold font-mono">₹{employees.reduce((s, e) => s + e.salary, 0).toLocaleString('en-IN')}</span></span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[700px]">
              <thead>
                <tr className="text-gray-400 uppercase tracking-wider border-b border-[#E5E7EB]/60 bg-gray-50/50">
                  <th className="px-4 py-3">Employee</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Basic</th><th className="px-4 py-3">HRA</th><th className="px-4 py-3">Allowances</th><th className="px-4 py-3">Incentive</th><th className="px-4 py-3">Deductions</th><th className="px-4 py-3 font-bold">Net Salary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]/40">
                {employees.map(emp => {
                  const hra = Math.round(emp.salary * 0.2);
                  const allowances = Math.round(emp.salary * 0.1);
                  const deductions = Math.round(emp.salary * 0.12);
                  const net = emp.salary + hra + allowances + emp.incentive - deductions;
                  return (
                    <tr key={emp.id} className="text-gray-600">
                      <td className="px-4 py-3.5 text-gray-900 font-medium">{emp.name}</td>
                      <td className="px-4 py-3.5"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getRoleColor(emp.role)}`}>{emp.role.replace(/_/g, ' ')}</span></td>
                      <td className="px-4 py-3.5 font-mono">₹{emp.salary.toLocaleString()}</td>
                      <td className="px-4 py-3.5 font-mono">₹{hra.toLocaleString()}</td>
                      <td className="px-4 py-3.5 font-mono">₹{allowances.toLocaleString()}</td>
                      <td className="px-4 py-3.5 font-mono text-emerald-600">₹{emp.incentive.toLocaleString()}</td>
                      <td className="px-4 py-3.5 font-mono text-red-500">₹{deductions.toLocaleString()}</td>
                      <td className="px-4 py-3.5 font-mono font-bold text-[#2563EB]">₹{net.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Performance & KPIs */}
      {activeTab === 'performance' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {employees.map(emp => (
            <div key={emp.id} className="bg-white border border-[#E5E7EB] rounded-2xl p-5 space-y-3 shadow-sm hover:shadow-md transition">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="text-sm font-bold text-gray-900">{emp.name}</h4>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getRoleColor(emp.role)}`}>{emp.role}</span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-gray-500">Incentive Earned</span>
                  <p className="text-xs font-bold text-emerald-600 font-mono">₹{emp.incentive.toLocaleString()}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-gray-50 p-2.5 rounded-lg">
                  <p className="text-[10px] text-gray-500">Loans Processed</p>
                  <p className="text-sm font-bold text-gray-900 mt-0.5">{emp.loansProcessed} deals</p>
                </div>
                <div className="bg-gray-50 p-2.5 rounded-lg">
                  <p className="text-[10px] text-gray-500">Total Collection</p>
                  <p className="text-sm font-bold text-gray-900 mt-0.5">₹{(emp.collectionAmt / 100000).toFixed(1)}L</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
