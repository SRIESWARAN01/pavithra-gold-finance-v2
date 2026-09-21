// src/app/admin/investments/settings/page.tsx
// Investment Settings & QR Configuration — Admin configuration of rates, compounding, QR code, and WhatsApp helpdesk.

'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings,
  Save,
  QrCode,
  Phone,
  Mail,
  Clock,
  Percent,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  FileText,
  ShieldAlert,
} from 'lucide-react';
import { getInvestmentSettings, updateInvestmentSettings } from '@/lib/db/investments';
import { auth } from '@/lib/firebase';
import type { InvestmentSettings, CompoundingFrequency } from '@/types/database';

export default function InvestmentSettingsPage() {
  const [settings, setSettings] = useState<InvestmentSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State
  const [annualRate, setAnnualRate] = useState(12);
  const [compoundingFreq, setCompoundingFreq] = useState<CompoundingFrequency>('Annual');
  const [minAmount, setMinAmount] = useState(10000);
  const [maxAmount, setMaxAmount] = useState(10000000);
  const [lockInMonths, setLockInMonths] = useState(12);
  const [slaHours, setSlaHours] = useState(24);
  const [whatsappNumber, setWhatsappNumber] = useState('919876543210');
  const [supportEmail, setSupportEmail] = useState('invest@pavithragoldfinance.com');
  const [qrCodeUrl, setQrCodeUrl] = useState('/logo.jpg');
  const [qrTitle, setQrTitle] = useState('Pavithra Gold Finance Investment Account');
  const [instructions, setInstructions] = useState('');
  const [terms, setTerms] = useState('');
  const [disclaimer, setDisclaimer] = useState('');

  const loadSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await getInvestmentSettings();
      setSettings(s);
      setAnnualRate(s.annual_rate || 12);
      setCompoundingFreq(s.compounding_frequency || 'Annual');
      setMinAmount(s.minimum_amount || 10000);
      setMaxAmount(s.maximum_amount || 10000000);
      setLockInMonths(s.lock_in_period_months || 12);
      setSlaHours(s.processing_sla_hours || 24);
      setWhatsappNumber(s.helpdesk_whatsapp_number || '919876543210');
      setSupportEmail(s.support_email || 'invest@pavithragoldfinance.com');
      setQrCodeUrl(s.qr_code_url || '/logo.jpg');
      setQrTitle(s.qr_title || 'Pavithra Gold Finance Investment Account');
      setInstructions(s.payment_instructions || '');
      setTerms(s.terms_and_conditions || '');
      setDisclaimer(s.disclaimer_text || '');
    } catch (err: any) {
      console.error('Error loading settings:', err);
      setError(err.message || 'Failed to load settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const adminUid = auth.currentUser?.uid || 'admin';
      const updated = await updateInvestmentSettings(
        {
          annual_rate: Number(annualRate),
          compounding_frequency: compoundingFreq,
          minimum_amount: Number(minAmount),
          maximum_amount: Number(maxAmount),
          lock_in_period_months: Number(lockInMonths),
          processing_sla_hours: Number(slaHours),
          helpdesk_whatsapp_number: whatsappNumber.trim().replace('+', ''),
          support_email: supportEmail.trim(),
          qr_code_url: qrCodeUrl.trim(),
          qr_title: qrTitle.trim(),
          payment_instructions: instructions.trim(),
          terms_and_conditions: terms.trim(),
          disclaimer_text: disclaimer.trim(),
        },
        adminUid
      );

      setSettings(updated);
      setSuccessMsg('Investment settings and QR configuration saved successfully.');
    } catch (err: any) {
      console.error('Error updating settings:', err);
      setError(err.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-800">
              System Configuration
            </span>
            <span className="text-xs text-gray-400">Strictly Audited Admin Settings</span>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 font-outfit">Investment Settings & QR Code</h1>
          <p className="text-xs text-gray-500">
            Configure return policy, compounding method, withdrawal SLA, payment QR, and 24x7 WhatsApp Helpdesk.
          </p>
        </div>

        <button
          onClick={loadSettings}
          disabled={loading}
          className="p-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 transition-all cursor-pointer"
          title="Reset"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-3">
          <AlertCircle size={18} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-3">
          <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8 space-y-8">
        {/* SECTION 1: RETURN & COMPOUNDING CONFIGURATION */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
            <Percent size={18} className="text-amber-600" />
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
              Return & Compounding Policy
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700">Applicable Annual Return Rate (%)</label>
              <input
                type="number"
                step="0.1"
                required
                value={annualRate}
                onChange={(e) => setAnnualRate(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 font-mono font-bold text-amber-600"
              />
              <span className="text-[10px] text-gray-400">Default: 12% p.a.</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700">Compounding Frequency</label>
              <select
                value={compoundingFreq}
                onChange={(e) => setCompoundingFreq(e.target.value as CompoundingFrequency)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200"
              >
                <option value="Annual">Annual Compounding</option>
                <option value="Semi_Annual">Semi-Annual (Half-Yearly)</option>
                <option value="Quarterly">Quarterly</option>
                <option value="Monthly">Monthly</option>
                <option value="Simple">Simple Interest</option>
              </select>
              <span className="text-[10px] text-gray-400">Compounded after Year 1</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700">Lock-in Period (Months)</label>
              <input
                type="number"
                required
                value={lockInMonths}
                onChange={(e) => setLockInMonths(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 font-mono"
              />
              <span className="text-[10px] text-gray-400">Default: 12 Months</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700">Minimum Investment (₹)</label>
              <input
                type="number"
                required
                value={minAmount}
                onChange={(e) => setMinAmount(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700">Maximum Investment (₹)</label>
              <input
                type="number"
                required
                value={maxAmount}
                onChange={(e) => setMaxAmount(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700">Withdrawal Processing SLA (Hours)</label>
              <input
                type="number"
                required
                value={slaHours}
                onChange={(e) => setSlaHours(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 font-mono"
              />
              <span className="text-[10px] text-gray-400">Target: 24 Hours</span>
            </div>
          </div>
        </div>

        {/* SECTION 2: OFFICIAL PAYMENT QR CODE */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
            <QrCode size={18} className="text-blue-600" />
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
              Investment Payment QR Code
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700">QR Code Image URL / Path</label>
                <input
                  type="text"
                  required
                  value={qrCodeUrl}
                  onChange={(e) => setQrCodeUrl(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 font-mono"
                  placeholder="/logo.jpg or Cloud Storage URL"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700">QR Display Title</label>
                <input
                  type="text"
                  required
                  value={qrTitle}
                  onChange={(e) => setQrTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200"
                  placeholder="Official PGF Account"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700">Payment Instructions for Investors</label>
                <textarea
                  rows={3}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-xl border border-gray-200"
                />
              </div>
            </div>

            {/* QR Preview Box */}
            <div className="p-4 rounded-xl border border-dashed border-gray-300 bg-gray-50 text-center flex flex-col items-center justify-center">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">QR Code Preview</span>
              <div className="w-40 h-40 bg-white p-2 rounded-xl shadow-sm border border-gray-200 flex items-center justify-center overflow-hidden">
                <img src={qrCodeUrl} alt="QR Preview" className="max-w-full max-h-full object-contain" />
              </div>
              <span className="text-xs font-bold text-gray-900 mt-2">{qrTitle}</span>
            </div>
          </div>
        </div>

        {/* SECTION 3: 24X7 WHATSAPP HELPDESK & SUPPORT */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
            <Phone size={18} className="text-emerald-600" />
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
              24x7 Investment Helpdesk & WhatsApp
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700">Official Helpdesk WhatsApp Number</label>
              <input
                type="text"
                required
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                placeholder="e.g. 919876543210 (with country code)"
                className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 font-mono font-bold text-emerald-700"
              />
              <span className="text-[10px] text-gray-400">Used for investor one-click support triggers</span>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700">Official Support Email</label>
              <input
                type="email"
                required
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200"
              />
            </div>
          </div>
        </div>

        {/* SECTION 4: TERMS & DISCLAIMERS */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
            <FileText size={18} className="text-slate-600" />
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
              Compliance Terms & Disclaimer Text
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700">Terms & Conditions</label>
              <textarea
                rows={3}
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                className="w-full p-2.5 text-xs rounded-xl border border-gray-200"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700">Risk Disclosure / Disclaimer</label>
              <textarea
                rows={3}
                value={disclaimer}
                onChange={(e) => setDisclaimer(e.target.value)}
                className="w-full p-2.5 text-xs rounded-xl border border-gray-200"
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="pt-4 border-t border-gray-100 flex items-center justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-lg shadow-amber-500/25 transition-all cursor-pointer disabled:opacity-50"
          >
            {saving ? (
              <>Saving Settings...</>
            ) : (
              <>
                <Save size={15} />
                Save Investment Configuration
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
