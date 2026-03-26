/**
 * Statistical comparison utilities for BN-RRM vs report-stated risk.
 *
 * Implements the methods defined in STATISTICAL_ANALYSIS_PLAN.md v1.0.
 * Primary metric: weighted Cohen's kappa (quadratic weights).
 * All metrics require bootstrap CI (n=48 matched stations).
 *
 * These measure inter-method agreement, not accuracy against ground truth.
 */

const CLASSES = ['low', 'moderate', 'high'] as const;
type _RiskClass = (typeof CLASSES)[number];

// ─── Confusion Matrix ────────────────────────────────────────────────────────

export function confusionMatrixFromPairs(
  predicted: string[],
  observed: string[],
  classes: readonly string[] = CLASSES
): number[][] {
  const n = classes.length;
  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let k = 0; k < predicted.length; k++) {
    const i = classes.indexOf(observed[k]);
    const j = classes.indexOf(predicted[k]);
    if (i >= 0 && j >= 0) matrix[i][j]++;
  }
  return matrix;
}

// ─── Cohen's Kappa (unweighted) ──────────────────────────────────────────────

export function cohensKappa(matrix: number[][]): number {
  const n = matrix.length;
  const total = matrix.reduce((s, row) => s + row.reduce((a, b) => a + b, 0), 0);
  if (total === 0) return 0;

  let po = 0; // observed agreement
  for (let i = 0; i < n; i++) po += matrix[i][i];
  po /= total;

  let pe = 0; // expected agreement
  for (let i = 0; i < n; i++) {
    const rowSum = matrix[i].reduce((a, b) => a + b, 0);
    const colSum = matrix.reduce((s, row) => s + row[i], 0);
    pe += (rowSum * colSum) / (total * total);
  }

  if (pe === 1) return 1;
  return (po - pe) / (1 - pe);
}

// ─── Weighted Kappa ──────────────────────────────────────────────────────────

export function weightedKappa(
  matrix: number[][],
  weights: 'linear' | 'quadratic' = 'quadratic'
): number {
  const n = matrix.length;
  const total = matrix.reduce((s, row) => s + row.reduce((a, b) => a + b, 0), 0);
  if (total === 0) return 0;

  // Build weight matrix
  const w: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => {
      const diff = Math.abs(i - j) / (n - 1);
      return weights === 'quadratic' ? diff * diff : diff;
    })
  );

  // Row and column marginals
  const rowSums = matrix.map((row) => row.reduce((a, b) => a + b, 0));
  const colSums = Array.from({ length: n }, (_, j) =>
    matrix.reduce((s, row) => s + row[j], 0)
  );

  let po = 0; // weighted observed
  let pe = 0; // weighted expected
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      po += w[i][j] * (matrix[i][j] / total);
      pe += w[i][j] * ((rowSums[i] * colSums[j]) / (total * total));
    }
  }

  if (pe === 0) return 1;
  return 1 - po / pe;
}

// ─── Bootstrap Confidence Interval ───────────────────────────────────────────

export function bootstrapCI(
  pairs: [string, string][],
  statFn: (pairs: [string, string][]) => number,
  nBootstraps: number = 2000,
  alpha: number = 0.05
): { point: number; lower: number; upper: number } {
  const point = statFn(pairs);
  const bootstrapStats: number[] = [];

  // Seeded PRNG for reproducibility (simple LCG)
  let seed = 42;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) & 0x7fffffff;
    return seed / 0x7fffffff;
  };

  for (let b = 0; b < nBootstraps; b++) {
    const sample: [string, string][] = [];
    for (let i = 0; i < pairs.length; i++) {
      const idx = Math.floor(rand() * pairs.length);
      sample.push(pairs[idx]);
    }
    bootstrapStats.push(statFn(sample));
  }

  bootstrapStats.sort((a, b) => a - b);
  const lowerIdx = Math.floor((alpha / 2) * nBootstraps);
  const upperIdx = Math.floor((1 - alpha / 2) * nBootstraps);

  return {
    point,
    lower: bootstrapStats[lowerIdx],
    upper: bootstrapStats[Math.min(upperIdx, nBootstraps - 1)],
  };
}

// ─── Helper: pairs -> kappa ──────────────────────────────────────────────────

export function weightedKappaFromPairs(pairs: [string, string][]): number {
  const predicted = pairs.map((p) => p[0]);
  const observed = pairs.map((p) => p[1]);
  const matrix = confusionMatrixFromPairs(predicted, observed, CLASSES);
  return weightedKappa(matrix, 'quadratic');
}

export function unweightedKappaFromPairs(pairs: [string, string][]): number {
  const predicted = pairs.map((p) => p[0]);
  const observed = pairs.map((p) => p[1]);
  const matrix = confusionMatrixFromPairs(predicted, observed, CLASSES);
  return cohensKappa(matrix);
}

// ─── McNemar's Test (binary reduction only) ──────────────────────────────────

