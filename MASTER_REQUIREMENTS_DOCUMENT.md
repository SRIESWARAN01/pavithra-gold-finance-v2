# Pavithra Gold Finance (PGF) - Master Requirements Document
## Enterprise Gold Loan Management System Blueprint

---

## 1. Executive Summary
**Pavithra Gold Finance (PGF)** is an enterprise-grade digital solution designed for a single-business, single-branch gold loan entity. The system automates ledger entries, appraises collateral gold, calculates dynamic daily interest, manages repayments, and provides a transparent, mobile-responsive view for the customer. PGF replaces traditional paper ledgers with secure cloud storage, digital signatures, real-time balance calculations, and multi-channel notification reminders (SMS, WhatsApp, Push).

---

## 2. Product Vision
PGF aims to transition local gold loans from a manual transaction of necessity into a highly secure, digital, transparent, and premium financial service. PGF is structured around four pillars:
1. **Operational Transparency**: Borrowers view exact accrued interest and collateral details.
2. **Enterprise Security**: Strict token authentication, database encryption, and signature validation.
3. **Instant Synchronization**: Changes made by the Admin are instantly updated on the Customer's screen using Supabase Realtime replication.
4. **Luxury Aesthetics**: A clean design using Navy Blue, Gold, and White to reflect prestige and reliability.

---

## 3. Business Goals
* **BG-01 (100% Paperless Auditing)**: Store signatures, ID photos, and gold collateral photos securely in Cloud Storage.
* **BG-02 (Zero Disputes)**: Transparent, daily simple interest calculations visible on the customer's portal.
* **BG-03 (40% Reduced Default Rate)**: Automated alerts on WhatsApp, SMS, and Push notifications.
* **BG-04 (95% Self-Service Info)**: Customers check active loans and outstanding balances directly on their smartphones.

---

## 4. Target Users
* **Admin (Business Owner / Appraiser)**: Handles onboarding, appraises gold weight/purity, uploads photos, configures interest rates, and registers payments.
* **Customer (Borrower)**: Tracks active loans, balances, due dates, item details, and downloads PDF receipts.

---

## 5. Functional Requirements (FR)

### 5.1 Authentication Module
* **Splash Screen**: Mobile launch screen displaying PGF luxury branding logo.
* **Welcome Screen**: Directs users to login or shows quick support contact.
* **Single Login**: Single portal login for both Admin and Customer roles.
* **Forgot Password**: Password retrieval link.
* **OTP Reset**: Verified via SMS/WhatsApp code.
* **Session Management**: JWT session timeout auto-redirect.

### 5.2 Admin Dashboard Overview Metrics
* **Total Customers**: Count of all onboarded borrowers.
* **Active Loans**: Active loan count.
* **Closed Loans**: Count of fully settled loans.
* **Due Today / Week**: Count of loans reaching maturity.
* **Overdue Loans**: Loans in defaulted state.
* **Outstanding Amount**: Cumulative principal + interest.
* **Interest Collection**: Yield metrics display.

### 5.3 Customer Management Features
* **Add Customer**: Name, Phone, Aadhaar, PAN, Address details.
* **Media Capture**: Profile webcam photo & Digital Signature pad.
* **KYC Workflow**: Admin ➔ Add Customer ➔ Upload KYC ➔ Capture Photo ➔ Save Customer.

### 5.4 Gold Management Features
* **Add Jewellery**: Register Gross, Stone, and Net weight in grams, Purity Karat, Gold Rate, Max Eligible Loan, and Collateral Photos.
* **Gold Workflow**: Customer/Admin ➔ Add Jewellery ➔ Capture Photos ➔ Verify Weight ➔ Save.

### 5.5 Loan Management Features
* **Create Loan**: Auto-generate loan number, set APR interest rate, duration, and print agreement.
* **Loan Workflow**: Gold Entry ➔ Loan Calculation ➔ Approve Loan ➔ Disburse Principal ➔ Generate Pawn Ticket.

### 5.6 Interest Management
* **Accrual Logic**: Dynamic daily interest calculations, monthly summaries, and history.
* **Interest Workflow**: System Cron ➔ Calculate Daily Interest ➔ Update Database Outstanding.

### 5.7 Payment Management
* **Log Payment**: Log Cash, UPI, or Card payments; split dynamically (Interest first, then Principal).
* **Payment Workflow**: Log Payment ➔ Split Balance ➔ Update Loan ➔ Print Receipt ➔ Send WhatsApp Alert.

---

## 6. Non-Functional Requirements (NFR)
* **NFR-SEC-01**: HTTPS with TLS 1.3 encryption.
* **NFR-SEC-02**: JWT tokens store in `httpOnly` secure cookies.
* **NFR-PER-01**: 95% of read APIs execute in $<200$ms.
* **NFR-PER-02**: Real-time sync updates Customer dashboard in $<1$s via WebSockets.

