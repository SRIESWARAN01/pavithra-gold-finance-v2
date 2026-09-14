// src/lib/db/loans.ts
// Data access layer for loan management — CRUD, status engine, and aggregation backed by Cloud Firestore.

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
  runTransaction,
} from 'firebase/firestore';
import type { Loan, LoanInsert, LoanUpdate, LoanStatus, LoanWithBalance } from '@/types/database';

const COLLECTION = 'loans';

/**
 * Helper: fetch a profile by ID for joining.
 */
async function fetchProfile(id: string) {
  const snap = await getDoc(doc(db, 'profiles', id));
  if (!snap.exists()) return undefined;
  return { id: snap.id, ...snap.data() };
}

/**
 * Helper: fetch gold items for a loan.
 */
async function fetchGoldForLoan(loanId: string) {
  try {
    const q = query(collection(db, 'gold_collateral'), where('loan_id', '==', loanId));
    const snap = await getDocs(q);
    const items = [];
    for (const d of snap.docs) {
      const item = { id: d.id, ...d.data() };
      // Fetch photos for each item
      try {
        const photosQ = query(collection(db, 'gold_photos'), where('collateral_id', '==', d.id));
        const photosSnap = await getDocs(photosQ);
        (item as any).photos = photosSnap.docs.map((p) => ({ id: p.id, ...p.data() }));
      } catch {
        (item as any).photos = [];
      }
      items.push(item);
    }
    items.sort((a: any, b: any) => (a.created_at || '').localeCompare(b.created_at || ''));
    return items;
  } catch {
    return [];
  }
}

/**
 * Helper: fetch payments for a loan.
 */
async function fetchPaymentsForLoan(loanId: string) {
  try {
    const q = query(collection(db, 'payments'), where('loan_id', '==', loanId));
    const snap = await getDocs(q);
    const pmts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    pmts.sort((a: any, b: any) => (b.payment_date || '').localeCompare(a.payment_date || ''));
    return pmts;
  } catch {
    return [];
  }
}

/**
 * Generate a unique loan number using a Firestore transaction (atomic).
 */
