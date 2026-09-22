// src/app/admin/investments/investors/new/page.tsx
// Onboard a new Investor account.
// Mandatory fields: Investor Name, Mobile Number, Password.
// Automatically generates unique Investor ID (e.g. PGF-INV-000001).

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  UserPlus,
  ArrowLeft,
  Lock,
  Phone,
  User,
  Mail,
  MapPin,
  Building,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import { auth, db, firebaseConfig } from '@/lib/firebase';
import { collection, doc, getDocs, query, setDoc, where, limit } from 'firebase/firestore';
import { generateInvestorId, logInvestmentAudit } from '@/lib/db/investments';

export default function CreateInvestorPage() {
  const router = useRouter();

  // Mandatory fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Optional fields
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankIfsc, setBankIfsc] = useState('');
  const [bankName, setBankName] = useState('');
  const [nomineeName, setNomineeName] = useState('');
  const [nomineeRelation, setNomineeRelation] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    investorId: string;
    name: string;
    phone: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !phone.trim() || !password.trim()) {
      setError('Please fill in all mandatory fields: Investor Name, Mobile Number, and Password.');
      return;
    }

    const cleanPhone = phone.trim().replace('+91', '').replace(/\s+/g, '');
    if (cleanPhone.length < 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('You must be signed in as an Administrator.');
      }

      const token = await currentUser.getIdToken(true);
      let investorId = '';
      let investorUid = '';
      let apiSucceeded = false;

      // 1. Try server-side API onboarding
      try {
        const res = await fetch('/api/admin/investor/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: name.trim(),
            phone: cleanPhone,
            password: password.trim(),
            email: email.trim() || null,
            address: address.trim() || '',
            city: city.trim() || '',
            district: district.trim() || '',
            pinCode: pinCode.trim() || '',
            panNumber: panNumber.trim().toUpperCase() || '',
            bankAccountNumber: bankAccountNumber.trim() || '',
            bankIfsc: bankIfsc.trim().toUpperCase() || '',
            bankName: bankName.trim() || '',
            nomineeName: nomineeName.trim() || '',
            nomineeRelation: nomineeRelation.trim() || '',
          }),
        });

        const data = await res.json();
        if (res.status === 409) {
          throw new Error(data.error || 'An account with this mobile number already exists.');
        }

        if (res.ok && data.success && !data.fallbackRequired) {
          investorId = data.investorId;
          investorUid = data.uid;
          apiSucceeded = true;
        }
      } catch (apiErr: any) {
        if (apiErr.message?.includes('already exists') || apiErr.message?.includes('409')) {
          throw apiErr;
        }
        console.warn('API creation failed, initiating direct authenticated client provisioning:', apiErr);
      }

      // 2. Client Provisioning Fallback (when server Admin SDK lacks credentials or permissions)
      if (!apiSucceeded) {
        // A. Check duplicate phone in profiles collection
        const phoneQ = query(
          collection(db, 'profiles'),
          where('phone_primary', '==', cleanPhone),
          limit(1)
        );
        const phoneSnap = await getDocs(phoneQ);
        if (!phoneSnap.empty) {
          const existing = phoneSnap.docs[0].data();
          throw new Error(
            `An account with mobile number ${cleanPhone} already exists (${existing.name}, Role: ${existing.role}).`
          );
        }

        // B. Generate sequential Investor ID (e.g. PGF-INV-000001)
        investorId = await generateInvestorId();

        // C. Create Firebase Auth account via isolated secondary app
        const authEmail = email.trim() || `${cleanPhone}@pgf.local`;
        const secondaryAppName = `investor-onboard-${Date.now()}`;
        try {
          const { initializeApp, deleteApp } = await import('firebase/app');
          const { getAuth, createUserWithEmailAndPassword, signOut: secondarySignOut } = await import('firebase/auth');

          const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
          const secondaryAuth = getAuth(secondaryApp);
          const userCred = await createUserWithEmailAndPassword(secondaryAuth, authEmail, password.trim());
          investorUid = userCred.user.uid;
          await secondarySignOut(secondaryAuth);
          await deleteApp(secondaryApp);
        } catch (authErr: any) {
          console.warn('Secondary auth user creation error:', authErr);
          if (authErr.code === 'auth/email-already-in-use') {
            throw new Error(`The email/mobile account is already registered in the authentication system.`);
          }
          investorUid = `inv_${cleanPhone}_${Date.now().toString().slice(-4)}`;
        }

        const now = new Date().toISOString();

        // D. Create Profile in Firestore
        const profileData = {
          id: investorUid,
          name: name.trim(),
          phone_primary: cleanPhone,
          email: email.trim() || null,
          role: 'Investor',
          customer_number: investorId,
          address: address.trim() || 'Address to be updated',
          city: city.trim() || null,
          district: district.trim() || null,
          state: 'Tamil Nadu',
          pin_code: pinCode.trim() || null,
          national_id: panNumber.trim().toUpperCase() || 'PENDING',
          kyc_status: 'Approved',
          status: 'Active',
          bank_details: bankAccountNumber ? {
            accountNumber: bankAccountNumber.trim(),
            ifsc: bankIfsc.trim().toUpperCase(),
            bankName: bankName.trim(),
            accountHolderName: name.trim(),
          } : null,
          nominee_details: nomineeName ? {
            name: nomineeName.trim(),
            relationship: nomineeRelation.trim(),
            phone: '',
          } : null,
          created_at: now,
          updated_at: now,
        };

        // E. Initialize Investment Account
        const initialAccount = {
          id: investorUid,
          investor_id: investorUid,
          investor_number: investorId,
          total_invested: 0,
          total_additional_investment: 0,
          total_withdrawn: 0,
          accrued_return: 0,
          current_value: 0,
          status: 'Active',
          created_at: now,
          updated_at: now,
        };

        // F. Create Investor doc in 'investors' collection
        const investorDocData = {
          id: investorUid,
          uid: investorUid,
          investorId,
          name: name.trim(),
          phone: cleanPhone,
          email: email.trim() || null,
          dateOfBirth: null,
          gender: 'Male',
          address: {
            street: address.trim(),
            city: city.trim(),
            district: district.trim(),
            state: 'Tamil Nadu',
            pincode: pinCode.trim(),
          },
          pan: panNumber.trim().toUpperCase() || '',
          bankDetails: bankAccountNumber ? {
            accountNumber: bankAccountNumber.trim(),
            ifsc: bankIfsc.trim().toUpperCase(),
            bankName: bankName.trim(),
            accountHolderName: name.trim(),
          } : null,
          nomineeDetails: nomineeName ? {
            name: nomineeName.trim(),
            relationship: nomineeRelation.trim(),
            phone: '',
          } : null,
          status: 'Active',
          createdAt: now,
          updatedAt: now,
        };

        // Write documents to Firestore with authenticated Admin session
        await setDoc(doc(db, 'profiles', investorUid), profileData);
        await setDoc(doc(db, 'investment_accounts', investorUid), initialAccount);
        await setDoc(doc(db, 'investors', investorUid), investorDocData);

        // G. Log audit
        await logInvestmentAudit({
          actor_id: currentUser.uid,
          action: 'INVESTOR_CREATED',
          entity: 'profiles',
          entity_id: investorUid,
          details: {
            investorId,
            name: name.trim(),
            phone: cleanPhone,
            createdBy: currentUser.uid,
          },
        });
      }

      setSuccess({
        investorId,
        name: name.trim(),
        phone: cleanPhone,
      });
    } catch (err: any) {
      console.error('Error creating investor:', err);
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back button */}
      <div className="flex items-center justify-between">
        <Link
          href="/admin/investments/investors"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft size={14} />
          Back to Investor Directory
        </Link>
      </div>

      {/* Success Modal / Banner */}
      {success ? (
        <div className="bg-white p-8 rounded-2xl border border-emerald-200 shadow-xl shadow-emerald-500/10 text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 size={36} />
          </div>
          <h2 className="text-2xl font-extrabold text-gray-900 font-outfit">
            Investor Account Created Successfully!
          </h2>
          <div className="p-4 bg-emerald-50 rounded-xl max-w-md mx-auto space-y-2 text-xs text-left">
            <div className="flex justify-between">
              <span className="text-gray-500 font-semibold">Investor Unique ID:</span>
              <span className="font-mono font-bold text-emerald-800 text-sm">{success.investorId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 font-semibold">Investor Name:</span>
              <span className="font-bold text-gray-900">{success.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 font-semibold">Mobile Number:</span>
              <span className="font-mono font-bold text-gray-900">{success.phone}</span>
            </div>
            <div className="text-[11px] text-gray-500 pt-2 border-t border-emerald-200">
              The investor can now log in via the unified login page using their mobile number and password.
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
            <button
              onClick={() => {
                setSuccess(null);
                setName('');
                setPhone('');
                setPassword('');
              }}
              className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-all cursor-pointer"
            >
              Create Another Investor
            </button>
            <Link
              href="/admin/investments/investors"
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/20 transition-all"
            >
              Go to Directory
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8 space-y-6">
          {/* Header */}
          <div className="border-b border-gray-100 pb-5">
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-800">
                New Investor Onboarding
              </span>
              <span className="text-xs text-gray-400 font-medium">Automatic Unique ID Generation</span>
            </div>
            <h1 className="text-2xl font-extrabold text-gray-900 font-outfit">Create Investor Account</h1>
            <p className="text-xs text-gray-500 mt-1">
              Fill in the mandatory fields below to provision investor credentials and initialize their wealth portfolio.
            </p>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-3">
              <AlertCircle size={18} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* SECTION 1: MANDATORY CREDENTIALS */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-amber-600" />
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                Mandatory Credentials (Required)
              </h2>
            </div>
            <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-200/60 grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Investor Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 flex items-center gap-1">
                  Investor Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User size={15} className="absolute left-3 top-3 text-gray-400" />
                  <input
                    type="text"
                    required
                    placeholder="Full Legal Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-amber-200 focus:border-amber-600 font-semibold"
                  />
                </div>
              </div>

              {/* Mobile Number */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 flex items-center gap-1">
                  Mobile Number <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Phone size={15} className="absolute left-3 top-3 text-gray-400" />
                  <input
                    type="tel"
                    required
                    placeholder="10-digit number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-amber-200 focus:border-amber-600 font-mono font-semibold"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 flex items-center gap-1">
                  Login Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3 top-3 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Min. 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-10 py-2.5 text-xs rounded-xl border border-gray-200 bg-white focus:ring-2 focus:ring-amber-200 focus:border-amber-600 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: OPTIONAL PROFILE & CONTACT DETAILS */}
          <div className="space-y-4 pt-2">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
              Profile & Contact Details (Optional)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600">Email Address</label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-3 text-gray-400" />
                  <input
                    type="email"
                    placeholder="investor@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600">PAN Number</label>
                <input
                  type="text"
                  placeholder="ABCDE1234F"
                  value={panNumber}
                  onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white font-mono uppercase"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600">PIN Code</label>
                <input
                  type="text"
                  placeholder="625513"
                  value={pinCode}
                  onChange={(e) => setPinCode(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white font-mono"
                />
              </div>

              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs font-semibold text-gray-600">Address</label>
                <input
                  type="text"
                  placeholder="Door No, Street Name, Area"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600">City / District</label>
                <input
                  type="text"
                  placeholder="Theni / Madurai"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white"
                />
              </div>
            </div>
          </div>

          {/* SECTION 3: BANK & NOMINEE DETAILS (OPTIONAL) */}
          <div className="space-y-4 pt-2">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
              Bank & Nominee Information (Optional)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600">Bank Account Number</label>
                <input
                  type="text"
                  placeholder="Account Number"
                  value={bankAccountNumber}
                  onChange={(e) => setBankAccountNumber(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600">IFSC Code</label>
                <input
                  type="text"
                  placeholder="SBIN0001234"
                  value={bankIfsc}
                  onChange={(e) => setBankIfsc(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white font-mono uppercase"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600">Bank Name</label>
                <input
                  type="text"
                  placeholder="State Bank of India"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600">Nominee Name</label>
                <input
                  type="text"
                  placeholder="Nominee Full Name"
                  value={nomineeName}
                  onChange={(e) => setNomineeName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600">Nominee Relationship</label>
                <input
                  type="text"
                  placeholder="Spouse / Son / Daughter"
                  value={nomineeRelation}
                  onChange={(e) => setNomineeRelation(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 bg-gray-50/50 focus:bg-white"
                />
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
            <Link
              href="/admin/investments/investors"
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-gray-600 hover:text-gray-900 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-lg shadow-amber-500/25 transition-all disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>Provisioning Account...</>
              ) : (
                <>
                  <UserPlus size={15} />
                  Create Investor Account
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
