'use client';

import React from 'react';
import { CheckCircle, XCircle, AlertTriangle, MinusCircle } from 'lucide-react';

export type SufficiencyStatus = 'SUFFICIENT' | 'INSUFFICIENT' | 'NEEDS_MORE_EVIDENCE' | 'UNREVIEWED';

export interface SufficiencyBadgeProps {
  status: SufficiencyStatus;
  className?: string;
  showIcon?: boolean;
}

const statusConfig: Record<SufficiencyStatus, {
  label: string;
  bgClass: string;
  textClass: string;
  icon: React.ComponentType<{ className?: string }>;
}> = {
  SUFFICIENT: {
    label: 'Sufficient',
    bgClass: 'bg-green-100 dark:bg-green-900/30',
    textClass: 'text-green-800 dark:text-green-200',
    icon: CheckCircle,
  },
  INSUFFICIENT: {
    label: 'Insufficient',
    bgClass: 'bg-red-100 dark:bg-red-900/30',
    textClass: 'text-red-800 dark:text-red-200',
    icon: XCircle,
  },
  NEEDS_MORE_EVIDENCE: {
    label: 'Needs More Evidence',
    bgClass: 'bg-amber-100 dark:bg-amber-900/30',
    textClass: 'text-amber-800 dark:text-amber-200',
    icon: AlertTriangle,
  },
  UNREVIEWED: {
    label: 'Unreviewed',
    bgClass: 'bg-gray-100 dark:bg-gray-800',
    textClass: 'text-gray-700 dark:text-gray-300',
    icon: MinusCircle,
  },
};

export default function SufficiencyBadge({
  status,
  className = '',
  showIcon = true,
}: SufficiencyBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bgClass} ${config.textClass} ${className}`}
    >
      {showIcon && <Icon className="w-3.5 h-3.5" />}
      {config.label}
    </span>
  );
}
