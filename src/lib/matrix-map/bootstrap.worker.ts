// Web Worker for Bootstrap UCL calculations (percentile, BCA, and bootstrap-t).
// Traced to: docs/PROUCL_V52_EXTRACTION_PACKET_2026_06_06.md Section F & G.
// Plain ASCII only.

// LCG random number generator for determinism across environments
class LcgRng {
  private seed: number;
  constructor(seed: number = 123456789) {
    this.seed = seed;
  }
  next(): number {
    this.seed = (this.seed * 1664525 + 1013904223) % 4294967296;
    return this.seed / 4294967296;
  }
}

// Standard normal CDF (Abramowitz & Stegun 7.1.26 error function approximation)
function normalCdf(x: number): number {
  const z = x / Math.sqrt(2.0);
  const sign = z < 0 ? -1 : 1;
  const absZ = Math.abs(z);
  const p = 0.3275911;
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const t = 1.0 / (1.0 + p * absZ);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absZ * absZ);
  return 0.5 * (1.0 + sign * y);
}

// Probit function (inverse standard normal CDF) using Beasley-Springer-Moro rational approximation.
function normalInverse(p: number): number {
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

// Compute bootstrap calculations synchronously
export function performBootstrap(
  x: number[],
  B: number = 2000,
  seed: number = 123456789
): { percentile95: number; bca95: number; bootstrapT95: number } {
  const n = x.length;
  if (n < 2) {
    return { percentile95: Number.NaN, bca95: Number.NaN, bootstrapT95: Number.NaN };
  }

  const rng = new LcgRng(seed);
  const xbar = x.reduce((a, b) => a + b, 0) / n;

  let sumSq = 0;
  for (const val of x) sumSq += (val - xbar) ** 2;
  const s = Math.sqrt(sumSq / (n - 1));

  // Compute jackknife means for BCA acceleration parameter a
  const jackMeans: number[] = [];
  for (let i = 0; i < n; i++) {
    jackMeans.push((n * xbar - x[i]) / (n - 1));
  }
  const meanJack = jackMeans.reduce((a, b) => a + b, 0) / n;
  
  let accNum = 0;
  let accDen = 0;
  for (let i = 0; i < n; i++) {
    const diff = meanJack - jackMeans[i];
    accNum += diff ** 3;
    accDen += diff ** 2;
  }
  
  let acceleration = 0;
  if (accDen > 0) {
    acceleration = accNum / (6.0 * Math.pow(accDen, 1.5));
  }

  const resampleMeans: number[] = [];
  const tStar: number[] = [];

  for (let b = 0; b < B; b++) {
    const resample: number[] = [];
    let rSum = 0;
    for (let i = 0; i < n; i++) {
      const idx = Math.floor(rng.next() * n);
      const val = x[idx];
      resample.push(val);
      rSum += val;
    }
    const rMean = rSum / n;
    resampleMeans.push(rMean);

    // Bootstrap-t calculation: compute SD of the resample
    let rSumSq = 0;
    for (let i = 0; i < n; i++) {
      rSumSq += (resample[i] - rMean) ** 2;
    }
    const rSD = Math.sqrt(rSumSq / (n - 1));
    const denom = rSD === 0 ? 1e-15 : rSD; // avoid division by zero
    const tVal = (rMean - xbar) / (denom / Math.sqrt(n));
    tStar.push(tVal);
  }

  // Sort resample means for Percentile and BCA
  resampleMeans.sort((a, b) => a - b);
  // Sort t values for bootstrap-t
  tStar.sort((a, b) => a - b);

  // Percentile via linear interpolation (type-7, same as R and NumPy default)
  function percentile(sorted: number[], q: number): number {
    const nLength = sorted.length;
    if (nLength === 0) return Number.NaN;
    if (nLength === 1) return sorted[0];
    const h = (nLength - 1) * q;
    const lo = Math.floor(h);
    const hi = Math.ceil(h);
    if (lo === hi) return sorted[lo];
    return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo]);
  }

  // 1. Percentile UCL (95th percentile)
  const percentile95 = percentile(resampleMeans, 0.95);

  // 2. BCA UCL (Adjusted percentile)
  let countLess = 0;
  for (let b = 0; b < B; b++) {
    if (resampleMeans[b] < xbar) countLess++;
  }
  const p0 = countLess / B;
  // Clamp p0 to avoid infinite z0
  const p0Clamped = Math.max(1.0 / (2.0 * B), Math.min(1.0 - 1.0 / (2.0 * B), p0));
  const z0 = normalInverse(p0Clamped);

  const zAlpha = normalInverse(0.95); // 1.64485
  const bcaDenom = 1.0 - acceleration * (z0 + zAlpha);
  let pAdj = 0.95;
  if (Math.abs(bcaDenom) > 1e-15) {
    const val = z0 + (z0 + zAlpha) / bcaDenom;
    pAdj = normalCdf(val);
  }
  const bca95 = percentile(resampleMeans, pAdj);

  // 3. Bootstrap-t UCL: mean - t*_(alpha) * s / sqrt(n)
  // One-sided alpha = 0.05 corresponds to 5th percentile of tStar
  const tAlphaStar = percentile(tStar, 0.05);
  const bootstrapT95 = xbar - tAlphaStar * (s / Math.sqrt(n));

  return { percentile95, bca95, bootstrapT95 };
}

// Handle web worker message posting if running in the browser worker context
if (typeof window === 'undefined' && typeof self !== 'undefined' && typeof postMessage !== 'undefined') {
  self.onmessage = (event) => {
    try {
      const { values, B, seed } = event.data;
      const results = performBootstrap(values, B, seed);
      postMessage({ status: 'success', results });
    } catch (err) {
      postMessage({ status: 'error', error: err instanceof Error ? err.message : String(err) });
    }
  };
}
