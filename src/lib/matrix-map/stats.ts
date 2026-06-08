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
import { prouclDistChoose, normalInverse, estimateGammaMle } from './gof';
import type { GofResults } from './gof';
import { recommendUcl } from './recommend-ucl';
import type { Recommendation } from './recommend-ucl';
import { computeKmStats, kmTUcl, kmChebyshevUcl } from './km';
import { getKStar, computeApproximateGammaUcl, computeAdjustedGammaUcl } from './gamma-ucl';
import { computeHUcl } from './h-ucl';
import { runOutliersCheck } from './outliers';
import type { OutlierResult } from './outliers';



// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// DL/2 substitution factor for Phase 1.
// Phase 3 replaces this with the KM/ROS selector.
export const DL_SUBSTITUTION_FACTOR = 0.5;

// Human-readable label shown in the UCL basis line when DL/2 is in use.
export const DL_SUBSTITUTION_LABEL = 'DL/2 substitution';

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
  | 'excluded_rows'      // at least one row could not be parsed or used
  | 'outliers_detected';  // at least one outlier detected by Dixon/Rosner

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
  // Recalculated for lognormal sigmaHat (SD of ln(detects), ddof=1)
  sigmaHat: number | null;            // sample SD of ln(detects > 0), ddof=1; null when < 2 positives
}

export interface ChebyshevUclEntry {
  level: number;
  ucl: number;
}

export interface UclResult {
  studentT95: number | null;           // null when n < 2
  chebyshev: ChebyshevUclEntry[];      // empty when n < 2
  approximateGamma: number | null;     // fallback to studentT95 in Phase 2
  adjustedGamma: number | null;        // fallback to studentT95 in Phase 2
  hUcl: number | null;                 // fallback to studentT95 in Phase 2
  // Human-readable basis line for display; always present.
  basis: string;
}

export interface StatsBucket {
  substanceId: string | null;
  substanceDisplayName: string;
  unit: string | null;
  bucketKey: string;
  descriptive: DescriptiveStats;
  ucl: UclResult;
  gof: GofResults;
  recommendation: Recommendation;
  acceptedValues: number[];
  flags: StatFlag[];
  excludedCount: number;
  notes: string[];
  outliers: OutlierResult[];
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
  censoredMethod?: 'KM' | 'ROS' | 'DL2';
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
  const { rows, filterState, censoredMethod = 'KM' } = input;
  const filtered = filterMeasurementRows(rows, filterState);

  // Group rows into buckets: key = <substance identity> + '__' + (unit ?? '').
  // Substance identity falls back through substance_key then display name
  // when substance_id is null, so two UNIDENTIFIED substances can never
  // silently aggregate into one bucket (codex 5.5 P2, 2026-06-05). The
  // 'id:'/'key:'/'name:' prefixes prevent collisions between an id and a
  // key/name that happen to share a string value.
  // Null unit rows also form their own bucket (never merged with a named unit).
  const rowIndexMap = new Map<MatrixMapMeasurementRow, number>();
  for (let i = 0; i < rows.length; i++) {
    rowIndexMap.set(rows[i], i);
  }

  const bucketMap = new Map<string, { row: MatrixMapMeasurementRow; originalIndex: number }[]>();
  for (const row of filtered) {
    const substanceIdentity =
      row.substance_id !== null
        ? 'id:' + row.substance_id
        : row.substance_key !== null
          ? 'key:' + row.substance_key
          : 'name:' + row.substance_display_name;
    const key = substanceIdentity + '__' + (row.unit ?? '');
    if (!bucketMap.has(key)) bucketMap.set(key, []);
    const originalIndex = rowIndexMap.get(row) ?? -1;
    bucketMap.get(key)!.push({ row, originalIndex });
  }

