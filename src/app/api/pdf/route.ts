import { NextRequest } from 'next/server';
import PDFDocument from 'pdfkit/js/pdfkit.standalone';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import path from 'path';
import fs from 'fs';
import { getNextBillSlogan } from '@/lib/db/slogans';

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    return await generatePdfResponse(body);
  } catch (err: any) {
    console.error('PDF POST Error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Failed to generate PDF' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const rawType = searchParams.get('type') || 'ticket';
    const loanId = searchParams.get('loanId') || '';
    const paymentId = searchParams.get('paymentId') || '';
    const customerId = searchParams.get('customerId') || '';
    const isDownload = searchParams.get('download') === 'true';
    const customAmount = parseFloat(searchParams.get('amount') || '0');

    const params: any = {
      type: rawType,
      loanId,
      paymentId,
      customerId,
      download: isDownload,
      customAmount
    };

    return await generatePdfResponse(params);
  } catch (err: any) {
    console.error('PDF GET Error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Failed to generate PDF' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function generatePdfResponse(params: any) {
  const rawType = params.type || 'ticket';
  const type = rawType.toLowerCase();
  const isDownload = Boolean(params.download);
  const customAmount = parseFloat(params.customAmount || '0');

  // 1. Fetch Company Settings
  let companyName = 'PAVITHRA GOLD FINANCE';
  let companyLogo = '';
  let companyAddress = '45, Temple View Complex, West Masi Street, Madurai - 625001';
  let companyPhone = '7094826586';
  let companyEmail = 'support@pavithragoldfinance.com';
  let companyGst = '33AABCP1234F1Z8';
  let companyPan = 'AABCP1234F';
  let companyCin = 'U65923TN2022PTC149821';
  let companyWebsite = 'www.pavithragoldfinance.com';
  let companyBranchName = 'Madurai Main Hub';
  let companyBranchCode = 'MDU-01';
  let companyDescription = 'TAMIL NADU LICENSED PAWNBROKER & GOLD FINANCIER • GOVT REG: TN/MDU/PB/2022/894';

  try {
    const settingsSnap = await getDocs(collection(db, 'settings'));
    settingsSnap.forEach((d) => {
      const data = d.data();
      if (d.id === 'company_name' && data.value) companyName = data.value;
      if (d.id === 'company_logo' && data.value) companyLogo = data.value;
      if (d.id === 'company_address' && data.value) companyAddress = data.value;
      if (d.id === 'company_phone' && data.value) companyPhone = data.value;
      if (d.id === 'company_email' && data.value) companyEmail = data.value;
      if (d.id === 'company_gst' && data.value) companyGst = data.value;
      if (d.id === 'company_pan' && data.value) companyPan = data.value;
      if (d.id === 'company_cin' && data.value) companyCin = data.value;
      if (d.id === 'company_branch_name' && data.value) companyBranchName = data.value;
    });
  } catch (e) {
    // Graceful fallback to licensed defaults
  }

  // Pre-load data objects if provided directly in payload
  let loanData: any = params.loanData || null;
  let customerData: any = params.customerData || null;
  let paymentData: any = params.paymentData || null;
  let goldItems: any[] = params.goldItems || [];
  let paymentsHistory: any[] = params.paymentsHistory || [];
  let customerLoansList: any[] = params.customerLoansList || [];

  // Helper for Data URI
  const toDataUri = (buf: Buffer | null, mime = 'image/png'): string | null => {
    if (!buf) return null;
    return `data:${mime};base64,${buf.toString('base64')}`;
  };

  // If IDs passed and records missing, attempt Firestore retrieval
  if (params.paymentId && !paymentData) {
    try {
      const paySnap = await getDoc(doc(db, 'payments', params.paymentId));
      if (paySnap.exists()) paymentData = { id: paySnap.id, ...paySnap.data() };
    } catch {}
  }

  if ((params.loanId || paymentData?.loan_id) && !loanData) {
    const targetLoanId = params.loanId || paymentData?.loan_id;
    try {
      const loanSnap = await getDoc(doc(db, 'loans', targetLoanId));
      if (loanSnap.exists()) loanData = { id: loanSnap.id, ...loanSnap.data() };
    } catch {}
  }

  if ((params.customerId || loanData?.customer_id || paymentData?.customer_id) && !customerData) {
    const targetCustId = params.customerId || loanData?.customer_id || paymentData?.customer_id;
    try {
      const custSnap = await getDoc(doc(db, 'profiles', targetCustId));
      if (custSnap.exists()) customerData = { id: custSnap.id, ...custSnap.data() };
    } catch {}
  }

  if (loanData?.id && goldItems.length === 0) {
    try {
      const goldSnap = await getDocs(query(collection(db, 'gold_collateral'), where('loan_id', '==', loanData.id)));
      goldItems = goldSnap.docs.map(g => ({ id: g.id, ...g.data() }));
    } catch {}
  }

  if (customerData?.id && customerLoansList.length === 0) {
    try {
      const lSnap = await getDocs(query(collection(db, 'loans'), where('customer_id', '==', customerData.id)));
      customerLoansList = lSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch {}
  }

  if (loanData?.id && paymentsHistory.length === 0) {
    try {
      const pSnap = await getDocs(query(collection(db, 'payments'), where('loan_id', '==', loanData.id)));
      paymentsHistory = pSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      paymentsHistory.sort((a, b) => (b.payment_date || '').localeCompare(a.payment_date || ''));
    } catch {}
  }

  if (customerData?.id && paymentsHistory.length === 0) {
    try {
      const pSnap = await getDocs(query(collection(db, 'payments'), where('customer_id', '==', customerData.id)));
      paymentsHistory = pSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      paymentsHistory.sort((a, b) => (b.payment_date || '').localeCompare(a.payment_date || ''));
    } catch {}
  }

  // Pre-load images (Logo, Customer Photo, Signature)
  let logoUri: string | null = null;
  if (companyLogo) {
    try {
      const res = await fetch(companyLogo);
      if (res.ok) logoUri = toDataUri(Buffer.from(await res.arrayBuffer()), 'image/png');
    } catch {}
  }

  let customerPhotoUri: string | null = null;
  if (customerData?.photo_url) {
    if (customerData.photo_url.startsWith('data:image')) {
      customerPhotoUri = customerData.photo_url;
    } else {
      try {
        const res = await fetch(customerData.photo_url);
        if (res.ok) customerPhotoUri = toDataUri(Buffer.from(await res.arrayBuffer()), 'image/jpeg');
      } catch {}
    }
  }

  let customerSignatureUri: string | null = null;
  if (customerData?.signature_url) {
    if (customerData.signature_url.startsWith('data:image')) {
      customerSignatureUri = customerData.signature_url;
    } else {
      try {
        const res = await fetch(customerData.signature_url);
        if (res.ok) customerSignatureUri = toDataUri(Buffer.from(await res.arrayBuffer()), 'image/png');
      } catch {}
    }
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

  // Set up PDFKit
  const docPdf = new PDFDocument({ size: 'A4', margin: 36 });
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

    // Photographic Evidence (Embedded Gold Photos)
    const goldPhotoUrls = goldItems.flatMap(g => [g.front_photo_url, g.back_photo_url].filter(Boolean)).slice(0, 4);
    if (goldPhotoUrls.length > 0) {
      docPdf.fillColor(brandBlue).fontSize(7.5).font('Helvetica-Bold').text('COLLATERAL PHOTOGRAPHIC EVIDENCE (SCALE & VAULT DEPOSIT):', 36, curY);
      curY += 12;
      let photoX = 36;
      for (const pUrl of goldPhotoUrls) {
        try {
          let pUri = pUrl.startsWith('data:image') ? pUrl : null;
          if (!pUri) {
            const res = await fetch(pUrl);
            if (res.ok) pUri = toDataUri(Buffer.from(await res.arrayBuffer()), 'image/jpeg');
          }
          if (pUri) {
            docPdf.image(pUri, photoX, curY, { width: 70, height: 50, fit: [70, 50] });
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
    drawStandardHeader(
      isBillDoc ? 'OFFICIAL REPAYMENT BILL & SETTLEMENT INVOICE' : 'OFFICIAL MONEY RECEIPT (PLEDGE REPAYMENT)',
      isBillDoc ? `BILL NO: ${paymentData?.receipt_number || '—'}` : `RECEIPT NO: ${paymentData?.receipt_number || '—'}`
    );

    let curY = 138;

    const paidAmt = paymentData?.amount_paid || customAmount || 0;
    const interestPortion = paymentData?.interest_portion || 0;
    const principalPortion = paymentData?.principal_portion || (paidAmt - interestPortion);
    const penaltyPortion = paymentData?.penalty_portion || 0;

    // Receipt Meta Box
    docPdf.fillColor(lightCardBg).rect(36, curY, 522, 60).fill().strokeColor(borderGray).rect(36, curY, 522, 60).stroke();
    docPdf.fillColor(brandDark).fontSize(7.5).font('Helvetica')
          .text(`Bill / Receipt Number: ${paymentData?.receipt_number || '—'}`, 44, curY + 8)
          .text(`Payment Date & Time: ${paymentData?.payment_date ? new Date(paymentData.payment_date).toLocaleString('en-IN') : todayStr}`, 300, curY + 8)
          .text(`Borrower Name: ${customerData?.name || loanData?.customer?.name || '—'}`, 44, curY + 22)
          .text(`Customer ID: ${customerData?.customer_number || customerData?.id || '—'}`, 300, curY + 22)
          .text(`Loan Account No: ${loanData?.loan_number || '—'}`, 44, curY + 36)
          .text(`Payment Mode: ${paymentData?.mode || 'UPI / Cash'} (Ref: ${paymentData?.reference_note || paymentData?.utr || 'DIRECT-COUNTER'})`, 300, curY + 36)
          .text(`Primary Mobile: ${customerData?.phone_primary ? '+91 ' + customerData.phone_primary : '—'}`, 44, curY + 48)
          .text(`Original Principal Disbursed: ${formatINR(loanData?.principal_amount || 0)}`, 300, curY + 48);

    curY += 72;

    // Payment Allocation Table
    docPdf.fillColor(brandBlue).fontSize(8).font('Helvetica-Bold').text('REPAYMENT ALLOCATION BREAKDOWN', 36, curY);
    curY += 12;

    docPdf.fillColor(brandDark).rect(36, curY, 522, 16).fill();
    docPdf.fillColor('#ffffff').fontSize(7).font('Helvetica-Bold')
          .text('#', 44, curY + 4)
          .text('Payment Component', 70, curY + 4)
          .text('Accounting Type', 280, curY + 4)
          .text('Amount Credited', 450, curY + 4, { align: 'right', width: 96 });

    curY += 16;

    const rows = [
      { num: '1', name: 'Accrued Interest Cleared', type: 'Interest Ledger Credit', amt: interestPortion },
      { num: '2', name: 'Principal Balance Reduction', type: 'Principal Reduction', amt: principalPortion },
      { num: '3', name: 'Late Fee / Penal Interest', type: 'Penalty Clearance', amt: penaltyPortion },
    ];

    rows.forEach((r, idx) => {
      docPdf.fillColor(idx % 2 === 0 ? '#f8fafc' : '#ffffff').rect(36, curY, 522, 16).fill();
      docPdf.fillColor(brandDark).fontSize(7).font('Helvetica')
            .text(r.num, 44, curY + 4)
            .text(r.name, 70, curY + 4)
            .text(r.type, 280, curY + 4)
            .text(formatINR(r.amt), 450, curY + 4, { align: 'right', width: 96 });
      curY += 16;
    });

    // Total Paid Line
    docPdf.fillColor('#dbeafe').rect(36, curY, 522, 20).fill();
    docPdf.fillColor(brandBlue).fontSize(8.5).font('Helvetica-Bold')
          .text('TOTAL AMOUNT RECEIVED (NET PAID):', 70, curY + 5)
          .text(formatINR(paidAmt), 450, curY + 5, { align: 'right', width: 96 });

    curY += 24;

    // Amount in words
    docPdf.fillColor(brandDark).fontSize(7.5).font('Helvetica-Bold')
          .text(`Amount in Words: ${numberToIndianWords(paidAmt)}`, 36, curY);

    curY += 18;

    // Outstanding Status After This Payment
    const remainingPrincipal = loanData ? Math.max(0, (loanData.principal_amount || 0) - (loanData.total_principal_paid || 0)) : 0;
    const remainingInterest = loanData?.outstanding_interest || 0;
    const totalOutstanding = remainingPrincipal + remainingInterest;

    docPdf.fillColor(lightCardBg).rect(36, curY, 522, 56).fill().strokeColor(borderGray).rect(36, curY, 522, 56).stroke();
    docPdf.fillColor(brandBlue).fontSize(7.5).font('Helvetica-Bold').text('LOAN POSITION POST-TRANSACTION', 44, curY + 6);
    docPdf.fillColor(brandDark).fontSize(7).font('Helvetica')
          .text(`Remaining Principal: ${formatINR(remainingPrincipal)}`, 44, curY + 18)
          .text(`Remaining Interest: ${formatINR(remainingInterest)}`, 200, curY + 18)
          .text(`Total Outstanding: ${formatINR(totalOutstanding)}`, 370, curY + 18)
          .text(`Next Repayment Due Date: ${loanData?.maturity_date ? new Date(loanData.maturity_date).toLocaleDateString('en-IN') : 'As per monthly schedule'}`, 44, curY + 34)
          .text(`Loan Status: ${loanData?.status || 'Active'}`, 300, curY + 34);

    curY += 68;

    // Signatures
    docPdf.strokeColor(borderGray).lineWidth(0.5).rect(36, curY, 255, 45).stroke();
    docPdf.strokeColor(borderGray).lineWidth(0.5).rect(303, curY, 255, 45).stroke();

    docPdf.fillColor(textMuted).fontSize(6).font('Helvetica').text('Pledgor Repayment Acknowledgment', 44, curY + 32);
    docPdf.fillColor(brandDark).fontSize(6.5).font('Helvetica-Bold').text(`For ${companyName.toUpperCase()}`, 311, curY + 6);
    docPdf.fillColor(textMuted).fontSize(6).font('Helvetica').text('Authorized Cashier / Cash Counter Signatory', 311, curY + 32);

    // --------------------------------------------------------------------------
    // ROTATING TAMIL SLOGAN BANNER (Bill Slogan System — 300 Unique Slogans)
    // --------------------------------------------------------------------------
    if (billSloganText) {
      curY += 52;
      docPdf.fillColor('#fffbeb').rect(36, curY, 522, 40).fill()
            .strokeColor('#fde68a').lineWidth(0.8).rect(36, curY, 522, 40).stroke();

      docPdf.fillColor('#92400e').fontSize(6).font('Helvetica-Bold')
            .text(`OFFICIAL BILL SLOGAN • ${billSloganId || 'PGF-SLOGAN'}`, 44, curY + 6);

      if (hasTamilFont) {
        docPdf.fillColor('#78350f').fontSize(9).font('TamilFont')
              .text(`“ ${billSloganText} ”`, 44, curY + 16, { width: 506, align: 'center' });
      } else {
        docPdf.fillColor('#78350f').fontSize(8.5).font('Helvetica-Bold')
              .text(`“ ${billSloganText} ”`, 44, curY + 16, { width: 506, align: 'center' });
      }

      docPdf.fillColor('#b45309').fontSize(5.5).font('Helvetica')
            .text('Pavithra Gold Finance • Trusted Gold Loan Partner • Tamil Nadu', 44, curY + 29, { width: 506, align: 'center' });
    }

  // --------------------------------------------------------------------------
  // 4. CUSTOMER CONSOLIDATED STATEMENT (customer_statement)
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

  // Finalize PDF stream
  docPdf.end();

  const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
    docPdf.on('end', () => resolve(Buffer.concat(chunks)));
    docPdf.on('error', reject);
  });

  const outputFilename = `${type}_${loanData?.loan_number || customerData?.customer_number || paymentData?.receipt_number || 'document'}.pdf`;

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
