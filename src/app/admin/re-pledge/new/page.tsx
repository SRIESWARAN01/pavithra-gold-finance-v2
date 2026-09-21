'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Building2,
  ArrowLeft,
  Search,
  CheckCircle2,
  Coins,
  ShieldCheck,
  AlertCircle,
  FileText,
  Calendar,
  Check,
  Percent,
  HelpCircle,
  FileUp,
  User,
  Info
} from 'lucide-react';
import { listLoans, getLoan } from '@/lib/db/loans';
import { getGoldByLoan } from '@/lib/db/gold';
import { createBankRePledge } from '@/lib/db/repledge';
import { getCurrentProfile } from '@/lib/auth';
import type { Loan, GoldCollateral, Profile, BankRePledgeOrnamentItem } from '@/types/database';

export default function NewRePledgePage() {
  const router = useRouter();

  // Current logged in profile
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Step 1: Active Loan Selection
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loadingLoans, setLoadingLoans] = useState(true);
  const [loanSearch, setLoanSearch] = useState('');
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);
  const [collateralItems, setCollateralItems] = useState<GoldCollateral[]>([]);
  const [loadingCollateral, setLoadingCollateral] = useState(false);

  // Selected Ornaments to transfer to Bank
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  // Step 2: Bank Details Form (initial numeric values are empty strings, not 0)
  const [bankName, setBankName] = useState('');
  const [bankBranch, setBankBranch] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [pledgeName, setPledgeName] = useState('Pavithra Gold Finance / Branch Signatory');
  const [bankLoanNumber, setBankLoanNumber] = useState('');
  const [pledgeDate, setPledgeDate] = useState(new Date().toISOString().split('T')[0]);
  const [bankPledgeAmount, setBankPledgeAmount] = useState<string>('');
  const [bankInterestRate, setBankInterestRate] = useState<string>('8.5');
  const [interestType, setInterestType] = useState<'Simple' | 'Monthly' | 'Compound' | 'Flat'>('Simple');
  const [tenureMonths, setTenureMonths] = useState<string>('12');
  const [dueDate, setDueDate] = useState('');
  const [bankReferenceNumber, setBankReferenceNumber] = useState('');
  const [bankPledgeTicketNumber, setBankPledgeTicketNumber] = useState('');
  const [remarks, setRemarks] = useState('');
  const [supportingDocUrl, setSupportingDocUrl] = useState('');
  const [directApprove, setDirectApprove] = useState(true);

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch staff profile and loans list
  useEffect(() => {
    async function init() {
      try {
        const prof = await getCurrentProfile();
        setCurrentProfile(prof);
        setIsAdmin(prof?.role === 'Admin' || prof?.role === 'Owner');

        // Fetch loans (active or disbursed)
        const { loans: fetchedLoans } = await listLoans({ pageSize: 100 });
        const eligibleLoans = fetchedLoans.filter(
          (l) => l.status === 'Active' || l.status === 'Due' || l.status === 'Overdue' || l.status === 'Grace_Period'
        );
        setLoans(eligibleLoans);
      } catch (err) {
        console.error('Error fetching initial data:', err);
      } finally {
        setLoadingLoans(false);
      }
    }
    init();
  }, []);

  // Compute due date when pledge date or tenure changes
  useEffect(() => {
    if (pledgeDate && tenureMonths) {
      const p = new Date(pledgeDate);
      const months = parseInt(tenureMonths) || 12;
      p.setMonth(p.getMonth() + months);
      setDueDate(p.toISOString().split('T')[0]);
    }
  }, [pledgeDate, tenureMonths]);

  // When a loan is selected, automatically fetch and load its collateral ornaments
  const handleSelectLoan = async (loan: Loan) => {
    setSelectedLoan(loan);
    setLoadingCollateral(true);
    setSelectedItemIds([]);
    setError(null);

    try {
      const items = await getGoldByLoan(loan.id);
      setCollateralItems(items);
      // By default select all ornaments for transfer
      const ids = items.map((i) => i.id);
      setSelectedItemIds(ids);

      // Pre-fill suggested pledge amount (e.g. 80-90% of loan principal if empty)
      if (!bankPledgeAmount) {
        setBankPledgeAmount(String(loan.principal_amount || ''));
      }
    } catch (err: any) {
      console.error('Error loading collateral items for loan:', err);
      setError('Failed to load ornaments for this loan.');
    } finally {
      setLoadingCollateral(false);
    }
  };

  // Toggle individual ornament selection
  const toggleItemSelection = (id: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Select/Deselect all
  const toggleSelectAll = () => {
    if (selectedItemIds.length === collateralItems.length) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(collateralItems.map((i) => i.id));
    }
  };

  // Filtered loans list
  const filteredLoans = loans.filter((l) => {
    if (!loanSearch.trim()) return true;
    const q = loanSearch.toLowerCase();
    return (
      l.loan_number.toLowerCase().includes(q) ||
      (l.customer_name && l.customer_name.toLowerCase().includes(q)) ||
      (l.customer_phone && l.customer_phone.includes(q))
    );
  });

  // Calculate transferred gold totals
  const selectedOrnaments = collateralItems.filter((i) => selectedItemIds.includes(i.id));
  const totalNetWeight = selectedOrnaments.reduce((sum, item) => sum + (item.net_weight || 0), 0);
  const totalValuation = selectedOrnaments.reduce((sum, item) => sum + (item.valuation_inr || 0), 0);

  // Submission handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedLoan) {
      setError('Please select an active customer loan.');
      return;
    }

    if (selectedItemIds.length === 0) {
      setError('Please select at least one gold ornament to transfer to the bank.');
      return;
    }

    if (!bankName.trim()) {
      setError('Please enter the Bank / Financial Institution Name.');
      return;
    }

    if (!bankBranch.trim()) {
      setError('Please enter the Bank Branch.');
      return;
    }

    const pledgeAmt = parseFloat(bankPledgeAmount);
    if (!pledgeAmt || isNaN(pledgeAmt) || pledgeAmt <= 0) {
      setError('Please enter a valid Bank Pledge Amount.');
      return;
    }

    const ratePct = parseFloat(bankInterestRate);
    if (isNaN(ratePct) || ratePct < 0) {
      setError('Please enter a valid Bank Interest Rate.');
      return;
    }

    setSubmitting(true);

    try {
      const ornamentDetails: BankRePledgeOrnamentItem[] = selectedOrnaments.map((i) => ({
        item_id: i.id,
        description: i.item_description,
        purity_karat: i.purity_karat,
        gross_weight: i.gross_weight || 0,
        stone_weight: i.stone_weight || 0,
        net_weight: i.net_weight || 0,
        valuation_inr: i.valuation_inr || 0,
      }));

      const created = await createBankRePledge(
        {
          customer_id: selectedLoan.customer_id,
          customer_name: selectedLoan.customer_name || 'Customer',
          customer_phone: selectedLoan.customer_phone || undefined,
          customer_number: selectedLoan.customer_number || undefined,

          loan_id: selectedLoan.id,
          loan_number: selectedLoan.loan_number,
          original_loan_date: selectedLoan.origination_date || selectedLoan.created_at || new Date().toISOString(),
          original_loan_amount: selectedLoan.principal_amount,
          original_gold_rate: selectedLoan.gold_rate_per_gram || 0,
          current_loan_outstanding: selectedLoan.total_outstanding || selectedLoan.principal_amount,

          collateral_item_ids: selectedItemIds,
          ornament_details: ornamentDetails,
          total_net_weight: totalNetWeight,
          total_valuation: totalValuation,

          bank_name: bankName.trim(),
          bank_branch: bankBranch.trim(),
          bank_account_number: bankAccountNumber.trim(),
          pledge_name: pledgeName.trim() || undefined,
          bank_loan_number: bankLoanNumber.trim() || undefined,
          pledge_date: pledgeDate,
          bank_pledge_amount: pledgeAmt,
          bank_interest_rate: ratePct,
          interest_type: interestType,
          tenure_months: parseInt(tenureMonths) || 12,
          due_date: dueDate,
          bank_reference_number: bankReferenceNumber.trim() || undefined,
          bank_pledge_ticket_number: bankPledgeTicketNumber.trim() || undefined,
          remarks: remarks.trim() || undefined,
          supporting_doc_url: supportingDocUrl.trim() || undefined,

          created_by: currentProfile?.id || 'staff_member',
          created_by_name: currentProfile?.name || 'Staff Member',
          status: isAdmin && directApprove ? 'Active' : 'Pending Approval',
        },
        isAdmin && directApprove
      );

      router.push(`/admin/re-pledge/${created.id}`);
    } catch (err: any) {
      console.error('Error creating bank re-pledge:', err);
      setError(err.message || 'Failed to submit bank re-pledge. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Back Button & Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/re-pledge"
            className="p-2 rounded-xl bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors shadow-xs"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
              New Bank Re-Pledge
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Select an active customer loan, identify ornaments, and record institutional bank pledge details.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-rose-800 text-sm">
          <AlertCircle size={18} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* STEP 1: Select Active Customer Loan */}
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-gray-100">
            <div>
              <span className="text-[11px] font-bold text-blue-600 uppercase tracking-widest block">Step 1</span>
              <h2 className="text-lg font-bold text-gray-900">Select Customer Loan</h2>
            </div>
            {selectedLoan && (
              <button
                type="button"
                onClick={() => setSelectedLoan(null)}
                className="text-xs text-blue-600 hover:text-blue-800 font-semibold hover:underline"
              >
                Change Selected Loan
              </button>
            )}
          </div>

          {!selectedLoan ? (
            <div className="space-y-3">
              {/* Search Bar */}
              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by Loan # (e.g. PGF-LN-001001), Customer Name, or Phone..."
                  value={loanSearch}
                  onChange={(e) => setLoanSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              {/* Loans List */}
              <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100">
                {loadingLoans ? (
                  <div className="p-6 text-center text-xs text-gray-500">Loading active customer loans...</div>
                ) : filteredLoans.length === 0 ? (
                  <div className="p-6 text-center text-xs text-gray-500">No active customer loans found matching search.</div>
                ) : (
                  filteredLoans.map((l) => (
                    <div
                      key={l.id}
                      onClick={() => handleSelectLoan(l)}
                      className="p-3.5 hover:bg-blue-50/50 cursor-pointer flex items-center justify-between transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-gray-900">{l.loan_number}</span>
                          <span className="text-xs text-gray-600">({l.customer_name || 'Customer'})</span>
                        </div>
                        <div className="text-[11px] text-gray-400 mt-0.5">
                          Originated: {l.origination_date ? new Date(l.origination_date).toLocaleDateString('en-IN') : 'N/A'} | Phone: {l.customer_phone || 'N/A'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-xs text-blue-600">
                          ₹{l.principal_amount.toLocaleString('en-IN')}
                        </div>
                        <span className="text-[10px] text-emerald-600 font-semibold uppercase">{l.status}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            /* Selected Loan Summary Box */
            <div className="bg-blue-50/50 border border-blue-200 rounded-xl p-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-gray-500 block text-[10px] uppercase font-semibold">Customer Name</span>
                  <span className="font-bold text-gray-900 text-sm">{selectedLoan.customer_name}</span>
                  <span className="text-[10px] text-gray-500 block">ID: {selectedLoan.customer_id}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[10px] uppercase font-semibold">Loan Number</span>
                  <span className="font-bold text-blue-700 text-sm font-mono">{selectedLoan.loan_number}</span>
                  <span className="text-[10px] text-gray-500 block">
                    Pledged: {selectedLoan.origination_date ? new Date(selectedLoan.origination_date).toLocaleDateString('en-IN') : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[10px] uppercase font-semibold">Sanctioned Amount</span>
                  <span className="font-bold text-gray-900 text-sm">
                    ₹{selectedLoan.principal_amount.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[10px] text-gray-500 block">
                    Rate: {selectedLoan.interest_rate_apr}% APR
                  </span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[10px] uppercase font-semibold">Current Outstanding</span>
                  <span className="font-bold text-emerald-700 text-sm">
                    ₹{(selectedLoan.total_outstanding || selectedLoan.principal_amount).toLocaleString('en-IN')}
                  </span>
                  <span className="text-[10px] text-gray-500 block">Status: {selectedLoan.status}</span>
                </div>
              </div>
            </div>
          )}

          {/* Collateral Ornaments Checkbox Table */}
          {selectedLoan && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                  <Coins size={16} className="text-amber-600" />
                  Select Ornaments to Transfer to Bank
                </h3>
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
                >
                  {selectedItemIds.length === collateralItems.length ? 'Deselect All' : 'Select All Ornaments'}
                </button>
              </div>

              {loadingCollateral ? (
                <div className="p-4 text-center text-xs text-gray-500">Loading ornament details...</div>
              ) : collateralItems.length === 0 ? (
                <div className="p-4 text-center text-xs text-gray-500 bg-gray-50 rounded-xl">
                  No collateral items recorded for this loan.
                </div>
              ) : (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-semibold uppercase">
                      <tr>
                        <th className="p-3 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={selectedItemIds.length === collateralItems.length && collateralItems.length > 0}
                            onChange={toggleSelectAll}
                            className="rounded text-blue-600 focus:ring-blue-500"
                          />
                        </th>
                        <th className="p-3">Ornament Description</th>
                        <th className="p-3">Purity</th>
                        <th className="p-3">Gross Wt</th>
                        <th className="p-3">Stone Wt</th>
                        <th className="p-3">Net Wt</th>
                        <th className="p-3">Valuation</th>
                        <th className="p-3">Current Location</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {collateralItems.map((item) => {
                        const isChecked = selectedItemIds.includes(item.id);
                        return (
                          <tr
                            key={item.id}
                            onClick={() => toggleItemSelection(item.id)}
                            className={`cursor-pointer transition-colors ${isChecked ? 'bg-amber-50/40' : 'hover:bg-gray-50'}`}
                          >
                            <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleItemSelection(item.id)}
                                className="rounded text-blue-600 focus:ring-blue-500"
                              />
                            </td>
                            <td className="p-3 font-semibold text-gray-900">{item.item_description}</td>
                            <td className="p-3 font-medium text-amber-700">{item.purity_karat}</td>
                            <td className="p-3 text-gray-600">{(item.gross_weight || 0).toFixed(2)}g</td>
                            <td className="p-3 text-gray-500">{(item.stone_weight || 0).toFixed(2)}g</td>
                            <td className="p-3 font-bold text-gray-900">{(item.net_weight || 0).toFixed(2)}g</td>
                            <td className="p-3 text-gray-900">₹{(item.valuation_inr || 0).toLocaleString('en-IN')}</td>
                            <td className="p-3">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                                {item.custody_location || 'PGF Safe'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-gray-50/80 font-bold text-gray-900 border-t border-gray-200">
                      <tr>
                        <td colSpan={5} className="p-3 text-right">Selected for Bank Transfer:</td>
                        <td className="p-3 text-amber-800 font-extrabold">{totalNetWeight.toFixed(2)}g</td>
                        <td className="p-3 text-blue-700 font-extrabold">₹{totalValuation.toLocaleString('en-IN')}</td>
                        <td className="p-3 text-[10px] text-gray-500 font-normal">
                          ({selectedItemIds.length} of {collateralItems.length} items)
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* STEP 2: Bank Pledge Details */}
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm p-6 space-y-5">
          <div className="pb-4 border-b border-gray-100">
            <span className="text-[11px] font-bold text-blue-600 uppercase tracking-widest block">Step 2</span>
            <h2 className="text-lg font-bold text-gray-900">Bank & Re-Pledge Terms</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Bank Name */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Bank / Institution Name *
              </label>
              <input
                type="text"
                placeholder="e.g. State Bank of India, HDFC Bank, Muthoot"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                required
              />
            </div>

            {/* Bank Branch */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Bank Branch *
              </label>
              <input
                type="text"
                placeholder="e.g. Main Branch, Commercial Road"
                value={bankBranch}
                onChange={(e) => setBankBranch(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                required
              />
            </div>

            {/* Bank Account / Pledge Account No. */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Bank Account / Pledge A/C No.
              </label>
              <input
                type="text"
                placeholder="e.g. 409988221144"
                value={bankAccountNumber}
                onChange={(e) => setBankAccountNumber(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            {/* Name Under Which Pledged (Pledgee Name) */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Name Under Which Pledged (Pledgee Name)
              </label>
              <input
                type="text"
                placeholder="e.g. Pavithra Gold Finance / Branch Signatory"
                value={pledgeName}
                onChange={(e) => setPledgeName(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            {/* Bank Loan / Pledge Number */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Bank Loan / Pledge Number
              </label>
              <input
                type="text"
                placeholder="e.g. CB-PLEDGE-99118"
                value={bankLoanNumber}
                onChange={(e) => setBankLoanNumber(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            {/* Pledge Date */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Pledge Date *
              </label>
              <input
                type="date"
                value={pledgeDate}
                onChange={(e) => setPledgeDate(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                required
              />
            </div>

            {/* Bank Pledge Amount */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Bank Pledge Amount (₹) *
              </label>
              <input
                type="number"
                placeholder="Enter bank loan amount"
                value={bankPledgeAmount}
                onChange={(e) => setBankPledgeAmount(e.target.value)}
                className="w-full px-3.5 py-2 text-xs font-bold text-blue-700 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                required
              />
              <span className="text-[10px] text-gray-400 mt-1 block">
                Total Ornament Valuation: ₹{totalValuation.toLocaleString('en-IN')}
              </span>
            </div>

            {/* Bank Interest Rate */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Bank Interest Rate (% p.a.) *
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g. 8.5"
                value={bankInterestRate}
                onChange={(e) => setBankInterestRate(e.target.value)}
                className="w-full px-3.5 py-2 text-xs font-bold text-gray-900 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                required
              />
              <span className="text-[10px] text-gray-400 mt-1 block">
                Tracked separately from customer interest
              </span>
            </div>

            {/* Interest Type */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Interest Calculation Type
              </label>
              <select
                value={interestType}
                onChange={(e: any) => setInterestType(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              >
                <option value="Simple">Simple Interest</option>
                <option value="Monthly">Monthly Compounding</option>
                <option value="Compound">Annual Compound</option>
                <option value="Flat">Flat Fixed Rate</option>
              </select>
            </div>

            {/* Tenure & Due Date */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Tenure (Months)
              </label>
              <input
                type="number"
                value={tenureMonths}
                onChange={(e) => setTenureMonths(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Bank Due / Maturity Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            {/* Bank Reference & Ticket # */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Bank Reference / Receipt #
              </label>
              <input
                type="text"
                placeholder="e.g. REF-SBI-8822"
                value={bankReferenceNumber}
                onChange={(e) => setBankReferenceNumber(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Bank Pledge Ticket / Sanction #
              </label>
              <input
                type="text"
                placeholder="e.g. TICKET-99214"
                value={bankPledgeTicketNumber}
                onChange={(e) => setBankPledgeTicketNumber(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                Supporting Document URL
              </label>
              <input
                type="text"
                placeholder="Document / PDF reference link"
                value={supportingDocUrl}
                onChange={(e) => setSupportingDocUrl(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Remarks & Physical Transfer Notes
            </label>
            <textarea
              rows={2}
              placeholder="Notes on handover, verification seals, packet numbers, or bank officer responsible..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full px-3.5 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            />
          </div>

          {/* Admin Direct Sanction Toggle */}
          {isAdmin && (
            <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-purple-600" />
                <div>
                  <span className="text-xs font-bold text-gray-900 block">Direct Admin Sanction</span>
                  <span className="text-[11px] text-gray-500">
                    Immediately mark as &quot;Active&quot; and transfer ornament custody to the bank.
                  </span>
                </div>
              </div>
              <input
                type="checkbox"
                checked={directApprove}
                onChange={(e) => setDirectApprove(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
              />
            </div>
          )}
        </div>

        {/* Submit Bar */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/admin/re-pledge"
            className="px-5 py-2.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm hover:shadow transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Recording Bank Re-Pledge...
              </>
            ) : (
              <>
                <Check size={16} />
                {isAdmin && directApprove ? 'Save & Sanction Re-Pledge' : 'Submit for Admin Approval'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
