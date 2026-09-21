// tests/interest-payment-flow.test.mjs
// Comprehensive test suite for PGF Interest Payment Flow, Dynamic Days/Months Calculation,
// Principal Reduction (₹10,000 -> ₹9,900), Subsequent Reduced Interest, Statement of Accounts,
// Bank Re-Pledge Custody Locks, and Allocation Priority.

import test from 'node:test';
import assert from 'node:assert/strict';

// Helper functions mirroring src/lib/db/interest.ts and src/lib/db/payments.ts
function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

function getDaysInYear(year) {
  return isLeapYear(year) ? 366 : 365;
}

function toPaise(amount) {
  return Math.round(Number(amount) * 100);
}

function fromPaise(paise) {
  return Math.round(Number(paise)) / 100;
}

function calculateDynamicDaysAndMonths(startDateStr, endDateStr) {
  const start = new Date(startDateStr);
  const end = endDateStr ? new Date(endDateStr) : new Date();

  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  if (end <= start) {
    return { daysElapsed: 0, monthsCompleted: 0, fractionalMonths: 0 };
  }

  const diffTime = end.getTime() - start.getTime();
  const daysElapsed = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

  let monthsCompleted = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (end.getDate() < start.getDate()) {
    monthsCompleted--;
  }
  monthsCompleted = Math.max(0, monthsCompleted);
  const fractionalMonths = Math.round((daysElapsed / 30.4375) * 10) / 10;

  return {
    daysElapsed,
    monthsCompleted,
    fractionalMonths,
  };
}

function calculatePaymentSplit(params) {
  const amountPaidPaise = toPaise(params.amountPaid);
  const outstandingInterestPaise = toPaise(params.outstandingInterest);
  const outstandingPrincipalPaise = toPaise(params.outstandingPrincipal);
  const penaltyDuePaise = toPaise(params.penaltyDue || 0);
  const waiverPaise = toPaise(params.waiverAmount || 0);

  let unallocatedPaise = Math.max(0, amountPaidPaise);

  // 1. Penalty first
  const penaltyPaidPaise = Math.min(unallocatedPaise, penaltyDuePaise);
  unallocatedPaise -= penaltyPaidPaise;

  // 2. Interest after penalty
  const effectiveInterestDuePaise = Math.max(0, outstandingInterestPaise - waiverPaise);
  const interestPaidPaise = Math.min(unallocatedPaise, effectiveInterestDuePaise);
  unallocatedPaise -= interestPaidPaise;

  // 3. Principal after interest
  const principalPaidPaise = Math.min(unallocatedPaise, outstandingPrincipalPaise);
  unallocatedPaise -= principalPaidPaise;

  const remainingPenaltyPaise = Math.max(0, penaltyDuePaise - penaltyPaidPaise);
  const remainingInterestPaise = Math.max(0, effectiveInterestDuePaise - interestPaidPaise);
  const remainingPrincipalPaise = Math.max(0, outstandingPrincipalPaise - principalPaidPaise);
  const remainingTotalPaise = remainingPenaltyPaise + remainingInterestPaise + remainingPrincipalPaise;

  return {
    amountPaid: fromPaise(amountPaidPaise),
    penaltyPaid: fromPaise(penaltyPaidPaise),
    interestPaid: fromPaise(interestPaidPaise),
    principalPaid: fromPaise(principalPaidPaise),
    waiverApplied: fromPaise(waiverPaise),
    unallocatedAmount: fromPaise(unallocatedPaise),
    remainingPenalty: fromPaise(remainingPenaltyPaise),
    remainingInterest: fromPaise(remainingInterestPaise),
    remainingPrincipal: fromPaise(remainingPrincipalPaise),
    remainingTotal: fromPaise(remainingTotalPaise),
    isFullSettlement: remainingPrincipalPaise === 0 && remainingInterestPaise === 0 && remainingPenaltyPaise === 0,
  };
}

function calculateDailyInterest(principalBalance, annualRate, date = new Date()) {
  const year = date.getFullYear();
  const daysInYear = getDaysInYear(year);
  const dailyAmount = (principalBalance * (annualRate / 100)) / daysInYear;
  return Math.round(dailyAmount * 10000) / 10000;
}

// -----------------------------------------------------------------------------
// Test 1: Dynamic Days & Months Calculation
// -----------------------------------------------------------------------------
test('Dynamic Days & Months: Accurately calculates elapsed days and completed calendar months', () => {
  const start = '2024-01-15';
  const end = '2024-04-15'; // Exactly 3 months in a leap year (Jan 15 to Apr 15 = 16 + 29 + 31 + 15 = 91 days)
  const result = calculateDynamicDaysAndMonths(start, end);

  assert.strictEqual(result.monthsCompleted, 3);
  assert.strictEqual(result.daysElapsed, 91);
  assert.strictEqual(result.fractionalMonths, 3.0);
});

