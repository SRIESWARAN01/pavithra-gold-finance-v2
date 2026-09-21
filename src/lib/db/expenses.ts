// src/lib/db/expenses.ts
// Data access layer for PGF Expenses Management backed by Cloud Firestore.
// Handles expense recording, atomic numbering (PGF-EXP-XXXXXX), double-entry journal posting, and audit trail.

import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  runTransaction,
} from 'firebase/firestore';
import type {
  Expense,
  ExpenseInsert,
  ExpenseStatus,
  ExpenseCategory,
  ExpensePaymentMode,
} from '@/types/database';
import { auditCreate } from '@/lib/db/audit';

const COLLECTION = 'expenses';
const CATEGORIES_COLLECTION = 'expense_categories';

/**
 * Initial standard expense categories and subcategories.
 */
export const DEFAULT_EXPENSE_CATEGORIES: Array<{ name: string; subcategories: string[] }> = [
  {
    name: 'Employee / Staff',
    subcategories: ['Salary', 'Staff Incentive', 'Staff Welfare', 'Travel / Conveyance'],
  },
  {
    name: 'Office',
    subcategories: ['Office Rent', 'EB / Electricity Bill', 'Water Bill', 'Internet', 'Telephone / Mobile'],
  },
  {
    name: 'Office Supplies',
    subcategories: ['Stationery', 'Printing', 'Xerox', 'Paper', 'Printer Consumables', 'Other Office Supplies'],
  },
  {
    name: 'Maintenance',
    subcategories: [
      'Computer / IT Maintenance',
      'CCTV Maintenance',
      'Furniture Maintenance',
      'Electrical Maintenance',
      'Building Maintenance',
    ],
  },
  {
    name: 'Business / Operations',
    subcategories: [
      'Advertisement',
      'Marketing',
      'Transportation',
      'Courier',
      'Bank Charges',
      'Legal / Professional Charges',
      'Insurance',
      'Other Business Expenses',
    ],
  },
  {
    name: 'Other',
    subcategories: ['Miscellaneous Expense'],
  },
];

/**
 * Generate a unique sequential Expense Number atomically (e.g. PGF-EXP-000001).
 */
export async function generateExpenseNumber(): Promise<string> {
  const counterRef = doc(db, 'counters', 'expense_number');
  const next = await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(counterRef);
    const current = snap.exists() ? snap.data().value || 0 : 0;
    const nextVal = current + 1;
    transaction.set(counterRef, { value: nextVal }, { merge: true });
    return nextVal;
  });
  return `PGF-EXP-${String(next).padStart(6, '0')}`;
}

/**
 * Recursively sanitize an object to remove undefined values.
 */
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

/**
 * Determine the default credit account based on payment mode.
 */
function getCreditAccount(mode: ExpensePaymentMode): string {
  if (mode === 'Cash') {
    return 'Vault Petty Cash';
  }
  return 'Bank Clearing Account';
}

/**
 * Create a new expense entry.
 * If autoApprove is true (e.g. entered by Admin/Owner/Manager), status is 'Approved'/'Posted'
 * and an automatic double-entry voucher is created in `accounting_journals`.
 */
export async function createExpense(
  data: ExpenseInsert,
  autoApprove: boolean = false
): Promise<Expense> {
  if (!data.amount || data.amount <= 0) {
    throw new Error('Expense amount must be greater than zero.');
  }
  if (!data.category || !data.category.trim()) {
    throw new Error('Expense Head / Category is mandatory.');
  }

  const now = new Date().toISOString();
  const expenseNumber = await generateExpenseNumber();

  const finalStatus: ExpenseStatus = autoApprove
    ? 'Posted'
    : (data.status || 'Pending Approval');

  const defaultAccount = data.account || getCreditAccount(data.payment_mode);

  // If auto-approved/posted, generate double-entry journal voucher
  let journalVoucherId: string | null = null;
  if (finalStatus === 'Posted' || finalStatus === 'Approved') {
    try {
      const journalEntry = {
        date: data.date,
        desc: `${expenseNumber} - ${data.category} (${data.subcategory || ''}): ${data.description}`.trim(),
        debitAcc: data.category, // Debit Expense Head
        creditAcc: defaultAccount, // Credit Cash or Bank
        amount: data.amount,
        createdBy: data.created_by_name || 'Staff',
        referenceNumber: expenseNumber,
        branch_id: data.branch_id || null,
        created_at: now,
      };
      const jvDoc = await addDoc(collection(db, 'accounting_journals'), cleanPayload(journalEntry));
      journalVoucherId = jvDoc.id;
    } catch (jvErr) {
      console.warn('[Expenses] Journal voucher posting notice:', jvErr);
    }
  }

  const expensePayload = {
    expense_number: expenseNumber,
    date: data.date,
    category: data.category.trim(),
    subcategory: data.subcategory?.trim() || '',
    description: data.description?.trim() || '',
    amount: data.amount,
    payment_mode: data.payment_mode,
    account: defaultAccount,
    transaction_ref: data.transaction_ref?.trim() || null,
    vendor_name: data.vendor_name?.trim() || null,
    invoice_number: data.invoice_number?.trim() || null,
    invoice_date: data.invoice_date || null,
    supporting_doc_url: data.supporting_doc_url?.trim() || null,
    branch_id: data.branch_id || null,
    branch_name: data.branch_name || null,
    status: finalStatus,
    created_by: data.created_by,
    created_by_name: data.created_by_name,
    approved_by: autoApprove ? data.created_by : null,
    approved_by_name: autoApprove ? data.created_by_name : null,
    approved_at: autoApprove ? now : null,
    rejection_reason: null,
    cancellation_reason: null,
    journal_voucher_id: journalVoucherId,
    created_at: now,
    updated_at: now,
  };

  const docRef = await addDoc(collection(db, COLLECTION), cleanPayload(expensePayload));
  const created = { id: docRef.id, ...expensePayload } as Expense;

  // Log to audit trail
  try {
    await auditCreate(data.created_by, COLLECTION, docRef.id, {
      action: 'Expense Created',
      expense_number: expenseNumber,
      category: data.category,
      amount: data.amount,
      status: finalStatus,
      payment_mode: data.payment_mode,
      branch_id: data.branch_id || null,
    });
  } catch (auditErr) {
    console.warn('[Expenses] Audit logging notice:', auditErr);
  }

  return created;
}

