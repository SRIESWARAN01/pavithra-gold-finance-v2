// src/types/database.ts
// Shared TypeScript interfaces mirroring every Firebase Firestore collection.
// All pages and data access functions import from here.

// ============================================================================
// Enums (matching PostgreSQL enum types)
// ============================================================================

export type UserRole =
  | 'Admin'
  | 'Customer'
  | 'Employee'
  | 'Owner'
  | 'Manager'
  | 'Appraiser'
  | 'Cashier'
  | 'Accountant'
  | 'Collection_Officer'
  | 'Customer_Support';

export interface Branch {
  id: string;
  name: string;
  code: string;
  address: string;
  phone: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BranchInsert {
  name: string;
  code: string;
  address: string;
  phone: string;
  is_active?: boolean;
}

export interface BranchUpdate {
  name?: string;
  code?: string;
  address?: string;
  phone?: string;
  is_active?: boolean;
}

export type LoanStatus =
  | 'Draft'
  | 'Pending_Approval'
  | 'Active'
  | 'Due'
  | 'Overdue'
  | 'Grace_Period'
  | 'Defaulted'
  | 'Auctioned'
  | 'Settled'
  | 'Cancelled'
  | 'Rejected';

export type PaymentMode =
  | 'Cash'
  | 'UPI'
  | 'Bank_Transfer'
  | 'Card'
  | 'Debit_Card'
  | 'Credit_Card'
  | 'Cheque'
  | 'Demand_Draft';

export type PaymentType =
  | 'Interest'
  | 'Principal'
  | 'Partial_Settlement'
  | 'Full_Settlement'
  | 'Penalty'
  | 'Advance';

export type NotificationChannel = 'SMS' | 'WhatsApp' | 'Push' | 'Email' | 'In_App';

export type NotificationType =
  | 'Loan_Created'
  | 'Payment_Received'
  | 'Interest_Updated'
  | 'Due_Reminder'
  | 'Overdue_Alert'
  | 'Loan_Closed'
  | 'Welcome'
  | 'System';

export type DocumentType =
  | 'Pawn_Ticket'
  | 'Payment_Receipt'
  | 'Loan_Agreement'
  | 'Outstanding_Statement'
  | 'Collection_Report'
  | 'Customer_Statement';

export type SettingsCategory = 'Company' | 'Loan' | 'Gold' | 'Notification' | 'System';

export type GoldPurity = '18K' | '21K' | '22K' | '24K';

export type Gender = 'Male' | 'Female' | 'Other';

export type MaritalStatus = 'Single' | 'Married' | 'Widowed' | 'Divorced';

export type KycStatus = 'Pending' | 'Submitted' | 'Under_Review' | 'Approved' | 'Rejected' | 'Expired';

export type CustomerStatus = 'Active' | 'Inactive' | 'Blocked' | 'Deleted';

// ============================================================================
// Table Interfaces
// ============================================================================

/** User profile — linked to Firebase Auth user via UID */
export interface Profile {
  id: string;
  name: string;
  phone_primary: string;
  phone_alt: string | null;
  email: string | null;
  date_of_birth: string | null;
  gender: Gender | null;
  marital_status: MaritalStatus | null;
  address: string;
  national_id: string;
  pan_number: string | null;
  city: string | null;
  district: string | null;
  state: string | null;
  pin_code: string | null;
  occupation: string | null;
  monthly_income: number | null;
  reference_person: string | null;
  reference_phone: string | null;
  role: UserRole;
  status: string;
  customer_number: string | null;
  photo_url: string | null;
  signature_url: string | null;
  aadhaar_front_url: string | null;
  aadhaar_back_url: string | null;
  pan_url: string | null;
  voter_id_url: string | null;
  driving_license_url: string | null;
  passport_url: string | null;
  branch_id: string | null;
  is_2fa_enabled: boolean;
  two_factor_secret: string | null;
  two_factor_temp_secret?: string | null;
  last_login_at?: string | null;
  login_ip?: string | null;
  device_info?: string | null;
  nominee_name: string | null;
  nominee_relation: string | null;
  nominee_mobile: string | null;
  face_match_score: number | null;
  kyc_expiry_date: string | null;
  kyc_status: KycStatus | null;
  kyc_approved_by: string | null;
  kyc_approved_at: string | null;
  kyc_rejection_reason: string | null;
  tags: string[];
  blocked_at: string | null;
  blocked_reason: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Data needed when creating a new customer profile */
export interface ProfileInsert {
  id: string; // Must match the Firebase Auth user UID
  name: string;
  phone_primary: string;
  phone_alt?: string;
  email?: string;
  date_of_birth?: string;
  gender?: Gender;
  marital_status?: MaritalStatus;
  address: string;
  national_id: string;
  pan_number?: string;
  city?: string;
  district?: string;
  state?: string;
  pin_code?: string;
  occupation?: string;
  monthly_income?: number;
  reference_person?: string;
  reference_phone?: string;
  role?: UserRole;
  customer_number?: string;
  photo_url?: string;
  signature_url?: string;
  aadhaar_front_url?: string;
  aadhaar_back_url?: string;
  pan_url?: string;
  voter_id_url?: string;
  driving_license_url?: string;
  passport_url?: string;
  branch_id?: string;
  is_2fa_enabled?: boolean;
  two_factor_secret?: string;
  nominee_name?: string;
  nominee_relation?: string;
  nominee_mobile?: string;
  face_match_score?: number;
  kyc_expiry_date?: string;
  kyc_status?: KycStatus;
  tags?: string[];
}

/** Fields that can be updated on an existing profile */
export interface ProfileUpdate {
  name?: string;
  phone_alt?: string;
  email?: string | null;
  date_of_birth?: string | null;
  gender?: Gender | null;
  marital_status?: MaritalStatus | null;
  address?: string;
  national_id?: string;
  pan_number?: string;
  city?: string;
  district?: string;
  state?: string | null;
  pin_code?: string;
  occupation?: string;
  monthly_income?: number;
  reference_person?: string;
  reference_phone?: string;
  role?: UserRole;
  status?: string;
  photo_url?: string;
  signature_url?: string;
  aadhaar_front_url?: string;
  aadhaar_back_url?: string;
  pan_url?: string;
  voter_id_url?: string | null;
  driving_license_url?: string | null;
  passport_url?: string | null;
  branch_id?: string | null;
  is_2fa_enabled?: boolean;
  two_factor_secret?: string | null;
  two_factor_temp_secret?: string | null;
  last_login_at?: string | null;
  login_ip?: string | null;
  device_info?: string | null;
  nominee_name?: string | null;
  nominee_relation?: string | null;
  nominee_mobile?: string | null;
  face_match_score?: number | null;
  kyc_expiry_date?: string | null;
  kyc_status?: KycStatus | null;
  kyc_approved_by?: string | null;
  kyc_approved_at?: string | null;
  kyc_rejection_reason?: string | null;
  tags?: string[];
  blocked_at?: string | null;
  blocked_reason?: string | null;
  deleted_at?: string | null;
}

// ----------------------------------------------------------------------------

/** Gold loan record */
export interface Loan {
  id: string;
  customer_id: string;
  loan_number: string;
  principal_amount: number;
  interest_rate_apr: number;
  status: LoanStatus;
  loan_period_months: number;
  disbursed_amount: number | null;
  total_interest_paid: number;
  total_principal_paid: number;
  outstanding_interest: number;
  last_interest_calc_date: string | null;
  origination_date: string | null;
  maturity_date: string | null;
  grace_expiry_date: string | null;
  closed_at: string | null;
  cancelled_at: string | null;
  cancelled_reason: string | null;
  notes: string | null;
  branch_id: string | null;
  qr_code: string | null;
  risk_score: string | null;
  current_bin_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields (optional, populated by queries)
  customer?: Profile;
  customer_name?: string;
  customer_phone?: string;
  customer_number?: string;
  total_outstanding?: number;
  gold_rate_per_gram?: number;
  gold_items?: GoldCollateral[];
  payments?: Payment[];
}

/** Data needed when creating a new loan */
export interface LoanInsert {
  customer_id: string;
  loan_number: string;
  principal_amount: number;
  interest_rate_apr: number;
  loan_period_months?: number;
  disbursed_amount?: number;
  status?: LoanStatus;
  origination_date?: string;
  maturity_date?: string;
  grace_expiry_date?: string;
  notes?: string;
  branch_id?: string;
  qr_code?: string;
  risk_score?: string;
  current_bin_id?: string;
}

/** Fields that can be updated on an existing loan */
export interface LoanUpdate {
  status?: LoanStatus;
  principal_amount?: number;
  interest_rate_apr?: number;
  loan_period_months?: number;
  total_interest_paid?: number;
  total_principal_paid?: number;
  outstanding_interest?: number;
  last_interest_calc_date?: string;
  closed_at?: string;
  cancelled_at?: string;
  cancelled_reason?: string;
  notes?: string;
  branch_id?: string | null;
  qr_code?: string | null;
  risk_score?: string | null;
  current_bin_id?: string | null;
}

// ----------------------------------------------------------------------------

/** Gold collateral item linked to a loan */
export interface GoldCollateral {
  id: string;
  loan_id: string | null;
  customer_id: string | null;
  item_description: string;
  ornament_type: string | null;
  quantity: number;
  gross_weight: number;
  stone_weight: number;
  net_weight: number; // Generated column in DB
  purity_karat: GoldPurity;
  hallmark: boolean;
  gold_rate_per_gram: number | null;
  valuation_inr: number;
  max_eligible_loan: number | null;
  storage_bin_id: string;
  custody_location?: string; // 'PGF Safe' or e.g. 'State Bank of India (Main Branch)'
  bank_repledge_id?: string | null;
  front_photo_url: string | null;
  back_photo_url: string | null;
  side_photo_url: string | null;
  created_at: string;
  // Joined
  photos?: GoldPhoto[];
}

/** Data needed when creating a gold collateral record */
export interface GoldCollateralInsert {
  loan_id?: string;
  customer_id?: string;
  item_description: string;
  ornament_type?: string;
  quantity?: number;
  gross_weight: number;
  stone_weight?: number;
  purity_karat: GoldPurity;
  hallmark?: boolean;
  gold_rate_per_gram?: number;
  valuation_inr: number;
  max_eligible_loan?: number;
  storage_bin_id: string;
  custody_location?: string;
  bank_repledge_id?: string | null;
  front_photo_url?: string;
  back_photo_url?: string;
  side_photo_url?: string;
}

// ----------------------------------------------------------------------------

/** Gold collateral photo */
export interface GoldPhoto {
  id: string;
  collateral_id: string;
  photo_url: string;
  created_at: string;
}

// ----------------------------------------------------------------------------

/** Payment transaction */
export interface Payment {
  id: string;
  loan_id: string;
  customer_id: string | null;
  amount_paid: number;
  interest_portion: number;
  principal_portion: number;
  penalty_amount: number;
  waiver_amount: number;
  payment_type: PaymentType;
  payment_date: string;
  mode: PaymentMode;
  receipt_number: string | null;
  receipt_pdf_url: string | null;
  remarks: string | null;
  slogan_id?: string | null;
  slogan_text?: string | null;
  // Joined
  loan?: Loan;
  customer?: Profile;
}

/** Data needed when recording a payment */
export interface PaymentInsert {
  loan_id: string;
  customer_id?: string;
  amount_paid: number;
  interest_portion: number;
  principal_portion: number;
  penalty_amount?: number;
  waiver_amount?: number;
  payment_type: PaymentType;
  mode: PaymentMode;
  receipt_number?: string;
  receipt_pdf_url?: string;
  remarks?: string;
  payment_date?: string;
  slogan_id?: string;
  slogan_text?: string;
}

// ----------------------------------------------------------------------------

/** Daily interest accrual record */
export interface InterestAccrual {
  id: string;
  loan_id: string;
  accrual_date: string;
  principal_balance: number;
  interest_rate_apr: number;
  daily_amount: number;
  is_paid: boolean;
  paid_at: string | null;
  payment_id: string | null;
  created_at: string;
}

// ----------------------------------------------------------------------------

/** In-app / push notification record */
export interface Notification {
  id: string;
  recipient_id: string;
  type: NotificationType;
  title: string;
  message: string;
  channel: NotificationChannel;
  is_read: boolean;
  read_at: string | null;
  related_entity_type: string | null;
  related_entity_id: string | null;
  sent_at: string;
  created_at: string;
}

/** Data needed when creating a notification */
export interface NotificationInsert {
  recipient_id: string;
  type: NotificationType;
  title: string;
  message: string;
  channel?: NotificationChannel;
  related_entity_type?: string;
  related_entity_id?: string;
}

// ----------------------------------------------------------------------------

/** Application settings key-value pair */
export interface Setting {
  id: string;
  key: string;
  value: string;
  label: string | null;
  category: SettingsCategory;
  updated_by: string | null;
  updated_at: string;
  created_at: string;
}

// ----------------------------------------------------------------------------

/** Generated document / PDF record */
export interface Document {
  id: string;
  doc_type: DocumentType;
  entity_type: string;
  entity_id: string;
  file_url: string;
  file_name: string | null;
  file_size_bytes: number | null;
  generated_by: string | null;
  generated_at: string;
}

// ----------------------------------------------------------------------------

/** Audit log entry */
export interface AuditLog {
  id: string;
  actor_id: string | null;
  action_type: string;
  affected_entity: string;
  affected_entity_id: string;
  old_state: Record<string, unknown> | null;
  new_state: Record<string, unknown> | null;
  ip_address: string | null;
  timestamp: string;
}

/** Data needed when creating an audit log */
export interface AuditLogInsert {
  actor_id: string;
  action_type: string;
  affected_entity: string;
  affected_entity_id: string;
  old_state?: Record<string, unknown>;
  new_state?: Record<string, unknown>;
  ip_address?: string;
}

// ============================================================================
// Aggregate / Dashboard Types
// ============================================================================

/** Admin dashboard summary metrics */
export interface DashboardMetrics {
  totalCustomers: number;
  newCustomersThisMonth: number;
  activeLoans: number;
  closedLoans: number;
  dueToday: number;
  dueThisWeek: number;
  overdueLoans: number;
  totalLoanAmount: number;
  outstandingAmount: number;
  interestEarned: number;
  interestPending: number;
  collectionToday: number;
  collectionThisMonth: number;
  totalGoldWeight: number;
  totalGoldValue: number;
  averagePurity: string;
}

/** Loan with computed outstanding balance */
export interface LoanWithBalance extends Loan {
  remainingPrincipal: number;
  outstandingInterest: number;
  totalOutstanding: number;
}

/** Payment split calculation result */
export interface PaymentSplit {
  totalAmount: number;
  interestPortion: number;
  principalPortion: number;
  remainingPrincipal: number;
  remainingInterest: number;
  newOutstanding: number;
  isFullSettlement: boolean;
}

// ============================================================================
// Approval Request Types
// ============================================================================

export type ApprovalStatus = 'Pending' | 'Approved' | 'Rejected';

export type ApprovalRequestType =
  | 'Loan_Approval'
  | 'High_LTV_Approval'
  | 'Financial_Waiver'
  | 'Delete_Customer'
  | 'Delete_Loan'
  | 'Delete_Payment'
  | 'Rate_Change';

export interface ApprovalRequest {
  id: string;
  request_type: ApprovalRequestType;
  entity_type: string;
  entity_id: string;
  requested_by: string;
  requested_by_name: string;
  requested_by_role?: string;
  requested_amount?: number;
  eligible_amount?: number;
  reason?: string;
  requested_at: string;
  status: ApprovalStatus;
  details: Record<string, any>;
  reviewed_by?: string | null;
  reviewed_by_name?: string | null;
  reviewed_at?: string | null;
  review_notes?: string | null;
}

export interface ApprovalRequestInsert {
  request_type: ApprovalRequestType;
  entity_type: string;
  entity_id: string;
  requested_by: string;
  requested_by_name: string;
  requested_by_role?: string;
  requested_amount?: number;
  eligible_amount?: number;
  reason?: string;
  details: Record<string, any>;
}

// ============================================================================
// Bank Re-Pledge / Bank Pledge Management
// ============================================================================

export type BankRePledgeStatus =
  | 'Pending Approval'
  | 'Approved'
  | 'Pledged with Bank'
  | 'Active'
  | 'Partially Released'
  | 'Released'
  | 'Closed';

export interface BankRePledgeOrnamentItem {
  item_id: string;
  description: string;
  purity_karat: string;
  gross_weight: number;
  stone_weight: number;
  net_weight: number;
  valuation_inr: number;
}

export interface BankRePledge {
  id: string;
  repledge_number: string; // e.g. PGF-REP-1001

