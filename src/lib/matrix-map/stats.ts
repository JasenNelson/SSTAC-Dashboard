// Descriptive statistics + UCL95 engine for the matrix-map selection stats panel.
//
// Design authority: MATRIX_MAP_STATS_ENGINE_DESIGN_2026_06_05.md
// Phase 1 scope: descriptive stats + Student's-t UCL95 + Chebyshev UCL (three levels)
//                + DL/2 substitution placeholder.
// Phases 2-3: GOF + recommended-UCL decision + bootstrap + gamma/Land-H/KM/ROS
//             (all out of scope for Phase 1).
//
// WORKER-PORTABLE: no React, no DOM, no window references.
// Plain ASCII only (code point <= 127).

import { parseDecimalInput } from '@/lib/matrix-options/parseDecimal';
import { tCritical } from './inverse-t';
import type { MatrixMapMeasurementRow } from '@/stores/matrix-map/measurementStore';
import type { MatrixMapFilterState } from '@/stores/matrix-map/filterStore';
import { filterMeasurementRows } from './filter-measurements';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// DL/2 substitution factor for non-detects in Phase 1.
// Phase 3 replaces this with the KM/ROS selector.
export const DL_SUBSTITUTION_FACTOR = 0.5;

// Human-readable label shown in the UCL basis line when DL/2 is in use.
export const DL_SUBSTITUTION_LABEL = 'DL/2 substitution (placeholder until KM ships)';

// Minimum n for SD / UCL to be computable without the insufficient_n flag.
export const MIN_RELIABLE_N = 8;

// Below this n the small_n caution chip fires (but UCL is still emitted for n >= 2).
export const SMALL_N_UPPER = 10;

// Sigma-hat threshold for the high_skew caution chip.
export const HIGH_SKEW_SIGMA_HAT = 1.0;

// Confidence levels for the Chebyshev UCL output (three standard ProUCL levels).
export const CHEBYSHEV_LEVELS: readonly number[] = [0.95, 0.975, 0.99];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StatFlag =
  | 'insufficient_n'     // n < 2: no SD or UCL possible
  | 'small_n'            // 2 <= n < 10: treat results with caution
  | 'high_skew'          // sigmaHat > 1.0: possible log-normal data
  | 'dl_substitution_used' // at least one DL/2 substitution in this bucket
  | 'excluded_rows';     // at least one row could not be parsed or used

export interface DescriptiveStats {
  n: number;
  detects: number;
  nonDetects: number;
  // 0-100, or null when n === 0 (an all-excluded bucket has an undefined
  // 0/0 detection frequency -- never report it as 0%).
  detectionFrequencyPct: number | null;
  min: number;
  max: number;
  mean: number;
  median: number;
  sd: number;                         // sample SD (ddof=1)
  cv: number | null;                  // null when mean === 0
  skewness: number;                   // Pearson sample skewness (ddof=1)
  p90: number;                        // linear interpolation, type-7
  p95: number;                        // linear interpolation, type-7
  // VERIFY: sigma-hat uses detects-only log values (v > 0), ddof=1.
  // ProUCL may use the full substituted set or a different ddof -- confirm
  // before finalising Phase 2 parity gate.  In Phase 1 sigma-hat drives
  // ONLY the cosmetic high_skew chip; it does not affect any UCL value or
  // method selection, so this flagged ambiguity does not gate Phase 1.
  sigmaHat: number | null;            // sample SD of ln(detects > 0), ddof=1; null when < 2 positives
}

export interface ChebyshevUclEntry {
  level: number;
  ucl: number;
}

export interface UclResult {
  studentT95: number | null;           // null when n < 2
  chebyshev: ChebyshevUclEntry[];      // empty when n < 2
  // Human-readable basis line for display; always present.
  // e.g. "t(0.95, 7) = 1.8946; DL/2 substitution (placeholder until KM ships)"
  basis: string;
}

export interface StatsBucket {
  substanceId: string | null;
  substanceDisplayName: string;
  unit: string | null;
  // Bucket map key: "<id:substance_id|key:substance_key|name:display>__<unit|''>"
  // (used as React key / testid; buckets are SORTED by display name then
  // unit, not by this key; the prefixed identity falls back key->name when
  // substance_id is null so unidentified substances never aggregate).
  bucketKey: string;
  descriptive: DescriptiveStats;
  ucl: UclResult;
  flags: StatFlag[];
  excludedCount: number;
  notes: string[];
}

