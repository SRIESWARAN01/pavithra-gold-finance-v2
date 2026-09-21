// scripts/backup-firestore.ts
// Automated Snapshot Backup Utility for Pavithra Gold Finance (PGF).
// Exports critical financial collections to timestamped JSON files for safety and rollback readiness.

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';

const collectionsToBackup = [
  'profiles',
  'loans',
  'payments',
  'gold_collateral',
  'bankRePledges',
  'accounting_journals',
  'settings',
  'branches',
  'investors',
  'investment_accounts',
  'investment_lots',
  'investment_transactions',
  'withdrawal_requests',
  'investment_payment_requests',
  'investment_settings',
  'audit_logs',
];

async function runBackup() {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'pavithra-gold-finance';
  
  if (getApps().length === 0) {
    initializeApp({
      projectId,
    });
  }

  const db = getFirestore();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(process.cwd(), 'backups', timestamp);

  fs.mkdirSync(backupDir, { recursive: true });
  console.log(`[Backup] Initializing Firestore backup to: ${backupDir}`);

  const summary: Record<string, number> = {};

  for (const collName of collectionsToBackup) {
    try {
      const snap = await db.collection(collName).get();
      const records = snap.docs.map((doc) => ({
        _id: doc.id,
        ...doc.data(),
      }));

      const filePath = path.join(backupDir, `${collName}.json`);
      fs.writeFileSync(filePath, JSON.stringify(records, null, 2), 'utf-8');
      summary[collName] = records.length;
      console.log(`  ✔ Backed up ${collName}: ${records.length} records`);
    } catch (err: any) {
      console.warn(`  ⚠ Failed to backup ${collName}: ${err.message}`);
      summary[collName] = -1;
    }
  }

  const manifestPath = path.join(backupDir, 'manifest.json');
  fs.writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        projectId,
        timestamp,
        collections: summary,
      },
      null,
      2
    ),
    'utf-8'
  );

  console.log(`[Backup] Completed successfully. Manifest saved at: ${manifestPath}`);
}

// Allow direct CLI execution if called directly
if (require.main === module) {
  runBackup().catch((err) => {
    console.error('[Backup Error]', err);
    process.exit(1);
  });
}

export { runBackup };