---

## 7. User Personas
* **Admin - Rajasekar (48)**: Chief appraiser seeking to eliminate math errors and minimize default rates.
* **Customer - Priya (34)**: Mobile-first boutique owner requiring rapid liquidity and transparent receipt histories.

---

## 8. User Journey
1. Onboarding: Customer visits branch; Admin appraises items, logs details, and captures signature.
2. Active Loan: Customer monitors live balance and gold specifications on mobile.
3. Payment: Customer pays interest; Admin logs transaction; updated balance syncs instantly.

---

## 9. Complete User Flow
* User logs in ➔ JWT checks user role:
  * Admin ➔ Customer Creation ➔ Appraisal ➔ Loan Generation ➔ PDF Ticket.
  * Customer ➔ Loan Overview ➔ Collateral Photo Gallery ➔ PDF Receipt Downloads.

---

## 10. Navigation Flow
* **Unified Login URL**: `/`
* **Admin Paths**: `/dashboard`, `/customers/[id]`, `/loans/new`, `/payments`, `/settings`
* **Customer Paths**: `/dashboard`, `/loans/[id]`, `/payments`, `/profile`

---

## 11. Screen Hierarchy
```
/app
├── layout.tsx (Global wrapper)
├── page.tsx (Unified Login Screen)
├── (admin)/
│   ├── dashboard/page.tsx
│   ├── customers/[id]/page.tsx
│   └── loans/new/page.tsx
└── (customer)/
    ├── dashboard/page.tsx
    └── loans/[id]/page.tsx
```

---

## 12. Screen-by-Screen Documentation

This section details the layout, components, interactive controls, interface states, and backend logic for every screen in the Pavithra Gold Finance (PGF) system.

---

### SCREEN 1: Unified Login Screen

#### 12.1.1 Purpose
A single entry point for both Admin and Customer users. It authenticates credentials and routes the user to the correct dashboard based on role claims.

#### 12.1.2 UI Design Reference (Self-Created)
![Unified Login Screen Mockup](/C:/Users/Admin/.gemini/antigravity/brain/d8444f3b-a874-4025-a124-3d5006327337/login_ui_mockup_1782802584209.png)

#### 12.1.3 Layout & Responsive Behavior
* **Desktop (PC) Layout**: Split-screen dashboard. Left panel contains a brand visualization showcasing golden asset graphics overlayed with high-end typography ("Secure. Transparent. Luxury Gold Finance."). Right panel contains a centered, elevation-shadowed login card with a deep navy background (`#0A192F`) and gold borders.
* **Mobile Layout**: Centers the single login card on screen, hiding the left branding panel entirely. Inputs adapt to 100% device width with high touch targets (48px height).

#### 12.1.4 Interface Components & Controls
* **Phone Number Field**: Text input with a default prefix country-code selector (`+91`).
* **Password Field**: Encrypted text input with eye-icon toggle to reveal characters.
* **Action Button**: Primary button labeled "Sign In" with a gold background, black text, and hover scale transitions.

#### 12.1.5 UI States & Validations
* **Loading State**: Form fields disabled; Sign In button text changes to a spinning gold wheel.
* **Error State**: Banners with code `ERR_AUTH_01` display if validation fails.
* **Validation**: Phone number must be 10 digits; password cannot be empty.

---

### SCREEN 2: Admin Dashboard (PC Friendly Layout)

#### 12.2.1 Purpose
The central workspace dashboard for the business owner, providing full operational visibility.

#### 12.2.2 UI Design Reference (Self-Created)
![Admin Dashboard UI Mockup](/C:/Users/Admin/.gemini/antigravity/brain/d8444f3b-a874-4025-a124-3d5006327337/admin_dashboard_ui_1782802599530.png)

#### 12.2.3 Layout & Responsive Behavior
* **Desktop Layout**: 3-column dashboard:
  * **Left Column**: Fixed navigation sidebar containing branding and page links.
  * **Center Column**: Large grids displaying metrics cards (Active Principal, Weight, Yield) and recent transactions table.
  * **Right Column**: Sidebar showing action notifications and daily due alerts.
* **Mobile Layout**: Sidebars collapse into responsive toggle drawers. Metrics grid items collapse from 4-columns to a single-column scrollable block.

#### 12.2.4 Interface Components & Controls
* **Metric Cards**: Navy cards with gold borders displaying totals.
* **Quick Actions Header**: Large buttons for "Onboard Customer" and "New Loan".
* **Dues Table**: List showing loans nearing default status.

---

