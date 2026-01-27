'use client';

import React from 'react';

export type TierType = 'TIER_1_BINARY' | 'TIER_2_PROFESSIONAL' | 'TIER_3_STATUTORY';

export interface TierBadgeProps {
  tier: TierType;
  className?: string;
}

const tierConfig: Record<TierType, { label: string; bgClass: string; textClass: string }> = {
  TIER_1_BINARY: {
    label: 'Binary',
    bgClass: 'bg-green-100 dark:bg-green-900/30',
    textClass: 'text-green-800 dark:text-green-200',
  },
  TIER_2_PROFESSIONAL: {
    label: 'Professional',
    bgClass: 'bg-amber-100 dark:bg-amber-900/30',
    textClass: 'text-amber-800 dark:text-amber-200',
  },
  TIER_3_STATUTORY: {
    label: 'Statutory',
    bgClass: 'bg-red-100 dark:bg-red-900/30',
    textClass: 'text-red-800 dark:text-red-200',
  },
};

export default function TierBadge({ tier, className = '' }: TierBadgeProps) {
  const config = tierConfig[tier];

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bgClass} ${config.textClass} ${className}`}
    >
      {config.label}
    </span>
  );
}
