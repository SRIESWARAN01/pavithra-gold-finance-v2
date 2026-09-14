'use client';

import React from 'react';
import AdminLiveStatementPage from '@/app/admin/statement/page';

export default function EmployeeStatementPage() {
  return (
    <div className="space-y-4">
      <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 text-xs text-sky-900 flex items-center justify-between">
        <div>
          <span className="font-bold uppercase tracking-wider block font-outfit text-sky-950">
            Live Customer Statement &amp; Audit Dossier
          </span>
          <span className="text-sky-800 text-[11px]">
            Live Firebase account ledger. Instant balance computation, active pledge tracking, and official PDF generation.
          </span>
        </div>
        <span className="px-2.5 py-1 bg-sky-200/80 rounded-full font-bold text-[10px] uppercase text-sky-950">
          Staff Terminal
        </span>
      </div>
      <AdminLiveStatementPage />
    </div>
  );
}
