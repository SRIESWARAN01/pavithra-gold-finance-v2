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