async function generateLoanNumber(): Promise<string> {
  const counterRef = doc(db, 'counters', 'loan_number');
  const next = await runTransaction(db, async (transaction) => {
    const counterSnap = await transaction.get(counterRef);
    const current = counterSnap.exists() ? (counterSnap.data().value || 0) : 0;
    const nextVal = current + 1;
    transaction.set(counterRef, { value: nextVal }, { merge: true });
    return nextVal;
  });
  return `PGF-LN-${String(next).padStart(6, '0')}`;
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
 * Create a new loan. Auto-generates loan number if not provided.
 */
export async function createLoan(data: LoanInsert): Promise<Loan> {
  // Validation: reject invalid values
  if (!data.principal_amount || data.principal_amount <= 0) {
    throw new Error('Principal amount must be greater than zero.');
  }
  if (data.interest_rate_apr < 0 || data.interest_rate_apr > 100) {
    throw new Error('Annual interest rate must be between 0% and 100%.');
  }

  // Auto-generate loan number atomically
  if (!data.loan_number) {
    data.loan_number = await generateLoanNumber();
  }

  // Set maturity date from origination + period
  if (data.origination_date && data.loan_period_months && !data.maturity_date) {
    const orig = new Date(data.origination_date);
    orig.setMonth(orig.getMonth() + (data.loan_period_months || 12));
    data.maturity_date = orig.toISOString();
  }

  // Grace expiry = maturity + 30 days
  if (data.maturity_date && !data.grace_expiry_date) {
    const mat = new Date(data.maturity_date);
    mat.setDate(mat.getDate() + 30);
    data.grace_expiry_date = mat.toISOString();
  }

  const now = new Date().toISOString();
  const rawLoanData = {
    ...data,
    branch_id: data.branch_id || null,
    qr_code: data.qr_code || null,
    risk_score: data.risk_score || null,
    current_bin_id: data.current_bin_id || null,
    disbursed_amount: data.disbursed_amount || data.principal_amount,
    total_interest_paid: 0,
    total_principal_paid: 0,
    outstanding_interest: 0,
    last_interest_calc_date: null,
    closed_at: null,
    cancelled_at: null,
    cancelled_reason: null,
    notes: data.notes || null,
    status: data.status || 'Active',
    created_at: now,
    updated_at: now,
  };

  const loanData = cleanFirestorePayload(rawLoanData);
  const docRef = await addDoc(collection(db, COLLECTION), loanData);
  return { id: docRef.id, ...loanData } as unknown as Loan;
}

/**
 * Fetch a single loan by ID or Loan Number, optionally with related data.
 */
export async function getLoan(
  idOrNumber: string,
  options?: { withCustomer?: boolean; withGold?: boolean; withPayments?: boolean }
): Promise<Loan | null> {
  if (!idOrNumber) return null;

  let loanDocSnap = await getDoc(doc(db, COLLECTION, idOrNumber));
  let loanId = idOrNumber;
  let rawData: any = null;

  if (loanDocSnap.exists()) {
    rawData = loanDocSnap.data();
    loanId = loanDocSnap.id;
  } else {
    // Fallback: lookup by loan_number
    const q = query(collection(db, COLLECTION), where('loan_number', '==', idOrNumber), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) {
      loanDocSnap = snap.docs[0];
      loanId = loanDocSnap.id;
      rawData = loanDocSnap.data();
    } else {
      return null;
    }
  }

  const loan: any = { id: loanId, ...rawData };

  if (options?.withCustomer && loan.customer_id) {
    loan.customer = await fetchProfile(loan.customer_id);
  }
  if (options?.withGold) {
    loan.gold_items = await fetchGoldForLoan(loanId);
  }
  if (options?.withPayments) {
    loan.payments = await fetchPaymentsForLoan(loanId);
  }

  return loan as Loan;
}

/**
 * Fetch a loan by loan number.
 */
export async function getLoanByNumber(loanNumber: string): Promise<Loan | null> {
  return getLoan(loanNumber, { withCustomer: true, withGold: true, withPayments: true });
}

/**
 * Update loan fields.
 */
export async function updateLoan(id: string, data: LoanUpdate): Promise<Loan> {
  const loanRef = doc(db, COLLECTION, id);
  const updateData = { ...data, updated_at: new Date().toISOString() };
  await updateDoc(loanRef, updateData);

  const updated = await getDoc(loanRef);
  return { id: updated.id, ...updated.data() } as unknown as Loan;
}

/**
 * Update loan status with automatic timestamp management.
 */
export async function updateLoanStatus(
  id: string,
  newStatus: LoanStatus,
  reason?: string
): Promise<Loan> {
  const updateData: LoanUpdate = { status: newStatus };

  if (newStatus === 'Settled') {
    updateData.closed_at = new Date().toISOString();
  } else if (newStatus === 'Cancelled') {
    updateData.cancelled_at = new Date().toISOString();
  }
  if (reason) updateData.cancelled_reason = reason;

  return updateLoan(id, updateData);
}

/**
 * List loans with filters and pagination.
 * Performs in-memory sorting to prevent Firestore composite index errors.
 */
export async function listLoans(options?: {
  customerId?: string;
  status?: LoanStatus | LoanStatus[];
  page?: number;
  pageSize?: number;
  orderBy?: string;
  ascending?: boolean;
  branchId?: string;
}): Promise<{ loans: Loan[]; count: number }> {
  try {
    const constraints: any[] = [];

    if (options?.customerId) {
      constraints.push(where('customer_id', '==', options.customerId));
    }

    if (options?.branchId) {
      constraints.push(where('branch_id', '==', options.branchId));
    }

    if (options?.status) {
      if (Array.isArray(options.status)) {
        constraints.push(where('status', 'in', options.status));
      } else {
        constraints.push(where('status', '==', options.status));
      }
    }

    const q = constraints.length > 0
      ? query(collection(db, COLLECTION), ...constraints)
      : query(collection(db, COLLECTION));

    const snapshot = await getDocs(q);

    const allLoans: Loan[] = [];
    for (const d of snapshot.docs) {
      const loan: any = { id: d.id, ...d.data() };
      if (loan.customer_id) {
        loan.customer = await fetchProfile(loan.customer_id);
      }
      allLoans.push(loan as Loan);
    }

    // In-memory sorting (prevents Firestore composite index requirements)
    const orderKey = options?.orderBy ?? 'created_at';
    const isAsc = !!options?.ascending;
    allLoans.sort((a: any, b: any) => {
      const valA = a[orderKey] || '';
      const valB = b[orderKey] || '';
      if (valA < valB) return isAsc ? -1 : 1;
      if (valA > valB) return isAsc ? 1 : -1;
      return 0;
    });

    // Client-side pagination
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 50;
    const start = (page - 1) * pageSize;
    const paginated = allLoans.slice(start, start + pageSize);

    return { loans: paginated, count: allLoans.length };
  } catch (err) {
    console.error('Error listing loans from Firestore:', err);
    return { loans: [], count: 0 };
  }
}

/**
 * Get active loans for a customer (customer portal).
 */
export async function getActiveLoansByCustomer(customerId: string): Promise<Loan[]> {
  try {
    const q = query(
      collection(db, COLLECTION),
      where('customer_id', '==', customerId)
    );
    const snapshot = await getDocs(q);

    const loans: Loan[] = [];
    const activeStatuses = ['Active', 'Due', 'Overdue', 'Grace_Period', 'Draft'];
    for (const d of snapshot.docs) {
      const data = d.data();
      if (activeStatuses.includes(data.status)) {
        const loan: any = { id: d.id, ...data };
        loan.gold_items = await fetchGoldForLoan(d.id);
        loans.push(loan as Loan);
      }
    }

    loans.sort((a, b) => (b.origination_date || '').localeCompare(a.origination_date || ''));
    return loans;
  } catch (err) {
    console.error('Error fetching active loans by customer:', err);
    return [];
  }
}

/**
 * Get loans due on a specific date or date range (for notifications/cron).
 */
export async function getLoansDueInRange(
  fromDate: string,
  toDate: string,
  branchId?: string
): Promise<Loan[]> {
  try {
    const constraints: any[] = [];
    if (branchId) {
      constraints.push(where('branch_id', '==', branchId));
    }

    const q = constraints.length > 0
      ? query(collection(db, COLLECTION), ...constraints)
      : query(collection(db, COLLECTION));

    const snapshot = await getDocs(q);

    const loans: Loan[] = [];
    for (const d of snapshot.docs) {
      const loan: any = { id: d.id, ...d.data() };
      if (!['Active', 'Due', 'Grace_Period', 'Overdue'].includes(loan.status)) continue;
      if (!loan.maturity_date) continue;
      
      const matDate = loan.maturity_date.split('T')[0];
      if (matDate >= fromDate && matDate <= toDate) {
        if (loan.customer_id) {
          loan.customer = await fetchProfile(loan.customer_id);
        }
        loans.push(loan as Loan);
      }
    }

    return loans;
  } catch (err) {
    console.error('Error getting loans due in range:', err);
    return [];
  }
}

/**
 * Get overdue loans (maturity_date < today and status is Active/Due/Overdue).
 */
export async function getOverdueLoans(branchId?: string): Promise<Loan[]> {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const constraints: any[] = [];
    if (branchId) {
      constraints.push(where('branch_id', '==', branchId));
    }

    const q = constraints.length > 0
      ? query(collection(db, COLLECTION), ...constraints)
      : query(collection(db, COLLECTION));

    const snapshot = await getDocs(q);

    const loans: Loan[] = [];
    for (const d of snapshot.docs) {
      const loan: any = { id: d.id, ...d.data() };
      if (['Active', 'Due', 'Overdue'].includes(loan.status) && loan.maturity_date) {
        const matDate = loan.maturity_date.split('T')[0];
        if (matDate < todayStr) {
          if (loan.customer_id) {
            loan.customer = await fetchProfile(loan.customer_id);
          }
          loans.push(loan as Loan);
        }
      }
    }

    loans.sort((a, b) => (a.maturity_date || '').localeCompare(b.maturity_date || ''));
    return loans;
  } catch (err) {
    console.error('Error fetching overdue loans:', err);
    return [];
  }
}

