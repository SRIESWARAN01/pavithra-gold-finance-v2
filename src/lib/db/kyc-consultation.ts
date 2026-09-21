// src/lib/db/kyc-consultation.ts
// Data access and calculation layer for KYC Consultation.
// Strictly READ-ONLY: aggregates customer profiles, loans, ornaments, payments, and bank re-pledges.

import { db } from '@/lib/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  limit,
} from 'firebase/firestore';
import type {
  Profile,
  Loan,
  GoldCollateral,
  Payment,
  BankRePledge,
  KYCConsultationData,
  CustomerPledgeHistoryItem,
  KYCOrnamentItem,
  KYCPaymentItem,
  KYCRePledgeInfo,
  CustomerLifetimeSummary,
} from '@/types/database';
import { logAuditAction } from '@/lib/db/audit';

/**
 * Safely format numbers to 2 decimal financial precision.
 */
function round2(val: number): number {
  return Math.round((Number(val) || 0) * 100) / 100;
}

/**
 * Extract date part (YYYY-MM-DD) from an ISO or standard date string.
 */
export function extractDatePart(dateStr?: string | null): string {
  if (!dateStr) return '';
  return dateStr.split('T')[0];
}

/**
 * Calculate the exact number of days a loan remained active.
 * - If Released: Number of Days = Release Date − Pledge Date
 * - If Active: Number of Days = Current Date − Pledge Date
 */
export function calculateDaysActive(
  pledgeDateStr: string,
  releaseDateStr?: string | null,
  asOfDateStr?: string
): {
  days: number;
  displayText: string;
  isReleased: boolean;
} {
  const pDatePart = extractDatePart(pledgeDateStr);
  if (!pDatePart) {
    return { days: 0, displayText: '0 Days', isReleased: false };
  }

  const pDate = new Date(pDatePart);
  const rDatePart = extractDatePart(releaseDateStr);
  const isReleased = Boolean(rDatePart);

  let targetDate: Date;
  if (isReleased) {
    targetDate = new Date(rDatePart);
  } else if (asOfDateStr) {
    targetDate = new Date(extractDatePart(asOfDateStr));
  } else {
    targetDate = new Date(new Date().toISOString().split('T')[0]);
  }

  const diffMs = targetDate.getTime() - pDate.getTime();
  const days = Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));

  return {
    days,
    displayText: isReleased ? `${days} Days` : `Active – ${days} Days`,
    isReleased,
  };
}

/**
 * Search customers for KYC consultation.
 * Supports:
 * 1. Mobile Number (e.g. "9876543210" or "+919876543210")
 * 2. Customer Unique ID (e.g. "PGF-CUST-000001" or "PGF-CUST-1042")
 * 3. Customer Name
 * Respects branch isolation.
 */
export async function searchCustomersForKYC(
  searchQuery: string,
  branchId?: string
): Promise<Profile[]> {
  const term = searchQuery.trim().toLowerCase();
  if (!term) return [];

  const cleanPhone = term.replace('+91', '').replace(/\s+/g, '');

  try {
    const q = query(collection(db, 'profiles'), limit(250));
    const snapshot = await getDocs(q);

    let profiles = snapshot.docs
      .map((d) => ({ id: d.id, ...d.data() } as Profile))
      .filter((p) => !p.deleted_at);

    // Apply branch isolation
    if (branchId && branchId !== 'all') {
      profiles = profiles.filter((p) => p.branch_id === branchId);
    }

    // Filter by phone, customer_number, or name
    const matches = profiles.filter((p) => {
      const name = (p.name || '').toLowerCase();
      const cnum = (p.customer_number || '').toLowerCase();
      const phone1 = (p.phone_primary || '').replace('+91', '').replace(/\s+/g, '');
      const phone2 = (p.phone_alt || '').replace('+91', '').replace(/\s+/g, '');

      return (
        (cleanPhone.length >= 4 && (phone1.includes(cleanPhone) || phone2.includes(cleanPhone))) ||
        cnum.includes(term) ||
        name.includes(term)
      );
    });

    // Exact matches first
    matches.sort((a, b) => {
      const aPhone = (a.phone_primary || '').replace('+91', '').replace(/\s+/g, '');
      const bPhone = (b.phone_primary || '').replace('+91', '').replace(/\s+/g, '');
      const aCnum = (a.customer_number || '').toLowerCase();
      const bCnum = (b.customer_number || '').toLowerCase();

      if (aPhone === cleanPhone && bPhone !== cleanPhone) return -1;
      if (bPhone === cleanPhone && aPhone !== cleanPhone) return 1;
      if (aCnum === term && bCnum !== term) return -1;
      if (bCnum === term && aCnum !== term) return 1;
      return (a.name || '').localeCompare(b.name || '');
    });

    return matches.slice(0, 15);
  } catch (err) {
    console.error('[KYC Consultation] Error searching customers:', err);
    return [];
  }
}

