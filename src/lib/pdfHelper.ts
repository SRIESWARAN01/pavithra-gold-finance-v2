// src/lib/pdfHelper.ts
// Universal PDF & Billing Document dispatcher for PGF.
// Handles preview, direct download (blob), native printing, and document URL generation with live data support.

import { auth } from '@/lib/firebase';

export interface PdfParams {
  type: 
    | 'ticket' 
    | 'pawn_ticket' 
    | 'loan_agreement'
    | 'receipt' 
    | 'payment_receipt' 
    | 'bill'
    | 'payment_bill'
    | 'interest_receipt'
    | 'principal_receipt'
    | 'partial_receipt'
    | 'settlement_receipt'
    | 'penalty_receipt'
    | 'closure'
    | 'loan_closure'
    | 'release'
    | 'release_certificate'
    | 'release_receipt'
    | 'gold_release'
    | 'statement'
    | 'loan_statement'
    | 'customer_statement'
    | 'outstanding_statement'
    | 'loan_application'
    | 'invoice'
    | 'ledger'
    | 'journal'
    | 'trial'
    | 'balance_sheet'
    | 'profit_loss'
    | 'monthly_auditor_report'
    | 'renewal_receipt'
    | 'renewal'
    | 'repledge'
    | 'bank_repledge'
    | 'report'
    | 'investment_receipt'
    | 'additional_investment_receipt'
    | 'withdrawal_request'
    | 'withdrawal_approval'
    | 'withdrawal_settlement_receipt'
    | 'investor_statement'
    | 'portfolio_statement';
  loanId?: string | null;
  paymentId?: string | null;
  customerId?: string | null;
  repledgeId?: string | null;
  investorId?: string | null;
  transactionId?: string | null;
  withdrawalId?: string | null;
  fromDate?: string | null;
  toDate?: string | null;
  branchId?: string | null;
  report?: string | null;
  month?: string | null;
  amount?: number | null;
  download?: boolean;
  filename?: string | null;
  token?: string | null;
  format?: 'a4' | 'thermal' | null;
  payload?: any;
}

/**
 * Construct sanitized API URL for PDF generation
 */
export function getPdfApiUrl(params: PdfParams, token?: string | null): string {
  const queryParams = new URLSearchParams();
  queryParams.set('type', params.type);
  if (params.loanId) queryParams.set('loanId', params.loanId);
  if (params.paymentId) queryParams.set('paymentId', params.paymentId);
  if (params.customerId) queryParams.set('customerId', params.customerId);
  if (params.repledgeId) queryParams.set('repledgeId', params.repledgeId);
  if (params.investorId) queryParams.set('investorId', params.investorId);
  if (params.transactionId) queryParams.set('transactionId', params.transactionId);
  if (params.withdrawalId) queryParams.set('withdrawalId', params.withdrawalId);
  if (params.fromDate) queryParams.set('fromDate', params.fromDate);
  if (params.toDate) queryParams.set('toDate', params.toDate);
  if (params.branchId) queryParams.set('branchId', params.branchId);
  if (params.report) queryParams.set('report', params.report);
  if (params.month) queryParams.set('month', params.month);
  if (params.amount !== undefined && params.amount !== null) queryParams.set('amount', String(params.amount));
  if (params.download) queryParams.set('download', 'true');
  if (params.filename) queryParams.set('filename', params.filename);
  if (params.format) queryParams.set('format', params.format);

  const effectiveToken = token || params.token;
  if (effectiveToken) {
    queryParams.set('token', effectiveToken);
  }

  return `/api/pdf?${queryParams.toString()}`;
}

/**
 * Asynchronously generate an authorized PDF URL with the active user's Firebase ID token
 */
export async function getAuthorizedPdfUrl(params: PdfParams): Promise<string> {
  let token: string | null = null;
  try {
    if (auth.currentUser) {
      token = await auth.currentUser.getIdToken(true);
    }
  } catch (err) {
    console.warn('Could not acquire ID token for PDF URL:', err);
  }
  return getPdfApiUrl(params, token);
}

/**
 * Trigger direct file download in browser across all devices with authenticated fetch
 */
export async function downloadPdfDocument(params: PdfParams, defaultFilename?: string): Promise<void> {
  try {
    let token: string | null = null;
    try {
      if (auth.currentUser) {
        token = await auth.currentUser.getIdToken(true);
      }
    } catch {}

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const bodyPayload = {
      type: params.type,
      loanId: params.loanId,
      paymentId: params.paymentId,
      customerId: params.customerId,
      repledgeId: params.repledgeId,
      branchId: params.branchId,
      report: params.report,
      month: params.month,
      customAmount: params.amount,
      download: true,
      token,
      format: params.format,
      ...(params.payload || {})
    };

    const res = await fetch('/api/pdf', {
      method: 'POST',
      headers,
      body: JSON.stringify(bodyPayload)
    });

    if (!res.ok) {
      // Fallback to GET with token
      const fallbackUrl = getPdfApiUrl({ ...params, download: true }, token);
      window.open(fallbackUrl, '_blank');
      return;
    }

    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    
    let filename = defaultFilename || `${params.type}_${Date.now()}.pdf`;
    const disposition = res.headers.get('Content-Disposition');
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename="?([^";]+)"?/);
      if (match && match[1]) filename = match[1];
    }

    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    }, 200);
  } catch (err: any) {
    console.error('Error downloading PDF via POST, trying GET fallback:', err);
    let token: string | null = null;
    try {
      if (auth.currentUser) token = await auth.currentUser.getIdToken(true);
    } catch {}
    window.open(getPdfApiUrl({ ...params, download: true }, token), '_blank');
  }
}

/**
 * Trigger browser print dialog for document with authenticated fetch
 */
export async function printPdfDocument(params: PdfParams): Promise<void> {
  try {
    let token: string | null = null;
    try {
      if (auth.currentUser) {
        token = await auth.currentUser.getIdToken(true);
      }
    } catch {}

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const bodyPayload = {
      type: params.type,
      loanId: params.loanId,
      paymentId: params.paymentId,
      customerId: params.customerId,
      repledgeId: params.repledgeId,
      branchId: params.branchId,
      report: params.report,
      month: params.month,
      customAmount: params.amount,
      token,
      ...(params.payload || {})
    };

    const res = await fetch('/api/pdf', {
      method: 'POST',
      headers,
      body: JSON.stringify(bodyPayload)
    });

    if (!res.ok) {
      window.open(getPdfApiUrl(params, token), '_blank');
      return;
    }

    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.src = blobUrl;

    document.body.appendChild(iframe);

    iframe.onload = () => {
      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (e) {
          window.open(blobUrl, '_blank');
        }
        setTimeout(() => {
          document.body.removeChild(iframe);
          window.URL.revokeObjectURL(blobUrl);
        }, 1000);
      }, 500);
    };
  } catch (err) {
    console.error('Error printing PDF:', err);
    let token: string | null = null;
    try {
      if (auth.currentUser) token = await auth.currentUser.getIdToken(true);
    } catch {}
    window.open(getPdfApiUrl(params, token), '_blank');
  }
}
