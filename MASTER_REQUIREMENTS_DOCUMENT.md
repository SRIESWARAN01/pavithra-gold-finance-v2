# Pavithra Gold Finance (PGF) - Master Requirements Document (MRD)
## Production Enterprise Gold Loan & Capital Management System Blueprint & Technical Specification
### Version 2.5 (Comprehensive Enterprise Edition — All Features & Portals)

---

## 1. Executive Summary
**Pavithra Gold Finance (PGF)** is an enterprise-grade, cloud-native digital gold loan management system (ERP) and institutional capital platform purpose-built for licensed pawnbrokers, non-banking financial institutions, and gold lending enterprises. The platform digitizes the entire physical gold lending and capital management lifecycle:
* **Customer Onboarding & KYC**: Live webcam biometric photo capture, document scanning (Aadhaar, PAN, Voter ID, Passport), and HTML5 signature pad capture.
* **Multi-Item Gold Appraisal & Vault Custody**: Granular itemization (gross weight, stone weight, net weight, purity 18K/21K/22K/24K), 3-angle high-resolution collateral photography (Front, Hallmark/Purity mark, Scale reading), and physical vault bin assignment.
* **Controlled Interest Engine**: Dynamic daily simple interest calculation based on standard approved APR tiers (18%, 20%, 22%, 24%, 30%), leap-year calendar awareness ($365/366$ days), and authorized administrative APR modification with immutable audit logging.
* **Atomic Payment Ledger & Fast POS Billing**: Strict payment allocation waterfall (Penalty $\to$ Interest $\to$ Principal), paise-accurate integer arithmetic, fast counter POS billing, and sequential atomic assignment across 300 unique Tamil cultural slogans.
* **Commercial Bank Re-Pledge Liquidity Engine**: Institutional facility to re-pledge idle vault collateral with scheduled commercial banks to unlock working capital while maintaining end-to-end chain-of-custody tracking.
* **Expenses & P&L Accounting Suite**: Real-time operating expense categorization, voucher generation, and automated Daily, Monthly, Yearly, and Branch-Wise Profit & Loss (P&L) statements.
* **Consolidated Financial & Collateral Position**: Unified asset/liability management balancing vault gold, bank re-pledged gold, total active loan books, investor liabilities, and net equity.
* **KYC Consultation & Customer 360 Risk Scoring**: Complete historical profile analysis across all past and active loans, repayment velocity, collateral redemption rate, and default risk rating.
* **Investor Portal & Capital Management Suite**: End-to-end institutional investor management with fixed/compounding schemes, lot-based capital tracking, automated monthly yield generation, and dual-authorization withdrawal workflows.
* **Barcode & QR Loan Scanner**: Camera-based and USB barcode/QR scanner integration for rapid pawn ticket lookup, counter payments, and physical vault audits.
* **Document Compilation & Enterprise Reporting**: High-performance server-side PDFKit engine with TrueType Nirmala Tamil Unicode rendering (Pawn Tickets, Dual Receipts, Release Deeds, KYC Dossiers, Statements) and a 50-sheet enterprise financial Excel generator.
* **Multi-Channel Messaging & Native Desktop Shell**: Automated In-App Push (FCM), transactional SMS, and WhatsApp Cloud reminders, alongside an Electron native desktop wrapper for thermal printer hardware integration.

---

## 2. Product Vision & Core Strategic Pillars
1. **Absolute Operational Transparency**: Borrowers inspect live daily interest accrual down to the minute, view 3-angle high-resolution photographs of pledged jewelry, track physical vault custody, and download verifiable statutory PDF receipts instantly on mobile devices.
2. **Bank-Grade Zero-Trust Security**: Enforces Firebase ID token authentication, cryptographic role claims, strict Firestore & Cloud Storage security rules, dev clock-skew resilience, and server-side anti-IDOR (Insecure Direct Object Reference) access controls.
3. **Paise-Accurate Financial Integrity**: All financial transactions, payment allocations, receipt numbering, and Tamil slogan rotations execute inside ACID atomic Firestore transactions, completely eliminating floating-point drift and ledger race conditions.
4. **End-to-End Asset & Liquidity Management**: Complete multi-dimensional capital tracking connecting physical gold inventory, bank re-pledge obligations, investor capital lots, operational expenses, and net profit margins.
5. **Executive Luxury Aesthetics & Tactile UX**: Curated deep navy (`#0A192F`), rich gold (`#D4AF37`), and crisp slate typography delivering an executive backoffice dashboard for desktop operators, an optimized counter POS, an investor cockpit, and a mobile-first touch portal for borrowers.

---

## 3. Business Goals & KPI Metrics
* **BG-01 (100% Paperless Auditing)**: Every loan pledge, payment receipt, collateral release deed, customer statement, and investor voucher is compiled server-side as a digitally verifiable PDF with QR verification.
* **BG-02 (Zero Dispute Accounting)**: Daily simple interest computed transparently at midnight with leap-year adaptation ($365/366$ days), matching customer mobile counters down to two decimal places ($₹0.00$).
* **BG-03 (40% Default Reduction)**: Automated scheduled alerts dispatched at $T-30$, $T-15$, $T-7$, $T-3$, $T-1$, maturity date, and daily overdue intervals via WhatsApp, SMS, and Push.
* **BG-04 (Complete Re-Pledge Liquidity)**: Enables enterprise management to legally re-pledge vaulted collateral with scheduled commercial banks to unlock institutional working capital while maintaining strict audit traceability.
* **BG-05 (Real-Time P&L Intelligence)**: Immediate visibility into gross operating income, operating overheads, bank re-pledge borrowing costs, investor yield payouts, and net profit margins across all branches.
* **BG-06 (Institutional Investor Enablement)**: Provides dedicated investor dashboards, transparent lot-based compounding or monthly yield distributions, and bank-grade withdrawal safeguards.

---

## 4. Target User Roles & Granular RBAC Matrix
The system defines **11 distinct user roles** enforced via Firebase Authentication custom claims and verified database profiles:

| Role | Portal / Access Scope | Key Permissions & Responsibilities |
| :--- | :--- | :--- |
| **Admin** / **Owner** | Full Backoffice (`/admin/*`) | Complete administrative authority: system settings, branch management, employee provisioning, high-LTV approvals, financial waivers, audit logs, and accounting. |
| **Manager** | Operations Backoffice (`/admin/*`) | Branch-level oversight: approves loans exceeding standard LTV thresholds, authorizes interest discounts, reviews staff performance, and audits daily cash balance. |
| **Appraiser** | Backoffice (`/admin/*`, `/employee/*`) | Physical gold evaluation: measures gross/stone/net weight, tests 18K/21K/22K/24K karat purity, uploads 3-angle photos, and assigns vault storage bins. |
| **Cashier** | Counter POS (`/admin/billing`, `/admin/payments`, `/employee/payments`) | Front-desk cash collection: records repayments, disburses loan principals, executes atomic receipt printing with sequential slogans. |
| **Accountant** | Financial Office (`/admin/accounting`, `/admin/reports`, `/admin/pnl/*`) | Core bookkeeping: audits cash book, bank book, journal entries, trial balance, P&L, balance sheet, and GST filings. |
| **Employee** (General Staff) | Employee Portal (`/employee/*`) | Operational branch staff: searches customers, submits draft loan applications, collects counter payments, checks re-pledge status. |
| **Collection Officer** | Backoffice (`/admin/loans`, `/admin/notifications`) | Dues recovery: monitors overdue loans, triggers reminder notifications, tracks grace period expirations. |
| **Customer Support** | Support Desk (`/admin/support`) | Borrower assistance: reviews inquiries, resolves identity discrepancies, assists with password resets. |
| **Customer** (Borrower) | Mobile Portal (`/customer/*`) | Self-service borrower: views active loans, live accrued interest, collateral photos, payment histories, and downloads PDFs. |
| **Investor** | Investor Portal (`/investor/*`) | Capital provider: tracks active investment lots, monitors accrued yields, submits top-up investments and withdrawal requests, downloads tax statements. |
| **Super Admin** | System Infrastructure | Cloud infrastructure administration, disaster recovery, and database migration control. |

### 4.1 Granular Permissions Matrix Across Functional Domains

| Functional Domain | Admin / Owner | Manager | Appraiser | Cashier | Accountant | Employee | Customer | Investor |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Customer KYC Create/Edit** | Full | Full | View | View | View | Full | View Own | None |
| **Loan Appraisal & Creation** | Full | Full | Full | Draft | View | Draft | View Own | None |
| **Loan APR Modification** | Full | Auth Only | None | None | None | None | None | None |
| **Counter Repayment Collection** | Full | Full | None | Full | View | Full | None | None |
| **Collateral Vault & Photos** | Full | Full | Full | View | View | View | View Own | None |
| **Bank Re-Pledge Management** | Full | Full | View | None | View | View | None | None |
| **Expenses & P&L Ledgers** | Full | View | None | None | Full | None | None | None |
| **Consolidated Position** | Full | Full | None | None | Full | None | None | None |
| **KYC Consultation Tool** | Full | Full | Full | Full | Full | Full | None | None |
| **Investor Management (Admin)** | Full | View | None | None | Full | None | None | None |
| **Investor Self-Service** | None | None | None | None | None | None | None | Full Own |
| **Document PDF Downloads** | Full | Full | Full | Full | Full | Full | View Own | View Own |
| **50-Sheet Excel Workbook** | Full | Full | None | None | Full | None | None | None |
| **System Settings & Rates** | Full | None | None | None | None | None | None | None |

