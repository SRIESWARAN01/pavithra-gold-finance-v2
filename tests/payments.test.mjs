// tests/payments.test.mjs
// Test suite for payment math, split calculations, and atomic allocation validation.

import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Mirror of calculatePaymentSplit logic for testing
 */
function calculatePaymentSplit(
  amount,
  outstandingInterest,
  remainingPrincipal,
  penaltyAmount = 0,
  waiverAmount = 0
) {
  if (amount < 0) amount = 0;
  if (penaltyAmount < 0) penaltyAmount = 0;
  if (waiverAmount < 0) waiverAmount = 0;

  const afterPenalty = Math.max(0, amount - penaltyAmount);
  const effectiveOutstandingInterest = Math.max(0, outstandingInterest - waiverAmount);
  const interestPortion = Math.min(afterPenalty, effectiveOutstandingInterest);
  const principalPortion = Math.max(0, afterPenalty - interestPortion);

  const newRemainingPrincipal = Math.max(0, remainingPrincipal - principalPortion);
  const newRemainingInterest = Math.max(0, effectiveOutstandingInterest - interestPortion);
  const newOutstanding = newRemainingPrincipal + newRemainingInterest;

  const isFullSettlement = newRemainingPrincipal === 0 && newRemainingInterest === 0;

  return {
    totalAmount: amount,
    interestPortion: Math.round(interestPortion * 100) / 100,
    principalPortion: Math.round(principalPortion * 100) / 100,
    remainingPrincipal: Math.round(newRemainingPrincipal * 100) / 100,
    remainingInterest: Math.round(newRemainingInterest * 100) / 100,
    newOutstanding: Math.round(newOutstanding * 100) / 100,
    isFullSettlement,
  };
}

/**
 * Validation logic matching recordPayment in payments.ts
 */
function validatePaymentAllocation(data, loan) {
  if (!Number.isFinite(data.amount_paid) || data.amount_paid <= 0) {
    throw new Error('Payment amount must be greater than zero.');
  }
  if (!Number.isFinite(data.interest_portion) || !Number.isFinite(data.principal_portion) || data.interest_portion < 0 || data.principal_portion < 0) {
    throw new Error('Payment portions cannot be negative.');
  }
  const penaltyAmount = data.penalty_amount || 0;
  const waiverAmount = data.waiver_amount || 0;
  if (!Number.isFinite(penaltyAmount) || !Number.isFinite(waiverAmount) || penaltyAmount < 0 || waiverAmount < 0) {
    throw new Error('Penalty and waiver amounts cannot be negative.');
  }
  const toPaise = (amount) => Math.round(amount * 100);
  if (toPaise(data.interest_portion) + toPaise(data.principal_portion) + toPaise(penaltyAmount) !== toPaise(data.amount_paid)) {
    throw new Error('Payment allocation must equal the amount received.');
  }

  if (['Settled', 'Cancelled', 'Auctioned'].includes(loan.status)) {
    throw new Error(`Cannot record payment on a ${loan.status} loan.`);
  }

  const totalPrincipalPaid = loan.total_principal_paid || 0;
  const remainingPrincipal = Math.max(0, (loan.principal_amount || 0) - totalPrincipalPaid);
  const outstandingInterest = Math.max(0, loan.outstanding_interest || 0);

  if (toPaise(data.principal_portion) > toPaise(remainingPrincipal)) {
    throw new Error('Principal payment exceeds the remaining principal balance.');
  }
  if (toPaise(data.interest_portion + waiverAmount) > toPaise(outstandingInterest)) {
    throw new Error('Interest payment and waiver exceed the outstanding interest balance.');
  }

  return true;
}

test('Payment Split: allocates interest first, then principal', () => {
  const split = calculatePaymentSplit(
    5000,    // amount
    1500,    // outstanding interest
    50000,   // remaining principal
    0,       // penalty
    0        // waiver
  );

  assert.strictEqual(split.interestPortion, 1500);
  assert.strictEqual(split.principalPortion, 3500);
  assert.strictEqual(split.remainingInterest, 0);
  assert.strictEqual(split.remainingPrincipal, 46500);
  assert.strictEqual(split.isFullSettlement, false);
});

