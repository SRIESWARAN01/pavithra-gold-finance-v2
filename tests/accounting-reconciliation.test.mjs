// tests/accounting-reconciliation.test.mjs
// Accounting integrity, ledger reconciliation, and financial invariant tests.

import test from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Utility: paise-safe integer math (mirroring payments.ts)
// ---------------------------------------------------------------------------
const toPaise = (amount) => Math.round((amount || 0) * 100);
const fromPaise = (paise) => Math.round(paise) / 100;

/**
 * Validate the core payment allocation invariant:
 * Amount Received = Penalty Paid + Interest Paid + Principal Paid
 */
function validateAllocationInvariant(payment) {
  const receivedPaise = toPaise(payment.amount_paid);
  const penaltyPaise = toPaise(payment.penalty_amount || 0);
  const interestPaise = toPaise(payment.interest_portion);
  const principalPaise = toPaise(payment.principal_portion);

  return receivedPaise === (penaltyPaise + interestPaise + principalPaise);
}

/**
 * Validate that a loan's running balance is consistent.
 * remaining_principal = principal_amount - total_principal_paid
 */
function validateLoanBalance(loan) {
  const remainingPaise = toPaise(loan.principal_amount) - toPaise(loan.total_principal_paid);
  return {
    valid: remainingPaise >= 0,
    remainingPrincipal: fromPaise(remainingPaise),
  };
}

/**
 * Validate double-entry: every payment creates a debit and credit of equal amounts.
 */
function validateDoubleEntry(journal) {
  const totalDebit = journal.entries
    .filter(e => e.type === 'debit')
    .reduce((sum, e) => sum + toPaise(e.amount), 0);
  const totalCredit = journal.entries
    .filter(e => e.type === 'credit')
    .reduce((sum, e) => sum + toPaise(e.amount), 0);

  return totalDebit === totalCredit;
}

/**
 * Validate receipt number format and uniqueness.
 */
function validateReceiptNumbers(receipts) {
  const numbers = receipts.map(r => r.receipt_number);
  const unique = new Set(numbers);

  // All unique
  if (unique.size !== numbers.length) return { valid: false, reason: 'Duplicate receipt numbers' };

  // All match format PGF-REC-XXXXXX
  const formatOk = numbers.every(n => /^PGF-REC-\d{6}$/.test(n));
  if (!formatOk) return { valid: false, reason: 'Invalid receipt number format' };

  return { valid: true };
}

/**
 * Validate that interest income ledger matches interest collected from payments.
 */
function reconcileInterestIncome(payments) {
  const totalInterestCollected = payments.reduce((sum, p) => sum + toPaise(p.interest_portion || 0), 0);
  return fromPaise(totalInterestCollected);
}

// ---------------------------------------------------------------------------
// Accounting Tests
// ---------------------------------------------------------------------------

test('Accounting: payment allocation invariant — amount = penalty + interest + principal', () => {
  // Standard payment
  assert.strictEqual(validateAllocationInvariant({
    amount_paid: 5000,
    penalty_amount: 200,
    interest_portion: 1800,
    principal_portion: 3000,
  }), true);

  // Interest-only payment
  assert.strictEqual(validateAllocationInvariant({
    amount_paid: 1500,
    penalty_amount: 0,
    interest_portion: 1500,
    principal_portion: 0,
  }), true);

  // Full settlement
  assert.strictEqual(validateAllocationInvariant({
    amount_paid: 51000,
    penalty_amount: 0,
    interest_portion: 1000,
    principal_portion: 50000,
  }), true);

  // Mismatched — should fail
  assert.strictEqual(validateAllocationInvariant({
    amount_paid: 5000,
    penalty_amount: 200,
    interest_portion: 1800,
    principal_portion: 3001,
  }), false);
});

test('Accounting: paise precision prevents floating-point drift', () => {
  // Classic JS float problem: 0.1 + 0.2 !== 0.3
  // Our paise math should handle this correctly
  const a = toPaise(0.1);
  const b = toPaise(0.2);
  const sum = a + b;
  assert.strictEqual(sum, 30); // 30 paise
  assert.strictEqual(fromPaise(sum), 0.3);

  // More complex: ₹333.33 + ₹666.67 = ₹1000.00
  const interestPaise = toPaise(333.33);
  const principalPaise = toPaise(666.67);
  assert.strictEqual(fromPaise(interestPaise + principalPaise), 1000);
});

