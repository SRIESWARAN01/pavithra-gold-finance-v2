'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Lock, Eye, EyeOff, ShieldAlert, CheckCircle2, Key } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { updatePassword, signOut } from 'firebase/auth';
import { isFirebaseConfigured } from '@/lib/auth';
import Logo from '@/components/Logo';

function ResetForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const phone = searchParams.get('phone') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Password strength calculation
  const getPasswordStrength = (pwd: string): { label: string; color: string; width: string } => {
    if (pwd.length === 0) return { label: '', color: '', width: '0%' };
    if (pwd.length < 6) return { label: 'Weak', color: 'bg-rose-500', width: '25%' };
    if (pwd.length < 8) return { label: 'Fair', color: 'bg-amber-500', width: '50%' };
    if (/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(pwd)) return { label: 'Strong', color: 'bg-emerald-500', width: '100%' };
    return { label: 'Good', color: 'bg-[#2563EB]', width: '75%' };
  };

  const strength = getPasswordStrength(newPassword);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!newPassword || !confirmPassword) {
      setError('Please fill in both password fields.');
      setLoading(false);
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      setLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      setLoading(false);
      return;
    }

    try {
      if (isFirebaseConfigured()) {
        if (!auth.currentUser) throw new Error('No authenticated user session found.');
        await updatePassword(auth.currentUser, newPassword);
        // Clear session so they must sign in again with the new password
        await signOut(auth);
      } else {
        // Dev bypass
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      setSuccess(true);
      setTimeout(() => router.push('/'), 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Back */}
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-2 text-gray-500 hover:text-[#2563EB] text-xs font-medium mb-8 transition group"
        >
          <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
          Back to Login
        </button>

        <div className="bg-[#ffffff] border border-[#E5E7EB] hover:border-[#2563EB]/20 transition-all duration-300 rounded-xl p-8 shadow-2xl">
          {/* Logo */}
          <div className="mb-8 flex justify-center">
            <Logo size="md" />
          </div>

          <div className="mb-8 text-center">
            <h2 className="text-2xl font-semibold text-gray-900 tracking-wide font-outfit">Reset Password</h2>
            <p className="text-gray-500 text-xs mt-2 leading-relaxed">
              Create a new secure password for <span className="text-[#2563EB] font-semibold">+91 {phone}</span>
            </p>
          </div>

          {success && (
            <div className="mb-6 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-xs flex items-center gap-2.5">
              <CheckCircle2 size={16} className="shrink-0" />
              <span>Password reset successfully! Redirecting to login...</span>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 rounded-lg bg-red-50 border border-rose-500/20 text-red-500 text-xs flex items-start gap-2.5">
              <ShieldAlert size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleReset} className="space-y-5">
            {/* New Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#2563EB] uppercase tracking-wider block">New Password</label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  placeholder="Min 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={loading || success}
                  className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] text-gray-900 text-sm rounded-lg pl-10 pr-10 py-3 outline-none transition-all placeholder-slate-500 disabled:opacity-50"
                />
                <Lock size={16} className="absolute left-3 top-3.5 text-gray-500" />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-3 text-gray-500 hover:text-gray-900 transition"
                >
                  {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Password Strength Indicator */}
              {newPassword.length > 0 && (
                <div className="space-y-1">
                  <div className="h-1 bg-[#F3F4F6] rounded-full overflow-hidden">
                    <div
                      className={`h-full ${strength.color} rounded-full transition-all duration-500`}
                      style={{ width: strength.width }}
                    />
                  </div>
                  <span className={`text-[10px] font-medium ${
                    strength.label === 'Weak' ? 'text-red-500' :
                    strength.label === 'Fair' ? 'text-amber-400' :
                    strength.label === 'Good' ? 'text-[#2563EB]' :
                    'text-emerald-600'
                  }`}>
                    Password Strength: {strength.label}
                  </span>
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#2563EB] uppercase tracking-wider block">Confirm Password</label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading || success}
                  className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] text-gray-900 text-sm rounded-lg pl-10 pr-10 py-3 outline-none transition-all placeholder-slate-500 disabled:opacity-50"
                />
                <Lock size={16} className="absolute left-3 top-3.5 text-gray-500" />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-3 text-gray-500 hover:text-gray-900 transition"
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Match indicator */}
              {confirmPassword.length > 0 && (
                <span className={`text-[10px] font-medium ${
                  newPassword === confirmPassword ? 'text-emerald-600' : 'text-red-500'
                }`}>
                  {newPassword === confirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
                </span>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || success}
              className="w-full py-3 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-[#2563EB]/50 text-[#F8FAFC] font-semibold rounded-lg text-sm transition-all duration-300 transform active:scale-95 shadow-lg shadow-[#2563EB]/10 flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-[#F8FAFC] border-t-transparent rounded-full animate-spin"></div>
                  <span>Resetting...</span>
                </>
              ) : success ? (
                <>
                  <CheckCircle2 size={16} />
                  <span>Password Reset!</span>
                </>
              ) : (
                <>
                  <Key size={16} />
                  <span>Reset Password</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-[#E5E7EB] text-center">
            <span className="text-[10px] text-gray-400">
              After reset, you&apos;ll be redirected to login with your new credentials.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <ResetForm />
    </Suspense>
  );
}
