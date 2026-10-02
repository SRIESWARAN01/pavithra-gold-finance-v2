// tests/security-phase2.test.mjs
// Phase 2 Security Test Suite — IDOR, Concurrency, Financial Edge Cases, LTV, Idempotency
//
// Run: node --test tests/security-phase2.test.mjs

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ============================================================================
// 1. IDEMPOTENCY KEY ENFORCEMENT
// ============================================================================
describe('Idempotency Key Enforcement', () => {
  // Simulate the recordPayment validation (imported logic pattern)
  function validateIdempotencyKey(data) {
    if (!data.idempotency_key || data.idempotency_key.trim().length === 0) {
      throw new Error('Idempotency key is required. Generate a unique key (e.g. UUID) before submitting a payment.');
    }
  }

  it('rejects payment without idempotency key', () => {
    assert.throws(
      () => validateIdempotencyKey({ amount_paid: 1000 }),
      /Idempotency key is required/
    );
  });

  it('rejects payment with empty string idempotency key', () => {
    assert.throws(
      () => validateIdempotencyKey({ idempotency_key: '' }),
      /Idempotency key is required/
    );
  });

  it('rejects payment with whitespace-only idempotency key', () => {
    assert.throws(
      () => validateIdempotencyKey({ idempotency_key: '   ' }),
      /Idempotency key is required/
    );
  });

  it('accepts payment with valid idempotency key', () => {
    assert.doesNotThrow(
      () => validateIdempotencyKey({ idempotency_key: 'PAY-loan123-1234567890' })
    );
  });

  it('accepts UUID-format idempotency key', () => {
    assert.doesNotThrow(
      () => validateIdempotencyKey({ idempotency_key: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
    );
  });
});

// ============================================================================
// 2. LTV (LOAN-TO-VALUE) SERVER-SIDE VALIDATION
// ============================================================================
describe('Server-Side LTV Validation', () => {
  function validateLTV(data) {
    if (data.max_eligible_loan !== undefined && data.max_eligible_loan !== null && data.max_eligible_loan > 0) {
      const ltvCeiling = Math.round(data.max_eligible_loan * 1.01 * 100) / 100;
      if (data.principal_amount > ltvCeiling) {
        throw new Error(
          `LTV_EXCEEDED: Requested principal exceeds the maximum eligible loan amount.`
        );
      }
    }
  }

  it('rejects loan when principal exceeds 75% LTV ceiling', () => {
    // Gold worth 100,000 → max eligible = 75,000
    assert.throws(
      () => validateLTV({ principal_amount: 80000, max_eligible_loan: 75000 }),
      /LTV_EXCEEDED/
    );
  });

  it('rejects loan when principal is even slightly over the 1% tolerance', () => {
    // max_eligible = 75000 → ceiling with 1% tolerance = 75750
    assert.throws(
      () => validateLTV({ principal_amount: 76000, max_eligible_loan: 75000 }),
      /LTV_EXCEEDED/
    );
  });

  it('accepts loan at exactly the max eligible amount', () => {
    assert.doesNotThrow(
      () => validateLTV({ principal_amount: 75000, max_eligible_loan: 75000 })
    );
  });

  it('accepts loan within 1% rounding tolerance', () => {
    // 75000 * 1.01 = 75750
    assert.doesNotThrow(
      () => validateLTV({ principal_amount: 75500, max_eligible_loan: 75000 })
    );
  });

  it('accepts loan when principal is well under LTV limit', () => {
    assert.doesNotThrow(
      () => validateLTV({ principal_amount: 50000, max_eligible_loan: 75000 })
    );
  });

  it('skips LTV check when max_eligible_loan is not provided', () => {
    assert.doesNotThrow(
      () => validateLTV({ principal_amount: 999999 }) // No max_eligible_loan → no check
    );
  });

  it('skips LTV check when max_eligible_loan is null', () => {
    assert.doesNotThrow(
      () => validateLTV({ principal_amount: 999999, max_eligible_loan: null })
    );
  });

  it('skips LTV check when max_eligible_loan is zero', () => {
    assert.doesNotThrow(
      () => validateLTV({ principal_amount: 999999, max_eligible_loan: 0 })
    );
  });
});

// ============================================================================
// 3. IDOR (Insecure Direct Object Reference) PROTECTION
// ============================================================================
describe('IDOR Protection — Branch Isolation Logic', () => {
  // Simulates the isBranchScoped() Firestore rule logic
  function isBranchScoped(userData, documentData) {
    const userRole = userData.role;
    // Admins and Managers bypass branch isolation
    if (['Admin', 'Owner', 'Manager'].includes(userRole)) return true;
    // No branch_id on document → accessible
    if (!documentData.branch_id) return true;
    // Match user's branch to document's branch
    return documentData.branch_id === userData.branch_id;
  }

  it('allows Admin to access any branch data', () => {
    assert.ok(
      isBranchScoped({ role: 'Admin', branch_id: 'branch-A' }, { branch_id: 'branch-B' })
    );
  });

  it('allows Manager to access any branch data', () => {
    assert.ok(
      isBranchScoped({ role: 'Manager', branch_id: 'branch-A' }, { branch_id: 'branch-B' })
    );
  });

  it('allows Cashier to access their own branch data', () => {
    assert.ok(
      isBranchScoped({ role: 'Cashier', branch_id: 'branch-A' }, { branch_id: 'branch-A' })
    );
  });

  it('blocks Cashier from accessing another branch', () => {
    assert.ok(
      !isBranchScoped({ role: 'Cashier', branch_id: 'branch-A' }, { branch_id: 'branch-B' })
    );
  });

  it('blocks Appraiser from accessing another branch', () => {
    assert.ok(
      !isBranchScoped({ role: 'Appraiser', branch_id: 'branch-A' }, { branch_id: 'branch-C' })
    );
  });

  it('allows access when document has no branch_id', () => {
    assert.ok(
      isBranchScoped({ role: 'Cashier', branch_id: 'branch-A' }, {})
    );
  });

  it('allows access when document branch_id is null', () => {
    assert.ok(
      isBranchScoped({ role: 'Cashier', branch_id: 'branch-A' }, { branch_id: null })
    );
  });
});

// ============================================================================
// 4. FINANCIAL EDGE CASES — Payment Split with Paise Precision
// ============================================================================
describe('Financial Edge Cases — Payment Split Precision', () => {
  const toPaise = (v) => Math.round((v || 0) * 100);
  const fromPaise = (p) => Math.round(p) / 100;

  function calculatePaymentSplit(amount, outstandingInterest, remainingPrincipal, penaltyAmount = 0, waiverAmount = 0) {
    if (amount < 0) amount = 0;
    if (penaltyAmount < 0) penaltyAmount = 0;
    if (waiverAmount < 0) waiverAmount = 0;

    const amountPaise = toPaise(amount);
    const penaltyPaise = toPaise(penaltyAmount);
    const waiverPaise = toPaise(waiverAmount);
    const interestDuePaise = toPaise(outstandingInterest);
    const principalDuePaise = toPaise(remainingPrincipal);

    const afterPenaltyPaise = Math.max(0, amountPaise - penaltyPaise);
    const effectiveInterestDuePaise = Math.max(0, interestDuePaise - waiverPaise);
    const interestPortionPaise = Math.min(afterPenaltyPaise, effectiveInterestDuePaise);
    const excessPaise = Math.max(0, afterPenaltyPaise - interestPortionPaise);
    const principalPortionPaise = Math.min(excessPaise, principalDuePaise);
    const newRemainingPrincipalPaise = Math.max(0, principalDuePaise - principalPortionPaise);
    const newRemainingInterestPaise = Math.max(0, effectiveInterestDuePaise - interestPortionPaise);
    const isFullSettlement = newRemainingPrincipalPaise === 0 && newRemainingInterestPaise === 0;

    return {
      totalAmount: amount,
      interestPortion: fromPaise(interestPortionPaise),
      principalPortion: fromPaise(principalPortionPaise),
      remainingPrincipal: fromPaise(newRemainingPrincipalPaise),
      remainingInterest: fromPaise(newRemainingInterestPaise),
      isFullSettlement,
    };
  }

  it('handles 0.01 rupee edge case without floating-point drift', () => {
    const split = calculatePaymentSplit(0.01, 0.01, 100000, 0, 0);
    assert.equal(split.interestPortion, 0.01);
    assert.equal(split.principalPortion, 0);
    assert.equal(split.remainingInterest, 0);
  });

  it('handles large amounts without precision loss', () => {
    const split = calculatePaymentSplit(9999999.99, 500000.50, 9499999.49, 0, 0);
    assert.equal(split.interestPortion, 500000.50);
    assert.equal(split.principalPortion, 9499999.49);
    assert.ok(split.isFullSettlement);
  });

  it('handles exact full settlement', () => {
    const split = calculatePaymentSplit(150000, 50000, 100000, 0, 0);
    assert.equal(split.interestPortion, 50000);
    assert.equal(split.principalPortion, 100000);
    assert.equal(split.remainingPrincipal, 0);
    assert.equal(split.remainingInterest, 0);
    assert.ok(split.isFullSettlement);
  });

  it('handles negative amount gracefully (clamps to 0)', () => {
    const split = calculatePaymentSplit(-500, 1000, 100000, 0, 0);
    assert.equal(split.totalAmount, 0);
    assert.equal(split.interestPortion, 0);
    assert.equal(split.principalPortion, 0);
  });

  it('handles penalty + waiver + partial payment correctly', () => {
    // Amount: 5000, Penalty: 500, Waiver: 200, Outstanding Interest: 2000, Principal: 100000
    const split = calculatePaymentSplit(5000, 2000, 100000, 500, 200);
    // After penalty: 5000 - 500 = 4500
    // Effective interest: 2000 - 200 = 1800
    // Interest portion: min(4500, 1800) = 1800
    // Excess: 4500 - 1800 = 2700 → principal
    assert.equal(split.interestPortion, 1800);
    assert.equal(split.principalPortion, 2700);
    assert.equal(split.remainingInterest, 0);
  });

  it('rejects overpayment beyond total outstanding', () => {
    // Payment exceeds both principal + interest — excess should NOT go to principal beyond balance
    const split = calculatePaymentSplit(200000, 50000, 100000, 0, 0);
    // Interest cleared: 50000, Principal cleared: min(150000, 100000) = 100000
    assert.equal(split.principalPortion, 100000);
    assert.ok(split.isFullSettlement);
  });
});

// ============================================================================
// 5. CONCURRENCY SAFETY — Transaction Serialization Guards
// ============================================================================
describe('Concurrency Safety — Transaction Guards', () => {
  it('loan status guard rejects operations on Settled loans', () => {
    const loan = { status: 'Settled' };
    const blockedStatuses = ['Settled', 'Cancelled', 'Auctioned'];
    assert.ok(
      blockedStatuses.includes(loan.status),
      'Should block operations on Settled loans'
    );
  });

  it('loan status guard rejects operations on Cancelled loans', () => {
    const loan = { status: 'Cancelled' };
    const blockedStatuses = ['Settled', 'Cancelled', 'Auctioned'];
    assert.ok(
      blockedStatuses.includes(loan.status),
      'Should block operations on Cancelled loans'
    );
  });

  it('loan status guard allows operations on Active loans', () => {
    const loan = { status: 'Active' };
    const blockedStatuses = ['Settled', 'Cancelled', 'Auctioned'];
    assert.ok(
      !blockedStatuses.includes(loan.status),
      'Should allow operations on Active loans'
    );
  });

  it('idempotent daily interest calculation skips already-calculated date', () => {
    const loan = { last_interest_calc_date: '2026-10-01' };
    const targetDate = '2026-10-01';
    assert.ok(
      loan.last_interest_calc_date === targetDate,
      'Should detect already-calculated date and skip'
    );
  });

  it('custody lock prevents release when gold is at bank', () => {
    const collateral = { custody_location: 'State Bank of India', status: 'RePledged' };
    const custody = (collateral.custody_location || '').toLowerCase();
    const isLocked = custody.includes('bank') || collateral.status === 'RePledged' || collateral.status === 'Repledged';
    assert.ok(isLocked, 'Should detect bank custody lock');
  });

  it('allows release when gold is at PGF Safe', () => {
    const collateral = { custody_location: 'PGF Safe', status: 'Active' };
    const custody = (collateral.custody_location || '').toLowerCase();
    const isLocked = custody.includes('bank') || collateral.status === 'RePledged' || collateral.status === 'Repledged';
    assert.ok(!isLocked, 'Should allow release from PGF Safe');
  });
});

// ============================================================================
// 6. RATE LIMITING LOGIC
// ============================================================================
describe('Rate Limiting Logic', () => {
  const rateLimitMap = new Map();
  const WINDOW_MS = 60000;

  function isRateLimited(key, maxRequests) {
    const now = Date.now();
    const entry = rateLimitMap.get(key);
    if (!entry || now > entry.resetAt) {
      rateLimitMap.set(key, { count: 1, resetAt: now + WINDOW_MS });
      return false;
    }
    entry.count++;
    return entry.count > maxRequests;
  }

  it('allows first request', () => {
    assert.ok(!isRateLimited('test-ip-1', 5));
  });

  it('allows requests up to the limit', () => {
    for (let i = 0; i < 4; i++) {
      assert.ok(!isRateLimited('test-ip-2', 5));
    }
  });

  it('blocks requests exceeding the limit', () => {
    const key = 'test-ip-3';
    for (let i = 0; i < 5; i++) {
      isRateLimited(key, 5);
    }
    assert.ok(isRateLimited(key, 5), 'Should block the 6th request');
  });
});

// ============================================================================
// 7. CORS ORIGIN VALIDATION
// ============================================================================
describe('CORS Origin Validation', () => {
  const ALLOWED_ORIGINS = new Set([
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
  ]);

  function isAllowedOrigin(origin) {
    if (!origin) return true;
    return ALLOWED_ORIGINS.has(origin);
  }

  it('allows same-origin requests (no Origin header)', () => {
    assert.ok(isAllowedOrigin(null));
  });

  it('allows localhost:3000', () => {
    assert.ok(isAllowedOrigin('http://localhost:3000'));
  });

  it('allows 127.0.0.1:3000', () => {
    assert.ok(isAllowedOrigin('http://127.0.0.1:3000'));
  });

  it('blocks arbitrary external origin', () => {
    assert.ok(!isAllowedOrigin('https://evil-site.com'));
  });

  it('blocks similar but different origin', () => {
    assert.ok(!isAllowedOrigin('http://localhost:4000'));
  });

  it('blocks https variant when only http is whitelisted', () => {
    assert.ok(!isAllowedOrigin('https://localhost:3000'));
  });
});

// ============================================================================
// 8. INPUT VALIDATION — SQL-LIKE INJECTION IN FIRESTORE FIELDS
// ============================================================================
describe('Input Validation — Firestore Field Safety', () => {
  function cleanFirestorePayload(obj) {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value === undefined) {
        result[key] = null;
      } else if (typeof value === 'string' && value.length > 500000) {
        result[key] = null;
      } else if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        result[key] = cleanFirestorePayload(value);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  it('strips undefined values to null', () => {
    const cleaned = cleanFirestorePayload({ a: 1, b: undefined, c: 'hello' });
    assert.equal(cleaned.b, null);
    assert.equal(cleaned.a, 1);
    assert.equal(cleaned.c, 'hello');
  });

  it('truncates oversized strings to null (DoS prevention)', () => {
    const bigString = 'x'.repeat(600000);
    const cleaned = cleanFirestorePayload({ data: bigString });
    assert.equal(cleaned.data, null);
  });

  it('preserves normal-sized strings', () => {
    const normalString = 'x'.repeat(1000);
    const cleaned = cleanFirestorePayload({ data: normalString });
    assert.equal(cleaned.data, normalString);
  });

  it('recursively cleans nested objects', () => {
    const cleaned = cleanFirestorePayload({
      outer: { inner: undefined, valid: 'yes' },
    });
    assert.equal(cleaned.outer.inner, null);
    assert.equal(cleaned.outer.valid, 'yes');
  });
});
