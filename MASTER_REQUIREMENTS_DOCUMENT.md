# Pavithra Gold Finance (PGF) - Master Requirements Document (MRD)
## Production Enterprise Gold Loan Management System Blueprint & Technical Specification

---

## 1. Executive Summary
**Pavithra Gold Finance (PGF)** is an enterprise-grade, cloud-native digital gold loan management system (ERP) purpose-built for licensed pawnbrokers and non-banking gold loan enterprises. The platform digitizes the entire physical gold lending lifecycle: customer onboarding with live webcam biometric photo and HTML5 canvas signature verification, multi-item gold appraisal, dynamic daily simple interest calculation, atomic payment ledger posting, collateral vault bin tracking, commercial bank re-pledging, multi-level approvals, statutory auction liquidation, and automated multi-channel reminder dispatches (In-App Push, SMS, WhatsApp).

PGF replaces traditional physical books and spreadsheets with an authoritative, tamper-evident digital architecture powered by **Next.js 16 (App Router)**, **TypeScript 5**, **Tailwind CSS v4**, **Firebase Authentication with Custom Claims**, **Cloud Firestore (Atomic Transactions & Realtime Sync)**, **Cloud Storage**, a dedicated server-side **PDFKit Engine** with TrueType Tamil Unicode rendering, and a **50-sheet Enterprise Excel Financial & Operational Workbook Generator**.

---

## 2. Product Vision & Core Strategic Pillars
1. **Absolute Operational Transparency**: Borrowers inspect live daily interest accrual, view 3-angle high-resolution photographs of pledged jewelry, track physical vault custody, and download verifiable statutory PDF receipts instantly on mobile smartphones.
2. **Bank-Grade Enterprise Security**: Zero-trust architecture enforcing Firebase ID token authentication, cryptographic role claims, strict Firestore & Cloud Storage security rules, and server-side anti-IDOR (Insecure Direct Object Reference) access control.
3. **Paise-Accurate Financial Integrity**: All financial transactions, payment allocations (Penalty $\to$ Interest $\to$ Principal), receipt numbering, and Tamil slogan rotation execute inside atomic Firestore transactions preventing race conditions and ledger drift.
4. **Luxury Aesthetics & Frictionless UX**: Curated deep navy (`#0A192F`), rich gold (`#D4AF37`), and crisp slate typography delivering an executive backoffice dashboard for desktop operators and an intuitive, mobile-first touch portal for borrowers.

---

## 3. Business Goals & KPI Metrics
* **BG-01 (100% Paperless Auditing)**: Every loan pledge, payment receipt, collateral release deed, and account statement is compiled server-side as a digitally verifiable PDF with integrated QR verification.
* **BG-02 (Zero Dispute Accounting)**: Daily simple interest computed transparently at midnight with leap-year adaptation ($365/366$ days), matching customer mobile counters down to two decimal places.
* **BG-03 (40% Default Reduction)**: Automated scheduled alerts dispatched at 30-day, 15-day, 7-day, 3-day, 1-day, maturity date, and daily overdue intervals.
* **BG-04 (95% Borrower Self-Service)**: Borrowers verify balances, check collateral purity/weights, and download historical tax invoices independently without branch staff intervention.
* **BG-05 (Complete Re-Pledge Liquidity)**: Enables enterprise management to legally re-pledge idle vaulted collateral with scheduled commercial banks to unlock institutional working capital while maintaining strict audit traceability.

---

## 4. Target User Roles & Granular RBAC Matrix
The system defines 10 distinct user roles enforced via Firebase Authentication custom claims and verified database profiles:

| Role | Portal / Access Scope | Key Permissions & Responsibilities |
| :--- | :--- | :--- |
| **Admin** / **Owner** | Full Backoffice (`/admin/*`) | Complete administrative authority: system settings, branch management, employee provisioning, high-LTV approvals, financial waivers, audit logs, and accounting. |
| **Manager** | Operations Backoffice (`/admin/*`) | Branch-level oversight: approves loans exceeding standard LTV thresholds, authorizes interest discounts, reviews staff performance. |
| **Appraiser** | Backoffice (`/admin/*`, `/employee/*`) | Physical gold evaluation: measures gross/stone/net weight, tests 18K/21K/22K/24K karat purity, uploads 3-angle photos, assigns vault storage bins. |
| **Cashier** | Counter POS (`/admin/billing`, `/admin/payments`, `/employee/payments`) | Front-desk cash collection: records repayments, disburses loan principals, executes atomic receipt printing with sequential slogans. |
| **Accountant** | Financial Office (`/admin/accounting`, `/admin/reports`) | Core bookkeeping: audits cash book, bank book, journal entries, trial balance, P&L, balance sheet, and GST filings. |
| **Employee** (General Staff) | Employee Portal (`/employee/*`) | Operational branch staff: searches customers, submits draft loan applications, collects counter payments, checks re-pledge status. |
| **Collection Officer** | Backoffice (`/admin/loans`, `/admin/notifications`) | Dues recovery: monitors overdue loans, triggers reminder notifications, tracks grace period expirations. |
| **Customer Support** | Support Desk (`/admin/support`) | Borrower assistance: reviews inquiries, resolves identity discrepancies, assists with password resets. |
| **Customer** (Borrower) | Mobile Portal (`/customer/*`) | Self-service borrower: views active loans, live accrued interest, collateral photos, payment histories, and downloads PDFs. |

---

## 5. Technical Architecture & Technology Stack

```mermaid
graph TB
    subgraph Client Tier
        A[Next.js 16 Client - Desktop Admin]
        B[Next.js 16 Client - Mobile Customer]
        C[Next.js 16 Client - Employee Portal]
    end

    subgraph Security & Routing Tier
        D[Firebase Authentication - JWT & Custom Claims]
        E[Next.js Middleware & Route Handlers]
        F[Firestore Security Rules & Storage Rules]
    end

    subgraph Data & Persistence Tier
        G[(Cloud Firestore - 15 Collections)]
        H[(Cloud Storage - KYC & Collateral)]
        I[Atomic Transactions & Sequential Counters]
    end

    subgraph Server Services Tier
        J[Firebase Admin SDK Engine]
        K[Server PDFKit Engine with Tamil Unicode Fonts]
        L[50-Sheet Enterprise Excel Workbook Generator]
        M[300 Tamil Slogans Sequential Engine]
    end

    A --> D
    B --> D
    C --> D
    D --> E
    E --> F
    F --> G
    F --> H
    E --> J
    J --> G
    J --> H
    J --> K
    J --> L
    J --> M
    G --> I
```

### 5.1 Stack Specifications
* **Frontend Framework**: Next.js 16.2.9 (App Router, Turbopack, standalone server output).
* **UI & Rendering Engine**: React 19.2.4, TypeScript 5, Tailwind CSS v4.0 with `@tailwindcss/postcss`.
* **Database**: Google Cloud Firestore with real-time snapshot synchronization and ACID atomic transactions.
* **Authentication**: Firebase Authentication v12.17.1 (Client) & Firebase Admin SDK v13.1.0 (Server) with cryptographic ID tokens.
* **Asset Storage**: Firebase Cloud Storage with folder-level isolation (`/customers/{uid}/*`, `/collateral/*`, `/documents/*`).
* **Document Compilation**: Server-side `pdfkit` (v0.19.1) with vector layout tables, barcode/QR generation, and custom Nirmala TrueType Unicode font registration for Tamil slogans.
* **Spreadsheet Compiler**: `xlsx` (v0.18.5) delivering 50-sheet enterprise financial workbooks.
* **Validation & Security**: `zod` (v4.4.3), `clsx`, `tailwind-merge`, and custom cryptographic token verification.

---

## 6. Complete Screen-by-Screen Functional Specifications (All 45 Pages)

### 6.1 Authentication & Public Pages (4 Screens)

