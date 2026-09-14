// src/lib/db/notifications.ts
// Data access layer for notifications — Cloud Firestore and multi-channel delivery (In-App, FCM Push, SMS, WhatsApp).

import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  getCountFromServer,
  writeBatch,
} from 'firebase/firestore';
import type {
  Notification,
  NotificationInsert,
  NotificationType,
  NotificationChannel,
} from '@/types/database';

const COLLECTION = 'notifications';

/**
 * Create a new notification.
 * In production, this would also trigger SMS/WhatsApp/Push delivery.
 */
export async function createNotification(data: NotificationInsert): Promise<Notification> {
  const now = new Date().toISOString();
  const notificationData = {
    ...data,
    channel: data.channel || 'In_App',
    is_read: false,
    read_at: null,
    sent_at: now,
    created_at: now,
  };

  const docRef = await addDoc(collection(db, COLLECTION), notificationData);

  // Dispatch to external channels based on settings
  await dispatchExternalChannels(notificationData);

  return { id: docRef.id, ...notificationData } as unknown as Notification;
}

/**
 * Dispatch notification to external channels (SMS, WhatsApp, Push, Email)
 * based on application settings stored in Firestore.
 *
 * Integration points:
 * - SMS: Configure Twilio credentials in settings (sms_account_sid, sms_auth_token, sms_from_number)
 * - WhatsApp: Configure WhatsApp Business API credentials (whatsapp_api_key, whatsapp_phone_id)
 * - Push: Uses Firebase Cloud Messaging (FCM) — requires device token in user profile
 * - Email: Configure SMTP or SendGrid credentials (email_api_key, email_from)
 */
async function dispatchExternalChannels(
  notification: Record<string, any>
): Promise<void> {
  try {
    // Fetch channel settings
    const settingsToCheck = ['sms_enabled', 'whatsapp_enabled', 'push_enabled', 'email_enabled'];
    const channelSettings: Record<string, boolean> = {};

    for (const key of settingsToCheck) {
      try {
        const settingRef = doc(db, 'settings', key);
        const snap = await getDoc(settingRef);
        channelSettings[key] = snap.exists() && snap.data()?.value === 'true';
      } catch {
        channelSettings[key] = false;
      }
    }

    const channel = notification.channel || 'In_App';
    const recipientId = notification.recipient_id;
    const title = notification.title;
    const message = notification.message;

    // Log the In_App notification (always fires)
    console.log(`[Notification:In_App] ${notification.type}: ${title} → ${recipientId}`);

    // SMS Dispatch
    if (channelSettings.sms_enabled && (channel === 'SMS' || channel === 'In_App')) {
      console.log(`[Notification:SMS] Queued: "${title}" → ${recipientId}`);
      // Integration point: Twilio / MSG91 / TextLocal API call
      // await sendSMS({ to: recipientPhone, body: message });
    }

    // WhatsApp Dispatch
    if (channelSettings.whatsapp_enabled && (channel === 'WhatsApp' || channel === 'In_App')) {
      console.log(`[Notification:WhatsApp] Queued: "${title}" → ${recipientId}`);
      // Integration point: WhatsApp Business API / Cloud API
      // await sendWhatsApp({ to: recipientPhone, template: notification.type, params: { title, message } });
    }

    // Push Notification Dispatch (Firebase Cloud Messaging)
    if (channelSettings.push_enabled && (channel === 'Push' || channel === 'In_App')) {
      console.log(`[Notification:Push] Queued: "${title}" → ${recipientId}`);
      // Integration point: Firebase Admin SDK → FCM
      // await admin.messaging().send({ token: deviceToken, notification: { title, body: message } });
    }

    // Email Dispatch
    if (channelSettings.email_enabled && channel === 'Email') {
      console.log(`[Notification:Email] Queued: "${title}" → ${recipientId}`);
      // Integration point: SendGrid / Nodemailer / AWS SES
      // await sendEmail({ to: recipientEmail, subject: title, html: formatEmailTemplate(message) });
    }
  } catch (err) {
    // External channel dispatch should never block the main notification flow
    console.warn('[Notification] External channel dispatch failed (non-blocking):', err);
  }
}