export interface StatsResult {
  buckets: StatsBucket[];
  totalRows: number;
  filteredRows: number;
}

// Input to computeSelectionStats (accepts the raw store rows + filter state).
export interface StatsInput {
  rows: MatrixMapMeasurementRow[];
  filterState: MatrixMapFilterState;
}

// ---------------------------------------------------------------------------
// Exported numeric primitives (unit-testable without React / stores)
// ---------------------------------------------------------------------------

// Arithmetic mean of an array.  Returns NaN for empty arrays.
export function mean(values: number[]): number {
  if (values.length === 0) return Number.NaN;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

// Median using linear interpolation (same as type-7 percentile at 0.5).
export function median(sorted: number[]): number {
  return percentile(sorted, 0.5);
}

// Sample standard deviation (ddof=1).  Returns NaN for n < 2.
export function sampleStdDev(values: number[]): number {
  if (values.length < 2) return Number.NaN;
  const m = mean(values);
  let sumSq = 0;
  for (const v of values) sumSq += (v - m) ** 2;
  return Math.sqrt(sumSq / (values.length - 1));
}

// Sample skewness (Pearson, ddof=1 bias correction; same as Excel SKEW).
// Returns NaN for n < 3 or SD === 0.
export function sampleSkewness(values: number[]): number {
  const n = values.length;
  if (n < 3) return Number.NaN;
  const m = mean(values);
  const s = sampleStdDev(values);
  if (s === 0) return Number.NaN;
  let sum3 = 0;
  for (const v of values) sum3 += ((v - m) / s) ** 3;
  return (n / ((n - 1) * (n - 2))) * sum3;
}

// Percentile via linear interpolation (type-7, same as R and NumPy default).
//
// VERIFY: Confirm ProUCL v5.2 uses type-7 (linear) interpolation for P90/P95
// percentile output rather than another convention (e.g. type-6 / Hazen).
// This affects the percentile display values but not the UCL formulas.
//
// Input: sorted ascending numeric array; q in [0, 1].
// Returns NaN for empty arrays.
export function percentile(sorted: number[], q: number): number {
  const n = sorted.length;
  if (n === 0) return Number.NaN;
  if (n === 1) return sorted[0];
  // Type-7 index: h = (n-1)*q
  const h = (n - 1) * q;
  const lo = Math.floor(h);
  const hi = Math.ceil(h);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo]);
}

// Student's-t UCL95: xbar + t(0.95, n-1) * s / sqrt(n).
// Returns null for n < 2.
export function studentTUcl(values: number[]): number | null {
  const n = values.length;
  if (n < 2) return null;
  const m = mean(values);
  const s = sampleStdDev(values);
  const t = tCritical(0.95, n - 1);
  return m + t * s / Math.sqrt(n);
}

// Chebyshev UCL at a given confidence level: xbar + sqrt(1/(1-level) - 1) * s / sqrt(n).
//
// VERIFY: The formula sqrt(1/(1-level) - 1) is the Chebyshev k-factor for the
// one-sided UCL on the mean (derived from P(|X - mu| <= k*sigma) >= 1 - 1/k^2
// rearranged for one-sided coverage of the mean estimator).
// Confirm vs ProUCL v5.2 Tech Guide section on Chebyshev UCL to ensure the
// same one-sided vs two-sided convention and whether ProUCL applies additional
// finite-sample corrections.
//
// Level 0.95: k = sqrt(1/0.05 - 1) = sqrt(19) ~= 4.3589
// Level 0.975: k = sqrt(1/0.025 - 1) = sqrt(39) ~= 6.2450
// Level 0.99: k = sqrt(1/0.01 - 1) = sqrt(99) ~= 9.9499
//
// Returns null for n < 2.
export function chebyshevUcl(values: number[], level: number): number | null {
  const n = values.length;
  if (n < 2) return null;
  const m = mean(values);
  const s = sampleStdDev(values);
  const k = Math.sqrt(1 / (1 - level) - 1);
  return m + k * s / Math.sqrt(n);
}