/**
 * Fetch the complete, comprehensive KYC consultation data for a single customer.
 * Aggregates:
 * - Profile & KYC information
 * - All historical and active loans
 * - All gold collateral items and photos
 * - Complete payment history
 * - Institutional bank re-pledge status
 * Strictly read-only.
 */
export async function getKYCConsultation(
  customerId: string,
  userBranchId?: string,
  asOfDate?: string
): Promise<KYCConsultationData> {
  const now = new Date().toISOString();

  // 1. Fetch Customer Profile
  const profileRef = doc(db, 'profiles', customerId);
  const profileSnap = await getDoc(profileRef);

  if (!profileSnap.exists()) {
    throw new Error(`Customer with ID "${customerId}" not found.`);
  }

  const customer = { id: profileSnap.id, ...profileSnap.data() } as Profile;

  // Branch isolation check
  if (userBranchId && userBranchId !== 'all' && customer.branch_id && customer.branch_id !== userBranchId) {
    throw new Error('Access denied: Customer belongs to another branch.');
  }

  // 2. Fetch Branches to resolve branch names
  const branchesMap = new Map<string, string>();
  try {
    const branchesSnap = await getDocs(collection(db, 'branches'));
    branchesSnap.docs.forEach((d) => {
      const data = d.data();
      branchesMap.set(d.id, data.name || data.code || 'Branch');
    });
  } catch (err) {
    console.warn('[KYC Consultation] Error fetching branches:', err);
  }

  // 3. Fetch all loans for this customer
  let loansList: Loan[] = [];
  try {
    const loansQ = query(
      collection(db, 'loans'),
      where('customer_id', '==', customerId)
    );
    const loansSnap = await getDocs(loansQ);
    loansList = loansSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Loan));
  } catch (err) {
    console.error('[KYC Consultation] Error fetching loans:', err);
  }

  // Filter loans by user branch if applicable
  if (userBranchId && userBranchId !== 'all') {
    loansList = loansList.filter((l) => !l.branch_id || l.branch_id === userBranchId);
  }

  // 4. Fetch all collateral items for this customer / loans
  let collateralList: GoldCollateral[] = [];
  try {
    // Try querying by customer_id
    const colSnap = await getDocs(
      query(collection(db, 'gold_collateral'), where('customer_id', '==', customerId))
    );
    collateralList = colSnap.docs.map((d) => ({ id: d.id, ...d.data() } as GoldCollateral));

    // If collateral records only store loan_id, also fetch by loan_ids
    if (collateralList.length === 0 && loansList.length > 0) {
      const loanIds = loansList.map((l) => l.id);
      const allColSnap = await getDocs(collection(db, 'gold_collateral'));
      collateralList = allColSnap.docs
        .map((d) => ({ id: d.id, ...d.data() } as GoldCollateral))
        .filter((c) => c.loan_id && loanIds.includes(c.loan_id));
    }
  } catch (err) {
    console.error('[KYC Consultation] Error fetching collateral:', err);
  }

  // Fetch photos for each collateral item
  const collateralByLoan = new Map<string, KYCOrnamentItem[]>();
  for (const c of collateralList) {
    let photos: Array<{ id: string; photo_url: string }> = [];
    try {
      const pSnap = await getDocs(
        query(collection(db, 'gold_photos'), where('collateral_id', '==', c.id))
      );
      photos = pSnap.docs.map((p) => ({ id: p.id, photo_url: p.data().photo_url }));
    } catch {
      photos = [];
    }

    const item: KYCOrnamentItem = {
      id: c.id,
      item_description: c.item_description || 'Gold Ornament',
      ornament_type: c.ornament_type || null,
      quantity: c.quantity || 1,
      gross_weight: round2(c.gross_weight || 0),
      stone_weight: round2(c.stone_weight || 0),
      net_weight: round2(c.net_weight || (c.gross_weight || 0) - (c.stone_weight || 0)),
      purity_karat: c.purity_karat || '22K',
      hallmark: c.hallmark || false,
      valuation_inr: c.valuation_inr || undefined,
      front_photo_url: c.front_photo_url || null,
      back_photo_url: c.back_photo_url || null,
      side_photo_url: c.side_photo_url || null,
      photos,
    };

    if (c.loan_id) {
      const items = collateralByLoan.get(c.loan_id) || [];
      items.push(item);
      collateralByLoan.set(c.loan_id, items);
    }
  }

  // 5. Fetch all payments for this customer / loans
  let paymentsList: Payment[] = [];
  try {
    const loanIds = new Set(loansList.map((l) => l.id));
    const pmtSnap = await getDocs(
      query(collection(db, 'payments'), where('customer_id', '==', customerId))
    );
    paymentsList = pmtSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Payment));

    if (paymentsList.length === 0 && loanIds.size > 0) {
      const allPmtSnap = await getDocs(collection(db, 'payments'));
      paymentsList = allPmtSnap.docs
        .map((d) => ({ id: d.id, ...d.data() } as Payment))
        .filter((p) => p.loan_id && loanIds.has(p.loan_id));
    }
  } catch (err) {
    console.error('[KYC Consultation] Error fetching payments:', err);
  }

  // Group payments by loan_id
  const paymentsByLoan = new Map<string, KYCPaymentItem[]>();
  paymentsList.forEach((p) => {
    if (!p.loan_id) return;
    const items = paymentsByLoan.get(p.loan_id) || [];
    items.push({
      id: p.id,
      payment_date: extractDatePart(p.payment_date || (p as any).created_at),
      receipt_number: p.receipt_number || 'N/A',
      amount_paid: round2(p.amount_paid || 0),
      interest_portion: round2(p.interest_portion || 0),
      principal_portion: round2(p.principal_portion || 0),
      penalty_amount: round2(p.penalty_amount || 0),
      waiver_amount: round2(p.waiver_amount || 0),
      remaining_principal: round2(p.principal_after_paise ? p.principal_after_paise / 100 : 0),
      mode: p.mode || 'Cash',
    });
    paymentsByLoan.set(p.loan_id, items);
  });

  // Sort payments by date
  paymentsByLoan.forEach((items) => {
    items.sort((a, b) => a.payment_date.localeCompare(b.payment_date));
  });

  // 6. Fetch Bank Re-Pledges
  let repledgesList: BankRePledge[] = [];
  try {
    const repSnap = await getDocs(collection(db, 'bankRePledges'));
    repledgesList = repSnap.docs.map((d) => ({ id: d.id, ...d.data() } as BankRePledge));
  } catch (err) {
    console.error('[KYC Consultation] Error fetching re-pledges:', err);
  }

  const repledgeByLoan = new Map<string, KYCRePledgeInfo>();
  repledgesList.forEach((r) => {
    if (r.loan_id && (r.status === 'Active' || r.status === 'Pledged with Bank')) {
      repledgeByLoan.set(r.loan_id, {
        repledge_id: r.id,
        repledge_number: r.repledge_number,
        bank_name: r.bank_name,
        bank_branch: r.bank_branch,
        bank_account_number: r.bank_account_number || undefined,
        bank_loan_number: r.bank_loan_number || undefined,
        bank_pledge_amount: round2(r.bank_pledge_amount || 0),
        bank_interest_rate: r.bank_interest_rate || 0,
        total_net_weight: round2(r.total_net_weight || 0),
        custody_location: r.custody_location || 'Commercial Bank Branch',
        pledge_date: extractDatePart(r.pledge_date || r.created_at),
        status: r.status,
      });
    }
  });

  // 7. Process each loan into CustomerPledgeHistoryItem
  const activeStatuses = ['Active', 'Due', 'Overdue', 'Grace_Period'];
  const pledgeHistory: CustomerPledgeHistoryItem[] = [];

  let totalHistoricalPledgeAmount = 0;
  let totalReleasesCount = 0;
  let activePocketsCount = 0;
  let totalActivePrincipal = 0;
  let totalActiveInterest = 0;
  let totalActivePenalty = 0;
  let totalActiveOutstanding = 0;
  let totalActiveGoldWeight = 0;

  loansList.forEach((loan) => {
    const pledgeDate = extractDatePart(loan.origination_date || loan.created_at);
    const releaseDate = loan.release_date
      ? extractDatePart(loan.release_date)
      : loan.status === 'Settled'
      ? extractDatePart(loan.closed_at || loan.updated_at)
      : null;

    const daysInfo = calculateDaysActive(pledgeDate, releaseDate, asOfDate);
    const principal = loan.principal_amount || 0;
    const principalPaid = loan.total_principal_paid || 0;
    const currentPrincipal = Math.max(0, principal - principalPaid);
    const accruedInterest = loan.outstanding_interest || 0;
    const penaltyDue = (loan as any).penalty_amount || 0;
    const totalOut = loan.total_outstanding || (currentPrincipal + accruedInterest + penaltyDue);

    const loanOrnaments = collateralByLoan.get(loan.id) || [];
    const totalGrossWeight = loanOrnaments.reduce((sum, o) => sum + o.gross_weight, 0);
    const totalStoneWeight = loanOrnaments.reduce((sum, o) => sum + o.stone_weight, 0);
    const totalNetWeight = loanOrnaments.reduce((sum, o) => sum + o.net_weight, 0);

    totalHistoricalPledgeAmount += principal;

    const isReleased = daysInfo.isReleased || loan.status === 'Settled';
    if (isReleased) {
      totalReleasesCount += 1;
    } else if (activeStatuses.includes(loan.status)) {
      activePocketsCount += 1;
      totalActivePrincipal += currentPrincipal;
      totalActiveInterest += accruedInterest;
      totalActivePenalty += penaltyDue;
      totalActiveOutstanding += totalOut;
      totalActiveGoldWeight += totalNetWeight;
    }

    pledgeHistory.push({
      loanId: loan.id,
      loanNumber: loan.loan_number,
      pledgeDate,
      originalPledgeAmount: round2(principal),
      releaseDate,
      daysActive: daysInfo.days,
      daysActiveText: daysInfo.displayText,
      status: loan.status,
      interestRateApr: loan.interest_rate_apr || 0,
      maturityDate: loan.maturity_date ? extractDatePart(loan.maturity_date) : null,
      principalPaid: round2(principalPaid),
      currentPrincipal: round2(currentPrincipal),
      interestOutstanding: round2(accruedInterest),
      penaltyOutstanding: round2(penaltyDue),
      totalOutstanding: round2(totalOut),
      ornamentsCount: loanOrnaments.length,
      totalNetWeight: round2(totalNetWeight),
      totalGrossWeight: round2(totalGrossWeight),
      totalStoneWeight: round2(totalStoneWeight),
      branchId: loan.branch_id || null,
      branchName: loan.branch_id ? branchesMap.get(loan.branch_id) : 'Main Branch',
      ornaments: loanOrnaments,
      payments: paymentsByLoan.get(loan.id) || [],
      repledge: repledgeByLoan.get(loan.id) || null,
    });
  });

  // Default sort: Pledge Date Ascending (oldest first)
  pledgeHistory.sort((a, b) => a.pledgeDate.localeCompare(b.pledgeDate));

  const summary: CustomerLifetimeSummary = {
    totalPledges: loansList.length,
    totalReleases: totalReleasesCount,
    totalHistoricalPledgeAmount: round2(totalHistoricalPledgeAmount),
    currentActivePledges: activePocketsCount,
    currentPrincipalOutstanding: round2(totalActivePrincipal),
    currentInterestOutstanding: round2(totalActiveInterest),
    currentPenaltyOutstanding: round2(totalActivePenalty),
    currentTotalOutstanding: round2(totalActiveOutstanding),
    currentActiveGoldWeight: round2(totalActiveGoldWeight),
  };

  // 8. Log audit entry
  try {
    await logAuditAction({
      actor_id: 'system',
      action_type: 'KYC_CONSULTATION_VIEWED',
      affected_entity: 'profiles',
      affected_entity_id: customerId,
      new_state: {
        customerNumber: customer.customer_number,
        totalPledges: summary.totalPledges,
        currentActivePledges: summary.currentActivePledges,
        currentOutstanding: summary.currentTotalOutstanding,
      },
    });
  } catch (err) {
    console.warn('[KYC Consultation] Audit log warning:', err);
  }

  return {
    customer,
    summary,
    pledgeHistory,
    generatedAt: now,
  };
}