---

## 5. Technical Architecture & Technology Stack

```mermaid
graph TB
    subgraph Client Tier
        A[Next.js 16 Client - Desktop Admin]
        B[Next.js 16 Client - Mobile Customer]
        C[Next.js 16 Client - Employee Portal]
        D[Next.js 16 Client - Investor Portal]
        E[Electron Native Desktop Shell - POS & Thermal]
    end

    subgraph Security & Routing Tier
        F[Firebase Authentication - JWT & Custom Claims]
        G[Next.js Middleware & Route Handlers]
        H[Firestore Security Rules - 32 Collections]
        I[Cloud Storage Security Rules]
    end

    subgraph Core Services Tier
        J[Firebase Admin SDK Engine]
        K[Server PDFKit Engine - TrueType Tamil Unicode]
        L[Enterprise 50-Sheet Excel Workbook Generator]
        M[300 Tamil Slogans Atomic Engine]
        N[Controlled APR & Dynamic Daily Interest Engine]
        O[Bank Re-Pledge & Spread Accounting Engine]
        P[Expenses & Real-time P&L Ledger Engine]
        Q[Investor Lot & Compounding Yield Engine]
    end

    subgraph Persistence Tier
        R[(Cloud Firestore - 32 Collections)]
        S[(Cloud Storage - KYC, Collateral, Receipts)]
        T[Atomic Transactions & Sequential Counters]
    end

    A --> F
    B --> F
    C --> F
    D --> F
    E --> F
    F --> G
    G --> H
    H --> R
    I --> S
    G --> J
    J --> R
    J --> S
    J --> K
    J --> L
    J --> M
    J --> N
    J --> O
    J --> P
    J --> Q
    R --> T
```

### 5.1 Stack Specifications
* **Frontend Framework**: Next.js 16.2.9 (App Router, Turbopack, standalone server output).
* **UI & Rendering Engine**: React 19.2.4, TypeScript 5, Tailwind CSS v4.0 with `@tailwindcss/postcss`.
* **Database**: Google Cloud Firestore (32 collections, real-time snapshot synchronization, ACID atomic transactions).
* **Authentication**: Firebase Authentication v12.17.1 (Client) & Firebase Admin SDK v13.1.0 (Server) with cryptographic ID tokens, custom claims, and development clock-skew resilience.
* **Asset Storage**: Firebase Cloud Storage with folder-level isolation (`/customers/{uid}/*`, `/collateral/*`, `/documents/*`, `/investors/{uid}/*`).
* **Document Compilation**: Server-side `pdfkit` (v0.19.1) with vector layout tables, barcode/QR generation, and Nirmala TrueType Tamil Unicode font registration.
* **Spreadsheet Compiler**: `xlsx` (v0.18.5) delivering 50-sheet enterprise financial workbooks.
* **Desktop Packaging**: Electron Desktop Shell (`electron/main.js`, `electron/preload.js`) with native hardware thermal printing and offline caching.
* **Validation & Security**: `zod` (v4.4.3), `clsx`, `tailwind-merge`, and custom cryptographic token verification.

---

## 6. Complete Screen-by-Screen Functional Specifications (All 78 Pages across 5 Portals)

### 6.1 Authentication & Public Pages (4 Screens)

#### SCREEN 1: Unified Login Screen (`src/app/page.tsx`)
* **URL**: `/`
* **Purpose**: Single secure entry point for all users. Authenticates credentials against Firebase Auth, resolves profile custom claims, and routes dynamically to the appropriate portal.
* **Controls**: Phone Number input (+91 prefix), Password input with visibility toggle, "Sign In" button with loading spinner, Forgot Password link.
* **Validations**: Phone must be exactly 10 digits; password must not be empty; brute-force rate limit protection.
* **Routing**:
  - `Admin` / `Owner` / `Manager` / `Accountant` $\to$ `/admin/dashboard`
  - `Employee` / `Appraiser` / `Cashier` $\to$ `/employee/dashboard`
  - `Customer` $\to$ `/customer/dashboard`
  - `Investor` $\to$ `/investor/dashboard`

#### SCREEN 2: Forgot Password Screen (`src/app/auth/forgot-password/page.tsx`)
* **URL**: `/auth/forgot-password`
* **Purpose**: Initiates self-service password recovery.
* **Controls**: Mobile / Email entry field, "Send Verification Code" CTA, back to login link.

#### SCREEN 3: OTP Verification Screen (`src/app/auth/otp/page.tsx`)
* **URL**: `/auth/otp`
* **Purpose**: Verifies 6-digit one-time password dispatched via SMS/WhatsApp.
* **Controls**: 6 segmented digit inputs with auto-focus advance, countdown timer, resend button.

#### SCREEN 4: Reset Password Screen (`src/app/auth/reset-password/page.tsx`)
* **URL**: `/auth/reset-password`
* **Purpose**: Secure credential update upon verified OTP challenge.
* **Controls**: New password input, confirm password input, password strength meter, submit button.

---

### 6.2 Admin Backoffice Suite (49 Screens across 18 Modules)

#### SCREEN 5: Admin Dashboard (`src/app/admin/dashboard/page.tsx`)
* **URL**: `/admin/dashboard`
* **Purpose**: Real-time executive financial cockpit providing instant operational intelligence.
* **Metrics Grid**: Total Customers, Active Loans, Settled Loans, Due Today, Due This Week, Overdue Defaults, Total Disbursed Principal, Outstanding Due, Interest Collected (Today & Month), Total Gold Net Weight (grams), Total Vault Valuation.
* **Interactive Elements**: Realtime transactions feed, approaching maturity alerts table, quick-action drawer ("Onboard Customer", "Create Loan", "Record Payment").

#### SCREEN 6: Customer Directory (`src/app/admin/customers/page.tsx`)
* **URL**: `/admin/customers`
* **Purpose**: Centralized searchable and filterable client ledger.
* **Controls**: Live search (Name, Phone, Customer ID, Aadhaar), status filters (Active, Blocked, KYC Pending), export buttons.

#### SCREEN 7: Onboard New Customer (`src/app/admin/customers/new/page.tsx`)
* **URL**: `/admin/customers/new`
* **Purpose**: Comprehensive KYC onboarding with hardware biometric and document capture.
* **Features**: Live webcam photo capture, HTML5 canvas signature pad, Aadhaar/PAN/Voter ID image uploads with client-side compression, Nominee assignment, reference contacts.

#### SCREEN 8: Customer 360 & Ledger Detail (`src/app/admin/customers/[id]/page.tsx`)
* **URL**: `/admin/customers/[id]`
* **Purpose**: Comprehensive 360-degree customer profile, lifetime loan history, active collateral assets, payment ledger, and identity verification status.

#### SCREEN 9: Edit Customer Profile (`src/app/admin/customers/[id]/edit/page.tsx`)
* **URL**: `/admin/customers/[id]/edit`
* **Purpose**: Administrative updating of customer demographic details, alternate contact numbers, addresses, nominee changes, and document re-uploads.

#### SCREEN 10: Loan Directory (`src/app/admin/loans/page.tsx`)
* **URL**: `/admin/loans`
* **Purpose**: Master loan portfolio registry with multi-parameter filtering.
* **Filters**: Status (Active, Due, Overdue, Defaulted, Settled), Date range, Branch, APR rate, Purity, Principal bracket.

#### SCREEN 11: New Loan Appraisal & Creation (`src/app/admin/loans/new/page.tsx`)
* **URL**: `/admin/loans/new`
* **Purpose**: 4-step wizard for gold appraisal, loan structuring, and instant disbursement.
* **Step 1 (Customer Selection)**: Instant live search or quick-onboard redirection.
* **Step 2 (Gold Appraisal)**: Multi-item entry (gross weight, stone weight, net weight, purity 18K/21K/22K/24K, market rate), 3-angle photo capture, vault bin allocation.
* **Step 3 (Terms & APR Selection)**: Controlled APR dropdown (`18%`, `20%`, `22%`, `24%`, `30%`), Max LTV enforcement (75% cap), duration selector, auto high-LTV approval trigger.
* **Step 4 (Disbursement & Printing)**: Cash/Bank transfer mode, atomic pawn ticket generation, sequential Tamil slogan assignment.

#### SCREEN 12: Loan Detail & Management (`src/app/admin/loans/[id]/page.tsx`)
* **URL**: `/admin/loans/[id]`
* **Purpose**: In-depth loan audit, live daily interest accrual counter, payment history, collateral inspection, loan renewal trigger, and authorized APR adjustment modal with audit reasoning.

#### SCREEN 13: Barcode & QR Loan Scanner (`src/app/admin/loans/scan/page.tsx`)
* **URL**: `/admin/loans/scan`
* **Purpose**: Camera-based and USB hardware barcode/QR scanner for instant Pawn Ticket and receipt scanning, auto-populating active balances for fast counter service.

