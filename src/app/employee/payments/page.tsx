'use client';

import React from 'react';
import PaymentRegistry from '@/app/admin/payments/page';

export default function EmployeePaymentsPage() {
  return (
    <div className="space-y-4">
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-xs text-emerald-900 flex items-center justify-between">
        <div>
          <span className="font-bold uppercase tracking-wider block font-outfit text-emerald-950">Cashier Repayment Counter</span>
          <span className="text-emerald-800 text-[11px]">
            Statutory rule: All collections clear accrued interest first, then remaining reduces principal. Immediate atomic receipt generation.
          </span>
        </div>
        <span className="px-2.5 py-1 bg-emerald-200/80 rounded-full font-bold text-[10px] uppercase text-emerald-950">
          Cashier Terminal
        </span>
      </div>
      <PaymentRegistry />
    </div>
  );
}
