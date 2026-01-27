'use client';

import React from 'react';

export interface ProgressData {
  totalItems: number;
  autoPassed: number;
  reviewed: number;
  pending: number;
  deferred: number;
}

export interface ProgressTrackerProps {
  progress: ProgressData;
  className?: string;
  showCounts?: boolean;
}

export default function ProgressTracker({
  progress,
  className = '',
  showCounts = true,
}: ProgressTrackerProps) {
  const { totalItems, autoPassed, reviewed, pending, deferred } = progress;

  // Calculate percentages
  const getPercentage = (value: number) => {
    if (totalItems === 0) return 0;
    return (value / totalItems) * 100;
  };

  const autoPassedPct = getPercentage(autoPassed);
  const reviewedPct = getPercentage(reviewed);
  const pendingPct = getPercentage(pending);
  const deferredPct = getPercentage(deferred);

  // Calculate completion percentage
  const completedItems = autoPassed + reviewed;
  const completionPct = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  const segments = [
    {
      key: 'autoPassed',
      label: 'Auto-passed',
      count: autoPassed,
      percentage: autoPassedPct,
      bgClass: 'bg-green-500 dark:bg-green-400',
      textClass: 'text-green-600 dark:text-green-400',
    },
    {
      key: 'reviewed',
      label: 'Reviewed',
      count: reviewed,
      percentage: reviewedPct,
      bgClass: 'bg-blue-500 dark:bg-blue-400',
      textClass: 'text-blue-600 dark:text-blue-400',
    },
    {
      key: 'pending',
      label: 'Pending',
      count: pending,
      percentage: pendingPct,
      bgClass: 'bg-amber-500 dark:bg-amber-400',
      textClass: 'text-amber-600 dark:text-amber-400',
    },
    {
      key: 'deferred',
      label: 'SDM Required',
      count: deferred,
      percentage: deferredPct,
      bgClass: 'bg-red-500 dark:bg-red-400',
      textClass: 'text-red-600 dark:text-red-400',
    },
  ];

  return (
    <div className={`w-full ${className}`}>
      {/* Header with completion percentage */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Review Progress
        </span>
        <span className="text-sm font-semibold text-gray-900 dark:text-white">
          {completionPct}% Complete
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex">
        {segments.map((segment) => {
          if (segment.percentage === 0) return null;
          return (
            <div
              key={segment.key}
              className={`h-full ${segment.bgClass} transition-all duration-300`}
              style={{ width: `${segment.percentage}%` }}
              title={`${segment.label}: ${segment.count} (${segment.percentage.toFixed(1)}%)`}
            />
          );
        })}
      </div>

      {/* Legend with counts */}
      {showCounts && (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {segments.map((segment) => (
            <div key={segment.key} className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-sm ${segment.bgClass}`} />
              <div className="flex flex-col">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {segment.label}
                </span>
                <span className={`text-sm font-medium ${segment.textClass}`}>
                  {segment.count}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Total items */}
      {showCounts && (
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-right">
          Total: {totalItems} items
        </div>
      )}
    </div>
  );
}