#### SCREEN 1: Unified Login Screen (`src/app/page.tsx`)
* **URL**: `/`
* **Purpose**: Single secure entry point for all users. Authenticates credentials against Firebase Auth, resolves profile custom claims, and routes to appropriate portal.
* **Layout**: Split-screen on desktop (Left: Gold luxury branding asset and value propositions; Right: Dark navy credentials card). Centered single card on mobile.
* **Controls**: Phone Number input (+91 prefix), Password input with visibility toggle, "Sign In" button with loading spinner, Forgot Password link.
* **Validations**: Phone must be exactly 10 digits; password must not be empty; brute-force rate limit protection.
* **Routing**:
  - `Admin` / `Owner` / `Manager` / `Accountant` $\to$ `/admin/dashboard`
  - `Employee` / `Appraiser` / `Cashier` $\to$ `/employee/dashboard`
  - `Customer` $\to$ `/customer/dashboard`

#### SCREEN 2: Forgot Password Screen (`src/app/auth/forgot-password/page.tsx`)
* **URL**: `/auth/forgot-password`
* **Purpose**: Initiates self-service password recovery.
* **Controls**: Mobile / Email entry field, "Send Verification Code" CTA, back to login link.
* **Logic**: Verifies account existence and dispatches reset payload.

#### SCREEN 3: OTP Verification Screen (`src/app/auth/otp/page.tsx`)
* **URL**: `/auth/otp`
* **Purpose**: Verifies 6-digit one-time password dispatched via SMS/WhatsApp.
* **Controls**: 6 segmented digit inputs with auto-focus advance, countdown timer, resend button.
* **Logic**: Validates token against active session challenge.

#### SCREEN 4: Reset Password Screen (`src/app/auth/reset-password/page.tsx`)
* **URL**: `/auth/reset-password`
* **Purpose**: Secure credential update upon verified OTP challenge.
* **Controls**: New password input, confirm password input, password strength meter, submit button.
* **Validations**: Minimum 8 characters, alphanumeric with special symbol requirement.

---

### 6.2 Admin Backoffice Suite (26 Screens across 18 Modules)

#### SCREEN 5: Admin Dashboard (`src/app/admin/dashboard/page.tsx`)
* **URL**: `/admin/dashboard`
* **Purpose**: Real-time executive financial cockpit providing instant operational intelligence.
* **Metrics Grid**: Total Customers, Active Loans, Settled Loans, Due Today, Due This Week, Overdue Defaults, Total Disbursed Principal, Outstanding Due, Interest Collected (Today & Month), Total Gold Net Weight (grams), Total Vault Valuation.
* **Interactive Elements**: Realtime transactions feed, approaching maturity alerts table, quick-action drawer ("Onboard Customer", "Create Loan", "Record Payment").

#### SCREEN 6: Customer Directory (`src/app/admin/customers/page.tsx`)
* **URL**: `/admin/customers`
* **Purpose**: Centralized searchable and filterable client ledger.
* **Controls**: Live search (Name, Phone, Customer ID, Aadhaar), status filters (Active, Blocked, KYC Pending), export buttons.
* **Data Table**: Displays Customer ID (`PGF-CUST-XXXX`), Name, Primary Mobile, KYC verification status badge, active loan count, and dossier view actions.

#### SCREEN 7: Customer Onboarding Wizard (`src/app/admin/customers/new/page.tsx`)
* **URL**: `/admin/customers/new`
* **Purpose**: Full KYC borrower registration.
* **Controls**:
  - Personal Details: Full Name, Primary Mobile, Alternate Mobile, Date of Birth, Gender, Marital Status, Occupation, Monthly Income.
  - Identification: Aadhaar Number (12 digits), PAN (10 chars), Residential Address, District, State, PIN Code.
  - Family & Nominee: Nominee Name, Relationship, Mobile Number.
  - Biometric Photo: Live webcam capture canvas with freeze-frame and retake controls.
  - Digital Signature Pad: HTML5 touch-sensitive canvas with "Clear" and "Accept" controls.
  - Document Uploads: File pickers for Aadhaar Front, Aadhaar Back, PAN, Voter ID, Passport.
* **Backend Hook**: Submits payload to `/api/admin/onboard` enforcing duplicate prevention and default `Customer` role creation.

#### SCREEN 8: Customer Dossier View (`src/app/admin/customers/[id]/page.tsx`)
* **URL**: `/admin/customers/[id]`
* **Purpose**: Complete 360-degree client file.
* **Panels**: Personal details card, verified photo and signature display, KYC document previews, active loan pledges list, historical closed loans, aggregate borrowing history, and direct PDF Statement compilation button.

#### SCREEN 9: Customer Edit Profile (`src/app/admin/customers/[id]/edit/page.tsx`)
* **URL**: `/admin/customers/[id]/edit`
* **Purpose**: Modify borrower contact info, address, nominee particulars, or toggle account status (Active / Blocked / Inactive).

#### SCREEN 10: Loan Portfolio Directory (`src/app/admin/loans/page.tsx`)
* **URL**: `/admin/loans`
* **Purpose**: Filterable repository of all loan folders across their lifecycle.
* **Filter Tabs**: All, `Draft`, `Pending_Approval`, `Active`, `Due`, `Overdue`, `Grace_Period`, `Settled`, `Cancelled`, `Auctioned`.
* **Table Columns**: Loan No (`PGF-LN-XXXX`), Customer Name, Principal Amount, APR %, Total Net Weight, Origination Date, Maturity Date, Current Status, Action Menu.

#### SCREEN 11: Loan Origination Wizard (`src/app/admin/loans/new/page.tsx`)
* **URL**: `/admin/loans/new`
* **Purpose**: Multi-item gold appraisal and formal loan origination.
* **Workflow Steps**:
  1. *Select Customer*: Auto-complete search by name, phone, or customer ID.
  2. *Gold Appraisal Form*: Multi-item builder recording Item Description, Ornament Type, Quantity, Gross Weight (g), Stone Weight (g), Net Weight (auto-computed), Purity Karat (18K/21K/22K/24K), Hallmark verification toggle, Market Gold Rate, Valuation (INR), Storage Bin Allocation ID, and 3-angle photos (Front, Back, Side).
  3. *Loan Parameters*: Principal Amount, Annual Percentage Rate (APR %), Loan Tenure (months), Disbursed Date. Auto-calculates maximum eligible loan under 75% LTV cap. Flags High-LTV approval if requested amount exceeds policy threshold.
  4. *Finalize & Issue*: Generates loan record, assigns sequential loan number (`PGF-LN-XXXX`), and prints official Pawn Ticket PDF.

#### SCREEN 12: Live Loan QR Scanner (`src/app/admin/loans/scan/page.tsx`)
* **URL**: `/admin/loans/scan`
* **Purpose**: Instant physical pawn ticket identification using camera barcode / QR scanning.
* **Controls**: Live video viewfinder, flashlight toggle, manual code input fallback. Automatically detects encoded loan numbers (`PGF-LN-XXXX`) and routes directly to the loan dossier.

#### SCREEN 13: Loan Details Dossier (`src/app/admin/loans/[id]/page.tsx`)
* **URL**: `/admin/loans/[id]`
* **Purpose**: Definitive operational hub for an individual gold loan.
* **Components**:
  - Live Outstanding Counter: Realtime breakdown of Disbursed Principal, Principal Paid, Remaining Principal, Live Accrued Interest, Interest Paid, Outstanding Due.
  - Collateral Inventory: Full list of pledged items with photo gallery modals, weights, and vault bin IDs.
  - Repayment History: Chronological table of all posted payments with receipt links.
  - Operational Action Bar: "Record Payment", "Release Collateral", "Re-Pledge to Bank", "Print Pawn Ticket", "Print Loan Application", "Download Statement".

#### SCREEN 14: Repayment Registry & Poster (`src/app/admin/payments/page.tsx`)
* **URL**: `/admin/payments`
* **Purpose**: Backoffice payments ledger and counter transaction browser.
* **Controls**: Date range picker, mode filter (`Cash`, `UPI`, `Bank_Transfer`, `Card`, `Cheque`, `Demand_Draft`), transaction search, receipt re-download action.

#### SCREEN 15: Fast-Billing POS Counter (`src/app/admin/billing/page.tsx`)
* **URL**: `/admin/billing`
* **Purpose**: High-speed front-desk cashier counter interface for rapid customer checkouts.
* **Features**:
  - Instant loan lookup via phone or loan number.
  - Live dynamic split calculator: Interest portion, principal reduction, penalty fees, and manager-approved waiver discounts.
  - Payment mode selector with reference number input.
  - Single-click atomic transaction commit: updates loan balances, logs payment, assigns atomic sequential receipt number (`PGF-REC-XXXX`), assigns next sequential Tamil slogan, and triggers thermal / A4 receipt printing.

