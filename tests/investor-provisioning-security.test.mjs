import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const api = fs.readFileSync('src/app/api/admin/investor/create/route.ts', 'utf8');
const page = fs.readFileSync('src/app/admin/investments/investors/new/page.tsx', 'utf8');
const customerApi = fs.readFileSync('src/app/api/admin/onboard/route.ts', 'utf8');
const customerPage = fs.readFileSync('src/app/admin/customers/new/page.tsx', 'utf8');
const otpPage = fs.readFileSync('src/app/auth/otp/page.tsx', 'utf8');
const resetPage = fs.readFileSync('src/app/auth/reset-password/page.tsx', 'utf8');
const loginPage = fs.readFileSync('src/app/page.tsx', 'utf8');
const firestoreRules = fs.readFileSync('firestore.rules', 'utf8');
const storageRules = fs.readFileSync('storage.rules', 'utf8');

test('Investor provisioning is server-authorized, atomic, and retry-addressable', () => {
  assert.match(api, /verifyAuthToken\(idToken\)/);
  assert.match(api, /caller\.role !== 'Admin' && caller\.role !== 'Owner'/);
  assert.match(api, /adminAuth\.createUser/);
  assert.match(api, /setCustomUserClaims\(user\.uid, \{ role: 'Investor' \}\)/);
  assert.match(api, /adminDb\.runTransaction/);
  for (const collection of ['profiles', 'investors', 'investment_accounts', 'investment_audit_logs']) {
    assert.ok(api.includes(`adminDb.collection('${collection}')`), `Expected atomic ${collection} write`);
  }
  assert.match(api, /investor_creation_requests/);
  assert.match(api, /adminAuth\.deleteUser\(createdUid\)/);
  assert.match(api, /const authEmail = `\$\{input\.phone\}@pgf\.local`/);
  assert.doesNotMatch(api, /console\.error\([^\n]*(password|bankAccountNumber)/i);
});

test('Investor onboarding page never provisions identities or financial records from the browser', () => {
  assert.match(page, /requestId: requestIdRef\.current/);
  assert.doesNotMatch(page, /createUserWithEmailAndPassword|setDoc\(|fallbackRequired|inv_\$\{/);
});

test('Customer onboarding uses verified Admin SDK transactions and has no fabricated UID fallback', () => {
  assert.match(customerApi, /verifyAuthToken\(idToken\)/);
  assert.match(customerApi, /caller\.role !== 'Admin' && caller\.role !== 'Owner'/);
  assert.match(customerApi, /adminAuth\.createUser/);
  assert.match(customerApi, /setCustomUserClaims\(user\.uid, \{ role: 'Customer' \}\)/);
  assert.match(customerApi, /adminDb\.runTransaction/);
  assert.match(customerApi, /customer_creation_requests/);
  assert.match(customerApi, /CUSTOMER_CREATED/);
  assert.match(customerApi, /adminAuth\.deleteUser\(createdUid\)/);
  assert.match(customerApi, /const authEmail = `\$\{input\.phone\}@pgf\.local`/);
  assert.doesNotMatch(customerApi, /createProfile\(|checkDuplicateCustomer\(/);
  assert.doesNotMatch(customerPage, /createUserWithEmailAndPassword|createProfile\(|cust_\$\{|user_\$\{/);
  assert.match(customerPage, /uploadKYCDocument\(/);
  assert.match(loginPage, /`\$\{cleanedPhone\}@pgf\.local`/);
});

test('Email strings cannot grant staff access and users cannot self-create privileged profiles', () => {
  assert.doesNotMatch(firestoreRules, /email\.matches|phone_number ==/);
  assert.match(firestoreRules, /allow create: if isAdmin\(\) \|\|/);
  assert.match(firestoreRules, /request\.resource\.data\.role == 'Customer'/);
  assert.doesNotMatch(storageRules, /email\.matches|phone_number ==/);
  assert.match(firestoreRules, /data\.status == 'Active'/);
  assert.doesNotMatch(firestoreRules, /request\.auth\.token\.role/);
  assert.match(firestoreRules, /match \/investment_accounts\/\{accountId\} \{\s+allow read:[^\n]+\n\s+allow create, update: if isStaff\(\);/);
  assert.match(firestoreRules, /match \/investment_lots\/\{lotId\} \{\s+allow read:[^\n]+\n\s+allow create: if isStaff\(\);/);
  assert.match(firestoreRules, /match \/investment_transactions\/\{txnId\} \{\s+allow read:[^\n]+\n\s+allow create: if isStaff\(\);/);
});

test('Password recovery cannot report success without a verified phone challenge', () => {
  assert.doesNotMatch(otpPage, /123456|router\.push\(`\/auth\/reset-password/);
  assert.match(otpPage, /No active OTP challenge exists/);
  assert.match(resetPage, /verifiedPhone !== phone/);
});
