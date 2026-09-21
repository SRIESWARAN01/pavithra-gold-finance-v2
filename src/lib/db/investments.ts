// src/lib/db/investments.ts
// Data access, calculation engine, and transaction services for PGF Investment Management & Investor Portfolio.
// Strictly enforces financial integrity, lot-based accounting, date-based compounding, and audit trails.

import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  writeBatch,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore';
import type {
  Profile,
  InvestmentSettings,
  InvestmentPlan,
  InvestmentLot,
  InvestmentAccount,
  InvestmentTransaction,
  WithdrawalRequest,
  InvestmentPaymentRequest,
  InvestorPortfolioSummary,
  InvestmentGrowthPoint,
  AdminInvestmentDashboardMetrics,
  InvestmentConsolidatedItem,
  CompoundingFrequency,
  WithdrawalStatus,
} from '@/types/database';
import { createNotification } from '@/lib/db/notifications';

// Collections
const COLL_SETTINGS = 'investment_settings';
const COLL_LOTS = 'investment_lots';
const COLL_ACCOUNTS = 'investment_accounts';
const COLL_TRANSACTIONS = 'investment_transactions';
const COLL_WITHDRAWALS = 'withdrawal_requests';
const COLL_PAYMENT_REQUESTS = 'investment_payment_requests';
const COLL_AUDIT = 'investment_audit_logs';
const COLL_PROFILES = 'profiles';
const COLL_COUNTERS = 'counters';

function round2(val: number): number {
  return Math.round((Number(val) || 0) * 100) / 100;
}

// ============================================================================
// 1. Settings & Configurations
// ============================================================================

export const DEFAULT_INVESTMENT_SETTINGS: InvestmentSettings = {
  annual_rate: 12,
  compounding_frequency: 'Annual',
  minimum_amount: 10000,
  maximum_amount: 10000000,
  lock_in_period_months: 12,
  processing_sla_hours: 24,
  helpdesk_whatsapp_number: '919876543210',
  support_email: 'invest@pavithragoldfinance.com',
  qr_code_url: '/logo.jpg',
  qr_title: 'Pavithra Gold Finance Investment Account',
  payment_instructions: 'Scan the QR code using Google Pay, PhonePe, Paytm, or any UPI app. Enter the amount, complete the transfer, and submit the UTR / Transaction Reference number along with payment screenshot.',
  terms_and_conditions: 'Investments are subject to PGF terms. Returns are calculated based on the applicable plan rate and compounding policy. Early withdrawals within the lock-in period are calculated as per configured terms.',
  disclaimer_text: 'Past performance is illustrative. Projected returns are based on the currently applicable rate and are subject to approved company policy.',
};

export async function getInvestmentSettings(): Promise<InvestmentSettings> {
  try {
    const snap = await getDoc(doc(db, COLL_SETTINGS, 'global_config'));
    if (snap.exists()) {
      return { ...DEFAULT_INVESTMENT_SETTINGS, ...(snap.data() as InvestmentSettings) };
    }
    // Initialize default if not found
    await setDoc(doc(db, COLL_SETTINGS, 'global_config'), DEFAULT_INVESTMENT_SETTINGS);
    return DEFAULT_INVESTMENT_SETTINGS;
  } catch (err) {
    console.warn('[Investments] Error fetching settings, returning default:', err);
    return DEFAULT_INVESTMENT_SETTINGS;
  }
}

export async function updateInvestmentSettings(
  settings: Partial<InvestmentSettings>,
  updatedBy: string
): Promise<InvestmentSettings> {
  const current = await getInvestmentSettings();
  const updated: InvestmentSettings = {
    ...current,
    ...settings,
    updated_at: new Date().toISOString(),
  };

  await setDoc(doc(db, COLL_SETTINGS, 'global_config'), updated);

  // Log audit
  await logInvestmentAudit({
    actor_id: updatedBy,
    action: 'SETTINGS_UPDATED',
    entity: 'investment_settings',
    entity_id: 'global_config',
    details: { changes: settings },
  });

  return updated;
}

// ============================================================================
// 2. Atomic Sequential ID Generation
// ============================================================================

async function getNextCounter(counterName: string, prefix: string, padLength = 6): Promise<string> {
  const counterRef = doc(db, COLL_COUNTERS, counterName);
  return await runTransaction(db, async (txn) => {
    const snap = await txn.get(counterRef);
    let nextVal = 1;
    if (snap.exists()) {
      nextVal = (snap.data().lastValue || 0) + 1;
    }
    txn.set(counterRef, { lastValue: nextVal, updated_at: new Date().toISOString() }, { merge: true });
    return `${prefix}-${String(nextVal).padStart(padLength, '0')}`;
  });
}

export async function generateInvestorId(): Promise<string> {
  return getNextCounter('investor_id_counter', 'PGF-INV', 6);
}

export async function generateInvestmentTxnId(): Promise<string> {
  return getNextCounter('inv_txn_counter', 'PGF-INV-TXN', 6);
}

