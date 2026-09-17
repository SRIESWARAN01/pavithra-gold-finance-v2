// src/lib/auth.ts
// Authentication guard helpers for protected routes and user session management.
// Backed by Firebase Authentication and Cloud Firestore.

import { auth, db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import type { Profile, UserRole } from '@/types/database';

/**
 * Check if we're running with real Firebase credentials or placeholder keys.
 */
export function isFirebaseConfigured(): boolean {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '';
  return apiKey !== '' && !apiKey.includes('your-firebase-api-key');
}

/**
 * Read non-authoritative UI session details. Authentication and access checks
 * must use Firebase Authentication, never browser storage.
 */
export function getLocalSession(): any | null {
  if (typeof window === 'undefined') return null;
  try {
    const rawActive = localStorage.getItem('pgf_active_session');
    if (rawActive) return JSON.parse(rawActive);
  } catch (e) {
    console.warn('Failed to parse local session:', e);
  }
  return null;
}

/**
 * Get the currently authenticated Firebase user.
 * Returns null if not authenticated.
 */
export async function getCurrentSession() {
  const user = auth.currentUser;
  if (user) return { user };

  return null;
}

/**
 * Get the current user's ID from the active session.
 */
export async function getCurrentUserId(): Promise<string | null> {
  if (auth.currentUser) return auth.currentUser.uid;
  return null;
}

/**
 * Get the current user's profile from the database.
 * Returns null if not authenticated or profile doesn't exist.
 */
export async function getCurrentProfile(): Promise<Profile | null> {
  const userId = await getCurrentUserId();
  if (userId) {
    try {
      // 1. Try fetching directly by doc ID
      const profileRef = doc(db, 'profiles', userId);
      const profileSnap = await getDoc(profileRef);
      if (profileSnap.exists()) {
        return { id: profileSnap.id, ...profileSnap.data() } as Profile;
      }

    } catch (err) {
      console.warn('Firestore profile lookup error:', err);
    }
  }
  return null;
}

/**
 * Check if the current user has a specific role.
 */
export async function hasRole(role: UserRole): Promise<boolean> {
  const profile = await getCurrentProfile();
  return profile?.role === role;
}

/**
 * Require authentication — throws if not authenticated.
 */
export async function requireAuth(): Promise<{ userId: string; profile: Profile }> {
  const userId = await getCurrentUserId();
  const profile = await getCurrentProfile();

  if (!userId || !profile) {
    throw new Error('Authentication required. Please sign in.');
  }

  if (profile.status !== 'Active') {
    throw new Error('Account is inactive. Please contact support.');
  }

  return { userId, profile };
}

/**
 * Require admin/backoffice role — throws if not authenticated or is a Customer.
 */
export async function requireAdmin(): Promise<{ userId: string; profile: Profile }> {
  const authResult = await requireAuth();
  if (authResult.profile.role === 'Customer') {
    throw new Error('Admin access required.');
  }
  return authResult;
}

/**
 * Require one of the specified roles — throws if not authenticated or has an unauthorized role.
 */
export async function requireRole(allowedRoles: UserRole[]): Promise<{ userId: string; profile: Profile }> {
  const authResult = await requireAuth();
  if (!allowedRoles.includes(authResult.profile.role)) {
    throw new Error('Access denied. Insufficient permissions.');
  }
  return authResult;
}

/**
 * Require customer role — throws if not authenticated or not a customer.
 */
export async function requireCustomer(): Promise<{ userId: string; profile: Profile }> {
  const authResult = await requireAuth();
  if (authResult.profile.role !== 'Customer') {
    throw new Error('Customer access required.');
  }
  return authResult;
}

/**
 * Sign out the current user and clear the session.
 */
export async function signOut(): Promise<void> {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('pgf_active_session');
    localStorage.removeItem('pgf_bypass_session');
  }
  try {
    await auth.signOut();
  } catch (e) {}
}
