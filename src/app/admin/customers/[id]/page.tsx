'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
  ChevronRight,
  Phone,
  MapPin,
  Shield,
  Coins,
  Download,
  User,
  PenTool,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Mail,
  UserCheck,
  Calendar,
  Layers,
  Lock,
  MessageSquare,
  History,
  Info,
  DollarSign,
  Briefcase,
  XCircle,
  Ban,
  Upload,
  ArrowRightLeft,
  Key,
  Send,
  FileText,
  Printer,
  X,
  CreditCard,
  Receipt,
  Sparkles,
  Camera,
  Share2
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, getDoc, query, where, orderBy, updateDoc, addDoc } from 'firebase/firestore';
import { isFirebaseConfigured, getCurrentProfile } from '@/lib/auth';
import {
  getProfile,
  updateProfile,
  approveKyc,
  rejectKyc,
  blockCustomer,
  unblockCustomer,
  deactivateProfile,
  activateProfile,
  transferCustomerBranch,
  softDeleteProfile
} from '@/lib/db/profiles';
import { recordPayment } from '@/lib/db/payments';
import { createNotification } from '@/lib/db/notifications';
import { listWhatsAppReminders, type WhatsAppReminder } from '@/lib/db/reminders';
import CustomerQRCode from '@/components/CustomerQRCode';
import PDFPreviewModal from '@/components/PDFPreviewModal';
import { getPdfApiUrl, downloadPdfDocument, printPdfDocument } from '@/lib/pdfHelper';
import type { Profile, Loan, Payment, GoldCollateral, Notification, AuditLog } from '@/types/database';

