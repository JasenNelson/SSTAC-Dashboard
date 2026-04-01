'use client';

import { useState, useId, type ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/utils/cn';

interface ExpandableSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
  badge?: string;
  badgeColor?: string;
  className?: string;
  headerClassName?: string;
}

export function ExpandableSection({
  title,
  defaultOpen = false,
  children,
  badge,
  badgeColor = 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  className,
  headerClassName,
}: ExpandableSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultOpen);
  const contentId = useId();

  return (
    <div className={cn('border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden', className)}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'w-full flex items-center justify-between p-3 text-left',
          'bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800',
          'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset',
          headerClassName
        )}
        aria-expanded={isExpanded}
        aria-controls={contentId}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {title}
          </span>
          {badge && (
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', badgeColor)}>
              {badge}
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-slate-400 dark:text-slate-500 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400 dark:text-slate-500 flex-shrink-0" />
        )}
      </button>

      {isExpanded && (
        <div id={contentId} className="p-3 border-t border-slate-200 dark:border-slate-700">
          {children}
        </div>
      )}
    </div>
  );
}
