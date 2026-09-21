'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Eye, EyeOff, ShieldAlert, ShieldCheck, Users, ArrowRight, TrendingUp } from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import type { UserRole } from '@/types/database';
import Logo from '@/components/Logo';

export default function LoginPage() {
  const router = useRouter();

  const [activePortal, setActivePortal] = useState<'admin' | 'customer' | 'investor'>('admin');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Switch portal tab
  const handlePortalSwitch = (portal: 'admin' | 'customer' | 'investor') => {
    setActivePortal(portal);
    setError(null);
    setPhone('');
    setPassword('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const cleanedPhone = phone.replace('+91', '').trim();

    if (!cleanedPhone || cleanedPhone.length < 10) {
      setError('Please enter a valid 10-digit mobile number.');
      setLoading(false);
      return;
    }

    try {
      const email = `${cleanedPhone}@pgf.local`;
      // 1. Authentication accounts are created only by the authorised onboarding flow.
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userUid = userCredential.user.uid;

      // 2. The profile ID must be the authenticated Firebase UID. Never identify
      // a user by a phone-number query, since that could bind the wrong profile.
      const profileSnap = await getDoc(doc(db, 'profiles', userUid));
      if (!profileSnap.exists()) {
        throw new Error('This account has no active profile. Please contact your branch administrator.');
      }

      const profile = profileSnap.data();
      if (profile.status && profile.status !== 'Active') {
        throw new Error('This account is inactive. Please contact your branch administrator.');
      }

      const profileRole = (profile.role || 'Customer') as UserRole;
      const profileName = profile.name || 'Account Holder';
      const customerNumber = profile.customer_number || null;

      // 3. Store active session in LocalStorage (for instant access across layouts)
      if (typeof window !== 'undefined') {
        const sessionPayload = {
          id: userUid,
          uid: userUid,
          role: profileRole,
          phone: cleanedPhone,
          phone_primary: cleanedPhone,
          name: profileName,
          customer_number: customerNumber,
        };
        localStorage.setItem('pgf_active_session', JSON.stringify(sessionPayload));
      }

      // 4. Automatic clean redirection to appropriate portal based on role
      if (profileRole === 'Investor') {
        router.push('/investor/dashboard');
      } else if (profileRole === 'Customer') {
        router.push('/customer/dashboard');
      } else if (profileRole === 'Admin' || profileRole === 'Owner') {
        router.push('/admin/dashboard');
      } else {
        router.push('/employee/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid credentials. Please check your mobile number and password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] text-gray-900">
      {/* Desktop Left Side Branding Panel */}
      <div className="hidden lg:flex w-1/2 bg-gradient-to-br from-blue-700 via-blue-800 to-slate-900 flex-col justify-between p-12 relative overflow-hidden text-white">
        {/* Background decorative shapes */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-sky-400/15 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <Logo size="lg" />
          </div>
          <p className="text-blue-200 text-sm font-medium tracking-wide">Enterprise Gold Loan Management Platform</p>
        </div>

        <div className="relative z-10 space-y-6 max-w-lg">
          <div className="space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-blue-300 font-mono bg-blue-600/30 px-2.5 py-1 rounded-full border border-blue-400/30">
              Government Compliant Pawnbrokers v2.0
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight font-outfit text-white leading-tight">
              Empowering Secure Digital Gold Financing
            </h1>
            <p className="text-blue-100/90 text-sm leading-relaxed">
              Real-time loan appraisal, dynamic PDF bill generation, automated WhatsApp due notifications, and transparent customer portal with pledged jewellery vault viewer.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="p-3.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/15">
              <span className="text-xs font-bold text-white block">Real-time Push Alerts</span>
              <span className="text-[11px] text-blue-200">Live admin broadcasts & overdue notices</span>
            </div>
            <div className="p-3.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/15">
              <span className="text-xs font-bold text-white block">Dynamic PDF Engine</span>
              <span className="text-[11px] text-blue-200">Official Pawn Tickets & Form Dossiers</span>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-xs text-blue-200/80 flex items-center justify-between border-t border-white/15 pt-4">
          <span>Pavithra Gold Finance &copy; 2026</span>
          <span className="font-mono text-[10px]">Secure 256-Bit SSL Encrypted</span>
        </div>
      </div>

      {/* Right Side Form Viewport */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md bg-white border border-gray-200 rounded-2xl p-8 shadow-xl shadow-gray-200/60">
          {/* Mobile Logo */}
          <div className="mb-6 lg:hidden flex justify-center">
            <Logo size="md" />
          </div>

          <div className="mb-6 text-center sm:text-left">
            <h2 className="text-2xl font-bold text-gray-900 tracking-wide font-outfit">Portal Sign In</h2>
            <p className="text-gray-500 text-xs mt-1">Select your account type to access the system.</p>
          </div>

          {/* Portal Switcher Tabs */}
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#F3F4F6] rounded-xl mb-6">
            <button
              type="button"
              onClick={() => handlePortalSwitch('admin')}
              className={`py-2 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activePortal === 'admin'
                  ? 'bg-[#2563EB] text-white shadow-md shadow-blue-600/20'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <ShieldCheck size={13} />
              Admin
            </button>
            <button
              type="button"
              onClick={() => handlePortalSwitch('customer')}
              className={`py-2 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activePortal === 'customer'
                  ? 'bg-[#2563EB] text-white shadow-md shadow-blue-600/20'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Users size={13} />
              Customer
            </button>
            <button
              type="button"
              onClick={() => handlePortalSwitch('investor')}
              className={`py-2 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activePortal === 'investor'
                  ? 'bg-[#D97706] text-white shadow-md shadow-amber-600/20'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <TrendingUp size={13} />
              Investor
            </button>
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs flex items-start gap-2.5">
              <ShieldAlert size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Phone Number Field */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
                {activePortal === 'admin'
                  ? 'Admin Mobile Number'
                  : activePortal === 'investor'
                  ? 'Investor Mobile Number'
                  : 'Customer Registered Mobile'}
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-3 text-xs text-gray-400 font-semibold">+91</span>
                <input
                  type="tel"
                  placeholder="Enter 10-digit mobile number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={loading}
                  className="w-full bg-[#F9FAFB] border border-gray-200 focus:border-[#2563EB] focus:bg-white focus:ring-2 focus:ring-blue-100 text-gray-900 text-xs rounded-xl pl-12 pr-4 py-3 outline-none transition-all placeholder-gray-400 font-mono"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">Password / Security PIN</label>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="w-full bg-[#F9FAFB] border border-gray-200 focus:border-[#2563EB] focus:bg-white focus:ring-2 focus:ring-blue-100 text-gray-900 text-xs rounded-xl pl-10 pr-10 py-3 outline-none transition-all placeholder-gray-400"
                />
                <Lock size={14} className="absolute left-3.5 top-3.5 text-gray-400" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3 text-gray-400 hover:text-gray-600 transition cursor-pointer"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Action Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-blue-300 text-white font-bold rounded-xl text-xs transition-all duration-300 transform active:scale-[0.98] shadow-lg shadow-blue-600/25 mt-2 flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Authenticating...</span>
                </div>
              ) : (
                <>
                  <span>Sign In as {activePortal === 'admin' ? 'Administrator' : 'Customer'}</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-gray-100 text-center">
            <span className="text-[10px] text-gray-400">
              &copy; 2026 Pavithra Gold Finance. Authorized Access Only.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
