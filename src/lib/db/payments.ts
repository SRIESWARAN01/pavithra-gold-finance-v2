// src/lib/db/payments.ts
// Data access layer for payments, ledger entries, and settlements backed by Cloud Firestore.

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
  limit,
  writeBatch,
  runTransaction,
} from 'firebase/firestore';
import type { Payment, PaymentInsert, PaymentSplit, PaymentMode, PaymentType } from '@/types/database';
import { markInterestAsPaid } from '@/lib/db/interest';
import { getNextBillSlogan } from '@/lib/db/slogans';

const COLLECTION = 'payments';

/**
 * Calculate how a payment amount should be split between interest and principal.
 * Business rule: Interest is cleared first, remainder reduces principal.
 * 
 * Allocation order:
 *   1. Penalty amount is allocated first (separate line item)
 *   2. Waiver reduces outstanding interest (discount)
 *   3. Remaining amount clears outstanding interest
 *   4. Final remainder reduces principal
 */
export function calculatePaymentSplit(
  amount: number,
  outstandingInterest: number,
  remainingPrincipal: number,
  penaltyAmount: number = 0,
  waiverAmount: number = 0
): PaymentSplit {
  // Validation: reject negative values
  if (amount < 0) amount = 0;
  if (penaltyAmount < 0) penaltyAmount = 0;
  if (waiverAmount < 0) waiverAmount = 0;

  // Step 1: Penalty is paid from the total amount first
  const afterPenalty = Math.max(0, amount - penaltyAmount);

  // Step 2: Waiver reduces outstanding interest (discount applied by admin)
  const effectiveOutstandingInterest = Math.max(0, outstandingInterest - waiverAmount);

  // Step 3: Clear outstanding interest from remaining amount
  const interestPortion = Math.min(afterPenalty, effectiveOutstandingInterest);

  // Step 4: Remainder goes to principal reduction
  const principalPortion = Math.max(0, afterPenalty - interestPortion);

  const newRemainingPrincipal = Math.max(0, remainingPrincipal - principalPortion);
  const newRemainingInterest = Math.max(0, effectiveOutstandingInterest - interestPortion);
  const newOutstanding = newRemainingPrincipal + newRemainingInterest;

  const isFullSettlement = newRemainingPrincipal === 0 && newRemainingInterest === 0;

  return {
    totalAmount: amount,
    interestPortion: Math.round(interestPortion * 100) / 100,
    principalPortion: Math.round(principalPortion * 100) / 100,
    remainingPrincipal: Math.round(newRemainingPrincipal * 100) / 100,
    remainingInterest: Math.round(newRemainingInterest * 100) / 100,
    newOutstanding: Math.round(newOutstanding * 100) / 100,
    isFullSettlement,
  };
}

/**
 * Generate a unique receipt number using a Firestore transaction (atomic).
 */
async function generateReceiptNumber(): Promise<string> {
  const counterRef = doc(db, 'counters', 'receipt_number');
  const next = await runTransaction(db, async (transaction) => {
    const counterSnap = await transaction.get(counterRef);
    const current = counterSnap.exists() ? (counterSnap.data().value || 0) : 0;
    const nextVal = current + 1;
    transaction.set(counterRef, { value: nextVal }, { merge: true });
    return nextVal;
  });
  return `PGF-REC-${String(next).padStart(6, '0')}`;
}

/**
 * Record a payment and update the associated loan balances.
 * Uses a Firestore batch write for atomicity — payment insert and loan update
 * either both succeed or both fail.
 */
