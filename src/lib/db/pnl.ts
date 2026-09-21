// src/lib/db/pnl.ts
// Profit & Loss calculation and reporting engine for Pavithra Gold Finance (PGF).
// Strictly enforces double-entry fintech rules:
// - Revenue: Only interest income, penalties, and processing fees are recognized.
// - Principal repayments are balance-sheet assets and are STRICTLY EXCLUDED from P&L revenue.
// - Expenses: Only approved/posted operational expenses are included.
// - Net Profit / Loss = Recognized Revenue - Recognized Expenses.

import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import type {
  Payment,
  Expense,
  DailyPnLReport,
  MonthlyPnLReport,
  YearlyPnLReport,
  PnLDashboardMetrics,
} from '@/types/database';
import { listExpenses } from '@/lib/db/expenses';

/**
 * Safely round to 2 decimal financial precision.
 */
function round2(val: number): number {
  return Math.round((Number(val) || 0) * 100) / 100;
}

/**
 * Extract YYYY-MM-DD date part from ISO string.
 */
function extractDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  return dateStr.split('T')[0];
}

/**
 * Fetch payments for a date range and optional branch filter.
 */
async function fetchPaymentsInRange(
  fromDate?: string,
  toDate?: string,
  branchId?: string
): Promise<Payment[]> {
  try {
    const q = collection(db, 'payments');
    const snap = await getDocs(q);
    let items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Payment));

    // Filter by branch if specified
    if (branchId && branchId !== 'all') {
      items = items.filter((p) => p.branch_id === branchId || (p as any).loan?.branch_id === branchId);
    }

    // Filter by date range
    if (fromDate) {
      items = items.filter((p) => extractDate(p.payment_date) >= fromDate);
    }
    if (toDate) {
      items = items.filter((p) => extractDate(p.payment_date) <= toDate);
    }

    // Exclude reversed payments
    items = items.filter((p) => p.status !== 'REVERSED');

    return items;
  } catch (err) {
    console.error('[PnL] Error fetching payments:', err);
    return [];
  }
}

/**
 * Calculate Daily Profit & Loss for a specific date (YYYY-MM-DD).
 */
export async function getDailyPnL(
  dateOrOptions: string | { date: string; branchId?: string },
  explicitBranchId?: string
): Promise<DailyPnLReport> {
  const targetDate = typeof dateOrOptions === 'string' ? dateOrOptions : dateOrOptions.date;
  const branchId = typeof dateOrOptions === 'string' ? explicitBranchId : dateOrOptions.branchId;

  // 1. Fetch Revenue (Payments on target date)
  const payments = await fetchPaymentsInRange(targetDate, targetDate, branchId);

  let interestIncome = 0;
  let penaltyIncome = 0;
  let processingFees = 0;
  let otherIncome = 0;

  payments.forEach((p) => {
    interestIncome += p.interest_portion || 0;
    penaltyIncome += p.penalty_amount || 0;
    if ((p as any).processing_fee) {
      processingFees += (p as any).processing_fee || 0;
    }
  });

  const totalIncome = round2(interestIncome + penaltyIncome + processingFees + otherIncome);

  // 2. Fetch Operational Expenses on target date (only Posted/Approved)
  const allExpenses = await listExpenses({
    date: targetDate,
    branchId: branchId && branchId !== 'all' ? branchId : undefined,
  });

  // Include only Posted or Approved expenses
  const qualifyingExpenses = allExpenses.filter(
    (e) => e.status === 'Posted' || e.status === 'Approved'
  );

  let totalExpenses = 0;
  const categoryMap = new Map<string, { count: number; amount: number }>();

  qualifyingExpenses.forEach((e) => {
    totalExpenses += e.amount || 0;
    const cat = e.category || 'Other';
    const curr = categoryMap.get(cat) || { count: 0, amount: 0 };
    categoryMap.set(cat, {
      count: curr.count + 1,
      amount: round2(curr.amount + e.amount),
    });
  });

  totalExpenses = round2(totalExpenses);
  const netProfitLoss = round2(totalIncome - totalExpenses);
  const isProfit = netProfitLoss >= 0;

  const expenseBreakdown = Array.from(categoryMap.entries()).map(([category, val]) => ({
    category,
    count: val.count,
    amount: val.amount,
  }));

  expenseBreakdown.sort((a, b) => b.amount - a.amount);

  const summary = { totalIncome, totalExpenses, netProfitLoss, isProfit };

  return {
    reportReference: `PGF-PNL-D-${targetDate.replace(/-/g, '')}`,
    generatedAt: new Date().toISOString(),
    date: targetDate,
    branchId: branchId && branchId !== 'all' ? branchId : undefined,
    branchName: branchId && branchId !== 'all' ? 'Branch' : 'All Branches (Consolidated)',
    totalIncome,
    totalExpenses,
    netProfitLoss,
    isProfit,
    summary,
    incomeBreakdown: {
      interestIncome: round2(interestIncome),
      penaltyIncome: round2(penaltyIncome),
      processingFees: round2(processingFees),
      otherIncome: round2(otherIncome),
    },
    expenseBreakdown,
    expenses: qualifyingExpenses,
    expenseItems: qualifyingExpenses,
  };
}

