'use client';

import React, { useState, useEffect } from 'react';
import {
  User,
  Mail,
  Phone,
  Calendar,
  MapPin,
  Building2,
  Shield,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Save,
  Eye,
  EyeOff,
  Clock,
  FileText
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getInvestorPortfolio, logInvestmentAudit } from '@/lib/db/investments';
import { InvestorPortfolioSummary, Investor } from '@/types/database';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { updatePassword } from 'firebase/auth';

export default function InvestorProfilePage() {
  const { user } = useAuth();
  const [portfolio, setPortfolio] = useState<InvestorPortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [state, setState] = useState('Tamil Nadu');
  const [pincode, setPincode] = useState('');
  const [pan, setPan] = useState('');

  // Bank details
  const [bankAccount, setBankAccount] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [bankName, setBankName] = useState('');

  // Nominee details
  const [nomineeName, setNomineeName] = useState('');
  const [nomineeRelationship, setNomineeRelationship] = useState('');
  const [nomineePhone, setNomineePhone] = useState('');

  // Password change state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!user?.uid) return;
      try {
        setLoading(true);
        const data = await getInvestorPortfolio(user.uid);
        setPortfolio(data);

        if (data?.investor) {
          const inv = data.investor;
          setName(inv.name || '');
          setEmail(inv.email || '');
          setDob(inv.dateOfBirth || '');
          setGender(inv.gender || 'Male');
          setAddress(inv.address?.street || '');
          setCity(inv.address?.city || '');
          setDistrict(inv.address?.district || '');
          setState(inv.address?.state || 'Tamil Nadu');
          setPincode(inv.address?.pincode || '');
          setPan(inv.pan || '');

          if (inv.bankDetails) {
            setBankAccount(inv.bankDetails.accountNumber || '');
            setIfsc(inv.bankDetails.ifsc || '');
            setBankName(inv.bankDetails.bankName || '');
          }

          if (inv.nomineeDetails) {
            setNomineeName(inv.nomineeDetails.name || '');
            setNomineeRelationship(inv.nomineeDetails.relationship || '');
            setNomineePhone(inv.nomineeDetails.phone || '');
          }
        }
      } catch (err) {
        console.error('Error loading investor profile:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [user]);

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid || !portfolio) return;

    try {
      setSaving(true);
      setError(null);
      setSaveSuccess(false);

      const investorRef = doc(db, 'investors', user.uid);
      const profileRef = doc(db, 'profiles', user.uid);
      const updatedFields = {
        name: name.trim(),
        email: email.trim(),
        dateOfBirth: dob,
        gender,
        address: {
          street: address.trim(),
          city: city.trim(),
          district: district.trim(),
          state: state.trim(),
          pincode: pincode.trim()
        },
        pan: pan.trim().toUpperCase(),
        bankDetails: {
          accountNumber: bankAccount.trim(),
          ifsc: ifsc.trim().toUpperCase(),
          bankName: bankName.trim(),
          accountHolderName: name.trim()
        },
        nomineeDetails: {
          name: nomineeName.trim(),
          relationship: nomineeRelationship.trim(),
          phone: nomineePhone.trim()
        },
        updatedAt: new Date().toISOString()
      };

      // Synchronize both profiles and investors collections
      await setDoc(profileRef, {
        name: name.trim(),
        email: email.trim(),
        address: address.trim(),
        city: city.trim(),
        district: district.trim(),
        state: state.trim(),
        pin_code: pincode.trim(),
        pan_number: pan.trim().toUpperCase(),
        national_id: pan.trim().toUpperCase(),
        bank_details: updatedFields.bankDetails,
        nominee_details: updatedFields.nomineeDetails,
        updated_at: new Date().toISOString()
      }, { merge: true });

      await setDoc(investorRef, updatedFields, { merge: true });

      // Log audit
      await logInvestmentAudit({
        actor_id: user.uid,
        action: 'UPDATE_INVESTOR_PROFILE',
        entity: 'Investor',
        entity_id: portfolio?.investor_number || portfolio?.investor_id || user.uid,
        details: { name, email, city, pan }
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      console.error('Error saving profile:', err);
      setError(err.message || 'Failed to update profile details.');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    try {
      setChangingPassword(true);
      setPasswordError(null);
      setPasswordSuccess(false);

      await updatePassword(auth.currentUser, newPassword);

      setPasswordSuccess(true);
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(false), 4000);
    } catch (err: any) {
      console.error('Password change error:', err);
      setPasswordError(
        err.message || 'Failed to change password. Recent login required.'
      );
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin mb-4" />
        <p className="text-slate-400 font-medium text-sm tracking-wide">Loading investor profile...</p>
      </div>
    );
  }

  const investor = portfolio?.investor;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-widest">
            Account Management
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white mt-1 font-serif tracking-tight">
          My Profile & Settings
        </h1>
        <p className="text-slate-400 text-sm mt-0.5">
          View your registered investor details, manage settlement accounts, and update your security credentials.
        </p>
      </div>

      {/* Profile Overview Card */}
      <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-6 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-slate-950 font-bold text-2xl font-serif shadow-lg shadow-amber-500/20">
            {investor?.name?.charAt(0) || 'I'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white font-serif">{investor?.name}</h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                {investor?.status || 'Active'}
              </span>
            </div>
            <p className="text-xs font-mono text-amber-400 mt-0.5">
              Investor ID: {investor?.investorId}
            </p>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              Member since {investor?.createdAt?.split('T')[0] || '2025'}
            </p>
          </div>
        </div>

        <div className="text-right sm:border-l sm:border-slate-800 sm:pl-6 w-full sm:w-auto">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Registered Phone</p>
          <p className="text-base font-mono font-bold text-white mt-0.5">
            +91 {investor?.phone}
          </p>
          <span className="text-[10px] text-slate-500 mt-1 block">
            Primary Authentication Credential
          </span>
        </div>
      </div>

      {/* Profile Edit Form */}
      <form onSubmit={handleProfileSave} className="space-y-6">
        <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-6 backdrop-blur-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <User className="w-5 h-5 text-amber-400" />
              Personal & KYC Information
            </h3>
            {saveSuccess && (
              <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Profile Updated!
              </span>
            )}
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">
                Full Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 text-white text-xs focus:outline-none focus:border-amber-400 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="investor@example.com"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 text-white text-xs focus:outline-none focus:border-amber-400 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">
                Date of Birth
              </label>
              <input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 text-white text-xs focus:outline-none focus:border-amber-400 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">
                Gender
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as any)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 text-white text-xs focus:outline-none focus:border-amber-400 transition-all"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">
                Address / Street
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Residential Address"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 text-white text-xs focus:outline-none focus:border-amber-400 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">
                City / Town
              </label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 text-white text-xs focus:outline-none focus:border-amber-400 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">
                District
              </label>
              <input
                type="text"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 text-white text-xs focus:outline-none focus:border-amber-400 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">
                PIN Code
              </label>
              <input
                type="text"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                placeholder="600001"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-amber-400 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">
                PAN Number (Optional)
              </label>
              <input
                type="text"
                value={pan}
                onChange={(e) => setPan(e.target.value)}
                placeholder="ABCDE1234F"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 text-white font-mono uppercase text-xs focus:outline-none focus:border-amber-400 transition-all"
              />
            </div>
          </div>

          {/* Section 2: Settlement Bank Details */}
          <div className="pt-6 border-t border-slate-800 space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-amber-400" />
              Settlement Bank Account Details
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">
                  Bank Name
                </label>
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="State Bank of India"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 text-white text-xs focus:outline-none focus:border-amber-400 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">
                  Account Number
                </label>
                <input
                  type="text"
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value)}
                  placeholder="Account Number"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-amber-400 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">
                  IFSC Code
                </label>
                <input
                  type="text"
                  value={ifsc}
                  onChange={(e) => setIfsc(e.target.value)}
                  placeholder="SBIN0001234"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 text-white font-mono uppercase text-xs focus:outline-none focus:border-amber-400 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Nominee Details */}
          <div className="pt-6 border-t border-slate-800 space-y-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-amber-400" />
              Nominee Details
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">
                  Nominee Name
                </label>
                <input
                  type="text"
                  value={nomineeName}
                  onChange={(e) => setNomineeName(e.target.value)}
                  placeholder="Full name of nominee"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 text-white text-xs focus:outline-none focus:border-amber-400 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">
                  Relationship
                </label>
                <input
                  type="text"
                  value={nomineeRelationship}
                  onChange={(e) => setNomineeRelationship(e.target.value)}
                  placeholder="e.g. Spouse, Son, Mother"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 text-white text-xs focus:outline-none focus:border-amber-400 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">
                  Nominee Phone
                </label>
                <input
                  type="text"
                  value={nomineePhone}
                  onChange={(e) => setNomineePhone(e.target.value)}
                  placeholder="10-digit mobile"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-amber-400 transition-all"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-amber-500/20 flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving Profile...' : 'Save Profile Changes'}
            </button>
          </div>
        </div>
      </form>

      {/* Security & Password Change */}
      <form onSubmit={handlePasswordChange} className="space-y-6">
        <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-6 backdrop-blur-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-amber-400" />
              Security & Password Management
            </h3>
            {passwordSuccess && (
              <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Password Changed!
              </span>
            )}
          </div>

          {passwordError && (
            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
              {passwordError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">
                New Password *
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  required
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 text-white text-xs focus:outline-none focus:border-amber-400 transition-all pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-slate-400 font-semibold mb-1">
                Confirm New Password *
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter new password"
                required
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950/80 border border-slate-700 text-white text-xs focus:outline-none focus:border-amber-400 transition-all"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={changingPassword || !newPassword}
              className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <KeyRound className="w-4 h-4 text-amber-400" />
              {changingPassword ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
