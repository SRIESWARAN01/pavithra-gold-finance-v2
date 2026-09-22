// tests/gold-appraisal.test.mjs
// Gold Collateral Valuation, Multi-Ornament Appraisal, Purity, and 75% LTV Cap Tests

import test from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Purity Karatage Conversion Map
// ---------------------------------------------------------------------------
const PURITY_FACTORS = {
  '24K': 0.999,
  '22K': 0.916,
  '20K': 0.833,
  '18K': 0.750,
};

// ---------------------------------------------------------------------------
// Appraisal Calculation Engine
// ---------------------------------------------------------------------------
function calculateOrnamentAppraisal(ornament) {
  const gross = Number(ornament.gross_weight) || 0;
  const stone = Number(ornament.stone_weight) || 0;

  if (stone > gross) {
    throw new Error(`Stone weight (${stone}g) cannot exceed gross weight (${gross}g)`);
  }

  const net = Math.round((gross - stone) * 1000) / 1000;
  const purity = ornament.purity || '22K';
  const factor = PURITY_FACTORS[purity] || PURITY_FACTORS['22K'];
  const pureGoldEquivalent = Math.round((net * factor) * 1000) / 1000;

  return {
    ...ornament,
    gross_weight: gross,
    stone_weight: stone,
    net_weight: net,
    purity,
    pure_gold_equivalent: pureGoldEquivalent,
  };
}

function calculateMultiOrnamentSummary(ornaments, goldRatePerGram = 6500) {
  if (!ornaments || ornaments.length === 0) {
    throw new Error('At least one ornament must be appraised');
  }

  let totalGross = 0;
  let totalStone = 0;
  let totalNet = 0;
  let totalPureGold = 0;

  const appraisedItems = ornaments.map((item) => {
    const appraised = calculateOrnamentAppraisal(item);
    totalGross += appraised.gross_weight;
    totalStone += appraised.stone_weight;
    totalNet += appraised.net_weight;
    totalPureGold += appraised.pure_gold_equivalent;
    return appraised;
  });

  totalGross = Math.round(totalGross * 1000) / 1000;
  totalStone = Math.round(totalStone * 1000) / 1000;
  totalNet = Math.round(totalNet * 1000) / 1000;
  totalPureGold = Math.round(totalPureGold * 1000) / 1000;

  // Market value based on 22K standard market benchmark
  const marketValue = Math.round(totalNet * goldRatePerGram);
  // RBI Statutory LTV Cap: 75% of market value
  const maxEligibleLoan = Math.floor(marketValue * 0.75);
  // Auction Reserve Price: 95% of benchmark market value
  const auctionReservePrice = Math.round(totalNet * goldRatePerGram * 0.95);

  return {
    item_count: appraisedItems.length,
    items: appraisedItems,
    total_gross_weight: totalGross,
    total_stone_weight: totalStone,
    total_net_weight: totalNet,
    total_pure_gold: totalPureGold,
    gold_rate_per_gram: goldRatePerGram,
    market_value: marketValue,
    max_eligible_loan: maxEligibleLoan,
    auction_reserve_price: auctionReservePrice,
  };
}

function validateLoanAgainstLTV(requestedAmount, maxEligibleLoan) {
  const ltvPercentage = Math.round((requestedAmount / (maxEligibleLoan / 0.75)) * 10000) / 100;
  if (requestedAmount > maxEligibleLoan) {
    return {
      allowed: false,
      ltv: ltvPercentage,
      reason: `Requested loan ₹${requestedAmount} exceeds 75% LTV cap (₹${maxEligibleLoan})`
    };
  }
  return {
    allowed: true,
    ltv: ltvPercentage,
  };
}

// ---------------------------------------------------------------------------
// Test Suite: Gold Appraisal Engine
// ---------------------------------------------------------------------------

test('Gold Appraisal 1.1: Multi-ornament net weight summation is exact', () => {
  const ornaments = [
    { name: 'Gold Ring', gross_weight: 5.500, stone_weight: 0.500, purity: '22K' },
    { name: 'Gold Chain', gross_weight: 24.250, stone_weight: 1.250, purity: '22K' },
    { name: 'Bangles (Pair)', gross_weight: 18.000, stone_weight: 0.000, purity: '22K' },
  ];

  const summary = calculateMultiOrnamentSummary(ornaments, 6500);

  assert.equal(summary.item_count, 3);
  assert.equal(summary.total_gross_weight, 47.750);
  assert.equal(summary.total_stone_weight, 1.750);
  assert.equal(summary.total_net_weight, 46.000); // 47.75 - 1.75 = 46.0
  assert.equal(summary.market_value, 299000);    // 46g * ₹6,500 = ₹2,99,000
});

test('Gold Appraisal 1.2: 75% LTV Cap enforces statutory ceiling', () => {
  const ornaments = [
    { name: 'Gold Necklace', gross_weight: 32.000, stone_weight: 2.000, purity: '22K' },
  ]; // Net = 30g

  // At ₹7,000/g -> Market Value = ₹2,10,000
  // Max Eligible Loan (75%) = ₹1,57,500
  const summary = calculateMultiOrnamentSummary(ornaments, 7000);
  assert.equal(summary.total_net_weight, 30.000);
  assert.equal(summary.market_value, 210000);
  assert.equal(summary.max_eligible_loan, 157500);

  // Exact 75% requested -> ALLOWED
  const validCheck = validateLoanAgainstLTV(157500, summary.max_eligible_loan);
  assert.equal(validCheck.allowed, true);
  assert.equal(validCheck.ltv, 75.00);

  // ₹157,501 requested -> REJECTED
  const overCapCheck = validateLoanAgainstLTV(157501, summary.max_eligible_loan);
  assert.equal(overCapCheck.allowed, false);
  assert.match(overCapCheck.reason, /exceeds 75% LTV cap/);
});

test('Gold Appraisal 1.3: Rejects stone weight exceeding gross weight', () => {
  const invalidOrnament = [
    { name: 'Faulty Ring', gross_weight: 4.000, stone_weight: 5.500, purity: '22K' },
  ];
  assert.throws(
    () => calculateMultiOrnamentSummary(invalidOrnament, 6500),
    /cannot exceed gross weight/
  );
});

test('Gold Appraisal 1.4: Purity conversion calculates pure gold equivalent', () => {
  const items = [
    { name: '24K Coin', gross_weight: 10.000, stone_weight: 0.000, purity: '24K' },
    { name: '22K Ring', gross_weight: 10.000, stone_weight: 0.000, purity: '22K' },
    { name: '18K Brooch', gross_weight: 10.000, stone_weight: 0.000, purity: '18K' },
  ];

  const summary = calculateMultiOrnamentSummary(items, 6000);
  const appraised = summary.items;

  assert.equal(appraised[0].pure_gold_equivalent, 9.990); // 10 * 0.999
  assert.equal(appraised[1].pure_gold_equivalent, 9.160); // 10 * 0.916
  assert.equal(appraised[2].pure_gold_equivalent, 7.500); // 10 * 0.750
});

test('Gold Appraisal 1.5: Auction Reserve Price matches 95% market valuation benchmark', () => {
  const items = [
    { name: 'Gold Bangle', gross_weight: 20.000, stone_weight: 0.000, purity: '22K' }
  ];
  // 20g * ₹6,000 = ₹1,20,000 market value
  // Reserve price (95%) = ₹1,14,000
  const summary = calculateMultiOrnamentSummary(items, 6000);
  assert.equal(summary.market_value, 120000);
  assert.equal(summary.auction_reserve_price, 114000);
});
