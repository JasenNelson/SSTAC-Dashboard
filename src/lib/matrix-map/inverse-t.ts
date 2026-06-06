// Inverse Student's-t CDF for UCL95 computation.
//
// Chosen over jStat / simple-statistics so that the implementation is:
//   - Fully auditable for the bit-for-bit ProUCL v5.2 parity bar (Phase 2/3).
//   - Zero external runtime dependencies (worker-portable for Phase 2).
//   - Typed TypeScript with every algorithmic source cited.
//
// Algorithm provenance:
//   lnGamma   -- Lanczos approximation, g=7 (9-coefficient, c[0]..c[g+1]), from
//                W.H. Press et al., Numerical Recipes in C, 2nd ed. (NR),
//                section 6.1.  Coefficients from that section.
//   betacf    -- Continued-fraction evaluation for the regularised incomplete
//                beta function, NR section 6.4, `betacf`.
//   incompleteBeta -- NR section 6.4, `betai` with symmetry-swap optimisation.
//   inverseIncompleteBeta -- bisection with Newton-Raphson acceleration;
//                bisection chosen as the outer loop for robustness since the
//                initial guess approximations for small (a,b) are brittle.
//   studentTInv  -- expression: t-inv via incomplete-beta inverse;
//                derivation in NR section 6.4 (relation between t-dist and
//                incomplete beta).
//
// VERIFY: One-sided t(0.95, df) convention vs ProUCL v5.2 Tech Guide.
//   The UCL95 formula in stats.ts uses tCritical(0.95, n-1), i.e. the 95th
//   percentile of the one-sided t-distribution (equivalent to the 90th
//   percentile of the two-sided distribution).  Confirm this matches ProUCL's
//   UCL95 formula before finalising Phase 2 parity gate.  ProUCL documentation
//   may use t(0.95, df) for one-sided or t(0.975, df) for two-sided 95% --
//   these are DIFFERENT values; the choice here is one-sided t(0.95, df).
//
// Plain ASCII only (code point <= 127).

const LN_GAMMA_G = 7;
const LN_GAMMA_C: readonly number[] = [
  0.99999999999980993,
  676.5203681218851,
  -1259.1392167224028,
  771.32342877765313,
  -176.61502916214059,
  12.507343278686905,
  -0.13857109526572012,
  9.9843695780195716e-6,
  1.5056327351493116e-7,
];

// Natural log of the gamma function for real x > 0.
// Uses the reflection formula for x < 0.5 to map to the Lanczos region.
export function lnGamma(x: number): number {
  if (x < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - lnGamma(1 - x);
  }
  const z = x - 1;
  let a = LN_GAMMA_C[0];
  for (let i = 1; i <= LN_GAMMA_G + 1; i++) {
    a += LN_GAMMA_C[i] / (z + i);
  }
  const t = z + LN_GAMMA_G + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a);
}

// Continued-fraction evaluation of the regularised incomplete beta function
// I_x(a, b) for x in (0,1).  Uses Lentz's modified algorithm (NR betacf).
// Caller is responsible for ensuring 0 < x < 1 and that the slower-converging
// branch has already been handled via the symmetry swap in incompleteBeta.
function betacf(a: number, b: number, x: number): number {
  const MAXIT = 200;
  const EPS = 3.0e-7;
  const FPMIN = 1.0e-30;

  const qab = a + b;
  const qap = a + 1.0;
  const qam = a - 1.0;
  let c = 1.0;
  let d = 1.0 - qab * x / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1.0 / d;
  let h = d;

  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    // Even step.
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1.0 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1.0 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1.0 / d;
    h *= d * c;
    // Odd step.
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1.0 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1.0 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1.0 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1.0) <= EPS) break;
  }
  return h;
}

// Regularised incomplete beta function I_x(a, b) in [0, 1].
// Uses NR symmetry swap: when x > (a+1)/(a+b+2) evaluate via the complement
// identity I_x(a,b) = 1 - I_{1-x}(b,a) for faster convergence.
export function incompleteBeta(a: number, b: number, x: number): number {
  if (x < 0 || x > 1) return Number.NaN;
  if (x === 0) return 0;
  if (x === 1) return 1;

  const lbeta = lnGamma(a + b) - lnGamma(a) - lnGamma(b);
  const bt = Math.exp(lbeta + a * Math.log(x) + b * Math.log(1 - x));

  // Symmetry swap for convergence (NR condition).
  if (x < (a + 1) / (a + b + 2)) {
    return bt * betacf(a, b, x) / a;
  }
  return 1 - bt * betacf(b, a, 1 - x) / b;
}

