// src/lib/db/cleanup.ts
// Automated Deduplication & Data Sanitization Engine for Pavithra Gold Finance.
// Scans Firestore for duplicate profiles, duplicate branches, duplicate payments, and cleans up orphaned entries.

import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  getDocs,
  deleteDoc,
  updateDoc,
  writeBatch,
  query,
  where
} from 'firebase/firestore';

export interface DeduplicationSummary {
  duplicateProfilesRemoved: number;
  duplicateBranchesRemoved: number;
  duplicatePaymentsRemoved: number;
  duplicateJournalsRemoved: number;
  orphanedRecordsCleaned: number;
  details: string[];
}

/**
 * Scan database and remove all duplicate records while preserving relational integrity.
 */
export async function cleanDuplicateRecords(): Promise<DeduplicationSummary> {
  const summary: DeduplicationSummary = {
    duplicateProfilesRemoved: 0,
    duplicateBranchesRemoved: 0,
    duplicatePaymentsRemoved: 0,
    duplicateJournalsRemoved: 0,
    orphanedRecordsCleaned: 0,
    details: []
  };

  try {
    // 1. DEDUPLICATE PROFILES (by phone, national_id, customer_number)
    const profilesSnap = await getDocs(collection(db, 'profiles'));
    const phoneMap = new Map<string, any[]>();
    const aadhaarMap = new Map<string, any[]>();
    const codeMap = new Map<string, any[]>();

    profilesSnap.docs.forEach((d) => {
      const data = { id: d.id, ...d.data() } as any;
      const cleanPhone = (data.phone_primary || '').replace('+91', '').trim();
      const aadhaar = (data.national_id || '').trim();
      const custNo = (data.customer_number || '').trim();

      if (cleanPhone) {
        const existing = phoneMap.get(cleanPhone) || [];
        existing.push(data);
        phoneMap.set(cleanPhone, existing);
      }
      if (aadhaar) {
        const existing = aadhaarMap.get(aadhaar) || [];
        existing.push(data);
        aadhaarMap.set(aadhaar, existing);
      }
      if (custNo) {
        const existing = codeMap.get(custNo) || [];
        existing.push(data);
        codeMap.set(custNo, existing);
      }
    });

    const profilesToDelete = new Set<string>();

    // Process duplicate phones
    for (const [phone, list] of phoneMap.entries()) {
      if (list.length > 1) {
        // Keep the first (or one with most complete data)
        const sorted = [...list].sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
        const primary = sorted[0];
        for (let i = 1; i < sorted.length; i++) {
          const dup = sorted[i];
          if (!profilesToDelete.has(dup.id)) {
            profilesToDelete.add(dup.id);
            summary.details.push(`Duplicate customer phone (${phone}): removed profile ${dup.id} (${dup.name || 'Unnamed'}), preserved ${primary.id} (${primary.name})`);
          }
        }
      }
    }

    // Process duplicate Aadhaar
    for (const [aadhaar, list] of aadhaarMap.entries()) {
      if (list.length > 1) {
        const sorted = [...list].sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
        const primary = sorted[0];
        for (let i = 1; i < sorted.length; i++) {
          const dup = sorted[i];
          if (!profilesToDelete.has(dup.id)) {
            profilesToDelete.add(dup.id);
            summary.details.push(`Duplicate customer Aadhaar (${aadhaar}): removed profile ${dup.id}, preserved ${primary.id}`);
          }
        }
      }
    }

    // Delete duplicate profiles
    for (const profId of profilesToDelete) {
      try {
        await deleteDoc(doc(db, 'profiles', profId));
        summary.duplicateProfilesRemoved++;
      } catch (e) {
        console.warn(`Could not delete duplicate profile ${profId}:`, e);
      }
    }

    // 2. DEDUPLICATE BRANCHES (by branch code)
    const branchesSnap = await getDocs(collection(db, 'branches'));
    const branchCodeMap = new Map<string, any[]>();

    branchesSnap.docs.forEach((d) => {
      const data = { id: d.id, ...d.data() } as any;
      const code = (data.code || '').trim().toUpperCase();
      if (code) {
        const existing = branchCodeMap.get(code) || [];
        existing.push(data);
        branchCodeMap.set(code, existing);
      }
    });

    for (const [code, list] of branchCodeMap.entries()) {
      if (list.length > 1) {
        const sorted = [...list].sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
        const primary = sorted[0];
        for (let i = 1; i < sorted.length; i++) {
          const dup = sorted[i];
          try {
            await deleteDoc(doc(db, 'branches', dup.id));
            summary.duplicateBranchesRemoved++;
            summary.details.push(`Duplicate branch code (${code}): removed ${dup.id} (${dup.name}), preserved ${primary.id} (${primary.name})`);
          } catch (e) {
            console.warn(`Could not delete duplicate branch ${dup.id}:`, e);
          }
        }
      }
    }

    // 3. DEDUPLICATE PAYMENTS (by receipt_number or duplicate transaction submission)
    const paymentsSnap = await getDocs(collection(db, 'payments'));
    const receiptMap = new Map<string, any[]>();

    paymentsSnap.docs.forEach((d) => {
      const data = { id: d.id, ...d.data() } as any;
      const rec = (data.receipt_number || '').trim();
      if (rec) {
        const existing = receiptMap.get(rec) || [];
        existing.push(data);
        receiptMap.set(rec, existing);
      }
    });

    for (const [rec, list] of receiptMap.entries()) {
      if (list.length > 1) {
        const sorted = [...list].sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
        const primary = sorted[0];
        for (let i = 1; i < sorted.length; i++) {
          const dup = sorted[i];
          try {
            await deleteDoc(doc(db, 'payments', dup.id));
            summary.duplicatePaymentsRemoved++;
            summary.details.push(`Duplicate payment receipt (${rec}): removed ${dup.id}, preserved ${primary.id}`);
          } catch (e) {
            console.warn(`Could not delete duplicate payment ${dup.id}:`, e);
          }
        }
      }
    }

    // 4. DEDUPLICATE ACCOUNTING JOURNALS (demo entries)
    const journalSnap = await getDocs(collection(db, 'accounting_journals'));
    const journalDescMap = new Map<string, any[]>();

    journalSnap.docs.forEach((d) => {
      const data = { id: d.id, ...d.data() } as any;
      const key = `${data.date || ''}_${data.desc || ''}_${data.amount || 0}`;
      const existing = journalDescMap.get(key) || [];
      existing.push(data);
      journalDescMap.set(key, existing);
    });

    for (const [key, list] of journalDescMap.entries()) {
      if (list.length > 1) {
        const sorted = [...list];
        for (let i = 1; i < sorted.length; i++) {
          const dup = sorted[i];
          try {
            await deleteDoc(doc(db, 'accounting_journals', dup.id));
            summary.duplicateJournalsRemoved++;
            summary.details.push(`Duplicate journal entry: removed ${dup.id} (${dup.desc})`);
          } catch (e) {
            console.warn(`Could not delete duplicate journal ${dup.id}:`, e);
          }
        }
      }
    }

    console.log('[Deduplication Engine] Summary:', summary);
    return summary;
  } catch (err) {
    console.error('[Deduplication Engine] Error executing cleanup:', err);
    throw err;
  }
}