#### SCREEN 14: Payment Management Desk (`src/app/admin/payments/page.tsx`)
* **URL**: `/admin/payments`
* **Purpose**: Centralized payment processing, transaction lookup, and repayment ledger.
* **Features**: Payment mode selection (Cash, UPI, NEFT, Cheque), waterfall breakdown (Penalty $\to$ Interest $\to$ Principal), settlement waiver requests, and PDF receipt download.

#### SCREEN 15: Fast Counter Billing POS (`src/app/admin/billing/page.tsx`)
* **URL**: `/admin/billing`
* **Purpose**: High-speed front-desk counter billing interface optimized for rapid customer throughput.
* **Features**: Single-screen customer lookup, quick payment entry, keyboard navigation, dual-receipt printing (Customer + Office copies) with rotating Tamil slogans.

#### SCREEN 16: Loan Renewal & Restructuring (`src/app/admin/renewal/page.tsx`)
* **URL**: `/admin/renewal`
* **Purpose**: Seamless closure of maturing loans and re-pledge origination without physical collateral movement.
* **Features**: Interest settlement verification, re-appraisal against current gold rates, principal top-up or reduction, and new loan agreement generation.

#### SCREEN 17: Collateral Release & Discharge (`src/app/admin/release/page.tsx`)
* **URL**: `/admin/release`
* **Purpose**: Secure physical gold handover upon 100% zero-balance settlement.
* **Features**: Vault bin unlock verification, biometric/OTP borrower identity check, witness signature capture, and digital Collateral Release Deed generation.

#### SCREEN 18: Commercial Bank Re-Pledge Ledger (`src/app/admin/re-pledge/page.tsx`)
* **URL**: `/admin/re-pledge`
* **Purpose**: Institutional liquidity management registry tracking all gold pledged with commercial banks.
* **Metrics**: Total Re-Pledged Weight, Bank Disbursed Funds, Bank Outstanding Due, Average Bank APR, Net Interest Margin (Spread).

#### SCREEN 19: Create Bank Re-Pledge (`src/app/admin/re-pledge/new/page.tsx`)
* **URL**: `/admin/re-pledge/new`
* **Purpose**: Selects idle vaulted collateral lots, assigns to partner commercial banks (SBI, HDFC, Canara, Indian Bank), records bank loan number, sanctioned amount, and bank APR.

#### SCREEN 20: Bank Re-Pledge Detail & Redemption (`src/app/admin/re-pledge/[id]/page.tsx`)
* **URL**: `/admin/re-pledge/[id]`
* **Purpose**: Tracks re-pledged loan servicing, interest payments to partner banks, redemption processing, and physical return to branch vault custody.

#### SCREEN 21: Operational Expenses Hub (`src/app/admin/expenses/page.tsx`)
* **URL**: `/admin/expenses`
* **Purpose**: Master registry of all enterprise operational expenses across branches.
* **Features**: Category filters, date ranges, payment mode tracking, and expense voucher downloads.

#### SCREEN 22: Add Operational Expense (`src/app/admin/expenses/new/page.tsx`)
* **URL**: `/admin/expenses/new`
* **Purpose**: Recording operational overheads (Rent, Staff Salaries, Electricity, Office Supplies, Tea/Refreshment, Legal & Audit, Bank Re-Pledge Charges) with receipt attachment.

#### SCREEN 23: Expense History & Vouchers (`src/app/admin/expenses/history/page.tsx`)
* **URL**: `/admin/expenses/history`
* **Purpose**: Historical audit log of all posted operational vouchers with branch-level tagging.

#### SCREEN 24: Expense Category Management (`src/app/admin/expenses/categories/page.tsx`)
* **URL**: `/admin/expenses/categories`
* **Purpose**: Custom configuration of general ledger expense categories and budget limits.

#### SCREEN 25: Profit & Loss (P&L) Master (`src/app/admin/pnl/page.tsx`)
* **URL**: `/admin/pnl`
* **Purpose**: Real-time institutional financial statement consolidating operating revenues vs operating costs.
* **Formula**: $\text{Net Profit} = (\text{Loan Interest} + \text{Late Penalties} + \text{Processing Fees}) - (\text{Operating Expenses} + \text{Bank Re-Pledge Interest} + \text{Investor Yields})$.

#### SCREEN 26: P&L Real-time Analytics Dashboard (`src/app/admin/pnl/dashboard/page.tsx`)
* **URL**: `/admin/pnl/dashboard`
* **Purpose**: Graphical financial cockpit featuring revenue trends, expense breakdowns, net margin trajectories, and branch comparisons.

#### SCREEN 27: Daily P&L Ledger (`src/app/admin/pnl/daily/page.tsx`)
* **URL**: `/admin/pnl/daily`
* **Purpose**: Day-by-day cash and accrual financial performance statement.

#### SCREEN 28: Monthly P&L Ledger (`src/app/admin/pnl/monthly/page.tsx`)
* **URL**: `/admin/pnl/monthly`
* **Purpose**: Month-by-month financial statement for executive reviews and tax auditing.

#### SCREEN 29: Yearly Financial P&L (`src/app/admin/pnl/yearly/page.tsx`)
* **URL**: `/admin/pnl/yearly`
* **Purpose**: Annual statutory financial statement for chartered accountant audits and tax returns.

#### SCREEN 30: Consolidated Financial & Collateral Position (`src/app/admin/consolidated/page.tsx`)
* **URL**: `/admin/consolidated`
* **Purpose**: Comprehensive balance sheet and asset/liability overview.
* **Metrics**: Total In-Vault Gold Weight (g), Total Bank Re-Pledged Gold Weight (g), Total Customer Principal Outstanding, Total Bank Re-Pledge Debt, Net Equity, Liquidity Coverage, and Live Gold Price Stress Testing.

#### SCREEN 31: KYC Consultation & Lifetime Profile (`src/app/admin/kyc-consultation/page.tsx`)
* **URL**: `/admin/kyc-consultation`
* **Purpose**: Instant 360-degree risk assessment tool. Enter any customer phone or Aadhaar to view lifetime loan history, total interest paid, default risk score, active re-pledged ornaments, and collateral clearance status.

#### SCREEN 32: Gold Loan KYC Consultation (`src/app/admin/gold-loan/kyc-consultation/page.tsx`)
* **URL**: `/admin/gold-loan/kyc-consultation`
* **Purpose**: Specialized counter appraisal consultation view for pre-loan evaluation and credit risk checking.

#### SCREEN 33: Investment Management Hub (`src/app/admin/investments/page.tsx`)
* **URL**: `/admin/investments`
* **Purpose**: Centralized command center for managing private investor capital, active lots, yield liability, and payout queues.

#### SCREEN 34: Investor Directory (`src/app/admin/investments/investors/page.tsx`)
* **URL**: `/admin/investments/investors`
* **Purpose**: Comprehensive directory of registered institutional and retail capital providers.

#### SCREEN 35: Onboard New Investor (`src/app/admin/investments/investors/new/page.tsx`)
* **URL**: `/admin/investments/investors/new`
* **Purpose**: Complete investor registration, KYC verification, bank account details for payouts, and initial investment allocation.

#### SCREEN 36: Investor Portfolio & Ledger Detail (`src/app/admin/investments/investors/[id]/page.tsx`)
* **URL**: `/admin/investments/investors/[id]`
* **Purpose**: Individual investor command center displaying active capital lots, accrued yields, historical payouts, and withdrawal requests.

#### SCREEN 37: Investment Payout Approvals (`src/app/admin/investments/payments/page.tsx`)
* **URL**: `/admin/investments/payments`
* **Purpose**: Monthly yield distribution queue. Authorizes bank payouts, generates payment reference numbers, and logs TDS deductions.

#### SCREEN 38: Investment Transactions Master Ledger (`src/app/admin/investments/transactions/page.tsx`)
* **URL**: `/admin/investments/transactions`
* **Purpose**: Immutable financial ledger of all capital deposits, yield disbursements, and principal withdrawals.

#### SCREEN 39: Investor Withdrawal Approvals (`src/app/admin/investments/withdrawals/page.tsx`)
* **URL**: `/admin/investments/withdrawals`
* **Purpose**: Dual-authorization workflow for capital withdrawals, lock-in period verification, and settlement approvals.

#### SCREEN 40: Investment Performance & Yield Reports (`src/app/admin/investments/reports/page.tsx`)
* **URL**: `/admin/investments/reports`
* **Purpose**: Yield curve analysis, cost of investor capital vs lending APR spread, and liquidity forecasting.

#### SCREEN 41: Investment Schemes & Settings (`src/app/admin/investments/settings/page.tsx`)
* **URL**: `/admin/investments/settings`
* **Purpose**: Configures investment plans (Monthly Payout, Annual Compounding, Fixed Term), base interest rates, lock-in periods, and minimum deposit limits.

#### SCREEN 42: Investment Audit Trail (`src/app/admin/investments/audit/page.tsx`)
* **URL**: `/admin/investments/audit`
* **Purpose**: Immutable security audit trail recording all changes to investor balances, rates, and approval actions.

#### SCREEN 43: Collateral Auctions & Liquidation (`src/app/admin/auctions/page.tsx`)
* **URL**: `/admin/auctions`
* **Purpose**: Regulatory liquidation management for loans past statutory grace periods.
* **Features**: Notice tracking (14-day legal notice), catalog lot generation, reserve price calculation, and auction surplus disbursement.

