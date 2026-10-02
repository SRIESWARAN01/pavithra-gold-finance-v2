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

  const adminProjectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (adminProjectId && clientProjectId && adminProjectId !== clientProjectId) {
    throw new Error('Firebase Admin and client project IDs must match.');
  }
  const projectId = adminProjectId || clientProjectId;
  if (!projectId && process.env.NODE_ENV === 'production') {
    throw new Error('FIREBASE_ADMIN_PROJECT_ID or NEXT_PUBLIC_FIREBASE_PROJECT_ID must be set in production.');
  }

  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = formatPrivateKey(process.env.FIREBASE_ADMIN_PRIVATE_KEY);
  const storageBucket =
    process.env.FIREBASE_ADMIN_STORAGE_BUCKET ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    `${projectId}.firebasestorage.app`;

  if (clientEmail && privateKey) {
    return admin.initializeApp({
      credential: admin.credential.cert({
      projectId: projectId || undefined,
        clientEmail,
        privateKey,
      }),
      storageBucket,
    });
  }

  // Fallback: Initialize with project ID for development or Cloud environments
  return admin.initializeApp({
    ...(projectId ? { projectId } : {}),
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
 * Safely verify a Firebase ID Token.
 * Checks authoritative profile in Firestore — role is always resolved from
 * the server-side profile document, never from the token payload alone.
 *
 * SECURITY NOTES:
 * - No hardcoded dev/mock tokens. Use Firebase Emulator Auth for local dev.
 * - No fallback to Admin role under any circumstances.
 * - In non-production with missing ADC, falls back to JWT decode but still
 *   requires a valid Firestore profile with an explicit role.
 */
export async function verifyAuthToken(idToken: string): Promise<{ uid: string; role: string; [key: string]: any }> {
  if (!idToken || typeof idToken !== 'string' || idToken.trim().length === 0) {
    throw Object.assign(new Error('Authentication token is required.'), { code: 'auth/argument-error' });
  }

  try {
    const decoded = await adminAuth.verifyIdToken(idToken, process.env.NODE_ENV === 'production');
    const profileSnap = await adminDb.collection('profiles').doc(decoded.uid).get();
    if (!profileSnap.exists) {
      throw Object.assign(new Error('Authenticated user profile does not exist.'), { code: 'auth/profile-not-found' });
    }
    const profile = profileSnap.data();
    if (profile?.status !== 'Active') {
      throw Object.assign(new Error('Authenticated user account is inactive.'), { code: 'auth/user-disabled' });
    }

    const role = typeof profile.role === 'string' ? profile.role : null;
    if (!role) {
      throw Object.assign(new Error('User profile is missing a role assignment.'), { code: 'auth/claims-stale' });
    }

    return { ...decoded, uid: decoded.uid, role };
  } catch (err: any) {
    // If the error was already a profile/role/auth check error, re-throw immediately
    if (err.code === 'auth/profile-not-found' || err.code === 'auth/user-disabled' || err.code === 'auth/claims-stale') {
      throw err;
    }

    const isCredError =
      err.message?.includes('default credentials') ||
      err.message?.includes('Could not load the default credentials') ||
      err.code === 'app/invalid-credential';
    const isExpiredError =
      err.code === 'auth/id-token-expired' ||
      err.message?.includes('auth/id-token-expired');

    // In non-production environments ONLY, handle missing ADC or clock skew
    // by decoding the JWT payload — but STILL require a valid Firestore profile.
    if (process.env.NODE_ENV !== 'production' && (isCredError || isExpiredError)) {
      console.warn(`[ServerAuth] ⚠️ Dev fallback (${isCredError ? 'Default credentials missing' : 'Clock skew'}). Decoding token payload locally. Profile lookup still required.`);
      const parts = idToken.split('.');
      if (parts.length === 3) {
        try {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));
          const uid = payload.user_id || payload.sub;
          if (uid) {
            // Attempt profile lookup via client SDK (uses API key, no ADC needed)
            try {
              const { db } = await import('@/lib/firebase');
              const { doc, getDoc } = await import('firebase/firestore');
              const pSnap = await getDoc(doc(db, 'profiles', uid));
              if (pSnap.exists()) {
                const profileData = pSnap.data();
                if (profileData?.status !== 'Active') {
                  throw Object.assign(new Error('Authenticated user account is inactive.'), { code: 'auth/user-disabled' });
                }
                const role = typeof profileData.role === 'string' ? profileData.role : null;
                if (!role) {
                  throw Object.assign(new Error('User profile is missing a role assignment.'), { code: 'auth/claims-stale' });
                }
                return { ...payload, uid, role };
              }
            } catch (profileErr: any) {
              // Re-throw auth-specific errors from profile lookup
              if (profileErr.code === 'auth/user-disabled' || profileErr.code === 'auth/claims-stale') {
                throw profileErr;
              }
              console.warn('[ServerAuth] Client-side profile lookup failed:', profileErr);
            }
            // If profile lookup failed entirely, do NOT default to any role
            throw Object.assign(new Error('Dev fallback: Could not verify user profile. Ensure the user exists in Firestore profiles collection.'), { code: 'auth/profile-not-found' });
          }
        } catch (parseErr: any) {
          if (parseErr.code?.startsWith('auth/')) throw parseErr;
          console.error('[ServerAuth] Failed to parse token payload:', parseErr);
        }
      }
    }
    throw err;
  }
}
