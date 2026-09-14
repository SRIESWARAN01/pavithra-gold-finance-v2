'use client';

import React, { useState, useEffect } from 'react';
import { 
  ChevronRight, 
  BookOpen, 
  Calendar, 
  Coins, 
  Plus, 
  Printer, 
  TrendingUp, 
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  TrendingDown,
  CheckCircle2,
  Download
} from 'lucide-react';
import { isFirebaseConfigured, getCurrentProfile } from '@/lib/auth';
import { collection, getDocs, query, orderBy, limit, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { exportToExcel } from '@/lib/excel';

export default function AccountingERP() {
  const [activeTab, setActiveTab] = useState<'daybook' | 'cashbook' | 'ledger' | 'trial' | 'balance_sheet' | 'profit_loss'>('daybook');
  const [loading, setLoading] = useState(false);
  
  // Ledger accounts database
  const [journalEntries, setJournalEntries] = useState<any[]>([]);

  useEffect(() => {
    async function loadJournalEntries() {
      setLoading(true);
      try {
        if (isFirebaseConfigured()) {
          const q = query(
            collection(db, 'accounting_journals'),
            orderBy('date', 'desc'),
            limit(100)
          );
          const snap = await getDocs(q);
          if (!snap.empty) {
            const list = snap.docs.map((d) => ({
              id: d.id,
              ...d.data()
            })) as any[];
            setJournalEntries(list);
          } else {
            setJournalEntries([]);
          }
        } else {
          setJournalEntries([]);
        }
      } catch (err) {
        console.error('Failed to load accounting journals:', err);
      } finally {
        setLoading(false);
      }
    }
    loadJournalEntries();
  }, []);

  // General Ledger Chart of Accounts Definitions
  const defaultLedgerAccounts = [
    { code: '1001', name: 'Bank Clearing Account', group: 'Current Assets', type: 'Debit' },
    { code: '1002', name: 'Vault Petty Cash', group: 'Current Assets', type: 'Debit' },
    { code: '1200', name: 'Loan Principal Asset Acc', group: 'Loans Portfolio Assets', type: 'Debit' },
    { code: '2001', name: 'GST Output Tax Liability', group: 'Current Liabilities', type: 'Credit' },
    { code: '3001', name: 'Owner Equity Capital Acc', group: 'Capital Account Equity', type: 'Credit' },
    { code: '4001', name: 'Interest Revenue Account', group: 'Operating Revenues', type: 'Credit' },
    { code: '4002', name: 'Processing Fees Account', group: 'Operating Revenues', type: 'Credit' }
  ];

  // Dynamic Ledger calculations based on Firestore entries
  const ledgerAccounts = defaultLedgerAccounts.map(acc => {
    let debit = 0;
    let credit = 0;
    
    journalEntries.forEach(entry => {
      if (entry.debitAcc === acc.name) {
        debit += parseFloat(entry.amount) || 0;
      }
      if (entry.creditAcc === acc.name) {
        credit += parseFloat(entry.amount) || 0;
      }
    });

    const balance = acc.type === 'Debit' ? (debit - credit) : (credit - debit);

    return {
      ...acc,
      debit,
      credit,
      balance,
    };
  });

  // Calculations for Trial Balance & cash flow summaries
  const totalDebits = ledgerAccounts.reduce((acc, curr) => acc + (curr.type === 'Debit' ? curr.balance : 0), 0);
  const totalCredits = ledgerAccounts.reduce((acc, curr) => acc + (curr.type === 'Credit' ? curr.balance : 0), 0);
  
  // Dashboard Widget metrics computed dynamically
  const activeAssets = ledgerAccounts.filter(a => a.group === 'Current Assets' || a.group === 'Loans Portfolio Assets')
                                     .reduce((sum, a) => sum + a.balance, 0);
  const totalRevenue = ledgerAccounts.filter(a => a.group === 'Operating Revenues')
                                     .reduce((sum, a) => sum + a.balance, 0);
  const gstLiability = ledgerAccounts.find(a => a.code === '2001')?.balance || 0;
  const imbalance = Math.abs(totalDebits - totalCredits);

  // Journal Voucher form state
  const [newDesc, setNewDesc] = useState('');
  const [newDebitAcc, setNewDebitAcc] = useState('Bank Clearing Account');
  const [newCreditAcc, setNewCreditAcc] = useState('Interest Revenue Account');
  const [newAmount, setNewAmount] = useState<number | ''>('');
  const [showAddModal, setShowAddModal] = useState(false);

  const handleAddJournalEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDesc || typeof newAmount !== 'number' || newAmount <= 0) return;

    try {
      const adminProfile = await getCurrentProfile();
      const createdBy = adminProfile?.name || 'Owner-PGF';

      const entry = {
        date: new Date().toISOString().split('T')[0],
        desc: newDesc,
        debitAcc: newDebitAcc,
        creditAcc: newCreditAcc,
        amount: newAmount,
        createdBy
      };

      if (isFirebaseConfigured()) {
        const docRef = await addDoc(collection(db, 'accounting_journals'), entry);
        setJournalEntries(prev => [{ id: docRef.id, ...entry }, ...prev]);
      } else {
        setJournalEntries(prev => [{ id: prev.length + 1, ...entry }, ...prev]);
      }
    } catch (err) {
      console.error('Failed to write journal entry to Firestore:', err);
    }

    setShowAddModal(false);
    setNewDesc('');
    setNewAmount(1000);
  };

  // Excel Export Handler
  const handleExportExcel = () => {
    const today = new Date().toISOString().split('T')[0];

    if (activeTab === 'daybook') {
      const data = journalEntries.map(e => ({
        Date: e.date,
        Description: e.desc,
        'Debit Account (Dr)': e.debitAcc,
        'Credit Account (Cr)': e.creditAcc,
        'Amount (INR)': e.amount,
        'Logged By': e.createdBy
      }));
      exportToExcel(data, `PGF_DayBook_${today}`, 'Day Book');
    } else if (activeTab === 'cashbook') {
      const cashList: any[] = [];
      const bankList: any[] = [];
      journalEntries.forEach(e => {
        if (e.debitAcc === 'Vault Petty Cash' || e.creditAcc === 'Vault Petty Cash') {
          cashList.push({
            Date: e.date,
            Description: e.desc,
            Account: 'Vault Petty Cash',
            Type: e.debitAcc === 'Vault Petty Cash' ? 'Debit (Inflow)' : 'Credit (Outflow)',
            Amount: e.amount
          });
        }
        if (e.debitAcc === 'Bank Clearing Account' || e.creditAcc === 'Bank Clearing Account') {
          bankList.push({
            Date: e.date,
            Description: e.desc,
            Account: 'Bank Clearing Account',
            Type: e.debitAcc === 'Bank Clearing Account' ? 'Debit (Inflow)' : 'Credit (Outflow)',
            Amount: e.amount
          });
        }
      });
      exportToExcel([...cashList, ...bankList], `PGF_CashBook_${today}`, 'Cash Book');
    } else if (activeTab === 'ledger') {
      const data = ledgerAccounts.map(a => ({
        Code: a.code,
        'Account Name': a.name,
        'Asset Group': a.group,
        'Debit Total': a.debit,
        'Credit Total': a.credit,
        'Closing Balance': a.balance,
        Nature: a.type
      }));
      exportToExcel(data, `PGF_LedgersChart_${today}`, 'General Ledgers');
    } else if (activeTab === 'trial') {
      const data = ledgerAccounts.map(a => ({
        Account: a.name,
        'Debit (Dr)': a.type === 'Debit' ? a.balance : 0,
        'Credit (Cr)': a.type === 'Credit' ? a.balance : 0
      }));
      exportToExcel(data, `PGF_TrialBalance_${today}`, 'Trial Balance');
    } else if (activeTab === 'balance_sheet') {
      const bankBal = ledgerAccounts.find(a => a.name === 'Bank Clearing Account')?.balance || 0;
      const cashBal = ledgerAccounts.find(a => a.name === 'Vault Petty Cash')?.balance || 0;
      const loanBal = ledgerAccounts.find(a => a.name === 'Loan Principal Asset Acc')?.balance || 0;
      const gstBal = ledgerAccounts.find(a => a.name === 'GST Output Tax Liability')?.balance || 0;
      const equityBal = ledgerAccounts.find(a => a.name === 'Owner Equity Capital Acc')?.balance || 0;
      const netProfit = totalRevenue;

      const data = [
        { Category: 'Assets', Account: 'Bank Clearing Account', Amount: bankBal },
        { Category: 'Assets', Account: 'Vault Petty Cash', Amount: cashBal },
        { Category: 'Assets', Account: 'Loan Principal Asset Acc', Amount: loanBal },
        { Category: 'Liabilities', Account: 'GST Output Tax Liability', Amount: gstBal },
        { Category: 'Capital Equity', Account: 'Owner Equity Capital Acc', Amount: equityBal },
        { Category: 'Capital Equity', Account: 'Retained Earnings (Net Profit)', Amount: netProfit }
      ];
      exportToExcel(data, `PGF_BalanceSheet_${today}`, 'Balance Sheet');
    } else if (activeTab === 'profit_loss') {
      const interestRev = ledgerAccounts.find(a => a.name === 'Interest Revenue Account')?.balance || 0;
      const feesRev = ledgerAccounts.find(a => a.name === 'Processing Fees Account')?.balance || 0;
      
      const data = [
        { Category: 'Operating Revenues', Account: 'Interest Revenue Account', Amount: interestRev },
        { Category: 'Operating Revenues', Account: 'Processing Fees Account', Amount: feesRev },
        { Category: 'Operating Expenses', Account: 'Branch Operation Expense', Amount: 0 },
        { Category: 'Operating Summary', Account: 'Net Profit', Amount: interestRev + feesRev }
      ];
      exportToExcel(data, `PGF_ProfitLoss_${today}`, 'Profit & Loss');
    }
  };

  const handleExportPDF = () => {
    window.open(`/api/pdf?type=${activeTab}`, '_blank');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs text-[#2563EB] font-semibold tracking-wider uppercase font-outfit">
        <span>Admin Panel</span>
        <ChevronRight size={12} className="text-gray-400" />
        <span className="text-gray-500">ERP Accounting</span>
        <ChevronRight size={12} className="text-gray-400" />
        <span>General Ledger</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-[#E5E7EB] pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 tracking-wide font-outfit">Double-Entry Financial ERP</h2>
          <p className="text-gray-500 text-xs mt-1">Audit General Ledger accounts, Cash Books, Day Books, and GST liability ledgers in real time.</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <button
            onClick={handleExportExcel}
            className="flex-1 sm:flex-none px-4 py-2 bg-[#F3F4F6] hover:bg-[#E5E7EB] text-gray-600 hover:text-gray-900 border border-[#E5E7EB] text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 font-outfit cursor-pointer"
          >
            <Download size={14} />
            <span className="hidden sm:inline">Excel Export</span>
            <span className="sm:hidden">Export</span>
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex-1 sm:flex-none px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-[#F8FAFC] text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 shadow font-outfit"
          >
            <Plus size={14} />
            <span className="hidden sm:inline">Journal Voucher (JV)</span>
            <span className="sm:hidden">New JV</span>
          </button>
        </div>
      </div>

      {/* Summary Widget Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-4 flex justify-between items-center text-xs">
          <div className="space-y-1">
            <span className="text-gray-400 block text-[9px] uppercase tracking-wider font-semibold">Active Capital Assets</span>
            <span className="text-lg font-bold text-gray-900 font-outfit">Rs. {activeAssets.toLocaleString()}</span>
          </div>
          <div className="p-2 rounded bg-emerald-500/10 text-emerald-600">
            <TrendingUp size={16} />
          </div>
        </div>

        <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-4 flex justify-between items-center text-xs">
          <div className="space-y-1">
            <span className="text-gray-400 block text-[9px] uppercase tracking-wider font-semibold">Total Revenue (Interest + Fees)</span>
            <span className="text-lg font-bold text-emerald-600 font-outfit">Rs. {totalRevenue.toLocaleString()}</span>
          </div>
          <div className="p-2 rounded bg-emerald-500/10 text-emerald-600">
            <ArrowUpRight size={16} />
          </div>
        </div>

        <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-4 flex justify-between items-center text-xs">
          <div className="space-y-1">
            <span className="text-gray-400 block text-[9px] uppercase tracking-wider font-semibold">GST Liability Account</span>
            <span className="text-lg font-bold text-amber-400 font-outfit font-mono">Rs. {gstLiability.toLocaleString()}</span>
          </div>
          <div className="p-2 rounded bg-amber-500/10 text-amber-400">
            <ShieldAlert size={16} />
          </div>
        </div>

        <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-4 flex justify-between items-center text-xs">
          <div className="space-y-1">
            <span className="text-gray-400 block text-[9px] uppercase tracking-wider font-semibold">Reconciliation Trial status</span>
            <span className={`text-xs font-bold uppercase tracking-widest font-mono ${imbalance === 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {imbalance === 0 ? 'RECONCILED (0.00)' : `UNBALANCED (${imbalance.toFixed(2)})`}
            </span>
          </div>
          <div className={`p-2 rounded ${imbalance === 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
            <CheckCircle2 size={16} />
          </div>
        </div>
      </div>

      {/* Tab Selectors */}
      <div className="flex flex-wrap border-b border-[#E5E7EB] text-xs overflow-x-auto">
        {[
          { key: 'daybook', label: 'Operational Day Book' },
          { key: 'cashbook', label: 'Cash & Bank Book' },
          { key: 'ledger', label: 'General Ledgers' },
          { key: 'trial', label: 'Trial Balance Sheet' },
          { key: 'balance_sheet', label: 'Balance Sheet' },
          { key: 'profit_loss', label: 'Profit & Loss' }
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-5 py-2.5 font-bold font-outfit transition-all ${
              activeTab === tab.key ? 'text-[#2563EB] border-b-2 border-[#2563EB]' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-4 sm:p-6 text-xs min-h-[300px]">
        
        {/* Dynamic header button */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-[#E5E7EB] pb-3 mb-4">
          <span className="font-semibold text-gray-600 capitalize">{activeTab.replace('_', ' ')} Statement Stream</span>
          <button 
            onClick={handleExportPDF} 
            className="flex items-center gap-1 text-[10px] text-[#2563EB] hover:underline font-outfit font-semibold uppercase tracking-wider cursor-pointer"
          >
            <Printer size={12} />
            Export Document PDF
          </button>
        </div>

        {activeTab === 'daybook' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E5E7EB] text-[10px] text-gray-400 uppercase font-mono">
                  <th className="pb-3">Date</th>
                  <th className="pb-3">Narration Description</th>
                  <th className="pb-3">Debit Account (Dr)</th>
                  <th className="pb-3">Credit Account (Cr)</th>
                  <th className="pb-3 text-right">Amount (INR)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]/40">
                {journalEntries.map((e) => (
                  <tr key={e.id} className="hover:bg-[#F3F4F6]/30">
                    <td className="py-3 font-mono text-gray-500">{e.date}</td>
                    <td className="py-3 text-gray-900 font-medium">{e.desc}</td>
                    <td className="py-3 text-emerald-600 font-medium">{e.debitAcc}</td>
                    <td className="py-3 text-red-500 font-medium">{e.creditAcc}</td>
                    <td className="py-3 text-right text-gray-900 font-bold font-mono">Rs. {parseFloat(e.amount).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'cashbook' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Cash Ledger */}
            <div className="border border-[#E5E7EB] rounded-lg p-4 space-y-3 bg-[#F8FAFC]/40">
              <div className="flex justify-between items-center border-b border-[#E5E7EB] pb-2">
                <span className="font-bold text-gray-900 block">Physical Vault Petty Cash</span>
                <span className="text-[10px] text-emerald-600 font-bold font-mono">
                  DR Bal: Rs. {(ledgerAccounts.find(a => a.name === 'Vault Petty Cash')?.balance || 0).toLocaleString()}
                </span>
              </div>
              <div className="space-y-2 text-[10px] max-h-48 overflow-y-auto">
                {journalEntries.filter(e => e.debitAcc === 'Vault Petty Cash' || e.creditAcc === 'Vault Petty Cash').map((e, idx) => (
                  <div key={idx} className="flex justify-between text-gray-500">
                    <span>{e.desc} ({e.date})</span>
                    <span className={e.debitAcc === 'Vault Petty Cash' ? 'text-emerald-600 font-bold' : 'text-red-500 font-bold'}>
                      {e.debitAcc === 'Vault Petty Cash' ? '+' : '-'}Rs. {parseFloat(e.amount).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bank Ledger */}
            <div className="border border-[#E5E7EB] rounded-lg p-4 space-y-3 bg-[#F8FAFC]/40">
              <div className="flex justify-between items-center border-b border-[#E5E7EB] pb-2">
                <span className="font-bold text-gray-900 block">Bank Clearing Account</span>
                <span className="text-[10px] text-emerald-600 font-bold font-mono">
                  DR Bal: Rs. {(ledgerAccounts.find(a => a.name === 'Bank Clearing Account')?.balance || 0).toLocaleString()}
                </span>
              </div>
              <div className="space-y-2 text-[10px] max-h-48 overflow-y-auto">
                {journalEntries.filter(e => e.debitAcc === 'Bank Clearing Account' || e.creditAcc === 'Bank Clearing Account').map((e, idx) => (
                  <div key={idx} className="flex justify-between text-gray-500">
                    <span>{e.desc} ({e.date})</span>
                    <span className={e.debitAcc === 'Bank Clearing Account' ? 'text-emerald-600 font-bold' : 'text-red-500 font-bold'}>
                      {e.debitAcc === 'Bank Clearing Account' ? '+' : '-'}Rs. {parseFloat(e.amount).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'ledger' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E5E7EB] text-[10px] text-gray-400 uppercase font-mono">
                  <th className="pb-3">Code</th>
                  <th className="pb-3">Account Name</th>
                  <th className="pb-3">Group Category</th>
                  <th className="pb-3 text-right">Debit Volume</th>
                  <th className="pb-3 text-right">Credit Volume</th>
                  <th className="pb-3 text-right">Closing Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]/40">
                {ledgerAccounts.map((a) => (
                  <tr key={a.code} className="hover:bg-[#F3F4F6]/30">
                    <td className="py-3 font-mono text-[#2563EB]">{a.code}</td>
                    <td className="py-3 text-gray-900 font-semibold">{a.name}</td>
                    <td className="py-3 text-gray-500">{a.group}</td>
                    <td className="py-3 text-right text-emerald-600 font-mono">Rs. {a.debit.toLocaleString()}</td>
                    <td className="py-3 text-right text-red-500 font-mono">Rs. {a.credit.toLocaleString()}</td>
                    <td className="py-3 text-right text-gray-900 font-bold font-mono">Rs. {a.balance.toLocaleString()} ({a.type})</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'trial' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E5E7EB] text-[10px] text-gray-400 uppercase font-mono">
                  <th className="pb-3">General Ledger Account</th>
                  <th className="pb-3 text-right">Debit (Dr) Balance</th>
                  <th className="pb-3 text-right">Credit (Cr) Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]/40">
                {ledgerAccounts.map((a) => (
                  <tr key={a.code} className="hover:bg-[#F3F4F6]/30">
                    <td className="py-3 text-gray-900 font-medium">{a.name}</td>
                    <td className="py-3 text-right text-emerald-600 font-mono">{a.type === 'Debit' ? `Rs. ${a.balance.toLocaleString()}` : '-'}</td>
                    <td className="py-3 text-right text-red-500 font-mono">{a.type === 'Credit' ? `Rs. ${a.balance.toLocaleString()}` : '-'}</td>
                  </tr>
                ))}
                <tr className="bg-[#F3F4F6]/40 border-t-2 border-[#2563EB] font-bold text-gray-900 font-mono">
                  <td className="py-4">Consolidated Sheet Totals</td>
                  <td className="py-4 text-right text-emerald-600">Rs. {totalDebits.toLocaleString()}</td>
                  <td className="py-4 text-right text-red-500">Rs. {totalCredits.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'balance_sheet' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Assets */}
            <div className="space-y-4">
              <h4 className="text-[#2563EB] font-bold border-b border-[#E5E7EB] pb-2 font-outfit uppercase tracking-wider text-[10px]">Asset Portfolios</h4>
              <div className="space-y-3">
                {ledgerAccounts.filter(a => a.type === 'Debit').map(a => (
                  <div key={a.code} className="flex justify-between items-center text-gray-600">
                    <span>{a.name} ({a.code})</span>
                    <span className="font-bold text-gray-900 font-mono">Rs. {a.balance.toLocaleString()}</span>
                  </div>
                ))}
                <div className="border-t border-[#E5E7EB] pt-2 flex justify-between font-bold text-emerald-600 font-mono">
                  <span>Total Capital Assets:</span>
                  <span>Rs. {totalDebits.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Liabilities & Equity */}
            <div className="space-y-4">
              <h4 className="text-[#2563EB] font-bold border-b border-[#E5E7EB] pb-2 font-outfit uppercase tracking-wider text-[10px]">Liabilities & Capital Equity</h4>
              <div className="space-y-3">
                {ledgerAccounts.filter(a => a.type === 'Credit').map(a => (
                  <div key={a.code} className="flex justify-between items-center text-gray-600">
                    <span>{a.name} ({a.code})</span>
                    <span className="font-bold text-gray-900 font-mono">Rs. {a.balance.toLocaleString()}</span>
                  </div>
                ))}
                <div className="flex justify-between items-center text-gray-600">
                  <span>Retained Earnings (Net Profit)</span>
                  <span className="font-bold text-gray-900 font-mono">Rs. {totalRevenue.toLocaleString()}</span>
                </div>
                <div className="border-t border-[#E5E7EB] pt-2 flex justify-between font-bold text-red-500 font-mono">
                  <span>Total Liabilities + Equity:</span>
                  <span>Rs. {(totalCredits + totalRevenue).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'profit_loss' && (
          <div className="space-y-6 max-w-2xl mx-auto py-4">
            <div className="space-y-3">
              <h4 className="text-[#2563EB] font-bold border-b border-[#E5E7EB] pb-2 uppercase tracking-wider text-[10px]">Operating Revenues</h4>
              <div className="flex justify-between text-gray-600">
                <span>Gold Interest Accrual Revenue (4001)</span>
                <span className="font-mono text-emerald-600 font-bold">Rs. {(ledgerAccounts.find(a => a.code === '4001')?.balance || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Gold Processing Appraisal Fees (4002)</span>
                <span className="font-mono text-emerald-600 font-bold">Rs. {(ledgerAccounts.find(a => a.code === '4002')?.balance || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between font-bold border-t border-[#E5E7EB]/65 pt-2 text-gray-900">
                <span>Gross Income Yield:</span>
                <span className="font-mono text-[#2563EB]">Rs. {totalRevenue.toLocaleString()}</span>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-[#2563EB] font-bold border-b border-[#E5E7EB] pb-2 uppercase tracking-wider text-[10px]">Operating Administrative Expenses</h4>
              <div className="flex justify-between text-gray-600">
                <span>Branch Operations & Maintenance Costs</span>
                <span className="font-mono text-red-500">Rs. 0</span>
              </div>
              <div className="flex justify-between font-bold border-t border-[#E5E7EB]/65 pt-2 text-gray-900">
                <span>Total Expenses:</span>
                <span className="font-mono text-red-500">Rs. 0</span>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex justify-between items-center font-bold text-sm font-outfit text-emerald-600">
              <span>NET REPORTED PROFIT / LOSS:</span>
              <span className="font-mono text-lg">Rs. {totalRevenue.toLocaleString()}</span>
            </div>
          </div>
        )}
      </div>

      {/* Journal Voucher Modal Form */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-md font-bold text-[#2563EB] border-b border-[#E5E7EB] pb-2 font-outfit">Log Journal Voucher (JV)</h3>
            
            <form onSubmit={handleAddJournalEntry} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-gray-500">Narration / Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Loan settlement write-off adjustments"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 rounded p-2.5 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-gray-500">Debit Account (Dr)</label>
                  <select
                    value={newDebitAcc}
                    onChange={(e) => setNewDebitAcc(e.target.value)}
                    className="w-full bg-[#F3F4F6] border border-[#E5E7EB] text-gray-900 rounded p-2.5 outline-none"
                  >
                    <option value="Bank Clearing Account">Bank Clearing Account</option>
                    <option value="Vault Petty Cash">Vault Petty Cash</option>
                    <option value="Loan Principal Asset Acc">Loan Principal Asset Acc</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-gray-500">Credit Account (Cr)</label>
                  <select
                    value={newCreditAcc}
                    onChange={(e) => setNewCreditAcc(e.target.value)}
                    className="w-full bg-[#F3F4F6] border border-[#E5E7EB] text-gray-900 rounded p-2.5 outline-none"
                  >
                    <option value="Interest Revenue Account">Interest Revenue Account</option>
                    <option value="Processing Fees Account">Processing Fees Account</option>
                    <option value="GST Output Tax Liability">GST Output Tax Liability</option>
                    <option value="Owner Equity Capital Acc">Owner Equity Capital Acc</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-gray-500">Amount (INR)</label>
                <input
                  type="number"
                  required
                  placeholder="Enter amount in INR"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value === '' ? '' : parseInt(e.target.value))}
                  className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 rounded p-2.5 outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-[#E5E7EB]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-[#E5E7EB] hover:bg-[#F3F4F6] text-gray-600 rounded font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={typeof newAmount !== 'number' || newAmount <= 0}
                  className="px-5 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-gray-300 text-[#F8FAFC] rounded font-bold cursor-pointer"
                >
                  Post Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
