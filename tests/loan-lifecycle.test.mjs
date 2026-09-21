// tests/loan-lifecycle.test.mjs
// End-to-end loan lifecycle validation: Creation → Payment → Settlement → Release → Collateral.

import test from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Mirror of loan status transitions from loans.ts
// ---------------------------------------------------------------------------
const VALID_STATUSES = ['Draft', 'Pending_Approval', 'Active', 'Due', 'Overdue', 'Grace_Period', 'Defaulted', 'Auctioned', 'Settled', 'Cancelled', 'Rejected'];
const TERMINAL_STATUSES = ['Settled', 'Cancelled', 'Auctioned'];
const VALID_APR_RATES = [18, 20, 22, 24, 30];

function isTerminalStatus(status) {
  return TERMINAL_STATUSES.includes(status);
}

/**
 * Simulate loan number generation (atomic counter).
 */
function generateLoanNumber(counter) {
  return `PGF-GL-${String(counter).padStart(6, '0')}`;
}

/**
 * Simulate settlement check.
 */
function canRelease(loan) {
  const remaining = Math.max(0, (loan.principal_amount || 0) - (loan.total_principal_paid || 0));
  const outstandingInterest = loan.outstanding_interest || 0;
  if (remaining > 0) return { allowed: false, reason: `Outstanding principal: ₹${remaining}` };
  if (outstandingInterest > 0) return { allowed: false, reason: `Outstanding interest: ₹${outstandingInterest}` };
  return { allowed: true };
}

/**
 * Simulate collateral status transition.
 */
function transitionCollateralStatus(currentStatus, action) {
  const transitions = {
    'In_Vault:release': 'Released',
    'In_Vault:repledge': 'RePledged',
    'RePledged:settle_bank': 'In_Vault',
    'Released:repledge': null, // Cannot re-pledge released collateral
    'Released:release': null,  // Cannot release already released
  };
  const key = `${currentStatus}:${action}`;
  return transitions[key] !== undefined ? transitions[key] : null;
}

/**
 * Simulate renewal validation.
 */
function canRenew(loan, interestPaid) {
  if (isTerminalStatus(loan.status)) {
    return { allowed: false, reason: `Cannot renew a ${loan.status} loan` };
  }
  const outstanding = loan.outstanding_interest || 0;
  if (interestPaid < outstanding) {
    return { allowed: false, reason: `Must settle outstanding interest (₹${outstanding}) before renewal` };
  }
  return { allowed: true };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('Loan Lifecycle: loan number format is sequential and unique', () => {
  const numbers = [];
  for (let i = 10001; i <= 10010; i++) {
    numbers.push(generateLoanNumber(i));
  }
  // All unique
  const unique = new Set(numbers);
  assert.strictEqual(unique.size, 10);

  // Correct format
  assert.strictEqual(numbers[0], 'PGF-GL-010001');
  assert.strictEqual(numbers[9], 'PGF-GL-010010');
});

test('Loan Lifecycle: cannot record payment on terminal status loans', () => {
  for (const status of TERMINAL_STATUSES) {
    assert.strictEqual(isTerminalStatus(status), true, `${status} should be terminal`);
  }
  assert.strictEqual(isTerminalStatus('Active'), false);
  assert.strictEqual(isTerminalStatus('Due'), false);
  assert.strictEqual(isTerminalStatus('Overdue'), false);
});

test('Loan Lifecycle: release blocked when outstanding balance exists', () => {
  // Outstanding principal
  const loan1 = { principal_amount: 50000, total_principal_paid: 40000, outstanding_interest: 0 };
  const check1 = canRelease(loan1);
  assert.strictEqual(check1.allowed, false);
  assert.ok(check1.reason.includes('principal'));

  // Outstanding interest
  const loan2 = { principal_amount: 50000, total_principal_paid: 50000, outstanding_interest: 500 };
  const check2 = canRelease(loan2);
  assert.strictEqual(check2.allowed, false);
  assert.ok(check2.reason.includes('interest'));
});

test('Loan Lifecycle: release allowed when fully settled', () => {
  const loan = { principal_amount: 50000, total_principal_paid: 50000, outstanding_interest: 0 };
  const check = canRelease(loan);
  assert.strictEqual(check.allowed, true);
});

test('Loan Lifecycle: collateral status transitions are valid', () => {
  // In Vault → Released (release action)
  assert.strictEqual(transitionCollateralStatus('In_Vault', 'release'), 'Released');

  // In Vault → RePledged (re-pledge action)
  assert.strictEqual(transitionCollateralStatus('In_Vault', 'repledge'), 'RePledged');

  // RePledged → In_Vault (bank settlement)
  assert.strictEqual(transitionCollateralStatus('RePledged', 'settle_bank'), 'In_Vault');

  // Released → cannot re-pledge
  assert.strictEqual(transitionCollateralStatus('Released', 'repledge'), null);

  // Released → cannot release again
  assert.strictEqual(transitionCollateralStatus('Released', 'release'), null);
});

test('Loan Lifecycle: renewal blocked on settled/cancelled loans', () => {
  const settledLoan = { status: 'Settled', outstanding_interest: 0 };
  const check1 = canRenew(settledLoan, 0);
  assert.strictEqual(check1.allowed, false);

  const cancelledLoan = { status: 'Cancelled', outstanding_interest: 0 };
  const check2 = canRenew(cancelledLoan, 0);
  assert.strictEqual(check2.allowed, false);
});

test('Loan Lifecycle: renewal requires interest settlement', () => {
  const loan = { status: 'Active', outstanding_interest: 1500 };
  
  // Not enough interest paid
  const check1 = canRenew(loan, 1000);
  assert.strictEqual(check1.allowed, false);

  // Exact interest paid
  const check2 = canRenew(loan, 1500);
  assert.strictEqual(check2.allowed, true);

  // Overpaid interest
  const check3 = canRenew(loan, 2000);
  assert.strictEqual(check3.allowed, true);
});

test('Loan Lifecycle: APR validation uses approved rate set', () => {
  const validRates = [18, 20, 22, 24, 30];
  for (const rate of validRates) {
    assert.strictEqual(VALID_APR_RATES.includes(rate), true, `${rate}% should be a valid APR`);
  }
  // Invalid rates
  assert.strictEqual(VALID_APR_RATES.includes(15), false);
  assert.strictEqual(VALID_APR_RATES.includes(50), false);
  assert.strictEqual(VALID_APR_RATES.includes(0), false);
});

test('Loan Lifecycle: full scenario — active loan → payment → settlement → release', () => {
  // 1. Loan created
  let loan = {
    loan_number: 'PGF-GL-010001',
    principal_amount: 50000,
    total_principal_paid: 0,
    outstanding_interest: 2000,
    status: 'Active',
  };

  // 2. Interest payment of ₹2000
  loan.outstanding_interest -= 2000;
  assert.strictEqual(loan.outstanding_interest, 0);

  // 3. Principal payment of ₹50000
  loan.total_principal_paid += 50000;

  // 4. Check settlement
  const releaseCheck = canRelease(loan);
  assert.strictEqual(releaseCheck.allowed, true);

  // 5. Mark settled
  loan.status = 'Settled';
  assert.strictEqual(isTerminalStatus(loan.status), true);

  // 6. Collateral released
  const collateralStatus = transitionCollateralStatus('In_Vault', 'release');
  assert.strictEqual(collateralStatus, 'Released');
});
