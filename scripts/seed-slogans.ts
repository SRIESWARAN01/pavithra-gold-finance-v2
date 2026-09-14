// scripts/seed-slogans.ts
// Seeds all 300 unique Tamil Gold Loan Slogans into Firebase Firestore collection `billSlogans`.

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, writeBatch } from 'firebase/firestore';
import { TAMIL_SLOGANS } from '../src/lib/data/tamilSlogans';

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

async function main() {
  console.log('Authenticating as Admin (7094826586)...');
  await signInWithEmailAndPassword(auth, '7094826586@pgf.local', 'Eswa@2005');
  console.log('Admin authenticated successfully.');

  console.log(`Starting upload of ${TAMIL_SLOGANS.length} unique Tamil slogans to Firestore 'billSlogans'...`);

  const batch = writeBatch(db);
  const now = new Date().toISOString();

  for (const slogan of TAMIL_SLOGANS) {
    const docRef = doc(db, 'billSlogans', `slogan_${slogan.id}`);
    batch.set(
      docRef,
      {
        id: slogan.id,
        slogan_id: slogan.slogan_id,
        text: slogan.text,
        created_at: now,
        updated_at: now,
      },
      { merge: true }
    );
  }

  // Also initialize the slogan counter
  const counterRef = doc(db, 'counters', 'bill_slogan_index');
  batch.set(counterRef, { value: 0, updated_at: now }, { merge: true });

  await batch.commit();
  console.log(`SUCCESS! All ${TAMIL_SLOGANS.length} unique Tamil slogans successfully uploaded to Firebase Firestore.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Error seeding slogans:', err);
  process.exit(1);
});
