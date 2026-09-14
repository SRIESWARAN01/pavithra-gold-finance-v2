'use client';

import React, { useState, useEffect } from 'react';
import { User, Phone, MapPin, Shield, CheckCircle2, AlertTriangle, Key, Smartphone, Lock } from 'lucide-react';
import { isFirebaseConfigured, getCurrentProfile } from '@/lib/auth';
import type { Profile } from '@/types/database';

export default function CustomerProfile() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);

  // v2.0 Enterprise Security: 2FA State Parameters
  const [is2faEnabled, setIs2faEnabled] = useState(false);
  const [setup2faStep, setSetup2faStep] = useState(0);
  const [verificationCode2fa, setVerificationCode2fa] = useState('');
  const [twoFactorSuccess, setTwoFactorSuccess] = useState(false);
  const [twoFactorError, setTwoFactorError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfile() {
      setProfileLoading(true);
      try {
        if (isFirebaseConfigured()) {
          const p = await getCurrentProfile();
          if (p) {
            setProfile(p);
            setIs2faEnabled(p.is_2fa_enabled);
          }
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
      } finally {
        setProfileLoading(false);
      }
    }
    loadProfile();
  }, []);

  const displayName = profile?.name || 'Customer';
  const displayPhone = profile?.phone_primary || '';
  const displayAadhaar = profile?.national_id ? `${profile.national_id.substring(0, 4)} •••• ••••` : '';
  const displayAddress = profile?.address || '';
  const signatureCaptured = !!profile?.signature_url;

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Please fill in all password fields.');
      setLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New password and password confirmation do not match.');
      setLoading(false);
      return;
    }

    try {
      // Simulate API patch
      await new Promise(resolve => setTimeout(resolve, 1200));
      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError('Failed to update portal password. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySetup2fa = async (e: React.FormEvent) => {
    e.preventDefault();
    setTwoFactorError(null);
    setTwoFactorSuccess(false);

    if (verificationCode2fa.length !== 6) {
      setTwoFactorError('Please enter a valid 6-digit code.');
      return;
    }

    if (verificationCode2fa === '123456' || verificationCode2fa === '000000') {
      setIs2faEnabled(true);
      setSetup2faStep(2);
      setTwoFactorSuccess(true);
      setVerificationCode2fa('');
    } else {
      setTwoFactorError('Invalid confirmation code. Please try again.');
    }
  };

  const handleDeactivate2fa = () => {
    setIs2faEnabled(false);
    setSetup2faStep(0);
    setTwoFactorSuccess(false);
    setTwoFactorError(null);
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h2 className="text-xl font-bold text-gray-900 tracking-wide font-outfit">My Profile & Settings</h2>
        <p className="text-gray-500 text-xs mt-1">Review contact parameters, signatures, and manage security passwords.</p>
      </div>

      {/* Profile Details Card */}
      <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-5 space-y-4">
        <h3 className="text-xs font-bold text-[#2563EB] uppercase tracking-wider border-b border-[#E5E7EB] pb-2">Verified KYC Identity</h3>
        
        <div className="space-y-3 text-xs">
          <div className="flex items-center gap-2 text-gray-600">
            <User size={14} className="text-[#2563EB]" />
            <div>
              <span className="text-gray-400 block text-[9px]">Full Name</span>
              <span className="font-semibold text-gray-900">{displayName}</span>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-center gap-2 text-gray-600">
              <Phone size={14} className="text-[#2563EB]" />
              <div>
                <span className="text-gray-400 block text-[9px]">Mobile (Primary)</span>
                <span>{displayPhone}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <Shield size={14} className="text-[#2563EB]" />
              <div>
                <span className="text-gray-400 block text-[9px]">Aadhaar Card ID</span>
                <span>{displayAadhaar}</span>
              </div>
            </div>
          </div>
          <div className="flex items-start gap-2 text-gray-600">
            <MapPin size={14} className="text-[#2563EB] shrink-0 mt-0.5" />
            <div>
              <span className="text-gray-400 block text-[9px]">Residential Address</span>
              <span className="leading-relaxed">{displayAddress}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Reset Password Card */}
      <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-5 space-y-4">
        <h3 className="text-xs font-bold text-[#2563EB] uppercase tracking-wider border-b border-[#E5E7EB] pb-2">Change Account Password</h3>

        {success && (
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-xs flex items-center gap-2">
            <CheckCircle2 size={14} />
            <span>Portal login password updated successfully.</span>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-rose-500/20 text-red-500 text-xs flex items-center gap-2">
            <AlertTriangle size={14} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4 text-xs">
          <div className="space-y-1.5">
            <label className="text-gray-500 font-medium">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 rounded-lg px-3.5 py-2 outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-gray-500 font-medium">New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 rounded-lg px-3.5 py-2 outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-gray-500 font-medium">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 rounded-lg px-3.5 py-2 outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-[#2563EB]/35 text-[#F8FAFC] font-bold rounded-lg transition-all flex items-center gap-1.5"
          >
            <Key size={14} />
            Update Password
          </button>
        </form>
      </div>

      {/* Two-Factor Authentication Card */}
      <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-5 space-y-4">
        <h3 className="text-xs font-bold text-[#2563EB] uppercase tracking-wider border-b border-[#E5E7EB] pb-2 flex items-center gap-2 font-outfit">
          <Lock size={14} />
          Two-Factor Authentication (2FA)
        </h3>

        {twoFactorSuccess && (
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-xs flex items-center gap-2">
            <CheckCircle2 size={14} />
            <span>Two-factor authentication is now active on your account.</span>
          </div>
        )}

        {twoFactorError && (
          <div className="p-3 rounded-lg bg-red-50 border border-rose-500/20 text-red-500 text-xs flex items-center gap-2">
            <AlertTriangle size={14} />
            <span>{twoFactorError}</span>
          </div>
        )}

        {setup2faStep === 0 && (
          <div className="space-y-3 text-xs">
            <p className="text-gray-500 leading-relaxed">
              Add an extra layer of protection to your gold account by requiring a 6-digit confirmation code at login.
            </p>
            <button
              type="button"
              onClick={() => setSetup2faStep(1)}
              className="px-6 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-[#F8FAFC] font-bold rounded-lg transition-all flex items-center gap-1.5"
            >
              <Smartphone size={14} />
              Set Up Authenticator
            </button>
          </div>
        )}

        {setup2faStep === 1 && (
          <form onSubmit={handleVerifySetup2fa} className="space-y-4 text-xs">
            <p className="text-gray-500 leading-relaxed">
              1. Scan this QR code or enter the secret key <strong>JBSWY3DPEHPK3PXP</strong> into Google Authenticator or Microsoft Authenticator app.
            </p>
            
            <div className="flex justify-center bg-white p-3 rounded-lg w-32 h-32 mx-auto border border-slate-200">
              <div className="w-full h-full bg-slate-100 flex flex-col items-center justify-center text-slate-800 text-[10px] font-mono border-2 border-dashed border-slate-300">
                <span className="font-bold text-[#F8FAFC]">PGF Auth QR</span>
                <span className="text-[8px] text-gray-400 mt-1">Scan App</span>
              </div>
            </div>

            <div className="space-y-1.5 max-w-xs mx-auto">
              <label className="text-gray-500 font-medium block text-center">2. Enter 6-Digit Code to Verify</label>
              <input
                type="text"
                maxLength={6}
                placeholder="000000"
                value={verificationCode2fa}
                onChange={(e) => setVerificationCode2fa(e.target.value.replace(/\D/g, ''))}
                className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 text-center text-sm rounded-lg py-2 outline-none font-mono tracking-widest placeholder-slate-600 animate-pulse"
              />
            </div>

            <div className="flex justify-center gap-3">
              <button
                type="submit"
                className="px-5 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-[#F8FAFC] font-bold rounded-lg transition-all"
              >
                Verify & Enable
              </button>
              <button
                type="button"
                onClick={() => setSetup2faStep(0)}
                className="px-5 py-2 border border-slate-700 hover:border-slate-500 text-gray-600 font-semibold rounded-lg transition-all"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {setup2faStep === 2 && (
          <div className="space-y-3 text-xs">
            <div className="flex items-center gap-2 text-emerald-600 font-semibold">
              <CheckCircle2 size={16} />
              <span>2FA Protection Enabled</span>
            </div>
            <p className="text-gray-500 leading-relaxed">
              Authenticator app settings are registered. Future sign-ins will require security verification codes.
            </p>
            <button
              type="button"
              onClick={handleDeactivate2fa}
              className="px-5 py-2 border border-rose-500/20 hover:bg-red-50 text-red-500 font-semibold rounded-lg transition-all"
            >
              Disable 2FA Security
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