export async function recordPayment(data: PaymentInsert): Promise<Payment> {
  // Validation: reject invalid payment amounts
  if (!data.amount_paid || data.amount_paid <= 0) {
    throw new Error('Payment amount must be greater than zero.');
  }
  if (data.interest_portion < 0 || data.principal_portion < 0) {
    throw new Error('Payment portions cannot be negative.');
  }

  // Validation: check loan exists and is in a payable state
  const loanCheckRef = doc(db, 'loans', data.loan_id);
  const loanCheckSnap = await getDoc(loanCheckRef);
  if (!loanCheckSnap.exists()) {
    throw new Error('Loan not found. Cannot record payment.');
  }
  const loanCheckData = loanCheckSnap.data();
  if (['Settled', 'Cancelled', 'Auctioned'].includes(loanCheckData.status)) {
    throw new Error(`Cannot record payment on a ${loanCheckData.status} loan.`);
  }

  // Auto-generate receipt number atomically
  if (!data.receipt_number) {
    data.receipt_number = await generateReceiptNumber();
  }

  // Assign rotating Tamil slogan for bill/receipt
  let sloganId = data.slogan_id;
  let sloganText = data.slogan_text;
  if (!sloganId || !sloganText) {
    try {
      const assigned = await getNextBillSlogan();
      sloganId = assigned.sloganId;
      sloganText = assigned.sloganText;
    } catch (sloganErr) {
      console.warn('Slogan assignment notice:', sloganErr);
    }
  }

  const now = new Date().toISOString();
  const paymentData = {
    ...data,
    slogan_id: sloganId || null,
    slogan_text: sloganText || null,
    payment_date: data.payment_date || now,
    created_at: now,
  };

  // Fetch loan data for balance update calculation
  const loanRef = doc(db, 'loans', data.loan_id);
  const loanSnap = await getDoc(loanRef);

  // Create payment ref for batch
  const paymentRef = doc(collection(db, COLLECTION));
  const batch = writeBatch(db);

  // 1. Insert payment record
  batch.set(paymentRef, paymentData);

  // 2. Update loan running totals atomically in the same batch
  if (loanSnap.exists()) {
    const loan = loanSnap.data();
    const newTotalInterestPaid = (loan.total_interest_paid || 0) + data.interest_portion;
    const newTotalPrincipalPaid = (loan.total_principal_paid || 0) + data.principal_portion;
    const newOutstandingInterest = Math.max(0, (loan.outstanding_interest || 0) - data.interest_portion);
    const remainingPrincipal = (loan.principal_amount || 0) - newTotalPrincipalPaid;

    const loanUpdate: Record<string, unknown> = {
      total_interest_paid: newTotalInterestPaid,
      total_principal_paid: newTotalPrincipalPaid,
      outstanding_interest: newOutstandingInterest,
      updated_at: now,
    };

    // Auto-settle loan if fully paid
    if (remainingPrincipal <= 0 && newOutstandingInterest <= 0) {
      loanUpdate.status = 'Settled';
      loanUpdate.closed_at = now;
    }

    batch.update(loanRef, loanUpdate);
  }

  // Commit atomically — both payment and loan update succeed or fail together
  await batch.commit();

  const payment = { id: paymentRef.id, ...paymentData } as unknown as Payment;

  // 3. Mark interest accrual records as paid (non-critical, after commit)
  if (data.interest_portion > 0) {
    try {
      await markInterestAsPaid(data.loan_id, paymentRef.id, data.interest_portion);
    } catch (err) {
      console.error('[Payment] Failed to mark interest accruals as paid:', err);
    }
  }

  return payment;
}

/**
 * Get all payments for a specific loan.
 */
export async function getPaymentsByLoan(loanId: string): Promise<Payment[]> {
  try {
    const q = query(
      collection(db, COLLECTION),
      where('loan_id', '==', loanId)
    );
    const snapshot = await getDocs(q);
    const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as unknown as Payment));
    list.sort((a: any, b: any) => (b.payment_date || '').localeCompare(a.payment_date || ''));
    return list;
  } catch (err) {
    console.error('Error fetching payments by loan:', err);
    return [];
  }
}

/**
 * Get all payments for a customer (across all their loans).
 */
export async function getPaymentsByCustomer(customerId: string): Promise<Payment[]> {
  try {
    const q = query(
      collection(db, COLLECTION),
      where('customer_id', '==', customerId)
    );
    const snapshot = await getDocs(q);

    const payments: Payment[] = [];
    for (const d of snapshot.docs) {
      const payment: any = { id: d.id, ...d.data() };
      // Join loan data
      if (payment.loan_id) {
        const loanSnap = await getDoc(doc(db, 'loans', payment.loan_id));
        if (loanSnap.exists()) {
          const loanData = loanSnap.data();
          payment.loan = { loan_number: loanData.loan_number, principal_amount: loanData.principal_amount };
        }
      }
      payments.push(payment as Payment);
    }

    payments.sort((a: any, b: any) => (b.payment_date || '').localeCompare(a.payment_date || ''));
    return payments;
  } catch (err) {
    console.error('Error fetching payments by customer:', err);
    return [];
  }
}

/**
 * Get a single payment by ID.
 */
