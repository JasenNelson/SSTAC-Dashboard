// Land's H-UCL statistical solver.
// Derived cleanly from first-principles of probability theory and the original publications:
//   * Land, C. E. (1971), "Confidence Intervals for Linear Functions of the Normal Mean and Variance," Annals of Mathematical Statistics, 42, 1187-1205.
//   * Land, C. E. (1975), "Tables of Individual Likelihood Ratio Test Critical Values for Lognormal Means."
// Plain ASCII only (code point <= 127).

// ---------------------------------------------------------------------------
// Derivation & Mathematical Provenance:
//
// Let Y = ln(X) be normally distributed with mean mu and variance sigma^2.
// We want to construct a one-sided (1 - alpha) upper confidence limit for the lognormal mean:
//   E[X] = exp(mu + 0.5 * sigma^2).
// This is equivalent to finding a confidence limit for the parameter:
//   theta = mu + 0.5 * sigma^2.
//
// Land (1971, 1975) showed that the uniformly most accurate one-sided confidence interval
// is based on the conditional distribution of a pivotal statistic T given the sample variance S^2.
// The density of T is given by:
//   g(t | nu, zeta) = C * (1 + t^2 / nu) ^ (-(nu + 1)/2) * exp( (nu + 1) * zeta * t / sqrt(nu + t^2) )
// where:
//   nu = n - 1 (degrees of freedom)
//   zeta = conditional parameter
//   C = normalization constant
//
// By applying the trigonometric substitution:
//   t = sqrt(nu) * tan(theta)
// where theta ranges from -pi/2 to pi/2, the differential is:
//   dt = sqrt(nu) * sec^2(theta) dtheta = (sqrt(nu) / cos^2(theta)) dtheta
//
// Substituting t and dt into the density:
//   1 + t^2 / nu = sec^2(theta) = 1 / cos^2(theta)
//   (1 + t^2 / nu) ^ (-(nu + 1)/2) = cos^(nu + 1)(theta)
//   t / sqrt(nu + t^2) = sin(theta)
//
// The transformed density h(theta) dtheta = g(t(theta)) dt is:
//   h(theta) dtheta = C' * cos^(nu + 1)(theta) * exp( (nu + 1) * zeta * sin(theta) ) * (sqrt(nu) / cos^2(theta)) dtheta
//                   = C'' * cos^(nu - 1)(theta) * exp( (nu + 1) * zeta * sin(theta) ) dtheta
//
// To find the H statistic, we solve for the value m = H * s / sqrt(nu) such that:
//   P(T <= Tm) = alpha (typically alpha = 0.05 for 95% UCL)
// where Tm = sqrt(nu + 1) * (-0.5 * s^2 - m) / s
// and zeta_m = -s * sqrt(nu + Tm^2) / (2 * sqrt(nu + 1))
//
// Using the polar substitution, the cumulative probability P(T <= Tm) becomes the ratio of integrals:
//   I(theta_limit) / I(pi/2)
// where:
//   theta_limit = arctan(Tm / sqrt(nu))
//   I(limit) = integral from -pi/2 to limit of cos^(nu - 1)(theta) * exp( (nu + 1) * zeta_m * sin(theta) ) dtheta
//
// We use Brent's root-finding method to find the value of m where this probability ratio equals alpha.
// ---------------------------------------------------------------------------

// 1. Simpson's Rule Integrator
function integrateSimpson(
  f: (x: number, ...args: number[]) => number,
  a: number,
  b: number,
  nSteps: number,
  args: number[]
): number {
  const steps = nSteps % 2 !== 0 ? nSteps + 1 : nSteps; // must be even
  const h = (b - a) / steps;
  let sum = f(a, ...args) + f(b, ...args);

  for (let i = 1; i < steps; i++) {
    const x = a + i * h;
    sum += (i % 2 === 0 ? 2 : 4) * f(x, ...args);
  }
  return sum * (h / 3.0);
}

// 2. Analytical Peak Finder for integrand normalization to prevent overflow/underflow
function findPeakExponent(nu: number, zeta: number): number {
  if (Math.abs(zeta) < 1e-12) {
    return 0.0; // peak is at theta = 0, where cos(0)=1, sin(0)=0
  }
  const A = (nu + 1) * zeta;
  const B = nu - 1;
  const D = Math.sqrt(B * B + 4.0 * A * A);
  const y = A > 0 ? (-B + D) / (2.0 * A) : (-B - D) / (2.0 * A);
  const yClamped = Math.max(-1.0, Math.min(1.0, y));
  const cosVal = Math.sqrt(1.0 - yClamped * yClamped);
  if (cosVal <= 1e-15) {
    return (nu + 1) * zeta * yClamped;
  }
  return (nu - 1) * Math.log(cosVal) + (nu + 1) * zeta * yClamped;
}

// 3. Polar density function (with peak normalization)
function polarDensity(theta: number, nu: number, zeta: number, maxVal: number): number {
  const cosVal = Math.cos(theta);
  if (cosVal <= 1e-15) return 0.0;
  const exponent = (nu - 1) * Math.log(cosVal) + (nu + 1) * zeta * Math.sin(theta);
  return Math.exp(exponent - maxVal);
}

