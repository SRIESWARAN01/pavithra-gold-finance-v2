import { NextRequest } from 'next/server';
import PDFDocument from 'pdfkit/js/pdfkit.standalone';
import { adminAuth, adminDb, adminStorage } from '@/lib/firebase-admin';
import path from 'path';
import fs from 'fs';
import { getNextBillSlogan } from '@/lib/db/slogans';
import type { UserRole } from '@/types/database';

/**
 * Convert number into Indian Currency Words (e.g. "RUPEES TWENTY-FIVE THOUSAND ONLY")
 */
function numberToIndianWords(num: number): string {
  if (!num || isNaN(num) || num <= 0) return 'RUPEES ZERO ONLY';
  
  const a = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'];
  const b = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];

  function inWords(n: number): string {
    if (n === 0) return '';
    if (n < 20) return a[n] + ' ';
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '') + ' ';
    if (n < 1000) return a[Math.floor(n / 100)] + ' HUNDRED ' + inWords(n % 100);
    if (n < 100000) return inWords(Math.floor(n / 1000)) + 'THOUSAND ' + inWords(n % 1000);
    if (n < 10000000) return inWords(Math.floor(n / 100000)) + 'LAKH ' + inWords(n % 100000);
    return inWords(Math.floor(n / 10000000)) + 'CRORE ' + inWords(n % 10000000);
  }

  const rounded = Math.round(num);
  return `RUPEES ${inWords(rounded).trim().toUpperCase()} ONLY`;
}

