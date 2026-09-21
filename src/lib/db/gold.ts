// src/lib/db/gold.ts
// Data access layer for gold collateral management — CRUD + appraisal records backed by Cloud Firestore.

import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  writeBatch,
} from 'firebase/firestore';
import type { GoldCollateral, GoldCollateralInsert, GoldPhoto } from '@/types/database';

const COLLECTION = 'gold_collateral';
const PHOTOS_COLLECTION = 'gold_photos';

/**
 * Recursively sanitize an object to remove `undefined` values,
 * converting them to `null` and ensuring no string exceeds Firestore 1MB limits.
 */
function cleanFirestorePayload<T extends Record<string, any>>(obj: T): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) {
      result[key] = null;
    } else if (typeof value === 'string' && value.length > 500000) {
      // Safety guard against oversized uncompressed base64 data URLs exceeding Firestore 1MB document limit
      console.warn(`[Firestore Safe] Field ${key} exceeded 500KB (${value.length} chars). Truncating payload.`);
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
 * Add a gold collateral item to a loan.
 */
export async function addGoldItem(data: GoldCollateralInsert): Promise<GoldCollateral> {
  const now = new Date().toISOString();
  const rawData = {
    ...data,
    front_photo_url: data.front_photo_url || null,
    back_photo_url: data.back_photo_url || null,
    side_photo_url: data.side_photo_url || null,
    stone_weight: data.stone_weight || 0,
    net_weight: (data.gross_weight || 0) - (data.stone_weight || 0),
    quantity: data.quantity || 1,
    hallmark: data.hallmark || false,
    storage_bin_id: data.storage_bin_id || 'BIN-DEFAULT',
    created_at: now,
  };

  const itemData = cleanFirestorePayload(rawData);
  const docRef = await addDoc(collection(db, COLLECTION), itemData);
  return { id: docRef.id, ...itemData } as unknown as GoldCollateral;
}

/**
 * Add multiple gold items in a batch (used during loan creation wizard).
 */
export async function addGoldItemsBatch(items: GoldCollateralInsert[]): Promise<GoldCollateral[]> {
  const batch = writeBatch(db);
  const results: GoldCollateral[] = [];
  const now = new Date().toISOString();

  for (const item of items) {
    const ref = doc(collection(db, COLLECTION));
    const rawData = {
      ...item,
      front_photo_url: item.front_photo_url || null,
      back_photo_url: item.back_photo_url || null,
      side_photo_url: item.side_photo_url || null,
      stone_weight: item.stone_weight || 0,
      net_weight: (item.gross_weight || 0) - (item.stone_weight || 0),
      quantity: item.quantity || 1,
      hallmark: item.hallmark || false,
      storage_bin_id: item.storage_bin_id || 'BIN-DEFAULT',
      created_at: now,
    };
    const itemData = cleanFirestorePayload(rawData);
    batch.set(ref, itemData);
    results.push({ id: ref.id, ...itemData } as unknown as GoldCollateral);
  }

  await batch.commit();
  return results;
}

/**
 * Get all gold items for a specific loan.
 */
export async function getGoldByLoan(loanId: string): Promise<GoldCollateral[]> {
  try {
    const q = query(
      collection(db, COLLECTION),
      where('loan_id', '==', loanId)
    );
    const snapshot = await getDocs(q);

    const items: GoldCollateral[] = [];
    for (const d of snapshot.docs) {
      const item: any = { id: d.id, ...d.data() };
      // Fetch photos for this collateral item
      try {
        const photosQ = query(collection(db, PHOTOS_COLLECTION), where('collateral_id', '==', d.id));
        const photosSnap = await getDocs(photosQ);
        item.photos = photosSnap.docs.map((p) => ({ id: p.id, ...p.data() }));
      } catch {
        item.photos = [];
      }
      items.push(item as GoldCollateral);
    }

    items.sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
    return items;
  } catch (err) {
    console.error('Error fetching gold by loan:', err);
    return [];
  }
}

/**
 * Get all gold items for a customer (across all their loans).
 */
export async function getGoldByCustomer(customerId: string): Promise<GoldCollateral[]> {
  try {
    const q = query(
      collection(db, COLLECTION),
      where('customer_id', '==', customerId)
    );
    const snapshot = await getDocs(q);

    const items: GoldCollateral[] = [];
    for (const d of snapshot.docs) {
      const item: any = { id: d.id, ...d.data() };
      try {
        const photosQ = query(collection(db, PHOTOS_COLLECTION), where('collateral_id', '==', d.id));
        const photosSnap = await getDocs(photosQ);
        item.photos = photosSnap.docs.map((p) => ({ id: p.id, ...p.data() }));
      } catch {
        item.photos = [];
      }
      items.push(item as GoldCollateral);
    }

    items.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    return items;
  } catch (err) {
    console.error('Error fetching gold by customer:', err);
    return [];
  }
}

/**
 * Update a gold collateral item.
 */
export async function updateGoldItem(
  id: string,
  data: Partial<GoldCollateralInsert>
): Promise<GoldCollateral> {
  const itemRef = doc(db, COLLECTION, id);

  // Recalculate net_weight if gross or stone weight changed
  const rawData: any = { ...data };
  if (data.gross_weight !== undefined || data.stone_weight !== undefined) {
    const snap = await getDoc(itemRef);
    const current = snap.data() || {};
    const grossWeight = data.gross_weight ?? current.gross_weight ?? 0;
    const stoneWeight = data.stone_weight ?? current.stone_weight ?? 0;
    rawData.net_weight = grossWeight - stoneWeight;
  }

  const updateData = cleanFirestorePayload(rawData);
  await updateDoc(itemRef, updateData);

  const updated = await getDoc(itemRef);
  return { id: updated.id, ...updated.data() } as unknown as GoldCollateral;
}

/**
 * Delete a gold collateral item (only if loan is in Draft status).
 */
export async function deleteGoldItem(id: string): Promise<void> {
  // Also delete associated photos
  const photosQ = query(collection(db, PHOTOS_COLLECTION), where('collateral_id', '==', id));
  const photosSnap = await getDocs(photosQ);

  const batch = writeBatch(db);
  for (const photoDoc of photosSnap.docs) {
    batch.delete(photoDoc.ref);
  }
  batch.delete(doc(db, COLLECTION, id));
  await batch.commit();
}

/**
 * Add a photo record for a gold collateral item.
 */
export async function addGoldPhoto(collateralId: string, photoUrl: string): Promise<GoldPhoto> {
  const now = new Date().toISOString();
  const photoData = {
    collateral_id: collateralId,
    photo_url: photoUrl,
    created_at: now,
  };

  const docRef = await addDoc(collection(db, PHOTOS_COLLECTION), photoData);
  return { id: docRef.id, ...photoData } as GoldPhoto;
}

/**
 * Aggregate gold statistics for the admin dashboard.
 */
export async function getGoldStats(): Promise<{
  totalWeight: number;
  totalValue: number;
  itemCount: number;
}> {
  const q = query(collection(db, COLLECTION));
  const snapshot = await getDocs(q);

  let totalWeight = 0;
  let totalValue = 0;

  for (const d of snapshot.docs) {
    const item = d.data();
    totalWeight += item.net_weight || 0;
    totalValue += item.valuation_inr || 0;
  }

  return { totalWeight, totalValue, itemCount: snapshot.size };
}

/**
 * Calculate gold valuation for a given weight, purity, and rate.
 * Pure utility function — no DB calls.
 */
export function calculateGoldValuation(
  netWeight: number,
  purity: '18K' | '21K' | '22K' | '24K',
  ratePerGram: number,
  ltvPercentage: number = 75
): { marketValue: number; maxEligibleLoan: number } {
  // Purity factors: 24K = 100%, 22K = 91.67%, 21K = 87.5%, 18K = 75%
  const purityFactor: Record<string, number> = {
    '24K': 1.0,
    '22K': 0.9167,
    '21K': 0.875,
    '18K': 0.75,
  };

  const factor = purityFactor[purity] ?? 0.9167;
  const marketValue = netWeight * ratePerGram * factor;
  const maxEligibleLoan = marketValue * (ltvPercentage / 100);

  return {
    marketValue: Math.round(marketValue * 100) / 100,
    maxEligibleLoan: Math.round(maxEligibleLoan * 100) / 100,
  };
}
