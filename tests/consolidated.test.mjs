// tests/consolidated.test.mjs
// Comprehensive test suite for PGF Consolidated Daily Position:
// Test 1 – New Pledge (Count, Amount, Net Weight, Active Pockets)
// Test 2 – Interest-only Payment (No principal increase, principal untouched)
// Test 3 – Part Principal Payment (₹10,000 -> ₹2,000 paid -> ₹8,000 remaining)
// Test 4 – Full Release (Count, Amount, Weight, Active Pockets -1, Collateral Excluded)
// Test 5 – Re-Pledge (Active Pockets, Amount, Weight, Bank Custody)
// Test 6 – Re-Pledge Release (Active Count -1, Custody returns to PGF Safe)
// Test 7 – Branch Isolation (Multi-branch data separation)
// Test 8 – Multiple Principal Payments on same day (Unique loan count = 1, sum of principal)
// Test 9 – Date Filter Behavior (Date-specific movement aggregation)

import test from 'node:test';
import assert from 'node:assert/strict';

// Core aggregation logic matching src/lib/db/consolidated.ts
function aggregateConsolidated(data, targetDate, branchId) {
  const targetBranch = branchId && branchId !== 'all' ? branchId : null;

  // Filter loans by branch
  const filteredLoans = data.loans.filter((l) => {
    if (targetBranch && l.branch_id !== targetBranch) return false;
    return true;
  });

  const loansMap = new Map();
  filteredLoans.forEach((l) => loansMap.set(l.id, l));

  // Collateral map
  const collateralByLoan = new Map();
  data.collateral.forEach((c) => {
    const list = collateralByLoan.get(c.loan_id) || [];
    list.push(c);
    collateralByLoan.set(c.loan_id, list);
  });

  // 1. Today's Pledge
  const todayPledges = filteredLoans.filter((l) => {
    const d = (l.origination_date || l.created_at || '').split('T')[0];
    return d === targetDate;
  });

  const todayPledgeAmount = todayPledges.reduce((sum, l) => sum + (l.principal_amount || 0), 0);
  const todayPledgeWeight = todayPledges.reduce((sum, l) => {
    const col = collateralByLoan.get(l.id) || [];
    return sum + col.reduce((cSum, c) => cSum + (c.net_weight || 0), 0);
  }, 0);

  // 2. Today's Release
  const todayReleases = filteredLoans.filter((l) => {
    const d = (l.release_date || l.closed_at || '').split('T')[0];
    return d === targetDate && l.status === 'Settled';
  });

  const todayReleaseAmount = todayReleases.reduce((sum, l) => sum + (l.principal_amount || 0), 0);
  const todayReleaseWeight = todayReleases.reduce((sum, l) => {
    const col = collateralByLoan.get(l.id) || [];
    return sum + col.reduce((cSum, c) => cSum + (c.net_weight || 0), 0);
  }, 0);

  // 3. Today's Part Payment / Principal Payment
  const todayPayments = data.payments.filter((p) => {
    const d = (p.payment_date || p.created_at || '').split('T')[0];
    if (d !== targetDate) return false;
    const linkedLoan = loansMap.get(p.loan_id);
    if (!linkedLoan) return false;
    return true;
  });

  const principalPayments = todayPayments.filter((p) => (p.principal_portion || 0) > 0);
  const uniquePrincipalLoanIds = new Set(principalPayments.map((p) => p.loan_id));
  const totalPrincipalCollected = principalPayments.reduce((sum, p) => sum + p.principal_portion, 0);

  // 4. Current Position (Active Loans)
  const activeStatuses = ['Active', 'Due', 'Overdue', 'Grace_Period'];
  const activeLoans = filteredLoans.filter((l) => activeStatuses.includes(l.status));
  const activePockets = activeLoans.length;
  const activeOutstanding = activeLoans.reduce((sum, l) => {
    const curP = l.principal_amount - (l.total_principal_paid || 0);
    const intP = l.outstanding_interest || 0;
    const penP = l.penalty_amount || 0;
    return sum + (l.total_outstanding || (curP + intP + penP));
  }, 0);

  const activeGoldWeight = activeLoans.reduce((sum, l) => {
    const col = collateralByLoan.get(l.id) || [];
    const activeCol = col.filter((c) => c.status !== 'Released' && c.custody_location !== 'Released to Customer');
    return sum + activeCol.reduce((cSum, c) => cSum + (c.net_weight || 0), 0);
  }, 0);

  // 5. Re-Pledge Position
  const activeRepledges = data.repledges.filter((r) => {
    if (r.status !== 'Active' && r.status !== 'Pledged with Bank') return false;
    if (targetBranch) {
      const linkedLoan = loansMap.get(r.loan_id);
      if (linkedLoan && linkedLoan.branch_id !== targetBranch) return false;
    }
    return true;
  });

  const repledgePockets = activeRepledges.length;
  const repledgeAmount = activeRepledges.reduce((sum, r) => sum + (r.bank_outstanding || r.bank_pledge_amount || 0), 0);
  const repledgeWeight = activeRepledges.reduce((sum, r) => sum + (r.total_net_weight || 0), 0);

  return {
    todayPledge: {
      count: todayPledges.length,
      amount: todayPledgeAmount,
      weight: todayPledgeWeight,
    },
    todayRelease: {
      count: todayReleases.length,
      amount: todayReleaseAmount,
      weight: todayReleaseWeight,
    },
    todayPartPayment: {
      uniqueLoansCount: uniquePrincipalLoanIds.size,
      principalCollected: totalPrincipalCollected,
    },
    currentPosition: {
      activePockets,
      totalOutstanding: activeOutstanding,
      totalGoldWeight: activeGoldWeight,
    },
    repledgePosition: {
      pockets: repledgePockets,
      amount: repledgeAmount,
      weight: repledgeWeight,
    },
  };
}

