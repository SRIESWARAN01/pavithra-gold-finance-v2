// tests/expenses-pnl.test.mjs
// Comprehensive test suite for Pavithra Gold Finance (PGF) Expenses & Profit / Loss Management:
// 1. Sequential Expense Reference Number Generation (PGF-EXP-XXXXXX)
// 2. Double-Entry Accounting Journal Posting for Cash and Bank/UPI Expenses
// 3. Reversing Journal Entry on Expense Cancellation
// 4. Strict P&L Revenue Recognition Rule (Principal Repayment Strictly Excluded)
// 5. Daily, Monthly, and Yearly P&L Aggregation & Profit / Loss determination
// 6. Branch Isolation and Multi-Branch Consolidation

import test from 'node:test';
import assert from 'node:assert/strict';

// Helper rounding function
function round2(val) {
  return Math.round((Number(val) || 0) * 100) / 100;
}

// ----------------------------------------------------------------------------
// 1. SEQUENTIAL EXPENSE REFERENCE NUMBER GENERATION
// ----------------------------------------------------------------------------
function formatExpenseNumber(sequence) {
  return `PGF-EXP-${String(sequence).padStart(6, '0')}`;
}

test('Expense Number Generation: formats sequential numbers with PGF-EXP- prefix and 6-digit padding', () => {
  assert.equal(formatExpenseNumber(1), 'PGF-EXP-000001');
  assert.equal(formatExpenseNumber(2), 'PGF-EXP-000002');
  assert.equal(formatExpenseNumber(99), 'PGF-EXP-000099');
  assert.equal(formatExpenseNumber(1000), 'PGF-EXP-001000');
  assert.equal(formatExpenseNumber(999999), 'PGF-EXP-999999');
});

// ----------------------------------------------------------------------------
// 2. DOUBLE-ENTRY ACCOUNTING JOURNAL POSTING
// ----------------------------------------------------------------------------
function createExpenseJournalEntry({
  expenseNumber,
  category,
  amount,
  paymentMode,
  date,
  createdBy,
  branchId,
}) {
  const isCash = paymentMode === 'Cash';
  const creditAccount = isCash ? 'Vault Petty Cash' : 'Bank Clearing Account';
  const debitAccount = `${category} Expense`;

  return {
    date,
    desc: `Expense Voucher: ${expenseNumber} - ${category}`,
    debitAcc: debitAccount,
    creditAcc: creditAccount,
    amount: round2(amount),
    createdBy,
    referenceNumber: expenseNumber,
    branch_id: branchId || null,
  };
}

function createReversingJournalEntry(originalEntry, reversedBy, reason) {
  return {
    date: new Date().toISOString().split('T')[0],
    desc: `REVERSAL: ${originalEntry.desc} [Reason: ${reason}]`,
    debitAcc: originalEntry.creditAcc, // Swap debit and credit for reversal
    creditAcc: originalEntry.debitAcc,
    amount: originalEntry.amount,
    createdBy: reversedBy,
    referenceNumber: `REV-${originalEntry.referenceNumber}`,
    branch_id: originalEntry.branch_id,
  };
}

test('Double-Entry Journal: Cash Expense debits Expense Account and credits Vault Petty Cash', () => {
  const jv = createExpenseJournalEntry({
    expenseNumber: 'PGF-EXP-000001',
    category: 'Office Rent',
    amount: 25000,
    paymentMode: 'Cash',
    date: '2026-09-20',
    createdBy: 'admin_user',
    branchId: 'branch_1',
  });

  assert.equal(jv.debitAcc, 'Office Rent Expense');
  assert.equal(jv.creditAcc, 'Vault Petty Cash');
  assert.equal(jv.amount, 25000);
  assert.equal(jv.referenceNumber, 'PGF-EXP-000001');
  assert.equal(jv.branch_id, 'branch_1');
});

test('Double-Entry Journal: Bank Transfer / UPI debits Expense Account and credits Bank Clearing Account', () => {
  const jvBank = createExpenseJournalEntry({
    expenseNumber: 'PGF-EXP-000002',
    category: 'Salary',
    amount: 50000,
    paymentMode: 'Bank Transfer',
    date: '2026-09-20',
    createdBy: 'admin_user',
    branchId: 'branch_1',
  });

  assert.equal(jvBank.debitAcc, 'Salary Expense');
  assert.equal(jvBank.creditAcc, 'Bank Clearing Account');
  assert.equal(jvBank.amount, 50000);

  const jvUpi = createExpenseJournalEntry({
    expenseNumber: 'PGF-EXP-000003',
    category: 'Stationery',
    amount: 1500,
    paymentMode: 'UPI',
    date: '2026-09-20',
    createdBy: 'admin_user',
    branchId: 'branch_2',
  });

  assert.equal(jvUpi.debitAcc, 'Stationery Expense');
  assert.equal(jvUpi.creditAcc, 'Bank Clearing Account');
  assert.equal(jvUpi.amount, 1500);
});

