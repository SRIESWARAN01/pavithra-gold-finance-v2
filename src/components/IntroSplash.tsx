'use client';

import React, { useEffect, useState } from 'react';

export default function IntroSplash() {
  const [show, setShow] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    // Check if the user has already seen the splash screen in this session
    const hasSeenSplash = sessionStorage.getItem('pgf_splash_seen');
    
    if (hasSeenSplash === 'true') {
      return;
    }

    // Otherwise, show the splash screen
    const t = setTimeout(() => {
      setShow(true);
    }, 0);

    // After 2.4 seconds, trigger the fade-out exit animation
    const exitTimer = setTimeout(() => {
      setExiting(true);
    }, 2400);

    // After 3.0 seconds, unmount the splash screen and mark it as seen
    const unmountTimer = setTimeout(() => {
      setShow(false);
      sessionStorage.setItem('pgf_splash_seen', 'true');
    }, 3000);

    return () => {
      clearTimeout(t);
      clearTimeout(exitTimer);
      clearTimeout(unmountTimer);
    };
  }, []);

  if (!show) return null;

  return (
    <div 
      className={`fixed inset-0 z-50 bg-white flex flex-col items-center justify-center select-none overflow-hidden ${
        exiting ? 'animate-splash-exit' : ''
      }`}
    >
      {/* Soft Blue Pulse Aura Background */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(37,99,235,0.05)_0%,transparent_60%)] animate-gold-pulse pointer-events-none" />

      <div className="flex flex-col items-center justify-center relative z-10">
        {/* Emblem Shield Logo */}
        <div className="relative w-24 h-24 sm:w-36 sm:h-36 rounded-full overflow-hidden border-2 border-blue-200 bg-white shadow-xl shadow-blue-500/10 flex items-center justify-center animate-logo-zoom">
          <img 
            src="/logo.jpg" 
            alt="PGF Emblem" 
            className="w-full h-full object-cover scale-[1.1]"
          />
          {/* Inner reflection layer */}
          <div className="absolute inset-0 rounded-full border border-white/50 pointer-events-none" />
        </div>

        {/* Brand Typography */}
        <div className="text-center mt-5 sm:mt-8">
          <h1 className="text-gray-900 text-2xl sm:text-3xl font-extrabold tracking-[0.25em] font-outfit uppercase animate-tracking-expand leading-none">
            Pavithra
          </h1>
          <p 
            className="text-blue-600 text-[11px] font-bold tracking-[0.35em] uppercase mt-2.5 font-inter select-none opacity-0"
            style={{
              animation: 'logo-zoom-in 1.0s cubic-bezier(0.25, 1, 0.5, 1) forwards',
              animationDelay: '0.6s'
            }}
          >
            Gold Finance
          </p>
        </div>

        {/* Premium Thin Progress Line */}
        <div className="w-40 sm:w-56 h-[2px] bg-gray-100 rounded-full mt-8 sm:mt-12 overflow-hidden relative">
          <div className="absolute left-0 top-0 h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full animate-progress-fill" />
        </div>
      </div>

      {/* Decorative corner highlights */}
      <div className="absolute top-8 left-8 w-4 h-4 border-t border-l border-blue-200/40 pointer-events-none" />
      <div className="absolute top-8 right-8 w-4 h-4 border-t border-r border-blue-200/40 pointer-events-none" />
      <div className="absolute bottom-8 left-8 w-4 h-4 border-b border-l border-blue-200/40 pointer-events-none" />
      <div className="absolute bottom-8 right-8 w-4 h-4 border-b border-r border-blue-200/40 pointer-events-none" />
    </div>
  );
}
