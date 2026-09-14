// src/lib/db/approvals.ts
// Data access layer for approval requests (Manager/Admin review workflow) backed by Cloud Firestore.

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
  onSnapshot
} from 'firebase/firestore';
import type { ApprovalRequest, ApprovalRequestInsert, ApprovalStatus, Profile } from '@/types/database';
import { auditCreate } from '@/lib/db/audit';
import { createNotification } from '@/lib/db/notifications';

const COLLECTION = 'approval_requests';

/**
 * Submit an approval request (Employee/Staff -> Manager/Admin)
 */
export async function createApprovalRequest(data: ApprovalRequestInsert): Promise<ApprovalRequest> {
  const now = new Date().toISOString();
  const payload = {
    ...data,
    status: 'Pending' as ApprovalStatus,
    requested_at: now,
    reviewed_by: null,
    reviewed_by_name: null,
    reviewed_at: null,
    review_notes: null,
  };

  const docRef = await addDoc(collection(db, COLLECTION), payload);
  const created = { id: docRef.id, ...payload } as ApprovalRequest;

  // Create audit trail
  try {
    await auditCreate(data.requested_by, 'approval_requests', docRef.id, {
      action: 'Approval Request Created',
      request_type: data.request_type,
      entity_type: data.entity_type,
      entity_id: data.entity_id,
      details: data.details,
    });
  } catch (err) {
    console.warn('Audit error creating approval request:', err);
  }

  // Notify Admins & Managers
  try {
    await createNotification({
      recipient_id: 'admin_broadcast',
      type: 'System',
      title: `Approval Required: ${data.request_type.replace(/_/g, ' ')}`,
      message: `${data.requested_by_name} has submitted a ${data.request_type.replace(/_/g, ' ')} request for verification.`,
      related_entity_type: 'approval_requests',
      related_entity_id: docRef.id,
    });
  } catch (err) {
    console.warn('Notification error on approval request:', err);
  }

  return created;
}

/**
 * Fetch all pending approval requests
 */
export async function getPendingApprovals(): Promise<ApprovalRequest[]> {
  try {
    const q = query(
      collection(db, COLLECTION),
      where('status', '==', 'Pending')
    );
    const snap = await getDocs(q);
    const list: ApprovalRequest[] = [];
    snap.forEach((d) => {
      list.push({ id: d.id, ...d.data() } as ApprovalRequest);
    });
    list.sort((a, b) => (b.requested_at || '').localeCompare(a.requested_at || ''));
    return list;
  } catch (err) {
    console.error('Error fetching pending approvals:', err);
    return [];
  }
}

/**
 * Review an approval request (Approve or Reject)
 */
export async function reviewApprovalRequest(
  requestId: string,
  decision: 'Approved' | 'Rejected',
  reviewNotes: string,
  reviewer: Profile
): Promise<ApprovalRequest> {
  const reqRef = doc(db, COLLECTION, requestId);
  const reqSnap = await getDoc(reqRef);
  if (!reqSnap.exists()) {
    throw new Error('Approval request not found.');
  }

  const reqData = reqSnap.data() as ApprovalRequest;
  if (reqData.status !== 'Pending') {
    throw new Error(`This request has already been ${reqData.status}.`);
  }

  // Ensure employees cannot approve their own submission
  if (reqData.requested_by === reviewer.id && reviewer.role !== 'Admin') {
    throw new Error('Employees cannot approve their own submissions.');
  }

  const now = new Date().toISOString();
  const updatePayload = {
    status: decision,
    reviewed_by: reviewer.id,
    reviewed_by_name: reviewer.name,
    reviewed_at: now,
    review_notes: reviewNotes || (decision === 'Approved' ? 'Approved as verified' : 'Rejected after review'),
  };

  await updateDoc(reqRef, updatePayload);

  // If this was a Loan Approval or High LTV Approval, transition the loan status!
  if (reqData.request_type === 'Loan_Approval' || reqData.request_type === 'High_LTV_Approval') {
    const loanRef = doc(db, 'loans', reqData.entity_id);
    const loanSnap = await getDoc(loanRef);
    if (loanSnap.exists()) {
      if (decision === 'Approved') {
        const principal = loanSnap.data().principal_amount;
        await updateDoc(loanRef, {
          status: 'Active',
          disbursed_amount: principal,
          updated_at: now,
          notes: `Approved by ${reviewer.name} (${reviewer.role}) on ${new Date().toLocaleDateString('en-IN')}`,
        });
      } else {
        await updateDoc(loanRef, {
          status: 'Rejected',
          cancelled_at: now,
          cancelled_reason: reviewNotes || 'Loan rejected by reviewing authority',
          updated_at: now,
        });
      }
    }
  }

  // Create audit trail for review decision
  try {
    await auditCreate(reviewer.id, 'approval_requests', requestId, {
      decision,
      reviewer_name: reviewer.name,
      reviewer_role: reviewer.role,
      review_notes: reviewNotes,
      request_type: reqData.request_type,
      entity_id: reqData.entity_id,
    });
  } catch (err) {
    console.warn('Audit error on review:', err);
  }

  // Notify requester of decision
  try {
    await createNotification({
      recipient_id: reqData.requested_by,
      type: 'System',
      title: `Request ${decision}: ${reqData.request_type.replace(/_/g, ' ')}`,
      message: `Your request has been ${decision.toLowerCase()} by ${reviewer.name}. Notes: ${reviewNotes || 'None'}`,
      related_entity_type: 'approval_requests',
      related_entity_id: requestId,
    });
  } catch (err) {
    console.warn('Notification error on review decision:', err);
  }

  return { ...reqData, ...updatePayload, id: requestId } as ApprovalRequest;
}
