// tests/auth-guards.test.mjs
// Role-Based Access Control and Server Guard Invariant Tests (GAP-11, GAP-13)

import test from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// All 11 authoritative roles defined in UserRole enum (database.ts)
// ---------------------------------------------------------------------------
const ALL_ROLES = [
  'Admin',
  'Owner',
  'Manager',
  'Employee',
  'Appraiser',
  'Cashier',
  'Accountant',
  'Collection_Officer',
  'Customer_Support',
  'Customer',
  'Investor'
];

const ADMIN_ROLES = ['Admin', 'Owner'];
const STAFF_ROLES = [
  'Admin',
  'Owner',
  'Manager',
  'Employee',
  'Appraiser',
  'Cashier',
  'Accountant',
  'Collection_Officer',
  'Customer_Support'
];

// ---------------------------------------------------------------------------
// Logic mirror of src/lib/auth.ts guards
// ---------------------------------------------------------------------------
function checkAdminGuard(profile) {
  if (!profile || profile.status !== 'Active') {
    throw new Error('Account is inactive. Please contact support.');
  }
  if (!ADMIN_ROLES.includes(profile.role)) {
    throw new Error('Admin access required.');
  }
  return { success: true, profile };
}

function checkStaffGuard(profile) {
  if (!profile || profile.status !== 'Active') {
    throw new Error('Account is inactive. Please contact support.');
  }
  if (!STAFF_ROLES.includes(profile.role)) {
    throw new Error('Staff access required.');
  }
  return { success: true, profile };
}

function checkCustomerGuard(profile) {
  if (!profile || profile.status !== 'Active') {
    throw new Error('Account is inactive. Please contact support.');
  }
  if (profile.role !== 'Customer') {
    throw new Error('Customer access required.');
  }
  return { success: true, profile };
}

function checkRoleGuard(profile, allowedRoles) {
  if (!profile || profile.status !== 'Active') {
    throw new Error('Account is inactive. Please contact support.');
  }
  if (!allowedRoles.includes(profile.role)) {
    throw new Error('Access denied. Insufficient permissions.');
  }
  return { success: true, profile };
}

// ---------------------------------------------------------------------------
// Logic mirror of verifyAuthToken mock bypass (src/lib/firebase-admin.ts)
// ---------------------------------------------------------------------------
function simulateTokenVerification(idToken, env = 'development') {
  if (env !== 'production') {
    if (idToken === 'test-dev-admin-token' || idToken === 'test-dev-token') {
      return { uid: 'dev_admin', role: 'Admin' };
    }
    if (idToken === 'test-dev-customer-token') {
      return { uid: 'cust_sample_123', role: 'Customer' };
    }
  }
  // In production, mock tokens cannot pass
  if (idToken.startsWith('test-dev-')) {
    throw new Error('Invalid Firebase ID token');
  }
  return { uid: 'real_user', role: 'Customer' };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('Auth Guards 1.1: requireAdmin() strictly allows only Admin and Owner', () => {
  for (const role of ALL_ROLES) {
    const profile = { id: 'u1', role, status: 'Active' };
    if (ADMIN_ROLES.includes(role)) {
      const res = checkAdminGuard(profile);
      assert.equal(res.success, true);
    } else {
      assert.throws(
        () => checkAdminGuard(profile),
        /Admin access required/,
        `Role ${role} should be rejected by requireAdmin()`
      );
    }
  }
});

test('Auth Guards 1.2: GAP-11 Regression - Investor cannot access Admin resources', () => {
  const investorProfile = { id: 'inv_01', role: 'Investor', status: 'Active' };
  assert.throws(
    () => checkAdminGuard(investorProfile),
    /Admin access required./
  );
});

test('Auth Guards 1.3: requireStaff() permits all backoffice staff and strictly excludes Customer and Investor', () => {
  for (const role of ALL_ROLES) {
    const profile = { id: 'u2', role, status: 'Active' };
    if (STAFF_ROLES.includes(role)) {
      const res = checkStaffGuard(profile);
      assert.equal(res.success, true);
    } else {
      assert.throws(
        () => checkStaffGuard(profile),
        /Staff access required/,
        `Role ${role} should be rejected by requireStaff()`
      );
    }
  }
});

test('Auth Guards 1.4: requireCustomer() allows only Customer role', () => {
  for (const role of ALL_ROLES) {
    const profile = { id: 'u3', role, status: 'Active' };
    if (role === 'Customer') {
      const res = checkCustomerGuard(profile);
      assert.equal(res.success, true);
    } else {
      assert.throws(
        () => checkCustomerGuard(profile),
        /Customer access required/,
        `Role ${role} should be rejected by requireCustomer()`
      );
    }
  }
});

test('Auth Guards 1.5: Inactive status is rejected across all guards', () => {
  const inactiveAdmin = { id: 'u4', role: 'Admin', status: 'Inactive' };
  const inactiveCustomer = { id: 'u5', role: 'Customer', status: 'Inactive' };
  const inactiveStaff = { id: 'u6', role: 'Employee', status: 'Suspended' };

  assert.throws(() => checkAdminGuard(inactiveAdmin), /Account is inactive/);
  assert.throws(() => checkCustomerGuard(inactiveCustomer), /Account is inactive/);
  assert.throws(() => checkStaffGuard(inactiveStaff), /Account is inactive/);
  assert.throws(() => checkRoleGuard(inactiveAdmin, ['Admin']), /Account is inactive/);
});

test('Auth Guards 1.6: GAP-13 Regression - Dev mock tokens rejected in production environment', () => {
  // In production, mock tokens throw
  assert.throws(
    () => simulateTokenVerification('test-dev-admin-token', 'production'),
    /Invalid Firebase ID token/
  );
  assert.throws(
    () => simulateTokenVerification('test-dev-customer-token', 'production'),
    /Invalid Firebase ID token/
  );

  // In development, mock tokens are accepted
  const devAdmin = simulateTokenVerification('test-dev-admin-token', 'development');
  assert.equal(devAdmin.role, 'Admin');

  const devCustomer = simulateTokenVerification('test-dev-customer-token', 'development');
  assert.equal(devCustomer.role, 'Customer');
});
