'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Coins,
  ChevronRight,
  Plus,
  Trash2,
  ArrowLeft,
  ArrowRight,
  Printer,
  AlertTriangle,
  Download,
  FileText,
  CheckCircle2,
  ExternalLink,
  Camera,
  Upload,
  Image as ImageIcon,
  X,
  Sparkles,
  Share2,
  MessageSquare,
  ShieldCheck,
  ChevronDown
} from 'lucide-react';
import { isFirebaseConfigured, getCurrentProfile } from '@/lib/auth';
import { searchProfiles, getProfile } from '@/lib/db/profiles';
import { createLoan, VALID_LOAN_APR_RATES } from '@/lib/db/loans';
import { addGoldItemsBatch } from '@/lib/db/gold';
import { createNotification } from '@/lib/db/notifications';
import { createApprovalRequest } from '@/lib/db/approvals';
import { getNumericSetting } from '@/lib/db/settings';
import type { Profile, GoldCollateralInsert, GoldPurity } from '@/types/database';
import PDFPreviewModal from '@/components/PDFPreviewModal';
import { getPdfApiUrl, downloadPdfDocument } from '@/lib/pdfHelper';
import { compressImage } from '@/lib/imageCompressor';

export const PURITY_CONFIG: Record<GoldPurity, {
  karat: GoldPurity;
  label: string;
  fineness: string;
  purityPct: string;
  multiplier: number; // Relative to 22K Madurai benchmark
  description: string;
  isBenchmark?: boolean;
}> = {
  '24K': {
    karat: '24K',
    label: '24K',
    fineness: '999 Fineness',
    purityPct: '99.9% Fine',
    multiplier: 24 / 22,
    description: 'Pure Bullion / Fine Gold',
  },
  '22K': {
    karat: '22K',
    label: '22K',
    fineness: '916 Fineness',
    purityPct: '91.6% Standard',
    multiplier: 1.0,
    description: 'Standard Jewellery (Live Madurai Benchmark)',
    isBenchmark: true,
  },
  '21K': {
    karat: '21K',
    label: '21K',
    fineness: '875 Fineness',
    purityPct: '87.5% Gulf',
    multiplier: 21 / 22,
    description: 'Arabian / Gulf Import Jewellery',
  },
  '18K': {
    karat: '18K',
    label: '18K',
    fineness: '750 Fineness',
    purityPct: '75.0% Ornament',
    multiplier: 18 / 22,
    description: 'Diamond / Modern Ornament Gold',
  },
};

export function getPurityMultiplier(purity: string): number {
  if (purity in PURITY_CONFIG) {
    return PURITY_CONFIG[purity as GoldPurity].multiplier;
  }
  return 1.0;
}

interface GoldItem {
  name: string;
  grossWeight: number | '';
  stoneWeight: number | '';
  netWeight: number | '';
  purity: GoldPurity;
  ratePerGram: number | '';
  marketValue: number;
  maxEligibleLoan: number;
  hallmark: boolean;
  storageBin: string;
  frontPhoto: string | null;
  backPhoto: string | null;
}

function NewLoanWizardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const customerIdParam = searchParams.get('customerId');

  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [createdLoanId, setCreatedLoanId] = useState('');
  const [createdLoanNumber, setCreatedLoanNumber] = useState('');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const WIZARD_STEPS = [
    { step: 1, label: '1. Select Customer', desc: 'Borrower KYC' },
    { step: 2, label: '2. Gold Appraisal', desc: 'Weight & Purity' },
    { step: 3, label: '3. Loan Terms', desc: 'Principal & APR' },
    { step: 4, label: '4. Bills & Pawn Ticket', desc: 'Disburse & Print' },
  ];

  // Global Gold Rate and Interest APR settings
  const [globalGoldRate, setGlobalGoldRate] = useState<number | ''>(''); // INR per gram
  const [maxLtvPct, setMaxLtvPct] = useState<number>(75); // Configurable LTV cap (default 75%)
  const [currentUserProfile, setCurrentUserProfile] = useState<Profile | null>(null);
  const [isSubmittedForApproval, setIsSubmittedForApproval] = useState<boolean>(false);

  // Load LTV %, standard gold rate, and current user profile on mount
  useEffect(() => {
    async function loadConfigAndUser() {
      try {
        const prof = await getCurrentProfile();
        if (prof) setCurrentUserProfile(prof);

        const ltv = await getNumericSetting('ltv_percentage', 75);
        if (ltv > 0) setMaxLtvPct(ltv);

        const rate22 = await getNumericSetting('gold_rate_22k', 9625);
        if (rate22 > 0) {
          setGlobalGoldRate(rate22);
        }
      } catch (err) {
        console.warn('Failed to load settings or user profile in loan wizard:', err);
      }
    }
    loadConfigAndUser();
  }, []);

  // Step 1: Customer Selection
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Profile | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customers, setCustomers] = useState<Profile[]>([]);

  // Auto-load customer from URL query param if present
  useEffect(() => {
    async function loadCustomerParam() {
      if (customerIdParam) {
        try {
          const prof = await getProfile(customerIdParam);
          if (prof) {
            setSelectedCustomerId(prof.id);
            setSelectedCustomer(prof);
            setStep(2); // Automatically advance to collateral appraisal
          }
        } catch (e) {
          console.warn('Could not auto-load customer from param:', e);
        }
      }
    }
    loadCustomerParam();
  }, [customerIdParam]);

  async function loadCustomers() {
    if (!customerSearch.trim()) {
      setCustomers([]);
      return;
    }
    try {
      const results = await searchProfiles(customerSearch);
      setCustomers(results);
    } catch (_err) {
      console.error('Failed to search customers:', _err);
    }
  }

  useEffect(() => {
    const t = setTimeout(() => {
      loadCustomers();
    }, 200);
    return () => clearTimeout(t);
  }, [customerSearch]);

  // Step 2: Gold Appraisal Items List — initially empty/blank numeric fields
  const [goldItems, setGoldItems] = useState<GoldItem[]>([
    {
      name: '',
      grossWeight: '',
      stoneWeight: '',
      netWeight: '',
      purity: '22K',
      ratePerGram: '',
      marketValue: 0,
      maxEligibleLoan: 0,
      hallmark: true,
      storageBin: 'BIN-TRAY-01',
      frontPhoto: null,
      backPhoto: null,
    }
  ]);

  // Apply global gold rate to all items dynamically based on each item's purity
  const handleApplyGlobalRate = () => {
    if (globalGoldRate === '' || typeof globalGoldRate !== 'number' || globalGoldRate <= 0) {
      alert('Please enter a valid gold rate per gram before applying to items.');
      return;
    }
    const updated = goldItems.map(item => {
      const multiplier = getPurityMultiplier(item.purity);
      const effectiveRate = Math.round(globalGoldRate * multiplier);
      const net = typeof item.netWeight === 'number' ? item.netWeight : 0;
      const marketValue = net > 0 ? Math.round(net * effectiveRate) : 0;
      const maxEligibleLoan = Math.round(marketValue * (maxLtvPct / 100));
      return {
        ...item,
        ratePerGram: globalGoldRate,
        marketValue,
        maxEligibleLoan,
      };
    });
    setGoldItems(updated);
  };

  const addGoldItem = () => {
    const defaultRate = typeof globalGoldRate === 'number' ? globalGoldRate : '';

    setGoldItems([...goldItems, {
      name: '',
      grossWeight: '',
      stoneWeight: '',
      netWeight: '',
      purity: '22K',
      ratePerGram: defaultRate,
      marketValue: 0,
      maxEligibleLoan: 0,
      hallmark: true,
      storageBin: `BIN-TRAY-0${goldItems.length + 1}`,
      frontPhoto: null,
      backPhoto: null,
    }]);
  };

  const removeGoldItem = (index: number) => {
    if (goldItems.length === 1) return;
    setGoldItems(goldItems.filter((_, i) => i !== index));
  };

  const handlePhotoUpload = async (index: number, position: 'front' | 'back', file: File) => {
    try {
      const compressed = await compressImage(file, 600, 600, 0.65);
      const updated = [...goldItems];
      if (position === 'front') {
        updated[index].frontPhoto = compressed;
      } else {
        updated[index].backPhoto = compressed;
      }
      setGoldItems(updated);
    } catch (err) {
      console.error('Failed to compress image:', err);
    }
  };

  const handleRemovePhoto = (index: number, position: 'front' | 'back') => {
    const updated = [...goldItems];
    if (position === 'front') {
      updated[index].frontPhoto = null;
    } else {
      updated[index].backPhoto = null;
    }
    setGoldItems(updated);
  };

  const handleGoldItemChange = (index: number, field: keyof GoldItem, value: any) => {
    const updated = [...goldItems];
    const item = { ...updated[index] };

    // Update the targeted field
    if (field === 'purity') {
      item.purity = value as GoldPurity;
    } else if (field === 'name') {
      item.name = value;
    } else if (field === 'storageBin') {
      item.storageBin = value;
    } else if (field === 'hallmark') {
      item.hallmark = Boolean(value);
    } else {
      // Numeric fields: grossWeight, stoneWeight, ratePerGram
      if (value === '' || value === undefined || value === null) {
        (item as any)[field] = '';
      } else {
        const numVal = parseFloat(value);
        (item as any)[field] = isNaN(numVal) ? '' : numVal;
      }
    }

    // Recalculate Weights only if numeric value entered
    if (item.grossWeight === '' || typeof item.grossWeight !== 'number') {
      item.netWeight = '';
      item.marketValue = 0;
      item.maxEligibleLoan = 0;
    } else {
      const sWeight = typeof item.stoneWeight === 'number' ? item.stoneWeight : 0;
      const net = Math.max(0, Math.round((item.grossWeight - sWeight) * 100) / 100);
      item.netWeight = net;

      // Dynamic valuation based on purity multiplier relative to 22K live Madurai benchmark
      const multiplier = getPurityMultiplier(item.purity);
      const itemRate = typeof item.ratePerGram === 'number' ? item.ratePerGram : (typeof globalGoldRate === 'number' ? globalGoldRate : 0);
      const effectiveRate = Math.round(itemRate * multiplier);

      if (net > 0 && effectiveRate > 0) {
        item.marketValue = Math.round(net * effectiveRate);
        item.maxEligibleLoan = Math.round(item.marketValue * (maxLtvPct / 100));
      } else {
        item.marketValue = 0;
        item.maxEligibleLoan = 0;
      }
    }

    updated[index] = item;
    setGoldItems(updated);
  };

  // Step 3: Loan Parameters
  const totalMarketValue = goldItems.reduce((acc, item) => acc + (item.marketValue || 0), 0);
  const totalMaxEligibility = goldItems.reduce((acc, item) => acc + (item.maxEligibleLoan || 0), 0);

  const [loanPrincipal, setLoanPrincipal] = useState<number | ''>('');
  const [isPrincipalCustom, setIsPrincipalCustom] = useState(false);
  const [interestApr, setInterestApr] = useState<number | ''>(''); // Blank by default, user enters APR
  const [durationDays, setDurationDays] = useState(365); // 1 Year default
  const [agreeTerms, setAgreeTerms] = useState(true); // Terms agreement checkbox

  // Update principal amount when totals modify only if user has not entered a custom amount
  useEffect(() => {
    if (!isPrincipalCustom) {
      setLoanPrincipal(totalMaxEligibility > 0 ? totalMaxEligibility : '');
    }
  }, [totalMaxEligibility, isPrincipalCustom]);

  // Submit and create loan
  const [loading, setLoading] = useState(false);

  const handleSubmitLoan = async () => {
    setLoading(true);
    setError(null);

    // Validate customer
    if (!selectedCustomerId) {
      setError('Please select a customer before originating the loan.');
      setStep(1);
      setLoading(false);
      return;
    }

    // Validate gold items weights
    for (let i = 0; i < goldItems.length; i++) {
      const item = goldItems[i];
      if (!item.name || !item.name.trim()) {
        setError(`Please enter an ornament name / description for item ${i + 1}.`);
        setLoading(false);
        return;
      }
      if (item.grossWeight === '' || typeof item.grossWeight !== 'number' || item.grossWeight <= 0) {
        setError(`Please enter a valid gross weight greater than zero for item ${i + 1} (${item.name}).`);
        setLoading(false);
        return;
      }
      const sWeight = typeof item.stoneWeight === 'number' ? item.stoneWeight : 0;
      if (item.grossWeight <= sWeight) {
        setError(`Item ${i + 1} (${item.name}) net weight must be greater than zero. Stone deductions cannot exceed gross weight.`);
        setLoading(false);
        return;
      }
      if (item.ratePerGram === '' || typeof item.ratePerGram !== 'number' || item.ratePerGram <= 0) {
        setError(`Please enter a valid rate per gram greater than zero for item ${i + 1} (${item.name}).`);
        setLoading(false);
        return;
      }
    }

    if (loanPrincipal === '' || typeof loanPrincipal !== 'number' || loanPrincipal <= 0) {
      setError('Requested principal amount must be entered and greater than zero.');
      setLoading(false);
      return;
    }

    const isHighLtv = loanPrincipal > totalMaxEligibility;
    const userRole = currentUserProfile?.role || 'Admin';
    const isEmployee = userRole === 'Employee' || userRole === 'Appraiser' || userRole === 'Cashier';

    // If an employee requests an amount above eligible LTV, or creates a loan application:
    // Employee Request → Admin/Manager Approval → Approved Amount → Eligible for Disbursement
    const requiresApproval = isHighLtv || isEmployee;

    if (interestApr === '' || typeof interestApr !== 'number' || !VALID_LOAN_APR_RATES.includes(interestApr as any)) {
      setError('Please select an Annual Interest Rate (APR %) from the 5 available options: 18%, 20%, 22%, 24%, or 30%.');
      setLoading(false);
      return;
    }

    if (!agreeTerms) {
      setError('Please accept the statutory pledge terms and conditions to proceed.');
      setLoading(false);
      return;
    }

    try {
      if (!isFirebaseConfigured()) {
        throw new Error('Firebase connection is not configured or unavailable. Real database connection is required.');
      }

      // 1. Create the loan record
      const loan = await createLoan({
        customer_id: selectedCustomerId,
        loan_number: '', // Auto-generated atomically
        principal_amount: loanPrincipal,
        interest_rate_apr: interestApr,
        loan_period_months: Math.round(durationDays / 30),
        status: requiresApproval ? 'Pending_Approval' : 'Active',
        origination_date: new Date().toISOString(),
        disbursed_amount: requiresApproval ? 0 : loanPrincipal,
      });

      // 2. Map gold items to DB insertion format
      const dbGoldItems: GoldCollateralInsert[] = goldItems.map((item) => {
        const multiplier = getPurityMultiplier(item.purity);
        const rate = typeof item.ratePerGram === 'number' ? item.ratePerGram : 0;
        const effectiveRate = Math.round(rate * multiplier);
        const netWt = typeof item.netWeight === 'number' ? item.netWeight : 0;
        return {
          loan_id: loan.id,
          customer_id: selectedCustomerId,
          item_description: item.name,
          gross_weight: Number(item.grossWeight),
          stone_weight: item.stoneWeight === '' ? 0 : Number(item.stoneWeight),
          net_weight: netWt,
          purity_karat: item.purity,
          hallmark: item.hallmark,
          gold_rate_per_gram: effectiveRate,
          valuation_inr: item.marketValue,
          max_eligible_loan: item.maxEligibleLoan,
          storage_bin_id: item.storageBin || `BIN-${Date.now().toString(36).toUpperCase()}`,
          front_photo_url: item.frontPhoto || undefined,
          back_photo_url: item.backPhoto || undefined,
        };
      });

      // 3. Batch insert the gold collateral items
      await addGoldItemsBatch(dbGoldItems);

      // 4. If requires approval, submit approval request
      if (requiresApproval) {
        await createApprovalRequest({
          request_type: isHighLtv ? 'High_LTV_Approval' : 'Loan_Approval',
          entity_id: loan.id,
          entity_type: 'loans',
          requested_by: currentUserProfile?.id || 'staff_unknown',
          requested_by_name: currentUserProfile?.name || 'Staff Member',
          requested_by_role: userRole,
          requested_amount: loanPrincipal,
          eligible_amount: totalMaxEligibility,
          details: {
            loan_number: loan.loan_number,
            customer_name: selectedCustomer?.name || 'Customer',
            customer_id: selectedCustomerId,
            total_collateral_net_weight: totalCollateralWeight,
            total_valuation: totalMarketValue,
            max_eligible_ltv_amount: totalMaxEligibility,
            requested_principal: loanPrincipal,
            is_high_ltv: isHighLtv,
          },
          reason: isHighLtv
            ? `Requested loan of ₹${loanPrincipal.toLocaleString('en-IN')} exceeds normal eligible LTV limit ₹${totalMaxEligibility.toLocaleString('en-IN')}`
            : `New loan application submitted for management verification by ${currentUserProfile?.name || 'Staff'}`,
        });

        setIsSubmittedForApproval(true);
      } else {
        setIsSubmittedForApproval(false);
      }

      // 5. Send created notification
      await createNotification({
        recipient_id: selectedCustomerId,
        type: 'Loan_Created',
        title: requiresApproval ? `Loan Application Registered — ${loan.loan_number}` : `Loan Originated — ${loan.loan_number}`,
        message: requiresApproval
          ? `Your gold loan application (${loan.loan_number}) for Rs. ${loanPrincipal.toLocaleString('en-IN')} has been submitted for management verification.`
          : `Your gold loan folder has been created with principal amount Rs. ${loanPrincipal.toLocaleString('en-IN')}. Pawn ticket generated.`,
      });

      setCreatedLoanId(loan.id);
      setCreatedLoanNumber(loan.loan_number);
      setStep(4); // Advance to confirmation step
    } catch (err: any) {
      console.error('Failed to originate loan:', err);
      setError(err.message || 'Database error. Failed to originate loan record.');
    } finally {
      setLoading(false);
    }
  };

  const totalCollateralWeight = goldItems.reduce((acc, item) => acc + (typeof item.netWeight === 'number' ? item.netWeight : 0), 0);

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs text-[#2563EB] font-semibold tracking-wider uppercase">
        <span>Admin Panel</span>
        <ChevronRight size={12} className="text-gray-400" />
        <span>Loans wizard</span>
        <ChevronRight size={12} className="text-gray-400" />
        <span className="text-gray-500">Step {step} of 4: {WIZARD_STEPS[step - 1]?.label}</span>
      </div>

      {/* Four-Step Sequential Progression Stepper: 1. Select Customer → 2. Gold Appraisal → 3. Loan Terms → 4. Bills & Pawn Ticket */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-gray-800">
            <span className="text-[#2563EB]">Loan Creation Steps:</span>
            <span className="text-gray-600 font-medium">
              1. Select Customer → 2. Gold Appraisal → 3. Loan Terms → 4. Bills &amp; Pawn Ticket
            </span>
          </div>
          <span className="text-[11px] font-bold text-[#2563EB] bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
            Step {step} of 4
          </span>
        </div>

        <div className="flex flex-wrap md:flex-nowrap items-center justify-between gap-2">
          {WIZARD_STEPS.map((item, idx) => {
            const isCompleted = step > item.step;
            const isCurrent = step === item.step;
            const canNavigate =
              item.step < step ||
              (item.step === 2 && Boolean(selectedCustomerId)) ||
              (item.step === 3 && Boolean(selectedCustomerId) && goldItems.length > 0);

            return (
              <React.Fragment key={item.step}>
                <button
                  type="button"
                  disabled={!canNavigate && !isCurrent}
                  onClick={() => {
                    if (canNavigate) setStep(item.step);
                  }}
                  className={`flex items-center gap-2.5 py-2 px-3 rounded-xl transition-all text-left flex-1 min-w-[140px] ${
                    canNavigate ? 'cursor-pointer hover:bg-blue-50/60' : 'cursor-default'
                  } ${
                    isCurrent
                      ? 'bg-blue-50/80 border border-blue-200 shadow-xs'
                      : 'border border-transparent'
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all ${
                      isCurrent
                        ? 'bg-[#2563EB] text-white shadow-sm ring-4 ring-blue-100'
                        : isCompleted
                        ? 'bg-emerald-600 text-white'
                        : 'bg-gray-100 text-gray-400 border border-gray-200'
                    }`}
                  >
                    {isCompleted ? <CheckCircle2 size={15} /> : item.step}
                  </div>
                  <div className="min-w-0">
                    <span
                      className={`text-xs font-bold tracking-tight block truncate ${
                        isCurrent
                          ? 'text-[#2563EB]'
                          : isCompleted
                          ? 'text-gray-900'
                          : 'text-gray-400'
                      }`}
                    >
                      {item.label}
                    </span>
                    <span className="text-[10px] text-gray-400 hidden sm:block">
                      {item.desc}
                    </span>
                  </div>
                </button>

                {idx < WIZARD_STEPS.length - 1 && (
                  <div className="flex items-center text-gray-300 px-1 select-none shrink-0 font-bold text-sm">
                    <span className="text-gray-400">→</span>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs flex items-center gap-2">
          <AlertTriangle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* STEP 1: CUSTOMER SELECTION */}
      {step === 1 && (
        <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-6 space-y-5 shadow-sm">
          <div className="border-b border-[#E5E7EB] pb-3 flex justify-between items-center">
            <div>
              <h3 className="text-base font-bold text-gray-900 font-outfit">Select or Search Customer</h3>
              <p className="text-xs text-gray-500">Enter customer name, phone number, or national ID to begin pledge application.</p>
            </div>
            <button
              onClick={() => router.push('/admin/customers/new')}
              className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#2563EB] border border-blue-200 rounded-lg text-xs font-bold transition flex items-center gap-1"
            >
              <Plus size={14} /> New Customer
            </button>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-gray-700 font-bold uppercase tracking-wider block">Customer Search *</label>
            <input
              type="text"
              placeholder="Type Customer Name, Mobile (e.g. 9876543210), or Aadhaar..."
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              className="w-full bg-[#F9FAFB] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 text-sm rounded-lg px-4 py-3 outline-none transition"
              autoFocus
            />
          </div>

          {selectedCustomer && (
            <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 flex justify-between items-center">
              <div>
                <span className="text-[10px] text-[#2563EB] font-bold uppercase tracking-wider block">Selected Borrower:</span>
                <h4 className="font-bold text-gray-900 text-sm mt-0.5">{selectedCustomer.name}</h4>
                <p className="text-gray-600 text-xs mt-0.5">Phone: +91 {selectedCustomer.phone_primary} | Aadhaar: {selectedCustomer.national_id}</p>
                <p className="text-gray-500 text-[11px] mt-0.5">Address: {selectedCustomer.address || 'N/A'}</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-[#2563EB] text-white flex items-center justify-center font-bold">
                <CheckCircle2 size={18} />
              </div>
            </div>
          )}

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {customers.length === 0 && customerSearch.trim() && (
              <p className="text-xs text-gray-400 text-center py-6">No onboarded customers found matching that query. You can add a new customer first.</p>
            )}
            {customers.map((cust) => (
              <div
                key={cust.id}
                onClick={() => {
                  setSelectedCustomerId(cust.id);
                  setSelectedCustomer(cust);
                }}
                className={`p-4 rounded-xl border cursor-pointer transition flex justify-between items-center ${
                  selectedCustomerId === cust.id
                    ? 'border-[#2563EB] bg-[#2563EB]/5 shadow-sm'
                    : 'border-[#E5E7EB] hover:bg-[#F9FAFB] bg-white'
                }`}
              >
                <div>
                  <h4 className="font-semibold text-gray-900 text-sm">{cust.name}</h4>
                  <p className="text-gray-500 text-xs mt-0.5">Phone: +91 {cust.phone_primary} &middot; Aadhaar: {cust.national_id}</p>
                  <p className="text-gray-400 text-[11px]">{cust.address}</p>
                </div>
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                  selectedCustomerId === cust.id ? 'border-[#2563EB] bg-[#2563EB]' : 'border-gray-300'
                }`}>
                  {selectedCustomerId === cust.id && <div className="w-2 h-2 rounded-full bg-white" />}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-4 border-t border-[#E5E7EB]">
            <button
              onClick={() => setStep(2)}
              disabled={!selectedCustomerId}
              className="px-6 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-gray-300 disabled:text-gray-500 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow"
            >
              Appraise Collateral
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: GOLD APPRAISAL */}
      {step === 2 && (
        <div className="space-y-6">
          {/* Today's Market Rate Master Banner */}
          <div className="bg-gradient-to-r from-amber-50 to-amber-100/60 border border-amber-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-200/80 border border-amber-300 flex items-center justify-center text-amber-800">
                <Coins size={20} />
              </div>
              <div>
                <span className="text-[10px] text-amber-800 font-bold uppercase tracking-wider block">Today's Gold Market Rate ₹ / gram (22K Benchmark)</span>
                <span className="text-base font-bold text-gray-900">
                  {typeof globalGoldRate === 'number' && globalGoldRate > 0
                    ? `₹ ${globalGoldRate.toLocaleString('en-IN')} / gram (22K Benchmark)`
                    : 'Enter 22K Rate Below'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-white border border-amber-300 rounded-lg px-2.5 py-1.5 shadow-inner">
                <span className="text-xs text-gray-500 font-semibold">₹</span>
                <input
                  type="number"
                  value={globalGoldRate}
                  placeholder="e.g. 6850"
                  onChange={(e) => setGlobalGoldRate(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  className="w-24 bg-transparent text-xs font-bold text-gray-900 outline-none"
                  title="Update standard rate per gram"
                />
                <span className="text-[10px] text-gray-400 font-mono">/g</span>
              </div>
              <button
                type="button"
                onClick={handleApplyGlobalRate}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition shadow"
              >
                Apply To All
              </button>
            </div>
          </div>

          {/* List of Collateral Items */}
          {goldItems.map((item, index) => (
            <div key={index} className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-6 space-y-5 relative shadow-sm">
              {goldItems.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeGoldItem(index)}
                  className="absolute top-5 right-5 text-red-500 hover:text-red-700 transition p-1"
                  title="Remove Item"
                >
                  <Trash2 size={16} />
                </button>
              )}

              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold text-[#2563EB] uppercase tracking-wider">
                  Gold Collateral Ornament #{index + 1}
                </h4>
                {item.hallmark && (
                  <span className="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-bold rounded-full uppercase flex items-center gap-1">
                    <ShieldCheck size={10} /> BIS 916 Hallmark
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4">
                <div className="space-y-1.5 lg:col-span-3">
                  <label className="text-[10px] text-gray-600 font-bold uppercase tracking-wider">Ornament Name / Type *</label>
                  <input
                    type="text"
                    placeholder="e.g. Gold Chain, Ring, Bangle"
                    value={item.name}
                    onChange={(e) => handleGoldItemChange(index, 'name', e.target.value)}
                    className="w-full bg-[#F9FAFB] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 text-xs rounded-lg px-3 py-2 outline-none font-medium"
                  />
                </div>

                <div className="space-y-1.5 lg:col-span-2">
                  <label className="text-[10px] text-gray-600 font-bold uppercase tracking-wider">Gross Weight (g) *</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 24.50"
                    value={item.grossWeight}
                    onChange={(e) => handleGoldItemChange(index, 'grossWeight', e.target.value)}
                    className="w-full bg-[#F9FAFB] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 text-xs rounded-lg px-3 py-2 outline-none font-bold"
                  />
                </div>

                <div className="space-y-1.5 lg:col-span-2">
                  <label className="text-[10px] text-gray-600 font-bold uppercase tracking-wider">Stone / Dust (g)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 0.50"
                    value={item.stoneWeight}
                    onChange={(e) => handleGoldItemChange(index, 'stoneWeight', e.target.value)}
                    className="w-full bg-[#F9FAFB] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 text-xs rounded-lg px-3 py-2 outline-none"
                  />
                </div>

                <div className="space-y-1.5 lg:col-span-5">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] text-gray-700 font-bold uppercase tracking-wider flex items-center gap-1.5">
                      Purity *
                      <span className="text-[9px] text-amber-700 font-semibold normal-case">
                        {PURITY_CONFIG[item.purity]?.fineness}
                      </span>
                    </label>
                    <span className="text-[10px] text-gray-500 font-mono">
                      Rate: <strong className="text-gray-900">
                        {typeof item.ratePerGram === 'number' && item.ratePerGram > 0
                          ? `₹${Math.round(item.ratePerGram * (PURITY_CONFIG[item.purity]?.multiplier ?? 1.0)).toLocaleString('en-IN')}/g`
                          : '—'}
                      </strong>
                    </span>
                  </div>

                  {/* Segmented Selection Control: 24K, 22K, 21K, 18K */}
                  <div className="grid grid-cols-4 gap-1 p-1 bg-gray-100/90 rounded-xl border border-gray-200">
                    {(['24K', '22K', '21K', '18K'] as const).map((karat) => {
                      const isSelected = item.purity === karat;
                      const isBenchmark = karat === '22K';

                      return (
                        <button
                          key={karat}
                          type="button"
                          onClick={() => handleGoldItemChange(index, 'purity', karat)}
                          className={`py-1.5 px-1 rounded-lg text-center transition-all flex flex-col items-center justify-center select-none ${
                            isSelected
                              ? 'bg-[#2563EB] text-white shadow-sm font-bold ring-2 ring-blue-300'
                              : 'bg-white hover:bg-gray-50 text-gray-700 font-medium border border-gray-200/80 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-bold">{karat}</span>
                            {isBenchmark && (
                              <span
                                className={`text-[8px] font-bold uppercase px-1 py-0.2 rounded ${
                                  isSelected ? 'bg-amber-300 text-amber-950' : 'bg-amber-100 text-amber-800'
                                }`}
                                title="Default Benchmark (Live Madurai Rate)"
                              >
                                BM
                              </span>
                            )}
                          </div>
                          <span
                            className={`text-[9px] leading-tight mt-0.5 truncate max-w-full ${
                              isSelected ? 'text-blue-100' : 'text-gray-400'
                            }`}
                          >
                            {isBenchmark ? 'Madurai 916' : karat === '24K' ? '99.9% Fine' : karat === '21K' ? '87.5% Gulf' : '75.0% Ornm'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Rate per Gram & Storage Bin */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-gray-600 font-bold uppercase tracking-wider">Rate per Gram (₹/g) *</label>
                  <div className="relative">
                    <input
                      type="number"
                      placeholder="e.g. 6850"
                      value={item.ratePerGram}
                      onChange={(e) => handleGoldItemChange(index, 'ratePerGram', e.target.value)}
                      className="w-full bg-[#F9FAFB] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 text-xs rounded-lg pl-6 pr-3 py-2 outline-none font-bold"
                    />
                    <span className="absolute left-2.5 top-2 text-gray-400 text-xs">₹</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-gray-600 font-bold uppercase tracking-wider">Storage Safe / Tray Bin ID</label>
                  <input
                    type="text"
                    placeholder="e.g. TRAY-01, BIN-A4"
                    value={item.storageBin}
                    onChange={(e) => handleGoldItemChange(index, 'storageBin', e.target.value)}
                    className="w-full bg-[#F9FAFB] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 text-xs rounded-lg px-3 py-2 outline-none font-mono"
                  />
                </div>

                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id={`hallmark-${index}`}
                    checked={item.hallmark}
                    onChange={(e) => handleGoldItemChange(index, 'hallmark', e.target.checked)}
                    className="w-4 h-4 text-[#2563EB] rounded accent-[#2563EB] cursor-pointer"
                  />
                  <label htmlFor={`hallmark-${index}`} className="text-xs text-gray-700 font-medium cursor-pointer">
                    BIS 916 Hallmark Stamp Verified
                  </label>
                </div>
              </div>

              {/* Photographic Evidence (2 Photos) */}
              <div className="space-y-2 pt-2 border-t border-gray-100">
                <label className="text-[10px] text-gray-600 font-bold uppercase tracking-wider block">
                  Ornament Photographic Evidence (Front & Back/Scale)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Photo 1: Front */}
                  <div className="border border-dashed border-gray-300 rounded-xl p-3 bg-gray-50/60 flex flex-col items-center justify-center min-h-[110px] relative">
                    {item.frontPhoto ? (
                      <div className="relative w-full flex items-center justify-center">
                        <img
                          src={item.frontPhoto}
                          alt="Gold Front"
                          className="h-24 w-auto object-cover rounded-lg border border-gray-200 shadow-sm"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(index, 'front')}
                          className="absolute top-0 right-0 p-1 bg-red-600 text-white rounded-full hover:bg-red-700 shadow"
                          title="Remove Photo"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center cursor-pointer w-full h-full py-2 hover:text-[#2563EB] transition">
                        <Camera size={22} className="text-gray-400 mb-1" />
                        <span className="text-[11px] font-bold text-gray-700">Photo 1: Front / Ornament View</span>
                        <span className="text-[9px] text-gray-400">Click to capture / upload photo</span>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={(e) => {
                            if (e.target.files?.[0]) handlePhotoUpload(index, 'front', e.target.files[0]);
                          }}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>

                  {/* Photo 2: Back / Scale */}
                  <div className="border border-dashed border-gray-300 rounded-xl p-3 bg-gray-50/60 flex flex-col items-center justify-center min-h-[110px] relative">
                    {item.backPhoto ? (
                      <div className="relative w-full flex items-center justify-center">
                        <img
                          src={item.backPhoto}
                          alt="Gold Back"
                          className="h-24 w-auto object-cover rounded-lg border border-gray-200 shadow-sm"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(index, 'back')}
                          className="absolute top-0 right-0 p-1 bg-red-600 text-white rounded-full hover:bg-red-700 shadow"
                          title="Remove Photo"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center cursor-pointer w-full h-full py-2 hover:text-[#2563EB] transition">
                        <Camera size={22} className="text-gray-400 mb-1" />
                        <span className="text-[11px] font-bold text-gray-700">Photo 2: Back / Hallmark / Scale View</span>
                        <span className="text-[9px] text-gray-400">Click to capture / upload photo</span>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={(e) => {
                            if (e.target.files?.[0]) handlePhotoUpload(index, 'back', e.target.files[0]);
                          }}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>

              {/* Appraisal Summary Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#F8FAFC] p-3.5 rounded-xl text-xs border border-[#E5E7EB]">
                <div>
                  <span className="text-gray-500 text-[10px] block">Net Weight:</span>
                  <span className="text-gray-900 font-bold text-sm">
                    {typeof item.netWeight === 'number' ? `${item.netWeight.toFixed(2)}g` : '—'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 text-[10px] block">Purity &amp; Effective Rate:</span>
                  <span className="text-amber-800 font-bold text-sm flex items-center gap-1">
                    {item.purity}
                    <span className="text-gray-500 font-normal text-xs">
                      {typeof item.ratePerGram === 'number' ? `@ ₹${Math.round(item.ratePerGram * (PURITY_CONFIG[item.purity]?.multiplier ?? 1.0)).toLocaleString('en-IN')}/g` : '—'}
                    </span>
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 text-[10px] block">Valuation:</span>
                  <span className="text-gray-900 font-bold text-sm">₹ {item.marketValue.toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <span className="text-gray-500 text-[10px] block">Max Eligible ({maxLtvPct}% LTV):</span>
                  <span className="text-[#2563EB] font-bold text-sm">₹ {item.maxEligibleLoan.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addGoldItem}
            className="w-full py-3 border border-dashed border-[#2563EB]/40 rounded-xl text-[#2563EB] hover:bg-[#2563EB]/5 transition flex items-center justify-center gap-2 text-xs font-bold"
          >
            <Plus size={14} />
            Appraise Additional Ornament Item
          </button>

          <div className="flex justify-between pt-6 border-t border-[#E5E7EB]">
            <button
              onClick={() => setStep(1)}
              className="px-6 py-2.5 border border-[#E5E7EB] hover:bg-[#F3F4F6] text-gray-700 text-xs font-semibold rounded-xl transition"
            >
              Back
            </button>
            <button
              onClick={() => setStep(3)}
              className="px-6 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow"
            >
              Configure Loan Terms
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: CONFIGURE TERMS */}
      {step === 3 && (
        <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-6 space-y-6 shadow-sm">
          <div className="border-b border-[#E5E7EB] pb-3">
            <h3 className="text-base font-bold text-gray-900 font-outfit">Loan Parameters & Policy Agreement</h3>
            <p className="text-xs text-gray-500">Configure disbursal principal, APR interest rate, and confirm statutory agreement.</p>
          </div>

          {/* Appraisal Valuation Info Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#F8FAFC] border border-[#E5E7EB] rounded-xl p-4">
            <div>
              <span className="text-gray-500 text-xs block">Total Collateral Value ({totalCollateralWeight.toFixed(2)}g Net):</span>
              <span className="text-xl font-bold text-gray-900">₹ {totalMarketValue.toLocaleString('en-IN')}</span>
            </div>
            <div>
              <span className="text-[#2563EB] text-xs block">Maximum Eligible Principal (100% LTV Cap):</span>
              <span className="text-xl font-bold text-[#2563EB]">₹ {totalMaxEligibility.toLocaleString('en-IN')}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-xs text-gray-700 font-bold block">Principal Loan Amount Requested (INR) *</label>
              <div className="relative">
                <input
                  type="number"
                  placeholder="Enter loan principal"
                  value={loanPrincipal}
                  onChange={(e) => {
                    setIsPrincipalCustom(true);
                    setLoanPrincipal(e.target.value === '' ? '' : parseFloat(e.target.value));
                  }}
                  className={`w-full bg-[#F9FAFB] border text-sm font-bold rounded-lg pl-7 pr-4 py-2.5 outline-none transition ${
                    typeof loanPrincipal === 'number' && loanPrincipal > totalMaxEligibility
                      ? 'border-red-500 text-red-600'
                      : 'border-[#E5E7EB] focus:border-[#2563EB] text-gray-900'
                  }`}
                />
                <span className="absolute left-2.5 top-2.5 text-gray-400 text-xs font-bold">₹</span>
              </div>
              {typeof loanPrincipal === 'number' && loanPrincipal > totalMaxEligibility ? (
                <p className="text-[10px] text-red-500 flex items-center gap-1 font-medium">
                  <AlertTriangle size={12} />
                  Requested amount exceeds maximum borrowing eligibility LTV limit.
                </p>
              ) : (
                <p className="text-[10px] text-gray-500">
                  Monthly Interest: ₹ {typeof loanPrincipal === 'number' && typeof interestApr === 'number' ? Math.round((loanPrincipal * (interestApr / 100)) / 12).toLocaleString('en-IN') : '0'} / mo
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-gray-700 font-bold block">Annual Interest Rate (APR %) *</label>
              <div className="relative">
                <select
                  value={interestApr}
                  onChange={(e) => setInterestApr(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-[#F9FAFB] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 text-sm font-bold rounded-lg pl-3 pr-9 py-2.5 outline-none transition cursor-pointer appearance-none"
                >
                  <option value="" disabled>Select Annual Interest Rate (APR %)...</option>
                  <option value={18}>18% (1.50% / month)</option>
                  <option value={20}>20% (1.67% / month)</option>
                  <option value={22}>22% (1.83% / month)</option>
                  <option value={24}>24% (2.00% / month)</option>
                  <option value={30}>30% (2.50% / month)</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                  <ChevronDown size={16} />
                </div>
              </div>
              {typeof interestApr === 'number' && interestApr > 0 ? (
                <div className="flex flex-wrap items-center justify-between text-[11px] text-blue-900 bg-blue-50/70 p-2.5 rounded-lg border border-blue-200/80 font-medium mt-1.5 gap-2">
                  <span>Monthly Rate: <strong>{(interestApr / 12).toFixed(2)}% / mo</strong></span>
                  <span>
                    Monthly Interest: <strong>₹ {typeof loanPrincipal === 'number' && loanPrincipal > 0 ? Math.round((loanPrincipal * (interestApr / 100)) / 12).toLocaleString('en-IN') : '0'} / mo</strong>
                  </span>
                  <span>
                    Daily Accrual: <strong>₹ {typeof loanPrincipal === 'number' && loanPrincipal > 0 ? ((loanPrincipal * (interestApr / 100)) / 365).toFixed(2) : '0.00'} / day</strong>
                  </span>
                </div>
              ) : (
                <p className="text-[10px] text-amber-700 font-semibold mt-1">
                  * Select one of the five approved APR rates (18%, 20%, 22%, 24%, 30%) to compute interest.
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1.5">
              <label className="text-xs text-gray-700 font-bold block">Loan Duration</label>
              <select
                value={durationDays}
                onChange={(e) => setDurationDays(parseInt(e.target.value) || 365)}
                className="w-full bg-[#F9FAFB] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 text-xs rounded-lg px-3 py-2.5 outline-none"
              >
                <option value={90}>3 Months (90 Days)</option>
                <option value={180}>6 Months (180 Days)</option>
                <option value={270}>9 Months (270 Days)</option>
                <option value={365}>12 Months (1 Year / 365 Days)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-gray-700 font-bold block">Disbursal Mode</label>
              <select
                className="w-full bg-[#F9FAFB] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 text-xs rounded-lg px-3 py-2.5 outline-none font-semibold"
                defaultValue="Cash"
              >
                <option value="Cash">Cash at Counter</option>
                <option value="UPI">Direct UPI Transfer</option>
                <option value="NEFT">Bank NEFT / RTGS</option>
              </select>
            </div>
          </div>

          {/* Terms & Conditions Checkbox */}
          <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-2">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                className="w-4 h-4 mt-0.5 text-[#2563EB] rounded accent-[#2563EB] cursor-pointer"
              />
              <span className="text-xs text-gray-700 leading-relaxed font-medium">
                I hereby verify that all gold ornaments have been physically appraised, weights inspected, and the borrower agrees to the <strong>Tamil Nadu Pawnbrokers Act pledge terms</strong>, statutory interest rate schedule, and pawn ticket agreement.
              </span>
            </label>
          </div>

          <div className="flex justify-between pt-6 border-t border-[#E5E7EB]">
            <button
              onClick={() => setStep(2)}
              className="px-6 py-2.5 border border-[#E5E7EB] hover:bg-[#F3F4F6] text-gray-700 text-xs font-semibold rounded-xl transition"
            >
              Back
            </button>
            <button
              onClick={handleSubmitLoan}
              disabled={loading || typeof loanPrincipal !== 'number' || loanPrincipal <= 0 || !agreeTerms}
              className={`px-8 py-2.5 ${typeof loanPrincipal === 'number' && loanPrincipal > totalMaxEligibility ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20' : 'bg-[#2563EB] hover:bg-[#1D4ED8] shadow-blue-600/20'} disabled:bg-gray-300 disabled:text-gray-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-2 shadow-lg`}
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Coins size={15} />
              )}
              {typeof loanPrincipal === 'number' && loanPrincipal > totalMaxEligibility
                ? 'Submit for Admin Approval (High LTV)'
                : (currentUserProfile?.role === 'Employee' || currentUserProfile?.role === 'Appraiser'
                    ? 'Submit Application for Approval'
                    : 'Disburse & Originate Loan')}
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: PRINT PAWN TICKET & BILLS GENERATED */}
      {step === 4 && (
        <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-2xl p-8 space-y-6 text-center shadow-xl">
          <div className={`w-16 h-16 ${isSubmittedForApproval ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-emerald-50 border-emerald-200 text-emerald-600'} border rounded-full flex items-center justify-center mx-auto mb-2`}>
            <CheckCircle2 size={36} />
          </div>

          <div>
            <div className={`inline-block px-3 py-1 ${isSubmittedForApproval ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'} border rounded-full text-xs font-bold uppercase tracking-wider mb-2`}>
              {isSubmittedForApproval ? 'Step 4 · Pending Approval' : 'Step 4 · Bills & Pawn Ticket'}
            </div>
            <h3 className="text-2xl font-bold text-gray-900 font-outfit">
              {isSubmittedForApproval ? 'Loan Application Submitted for Approval!' : 'Loan Originated & Disbursed!'}
            </h3>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-200 rounded-full mt-2">
              <span className="text-xs text-gray-600 font-medium">Loan Account Number:</span>
              <span className="text-xs font-bold font-mono text-[#2563EB] uppercase">{createdLoanNumber || 'PGF-LN-000000'}</span>
            </div>
            <p className="text-gray-500 text-xs max-w-md mx-auto mt-3 leading-relaxed">
              {isSubmittedForApproval ? (
                <>Loan application folder has been created with requested principal <strong>₹ {loanPrincipal.toLocaleString('en-IN')}</strong>. It is queued for Manager/Admin review and verification before disbursement.</>
              ) : (
                <>The principal of <strong>₹ {loanPrincipal.toLocaleString('en-IN')}</strong> has been successfully disbursed. The official Pawn Ticket and Loan Agreement bills have been generated.</>
              )}
            </p>
          </div>

          {/* Quick Summary Card */}
          <div className="max-w-md mx-auto bg-[#F8FAFC] border border-[#E5E7EB] rounded-xl p-5 text-left text-xs space-y-2.5 shadow-inner">
            <div className="flex justify-between border-b border-gray-200/80 pb-2">
              <span className="text-gray-500">Pledge Customer:</span>
              <span className="text-gray-900 font-bold">{selectedCustomer?.name || 'Customer'}</span>
            </div>
            <div className="flex justify-between border-b border-gray-200/80 pb-2">
              <span className="text-gray-500">Total Collateral:</span>
              <span className="text-gray-900 font-bold">
                {goldItems.length} Ornaments &middot; {totalCollateralWeight.toFixed(2)}g Net
              </span>
            </div>
            <div className="flex justify-between border-b border-gray-200/80 pb-2">
              <span className="text-gray-500">Disbursed Principal:</span>
              <span className="text-emerald-700 font-bold text-sm">₹ {loanPrincipal.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between border-b border-gray-200/80 pb-2">
              <span className="text-gray-500">Interest Rate (APR):</span>
              <span className="text-gray-900 font-bold">{typeof interestApr === 'number' ? `${interestApr}% per annum (${(interestApr / 12).toFixed(2)}%/mo)` : '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Maturity Duration:</span>
              <span className="text-[#2563EB] font-bold">{durationDays} Days</span>
            </div>
          </div>

          {/* Action Buttons for Bills & Documents */}
          <div className="pt-6 border-t border-[#E5E7EB] flex flex-wrap justify-center items-center gap-3">
            {createdLoanId && (
              <button
                type="button"
                onClick={() => setIsPreviewOpen(true)}
                className="px-6 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold rounded-xl transition flex items-center gap-2 shadow-md shadow-blue-600/20"
              >
                <Printer size={15} />
                Preview &amp; Print Bill
              </button>
            )}

            {createdLoanId && (
              <button
                type="button"
                onClick={() => {
                  downloadPdfDocument(
                    { type: 'pawn_ticket', loanId: createdLoanId },
                    `PGF_PawnTicket_${createdLoanNumber || 'Loan'}.pdf`
                  );
                }}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
              >
                <Download size={15} />
                Download Pawn Ticket PDF
              </button>
            )}

            {createdLoanId && (
              <button
                type="button"
                onClick={() => {
                  downloadPdfDocument(
                    { type: 'loan_application', loanId: createdLoanId },
                    `PGF_LoanApplication_${createdLoanNumber || 'Loan'}.pdf`
                  );
                }}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition flex items-center gap-1.5 border border-slate-300"
              >
                <FileText size={15} />
                Application Form PDF
              </button>
            )}

            {createdLoanId && (
              <button
                type="button"
                onClick={() => router.push(`/admin/loans/${createdLoanId}`)}
                className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-xl transition flex items-center gap-1.5"
              >
                <ExternalLink size={14} />
                View Loan Dossier
              </button>
            )}

            {selectedCustomer && (
              <button
                type="button"
                onClick={() => {
                  const shareMsg = `Dear ${selectedCustomer.name}, your Pavithra Gold Finance loan account ${createdLoanNumber} for Rs. ${loanPrincipal.toLocaleString('en-IN')} has been disbursed. Thank you for choosing PGF.`;
                  window.open(`https://wa.me/91${selectedCustomer.phone_primary}?text=${encodeURIComponent(shareMsg)}`, '_blank');
                }}
                className="px-5 py-2.5 bg-green-50 hover:bg-green-100 text-green-700 border border-green-300 text-xs font-bold rounded-xl transition flex items-center gap-1.5"
              >
                <MessageSquare size={14} />
                WhatsApp Borrower
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                // Reset wizard for next loan
                setSelectedCustomerId('');
                setSelectedCustomer(null);
                setCustomerSearch('');
                setCreatedLoanId('');
                setCreatedLoanNumber('');
                setStep(1);
              }}
              className="px-5 py-2.5 border border-[#E5E7EB] hover:bg-[#F3F4F6] text-gray-700 text-xs font-bold rounded-xl transition"
            >
              + Originate Another Loan
            </button>
          </div>
        </div>
      )}

      {/* PDF Document Preview Modal */}
      {createdLoanId && (
        <PDFPreviewModal
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
          pdfUrl={getPdfApiUrl({ type: 'pawn_ticket', loanId: createdLoanId })}
          title={`Official Pawn Ticket & Loan Agreement — ${createdLoanNumber}`}
        />
      )}
    </div>
  );
}

export default function NewLoanWizard() {
  return (
    <Suspense
      fallback={
        <div className="max-w-4xl mx-auto p-12 text-center text-gray-500 text-xs">
          Loading Loan Creation Wizard...
        </div>
      }
    >
      <NewLoanWizardContent />
    </Suspense>
  );
}
