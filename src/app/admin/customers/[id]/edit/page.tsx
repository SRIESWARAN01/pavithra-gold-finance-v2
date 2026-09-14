'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ChevronRight, Save, User, Building2, CheckCircle2, ShieldCheck } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { isFirebaseConfigured } from '@/lib/auth';
import { getProfile, updateProfile } from '@/lib/db/profiles';
import type { Profile, Gender, MaritalStatus, KycStatus, UserRole } from '@/types/database';

export default function EditCustomerProfile() {
  const router = useRouter();
  const params = useParams();
  const id = (params?.id as string) || '';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [role, setRole] = useState<UserRole>('Customer');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneAlt, setPhoneAlt] = useState('');
  const [email, setEmail] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('');
  const [maritalStatus, setMaritalStatus] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [state, setState] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [occupation, setOccupation] = useState('');
  const [monthlyIncome, setMonthlyIncome] = useState('');
  const [referencePerson, setReferencePerson] = useState('');
  const [referencePhone, setReferencePhone] = useState('');
  const [nomineeName, setNomineeName] = useState('');
  const [nomineeRelation, setNomineeRelation] = useState('');
  const [nomineeMobile, setNomineeMobile] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [customerStatus, setCustomerStatus] = useState('Active');
  const [kycStatus, setKycStatus] = useState<KycStatus>('Pending');

  const [branches, setBranches] = useState<{ id: string; name: string }[]>([]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Load branches
      if (isFirebaseConfigured()) {
        const branchSnap = await getDocs(collection(db, 'branches'));
        setBranches(branchSnap.docs.map(d => ({ id: d.id, name: d.data().name })));
      } else {
        setBranches([
          { id: 'br-mdu', name: 'Madurai Main' },
          { id: 'br-cbe', name: 'Coimbatore' },
          { id: 'br-che', name: 'Chennai' },
        ]);
      }

      // Load Profile
      let prof: Profile | null = null;
      if (isFirebaseConfigured()) {
        prof = await getProfile(id);
      }

      if (prof) {
        setName(prof.name);
        setPhone(prof.phone_primary);
        setPhoneAlt(prof.phone_alt || '');
        setEmail(prof.email || '');
        setDateOfBirth(prof.date_of_birth || '');
        setGender(prof.gender || '');
        setMaritalStatus(prof.marital_status || '');
        setAddress(prof.address);
        setCity(prof.city || '');
        setDistrict(prof.district || '');
        setState(prof.state || '');
        setPinCode(prof.pin_code || '');
        setNationalId(prof.national_id);
        setPanNumber(prof.pan_number || '');
        setOccupation(prof.occupation || '');
        setMonthlyIncome(prof.monthly_income ? String(prof.monthly_income) : '');
        setReferencePerson(prof.reference_person || '');
        setReferencePhone(prof.reference_phone || '');
        setNomineeName(prof.nominee_name || '');
        setNomineeRelation(prof.nominee_relation || '');
        setNomineeMobile(prof.nominee_mobile || '');
        setSelectedBranchId(prof.branch_id || '');
        setCustomerStatus(prof.status);
        setKycStatus(prof.kyc_status || 'Pending');
        setRole((prof.role as UserRole) || 'Customer');
      } else {
        setError('Customer profile folder not found.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load profile.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      const t = setTimeout(() => {
        loadData();
      }, 0);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (isFirebaseConfigured()) {
        await updateProfile(id, {
          name,
          phone_alt: phoneAlt ? phoneAlt.trim() : undefined,
          email: email ? email.trim() : null,
          date_of_birth: dateOfBirth ? dateOfBirth.trim() : null,
          gender: (gender as Gender) || null,
          marital_status: (maritalStatus as MaritalStatus) || null,
          address,
          city: city ? city.trim() : undefined,
          district: district ? district.trim() : undefined,
          state: state ? state.trim() : null,
          pin_code: pinCode ? pinCode.trim() : undefined,
          occupation: occupation ? occupation.trim() : undefined,
          monthly_income: monthlyIncome ? parseFloat(monthlyIncome) : undefined,
          reference_person: referencePerson ? referencePerson.trim() : undefined,
          reference_phone: referencePhone ? referencePhone.trim() : undefined,
          nominee_name: nomineeName ? nomineeName.trim() : null,
          nominee_relation: nomineeRelation ? nomineeRelation.trim() : null,
          nominee_mobile: nomineeMobile ? nomineeMobile.trim() : null,
          branch_id: selectedBranchId || null,
          status: customerStatus,
          kyc_status: kycStatus,
          role,
        });
      }
      alert('User profile and access updated successfully.');
      router.push(`/admin/customers/${id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-gray-500 text-xs flex flex-col items-center gap-3 justify-center min-h-[50vh]">
        <div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin"></div>
        <span>Loading client profile editor...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs text-[#2563EB] font-semibold tracking-wider uppercase">
        <span>Admin Panel</span>
        <ChevronRight size={12} className="text-gray-400" />
        <span className="text-gray-500">Customers</span>
        <ChevronRight size={12} className="text-gray-400" />
        <span>Edit Dossier</span>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-[#E5E7EB] pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 tracking-wide font-outfit">Edit Customer</h2>
          <p className="text-gray-500 text-xs mt-1">Modify account metadata, demographic attributes, and nominee parameters.</p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-rose-500/20 text-red-500 text-xs">
          {error}
        </div>
      )}

      <form onSubmit={handleUpdate} className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-4 sm:p-6 space-y-6 text-xs">
        
        {/* Branch / Status Header */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-[#F8FAFC]/45 border border-[#E5E7EB] rounded-lg">
          <div className="space-y-1">
            <label className="text-gray-400 font-medium">Customer Status</label>
            <select
              value={customerStatus}
              onChange={(e) => setCustomerStatus(e.target.value)}
              className="w-full bg-[#F3F4F6] border border-[#E5E7EB] text-gray-900 rounded p-1.5 outline-none"
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Blocked">Blocked</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-gray-400 font-medium">KYC Status</label>
            <select
              value={kycStatus}
              onChange={(e) => setKycStatus(e.target.value as KycStatus)}
              className="w-full bg-[#F3F4F6] border border-[#E5E7EB] text-gray-900 rounded p-1.5 outline-none"
            >
              <option value="Pending">Pending Review</option>
              <option value="Submitted">Submitted</option>
              <option value="Under_Review">Under Review</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-gray-400 font-medium">Home Branch Allocation</label>
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="w-full bg-[#F3F4F6] border border-[#E5E7EB] text-gray-900 rounded p-1.5 outline-none"
            >
              <option value="">Select Branch</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-gray-600 font-semibold flex items-center gap-1">
              <ShieldCheck size={12} className="text-[#2563EB]" />
              <span>Access Role</span>
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full bg-blue-50/50 border border-blue-200 text-gray-900 font-medium rounded p-1.5 outline-none"
            >
              <option value="Customer">Customer (Customer Portal)</option>
              <option value="Admin">Administrator (Full Backoffice)</option>
              <option value="Manager">Branch Manager</option>
              <option value="Cashier">Cashier</option>
              <option value="Appraiser">Gold Appraiser</option>
              <option value="Accountant">Accountant</option>
              <option value="Collection_Officer">Collection Officer</option>
              <option value="Customer_Support">Customer Support</option>
            </select>
          </div>
        </div>

        {/* Profile Details */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-[#2563EB] border-b border-[#E5E7EB] pb-1.5 uppercase tracking-wider flex items-center gap-1.5">
            <User size={14} />
            Customer Dossier
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-gray-500 font-medium">Full Name (as in Aadhaar) *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 text-sm rounded px-4 py-2 outline-none transition"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-gray-500 font-medium">Primary Contact *</label>
              <input
                type="tel"
                required
                disabled
                value={phone}
                className="w-full bg-[#F3F4F6]/50 border border-[#E5E7EB] text-gray-400 text-sm rounded px-4 py-2 outline-none cursor-not-allowed"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-gray-500 font-medium">Alternative Mobile</label>
              <input
                type="tel"
                value={phoneAlt}
                onChange={(e) => setPhoneAlt(e.target.value)}
                className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 text-sm rounded px-4 py-2 outline-none transition"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-gray-500 font-medium">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 text-sm rounded px-4 py-2 outline-none transition"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-gray-500 font-medium">Date of Birth</label>
              <input
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 text-xs rounded px-3 py-2 outline-none transition"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-gray-500 font-medium">Gender</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 text-xs rounded px-3 py-2 outline-none transition"
              >
                <option value="">Select</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-gray-500 font-medium">Marital Status</label>
              <select
                value={maritalStatus}
                onChange={(e) => setMaritalStatus(e.target.value)}
                className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 text-xs rounded px-3 py-2 outline-none transition"
              >
                <option value="">Select</option>
                <option value="Single">Single</option>
                <option value="Married">Married</option>
                <option value="Widowed">Widowed</option>
                <option value="Divorced">Divorced</option>
              </select>
            </div>
          </div>
        </div>

        {/* KYC Document fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-gray-500 font-medium">Aadhaar (National ID) *</label>
            <input
              type="text"
              required
              value={nationalId}
              onChange={(e) => setNationalId(e.target.value)}
              className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 text-sm rounded px-4 py-2 outline-none transition"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-gray-500 font-medium">PAN Card Number</label>
            <input
              type="text"
              value={panNumber}
              onChange={(e) => setPanNumber(e.target.value)}
              className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 text-sm rounded px-4 py-2 outline-none transition"
            />
          </div>
        </div>

        {/* Address */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-[#2563EB] border-b border-[#E5E7EB] pb-1.5 uppercase tracking-wider">
            Residential Address
          </h3>
          <div className="space-y-1.5">
            <label className="text-gray-500 font-medium">Address Line *</label>
            <input
              type="text"
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 text-sm rounded px-4 py-2 outline-none"
            />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="text-gray-400">City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 rounded p-1.5"
              />
            </div>
            <div className="space-y-1">
              <label className="text-gray-400">District</label>
              <input
                type="text"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 rounded p-1.5"
              />
            </div>
            <div className="space-y-1">
              <label className="text-gray-400">State</label>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 rounded p-1.5"
              />
            </div>
            <div className="space-y-1">
              <label className="text-gray-400">Pincode</label>
              <input
                type="text"
                value={pinCode}
                onChange={(e) => setPinCode(e.target.value)}
                className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 rounded p-1.5"
              />
            </div>
          </div>
        </div>

        {/* Occupation & Nominee info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Nominee details */}
          <div className="border border-[#E5E7EB] rounded-lg p-4 space-y-3 bg-[#F8FAFC]/35">
            <span className="font-semibold text-[#2563EB] block">Nominee Information</span>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-gray-400 text-[9px]">Full Name</label>
                <input
                  type="text"
                  value={nomineeName}
                  onChange={(e) => setNomineeName(e.target.value)}
                  className="w-full bg-[#F3F4F6] border border-[#E5E7EB] text-gray-900 text-xs rounded p-1.5"
                />
              </div>
              <div className="space-y-1">
                <label className="text-gray-400 text-[9px]">Relationship</label>
                <input
                  type="text"
                  value={nomineeRelation}
                  onChange={(e) => setNomineeRelation(e.target.value)}
                  className="w-full bg-[#F3F4F6] border border-[#E5E7EB] text-gray-900 text-xs rounded p-1.5"
                />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-gray-400 text-[9px]">Contact Mobile</label>
              <input
                type="tel"
                value={nomineeMobile}
                onChange={(e) => setNomineeMobile(e.target.value)}
                className="w-full bg-[#F3F4F6] border border-[#E5E7EB] text-gray-900 text-xs rounded p-1.5"
              />
            </div>
          </div>

          {/* Occupation details */}
          <div className="border border-[#E5E7EB] rounded-lg p-4 space-y-3 bg-[#F8FAFC]/35">
            <span className="font-semibold text-[#2563EB] block">Job & Reference Details</span>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-gray-400 text-[9px]">Occupation</label>
                <input
                  type="text"
                  value={occupation}
                  onChange={(e) => setOccupation(e.target.value)}
                  className="w-full bg-[#F3F4F6] border border-[#E5E7EB] text-gray-900 text-xs rounded p-1.5"
                />
              </div>
              <div className="space-y-1">
                <label className="text-gray-400 text-[9px]">Monthly Income</label>
                <input
                  type="number"
                  value={monthlyIncome}
                  onChange={(e) => setMonthlyIncome(e.target.value)}
                  className="w-full bg-[#F3F4F6] border border-[#E5E7EB] text-gray-900 text-xs rounded p-1.5"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-gray-400 text-[9px]">Ref Person</label>
                <input
                  type="text"
                  value={referencePerson}
                  onChange={(e) => setReferencePerson(e.target.value)}
                  className="w-full bg-[#F3F4F6] border border-[#E5E7EB] text-gray-900 text-xs rounded p-1.5"
                />
              </div>
              <div className="space-y-1">
                <label className="text-gray-400 text-[9px]">Ref Contact</label>
                <input
                  type="tel"
                  value={referencePhone}
                  onChange={(e) => setReferencePhone(e.target.value)}
                  className="w-full bg-[#F3F4F6] border border-[#E5E7EB] text-gray-900 text-xs rounded p-1.5"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="pt-4 border-t border-[#E5E7EB] flex justify-end gap-4">
          <button
            type="button"
            onClick={() => router.push(`/admin/customers/${id}`)}
            className="px-6 py-2 border border-[#E5E7EB] hover:bg-[#F3F4F6] text-gray-600 rounded font-semibold transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-8 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-[#2563EB]/50 text-[#F8FAFC] rounded font-bold shadow-lg flex items-center gap-1.5 transition"
          >
            {saving ? (
              <div className="w-3 h-3 border-2 border-[#F8FAFC] border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <Save size={14} />
            )}
            Save Profile
          </button>
        </div>
      </form>
    </div>
  );
}
