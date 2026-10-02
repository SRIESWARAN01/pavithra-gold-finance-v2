// tests/storage-rules.test.mjs
// Static verification of storage.rules syntax and role definitions.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('Storage Rules: validates role checks, private paths, and upload constraints', () => {
  const rulesPath = path.resolve(process.cwd(), 'storage.rules');
  assert.ok(fs.existsSync(rulesPath), 'storage.rules must exist');

  const content = fs.readFileSync(rulesPath, 'utf8');

  // Verify that the old insecure pattern data.role != 'Customer' is eliminated
  assert.ok(
    !content.includes("data.role != 'Customer'"),
    "Flawed pattern `data.role != 'Customer'` must not exist in storage.rules"
  );

  // Verify isAdmin helper checks Admin or Owner explicitly
  assert.ok(
    content.includes("getUserRole() == 'Admin' || getUserRole() == 'Owner'"),
    "isAdmin() helper must explicitly check Admin or Owner"
  );

  // Verify isStaff helper checks staff hierarchy
  assert.ok(
    content.includes("function isStaff()"),
    "isStaff() helper must be defined"
  );
  assert.ok(content.includes("'Manager'"), "isStaff() must include Manager");
  assert.ok(content.includes("'Cashier'"), "isStaff() must include Cashier");
  assert.ok(content.includes("'Employee'"), "isStaff() must include Employee");
  assert.ok(content.includes("'Accountant'"), "isStaff() must include Accountant");

  // Collateral access is private to the owning borrower and staff; uploads are constrained.
  assert.ok(
    content.includes('match /collaterals/photos/{collateralId}/{allPaths=**}') &&
      content.includes('allow read: if isStaff() || ownsCollateral(collateralId);') &&
      content.includes('validImageUpload(10 * 1024 * 1024)'),
    'Collateral photo reads must be owner scoped and uploads must validate image type and size'
  );

  assert.ok(!content.includes('email.matches'), 'Email text must never grant a role');
  assert.ok(content.includes('validKycUpload()'), 'KYC uploads must validate type and size');
  assert.ok(content.includes('allow read, write: if isStaff();'), 'Generated documents must remain staff-only');

  // Verify that company branding write permission uses isAdmin
  assert.ok(
    content.includes('match /company/{allPaths=**}') && content.includes('allow write: if isAdmin();'),
    "Company branding write must require isAdmin()"
  );
});