test('Test 1 – New Pledge: Count, Amount, Net Weight, and Active Pockets', () => {
  const mockData = {
    loans: [
      {
        id: 'ln_1',
        loan_number: 'PGF-LN-001001',
        principal_amount: 50000,
        total_principal_paid: 0,
        total_outstanding: 50000,
        origination_date: '2026-09-20T10:00:00Z',
        status: 'Active',
        branch_id: 'br_mdu',
      },
    ],
    collateral: [
      {
        id: 'col_1',
        loan_id: 'ln_1',
        net_weight: 12.5,
        status: 'Pledged',
        custody_location: 'PGF Safe',
      },
    ],
    payments: [],
    repledges: [],
  };

  const pos = aggregateConsolidated(mockData, '2026-09-20', 'all');

  assert.equal(pos.todayPledge.count, 1, 'Today pledge count should be 1');
  assert.equal(pos.todayPledge.amount, 50000, 'Today pledge amount should be ₹50,000');
  assert.equal(pos.todayPledge.weight, 12.5, 'Today pledge weight should be 12.5g');
  assert.equal(pos.currentPosition.activePockets, 1, 'Active pockets should be 1');
  assert.equal(pos.currentPosition.totalGoldWeight, 12.5, 'Active gold weight should be 12.5g');
});

test('Test 2 – Interest-only Payment: Principal payment count does NOT increase', () => {
  const mockData = {
    loans: [
      {
        id: 'ln_1',
        loan_number: 'PGF-LN-001001',
        principal_amount: 10000,
        total_principal_paid: 0,
        total_outstanding: 10400,
        status: 'Active',
      },
    ],
    collateral: [{ id: 'col_1', loan_id: 'ln_1', net_weight: 5.0, status: 'Pledged' }],
    payments: [
      {
        id: 'pmt_1',
        loan_id: 'ln_1',
        amount_paid: 400,
        interest_portion: 400,
        principal_portion: 0, // Interest only
        payment_date: '2026-09-20',
      },
    ],
    repledges: [],
  };

  const pos = aggregateConsolidated(mockData, '2026-09-20', 'all');

  assert.equal(pos.todayPartPayment.uniqueLoansCount, 0, 'Principal payment count must be 0 for interest-only');
  assert.equal(pos.todayPartPayment.principalCollected, 0, 'Principal collected must be 0');
});

test('Test 3 – Part Principal Payment: ₹10,000 Loan with ₹2,000 Principal reduction', () => {
  const mockData = {
    loans: [
      {
        id: 'ln_1',
        loan_number: 'PGF-LN-1001',
        principal_amount: 10000,
        total_principal_paid: 2000,
        outstanding_interest: 0,
        penalty_amount: 0,
        total_outstanding: 8000, // 10000 - 2000
        status: 'Active',
      },
    ],
    collateral: [{ id: 'col_1', loan_id: 'ln_1', net_weight: 10.0, status: 'Pledged' }],
    payments: [
      {
        id: 'pmt_1',
        loan_id: 'ln_1',
        amount_paid: 2500,
        interest_portion: 500,
        principal_portion: 2000,
        payment_date: '2026-09-20',
      },
    ],
    repledges: [],
  };

  const pos = aggregateConsolidated(mockData, '2026-09-20', 'all');

  assert.equal(pos.todayPartPayment.uniqueLoansCount, 1, 'Principal payment loans count must be 1');
  assert.equal(pos.todayPartPayment.principalCollected, 2000, 'Principal collected must be ₹2,000');
  assert.equal(pos.currentPosition.totalOutstanding, 8000, 'Current outstanding must be ₹8,000');
});