test('Payment Split: deducts penalty prior to interest and principal', () => {
  const split = calculatePaymentSplit(
    5000,    // amount
    2000,    // interest
    40000,   // principal
    500,     // penalty
    0        // waiver
  );

  // after penalty (5000 - 500 = 4500):
  // interest takes 2000, principal takes 2500
  assert.strictEqual(split.interestPortion, 2000);
  assert.strictEqual(split.principalPortion, 2500);
  assert.strictEqual(split.remainingInterest, 0);
  assert.strictEqual(split.remainingPrincipal, 37500);
});

test('Payment Split: waiver reduces outstanding interest requirement', () => {
  const split = calculatePaymentSplit(
    2000,    // amount
    3000,    // interest
    50000,   // principal
    0,       // penalty
    1500     // waiver discount
  );

  // effective interest = 3000 - 1500 = 1500
  // payment clears 1500 interest, remaining 500 goes to principal
  assert.strictEqual(split.interestPortion, 1500);
  assert.strictEqual(split.principalPortion, 500);
  assert.strictEqual(split.remainingInterest, 0);
  assert.strictEqual(split.remainingPrincipal, 49500);
});

test('Payment Split: detects full settlement', () => {
  const split = calculatePaymentSplit(
    21000,   // amount
    1000,    // interest
    20000,   // principal
    0,
    0
  );

  assert.strictEqual(split.interestPortion, 1000);
  assert.strictEqual(split.principalPortion, 20000);
  assert.strictEqual(split.remainingPrincipal, 0);
  assert.strictEqual(split.remainingInterest, 0);
  assert.strictEqual(split.isFullSettlement, true);
});

test('Payment Validation: rejects mismatched allocation sum', () => {
  const loan = {
    principal_amount: 50000,
    total_principal_paid: 0,
    outstanding_interest: 2000,
    status: 'Active'
  };

  assert.throws(() => {
    validatePaymentAllocation({
      amount_paid: 5000,
      interest_portion: 2000,
      principal_portion: 2999, // sum is 4999 !== 5000
      penalty_amount: 0,
      waiver_amount: 0
    }, loan);
  }, /Payment allocation must equal the amount received/);
});

test('Payment Validation: rejects principal exceeding remaining principal', () => {
  const loan = {
    principal_amount: 50000,
    total_principal_paid: 45000, // remaining is 5000
    outstanding_interest: 500,
    status: 'Active'
  };

  assert.throws(() => {
    validatePaymentAllocation({
      amount_paid: 6500,
      interest_portion: 500,
      principal_portion: 6000, // exceeds remaining 5000
      penalty_amount: 0,
      waiver_amount: 0
    }, loan);
  }, /Principal payment exceeds the remaining principal balance/);
});

test('Payment Validation: rejects interest payment exceeding outstanding interest', () => {
  const loan = {
    principal_amount: 50000,
    total_principal_paid: 0,
    outstanding_interest: 1200,
    status: 'Active'
  };

  assert.throws(() => {
    validatePaymentAllocation({
      amount_paid: 2000,
      interest_portion: 1500, // exceeds 1200
      principal_portion: 500,
      penalty_amount: 0,
      waiver_amount: 0
    }, loan);
  }, /Interest payment and waiver exceed the outstanding interest balance/);
});

test('Payment Validation: rejects payments on Settled loan', () => {
  const loan = {
    principal_amount: 50000,
    total_principal_paid: 50000,
    outstanding_interest: 0,
    status: 'Settled'
  };

  assert.throws(() => {
    validatePaymentAllocation({
      amount_paid: 1000,
      interest_portion: 0,
      principal_portion: 1000,
      penalty_amount: 0,
      waiver_amount: 0
    }, loan);
  }, /Cannot record payment on a Settled loan/);
});