export async function generateWithdrawalId(): Promise<string> {
  return getNextCounter('withdrawal_counter', 'PGF-WDR', 6);
}

export async function generateLotId(): Promise<string> {
  return getNextCounter('lot_counter', 'PGF-LOT', 6);
}

export async function generatePaymentRequestId(): Promise<string> {
  return getNextCounter('payment_req_counter', 'PGF-REQ', 6);
}

// ============================================================================
// 3. Return & Compounding Calculation Engine
// ============================================================================

/**
 * Calculates returns for a single investment lot up to a target date.
 * Enforces business rules:
 * - Within first year (< 365 days): Pro-rata simple return (or early withdrawal rule).
 * - After one year (>= 365 days): Annual compounding.
 *   Year 1: Principal * (1 + rate)
 *   Year 2: (Principal * (1 + rate)) * (1 + rate)
 *   Year n: Principal * (1 + rate)^n
 */
export function calculateLotReturns(
  lot: {
    principal_amount: number;
    withdrawn_amount?: number;
    applicable_rate: number;
    investment_date: string;
    compounding_frequency?: CompoundingFrequency;
  },
  asOfDateStr?: string
): {
  elapsedDays: number;
  elapsedMonths: number;
  elapsedYears: number;
  activePrincipal: number;
  accruedReturn: number;
  currentValue: number;
} {
  const startDate = new Date(lot.investment_date.split('T')[0] + 'T00:00:00Z');
  const targetDate = asOfDateStr
    ? new Date(asOfDateStr.split('T')[0] + 'T00:00:00Z')
    : new Date(new Date().toISOString().split('T')[0] + 'T00:00:00Z');

  const diffMs = Math.max(0, targetDate.getTime() - startDate.getTime());
  const elapsedDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const elapsedYears = elapsedDays / 365.25;
  const elapsedMonths = Math.floor(elapsedDays / 30.4375);

  const activePrincipal = Math.max(0, (lot.principal_amount || 0) - (lot.withdrawn_amount || 0));
  if (activePrincipal <= 0) {
    return {
      elapsedDays,
      elapsedMonths,
      elapsedYears,
      activePrincipal: 0,
      accruedReturn: 0,
      currentValue: 0,
    };
  }

  const rate = (Number(lot.applicable_rate) || 12) / 100;

  let totalValue = activePrincipal;

  if (elapsedDays < 365) {
    // Within first year: pro-rata return
    const yearFraction = elapsedDays / 365;
    totalValue = activePrincipal * (1 + rate * yearFraction);
  } else {
    // After 1 year: annual compounding
    const fullYears = Math.floor(elapsedDays / 365);
    const remainingDays = elapsedDays % 365;
    const remainingFraction = remainingDays / 365;

    // Compounded over full years
    const compounded = activePrincipal * Math.pow(1 + rate, fullYears);
    // Plus pro-rata for remaining fraction of current year
    totalValue = compounded * (1 + rate * remainingFraction);
  }

  const accruedReturn = Math.max(0, totalValue - activePrincipal);

  return {
    elapsedDays,
    elapsedMonths,
    elapsedYears: round2(elapsedYears),
    activePrincipal: round2(activePrincipal),
    accruedReturn: round2(accruedReturn),
    currentValue: round2(totalValue),
  };
}

/**
 * Format duration in human readable text (e.g., "1 Year 8 Months" or "45 Days")
 */
export function formatDurationText(days: number): string {
  if (days <= 0) return '0 Days';
  if (days < 30) return `${days} Days`;
  const months = Math.floor(days / 30.4375);
  if (months < 12) return `${months} Month${months > 1 ? 's' : ''} (${days} Days)`;
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  return `${years} Year${years > 1 ? 's' : ''}${remMonths > 0 ? ` ${remMonths} Month${remMonths > 1 ? 's' : ''}` : ''}`;
}

// ============================================================================
// 4. Investor Portfolio Aggregation
// ============================================================================

export async function getInvestorLots(investorId: string): Promise<InvestmentLot[]> {
  const q = query(
    collection(db, COLL_LOTS),
    where('investor_id', '==', investorId),
    orderBy('investment_date', 'asc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<InvestmentLot, 'id'>) }));
}

export async function getInvestorTransactions(investorId: string): Promise<InvestmentTransaction[]> {
  const q = query(
    collection(db, COLL_TRANSACTIONS),
    where('investor_id', '==', investorId),
    orderBy('transaction_date', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<InvestmentTransaction, 'id'>) }));
}

export async function getInvestorWithdrawalRequests(investorId: string): Promise<WithdrawalRequest[]> {
  const q = query(
    collection(db, COLL_WITHDRAWALS),
    where('investor_id', '==', investorId),
    orderBy('created_at', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<WithdrawalRequest, 'id'>) }));
}