/**
 * Calculate Monthly Profit & Loss with day-by-day trend.
 */
export async function getMonthlyPnL(
  yearOrOptions: number | { year: number; month: number; branchId?: string },
  monthArg?: number,
  branchIdArg?: string
): Promise<MonthlyPnLReport> {
  const year = typeof yearOrOptions === 'number' ? yearOrOptions : yearOrOptions.year;
  const month = typeof yearOrOptions === 'number' ? (monthArg || 1) : yearOrOptions.month;
  const branchId = typeof yearOrOptions === 'number' ? branchIdArg : yearOrOptions.branchId;

  const monthStr = String(month).padStart(2, '0');
  const daysInMonth = new Date(year, month, 0).getDate();
  const fromDate = `${year}-${monthStr}-01`;
  const toDate = `${year}-${monthStr}-${String(daysInMonth).padStart(2, '0')}`;

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthName = `${monthNames[month - 1]} ${year}`;

  // 1. Fetch all payments in month
  const payments = await fetchPaymentsInRange(fromDate, toDate, branchId);

  // 2. Fetch all expenses in month
  const allExpenses = await listExpenses({
    fromDate,
    toDate,
    branchId: branchId && branchId !== 'all' ? branchId : undefined,
  });
  const qualifyingExpenses = allExpenses.filter(
    (e) => e.status === 'Posted' || e.status === 'Approved'
  );

  // Group by day (1 to daysInMonth)
  const dailyIncomeMap = new Map<number, number>();
  const dailyExpenseMap = new Map<number, number>();
  const categoryMap = new Map<string, { count: number; amount: number }>();

  payments.forEach((p) => {
    const day = parseInt(extractDate(p.payment_date).split('-')[2] || '1', 10);
    const inc = (p.interest_portion || 0) + (p.penalty_amount || 0) + ((p as any).processing_fee || 0);
    dailyIncomeMap.set(day, (dailyIncomeMap.get(day) || 0) + inc);
  });

  qualifyingExpenses.forEach((e) => {
    const day = parseInt((e.date || '').split('-')[2] || '1', 10);
    dailyExpenseMap.set(day, (dailyExpenseMap.get(day) || 0) + (e.amount || 0));

    const cat = e.category || 'Other';
    const curr = categoryMap.get(cat) || { count: 0, amount: 0 };
    categoryMap.set(cat, {
      count: curr.count + 1,
      amount: round2(curr.amount + e.amount),
    });
  });

  let totalIncome = 0;
  let totalExpenses = 0;

  const dailyTrend: MonthlyPnLReport['dailyTrend'] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dStr = `${year}-${monthStr}-${String(d).padStart(2, '0')}`;
    const inc = round2(dailyIncomeMap.get(d) || 0);
    const exp = round2(dailyExpenseMap.get(d) || 0);
    const net = round2(inc - exp);

    totalIncome += inc;
    totalExpenses += exp;

    dailyTrend.push({
      date: dStr,
      day: d,
      income: inc,
      expenses: exp,
      netProfitLoss: net,
      isProfit: net >= 0,
    });
  }

  totalIncome = round2(totalIncome);
  totalExpenses = round2(totalExpenses);
  const netProfitLoss = round2(totalIncome - totalExpenses);

  const expenseBreakdown = Array.from(categoryMap.entries()).map(([category, val]) => ({
    category,
    count: val.count,
    amount: val.amount,
  }));
  expenseBreakdown.sort((a, b) => b.amount - a.amount);

  const summary = { totalIncome, totalExpenses, netProfitLoss, isProfit: netProfitLoss >= 0 };

  return {
    reportReference: `PGF-PNL-M-${year}${monthStr}`,
    generatedAt: new Date().toISOString(),
    year,
    month,
    monthName,
    branchId: branchId && branchId !== 'all' ? branchId : undefined,
    branchName: branchId && branchId !== 'all' ? 'Branch' : 'All Branches (Consolidated)',
    totalIncome,
    totalExpenses,
    netProfitLoss,
    isProfit: netProfitLoss >= 0,
    summary,
    expenseBreakdown,
    dailyTrend,
  };
}

