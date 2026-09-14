'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Upload, 
  Trash2, 
  CheckCircle2, 
  ChevronRight, 
  Building2, 
  ShieldCheck, 
  User, 
  Phone, 
  Mail, 
  Lock, 
  CreditCard, 
  MapPin, 
  Briefcase, 
  FileText, 
  Users, 
  Sparkles,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Key,
  Copy,
  MessageSquare,
  Share2,
  Check,
  Coins
} from 'lucide-react';
import { isFirebaseConfigured } from '@/lib/auth';
import { uploadProfilePhoto, uploadSignature } from '@/lib/storage';
import { createProfile, updateProfile } from '@/lib/db/profiles';
import { createNotification } from '@/lib/db/notifications';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import type { UserRole } from '@/types/database';
import ConfettiCelebration from '@/components/ConfettiCelebration';
import SuccessAnimation from '@/components/SuccessAnimation';
import { compressImage } from '@/lib/imageCompressor';

export default function CustomerOnboarding() {
  const router = useRouter();
  const [role, setRole] = useState<UserRole>('Customer');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneAlt, setPhoneAlt] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('');
  const [maritalStatus, setMaritalStatus] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [state, setState] = useState('Tamil Nadu');
  const [pinCode, setPinCode] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [occupation, setOccupation] = useState('');
  const [monthlyIncome, setMonthlyIncome] = useState('');
  const [referencePerson, setReferencePerson] = useState('');
  const [referencePhone, setReferencePhone] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [selectedBranchCode, setSelectedBranchCode] = useState('');
  const [branches, setBranches] = useState<{ id: string; name: string; code: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<any[] | null>(null);
  const [createdCustomer, setCreatedCustomer] = useState<{ id: string; name: string; phone: string; email?: string; customer_number?: string; password?: string; role: string } | null>(null);
  const [copiedPassword, setCopiedPassword] = useState(false);

  // Nominee state
  const [nomineeName, setNomineeName] = useState('');
  const [nomineeRelation, setNomineeRelation] = useState('');
  const [nomineeMobile, setNomineeMobile] = useState('');

  // Photo & Signature File Uploads (File + Data URL for preview)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);

  // KYC Document File Names for display
  const [aadhaarFrontFile, setAadhaarFrontFile] = useState<string | null>(null);
  const [aadhaarBackFile, setAadhaarBackFile] = useState<string | null>(null);
  const [panFile, setPanFile] = useState<string | null>(null);
  const [voterIdFile, setVoterIdFile] = useState<string | null>(null);
  const [drivingLicenseFile, setDrivingLicenseFile] = useState<string | null>(null);
  const [passportFile, setPassportFile] = useState<string | null>(null);

  // Load branches
  useEffect(() => {
    async function loadBranches() {
      if (!isFirebaseConfigured()) {
        setBranches([
          { id: 'br-mdu', name: 'Madurai Main Branch', code: 'MDU' },
          { id: 'br-cbe', name: 'Coimbatore Branch', code: 'CBE' },
          { id: 'br-che', name: 'Chennai Central Branch', code: 'CHE' },
        ]);
        setSelectedBranchId('br-mdu');
        setSelectedBranchCode('MDU');
        return;
      }
      try {
        const snap = await getDocs(collection(db, 'branches'));
        const list = snap.docs.map((d) => ({
          id: d.id,
          name: d.data().name,
          code: d.data().code,
        }));
        setBranches(list);
        if (list.length > 0) {
          setSelectedBranchId(list[0].id);
          setSelectedBranchCode(list[0].code);
        }
      } catch (e) {
        console.error('Failed to load branches:', e);
      }
    }
    loadBranches();
  }, []);

  // Handle Photo File Pick with compression
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file, 500, 500, 0.7);
      setPhotoPreview(compressed);
    } catch (err) {
      console.error('Failed to compress profile photo:', err);
    }
  };

  // Handle Signature File Pick with compression
  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file, 500, 300, 0.7);
      setSignaturePreview(compressed);
    } catch (err) {
      console.error('Failed to compress signature:', err);
    }
  };

  // Handle KYC Document uploads
  const handleKycDocUpload = (type: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (type === 'aadhaar_front') setAadhaarFrontFile(file.name);
    else if (type === 'aadhaar_back') setAadhaarBackFile(file.name);
    else if (type === 'pan') setPanFile(file.name);
    else if (type === 'voter_id') setVoterIdFile(file.name);
    else if (type === 'driving_license') setDrivingLicenseFile(file.name);
    else if (type === 'passport') setPassportFile(file.name);
  };

  const handleOnboard = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setDuplicateWarning(null);

    // Compulsory Validation: Name, Mobile, Email
    const cleanPhone = phone.replace('+91', '').trim();
    if (!name.trim()) {
      setError('Customer Full Name is required.');
      setLoading(false);
      return;
    }

    if (!cleanPhone || !/^[6-9]\d{9}$/.test(cleanPhone)) {
      setError('Please enter a valid 10-digit primary mobile number.');
      setLoading(false);
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid customer email address.');
      setLoading(false);
      return;
    }

    // Auto-generate password if left empty
    const finalPassword = password.trim() || `PGF@${cleanPhone.slice(-4) || '2026'}`;

    try {
      let profileId = '';
      let customerNumber = '';

      if (isFirebaseConfigured()) {
        try {
          // 1. Call Onboard API route to create user in Auth and profiles table
          const res = await fetch('/api/admin/onboard', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: name.trim(),
              phone: cleanPhone,
              password: finalPassword,
              phoneAlt: phoneAlt.trim() || undefined,
              email: email.trim(),
              dateOfBirth: dateOfBirth || undefined,
              gender: gender || undefined,
              maritalStatus: maritalStatus || undefined,
              address: address.trim() || undefined,
              nationalId: nationalId.trim() || undefined,
              panNumber: panNumber.trim() || undefined,
              city: city.trim() || undefined,
              district: district.trim() || undefined,
              state: state.trim() || 'Tamil Nadu',
              pinCode: pinCode.trim() || undefined,
              occupation: occupation.trim() || undefined,
              monthlyIncome: monthlyIncome ? parseFloat(monthlyIncome) : undefined,
              referencePerson: referencePerson.trim() || undefined,
              referencePhone: referencePhone.trim() || undefined,
              nomineeName: nomineeName.trim() || undefined,
              nomineeRelation: nomineeRelation.trim() || undefined,
              nomineeMobile: nomineeMobile.trim() || undefined,
              kycStatus: nationalId || panNumber ? 'Submitted' : 'Pending',
              branchId: selectedBranchId || undefined,
              branchCode: selectedBranchCode || undefined,
              role,
            }),
          });

          const resData = await res.json();
          if (res.status === 409 && resData.duplicates) {
            setDuplicateWarning(resData.duplicates);
            setError(resData.error);
            setLoading(false);
            return;
          }
          if (res.ok && resData.profile?.id) {
            profileId = resData.profile.id;
            customerNumber = resData.profile.customer_number || `PGF-${cleanPhone.slice(-6)}`;
          } else {
            throw new Error(resData.error || 'API creation fallback');
          }
        } catch (apiErr: any) {
          if (apiErr.message?.includes('Duplicate')) {
            throw apiErr;
          }
          // Direct client fallback creation
          const directProfile = await createProfile({
            id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            name: name.trim(),
            phone_primary: cleanPhone,
            phone_alt: phoneAlt.trim() || undefined,
            email: email.trim() || undefined,
            date_of_birth: dateOfBirth || undefined,
            gender: (gender as any) || undefined,
            marital_status: (maritalStatus as any) || undefined,
            address: address.trim() || 'Tamil Nadu',
            national_id: nationalId.trim() || '',
            pan_number: panNumber.trim() || undefined,
            city: city.trim() || undefined,
            district: district.trim() || undefined,
            state: state.trim() || 'Tamil Nadu',
            pin_code: pinCode.trim() || undefined,
            occupation: occupation.trim() || undefined,
            monthly_income: monthlyIncome ? parseFloat(monthlyIncome) : undefined,
            reference_person: referencePerson.trim() || undefined,
            reference_phone: referencePhone.trim() || undefined,
            nominee_name: nomineeName.trim() || undefined,
            nominee_relation: nomineeRelation.trim() || undefined,
            nominee_mobile: nomineeMobile.trim() || undefined,
            kyc_status: nationalId || panNumber ? 'Submitted' : 'Pending',
            branch_id: selectedBranchId || undefined,
            role,
          }, selectedBranchCode || undefined);
          profileId = directProfile.id;
          customerNumber = directProfile.customer_number || `PGF-${cleanPhone.slice(-6)}`;
        }

        // 2. Upload Portrait photo to Storage if provided
        let photoUrl: string | null = null;
        if (photoPreview) {
          try {
            photoUrl = await uploadProfilePhoto(profileId, photoPreview);
          } catch (e) {
            console.warn('Failed to upload photo to storage:', e);
          }
        }

        // 3. Upload electronic signature to Storage if provided
        let signatureUrl: string | null = null;
        if (signaturePreview) {
          try {
            signatureUrl = await uploadSignature(profileId, signaturePreview);
          } catch (e) {
            console.warn('Failed to upload signature to storage:', e);
          }
        }

        // 4. Update profile row with URLs if uploaded
        if (photoUrl || signatureUrl) {
          await updateProfile(profileId, {
            photo_url: photoUrl || undefined,
            signature_url: signatureUrl || undefined,
          });
        }

        // Trigger welcome notification
        await createNotification({
          recipient_id: profileId,
          type: 'Welcome',
          title: 'Welcome to Pavithra Gold Finance!',
          message: `Hello ${name}, your customer profile account has been successfully created.`,
        });
      } else {
        throw new Error('Firebase connection is not configured or unavailable. Real database connection is required.');
      }

      setCreatedCustomer({
        id: profileId,
        name: name.trim(),
        phone: cleanPhone,
        email: email.trim(),
        customer_number: customerNumber || `PGF-${cleanPhone.slice(-6)}`,
        password: finalPassword,
        role,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to register customer profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs text-[#2563EB] font-semibold tracking-wider uppercase">
        <span>Admin Panel</span>
        <ChevronRight size={12} className="text-gray-400" />
        <span className="text-gray-500">Customer Management</span>
        <ChevronRight size={12} className="text-gray-400" />
        <span>New Onboarding</span>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-[#E5E7EB] pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 tracking-wide font-outfit">New Customer Onboarding</h2>
          <p className="text-gray-500 text-xs mt-1">Register a new client profile, upload KYC proofs, and setup portal credentials.</p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs flex flex-col gap-2">
          <div className="font-bold flex items-center gap-2">
            <span>{error}</span>
          </div>
          {duplicateWarning && duplicateWarning.length > 0 && (
            <div className="mt-2 space-y-1 bg-white/70 p-3 rounded-lg border border-red-200">
              <span className="font-semibold text-gray-800 text-[11px] block">Matching Existing Accounts Found:</span>
              {duplicateWarning.map((dup, idx) => (
                <div key={idx} className="flex justify-between items-center text-[10px] text-gray-700 py-0.5 border-b border-gray-100 last:border-0">
                  <span><strong>{dup.name}</strong> ({dup.phone_primary})</span>
                  <a href={`/admin/customers/${dup.id}`} className="text-blue-600 font-bold hover:underline">View Account &rarr;</a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleOnboard} className="bg-white border border-[#E5E7EB] rounded-2xl p-6 shadow-sm space-y-8 text-xs">
        
        {/* SECTION 1: ACCOUNT ACCESS & BRANCH */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
            <ShieldCheck size={16} className="text-[#2563EB]" />
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">1. Account Access & Allocation</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 bg-[#F8FAFC] p-4 rounded-xl border border-gray-100">
            {/* Role Switcher */}
            <div className="space-y-1.5">
              <label className="text-gray-700 font-bold block">Account Access Role *</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full bg-white border border-gray-200 focus:border-[#2563EB] text-gray-900 text-xs rounded-xl px-3 py-2.5 outline-none font-medium"
              >
                <option value="Customer">Customer (Customer Portal)</option>
                <option value="Admin">Administrator (Full Access)</option>
                <option value="Manager">Branch Manager</option>
                <option value="Cashier">Cashier</option>
                <option value="Appraiser">Gold Appraiser</option>
                <option value="Accountant">Accountant</option>
                <option value="Collection_Officer">Collection Officer</option>
                <option value="Customer_Support">Customer Support</option>
              </select>
            </div>

            {/* Branch Allocation */}
            <div className="space-y-1.5">
              <label className="text-gray-700 font-bold block">Allocated Branch *</label>
              <select
                value={selectedBranchId}
                onChange={(e) => {
                  setSelectedBranchId(e.target.value);
                  const found = branches.find(b => b.id === e.target.value);
                  if (found) setSelectedBranchCode(found.code);
                }}
                className="w-full bg-white border border-gray-200 focus:border-[#2563EB] text-gray-900 text-xs rounded-xl px-3 py-2.5 outline-none font-medium"
              >
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                ))}
              </select>
            </div>

            {/* Portal Password */}
            <div className="space-y-1.5">
              <label className="text-gray-700 font-bold block">
                Portal Login Password <span className="text-xs font-normal text-gray-400">(Optional)</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Optional (Auto-generated if empty)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white border border-gray-200 focus:border-[#2563EB] text-gray-900 text-xs rounded-xl pl-3 pr-9 py-2.5 outline-none font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2: PRIMARY COMPULSORY DETAILS */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
            <User size={16} className="text-[#2563EB]" />
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">2. Primary Contact & Personal Details</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Customer Name */}
            <div className="space-y-1.5">
              <label className="text-gray-700 font-bold block">
                Customer Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Priya Vignesh"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#F9FAFB] border border-gray-200 focus:border-[#2563EB] focus:bg-white text-gray-900 text-xs rounded-xl px-3 py-2.5 outline-none"
              />
            </div>

            {/* Primary Phone */}
            <div className="space-y-1.5">
              <label className="text-gray-700 font-bold block">
                Primary Mobile Number <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-400 font-semibold">+91</span>
                <input
                  type="tel"
                  required
                  maxLength={10}
                  placeholder="9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  className="w-full bg-[#F9FAFB] border border-gray-200 focus:border-[#2563EB] focus:bg-white text-gray-900 text-xs rounded-xl pl-11 pr-3 py-2.5 outline-none font-mono"
                />
              </div>
            </div>

            {/* Email Address */}
            <div className="space-y-1.5">
              <label className="text-gray-700 font-bold block">
                Customer Email Address <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                required
                placeholder="customer@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#F9FAFB] border border-gray-200 focus:border-[#2563EB] focus:bg-white text-gray-900 text-xs rounded-xl px-3 py-2.5 outline-none"
              />
            </div>

            {/* Alternative Phone */}
            <div className="space-y-1.5">
              <label className="text-gray-600 font-semibold block">Alternative Mobile Number</label>
              <input
                type="tel"
                maxLength={10}
                placeholder="Optional secondary mobile"
                value={phoneAlt}
                onChange={(e) => setPhoneAlt(e.target.value.replace(/\D/g, ''))}
                className="w-full bg-[#F9FAFB] border border-gray-200 focus:border-[#2563EB] focus:bg-white text-gray-900 text-xs rounded-xl px-3 py-2.5 outline-none font-mono"
              />
            </div>

            {/* Date of Birth */}
            <div className="space-y-1.5">
              <label className="text-gray-600 font-semibold block">Date of Birth</label>
              <input
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className="w-full bg-[#F9FAFB] border border-gray-200 focus:border-[#2563EB] focus:bg-white text-gray-900 text-xs rounded-xl px-3 py-2.5 outline-none"
              />
            </div>

            {/* Gender */}
            <div className="space-y-1.5">
              <label className="text-gray-600 font-semibold block">Gender</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full bg-[#F9FAFB] border border-gray-200 focus:border-[#2563EB] focus:bg-white text-gray-900 text-xs rounded-xl px-3 py-2.5 outline-none"
              >
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Marital Status */}
            <div className="space-y-1.5">
              <label className="text-gray-600 font-semibold block">Marital Status</label>
              <select
                value={maritalStatus}
                onChange={(e) => setMaritalStatus(e.target.value)}
                className="w-full bg-[#F9FAFB] border border-gray-200 focus:border-[#2563EB] focus:bg-white text-gray-900 text-xs rounded-xl px-3 py-2.5 outline-none"
              >
                <option value="">Select Status</option>
                <option value="Married">Married</option>
                <option value="Single">Single</option>
                <option value="Widowed">Widowed</option>
                <option value="Divorced">Divorced</option>
              </select>
            </div>

            {/* Aadhaar Number */}
            <div className="space-y-1.5">
              <label className="text-gray-600 font-semibold block">12-Digit Aadhaar Card</label>
              <input
                type="text"
                maxLength={12}
                placeholder="123456789012"
                value={nationalId}
                onChange={(e) => setNationalId(e.target.value.replace(/\D/g, ''))}
                className="w-full bg-[#F9FAFB] border border-gray-200 focus:border-[#2563EB] focus:bg-white text-gray-900 text-xs rounded-xl px-3 py-2.5 outline-none font-mono"
              />
            </div>

            {/* PAN Card */}
            <div className="space-y-1.5">
              <label className="text-gray-600 font-semibold block">PAN Card Number</label>
              <input
                type="text"
                maxLength={10}
                placeholder="ABCDE1234F"
                value={panNumber}
                onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                className="w-full bg-[#F9FAFB] border border-gray-200 focus:border-[#2563EB] focus:bg-white text-gray-900 text-xs rounded-xl px-3 py-2.5 outline-none font-mono"
              />
            </div>
          </div>
        </div>

        {/* SECTION 3: ADDRESS, OCCUPATION & REFERENCE */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
            <MapPin size={16} className="text-[#2563EB]" />
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">3. Residential Address & References</h3>
          </div>

          <div className="space-y-1.5">
            <label className="text-gray-600 font-semibold block">Residential Address</label>
            <textarea
              rows={2}
              placeholder="Door No, Street Name, Landmark"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full bg-[#F9FAFB] border border-gray-200 focus:border-[#2563EB] focus:bg-white text-gray-900 text-xs rounded-xl px-3 py-2 outline-none resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <label className="text-gray-600 font-semibold block">City</label>
              <input
                type="text"
                placeholder="e.g. Madurai"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full bg-[#F9FAFB] border border-gray-200 focus:border-[#2563EB] focus:bg-white text-gray-900 text-xs rounded-xl px-3 py-2.5 outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-gray-600 font-semibold block">District</label>
              <input
                type="text"
                placeholder="e.g. Madurai"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="w-full bg-[#F9FAFB] border border-gray-200 focus:border-[#2563EB] focus:bg-white text-gray-900 text-xs rounded-xl px-3 py-2.5 outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-gray-600 font-semibold block">State</label>
              <input
                type="text"
                placeholder="Tamil Nadu"
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full bg-[#F9FAFB] border border-gray-200 focus:border-[#2563EB] focus:bg-white text-gray-900 text-xs rounded-xl px-3 py-2.5 outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-gray-600 font-semibold block">Pincode</label>
              <input
                type="text"
                maxLength={6}
                placeholder="625001"
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ''))}
                className="w-full bg-[#F9FAFB] border border-gray-200 focus:border-[#2563EB] focus:bg-white text-gray-900 text-xs rounded-xl px-3 py-2.5 outline-none font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <label className="text-gray-600 font-semibold block">Occupation</label>
              <input
                type="text"
                placeholder="e.g. Retailer / Salaried"
                value={occupation}
                onChange={(e) => setOccupation(e.target.value)}
                className="w-full bg-[#F9FAFB] border border-gray-200 focus:border-[#2563EB] focus:bg-white text-gray-900 text-xs rounded-xl px-3 py-2.5 outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-gray-600 font-semibold block">Monthly Income (₹)</label>
              <input
                type="number"
                placeholder="e.g. 50000"
                value={monthlyIncome}
                onChange={(e) => setMonthlyIncome(e.target.value)}
                className="w-full bg-[#F9FAFB] border border-gray-200 focus:border-[#2563EB] focus:bg-white text-gray-900 text-xs rounded-xl px-3 py-2.5 outline-none font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-gray-600 font-semibold block">Reference Person Name</label>
              <input
                type="text"
                placeholder="e.g. Ramesh Kumar"
                value={referencePerson}
                onChange={(e) => setReferencePerson(e.target.value)}
                className="w-full bg-[#F9FAFB] border border-gray-200 focus:border-[#2563EB] focus:bg-white text-gray-900 text-xs rounded-xl px-3 py-2.5 outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-gray-600 font-semibold block">Reference Mobile</label>
              <input
                type="tel"
                maxLength={10}
                placeholder="Reference Phone"
                value={referencePhone}
                onChange={(e) => setReferencePhone(e.target.value.replace(/\D/g, ''))}
                className="w-full bg-[#F9FAFB] border border-gray-200 focus:border-[#2563EB] focus:bg-white text-gray-900 text-xs rounded-xl px-3 py-2.5 outline-none font-mono"
              />
            </div>
          </div>
        </div>

        {/* SECTION 4: NOMINEE DETAILS */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
            <Users size={16} className="text-[#2563EB]" />
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">4. Nominee Information</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-[#F8FAFC] p-4 rounded-xl border border-gray-100">
            <div className="space-y-1.5">
              <label className="text-gray-600 font-semibold block">Nominee Full Name</label>
              <input
                type="text"
                placeholder="e.g. Vignesh Kumar"
                value={nomineeName}
                onChange={(e) => setNomineeName(e.target.value)}
                className="w-full bg-white border border-gray-200 focus:border-[#2563EB] text-gray-900 text-xs rounded-xl px-3 py-2.5 outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-gray-600 font-semibold block">Relationship</label>
              <input
                type="text"
                placeholder="e.g. Spouse / Father"
                value={nomineeRelation}
                onChange={(e) => setNomineeRelation(e.target.value)}
                className="w-full bg-white border border-gray-200 focus:border-[#2563EB] text-gray-900 text-xs rounded-xl px-3 py-2.5 outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-gray-600 font-semibold block">Nominee Mobile</label>
              <input
                type="tel"
                maxLength={10}
                placeholder="Nominee Mobile Number"
                value={nomineeMobile}
                onChange={(e) => setNomineeMobile(e.target.value.replace(/\D/g, ''))}
                className="w-full bg-white border border-gray-200 focus:border-[#2563EB] text-gray-900 text-xs rounded-xl px-3 py-2.5 outline-none font-mono"
              />
            </div>
          </div>
        </div>

        {/* SECTION 5: PHOTO & SIGNATURE FILE UPLOADS (NO LIVE CAM REQUIRED) */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
            <ImageIcon size={16} className="text-[#2563EB]" />
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">5. Customer Portrait & Scanned Signature</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Customer Photo File Upload */}
            <div className="border border-gray-200 rounded-2xl p-4 space-y-3 bg-[#F9FAFB]">
              <div className="flex justify-between items-center">
                <span className="font-bold text-gray-800 text-xs">Customer Photo (Image Upload)</span>
                {photoPreview && (
                  <button
                    type="button"
                    onClick={() => setPhotoPreview(null)}
                    className="text-red-500 hover:text-red-700 text-[11px] font-semibold flex items-center gap-1"
                  >
                    <Trash2 size={12} /> Remove
                  </button>
                )}
              </div>

              {photoPreview ? (
                <div className="w-full h-44 rounded-xl overflow-hidden border border-blue-200 bg-white flex items-center justify-center">
                  <img src={photoPreview} alt="Customer Preview" className="h-full w-auto object-cover" />
                </div>
              ) : (
                <label className="border-2 border-dashed border-gray-300 hover:border-[#2563EB] transition-all rounded-xl h-44 flex flex-col items-center justify-center p-4 cursor-pointer bg-white">
                  <Upload size={24} className="text-[#2563EB] mb-2" />
                  <span className="font-bold text-gray-800 text-xs">Upload Customer Portrait</span>
                  <span className="text-[11px] text-gray-400 mt-1 text-center">Click to choose image or capture from phone camera</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />
                </label>
              )}
            </div>

            {/* Signature File Upload */}
            <div className="border border-gray-200 rounded-2xl p-4 space-y-3 bg-[#F9FAFB]">
              <div className="flex justify-between items-center">
                <span className="font-bold text-gray-800 text-xs">Scanned Signature (Image Upload)</span>
                {signaturePreview && (
                  <button
                    type="button"
                    onClick={() => setSignaturePreview(null)}
                    className="text-red-500 hover:text-red-700 text-[11px] font-semibold flex items-center gap-1"
                  >
                    <Trash2 size={12} /> Remove
                  </button>
                )}
              </div>

              {signaturePreview ? (
                <div className="w-full h-44 rounded-xl overflow-hidden border border-blue-200 bg-white flex items-center justify-center p-2">
                  <img src={signaturePreview} alt="Signature Preview" className="max-h-full max-w-full object-contain" />
                </div>
              ) : (
                <label className="border-2 border-dashed border-gray-300 hover:border-[#2563EB] transition-all rounded-xl h-44 flex flex-col items-center justify-center p-4 cursor-pointer bg-white">
                  <Upload size={24} className="text-[#2563EB] mb-2" />
                  <span className="font-bold text-gray-800 text-xs">Upload Scanned Signature</span>
                  <span className="text-[11px] text-gray-400 mt-1 text-center">Click to choose scanned signature file or photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleSignatureUpload}
                  />
                </label>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 6: KYC VERIFICATION PROOFS */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
            <FileText size={16} className="text-[#2563EB]" />
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">6. KYC Document Attachments (Optional)</h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { id: 'aadhaar_front', label: 'Aadhaar Front', file: aadhaarFrontFile },
              { id: 'aadhaar_back', label: 'Aadhaar Back', file: aadhaarBackFile },
              { id: 'pan', label: 'PAN Card', file: panFile },
              { id: 'voter_id', label: 'Voter ID', file: voterIdFile },
              { id: 'driving_license', label: 'Driving License', file: drivingLicenseFile },
              { id: 'passport', label: 'Passport', file: passportFile },
            ].map(doc => (
              <label key={doc.id} className="border border-dashed border-gray-300 hover:border-[#2563EB] rounded-xl p-3 text-center cursor-pointer bg-[#F9FAFB] hover:bg-blue-50/40 transition block">
                <Upload size={16} className="mx-auto text-[#2563EB] mb-1.5" />
                <span className="text-[11px] font-bold text-gray-800 block truncate">{doc.label}</span>
                {doc.file ? (
                  <span className="text-[9px] text-emerald-600 font-semibold truncate block mt-1">{doc.file}</span>
                ) : (
                  <span className="text-[9px] text-gray-400 block mt-0.5">Attach file</span>
                )}
                <input
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={(e) => handleKycDocUpload(doc.id, e)}
                />
              </label>
            ))}
          </div>
        </div>

        {/* SUBMIT BUTTONS */}
        <div className="pt-4 border-t border-gray-100 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={() => router.push('/admin/customers')}
            className="px-5 py-2.5 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-600 font-bold transition text-xs"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-8 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-blue-300 text-white font-bold transition shadow-lg shadow-blue-600/20 flex items-center gap-2 text-xs"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <CheckCircle2 size={16} />
            )}
            <span>Save & Onboard Customer</span>
          </button>
        </div>
      </form>

      {/* GRAND SUCCESS MODAL WITH CONFETTI CELEBRATION */}
      {createdCustomer && (
        <>
          <ConfettiCelebration />
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl border-2 border-emerald-500/30 text-center space-y-6 animate-scale-up relative overflow-hidden">
              {/* Animated Success Checkmark with SVG Draw */}
              <SuccessAnimation
                title="Customer Onboarded Successfully"
                customerName={createdCustomer.name}
                customerId={createdCustomer.customer_number}
              />

              {/* Login Credentials & Contact Summary Card */}
              <div className="bg-gray-50/90 border border-gray-200 rounded-2xl p-4 text-xs text-left space-y-2.5">
                <div className="flex justify-between border-b border-gray-200/60 pb-2">
                  <span className="text-gray-500 font-medium">Primary Mobile:</span>
                  <span className="text-gray-900 font-bold font-mono">+91 {createdCustomer.phone}</span>
                </div>
                {createdCustomer.email && (
                  <div className="flex justify-between border-b border-gray-200/60 pb-2">
                    <span className="text-gray-500 font-medium">Email Address:</span>
                    <span className="text-gray-900 font-semibold">{createdCustomer.email}</span>
                  </div>
                )}
                <div className="flex justify-between border-b border-gray-200/60 pb-2 items-center">
                  <span className="text-gray-500 font-medium">Portal Login Password:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-emerald-700 font-mono font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {createdCustomer.password || '••••••'}
                    </span>
                    {createdCustomer.password && (
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(createdCustomer.password || '');
                          setCopiedPassword(true);
                          setTimeout(() => setCopiedPassword(false), 2500);
                        }}
                        className="p-1 text-gray-400 hover:text-[#2563EB] transition rounded"
                        title="Copy Password"
                      >
                        {copiedPassword ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 font-medium">Account Access Role:</span>
                  <span className="text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">{createdCustomer.role}</span>
                </div>
              </div>

              {/* Direct Actions */}
              <div className="space-y-2.5 pt-1">
                {/* Create Gold Loan Button */}
                <button
                  type="button"
                  onClick={() => router.push(`/admin/loans/new?customerId=${createdCustomer.id}`)}
                  className="w-full py-3.5 bg-gradient-to-r from-[#2563EB] to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-xs font-bold rounded-2xl transition shadow-xl shadow-blue-600/30 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Coins size={16} />
                  <span>+ Create Gold Loan for {createdCustomer.name}</span>
                </button>

                {/* Send via WhatsApp Button */}
                <a
                  href={`https://wa.me/91${createdCustomer.phone}?text=Dear%20${encodeURIComponent(createdCustomer.name)},%20welcome%20to%20Pavithra%20Gold%20Finance!%0A%0AYour%20Customer%20ID:%20${createdCustomer.customer_number}%0APortal%20Password:%20${createdCustomer.password || 'PGF@2026'}%0A%0AYour%20account%20is%20now%20active.`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2"
                >
                  <MessageSquare size={14} className="text-emerald-600" />
                  <span>Send Credentials via WhatsApp</span>
                </a>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => router.push(`/admin/customers/${createdCustomer.id}`)}
                    className="py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-xl transition"
                  >
                    View Full Profile
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCreatedCustomer(null);
                      setName('');
                      setPhone('');
                      setPhoneAlt('');
                      setEmail('');
                      setPassword('');
                      setPhotoPreview(null);
                      setSignaturePreview(null);
                    }}
                    className="py-2.5 border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-bold rounded-xl transition"
                  >
                    + Onboard Another
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