#### SCREEN 44: Multi-Level Approvals Desk (`src/app/admin/approvals/page.tsx`)
* **URL**: `/admin/approvals`
* **Purpose**: Centralized queue for pending approvals: High-LTV loans (>75%), interest waivers, employee loan submissions, and investor withdrawals.

#### SCREEN 45: Branch Master Management (`src/app/admin/branches/page.tsx`)
* **URL**: `/admin/branches`
* **Purpose**: Configuration of enterprise branches, branch codes, physical addresses, operational telephone numbers, and staff assignments.

#### SCREEN 46: Employee & Appraiser Roster (`src/app/admin/employees/page.tsx`)
* **URL**: `/admin/employees`
* **Purpose**: Staff management, role assignment, branch locking, active status toggling, and biometric login provisioning.

#### SCREEN 47: Double-Entry General Ledger & Accounting (`src/app/admin/accounting/page.tsx`)
* **URL**: `/admin/accounting`
* **Purpose**: Enterprise accounting ledger: Cash Book, Bank Book, Journal Entries, Trial Balance, and Balance Sheet.

#### SCREEN 48: Executive Reports & 50-Sheet Excel Hub (`src/app/admin/reports/page.tsx`)
* **URL**: `/admin/reports`
* **Purpose**: Comprehensive reporting center. Generates operational summaries and compiles the authoritative **50-sheet enterprise financial workbook**.

#### SCREEN 49: Account Statements Generator (`src/app/admin/statement/page.tsx`)
* **URL**: `/admin/statement`
* **Purpose**: On-demand generation and printing of official customer loan ledgers, tax certificates, and outstanding statements.

#### SCREEN 50: Document Vault & PDF Hub (`src/app/admin/documents/page.tsx`)
* **URL**: `/admin/documents`
* **Purpose**: Digital repository of all issued Pawn Tickets, Payment Receipts, Release Deeds, and KYC dossiers.

#### SCREEN 51: Multi-Channel Reminder Manager (`src/app/admin/notifications/page.tsx`)
* **URL**: `/admin/notifications`
* **Purpose**: Real-time tracking of automated WhatsApp, SMS, and Push notifications dispatched to borrowers.

#### SCREEN 52: Customer Support Desk (`src/app/admin/support/page.tsx`)
* **URL**: `/admin/support`
* **Purpose**: Internal ticketing system for managing borrower queries, grievance escalations, and resolution logging.

#### SCREEN 53: System Settings & Business Configurations (`src/app/admin/settings/page.tsx`)
* **URL**: `/admin/settings`
* **Purpose**: Enterprise parameters: Company details, Pawnbroker license numbers, live 24K/22K/18K gold rates per gram, default APR tiers, max LTV caps, and grace period settings.

---

### 6.3 Employee Portal (7 Screens)

#### SCREEN 54: Staff Shift & Operations Dashboard (`src/app/employee/dashboard/page.tsx`)
* **URL**: `/employee/dashboard`
* **Purpose**: Daily duty cockpit for counter staff, tellers, and branch appraisers. Displays branch gold rates, today's collection tally, pending loan drafts, and quick-action shortcuts.

#### SCREEN 55: Branch Customer Directory (`src/app/employee/customers/page.tsx`)
* **URL**: `/employee/customers`
* **Purpose**: Fast search and lookup of branch customers by name, mobile, or national ID.

#### SCREEN 56: Branch Loan Queue & Draft Appraisal (`src/app/employee/loans/page.tsx`)
* **URL**: `/employee/loans`
* **Purpose**: Operational workflow for entering new gold loan appraisals and submitting applications for manager/admin approval.

#### SCREEN 57: Counter Cash Collection Desk (`src/app/employee/payments/page.tsx`)
* **URL**: `/employee/payments`
* **Purpose**: Front-desk cash and UPI payment collection, sequential slogan assignment, and receipt printing.

#### SCREEN 58: Branch Re-Pledge Collateral Inspector (`src/app/employee/re-pledge/page.tsx`)
* **URL**: `/employee/re-pledge`
* **Purpose**: View-only tracking of collateral currently pledged with commercial banks, preventing unauthorized release attempts.

#### SCREEN 59: Customer Account Inquiries (`src/app/employee/statement/page.tsx`)
* **URL**: `/employee/statement`
* **Purpose**: Customer service desk for checking active loan balances, interest breakdowns, and printing statement summaries.

#### SCREEN 60: Staff Approvals & Requests Status (`src/app/employee/approvals/page.tsx`)
* **URL**: `/employee/approvals`
* **Purpose**: Real-time status tracking for loan drafts and waiver requests submitted by the employee to branch managers.

---

### 6.4 Customer Mobile Portal (8 Screens)

#### SCREEN 61: Borrower Overview Dashboard (`src/app/customer/dashboard/page.tsx`)
* **URL**: `/customer/dashboard`
* **Purpose**: Mobile-first borrower portal displaying total active gold weight pledged, live accrued interest, total outstanding, and quick payment links.

#### SCREEN 62: Active & Settled Loans List (`src/app/customer/loans/page.tsx`)
* **URL**: `/customer/loans`
* **Purpose**: Complete card-based list of all active, past, and settled loans with visual status badges.

#### SCREEN 63: Loan Detail & Live Accrued Interest (`src/app/customer/loans/[id]/page.tsx`)
* **URL**: `/customer/loans/[id]`
* **Purpose**: Minute-by-minute live simple interest calculation counter, payment history ledger, and instant Pawn Ticket download.

#### SCREEN 64: Digital Ornaments Vault & Photos (`src/app/customer/collateral/page.tsx`)
* **URL**: `/customer/collateral`
* **Purpose**: High-definition digital vault displaying 3-angle photographs of each pledged ornament, gross/net weight certificates, and purity ratings.

#### SCREEN 65: Repayment History & PDF Receipts (`src/app/customer/payments/page.tsx`)
* **URL**: `/customer/payments`
* **Purpose**: Chronological repayment ledger with downloadable digital payment receipts featuring Tamil slogans.

#### SCREEN 66: Customer Account Statements (`src/app/customer/statement/page.tsx`)
* **URL**: `/customer/statement`
* **Purpose**: Financial statement viewer with date-range filters and PDF export for personal accounting and tax filing.

#### SCREEN 67: Loan & Payment Notifications (`src/app/customer/notifications/page.tsx`)
* **URL**: `/customer/notifications`
* **Purpose**: In-app inbox receiving payment confirmations, due reminders, and gold rate updates.

#### SCREEN 68: KYC Profile & Nominee Information (`src/app/customer/profile/page.tsx`)
* **URL**: `/customer/profile`
* **Purpose**: Profile view showing verified Aadhaar/PAN status, registered nominee, primary branch, and security settings.

---

### 6.5 Investor Portal (10 Screens)

#### SCREEN 69: Investor Portal Gateway (`src/app/investor/page.tsx`)
* **URL**: `/investor`
* **Purpose**: Entry gateway and authentication router for capital providers.

#### SCREEN 70: Investor Executive Cockpit (`src/app/investor/dashboard/page.tsx`)
* **URL**: `/investor/dashboard`
* **Purpose**: High-net-worth executive dashboard. Displays total capital invested, cumulative returns accrued, monthly yield rate, next payout date, and active lot count.

#### SCREEN 71: Active Capital Lots & Yield Tracking (`src/app/investor/portfolio/page.tsx`)
* **URL**: `/investor/portfolio`
* **Purpose**: Granular breakdown of individual investment lots, deposit dates, applicable interest rates, compounding policies, and lot-specific accrued yields.

#### SCREEN 72: New Capital Placement (`src/app/investor/invest/page.tsx`)
* **URL**: `/investor/invest`
* **Purpose**: Top-up investment workflow. Select scheme, view projected compounding returns calculator, access company bank/UPI details, and submit transaction UTR proofs.

#### SCREEN 73: Capital & Yield Withdrawal Requests (`src/app/investor/withdraw/page.tsx`)
* **URL**: `/investor/withdraw`
* **Purpose**: Submit requests for interest payout or principal capital withdrawal with instant lock-in period validation.

#### SCREEN 74: Investment Transactions & Ledger (`src/app/investor/transactions/page.tsx`)
* **URL**: `/investor/transactions`
* **Purpose**: Chronological statement of all capital deposits, monthly interest payouts, and withdrawal disbursements with transaction UTR numbers.

#### SCREEN 75: Tax, TDS & Yield Statements (`src/app/investor/statement/page.tsx`)
* **URL**: `/investor/statement`
* **Purpose**: Annual and quarterly yield statement generation with TDS deduction breakdown for income tax filing.

#### SCREEN 76: Payout & Transaction Alerts (`src/app/investor/notifications/page.tsx`)
* **URL**: `/investor/notifications`
* **Purpose**: Real-time alerts on deposit approvals, monthly yield distributions, and withdrawal status updates.

#### SCREEN 77: Investor Concierge & Support Desk (`src/app/investor/support/page.tsx`)
* **URL**: `/investor/support`
* **Purpose**: Priority direct communication desk linking the investor with PGF executive management and wealth officers.