/**
 * Create notifications for common events (convenience wrappers).
 */
export async function notifyLoanCreated(
  customerId: string,
  loanNumber: string,
  amount: number
): Promise<void> {
  await createNotification({
    recipient_id: customerId,
    type: 'Loan_Created',
    title: `New Loan Created — ${loanNumber}`,
    message: `Your gold loan ${loanNumber} for Rs. ${amount.toLocaleString('en-IN')} has been created and disbursed.`,
  });
}

export async function notifyPaymentReceived(
  customerId: string,
  loanNumber: string,
  amount: number,
  receiptNumber: string
): Promise<void> {
  await createNotification({
    recipient_id: customerId,
    type: 'Payment_Received',
    title: `Payment Received — ${receiptNumber}`,
    message: `We have received your payment of Rs. ${amount.toLocaleString('en-IN')} against loan ${loanNumber}. Receipt ${receiptNumber} generated.`,
  });
}

export async function notifyDueReminder(
  customerId: string,
  loanNumber: string,
  dueDate: string,
  daysRemaining: number
): Promise<void> {
  await createNotification({
    recipient_id: customerId,
    type: 'Due_Reminder',
    title: `Due Reminder — ${loanNumber}`,
    message: `Loan ${loanNumber} is due in ${daysRemaining} day(s) on ${dueDate}. Please arrange for settlement.`,
  });
}

export async function notifyOverdue(
  customerId: string,
  loanNumber: string,
  daysOverdue: number
): Promise<void> {
  await createNotification({
    recipient_id: customerId,
    type: 'Overdue_Alert',
    title: `Overdue Alert — ${loanNumber}`,
    message: `Loan ${loanNumber} is ${daysOverdue} day(s) overdue. Please clear outstanding dues immediately to avoid further action.`,
  });
}

export async function notifyLoanClosed(
  customerId: string,
  loanNumber: string
): Promise<void> {
  await createNotification({
    recipient_id: customerId,
    type: 'Loan_Closed',
    title: `Loan Settled — ${loanNumber}`,
    message: `Your gold loan ${loanNumber} has been fully settled. Your gold collateral is ready for release.`,
  });
}

/**
 * Get notifications for a user (paginated, newest first).
 */
export async function getNotifications(
  recipientId: string,
  options?: { page?: number; pageSize?: number; unreadOnly?: boolean }
): Promise<{ notifications: Notification[]; count: number; unreadCount: number }> {
  try {
    const q = query(collection(db, COLLECTION), where('recipient_id', '==', recipientId));
    const snapshot = await getDocs(q);

    let allNotifications = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as unknown as Notification));
    if (options?.unreadOnly) {
      allNotifications = allNotifications.filter((n) => !n.is_read);
    }
    allNotifications.sort((a: any, b: any) => (b.created_at || '').localeCompare(a.created_at || ''));

    // Client-side pagination
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 20;
    const start = (page - 1) * pageSize;
    const paginated = allNotifications.slice(start, start + pageSize);

    const unreadCount = allNotifications.filter((n) => !n.is_read).length;

    return {
      notifications: paginated,
      count: allNotifications.length,
      unreadCount,
    };
  } catch (err) {
    console.error('Error fetching notifications:', err);
    return { notifications: [], count: 0, unreadCount: 0 };
  }
}

/**
 * Mark a single notification as read.
 */
export async function markAsRead(notificationId: string): Promise<void> {
  const notifRef = doc(db, COLLECTION, notificationId);
  await updateDoc(notifRef, { is_read: true, read_at: new Date().toISOString() });
}

/**
 * Mark all notifications as read for a user.
 */
export async function markAllAsRead(recipientId: string): Promise<void> {
  const q = query(
    collection(db, COLLECTION),
    where('recipient_id', '==', recipientId),
    where('is_read', '==', false)
  );
  const snapshot = await getDocs(q);

  if (snapshot.empty) return;

  const batch = writeBatch(db);
  const now = new Date().toISOString();
  for (const d of snapshot.docs) {
    batch.update(d.ref, { is_read: true, read_at: now });
  }
  await batch.commit();
}
