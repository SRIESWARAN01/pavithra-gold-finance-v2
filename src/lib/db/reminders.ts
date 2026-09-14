// src/lib/db/reminders.ts
// Automated Loan Due Reminder & WhatsApp Notification Engine
// Supports 4-day, 2-day, 1-day, Due Today, and Overdue alert tracking with deduplication & retry.

import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  setDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import type { Loan, Profile } from '@/types/database';
import { getSetting } from '@/lib/db/settings';

export type ReminderStage =
  | '4_days_before'
  | '2_days_before'
  | '1_day_before'
  | 'due_today'
  | 'overdue';

export type ReminderStatus = 'Pending' | 'Sent' | 'Delivered' | 'Failed';

export interface WhatsAppReminder {
  id?: string;
  loan_id: string;
  loan_number: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  due_date: string;
  days_remaining: number; // positive for upcoming, 0 for due today, negative for overdue
  stage: ReminderStage;
  payable_amount: number;
  message_text: string;
  whatsapp_url: string;
  status: ReminderStatus;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
  retry_count?: number;
  error_message?: string | null;
}

const COLLECTION = 'whatsapp_reminders';

/**
 * Format a Tamil / English WhatsApp message for loan due reminders.
 * Uses templates configured in settings with dynamic fallbacks.
 */
export function formatWhatsAppMessage(params: {
  customerName: string;
  loanNumber: string;
  dueDate: string;
  daysRemaining: number;
  stage: ReminderStage;
  payableAmount: number;
  companyPhone?: string;
  customTemplate?: string;
}): string {
  const { customerName, loanNumber, dueDate, daysRemaining, stage, payableAmount, companyPhone = '9998887776', customTemplate } = params;

  if (customTemplate && customTemplate.trim()) {
    return customTemplate
      .replace(/{customer_name}/g, customerName)
      .replace(/{loan_number}/g, loanNumber)
      .replace(/{due_date}/g, dueDate)
      .replace(/{days_remaining}/g, String(Math.abs(daysRemaining)))
      .replace(/{amount}/g, payableAmount.toLocaleString('en-IN'))
      .replace(/{company_phone}/g, companyPhone);
  }

  // Authoritative Tamil template matching business specification
  const formattedAmount = `₹${payableAmount.toLocaleString('en-IN')}`;
  
  if (stage === '4_days_before') {
    return `வணக்கம் ${customerName},\nஉங்கள் PGF Loan No: ${loanNumber}\nLoan due date: ${dueDate}\nஇன்னும் 4 நாட்களில் உங்கள் loan payment due ஆகிறது.\nசெலுத்த வேண்டிய தொகை: ${formattedAmount}\nதயவுசெய்து due date-க்கு முன் payment செய்யவும்.\n\n– Pavithra Gold Finance\nதொடர்புக்கு: ${companyPhone}`;
  }

  if (stage === '2_days_before') {
    return `வணக்கம் ${customerName},\nஉங்கள் PGF Loan No: ${loanNumber}\nLoan due date: ${dueDate}\nஇன்னும் 2 நாட்களில் உங்கள் loan payment due ஆகிறது.\nசெலுத்த வேண்டிய தொகை: ${formattedAmount}\nதயவுசெய்து due date-க்கு முன் payment செய்யவும்.\n\n– Pavithra Gold Finance\nதொடர்புக்கு: ${companyPhone}`;
  }

  if (stage === '1_day_before') {
    return `வணக்கம் ${customerName},\nஉங்கள் PGF Loan No: ${loanNumber}\nLoan due date: ${dueDate}\nஇன்னும் 1 நாளில் (நாளை) உங்கள் loan payment due ஆகிறது.\nசெலுத்த வேண்டிய தொகை: ${formattedAmount}\nதயவுசெய்து உடனடியாக payment செய்யவும்.\n\n– Pavithra Gold Finance\nதொடர்புக்கு: ${companyPhone}`;
  }

  if (stage === 'due_today') {
    return `வணக்கம் ${customerName},\nஉங்கள் PGF Loan No: ${loanNumber}\nஇன்று (${dueDate}) உங்கள் loan payment due ஆகும் நாள்.\nசெலுத்த வேண்டிய தொகை: ${formattedAmount}\nதயவுசெய்து இன்றே payment செய்து அபராதத்தை தவிர்க்கவும்.\n\n– Pavithra Gold Finance\nதொடர்புக்கு: ${companyPhone}`;
  }

  // Overdue stage
  return `⚠️ அவசர அறிவிப்பு!\nவணக்கம் ${customerName},\nஉங்கள் PGF Loan No: ${loanNumber}\nLoan due date: ${dueDate}\nஉங்கள் loan payment due காலம் கடந்துவிட்டது (${Math.abs(daysRemaining)} நாட்கள் தாமதம்).\nசெலுத்த வேண்டிய தொகை: ${formattedAmount}\nதயவுசெய்து உடனடியாக பணம் செலுத்தி உங்கள் தங்க நகைகளை பாதுகாத்துக் கொள்ளுங்கள்.\n\n– Pavithra Gold Finance\nதொடர்புக்கு: ${companyPhone}`;
}