/**
 * Calculate Yearly Profit & Loss for an Indian Financial Year (April 1 to March 31).
 * e.g. "2026-27" -> April 2026 to March 2027.
 */
export async function getYearlyPnL(
  fyOrOptions?: string | { financialYear?: string; financialYearStart?: number; branchId?: string },
  branchIdArg?: string
): Promise<YearlyPnLReport> {
  let financialYear = '2026-27';
  let branchId = branchIdArg;

  if (typeof fyOrOptions === 'string') {
    financialYear = fyOrOptions;
  } else if (fyOrOptions && typeof fyOrOptions === 'object') {
    branchId = fyOrOptions.branchId;
    if (fyOrOptions.financialYear) {
      financialYear = fyOrOptions.financialYear;
    } else if (fyOrOptions.financialYearStart) {
      financialYear = `${fyOrOptions.financialYearStart}-${String(fyOrOptions.financialYearStart + 1).slice(2)}`;
    }
  }

  const parts = financialYear.split('-');
  const startYear = parseInt(parts[0], 10) || 2026;
  const endYear = startYear + 1;

  const fromDate = `${startYear}-04-01`;
  const toDate = `${endYear}-03-31`;

  // Fetch payments and expenses in financial year
  const payments = await fetchPaymentsInRange(fromDate, toDate, branchId);
  const allExpenses = await listExpenses({
    fromDate,
    toDate,
    branchId: branchId && branchId !== 'all' ? branchId : undefined,
  });
  const qualifyingExpenses = allExpenses.filter(
    (e) => e.status === 'Posted' || e.status === 'Approved'
  );

  // 12 Months: April (startYear) to March (endYear)
  const monthOrder = [
    { name: 'April', year: startYear, month: 4 },
    { name: 'May', year: startYear, month: 5 },
    { name: 'June', year: startYear, month: 6 },
    { name: 'July', year: startYear, month: 7 },
    { name: 'August', year: startYear, month: 8 },
    { name: 'September', year: startYear, month: 9 },
    { name: 'October', year: startYear, month: 10 },
    { name: 'November', year: startYear, month: 11 },
    { name: 'December', year: startYear, month: 12 },
    { name: 'January', year: endYear, month: 1 },
    { name: 'February', year: endYear, month: 2 },
    { name: 'March', year: endYear, month: 3 },
  ];

  const monthlyIncome = new Map<string, number>();
  const monthlyExpenses = new Map<string, number>();
  const categoryMap = new Map<string, number>();

  payments.forEach((p) => {
    const ym = extractDate(p.payment_date).slice(0, 7); // YYYY-MM
    const inc = (p.interest_portion || 0) + (p.penalty_amount || 0) + ((p as any).processing_fee || 0);
    monthlyIncome.set(ym, (monthlyIncome.get(ym) || 0) + inc);
  });

  qualifyingExpenses.forEach((e) => {
    const ym = (e.date || '').slice(0, 7);
    monthlyExpenses.set(ym, (monthlyExpenses.get(ym) || 0) + (e.amount || 0));

    const cat = e.category || 'Other';
    categoryMap.set(cat, (categoryMap.get(cat) || 0) + (e.amount || 0));
  });

  let totalIncome = 0;
  let totalExpenses = 0;

  const monthlyTrend: YearlyPnLReport['monthlyTrend'] = monthOrder.map((m, idx) => {
    const ym = `${m.year}-${String(m.month).padStart(2, '0')}`;
    const inc = round2(monthlyIncome.get(ym) || 0);
    const exp = round2(monthlyExpenses.get(ym) || 0);
    const net = round2(inc - exp);

    totalIncome += inc;
    totalExpenses += exp;

    return {
      month: `${m.name} ${m.year}`,
      monthIndex: idx + 1,
      income: inc,
      expenses: exp,
      netProfitLoss: net,
      isProfit: net >= 0,
    };
  });

  totalIncome = round2(totalIncome);
  totalExpenses = round2(totalExpenses);
  const netProfitLoss = round2(totalIncome - totalExpenses);

  const expenseBreakdown = Array.from(categoryMap.entries()).map(([category, amount]) => ({
    category,
    amount: round2(amount),
  }));
  expenseBreakdown.sort((a, b) => b.amount - a.amount);

  const summary = { totalIncome, totalExpenses, netProfitLoss, isProfit: netProfitLoss >= 0 };
  const monthlyBreakdown = monthlyTrend.map((m) => ({
    monthName: m.month,
    income: m.income,
    expenses: m.expenses,
    netProfitLoss: m.netProfitLoss,
    isProfit: m.isProfit,
  }));

  return {
    reportReference: `PGF-PNL-Y-${financialYear.replace(/[^0-9]/g, '')}`,
    generatedAt: new Date().toISOString(),
    financialYear,
    branchId: branchId && branchId !== 'all' ? branchId : undefined,
    branchName: branchId && branchId !== 'all' ? 'Branch' : 'All Branches (Consolidated)',
    totalIncome,
    totalExpenses,
    netProfitLoss,
    isProfit: netProfitLoss >= 0,
    summary,
    monthlyTrend,
    monthlyBreakdown,
    expenseBreakdown,
    expenseHeadAnalysis: expenseBreakdown,
  };
}

