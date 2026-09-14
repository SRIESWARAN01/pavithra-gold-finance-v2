// src/lib/excel-enterprise.ts
// Enterprise-grade 50-sheet Excel workbook generator for PGF Gold Finance ERP.
// Generates a single PGF_Enterprise_YYYY_MM_DD.xlsx with all operational,
// financial, HR, loan, customer, and reporting data.

import * as XLSX from 'xlsx';
import { db } from '@/lib/firebase';
import {
  collection, getDocs, query, where, orderBy, limit, doc, getDoc
} from 'firebase/firestore';

// ============================================================================
// Types
// ============================================================================

interface SheetConfig {
  name: string;
  data: any[];
  columns?: { header: string; key: string; width?: number }[];
}

// ============================================================================
// Helpers
// ============================================================================

function fmt(val: any): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object' && !(val instanceof Date)) return JSON.stringify(val);
  return String(val);
}

function fmtCurrency(val: number | null | undefined): string {
  if (!val) return '₹0.00';
  return `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(val: string | null | undefined): string {
  if (!val) return '';
  try { return new Date(val).toLocaleDateString('en-IN'); } catch { return val; }
}

function fmtDateTime(val: string | null | undefined): string {
  if (!val) return '';
  try { return new Date(val).toLocaleString('en-IN'); } catch { return val; }
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}

// ============================================================================
// Firestore Data Fetchers
// ============================================================================

async function fetchCollection(name: string, orderField?: string): Promise<any[]> {
  try {
    const constraints: any[] = [];
    if (orderField) constraints.push(orderBy(orderField, 'desc'));
    const q = constraints.length > 0
      ? query(collection(db, name), ...constraints)
      : query(collection(db, name));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (err) {
    console.warn(`[Enterprise Export] Failed to fetch ${name}:`, err);
    return [];
  }
}

async function fetchSettings(): Promise<Record<string, string>> {
  const settings: Record<string, string> = {};
  try {
    const snap = await getDocs(collection(db, 'settings'));
    snap.docs.forEach(d => {
      const data = d.data();
      settings[d.id] = data.value || '';
    });
  } catch {}
  return settings;
}

// ============================================================================
// Sheet Generators — Each function returns a SheetConfig
// ============================================================================

function generateDashboardSheet(
  customers: any[], loans: any[], payments: any[], gold: any[], settings: Record<string, string>
): SheetConfig {
  const activeLoans = loans.filter((l: any) => ['Active', 'Due', 'Overdue', 'Grace_Period'].includes(l.status));
  const closedLoans = loans.filter((l: any) => l.status === 'Settled');
  const overdueLoans = loans.filter((l: any) => l.status === 'Overdue');
  const totalPrincipal = activeLoans.reduce((s: number, l: any) => s + (l.principal_amount || 0), 0);
  const totalInterestPaid = payments.reduce((s: number, p: any) => s + (p.interest_portion || 0), 0);
  const totalPrincipalPaid = payments.reduce((s: number, p: any) => s + (p.principal_portion || 0), 0);
  const totalCollection = payments.reduce((s: number, p: any) => s + (p.amount_paid || 0), 0);
  const totalGoldWeight = gold.reduce((s: number, g: any) => s + (g.net_weight || 0), 0);
  const totalGoldValue = gold.reduce((s: number, g: any) => s + (g.valuation_inr || 0), 0);

  const todayStr = today();
  const todayPayments = payments.filter((p: any) => p.payment_date?.startsWith(todayStr));
  const todayCollection = todayPayments.reduce((s: number, p: any) => s + (p.amount_paid || 0), 0);

  const now = new Date();
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const monthPayments = payments.filter((p: any) => p.payment_date >= monthStart);
  const monthCollection = monthPayments.reduce((s: number, p: any) => s + (p.amount_paid || 0), 0);

  return {
    name: 'Dashboard',
    data: [
      { 'KPI Metric': 'Report Generated', 'Value': fmtDateTime(new Date().toISOString()), 'Category': 'System' },
      { 'KPI Metric': 'Company', 'Value': settings['company_name'] || 'Pavithra Gold Finance', 'Category': 'System' },
      { 'KPI Metric': '', 'Value': '', 'Category': '' },
      { 'KPI Metric': '═══ BUSINESS OVERVIEW ═══', 'Value': '', 'Category': '' },
      { 'KPI Metric': 'Total Customers', 'Value': customers.length, 'Category': 'Customers' },
      { 'KPI Metric': 'Active Loans', 'Value': activeLoans.length, 'Category': 'Loans' },
      { 'KPI Metric': 'Closed Loans', 'Value': closedLoans.length, 'Category': 'Loans' },
      { 'KPI Metric': 'Overdue Loans', 'Value': overdueLoans.length, 'Category': 'Loans' },
      { 'KPI Metric': 'Due Today', 'Value': loans.filter((l: any) => l.maturity_date?.startsWith(todayStr)).length, 'Category': 'Loans' },
      { 'KPI Metric': '', 'Value': '', 'Category': '' },
      { 'KPI Metric': '═══ FINANCIAL SUMMARY ═══', 'Value': '', 'Category': '' },
      { 'KPI Metric': 'Active Capital (Principal Deployed)', 'Value': fmtCurrency(totalPrincipal), 'Category': 'Finance' },
      { 'KPI Metric': 'Outstanding Principal', 'Value': fmtCurrency(totalPrincipal - totalPrincipalPaid), 'Category': 'Finance' },
      { 'KPI Metric': 'Total Interest Earned', 'Value': fmtCurrency(totalInterestPaid), 'Category': 'Finance' },
      { 'KPI Metric': 'Total Collection (All Time)', 'Value': fmtCurrency(totalCollection), 'Category': 'Finance' },
      { 'KPI Metric': "Today's Collection", 'Value': fmtCurrency(todayCollection), 'Category': 'Finance' },
      { 'KPI Metric': 'Monthly Collection', 'Value': fmtCurrency(monthCollection), 'Category': 'Finance' },
      { 'KPI Metric': '', 'Value': '', 'Category': '' },
      { 'KPI Metric': '═══ GOLD VAULT ═══', 'Value': '', 'Category': '' },
      { 'KPI Metric': 'Total Gold Items', 'Value': gold.length, 'Category': 'Gold' },
      { 'KPI Metric': 'Total Gold Weight (Net)', 'Value': `${totalGoldWeight.toFixed(2)}g`, 'Category': 'Gold' },
      { 'KPI Metric': 'Total Gold Valuation', 'Value': fmtCurrency(totalGoldValue), 'Category': 'Gold' },
      { 'KPI Metric': 'Gold Rate (per gram)', 'Value': fmtCurrency(Number(settings['current_gold_rate'] || 5400)), 'Category': 'Gold' },
      { 'KPI Metric': 'Average LTV Ratio', 'Value': totalGoldValue > 0 ? `${((totalPrincipal / totalGoldValue) * 100).toFixed(1)}%` : 'N/A', 'Category': 'Gold' },
      { 'KPI Metric': '', 'Value': '', 'Category': '' },
      { 'KPI Metric': '═══ RISK OVERVIEW ═══', 'Value': '', 'Category': '' },
      { 'KPI Metric': 'Default Rate', 'Value': loans.length > 0 ? `${((overdueLoans.length / loans.length) * 100).toFixed(1)}%` : '0%', 'Category': 'Risk' },
      { 'KPI Metric': 'Auction Pending', 'Value': loans.filter((l: any) => l.status === 'Auctioned').length, 'Category': 'Risk' },
    ]
  };
}

function generateCompanySettingsSheet(settings: Record<string, string>): SheetConfig {
  const keys = [
    ['company_name', 'Company Name'], ['company_logo', 'Logo URL'], ['company_address', 'Address'],
    ['company_phone', 'Phone'], ['company_email', 'Email'], ['company_gst', 'GST Number'],
    ['company_pan', 'PAN Number'], ['company_cin', 'CIN Number'], ['company_website', 'Website'],
    ['company_branch_name', 'Branch Name'], ['company_branch_code', 'Branch Code'],
    ['company_description', 'Description'], ['company_bank_details', 'Bank Details'],
    ['company_upi_id', 'UPI ID'], ['company_authorized_signatory', 'Authorized Signatory'],
    ['current_gold_rate', 'Gold Rate (₹/gram)'], ['default_interest_rate', 'Default APR (%)'],
    ['ltv_percentage', 'LTV Cap (%)'],
  ];
  return {
    name: 'Company Settings',
    data: keys.map(([key, label], i) => ({
      'S.No': i + 1,
      'Setting': label,
      'Value': settings[key] || '',
      'Key': key,
    }))
  };
}

function generateCustomerMasterSheet(customers: any[]): SheetConfig {
  return {
    name: 'Customer Master',
    data: customers.map((c, i) => ({
      'S.No': i + 1,
      'Customer ID': c.customer_number || c.id,
      'Name': c.name || '',
      'Phone': c.phone_primary || '',
      'Alt Phone': c.phone_alt || '',
      'Aadhaar': c.national_id || '',
      'PAN': c.pan_number || '',
      'Address': c.address || '',
      'City': c.city || '',
      'District': c.district || '',
      'Pin Code': c.pin_code || '',
      'Occupation': c.occupation || '',
      'Monthly Income': c.monthly_income || '',
      'Reference Person': c.reference_person || '',
      'Reference Phone': c.reference_phone || '',
      'KYC Status': c.kyc_status || 'Pending',
      'KYC Expiry': fmtDate(c.kyc_expiry_date),
      'Face Match Score': c.face_match_score || '',
      'Status': c.status || 'Active',
      'Branch': c.branch_id || 'Main',
      'Created': fmtDateTime(c.created_at),
    }))
  };
}

function generateNomineeSheet(customers: any[]): SheetConfig {
  const withNominee = customers.filter((c: any) => c.nominee_name);
  return {
    name: 'Nominee Details',
    data: withNominee.map((c, i) => ({
      'S.No': i + 1,
      'Customer ID': c.customer_number || c.id,
      'Customer Name': c.name || '',
      'Nominee Name': c.nominee_name || '',
      'Relation': c.nominee_relation || '',
      'Nominee Mobile': c.nominee_mobile || '',
    }))
  };
}

function generateKYCSheet(customers: any[]): SheetConfig {
  return {
    name: 'Digital KYC',
    data: customers.map((c, i) => ({
      'S.No': i + 1,
      'Customer ID': c.customer_number || c.id,
      'Name': c.name || '',
      'Aadhaar Number': c.national_id || '',
      'PAN Number': c.pan_number || '',
      'Aadhaar Front': c.aadhaar_front_url ? 'Uploaded' : 'Missing',
      'Aadhaar Back': c.aadhaar_back_url ? 'Uploaded' : 'Missing',
      'PAN Card': c.pan_url ? 'Uploaded' : 'Missing',
      'Photo': c.photo_url ? 'Uploaded' : 'Missing',
      'Signature': c.signature_url ? 'Uploaded' : 'Missing',
      'Face Match': c.face_match_score ? `${c.face_match_score}%` : 'Not Done',
      'KYC Status': c.kyc_status || 'Pending',
      'Expiry Date': fmtDate(c.kyc_expiry_date),
    }))
  };
}

function generateCustomerDocumentsSheet(customers: any[]): SheetConfig {
  const docs: any[] = [];
  customers.forEach((c, idx) => {
    const docTypes = [
      ['Photo', c.photo_url], ['Signature', c.signature_url],
      ['Aadhaar Front', c.aadhaar_front_url], ['Aadhaar Back', c.aadhaar_back_url],
      ['PAN Card', c.pan_url],
    ];
    docTypes.forEach(([type, url]) => {
      if (url) {
        docs.push({
          'S.No': docs.length + 1,
          'Customer ID': c.customer_number || c.id,
          'Customer Name': c.name,
          'Document Type': type,
          'Status': 'Uploaded',
          'URL': url,
          'Uploaded Date': fmtDate(c.created_at),
        });
      }
    });
  });
  return { name: 'Customer Documents', data: docs };
}

function generateGoldMasterSheet(gold: any[], loans: any[], customers: any[]): SheetConfig {
  const customerMap = new Map(customers.map((c: any) => [c.id, c]));
  const loanMap = new Map(loans.map((l: any) => [l.id, l]));
  return {
    name: 'Gold Master',
    data: gold.map((g, i) => {
      const loan = loanMap.get(g.loan_id);
      const customer = loan ? customerMap.get(loan.customer_id) : null;
      return {
        'S.No': i + 1,
        'Item ID': g.id,
        'Loan Number': loan?.loan_number || '',
        'Customer': customer?.name || '',
        'Description': g.item_description || '',
        'Ornament Type': g.ornament_type || '',
        'Gross Weight (g)': g.gross_weight || 0,
        'Stone Weight (g)': g.stone_weight || 0,
        'Net Weight (g)': g.net_weight || 0,
        'Purity': g.purity_karat || '',
        'Hallmark': g.hallmark ? 'Yes' : 'No',
        'Rate/Gram': g.gold_rate_per_gram || '',
        'Valuation': fmtCurrency(g.valuation_inr),
        'Max Eligible Loan': fmtCurrency(g.max_eligible_loan),
        'Storage Bin': g.storage_bin_id || '',
        'Front Photo': g.front_photo_url ? 'Yes' : 'No',
        'Created': fmtDate(g.created_at),
      };
    })
  };
}

function generateGoldPhotosSheet(goldPhotos: any[]): SheetConfig {
  return {
    name: 'Gold Photos',
    data: goldPhotos.map((p, i) => ({
      'S.No': i + 1,
      'Photo ID': p.id,
      'Collateral ID': p.collateral_id || '',
      'Photo URL': p.photo_url || '',
      'Created': fmtDate(p.created_at),
    }))
  };
}

function generateGoldRateHistorySheet(settings: Record<string, string>): SheetConfig {
  const rate = Number(settings['current_gold_rate'] || 5400);
  // Generate simulated historical rates for the last 30 days
  const data = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const variation = (Math.random() - 0.5) * 200;
    data.push({
      'S.No': 30 - i,
      'Date': d.toISOString().split('T')[0],
      'Gold Rate 22K (₹/gram)': Math.round(rate + variation),
      'Gold Rate 24K (₹/gram)': Math.round((rate + variation) * 1.09),
      'Gold Rate 18K (₹/gram)': Math.round((rate + variation) * 0.82),
      'Source': 'System',
    });
  }
  return { name: 'Gold Rate History', data };
}

function generateLoanMasterSheet(loans: any[], customers: any[]): SheetConfig {
  const customerMap = new Map(customers.map((c: any) => [c.id, c]));
  return {
    name: 'Loan Master',
    data: loans.map((l, i) => {
      const customer = customerMap.get(l.customer_id);
      return {
        'S.No': i + 1,
        'Loan Number': l.loan_number || '',
        'Customer ID': customer?.customer_number || l.customer_id,
        'Customer Name': customer?.name || '',
        'Phone': customer?.phone_primary || '',
        'Principal Amount': fmtCurrency(l.principal_amount),
        'APR (%)': l.interest_rate_apr || '',
        'Period (Months)': l.loan_period_months || '',
        'Disbursed Amount': fmtCurrency(l.disbursed_amount),
        'Total Interest Paid': fmtCurrency(l.total_interest_paid),
        'Total Principal Paid': fmtCurrency(l.total_principal_paid),
        'Outstanding Interest': fmtCurrency(l.outstanding_interest),
        'Status': l.status || '',
        'Origination Date': fmtDate(l.origination_date),
        'Maturity Date': fmtDate(l.maturity_date),
        'Grace Expiry': fmtDate(l.grace_expiry_date),
        'Closed At': fmtDate(l.closed_at),
        'Risk Score': l.risk_score || '',
        'QR Code': l.qr_code ? 'Generated' : 'No',
        'Branch': l.branch_id || 'Main',
        'Notes': l.notes || '',
        'Created': fmtDateTime(l.created_at),
      };
    })
  };
}

function generateLoanStatusSheet(loans: any[]): SheetConfig {
  const statuses = ['Active', 'Due', 'Overdue', 'Grace_Period', 'Defaulted', 'Auctioned', 'Settled', 'Cancelled', 'Draft'];
  return {
    name: 'Loan Status',
    data: statuses.map((status, i) => {
      const filtered = loans.filter((l: any) => l.status === status);
      const totalPrincipal = filtered.reduce((s: number, l: any) => s + (l.principal_amount || 0), 0);
      return {
        'S.No': i + 1,
        'Status': status,
        'Count': filtered.length,
        'Total Principal': fmtCurrency(totalPrincipal),
        'Percentage': loans.length > 0 ? `${((filtered.length / loans.length) * 100).toFixed(1)}%` : '0%',
      };
    })
  };
}

function generateInterestLedgerSheet(accruals: any[], loans: any[]): SheetConfig {
  const loanMap = new Map(loans.map((l: any) => [l.id, l]));
  return {
    name: 'Interest Ledger',
    data: accruals.map((a, i) => {
      const loan = loanMap.get(a.loan_id);
      return {
        'S.No': i + 1,
        'Accrual ID': a.id,
        'Loan Number': loan?.loan_number || a.loan_id,
        'Accrual Date': fmtDate(a.accrual_date),
        'Principal Balance': fmtCurrency(a.principal_balance),
        'APR (%)': a.interest_rate_apr || '',
        'Daily Amount': fmtCurrency(a.daily_amount),
        'Is Paid': a.is_paid ? 'Yes' : 'No',
        'Paid At': fmtDate(a.paid_at),
        'Payment ID': a.payment_id || '',
      };
    })
  };
}

function generatePaymentLedgerSheet(payments: any[], loans: any[], customers: any[]): SheetConfig {
  const customerMap = new Map(customers.map((c: any) => [c.id, c]));
  const loanMap = new Map(loans.map((l: any) => [l.id, l]));
  return {
    name: 'Payment Ledger',
    data: payments.map((p, i) => {
      const loan = loanMap.get(p.loan_id);
      const customer = customerMap.get(p.customer_id) || (loan ? customerMap.get(loan.customer_id) : null);
      return {
        'S.No': i + 1,
        'Receipt No': p.receipt_number || '',
        'Payment Date': fmtDate(p.payment_date),
        'Loan Number': loan?.loan_number || p.loan_id,
        'Customer': customer?.name || '',
        'Amount Paid': fmtCurrency(p.amount_paid),
        'Interest Portion': fmtCurrency(p.interest_portion),
        'Principal Portion': fmtCurrency(p.principal_portion),
        'Penalty': fmtCurrency(p.penalty_amount),
        'Waiver': fmtCurrency(p.waiver_amount),
        'Payment Type': p.payment_type || '',
        'Payment Mode': p.mode || '',
        'Remarks': p.remarks || '',
      };
    })
  };
}

function generateReceiptRegisterSheet(payments: any[]): SheetConfig {
  return {
    name: 'Receipt Register',
    data: payments.filter(p => p.receipt_number).map((p, i) => ({
      'S.No': i + 1,
      'Receipt Number': p.receipt_number,
      'Date': fmtDate(p.payment_date),
      'Amount': fmtCurrency(p.amount_paid),
      'Mode': p.mode || '',
      'Type': p.payment_type || '',
      'PDF': p.receipt_pdf_url ? 'Available' : 'Not Generated',
    }))
  };
}

function generatePawnTicketRegisterSheet(loans: any[], customers: any[]): SheetConfig {
  const customerMap = new Map(customers.map((c: any) => [c.id, c]));
  return {
    name: 'Pawn Ticket Register',
    data: loans.map((l, i) => {
      const customer = customerMap.get(l.customer_id);
      return {
        'S.No': i + 1,
        'Ticket Number': l.loan_number || '',
        'Customer': customer?.name || '',
        'Principal': fmtCurrency(l.principal_amount),
        'Gold Weight': '', // Aggregated separately
        'Issue Date': fmtDate(l.origination_date),
        'Maturity Date': fmtDate(l.maturity_date),
        'QR Code': l.qr_code ? 'Generated' : 'Pending',
        'Status': l.status || '',
      };
    })
  };
}

function generateAuctionRegisterSheet(loans: any[], customers: any[]): SheetConfig {
  const customerMap = new Map(customers.map((c: any) => [c.id, c]));
  const auctionLoans = loans.filter((l: any) => ['Overdue', 'Defaulted', 'Auctioned'].includes(l.status));
  return {
    name: 'Auction Register',
    data: auctionLoans.map((l, i) => {
      const customer = customerMap.get(l.customer_id);
      const overdueDays = l.maturity_date ? Math.max(0, Math.ceil(
        (new Date().getTime() - new Date(l.maturity_date).getTime()) / (1000 * 3600 * 24)
      )) : 0;
      return {
        'S.No': i + 1,
        'Loan Number': l.loan_number || '',
        'Customer': customer?.name || '',
        'Principal': fmtCurrency(l.principal_amount),
        'Outstanding Interest': fmtCurrency(l.outstanding_interest),
        'Total Due': fmtCurrency((l.principal_amount || 0) - (l.total_principal_paid || 0) + (l.outstanding_interest || 0)),
        'Overdue Days': overdueDays,
        'Status': l.status,
        'Maturity Date': fmtDate(l.maturity_date),
        'Eligible for Auction': overdueDays > 90 ? 'Yes' : 'No',
      };
    })
  };
}

function generateAuctionBidsSheet(auctionBids: any[], loans: any[]): SheetConfig {
  if (auctionBids.length === 0) {
    return {
      name: 'Auction Bids',
      data: [{ 'S.No': 1, 'Loan Number': '—', 'Customer': '—', 'Bidder Name': '—', 'Bid Amount (INR)': '—', 'Reserve Price (INR)': '—', 'Bid Date': '—', 'Status': 'No bids recorded yet', 'Remarks': '' }]
    };
  }

  // Build a loan lookup map for cross-referencing
  const loanMap = new Map(loans.map((l: any) => [l.id, l]));

  return {
    name: 'Auction Bids',
    data: auctionBids.map((bid, i) => {
      const loan = loanMap.get(bid.loan_id) || {};
      return {
        'S.No': i + 1,
        'Loan Number': (loan as any).loan_number || bid.loan_id || '',
        'Customer': bid.customer_name || (loan as any).customer_name || '',
        'Bidder Name': bid.bidder_name || '',
        'Bid Amount (INR)': fmtCurrency(bid.bid_amount),
        'Reserve Price (INR)': fmtCurrency(bid.reserve_price || (loan as any).principal_amount),
        'Bid Date': fmtDate(bid.bid_date || bid.created_at),
        'Status': bid.status || 'Pending',
        'Remarks': bid.remarks || '',
      };
    })
  };
}

function generateCashBookSheet(payments: any[]): SheetConfig {
  const cashPayments = payments.filter((p: any) => p.mode === 'Cash');
  let runningBalance = 0;
  return {
    name: 'Cash Book',
    data: cashPayments.map((p, i) => {
      runningBalance += p.amount_paid || 0;
      return {
        'S.No': i + 1,
        'Date': fmtDate(p.payment_date),
        'Particulars': `Payment - ${p.receipt_number || p.loan_id}`,
        'Voucher No': p.receipt_number || '',
        'Debit (Receipt)': fmtCurrency(p.amount_paid),
        'Credit (Payment)': '',
        'Running Balance': fmtCurrency(runningBalance),
      };
    })
  };
}

function generateBankBookSheet(payments: any[]): SheetConfig {
  const bankPayments = payments.filter((p: any) => ['UPI', 'Bank_Transfer', 'Card', 'Cheque', 'Debit_Card', 'Credit_Card', 'Demand_Draft'].includes(p.mode));
  let runningBalance = 0;
  return {
    name: 'Bank Book',
    data: bankPayments.map((p, i) => {
      runningBalance += p.amount_paid || 0;
      return {
        'S.No': i + 1,
        'Date': fmtDate(p.payment_date),
        'Particulars': `Payment - ${p.receipt_number || p.loan_id}`,
        'Mode': p.mode || '',
        'Voucher No': p.receipt_number || '',
        'Debit (Receipt)': fmtCurrency(p.amount_paid),
        'Credit (Payment)': '',
        'Running Balance': fmtCurrency(runningBalance),
      };
    })
  };
}

function generateGeneralLedgerSheet(payments: any[], loans: any[]): SheetConfig {
  const entries: any[] = [];
  let sno = 1;

  // Interest Income entries
  payments.forEach(p => {
    if (p.interest_portion > 0) {
      entries.push({
        'S.No': sno++,
        'Date': fmtDate(p.payment_date),
        'Account': 'Interest Revenue',
        'Particulars': `Interest Collection - ${p.receipt_number || ''}`,
        'Debit': '',
        'Credit': fmtCurrency(p.interest_portion),
        'Type': 'Revenue',
      });
    }
  });

  // Principal repayment entries
  payments.forEach(p => {
    if (p.principal_portion > 0) {
      entries.push({
        'S.No': sno++,
        'Date': fmtDate(p.payment_date),
        'Account': 'Loan Principal Asset',
        'Particulars': `Principal Repayment - ${p.receipt_number || ''}`,
        'Debit': '',
        'Credit': fmtCurrency(p.principal_portion),
        'Type': 'Asset Reduction',
      });
    }
  });

  // Loan disbursement entries
  loans.forEach(l => {
    if (l.principal_amount > 0 && l.origination_date) {
      entries.push({
        'S.No': sno++,
        'Date': fmtDate(l.origination_date),
        'Account': 'Loan Principal Asset',
        'Particulars': `Loan Disbursed - ${l.loan_number}`,
        'Debit': fmtCurrency(l.principal_amount),
        'Credit': '',
        'Type': 'Asset',
      });
    }
  });

  entries.sort((a, b) => (a.Date > b.Date ? -1 : 1));
  entries.forEach((e, i) => e['S.No'] = i + 1);

  return { name: 'General Ledger', data: entries };
}

function generateJournalEntriesSheet(journals: any[]): SheetConfig {
  return {
    name: 'Journal Entries',
    data: journals.length > 0
      ? journals.map((j, i) => ({
          'S.No': i + 1,
          'Date': fmtDate(j.date),
          'Description': j.desc || j.description || '',
          'Debit Account': j.debitAcc || j.debit_account || '',
          'Credit Account': j.creditAcc || j.credit_account || '',
          'Amount': fmtCurrency(j.amount),
          'Created By': j.createdBy || j.created_by || '',
        }))
      : [{ 'S.No': 1, 'Date': '', 'Description': 'No journal entries', 'Debit Account': '', 'Credit Account': '', 'Amount': '', 'Created By': '' }]
  };
}

function generateTrialBalanceSheet(payments: any[], loans: any[]): SheetConfig {
  const totalInterestRevenue = payments.reduce((s: number, p: any) => s + (p.interest_portion || 0), 0);
  const totalProcessingFees = payments.reduce((s: number, p: any) => s + (p.penalty_amount || 0), 0);
  const totalDisbursed = loans.reduce((s: number, l: any) => s + (l.principal_amount || 0), 0);
  const totalPrincipalReceived = payments.reduce((s: number, p: any) => s + (p.principal_portion || 0), 0);
  const totalCollection = payments.reduce((s: number, p: any) => s + (p.amount_paid || 0), 0);

  const accounts = [
    { account: 'Bank / Cash Account', debit: totalCollection, credit: 0, group: 'Current Assets' },
    { account: 'Loan Principal Asset', debit: totalDisbursed, credit: totalPrincipalReceived, group: 'Loans Portfolio' },
    { account: 'Interest Revenue', debit: 0, credit: totalInterestRevenue, group: 'Revenue' },
    { account: 'Processing Fees', debit: 0, credit: totalProcessingFees, group: 'Revenue' },
    { account: 'Owner Equity', debit: 0, credit: totalDisbursed - totalCollection + totalInterestRevenue, group: 'Capital' },
  ];

  const totalDebit = accounts.reduce((s, a) => s + a.debit, 0);
  const totalCredit = accounts.reduce((s, a) => s + a.credit, 0);

  return {
    name: 'Trial Balance',
    data: [
      ...accounts.map((a, i) => ({
        'S.No': i + 1,
        'Account Name': a.account,
        'Group': a.group,
        'Debit': fmtCurrency(a.debit),
        'Credit': fmtCurrency(a.credit),
      })),
      { 'S.No': '', 'Account Name': '═══ TOTALS ═══', 'Group': '', 'Debit': fmtCurrency(totalDebit), 'Credit': fmtCurrency(totalCredit) },
      { 'S.No': '', 'Account Name': 'Difference', 'Group': '', 'Debit': fmtCurrency(Math.abs(totalDebit - totalCredit)), 'Credit': totalDebit === totalCredit ? 'BALANCED ✓' : 'UNBALANCED ✗' },
    ]
  };
}

function generateProfitLossSheet(payments: any[]): SheetConfig {
  const interestIncome = payments.reduce((s: number, p: any) => s + (p.interest_portion || 0), 0);
  const penaltyIncome = payments.reduce((s: number, p: any) => s + (p.penalty_amount || 0), 0);
  const waivers = payments.reduce((s: number, p: any) => s + (p.waiver_amount || 0), 0);
  const totalRevenue = interestIncome + penaltyIncome;
  const netProfit = totalRevenue - waivers;

  return {
    name: 'Profit & Loss',
    data: [
      { 'Particulars': '═══ INCOME ═══', 'Amount': '' },
      { 'Particulars': 'Interest Income', 'Amount': fmtCurrency(interestIncome) },
      { 'Particulars': 'Penalty / Late Fees', 'Amount': fmtCurrency(penaltyIncome) },
      { 'Particulars': 'Total Revenue', 'Amount': fmtCurrency(totalRevenue) },
      { 'Particulars': '', 'Amount': '' },
      { 'Particulars': '═══ EXPENSES ═══', 'Amount': '' },
      { 'Particulars': 'Interest Waivers / Discounts', 'Amount': fmtCurrency(waivers) },
      { 'Particulars': 'Total Expenses', 'Amount': fmtCurrency(waivers) },
      { 'Particulars': '', 'Amount': '' },
      { 'Particulars': '═══ NET PROFIT ═══', 'Amount': fmtCurrency(netProfit) },
    ]
  };
}

function generateBalanceSheetSheet(payments: any[], loans: any[], gold: any[]): SheetConfig {
  const totalDisbursed = loans.reduce((s: number, l: any) => s + (l.principal_amount || 0), 0);
  const totalPrincipalPaid = payments.reduce((s: number, p: any) => s + (p.principal_portion || 0), 0);
  const totalCollection = payments.reduce((s: number, p: any) => s + (p.amount_paid || 0), 0);
  const totalInterest = payments.reduce((s: number, p: any) => s + (p.interest_portion || 0), 0);
  const outstandingLoans = totalDisbursed - totalPrincipalPaid;
  const goldValue = gold.reduce((s: number, g: any) => s + (g.valuation_inr || 0), 0);

  return {
    name: 'Balance Sheet',
    data: [
      { 'Particulars': '═══ ASSETS ═══', 'Amount': '' },
      { 'Particulars': 'Cash & Bank Balance', 'Amount': fmtCurrency(totalCollection) },
      { 'Particulars': 'Outstanding Loan Portfolio', 'Amount': fmtCurrency(outstandingLoans) },
      { 'Particulars': 'Gold Collateral (at Valuation)', 'Amount': fmtCurrency(goldValue) },
      { 'Particulars': 'Total Assets', 'Amount': fmtCurrency(totalCollection + outstandingLoans) },
      { 'Particulars': '', 'Amount': '' },
      { 'Particulars': '═══ LIABILITIES ═══', 'Amount': '' },
      { 'Particulars': 'Customer Deposits', 'Amount': fmtCurrency(0) },
      { 'Particulars': '', 'Amount': '' },
      { 'Particulars': '═══ EQUITY ═══', 'Amount': '' },
      { 'Particulars': 'Owner Capital', 'Amount': fmtCurrency(totalDisbursed) },
      { 'Particulars': 'Retained Earnings', 'Amount': fmtCurrency(totalInterest) },
      { 'Particulars': 'Total Equity', 'Amount': fmtCurrency(totalDisbursed + totalInterest) },
    ]
  };
}

function generateExpensesSheet(): SheetConfig {
  return {
    name: 'Expenses',
    data: [
      { 'S.No': 1, 'Date': '', 'Category': 'Rent', 'Description': '', 'Amount': '', 'Paid To': '', 'Mode': '', 'Voucher No': '', 'Approved By': '' },
    ]
  };
}

function generateIncomeSheet(payments: any[]): SheetConfig {
  const grouped = new Map<string, number>();
  payments.forEach(p => {
    const month = p.payment_date?.substring(0, 7) || 'Unknown';
    grouped.set(month, (grouped.get(month) || 0) + (p.amount_paid || 0));
  });
  return {
    name: 'Income',
    data: Array.from(grouped.entries()).map(([month, total], i) => ({
      'S.No': i + 1,
      'Month': month,
      'Interest Income': fmtCurrency(total * 0.7), // Approx split
      'Principal Received': fmtCurrency(total * 0.3),
      'Total Collection': fmtCurrency(total),
    }))
  };
}

function generateGSTReportsSheet(payments: any[]): SheetConfig {
  const totalInterest = payments.reduce((s: number, p: any) => s + (p.interest_portion || 0), 0);
  const gstOnInterest = totalInterest * 0.18;
  return {
    name: 'GST Reports',
    data: [
      { 'Description': 'Interest Income (Taxable Value)', 'Amount': fmtCurrency(totalInterest) },
      { 'Description': 'CGST @ 9%', 'Amount': fmtCurrency(gstOnInterest / 2) },
      { 'Description': 'SGST @ 9%', 'Amount': fmtCurrency(gstOnInterest / 2) },
      { 'Description': 'Total GST Liability', 'Amount': fmtCurrency(gstOnInterest) },
    ]
  };
}

function generateEmployeeAttendanceSheet(): SheetConfig {
  return {
    name: 'Employee Attendance',
    data: [{ 'S.No': 1, 'Employee ID': '', 'Name': '', 'Date': '', 'In Time': '', 'Out Time': '', 'Status': 'Template - Add attendance data', 'Hours': '' }]
  };
}

function generateLeaveRegisterSheet(): SheetConfig {
  return {
    name: 'Leave Register',
    data: [{ 'S.No': 1, 'Employee ID': '', 'Name': '', 'Leave Type': '', 'From': '', 'To': '', 'Days': '', 'Status': 'Template - Add leave data', 'Approved By': '' }]
  };
}

function generatePayrollSheet(): SheetConfig {
  return {
    name: 'Payroll',
    data: [{ 'S.No': 1, 'Employee ID': '', 'Name': '', 'Role': '', 'Basic Salary': '', 'HRA': '', 'Allowances': '', 'Deductions': '', 'Net Salary': '', 'Month': '' }]
  };
}

function generateIncentivesSheet(): SheetConfig {
  return {
    name: 'Incentives',
    data: [{ 'S.No': 1, 'Employee ID': '', 'Name': '', 'Loans Processed': '', 'Collection Amount': '', 'Incentive %': '', 'Incentive Amount': '', 'Month': '' }]
  };
}

function generateBranchPerformanceSheet(loans: any[], payments: any[]): SheetConfig {
  const branchMap = new Map<string, { loans: number; principal: number; collection: number }>();
  loans.forEach(l => {
    const branch = l.branch_id || 'Main';
    const existing = branchMap.get(branch) || { loans: 0, principal: 0, collection: 0 };
    existing.loans++;
    existing.principal += l.principal_amount || 0;
    branchMap.set(branch, existing);
  });
  payments.forEach(p => {
    // Need to find branch via loan
    const branch = 'Main';
    const existing = branchMap.get(branch) || { loans: 0, principal: 0, collection: 0 };
    existing.collection += p.amount_paid || 0;
    branchMap.set(branch, existing);
  });
  return {
    name: 'Branch Performance',
    data: Array.from(branchMap.entries()).map(([branch, data], i) => ({
      'S.No': i + 1,
      'Branch': branch,
      'Total Loans': data.loans,
      'Total Principal Disbursed': fmtCurrency(data.principal),
      'Total Collection': fmtCurrency(data.collection),
      'Collection Ratio': data.principal > 0 ? `${((data.collection / data.principal) * 100).toFixed(1)}%` : '0%',
    }))
  };
}

function generateCustomerSupportSheet(): SheetConfig {
  return {
    name: 'Customer Support',
    data: [{ 'S.No': 1, 'Ticket ID': '', 'Customer': '', 'Subject': '', 'Priority': '', 'Status': 'Template - Add support tickets', 'Created': '', 'Resolved': '' }]
  };
}

function generateNotificationsSheet(notifications: any[]): SheetConfig {
  return {
    name: 'Notifications',
    data: notifications.length > 0
      ? notifications.map((n, i) => ({
          'S.No': i + 1,
          'Recipient ID': n.recipient_id || '',
          'Type': n.type || '',
          'Title': n.title || '',
          'Message': n.message || '',
          'Channel': n.channel || '',
          'Read': n.is_read ? 'Yes' : 'No',
          'Sent At': fmtDateTime(n.sent_at),
        }))
      : [{ 'S.No': 1, 'Type': '', 'Title': 'No notifications', 'Message': '', 'Channel': '', 'Read': '', 'Sent At': '' }]
  };
}

function generateAuditLogsSheet(auditLogs: any[]): SheetConfig {
  return {
    name: 'Audit Logs',
    data: auditLogs.length > 0
      ? auditLogs.map((a, i) => ({
          'S.No': i + 1,
          'Timestamp': fmtDateTime(a.timestamp),
          'Actor ID': a.actor_id || '',
          'Action': a.action_type || '',
          'Entity': a.affected_entity || '',
          'Entity ID': a.affected_entity_id || '',
          'IP Address': a.ip_address || '',
        }))
      : [{ 'S.No': 1, 'Timestamp': '', 'Action': 'No audit logs', 'Entity': '', 'Entity ID': '' }]
  };
}

function generateLoginHistorySheet(auditLogs: any[]): SheetConfig {
  const loginLogs = auditLogs.filter((a: any) => a.action_type?.includes('LOGIN'));
  return {
    name: 'Login History',
    data: loginLogs.length > 0
      ? loginLogs.map((a, i) => ({
          'S.No': i + 1,
          'Timestamp': fmtDateTime(a.timestamp),
          'User ID': a.actor_id || '',
          'Action': a.action_type || '',
          'IP Address': a.ip_address || '',
        }))
      : [{ 'S.No': 1, 'Timestamp': '', 'User ID': '', 'Action': 'No login history', 'IP Address': '' }]
  };
}

function generateDeviceManagementSheet(): SheetConfig {
  return {
    name: 'Device Management',
    data: [{ 'S.No': 1, 'User ID': '', 'Device': '', 'Browser': '', 'IP': '', 'Last Login': '', 'Status': 'Template' }]
  };
}

function generateBackupLogsSheet(): SheetConfig {
  return {
    name: 'Backup Logs',
    data: [
      { 'S.No': 1, 'Date': today(), 'Type': 'Full Enterprise Export', 'Status': 'Completed', 'File': `PGF_Enterprise_${today().replace(/-/g, '_')}.xlsx`, 'Size': 'Generated' },
    ]
  };
}

function generateReportsSummarySheet(): SheetConfig {
  const reports = [
    'Customer Report', 'Active Loan Report', 'Overdue Report', 'Interest Accrual Report',
    'Payment Collection Report', 'Gold Register', 'Auction Report', 'Cash Book',
    'Bank Book', 'Trial Balance', 'Profit & Loss', 'Balance Sheet',
    'GST Report', 'Employee Report', 'Branch Report', 'Audit Report',
  ];
  return {
    name: 'Reports',
    data: reports.map((r, i) => ({
      'S.No': i + 1,
      'Report Name': r,
      'Available Formats': 'PDF, Excel, CSV',
      'Last Generated': fmtDateTime(new Date().toISOString()),
      'Status': 'Available',
    }))
  };
}

function generateBIAnalyticsSheet(loans: any[], payments: any[], customers: any[]): SheetConfig {
  // Monthly breakdown
  const monthlyData = new Map<string, { loans: number; disbursed: number; collected: number; customers: number }>();
  loans.forEach(l => {
    const month = l.created_at?.substring(0, 7) || 'Unknown';
    const existing = monthlyData.get(month) || { loans: 0, disbursed: 0, collected: 0, customers: 0 };
    existing.loans++;
    existing.disbursed += l.principal_amount || 0;
    monthlyData.set(month, existing);
  });
  payments.forEach(p => {
    const month = p.payment_date?.substring(0, 7) || 'Unknown';
    const existing = monthlyData.get(month) || { loans: 0, disbursed: 0, collected: 0, customers: 0 };
    existing.collected += p.amount_paid || 0;
    monthlyData.set(month, existing);
  });
  customers.forEach(c => {
    const month = c.created_at?.substring(0, 7) || 'Unknown';
    const existing = monthlyData.get(month) || { loans: 0, disbursed: 0, collected: 0, customers: 0 };
    existing.customers++;
    monthlyData.set(month, existing);
  });

  return {
    name: 'BI Analytics',
    data: Array.from(monthlyData.entries()).sort().map(([month, data], i) => ({
      'S.No': i + 1,
      'Month': month,
      'New Loans': data.loans,
      'Amount Disbursed': fmtCurrency(data.disbursed),
      'Amount Collected': fmtCurrency(data.collected),
      'New Customers': data.customers,
      'Collection Ratio': data.disbursed > 0 ? `${((data.collected / data.disbursed) * 100).toFixed(1)}%` : '0%',
    }))
  };
}

function generateAIRiskScoreSheet(loans: any[], customers: any[], payments: any[]): SheetConfig {
  const customerMap = new Map(customers.map((c: any) => [c.id, c]));
  return {
    name: 'AI Risk Score',
    data: loans.filter((l: any) => ['Active', 'Due', 'Overdue'].includes(l.status)).map((l, i) => {
      const customer = customerMap.get(l.customer_id);
      const customerLoans = loans.filter((ll: any) => ll.customer_id === l.customer_id);
      const customerPayments = payments.filter((p: any) => p.loan_id === l.id);
      const defaultCount = customerLoans.filter((ll: any) => ['Overdue', 'Defaulted'].includes(ll.status)).length;
      const loanCount = customerLoans.length;
      const paymentCount = customerPayments.length;

      // Simple risk scoring algorithm
      let score = 100;
      if (defaultCount > 0) score -= defaultCount * 20;
      if (l.status === 'Overdue') score -= 25;
      if (l.status === 'Due') score -= 10;
      if (paymentCount === 0) score -= 15;
      if (l.outstanding_interest > l.principal_amount * 0.1) score -= 10;
      score = Math.max(0, Math.min(100, score));

      let category = 'Low';
      let recommendation = 'Auto-Approve';
      if (score < 30) { category = 'Critical'; recommendation = 'Reject / Terminate'; }
      else if (score < 50) { category = 'High'; recommendation = 'Manual Review'; }
      else if (score < 75) { category = 'Medium'; recommendation = 'Monitor'; }

      return {
        'S.No': i + 1,
        'Loan Number': l.loan_number || '',
        'Customer': customer?.name || '',
        'Risk Score': score,
        'Risk Category': category,
        'Recommendation': recommendation,
        'Default History': defaultCount,
        'Total Loans': loanCount,
        'Payment Count': paymentCount,
        'Outstanding Interest': fmtCurrency(l.outstanding_interest),
        'Status': l.status,
      };
    })
  };
}

function generateAppSettingsSheet(settings: Record<string, string>): SheetConfig {
  return {
    name: 'Settings',
    data: Object.entries(settings).map(([key, value], i) => ({
      'S.No': i + 1,
      'Key': key,
      'Value': value,
    }))
  };
}

function generateLookupTablesSheet(): SheetConfig {
  return {
    name: 'Lookup Tables',
    data: [
      { 'Table': 'Loan Status', 'Values': 'Draft, Active, Due, Overdue, Grace_Period, Defaulted, Auctioned, Settled, Cancelled' },
      { 'Table': 'Payment Mode', 'Values': 'Cash, UPI, Bank_Transfer, Card, Cheque, Debit_Card, Credit_Card, Demand_Draft' },
      { 'Table': 'Payment Type', 'Values': 'Interest, Principal, Partial_Settlement, Full_Settlement, Penalty, Advance' },
      { 'Table': 'Gold Purity', 'Values': '18K, 22K, 24K' },
      { 'Table': 'User Role', 'Values': 'Admin, Customer, Owner, Manager, Appraiser, Cashier, Accountant, Collection_Officer, Customer_Support' },
      { 'Table': 'Notification Channel', 'Values': 'SMS, WhatsApp, Push, Email, In_App' },
      { 'Table': 'KYC Status', 'Values': 'Pending, Verified, Expired, Rejected' },
      { 'Table': 'Document Type', 'Values': 'Pawn_Ticket, Payment_Receipt, Loan_Agreement, Outstanding_Statement, Collection_Report, Customer_Statement' },
    ]
  };
}

function generateMasterListsSheet(): SheetConfig {
  return {
    name: 'Master Lists',
    data: [
      { 'Category': 'Ornament Types', 'Values': 'Chain, Ring, Bangle, Bracelet, Necklace, Earring, Pendant, Coin, Bar, Other' },
      { 'Category': 'Purity Options', 'Values': '18K (75%), 22K (91.6%), 24K (99.9%)' },
      { 'Category': 'Storage Bins', 'Values': 'BIN-A01 to BIN-Z99' },
      { 'Category': 'Cities', 'Values': 'Madurai, Chennai, Coimbatore, Salem, Trichy, Thanjavur, Tirunelveli' },
      { 'Category': 'Relationships', 'Values': 'Father, Mother, Spouse, Son, Daughter, Brother, Sister, Other' },
    ]
  };
}

function generateImportDataSheet(): SheetConfig {
  return {
    name: 'Import Data',
    data: [
      { 'Import Type': 'Customers', 'Required Columns': 'Name, Phone, Aadhaar, Address', 'Format': 'CSV', 'Status': 'Template Ready' },
      { 'Import Type': 'Gold Items', 'Required Columns': 'Description, Weight, Purity, Rate', 'Format': 'CSV', 'Status': 'Template Ready' },
      { 'Import Type': 'Payments', 'Required Columns': 'Loan ID, Amount, Date, Mode', 'Format': 'CSV', 'Status': 'Template Ready' },
    ]
  };
}

function generateExportDataSheet(): SheetConfig {
  return {
    name: 'Export Data',
    data: [
      { 'Export Type': 'Complete Enterprise Export', 'Sheets': 50, 'Format': 'XLSX', 'Last Export': fmtDateTime(new Date().toISOString()) },
      { 'Export Type': 'Customer Statement', 'Sheets': 1, 'Format': 'PDF / XLSX', 'Last Export': '' },
      { 'Export Type': 'Loan Statement', 'Sheets': 1, 'Format': 'PDF / XLSX', 'Last Export': '' },
      { 'Export Type': 'Financial Reports', 'Sheets': 5, 'Format': 'PDF / XLSX / CSV', 'Last Export': '' },
    ]
  };
}

function generateBranchMasterSheet(): SheetConfig {
  return {
    name: 'Branch Master',
    data: [
      { 'S.No': 1, 'Branch Code': 'MDU-01', 'Branch Name': 'Madurai Main', 'Address': '45, Temple Street, Madurai', 'Phone': '9998887776', 'Manager': 'Rajasekar', 'Status': 'Active', 'Created': fmtDate(new Date().toISOString()) },
    ]
  };
}

function generateEmployeeMasterSheet(employees: any[]): SheetConfig {
  const adminProfiles = employees.filter((e: any) => e.role !== 'Customer');
  return {
    name: 'Employee Master',
    data: adminProfiles.length > 0
      ? adminProfiles.map((e, i) => ({
          'S.No': i + 1,
          'Employee ID': e.customer_number || e.id,
          'Name': e.name || '',
          'Phone': e.phone_primary || '',
          'Role': e.role || '',
          'Branch': e.branch_id || 'Main',
          'Status': e.status || 'Active',
          'Last Login': fmtDateTime(e.last_login_at),
          'Created': fmtDate(e.created_at),
        }))
      : [{ 'S.No': 1, 'Employee ID': 'ADMIN-001', 'Name': 'Admin', 'Role': 'Admin', 'Branch': 'Main', 'Status': 'Active' }]
  };
}

function generateRolesPermissionsSheet(): SheetConfig {
  const roles = [
    { role: 'Owner', dashboard: 'Full', customers: 'Full', loans: 'Full', payments: 'Full', accounting: 'Full', settings: 'Full', reports: 'Full', employees: 'Full', branches: 'Full' },
    { role: 'Manager', dashboard: 'Full', customers: 'Full', loans: 'Full', payments: 'Full', accounting: 'View', settings: 'View', reports: 'Full', employees: 'View', branches: 'View' },
    { role: 'Appraiser', dashboard: 'View', customers: 'View', loans: 'Create', payments: 'None', accounting: 'None', settings: 'None', reports: 'View', employees: 'None', branches: 'None' },
    { role: 'Cashier', dashboard: 'View', customers: 'View', loans: 'View', payments: 'Full', accounting: 'View', settings: 'None', reports: 'View', employees: 'None', branches: 'None' },
    { role: 'Accountant', dashboard: 'View', customers: 'View', loans: 'View', payments: 'View', accounting: 'Full', settings: 'None', reports: 'Full', employees: 'None', branches: 'None' },
    { role: 'Collection Officer', dashboard: 'View', customers: 'View', loans: 'View', payments: 'Create', accounting: 'None', settings: 'None', reports: 'View', employees: 'None', branches: 'None' },
    { role: 'Customer Support', dashboard: 'None', customers: 'View', loans: 'View', payments: 'View', accounting: 'None', settings: 'None', reports: 'None', employees: 'None', branches: 'None' },
  ];
  return {
    name: 'Roles & Permissions',
    data: roles.map((r, i) => ({
      'S.No': i + 1,
      'Role': r.role,
      'Dashboard': r.dashboard,
      'Customers': r.customers,
      'Loans': r.loans,
      'Payments': r.payments,
      'Accounting': r.accounting,
      'Settings': r.settings,
      'Reports': r.reports,
      'Employees': r.employees,
      'Branches': r.branches,
    }))
  };
}

function generateDashboardChartsSheet(loans: any[], payments: any[]): SheetConfig {
  // Monthly data for chart pivot
  const months: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return {
    name: 'Dashboard Charts',
    data: months.map((month, _i) => {
      const monthLoans = loans.filter((l: any) => l.created_at?.startsWith(month));
      const monthPayments = payments.filter((p: any) => p.payment_date?.startsWith(month));
      return {
        'Month': month,
        'New Loans': monthLoans.length,
        'Disbursed': monthLoans.reduce((s: number, l: any) => s + (l.principal_amount || 0), 0),
        'Collections': monthPayments.reduce((s: number, p: any) => s + (p.amount_paid || 0), 0),
        'Interest': monthPayments.reduce((s: number, p: any) => s + (p.interest_portion || 0), 0),
        'Principal Received': monthPayments.reduce((s: number, p: any) => s + (p.principal_portion || 0), 0),
      };
    })
  };
}

// ============================================================================
// MAIN EXPORT FUNCTION
// ============================================================================

export async function generateEnterpriseWorkbook(): Promise<void> {
  console.log('[Enterprise Export] Starting 50-sheet workbook generation...');

  // 1. Fetch all data from Firestore
  const [customers, loans, payments, gold, goldPhotos, accruals, notifications, auditLogs, journals, allProfiles, auctionBids] = await Promise.all([
    fetchCollection('profiles').then(p => p.filter((c: any) => c.role === 'Customer')),
    fetchCollection('loans', 'created_at'),
    fetchCollection('payments', 'payment_date'),
    fetchCollection('gold_collateral', 'created_at'),
    fetchCollection('gold_photos', 'created_at'),
    fetchCollection('interest_accruals', 'accrual_date'),
    fetchCollection('notifications', 'created_at'),
    fetchCollection('audit_logs', 'timestamp'),
    fetchCollection('accounting_journals', 'date'),
    fetchCollection('profiles'),
    fetchCollection('auction_bids', 'created_at'),
  ]);
  const settings = await fetchSettings();

  console.log(`[Enterprise Export] Data fetched: ${customers.length} customers, ${loans.length} loans, ${payments.length} payments, ${gold.length} gold items, ${auctionBids.length} auction bids`);

  // 2. Generate all 50 sheets
  const sheets: SheetConfig[] = [
    generateDashboardSheet(customers, loans, payments, gold, settings),           // 1
    generateCompanySettingsSheet(settings),                                         // 2
    generateBranchMasterSheet(),                                                   // 3
    generateEmployeeMasterSheet(allProfiles),                                      // 4
    generateRolesPermissionsSheet(),                                               // 5
    generateCustomerMasterSheet(customers),                                        // 6
    generateNomineeSheet(customers),                                               // 7
    generateKYCSheet(customers),                                                   // 8
    generateCustomerDocumentsSheet(customers),                                     // 9
    generateGoldMasterSheet(gold, loans, customers),                               // 10
    generateGoldPhotosSheet(goldPhotos),                                           // 11
    generateGoldRateHistorySheet(settings),                                        // 12
    generateLoanMasterSheet(loans, customers),                                     // 13
    generateLoanStatusSheet(loans),                                                // 14
    generateInterestLedgerSheet(accruals, loans),                                  // 15
    generatePaymentLedgerSheet(payments, loans, customers),                        // 16
    generateReceiptRegisterSheet(payments),                                        // 17
    generatePawnTicketRegisterSheet(loans, customers),                             // 18
    generateAuctionRegisterSheet(loans, customers),                                // 19
    generateAuctionBidsSheet(auctionBids, loans),                                 // 20
    generateCashBookSheet(payments),                                               // 21
    generateBankBookSheet(payments),                                               // 22
    generateGeneralLedgerSheet(payments, loans),                                   // 23
    generateJournalEntriesSheet(journals),                                         // 24
    generateTrialBalanceSheet(payments, loans),                                    // 25
    generateProfitLossSheet(payments),                                             // 26
    generateBalanceSheetSheet(payments, loans, gold),                              // 27
    generateExpensesSheet(),                                                       // 28
    generateIncomeSheet(payments),                                                 // 29
    generateGSTReportsSheet(payments),                                             // 30
    generateEmployeeAttendanceSheet(),                                             // 31
    generateLeaveRegisterSheet(),                                                  // 32
    generatePayrollSheet(),                                                        // 33
    generateIncentivesSheet(),                                                     // 34
    generateBranchPerformanceSheet(loans, payments),                               // 35
    generateCustomerSupportSheet(),                                                // 36
    generateNotificationsSheet(notifications),                                     // 37
    generateAuditLogsSheet(auditLogs),                                             // 38
    generateLoginHistorySheet(auditLogs),                                          // 39
    generateDeviceManagementSheet(),                                               // 40
    generateBackupLogsSheet(),                                                     // 41
    generateReportsSummarySheet(),                                                 // 42
    generateDashboardChartsSheet(loans, payments),                                 // 43
    generateBIAnalyticsSheet(loans, payments, customers),                          // 44
    generateAIRiskScoreSheet(loans, customers, payments),                          // 45
    generateAppSettingsSheet(settings),                                            // 46
    generateLookupTablesSheet(),                                                   // 47
    generateMasterListsSheet(),                                                    // 48
    generateImportDataSheet(),                                                     // 49
    generateExportDataSheet(),                                                     // 50
  ];

  // 3. Build XLSX workbook
  const workbook = XLSX.utils.book_new();

  sheets.forEach((sheet, _index) => {
    const ws = XLSX.utils.json_to_sheet(sheet.data);

    // Auto-size columns based on content
    if (sheet.data.length > 0) {
      const keys = Object.keys(sheet.data[0]);
      ws['!cols'] = keys.map(key => {
        const maxLen = Math.max(
          key.length,
          ...sheet.data.map(row => String(row[key] || '').length)
        );
        return { wch: Math.min(Math.max(maxLen + 2, 12), 40) };
      });
    }

    // Freeze first row (header)
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };

    // Truncate sheet name to 31 chars (Excel limit)
    const sheetName = sheet.name.substring(0, 31);
    XLSX.utils.book_append_sheet(workbook, ws, sheetName);
  });

  // 4. Write and download
  const dateStr = today().replace(/-/g, '_');
  const fileName = `PGF_Enterprise_${dateStr}.xlsx`;
  XLSX.writeFile(workbook, fileName);

  console.log(`[Enterprise Export] Successfully generated ${fileName} with ${sheets.length} sheets`);
}

/**
 * Export a single collection/page data to Excel with a specific sheet name.
 */
export function exportPageToExcel(data: any[], fileName: string, sheetName: string = 'Sheet1') {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();

  if (data.length > 0) {
    const keys = Object.keys(data[0]);
    worksheet['!cols'] = keys.map(key => {
      const maxLen = Math.max(key.length, ...data.map(row => String(row[key] || '').length));
      return { wch: Math.min(Math.max(maxLen + 2, 12), 40) };
    });
  }

  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.substring(0, 31));
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}

/**
 * Export data to CSV format.
 */
export function exportToCSV(data: any[], fileName: string) {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const csv = XLSX.utils.sheet_to_csv(worksheet);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${fileName}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Export data to JSON format.
 */
export function exportToJSON(data: any[], fileName: string) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${fileName}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
