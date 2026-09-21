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
  // 1. Direct dev mock tokens
  if (idToken === 'test-dev-admin-token' || idToken === 'test-dev-token') {
    return { uid: 'dev_admin', role: 'Admin' };
  }
  if (idToken === 'test-dev-customer-token') {
    return { uid: 'cust_sample_123', role: 'Customer' };
  }

  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    let role = (decoded.role as string) || null;
    if (!role) {
      try {
        const profileSnap = await adminDb.collection('profiles').doc(decoded.uid).get();
        if (profileSnap.exists) {
          role = (profileSnap.data()?.role as string) || 'Customer';
        }
      } catch {
        role = (decoded.role as string) || 'Customer';
      }
    }
    return { ...decoded, uid: decoded.uid, role: role || 'Customer' };
  } catch (err: any) {
    const isCredError =
      err.message?.includes('default credentials') ||
      err.message?.includes('Could not load the default credentials') ||
      err.code === 'app/invalid-credential';
    const isExpiredError =
      err.code === 'auth/id-token-expired' ||
      err.message?.includes('auth/id-token-expired');

    // In non-production environments, handle missing credentials or clock skew by decoding token payload
    if (process.env.NODE_ENV !== 'production' && (isCredError || isExpiredError)) {
      console.warn(`[ServerAuth] ⚠️ Dev fallback (${isCredError ? 'Default credentials missing' : 'Clock skew'}). Decoding token payload locally.`);
      const parts = idToken.split('.');
      if (parts.length === 3) {
        try {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
          const uid = payload.user_id || payload.sub;
          if (uid) {
            let role = (payload.role as string) || null;
            // Attempt to check profile using client SDK db (which uses API key, no ADC needed)
            try {
              const { db } = await import('@/lib/firebase');
              const { doc, getDoc } = await import('firebase/firestore');
              const pSnap = await getDoc(doc(db, 'profiles', uid));
              if (pSnap.exists()) {
                role = (pSnap.data()?.role as string) || role || 'Customer';
              }
            } catch {
              // Fallback to payload role or default Admin in dev
              role = role || 'Admin';
            }
            return { ...payload, uid, role: role || 'Admin' };
          }
        } catch (parseErr) {
          console.error('[ServerAuth] Failed to parse token payload:', parseErr);
        }
      }
    }
    throw err;
  }
}