/**
 * Fetch high-level executive P&L dashboard metrics for Today, This Month, and This Year.
 */
export async function getPnLDashboardMetrics(
  branchId?: string
): Promise<PnLDashboardMetrics> {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  // Compute Indian Financial Year (April to March)
  const fyStart = currentMonth >= 4 ? currentYear : currentYear - 1;
  const fyStr = `${fyStart}-${String(fyStart + 1).slice(2)}`;

  // 1. Today's P&L
  const todayPnl = await getDailyPnL(todayStr, branchId);

  // 2. This Month's P&L
  const monthPnl = await getMonthlyPnL(currentYear, currentMonth, branchId);

  // 3. This Year's P&L
  const yearPnl = await getYearlyPnL(fyStr, branchId);

  return {
    today: {
      date: todayStr,
      income: todayPnl.totalIncome,
      expenses: todayPnl.totalExpenses,
      netProfitLoss: todayPnl.netProfitLoss,
      isProfit: todayPnl.isProfit,
    },
    thisMonth: {
      monthName: monthPnl.monthName,
      income: monthPnl.totalIncome,
      expenses: monthPnl.totalExpenses,
      netProfitLoss: monthPnl.netProfitLoss,
      isProfit: monthPnl.isProfit,
    },
    thisYear: {
      financialYear: fyStr,
      income: yearPnl.totalIncome,
      expenses: yearPnl.totalExpenses,
      netProfitLoss: yearPnl.netProfitLoss,
      isProfit: yearPnl.isProfit,
    },
  };
}

/**
 * Compute Branch-Wise Profit & Loss comparison.
 */
export async function getBranchWisePnL(
  period: 'today' | 'month' | 'year' = 'month',
  dateStr?: string
): Promise<Array<{
  branchId: string;
  branchName: string;
  income: number;
  expenses: number;
  netProfitLoss: number;
  isProfit: boolean;
}>> {
  try {
    const branchesSnap = await getDocs(collection(db, 'branches'));
    const branches = branchesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const now = new Date();
    const targetDate = dateStr || now.toISOString().split('T')[0];
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const fyStart = currentMonth >= 4 ? currentYear : currentYear - 1;
    const fyStr = `${fyStart}-${String(fyStart + 1).slice(2)}`;

    const results = [];
    for (const b of branches) {
      let inc = 0;
      let exp = 0;

      if (period === 'today') {
        const pnl = await getDailyPnL(targetDate, b.id);
        inc = pnl.totalIncome;
        exp = pnl.totalExpenses;
      } else if (period === 'month') {
        const pnl = await getMonthlyPnL(currentYear, currentMonth, b.id);
        inc = pnl.totalIncome;
        exp = pnl.totalExpenses;
      } else {
        const pnl = await getYearlyPnL(fyStr, b.id);
        inc = pnl.totalIncome;
        exp = pnl.totalExpenses;
      }

      const net = round2(inc - exp);
      results.push({
        branchId: b.id,
        branchName: (b as any).name || (b as any).code || 'Branch',
        income: inc,
        expenses: exp,
        netProfitLoss: net,
        isProfit: net >= 0,
      });
    }

    results.sort((a, b) => b.netProfitLoss - a.netProfitLoss);
    return results;
  } catch (err) {
    console.error('[PnL] Error fetching branch-wise P&L:', err);
    return [];
  }
}
