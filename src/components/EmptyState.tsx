'use client';

import React from 'react';
import { Inbox, Search, FileText, Users, Coins, Bell, FolderOpen } from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ElementType;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  variant?: 'default' | 'search' | 'documents' | 'customers' | 'loans' | 'notifications' | 'payments';
}

const variantDefaults: Record<string, { icon: React.ElementType; title: string; description: string }> = {
  default: { icon: Inbox, title: 'No data yet', description: 'Records will appear here once data is added to the system.' },
  search: { icon: Search, title: 'No results found', description: 'Try adjusting your search terms or filters.' },
  documents: { icon: FileText, title: 'No documents', description: 'Documents will appear here when generated or uploaded.' },
  customers: { icon: Users, title: 'No customers yet', description: 'Onboard your first customer to get started.' },
  loans: { icon: Coins, title: 'No loans found', description: 'Create a new loan appraisal to get started.' },
  notifications: { icon: Bell, title: 'No notifications', description: 'You\'re all caught up! New notifications will appear here.' },
  payments: { icon: Coins, title: 'No payments recorded', description: 'Payment records will appear here after transactions.' },
};

export default function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  variant = 'default',
}: EmptyStateProps) {
  const defaults = variantDefaults[variant] || variantDefaults.default;
  const Icon = icon || defaults.icon;
  const displayTitle = title || defaults.title;
  const displayDescription = description || defaults.description;

  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
        <Icon size={28} className="text-gray-400" />
      </div>
      <h3 className="text-base font-semibold text-gray-700 mb-1">{displayTitle}</h3>
      <p className="text-sm text-gray-400 max-w-sm mb-4">{displayDescription}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
