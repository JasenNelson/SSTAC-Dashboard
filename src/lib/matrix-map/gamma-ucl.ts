// Approximate and Adjusted Gamma UCLs.
// Traced to: docs/PROUCL_V52_EXTRACTION_PACKET_2026_06_06.md Sections C & G.
// Plain ASCII only (code point <= 127).

import { regularizedLowerIncompleteGamma } from './gof';
import { lnGamma } from './inverse-t';


// Inverse regularized lower incomplete gamma: solve P(a, y) = p for y.
export function inverseRegularizedLowerIncompleteGamma(a: number, p: number): number {
  if (p <= 0) return 0;
  if (p >= 1) return Infinity;

  const MAXIT = 100;
  const EPS = 1e-12;

  let lo = 0;
  let hi = a + 8 * Math.sqrt(a) + 1;
  while (regularizedLowerIncompleteGamma(a, hi) < p) {
    hi *= 2;
  }

  let x = a;
  if (x <= lo || x >= hi) {
    x = 0.5 * (lo + hi);
  }

  for (let i = 0; i < MAXIT; i++) {
    const f = regularizedLowerIncompleteGamma(a, x) - p;
    if (Math.abs(f) < EPS) return x;

    if (f < 0) {
      lo = x;
    } else {
      hi = x;
    }

    const df = Math.exp((a - 1) * Math.log(x) - x - lnGamma(a));
    if (df > 0 && Number.isFinite(df)) {
      const step = f / df;
      const xNew = x - step;
      if (xNew > lo && xNew < hi) {
        x = xNew;
        if (Math.abs(step) < EPS * x) return x;
        continue;
      }
    }

    x = 0.5 * (lo + hi);
    if (Math.abs(hi - lo) < EPS) return x;
  }
  return x;
}

// Inverse Chi-Square CDF: find x such that P(Chi2(df) <= x) = p
export function chiSquareInverse(p: number, df: number): number {
  return 2.0 * inverseRegularizedLowerIncompleteGamma(df / 2.0, p);
}

// Table 2-2. Adjusted Level of Significance, beta for alpha = 0.05.
// Traced to page 92, Table 2-2.
// Interpolated linearly over 1/n.
export function getBetaGriceBain(n: number): number {
  const nClamped = Math.max(5, n); // Table starts at n = 5
  
  // Points: (1/n, beta)
  // n = 5     => 1/5 = 0.20   => beta = 0.0086
  // n = 10    => 1/10 = 0.10  => beta = 0.0267
  // n = 20    => 1/20 = 0.05  => beta = 0.0380
  // n = 40    => 1/40 = 0.025 => beta = 0.0440
  // n = inf   => 0            => beta = 0.0500
  
  const u = 1.0 / nClamped;
  
  if (u >= 0.10) {
    // Interpolate between n = 5 and n = 10
    const u1 = 0.20;
    const u2 = 0.10;
    const b1 = 0.0086;
    const b2 = 0.0267;
    return b1 + ((u - u1) / (u2 - u1)) * (b2 - b1);
  } else if (u >= 0.05) {
    // Interpolate between n = 10 and n = 20
    const u1 = 0.10;
    const u2 = 0.05;
    const b1 = 0.0267;
    const b2 = 0.0380;
    return b1 + ((u - u1) / (u2 - u1)) * (b2 - b1);
  } else if (u >= 0.025) {
    // Interpolate between n = 20 and n = 40
    const u1 = 0.05;
    const u2 = 0.025;
    const b1 = 0.0380;
    const b2 = 0.0440;
    return b1 + ((u - u1) / (u2 - u1)) * (b2 - b1);
  } else {
    // Interpolate between n = 40 and n = infinity
    const u1 = 0.025;
    const u2 = 0.0;
    const b1 = 0.0440;
    const b2 = 0.0500;
    return b1 + ((u - u1) / (u2 - u1)) * (b2 - b1);
  }
}

// Bias-corrected shape parameter (Equation 2-29)
export function getKStar(kHat: number, n: number): number {
  if (n <= 3) return kHat; // Avoid division by <= 0
  return ((n - 3) * kHat) / n + 2.0 / (3.0 * n);
}

// Compute 95% Approximate Gamma UCL: (2 * n * kStar * mean) / Chi2_0.05(2 * n * kStar)
export function computeApproximateGammaUcl(meanVal: number, kStar: number, n: number): number | null {
  if (meanVal <= 0 || kStar <= 0 || n <= 0) return null;
  const df = 2.0 * n * kStar;
  const denom = chiSquareInverse(0.05, df);
  if (denom <= 0) return null;
  return (2.0 * n * kStar * meanVal) / denom;
}

// Compute 95% Adjusted Gamma UCL: (2 * n * kStar * mean) / Chi2_beta(2 * n * kStar)
export function computeAdjustedGammaUcl(meanVal: number, kStar: number, n: number): number | null {
  if (meanVal <= 0 || kStar <= 0 || n <= 0) return null;
  const df = 2.0 * n * kStar;
  const beta = getBetaGriceBain(n);
  const denom = chiSquareInverse(beta, df);
  if (denom <= 0) return null;
  return (2.0 * n * kStar * meanVal) / denom;
}
