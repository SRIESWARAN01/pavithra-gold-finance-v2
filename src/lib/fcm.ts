// src/lib/fcm.ts
// Firebase Cloud Messaging (FCM) client setup and helpers.

import app from '@/lib/firebase';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';

export async function getFCMToken(userId?: string): Promise<string | null> {
  try {
    const supported = await isSupported();
    if (!supported || typeof window === 'undefined') {
      return null;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('FCM Notification permission not granted:', permission);
      return null;
    }

    const messaging = getMessaging(app);
    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

    const currentToken = await getToken(messaging, {
      vapidKey: vapidKey || undefined,
      serviceWorkerRegistration: await navigator.serviceWorker.register('/firebase-messaging-sw.js'),
    });

    if (currentToken) {
      if (userId) {
        try {
          const profileRef = doc(db, 'profiles', userId);
          await updateDoc(profileRef, {
            fcm_token: currentToken,
            updated_at: new Date().toISOString(),
          });
        } catch (e) {
          console.error('Failed to persist FCM token to user profile:', e);
        }
      }
      return currentToken;
    }

    return null;
  } catch (error) {
    console.error('An error occurred while retrieving FCM token:', error);
    return null;
  }
}

export function onForegroundMessage(callback: (payload: any) => void) {
  if (typeof window === 'undefined') return () => {};

  isSupported().then((supported) => {
    if (!supported) return;
    try {
      const messaging = getMessaging(app);
      return onMessage(messaging, (payload) => {
        console.log('[FCM Foreground Message]:', payload);
        callback(payload);
      });
    } catch (e) {
      console.error('Error setting up FCM message listener:', e);
    }
  });
}
