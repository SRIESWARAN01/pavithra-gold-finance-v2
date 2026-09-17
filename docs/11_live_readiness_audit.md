# PGF Live Readiness Audit & Remediation Report

Date: 2026-09-17  
Status: Local Audit Findings Fully Resolved & Verified (16/16 Automated Tests Passed; Production Build Clean)  
Scope: Source-code review, security hardening, server-side data isolation, and local verification. Live deployment remains gated on Firebase CLI login & production credentials.

## Architecture & Data Flow

- **Frontend**: Next.js 16 (App Router, Turbopack) / React 19 / TypeScript / Tailwind CSS.
- **Identity**: Firebase Authentication with custom claims (`Admin`, `Owner`, `Manager`, `Appraiser`, `Cashier`, `Employee`, `Accountant`, `Customer`).
- **Database**: Cloud Firestore with atomic transactions for payment posting, balance reduction, receipt generation, and loan settlements.
- **Storage**: Cloud Storage with granular role-based security rules (`isAdmin`, `isStaff`, Customer self-folder isolation).
- **Server Services**: Next.js API route (`/api/pdf`) powered by Firebase Admin SDK (`adminAuth`, `adminDb`, `adminStorage`) enforcing ID token verification, strict customer ownership checks (anti-IDOR), authoritative database resolution, and direct storage buffer downloads.
- **Primary Collections**: `profiles`, `loans`, `gold_collateral`, `gold_photos`, `payments`, `interest_accruals`, `settings`, `notifications`, `audit_logs`, `counters`, and `documents`.

---

## Audit Findings & Resolution Status

| ID | Feature | Problem / Root Cause | Action Taken | Status |
| --- | --- | --- | --- | --- |
| **SEC-01** | Authentication | The login screen contained visible demo/master credentials, automatic sign-up, and browser-session fallback identity. | Removed demo credentials and fallback identity; strictly enforce Firebase Auth UID and matching profile lookup. | **Resolved** (Local verification complete) |
| **SEC-02** | Customer Onboarding | `/api/admin/onboard` accepted unauthenticated requests and allowed a submitted role to determine the created account role. | Required an Admin/Owner Firebase ID token; constrained created accounts strictly to the `Customer` role with 3-field duplicate check. | **Resolved** (Local verification complete) |
| **SEC-03** | Firestore Rules | Any signed-in user could create an arbitrary profile, including a privileged role; all signed-in users could write receipt counters and audit logs. | Restricted profile bootstrap to self-Customer only; staff roles provisioned by Admin/Admin SDK; locked counters and audit logs to staff. | **Resolved** (Local rules updated) |
| **BILL-01** | PDF Data Retrieval | The PDF route used the browser Firebase SDK on the server with no active session, causing potential permission failures. | Migrated `/api/pdf` to Firebase Admin SDK (`adminDb`, `adminAuth`, `adminStorage`) for authoritative server-side data resolution. | **Resolved & Verified** |
| **BILL-02** | PDF Document Integrity | PDF POST accepted client-supplied payloads (`loanData`, `customerData`, `paymentData`); GET accepted IDs without authentication, risking forged or cross-customer documents. | Implemented mandatory Firebase ID token verification, customer-level document isolation (anti-IDOR), and authoritative database retrieval by verified ID. | **Resolved & Verified** (Tested) |
| **BILL-03** | Company Document Data | The PDF route contained fallback company phone, address, and registration details. | Implemented settings validation against Firestore `settings` collection (`company_name`, `company_address`, `company_phone`, `company_gst`) with production configuration checks. | **Resolved & Verified** |
| **DATA-01** | Payment Posting | `recordPayment` separated receipt sequence and loan updates into different operations, risking stale calculations during concurrent repayments. | Unified receipt sequence generation, payment insertion, balance checks, waiver handling, and settlement status into a single atomic Firestore transaction. | **Resolved & Verified** |
| **DATA-02** | Payment Validation | Payment splits were supplied by client without data-layer proofs that their sum matched the payment amount. | Added paise-accurate allocation validation (`interest + principal + penalty === amount_paid`), negative value rejection, and principal/interest balance limits. | **Resolved & Verified** (Tested) |
| **IMG-01** | Collateral Photos | Gallery-only photos in `gold_photos` collection were ignored in generated PDFs, which only read inline front/back URLs. | Normalized photo retrieval to query `gold_collateral` (front, back, side) and `gold_photos` records, providing complete photographic evidence in documents. | **Resolved & Verified** (Tested) |
| **IMG-02** | Storage Access | Storage download URLs could fail when fetched unauthenticated on the server; `storage.rules` used a flawed helper `role != 'Customer'`. | Refined `storage.rules` with strict `isAdmin()` and `isStaff()` role checks; implemented `fetchImageBuffer` using direct Admin Storage bucket downloads (`adminStorage.bucket().file().download()`). | **Resolved & Verified** (Tested) |
| **DEP-01** | Firebase Deployment | A Firebase project alias exists (`pavithra-gold-finance`), but CLI authentication/project access was not verified. | Deployment checklist prepared. Requires owner Firebase CLI login and service account credentials. | **Blocked** (Awaiting Owner Confirmation) |
| **TEST-01** | Automated Testing | No discovered unit or integration test scripts existed to prove transaction math and access control. | Added automated test suite (`node --test tests/**/*.test.mjs`) covering payment split math, atomic allocation validation, PDF security, photo normalization, and storage rules. | **Resolved & Verified** (16/16 Passed) |