### SCREEN 3: Admin Customer Onboarding Screen

#### 12.3.1 Purpose
Registers customer profile data, capturing live webcam verification and digital signatures.

#### 12.3.2 Layout & Responsive Behavior
* **Desktop Layout**: Two equal columns. Left column contains the text fields (Name, Phone, Address). Right column holds the camera capture panel and HTML5 signature pad.
* **Mobile/Tablet Layout**: Vertical stacked layout. The webcam element switches to device native camera input, and signature pad adjusts to portrait landscape width.

#### 12.3.3 Interface Components & Controls
* **Form Inputs**: Text inputs for Name, Mobile (Primary/Alt), Address, and Aadhaar card (12 digits).
* **Webcam Block**: Canvas preview displaying captured profile image.
* **Signature Block**: Ink-canvas capture pad with "Clear" and "Accept" buttons.

---

### SCREEN 4: Admin Gold Appraisal & Loan Origination Screen

#### 12.4.1 Purpose
Records individual gold ornament weight/karats and defines specific loan terms.

#### 12.4.2 Layout & Responsive Behavior
* **Desktop Layout**: Form wizard format. Gold appraisal cards stack side-by-side in a 2-column grid. Financial calculators sit in a sticky sidebar.
* **Mobile Layout**: Sequential step-by-step layout. Collateral photo upload integrates with the smartphone camera roll.

#### 12.4.3 Interface Components & Controls
* **Appraisal Form**: Description input, Weight (grams) floating-point field, Purity dropdown (18K/22K/24K).
* **Upload Area**: Drag-and-drop box for gold photographs.
* **Calculators**: Displays real-time maximum loan eligibility (LTV capped at 75%).

---

### SCREEN 5: Admin Repayment Registry Screen

#### 12.5.1 Purpose
Logs payments, splits balances between principal and interest, and issues receipts.

#### 12.5.2 Layout & Responsive Behavior
* **Layout**: Single-column container on both PC and mobile. PC displays payment split tables on the right side of the screen; mobile hides splits under an expandable drawer.

#### 12.5.3 Interface Components & Controls
* **Registry Form**: Payment Amount (INR), Mode selector (Cash, UPI, Card), and remarks notes.
* **Amortization Preview**: Displays remaining principal and settled interest splits before transaction confirmation.

---

### SCREEN 6: Customer Mobile Dashboard (Mobile First)

#### 12.6.1 Purpose
The home dashboard for the borrower, optimized for mobile phone viewing.

#### 12.6.2 Layout & Responsive Behavior
* **Mobile Layout**: Full screen vertical card stack. Sticky top logo, large gold balance display panel, accordion panels for active loans, and a persistent bottom tab bar.
* **Desktop Layout**: Centers mobile viewport wrapper with side margins to preserve layout ratio on wider screens.

#### 12.6.3 Interface Components & Controls
* **Outstanding Hero Card**: High contrast navy background showing outstanding amount and upcoming due dates in bold font.
* **Loan Accordions**: Tapping a loan opens collateral details and payment receipts.

---

### SCREEN 7: Customer Collateral Detail Screen

#### 12.7.1 Purpose
Displays specifications and visual catalog of gold assets held in vaults.

#### 12.7.2 Layout & Responsive Behavior
* **Layout**: Image slider layout on top of specification card lists. Fits phone screen dimensions with touch-swipe actions.

#### 12.7.3 Interface Components & Controls
* **Swipeable Slider**: Showcases multiple high-resolution photos of gold ornaments.
* **Spec Table**: Lists weight in grams, purity karat, and secure locker IDs.

---

### SCREEN 8: Customer Repayment History Screen

#### 12.8.1 Purpose
A chronological list of payment histories and PDF receipt downloads.

#### 12.8.2 Layout & Responsive Behavior
* **Layout**: Vertical timeline cards. Fits mobile and desktop screens.

#### 12.8.3 Interface Components & Controls
* **Timeline Cards**: Show dates, payment amounts, and splits.
* **Download Button**: Floating gold icon to trigger receipt PDF downloads.

---

## 13. UI/UX Guidelines
* **Minimalist Approach**: Zero visual noise. High contrast typography.
* **Transitions**: Smooth scaling on button tap; slide-out sidebar panels; gold border-glows on focus.

---

## 14. Design System
Built with **Tailwind CSS** configurations and custom **Shadcn UI** component wrappers.

---

## 15. Color Palette
* **Background (Deep Navy)**: `#0A192F` | HSL(220, 65%, 12%)
* **Primary (Rich Gold)**: `#D4AF37` | HSL(46, 65%, 52%)
* **Secondary (Warm White)**: `#F8FAFC` | HSL(210, 40%, 98%)
* **Muted (Slate)**: `#64748B` | HSL(215, 16%, 47%)

