'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import CustomerNav from '@/components/CustomerNav';
import Link from 'next/link';
import { LogOut, Bell, X, CheckCheck, Sparkles, MessageSquare, ShieldCheck, ExternalLink } from 'lucide-react';
import Logo from '@/components/Logo';
import { ToastProvider } from '@/components/Toast';
import { getCurrentProfile, isFirebaseConfigured, signOut } from '@/lib/auth';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, updateDoc, writeBatch } from 'firebase/firestore';

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);

  // Real-time Push Notifications state
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNotifDrawerOpen, setIsNotifDrawerOpen] = useState(false);
  const [activePushBanner, setActivePushBanner] = useState<any | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function checkCustomerAuth(user?: any) {
      try {
        const prof = await getCurrentProfile();
        if (!isMounted) return;

        if (!prof) {
          router.replace('/');
          return;
        }

        if (prof.role !== 'Customer') {
          router.replace('/admin/dashboard');
          return;
        }

        setProfile(prof);
      } catch (err) {
        console.error('Error verifying customer layout auth:', err);
        if (isMounted) router.replace('/');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    // 1. Immediate check with existing session
    checkCustomerAuth();

    // 2. Auth state subscription
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      checkCustomerAuth(user);
    });

    return () => {
      isMounted = false;
      unsubscribeAuth();
    };
  }, [router]);

  // Real-time Firestore Push Notification Listener targeting this customer
  useEffect(() => {
    if (!profile?.id) return;

    try {
      const q = query(
        collection(db, 'notifications'),
        where('recipient_id', '==', profile.id)
      );

      const unsubscribeNotifs = onSnapshot(q, (snapshot) => {
        const notifList: any[] = [];
        let unread = 0;

        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const data = change.doc.data();
            const createdAt = data.created_at ? new Date(data.created_at).getTime() : Date.now();
            const isVeryRecent = Date.now() - createdAt < 1000 * 60 * 5; // 5 mins

            if (!data.is_read && isVeryRecent) {
              setActivePushBanner({
                id: change.doc.id,
                ...data,
              });

              setTimeout(() => {
                setActivePushBanner((current: any) =>
                  current?.id === change.doc.id ? null : current
                );
              }, 8000);
            }
          }
        });

        snapshot.docs.forEach((docSnap) => {
          const d = { id: docSnap.id, ...docSnap.data() };
          notifList.push(d);
          if (!(d as any).is_read) unread++;
        });

        notifList.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
        setNotifications(notifList);
        setUnreadCount(unread);
      });

      return () => unsubscribeNotifs();
    } catch (e) {
      console.warn('Realtime notifications sync notice:', e);
    }
  }, [profile?.id]);

  const handleMarkAsRead = async (notifId: string) => {
    try {
      await updateDoc(doc(db, 'notifications', notifId), {
        is_read: true,
        read_at: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const batch = writeBatch(db);
      notifications.filter((n) => !n.is_read).forEach((n) => {
        batch.update(doc(db, 'notifications', n.id), {
          is_read: true,
          read_at: new Date().toISOString(),
        });
      });
      await batch.commit();
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-gray-500 text-sm font-medium">Verifying customer portal...</p>
        </div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-[#F8FAFC]">
        {/* ── LIVE PUSH NOTIFICATION POP-UP BANNER ── */}
        {activePushBanner && (
          <div className="fixed top-4 right-4 z-50 max-w-md w-full animate-slide-down">
            <div className="bg-slate-900 border border-blue-500/50 shadow-2xl rounded-2xl p-4 text-white flex items-start gap-3 backdrop-blur-xl">
              <div className="p-2.5 bg-blue-600/30 text-blue-400 rounded-xl border border-blue-500/30 flex-shrink-0 animate-pulse">
                <Sparkles size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-blue-400 font-mono">
                    Official Branch Alert
                  </span>
                  <span className="text-[10px] text-gray-400">Just Now</span>
                </div>
                <h4 className="text-sm font-bold text-gray-100 mt-0.5 truncate">
                  {activePushBanner.title || 'Notification from Pavithra Gold Finance'}
                </h4>
                <p className="text-xs text-gray-300 mt-1 line-clamp-2 leading-relaxed">
                  {activePushBanner.message}
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={() => {
                      handleMarkAsRead(activePushBanner.id);
                      setActivePushBanner(null);
                      setIsNotifDrawerOpen(true);
                    }}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-lg transition"
                  >
                    View Details
                  </button>
                  <button
                    onClick={() => {
                      handleMarkAsRead(activePushBanner.id);
                      setActivePushBanner(null);
                    }}
                    className="px-2.5 py-1 text-gray-400 hover:text-white text-[11px] font-medium transition"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
              <button
                onClick={() => setActivePushBanner(null)}
                className="text-gray-400 hover:text-white p-1 rounded-lg"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        {/* ── NOTIFICATION CENTER SLIDE-OUT DRAWER ── */}
        {isNotifDrawerOpen && (
          <div className="fixed inset-0 z-50 overflow-hidden">
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
              onClick={() => setIsNotifDrawerOpen(false)}
            />
            <div className="fixed inset-y-0 right-0 max-w-md w-full bg-white shadow-2xl flex flex-col z-10 animate-slide-left">
              <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/80">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                    <Bell size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-gray-900 font-outfit">Notification Center</h3>
                    <p className="text-[11px] text-gray-500">
                      {unreadCount} unread message{unreadCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllAsRead}
                      className="text-[11px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 px-2 py-1 bg-blue-50 rounded-lg"
                    >
                      <CheckCheck size={13} /> Mark All Read
                    </button>
                  )}
                  <button
                    onClick={() => setIsNotifDrawerOpen(false)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Notification List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {notifications.length === 0 ? (
                  <div className="text-center py-16 text-gray-400">
                    <MessageSquare size={36} className="mx-auto mb-2 opacity-40 text-gray-400" />
                    <p className="text-xs">No notifications received yet.</p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`p-3.5 rounded-xl border transition relative ${
                        !n.is_read
                          ? 'bg-blue-50/60 border-blue-200 text-gray-900'
                          : 'bg-white border-gray-200 text-gray-700'
                      }`}
                    >
                      {!n.is_read && (
                        <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-blue-600" />
                      )}
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[9px] font-bold font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/80 border border-gray-200 text-blue-700">
                          {n.channel || 'IN_APP'}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {n.created_at ? new Date(n.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : 'Recent'}
                        </span>
                      </div>
                      <h4 className="text-xs font-bold text-gray-900">{n.title}</h4>
                      <p className="text-xs text-gray-600 mt-1 leading-relaxed">{n.message}</p>
                      
                      {!n.is_read && (
                        <div className="mt-2.5 pt-2 border-t border-blue-100/80 flex justify-end">
                          <button
                            onClick={() => handleMarkAsRead(n.id)}
                            className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                          >
                            <CheckCheck size={12} /> Mark as read
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex-1 flex flex-col min-h-screen">
          {/* Header Bar */}
          <header className="h-16 border-b border-[#E5E7EB] bg-white sticky top-0 z-40 flex items-center justify-between px-4 sm:px-6">
            <div className="flex items-center gap-3">
              <Logo size="sm" />
              <div className="hidden sm:block pl-3 border-l border-gray-200">
                <span className="text-xs font-bold text-[#2563EB] tracking-wider uppercase font-mono block">
                  Customer Portal
                </span>
                <span className="text-[10px] text-gray-400 font-mono">
                  {profile?.name || 'Verified Customer'}
                </span>
              </div>
            </div>

            {/* Desktop Navigation Links */}
            <nav className="hidden md:flex items-center gap-1 font-outfit text-xs font-semibold">
              <Link href="/customer/dashboard" className="px-3 py-1.5 rounded-lg text-gray-600 hover:text-[#2563EB] hover:bg-blue-50/60 transition">
                Dashboard
              </Link>
              <Link href="/customer/statement" className="px-3 py-1.5 rounded-lg text-blue-700 bg-blue-50 font-bold hover:bg-blue-100 transition flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Live Statement
              </Link>
              <Link href="/customer/collateral" className="px-3 py-1.5 rounded-lg text-gray-600 hover:text-[#2563EB] hover:bg-blue-50/60 transition">
                Gold Collateral
              </Link>
              <Link href="/customer/payments" className="px-3 py-1.5 rounded-lg text-gray-600 hover:text-[#2563EB] hover:bg-blue-50/60 transition">
                Repayments
              </Link>
              <Link href="/customer/profile" className="px-3 py-1.5 rounded-lg text-gray-600 hover:text-[#2563EB] hover:bg-blue-50/60 transition">
                Profile
              </Link>
            </nav>

            <div className="flex items-center gap-3">
              {/* Notification Bell with Badge */}
              <button
                onClick={() => setIsNotifDrawerOpen(true)}
                className="relative p-2 rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition cursor-pointer"
                title="Notifications"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 px-1.5 py-0.2 bg-rose-600 text-white text-[9px] font-bold rounded-full border-2 border-white animate-bounce">
                    {unreadCount}
                  </span>
                )}
              </button>

              <button
                onClick={async () => {
                  await signOut();
                  router.replace('/');
                }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50/50 transition cursor-pointer"
              >
                <LogOut size={14} />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          </header>

          <CustomerNav />

          {/* Main Content */}
          <main className="flex-1 p-4 sm:p-6 max-w-5xl mx-auto w-full">
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