---

## Checks Executed & Results

1. **Automated Test Suite**:
   ```bash
   npm test
   # Result: 16 passed, 0 failed, 0 skipped (duration: ~200ms)
   ```
   - `tests/payments.test.mjs`: Validated interest-first allocation, penalty priority, waiver reduction, full settlement detection, allocation sum mismatch rejection, balance limit enforcement, and settled loan protection.
   - `tests/pdf-security.test.mjs`: Validated ID token requirement, customer isolation (preventing cross-customer document access), staff document access, accounting report restriction, collateral photo normalization, and company settings validation.
   - `tests/storage-rules.test.mjs`: Validated elimination of `role != 'Customer'` flaw, explicit `isAdmin()` and `isStaff()` definitions, and path protections.

2. **TypeScript Compilation Check**:
   ```bash
   npx tsc --noEmit
   # Result: Exited with code 0 (zero type errors)
   ```

3. **Production Build**:
   ```bash
   npm run build
   # Result: Exited with code 0.
   # All 45 static and dynamic pages generated in 1.8s.
   ```

---

## Owner Live Deployment Checklist (DEP-01)

To deploy the verified application to the live Firebase environment:

1. **Authenticate Firebase CLI**:
   ```bash
   firebase login
   firebase use pavithra-gold-finance
   ```

2. **Deploy Security Rules**:
   ```bash
   # Deploy Firestore rules (profiles, loans, payments, counters, settings)
   firebase deploy --only firestore:rules

   # Deploy Storage rules (customer KYC, collaterals, documents, branding)
   firebase deploy --only storage:rules
   ```

3. **Configure Production Environment Variables**:
   In `.env.local` or your production hosting provider (e.g. Firebase App Hosting or Cloud Run / Vercel):
   - `FIREBASE_ADMIN_PROJECT_ID=pavithra-gold-finance`
   - `FIREBASE_ADMIN_CLIENT_EMAIL=<service-account-email>`
   - `FIREBASE_ADMIN_PRIVATE_KEY="<private-key-with-newlines>"`
   - `FIREBASE_ADMIN_STORAGE_BUCKET=pavithra-gold-finance.firebasestorage.app`

4. **Verify Company Legal Profile**:
   Ensure Admin > Settings is populated with official business information:
   - Company Name: Legal registered entity name
   - GST Number: Valid 15-digit Tamil Nadu GSTIN
   - PAN: Valid 10-character Business PAN
   - Pawnbroker Registration: Valid Tamil Nadu Pawnbroker license number
   - Registered Address & Support Phone number