---

## 16. Typography
* **Headings**: `Outfit` (Geometric, clean).
* **Body / Forms**: `Inter` (High legibility at small sizes).

---

## 17. Icons
Standardized on **Lucide React**: `LayoutDashboard`, `UserSquare2`, `Coins`, `Receipt`, `Camera`, `Download`.

---

## 18. Components
* **Buttons**: Custom primary gold button: `bg-gold hover:bg-gold-dark text-navy-DEFAULT font-semibold px-4 py-2 rounded-md`.
* **Inputs**: Dark field borders: `bg-navy-light border border-slate-700 text-white placeholder-slate-500 rounded-md`.

---

## 19. Layout System
* **Admin**: Left sidebar navigation (260px wide) + main scrollable content container.
* **Customer**: Dynamic header + mobile bottom navigation dock (65px height) with blur backdrop filter.

---

## 20. Responsive Behaviour
* **Desktop**: Full layout views with persistent sidebars and multi-column tables.
* **Mobile**: Navigation collapses to bottom dock. Forms stack vertically. Tables render as scrollable list cards.

---

## 21. Customer Workflow
1. User receives invite credentials via SMS/WhatsApp.
2. Logs in, updates default password, and views dashboard.
3. Tracks outstanding balance and collateral photos.
4. Downloads PDF receipts.

---

## 22. Admin Workflow
1. Logs in and reviews daily cash requirements and overdue lists.
2. Registers customer profile, captures signature, and appraises gold.
3. Inputs principal, approves terms, and prints Pawn Ticket PDF.
4. Enters repayments and updates database states.

---

## 23. Loan Workflow
* Status updates sequentially: `Draft` ➔ `Active` ➔ `Grace Period` ➔ `Settled` (or `Defaulted` ➔ `Auctioned`).
* Grace period remains active for 30 days past the 365-day loan maturity date.

---

## 24. Gold Management Workflow
* Appraiser weighs gold to 2 decimal places.
* Purity verified as 18K, 22K, or 24K.
* Close-up webcam photos stored.
* Sealed package stored in secure vault bin.
* Released to customer only upon final settlement check.

---

## 25. Payment Workflow
Interest is computed daily:

$$\text{Daily Accrual} = \frac{\text{Principal} \times \left(\frac{\text{APR}}{100}\right)}{365}$$

Allocation priority order:
1. Pay accumulated outstanding interest.
2. Remaining amount reduces loan principal.

---

## 26. Notification Workflow
Multi-channel alerts dispatched at key intervals:
* On loan creation.
* 30-day, 15-day, 7-day, 3-day, and 1-day maturity warnings.
* Due date alert.
* Daily overdue notifications.

---

## 27. PDF Generation Workflow
* Renders server-side using HTML templates.
* **Pawn Ticket**: Contains customer image, signature, collateral photographs, and contract terms.
* **Receipt**: Contains transaction date, amount paid, interest cleared, and new principal balance.

---

## 28. Security Workflow
* Route parameters protected by token parsing.
* JWT checks user roles (Admin vs. Customer).
* Blocked access alerts logged inside audit DB database.

---

## 29. Error Handling Schema
Standard JSON payload:
```json
{
  "success": false,
  "error": { "code": "ERR_CODE", "message": "Details", "recovery": "Instructions" }
}
```
Standard codes: `ERR_AUTH_01` (Session expired), `ERR_LTV_02` (Exceeds LTV caps).

---

## 30. Validation Rules
* **Name**: 3-100 characters, letters only.
* **Mobile**: Exactly 10 digits, validated against Indian cellular prefix pattern.
* **Gold Weight**: Greater than 0.00g and less than 5000.00g.

---

## 31. Edge Cases
* **Leap Years**: Accrual denominator automatically sets to 366 for leap years.
* **Same-Day Payments**: No extra daily interest accumulates for subsequent payments logged on the same calendar day.

---

## 32. Business Rules
* Maximum allowable LTV limit: **75%**.
* Interest calculations apply daily starting at **Midnight**.
* Default status applies 30 days after maturity date.

---

## 33. Data Relationships
* A `Customer` can hold multiple `Loans`.
* A `Loan` is linked to multiple `Gold Collateral` items.
* A `Loan` holds multiple `Payments` and `Audit Logs`.

---

