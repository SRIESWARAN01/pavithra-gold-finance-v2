import React from 'react';

interface LoadingSkeletonProps {
  className?: string;
  height?: string | number;
  width?: string | number;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  className = '',
  height = '1rem',
  width = '100%',
}) => {
  return (
    <div
      className={`bg-gray-200 animate-pulse rounded ${className}`}
      style={{ height, width }}
      aria-hidden="true"
    />
  );
};

/** Skeleton for table rows */
export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3 p-4">
      {/* Header */}
      <div className="flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="h-4 bg-gray-200 animate-pulse rounded flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4">
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="h-8 bg-gray-100 animate-pulse rounded flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Skeleton for dashboard metric cards */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="h-32 bg-gray-100 animate-pulse rounded-2xl" />
      {/* Metrics grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-36 bg-gray-100 animate-pulse rounded-2xl" />
        ))}
      </div>
      {/* Content area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-64 bg-gray-100 animate-pulse rounded-2xl" />
        <div className="h-64 bg-gray-100 animate-pulse rounded-2xl" />
      </div>
    </div>
  );
}

/** Skeleton for card-based layouts */
export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <div className="flex justify-between">
            <div className="h-4 w-24 bg-gray-200 animate-pulse rounded" />
            <div className="h-8 w-8 bg-gray-100 animate-pulse rounded-lg" />
          </div>
          <div className="h-6 w-32 bg-gray-200 animate-pulse rounded" />
          <div className="h-3 w-20 bg-gray-100 animate-pulse rounded" />
        </div>
      ))}
    </div>
  );
}

/** Full page loading spinner */
export function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        <span className="text-sm text-gray-400 font-medium">Loading...</span>
      </div>
    </div>
  );
}
