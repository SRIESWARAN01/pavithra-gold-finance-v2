# 09. Operations & Analytics

---

## 39. Reports Planning

PGF requires three primary daily/monthly backoffice reports to ensure compliance and financial tracking:

### 39.1 Daily Transaction Closure Report
* **Purpose**: Reconcile cash-in-hand and digital account transfers with backend updates.
* **Fields**: Transaction ID, Customer Name, Loan Reference, Principal Paid, Interest Paid, Total Received, Mode, Appraiser ID.
* **Format**: Excel / PDF Export.

### 39.2 Interest Receivable Statement
* **Purpose**: Identify total interest accrued across active loans that has not yet been paid.
* **Fields**: Loan ID, Customer Name, Original Principal, Accrued Unpaid Interest, Days Outstanding, Target Maturity Date.

### 39.3 Default & Overdue Log
* **Purpose**: List loans that have breached their 365-day maturity limits and grace periods.
* **Fields**: Loan ID, Customer, Phone, Principal, Interest Accrued, Days Overdue, Collateral Specifications, Vault Storage Bin ID.

---

## 40. Analytics Dashboard (Admin View)

Analytics track business health through key performance metrics (KPIs):

* **Active Capital Deployment**: The total sum of outstanding loan principals currently disbursed to customers.
* **Average LTV Tracker**: The average Loan-to-Value ratio across the portfolio. A target average is maintained at $<65\%$ to safeguard against sudden gold price drops.
* **Monthly Yield Metrics**: Interest collected during the month divided by total outstanding principal, providing the true monthly yield percentage.
* **Operational Turnaround Time (TAT)**: The average time taken from customer profile creation to pawn ticket printing (Target: $<15$ minutes).

---

## 41. Performance Requirements

PGF must maintain quick response times to provide a smooth, professional user experience.

* **API Endpoints**: 95% of read operations must resolve in $<200$ms.
* **PDF Render Engine**: Server-side document rendering must complete and save to cloud storage in $<1.5$ seconds.
* **Real-time Synced Balance**: Changes to active loans must reflect on the Customer Portal dashboard in $<1$ second via WebSockets.
* **Mobile Efficiency**: Mobile layout pages must load on a standard 3G mobile connection in $<2.5$ seconds.

---

## 42. Backup Strategy

Data safety is critical to prevent loss of legal lending documents.

```
[PostgreSQL Database] ──(Continuous WAL Archiving)──> [Cloud Storage Archive]
          │
    (Daily Snaps) ──> [Encrypted Off-site Vault Backup]
```

1. **Continuous WAL Archiving**: Write-Ahead Logging (WAL) is streamed to secure cloud storage every 15 minutes, allowing Point-in-Time Recovery (PITR) down to the second.
2. **Daily Snapshot**: A full encrypted database backup is run automatically at **01:00 AM** and stored with a 30-day retention policy.
3. **Weekly Offsite Backup**: Encrypted exports are backed up offsite once a week to safeguard against primary datacenter failures.

---

## 43. Disaster Recovery (DR)

Our disaster recovery plan targets strict recovery goals:

* **Recovery Point Objective (RPO)**: **15 minutes** (maximum allowable data loss in case of complete hardware failure).
* **Recovery Time Objective (RTO)**: **2 hours** (maximum allowable system downtime before switching to secondary failover sites).

### 43.1 Failover Playbook
1. If the primary database goes offline, monitor health checks for 3 minutes.
2. If unresolved, automatically promote the hot-standby PostgreSQL read-replica to primary writer status.
3. Update API gateway routing rules to direct traffic to the active database.
4. Issue notifications to Admin alerting them of the failover.

---

## 44. Future Scope (Out of Scope for Phase 1)

These features are excluded from Phase 1 to focus on core stability, but the architecture will be designed to support them in future updates:

* **Online Repayment Integrations**: Integrated payment gateways (UPI, NetBanking) allowing customers to pay interest directly through their portal.
* **Multi-Branch Operations**: A multi-branch hierarchy mapping different branches and staff access levels to a central dashboard.
* **LTV Dynamic Re-valuation**: Integrating API feeds from gold market price databases to adjust LTV safety metrics dynamically.