## 34. Database Entity Planning
```sql
CREATE TYPE user_role AS ENUM ('Admin', 'Customer');
CREATE TYPE loan_status AS ENUM ('Draft', 'Active', 'Grace_Period', 'Defaulted', 'Auctioned', 'Settled');

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    phone_primary VARCHAR(15) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'Customer',
    signature_url VARCHAR(255),
    photo_url VARCHAR(255)
);

CREATE TABLE loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    principal_amount NUMERIC(12, 2) NOT NULL,
    interest_rate_apr NUMERIC(4, 2) NOT NULL,
    status loan_status NOT NULL DEFAULT 'Draft',
    origination_date TIMESTAMP WITH TIME ZONE,
    maturity_date TIMESTAMP WITH TIME ZONE
);
```

---

## 35. API Planning
* **POST `/api/auth/login`**: Authenticates login credentials and returns secure HttpOnly JWT cookie.
* **POST `/api/admin/customers`**: Saves customer profiles, signatures, and photos.
* **POST `/api/admin/loans`**: Registers gold collateral and initializes loans.

---

## 36. File Storage Planning
* **Bucket**: `pgf-secure-assets`
* **Structure**: `/customers/photos/`, `/customers/signatures/`, `/collaterals/photos/`, `/documents/tickets/`, `/documents/receipts/`.

---

## 37. Notification Planning
* Integrates with Firebase Cloud Messaging (FCM), WhatsApp Business API, and SMS gateways.
* Real-time triggers sent immediately upon database changes.

---

## 38. Audit Logs
* Track Admin operations.
* Log: Actor ID, Action Type, Old State (JSONB), New State (JSONB), IP address.

---

## 39. Reports
* Daily cash closure logs.
* Unpaid accrued interest reports.
* Defaulted account sheets.

---

## 40. Analytics
* Total active capital deployment.
* Average LTV margin safety.
* Yield tracking (Interest collected vs. Outstanding principal).

---

## 41. Performance Requirements
* Dynamic balances sync over WebSockets in $<1$ second.
* Read API response latency remains $<200$ms.

---

## 42. Backup Strategy
* Continuously stream PostgreSQL Write-Ahead Logs (WAL) to secure bucket storage (15m intervals).
* Full encrypted backup database snapshot executed daily at 01:00 AM.

---

## 43. Disaster Recovery
* **RPO**: 15 minutes.
* **RTO**: 2 hours.
* Auto-promotion of hot-standby PostgreSQL read-replica on database writer crash.

---

## 44. Future Scope
* Payment gateway integration for online customer payments.
* Multi-branch routing and role hierarchies.
* Real-time gold price feed integration.

---

## 45. Development Roadmap
* **Phase 1 (W1-2)**: Foundation, PostgreSQL setup, JWT middleware.
* **Phase 2 (W3-4)**: Admin dashboard, appraisals, PDF creation.
* **Phase 3 (W5-6)**: Customer mobile dashboard, collateral details.
* **Phase 4 (W7)**: WebSocket sync, SMS/WhatsApp triggers.
* **Phase 5 (W8)**: Testing, audits, and deployment.

---

## 46. Testing Checklist
- [ ] JWT tokens have HttpOnly, Secure, and SameSite=Strict flags.
- [ ] Gold weight input validation blocks values $\le 0$.
- [ ] WebSockets sync balances between Admin and Customer views instantly.

---

## 47. Deployment Checklist
- [ ] Launch PostgreSQL instance on RDS/Cloud SQL.
- [ ] Configure cloud storage buckets.
- [ ] Add env variables (`DATABASE_URL`, `JWT_SECRET`, etc.).

---

## 48. Production Checklist
- [ ] Deploy DB schemas.
- [ ] Run initial Admin registration seed.
- [ ] Validate live SMS/WhatsApp message delivery triggers.

---

## 49. Acceptance Criteria
* Customer views must be isolated; only access owned loans.
* Dynamic calculations must match test calculations down to 2 decimal places.
* Live dashboard synchronization must resolve in $<1$ second.

---

## 50. Complete Conclusion
This master blueprint provides a complete specification for Pavithra Gold Finance (PGF). By consolidating database models, API endpoint parameters, UI views, and workflows into a single source of truth, design and development teams can build a production-ready application without further guidance.

---

## 51. APPENDIX: Complete Feature List & Core Workflows

### 51.1 Authentication Module
* **Splash Screen**: Mobile launch screen displaying PGF luxury branding logo.
* **Welcome Screen**: Directs users to login or shows quick support contact.
* **Single Login**: Single portal login for both Admin and Customer roles.
* **Forgot Password**: Password retrieval link.
* **OTP Reset**: Verified via SMS/WhatsApp code.
* **Session Management**: JWT session timeout auto-redirect.
* **Logout & Security**: Clear JWT, terminate active sessions, block device hijack.

