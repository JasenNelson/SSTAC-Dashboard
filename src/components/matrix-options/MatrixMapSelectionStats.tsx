'use client';

// Phase 1 stats display component for the matrix-map left panel.
// Receives raw measurement rows + filter state; filters and computes
// descriptive stats + UCL95 client-side.
//
// Design authority: MATRIX_MAP_STATS_ENGINE_DESIGN_2026_06_05.md
// Plain ASCII only (code point <= 127).

import { useMemo } from 'react';
import { computeSelectionStats } from '@/lib/matrix-map/stats';
import type { StatsBucket, StatFlag } from '@/lib/matrix-map/stats';
import type { MatrixMapMeasurementRow } from '@/stores/matrix-map/measurementStore';
import type { MatrixMapFilterState } from '@/stores/matrix-map/filterStore';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface MatrixMapSelectionStatsProps {
  rows: MatrixMapMeasurementRow[];
  filterState: MatrixMapFilterState;
  isLoading: boolean;
  errorMessage: string | null;
  // ready: false when the measurement store has not yet been populated for the
  // current selection (prevents a flash of empty-bucket UI before the RPC returns).
  ready: boolean;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function MatrixMapSelectionStats({
  rows,
  filterState,
  isLoading,
  errorMessage,
  ready,
}: MatrixMapSelectionStatsProps) {
  const result = useMemo(() => {
    if (!ready || isLoading) return null;
    return computeSelectionStats({ rows, filterState });
  }, [rows, filterState, isLoading, ready]);

  // Not-ready / loading state.
  if (!ready || isLoading) {
    return (
      <div
        data-testid="matrix-map-stats-loading"
        className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/30 p-4"
      >
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          Computing selection statistics...
        </p>
      </div>
    );
  }

  // Error state.
  if (errorMessage) {
    return (
      <div
        data-testid="matrix-map-stats-error"
        className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4"
      >
        <p className="text-xs text-amber-900 dark:text-amber-100 leading-relaxed">
          {errorMessage}
        </p>
      </div>
    );
  }

  // Zero filtered rows.
  if (!result || result.filteredRows === 0) {
    return (
      <div
        data-testid="matrix-map-stats-empty"
        className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/30 p-4"
      >
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          No measurements match the current filters.
        </p>
      </div>
    );
  }

  // Per-bucket stat cards.
  return (
    <div data-testid="matrix-map-stats-buckets" className="space-y-3">
      {result.buckets.map((bucket) => (
        <BucketCard key={bucket.bucketKey} bucket={bucket} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// BucketCard
// ---------------------------------------------------------------------------

function BucketCard({ bucket }: { bucket: StatsBucket }) {
  const d = bucket.descriptive;
  const u = bucket.ucl;

  return (
    <div
      data-testid={'matrix-map-stats-bucket-' + bucket.bucketKey}
      className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/30 p-4 space-y-3"
    >
      {/* Header: substance - unit */}
      <div data-testid="matrix-map-stats-bucket-header">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {bucket.substanceDisplayName}
          {bucket.unit ? ' - ' + bucket.unit : ''}
        </p>
      </div>

      {/* Descriptive strip */}
      <div data-testid="matrix-map-stats-descriptive" className="space-y-1">
        <DescRow label="n" value={String(d.n)} />
        <DescRow label="Detects / non-detects" value={String(d.detects) + ' / ' + String(d.nonDetects)} />
        <DescRow label="Detection freq" value={fmtPct(d.detectionFrequencyPct)} />
        {d.n > 0 && (
          <>
            <DescRow label="Min" value={fmtNum(d.min)} />
            <DescRow label="Max" value={fmtNum(d.max)} />
            <DescRow label="Mean" value={fmtNum(d.mean)} />
            <DescRow label="Median" value={fmtNum(d.median)} />
          </>
        )}
        {Number.isFinite(d.sd) && (
          <DescRow label="SD" value={fmtNum(d.sd)} />
        )}
        {d.cv !== null && (
          <DescRow label="CV" value={fmtNum(d.cv)} />
        )}
        {Number.isFinite(d.skewness) && (
          <DescRow label="Skewness" value={fmtNum(d.skewness)} />
        )}
        {Number.isFinite(d.p90) && (
          <DescRow label="P90" value={fmtNum(d.p90)} />
        )}
        {Number.isFinite(d.p95) && (
          <DescRow label="P95" value={fmtNum(d.p95)} />
        )}
        {d.sigmaHat !== null && (
          <DescRow label="Sigma-hat" value={fmtNum(d.sigmaHat)} />
        )}
      </div>

      {/* UCL block */}
      {(u.studentT95 !== null || u.chebyshev.length > 0) && (
        <div data-testid="matrix-map-stats-ucl" className="space-y-1 pt-1 border-t border-slate-100 dark:border-slate-700/50">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            UCL 95%
          </p>
          {u.studentT95 !== null && (
            <DescRow label="Student's-t" value={fmtNum(u.studentT95)} testid="matrix-map-stats-ucl-student-t" />
          )}
          {u.chebyshev.map((e) => (
            <DescRow
              key={String(e.level)}
              label={'Chebyshev ' + fmtPct(e.level * 100)}
              value={fmtNum(e.ucl)}
              testid={'matrix-map-stats-ucl-chebyshev-' + String(Math.round(e.level * 1000))}
            />
          ))}
          <p
            data-testid="matrix-map-stats-ucl-basis"
            className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed mt-1"
          >
            {u.basis}
          </p>
        </div>
      )}

      {/* Caution chips */}
      {bucket.flags.length > 0 && (
        <div data-testid="matrix-map-stats-flags" className="flex flex-wrap gap-1">
          {bucket.flags.map((flag) => (
            <FlagChip key={flag} flag={flag} />
          ))}
        </div>
      )}

      {/* Excluded-count footer */}
      {bucket.excludedCount > 0 && (
        <p
          data-testid="matrix-map-stats-excluded"
          className="text-xs text-slate-400 dark:text-slate-500"
        >
          {bucket.excludedCount} row{bucket.excludedCount !== 1 ? 's' : ''} excluded (unparseable value or missing DL)
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function DescRow({
  label,
  value,
  testid,
}: {
  label: string;
  value: string;
  testid?: string;
}) {
  return (
    <div className="flex justify-between gap-2" data-testid={testid}>
      <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-xs font-mono text-slate-900 dark:text-slate-100 text-right">{value}</span>
    </div>
  );
}

const FLAG_LABEL: Record<StatFlag, string> = {
  insufficient_n: 'n < 2',
  small_n: 'Small n (< 10)',
  high_skew: 'High skew',
  dl_substitution_used: 'DL/2 used',
  excluded_rows: 'Rows excluded',
};

const FLAG_STYLE: Record<StatFlag, string> = {
  insufficient_n: 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
  small_n: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  high_skew: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  dl_substitution_used: 'bg-slate-50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700',
  excluded_rows: 'bg-slate-50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700',
};

function FlagChip({ flag }: { flag: StatFlag }) {
  return (
    <span
      data-testid={'matrix-map-stats-flag-' + flag}
      className={'inline-block rounded border px-1.5 py-0.5 text-xs ' + FLAG_STYLE[flag]}
    >
      {FLAG_LABEL[flag]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Formatting helpers (ASCII-only -- no Unicode symbols)
// ---------------------------------------------------------------------------

// Format a number for display: up to 6 significant figures, fallback to NaN string.
function fmtNum(v: number): string {
  if (!Number.isFinite(v)) return 'NaN';
  const s = v.toPrecision(6);
  // Exponent forms (1.23457e+8) pass through untouched.
  if (s.includes('e') || s.includes('E')) return s;
  // Trim zeros ONLY after a decimal point -- integer trailing zeros are
  // significant digits (100000 must render as 100000, never 1; codex 5.5
  // P2, 2026-06-05). Then drop a bare trailing decimal point.
  if (!s.includes('.')) return s;
  return s.replace(/0+$/, '').replace(/\.$/, '');
}

// Format a percentage: one decimal place.
function fmtPct(pct: number | null): string {
  // null = undefined ratio (e.g. detection frequency of an all-excluded
  // bucket, 0/0) -- render a dash, never '0.0%'.
  if (pct === null) return '--';
  return pct.toFixed(1) + '%';
}
