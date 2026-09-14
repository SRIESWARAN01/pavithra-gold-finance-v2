# 07. Logic, Rules & Validation

---

## 29. Error Handling Schema

To maintain high availability and user trust, the application enforces a strict, structured error response standard. Every server exception returns a standard JSON envelope:

```json
{
  "success": false,
  "error": {
    "code": "ERR_CODE_HEX",
    "message": "Human readable error description",
    "recovery": "Actionable instructions for recovery"
  }
}
```

### 29.1 Standard System Exceptions
| Error Code | HTTP Status | Description | Recovery Action |
|---|---|---|---|
| **ERR_AUTH_01** | 401 | JWT Token Expired / Invalid | Redirect user to unified login screen. |
| **ERR_VAL_01** | 400 | Form Field Input Constraint Violated | Display field-specific validation warnings in Red. |
| **ERR_LTV_02** | 400 | Principal Exceeds Maximum LTV Allowance | Block submit; prompt Admin to lower principal or add gold weight. |
| **ERR_PAY_03** | 400 | Payment Amount Exceeds Total Outstanding | Limit input amount to total outstanding. |
| **ERR_SYS_99** | 500 | Database connection timeout or crash | Display global maintenance overlay; auto-retry request in 5s. |

---

## 30. Validation Rules Matrix

These rules run on the client-side (Next.js forms) and are re-validated on the backend (Express routes) before database persistence.

| Form Parameter | Data Type | UI Validation Rule | Database Constraint |
|---|---|---|---|
| **Customer Name** | String | 3 to 100 characters. Letters and spaces only. | `VARCHAR(100) NOT NULL` |
| **Mobile Number** | String | Regex: `^[6-9]\d{9}$` (Valid Indian Mobile). | `VARCHAR(15) UNIQUE NOT NULL` |
| **National ID** | String | Regex: `^\d{12}$` (Aadhaar Card). | `VARCHAR(12) UNIQUE NOT NULL` |
| **Gold Weight** | Decimal | Scale: 2 decimal places. Must be $>0.00g$ and $<5000.00g$. | `NUMERIC(6,2) NOT NULL` |
| **Gold Purity** | Enum | Must select `18K`, `22K`, or `24K`. | `VARCHAR(3) NOT NULL` |
| **Principal Amount**| Decimal | Must be $>1,000$ INR and $<10,000,000$ INR. | `NUMERIC(12,2) NOT NULL` |
| **Interest Rate** | Decimal | APR: $>6.00\%$ and $<36.00\%$. | `NUMERIC(4,2) NOT NULL` |

---

## 31. Edge Cases

Detailed handling strategies for boundary anomalies.

### 31.1 Dual Repayments on the Same Day
* **Scenario**: A customer makes a payment in the morning and another payment in the evening of the same calendar day.
* **Logic**: The daily interest is calculated *once* for the day based on the morning's opening principal balance. The first payment clears the accrued interest first and reduces principal. The second payment registered on the same day accrues $0$ additional interest, meaning 100% of the second payment directly reduces the remaining principal.

### 31.2 Leap Year Calculations
* **Scenario**: Interest calculations running across a leap year (e.g., 2028).
* **Logic**: To maintain mathematical parity, the system calculates daily interest with a dynamic denominator based on the calendar year of the accrual day. If the current year has 366 days, the daily accrual denominator is set to 366 instead of 365.

### 31.3 Loan Maturity Holiday
* **Scenario**: The target maturity date (365 days from origination) lands on a national bank holiday or a weekend when the physical vault branch is closed.
* **Logic**: The system automatically extends the maturity date and the start of the defaulted collection grace period to the next active business day. No late penalties are accrued during these holiday days.

---

## 32. Business Rules

These rules dictate structural financial operations and cannot be modified without database administrative settings override.

1. **LTV Cap**: The maximum Principal Loan Amount is capped at **75%** of the appraised gold value.
2. **Interest Accrual Threshold**: Interest accrues daily starting exactly at **12:00 AM (Midnight)** on the day following loan creation.
3. **Auction Trigger**: If a loan remains in `Defaulted` state for more than **90 calendar days**, the system flags the collateral gold as `Eligible for Auction` and locks customer access.
4. **Signature Matching**: Every payment settlement or gold release requires a verified digital signature matching the original onboarding signature.

---

## 33. Data Relationships (Entity-Relationship Planning)

PGF operates on a unified relational database layout. Below are the cardinal relationships between entities:

```
[Customer] 1 ─────── 0..* [Loan]
   │                          │
   │ 1                        │ 1
   ▼                          ▼
[Signature] 1            [Gold Collateral] 1..*
                              │
                              ▼
                         [Gold Photo] 1..*

[Loan] 1 ─────── 0..* [Payment]
   │
   └──────────── 0..* [Audit Log]
```

### 33.1 Relational Cascades
* **Customer Deletion**: Blocked if the customer has any active or unpaid loans (`ON DELETE RESTRICT`).
* **Loan Deletion**: Soft-deleted only. The historical record must remain in the database for auditing purposes.
* **Gold Collateral Deletion**: Restrained if linked to an active loan.
