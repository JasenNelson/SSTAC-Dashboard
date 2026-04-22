/**
 * IdentifiedFeaturesList
 *
 * Presentational component for the left-panel stacked "Identified Features"
 * section. Renders the ordered list of hits from the map Identify tool.
 *
 * Contract:
 *   - Caller provides topmost-first ordering (store does not re-sort).
 *   - features.length === 0 renders nothing.
 *   - primaryIndex is expanded; other hits are collapsed header-only rows.
 *   - Clicking a non-primary header promotes it via onPromote(i).
 *   - Null/empty property values are suppressed in the detail table.
 *
 * Plain ASCII only. No em dashes. No emoji.
 */

'use client';

import { cn } from '@/utils/cn';
import { Layers, X } from 'lucide-react';
import type { IdentifiedFeature } from '@/lib/bn-rrm/wms-identify';

export interface IdentifiedFeaturesListProps {
  features: IdentifiedFeature[];
  primaryIndex: number | null;
  onPromote: (i: number) => void;
  onClear: () => void;
  className?: string;
}

function isEmptyValue(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string' && v.trim() === '') return true;
  return false;
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

export function IdentifiedFeaturesList({
  features,
  primaryIndex,
  onPromote,
  onClear,
  className,
}: IdentifiedFeaturesListProps) {
  if (!features || features.length === 0) return null;

  return (
    <div
      className={cn(
        'bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700',
        className,
      )}
      data-testid="identified-features-list"
    >
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-slate-400 dark:text-slate-500" />
          <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Identified Features ({features.length})
          </h4>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="flex items-center gap-1 px-2 py-1 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label="Clear identified features"
        >
          <X className="w-3.5 h-3.5" aria-hidden="true" />
          Clear all
        </button>
      </div>

      <ul className="px-4 pb-4 space-y-2">
        {features.map((f, i) => {
          const isPrimary = primaryIndex === i;
          return (
            <li
              key={`${f.layerKey}-${i}`}
              className={cn(
                'rounded-lg border',
                isPrimary
                  ? 'border-blue-300 dark:border-blue-700 bg-blue-50/40 dark:bg-blue-900/10'
                  : 'border-slate-200 dark:border-slate-700',
              )}
            >
              <button
                type="button"
                onClick={() => {
                  if (!isPrimary) onPromote(i);
                }}
                className={cn(
                  'w-full flex items-start justify-between gap-2 px-3 py-2 text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
                  !isPrimary && 'hover:bg-slate-50 dark:hover:bg-slate-700/40',
                )}
                aria-expanded={isPrimary}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                      {f.layerLabel}
                    </p>
                    {isPrimary && (
                      <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold rounded bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300">
                        Primary
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {f.coordinates.lat.toFixed(5)}, {f.coordinates.lng.toFixed(5)}
                  </p>
                </div>
                <span className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500 shrink-0 pt-1">
                  {f.source}
                </span>
              </button>
              {isPrimary && (
                <div className="px-3 pb-3">
                  <PropertyTable properties={f.properties} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PropertyTable({ properties }: { properties: Record<string, unknown> }) {
  const entries = Object.entries(properties).filter(([, v]) => !isEmptyValue(v));
  if (entries.length === 0) {
    return (
      <p className="text-xs text-slate-500 dark:text-slate-400 italic">
        No attributes reported for this feature.
      </p>
    );
  }
  return (
    <table className="w-full text-xs border-collapse">
      <tbody>
        {entries.map(([k, v]) => (
          <tr
            key={k}
            className="border-b border-slate-100 dark:border-slate-700 last:border-b-0"
          >
            <td className="py-1 pr-2 align-top text-slate-500 dark:text-slate-400 font-medium w-1/3 break-words">
              {k}
            </td>
            <td className="py-1 align-top text-slate-700 dark:text-slate-200 break-words">
              {formatValue(v)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default IdentifiedFeaturesList;
