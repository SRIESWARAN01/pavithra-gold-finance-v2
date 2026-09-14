// src/lib/db/profiles.ts
// Data access layer for customer profiles — CRUD, search, and enterprise actions backed by Cloud Firestore.

import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  getCountFromServer,
  Timestamp,
  runTransaction,
} from 'firebase/firestore';
import type { Profile, ProfileInsert, ProfileUpdate, KycStatus } from '@/types/database';

const COLLECTION = 'profiles';

// ============================================================================
// Customer ID Generation — Dual Format (Atomic Transactions)
// ============================================================================

/**
 * Generate a customer number in one of two formats:
 * - PGF-CUST-000001  (global sequence, when no branch assigned)
 * - PGF-MDU-000001   (branch-prefixed, when branchCode is provided)
 *
 * Uses Firestore transactions to guarantee uniqueness under concurrency.
 */
async function generateCustomerNumber(branchCode?: string): Promise<string> {
  if (branchCode) {
    // Branch-prefixed: PGF-{BRANCH}-{SEQ}
    const counterKey = `customer_number_${branchCode.toUpperCase()}`;
    const counterRef = doc(db, 'counters', counterKey);
    const next = await runTransaction(db, async (transaction) => {
      const counterSnap = await transaction.get(counterRef);
      const current = counterSnap.exists() ? (counterSnap.data().value || 0) : 0;
      const nextVal = current + 1;
      transaction.set(counterRef, { value: nextVal }, { merge: true });
      return nextVal;
    });
    return `PGF-${branchCode.toUpperCase()}-${String(next).padStart(6, '0')}`;
  }

  // Global: PGF-CUST-{SEQ}
  const counterRef = doc(db, 'counters', 'customer_number');
  const next = await runTransaction(db, async (transaction) => {
    const counterSnap = await transaction.get(counterRef);
    const current = counterSnap.exists() ? (counterSnap.data().value || 0) : 0;
    const nextVal = current + 1;
    transaction.set(counterRef, { value: nextVal }, { merge: true });
    return nextVal;
  });
  return `PGF-CUST-${String(next).padStart(6, '0')}`;
}

// ============================================================================
// 3-Field Duplicate Customer Detection
// ============================================================================

export interface DuplicateCheckResult {
  hasDuplicate: boolean;
  matches: {
    field: 'phone' | 'aadhaar' | 'pan';
    existingCustomerId: string;
    existingCustomerName: string;
    existingCustomerNumber: string | null;
    matchedValue: string;
  }[];
}

/**
 * Check for duplicate customers across 3 fields: Phone, Aadhaar, PAN.
 * Returns all matching profiles with the field that matched.
 * Excludes the optionally provided excludeId (useful during edits).
 */
export async function checkDuplicateCustomer(
  phone: string,
  aadhaar: string,
  pan?: string,
  excludeId?: string
): Promise<DuplicateCheckResult> {
  const matches: DuplicateCheckResult['matches'] = [];
  const cleanPhone = phone.replace('+91', '').trim();

  // 1. Check phone
  if (cleanPhone) {
    const phoneQ = query(
      collection(db, COLLECTION),
      where('phone_primary', '==', cleanPhone),
      limit(5)
    );
    const phoneSnap = await getDocs(phoneQ);
    phoneSnap.docs.forEach((d) => {
      if (excludeId && d.id === excludeId) return;
      const data = d.data();
      matches.push({
        field: 'phone',
        existingCustomerId: d.id,
        existingCustomerName: data.name || 'Unknown',
        existingCustomerNumber: data.customer_number || null,
        matchedValue: cleanPhone,
      });
    });
  }

  // 2. Check Aadhaar
  if (aadhaar && aadhaar.length >= 10) {
    const aadhaarQ = query(
      collection(db, COLLECTION),
      where('national_id', '==', aadhaar),
      limit(5)
    );
    const aadhaarSnap = await getDocs(aadhaarQ);
    aadhaarSnap.docs.forEach((d) => {
      if (excludeId && d.id === excludeId) return;
      // Avoid double-counting if same profile matched on phone
      if (matches.some((m) => m.existingCustomerId === d.id)) return;
      const data = d.data();
      matches.push({
        field: 'aadhaar',
        existingCustomerId: d.id,
        existingCustomerName: data.name || 'Unknown',
        existingCustomerNumber: data.customer_number || null,
        matchedValue: aadhaar,
      });
    });
  }

  // 3. Check PAN
  if (pan && pan.length === 10) {
    const panQ = query(
      collection(db, COLLECTION),
      where('pan_number', '==', pan.toUpperCase()),
      limit(5)
    );
    const panSnap = await getDocs(panQ);
    panSnap.docs.forEach((d) => {
      if (excludeId && d.id === excludeId) return;
      if (matches.some((m) => m.existingCustomerId === d.id)) return;
      const data = d.data();
      matches.push({
        field: 'pan',
        existingCustomerId: d.id,
        existingCustomerName: data.name || 'Unknown',
        existingCustomerNumber: data.customer_number || null,
        matchedValue: pan.toUpperCase(),
      });
    });
  }

  return { hasDuplicate: matches.length > 0, matches };
}

