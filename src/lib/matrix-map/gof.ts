// Goodness-of-Fit (GOF) tests for Normality, Gamma, and Lognormality.
// Traced to: docs/PROUCL_V52_EXTRACTION_PACKET_2026_06_06.md Section B, C, & G.
// Plain ASCII only.

import { AD_GAMMA_CRITICAL_VALUES } from './ad-table';
import { KS_GAMMA_CRITICAL_VALUES } from './ks-table';
import { lnGamma } from './inverse-t';

// ---------------------------------------------------------------------------
// 1. Math and Probability Primitives
// ---------------------------------------------------------------------------

// Standard error function (erf) using Abramowitz & Stegun formula 7.1.26
// Maximum error is 1.5e-7. Plain ASCII.
export function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);

  const p = 0.3275911;
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;

  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);

  return sign * y;
}

// Standard Normal Cumulative Distribution Function (CDF).
export function normalCdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.sqrt(2)));
}

// Inverse Standard Normal CDF (Probit function) using Beasley-Springer-Moro rational approximation.
// Plain ASCII.
export function normalInverse(p: number): number {
  if (p <= 0 || p >= 1) return Number.NaN;
  const a = [
    2.506628277459239e+0,
    -3.066479806614716e+1,
    1.383577518672690e+2,
    -2.759285104469687e+2,
    2.209460984245205e+2,
    -3.969683028665376e+1
  ];
  const b = [
    1.0,
    -1.328068155288572e+1,
    6.680131188771972e+1,
    -1.556989798598866e+2,
    1.615858368580409e+2,
    -5.447609879822406e+1
  ];
  const c = [
    2.938163982698783e+0,
    4.374664141464968e+0,
    -2.549732539343734e+0,
    -2.400758277161838e+0,
    -3.223964580411365e-1,
    -7.784894002430293e-3
  ];
  const d = [
    1.0,
    3.754408661907416e+0,
    2.445134137142996e+0,
    3.224671290700398e-1,
    7.784695709041462e-3
  ];

  let q = 0;
  let y = 0;

  if (p < 0.02425) {
    q = Math.sqrt(-2 * Math.log(p));
    y = (((((c[5] * q + c[4]) * q + c[3]) * q + c[2]) * q + c[1]) * q + c[0]) /
        ((((d[4] * q + d[3]) * q + d[2]) * q + d[1]) * q + d[0]);
  } else if (p < 1 - 0.02425) {
    q = p - 0.5;
    const r = q * q;
    y = (((((a[5] * r + a[4]) * r + a[3]) * r + a[2]) * r + a[1]) * r + a[0]) * q /
        ((((((b[5] * r + b[4]) * r + b[3]) * r + b[2]) * r + b[1]) * r + b[0]));
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    y = -(((((c[5] * q + c[4]) * q + c[3]) * q + c[2]) * q + c[1]) * q + c[0]) /
        ((((d[4] * q + d[3]) * q + d[2]) * q + d[1]) * q + d[0]);
  }
  return y;
}

// Digamma function computed via recurrence and asymptotic expansion.
export function digamma(x: number): number {
  let sumVal = 0.0;
  while (x < 8.0) {
    sumVal -= 1.0 / x;
    x += 1.0;
  }
  const r = 1.0 / x;
  const r2 = r * r;
  sumVal += Math.log(x) - 0.5 * r - r2 * (1.0 / 12.0 - r2 * (1.0 / 120.0 - r2 * (1.0 / 252.0 - r2 * (1.0 / 240.0 - r2 * (5.0 / 660.0)))));
  return sumVal;
}

// Trigamma function computed via recurrence and asymptotic expansion.
export function trigamma(x: number): number {
  let sumVal = 0.0;
  while (x < 8.0) {
    sumVal += 1.0 / (x * x);
    x += 1.0;
  }
  const r = 1.0 / x;
  const r2 = r * r;
  sumVal += r + 0.5 * r2 + r * r2 * (1.0 / 6.0 - r2 * (1.0 / 30.0 - r2 * (1.0 / 42.0 - r2 * (1.0 / 30.0 - r2 * (5.0 / 66.0)))));
  return sumVal;
}

