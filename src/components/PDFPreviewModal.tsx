'use client';

import React, { useState } from 'react';
import { X, Printer, Download, Share2, Check } from 'lucide-react';

interface PDFPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfUrl: string;
  title: string;
}

export default function PDFPreviewModal({ isOpen, onClose, pdfUrl, title }: PDFPreviewModalProps) {
  const [copied, setCopied] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(true);

  if (!isOpen) return null;

  const handlePrint = () => {
    const iframe = document.getElementById('pdf-preview-iframe') as HTMLIFrameElement;
    if (iframe) {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (err) {
        // Fallback for cross-origin or blockages
        window.open(pdfUrl, '_blank')?.print();
      }
    }
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
            <h4 className="text-gray-900 font-semibold font-outfit text-sm">{title}</h4>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <button
              onClick={handlePrint}
              className="p-2 rounded-lg bg-white hover:bg-gray-100 text-gray-600 hover:text-gray-900 border border-gray-200 transition flex items-center gap-1.5 font-bold uppercase tracking-wider text-[9px] cursor-pointer btn-ripple"
              title="Print Document"
            >
              <Printer size={13} />
              <span className="hidden sm:inline">Print</span>
            </button>
            
            <a
              href={pdfUrl}
              download={`${title.toLowerCase().replace(/\s+/g, '_')}.pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg bg-white hover:bg-gray-100 text-gray-600 hover:text-gray-900 border border-gray-200 transition flex items-center gap-1.5 font-bold uppercase tracking-wider text-[9px] cursor-pointer"
              title="Download PDF"
            >
              <Download size={13} />
              <span className="hidden sm:inline">Download</span>
            </a>

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
          {iframeLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-gray-400 bg-white text-xs">
              <div className="w-6 h-6 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin"></div>
              <span>Rendering document layout...</span>
            </div>
          )}
          
          <iframe
            id="pdf-preview-iframe"
            src={`${pdfUrl}#toolbar=0&navpanes=0`}
            className="w-full h-full border-none"
            onLoad={() => setIframeLoading(false)}
          />
        </div>
      </div>
    </div>
  );
}
