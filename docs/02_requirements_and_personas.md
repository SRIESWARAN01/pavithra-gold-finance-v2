# 02. Requirements & Personas

---

## 5. Functional Requirements

Functional requirements define the core operational capabilities of Pavithra Gold Finance. They are structured into modules based on user privilege and core workflows.

### 5.1 Admin Portal Module (FR-ADM)

* **FR-ADM-01: Customer Management**
  * **Onboarding**: Ability to create a customer profile with name, email, mobile phone number (primary contact for notifications), alternative phone number, address, and upload of national identity document.
  * **Profile Media Capture**: Native integration with webcam or device camera to take a real-time Customer Photo and save it directly to the customer profile.
  * **Digital Signature**: Integration of a digital signature pad interface for the customer to sign documents directly on a tablet, touch-screen device, or using a mouse on desktop.
  * **Status Management**: Set user status as `Active`, `Suspended` (due to defaulted payment or investigation), or `Closed`.

* **FR-ADM-02: Gold Collateral Management**
  * **Asset Registration**: Log gold ornaments associated with a loan.
  * **Appraisal Details**: Input parameters: Item Description (e.g., Gold Chain, Ring, Bangles), Weight (in grams, up to 2 decimal places), Purity (18K, 22K, 24K), and appraisal notes.
  * **Visual Proof**: Interface to upload multiple high-resolution photos of the gold items to serve as a legal condition report.

* **FR-ADM-03: Loan Lifecycle Management**
  * **Loan Origination**: Create a loan record linked to a customer and physical gold assets.
  * **Financial Terms**: Input Principal Amount, Custom Interest Rate (annual percentage rate, APR), Loan Duration (default: 1 year/365 days), and compounding frequencies (monthly, simple, etc.).
  * **Status Tracker**: Track loan states: `Draft`, `Active`, `Grace Period`, `Defaulted`, `Auctioned`, and `Settled`.
  * **Documentation**: Generate and store the signed digital Pawn Ticket (Receipt of Pledge) as a secure PDF.

* **FR-ADM-04: Payment & Account Settlement**
  * **Payment Log**: Manually record payments made in-person (Cash, Bank Transfer, Card).
  * **Split Allocation**: Payments are automatically split: First, they settle outstanding interest accrued; the remainder is allocated to principal reduction.
  * **Settlement Invoices**: Instantly generate and save PDF invoices for every payment logged, detailing remaining principal and interest balance.

* **FR-ADM-05: Real-time Notification Engine**
  * **Alert Settings**: Configure thresholds for automated alerts.
  * **Manual Broadcast**: Ability to trigger manual WhatsApp, SMS, or Push notifications directly to specific customers for immediate action.

---

### 5.2 Customer Portal Module (FR-CST)

* **FR-CST-01: Secure Client Onboarding & Authentication**
  * **Identity Verification**: Login via mobile number and password verified with secure JWT tokens stored in HTTP-Only cookies.

* **FR-CST-02: Loan & Collateral Dashboard**
  * **Overview**: Real-time display of total outstanding balance, principal loan amount, interest accrued, interest rate, and target due date.
  * **Collateral Review**: View high-resolution photos of the gold items deposited as collateral, along with official weight and karat specifications.
  * **Dynamic Calculations**: Outstanding amount must auto-increment based on daily accrued interest to ensure absolute visual transparency.

* **FR-CST-03: Financial History & Document Download**
  * **Payment Audit Trail**: Interactive table listing all logged payments, payment modes, amounts, dates, and split allocations.
  * **PDF Exporter**: Direct buttons to download the original Loan Pawn Ticket and all subsequent payment receipts.

* **FR-CST-04: Notification Inbox**
  * **Push logs**: In-app tray storing a history of push alerts received regarding payment due dates and policy updates.

---

## 6. Non-Functional Requirements (NFR)

Non-functional requirements describe system quality attributes, security constraints, and compliance requirements.

| NFR ID | Category | Target / Requirement | Description |
|---|---|---|---|
| **NFR-SEC-01** | Security | **HTTPS & SSL/TLS** | All client-server communications must use TLS 1.3 encryption. |
| **NFR-SEC-02** | Security | **JWT Expiry & Storage** | JWT tokens must expire in 2 hours for Admin and 7 days for Customers. Store Admin tokens strictly in `httpOnly` secure cookies. |
| **NFR-SEC-03** | Security | **Data Encryption at Rest** | PostgreSQL database files and cloud storage assets must be encrypted using AES-256. |
| **NFR-PER-01** | Performance | **Response Time < 200ms** | 95% of read API requests must return response payloads within 200ms. |
| **NFR-PER-02** | Performance | **Sync Latency < 1s** | Updates to loan balances or payment status made by Admin must reflect on Customer portals within 1 second using WebSockets. |
| **NFR-AVL-01** | Availability | **99.9% Uptime** | Maximum allowable unscheduled downtime is 8.76 hours per calendar year. |
| **NFR-RSP-01** | Design | **Mobile Responsiveness** | Customer Portal must achieve a Google PageSpeed mobile score of >90. |