// Regularized lower incomplete gamma series expansion (for x < a + 1).
function gammaSeries(a: number, x: number): number {
  const EPS = 1.0e-14;
  let sum = 1.0 / a;
  let del = sum;
  const maxIter = 200;
  let ap = a;
  for (let n = 1; n <= maxIter; n++) {
    ap += 1;
    del = del * x / ap;
    sum += del;
    if (Math.abs(del) < Math.abs(sum) * EPS) {
      break;
    }
  }
  return sum * Math.exp(-x + a * Math.log(x) - lnGamma(a));
}

// Regularized lower incomplete gamma continued fraction (Lentz's method, for x >= a + 1).
function gammaCf(a: number, x: number): number {
  const EPS = 1.0e-14;
  const FPMIN = 1.0e-30;
  let b = x + 1.0 - a;
  let c = 1.0 / FPMIN;
  let d = 1.0 / b;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  let h = d;
  const maxIter = 200;
  for (let n = 1; n <= maxIter; n++) {
    const an = -n * (n - a);
    b += 2.0;
    d = an * d + b;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = b + an / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1.0 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1.0) < EPS) {
      break;
    }
  }
  return 1.0 - h * Math.exp(-x + a * Math.log(x) - lnGamma(a));
}

// Regularized lower incomplete gamma function P(a, x) = gamma(a, x)/Gamma(a).
export function regularizedLowerIncompleteGamma(a: number, x: number): number {
  if (x <= 0) return 0;
  if (a <= 0) return Number.NaN;
  if (x < a + 1.0) {
    return gammaSeries(a, x);
  } else {
    return gammaCf(a, x);
  }
}

// Gamma distribution CDF.
export function gammaCdf(x: number, shape: number, scale: number): number {
  return regularizedLowerIncompleteGamma(shape, x / scale);
}

// ---------------------------------------------------------------------------
// 2. Parameter Estimation
// ---------------------------------------------------------------------------

// MLE parameter estimation for Gamma distribution using Thom's approximation + Newton-Raphson digamma solver.
export function estimateGammaMle(values: number[]): { shape: number; scale: number } {
  const n = values.length;
  if (n === 0) return { shape: Number.NaN, scale: Number.NaN };
  const sum = values.reduce((a, b) => a + b, 0);
  const meanVal = sum / n;

  let sumLn = 0;
  for (const v of values) {
    if (v <= 0) {
      throw new Error("All values must be positive for Gamma parameter estimation");
    }
    sumLn += Math.log(v);
  }
  const sL = Math.log(meanVal) - sumLn / n;

  // Thom's initial approximation
  let k = (1.0 + Math.sqrt(1.0 + 4.0 * sL / 3.0)) / (4.0 * sL);

  // Newton-Raphson solver
  const EPS = 1.0e-12;
  const MAX_ITER = 100;
  for (let i = 0; i < MAX_ITER; i++) {
    const f = Math.log(k) - digamma(k) - sL;
    const df = 1.0 / k - trigamma(k);
    if (Math.abs(df) < 1.0e-14) break;
    const step = f / df;
    k -= step;
    if (k <= 0) {
      k = 1.0e-5; // Clamp to small positive value to avoid log issues
    }
    if (Math.abs(step) < EPS) break;
  }

  const scale = meanVal / k;
  return { shape: k, scale };
}

// ---------------------------------------------------------------------------
// 3. Shapiro-Wilk Normality Test
// ---------------------------------------------------------------------------

