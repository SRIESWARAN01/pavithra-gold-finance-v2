'use client';

import React, { useState, useEffect } from 'react';
import { Bell, CheckCircle2, Coins, AlertTriangle, Clock, Info } from 'lucide-react';
import { isFirebaseConfigured, getCurrentProfile } from '@/lib/auth';
import { getNotifications, markAsRead } from '@/lib/db/notifications';

type Notification = {
  id: string;
  icon: 'check' | 'coins' | 'alert' | 'clock' | 'info' | 'bell';
  accent: 'emerald' | 'amber' | 'rose' | 'blue';
  title: string;
  message: string;
  timeAgo: string;
  read: boolean;
};

const accentClasses = {
  emerald: {
    border: 'border-l-emerald-500',
    iconBg: 'bg-emerald-500/10 border-emerald-500/20',
    iconText: 'text-emerald-600',
  },
  amber: {
    border: 'border-l-amber-500',
    iconBg: 'bg-amber-500/10 border-amber-500/20',
    iconText: 'text-amber-400',
  },
  rose: {
    border: 'border-l-rose-500',
    iconBg: 'bg-red-50 border-rose-500/20',
    iconText: 'text-red-500',
  },
  blue: {
    border: 'border-l-blue-500',
    iconBg: 'bg-blue-500/10 border-blue-500/20',
    iconText: 'text-blue-400',
  },
};

const iconMap = {
  check: CheckCircle2,
  coins: Coins,
  alert: AlertTriangle,
  clock: Clock,
  info: Info,
  bell: Bell,
};

export default function CustomerNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadNotifications() {
      setLoading(true);
      try {
        const profile = await getCurrentProfile();
        if (!profile) return;

        const res = await getNotifications(profile.id, { pageSize: 50 });
        const list = res.notifications.map(n => {
          let icon: 'check' | 'coins' | 'alert' | 'clock' | 'info' | 'bell' = 'bell';
          let accent: 'emerald' | 'amber' | 'rose' | 'blue' = 'blue';

          if (n.type === 'Loan_Created') {
            icon = 'coins';
            accent = 'blue';
          } else if (n.type === 'Payment_Received') {
            icon = 'check';
            accent = 'emerald';
          } else if (n.type === 'Due_Reminder') {
            icon = 'clock';
            accent = 'amber';
          } else if (n.type === 'Overdue_Alert') {
            icon = 'alert';
            accent = 'rose';
          }

          return {
            id: n.id,
            icon,
            accent,
            title: n.title,
            message: n.message,
            timeAgo: new Date(n.created_at || n.sent_at).toLocaleDateString(),
            read: n.is_read || false
          };
        });
        setNotifications(list);
      } catch (err) {
        console.error('Failed to load notifications:', err);
      } finally {
        setLoading(false);
      }
    }
    loadNotifications();
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const toggleRead = async (id: string) => {
    const target = notifications.find((n) => n.id === id);
    if (!target) return;
    const isUnread = !target.read;

    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: !n.read } : n))
    );

    if (isFirebaseConfigured()) {
      try {
        if (isUnread) {
          await markAsRead(id);
        } else {
          const { doc, updateDoc } = await import('firebase/firestore');
          const { db } = await import('@/lib/firebase');
          await updateDoc(doc(db, 'notifications', id), { is_read: false, read_at: null });
        }
      } catch (err) {
        console.error('Failed to toggle read state:', err);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-start">
        <div>
          <span className="text-[10px] text-[#2563EB] font-bold tracking-widest uppercase font-mono">
            Alerts & Updates
          </span>
          <h2 className="text-xl font-bold text-gray-900 tracking-wide font-outfit mt-0.5">
            Notifications
          </h2>
          <p className="text-gray-500 text-xs mt-1">
            Stay updated on your loan activity, payments, and important alerts.
          </p>
        </div>
        {unreadCount > 0 && (
          <span className="px-2.5 py-1 rounded-lg bg-[#2563EB]/10 border border-[#2563EB]/20 text-[#2563EB] text-[10px] font-bold">
            {unreadCount} unread
          </span>
        )}
      </div>

      {/* Notification Feed */}
      <div className="space-y-3">
        {notifications.map((notification) => {
          const accent = accentClasses[notification.accent];
          const IconComponent = iconMap[notification.icon];

          return (
            <div
              key={notification.id}
              onClick={() => toggleRead(notification.id)}
              className={`bg-[#ffffff] border border-[#E5E7EB] border-l-4 ${accent.border} rounded-xl p-4 cursor-pointer transition-all duration-300 hover:border-[#2563EB]/20 ${
                notification.read ? 'opacity-50' : 'opacity-100'
              }`}
            >
              <div className="flex gap-3">
                <div
                  className={`w-10 h-10 rounded shrink-0 border flex items-center justify-center ${accent.iconBg} ${accent.iconText}`}
                >
                  <IconComponent size={18} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <h4 className="text-sm font-semibold text-gray-900 leading-tight">
                      {notification.title}
                    </h4>
                    {!notification.read && (
                      <span className="w-2 h-2 rounded-full bg-[#2563EB] shrink-0 mt-1.5" />
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    {notification.message}
                  </p>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-[10px] text-gray-400 font-mono">{notification.timeAgo}</span>
                    <span className="text-[10px] text-gray-400 hover:text-[#2563EB] transition">
                      {notification.read ? 'Mark unread' : 'Mark read'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="p-4 rounded-lg border border-[#E5E7EB] bg-[#ffffff]/40 text-center">
        <p className="text-[10px] text-gray-500 leading-relaxed">
          Notifications are retained for 90 days. For SMS and WhatsApp alerts, update preferences in your profile.
        </p>
      </div>
    </div>
  );
}