  // Permanent linkage to customer and original loan
  customer_id: string;
  customer_name: string;
  customer_phone?: string;
  customer_number?: string;

  loan_id: string;
  loan_number: string;
  original_loan_date: string;
  original_loan_amount: number;
  original_gold_rate: number;
  current_loan_outstanding: number;

  // Collateral Ornaments transferred
  collateral_item_ids: string[];
  ornament_details: BankRePledgeOrnamentItem[];
  total_net_weight: number;
  total_valuation: number;

  // Bank Pledge Details
  bank_name: string;
  bank_branch: string;
  bank_account_number: string;
  pledge_date: string;
  bank_pledge_amount: number;
  bank_interest_rate: number;
  interest_type: 'Simple' | 'Monthly' | 'Compound' | 'Flat';
  tenure_months?: number;
  due_date: string;
  bank_reference_number?: string;
  bank_pledge_ticket_number?: string;
  remarks?: string;
  supporting_doc_url?: string | null;

  // Separate Bank Financial Tracking
  interest_accrued: number;
  interest_paid: number;
  bank_outstanding: number;
  principal_repaid: number;
  last_interest_payment_date?: string | null;

  // Safe Room & Physical Custody Tracking
  custody_location: string; // Initially Bank Name + Branch, returns to 'PGF Safe' on release

