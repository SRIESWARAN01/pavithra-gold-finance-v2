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
/**
 * Calculate how a payment amount should be split between interest and principal.
 * Business rule: Penalty is cleared first, interest is cleared second, remainder reduces principal.
 * All math uses safe integer paise to prevent precision loss.
 */
export function calculatePaymentSplit(
  amount: number,
  outstandingInterest: number,
  remainingPrincipal: number,
  penaltyAmount: number = 0,
  waiverAmount: number = 0
): PaymentSplit {
  if (amount < 0) amount = 0;
  if (penaltyAmount < 0) penaltyAmount = 0;
  if (waiverAmount < 0) waiverAmount = 0;

  const toPaise = (v: number) => Math.round((v || 0) * 100);
  const fromPaise = (p: number) => Math.round(p) / 100;

  const amountPaise = toPaise(amount);
  const penaltyPaise = toPaise(penaltyAmount);
  const waiverPaise = toPaise(waiverAmount);
  const interestDuePaise = toPaise(outstandingInterest);
  const principalDuePaise = toPaise(remainingPrincipal);

  // Step 1: Penalty is paid from the total amount first
  const afterPenaltyPaise = Math.max(0, amountPaise - penaltyPaise);

  // Step 2: Waiver reduces outstanding interest
  const effectiveInterestDuePaise = Math.max(0, interestDuePaise - waiverPaise);

  // Step 3: Clear outstanding interest from remaining amount
  const interestPortionPaise = Math.min(afterPenaltyPaise, effectiveInterestDuePaise);

  // Step 4: Excess amount reduces principal (capped at remaining principal)
  const excessPaise = Math.max(0, afterPenaltyPaise - interestPortionPaise);
  const principalPortionPaise = Math.min(excessPaise, principalDuePaise);

  const newRemainingPrincipalPaise = Math.max(0, principalDuePaise - principalPortionPaise);
  const newRemainingInterestPaise = Math.max(0, effectiveInterestDuePaise - interestPortionPaise);
  const newOutstandingPaise = newRemainingPrincipalPaise + newRemainingInterestPaise;

  const isFullSettlement = newRemainingPrincipalPaise === 0 && newRemainingInterestPaise === 0;

  return {
    totalAmount: amount,
    interestPortion: fromPaise(interestPortionPaise),
    principalPortion: fromPaise(principalPortionPaise),
    remainingPrincipal: fromPaise(newRemainingPrincipalPaise),
    remainingInterest: fromPaise(newRemainingInterestPaise),
    newOutstanding: fromPaise(newOutstandingPaise),
    isFullSettlement,
  };
}

/**
 * Recursively sanitize an object to remove `undefined` values,
 * converting them to `null` so Firebase Firestore set/add/update never fails.
 */