export async function getInvestorPortfolio(
  investorId: string,
  asOfDateStr?: string
): Promise<InvestorPortfolioSummary> {
  // Fetch investor profile
  const profSnap = await getDoc(doc(db, COLL_PROFILES, investorId));
  if (!profSnap.exists()) {
    throw new Error(`Investor profile not found for ID: ${investorId}`);
  }
  const prof = profSnap.data() as Profile;

  // Fetch all lots
  const lots = await getInvestorLots(investorId);
  const settings = await getInvestmentSettings();

  let totalInvested = 0;
  let totalWithdrawn = 0;
  let totalAccruedReturn = 0;
  let totalCurrentValue = 0;
  let earliestDate = '';

  lots.forEach((lot) => {
    totalInvested += lot.principal_amount || 0;
    totalWithdrawn += lot.withdrawn_amount || 0;

    const calc = calculateLotReturns(lot, asOfDateStr);
    totalAccruedReturn += calc.accruedReturn;
    totalCurrentValue += calc.currentValue;

    if (!earliestDate || lot.investment_date < earliestDate) {
      earliestDate = lot.investment_date;
    }
  });

  const additionalInvestments = lots.length > 1
    ? lots.slice(1).reduce((sum, l) => sum + (l.principal_amount || 0), 0)
    : 0;

  const netInvestedCapital = Math.max(0, totalInvested - totalWithdrawn);

  // Fetch pending withdrawals count
  const pendingWdSnap = await getDocs(
    query(
      collection(db, COLL_WITHDRAWALS),
      where('investor_id', '==', investorId),
      where('status', 'in', ['Pending', 'Approved', 'Payment_Processing'])
    )
  );

  const pendingWithdrawalsCount = pendingWdSnap.size;

  // Calculate elapsed days from earliest lot
  const elapsedDays = earliestDate
    ? Math.max(0, Math.floor((new Date().getTime() - new Date(earliestDate).getTime()) / (1000 * 60 * 60 * 24)))
    : 0;

  return {
    investor_id: investorId,
    investor_number: prof.customer_number || prof.id,
    investor_name: prof.name || 'Valued Investor',
    investor_phone: prof.phone_primary || '',
    total_invested: round2(totalInvested),
    additional_investments: round2(additionalInvestments),
    total_withdrawn: round2(totalWithdrawn),
    accrued_return: round2(totalAccruedReturn),
    current_value: round2(totalCurrentValue),
    net_invested_capital: round2(netInvestedCapital),
    annual_rate: settings.annual_rate,
    start_date: earliestDate || new Date().toISOString().split('T')[0],
    duration_text: formatDurationText(elapsedDays),
    active_lots_count: lots.filter((l) => l.status === 'Active').length,
    pending_withdrawals_count: pendingWithdrawalsCount,
    eligible_withdrawal_amount: round2(totalCurrentValue),
    status: (prof.status as any) || 'Active',
    // Convenience aliases
    investor: {
      investorId: prof.customer_number || prof.id,
      name: prof.name || 'Valued Investor',
      phone: prof.phone_primary || '',
      email: prof.email || '',
      pan: prof.pan_number || '',
      address: prof.address,
      status: prof.status,
      createdAt: prof.created_at,
      bankDetails: (prof as any).bank_details || (prof as any).bankDetails,
      nomineeDetails: (prof as any).nominee_details || (prof as any).nomineeDetails,
    },
    lots,
    totalInvested: round2(totalInvested),
    currentValue: round2(totalCurrentValue),
    totalReturns: round2(totalAccruedReturn),
    eligibleWithdrawalAmount: round2(totalCurrentValue),
    activeLotsCount: lots.filter((l) => l.status === 'Active').length,
  };
}

/**
 * Generates portfolio growth points for chart visualization.
 * Combines historical actual points with 1Y, 2Y, 3Y, 5Y projections.
 */
export function generatePortfolioGrowthChart(
  lots: InvestmentLot[],
  settings: InvestmentSettings
): InvestmentGrowthPoint[] {
  if (!lots || lots.length === 0) return [];

  const points: InvestmentGrowthPoint[] = [];
  const sortedLots = [...lots].sort((a, b) => a.investment_date.localeCompare(b.investment_date));
  const startDateStr = sortedLots[0].investment_date;
  const startDate = new Date(startDateStr.split('T')[0] + 'T00:00:00Z');
  const now = new Date();

  // Point 0: Start date
  points.push({
    date: startDateStr,
    label: 'Initial',
    invested_capital: sortedLots[0].principal_amount,
    accrued_return: 0,
    total_value: sortedLots[0].principal_amount,
    is_projected: false,
  });

  // Current Date Point
  let currentInvested = 0;
  let currentReturn = 0;
  let currentValue = 0;

  sortedLots.forEach((l) => {
    currentInvested += l.principal_amount - (l.withdrawn_amount || 0);
    const calc = calculateLotReturns(l);
    currentReturn += calc.accruedReturn;
    currentValue += calc.currentValue;
  });

  const todayStr = now.toISOString().split('T')[0];
  if (todayStr !== startDateStr) {
    points.push({
      date: todayStr,
      label: 'Today',
      invested_capital: round2(currentInvested),
      accrued_return: round2(currentReturn),
      total_value: round2(currentValue),
      is_projected: false,
    });
  }

  // Future projections: 1Y, 2Y, 3Y, 5Y from today
  const rate = settings.annual_rate / 100;
  const projectionYears = [1, 2, 3, 5];

  projectionYears.forEach((yrs) => {
    const projDate = new Date(now);
    projDate.setFullYear(now.getFullYear() + yrs);
    const projDateStr = projDate.toISOString().split('T')[0];

    // Compound current value forward
    const projectedValue = currentValue * Math.pow(1 + rate, yrs);
    const projectedReturn = projectedValue - currentInvested;

    points.push({
      date: projDateStr,
      label: `+${yrs}Y Projected`,
      invested_capital: round2(currentInvested),
      accrued_return: round2(projectedReturn),
      total_value: round2(projectedValue),
      is_projected: true,
    });
  });

  return points;
}