/**
 * Update expense status (Approve, Reject, Cancel).
 * When Approved/Posted: creates double-entry journal voucher.
 * When Cancelled: creates reversing journal voucher.
 */
export async function updateExpenseStatus(
  id: string,
  newStatus: ExpenseStatus,
  actor: { id: string; name: string; role: string },
  reason?: string
): Promise<Expense> {
  const expRef = doc(db, COLLECTION, id);
  const snap = await getDoc(expRef);
  if (!snap.exists()) {
    throw new Error('Expense record not found.');
  }

  const existing = snap.data() as Expense;
  const now = new Date().toISOString();

  let journalVoucherId = existing.journal_voucher_id || null;

  // If approving/posting for the first time without an existing JV
  if ((newStatus === 'Approved' || newStatus === 'Posted') && !journalVoucherId) {
    try {
      const journalEntry = {
        date: existing.date,
        desc: `${existing.expense_number} - ${existing.category}: ${existing.description}`.trim(),
        debitAcc: existing.category,
        creditAcc: existing.account || getCreditAccount(existing.payment_mode),
        amount: existing.amount,
        createdBy: actor.name,
        referenceNumber: existing.expense_number,
        branch_id: existing.branch_id || null,
        created_at: now,
      };
      const jvDoc = await addDoc(collection(db, 'accounting_journals'), cleanPayload(journalEntry));
      journalVoucherId = jvDoc.id;
    } catch (err) {
      console.warn('[Expenses] Error creating journal on approval:', err);
    }
  }

  // If cancelling a posted expense, create a reversing entry
  if (newStatus === 'Cancelled' && (existing.status === 'Posted' || existing.status === 'Approved')) {
    try {
      const reversingEntry = {
        date: now.split('T')[0],
        desc: `[REVERSAL] Cancellation of ${existing.expense_number} - ${existing.category}. Reason: ${reason || 'Cancelled by Admin'}`.trim(),
        debitAcc: existing.account || getCreditAccount(existing.payment_mode), // Reverse: Debit Cash/Bank
        creditAcc: existing.category, // Reverse: Credit Expense Head
        amount: existing.amount,
        createdBy: actor.name,
        referenceNumber: `REV-${existing.expense_number}`,
        branch_id: existing.branch_id || null,
        created_at: now,
      };
      await addDoc(collection(db, 'accounting_journals'), cleanPayload(reversingEntry));
    } catch (err) {
      console.warn('[Expenses] Error creating reversing journal on cancellation:', err);
    }
  }

  const updateData: Record<string, any> = {
    status: newStatus,
    updated_at: now,
  };

  if (newStatus === 'Approved' || newStatus === 'Posted') {
    updateData.approved_by = actor.id;
    updateData.approved_by_name = actor.name;
    updateData.approved_at = now;
    updateData.journal_voucher_id = journalVoucherId;
  } else if (newStatus === 'Rejected') {
    updateData.rejection_reason = reason || 'Rejected by Manager';
  } else if (newStatus === 'Cancelled') {
    updateData.cancellation_reason = reason || 'Cancelled by Admin';
  }

  await updateDoc(expRef, cleanPayload(updateData));

  // Audit log
  try {
    await auditCreate(actor.id, COLLECTION, id, {
      action: `Expense Status Changed to ${newStatus}`,
      expense_number: existing.expense_number,
      previous_status: existing.status,
      new_status: newStatus,
      reason: reason || null,
      actor_role: actor.role,
    });
  } catch (auditErr) {
    console.warn('[Expenses] Audit logging notice:', auditErr);
  }

  const updatedSnap = await getDoc(expRef);
  return { id: updatedSnap.id, ...updatedSnap.data() } as Expense;
}

