'use client';

import React from 'react';
import Link from 'next/link';
import { UserPlus } from 'lucide-react';
import CustomerList from '@/app/admin/customers/page';

export default function EmployeeCustomersPage() {
  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
        <div>
          <span className="font-bold uppercase tracking-wider block font-outfit text-gray-900 text-sm">
            Staff Customer Registry &amp; KYC
          </span>
          <span className="text-gray-500 text-xs">
            Register new borrowers, verify Aadhaar/PAN documents, and inspect customer profiles.
          </span>
        </div>
        <Link
          href="/admin/customers/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold rounded-xl transition shadow-md shadow-blue-600/20"
        >
          <UserPlus size={15} />
          Register New Customer
        </Link>
      </div>
      <CustomerList />
    </div>
  );
}