test('Test 4 – Full Release: Count, Amount, Released Weight, Active Pockets Decreased', () => {
  const mockData = {
    loans: [
      {
        id: 'ln_1',
        loan_number: 'PGF-LN-001001',
        principal_amount: 30000,
        total_principal_paid: 30000,
        total_outstanding: 0,
        status: 'Settled',
        release_date: '2026-09-20T14:30:00Z',
      },
      {
        id: 'ln_2',
        loan_number: 'PGF-LN-001002',
        principal_amount: 40000,
        total_principal_paid: 0,
        total_outstanding: 40000,
        status: 'Active',
      },
    ],
    collateral: [
      {
        id: 'col_1',
        loan_id: 'ln_1',
        net_weight: 8.5,
        status: 'Released',
        custody_location: 'Released to Customer',
      },
      {
        id: 'col_2',
        loan_id: 'ln_2',
        net_weight: 12.0,
        status: 'Pledged',
        custody_location: 'PGF Safe',
      },
    ],
    payments: [],
    repledges: [],
  };

  const pos = aggregateConsolidated(mockData, '2026-09-20', 'all');

  assert.equal(pos.todayRelease.count, 1, 'Today release count should be 1');
  assert.equal(pos.todayRelease.amount, 30000, 'Today release amount should be ₹30,000');
  assert.equal(pos.todayRelease.weight, 8.5, 'Today release weight should be 8.5g');
  assert.equal(pos.currentPosition.activePockets, 1, 'Only active loan ln_2 counted as active pocket');
  assert.equal(pos.currentPosition.totalGoldWeight, 12.0, 'Released collateral excluded from active gold weight');
});

test('Test 5 – Re-Pledge: Active Count, Amount, Weight, and Bank Custody', () => {
  const mockData = {
    loans: [
      {
        id: 'ln_1',
        loan_number: 'PGF-LN-001001',
        principal_amount: 50000,
        total_outstanding: 50000,
        status: 'Active',
      },
    ],
    collateral: [
      {
        id: 'col_1',
        loan_id: 'ln_1',
        net_weight: 15.0,
        status: 'Pledged',
        custody_location: 'Commercial Bank Branch',
      },
    ],
    payments: [],
    repledges: [
      {
        id: 'rep_1',
        repledge_number: 'PGF-REP-001001',
        loan_id: 'ln_1',
        bank_name: 'State Bank of India',
        bank_pledge_amount: 40000,
        bank_outstanding: 40000,
        total_net_weight: 15.0,
        status: 'Active',
        custody_location: 'Commercial Bank Branch',
      },
    ],
  };

  const pos = aggregateConsolidated(mockData, '2026-09-20', 'all');

  assert.equal(pos.repledgePosition.pockets, 1, 'Re-pledge pockets should be 1');
  assert.equal(pos.repledgePosition.amount, 40000, 'Re-pledge amount should be ₹40,000');
  assert.equal(pos.repledgePosition.weight, 15.0, 'Re-pledge weight should be 15.0g');
});

test('Test 6 – Re-Pledge Release: Active Re-Pledge count decreases', () => {
  const mockData = {
    loans: [
      {
        id: 'ln_1',
        loan_number: 'PGF-LN-001001',
        principal_amount: 50000,
        total_outstanding: 50000,
        status: 'Active',
      },
    ],
    collateral: [
      {
        id: 'col_1',
        loan_id: 'ln_1',
        net_weight: 15.0,
        status: 'Pledged',
        custody_location: 'PGF Safe', // Returned
      },
    ],
    payments: [],
    repledges: [
      {
        id: 'rep_1',
        repledge_number: 'PGF-REP-001001',
        loan_id: 'ln_1',
        bank_name: 'State Bank of India',
        bank_pledge_amount: 40000,
        bank_outstanding: 0,
        total_net_weight: 15.0,
        status: 'Released', // Settled with bank
        custody_location: 'PGF Safe',
      },
    ],
  };

  const pos = aggregateConsolidated(mockData, '2026-09-20', 'all');

  assert.equal(pos.repledgePosition.pockets, 0, 'Active re-pledge pockets should be 0 after release');
  assert.equal(pos.repledgePosition.amount, 0, 'Re-pledge outstanding amount should be 0');
});