function cleanFirestorePayload<T extends Record<string, any>>(obj: T): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) {
      result[key] = null;
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      result[key] = cleanFirestorePayload(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Generate a unique receipt number using a Firestore transaction (atomic).
 */
export async function generateReceiptNumber(): Promise<string> {
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
 * Generate a unique loan release / closure voucher number using a Firestore transaction (atomic).
 */
export async function generateReleaseNumber(): Promise<string> {
  const counterRef = doc(db, 'counters', 'release_number');
  const next = await runTransaction(db, async (transaction) => {
    const counterSnap = await transaction.get(counterRef);
    const current = counterSnap.exists() ? (counterSnap.data().value || 0) : 0;
    const nextVal = current + 1;
    transaction.set(counterRef, { value: nextVal }, { merge: true });
    return nextVal;
  });
  return `PGF-REL-${String(next).padStart(6, '0')}`;
}

/**
 * Record a payment and update the associated loan balances in one Firestore
 * transaction, preventing concurrent cashiers from overwriting running totals.
 * Includes idempotency key protection and integer paise precision.
 */
export async function recordPayment(data: PaymentInsert): Promise<Payment> {
  if (!Number.isFinite(data.amount_paid) || data.amount_paid <= 0) {
    throw new Error('Payment amount must be greater than zero.');
  }
  if (!Number.isFinite(data.interest_portion) || !Number.isFinite(data.principal_portion) || data.interest_portion < 0 || data.principal_portion < 0) {
    throw new Error('Payment portions cannot be negative.');
  }
  const penaltyAmount = data.penalty_amount || 0;
  const waiverAmount = data.waiver_amount || 0;
  if (!Number.isFinite(penaltyAmount) || !Number.isFinite(waiverAmount) || penaltyAmount < 0 || waiverAmount < 0) {
    throw new Error('Penalty and waiver amounts cannot be negative.');
  }
  const toPaise = (amount: number) => Math.round((amount || 0) * 100);
  if (toPaise(data.interest_portion) + toPaise(data.principal_portion) + toPaise(penaltyAmount) !== toPaise(data.amount_paid)) {
    throw new Error('Payment allocation must equal the amount received.');
  }

  // Idempotency check: if an idempotency key is provided and already exists, return that payment
  if (data.idempotency_key) {
    try {
      const existingQ = query(
        collection(db, COLLECTION),
        where('idempotency_key', '==', data.idempotency_key)
      );
      const existingSnap = await getDocs(existingQ);
      if (!existingSnap.empty) {
        console.warn(`[Payment] Idempotent duplicate replay detected for key: ${data.idempotency_key}`);
        const existingDoc = existingSnap.docs[0];
        return { id: existingDoc.id, ...existingDoc.data() } as unknown as Payment;
      }
    } catch (idempErr) {
      console.warn('Notice checking idempotency key:', idempErr);
    }
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

  const loanRef = doc(db, 'loans', data.loan_id);
  const paymentRef = doc(collection(db, COLLECTION));
  const counterRef = doc(db, 'counters', 'receipt_number');
  const now = new Date().toISOString();

  const paymentData = await runTransaction(db, async (transaction) => {
    const loanSnap = await transaction.get(loanRef);
    if (!loanSnap.exists()) throw new Error('Loan not found. Cannot record payment.');
    const loan = loanSnap.data();
    if (['Settled', 'Cancelled', 'Auctioned'].includes(loan.status)) {
      throw new Error(`Cannot record payment on a ${loan.status} loan.`);
    }

    const totalPrincipalPaid = loan.total_principal_paid || 0;
    const remainingPrincipal = Math.max(0, (loan.principal_amount || 0) - totalPrincipalPaid);
    const dbOutstandingInterest = Math.max(0, loan.outstanding_interest || 0);
    const snapshotOutstandingInterest = data.calculation_snapshot?.outstandingInterest || 0;
    const effectiveOutstandingInterest = Math.max(dbOutstandingInterest, snapshotOutstandingInterest);

    if (toPaise(data.principal_portion) > toPaise(remainingPrincipal)) {
      throw new Error('Principal payment exceeds the remaining principal balance.');
    }
    if (toPaise(data.interest_portion + waiverAmount) > toPaise(effectiveOutstandingInterest)) {
      throw new Error('Interest payment and waiver exceed the outstanding interest balance.');
    }

    let receiptNumber = data.receipt_number;
    if (!receiptNumber) {
      const counterSnap = await transaction.get(counterRef);
      const next = (counterSnap.exists() ? (counterSnap.data().value || 0) : 0) + 1;
      transaction.set(counterRef, { value: next }, { merge: true });
      receiptNumber = `PGF-REC-${String(next).padStart(6, '0')}`;
    }

    const newOutstandingInterest = Math.max(0, effectiveOutstandingInterest - data.interest_portion - waiverAmount);
    const newTotalPrincipalPaid = totalPrincipalPaid + data.principal_portion;
    const newRemainingPrincipal = Math.max(0, (loan.principal_amount || 0) - newTotalPrincipalPaid);

    const savedPayment = cleanFirestorePayload({
      ...data,
      receipt_number: receiptNumber,
      penalty_amount: penaltyAmount,
      waiver_amount: waiverAmount,
      interest_period_from: data.interest_period_from || null,
      interest_period_to: data.interest_period_to || null,
      release_number: data.release_number || null,
      transaction_ref: data.transaction_ref || null,
      slogan_id: sloganId || null,
      slogan_text: sloganText || null,
      payment_date: data.payment_date || now,
      // Precise integer paise fields for enterprise financial auditing
      amount_received_paise: toPaise(data.amount_paid),
      penalty_paid_paise: toPaise(penaltyAmount),
      interest_paid_paise: toPaise(data.interest_portion),
      principal_paid_paise: toPaise(data.principal_portion),
      principal_before_paise: toPaise(remainingPrincipal),
      principal_after_paise: toPaise(newRemainingPrincipal),
      interest_before_paise: toPaise(effectiveOutstandingInterest),
      interest_after_paise: toPaise(newOutstandingInterest),
      idempotency_key: data.idempotency_key || null,
      calculation_snapshot: data.calculation_snapshot || null,
      status: 'POSTED',
      collected_by: data.collected_by || null,
      branch_id: data.branch_id || loan.branch_id || null,
      created_at: now,
    });

    const loanUpdate: Record<string, unknown> = {
      total_interest_paid: (loan.total_interest_paid || 0) + data.interest_portion,
      total_principal_paid: newTotalPrincipalPaid,
      outstanding_interest: newOutstandingInterest,
      last_interest_calc_date: data.payment_date ? data.payment_date.split('T')[0] : now.split('T')[0],
      updated_at: now,
    };
    if (newRemainingPrincipal === 0 && newOutstandingInterest === 0) {
      loanUpdate.status = 'Settled';
      loanUpdate.closed_at = now;
    }

    transaction.set(paymentRef, savedPayment);
    transaction.update(loanRef, cleanFirestorePayload(loanUpdate));
    return savedPayment;
  });

  const payment = { id: paymentRef.id, ...paymentData } as unknown as Payment;

  // Mark interest accrual records as paid (non-critical, after commit)
  if (data.interest_portion > 0) {
    try {
      await markInterestAsPaid(data.loan_id, paymentRef.id, data.interest_portion);
    } catch (err) {
      console.error('[Payment] Failed to mark interest accruals as paid:', err);
    }
  }

  // Audit log entry
  try {
    await addDoc(collection(db, 'audit_logs'), {
      actor_id: data.collected_by || 'cashier',
      actor_name: data.collected_by || 'Cashier Officer',
      actor_role: 'Cashier',
      action_type: 'Payment Posted',
      affected_entity: 'payments',
      affected_entity_id: paymentRef.id,
      details: {
        loan_id: data.loan_id,
        amount_paid: data.amount_paid,
        interest_portion: data.interest_portion,
        principal_portion: data.principal_portion,
        penalty_amount: penaltyAmount,
        receipt_number: payment.receipt_number,
      },
      timestamp: now,
    });
  } catch (auditErr) {
    console.warn('Audit logging notice:', auditErr);
  }

  return payment;
}

/**
 * Record an interest-only payment for an arbitrary period (e.g. 7 days, 20 days, monthly, 6 months).
 */
export async function recordInterestPayment(data: {
  loan_id: string;
  customer_id?: string;
  amount_paid: number;
  interest_period_from: string;
  interest_period_to: string;
  mode: PaymentMode;
  transaction_ref?: string;
  remarks?: string;
  payment_date?: string;
  receipt_number?: string;
}): Promise<Payment> {
  return recordPayment({
    loan_id: data.loan_id,
    customer_id: data.customer_id,
    amount_paid: data.amount_paid,
    interest_portion: data.amount_paid,
    principal_portion: 0,
    payment_type: 'Interest',
    mode: data.mode,
    interest_period_from: data.interest_period_from,
    interest_period_to: data.interest_period_to,
    transaction_ref: data.transaction_ref || null,
    remarks: data.remarks || `Interest payment covering ${data.interest_period_from} to ${data.interest_period_to}`,
    payment_date: data.payment_date,
    receipt_number: data.receipt_number,
  });
}

/**
 * Record a principal-only repayment (reduces loan principal directly).
 */
export async function recordPrincipalPayment(data: {
  loan_id: string;
  customer_id?: string;
  amount_paid: number;
  mode: PaymentMode;
  transaction_ref?: string;
  remarks?: string;
  payment_date?: string;
  receipt_number?: string;
}): Promise<Payment> {
  return recordPayment({
    loan_id: data.loan_id,
    customer_id: data.customer_id,
    amount_paid: data.amount_paid,
    interest_portion: 0,
    principal_portion: data.amount_paid,
    payment_type: 'Principal',
    mode: data.mode,
    transaction_ref: data.transaction_ref || null,
    remarks: data.remarks || 'Principal repayment reduction',
    payment_date: data.payment_date,
    receipt_number: data.receipt_number,
  });
}

/**
 * Process a full loan release / closure.
 * Atomically:
 * 1. Generates unique PGF-REL-XXXXXX voucher number.
 * 2. Inserts final settlement payment record.
 * 3. Sets loan status to 'Settled', outstanding_interest=0, closed_at=release_date.
 * 4. Updates all gold collateral ornaments custody to 'Released to Customer' and status='Released'.
 */
export async function recordLoanRelease(data: {
  loan_id: string;
  customer_id?: string;
  release_date: string;
  final_amount_paid: number;
  interest_portion: number;
  principal_portion: number;
  penalty_amount?: number;
  waiver_amount?: number;
  mode: PaymentMode;
  transaction_ref?: string;
  remarks?: string;
  release_number?: string;
  actor?: { id: string; name: string; role: string };
}): Promise<{ payment: Payment; release_number: string; loan: any }> {
  const loanRef = doc(db, 'loans', data.loan_id);
  const loanSnap = await getDoc(loanRef);
  if (!loanSnap.exists()) {
    throw new Error('Loan not found. Cannot perform gold release.');
  }

  const loan = loanSnap.data();
  if (['Settled', 'Cancelled', 'Auctioned'].includes(loan.status)) {
    throw new Error(`Loan is already ${loan.status}.`);
  }

  // Generate unique atomic Release Voucher Number & Receipt Number
  const releaseNumber = data.release_number || (await generateReleaseNumber());
  const receiptNumber = await generateReceiptNumber();

  // Assign rotating Tamil slogan
  let sloganId: string | null = null;
  let sloganText: string | null = null;
  try {
    const assigned = await getNextBillSlogan();
    sloganId = assigned.sloganId;
    sloganText = assigned.sloganText;
  } catch (sloganErr) {
    console.warn('Slogan assignment notice:', sloganErr);
  }

  const now = new Date().toISOString();
  const effectiveReleaseDate = data.release_date || now;

  // Fetch all gold collateral items for this loan and enforce bank re-pledge custody lock (§13.4)
  const goldQ = query(collection(db, 'gold_collateral'), where('loan_id', '==', data.loan_id));
  const goldSnap = await getDocs(goldQ);

  for (const gDoc of goldSnap.docs) {
    const gData = gDoc.data();
    const custody = (gData.custody_location || '').toLowerCase();
    if (custody.includes('bank') || gData.status === 'RePledged' || gData.status === 'Repledged') {
      throw new Error(
        `CUSTODY_LOCK: Collateral ornament "${gData.item_description || gDoc.id}" is currently pledged with an institutional bank (${gData.custody_location || 'Bank'}). You must first settle the bank re-pledge and return the gold to PGF Safe before releasing it to the customer.`
      );
    }
  }

  const batch = writeBatch(db);
  const paymentRef = doc(collection(db, COLLECTION));

  // 1. Final payment record
  const paymentData = cleanFirestorePayload({
    loan_id: data.loan_id,
    customer_id: data.customer_id || loan.customer_id,
    amount_paid: data.final_amount_paid,
    interest_portion: data.interest_portion,
    principal_portion: data.principal_portion,
    penalty_amount: data.penalty_amount || 0,
    waiver_amount: data.waiver_amount || 0,
    payment_type: 'Full_Settlement',
    mode: data.mode,
    receipt_number: receiptNumber,
    release_number: releaseNumber,
    transaction_ref: data.transaction_ref || null,
    remarks: data.remarks || `Full settlement and gold collateral release under Voucher ${releaseNumber}`,
    payment_date: effectiveReleaseDate,
    slogan_id: sloganId,
    slogan_text: sloganText,
    created_at: now,
  });
  batch.set(paymentRef, paymentData);

  // 2. Update loan record: marked closed with zero outstanding
  const updatedTotalInterest = (loan.total_interest_paid || 0) + data.interest_portion;
  const loanUpdate = cleanFirestorePayload({
    status: 'Settled',
    closed_at: effectiveReleaseDate,
    release_date: effectiveReleaseDate,
    release_number: releaseNumber,
    total_principal_paid: loan.principal_amount || 0,
    total_interest_paid: updatedTotalInterest,
    outstanding_interest: 0,
    updated_at: now,
  });
  batch.update(loanRef, loanUpdate);

  // 3. Mark all pledged gold items as released back to customer
  for (const gDoc of goldSnap.docs) {
    batch.update(gDoc.ref, cleanFirestorePayload({
      custody_location: 'Released to Customer',
      status: 'Released',
      released_at: effectiveReleaseDate,
      release_number: releaseNumber,
      updated_at: now,
    }));
  }

  await batch.commit();

  const paymentRecord = { id: paymentRef.id, ...paymentData } as unknown as Payment;

  // 4. Audit Log
  try {
    const actorId = data.actor?.id || 'admin';
    const actorName = data.actor?.name || 'Authorized Officer';
    const actorRole = data.actor?.role || 'Admin';

    await addDoc(collection(db, 'audit_logs'), {
      actor_id: actorId,
      actor_name: actorName,
      actor_role: actorRole,
      action_type: 'Loan Closed & Gold Released',
      affected_entity: 'loans',
      affected_entity_id: data.loan_id,
      old_state: { status: loan.status, principal_amount: loan.principal_amount },
      new_state: { status: 'Settled', release_number: releaseNumber, release_date: effectiveReleaseDate },
      timestamp: now,
    });
  } catch (auditErr) {
    console.warn('Audit logging notice:', auditErr);
  }

  return { payment: paymentRecord, release_number: releaseNumber, loan: { ...loan, ...loanUpdate } };
}

/**
 * Authorized Payment Reversal (Audit-safe, never direct delete).
 * Reverts loan balance, marks payment status as REVERSED, and logs audit trail.
 */
export async function reversePayment(
  paymentId: string,
  actor: { id: string; name: string; role: string },
  reason: string
): Promise<{ success: boolean; reversedPayment: Payment }> {
  if (!reason || !reason.trim()) {
    throw new Error('A valid reason is required to reverse a payment.');
  }

  const paymentRef = doc(db, COLLECTION, paymentId);
  const now = new Date().toISOString();

  const updatedPayment: any = await runTransaction(db, async (transaction) => {
    const pSnap = await transaction.get(paymentRef);
    if (!pSnap.exists()) throw new Error('Payment record not found.');
    const payment = pSnap.data();

    if (payment.status === 'REVERSED') {
      throw new Error('This payment has already been reversed.');
    }

    const loanRef = doc(db, 'loans', payment.loan_id);
    const loanSnap = await transaction.get(loanRef);
    if (!loanSnap.exists()) throw new Error('Associated loan not found.');
    const loan = loanSnap.data();

    // Roll back balances
    const newTotalInterestPaid = Math.max(0, (loan.total_interest_paid || 0) - (payment.interest_portion || 0));
    const newTotalPrincipalPaid = Math.max(0, (loan.total_principal_paid || 0) - (payment.principal_portion || 0));
    const newOutstandingInterest = (loan.outstanding_interest || 0) + (payment.interest_portion || 0);

    const loanUpdate: Record<string, any> = {
      total_interest_paid: newTotalInterestPaid,
      total_principal_paid: newTotalPrincipalPaid,
      outstanding_interest: newOutstandingInterest,
      updated_at: now,
    };

    if (loan.status === 'Settled') {
      loanUpdate.status = 'Active';
      loanUpdate.closed_at = null;
    }

    const paymentUpdate = {
      status: 'REVERSED',
      reversal_reason: reason,
      reversed_by: actor.name || actor.id,
      reversed_at: now,
      updated_at: now,
    };

    transaction.update(paymentRef, cleanFirestorePayload(paymentUpdate));
    transaction.update(loanRef, cleanFirestorePayload(loanUpdate));

    return { ...payment, ...paymentUpdate };
  });

  // Audit Log
  try {
    await addDoc(collection(db, 'audit_logs'), {
      actor_id: actor.id,
      actor_name: actor.name,
      actor_role: actor.role,
      action_type: 'Payment Reversed',
      affected_entity: 'payments',
      affected_entity_id: paymentId,
      reason,
      details: {
        payment_id: paymentId,
        loan_id: updatedPayment.loan_id,
        amount_reversed: updatedPayment.amount_paid,
        receipt_number: updatedPayment.receipt_number,
      },
      timestamp: now,
    });
  } catch (err) {
    console.warn('Audit log write error:', err);
  }

  return { success: true, reversedPayment: updatedPayment as unknown as Payment };
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
