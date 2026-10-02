'use client';

import React, { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ShieldCheck, ShieldAlert, RefreshCw } from 'lucide-react';
import Logo from '@/components/Logo';

function OTPForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const phone = searchParams.get('phone') || '';

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    // Auto-advance to next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newOtp = [...otp];
    for (let i = 0; i < pasted.length; i++) {
      newOtp[i] = pasted[i];
    }
    setOtp(newOtp);
    const nextIndex = Math.min(pasted.length, 5);
    inputRefs.current[nextIndex]?.focus();
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const code = otp.join('');
    if (code.length !== 6) {
      setError('Please enter the complete 6-digit OTP code.');
      setLoading(false);
      return;
    }

    setError('No active OTP challenge exists. Phone OTP recovery is not configured; contact your branch administrator.');
    setLoading(false);
  };

  const handleResend = async () => {
    setOtp(['', '', '', '', '', '']);
    setError('Phone OTP recovery is not configured. Contact your branch administrator.');
    inputRefs.current[0]?.focus();
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Back navigation */}
        <button
          onClick={() => router.push('/auth/forgot-password')}
          className="flex items-center gap-2 text-gray-500 hover:text-[#2563EB] text-xs font-medium mb-8 transition group"
        >
          <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
          Change Mobile Number
        </button>

        <div className="bg-[#ffffff] border border-[#E5E7EB] hover:border-[#2563EB]/20 transition-all duration-300 rounded-xl p-8 shadow-2xl">
          {/* Logo */}
          <div className="mb-8 flex justify-center">
            <Logo size="md" />
          </div>

          <div className="mb-8 text-center">
            <h2 className="text-2xl font-semibold text-gray-900 tracking-wide font-outfit">OTP Verification</h2>
            <p className="text-gray-500 text-xs mt-2 leading-relaxed">
              Enter the 6-digit code sent to <span className="text-[#2563EB] font-semibold">+91 {phone}</span>
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-lg bg-red-50 border border-rose-500/20 text-red-500 text-xs flex items-start gap-2.5">
              <ShieldAlert size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleVerify} className="space-y-6">
            {/* OTP Input Boxes */}
            <div className="flex justify-center gap-3" onPaste={handlePaste}>
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { inputRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  disabled={loading}
                  className={`w-12 h-14 text-center text-xl font-bold rounded-lg border-2 outline-none transition-all duration-200 bg-[#F3F4F6] text-gray-900 disabled:opacity-50 ${
                    digit
                      ? 'border-[#2563EB] shadow-md shadow-[#2563EB]/10'
                      : 'border-[#E5E7EB] focus:border-[#2563EB]'
                  }`}
                />
              ))}
            </div>

            {/* Verify Button */}
            <button
              type="submit"
              disabled={loading || otp.join('').length !== 6}
              className="w-full py-3 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-[#2563EB]/50 text-[#F8FAFC] font-semibold rounded-lg text-sm transition-all duration-300 transform active:scale-95 shadow-lg shadow-[#2563EB]/10 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-[#F8FAFC] border-t-transparent rounded-full animate-spin"></div>
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <ShieldCheck size={16} />
                  <span>Verify OTP</span>
                </>
              )}
            </button>
          </form>

          {/* Resend Section */}
          <div className="mt-6 pt-6 border-t border-[#E5E7EB] text-center">
            <button
              type="button"
              onClick={handleResend}
              className="text-xs text-[#2563EB] hover:text-gray-900 font-semibold flex items-center gap-1.5 mx-auto transition"
            >
              <RefreshCw size={12} />
              Request Help
            </button>
          </div>

          <div className="mt-4 text-center">
            <span className="text-[10px] text-gray-400 font-mono">
              This page cannot verify a code until phone OTP is configured.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OTPPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <OTPForm />
    </Suspense>
  );
}