// Shapiro-Wilk test for n in [4, 5000]. Royston's 1995 algorithm.
export function shapiroWilk(x: number[]): { w: number; p: number } {
  const n = x.length;
  if (n < 4 || n > 5000) {
    return { w: Number.NaN, p: Number.NaN };
  }

  const sortedX = [...x].sort((a, b) => a - b);
  const meanVal = x.reduce((a, b) => a + b, 0) / n;

  let ss = 0;
  for (const val of x) {
    ss += (val - meanVal) ** 2;
  }
  if (ss === 0) {
    return { w: 1.0, p: 1.0 };
  }

  const u = 1.0 / Math.sqrt(n);
  const m: number[] = [];
  let md = 0;
  for (let i = 1; i <= n; i++) {
    const mVal = normalInverse((i - 0.375) / (n + 0.25));
    m.push(mVal);
    md += mVal * mVal;
  }

  const c: number[] = [];
  const sqrtMd = Math.sqrt(md);
  for (let i = 0; i < n; i++) {
    c.push(m[i] / sqrtMd);
  }

  // Weight coefficients calculation
  const an = -2.706056 * Math.pow(u, 5) + 4.434685 * Math.pow(u, 4) - 2.071190 * Math.pow(u, 3) - 0.147981 * Math.pow(u, 2) + 0.221157 * u + c[n - 1];
  const ann = -3.582633 * Math.pow(u, 5) + 5.682633 * Math.pow(u, 4) - 1.752461 * Math.pow(u, 3) - 0.293762 * Math.pow(u, 2) + 0.042981 * u + c[n - 2];

  let phi = 0;
  if (n > 5) {
    phi = (md - 2 * Math.pow(m[n - 1], 2) - 2 * Math.pow(m[n - 2], 2)) / (1 - 2 * Math.pow(an, 2) - 2 * Math.pow(ann, 2));
  } else {
    phi = (md - 2 * Math.pow(m[n - 1], 2)) / (1 - 2 * Math.pow(an, 2));
  }

  const a: number[] = [];
  if (n > 5) {
    a.push(-an);
    a.push(-ann);
    const sqrtPhi = Math.sqrt(phi);
    for (let i = 2; i < n - 2; i++) {
      a.push(m[i] / sqrtPhi);
    }
    a.push(ann);
    a.push(an);
  } else {
    a.push(-an);
    const sqrtPhi = Math.sqrt(phi);
    for (let i = 1; i < n - 1; i++) {
      a.push(m[i] / sqrtPhi);
    }
    a.push(an);
  }

  // Test statistic W
  let sumProd = 0;
  for (let i = 0; i < n; i++) {
    sumProd += a[i] * sortedX[i];
  }
  const w = Math.pow(sumProd, 2) / ss;

  // p-value calculation
  let g = 0;
  let mu = 0;
  let sigma = 0;

  if (n < 12) {
    const gamma = 0.459 * n - 2.273;
    g = -Math.log(gamma - Math.log(1 - w));
    mu = -0.0006714 * Math.pow(n, 3) + 0.025054 * Math.pow(n, 2) - 0.39978 * n + 0.5440;
    sigma = Math.exp(-0.0020322 * Math.pow(n, 3) + 0.062767 * Math.pow(n, 2) - 0.77857 * n + 1.3822);
  } else {
    const lnN = Math.log(n);
    g = Math.log(1 - w);
    mu = 0.0038915 * Math.pow(lnN, 3) - 0.083751 * Math.pow(lnN, 2) - 0.31082 * lnN - 1.5851;
    sigma = Math.exp(0.0030302 * Math.pow(lnN, 2) - 0.082676 * lnN - 0.4803);
  }

  const z = (g - mu) / sigma;
  const p = 1.0 - normalCdf(z);

  return { w, p };
}

// Shapiro-Wilk analytical critical value solver (by reversing the Royston transformation).
export function shapiroWilkCritVal(n: number, alpha: number): number {
  if (n < 4 || n > 5000) return Number.NaN;
  const z = normalInverse(1.0 - alpha);
  if (n < 12) {
    const gamma = 0.459 * n - 2.273;
    const mu = -0.0006714 * Math.pow(n, 3) + 0.025054 * Math.pow(n, 2) - 0.39978 * n + 0.5440;
    const sigma = Math.exp(-0.0020322 * Math.pow(n, 3) + 0.062767 * Math.pow(n, 2) - 0.77857 * n + 1.3822);
    const g = z * sigma + mu;
    return 1.0 - Math.exp(gamma - Math.exp(-g));
  } else {
    const lnN = Math.log(n);
    const mu = 0.0038915 * Math.pow(lnN, 3) - 0.083751 * Math.pow(lnN, 2) - 0.31082 * lnN - 1.5851;
    const sigma = Math.exp(0.0030302 * Math.pow(lnN, 2) - 0.082676 * lnN - 0.4803);
    const g = z * sigma + mu;
    return 1.0 - Math.exp(g);
  }
}

// ---------------------------------------------------------------------------
// 4. Lilliefors Normality Test
// ---------------------------------------------------------------------------

