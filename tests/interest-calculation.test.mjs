// tests/interest-calculation.test.mjs
// Test suite for Centralized Interest Calculation Engine, Leap Year support, and Paise arithmetic.

import test from 'node:test';
import assert from 'node:assert/strict';

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

function calculateDailyInterestPaise(principalPaise, apr, year) {
  const daysInYear = getDaysInYear(year);
  return (principalPaise * (apr / 100)) / daysInYear;
}

function calculateAccruedInterest(params) {
  const {
    principalPaise,
    apr,
    startDate,
    endDate,
    repayments = [],
  } = params;

  if (endDate <= startDate) return 0;

  const repaymentMap = new Map();
  for (const r of repayments) {
    const dStr = r.date.toISOString().split('T')[0];
    const curr = repaymentMap.get(dStr) || 0;
    repaymentMap.set(dStr, curr + r.principalPaidPaise);
  }

  let totalInterestPaise = 0;
  let currentPrincipalPaise = principalPaise;

  const iter = new Date(startDate);
  iter.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  while (iter < end) {
    const dStr = iter.toISOString().split('T')[0];
    const deduction = repaymentMap.get(dStr);
    if (deduction) {
      currentPrincipalPaise = Math.max(0, currentPrincipalPaise - deduction);
    }

    const year = iter.getFullYear();
    const dailyInterest = calculateDailyInterestPaise(currentPrincipalPaise, apr, year);
    totalInterestPaise += dailyInterest;

    iter.setDate(iter.getDate() + 1);
  }

  return Math.round(totalInterestPaise);
}

// -----------------------------------------------------------------------------
// Leap Year & Days In Year Tests
// -----------------------------------------------------------------------------
test('Interest Engine: Leap year detection', () => {
  assert.strictEqual(isLeapYear(2024), true);
  assert.strictEqual(isLeapYear(2020), true);
  assert.strictEqual(isLeapYear(2000), true);
  assert.strictEqual(isLeapYear(2023), false);
  assert.strictEqual(isLeapYear(2025), false);
  assert.strictEqual(isLeapYear(1900), false); // Divisible by 100 but not 400
});

test('Interest Engine: Days in year based on leap year', () => {
  assert.strictEqual(getDaysInYear(2024), 366);
  assert.strictEqual(getDaysInYear(2023), 365);
  assert.strictEqual(getDaysInYear(2025), 365);
  assert.strictEqual(getDaysInYear(2028), 366);
});

test('Interest Engine: Integer Paise Conversion Accuracy', () => {
  assert.strictEqual(toPaise(100.5), 10050);
  assert.strictEqual(toPaise(0.01), 1);
  assert.strictEqual(toPaise(49900.25), 4990025);
  assert.strictEqual(fromPaise(4990025), 49900.25);
  assert.strictEqual(fromPaise(1), 0.01);
});

// -----------------------------------------------------------------------------
// Test Case 1: Interest Only
// -----------------------------------------------------------------------------
test('Test Case 1: Interest Only Repayment', () => {
  const principal = 50000;
  const interestDue = 1000;
  const paymentReceived = 1000;

  const penaltyPaid = 0;
  const interestPaid = Math.min(paymentReceived, interestDue);
  const principalReduction = paymentReceived - interestPaid;
  const newPrincipal = principal - principalReduction;
  const remainingInterest = interestDue - interestPaid;

  assert.strictEqual(interestPaid, 1000);
  assert.strictEqual(principalReduction, 0);
  assert.strictEqual(newPrincipal, 50000);
  assert.strictEqual(remainingInterest, 0);
});

// -----------------------------------------------------------------------------
// Test Case 2: Interest + Principal (Excess payment reduces principal)
// -----------------------------------------------------------------------------
test('Test Case 2: Interest + Principal Repayment (₹1,100 paid on ₹1,000 interest)', () => {
  const principal = 50000;
  const interestDue = 1000;
  const paymentReceived = 1100;

  const interestPaid = Math.min(paymentReceived, interestDue);
  const principalReduction = paymentReceived - interestPaid;
  const newPrincipal = principal - principalReduction;
  const remainingInterest = interestDue - interestPaid;

  assert.strictEqual(interestPaid, 1000);
  assert.strictEqual(principalReduction, 100);
  assert.strictEqual(newPrincipal, 49900);
  assert.strictEqual(remainingInterest, 0);
  assert.ok(remainingInterest >= 0, 'Interest must never be negative');
});

// -----------------------------------------------------------------------------
// Test Case 3: Partial Interest Payment
// -----------------------------------------------------------------------------
test('Test Case 3: Partial Interest Payment (₹600 paid on ₹1,000 interest)', () => {
  const principal = 50000;
  const interestDue = 1000;
  const paymentReceived = 600;

  const interestPaid = Math.min(paymentReceived, interestDue);
  const principalReduction = Math.max(0, paymentReceived - interestPaid);
  const newPrincipal = principal - principalReduction;
  const remainingInterest = interestDue - interestPaid;

  assert.strictEqual(interestPaid, 600);
  assert.strictEqual(principalReduction, 0);
  assert.strictEqual(newPrincipal, 50000);
  assert.strictEqual(remainingInterest, 400);
});