export async function getPayment(id: string): Promise<Payment | null> {
  const paymentRef = doc(db, COLLECTION, id);
  const paymentSnap = await getDoc(paymentRef);

  if (!paymentSnap.exists()) return null;

  const payment: any = { id: paymentSnap.id, ...paymentSnap.data() };

  // Join loan and customer data
  if (payment.loan_id) {
    const loanSnap = await getDoc(doc(db, 'loans', payment.loan_id));
    if (loanSnap.exists()) {
      const loanData: any = { id: loanSnap.id, ...loanSnap.data() };
      if (loanData.customer_id) {
        const customerSnap = await getDoc(doc(db, 'profiles', loanData.customer_id));
        if (customerSnap.exists()) {
          loanData.customer = { name: customerSnap.data().name, phone_primary: customerSnap.data().phone_primary };
        }
      }
      payment.loan = loanData;
    }
  }

  return payment as Payment;
}

/**
 * Get payment collection totals for a date range (reports).
 */
export async function getCollectionStats(options?: {
  fromDate?: string;
  toDate?: string;
  branchId?: string;
}): Promise<{
  totalCollected: number;
  interestCollected: number;
  principalCollected: number;
  paymentCount: number;
}> {
  try {
    const snapshot = await getDocs(collection(db, COLLECTION));

    let totalCollected = 0, interestCollected = 0, principalCollected = 0;
    let paymentCount = 0;

    for (const d of snapshot.docs) {
      const p = d.data();
      const pDate = (p.payment_date || p.created_at || '').split('T')[0];

      if (options?.fromDate && pDate < options.fromDate) continue;
      if (options?.toDate && pDate > options.toDate) continue;

      if (options?.branchId && p.loan_id) {
        const loanSnap = await getDoc(doc(db, 'loans', p.loan_id));
        if (!loanSnap.exists() || loanSnap.data().branch_id !== options.branchId) {
          continue;
        }
      }

      totalCollected += p.amount_paid || 0;
      interestCollected += p.interest_portion || 0;
      principalCollected += p.principal_portion || 0;
      paymentCount++;
    }

    return { totalCollected, interestCollected, principalCollected, paymentCount };
  } catch (err) {
    console.error('Error computing collection stats:', err);
    return { totalCollected: 0, interestCollected: 0, principalCollected: 0, paymentCount: 0 };
  }
}

/**
 * List all payments with optional filters and pagination (Admin billing view).
 */
export async function listPayments(options?: {
  page?: number;
  pageSize?: number;
  mode?: PaymentMode;
  type?: PaymentType;
  branchId?: string;
}): Promise<{ payments: Payment[]; count: number }> {
  try {
    const constraints: any[] = [];

    if (options?.mode) constraints.push(where('mode', '==', options.mode));
    if (options?.type) constraints.push(where('payment_type', '==', options.type));

    const q = constraints.length > 0
      ? query(collection(db, COLLECTION), ...constraints)
      : query(collection(db, COLLECTION));

    const snapshot = await getDocs(q);

    let allPayments: Payment[] = [];
    for (const d of snapshot.docs) {
      const payment: any = { id: d.id, ...d.data() };
      // Join loan number and customer name
      if (payment.loan_id) {
        const loanSnap = await getDoc(doc(db, 'loans', payment.loan_id));
        if (loanSnap.exists()) {
          const loanData = loanSnap.data();
          payment.loan = { 
            id: loanSnap.id,
            loan_number: loanData.loan_number,
            branch_id: loanData.branch_id 
          } as any;
        }
      }
      if (payment.customer_id) {
        const custSnap = await getDoc(doc(db, 'profiles', payment.customer_id));
        if (custSnap.exists()) {
          payment.customer = { name: custSnap.data().name } as any;
        }
      }
      allPayments.push(payment as Payment);
    }

    // Filter by branch if requested
    if (options?.branchId) {
      allPayments = allPayments.filter(p => p.loan?.branch_id === options.branchId);
    }

    // In-memory sort by payment_date descending
    allPayments.sort((a: any, b: any) => {
      const dateA = a.payment_date || a.created_at || '';
      const dateB = b.payment_date || b.created_at || '';
      return dateB.localeCompare(dateA);
    });

    // Client-side pagination
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 50;
    const start = (page - 1) * pageSize;
    const paginated = allPayments.slice(start, start + pageSize);

    return { payments: paginated, count: allPayments.length };
  } catch (err) {
    console.error('Error listing payments:', err);
    return { payments: [], count: 0 };
  }
}