// Lilliefors test: maximum vertical distance between ECDF and Normal CDF.
// p-values computed via nortest / Dallal-Wilkinson formulas.
export function lillieforsTest(x: number[]): { d: number; p: number } {
  const n = x.length;
  if (n < 5) {
    return { d: Number.NaN, p: Number.NaN };
  }

  const sortedX = [...x].sort((a, b) => a - b);
  const sum = x.reduce((a, b) => a + b, 0);
  const meanVal = sum / n;

  let sumSq = 0;
  for (const val of x) {
    sumSq += (val - meanVal) ** 2;
  }
  const sd = Math.sqrt(sumSq / (n - 1));
  if (sd === 0) {
    return { d: 0, p: 1.0 };
  }

  // Calculate KS statistic Components
  let dPlus = 0;
  let dMinus = 0;
  for (let i = 0; i < n; i++) {
    const pnorm = normalCdf((sortedX[i] - meanVal) / sd);
    const plus = (i + 1) / n - pnorm;
    const minus = pnorm - i / n;
    if (plus > dPlus) dPlus = plus;
    if (minus > dMinus) dMinus = minus;
  }
  const k = Math.max(dPlus, dMinus);

  // Dallal-Wilkinson scaling for sample size
  let Kd = k;
  let nd = n;
  if (n > 100) {
    Kd = k * Math.pow(n / 100.0, 0.49);
    nd = 100;
  }

  // Polynomial Dallal-Wilkinson formula
  let pvalue = Math.exp(-7.01256 * Kd * Kd * (nd + 2.78019) + 2.99587 * Kd * Math.sqrt(nd + 2.78019) - 0.122119 + 0.974598 / Math.sqrt(nd) + 1.67997 / nd);

  // If pvalue is large, switch to Stephens' formula
  if (pvalue > 0.1) {
    const KK = (Math.sqrt(n) - 0.01 + 0.85 / Math.sqrt(n)) * k;
    if (KK <= 0.302) {
      pvalue = 1.0;
    } else if (KK <= 0.5) {
      pvalue = 2.76773 - 19.828315 * KK + 80.709644 * KK * KK - 138.55152 * Math.pow(KK, 3) + 81.218052 * Math.pow(KK, 4);
    } else if (KK <= 0.9) {
      pvalue = -4.901232 + 40.662806 * KK - 97.490286 * KK * KK + 94.029866 * Math.pow(KK, 3) - 32.355711 * Math.pow(KK, 4);
    } else if (KK <= 1.31) {
      pvalue = 6.198765 - 19.558097 * KK + 23.186922 * KK * KK - 12.234627 * Math.pow(KK, 3) + 2.423045 * Math.pow(KK, 4);
    } else {
      pvalue = 0.0;
    }
  }

  return { d: k, p: pvalue };
}

// Lilliefors analytical critical value solver (using Dallal-Wilkinson quadratic formula).
export function lillieforsCritVal(n: number, alpha: number): number {
  if (n < 5) return Number.NaN;
  const nd = n <= 100 ? n : 100;
  const A = -7.01256 * (nd + 2.78019);
  const B = 2.99587 * Math.sqrt(nd + 2.78019);
  const C = -0.122119 + 0.974598 / Math.sqrt(nd) + 1.67997 / nd;
  const C_adj = C - Math.log(alpha);

  const root = Math.sqrt(B * B - 4.0 * A * C_adj);
  const Kd = (-B - root) / (2.0 * A);

  if (n <= 100) {
    return Kd;
  } else {
    return Kd / Math.pow(n / 100.0, 0.49);
  }
}

// ---------------------------------------------------------------------------
// 5. Gamma Bilinear Table Interpolation & Tests (AD/KS)
// ---------------------------------------------------------------------------

const N_COORDS = [
  5, 6, 7, 8, 9, 10, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 200, 300, 400, 500, 1000
];

const K_COORDS = [
  0.025, 0.05, 0.1, 0.2, 0.5, 1.0, 2.0, 5.0, 10.0, 20.0, 50.0
];

// Helper to count decimal places of a number.
function countDecimals(val: number): number {
  const str = val.toString();
  const dotIdx = str.indexOf('.');
  if (dotIdx === -1) return 0;
  return str.length - dotIdx - 1;
}