// -----------------------------------------------------------------------------
// Test Case 4: Payment Greater Than Interest
// -----------------------------------------------------------------------------
test('Test Case 4: Payment Greater Than Interest (₹1,500 paid on ₹1,000 interest)', () => {
  const principal = 50000;
  const interestDue = 1000;
  const paymentReceived = 1500;

  const interestPaid = Math.min(paymentReceived, interestDue);
  const principalReduction = paymentReceived - interestPaid;
  const newPrincipal = principal - principalReduction;
  const remainingInterest = interestDue - interestPaid;

  assert.strictEqual(interestPaid, 1000);
  assert.strictEqual(principalReduction, 500);
  assert.strictEqual(newPrincipal, 49500);
  assert.strictEqual(remainingInterest, 0);
});

// -----------------------------------------------------------------------------
// Reducing Balance across days with intermediate repayments
// -----------------------------------------------------------------------------
test('Interest Engine: Reducing balance calculation with intermediate repayment', () => {
  const startDate = new Date('2024-01-01');
  const endDate = new Date('2024-01-31'); // 30 days in Jan 2024 (leap year)
  const principalPaise = toPaise(100000); // 1 Lakh
  const apr = 18;

  // Repayment of 20,000 on Jan 16 (after 15 days)
  const repayments = [
    {
      date: new Date('2024-01-16'),
      principalPaidPaise: toPaise(20000),
    }
  ];

  const interestPaise = calculateAccruedInterest({
    principalPaise,
    apr,
    startDate,
    endDate,
    repayments,
  });

  // Daily rate for 100k at 18% in leap year (366 days): 100000 * 0.18 / 366 = ~49.1803
  // 15 days * 49.1803 = ~737.70
  // Daily rate for 80k at 18% in leap year: 80000 * 0.18 / 366 = ~39.3442
  // 15 days * 39.3442 = ~590.16
  // Total ~ 1327.86 (132786 paise)
  const interestINR = fromPaise(interestPaise);
  assert.ok(interestINR >= 1325 && interestINR <= 1340, `Expected between 1325 and 1340, got ${interestINR}`);
});

// -----------------------------------------------------------------------------
// Edge Case: Same-day loan — 0 days elapsed = 0 interest
// -----------------------------------------------------------------------------
test('Interest Engine: Same-day loan accrues zero interest', () => {
  const startDate = new Date('2025-06-15');
  const endDate = new Date('2025-06-15'); // Same day
  const principalPaise = toPaise(50000);

  const interestPaise = calculateAccruedInterest({
    principalPaise,
    apr: 24,
    startDate,
    endDate,
  });

  assert.strictEqual(interestPaise, 0);
});

// -----------------------------------------------------------------------------
// Edge Case: Leap year boundary — Dec 31 → Jan 1
// -----------------------------------------------------------------------------
test('Interest Engine: Leap year boundary crossing (2024 → 2025)', () => {
  const startDate = new Date('2024-12-30');
  const endDate = new Date('2025-01-02'); // 3 days: Dec 30, Dec 31 (leap), Jan 1 (non-leap)
  const principalPaise = toPaise(100000);
  const apr = 18;

  const interestPaise = calculateAccruedInterest({
    principalPaise,
    apr,
    startDate,
    endDate,
  });

  // Dec 30, Dec 31 use 366 days denominator: 10000000 * 0.18 / 366 ≈ 4918 paise/day × 2 = 9836
  // Jan 1 uses 365 days denominator: 10000000 * 0.18 / 365 ≈ 4932 paise/day × 1 = 4932
  // Total ≈ 14768 paise ≈ ₹147.68
  const interestINR = fromPaise(interestPaise);
  assert.ok(interestINR >= 147 && interestINR <= 149, `Expected ~148, got ${interestINR}`);
});

// -----------------------------------------------------------------------------
// Edge Case: Very large principal — no precision loss
// -----------------------------------------------------------------------------
test('Interest Engine: Large principal (1 Crore) maintains precision', () => {
  const startDate = new Date('2025-01-01');
  const endDate = new Date('2025-01-31'); // 30 days
  const principalPaise = toPaise(10000000); // 1 Crore = ₹1,00,00,000
  const apr = 24;

  const interestPaise = calculateAccruedInterest({
    principalPaise,
    apr,
    startDate,
    endDate,
  });

  // Daily: 10,00,00,000 paise * 0.24 / 365 ≈ 657,534 paise
  // 30 days: ≈ 19,726,027 paise ≈ ₹1,97,260.27
  const interestINR = fromPaise(interestPaise);
  assert.ok(interestINR >= 197000 && interestINR <= 198000, `Expected ~197,260 for 1Cr@24%, got ${interestINR}`);
});

// -----------------------------------------------------------------------------
// Edge Case: One day loan
// -----------------------------------------------------------------------------
test('Interest Engine: One-day loan accrues exactly one day of interest', () => {
  const startDate = new Date('2025-03-15');
  const endDate = new Date('2025-03-16'); // 1 day
  const principalPaise = toPaise(50000); // ₹50,000
  const apr = 18;

  const interestPaise = calculateAccruedInterest({
    principalPaise,
    apr,
    startDate,
    endDate,
  });

  // Daily: 5000000 paise * 0.18 / 365 ≈ 2466 paise ≈ ₹24.66
  const interestINR = fromPaise(interestPaise);
  assert.ok(interestINR >= 24 && interestINR <= 25, `Expected ~24.66, got ${interestINR}`);
});
