// src/app/investor/invest/page.tsx
// Add Investment / Invest More screen — Official QR payment, UTR submission, and instant verification tracking.

'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  QrCode,
  ArrowLeft,
  DollarSign,
  Calendar,
  CreditCard,
  FileCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  ShieldCheck,
  Phone,
  MessageSquare,
} from 'lucide-react';
import { auth } from '@/lib/firebase';
import {
  getInvestmentSettings,
  getInvestorPortfolio,
  submitInvestmentPaymentRequest,
} from '@/lib/db/investments';
import type {
  InvestmentSettings,
  InvestorPortfolioSummary,
  InvestmentPaymentRequest,
} from '@/types/database';

export default function InvestMorePage() {
  const router = useRouter();

  const [settings, setSettings] = useState<InvestmentSettings | null>(null);
  const [portfolio, setPortfolio] = useState<InvestorPortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedRequest, setSubmittedRequest] = useState<InvestmentPaymentRequest | null>(null);

  // Form
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [paymentMode, setPaymentMode] = useState('UPI');
  const [utrNumber, setUtrNumber] = useState('');
  const [screenshotUrl, setScreenshotUrl] = useState('');

  useEffect(() => {
    async function load() {
      const user = auth.currentUser;
      if (!user) return;
      try {
        const [s, p] = await Promise.all([
          getInvestmentSettings(),
          getInvestorPortfolio(user.uid),
        ]);
        setSettings(s);
        setPortfolio(p);
      } catch (err: any) {
        console.error('Error loading investment form:', err);
        setError(err.message || 'Failed to load investment details.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    setError(null);
    const numAmount = Number(amount);

    if (!numAmount || numAmount <= 0) {
      setError('Please enter a valid investment amount.');
      return;
    }

    if (settings && numAmount < settings.minimum_amount) {
      setError(`Minimum investment amount is ₹${settings.minimum_amount.toLocaleString('en-IN')}`);
      return;
    }

    if (settings && numAmount > settings.maximum_amount) {
      setError(`Maximum investment amount is ₹${settings.maximum_amount.toLocaleString('en-IN')}`);
      return;
    }

    if (!utrNumber.trim()) {
      setError('Please provide the UTR / Bank Reference Number after completing payment.');
      return;
    }

    setSubmitting(true);
    try {
      const req = await submitInvestmentPaymentRequest({
        investor_id: user.uid,
        amount: numAmount,
        payment_date: paymentDate,
        payment_mode: paymentMode,
        utr_number: utrNumber.trim(),
        screenshot_url: screenshotUrl.trim() || null,
      });

      setSubmittedRequest(req);
    } catch (err: any) {
      console.error('Error submitting investment payment:', err);
      setError(err.message || 'Failed to submit payment verification.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatINR = (val?: number) => {
    return '₹' + (val || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-400 space-y-3">
        <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs font-mono uppercase tracking-wider text-amber-400">Loading Payment Gateway...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back button */}
      <div className="flex items-center justify-between">
        <Link
          href="/investor/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={14} /> Back to Dashboard
        </Link>
      </div>

      {submittedRequest ? (
        <div className="bg-[#0D1630] p-8 rounded-3xl border border-emerald-500/30 text-center space-y-6 shadow-2xl shadow-emerald-500/10">
          <div className="w-16 h-16 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 size={36} />
          </div>

          <div className="space-y-1">
            <span className="px-3 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-amber-400/15 text-amber-300 border border-amber-400/30">
              Request Submitted
            </span>
            <h2 className="text-2xl font-bold text-white font-outfit mt-2">
              Payment Verification Pending
            </h2>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Your investment payment has been securely recorded. Our administration team is verifying the bank credit.
            </p>
          </div>

          <div className="p-5 bg-slate-900/80 rounded-2xl max-w-md mx-auto space-y-3 text-xs text-left border border-slate-800">
            <div className="flex justify-between">
              <span className="text-slate-400">Request Number:</span>
              <span className="font-mono font-bold text-amber-400">{submittedRequest.request_number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Investment Amount:</span>
              <span className="font-mono font-extrabold text-white text-sm">{formatINR(submittedRequest.amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">UTR / Reference:</span>
              <span className="font-mono text-slate-200 font-bold">{submittedRequest.utr_number}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Payment Mode:</span>
              <span className="text-blue-400 font-semibold">{submittedRequest.payment_mode}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Status:</span>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold text-[10px]">
                Pending Verification
              </span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3">
            <Link
              href="/investor/dashboard"
              className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all shadow-lg shadow-amber-500/20"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: QR Code & Payment Instructions */}
          <div className="lg:col-span-5 bg-[#0D1630] rounded-3xl border border-slate-800 p-6 sm:p-8 flex flex-col items-center text-center shadow-xl space-y-5">
            <div className="space-y-1">
              <span className="px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-400/15 text-amber-300 font-mono">
                Official Payment QR
              </span>
              <h2 className="text-lg font-bold text-white mt-1">
                {settings?.qr_title || 'Pavithra Gold Finance Investment Account'}
              </h2>
            </div>

            {/* QR Frame */}
            <div className="p-4 bg-white rounded-2xl shadow-2xl border-2 border-amber-500/40 w-56 h-56 flex items-center justify-center">
              <img
                src={settings?.qr_code_url || '/logo.jpg'}
                alt="Payment QR Code"
                className="max-h-full max-w-full object-contain"
              />
            </div>

            <div className="text-xs text-slate-300 space-y-2 text-left bg-slate-900/80 p-4 rounded-2xl border border-slate-800">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-[11px] uppercase">
                <Sparkles size={14} />
                <span>Instructions</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {settings?.payment_instructions ||
                  'Scan the QR code using Google Pay, PhonePe, Paytm, or any UPI app. Complete the transfer and copy the UTR / Transaction Reference number.'}
              </p>
            </div>

            <div className="text-[11px] text-slate-500 font-mono">
              Applicable Return: <strong className="text-amber-400">{settings?.annual_rate || 12}% p.a.</strong>
            </div>
          </div>

          {/* Right: Payment Submission Form */}
          <form
            onSubmit={handleSubmit}
            className="lg:col-span-7 bg-[#0D1630] rounded-3xl border border-slate-800 p-6 sm:p-8 shadow-xl space-y-6"
          >
            <div>
              <h2 className="text-xl font-extrabold text-white font-outfit">Submit Investment Details</h2>
              <p className="text-xs text-slate-400 mt-1">
                Enter your transferred amount and transaction reference number for immediate administrator verification.
              </p>
            </div>

            {error && (
              <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs flex items-center gap-3">
                <AlertCircle size={18} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Amount Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1">
                Investment Amount (₹) <span className="text-amber-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-3 text-sm text-amber-400 font-mono font-bold">₹</span>
                <input
                  type="number"
                  required
                  placeholder="e.g. 500000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-700 bg-slate-900 text-white font-mono font-bold text-base focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none"
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                <span>Min: {formatINR(settings?.minimum_amount)}</span>
                <span>Max: {formatINR(settings?.maximum_amount)}</span>
              </div>
            </div>

            {/* Payment Mode & Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Payment Mode</label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-700 bg-slate-900 text-white focus:ring-2 focus:ring-amber-400 outline-none"
                >
                  <option value="UPI">UPI (GPay / PhonePe / Paytm)</option>
                  <option value="IMPS">IMPS Instant Transfer</option>
                  <option value="NEFT">NEFT Bank Transfer</option>
                  <option value="RTGS">RTGS Bank Transfer</option>
                  <option value="Direct_Bank">Bank Deposit</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Transfer Date</label>
                <input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-700 bg-slate-900 text-white font-mono focus:ring-2 focus:ring-amber-400 outline-none"
                />
              </div>
            </div>

            {/* UTR / Transaction Reference */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1">
                UTR / Transaction Reference Number <span className="text-amber-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. 324156789012"
                value={utrNumber}
                onChange={(e) => setUtrNumber(e.target.value)}
                className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-700 bg-slate-900 text-white font-mono font-bold tracking-wider focus:ring-2 focus:ring-amber-400 outline-none"
              />
              <span className="text-[10px] text-slate-500">
                12-digit UPI reference number or bank transaction ID shown in your payment receipt.
              </span>
            </div>

            {/* Screenshot URL / Proof */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400">Payment Screenshot URL (Optional)</label>
              <input
                type="url"
                placeholder="https://... image link or cloud upload"
                value={screenshotUrl}
                onChange={(e) => setScreenshotUrl(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-700 bg-slate-900 text-white font-mono focus:ring-2 focus:ring-amber-400 outline-none"
              />
            </div>

            {/* Submit Button */}
            <div className="pt-4 border-t border-slate-800">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold text-xs shadow-xl shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>Submitting Verification Request...</>
                ) : (
                  <>
                    <ShieldCheck size={16} />
                    Submit Investment Payment
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