// ============================================================================
// 5. Payment Verification & Investment Posting (Atomic)
// ============================================================================

export async function submitInvestmentPaymentRequest(data: {
  investor_id: string;
  amount: number;
  payment_date: string;
  payment_mode: string;
  utr_number: string;
  screenshot_url?: string | null;
}): Promise<InvestmentPaymentRequest> {
  const settings = await getInvestmentSettings();
  if (data.amount < settings.minimum_amount) {
    throw new Error(`Investment amount cannot be less than ₹${settings.minimum_amount.toLocaleString('en-IN')}`);
  }
  if (data.amount > settings.maximum_amount) {
    throw new Error(`Investment amount cannot exceed ₹${settings.maximum_amount.toLocaleString('en-IN')}`);
  }

  // Fetch investor profile
  const profSnap = await getDoc(doc(db, COLL_PROFILES, data.investor_id));
  if (!profSnap.exists()) {
    throw new Error('Investor profile not found.');
  }
  const prof = profSnap.data() as Profile;

  const reqNumber = await generatePaymentRequestId();
  const now = new Date().toISOString();

  const reqData: InvestmentPaymentRequest = {
    id: reqNumber,
    request_number: reqNumber,
    investor_id: data.investor_id,
    investor_number: prof.customer_number || prof.id,
    investor_name: prof.name,
    investor_phone: prof.phone_primary,
    amount: round2(data.amount),
    payment_date: data.payment_date,
    payment_mode: data.payment_mode,
    utr_number: data.utr_number.trim(),
    screenshot_url: data.screenshot_url || null,
    status: 'Pending_Verification',
    created_at: now,
    updated_at: now,
  };

  await setDoc(doc(db, COLL_PAYMENT_REQUESTS, reqNumber), reqData);

  // Notify Admin
  await createNotification({
    recipient_id: 'admin_broadcast',
    type: 'System',
    title: 'New Investment Payment Verification Required',
    message: `Investor ${prof.name} (${prof.customer_number || prof.id}) submitted ₹${data.amount.toLocaleString('en-IN')} via ${data.payment_mode}. UTR: ${data.utr_number}.`,
    channel: 'In_App',
  });

  // Notify Investor
  await createNotification({
    recipient_id: data.investor_id,
    type: 'Payment_Received',
    title: 'Investment Payment Submitted',
    message: `Your investment payment of ₹${data.amount.toLocaleString('en-IN')} has been submitted successfully and is pending verification. Request ID: ${reqNumber}.`,
    channel: 'In_App',
  });

  // Audit log
  await logInvestmentAudit({
    actor_id: data.investor_id,
    action: 'INVESTMENT_PAYMENT_SUBMITTED',
    entity: 'investment_payment_requests',
    entity_id: reqNumber,
    details: { amount: data.amount, utr: data.utr_number, mode: data.payment_mode },
  });

  return reqData;
}

