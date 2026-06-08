// Kaplan-Meier (KM) product-limit estimation statistics and UCLs.
// Traced to: docs/PROUCL_V52_EXTRACTION_PACKET_2026_06_06.md Section D.1
// Plain ASCII only (code point <= 127).

import { tCritical } from './inverse-t';

export interface KmStatsInput {
  value: number;
  censored: boolean;
}

export interface KmResult {
  mean: number;
  variance: number;
  sd: number; // Direct KM SD (Equation 4-3)
  se: number; // KM SE of the Mean (Equation 4-2)
}

// Computes Kaplan-Meier Mean, Variance, SD, and SE of the Mean.
// Returns null if there are no detected values or n < 2.
export function computeKmStats(data: KmStatsInput[]): KmResult | null {
  const n = data.length;
  if (n < 2) return null;

  // Extract detected values
  const detects = data.filter((d) => !d.censored).map((d) => d.value);
  const k = data.filter((d) => d.censored).length; // Number of NDs
  const nMinusK = n - k; // Number of detects

  if (nMinusK === 0) return null;

  // Find distinct detected values and sort them in ascending order
  const distinctDetects = Array.from(new Set(detects)).sort((a, b) => a - b);
  const nPrime = distinctDetects.length;

  // Compute F_tilde(x'_j) = prod_{i=j+1}^{n'} (n_i - m_i) / n_i
  const fTilde: Record<number, number> = {};
  for (let j = 0; j < nPrime; j++) {
    const xj = distinctDetects[j];
    let prod = 1.0;
    for (let i = j + 1; i < nPrime; i++) {
      const xi = distinctDetects[i];
      const mi = data.filter((d) => !d.censored && d.value === xi).length;
      const ni = data.filter((d) => d.value <= xi).length;
      if (ni > 0) {
        prod *= (ni - mi) / ni;
      }
    }
    fTilde[xj] = prod;
  }

  // KM Mean = sum_{j=1}^{n'} x'_j * [F_tilde(x'_j) - F_tilde(x'_{j-1})]
  // where F_tilde(x'_0) = 0
  let kmMean = 0.0;
  let prevF = 0.0;
  for (let j = 0; j < nPrime; j++) {
    const xj = distinctDetects[j];
    const currF = fTilde[xj];
    kmMean += xj * (currF - prevF);
    prevF = currF;
  }

  // KM Mean of Squares: mu(x^2) = sum_{j=1}^{n'} (x'_j)^2 * [F_tilde(x'_j) - F_tilde(x'_{j-1})]
  let kmMeanSq = 0.0;
  prevF = 0.0;
  for (let j = 0; j < nPrime; j++) {
    const xj = distinctDetects[j];
    const currF = fTilde[xj];
    kmMeanSq += xj * xj * (currF - prevF);
    prevF = currF;
  }

  // KM Variance = mu(x^2) - mu(x)^2
  const kmVar = Math.max(0.0, kmMeanSq - kmMean * kmMean);
  const kmSd = Math.sqrt(kmVar);

  // KM Standard Error (SE) of the Mean:
  // If detects (n - k) <= 1, SE of the mean is not defined (ddof-like division by n - k - 1)
  let kmSe = 0.0;
  if (nMinusK > 1 && nPrime > 1) {
    // a_i = sum_{j=1}^i (x'_{j+1} - x'_j) * F_tilde(x'_j)
    const a: Record<number, number> = {};
    let sumA = 0.0;
    for (let i = 0; i < nPrime - 1; i++) {
      const xj = distinctDetects[i];
      const xj1 = distinctDetects[i + 1];
      sumA += (xj1 - xj) * fTilde[xj];
      a[i] = sumA;
    }

    // sum term: a_i^2 * m_{i+1} / (n_{i+1} * (n_{i+1} - m_{i+1}))
    let sumTerm = 0.0;
    for (let i = 0; i < nPrime - 1; i++) {
      const xi1 = distinctDetects[i + 1];
      const mi1 = data.filter((d) => !d.censored && d.value === xi1).length;
      const ni1 = data.filter((d) => d.value <= xi1).length;
      if (ni1 > mi1 && ni1 > 0) {
        sumTerm += (a[i] * a[i] * mi1) / (ni1 * (ni1 - mi1));
      }
    }

    const se2 = (nMinusK / (nMinusK - 1)) * sumTerm;
    kmSe = Math.sqrt(Math.max(0.0, se2));
  }

  return {
    mean: kmMean,
    variance: kmVar,
    sd: kmSd,
    se: kmSe,
  };
}

// KM-t UCL: mean + t(0.95, n-1) * SE
export function kmTUcl(km: KmResult, n: number): number | null {
  if (n < 2 || km.se < 0 || !Number.isFinite(km.se)) return null;
  const tVal = tCritical(0.95, n - 1);
  if (!Number.isFinite(tVal)) return null;
  return km.mean + tVal * km.se;
}

// KM-z (Normal) UCL: mean + z(0.95) * SE
export function kmZUcl(km: KmResult): number | null {
  if (km.se < 0 || !Number.isFinite(km.se)) return null;
  const zVal = 1.6448536269514722; // studentTInv(0.95, Infinity)
  return km.mean + zVal * km.se;
}

// KM-Chebyshev UCL: mean + sqrt(1/alpha - 1) * SE
export function kmChebyshevUcl(km: KmResult, level: number): number | null {
  if (km.se < 0 || !Number.isFinite(km.se)) return null;
  const kFactor = Math.sqrt(1.0 / (1.0 - level) - 1.0);
  return km.mean + kFactor * km.se;
}
