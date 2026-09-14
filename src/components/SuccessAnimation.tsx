'use client';

import React, { useState, useEffect } from 'react';

interface SuccessAnimationProps {
  title?: string;
  subtitle?: string;
  customerName?: string;
  customerId?: string;
}

/**
 * Premium animated success checkmark with SVG stroke-draw animation.
 * Shows a glowing ring, animated ✓ tick, then reveals text with staggered fade-in.
 */
export default function SuccessAnimation({
  title = 'Customer Added Successfully',
  subtitle,
  customerName,
  customerId,
}: SuccessAnimationProps) {
  const [showText, setShowText] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // After the checkmark finishes drawing (~1s), reveal the title text
    const textTimer = setTimeout(() => setShowText(true), 900);
    // After another 300ms, reveal customer details
    const detailTimer = setTimeout(() => setShowDetails(true), 1200);
    return () => {
      clearTimeout(textTimer);
      clearTimeout(detailTimer);
    };
  }, []);

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      {/* Animated Checkmark Circle */}
      <div className="success-checkmark-wrapper">
        {/* Outer glow ring */}
        <div className="success-glow-ring" />

        {/* Circle + Check SVG */}
        <svg
          className="success-checkmark-svg"
          viewBox="0 0 100 100"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Background circle that draws in */}
          <circle
            className="success-circle"
            cx="50"
            cy="50"
            r="44"
            fill="none"
            stroke="url(#successGradient)"
            strokeWidth="5"
            strokeLinecap="round"
          />
          {/* Checkmark path that draws in after circle */}
          <path
            className="success-check"
            d="M30 52 L44 66 L72 38"
            fill="none"
            stroke="#fff"
            strokeWidth="5.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Gradient definition */}
          <defs>
            <linearGradient id="successGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#10B981" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
          </defs>
        </svg>

        {/* Fill circle behind the check (appears with a pop) */}
        <div className="success-fill-circle" />
      </div>

      {/* Text Content - staggered reveal */}
      <div className={`text-center transition-all duration-500 ${showText ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1 bg-emerald-50 text-emerald-700 font-extrabold text-[11px] rounded-full uppercase tracking-wider border border-emerald-200 shadow-sm">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-amber-500">
            <path d="M12 2L14.09 8.26L21 9.27L16 14.14L17.18 21.02L12 17.77L6.82 21.02L8 14.14L3 9.27L9.91 8.26L12 2Z" fill="currentColor" />
          </svg>
          {title}
        </div>
      </div>

      {customerName && (
        <div className={`text-center transition-all duration-500 delay-100 ${showDetails ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 font-outfit tracking-tight">
            {customerName}
          </h2>
          {customerId && (
            <p className="text-xs text-gray-500 font-mono mt-1">
              Customer ID: <strong className="text-[#2563EB]">{customerId}</strong>
            </p>
          )}
          {subtitle && (
            <p className="text-xs text-gray-400 mt-1">{subtitle}</p>
          )}
        </div>
      )}
    </div>
  );
}
