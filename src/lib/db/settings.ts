// src/lib/db/settings.ts
// Data access layer for application settings — key-value configuration store backed by Cloud Firestore.

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
} from 'firebase/firestore';
import type { Setting, SettingsCategory } from '@/types/database';

const COLLECTION = 'settings';

/**
 * Get a single setting value by key.
 * Returns the value string, or the defaultValue if not found.
 */
export async function getSetting(key: string, defaultValue?: string): Promise<string> {
  const settingRef = doc(db, COLLECTION, key);
  const settingSnap = await getDoc(settingRef);

  if (!settingSnap.exists()) return defaultValue ?? '';
  return settingSnap.data().value ?? defaultValue ?? '';
}

/**
 * Get a numeric setting value.
 */
export async function getNumericSetting(key: string, defaultValue: number = 0): Promise<number> {
  const value = await getSetting(key, String(defaultValue));
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Get all settings, optionally filtered by category.
 */
export async function getAllSettings(category?: SettingsCategory): Promise<Setting[]> {
  try {
    const constraints: any[] = [];

    if (category) {
      constraints.push(where('category', '==', category));
    }

    const q = constraints.length > 0
      ? query(collection(db, COLLECTION), ...constraints)
      : query(collection(db, COLLECTION));

    const snapshot = await getDocs(q);
    const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as unknown as Setting));
    list.sort((a, b) => (a.category || '').localeCompare(b.category || ''));
    return list;
  } catch (err) {
    console.error('Error fetching settings:', err);
    return [];
  }
}

/**
 * Update a single setting by key.
 */
export async function updateSetting(
  key: string,
  value: string,
  updatedBy?: string
): Promise<Setting> {
  const settingRef = doc(db, COLLECTION, key);
  const now = new Date().toISOString();
  const updateData: Record<string, unknown> = { value, updated_at: now };
  if (updatedBy) updateData.updated_by = updatedBy;

  // Use setDoc with merge to create if not exists
  await setDoc(settingRef, updateData, { merge: true });

  const updated = await getDoc(settingRef);
  return { id: updated.id, key, ...updated.data() } as unknown as Setting;
}

/**
 * Batch update multiple settings at once.
 */
export async function updateSettingsBatch(
  updates: Array<{ key: string; value: string }>,
  updatedBy?: string
): Promise<void> {
  for (const { key, value } of updates) {
    await updateSetting(key, value, updatedBy);
  }
}

/**
 * Get commonly-used settings as a typed object (for convenience).
 */
export async function getAppConfig(): Promise<{
  companyName: string;
  companyLogo: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  companyGst: string;
  companyPan: string;
  companyCin: string;
  companyWebsite: string;
  companyBranchName: string;
  companyBranchCode: string;
  companyDescription: string;
  companyBankDetails: string;
  companyUpiId: string;
  companyAuthorizedSignatory: string;
  companySealUrl: string;
  defaultInterestRate: number;
  maxLoanPeriod: number;
  ltvPercentage: number;
  currentGoldRate: number;
  purityOptions: string[];
  smsEnabled: boolean;
  whatsappEnabled: boolean;
  pushEnabled: boolean;
  loanNumberPrefix: string;
  receiptNumberPrefix: string;
  customerNumberPrefix: string;
}> {
  const settings = await getAllSettings();
  const map = new Map(settings.map(s => [s.key, s.value]));

  return {
    companyName: map.get('company_name') || 'Pavithra Gold Finance',
    companyLogo: map.get('company_logo') || '',
    companyAddress: map.get('company_address') || '45, Temple Street, Madurai',
    companyPhone: map.get('company_phone') || '9998887776',
    companyEmail: map.get('company_email') || 'contact@pavithragold.com',
    companyGst: map.get('company_gst') || '',
    companyPan: map.get('company_pan') || '',
    companyCin: map.get('company_cin') || '',
    companyWebsite: map.get('company_website') || 'www.pavithragold.com',
    companyBranchName: map.get('company_branch_name') || 'Madurai Main',
    companyBranchCode: map.get('company_branch_code') || 'MDU-01',
    companyDescription: map.get('company_description') || 'Premium Luxury Gold Finance Services',
    companyBankDetails: map.get('company_bank_details') || 'Axis Bank - A/C: 912010023849501 - IFSC: UTIB0000084',
    companyUpiId: map.get('company_upi_id') || 'pavithragold@upi',
    companyAuthorizedSignatory: map.get('company_authorized_signatory') || 'Manager, Pavithra Gold Finance',
    companySealUrl: map.get('company_seal_url') || '',
    defaultInterestRate: parseFloat(map.get('default_interest_rate') || '12'),
    maxLoanPeriod: parseInt(map.get('max_loan_period_months') || '12'),
    ltvPercentage: parseInt(map.get('ltv_percentage') || '100'),
    currentGoldRate: parseFloat(map.get('current_gold_rate') || '5400'),
    purityOptions: (map.get('purity_options') || '18K,22K,24K').split(','),
    smsEnabled: map.get('sms_enabled') === 'true',
    whatsappEnabled: map.get('whatsapp_enabled') === 'true',
    pushEnabled: map.get('push_enabled') === 'true',
    loanNumberPrefix: map.get('loan_number_prefix') || 'PGF-LN',
    receiptNumberPrefix: map.get('receipt_number_prefix') || 'PGF-REC',
    customerNumberPrefix: map.get('customer_number_prefix') || 'PGF-CUST',
  };
}
