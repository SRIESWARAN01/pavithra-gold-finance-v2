// src/lib/firebase-admin.ts
// Firebase Admin SDK singleton for server-side operations (auth, firestore, storage, FCM).

import * as admin from 'firebase-admin';

function formatPrivateKey(key?: string): string | undefined {
  if (!key) return undefined;
  return key.replace(/\\n/g, '\n');
}

function initAdmin(): admin.app.App {
  if (admin.apps.length > 0) {
    return admin.apps[0]!;
  }

  const projectId =
    process.env.FIREBASE_ADMIN_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    'pavithra-gold-finance';

  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = formatPrivateKey(process.env.FIREBASE_ADMIN_PRIVATE_KEY);
  const storageBucket =
    process.env.FIREBASE_ADMIN_STORAGE_BUCKET ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    `${projectId}.firebasestorage.app`;

  if (clientEmail && privateKey) {
    return admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      storageBucket,
    });
  }

  // Fallback: Initialize with project ID for development or Cloud environments
  return admin.initializeApp({
    projectId,
    storageBucket,
  });
}

const adminApp = initAdmin();

export const adminAuth = adminApp.auth();
export const adminDb = adminApp.firestore();
export const adminStorage = adminApp.storage();
export const adminMessaging = adminApp.messaging();
export default adminApp;

/**
 * Safely verify a Firebase ID Token with development clock-skew fallback.
 * Checks authoritative profile in Firestore if role is not in custom claims.
 */
export async function verifyAuthToken(idToken: string): Promise<{ uid: string; role: string; [key: string]: any }> {
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    let role = (decoded.role as string) || null;
    if (!role) {
      const profileSnap = await adminDb.collection('profiles').doc(decoded.uid).get();
      if (profileSnap.exists) {
        role = (profileSnap.data()?.role as string) || 'Customer';
      }
    }
    return { ...decoded, uid: decoded.uid, role: role || 'Customer' };
  } catch (err: any) {
    // In non-production environments, handle local clock skew if token is expired
    if (
      process.env.NODE_ENV !== 'production' &&
      (err.code === 'auth/id-token-expired' || err.message?.includes('auth/id-token-expired'))
    ) {
      console.warn('[ServerAuth] ⚠️ Clock skew detected: Token expired according to local clock. Falling back to decoded token + Firestore profile verification in dev mode.');
      const parts = idToken.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
        const uid = payload.user_id || payload.sub;
        if (uid && (payload.aud === 'pavithra-gold-finance' || payload.iss?.includes('pavithra-gold-finance'))) {
          const profileSnap = await adminDb.collection('profiles').doc(uid).get();
          let role = (payload.role as string) || null;
          if (profileSnap.exists) {
            role = (profileSnap.data()?.role as string) || role || 'Customer';
          }
          return { ...payload, uid, role: role || 'Customer' };
        }
      }
    }
    throw err;
  }
}

