// src/lib/db/consolidated.ts
// Data access layer for Consolidated Daily Position reporting.
// Aggregates authoritative records from loans, payments, gold_collateral, bankRePledges, and branches.
// Strictly READ-ONLY — does not modify any financial ledger or transactional records.

import { db } from '@/lib/firebase';
import {
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  where,
} from 'firebase/firestore';
import type { Loan, Payment, GoldCollateral, BankRePledge, Branch } from '@/types/database';
import { getDailyPnL } from '@/lib/db/pnl';

export interface DailyPledgeItem {
  loanId: string;
  loanNumber: string;
  customerName: string;
  customerId?: string;
  customerPhone?: string;
  originationDate: string;
  principalAmount: number;
  netWeight: number;
  interestRateApr: number;
  branchId?: string;
  branchName?: string;
  createdBy?: string;
  status: string;
}

export interface DailyPledgeSummary {
  count: number;
  totalAmount: number;
  totalNetWeight: number;
  items: DailyPledgeItem[];
}

export interface DailyReleaseItem {
  loanId: string;
  loanNumber: string;
  customerName: string;
  customerId?: string;
  customerPhone?: string;
  releaseDate: string;
  settlementAmount: number;
  principalClosed: number;
  interestCollected: number;
  netWeight: number;
  releaseNumber?: string;
  branchId?: string;
  branchName?: string;
  staffName?: string;
}

export interface DailyReleaseSummary {
  count: number;
  totalSettlementAmount: number;
  totalPrincipalClosed: number;
  totalInterestCollected: number;
  totalNetWeight: number;
  items: DailyReleaseItem[];
}

export interface DailyPartPaymentItem {
  paymentId: string;
  receiptNumber: string;
  loanId: string;
  loanNumber: string;
  customerName: string;
  customerId?: string;
  paymentDate: string;
  totalAmount: number;
  principalPortion: number;
  interestPortion: number;
  penaltyAmount: number;
  waiverAmount: number;
  mode: string;
  branchId?: string;
  branchName?: string;
  collectedBy?: string;
}

export interface DailyPartPaymentSummary {
  uniqueLoansCount: number;
  totalPrincipalCollected: number;
  totalInterestCollected: number;
  totalAmountCollected: number;
  items: DailyPartPaymentItem[];
}

export interface CurrentPositionItem {
  loanId: string;
  loanNumber: string;
  customerName: string;
  customerId?: string;
  originationDate: string;
  maturityDate?: string;
  principalAmount: number;
  currentPrincipal: number;
  accruedInterest: number;
  penaltyDue: number;
  totalOutstanding: number;
  netWeight: number;
  status: string;
  branchId?: string;
  branchName?: string;
}

export interface CurrentPositionSummary {
  activePocketsCount: number;
  principalOutstanding: number;
  accruedInterest: number;
  penaltyOutstanding: number;
  totalOutstanding: number;
  totalGoldWeight: number;
  items: CurrentPositionItem[];
}

export interface RePledgePositionItem {
  repledgeId: string;
  repledgeNumber: string;
  customerName: string;
  customerLoanNumber: string;
  bankName: string;
  bankBranch: string;
  bankAccountNumber?: string;
  bankLoanNumber?: string;
  pledgeName?: string;
  pledgeDate: string;
  dueDate?: string;
  bankPledgeAmount: number;
  bankInterestRate: number;
  totalNetWeight: number;
  custodyLocation: string;
  status: string;
  branchId?: string;
  branchName?: string;
}

export interface RePledgePositionSummary {
  repledgePocketsCount: number;
  repledgeAmount: number;
  repledgeWeight: number;
  items: RePledgePositionItem[];
}

export interface ReconciliationWarning {
  type: 'NO_COLLATERAL' | 'RELEASED_ACTIVE_COLLATERAL' | 'REPLEDGE_SAFE_CUSTODY' | 'PRINCIPAL_EXCEEDED' | 'DISCREPANCY';
  severity: 'warning' | 'error' | 'info';
  message: string;
  entityId?: string;
  entityType?: string;
  details?: any;
}

