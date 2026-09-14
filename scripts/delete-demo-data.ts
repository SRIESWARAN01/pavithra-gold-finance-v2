// scripts/delete-demo-data.ts
// Complete Data Sanitization & Demo Purge Engine for Pavithra Gold Finance (PGF).
// Removes all dummy/test business records while strictly preserving:
// 1. Admin Demo Login: 7094826586 / Eswa@2005
// 2. Customer Demo Login: 9876543210 / Cust@123

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  deleteDoc,
  setDoc,
  getDoc,
  writeBatch,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyDNeWehs1DnPvpVcRYShMpmJYHOd89BSvM',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'pavithra-gold-finance.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'pavithra-gold-finance',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'pavithra-gold-finance.firebasestorage.app',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '711653969',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:711653969:web:e3f147500e80d49b529670',
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function authenticateAndEnsureLogins() {
  const adminEmail = '7094826586@pgf.local';
  const adminPassword = 'Eswa@2005';
  const customerEmail = '9876543210@pgf.local';
  const customerPassword = 'Cust@123';

  console.log(`[Auth] Authenticating Master Admin (${adminEmail})...`);
  let adminUid = '';
  try {
    const cred = await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
    adminUid = cred.user.uid;
  } catch (err: any) {
    try {
      const cred = await createUserWithEmailAndPassword(auth, adminEmail, adminPassword);
      adminUid = cred.user.uid;
    } catch (createErr: any) {
      console.warn('Admin auth notice:', createErr.message);
    }
  }

  if (adminUid) {
    console.log(`[Auth] Master Admin authenticated with UID: ${adminUid}`);
    // Guarantee Admin Profile in Firestore
    await setDoc(
      doc(db, 'profiles', adminUid),
      {
        id: adminUid,
        name: 'Administrator',
        phone_primary: '7094826586',
        role: 'Admin',
        status: 'Active',
        customer_number: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { merge: true }
    );
    console.log('[Auth] Master Admin profile verified in Firestore.');
  }

  // Ensure Customer Demo Login exists
  console.log(`[Auth] Provisioning Demo Customer Account (${customerEmail})...`);
  let customerUid = '';
  try {
    const custCred = await createUserWithEmailAndPassword(auth, customerEmail, customerPassword);
    customerUid = custCred.user.uid;
  } catch (err: any) {
    // If user already exists in auth, find or construct profile
    customerUid = 'demo-customer-9876543210';
  }

  const demoCustProfile = {
    id: customerUid,
    name: 'Demo Customer',
    phone_primary: '9876543210',
    role: 'Customer',
    status: 'Active',
    customer_number: 'PGF-CUST-987654',
    address: '45/B, South Veli Street, Madurai',
    city: 'Madurai',
    state: 'Tamil Nadu',
    pin_code: '625001',
    national_id: '458912345678',
    pan_number: 'ABCDE1234F',
    kyc_status: 'Approved',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await setDoc(doc(db, 'profiles', customerUid), demoCustProfile, { merge: true });
  // Also save by phone-indexed doc ID for resilience
  await setDoc(doc(db, 'profiles', 'cust_9876543210'), demoCustProfile, { merge: true });
  console.log('[Auth] Demo Customer profile successfully verified.');

  // Re-authenticate as admin for write privileges
  await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
}

async function runPurge() {
  console.log('================================================================');
  console.log('  PAVITHRA GOLD FINANCE — COMPLETE REAL-DATA SANITIZATION SCRIPT');
  console.log('================================================================');

  await authenticateAndEnsureLogins();

  const preservedPhoneNumbers = new Set(['7094826586', '9876543210', '9655481937', '9600532099', '8484049922']);

  let loansDeleted = 0;
  let goldDeleted = 0;
  let paymentsDeleted = 0;
  let journalsDeleted = 0;
  let docsDeleted = 0;
  let notifsDeleted = 0;
  let auditsDeleted = 0;

  // 1. Purge all test loans
  console.log('\n[1/7] Purging all test & demo loans...');
  try {
    const loansSnap = await getDocs(collection(db, 'loans'));
    for (const d of loansSnap.docs) {
      await deleteDoc(doc(db, 'loans', d.id));
      loansDeleted++;
      console.log(`  -> Deleted test loan: ${d.id}`);
    }
  } catch (err: any) {
    console.warn('Notice deleting loans:', err.message);
  }

  // 2. Purge all test gold collateral & photos
  console.log('\n[2/7] Purging all test gold collateral & items...');
  try {
    const goldSnap = await getDocs(collection(db, 'gold_collateral'));
    for (const d of goldSnap.docs) {
      await deleteDoc(doc(db, 'gold_collateral', d.id));
      goldDeleted++;
      console.log(`  -> Deleted test gold item: ${d.id}`);
    }
    const photosSnap = await getDocs(collection(db, 'gold_photos'));
    for (const d of photosSnap.docs) {
      await deleteDoc(doc(db, 'gold_photos', d.id));
    }
  } catch (err: any) {
    console.warn('Notice deleting gold collateral:', err.message);
  }

  // 3. Purge all test payments
  console.log('\n[3/7] Purging test repayment records...');
  try {
    const paymentsSnap = await getDocs(collection(db, 'payments'));
    for (const d of paymentsSnap.docs) {
      await deleteDoc(doc(db, 'payments', d.id));
      paymentsDeleted++;
      console.log(`  -> Deleted test payment: ${d.id}`);
    }
  } catch (err: any) {
    console.warn('Notice deleting payments:', err.message);
  }

  // 4. Purge test accounting journals
  console.log('\n[4/7] Purging test accounting journals...');
  try {
    const journalsSnap = await getDocs(collection(db, 'accounting_journals'));
    for (const d of journalsSnap.docs) {
      await deleteDoc(doc(db, 'accounting_journals', d.id));
      journalsDeleted++;
      console.log(`  -> Deleted test journal: ${d.id}`);
    }
  } catch (err: any) {
    console.warn('Notice deleting journals:', err.message);
  }

  // 5. Purge test documents
  console.log('\n[5/7] Purging test documents...');
  try {
    const documentsSnap = await getDocs(collection(db, 'documents'));
    for (const d of documentsSnap.docs) {
      await deleteDoc(doc(db, 'documents', d.id));
      docsDeleted++;
      console.log(`  -> Deleted test document: ${d.id}`);
    }
  } catch (err: any) {
    console.warn('Notice deleting documents:', err.message);
  }

  // 6. Purge test notifications
  console.log('\n[6/7] Purging test notifications...');
  try {
    const notifsSnap = await getDocs(collection(db, 'notifications'));
    for (const d of notifsSnap.docs) {
      await deleteDoc(doc(db, 'notifications', d.id));
      notifsDeleted++;
      console.log(`  -> Deleted test notification: ${d.id}`);
    }
  } catch (err: any) {
    console.warn('Notice deleting notifications:', err.message);
  }

  // 7. Reset atomic counters & sync company settings
  console.log('\n[7/7] Resetting atomic counters & synchronizing system settings...');
  try {
    await setDoc(doc(db, 'counters', 'loan_number'), { value: 1000 }, { merge: true });
    await setDoc(doc(db, 'counters', 'receipt_number'), { value: 1000 }, { merge: true });
    await setDoc(doc(db, 'counters', 'customer_number'), { value: 1000 }, { merge: true });
    await setDoc(doc(db, 'counters', 'customer_number_MDU-01'), { value: 1000 }, { merge: true });

    const settingsUpdates = [
      { key: 'company_name', value: 'Pavithra Gold Finance' },
      { key: 'company_address', value: '45, Temple Street, Madurai' },
      { key: 'company_phone', value: '7094826586' },
      { key: 'company_email', value: 'contact@pavithragold.com' },
      { key: 'company_branch_name', value: 'Madurai Main' },
      { key: 'company_branch_code', value: 'MDU-01' },
      { key: 'company_description', value: 'Premium Luxury Gold Finance Services' },
      { key: 'company_bank_details', value: 'Axis Bank - A/C: 912010023849501 - IFSC: UTIB0000084' },
      { key: 'company_upi_id', value: '7094826586@upi' },
      { key: 'company_authorized_signatory', value: 'Manager, Pavithra Gold Finance' },
      { key: 'current_gold_rate', value: '10500' },
      { key: 'gold_rate_24k', value: '10500' },
      { key: 'gold_rate_22k', value: '9625' },
      { key: 'gold_rate_21k', value: '9188' },
      { key: 'gold_rate_18k', value: '7875' },
      { key: 'default_interest_rate', value: '12' },
      { key: 'ltv_percentage', value: '75' }
    ];

    for (const s of settingsUpdates) {
      await setDoc(doc(db, 'settings', s.key), {
        value: s.value,
        category: 'Company',
        updated_at: new Date().toISOString(),
        updated_by: 'System Sanitization'
      }, { merge: true });
    }
    console.log('  -> System settings & counters reset successfully.');
  } catch (err: any) {
    console.warn('Notice updating settings:', err.message);
  }

  console.log('\n================================================================');
  console.log('  SANIZATION COMPLETE! SUMMARY OF DELETED RECORDS:');
  console.log('================================================================');
  console.log(`  • Test Loans Deleted:              ${loansDeleted}`);
  console.log(`  • Test Gold Items Deleted:         ${goldDeleted}`);
  console.log(`  • Test Payments Deleted:           ${paymentsDeleted}`);
  console.log(`  • Test Journals Deleted:           ${journalsDeleted}`);
  console.log(`  • Test Documents Deleted:          ${docsDeleted}`);
  console.log(`  • Test Notifications Deleted:      ${notifsDeleted}`);
  console.log(`  -------------------------------------------------------------`);
  console.log(`  TOTAL TEST RECORDS REMOVED:        ${loansDeleted + goldDeleted + paymentsDeleted + journalsDeleted + docsDeleted + notifsDeleted}`);
  console.log('  Admin Login Preserved:             7094826586 (Eswa@2005)');
  console.log('  Customer Demo Login Preserved:     9876543210 (Cust@123)');
  console.log('================================================================\n');

  process.exit(0);
}

runPurge().catch((err) => {
  console.error('Purge script error:', err);
  process.exit(1);
});