  // Status & Approvals
  status: BankRePledgeStatus;
  created_by: string;
  created_by_name: string;
  created_at: string;

  approved_by?: string | null;
  approved_by_name?: string | null;
  approved_at?: string | null;

  // Release / Return from Bank
  release_date?: string | null;
  bank_amount_repaid?: number | null;
  bank_interest_settled?: number | null;
  total_bank_settlement?: number | null;
  bank_release_reference?: string | null;
  released_by?: string | null;
  released_by_name?: string | null;
  released_at?: string | null;
  release_remarks?: string | null;
}

export interface BankRePledgeInsert {
  customer_id: string;
  customer_name: string;
  customer_phone?: string;
  customer_number?: string;

  loan_id: string;
  loan_number: string;
  original_loan_date: string;
  original_loan_amount: number;
  original_gold_rate: number;
  current_loan_outstanding: number;

  collateral_item_ids: string[];
  ornament_details: BankRePledgeOrnamentItem[];
  total_net_weight: number;
  total_valuation: number;

  bank_name: string;
  bank_branch: string;
  bank_account_number: string;
  pledge_date: string;
  bank_pledge_amount: number;
  bank_interest_rate: number;
  interest_type: 'Simple' | 'Monthly' | 'Compound' | 'Flat';
  tenure_months?: number;
  due_date: string;
  bank_reference_number?: string;
  bank_pledge_ticket_number?: string;
  remarks?: string;
  supporting_doc_url?: string | null;

  created_by: string;
  created_by_name: string;
  status?: BankRePledgeStatus;
}