export interface FinancialPositionSummary {
  todayIncome: number;
  todayExpenses: number;
  todayProfitLoss: number;
  isProfit: boolean;
}

export interface ConsolidatedDailyData {
  date: string; // YYYY-MM-DD
  branchId?: string;
  branchName: string;
  generatedAt: string;
  todayPledge: DailyPledgeSummary;
  todayRelease: DailyReleaseSummary;
  todayPartPayment: DailyPartPaymentSummary;
  currentPosition: CurrentPositionSummary;
  repledgePosition: RePledgePositionSummary;
  financialPosition: FinancialPositionSummary;
  reconciliation: {
    isReconciled: boolean;
    warnings: ReconciliationWarning[];
  };
}

/**
 * Helper to safely format amounts to 2 decimal financial numbers.
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
 * Compute the consolidated daily position across all authoritative collections.
 * Reads loans, payments, collateral, bankRePledges, and branches.
 */
export async function getConsolidatedDailyPosition(options: {
  date: string; // YYYY-MM-DD
  branchId?: string;
}): Promise<ConsolidatedDailyData> {
  const targetDate = options.date;
  const targetBranchId = options.branchId && options.branchId !== 'all' ? options.branchId : undefined;
  const now = new Date().toISOString();

  // 1. Fetch branches to resolve branch names
  const branchesMap = new Map<string, string>();
  try {
    const branchesSnap = await getDocs(collection(db, 'branches'));
    branchesSnap.docs.forEach((d) => {
      const data = d.data();
      branchesMap.set(d.id, data.name || data.code || 'Branch');
    });
  } catch (err) {
    console.warn('[Consolidated] Error fetching branches:', err);
  }

  const currentBranchName = targetBranchId
    ? branchesMap.get(targetBranchId) || 'Selected Branch'
    : 'All Branches (Consolidated)';

  // 2. Fetch Loans (with optional branch filter)
  let loansList: Loan[] = [];
  try {
    const loansCol = collection(db, 'loans');
    const loansQuery = targetBranchId
      ? query(loansCol, where('branch_id', '==', targetBranchId))
      : query(loansCol);
    const loansSnap = await getDocs(loansQuery);
    loansList = loansSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Loan));
  } catch (err) {
    console.error('[Consolidated] Error fetching loans:', err);
  }

  // 3. Fetch Collateral Items
  let collateralList: GoldCollateral[] = [];
  try {
    const colSnap = await getDocs(collection(db, 'gold_collateral'));
    collateralList = colSnap.docs.map((d) => ({ id: d.id, ...d.data() } as GoldCollateral));
  } catch (err) {
    console.error('[Consolidated] Error fetching collateral:', err);
  }

  // Map collateral by loan_id
  const collateralByLoan = new Map<string, GoldCollateral[]>();
  collateralList.forEach((c) => {
    if (c.loan_id) {
      const items = collateralByLoan.get(c.loan_id) || [];
      items.push(c);
      collateralByLoan.set(c.loan_id, items);
    }
  });

  // 4. Fetch Payments for the selected date
  let paymentsList: Payment[] = [];
  try {
    const paymentsCol = collection(db, 'payments');
    const paymentsSnap = await getDocs(paymentsCol);
    paymentsList = paymentsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Payment));
  } catch (err) {
    console.error('[Consolidated] Error fetching payments:', err);
  }

  // 5. Fetch Bank Re-Pledges
  let repledgesList: BankRePledge[] = [];
  try {
    const repSnap = await getDocs(collection(db, 'bankRePledges'));
    repledgesList = repSnap.docs.map((d) => ({ id: d.id, ...d.data() } as BankRePledge));
  } catch (err) {
    console.error('[Consolidated] Error fetching re-pledges:', err);
  }

  // -------------------------------------------------------------
  // SECTION 1: TODAY'S PLEDGE
  // -------------------------------------------------------------
  const todayPledgeItems: DailyPledgeItem[] = [];
  let todayPledgeAmount = 0;
  let todayPledgeWeight = 0;

  loansList.forEach((loan) => {
    const origDate = extractDatePart(loan.origination_date || loan.created_at);
    if (origDate === targetDate) {
      const loanCollateral = collateralByLoan.get(loan.id) || [];
      const netWeight = loanCollateral.reduce((sum, c) => sum + (c.net_weight || 0), 0);
      const principal = loan.principal_amount || 0;

      todayPledgeAmount += principal;
      todayPledgeWeight += netWeight;

      todayPledgeItems.push({
        loanId: loan.id,
        loanNumber: loan.loan_number,
        customerName: loan.customer_name || 'Customer',
        customerId: loan.customer_id,
        customerPhone: loan.customer_phone,
        originationDate: loan.origination_date || loan.created_at || targetDate,
        principalAmount: principal,
        netWeight: round2(netWeight),
        interestRateApr: loan.interest_rate_apr || 0,
        branchId: loan.branch_id || undefined,
        branchName: loan.branch_id ? branchesMap.get(loan.branch_id) : undefined,
        createdBy: (loan as any).created_by || undefined,
        status: loan.status,
      });
    }
  });

  const todayPledgeSummary: DailyPledgeSummary = {
    count: todayPledgeItems.length,
    totalAmount: round2(todayPledgeAmount),
    totalNetWeight: round2(todayPledgeWeight),
    items: todayPledgeItems,
  };

  // -------------------------------------------------------------
  // SECTION 2: TODAY'S RELEASE
  // -------------------------------------------------------------
  const todayReleaseItems: DailyReleaseItem[] = [];
  let totalSettlementAmount = 0;
  let totalPrincipalClosed = 0;
  let totalInterestCollected = 0;
  let totalReleaseWeight = 0;

  // Find loans closed/released on target date
  loansList.forEach((loan) => {
    const relDate = extractDatePart(loan.release_date || loan.closed_at);
    if (relDate === targetDate && loan.status === 'Settled') {
      const loanCollateral = collateralByLoan.get(loan.id) || [];
      const netWeight = loanCollateral.reduce((sum, c) => sum + (c.net_weight || 0), 0);

      // Find the settlement payment record for this loan
      const settlementPayment = paymentsList.find(
        (p) => p.loan_id === loan.id && (p.payment_type === 'Full_Settlement' || p.release_number)
      );

      const settlementAmt = settlementPayment?.amount_paid || loan.principal_amount || 0;
      const principalClosed = settlementPayment?.principal_portion || loan.principal_amount || 0;
      const interestCollected = settlementPayment?.interest_portion || loan.total_interest_paid || 0;

      totalSettlementAmount += settlementAmt;
      totalPrincipalClosed += principalClosed;
      totalInterestCollected += interestCollected;
      totalReleaseWeight += netWeight;

      todayReleaseItems.push({
        loanId: loan.id,
        loanNumber: loan.loan_number,
        customerName: loan.customer_name || 'Customer',
        customerId: loan.customer_id,
        customerPhone: loan.customer_phone,
        releaseDate: loan.release_date || loan.closed_at || targetDate,
        settlementAmount: round2(settlementAmt),
        principalClosed: round2(principalClosed),
        interestCollected: round2(interestCollected),
        netWeight: round2(netWeight),
        releaseNumber: loan.release_number || settlementPayment?.release_number || undefined,
        branchId: loan.branch_id || undefined,
        branchName: loan.branch_id ? branchesMap.get(loan.branch_id) : undefined,
        staffName: (settlementPayment as any)?.created_by_name || settlementPayment?.collected_by || 'Staff',
      });
    }
  });

  const todayReleaseSummary: DailyReleaseSummary = {
    count: todayReleaseItems.length,
    totalSettlementAmount: round2(totalSettlementAmount),
    totalPrincipalClosed: round2(totalPrincipalClosed),
    totalInterestCollected: round2(totalInterestCollected),
    totalNetWeight: round2(totalReleaseWeight),
    items: todayReleaseItems,
  };

  // -------------------------------------------------------------
  // SECTION 3: TODAY'S PART PAYMENT / PRINCIPAL PAYMENT
  // -------------------------------------------------------------
  // Filter payments on targetDate that have principal_portion > 0
  const loansMap = new Map<string, Loan>();
  loansList.forEach((l) => loansMap.set(l.id, l));

  const todayPartPaymentItems: DailyPartPaymentItem[] = [];
  const uniquePrincipalLoanIds = new Set<string>();
  let totalPrincipalCollected = 0;
  let totalPaymentInterest = 0;
  let totalPaymentAmount = 0;

  paymentsList.forEach((pmt) => {
    const pmtDate = extractDatePart(pmt.payment_date || (pmt as any).created_at);
    if (pmtDate === targetDate) {
      // Branch filter check
      const linkedLoan = pmt.loan_id ? loansMap.get(pmt.loan_id) : undefined;
      if (targetBranchId && linkedLoan && linkedLoan.branch_id !== targetBranchId) {
        return;
      }

      // Principal reduction rule: only count payments where principal_portion > 0
      const principalPart = pmt.principal_portion || 0;
      if (principalPart > 0) {
        if (pmt.loan_id) uniquePrincipalLoanIds.add(pmt.loan_id);
        totalPrincipalCollected += principalPart;
        totalPaymentInterest += pmt.interest_portion || 0;
        totalPaymentAmount += pmt.amount_paid || 0;

        todayPartPaymentItems.push({
          paymentId: pmt.id,
          receiptNumber: pmt.receipt_number || 'N/A',
          loanId: pmt.loan_id,
          loanNumber: linkedLoan?.loan_number || 'N/A',
          customerName: linkedLoan?.customer_name || 'Customer',
          customerId: pmt.customer_id || undefined,
          paymentDate: pmt.payment_date || (pmt as any).created_at || targetDate,
          totalAmount: round2(pmt.amount_paid || 0),
          principalPortion: round2(principalPart),
          interestPortion: round2(pmt.interest_portion || 0),
          penaltyAmount: round2(pmt.penalty_amount || 0),
          waiverAmount: round2(pmt.waiver_amount || 0),
          mode: pmt.mode || 'Cash',
          branchId: linkedLoan?.branch_id || undefined,
          branchName: linkedLoan?.branch_id ? branchesMap.get(linkedLoan.branch_id) : undefined,
          collectedBy: (pmt as any).created_by_name || pmt.collected_by || 'Staff',
        });
      }
    }
  });

  const todayPartPaymentSummary: DailyPartPaymentSummary = {
    uniqueLoansCount: uniquePrincipalLoanIds.size,
    totalPrincipalCollected: round2(totalPrincipalCollected),
    totalInterestCollected: round2(totalPaymentInterest),
    totalAmountCollected: round2(totalPaymentAmount),
    items: todayPartPaymentItems,
  };

  // -------------------------------------------------------------
  // SECTION 4: CURRENT POSITION (Active Open Loans)
  // -------------------------------------------------------------
  const activeStatuses = ['Active', 'Due', 'Overdue', 'Grace_Period'];
  const activeLoans = loansList.filter((l) => activeStatuses.includes(l.status));

  const currentPositionItems: CurrentPositionItem[] = [];
  let totalActivePrincipal = 0;
  let totalActiveInterest = 0;
  let totalActivePenalty = 0;
  let totalActiveOutstanding = 0;
  let totalActiveGoldWeight = 0;

  activeLoans.forEach((loan) => {
    const loanCollateral = collateralByLoan.get(loan.id) || [];
    // Only count collateral that is not released
    const activeCollateral = loanCollateral.filter(
      (c) => (c as any).status !== 'Released' && c.custody_location !== 'Released to Customer'
    );
    const netWeight = activeCollateral.reduce((sum, c) => sum + (c.net_weight || 0), 0);

    const principal = loan.principal_amount - (loan.total_principal_paid || 0);
    const accruedInterest = loan.outstanding_interest || 0;
    const penaltyDue = (loan as any).penalty_amount || 0;
    const totalOut = loan.total_outstanding || (principal + accruedInterest + penaltyDue);

    totalActivePrincipal += principal;
    totalActiveInterest += accruedInterest;
    totalActivePenalty += penaltyDue;
    totalActiveOutstanding += totalOut;
    totalActiveGoldWeight += netWeight;

    currentPositionItems.push({
      loanId: loan.id,
      loanNumber: loan.loan_number,
      customerName: loan.customer_name || 'Customer',
      customerId: loan.customer_id,
      originationDate: loan.origination_date || loan.created_at || 'N/A',
      maturityDate: loan.maturity_date || undefined,
      principalAmount: loan.principal_amount,
      currentPrincipal: round2(principal),
      accruedInterest: round2(accruedInterest),
      penaltyDue: round2(penaltyDue),
      totalOutstanding: round2(totalOut),
      netWeight: round2(netWeight),
      status: loan.status,
      branchId: loan.branch_id || undefined,
      branchName: loan.branch_id ? branchesMap.get(loan.branch_id) : undefined,
    });
  });

  const currentPositionSummary: CurrentPositionSummary = {
    activePocketsCount: activeLoans.length,
    principalOutstanding: round2(totalActivePrincipal),
    accruedInterest: round2(totalActiveInterest),
    penaltyOutstanding: round2(totalActivePenalty),
    totalOutstanding: round2(totalActiveOutstanding),
    totalGoldWeight: round2(totalActiveGoldWeight),
    items: currentPositionItems,
  };

  // -------------------------------------------------------------
  // SECTION 5: RE-PLEDGE POSITION
  // -------------------------------------------------------------
  const activeRepledgeStatuses = ['Active', 'Pledged with Bank', 'Pending Approval'];
  const filteredRepledges = repledgesList.filter((r) => {
    if (!activeRepledgeStatuses.includes(r.status)) return false;
    // Check branch if loan belongs to filtered branch
    if (targetBranchId) {
      const linkedLoan = r.loan_id ? loansMap.get(r.loan_id) : undefined;
      if (linkedLoan && linkedLoan.branch_id !== targetBranchId) return false;
    }
    return true;
  });

  const repledgeItems: RePledgePositionItem[] = [];
  let totalRepledgeAmount = 0;
  let totalRepledgeWeight = 0;

  filteredRepledges.forEach((rep) => {
    const amount = rep.bank_outstanding || rep.bank_pledge_amount || 0;
    const weight = rep.total_net_weight || 0;

    totalRepledgeAmount += amount;
    totalRepledgeWeight += weight;

    const linkedLoan = rep.loan_id ? loansMap.get(rep.loan_id) : undefined;

    repledgeItems.push({
      repledgeId: rep.id,
      repledgeNumber: rep.repledge_number,
      customerName: rep.customer_name || linkedLoan?.customer_name || 'Customer',
      customerLoanNumber: rep.loan_number || linkedLoan?.loan_number || 'N/A',
      bankName: rep.bank_name,
      bankBranch: rep.bank_branch,
      bankAccountNumber: rep.bank_account_number,
      bankLoanNumber: rep.bank_loan_number,
      pledgeName: rep.pledge_name,
      pledgeDate: rep.pledge_date || rep.created_at || 'N/A',
      dueDate: rep.due_date,
      bankPledgeAmount: rep.bank_pledge_amount,
      bankInterestRate: rep.bank_interest_rate,
      totalNetWeight: round2(weight),
      custodyLocation: rep.custody_location || 'Commercial Bank Branch',
      status: rep.status,
      branchId: linkedLoan?.branch_id || undefined,
      branchName: linkedLoan?.branch_id ? branchesMap.get(linkedLoan.branch_id) : undefined,
    });
  });

  const repledgePositionSummary: RePledgePositionSummary = {
    repledgePocketsCount: filteredRepledges.length,
    repledgeAmount: round2(totalRepledgeAmount),
    repledgeWeight: round2(totalRepledgeWeight),
    items: repledgeItems,
  };

  // -------------------------------------------------------------
  // SECTION 6: DATA RECONCILIATION & INTEGRITY ALERTS
  // -------------------------------------------------------------
  const warnings: ReconciliationWarning[] = [];

  // Check 1: Active loans with no collateral items
  activeLoans.forEach((loan) => {
    const col = collateralByLoan.get(loan.id) || [];
    if (col.length === 0) {
      warnings.push({
        type: 'NO_COLLATERAL',
        severity: 'warning',
        message: `Active loan ${loan.loan_number} (${loan.customer_name}) has no collateral ornaments recorded.`,
        entityId: loan.id,
        entityType: 'loans',
      });
    }
  });

  // Check 2: Re-pledged collateral showing PGF Safe custody
  filteredRepledges.forEach((rep) => {
    if (rep.status === 'Active' && rep.custody_location === 'PGF Safe') {
      warnings.push({
        type: 'REPLEDGE_SAFE_CUSTODY',
        severity: 'error',
        message: `Bank Re-Pledge ${rep.repledge_number} with ${rep.bank_name} is marked Active but shows PGF Safe custody.`,
        entityId: rep.id,
        entityType: 'bankRePledges',
      });
    }
  });

  // Check 3: Check if any payment's principal portion exceeded loan principal
  paymentsList.forEach((pmt) => {
    if (pmt.loan_id) {
      const l = loansMap.get(pmt.loan_id);
      if (l && (pmt.principal_portion || 0) > l.principal_amount) {
        warnings.push({
          type: 'PRINCIPAL_EXCEEDED',
          severity: 'error',
          message: `Payment ${pmt.receipt_number || pmt.id} on loan ${l.loan_number} has principal portion (₹${pmt.principal_portion}) exceeding loan amount (₹${l.principal_amount}).`,
          entityId: pmt.id,
          entityType: 'payments',
        });
      }
    }
  });

  // -------------------------------------------------------------
  // SECTION 7: FINANCIAL POSITION (Income, Expenses, Net Profit/Loss)
  // -------------------------------------------------------------
  let financialPosition: FinancialPositionSummary = {
    todayIncome: 0,
    todayExpenses: 0,
    todayProfitLoss: 0,
    isProfit: true,
  };
  try {
    const dailyPnL = await getDailyPnL({
      date: targetDate,
      branchId: targetBranchId,
    });
    financialPosition = {
      todayIncome: dailyPnL.summary.totalIncome,
      todayExpenses: dailyPnL.summary.totalExpenses,
      todayProfitLoss: dailyPnL.summary.netProfitLoss,
      isProfit: dailyPnL.summary.isProfit,
    };
  } catch (err) {
    console.warn('[Consolidated] Error fetching daily P&L for financial position:', err);
  }

  return {
    date: targetDate,
    branchId: targetBranchId,
    branchName: currentBranchName,
    generatedAt: now,
    todayPledge: todayPledgeSummary,
    todayRelease: todayReleaseSummary,
    todayPartPayment: todayPartPaymentSummary,
    currentPosition: currentPositionSummary,
    repledgePosition: repledgePositionSummary,
    financialPosition,
    reconciliation: {
      isReconciled: warnings.length === 0,
      warnings,
    },
  };
}