#### SCREEN 16: Gold Release & Settlement Clearance (`src/app/admin/release/page.tsx`)
* **URL**: `/admin/release`
* **Purpose**: Collateral handover management upon full settlement.
* **Workflow**:
  1. Validates that loan outstanding principal and accrued interest equal zero.
  2. Confirms physical collateral has returned to branch safe from any bank re-pledge.
  3. Records release date, witness staff name, customer signature acknowledgement.
  4. Generates statutory "Gold Collateral Release Certificate / Loan Closure Deed" PDF.

#### SCREEN 17: Bank Re-Pledge Portfolio (`src/app/admin/re-pledge/page.tsx`)
* **URL**: `/admin/re-pledge`
* **Purpose**: Institutional liquidity management tracking gold pledged with commercial banks.
* **Metrics**: Total Re-Pledged Gold Weight, Total Bank Borrowed Capital, Current Bank Outstanding Due, Net Interest Margin (Spread between Customer APR and Bank Borrowing Rate).
* **Table**: Re-pledge number (`PGF-REP-XXXX`), Customer & Loan linkage, Bank Name, Bank Branch, Bank Pledge Amount, Bank Rate %, Status (`Pledged with Bank`, `Active`, `Released`).

#### SCREEN 18: Bank Re-Pledge Origination Wizard (`src/app/admin/re-pledge/new/page.tsx`)
* **URL**: `/admin/re-pledge/new`
* **Purpose**: Formally transfers physical gold collateral from PGF safe to commercial banks.
* **Inputs**: Selection of active loan collateral items, Commercial Bank Name (e.g. State Bank of India, Indian Bank, Canara Bank), Bank Branch, Bank Account Number, Bank Sanction Amount, Bank Interest Rate %, Interest Type (Simple / Compound / Monthly), Due Date, Bank Pledge Ticket Ref Number, supporting document upload.
* **System Action**: Updates collateral custody location from `PGF Safe` to specified Bank Branch, creates `bank_repledge` record.

#### SCREEN 19: Bank Re-Pledge Dossier & Release (`src/app/admin/re-pledge/[id]/page.tsx`)
* **URL**: `/admin/re-pledge/[id]`
* **Purpose**: Manages bank interest accrual, tracks bank repayments, and processes physical collateral release back to PGF Safe upon settlement with the bank.

#### SCREEN 20: Multi-Level Approvals Hub (`src/app/admin/approvals/page.tsx`)
* **URL**: `/admin/approvals`
* **Purpose**: Governance inbox for exception approvals.
* **Request Types**: `High_LTV_Approval`, `Financial_Waiver`, `Loan_Approval`, `Rate_Change`, `Delete_Customer`, `Delete_Loan`, `Delete_Payment`.
* **Controls**: View submitted details, loan link, requesting employee name, reason note, "Approve" button, "Reject" button with mandatory rejection reason.

#### SCREEN 21: Defaulted Collateral Auctions (`src/app/admin/auctions/page.tsx`)
* **URL**: `/admin/auctions`
* **Purpose**: Legal auction management for defaulted collateral exceeding statutory grace periods.
* **Features**: Filter defaulted loans, compile auction lot catalogs, compute base reserve price (current gold rate $\times$ net weight), record bidder registrations, post winning bid amounts, disburse surplus balance to borrower.

#### SCREEN 22: Branch Management (`src/app/admin/branches/page.tsx`)
* **URL**: `/admin/branches`
* **Purpose**: Multi-branch enterprise configuration.
* **Features**: Add/edit branches, assign branch code (e.g. `MDU-01`), physical address, contact telephone, active status toggle.

#### SCREEN 23: Staff & Employee Management (`src/app/admin/employees/page.tsx`)
* **URL**: `/admin/employees`
* **Purpose**: Human resources and role provisioning.
* **Features**: Staff directory, create employee account, assign role (`Manager`, `Appraiser`, `Cashier`, `Accountant`, `Employee`), assign branch, toggle login status.

#### SCREEN 24: Operational Accounting Ledgers (`src/app/admin/accounting/page.tsx`)
* **URL**: `/admin/accounting`
* **Purpose**: Core double-entry bookkeeping engine.
* **Views**:
  - Daily Cash Book: Cash inflows (repayments) vs outflows (loan disbursements, expenses).
  - Bank Book: Online transfers, UPI settlements, commercial bank transactions.
  - General Ledger & Journal Entries.
  - Trial Balance & Profit & Loss Statement.
  - GST Output Tax Register.

#### SCREEN 25: Document Generation & Archive (`src/app/admin/documents/page.tsx`)
* **URL**: `/admin/documents`
* **Purpose**: Authoritative catalog of all server-compiled PDF documents.
* **Features**: Instant preview, re-download, filter by document type (`Pawn_Ticket`, `Payment_Receipt`, `Loan_Agreement`, `Release_Certificate`, `Customer_Statement`).

#### SCREEN 26: Operational Notifications Feed (`src/app/admin/notifications/page.tsx`)
* **URL**: `/admin/notifications`
* **Purpose**: Broadcast announcement composer and reminder dispatch monitor.
* **Features**: View triggered reminder batches (SMS, WhatsApp, Push), dispatch manual broadcast alerts, inspect delivery status logs.

#### SCREEN 27: Executive Reports & Export Studio (`src/app/admin/reports/page.tsx`)
* **URL**: `/admin/reports`
* **Purpose**: Business intelligence reports and comprehensive data export.
* **Features**: Daily collection sheets, NPA overdue reports, collateral weight summaries, and the single-click trigger for the **50-sheet Enterprise Excel Workbook** (`src/lib/excel-enterprise.ts`).

#### SCREEN 28: System & Legal Company Settings (`src/app/admin/settings/page.tsx`)
* **URL**: `/admin/settings`
* **Purpose**: Global business rules and legal entity configurations.
* **Parameters**:
  - Legal Entity: Company Legal Name, Registered Address, Support Phone, Support Email, GSTIN, Business PAN, CIN, Pawnbroker License Number.
  - Financial Parameters: 24K Gold Rate / gram, 22K Gold Rate / gram, 18K Gold Rate / gram, Base APR (default 18%), Maximum LTV Cap (default 75%), Grace Period Days (default 30), Penalty APR %.
  - System Automation: SMS Gateway API credentials, WhatsApp Business Cloud API keys, Firebase Cloud Messaging (FCM) credentials.

#### SCREEN 29: Official Statement Generator (`src/app/admin/statement/page.tsx`)
* **URL**: `/admin/statement`
* **Purpose**: Generates official statements of account for any customer or loan with custom date ranges, ready for immediate A4 PDF printing.

#### SCREEN 30: Customer Support Helpdesk (`src/app/admin/support/page.tsx`)
* **URL**: `/admin/support`
* **Purpose**: Borrower ticketing and inquiry desk. Tracks customer grievances, contact requests, and records audit resolution notes.

---

### 6.3 Employee Portal Suite (7 Screens)

#### SCREEN 31: Employee Dashboard (`src/app/employee/dashboard/page.tsx`)
* **URL**: `/employee/dashboard`
* **Purpose**: Operational dashboard for branch staff.
* **Metrics**: Today's Branch Loans Issued, Today's Counter Collections, Pending Approvals count, Assigned Tasks.

#### SCREEN 32: Employee Customer Registry (`src/app/employee/customers/page.tsx`)
* **URL**: `/employee/customers`
* **Purpose**: Customer directory for branch staff to search borrower profiles and check borrowing eligibility.

#### SCREEN 33: Employee Loan Processing (`src/app/employee/loans/page.tsx`)
* **URL**: `/employee/loans`
* **Purpose**: Loan origination desk for staff to enter collateral weights and prepare loan proposals for manager approval.

#### SCREEN 34: Employee Repayment Collection (`src/app/employee/payments/page.tsx`)
* **URL**: `/employee/payments`
* **Purpose**: Cashier desk for entering counter payments and generating customer payment receipts.

