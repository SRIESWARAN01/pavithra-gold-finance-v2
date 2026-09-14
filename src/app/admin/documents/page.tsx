'use client';

import React, { useState, useEffect } from 'react';
import {
  ChevronRight, FolderOpen, Search, Download, Eye, Trash2,
  FileText, Image as ImageIcon, Upload, Filter, CheckCircle2, Clock
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { isFirebaseConfigured } from '@/lib/auth';

export default function DocumentManagement() {
  const [activeTab, setActiveTab] = useState<'all' | 'customer' | 'loan' | 'audit'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [documents, setDocuments] = useState<any[]>([]);

  useEffect(() => {
    async function loadDocuments() {
      try {
        const snap = await getDocs(query(collection(db, 'documents'), orderBy('generated_at', 'desc')));
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setDocuments(docs);
      } catch (err) {
        console.error('Failed to load documents:', err);
      }
    }
    loadDocuments();
  }, []);

  const allDocs = documents;
  const categories = ['All', 'Customer', 'Loan', 'Audit'];
  const docTypes = ['All', 'Pawn_Ticket', 'Payment_Receipt', 'Loan_Agreement', 'Aadhaar', 'PAN', 'Gold_Photo', 'Signature', 'Customer_Statement', 'Outstanding_Statement', 'Collection_Report'];

  const filtered = allDocs.filter(d => {
    const matchTab = activeTab === 'all' || d.category?.toLowerCase() === activeTab;
    const matchSearch = d.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        d.customer?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCategory = filterCategory === 'All' || d.type === filterCategory;
    return matchTab && matchSearch && matchCategory;
  });

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      Generated: 'bg-blue-500/10 text-blue-400', Verified: 'bg-emerald-500/10 text-emerald-600',
      Signed: 'bg-emerald-500/10 text-emerald-600', Uploaded: 'bg-amber-500/10 text-amber-400',
      Captured: 'bg-purple-500/10 text-purple-400', Pending: 'bg-red-50 text-red-500',
    };
    return colors[status] || 'bg-slate-500/10 text-gray-500';
  };

  const getFormatIcon = (format: string) => {
    return format === 'PDF' ? <FileText size={14} className="text-red-500" /> : <ImageIcon size={14} className="text-blue-400" />;
  };

  const stats = [
    { label: 'Total Documents', value: allDocs.length },
    { label: 'Customer Docs', value: allDocs.filter(d => d.category === 'Customer').length },
    { label: 'Loan Documents', value: allDocs.filter(d => d.category === 'Loan').length },
    { label: 'Audit Reports', value: allDocs.filter(d => d.category === 'Audit').length },
  ];

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center gap-2 text-xs text-[#2563EB] font-semibold tracking-wider uppercase">
        <span>Admin Panel</span>
        <ChevronRight size={12} className="text-gray-400" />
        <span className="text-gray-500">Management</span>
        <ChevronRight size={12} className="text-gray-400" />
        <span>Document Management</span>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-[#E5E7EB] pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 tracking-wide font-outfit">Document Management System</h2>
          <p className="text-gray-500 text-xs mt-1">Centralized document vault — KYC, loan agreements, receipts, gold photos, and audit reports.</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-[#F8FAFC] text-xs font-bold rounded-lg transition shadow-lg shadow-[#2563EB]/10 w-full sm:w-auto justify-center">
          <Upload size={14} /> Upload Document
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {stats.map((s, i) => (
          <div key={i} className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-4">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">{s.label}</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#E5E7EB] text-xs overflow-x-auto">
        {[
          { key: 'all', label: 'All Documents' },
          { key: 'customer', label: 'Customer KYC' },
          { key: 'loan', label: 'Loan Documents' },
          { key: 'audit', label: 'Audit & Reports' },
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

      {/* Search & Filter */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search documents or customer..." className="w-full pl-10 pr-4 py-2.5 bg-[#ffffff] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 text-sm rounded-lg outline-none transition" />
        </div>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="bg-[#ffffff] border border-[#E5E7EB] text-gray-900 text-sm rounded-lg px-4 py-2.5 outline-none">
          {docTypes.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
        </select>
      </div>

      {/* Document Table */}
      <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="text-gray-400 uppercase tracking-wider border-b border-[#E5E7EB]/60 bg-[#F8FAFC]/30">
              <th className="px-4 py-3 font-semibold">Document</th>
              <th className="px-4 py-3 font-semibold">Type</th>
              <th className="px-4 py-3 font-semibold">Customer</th>
              <th className="px-4 py-3 font-semibold">Date</th>
              <th className="px-4 py-3 font-semibold">Size</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E5E7EB]/40">
            {filtered.map((doc) => (
              <tr key={doc.id} className="text-gray-600 hover:bg-[#F3F4F6]/20 transition">
                <td className="px-4 py-3.5">
                  <div className="flex items-center gap-2">
                    {getFormatIcon(doc.format)}
                    <div>
                      <div className="font-medium text-gray-900 text-xs">{doc.name}</div>
                      <div className="text-[10px] text-gray-400 font-mono">{doc.id}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3.5">
                  <span className="px-2 py-0.5 rounded bg-[#F3F4F6] text-gray-600 text-[10px] font-mono">{doc.type?.replace(/_/g, ' ')}</span>
                </td>
                <td className="px-4 py-3.5 text-gray-900">{doc.customer}</td>
                <td className="px-4 py-3.5 font-mono text-[10px]">{doc.date}</td>
                <td className="px-4 py-3.5 text-gray-500">{doc.size}</td>
                <td className="px-4 py-3.5">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getStatusColor(doc.status)}`}>{doc.status}</span>
                </td>
                <td className="px-4 py-3.5 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button className="text-[#2563EB] hover:text-gray-900 transition" title="View"><Eye size={14} /></button>
                    <button className="text-blue-400 hover:text-gray-900 transition" title="Download"><Download size={14} /></button>
                    <button className="text-red-500 hover:text-gray-900 transition" title="Delete"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">No documents found.</div>
        )}
      </div>
    </div>
  );
}
