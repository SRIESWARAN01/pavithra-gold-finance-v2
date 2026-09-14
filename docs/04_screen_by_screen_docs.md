# 04. Screen-by-Screen Documentation

---

## 12. Screen-by-Screen Documentation

This section details the layout, components, interactive controls, interface states, and backend logic for every screen in the Pavithra Gold Finance (PGF) system.

---

### SCREEN 1: Unified Login Screen

#### 12.1.1 Purpose
A single entry point for both Admin and Customer users. It authenticates credentials and routes the user to the correct dashboard based on role claims.

#### 12.1.2 Layout & Structure
* **Layout**: Split-screen design (desktop) and centered single-column card (mobile).
  * **Left Side (Desktop)**: Aesthetic brand asset showing a premium gold rendering (generated asset) with the message: *"Secure. Transparent. Luxury Gold Finance."*
  * **Right Side (Desktop) / Full Screen (Mobile)**: Clean, high-end login card with dark navy background (`#0A192F`), white forms, and gold accents (`#D4AF37`).

#### 12.1.3 Interface Components & Controls
* **Cards**: Core login container card with smooth border-radius, soft gold border-glow, and micro-shadow.
* **Forms**:
  * Phone Number field with country code prefix selector (`+91` by default).
  * Password field with toggle visibility icon (Lucide Eye/EyeOff).
* **Buttons**:
  * `Sign In` button: Gold background with dark navy text, featuring smooth scale hover-effects.

#### 12.1.4 UI States
* **Loading State**: The "Sign In" text is replaced by a custom rotating gold spinner, and form fields are set to `disabled`.
* **Empty State**: Highlight empty inputs with subtle red boundaries if the user submits without values.
* **Error State**: Displays a red-bordered banner: *"Invalid phone number or password. Please try again."*
* **Success State**: Displays a gold checkmark animation before immediate redirect.

#### 12.1.5 Navigation Paths
* **On Submit Success**:
  * Role = `Admin` ➔ Redirects to `/(admin)/dashboard`
  * Role = `Customer` ➔ Redirects to `/(customer)/dashboard`

#### 12.1.6 Business Logic & Validation Rules
* **Validation**:
  * Phone Number must contain exactly 10 numeric digits.
  * Password cannot be empty and must be checked against PostgreSQL hashes using bcrypt.
* **Security Rules**: Limit failed attempts to 5 within a 15-minute window per IP to block brute-force attacks.

---

### SCREEN 2: Admin Dashboard

#### 12.2.1 Purpose
Provides the business owner with a birds-eye overview of the enterprise: total gold pawned, loan volumes, outstanding balances, upcoming dues, and customer activity.

#### 12.2.2 Layout & Structure
* **Layout**: Dashboard layout with left-hand sidebar navigation, top global search bar, main statistics grid, and two-column data layout below.
* **Aesthetics**: Premium dark theme dashboard with white data cards, crisp text, and gold summary lines.

#### 12.2.3 Interface Components & Controls
* **Metric Cards**: Four statistics cards at the top:
  1. *Total Active Loans* (count & valuation in INR)
  2. *Total Collateral Weight* (in grams)
  3. *Expected Interest Inflow* (accrued, unpaid)
  4. *Default Danger Zone* (count of overdue loans)
* **Global Search Box**: Input field to search customers by Name, Phone Number, or Loan ID.
* **Tables**: 
  * "Recent Transactions Ledger": Columns for Customer, Loan ID, Amount, Type (Principal/Interest), and Timestamp.
  * "Approaching Due Dates": Columns for Customer, Loan ID, Target Date, Outstanding Interest, and Action.
* **Buttons**:
  * `Onboard New Customer` (Primary CTA)
  * `Appraise & Issue Loan` (Secondary CTA)

#### 12.2.4 UI States
* **Loading State**: Skeleton components replace the Metric Cards and Tables with a shimmering effect.
* **Empty State**: If no transactions exist, displays: *"No recent transactions registered today."*
* **Error State**: Displays: *"Failed to fetch dashboard metrics. Check database connection."*
* **Success State**: Display a dynamic badge *"Sync active"* indicating live WebSocket connections.

