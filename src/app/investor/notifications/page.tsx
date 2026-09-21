'use client';

import React, { useState, useEffect } from 'react';
import {
  Bell,
  CheckCircle2,
  Clock,
  ArrowDownLeft,
  ArrowUpRight,
  AlertCircle,
  FileText,
  ShieldCheck,
  Trash2
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { InvestmentNotification } from '@/types/database';

export default function InvestorNotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<InvestmentNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadNotifications() {
      if (!user?.uid) return;
      try {
        setLoading(true);
        // Load notifications for this investor (by user.uid or investorId)
        const q = query(
          collection(db, 'investment_notifications'),
          where('investorId', '==', user.uid)
        );
        const snap = await getDocs(q);
        const list: InvestmentNotification[] = [];
        snap.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as any);
        });

        // Sort by timestamp desc
        list.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
        setNotifications(list);
      } catch (err) {
        console.error('Error loading notifications:', err);
      } finally {
        setLoading(false);
      }
    }
    loadNotifications();
  }, [user]);

  const markAllAsRead = async () => {
    const unread = notifications.filter((n) => !n.read);
    try {
      await Promise.all(
        unread.map((n) =>
          n.id ? updateDoc(doc(db, 'investment_notifications', n.id), { read: true }) : Promise.resolve()
        )
      );
      setNotifications(notifications.map((n) => ({ ...n, read: true })));
    } catch (err) {
      console.error('Error marking notifications as read:', err);
    }
  };

  const getNotificationIcon = (type: string) => {
    if (type.includes('Investment') || type.includes('Deposit')) {
      return (
        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
          <ArrowDownLeft className="w-4 h-4" />
        </div>
      );
    }
    if (type.includes('Withdrawal')) {
      return (
        <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
          <ArrowUpRight className="w-4 h-4" />
        </div>
      );
    }
    if (type.includes('Alert') || type.includes('Rejected')) {
      return (
        <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
          <AlertCircle className="w-4 h-4" />
        </div>
      );
    }
    return (
      <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
        <Bell className="w-4 h-4" />
      </div>
    );
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin mb-4" />
        <p className="text-slate-400 font-medium text-sm tracking-wide">Loading notification dispatch...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-widest">
              Live Feed
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white mt-1 font-serif tracking-tight">
            Notification Center
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Real-time transaction verifications, approvals, compounding updates, and support messages.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-400 border border-amber-500/20 text-xs font-semibold flex items-center gap-1.5 transition-all w-fit"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Mark all as read ({unreadCount})
          </button>
        )}
      </div>

      {/* Notifications List */}
      <div className="rounded-3xl bg-slate-900/80 border border-slate-800 shadow-xl overflow-hidden backdrop-blur-sm divide-y divide-slate-800/60">
        {notifications.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <Bell className="w-12 h-12 mx-auto mb-3 opacity-30 text-slate-400" />
            <p className="text-sm font-semibold text-slate-400">All caught up!</p>
            <p className="text-xs text-slate-500 mt-1">
              You will receive real-time alerts when investments are approved or withdrawals are processed.
            </p>
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id || n.timestamp}
              className={`p-5 flex items-start gap-4 transition-colors ${
                !n.read ? 'bg-amber-500/[0.03]' : 'hover:bg-slate-800/30'
              }`}
            >
              {getNotificationIcon(n.type)}

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-white truncate">
                    {n.title}
                  </h3>
                  <span className="text-[10px] text-slate-500 whitespace-nowrap flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {n.timestamp ? new Date(n.timestamp).toLocaleDateString() : 'Recent'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  {n.message}
                </p>
              </div>

              {!n.read && (
                <div className="w-2 h-2 rounded-full bg-amber-400 mt-2 flex-shrink-0" />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