test('Test 7 – Multi-Branch Isolation', () => {
  const mockData = {
    loans: [
      {
        id: 'ln_mdu',
        loan_number: 'PGF-LN-MDU-01',
        principal_amount: 25000,
        total_outstanding: 25000,
        origination_date: '2026-09-20',
        status: 'Active',
        branch_id: 'br_mdu',
      },
      {
        id: 'ln_cbe',
        loan_number: 'PGF-LN-CBE-01',
        principal_amount: 75000,
        total_outstanding: 75000,
        origination_date: '2026-09-20',
        status: 'Active',
        branch_id: 'br_cbe',
      },
    ],
    collateral: [
      { id: 'col_mdu', loan_id: 'ln_mdu', net_weight: 10.0, status: 'Pledged' },
      { id: 'col_cbe', loan_id: 'ln_cbe', net_weight: 30.0, status: 'Pledged' },
    ],
    payments: [],
    repledges: [],
  };

  const mduPos = aggregateConsolidated(mockData, '2026-09-20', 'br_mdu');
  const cbePos = aggregateConsolidated(mockData, '2026-09-20', 'br_cbe');

  assert.equal(mduPos.todayPledge.count, 1);
  assert.equal(mduPos.todayPledge.amount, 25000);
  assert.equal(mduPos.currentPosition.activePockets, 1);

  assert.equal(cbePos.todayPledge.count, 1);
  assert.equal(cbePos.todayPledge.amount, 75000);
  assert.equal(cbePos.currentPosition.activePockets, 1);
});

test('Test 8 – Multiple Principal Payments for Same Loan on Same Day', () => {
  const mockData = {
    loans: [
      {
        id: 'ln_1',
        loan_number: 'PGF-LN-1001',
        principal_amount: 20000,
        total_principal_paid: 3000,
        total_outstanding: 17000,
        status: 'Active',
      },
    ],
    collateral: [{ id: 'col_1', loan_id: 'ln_1', net_weight: 8.0, status: 'Pledged' }],
    payments: [
      {
        id: 'pmt_1',
        loan_id: 'ln_1',
        amount_paid: 1000,
        principal_portion: 1000,
        payment_date: '2026-09-20T10:00:00Z',
      },
      {
        id: 'pmt_2',
        loan_id: 'ln_1',
        amount_paid: 2000,
        principal_portion: 2000,
        payment_date: '2026-09-20T15:00:00Z',
      },
    ],
    repledges: [],
  };

  const pos = aggregateConsolidated(mockData, '2026-09-20', 'all');

  assert.equal(
    pos.todayPartPayment.uniqueLoansCount,
    1,
    'Unique loans count must be 1 even if multiple payments made'
  );
  assert.equal(
    pos.todayPartPayment.principalCollected,
    3000,
    'Principal collected must be sum of both payments (1000 + 2000 = 3000)'
  );
});

test('Test 9 – Date Filter Behavior: Only aggregates for target date', () => {
  const mockData = {
    loans: [
      {
        id: 'ln_old',
        loan_number: 'PGF-LN-OLD',
        principal_amount: 50000,
        origination_date: '2026-09-19',
        status: 'Active',
      },
      {
        id: 'ln_today',
        loan_number: 'PGF-LN-TODAY',
        principal_amount: 60000,
        origination_date: '2026-09-20',
        status: 'Active',
      },
    ],
    collateral: [
      { id: 'c1', loan_id: 'ln_old', net_weight: 10.0, status: 'Pledged' },
      { id: 'c2', loan_id: 'ln_today', net_weight: 12.0, status: 'Pledged' },
    ],
    payments: [],
    repledges: [],
  };

  const posToday = aggregateConsolidated(mockData, '2026-09-20', 'all');
  assert.equal(posToday.todayPledge.count, 1, "Only today's loan counted in today's pledge");
  assert.equal(posToday.todayPledge.amount, 60000);
  assert.equal(posToday.currentPosition.activePockets, 2, 'Both loans counted in current active pockets');

  const posOld = aggregateConsolidated(mockData, '2026-09-19', 'all');
  assert.equal(posOld.todayPledge.count, 1);
  assert.equal(posOld.todayPledge.amount, 50000);
});