### 51.2 Admin Dashboard Overview Metrics
* **Total Customers**: Count of all onboarded borrowers.
* **Active Loans**: Active loan count.
* **Closed Loans**: Count of fully settled loans.
* **Due Today / Week**: Count of loans reaching maturity.
* **Overdue Loans**: Loans in defaulted state.
* **Outstanding Amount**: Cumulative principal + interest.
* **Interest Collection**: Yield metrics display.
* **Total Gold Weight & Value**: Sum of net weight (grams) and valuation.

### 51.3 Customer Management Features
* **Add Customer**: Name, Phone, Aadhaar, PAN, Address details.
* **Media Capture**: Profile webcam photo & Digital Signature pad.
* **KYC Upload**: Image formats (Aadhaar Front/Back, PAN Card).
* **KYC Workflow**: Admin ➔ Add Customer ➔ Upload KYC ➔ Capture Photo ➔ Save Customer.

### 51.4 Gold Management Features
* **Add Jewellery**: Register Gross, Stone, and Net weight in grams, Purity Karat, Gold Rate, Max Eligible Loan, and Collateral Photos.
* **Purity Levels**: Categorized strictly into 18K, 22K, or 24K.
* **Auto Calculations**:
  $$\text{Net Weight} = \text{Gross Weight} - \text{Stone Weight}$$
  $$\text{Eligible Loan} = \text{Net Weight} \times \text{Gold Rate} \times \text{Loan LTV Percentage}$$
* **Gold Workflow**: Customer/Admin ➔ Add Jewellery ➔ Capture Photos ➔ Verify Weight ➔ Save.

### 51.5 Loan Management Features
* **Create Loan**: Auto-generate loan number, set APR interest rate, duration, and print agreement.
* **Loan Status States**: `Draft`, `Active`, `Due`, `Overdue`, `Closed`, `Cancelled`.
* **Loan Workflow**: Gold Entry ➔ Loan Calculation ➔ Approve Loan ➔ Disburse Principal ➔ Generate Pawn Ticket.

### 51.6 Interest Management
* **Accrual Logic**: Dynamic daily interest calculations, monthly summaries, and history.
* **Interest Workflow**: System Cron ➔ Calculate Daily Interest ➔ Update Database Outstanding.

### 51.7 Payment Management
* **Log Payment**: Log Cash, UPI, or Card payments; split dynamically (Interest first, then Principal).
* **Payment Types**: Interest Payment, Principal Payment, Partial Settlement, Full Settlement.
* **Payment Workflow**: Log Payment ➔ Split Balance ➔ Update Loan ➔ Print Receipt ➔ Send WhatsApp Alert.

### 51.8 Customer Portal Navigation
* **App Workflow**: Login ➔ Dashboard ➔ Loan List ➔ Loan Details ➔ Gold Details ➔ Payment History ➔ PDF receipts ➔ Notifications ➔ Profile.

### 51.9 Automation Workflow
* **Updates Sync**: Admin Updates Loan ➔ Database Updates ➔ Outstanding Recalculated ➔ Client WebSocket Sync ➔ Push Notification ➔ WhatsApp Reminder ➔ Reports Updated.

### 51.10 Complete UI Pages (25 Screens Grid)
1. **Splash Screen** - PGF luxury golden emblem fade-in page.
2. **Welcome Screen** - Login router / user selection panel.
3. **Login Screen** - Single unified credentials form.
4. **Forgot Password Screen** - Mobile verification link request.
5. **OTP Verification Screen** - SMS/WhatsApp code entry dialog.
6. **Reset Password Screen** - Password reset interface.
7. **Admin Dashboard** - Financial analytics graphs and metric grid cards.
8. **Customer List View** - Searchable database logs of all clients.
9. **Customer Profile page** - Dynamic display of client details and active loans.
10. **Add/Edit Customer Form** - Client onboarding data sheets.
11. **Gold Entry Panel** - Appraisal weight-scale calculators.
12. **Loan Creation Wizard** - Terms definition and Pawn Ticket generation.
13. **Loan Details Screen** - Dynamic remaining balance splits.
14. **Payment Entry Screen** - Repayments ledger interface.
15. **Reports Dashboard** - Daily collection spreadsheets export panel.
16. **Notifications Panel** - Dispatched message history log.
17. **Settings Module** - Global configuration (Company, base gold rate, base APR).
18. **Customer Mobile Dashboard** - Simple touch metrics overlay.
19. **Customer Loan List** - borrowers active history index.
20. **Customer Loan Detail** - Accrued simple interest counter.
21. **Customer Gold Specs** - Grams weight details view.
22. **Customer Payment History** - Payments timeline records list.
23. **PDF Preview Modal** - In-app agreement viewer.
24. **Customer Notifications Inbox** - Push messages inbox drawer.
25. **Customer Profile Settings** - Password reset forms.

