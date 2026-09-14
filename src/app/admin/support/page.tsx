'use client';

import React, { useState } from 'react';
import {
  ChevronRight, HeadphonesIcon, Plus, Search, MessageSquare,
  CheckCircle2, Clock, AlertCircle, XCircle, Eye, Send, HelpCircle
} from 'lucide-react';

export default function CustomerSupport() {
  const [activeTab, setActiveTab] = useState<'tickets' | 'faq' | 'feedback'>('tickets');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [showNewTicket, setShowNewTicket] = useState(false);

  const [tickets, setTickets] = useState<any[]>([]);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);

  const faqs = [
    { question: 'What documents are required for a gold loan?', answer: 'You need a valid Aadhaar card, PAN card (for loans above ₹50,000), and the gold ornaments for appraisal.', category: 'Loans' },
    { question: 'How is interest calculated?', answer: 'Interest is calculated on a daily basis using the formula: Principal × (APR/100) / 365. Interest is compounded annually.', category: 'Billing' },
    { question: 'What happens if I miss a payment?', answer: 'A grace period of 7 days is provided. After that, overdue interest may apply. If the loan remains unpaid for 90+ days, the gold may be eligible for auction.', category: 'Payments' },
    { question: 'How do I get my gold released?', answer: 'Pay the full outstanding amount (principal + accrued interest). Visit the branch with your pawn ticket and valid ID. Gold is released immediately upon payment verification.', category: 'Operations' },
    { question: 'Can I make partial payments?', answer: 'Yes, you can make partial interest payments at any time. Partial principal payments are also accepted and will reduce future interest accrual.', category: 'Payments' },
    { question: 'What is the maximum LTV ratio?', answer: 'The maximum Loan-to-Value ratio is 100% of the gold valuation at current market rates.', category: 'Loans' },
  ];

  const statuses = ['All', 'Open', 'In Progress', 'Resolved', 'Closed'];

  const filtered = tickets.filter(t =>
    (filterStatus === 'All' || t.status === filterStatus) &&
    (t.subject.toLowerCase().includes(searchQuery.toLowerCase()) || t.customer.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getPriorityColor = (p: string) => {
    return p === 'High' ? 'bg-red-50 text-red-500' : p === 'Medium' ? 'bg-amber-500/10 text-amber-400' : 'bg-blue-500/10 text-blue-400';
  };

  const getStatusColor = (s: string) => {
    const c: Record<string, string> = {
      Open: 'bg-blue-500/10 text-blue-400', 'In Progress': 'bg-amber-500/10 text-amber-400',
      Resolved: 'bg-emerald-500/10 text-emerald-600', Closed: 'bg-slate-500/10 text-gray-500',
    };
    return c[s] || 'bg-slate-500/10 text-gray-500';
  };

  const getStatusIcon = (s: string) => {
    if (s === 'Open') return <AlertCircle size={12} />;
    if (s === 'In Progress') return <Clock size={12} />;
    if (s === 'Resolved') return <CheckCircle2 size={12} />;
    return <XCircle size={12} />;
  };

  const stats = [
    { label: 'Open Tickets', value: tickets.filter(t => t.status === 'Open').length, color: 'text-blue-400' },
    { label: 'In Progress', value: tickets.filter(t => t.status === 'In Progress').length, color: 'text-amber-400' },
    { label: 'Resolved', value: tickets.filter(t => t.status === 'Resolved').length, color: 'text-emerald-600' },
    { label: 'Avg Rating', value: feedbacks.length > 0 ? (feedbacks.reduce((s, f) => s + f.rating, 0) / feedbacks.length).toFixed(1) : '5.0', color: 'text-[#2563EB]' },
  ];

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center gap-2 text-xs text-[#2563EB] font-semibold tracking-wider uppercase">
        <span>Admin Panel</span>
        <ChevronRight size={12} className="text-gray-400" />
        <span className="text-gray-500">Management</span>
        <ChevronRight size={12} className="text-gray-400" />
        <span>Customer Support</span>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-[#E5E7EB] pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 tracking-wide font-outfit">Customer Support Center</h2>
          <p className="text-gray-500 text-xs mt-1">Support tickets, FAQ management, and customer feedback dashboard.</p>
        </div>
        <button
          onClick={() => setShowNewTicket(!showNewTicket)}
          className="flex items-center gap-2 px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-[#F8FAFC] text-xs font-bold rounded-lg transition shadow-lg shadow-[#2563EB]/10 w-full sm:w-auto justify-center"
        >
          <Plus size={14} /> New Ticket
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {stats.map((s, i) => (
          <div key={i} className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-4">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">{s.label}</p>
            <p className={`text-xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#E5E7EB] text-xs overflow-x-auto">
        {[
          { key: 'tickets', label: 'Support Tickets', icon: MessageSquare },
          { key: 'faq', label: 'FAQ Management', icon: HelpCircle },
          { key: 'feedback', label: 'Customer Feedback', icon: CheckCircle2 },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`flex items-center gap-2 px-5 py-2.5 font-bold font-outfit transition-all ${
              activeTab === tab.key ? 'text-[#2563EB] border-b-2 border-[#2563EB]' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <tab.icon size={14} /> {tab.label}
          </button>
        ))}
      </div>

      {/* Tickets */}
      {activeTab === 'tickets' && (
        <div className="space-y-4">
          {showNewTicket && (
            <div className="bg-[#ffffff] border border-[#2563EB]/20 rounded-xl p-6 animate-slide-up">
              <h3 className="text-sm font-bold text-[#2563EB] mb-4">Create Support Ticket</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-gray-500">Customer</label>
                  <input className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 text-sm rounded-lg px-4 py-2.5 outline-none transition" placeholder="Customer name" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-gray-500">Category</label>
                  <select className="w-full bg-[#F3F4F6] border border-[#E5E7EB] text-gray-900 text-sm rounded-lg px-4 py-2.5 outline-none">
                    <option>Billing</option><option>Documents</option><option>Operations</option><option>Loans</option><option>Technical</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-gray-500">Priority</label>
                  <select className="w-full bg-[#F3F4F6] border border-[#E5E7EB] text-gray-900 text-sm rounded-lg px-4 py-2.5 outline-none">
                    <option>Low</option><option>Medium</option><option>High</option>
                  </select>
                </div>
                <div className="md:col-span-3 space-y-1.5">
                  <label className="text-xs text-gray-500">Subject</label>
                  <input className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 text-sm rounded-lg px-4 py-2.5 outline-none transition" placeholder="Brief description of the issue" />
                </div>
                <div className="md:col-span-3 space-y-1.5">
                  <label className="text-xs text-gray-500">Description</label>
                  <textarea rows={3} className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 text-sm rounded-lg px-4 py-2.5 outline-none transition resize-none" placeholder="Detailed description..." />
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <button className="flex items-center gap-2 px-5 py-2 bg-[#2563EB] text-[#F8FAFC] text-xs font-bold rounded-lg"><Send size={12} /> Submit Ticket</button>
                <button onClick={() => setShowNewTicket(false)} className="px-5 py-2 bg-[#F3F4F6] text-gray-500 text-xs font-bold rounded-lg border border-[#E5E7EB]">Cancel</button>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search tickets..." className="w-full pl-10 pr-4 py-2.5 bg-[#ffffff] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 text-sm rounded-lg outline-none transition" />
            </div>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="bg-[#ffffff] border border-[#E5E7EB] text-gray-900 text-sm rounded-lg px-4 py-2.5 outline-none">
              {statuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-gray-400 uppercase tracking-wider border-b border-[#E5E7EB]/60 bg-[#F8FAFC]/30">
                  <th className="px-4 py-3">Ticket</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Subject</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Priority</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Assigned To</th><th className="px-4 py-3 text-right">Last Update</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]/40">
                {filtered.map(t => (
                  <tr key={t.id} className="text-gray-600 hover:bg-[#F3F4F6]/20 transition">
                    <td className="px-4 py-3.5 font-mono text-[#2563EB] font-bold">{t.id}</td>
                    <td className="px-4 py-3.5 text-gray-900 font-medium">{t.customer}</td>
                    <td className="px-4 py-3.5">{t.subject}</td>
                    <td className="px-4 py-3.5"><span className="px-2 py-0.5 rounded bg-[#F3F4F6] text-gray-600 text-[10px] font-mono">{t.category}</span></td>
                    <td className="px-4 py-3.5"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getPriorityColor(t.priority)}`}>{t.priority}</span></td>
                    <td className="px-4 py-3.5"><span className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 w-fit ${getStatusColor(t.status)}`}>{getStatusIcon(t.status)} {t.status}</span></td>
                    <td className="px-4 py-3.5">{t.assignedTo}</td>
                    <td className="px-4 py-3.5 text-right text-gray-400">{t.lastUpdate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* FAQ */}
      {activeTab === 'faq' && (
        <div className="space-y-3">
          {faqs.map((faq, i) => (
            <div key={i} className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-5 hover:border-[#2563EB]/20 transition">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <HelpCircle size={14} className="text-[#2563EB]" />
                    <h4 className="text-sm font-bold text-gray-900">{faq.question}</h4>
                  </div>
                  <p className="text-gray-500 text-xs mt-2 leading-relaxed ml-6">{faq.answer}</p>
                </div>
                <span className="px-2 py-0.5 rounded bg-[#F3F4F6] text-gray-600 text-[10px] font-mono">{faq.category}</span>
              </div>
            </div>
          ))}
          <button className="w-full py-3 bg-[#ffffff] border border-dashed border-[#E5E7EB] hover:border-[#2563EB]/30 rounded-xl text-sm text-gray-500 hover:text-[#2563EB] transition flex items-center justify-center gap-2">
            <Plus size={14} /> Add New FAQ
          </button>
        </div>
      )}

      {/* Feedback */}
      {activeTab === 'feedback' && (
        <div className="space-y-4">
          {feedbacks.map((fb, i) => (
            <div key={i} className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-5">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="text-sm font-bold text-gray-900">{fb.customer}</h4>
                  <div className="flex items-center gap-1 mt-1">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <span key={j} className={`text-xs ${j < fb.rating ? 'text-[#2563EB]' : 'text-slate-600'}`}>★</span>
                    ))}
                    <span className="text-[10px] text-gray-500 ml-1">{fb.rating}/5</span>
                  </div>
                </div>
                <span className="text-[10px] text-gray-400">{fb.date}</span>
              </div>
              <p className="text-gray-600 text-xs mt-3 leading-relaxed">&ldquo;{fb.comment}&rdquo;</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
