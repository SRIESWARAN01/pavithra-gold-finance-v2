import { db } from '@/lib/firebase';
import { doc, setDoc, getDoc } from 'firebase/firestore';

/**
 * Seeds the database with essential system settings, counters, and the master Admin profile.
 * Does NOT inject fake/demo customer records or mock transactions.
 */
export async function seedInitialSystemData() {
  try {
    // 1. Initialize counters
    await setDoc(doc(db, 'counters', 'customer_number'), { value: 1000 }, { merge: true });
    await setDoc(doc(db, 'counters', 'loan_number'), { value: 10000 }, { merge: true });
    await setDoc(doc(db, 'counters', 'receipt_number'), { value: 10000 }, { merge: true });

    // 2. Initialize default settings
    const settings = [
      { key: 'company_name', value: 'Pavithra Gold Finance' },
      { key: 'company_address', value: '45, Temple Street, Madurai' },
      { key: 'company_phone', value: '7094826586' },
      { key: 'company_email', value: 'contact@pavithragold.com' },
      { key: 'company_website', value: 'www.pavithragold.com' },
      { key: 'company_branch_name', value: 'Madurai Main' },
      { key: 'company_branch_code', value: 'MDU-01' },
      { key: 'company_description', value: 'Premium Luxury Gold Finance Services' },
      { key: 'company_bank_details', value: 'Axis Bank - A/C: 912010023849501 - IFSC: UTIB0000084' },
      { key: 'company_upi_id', value: '7094826586@upi' },
      { key: 'company_authorized_signatory', value: 'Manager, Pavithra Gold Finance' },
      { key: 'company_logo', value: '' },
      { key: 'company_seal_url', value: '' },
      { key: 'current_gold_rate', value: '10500' },
      { key: 'gold_rate_24k', value: '10500' },
      { key: 'gold_rate_22k', value: '9625' },
      { key: 'gold_rate_21k', value: '9188' },
      { key: 'gold_rate_18k', value: '7875' },
      { key: 'default_interest_rate', value: '12' },
      { key: 'ltv_percentage', value: '75' }
    ];

    for (const s of settings) {
      await setDoc(doc(db, 'settings', s.key), {
        value: s.value,
        category: 'Company',
        updated_at: new Date().toISOString(),
        updated_by: 'System Init'
      }, { merge: true });
    }

    // 3. Initialize Master Admin profile
    await setDoc(doc(db, 'profiles', 'admin_7094826586'), {
      name: 'Administrator',
      phone_primary: '7094826586',
      role: 'Admin',
      status: 'Active',
      customer_number: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { merge: true });

    console.log('System initialized successfully (counters, settings, admin profile).');
  } catch (err) {
    console.error('Failed to initialize system database:', err);
  }
}
