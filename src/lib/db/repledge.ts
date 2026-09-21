// src/lib/db/repledge.ts
// Data access layer for Bank Re-Pledge Management backed by Cloud Firestore.
// Manages the complete lifecycle: Customer Loan -> Bank Re-Pledge -> Custody Tracking -> Release to PGF Safe.

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
  onSnapshot,
  runTransaction,
  writeBatch,
} from 'firebase/firestore';
import type { BankRePledge, BankRePledgeInsert, BankRePledgeStatus } from '@/types/database';
import { auditCreate } from '@/lib/db/audit';
import { createNotification } from '@/lib/db/notifications';

const COLLECTION = 'bankRePledges';
const COLLATERAL_COLLECTION = 'gold_collateral';

/**
 * Generate a unique Re-Pledge identifier using Firestore atomic counter.
 */
async function generateRePledgeNumber(): Promise<string> {
  const counterRef = doc(db, 'counters', 'repledge_number');
  const next = await runTransaction(db, async (transaction) => {
    const counterSnap = await transaction.get(counterRef);
    const current = counterSnap.exists() ? (counterSnap.data().value || 1000) : 1000;
    const nextVal = current + 1;
    transaction.set(counterRef, { value: nextVal }, { merge: true });
    return nextVal;
  });
  return `PGF-REP-${String(next).padStart(4, '0')}`;
}

/**
 * Recursively sanitize an object to remove `undefined` values.
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
 * Create a new Bank Re-Pledge entry.
 * If user is Admin, they can approve directly; otherwise enters 'Pending Approval'.
 */
export async function createBankRePledge(
  data: BankRePledgeInsert,
  isAdminUser: boolean = false
): Promise<BankRePledge> {
  const now = new Date().toISOString();
  const repledgeNumber = await generateRePledgeNumber();

  const isAutoApproved = isAdminUser && (data.status === 'Active' || data.status === 'Approved' || data.status === 'Pledged with Bank');
  const finalStatus: BankRePledgeStatus = isAutoApproved ? 'Active' : (data.status || 'Pending Approval');
  const bankCustodyLocation = `${data.bank_name} (${data.bank_branch})`;
  const custodyLocation = finalStatus === 'Active' ? bankCustodyLocation : 'PGF Safe';

  const rawPayload = {
    ...data,
    repledge_number: repledgeNumber,
    status: finalStatus,
    custody_location: custodyLocation,
    interest_accrued: 0,
    interest_paid: 0,
    bank_outstanding: data.bank_pledge_amount,
    principal_repaid: 0,
    last_interest_payment_date: null,
    created_at: now,
    approved_by: isAutoApproved ? data.created_by : null,
    approved_by_name: isAutoApproved ? data.created_by_name : null,
    approved_at: isAutoApproved ? now : null,
    release_date: null,
    bank_amount_repaid: null,
    bank_interest_settled: null,
    total_bank_settlement: null,
    bank_release_reference: null,
    released_by: null,
    released_by_name: null,
    released_at: null,
    release_remarks: null,
  };

  const cleanData = cleanPayload(rawPayload);
  const docRef = await addDoc(collection(db, COLLECTION), cleanData);
  const createdPledge = { id: docRef.id, ...cleanData } as BankRePledge;

  // If immediately active, update physical custody location on the gold collateral items
  if (finalStatus === 'Active' && data.collateral_item_ids && data.collateral_item_ids.length > 0) {
    try {
      const batch = writeBatch(db);
      data.collateral_item_ids.forEach((itemId) => {
        const itemRef = doc(db, COLLATERAL_COLLECTION, itemId);
        batch.update(itemRef, {
          custody_location: bankCustodyLocation,
          bank_repledge_id: docRef.id,
        });
      });
      await batch.commit();
    } catch (collateralErr) {
      console.warn('Error updating collateral custody location:', collateralErr);
    }
  }

  // Audit log
  try {
    await auditCreate(data.created_by, COLLECTION, docRef.id, {
      action: 'Bank Re-Pledge Created',
      repledge_number: repledgeNumber,
      customer_id: data.customer_id,
      customer_name: data.customer_name,
      loan_number: data.loan_number,
      bank_name: data.bank_name,
      bank_pledge_amount: data.bank_pledge_amount,
      bank_interest_rate: data.bank_interest_rate,
      status: finalStatus,
      custody_location: custodyLocation,
      remarks: data.remarks || '',
    });
  } catch (err) {
    console.warn('Audit error creating bank re-pledge:', err);
  }

  // Notification for admin/management
  try {
    await createNotification({
      recipient_id: 'admin_broadcast',
      type: 'System',
      title: `Bank Re-Pledge: ${repledgeNumber}`,
      message: `${data.created_by_name} created re-pledge ${repledgeNumber} with ${data.bank_name} for loan ${data.loan_number} (₹${data.bank_pledge_amount.toLocaleString('en-IN')}). Status: ${finalStatus}`,
      related_entity_type: 'bankRePledges',
      related_entity_id: docRef.id,
    });
  } catch (notifyErr) {
    console.warn('Notification error on bank re-pledge:', notifyErr);
  }

  return createdPledge;
}