#### SCREEN 35: Employee Bank Re-Pledge Monitoring (`src/app/employee/re-pledge/page.tsx`)
* **URL**: `/employee/re-pledge`
* **Purpose**: Branch view of re-pledged assets, tracking items currently in external bank vaults.

#### SCREEN 36: Employee Approval Requests (`src/app/employee/approvals/page.tsx`)
* **URL**: `/employee/approvals`
* **Purpose**: Allows employees to submit high-LTV exception requests, interest discount requests, or deletion requests to branch managers.

#### SCREEN 37: Employee Account Statements (`src/app/employee/statement/page.tsx`)
* **URL**: `/employee/statement`
* **Purpose**: Generates and prints official statement PDFs for walk-in borrowers.

---

### 6.4 Customer Mobile Portal Suite (8 Screens)

#### SCREEN 38: Customer Mobile Dashboard (`src/app/customer/dashboard/page.tsx`)
* **URL**: `/customer/dashboard`
* **Purpose**: Borrower home screen optimized for mobile viewports.
* **Components**:
  - Live Outstanding Balance Hero Card: Dynamically counts up total outstanding balance (Principal + Live Accrued Interest).
  - Upcoming Due Alert Strip: Highlights loans nearing maturity or inside grace periods.
  - Active Loans Card Carousel: Quick swipe view of each active pledge.
  - Bottom Tab Navigation Dock: Dashboard, Loans, Collateral, Payments, Profile.

#### SCREEN 39: Customer Loans Portfolio (`src/app/customer/loans/page.tsx`)
* **URL**: `/customer/loans`
* **Purpose**: Complete index of borrower's loans separated into "Active" and "Settled". Displays loan number, principal, interest rate, maturity date, and status badges.

#### SCREEN 40: Customer Loan Dossier (`src/app/customer/loans/[id]/page.tsx`)
* **URL**: `/customer/loans/[id]`
* **Purpose**: Deep-dive dossier for a specific loan.
* **Features**: Live daily interest ticker, itemized collateral list, repayment timeline with download links, "Download Pawn Ticket PDF" button.

#### SCREEN 41: Customer Collateral Vault Gallery (`src/app/customer/collateral/page.tsx`)
* **URL**: `/customer/collateral`
* **Purpose**: High-resolution photographic catalog of the borrower's jewelry stored in the vault. Displays gross weight, stone weight, net weight, karat purity, and safe custody reference.

#### SCREEN 42: Customer Repayment Receipts Archive (`src/app/customer/payments/page.tsx`)
* **URL**: `/customer/payments`
* **Purpose**: Chronological financial ledger of all payments made by the customer. Shows receipt number, date, payment mode, interest cleared, principal reduced, and instant PDF download button.

#### SCREEN 43: Customer Account Statements (`src/app/customer/statement/page.tsx`)
* **URL**: `/customer/statement`
* **Purpose**: Full formal statement of accounts with lifetime borrowing history and single-tap statement PDF export.

#### SCREEN 44: Customer Notifications Inbox (`src/app/customer/notifications/page.tsx`)
* **URL**: `/customer/notifications`
* **Purpose**: Real-time push feed of loan origination alerts, payment confirmations, interest updates, and maturity reminders.

#### SCREEN 45: Customer Profile & Security Credentials (`src/app/customer/profile/page.tsx`)
* **URL**: `/customer/profile`
* **Purpose**: Profile inspection (registered phone, address, nominee) and self-service password update interface.

---

## 7. Complete API Route Specifications

### 7.1 Customer Onboarding API Route (`src/app/api/admin/onboard/route.ts`)
* **Endpoint**: `POST /api/admin/onboard`
* **Security**: Enforces mandatory Firebase ID token verification. Caller must hold `Admin` or `Owner` role.
* **Functionality**:
  1. Validates required payload fields via Zod: `name`, `phone_primary`, `address`, `national_id`.
  2. Executes duplicate conflict checks across Firestore `profiles` for `phone_primary`, `national_id` (Aadhaar), and `pan_number`.
  3. Provisions a new Firebase Auth user with a secure generated credential.
  4. Constrains created account role strictly to `Customer` (preventing privilege escalation).
  5. Creates Firestore profile document keyed by the Auth UID with autogenerated customer number `PGF-CUST-XXXX`.
  6. Returns sanitized profile object with HTTP 201 Created.

### 7.2 Authoritative Server-Side PDF Engine (`src/app/api/pdf/route.ts`)
* **Endpoint**: `GET /api/pdf` & `POST /api/pdf`
* **Security & Access Control**:
  - Requires Firebase ID Token via `Authorization: Bearer <token>` header or `?token=` parameter.
  - Verifies token via Firebase Admin SDK (`adminAuth.verifyIdToken`).
  - **Customer Anti-IDOR Enforcement**: If caller is a `Customer`, the route strictly validates that `caller.uid === targetCustomerId`. Customers attempting to access documents belonging to another borrower receive HTTP 403 Forbidden. Customers are also blocked from internal accounting ledgers.
* **Document Routing**: Dispatches into 5 distinct layout compilers based on `type`:

```mermaid
graph TD
    A[Incoming Request /api/pdf] --> B{Verify Firebase ID Token}
    B -->|Failed| C[HTTP 401 Unauthorized]
    B -->|Valid| D{Check Role & Anti-IDOR}
    D -->|Forbidden| E[HTTP 403 Forbidden]
    D -->|Authorized| F[Authoritative Fetch from Firestore via Admin SDK]
    F --> G{Route Document Type}
    G -->|ticket / pawn_ticket / loan_agreement| H[1. Pawn Ticket Layout]
    G -->|loan_application| I[2. Loan Application Layout]
    G -->|receipt / bill / payment_receipt| J[3. Payment Receipt & Slogan Layout]
    G -->|release / closure / gold_release| K[4. Collateral Release Deed Layout]
    G -->|statement / customer_statement| L[5. Statement of Accounts Layout]
    H --> M[Direct Storage Buffer Image Loading]
    I --> M
    J --> M
    K --> M
    L --> M
    M --> N[PDFKit Standalone Streaming]
    N --> O[HTTP 200 Binary PDF Stream]
```

---

## 8. Complete Cloud Firestore Database Schemas (15 Collections)

The database runs on Google Cloud Firestore utilizing 15 dedicated collections:

### 8.1 Collection: `profiles`
Document ID: Firebase Auth User UID (`string`)
```typescript
interface Profile {
  id: string;                         // Firebase Auth UID
  name: string;                       // Full Legal Name
  phone_primary: string;              // 10-digit primary mobile (Unique index)
  phone_alt?: string | null;          // Secondary contact
  email?: string | null;              // Email address
  date_of_birth?: string | null;      // YYYY-MM-DD
  gender?: 'Male' | 'Female' | 'Other' | null;
  marital_status?: 'Single' | 'Married' | 'Widowed' | 'Divorced' | null;
  address: string;                    // Street address
  city?: string | null;
  district?: string | null;
  state?: string | null;
  pin_code?: string | null;
  national_id: string;                // 12-digit Aadhaar Number (Unique index)
  pan_number?: string | null;         // 10-character PAN (Unique index)
  occupation?: string | null;
  monthly_income?: number | null;
  reference_person?: string | null;
  reference_phone?: string | null;
  nominee_name?: string | null;
  nominee_relation?: string | null;
  nominee_mobile?: string | null;
  role: UserRole;                     // Admin | Owner | Manager | Appraiser | Cashier | Accountant | Employee | Customer
  status: 'Active' | 'Inactive' | 'Blocked' | 'Deleted';
  customer_number?: string | null;    // e.g. PGF-CUST-1001
  photo_url?: string | null;          // Cloud Storage URL
  signature_url?: string | null;      // Cloud Storage URL
  aadhaar_front_url?: string | null;
  aadhaar_back_url?: string | null;
  pan_url?: string | null;
  voter_id_url?: string | null;
  driving_license_url?: string | null;
  passport_url?: string | null;
  branch_id?: string | null;          // Linked branch
  is_2fa_enabled: boolean;
  two_factor_secret?: string | null;
  kyc_status: 'Pending' | 'Submitted' | 'Under_Review' | 'Approved' | 'Rejected' | 'Expired';
  kyc_approved_by?: string | null;
  kyc_approved_at?: string | null;
  tags: string[];
  created_at: string;                 // ISO 8601
  updated_at: string;
}
```