/**
 * Aggregate loan statistics for the admin dashboard.
 */
export async function getLoanStats(branchId?: string): Promise<{
  active: number;
  closed: number;
  overdue: number;
  dueToday: number;
  dueThisWeek: number;
  totalPrincipal: number;
  totalOutstanding: number;
}> {
  try {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const weekEndStr = weekEnd.toISOString().split('T')[0];

    const constraints: any[] = [];
    if (branchId) {
      constraints.push(where('branch_id', '==', branchId));
    }

    const q = constraints.length > 0
      ? query(collection(db, COLLECTION), ...constraints)
      : query(collection(db, COLLECTION));
    const snapshot = await getDocs(q);

    let active = 0, closed = 0, overdue = 0, dueToday = 0, dueThisWeek = 0;
    let totalPrincipal = 0, totalOutstanding = 0;

    for (const d of snapshot.docs) {
      const loan = d.data();
      const remaining = (loan.principal_amount || 0) - (loan.total_principal_paid || 0);
      const outstanding = remaining + (loan.outstanding_interest || 0);

      if (['Active', 'Due', 'Overdue', 'Grace_Period'].includes(loan.status)) {
        active++;
        totalPrincipal += loan.principal_amount || 0;
        totalOutstanding += outstanding;
      }
      if (loan.status === 'Settled') closed++;
      if (loan.status === 'Overdue' || loan.status === 'Defaulted') overdue++;

      if (loan.maturity_date) {
        const matDate = typeof loan.maturity_date === 'string'
          ? loan.maturity_date.split('T')[0]
          : loan.maturity_date;
        if (matDate === todayStr && ['Active', 'Due'].includes(loan.status)) dueToday++;
        if (matDate >= todayStr && matDate <= weekEndStr && ['Active', 'Due'].includes(loan.status)) dueThisWeek++;
      }
    }

    return { active, closed, overdue, dueToday, dueThisWeek, totalPrincipal, totalOutstanding };
  } catch (err) {
    console.error('Error computing loan stats:', err);
    return { active: 0, closed: 0, overdue: 0, dueToday: 0, dueThisWeek: 0, totalPrincipal: 0, totalOutstanding: 0 };
  }
}
