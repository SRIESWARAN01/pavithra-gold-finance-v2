'use client';

import React, { useState, useEffect, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  ChevronRight, 
  QrCode, 
  Search, 
  CheckCircle2, 
  AlertTriangle, 
  Coins, 
  Download, 
  Shield,
  FileText,
  User,
  MapPin,
  RefreshCw,
  Camera,
  LifeBuoy,
  MessageSquare,
  Send,
  X,
  CreditCard,
  History,
  Phone,
  Sparkles,
  Loader2,
  Printer, 
  DollarSign, 
  ArrowRight, 
  Calendar,
  Maximize2
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, doc, getDoc, getDocs, query, where, addDoc } from 'firebase/firestore';
import { getLoan } from '@/lib/db/loans';
import { getGoldByLoan } from '@/lib/db/gold';

function ScannerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryParam = searchParams.get('ticket') || searchParams.get('loanId') || searchParams.get('receipt') || '';

  const [searchKey, setSearchKey] = useState(queryParam);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Camera & Scanning state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);

  // Result data
  const [loan, setLoan] = useState<any | null>(null);
  const [customer, setCustomer] = useState<any | null>(null);
  const [collaterals, setCollaterals] = useState<any[]>([]);
  const [customerAllLoans, setCustomerAllLoans] = useState<any[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);

  // Ticket Modal State
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [ticketCategory, setTicketCategory] = useState('Interest Rate Clarification');
  const [ticketPriority, setTicketPriority] = useState<'Normal' | 'Urgent' | 'Critical'>('Normal');
  const [ticketNotes, setTicketNotes] = useState('');
  const [submittingTicket, setSubmittingTicket] = useState(false);
  const [ticketSuccessMessage, setTicketSuccessMessage] = useState<string | null>(null);

  const handleSearch = async (targetId: string) => {
    if (!targetId.trim()) return;
    setLoading(true);
    setError(null);
    setLoan(null);
    setCustomer(null);
    setCollaterals([]);
    setCustomerAllLoans([]);
    setPaymentHistory([]);

    try {
      // 1. Try fetching as loan number or doc ID
      let ln: any = await getLoan(targetId.trim(), { withCustomer: true });

      // 2. If not found, try searching by receipt number
      if (!ln) {
        try {
          const pmtQ = query(collection(db, 'payments'), where('receipt_number', '==', targetId.trim()));
          const pmtSnap = await getDocs(pmtQ);
          if (!pmtSnap.empty) {
            const pmtData = pmtSnap.docs[0].data();
            if (pmtData.loan_id) {
              ln = await getLoan(pmtData.loan_id, { withCustomer: true });
            }
          }
        } catch {}
      }

      // 3. If not found, try searching customer by Mobile Number
      if (!ln) {
        try {
          const cleanPhone = targetId.replace('+91', '').trim();
          const phoneQ = query(collection(db, 'profiles'), where('phone_primary', '==', cleanPhone));
          const phoneSnap = await getDocs(phoneQ);
          if (!phoneSnap.empty) {
            const custDoc = phoneSnap.docs[0];
            const custData = { id: custDoc.id, ...custDoc.data() };
            setCustomer(custData);
            const loansSnap = await getDocs(query(collection(db, 'loans'), where('customer_id', '==', custDoc.id)));
            if (!loansSnap.empty) {
              const allL = loansSnap.docs.map(d => ({ id: d.id, ...d.data() }));
              setCustomerAllLoans(allL);
              ln = allL[0];
              ln.customer = custData;
            } else {
              // Customer found with 0 loans
              setCustomer(custData);
              setLoading(false);
              return;
            }
          }
        } catch {}
      }

      // 4. If not found, try searching customer by Customer Number or Name or Aadhaar
      if (!ln) {
        try {
          const custQ = query(collection(db, 'profiles'), where('customer_number', '==', targetId.trim()));
          const custSnap = await getDocs(custQ);
          if (!custSnap.empty) {
            const custDoc = custSnap.docs[0];
            const custData = { id: custDoc.id, ...custDoc.data() };
            setCustomer(custData);
            const loansSnap = await getDocs(query(collection(db, 'loans'), where('customer_id', '==', custDoc.id)));
            if (!loansSnap.empty) {
              const allL = loansSnap.docs.map(d => ({ id: d.id, ...d.data() }));
              setCustomerAllLoans(allL);
              ln = allL[0];
              ln.customer = custData;
            } else {
              setCustomer(custData);
              setLoading(false);
              return;
            }
          } else {
            // Search by Name or Aadhaar
            const { searchProfiles } = await import('@/lib/db/profiles');
            const foundProfiles = await searchProfiles(targetId.trim());
            if (foundProfiles.length > 0) {
              const firstProf = foundProfiles[0];
              setCustomer(firstProf);
              const loansSnap = await getDocs(query(collection(db, 'loans'), where('customer_id', '==', firstProf.id)));
              if (!loansSnap.empty) {
                const allL = loansSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                setCustomerAllLoans(allL);
                ln = allL[0];
                ln.customer = firstProf;
              } else {
                setCustomer(firstProf);
                setLoading(false);
                return;
              }
            }
          }
        } catch {}
      }

      if (ln) {
        setLoan(ln);
        setCustomer(ln.customer || null);

        // Fetch gold collateral
        try {
          const col = await getGoldByLoan(ln.id);
          setCollaterals(col);
        } catch {
          setCollaterals([]);
        }

        // Fetch customer's full portfolio
        if (ln.customer_id) {
          try {
            const loansSnap = await getDocs(query(collection(db, 'loans'), where('customer_id', '==', ln.customer_id)));
            setCustomerAllLoans(loansSnap.docs.map(d => ({ id: d.id, ...d.data() })));
          } catch {
            setCustomerAllLoans([]);
          }
        }

        // Fetch payment ledger history
        try {
          const pmtSnap = await getDocs(query(collection(db, 'payments'), where('loan_id', '==', ln.id)));
          const pmts = pmtSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          pmts.sort((a: any, b: any) => (b.payment_date || '').localeCompare(a.payment_date || ''));
          setPaymentHistory(pmts);
        } catch {
          setPaymentHistory([]);
        }

      } else {
        setError(`QR Code / Ticket "${targetId}" not found in system records.`);
      }
    } catch (err: any) {
      console.error('QR scan search failed:', err);
      setError(err?.message || 'System lookup failed. Please verify the code.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (queryParam) {
      const t = setTimeout(() => {
        handleSearch(queryParam);
      }, 0);
      return () => clearTimeout(t);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryParam]);

  const startLiveCamera = async () => {
    try {
      setCameraError(null);
      setIsCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err: any) {
      console.warn('Camera stream error:', err);
      setCameraError('Camera access unavailable or permission denied. You can manually enter the code below.');
    }
  };

  const stopLiveCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const triggerScanSimulation = () => {
    startLiveCamera();
    setIsScanning(true);
    setScanProgress(0);
    setError(null);

    const interval = setInterval(() => {
      setScanProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsScanning(false);
          return 100;
        }
        return prev + 25;
      });
    }, 200);
  };

  const handleRaiseTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loan && !customer) return;

    setSubmittingTicket(true);
    try {
      const ticketId = `TCK-${Date.now().toString().substring(6)}`;
      const now = new Date().toISOString();
      const ticketData = {
        ticket_number: ticketId,
        loan_id: loan?.id || null,
        loan_number: loan?.loan_number || 'N/A',
        customer_id: customer?.id || loan?.customer_id || null,
        customer_name: customer?.name || loan?.customer?.name || 'Customer',
        customer_phone: customer?.phone_primary || loan?.customer?.phone_primary || 'N/A',
        category: ticketCategory,
        priority: ticketPriority,
        description: ticketNotes.trim() || 'Ticket raised via QR Code Pawn Ticket scan.',
        status: 'Open',
        source: 'QR_BILL_SCAN',
        created_at: now,
        updated_at: now,
      };

      await addDoc(collection(db, 'support_tickets'), ticketData);
      setTicketSuccessMessage(`Support Ticket #${ticketId} created successfully! Our branch manager will follow up.`);
      setTicketNotes('');
      setTimeout(() => {
        setShowTicketModal(false);
        setTicketSuccessMessage(null);
      }, 3500);
    } catch (err: any) {
      console.error('Failed to raise ticket:', err);
      alert(err.message || 'Failed to submit ticket');
    } finally {
      setSubmittingTicket(false);
    }
  };

  const remainingPrincipal = loan ? ((loan.principal_amount || 0) - (loan.total_principal_paid || 0)) : 0;
  const totalOutstanding = loan ? (remainingPrincipal + (loan.outstanding_interest || 0)) : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs text-[#2563EB] font-semibold tracking-wider uppercase">
        <span>Admin Panel</span>
        <ChevronRight size={12} className="text-gray-400" />
        <span>Smart QR Portfolio & Verification Scanner</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-[#E5E7EB] pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 tracking-wide font-outfit">Universal QR Bill & Portfolio Scanner</h2>
          <p className="text-gray-500 text-xs mt-1">
            Scan QR code on any pledge bill, payment receipt, or closure statement to verify authenticity, view customer portfolio, and raise instant support tickets.
          </p>
        </div>
      </div>

      {/* Raise Support Ticket Modal */}
      {showTicketModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <form onSubmit={handleRaiseTicketSubmit} className="bg-white rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4 animate-scale-up">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <LifeBuoy className="text-[#2563EB]" size={18} />
                Raise Customer Support Ticket
              </h3>
              <button type="button" onClick={() => setShowTicketModal(false)} className="text-gray-400 hover:text-gray-700">
                <X size={16} />
              </button>
            </div>

            {ticketSuccessMessage ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" />
                <span>{ticketSuccessMessage}</span>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 flex justify-between items-center">
                  <div>
                    <span className="text-gray-500 block text-[10px]">Associated Loan / Customer</span>
                    <span className="font-bold text-blue-900">{loan?.loan_number || 'N/A'} — {customer?.name || loan?.customer?.name || 'Customer'}</span>
                  </div>
                  <span className="text-[10px] font-mono text-blue-700">+91 {customer?.phone_primary || loan?.customer?.phone_primary || 'N/A'}</span>
                </div>

                <div>
                  <label className="font-semibold text-gray-700">Issue Category *</label>
                  <select
                    value={ticketCategory}
                    onChange={e => setTicketCategory(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:border-[#2563EB]"
                  >
                    <option value="Interest Rate Clarification">Interest Rate / Accrual Clarification</option>
                    <option value="Part Release of Jewellery">Part-Release of Gold Jewellery</option>
                    <option value="Loan Preclosure Settlement">Loan Pre-Closure / Settlement Quotation</option>
                    <option value="Loss of Physical Pawn Ticket">Loss of Physical Pawn Ticket (Duplicate Issue)</option>
                    <option value="Payment Receipt Discrepancy">Payment Receipt / UTR Discrepancy</option>
                    <option value="KYC & Address Updation">KYC & Address Updation Request</option>
                    <option value="General Customer Grievance">General Grievance / Management Escalation</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-gray-700">Priority Level</label>
                  <div className="flex gap-2 mt-1">
                    {(['Normal', 'Urgent', 'Critical'] as const).map(p => (
                      <button
                        type="button"
                        key={p}
                        onClick={() => setTicketPriority(p)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition border ${
                          ticketPriority === p 
                            ? 'bg-[#2563EB] text-white border-[#2563EB]' 
                            : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="font-semibold text-gray-700">Customer Request / Grievance Details</label>
                  <textarea
                    rows={3}
                    value={ticketNotes}
                    onChange={e => setTicketNotes(e.target.value)}
                    placeholder="Describe specific customer grievance or pledge instruction..."
                    className="w-full mt-1 p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:border-[#2563EB]"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setShowTicketModal(false)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 font-semibold rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingTicket}
                    className="px-5 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold rounded-lg shadow flex items-center gap-2"
                  >
                    {submittingTicket ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    Submit Support Ticket
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      )}

      {/* Search Input Bar */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Scan QR or enter Loan No (LN-94285), Receipt (REC-1001), or Customer ID..."
              value={searchKey}
              onChange={(e) => setSearchKey(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchKey)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 text-gray-900 text-xs rounded-xl outline-none focus:border-[#2563EB] font-medium"
            />
          </div>
          <button
            onClick={() => handleSearch(searchKey)}
            disabled={loading}
            className="px-6 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold rounded-xl transition shadow flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            Authenticate & Open Portfolio
          </button>
          <button
            onClick={isCameraActive ? stopLiveCamera : startLiveCamera}
            className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2"
          >
            <Camera size={14} className="text-[#2563EB]" />
            {isCameraActive ? 'Close Camera' : 'Open Scanner'}
          </button>
        </div>

        {/* Live Camera Viewport */}
        {isCameraActive && (
          <div className="relative bg-black rounded-2xl overflow-hidden border-2 border-blue-500 shadow-2xl p-2 max-w-lg mx-auto animate-fade-in">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-64 sm:h-72 object-cover rounded-xl bg-slate-900"
            />
            {/* Viewfinder Reticle Overlay */}
            <div className="absolute inset-4 border-2 border-dashed border-white/60 rounded-xl pointer-events-none flex items-center justify-center">
              <div className="w-48 h-48 border-2 border-blue-400 rounded-lg relative flex items-center justify-center">
                <div className="absolute w-full h-0.5 bg-red-500 shadow-lg shadow-red-500/80 animate-pulse top-1/2" />
                <span className="text-[10px] text-white/80 bg-black/60 px-2 py-0.5 rounded font-mono">Align QR / Barcode Here</span>
              </div>
            </div>

            {/* Bottom Controls inside Camera */}
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 px-4">
              <button
                type="button"
                onClick={stopLiveCamera}
                className="px-4 py-1.5 bg-black/70 hover:bg-black text-white text-xs font-bold rounded-xl border border-white/20 transition"
              >
                Close Camera
              </button>
            </div>
          </div>
        )}

        {cameraError && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs text-center">
            {cameraError}
          </div>
        )}

        {isScanning && (
          <div className="p-4 bg-slate-950 rounded-xl text-center text-white space-y-2 border border-blue-500/40 animate-pulse">
            <p className="text-xs font-mono text-blue-400">Optical QR Barcode Scanner Active: {scanProgress}%</p>
            <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
              <div className="bg-[#2563EB] h-full transition-all duration-200" style={{ width: `${scanProgress}%` }} />
            </div>
          </div>
        )}
      </div>

      {/* Verification Error */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center space-y-2 text-rose-800 text-xs">
          <AlertTriangle size={32} className="text-rose-500 mx-auto" />
          <p className="font-bold text-sm">Pledge Verification Unsuccessful</p>
          <p>{error}</p>
        </div>
      )}

      {/* Verification Results: Full Customer & Loan Portfolio */}
      {loan && (
        <div className="space-y-6 animate-fade-in">
          {/* Top Status & Verification Badge */}
          <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-600">
                <Shield size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-gray-900 font-outfit">{loan.loan_number}</h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    loan.status === 'Settled' ? 'bg-gray-100 text-gray-600' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  }`}>
                    {loan.status}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  Origination: {loan.origination_date?.split('T')[0]} | Due: {loan.maturity_date?.split('T')[0]} | Branch: {loan.branch_id || 'Madurai Main'}
                </p>
              </div>
            </div>

            {/* Direct Action Buttons */}
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              <button
                onClick={() => setShowTicketModal(true)}
                className="flex-1 md:flex-none px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow transition flex items-center justify-center gap-2"
              >
                <LifeBuoy size={14} />
                Raise Support Ticket
              </button>
              <button
                onClick={() => router.push(`/admin/payments?loanId=${loan.loan_number}`)}
                className="flex-1 md:flex-none px-4 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold text-xs rounded-xl shadow transition flex items-center justify-center gap-2"
              >
                <CreditCard size={14} />
                Collect Payment
              </button>
              <a
                href={`/api/pdf?type=ticket&loanId=${loan.loan_number}`}
                target="_blank"
                className="flex-1 md:flex-none px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition flex items-center justify-center gap-2"
              >
                <Download size={14} />
                Bill PDF
              </a>
            </div>
          </div>

          {/* Customer Dossier & Pledgor Identity */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-[#2563EB] uppercase tracking-wider">
                <User size={14} />
                Pledgor Client Information
              </div>
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-gray-400 text-[10px] block">Full Name</span>
                  <span className="font-bold text-gray-900 text-sm">{customer?.name || loan.customer?.name || 'Customer'}</span>
                </div>
                <div>
                  <span className="text-gray-400 text-[10px] block">Contact Number</span>
                  <span className="font-mono text-gray-700">+91 {customer?.phone_primary || loan.customer?.phone_primary || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-gray-400 text-[10px] block">National ID / Aadhaar</span>
                  <span className="font-mono text-gray-700">{customer?.national_id || 'Verified'}</span>
                </div>
                <div>
                  <span className="text-gray-400 text-[10px] block">Residential Address</span>
                  <span className="text-gray-600">{customer?.address || 'Madurai, Tamil Nadu'}</span>
                </div>
              </div>
            </div>

            {/* Financial Status Matrix */}
            <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-[#2563EB] uppercase tracking-wider">
                <Coins size={14} />
                Financial Outstanding Split
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-gray-100">
                  <span className="text-gray-500">Sanctioned Principal:</span>
                  <span className="font-bold font-mono">₹{(loan.principal_amount || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-100">
                  <span className="text-gray-500">Principal Outstanding:</span>
                  <span className="font-bold font-mono text-amber-600">₹{remainingPrincipal.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-100">
                  <span className="text-gray-500">Interest Accrued Due:</span>
                  <span className="font-bold font-mono text-rose-600">₹{(loan.outstanding_interest || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between py-1.5 font-bold text-sm bg-blue-50/60 p-2 rounded-lg">
                  <span className="text-[#2563EB]">Total Redemptive Due:</span>
                  <span className="text-[#2563EB] font-mono">₹{totalOutstanding.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            {/* Pledged Gold Ornaments Vault Coordinates */}
            <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-[#2563EB] uppercase tracking-wider">
                <Shield size={14} />
                Vault Custody & Security
              </div>
              <div className="space-y-2 text-xs">
                {collaterals.length === 0 ? (
                  <p className="text-gray-400">No gold items logged for this ticket.</p>
                ) : (
                  collaterals.map((g, idx) => (
                    <div key={idx} className="p-2.5 bg-amber-50/50 border border-amber-200/60 rounded-xl space-y-1">
                      <div className="flex justify-between font-bold text-gray-900">
                        <span>{g.item_description}</span>
                        <span className="text-amber-700">{g.purity_karat || '22K'}</span>
                      </div>
                      <div className="flex justify-between text-[11px] text-gray-600 font-mono">
                        <span>Net Wt: {g.net_weight}g</span>
                        <span>Val: ₹{(g.valuation_inr || 0).toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Customer's Full Loan Portfolio */}
          {customerAllLoans.length > 1 && (
            <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 shadow-sm space-y-4">
              <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                <History size={14} className="text-[#2563EB]" />
                Customer Consolidated Portfolio ({customerAllLoans.length} Loans Registered)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {customerAllLoans.map(cl => (
                  <div
                    key={cl.id}
                    onClick={() => handleSearch(cl.loan_number || cl.id)}
                    className={`p-3 rounded-xl border transition cursor-pointer ${
                      cl.loan_number === loan.loan_number 
                        ? 'bg-blue-50 border-[#2563EB]' 
                        : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex justify-between items-center text-xs font-bold">
                      <span className="text-gray-900 font-mono">{cl.loan_number}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded ${
                        cl.status === 'Settled' ? 'bg-gray-200 text-gray-700' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {cl.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1 font-mono">
                      Principal: ₹{(cl.principal_amount || 0).toLocaleString('en-IN')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Payment Receipts Ledger */}
          {paymentHistory.length > 0 && (
            <div className="bg-white border border-[#E5E7EB] rounded-2xl p-5 shadow-sm space-y-3">
              <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                <FileText size={14} className="text-[#2563EB]" />
                Pledge Repayment History ({paymentHistory.length} Receipts)
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-gray-400 uppercase tracking-wider border-b border-gray-100 pb-2">
                      <th className="py-2">Receipt No</th>
                      <th className="py-2">Payment Date</th>
                      <th className="py-2">Mode</th>
                      <th className="py-2">Interest</th>
                      <th className="py-2">Principal</th>
                      <th className="py-2 text-right">Amount Paid</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paymentHistory.map(p => (
                      <tr key={p.id} className="text-gray-600">
                        <td className="py-2.5 font-mono font-bold text-gray-900">{p.receipt_number || p.id.substring(0, 8)}</td>
                        <td className="py-2.5 font-mono">{p.payment_date?.split('T')[0]}</td>
                        <td className="py-2.5">{p.mode || 'Cash'}</td>
                        <td className="py-2.5 font-mono text-emerald-600">₹{(p.interest_portion || 0).toLocaleString('en-IN')}</td>
                        <td className="py-2.5 font-mono text-blue-600">₹{(p.principal_portion || 0).toLocaleString('en-IN')}</td>
                        <td className="py-2.5 font-mono font-bold text-right text-gray-900">₹{(p.amount_paid || 0).toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* When Customer is found without active loans */}
      {customer && !loan && (
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 shadow-sm space-y-4 animate-fade-in">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 font-bold text-lg font-outfit uppercase">
                {customer.name?.substring(0, 2) || 'CU'}
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">{customer.name}</h3>
                <p className="text-xs text-gray-500 font-mono">Mobile: +91 {customer.phone_primary} | {customer.customer_number || 'PGF Client'}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => router.push(`/admin/customers/${customer.id}`)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-xl transition"
              >
                View Full Profile
              </button>
              <button
                onClick={() => router.push(`/admin/loans/new`)}
                className="px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold rounded-xl transition shadow"
              >
                + Create Gold Loan
              </button>
            </div>
          </div>
          <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 text-xs text-blue-800">
            Customer account is active. No active gold pledges currently linked to this customer account.
          </div>
        </div>
      )}
    </div>
  );
}

export default function ScannerPage() {
  return (
    <Suspense fallback={
      <div className="p-12 text-center text-gray-500 text-xs">
        Loading Universal QR Scanner...
      </div>
    }>
      <ScannerContent />
    </Suspense>
  );
}
