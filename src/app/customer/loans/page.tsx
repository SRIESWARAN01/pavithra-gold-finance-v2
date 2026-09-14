'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Coins, ChevronRight, Clock, Scale } from 'lucide-react';
import { isFirebaseConfigured, getCurrentProfile } from '@/lib/auth';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function CustomerLoans() {
  const router = useRouter();

  const [loansList, setLoansList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadLoans() {
      setLoading(true);
      try {
        const profile = await getCurrentProfile();
        if (!profile) return;

        const q = query(
          collection(db, 'loans'),
          where('customer_id', '==', profile.id),
          orderBy('created_at', 'desc')
        );
        const snap = await getDocs(q);

        const list = [];
        for (const docSnap of snap.docs) {
          const loanData = docSnap.data();
          
          const goldQ = query(collection(db, 'gold_collateral'), where('loan_id', '==', docSnap.id));
          const goldSnap = await getDocs(goldQ);
          let totalWeight = 0;
          goldSnap.forEach(g => {
            totalWeight += g.data().net_weight || g.data().weight_grams || 0;
          });

          list.push({
            id: loanData.loan_number,
            rawId: docSnap.id,
            principal: loanData.principal_amount,
            outstanding: (loanData.principal_amount - (loanData.total_principal_paid || 0)) + (loanData.outstanding_interest || 0),
            interestAccrued: loanData.outstanding_interest || 0,
            status: loanData.status,
            apr: loanData.interest_rate_apr || 18,
            dueDate: loanData.maturity_date ? new Date(loanData.maturity_date).toLocaleDateString() : 'N/A',
            goldWeight: `${totalWeight.toFixed(2)}g`,
            disbursedDate: loanData.origination_date ? new Date(loanData.origination_date).toLocaleDateString() : 'N/A',
          });
        }
        setLoansList(list);
      } catch (err) {
        console.error('Failed to load customer loans:', err);
      } finally {
        setLoading(false);
      }
    }
    loadLoans();
  }, []);

  const activeLoans = loansList.filter((l) => l.status === 'Active');
  const totalOutstanding = loansList.reduce((sum, l) => sum + l.outstanding, 0);
  const totalGoldWeight = loansList.reduce((sum, l) => sum + parseFloat(l.goldWeight), 0);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <span className="text-[10px] text-[#2563EB] font-bold tracking-widest uppercase font-mono">
          Loan Portfolio
        </span>
        <h2 className="text-xl font-bold text-gray-900 tracking-wide font-outfit mt-0.5">
          My Loans
        </h2>
        <p className="text-gray-500 text-xs mt-1">
          Overview of all gold loans issued under your account.
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-4 text-center space-y-1">
          <div className="w-8 h-8 rounded bg-[#F3F4F6] border border-[#2563EB]/20 flex items-center justify-center text-[#2563EB] mx-auto">
            <Coins size={16} />
          </div>
          <span className="text-gray-400 block text-[9px] uppercase tracking-wider">
            Active Loans
          </span>
          <span className="text-gray-900 font-bold text-lg font-outfit">
            {activeLoans.length}
          </span>
        </div>
        <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-4 text-center space-y-1">
          <div className="w-8 h-8 rounded bg-[#F3F4F6] border border-emerald-500/20 flex items-center justify-center text-emerald-600 mx-auto">
            <Clock size={16} />
          </div>
          <span className="text-gray-400 block text-[9px] uppercase tracking-wider">
            Total Outstanding
          </span>
          <span className="text-gray-900 font-bold text-sm font-outfit">
            Rs. {totalOutstanding.toLocaleString()}
          </span>
        </div>
        <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-4 text-center space-y-1">
          <div className="w-8 h-8 rounded bg-[#F3F4F6] border border-amber-500/20 flex items-center justify-center text-amber-400 mx-auto">
            <Scale size={16} />
          </div>
          <span className="text-gray-400 block text-[9px] uppercase tracking-wider">
            Total Gold Weight
          </span>
          <span className="text-gray-900 font-bold text-sm font-outfit">
            {totalGoldWeight.toFixed(1)}g
          </span>
        </div>
      </div>

      {/* Loan Cards */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-900 tracking-wide font-outfit border-b border-[#E5E7EB] pb-2">
          All Loans
        </h3>

        {loansList.map((loan) => (
          <div
            key={loan.id}
            onClick={() => router.push(`/customer/loans/${loan.rawId || loan.id}`)}
            className="bg-[#ffffff] border border-[#E5E7EB] hover:border-[#2563EB]/20 transition-all duration-300 rounded-xl p-5 cursor-pointer group"
          >
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded bg-[#F3F4F6] border border-[#2563EB]/25 flex items-center justify-center text-[#2563EB]">
                  <Coins size={20} />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 text-sm font-mono">{loan.id}</h4>
                  <span className="text-[10px] text-gray-400">
                    Disbursed: {loan.disbursedDate}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    loan.status === 'Active'
                      ? 'bg-emerald-500/10 text-emerald-600'
                      : 'bg-slate-500/10 text-gray-500'
                  }`}
                >
                  {loan.status}
                </span>
                <ChevronRight
                  size={16}
                  className="text-gray-400 group-hover:text-[#2563EB] transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 bg-[#F8FAFC]/50 border border-[#E5E7EB] p-3 rounded-lg text-xs">
              <div>
                <span className="text-gray-400 block text-[9px] uppercase tracking-wider">
                  Principal
                </span>
                <span className="text-gray-900 font-semibold">
                  Rs. {loan.principal.toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-gray-400 block text-[9px] uppercase tracking-wider">
                  Outstanding
                </span>
                <span
                  className={`font-semibold ${
                    loan.outstanding > 0 ? 'text-amber-400' : 'text-gray-500'
                  }`}
                >
                  Rs. {loan.outstanding.toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-gray-400 block text-[9px] uppercase tracking-wider">
                  Interest Accrued
                </span>
                <span className="text-[#2563EB] font-semibold">
                  Rs. {loan.interestAccrued.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock size={12} className="text-gray-400" />
                <div>
                  <span className="text-gray-400 block text-[9px] uppercase tracking-wider">
                    Due Date
                  </span>
                  <span className="text-gray-900 font-semibold">{loan.dueDate}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center mt-3 text-[10px]">
              <div className="flex items-center gap-3 text-gray-400">
                <span>
                  <Scale size={10} className="inline mr-1" />
                  Gold Pledged: <span className="text-[#2563EB] font-semibold">{loan.goldWeight}</span>
                </span>
                <span>•</span>
                <span className="font-semibold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                  {loan.apr}% APR
                </span>
              </div>
              <span className="text-gray-400 group-hover:text-[#2563EB] transition-colors font-medium">
                View Details →
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