### 8.2 Collection: `loans`
Document ID: Autogenerated UUID (`string`)
```typescript
interface Loan {
  id: string;
  customer_id: string;                // FK -> profiles.id
  loan_number: string;                // e.g. PGF-LN-1001 (Unique index)
  principal_amount: number;           // Disbursed principal (Paise accurate)
  interest_rate_apr: number;          // Annual Percentage Rate (e.g. 18.00)
  status: LoanStatus;                 // Draft | Pending_Approval | Active | Due | Overdue | Grace_Period | Defaulted | Auctioned | Settled | Cancelled | Rejected
  loan_period_months: number;         // e.g. 12
  disbursed_amount: number | null;
  total_interest_paid: number;        // Cumulative interest payments
  total_principal_paid: number;       // Cumulative principal repayments
  outstanding_interest: number;       // Live calculated outstanding interest
  last_interest_calc_date: string;    // YYYY-MM-DD
  origination_date: string;           // ISO 8601
  maturity_date: string;              // Origination + tenure months
  grace_expiry_date: string;          // Maturity + 30 days
  closed_at?: string | null;
  release_number?: string | null;     // e.g. PGF-REL-1001
  release_date?: string | null;
  branch_id?: string | null;
  qr_code?: string | null;
  risk_score?: string | null;
  current_bin_id?: string | null;     // Physical storage bin
  created_at: string;
  updated_at: string;
}
```

### 8.3 Collection: `gold_collateral`
Document ID: Autogenerated UUID (`string`)
```typescript
interface GoldCollateral {
  id: string;
  loan_id: string;                    // FK -> loans.id
  customer_id: string;                // FK -> profiles.id
  item_description: string;           // e.g. "Gold Necklace 22K with Stones"
  ornament_type?: string | null;      // Necklace | Ring | Bangle | Chain | Earring | Coin
  quantity: number;                   // Item count
  gross_weight: number;               // In grams (e.g. 24.50)
  stone_weight: number;               // In grams (e.g. 1.20)
  net_weight: number;                 // gross_weight - stone_weight (23.30g)
  purity_karat: '18K' | '21K' | '22K' | '24K';
  hallmark: boolean;                  // BIS 916 hallmarked
  gold_rate_per_gram: number;         // Rate used at appraisal
  valuation_inr: number;              // Net weight * rate
  max_eligible_loan: number;          // Valuation * 0.75
  storage_bin_id: string;             // Safe room bin code (e.g. BIN-A4-08)
  custody_location: string;           // 'PGF Safe' or Commercial Bank Name
  bank_repledge_id?: string | null;   // FK -> bank_repledge.id if repledged
  front_photo_url?: string | null;
  back_photo_url?: string | null;
  side_photo_url?: string | null;
  created_at: string;
}
```

### 8.4 Collection: `gold_photos`
Document ID: Autogenerated UUID (`string`)
```typescript
interface GoldPhoto {
  id: string;
  collateral_id: string;              // FK -> gold_collateral.id
  loan_id: string;                    // FK -> loans.id
  photo_url: string;                  // Cloud Storage URL
  created_at: string;
}
```

### 8.5 Collection: `payments`
Document ID: Autogenerated UUID (`string`)
```typescript
interface Payment {
  id: string;
  loan_id: string;                    // FK -> loans.id
  customer_id: string;                // FK -> profiles.id
  amount_paid: number;                // Total cash/digital received
  interest_portion: number;           // Allocated to clear accrued interest
  principal_portion: number;          // Allocated to reduce principal
  penalty_amount: number;             // Allocated to penalty fees
  waiver_amount: number;              // Approved discount/waiver
  payment_type: PaymentType;          // Interest | Principal | Partial_Settlement | Full_Settlement | Penalty | Advance
  payment_date: string;               // ISO 8601
  interest_period_from?: string | null;
  interest_period_to?: string | null;
  mode: PaymentMode;                  // Cash | UPI | Bank_Transfer | Card | Debit_Card | Credit_Card | Cheque | Demand_Draft
  transaction_ref?: string | null;    // UPI ref / Cheque number
  receipt_number: string;             // e.g. PGF-REC-1001 (Sequential)
  receipt_pdf_url?: string | null;
  remarks?: string | null;
  slogan_id?: string | null;          // Assigned Tamil slogan ID (1-300)
  slogan_text?: string | null;        // Assigned Tamil slogan text
  created_at: string;
}
```

### 8.6 Collection: `interest_accruals`
Document ID: Autogenerated UUID (`string`)
```typescript
interface InterestAccrual {
  id: string;
  loan_id: string;                    // FK -> loans.id
  accrual_date: string;               // YYYY-MM-DD
  principal_balance: number;          // Active principal balance on date
  interest_rate_apr: number;          // APR on date
  daily_amount: number;               // Daily simple interest accrued
  is_paid: boolean;                   // Cleared by repayment
  paid_at?: string | null;
  payment_id?: string | null;         // FK -> payments.id
  created_at: string;
}
```

### 8.7 Collection: `approval_requests`
Document ID: Autogenerated UUID (`string`)
```typescript
interface ApprovalRequest {
  id: string;
  request_type: ApprovalRequestType;  // High_LTV_Approval | Financial_Waiver | Loan_Approval | Rate_Change | Delete_Customer | Delete_Loan | Delete_Payment
  entity_type: string;                // 'loans' | 'payments' | 'profiles'
  entity_id: string;
  requested_by: string;               // UID
  requested_by_name: string;
  requested_amount?: number;
  eligible_amount?: number;
  reason?: string;
  requested_at: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  details: Record<string, any>;
  reviewed_by?: string | null;
  reviewed_by_name?: string | null;
  reviewed_at?: string | null;
  review_notes?: string | null;
}
```

### 8.8 Collection: `bank_repledge`
Document ID: Autogenerated UUID (`string`)
```typescript
interface BankRePledge {
  id: string;
  repledge_number: string;            // e.g. PGF-REP-1001
  customer_id: string;
  customer_name: string;
  loan_id: string;
  loan_number: string;
  collateral_item_ids: string[];      // Array of FK -> gold_collateral.id
  total_net_weight: number;           // Total grams transferred
  total_valuation: number;            // Total market value
  bank_name: string;                  // e.g. "State Bank of India"
  bank_branch: string;                // e.g. "Madurai Main"
  bank_account_number: string;
  pledge_date: string;
  bank_pledge_amount: number;         // Disbursed by bank
  bank_interest_rate: number;         // Bank APR %
  interest_type: 'Simple' | 'Monthly' | 'Compound' | 'Flat';
  tenure_months: number;
  due_date: string;
  bank_reference_number?: string;
  bank_pledge_ticket_number?: string;
  interest_accrued: number;
  interest_paid: number;
  bank_outstanding: number;
  custody_location: string;           // Physical branch name
  status: BankRePledgeStatus;         // Pending Approval | Approved | Pledged with Bank | Active | Released | Closed
  release_date?: string | null;
  bank_amount_repaid?: number | null;
  created_by: string;
  created_at: string;
}
```

### 8.9 Collection: `branches`
Document ID: Branch code or UUID (`string`)
```typescript
interface Branch {
  id: string;
  name: string;                       // e.g. "Madurai Main Hub"
  code: string;                       // e.g. "MDU-01"
  address: string;
  phone: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
```

### 8.10 Collection: `notifications`
Document ID: Autogenerated UUID (`string`)
```typescript
interface Notification {
  id: string;
  recipient_id: string;               // FK -> profiles.id
  type: NotificationType;             // Loan_Created | Payment_Received | Interest_Updated | Due_Reminder | Overdue_Alert | Loan_Closed | Welcome | System
  title: string;
  message: string;
  channel: 'SMS' | 'WhatsApp' | 'Push' | 'Email' | 'In_App';
  is_read: boolean;
  read_at?: string | null;
  related_entity_type?: string | null;
  related_entity_id?: string | null;
  sent_at: string;
  created_at: string;
}
```

