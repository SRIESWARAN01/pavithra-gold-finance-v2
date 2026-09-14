'use client';

import React, { useState, useEffect } from 'react';
import { 
  ChevronRight, 
  Gavel, 
  AlertTriangle, 
  Scale, 
  Coins, 
  Download, 
  CheckCircle2, 
  Clock, 
  Users, 
  DollarSign,
  Plus
} from 'lucide-react';
import { isFirebaseConfigured, getCurrentProfile } from '@/lib/auth';
import { getOverdueLoans } from '@/lib/db/loans';

export default function AuctionManager() {
  const [activeTab, setActiveTab] = useState<'eligible' | 'bidding' | 'settled'>('eligible');
  
  // Overdue loans eligible for gold liquidation
  const [eligibleLoans, setEligibleLoans] = useState<any[]>([]);

  useEffect(() => {
    async function loadAuctionsData() {
      try {
        const adminProfile = await getCurrentProfile();
        const branchId = adminProfile?.branch_id || undefined;

        const overdue = await getOverdueLoans(branchId);
        const mappedEligible = overdue.map((l: any) => {
          let totalWeight = 0;
          let totalValuation = 0;
          if (l.gold_items) {
            l.gold_items.forEach((g: any) => {
              totalWeight += g.net_weight || g.weight_grams || 0;
              totalValuation += g.valuation_inr || 0;
            });
          }

          const overdueDays = Math.ceil(
            (new Date().getTime() - new Date(l.maturity_date).getTime()) / (1000 * 3600 * 24)
          );

          return {
            id: l.loan_number,
            rawId: l.id,
            customer: l.customer?.name || 'Customer',
            principal: l.principal_amount,
            interestAccrued: l.outstanding_interest || 0,
            goldWeight: `${totalWeight.toFixed(2)}g (Net)`,
            valuation: totalValuation || l.principal_amount * 1.3,
            ltvRatio: totalValuation ? Math.round((l.principal_amount / totalValuation) * 1000) / 10 : 70,
            overdueDays: overdueDays > 0 ? overdueDays : 1
          };
        });
        setEligibleLoans(mappedEligible);
      } catch (err) {
        console.error('Failed to load auction data:', err);
      }
    }
    loadAuctionsData();
  }, []);

  // Active auction bidding register
  const [activeAuction, setActiveAuction] = useState<any | null>(null);

  // Settled auctions list
  const [settledAuctions, setSettledAuctions] = useState<any[]>([]);

  // Bidding form states
  const [newBidder, setNewBidder] = useState('');
  const [newBidAmount, setNewBidAmount] = useState<number | ''>('');
  const [showBidModal, setShowBidModal] = useState(false);

  // Settlement details calculation state
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [settleLoan, setSettleLoan] = useState<any>(null);

  const handlePlaceBid = (e: React.FormEvent) => {
    e.preventDefault();
    if (newBidAmount === '' || typeof newBidAmount !== 'number' || newBidAmount <= activeAuction.currentHighestBid) {
      alert('New bid must be higher than current highest bid.');
      return;
    }

    const bid = {
      id: activeAuction.bids.length + 1,
      bidder: newBidder || 'General Bidder',
      bidAmount: newBidAmount,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setActiveAuction((prev: any) => ({
      ...prev,
      currentHighestBid: newBidAmount,
      highestBidder: bid.bidder,
      biddersCount: newBidder ? (prev?.biddersCount || 0) + 1 : (prev?.biddersCount || 0),
      bids: [bid, ...(prev?.bids || [])]
    }));
    setShowBidModal(false);
  };

  const startSettlementProcess = (loan: any) => {
    setSettleLoan(loan);
    setShowSettleModal(true);
  };

  const handleExecuteSettlement = () => {
    if (!settleLoan) return;

    // Simulate transfer to settled list
    const newSettled = {
      id: `AUC-${103 + settledAuctions.length}`,
      loanId: settleLoan.id,
      customer: settleLoan.customer,
      reserve: Math.round(settleLoan.valuation * 0.9),
      finalBid: activeAuction.currentHighestBid,
      winner: activeAuction.highestBidder,
      principalSettled: settleLoan.principal,
      interestPaid: settleLoan.interestAccrued,
      surplusPaid: activeAuction.currentHighestBid - (settleLoan.principal + settleLoan.interestAccrued),
      date: new Date().toISOString().split('T')[0]
    };

    setSettledAuctions([newSettled, ...settledAuctions]);
    setEligibleLoans(eligibleLoans.filter(l => l.id !== settleLoan.id));
    setShowSettleModal(false);
    setSettleLoan(null);
    setActiveTab('settled');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs text-[#2563EB] font-semibold tracking-wider uppercase">
        <span>Admin Panel</span>
        <ChevronRight size={12} className="text-gray-400" />
        <span className="text-gray-500">Auction Manager</span>
        <ChevronRight size={12} className="text-gray-400" />
        <span>Liquidation Control</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-[#E5E7EB] pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 tracking-wide font-outfit">Gold Collateral Auction Manager</h2>
          <p className="text-gray-500 text-xs mt-1">Audit overdue assets, register bidders, manage live liquidation bidding rounds, and settle outstanding balances.</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-4 flex justify-between items-center text-xs">
          <div className="space-y-1">
            <span className="text-gray-400 block text-[9px] uppercase tracking-wider font-semibold">Overdue Accounts flagged</span>
            <span className="text-lg font-bold text-gray-900 font-outfit">{eligibleLoans.length} Loans</span>
          </div>
          <div className="p-2 rounded bg-red-50 text-red-500">
            <AlertTriangle size={16} />
          </div>
        </div>

        <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-4 flex justify-between items-center text-xs">
          <div className="space-y-1">
            <span className="text-gray-400 block text-[9px] uppercase tracking-wider font-semibold">Under Auction Liquidation</span>
            <span className="text-lg font-bold text-[#2563EB] font-outfit">{activeAuction?.loanId || 'None Active'}</span>
          </div>
          <div className="p-2 rounded bg-[#2563EB]/10 text-[#2563EB]">
            <Gavel size={16} />
          </div>
        </div>

        <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-4 flex justify-between items-center text-xs">
          <div className="space-y-1">
            <span className="text-gray-400 block text-[9px] uppercase tracking-wider font-semibold">Revenues settled past 30d</span>
            <span className="text-lg font-bold text-emerald-600 font-outfit">Rs. 2,09,000</span>
          </div>
          <div className="p-2 rounded bg-emerald-500/10 text-emerald-600">
            <CheckCircle2 size={16} />
          </div>
        </div>
      </div>

      {/* Tab Selectors */}
      <div className="flex border-b border-[#E5E7EB] text-xs overflow-x-auto">
        <button
          onClick={() => setActiveTab('eligible')}
          className={`px-6 py-2.5 font-bold font-outfit transition-all ${
            activeTab === 'eligible' ? 'text-[#2563EB] border-b-2 border-[#2563EB]' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          Overdue Accounts (Eligible)
        </button>
        <button
          onClick={() => setActiveTab('bidding')}
          className={`px-6 py-2.5 font-bold font-outfit transition-all ${
            activeTab === 'bidding' ? 'text-[#2563EB] border-b-2 border-[#2563EB]' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          Active Bidding Round
        </button>
        <button
          onClick={() => setActiveTab('settled')}
          className={`px-6 py-2.5 font-bold font-outfit transition-all ${
            activeTab === 'settled' ? 'text-[#2563EB] border-b-2 border-[#2563EB]' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          Settled Auctions Ledger
        </button>
      </div>

      {/* Tab Panels */}
      <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-6 text-xs min-h-[300px]">
        {activeTab === 'eligible' && (
          <div className="space-y-4">
            <span className="font-semibold text-gray-600 block">Lapsed Loans Awaiting Gold Auction Liquidation</span>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E5E7EB] text-[10px] text-gray-400 uppercase font-mono">
                    <th className="pb-3">Loan ID</th>
                    <th className="pb-3">Customer name</th>
                    <th className="pb-3">Principal Owed</th>
                    <th className="pb-3">Accrued Interest</th>
                    <th className="pb-3">Gold collateral</th>
                    <th className="pb-3">LTV %</th>
                    <th className="pb-3">Days Overdue</th>
                    <th className="pb-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB]/40">
                  {eligibleLoans.map((l) => (
                    <tr key={l.id} className="hover:bg-[#F3F4F6]/30">
                      <td className="py-3 font-mono text-gray-900">{l.id}</td>
                      <td className="py-3 text-gray-600 font-semibold">{l.customer}</td>
                      <td className="py-3 text-gray-900 font-bold">Rs. {l.principal.toLocaleString()}</td>
                      <td className="py-3 text-amber-400 font-mono">Rs. {l.interestAccrued.toLocaleString()}</td>
                      <td className="py-3 text-gray-500">{l.goldWeight}</td>
                      <td className="py-3 text-gray-500">{l.ltvRatio}%</td>
                      <td className="py-3 text-red-500 font-bold">{l.overdueDays} Days</td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => startSettlementProcess(l)}
                          className="px-3 py-1.5 bg-[#2563EB]/10 hover:bg-[#2563EB]/20 border border-[#2563EB]/35 text-[#2563EB] font-semibold rounded uppercase tracking-wider text-[9px] transition-all"
                        >
                          Settle by Auction
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {eligibleLoans.length === 0 && (
                <div className="text-center py-12 text-gray-400 text-xs">
                  No overdue accounts currently eligible for gold auction liquidation.
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'bidding' && (
          activeAuction ? (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Left side: Live bidding card */}
            <div className="lg:col-span-3 space-y-4">
              <div className="flex justify-between items-center border-b border-[#E5E7EB] pb-2">
                <span className="font-semibold text-gray-600">Live Bidding Activity Terminal</span>
                <span className="text-[10px] text-emerald-600 font-mono flex items-center gap-1">
                  <Clock size={12} className="animate-spin" /> LIVE UPDATING
                </span>
              </div>

              <div className="bg-[#F8FAFC]/60 border border-[#E5E7EB] rounded-lg p-4 space-y-3">
                <div className="flex justify-between text-xs border-b border-[#E5E7EB]/50 pb-2">
                  <div>
                    <span className="text-gray-400 text-[9px] block">COLLATERAL BLOCK</span>
                    <span className="text-gray-900 font-bold">{activeAuction.collateral}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 text-[9px] block">RESERVE VALUATION</span>
                    <span className="text-gray-900 font-bold font-mono">Rs. {activeAuction.reservePrice?.toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <div>
                    <span className="text-[#2563EB] text-[10px] uppercase font-bold tracking-wider">Current Leading Bid</span>
                    <span className="text-2xl font-bold text-gray-900 block font-mono mt-1">Rs. {activeAuction.currentHighestBid?.toLocaleString()}</span>
                  </div>
                  <button
                    onClick={() => setShowBidModal(true)}
                    className="px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-[#F8FAFC] font-bold rounded-lg transition"
                  >
                    Place Bid Offer
                  </button>
                </div>

                <span className="text-[10px] text-gray-400 block font-semibold mt-1">Leading Bidder: {activeAuction.highestBidder}</span>
              </div>

              {/* Logged bids list */}
              <div className="space-y-2">
                <span className="font-bold text-gray-500 block text-[10px]">BIDDING LOG ARCHIVE ({activeAuction.bids?.length || 0} entries)</span>
                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
                  {(activeAuction.bids || []).map((b: any) => (
                    <div key={b.id} className="bg-[#F3F4F6]/30 p-2.5 rounded border border-[#E5E7EB] flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Users size={12} className="text-gray-400" />
                        <div>
                          <span className="text-gray-900 block font-semibold">{b.bidder}</span>
                          <span className="text-[9px] text-gray-400 font-mono">Timestamp: {b.timestamp}</span>
                        </div>
                      </div>
                      <span className="text-gray-900 font-bold font-mono">Rs. {b.bidAmount?.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right side: reserve LTV ratios */}
            <div className="lg:col-span-2 space-y-4">
              <span className="font-semibold text-gray-600 block border-b border-[#E5E7EB] pb-2">Reserve LTV Analytics</span>
              
              <div className="bg-[#F8FAFC]/50 p-4 border border-[#E5E7EB] rounded-lg space-y-4">
                <div className="space-y-1">
                  <span className="text-gray-400 text-[9px] block">TOTAL OUTSTANDING (PRINCIPAL + INTEREST)</span>
                  <span className="text-gray-900 font-bold block text-sm">Rs. 0</span>
                </div>

                <div className="space-y-1">
                  <span className="text-gray-400 text-[9px] block">ESTIMATED REVENUE SURPLUS (TO BORROWER)</span>
                  <span className="text-emerald-600 font-bold block text-sm">Rs. {((activeAuction.currentHighestBid || 0) - (activeAuction.reservePrice || 0)).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
          ) : (
            <div className="text-center py-16 text-gray-400 text-xs">
              No active auction bidding round in progress.
            </div>
          )
        )}

        {activeTab === 'settled' && (
          <div className="space-y-4">
            <span className="font-semibold text-gray-600 block">Auction Settlements Ledger Receipts</span>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E5E7EB] text-[10px] text-gray-400 uppercase font-mono">
                    <th className="pb-3">Auction ID</th>
                    <th className="pb-3">Loan Reference</th>
                    <th className="pb-3">Customer name</th>
                    <th className="pb-3">Winning bid</th>
                    <th className="pb-3">Principal recovered</th>
                    <th className="pb-3">Interest recovered</th>
                    <th className="pb-3">Surplus refunded</th>
                    <th className="pb-3">Settlement Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB]/40 font-mono text-[10px]">
                  {settledAuctions.map((sa) => (
                    <tr key={sa.id} className="hover:bg-[#F3F4F6]/30">
                      <td className="py-3 text-[#2563EB] font-semibold">{sa.id}</td>
                      <td className="py-3 text-gray-900">{sa.loanId}</td>
                      <td className="py-3 text-gray-600 font-sans font-semibold">{sa.customer}</td>
                      <td className="py-3 text-gray-900 font-bold">Rs. {sa.finalBid.toLocaleString()}</td>
                      <td className="py-3 text-emerald-600">Rs. {sa.principalSettled.toLocaleString()}</td>
                      <td className="py-3 text-emerald-600">Rs. {sa.interestPaid.toLocaleString()}</td>
                      <td className="py-3 text-amber-400">Rs. {sa.surplusPaid.toLocaleString()}</td>
                      <td className="py-3 text-gray-400">{sa.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {settledAuctions.length === 0 && (
                <div className="text-center py-12 text-gray-400 text-xs">
                  No settled auctions in ledger archive.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Place Bid Modal */}
      {showBidModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-md font-bold text-[#2563EB] border-b border-[#E5E7EB] pb-2 font-outfit">Submit Bidding Offer</h3>
            
            <form onSubmit={handlePlaceBid} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="text-gray-500">Bidder Name / Organization</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sri Balaji Jewelers"
                  value={newBidder}
                  onChange={(e) => setNewBidder(e.target.value)}
                  className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 rounded p-2.5 outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-gray-500">Bid Amount (INR)</label>
                <input
                  type="number"
                  required
                  placeholder="Enter bid amount in INR"
                  value={newBidAmount}
                  onChange={(e) => setNewBidAmount(e.target.value === '' ? '' : parseInt(e.target.value))}
                  className="w-full bg-[#F3F4F6] border border-[#E5E7EB] focus:border-[#2563EB] text-gray-900 rounded p-2.5 outline-none font-mono font-semibold"
                />
                <span className="text-[9px] text-gray-400 block">Must exceed Rs. {activeAuction.currentHighestBid.toLocaleString()}</span>
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-[#E5E7EB]">
                <button
                  type="button"
                  onClick={() => setShowBidModal(false)}
                  className="px-4 py-2 border border-[#E5E7EB] hover:bg-[#F3F4F6] text-gray-600 rounded font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={typeof newBidAmount !== 'number' || newBidAmount <= activeAuction.currentHighestBid}
                  className="px-5 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] disabled:bg-gray-300 text-[#F8FAFC] rounded font-bold cursor-pointer"
                >
                  Confirm Bid
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Settle Proceed split validation modal */}
      {showSettleModal && settleLoan && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-md font-bold text-[#2563EB] border-b border-[#E5E7EB] pb-2 font-outfit">Settle Collateral Liquidation</h3>
            
            <div className="space-y-3 text-xs">
              <p className="text-gray-500 text-[10px]">
                Confirm settlement proceeds allocation for customer <strong>{settleLoan.customer}</strong> regarding defaulted Loan ID <strong>{settleLoan.id}</strong>.
              </p>

              <div className="space-y-2 p-3 bg-[#F8FAFC]/50 border border-[#E5E7EB] rounded font-mono text-[10px]">
                <div className="flex justify-between">
                  <span>Pawn Ticket Principal:</span>
                  <span className="text-gray-900">Rs. {settleLoan.principal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Accrued Interest Balance:</span>
                  <span className="text-gray-900">Rs. {settleLoan.interestAccrued.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[#2563EB] border-b border-[#E5E7EB] pb-1.5">
                  <span>Total Recoverable Claim:</span>
                  <span>Rs. {(settleLoan.principal + settleLoan.interestAccrued).toLocaleString()}</span>
                </div>
                <div className="flex justify-between pt-1.5 text-emerald-600 font-bold">
                  <span>Winning Auction Bid:</span>
                  <span>Rs. {activeAuction.currentHighestBid.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-amber-400 font-bold">
                  <span>Surplus Refund due Nominee:</span>
                  <span>Rs. {(activeAuction.currentHighestBid - (settleLoan.principal + settleLoan.interestAccrued)).toLocaleString()}</span>
                </div>
              </div>

              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded text-[9px] text-amber-400 leading-relaxed flex gap-2">
                <AlertTriangle size={16} className="shrink-0" />
                <span>
                  Confirming this transaction will close the loan folder record, lock the audit logs, release vault hold coordinates for collateral custody transfer, and record a surplus transfer receipt.
                </span>
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-[#E5E7EB]">
                <button
                  type="button"
                  onClick={() => setShowSettleModal(false)}
                  className="px-4 py-2 border border-[#E5E7EB] hover:bg-[#F3F4F6] text-gray-600 rounded font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteSettlement}
                  className="px-5 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-[#F8FAFC] rounded font-bold uppercase tracking-wider"
                >
                  Confirm Settlement
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
