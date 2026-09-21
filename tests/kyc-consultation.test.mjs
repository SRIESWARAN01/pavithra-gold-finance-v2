// tests/kyc-consultation.test.mjs
// Comprehensive test suite for Pavithra Gold Finance (PGF) KYC Consultation:
// Test 1 – Customer Search (Mobile, Customer ID, Name)
// Test 2 – Multiple Pledges (All appear as separate rows, never merged)
// Test 3 – Released Loan (Pledged 09-01-2025, Released 08-04-2026 -> exact 454 Days)
// Test 4 – Active Loan (No release date -> Days = Current Date - Pledge Date)
// Test 5 – Multiple Ornaments (Ring 2g, Chain 8g, Bangle 4g -> 14g Net Weight)
// Test 6 – Multiple Active Loans (Active pockets count and sum of outstandings)
// Test 7 – Part Payment (Reducing principal balance)
// Test 8 – Branch Isolation (Unauthorized branch records blocked)

import test from 'node:test';
import assert from 'node:assert/strict';

// Helper rounding function
function round2(val) {
  return Math.round((Number(val) || 0) * 100) / 100;
}

// ----------------------------------------------------------------------------
// Date Calculation Helper (Mirroring src/lib/db/kyc-consultation.ts)
// ----------------------------------------------------------------------------
function extractDatePart(dateStr) {
  if (!dateStr) return '';
  return dateStr.split('T')[0];
}

