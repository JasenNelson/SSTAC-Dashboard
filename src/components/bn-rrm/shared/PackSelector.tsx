'use client';

import { usePackStore } from '@/stores/bn-rrm/packStore';
import { getScopeBadge, getReleaseBadge } from '@/lib/bn-rrm/pack-types';
import type { PackRegistryEntry } from '@/lib/bn-rrm/pack-types';
import { cn } from '@/utils/cn';
import { ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

/**
 * Pack selector dropdown for the BN-RRM header.
 * Shows the currently selected pack with scope/release badges.
 * Allows switching between registered packs.
 */
export function PackSelector() {
  const registry = usePackStore((s) => s.registry);
  const selectedPackId = usePackStore((s) => s.selectedPackId);
  const packManifest = usePackStore((s) => s.packManifest);
  const packLoading = usePackStore((s) => s.packLoading);
  const selectPack = usePackStore((s) => s.selectPack);

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (!registry || registry.packs.length <= 1) {
    // Single pack or no registry — show static label only
    if (packManifest) {
      return (
        <div className="flex items-center gap-2">
          <PackBadges entry={{
            pack_id: packManifest.pack_id,
            display_name: packManifest.display_name,
            scope_type: packManifest.scope_type,
            release_stage: packManifest.release_stage,
            is_default: packManifest.is_default,
            path: '',
          }} />
        </div>
      );
    }
    return null;
  }

  const currentEntry = registry.packs.find(p => p.pack_id === selectedPackId);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={packLoading}
        className={cn(
          'flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-colors text-sm',
          open
            ? 'border-blue-400 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600',
          packLoading && 'opacity-50 cursor-wait'
        )}
      >
        {currentEntry ? (
          <PackBadges entry={currentEntry} compact />
        ) : (
          <span className="text-slate-400">Select model...</span>
        )}
        <ChevronDown className={cn('w-3.5 h-3.5 text-slate-400 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-80 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 z-50 py-1">
          {registry.packs.map((entry) => (
            <button
              key={entry.pack_id}
              onClick={() => {
                selectPack(entry.pack_id);
                setOpen(false);
              }}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 text-left transition-colors',
                entry.pack_id === selectedPackId
                  ? 'bg-blue-50 dark:bg-blue-900/20'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                  {entry.display_name}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <PackBadges entry={entry} />
                </div>
              </div>
              {entry.pack_id === selectedPackId && (
                <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Badge sub-components
// ---------------------------------------------------------------------------

const SCOPE_COLORS: Record<string, string> = {
  default: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
  benchmark: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  site: 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300',
  experimental: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
};

const RELEASE_COLORS: Record<string, string> = {
  gray: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
  yellow: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
  blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  orange: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
  green: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
};

function PackBadges({ entry, compact }: { entry: PackRegistryEntry; compact?: boolean }) {
  // Build a minimal PackManifest-like object for the badge helpers
  const scopeBadge = getScopeBadge({
    scope_type: entry.scope_type,
    site_scope: null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  const releaseBadge = getReleaseBadge(entry.release_stage);

  return (
    <div className="flex items-center gap-1.5">
      {compact && (
        <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate max-w-[140px]">
          {entry.display_name}
        </span>
      )}
      <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium', SCOPE_COLORS[scopeBadge.variant])}>
        {scopeBadge.text}
      </span>
      <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-medium', RELEASE_COLORS[releaseBadge.color])}>
        {releaseBadge.text}
      </span>
    </div>
  );
}