// Inverse regularised incomplete beta function: find x in (0,1) such that
// incompleteBeta(a, b, x) = p.
//
// Uses bisection as the outer loop (robust for all valid (a,b,p)) with
// Newton-Raphson acceleration once the bracket is tight.  The derivative is:
//   d/dx I_x(a,b) = x^(a-1) * (1-x)^(b-1) / B(a,b).
export function inverseIncompleteBeta(a: number, b: number, p: number): number {
  if (p <= 0) return 0;
  if (p >= 1) return 1;

  const MAXIT = 500;
  const EPS = 1e-10;
  const lbeta = lnGamma(a + b) - lnGamma(a) - lnGamma(b);

  // Initial bracket: [0, 1]
  let lo = 0;
  let hi = 1;
  // Initial guess: mean of beta distribution (a/(a+b)).
  let x = a / (a + b);

  for (let i = 0; i < MAXIT; i++) {
    // Evaluate and check convergence.
    const f = incompleteBeta(a, b, x) - p;
    if (Math.abs(f) < EPS) return x;

    // Update bracket.
    if (f < 0) lo = x; else hi = x;

    // Try a Newton step.
    const df = Math.exp((a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x) - lbeta);
    if (df > 0 && Number.isFinite(df)) {
      const xNew = x - f / df;
      if (xNew > lo && xNew < hi) {
        x = xNew;
        // If Newton converged, we are done.
        if (Math.abs(f / df) < EPS * x) return x;
        continue;
      }
    }

    // Newton failed or stepped out of bracket -- bisect.
    x = 0.5 * (lo + hi);
    if (Math.abs(hi - lo) < EPS) return x;
  }
  return x;
}

// Quantile of the Student's-t distribution at cumulative probability p
// with df degrees of freedom (one-sided).
//
// Uses the relation between the t-distribution and the regularised incomplete
// beta function (NR section 6.4):
//   The two-tailed probability 2*min(p,1-p) satisfies I_x(df/2, 1/2) = 2*min(p,1-p)
//   where x = df/(df + t^2).
//   Then t = sqrt(df * (1-x) / x).
//   For p > 0.5: use the upper tail (symmetric distribution).
//
// VERIFY: One-sided vs two-sided convention -- see module-level VERIFY comment.
export function studentTInv(p: number, df: number): number {
  if (df <= 0 || !Number.isFinite(df)) return Number.NaN;
  // Boundary behavior (deliberate): the quantile limits are -Infinity at
  // p = 0 and +Infinity at p = 1. In float64 every representable p < 1
  // satisfies 1 - p >= 2^-53 > 0, so the interior path below cannot
  // underflow to the boundary -- +/-Infinity is returned ONLY via these
  // explicit guards (a literal like 1 - 1e-20 already rounds to 1.0 at the
  // call site). Extreme-tail accuracy degrades beyond the verified
  // confidence range (0.5, 0.999]; production callers use 0.95-0.99.
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p === 0.5) return 0;

  // Map one-sided p to the two-tailed probability that the beta inverse uses.
  // For one-sided p > 0.5, the two-tailed level is 2*(1-p).
  // For one-sided p < 0.5, the two-tailed level is 2*p, and we negate the result.
  const p2 = p > 0.5 ? 2 * (1 - p) : 2 * p;
  // Solve I_x(df/2, 1/2) = p2 for x, then t = sqrt(df * (1-x) / x).
  const x = inverseIncompleteBeta(df / 2, 0.5, p2);
  if (!Number.isFinite(x) || x <= 0 || x >= 1) return Number.NaN;
  const t = Math.sqrt(df * (1 - x) / x);
  return p > 0.5 ? t : -t;
}

// Convenience wrapper: critical value for a one-sided confidence level.
// tCritical(0.95, df) is the value t such that P(T <= t) = 0.95 for T ~ t(df).
//
// VERIFY: ProUCL v5.2 uses one-sided t(0.95, df) for the Student's-t UCL95
// formula.  Confirm before finalising parity gate (Phase 2).
export function tCritical(confidence: number, df: number): number {
  return studentTInv(confidence, df);
}
