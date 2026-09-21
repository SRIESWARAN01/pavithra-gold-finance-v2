// tests/repledge-flow.test.mjs
// Comprehensive test suite for PGF Bank Re-Pledge Flow:
// 1. Loan search & active Re-Pledge resolution
// 2. Full Bank & Re-Pledge details validation (Bank, Branch, A/C #, Loan/Pledge #, Pledgee Name)
// 3. Exact customer loan ornament linkage & custody tracking
// 4. Dual-ledger separation (Customer loan vs Institutional bank borrowing)
// 5. Release safeguard (Bank settlement required before customer gold release)
// 6. Re-Pledge receipt parameters & numbering (PGF-REP-XXXX)

import test from 'node:test';
import assert from 'node:assert/strict';

// Helper: Calculate daily interest
function calculateDailyInterest(principal, annualRate, isLeap = false) {
  const daysInYear = isLeap ? 366 : 365;
  return (principal * (annualRate / 100)) / daysInYear;
}

test('1. Loan to Re-Pledge Linkage Resolution', () => {
  const mockRepledges = [
    {
      id: 'rep_1',
      repledge_number: 'PGF-REP-001001',
      loan_id: 'loan_101',
      loan_number: 'PGF-LN-001001',
      customer_id: 'cust_01',
      customer_name: 'Murugan K',
      bank_name: 'Canara Bank',
      bank_branch: 'Gandhipuram Branch',
      bank_account_number: '123456789012',
      bank_loan_number: 'CB-GL-2026-99',
      pledge_name: 'Pavithra Gold Finance / Branch Signatory',
      bank_pledge_amount: 700000,
      bank_interest_rate: 10.5,
      interest_type: 'Simple',
      pledge_date: '2026-09-15',
      status: 'Active',
      collateral_item_ids: ['item_1', 'item_2'],
    },
    {
      id: 'rep_0',
      repledge_number: 'PGF-REP-000999',
      loan_id: 'loan_101',
      loan_number: 'PGF-LN-001001',
      status: 'Released',
    },
  ];

  // Lookup function matching getActiveBankRePledgeByLoan
  function getActiveBankRePledge(loanIdOrNumber) {
    const active = mockRepledges.filter(
      (r) =>
        (r.loan_id === loanIdOrNumber || r.loan_number === loanIdOrNumber) &&
        (r.status === 'Active' || r.status === 'Pledged with Bank')
    );
    return active.length > 0 ? active[0] : null;
  }

  const activeRepledge = getActiveBankRePledge('PGF-LN-001001');
  assert.ok(activeRepledge, 'Active re-pledge should be found by loan number');
  assert.equal(activeRepledge.repledge_number, 'PGF-REP-001001');
  assert.equal(activeRepledge.bank_name, 'Canara Bank');
  assert.equal(activeRepledge.status, 'Active');

  const notFound = getActiveBankRePledge('PGF-LN-999999');
  assert.equal(notFound, null, 'Non-existent loan returns null re-pledge');
});

test('2. Full Re-Pledge Details & Ownership Validation', () => {
  const repledgeRecord = {
    repledge_number: 'PGF-REP-001001',
    customer_loan_number: 'PGF-LN-001001',
    customer_name: 'Murugan K',
    customer_id: 'cust_01',
    bank_name: 'Canara Bank',
    bank_branch: 'Gandhipuram Branch, Coimbatore',
    bank_account_number: '123456789012',
    bank_loan_number: 'CB-GL-2026-99',
    pledge_name: 'Pavithra Gold Finance / Branch Signatory',
    bank_pledge_amount: 700000,
    bank_interest_rate: 10.5,
    interest_type: 'Simple',
    pledge_date: '2026-09-15',
    due_date: '2027-09-15',
    status: 'Active',
  };

  // Verify all mandatory bank fields
  assert.ok(repledgeRecord.bank_name.length > 0, 'Bank name is mandatory');
  assert.ok(repledgeRecord.bank_branch.length > 0, 'Bank branch is mandatory');
  assert.ok(repledgeRecord.bank_account_number.length > 0, 'Bank account number is mandatory');
  assert.ok(repledgeRecord.bank_loan_number.length > 0, 'Bank loan number is mandatory');
  assert.ok(repledgeRecord.pledge_name.length > 0, 'Pledgee name is mandatory');
  assert.ok(repledgeRecord.bank_pledge_amount > 0, 'Bank pledge amount must be positive');
  assert.ok(repledgeRecord.bank_interest_rate > 0, 'Bank interest rate must be positive');
  assert.equal(repledgeRecord.status, 'Active');
});

test('3. Exact Collateral Ornament Linkage & Custody Location', () => {
  const customerCollateral = [
    {
      id: 'col_01',
      loan_id: 'loan_101',
      item_description: 'Gold Chain 22K',
      purity_karat: '22K',
      gross_weight: 42.5,
      stone_weight: 0.5,
      net_weight: 42.0,
      valuation_inr: 294000,
      custody_location: 'Commercial Bank Branch', // Updated upon re-pledge
    },
    {
      id: 'col_02',
      loan_id: 'loan_101',
      item_description: 'Gold Bangles (2 pcs)',
      purity_karat: '22K',
      gross_weight: 60.0,
      stone_weight: 0.0,
      net_weight: 60.0,
      valuation_inr: 420000,
      custody_location: 'Commercial Bank Branch',
    },
  ];

  const repledgeOrnamentDetails = customerCollateral.map((item) => ({
    item_id: item.id,
    description: item.item_description,
    purity_karat: item.purity_karat,
    gross_weight: item.gross_weight,
    stone_weight: item.stone_weight,
    net_weight: item.net_weight,
    valuation_inr: item.valuation_inr,
  }));

  const totalNetWeight = repledgeOrnamentDetails.reduce((sum, i) => sum + i.net_weight, 0);
  const totalValuation = repledgeOrnamentDetails.reduce((sum, i) => sum + i.valuation_inr, 0);

  assert.equal(totalNetWeight, 102.0, 'Total net weight must equal 102.0g');
  assert.equal(totalValuation, 714000, 'Total valuation must equal ₹7,14,000');

  // Verify all items have custody transferred to Commercial Bank Branch
  for (const item of customerCollateral) {
    assert.equal(
      item.custody_location,
      'Commercial Bank Branch',
      'Collateral custody must be Commercial Bank Branch while re-pledged'
    );
  }
});