### 51.11 Future Features
* QR Code scanning on receipts, online payment gateway (UPI Integration), support chat, biometric login, dynamic gold valuation AI assistants, Multi-language support (English & Tamil), E-sign integration, and database backup restore wizard tools.

---

# Section 52: Enterprise-Level Detailed Core Modules & Billing Workflows

## 52.1 🏢 Admin Features & Workflows
* **Dashboard Overview**: Displays total active loans, closed loans, collections today/this month, gold values, and growth charts.
* **Customer Management**: Add/Edit/Delete profiles, captures digital signatures, webcam KYC capture, uploads IDs.
* **Gold Management**: Multi-jewelry appraisal calculating Gross, Stone, Net weights, purity check, and value caps.
* **Loan Management**: Autonumber generation, approval flows, extensions, partial gold release, and closures.
* **Interest Calculations**: Daily simple interest calculators, penalty interest rules, and outstanding trackers.
* **Payment & Billing Engine**: Clears interest balances first, then principal reduction; prints professional receipts.
* **Security & Audit Logs**: Captures every admin action (loan updates, settings changes, cancellations) with timestamps.

## 52.2 📱 Customer Mobile Features
* **Dashboard View**: Shows active loans, live outstanding balance ticker, due dates, and notification inbox.
* **Loan Details**: Detailed jewelry items specifications, weight data, and accrued interest counters.
* **Payment History**: Displays receipt numbers, payment modes, amounts, and remaining principal balances.
* **PDF Downloads**: Instant downloads of Loan Agreement PDFs, Payment Receipts, and Outstanding Statements.
* **Profile Settings**: View profile KYC, change portal passwords, and verify contact parameters.

## 52.3 💰 E2E Loan Management Lifecycle Workflow
1. **Registration & KYC**: Captures customer details, Webcam Photo, and Digital Canvas Signature.
2. **Gold Entry & Valuation**: Evaluates jewelry items, weighs gold, and uploads ornament photos.
3. **Appraisal & Loan Setup**: Auto-calculates loan cap limits, defines APR, and obtains approval.
4. **Activation**: Generates Pawn Ticket Agreement PDF, registers pledge, and disburses cash.
5. **Accrual**: Daily Scheduler calculates interest and updates remaining outstanding balances.
6. **Settlement**: Receives repayments, registers splits (Interest first, then Principal), and prints receipts.
7. **Closure & Release**: Closes active folder upon full repayment and releases vaulted gold collateral.

## 52.4 💳 Detailed Billing & Payment Calculations
* **Allocation Splits**: Allocates incoming cash to clear outstanding accrued interest before principal reduction.
* **Payment Types**: Interest Payment, Principal Payment, Partial Settlement, Full Settlement, Penalty Payment, Advance Payment.
* **Payment Modes**: Cash, UPI, Bank Transfer, Debit Card, Credit Card, Cheque, Demand Draft.
* **Bill Calculations**: Displays Principal Paid, Interest Paid, Penalty, Discounts/Waivers, Total Received, and Remaining Balances.

## 52.5 🔔 Smart Notification System
* **Events**: Loan Created, Payment Received, Interest Updated, 30/15/7/3/1 Day reminders, Due Today, Overdue alerts.
* **Channels**: Push Notifications, WhatsApp API templates, and SMS alerts.

## 52.6 📊 Reports & Spreadsheets
* **Generated Logs**: Daily/Monthly/Yearly Collection logs, Interest Reports, Due Reports, Active/Closed Loan lists.
* **Format Exports**: PDF rendering and CSV/Excel files.

## 52.7 🤖 System Automations
* Automatically calculates daily compound/simple interest, updates outstanding metrics, dispatches due reminders, compiles PDF documents, syncs customer mobile dashboards in real-time, backups database state, and records audit logs.

## 52.8 🔒 Security Architecture
* JWT authorization session monitoring, password encryptions, secure file storage vaults, daily cloud backups, session timeouts, and role-based permissions routing.

## 52.9 🎨 UI/UX Design System
* **Theme variables**: Luxury dark navy background (`#0a192f`), rich gold accents (`#d4af37`), card boxes (`#112240`), borders (`#1d2d44`), responsive layouts, and fast loading page templates.

---

# Section 53: Codebase Implementation Plan & Execution Summary

## 53.1 Technical Architecture
The system is built as a unified web application using Next.js (App Router), TypeScript, and Tailwind CSS (v4.0) for styling. Data persistence and authentication are handled through Supabase.

### Core Architecture Components:
1. **Next.js Client & Server**: Direct client wrappers communicate with Supabase using JWT session authorization.
2. **Supabase Postgres Engine**: Database constraints, table triggers, and Row-Level Security (RLS) policies.
3. **Server-Side PDF Compiler**: Runs dynamic PDF generation dynamically on demand using `pdfkit`.

