// tests/pdf-security.test.mjs
// Test suite for PDF authorization, document access control, photo normalization, and company settings validation.

import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Access control logic mirror from src/app/api/pdf/route.ts
 */
function checkDocumentAccess(caller, type, targetCustomerId) {
  const staffRoles = ['Admin', 'Owner', 'Manager', 'Appraiser', 'Cashier', 'Employee', 'Accountant'];
  const isStaff = staffRoles.includes(caller.role);

  if (isStaff) {
    return true;
  }

  if (caller.role === 'Customer') {
    const allowedCustomerDocTypes = [
      'ticket', 'pawn_ticket', 'loan_agreement',
      'receipt', 'payment_receipt', 'bill', 'payment_bill',
      'interest_receipt', 'principal_receipt', 'partial_receipt',
      'settlement_receipt', 'closure', 'loan_closure',
      'release', 'release_certificate', 'release_receipt', 'gold_release',
      'statement', 'loan_statement', 'customer_statement', 'outstanding_statement',
      'loan_application'
    ];

    if (!allowedCustomerDocTypes.includes(type)) {
      throw new Error('FORBIDDEN: Customers are not permitted to access internal accounting ledgers or audit reports.');
    }

    if (targetCustomerId && targetCustomerId !== caller.uid) {
      throw new Error('FORBIDDEN: You do not have permission to view or download documents belonging to another customer.');
    }

    return true;
  }

  throw new Error('FORBIDDEN: Insufficient permissions to access this document.');
}

/**
 * Collateral photo normalization mirror from src/app/api/pdf/route.ts
 */
function getCollateralPhotoUrls(items) {
  return items.flatMap(g => {
    const urls = [];
    if (g.front_photo_url) urls.push(g.front_photo_url);
    if (g.back_photo_url) urls.push(g.back_photo_url);
    if (g.side_photo_url) urls.push(g.side_photo_url);
    if (Array.isArray(g.photos)) urls.push(...g.photos);
    return urls;
  }).filter((url, idx, arr) => Boolean(url) && arr.indexOf(url) === idx);
}

/**
 * Company settings validation mirror from src/app/api/pdf/route.ts
 */
function validateCompanySettings(settings) {
  const required = ['company_name', 'company_address', 'company_phone', 'company_gst'];
  const missing = required.filter(k => !settings[k] || settings[k].trim() === '');
  return {
    isValid: missing.length === 0,
    missing,
  };
}

test('PDF Security: Staff can access any loan ticket or customer document', () => {
  const adminCaller = { uid: 'admin_1', role: 'Admin' };
  const managerCaller = { uid: 'mgr_1', role: 'Manager' };
  const cashierCaller = { uid: 'cash_1', role: 'Cashier' };

  assert.strictEqual(checkDocumentAccess(adminCaller, 'ticket', 'cust_999'), true);
  assert.strictEqual(checkDocumentAccess(managerCaller, 'receipt', 'cust_999'), true);
  assert.strictEqual(checkDocumentAccess(cashierCaller, 'release', 'cust_999'), true);
});

test('PDF Security: Staff can access financial ledgers and auditor reports', () => {
  const adminCaller = { uid: 'admin_1', role: 'Admin' };
  const accountantCaller = { uid: 'acc_1', role: 'Accountant' };

  assert.strictEqual(checkDocumentAccess(adminCaller, 'ledger', null), true);
  assert.strictEqual(checkDocumentAccess(accountantCaller, 'trial', null), true);
  assert.strictEqual(checkDocumentAccess(accountantCaller, 'monthly_auditor_report', null), true);
});

test('PDF Security: Customer can access their own pawn ticket, receipt, and statement', () => {
  const customerCaller = { uid: 'cust_123', role: 'Customer' };

  assert.strictEqual(checkDocumentAccess(customerCaller, 'ticket', 'cust_123'), true);
  assert.strictEqual(checkDocumentAccess(customerCaller, 'receipt', 'cust_123'), true);
  assert.strictEqual(checkDocumentAccess(customerCaller, 'customer_statement', 'cust_123'), true);
  assert.strictEqual(checkDocumentAccess(customerCaller, 'release', 'cust_123'), true);
});

test('PDF Security: Customer CANNOT access another customer document (Cross-Customer IDOR Defense)', () => {
  const customerCaller = { uid: 'cust_123', role: 'Customer' };

  assert.throws(() => {
    checkDocumentAccess(customerCaller, 'ticket', 'victim_cust_456');
  }, /belonging to another customer/);

  assert.throws(() => {
    checkDocumentAccess(customerCaller, 'receipt', 'victim_cust_456');
  }, /belonging to another customer/);
});

test('PDF Security: Customer CANNOT access internal accounting ledger or auditor report', () => {
  const customerCaller = { uid: 'cust_123', role: 'Customer' };

  assert.throws(() => {
    checkDocumentAccess(customerCaller, 'ledger', 'cust_123');
  }, /Customers are not permitted to access internal accounting ledgers/);

  assert.throws(() => {
    checkDocumentAccess(customerCaller, 'balance_sheet', 'cust_123');
  }, /Customers are not permitted to access internal accounting ledgers/);

  assert.throws(() => {
    checkDocumentAccess(customerCaller, 'report', 'cust_123');
  }, /Customers are not permitted to access internal accounting ledgers/);
});

test('Photo Normalization: includes front, back, side, and gold_photos gallery', () => {
  const items = [
    {
      id: 'coll_1',
      front_photo_url: 'https://storage/front1.jpg',
      back_photo_url: 'https://storage/back1.jpg',
      side_photo_url: 'https://storage/side1.jpg',
      photos: ['https://storage/gallery1.jpg', 'https://storage/gallery2.jpg']
    },
    {
      id: 'coll_2',
      front_photo_url: 'https://storage/front2.jpg',
      photos: ['https://storage/gallery3.jpg', 'https://storage/front2.jpg'] // duplicate front
    }
  ];

  const allPhotos = getCollateralPhotoUrls(items);
  assert.strictEqual(allPhotos.length, 7);
  assert.ok(allPhotos.includes('https://storage/front1.jpg'));
  assert.ok(allPhotos.includes('https://storage/back1.jpg'));
  assert.ok(allPhotos.includes('https://storage/side1.jpg'));
  assert.ok(allPhotos.includes('https://storage/gallery1.jpg'));
  assert.ok(allPhotos.includes('https://storage/gallery2.jpg'));
  assert.ok(allPhotos.includes('https://storage/gallery3.jpg'));
});

test('Company Settings Validation: validates mandatory legal business fields', () => {
  const completeSettings = {
    company_name: 'PAVITHRA GOLD FINANCE',
    company_address: '45, Temple View Complex, West Masi Street, Madurai - 625001',
    company_phone: '7094826586',
    company_gst: '33AABCP1234F1Z8',
  };

  const validRes = validateCompanySettings(completeSettings);
  assert.strictEqual(validRes.isValid, true);
  assert.strictEqual(validRes.missing.length, 0);

  const incompleteSettings = {
    company_name: 'PAVITHRA GOLD FINANCE',
    company_phone: '7094826586',
    // missing address and gst
  };

  const invalidRes = validateCompanySettings(incompleteSettings);
  assert.strictEqual(invalidRes.isValid, false);
  assert.deepStrictEqual(invalidRes.missing, ['company_address', 'company_gst']);
});
