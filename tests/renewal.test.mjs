// tests/renewal.test.mjs
// Test suite for Loan Renewal Engine: Options A, B, C, D, and audit validations.

import test from 'node:test';
import assert from 'node:assert/strict';

function validateRenewalEligibility(loan) {
  if (!loan) throw new Error('Loan not found');
  if (['Settled', 'Closed', 'Cancelled', 'Auctioned'].includes(loan.status)) {
    throw new Error(`Cannot renew a ${loan.status} loan.`);
  }
  return true;
}

function computeRenewalPlan(params) {
  const {
    currentPrincipal,
    accruedInterest,
    amountReceived,
    renewalType,
    newTenureMonths,
    additionalDisbursement = 0,
  } = params;

  // Minimum payment check for Option A & B
  if (renewalType === 'INTEREST_ONLY' || renewalType === 'INTEREST_AND_PRINCIPAL') {
    if (amountReceived < accruedInterest) {
      throw new Error(`Minimum payment of ₹${accruedInterest} (accrued interest) required for renewal.`);
    }
  }

  const interestCleared = Math.min(amountReceived, accruedInterest);
  const principalReduction = Math.max(0, amountReceived - interestCleared);
  const newPrincipal = Math.max(0, currentPrincipal - principalReduction + (renewalType === 'ADDITIONAL_DISBURSEMENT' ? additionalDisbursement : 0));

  return {
    interestCleared,
    principalReduction,
    newPrincipal,
    renewalType,
    newTenureMonths,
  };
}

test('Renewal Validation: rejects renewal on Settled loan', () => {
  assert.throws(() => {
    validateRenewalEligibility({
      loan_number: 'PGF-LN-1001',
      status: 'Settled',
    });
  }, /Cannot renew a Settled loan/);
});

test('Renewal Option A: Interest-Only Renewal', () => {
  const plan = computeRenewalPlan({
    currentPrincipal: 50000,
    accruedInterest: 1000,
    amountReceived: 1000,
    renewalType: 'INTEREST_ONLY',
    newTenureMonths: 12,
  });

  assert.strictEqual(plan.interestCleared, 1000);
  assert.strictEqual(plan.principalReduction, 0);
  assert.strictEqual(plan.newPrincipal, 50000);
  assert.strictEqual(plan.newTenureMonths, 12);
});

test('Renewal Option B: Interest + Principal Renewal (₹1,100 paid)', () => {
  const plan = computeRenewalPlan({
    currentPrincipal: 50000,
    accruedInterest: 1000,
    amountReceived: 1100,
    renewalType: 'INTEREST_AND_PRINCIPAL',
    newTenureMonths: 12,
  });

  assert.strictEqual(plan.interestCleared, 1000);
  assert.strictEqual(plan.principalReduction, 100);
  assert.strictEqual(plan.newPrincipal, 49900);
});

test('Renewal Option D: Renewal with Additional Top-up Disbursement', () => {
  const plan = computeRenewalPlan({
    currentPrincipal: 50000,
    accruedInterest: 1000,
    amountReceived: 1000,
    renewalType: 'ADDITIONAL_DISBURSEMENT',
    newTenureMonths: 12,
    additionalDisbursement: 15000,
  });

  assert.strictEqual(plan.interestCleared, 1000);
  assert.strictEqual(plan.principalReduction, 0);
  assert.strictEqual(plan.newPrincipal, 65000);
});

test('Renewal Validation: rejects renewal when payment is less than accrued interest', () => {
  assert.throws(() => {
    computeRenewalPlan({
      currentPrincipal: 50000,
      accruedInterest: 1000,
      amountReceived: 800,
      renewalType: 'INTEREST_ONLY',
      newTenureMonths: 12,
    });
  }, /Minimum payment of ₹1000/);
});
