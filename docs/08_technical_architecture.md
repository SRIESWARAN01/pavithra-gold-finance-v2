# 08. Technical Architecture

---

## 34. Database Entity Planning (PostgreSQL Schema)

The PostgreSQL relational schema is structured to ensure ACID compliance and high integrity.

### 34.1 Table Schema Definitions

```sql
-- Enums Definitions
CREATE TYPE user_role AS ENUM ('Admin', 'Customer');
CREATE TYPE loan_status AS ENUM ('Draft', 'Active', 'Grace_Period', 'Defaulted', 'Auctioned', 'Settled');
CREATE TYPE payment_mode AS ENUM ('Cash', 'UPI', 'Bank_Transfer', 'Card');

-- 1. Users Table (Unified authentication storage)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    phone_primary VARCHAR(15) UNIQUE NOT NULL,
    phone_alt VARCHAR(15),
    address TEXT NOT NULL,
    national_id VARCHAR(12) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'Customer',
    status VARCHAR(20) NOT NULL DEFAULT 'Active',
    photo_url VARCHAR(255),
    signature_url VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Loans Table
CREATE TABLE loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    principal_amount NUMERIC(12, 2) NOT NULL CHECK (principal_amount > 0),
    interest_rate_apr NUMERIC(4, 2) NOT NULL CHECK (interest_rate_apr >= 0),
    status loan_status NOT NULL DEFAULT 'Draft',
    origination_date TIMESTAMP WITH TIME ZONE,
    maturity_date TIMESTAMP WITH TIME ZONE,
    grace_expiry_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Gold Collateral Table
CREATE TABLE gold_collateral (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID REFERENCES loans(id) ON DELETE CASCADE,
    item_description VARCHAR(255) NOT NULL,
    weight_grams NUMERIC(6, 2) NOT NULL CHECK (weight_grams > 0),
    purity_karat VARCHAR(3) NOT NULL CHECK (purity_karat IN ('18K', '22K', '24K')),
    valuation_inr NUMERIC(12, 2) NOT NULL,
    storage_bin_id VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Gold Photos Table
CREATE TABLE gold_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    collateral_id UUID REFERENCES gold_collateral(id) ON DELETE CASCADE,
    photo_url VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Payments Table
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID REFERENCES loans(id) ON DELETE RESTRICT,
    amount_paid NUMERIC(12, 2) NOT NULL CHECK (amount_paid > 0),
    interest_portion NUMERIC(12, 2) NOT NULL,
    principal_portion NUMERIC(12, 2) NOT NULL,
    payment_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    mode payment_mode NOT NULL,
    receipt_pdf_url VARCHAR(255),
    remarks TEXT
);

-- 6. Audit Logs Table
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action_type VARCHAR(100) NOT NULL,
    affected_entity VARCHAR(50) NOT NULL,
    affected_entity_id UUID NOT NULL,
    old_state JSONB,
    new_state JSONB,
    ip_address VARCHAR(45),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

### 34.2 Essential Indexes
* `CREATE INDEX idx_users_phone ON users(phone_primary);`
* `CREATE INDEX idx_loans_customer ON loans(customer_id);`
* `CREATE INDEX idx_loans_status ON loans(status);`
* `CREATE INDEX idx_payments_loan ON payments(loan_id);`

---

## 35. API Planning (Node.js & Express Endpoints)

All request body payloads require content-type `application/json`. Authenticated routes require bearer authentication tokens passed via secure HTTP-only cookies.

### 35.1 Authentication API
#### POST `/api/auth/login`
* **Purpose**: Authenticates credentials and returns a signed JWT.
* **Request**:
  ```json
  {
    "phone": "+919876543210",
    "password": "SecurePassword123"
  }
  ```
* **Response (Success)**: Set-Cookie: `token=JWT_VALUE; HttpOnly; Secure; SameSite=Strict`
  ```json
  {
    "success": true,
    "user": {
      "name": "Rajasekar Sundaram",
      "role": "Admin"
    }
  }
  ```

---

### 35.2 Admin Customer API
#### POST `/api/admin/customers`
* **Purpose**: Onboard customer profile.
* **Request**:
  ```json
  {
    "name": "Priya Vignesh",
    "phone_primary": "+919998887776",
    "phone_alt": "+919998887775",
    "address": "45, Temple Street, Madurai",
    "national_id": "123456789012",
    "photo_base64": "data:image/jpeg;base64,...",
    "signature_base64": "data:image/png;base64,..."
  }
  ```
* **Response (Success)**:
  ```json
  {
    "success": true,
    "customer_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d"
  }
  ```

---

### 35.3 Admin Loan & Appraisals API
#### POST `/api/admin/loans`
* **Purpose**: Originates a loan record.
* **Request**:
  ```json
  {
    "customer_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "principal": 150000.00,
    "apr": 12.00,
    "collateral": [
      {
        "description": "Gold Chain",
        "weight": 42.50,
        "purity": "22K",
        "valuation": 210000.00,
        "storage_bin": "BIN-A12",
        "photos": ["data:image/jpeg;base64,..."]
      }
    ]
  }
  ```
* **Response (Success)**:
  ```json
  {
    "success": true,
    "loan_id": "ee35f79a-e18e-49b0-9dbd-0211d293ad9d",
    "pawn_ticket_url": "https://storage.googleapis.com/pgf-docs/tickets/ticket_ee35f79a.pdf"
  }
  ```

---

## 36. File Storage Planning

Secure, encrypted Cloud Storage (such as Amazon S3 or Google Cloud Storage) is required to hold all visual profile items and generated documents.

### 36.1 Bucket Structures & Lifecycle
* **Bucket Name**: `pgf-secure-assets`
* **Folder Hierarchy**:
  * `/customers/photos/` - Stores customer verification portraits. Access restricted to Admin only.
  * `/customers/signatures/` - Customer electronic signature vectors. Access restricted.
  * `/collaterals/photos/` - Itemized images of gold ornaments. Accessible by linked Customer and Admin.
  * `/documents/tickets/` - Generated Pawn Ticket PDFs.
  * `/documents/receipts/` - Payment transactions receipt documents.

---

## 37. Notification Planning (Trigger Templates)

The notification system uses standard triggers connected to third-party SMS, FCM, and WhatsApp APIs.

```
+--------------------------------------------------------------------------+
| TRIGGER EVENT            | PAYLOAD CONTENT                               |
+--------------------------------------------------------------------------+
| New Payment Registered   | - Contact: primary_phone                      |
|                          | - Message: "Payment Received: [Amount] INR.   |
|                          |   Remaining Principal: [Balance] INR."        |
+--------------------------------------------------------------------------+
| Overdue Reminder         | - Contact: primary_phone                      |
|                          | - Message: "URGENT: Loan [ID] is overdue.     |
|                          |   Total due: [Amount] INR. Pay immediately."  |
+--------------------------------------------------------------------------+
```

---

## 38. Audit Logs

Audit log entries are completely immutable in the PostgreSQL database. They trace all actions performed by the Admin to prevent backoffice fraud:
1. **Target Action Captured**: Any customer edit, loan creation, payment entry, or status update.
2. **Payload Stored**: Logs capture both the `old_state` and `new_state` as JSONB blobs.
3. **Trace Parameters**: IP address, User Agent, Actor ID, and Timestamp.