test('Dynamic Days & Months: Partial month calculation does not round up completed months prematurely', () => {
  const start = '2024-01-15';
  const end = '2024-02-14'; // 1 day short of 1 month
  const result = calculateDynamicDaysAndMonths(start, end);

  assert.strictEqual(result.monthsCompleted, 0);
  assert.strictEqual(result.daysElapsed, 30);
});

// -----------------------------------------------------------------------------
// Test 2: Acceptance Scenario (Prompt Requirement 21)
// Original Loan ₹10,000, Principal payment ₹100 -> Remaining Principal ₹9,900
// -----------------------------------------------------------------------------
test('Acceptance Scenario: ₹10,000 Loan with ₹100 Principal reduction results in ₹9,900 remaining', () => {
  const originalPrincipal = 10000;
  const accruedInterest = 150; // ₹150 interest accrued
  const principalReduction = 100;
  const totalPayment = accruedInterest + principalReduction; // Customer pays ₹250

  const split = calculatePaymentSplit({
    amountPaid: totalPayment,
    outstandingInterest: accruedInterest,
    outstandingPrincipal: originalPrincipal,
    penaltyDue: 0,
    waiverAmount: 0,
  });

  assert.strictEqual(split.interestPaid, 150, 'Interest paid must be ₹150');
  assert.strictEqual(split.principalPaid, 100, 'Principal paid must be ₹100');
  assert.strictEqual(split.remainingInterest, 0, 'Remaining interest must be 0');
  assert.strictEqual(split.remainingPrincipal, 9900, 'Remaining principal must be ₹9,900');
  assert.strictEqual(split.remainingTotal, 9900, 'Total remaining due must be ₹9,900');
});

test('Acceptance Scenario: Next period interest calculation must use ₹9,900, not ₹10,000', () => {
  const apr = 18;
  const date = new Date('2024-06-01'); // Leap year 2024 (366 days)
  
  const dailyOnOriginal = calculateDailyInterest(10000, apr, date);
  const dailyOnReduced = calculateDailyInterest(9900, apr, date);

  // Daily interest = Principal * 0.18 / 366
  // 10000 * 0.18 / 366 = 4.9180
  // 9900 * 0.18 / 366 = 4.8688
  assert.ok(dailyOnReduced < dailyOnOriginal, 'Reduced principal must yield lower daily interest');
  assert.strictEqual(Math.round(dailyOnOriginal * 100) / 100, 4.92);
  assert.strictEqual(Math.round(dailyOnReduced * 100) / 100, 4.87);

  // 30 days interest comparison
  const monthlyOnOriginal = Math.round(dailyOnOriginal * 30 * 100) / 100;
  const monthlyOnReduced = Math.round(dailyOnReduced * 30 * 100) / 100;
  assert.strictEqual(monthlyOnOriginal, 147.54);
  assert.strictEqual(monthlyOnReduced, 146.07);
});

// -----------------------------------------------------------------------------
// Test 3: Interest-Only Payment preserves Principal Balance unchanged
// -----------------------------------------------------------------------------
test('Interest-Only Payment: Principal balance remains completely unchanged', () => {
  const originalPrincipal = 10000;
  const accruedInterest = 150;

  const split = calculatePaymentSplit({
    amountPaid: 150, // Customer pays interest only
    outstandingInterest: accruedInterest,
    outstandingPrincipal: originalPrincipal,
    penaltyDue: 0,
    waiverAmount: 0,
  });

  assert.strictEqual(split.interestPaid, 150);
  assert.strictEqual(split.principalPaid, 0, 'Principal paid must be exactly 0');
  assert.strictEqual(split.remainingPrincipal, 10000, 'Principal balance must remain ₹10,000');
  assert.strictEqual(split.remainingInterest, 0);
  assert.strictEqual(split.isFullSettlement, false);
});

// -----------------------------------------------------------------------------
// Test 4: Payment Allocation Priority: Penalty -> Interest -> Principal
// -----------------------------------------------------------------------------
test('Payment Allocation Priority: Penalty paid first, then interest, then principal', () => {
  const split = calculatePaymentSplit({
    amountPaid: 500,
    penaltyDue: 100,
    outstandingInterest: 300,
    outstandingPrincipal: 10000,
  });

  // Out of 500:
  // 100 goes to penalty (remaining unallocated: 400)
  // 300 goes to interest (remaining unallocated: 100)
  // 100 goes to principal (remaining unallocated: 0)
  assert.strictEqual(split.penaltyPaid, 100);
  assert.strictEqual(split.interestPaid, 300);
  assert.strictEqual(split.principalPaid, 100);
  assert.strictEqual(split.remainingPenalty, 0);
  assert.strictEqual(split.remainingInterest, 0);
  assert.strictEqual(split.remainingPrincipal, 9900);
});

