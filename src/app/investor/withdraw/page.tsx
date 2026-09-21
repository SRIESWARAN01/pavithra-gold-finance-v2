'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Wallet,
  ArrowUpRight,
  AlertCircle,
  Clock,
  CheckCircle2,
  Building2,
  ShieldCheck,
  MessageCircle,
  HelpCircle,
  RefreshCw,
  FileText
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import {
  getInvestorPortfolio,
  submitWithdrawalRequest,
  getInvestmentSettings
} from '@/lib/db/investments';
import {
  InvestorPortfolioSummary,
  InvestmentSettings,
  WithdrawalRequest
} from '@/types/database';

export default function InvestorWithdrawPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [portfolio, setPortfolio] = useState<InvestorPortfolioSummary | null>(null);
  const [settings, setSettings] = useState<InvestmentSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successRequest, setSuccessRequest] = useState<WithdrawalRequest | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form inputs
  const [amount, setAmount] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [bankAccount, setBankAccount] = useState<string>('');
  const [ifsc, setIfsc] = useState<string>('');
  const [bankName, setBankName] = useState<string>('');
  const [accountHolder, setAccountHolder] = useState<string>('');
  const [confirmTerms, setConfirmTerms] = useState<boolean>(false);

  useEffect(() => {
    async function loadData() {
      if (!user?.uid) return;
      try {
        setLoading(true);
        const [portData, settsData] = await Promise.all([
          getInvestorPortfolio(user.uid),
          getInvestmentSettings()
        ]);
        setPortfolio(portData);
        setSettings(settsData);

        if (portData) {
          setAccountHolder(portData.investor_name || portData.investor?.name || '');
          const bDetails = portData.investor?.bankDetails || (portData as any).bankDetails;
          if (bDetails) {
            setBankAccount(bDetails.accountNumber || bDetails.account_number || '');
            setIfsc(bDetails.ifsc || bDetails.ifsc_code || '');
            setBankName(bDetails.bankName || bDetails.bank_name || '');
          }
        }
      } catch (err: any) {
        console.error('Error loading withdrawal details:', err);
        setError('Failed to load portfolio details. Please try again.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [user]);

  const eligibleAmount = portfolio?.eligible_withdrawal_amount || portfolio?.eligibleWithdrawalAmount || 0;
  const numAmount = parseFloat(amount) || 0;

  const handleSelectFull = () => {
    setAmount(eligibleAmount.toString());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid || !portfolio) return;

    if (numAmount <= 0) {
      setError('Please enter a valid withdrawal amount greater than zero.');
      return;
    }

    if (numAmount > eligibleAmount) {
      setError(`Withdrawal amount exceeds the currently eligible amount (₹${eligibleAmount.toLocaleString('en-IN')}).`);
      return;
    }

    if (!bankAccount.trim() || !ifsc.trim()) {
      setError('Please provide valid bank account and IFSC details for settlement.');
      return;
    }

    if (!confirmTerms) {
      setError('Please acknowledge and confirm the withdrawal terms.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const request = await submitWithdrawalRequest({
        investor_id: portfolio.investor_id || portfolio.investor?.investorId,
        requested_amount: numAmount,
        reason: reason.trim() || undefined,
        bank_account_details: {
          account_number: bankAccount.trim(),
          ifsc_code: ifsc.trim().toUpperCase(),
          bank_name: bankName.trim() || 'Bank Account',
          account_holder_name: accountHolder.trim() || portfolio.investor_name || portfolio.investor?.name
        }
      });

      setSuccessRequest(request);
    } catch (err: any) {
      console.error('Withdrawal submission failed:', err);
      setError(err.message || 'Failed to submit withdrawal request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // WhatsApp Support helper
  const helpdeskNumber = (settings?.helpdesk_whatsapp_number || settings?.helpdeskWhatsAppNumber || '919876543210').replace(/[^0-9]/g, '');
  const getWhatsAppLink = (reqId?: string, reqAmt?: number) => {
    const invId = portfolio?.investor_number || portfolio?.investor?.investorId || 'N/A';
    const invName = portfolio?.investor_name || portfolio?.investor?.name || 'N/A';
    const text = encodeURIComponent(
      `Hello PGF Investment Helpdesk,\n\nInvestor ID: ${invId}\nName: ${invName}\nWithdrawal Request: ₹${(reqAmt || numAmount).toLocaleString('en-IN')}\nRequest ID: ${reqId || 'Pending'}\n\nI need assistance regarding my investment/withdrawal.`
    );
    return `https://wa.me/${helpdeskNumber}?text=${text}`;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin mb-4" />
        <p className="text-slate-400 font-medium text-sm tracking-wide">Loading withdrawal facilities...</p>
      </div>
    );
  }

  if (successRequest) {
    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-500">
        <div className="p-8 rounded-3xl bg-slate-900/90 border border-emerald-500/30 text-center relative overflow-hidden shadow-2xl backdrop-blur-xl">
          <div className="absolute -right-16 -top-16 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="w-20 h-20 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto mb-6 text-emerald-400 shadow-inner">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <span className="px-3 py-1 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase tracking-widest">
            Request Submitted Successfully
          </span>

          <h1 className="text-2xl sm:text-3xl font-bold text-white mt-4 font-serif">
            Withdrawal Under Review
          </h1>
          <p className="text-slate-400 text-sm max-w-md mx-auto mt-2">
            Your withdrawal request has been received and registered under Reference ID:
          </p>

          <div className="my-6 p-4 rounded-2xl bg-slate-950/80 border border-slate-800 inline-block font-mono text-xl font-bold text-amber-400 tracking-wider">
            {successRequest.withdrawal_number || successRequest.withdrawalId || successRequest.id}
          </div>

          <div className="grid grid-cols-2 gap-4 text-left p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 max-w-md mx-auto mb-6 text-xs">
            <div>
              <p className="text-slate-500 uppercase tracking-wider font-semibold">Requested Amount</p>
              <p className="text-base font-bold text-white mt-0.5">₹{(successRequest.requested_amount || successRequest.requestedAmount || 0).toLocaleString('en-IN')}</p>
            </div>
            <div>
              <p className="text-slate-500 uppercase tracking-wider font-semibold">Current Status</p>
              <p className="text-xs font-bold text-amber-400 mt-1 uppercase flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Pending Approval
              </p>
            </div>
            <div className="col-span-2 pt-2 border-t border-slate-800">
              <p className="text-slate-500 uppercase tracking-wider font-semibold">Settlement Account</p>
              <p className="text-white font-mono mt-0.5">
                {successRequest.bank_account_details?.bank_name || successRequest.bankDetails?.bankName} - {successRequest.bank_account_details?.account_number || successRequest.bankDetails?.accountNumber} ({successRequest.bank_account_details?.ifsc_code || successRequest.bankDetails?.ifsc})
              </p>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 text-left max-w-md mx-auto flex items-start gap-3">
            <Clock className="w-5 h-5 flex-shrink-0 text-amber-400 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-200">Processing SLA Notice</p>
              <p className="text-slate-300 mt-0.5">
                Standard processing SLA is {settings?.processing_sla_hours || settings?.processingSlaHours || 24} hours. You will receive an instant notification once the settlement UTR is generated.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
            <Link
              href="/investor/dashboard"
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm transition-all"
            >
              Return to Dashboard
            </Link>
            <a
              href={getWhatsAppLink(successRequest.withdrawal_number || successRequest.withdrawalId, successRequest.requested_amount || successRequest.requestedAmount)}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/40"
            >
              <MessageCircle className="w-4 h-4" />
              Need Help? WhatsApp Support
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-widest">
              Capital Settlement
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mt-1 font-serif tracking-tight">
            Withdraw Investment
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Submit a partial or full capital redemption request with atomic ledger settlement.
          </p>
        </div>

        <a
          href={getWhatsAppLink()}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition-all w-fit"
        >
          <MessageCircle className="w-4 h-4" />
          24×7 Investment Helpdesk
        </a>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 text-rose-400 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-rose-300">Withdrawal Notice</p>
            <p className="mt-0.5 text-slate-300">{error}</p>
          </div>
        </div>
      )}

      {/* Eligible Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
          <p className="text-xs uppercase tracking-wider text-slate-400 font-medium">Total Invested Principal</p>
          <p className="text-2xl font-bold text-white mt-1 font-mono">
            ₹{(portfolio?.total_invested || portfolio?.totalInvested || 0).toLocaleString('en-IN')}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Active lots: {portfolio?.active_lots_count || portfolio?.activeLotsCount || 0}
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80">
          <p className="text-xs uppercase tracking-wider text-slate-400 font-medium">Current Portfolio Value</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1 font-mono">
            ₹{(portfolio?.current_value || portfolio?.currentValue || 0).toLocaleString('en-IN')}
          </p>
          <p className="text-xs text-emerald-500/80 mt-1">
            Accrued: +₹{(portfolio?.accrued_return || portfolio?.totalReturns || 0).toLocaleString('en-IN')}
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 relative overflow-hidden">
          <div className="absolute -right-8 -bottom-8 w-24 h-24 bg-amber-500/10 rounded-full blur-xl pointer-events-none" />
          <p className="text-xs uppercase tracking-wider text-amber-300 font-semibold">Eligible Withdrawal Amount</p>
          <p className="text-2xl font-bold text-amber-400 mt-1 font-mono">
            ₹{eligibleAmount.toLocaleString('en-IN')}
          </p>
          <p className="text-xs text-amber-300/80 mt-1">
            Subject to active plan lock-in terms
          </p>
        </div>
      </div>

      {/* Main Withdrawal Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-6 backdrop-blur-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Wallet className="w-5 h-5 text-amber-400" />
              1. Enter Withdrawal Amount
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectFull}
                className="text-xs px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 font-semibold transition-all"
              >
                Withdraw Full Amount
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-2">
              Amount to Redeem (₹) *
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-slate-500 font-serif">
                ₹
              </span>
              <input
                type="number"
                min="1000"
                max={eligibleAmount}
                step="500"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 50,000"
                required
                className="w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-950/80 border border-slate-700 focus:border-amber-400 text-white font-mono text-2xl font-bold placeholder:text-slate-600 focus:outline-none transition-all"
              />
            </div>
            <div className="flex items-center justify-between mt-2 text-xs text-slate-400">
              <span>Maximum available for immediate redemption:</span>
              <span className="font-mono text-amber-400 font-semibold">
                ₹{eligibleAmount.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Optional reason */}
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-2">
              Reason for Redemption (Optional)
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Planned reinvestment, personal emergency, business expense"
              className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-slate-800 focus:border-amber-400 text-white text-sm focus:outline-none transition-all"
            />
          </div>

          {/* Section 2: Settlement Account */}
          <div className="pt-6 border-t border-slate-800 space-y-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-amber-400" />
              2. Settlement Bank Account Details
            </h2>
            <p className="text-xs text-slate-400">
              Funds will be disbursed via NEFT/RTGS/IMPS directly to this authenticated account.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">
                  Account Holder Name *
                </label>
                <input
                  type="text"
                  value={accountHolder}
                  onChange={(e) => setAccountHolder(e.target.value)}
                  placeholder="Name as in bank passbook"
                  required
                  className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-slate-800 focus:border-amber-400 text-white text-sm focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">
                  Bank Name *
                </label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="e.g. State Bank of India, HDFC Bank"
                  required
                  className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-slate-800 focus:border-amber-400 text-white text-sm focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">
                  Account Number *
                </label>
                <input
                  type="text"
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value)}
                  placeholder="Enter complete account number"
                  required
                  className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-slate-800 focus:border-amber-400 text-white font-mono text-sm focus:outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">
                  IFSC Code *
                </label>
                <input
                  type="text"
                  value={ifsc}
                  onChange={(e) => setIfsc(e.target.value)}
                  placeholder="e.g. SBIN0001234"
                  required
                  className="w-full px-4 py-3 rounded-xl bg-slate-950/80 border border-slate-800 focus:border-amber-400 text-white font-mono uppercase text-sm focus:outline-none transition-all"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Summary & Terms */}
          <div className="pt-6 border-t border-slate-800 space-y-4">
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Requested Redemption</span>
                <span className="font-mono text-white font-bold">₹{numAmount.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Estimated Remaining Portfolio</span>
                <span className="font-mono text-emerald-400 font-semibold">
                  ₹{Math.max(0, (portfolio?.current_value || portfolio?.currentValue || 0) - numAmount).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Disbursement Processing Target</span>
                <span className="text-amber-400 font-semibold">
                  Within {settings?.processing_sla_hours || settings?.processingSlaHours || 24} Hours
                </span>
              </div>
            </div>

            <label className="flex items-start gap-3 text-xs text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={confirmTerms}
                onChange={(e) => setConfirmTerms(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-amber-400"
              />
              <span>
                I confirm that the bank account details provided above belong to me and are accurate. I understand that the redemption will be verified and disbursed through atomic financial approval.
              </span>
            </label>
          </div>

          {/* Action Button */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={submitting || numAmount <= 0 || numAmount > eligibleAmount}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-base transition-all shadow-xl shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Submitting Redemption Request...
                </>
              ) : (
                <>
                  <ArrowUpRight className="w-5 h-5" />
                  Confirm & Submit Withdrawal Request
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