#### SCREEN 78: Investor Profile & Bank Mandate (`src/app/investor/profile/page.tsx`)
* **URL**: `/investor/profile`
* **Purpose**: Verified banking mandate details (Account Number, IFSC, Bank Name), registered nominee, and contact information.

---

## 7. Complete API Route Specifications

### 7.1 Customer Onboarding & KYC API (`/api/admin/onboard`)
* **Method**: `POST`
* **Authentication**: Firebase Admin ID token with `Admin`, `Manager`, or `Employee` claims.
* **Payload**:
  ```json
  {
    "name": "Ramanathan K",
    "phone_primary": "9876543210",
    "phone_alt": "9876543211",
    "national_id": "1234 5678 9012",
    "pan_number": "ABCDE1234F",
    "address": "12, South Car St, Tirunelveli",
    "branch_id": "branch_main",
    "photo_base64": "data:image/jpeg;base64,...",
    "signature_base64": "data:image/png;base64,...",
    "nominee_name": "Kavitha R",
    "nominee_relation": "Spouse"
  }
  ```
* **Process**: Validates uniqueness of national ID and phone, creates Firebase Auth user record, uploads assets to Cloud Storage under `/customers/{uid}/`, writes profile to Firestore `profiles` collection, and returns the generated customer ID.

### 7.2 Investor Account Creation API (`/api/admin/investor/create`)
* **Method**: `POST`
* **Authentication**: Firebase Admin ID token with `Admin` or `Owner` claims.
* **Payload**:
  ```json
  {
    "name": "Lakshmi Narayanan",
    "phone": "9842100000",
    "email": "investor@example.com",
    "address": "45 Anna Nagar, Madurai",
    "pan_number": "BKPNL1234M",
    "bank_name": "State Bank of India",
    "bank_account_number": "30129847123",
    "bank_ifsc": "SBIN0001234",
    "initial_deposit": 500000,
    "scheme_id": "plan_monthly_12",
    "payment_mode": "Bank_Transfer",
    "transaction_reference": "UTR89127491"
  }
  ```
* **Process**: Generates Firebase Auth user, sets `customUserClaims: { role: 'Investor' }`, creates Firestore `profiles` record, generates atomic `investor_number` (`PGF-INV-000123`), initializes `investment_accounts`, creates the initial `investment_lots` entry, and writes to `investment_transactions`.

### 7.3 Multi-Document PDF Compilation API (`/api/pdf`)
* **Method**: `GET`
* **Authentication**: Validated Firebase ID token. Enforces anti-IDOR authorization (customers can only access documents referencing their UID; staff can access branch documents; admins have global access).
* **Query Parameters**:
  - `type`: `pawn-ticket` | `receipt` | `release` | `statement` | `kyc-consultation` | `investor-payout`
  - `id`: Target Loan ID / Payment ID / Customer ID / Investor ID.
* **Response**: `Content-Type: application/pdf` binary stream rendered on-the-fly via server-side PDFKit with vector layout, barcode/QR code, and embedded Nirmala TrueType Unicode Tamil font.

---

## 8. Complete Cloud Firestore Database Schemas (All 32 Collections)

| # | Collection Name | Purpose & Scope | Primary Key / Document ID |
| :--- | :--- | :--- | :--- |
| 1 | `profiles` | User identity records (Customers, Staff, Investors) | Firebase Auth `uid` |
| 2 | `branches` | Branch offices, physical addresses, contact info | Auto-generated or branch code (`branch_01`) |
| 3 | `loans` | Master loan contracts, principal, terms, APR, status | Sequential `PGF-LN-XXXXXX` |
| 4 | `gold_collateral` | Itemized gold ornaments, weight, purity, valuation | Auto-generated ID (`gold_XXXXXX`) |
| 5 | `gold_photos` | High-resolution 3-angle collateral photo URLs | Auto-generated ID |
| 6 | `payments` | Repayment transactions, waterfall allocations, receipts | Sequential `PGF-RCP-XXXXXX` |
| 7 | `expenses` | Branch operational expense records & vouchers | Sequential `PGF-EXP-XXXXXX` |
| 8 | `expense_categories`| General ledger operational expense category definitions | Slug (`rent`, `salaries`, `utilities`) |
| 9 | `loan_renewals` | Restructured loan records linking old to new loan | Sequential `PGF-RNW-XXXXXX` |
| 10 | `approval_requests` | Multi-level approval requests (High LTV, Waivers) | Auto-generated ID |
| 11 | `bankRePledges` | Commercial bank re-pledge contracts & spread tracking| Sequential `PGF-BNK-XXXXXX` |
| 12 | `billSlogans` | 300 unique Tamil cultural & thrift slogans | `slogan_1` to `slogan_300` |
| 13 | `interest_accruals` | Daily simple interest audit records per loan | Compound `accrual_{loanId}_{date}` |
| 14 | `notifications` | System, borrower, and in-app alerts history | Auto-generated ID |
| 15 | `whatsapp_reminders`| WhatsApp message dispatch records and delivery states | Auto-generated ID |
| 16 | `settings` | System-wide parameters (Gold rates, Max LTV, Company) | Key name (`company`, `gold_rates`, etc.) |
| 17 | `audit_logs` | Immutable audit trail for core operations | Auto-generated ID |
| 18 | `counters` | ACID sequential counter registers | Counter identifier (`loan_counter`, etc.) |
| 19 | `accounting_journals`| Double-entry general ledger journal entries | Sequential `PGF-JRN-XXXXXX` |
| 20 | `documents` | Metadata for issued statutory PDFs | Auto-generated ID |
| 21 | `auction_bids` | Collateral liquidation auction lots and bidder records | Auto-generated ID |
| 22 | `support_tickets` | Customer service queries and resolution records | Auto-generated ID |
| 23 | `investors` | Investor-specific metadata and verification profiles | Matches Profile `uid` |
| 24 | `investment_plans` | Configured investment schemes (Monthly, Compounding) | Plan code (`monthly_12`, `compound_24`) |
| 25 | `investment_accounts`| Master investor account balances and yield metrics | Matches Investor `uid` |
| 26 | `investment_lots` | Granular capital deposit lots per investor | Sequential `PGF-LOT-XXXXXX` |
| 27 | `investment_transactions`| Financial deposits, payouts, and withdrawals ledger | Sequential `PGF-INV-TXN-XXXXXX` |
| 28 | `withdrawal_requests`| Investor capital & yield withdrawal requests | Sequential `PGF-WDR-XXXXXX` |
| 29 | `investment_payment_requests`| Monthly interest payout execution queues | Sequential `PGF-REQ-XXXXXX` |
| 30 | `investment_settings`| Global parameters for investment schemes and limits | Document `global_config` |
| 31 | `investment_notifications`| Alerts dispatched specifically to investors | Auto-generated ID |
| 32 | `investment_audit_logs`| Immutable security audit trail for investor operations | Auto-generated ID |

---

## 9. Security Architecture & Granular Access Control

### 9.1 Zero-Trust RBAC & Anti-IDOR Enforcement
1. **Authentication Token Verification**: Every API and server action validates the caller's Firebase ID token.
2. **Anti-IDOR Protection**: When fetching loans, payments, collateral, or documents:
   - If the user has role `Customer`, the query strictly mandates `customer_id == auth.uid`.
   - If the user has role `Investor`, queries mandate `investor_id == auth.uid`.
   - If the user has role `Employee`, queries mandate `branch_id == userProfile.branch_id`.
   - If the user has role `Admin` or `Owner`, global access is granted with audit logging.
3. **Clock-Skew Resilience**: Server-side token verification incorporates developmental clock-skew handling to prevent transient network synchronization rejections.

