// src/lib/db/branches.ts
// Data access layer for multi-branch management backed by Cloud Firestore.

import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  runTransaction
} from 'firebase/firestore';
import type { Branch } from '@/types/database';

const COLLECTION = 'branches';

export interface BranchInsert {
  name: string;
  code: string;
  address?: string;
  city?: string;
  phone?: string;
  email?: string;
  manager?: string;
  is_active?: boolean;
}

export interface BranchUpdate {
  name?: string;
  code?: string;
  address?: string;
  city?: string;
  phone?: string;
  email?: string;
  manager?: string;
  is_active?: boolean;
}

/**
 * Generate a unique branch code atomically (e.g., MDU-01, MDU-02 or B-01).
 */
export async function generateBranchCode(prefix: string = 'BR'): Promise<string> {
  const cleanPrefix = (prefix || 'BR').toUpperCase().slice(0, 4);
  const counterRef = doc(db, 'counters', `branch_${cleanPrefix}`);
  
  try {
    const next = await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(counterRef);
      const current = snap.exists() ? (snap.data().value || 0) : 0;
      const nextVal = current + 1;
      transaction.set(counterRef, { value: nextVal }, { merge: true });
      return nextVal;
    });
    return `${cleanPrefix}-${String(next).padStart(2, '0')}`;
  } catch {
    return `${cleanPrefix}-${Math.floor(10 + Math.random() * 90)}`;
  }
}

/**
 * Create a new branch.
 */
export async function createBranch(data: BranchInsert): Promise<Branch & { manager?: string; city?: string }> {
  if (!data.name || !data.name.trim()) {
    throw new Error('Branch name is required.');
  }

  let code = (data.code || '').trim().toUpperCase();
  if (!code) {
    const prefix = data.city ? data.city.slice(0, 3) : data.name.slice(0, 3);
    code = await generateBranchCode(prefix);
  }

  const now = new Date().toISOString();
  const branchData = {
    name: data.name.trim(),
    code,
    address: data.address?.trim() || '',
    city: data.city?.trim() || '',
    phone: data.phone?.trim() || '',
    email: data.email?.trim() || '',
    manager: data.manager?.trim() || 'Branch Manager',
    is_active: data.is_active !== false,
    created_at: now,
    updated_at: now,
  };

  const docRef = await addDoc(collection(db, COLLECTION), branchData);
  return { id: docRef.id, ...branchData } as unknown as Branch;
}

/**
 * List all branches with safe error handling and in-memory sorting.
 */
export async function listBranches(activeOnly: boolean = false): Promise<Array<Branch & { manager?: string; city?: string; email?: string }>> {
  try {
    const q = activeOnly
      ? query(collection(db, COLLECTION), where('is_active', '==', true))
      : collection(db, COLLECTION);

    const snapshot = await getDocs(q);
    const branches = snapshot.docs.map(d => ({
      id: d.id,
      ...d.data()
    })) as Array<Branch & { manager?: string; city?: string; email?: string }>;

    branches.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    return branches;
  } catch (err) {
    console.error('Error fetching branches:', err);
    return [];
  }
}

/**
 * Get branch by document ID.
 */
export async function getBranchById(id: string): Promise<(Branch & { manager?: string; city?: string; email?: string }) | null> {
  try {
    const snap = await getDoc(doc(db, COLLECTION, id));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() } as any;
  } catch (err) {
    console.error('Error fetching branch by ID:', err);
    return null;
  }
}

/**
 * Update branch details.
 */
export async function updateBranch(id: string, data: BranchUpdate): Promise<void> {
  const branchRef = doc(db, COLLECTION, id);
  const now = new Date().toISOString();
  await updateDoc(branchRef, {
    ...data,
    updated_at: now
  });
}

/**
 * Delete a branch.
 */
export async function deleteBranch(id: string): Promise<void> {
  const branchRef = doc(db, COLLECTION, id);
  await deleteDoc(branchRef);
}