// ---------------------------------------------------------------------------
// parseValue: internal helper to parse a measurement value or detection_limit.
// Returns { ok: true, value: number } or { ok: false } (excluded row).
//
// Branching:
//   null            -> missing (excluded)
//   typeof 'number' -> accepted only if Number.isFinite(v) && v >= 0
//                      (a numeric -1 must be excluded just as string "-1" is)
//   typeof 'string' -> parseDecimalInput (rejects hex/commas; rejects negatives
//                      by default)
// ---------------------------------------------------------------------------

type ParseResult = { ok: true; value: number } | { ok: false };

function parseValue(raw: number | string | null): ParseResult {
  if (raw === null) return { ok: false };
  if (typeof raw === 'number') {
    // Enforce the same nonnegative contract as parseDecimalInput's default.
    if (!Number.isFinite(raw) || raw < 0) return { ok: false };
    return { ok: true, value: raw };
  }
  // string branch
  const result = parseDecimalInput(raw);
  if (result.state !== 'valid') return { ok: false };
  return { ok: true, value: result.value };
}

// ---------------------------------------------------------------------------
// computeSelectionStats: main entry point
// ---------------------------------------------------------------------------

export function computeSelectionStats(input: StatsInput): StatsResult {
  const { rows, filterState } = input;
  const filtered = filterMeasurementRows(rows, filterState);

  // Group rows into buckets: key = <substance identity> + '__' + (unit ?? '').
  // Substance identity falls back through substance_key then display name
  // when substance_id is null, so two UNIDENTIFIED substances can never
  // silently aggregate into one bucket (codex 5.5 P2, 2026-06-05). The
  // 'id:'/'key:'/'name:' prefixes prevent collisions between an id and a
  // key/name that happen to share a string value.
  // Null unit rows also form their own bucket (never merged with a named unit).
  const bucketMap = new Map<string, MatrixMapMeasurementRow[]>();
  for (const row of filtered) {
    const substanceIdentity =
      row.substance_id !== null
        ? 'id:' + row.substance_id
        : row.substance_key !== null
          ? 'key:' + row.substance_key
          : 'name:' + row.substance_display_name;
    const key = substanceIdentity + '__' + (row.unit ?? '');
    if (!bucketMap.has(key)) bucketMap.set(key, []);
    bucketMap.get(key)!.push(row);
  }

  const buckets: StatsBucket[] = [];
  for (const [key, bucketRows] of bucketMap) {
    buckets.push(computeBucket(key, bucketRows));
  }

  // Sort by display name then unit (nulls last for both).
  buckets.sort((a, b) => {
    const nameCmp = a.substanceDisplayName.localeCompare(b.substanceDisplayName);
    if (nameCmp !== 0) return nameCmp;
    if (a.unit === b.unit) return 0;
    if (a.unit === null) return 1;
    if (b.unit === null) return -1;
    return a.unit.localeCompare(b.unit);
  });

  return {
    buckets,
    totalRows: rows.length,
    filteredRows: filtered.length,
  };
}