export async function approveInvestmentPayment(
  requestId: string,
  approvedBy: string
): Promise<{ lot: InvestmentLot; transaction: InvestmentTransaction }> {
  const reqRef = doc(db, COLL_PAYMENT_REQUESTS, requestId);
  const settings = await getInvestmentSettings();

  return await runTransaction(db, async (txn) => {
    const reqSnap = await txn.get(reqRef);
    if (!reqSnap.exists()) {
      throw new Error(`Payment request ${requestId} not found.`);
    }
    const req = reqSnap.data() as InvestmentPaymentRequest;
    if (req.status !== 'Pending_Verification') {
      throw new Error(`Payment request is already in status: ${req.status}`);
    }

    const now = new Date().toISOString();
    const today = now.split('T')[0];

    // Generate lot and transaction IDs
    const lotId = await generateLotId();
    const txnId = await generateInvestmentTxnId();

    // Check if this is initial or additional investment
    const lotsQuery = query(collection(db, COLL_LOTS), where('investor_id', '==', req.investor_id));
    const existingLotsSnap = await getDocs(lotsQuery);
    const isAdditional = existingLotsSnap.size > 0;
    const txnType = isAdditional ? 'Additional_Investment' : 'Initial_Investment';

    // 1. Create Investment Lot
    const newLot: InvestmentLot = {
      id: lotId,
      lot_number: lotId,
      investor_id: req.investor_id,
      investor_number: req.investor_number,
      investment_date: req.payment_date || today,
      principal_amount: req.amount,
      applicable_rate: settings.annual_rate,
      compounding_frequency: settings.compounding_frequency,
      status: 'Active',
      withdrawn_amount: 0,
      accrued_return: 0,
      current_value: req.amount,
      created_at: now,
      updated_at: now,
    };
    txn.set(doc(db, COLL_LOTS, lotId), newLot);

    // 2. Create Investment Transaction
    const newTxn: InvestmentTransaction = {
      id: txnId,
      transaction_number: txnId,
      investor_id: req.investor_id,
      investor_number: req.investor_number,
      lot_id: lotId,
      type: txnType,
      amount: req.amount,
      rate: settings.annual_rate,
      payment_mode: req.payment_mode,
      utr_number: req.utr_number,
      transaction_reference: req.request_number,
      status: 'Completed',
      notes: `Approved payment request ${req.request_number}`,
      created_by: approvedBy,
      approved_by: approvedBy,
      transaction_date: req.payment_date || today,
      created_at: now,
    };
    txn.set(doc(db, COLL_TRANSACTIONS, txnId), newTxn);

    // 3. Update Payment Request status
    txn.update(reqRef, {
      status: 'Approved',
      verified_by: approvedBy,
      verified_at: now,
      updated_at: now,
    });

    // 4. Update or Create Investment Account
    const acctRef = doc(db, COLL_ACCOUNTS, req.investor_id);
    const acctSnap = await txn.get(acctRef);

    if (acctSnap.exists()) {
      const acct = acctSnap.data() as InvestmentAccount;
      txn.update(acctRef, {
        total_invested: round2(acct.total_invested + req.amount),
        total_additional_investment: isAdditional
          ? round2(acct.total_additional_investment + req.amount)
          : acct.total_additional_investment,
        current_value: round2(acct.current_value + req.amount),
        status: 'Active',
        updated_at: now,
      });
    } else {
      const newAcct: InvestmentAccount = {
        id: req.investor_id,
        investor_id: req.investor_id,
        investor_number: req.investor_number,
        total_invested: req.amount,
        total_additional_investment: 0,
        total_withdrawn: 0,
        accrued_return: 0,
        current_value: req.amount,
        status: 'Active',
        created_at: now,
        updated_at: now,
      };
      txn.set(acctRef, newAcct);
    }

    return { lot: newLot, transaction: newTxn };
  }).then(async (res) => {
    // Notify Investor
    await createNotification({
      recipient_id: res.lot.investor_id,
      type: 'Investment_Approved',
      title: 'Investment Approved & Active',
      message: `Your investment of ₹${res.lot.principal_amount.toLocaleString('en-IN')} has been verified and approved. Lot: ${res.lot.lot_number}. Applicable Rate: ${res.lot.applicable_rate}%.`,
      channel: 'In_App',
    });

    // Log Audit
    await logInvestmentAudit({
      actor_id: approvedBy,
      action: 'INVESTMENT_PAYMENT_APPROVED',
      entity: 'investment_lots',
      entity_id: res.lot.id,
      details: {
        requestId,
        lotNumber: res.lot.lot_number,
        amount: res.lot.principal_amount,
        utr: res.transaction.utr_number,
      },
    });

    return res;
  });
}

export async function rejectInvestmentPayment(
  requestId: string,
  reason: string,
  rejectedBy: string
): Promise<void> {
  const reqRef = doc(db, COLL_PAYMENT_REQUESTS, requestId);
  const snap = await getDoc(reqRef);
  if (!snap.exists()) throw new Error(`Request ${requestId} not found.`);
  const req = snap.data() as InvestmentPaymentRequest;

  const now = new Date().toISOString();
  await updateDoc(reqRef, {
    status: 'Rejected',
    rejection_reason: reason,
    verified_by: rejectedBy,
    verified_at: now,
    updated_at: now,
  });

  // Notify Investor
  await createNotification({
    recipient_id: req.investor_id,
    type: 'Investment_Rejected',
    title: 'Investment Payment Verification Rejected',
    message: `Your investment payment request ${req.request_number} for ₹${req.amount.toLocaleString('en-IN')} was rejected. Reason: ${reason}. Please contact helpdesk.`,
    channel: 'In_App',
  });

  // Log Audit
  await logInvestmentAudit({
    actor_id: rejectedBy,
    action: 'INVESTMENT_PAYMENT_REJECTED',
    entity: 'investment_payment_requests',
    entity_id: requestId,
    details: { reason, amount: req.amount },
  });
}

// ============================================================================
// 6. Withdrawal Workflow (Eligible check, 2-stage approval & completion)
// ============================================================================