### 8.11 Collection: `audit_logs`
Document ID: Autogenerated UUID (`string`)
```typescript
interface AuditLog {
  id: string;
  actor_id: string;                   // UID of acting operator
  action_type: string;                // e.g. "LOAN_CREATED", "PAYMENT_POSTED"
  affected_entity: string;            // 'loans' | 'profiles' | 'payments'
  affected_entity_id: string;
  old_state?: Record<string, any>;    // State prior to modification
  new_state?: Record<string, any>;    // State after modification
  ip_address?: string;
  timestamp: string;                  // ISO 8601
}
```

### 8.12 Collection: `settings`
Document ID: Setting Key (`string`)
```typescript
interface Setting {
  id: string;                         // Key name, e.g. 'company_name', 'gold_rate_22k'
  key: string;
  value: string;
  label?: string;
  category: 'Company' | 'Loan' | 'Gold' | 'Notification' | 'System';
  updated_by?: string;
  updated_at: string;
  created_at: string;
}
```

### 8.13 Collection: `counters`
Document ID: Specific Counter Key (`string`)
* `counters/loan_number`: Atomic integer incrementer for `PGF-LN-XXXX`.
* `counters/receipt_number`: Atomic integer incrementer for `PGF-REC-XXXX`.
* `counters/customer_number`: Atomic integer incrementer for `PGF-CUST-XXXX`.
* `counters/repledge_number`: Atomic integer incrementer for `PGF-REP-XXXX`.
* `counters/release_number`: Atomic integer incrementer for `PGF-REL-XXXX`.
* `counters/bill_slogan_index`: Atomic integer incrementer (1 to 300) for sequential Tamil slogan rotation.

### 8.14 Collection: `billSlogans`
Document ID: `slogan_{id}` (`string`)
Contains all 300 unique Tamil financial, integrity, and ethical slogans seeded from `src/lib/data/tamilSlogans.ts`.

### 8.15 Collection: `documents`
Document ID: Autogenerated UUID (`string`)
Tracks metadata for all generated PDFs including `doc_type`, `entity_id`, `file_url`, `file_size_bytes`, `generated_by`, and `generated_at`.

---

## 9. Security Architecture & Granular Access Control

### 9.1 Custom Claims Authorization
User privileges are decoupled from client inputs and bound directly to cryptographic Firebase Auth tokens:
* `isAdmin()`: User token has `role === 'Admin'` or `role === 'Owner'`.
* `isStaff()`: User token has `role in ['Admin', 'Owner', 'Manager', 'Appraiser', 'Cashier', 'Employee', 'Accountant']`.
* `isCustomer()`: User token has `role === 'Customer'`.

### 9.2 Firestore Security Rules (`firestore.rules`)
* **Profiles**: Unauthenticated users cannot read or write. Customers can read only their own profile document (`request.auth.uid == resource.id`). Staff can read all profiles. Only Admins/Staff can modify roles and statuses.
* **Loans & Gold Collateral**: Customers can read only loans and collateral where `customer_id == request.auth.uid`. Write operations are restricted strictly to verified staff roles.
* **Payments**: Write operations require atomic transaction validation and are restricted to Cashier/Admin staff. Customers can read only their own payment receipts.
* **Counters & Audit Logs**: Strictly locked from public or customer writes. Accessible only via authenticated staff or Firebase Admin SDK.

### 9.3 Cloud Storage Security Rules (`storage.rules`)
* `customers/{customerId}/*`: Customers can write their own KYC photos; only Staff/Admin can view all borrower documents.
* `collaterals/*`: Upload and modification locked to Staff roles.
* `documents/*`: PDF documents read-only to owning customer and staff.

### 9.4 Server-Side Anti-IDOR & Document Isolation
In `/api/pdf`:
```typescript
if (caller.role === 'Customer') {
  if (targetCustomerId && targetCustomerId !== caller.uid) {
    throw new Error('FORBIDDEN: You do not have permission to view or download documents belonging to another customer.');
  }
}
```

---

## 10. Financial & Mathematical Core Formulas

### 10.1 Daily Simple Interest Accrual Formula
Interest accrues daily on the active principal balance:

$$\text{Daily Interest} = \frac{\text{Principal Balance} \times \left(\frac{\text{APR}}{100}\right)}{\text{Days in Year}}$$

Where:
* $\text{Days in Year} = 366$ if the current calendar year is a leap year; otherwise $365$.
* $\text{Monthly Interest} = \frac{\text{Principal Balance} \times \left(\frac{\text{APR}}{100}\right)}{12}$
* $\text{Daily Accrual}$ posts at `00:00:00` midnight every calendar day.

### 10.2 Net Weight & Valuation Formulas
For each pledged ornament:

$$\text{Net Weight (g)} = \text{Gross Weight (g)} - \text{Stone Weight (g)}$$

$$\text{Valuation (INR)} = \text{Net Weight (g)} \times \text{Purity Adjusted Gold Rate (INR/g)}$$

Where Purity Adjustment Multipliers:
* **24K Gold**: $100\%$ of base 24K rate.
* **22K Gold (916)**: $\frac{22}{24} = 91.67\%$ of 24K rate (or direct 22K market rate).
* **21K Gold**: $\frac{21}{24} = 87.50\%$ of 24K rate.
* **18K Gold (750)**: $\frac{18}{24} = 75.00\%$ of 24K rate.

### 10.3 Regulatory LTV Capping Formula
To protect institutional capital and comply with RBI / Pawnbroker statutory safety guidelines:

$$\text{Maximum Sanctionable Loan} = \sum (\text{Valuation}) \times \text{LTV Cap (75\%)}$$

Any loan proposal requesting an amount exceeding $75\%$ of total appraised valuation automatically halts into `Pending_Approval` status and triggers an escalation to the `approvals` hub.

### 10.4 Atomic Repayment Allocation Priority
Every incoming rupee is allocated strictly in statutory priority order to eliminate ledger ambiguity:

```mermaid
graph TD
    A[Incoming Repayment Amount] --> B{1. Outstanding Penalty Fees?}
    B -->|Yes| C[Clear Penalty Balance]
    B -->|No| D{2. Outstanding Accrued Interest?}
    C --> D
    D -->|Yes| E[Clear Outstanding Interest]
    D -->|No| F{3. Remaining Funds?}
    E --> F
    F -->|Yes| G[Reduce Principal Balance]
    F -->|No| H[Complete Allocation]
    G --> I{Principal Balance == 0?}
    I -->|Yes| J[Auto-Transition Loan to Settled & Trigger Release]
    I -->|No| H
```

Mathematical Proof:
$$\text{Amount Paid} = \text{Penalty Paid} + \text{Interest Paid} + \text{Principal Paid}$$

$$\text{New Principal Balance} = \text{Old Principal Balance} - \text{Principal Paid} - \text{Approved Principal Waiver}$$

---

## 11. Multi-Item Gold Appraisal & Vault Custody Management
* **Precision Weight Scale**: All weighing scales calibrate to two decimal places ($0.01\text{g}$).
* **Hallmark Verification**: Appraisers verify the BIS Hallmark symbol, 6-digit HUID (Hallmark Unique Identification), and jeweller marks.
* **3-Angle Photographic Verification**: Front, Back, and Side macro photographs captured under diffused lighting.
* **Vault Bin Allocation**: Every collateral item is allocated a specific secure bin coordinate (`BIN-{RACK}-{TRAY}-{SLOT}`). Sealed tamper-evident security bags are signed across the seal by the customer and appraiser.

---

## 12. Bank Re-Pledge Management System
The Bank Re-Pledge module provides enterprise gold loan operators with an institutional refinancing mechanism:
1. **Collateral Selection**: Admin selects active collateral items from one or multiple customer loans.
2. **Pledge Transfer**: Gold items are documented, weighed, sealed, and transferred to the custody of commercial banks (e.g. State Bank of India).
3. **Dual-Ledger Accounting**:
   - Customer Ledger continues accruing at customer APR (e.g. 18%).
   - Institutional Bank Ledger tracks bank borrowing amount at institutional rate (e.g. 10.5%).
   - Net Interest Margin (NIM) yields profitable spread for PGF.