/**
 * List expenses with comprehensive filters and client-side sorting.
 */
export async function listExpenses(options?: {
  date?: string;
  fromDate?: string;
  toDate?: string;
  category?: string;
  branchId?: string;
  paymentMode?: string;
  status?: ExpenseStatus;
  minAmount?: number;
  maxAmount?: number;
  searchQuery?: string;
}): Promise<Expense[]> {
  try {
    const constraints: any[] = [];

    if (options?.category) {
      constraints.push(where('category', '==', options.category));
    }
    if (options?.branchId && options.branchId !== 'all') {
      constraints.push(where('branch_id', '==', options.branchId));
    }
    if (options?.status) {
      constraints.push(where('status', '==', options.status));
    }
    if (options?.paymentMode) {
      constraints.push(where('payment_mode', '==', options.paymentMode));
    }

    const q = constraints.length > 0
      ? query(collection(db, COLLECTION), ...constraints)
      : query(collection(db, COLLECTION));

    const snap = await getDocs(q);
    let items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Expense));

    // Date filtering (in-memory for flexible comparison)
    if (options?.date) {
      items = items.filter((e) => e.date === options.date);
    } else {
      if (options?.fromDate) {
        items = items.filter((e) => e.date >= options.fromDate!);
      }
      if (options?.toDate) {
        items = items.filter((e) => e.date <= options.toDate!);
      }
    }

    // Amount range filtering
    if (options?.minAmount !== undefined) {
      items = items.filter((e) => e.amount >= options.minAmount!);
    }
    if (options?.maxAmount !== undefined) {
      items = items.filter((e) => e.amount <= options.maxAmount!);
    }

    // Text search query
    if (options?.searchQuery && options.searchQuery.trim()) {
      const s = options.searchQuery.trim().toLowerCase();
      items = items.filter(
        (e) =>
          e.expense_number.toLowerCase().includes(s) ||
          e.category.toLowerCase().includes(s) ||
          (e.subcategory && e.subcategory.toLowerCase().includes(s)) ||
          e.description.toLowerCase().includes(s) ||
          (e.vendor_name && e.vendor_name.toLowerCase().includes(s)) ||
          (e.invoice_number && e.invoice_number.toLowerCase().includes(s)) ||
          (e.created_by_name && e.created_by_name.toLowerCase().includes(s))
      );
    }

    // Sort descending by date, then created_at
    items.sort((a, b) => {
      const dateCmp = (b.date || '').localeCompare(a.date || '');
      if (dateCmp !== 0) return dateCmp;
      return (b.created_at || '').localeCompare(a.created_at || '');
    });

    return items;
  } catch (err) {
    console.error('[Expenses] Error listing expenses:', err);
    return [];
  }
}

/**
 * Fetch a single expense by ID.
 */
export async function getExpenseById(id: string): Promise<Expense | null> {
  try {
    const snap = await getDoc(doc(db, COLLECTION, id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as Expense;
  } catch (err) {
    console.error('[Expenses] Error fetching expense by ID:', err);
    return null;
  }
}

/**
 * Fetch all expense categories, combining default and custom categories from Firestore.
 */
export async function getExpenseCategories(): Promise<ExpenseCategory[]> {
  try {
    const snap = await getDocs(collection(db, CATEGORIES_COLLECTION));
    if (!snap.empty) {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ExpenseCategory));
      return list.filter((c) => c.is_active !== false);
    }

    // Return default categories if none in Firestore
    return DEFAULT_EXPENSE_CATEGORIES.map((cat, idx) => ({
      id: `default_cat_${idx + 1}`,
      name: cat.name,
      subcategories: cat.subcategories,
      is_active: true,
      created_at: new Date().toISOString(),
    }));
  } catch (err) {
    console.warn('[Expenses] Error fetching categories, using defaults:', err);
    return DEFAULT_EXPENSE_CATEGORIES.map((cat, idx) => ({
      id: `default_cat_${idx + 1}`,
      name: cat.name,
      subcategories: cat.subcategories,
      is_active: true,
      created_at: new Date().toISOString(),
    }));
  }
}

/**
 * Create or update an expense category.
 */
export async function saveExpenseCategory(category: {
  id?: string;
  name: string;
  subcategories: string[];
}): Promise<ExpenseCategory> {
  const now = new Date().toISOString();
  const payload = {
    name: category.name.trim(),
    subcategories: category.subcategories.map((s) => s.trim()).filter(Boolean),
    is_active: true,
    created_at: now,
  };

  if (category.id && !category.id.startsWith('default_cat_')) {
    const docRef = doc(db, CATEGORIES_COLLECTION, category.id);
    await updateDoc(docRef, cleanPayload(payload));
    return { id: category.id, ...payload };
  } else {
    const docRef = await addDoc(collection(db, CATEGORIES_COLLECTION), cleanPayload(payload));
    return { id: docRef.id, ...payload };
  }
}