export async function submitWithdrawalRequest(data: {
  investor_id?: string;
  investorId?: string;
  requested_amount?: number;
  requestedAmount?: number;
  reason?: string;
  bank_account_details?: WithdrawalRequest['bank_account_details'];
  bankDetails?: any;
}): Promise<WithdrawalRequest> {
  const investor_id = data.investor_id || data.investorId || '';
  const requested_amount = data.requested_amount || data.requestedAmount || 0;
  const bank_account_details = data.bank_account_details || (data.bankDetails ? {
    account_number: data.bankDetails.accountNumber || data.bankDetails.account_number,
    ifsc_code: data.bankDetails.ifsc || data.bankDetails.ifsc_code,
    bank_name: data.bankDetails.bankName || data.bankDetails.bank_name,
    account_holder_name: data.bankDetails.accountHolderName || data.bankDetails.account_holder_name,
  } : null);

  // 1. Validate against eligible withdrawal value
  const portfolio = await getInvestorPortfolio(investor_id);
  if (requested_amount <= 0) {
    throw new Error('Withdrawal amount must be greater than zero.');
  }
  if (requested_amount > portfolio.eligible_withdrawal_amount) {
    throw new Error(
      `Withdrawal amount of ₹${requested_amount.toLocaleString('en-IN')} exceeds the currently eligible amount of ₹${portfolio.eligible_withdrawal_amount.toLocaleString('en-IN')}.`
    );
  }

  // 2. Generate sequential withdrawal number
  const wdrNumber = await generateWithdrawalId();
  const now = new Date().toISOString();

  const wdrData: WithdrawalRequest = {
    id: wdrNumber,
    withdrawal_number: wdrNumber,
    withdrawalId: wdrNumber,
    investor_id,
    investor_number: portfolio.investor_number,
    investor_name: portfolio.investor_name,
    investor_phone: portfolio.investor_phone,
    requested_amount,
    requestedAmount: requested_amount,
    approved_amount: null,
    paid_amount: null,
    request_date: now.split('T')[0],
    bank_account_details,
    bankDetails: bank_account_details,
    reason: data.reason || null,
    status: 'Pending',
    admin_notes: null,
    created_at: now,
    updated_at: now,
  };

  await setDoc(doc(db, COLL_WITHDRAWALS, wdrNumber), wdrData);

  // Notify Admin
  await createNotification({
    recipient_id: 'admin_broadcast',
    type: 'Withdrawal_Submitted',
    title: 'New Investor Withdrawal Request',
    message: `Investor ${portfolio.investor_name} (${portfolio.investor_number}) requested withdrawal of ₹${requested_amount.toLocaleString('en-IN')}. Request ID: ${wdrNumber}.`,
    channel: 'In_App',
  });

  // Notify Investor
  await createNotification({
    recipient_id: investor_id,
    type: 'Withdrawal_Submitted',
    title: 'Withdrawal Request Submitted',
    message: `Your withdrawal request for ₹${requested_amount.toLocaleString('en-IN')} has been submitted successfully and is pending verification. Request ID: ${wdrNumber}.`,
    channel: 'In_App',
  });

  // Log Audit
  await logInvestmentAudit({
    actor_id: investor_id,
    action: 'WITHDRAWAL_REQUESTED',
    entity: 'withdrawal_requests',
    entity_id: wdrNumber,
    details: { requested_amount },
  });

  return wdrData;
}

export async function approveWithdrawalRequest(
  withdrawalId: string,
  approvedBy: string,
  adminNotes?: string
): Promise<void> {
  const wdrRef = doc(db, COLL_WITHDRAWALS, withdrawalId);
  const snap = await getDoc(wdrRef);
  if (!snap.exists()) throw new Error(`Withdrawal request ${withdrawalId} not found.`);
  const wdr = snap.data() as WithdrawalRequest;
  if (wdr.status !== 'Pending') {
    throw new Error(`Withdrawal request is already in status: ${wdr.status}`);
  }

  const now = new Date().toISOString();
  await updateDoc(wdrRef, {
    status: 'Payment_Processing',
    approved_amount: wdr.requested_amount,
    approval_date: now.split('T')[0],
    admin_notes: adminNotes || null,
    updated_at: now,
  });

  // Notify Investor
  await createNotification({
    recipient_id: wdr.investor_id,
    type: 'Withdrawal_Approved',
    title: 'Withdrawal Approved – Payment Processing',
    message: `Your withdrawal request ${wdr.withdrawal_number} for ₹${wdr.requested_amount.toLocaleString('en-IN')} has been approved and is under payment processing.`,
    channel: 'In_App',
  });

  // Log Audit
  await logInvestmentAudit({
    actor_id: approvedBy,
    action: 'WITHDRAWAL_APPROVED',
    entity: 'withdrawal_requests',
    entity_id: withdrawalId,
    details: { amount: wdr.requested_amount },
  });
}

