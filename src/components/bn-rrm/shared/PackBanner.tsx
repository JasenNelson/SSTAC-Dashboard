'use client';

import { usePackStore } from '@/stores/bn-rrm/packStore';
import { getReleaseBadge, isReadOnlyPack } from '@/lib/bn-rrm/pack-types';
import { AlertTriangle, Info, Lock } from 'lucide-react';
import { cn } from '@/utils/cn';

/**
 * Banner shown below the BN-RRM header when the selected pack's release stage
 * or scope type requires a user-facing warning.
 */
export function PackBanner() {
  const packManifest = usePackStore((s) => s.packManifest);
  if (!packManifest) return null;

  const releaseBadge = getReleaseBadge(packManifest.release_stage);
  const readOnly = isReadOnlyPack(packManifest);

  // No banner needed for internal or published packs (unless benchmark)
  if (!releaseBadge.showBanner && !readOnly) return null;

  // Determine banner style
  const isWarning = packManifest.release_stage === 'scaffold' || packManifest.release_stage === 'prototype';
  const isInfo = packManifest.release_stage === 'review';

  const Icon = readOnly ? Lock : isWarning ? AlertTriangle : Info;
  const text = readOnly
    ? 'Frozen benchmark — comparison only. Use the Data tab to browse published training data.'
    : releaseBadge.bannerText ?? '';

  if (!text) return null;

  return (
    <div
      className={cn(
        'px-4 py-1.5 flex items-center gap-2 text-xs font-medium shrink-0',
        isWarning && 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border-b border-yellow-200 dark:border-yellow-800',
        isInfo && 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-b border-blue-200 dark:border-blue-800',
        readOnly && 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-b border-purple-200 dark:border-purple-800',
      )}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{text}</span>
      {packManifest.parent_pack_id && (
        <span className="ml-auto text-[10px] opacity-70">
          Derived from: {packManifest.parent_pack_id}
        </span>
      )}
    </div>
  );
}