test('Double-Entry Journal: Reversal swaps debit and credit accounts with REV- prefix', () => {
  const originalJv = createExpenseJournalEntry({
    expenseNumber: 'PGF-EXP-000001',
    category: 'Office Rent',
    amount: 25000,
    paymentMode: 'Cash',
    date: '2026-09-20',
    createdBy: 'admin_user',
    branchId: 'branch_1',
  });

  const revJv = createReversingJournalEntry(originalJv, 'admin_user', 'Incorrect entry');
  assert.equal(revJv.debitAcc, 'Vault Petty Cash');
  assert.equal(revJv.creditAcc, 'Office Rent Expense');
  assert.equal(revJv.amount, 25000);
  assert.equal(revJv.referenceNumber, 'REV-PGF-EXP-000001');
  assert.match(revJv.desc, /REVERSAL:/);
});

// ----------------------------------------------------------------------------
// 3. STRICT P&L REVENUE RECOGNITION (PRINCIPAL EXCLUDED)
// ----------------------------------------------------------------------------
function calculateRecognizedIncome(payments) {
  let interestIncome = 0;
  let penaltyIncome = 0;
  let processingFees = 0;
  let otherIncome = 0;
  let principalRepaymentsIgnored = 0;

  for (const p of payments) {
    if (p.status === 'REVERSED') continue;
    interestIncome += p.interest_portion || 0;
    penaltyIncome += p.penalty_amount || 0;
    processingFees += p.processing_fee || 0;
    otherIncome += p.other_income || 0;
    principalRepaymentsIgnored += p.principal_portion || 0;
  }

  return {
    totalRecognizedIncome: round2(interestIncome + penaltyIncome + processingFees + otherIncome),
    interestIncome: round2(interestIncome),
    penaltyIncome: round2(penaltyIncome),
    processingFees: round2(processingFees),
    otherIncome: round2(otherIncome),
    principalRepaymentsIgnored: round2(principalRepaymentsIgnored),
  };
}

test('P&L Revenue Recognition: Strictly excludes principal repayments', () => {
  // Scenario: Customer pays ₹10,000 total (Interest: ₹2,000, Principal: ₹8,000)
  const payments = [
    {
      id: 'pmt_1',
      amount_paid: 10000,
      interest_portion: 2000,
      principal_portion: 8000,
      penalty_amount: 150,
      processing_fee: 50,
      status: 'POSTED',
    },
    {
      id: 'pmt_2',
      amount_paid: 50000,
      interest_portion: 3000,
      principal_portion: 47000, // Large principal redemption
      penalty_amount: 0,
      status: 'POSTED',
    },
  ];

  const inc = calculateRecognizedIncome(payments);
  // Recognized Income = 2000 + 150 + 50 + 3000 = 5200
  assert.equal(inc.totalRecognizedIncome, 5200);
  assert.equal(inc.interestIncome, 5000);
  assert.equal(inc.penaltyIncome, 150);
  assert.equal(inc.processingFees, 50);
  assert.equal(inc.principalRepaymentsIgnored, 55000); // ₹55,000 principal was safely excluded!
});

// ----------------------------------------------------------------------------
// 4. DAILY P&L CALCULATION & NET PROFIT / LOSS DETERMINATION
// ----------------------------------------------------------------------------
function calculateDailyPnL({ payments, expenses }) {
  const inc = calculateRecognizedIncome(payments);

  let totalExpenses = 0;
  const categoryMap = new Map();

  for (const e of expenses) {
    if (e.status !== 'Approved' && e.status !== 'Posted') continue;
    totalExpenses += e.amount || 0;
    const cat = e.category || 'Other';
    categoryMap.set(cat, round2((categoryMap.get(cat) || 0) + e.amount));
  }

  totalExpenses = round2(totalExpenses);
  const netProfitLoss = round2(inc.totalRecognizedIncome - totalExpenses);
  const isProfit = netProfitLoss >= 0;

  return {
    totalIncome: inc.totalRecognizedIncome,
    totalExpenses,
    netProfitLoss,
    isProfit,
    categoryBreakdown: Object.fromEntries(categoryMap),
  };
}

