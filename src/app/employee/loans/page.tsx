'use client';

import React from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import LoansDirectory from '@/app/admin/loans/page';

export default function EmployeeLoansPage() {
  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
        <div>
          <span className="font-bold uppercase tracking-wider block font-outfit text-gray-900 text-sm">
            Branch Gold Loans Portfolio
          </span>
          <span className="text-gray-500 text-xs">
            Inspect pledged loan accounts, customer collateral, status, and repayment history.
          </span>
        </div>
        <Link
          href="/admin/loans/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold rounded-xl transition shadow-md shadow-blue-600/20"
        >
          <Plus size={15} />
          New Gold Appraisal &amp; Loan
        </Link>
      </div>
      <LoansDirectory />
    </div>
  );
}