/**
 * Generate a direct WhatsApp click-to-chat URL.
 */
export function generateWhatsAppUrl(phone: string, message: string): string {
  const cleanPhone = phone.replace(/[^0-9]/g, '').replace(/^0+/, '');
  const internationalPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
  return `https://api.whatsapp.com/send?phone=${internationalPhone}&text=${encodeURIComponent(message)}`;
}

/**
 * Determine the reminder stage from the number of days remaining.
 */
export function getReminderStage(daysRemaining: number): ReminderStage | null {
  if (daysRemaining === 4) return '4_days_before';
  if (daysRemaining === 2) return '2_days_before';
  if (daysRemaining === 1) return '1_day_before';
  if (daysRemaining === 0) return 'due_today';
  if (daysRemaining < 0) return 'overdue';
  return null;
}

/**
 * Check if a reminder for a specific loan and stage has already been recorded/sent today
 * to prevent duplicate spamming.
 */
export async function isReminderAlreadySentToday(
  loanId: string,
  stage: ReminderStage
): Promise<boolean> {
  const todayStr = new Date().toISOString().split('T')[0];
  const q = query(
    collection(db, COLLECTION),
    where('loan_id', '==', loanId),
    where('stage', '==', stage)
  );

  const snapshot = await getDocs(q);
  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    if (data.created_at && data.created_at.startsWith(todayStr)) {
      return true;
    }
  }
  return false;
}

/**
 * Record a WhatsApp reminder log in Firestore.
 */
export async function recordWhatsAppReminder(data: Omit<WhatsAppReminder, 'id'>): Promise<WhatsAppReminder> {
  const now = new Date().toISOString();
  const reminderData = {
    ...data,
    created_at: data.created_at || now,
    updated_at: now,
  };

  const docRef = await addDoc(collection(db, COLLECTION), reminderData);
  return { id: docRef.id, ...reminderData };
}

/**
 * Update the delivery/sent status of a WhatsApp reminder.
 */
export async function updateWhatsAppReminderStatus(
  reminderId: string,
  status: ReminderStatus,
  error_message?: string
): Promise<void> {
  const docRef = doc(db, COLLECTION, reminderId);
  const now = new Date().toISOString();
  const updateData: any = {
    status,
    updated_at: now,
  };
  if (status === 'Sent' || status === 'Delivered') {
    updateData.sent_at = now;
  }
  if (error_message) {
    updateData.error_message = error_message;
  }
  await updateDoc(docRef, updateData);
}

/**
 * Retry a failed or pending WhatsApp reminder.
 */
export async function retryWhatsAppReminder(reminderId: string): Promise<WhatsAppReminder> {
  const docRef = doc(db, COLLECTION, reminderId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) {
    throw new Error('Reminder not found');
  }

  const current = snap.data();
  const now = new Date().toISOString();
  const retryCount = (current.retry_count || 0) + 1;

  await updateDoc(docRef, {
    status: 'Sent',
    sent_at: now,
    retry_count: retryCount,
    updated_at: now,
    error_message: null,
  });

  return { id: snap.id, ...current, status: 'Sent', sent_at: now, retry_count: retryCount } as WhatsAppReminder;
}

/**
 * Fetch all due loans eligible for reminders and match with reminder history.
 */