---

## 7. User Personas

Detailed personas modeling the two main groups interacting with the PGF application.

### Persona 1: The Administrator

```
+-----------------------------------------------------------+
| NAME: Rajasekar Sundaram                                  |
| ROLE: Business Owner & Chief Appraiser (Admin)            |
| AGE: 48                                                   |
| TECH LITERACY: Moderate                                   |
| GOAL: Streamline lending, prevent fraud, maximize recovery|
+-----------------------------------------------------------+
```

* **Background**: Rajasekar has owned a jewelry store and pawnbroking business for 20 years. He is accustomed to ledger entries and is wary of digital systems failing him or exposing business data.
* **Motivations**:
  * Safeguarding physical inventory (gold) and matching it exactly with ledger records.
  * Reducing the time spent manually calculating interest compound periods.
  * Eliminating customer disputes regarding the weight of gold pawned or the interest rate agreed upon.
* **Pain Points**:
  * Customers forgetting due dates, resulting in high defaulted loan portfolios that require auctioning gold.
  * Inaccuracies in daily ledger calculations.
  * Staff time wasted on producing manual paper receipts.

---

### Persona 2: The Customer

```
+-----------------------------------------------------------+
| NAME: Priya Vignesh                                       |
| ROLE: Small Business Owner / Borrower (Customer)          |
| AGE: 34                                                   |
| TECH LITERACY: High (Mobile-first)                        |
| GOAL: Fast liquidity, transparent interest, safe retrieval|
+-----------------------------------------------------------+
```

* **Background**: Priya runs a boutique apparel store. She pawns gold jewelry to cover seasonal cash flow gaps. She uses a smartphone for all business payments and banking transactions.
* **Motivations**:
  * Ensuring her precious family gold is safe and documented accurately with high-resolution photos.
  * Tracking daily interest changes so she can pay it off the moment her sales clear.
  * Avoiding long queues or phone calls just to check how much she owes.
* **Pain Points**:
  * Fear of hidden charges or incorrect calculation of grace periods.
  * Losing physical paper receipts, making it hard to prove ownership or track past payments.
  * Forgetting payment deadlines and paying compounding penalties.

---

## 8. User Journey

This section highlights the chronological experience mapping for the customer and the admin.

### 8.1 Customer Onboarding & Loan Lifecycle Journey

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Priya (Customer)
    actor Admin as Rajasekar (Admin)
    
    Note over Customer, Admin: Phase 1: Onboarding & Gold Deposit
    Customer->>Admin: Physical visit with Gold Items & Identity Doc
    Admin->>Admin: Appraises gold weight, purity & takes photos
    Admin->>Admin: Creates Customer Profile & takes Photo/Signature
    Admin->>Admin: Sets up Loan and generates Pawn Ticket PDF
    Admin-->>Customer: Invites Customer & Sends PDF to WhatsApp
    
    Note over Customer, Admin: Phase 2: Active Monitoring
    Customer->>Customer: Logs into PGF Mobile Portal using JWT Cookie
    Customer->>Customer: Monitors daily outstanding balance and due date
    
    Note over Customer, Admin: Phase 3: Payment & Redelivery
    Customer->>Admin: Visits branch to pay interest/principal
    Admin->>Admin: Registers Payment; splits balance dynamically
    Admin-->>Customer: Immediately pushes updated balance to portal & sends PDF Receipt
    Customer->>Admin: Final Settlement; retrieves physical gold
    Admin->>Admin: Marks Loan as Settled; updates database state
```

1. **Onboarding**: The customer presents jewelry to the appraiser. The appraiser uses the Admin Portal to record gold weight, purity, capture structural images, and log customer signature.
2. **Monitoring**: The customer receives login credentials and checks their portal regularly. They see their gold ornaments, outstanding interest details, and payment histories.
3. **Repayment**: The customer pays interest installments. The Admin updates the balance. The system instantly notifies the customer via WhatsApp and syncs the customer dashboard.
4. **Loan Closure**: The customer settles the final principal balance, signs the digital gold-retrieval confirmation, and gets their gold back. The loan status is updated to `Settled` in the database.
