'use client';

import React from 'react';
import { CheckCircle, XCircle, AlertCircle, MinusCircle } from 'lucide-react';

export type StatusType = 'PASS' | 'FAIL' | 'REQUIRES_JUDGMENT' | 'PARTIAL';

export interface StatusBadgeProps {
  status: StatusType;
  className?: string;
  showIcon?: boolean;
}

const statusConfig: Record<StatusType, {
  label: string;
  bgClass: string;
  textClass: string;
  icon: React.ComponentType<{ className?: string }>;
}> = {
  PASS: {
    label: 'Pass',
    bgClass: 'bg-green-100 dark:bg-green-900/30',
    textClass: 'text-green-800 dark:text-green-200',
    icon: CheckCircle,
  },
  FAIL: {
    label: 'Fail',
    bgClass: 'bg-red-100 dark:bg-red-900/30',
    textClass: 'text-red-800 dark:text-red-200',
    icon: XCircle,
  },
  REQUIRES_JUDGMENT: {
    label: 'Requires Judgment',
    bgClass: 'bg-amber-100 dark:bg-amber-900/30',
    textClass: 'text-amber-800 dark:text-amber-200',
    icon: AlertCircle,
  },
  PARTIAL: {
    label: 'Partial',
    bgClass: 'bg-blue-100 dark:bg-blue-900/30',
    textClass: 'text-blue-800 dark:text-blue-200',
    icon: MinusCircle,
  },
};

export default function StatusBadge({ status, className = '', showIcon = true }: StatusBadgeProps) {
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
