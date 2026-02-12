'use client';

import { ShieldCheck, ShieldAlert } from 'lucide-react';
import type { ValidationResult } from '@/lib/hitl-packets/types';

interface ValidationBadgeProps {
  validation: ValidationResult;
}

export default function ValidationBadge({ validation }: ValidationBadgeProps) {
  if (validation.isValid) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
        <ShieldCheck className="h-4 w-4" />
        Valid
      </span>
    );
  }

  return (
    <div className="space-y-2">
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
        <ShieldAlert className="h-4 w-4" />
        Invalid ({validation.errors.length} error{validation.errors.length !== 1 ? 's' : ''})
      </span>
      <ul className="text-sm text-red-700 list-disc list-inside space-y-1">
        {validation.errors.map((err, i) => (
          <li key={i}>{err}</li>
        ))}
      </ul>
    </div>
  );
}