#### 12.2.5 Navigation Paths
* Click `Onboard New Customer` ➔ Routes to `/(admin)/customers/new`
* Click a customer name in the table ➔ Routes to `/(admin)/customers/[id]`
* Click `Settings` in sidebar ➔ Routes to `/(admin)/settings`

#### 12.2.6 Business Logic & Validation Rules
* **Live Calculation**: The metrics must auto-refresh every 60 seconds or immediately upon receiving a WebSocket transaction event.

---

### SCREEN 3: Admin Customer Onboarding & Profile Screen

#### 12.3.1 Purpose
Facilitates complete customer profiling, including capturing live facial images, signing documents digitally, and storing contact parameters.

#### 12.3.2 Layout & Structure
* **Layout**: Two-column layout.
  * **Left Column**: Form input sections (Personal details, Address, KYC details).
  * **Right Column**: Camera integration card and digital signature canvas box.

#### 12.3.3 Interface Components & Controls
* **Forms**:
  * Input fields: Full Name, Primary Mobile, Alternative Mobile, Residential Address, National ID Number (Aadhaar/PAN).
* **Webcam Integration Card**: Frame with a `Capture Photo` button. Shows live camera preview and freezes on click to display the captured frame.
* **Signature Pad**: HTML5 canvas element with `Clear` and `Save Signature` controls.
* **Buttons**:
  * `Save Customer Profile` (Primary CTA)
  * `Cancel`

#### 12.3.4 UI States
* **Loading State**: Form buttons show spinner state during file upload to Cloud Storage.
* **Empty State**: Camera shows default silhouette SVG if no camera is connected.
* **Error State**: *"Camera permission denied. Enable browser access."* or *"Aadhaar validation failed. Must be 12 digits."*
* **Success State**: Redirect to profile view with a toast notification: *"Customer onboarded successfully."*

#### 12.3.5 Navigation Paths
* Click `Save Customer Profile` ➔ On success, redirects to customer detailed view `/(admin)/customers/[id]`.
* Click `Cancel` ➔ Returns to previous dashboard.

#### 12.3.6 Business Logic & Validation Rules
* **Data Validations**:
  * Primary mobile cannot equal alternative mobile.
  * Capturing the webcam photo and signature are **compulsory** before submitting. Profiles cannot be created without these legal artifacts.

---

### SCREEN 4: Admin Gold Appraisal & Loan Origination Screen

#### 12.4.1 Purpose
A specialized loan creation panel where the Admin records physical gold characteristics, uploads item photos, defines loan terms, and starts the loan.

#### 12.4.2 Layout & Structure
* **Layout**: Multistep Wizard Layout (Step 1: Select/Verify Customer, Step 2: Gold Valuation, Step 3: Loan Parameters, Step 4: Summary & Ticket Print).

#### 12.4.3 Interface Components & Controls
* **Forms**:
  * Gold Item Name input (e.g., "Gold Bangles - Pair")
  * Weight input (in grams, accepts floating numbers, e.g., 24.55g)
  * Purity dropdown: `18 Karat`, `22 Karat`, `24 Karat`
  * Photo Upload component: Supports drag-and-drop of multiple files or mobile photo upload.
  * Principal Loan Amount field (in INR)
  * Interest Rate field (APR percentage, defaults to base settings)
* **Cards**: Summary Card showing calculations: *Loan-to-Value (LTV) Ratio, Max borrowing eligibility based on weight, Daily interest accrual amount.*
* **Buttons**:
  * `Add Another Gold Item`
  * `Create Loan & Generate Pawn Ticket`

#### 12.4.4 UI States
* **Loading State**: Shows full-screen modal blocking user interactions while the backend generates the Pawn Ticket PDF and registers database transactions.
* **Validation States**: Highlight fields in red with real-time warnings (e.g., if LTV exceeds 75% of current market value, display: *"Warning: Loan amount exceeds safe LTV guidelines"*).

#### 12.4.5 Navigation Paths
* On Success: Downloads PDF Pawn Ticket and displays confirmation dialog: *"Loan Active. Send notification to Customer?"* with option to trigger WhatsApp dispatch.

#### 12.4.6 Business Logic & Validation Rules
* **Appraisal Rules**:
  * Gold weight must be greater than 0.
  * Interest Rate cannot be set lower than 6% or higher than 36% APR.