### 9.2 Firestore Security Rules Architecture
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAuthenticated() { return request.auth != null; }
    function getUserRole() { 
      return request.auth.token.role != null 
        ? request.auth.token.role 
        : (exists(/databases/$(database)/documents/profiles/$(request.auth.uid))
            ? get(/databases/$(database)/documents/profiles/$(request.auth.uid)).data.role
            : 'Customer');
    }
    function isAdmin() { 
      return isAuthenticated() && (
        getUserRole() in ['Admin', 'admin', 'ADMIN', 'Owner', 'owner', 'OWNER'] ||
        request.auth.token.email in ['pavithragoldfinance@gmail.com', 'admin@pavithragoldfinance.com']
      ); 
    }
    function isStaff() { 
      return isAuthenticated() && (
        isAdmin() || 
        getUserRole() in ['Manager', 'Employee', 'Cashier', 'Appraiser', 'Accountant', 'Collection_Officer', 'Customer_Support']
      ); 
    }
    function isOwner(uid) { return isAuthenticated() && request.auth.uid == uid; }

    // 32 Collections governed by explicit read/write rules
    match /profiles/{profileId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      // Hardened: prevents non-admin self-elevation of role and status
      allow update: if isAdmin() || (
        isAuthenticated() && request.auth.uid == profileId &&
        !request.resource.data.diff(resource.data).affectedKeys().hasAny(['role', 'status'])
      );
      allow delete: if isAdmin();
    }
    match /loans/{loanId} {
      allow read: if isStaff() || (isAuthenticated() && resource.data.customer_id == request.auth.uid);
      allow create, update: if isStaff();
      allow delete: if isAdmin();
    }
    match /payments/{paymentId} {
      allow read: if isStaff() || (isAuthenticated() && resource.data.customer_id == request.auth.uid);
      allow create: if isStaff();
      allow update, delete: if isAdmin();
    }
    match /counters/{counterId} {
      allow read: if isAuthenticated();
      // Hardened: counters writable strictly by staff to prevent sequence tampering
      allow write: if isStaff();
    }
    match /support_tickets/{ticketId} {
      allow read: if isStaff() || (isAuthenticated() && (resource == null || resource.data.customer_id == request.auth.uid || resource.data.customerId == request.auth.uid || resource.data.user_id == request.auth.uid));
      allow create: if isAuthenticated();
      allow update: if isStaff() || (isAuthenticated() && (resource != null && (resource.data.customer_id == request.auth.uid || resource.data.customerId == request.auth.uid || resource.data.user_id == request.auth.uid)));
      allow delete: if isAdmin();
    }
    match /investment_accounts/{accountId} {
      allow read: if isStaff() || (isAuthenticated() && (resource.data.investor_id == request.auth.uid || resource.data.investorId == request.auth.uid));
      allow create: if isStaff() || (isAuthenticated() && (accountId == request.auth.uid || request.resource.data.investor_id == request.auth.uid || request.resource.data.investorId == request.auth.uid));
      allow update: if isStaff() || (isAuthenticated() && (accountId == request.auth.uid || (resource != null && (resource.data.investor_id == request.auth.uid || resource.data.investorId == request.auth.uid))));
      allow delete: if isAdmin();
    }
    match /investment_notifications/{notifId} {
      allow read: if isStaff() || (isAuthenticated() && (resource == null || resource.data.investor_id == request.auth.uid || resource.data.investorId == request.auth.uid));
      allow create, update: if isStaff();
      allow delete: if isAdmin();
    }
    // Strict lock-down on audit logs (immutable: no updates or deletions permitted)
    match /audit_logs/{id} { allow read: if isStaff(); allow create: if isAuthenticated(); allow update, delete: if false; }
    match /investment_audit_logs/{id} { allow read: if isStaff(); allow create: if isAuthenticated(); allow update, delete: if false; }
  }
}
```

---

## 10. Financial & Mathematical Core Formulas

### 10.1 Approved Annual Interest Rates (APR %)
The system mandates controlled, legally compliant annual percentage rates selected via dropdown:
$$\text{Approved APR Tiers} \in \{18.00\%, 20.00\%, 22.00\%, 24.00\%, 30.00\%\}$$
* Default standard lending rate: $18.00\%$ per annum ($1.50\%$ simple monthly equivalent).
* Any modification to an active loan's APR requires administrative credentials, mandatory authorized reasoning, and creates an immutable entry in `audit_logs`.

### 10.2 Daily Simple Accrual with Leap-Year Awareness
Daily simple interest accrues based on exact calendar days elapsed:
$$\text{Daily Accrual} = \frac{\text{Principal Balance} \times \left(\frac{\text{APR}}{100}\right)}{\text{Days in Current Year}}$$
Where:
$$\text{Days in Year} = \begin{cases} 366 & \text{if Year is Leap Year} \\ 365 & \text{otherwise} \end{cases}$$
$$\text{Leap Year Check} = (\text{Year} \bmod 4 = 0 \land \text{Year} \bmod 100 \ne 0) \lor (\text{Year} \bmod 400 = 0)$$

### 10.3 Atomic Payment Allocation Waterfall
When a payment amount $P_{\text{received}}$ is tendered:
1. **Step 1: Overdue Penalty**:
   $$A_{\text{penalty}} = \min(P_{\text{received}}, \text{Outstanding Penalty})$$
   $$P_{\text{remaining}, 1} = P_{\text{received}} - A_{\text{penalty}}$$
2. **Step 2: Accrued Simple Interest**:
   $$A_{\text{interest}} = \min(P_{\text{remaining}, 1}, \text{Outstanding Accrued Interest})$$
   $$P_{\text{remaining}, 2} = P_{\text{remaining}, 1} - A_{\text{interest}}$$
3. **Step 3: Principal Reduction**:
   $$A_{\text{principal}} = \min(P_{\text{remaining}, 2}, \text{Outstanding Principal})$$
   $$P_{\text{advance}} = P_{\text{remaining}, 2} - A_{\text{principal}}$$
4. **Paise Precision Guarantee**: All internal arithmetic operates on integer paise ($\text{amount} \times 100$) to prevent JavaScript floating-point errors.

### 10.4 Investor Yield & Compounding Calculation
For an active investment lot with principal $P$ and annual return rate $r$:
* **Tenure $< 365$ Days (Pro-rata Simple Return)**:
  $$\text{Yield} = P \times \left(\frac{r}{100}\right) \times \left(\frac{\text{Elapsed Days}}{365}\right)$$
* **Tenure $\ge 365$ Days (Annual Compounding)**:
  $$\text{Compounded Base} = P \times \left(1 + \frac{r}{100}\right)^{\lfloor\text{Elapsed Days} / 365\rfloor}$$
  $$\text{Current Value} = \text{Compounded Base} \times \left(1 + \frac{r}{100} \times \frac{\text{Elapsed Days} \pmod{365}}{365}\right)$$
  $$\text{Accrued Yield} = \text{Current Value} - P$$

### 10.5 Bank Re-Pledge Interest Spread & Profit Margin
$$\text{Net Spread} = \text{Customer Loan APR} - \text{Bank Re-Pledge Borrowing APR}$$
$$\text{Gross Spread Income} = \text{Re-Pledged Gold Net Wt (g)} \times \text{Bank Advance Rate} \times \left(\frac{\text{Net Spread}}{100}\right)$$

### 10.6 Enterprise Net Profit & Loss (P&L) Formula
$$\text{Net Profit} = (\text{Gross Operating Income}) - (\text{Total Operating Expenses})$$
Where:
$$\text{Gross Income} = \text{Loan Interest Collected} + \text{Late Fee Penalties} + \text{Loan Processing Charges}$$
$$\text{Operating Expenses} = \text{Branch Overheads} + \text{Bank Re-Pledge Interest Paid} + \text{Investor Yields Distributed}$$

---

## 11. Multi-Item Gold Appraisal & Vault Custody Management
* **Itemized Appraisal Fields**:
  - Item Type (Bangles, Chain, Ring, Necklace, Coin, Earring, Waist Chain / Oddiyanam).
  - Item Description & Item Count.
  - Gross Weight ($W_{\text{gross}}$ in grams to two decimal places).
  - Stone / Waste Weight ($W_{\text{stone}}$ in grams).
  - Net Gold Weight: $W_{\text{net}} = W_{\text{gross}} - W_{\text{stone}}$.
  - Karat Purity: $18\text{K} (75.0\%), 21\text{K} (87.5\%), 22\text{K} (91.6\%), 24\text{K} (99.9\%)$.
  - Market Valuation: $V_{\text{market}} = W_{\text{net}} \times \text{Current Market Rate per gram}$.
  - Maximum Allowable Loan (LTV Cap): $L_{\text{max}} = V_{\text{market}} \times 0.75$.
* **3-Angle Collateral Photography**:
  1. Front Full View.
  2. Hallmark / Purity Seal Close-up.
  3. Digital Scale Reading with Item on Pan.
* **Vault Storage Security**:
  - Each appraisal assigns a tamper-evident pouch serial number and physical vault bin identifier (`Vault-A / Shelf-02 / Bin-14`).

---

## 12. Commercial Bank Re-Pledge Management System
To optimize institutional working capital, PGF enables management to legally re-pledge vaulted physical gold with scheduled commercial banks (SBI, HDFC, Canara Bank, Indian Bank, etc.):
1. **Collateral Lot Grouping**: Management selects eligible active customer loans whose gold is in branch custody.
2. **Re-Pledge Creation (`/admin/re-pledge/new`)**:
   - Partner Bank Name & Branch Code.
   - Bank Loan Account Number.
   - Bank Sanctioned Principal Amount.
   - Bank Borrowing APR (typically $8.5\% - 10.5\%$).
   - Tenor & Due Date.
3. **Chain of Custody Tracking**: Individual ornament records are marked `custody_status: 'Bank_RePledged'` and linked to the `bankRePledges` contract ID.
4. **Customer Redemption Safeguard**: If a borrower settles their loan, the system automatically checks if the collateral is re-pledged. If re-pledged, an alert is triggered to initiate bank redemption before collateral release scheduling.

---

## 13. Fast-Billing POS & 300 Tamil Slogans Engine
* **Sequential Rotation Engine (`src/lib/db/slogans.ts`)**:
  - All 300 unique Tamil cultural thrift and prosperity slogans are stored in Firestore `billSlogans`.
  - An atomic counter document (`counters/bill_slogan_index`) guarantees sequential rotation ($1 \to 300 \to 1$).
  - Every printed bill or receipt atomically increments the counter, guaranteeing zero duplicate slogans on consecutive receipts.
* **Dual Receipt Printing**:
  - Generates both Customer Copy and Office Copy formatted for standard desktop laser printers and 80mm thermal receipt printers.

---

## 14. Server-Side PDF Document Generation Suite
Compiled on-the-fly via server-side `pdfkit` (v0.19.1) with vector layout tables, barcode/QR generation, and Nirmala TrueType Tamil Unicode font registration:
1. **Pawn Ticket (Form F / Form 13 Statutory Pawn Deed)**: Borrower details, Aadhaar, complete itemized gold schedule, gross/net weights, purity, approved APR, LTV, 30-day grace terms, and digital signature boxes.
2. **Dual-Counter Payment Receipt**: Receipt number, transaction date, payment mode, waterfall allocation (Penalty, Interest, Principal), remaining loan balance, next due date, and sequential Tamil cultural slogan.
3. **Loan Closure & Collateral Release Deed**: Zero-balance audit confirmation, vault bin discharge certificate, borrower receipt acknowledgment, and manager discharge seal.
4. **Annual Customer Statement**: Detailed chronological ledger of all disbursements and payments with opening and closing balances.
5. **KYC Consultation Dossier**: Customer 360-degree risk assessment sheet with lifetime borrowing metrics.
6. **Investor Payout Receipt**: Capital placement confirmation or monthly interest payout voucher with TDS deduction summary.

---

## 15. Enterprise 50-Sheet Excel Financial & Operational Workbook
Generated via `xlsx` (v0.18.5) and available for download at `/admin/reports`, compiling an exhaustive 50-sheet financial workbook:

| Sheet # | Sheet Title | Scope & Detailed Contents |
| :--- | :--- | :--- |
| **1** | `Company Profile` | Legal entity metadata, GSTIN, PAN, CIN, Pawn license number, head office address. |
| **2** | `Executive Summary` | Real-time portfolio totals, active loan counts, total disbursed principal, vault gold weight. |
| **3** | `Active Loans` | Full line-by-line active loan register with customer details, weights, APR, and balances. |
| **4** | `Settled Loans` | Complete closed loan history with origination, closure date, total interest collected. |
| **5** | `Overdue Defaults` | Defaulted loans past maturity date with accrued penalties and days overdue. |
| **6** | `Customer Directory` | Master borrower roster with phone, address, Aadhaar/PAN, and KYC verification status. |
| **7** | `Gold Inventory` | Itemized gold ornament inventory with item counts, gross weight, net weight, and purity. |
| **8** | `Vault Storage Ledger`| Physical vault bin allocations, pouch numbers, and custodian branch assignments. |
| **9** | `Daily Repayments` | Today's payment transactions with mode of payment, receipt numbers, and slogans. |
| **10** | `Monthly Repayments`| Month-to-date collection ledger classified into penalty, interest, and principal. |
| **11** | `Payment Allocation`| Waterfall allocation breakdown showing paise-accurate ledger postings. |
| **12** | `Cash Book` | Daily cash inflows, counter cash collections, principal disbursements, closing drawer balance. |
| **13** | `Bank Book` | Digital payment transactions (UPI, NEFT, RTGS) reconciled against bank statements. |
| **14** | `Bank Re-Pledge Ledger`| Comprehensive commercial bank re-pledge registry, bank borrowing rates, and due dates. |
| **15** | `Re-Pledge Margin Analysis`| Interest rate spread ($ \text{Customer APR} - \text{Bank APR} $) and gross spread income. |
| **16** | `Operational Expenses`| Master expenses register itemized by general ledger category and voucher reference. |
| **17** | `Daily P&L Statement`| Day-by-day cash and accrual income vs expenditure breakdown. |
| **18** | `Monthly P&L Statement`| Month-by-month financial performance statement. |
| **19** | `Yearly Financial P&L`| Annual statutory financial statement ready for chartered accountant audits. |
| **20** | `Consolidated Position`| Balance sheet consolidation of vault gold, bank re-pledge liabilities, and net equity. |
| **21** | `KYC Consultation Master`| Borrower lifetime lending summary, historical punctuality, and default risk tiering. |
| **22** | `Investor Master` | Master register of registered capital providers, investment dates, and bank mandates. |
| **23** | `Investment Accounts`| Investor account balances, total deposits, cumulative returns, and active lot totals. |
| **24** | `Investment Lots` | Granular investment lot registry with scheme types, APR, and compounding frequency. |
| **25** | `Investment Payouts` | Monthly yield distribution schedule, paid vouchers, and pending approval queues. |
| **26** | `Investor Withdrawals`| Capital and yield withdrawal requests, approval timestamps, and payment UTRs. |
| **27** | `Loan Renewals Ledger`| Restructured loans register linking old loan numbers to new loan agreements. |
| **28** | `Collateral Releases` | Discharged collateral register with borrower acknowledgments and witness details. |
| **29** | `High-LTV Approvals` | Exceptions register for loans exceeding 75% LTV with authorizer credentials. |
| **30** | `Interest Waivers` | Authorized financial waivers reducing accrued interest or penalty charges. |
| **31** | `Auction Notices` | 14-day statutory auction notices dispatched to defaulted borrowers. |
| **32** | `Auction Sales Ledger`| Liquidated collateral sale proceeds, auction house fees, and borrower surplus refunds. |
| **33** | `WhatsApp Reminders Log`| Multi-channel alert dispatch records, message templates, and delivery timestamps. |
| **34** | `Audit Trail Logs` | Immutable system audit log capturing state diffs, actor IDs, and IP addresses. |
| **35** | `Sequential Slogans Master`| Full catalog of all 300 unique Tamil slogans with assignment counter logs. |
| **36** | `Branch Ledger` | Branch-wise loan book, gold weight, interest collection, and headcount breakdown. |
| **37** | `Employee Roster` | Staff master, assigned roles, branch locations, and system access levels. |
| **38** | `Gold Rate History` | Historical 24K, 22K, 18K market gold rate audit records per gram. |
| **39** | `Double-Entry Journal`| Authoritative debits and credits journal entries for financial year auditing. |
| **40** | `Trial Balance` | Balanced trial balance verifying debit-credit equality across all accounts. |
| **41** | `Balance Sheet` | Formal enterprise balance sheet (Assets, Liabilities, Partner Equity). |
| **42** | `GST Compliance Report`| State GSTIN taxable processing fees and tax liability calculations. |
| **43** | `TDS Deduction Register`| Tax Deducted at Source (TDS) register for investor interest distributions. |
| **44** | `Support Tickets Master`| Customer service inquiries, complaint logs, and resolution turn-around times. |
| **45** | `Liquidity Stress Test` | Sensitivity modeling showing collateral equity coverage under gold price drops. |
| **46** | `AI Credit Risk Model`| Borrower credit scoring based on lifetime repayment velocity and collateral purity. |
| **47** | `Import Staging Log` | Data migration verification records from legacy physical books. |
| **48** | `Auditor Export Matrix`| Standard format export designed for external government and tax inspectors. |
| **49** | `System Parameters` | Snapshot of global business rules, APR caps, LTV ceilings, and grace periods. |
| **50** | `Executive BI Charts Data`| Pre-aggregated numerical series formatted for immediate business intelligence graphing. |

---

## 16. Native Desktop Application (Electron Integration)
* **Architecture**: Located in `/electron` (`main.js`, `preload.js`).
* **Desktop Packaging**: Wraps the Next.js production build into a native Windows executable with system tray integration, automatic crash reporting, and secure local hardware communication.
* **Hardware Thermal Printer Integration**: Connects via native Node printer drivers to direct USB/ESC-POS thermal receipt printers (80mm), bypassing standard browser print dialogs for instant counter receipt output.
* **Offline Resilience**: Caches core customer directories and active loan balances locally in SQLite/IndexedDB for uninterrupted counter operations during broadband interruptions.

---

## 17. Multi-Branch Operations & Organizational Hierarchy
* **Strict Branch Isolation**: Every customer, loan, payment, gold item, expense voucher, and vault bin is tagged with `branch_id`.
* **Central Executive Switcher**: Backoffice operators with `Admin` or `Owner` roles can seamlessly toggle between individual branch views or view an aggregated consolidated enterprise position.
* **Staff Branch Locking**: Counter tellers and branch appraisers are cryptographically locked to their assigned branch, preventing cross-branch counter discrepancies.

---

## 18. Multi-Level Approvals & Financial Waiver Workflows
* **High-LTV Exception Protocol**: If a loan request exceeds the standard $75\%$ LTV cap, the submission creates an `approval_requests` entry in `Pending` status. The loan cannot disburse until an Admin or Owner clicks "Approve".
* **Financial Waiver Protocol**: Cashiers cannot discount interest or waive principal unilaterally. A waiver request must be approved by a Manager/Admin, which automatically logs the authorized waiver amount into the payment record.
* **Investor Withdrawal Approvals**: Any investor withdrawal exceeding $₹50,000$ requires dual approval from the Chief Financial Officer and Managing Director before funds disbursement.

---

## 19. Collateral Auctions & Default Liquidation Engine
* **Statutory Grace Period**: Borrowers receive 30 days of grace past the 365-day loan maturity date before auction initiation.
* **Auction Notice Dispatches**: Automatic dispatches sent via registered post notice, SMS, and WhatsApp alerts giving 14 days final notice.
* **Lot Cataloging & Reserve Valuation**: Collateral ornaments are grouped into auction lots. Reserve price is automatically computed as:
  $$\text{Reserve Price} = \text{Net Weight (g)} \times \text{Current Gold Rate} \times 0.95$$
* **Settlement & Surplus Refund**: Auction sale proceeds clear outstanding interest and principal. Any surplus funds remaining are credited to the borrower's registered bank account.

---

## 20. Multi-Channel Automated Reminders
* **Event-Driven Alerts**:
  - `LOAN_CREATED`: Sends immediate welcome message, loan number, principal, and digital Pawn Ticket link.
  - `PAYMENT_RECEIVED`: Sends instant receipt acknowledgment, amount received, and new principal balance.
  - `MATURITY_WARNING`: Triggered automatically at $T-30$, $T-15$, $T-7$, $T-3$, and $T-1$ days before maturity.
  - `OVERDUE_ALERT`: Daily notifications dispatched to borrowers in default status.
* **Multi-Channel Dispatch Engine**: Integrates with Firebase Cloud Messaging (In-App Push), WhatsApp Cloud API, and transactional SMS gateways.

---

## 21. Audit Trail & Regulatory Compliance Logging
* **Tamper-Evident History**: Every create, update, and delete operation writes an immutable entry into `audit_logs` or `investment_audit_logs`.
* **State Diff Capture**: Captures `actor_id`, `action_type`, `affected_entity`, `affected_entity_id`, `old_state` (JSON), `new_state` (JSON), `ip_address`, and ISO timestamp.
* **Statutory Compliance**: Conforms to Tamil Nadu Pawnbrokers Act and RBI Fair Practices Code for gold loan lending.

---

## 22. System Settings & Business Configurations
Configured dynamically via `/admin/settings` and `/admin/investments/settings`:
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
* `investment_annual_rate`: Base annual return on capital investments (e.g. 12.00%).
* `investment_lock_in_months`: Minimum lock-in period for capital lots (e.g. 12 months).

---

## 23. Automated Testing & Verification Suite
The codebase includes an enterprise-grade automated test suite executed via Node's native test runner (`node --test tests/**/*.test.mjs`). All **18 test suites** containing **161 test cases** pass with 100% success:

| # | Test Suite File | Test Count | Scope & Verification Criteria |
|:---|:---|:---:|:---|
| 1 | `tests/payments.test.mjs` | 16 | Validates interest-first allocation, penalty priority, waiver reduction, full settlement detection, allocation sum mismatch rejection, balance limit enforcement, settled loan protection, and duplicate payment idempotency replay. |
| 2 | `tests/interest-calculation.test.mjs` | 14 | Leap year detection (366 days), integer paise accuracy, reducing balance calculations, same-day zero accrual, large principal (₹1 Cr) precision, and one-day loan accruals. |
| 3 | `tests/interest-payment-flow.test.mjs` | 10 | Dynamic elapsed days/months, partial month boundaries, reducing balance ledger trail ($₹10,000 \to ₹9,900$), interest-only payments, customer statement generation, and bank re-pledge collateral release lock. |
| 4 | `tests/investments.test.mjs` | 10 | Sequential investor IDs (`PGF-INV-000001`), mandatory KYC fields, year 1 pro-rata and year 2/3 annual compounding, multi-lot tracking, withdrawal balance validation, atomic balance updates, WhatsApp deep-link formatting, and cross-investor IDOR defense. |
| 5 | `tests/loan-lifecycle.test.mjs` | 9 | Sequential loan IDs (`PGF-GL-000001`), terminal status protection, full settlement release checks, collateral status transitions (`In_Vault` $\to$ `Released` / `RePledged`), renewal restrictions, and approved APR set validation ($\{18\%, 20\%, 22\%, 24\%, 30\%\}$). |
| 6 | `tests/kyc-consultation.test.mjs` | 8 | Customer lookup by phone/unique ID/name, multi-pledge isolation, release date calculation, active loan tenure, multi-ornament net weight summation, active pockets aggregation, and branch boundary isolation. |
| 7 | `tests/repledge-flow.test.mjs` | 6 | Loan-to-repledge linkage resolution, re-pledge ownership validation, ornament custody linkage, dual-ledger independence, and bank settlement release safeguard. |
| 8 | `tests/security-rbac.test.mjs` | 11 | Cross-role customer isolation, customer own-loan read access, investor loan data rejection, staff role hierarchy (`Employee < Manager < Admin`), payment write server enforcement, role self-elevation prevention, and audit log immutability. |
| 9 | `tests/auth-guards.test.mjs` | 6 | Strict role enforcement for `requireAdmin()` (Admin/Owner only), regression defense for GAP-11 (Investor blocked from Admin actions), `requireStaff()` backoffice verification, `requireCustomer()` validation, inactive status rejection, and GAP-13 production dev-token rejection. |
| 10 | `tests/slogans.test.mjs` | 4 | Complete 300 unique Tamil slogans catalog verification, sequential 1-to-300 rotation and wrap-around, zero consecutive repeat invariant across 1,000 billings, and index/ID lookup helpers. |
| 11 | `tests/gold-appraisal.test.mjs` | 5 | Multi-ornament net weight calculations (`net = gross - stone`), stone weight exceeding gross rejection, karat purity conversions (24K, 22K, 18K), statutory 75% LTV cap enforcement, and auction reserve price (95% benchmark). |
| 12 | `tests/renewal.test.mjs` | 5 | Renewal validation on settled loans, Option A (Interest-only renewal), Option B (Principal reduction renewal), Option D (Top-up renewal), and accrued interest payment minimum enforcement. |
| 13 | `tests/pdf-security.test.mjs` | 7 | ID token requirement, customer isolation (preventing cross-customer document access), staff document access, accounting report restriction, collateral photo normalization, and company settings validation. |
| 14 | `tests/storage-rules.test.mjs` | 1 | Verification of role hierarchy consistency, elimination of flawed `data.role != 'Customer'` pattern, explicit `isAdmin()` and `isStaff()` rules, and collateral/company path permissions. |
| 15 | `tests/accounting-reconciliation.test.mjs` | 24 | Daily cashbook balancing, petty cash ledger entries, trial balance generation, balance sheet integrity, asset/liability classifications, and journal voucher integrity. |
| 16 | `tests/expenses-pnl.test.mjs` | 14 | Operating expense tracking, category grouping, monthly/quarterly P&L calculation, net profit reconciliation, and multi-branch expense isolation. |
| 17 | `tests/consolidated.test.mjs` | 10 | Enterprise-wide asset/liability aggregation, gold inventory valuation, bank borrowing exposure, investor liabilities reconciliation, and net capital position. |
| 18 | `tests/e2e-production-audit.test.mjs` | 12 | Full lending lifecycle audit (Onboarding $\to$ Appraisal $\to$ Loan $\to$ Payment $\to$ Settlement $\to$ Release), Firestore rule cross-investor IDOR static verification, storage rules security, and system configuration compliance. |

### Build & Compilation Gates
* **TypeScript Compilation**: Clean pass (`npx tsc --noEmit`) with **0 errors**.
* **Dev Server**: Active and serving all 78 screens without compilation issues.

---

## 24. Production Deployment & Live Readiness Guide

### 24.1 Environment Configuration (`.env.local`)
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

### 24.2 Firebase Rules & Hosting Deployment
```bash
# 1. Deploy Cloud Firestore Security Rules
firebase deploy --only firestore:rules

