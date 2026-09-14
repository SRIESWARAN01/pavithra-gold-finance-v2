'use client';

import React, { useState, useEffect } from 'react';
import { Bell, BellOff, Coins, AlertTriangle, Clock, CheckCircle2, Filter, ChevronRight } from 'lucide-react';
import { isFirebaseConfigured } from '@/lib/auth';
import { collection, getDocs, query, orderBy, limit, doc, updateDoc, writeBatch, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

type NotificationCategory = 'All' | 'Loans' | 'Payments' | 'Alerts' | 'System';

interface Notification {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  category: NotificationCategory;
  read: boolean;
  borderColor: string;
  icon: React.ElementType;
  iconColor: string;
}

export default function NotificationsCenter() {
  const [activeTab, setActiveTab] = useState<NotificationCategory>('All');
  const [loading, setLoading] = useState(false);

  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    async function loadNotifications() {
      setLoading(true);
      try {
        const q = query(
          collection(db, 'notifications'),
          orderBy('created_at', 'desc'),
          limit(50)
        );
        const snap = await getDocs(q);
        const list = snap.docs.map(d => {
          const data = d.data();
          let icon = Bell;
          let iconColor = 'text-blue-400 bg-blue-400/10';
          let borderColor = 'border-l-blue-400';
          let category: NotificationCategory = 'System';

          if (data.type === 'Loan_Created') {
            icon = Coins;
            iconColor = 'text-blue-400 bg-blue-400/10';
            borderColor = 'border-l-blue-400';
            category = 'Loans';
          } else if (data.type === 'Payment_Received') {
            icon = CheckCircle2;
            iconColor = 'text-emerald-600 bg-emerald-600/10';
            borderColor = 'border-l-emerald-600';
            category = 'Payments';
          } else if (data.type === 'Overdue_Alert' || data.type === 'Due_Reminder') {
            icon = AlertTriangle;
            iconColor = 'text-amber-400 bg-amber-400/10';
            borderColor = 'border-l-amber-400';
            category = 'Alerts';
          }

          return {
            id: d.id,
            title: data.title,
            description: data.message,
            timestamp: new Date(data.created_at || data.sent_at).toLocaleString(),
            category,
            read: data.is_read || false,
            borderColor,
            icon,
            iconColor,
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

  const tabs: NotificationCategory[] = ['All', 'Loans', 'Payments', 'Alerts', 'System'];

  const filtered = activeTab === 'All' ? notifications : notifications.filter((n) => n.category === activeTab);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    if (isFirebaseConfigured()) {
      try {
        const batch = writeBatch(db);
        const snap = await getDocs(query(collection(db, 'notifications'), where('is_read', '==', false)));
        snap.forEach(d => {
          batch.update(d.ref, { is_read: true, read_at: new Date().toISOString() });
        });
        await batch.commit();
      } catch (err) {
        console.error('Failed to mark all as read:', err);
      }
    }
  };

  const toggleRead = async (id: string) => {
    const target = notifications.find((n) => n.id === id);
    if (!target) return;
    const isUnread = !target.read;
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: !n.read } : n))
    );
    if (isFirebaseConfigured()) {
      try {
        const ref = doc(db, 'notifications', id);
        await updateDoc(ref, {
          is_read: isUnread,
          read_at: isUnread ? new Date().toISOString() : null
        });
      } catch (err) {
        console.error('Failed to toggle read status:', err);
      }
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs text-[#2563EB] font-semibold tracking-wider uppercase">
        <span>Admin Panel</span>
        <ChevronRight size={12} className="text-gray-400" />
        <span className="text-gray-500">Notifications</span>
        <ChevronRight size={12} className="text-gray-400" />
        <span>Center</span>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-[#E5E7EB] pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 tracking-wide font-outfit flex items-center gap-3">
            Notifications
            {unreadCount > 0 && (
              <span className="px-2 py-0.5 bg-red-50 text-red-500 text-[10px] font-bold rounded-full">
                {unreadCount} unread
              </span>
            )}
          </h2>
          <p className="text-gray-500 text-xs mt-1">Loan alerts, payment confirmations, and system notifications.</p>
        </div>
        <button
          onClick={markAllRead}
          disabled={unreadCount === 0}
          className="flex items-center gap-2 px-4 py-2 bg-[#F3F4F6] hover:bg-[#E5E7EB] disabled:opacity-40 text-gray-600 hover:text-gray-900 border border-[#E5E7EB] text-xs font-bold rounded-lg transition"
        >
          <BellOff size={14} />
          Mark All as Read
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-1.5 w-full sm:w-fit overflow-x-auto">
        <Filter size={14} className="text-gray-400 mx-2" />
        {tabs.map((tab) => {
          const count = tab === 'All' ? notifications.length : notifications.filter((n) => n.category === tab).length;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                activeTab === tab
                  ? 'bg-[#2563EB] text-[#F8FAFC]'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-[#F3F4F6]'
              }`}
            >
              {tab}
              <span className={`text-[10px] ${activeTab === tab ? 'text-[#F8FAFC]/60' : 'text-slate-600'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {filtered.map((notification) => {
          const Icon = notification.icon;
          return (
            <div
              key={notification.id}
              onClick={() => toggleRead(notification.id)}
              className={`bg-[#ffffff] border border-[#E5E7EB] hover:border-[#2563EB]/10 rounded-xl p-4 transition cursor-pointer border-l-4 ${notification.borderColor} ${
                !notification.read ? 'bg-[#ffffff]' : 'bg-[#0e1d38] opacity-70'
              }`}
            >
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className={`p-2.5 rounded-lg shrink-0 ${notification.iconColor}`}>
                  <Icon size={18} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <h4 className={`text-xs font-semibold ${!notification.read ? 'text-gray-900' : 'text-gray-500'}`}>
                      {notification.title}
                    </h4>
                    <div className="flex items-center gap-2 shrink-0">
                      {!notification.read && (
                        <span className="w-2 h-2 rounded-full bg-[#2563EB] shrink-0" />
                      )}
                      <span className="text-[10px] text-gray-400 font-mono whitespace-nowrap">
                        {notification.timestamp}
                      </span>
                    </div>
                  </div>
                  <p className="text-gray-500 text-[11px] mt-1 leading-relaxed">{notification.description}</p>
                  <div className="mt-2">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-[#F3F4F6] text-gray-400 font-semibold uppercase tracking-wide">
                      {notification.category}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="bg-[#ffffff] border border-[#E5E7EB] rounded-xl p-12 text-center">
            <BellOff size={32} className="text-slate-600 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No notifications in this category.</p>
          </div>
        )}
      </div>
    </div>
  );
}