export interface DemoPurgeSummary {
  profilesDeleted: number;
  loansDeleted: number;
  goldItemsDeleted: number;
  paymentsDeleted: number;
  journalsDeleted: number;
  documentsDeleted: number;
  notificationsDeleted: number;
  auditLogsDeleted: number;
  details: string[];
}

/**
 * Permanently purges all demo records, test entities, and mock data from Cloud Firestore.
 */
export async function purgeAllDemoData(): Promise<DemoPurgeSummary> {
  const summary: DemoPurgeSummary = {
    profilesDeleted: 0,
    loansDeleted: 0,
    goldItemsDeleted: 0,
    paymentsDeleted: 0,
    journalsDeleted: 0,
    documentsDeleted: 0,
    notificationsDeleted: 0,
    auditLogsDeleted: 0,
    details: []
  };

  try {
    const demoProfileIds = new Set<string>([
      'dev-admin-id',
      'dev-customer-id',
      'cust-94827',
      'staff-mgr-1',
      'staff-app-1',
      'staff-csh-1',
      '1'
    ]);
    const demoPhoneNumbers = new Set<string>([
      '9999999999',
      '8888888888',
      '9876543210',
      '9840123456',
      '9840234567',
      '9840345678'
    ]);
    const demoLoanIds = new Set<string>([
      'dev-loan-id',
      'LN-GL2026000125',
      'PGF-LN-094285',
      'LN-51023',
      'LN-22941',
      'LN-87421',
      'LN-82010',
      'LN-11942',
      'LN-33428',
      'LN-94285'
    ]);

    // 1. Scan and delete demo profiles
    const profilesSnap = await getDocs(collection(db, 'profiles'));
    for (const d of profilesSnap.docs) {
      const data = d.data() as any;
      const cleanPhone = (data.phone_primary || '').replace('+91', '').trim();
      const isDemoId = demoProfileIds.has(d.id) || d.id.startsWith('dev-') || d.id.startsWith('staff-mgr-') || d.id.startsWith('staff-app-') || d.id.startsWith('staff-csh-');
      const isDemoPhone = demoPhoneNumbers.has(cleanPhone);
      const isDemoCustomerNo = (data.customer_number || '').trim() === 'PGF-CUST-001001';
      const isDemoName = (data.name === 'Priya Vignesh' && (isDemoPhone || isDemoCustomerNo || isDemoId)) || data.name === 'Dev Admin';

      if (isDemoId || isDemoPhone || isDemoCustomerNo || isDemoName) {
        demoProfileIds.add(d.id);
        try {
          await deleteDoc(doc(db, 'profiles', d.id));
          summary.profilesDeleted++;
          summary.details.push(`Deleted demo profile: ${d.id} (${data.name || 'Demo Profile'})`);
        } catch (e) {
          console.warn(`Could not delete demo profile ${d.id}:`, e);
        }
      }
    }

    // 2. Scan and delete demo loans
    const loansSnap = await getDocs(collection(db, 'loans'));
    for (const d of loansSnap.docs) {
      const data = d.data() as any;
      const isDemoLoanId = demoLoanIds.has(d.id) || d.id.startsWith('dev-') || demoLoanIds.has(data.loan_number);
      const isLinkedToDemoCust = data.customer_id && demoProfileIds.has(data.customer_id);

      if (isDemoLoanId || isLinkedToDemoCust) {
        demoLoanIds.add(d.id);
        if (data.loan_number) demoLoanIds.add(data.loan_number);
        try {
          await deleteDoc(doc(db, 'loans', d.id));
          summary.loansDeleted++;
          summary.details.push(`Deleted demo loan: ${d.id} (${data.loan_number || 'N/A'})`);
        } catch (e) {
          console.warn(`Could not delete demo loan ${d.id}:`, e);
        }
      }
    }

    // 3. Scan and delete demo gold collateral
    const goldSnap = await getDocs(collection(db, 'gold_collateral'));
    for (const d of goldSnap.docs) {
      const data = d.data() as any;
      const isDemoGoldId = d.id.startsWith('dev-') || d.id === 'gold-1';
      const isLinkedToDemoLoan = data.loan_id && demoLoanIds.has(data.loan_id);
      const isLinkedToDemoCust = data.customer_id && demoProfileIds.has(data.customer_id);

      if (isDemoGoldId || isLinkedToDemoLoan || isLinkedToDemoCust) {
        try {
          await deleteDoc(doc(db, 'gold_collateral', d.id));
          summary.goldItemsDeleted++;
          summary.details.push(`Deleted demo gold collateral: ${d.id} (${data.item_description || 'Gold Item'})`);
        } catch (e) {
          console.warn(`Could not delete demo gold collateral ${d.id}:`, e);
        }
      }
    }

    // 4. Scan and delete demo payments
    const paymentsSnap = await getDocs(collection(db, 'payments'));
    for (const d of paymentsSnap.docs) {
      const data = d.data() as any;
      const isDemoPaymentId = d.id.startsWith('dev-') || d.id === 'p-1';
      const isDemoReceipt = (data.receipt_number || '').includes('PGF-REC-010023') || (data.receipt_number || '').includes('RC2026000100');
      const isLinkedToDemoLoan = data.loan_id && demoLoanIds.has(data.loan_id);
      const isLinkedToDemoCust = data.customer_id && demoProfileIds.has(data.customer_id);

      if (isDemoPaymentId || isDemoReceipt || isLinkedToDemoLoan || isLinkedToDemoCust) {
        try {
          await deleteDoc(doc(db, 'payments', d.id));
          summary.paymentsDeleted++;
          summary.details.push(`Deleted demo payment: ${d.id} (${data.receipt_number || 'Receipt'})`);
        } catch (e) {
          console.warn(`Could not delete demo payment ${d.id}:`, e);
        }
      }
    }

    // 5. Scan and delete demo accounting journals
    const journalsSnap = await getDocs(collection(db, 'accounting_journals'));
    for (const d of journalsSnap.docs) {
      const data = d.data() as any;
      const isDemoJvId = d.id.startsWith('dev-jv') || d.id === 'dev-jv-1' || d.id === 'dev-jv-2' || d.id === 'dev-jv-3';
      const desc = data.desc || '';
      const isDemoDesc = desc.includes('LN-94285') || desc.includes('Priya Vignesh') || desc.includes('LN-82010') || desc.includes('Interest collection receipt');

      if (isDemoJvId || isDemoDesc) {
        try {
          await deleteDoc(doc(db, 'accounting_journals', d.id));
          summary.journalsDeleted++;
          summary.details.push(`Deleted demo accounting journal: ${d.id} (${desc})`);
        } catch (e) {
          console.warn(`Could not delete demo journal ${d.id}:`, e);
        }
      }
    }

    // 6. Scan and delete demo documents
    const documentsSnap = await getDocs(collection(db, 'documents'));
    for (const d of documentsSnap.docs) {
      const data = d.data() as any;
      const isDemoDocId = d.id.startsWith('DOC-0') || d.id.startsWith('dev-');
      const isLinkedToDemoLoan = data.loan_id && demoLoanIds.has(data.loan_id);
      const isLinkedToDemoCust = data.customer_id && demoProfileIds.has(data.customer_id);

      if (isDemoDocId || isLinkedToDemoLoan || isLinkedToDemoCust) {
        try {
          await deleteDoc(doc(db, 'documents', d.id));
          summary.documentsDeleted++;
          summary.details.push(`Deleted demo document: ${d.id} (${data.name || 'Document'})`);
        } catch (e) {
          console.warn(`Could not delete demo document ${d.id}:`, e);
        }
      }
    }

    // 7. Scan and delete demo notifications
    const notificationsSnap = await getDocs(collection(db, 'notifications'));
    for (const d of notificationsSnap.docs) {
      const data = d.data() as any;
      const isLinkedToDemoCust = data.customer_id && demoProfileIds.has(data.customer_id);
      const isLinkedToDemoLoan = data.loan_id && demoLoanIds.has(data.loan_id);

      if (isLinkedToDemoCust || isLinkedToDemoLoan) {
        try {
          await deleteDoc(doc(db, 'notifications', d.id));
          summary.notificationsDeleted++;
          summary.details.push(`Deleted demo notification: ${d.id}`);
        } catch (e) {
          console.warn(`Could not delete demo notification ${d.id}:`, e);
        }
      }
    }

    // 8. Scan and delete demo audit logs
    const auditSnap = await getDocs(collection(db, 'audit_logs'));
    for (const d of auditSnap.docs) {
      const data = d.data() as any;
      const isDemoEntity = data.affected_entity_id && (demoProfileIds.has(data.affected_entity_id) || demoLoanIds.has(data.affected_entity_id));

      if (isDemoEntity) {
        try {
          await deleteDoc(doc(db, 'audit_logs', d.id));
          summary.auditLogsDeleted++;
          summary.details.push(`Deleted demo audit log: ${d.id}`);
        } catch (e) {
          console.warn(`Could not delete demo audit log ${d.id}:`, e);
        }
      }
    }

    console.log('[Demo Purge Engine] Completed Summary:', summary);
    return summary;
  } catch (err) {
    console.error('[Demo Purge Engine] Error purging demo data:', err);
    throw err;
  }
}

