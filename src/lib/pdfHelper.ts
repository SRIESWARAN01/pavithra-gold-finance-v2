// src/lib/pdfHelper.ts
// Universal PDF & Billing Document dispatcher for PGF.
// Handles preview, direct download (blob), native printing, and document URL generation with live data support.

import { db } from '@/lib/firebase';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';

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
    | 'report';
  loanId?: string | null;
  paymentId?: string | null;
  customerId?: string | null;
  branchId?: string | null;
  report?: string | null;
  month?: string | null;
  amount?: number | null;
  download?: boolean;
  filename?: string | null;
  payload?: any;
}

/**
 * Construct sanitized API URL for PDF generation
 */
export function getPdfApiUrl(params: PdfParams): string {
  const queryParams = new URLSearchParams();
  queryParams.set('type', params.type);
  if (params.loanId) queryParams.set('loanId', params.loanId);
  if (params.paymentId) queryParams.set('paymentId', params.paymentId);
  if (params.customerId) queryParams.set('customerId', params.customerId);
  if (params.branchId) queryParams.set('branchId', params.branchId);
  if (params.report) queryParams.set('report', params.report);
  if (params.month) queryParams.set('month', params.month);
  if (params.amount !== undefined && params.amount !== null) queryParams.set('amount', String(params.amount));
  if (params.download) queryParams.set('download', 'true');
  if (params.filename) queryParams.set('filename', params.filename);

  return `/api/pdf?${queryParams.toString()}`;
}

/**
 * Fetch rich live context on client if not provided in payload
 */
async function resolveLivePayload(params: PdfParams): Promise<any> {
  if (params.payload) return params.payload;

  const payload: any = { type: params.type };

  try {
    // 1. Fetch Loan if loanId or paymentId provided
    if (params.loanId) {
      const loanSnap = await getDoc(doc(db, 'loans', params.loanId));
      if (loanSnap.exists()) {
        payload.loanData = { id: loanSnap.id, ...loanSnap.data() };
        
        // Fetch Customer for this loan
        if (payload.loanData.customer_id) {
          const custSnap = await getDoc(doc(db, 'profiles', payload.loanData.customer_id));
          if (custSnap.exists()) {
            payload.customerData = { id: custSnap.id, ...custSnap.data() };
          }
        }

        // Fetch Gold items
        const goldSnap = await getDocs(query(collection(db, 'gold_collateral'), where('loan_id', '==', params.loanId)));
        payload.goldItems = goldSnap.docs.map(g => ({ id: g.id, ...g.data() }));

        // Fetch payments for this loan
        const pmtSnap = await getDocs(query(collection(db, 'payments'), where('loan_id', '==', params.loanId)));
        payload.paymentsHistory = pmtSnap.docs.map(p => ({ id: p.id, ...p.data() }));
      }
    }

    // 2. Fetch Customer directly if customerId provided
    if (params.customerId && !payload.customerData) {
      const custSnap = await getDoc(doc(db, 'profiles', params.customerId));
      if (custSnap.exists()) {
        payload.customerData = { id: custSnap.id, ...custSnap.data() };
      }
    }

    // 3. Fetch Customer All Loans if customer statement
    if (payload.customerData?.id && (params.type === 'customer_statement' || params.type === 'statement')) {
      const loansSnap = await getDocs(query(collection(db, 'loans'), where('customer_id', '==', payload.customerData.id)));
      payload.customerLoansList = loansSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const allPmtsSnap = await getDocs(query(collection(db, 'payments'), where('customer_id', '==', payload.customerData.id)));
      payload.paymentsHistory = allPmtsSnap.docs.map(p => ({ id: p.id, ...p.data() }));
    }

    // 4. Fetch Payment if paymentId provided
    if (params.paymentId) {
      const paySnap = await getDoc(doc(db, 'payments', params.paymentId));
      if (paySnap.exists()) {
        payload.paymentData = { id: paySnap.id, ...paySnap.data() };
        if (payload.paymentData.loan_id && !payload.loanData) {
          const lSnap = await getDoc(doc(db, 'loans', payload.paymentData.loan_id));
          if (lSnap.exists()) payload.loanData = { id: lSnap.id, ...lSnap.data() };
        }
        if (payload.paymentData.customer_id && !payload.customerData) {
          const cSnap = await getDoc(doc(db, 'profiles', payload.paymentData.customer_id));
          if (cSnap.exists()) payload.customerData = { id: cSnap.id, ...cSnap.data() };
        }
      }
    }
  } catch (err) {
    console.warn('Could not fully resolve client live payload for PDF:', err);
  }

  return payload;
}

/**
 * Trigger direct file download in browser across all devices
 */
export async function downloadPdfDocument(params: PdfParams, defaultFilename?: string): Promise<void> {
  try {
    const payload = await resolveLivePayload(params);
    
    const res = await fetch('/api/pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, download: true, customAmount: params.amount })
    });

    if (!res.ok) {
      // Fallback to GET
      const fallbackUrl = getPdfApiUrl({ ...params, download: true });
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
    window.open(getPdfApiUrl({ ...params, download: true }), '_blank');
  }
}

/**
 * Trigger browser print dialog for document
 */
export async function printPdfDocument(params: PdfParams): Promise<void> {
  try {
    const payload = await resolveLivePayload(params);
    
    const res = await fetch('/api/pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, customAmount: params.amount })
    });

    if (!res.ok) {
      window.open(getPdfApiUrl(params), '_blank');
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
    window.open(getPdfApiUrl(params), '_blank');
  }
}