/**
 * Approve a pending Bank Re-Pledge (Admin action).
 * Moves status to 'Active' and transfers gold custody location to the bank.
 */
export async function approveBankRePledge(
  repledgeId: string,
  reviewerId: string,
  reviewerName: string,
  reviewNotes?: string
): Promise<void> {
  const pRef = doc(db, COLLECTION, repledgeId);
  const pSnap = await getDoc(pRef);
  if (!pSnap.exists()) {
    throw new Error('Bank Re-Pledge record not found');
  }

  const pledge = pSnap.data() as BankRePledge;
  const now = new Date().toISOString();
  const bankCustodyLocation = `${pledge.bank_name} (${pledge.bank_branch})`;

  const updateData = {
    status: 'Active' as BankRePledgeStatus,
    approved_by: reviewerId,
    approved_by_name: reviewerName,
    approved_at: now,
    custody_location: bankCustodyLocation,
    remarks: reviewNotes ? `${pledge.remarks || ''}\n[Approval Note]: ${reviewNotes}`.trim() : pledge.remarks,
  };

  await updateDoc(pRef, updateData);

  // Update physical custody location of all collateral items to the bank
  if (pledge.collateral_item_ids && pledge.collateral_item_ids.length > 0) {
    try {
      const batch = writeBatch(db);
      pledge.collateral_item_ids.forEach((itemId) => {
        const itemRef = doc(db, COLLATERAL_COLLECTION, itemId);
        batch.update(itemRef, {
          custody_location: bankCustodyLocation,
          bank_repledge_id: repledgeId,
        });
      });
      await batch.commit();
    } catch (collateralErr) {
      console.warn('Error updating collateral items on approval:', collateralErr);
    }
  }

  // Audit log
  try {
    await auditCreate(reviewerId, COLLECTION, repledgeId, {
      action: 'Bank Re-Pledge Approved',
      repledge_number: pledge.repledge_number,
      customer_id: pledge.customer_id,
      loan_number: pledge.loan_number,
      bank_name: pledge.bank_name,
      previous_status: pledge.status,
      new_status: 'Active',
      custody_location: bankCustodyLocation,
      approved_by: reviewerName,
      review_notes: reviewNotes || null,
    });
  } catch (err) {
    console.warn('Audit error on approving bank re-pledge:', err);
  }

  // Notify creator
  try {
    await createNotification({
      recipient_id: pledge.created_by,
      type: 'System',
      title: `Bank Re-Pledge Approved: ${pledge.repledge_number}`,
      message: `Bank Re-Pledge ${pledge.repledge_number} (${pledge.bank_name}) has been approved by ${reviewerName}. Gold ornaments transferred to bank custody.`,
      related_entity_type: 'bankRePledges',
      related_entity_id: repledgeId,
    });
  } catch (notifyErr) {
    console.warn('Notification error on approval:', notifyErr);
  }
}

