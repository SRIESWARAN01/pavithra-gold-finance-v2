'use client';

import React from 'react';
import { AlertTriangle, RefreshCw, WifiOff, ShieldAlert, ServerCrash } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  variant?: 'default' | 'network' | 'permission' | 'notfound' | 'server';
}

const variantDefaults: Record<string, { icon: React.ElementType; title: string; description: string }> = {
  default: { icon: AlertTriangle, title: 'Something went wrong', description: 'An error occurred while loading data. Please try again.' },
  network: { icon: WifiOff, title: 'Connection error', description: 'Unable to reach the server. Check your internet connection and try again.' },
  permission: { icon: ShieldAlert, title: 'Access denied', description: 'You don\'t have permission to view this data. Contact your administrator.' },
  notfound: { icon: AlertTriangle, title: 'Not found', description: 'The requested record was not found. It may have been deleted.' },
  server: { icon: ServerCrash, title: 'Server error', description: 'The server encountered an error. Please try again later.' },
};

export default function ErrorState({
  title,
  description,
  onRetry,
  variant = 'default',
}: ErrorStateProps) {
  const defaults = variantDefaults[variant] || variantDefaults.default;
  const Icon = defaults.icon;
  const displayTitle = title || defaults.title;
  const displayDescription = description || defaults.description;

  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
        <Icon size={28} className="text-red-400" />
      </div>
      <h3 className="text-base font-semibold text-gray-700 mb-1">{displayTitle}</h3>
      <p className="text-sm text-gray-400 max-w-sm mb-4">{displayDescription}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg transition-colors"
        >
          <RefreshCw size={14} />
          Try Again
        </button>
      )}
    </div>
  );
}
