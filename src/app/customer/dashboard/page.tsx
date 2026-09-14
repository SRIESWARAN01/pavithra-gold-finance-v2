'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isFirebaseConfigured, getCurrentProfile } from '@/lib/auth';
import { getActiveLoansByCustomer } from '@/lib/db/loans';
import { getGoldByCustomer } from '@/lib/db/gold';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import CustomerQRCode from '@/components/CustomerQRCode';
import PDFPreviewModal from '@/components/PDFPreviewModal';
import { getPdfApiUrl, downloadPdfDocument } from '@/lib/pdfHelper';
import {
  Coins,
  Calendar,
  Percent,
  Download,
  History,
  Image as ImageIcon,
  Bell,
  CheckCircle,
  HelpCircle,
  QrCode,
  Shield,
  CreditCard,
  FileText,
  Printer,
  ChevronRight,
  TrendingUp,
  X,
  Maximize2,
  Sparkles,
  ArrowUpRight
} from 'lucide-react';

export default function CustomerDashboard() {
  const router = useRouter();
  const [customerProfile, setCustomerProfile] = useState({ id: '', name: '', phone: '', customerNumber: '' });
  const [loans, setLoans] = useState<any[]>([]);
  const [activeLoanIndex, setActiveLoanIndex] = useState(0);
  const [goldCollateral, setGoldCollateral] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // PDF Preview State
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');

  // Photo Lightbox State
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxPhotos, setLightboxPhotos] = useState<{ url: string; label: string }[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxTitle, setLightboxTitle] = useState('');

  // Tabs & Simulators
  const [activeTab, setActiveTab] = useState<'collateral' | 'loans' | 'qrpass' | 'simulator'>('collateral');
  const [simRepayment, setSimRepayment] = useState(5000);

  // Load customer data when component mounts
  useEffect(() => {
    async function loadCustomerData() {
      setLoading(true);
      try {
        if (!isFirebaseConfigured()) return;

        const profile = await getCurrentProfile();
        if (!profile) return;

        setCustomerProfile({
          id: profile.id,
          name: profile.name,
          phone: profile.phone_primary,
          customerNumber: profile.customer_number || `PGF-CUST-${profile.id.substring(0, 6).toUpperCase()}`
        });

        // 1. Fetch all active loans
        const activeLoans = await getActiveLoansByCustomer(profile.id);
        setLoans(activeLoans);

        // 2. Fetch all pledged gold collateral
        const allGold = await getGoldByCustomer(profile.id);
        setGoldCollateral(allGold);

      } catch (err) {
        console.error('Failed to load customer dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadCustomerData();
  }, []);

  const activeLoan = loans[activeLoanIndex] || loans[0] || null;

  // Real-time listener on the active loan
  useEffect(() => {
    if (!activeLoan?.id) return;

    const unsubscribe = onSnapshot(doc(db, 'loans', activeLoan.id), (snapshot) => {
      if (snapshot.exists()) {
        const updated = snapshot.data();
        setLoans((prev) =>
          prev.map((l) =>
            l.id === activeLoan.id ? { ...l, ...updated } : l
          )
        );
      }
    });

    return () => unsubscribe();
  }, [activeLoan?.id]);

  // Aggregate metrics across all loans
  const totalPrincipalTaken = loans.reduce((acc, l) => acc + (l.principal_amount || 0), 0);
  const totalPrincipalPaid = loans.reduce((acc, l) => acc + (l.total_principal_paid || 0), 0);
  const remainingPrincipal = Math.max(0, totalPrincipalTaken - totalPrincipalPaid);
  const totalAccruedInterestDue = loans.reduce((acc, l) => acc + (l.outstanding_interest || 0), 0);
  const totalRedemptiveBalance = remainingPrincipal + totalAccruedInterestDue;
  const totalNetGoldWeight = goldCollateral.reduce((acc, g) => acc + (g.net_weight || 0), 0);
  const totalGoldValuation = goldCollateral.reduce((acc, g) => acc + (g.valuation_inr || 0), 0);

  // Photo viewer modal opener
  const openPhotos = (item: any) => {
    const photos: { url: string; label: string }[] = [];
    if (item.front_photo_url) photos.push({ url: item.front_photo_url, label: 'Front Scale View' });
    if (item.back_photo_url) photos.push({ url: item.back_photo_url, label: 'Back View' });
    if (item.side_photo_url) photos.push({ url: item.side_photo_url, label: 'Hallmark / Assay View' });

    if (item.photos && Array.isArray(item.photos)) {
      item.photos.forEach((p: any, idx: number) => {
        if (p.photo_url) photos.push({ url: p.photo_url, label: `Vault Inspection #${idx + 1}` });
      });
    }

    if (photos.length === 0) {
      alert('Physical photo on secure vault file. Visit branch to inspect.');
      return;
    }

    setLightboxTitle(item.item_description || 'Pledged Gold Jewellery');
    setLightboxPhotos(photos);
    setLightboxIndex(0);
    setLightboxOpen(true);
  };

  // Payment simulator logic
  const simInterestCleared = Math.min(simRepayment, totalAccruedInterestDue);
  const simPrincipalCleared = Math.min(Math.max(0, simRepayment - simInterestCleared), remainingPrincipal);
  const simRemainingPrincipal = Math.max(0, remainingPrincipal - simPrincipalCleared);
  const simRemainingInterest = Math.max(0, totalAccruedInterestDue - simInterestCleared);

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Top Welcome & Gold Rate Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-[#2563EB] font-bold tracking-widest uppercase font-mono bg-blue-50 px-2 py-0.5 rounded">
              Verified Customer Portal
            </span>
            <span className="text-[10px] text-gray-400 font-mono">
              ID: {customerProfile.customerNumber}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-wide font-outfit mt-1">
            Vanakam, {customerProfile.name || 'Valued Customer'}
          </h2>
        </div>

        {/* Live Gold Market Ticker */}
        <div className="flex items-center gap-2 bg-amber-50/80 border border-amber-200/80 px-3.5 py-1.5 rounded-xl shadow-xs">
          <Sparkles size={14} className="text-amber-600" />
          <div className="text-right">
            <span className="text-[9px] text-amber-800 font-bold uppercase tracking-wider block">Today&apos;s Gold Rate</span>
            <span className="text-xs font-bold text-amber-900 font-mono">₹5,400 / gram (22K)</span>
          </div>
        </div>
      </div>

      {/* Primary Financial Overview Hero Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Due To Pay Now */}
        <div className="bg-gradient-to-br from-rose-50 to-white border-2 border-rose-200/80 rounded-2xl p-5 shadow-xs relative overflow-hidden space-y-2">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider font-mono">
              Interest Due To Pay Now
            </span>
            <span className="p-1.5 bg-rose-100 text-rose-600 rounded-lg">
              <Calendar size={14} />
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-rose-700 font-outfit">
            ₹{totalAccruedInterestDue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
          <p className="text-[11px] text-gray-500">
            Due on: <span className="font-semibold text-gray-800">{activeLoan?.maturity_date?.split('T')[0] || 'Monthly Due'}</span>
          </p>
          <button
            onClick={() => router.push('/customer/payments')}
            className="w-full mt-2 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <CreditCard size={13} />
            Pay Interest Online
          </button>
        </div>

        {/* Card 2: Total Loan Taken */}
        <div className="bg-gradient-to-br from-blue-50 to-white border border-blue-200/80 rounded-2xl p-5 shadow-xs relative overflow-hidden space-y-2">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider font-mono">
              Total Principal Taken
            </span>
            <span className="p-1.5 bg-blue-100 text-blue-600 rounded-lg">
              <Coins size={14} />
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-blue-900 font-outfit">
            ₹{totalPrincipalTaken.toLocaleString('en-IN')}
          </div>
          <div className="flex justify-between text-[11px] text-gray-500 pt-1">
            <span>Active Loans: <b className="text-gray-900">{loans.length}</b></span>
            <span>Repaid: <b className="text-emerald-600">₹{totalPrincipalPaid.toLocaleString('en-IN')}</b></span>
          </div>
          <div className="w-full bg-blue-100 rounded-full h-1.5 overflow-hidden mt-1">
            <div
              className="bg-blue-600 h-full rounded-full"
              style={{ width: `${totalPrincipalTaken > 0 ? (totalPrincipalPaid / totalPrincipalTaken) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* Card 3: Pledged Gold Vault Security */}
        <div className="bg-gradient-to-br from-amber-50 to-white border border-amber-200/80 rounded-2xl p-5 shadow-xs relative overflow-hidden space-y-2">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider font-mono">
              Gold Secured in Vault
            </span>
            <span className="p-1.5 bg-amber-100 text-amber-700 rounded-lg">
              <Shield size={14} />
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-amber-900 font-outfit">
            {totalNetGoldWeight.toFixed(2)}g
          </div>
          <div className="flex justify-between text-[11px] text-gray-500 pt-1">
            <span>Ornaments: <b className="text-gray-900">{goldCollateral.length} Items</b></span>
            <span>Market Val: <b className="text-amber-800">₹{totalGoldValuation.toLocaleString('en-IN')}</b></span>
          </div>
          <button
            onClick={() => setActiveTab('collateral')}
            className="w-full mt-2 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <ImageIcon size={13} />
            View Jewellery & Photos
          </button>
        </div>
      </div>

      {/* Official PDF Document Action Hub */}
      {activeLoan && (
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex justify-between items-center border-b border-gray-100 pb-3">
            <div>
              <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                <FileText size={15} className="text-[#2563EB]" />
                Official Loan Documents & Download Hub
              </h3>
              <p className="text-[11px] text-gray-400">Download government-compliant bills, pawn tickets, and statements.</p>
            </div>
            <span className="text-[10px] font-mono text-blue-600 font-bold bg-blue-50 px-2.5 py-1 rounded-lg">
              Account: {activeLoan.loan_number}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* 1. Pawn Ticket */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 flex flex-col justify-between space-y-3 hover:border-blue-300 transition">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                  <Printer size={16} />
                </div>
                <div>
                  <span className="text-xs font-bold text-gray-900 block">Pawn Ticket PDF</span>
                  <span className="text-[10px] text-gray-400">Official Pledge Certificate</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setPreviewUrl(getPdfApiUrl({ type: 'ticket', loanId: activeLoan.id }));
                    setPreviewTitle(`Pawn Ticket - ${activeLoan.loan_number}`);
                    setPreviewOpen(true);
                  }}
                  className="flex-1 py-1.5 bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 rounded-lg text-xs font-bold text-center transition"
                >
                  Preview
                </button>
                <button
                  onClick={() => downloadPdfDocument({ type: 'ticket', loanId: activeLoan.id }, `PGF_PawnTicket_${activeLoan.loan_number}.pdf`)}
                  className="flex-1 py-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg text-xs font-bold text-center transition flex items-center justify-center gap-1"
                >
                  <Download size={11} /> Download
                </button>
              </div>
            </div>

            {/* 2. Loan Application Form */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 flex flex-col justify-between space-y-3 hover:border-amber-300 transition">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-100 text-amber-700 rounded-lg">
                  <FileText size={16} />
                </div>
                <div>
                  <span className="text-xs font-bold text-gray-900 block">Application Form</span>
                  <span className="text-[10px] text-gray-400">KYC & Gold Appraisal</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setPreviewUrl(getPdfApiUrl({ type: 'loan_application', loanId: activeLoan.id }));
                    setPreviewTitle(`Loan Application - ${activeLoan.loan_number}`);
                    setPreviewOpen(true);
                  }}
                  className="flex-1 py-1.5 bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 rounded-lg text-xs font-bold text-center transition"
                >
                  Preview
                </button>
                <button
                  onClick={() => downloadPdfDocument({ type: 'loan_application', loanId: activeLoan.id }, `PGF_Application_${activeLoan.loan_number}.pdf`)}
                  className="flex-1 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold text-center transition flex items-center justify-center gap-1"
                >
                  <Download size={11} /> Download
                </button>
              </div>
            </div>

            {/* 3. Account Statement */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3.5 flex flex-col justify-between space-y-3 hover:border-indigo-300 transition">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg">
                  <History size={16} />
                </div>
                <div>
                  <span className="text-xs font-bold text-gray-900 block">Account Statement</span>
                  <span className="text-[10px] text-gray-400">Full Ledger & Repayments</span>
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <button
                  onClick={() => router.push('/customer/statement')}
                  className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold text-center transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <FileText size={12} /> View Live Statement
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setPreviewUrl(getPdfApiUrl({ type: 'customer_statement', customerId: customerProfile.id }));
                      setPreviewTitle(`Customer Statement - ${customerProfile.name}`);
                      setPreviewOpen(true);
                    }}
                    className="flex-1 py-1 bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 rounded text-[11px] font-semibold text-center transition"
                  >
                    Preview
                  </button>
                  <button
                    onClick={() => downloadPdfDocument({ type: 'customer_statement', customerId: customerProfile.id }, `PGF_Statement_${customerProfile.customerNumber}.pdf`)}
                    className="flex-1 py-1 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded text-[11px] font-semibold text-center transition flex items-center justify-center gap-1"
                  >
                    <Download size={11} /> PDF
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-200 text-xs font-bold overflow-x-auto">
        <button
          onClick={() => setActiveTab('collateral')}
          className={`py-3 px-5 transition border-b-2 cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'collateral'
              ? 'text-[#2563EB] border-[#2563EB] bg-blue-50/50'
              : 'text-gray-500 border-transparent hover:text-gray-900'
          }`}
        >
          <Coins size={15} />
          Pledged Gold Jewellery ({goldCollateral.length})
        </button>

        <button
          onClick={() => setActiveTab('loans')}
          className={`py-3 px-5 transition border-b-2 cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'loans'
              ? 'text-[#2563EB] border-[#2563EB] bg-blue-50/50'
              : 'text-gray-500 border-transparent hover:text-gray-900'
          }`}
        >
          <History size={15} />
          Active Loans Dossier ({loans.length})
        </button>

        <button
          onClick={() => setActiveTab('simulator')}
          className={`py-3 px-5 transition border-b-2 cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'simulator'
              ? 'text-[#2563EB] border-[#2563EB] bg-blue-50/50'
              : 'text-gray-500 border-transparent hover:text-gray-900'
          }`}
        >
          <TrendingUp size={15} />
          Repayment Calculator
        </button>

        <button
          onClick={() => setActiveTab('qrpass')}
          className={`py-3 px-5 transition border-b-2 cursor-pointer flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'qrpass'
              ? 'text-[#2563EB] border-[#2563EB] bg-blue-50/50'
              : 'text-gray-500 border-transparent hover:text-gray-900'
          }`}
        >
          <QrCode size={15} />
          Digital Identity Pass
        </button>
      </div>

      {/* TAB 1: PLEDGED GOLD JEWELLERY SHOWCASE WITH PHOTOS */}
      {activeTab === 'collateral' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-gray-900 font-outfit">Pledged Gold Ornaments & Vault Custody</h3>
              <p className="text-[11px] text-gray-500">Every item is weighed, appraised, and sealed in bank-grade safe trays.</p>
            </div>
            <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-xl font-mono">
              Total Net Wt: {totalNetGoldWeight.toFixed(2)}g
            </span>
          </div>

          {goldCollateral.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center text-gray-400 text-xs">
              <Coins size={32} className="mx-auto text-gray-300 mb-2" />
              <p>No gold items currently logged under this account.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {goldCollateral.map((item) => {
                const photosCount = (item.front_photo_url ? 1 : 0) + (item.back_photo_url ? 1 : 0) + (item.photos?.length || 0);
                const coverPhoto = item.front_photo_url || item.back_photo_url || item.photos?.[0]?.photo_url;

                return (
                  <div
                    key={item.id}
                    className="bg-white border border-[#E5E7EB] hover:border-blue-400 transition-all rounded-2xl p-4 space-y-3 shadow-xs"
                  >
                    <div className="flex gap-3">
                      {/* Photo Thumbnail */}
                      <div
                        onClick={() => openPhotos(item)}
                        className="w-24 h-24 rounded-xl bg-gray-100 border border-gray-200 flex-shrink-0 relative overflow-hidden cursor-pointer group flex items-center justify-center"
                      >
                        {coverPhoto ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={coverPhoto}
                              alt={item.item_description}
                              className="w-full h-full object-cover group-hover:scale-105 transition"
                            />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                              <Maximize2 size={16} />
                            </div>
                            <span className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/70 text-white text-[9px] rounded font-mono font-bold">
                              {photosCount} photos
                            </span>
                          </>
                        ) : (
                          <div className="text-center p-2 text-gray-400">
                            <Coins size={20} className="mx-auto text-amber-600 mb-1" />
                            <span className="text-[9px] block">Vault Deposit</span>
                          </div>
                        )}
                      </div>

                      {/* Item Details */}
                      <div className="flex-1 space-y-1">
                        <div className="flex justify-between items-start">
                          <h4 className="text-xs font-bold text-gray-900 leading-snug">
                            {item.item_description || item.ornament_type}
                          </h4>
                          <span className="px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-bold rounded-md">
                            {item.purity_karat || '22K'}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-500 font-mono">
                          Tray / Bin: <b className="text-gray-700">{item.storage_bin_id || 'VAULT-01'}</b>
                        </p>
                        <p className="text-[10px] text-gray-500 font-mono">
                          Hallmark: <b className="text-emerald-700">{item.hallmark_number || 'BIS 916 Verified'}</b>
                        </p>
                        <p className="text-xs font-bold text-blue-900 pt-0.5">
                          Valuation: ₹{(item.valuation_inr || 0).toLocaleString('en-IN')}
                        </p>
                      </div>
                    </div>

                    {/* Weight Breakdown Metric Grid */}
                    <div className="grid grid-cols-3 gap-2 bg-gray-50 p-2.5 rounded-xl text-center text-xs border border-gray-100">
                      <div>
                        <span className="text-[9px] text-gray-400 uppercase font-mono block">Gross Wt</span>
                        <span className="font-bold text-gray-800">{item.gross_weight?.toFixed(2) || '0.00'}g</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-gray-400 uppercase font-mono block">Stone Wt</span>
                        <span className="font-bold text-gray-800">{item.stone_weight?.toFixed(2) || '0.00'}g</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-blue-600 uppercase font-mono font-bold block">Net Pure Wt</span>
                        <span className="font-bold text-[#2563EB]">{item.net_weight?.toFixed(2) || '0.00'}g</span>
                      </div>
                    </div>

                    {/* Action */}
                    <button
                      onClick={() => openPhotos(item)}
                      className="w-full py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <ImageIcon size={13} className="text-blue-600" />
                      Inspect Jewellery Photos ({photosCount})
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ACTIVE LOANS DOSSIER */}
      {activeTab === 'loans' && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-gray-900 font-outfit">Active Gold Loan Pledges</h3>
          <div className="space-y-3">
            {loans.map((ln, idx) => {
              const rem = Math.max(0, (ln.principal_amount || 0) - (ln.total_principal_paid || 0));
              const outInt = ln.outstanding_interest || 0;

              return (
                <div
                  key={ln.id}
                  className={`bg-white border rounded-2xl p-5 space-y-3 transition ${
                    activeLoanIndex === idx ? 'border-[#2563EB] ring-1 ring-blue-500' : 'border-gray-200'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-gray-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-blue-900">{ln.loan_number}</span>
                      <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-bold">
                        {ln.status || 'Active'}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      Disbursed: {ln.origination_date?.split('T')[0] || 'Recent'} | Due: {ln.maturity_date?.split('T')[0] || '12 Months'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-gray-400 text-[10px] block">Sanctioned Principal</span>
                      <span className="font-bold font-mono text-gray-900">₹{(ln.principal_amount || 0).toLocaleString('en-IN')}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 text-[10px] block">Remaining Principal</span>
                      <span className="font-bold font-mono text-amber-700">₹{rem.toLocaleString('en-IN')}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 text-[10px] block">Accrued Interest Due</span>
                      <span className="font-bold font-mono text-rose-600">₹{outInt.toLocaleString('en-IN')}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 text-[10px] block">Annual APR Rate</span>
                      <span className="font-bold font-mono text-blue-600">{ln.interest_rate_apr || 12}% p.a.</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                    <button
                      onClick={() => router.push(`/customer/loans/${ln.id}`)}
                      className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl text-xs transition flex items-center gap-1"
                    >
                      View Loan Details & Statements <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: REPAYMENT SPLIT SIMULATOR */}
      {activeTab === 'simulator' && (
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 shadow-xs space-y-5">
          <div>
            <h3 className="text-sm font-bold text-gray-900 font-outfit">Interactive Repayment Split Simulator</h3>
            <p className="text-[11px] text-gray-500 mt-0.5">
              Enter any repayment amount to see how our ledger allocates funds (Interest cleared first, then Principal reduction).
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs">
              <label className="font-bold text-gray-700">Simulated Repayment Amount:</label>
              <span className="font-mono text-base font-bold text-blue-700">₹{simRepayment.toLocaleString('en-IN')}</span>
            </div>
            <input
              type="range"
              min={500}
              max={Math.max(25000, totalRedemptiveBalance)}
              step={500}
              value={simRepayment}
              onChange={(e) => setSimRepayment(parseInt(e.target.value) || 0)}
              className="w-full accent-[#2563EB] cursor-pointer"
            />
            <div className="flex gap-2 pt-2">
              {[2000, 5000, 10000, totalAccruedInterestDue, totalRedemptiveBalance].map((preset, i) => (
                <button
                  key={i}
                  onClick={() => setSimRepayment(Math.round(preset))}
                  className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[10px] font-bold rounded-lg transition"
                >
                  ₹{Math.round(preset).toLocaleString('en-IN')}
                </button>
              ))}
            </div>
          </div>

          {/* Allocation Matrix Breakdown */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-gray-50 p-4 rounded-xl border border-gray-200 font-mono text-xs">
            <div>
              <span className="text-[10px] text-gray-400 block">Interest Cleared</span>
              <span className="text-emerald-700 font-bold text-sm">₹{simInterestCleared.toLocaleString('en-IN')}</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 block">Principal Reduced</span>
              <span className="text-blue-700 font-bold text-sm">₹{simPrincipalCleared.toLocaleString('en-IN')}</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 block">New Principal Bal</span>
              <span className="text-gray-900 font-bold text-sm">₹{simRemainingPrincipal.toLocaleString('en-IN')}</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-400 block">Remaining Interest</span>
              <span className="text-rose-600 font-bold text-sm">₹{simRemainingInterest.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: DIGITAL QR PASS */}
      {activeTab === 'qrpass' && (
        <div className="max-w-md mx-auto">
          <CustomerQRCode
            customerNumber={customerProfile.customerNumber}
            customerName={customerProfile.name}
            phone={customerProfile.phone}
          />
        </div>
      )}

      {/* PHOTO LIGHTBOX MODAL */}
      {lightboxOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl space-y-3 p-5 text-white">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h4 className="text-sm font-bold">{lightboxTitle}</h4>
                <p className="text-[10px] text-gray-400">
                  {lightboxPhotos[lightboxIndex]?.label} ({lightboxIndex + 1} of {lightboxPhotos.length})
                </p>
              </div>
              <button onClick={() => setLightboxOpen(false)} className="text-gray-400 hover:text-white p-1 rounded-lg">
                <X size={18} />
              </button>
            </div>

            {/* Main Photo Viewport */}
            <div className="w-full h-80 sm:h-96 bg-black rounded-xl overflow-hidden flex items-center justify-center relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lightboxPhotos[lightboxIndex]?.url}
                alt="Jewellery Photo"
                className="max-h-full max-w-full object-contain"
              />
            </div>

            {/* Thumbnail Strip */}
            {lightboxPhotos.length > 1 && (
              <div className="flex gap-2 justify-center pt-2">
                {lightboxPhotos.map((p, idx) => (
                  <button
                    key={idx}
                    onClick={() => setLightboxIndex(idx)}
                    className={`w-14 h-14 rounded-lg overflow-hidden border-2 transition ${
                      lightboxIndex === idx ? 'border-blue-500 scale-105' : 'border-slate-800 opacity-60'
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url} alt={p.label} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* PDF PREVIEW MODAL */}
      <PDFPreviewModal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        pdfUrl={previewUrl}
        title={previewTitle}
      />
    </div>
  );
}
