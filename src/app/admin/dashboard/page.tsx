'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
 Users, Coins, TrendingUp, AlertTriangle, ArrowUpRight, UserPlus,
 PlusCircle, ArrowRight, CalendarDays, PiggyBank, DollarSign,
 Target, CheckCircle, Activity, Receipt, Clock, Zap, BarChart3, Sparkles,
 MessageSquare, Send, Check, RefreshCw, Smartphone, CheckCheck, Bell
} from 'lucide-react';
import { getCurrentProfile } from '@/lib/auth';
import { getLoanStats, getLoansDueInRange, getOverdueLoans } from '@/lib/db/loans';
import { countProfiles } from '@/lib/db/profiles';
import { getCollectionStats, listPayments } from '@/lib/db/payments';
import { getGoldStats } from '@/lib/db/gold';
import { getNumericSetting } from '@/lib/db/settings';
import {
  getDueRemindersOverview,
  recordWhatsAppReminder,
  updateWhatsAppReminderStatus,
  type WhatsAppReminder,
  type ReminderStage,
} from '@/lib/db/reminders';

/* ─── Animated Counter Hook ────────────────────────────────────────── */
function useAnimatedCounter(target: number, duration = 1200) {
 const [count, setCount] = useState(0);
 const frameRef = useRef<number | undefined>(undefined);
 const prevTargetRef = useRef(target);

 useEffect(() => {
 if (prevTargetRef.current !== target) {
 prevTargetRef.current = target;
 }
 const start = performance.now();
 const animate = (now: number) => {
 const progress = Math.min((now - start) / duration, 1);
 const eased = 1 - Math.pow(1 - progress, 3);
 setCount(Math.floor(eased * target));
 if (progress < 1) {
 frameRef.current = requestAnimationFrame(animate);
 }
 };
 frameRef.current = requestAnimationFrame(animate);
 return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
 }, [target, duration]);

 return count;
}

/* ─── Mini Bar Chart (DB-backed) ───────────────────────────────────── */
function MiniBarChart({ data, color = '#2563EB', height = 48 }: { data: number[]; color?: string; height?: number }) {
 const max = Math.max(...data, 1);
 return (
 <div className="flex items-end gap-1 h-12">
 {data.map((v, i) => (
 <div
 key={i}
 className="flex-1 rounded-sm transition-all duration-300 hover:opacity-80"
 style={{
 height: `${(v / max) * 100}%`,
 backgroundColor: color,
 minHeight: '3px',
 }}
 />
 ))}
 </div>
 );
}