4. **Release Protocol**: When a customer settles their loan, the system alerts the admin to execute bank settlement, release collateral from the bank branch, and return custody to `PGF Safe` before customer handover.

---

## 13. Fast-Billing POS & 300 Tamil Slogans Engine
* **High-Speed Counter Billing**: Cashiers process walk-in repayments in $<10$ seconds.
* **Atomic Sequential Slogans Rotation**:
  - The system contains 300 curated Tamil ethical, financial, and cultural proverbs.
  - Slogan index is tracked inside `counters/bill_slogan_index`.
  - With each generated receipt, `transaction.get()` reads the index, increments by 1 (cycling from 300 back to 1), and stamps the permanent slogan on the receipt record.
  - Zero consecutive repeat guarantee.
* **Dual-Language Printing**: Bills print header and financial figures in English with statutory disclaimers and slogans rendered cleanly in Tamil Unicode using the registered `Nirmala.ttf` font.

---

## 14. Server-Side PDF Document Generation Suite

The standalone PDF engine (`src/app/api/pdf/route.ts`) compiles 5 distinct vector document types on demand:

```
+-----------------------------------------------------------------------------+
| [LOGO]  PAVITHRA GOLD FINANCE                               QR: SCAN VERIFY |
|         TAMIL NADU LICENSED PAWNBROKER & GOLD FINANCIER     [############]  |
|         Branch: Madurai Main Hub (MDU-01) | Phone: +91 7094826586           |
+-----------------------------------------------------------------------------+
| OFFICIAL RECEIPT OF PLEDGE (PAWN TICKET)             TICKET NO: PGF-LN-1001 |
+-----------------------------------------------------------------------------+
| BORROWER PARTICULARS                  | LOAN TERMS & SANCTION               |
| Name: Priya Rajendran                 | Principal: ₹85,000.00               |
| Customer ID: PGF-CUST-1042            | APR: 18.00% (1.50% / month)         |
| Mobile: +91 9876543210                | Monthly Interest: ₹1,275.00         |
| Address: 12, South Veli St, Madurai   | Pledge Date: 18 Sep 2026            |
| Aadhaar: XXXX-XXXX-4512               | Maturity Date: 18 Sep 2027          |
| Photo: [EMBEDDED BORROWER PHOTO]      | Vault Ref: BIN-A4-08                |
+-----------------------------------------------------------------------------+
| PLEDGED GOLD COLLATERAL INVENTORY                                           |
| #  | Description        | Purity | Gross Wt | Stone Wt | Net Wt | Valuation |
| 1  | 22K Gold Bangles   | 22K    | 24.50g   | 0.50g    | 24.00g | ₹1,56,000 |
| 2  | 22K Gold Chain     | 22K    | 16.20g   | 0.00g    | 16.20g | ₹1,05,300 |
|    | TOTAL COLLATERAL   |        | 40.70g   | 0.50g    | 40.20g | ₹2,61,300 |
+-----------------------------------------------------------------------------+
| [EMBEDDED COLLATERAL PHOTO 1]       [EMBEDDED COLLATERAL PHOTO 2]           |
+-----------------------------------------------------------------------------+
| STATUTORY TERMS & CONDITIONS (TAMIL & ENGLISH)                              |
| 1. The borrower has 12 months to redeem the pledged ornaments.              |
| 2. அடைமானம் வைக்கப்பட்ட தங்க நகைகளை 12 மாத காலத்திற்குள் மீட்க வேண்டும்.    |
+-----------------------------------------------------------------------------+
| Borrower Signature: [SIGNATURE]             Authorized Signatory: [STAMP]   |
+-----------------------------------------------------------------------------+
| Slogan: "தங்கத்தை பாதுகாப்போம், எதிர்காலத்தை பிரகாசமாக்குவோம்"             |
+-----------------------------------------------------------------------------+
```

### 14.1 Document Catalog
1. **Pawn Ticket / Pledge Receipt** (`ticket`, `pawn_ticket`, `loan_agreement`): Comprehensive pledge deed with customer photograph, signature, itemized weight table, high-resolution collateral photos, English & Tamil statutory terms, and QR verification.
2. **Loan Application Form** (`loan_application`): Formal credit request docket, family particulars, asset declaration, appraiser certificate.
3. **Repayment Receipt / Bill** (`receipt`, `bill`, `payment_receipt`): Cashier counter invoice showing paise-accurate split, new remaining principal, live cleared interest, dynamic Tamil slogan, and cashier sign-off.
4. **Collateral Release Certificate** (`release`, `closure`, `release_certificate`): Formal settlement deed confirming zero balance, release of pledged items, customer handover acknowledgement.
5. **Statement of Accounts** (`statement`, `customer_statement`, `loan_statement`): Complete chronological ledger of borrowing history, interest calculations, and transaction records.

---

## 15. Enterprise 50-Sheet Excel Reporting Suite

The enterprise Excel engine (`src/lib/excel-enterprise.ts`) compiles an exhaustive 50-sheet operational and financial workbook (`PGF_Enterprise_YYYY_MM_DD.xlsx`):

| Sheet # | Sheet Name | Core Content & Data Model |
| :---: | :--- | :--- |
| **01** | `Dashboard` | High-level KPI summary, active portfolios, cash position, gold weights. |
| **02** | `Company Settings` | Registered business profile, GSTIN, PAN, licensing parameters. |
| **03** | `Customer Master` | Complete customer registry, KYC status, contact parameters. |
| **04** | `Nominee Details` | Emergency contacts and legal nominees linked to borrowers. |
| **05** | `Digital KYC` | Verification dates, Aadhaar/PAN validation status, biometric flags. |
| **06** | `Customer Documents` | Catalog of uploaded KYC documents and verification links. |
| **07** | `Gold Master` | Every pledged gold ornament, gross/stone/net weights, purity, valuation. |
| **08** | `Gold Photos` | Collateral image URLs, storage bucket paths, upload timestamps. |
| **09** | `Gold Rate History` | Daily market rate tracking for 24K, 22K, and 18K gold. |
| **10** | `Loan Master` | Complete active and historical loan directory with principal and rates. |
| **11** | `Loan Status` | Lifecycle status tracking (Draft, Active, Due, Overdue, Settled). |
| **12** | `Interest Ledger` | Daily simple interest accruals and payment clearances. |
| **13** | `Payment Ledger` | Every repayment transaction with mode, splits, and receipt numbers. |
| **14** | `Receipt Register` | Sequential receipt index with customer names and total amounts. |
| **15** | `Pawn Ticket Register` | Statutory register of all issued pawn tickets. |
| **16** | `Auction Register` | Defaulted loans slated for statutory public auction. |
| **17** | `Auction Bids` | Bidder registrations, bid amounts, winning lot assignments. |
| **18** | `Cash Book` | In-branch daily cash inflows, disbursements, counter expenses. |
| **19** | `Bank Book` | Digital banking transactions, UPI settlements, bank charges. |
| **20** | `General Ledger` | Double-entry journal postings across chart of accounts. |
| **21** | `Journal Entries` | Granular debit/credit ledger records. |
| **22** | `Trial Balance` | Balanced debit and credit verification across all accounts. |
| **23** | `Profit & Loss` | Monthly and YTD operational income, interest yield, staff overheads. |
| **24** | `Balance Sheet` | Assets (loan portfolio, vault gold), Liabilities (bank debt), Equity. |
| **25** | `Expenses` | Operating expenses, utilities, branch rent, security costs. |
| **26** | `Income` | Interest income, document fees, late payment penalties. |
| **27** | `GST Reports` | Monthly outward supply taxable values and CGST/SGST liability. |
| **28** | `Employee Attendance`| Daily branch staff punch logs and active shifts. |
| **29** | `Leave Register` | Staff leave records, casual/sick leave allowances. |
| **30** | `Payroll` | Monthly salary disbursements, deductions, bonuses. |
| **31** | `Incentives` | Staff appraisal and collection performance incentives. |
| **32** | `Branch Performance` | Multi-branch revenue comparison, loan growth, NPA ratios. |
| **33** | `Customer Support` | Borrower inquiry logs, resolution statuses, ticket turnaround time. |
| **34** | `Notifications` | Dispatched SMS, WhatsApp, and Push message audit trail. |
| **35** | `Audit Logs` | Immutable system action log, actor IDs, diffs, IP addresses. |
| **36** | `Login History` | Authentication log, IP address, browser user agents. |
| **37** | `Device Management` | Verified teller terminal MAC addresses and authorized devices. |
| **38** | `Backup Logs` | Daily database snapshot logs, cloud backup verification status. |
| **39** | `Reports` | Pre-compiled management summary statistics. |
| **40** | `BI Analytics` | Capital deployment efficiency, portfolio turnover velocity. |
| **41** | `AI Risk Score` | Borrower credit risk ratings and LTV sensitivity models. |
| **42** | `Settings` | Key-value application parameters snapshot. |
| **43** | `Lookup Tables` | Standard dropdown definitions (ornament types, purities). |
| **44** | `Master Lists` | System enumerations and valid state definitions. |
| **45** | `Import Data` | Historical migration staging format. |
| **46** | `Export Data` | External auditor export formatting. |
| **47** | `Branch Master` | Branch codes, addresses, and manager contacts. |
| **48** | `Employee Master` | Staff directory, roles, Aadhaar/PAN records. |
| **49** | `Roles & Permissions`| Granular RBAC permission assignment matrix. |
| **50** | `Dashboard Charts` | Pre-formatted statistical data points ready for executive graphing. |

