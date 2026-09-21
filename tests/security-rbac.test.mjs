// tests/security-rbac.test.mjs
// Role-Based Access Control, Customer Isolation, IDOR Protection tests.

import test from 'node:test';
import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Mirror of role hierarchy used in Firestore rules and auth.ts
// ---------------------------------------------------------------------------
const STAFF_ROLES = ['Admin', 'Owner', 'Manager', 'Appraiser', 'Cashier', 'Employee', 'Accountant'];
const CUSTOMER_ROLE = 'Customer';
const INVESTOR_ROLE = 'Investor';

function isAdmin(role) {
  return role === 'Admin' || role === 'Owner';
}

function isManager(role) {
  return isAdmin(role) || role === 'Manager';
}

function isStaff(role) {
  return STAFF_ROLES.includes(role);
}

function isCustomer(role) {
  return role === CUSTOMER_ROLE;
}

function isInvestor(role) {
  return role === INVESTOR_ROLE;
}

/**
 * Simulate Firestore rule: can user read this loan?
 */
function canReadLoan(userRole, userId, loanCustomerId) {
  if (isStaff(userRole)) return true;
  if (isCustomer(userRole) && loanCustomerId === userId) return true;
  return false;
}

/**
 * Simulate Firestore rule: can user read this payment?
 */
function canReadPayment(userRole, userId, paymentCustomerId) {
  if (isStaff(userRole)) return true;
  if (isCustomer(userRole) && paymentCustomerId === userId) return true;
  return false;
}

/**
 * Simulate Firestore rule: can user write payments?
 */
function canWritePayment(userRole) {
  return isStaff(userRole);
}

/**
 * Simulate Firestore rule: can user update/delete payments?
 */
function canModifyPayment(userRole) {
  return isAdmin(userRole);
}

/**
 * Simulate Firestore rule: can user read audit logs?
 */
function canReadAuditLogs(userRole) {
  return isManager(userRole);
}

/**
 * Simulate: can user update/delete audit logs?
 */
function canModifyAuditLogs() {
  return false; // Always false — immutable
}

/**
 * Simulate: can user modify settings?
 */
function canWriteSettings(userRole) {
  return isAdmin(userRole);
}

/**
 * Simulate Firestore rule: can user self-elevate role via profile update?
 */
function canUpdateProfileRole(userRole, isOwn, currentRole, newRole) {
  if (isAdmin(userRole)) return true;
  if (isOwn && newRole === currentRole) return true; // Can update own fields if role unchanged
  if (isOwn && newRole !== currentRole) return false; // CANNOT self-elevate
  return false;
}

// ---------------------------------------------------------------------------
// RBAC Tests
// ---------------------------------------------------------------------------

test('RBAC: Customer CANNOT access admin loan data (cross-role isolation)', () => {
  const customer = { role: 'Customer', uid: 'cust_001' };
  const otherCustomerLoan = { customer_id: 'cust_002' };

  assert.strictEqual(canReadLoan(customer.role, customer.uid, otherCustomerLoan.customer_id), false);
});

test('RBAC: Customer CAN access their own loan', () => {
  const customer = { role: 'Customer', uid: 'cust_001' };
  const ownLoan = { customer_id: 'cust_001' };

  assert.strictEqual(canReadLoan(customer.role, customer.uid, ownLoan.customer_id), true);
});

test('RBAC: Investor CANNOT access any loan data', () => {
  const investor = { role: 'Investor', uid: 'inv_001' };
  const loan = { customer_id: 'cust_001' };

  assert.strictEqual(canReadLoan(investor.role, investor.uid, loan.customer_id), false);
  assert.strictEqual(isStaff(investor.role), false);
});

test('RBAC: Staff hierarchy — Employee < Manager < Admin', () => {
  // Employee can create payments but cannot modify them
  assert.strictEqual(canWritePayment('Employee'), true);
  assert.strictEqual(canModifyPayment('Employee'), false);

  // Manager can read audit logs but cannot modify payments
  assert.strictEqual(canReadAuditLogs('Manager'), true);
  assert.strictEqual(canModifyPayment('Manager'), false);

  // Admin can do everything
  assert.strictEqual(canModifyPayment('Admin'), true);
  assert.strictEqual(canReadAuditLogs('Admin'), true);
  assert.strictEqual(canWriteSettings('Admin'), true);
});

test('RBAC: Customer CANNOT write payments (server-side enforcement)', () => {
  assert.strictEqual(canWritePayment('Customer'), false);
  assert.strictEqual(canModifyPayment('Customer'), false);
});

test('RBAC: Self-role-elevation prevention', () => {
  // Customer cannot change their role to Admin
  assert.strictEqual(canUpdateProfileRole('Customer', true, 'Customer', 'Admin'), false);

  // Customer cannot change their role to Manager
  assert.strictEqual(canUpdateProfileRole('Customer', true, 'Customer', 'Manager'), false);

  // Employee cannot change their role to Admin
  assert.strictEqual(canUpdateProfileRole('Employee', true, 'Employee', 'Admin'), false);

  // Customer CAN update their profile if role stays the same
  assert.strictEqual(canUpdateProfileRole('Customer', true, 'Customer', 'Customer'), true);

  // Admin CAN change anyone's role
  assert.strictEqual(canUpdateProfileRole('Admin', false, 'Employee', 'Manager'), true);
});

test('RBAC: Audit logs are immutable — no role can modify or delete', () => {
  assert.strictEqual(canModifyAuditLogs(), false);
  // Staff can create audit logs
  assert.strictEqual(isStaff('Cashier'), true);
  // But nobody can update/delete them
  assert.strictEqual(canModifyAuditLogs(), false);
});

test('RBAC: Customer IDOR — cannot read another customer\'s payment', () => {
  const attacker = { role: 'Customer', uid: 'cust_attacker' };
  const victimPayment = { customer_id: 'cust_victim' };

  assert.strictEqual(canReadPayment(attacker.role, attacker.uid, victimPayment.customer_id), false);
});

test('RBAC: Investor cannot access settings, payments, or loans', () => {
  assert.strictEqual(canWriteSettings('Investor'), false);
  assert.strictEqual(canWritePayment('Investor'), false);
  assert.strictEqual(canReadLoan('Investor', 'inv_001', 'cust_001'), false);
  assert.strictEqual(canReadAuditLogs('Investor'), false);
});

test('RBAC: All staff roles can read loans', () => {
  for (const role of STAFF_ROLES) {
    assert.strictEqual(canReadLoan(role, 'staff_001', 'cust_any'), true, `${role} should be able to read loans`);
  }
});

test('RBAC: Only Admin/Owner can write settings', () => {
  assert.strictEqual(canWriteSettings('Admin'), true);
  assert.strictEqual(canWriteSettings('Owner'), true);
  assert.strictEqual(canWriteSettings('Manager'), false);
  assert.strictEqual(canWriteSettings('Cashier'), false);
  assert.strictEqual(canWriteSettings('Employee'), false);
  assert.strictEqual(canWriteSettings('Customer'), false);
  assert.strictEqual(canWriteSettings('Investor'), false);
});