---

### SCREEN 5: Admin Repayment Registry Screen

#### 12.5.1 Purpose
Used by the Admin to register in-person payments, compute balance splits, and print receipts.

#### 12.5.2 Layout & Structure
* **Layout**: Focused single-column registry panel with current balance card on top and repayment form below.

#### 12.5.3 Interface Components & Controls
* **Current Balance Card**: Displays active loan amount, interest accrued since last payment, and total outstanding balance.
* **Forms**:
  * Amount Paid field (INR)
  * Payment Mode dropdown: `Cash`, `UPI/Bank Transfer`, `Card`
  * Payment Remarks (optional note input)
* **Payment Split Preview Table**: Real-time breakdown:
  * *Interest Cleared*: X.XX INR
  * *Principal Cleared*: Y.YY INR
  * *New Remaining Principal*: Z.ZZ INR
* **Buttons**:
  * `Register Payment & Issue Receipt`

#### 12.5.4 UI States
* **Validation States**: If the payment amount exceeds the total outstanding loan balance, block transaction and display warning message.

#### 12.5.5 Navigation Paths
* On submit, generates payment receipt PDF and returns to Loan Details page `/(admin)/loans/[id]`.

---

### SCREEN 6: Customer Mobile Dashboard (Mobile-First)

#### 12.6.1 Purpose
The borrower's portal. Shows real-time loan details, total money owed, gold items held, and active due dates with a luxury theme.

#### 12.6.2 Layout & Structure
* **Layout**: Single-column vertical scroll. Sticky header showing PGF brand logo. Bottom navigation bar (Dashboard, Collateral, Payments, Profile).
* **Theme**: Deep Navy background (`#0A192F`), gold gradients on metrics cards, white text for numbers.

#### 12.6.3 Interface Components & Controls
* **Outstanding Hero Card**: Large gold-gradient container displaying total outstanding balance (auto-increments in real-time) and upcoming due date in bold typography.
* **Active Loans Accordion List**: Expands to show details of individual active loans.
* **Notification Banner**: Alert strip on top if any loan is near the 30-day/15-day/etc. overdue threshold.
* **Buttons**:
  * `View Collateral`
  * `Download Pawn Tickets`

#### 12.6.4 UI States
* **Loading State**: Shimmer animations over metrics cards.
* **Empty State**: If user has no active loans: *"No active loans found. Visit branch to initiate pledge."*

#### 12.6.5 Navigation Paths
* Bottom Navigation: Dashboard, Collateral list, Payments history, Settings.

#### 12.6.6 Business Logic & Validation Rules
* **WebSocket Sync**: Customer dashboard state listens to WebSockets. If Admin records a payment in-branch, the dashboard counts down and displays a toast message: *"Payment of Rs. X registered. Dashboard updated."*

---

### SCREEN 7: Customer Active Loans & Collateral Detail Screen

#### 12.7.1 Purpose
Displays specifications and high-resolution images of the customer's gold collateral items.

#### 12.7.2 Layout & Structure
* **Layout**: Card grid showing collateral items. Clicking an item opens a full-screen image viewer modal.

#### 12.7.3 Interface Components & Controls
* **Collateral Card**: Displays the gold item name, weight (grams), karat purity, and primary thumbnail image.
* **Image Carousel**: Swipeable image gallery within the card for viewing multiple angles.
* **Audit Spec List**: Table detailing appraised valuation, date deposited, and secure locker allocation code.
* **Buttons**:
  * `Download Condition Report PDF`

#### 12.7.4 UI States
* **Empty State**: *"No active collateral items registered under this account."*

---

### SCREEN 8: Customer Repayments & Receipt Archive Screen

#### 12.8.1 Purpose
A complete financial record of all payments made, with options to download historical receipts.

#### 12.8.2 Layout & Structure
* **Layout**: Vertical timeline list showing transactions from newest to oldest.

#### 12.8.3 Interface Components & Controls
* **Timeline Cards**: Show transaction date, transaction reference, amount paid, and allocation split.
* **Buttons**:
  * `Download Receipt PDF` (Lucide Download icon)

#### 12.8.4 UI States
* **Empty State**: *"No payments logged yet."*
