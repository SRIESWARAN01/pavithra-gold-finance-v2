'use client';

import React, { useState, useEffect } from 'react';
import { Settings, Save, ShieldAlert, CheckCircle2, Server, Key, Image as ImageIcon, Briefcase, Landmark, ShieldCheck, Trash2 } from 'lucide-react';
import { isFirebaseConfigured, getCurrentProfile } from '@/lib/auth';
import { getAppConfig, updateSettingsBatch } from '@/lib/db/settings';
import { uploadCompanyAsset } from '@/lib/storage';

export default function AdminSettings() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Configuration forms parameters - 16 Company Fields
  const [companyName, setCompanyName] = useState('Pavithra Gold Finance');
  const [companyLogo, setCompanyLogo] = useState('');
  const [address, setAddress] = useState('45, Temple Street, Madurai');
  const [phone, setPhone] = useState('7094826586');
  const [email, setEmail] = useState('contact@pavithragold.com');
  const [gstNumber, setGstNumber] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [cinNumber, setCinNumber] = useState('');
  const [website, setWebsite] = useState('www.pavithragold.com');
  const [branchName, setBranchName] = useState('Madurai Main');
  const [branchCode, setBranchCode] = useState('MDU-01');
  const [description, setDescription] = useState('Premium Luxury Gold Finance Services');
  const [bankDetails, setBankDetails] = useState('Axis Bank - A/C: 912010023849501 - IFSC: UTIB0000084');
  const [upiId, setUpiId] = useState('pavithragold@upi');
  const [authorizedSignatory, setAuthorizedSignatory] = useState('Manager, Pavithra Gold Finance');
  const [companySealUrl, setCompanySealUrl] = useState('');

  // Financial Policy settings
  const [goldRate, setGoldRate] = useState<number | ''>('');
  const [goldRate24k, setGoldRate24k] = useState<number | ''>('');
  const [goldRate22k, setGoldRate22k] = useState<number | ''>('');
  const [goldRate21k, setGoldRate21k] = useState<number | ''>('');
  const [goldRate18k, setGoldRate18k] = useState<number | ''>('');
  const [baseApr, setBaseApr] = useState<number | ''>('');
  const [ltvCap, setLtvCap] = useState<number | ''>('');

  const handleGold24kChange = (val: number | '') => {
    setGoldRate24k(val);
    if (typeof val === 'number' && val > 0) {
      const r22 = Math.round((val * 22) / 24);
      const r21 = Math.round((val * 21) / 24);
      const r18 = Math.round((val * 18) / 24);
      setGoldRate22k(r22);
      setGoldRate21k(r21);
      setGoldRate18k(r18);
      setGoldRate(r22);
    }
  };

  // WhatsApp Reminder Templates
  const [waTemplate4Days, setWaTemplate4Days] = useState(
    'வணக்கம் {customer_name},\nஉங்கள் PGF Loan No: {loan_number}\nLoan due date: {due_date}\nஇன்னும் 4 நாட்களில் உங்கள் loan payment due ஆகிறது.\nசெலுத்த வேண்டிய தொகை: ₹{amount}\nதயவுசெய்து due date-க்கு முன் payment செய்யவும்.\n– Pavithra Gold Finance\nதொடர்புக்கு: {company_phone}'
  );
  const [waTemplate2Days, setWaTemplate2Days] = useState(
    'வணக்கம் {customer_name},\nஉங்கள் PGF Loan No: {loan_number}\nLoan due date: {due_date}\nஇன்னும் 2 நாட்களில் உங்கள் loan payment due ஆகிறது.\nசெலுத்த வேண்டிய தொகை: ₹{amount}\nதயவுசெய்து due date-க்கு முன் payment செய்யவும்.\n– Pavithra Gold Finance\nதொடர்புக்கு: {company_phone}'
  );
  const [waTemplate1Day, setWaTemplate1Day] = useState(
    'வணக்கம் {customer_name},\nஉங்கள் PGF Loan No: {loan_number}\nLoan due date: {due_date}\nஇன்னும் 1 நாளில் (நாளை) உங்கள் loan payment due ஆகிறது.\nசெலுத்த வேண்டிய தொகை: ₹{amount}\nதயவுசெய்து உடனடியாக payment செய்யவும்.\n– Pavithra Gold Finance\nதொடர்புக்கு: {company_phone}'
  );
  const [waTemplateDueToday, setWaTemplateDueToday] = useState(
    'வணக்கம் {customer_name},\nஉங்கள் PGF Loan No: {loan_number}\nஇன்று ({due_date}) உங்கள் loan payment due ஆகும் நாள்.\nசெலுத்த வேண்டிய தொகை: ₹{amount}\nதயவுசெய்து இன்றே payment செய்து அபராதத்தை தவிர்க்கவும்.\n– Pavithra Gold Finance\nதொடர்புக்கு: {company_phone}'
  );
  const [waTemplateOverdue, setWaTemplateOverdue] = useState(
    '⚠️ அவசர அறிவிப்பு!\nவணக்கம் {customer_name},\nஉங்கள் PGF Loan No: {loan_number}\nLoan due date: {due_date}\nஉங்கள் loan payment due காலம் கடந்துவிட்டது.\nசெலுத்த வேண்டிய தொகை: ₹{amount}\nதயவுசெய்து உடனடியாக பணம் செலுத்தி உங்கள் தங்க நகைகளை பாதுகாத்துக் கொள்ளுங்கள்.\n– Pavithra Gold Finance\nதொடர்புக்கு: {company_phone}'
  );

  // Upload States
  const [logoUploading, setLogoUploading] = useState(false);
  const [sealUploading, setSealUploading] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      try {
        const config = await getAppConfig();
        setCompanyName(config.companyName);
        setCompanyLogo(config.companyLogo);
        setAddress(config.companyAddress);
        setPhone(config.companyPhone);
        setEmail(config.companyEmail);
        setGstNumber(config.companyGst);
        setPanNumber(config.companyPan);
        setCinNumber(config.companyCin);
        setWebsite(config.companyWebsite);
        setBranchName(config.companyBranchName);
        setBranchCode(config.companyBranchCode);
        setDescription(config.companyDescription);
        setBankDetails(config.companyBankDetails);
        setUpiId(config.companyUpiId);
        setAuthorizedSignatory(config.companyAuthorizedSignatory);
        setCompanySealUrl(config.companySealUrl);
        setBaseApr(config.defaultInterestRate);
        setLtvCap(config.ltvPercentage);

        // Fetch custom templates and distinct purity rates
        const allSettings = await import('@/lib/db/settings').then(m => m.getAllSettings());
        const map = new Map(allSettings.map(s => [s.key, s.value]));

        const r24 = parseFloat(map.get('gold_rate_24k') || '10500');
        const r22 = parseFloat(map.get('gold_rate_22k') || map.get('current_gold_rate') || '9625');
        const r21 = parseFloat(map.get('gold_rate_21k') || '9188');
        const r18 = parseFloat(map.get('gold_rate_18k') || '7875');

        setGoldRate24k(r24);
        setGoldRate22k(r22);
        setGoldRate21k(r21);
        setGoldRate18k(r18);
        setGoldRate(r22);

        if (map.get('wa_template_4_days')) setWaTemplate4Days(map.get('wa_template_4_days') || '');
        if (map.get('wa_template_2_days')) setWaTemplate2Days(map.get('wa_template_2_days') || '');
        if (map.get('wa_template_1_day')) setWaTemplate1Day(map.get('wa_template_1_day') || '');
        if (map.get('wa_template_due_today')) setWaTemplateDueToday(map.get('wa_template_due_today') || '');
        if (map.get('wa_template_overdue')) setWaTemplateOverdue(map.get('wa_template_overdue') || '');
      } catch (err) {
        console.error('Failed to load system settings from Firestore:', err);
      }
    }
    loadSettings();
  }, []);

  const handleAssetUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'seal') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (type === 'logo') setLogoUploading(true);
    if (type === 'seal') setSealUploading(true);

    try {
      const url = await uploadCompanyAsset(type, file);
      if (type === 'logo') setCompanyLogo(url);
      if (type === 'seal') setCompanySealUrl(url);
    } catch (err) {
      console.error(`Failed to upload company ${type}:`, err);
      alert(`Upload failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      if (type === 'logo') setLogoUploading(false);
      if (type === 'seal') setSealUploading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);

    try {
      if (isFirebaseConfigured()) {
        const adminProfile = await getCurrentProfile();
        const updatedBy = adminProfile?.name || 'Admin';

        await updateSettingsBatch([
          { key: 'company_name', value: companyName },
          { key: 'company_logo', value: companyLogo },
          { key: 'company_address', value: address },
          { key: 'company_phone', value: phone },
          { key: 'company_email', value: email },
          { key: 'company_gst', value: gstNumber },
          { key: 'company_pan', value: panNumber },
          { key: 'company_cin', value: cinNumber },
          { key: 'company_website', value: website },
          { key: 'company_branch_name', value: branchName },
          { key: 'company_branch_code', value: branchCode },
          { key: 'company_description', value: description },
          { key: 'company_bank_details', value: bankDetails },
          { key: 'company_upi_id', value: upiId },
          { key: 'company_authorized_signatory', value: authorizedSignatory },
          ...(goldRate24k !== '' ? [{ key: 'gold_rate_24k', value: String(goldRate24k) }] : []),
          ...(goldRate22k !== '' ? [{ key: 'gold_rate_22k', value: String(goldRate22k) }, { key: 'current_gold_rate', value: String(goldRate22k) }] : []),
          ...(goldRate21k !== '' ? [{ key: 'gold_rate_21k', value: String(goldRate21k) }] : []),
          ...(goldRate18k !== '' ? [{ key: 'gold_rate_18k', value: String(goldRate18k) }] : []),
          ...(baseApr !== '' ? [{ key: 'default_interest_rate', value: String(baseApr) }] : []),
          ...(ltvCap !== '' ? [{ key: 'ltv_percentage', value: String(ltvCap) }] : []),
          { key: 'wa_template_4_days', value: waTemplate4Days },
          { key: 'wa_template_2_days', value: waTemplate2Days },
          { key: 'wa_template_1_day', value: waTemplate1Day },
          { key: 'wa_template_due_today', value: waTemplateDueToday },
          { key: 'wa_template_overdue', value: waTemplateOverdue }
        ], updatedBy);
      } else {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      setSuccess(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error(err);
      alert('Failed to save settings: ' + String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div>
        <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 tracking-wide font-outfit">System Settings</h2>
        <p className="text-gray-500 text-xs mt-1">Configure interest APR policies, gold rates, and company metadata profiles.</p>
      </div>

      {success && (
        <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-xs flex items-center gap-2">
          <CheckCircle2 size={16} />
          <span>System configurations updated and saved successfully.</span>
        </div>
      )}

      <form onSubmit={handleSaveSettings} className="space-y-6 text-xs">
        {/* Branding Profile */}
        <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-[#2563EB] font-outfit border-b border-[#E5E7EB] pb-2 flex items-center gap-2">
            <Briefcase size={16} />
            Company Profile & Branding
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-gray-500 font-medium">Company Trade Name</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 rounded-lg px-3.5 py-2 outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-gray-500 font-medium">Company Website</label>
              <input
                type="text"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 rounded-lg px-3.5 py-2 outline-none"
              />
            </div>
            <div className="col-span-1 md:col-span-2 space-y-1.5">
              <label className="text-gray-500 font-medium">Company Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 rounded-lg px-3.5 py-2 outline-none resize-none"
              />
            </div>
            
            {/* Logo Upload Slot */}
            <div className="p-4 border border-[#E5E7EB] bg-[#F8FAFC]/40 rounded-lg flex items-center gap-4">
              <div className="w-16 h-16 rounded border border-[#E5E7EB] bg-[#F3F4F6] flex items-center justify-center text-gray-400 overflow-hidden">
                {companyLogo ? (
                  <img src={companyLogo} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <ImageIcon size={24} />
                )}
              </div>
              <div className="flex-1 space-y-2">
                <span className="font-semibold text-gray-900 block">Company Logo</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleAssetUpload(e, 'logo')}
                  className="hidden"
                  id="logo-upload"
                />
                <label
                  htmlFor="logo-upload"
                  className="inline-block px-3 py-1.5 bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#2563EB] font-bold rounded border border-[#2563EB]/20 cursor-pointer text-[10px] uppercase tracking-wider transition font-outfit"
                >
                  {logoUploading ? 'Uploading...' : 'Upload Logo'}
                </label>
              </div>
            </div>

            {/* Seal Upload Slot */}
            <div className="p-4 border border-[#E5E7EB] bg-[#F8FAFC]/40 rounded-lg flex items-center gap-4">
              <div className="w-16 h-16 rounded border border-[#E5E7EB] bg-[#F3F4F6] flex items-center justify-center text-gray-400 overflow-hidden">
                {companySealUrl ? (
                  <img src={companySealUrl} alt="Seal" className="w-full h-full object-contain" />
                ) : (
                  <ImageIcon size={24} />
                )}
              </div>
              <div className="flex-1 space-y-2">
                <span className="font-semibold text-gray-900 block">Official Seal / Signature</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleAssetUpload(e, 'seal')}
                  className="hidden"
                  id="seal-upload"
                />
                <label
                  htmlFor="seal-upload"
                  className="inline-block px-3 py-1.5 bg-[#F3F4F6] hover:bg-[#E5E7EB] text-[#2563EB] font-bold rounded border border-[#2563EB]/20 cursor-pointer text-[10px] uppercase tracking-wider transition font-outfit"
                >
                  {sealUploading ? 'Uploading...' : 'Upload Seal'}
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Contacts & Branch Details */}
        <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-[#2563EB] font-outfit border-b border-[#E5E7EB] pb-2 flex items-center gap-2">
            <Server size={16} />
            Contact & Branch Settings
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-gray-500 font-medium">Business Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 rounded-lg px-3.5 py-2 outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-gray-500 font-medium">Contact Number</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 rounded-lg px-3.5 py-2 outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-gray-500 font-medium">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 rounded-lg px-3.5 py-2 outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-gray-500 font-medium">Branch Name</label>
                <input
                  type="text"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 rounded-lg px-3.5 py-2 outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-gray-500 font-medium">Branch Code</label>
                <input
                  type="text"
                  value={branchCode}
                  onChange={(e) => setBranchCode(e.target.value)}
                  className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 rounded-lg px-3.5 py-2 outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Regulatory & Taxes */}
        <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-[#2563EB] font-outfit border-b border-[#E5E7EB] pb-2 flex items-center gap-2">
            <ShieldCheck size={16} />
            Compliance & Registrations
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-gray-500 font-medium">GST Number</label>
              <input
                type="text"
                placeholder="e.g. 33AAAAA0000A1Z1"
                value={gstNumber}
                onChange={(e) => setGstNumber(e.target.value)}
                className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 rounded-lg px-3.5 py-2 outline-none font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-gray-500 font-medium">PAN Number</label>
              <input
                type="text"
                placeholder="e.g. ABCDE1234F"
                value={panNumber}
                onChange={(e) => setPanNumber(e.target.value)}
                className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 rounded-lg px-3.5 py-2 outline-none font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-gray-500 font-medium">CIN / Registration No.</label>
              <input
                type="text"
                placeholder="Corporate Identity No."
                value={cinNumber}
                onChange={(e) => setCinNumber(e.target.value)}
                className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 rounded-lg px-3.5 py-2 outline-none font-mono"
              />
            </div>
          </div>
        </div>

        {/* Banking Accounts */}
        <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-[#2563EB] font-outfit border-b border-[#E5E7EB] pb-2 flex items-center gap-2">
            <Landmark size={16} />
            Banking & Settlements
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-gray-500 font-medium">Bank Account Details</label>
              <input
                type="text"
                value={bankDetails}
                onChange={(e) => setBankDetails(e.target.value)}
                className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 rounded-lg px-3.5 py-2 outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-gray-500 font-medium">UPI Settlement ID</label>
              <input
                type="text"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 rounded-lg px-3.5 py-2 outline-none"
              />
            </div>
            <div className="col-span-1 md:col-span-2 space-y-1.5">
              <label className="text-gray-500 font-medium">Authorized Signatory Description</label>
              <input
                type="text"
                value={authorizedSignatory}
                onChange={(e) => setAuthorizedSignatory(e.target.value)}
                className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 rounded-lg px-3.5 py-2 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Financial Policy Settings */}
        <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-6 space-y-5">
          <div className="border-b border-[#E5E7EB] pb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#2563EB] font-outfit flex items-center gap-2">
              <Settings size={16} />
              Gold Rates &amp; LTV Lending Policy (Admin Controlled)
            </h3>
            <span className="text-[11px] text-gray-500 font-mono">Real-time Firebase Policy</span>
          </div>

          {/* Distinct Purity Gold Rates */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-800 uppercase tracking-wider">Standard Daily Gold Rates (₹ per gram)</span>
              <span className="text-[11px] text-[#2563EB]">Changing 24K auto-calculates 22K, 21K, and 18K tiers</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-amber-900">24K Pure Gold</span>
                  <span className="text-[10px] px-1.5 py-0.5 bg-amber-200/80 text-amber-900 rounded font-mono font-bold">999 Fine</span>
                </div>
                <input
                  type="number"
                  placeholder="10500"
                  value={goldRate24k}
                  onChange={(e) => handleGold24kChange(e.target.value === '' ? '' : parseInt(e.target.value))}
                  className="w-full bg-white border border-amber-300 focus:border-amber-600 text-gray-900 font-mono font-bold rounded-lg px-3 py-1.5 outline-none text-sm"
                />
              </div>

              <div className="p-3 bg-yellow-50/70 border border-yellow-200 rounded-xl space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-yellow-900">22K Standard</span>
                  <span className="text-[10px] px-1.5 py-0.5 bg-yellow-200/80 text-yellow-900 rounded font-mono font-bold">916 Hallmark</span>
                </div>
                <input
                  type="number"
                  placeholder="9625"
                  value={goldRate22k}
                  onChange={(e) => {
                    const val = e.target.value === '' ? '' : parseInt(e.target.value);
                    setGoldRate22k(val);
                    setGoldRate(val);
                  }}
                  className="w-full bg-white border border-yellow-300 focus:border-yellow-600 text-gray-900 font-mono font-bold rounded-lg px-3 py-1.5 outline-none text-sm"
                />
              </div>

              <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-blue-900">21K Arabian</span>
                  <span className="text-[10px] px-1.5 py-0.5 bg-blue-200/80 text-blue-900 rounded font-mono font-bold">875 Gulf</span>
                </div>
                <input
                  type="number"
                  placeholder="9188"
                  value={goldRate21k}
                  onChange={(e) => setGoldRate21k(e.target.value === '' ? '' : parseInt(e.target.value))}
                  className="w-full bg-white border border-blue-300 focus:border-blue-600 text-gray-900 font-mono font-bold rounded-lg px-3 py-1.5 outline-none text-sm"
                />
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-800">18K Ornament</span>
                  <span className="text-[10px] px-1.5 py-0.5 bg-slate-200 text-slate-800 rounded font-mono font-bold">750 Modern</span>
                </div>
                <input
                  type="number"
                  placeholder="7875"
                  value={goldRate18k}
                  onChange={(e) => setGoldRate18k(e.target.value === '' ? '' : parseInt(e.target.value))}
                  className="w-full bg-white border border-slate-300 focus:border-slate-600 text-gray-900 font-mono font-bold rounded-lg px-3 py-1.5 outline-none text-sm"
                />
              </div>
            </div>
          </div>

          {/* LTV and APR Configuration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-gray-700 text-xs font-bold uppercase tracking-wider">Max Safe LTV (% Cap)</label>
                <div className="flex gap-1">
                  {[75, 80, 95].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setLtvCap(preset)}
                      className={`px-2 py-0.5 text-[11px] rounded font-bold border transition ${
                        ltvCap === preset
                          ? 'bg-[#2563EB] text-white border-[#2563EB]'
                          : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200'
                      }`}
                    >
                      {preset}% LTV
                    </button>
                  ))}
                </div>
              </div>
              <input
                type="number"
                placeholder="75"
                value={ltvCap}
                onChange={(e) => setLtvCap(e.target.value === '' ? '' : parseInt(e.target.value))}
                className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 rounded-lg px-3.5 py-2 outline-none font-bold"
              />
              {typeof goldRate24k === 'number' && typeof ltvCap === 'number' && (
                <div className="text-[11px] text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-2 leading-relaxed">
                  <strong>Live Lending Formula:</strong> Net Wt × Gold Rate × {ltvCap}% LTV
                  <br />
                  At ₹{goldRate24k.toLocaleString('en-IN')}/g: <strong>{ltvCap}% LTV = ₹{Math.round((goldRate24k * ltvCap) / 100).toLocaleString('en-IN')}/g</strong>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-gray-700 text-xs font-bold uppercase tracking-wider block">Default Annual APR (%)</label>
              <input
                type="number"
                step="0.01"
                placeholder="12.00"
                value={baseApr}
                onChange={(e) => setBaseApr(e.target.value === '' ? '' : parseFloat(e.target.value))}
                className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 rounded-lg px-3.5 py-2 outline-none font-bold"
              />
              <span className="text-[11px] text-gray-500 block">
                Standard annual borrowing percentage. {typeof baseApr === 'number' && `(${ (baseApr / 12).toFixed(2) }% per month)`}
              </span>
            </div>
          </div>
        </div>

        {/* WhatsApp Loan Due Reminder Templates */}
        <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-6 space-y-4">
          <div className="flex justify-between items-center border-b border-[#E5E7EB] pb-2">
            <h3 className="text-sm font-semibold text-[#2563EB] font-outfit flex items-center gap-2">
              <Key size={16} />
              WhatsApp Loan Due Reminder Templates
            </h3>
            <span className="text-[10px] text-gray-400 font-mono">
              Tags: {'{customer_name}'}, {'{loan_number}'}, {'{due_date}'}, {'{amount}'}, {'{company_phone}'}
            </span>
          </div>

          <div className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <label className="text-gray-700 font-bold block">4 Days Before Due Date Template (Tamil / English)</label>
              <textarea
                rows={4}
                value={waTemplate4Days}
                onChange={(e) => setWaTemplate4Days(e.target.value)}
                className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 rounded-lg p-3 outline-none font-mono text-[11px]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-gray-700 font-bold block">2 Days Before Due Date Template</label>
              <textarea
                rows={4}
                value={waTemplate2Days}
                onChange={(e) => setWaTemplate2Days(e.target.value)}
                className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 rounded-lg p-3 outline-none font-mono text-[11px]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-gray-700 font-bold block">1 Day Before (Tomorrow) Due Date Template</label>
              <textarea
                rows={4}
                value={waTemplate1Day}
                onChange={(e) => setWaTemplate1Day(e.target.value)}
                className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 rounded-lg p-3 outline-none font-mono text-[11px]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-gray-700 font-bold block">Due Today Payment Reminder Template</label>
              <textarea
                rows={4}
                value={waTemplateDueToday}
                onChange={(e) => setWaTemplateDueToday(e.target.value)}
                className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 rounded-lg p-3 outline-none font-mono text-[11px]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-gray-700 font-bold block text-red-600">Overdue Urgent Alert Template</label>
              <textarea
                rows={4}
                value={waTemplateOverdue}
                onChange={(e) => setWaTemplateOverdue(e.target.value)}
                className="w-full bg-red-50/40 border border-red-200 focus:border-red-400 text-gray-900 rounded-lg p-3 outline-none font-mono text-[11px]"
              />
            </div>
          </div>
        </div>

        {/* Database Maintenance & Deduplication Engine */}
        <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-6 space-y-4 shadow-sm">
          <h3 className="text-sm font-semibold text-[#2563EB] font-outfit border-b border-[#E5E7EB] pb-2 flex items-center gap-2">
            <ShieldCheck size={16} className="text-emerald-600" />
            Database Maintenance & Deduplication Engine
          </h3>
          <p className="text-xs text-gray-500">
            Scans Cloud Firestore for duplicate customer profiles (matched by Phone, Aadhaar, PAN), redundant branch codes, duplicate payment receipts, and demo artifacts. Cleans and consolidates them automatically.
          </p>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
            <div>
              <span className="font-bold text-gray-900 text-xs block">Automated Data Deduplication & Sanitization</span>
              <span className="text-[11px] text-gray-500">Eliminates duplicate client files, branch collisions, and duplicate payment logs.</span>
            </div>
            <button
              type="button"
              onClick={async () => {
                try {
                  setLoading(true);
                  const { cleanDuplicateRecords } = await import('@/lib/db/cleanup');
                  const res = await cleanDuplicateRecords();
                  const totalCleaned = res.duplicateProfilesRemoved + res.duplicateBranchesRemoved + res.duplicatePaymentsRemoved + res.duplicateJournalsRemoved;
                  alert(`Deduplication Complete!\n\n• Duplicate Customer Profiles Removed: ${res.duplicateProfilesRemoved}\n• Duplicate Branches Removed: ${res.duplicateBranchesRemoved}\n• Duplicate Payments Cleaned: ${res.duplicatePaymentsRemoved}\n• Duplicate Journals Cleaned: ${res.duplicateJournalsRemoved}\n\nTotal Records Cleaned: ${totalCleaned}`);
                } catch (err: any) {
                  alert(`Deduplication Error: ${err?.message || 'Failed to clean duplicate records'}`);
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
              className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <ShieldCheck size={14} />
              Scan & Remove Duplicate Records
            </button>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-rose-50/60 p-4 rounded-xl border border-rose-200">
            <div>
              <span className="font-bold text-red-900 text-xs block">Permanent Demo Data Purge</span>
              <span className="text-[11px] text-red-600">Permanently scans and purges all demo profiles, mock loans, test payments, and demo artifacts from Cloud Firestore.</span>
            </div>
            <button
              type="button"
              onClick={async () => {
                if (!confirm('Are you sure you want to permanently delete all demo data and mock records from the database? This cannot be undone.')) return;
                try {
                  setLoading(true);
                  const { purgeAllDemoData } = await import('@/lib/db/cleanup');
                  const res = await purgeAllDemoData();
                  const totalPurged = res.profilesDeleted + res.loansDeleted + res.goldItemsDeleted + res.paymentsDeleted + res.journalsDeleted + res.documentsDeleted + res.notificationsDeleted + res.auditLogsDeleted;
                  alert(`Demo Data Purged Successfully!\n\n• Demo Profiles Deleted: ${res.profilesDeleted}\n• Demo Loans Deleted: ${res.loansDeleted}\n• Demo Gold Collateral Deleted: ${res.goldItemsDeleted}\n• Demo Payments Deleted: ${res.paymentsDeleted}\n• Demo Accounting Journals Deleted: ${res.journalsDeleted}\n• Demo Documents & Logs Deleted: ${res.documentsDeleted + res.notificationsDeleted + res.auditLogsDeleted}\n\nTotal Demo Records Deleted: ${totalPurged}`);
                } catch (err: any) {
                  alert(`Purge Error: ${err?.message || 'Failed to purge demo records'}`);
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
              className="px-5 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <Trash2 size={14} />
              Purge All Demo Data
            </button>
          </div>
        </div>

        {/* Security & Backup policy */}
        <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-6 space-y-4 shadow-sm">
          <h3 className="text-sm font-semibold text-[#2563EB] font-outfit border-b border-[#E5E7EB] pb-2 flex items-center gap-2">
            <ShieldAlert size={16} />
            Backup & Export Policies
          </h3>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-[#F8FAFC]/50 p-4 rounded-lg border border-[#E5E7EB]">
            <div>
              <span className="font-semibold text-gray-900 block text-xs">Cloud Firestore Daily Ledger Backups</span>
              <span className="text-[10px] text-gray-400">Continuous enterprise state protection active.</span>
            </div>
            <button
              type="button"
              onClick={() => window.open('/admin/reports', '_blank')}
              className="px-4 py-2 rounded-lg bg-[#F3F4F6] border border-[#2563EB]/20 text-[#2563EB] font-semibold text-xs hover:bg-[#E5E7EB] transition-all"
            >
              Open Reports Center & Enterprise Backup
            </button>
          </div>
        </div>

        {/* Save button */}
        <div className="flex justify-end pt-4 border-t border-[#E5E7EB]">
          <button
            type="submit"
            disabled={loading}
            className="px-8 py-2.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-[#2563EB]/35 text-[#F8FAFC] text-xs font-bold transition flex items-center gap-1.5 shadow"
          >
            {loading ? (
              <div className="w-3.5 h-3.5 border-2 border-[#F8FAFC] border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <Save size={14} />
            )}
            Save Configuration Settings
          </button>
        </div>
      </form>
    </div>
  );
}
