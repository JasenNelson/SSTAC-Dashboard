'use client';

// Phase 2 stats display component for the matrix-map left panel.
// Receives raw measurement rows + filter state; filters and computes
// descriptive stats + GOF + Recommended UCL + Bootstrap UCL.
//
// Traced to: docs/PROUCL_V52_EXTRACTION_PACKET_2026_06_06.md
// Plain ASCII only (code point <= 127).

import React, { useMemo, useState, useEffect } from 'react';
import { computeSelectionStats } from '@/lib/matrix-map/stats';
import type { StatsBucket, StatFlag } from '@/lib/matrix-map/stats';
import type { MatrixMapMeasurementRow } from '@/stores/matrix-map/measurementStore';
import type { MatrixMapFilterState } from '@/stores/matrix-map/filterStore';
import { bootstrapUcls } from '@/lib/matrix-map/bootstrap';
import type { BootstrapResults } from '@/lib/matrix-map/bootstrap';

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
  const [selectedMethod, setSelectedMethod] = useState<string>('recommended');
  const [bootstrapCache, setBootstrapCache] = useState<Record<string, BootstrapResults>>({});
  const [calculatingKeys, setCalculatingKeys] = useState<Record<string, boolean>>({});

  const result = useMemo(() => {
    if (!ready || isLoading) return null;
    return computeSelectionStats({ rows, filterState });
  }, [rows, filterState, isLoading, ready]);

  // Effect to run bootstrap calculation asynchronously if the active method is a bootstrap method
  useEffect(() => {
    if (!result) return;

    const missingBuckets: { bucketKey: string; values: number[]; cacheKey: string }[] = [];

    for (const bucket of result.buckets) {
      const activeMethod = selectedMethod === 'recommended'
        ? bucket.recommendation.recommendedMethod
        : selectedMethod;
      const isBootstrap = activeMethod === 'percentile95' || activeMethod === 'bca95' || activeMethod === 'bootstrapT';

      if (isBootstrap && bucket.acceptedValues.length >= 2) {
        // Sort values to compute a deterministic cache key
        const sortedVals = [...bucket.acceptedValues].sort((a, b) => a - b);
        const cacheKey = bucket.bucketKey + '::' + sortedVals.join(',');

        if (!bootstrapCache[cacheKey] && !calculatingKeys[cacheKey]) {
          missingBuckets.push({
            bucketKey: bucket.bucketKey,
            values: sortedVals,
            cacheKey,
          });
        }
      }
    }

    if (missingBuckets.length === 0) return;

    // Mark missing buckets as calculating
    setCalculatingKeys((prev) => {
      const next = { ...prev };
      for (const item of missingBuckets) {
        next[item.cacheKey] = true;
      }
      return next;
    });

    // Run async bootstrap calculations
    for (const item of missingBuckets) {
      bootstrapUcls(item.values)
        .then((res) => {
          setBootstrapCache((prev) => ({
            ...prev,
            [item.cacheKey]: res,
          }));
        })
        .catch((err) => {
          console.error('Bootstrap worker failed for ' + item.bucketKey, err);
        })
        .finally(() => {
          setCalculatingKeys((prev) => {
            const next = { ...prev };
            delete next[item.cacheKey];
            return next;
          });
        });
    }
  }, [result, selectedMethod, bootstrapCache, calculatingKeys]);

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

  // Render stats with dropdown
  return (
    <div className="space-y-3">
      {/* Dropdown method selector */}
      <div className="flex flex-col gap-1.5 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/30">
        <label htmlFor="ucl-method-selector" className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
          UCL Method Selector
        </label>
        <select
          id="ucl-method-selector"
          value={selectedMethod}
          onChange={(e) => setSelectedMethod(e.target.value)}
          className="w-full rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs px-2.5 py-1.5 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="recommended">ProUCL Recommended (Default)</option>
          <option value="studentT95">{"Student's-t (95%)"}</option>
          <option value="approximateGamma">Approximate Gamma (Wilson-Hilferty)</option>
          <option value="adjustedGamma">Adjusted Gamma (Grice-Bain)</option>
          <option value="hUcl">H-UCL</option>
          <option value="chebyshev95">Chebyshev 95%</option>
          <option value="chebyshev975">Chebyshev 97.5%</option>
          <option value="chebyshev99">Chebyshev 99%</option>
          <option value="percentile95">Percentile Bootstrap</option>
          <option value="bca95">BCA Bootstrap</option>
          <option value="bootstrapT">Bootstrap-t</option>
        </select>
      </div>

      <div data-testid="matrix-map-stats-buckets" className="space-y-3">
        {result.buckets.map((bucket) => (
          <BucketCard
            key={bucket.bucketKey}
            bucket={bucket}
            selectedMethod={selectedMethod}
            bootstrapCache={bootstrapCache}
            calculatingKeys={calculatingKeys}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BucketCard
// ---------------------------------------------------------------------------

interface BucketCardProps {
  bucket: StatsBucket;
  selectedMethod: string;
  bootstrapCache: Record<string, BootstrapResults>;
  calculatingKeys: Record<string, boolean>;
}

function BucketCard({
  bucket,
  selectedMethod,
  bootstrapCache,
  calculatingKeys,
}: BucketCardProps) {
  const d = bucket.descriptive;
  const u = bucket.ucl;

  const activeMethod = selectedMethod === 'recommended'
    ? bucket.recommendation.recommendedMethod
    : selectedMethod;

  const sortedVals = [...bucket.acceptedValues].sort((a, b) => a - b);
  const cacheKey = bucket.bucketKey + '::' + sortedVals.join(',');
  const isCalculating = calculatingKeys[cacheKey];
  const bData = bootstrapCache[cacheKey];

  let uclValue: number | null = null;
  let isBootstrap = false;
  let methodLabel = '';

  if (activeMethod === 'studentT95') {
    uclValue = u.studentT95;
    methodLabel = "Student's-t (95%)";
  } else if (activeMethod === 'chebyshev95') {
    uclValue = u.chebyshev.find((e) => e.level === 0.95)?.ucl ?? null;
    methodLabel = 'Chebyshev 95%';
  } else if (activeMethod === 'chebyshev975') {
    uclValue = u.chebyshev.find((e) => e.level === 0.975)?.ucl ?? null;
    methodLabel = 'Chebyshev 97.5%';
  } else if (activeMethod === 'chebyshev99') {
    uclValue = u.chebyshev.find((e) => e.level === 0.99)?.ucl ?? null;
    methodLabel = 'Chebyshev 99%';
  } else if (activeMethod === 'approximateGamma') {
    uclValue = u.approximateGamma;
    methodLabel = 'Approximate Gamma (Wilson-Hilferty)';
  } else if (activeMethod === 'adjustedGamma') {
    uclValue = u.adjustedGamma;
    methodLabel = 'Adjusted Gamma (Grice-Bain)';
  } else if (activeMethod === 'hUcl') {
    uclValue = u.hUcl;
    methodLabel = 'H-UCL';
  } else if (activeMethod === 'percentile95') {
    isBootstrap = true;
    uclValue = bData ? bData.percentile95 : null;
    methodLabel = 'Percentile Bootstrap';
  } else if (activeMethod === 'bca95') {
    isBootstrap = true;
    uclValue = bData ? bData.bca95 : null;
    methodLabel = 'BCA Bootstrap';
  } else if (activeMethod === 'bootstrapT') {
    isBootstrap = true;
    uclValue = bData ? bData.bootstrapT95 : null;
    methodLabel = 'Bootstrap-t';
  } else if (activeMethod === 'none') {
    methodLabel = 'Recommended UCL';
  }

  let displayVal = 'N/A';
  if (bucket.acceptedValues.length < 2) {
    displayVal = 'N/A';
  } else if (isBootstrap && (isCalculating || !bData)) {
    displayVal = 'Calculating...';
  } else if (uclValue !== null) {
    displayVal = fmtNum(uclValue);
  }

  let basisText = bucket.ucl.basis;
  if (selectedMethod !== 'recommended') {
    const censoredSuffix = bucket.flags.includes('dl_substitution_used')
      ? ' [DL/2 substitution (interim, Phase 3: KM)]'
      : '';
    basisText = `Manual Override -> ${methodLabel}${censoredSuffix}`;
  }

  let uclHeader = 'UCL 95%';
  if (activeMethod === 'chebyshev975') {
    uclHeader = 'UCL 97.5%';
  } else if (activeMethod === 'chebyshev99') {
    uclHeader = 'UCL 99%';
  }

  return (
    <div
      data-testid={'matrix-map-stats-bucket-' + bucket.bucketKey}
      className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/30 p-4 space-y-3"
    >
      {/* Header: substance - unit */}
      <div data-testid="matrix-map-stats-bucket-header" className="flex justify-between items-start">
        <div>
          <h4
            data-testid="matrix-map-stats-substance-name"
            className="text-xs font-bold text-slate-800 dark:text-slate-200"
          >
            {bucket.substanceDisplayName}
          </h4>
          {bucket.unit && (
            <span
              data-testid="matrix-map-stats-unit"
              className="text-[10px] text-slate-400 dark:text-slate-500"
            >
              {bucket.unit}
            </span>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div data-testid="matrix-map-stats-descriptive" className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-slate-600 dark:text-slate-400">
        <DescRow label="Sample size (n)" value={String(d.n)} />
        <DescRow label="Detects" value={String(d.detects)} />
        {d.detectionFrequencyPct !== null && (
          <DescRow label="Detection Freq" value={fmtPct(d.detectionFrequencyPct)} />
        )}
        {Number.isFinite(d.min) && (
          <DescRow label="Min" value={fmtNum(d.min)} />
        )}
        {Number.isFinite(d.max) && (
          <DescRow label="Max" value={fmtNum(d.max)} />
        )}
        {Number.isFinite(d.mean) && (
          <DescRow label="Mean" value={fmtNum(d.mean)} />
        )}
        {Number.isFinite(d.sd) && (
          <DescRow label="Std Dev" value={fmtNum(d.sd)} />
        )}
        {d.cv !== null && (
          <DescRow label="CV" value={fmtNum(d.cv)} />
        )}
        {Number.isFinite(d.skewness) && (
          <DescRow label="Skewness" value={fmtNum(d.skewness)} />
        )}
      </div>

      {/* UCL block */}
      {(uclValue !== null || isCalculating || activeMethod === 'none') && (
        <div data-testid="matrix-map-stats-ucl" className="space-y-1 pt-1 border-t border-slate-100 dark:border-slate-700/50">
          <div className="flex justify-between items-center mb-1">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {uclHeader}
            </p>
            {selectedMethod !== 'recommended' && (
              <span className="text-[10px] text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">
                Override
              </span>
            )}
          </div>
          <DescRow
            label={methodLabel}
            value={displayVal}
            testid="matrix-map-stats-ucl-value"
          />
          <p
            data-testid="matrix-map-stats-ucl-basis"
            className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed mt-1"
          >
            {basisText}
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

function fmtNum(v: number): string {
  if (!Number.isFinite(v)) return 'NaN';
  const s = v.toPrecision(6);
  if (s.includes('e') || s.includes('E')) return s;
  if (!s.includes('.')) return s;
  return s.replace(/0+$/, '').replace(/\.$/, '');
}

function fmtPct(pct: number | null): string {
  if (pct === null) return '--';
  return pct.toFixed(1) + '%';
}