function computeBucket(bucketKey: string, rows: MatrixMapMeasurementRow[]): StatsBucket {
  // All rows in this bucket share the same substance_id + unit (by construction).
  const firstRow = rows[0];
  const substanceId = firstRow.substance_id;
  const substanceDisplayName =
    firstRow.substance_display_name || firstRow.substance_key || firstRow.substance_id || '(unknown)';
  const unit = firstRow.unit;

  const values: number[] = [];        // all accepted values (detects + substituted DL/2)
  const detectValues: number[] = [];  // accepted detected values only (for sigma-hat)
  let nonDetects = 0;
  let excludedCount = 0;
  let dlSubstitutionUsed = false;
  const notes: string[] = [];

  for (const row of rows) {
    if (row.censored === true) {
      // DL/2 substitution branch.
      // censored === null is treated as detected (deliberate -- documented below).
      const dlParsed = parseValue(row.detection_limit);
      if (!dlParsed.ok) {
        // Censored row with unparseable or missing DL -> exclude.
        excludedCount++;
        continue;
      }
      const substituted = dlParsed.value * DL_SUBSTITUTION_FACTOR;
      values.push(substituted);
      nonDetects++;
      dlSubstitutionUsed = true;
    } else {
      // Detected row (censored === false OR censored === null).
      // NOTE: censored === null is treated as detected, NOT as a non-detect.
      // Rationale: absence of a censoring flag in the source data is assumed
      // to mean the measurement was above the detection limit.  This is a
      // conservative assumption for UCL computation (includes the value rather
      // than substituting DL/2).  Flag with a code comment so the assumption
      // is visible to a future KM/ROS implementation.
      const valParsed = parseValue(row.value);
      if (!valParsed.ok) {
        excludedCount++;
        continue;
      }
      values.push(valParsed.value);
      detectValues.push(valParsed.value);
    }
  }

  const flags: StatFlag[] = [];
  if (excludedCount > 0) flags.push('excluded_rows');
  if (dlSubstitutionUsed) flags.push('dl_substitution_used');

  const n = values.length;
  const detects = detectValues.length;
  // null (not 0) when n === 0: 0/0 is undefined and rendering it as "0.0%"
  // would misreport an all-excluded bucket as "no detects".
  const detectionFrequencyPct = n > 0 ? (detects / n) * 100 : null;

  // Compute descriptive stats.
  const sorted = [...values].sort((a, b) => a - b);
  const m = n > 0 ? mean(values) : Number.NaN;
  const med = median(sorted);
  const sd = n >= 2 ? sampleStdDev(values) : Number.NaN;
  const cv = (n >= 2 && m !== 0) ? sd / Math.abs(m) : null;
  const skew = n >= 3 ? sampleSkewness(values) : Number.NaN;
  const p90 = percentile(sorted, 0.90);
  const p95 = percentile(sorted, 0.95);

  // Sigma-hat: sample SD of ln(detects > 0), ddof=1.
  // VERIFY: ProUCL may compute sigma-hat from the full substituted set or use
  // a different ddof.  In Phase 1 sigma-hat drives ONLY the cosmetic high_skew
  // chip; it does not affect any UCL value or method selection, so this flagged
  // ambiguity does not gate Phase 1 under the bit-for-bit parity bar.
  const positiveLogs = detectValues.filter((v) => v > 0).map((v) => Math.log(v));
  const sigmaHat = positiveLogs.length >= 2 ? sampleStdDev(positiveLogs) : null;

  // Flags dependent on n and sigmaHat.
  if (n < 2) {
    flags.push('insufficient_n');
  } else if (n < SMALL_N_UPPER) {
    flags.push('small_n');
  }
  if (sigmaHat !== null && sigmaHat > HIGH_SKEW_SIGMA_HAT) flags.push('high_skew');

  const descriptive: DescriptiveStats = {
    n,
    detects,
    nonDetects,
    detectionFrequencyPct,
    min: n > 0 ? sorted[0] : Number.NaN,
    max: n > 0 ? sorted[sorted.length - 1] : Number.NaN,
    mean: m,
    median: med,
    sd,
    cv,
    skewness: skew,
    p90,
    p95,
    sigmaHat,
  };

  // UCL computation.
  const tUcl = studentTUcl(values);
  const chebyshev: ChebyshevUclEntry[] = CHEBYSHEV_LEVELS.map((level) => ({
    level,
    ucl: chebyshevUcl(values, level) ?? Number.NaN,
  })).filter((e) => Number.isFinite(e.ucl));

  // Build a human-readable basis line.
  const basisParts: string[] = [];
  if (tUcl !== null && n >= 2) {
    const df = n - 1;
    const tVal = tCritical(0.95, df);
    basisParts.push('t(0.95, ' + df + ') = ' + tVal.toFixed(4));
  }
  if (dlSubstitutionUsed) {
    basisParts.push(DL_SUBSTITUTION_LABEL);
  }
  const basis = basisParts.join('; ') || 'n < 2 -- UCL not computable';

  const ucl: UclResult = {
    studentT95: tUcl,
    chebyshev,
    basis,
  };

  return {
    substanceId,
    substanceDisplayName,
    unit,
    bucketKey,
    descriptive,
    ucl,
    flags,
    excludedCount,
    notes,
  };
}