# 2. Deploy Cloud Storage Security Rules
firebase deploy --only storage:rules

# 3. Deploy Cloud Firestore Composite Indexes
firebase deploy --only firestore:indexes

# 4. Compile and Deploy Next.js Web Application
npm run build
firebase deploy --only hosting
```

---

## 25. Acceptance Criteria & Zero-Defect Mandates
* **AC-01 (Strict Customer Isolation)**: A borrower must never under any circumstances be able to access, view, or download another customer's loan records, collateral photos, or payment receipts.
* **AC-02 (Paise Precision Guarantee)**: No floating point rounding errors in repayment allocations; all allocations must balance down to $₹0.00$.
* **AC-03 (Authoritative PDFs)**: PDF documents must never accept unverified client parameters; all document data must resolve directly from authoritative Firestore records.
* **AC-04 (Atomic Slogans)**: Slogans on receipts must advance sequentially across all 300 entries with zero repeat collisions.
* **AC-05 (Approved APR Compliance)**: Loan APRs must only accept values from the approved set $\{18\%, 20\%, 22\%, 24\%, 30\%\}$, and any modification must include mandatory authorized reasoning.
* **AC-06 (Re-Pledge Safety)**: No collateral can be released to a customer if currently marked as `Bank_RePledged` without explicit bank redemption logging.
* **AC-07 (Investor Safeguards)**: Investor withdrawals must respect lock-in periods, and balances cannot be updated without immutable audit trail entries.
* **AC-08 (Zero Type Errors)**: Codebase must compile cleanly with `tsc --noEmit` and build without warnings.

---

## 26. Conclusion
This Master Requirements Document provides the single authoritative technical blueprint for **Pavithra Gold Finance (PGF)**. By documenting all **78 application screens**, **5 specialized portals**, **32 Firestore collections**, **11 user roles**, server-side PDF and 50-sheet Excel engines, mathematical models, bank re-pledge workflows, expense & P&L accounting, investor management, and security rules, the engineering and operations teams possess a complete, verified reference for production operations and enterprise scaling.
