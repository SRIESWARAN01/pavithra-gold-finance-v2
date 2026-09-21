// src/lib/db/interest.ts
// Interest calculation engine — daily simple accrual, dynamic outstanding tracking, and history backed by Cloud Firestore.

import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  setDoc,
  query,
  where,
  orderBy,
  writeBatch,
} from 'firebase/firestore';
import type { InterestAccrual } from '@/types/database';

export const COLLECTION = 'interest_accruals';

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function getDaysInYear(year: number): number {
  return isLeapYear(year) ? 366 : 365;
}

export function toPaise(amount: number): number {
  return Math.round((amount || 0) * 100);
}

export function fromPaise(paise: number): number {
  return Math.round(paise) / 100;
}

export interface LoanInterestSnapshot {
  loanId: string;
  loanNumber: string;
  asOfDate: string;
  originationDate: string;
  daysElapsed: number;
  principalAmount: number;
  currentPrincipal: number;
  annualRateApr: number;
  monthsCompleted: number;
  fractionalMonths: number;
  totalAccruedInterest: number;
  totalInterestPaid: number;
  outstandingInterest: number;
  penaltyAmount: number;
  totalOutstanding: number;
  isLeapYearEncountered: boolean;
  dailyRateApprox: number;
  calculationDate: string;
}

/**
 * Calculate dynamic days elapsed and completed months between two dates.
 * Calendar-aware: calculates completed calendar months and elapsed days.
 */
export function calculateDynamicDaysAndMonths(
  startDateStr: string | Date,
  endDateStr?: string | Date
): {
  daysElapsed: number;
  monthsCompleted: number;
  fractionalMonths: number;
} {
  const start = new Date(startDateStr);
  const end = endDateStr ? new Date(endDateStr) : new Date();

  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  if (end <= start) {
    return { daysElapsed: 0, monthsCompleted: 0, fractionalMonths: 0 };
  }

  const diffTime = end.getTime() - start.getTime();
  const daysElapsed = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

  let monthsCompleted = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (end.getDate() < start.getDate()) {
    monthsCompleted--;
  }
  monthsCompleted = Math.max(0, monthsCompleted);

  const fractionalMonths = Math.round((daysElapsed / 30.4375) * 10) / 10;

  return {
    daysElapsed,
    monthsCompleted,
    fractionalMonths,
  };
}

/**
 * Calculate daily interest for a single loan.
 * Formula: Daily Interest = Principal × (APR / 100) / DaysInYear
 * Leap year adjusts denominator to 366.
 */
export function calculateDailyInterest(
  principalBalance: number,
  annualRate: number,
  date?: Date
): number {
  const refDate = date || new Date();
  const year = refDate.getFullYear();
  const daysInYear = getDaysInYear(year);

  const dailyAmount = (principalBalance * (annualRate / 100)) / daysInYear;
  return Math.round(dailyAmount * 10000) / 10000; // 4 decimal precision
}

/**
 * Calculate accrued interest over an arbitrary date range taking into account
 * leap years and changes in principal balance over time.
 * All financial math uses safe integer paise to eliminate floating-point drift.
 */