// ============================================================================
// Core CRUD Operations
// ============================================================================

/**
 * Recursively sanitize an object to remove `undefined` values,
 * converting them to `null` so Firebase Firestore setDoc/updateDoc never fails.
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
 * Create a new customer profile.
 * Supports dual Customer ID format (global or branch-prefixed).
 * The profile document ID must match the Firebase Auth user UID.
 */
export async function createProfile(data: ProfileInsert, branchCode?: string): Promise<Profile> {
  // Auto-generate customer number if not provided
  if (!data.customer_number) {
    data.customer_number = await generateCustomerNumber(branchCode);
  }

  const now = new Date().toISOString();
  const rawProfileData = {
    ...data,
    email: data.email || null,
    phone_alt: data.phone_alt || null,
    date_of_birth: data.date_of_birth || null,
    gender: data.gender || null,
    marital_status: data.marital_status || null,
    pan_number: data.pan_number || null,
    city: data.city || null,
    district: data.district || null,
    state: data.state || 'Tamil Nadu',
    pin_code: data.pin_code || null,
    occupation: data.occupation || null,
    monthly_income: data.monthly_income || null,
    reference_person: data.reference_person || null,
    reference_phone: data.reference_phone || null,
    branch_id: data.branch_id || null,
    photo_url: data.photo_url || null,
    signature_url: data.signature_url || null,
    aadhaar_front_url: data.aadhaar_front_url || null,
    aadhaar_back_url: data.aadhaar_back_url || null,
    pan_url: data.pan_url || null,
    is_2fa_enabled: data.is_2fa_enabled || false,
    two_factor_secret: data.two_factor_secret || null,
    nominee_name: data.nominee_name || null,
    nominee_relation: data.nominee_relation || null,
    nominee_mobile: data.nominee_mobile || null,
    face_match_score: data.face_match_score || null,
    kyc_expiry_date: data.kyc_expiry_date || null,
    kyc_status: data.kyc_status || 'Pending',
    kyc_approved_by: null,
    kyc_approved_at: null,
    kyc_rejection_reason: null,
    voter_id_url: data.voter_id_url || null,
    driving_license_url: data.driving_license_url || null,
    passport_url: data.passport_url || null,
    tags: data.tags || [],
    blocked_at: null,
    blocked_reason: null,
    deleted_at: null,
    status: 'Active',
    created_at: now,
    updated_at: now,
  };

  const profileData = cleanFirestorePayload(rawProfileData);

  await setDoc(doc(db, COLLECTION, data.id), profileData);
  return { ...profileData } as unknown as Profile;
}

/**
 * Fetch a single profile by UUID.
 */
export async function getProfile(id: string): Promise<Profile | null> {
  const profileRef = doc(db, COLLECTION, id);
  const profileSnap = await getDoc(profileRef);

  if (!profileSnap.exists()) return null;
  return { id: profileSnap.id, ...profileSnap.data() } as Profile;
}

/**
 * Fetch a profile by phone number.
 */
export async function getProfileByPhone(phone: string): Promise<Profile | null> {
  const cleanedPhone = phone.replace('+91', '').trim();

  // Try exact match first
  const q = query(
    collection(db, COLLECTION),
    where('phone_primary', '==', cleanedPhone),
    limit(1)
  );
  const snapshot = await getDocs(q);

  if (!snapshot.empty) {
    const docSnap = snapshot.docs[0];
    return { id: docSnap.id, ...docSnap.data() } as Profile;
  }

  // Try with +91 prefix
  const q2 = query(
    collection(db, COLLECTION),
    where('phone_primary', '==', `+91${cleanedPhone}`),
    limit(1)
  );
  const snapshot2 = await getDocs(q2);

  if (!snapshot2.empty) {
    const docSnap = snapshot2.docs[0];
    return { id: docSnap.id, ...docSnap.data() } as Profile;
  }

  return null;
}

/**
 * Update an existing profile.
 */
export async function updateProfile(id: string, data: ProfileUpdate): Promise<Profile> {
  const profileRef = doc(db, COLLECTION, id);
  const updateData = cleanFirestorePayload({ ...data, updated_at: new Date().toISOString() });
  await updateDoc(profileRef, updateData);

  const updated = await getDoc(profileRef);
  return { id: updated.id, ...updated.data() } as Profile;
}