export async function getDueRemindersOverview(branchId?: string): Promise<{
  due4Days: WhatsAppReminder[];
  due2Days: WhatsAppReminder[];
  due1Day: WhatsAppReminder[];
  dueToday: WhatsAppReminder[];
  overdue: WhatsAppReminder[];
  totalActionable: number;
}> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Fetch company phone for messages
  const companyPhone = await getSetting('company_phone', '9998887776');

  // Fetch active loans
  const loansConstraints: any[] = [
    where('status', 'in', ['Active', 'Due', 'Overdue', 'Grace_Period'])
  ];
  if (branchId) loansConstraints.push(where('branch_id', '==', branchId));

  const loansSnap = await getDocs(query(collection(db, 'loans'), ...loansConstraints));

  const due4Days: WhatsAppReminder[] = [];
  const due2Days: WhatsAppReminder[] = [];
  const due1Day: WhatsAppReminder[] = [];
  const dueToday: WhatsAppReminder[] = [];
  const overdue: WhatsAppReminder[] = [];

  for (const docSnap of loansSnap.docs) {
    const loan = docSnap.data();
    if (!loan.maturity_date) continue;

    const matDate = new Date(loan.maturity_date);
    matDate.setHours(0, 0, 0, 0);

    const diffTime = matDate.getTime() - today.getTime();
    const daysRemaining = Math.round(diffTime / (1000 * 3600 * 24));

    const stage = getReminderStage(daysRemaining);
    if (!stage) continue;

    // Fetch customer details
    let customerName = 'Customer';
    let customerPhone = '';
    if (loan.customer_id) {
      const custSnap = await getDoc(doc(db, 'profiles', loan.customer_id));
      if (custSnap.exists()) {
        const custData = custSnap.data();
        customerName = custData.name || 'Customer';
        customerPhone = custData.phone_primary || '';
      }
    }

    const remainingPrincipal = (loan.principal_amount || 0) - (loan.total_principal_paid || 0);
    const outstandingInterest = loan.outstanding_interest || 0;
    const payableAmount = remainingPrincipal + outstandingInterest;
    const dueDateStr = matDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    const messageText = formatWhatsAppMessage({
      customerName,
      loanNumber: loan.loan_number,
      dueDate: dueDateStr,
      daysRemaining,
      stage,
      payableAmount,
      companyPhone,
    });

    const whatsappUrl = customerPhone ? generateWhatsAppUrl(customerPhone, messageText) : '';

    const reminderItem: WhatsAppReminder = {
      loan_id: docSnap.id,
      loan_number: loan.loan_number,
      customer_id: loan.customer_id,
      customer_name: customerName,
      customer_phone: customerPhone,
      due_date: dueDateStr,
      days_remaining: daysRemaining,
      stage,
      payable_amount: payableAmount,
      message_text: messageText,
      whatsapp_url: whatsappUrl,
      status: 'Pending',
      sent_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (stage === '4_days_before') due4Days.push(reminderItem);
    else if (stage === '2_days_before') due2Days.push(reminderItem);
    else if (stage === '1_day_before') due1Day.push(reminderItem);
    else if (stage === 'due_today') dueToday.push(reminderItem);
    else if (stage === 'overdue') overdue.push(reminderItem);
  }

  const totalActionable = due4Days.length + due2Days.length + due1Day.length + dueToday.length + overdue.length;

  return {
    due4Days,
    due2Days,
    due1Day,
    dueToday,
    overdue,
    totalActionable,
  };
}

/**
 * List historical WhatsApp reminders (for customer folder or admin activity log).
 */
export async function listWhatsAppReminders(options?: {
  customerId?: string;
  loanId?: string;
  status?: ReminderStatus;
  pageSize?: number;
}): Promise<WhatsAppReminder[]> {
  try {
    let q;
    if (options?.customerId) {
      q = query(collection(db, COLLECTION), where('customer_id', '==', options.customerId));
    } else if (options?.loanId) {
      q = query(collection(db, COLLECTION), where('loan_id', '==', options.loanId));
    } else {
      q = query(collection(db, COLLECTION));
    }

    const snapshot = await getDocs(q);
    let list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as WhatsAppReminder));
    
    if (options?.customerId && options?.loanId) {
      list = list.filter(r => r.loan_id === options.loanId);
    }
    if (options?.status) {
      list = list.filter(r => r.status === options.status);
    }
    list.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    
    const limitCount = options?.pageSize || 50;
    return list.slice(0, limitCount);
  } catch (err) {
    console.warn('Failed to query whatsapp_reminders:', err);
    return [];
  }
}
