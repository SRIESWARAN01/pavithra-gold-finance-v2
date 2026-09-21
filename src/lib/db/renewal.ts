// src/lib/db/renewal.ts
// Enterprise Loan Renewal Engine for Pavithra Gold Finance.
// Supports Option A (Interest-Only), Option B (Interest + Principal),
// Option C (Full Settlement & Renewal), and Option D (Renewal with Top-up / Additional Disbursement).

import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  runTransaction,
  addDoc,
} from 'firebase/firestore';
import type {
  LoanRenewal,
  LoanRenewalInsert,
  RenewalType,
  PaymentMode,
} from '@/types/database';
import { getNextBillSlogan } from '@/lib/db/slogans';

const COLLECTION = 'loan_renewals';

function cleanPayload<T extends Record<string, any>>(obj: T): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) {
      result[key] = null;
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      result[key] = cleanPayload(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

const toPaise = (amount: number) => Math.round((amount || 0) * 100);
const fromPaise = (paise: number) => Math.round(paise) / 100;

/**
 * Generate a unique atomic renewal voucher number (e.g. PGF-RNW-000123).
 */
export async function generateRenewalNumber(): Promise<string> {
  const counterRef = doc(db, 'counters', 'renewal_number');
  const next = await runTransaction(db, async (transaction) => {
    const counterSnap = await transaction.get(counterRef);
    const current = counterSnap.exists() ? (counterSnap.data().value || 0) : 0;
    const nextVal = current + 1;
    transaction.set(counterRef, { value: nextVal }, { merge: true });
    return nextVal;
  });
  return `PGF-RNW-${String(next).padStart(6, '0')}`;
}

/**
 * Generate a unique receipt number for renewal payments.
 */
export async function generateRenewalReceiptNumber(): Promise<string> {
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
 * Process a loan renewal atomically with complete ledger updates,
 * payment recording, maturity date revision, and audit logging.
 */
export async function processLoanRenewal(
  data: LoanRenewalInsert,
  paymentDetails: {
    mode: PaymentMode;
    transaction_ref?: string;
    collected_by: string;
    branch_id?: string;
  }
): Promise<{
  renewal: LoanRenewal;
  receiptNumber: string;
  updatedLoan: any;
  newLoan?: any;
}> {
  const now = new Date().toISOString();
  const renewalDate = data.renewal_date || now;

  const loanRef = doc(db, 'loans', data.loan_id);
  const renewalRef = doc(collection(db, COLLECTION));
  const paymentRef = doc(collection(db, 'payments'));
  const counterRnwRef = doc(db, 'counters', 'renewal_number');
  const counterRecRef = doc(db, 'counters', 'receipt_number');
  const counterLoanRef = doc(db, 'counters', 'loan_number');

  // Assign Tamil Slogan
  let sloganId: string | null = null;
  let sloganText: string | null = null;
  try {
    const assigned = await getNextBillSlogan();
    sloganId = assigned.sloganId;
    sloganText = assigned.sloganText;
  } catch (sErr) {
    console.warn('Slogan assignment notice:', sErr);
  }

  const result = await runTransaction(db, async (transaction) => {
    // 1. Fetch current loan
    const loanSnap = await transaction.get(loanRef);
    if (!loanSnap.exists()) {
      throw new Error('Loan not found. Cannot process renewal.');
    }
    const loan = loanSnap.data();

    if (['Settled', 'Cancelled', 'Auctioned'].includes(loan.status)) {
      throw new Error(`Cannot renew a ${loan.status} loan.`);
    }

    // 2. Generate counters atomically
    const rnwSnap = await transaction.get(counterRnwRef);
    const nextRnw = (rnwSnap.exists() ? (rnwSnap.data().value || 0) : 0) + 1;
    transaction.set(counterRnwRef, { value: nextRnw }, { merge: true });
    const renewalNumber = `PGF-RNW-${String(nextRnw).padStart(6, '0')}`;

    const recSnap = await transaction.get(counterRecRef);
    const nextRec = (recSnap.exists() ? (recSnap.data().value || 0) : 0) + 1;
    transaction.set(counterRecRef, { value: nextRec }, { merge: true });
    const receiptNumber = `PGF-REC-${String(nextRec).padStart(6, '0')}`;

    const penaltyAmount = data.penalty_paid || 0;
    const interestPaid = data.interest_paid || 0;
    const principalPaid = data.principal_paid || 0;
    const totalPaid = data.total_paid || 0;

    // Validate allocation
    if (toPaise(interestPaid) + toPaise(principalPaid) + toPaise(penaltyAmount) !== toPaise(totalPaid)) {
      throw new Error('Payment allocation must equal total amount paid.');
    }

    let updatedLoanData: Record<string, any> = {};
    let newLoanData: Record<string, any> | null = null;

    // ------------------------------------------------------------------------
    // Option A & Option B: In-Place Renewal
    // ------------------------------------------------------------------------
    if (data.renewal_type === 'Interest_Only' || data.renewal_type === 'Interest_And_Principal') {
      const currentOutstandingInterest = loan.outstanding_interest || 0;
      const currentTotalPrincipalPaid = loan.total_principal_paid || 0;
      const currentPrincipal = Math.max(0, (loan.principal_amount || 0) - currentTotalPrincipalPaid);

      const newRemainingPrincipal = Math.max(0, currentPrincipal - principalPaid);
      const newOutstandingInterest = Math.max(0, currentOutstandingInterest - interestPaid);

      updatedLoanData = {
        maturity_date: data.new_maturity_date,
        loan_period_months: data.new_tenure_months,
        interest_rate_apr: data.apr_applied,
        total_interest_paid: (loan.total_interest_paid || 0) + interestPaid,
        total_principal_paid: currentTotalPrincipalPaid + principalPaid,
        outstanding_interest: newOutstandingInterest,
        status: 'Active',
        last_interest_calc_date: renewalDate.split('T')[0],
        last_renewal_date: renewalDate,
        last_renewal_number: renewalNumber,
        renewal_count: (loan.renewal_count || 0) + 1,
        updated_at: now,
      };

      transaction.update(loanRef, cleanPayload(updatedLoanData));

      // Record Renewal Payment
      const paymentRecord = cleanPayload({
        loan_id: data.loan_id,
        customer_id: data.customer_id,
        amount_paid: totalPaid,
        interest_portion: interestPaid,
        principal_portion: principalPaid,
        penalty_amount: penaltyAmount,
        waiver_amount: 0,
        payment_type: principalPaid > 0 ? 'Principal' : 'Interest',
        mode: paymentDetails.mode,
        receipt_number: receiptNumber,
        transaction_ref: paymentDetails.transaction_ref || null,
        remarks: data.remarks || `Loan Renewal (${data.renewal_type}) under Voucher ${renewalNumber}`,
        payment_date: renewalDate,
        slogan_id: sloganId,
        slogan_text: sloganText,
        amount_received_paise: toPaise(totalPaid),
        penalty_paid_paise: toPaise(penaltyAmount),
        interest_paid_paise: toPaise(interestPaid),
        principal_paid_paise: toPaise(principalPaid),
        principal_before_paise: toPaise(currentPrincipal),
        principal_after_paise: toPaise(newRemainingPrincipal),
        interest_before_paise: toPaise(currentOutstandingInterest),
        interest_after_paise: toPaise(newOutstandingInterest),
        status: 'POSTED',
        collected_by: paymentDetails.collected_by,
        branch_id: paymentDetails.branch_id || loan.branch_id || null,
        created_at: now,
      });

      transaction.set(paymentRef, paymentRecord);

    // ------------------------------------------------------------------------
    // Option C: Full Settlement & New Linked Loan Creation
    // ------------------------------------------------------------------------
    } else if (data.renewal_type === 'Full_Settlement_And_Renewal') {
      // 1. Close old loan
      updatedLoanData = {
        status: 'Settled',
        closed_at: renewalDate,
        total_principal_paid: loan.principal_amount || 0,
        total_interest_paid: (loan.total_interest_paid || 0) + interestPaid,
        outstanding_interest: 0,
        last_renewal_date: renewalDate,
        last_renewal_number: renewalNumber,
        updated_at: now,
      };
      transaction.update(loanRef, cleanPayload(updatedLoanData));

      // 2. Generate new loan number
      const lnSnap = await transaction.get(counterLoanRef);
      const nextLn = (lnSnap.exists() ? (lnSnap.data().value || 0) : 1000) + 1;
      transaction.set(counterLoanRef, { value: nextLn }, { merge: true });
      const newLoanNumber = `PGF-LN-${String(nextLn).padStart(5, '0')}`;

      // 3. Create new linked loan
      const newLoanRef = doc(collection(db, 'loans'));
      newLoanData = {
        customer_id: data.customer_id,
        loan_number: newLoanNumber,
        principal_amount: data.new_principal,
        disbursed_amount: data.new_principal,
        interest_rate_apr: data.apr_applied,
        loan_period_months: data.new_tenure_months,
        origination_date: renewalDate,
        maturity_date: data.new_maturity_date,
        total_interest_paid: 0,
        total_principal_paid: 0,
        outstanding_interest: 0,
        status: 'Active',
        renewed_from_loan_id: data.loan_id,
        renewed_from_loan_number: loan.loan_number,
        branch_id: paymentDetails.branch_id || loan.branch_id || null,
        notes: `Renewed from Loan ${loan.loan_number} under Voucher ${renewalNumber}`,
        created_at: now,
        updated_at: now,
      };
      transaction.set(newLoanRef, cleanPayload(newLoanData));

      // 4. Record settlement payment
      const paymentRecord = cleanPayload({
        loan_id: data.loan_id,
        customer_id: data.customer_id,
        amount_paid: totalPaid,
        interest_portion: interestPaid,
        principal_portion: principalPaid,
        penalty_amount: penaltyAmount,
        waiver_amount: 0,
        payment_type: 'Full_Settlement',
        mode: paymentDetails.mode,
        receipt_number: receiptNumber,
        transaction_ref: paymentDetails.transaction_ref || null,
        remarks: `Full settlement and renewal into ${newLoanNumber}`,
        payment_date: renewalDate,
        slogan_id: sloganId,
        slogan_text: sloganText,
        status: 'POSTED',
        collected_by: paymentDetails.collected_by,
        branch_id: paymentDetails.branch_id || loan.branch_id || null,
        created_at: now,
      });
      transaction.set(paymentRef, paymentRecord);

    // ------------------------------------------------------------------------
    // Option D: Renewal with Additional Loan Amount (Top-up)
    // ------------------------------------------------------------------------
    } else if (data.renewal_type === 'Additional_Disbursement') {
      const additionalAmt = data.additional_disbursement || 0;
      const currentPrincipal = Math.max(0, (loan.principal_amount || 0) - (loan.total_principal_paid || 0));
      const newPrincipal = currentPrincipal + additionalAmt;

      updatedLoanData = {
        principal_amount: newPrincipal,
        maturity_date: data.new_maturity_date,
        loan_period_months: data.new_tenure_months,
        interest_rate_apr: data.apr_applied,
        total_interest_paid: (loan.total_interest_paid || 0) + interestPaid,
        outstanding_interest: 0,
        status: 'Active',
        last_interest_calc_date: renewalDate.split('T')[0],
        last_renewal_date: renewalDate,
        last_renewal_number: renewalNumber,
        renewal_count: (loan.renewal_count || 0) + 1,
        additional_disbursement_total: (loan.additional_disbursement_total || 0) + additionalAmt,
        updated_at: now,
      };
      transaction.update(loanRef, cleanPayload(updatedLoanData));

      // Record payment for interest cleared
      const paymentRecord = cleanPayload({
        loan_id: data.loan_id,
        customer_id: data.customer_id,
        amount_paid: totalPaid,
        interest_portion: interestPaid,
        principal_portion: 0,
        penalty_amount: penaltyAmount,
        waiver_amount: 0,
        payment_type: 'Interest',
        mode: paymentDetails.mode,
        receipt_number: receiptNumber,
        transaction_ref: paymentDetails.transaction_ref || null,
        remarks: `Renewal with top-up disbursement ₹${additionalAmt}. Interest cleared.`,
        payment_date: renewalDate,
        slogan_id: sloganId,
        slogan_text: sloganText,
        status: 'POSTED',
        collected_by: paymentDetails.collected_by,
        branch_id: paymentDetails.branch_id || loan.branch_id || null,
        created_at: now,
      });
      transaction.set(paymentRef, paymentRecord);
    }

    // 5. Save Renewal Transaction Record
    const renewalRecord: LoanRenewal = {
      id: renewalRef.id,
      renewal_number: renewalNumber,
      loan_id: data.loan_id,
      loan_number: loan.loan_number,
      customer_id: data.customer_id,
      renewal_type: data.renewal_type,
      renewal_date: renewalDate,
      old_principal: data.old_principal,
      new_principal: data.new_principal,
      principal_paid: principalPaid,
      additional_disbursement: data.additional_disbursement || 0,
      interest_due: data.interest_due,
      interest_paid: interestPaid,
      penalty_paid: penaltyAmount,
      total_paid: totalPaid,
      old_maturity_date: data.old_maturity_date,
      new_maturity_date: data.new_maturity_date,
      new_tenure_months: data.new_tenure_months,
      apr_applied: data.apr_applied,
      new_loan_id: newLoanData ? (newLoanData as any).id : null,
      new_loan_number: newLoanData ? newLoanData.loan_number : null,
      receipt_number: receiptNumber,
      remarks: data.remarks || '',
      created_by: data.created_by,
      created_by_name: data.created_by_name,
      created_at: now,
    };

    transaction.set(renewalRef, cleanPayload(renewalRecord));

    return {
      renewal: renewalRecord,
      receiptNumber,
      updatedLoan: { ...loan, ...updatedLoanData },
      newLoan: newLoanData,
    };
  });

  // Audit Log Entry
  try {
    await addDoc(collection(db, 'audit_logs'), {
      actor_id: data.created_by,
      actor_name: data.created_by_name,
      actor_role: 'Manager',
      action_type: `Loan Renewal (${data.renewal_type})`,
      affected_entity: 'loans',
      affected_entity_id: data.loan_id,
      details: {
        renewal_number: result.renewal.renewal_number,
        receipt_number: result.receiptNumber,
        old_principal: data.old_principal,
        new_principal: data.new_principal,
        interest_paid: data.interest_paid,
        principal_paid: data.principal_paid,
        new_maturity_date: data.new_maturity_date,
      },
      timestamp: now,
    });
  } catch (auditErr) {
    console.warn('Audit logging notice:', auditErr);
  }

  return result;
}

/**
 * Get all renewal records for a given loan.
 */
export async function getRenewalsByLoan(loanId: string): Promise<LoanRenewal[]> {
  try {
    const q = query(
      collection(db, COLLECTION),
      where('loan_id', '==', loanId)
    );
    const snap = await getDocs(q);
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as unknown as LoanRenewal));
    list.sort((a, b) => (b.renewal_date || '').localeCompare(a.renewal_date || ''));
    return list;
  } catch (err) {
    console.error('Error getting renewals by loan:', err);
    return [];
  }
}

/**
 * Get a single renewal record by ID.
 */
export async function getRenewal(id: string): Promise<LoanRenewal | null> {
  try {
    const snap = await getDoc(doc(db, COLLECTION, id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as unknown as LoanRenewal;
  } catch (err) {
    console.error('Error fetching renewal record:', err);
    return null;
  }
}