/**
 * List all customer profiles (Admin view).
 * Supports pagination, status/role/branch/KYC filtering.
 */
export async function listProfiles(options?: {
  page?: number;
  pageSize?: number;
  status?: string;
  role?: 'Admin' | 'Customer';
  branchId?: string;
  kycStatus?: KycStatus;
  searchQuery?: string;
  sortField?: 'name' | 'created_at' | 'status';
  sortDirection?: 'asc' | 'desc';
}): Promise<{ profiles: Profile[]; count: number }> {
  const constraints: any[] = [];

  if (options?.status) {
    constraints.push(where('status', '==', options.status));
  }
  if (options?.role) {
    constraints.push(where('role', '==', options.role));
  }
  if (options?.branchId) {
    constraints.push(where('branch_id', '==', options.branchId));
  }
  if (options?.kycStatus) {
    constraints.push(where('kyc_status', '==', options.kycStatus));
  }

  // Query without composite orderBy constraints
  try {
    const q = constraints.length > 0
      ? query(collection(db, COLLECTION), ...constraints)
      : query(collection(db, COLLECTION));

    const snapshot = await getDocs(q);

    let allProfiles = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Profile));

    // Client-side search filtering (Firestore doesn't support ILIKE)
    if (options?.searchQuery) {
      const term = options.searchQuery.trim().toLowerCase();
      allProfiles = allProfiles.filter((p) =>
        p.name?.toLowerCase().includes(term) ||
        p.phone_primary?.includes(term) ||
        p.national_id?.includes(term) ||
        p.customer_number?.toLowerCase().includes(term) ||
        p.email?.toLowerCase().includes(term)
      );
    }

    // Exclude soft-deleted profiles by default
    allProfiles = allProfiles.filter((p) => !p.deleted_at);

    // In-memory sort
    const sortField = options?.sortField || 'created_at';
    const isAsc = options?.sortDirection === 'asc';
    allProfiles.sort((a: any, b: any) => {
      const valA = a[sortField] || '';
      const valB = b[sortField] || '';
      if (valA < valB) return isAsc ? -1 : 1;
      if (valA > valB) return isAsc ? 1 : -1;
      return 0;
    });

    // Client-side pagination
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 50;
    const start = (page - 1) * pageSize;
    const paginated = allProfiles.slice(start, start + pageSize);

    return { profiles: paginated, count: allProfiles.length };
  } catch (err) {
    console.error('Error listing profiles:', err);
    return { profiles: [], count: 0 };
  }
}

/**
 * Search profiles by name, phone, Aadhaar, or customer number.
 * Firestore doesn't support ILIKE, so we fetch and filter client-side.
 */
export async function searchProfiles(searchQuery: string): Promise<Profile[]> {
  const term = searchQuery.trim().toLowerCase();
  if (!term) return [];
  const q = query(collection(db, COLLECTION), limit(200));
  const snapshot = await getDocs(q);

  const results = snapshot.docs
    .map((d) => ({ id: d.id, ...d.data() } as Profile))
    .filter((p) => {
      const name = (p.name || '').toLowerCase();
      const phone = p.phone_primary || '';
      const nid = p.national_id || '';
      const cnum = (p.customer_number || '').toLowerCase();
      const email = (p.email || '').toLowerCase();
      return (
        name.includes(term) ||
        phone.includes(term) ||
        nid.includes(term) ||
        cnum.includes(term) ||
        email.includes(term)
      );
    })
    .filter((p) => !p.deleted_at);

  results.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  return results.slice(0, 20);
}

// ============================================================================
// Customer Lifecycle Actions
// ============================================================================

/**
 * Activate a customer profile.
 */
export async function activateProfile(id: string): Promise<void> {
  const profileRef = doc(db, COLLECTION, id);
  await updateDoc(profileRef, {
    status: 'Active',
    blocked_at: null,
    blocked_reason: null,
    updated_at: new Date().toISOString(),
  });
}

/**
 * Deactivate a customer profile (soft status change).
 */
export async function deactivateProfile(id: string): Promise<void> {
  const profileRef = doc(db, COLLECTION, id);
  await updateDoc(profileRef, { status: 'Inactive', updated_at: new Date().toISOString() });
}

/**
 * Block a customer with a reason.
 */
export async function blockCustomer(id: string, reason: string): Promise<void> {
  const now = new Date().toISOString();
  const profileRef = doc(db, COLLECTION, id);
  await updateDoc(profileRef, {
    status: 'Blocked',
    blocked_at: now,
    blocked_reason: reason,
    updated_at: now,
  });
}

/**
 * Unblock a previously blocked customer.
 */
export async function unblockCustomer(id: string): Promise<void> {
  const profileRef = doc(db, COLLECTION, id);
  await updateDoc(profileRef, {
    status: 'Active',
    blocked_at: null,
    blocked_reason: null,
    updated_at: new Date().toISOString(),
  });
}