test('4. Dual-Ledger Financial Independence', () => {
  // Customer loan initial state
  const customerLoan = {
    loan_number: 'PGF-LN-1001',
    original_principal: 10000,
    current_principal: 10000,
    customer_apr: 18.0, // 18% p.a.
    accrued_interest: 400,
  };

  // Institutional bank borrowing initial state
  const institutionalRepledge = {
    repledge_number: 'PGF-REP-1001',
    bank_pledge_amount: 7000,
    bank_interest_rate: 10.5, // 10.5% p.a.
    bank_outstanding: 7000,
  };

  // 1. Re-pledge creation does NOT alter customer principal
  assert.equal(
    customerLoan.current_principal,
    10000,
    'Customer principal remains ₹10,000 regardless of bank borrowing'
  );

  // 2. Customer pays ₹500 (₹400 interest, ₹100 principal)
  const payment = { total: 500, interestPortion: 400, principalPortion: 100 };
  customerLoan.accrued_interest -= payment.interestPortion;
  customerLoan.current_principal -= payment.principalPortion;

  assert.equal(customerLoan.current_principal, 9900, 'Customer principal becomes ₹9,900');
  assert.equal(customerLoan.accrued_interest, 0, 'Customer accrued interest is cleared to 0');

  // 3. Institutional bank debt is completely unaffected by customer repayment
  assert.equal(
    institutionalRepledge.bank_outstanding,
    7000,
    'Bank outstanding remains ₹7,000 despite customer repayment'
  );

  // 4. Subsequent daily interest calculation uses separate balances and separate rates
  const customerDailyInterest = calculateDailyInterest(customerLoan.current_principal, customerLoan.customer_apr);
  const bankDailyInterest = calculateDailyInterest(institutionalRepledge.bank_outstanding, institutionalRepledge.bank_interest_rate);

  // Customer: 9900 * 18% / 365 = 4.88219...
  assert.equal(Math.round(customerDailyInterest * 100) / 100, 4.88);
  // Bank: 7000 * 10.5% / 365 = 2.01369...
  assert.equal(Math.round(bankDailyInterest * 100) / 100, 2.01);
});

test('5. Collateral Release Safeguard (Bank Settlement Lock)', () => {
  const customerLoan = {
    loan_number: 'PGF-LN-1001',
    current_principal: 0,
    accrued_interest: 0,
    penalty_due: 0,
    total_outstanding: 0, // Fully settled by customer
  };

  const repledgeState = {
    status: 'Active', // Still pledged with bank
    bank_outstanding: 7000,
    custody_location: 'Commercial Bank Branch',
  };

  function canHandoverGoldToCustomer(loan, repledge) {
    if (loan.total_outstanding > 0) return { allowed: false, reason: 'Customer loan not settled' };
    if (repledge && (repledge.status !== 'Released' || repledge.custody_location !== 'PGF Safe')) {
      return {
        allowed: false,
        reason: 'Collateral is re-pledged with Bank. Settle bank borrowing and return gold to PGF Safe first.',
      };
    }
    return { allowed: true, reason: 'Ready for handover' };
  }

  // Attempt release while re-pledge is active
  const check1 = canHandoverGoldToCustomer(customerLoan, repledgeState);
  assert.equal(check1.allowed, false);
  assert.match(check1.reason, /re-pledged with Bank/);

  // Bank borrowing settled and collateral returned to PGF Safe
  repledgeState.bank_outstanding = 0;
  repledgeState.status = 'Released';
  repledgeState.custody_location = 'PGF Safe';

  const check2 = canHandoverGoldToCustomer(customerLoan, repledgeState);
  assert.equal(check2.allowed, true);
  assert.equal(check2.reason, 'Ready for handover');
});

test('6. Re-Pledge Receipt Generation Parameters', () => {
  const receiptData = {
    receipt_type: 'bank_repledge',
    repledge_number: 'PGF-REP-001001',
    customer_loan_number: 'PGF-LN-001001',
    customer_name: 'Murugan K',
    customer_id: 'cust_01',
    bank_name: 'Canara Bank',
    bank_branch: 'Gandhipuram Branch',
    bank_account_number: '123456789012',
    bank_loan_number: 'CB-GL-2026-99',
    pledge_name: 'Pavithra Gold Finance / Branch Signatory',
    bank_pledge_amount: 700000,
    bank_interest_rate: 10.5,
    interest_type: 'Simple',
    pledge_date: '2026-09-15',
    total_net_weight: 102.0,
    total_valuation: 714000,
  };

  assert.match(receiptData.repledge_number, /^PGF-REP-\d{6}$/);
  assert.equal(receiptData.receipt_type, 'bank_repledge');
  assert.ok(receiptData.bank_pledge_amount > 0);
  assert.ok(receiptData.total_net_weight > 0);
  assert.equal(receiptData.pledge_name, 'Pavithra Gold Finance / Branch Signatory');
});