export async function completeWithdrawalPayment(data: {
  withdrawal_id: string;
  paid_amount: number;
  payment_date: string;
  payment_mode: string;
  utr_number: string;
  admin_notes?: string;
  completed_by: string;
}): Promise<InvestmentTransaction> {
  const wdrRef = doc(db, COLL_WITHDRAWALS, data.withdrawal_id);

  return await runTransaction(db, async (txn) => {
    const wdrSnap = await txn.get(wdrRef);
    if (!wdrSnap.exists()) throw new Error(`Withdrawal ${data.withdrawal_id} not found.`);
    const wdr = wdrSnap.data() as WithdrawalRequest;

    if (wdr.status !== 'Payment_Processing' && wdr.status !== 'Pending') {
      throw new Error(`Withdrawal cannot be completed from status: ${wdr.status}`);
    }

    const now = new Date().toISOString();
    const txnId = await generateInvestmentTxnId();

    // Deduct from lots (FIFO basis)
    const lotsSnap = await getDocs(
      query(
        collection(db, COLL_LOTS),
        where('investor_id', '==', wdr.investor_id),
        where('status', 'in', ['Active', 'Partially_Withdrawn']),
        orderBy('investment_date', 'asc')
      )
    );

    let remainingToDeduct = data.paid_amount;
    for (const lotDoc of lotsSnap.docs) {
      if (remainingToDeduct <= 0) break;
      const lot = lotDoc.data() as InvestmentLot;
      const available = (lot.principal_amount || 0) - (lot.withdrawn_amount || 0);
      if (available <= 0) continue;

      const deduct = Math.min(available, remainingToDeduct);
      const newWithdrawn = (lot.withdrawn_amount || 0) + deduct;
      const newStatus = newWithdrawn >= lot.principal_amount ? 'Withdrawn' : 'Partially_Withdrawn';

      txn.update(lotDoc.ref, {
        withdrawn_amount: round2(newWithdrawn),
        status: newStatus,
        updated_at: now,
      });

      remainingToDeduct -= deduct;
    }

    // Update Withdrawal Request
    txn.update(wdrRef, {
      status: 'Completed',
      paid_amount: round2(data.paid_amount),
      payment_date: data.payment_date,
      payment_mode: data.payment_mode,
      utr_number: data.utr_number.trim(),
      admin_notes: data.admin_notes || wdr.admin_notes || null,
      updated_at: now,
    });

    // Create Investment Transaction
    const newTxn: InvestmentTransaction = {
      id: txnId,
      transaction_number: txnId,
      investor_id: wdr.investor_id,
      investor_number: wdr.investor_number,
      type: 'Withdrawal_Paid',
      amount: round2(data.paid_amount),
      rate: 0,
      payment_mode: data.payment_mode,
      utr_number: data.utr_number.trim(),
      transaction_reference: wdr.withdrawal_number,
      status: 'Completed',
      notes: `Withdrawal settlement for ${wdr.withdrawal_number}`,
      created_by: data.completed_by,
      approved_by: data.completed_by,
      transaction_date: data.payment_date,
      created_at: now,
    };
    txn.set(doc(db, COLL_TRANSACTIONS, txnId), newTxn);

    // Update Investment Account
    const acctRef = doc(db, COLL_ACCOUNTS, wdr.investor_id);
    const acctSnap = await txn.get(acctRef);
    if (acctSnap.exists()) {
      const acct = acctSnap.data() as InvestmentAccount;
      const newWithdrawn = (acct.total_withdrawn || 0) + data.paid_amount;
      const newCurrVal = Math.max(0, (acct.current_value || 0) - data.paid_amount);
      const newStatus = newCurrVal <= 0 ? 'Closed' : 'Active';

      txn.update(acctRef, {
        total_withdrawn: round2(newWithdrawn),
        current_value: round2(newCurrVal),
        status: newStatus,
        updated_at: now,
      });
    }

    return newTxn;
  }).then(async (txn) => {
    // Notify Investor
    await createNotification({
      recipient_id: txn.investor_id,
      type: 'Withdrawal_Completed',
      title: 'Withdrawal Payment Completed',
      message: `Your withdrawal payment of ₹${data.paid_amount.toLocaleString('en-IN')} has been completed. UTR: ${data.utr_number}. Reference: ${data.withdrawal_id}.`,
      channel: 'In_App',
    });

    // Log Audit
    await logInvestmentAudit({
      actor_id: data.completed_by,
      action: 'WITHDRAWAL_COMPLETED',
      entity: 'withdrawal_requests',
      entity_id: data.withdrawal_id,
      details: {
        paid_amount: data.paid_amount,
        utr: data.utr_number,
        mode: data.payment_mode,
      },
    });

    return txn;
  });
}

// ============================================================================
// 7. Admin Dashboard Metrics & Consolidated Reports
// ============================================================================

