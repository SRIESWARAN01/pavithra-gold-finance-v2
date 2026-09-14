'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Phone, ArrowLeft, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { isFirebaseConfigured } from '@/lib/auth';
import Logo from '@/components/Logo';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!phone) {
      setError('Please enter your registered mobile number.');
      setLoading(false);
      return;
    }

    if (!/^[6-9]\d{9}$/.test(phone.trim())) {
      setError('Please enter a valid 10-digit Indian mobile number.');
      setLoading(false);
      return;
    }

    try {
      if (isFirebaseConfigured()) {
        const email = `${phone.trim()}@pgf.local`;
        await sendPasswordResetEmail(auth, email);
      } else {
        // Dev bypass
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      setSent(true);
      // Navigate to OTP verification page after short delay
      setTimeout(() => {
        router.push(`/auth/otp?phone=${phone}`);
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Back to Login */}
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-2 text-gray-500 hover:text-[#2563EB] text-xs font-medium mb-8 transition group"
        >
          <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
          Back to Login
        </button>

        <div className="bg-[#ffffff] border border-[#E5E7EB] hover:border-[#2563EB]/20 transition-all duration-300 rounded-xl p-8 shadow-2xl">
          {/* Mobile Logo */}
          <div className="mb-8 flex justify-center">
            <Logo size="md" />
          </div>

          <div className="mb-8 text-center">
            <h2 className="text-2xl font-semibold text-gray-900 tracking-wide font-outfit">Forgot Password</h2>
            <p className="text-gray-500 text-xs mt-2 leading-relaxed">
              Enter your registered mobile number. We&apos;ll send a 6-digit OTP to verify your identity.
            </p>
          </div>

          {sent && (
            <div className="mb-6 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-xs flex items-center gap-2.5">
              <CheckCircle2 size={16} className="shrink-0" />
              <span>OTP sent successfully to +91 {phone}. Redirecting...</span>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 rounded-lg bg-red-50 border border-rose-500/20 text-red-500 text-xs flex items-start gap-2.5">
              <ShieldAlert size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSendOTP} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#2563EB] uppercase tracking-wider block">
                Registered Mobile Number
              </label>
              <div className="relative">
                <span className="absolute left-3 top-3.5 text-xs text-gray-500 font-medium">+91</span>
                <input
                  type="tel"
                  placeholder="9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={loading || sent}
                  maxLength={10}
                  className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] text-gray-900 text-sm rounded-lg pl-12 pr-4 py-3 outline-none transition-all placeholder-slate-500 font-inter disabled:opacity-50"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || sent}
              className="w-full py-3 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-[#2563EB]/50 text-[#F8FAFC] font-semibold rounded-lg text-sm transition-all duration-300 transform active:scale-95 shadow-lg shadow-[#2563EB]/10 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-[#F8FAFC] border-t-transparent rounded-full animate-spin"></div>
                  <span>Sending OTP...</span>
                </>
              ) : sent ? (
                <>
                  <CheckCircle2 size={16} />
                  <span>OTP Sent</span>
                </>
              ) : (
                <>
                  <Phone size={16} />
                  <span>Send OTP</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-[#E5E7EB] text-center">
            <span className="text-[10px] text-gray-400">
              OTP will be delivered via SMS to your registered mobile number.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