/* ═══════════════════════════════════════════════════════════════════ */
export default function AdminDashboard() {
 const router = useRouter();
 const [activeTab, setActiveTab] = useState<'operational' | 'analytics'>('operational');
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);

 /* ─── All Dashboard Metrics ─────────────────────────────────────── */
 const [metrics, setMetrics] = useState({
 totalCustomers: 0,
 activeCustomers: 0,
 totalLoans: 0,
 activeLoans: 0,
 closedLoans: 0,
 overdueLoans: 0,
 dueToday: 0,
 dueThisWeek: 0,
 totalPrincipalDisbursed: 0,
 totalOutstandingPrincipal: 0,
 totalInterestDue: 0,
 totalInterestCollected: 0,
 totalAmountCollected: 0,
 todayCollection: 0,
 monthCollection: 0,
 todayNewLoans: 0,
 totalGoldWeight: 0,
 totalGoldValue: 0,
 });

 const [transactions, setTransactions] = useState<any[]>([]);
 const [upcomingDues, setUpcomingDues] = useState<any[]>([]);
 const [overdueList, setOverdueList] = useState<any[]>([]);
 const [recentCustomers, setRecentCustomers] = useState<any[]>([]);
 const [collectionHistory, setCollectionHistory] = useState<number[]>([]);

 // WhatsApp Reminder Automation State
 const [reminderStageFilter, setReminderStageFilter] = useState<'all' | ReminderStage>('all');
 const [remindersOverview, setRemindersOverview] = useState<{
   due4Days: WhatsAppReminder[];
   due2Days: WhatsAppReminder[];
   due1Day: WhatsAppReminder[];
   dueToday: WhatsAppReminder[];
   overdue: WhatsAppReminder[];
   totalActionable: number;
 }>({
   due4Days: [],
   due2Days: [],
   due1Day: [],
   dueToday: [],
   overdue: [],
   totalActionable: 0,
 });
 const [sentReminderIds, setSentReminderIds] = useState<Set<string>>(new Set());

 useEffect(() => {
   async function loadDashboardData() {
     setLoading(true);
     setError(null);
     try {
       const adminProfile = await getCurrentProfile().catch(() => null);
       const branchId = adminProfile?.branch_id || undefined;

       // Loan stats from DB
       const loanStats = await getLoanStats(branchId).catch(() => ({
         active: 0, closed: 0, overdue: 0, dueToday: 0, dueThisWeek: 0, totalPrincipal: 0, totalOutstanding: 0
       }));

       // Customer counts
       const totalCustomers = await countProfiles({ role: 'Customer', branchId }).catch(() => 0);
       const activeCustomers = await countProfiles({ role: 'Customer', status: 'Active', branchId }).catch(() => 0);

       // Collection stats — today & month
       const todayStr = new Date().toISOString().split('T')[0];
       const monthStart = new Date();
       monthStart.setDate(1);
       const monthStartStr = monthStart.toISOString().split('T')[0];

       const todayCollections = await getCollectionStats({ fromDate: todayStr, toDate: todayStr, branchId }).catch(() => ({
         totalCollected: 0, interestCollected: 0, principalCollected: 0, paymentCount: 0
       }));
       const monthCollections = await getCollectionStats({ fromDate: monthStartStr, toDate: todayStr, branchId }).catch(() => ({
         totalCollected: 0, interestCollected: 0, principalCollected: 0, paymentCount: 0
       }));

       // Total loans count
       const allLoansResult = await import('@/lib/db/loans').then(m => m.listLoans({ branchId, pageSize: 500 })).catch(() => ({ loans: [], count: 0 }));
       const totalLoansCount = allLoansResult.count;

       // Closed loans count
       const closedLoansCount = allLoansResult.loans.filter(l => l.status === 'Settled').length;

       // Today's new loans
       const todayNewLoans = allLoansResult.loans.filter(l =>
         l.origination_date && l.origination_date.startsWith(todayStr)
       ).length;

       // Gold stats
       const goldStats = await getGoldStats().catch(() => ({ totalItems: 0, totalWeight: 0, totalValue: 0 }));

       // Total interest due = sum of outstanding_interest across active loans
       let totalInterestDue = 0;
       allLoansResult.loans.forEach(l => {
         if (['Active', 'Due', 'Overdue', 'Grace_Period'].includes(l.status)) {
           totalInterestDue += (l.outstanding_interest || 0);
         }
       });

       setMetrics({
         totalCustomers,
         activeCustomers,
         totalLoans: totalLoansCount,
         activeLoans: loanStats.active || allLoansResult.loans.filter(l => ['Active', 'Due', 'Overdue', 'Grace_Period'].includes(l.status)).length,
         closedLoans: closedLoansCount,
         overdueLoans: loanStats.overdue,
         dueToday: loanStats.dueToday,
         dueThisWeek: loanStats.dueThisWeek,
         totalPrincipalDisbursed: loanStats.totalPrincipal,
         totalOutstandingPrincipal: loanStats.totalOutstanding,
         totalInterestDue,
         totalInterestCollected: monthCollections.interestCollected,
         totalAmountCollected: monthCollections.totalCollected,
         todayCollection: todayCollections.totalCollected,
         monthCollection: monthCollections.totalCollected,
         todayNewLoans,
         totalGoldWeight: goldStats.totalWeight,
         totalGoldValue: goldStats.totalValue,
       });

       // Load WhatsApp due reminders overview
       try {
         const overview = await getDueRemindersOverview(branchId);
         setRemindersOverview(overview);
       } catch (remErr) {
         console.warn('Failed to load WhatsApp reminders overview:', remErr);
       }

       // Recent payments
       try {
         const paymentsRes = await listPayments({ pageSize: 8, branchId });
         const mappedTx = (paymentsRes.payments || []).map((p: any) => ({
           id: p.id,
           customer: p.customer?.name || 'Customer',
           loanId: p.loan?.loan_number || '—',
           amount: p.amount_paid,
           type: p.payment_type,
           date: p.payment_date,
         }));
         setTransactions(mappedTx);
       } catch (pmtErr) {
         console.warn('Failed to load recent payments:', pmtErr);
       }

       // Upcoming dues (next 7 days)
       try {
         const dueLoans = await getLoansDueInRange(todayStr, todayStr, branchId);
         const mappedToday = dueLoans.map((l: any) => ({
           id: l.id,
           customer: l.customer?.name || 'Customer',
           loanId: l.loan_number,
           dueDate: l.maturity_date,
           amount: l.principal_amount,
           outstanding: ((l.principal_amount || 0) - (l.total_principal_paid || 0)) + (l.outstanding_interest || 0),
           status: 'Due Today',
         }));
         setUpcomingDues(mappedToday);
       } catch (dueErr) {
         console.warn('Failed to load upcoming dues:', dueErr);
       }

       // Overdue loans
       try {
         const overdueLoans = await getOverdueLoans(branchId);
         const mappedOverdue = overdueLoans.slice(0, 8).map((l: any) => ({
           id: l.id,
           customer: l.customer?.name || 'Customer',
           loanId: l.loan_number,
           dueDate: l.maturity_date,
           amount: l.principal_amount,
           outstanding: ((l.principal_amount || 0) - (l.total_principal_paid || 0)) + (l.outstanding_interest || 0),
           daysOverdue: l.maturity_date ? Math.floor((Date.now() - new Date(l.maturity_date).getTime()) / 86400000) : 0,
         }));
         setOverdueList(mappedOverdue);
       } catch (odErr) {
         console.warn('Failed to load overdue list:', odErr);
       }

       // Collection history (last 7 days)
       try {
         const historyDays: number[] = [];
         for (let i = 6; i >= 0; i--) {
           const d = new Date();
           d.setDate(d.getDate() - i);
           const ds = d.toISOString().split('T')[0];
           const s = await getCollectionStats({ fromDate: ds, toDate: ds, branchId });
           historyDays.push(s.totalCollected);
         }
         setCollectionHistory(historyDays);
       } catch (histErr) {
         setCollectionHistory([0, 0, 0, 0, 0, 0, 0]);
       }

     } catch (err: any) {
       console.error('Dashboard data load failed:', err);
       setError(err?.message || 'Failed to load dashboard data from database.');
     } finally {
       setLoading(false);
     }
   }

   loadDashboardData();
 }, []);

 /* ─── Animated Counters ─────────────────────────────────────────── */
 const aTotalCustomers = useAnimatedCounter(metrics.totalCustomers);
 const aActiveLoans = useAnimatedCounter(metrics.activeLoans);
 const aClosedLoans = useAnimatedCounter(metrics.closedLoans);
 const aOverdue = useAnimatedCounter(metrics.overdueLoans);
 const aPrincipal = useAnimatedCounter(Math.round(metrics.totalPrincipalDisbursed), 1600);
 const aOutstanding = useAnimatedCounter(Math.round(metrics.totalOutstandingPrincipal), 1600);
 const aInterestDue = useAnimatedCounter(Math.round(metrics.totalInterestDue), 1400);
 const aTodayColl = useAnimatedCounter(Math.round(metrics.todayCollection), 1200);
 const aMonthColl = useAnimatedCounter(Math.round(metrics.monthCollection), 1600);

 const formatINR = (v: number) => `Rs. ${v.toLocaleString('en-IN')}`;

 /* ─── KPI Card Data ─────────────────────────────────────────────── */
 const kpiCards = [
 { label: 'Total Customers', value: aTotalCustomers, icon: Users, color: 'text-[#2563EB]', bg: 'bg-[#2563EB]/10', accent: '#2563EB' },
 { label: 'Active Customers', value: metrics.activeCustomers, icon: UserPlus, color: 'text-emerald-600', bg: 'bg-emerald-500/10', accent: '#22c55e' },
 { label: 'Active Loans', value: aActiveLoans, icon: Coins, color: 'text-[#2563EB]', bg: 'bg-[#2563EB]/10', accent: '#2563EB' },
 { label: 'Closed Loans', value: aClosedLoans, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-500/10', accent: '#22c55e' },
 { label: 'Overdue Loans', value: aOverdue, icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-500/10', accent: '#ef4444' },
 { label: 'Due Today', value: metrics.dueToday, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10', accent: '#f59e0b' },
 { label: 'Due This Week', value: metrics.dueThisWeek, icon: CalendarDays, color: 'text-purple-500', bg: 'bg-purple-500/10', accent: '#a855f7' },
 { label: 'Today\'s New Loans', value: metrics.todayNewLoans, icon: PlusCircle, color: 'text-[#2563EB]', bg: 'bg-[#2563EB]/10', accent: '#2563EB' },
 { label: 'Total Disbursed', value: formatINR(aPrincipal), icon: DollarSign, color: 'text-[#2563EB]', bg: 'bg-[#2563EB]/10', accent: '#2563EB', isCurrency: true },
 { label: 'Outstanding Principal', value: formatINR(aOutstanding), icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-500/10', accent: '#d97706', isCurrency: true },
{ label: 'Interest Due', value: formatINR(aInterestDue), icon: PiggyBank, color: 'text-red-500', bg: 'bg-red-500/10', accent: '#ef4444', isCurrency: true },
 { label: 'Total Interest Collected', value: formatINR(aMonthColl), icon: Receipt, color: 'text-emerald-600', bg: 'bg-emerald-500/10', accent: '#22c55e', isCurrency: true },
 { label: 'Today\'s Collection', value: formatINR(aTodayColl), icon: Zap, color: 'text-emerald-600', bg: 'bg-emerald-500/10', accent: '#22c55e', isCurrency: true },
 { label: 'Month Collection', value: formatINR(aMonthColl), icon: TrendingUp, color: 'text-[#2563EB]', bg: 'bg-[#2563EB]/10', accent: '#2563EB', isCurrency: true },
 { label: 'Gold Weight (Net)', value: `${metrics.totalGoldWeight.toFixed(2)}g`, icon: Coins, color: 'text-amber-600', bg: 'bg-amber-500/10', accent: '#d97706' },
 { label: 'Gold Valuation', value: formatINR(metrics.totalGoldValue), icon: Target, color: 'text-[#2563EB]', bg: 'bg-[#2563EB]/10', accent: '#2563EB', isCurrency: true },
 ];

  /* ─── WhatsApp Dispatch Handler ─────────────────────────────────── */
  const handleDispatchWhatsApp = async (reminder: WhatsAppReminder) => {
    if (!reminder.customer_phone) {
      alert(`Customer ${reminder.customer_name} has no primary phone number registered.`);
      return;
    }

    try {
      await recordWhatsAppReminder({
        loan_id: reminder.loan_id,
        loan_number: reminder.loan_number,
        customer_id: reminder.customer_id,
        customer_name: reminder.customer_name,
        customer_phone: reminder.customer_phone,
        due_date: reminder.due_date,
        days_remaining: reminder.days_remaining,
        stage: reminder.stage,
        payable_amount: reminder.payable_amount,
        message_text: reminder.message_text,
        whatsapp_url: reminder.whatsapp_url,
        status: 'Sent',
        sent_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      setSentReminderIds(prev => new Set(prev).add(reminder.loan_id + '_' + reminder.stage));
      window.open(reminder.whatsapp_url, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      console.error('Failed to log WhatsApp reminder:', err);
      window.open(reminder.whatsapp_url, '_blank', 'noopener,noreferrer');
    }
  };

  // Filter actionable reminders
  const allActionableReminders = useMemo(() => {
    const list: WhatsAppReminder[] = [
      ...remindersOverview.dueToday,
      ...remindersOverview.due1Day,
      ...remindersOverview.due2Days,
      ...remindersOverview.due4Days,
      ...remindersOverview.overdue,
    ];
    if (reminderStageFilter === 'all') return list;
    return list.filter(r => r.stage === reminderStageFilter);
  }, [remindersOverview, reminderStageFilter]);

  /* ─── Loading / Error States ────────────────────────────────────── */
 if (loading) {
 return (
 <div className="space-y-6 pb-12">
 <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
 {Array.from({ length: 16 }).map((_, i) => (
 <div key={i} className="bg-white border border-gray-200 rounded-xl p-5 animate-pulse">
 <div className="h-3 bg-gray-200 rounded w-3/4 mb-3" />
 <div className="h-8 bg-gray-200 rounded w-1/2" />
 </div>
 ))}
 </div>
 </div>
 );
 }

 const now = new Date();
 const greeting = now.getHours() < 12 ? 'Good Morning' : now.getHours() < 17 ? 'Good Afternoon' : 'Good Evening';
 const dateStr = now.toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

 return (
 <div className="space-y-6 sm:space-y-8 pb-12 animate-fade-in">

 {/* Error warning banner — shown when DB data load fails */}
 {error && (
 <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
 <AlertTriangle size={20} className="text-amber-500 mt-0.5 flex-shrink-0" />
 <div>
 <p className="text-sm font-semibold text-amber-800">Dashboard data could not be loaded from the database</p>
 <p className="text-xs text-amber-600 mt-1">{error}</p>
 <p className="text-xs text-amber-500 mt-1">All values shown are zero. Please check your Firebase connection and Firestore permissions.</p>
 <button onClick={() => window.location.reload()} className="mt-2 text-xs font-medium text-amber-700 underline hover:text-amber-900">Retry</button>
 </div>
 </div>
 )}

 {/* ─── Welcome Banner ────────────────────────────────────────── */}
 <div className="relative overflow-hidden rounded-xl sm:rounded-2xl bg-gradient-to-br from-white via-slate-50 to-gray-100 border border-gray-200 p-4 sm:p-6 lg:p-8">
 <div className="absolute top-0 right-0 w-64 h-64 bg-[#2563EB]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
 <div className="relative flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
 <div>
 <div className="flex items-center gap-2 mb-1">
 <Sparkles size={14} className="text-[#2563EB]" />
 <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#2563EB]/80">{greeting}</span>
 </div>
 <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 tracking-wide font-outfit">Financial Workspace</h2>
 <div className="flex items-center gap-3 mt-2 flex-wrap">
 <p className="text-gray-500 text-xs">{dateStr}</p>
 <span className="text-gray-300 hidden sm:inline">•</span>
 <div className="flex items-center gap-1.5">
 <span className="relative flex h-2 w-2">
 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-600 opacity-75" />
 <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
 </span>
 <span className="text-[10px] text-emerald-600 font-semibold tracking-wider uppercase">Systems Online</span>
 </div>
 </div>
 </div>
 <div className="flex gap-2 sm:gap-3 w-full sm:w-auto">
 <button onClick={() => router.push('/admin/customers/new')} className="group flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] hover:from-[#3B82F6] hover:to-[#2563EB] text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-[#2563EB]/15 hover:shadow-[#2563EB]/30 hover:scale-[1.02] active:scale-[0.98]">
 <UserPlus size={14} className="group-hover:rotate-12 transition-transform" />
 <span className="hidden sm:inline">Onboard Client</span>
 <span className="sm:hidden">Onboard</span>
 </button>
 <button onClick={() => router.push('/admin/loans/new')} className="group flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-[#2563EB] border border-[#2563EB]/20 text-xs font-bold rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]">
 <PlusCircle size={14} className="group-hover:rotate-90 transition-transform duration-300" />
 <span className="hidden sm:inline">New Loan</span>
 <span className="sm:hidden">Loan</span>
 </button>
 </div>
 </div>
 </div>

 {/* ─── KPI Metrics Grid ──────────────────────────────────────── */}
 <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
 {kpiCards.map((m, i) => {
 const Icon = m.icon;
 return (
 <div key={i} className="group bg-white border border-gray-200 hover:border-[#2563EB]/20 rounded-xl p-4 sm:p-5 transition-all duration-300 hover:shadow-md">
 <div className="flex items-center justify-between mb-2">
 <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">{m.label}</span>
 <div className={`p-1.5 rounded-lg ${m.bg} ${m.color}`}>
 <Icon size={14} />
 </div>
 </div>
 <p className={`text-lg sm:text-xl font-bold text-gray-900 tracking-tight font-outfit ${m.isCurrency ? 'text-sm sm:text-base' : ''}`}>{m.value}</p>
 </div>
 );
 })}
 </div>

 {/* ─── Tab Navigation ────────────────────────────────────────── */}
 <div className="flex bg-white border border-gray-200 rounded-xl p-1">
 <button onClick={() => setActiveTab('operational')} className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold rounded-lg transition-all ${activeTab === 'operational' ? 'bg-[#2563EB] text-white shadow' : 'text-gray-500 hover:text-gray-900'}`}>
 <Activity size={14} /> Operational Desk
 </button>
 <button onClick={() => setActiveTab('analytics')} className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold rounded-lg transition-all ${activeTab === 'analytics' ? 'bg-[#2563EB] text-white shadow' : 'text-gray-500 hover:text-gray-900'}`}>
 <BarChart3 size={14} /> Analytics
 </button>
 </div>

 {/* ─── Operational Tab ───────────────────────────────────────── */}
 {activeTab === 'operational' && (
 <div className="space-y-6">

  {/* ═══════════════════════════════════════════════════════════════════ */}
  {/* WhatsApp Due Reminder Automation Section                        */}
  {/* ═══════════════════════════════════════════════════════════════════ */}
  <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 shadow-sm">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-gray-100">
      <div>
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
            <Smartphone size={18} />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900 font-outfit flex items-center gap-2">
              Loan Due Reminder & WhatsApp Dispatch
              {remindersOverview.totalActionable > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-red-100 text-red-700 font-mono font-bold">
                  {remindersOverview.totalActionable} Actionable
                </span>
              )}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Automated multi-stage alerts (4 Days, 2 Days, 1 Day, Due Today & Overdue) with one-click Tamil/English WhatsApp delivery.
            </p>
          </div>
        </div>
      </div>

      <button
        onClick={() => router.push('/admin/settings')}
        className="text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 transition self-start sm:self-center"
      >
        Customize Template
      </button>
    </div>

    {/* Stage Filter Pills */}
    <div className="flex flex-wrap gap-2 mt-4">
      {[
        { key: 'all', label: 'All Reminders', count: remindersOverview.totalActionable, color: 'bg-gray-100 text-gray-700' },
        { key: '4_days_before', label: 'Due in 4 Days', count: remindersOverview.due4Days.length, color: 'bg-blue-50 text-blue-700 border-blue-200' },
        { key: '2_days_before', label: 'Due in 2 Days', count: remindersOverview.due2Days.length, color: 'bg-purple-50 text-purple-700 border-purple-200' },
        { key: '1_day_before', label: 'Due Tomorrow (1 Day)', count: remindersOverview.due1Day.length, color: 'bg-amber-50 text-amber-700 border-amber-200' },
        { key: 'due_today', label: 'Due Today', count: remindersOverview.dueToday.length, color: 'bg-orange-50 text-orange-700 border-orange-200' },
        { key: 'overdue', label: 'Overdue Alert', count: remindersOverview.overdue.length, color: 'bg-red-50 text-red-700 border-red-200' },
      ].map(tab => (
        <button
          key={tab.key}
          onClick={() => setReminderStageFilter(tab.key as any)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
            reminderStageFilter === tab.key
              ? 'bg-[#0A192F] text-white border-[#0A192F] shadow-sm'
              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
          }`}
        >
          <span>{tab.label}</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${reminderStageFilter === tab.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-700'}`}>
            {tab.count}
          </span>
        </button>
      ))}
    </div>

    {/* Reminders Cards Grid */}
    <div className="mt-4">
      {allActionableReminders.length === 0 ? (
        <div className="p-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <CheckCheck size={28} className="mx-auto text-emerald-500 mb-2" />
          <p className="text-xs font-semibold text-gray-700">All loan dues are clear!</p>
          <p className="text-[11px] text-gray-400 mt-0.5">No customer loans match this reminder stage today.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {allActionableReminders.map((rem, idx) => {
            const isSent = sentReminderIds.has(rem.loan_id + '_' + rem.stage);
            const isOverdue = rem.stage === 'overdue';
            const isDueToday = rem.stage === 'due_today';

            return (
              <div
                key={idx}
                className={`p-4 rounded-xl border transition-all ${
                  isOverdue
                    ? 'bg-red-50/40 border-red-200 hover:border-red-300'
                    : isDueToday
                    ? 'bg-amber-50/40 border-amber-200 hover:border-amber-300'
                    : 'bg-white border-gray-200 hover:border-blue-200'
                }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <h4 className="text-xs font-bold text-gray-900">{rem.customer_name}</h4>
                    <p className="text-[11px] font-mono text-gray-500">{rem.loan_number}</p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider ${
                      isOverdue
                        ? 'bg-red-100 text-red-700'
                        : isDueToday
                        ? 'bg-amber-100 text-amber-700'
                        : rem.stage === '1_day_before'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {rem.stage === '4_days_before'
                      ? 'Due in 4d'
                      : rem.stage === '2_days_before'
                      ? 'Due in 2d'
                      : rem.stage === '1_day_before'
                      ? 'Due Tomorrow'
                      : rem.stage === 'due_today'
                      ? 'Due Today'
                      : 'Overdue'}
                  </span>
                </div>

                {/* Amount & Due Date */}
                <div className="grid grid-cols-2 gap-2 py-2 my-2 border-y border-gray-100 text-xs">
                  <div>
                    <span className="text-[10px] text-gray-400 block">Due Date</span>
                    <span className="font-semibold text-gray-800">{rem.due_date}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-gray-400 block">Payable Amount</span>
                    <span className="font-bold text-gray-900">{formatINR(rem.payable_amount)}</span>
                  </div>
                </div>

                {/* Contact phone */}
                <div className="text-[11px] text-gray-500 mb-3 flex items-center justify-between">
                  <span>Phone: <strong className="font-mono text-gray-700">{rem.customer_phone || 'N/A'}</strong></span>
                  {isSent ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                      <Check size={10} /> Sent Today
                    </span>
                  ) : (
                    <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded font-semibold">
                      Pending Dispatch
                    </span>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleDispatchWhatsApp(rem)}
                    disabled={!rem.customer_phone}
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold shadow-sm transition active:scale-95 ${
                      isSent
                        ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    } disabled:opacity-50`}
                  >
                    <Smartphone size={13} />
                    <span>{isSent ? 'Resend WA' : 'Send WhatsApp'}</span>
                  </button>

                  <button
                    onClick={() => router.push(`/admin/payments?loanId=${rem.loan_number}`)}
                    className="flex items-center justify-center gap-1 py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition active:scale-95"
                  >
                    <span>Collect</span>
                    <ArrowRight size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  </div>

 <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
 {/* Recent Transactions */}
 <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-4 sm:p-6">
 <div className="flex justify-between items-center border-b border-gray-200 pb-3 mb-4">
 <h3 className="text-sm font-semibold text-[#2563EB] font-outfit">Recent Payments</h3>
 <button onClick={() => router.push('/admin/payments')} className="text-xs text-gray-500 hover:text-[#2563EB] flex items-center gap-1">View All <ArrowUpRight size={12} /></button>
 </div>
 {transactions.length === 0 ? (
 <p className="text-xs text-gray-400 text-center py-8">No payments recorded yet.</p>
 ) : (
 <div className="overflow-x-auto">
 <table className="w-full text-left text-xs">
 <thead><tr className="text-gray-400 uppercase tracking-wider border-b border-gray-200">
 <th className="pb-2 font-semibold text-[10px]">Customer</th>
 <th className="pb-2 font-semibold text-[10px] hidden sm:table-cell">Loan</th>
 <th className="pb-2 font-semibold text-[10px]">Type</th>
 <th className="pb-2 font-semibold text-[10px] text-right">Amount</th>
 <th className="pb-2 font-semibold text-[10px] text-right hidden md:table-cell">Date</th>
 </tr></thead>
 <tbody className="divide-y divide-gray-100">
 {transactions.map((tx) => (
 <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
 <td className="py-2.5 font-medium text-gray-900">{tx.customer}</td>
 <td className="py-2.5 font-mono text-gray-500 hidden sm:table-cell">{tx.loanId}</td>
 <td className="py-2.5">
 <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${tx.type === 'Interest' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
 {tx.type}
 </span>
 </td>
 <td className="py-2.5 text-right font-semibold text-gray-900">{formatINR(tx.amount)}</td>
 <td className="py-2.5 text-right text-gray-400 text-[10px] hidden md:table-cell">{new Date(tx.date).toLocaleDateString('en-IN')}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 )}
 </div>

 {/* Right Column: Dues & Alerts */}
 <div className="space-y-4">
 {/* Due Today */}
 <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6">
 <h3 className="text-sm font-semibold text-[#2563EB] font-outfit mb-4 flex items-center gap-2">
 <Clock size={14} className="text-amber-500" /> Due Today ({metrics.dueToday})
 </h3>
 {upcomingDues.length === 0 ? (
 <p className="text-xs text-gray-400 text-center py-4">No loans due today.</p>
 ) : (
 <div className="space-y-3">
 {upcomingDues.map((d) => (
 <div key={d.id} className="p-3 rounded-lg bg-amber-50/50 border border-amber-200/50 hover:border-amber-300 transition-all">
 <div className="flex justify-between items-start">
 <div>
 <p className="text-xs font-semibold text-gray-900">{d.customer}</p>
 <p className="text-[10px] text-gray-500 font-mono">{d.loanId}</p>
 </div>
 <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded">Due</span>
 </div>
 <div className="flex justify-between items-center mt-2 pt-2 border-t border-amber-200/40">
 <span className="text-[10px] text-gray-500">Outstanding</span>
 <span className="text-xs font-bold text-gray-900">{formatINR(d.outstanding)}</span>
 </div>
 <button onClick={() => router.push(`/admin/payments?loanId=${d.loanId}`)} className="w-full mt-2 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[10px] font-bold rounded-lg transition-colors">
 Collect Payment
 </button>
 </div>
 ))}
 </div>
 )}
 </div>

 {/* Overdue Loans */}
 <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6">
 <h3 className="text-sm font-semibold text-red-500 font-outfit mb-4 flex items-center gap-2">
 <AlertTriangle size={14} /> Overdue ({metrics.overdueLoans})
 </h3>
 {overdueList.length === 0 ? (
 <p className="text-xs text-gray-400 text-center py-4">No overdue loans.</p>
 ) : (
 <div className="space-y-3 max-h-64 overflow-y-auto">
 {overdueList.map((d) => (
 <div key={d.id} className="p-3 rounded-lg bg-red-50/50 border border-red-200/50">
 <div className="flex justify-between items-start">
 <div>
 <p className="text-xs font-semibold text-gray-900">{d.customer}</p>
 <p className="text-[10px] text-gray-500 font-mono">{d.loanId}</p>
 </div>
 <span className="text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded">{d.daysOverdue}d overdue</span>
 </div>
 <div className="flex justify-between items-center mt-2 text-[10px]">
 <span className="text-gray-500">Outstanding</span>
 <span className="font-bold text-gray-900">{formatINR(d.outstanding)}</span>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 </div>
 </div>
 </div>
 )}

 {/* ─── Analytics Tab ─────────────────────────────────────────── */}
 {activeTab === 'analytics' && (
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
 {/* Collection Trend */}
 <div className="bg-white border border-gray-200 rounded-xl p-6">
 <h3 className="text-sm font-semibold text-[#2563EB] font-outfit mb-1">Collection Trend (Last 7 Days)</h3>
 <p className="text-[10px] text-gray-400 mb-4">Daily payment collections in INR</p>
 <MiniBarChart
 data={collectionHistory}
 color="#2563EB"
 height={120}
 />
 <div className="flex justify-between mt-2 text-[10px] text-gray-400">
 {['7d ago', '6d', '5d', '4d', '3d', '2d', 'Today'].map((l, i) => (
 <span key={i}>{l}</span>
 ))}
 </div>
 </div>

 {/* Loan Status Distribution */}
 <div className="bg-white border border-gray-200 rounded-xl p-6">
 <h3 className="text-sm font-semibold text-[#2563EB] font-outfit mb-1">Loan Portfolio Overview</h3>
 <p className="text-[10px] text-gray-400 mb-4">Distribution across loan lifecycle stages</p>
 <div className="space-y-3">
 {[
 { label: 'Active', value: metrics.activeLoans, color: 'bg-[#2563EB]', pct: metrics.totalLoans ? (metrics.activeLoans / metrics.totalLoans * 100) : 0 },
 { label: 'Closed / Settled', value: metrics.closedLoans, color: 'bg-emerald-500', pct: metrics.totalLoans ? (metrics.closedLoans / metrics.totalLoans * 100) : 0 },
 { label: 'Overdue', value: metrics.overdueLoans, color: 'bg-red-500', pct: metrics.totalLoans ? (metrics.overdueLoans / metrics.totalLoans * 100) : 0 },
 { label: 'Due Today', value: metrics.dueToday, color: 'bg-amber-500', pct: metrics.totalLoans ? (metrics.dueToday / metrics.totalLoans * 100) : 0 },
 ].map((s) => (
 <div key={s.label}>
 <div className="flex justify-between text-xs mb-1">
 <span className="font-medium text-gray-700">{s.label}</span>
 <span className="text-gray-500">{s.value} ({s.pct.toFixed(1)}%)</span>
 </div>
 <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
 <div className={`h-full ${s.color} rounded-full transition-all duration-700`} style={{ width: `${s.pct}%` }} />
 </div>
 </div>
 ))}
 </div>
 </div>

 {/* Financial Summary */}
 <div className="bg-white border border-gray-200 rounded-xl p-6">
 <h3 className="text-sm font-semibold text-[#2563EB] font-outfit mb-4">Financial Position</h3>
 <div className="space-y-4">
 {[
 { label: 'Total Disbursed Principal', value: formatINR(metrics.totalPrincipalDisbursed), sub: `${metrics.activeLoans} active loans` },
 { label: 'Outstanding Principal', value: formatINR(metrics.totalOutstandingPrincipal), sub: `${((metrics.totalOutstandingPrincipal / Math.max(metrics.totalPrincipalDisbursed, 1)) * 100).toFixed(1)}% of disbursed` },
 { label: 'Interest Due (Pending)', value: formatINR(metrics.totalInterestDue), sub: 'Accrued but not collected' },
 { label: 'Interest Collected (MTD)', value: formatINR(metrics.totalInterestCollected), sub: 'Month to date' },
 { label: 'Gold Collateral Value', value: formatINR(metrics.totalGoldValue), sub: `${metrics.totalGoldWeight.toFixed(2)}g net weight` },
 ].map((item) => (
 <div key={item.label} className="flex justify-between items-start py-2 border-b border-gray-100 last:border-0">
 <div>
 <p className="text-xs font-medium text-gray-700">{item.label}</p>
 <p className="text-[10px] text-gray-400">{item.sub}</p>
 </div>
 <p className="text-sm font-bold text-gray-900 text-right">{item.value}</p>
 </div>
 ))}
 </div>
 </div>

 {/* Payment Method Distribution */}
 <div className="bg-white border border-gray-200 rounded-xl p-6">
 <h3 className="text-sm font-semibold text-[#2563EB] font-outfit mb-1">Collection Efficiency</h3>
 <p className="text-[10px] text-gray-400 mb-4">Performance indicators</p>
 <div className="grid grid-cols-2 gap-4">
 {[
 { label: 'Today\'s Collection', value: formatINR(metrics.todayCollection), icon: Zap },
 { label: 'Monthly Collection', value: formatINR(metrics.monthCollection), icon: CalendarDays },
 { label: 'Total Collected', value: formatINR(metrics.totalAmountCollected), icon: TrendingUp },
 { label: 'Total Loans', value: metrics.totalLoans, icon: Coins },
 ].map((s) => {
 const SIcon = s.icon;
 return (
 <div key={s.label} className="p-4 bg-gray-50 rounded-xl">
 <SIcon size={16} className="text-[#2563EB] mb-2" />
 <p className="text-lg font-bold text-gray-900">{s.value}</p>
 <p className="text-[10px] text-gray-500">{s.label}</p>
 </div>
 );
 })}
 </div>
 </div>
 </div>
 )}
 </div>
 );
}
