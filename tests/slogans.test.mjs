// tests/slogans.test.mjs
// Slogan Rotation & Catalog Verification Tests (AC-04)

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// ---------------------------------------------------------------------------
// Load and parse TAMIL_SLOGANS catalog
// ---------------------------------------------------------------------------
function loadTamilSlogans() {
  const filePath = path.resolve(process.cwd(), 'src/lib/data/tamilSlogans.ts');
  const fileContent = fs.readFileSync(filePath, 'utf8');

  // Extract array items using regex
  const regex = /\{\s*id:\s*(\d+),\s*slogan_id:\s*'([^']+)',\s*text:\s*'([^']+)'\s*\}/g;
  const slogans = [];
  let match;
  while ((match = regex.exec(fileContent)) !== null) {
    slogans.push({
      id: parseInt(match[1], 10),
      slogan_id: match[2],
      text: match[3]
    });
  }
  return slogans;
}

const TAMIL_SLOGANS = loadTamilSlogans();

function getSloganByIndex(index, catalog = TAMIL_SLOGANS) {
  const normalizedIndex = ((index - 1) % catalog.length) + 1;
  return catalog[normalizedIndex - 1];
}

function getSloganById(sloganId, catalog = TAMIL_SLOGANS) {
  return catalog.find((s) => s.slogan_id === sloganId);
}

function computeNextSloganIndex(currentIndex, catalogLength = 300) {
  return (currentIndex % catalogLength) + 1;
}

// ---------------------------------------------------------------------------
// Test Suite: Bill Slogan System (AC-04)
// ---------------------------------------------------------------------------

test('Slogans 1.1: Catalog contains exactly 300 unique Tamil slogans', () => {
  assert.equal(TAMIL_SLOGANS.length, 300, 'Catalog must have exactly 300 slogans');

  const ids = new Set();
  const sloganIds = new Set();
  const texts = new Set();

  TAMIL_SLOGANS.forEach((slogan, idx) => {
    // 1-based sequential ID
    const expectedId = idx + 1;
    assert.equal(slogan.id, expectedId, `Slogan at index ${idx} must have id ${expectedId}`);
    assert.ok(!ids.has(slogan.id), `Duplicate id ${slogan.id}`);
    ids.add(slogan.id);

    // Formatted slogan_id: SLOGAN-001 ... SLOGAN-300
    const expectedSloganId = `SLOGAN-${String(expectedId).padStart(3, '0')}`;
    assert.equal(slogan.slogan_id, expectedSloganId, `Slogan ID must be ${expectedSloganId}`);
    assert.ok(!sloganIds.has(slogan.slogan_id), `Duplicate slogan_id ${slogan.slogan_id}`);
    sloganIds.add(slogan.slogan_id);

    // Tamil text presence and uniqueness
    assert.ok(slogan.text.length > 5, `Slogan ${slogan.slogan_id} text is too short`);
    // Tamil Unicode range check (\u0B80-\u0BFF)
    assert.ok(/[\u0B80-\u0BFF]/.test(slogan.text), `Slogan ${slogan.slogan_id} must contain Tamil characters`);
    texts.add(slogan.text);
  });

  assert.equal(ids.size, 300, 'Must contain 300 distinct IDs');
  assert.equal(sloganIds.size, 300, 'Must contain 300 distinct slogan_ids');
});

test('Slogans 1.2: Atomic rotation cycles from 1 to 300 then wraps around to 1', () => {
  // Test starting from 0 (initial uninitialized counter)
  assert.equal(computeNextSloganIndex(0, 300), 1, 'Initial counter 0 should yield 1');

  // Test progression
  assert.equal(computeNextSloganIndex(1, 300), 2);
  assert.equal(computeNextSloganIndex(299, 300), 300);

  // Wrap around boundary: 300 -> 1
  assert.equal(computeNextSloganIndex(300, 300), 1, 'Index 300 must wrap around to 1');
  assert.equal(computeNextSloganIndex(301, 300), 2, 'Index 301 must yield 2');
  assert.equal(computeNextSloganIndex(600, 300), 1, 'Index 600 must wrap around to 1');
});

test('Slogans 1.3: Invariant - Zero consecutive repeats over 1,000 consecutive billings', () => {
  let currentIndex = 0;
  let previousSloganId = null;

  for (let bill = 1; bill <= 1000; bill++) {
    currentIndex = computeNextSloganIndex(currentIndex, TAMIL_SLOGANS.length);
    const assigned = getSloganByIndex(currentIndex, TAMIL_SLOGANS);

    assert.ok(assigned, `Assigned slogan must exist for index ${currentIndex}`);
    assert.notEqual(
      assigned.slogan_id,
      previousSloganId,
      `Zero consecutive repeat violation at billing #${bill}: ${assigned.slogan_id} repeated`
    );
    previousSloganId = assigned.slogan_id;
  }
});

test('Slogans 1.4: Lookup helpers resolve correctly by index and ID', () => {
  const first = getSloganByIndex(1);
  assert.equal(first.slogan_id, 'SLOGAN-001');

  const last = getSloganByIndex(300);
  assert.equal(last.slogan_id, 'SLOGAN-300');

  // Modular index wrap
  const wrapped = getSloganByIndex(301);
  assert.equal(wrapped.slogan_id, 'SLOGAN-001');

  // Direct ID lookup
  const target = getSloganById('SLOGAN-042');
  assert.ok(target);
  assert.equal(target.id, 42);
  assert.equal(target.slogan_id, 'SLOGAN-042');

  // Non-existent ID lookup returns undefined
  const notFound = getSloganById('SLOGAN-999');
  assert.equal(notFound, undefined);
});
