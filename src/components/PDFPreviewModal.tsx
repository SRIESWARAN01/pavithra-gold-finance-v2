'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Printer, Download, Share2, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { auth } from '@/lib/firebase';

interface PDFPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfUrl: string;
  title: string;
}

export default function PDFPreviewModal({ isOpen, onClose, pdfUrl, title }: PDFPreviewModalProps) {
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const activeBlobRef = useRef<string | null>(null);

  const fetchPdf = async () => {
    if (!pdfUrl) return;
    setLoading(true);
    setError(null);

    try {
      // 1. If it's already a blob or data URL, use it directly
      if (pdfUrl.startsWith('blob:') || pdfUrl.startsWith('data:')) {
        setBlobUrl(pdfUrl);
        setLoading(false);
        return;
      }

      // 2. Obtain active Firebase ID Token if user is logged in
      let token: string | null = null;
      try {
        if (auth.currentUser) {
          token = await auth.currentUser.getIdToken(false);
        }
      } catch (tokenErr) {
        console.warn('Could not acquire ID token for PDF preview:', tokenErr);
      }

      // Build authenticated target URL
      let targetUrl = pdfUrl;
      if (token && !targetUrl.includes('token=')) {
        const separator = targetUrl.includes('?') ? '&' : '?';
        targetUrl = `${targetUrl}${separator}token=${encodeURIComponent(token)}`;
      }

      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(targetUrl, { headers });

      if (!res.ok) {
        let msg = `Failed to generate document (${res.status} ${res.statusText})`;
        try {
          const errJson = await res.json();
          if (errJson && errJson.error) msg = errJson.error;
        } catch {
          const txt = await res.text();
          if (txt) msg = txt;
        }
        throw new Error(msg);
      }

      const blob = await res.blob();
      const newBlobUrl = URL.createObjectURL(blob);

      // Clean up previous blob URL if exists
      if (activeBlobRef.current) {
        URL.revokeObjectURL(activeBlobRef.current);
      }
      activeBlobRef.current = newBlobUrl;
      setBlobUrl(newBlobUrl);
      setLoading(false);
    } catch (err: any) {
      console.error('PDFPreviewModal Load Error:', err);
      setError(err.message || 'Failed to load document preview.');
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && pdfUrl) {
      fetchPdf();
    } else {
      if (activeBlobRef.current) {
        URL.revokeObjectURL(activeBlobRef.current);
        activeBlobRef.current = null;
      }
      setBlobUrl(null);
      setError(null);
      setLoading(true);
    }

    return () => {
      if (activeBlobRef.current) {
        URL.revokeObjectURL(activeBlobRef.current);
        activeBlobRef.current = null;
      }
    };
  }, [isOpen, pdfUrl]);

  if (!isOpen) return null;

  const handlePrint = () => {
    const iframe = document.getElementById('pdf-preview-iframe') as HTMLIFrameElement;
    if (iframe?.contentWindow) {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        return;
      } catch (err) {
        console.warn('Iframe print failed, falling back:', err);
      }
    }
    const printUrl = blobUrl || pdfUrl;
    window.open(printUrl, '_blank')?.print();
  };

  const handleDownload = () => {
    const downloadTarget = blobUrl || pdfUrl;
    const a = document.createElement('a');
    a.href = downloadTarget;
    a.download = `${title.toLowerCase().replace(/\s+/g, '_')}.pdf`;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
    }, 150);
  };

  const handleShare = () => {
    const absoluteUrl = `${window.location.origin}${pdfUrl}`;
    
    if (navigator.share) {
      navigator.share({
        title: title,
        text: `Pavithra Gold Finance Document - ${title}`,
        url: absoluteUrl,
      }).catch((err) => console.log('Error sharing:', err));
    } else {
      navigator.clipboard.writeText(absoluteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white border border-gray-200 rounded-none sm:rounded-2xl w-full max-w-5xl h-[100dvh] sm:h-[85vh] flex flex-col overflow-hidden shadow-2xl animate-slide-up">
        {/* Header Bar */}
        <div className="h-14 border-b border-gray-100 bg-gray-50 px-4 sm:px-6 flex items-center justify-between text-xs">
          <div className="space-y-0.5">
            <span className="text-blue-600 font-bold tracking-widest uppercase text-[9px] font-mono">Document Hub</span>
            <h4 className="text-gray-900 font-semibold font-outfit text-sm truncate max-w-[200px] sm:max-w-md">{title}</h4>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <button
              onClick={handlePrint}
              disabled={loading || Boolean(error)}
              className="p-2 rounded-lg bg-white hover:bg-gray-100 disabled:opacity-50 text-gray-600 hover:text-gray-900 border border-gray-200 transition flex items-center gap-1.5 font-bold uppercase tracking-wider text-[9px] cursor-pointer"
              title="Print Document"
            >
              <Printer size={13} />
              <span className="hidden sm:inline">Print</span>
            </button>
            
            <button
              onClick={handleDownload}
              disabled={loading || Boolean(error)}
              className="p-2 rounded-lg bg-white hover:bg-gray-100 disabled:opacity-50 text-gray-600 hover:text-gray-900 border border-gray-200 transition flex items-center gap-1.5 font-bold uppercase tracking-wider text-[9px] cursor-pointer"
              title="Download PDF"
            >
              <Download size={13} />
              <span className="hidden sm:inline">Download</span>
            </button>

            <button
              onClick={handleShare}
              className="p-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 transition flex items-center gap-1.5 font-bold uppercase tracking-wider text-[9px] cursor-pointer"
              title="Share Document"
            >
              {copied ? <Check size={13} className="text-emerald-500" /> : <Share2 size={13} />}
              <span className="hidden sm:inline">{copied ? 'Copied' : 'Share'}</span>
            </button>

            <div className="w-px h-6 bg-gray-200 mx-0.5 sm:mx-1 hidden sm:block" />

            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 border border-red-200 transition cursor-pointer"
              title="Close Preview"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Content Box */}
        <div className="flex-1 bg-gray-50 relative">
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-gray-400 bg-white text-xs z-10">
              <div className="w-6 h-6 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin"></div>
              <span>Rendering authorized document layout...</span>
            </div>
          )}

          {error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-gray-700 bg-white p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-1">
                <AlertCircle size={24} />
              </div>
              <h5 className="font-bold text-sm text-gray-900">Document Generation Issue</h5>
              <p className="text-xs text-rose-600 max-w-md bg-rose-50 border border-rose-100 p-3 rounded-lg font-mono">
                {error}
              </p>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={fetchPdf}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <RefreshCw size={13} />
                  Retry
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          ) : blobUrl ? (
            <iframe
              id="pdf-preview-iframe"
              src={`${blobUrl}#toolbar=0&navpanes=0`}
              className="w-full h-full border-none"
              title={title}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
