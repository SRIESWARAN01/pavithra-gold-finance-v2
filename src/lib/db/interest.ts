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

const COLLECTION = 'interest_accruals';

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
  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysInYear = isLeapYear ? 366 : 365;

  const dailyAmount = (principalBalance * (annualRate / 100)) / daysInYear;
  return Math.round(dailyAmount * 10000) / 10000; // 4 decimal precision
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