// Bilinear interpolation for Gamma critical values.
// V: table array [N_size][K_size][3].
// alphaIdx: 0 = 0.01, 1 = 0.05, 2 = 0.10.
export function interpolateGammaCritVal(
  V: number[][][],
  n: number,
  kStar: number,
  alphaIdx: number
): number {
  // Clamp shape kStar to bounds [0.025, 50.0]
  const k = Math.max(0.025, Math.min(50.0, kStar));
  // Clamp sample size n to bounds [5, 1000]
  const nClamped = Math.max(5, Math.min(1000, n));

  // Find bounding indices for N
  let i1 = 0;
  let i2 = 0;
  if (nClamped <= N_COORDS[0]) {
    i1 = i2 = 0;
  } else if (nClamped >= N_COORDS[N_COORDS.length - 1]) {
    i1 = i2 = N_COORDS.length - 1;
  } else {
    for (let i = 0; i < N_COORDS.length - 1; i++) {
      if (nClamped >= N_COORDS[i] && nClamped <= N_COORDS[i + 1]) {
        i1 = i;
        i2 = i + 1;
        break;
      }
    }
  }

  // Find bounding indices for K
  let j1 = 0;
  let j2 = 0;
  if (k <= K_COORDS[0]) {
    j1 = j2 = 0;
  } else if (k >= K_COORDS[K_COORDS.length - 1]) {
    j1 = j2 = K_COORDS.length - 1;
  } else {
    for (let j = 0; j < K_COORDS.length - 1; j++) {
      if (k >= K_COORDS[j] && k <= K_COORDS[j + 1]) {
        j1 = j;
        j2 = j + 1;
        break;
      }
    }
  }

  const n1 = N_COORDS[i1];
  const n2 = N_COORDS[i2];
  const k1 = K_COORDS[j1];
  const k2 = K_COORDS[j2];

  const Q11 = V[i1][j1][alphaIdx];
  const Q12 = V[i1][j2][alphaIdx];
  const Q21 = V[i2][j1][alphaIdx];
  const Q22 = V[i2][j2][alphaIdx];

  // Determine rounding digits from bounding cell counts (clamped >= 3)
  const cells = [Q11, Q12, Q21, Q22];
  let digits = Math.min(...cells.map(countDecimals));
  if (digits < 3) digits = 3;

  let q = 0;
  if (n1 === n2 && k1 === k2) {
    q = Q11;
  } else if (n1 === n2) {
    // Linear interpolation along K
    q = Q11 + (k - k1) * (Q12 - Q11) / (k2 - k1);
  } else if (k1 === k2) {
    // Linear interpolation along N
    q = Q11 + (nClamped - n1) * (Q21 - Q11) / (n2 - n1);
  } else {
    // Bilinear interpolation
    const r1 = (k2 - k) / (k2 - k1) * Q11 + (k - k1) / (k2 - k1) * Q12;
    const r2 = (k2 - k) / (k2 - k1) * Q21 + (k - k1) / (k2 - k1) * Q22;
    q = (n2 - nClamped) / (n2 - n1) * r1 + (nClamped - n1) / (n2 - n1) * r2;
  }

  return Math.round(q * Math.pow(10, digits)) / Math.pow(10, digits);
}

// Anderson-Darling Gamma Goodness-of-Fit Test.
// Returns { adStat: number, critVal: number, passed: boolean } at alpha = 0.05.
export function gammaADTest(x: number[], shape: number, scale: number): { adStat: number; critVal: number; passed: boolean } {
  const n = x.length;
  const sortedX = [...x].sort((a, b) => a - b);
  const z: number[] = [];
  for (let i = 0; i < n; i++) {
    z.push(gammaCdf(sortedX[i], shape, scale));
  }

  // Anderson-Darling statistic calculation
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const oneBased = i + 1;
    // rev(z)[i] is z[n - 1 - i]
    const val1 = Math.log(z[i]);
    const val2 = Math.log(1.0 - z[n - 1 - i]);
    sum += (2.0 * oneBased - 1.0) * (val1 + val2);
  }
  const adStat = -n - sum / n;

  // Retrieve 5% critical value (index 1 of alpha dimension)
  const critVal = interpolateGammaCritVal(AD_GAMMA_CRITICAL_VALUES, n, shape, 1);
  const passed = adStat <= critVal;

  return { adStat, critVal, passed };
}

// Kolmogorov-Smirnov Gamma Goodness-of-Fit Test.
// Returns { ksStat: number, critVal: number, passed: boolean } at alpha = 0.05.
export function gammaKSTest(x: number[], shape: number, scale: number): { ksStat: number; critVal: number; passed: boolean } {
  const n = x.length;
  const sortedX = [...x].sort((a, b) => a - b);

  let dPlus = 0;
  let dMinus = 0;
  for (let i = 0; i < n; i++) {
    const cdfVal = gammaCdf(sortedX[i], shape, scale);
    const plus = (i + 1) / n - cdfVal;
    const minus = cdfVal - i / n;
    if (plus > dPlus) dPlus = plus;
    if (minus > dMinus) dMinus = minus;
  }
  const ksStat = Math.max(dPlus, dMinus);

  // Retrieve 5% critical value (index 1 of alpha dimension)
  const critVal = interpolateGammaCritVal(KS_GAMMA_CRITICAL_VALUES, n, shape, 1);
  const passed = ksStat <= critVal;

  return { ksStat, critVal, passed };
}

