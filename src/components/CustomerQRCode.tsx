'use client';

import React, { useState } from 'react';
import { QrCode, Download, Check, Copy, ShieldCheck, Printer } from 'lucide-react';

interface CustomerQRCodeProps {
  customerNumber: string;
  customerName: string;
  phone: string;
  nationalId?: string;
  size?: number;
  showDetails?: boolean;
}

export default function CustomerQRCode({
  customerNumber,
  customerName,
  phone,
  nationalId,
  size = 180,
  showDetails = true,
}: CustomerQRCodeProps) {
  const [copied, setCopied] = useState(false);

  // Payload encoded inside the QR for secure identification
  const qrPayload = JSON.stringify({
    org: 'PAVITHRA_GOLD_FINANCE',
    cid: customerNumber,
    name: customerName,
    phone: phone,
    nid: nationalId ? `...${nationalId.slice(-4)}` : undefined,
    ver: '2.0',
    ts: new Date().toISOString().split('T')[0],
  });

  // Dynamic high-res QR code image generation
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size * 2}x${size * 2}&data=${encodeURIComponent(
    qrPayload
  )}&format=png&margin=8&color=0A192F&bgcolor=FFFFFF`;

  const handleCopyPayload = () => {
    navigator.clipboard.writeText(`PGF Customer ID: ${customerNumber} | Name: ${customerName} | Phone: ${phone}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Customer ID Card - ${customerNumber}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f8fafc; }
            .card { border: 2px solid #0A192F; border-radius: 16px; padding: 24px; width: 320px; background: white; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
            .logo { font-size: 14px; font-weight: bold; color: #0A192F; letter-spacing: 1px; }
            .sub { font-size: 9px; color: #D4AF37; font-weight: 600; text-transform: uppercase; margin-bottom: 16px; }
            .qr { width: 160px; height: 160px; margin: 12px auto; }
            .name { font-size: 16px; font-weight: bold; color: #0f172a; margin-top: 8px; }
            .cid { font-family: monospace; font-size: 13px; color: #2563eb; font-weight: bold; margin-top: 4px; }
            .phone { font-size: 12px; color: #64748b; margin-top: 4px; }
            .footer { font-size: 8px; color: #94a3b8; margin-top: 16px; border-top: 1px dashed #e2e8f0; padding-top: 8px; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="logo">PAVITHRA GOLD FINANCE</div>
            <div class="sub">Verified Customer Identity Pass</div>
            <img src="${qrImageUrl}" class="qr" alt="QR Code" />
            <div class="name">${customerName}</div>
            <div class="cid">${customerNumber}</div>
            <div class="phone">${phone}</div>
            <div class="footer">Scan with PGF Admin App to verify customer authenticity & active loan portfolio.</div>
          </div>
          <script>window.onload = () => { window.print(); window.close(); }</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
      <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
            <QrCode size={18} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wide">Unique Customer QR</h4>
            <p className="text-[10px] text-gray-500">Secure Identity & Loan Verification</p>
          </div>
        </div>
        <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
          <ShieldCheck size={12} />
          Verified
        </span>
      </div>

      {/* QR Code Graphic with Golden Border */}
      <div className="flex flex-col items-center justify-center p-3 bg-gradient-to-b from-blue-50/50 to-white rounded-xl border border-blue-100/60">
        <div className="relative p-2 bg-white rounded-xl shadow-inner border-2 border-[#D4AF37]/30">
          <img
            src={qrImageUrl}
            alt={`QR for ${customerNumber}`}
            width={size}
            height={size}
            className="rounded-lg object-contain"
            loading="lazy"
          />
        </div>

        {showDetails && (
          <div className="text-center mt-3 space-y-0.5">
            <div className="font-mono text-xs font-bold text-[#0A192F] tracking-wide">{customerNumber}</div>
            <div className="text-xs font-semibold text-gray-800">{customerName}</div>
            <div className="text-[11px] font-mono text-gray-500">{phone}</div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-2 mt-4">
        <button
          onClick={handleCopyPayload}
          className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 text-xs font-medium transition active:scale-95"
        >
          {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
          <span>{copied ? 'Copied' : 'Copy Info'}</span>
        </button>

        <button
          onClick={handlePrint}
          className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition active:scale-95"
        >
          <Printer size={14} />
          <span>Print Pass</span>
        </button>
      </div>
    </div>
  );
}