---

## 53.2 Codebase Directory Layout Map

```text
d:\pc\
├── .env.local                              # Local database credentials
├── CODE_MAPPING_DIRECTORY.md               # Tracing maps connecting features to files
├── MASTER_REQUIREMENTS_DOCUMENT.md         # Consolidated master specifications
├── package.json                            # Package scripts and dependencies
├── src/
│   ├── app/
│   │   ├── layout.tsx                      # Root layout wrapper
│   │   ├── page.tsx                        # Unified login screen & bypass credentials
│   │   ├── admin/
│   │   │   ├── layout.tsx                  # Backoffice viewport layout wrapping sidebar
│   │   │   ├── billing/
│   │   │   │   └── page.tsx                # Billing engine dashboard & receipt poster
│   │   │   ├── customers/
│   │   │   │   ├── page.tsx                # Searchable client directory search list
│   │   │   │   ├── [id]/
│   │   │   │   │   └── page.tsx            # Customer detail dossier & active pledges
│   │   │   │   └── new/
│   │   │   │       └── page.tsx            # KYC onboarding with webcam & signature canvas
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx                # Analytics summary graphs and cards
│   │   │   ├── loans/
│   │   │   │   ├── page.tsx                # Filterable loan folders list
│   │   │   │   ├── [id]/
│   │   │   │   │   └── page.tsx            # Loan detail specs and timeline history
│   │   │   │   └── new/
│   │   │   │       └── page.tsx            # Gold appraisal calculator & pawn setup
│   │   │   ├── notifications/
│   │   │   │   └── page.tsx                # Operational alerts & updates inbox
│   │   │   ├── payments/
│   │   │   │   └── page.tsx                # Repayments registry entry log
│   │   │   ├── reports/
│   │   │   │   └── page.tsx                # Report cards grid spreadsheet exporter
│   │   │   └── settings/
│   │   │       └── page.tsx                # Company profiles & interest configurations
│   │   ├── api/
│   │   │   └── pdf/
│   │   │       └── route.ts                # Server PDF receipt renderer route
│   │   ├── auth/
│   │   │   ├── forgot-password/
│   │   │   │   └── page.tsx                # Reset request OTP trigger
│   │   │   ├── otp/
│   │   │   │   └── page.tsx                # 6-digit pin verification checker
│   │   │   └── reset-password/
│   │   │       └── page.tsx                # Security key password setter
│   │   └── customer/
│   │       ├── layout.tsx                  # Mobile bottom nav layout wrapper
│   │       ├── collateral/
│   │       │   └── page.tsx                # Secure vaults jewelry inventory list
│   │       ├── dashboard/
│   │       │   └── page.tsx                # Live interest ticker & balance dashboard
│   │       ├── loans/
│   │       │   ├── page.tsx                # Mobile client loan cards grid
│   │       │   ├── [id]/
│   │       │   │   └── page.tsx            # Mobile loan timeline & pdf receipt downloads
│   │       │   └── new/
│   │       ├── notifications/
│   │       │   └── page.tsx                # Mobile borrower notification updates feed
│   │       ├── payments/
│   │       │   └── page.tsx                # Mobile receipts archive list
│   │       └── profile/
│   │           └── page.tsx                # Security updates and password reset
│   ├── components/
│   │   ├── Sidebar.tsx                     # Backoffice left menu sidebar
│   │   └── CustomerNav.tsx                 # Mobile bottom navigation tab bar
│   └── lib/
│       └── supabase.ts                     # Database connection client configurations
└── supabase/
    └── migrations/
        └── 20260630_init_schema.sql        # Database schemas migration
```

---

## 53.3 Database Schema & RLS Setup
- **Profiles Table**: Isolates metadata and role permissions.
- **Loans Table**: Defines loan numbers, dates, terms, APR values, and state statuses.
- **Gold Collateral Table**: Records gross weights, stone weights, hallmarking details, and computed net weights.
- **Payments Table**: Tracks repayments, dates, receipt codes, and splits calculations.
- **Audit Logs Table**: Logs backoffice actions.
- **Row-Level Security (RLS)**: Enforces profiles filters so customers can only access their own active dossiers.

---

## 53.4 Local Testing & Build Compilation
1. **Verification Build**: Run `npm run build` to confirm compilation.
2. **Local Development Server**: Run `npm run dev` to start hot-reloading at `http://localhost:3000`.
3. **Bypass Testing Profiles**:
   - **Admin Portal**: Login with phone `9999999999` and password `admin123`.
   - **Customer Portal**: Login with phone `8888888888` and password `customer123`.
   - **OTP Verification Bypass**: Use code `123456`.