  const buckets: StatsBucket[] = [];
  for (const [key, bucketRows] of bucketMap) {
    buckets.push(computeBucket(key, bucketRows, censoredMethod));
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

function computeBucket(
  bucketKey: string,
  rows: { row: MatrixMapMeasurementRow; originalIndex: number }[],
  censoredMethod: 'KM' | 'ROS' | 'DL2'
): StatsBucket {
  // All rows in this bucket share the same substance_id + unit (by construction).
  const firstRow = rows[0].row;
  const substanceId = firstRow.substance_id;
  const substanceDisplayName =
    firstRow.substance_display_name || firstRow.substance_key || firstRow.substance_id || '(unknown)';
  const unit = firstRow.unit;

  // 1. Initial Parse and Filter of Rows
  const rawParsed: { value: number; censored: boolean; detectionLimit: number | null; originalIndex: number }[] = [];
  const detectValues: number[] = [];
  const detectOriginalIndices: number[] = [];
  let excludedCount = 0;
  let nonDetects = 0;

  for (let idx = 0; idx < rows.length; idx++) {
    const { row, originalIndex } = rows[idx];
    if (row.censored === true) {
      const dlParsed = parseValue(row.detection_limit);
      if (!dlParsed.ok) {
        excludedCount++;
        continue;
      }
      rawParsed.push({
        value: dlParsed.value,
        censored: true,
        detectionLimit: dlParsed.value,
        originalIndex,
      });
      nonDetects++;
    } else {
      const valParsed = parseValue(row.value);
      if (!valParsed.ok) {
        excludedCount++;
        continue;
      }
      rawParsed.push({
        value: valParsed.value,
        censored: false,
        detectionLimit: null,
        originalIndex,
      });
      detectValues.push(valParsed.value);
      detectOriginalIndices.push(originalIndex);
    }
  }

  const n = rawParsed.length;
  const detects = detectValues.length;
  const hasCensored = nonDetects > 0;
  const flags: StatFlag[] = [];
  if (excludedCount > 0) flags.push('excluded_rows');

  const notes: string[] = [];

  // 2. Outliers Detection (on detected observations only)
  const rawOutliers = runOutliersCheck(detectValues);
  const outliers: OutlierResult[] = rawOutliers.map((o) => ({
    value: o.value,
    index: detectOriginalIndices[o.index], // Map back to original row index
    testUsed: o.testUsed,
    level: o.level,
  }));
  if (outliers.length > 0) {
    flags.push('outliers_detected');
  }

  // 3. Imputation / Substitution Pathways
  let values: number[] = [];
  let dlSubstitutionUsed = false;

  if (hasCensored) {
    if (censoredMethod === 'DL2') {
      // DL/2 Substitution pathway
      for (const item of rawParsed) {
        if (item.censored) {
          values.push(item.value * DL_SUBSTITUTION_FACTOR);
        } else {
          values.push(item.value);
        }
      }
      dlSubstitutionUsed = true;
      flags.push('dl_substitution_used');
    } else if (censoredMethod === 'ROS') {
      const positiveDetects = detectValues.filter((v) => v > 0);
      const hasNonPositiveDetect = detectValues.some((v) => v <= 0);
      if (detects === 0 || positiveDetects.length === 0 || hasNonPositiveDetect) {
        // Fall back to DL/2 substitution when there are no detected values or non-positive detects to fit a regression line
        for (const item of rawParsed) {
          if (item.censored) {
            values.push(item.value * DL_SUBSTITUTION_FACTOR);
          } else {
            values.push(item.value);
          }
        }
        dlSubstitutionUsed = true;
        flags.push('dl_substitution_used');
      } else {
        // Lognormal ROS Imputation pathway
        // Sort the rawParsed data by value (ascending)
        const sortedParsed = [...rawParsed].sort((a, b) => a.value - b.value);
        const nTotal = sortedParsed.length;

        // Fit linear regression log(value) vs Normal Quantile for detects
        // Using Blom plotting position: p_i = (i - 0.375) / (n + 0.25)
        const zVals: number[] = [];
        const yVals: number[] = [];
        for (let i = 0; i < nTotal; i++) {
          const item = sortedParsed[i];
          if (!item.censored) {
            const p = (i + 1 - 0.375) / (nTotal + 0.25);
            const z = normalInverse(p);
            const y = Math.log(item.value);
            zVals.push(z);
            yVals.push(y);
          }
        }

        let slope = 0.0;
        let intercept = 0.0;
        const nDetects = yVals.length;

        if (nDetects >= 2) {
          const sumZ = zVals.reduce((a, b) => a + b, 0);
          const sumY = yVals.reduce((a, b) => a + b, 0);
          const sumZ2 = zVals.reduce((a, b) => a + b * b, 0);
          const sumZY = zVals.reduce((acc, z, idx) => acc + z * yVals[idx], 0);

          const denom = nDetects * sumZ2 - sumZ * sumZ;
          if (denom !== 0) {
            slope = (nDetects * sumZY - sumZ * sumY) / denom;
            intercept = (sumY - slope * sumZ) / nDetects;
          } else {
            intercept = sumY / nDetects;
          }
        } else if (nDetects === 1) {
          intercept = yVals[0];
        }

        // Impute censored values
        const imputedMap = new Map<number, number>();
        for (let i = 0; i < nTotal; i++) {
          const item = sortedParsed[i];
          if (item.censored) {
            const p = (i + 1 - 0.375) / (nTotal + 0.25);
            const z = normalInverse(p);
            const yImputed = intercept + slope * z;
            const valImputed = Math.min(item.value, Math.exp(yImputed));
            imputedMap.set(item.originalIndex, valImputed);
          }
        }

        // Build values array in original order
        for (const item of rawParsed) {
          if (item.censored) {
            values.push(imputedMap.get(item.originalIndex) ?? item.value);
          } else {
            values.push(item.value);
          }
        }
      }
    } else {
      // KM pathway: descriptive values can use DL/2 substituted values as a fallback
      // for percentile/sorting visuals, but core calculations use KM primitives directly.
      for (const item of rawParsed) {
        if (item.censored) {
          values.push(item.value * DL_SUBSTITUTION_FACTOR);
        } else {
          values.push(item.value);
        }
      }
    }
  } else {
    // Uncensored pathway
    values = rawParsed.map((item) => item.value);
  }

  // 4. Calculate Descriptive Statistics
  const sorted = [...values].sort((a, b) => a - b);
  const m = n > 0 ? mean(values) : Number.NaN;
  const med = median(sorted);
  const sd = n >= 2 ? sampleStdDev(values) : Number.NaN;
  const cv = n >= 2 && m !== 0 ? sd / Math.abs(m) : null;
  const skew = n >= 3 ? sampleSkewness(values) : Number.NaN;
  const p90 = percentile(sorted, 0.90);
  const p95 = percentile(sorted, 0.95);

  const positiveLogs = detectValues.filter((v) => v > 0).map((v) => Math.log(v));
  const sigmaHat = positiveLogs.length >= 2 ? sampleStdDev(positiveLogs) : null;

  // Flags dependent on n and sigmaHat
  if (n < 2) {
    flags.push('insufficient_n');
  } else if (n < SMALL_N_UPPER) {
    flags.push('small_n');
  }
  if (sigmaHat !== null && sigmaHat > HIGH_SKEW_SIGMA_HAT) flags.push('high_skew');

  const detectionFrequencyPct = n > 0 ? (detects / n) * 100 : null;

  // 5. GOF Verdict
  const gof = prouclDistChoose(detectValues);

  // 6. Descriptive Stats and core parameter override for KM
  let finalMean = m;
  let finalSd = sd;
  let finalCv = cv;
  let finalSkew = skew;

  let kmStatsResult = null;
  if (hasCensored && censoredMethod === 'KM') {
    if (n >= 2) {
      kmStatsResult = computeKmStats(rawParsed.map((x) => ({ value: x.value, censored: x.censored })));
    }
    if (kmStatsResult) {
      finalMean = kmStatsResult.mean;
      finalSd = kmStatsResult.sd;
      finalCv = kmStatsResult.mean !== 0 ? kmStatsResult.sd / Math.abs(kmStatsResult.mean) : null;
      // Censored skewness is calculated on detected observations only
      finalSkew = detectValues.length >= 3 ? sampleSkewness(detectValues) : Number.NaN;
    } else {
      finalMean = Number.NaN;
      finalSd = Number.NaN;
      finalCv = null;
      finalSkew = Number.NaN;
      values = []; // Clear values to avoid leaking DL/2 placeholders
    }
  }

  const isKmEmptyFit = hasCensored && censoredMethod === 'KM' && !kmStatsResult;

  const descriptive: DescriptiveStats = {
    n,
    detects,
    nonDetects,
    detectionFrequencyPct,
    min: isKmEmptyFit || n === 0 ? Number.NaN : (kmStatsResult ? Math.min(...rawParsed.map((x) => x.value)) : sorted[0]),
    max: isKmEmptyFit || n === 0 ? Number.NaN : (kmStatsResult ? Math.max(...rawParsed.map((x) => x.value)) : sorted[sorted.length - 1]),
    mean: finalMean,
    median: isKmEmptyFit ? Number.NaN : med,
    sd: finalSd,
    cv: finalCv,
    skewness: finalSkew,
    p90: isKmEmptyFit ? Number.NaN : p90,
    p95: isKmEmptyFit ? Number.NaN : p95,
    sigmaHat,
  };

  // 7. Shape parameter bias-correction k*
  // If KM is selected, use KM mean and KM variance to calculate shape.
  let shapeEst = gof.gamma.shape;
  if (hasCensored) {
    if (censoredMethod === 'KM') {
      if (kmStatsResult && kmStatsResult.variance > 0) {
        shapeEst = (kmStatsResult.mean * kmStatsResult.mean) / kmStatsResult.variance;
      }
    } else if ((censoredMethod === 'ROS' || censoredMethod === 'DL2') && values.every((v) => v > 0)) {
      try {
        const mle = estimateGammaMle(values);
        shapeEst = mle.shape;
      } catch {
        // Fallback to detects-only if MLE estimation fails
      }
    }
  }
  const kStar = shapeEst && Number.isFinite(shapeEst) ? getKStar(shapeEst, n) : null;

  // Calculate method-specific log standard deviation for the recommendation ladder
  let recSigma = sigmaHat;
  if (hasCensored) {
    if (censoredMethod === 'KM') {
      const logParsed = rawParsed
        .filter((x) => x.value > 0)
        .map((x) => ({ value: Math.log(x.value), censored: x.censored }));
      const kmLogStats = computeKmStats(logParsed);
      if (kmLogStats && kmLogStats.sd > 0) {
        recSigma = kmLogStats.sd;
      }
    } else if (censoredMethod === 'ROS' || censoredMethod === 'DL2') {
      const completedLogs = values.filter((v) => v > 0).map((v) => Math.log(v));
      if (completedLogs.length >= 2) {
        recSigma = sampleStdDev(completedLogs);
      }
    }
  }

  // 8. Recommendation
  const logN = gof.verdict === 'Lognormal'
    ? (hasCensored && censoredMethod === 'KM'
        ? rawParsed.filter((x) => x.value > 0).length
        : values.filter((v) => v > 0).length)
    : undefined;

  const recommendation = recommendUcl(
    gof.verdict,
    n,
    recSigma,
    kStar,
    hasCensored,
    detects,
    censoredMethod,
    logN
  );

  if (recommendation.warning) {
    notes.push(recommendation.warning);
  }

  // 9. UCL Computations
  let tUcl = studentTUcl(values);
  let chemUcls = CHEBYSHEV_LEVELS.map((level) => ({
    level,
    ucl: chebyshevUcl(values, level) ?? Number.NaN,
  })).filter((e) => Number.isFinite(e.ucl));
  let approxGamma = computeApproximateGammaUcl(finalMean, kStar ?? 0.0, n);
  let adjustedGamma = computeAdjustedGammaUcl(finalMean, kStar ?? 0.0, n);
  let hUcl: number | null = null;

  // Calculate H-UCL for uncensored lognormal
  if (!hasCensored || censoredMethod !== 'KM') {
    const rawLogs = values.filter((v) => v > 0).map((v) => Math.log(v));
    if (rawLogs.length >= 3) {
      const meanLog = mean(rawLogs);
      const sdLog = sampleStdDev(rawLogs);
      hUcl = computeHUcl(meanLog, sdLog, rawLogs.length);
    } else {
      hUcl = null;
    }
  }

  // Override UCLs using direct KM formulas if in KM mode
  if (hasCensored && censoredMethod === 'KM') {
    if (kmStatsResult) {
      tUcl = kmTUcl(kmStatsResult, n);
      chemUcls = CHEBYSHEV_LEVELS.map((level) => ({
        level,
        ucl: kmChebyshevUcl(kmStatsResult, level) ?? Number.NaN,
      })).filter((e) => Number.isFinite(e.ucl));
      approxGamma = computeApproximateGammaUcl(kmStatsResult.mean, kStar ?? 0.0, n);
      adjustedGamma = computeAdjustedGammaUcl(kmStatsResult.mean, kStar ?? 0.0, n);

      // KM Lognormal H-UCL (KM-Log)
      const logParsed = rawParsed
        .filter((x) => x.value > 0)
        .map((x) => ({ value: Math.log(x.value), censored: x.censored }));
      const kmLogStats = computeKmStats(logParsed);
      if (kmLogStats && kmLogStats.sd > 0 && logParsed.length >= 3) {
        hUcl = computeHUcl(kmLogStats.mean, kmLogStats.sd, logParsed.length);
      } else {
        hUcl = null;
      }
    } else {
      // KM cannot fit (e.g. detects === 0)
      tUcl = null;
      chemUcls = [];
      approxGamma = null;
      adjustedGamma = null;
      hUcl = null;
    }
  }

  // If H-UCL was recommended but could not be computed (solver failed to find a valid root bracket due to extreme skewness),
  // fall back to the 95% Chebyshev UCL.
  let finalRecommendation = recommendation;
  if ((recommendation.recommendedMethod === 'hUcl' || recommendation.recommendedMethod === 'kmH') && hUcl === null) {
    const fallbackMethod = recommendation.recommendedMethod === 'kmH' ? 'kmChebyshev95' : 'chebyshev95';
    const fallbackLabel = recommendation.recommendedMethod === 'kmH' ? 'KM Chebyshev (95%)' : 'Chebyshev (95%)';
    finalRecommendation = {
      recommendedMethod: fallbackMethod,
      basisString: `${recommendation.basisString} (H-UCL solver failed to converge, fell back to ${fallbackLabel})`,
    };
  }

  const ucl: UclResult = {
    studentT95: tUcl,
    chebyshev: chemUcls,
    approximateGamma: approxGamma,
    adjustedGamma,
    hUcl,
    basis: dlSubstitutionUsed ? `${finalRecommendation.basisString} (${DL_SUBSTITUTION_LABEL})` : finalRecommendation.basisString,
  };



  return {
    substanceId,
    substanceDisplayName,
    unit,
    bucketKey,
    descriptive,
    ucl,
    gof,
    recommendation: finalRecommendation,
    acceptedValues: (hasCensored && censoredMethod === 'KM') ? [] : values,
    flags,
    excludedCount,
    notes,
    outliers,
  };
}
