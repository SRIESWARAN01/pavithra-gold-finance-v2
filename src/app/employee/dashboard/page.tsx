'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  Receipt,
  Coins,
  Users,
  Clock,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  PlusCircle,
  QrCode,
  FileText,
  Calendar,
  Sparkles
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { getCurrentProfile } from '@/lib/auth';
import type { Profile, UserRole, ApprovalRequest } from '@/types/database';

export default function EmployeeDashboard() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);

  // Live Metrics
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const [todayCollections, setTodayCollections] = useState(0);
  const [activeLoansCount, setActiveLoansCount] = useState(0);
  const [recentApprovals, setRecentApprovals] = useState<ApprovalRequest[]>([]);

  useEffect(() => {
    let unsubApprovals: (() => void) | undefined;

    async function initDashboard() {
      try {
        const prof = await getCurrentProfile();
        if (prof) setProfile(prof);

        // 1. Query live pending approvals
        const appQuery = query(collection(db, 'approval_requests'), where('status', '==', 'Pending'));
        unsubApprovals = onSnapshot(appQuery, (snap) => {
          setPendingApprovalsCount(snap.size);
          const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ApprovalRequest));
          list.sort((a, b) => (b.requested_at || '').localeCompare(a.requested_at || ''));
          setRecentApprovals(list.slice(0, 5));
        });

        // 2. Query today's collections
        const todayStr = new Date().toISOString().split('T')[0];
        const paymentsSnap = await getDocs(collection(db, 'payments'));
        let sumToday = 0;
        paymentsSnap.forEach((d) => {
          const data = d.data();
          if (data.payment_date && data.payment_date.startsWith(todayStr)) {
            sumToday += data.amount_paid || 0;
          }
        });
        setTodayCollections(sumToday);

        // 3. Query active loans count
        const loansSnap = await getDocs(query(collection(db, 'loans'), where('status', '==', 'Active')));
        setActiveLoansCount(loansSnap.size);
      } catch (err) {
        console.error('Error loading employee dashboard metrics:', err);
      } finally {
        setLoading(false);
      }
    }

    initDashboard();

    return () => {
      if (unsubApprovals) unsubApprovals();
    };
  }, []);

  const role: UserRole = profile?.role || 'Employee';
  const isManager = role === 'Manager' || role === 'Admin';
  const isCashier = role === 'Cashier' || role === 'Admin';
  const isEmployee = role === 'Employee' || role === 'Appraiser' || role === 'Admin';

  const formatINR = (val: number) => '₹' + (val || 0).toLocaleString('en-IN');

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 rounded-2xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/3" />
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-xs font-bold uppercase tracking-wider text-blue-100">
            <Sparkles size={12} /> {role} Terminal &middot; {profile?.branch_id || 'Madurai Main'}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-outfit">
            Welcome, {profile?.name || 'Staff Member'}
          </h1>
          <p className="text-blue-100/80 text-xs sm:text-sm max-w-2xl leading-relaxed">
            Pavithra Gold Finance core branch terminal. Real-time Firebase appraisal, loan origination, cash collections, and statutory compliance management.
          </p>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Pending Approvals Metric */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-500 font-bold uppercase tracking-wider">
            <span>Pending Approvals</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
              <Clock size={18} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-gray-900 font-outfit">
            {loading ? '—' : pendingApprovalsCount}
          </div>
          <p className="text-[11px] text-gray-500">
            {pendingApprovalsCount > 0 ? (
              <span className="text-amber-600 font-semibold">{pendingApprovalsCount} loan requests awaiting review</span>
            ) : (
              'All loan applications up to date'
            )}
          </p>
        </div>

        {/* Today's Collections */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-500 font-bold uppercase tracking-wider">
            <span>Today&apos;s Collections</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200">
              <Receipt size={18} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-gray-900 font-outfit">
            {loading ? '—' : formatINR(todayCollections)}
          </div>
          <p className="text-[11px] text-gray-500">Counter repayments recorded today</p>
        </div>

        {/* Active Loans */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-500 font-bold uppercase tracking-wider">
            <span>Active Loans</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-200">
              <Coins size={18} />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-gray-900 font-outfit">
            {loading ? '—' : activeLoansCount}
          </div>
          <p className="text-[11px] text-gray-500">Total active pledge contracts</p>
        </div>
      </div>

      {/* Role-Specific Action Grid */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2 font-outfit">
          <TrendingUp size={16} className="text-[#2563EB]" /> Permitted Operations &middot; {role}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Manager Action: Review Approvals */}
          {isManager && (
            <Link
              href="/employee/approvals"
              className="bg-white border border-gray-200 hover:border-blue-500 hover:shadow-md rounded-2xl p-5 transition space-y-2 group"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-[#2563EB] group-hover:bg-[#2563EB] group-hover:text-white transition">
                <ShieldCheck size={20} />
              </div>
              <h3 className="font-bold text-sm text-gray-900 font-outfit flex items-center justify-between">
                Review Approvals Queue
                <ArrowRight size={14} className="text-gray-400 group-hover:text-[#2563EB] transition" />
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                Review employee-submitted loan applications, verify KYC, ornament weights, purity, rate, and approve/reject disbursements.
              </p>
            </Link>
          )}

          {/* Cashier Action: Record Repayments */}
          {isCashier && (
            <Link
              href="/employee/payments"
              className="bg-white border border-gray-200 hover:border-emerald-500 hover:shadow-md rounded-2xl p-5 transition space-y-2 group"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition">
                <Receipt size={20} />
              </div>
              <h3 className="font-bold text-sm text-gray-900 font-outfit flex items-center justify-between">
                Cash Counter Repayments
                <ArrowRight size={14} className="text-gray-400 group-hover:text-emerald-600 transition" />
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                Record customer payments (Cash, UPI, Card, Net Banking), auto-split interest first, and generate instant Receipt and Bill PDFs.
              </p>
            </Link>
          )}

          {/* Employee Action: New Gold Loan & Appraisal */}
          {isEmployee && (
            <Link
              href="/admin/loans/new"
              className="bg-white border border-gray-200 hover:border-amber-500 hover:shadow-md rounded-2xl p-5 transition space-y-2 group"
            >
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition">
                <Coins size={20} />
              </div>
              <h3 className="font-bold text-sm text-gray-900 font-outfit flex items-center justify-between">
                Gold Appraisal &amp; Loan Application
                <ArrowRight size={14} className="text-gray-400 group-hover:text-amber-600 transition" />
              </h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                Enter customer ornament weights, purity (24K, 22K, 21K, 18K), apply benchmark gold rates, and submit for Manager approval.
              </p>
            </Link>
          )}

          {/* Customer Registration */}
          <Link
            href="/employee/customers"
            className="bg-white border border-gray-200 hover:border-blue-500 hover:shadow-md rounded-2xl p-5 transition space-y-2 group"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition">
              <Users size={20} />
            </div>
            <h3 className="font-bold text-sm text-gray-900 font-outfit flex items-center justify-between">
              Customer Registry &amp; KYC
              <ArrowRight size={14} className="text-gray-400 group-hover:text-purple-600 transition" />
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              Register new borrower profiles, enter Aadhaar/PAN KYC documents, and inspect customer portfolios.
            </p>
          </Link>

          {/* Statements */}
          <Link
            href="/employee/statement"
            className="bg-white border border-gray-200 hover:border-blue-500 hover:shadow-md rounded-2xl p-5 transition space-y-2 group"
          >
            <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-600 group-hover:bg-sky-600 group-hover:text-white transition">
              <FileText size={20} />
            </div>
            <h3 className="font-bold text-sm text-gray-900 font-outfit flex items-center justify-between">
              Live Customer Statement
              <ArrowRight size={14} className="text-gray-400 group-hover:text-sky-600 transition" />
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              View customer loan balances, live accrued interest, payment ledger, and download official Consolidated Statement PDFs.
            </p>
          </Link>

          {/* Loan Directory */}
          <Link
            href="/employee/loans"
            className="bg-white border border-gray-200 hover:border-blue-500 hover:shadow-md rounded-2xl p-5 transition space-y-2 group"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition">
              <Coins size={20} />
            </div>
            <h3 className="font-bold text-sm text-gray-900 font-outfit flex items-center justify-between">
              Loans Directory &amp; Dossiers
              <ArrowRight size={14} className="text-gray-400 group-hover:text-indigo-600 transition" />
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              Browse branch loan accounts, inspect pawn tickets, collateral photographs, and outstanding balances.
            </p>
          </Link>
        </div>
      </div>

      {/* Pending Approvals Preview for Managers & Staff */}
      {recentApprovals.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2 font-outfit">
              <Clock size={16} className="text-amber-500" /> Pending Review Requests ({recentApprovals.length})
            </h2>
            {isManager && (
              <Link
                href="/employee/approvals"
                className="text-xs font-bold text-[#2563EB] hover:underline flex items-center gap-1"
              >
                Go to Approvals Desk <ArrowRight size={12} />
              </Link>
            )}
          </div>

          <div className="divide-y divide-gray-100">
            {recentApprovals.map((req) => (
              <div key={req.id} className="py-3 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-900">
                      {req.details?.customer_name || 'Customer'}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                      {req.request_type.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500">
                    Requested by <strong>{req.requested_by_name}</strong> ({req.requested_by_role}) &middot;{' '}
                    {req.requested_at ? new Date(req.requested_at).toLocaleString('en-IN') : 'Just now'}
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-sm font-bold text-gray-900 block font-outfit">
                    {formatINR(req.requested_amount || 0)}
                  </span>
                  {req.eligible_amount && (
                    <span className="text-[10px] text-gray-400">
                      Eligible: {formatINR(req.eligible_amount)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