/**
 * Record Bank Re-Pledge Release / Return.
 * Settles bank financial obligations and safely returns the gold ornaments to the PGF Safe.
 */
export async function recordBankRepledgeRelease(
  repledgeId: string,
  releaseData: {
    bank_amount_repaid: number;
    bank_interest_settled: number;
    total_bank_settlement: number;
    bank_release_reference: string;
    release_remarks?: string;
  },
  staffId: string,
  staffName: string
): Promise<void> {
  const pRef = doc(db, COLLECTION, repledgeId);
  const pSnap = await getDoc(pRef);
  if (!pSnap.exists()) {
    throw new Error('Bank Re-Pledge record not found');
  }

  const pledge = pSnap.data() as BankRePledge;
  const now = new Date().toISOString();

  const updateData = {
    status: 'Released' as BankRePledgeStatus,
    custody_location: 'PGF Safe',
    bank_outstanding: 0,
    principal_repaid: releaseData.bank_amount_repaid,
    interest_paid: (pledge.interest_paid || 0) + releaseData.bank_interest_settled,
    release_date: now,
    bank_amount_repaid: releaseData.bank_amount_repaid,
    bank_interest_settled: releaseData.bank_interest_settled,
    total_bank_settlement: releaseData.total_bank_settlement,
    bank_release_reference: releaseData.bank_release_reference,
    released_by: staffId,
    released_by_name: staffName,
    released_at: now,
    release_remarks: releaseData.release_remarks || null,
  };

  await updateDoc(pRef, cleanPayload(updateData));

  // Return physical custody of all collateral items back to 'PGF Safe'
  if (pledge.collateral_item_ids && pledge.collateral_item_ids.length > 0) {
    try {
      const batch = writeBatch(db);
      pledge.collateral_item_ids.forEach((itemId) => {
        const itemRef = doc(db, COLLATERAL_COLLECTION, itemId);
        batch.update(itemRef, {
          custody_location: 'PGF Safe',
          bank_repledge_id: null,
        });
      });
      await batch.commit();
    } catch (collateralErr) {
      console.warn('Error returning collateral items to PGF safe:', collateralErr);
    }
  }

  // Audit log
  try {
    await auditCreate(staffId, COLLECTION, repledgeId, {
      action: 'Bank Re-Pledge Released & Returned to PGF Safe',
      repledge_number: pledge.repledge_number,
      customer_id: pledge.customer_id,
      loan_number: pledge.loan_number,
      bank_name: pledge.bank_name,
      principal_repaid: releaseData.bank_amount_repaid,
      interest_settled: releaseData.bank_interest_settled,
      total_settlement: releaseData.total_bank_settlement,
      bank_release_reference: releaseData.bank_release_reference,
      previous_custody: pledge.custody_location,
      new_custody: 'PGF Safe',
      released_by: staffName,
      remarks: releaseData.release_remarks || '',
    });
  } catch (err) {
    console.warn('Audit error on releasing bank re-pledge:', err);
  }

  // Notification
  try {
    await createNotification({
      recipient_id: 'admin_broadcast',
      type: 'System',
      title: `Gold Returned to Safe: ${pledge.repledge_number}`,
      message: `Bank Re-Pledge ${pledge.repledge_number} with ${pledge.bank_name} settled (₹${releaseData.total_bank_settlement.toLocaleString('en-IN')}). Ornaments returned safely to PGF Safe by ${staffName}.`,
      related_entity_type: 'bankRePledges',
      related_entity_id: repledgeId,
    });
  } catch (notifyErr) {
    console.warn('Notification error on release:', notifyErr);
  }
}

/**
 * Fetch all Bank Re-Pledges with real-time listener support.
 */
export function listenBankRePledges(callback: (items: BankRePledge[]) => void): () => void {
  const q = query(collection(db, COLLECTION), orderBy('created_at', 'desc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as BankRePledge[];
      callback(items);
    },
    (err) => {
      console.warn('Firestore onSnapshot error on bankRePledges:', err);
    }
  );
}