---

## 16. Multi-Branch Operations & Organizational Hierarchy
* **Branch Isolation**: Every loan, payment, customer, and vault bin is tagged with `branch_id`.
* **Central Backoffice Switcher**: Admins can seamlessly toggle between individual branch views or inspect an aggregated enterprise consolidated view.
* **Staff Branch Assignment**: Tellers and Appraisers are locked to their primary branch, preventing cross-branch counter discrepancies.

---

## 17. Multi-Level Approvals & Financial Waiver Workflows
* **High-LTV Exception Protocol**: If a loan request exceeds the standard $75\%$ LTV cap, the submission creates an `approval_requests` entry in `Pending` status. The loan cannot disburse until an Admin or Owner clicks "Approve".
* **Financial Waiver Protocol**: Cashiers cannot discount interest or waive principal unilaterally. A waiver request must be approved by a Manager/Admin, which automatically logs the authorized waiver amount into the payment record.
* **Audit Trail**: Every approval and rejection logs the reviewer's UID, timestamp, and review notes into `approval_requests` and `audit_logs`.

---

## 18. Collateral Auctions & Default Liquidation Engine
* **Statutory Grace Period**: Borrowers receive 30 days of grace past the 365-day loan maturity date before auction initiation.
* **Auction Notice Dispatches**: Automatic dispatches sent via registered post notice, SMS, and WhatsApp alerts giving 14 days final notice.
* **Lot Cataloging & Reserve Valuation**: Collateral ornaments are grouped into auction lots. Reserve price is automatically computed as:
  $$\text{Reserve Price} = \text{Net Weight (g)} \times \text{Current Gold Rate} \times 0.95$$
* **Settlement & Surplus Refund**: Auction sale proceeds clear outstanding interest and principal. Any surplus funds remaining are credited to the borrower's registered bank account.

---

## 19. Real-Time Push & Multi-Channel Reminder Automation
* **Event-Driven Alerts**:
  - `LOAN_CREATED`: Sends immediate welcome message, loan number, principal, and digital Pawn Ticket link.
  - `PAYMENT_RECEIVED`: Sends instant receipt acknowledgment, amount received, and new principal balance.
  - `MATURITY_WARNING`: Triggered automatically at $T-30$, $T-15$, $T-7$, $T-3$, and $T-1$ days before maturity.
  - `OVERDUE_ALERT`: Daily notifications dispatched to borrowers in default status.
* **Multi-Channel Dispatch Engine**: Integrates with Firebase Cloud Messaging (In-App Push), WhatsApp Cloud API, and transactional SMS gateways.

---

## 20. Audit Trail & Regulatory Compliance Logging
* **Tamper-Evident History**: Every create, update, and delete operation writes an immutable entry into `audit_logs`.
* **State Diff Capture**: Captures `actor_id`, `action_type`, `affected_entity`, `affected_entity_id`, `old_state` (JSON), `new_state` (JSON), `ip_address`, and ISO timestamp.
* **Statutory Compliance**: Conforms to Tamil Nadu Pawnbrokers Act and RBI Fair Practices Code for gold loan lending.

---

## 21. System Settings & Business Configurations
Configured dynamically via `/admin/settings`:
* `company_name`: Registered legal entity name.
* `company_address`: Official head office / branch address.
* `company_phone`: Official customer support helpline.
* `company_gst`: 15-digit State GSTIN.
* `company_pan`: 10-character Business PAN.
* `company_cin`: Corporate Identification Number.
* `pawn_license`: Government Pawnbroker Registration number.
* `gold_rate_24k`, `gold_rate_22k`, `gold_rate_18k`: Real-time market gold rates per gram.
* `base_apr`: Default annual percentage rate (e.g. 18.00%).
* `max_ltv_cap`: Maximum loan-to-value ceiling (e.g. 75%).
* `grace_period_days`: Standard default buffer days (30 days).

---

## 22. Automated Testing & Verification Suite
The codebase includes an automated test suite executed via Node's native test runner (`node --test tests/**/*.test.mjs`):
1. **`tests/payments.test.mjs`**: Validates interest-first allocation, penalty priority, waiver reduction, full settlement detection, allocation sum mismatch rejection, balance limit enforcement, and settled loan protection.
2. **`tests/pdf-security.test.mjs`**: Validates ID token requirement, customer isolation (preventing cross-customer document access), staff document access, accounting report restriction, collateral photo normalization, and company settings validation.
3. **`tests/storage-rules.test.mjs`**: Validates elimination of flawed role checks, explicit `isAdmin()` and `isStaff()` definitions, and customer KYC path protections.
4. **Build Verification**: Zero TypeScript errors (`npx tsc --noEmit`) and clean Next.js production build (`npm run build`).

---

## 23. Production Deployment & Live Readiness Guide

### 23.1 Environment Configuration (`.env.local`)
```ini
# Firebase Public Client
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=pavithra-gold-finance.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=pavithra-gold-finance
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=pavithra-gold-finance.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id

# Firebase Admin SDK (Server Authority)
FIREBASE_ADMIN_PROJECT_ID=pavithra-gold-finance
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxxxx@pavithra-gold-finance.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...\n-----END PRIVATE KEY-----\n"
FIREBASE_ADMIN_STORAGE_BUCKET=pavithra-gold-finance.firebasestorage.app
```

### 23.2 Firebase Rules Deployment
```bash
# 1. Deploy Firestore Security Rules
firebase deploy --only firestore:rules

# 2. Deploy Cloud Storage Security Rules
firebase deploy --only storage:rules

# 3. Deploy Web Application Bundle
npm run build
firebase deploy --only hosting
```

---

## 24. Acceptance Criteria & Zero-Defect Mandates
* **AC-01 (Strict Customer Isolation)**: A borrower must never under any circumstances be able to access, view, or download another customer's loan records, collateral photos, or payment receipts.
* **AC-02 (Paise Precision Guarantee)**: No floating point rounding errors in repayment allocations; all allocations must balance down to $₹0.00$.
* **AC-03 (Authoritative PDFs)**: PDF documents must never accept unverified client parameters; all document data must resolve directly from authoritative Firestore records.
* **AC-04 (Atomic Slogans)**: Slogans on receipts must advance sequentially across all 300 entries with zero repeat collisions.
* **AC-05 (Zero Type Errors)**: Codebase must compile cleanly with `tsc --noEmit` and build without warnings.

---

## 25. Conclusion
This Master Requirements Document provides the single authoritative technical blueprint for **Pavithra Gold Finance (PGF)**. By documenting all 45 application screens, 18 admin modules, 7 employee modules, 8 customer modules, 15 Firestore collections, server-side PDF and Excel engines, mathematical models, and security rules, the engineering and operations teams possess a complete, verified reference for production maintenance and future enterprise scaling.
