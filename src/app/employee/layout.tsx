'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Coins,
  Receipt,
  FileText,
  ShieldCheck,
  LogOut,
  Menu,
  X,
  Building2,
  UserCheck,
  CheckCircle2,
  ChevronRight,
  ShieldAlert,
  ArrowUpRight
} from 'lucide-react';
import Logo from '@/components/Logo';
import { getCurrentProfile, signOut, isFirebaseConfigured } from '@/lib/auth';
import type { Profile, UserRole } from '@/types/database';

export default function EmployeeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    async function checkStaffAuth() {
      try {
        const prof = await getCurrentProfile();
        if (!prof) {
          router.replace('/');
          return;
        }

        if (prof.role === 'Customer') {
          router.replace('/customer/dashboard');
          return;
        }

        setProfile(prof);
      } catch (err) {
        console.error('Error verifying staff auth:', err);
        router.replace('/');
      } finally {
        setLoading(false);
      }
    }

    checkStaffAuth();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-4 border-[#2563EB] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs font-semibold tracking-wider text-gray-500 uppercase">Authenticating Staff Terminal...</p>
      </div>
    );
  }

  const role: UserRole = profile?.role || 'Employee';
  const isManager = role === 'Manager' || role === 'Admin';
  const isCashier = role === 'Cashier' || role === 'Admin';
  const isEmployee = role === 'Employee' || role === 'Appraiser' || role === 'Admin';

  // Role badge color helper
  const getRoleBadge = (r: string) => {
    switch (r) {
      case 'Admin':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'Manager':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'Cashier':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'Appraiser':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  // Scoped navigation items based on staff role
  const navItems = [
    { name: 'Staff Dashboard', href: '/employee/dashboard', icon: LayoutDashboard, show: true },
    { name: 'Approvals Queue', href: '/employee/approvals', icon: ShieldCheck, show: isManager },
    { name: 'Cash Counter / Repayments', href: '/employee/payments', icon: Receipt, show: isCashier },
    { name: 'New Loan & Appraisal', href: '/admin/loans/new', icon: Coins, show: isEmployee },
    { name: 'Customer Registry', href: '/employee/customers', icon: Users, show: true },
    { name: 'Loans Directory', href: '/employee/loans', icon: Coins, show: true },
    { name: 'Bank Re-Pledge', href: '/employee/re-pledge', icon: Building2, show: true },
    { name: 'Live Statements', href: '/employee/statement', icon: FileText, show: true },
  ].filter((item) => item.show);

  const handleSignOut = async () => {
    await signOut();
    router.replace('/');
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col text-gray-900">
      {/* Top Staff Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className="flex items-center gap-3">
              <Logo size="sm" />
              <div className="hidden sm:block border-l border-gray-200 pl-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#2563EB] block">
                  Staff Portal
                </span>
                <span className="text-xs font-semibold text-gray-700">
                  {profile?.branch_id || 'Madurai Main Branch'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Role Badge */}
            <span
              className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${getRoleBadge(
                role
              )}`}
            >
              {role}
            </span>

            {/* Profile greeting */}
            <div className="hidden md:flex flex-col text-right">
              <span className="text-xs font-bold text-gray-900">{profile?.name || 'Staff User'}</span>
              <span className="text-[11px] text-gray-500 font-mono">+91 {profile?.phone_primary || '—'}</span>
            </div>

            {/* Admin Switcher Link */}
            {role === 'Admin' && (
              <Link
                href="/admin/dashboard"
                className="hidden sm:flex items-center gap-1 text-[11px] font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-3 py-1.5 rounded-lg transition"
              >
                Admin Panel <ArrowUpRight size={12} />
              </Link>
            )}

            {/* Sign Out */}
            <button
              onClick={handleSignOut}
              className="p-2 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 transition"
              title="Sign Out"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-gray-200 bg-white px-4 pt-2 pb-4 space-y-1 shadow-lg">
            {navItems.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold transition ${
                    active
                      ? 'bg-[#2563EB] text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon size={16} />
                  {item.name}
                </Link>
              );
            })}
          </div>
        )}
      </header>

      {/* Main Container: Sidebar + Content */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 flex gap-6 flex-1">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:block w-64 flex-shrink-0 space-y-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-3 block mb-2">
              Staff Navigation ({role})
            </span>
            {navItems.map((item) => {
              const active = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
                    active
                      ? 'bg-[#2563EB] text-white shadow-sm shadow-blue-600/30'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <Icon size={16} className={active ? 'text-white' : 'text-gray-400'} />
                  {item.name}
                </Link>
              );
            })}
          </div>

          {/* Quick Support Card */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-4 text-xs space-y-2">
            <span className="font-bold text-blue-900 block">Tamil Nadu Pawnbrokers Act Compliant</span>
            <p className="text-[11px] text-blue-700/80 leading-relaxed">
              All loan appraisals and transactions are recorded live into Firebase cloud ledger with automated audit trails.
            </p>
          </div>
        </aside>

        {/* Page Content */}
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
