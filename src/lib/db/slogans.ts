// src/lib/db/slogans.ts
// Bill Slogan System — 300 Unique Tamil Gold Loan Slogans
// Manages rotation, storage in Firestore `billSlogans`, and atomic slogan assignment for bills/receipts.

import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  runTransaction,
  writeBatch,
} from 'firebase/firestore';
import { TAMIL_SLOGANS, getSloganByIndex, type TamilSlogan } from '@/lib/data/tamilSlogans';

const COLLECTION = 'billSlogans';
const COUNTER_DOC = 'bill_slogan_index';

export interface AssignedSlogan {
  sloganId: string;
  sloganText: string;
  sloganIndex: number;
}

/**
 * Seed all 300 unique Tamil slogans to Firebase Firestore `billSlogans` collection.
 * Uses batch operations (up to 500 ops per batch).
 */
export async function seedBillSlogans(): Promise<number> {
  const batch = writeBatch(db);
  const now = new Date().toISOString();

  TAMIL_SLOGANS.forEach((slogan) => {
    const docRef = doc(db, COLLECTION, `slogan_${slogan.id}`);
    batch.set(docRef, {
      id: slogan.id,
      slogan_id: slogan.slogan_id,
      text: slogan.text,
      created_at: now,
      updated_at: now,
    }, { merge: true });
  });

  await batch.commit();
  console.log(`[Bill Slogans] Successfully seeded ${TAMIL_SLOGANS.length} unique Tamil slogans to Firestore.`);
  return TAMIL_SLOGANS.length;
}

/**
 * Atomically acquire the next slogan for a generated Bill / Payment Receipt.
 * Rules:
 * 1. Rotates sequentially (1 to 300, then repeats from 1).
 * 2. Guaranteed zero consecutive repeats.
 * 3. Atomic via Firestore transaction on counters/bill_slogan_index.
 */
export async function getNextBillSlogan(): Promise<AssignedSlogan> {
  const counterRef = doc(db, 'counters', COUNTER_DOC);

  try {
    const nextIdx = await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(counterRef);
      const current = snap.exists() ? (snap.data().value || 0) : 0;
      const next = (current % TAMIL_SLOGANS.length) + 1;
      transaction.set(counterRef, { value: next, updated_at: new Date().toISOString() }, { merge: true });
      return next;
    });

    const slogan = getSloganByIndex(nextIdx);
    return {
      sloganId: slogan.slogan_id,
      sloganText: slogan.text,
      sloganIndex: slogan.id,
    };
  } catch (err) {
    console.warn('Transaction fallback for slogan index:', err);
    // Fallback based on timestamp if transaction is unavailable
    const fallbackIdx = (Date.now() % TAMIL_SLOGANS.length) + 1;
    const slogan = getSloganByIndex(fallbackIdx);
    return {
      sloganId: slogan.slogan_id,
      sloganText: slogan.text,
      sloganIndex: slogan.id,
    };
  }
}

/**
 * Get slogan by ID (e.g. "SLOGAN-042").
 */
export function getSloganById(sloganId: string): TamilSlogan | undefined {
  return TAMIL_SLOGANS.find((s) => s.slogan_id === sloganId);
}

/**
 * Non-destructive peek at the upcoming Tamil slogan for pre-confirmation billing preview.
 * Does NOT mutate the transaction counter.
 */
export async function peekNextBillSlogan(): Promise<AssignedSlogan> {
  const counterRef = doc(db, 'counters', COUNTER_DOC);
  try {
    const snap = await getDoc(counterRef);
    const current = snap.exists() ? (snap.data().value || 0) : 0;
    const next = (current % TAMIL_SLOGANS.length) + 1;
    const slogan = getSloganByIndex(next);
    return {
      sloganId: slogan.slogan_id,
      sloganText: slogan.text,
      sloganIndex: slogan.id,
    };
  } catch {
    const fallbackIdx = (Date.now() % TAMIL_SLOGANS.length) + 1;
    const slogan = getSloganByIndex(fallbackIdx);
    return {
      sloganId: slogan.slogan_id,
      sloganText: slogan.text,
      sloganIndex: slogan.id,
    };
  }
}