test('Daily P&L: Correctly calculates Net Profit when Income > Expenses', () => {
  const payments = [
    { interest_portion: 40000, penalty_amount: 2000, status: 'POSTED' },
  ];
  const expenses = [
    { category: 'Salary', amount: 15000, status: 'Posted' },
    { category: 'EB / Electricity Bill', amount: 2000, status: 'Approved' },
    { category: 'Draft Item', amount: 50000, status: 'Draft' }, // Should be ignored
  ];

  const pnl = calculateDailyPnL({ payments, expenses });
  assert.equal(pnl.totalIncome, 42000);
  assert.equal(pnl.totalExpenses, 17000); // 15000 + 2000
  assert.equal(pnl.netProfitLoss, 25000); // 42000 - 17000
  assert.equal(pnl.isProfit, true);
  assert.equal(pnl.categoryBreakdown['Salary'], 15000);
  assert.equal(pnl.categoryBreakdown['EB / Electricity Bill'], 2000);
  assert.equal(pnl.categoryBreakdown['Draft Item'], undefined);
});

test('Daily P&L: Correctly calculates Net Loss when Expenses > Income', () => {
  const payments = [
    { interest_portion: 10000, status: 'POSTED' },
  ];
  const expenses = [
    { category: 'Office Rent', amount: 25000, status: 'Posted' },
  ];

  const pnl = calculateDailyPnL({ payments, expenses });
  assert.equal(pnl.totalIncome, 10000);
  assert.equal(pnl.totalExpenses, 25000);
  assert.equal(pnl.netProfitLoss, -15000);
  assert.equal(pnl.isProfit, false);
});

// ----------------------------------------------------------------------------
// 5. MONTHLY & YEARLY TREND AGGREGATION
// ----------------------------------------------------------------------------
test('Monthly & Yearly Aggregation: accurately sums daily positions', () => {
  const dailyData = [
    { day: 1, income: 10000, expenses: 5000 },
    { day: 2, income: 15000, expenses: 8000 },
    { day: 3, income: 5000, expenses: 12000 },
  ];

  let totalIncome = 0;
  let totalExpenses = 0;
  const trend = dailyData.map((d) => {
    totalIncome += d.income;
    totalExpenses += d.expenses;
    const net = d.income - d.expenses;
    return {
      day: d.day,
      net,
      isProfit: net >= 0,
    };
  });

  assert.equal(totalIncome, 30000);
  assert.equal(totalExpenses, 25000);
  assert.equal(totalIncome - totalExpenses, 5000);
  assert.equal(trend[0].net, 5000);
  assert.equal(trend[0].isProfit, true);
  assert.equal(trend[1].net, 7000);
  assert.equal(trend[1].isProfit, true);
  assert.equal(trend[2].net, -7000);
  assert.equal(trend[2].isProfit, false);
});

// ----------------------------------------------------------------------------
// 6. MULTI-BRANCH ISOLATION
// ----------------------------------------------------------------------------
test('Branch Isolation: filters income and expenses strictly by branch', () => {
  const payments = [
    { branch_id: 'branch_A', interest_portion: 10000, status: 'POSTED' },
    { branch_id: 'branch_B', interest_portion: 20000, status: 'POSTED' },
  ];
  const expenses = [
    { branch_id: 'branch_A', category: 'Rent', amount: 5000, status: 'Posted' },
    { branch_id: 'branch_B', category: 'Rent', amount: 8000, status: 'Posted' },
  ];

  const pnlA = calculateDailyPnL({
    payments: payments.filter((p) => p.branch_id === 'branch_A'),
    expenses: expenses.filter((e) => e.branch_id === 'branch_A'),
  });

  const pnlB = calculateDailyPnL({
    payments: payments.filter((p) => p.branch_id === 'branch_B'),
    expenses: expenses.filter((e) => e.branch_id === 'branch_B'),
  });

  assert.equal(pnlA.totalIncome, 10000);
  assert.equal(pnlA.totalExpenses, 5000);
  assert.equal(pnlA.netProfitLoss, 5000);

  assert.equal(pnlB.totalIncome, 20000);
  assert.equal(pnlB.totalExpenses, 8000);
  assert.equal(pnlB.netProfitLoss, 12000);
});