/**
 * Soft-delete a customer profile (sets deleted_at timestamp).
 * The profile remains in Firestore but is excluded from listings.
 */
export async function softDeleteProfile(id: string): Promise<void> {
  const now = new Date().toISOString();
  const profileRef = doc(db, COLLECTION, id);
  await updateDoc(profileRef, {
    status: 'Deleted',
    deleted_at: now,
    updated_at: now,
  });
}

/**
 * Transfer a customer to a different branch.
 * Returns the old and new branch IDs for audit logging.
 */
export async function transferCustomerBranch(
  id: string,
  newBranchId: string
): Promise<{ oldBranchId: string | null; newBranchId: string }> {
  const profile = await getProfile(id);
  const oldBranchId = profile?.branch_id || null;

  const profileRef = doc(db, COLLECTION, id);
  await updateDoc(profileRef, {
    branch_id: newBranchId,
    updated_at: new Date().toISOString(),
  });

  return { oldBranchId, newBranchId };
}

// ============================================================================
// KYC Approval Workflow
// ============================================================================

/**
 * Submit KYC for review (sets status to Submitted).
 * Called after Appraiser uploads all KYC documents.
 */
export async function submitKycForReview(id: string): Promise<void> {
  const profileRef = doc(db, COLLECTION, id);
  await updateDoc(profileRef, {
    kyc_status: 'Submitted',
    updated_at: new Date().toISOString(),
  });
}

/**
 * Mark KYC as under review (Manager has started reviewing).
 */
export async function markKycUnderReview(id: string): Promise<void> {
  const profileRef = doc(db, COLLECTION, id);
  await updateDoc(profileRef, {
    kyc_status: 'Under_Review',
    updated_at: new Date().toISOString(),
  });
}

/**
 * Approve KYC — Manager approves the customer's KYC documents.
 * Sets kyc_status to 'Approved', records who approved and when.
 */
export async function approveKyc(
  customerId: string,
  approvedByUserId: string
): Promise<void> {
  const now = new Date().toISOString();
  const profileRef = doc(db, COLLECTION, customerId);
  await updateDoc(profileRef, {
    kyc_status: 'Approved',
    kyc_approved_by: approvedByUserId,
    kyc_approved_at: now,
    kyc_rejection_reason: null,
    updated_at: now,
  });
}

/**
 * Reject KYC — Manager rejects the customer's KYC with a reason.
 * Sets kyc_status to 'Rejected', records the rejection reason.
 */
export async function rejectKyc(
  customerId: string,
  rejectedByUserId: string,
  reason: string
): Promise<void> {
  const now = new Date().toISOString();
  const profileRef = doc(db, COLLECTION, customerId);
  await updateDoc(profileRef, {
    kyc_status: 'Rejected',
    kyc_approved_by: rejectedByUserId,
    kyc_approved_at: now,
    kyc_rejection_reason: reason,
    updated_at: now,
  });
}

// ============================================================================
// Counting & Metrics
// ============================================================================

/**
 * Count customer profiles (for dashboard metrics).
 */
export async function countProfiles(filters?: {
  role?: 'Admin' | 'Customer';
  status?: string;
  createdAfter?: string;
  branchId?: string;
}): Promise<number> {
  try {
    const constraints: any[] = [];

    if (filters?.role) constraints.push(where('role', '==', filters.role));
    if (filters?.status) constraints.push(where('status', '==', filters.status));
    if (filters?.createdAfter) constraints.push(where('created_at', '>=', filters.createdAfter));
    if (filters?.branchId) constraints.push(where('branch_id', '==', filters.branchId));

    const q = constraints.length > 0
      ? query(collection(db, COLLECTION), ...constraints)
      : query(collection(db, COLLECTION));

    const countResult = await getCountFromServer(q);
    return countResult.data().count;
  } catch (err) {
    console.warn('getCountFromServer failed, falling back to getDocs snapshot count:', err);
    try {
      const constraints: any[] = [];
      if (filters?.role) constraints.push(where('role', '==', filters.role));
      if (filters?.branchId) constraints.push(where('branch_id', '==', filters.branchId));
      const q = constraints.length > 0
        ? query(collection(db, COLLECTION), ...constraints)
        : query(collection(db, COLLECTION));
      const snap = await getDocs(q);
      let count = 0;
      for (const d of snap.docs) {
        const data = d.data();
        if (filters?.status && data.status !== filters.status) continue;
        if (filters?.createdAfter && (data.created_at || '') < filters.createdAfter) continue;
        count++;
      }
      return count;
    } catch (fallbackErr) {
      console.error('countProfiles fallback failed:', fallbackErr);
      return 0;
    }
  }
}