function formatINR(val: number): string {
  return '₹' + (val || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

/**
 * Authenticate incoming request via Firebase ID Token
 */
async function authenticatePdfRequest(
  req: NextRequest,
  body?: any
): Promise<{ uid: string; role: UserRole }> {
  // 1. Check Authorization header
  const authHeader = req.headers.get('authorization');
  let token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  // 2. Check query param or body
  if (!token) {
    const { searchParams } = new URL(req.url);
    token = searchParams.get('token') || body?.token || null;
  }

  const isDev = process.env.NODE_ENV !== 'production';

  if (!token) {
    if (isDev && (process.env.DEV_BYPASS_PDF_AUTH === 'true' || process.env.TEST_ENV === 'true')) {
      return { uid: 'dev_admin', role: 'Admin' };
    }
    throw new Error('UNAUTHORIZED: Authentication is required to generate or download documents.');
  }

  // Handle mock dev tokens in non-production environments
  if (isDev) {
    if (token === 'test-dev-admin-token' || token === 'test-dev-token') {
      return { uid: 'dev_admin', role: 'Admin' };
    }
    if (token === 'test-dev-customer-token') {
      return { uid: 'cust_sample_123', role: 'Customer' };
    }
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;
    let role = (decoded.role as UserRole) || null;

    if (!role) {
      const profileSnap = await adminDb.collection('profiles').doc(uid).get();
      if (profileSnap.exists) {
        role = (profileSnap.data()?.role as UserRole) || 'Customer';
      } else {
        role = 'Customer';
      }
    }

    return { uid, role };
  } catch (err: any) {
    throw new Error(`UNAUTHORIZED: Invalid or expired authentication token (${err.message || 'Verification failed'}).`);
  }
}

/**
 * Authorize requesting user for requested document type and target customer (BILL-02)
 */
function checkDocumentAccess(
  caller: { uid: string; role: UserRole },
  type: string,
  targetCustomerId?: string | null
): void {
  const staffRoles: UserRole[] = ['Admin', 'Owner', 'Manager', 'Appraiser', 'Cashier', 'Employee', 'Accountant'];
  const isStaff = staffRoles.includes(caller.role);

  if (isStaff) {
    return; // Staff can generate all documents
  }

  if (caller.role === 'Customer') {
    const allowedCustomerDocTypes = [
      'ticket', 'pawn_ticket', 'loan_agreement',
      'receipt', 'payment_receipt', 'bill', 'payment_bill',
      'interest_receipt', 'principal_receipt', 'partial_receipt',
      'settlement_receipt', 'closure', 'loan_closure',
      'release', 'release_certificate', 'release_receipt', 'gold_release',
      'statement', 'loan_statement', 'customer_statement', 'outstanding_statement',
      'loan_application', 'renewal_receipt', 'renewal', 'repledge'
    ];

    if (!allowedCustomerDocTypes.includes(type)) {
      throw new Error('FORBIDDEN: Customers are not permitted to access internal accounting ledgers or audit reports.');
    }

    if (targetCustomerId && targetCustomerId !== caller.uid) {
      throw new Error('FORBIDDEN: You do not have permission to view or download documents belonging to another customer.');
    }

    return;
  }

  throw new Error('FORBIDDEN: Insufficient permissions to access this document.');
}

/**
 * Fetch image buffer from Firebase Storage bucket or external URL (IMG-02)
 */
async function fetchImageBuffer(urlOrData: string | null | undefined): Promise<Buffer | null> {
  if (!urlOrData) return null;

  // Handle data URIs
  if (urlOrData.startsWith('data:image')) {
    const commaIdx = urlOrData.indexOf(',');
    if (commaIdx !== -1) {
      return Buffer.from(urlOrData.slice(commaIdx + 1), 'base64');
    }
    return null;
  }

  // Handle Firebase Storage URLs or gs:// URIs using Admin SDK
  try {
    if (urlOrData.includes('firebasestorage.googleapis.com') || urlOrData.startsWith('gs://')) {
      let objectPath: string | null = null;
      if (urlOrData.startsWith('gs://')) {
        const parts = urlOrData.replace('gs://', '').split('/');
        parts.shift(); // remove bucket
        objectPath = parts.join('/');
      } else {
        const match = urlOrData.match(/\/o\/([^?]+)/);
        if (match && match[1]) {
          objectPath = decodeURIComponent(match[1]);
        }
      }

      if (objectPath) {
        try {
          const bucket = adminStorage.bucket();
          const file = bucket.file(objectPath);
          const [exists] = await file.exists();
          if (exists) {
            const [buffer] = await file.download();
            return buffer;
          }
        } catch (storageErr) {
          console.warn('[PDF] Admin storage direct download notice:', storageErr);
        }
      }
    }

    // Fallback: standard HTTP fetch
    const res = await fetch(urlOrData);
    if (res.ok) {
      const ab = await res.arrayBuffer();
      return Buffer.from(ab);
    }
  } catch (err) {
    console.warn('[PDF] Failed to fetch image buffer:', err);
  }

  return null;
}

/**
 * Helper to normalize and deduplicate collateral photo URLs (IMG-01)
 */
function getCollateralPhotoUrls(items: any[]): string[] {
  return items.flatMap(g => {
    const urls: string[] = [];
    if (g.front_photo_url) urls.push(g.front_photo_url);
    if (g.back_photo_url) urls.push(g.back_photo_url);
    if (g.side_photo_url) urls.push(g.side_photo_url);
    if (Array.isArray(g.photos)) urls.push(...g.photos);
    return urls;
  }).filter((url, idx, arr) => Boolean(url) && arr.indexOf(url) === idx);
}

/**
 * Validate required legal business settings for document generation (BILL-03)
 */
function validateCompanySettings(settings: Record<string, string>): { isValid: boolean; missing: string[] } {
  const required = ['company_name', 'company_address', 'company_phone', 'company_gst'];
  const missing = required.filter(k => !settings[k] || settings[k].trim() === '');
  return {
    isValid: missing.length === 0,
    missing,
  };
}

function documentErrorStatus(error: unknown): number {
  const message = error instanceof Error ? error.message : '';
  if (message.startsWith('UNAUTHORIZED')) return 401;
  if (message.startsWith('FORBIDDEN')) return 403;
  if (message.startsWith('NOT_FOUND')) return 404;
  if (message.startsWith('INVALID')) return 400;
  return 500;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const caller = await authenticatePdfRequest(req, body);
    return await generatePdfResponse(body, caller);
  } catch (err: any) {
    console.error('PDF POST Error:', err);
    const status = documentErrorStatus(err);
    return new Response(JSON.stringify({ error: err.message || 'Failed to generate PDF' }), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function GET(req: NextRequest) {
  try {
    const caller = await authenticatePdfRequest(req);
    const { searchParams } = new URL(req.url);
    const rawType = searchParams.get('type') || 'ticket';
    const loanId = searchParams.get('loanId') || '';
    const paymentId = searchParams.get('paymentId') || '';
    const customerId = searchParams.get('customerId') || '';
    const repledgeId = searchParams.get('repledgeId') || '';
    const isDownload = searchParams.get('download') === 'true';
    const customAmount = parseFloat(searchParams.get('amount') || '0');
    const format = searchParams.get('format') || 'a4';

    const params: any = {
      type: rawType,
      loanId,
      paymentId,
      customerId,
      repledgeId,
      download: isDownload,
      customAmount,
      format,
    };

    return await generatePdfResponse(params, caller);
  } catch (err: any) {
    console.error('PDF GET Error:', err);
    const status = documentErrorStatus(err);
    return new Response(JSON.stringify({ error: err.message || 'Failed to generate PDF' }), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function generatePdfResponse(params: any, caller?: { uid: string; role: UserRole }) {
  const rawType = params.type || 'ticket';
  const type = rawType.toLowerCase();
  const isDownload = Boolean(params.download);
  const customAmount = parseFloat(params.customAmount || '0');

  // 1. Authoritative Fetch of Company Settings (BILL-03)
  let companyName = 'PAVITHRA GOLD FINANCE';
  let companyLogo = '';
  let companyAddress = '45, Temple View Complex, West Masi Street, Madurai - 625001';
  let companyPhone = '7094826586';
  let companyEmail = 'support@pavithragoldfinance.com';
  let companyGst = '33AABCP1234F1Z8';
  let companyPan = 'AABCP1234F';
  let companyCin = 'U65923TN2022PTC149821';
  const companyWebsite = 'www.pavithragoldfinance.com';
  let companyBranchName = 'Madurai Main Hub';
  const companyBranchCode = 'MDU-01';
  const companyDescription = 'TAMIL NADU LICENSED PAWNBROKER & GOLD FINANCIER • GOVT REG: TN/MDU/PB/2022/894';

  try {
    const settingsSnap = await adminDb.collection('settings').get();
    const rawSettings: Record<string, string> = {};
    settingsSnap.forEach((d) => {
      const data = d.data();
      if (data && data.value) {
        rawSettings[d.id] = String(data.value);
        if (d.id === 'company_name') companyName = data.value;
        if (d.id === 'company_logo') companyLogo = data.value;
        if (d.id === 'company_address') companyAddress = data.value;
        if (d.id === 'company_phone') companyPhone = data.value;
        if (d.id === 'company_email') companyEmail = data.value;
        if (d.id === 'company_gst') companyGst = data.value;
        if (d.id === 'company_pan') companyPan = data.value;
        if (d.id === 'company_cin') companyCin = data.value;
        if (d.id === 'company_branch_name') companyBranchName = data.value;
      }
    });

    const validation = validateCompanySettings(rawSettings);
    if (!validation.isValid && process.env.NODE_ENV === 'production' && !params.allowFallbackSettings) {
      console.warn(`[PDF BILL-03 Warning] Incomplete production company settings: ${validation.missing.join(', ')}`);
    }
  } catch (e) {
    // Graceful fallback to licensed defaults
  }

  // 2. Authoritative Server-Side Data Retrieval via Admin SDK (BILL-01, BILL-02)
  let paymentData: any = null;
  let loanData: any = null;
  let customerData: any = null;
  let repledgeData: any = null;
  let goldItems: any[] = [];
  let paymentsHistory: any[] = [];
  let customerLoansList: any[] = [];

  // Helper for Data URI
  const toDataUri = (buf: Buffer | null, mime = 'image/png'): string | null => {
    if (!buf) return null;
    return `data:${mime};base64,${buf.toString('base64')}`;
  };

  // Retrieve Re-Pledge record if repledgeId provided
  if (params.repledgeId) {
    try {
      let rSnap = await adminDb.collection('bankRePledges').doc(params.repledgeId).get();
      if (!rSnap.exists) {
        // Try searching by repledge_number
        const qR = await adminDb.collection('bankRePledges').where('repledge_number', '==', params.repledgeId).limit(1).get();
        if (!qR.empty) {
          rSnap = qR.docs[0];
        }
      }
      if (rSnap.exists) {
        repledgeData = { id: rSnap.id, ...rSnap.data() };
      }
    } catch (e) {
      console.warn('[PDF] Error fetching repledge:', e);
    }
  }

  // Retrieve Payment record if paymentId provided
  if (params.paymentId) {
    try {
      const paySnap = await adminDb.collection('payments').doc(params.paymentId).get();
      if (paySnap.exists) paymentData = { id: paySnap.id, ...paySnap.data() };
    } catch (e) {
      console.warn('[PDF] Error fetching payment:', e);
    }
  }

  if (params.paymentId && !paymentData) {
    throw new Error('NOT_FOUND: Payment record was not found. A receipt cannot be generated without its saved payment.');
  }

  // Retrieve Loan record if loanId provided or inferred from payment or repledge
  const targetLoanId = params.loanId || paymentData?.loan_id || repledgeData?.loan_id;
  if (targetLoanId) {
    try {
      let loanSnap = await adminDb.collection('loans').doc(targetLoanId).get();
      if (!loanSnap.exists) {
        // Fallback: search by loan_number
        const qSnap = await adminDb.collection('loans').where('loan_number', '==', targetLoanId).limit(1).get();
        if (!qSnap.empty) {
          loanSnap = qSnap.docs[0];
        }
      }
      if (loanSnap.exists) loanData = { id: loanSnap.id, ...loanSnap.data() };
    } catch (e) {
      console.warn('[PDF] Error fetching loan:', e);
    }
  }

  // If repledge was requested by loanId and not yet loaded, find active/latest repledge for this loan
  if (!repledgeData && targetLoanId && (type === 'repledge' || type === 'bank_repledge')) {
    try {
      let rQuery = await adminDb.collection('bankRePledges').where('loan_id', '==', targetLoanId).limit(1).get();
      if (rQuery.empty && loanData?.loan_number) {
        rQuery = await adminDb.collection('bankRePledges').where('loan_number', '==', loanData.loan_number).limit(1).get();
      }
      if (!rQuery.empty) {
        repledgeData = { id: rQuery.docs[0].id, ...rQuery.docs[0].data() };
      }
    } catch (e) {
      console.warn('[PDF] Error finding repledge by loan:', e);
    }
  }

  if (targetLoanId && !loanData) {
    throw new Error('NOT_FOUND: Loan record was not found.');
  }

  if (params.loanId && paymentData?.loan_id && loanData?.id !== paymentData.loan_id) {
    throw new Error('INVALID: The supplied payment does not belong to the supplied loan.');
  }

  // Determine target customer ID and enforce document authorization (BILL-02)
  const recordCustomerId = loanData?.customer_id || paymentData?.customer_id || null;
  if (params.customerId && recordCustomerId && params.customerId !== recordCustomerId) {
    throw new Error('INVALID: The supplied customer does not own the requested loan or payment.');
  }
  const targetCustId = params.customerId || recordCustomerId;
  if (caller) {
    checkDocumentAccess(caller, type, targetCustId);
  }

  // Retrieve Customer profile
  if (targetCustId) {
    try {
      const custSnap = await adminDb.collection('profiles').doc(targetCustId).get();
      if (custSnap.exists) customerData = { id: custSnap.id, ...custSnap.data() };
    } catch (e) {
      console.warn('[PDF] Error fetching profile:', e);
    }
  }

  if (targetCustId && !customerData) {
    throw new Error('NOT_FOUND: Customer profile was not found for the requested document.');
  }

  // Financial documents must always originate from a persisted record. This
  // prevents placeholder PDFs, fabricated bill values, and cross-customer
  // access when callers supply invalid identifiers.
  const paymentDocumentTypes = new Set([
    'receipt', 'payment_receipt', 'bill', 'payment_bill', 'interest_receipt',
    'principal_receipt', 'partial_receipt', 'settlement_receipt', 'penalty_receipt',
    'renewal_receipt', 'renewal'
  ]);
  const loanDocumentTypes = new Set([
    'ticket', 'pawn_ticket', 'loan_agreement', 'loan_application', 'release',
    'release_certificate', 'release_receipt', 'gold_release', 'closure',
    'loan_closure', 'loan_statement', 'outstanding_statement', 'repledge', 'bank_repledge',
    'renewal_receipt', 'renewal'
  ]);
  const customerDocumentTypes = new Set(['customer_statement', 'statement']);
  if (paymentDocumentTypes.has(type) && !paymentData) {
    throw new Error('INVALID: A saved payment ID is required for this receipt or bill.');
  }
  if (loanDocumentTypes.has(type) && !loanData) {
    throw new Error('INVALID: A saved loan ID is required for this document.');
  }
  if (customerDocumentTypes.has(type) && !customerData) {
    throw new Error('INVALID: A saved customer ID is required for this statement.');
  }

  // Retrieve Gold Collateral Items and Gallery Photos (IMG-01)
  if (loanData?.id) {
    try {
      const goldSnap = await adminDb.collection('gold_collateral').where('loan_id', '==', loanData.id).get();
      goldItems = goldSnap.docs.map(g => ({ id: g.id, ...g.data() }));

      // Also retrieve gold_photos collection records for complete photographic evidence
      const photosSnap = await adminDb.collection('gold_photos').where('loan_id', '==', loanData.id).get();
      const photosByCollateral = new Map<string, string[]>();
      photosSnap.docs.forEach(pDoc => {
        const p = pDoc.data();
        if (p.collateral_id && p.photo_url) {
          const list = photosByCollateral.get(p.collateral_id) || [];
          list.push(p.photo_url);
          photosByCollateral.set(p.collateral_id, list);
        }
      });

      goldItems.forEach(item => {
        const gallery = photosByCollateral.get(item.id) || [];
        item.photos = Array.from(new Set([
          ...(item.photos || []),
          ...gallery,
          item.front_photo_url,
          item.back_photo_url,
          item.side_photo_url,
        ].filter(Boolean)));
      });
    } catch (e) {
      console.warn('[PDF] Error fetching collateral:', e);
    }
  }

  // Retrieve Customer All Loans if customer statement
  if (customerData?.id && (type === 'customer_statement' || type === 'statement')) {
    try {
      const lSnap = await adminDb.collection('loans').where('customer_id', '==', customerData.id).get();
      customerLoansList = lSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.warn('[PDF] Error fetching customer loans list:', e);
    }
  }

  // Retrieve Payments History for loan or customer
  if (loanData?.id) {
    try {
      const pSnap = await adminDb.collection('payments').where('loan_id', '==', loanData.id).get();
      paymentsHistory = pSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      paymentsHistory.sort((a, b) => (b.payment_date || '').localeCompare(a.payment_date || ''));
    } catch (e) {
      console.warn('[PDF] Error fetching payments history:', e);
    }
  } else if (customerData?.id) {
    try {
      const pSnap = await adminDb.collection('payments').where('customer_id', '==', customerData.id).get();
      paymentsHistory = pSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      paymentsHistory.sort((a, b) => (b.payment_date || '').localeCompare(a.payment_date || ''));
    } catch (e) {
      console.warn('[PDF] Error fetching customer payments:', e);
    }
  }

  // Pre-load images using secure Admin Storage buffer retrieval (IMG-02)
  let logoUri: string | null = null;
  if (companyLogo) {
    const buf = await fetchImageBuffer(companyLogo);
    if (buf) logoUri = toDataUri(buf, 'image/png');
  }

  let customerPhotoUri: string | null = null;
  if (customerData?.photo_url) {
    const buf = await fetchImageBuffer(customerData.photo_url);
    if (buf) customerPhotoUri = toDataUri(buf, 'image/jpeg');
  }

  let customerSignatureUri: string | null = null;
  if (customerData?.signature_url) {
    const buf = await fetchImageBuffer(customerData.signature_url);
    if (buf) customerSignatureUri = toDataUri(buf, 'image/png');
  }

  // Generate QR Code verification Data URI
  let qrDataUri: string | null = null;
  try {
    const qrIdentifier = loanData?.loan_number || paymentData?.receipt_number || customerData?.customer_number || 'PGF-VERIFY';
    const qrData = `https://pavithragoldfinance.com/verify?code=${encodeURIComponent(qrIdentifier)}&auth=verified`;
    const qrRes = await fetch(`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrData)}&format=png&margin=4&color=0A192F&bgcolor=FFFFFF`);
    if (qrRes.ok) {
      const qrBuf = Buffer.from(await qrRes.arrayBuffer());
      qrDataUri = toDataUri(qrBuf, 'image/png');
    }
  } catch {}

  // Set up PDFKit (A4 or 80mm POS Thermal Roll)
  const isThermal = params.format === 'thermal';
  const docPdf = isThermal
    ? new PDFDocument({ size: [226, 750], margin: 10 })
    : new PDFDocument({ size: 'A4', margin: 36 });
  const chunks: Buffer[] = [];
  docPdf.on('data', (chunk: Buffer) => chunks.push(chunk));

  // Load TrueType Tamil Unicode font for slogans & statutory Tamil text
  const fontPath = path.join(process.cwd(), 'public', 'fonts', 'Nirmala.ttf');
  let hasTamilFont = false;
  if (fs.existsSync(fontPath)) {
    try {
      const fontBuf = fs.readFileSync(fontPath);
      docPdf.registerFont('TamilFont', fontBuf);
      hasTamilFont = true;
    } catch (fontErr) {
      console.warn('Notice: Could not register TamilFont:', fontErr);
    }
  }

  // Slogan resolution (from payment record or atomic sequential rotation across 300 slogans)
  let billSloganText = paymentData?.slogan_text || '';
  let billSloganId = paymentData?.slogan_id || '';

  if (!billSloganText && (type === 'receipt' || type === 'payment_receipt' || type === 'bill' || type === 'payment_bill' || type === 'ticket' || type === 'pawn_ticket')) {
    try {
      const assigned = await getNextBillSlogan();
      billSloganText = assigned.sloganText;
      billSloganId = assigned.sloganId;
    } catch (sErr) {
      console.warn('Notice: Error assigning next bill slogan:', sErr);
    }
  }

  // Visual Palette
  const brandBlue = '#1e3a8a';
  const brandDark = '#0f172a';
  const brandGold = '#b45309';
  const textMuted = '#475569';
  const borderGray = '#cbd5e1';
  const lightCardBg = '#f8fafc';
  const todayStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  // --------------------------------------------------------------------------
  // HEADER COMPONENT (Clean & Standardized for all documents)
  // --------------------------------------------------------------------------
  const drawStandardHeader = (title: string, subBadge: string) => {
    // Logo or Monogram
    if (logoUri) {
      try {
        docPdf.image(logoUri, 36, 32, { width: 50 });
      } catch {
        docPdf.fillColor(brandBlue).rect(36, 32, 50, 50).fill();
        docPdf.fillColor('#ffffff').fontSize(14).font('Helvetica-Bold').text('PGF', 44, 48);
      }
    } else {
      docPdf.fillColor(brandBlue).rect(36, 32, 50, 50).fill();
      docPdf.fillColor('#ffffff').fontSize(14).font('Helvetica-Bold').text('PGF', 44, 48);
    }

    // Company Identity
    docPdf.fillColor(brandBlue).fontSize(16).font('Helvetica-Bold').text(companyName.toUpperCase(), 96, 32);
    docPdf.fillColor(brandGold).fontSize(7).font('Helvetica-Bold').text(companyDescription.toUpperCase(), 96, 50);
    docPdf.fillColor(textMuted).fontSize(6.5).font('Helvetica')
          .text(`Branch: ${companyBranchName} (${companyBranchCode})  |  Address: ${companyAddress}`, 96, 61)
          .text(`Phone: +91 ${companyPhone}  |  Email: ${companyEmail}  |  GSTIN: ${companyGst}  |  PAN: ${companyPan}`, 96, 71);

    // QR Verification Code
    if (qrDataUri) {
      try {
        docPdf.image(qrDataUri, 498, 30, { width: 60, height: 60 });
        docPdf.fillColor(brandBlue).fontSize(5).font('Helvetica-Bold').text('SCAN TO VERIFY', 492, 92, { width: 72, align: 'center' });
      } catch {}
    }

    // Divider
    docPdf.strokeColor(borderGray).lineWidth(0.8).moveTo(36, 102).lineTo(558, 102).stroke();

    // Document Title Strip
    docPdf.fillColor(brandDark).rect(36, 108, 522, 22).fill();
    docPdf.fillColor('#ffffff').fontSize(9.5).font('Helvetica-Bold').text(title.toUpperCase(), 46, 114);
    docPdf.fillColor('#fbbf24').fontSize(7.5).font('Helvetica-Bold').text(subBadge, 400, 115, { align: 'right', width: 148 });
  };

  // --------------------------------------------------------------------------
  // 1. PAWN TICKET / PLEDGE BILL (ticket / pawn_ticket / loan_agreement)
  // --------------------------------------------------------------------------
  if (type === 'ticket' || type === 'pawn_ticket' || type === 'loan_agreement') {
    drawStandardHeader('OFFICIAL RECEIPT OF PLEDGE (PAWN TICKET)', `TICKET NO: ${loanData?.loan_number || '—'}`);

    let curY = 138;

    // Borrower & Loan Grid (Two Columns)
    docPdf.fillColor(lightCardBg).rect(36, curY, 255, 100).fill().strokeColor(borderGray).rect(36, curY, 255, 100).stroke();
    docPdf.fillColor(lightCardBg).rect(303, curY, 255, 100).fill().strokeColor(borderGray).rect(303, curY, 255, 100).stroke();

    // Left Column: Borrower Details
    docPdf.fillColor(brandBlue).fontSize(8).font('Helvetica-Bold').text('PLEDGOR / BORROWER PARTICULARS', 44, curY + 8);
    
    // Borrower Photo
    if (customerPhotoUri) {
      try {
        docPdf.image(customerPhotoUri, 236, curY + 6, { width: 46, height: 46 });
      } catch {}
    }

    docPdf.fillColor(brandDark).fontSize(7).font('Helvetica')
          .text(`Name: ${customerData?.name || '—'}`, 44, curY + 22)
          .text(`Customer ID: ${customerData?.customer_number || customerData?.id || '—'}`, 44, curY + 34)
          .text(`Mobile: ${customerData?.phone_primary ? '+91 ' + customerData.phone_primary : '—'}`, 44, curY + 46)
          .text(`Address: ${customerData?.address ? `${customerData.address}, ${customerData.city || ''}` : '—'}`, 44, curY + 58, { width: 185 })
          .text(`Aadhaar: ${customerData?.national_id || 'Not on file'}  |  PAN: ${customerData?.pan_number || 'Not on file'}`, 44, curY + 74)
          .text(`Nominee: ${customerData?.nominee_name || loanData?.nominee_name || '—'} (${customerData?.nominee_relation || 'Nominee'})`, 44, curY + 86);

    // Right Column: Loan Terms & Accounting
    docPdf.fillColor(brandBlue).fontSize(8).font('Helvetica-Bold').text('PLEDGE LOAN TERMS & POLICY', 311, curY + 8);
    docPdf.fillColor(brandDark).fontSize(7).font('Helvetica')
          .text(`Sanctioned Principal: ${formatINR(loanData?.principal_amount || 0)}`, 311, curY + 22)
          .text(`Annual Interest Rate: ${loanData?.interest_rate_apr || 18}% p.a. (${((loanData?.interest_rate_apr || 18)/12).toFixed(2)}% per month)`, 311, curY + 34)
          .text(`Monthly Interest Due: ${formatINR(((loanData?.principal_amount || 0) * (loanData?.interest_rate_apr || 18)) / 1200)}`, 311, curY + 46)
          .text(`Pledge Date: ${loanData?.origination_date ? new Date(loanData.origination_date).toLocaleDateString('en-IN') : todayStr}`, 311, curY + 58)
          .text(`Maturity Date: ${loanData?.maturity_date ? new Date(loanData.maturity_date).toLocaleDateString('en-IN') : '12 Months'}`, 311, curY + 70)
          .text(`Tenure: ${loanData?.tenure_months || 12} Months  |  LTV Cap: 100%  |  Vault Ref: ${goldItems[0]?.storage_bin_id || 'VAULT-TRAY-A1'}`, 311, curY + 82);

    curY += 108;

    // Collateral Ornaments Table
    docPdf.fillColor(brandBlue).fontSize(8).font('Helvetica-Bold').text('PLEDGED GOLD JEWELLERY & ORNAMENT INVENTORY', 36, curY);
    curY += 12;

    docPdf.fillColor(brandDark).rect(36, curY, 522, 16).fill();
    docPdf.fillColor('#ffffff').fontSize(6.5).font('Helvetica-Bold')
          .text('#', 42, curY + 4)
          .text('Ornament Description', 58, curY + 4)
          .text('Purity', 220, curY + 4)
          .text('Gross Wt', 270, curY + 4)
          .text('Stone Wt', 320, curY + 4)
          .text('Net Wt', 370, curY + 4)
          .text('Rate/g', 420, curY + 4)
          .text('Market Valuation', 475, curY + 4);

    curY += 16;
    let totGross = 0, totStone = 0, totNet = 0, totVal = 0;

    if (goldItems.length > 0) {
      goldItems.forEach((item, idx) => {
        docPdf.fillColor(idx % 2 === 0 ? '#f8fafc' : '#ffffff').rect(36, curY, 522, 16).fill();
        docPdf.fillColor(brandDark).fontSize(6.5).font('Helvetica')
              .text(String(idx + 1), 42, curY + 4)
              .text(item.item_description || item.ornament_type || 'Gold Item', 58, curY + 4, { width: 155, ellipsis: true })
              .text(item.purity_karat || '22K', 220, curY + 4)
              .text(`${(item.gross_weight || 0).toFixed(2)}g`, 270, curY + 4)
              .text(`${(item.stone_weight || 0).toFixed(2)}g`, 320, curY + 4)
              .text(`${(item.net_weight || 0).toFixed(2)}g`, 370, curY + 4)
              .text(formatINR(item.market_rate_per_gram || 5400), 420, curY + 4)
              .text(formatINR(item.valuation_inr || 0), 475, curY + 4);

        totGross += item.gross_weight || 0;
        totStone += item.stone_weight || 0;
        totNet += item.net_weight || 0;
        totVal += item.valuation_inr || 0;
        curY += 16;
      });
    } else {
      docPdf.fillColor('#ffffff').rect(36, curY, 522, 16).fill();
      docPdf.fillColor(textMuted).fontSize(6.5).font('Helvetica').text('Gold ornament details recorded in vault registry.', 42, curY + 4);
      curY += 16;
    }

    // Totals Line
    docPdf.fillColor('#e2e8f0').rect(36, curY, 522, 16).fill();
    docPdf.fillColor(brandDark).fontSize(7).font('Helvetica-Bold')
          .text('TOTAL PLEDGE SUMMARY:', 58, curY + 4)
          .text(`${totGross.toFixed(2)}g`, 270, curY + 4)
          .text(`${totStone.toFixed(2)}g`, 320, curY + 4)
          .text(`${totNet.toFixed(2)}g`, 370, curY + 4)
          .text(formatINR(totVal), 475, curY + 4);

    curY += 24;

    // Photographic Evidence (Embedded Gold Photos - IMG-01, IMG-02)
    const goldPhotoUrls = getCollateralPhotoUrls(goldItems).slice(0, 4);
    if (goldPhotoUrls.length > 0) {
      docPdf.fillColor(brandBlue).fontSize(7.5).font('Helvetica-Bold').text('COLLATERAL PHOTOGRAPHIC EVIDENCE (SCALE & VAULT DEPOSIT):', 36, curY);
      curY += 12;
      let photoX = 36;
      for (const pUrl of goldPhotoUrls) {
        try {
          const buf = await fetchImageBuffer(pUrl);
          if (buf) {
            const pUri = toDataUri(buf, 'image/jpeg');
            if (pUri) {
              docPdf.image(pUri, photoX, curY, { width: 70, height: 50, fit: [70, 50] });
            }
          }
        } catch {}
        photoX += 80;
      }
      curY += 56;
    }

    // Statutory Terms & Conditions
    docPdf.fillColor(brandBlue).fontSize(7).font('Helvetica-Bold').text('STATUTORY UNDERTAKINGS (TAMIL NADU PAWNBROKERS ACT):', 36, curY);
    curY += 10;
    docPdf.fillColor(textMuted).fontSize(5.5).font('Helvetica')
          .text('1. The borrower declares that all gold ornaments pledged are their lawful self-acquired property and free from any encumbrances.', 36, curY)
          .text('2. Interest shall be calculated on daily reducing balance at agreed rates. Minimum interest period is one month.', 36, curY + 8)
          .text('3. In default of repayment of principal or interest on or after maturity date, PGF reserves the statutory right to auction the pledged articles as per law.', 36, curY + 16)
          .text('4. Pledged jewellery is safely insured against burglary and fire in computerized bank-grade vault storage.', 36, curY + 24);

    curY += 38;

    // Signatures Block
    docPdf.strokeColor(borderGray).lineWidth(0.5).rect(36, curY, 255, 48).stroke();
    docPdf.strokeColor(borderGray).lineWidth(0.5).rect(303, curY, 255, 48).stroke();

    if (customerSignatureUri) {
      try {
        docPdf.image(customerSignatureUri, 44, curY + 4, { width: 90, height: 28 });
      } catch {}
    }
    docPdf.fillColor(textMuted).fontSize(6).font('Helvetica-Bold').text('BORROWER SIGNATURE & THUMB IMPRESSION', 44, curY + 36);

    docPdf.fillColor(brandDark).fontSize(6.5).font('Helvetica-Bold').text(`For ${companyName.toUpperCase()}`, 311, curY + 8);
    docPdf.fillColor(textMuted).fontSize(6).font('Helvetica').text('Authorized Pawnbroker / Branch Signatory', 311, curY + 36);

    // Rotating Tamil Slogan Banner (Bill Slogan System — 300 Unique Slogans)
    if (billSloganText) {
      curY += 56;
      docPdf.fillColor('#fffbeb').rect(36, curY, 522, 38).fill()
            .strokeColor('#fde68a').lineWidth(0.8).rect(36, curY, 522, 38).stroke();

      docPdf.fillColor('#92400e').fontSize(6).font('Helvetica-Bold')
            .text(`OFFICIAL PLEDGE BILL SLOGAN • ${billSloganId || 'PGF-SLOGAN'}`, 44, curY + 5);

      if (hasTamilFont) {
        docPdf.fillColor('#78350f').fontSize(9).font('TamilFont')
              .text(`“ ${billSloganText} ”`, 44, curY + 15, { width: 506, align: 'center' });
      } else {
        docPdf.fillColor('#78350f').fontSize(8.5).font('Helvetica-Bold')
              .text(`“ ${billSloganText} ”`, 44, curY + 15, { width: 506, align: 'center' });
      }

      docPdf.fillColor('#b45309').fontSize(5.5).font('Helvetica')
            .text('Pavithra Gold Finance • Committed to Customer Security & Integrity', 44, curY + 28, { width: 506, align: 'center' });
    }

  // --------------------------------------------------------------------------
  // 2. LOAN APPLICATION & APPRAISAL FORM (loan_application)
  // --------------------------------------------------------------------------
  } else if (type === 'loan_application') {
    drawStandardHeader('GOLD LOAN APPLICATION & APPRAISAL DOSSIER', `APP FORM NO: ${loanData?.loan_number || '—'}`);

    let curY = 138;

    // 1. Applicant Personal & KYC Profile
    docPdf.fillColor(brandBlue).fontSize(8).font('Helvetica-Bold').text('1. APPLICANT PERSONAL & KYC PROFILE', 36, curY);
    curY += 12;

    docPdf.fillColor(lightCardBg).rect(36, curY, 522, 82).fill().strokeColor(borderGray).rect(36, curY, 522, 82).stroke();

    if (customerPhotoUri) {
      try {
        docPdf.image(customerPhotoUri, 496, curY + 6, { width: 54, height: 60 });
      } catch {}
    }

    docPdf.fillColor(brandDark).fontSize(7).font('Helvetica')
          .text(`Full Name: ${customerData?.name || '—'}`, 44, curY + 8)
          .text(`Customer ID: ${customerData?.customer_number || customerData?.id || '—'}`, 240, curY + 8)
          .text(`Contact Phone: ${customerData?.phone_primary ? '+91 ' + customerData.phone_primary : '—'}`, 44, curY + 22)
          .text(`Email Address: ${customerData?.email || '—'}`, 240, curY + 22)
          .text(`Residential Address: ${customerData?.address ? `${customerData.address}${customerData?.city ? ', ' + customerData.city : ''}${customerData?.pincode ? ' - ' + customerData.pincode : ''}` : '—'}`, 44, curY + 36, { width: 440 })
          .text(`Aadhaar Card (UID): ${customerData?.national_id || '—'}`, 44, curY + 50)
          .text(`PAN Card No: ${customerData?.pan_number || '—'}`, 240, curY + 50)
          .text(`Occupation: ${customerData?.occupation || '—'}  |  Monthly Income: ${customerData?.monthly_income ? formatINR(customerData.monthly_income) : '—'}`, 44, curY + 64)
          .text(`Nominee Name: ${customerData?.nominee_name || loanData?.nominee_name || '—'} (${customerData?.nominee_relation || 'Nominee'})`, 240, curY + 64);

    curY += 92;

    // 2. Gold Collateral Appraisal Assessment
    docPdf.fillColor(brandBlue).fontSize(8).font('Helvetica-Bold').text('2. GOLD COLLATERAL APPRAISAL & PURITY ASSESSMENT', 36, curY);
    curY += 12;

    docPdf.fillColor(brandDark).rect(36, curY, 522, 16).fill();
    docPdf.fillColor('#ffffff').fontSize(6.5).font('Helvetica-Bold')
          .text('#', 42, curY + 4)
          .text('Ornament Type', 58, curY + 4)
          .text('Karat', 190, curY + 4)
          .text('Gross Wt', 230, curY + 4)
          .text('Stone Wt', 275, curY + 4)
          .text('Net Wt', 320, curY + 4)
          .text('Rate/g', 365, curY + 4)
          .text('Appraised Value', 415, curY + 4)
          .text('Max Loan (100%)', 480, curY + 4);

    curY += 16;
    let appGross = 0, appStone = 0, appNet = 0, appVal = 0;

    if (goldItems.length > 0) {
      goldItems.forEach((item, idx) => {
        const val = item.valuation_inr || (item.net_weight * (item.market_rate_per_gram || 5400));
        const maxLoan = val * 1.0;

        docPdf.fillColor(idx % 2 === 0 ? '#f8fafc' : '#ffffff').rect(36, curY, 522, 15).fill();
        docPdf.fillColor(brandDark).fontSize(6.5).font('Helvetica')
              .text(String(idx + 1), 42, curY + 3.5)
              .text(item.item_description || item.ornament_type || 'Gold Jewellery', 58, curY + 3.5, { width: 130, ellipsis: true })
              .text(item.purity_karat || '22K', 190, curY + 3.5)
              .text(`${(item.gross_weight || 0).toFixed(2)}g`, 230, curY + 3.5)
              .text(`${(item.stone_weight || 0).toFixed(2)}g`, 275, curY + 3.5)
              .text(`${(item.net_weight || 0).toFixed(2)}g`, 320, curY + 3.5)
              .text(formatINR(item.market_rate_per_gram || 5400), 365, curY + 3.5)
              .text(formatINR(val), 415, curY + 3.5)
              .text(formatINR(maxLoan), 480, curY + 3.5);

        appGross += item.gross_weight || 0;
        appStone += item.stone_weight || 0;
        appNet += item.net_weight || 0;
        appVal += val;
        curY += 15;
      });
    }

    docPdf.fillColor('#e2e8f0').rect(36, curY, 522, 16).fill();
    docPdf.fillColor(brandDark).fontSize(7).font('Helvetica-Bold')
          .text('TOTAL APPRAISED COLLATERAL:', 58, curY + 4)
          .text(`${appGross.toFixed(2)}g`, 230, curY + 4)
          .text(`${appStone.toFixed(2)}g`, 275, curY + 4)
          .text(`${appNet.toFixed(2)}g`, 320, curY + 4)
          .text(formatINR(appVal), 415, curY + 4)
          .text(formatINR(appVal * 1.0), 480, curY + 4);

    curY += 24;

    // 3. Facility Sanction & Approval Matrix
    docPdf.fillColor(brandBlue).fontSize(8).font('Helvetica-Bold').text('3. LOAN FACILITY REQUESTED & SANCTIONED TERMS', 36, curY);
    curY += 12;

    docPdf.fillColor(lightCardBg).rect(36, curY, 522, 54).fill().strokeColor(borderGray).rect(36, curY, 522, 54).stroke();
    docPdf.fillColor(brandDark).fontSize(7).font('Helvetica')
          .text(`Sanctioned Principal: ${formatINR(loanData?.principal_amount || 0)} (${numberToIndianWords(loanData?.principal_amount || 0)})`, 44, curY + 8)
          .text(`Annual Percentage Rate (APR): ${loanData?.interest_rate_apr || 12}% p.a.`, 44, curY + 20)
          .text(`Loan Tenure: ${loanData?.tenure_months || 12} Months`, 260, curY + 20)
          .text(`Application Date: ${todayStr}`, 44, curY + 32)
          .text(`Safe Vault Tray Code: ${goldItems[0]?.storage_bin_id || 'BIN-VAULT-01'}`, 260, curY + 32)
          .text(`End-Use / Loan Purpose: ${loanData?.purpose || 'Personal / Business Liquidity Need'}`, 44, curY + 44);

    curY += 66;

    // 4. Verification Declarations & Sanction Approvals
    docPdf.fillColor(lightCardBg).rect(36, curY, 255, 60).fill().strokeColor(borderGray).rect(36, curY, 255, 60).stroke();
    docPdf.fillColor(lightCardBg).rect(303, curY, 255, 60).fill().strokeColor(borderGray).rect(303, curY, 255, 60).stroke();

    // Applicant declaration
    if (customerSignatureUri) {
      try {
        docPdf.image(customerSignatureUri, 44, curY + 4, { width: 90, height: 26 });
      } catch {}
    }
    docPdf.fillColor(textMuted).fontSize(6).font('Helvetica-Bold').text('APPLICANT SIGNATURE & DECLARATION', 44, curY + 44);
    docPdf.fillColor(textMuted).fontSize(5).font('Helvetica').text('I confirm all information and ownership declarations are true.', 44, curY + 52);

    // Manager sanction
    docPdf.fillColor(brandDark).fontSize(6.5).font('Helvetica-Bold').text('APPRAISER & SANCTIONING AUTHORITY', 311, curY + 6);
    docPdf.fillColor(textMuted).fontSize(5.5).font('Helvetica')
          .text('Gold purity verified via specific gravity & acid test.', 311, curY + 16)
          .text(`Sanction Approved by: ${companyBranchName} Branch Manager`, 311, curY + 26)
          .text(`Date & Seal: ${todayStr}`, 311, curY + 44);

  // --------------------------------------------------------------------------
  // 3. PAYMENT RECEIPT & REPAYMENT BILL (receipt / payment_receipt / bill)
  // --------------------------------------------------------------------------
  } else if (type === 'receipt' || type === 'payment_receipt' || type === 'interest_receipt' || type === 'principal_receipt' || type === 'bill' || type === 'payment_bill') {
    const isBillDoc = type === 'bill' || type === 'payment_bill';
    const isInterestDoc = type === 'interest_receipt' || paymentData?.payment_type === 'Interest';
    const isPrincipalDoc = type === 'principal_receipt' || paymentData?.payment_type === 'Principal';

    const paidAmt = paymentData?.amount_paid || customAmount || 0;
    const interestPortion = paymentData?.interest_portion || 0;
    const principalPortion = paymentData?.principal_portion || (paidAmt - interestPortion);
    const penaltyPortion = paymentData?.penalty_portion || paymentData?.penalty_amount || 0;

    const remainingPrincipal = loanData ? Math.max(0, (loanData.principal_amount || 0) - (loanData.total_principal_paid || 0)) : 0;
    const remainingInterest = loanData?.outstanding_interest || 0;
    const totalOutstanding = remainingPrincipal + remainingInterest;

    if (isThermal) {
      // =======================================================================
      // 80mm POS Thermal Receipt Layout
      // =======================================================================
      let tY = 14;
      docPdf.fillColor(brandBlue).fontSize(11).font('Helvetica-Bold').text(companyName.toUpperCase(), 10, tY, { width: 206, align: 'center' });
      tY += 15;
      docPdf.fillColor(brandDark).fontSize(6.5).font('Helvetica').text(`${companyBranchName} • Ph: +91 ${companyPhone}`, 10, tY, { width: 206, align: 'center' });
      tY += 10;
      docPdf.fillColor(textMuted).fontSize(6).font('Helvetica').text(`GSTIN: ${companyGst} | CIN: ${companyCin}`, 10, tY, { width: 206, align: 'center' });
      tY += 12;

      docPdf.strokeColor(borderGray).lineWidth(0.5).dash(2, { space: 2 }).moveTo(10, tY).lineTo(216, tY).stroke().undash();
      tY += 6;

      docPdf.fillColor(brandDark).fontSize(7.5).font('Helvetica-Bold').text('PAYMENT RECEIPT', 10, tY, { width: 206, align: 'center' });
      tY += 12;

      docPdf.fillColor(brandDark).fontSize(6.5).font('Helvetica')
            .text(`Receipt No: ${paymentData?.receipt_number || '—'}`, 10, tY)
            .text(`Date: ${todayStr}`, 120, tY, { align: 'right', width: 96 });
      tY += 10;
      docPdf.text(`Loan No: ${loanData?.loan_number || '—'}`, 10, tY)
            .text(`Mode: ${paymentData?.mode || 'Cash'}`, 120, tY, { align: 'right', width: 96 });
      tY += 10;
      docPdf.text(`Customer: ${customerData?.name || loanData?.customer?.name || 'Customer'}`, 10, tY, { width: 206, ellipsis: true });
      tY += 10;
      docPdf.text(`Mobile: ${customerData?.phone_primary ? '+91 ' + customerData.phone_primary : '—'}`, 10, tY);
      tY += 12;

      docPdf.strokeColor(borderGray).lineWidth(0.5).dash(2, { space: 2 }).moveTo(10, tY).lineTo(216, tY).stroke().undash();
      tY += 6;

      docPdf.fillColor(brandBlue).fontSize(7).font('Helvetica-Bold').text('PAYMENT ALLOCATION', 10, tY);
      tY += 10;
      docPdf.fillColor(brandDark).fontSize(6.5).font('Helvetica')
            .text('Interest Cleared:', 10, tY)
            .text(formatINR(interestPortion), 120, tY, { align: 'right', width: 96 });
      tY += 10;
      docPdf.text('Principal Reduction:', 10, tY)
            .text(formatINR(principalPortion), 120, tY, { align: 'right', width: 96 });
      tY += 10;
      if (penaltyPortion > 0) {
        docPdf.text('Penalty / Late Fee:', 10, tY)
              .text(formatINR(penaltyPortion), 120, tY, { align: 'right', width: 96 });
        tY += 10;
      }

      docPdf.strokeColor(borderGray).lineWidth(0.5).dash(2, { space: 2 }).moveTo(10, tY).lineTo(216, tY).stroke().undash();
      tY += 6;

      docPdf.fillColor(brandBlue).fontSize(8.5).font('Helvetica-Bold')
            .text('TOTAL RECEIVED:', 10, tY)
            .text(formatINR(paidAmt), 110, tY, { align: 'right', width: 106 });
      tY += 14;

      docPdf.fillColor(brandDark).fontSize(6.5).font('Helvetica')
            .text('Remaining Principal:', 10, tY)
            .text(formatINR(remainingPrincipal), 120, tY, { align: 'right', width: 96 });
      tY += 10;
      docPdf.text('Remaining Interest:', 10, tY)
            .text(formatINR(remainingInterest), 120, tY, { align: 'right', width: 96 });
      tY += 10;
      docPdf.font('Helvetica-Bold')
            .text('Total Outstanding:', 10, tY)
            .text(formatINR(totalOutstanding), 120, tY, { align: 'right', width: 96 });
      tY += 14;

      // Tamil Slogan on Thermal
      if (billSloganText) {
        if (hasTamilFont) {
          docPdf.fillColor('#78350f').fontSize(7.5).font('TamilFont')
                .text(`“ ${billSloganText} ”`, 10, tY, { width: 206, align: 'center' });
        } else {
          docPdf.fillColor('#78350f').fontSize(7).font('Helvetica-Bold')
                .text(`“ ${billSloganText} ”`, 10, tY, { width: 206, align: 'center' });
        }
        tY += 24;
      }

      // QR Verification Code
      if (qrDataUri) {
        try {
          docPdf.image(qrDataUri, 83, tY, { width: 60, height: 60 });
          tY += 64;
        } catch {}
      }

      docPdf.fillColor(textMuted).fontSize(5.5).font('Helvetica')
            .text('Thank you for choosing Pavithra Gold Finance.', 10, tY, { width: 206, align: 'center' })
            .text('Computer-generated receipt • Signature not required.', 10, tY + 8, { width: 206, align: 'center' });
    } else {
      // =======================================================================
      // Standard A4 Receipt Layout
      // =======================================================================
      let docHeading = 'OFFICIAL MONEY RECEIPT (PLEDGE REPAYMENT)';
      if (isBillDoc) docHeading = 'OFFICIAL REPAYMENT BILL & SETTLEMENT INVOICE';
      else if (isInterestDoc) docHeading = 'OFFICIAL INTEREST REPAYMENT RECEIPT';
      else if (isPrincipalDoc) docHeading = 'OFFICIAL PRINCIPAL REDUCTION RECEIPT';

      drawStandardHeader(
        docHeading,
        isBillDoc ? `BILL NO: ${paymentData?.receipt_number || '—'}` : `RECEIPT NO: ${paymentData?.receipt_number || '—'}`
      );

      let curY = 138;

    // Receipt Meta Box (Includes live customer KYC and pledge date)
    docPdf.fillColor(lightCardBg).rect(36, curY, 522, 68).fill().strokeColor(borderGray).rect(36, curY, 522, 68).stroke();
    docPdf.fillColor(brandDark).fontSize(7.5).font('Helvetica')
          .text(`Bill / Receipt Number: ${paymentData?.receipt_number || '—'}`, 44, curY + 7)
          .text(`Payment Date & Time: ${paymentData?.payment_date ? new Date(paymentData.payment_date).toLocaleString('en-IN') : todayStr}`, 300, curY + 7)
          .text(`Borrower Name: ${customerData?.name || loanData?.customer?.name || '—'}`, 44, curY + 19)
          .text(`Customer ID: ${customerData?.customer_number || customerData?.id || '—'}`, 300, curY + 19)
          .text(`Loan Account No: ${loanData?.loan_number || '—'}`, 44, curY + 31)
          .text(`Pledge Date: ${loanData?.origination_date ? new Date(loanData.origination_date).toLocaleDateString('en-IN') : todayStr}`, 300, curY + 31)
          .text(`Primary Mobile: ${customerData?.phone_primary ? '+91 ' + customerData.phone_primary : '—'}`, 44, curY + 43)
          .text(`Payment Mode: ${paymentData?.mode || 'UPI / Cash'} (Ref: ${paymentData?.transaction_ref || paymentData?.reference_note || paymentData?.utr || 'DIRECT-COUNTER'})`, 300, curY + 43);

    if (paymentData?.interest_period_from && paymentData?.interest_period_to) {
      docPdf.fillColor(brandGold).fontSize(7).font('Helvetica-Bold')
            .text(`Interest Period Covered: ${paymentData.interest_period_from} to ${paymentData.interest_period_to}`, 44, curY + 55);
      docPdf.fillColor(brandDark).fontSize(7).font('Helvetica')
            .text(`Original Principal: ${formatINR(loanData?.principal_amount || 0)}  |  APR: ${loanData?.interest_rate_apr || 18}%`, 300, curY + 55);
    } else {
      docPdf.fillColor(brandDark).fontSize(7).font('Helvetica')
            .text(`KYC Verification: Aadhaar ${customerData?.national_id ? 'UID: ' + customerData.national_id : 'Verified'}  |  PAN: ${customerData?.pan_number || 'On File'}`, 44, curY + 55)
            .text(`Original Principal: ${formatINR(loanData?.principal_amount || 0)}  |  APR: ${loanData?.interest_rate_apr || 18}%`, 300, curY + 55);
    }

    curY += 76;

    // PLEDGED GOLD COLLATERAL & ORNAMENT INVENTORY (with weights, purity, rate, and photo)
    docPdf.fillColor(brandBlue).fontSize(8).font('Helvetica-Bold').text('PLEDGED GOLD COLLATERAL & ORNAMENT DETAILS', 36, curY);
    curY += 11;

    docPdf.fillColor(brandDark).rect(36, curY, 522, 15).fill();
    docPdf.fillColor('#ffffff').fontSize(6.5).font('Helvetica-Bold')
          .text('#', 42, curY + 3.5)
          .text('Ornament Description', 58, curY + 3.5)
          .text('Purity', 210, curY + 3.5)
          .text('Gross Wt', 260, curY + 3.5)
          .text('Stone Wt', 310, curY + 3.5)
          .text('Net Wt', 360, curY + 3.5)
          .text('Gold Rate/g', 410, curY + 3.5)
          .text('Valuation', 475, curY + 3.5);

    curY += 15;
    let recGross = 0, recStone = 0, recNet = 0, recVal = 0;

    if (goldItems.length > 0) {
      goldItems.slice(0, 3).forEach((item, idx) => {
        const itemVal = item.valuation_inr || (item.net_weight * (item.market_rate_per_gram || item.gold_rate_per_gram || 5400));
        docPdf.fillColor(idx % 2 === 0 ? '#f8fafc' : '#ffffff').rect(36, curY, 522, 14).fill();
        docPdf.fillColor(brandDark).fontSize(6.5).font('Helvetica')
              .text(String(idx + 1), 42, curY + 3)
              .text(item.item_description || item.ornament_type || 'Gold Item', 58, curY + 3, { width: 145, ellipsis: true })
              .text(item.purity_karat || '22K', 210, curY + 3)
              .text(`${(item.gross_weight || item.weight_grams || 0).toFixed(2)}g`, 260, curY + 3)
              .text(`${(item.stone_weight || 0).toFixed(2)}g`, 310, curY + 3)
              .text(`${(item.net_weight || item.weight_grams || 0).toFixed(2)}g`, 360, curY + 3)
              .text(formatINR(item.market_rate_per_gram || item.gold_rate_per_gram || 5400), 410, curY + 3)
              .text(formatINR(itemVal), 475, curY + 3);

        recGross += item.gross_weight || item.weight_grams || 0;
        recStone += item.stone_weight || 0;
        recNet += item.net_weight || item.weight_grams || 0;
        recVal += itemVal;
        curY += 14;
      });
    } else {
      docPdf.fillColor('#ffffff').rect(36, curY, 522, 14).fill();
      docPdf.fillColor(textMuted).fontSize(6.5).font('Helvetica').text('Gold ornament records verified under safe custody.', 42, curY + 3);
      curY += 14;
    }

    // Totals line for Collateral
    docPdf.fillColor('#e2e8f0').rect(36, curY, 522, 14).fill();
    docPdf.fillColor(brandDark).fontSize(6.5).font('Helvetica-Bold')
          .text('COLLATERAL TOTALS:', 58, curY + 3)
          .text(`${recGross.toFixed(2)}g`, 260, curY + 3)
          .text(`${recStone.toFixed(2)}g`, 310, curY + 3)
          .text(`${recNet.toFixed(2)}g`, 360, curY + 3)
          .text(formatINR(recVal), 475, curY + 3);

    curY += 18;

    // Photographic Evidence (Embedded Gold Photos - IMG-01, IMG-02)
    const recPhotoUrls = getCollateralPhotoUrls(goldItems).slice(0, 3);
    if (recPhotoUrls.length > 0) {
      docPdf.fillColor(brandBlue).fontSize(7).font('Helvetica-Bold').text('COLLATERAL PHOTOGRAPHIC EVIDENCE (VAULT RECORD):', 36, curY);
      curY += 10;
      let photoX = 36;
      for (const pUrl of recPhotoUrls) {
        try {
          const buf = await fetchImageBuffer(pUrl);
          if (buf) {
            const pUri = toDataUri(buf, 'image/jpeg');
            if (pUri) {
              docPdf.image(pUri, photoX, curY, { width: 55, height: 38, fit: [55, 38] });
            }
          }
        } catch {}
        photoX += 65;
      }
      curY += 44;
    }

    // Payment Allocation Table
    docPdf.fillColor(brandBlue).fontSize(8).font('Helvetica-Bold').text('REPAYMENT ALLOCATION BREAKDOWN', 36, curY);
    curY += 11;

    docPdf.fillColor(brandDark).rect(36, curY, 522, 15).fill();
    docPdf.fillColor('#ffffff').fontSize(6.5).font('Helvetica-Bold')
          .text('#', 44, curY + 3.5)
          .text('Payment Component', 70, curY + 3.5)
          .text('Accounting Type', 280, curY + 3.5)
          .text('Amount Credited', 450, curY + 3.5, { align: 'right', width: 96 });

    curY += 15;

    const rows = [
      { num: '1', name: 'Accrued Interest Cleared', type: 'Interest Ledger Credit', amt: interestPortion },
      { num: '2', name: 'Principal Balance Reduction', type: 'Principal Reduction', amt: principalPortion },
      { num: '3', name: 'Late Fee / Penal Interest', type: 'Penalty Clearance', amt: penaltyPortion },
    ];

    rows.forEach((r, idx) => {
      docPdf.fillColor(idx % 2 === 0 ? '#f8fafc' : '#ffffff').rect(36, curY, 522, 14).fill();
      docPdf.fillColor(brandDark).fontSize(6.5).font('Helvetica')
            .text(r.num, 44, curY + 3)
            .text(r.name, 70, curY + 3)
            .text(r.type, 280, curY + 3)
            .text(formatINR(r.amt), 450, curY + 3, { align: 'right', width: 96 });
      curY += 14;
    });

    // Total Paid Line
    docPdf.fillColor('#dbeafe').rect(36, curY, 522, 18).fill();
    docPdf.fillColor(brandBlue).fontSize(8).font('Helvetica-Bold')
          .text('TOTAL AMOUNT RECEIVED (NET PAID):', 70, curY + 4)
          .text(formatINR(paidAmt), 450, curY + 4, { align: 'right', width: 96 });

    curY += 21;

    // Amount in words
    docPdf.fillColor(brandDark).fontSize(7).font('Helvetica-Bold')
          .text(`Amount in Words: ${numberToIndianWords(paidAmt)}`, 36, curY);

    curY += 14;

    // Outstanding Status After This Payment
    const remainingPrincipal = loanData ? Math.max(0, (loanData.principal_amount || 0) - (loanData.total_principal_paid || 0)) : 0;
    const remainingInterest = loanData?.outstanding_interest || 0;
    const totalOutstanding = remainingPrincipal + remainingInterest;

    docPdf.fillColor(lightCardBg).rect(36, curY, 522, 46).fill().strokeColor(borderGray).rect(36, curY, 522, 46).stroke();
    docPdf.fillColor(brandBlue).fontSize(7.5).font('Helvetica-Bold').text('LOAN POSITION POST-TRANSACTION', 44, curY + 5);
    docPdf.fillColor(brandDark).fontSize(7).font('Helvetica')
          .text(`Remaining Principal: ${formatINR(remainingPrincipal)}`, 44, curY + 17)
          .text(`Remaining Interest: ${formatINR(remainingInterest)}`, 200, curY + 17)
          .text(`Total Outstanding: ${formatINR(totalOutstanding)}`, 370, curY + 17)
          .text(`Next Repayment Due Date: ${loanData?.maturity_date ? new Date(loanData.maturity_date).toLocaleDateString('en-IN') : 'As per monthly schedule'}`, 44, curY + 30)
          .text(`Loan Status: ${loanData?.status || 'Active'}`, 300, curY + 30);

    curY += 54;

    // Signatures
    docPdf.strokeColor(borderGray).lineWidth(0.5).rect(36, curY, 255, 38).stroke();
    docPdf.strokeColor(borderGray).lineWidth(0.5).rect(303, curY, 255, 38).stroke();

    docPdf.fillColor(textMuted).fontSize(6).font('Helvetica').text('Pledgor Repayment Acknowledgment', 44, curY + 26);
    docPdf.fillColor(brandDark).fontSize(6.5).font('Helvetica-Bold').text(`For ${companyName.toUpperCase()}`, 311, curY + 5);
    docPdf.fillColor(textMuted).fontSize(6).font('Helvetica').text('Authorized Cashier / Cash Counter Signatory', 311, curY + 26);

    // --------------------------------------------------------------------------
    // ROTATING TAMIL SLOGAN BANNER (Bill Slogan System — 300 Unique Slogans)
    // --------------------------------------------------------------------------
    if (billSloganText) {
      curY += 44;
      docPdf.fillColor('#fffbeb').rect(36, curY, 522, 34).fill()
            .strokeColor('#fde68a').lineWidth(0.8).rect(36, curY, 522, 34).stroke();

      docPdf.fillColor('#92400e').fontSize(5.5).font('Helvetica-Bold')
            .text(`OFFICIAL BILL SLOGAN • ${billSloganId || 'PGF-SLOGAN'}`, 44, curY + 4);

      if (hasTamilFont) {
        docPdf.fillColor('#78350f').fontSize(8.5).font('TamilFont')
              .text(`“ ${billSloganText} ”`, 44, curY + 13, { width: 506, align: 'center' });
      } else {
        docPdf.fillColor('#78350f').fontSize(8).font('Helvetica-Bold')
              .text(`“ ${billSloganText} ”`, 44, curY + 13, { width: 506, align: 'center' });
      }

      docPdf.fillColor('#b45309').fontSize(5).font('Helvetica')
            .text('Pavithra Gold Finance • Trusted Gold Loan Partner • Tamil Nadu', 44, curY + 24, { width: 506, align: 'center' });
    }
  }

  // --------------------------------------------------------------------------
  // 3b. LOAN RENEWAL RECEIPT & EXTENSION AGREEMENT (renewal_receipt / renewal)
  // --------------------------------------------------------------------------
  } else if (type === 'renewal_receipt' || type === 'renewal') {
    const paidAmt = paymentData?.amount_paid || customAmount || 0;
    const interestPortion = paymentData?.interest_portion || 0;
    const principalPortion = paymentData?.principal_portion || 0;
    const penaltyPortion = paymentData?.penalty_portion || 0;

    const principalBefore = paymentData?.principal_before_paise ? (paymentData.principal_before_paise / 100) : (loanData?.principal_amount || 0);
    const principalAfter = paymentData?.principal_after_paise ? (paymentData.principal_after_paise / 100) : Math.max(0, principalBefore - principalPortion);
    const remainingInterest = paymentData?.interest_after_paise ? (paymentData.interest_after_paise / 100) : (loanData?.outstanding_interest || 0);
    const totalOutstanding = principalAfter + remainingInterest;

    if (isThermal) {
      let tY = 14;
      docPdf.fillColor(brandBlue).fontSize(11).font('Helvetica-Bold').text(companyName.toUpperCase(), 10, tY, { width: 206, align: 'center' });
      tY += 15;
      docPdf.fillColor(brandDark).fontSize(6.5).font('Helvetica').text(`${companyBranchName} • Ph: +91 ${companyPhone}`, 10, tY, { width: 206, align: 'center' });
      tY += 10;
      docPdf.fillColor(textMuted).fontSize(6).font('Helvetica').text(`GSTIN: ${companyGst} | CIN: ${companyCin}`, 10, tY, { width: 206, align: 'center' });
      tY += 12;

      docPdf.strokeColor(borderGray).lineWidth(0.5).dash(2, { space: 2 }).moveTo(10, tY).lineTo(216, tY).stroke().undash();
      tY += 6;

      docPdf.fillColor(brandDark).fontSize(8).font('Helvetica-Bold').text('LOAN RENEWAL RECEIPT', 10, tY, { width: 206, align: 'center' });
      tY += 12;

      docPdf.fillColor(brandDark).fontSize(6.5).font('Helvetica')
            .text(`Receipt No: ${paymentData?.receipt_number || '—'}`, 10, tY)
            .text(`Date: ${todayStr}`, 120, tY, { align: 'right', width: 96 });
      tY += 10;
      docPdf.text(`Loan No: ${loanData?.loan_number || '—'}`, 10, tY)
            .text(`Mode: ${paymentData?.mode || 'Cash'}`, 120, tY, { align: 'right', width: 96 });
      tY += 10;
      docPdf.text(`Customer: ${customerData?.name || loanData?.customer?.name || 'Customer'}`, 10, tY, { width: 206, ellipsis: true });
      tY += 10;
      docPdf.text(`Mobile: ${customerData?.phone_primary ? '+91 ' + customerData.phone_primary : '—'}`, 10, tY);
      tY += 12;

      docPdf.strokeColor(borderGray).lineWidth(0.5).dash(2, { space: 2 }).moveTo(10, tY).lineTo(216, tY).stroke().undash();
      tY += 6;

      docPdf.fillColor(brandBlue).fontSize(7).font('Helvetica-Bold').text('RENEWAL & PAYMENT ALLOCATION', 10, tY);
      tY += 10;
      docPdf.fillColor(brandDark).fontSize(6.5).font('Helvetica')
            .text('Interest Cleared:', 10, tY)
            .text(formatINR(interestPortion), 120, tY, { align: 'right', width: 96 });
      tY += 10;
      docPdf.text('Principal Paid:', 10, tY)
            .text(formatINR(principalPortion), 120, tY, { align: 'right', width: 96 });
      tY += 10;
      if (penaltyPortion > 0) {
        docPdf.text('Penalty Paid:', 10, tY)
              .text(formatINR(penaltyPortion), 120, tY, { align: 'right', width: 96 });
        tY += 10;
      }

      docPdf.strokeColor(borderGray).lineWidth(0.5).dash(2, { space: 2 }).moveTo(10, tY).lineTo(216, tY).stroke().undash();
      tY += 6;

      docPdf.fillColor(brandBlue).fontSize(8.5).font('Helvetica-Bold')
            .text('TOTAL PAID:', 10, tY)
            .text(formatINR(paidAmt), 110, tY, { align: 'right', width: 106 });
      tY += 14;

      docPdf.fillColor(brandDark).fontSize(6.5).font('Helvetica')
            .text('Previous Principal:', 10, tY)
            .text(formatINR(principalBefore), 120, tY, { align: 'right', width: 96 });
      tY += 10;
      docPdf.text('New Principal Balance:', 10, tY)
            .text(formatINR(principalAfter), 120, tY, { align: 'right', width: 96 });
      tY += 10;
      docPdf.text('Extended Maturity:', 10, tY)
            .text(loanData?.maturity_date ? new Date(loanData.maturity_date).toLocaleDateString('en-IN') : '12 Months', 120, tY, { align: 'right', width: 96 });
      tY += 10;
      docPdf.font('Helvetica-Bold')
            .text('Total Outstanding:', 10, tY)
            .text(formatINR(totalOutstanding), 120, tY, { align: 'right', width: 96 });
      tY += 14;

      if (billSloganText) {
        if (hasTamilFont) {
          docPdf.fillColor('#78350f').fontSize(7.5).font('TamilFont')
                .text(`“ ${billSloganText} ”`, 10, tY, { width: 206, align: 'center' });
        } else {
          docPdf.fillColor('#78350f').fontSize(7).font('Helvetica-Bold')
                .text(`“ ${billSloganText} ”`, 10, tY, { width: 206, align: 'center' });
        }
        tY += 24;
      }

      if (qrDataUri) {
        try {
          docPdf.image(qrDataUri, 83, tY, { width: 60, height: 60 });
          tY += 64;
        } catch {}
      }

      docPdf.fillColor(textMuted).fontSize(5.5).font('Helvetica')
            .text('Loan successfully renewed with extended maturity.', 10, tY, { width: 206, align: 'center' })
            .text('Pavithra Gold Finance • Computer generated.', 10, tY + 8, { width: 206, align: 'center' });
    } else {
      drawStandardHeader(
        'OFFICIAL LOAN RENEWAL & EXTENSION RECEIPT',
        `RENEWAL REF: ${paymentData?.receipt_number || loanData?.loan_number || '—'}`
      );

      let curY = 138;

      // Borrower & Loan Dossier
      docPdf.fillColor(lightCardBg).rect(36, curY, 522, 68).fill().strokeColor(borderGray).rect(36, curY, 522, 68).stroke();
      docPdf.fillColor(brandDark).fontSize(7.5).font('Helvetica')
            .text(`Receipt / Reference: ${paymentData?.receipt_number || '—'}`, 44, curY + 7)
            .text(`Renewal Date: ${paymentData?.payment_date ? new Date(paymentData.payment_date).toLocaleDateString('en-IN') : todayStr}`, 300, curY + 7)
            .text(`Borrower Name: ${customerData?.name || loanData?.customer?.name || '—'}`, 44, curY + 19)
            .text(`Customer ID: ${customerData?.customer_number || customerData?.id || '—'}`, 300, curY + 19)
            .text(`Loan Account No: ${loanData?.loan_number || '—'}`, 44, curY + 31)
            .text(`Original Pledge Date: ${loanData?.origination_date ? new Date(loanData.origination_date).toLocaleDateString('en-IN') : todayStr}`, 300, curY + 31)
            .text(`Primary Mobile: ${customerData?.phone_primary ? '+91 ' + customerData.phone_primary : '—'}`, 44, curY + 43)
            .text(`Payment Mode: ${paymentData?.mode || 'Cash'} (Ref: ${paymentData?.transaction_ref || 'COUNTER'})`, 300, curY + 43)
            .text(`KYC Status: Aadhaar ${customerData?.national_id ? 'UID: ' + customerData.national_id : 'Verified'} | PAN: ${customerData?.pan_number || 'On File'}`, 44, curY + 55)
            .text(`Annual Interest Rate: ${loanData?.interest_rate_apr || 18}% p.a.`, 300, curY + 55);

      curY += 76;

      // Renewal Comparison Strip
      docPdf.fillColor(brandBlue).fontSize(8).font('Helvetica-Bold').text('LOAN TERMS POST-RENEWAL', 36, curY);
      curY += 11;

      docPdf.fillColor('#eff6ff').rect(36, curY, 126, 44).fill().strokeColor('#bfdbfe').rect(36, curY, 126, 44).stroke();
      docPdf.fillColor('#1e40af').fontSize(6.5).font('Helvetica-Bold').text('PREVIOUS PRINCIPAL', 42, curY + 6);
      docPdf.fontSize(9.5).text(formatINR(principalBefore), 42, curY + 18);
      docPdf.fontSize(6).font('Helvetica').text(`Original: ${formatINR(loanData?.principal_amount || 0)}`, 42, curY + 32);

      docPdf.fillColor('#f0fdf4').rect(168, curY, 126, 44).fill().strokeColor('#bbf7d0').rect(168, curY, 126, 44).stroke();
      docPdf.fillColor('#166534').fontSize(6.5).font('Helvetica-Bold').text('PRINCIPAL REPAID', 174, curY + 6);
      docPdf.fontSize(9.5).text(formatINR(principalPortion), 174, curY + 18);
      docPdf.fontSize(6).font('Helvetica').text('Direct Principal Reduction', 174, curY + 32);

      docPdf.fillColor('#fffbeb').rect(300, curY, 126, 44).fill().strokeColor('#fde68a').rect(300, curY, 126, 44).stroke();
      docPdf.fillColor('#b45309').fontSize(6.5).font('Helvetica-Bold').text('NEW PRINCIPAL BALANCE', 306, curY + 6);
      docPdf.fontSize(9.5).text(formatINR(principalAfter), 306, curY + 18);
      docPdf.fontSize(6).font('Helvetica').text(`APR: ${loanData?.interest_rate_apr || 18}%`, 306, curY + 32);

      docPdf.fillColor('#fff1f2').rect(432, curY, 126, 44).fill().strokeColor('#fecdd3').rect(432, curY, 126, 44).stroke();
      docPdf.fillColor('#9f1239').fontSize(6.5).font('Helvetica-Bold').text('EXTENDED MATURITY', 438, curY + 6);
      docPdf.fontSize(9.5).text(loanData?.maturity_date ? new Date(loanData.maturity_date).toLocaleDateString('en-IN') : '12 Months', 438, curY + 18);
      docPdf.fontSize(6).font('Helvetica').text(`Status: ${loanData?.status || 'Active'}`, 438, curY + 32);

      curY += 52;

      // Pledged Gold Ornaments Table
      docPdf.fillColor(brandBlue).fontSize(8).font('Helvetica-Bold').text('PLEDGED GOLD COLLATERAL & ORNAMENT INVENTORY', 36, curY);
      curY += 11;

      docPdf.fillColor(brandDark).rect(36, curY, 522, 15).fill();
      docPdf.fillColor('#ffffff').fontSize(6.5).font('Helvetica-Bold')
            .text('#', 42, curY + 3.5)
            .text('Ornament Description', 58, curY + 3.5)
            .text('Purity', 210, curY + 3.5)
            .text('Gross Wt', 260, curY + 3.5)
            .text('Stone Wt', 310, curY + 3.5)
            .text('Net Wt', 360, curY + 3.5)
            .text('Gold Rate/g', 410, curY + 3.5)
            .text('Valuation', 475, curY + 3.5);

      curY += 15;
      let renGross = 0, renStone = 0, renNet = 0, renVal = 0;
      if (goldItems.length > 0) {
        goldItems.slice(0, 3).forEach((item, idx) => {
          const itemVal = item.valuation_inr || (item.net_weight * (item.market_rate_per_gram || item.gold_rate_per_gram || 5400));
          docPdf.fillColor(idx % 2 === 0 ? '#f8fafc' : '#ffffff').rect(36, curY, 522, 14).fill();
          docPdf.fillColor(brandDark).fontSize(6.5).font('Helvetica')
                .text(String(idx + 1), 42, curY + 3)
                .text(item.item_description || item.ornament_type || 'Gold Item', 58, curY + 3, { width: 145, ellipsis: true })
                .text(item.purity_karat || '22K', 210, curY + 3)
                .text(`${(item.gross_weight || item.weight_grams || 0).toFixed(2)}g`, 260, curY + 3)
                .text(`${(item.stone_weight || 0).toFixed(2)}g`, 310, curY + 3)
                .text(`${(item.net_weight || item.weight_grams || 0).toFixed(2)}g`, 360, curY + 3)
                .text(formatINR(item.market_rate_per_gram || item.gold_rate_per_gram || 5400), 410, curY + 3)
                .text(formatINR(itemVal), 475, curY + 3);

          renGross += item.gross_weight || item.weight_grams || 0;
          renStone += item.stone_weight || 0;
          renNet += item.net_weight || item.weight_grams || 0;
          renVal += itemVal;
          curY += 14;
        });
      } else {
        docPdf.fillColor('#ffffff').rect(36, curY, 522, 14).fill();
        docPdf.fillColor(textMuted).fontSize(6.5).font('Helvetica').text('Gold ornament records verified under safe vault custody.', 42, curY + 3);
        curY += 14;
      }

      docPdf.fillColor('#e2e8f0').rect(36, curY, 522, 14).fill();
      docPdf.fillColor(brandDark).fontSize(6.5).font('Helvetica-Bold')
            .text('COLLATERAL TOTALS:', 58, curY + 3)
            .text(`${renGross.toFixed(2)}g`, 260, curY + 3)
            .text(`${renStone.toFixed(2)}g`, 310, curY + 3)
            .text(`${renNet.toFixed(2)}g`, 360, curY + 3)
            .text(formatINR(renVal), 475, curY + 3);

      curY += 18;

      // Repayment Allocation Table
      docPdf.fillColor(brandBlue).fontSize(8).font('Helvetica-Bold').text('RENEWAL PAYMENT ALLOCATION', 36, curY);
      curY += 11;

      docPdf.fillColor(brandDark).rect(36, curY, 522, 15).fill();
      docPdf.fillColor('#ffffff').fontSize(6.5).font('Helvetica-Bold')
            .text('#', 44, curY + 3.5)
            .text('Component', 70, curY + 3.5)
            .text('Accounting Type', 280, curY + 3.5)
            .text('Amount Credited', 450, curY + 3.5, { align: 'right', width: 96 });

      curY += 15;

      const renRows = [
        { num: '1', name: 'Accrued Interest Cleared', type: 'Interest Ledger Credit', amt: interestPortion },
        { num: '2', name: 'Principal Reduction Paid', type: 'Principal Reduction', amt: principalPortion },
        { num: '3', name: 'Penalty / Charges Paid', type: 'Penalty Clearance', amt: penaltyPortion },
      ];

      renRows.forEach((r, idx) => {
        docPdf.fillColor(idx % 2 === 0 ? '#f8fafc' : '#ffffff').rect(36, curY, 522, 14).fill();
        docPdf.fillColor(brandDark).fontSize(6.5).font('Helvetica')
              .text(r.num, 44, curY + 3)
              .text(r.name, 70, curY + 3)
              .text(r.type, 280, curY + 3)
              .text(formatINR(r.amt), 450, curY + 3, { align: 'right', width: 96 });
        curY += 14;
      });

      docPdf.fillColor('#dbeafe').rect(36, curY, 522, 18).fill();
      docPdf.fillColor(brandBlue).fontSize(8).font('Helvetica-Bold')
            .text('TOTAL AMOUNT RECEIVED (NET PAID):', 70, curY + 4)
            .text(formatINR(paidAmt), 450, curY + 4, { align: 'right', width: 96 });

      curY += 21;

      docPdf.fillColor(brandDark).fontSize(7).font('Helvetica-Bold')
            .text(`Amount in Words: ${numberToIndianWords(paidAmt)}`, 36, curY);

      curY += 16;

      // Signatures
      docPdf.strokeColor(borderGray).lineWidth(0.5).rect(36, curY, 255, 38).stroke();
      docPdf.strokeColor(borderGray).lineWidth(0.5).rect(303, curY, 255, 38).stroke();

      docPdf.fillColor(textMuted).fontSize(6).font('Helvetica').text('Borrower Renewal Agreement & Acknowledgment', 44, curY + 26);
      docPdf.fillColor(brandDark).fontSize(6.5).font('Helvetica-Bold').text(`For ${companyName.toUpperCase()}`, 311, curY + 5);
      docPdf.fillColor(textMuted).fontSize(6).font('Helvetica').text('Authorized Renewal / Branch Signatory', 311, curY + 26);

      if (billSloganText) {
        curY += 44;
        docPdf.fillColor('#fffbeb').rect(36, curY, 522, 34).fill()
              .strokeColor('#fde68a').lineWidth(0.8).rect(36, curY, 522, 34).stroke();

        docPdf.fillColor('#92400e').fontSize(5.5).font('Helvetica-Bold')
              .text(`OFFICIAL RENEWAL SLOGAN • ${billSloganId || 'PGF-SLOGAN'}`, 44, curY + 4);

        if (hasTamilFont) {
          docPdf.fillColor('#78350f').fontSize(8.5).font('TamilFont')
                .text(`“ ${billSloganText} ”`, 44, curY + 13, { width: 506, align: 'center' });
        } else {
          docPdf.fillColor('#78350f').fontSize(8).font('Helvetica-Bold')
                .text(`“ ${billSloganText} ”`, 44, curY + 13, { width: 506, align: 'center' });
        }

        docPdf.fillColor('#b45309').fontSize(5).font('Helvetica')
              .text('Pavithra Gold Finance • Trusted Gold Loan Partner • Tamil Nadu', 44, curY + 24, { width: 506, align: 'center' });
      }
    }

  // --------------------------------------------------------------------------
  // 4. GOLD RELEASE & LOAN DISCHARGE CERTIFICATE (release / release_certificate / gold_release)
  // --------------------------------------------------------------------------
  } else if (type === 'release' || type === 'release_certificate' || type === 'release_receipt' || type === 'gold_release' || type === 'closure' || type === 'loan_closure') {
    const relNumber = paymentData?.release_number || loanData?.release_number || 'PGF-REL-000001';
    drawStandardHeader('OFFICIAL GOLD RELEASE & DISCHARGE CERTIFICATE', `VOUCHER NO: ${relNumber}`);

    let curY = 138;

    // Borrower & Loan Dossier
    docPdf.fillColor(lightCardBg).rect(36, curY, 255, 96).fill().strokeColor(borderGray).rect(36, curY, 255, 96).stroke();
    docPdf.fillColor(lightCardBg).rect(303, curY, 255, 96).fill().strokeColor(borderGray).rect(303, curY, 255, 96).stroke();

    // Borrower
    docPdf.fillColor(brandBlue).fontSize(8).font('Helvetica-Bold').text('BORROWER / PLEDGOR DOSSIER', 44, curY + 7);
    if (customerPhotoUri) {
      try {
        docPdf.image(customerPhotoUri, 236, curY + 6, { width: 44, height: 44 });
      } catch {}
    }
    docPdf.fillColor(brandDark).fontSize(7).font('Helvetica')
          .text(`Name: ${customerData?.name || loanData?.customer?.name || '—'}`, 44, curY + 20)
          .text(`Customer ID: ${customerData?.customer_number || customerData?.id || '—'}`, 44, curY + 32)
          .text(`Mobile: ${customerData?.phone_primary ? '+91 ' + customerData.phone_primary : '—'}`, 44, curY + 44)
          .text(`Address: ${customerData?.address ? `${customerData.address}${customerData.city ? ', ' + customerData.city : ''}` : '—'}`, 44, curY + 56, { width: 185 })
          .text(`Aadhaar: ${customerData?.national_id || 'Verified'}  |  PAN: ${customerData?.pan_number || 'On File'}`, 44, curY + 80);

    // Loan & Release Terms
    const origDateStr = loanData?.origination_date ? new Date(loanData.origination_date).toLocaleDateString('en-IN') : todayStr;
    const relDateStr = loanData?.closed_at ? new Date(loanData.closed_at).toLocaleDateString('en-IN') : (paymentData?.payment_date ? new Date(paymentData.payment_date).toLocaleDateString('en-IN') : todayStr);

    docPdf.fillColor(brandBlue).fontSize(8).font('Helvetica-Bold').text('LOAN DISCHARGE & SETTLEMENT TERMS', 311, curY + 7);
    docPdf.fillColor(brandDark).fontSize(7).font('Helvetica')
          .text(`Loan Account Number: ${loanData?.loan_number || '—'}`, 311, curY + 20)
          .text(`Pledge Origination Date: ${origDateStr}`, 311, curY + 32)
          .text(`Official Release Date: ${relDateStr}`, 311, curY + 44)
          .text(`Sanctioned Principal: ${formatINR(loanData?.principal_amount || 0)}`, 311, curY + 56)
          .text(`Annual Interest Rate: ${loanData?.interest_rate_apr || 18}% APR`, 311, curY + 68)
          .text(`Settlement Status: FULLY SETTLED & CLOSED (ZERO BALANCE)`, 311, curY + 80);

    curY += 104;

    // Released Gold Ornaments Table
    docPdf.fillColor(brandBlue).fontSize(8).font('Helvetica-Bold').text('RELEASED GOLD JEWELLERY & ORNAMENTS INVENTORY', 36, curY);
    curY += 11;

    docPdf.fillColor(brandDark).rect(36, curY, 522, 15).fill();
    docPdf.fillColor('#ffffff').fontSize(6.5).font('Helvetica-Bold')
          .text('#', 42, curY + 3.5)
          .text('Ornament Description', 58, curY + 3.5)
          .text('Purity', 210, curY + 3.5)
          .text('Gross Wt', 260, curY + 3.5)
          .text('Stone Wt', 310, curY + 3.5)
          .text('Net Wt', 360, curY + 3.5)
          .text('Valuation', 415, curY + 3.5)
          .text('Custody Status', 475, curY + 3.5);

    curY += 15;
    let relGross = 0, relStone = 0, relNet = 0, relVal = 0;

    if (goldItems.length > 0) {
      goldItems.forEach((item, idx) => {
        const itemVal = item.valuation_inr || (item.net_weight * (item.market_rate_per_gram || item.gold_rate_per_gram || 5400));
        docPdf.fillColor(idx % 2 === 0 ? '#f8fafc' : '#ffffff').rect(36, curY, 522, 14).fill();
        docPdf.fillColor(brandDark).fontSize(6.5).font('Helvetica')
              .text(String(idx + 1), 42, curY + 3)
              .text(item.item_description || item.ornament_type || 'Gold Item', 58, curY + 3, { width: 145, ellipsis: true })
              .text(item.purity_karat || '22K', 210, curY + 3)
              .text(`${(item.gross_weight || item.weight_grams || 0).toFixed(2)}g`, 260, curY + 3)
              .text(`${(item.stone_weight || 0).toFixed(2)}g`, 310, curY + 3)
              .text(`${(item.net_weight || item.weight_grams || 0).toFixed(2)}g`, 360, curY + 3)
              .text(formatINR(itemVal), 415, curY + 3)
              .text('RELEASED', 475, curY + 3);

        relGross += item.gross_weight || item.weight_grams || 0;
        relStone += item.stone_weight || 0;
        relNet += item.net_weight || item.weight_grams || 0;
        relVal += itemVal;
        curY += 14;
      });
    } else {
      docPdf.fillColor('#ffffff').rect(36, curY, 522, 14).fill();
      docPdf.fillColor(textMuted).fontSize(6.5).font('Helvetica').text('Gold ornament records verified under release custody.', 42, curY + 3);
      curY += 14;
    }

    // Totals line
    docPdf.fillColor('#e2e8f0').rect(36, curY, 522, 14).fill();
    docPdf.fillColor(brandDark).fontSize(6.5).font('Helvetica-Bold')
          .text('TOTAL RELEASED GOLD COLLATERAL:', 58, curY + 3)
          .text(`${relGross.toFixed(2)}g`, 260, curY + 3)
          .text(`${relStone.toFixed(2)}g`, 310, curY + 3)
          .text(`${relNet.toFixed(2)}g`, 360, curY + 3)
          .text(formatINR(relVal), 415, curY + 3)
          .text('ALL RELEASED', 475, curY + 3);

    curY += 18;

    // Photographic Evidence (Embedded Gold Photos - IMG-01, IMG-02)
    const relPhotoUrls = getCollateralPhotoUrls(goldItems).slice(0, 4);
    if (relPhotoUrls.length > 0) {
      docPdf.fillColor(brandBlue).fontSize(7).font('Helvetica-Bold').text('PHOTOGRAPHIC EVIDENCE OF RELEASED COLLATERAL:', 36, curY);
      curY += 10;
      let photoX = 36;
      for (const pUrl of relPhotoUrls) {
        try {
          const buf = await fetchImageBuffer(pUrl);
          if (buf) {
            const pUri = toDataUri(buf, 'image/jpeg');
            if (pUri) {
              docPdf.image(pUri, photoX, curY, { width: 60, height: 42, fit: [60, 42] });
            }
          }
        } catch {}
        photoX += 70;
      }
      curY += 48;
    }

    // Full Financial Discharge & Settlement Breakdown
    docPdf.fillColor(brandBlue).fontSize(8).font('Helvetica-Bold').text('FINAL SETTLEMENT & ZERO BALANCE AUDIT', 36, curY);
    curY += 11;

    const totPrincipalPaid = loanData?.principal_amount || loanData?.total_principal_paid || 0;
    const totInterestPaid = loanData?.total_interest_paid || paymentData?.interest_portion || 0;
    const finalAmountPaid = paymentData?.amount_paid || (loanData?.principal_amount || 0);

    docPdf.fillColor(lightCardBg).rect(36, curY, 522, 44).fill().strokeColor(borderGray).rect(36, curY, 522, 44).stroke();
    docPdf.fillColor(brandDark).fontSize(7).font('Helvetica')
          .text(`Sanctioned Principal: ${formatINR(loanData?.principal_amount || 0)}`, 44, curY + 7)
          .text(`Total Principal Repaid: ${formatINR(totPrincipalPaid)}`, 200, curY + 7)
          .text(`Total Interest Repaid: ${formatINR(totInterestPaid)}`, 370, curY + 7)
          .text(`Final Release Settlement Paid: ${formatINR(finalAmountPaid)} (${numberToIndianWords(finalAmountPaid)})`, 44, curY + 19)
          .text(`Official Release Voucher: ${relNumber}`, 44, curY + 31)
          .text(`Remaining Balance Due: ${formatINR(0)} (ZERO OUTSTANDING)`, 300, curY + 31);

    curY += 52;

    // Statutory Borrower Release Undertaking
    docPdf.fillColor(brandBlue).fontSize(7).font('Helvetica-Bold').text('STATUTORY DISCHARGE & RELEASE UNDERTAKING:', 36, curY);
    curY += 9;
    docPdf.fillColor(textMuted).fontSize(5.5).font('Helvetica')
          .text('1. The borrower acknowledges physical handover and safe receipt of all pledged gold jewellery ornaments described above in intact, original condition.', 36, curY)
          .text('2. The borrower and Pavithra Gold Finance confirm that this loan account is fully discharged with zero balance remaining.', 36, curY + 8)
          .text('3. All pledge encumbrances and security liens created under Tamil Nadu Pawnbrokers Act are hereby permanently terminated.', 36, curY + 16);

    curY += 28;

    // Signatures Block
    docPdf.strokeColor(borderGray).lineWidth(0.5).rect(36, curY, 255, 42).stroke();
    docPdf.strokeColor(borderGray).lineWidth(0.5).rect(303, curY, 255, 42).stroke();

    if (customerSignatureUri) {
      try {
        docPdf.image(customerSignatureUri, 44, curY + 3, { width: 85, height: 24 });
      } catch {}
    }
    docPdf.fillColor(textMuted).fontSize(6).font('Helvetica-Bold').text('BORROWER SIGNATURE & ACKNOWLEDGMENT OF RECEIPT', 44, curY + 30);
    docPdf.fillColor(brandDark).fontSize(6.5).font('Helvetica-Bold').text(`For ${companyName.toUpperCase()}`, 311, curY + 6);
    docPdf.fillColor(textMuted).fontSize(6).font('Helvetica').text('Authorized Pawnbroker / Vault Custodian Signatory', 311, curY + 30);

    // Rotating Tamil Slogan Banner
    if (billSloganText) {
      curY += 48;
      docPdf.fillColor('#fffbeb').rect(36, curY, 522, 34).fill()
            .strokeColor('#fde68a').lineWidth(0.8).rect(36, curY, 522, 34).stroke();

      docPdf.fillColor('#92400e').fontSize(5.5).font('Helvetica-Bold')
            .text(`OFFICIAL RELEASE SLOGAN • ${billSloganId || 'PGF-SLOGAN'}`, 44, curY + 4);

      if (hasTamilFont) {
        docPdf.fillColor('#78350f').fontSize(8.5).font('TamilFont')
              .text(`“ ${billSloganText} ”`, 44, curY + 13, { width: 506, align: 'center' });
      } else {
        docPdf.fillColor('#78350f').fontSize(8).font('Helvetica-Bold')
              .text(`“ ${billSloganText} ”`, 44, curY + 13, { width: 506, align: 'center' });
      }

      docPdf.fillColor('#b45309').fontSize(5).font('Helvetica')
            .text('Pavithra Gold Finance • Committed to Transparency, Honor & Excellence', 44, curY + 24, { width: 506, align: 'center' });
    }

  // --------------------------------------------------------------------------
  // 5. CUSTOMER CONSOLIDATED STATEMENT (customer_statement)
  // --------------------------------------------------------------------------
  } else if (type === 'customer_statement') {
    drawStandardHeader('CUSTOMER CONSOLIDATED PORTFOLIO STATEMENT', `CUSTOMER NO: ${customerData?.customer_number || customerData?.id || '—'}`);

    let curY = 138;

    // Customer Dossier Card
    docPdf.fillColor(lightCardBg).rect(36, curY, 522, 50).fill().strokeColor(borderGray).rect(36, curY, 522, 50).stroke();
    docPdf.fillColor(brandDark).fontSize(7.5).font('Helvetica')
          .text(`Customer Name: ${customerData?.name || '—'}`, 44, curY + 8)
          .text(`Registered Mobile: ${customerData?.phone_primary ? '+91 ' + customerData.phone_primary : '—'}`, 300, curY + 8)
          .text(`Aadhaar No: ${customerData?.national_id || '—'}`, 44, curY + 20)
          .text(`PAN No: ${customerData?.pan_number || '—'}`, 300, curY + 20)
          .text(`Residential Address: ${customerData?.address ? `${customerData.address}${customerData?.city ? ', ' + customerData.city : ''}` : '—'}`, 44, curY + 32, { width: 460 });

    curY += 58;

    // Summary Metric Strips
    const totalDisbursed = customerLoansList.reduce((acc, l) => acc + (l.principal_amount || 0), 0);
    const totalPrincipalPaid = customerLoansList.reduce((acc, l) => acc + (l.total_principal_paid || 0), 0);
    const activeOutstanding = Math.max(0, totalDisbursed - totalPrincipalPaid);

    docPdf.fillColor('#eff6ff').rect(36, curY, 170, 36).fill().strokeColor('#bfdbfe').rect(36, curY, 170, 36).stroke();
    docPdf.fillColor('#1e40af').fontSize(6.5).font('Helvetica-Bold').text('TOTAL DISBURSED', 44, curY + 6);
    docPdf.fontSize(10).text(formatINR(totalDisbursed), 44, curY + 18);

    docPdf.fillColor('#f0fdf4').rect(212, curY, 170, 36).fill().strokeColor('#bbf7d0').rect(212, curY, 170, 36).stroke();
    docPdf.fillColor('#166534').fontSize(6.5).font('Helvetica-Bold').text('TOTAL PRINCIPAL CLEARED', 220, curY + 6);
    docPdf.fontSize(10).text(formatINR(totalPrincipalPaid), 220, curY + 18);

    docPdf.fillColor('#fff1f2').rect(388, curY, 170, 36).fill().strokeColor('#fecdd3').rect(388, curY, 170, 36).stroke();
    docPdf.fillColor('#9f1239').fontSize(6.5).font('Helvetica-Bold').text('ACTIVE OUTSTANDING BALANCE', 396, curY + 6);
    docPdf.fontSize(10).text(formatINR(activeOutstanding), 396, curY + 18);

    curY += 46;

    // Active Loans Portfolio Table
    docPdf.fillColor(brandBlue).fontSize(8).font('Helvetica-Bold').text(`PLEDGED LOAN ACCOUNTS DOSSIER (${customerLoansList.length} Accounts)`, 36, curY);
    curY += 12;

    docPdf.fillColor(brandDark).rect(36, curY, 522, 16).fill();
    docPdf.fillColor('#ffffff').fontSize(6.5).font('Helvetica-Bold')
          .text('#', 42, curY + 4)
          .text('Loan Number', 60, curY + 4)
          .text('Disbursal Date', 160, curY + 4)
          .text('Sanctioned Principal', 250, curY + 4)
          .text('Principal Paid', 350, curY + 4)
          .text('Balance Due', 440, curY + 4)
          .text('Status', 510, curY + 4);

    curY += 16;
    if (customerLoansList.length > 0) {
      customerLoansList.forEach((l, idx) => {
        const bal = Math.max(0, (l.principal_amount || 0) - (l.total_principal_paid || 0));
        docPdf.fillColor(idx % 2 === 0 ? '#f8fafc' : '#ffffff').rect(36, curY, 522, 15).fill();
        docPdf.fillColor(brandDark).fontSize(6.5).font('Helvetica')
              .text(String(idx + 1), 42, curY + 3.5)
              .text(l.loan_number, 60, curY + 3.5)
              .text(l.origination_date?.split('T')[0] || '—', 160, curY + 3.5)
              .text(formatINR(l.principal_amount || 0), 250, curY + 3.5)
              .text(formatINR(l.total_principal_paid || 0), 350, curY + 3.5)
              .text(formatINR(bal), 440, curY + 3.5)
              .text(l.status || 'Active', 510, curY + 3.5);
        curY += 15;
      });
    } else {
      docPdf.fillColor('#ffffff').rect(36, curY, 522, 16).fill();
      docPdf.fillColor(textMuted).fontSize(7).font('Helvetica').text('No loan accounts found', 44, curY + 4);
      curY += 16;
    }

    curY += 15;

    // Repayments Ledger History Table
    docPdf.fillColor(brandBlue).fontSize(8).font('Helvetica-Bold').text(`LIFETIME REPAYMENTS HISTORY (${paymentsHistory.length} Transactions)`, 36, curY);
    curY += 12;

    docPdf.fillColor(brandDark).rect(36, curY, 522, 16).fill();
    docPdf.fillColor('#ffffff').fontSize(6.5).font('Helvetica-Bold')
          .text('Receipt No', 44, curY + 4)
          .text('Date', 130, curY + 4)
          .text('Mode', 210, curY + 4)
          .text('Interest Paid', 290, curY + 4)
          .text('Principal Paid', 380, curY + 4)
          .text('Total Amount Paid', 465, curY + 4);

    curY += 16;
    if (paymentsHistory.length > 0) {
      paymentsHistory.slice(0, 8).forEach((p, idx) => {
        docPdf.fillColor(idx % 2 === 0 ? '#f8fafc' : '#ffffff').rect(36, curY, 522, 14).fill();
        docPdf.fillColor(brandDark).fontSize(6.5).font('Helvetica')
              .text(p.receipt_number || p.id.substring(0,8), 44, curY + 3)
              .text(p.payment_date?.split('T')[0] || '—', 130, curY + 3)
              .text(p.mode || 'UPI', 210, curY + 3)
              .text(formatINR(p.interest_portion || 0), 290, curY + 3)
              .text(formatINR(p.principal_portion || 0), 380, curY + 3)
              .text(formatINR(p.amount_paid || 0), 465, curY + 3);
        curY += 14;
      });
    } else {
      docPdf.fillColor('#ffffff').rect(36, curY, 522, 16).fill();
      docPdf.fillColor(textMuted).fontSize(7).font('Helvetica').text('No repayment transactions found', 44, curY + 4);
      curY += 16;
    }

    curY += 20;
    docPdf.fillColor(textMuted).fontSize(6).font('Helvetica')
          .text(`Statement generated on ${new Date().toLocaleString('en-IN')} by Pavithra Gold Finance Core Engine. Valid without physical signature.`, 36, curY);

  // --------------------------------------------------------------------------
  // 5. GENERIC / LOAN STATEMENT & CLOSURE
  // --------------------------------------------------------------------------
  } else {
    drawStandardHeader('LOAN ACCOUNT & DISCHARGE STATEMENT', `ACCOUNT: ${loanData?.loan_number || '—'}`);

    let curY = 138;

    // 1. Borrower & KYC Information Dossier
    docPdf.fillColor(lightCardBg).rect(36, curY, 522, 54).fill().strokeColor(borderGray).rect(36, curY, 522, 54).stroke();
    docPdf.fillColor(brandDark).fontSize(7.5).font('Helvetica')
          .text(`Borrower Name: ${customerData?.name || loanData?.customer?.name || '—'}`, 44, curY + 8)
          .text(`Customer ID: ${customerData?.customer_number || customerData?.id || '—'}`, 300, curY + 8)
          .text(`Primary Mobile: ${customerData?.phone_primary ? '+91 ' + customerData.phone_primary : '—'}`, 44, curY + 20)
          .text(`KYC Status: ${customerData?.kyc_status || '—'} (Aadhaar: ${customerData?.national_id ? 'XXXX-XXXX-' + customerData.national_id.slice(-4) : '—'})`, 300, curY + 20)
          .text(`Residential Address: ${customerData?.address ? `${customerData.address}${customerData?.city ? ', ' + customerData.city : ''}${customerData?.pin_code ? ' - ' + customerData.pin_code : ''}` : '—'}`, 44, curY + 32, { width: 480 });

    curY += 60;

    // 2. Financial Position & Balance Strip
    const sanctionedPrincipal = loanData?.principal_amount || 0;
    const principalPaid = loanData?.total_principal_paid || 0;
    const remainingPrincipal = Math.max(0, sanctionedPrincipal - principalPaid);
    const accruedInterest = loanData?.outstanding_interest || 0;
    const totalOutstanding = remainingPrincipal + accruedInterest;
    const apr = loanData?.interest_rate_apr || 18;
    const monthlyRate = (apr / 12).toFixed(2);

    docPdf.fillColor('#eff6ff').rect(36, curY, 126, 44).fill().strokeColor('#bfdbfe').rect(36, curY, 126, 44).stroke();
    docPdf.fillColor('#1e40af').fontSize(6.5).font('Helvetica-Bold').text('SANCTIONED PRINCIPAL', 42, curY + 6);
    docPdf.fontSize(9.5).text(formatINR(sanctionedPrincipal), 42, curY + 18);
    docPdf.fontSize(6).font('Helvetica').text(`APR: ${apr}% (${monthlyRate}%/mo)`, 42, curY + 32);

    docPdf.fillColor('#f0fdf4').rect(168, curY, 126, 44).fill().strokeColor('#bbf7d0').rect(168, curY, 126, 44).stroke();
    docPdf.fillColor('#166534').fontSize(6.5).font('Helvetica-Bold').text('PRINCIPAL REPAID', 174, curY + 6);
    docPdf.fontSize(9.5).text(formatINR(principalPaid), 174, curY + 18);
    docPdf.fontSize(6).font('Helvetica').text(`Rem. Principal: ${formatINR(remainingPrincipal)}`, 174, curY + 32);

    docPdf.fillColor('#fffbeb').rect(300, curY, 126, 44).fill().strokeColor('#fde68a').rect(300, curY, 126, 44).stroke();
    docPdf.fillColor('#b45309').fontSize(6.5).font('Helvetica-Bold').text('LIVE ACCRUED INTEREST', 306, curY + 6);
    docPdf.fontSize(9.5).text(formatINR(accruedInterest), 306, curY + 18);
    docPdf.fontSize(6).font('Helvetica').text(`Int. Paid: ${formatINR(loanData?.total_interest_paid || 0)}`, 306, curY + 32);

    docPdf.fillColor('#fff1f2').rect(432, curY, 126, 44).fill().strokeColor('#fecdd3').rect(432, curY, 126, 44).stroke();
    docPdf.fillColor('#9f1239').fontSize(6.5).font('Helvetica-Bold').text('TOTAL OUTSTANDING DUE', 438, curY + 6);
    docPdf.fontSize(9.5).text(formatINR(totalOutstanding), 438, curY + 18);
    docPdf.fontSize(6).font('Helvetica').text(`Status: ${loanData?.status || 'Active'}`, 438, curY + 32);

    curY += 52;

    // 3. Pledged Gold Collateral Specifications
    const totalGross = goldItems.reduce((acc, g) => acc + (g.gross_weight || g.weight_grams || 0), 0);
    const totalStone = goldItems.reduce((acc, g) => acc + (g.stone_weight || 0), 0);
    const totalNet = goldItems.reduce((acc, g) => acc + (g.net_weight || g.weight_grams || 0), 0);
    const totalValuation = goldItems.reduce((acc, g) => acc + (g.valuation_inr || 0), 0);

    docPdf.fillColor(brandBlue).fontSize(8).font('Helvetica-Bold').text(`PLEDGED GOLD COLLATERAL SPECIFICATIONS (${goldItems.length} Items)`, 36, curY);
    curY += 12;

    docPdf.fillColor(brandDark).rect(36, curY, 522, 16).fill();
    docPdf.fillColor('#ffffff').fontSize(6.5).font('Helvetica-Bold')
          .text('#', 42, curY + 4)
          .text('Item Description', 60, curY + 4)
          .text('Purity', 210, curY + 4)
          .text('Gross Wt', 270, curY + 4)
          .text('Stone Wt', 335, curY + 4)
          .text('Net Weight', 400, curY + 4)
          .text('Valuation (INR)', 470, curY + 4, { width: 80, align: 'right' });

    curY += 16;
    if (goldItems.length > 0) {
      goldItems.forEach((g, idx) => {
        docPdf.fillColor(idx % 2 === 0 ? '#f8fafc' : '#ffffff').rect(36, curY, 522, 14).fill();
        docPdf.fillColor(brandDark).fontSize(6.5).font('Helvetica')
              .text(String(idx + 1), 42, curY + 3.5)
              .text(g.item_description || g.ornament_type || 'Gold Ornament', 60, curY + 3.5)
              .text(g.purity_karat || '22K', 210, curY + 3.5)
              .text(`${(g.gross_weight || g.weight_grams || 0).toFixed(2)}g`, 270, curY + 3.5)
              .text(`${(g.stone_weight || 0).toFixed(2)}g`, 335, curY + 3.5)
              .text(`${(g.net_weight || g.weight_grams || 0).toFixed(2)}g`, 400, curY + 3.5)
              .text(formatINR(g.valuation_inr || 0), 470, curY + 3.5, { width: 80, align: 'right' });
        curY += 14;
      });
      // Subtotal row
      docPdf.fillColor('#f1f5f9').rect(36, curY, 522, 14).fill().strokeColor(borderGray).rect(36, curY, 522, 14).stroke();
      docPdf.fillColor(brandDark).fontSize(6.5).font('Helvetica-Bold')
            .text('TOTAL COLLATERAL:', 60, curY + 3.5)
            .text(`${totalGross.toFixed(2)}g`, 270, curY + 3.5)
            .text(`${totalStone.toFixed(2)}g`, 335, curY + 3.5)
            .text(`${totalNet.toFixed(2)}g`, 400, curY + 3.5)
            .text(formatINR(totalValuation), 470, curY + 3.5, { width: 80, align: 'right' });
      curY += 18;
    } else {
      docPdf.fillColor('#ffffff').rect(36, curY, 522, 14).fill();
      docPdf.fillColor(textMuted).fontSize(6.5).font('Helvetica').text('Gold collateral records verified under vault custody.', 44, curY + 3.5);
      curY += 16;
    }

    curY += 6;

    // 4. Repayment Ledger & Settlement History
    docPdf.fillColor(brandBlue).fontSize(8).font('Helvetica-Bold').text(`REPAYMENT TRANSACTION LEDGER (${paymentsHistory.length} Transactions)`, 36, curY);
    curY += 12;

    docPdf.fillColor(brandDark).rect(36, curY, 522, 16).fill();
    docPdf.fillColor('#ffffff').fontSize(6.5).font('Helvetica-Bold')
          .text('Date', 44, curY + 4)
          .text('Receipt No', 115, curY + 4)
          .text('Mode', 185, curY + 4)
          .text('Type', 245, curY + 4)
          .text('Interest Paid', 315, curY + 4)
          .text('Principal Paid', 395, curY + 4)
          .text('Total Amount', 475, curY + 4, { width: 75, align: 'right' });

    curY += 16;
    if (paymentsHistory.length > 0) {
      paymentsHistory.forEach((p, idx) => {
        docPdf.fillColor(idx % 2 === 0 ? '#f8fafc' : '#ffffff').rect(36, curY, 522, 14).fill();
        docPdf.fillColor(brandDark).fontSize(6.5).font('Helvetica')
              .text(p.payment_date?.split('T')[0] || '—', 44, curY + 3.5)
              .text(p.receipt_number || p.id.substring(0, 8), 115, curY + 3.5)
              .text(p.mode || 'Cash', 185, curY + 3.5)
              .text(p.payment_type || 'Payment', 245, curY + 3.5)
              .text(formatINR(p.interest_portion || 0), 315, curY + 3.5)
              .text(formatINR(p.principal_portion || 0), 395, curY + 3.5)
              .text(formatINR(p.amount_paid || 0), 475, curY + 3.5, { width: 75, align: 'right' });
        curY += 14;
      });
    } else {
      docPdf.fillColor('#ffffff').rect(36, curY, 522, 16).fill();
      docPdf.fillColor(textMuted).fontSize(7).font('Helvetica').text('No repayment transactions found', 44, curY + 4);
      curY += 16;
    }

    curY += 12;
    docPdf.fillColor(textMuted).fontSize(6).font('Helvetica')
          .text(`Official statement generated live from Pavithra Gold Finance core ledger on ${new Date().toLocaleString('en-IN')}. Authorized statutory document.`, 36, curY);
  }

  // --------------------------------------------------------------------------
  // 6. BANK RE-PLEDGE & COLLATERAL CUSTODY RECEIPT (repledge / bank_repledge)
  // --------------------------------------------------------------------------
  if (type === 'repledge' || type === 'bank_repledge') {
    const repNum = repledgeData?.repledge_number || 'PGF-REP-—';
    drawStandardHeader(
      'OFFICIAL BANK RE-PLEDGE & COLLATERAL CUSTODY RECEIPT',
      `RECEIPT NO: ${repNum}`
    );

    let curY = 138;

    // 1. Borrower & Underlying Loan Particulars (Left) + Institutional Bank Details (Right)
    docPdf.fillColor(lightCardBg).rect(36, curY, 255, 108).fill().strokeColor(borderGray).rect(36, curY, 255, 108).stroke();
    docPdf.fillColor(lightCardBg).rect(303, curY, 255, 108).fill().strokeColor(borderGray).rect(303, curY, 255, 108).stroke();

    // Left: Customer & Underlying Loan
    docPdf.fillColor(brandBlue).fontSize(8).font('Helvetica-Bold').text('UNDERLYING CUSTOMER & LOAN PARTICULARS', 44, curY + 8);
    docPdf.fillColor(brandDark).fontSize(7).font('Helvetica')
          .text(`Borrower Name: ${customerData?.name || repledgeData?.customer_name || '—'}`, 44, curY + 22)
          .text(`Customer ID: ${customerData?.customer_number || customerData?.id || repledgeData?.customer_id || '—'}`, 44, curY + 34)
          .text(`Primary Mobile: ${customerData?.phone_primary ? '+91 ' + customerData.phone_primary : (repledgeData?.customer_phone || '—')}`, 44, curY + 46)
          .text(`Underlying Loan No: ${loanData?.loan_number || repledgeData?.loan_number || '—'}`, 44, curY + 58)
          .text(`Loan Origination Date: ${loanData?.origination_date ? new Date(loanData.origination_date).toLocaleDateString('en-IN') : (repledgeData?.original_loan_date ? new Date(repledgeData.original_loan_date).toLocaleDateString('en-IN') : '—')}`, 44, curY + 70)
          .text(`Sanctioned Loan Principal: ${formatINR(loanData?.principal_amount || repledgeData?.original_loan_amount || 0)}`, 44, curY + 82)
          .text(`Current Customer Outstanding: ${formatINR(loanData?.total_outstanding || repledgeData?.current_loan_outstanding || 0)}`, 44, curY + 94);

    // Right: Commercial Bank Information & Ownership
    docPdf.fillColor(brandBlue).fontSize(8).font('Helvetica-Bold').text('INSTITUTIONAL BANK & PLEDGE DETAILS', 311, curY + 8);
    docPdf.fillColor(brandDark).fontSize(7).font('Helvetica')
          .text(`Bank Name: ${repledgeData?.bank_name || '—'}`, 311, curY + 22)
          .text(`Bank Branch: ${repledgeData?.bank_branch || '—'}`, 311, curY + 34)
          .text(`Bank Account / Loan No: ${repledgeData?.bank_account_number || '—'}`, 311, curY + 46)
          .text(`Bank Pledge / Sanction Ticket #: ${repledgeData?.bank_loan_number || repledgeData?.bank_pledge_ticket_number || repledgeData?.bank_reference_number || '—'}`, 311, curY + 58)
          .text(`Pledge Registered In Name: ${repledgeData?.pledge_name || 'Pavithra Gold Finance / Branch Signatory'}`, 311, curY + 70)
          .text(`Responsible Branch / Entity: ${repledgeData?.branch_name || companyBranchName} (${companyBranchCode})`, 311, curY + 82)
          .text(`Re-Pledge Status: ${repledgeData?.status || 'Active'}`, 311, curY + 94);

    curY += 116;

    // 2. Financial Terms & Custody Transfer Summary (4 Stat Cards)
    const bankPledgeAmt = repledgeData?.bank_pledge_amount || 0;
    const bankRate = repledgeData?.bank_interest_rate || 0;
    const interestTypeStr = repledgeData?.interest_type || 'Simple';
    const pledgeDateStr = repledgeData?.pledge_date ? new Date(repledgeData.pledge_date).toLocaleDateString('en-IN') : todayStr;
    const dueDateStr = repledgeData?.due_date ? new Date(repledgeData.due_date).toLocaleDateString('en-IN') : 'N/A';

    docPdf.fillColor('#eff6ff').rect(36, curY, 126, 44).fill().strokeColor('#bfdbfe').rect(36, curY, 126, 44).stroke();
    docPdf.fillColor('#1e40af').fontSize(6.5).font('Helvetica-Bold').text('BANK PLEDGE AMOUNT', 42, curY + 6);
    docPdf.fontSize(9.5).text(formatINR(bankPledgeAmt), 42, curY + 18);
    docPdf.fontSize(6).font('Helvetica').text('Sanctioned Institutional Capital', 42, curY + 32);

    docPdf.fillColor('#f0fdf4').rect(168, curY, 126, 44).fill().strokeColor('#bbf7d0').rect(168, curY, 126, 44).stroke();
    docPdf.fillColor('#166534').fontSize(6.5).font('Helvetica-Bold').text('BANK INTEREST RATE', 174, curY + 6);
    docPdf.fontSize(9.5).text(`${bankRate}% p.a.`, 174, curY + 18);
    docPdf.fontSize(6).font('Helvetica').text(`Interest Type: ${interestTypeStr}`, 174, curY + 32);

    docPdf.fillColor('#fffbeb').rect(300, curY, 126, 44).fill().strokeColor('#fde68a').rect(300, curY, 126, 44).stroke();
    docPdf.fillColor('#b45309').fontSize(6.5).font('Helvetica-Bold').text('PLEDGE & DUE DATE', 306, curY + 6);
    docPdf.fontSize(8.5).text(`From: ${pledgeDateStr}`, 306, curY + 18);
    docPdf.fontSize(6).font('Helvetica').text(`Maturity: ${dueDateStr}`, 306, curY + 32);

    docPdf.fillColor('#f8fafc').rect(432, curY, 126, 44).fill().strokeColor('#cbd5e1').rect(432, curY, 126, 44).stroke();
    docPdf.fillColor('#334155').fontSize(6.5).font('Helvetica-Bold').text('PHYSICAL CUSTODY LOCATION', 438, curY + 6);
    docPdf.fontSize(8).text(`${repledgeData?.custody_location || 'Commercial Bank'}`, 438, curY + 18, { width: 114, ellipsis: true });
    docPdf.fontSize(6).font('Helvetica').text('Prev: PGF Safe -> Bank Custody', 438, curY + 32);

    curY += 52;

    // Amount in Words Banner
    docPdf.fillColor('#f1f5f9').rect(36, curY, 522, 18).fill().strokeColor(borderGray).rect(36, curY, 522, 18).stroke();
    docPdf.fillColor(brandDark).fontSize(6.5).font('Helvetica-Bold')
          .text(`AMOUNT IN WORDS: ${numberToIndianWords(bankPledgeAmt)}`, 44, curY + 5);

    curY += 26;

    // 3. Re-Pledged Collateral Ornaments Table
    const transferredOrnaments = (repledgeData?.ornament_details && repledgeData.ornament_details.length > 0)
      ? repledgeData.ornament_details
      : goldItems.map((g: any) => ({
          item_id: g.id,
          description: g.item_description || g.ornament_type || 'Gold Ornament',
          purity_karat: g.purity_karat || '22K',
          gross_weight: g.gross_weight || g.weight_grams || 0,
          stone_weight: g.stone_weight || 0,
          net_weight: g.net_weight || g.weight_grams || 0,
          valuation_inr: g.valuation_inr || 0,
        }));

    docPdf.fillColor(brandBlue).fontSize(8).font('Helvetica-Bold').text(`TRANSFERRED COLLATERAL ORNAMENTS (${transferredOrnaments.length} Items)`, 36, curY);
    curY += 12;

    docPdf.fillColor(brandDark).rect(36, curY, 522, 16).fill();
    docPdf.fillColor('#ffffff').fontSize(6.5).font('Helvetica-Bold')
          .text('#', 42, curY + 4)
          .text('Item Description', 60, curY + 4)
          .text('Purity', 210, curY + 4)
          .text('Gross Wt', 270, curY + 4)
          .text('Stone Wt', 335, curY + 4)
          .text('Net Weight', 400, curY + 4)
          .text('Valuation (INR)', 470, curY + 4, { width: 80, align: 'right' });

    curY += 16;
    let totGross = 0, totStone = 0, totNet = 0, totVal = 0;

    transferredOrnaments.forEach((orn: any, idx: number) => {
      docPdf.fillColor(idx % 2 === 0 ? '#f8fafc' : '#ffffff').rect(36, curY, 522, 14).fill();
      docPdf.fillColor(brandDark).fontSize(6.5).font('Helvetica')
            .text(String(idx + 1), 42, curY + 3.5)
            .text(orn.description || 'Gold Ornament', 60, curY + 3.5, { width: 145, ellipsis: true })
            .text(orn.purity_karat || '22K', 210, curY + 3.5)
            .text(`${(orn.gross_weight || 0).toFixed(2)}g`, 270, curY + 3.5)
            .text(`${(orn.stone_weight || 0).toFixed(2)}g`, 335, curY + 3.5)
            .text(`${(orn.net_weight || 0).toFixed(2)}g`, 400, curY + 3.5)
            .text(formatINR(orn.valuation_inr || 0), 470, curY + 3.5, { width: 80, align: 'right' });

      totGross += orn.gross_weight || 0;
      totStone += orn.stone_weight || 0;
      totNet += orn.net_weight || 0;
      totVal += orn.valuation_inr || 0;
      curY += 14;
    });

    // Subtotal row
    docPdf.fillColor('#f1f5f9').rect(36, curY, 522, 14).fill().strokeColor(borderGray).rect(36, curY, 522, 14).stroke();
    docPdf.fillColor(brandDark).fontSize(6.5).font('Helvetica-Bold')
          .text('TOTAL RE-PLEDGED COLLATERAL:', 60, curY + 3.5)
          .text(`${totGross.toFixed(2)}g`, 270, curY + 3.5)
          .text(`${totStone.toFixed(2)}g`, 335, curY + 3.5)
          .text(`${(repledgeData?.total_net_weight || totNet).toFixed(2)}g`, 400, curY + 3.5)
          .text(formatINR(repledgeData?.total_valuation || totVal), 470, curY + 3.5, { width: 80, align: 'right' });

    curY += 22;

    // 4. Custody & Transfer Terms Notice
    docPdf.fillColor('#eff6ff').rect(36, curY, 522, 38).fill().strokeColor('#93c5fd').rect(36, curY, 522, 38).stroke();
    docPdf.fillColor('#1e40af').fontSize(6.5).font('Helvetica-Bold').text('STATUTORY CUSTODY & DUAL-LEDGER DECLARATION:', 44, curY + 6);
    docPdf.fillColor('#1e293b').fontSize(6).font('Helvetica')
          .text('1. The physical custody of above gold collateral has been safely transferred from PGF Safe Room to the institutional bank branch.', 44, curY + 15)
          .text('2. This transaction represents institutional refinancing and operates under an isolated bank ledger, preserving customer loan terms.', 44, curY + 22)
          .text('3. Physical release to the customer remains legally locked until bank settlement and physical return to PGF Safe is recorded.', 44, curY + 29);

    curY += 46;

    // 5. Signatures and Authorizations
    docPdf.fillColor(brandDark).fontSize(6.5).font('Helvetica-Bold')
          .text(`Prepared By: ${repledgeData?.created_by_name || 'Staff Member'}`, 44, curY)
          .text(`Approved By: ${repledgeData?.approved_by_name || 'Authorized Signatory'}`, 230, curY)
          .text('Bank Handover Officer:', 410, curY);

    docPdf.strokeColor(borderGray).lineWidth(0.6)
          .moveTo(44, curY + 22).lineTo(180, curY + 22).stroke()
          .moveTo(230, curY + 22).lineTo(360, curY + 22).stroke()
          .moveTo(410, curY + 22).lineTo(540, curY + 22).stroke();

    docPdf.fillColor(textMuted).fontSize(5.5).font('Helvetica')
          .text('(Signature / Date)', 44, curY + 24)
          .text('(Branch Manager Signature)', 230, curY + 24)
          .text('(Bank Stamp & Signature)', 410, curY + 24);

    // Tamil Slogan Footer
    if (hasTamilFont && billSloganText) {
      docPdf.fillColor(brandGold).fontSize(7.5).font('TamilFont').text(billSloganText, 36, 762, { align: 'center', width: 522 });
    }
  }

  // Finalize PDF stream
  docPdf.end();

  const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
    docPdf.on('end', () => resolve(Buffer.concat(chunks)));
    docPdf.on('error', reject);
  });

  const outputFilename = `${type}_${repledgeData?.repledge_number || loanData?.loan_number || customerData?.customer_number || paymentData?.receipt_number || 'document'}.pdf`;

  return new Response(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${isDownload ? 'attachment' : 'inline'}; filename="${outputFilename}"`,
      'Cache-Control': 'no-store, max-age=0',
      'Content-Length': String(pdfBuffer.length),
    },
  });
}
