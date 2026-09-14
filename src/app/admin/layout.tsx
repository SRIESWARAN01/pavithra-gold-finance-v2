'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Menu, Bell, Search, LogOut } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import { ToastProvider } from '@/components/Toast';
import { getCurrentProfile, isFirebaseConfigured, signOut } from '@/lib/auth';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function checkAdminAuth(user?: any) {
      try {
        const prof = await getCurrentProfile();
        if (!isMounted) return;

        if (!prof) {
          router.replace('/');
          return;
        }

        if (prof.role === 'Customer') {
          router.replace('/customer/dashboard');
          return;
        }

        if (prof.role !== 'Admin' && prof.role !== 'Owner') {
          router.replace('/employee/dashboard');
          return;
        }

        setProfile(prof);
      } catch (err) {
        console.error('Error verifying admin layout auth:', err);
        if (isMounted) router.replace('/');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    // 1. Immediate check with existing session
    checkAdminAuth();

    // 2. Auth state subscription
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      checkAdminAuth(user);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-gray-500 text-sm font-medium">Verifying admin session...</p>
        </div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-[#F8FAFC]">
        {/* Sidebar Navigation */}
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col min-h-screen overflow-y-auto min-w-0">
          {/* Top Header Bar */}
          <header className="h-16 border-b border-gray-200 bg-white/80 backdrop-blur-xl sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              {/* Mobile hamburger button */}
              <button 
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 -ml-1 rounded-xl text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                aria-label="Open navigation menu"
              >
                <Menu size={20} />
              </button>

              {/* Search Bar */}
              <div className="hidden sm:flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 w-64 lg:w-80 transition-colors focus-within:border-blue-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100">
                <Search size={16} className="text-gray-400" />
                <input
                  type="text"
                  placeholder="Search customers, loans..."
                  className="bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none w-full"
                  aria-label="Search"
                />
                <kbd className="hidden lg:inline-flex items-center gap-0.5 rounded border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] text-gray-400 font-mono">
                  ⌘K
                </kbd>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
              {/* Notification Bell */}
              <button
                onClick={() => router.push('/admin/reminders')}
                className="relative p-2 rounded-xl text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
                aria-label="Notifications"
              >
                <Bell size={20} />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
              </button>

              {/* Profile & Logout */}
              <div className="flex items-center gap-3 pl-2 sm:pl-4 border-l border-gray-200">
                <div className="text-right mr-1 hidden sm:block">
                  <p className="text-sm font-semibold text-gray-900 truncate max-w-[140px]">{profile?.name || 'Administrator'}</p>
                  <p className="text-[11px] text-gray-400">{profile?.role || 'Admin'} Console</p>
                </div>
                <div className="relative">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-xs font-bold text-white shadow-xs">
                    {(profile?.name || 'AD').substring(0, 2).toUpperCase()}
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white" />
                </div>
                <button
                  onClick={async () => {
                    await signOut();
                    router.replace('/');
                  }}
                  title="Sign Out"
                  className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                >
                  <LogOut size={18} />
                </button>
              </div>
            </div>
          </header>

          {/* Page Content Canvas */}
          <div className="flex-1 p-4 sm:p-6 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </ToastProvider>
  );
}