// 4. Objective function for root finding: cumulative probability ratio minus alpha
function landObjective(m: number, s: number, nu: number, alpha: number, nSteps: number): number {
  const Tm = (Math.sqrt(nu + 1) * (-0.5 * s * s - m)) / s;
  const zeta_m = (-s * Math.sqrt(nu + Tm * Tm)) / (2.0 * Math.sqrt(nu + 1));
  const limit = Math.atan(Tm / Math.sqrt(nu));

  // Integrate normalized density to avoid float64 overflow/underflow
  const maxVal = findPeakExponent(nu, zeta_m);
  const num = integrateSimpson(polarDensity, -Math.PI / 2.0, limit, nSteps, [nu, zeta_m, maxVal]);
  const den = integrateSimpson(polarDensity, -Math.PI / 2.0, Math.PI / 2.0, nSteps, [nu, zeta_m, maxVal]);

  if (den === 0.0) return 999.0;
  return num / den - alpha;
}

// 5. Brent's Root Finding Algorithm
function brentRootFind(
  f: (x: number, ...args: number[]) => number,
  ax: number,
  bx: number,
  tol: number,
  maxIter: number,
  args: number[]
): number {
  let a = ax;
  let b = bx;
  let fa = f(a, ...args);
  let fb = f(b, ...args);

  if (Number.isNaN(fa) || Number.isNaN(fb) || fa * fb > 0) {
    // try to expand bracket
    for (let step = 1; step <= 10; step++) {
      a = ax - step * 2.0;
      b = bx + step * 2.0;
      fa = f(a, ...args);
      fb = f(b, ...args);
      if (!Number.isNaN(fa) && !Number.isNaN(fb) && fa * fb <= 0) break;
    }
    if (Number.isNaN(fa) || Number.isNaN(fb) || fa * fb > 0) {
      return Number.NaN;
    }
  }

  let c = a;
  let fc = fa;
  let d = b - a;
  let e = d;

  for (let iter = 0; iter < maxIter; iter++) {
    if (Math.abs(fc) < Math.abs(fb)) {
      a = b; b = c; c = a;
      fa = fb; fb = fc; fc = fa;
    }

    const tol1 = 2.0 * 1e-15 * Math.abs(b) + 0.5 * tol;
    const xm = 0.5 * (c - b);

    if (Math.abs(xm) <= tol1 || fb === 0.0) {
      return b;
    }

    if (Math.abs(e) >= tol1 && Math.abs(fa) > Math.abs(fb)) {
      const s = fb / fa;
      let p: number;
      let q: number;
      if (a === c) {
        p = 2.0 * xm * s;
        q = 1.0 - s;
      } else {
        const r = fa / fc;
        const t = fb / fc;
        p = s * (2.0 * xm * r * (r - t) - (b - a) * (t - 1.0));
        q = (r - 1.0) * (t - 1.0) * (s - 1.0);
      }
      if (p > 0) q = -q;
      p = Math.abs(p);
      const min1 = 3.0 * xm * q - Math.abs(tol1 * q);
      const min2 = Math.abs(e * q);
      if (2.0 * p < (min1 < min2 ? min1 : min2)) {
        e = d;
        d = p / q;
      } else {
        d = xm;
        e = d;
      }
    } else {
      d = xm;
      e = d;
    }

    a = b;
    fa = fb;
    if (Math.abs(d) > tol1) {
      b += d;
    } else {
      b += xm > 0 ? tol1 : -tol1;
    }
    fb = f(b, ...args);
    if ((fb > 0 && fc > 0) || (fb < 0 && fc < 0)) {
      c = a;
      fc = fa;
      d = b - a;
      e = d;
    }
  }
  return b;
}

// Solves for H statistic on-the-fly via numerical integration.
export function solveH(s: number, n: number, confLevel = 0.95): number | null {
  if (n < 3 || s <= 0) return null;
  const nu = n - 1;
  const alpha = 1.0 - confLevel;

  // Approximate starting value of Tm and m
  const startTm = (-Math.sqrt(nu + 1) * s) / 2.0;
  const startM = -0.5 * s * s - (s * startTm) / Math.sqrt(nu + 1);

  // Solve for m using Brent's method (Simpson integration steps = 200)
  const m = brentRootFind(
    landObjective,
    startM - 3.0,
    startM + 3.0,
    1e-8,
    100,
    [s, nu, alpha, 200]
  );

  if (Number.isNaN(m)) return null;

  // H = m * sqrt(nu) / s
  return (m * Math.sqrt(nu)) / s;
}

// Calculates Land's H-UCL: exp(mean + 0.5 * s^2 + H * s / sqrt(n - 1))
// Returns null if input is invalid.
export function computeHUcl(
  meanVal: number,
  s: number,
  n: number,
  confLevel = 0.95
): number | null {
  if (n < 3 || s <= 0) return null;
  const H = solveH(s, n, confLevel);
  if (H === null || !Number.isFinite(H)) return null;
  const exponent = meanVal + 0.5 * s * s + (H * s) / Math.sqrt(n - 1);
  return Math.exp(exponent);
}