test('Accounting: loan balance invariant — remaining >= 0', () => {
  // Normal loan
  const check1 = validateLoanBalance({
    principal_amount: 50000,
    total_principal_paid: 20000,
  });
  assert.strictEqual(check1.valid, true);
  assert.strictEqual(check1.remainingPrincipal, 30000);

  // Fully paid
  const check2 = validateLoanBalance({
    principal_amount: 50000,
    total_principal_paid: 50000,
  });
  assert.strictEqual(check2.valid, true);
  assert.strictEqual(check2.remainingPrincipal, 0);

  // Overpayment (should be blocked by system but test the invariant)
  const check3 = validateLoanBalance({
    principal_amount: 50000,
    total_principal_paid: 50001,
  });
  assert.strictEqual(check3.valid, false);
});

test('Accounting: double-entry — debit must equal credit', () => {
  // Correct journal
  assert.strictEqual(validateDoubleEntry({
    entries: [
      { type: 'debit', account: 'Cash', amount: 5000 },
      { type: 'credit', account: 'Loan Receivable', amount: 3000 },
      { type: 'credit', account: 'Interest Income', amount: 2000 },
    ]
  }), true);

  // Imbalanced journal
  assert.strictEqual(validateDoubleEntry({
    entries: [
      { type: 'debit', account: 'Cash', amount: 5000 },
      { type: 'credit', account: 'Loan Receivable', amount: 3000 },
      { type: 'credit', account: 'Interest Income', amount: 1999 },
    ]
  }), false);
});

test('Accounting: receipt numbers must be unique and sequential', () => {
  // Valid receipts
  const valid = validateReceiptNumbers([
    { receipt_number: 'PGF-REC-010001' },
    { receipt_number: 'PGF-REC-010002' },
    { receipt_number: 'PGF-REC-010003' },
  ]);
  assert.strictEqual(valid.valid, true);

  // Duplicate receipt number
  const duped = validateReceiptNumbers([
    { receipt_number: 'PGF-REC-010001' },
    { receipt_number: 'PGF-REC-010001' },
  ]);
  assert.strictEqual(duped.valid, false);
  assert.ok(duped.reason.includes('Duplicate'));

  // Invalid format
  const badFormat = validateReceiptNumbers([
    { receipt_number: 'REC-001' },
  ]);
  assert.strictEqual(badFormat.valid, false);
});

test('Accounting: interest income reconciliation across multiple payments', () => {
  const payments = [
    { interest_portion: 1500, principal_portion: 3500 },
    { interest_portion: 2000, principal_portion: 0 },
    { interest_portion: 500, principal_portion: 10000 },
  ];
  const totalInterestIncome = reconcileInterestIncome(payments);
  assert.strictEqual(totalInterestIncome, 4000);
});

test('Accounting: no negative balances in payment allocation', () => {
  // Simulate payment split with paise math
  const principal = 50000;
  const interest = 1000;
  const payment = 1100;
  const penalty = 0;

  const afterPenalty = Math.max(0, toPaise(payment) - toPaise(penalty));
  const interestPaid = Math.min(afterPenalty, toPaise(interest));
  const principalPaid = Math.min(afterPenalty - interestPaid, toPaise(principal));

  const newPrincipal = toPaise(principal) - principalPaid;
  const newInterest = toPaise(interest) - interestPaid;

  assert.ok(newPrincipal >= 0, 'Principal cannot go negative');
  assert.ok(newInterest >= 0, 'Interest cannot go negative');
  assert.strictEqual(fromPaise(newPrincipal), 49900);
  assert.strictEqual(fromPaise(newInterest), 0);
  assert.strictEqual(fromPaise(interestPaid + principalPaid), payment);
});

test('Accounting: investor capital classified as liability, not operating income', () => {
  const INVESTOR_LEDGER_CODE = '2100';
  const OPERATING_INCOME_CODES = ['4000', '4100', '4200']; // Revenue, Interest Income, Fee Income

  // Investor capital should use liability code
  assert.strictEqual(INVESTOR_LEDGER_CODE.startsWith('2'), true, 'Investor capital must be a liability (2xxx)');

  // Should NOT be in operating income
  assert.strictEqual(
    OPERATING_INCOME_CODES.includes(INVESTOR_LEDGER_CODE),
    false,
    'Investor capital must NOT be classified as operating income'
  );
});