export async function getAdminInvestmentDashboardMetrics(): Promise<AdminInvestmentDashboardMetrics> {
  const [investorsSnap, lotsSnap, pendingPaySnap, pendingWdSnap, completedWdSnap] = await Promise.all([
    getDocs(query(collection(db, COLL_PROFILES), where('role', '==', 'Investor'))),
    getDocs(collection(db, COLL_LOTS)),
    getDocs(query(collection(db, COLL_PAYMENT_REQUESTS), where('status', '==', 'Pending_Verification'))),
    getDocs(query(collection(db, COLL_WITHDRAWALS), where('status', 'in', ['Pending', 'Payment_Processing']))),
    getDocs(query(collection(db, COLL_WITHDRAWALS), where('status', '==', 'Completed'))),
  ]);

  let totalCapital = 0;
  let totalCurrentVal = 0;
  let totalReturns = 0;
  let todayInvestments = 0;
  let todayWithdrawals = 0;

  const todayStr = new Date().toISOString().split('T')[0];

  lotsSnap.docs.forEach((d) => {
    const lot = d.data() as InvestmentLot;
    totalCapital += lot.principal_amount || 0;
    const calc = calculateLotReturns(lot);
    totalCurrentVal += calc.currentValue;
    totalReturns += calc.accruedReturn;

    if (lot.investment_date === todayStr) {
      todayInvestments += lot.principal_amount || 0;
    }
  });

  completedWdSnap.docs.forEach((d) => {
    const wd = d.data() as WithdrawalRequest;
    if (wd.payment_date === todayStr) {
      todayWithdrawals += wd.paid_amount || 0;
    }
  });

  const activeInvestors = investorsSnap.docs.filter((d) => d.data().status === 'Active').length;

  return {
    totalInvestors: investorsSnap.size,
    activeInvestors,
    totalInvestmentCapital: round2(totalCapital),
    totalCurrentPortfolioValue: round2(totalCurrentVal),
    totalReturns: round2(totalReturns),
    todayInvestments: round2(todayInvestments),
    todayWithdrawals: round2(todayWithdrawals),
    pendingInvestmentApprovals: pendingPaySnap.size,
    pendingWithdrawalRequests: pendingWdSnap.size,
    completedWithdrawals: completedWdSnap.size,
  };
}

export async function getInvestmentConsolidatedReport(
  startDateStr: string,
  endDateStr: string
): Promise<InvestmentConsolidatedItem[]> {
  const [txnsSnap, investorsSnap] = await Promise.all([
    getDocs(
      query(
        collection(db, COLL_TRANSACTIONS),
        where('transaction_date', '>=', startDateStr),
        where('transaction_date', '<=', endDateStr)
      )
    ),
    getDocs(query(collection(db, COLL_PROFILES), where('role', '==', 'Investor'))),
  ]);

  // Group by date
  const dateMap: Record<string, InvestmentConsolidatedItem> = {};

  txnsSnap.docs.forEach((d) => {
    const txn = d.data() as InvestmentTransaction;
    const date = txn.transaction_date;
    if (!dateMap[date]) {
      dateMap[date] = {
        date,
        newInvestorsCount: 0,
        investmentsAmount: 0,
        additionalFundsAmount: 0,
        withdrawalsAmount: 0,
        returnsAmount: 0,
        netPosition: 0,
      };
    }

    if (txn.type === 'Initial_Investment') {
      dateMap[date].investmentsAmount += txn.amount || 0;
    } else if (txn.type === 'Additional_Investment') {
      dateMap[date].additionalFundsAmount += txn.amount || 0;
    } else if (txn.type === 'Withdrawal_Paid') {
      dateMap[date].withdrawalsAmount += txn.amount || 0;
    } else if (txn.type === 'Return_Accrual') {
      dateMap[date].returnsAmount += txn.amount || 0;
    }
  });

  investorsSnap.docs.forEach((d) => {
    const prof = d.data() as Profile;
    const createdDate = (prof.created_at || '').split('T')[0];
    if (createdDate >= startDateStr && createdDate <= endDateStr) {
      if (!dateMap[createdDate]) {
        dateMap[createdDate] = {
          date: createdDate,
          newInvestorsCount: 0,
          investmentsAmount: 0,
          additionalFundsAmount: 0,
          withdrawalsAmount: 0,
          returnsAmount: 0,
          netPosition: 0,
        };
      }
      dateMap[createdDate].newInvestorsCount += 1;
    }
  });

  const list = Object.values(dateMap).map((item) => {
    item.investmentsAmount = round2(item.investmentsAmount);
    item.additionalFundsAmount = round2(item.additionalFundsAmount);
    item.withdrawalsAmount = round2(item.withdrawalsAmount);
    item.returnsAmount = round2(item.returnsAmount);
    item.netPosition = round2(
      item.investmentsAmount + item.additionalFundsAmount - item.withdrawalsAmount
    );
    return item;
  });

  list.sort((a, b) => b.date.localeCompare(a.date));
  return list;
}

// ============================================================================
// 8. Audit Logging
// ============================================================================

export async function logInvestmentAudit(data: {
  actor_id: string;
  action: string;
  entity: string;
  entity_id: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    const docRef = doc(collection(db, COLL_AUDIT));
    await setDoc(docRef, {
      ...data,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('[Investment Audit] Failed to record log:', err);
  }
}