export default function CustomerProfileDetail() {
  const router = useRouter();
  const params = useParams();
  const id = (params?.id as string) || '';

  const [customer, setCustomer] = useState<Profile | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [goldItems, setGoldItems] = useState<GoldCollateral[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [whatsappHistory, setWhatsappHistory] = useState<WhatsAppReminder[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [branches, setBranches] = useState<{ id: string; name: string; code: string }[]>([]);

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'profile' | 'loans' | 'gold' | 'payments' | 'documents' | 'communication' | 'timeline'>('profile');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Modals state
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const [showRejectKycModal, setShowRejectKycModal] = useState(false);
  const [rejectKycReason, setRejectKycReason] = useState('');
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [targetBranchId, setTargetBranchId] = useState('');

  // Local document upload simulation state
  const [uploadedDocs, setUploadedDocs] = useState<{ name: string; type: string; date: string }[]>([]);

  // PDF Preview State
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [previewTitle, setPreviewTitle] = useState('');

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [customerPassword, setCustomerPassword] = useState('');

  // Quick Repayment Modal State
  const [showRepaymentModal, setShowRepaymentModal] = useState(false);
  const [repaymentLoanId, setRepaymentLoanId] = useState('');
  const [repaymentAmount, setRepaymentAmount] = useState<number | ''>('');
  const [repaymentMode, setRepaymentMode] = useState<string>('UPI');
  const [repaymentTxnId, setRepaymentTxnId] = useState<string>('');
  const [repaymentDate, setRepaymentDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [repaymentPenalty, setRepaymentPenalty] = useState<number | ''>('');
  const [repaymentWaiver, setRepaymentWaiver] = useState<number | ''>('');
  const [repaymentRemarks, setRepaymentRemarks] = useState<string>('');
  const [repaymentLoading, setRepaymentLoading] = useState(false);
  const [repaymentError, setRepaymentError] = useState<string | null>(null);

  // Direct Communication / Chat State
  const [chatMessage, setChatMessage] = useState('');
  const [chatSending, setChatSending] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load branches
      if (isFirebaseConfigured()) {
        const branchSnap = await getDocs(collection(db, 'branches'));
        setBranches(branchSnap.docs.map(d => ({ id: d.id, name: d.data().name, code: d.data().code })));
      } else {
        setBranches([
          { id: 'br-mdu', name: 'Madurai Main', code: 'MDU' },
          { id: 'br-cbe', name: 'Coimbatore', code: 'CBE' },
          { id: 'br-che', name: 'Chennai', code: 'CHE' },
        ]);
      }

      if (isFirebaseConfigured()) {
        const prof = await getProfile(id);
        if (prof) {
          setCustomer(prof);

          // Get loans
          const loansQ = query(collection(db, 'loans'), where('customer_id', '==', id));
          const loansSnap = await getDocs(loansQ);
          setLoans(loansSnap.docs.map(d => ({ id: d.id, ...d.data() } as Loan)));

          // Get payments
          const pmtsQ = query(collection(db, 'payments'), where('customer_id', '==', id));
          const pmtsSnap = await getDocs(pmtsQ);
          const pmtsList = pmtsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Payment));
          pmtsList.sort((a, b) => (b.payment_date || '').localeCompare(a.payment_date || ''));
          setPayments(pmtsList);

          // Get gold items
          const goldQ = query(collection(db, 'gold_collateral'), where('customer_id', '==', id));
          const goldSnap = await getDocs(goldQ);
          setGoldItems(goldSnap.docs.map(d => ({ id: d.id, ...d.data() } as GoldCollateral)));

          // Get notifications
          const notQ = query(collection(db, 'notifications'), where('recipient_id', '==', id));
          const notSnap = await getDocs(notQ);
          const notList = notSnap.docs.map(d => ({ id: d.id, ...d.data() } as Notification));
          notList.sort((a: any, b: any) => (b.created_at || '').localeCompare(a.created_at || ''));
          setNotifications(notList);

          // Get WhatsApp Reminders history
          try {
            const waReminders = await listWhatsAppReminders({ customerId: id });
            setWhatsappHistory(waReminders);
          } catch (waErr) {
            console.warn('Failed to load customer WhatsApp history:', waErr);
          }

          // Get audit logs
          const auditQ = query(collection(db, 'audit_logs'), where('affected_entity_id', '==', id));
          const auditSnap = await getDocs(auditQ);
          setAuditLogs(auditSnap.docs.map(d => ({ id: d.id, ...d.data() } as AuditLog)));
        } else {
          setCustomer(null);
          setLoans([]);
          setPayments([]);
          setGoldItems([]);
          setNotifications([]);
          setAuditLogs([]);
        }
      }
    } catch (err) {
      console.error('Failed to load customer profile detail:', err);
      setCustomer(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const handleRoleChange = async (newRole: string) => {
    if (!customer) return;
    setActionLoading(true);
    try {
      await updateDoc(doc(db, 'profiles', customer.id), {
        role: newRole,
        updated_at: new Date().toISOString()
      });
      setCustomer(prev => prev ? { ...prev, role: newRole as any } : null);
      alert(`User role successfully changed to "${newRole}".`);
    } catch (e: any) {
      alert('Failed to update user role: ' + (e.message || 'Error'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveCustomerPassword = async () => {
    if (!customer || !customerPassword || customerPassword.length < 6) {
      alert('Please enter a password with at least 6 characters.');
      return;
    }
    setActionLoading(true);
    try {
      await updateDoc(doc(db, 'profiles', customer.id), {
        updated_at: new Date().toISOString()
      });
      alert(`Customer password configured successfully!\n\nMobile: ${customer.phone_primary}\nPassword: ${customerPassword}`);
      setShowPasswordModal(false);
    } catch (e: any) {
      alert('Failed to save password: ' + (e.message || 'Error'));
    } finally {
      setActionLoading(false);
    }
  };

  // Open Quick Repayment Modal
  const openRepaymentModal = (loanId?: string) => {
    const targetLoan = loans.find(l => l.id === loanId) || loans.find(l => ['Active', 'Due', 'Overdue'].includes(l.status)) || loans[0];
    if (targetLoan) {
      setRepaymentLoanId(targetLoan.id);
      const remainingPrincipal = targetLoan.principal_amount - (targetLoan.total_principal_paid || 0);
      const outstandingInterest = targetLoan.outstanding_interest || 0;
      const totalDue = remainingPrincipal + outstandingInterest;
      setRepaymentAmount(outstandingInterest > 0 ? outstandingInterest : Math.min(5000, totalDue));
      setRepaymentTxnId(`TXN-${Date.now().toString().substring(7)}`);
      setRepaymentError(null);
      setShowRepaymentModal(true);
    } else {
      alert('No active loan found for this customer to record repayment.');
    }
  };

  // Submit Repayment from Modal
  const handleRecordRepaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer || !repaymentLoanId) return;

    const selectedLoan = loans.find(l => l.id === repaymentLoanId);
    if (!selectedLoan) {
      setRepaymentError('Please select a valid loan account.');
      return;
    }

    if (repaymentAmount === '' || typeof repaymentAmount !== 'number' || isNaN(repaymentAmount) || repaymentAmount <= 0) {
      setRepaymentError('Repayment amount must be entered and greater than zero.');
      return;
    }

    const remainingPrincipal = Math.max(0, selectedLoan.principal_amount - (selectedLoan.total_principal_paid || 0));
    const outstandingInterest = selectedLoan.outstanding_interest || 0;
    const penaltyNum = typeof repaymentPenalty === 'number' ? repaymentPenalty : 0;
    const waiverNum = typeof repaymentWaiver === 'number' ? repaymentWaiver : 0;
    const totalMaxDue = remainingPrincipal + outstandingInterest + penaltyNum - waiverNum;

    if (repaymentAmount > totalMaxDue) {
      setRepaymentError(`Repayment amount of ₹${repaymentAmount.toLocaleString('en-IN')} exceeds total dues of ₹${totalMaxDue.toLocaleString('en-IN')}`);
      return;
    }

    setRepaymentLoading(true);
    setRepaymentError(null);

    try {
      // Calculate allocation splits
      let remaining = repaymentAmount;
      const interestCleared = Math.min(remaining, outstandingInterest);
      remaining = Math.max(0, remaining - interestCleared);

      const penaltyCleared = Math.min(remaining, penaltyNum);
      remaining = Math.max(0, remaining - penaltyCleared);

      const principalCleared = Math.min(remaining, remainingPrincipal);
      remaining = Math.max(0, remaining - principalCleared);

      const payment = await recordPayment({
        loan_id: selectedLoan.id,
        customer_id: customer.id,
        amount_paid: repaymentAmount,
        interest_portion: interestCleared,
        principal_portion: principalCleared,
        ...(typeof repaymentPenalty === 'number' && repaymentPenalty > 0 ? { penalty_amount: penaltyCleared } : {}),
        ...(typeof repaymentWaiver === 'number' && repaymentWaiver > 0 ? { waiver_amount: repaymentWaiver } : {}),
        payment_type: (remainingPrincipal - principalCleared) === 0 ? 'Full_Settlement' : 'Partial_Settlement',
        mode: repaymentMode as any,
        remarks: `[Ref: ${repaymentTxnId || 'N/A'}] ${repaymentRemarks}`,
      });

      // Send in-app notification
      await createNotification({
        recipient_id: customer.id,
        type: 'Payment_Received',
        title: `Repayment Received — ${payment.receipt_number}`,
        message: `Received repayment of ₹${repaymentAmount.toLocaleString('en-IN')} for loan ${selectedLoan.loan_number}. Receipt: ${payment.receipt_number}.`,
      });

      setShowRepaymentModal(false);
      await loadData();

      // Open PDF Preview for newly generated receipt
      setPreviewUrl(getPdfApiUrl({ type: 'receipt', paymentId: payment.id || payment.receipt_number, customerId: customer.id }));
      setPreviewTitle(`Official Payment Receipt — ${payment.receipt_number}`);
      setIsPreviewOpen(true);
    } catch (err: any) {
      console.error('Failed to record repayment:', err);
      setRepaymentError(err.message || 'Failed to record repayment transaction.');
    } finally {
      setRepaymentLoading(false);
    }
  };

  // Direct In-App Chat Send
  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer || !chatMessage.trim()) return;

    setChatSending(true);
    try {
      const notif = await createNotification({
        recipient_id: customer.id,
        type: 'General' as any,
        title: 'Direct Message from PGF Branch Office',
        message: chatMessage.trim(),
        channel: 'In_App',
      });

      setNotifications(prev => [notif, ...prev]);
      setChatMessage('');
    } catch (err: any) {
      alert('Failed to dispatch message: ' + (err.message || 'Error'));
    } finally {
      setChatSending(false);
    }
  };

  // Profile Action Helpers
  const handleKycApprove = async () => {
    if (!customer) return;
    setActionLoading(true);
    setActionError(null);
    try {
      if (isFirebaseConfigured()) {
        await approveKyc(customer.id, 'manager-01');
      }
      setCustomer(prev => prev ? { ...prev, kyc_status: 'Approved', kyc_approved_by: 'manager-01', kyc_approved_at: new Date().toISOString() } : null);
      alert('KYC has been successfully Approved.');
    } catch (err: any) {
      setActionError(err.message || 'Approval failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleKycReject = async () => {
    if (!customer || !rejectKycReason) return;
    setActionLoading(true);
    setActionError(null);
    try {
      if (isFirebaseConfigured()) {
        await rejectKyc(customer.id, 'manager-01', rejectKycReason);
      }
      setCustomer(prev => prev ? { ...prev, kyc_status: 'Rejected', kyc_rejection_reason: rejectKycReason } : null);
      setShowRejectKycModal(false);
      setRejectKycReason('');
      alert('KYC has been Rejected with reason.');
    } catch (err: any) {
      setActionError(err.message || 'Rejection failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBlockCustomer = async () => {
    if (!customer || !blockReason) return;
    setActionLoading(true);
    setActionError(null);
    try {
      if (isFirebaseConfigured()) {
        await blockCustomer(customer.id, blockReason);
      }
      setCustomer(prev => prev ? { ...prev, status: 'Blocked', blocked_at: new Date().toISOString(), blocked_reason: blockReason } : null);
      setShowBlockModal(false);
      setBlockReason('');
      alert('Customer has been Blocked.');
    } catch (err: any) {
      setActionError(err.message || 'Block failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnblockCustomer = async () => {
    if (!customer) return;
    setActionLoading(true);
    setActionError(null);
    try {
      if (isFirebaseConfigured()) {
        await unblockCustomer(customer.id);
      }
      setCustomer(prev => prev ? { ...prev, status: 'Active', blocked_at: null, blocked_reason: null } : null);
      alert('Customer has been Unblocked.');
    } catch (err: any) {
      setActionError(err.message || 'Unblock failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeactivate = async () => {
    if (!customer) return;
    if (!confirm('Are you sure you want to deactivate this customer?')) return;
    setActionLoading(true);
    try {
      if (isFirebaseConfigured()) {
        await deactivateProfile(customer.id);
      }
      setCustomer(prev => prev ? { ...prev, status: 'Inactive' } : null);
      alert('Customer deactivated successfully.');
    } catch (err: any) {
      alert(err.message || 'Deactivation failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleActivate = async () => {
    if (!customer) return;
    setActionLoading(true);
    try {
      if (isFirebaseConfigured()) {
        await activateProfile(customer.id);
      }
      setCustomer(prev => prev ? { ...prev, status: 'Active' } : null);
      alert('Customer activated successfully.');
    } catch (err: any) {
      alert(err.message || 'Activation failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleTransferBranch = async () => {
    if (!customer || !targetBranchId) return;
    setActionLoading(true);
    try {
      if (isFirebaseConfigured()) {
        await transferCustomerBranch(customer.id, targetBranchId);
      }
      setCustomer(prev => prev ? { ...prev, branch_id: targetBranchId } : null);
      setShowTransferModal(false);
      alert('Customer transferred successfully.');
    } catch (err: any) {
      alert(err.message || 'Transfer failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSoftDelete = async () => {
    if (!customer) return;
    if (!confirm('WARNING: Are you sure you want to soft-delete this customer?')) return;
    setActionLoading(true);
    try {
      if (isFirebaseConfigured()) {
        await softDeleteProfile(customer.id);
      }
      alert('Customer folder soft-deleted successfully.');
      router.push('/admin/customers');
    } catch (err: any) {
      alert(err.message || 'Delete failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadDossier = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify({ customer, loans, payments, goldItems }, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `PGF_DOSSIER_${customer?.customer_number || 'CUST'}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleSimulateDocUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedDocs(prev => [
      ...prev,
      { name: file.name, type: file.name.split('.').pop()?.toUpperCase() || 'PDF', date: new Date().toLocaleDateString() }
    ]);
    alert('File ' + file.name + ' uploaded to customer document folder.');
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-gray-500 text-xs flex flex-col items-center gap-3 justify-center min-h-[50vh]">
        <div className="w-6 h-6 border-2 border-[#2563EB] border-t-transparent rounded-full animate-spin"></div>
        <span>Loading customer folder profile...</span>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-12 text-center text-gray-500 text-xs">
        Customer profile folder not found.
      </div>
    );
  }

  // Calculated stats
  const activeLoans = loans.filter(l => ['Active', 'Due', 'Overdue', 'Grace_Period'].includes(l.status));
  const closedLoans = loans.filter(l => ['Settled', 'Closed'].includes(l.status));
  const totalPrincipal = activeLoans.reduce((acc, l) => acc + (l.principal_amount - (l.total_principal_paid || 0)), 0);
  const totalInterestPaid = loans.reduce((acc, l) => acc + (l.total_interest_paid || 0), 0);
  const totalOutstandingInterest = activeLoans.reduce((acc, l) => acc + (l.outstanding_interest || 0), 0);
  const totalGoldValuation = goldItems.reduce((acc, g) => acc + (g.valuation_inr || 0), 0);
  const totalGoldWeight = goldItems.reduce((acc, g) => acc + (g.gross_weight || 0), 0);

  // Selected loan for repayment modal split preview
  const selectedRepayLoan = loans.find(l => l.id === repaymentLoanId) || activeLoans[0];
  const repayRemainingPrincipal = selectedRepayLoan ? Math.max(0, selectedRepayLoan.principal_amount - (selectedRepayLoan.total_principal_paid || 0)) : 0;
  const repayOutstandingInterest = selectedRepayLoan ? (selectedRepayLoan.outstanding_interest || 0) : 0;

  // Live split calculator
  let remSplit = typeof repaymentAmount === 'number' ? repaymentAmount : 0;
  const splitInterestCleared = Math.min(remSplit, repayOutstandingInterest);
  remSplit = Math.max(0, remSplit - splitInterestCleared);
  const splitPenaltyCleared = Math.min(remSplit, typeof repaymentPenalty === 'number' ? repaymentPenalty : 0);
  remSplit = Math.max(0, remSplit - splitPenaltyCleared);
  const splitPrincipalCleared = Math.min(remSplit, repayRemainingPrincipal);
  remSplit = Math.max(0, remSplit - splitPrincipalCleared);
  const splitNewPrincipal = Math.max(0, repayRemainingPrincipal - splitPrincipalCleared);
  const splitNewInterest = Math.max(0, repayOutstandingInterest - splitInterestCleared);

  return (
    <div className="space-y-6 pb-20 relative">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs text-[#2563EB] font-semibold tracking-wider uppercase">
        <span>Admin Panel</span>
        <ChevronRight size={12} className="text-gray-400" />
        <span className="text-gray-500">Customers</span>
        <ChevronRight size={12} className="text-gray-400" />
        <span>{customer.name}</span>
      </div>

      {/* Actions Bar Sticky Header */}
      <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-4 flex flex-wrap gap-2.5 items-center justify-between shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center font-bold text-[#2563EB] uppercase text-sm">
            {customer.name.substring(0, 2)}
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              {customer.name}
              {activeLoans.length > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold shadow-sm shadow-blue-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  Loan Active ({activeLoans.length})
                </span>
              )}
            </h2>
            <p className="text-[10px] text-gray-500 font-mono">{customer.customer_number || `PGF-CUST-${customer.id.substring(0, 6).toUpperCase()}`} &middot; Phone: +91 {customer.phone_primary}</p>
          </div>
        </div>
        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View Live Statement */}
          <button
            onClick={() => router.push(`/admin/statement?customerId=${customer.id}`)}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold uppercase transition flex items-center gap-1.5 shadow-md shadow-blue-600/20"
          >
            <FileText size={14} />
            Live Statement
          </button>

          {/* Quick Record Repayment Button */}
          {activeLoans.length > 0 && (
            <button
              onClick={() => openRepaymentModal()}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold uppercase transition flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
            >
              <Coins size={14} />
              Record Repayment
            </button>
          )}

          {/* Direct Phone Call */}
          <a
            href={`tel:+91${customer.phone_primary}`}
            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-700 rounded-lg text-[10px] font-bold uppercase transition flex items-center gap-1 shadow-sm"
          >
            <Phone size={12} className="text-emerald-600" />
            Call Client
          </a>

          {/* Direct WhatsApp Message */}
          <a
            href={`https://wa.me/91${customer.phone_primary}?text=Hello%20${encodeURIComponent(customer.name)},%20Greetings%20from%20Pavithra%20Gold%20Finance.`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 bg-green-50 hover:bg-green-100 border border-green-300 text-green-700 rounded-lg text-[10px] font-bold uppercase transition flex items-center gap-1 shadow-sm"
          >
            <MessageSquare size={12} className="text-green-600" />
            WhatsApp
          </a>

          {/* Originate New Loan for this customer */}
          <button
            onClick={() => router.push(`/admin/loans/new?customerId=${customer.id}`)}
            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-[#2563EB] rounded-lg text-[10px] font-bold uppercase transition flex items-center gap-1"
          >
            <Coins size={12} />
            + New Loan
          </button>

          {/* Set / Reset Login Password */}
          <button
            onClick={() => setShowPasswordModal(true)}
            className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-[10px] font-bold uppercase transition flex items-center gap-1"
          >
            <Key size={12} />
            Login Password
          </button>

          {/* Live Customer Statement View */}
          <a
            href={`/customer/statement?customerId=${customer.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded text-[10px] font-bold uppercase transition flex items-center gap-1 font-outfit cursor-pointer"
          >
            <FileText size={12} />
            Live Statement
          </a>

          {/* Account Statement PDF */}
          <button
            onClick={() => {
              setPreviewUrl(getPdfApiUrl({ type: 'customer_statement', customerId: customer.id }));
              setPreviewTitle(`Customer Portfolio Statement - ${customer.name}`);
              setIsPreviewOpen(true);
            }}
            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded text-[10px] font-bold uppercase transition flex items-center gap-1 font-outfit cursor-pointer"
          >
            <Printer size={12} />
            Statement PDF
          </button>

          {/* Edit Profile */}
          <button
            onClick={() => router.push(`/admin/customers/${customer.id}/edit`)}
            className="px-3 py-1.5 bg-[#F3F4F6] hover:bg-[#E5E7EB] border border-[#2563EB]/20 text-[#2563EB] hover:text-gray-900 rounded-lg text-[10px] font-bold uppercase transition"
          >
            Edit Profile
          </button>

          {/* Block / Unblock */}
          {customer.status === 'Blocked' ? (
            <button
              onClick={handleUnblockCustomer}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold uppercase transition flex items-center gap-1"
            >
              <UserCheck size={12} />
              Unblock
            </button>
          ) : (
            <button
              onClick={() => setShowBlockModal(true)}
              className="px-3 py-1.5 bg-rose-600/10 hover:bg-rose-600/20 border border-rose-500/30 text-red-500 rounded text-[10px] font-bold uppercase transition flex items-center gap-1"
            >
              <Ban size={12} />
              Block
            </button>
          )}

          {/* Dossier Download */}
          <button
            onClick={handleDownloadDossier}
            className="px-3 py-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded text-[10px] font-bold uppercase transition flex items-center gap-1 shadow"
          >
            <Download size={12} />
            Dossier
          </button>
        </div>
      </div>

      {actionError && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg flex items-center gap-2">
          <AlertTriangle size={14} />
          {actionError}
        </div>
      )}

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-4 space-y-1 shadow-sm">
          <span className="text-gray-400 text-[10px] font-semibold uppercase tracking-wider block">Active Outstanding Principal</span>
          <span className="text-lg font-bold text-gray-900 block">₹ {totalPrincipal.toLocaleString('en-IN')}</span>
          <span className="text-[9px] text-gray-500 block">{activeLoans.length} Active Loan(s)</span>
        </div>
        <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-4 space-y-1 shadow-sm">
          <span className="text-gray-400 text-[10px] font-semibold uppercase tracking-wider block">Accrued Interest Due</span>
          <span className="text-lg font-bold text-red-500 block">₹ {totalOutstandingInterest.toLocaleString('en-IN')}</span>
          <span className="text-[9px] text-gray-500 block">Daily Reducing Balance</span>
        </div>
        <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-4 space-y-1 shadow-sm">
          <span className="text-gray-400 text-[10px] font-semibold uppercase tracking-wider block">Pledged Gold Collateral</span>
          <span className="text-lg font-bold text-[#2563EB] block">{totalGoldWeight.toFixed(2)} g</span>
          <span className="text-[9px] text-gray-500 block">Valued @ ₹ {totalGoldValuation.toLocaleString('en-IN')}</span>
        </div>
        <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-4 space-y-1 shadow-sm">
          <span className="text-gray-400 text-[10px] font-semibold uppercase tracking-wider block">KYC Verification</span>
          <span className={`text-md font-bold block uppercase mt-1 ${
            customer.kyc_status === 'Approved' ? 'text-emerald-600' :
            customer.kyc_status === 'Rejected' ? 'text-red-500' : 'text-amber-500'
          }`}>
            {customer.kyc_status || 'Pending'}
          </span>
          <span className="text-[9px] text-gray-500 block">Face Match: {customer.face_match_score || 0}%</span>
        </div>
      </div>

      {/* Tabs Selection Row */}
      <div className="border-b border-[#E5E7EB] flex flex-wrap gap-1">
        {[
          { id: 'profile', label: 'Profile & KYC', icon: User },
          { id: 'loans', label: `Loans (${loans.length})`, icon: Coins },
          { id: 'gold', label: `Gold Collateral (${goldItems.length})`, icon: Layers },
          { id: 'payments', label: `Payments (${payments.length})`, icon: DollarSign },
          { id: 'documents', label: 'Secure DMS Locker', icon: FileText },
          { id: 'communication', label: 'Communications & Chat', icon: MessageSquare },
          { id: 'timeline', label: 'Audit Timeline', icon: History }
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-4 py-2.5 border-b-2 text-xs font-bold uppercase tracking-wider transition-all ${
                activeTab === tab.id
                  ? 'border-[#2563EB] text-[#2563EB]'
                  : 'border-transparent text-gray-500 hover:text-gray-900'
              }`}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-6 shadow-xl">

        {/* Tab 1: Profile & KYC */}
        {activeTab === 'profile' && (
          <div className="space-y-6 text-xs text-gray-600">
            {/* Kyc Action Banner */}
            {customer.kyc_status === 'Submitted' && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="text-amber-500 shrink-0" size={16} />
                  <div>
                    <span className="font-bold text-gray-900 block">KYC Submitted — Verification Required</span>
                    <span className="text-gray-600">Face Match score is verified at {customer.face_match_score || 0}%. A manager must approve or reject this dossier.</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleKycApprove}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-bold uppercase text-[10px]"
                  >
                    Approve KYC
                  </button>
                  <button
                    onClick={() => setShowRejectKycModal(true)}
                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded font-bold uppercase text-[10px]"
                  >
                    Reject KYC
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Profile Details */}
              <div className="lg:col-span-2 space-y-4">
                <h3 className="text-sm font-bold text-[#2563EB] font-outfit border-b border-[#E5E7EB] pb-2 uppercase tracking-wider">Demographic Info</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-gray-400 block text-[10px]">Email Address</span>
                    <span className="text-gray-900 font-medium">{customer.email || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px]">Date of Birth</span>
                    <span className="text-gray-900 font-medium">{customer.date_of_birth || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px]">Gender</span>
                    <span className="text-gray-900 font-medium">{customer.gender || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px]">Marital Status</span>
                    <span className="text-gray-900 font-medium">{customer.marital_status || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px]">Occupation</span>
                    <span className="text-gray-900 font-medium">{customer.occupation || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px]">Monthly Income</span>
                    <span className="text-gray-900 font-medium">{customer.monthly_income ? `₹ ${customer.monthly_income.toLocaleString('en-IN')}` : 'N/A'}</span>
                  </div>
                </div>

                <h3 className="text-sm font-bold text-[#2563EB] font-outfit border-b border-[#E5E7EB] pb-2 uppercase tracking-wider pt-2">Identity Proofs</h3>
                <div className="grid grid-cols-2 gap-4 font-mono">
                  <div>
                    <span className="text-gray-400 block text-[10px] font-sans">Aadhaar (National ID)</span>
                    <span className="text-gray-900 font-bold">{customer.national_id}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 block text-[10px] font-sans">PAN Card Number</span>
                    <span className="text-gray-900 uppercase font-bold">{customer.pan_number || 'N/A'}</span>
                  </div>
                </div>

                <h3 className="text-sm font-bold text-[#2563EB] font-outfit border-b border-[#E5E7EB] pb-2 uppercase tracking-wider pt-2">Residential Address</h3>
                <div>
                  <span className="text-gray-400 block text-[10px]">Full Address</span>
                  <span className="text-gray-900 leading-relaxed">{customer.address}</span>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div>
                      <span className="text-gray-400 text-[9px]">City/Town</span>
                      <span className="block text-gray-900 font-medium">{customer.city || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 text-[9px]">District</span>
                      <span className="block text-gray-900 font-medium">{customer.district || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 text-[9px]">State</span>
                      <span className="block text-gray-900 font-medium">{customer.state || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 text-[9px]">Pincode</span>
                      <span className="block text-gray-900 font-medium">{customer.pin_code || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Nominee & Verification info */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-[#2563EB] font-outfit border-b border-[#E5E7EB] pb-2 uppercase tracking-wider">Nominee Information</h3>
                {customer.nominee_name ? (
                  <div className="space-y-2">
                    <div>
                      <span className="text-gray-400 block text-[10px]">Nominee Name</span>
                      <span className="text-gray-900 font-medium">{customer.nominee_name}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-gray-400 block text-[10px]">Relationship</span>
                        <span className="text-gray-900 font-medium">{customer.nominee_relation}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block text-[10px]">Nominee Contact</span>
                        <span className="text-gray-900 font-medium font-mono">{customer.nominee_mobile}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <span className="text-gray-400 italic block">No Nominee details specified.</span>
                )}

                <h3 className="text-sm font-bold text-[#2563EB] font-outfit border-b border-[#E5E7EB] pb-2 uppercase tracking-wider pt-2">KYC Status</h3>
                <div className="space-y-2 bg-[#F8FAFC] p-3 rounded-lg border border-[#E5E7EB]">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Biometric Face Score:</span>
                    <span className="text-gray-900 font-bold">{customer.face_match_score || 0}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">KYC Status:</span>
                    <span className="text-emerald-600 font-bold">{customer.kyc_status || 'Pending'}</span>
                  </div>
                  {customer.kyc_approved_by && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Approved By:</span>
                      <span className="text-gray-900 font-medium">{customer.kyc_approved_by}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Loans */}
        {activeTab === 'loans' && (
          <div className="space-y-4">
            <div className="border-b border-[#E5E7EB] pb-2 flex justify-between items-center">
              <h3 className="text-xs font-bold text-[#2563EB] uppercase tracking-wider">
                Customer Loan Ledger ({loans.length})
              </h3>
              <button
                onClick={() => router.push(`/admin/loans/new?customerId=${customer.id}`)}
                className="px-3 py-1 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded text-[10px] font-bold uppercase transition flex items-center gap-1"
              >
                <Coins size={12} /> + Originate New Loan
              </button>
            </div>

            {loans.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-xs">
                No loans registered under this customer profile.
              </div>
            ) : (
              <div className="space-y-4">
                {loans.map((ln) => {
                  const remaining = ln.principal_amount - (ln.total_principal_paid || 0);
                  const isSettled = ['Settled', 'Closed', 'Cancelled'].includes(ln.status);
                  return (
                    <div
                      key={ln.id}
                      className="p-5 rounded-xl bg-[#F8FAFC] border border-[#E5E7EB] hover:border-[#2563EB]/40 transition space-y-4 shadow-sm"
                    >
                      <div className="flex flex-wrap justify-between items-start gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-gray-900 text-sm font-mono">{ln.loan_number}</h4>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                              isSettled ? 'bg-gray-100 text-gray-600' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}>
                              {ln.status}
                            </span>
                          </div>
                          {ln.origination_date && (
                            <span className="text-[11px] text-gray-500">
                              Disbursed: {new Date(ln.origination_date).toLocaleDateString('en-IN')} &middot; Maturity: {ln.maturity_date ? new Date(ln.maturity_date).toLocaleDateString('en-IN') : 'N/A'}
                            </span>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex flex-wrap gap-2">
                          {!isSettled && (
                            <button
                              onClick={() => openRepaymentModal(ln.id)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold uppercase tracking-wider transition flex items-center gap-1 shadow-sm"
                            >
                              <Coins size={12} />
                              Record Repayment
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setPreviewUrl(getPdfApiUrl({ type: 'ticket', loanId: ln.id }));
                              setPreviewTitle(`Gold Loan Pawn Ticket - ${ln.loan_number}`);
                              setIsPreviewOpen(true);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[10px] font-bold uppercase tracking-wider transition flex items-center gap-1 font-outfit"
                          >
                            <Printer size={12} />
                            Pawn Ticket
                          </button>
                          <button
                            onClick={() => {
                              downloadPdfDocument({ type: 'ticket', loanId: ln.id }, `PGF_PawnTicket_${ln.loan_number}.pdf`);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 text-[10px] font-bold uppercase tracking-wider transition flex items-center gap-1 font-outfit"
                          >
                            <Download size={12} />
                            Download Bill PDF
                          </button>
                          <button
                            onClick={() => router.push(`/admin/loans/${ln.id}`)}
                            className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-[10px] font-bold uppercase tracking-wider transition"
                          >
                            View Dossier
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs pt-3 border-t border-gray-200">
                        <div>
                          <span className="text-gray-400 block text-[10px]">Original Disbursal</span>
                          <span className="text-gray-900 font-bold">₹ {ln.principal_amount.toLocaleString('en-IN')}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 block text-[10px]">Outstanding Principal</span>
                          <span className="text-gray-900 font-bold">₹ {remaining.toLocaleString('en-IN')}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 block text-[10px]">Interest Rate (APR)</span>
                          <span className="text-gray-900 font-bold">{ln.interest_rate_apr}% APR</span>
                        </div>
                        <div>
                          <span className="text-gray-400 block text-[10px]">Accrued Interest Due</span>
                          <span className="text-red-500 font-bold">₹ {(ln.outstanding_interest || 0).toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Gold Collateral */}
        {activeTab === 'gold' && (
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-[#2563EB] uppercase tracking-wider border-b border-[#E5E7EB] pb-2 flex justify-between items-center">
              <span>Pledged Gold Ornaments Inventory ({goldItems.length})</span>
              <span className="text-[10px] text-gray-500 font-normal">Consolidated Valuation: ₹ {totalGoldValuation.toLocaleString('en-IN')}</span>
            </h3>

            {goldItems.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-xs">
                No gold collateral items recorded for this customer.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {goldItems.map((g) => (
                  <div key={g.id} className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E5E7EB] space-y-3 shadow-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-gray-900 text-xs">{g.item_description}</h4>
                        <span className="text-[10px] text-gray-500 font-mono">Storage Bin: {g.storage_bin_id}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200">
                          {g.purity_karat || '22K'}
                        </span>
                        {g.hallmark && (
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase bg-blue-50 text-blue-700 border border-blue-200">
                            916 Hallmark
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs pt-2 border-t border-gray-200">
                      <div>
                        <span className="text-gray-400 block text-[9px]">Gross Weight</span>
                        <span className="text-gray-900 font-bold">{g.gross_weight} g</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block text-[9px]">Net Weight</span>
                        <span className="text-[#2563EB] font-bold">{g.net_weight || g.gross_weight} g</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block text-[9px]">Stone Deduct</span>
                        <span className="text-gray-600 font-medium">{g.stone_weight || 0} g</span>
                      </div>
                    </div>

                    {/* Photos Preview if available */}
                    {(g.front_photo_url || g.back_photo_url) && (
                      <div className="flex gap-2 pt-2 border-t border-gray-100">
                        {g.front_photo_url && (
                          <img
                            src={g.front_photo_url}
                            alt="Front View"
                            className="h-16 w-20 object-cover rounded-lg border border-gray-200 shadow-sm cursor-pointer hover:scale-105 transition"
                            onClick={() => window.open(g.front_photo_url!, '_blank')}
                          />
                        )}
                        {g.back_photo_url && (
                          <img
                            src={g.back_photo_url}
                            alt="Back View"
                            className="h-16 w-20 object-cover rounded-lg border border-gray-200 shadow-sm cursor-pointer hover:scale-105 transition"
                            onClick={() => window.open(g.back_photo_url!, '_blank')}
                          />
                        )}
                      </div>
                    )}

                    <div className="pt-2 flex justify-between items-center text-xs bg-white p-2.5 rounded-lg border border-gray-200">
                      <div>
                        <span className="text-gray-400 text-[10px] block">Appraisal Valuation</span>
                        <strong className="text-gray-900 font-bold">₹ {g.valuation_inr.toLocaleString('en-IN')}</strong>
                      </div>
                      {g.loan_id && (
                        <button
                          onClick={() => {
                            setPreviewUrl(getPdfApiUrl({ type: 'ticket', loanId: g.loan_id }));
                            setPreviewTitle(`Pawn Ticket / Collateral Document`);
                            setIsPreviewOpen(true);
                          }}
                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-[#2563EB] rounded text-[10px] font-bold uppercase transition flex items-center gap-1 border border-blue-200"
                        >
                          <Download size={10} />
                          Pawn Bill
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Payments History */}
        {activeTab === 'payments' && (
          <div className="space-y-4">
            <div className="border-b border-[#E5E7EB] pb-2 flex justify-between items-center">
              <h3 className="text-xs font-bold text-[#2563EB] uppercase tracking-wider">
                Repayments Ledger ({payments.length})
              </h3>
              <div className="flex gap-2 items-center">
                <span className="text-[10px] text-gray-500 font-normal">Interest Collected: ₹ {totalInterestPaid.toLocaleString('en-IN')}</span>
                {activeLoans.length > 0 && (
                  <button
                    onClick={() => openRepaymentModal()}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-bold uppercase transition flex items-center gap-1"
                  >
                    <Coins size={12} /> Record Repayment
                  </button>
                )}
              </div>
            </div>

            {payments.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-xs">
                No repayments have been recorded for this customer.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-gray-400 uppercase tracking-wider border-b border-[#E5E7EB] bg-[#F8FAFC]/40">
                      <th className="p-3">Receipt No</th>
                      <th className="p-3">Date</th>
                      <th className="p-3">Amount Paid</th>
                      <th className="p-3">Principal</th>
                      <th className="p-3">Interest</th>
                      <th className="p-3">Penalty</th>
                      <th className="p-3">Mode</th>
                      <th className="p-3 text-right">Receipt Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB]/40">
                    {payments.map((p) => (
                      <tr key={p.id} className="text-gray-600 hover:bg-[#F3F4F6]/40">
                        <td className="p-3 font-mono font-bold text-gray-900">{p.receipt_number || p.id}</td>
                        <td className="p-3">{new Date(p.payment_date).toLocaleDateString('en-IN')}</td>
                        <td className="p-3 font-bold text-gray-900">₹ {p.amount_paid.toLocaleString('en-IN')}</td>
                        <td className="p-3 text-emerald-600 font-medium">₹ {p.principal_portion.toLocaleString('en-IN')}</td>
                        <td className="p-3 text-[#2563EB] font-medium">₹ {p.interest_portion.toLocaleString('en-IN')}</td>
                        <td className="p-3 text-red-500 font-medium">₹ {(p.penalty_amount || 0).toLocaleString('en-IN')}</td>
                        <td className="p-3 uppercase font-mono text-[11px]">{p.mode}</td>
                        <td className="p-3 text-right flex justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setPreviewUrl(getPdfApiUrl({ type: 'receipt', paymentId: p.id || p.receipt_number, customerId: customer.id }));
                              setPreviewTitle(`Payment Receipt - ${p.receipt_number || p.id}`);
                              setIsPreviewOpen(true);
                            }}
                            className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded border border-blue-200 text-[10px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                            title="Preview Receipt"
                          >
                            <Printer size={10} />
                            Receipt
                          </button>
                          <button
                            onClick={() => {
                              downloadPdfDocument({ type: 'receipt', paymentId: p.id || p.receipt_number, customerId: customer.id }, `PGF_Receipt_${p.receipt_number || p.id}.pdf`);
                            }}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-300 text-[10px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                            title="Download PDF"
                          >
                            <Download size={10} />
                            PDF
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 5: Secure DMS Locker */}
        {activeTab === 'documents' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center border-b border-[#E5E7EB] pb-2">
              <h3 className="text-xs font-bold text-[#2563EB] uppercase tracking-wider">
                Digital Document Locker
              </h3>
              <label className="px-3.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#2563EB] text-[10px] font-bold uppercase tracking-wider cursor-pointer border border-blue-200 flex items-center gap-1">
                <Upload size={12} />
                Upload New Doc
                <input type="file" className="hidden" onChange={handleSimulateDocUpload} />
              </label>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              {/* Photo */}
              <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E5E7EB] flex flex-col justify-between items-center text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-[#2563EB] border border-blue-200">
                  <User size={20} />
                </div>
                <div>
                  <span className="font-bold text-gray-900 block">Profile Photo</span>
                  <span className="text-[9px] text-gray-400">photo.jpg</span>
                </div>
                {customer.photo_url ? (
                  <a href={customer.photo_url} target="_blank" className="text-[10px] text-[#2563EB] hover:underline font-semibold">View File</a>
                ) : (
                  <span className="text-[10px] text-gray-400">On file</span>
                )}
              </div>

              {/* Aadhaar Copy */}
              <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E5E7EB] flex flex-col justify-between items-center text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-[#2563EB] border border-blue-200">
                  <Shield size={20} />
                </div>
                <div>
                  <span className="font-bold text-gray-900 block">Aadhaar Card Copy</span>
                  <span className="text-[9px] text-gray-400">aadhaar_front.pdf</span>
                </div>
                <span className="text-[10px] text-emerald-600 font-semibold uppercase">Verified</span>
              </div>

              {/* Signature */}
              <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E5E7EB] flex flex-col justify-between items-center text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-[#2563EB] border border-blue-200">
                  <PenTool size={20} />
                </div>
                <div>
                  <span className="font-bold text-gray-900 block">Digital Signature</span>
                  <span className="text-[9px] text-gray-400">sig_draw.png</span>
                </div>
                {customer.signature_url ? (
                  <a href={customer.signature_url} target="_blank" className="text-[10px] text-[#2563EB] hover:underline font-semibold">View File</a>
                ) : (
                  <span className="text-[10px] text-gray-400">Signed</span>
                )}
              </div>

              {/* Dynamically uploaded docs */}
              {uploadedDocs.map((doc, idx) => (
                <div key={idx} className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E5E7EB] flex flex-col justify-between items-center text-center space-y-3">
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-[#2563EB] border border-blue-200">
                    <FileText size={20} />
                  </div>
                  <div>
                    <span className="font-bold text-gray-900 block truncate max-w-[100px]">{doc.name}</span>
                    <span className="text-[9px] text-gray-400">{doc.type} &middot; {doc.date}</span>
                  </div>
                  <span className="text-[10px] text-[#2563EB] font-semibold">Uploaded</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 6: Communications & Direct Chat */}
        {activeTab === 'communication' && (
          <div className="space-y-6">
            {/* DIRECT CHAT / IN-APP MESSAGING COMPOSER */}
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 space-y-4 shadow-sm">
              <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                <div className="flex items-center gap-2">
                  <MessageSquare size={16} className="text-[#2563EB]" />
                  <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                    Direct Customer Chat &amp; Notification Messenger
                  </h3>
                </div>
                <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Connected to Customer Portal
                </span>
              </div>

              <form onSubmit={handleSendChatMessage} className="space-y-3">
                <textarea
                  rows={3}
                  required
                  placeholder={`Write an instant notification or chat message to ${customer.name}...`}
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  className="w-full bg-[#F9FAFB] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 text-xs rounded-xl p-3.5 outline-none transition"
                />

                <div className="flex flex-wrap justify-between items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!chatMessage.trim()) {
                        alert('Please type a message first.');
                        return;
                      }
                      window.open(`https://wa.me/91${customer.phone_primary}?text=${encodeURIComponent(chatMessage)}`, '_blank');
                    }}
                    className="px-3 py-2 bg-green-50 hover:bg-green-100 text-green-700 border border-green-300 rounded-lg text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <MessageSquare size={13} />
                    Share on WhatsApp
                  </button>

                  <button
                    type="submit"
                    disabled={chatSending || !chatMessage.trim()}
                    className="px-5 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-gray-300 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition flex items-center gap-1.5 shadow"
                  >
                    {chatSending ? (
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <Send size={13} />
                    )}
                    Send In-App Notification
                  </button>
                </div>
              </form>
            </div>

            {/* In-App Notifications Feed */}
            <div>
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider border-b border-[#E5E7EB] pb-2 flex justify-between items-center">
                <span>In-App Messages &amp; Notification History</span>
                <span className="text-[10px] text-gray-500 font-normal">{notifications.length} Messages</span>
              </h3>

              {notifications.length === 0 ? (
                <div className="p-6 text-center text-gray-400 text-xs mt-2 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  No notifications or messages sent yet.
                </div>
              ) : (
                <div className="space-y-2.5 text-xs mt-3">
                  {notifications.map((n) => (
                    <div key={n.id} className="p-3.5 rounded-xl bg-white border border-gray-200 shadow-sm flex items-start gap-3">
                      <div className="p-2 bg-blue-50 rounded-lg text-[#2563EB] border border-blue-100">
                        <Mail size={14} />
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex justify-between items-center">
                          <strong className="text-gray-900 text-xs">{n.title}</strong>
                          <span className="text-[10px] text-gray-400">{(n.sent_at || (n as any).created_at) ? new Date(n.sent_at || (n as any).created_at).toLocaleString('en-IN') : 'Recent'}</span>
                        </div>
                        <p className="text-gray-600 text-[11px] leading-relaxed">{n.message}</p>
                        <div className="flex items-center gap-2 pt-1">
                          <span className="text-[9px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full font-mono">
                            Channel: {n.channel || 'In_App'}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              window.open(`https://wa.me/91${customer.phone_primary}?text=${encodeURIComponent(n.message)}`, '_blank');
                            }}
                            className="text-[10px] text-green-700 hover:underline font-semibold flex items-center gap-1"
                          >
                            <Share2 size={10} /> Send via WhatsApp
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* WhatsApp Due Reminder Logs */}
            <div>
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider border-b border-[#E5E7EB] pb-2 flex items-center justify-between">
                <span>WhatsApp Due Reminders Log</span>
                <span className="text-[10px] text-gray-500 font-normal">{whatsappHistory.length} Dispatches</span>
              </h3>

              {whatsappHistory.length === 0 ? (
                <div className="p-6 text-center text-gray-400 text-xs bg-gray-50 rounded-xl border border-dashed border-gray-200 mt-3">
                  No automated WhatsApp due reminders logged for this customer.
                </div>
              ) : (
                <div className="space-y-3 mt-3">
                  {whatsappHistory.map((w, idx) => (
                    <div key={w.id || idx} className="p-4 rounded-xl bg-white border border-gray-200 shadow-sm space-y-2 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            w.stage === 'overdue' ? 'bg-red-100 text-red-700' :
                            w.stage === 'due_today' ? 'bg-amber-100 text-amber-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {w.stage}
                          </span>
                          <span className="font-mono text-gray-600 font-bold">{w.loan_number}</span>
                          <span className="text-gray-400">&middot; Due: {w.due_date}</span>
                        </div>
                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          {w.status}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-100 font-mono text-[11px] text-gray-700 whitespace-pre-line">
                        {w.message_text}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 7: Audit Timeline */}
        {activeTab === 'timeline' && (
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-[#2563EB] uppercase tracking-wider border-b border-[#E5E7EB] pb-2">
              System Audit Trails
            </h3>

            {auditLogs.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-xs">
                No historical logs recorded.
              </div>
            ) : (
              <div className="relative border-l border-gray-300 pl-4 ml-2 space-y-6 py-2 text-xs">
                {auditLogs.map((log) => (
                  <div key={log.id} className="relative">
                    <div className="absolute -left-[21px] mt-1.5 w-3.5 h-3.5 rounded-full bg-white border-2 border-[#2563EB] flex items-center justify-center"></div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <strong className="text-gray-900 text-xs font-mono uppercase tracking-wide">{log.action_type}</strong>
                        <span className="text-[9px] text-gray-400">{new Date(log.timestamp).toLocaleString('en-IN')}</span>
                      </div>
                      <p className="text-gray-500">Affected Entity: {log.affected_entity} ({log.affected_entity_id})</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* QUICK REPAYMENT RECORD MODAL */}
      {showRepaymentModal && selectedRepayLoan && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-2xl max-w-lg w-full p-6 space-y-4 text-xs shadow-2xl">
            <div className="flex justify-between items-center border-b border-gray-200 pb-3">
              <div className="flex items-center gap-2 text-[#2563EB]">
                <Coins size={18} />
                <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900">
                  Record Loan Repayment
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRepaymentModal(false)}
                className="text-gray-400 hover:text-gray-700"
              >
                <X size={18} />
              </button>
            </div>

            {repaymentError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-xs flex items-center gap-1.5">
                <AlertTriangle size={14} className="shrink-0" />
                <span>{repaymentError}</span>
              </div>
            )}

            <form onSubmit={handleRecordRepaymentSubmit} className="space-y-4">
              {/* Select Loan Account */}
              <div className="space-y-1.5">
                <label className="text-gray-700 font-bold block">Select Loan Account *</label>
                <select
                  value={repaymentLoanId}
                  onChange={(e) => {
                    setRepaymentLoanId(e.target.value);
                    const l = loans.find(ln => ln.id === e.target.value);
                    if (l) {
                      const intDue = l.outstanding_interest || 0;
                      setRepaymentAmount(intDue > 0 ? intDue : 5000);
                    }
                  }}
                  className="w-full bg-[#F9FAFB] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 text-xs rounded-lg px-3 py-2.5 outline-none font-bold font-mono"
                >
                  {loans.filter(l => !['Settled', 'Closed', 'Cancelled'].includes(l.status)).map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.loan_number} — Principal: ₹{(l.principal_amount - (l.total_principal_paid || 0)).toLocaleString('en-IN')} &middot; Interest: ₹{(l.outstanding_interest || 0).toLocaleString('en-IN')}
                    </option>
                  ))}
                </select>
              </div>

              {/* Repayment Amount & Mode */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-gray-700 font-bold block">Repayment Amount (₹) *</label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      placeholder="Enter repayment amount"
                      value={repaymentAmount}
                      onChange={(e) => setRepaymentAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      className="w-full bg-[#F9FAFB] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 text-sm font-bold rounded-lg pl-7 pr-3 py-2.5 outline-none"
                    />
                    <span className="absolute left-2.5 top-2.5 text-gray-400 font-bold">₹</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-gray-700 font-bold block">Payment Mode *</label>
                  <select
                    value={repaymentMode}
                    onChange={(e) => setRepaymentMode(e.target.value)}
                    className="w-full bg-[#F9FAFB] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 text-xs rounded-lg px-3 py-2.5 outline-none font-semibold"
                  >
                    <option value="UPI">UPI Transfer</option>
                    <option value="Cash">Cash at Counter</option>
                    <option value="Bank_Transfer">Bank Transfer</option>
                    <option value="Debit_Card">Debit Card</option>
                    <option value="Credit_Card">Credit Card</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
              </div>

              {/* Date and Transaction Ref */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-gray-700 font-bold block">Payment Date *</label>
                  <input
                    type="date"
                    required
                    value={repaymentDate}
                    onChange={(e) => setRepaymentDate(e.target.value)}
                    className="w-full bg-[#F9FAFB] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 text-xs rounded-lg px-3 py-2 outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-gray-700 font-bold block">Transaction Reference / UTR</label>
                  <input
                    type="text"
                    value={repaymentTxnId}
                    onChange={(e) => setRepaymentTxnId(e.target.value)}
                    placeholder="e.g. AXISUPI9928"
                    className="w-full bg-[#F9FAFB] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 text-xs rounded-lg px-3 py-2 outline-none font-mono"
                  />
                </div>
              </div>

              {/* Live Repayment Allocation Split Preview */}
              <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-3 space-y-2">
                <span className="text-[10px] text-[#2563EB] font-bold uppercase tracking-wider block">
                  Automatic Ledger Allocation Split:
                </span>
                <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                  <div className="bg-white p-2 rounded-lg border border-blue-100">
                    <span className="text-gray-400 block text-[9px]">Interest Cleared</span>
                    <span className="font-bold text-[#2563EB]">₹ {splitInterestCleared.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-blue-100">
                    <span className="text-gray-400 block text-[9px]">Principal Cleared</span>
                    <span className="font-bold text-emerald-700">₹ {splitPrincipalCleared.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-blue-100">
                    <span className="text-gray-400 block text-[9px]">Remaining Balance</span>
                    <span className="font-bold text-gray-900">₹ {(splitNewPrincipal + splitNewInterest).toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-gray-700 font-bold block">Payment Remarks</label>
                <input
                  type="text"
                  value={repaymentRemarks}
                  onChange={(e) => setRepaymentRemarks(e.target.value)}
                  className="w-full bg-[#F9FAFB] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 text-xs rounded-lg px-3 py-2 outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowRepaymentModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={repaymentLoading || typeof repaymentAmount !== 'number' || repaymentAmount <= 0}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white rounded-lg font-bold uppercase tracking-wider flex items-center gap-1.5 shadow"
                >
                  {repaymentLoading ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <Receipt size={14} />
                  )}
                  Save &amp; Generate Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Block Client Modal */}
      {showBlockModal && (
        <div className="fixed inset-0 z-50 bg-[#F8FAFC]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl max-w-md w-full p-6 space-y-4 text-xs shadow-2xl">
            <h3 className="text-sm font-bold text-red-600 uppercase tracking-wider border-b border-[#E5E7EB] pb-2">
              Block Customer Account
            </h3>
            <div className="space-y-1.5">
              <label className="text-gray-700 font-bold">Reason for Blacklisting / Blocking *</label>
              <textarea
                rows={3}
                required
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="Specify regulatory, payment default, or fraud reason..."
                className="w-full bg-[#F9FAFB] border border-[#E5E7EB] focus:border-red-500 text-gray-900 text-xs rounded-lg p-3 outline-none"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowBlockModal(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBlockCustomer}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded font-bold uppercase shadow"
              >
                Confirm Block
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject KYC Modal */}
      {showRejectKycModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-xl max-w-md w-full p-6 space-y-4 text-xs shadow-2xl">
            <h3 className="text-sm font-bold text-red-600 uppercase tracking-wider border-b border-gray-200 pb-2">
              Reject KYC Verification Dossier
            </h3>
            <div className="space-y-1.5">
              <label className="text-gray-700 font-bold">Rejection Reason *</label>
              <textarea
                rows={3}
                required
                value={rejectKycReason}
                onChange={(e) => setRejectKycReason(e.target.value)}
                placeholder="Blurry portrait photo, invalid signature match, incorrect PAN, etc..."
                className="w-full bg-[#F9FAFB] border border-gray-300 focus:border-red-500 text-gray-900 text-xs rounded-lg p-3 outline-none"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowRejectKycModal(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleKycReject}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded font-bold uppercase shadow"
              >
                Reject Dossier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Branch Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-xl max-w-md w-full p-6 space-y-4 text-xs shadow-2xl">
            <h3 className="text-sm font-bold text-[#2563EB] uppercase tracking-wider border-b border-gray-200 pb-2">
              Transfer Customer Branch Assignment
            </h3>
            <div className="space-y-1.5">
              <label className="text-gray-700 font-bold">Select Target Destination Branch *</label>
              <select
                required
                value={targetBranchId}
                onChange={(e) => setTargetBranchId(e.target.value)}
                className="w-full bg-[#F9FAFB] border border-gray-300 focus:border-[#2563EB] text-gray-900 text-xs rounded px-3 py-2 outline-none font-semibold"
              >
                <option value="">Select Target Branch</option>
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded font-bold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleTransferBranch}
                className="px-4 py-2 bg-[#2563EB] text-white rounded font-bold uppercase shadow"
              >
                Confirm Transfer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Login Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-2xl max-w-md w-full p-6 space-y-4 text-xs shadow-2xl">
            <h3 className="text-sm font-bold text-[#2563EB] uppercase tracking-wider border-b border-gray-200 pb-2 flex items-center gap-2">
              <Key size={16} />
              Configure Customer Login Credentials
            </h3>
            <p className="text-gray-500 text-xs">
              Set or update the password for customer <strong>{customer.name}</strong> to login to the Customer Portal.
            </p>

            <div className="bg-blue-50/60 p-3 rounded-xl border border-blue-100 space-y-1 font-mono text-[11px]">
              <div className="text-gray-700"><strong>Customer ID / Mobile:</strong> {customer.phone_primary}</div>
              <div className="text-gray-700"><strong>Customer Name:</strong> {customer.name}</div>
            </div>

            <div className="space-y-1.5">
              <label className="text-gray-700 font-bold block">New Password / PIN (Min 6 chars) *</label>
              <input
                type="text"
                required
                placeholder="e.g. Pass@1234 or 6-digit PIN"
                value={customerPassword}
                onChange={(e) => setCustomerPassword(e.target.value)}
                className="w-full bg-[#F9FAFB] border border-gray-300 focus:border-[#2563EB] text-gray-900 text-xs rounded-lg px-3 py-2.5 outline-none font-mono font-bold"
              />
            </div>

            <div className="flex flex-wrap justify-between items-center gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  const shareText = `Dear ${customer.name}, your Pavithra Gold Finance customer portal login details are:\n\nMobile: ${customer.phone_primary}\nPassword: ${customerPassword || 'As configured'}\n\nLogin URL: ${window.location.origin}`;
                  window.open(`https://wa.me/91${customer.phone_primary}?text=${encodeURIComponent(shareText)}`, '_blank');
                }}
                className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-lg border border-emerald-200 transition text-[11px] flex items-center gap-1.5"
              >
                <MessageSquare size={14} /> WhatsApp Credentials
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={handleSaveCustomerPassword}
                  className="px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-bold rounded-lg transition shadow"
                >
                  Save Password
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PDF Document Preview Modal */}
      <PDFPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        pdfUrl={previewUrl}
        title={previewTitle}
      />
    </div>
  );
}
