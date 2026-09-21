// src/app/investor/layout.tsx
// Luxury PGF Investor Portal Layout — Deep Navy, Rich Gold, Crisp Slate typography.
// Desktop executive header, mobile bottom navigation, real-time push notifications, and 24x7 WhatsApp helpdesk.

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  TrendingUp,
  LayoutDashboard,
  PieChart,
  PlusCircle,
  ArrowDownLeft,
  Coins,
  FileText,
  User,
  Bell,
  LogOut,
  Phone,
  MessageSquare,
  X,
  CheckCheck,
  ShieldCheck,
  ExternalLink,
  ChevronRight,
  Menu,
} from 'lucide-react';
import Logo from '@/components/Logo';
import { getCurrentProfile, signOut } from '@/lib/auth';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { getInvestmentSettings } from '@/lib/db/investments';
import type { Profile, InvestmentSettings } from '@/types/database';
import { AuthProvider } from '@/context/AuthContext';

export default function InvestorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [settings, setSettings] = useState<InvestmentSettings | null>(null);

  // Notifications
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  // Mobile menu
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function checkInvestorAuth() {
      try {
        const prof = await getCurrentProfile();
        if (!isMounted) return;

        if (!prof) {
          router.replace('/');
          return;
        }

        // Allow Investor, or Admin/Owner for oversight
        if (prof.role !== 'Investor' && prof.role !== 'Admin' && prof.role !== 'Owner') {
          router.replace('/customer/dashboard');
          return;
        }

        setProfile(prof as Profile);

        // Fetch settings
        const s = await getInvestmentSettings();
        if (isMounted) setSettings(s);
      } catch (err) {
        console.error('Investor layout auth check failed:', err);
        if (isMounted) router.replace('/');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    checkInvestorAuth();

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user && isMounted) {
        router.replace('/');
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [router]);

  // Real-time notifications listener for this investor
  useEffect(() => {
    if (!profile) return;

    const q = query(
      collection(db, 'notifications'),
      where('user_id', 'in', [profile.id, 'admin_broadcast'])
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a: any, b: any) => (b.created_at || '').localeCompare(a.created_at || ''));
      setNotifications(list);
      setUnreadCount(list.filter((n: any) => !n.is_read).length);
    });

    return () => unsubscribe();
  }, [profile]);

  const handleLogout = async () => {
    try {
      await signOut();
      if (typeof window !== 'undefined') {
        localStorage.removeItem('pgf_active_session');
      }
      router.push('/');
    } catch (err) {
      console.error('Logout error:', err);
      router.push('/');
    }
  };

  const navItems = [
    { name: 'Dashboard', path: '/investor/dashboard', icon: LayoutDashboard },
    { name: 'Portfolio', path: '/investor/portfolio', icon: PieChart },
    { name: 'Invest More', path: '/investor/invest', icon: PlusCircle },
    { name: 'Withdraw', path: '/investor/withdraw', icon: ArrowDownLeft },
    { name: 'Transactions', path: '/investor/transactions', icon: Coins },
    { name: 'Statement', path: '/investor/statement', icon: FileText },
    { name: 'Profile', path: '/investor/profile', icon: User },
    { name: 'Helpdesk', path: '/investor/support', icon: Phone },
  ];

  const bottomNavItems = [
    { name: 'Home', path: '/investor/dashboard', icon: LayoutDashboard },
    { name: 'Portfolio', path: '/investor/portfolio', icon: PieChart },
    { name: 'Invest', path: '/investor/invest', icon: PlusCircle },
    { name: 'Withdraw', path: '/investor/withdraw', icon: ArrowDownLeft },
    { name: 'History', path: '/investor/transactions', icon: Coins },
    { name: 'Profile', path: '/investor/profile', icon: User },
  ];

  const whatsappLink = `https://wa.me/${settings?.helpdesk_whatsapp_number || '919876543210'}?text=${encodeURIComponent(
    `Hello PGF Investment Helpdesk,\nInvestor ID: ${profile?.customer_number || profile?.id || 'PGF-INV'}\nName: ${profile?.name || ''}\nI need assistance regarding my investment/withdrawal.`
  )}`;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-amber-400 font-mono tracking-wider uppercase">
            Loading PGF Investor Portfolio...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070B19] text-slate-100 flex flex-col font-sans">
      {/* Luxury Top Header (Desktop & Mobile) */}
      <header className="sticky top-0 z-40 bg-[#0B132B]/95 backdrop-blur-md border-b border-amber-500/20 shadow-xl shadow-black/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand & Badge */}
          <div className="flex items-center gap-3">
            <Link href="/investor/dashboard" className="flex items-center gap-2">
              <Logo size="sm" />
              <div className="hidden sm:block">
                <span className="text-xs font-black tracking-widest text-amber-400 font-mono block">
                  WEALTH & PORTFOLIO
                </span>
                <span className="text-[10px] text-slate-400 font-medium">Investor Portal</span>
              </div>
            </Link>

            {profile && (
              <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-400/10 text-amber-300 border border-amber-400/30">
                <ShieldCheck size={12} className="text-amber-400" />
                {profile.customer_number || profile.id}
              </span>
            )}
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.path;
              return (
                <Link
                  key={item.path}
                  href={item.path}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    isActive
                      ? 'bg-amber-400/15 text-amber-300 border border-amber-400/30 shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon size={14} className={isActive ? 'text-amber-400' : 'text-slate-400'} />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Right Actions: 24x7 WhatsApp, Notifications, Logout */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* 24x7 WhatsApp Helpdesk button */}
            <a
              href={whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-all shadow-sm"
              title="24x7 Investment Helpdesk WhatsApp"
            >
              <MessageSquare size={14} className="text-emerald-400" />
              <span>Helpdesk</span>
            </a>

            {/* Notifications Bell */}
            <button
              onClick={() => setIsNotifOpen(!isNotifOpen)}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 relative transition-colors cursor-pointer"
              title="Notifications"
            >
              <Bell size={16} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-slate-950 font-black text-[9px] rounded-full flex items-center justify-center animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-red-500/20 text-slate-300 hover:text-red-300 border border-slate-700/60 transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8">
        <AuthProvider>{children}</AuthProvider>
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0B132B]/95 backdrop-blur-md border-t border-amber-500/20 shadow-2xl py-1.5 px-2">
        <div className="grid grid-cols-6 gap-1 text-center">
          {bottomNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.path;
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`flex flex-col items-center py-1 rounded-xl transition-all ${
                  isActive
                    ? 'text-amber-400 bg-amber-400/10 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon size={17} className={isActive ? 'text-amber-400' : 'text-slate-400'} />
                <span className="text-[10px] mt-0.5">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Floating 24x7 WhatsApp Helpdesk Button (Mobile & Desktop) */}
      <a
        href={whatsappLink}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-20 lg:bottom-6 right-4 z-40 p-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full shadow-2xl shadow-emerald-600/40 flex items-center justify-center transition-transform hover:scale-105"
        title="Chat with 24x7 Investment Helpdesk on WhatsApp"
      >
        <MessageSquare size={22} />
      </a>

      {/* Notifications Drawer */}
      {isNotifOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-sm bg-[#0E172A] border-l border-slate-800 h-full p-6 flex flex-col shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Bell size={18} className="text-amber-400" />
                <h3 className="text-sm font-bold text-white">Investment Notifications</h3>
              </div>
              <button
                onClick={() => setIsNotifOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 py-3">
              {notifications.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  No notifications at this time.
                </div>
              ) : (
                notifications.map((n) => (
                  <div key={n.id} className={`py-3 text-xs ${n.is_read ? 'opacity-75' : ''}`}>
                    <div className="font-bold text-white mb-0.5">{n.title}</div>
                    <div className="text-slate-300 text-[11px] leading-relaxed">{n.message}</div>
                    <div className="text-[9px] font-mono text-slate-500 mt-1">{n.created_at || ''}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
