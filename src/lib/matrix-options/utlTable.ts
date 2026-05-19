// One-sided 95/95 tolerance factor (K_{95/95}) lookup table.
// Values from NIST/SEMATECH e-Handbook of Statistical Methods,
// Section 7.2.6.3 -- Tolerance Intervals for a Normal Distribution.
// See design doc section 3 for context.
// Plain ASCII only.

interface KTableRow {
  n: number;
  K: number;
}

// Sorted ascending by n so the interpolation helper can scan in order.
const K_TABLE: readonly KTableRow[] = [
  { n: 5, K: 4.166 },
  { n: 10, K: 2.911 },
  { n: 20, K: 2.396 },
  { n: 30, K: 2.220 },
  { n: 50, K: 2.065 },
  { n: 100, K: 1.927 },
] as const;

export const K_95_95_TABLE = K_TABLE;

/**
 * Linear interpolation of K_{95/95} for a given sample size n.
 *
 * For n at or above the smallest table entry the function returns the
 * interpolated value between the bracketing table rows. For n below the
 * smallest tabulated value (n = 5) the function clamps to the n = 5 row
 * and surfaces a warning via the second tuple element so the caller can
 * present a UI message. For n above the largest tabulated value
 * (n = 100) the function clamps to the n = 100 row -- the K factor
 * decays slowly above 100 and the design doc accepts this clamp for
 * screening per section 3.
 *
 * For regulatory submissions, the assessor should compute K exactly from
 * the noncentral t-distribution rather than relying on this table; this
 * helper is a screening-level convenience only.
 */
export function lookupK9595(n: number): { K: number; warning: string | null } {
  if (!Number.isFinite(n) || n < 2) {
    return {
      K: K_TABLE[0].K,
      warning: 'n must be an integer >= 2; clamped to n = 5 table row.',
    };
  }

  if (n <= K_TABLE[0].n) {
    return {
      K: K_TABLE[0].K,
      warning:
        n < K_TABLE[0].n
          ? `n = ${n} is below tabulated minimum (5); clamped K = ${K_TABLE[0].K}.`
          : null,
    };
  }

  if (n >= K_TABLE[K_TABLE.length - 1].n) {
    return {
      K: K_TABLE[K_TABLE.length - 1].K,
      warning:
        n > K_TABLE[K_TABLE.length - 1].n
          ? `n = ${n} exceeds tabulated maximum (100); clamped K = ${K_TABLE[K_TABLE.length - 1].K}.`
          : null,
    };
  }

  for (let i = 0; i < K_TABLE.length - 1; i += 1) {
    const lo = K_TABLE[i];
    const hi = K_TABLE[i + 1];
    if (n >= lo.n && n <= hi.n) {
      const frac = (n - lo.n) / (hi.n - lo.n);
      const K = lo.K + frac * (hi.K - lo.K);
      return { K, warning: null };
    }
  }

  // Unreachable given the bracketing logic above; defensive fallback.
  return {
    K: K_TABLE[K_TABLE.length - 1].K,
    warning: 'Unexpected n lookup; defensive fallback to largest table row.',
  };
}