/**
 * One-off fetch of all Bank Re-Pledges.
 */
export async function getBankRePledges(): Promise<BankRePledge[]> {
  const q = query(collection(db, COLLECTION), orderBy('created_at', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as BankRePledge));
}

/**
 * Fetch a single Bank Re-Pledge by ID.
 */
export async function getBankRePledgeById(id: string): Promise<BankRePledge | null> {
  const docRef = doc(db, COLLECTION, id);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as BankRePledge;
}

/**
 * Fetch all Bank Re-Pledges associated with a given loan ID or loan number.
 */
export async function getBankRePledgesByLoan(loanIdOrNumber: string): Promise<BankRePledge[]> {
  if (!loanIdOrNumber) return [];
  try {
    // 1. Try by loan_id
    const q1 = query(collection(db, COLLECTION), where('loan_id', '==', loanIdOrNumber));
    const snap1 = await getDocs(q1);
    let items = snap1.docs.map((d) => ({ id: d.id, ...d.data() } as BankRePledge));

    // 2. If empty, try by loan_number
    if (items.length === 0) {
      const q2 = query(collection(db, COLLECTION), where('loan_number', '==', loanIdOrNumber));
      const snap2 = await getDocs(q2);
      items = snap2.docs.map((d) => ({ id: d.id, ...d.data() } as BankRePledge));
    }

    items.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    return items;
  } catch (err) {
    console.warn('Error fetching re-pledges by loan:', err);
    return [];
  }
}

/**
 * Fetch the currently active Bank Re-Pledge for a loan (Active, Pledged with Bank, or Pending Approval).
 */
export async function getActiveBankRePledgeByLoan(loanIdOrNumber: string): Promise<BankRePledge | null> {
  const pledges = await getBankRePledgesByLoan(loanIdOrNumber);
  const active = pledges.find(
    (p) => p.status === 'Active' || p.status === 'Pledged with Bank' || p.status === 'Pending Approval'
  );
  return active || (pledges.length > 0 ? pledges[0] : null);
}

/**
 * Compute real-time dashboard KPIs across all Bank Re-Pledges.
 */
export function calculateRePledgeMetrics(items: BankRePledge[]) {
  const totalPledges = items.length;
  const activePledges = items.filter((p) => p.status === 'Active' || p.status === 'Pledged with Bank');
  const pendingApprovals = items.filter((p) => p.status === 'Pending Approval');
  const releasedPledges = items.filter((p) => p.status === 'Released' || p.status === 'Closed');

  const totalAmountPledged = items.reduce((acc, curr) => acc + (curr.bank_pledge_amount || 0), 0);
  const activeAmountPledged = activePledges.reduce((acc, curr) => acc + (curr.bank_outstanding || curr.bank_pledge_amount || 0), 0);
  const totalInterestPaid = items.reduce((acc, curr) => acc + (curr.interest_paid || 0), 0);

  const goldWithBanks = activePledges.reduce((acc, curr) => acc + (curr.total_net_weight || 0), 0);
  const goldReturnedToSafe = releasedPledges.reduce((acc, curr) => acc + (curr.total_net_weight || 0), 0);

  const now = new Date();
  const upcomingDueDates = activePledges.filter((p) => {
    if (!p.due_date) return false;
    const due = new Date(p.due_date);
    const diffDays = (due.getTime() - now.getTime()) / (1000 * 3600 * 24);
    return diffDays >= 0 && diffDays <= 30;
  });

  const overduePledges = activePledges.filter((p) => {
    if (!p.due_date) return false;
    const due = new Date(p.due_date);
    return due.getTime() < now.getTime();
  });

  return {
    totalPledges,
    activePledgesCount: activePledges.length,
    pendingApprovalsCount: pendingApprovals.length,
    releasedPledgesCount: releasedPledges.length,
    totalAmountPledged,
    activeAmountPledged,
    totalInterestPaid,
    goldWithBanks,
    goldReturnedToSafe,
    upcomingDueCount: upcomingDueDates.length,
    overdueCount: overduePledges.length,
  };
}