// ---------------------------------------------------------------------------
// 6. Sequential Distribution Selector (prouclDistChoose)
// ---------------------------------------------------------------------------

export type DistributionVerdict = 'Normal' | 'Gamma' | 'Lognormal' | 'Nonparametric';

export interface GofResults {
  verdict: DistributionVerdict;
  normal: {
    swP: number;
    lillieP: number;
    passed: boolean;
  };
  gamma: {
    adStat: number;
    adCrit: number;
    ksStat: number;
    ksCrit: number;
    shape: number;
    scale: number;
    passed: boolean;
  };
  lognormal: {
    swP: number;
    lillieP: number;
    passed: boolean;
  };
}

// Run Normality -> Gamma -> Lognormality GOF tests in sequential order.
// Returns GofResults including the verdict.
export function prouclDistChoose(values: number[]): GofResults {
  const n = values.length;

  // Fallback for n < 5 (no formal GOF possible)
  if (n < 5) {
    return {
      verdict: 'Nonparametric',
      normal: { swP: Number.NaN, lillieP: Number.NaN, passed: false },
      gamma: { adStat: Number.NaN, adCrit: Number.NaN, ksStat: Number.NaN, ksCrit: Number.NaN, shape: Number.NaN, scale: Number.NaN, passed: false },
      lognormal: { swP: Number.NaN, lillieP: Number.NaN, passed: false }
    };
  }

  // 1. Normality Test (alpha = 0.01)
  const normSw = shapiroWilk(values);
  const normLillie = lillieforsTest(values);
  // Passed if either Shapiro-Wilk or Lilliefors p >= 0.01
  const normalPassed = (normSw.p >= 0.01) || (normLillie.p >= 0.01);

  // 2. Gamma parameters and Test (alpha = 0.05)
  // Note: Values must be positive for gamma test. If any value <= 0, gamma fails.
  let gammaPassed = false;
  let ad = { adStat: Number.NaN, critVal: Number.NaN, passed: false };
  let ks = { ksStat: Number.NaN, critVal: Number.NaN, passed: false };
  let shape = Number.NaN;
  let scale = Number.NaN;

  const allPositive = values.every((v) => v > 0);
  if (allPositive) {
    try {
      const mle = estimateGammaMle(values);
      shape = mle.shape;
      scale = mle.scale;
      ad = gammaADTest(values, shape, scale);
      ks = gammaKSTest(values, shape, scale);
      gammaPassed = ad.passed || ks.passed;
    } catch {
      // If parameter estimation fails, gamma fails.
    }
  }

  // 3. Lognormality Test (alpha = 0.10)
  // Values must be positive for log-transform.
  let lognormalPassed = false;
  let lnormSw = { w: Number.NaN, p: Number.NaN };
  let lnormLillie = { d: Number.NaN, p: Number.NaN };

  if (allPositive) {
    const logValues = values.map((v) => Math.log(v));
    lnormSw = shapiroWilk(logValues);
    lnormLillie = lillieforsTest(logValues);
    lognormalPassed = (lnormSw.p >= 0.10) || (lnormLillie.p >= 0.10);
  }

  // 4. Sequential Decision Ladder
  let verdict: DistributionVerdict = 'Nonparametric';
  if (normalPassed) {
    verdict = 'Normal';
  } else if (gammaPassed) {
    verdict = 'Gamma';
  } else if (lognormalPassed) {
    verdict = 'Lognormal';
  }

  return {
    verdict,
    normal: {
      swP: normSw.p,
      lillieP: normLillie.p,
      passed: normalPassed
    },
    gamma: {
      adStat: ad.adStat,
      adCrit: ad.critVal,
      ksStat: ks.ksStat,
      ksCrit: ks.critVal,
      shape,
      scale,
      passed: gammaPassed
    },
    lognormal: {
      swP: lnormSw.p,
      lillieP: lnormLillie.p,
      passed: lognormalPassed
    }
  };
}
