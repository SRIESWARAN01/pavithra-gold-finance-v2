'use client';

import React, { useState, useEffect } from 'react';
import {
  MessageCircle,
  HelpCircle,
  Clock,
  Phone,
  Mail,
  Building2,
  ChevronDown,
  ShieldCheck,
  ArrowRight,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getInvestorPortfolio, getInvestmentSettings } from '@/lib/db/investments';
import { InvestorPortfolioSummary, InvestmentSettings } from '@/types/database';

export default function InvestorSupportPage() {
  const { user } = useAuth();
  const [portfolio, setPortfolio] = useState<InvestorPortfolioSummary | null>(null);
  const [settings, setSettings] = useState<InvestmentSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);

  useEffect(() => {
    async function loadData() {
      if (!user?.uid) return;
      try {
        setLoading(true);
        const [port, setts] = await Promise.all([
          getInvestorPortfolio(user.uid),
          getInvestmentSettings()
        ]);
        setPortfolio(port);
        setSettings(setts);
      } catch (err) {
        console.error('Error loading support details:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [user]);

  const faqs = [
    {
      q: 'How are my annual returns calculated and compounded?',
      a: 'Returns are calculated based on your active investment plan. For investments within the first 365 days, pro-rata returns apply. After one full year, annual compounding is applied to your original principal and accrued returns based on exact date lot accounting.'
    },
    {
      q: 'How long does a withdrawal request take to process?',
      a: `Standard processing target is within ${settings?.processing_sla_hours || settings?.processingSlaHours || 24} hours. Once approved by the administration team, funds are disbursed via NEFT/RTGS/IMPS to your verified bank account and the official settlement receipt is generated.`
    },
    {
      q: 'Can I make multiple investments across different dates?',
      a: 'Yes. Each investment is maintained as an independent investment lot with its own investment date, principal, and compounding schedule. Additional investments never overwrite existing lots.'
    },
    {
      q: 'How do I submit payment proof after scanning the QR code?',
      a: 'After completing payment via your UPI/banking app, enter the transferred amount, the 12-digit UTR/transaction reference number, and upload a screenshot proof. Admin verifies and posts the investment within the operating day.'
    },
    {
      q: 'What if my withdrawal or payment is delayed beyond the SLA?',
      a: 'If your request remains pending beyond the stated processing target, you can connect directly with the official PGF Investment Helpdesk on WhatsApp. Your inquiry will include your Investor ID and request reference for priority assistance.'
    }
  ];

  const helpdeskNumber = (settings?.helpdesk_whatsapp_number || settings?.helpdeskWhatsAppNumber || '919876543210').replace(/[^0-9]/g, '');
  const getWhatsAppLink = () => {
    const invId = portfolio?.investor_number || portfolio?.investor?.investorId || 'N/A';
    const invName = portfolio?.investor_name || portfolio?.investor?.name || 'N/A';
    const text = encodeURIComponent(
      `Hello PGF Investment Helpdesk,\n\nInvestor ID: ${invId}\nName: ${invName}\n\nI need assistance regarding my investment/withdrawal.`
    );
    return `https://wa.me/${helpdeskNumber}?text=${text}`;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin mb-4" />
        <p className="text-slate-400 font-medium text-sm tracking-wide">Loading support desk...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-widest">
            Assistance & Helpdesk
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white mt-1 font-serif tracking-tight">
          Investment Helpdesk & Support
        </h1>
        <p className="text-slate-400 text-sm mt-0.5">
          Dedicated assistance for capital allocations, redemptions, UTR verification, and portfolio queries.
        </p>
      </div>

      {/* WhatsApp Priority Card */}
      <div className="p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40 border border-emerald-500/30 shadow-2xl relative overflow-hidden">
        <div className="absolute -right-16 -top-16 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
              <Clock className="w-3.5 h-3.5" />
              24×7 Investment Helpdesk Active
            </div>
            <h2 className="text-2xl font-bold text-white font-serif">
              Need Immediate Assistance?
            </h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              If your withdrawal or payment is not completed within the stated {settings?.processing_sla_hours || settings?.processingSlaHours || 24}-hour SLA, connect directly with our designated Investment Helpdesk officer on WhatsApp.
            </p>
            <p className="text-xs text-slate-400 font-mono">
              Official Desk Number: {settings?.helpdesk_whatsapp_number || settings?.helpdeskWhatsAppNumber || '+91 98765 43210'}
            </p>
          </div>

          <a
            href={getWhatsAppLink()}
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-all shadow-xl shadow-emerald-950/50 flex items-center gap-2 flex-shrink-0"
          >
            <MessageCircle className="w-5 h-5" />
            Chat on WhatsApp
            <ExternalLink className="w-4 h-4 ml-1 opacity-70" />
          </a>
        </div>
      </div>

      {/* Contact Channels Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4">
            <Mail className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-semibold text-white">Email Desk</h3>
          <p className="text-xs text-slate-400 mt-1">Official investment correspondence</p>
          <p className="text-xs font-mono text-amber-400 mt-3">
            {settings?.support_email || settings?.supportEmail || 'investments@pavithragoldfinance.com'}
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-4">
            <Building2 className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-semibold text-white">Branch Desk</h3>
          <p className="text-xs text-slate-400 mt-1">Visit during business hours</p>
          <p className="text-xs text-slate-300 mt-3 font-medium">
            Main Branch Office, PGF
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-semibold text-white">Security & Audit</h3>
          <p className="text-xs text-slate-400 mt-1">Encrypted & ledger-verified</p>
          <p className="text-xs text-emerald-400 mt-3 font-mono">
            ISO 27001 & Atomic Ledger
          </p>
        </div>
      </div>

      {/* Frequently Asked Questions */}
      <div className="p-8 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-6 backdrop-blur-sm">
        <h2 className="text-xl font-bold text-white font-serif flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-amber-400" />
          Frequently Asked Questions
        </h2>

        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const isExpanded = expandedFaq === idx;
            return (
              <div
                key={idx}
                className="rounded-2xl bg-slate-950/60 border border-slate-800/80 overflow-hidden transition-colors"
              >
                <button
                  onClick={() => setExpandedFaq(isExpanded ? null : idx)}
                  className="w-full p-4 text-left flex items-center justify-between gap-4 text-sm font-semibold text-white hover:text-amber-400 transition-colors"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform ${
                      isExpanded ? 'rotate-180 text-amber-400' : ''
                    }`}
                  />
                </button>
                {isExpanded && (
                  <div className="p-4 pt-0 text-xs text-slate-400 leading-relaxed border-t border-slate-800/40">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