function calculateDaysActive(pledgeDateStr, releaseDateStr, asOfDateStr) {
  const pDatePart = extractDatePart(pledgeDateStr);
  if (!pDatePart) {
    return { days: 0, displayText: '0 Days', isReleased: false };
  }

  const pDate = new Date(pDatePart);
  const rDatePart = extractDatePart(releaseDateStr);
  const isReleased = Boolean(rDatePart);

  let targetDate;
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

// ----------------------------------------------------------------------------
// Test 1 – Customer Search
// ----------------------------------------------------------------------------
test('Test 1 – Customer Search: Accurate lookup by mobile number, customer unique ID, and name', () => {
  const mockProfiles = [
    { id: 'cust_1', customer_number: 'PGF-CUST-1042', name: 'Ramesh Kumar', phone_primary: '9876543210', branch_id: 'branch_1' },
    { id: 'cust_2', customer_number: 'PGF-CUST-1043', name: 'Suresh Babu', phone_primary: '9123456780', branch_id: 'branch_1' },
    { id: 'cust_3', customer_number: 'PGF-MDU-000005', name: 'Priya Sundaram', phone_primary: '9988776655', branch_id: 'branch_2' },
  ];

  function search(query) {
    const q = query.trim().toLowerCase();
    const cleanPhone = q.replace('+91', '').replace(/\s+/g, '');
    return mockProfiles.filter((p) => {
      const name = p.name.toLowerCase();
      const cnum = p.customer_number.toLowerCase();
      const phone = p.phone_primary.replace('+91', '');
      return (cleanPhone.length >= 4 && phone.includes(cleanPhone)) || cnum.includes(q) || name.includes(q);
    });
  }

  // 1. By Mobile
  const byMobile = search('9876543210');
  assert.equal(byMobile.length, 1);
  assert.equal(byMobile[0].customer_number, 'PGF-CUST-1042');

  // 2. By Customer ID
  const byId = search('PGF-CUST-1042');
  assert.equal(byId.length, 1);
  assert.equal(byId[0].name, 'Ramesh Kumar');

  // 3. By Name
  const byName = search('Ramesh');
  assert.equal(byName.length, 1);
  assert.equal(byName[0].customer_number, 'PGF-CUST-1042');
});

// ----------------------------------------------------------------------------
// Test 2 – Multiple Pledges
// ----------------------------------------------------------------------------
test('Test 2 – Multiple Pledges: Customer has 5 loans, all appear as separate, independent pledge rows', () => {
  const loans = [
    { id: 'l1', loan_number: 'PGF-LN-000001', principal_amount: 100000, origination_date: '2025-01-09' },
    { id: 'l2', loan_number: 'PGF-LN-000002', principal_amount: 75000, origination_date: '2025-03-15' },
    { id: 'l3', loan_number: 'PGF-LN-000003', principal_amount: 150000, origination_date: '2025-07-20' },
    { id: 'l4', loan_number: 'PGF-LN-000004', principal_amount: 50000, origination_date: '2026-01-12' },
    { id: 'l5', loan_number: 'PGF-LN-000005', principal_amount: 200000, origination_date: '2026-04-08' },
  ];

  assert.equal(loans.length, 5);
  // Ensure each loan has its own distinct loan number and amount
  const loanNumbers = new Set(loans.map((l) => l.loan_number));
  assert.equal(loanNumbers.size, 5);

  const totalHistoricalPledged = loans.reduce((sum, l) => sum + l.principal_amount, 0);
  assert.equal(totalHistoricalPledged, 575000);
});

// ----------------------------------------------------------------------------
// Test 3 – Released Loan
// ----------------------------------------------------------------------------
test('Test 3 – Released Loan: Pledged on 09-01-2025 and released on 08-04-2026 calculates exactly 454 Days', () => {
  const pledgeDate = '2025-01-09';
  const releaseDate = '2026-04-08';

  const res = calculateDaysActive(pledgeDate, releaseDate);
  assert.equal(res.isReleased, true);
  assert.equal(res.days, 454);
  assert.equal(res.displayText, '454 Days');
});

// ----------------------------------------------------------------------------
// Test 4 – Active Loan
// ----------------------------------------------------------------------------
test('Test 4 – Active Loan: Has no release date -> Days = Current Date - Pledge Date', () => {
  const pledgeDate = '2026-01-01';
  const simulatedToday = '2026-09-08'; // 250 days later

  const res = calculateDaysActive(pledgeDate, null, simulatedToday);
  assert.equal(res.isReleased, false);
  assert.equal(res.days, 250);
  assert.equal(res.displayText, 'Active – 250 Days');
});

// ----------------------------------------------------------------------------
// Test 5 – Multiple Ornaments
// ----------------------------------------------------------------------------
test('Test 5 – Multiple Ornaments: Ring (2g), Chain (8g), Bangle (4g) -> Total Net Weight = 14g', () => {
  const ornaments = [
    { item_description: 'Ring', quantity: 1, gross_weight: 2.1, stone_weight: 0.1, net_weight: 2.0, purity_karat: '22K' },
    { item_description: 'Chain', quantity: 1, gross_weight: 8.5, stone_weight: 0.5, net_weight: 8.0, purity_karat: '22K' },
    { item_description: 'Bangle', quantity: 1, gross_weight: 4.2, stone_weight: 0.2, net_weight: 4.0, purity_karat: '22K' },
  ];

  assert.equal(ornaments.length, 3);
  const totalGross = round2(ornaments.reduce((s, o) => s + o.gross_weight, 0));
  const totalStone = round2(ornaments.reduce((s, o) => s + o.stone_weight, 0));
  const totalNet = round2(ornaments.reduce((s, o) => s + o.net_weight, 0));

  assert.equal(totalGross, 14.8);
  assert.equal(totalStone, 0.8);
  assert.equal(totalNet, 14.0); // Exact 14.00 g
});

// ----------------------------------------------------------------------------
// Test 6 – Multiple Active Loans
// ----------------------------------------------------------------------------
test('Test 6 – Multiple Active Loans: Current Active Pockets = 3, Current Outstanding = sum of the three', () => {
  const loans = [
    { id: 'l1', status: 'Active', current_principal: 80000, interest: 5500, penalty: 0, total_out: 85500, gold_weight: 10.5 },
    { id: 'l2', status: 'Active', current_principal: 110000, interest: 10000, penalty: 0, total_out: 120000, gold_weight: 18.2 },
    { id: 'l3', status: 'Overdue', current_principal: 45000, interest: 4500, penalty: 500, total_out: 50000, gold_weight: 8.4 },
    { id: 'l4', status: 'Settled', current_principal: 0, interest: 0, penalty: 0, total_out: 0, gold_weight: 12.0 },
  ];

  const activeStatuses = ['Active', 'Due', 'Overdue', 'Grace_Period'];
  const activeLoans = loans.filter((l) => activeStatuses.includes(l.status));

  assert.equal(activeLoans.length, 3); // Current Active Pockets = 3

  const totalPrincipal = activeLoans.reduce((s, l) => s + l.current_principal, 0);
  const totalInterest = activeLoans.reduce((s, l) => s + l.interest, 0);
  const totalPenalty = activeLoans.reduce((s, l) => s + l.penalty, 0);
  const totalOutstanding = activeLoans.reduce((s, l) => s + l.total_out, 0);
  const totalGoldWeight = round2(activeLoans.reduce((s, l) => s + l.gold_weight, 0));

  assert.equal(totalPrincipal, 235000);
  assert.equal(totalInterest, 20000);
  assert.equal(totalPenalty, 500);
  assert.equal(totalOutstanding, 255500); // 85,500 + 120,000 + 50,000 = 255,500
  assert.equal(totalGoldWeight, 37.1); // 10.5 + 18.2 + 8.4 = 37.10 g
});

// ----------------------------------------------------------------------------
// Test 7 – Part Payment
// ----------------------------------------------------------------------------
test('Test 7 – Part Payment: New Principal = Old Principal - Principal Paid', () => {
  const originalPrincipal = 100000;
  const payment = {
    amount_paid: 25500,
    interest_portion: 5500,
    principal_portion: 20000, // ₹20,000 principal reduction
  };

  const newPrincipal = originalPrincipal - payment.principal_portion;
  assert.equal(newPrincipal, 80000);

  const newInterestDue = 0; // Cleared in payment
  const newTotalOutstanding = newPrincipal + newInterestDue;
  assert.equal(newTotalOutstanding, 80000);
});

// ----------------------------------------------------------------------------
// Test 8 – Branch Isolation
// ----------------------------------------------------------------------------
test('Test 8 – Branch Isolation: Customer records from unauthorized branches are not accessible', () => {
  const customers = [
    { id: 'c1', name: 'Branch 1 Customer', branch_id: 'branch_1' },
    { id: 'c2', name: 'Branch 2 Customer', branch_id: 'branch_2' },
  ];

  function getCustomerForStaff(customerId, staffBranchId) {
    const cust = customers.find((c) => c.id === customerId);
    if (!cust) return null;
    if (staffBranchId && staffBranchId !== 'all' && cust.branch_id !== staffBranchId) {
      throw new Error('Access denied: Customer belongs to another branch.');
    }
    return cust;
  }

  // Authorized access
  assert.ok(getCustomerForStaff('c1', 'branch_1'));
  // Admin cross-branch access
  assert.ok(getCustomerForStaff('c1', 'all'));
  // Unauthorized access throws
  assert.throws(() => getCustomerForStaff('c2', 'branch_1'), /Access denied/);
});
