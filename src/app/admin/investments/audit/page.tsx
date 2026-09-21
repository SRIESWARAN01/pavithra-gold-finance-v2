// src/app/admin/investments/audit/page.tsx
// Investment Audit Trail — Real-time security audit of all investment actions, approvals, and configuration changes.

'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Search,
  Filter,
  RefreshCw,
  AlertCircle,
  Calendar,
  Clock,
  User,
  FileText,
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';

interface AuditEntry {
  id: string;
  actor_id: string;
  action: string;
  entity: string;
  entity_id: string;
  details?: Record<string, any>;
  timestamp: string;
}

export default function InvestmentAuditPage() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const loadLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const q = query(collection(db, 'investment_audit_logs'), orderBy('timestamp', 'desc'), limit(100));
      const snap = await getDocs(q);
      const list: AuditEntry[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<AuditEntry, 'id'>),
      }));
      setLogs(list);
    } catch (err: any) {
      console.error('Error loading audit logs:', err);
      setError(err.message || 'Failed to load audit trail.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const filteredLogs = logs.filter((l) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      l.action.toLowerCase().includes(q) ||
      l.actor_id.toLowerCase().includes(q) ||
      l.entity.toLowerCase().includes(q) ||
      l.entity_id.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-red-100 text-red-800">
              Security & Compliance
            </span>
            <span className="text-xs text-gray-500 font-semibold">{logs.length} Recent Events</span>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 font-outfit">Investment Audit Logs</h1>
          <p className="text-xs text-gray-500">
            Immutable log of all investor creations, payment approvals, withdrawal settlements, and policy modifications.
          </p>
        </div>

        <button
          onClick={loadLogs}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-all cursor-pointer"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-3">
          <AlertCircle size={18} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Search */}
      <div className="relative w-full bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
        <Search size={16} className="absolute left-7 top-7 text-gray-400" />
        <input
          type="text"
          placeholder="Filter audit records by Action, Actor ID, or Entity..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-gray-50/80 text-gray-500 font-bold border-b border-gray-100 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Timestamp</th>
                <th className="px-5 py-3.5">Action</th>
                <th className="px-5 py-3.5">Actor</th>
                <th className="px-5 py-3.5">Entity</th>
                <th className="px-5 py-3.5">Entity ID</th>
                <th className="px-5 py-3.5">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-gray-400">
                    <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-blue-600" />
                    Loading audit trail...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-gray-400">
                    No audit records found.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((l) => (
                  <tr key={l.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-4 font-mono text-gray-500 text-[11px] whitespace-nowrap">
                      {l.timestamp}
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-bold text-gray-900 font-mono text-[11px] bg-slate-100 px-2 py-0.5 rounded">
                        {l.action}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-mono text-blue-700 font-semibold">{l.actor_id}</td>
                    <td className="px-5 py-4 text-gray-700 font-medium">{l.entity}</td>
                    <td className="px-5 py-4 font-mono text-gray-900 font-bold">{l.entity_id}</td>
                    <td className="px-5 py-4 font-mono text-gray-500 text-[11px] max-w-sm truncate">
                      {l.details ? JSON.stringify(l.details) : '—'}
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