export function mcNemarTest(
  pairs: [string, string][],
  binaryMap: (label: string) => 'positive' | 'negative'
): { chiSquare: number; pValue: number; b: number; c: number } {
  let b = 0; // BN-RRM positive, WOE negative
  let c = 0; // BN-RRM negative, WOE positive

  for (const [bnrrm, woe] of pairs) {
    const bnBin = binaryMap(bnrrm);
    const woeBin = binaryMap(woe);
    if (bnBin === 'positive' && woeBin === 'negative') b++;
    if (bnBin === 'negative' && woeBin === 'positive') c++;
  }

  const chiSquare = b + c > 0 ? Math.pow(Math.abs(b - c) - 1, 2) / (b + c) : 0;
  // Approximate p-value from chi-square with 1 df
  const pValue = 1 - chiSquareCDF(chiSquare, 1);

  return { chiSquare, pValue, b, c };
}

// ─── Per-class metrics ───────────────────────────────────────────────────────

export interface PerClassMetrics {
  precision: number;
  recall: number;
  f1: number;
  support: number;
}

export function perClassMetrics(
  predicted: string[],
  reference: string[],
  classes: readonly string[] = CLASSES
): Record<string, PerClassMetrics> {
  const result: Record<string, PerClassMetrics> = {};

  for (const cls of classes) {
    let tp = 0, fp = 0, fn = 0;
    for (let i = 0; i < predicted.length; i++) {
      if (predicted[i] === cls && reference[i] === cls) tp++;
      else if (predicted[i] === cls && reference[i] !== cls) fp++;
      else if (predicted[i] !== cls && reference[i] === cls) fn++;
    }
    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
    const support = tp + fn;

    result[cls] = { precision, recall, f1, support };
  }

  return result;
}

// ─── Convenience: full comparison report ─────────────────────────────────────

export interface ComparisonReport {
  n: number;
  nExcludedNoLOO: number;
  nExcludedNoWOE: number;
  overallAgreement: number;
  weightedKappa: { point: number; lower: number; upper: number };
  unweightedKappa: { point: number; lower: number; upper: number };
  confusionMatrix: number[][];
  perClass: Record<string, PerClassMetrics>;
  mcNemar: { chiSquare: number; pValue: number; b: number; c: number } | null;
}

export function computeComparisonReport(
  bnrrmPredictions: string[],
  woeMappedLabels: string[],
  nExcludedNoLOO: number = 0,
  nExcludedNoWOE: number = 0,
  includeMcNemar: boolean = true
): ComparisonReport {
  const n = bnrrmPredictions.length;
  const pairs: [string, string][] = bnrrmPredictions.map((b, i) => [b, woeMappedLabels[i]]);

  const matrix = confusionMatrixFromPairs(bnrrmPredictions, woeMappedLabels, CLASSES);
  const agree = bnrrmPredictions.filter((b, i) => b === woeMappedLabels[i]).length;

  const wkCI = bootstrapCI(pairs, weightedKappaFromPairs);
  const ukCI = bootstrapCI(pairs, unweightedKappaFromPairs);

  const perCls = perClassMetrics(bnrrmPredictions, woeMappedLabels, CLASSES);

  let mcNemar: ComparisonReport['mcNemar'] = null;
  if (includeMcNemar) {
    mcNemar = mcNemarTest(pairs, (label) =>
      label === 'moderate' || label === 'high' ? 'positive' : 'negative'
    );
  }

  return {
    n,
    nExcludedNoLOO,
    nExcludedNoWOE,
    overallAgreement: n > 0 ? agree / n : 0,
    weightedKappa: wkCI,
    unweightedKappa: ukCI,
    confusionMatrix: matrix,
    perClass: perCls,
    mcNemar,
  };
}

// ─── Internal: chi-square CDF approximation ──────────────────────────────────

function chiSquareCDF(x: number, df: number): number {
  if (x <= 0) return 0;
  // For df=1, use the relationship with the normal distribution
  if (df === 1) {
    return erf(Math.sqrt(x / 2));
  }
  // Simple incomplete gamma approximation for small df
  return regularizedGammaP(df / 2, x / 2);
}

function erf(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
}

function regularizedGammaP(a: number, x: number): number {
  // Series expansion for small x
  if (x < a + 1) {
    let sum = 1 / a;
    let term = 1 / a;
    for (let n = 1; n < 100; n++) {
      term *= x / (a + n);
      sum += term;
      if (Math.abs(term) < 1e-10) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
  }
  // Continued fraction for large x
  return 1 - regularizedGammaQ(a, x);
}

function regularizedGammaQ(a: number, x: number): number {
  const f = 1 + x - a; let c = 1 / 1e-30, d = 1 / f, h = d;
  for (let i = 1; i < 100; i++) {
    const an = -i * (i - a);
    const bn = 2 * i + 1 + x - a;
    d = bn + an * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = bn + an / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-10) break;
  }
  return Math.exp(-x + a * Math.log(x) - logGamma(a)) * h;
}

function logGamma(x: number): number {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.001208650973866179, -0.000005395239384953];
  let y = x, tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) ser += c[j] / ++y;
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}