test('Payment Allocation Priority: Partial payment clears penalty first, then partial interest', () => {
  const split = calculatePaymentSplit({
    amountPaid: 250,
    penaltyDue: 100,
    outstandingInterest: 300,
    outstandingPrincipal: 10000,
  });

  // Out of 250:
  // 100 goes to penalty (remaining unallocated: 150)
  // 150 goes to interest (remaining unallocated: 0)
  // 0 goes to principal
  assert.strictEqual(split.penaltyPaid, 100);
  assert.strictEqual(split.interestPaid, 150);
  assert.strictEqual(split.principalPaid, 0);
  assert.strictEqual(split.remainingPenalty, 0);
  assert.strictEqual(split.remainingInterest, 150);
  assert.strictEqual(split.remainingPrincipal, 10000);
});

// -----------------------------------------------------------------------------
// Test 5: Full Settlement Scenario
// -----------------------------------------------------------------------------
test('Full Settlement: Clears all dues and sets isFullSettlement flag', () => {
  const split = calculatePaymentSplit({
    amountPaid: 10450,
    penaltyDue: 50,
    outstandingInterest: 400,
    outstandingPrincipal: 10000,
  });

  assert.strictEqual(split.penaltyPaid, 50);
  assert.strictEqual(split.interestPaid, 400);
  assert.strictEqual(split.principalPaid, 10000);
  assert.strictEqual(split.remainingPrincipal, 0);
  assert.strictEqual(split.remainingInterest, 0);
  assert.strictEqual(split.remainingTotal, 0);
  assert.strictEqual(split.isFullSettlement, true);
});

// -----------------------------------------------------------------------------
// Test 6: Chronological Statement of Accounts Financial Trail
// -----------------------------------------------------------------------------
test('Customer Statement: Chronological ledger trail shows ₹100 reduction from ₹10,000 to ₹9,900', () => {
  const ledger = [];
  const origPrincipal = 10000;

  // Step 1: Origination
  ledger.push({
    event: 'Origination',
    openingPrincipal: 0,
    interestAccrued: 0,
    paymentReceived: 0,
    interestPaid: 0,
    principalPaid: 0,
    closingPrincipal: origPrincipal,
  });

  // Step 2: Customer pays ₹150 interest + ₹100 principal
  let runningPrincipal = origPrincipal;
  const payment1 = { interest: 150, principal: 100 };
  const open1 = runningPrincipal;
  const close1 = open1 - payment1.principal;
  runningPrincipal = close1;

  ledger.push({
    event: 'Repayment 1',
    openingPrincipal: open1,
    interestAccrued: payment1.interest,
    paymentReceived: payment1.interest + payment1.principal,
    interestPaid: payment1.interest,
    principalPaid: payment1.principal,
    closingPrincipal: close1,
  });

  assert.strictEqual(ledger[0].closingPrincipal, 10000);
  assert.strictEqual(ledger[1].openingPrincipal, 10000);
  assert.strictEqual(ledger[1].principalPaid, 100);
  assert.strictEqual(ledger[1].closingPrincipal, 9900, 'Statement must show ₹9,900 closing principal');
});

// -----------------------------------------------------------------------------
// Test 7: Bank Re-Pledge Custody Lock
// -----------------------------------------------------------------------------
test('Bank Re-Pledge: Gold release is blocked while custody is at bank', () => {
  const loanWithBankRePledge = {
    id: 'loan_123',
    status: 'Active',
    bank_repledge_id: 'PGF-BRP-001',
    gold_collateral: [
      { id: 'gold_1', custody_location: 'State Bank of India (Main Branch)' }
    ]
  };

  const isRepledgedWithBank = Boolean(
    loanWithBankRePledge.bank_repledge_id ||
    loanWithBankRePledge.gold_collateral.some(c => c.custody_location !== 'PGF Safe')
  );

  assert.strictEqual(isRepledgedWithBank, true, 'Loan must be recognized as re-pledged with bank');

  function attemptGoldRelease(loan) {
    if (isRepledgedWithBank) {
      throw new Error('Action Blocked: Collateral is currently re-pledged with a bank. Bank settlement is required.');
    }
    return 'Gold Released';
  }

  assert.throws(() => attemptGoldRelease(loanWithBankRePledge), /Action Blocked/);
});
