// tests/storage-rules.test.mjs
// Static verification of storage.rules syntax and role definitions.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('Storage Rules: verifies role hierarchy consistency and elimination of role != Customer bug', () => {
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

  // Verify that collaterals write permission uses isStaff
  assert.ok(
    content.includes('match /collaterals/{allPaths=**}') && content.includes('allow write: if isStaff();'),
    "Collaterals write must require isStaff()"
  );

  // Verify that company branding write permission uses isAdmin
  assert.ok(
    content.includes('match /company/{allPaths=**}') && content.includes('allow write: if isAdmin();'),
    "Company branding write must require isAdmin()"
  );
});
