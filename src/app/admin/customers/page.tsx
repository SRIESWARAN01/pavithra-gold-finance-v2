'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, UserPlus, Eye, ChevronRight, Filter, Download, ArrowUpDown, CheckSquare, Square, Trash2, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, orderBy, writeBatch, doc } from 'firebase/firestore';
import { isFirebaseConfigured } from '@/lib/auth';
import type { Profile, KycStatus } from '@/types/database';

interface CustomerWithLoans extends Profile {
  activeLoansCount: number;
}

export default function CustomerList() {
  const router = useRouter();
  
  // Search & Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [kycFilter, setKycFilter] = useState<string>('');
  const [branchFilter, setBranchFilter] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  // Sorting state
  const [sortField, setSortField] = useState<'name' | 'phone_primary' | 'national_id' | 'status' | 'activeLoansCount'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Data state
  const [customers, setCustomers] = useState<CustomerWithLoans[]>([]);
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<{ id: string; name: string; code: string }[]>([]);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const fetchBranches = async () => {
    try {
      const snap = await getDocs(collection(db, 'branches'));
      setBranches(snap.docs.map(d => ({ id: d.id, name: d.data().name, code: d.data().code })));
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      if (isFirebaseConfigured()) {
        const q = query(
          collection(db, 'profiles'),
          where('role', '==', 'Customer')
        );
        const snapshot = await getDocs(q);

        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as any));

        // Join active loans count client-side
        const mapped: CustomerWithLoans[] = [];
        for (const p of list) {
          const loansQ = query(collection(db, 'loans'), where('customer_id', '==', p.id));
          const loansSnap = await getDocs(loansQ);
          const activeLoans = loansSnap.docs.filter((l) =>
            ['Active', 'Due', 'Overdue', 'Grace_Period'].includes(l.data().status)
          ).length;
          mapped.push({ ...p, activeLoansCount: activeLoans });
        }

        // Apply filters
        let filtered = mapped;
        if (searchQuery.trim()) {
          const term = searchQuery.trim().toLowerCase();
          filtered = filtered.filter((c) =>
            c.name?.toLowerCase().includes(term) ||
            c.phone_primary?.includes(term) ||
            c.national_id?.includes(term) ||
            c.customer_number?.toLowerCase().includes(term)
          );
        }
        if (statusFilter) {
          filtered = filtered.filter(c => c.status === statusFilter);
        }
        if (kycFilter) {
          filtered = filtered.filter(c => c.kyc_status === kycFilter);
        }
        if (branchFilter) {
          filtered = filtered.filter(c => c.branch_id === branchFilter);
        }

        // Apply sorting
        filtered.sort((a, b) => {
          let valA = a[sortField] || '';
          let valB = b[sortField] || '';

          if (sortField === 'activeLoansCount') {
            valA = a.activeLoansCount;
            valB = b.activeLoansCount;
          }

          if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
          if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
          return 0;
        });

        // Remove soft-deleted from active view
        filtered = filtered.filter(c => !c.deleted_at);

        setCustomers(filtered);
      }
    } catch (err) {
      console.error('Failed to fetch customers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => {
      fetchBranches();
    }, 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      fetchCustomers();
    }, 0);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, statusFilter, kycFilter, branchFilter, sortField, sortDirection]);

  // Sorting Control Toggler
  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Multi-select bulk selection helpers
  const handleSelectAll = () => {
    if (selectedIds.length === paginatedCustomers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedCustomers.map(c => c.id));
    }
  };

  const handleSelectOne = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Bulk Actions
  const handleBulkStatusChange = async (newStatus: 'Active' | 'Inactive') => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to set status of ${selectedIds.length} customer(s) to ${newStatus}?`)) return;
    setLoading(true);
    try {
      if (isFirebaseConfigured()) {
        const batch = writeBatch(db);
        selectedIds.forEach(id => {
          const ref = doc(db, 'profiles', id);
          batch.update(ref, { status: newStatus, updated_at: new Date().toISOString() });
        });
        await batch.commit();
      }
      setCustomers(prev =>
        prev.map(c => selectedIds.includes(c.id) ? { ...c, status: newStatus } : c)
      );
      setSelectedIds([]);
      alert(`Successfully updated status of selected customers.`);
    } catch (err: any) {
      alert(err.message || 'Bulk status update failed.');
    } finally {
      setLoading(false);
    }
  };

  // CSV Exporter
  const handleExportCSV = () => {
    if (customers.length === 0) return;
    const headers = ['Customer ID', 'Name', 'Phone', 'Aadhaar ID', 'PAN Card', 'City', 'Status', 'KYC Status', 'Active Loans'];
    const rows = customers.map(c => [
      c.customer_number || c.id,
      c.name,
      c.phone_primary,
      c.national_id,
      c.pan_number || 'N/A',
      c.city || 'N/A',
      c.status,
      c.kyc_status || 'Pending',
      c.activeLoansCount
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `PGF_CUSTOMERS_EXPORT_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  // Pagination bounds
  const totalPages = Math.ceil(customers.length / pageSize) || 1;
  const startIdx = (currentPage - 1) * pageSize;
  const paginatedCustomers = customers.slice(startIdx, startIdx + pageSize);

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs text-[#2563EB] font-semibold tracking-wider uppercase">
        <span>Admin Panel</span>
        <ChevronRight size={12} className="text-gray-400" />
        <span className="text-gray-500">Customer Management</span>
        <ChevronRight size={12} className="text-gray-400" />
        <span>List Directory</span>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 border-b border-[#E5E7EB] pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 tracking-wide font-outfit">Customers Directory</h2>
          <p className="text-gray-500 text-xs mt-1">Search, view profile metrics, audit KYC status, and batch update clients.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={handleExportCSV}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#2563EB] text-xs font-bold rounded-lg border border-[#2563EB]/20 transition"
          >
            <Download size={14} />
            <span className="hidden sm:inline">Export CSV</span>
            <span className="sm:hidden">CSV</span>
          </button>
          <button
            onClick={() => router.push('/admin/customers/new')}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-[#F8FAFC] text-xs font-bold rounded-lg transition shadow-lg shadow-[#2563EB]/10"
          >
            <UserPlus size={14} />
            <span className="hidden sm:inline">Onboard New Client</span>
            <span className="sm:hidden">Onboard</span>
          </button>
        </div>
      </div>

      {/* Bulk actions menu */}
      {selectedIds.length > 0 && (
        <div className="p-3.5 bg-[#ffffff] border border-[#2563EB]/35 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-[#2563EB] shadow-xl">
          <span className="font-semibold">{selectedIds.length} customer(s) selected</span>
          <div className="flex gap-2">
            <button
              onClick={() => handleBulkStatusChange('Active')}
              className="px-3 py-1.5 bg-emerald-600/10 hover:bg-emerald-600/25 border border-emerald-500/20 text-emerald-600 font-bold uppercase text-[9px] rounded"
            >
              Bulk Activate
            </button>
            <button
              onClick={() => handleBulkStatusChange('Inactive')}
              className="px-3 py-1.5 bg-rose-600/10 hover:bg-rose-600/25 border border-rose-500/20 text-red-500 font-bold uppercase text-[9px] rounded"
            >
              Bulk Deactivate
            </button>
          </div>
        </div>
      )}

      {/* Search Bar + Filters Toggler */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Filter customers by name, phone primary, Aadhaar ID, or customer ID..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-[#ffffff] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 text-sm rounded-lg pl-12 pr-4 py-3 outline-none transition"
          />
          <Search size={18} className="absolute left-4 top-3.5 text-gray-500" />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all border flex items-center gap-1.5 ${
            showFilters
              ? 'bg-[#2563EB] text-[#F8FAFC] border-[#2563EB]'
              : 'bg-[#ffffff] text-gray-600 border-[#E5E7EB] hover:bg-[#F3F4F6]'
          }`}
        >
          <Filter size={14} />
          Filters
        </button>
      </div>

      {/* Advanced Filters Drawer */}
      {showFilters && (
        <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="space-y-1.5">
            <label className="text-gray-500 font-medium">Customer Status</label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 text-xs rounded-lg px-3 py-2 outline-none"
            >
              <option value="">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Blocked">Blocked</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-gray-500 font-medium">KYC Verification Status</label>
            <select
              value={kycFilter}
              onChange={(e) => { setKycFilter(e.target.value); setCurrentPage(1); }}
              className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 text-xs rounded-lg px-3 py-2 outline-none"
            >
              <option value="">All KYC Statuses</option>
              <option value="Pending">Pending Review</option>
              <option value="Submitted">Submitted</option>
              <option value="Under_Review">Under Review</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-gray-500 font-medium">Assigned Home Branch</label>
            <select
              value={branchFilter}
              onChange={(e) => { setBranchFilter(e.target.value); setCurrentPage(1); }}
              className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 text-xs rounded-lg px-3 py-2 outline-none"
            >
              <option value="">All Branches</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Grid List layout */}
      <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-12 text-center text-gray-500 text-xs flex flex-col items-center gap-3">
            <div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin"></div>
            <span>Loading customers directory...</span>
          </div>
        ) : paginatedCustomers.length === 0 ? (
          <div className="p-12 text-center text-gray-500 text-xs">
            No customers found matching that query.
          </div>
        ) : (
          <div className="responsive-table-wrap">
          <table className="w-full text-left text-xs min-w-[640px]">
            <thead>
              <tr className="text-gray-400 uppercase tracking-wider border-b border-[#E5E7EB] bg-[#F8FAFC]/20">
                <th className="p-4 w-10">
                  <button onClick={handleSelectAll} className="text-[#2563EB]">
                    {selectedIds.length === paginatedCustomers.length ? (
                      <CheckSquare size={16} />
                    ) : (
                      <Square size={16} />
                    )}
                  </button>
                </th>
                <th className="p-4 font-semibold cursor-pointer" onClick={() => toggleSort('name')}>
                  <div className="flex items-center gap-1">
                    <span>Client Name</span>
                    <ArrowUpDown size={12} />
                  </div>
                </th>
                <th className="p-4 font-semibold cursor-pointer" onClick={() => toggleSort('phone_primary')}>
                  <div className="flex items-center gap-1">
                    <span>Phone Contact</span>
                    <ArrowUpDown size={12} />
                  </div>
                </th>
                <th className="p-4 font-semibold cursor-pointer hidden md:table-cell" onClick={() => toggleSort('national_id')}>
                  <div className="flex items-center gap-1">
                    <span>Aadhaar ID</span>
                    <ArrowUpDown size={12} />
                  </div>
                </th>
                <th className="p-4 font-semibold cursor-pointer" onClick={() => toggleSort('status')}>
                  <div className="flex items-center gap-1">
                    <span>Status</span>
                    <ArrowUpDown size={12} />
                  </div>
                </th>
                <th className="p-4 font-semibold cursor-pointer hidden lg:table-cell" onClick={() => toggleSort('activeLoansCount')}>
                  <div className="flex items-center gap-1">
                    <span>Active Loans</span>
                    <ArrowUpDown size={12} />
                  </div>
                </th>
                <th className="p-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB]/30">
              {paginatedCustomers.map((c) => (
                <tr key={c.id} className="text-gray-600 hover:bg-[#F3F4F6]/20 transition-all">
                  <td className="p-4">
                    <button onClick={() => handleSelectOne(c.id)} className="text-[#2563EB]">
                      {selectedIds.includes(c.id) ? (
                        <CheckSquare size={16} />
                      ) : (
                        <Square size={16} />
                      )}
                    </button>
                  </td>
                  <td className="p-4 font-semibold text-gray-900">
                    <div>
                      <div>{c.name}</div>
                      {c.customer_number && (
                        <div className="text-[10px] text-gray-400 font-mono mt-0.5">{c.customer_number}</div>
                      )}
                    </div>
                  </td>
                  <td className="p-4 font-mono">{c.phone_primary}</td>
                  <td className="p-4 font-mono hidden md:table-cell">{c.national_id}</td>
                  <td className="p-4">
                    <div className="flex flex-col gap-1 items-start">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        c.status === 'Active' ? 'bg-emerald-500/10 text-emerald-600' :
                        c.status === 'Blocked' ? 'bg-rose-500/15 text-red-500 border border-rose-500/20' :
                        'bg-slate-500/10 text-gray-500'
                      }`}>
                        {c.status}
                      </span>
                      {c.kyc_status && (
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-semibold uppercase ${
                          c.kyc_status === 'Approved' ? 'bg-emerald-500/10 text-emerald-600' :
                          c.kyc_status === 'Rejected' ? 'bg-red-50 text-red-500' :
                          'bg-amber-500/10 text-amber-400'
                        }`}>
                          KYC: {c.kyc_status}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-4 font-medium hidden lg:table-cell">
                    {c.activeLoansCount > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-600 text-white shadow-sm shadow-blue-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        Loan Active ({c.activeLoansCount})
                      </span>
                    ) : (
                      <span className="text-gray-400 text-[11px]">No Active Loans</span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    <button
                      onClick={() => router.push(`/admin/customers/${c.id}`)}
                      className="p-2 rounded bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#2563EB] hover:text-gray-900 transition-all flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider ml-auto"
                    >
                      <Eye size={12} />
                      View Profile
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}

        {/* Pagination controls */}
        {!loading && customers.length > 0 && (
          <div className="p-4 border-t border-[#E5E7EB] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
            <div className="flex items-center gap-2">
              <span>Show</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-[#F3F4F6] border border-[#E5E7EB] text-gray-900 text-xs rounded p-1 outline-none"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
              <span>entries</span>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                className="px-2.5 py-1.5 bg-[#F3F4F6] disabled:bg-slate-800 disabled:text-slate-600 border border-slate-700 text-gray-600 rounded font-semibold transition"
              >
                Prev
              </button>
              <span>Page {currentPage} of {totalPages}</span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                className="px-2.5 py-1.5 bg-[#F3F4F6] disabled:bg-slate-800 disabled:text-slate-600 border border-slate-700 text-gray-600 rounded font-semibold transition"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