export function calculateAccruedInterest(params: {
  principalAmount: number;
  annualRateApr: number;
  startDate: string | Date;
  endDate: string | Date;
  principalRepayments?: Array<{ date: string; amount: number }>;
}): {
  totalAccruedPaise: number;
  daysElapsed: number;
  isLeapYearEncountered: boolean;
  dailyBreakdown: Array<{ date: string; principal: number; dailyPaise: number }>;
} {
  const start = new Date(params.startDate);
  const end = new Date(params.endDate);

  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  if (end <= start) {
    return {
      totalAccruedPaise: 0,
      daysElapsed: 0,
      isLeapYearEncountered: false,
      dailyBreakdown: [],
    };
  }

  // Sort principal repayments by date ascending
  const repayments = (params.principalRepayments || [])
    .map((r) => ({
      date: new Date(r.date),
      amountPaise: toPaise(r.amount),
      applied: false,
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  let totalAccruedPaise = 0;
  let daysElapsed = 0;
  let isLeapYearEncountered = false;
  const dailyBreakdown: Array<{ date: string; principal: number; dailyPaise: number }> = [];

  let currentPrincipalPaise = toPaise(params.principalAmount);
  const currentDate = new Date(start);

  while (currentDate < end) {
    const dateStr = currentDate.toISOString().split('T')[0];
    const year = currentDate.getFullYear();
    const leap = isLeapYear(year);
    if (leap) isLeapYearEncountered = true;
    const daysInYear = leap ? 366 : 365;

    // Apply principal repayments that occurred on or before this day
    for (const r of repayments) {
      if (!r.applied && r.date <= currentDate) {
        currentPrincipalPaise = Math.max(0, currentPrincipalPaise - r.amountPaise);
        r.applied = true;
      }
    }

    // Daily interest formula: Principal * (APR / 100) / DaysInYear
    const dailyPaiseFloat = (currentPrincipalPaise * (params.annualRateApr / 100)) / daysInYear;
    const dailyPaise = Math.round(dailyPaiseFloat);

    totalAccruedPaise += dailyPaise;
    daysElapsed++;

    dailyBreakdown.push({
      date: dateStr,
      principal: fromPaise(currentPrincipalPaise),
      dailyPaise,
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return {
    totalAccruedPaise,
    daysElapsed,
    isLeapYearEncountered,
    dailyBreakdown,
  };
}

/**
 * Generate a comprehensive interest calculation snapshot for a loan as of any date.
 * Used consistently across billing, payments, renewals, statements, and receipts.
 */
export function calculateLoanInterestSnapshot(
  loan: any,
  asOfDateStr?: string,
  paymentsHistory?: any[]
): LoanInterestSnapshot {
  const originationDate = loan.origination_date
    ? loan.origination_date.split('T')[0]
    : new Date().toISOString().split('T')[0];
  const asOfDate = asOfDateStr
    ? asOfDateStr.split('T')[0]
    : new Date().toISOString().split('T')[0];

  const principalAmount = loan.principal_amount || 0;
  const totalPrincipalPaid = loan.total_principal_paid || 0;
  const currentPrincipal = Math.max(0, principalAmount - totalPrincipalPaid);
  const apr = loan.interest_rate_apr || 18;

  // Extract principal repayments from paymentsHistory if available
  const repayments: Array<{ date: string; amount: number }> = [];
  if (Array.isArray(paymentsHistory)) {
    for (const p of paymentsHistory) {
      if ((p.principal_portion || 0) > 0) {
        repayments.push({
          date: p.payment_date || p.created_at || originationDate,
          amount: p.principal_portion,
        });
      }
    }
  }

  const calculation = calculateAccruedInterest({
    principalAmount,
    annualRateApr: apr,
    startDate: originationDate,
    endDate: asOfDate,
    principalRepayments: repayments,
  });

  const totalAccruedInterest = fromPaise(calculation.totalAccruedPaise);
  const totalInterestPaid = loan.total_interest_paid || 0;

  let outstandingInterest = Math.max(
    0,
    Math.round(calculation.totalAccruedPaise - toPaise(totalInterestPaid)) / 100
  );

  // If the loan has an active tracked outstanding_interest in DB that is higher, respect it
  if (loan.outstanding_interest && loan.outstanding_interest > outstandingInterest) {
    outstandingInterest = loan.outstanding_interest;
  }

  const penaltyAmount = loan.penalty_amount || 0;
  const totalOutstanding = Math.round((currentPrincipal + outstandingInterest + penaltyAmount) * 100) / 100;

  const year = new Date().getFullYear();
  const daysInYear = getDaysInYear(year);
  const dailyRateApprox = Math.round(((currentPrincipal * (apr / 100)) / daysInYear) * 100) / 100;

  const dynamicTime = calculateDynamicDaysAndMonths(originationDate, asOfDate);
  const daysElapsed = calculation.daysElapsed || dynamicTime.daysElapsed;

  return {
    loanId: loan.id || '',
    loanNumber: loan.loan_number || '',
    asOfDate,
    originationDate,
    daysElapsed,
    monthsCompleted: dynamicTime.monthsCompleted,
    fractionalMonths: dynamicTime.fractionalMonths,
    principalAmount,
    currentPrincipal,
    annualRateApr: apr,
    totalAccruedInterest,
    totalInterestPaid,
    outstandingInterest,
    penaltyAmount,
    totalOutstanding,
    isLeapYearEncountered: calculation.isLeapYearEncountered,
    dailyRateApprox,
    calculationDate: new Date().toISOString(),
  };
}

/**
 * Run daily interest calculation for ALL active loans.
 * This should be called by a cron job / Cloud Function once per day.
 * Returns the number of loans processed.
 */
export async function runDailyInterestCalculation(
  targetDate?: string
): Promise<{ processed: number; totalAccrued: number }> {
  const date = targetDate || new Date().toISOString().split('T')[0];

  // Fetch all active loans
  const loansQ = query(
    collection(db, 'loans'),
    where('status', 'in', ['Active', 'Due', 'Overdue', 'Grace_Period'])
  );
  const loansSnap = await getDocs(loansQ);

  if (loansSnap.empty) return { processed: 0, totalAccrued: 0 };

  let processed = 0;
  let totalAccrued = 0;
  const batch = writeBatch(db);

  for (const loanDoc of loansSnap.docs) {
    const loan = loanDoc.data();

    // Skip if already calculated for this date
    if (loan.last_interest_calc_date === date) continue;

    const remainingPrincipal = (loan.principal_amount || 0) - (loan.total_principal_paid || 0);
    if (remainingPrincipal <= 0) continue;

    const dailyAmount = calculateDailyInterest(
      remainingPrincipal,
      loan.interest_rate_apr,
      new Date(date)
    );

    // Create accrual record
    const accrualRef = doc(collection(db, COLLECTION));
    batch.set(accrualRef, {
      loan_id: loanDoc.id,
      accrual_date: date,
      principal_balance: remainingPrincipal,
      interest_rate_apr: loan.interest_rate_apr,
      daily_amount: dailyAmount,
      is_paid: false,
      paid_at: null,
      payment_id: null,
      created_at: new Date().toISOString(),
    });

    // Update loan outstanding interest
    const newOutstanding = (loan.outstanding_interest || 0) + dailyAmount;
    batch.update(loanDoc.ref, {
      outstanding_interest: newOutstanding,
      last_interest_calc_date: date,
      updated_at: new Date().toISOString(),
    });

    totalAccrued += dailyAmount;
    processed++;
  }

  if (processed > 0) {
    await batch.commit();
  }

  return { processed, totalAccrued: Math.round(totalAccrued * 100) / 100 };
}

/**
 * Get outstanding (unpaid) interest for a specific loan.
 */
export async function getOutstandingInterest(loanId: string): Promise<number> {
  const q = query(
    collection(db, COLLECTION),
    where('loan_id', '==', loanId)
  );
  const snapshot = await getDocs(q);

  return snapshot.docs
    .filter((d) => !d.data().is_paid)
    .reduce((sum, d) => sum + (d.data().daily_amount || 0), 0);
}

/**
 * Get interest accrual history for a loan (paginated).
 */
export async function getInterestHistory(
  loanId: string,
  options?: { page?: number; pageSize?: number }
): Promise<{ accruals: InterestAccrual[]; count: number }> {
  try {
    const q = query(
      collection(db, COLLECTION),
      where('loan_id', '==', loanId)
    );
    const snapshot = await getDocs(q);

    const allAccruals = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as unknown as InterestAccrual));
    allAccruals.sort((a: any, b: any) => (b.accrual_date || '').localeCompare(a.accrual_date || ''));

    // Client-side pagination
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 30;
    const start = (page - 1) * pageSize;
    const paginated = allAccruals.slice(start, start + pageSize);

    return { accruals: paginated, count: allAccruals.length };
  } catch (err) {
    console.error('Error fetching interest history:', err);
    return { accruals: [], count: 0 };
  }
}

/**
 * Get monthly interest summary for a loan.
 * Groups daily accruals by month and returns totals.
 */
export async function getMonthlyInterestSummary(
  loanId: string
): Promise<Array<{ month: string; totalAccrued: number; totalPaid: number }>> {
  try {
    const q = query(
      collection(db, COLLECTION),
      where('loan_id', '==', loanId)
    );
    const snapshot = await getDocs(q);

    const monthMap = new Map<string, { totalAccrued: number; totalPaid: number }>();

    for (const d of snapshot.docs) {
      const row = d.data();
      if (!row.accrual_date) continue;
      const month = row.accrual_date.substring(0, 7); // YYYY-MM
      const existing = monthMap.get(month) || { totalAccrued: 0, totalPaid: 0 };
      existing.totalAccrued += row.daily_amount || 0;
      if (row.is_paid) existing.totalPaid += row.daily_amount || 0;
      monthMap.set(month, existing);
    }

    return Array.from(monthMap.entries()).map(([month, data]) => ({
      month,
      totalAccrued: Math.round(data.totalAccrued * 100) / 100,
      totalPaid: Math.round(data.totalPaid * 100) / 100,
    })).sort((a, b) => a.month.localeCompare(b.month));
  } catch (err) {
    console.error('Error getting monthly interest summary:', err);
    return [];
  }
}

/**
 * Mark interest accruals as paid (called after a payment is recorded).
 */
export async function markInterestAsPaid(
  loanId: string,
  paymentId: string,
  amountToClear: number
): Promise<void> {
  try {
    // Get unpaid accruals for this loan, oldest first
    const q = query(
      collection(db, COLLECTION),
      where('loan_id', '==', loanId)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) return;

    const unpaidDocs = snapshot.docs
      .filter((d) => !d.data().is_paid)
      .sort((a, b) => (a.data().accrual_date || '').localeCompare(b.data().accrual_date || ''));

    let remaining = amountToClear;
    const batch = writeBatch(db);
    const now = new Date().toISOString();

    for (const d of unpaidDocs) {
      if (remaining <= 0) break;
      batch.update(d.ref, {
        is_paid: true,
        paid_at: now,
        payment_id: paymentId,
      });
      remaining -= (d.data().daily_amount || 0);
    }

    await batch.commit();
  } catch (err) {
    console.error('Error marking interest as paid:', err);
  }
}
