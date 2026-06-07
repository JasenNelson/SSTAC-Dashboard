// ProUCL Recommended UCL Selection Ladder.
// Traced to: docs/PROUCL_V52_EXTRACTION_PACKET_2026_06_06.md Section A, C, D, & F.
// Plain ASCII only.

import type { DistributionVerdict } from './gof';

export interface Recommendation {
  recommendedMethod: string; // e.g. "studentT95", "approximateGamma", "adjustedGamma", "hUcl", "chebyshev95", etc.
  basisString: string;       // Citations and detail of the decision rule applied
  warning?: string;          // Warning text for small n, high skewness, etc.
}

// Pure function implementing the ProUCL 5.2 decision ladder.
export function recommendUcl(
  verdict: DistributionVerdict,
  n: number,
  sigmaHat: number | null,
  kStar: number | null,
  hasCensored: boolean,
  detects?: number
): Recommendation {
  // If sample size is insufficient (n < 2), UCL is not possible
  if (n < 2) {
    return {
      recommendedMethod: 'none',
      basisString: 'Sample size n < 2: UCL is not computable.'
    };
  }

  const dCount = detects !== undefined ? detects : n;

  // Censored adjustment label prefix
  const censoredSuffix = hasCensored ? ' [DL/2 substitution (interim, Phase 3: KM)]' : '';

  // ProUCL Section 1.12: Censored data with detects < 4 or NDs > 95% (detects < 5%) -> recommends non-statistical methods
  const isExtremelyCensored = hasCensored && (dCount / n) < 0.05;
  if (hasCensored && (dCount < 4 || isExtremelyCensored)) {
    return {
      recommendedMethod: 'none',
      basisString: `ProUCL 5.2 Section 1.12: Censored data with ${dCount < 4 ? `detects = ${dCount} < 4` : `NDs > 95% (detects = ${dCount}/${n})`} -> Recommends non-statistical/ad-hoc methods (e.g. Max Detect/Median/Mode as EPC)${censoredSuffix}`
    };
  }

  // 1. Normal / Approximate Normal
  if (verdict === 'Normal') {
    return {
      recommendedMethod: 'studentT95',
      basisString: `ProUCL 5.2 Section 2.5: Normal distribution -> 95% Student's-t UCL${censoredSuffix}`
    };
  }

  // 2. Gamma / Approximate Gamma
  if (verdict === 'Gamma') {
    const ks = kStar !== null ? kStar : 1.0;
    if (ks <= 1.0 && n < 20) {
      return {
        recommendedMethod: 'bootstrapT',
        basisString: `ProUCL 5.2 Section 2.5: Gamma (k* = ${ks.toFixed(3)} <= 1.0, n = ${n} < 20) -> 95% Bootstrap-t UCL${censoredSuffix}`,
        warning: 'Highly skewed gamma distribution with small sample size. Results may be sensitive to outliers.'
      };
    } else if (n > 50) {
      return {
        recommendedMethod: 'approximateGamma',
        basisString: `ProUCL 5.2 Section 2.4.2: Gamma (n = ${n} > 50) -> 95% Approximate Gamma UCL (Wilson-Hilferty)${censoredSuffix}`
      };
    } else {
      return {
        recommendedMethod: 'adjustedGamma',
        basisString: `ProUCL 5.2 Section 2.4.2: Gamma (n = ${n} <= 50) -> 95% Adjusted Gamma UCL (Grice-Bain)${censoredSuffix}`
      };
    }
  }

  // 3. Lognormal / Approximate Lognormal
  if (verdict === 'Lognormal') {
    const sLog = sigmaHat !== null ? sigmaHat : 0.5;
    if (n >= 28) {
      return {
        recommendedMethod: 'hUcl',
        basisString: `ProUCL 5.2 Table 2-13: Lognormal (n = ${n} >= 28) -> 95% H-UCL${censoredSuffix}`
      };
    } else if (sLog < 1.5) {
      return {
        recommendedMethod: 'hUcl',
        basisString: `ProUCL 5.2 Table 2-13: Lognormal (n = ${n} < 28, log SD = ${sLog.toFixed(3)} < 1.5) -> 95% H-UCL${censoredSuffix}`
      };
    } else {
      return {
        recommendedMethod: 'studentT95',
        basisString: `ProUCL 5.2 Table 2-13: Lognormal (n = ${n} < 28, log SD = ${sLog.toFixed(3)} >= 1.5) -> 95% Student's-t UCL${censoredSuffix}`,
        warning: 'Lognormal distribution with small sample size and high log-scale standard deviation; Student\'s t-UCL recommended.'
      };
    }
  }

  // 4. Nonparametric / Non-discernible
  const sLog = sigmaHat !== null ? sigmaHat : 0.5;

  if (sLog < 0.5) {
    return {
      recommendedMethod: 'studentT95',
      basisString: `ProUCL 5.2 Section 2.5: Nonparametric (log SD = ${sLog.toFixed(3)} < 0.5) -> 95% Student's-t UCL${censoredSuffix}`
    };
  } else if (sLog < 1.0) {
    return {
      recommendedMethod: 'chebyshev95',
      basisString: `ProUCL 5.2 Table 2-12: Nonparametric (log SD = ${sLog.toFixed(3)} < 1.0) -> 95% Chebyshev UCL${censoredSuffix}`
    };
  } else if (sLog < 1.5) {
    return {
      recommendedMethod: 'chebyshev975',
      basisString: `ProUCL 5.2 Table 2-12: Nonparametric (log SD = ${sLog.toFixed(3)} < 1.5) -> 97.5% Chebyshev UCL${censoredSuffix}`
    };
  } else if (sLog < 2.0) {
    return {
      recommendedMethod: 'chebyshev99',
      basisString: `ProUCL 5.2 Table 2-12: Nonparametric (log SD = ${sLog.toFixed(3)} < 2.0) -> 99% Chebyshev UCL${censoredSuffix}`
    };
  } else if (sLog < 3.0) {
    if (n < 50) {
      return {
        recommendedMethod: 'chebyshev99',
        basisString: `ProUCL 5.2 Table 2-12: Nonparametric (log SD = ${sLog.toFixed(3)} < 3.0, n = ${n} < 50) -> 99% Chebyshev UCL${censoredSuffix}`
      };
    } else {
      return {
        recommendedMethod: 'chebyshev975',
        basisString: `ProUCL 5.2 Table 2-12: Nonparametric (log SD = ${sLog.toFixed(3)} < 3.0, n = ${n} >= 50) -> 97.5% Chebyshev UCL${censoredSuffix}`
      };
    }
  } else {
    return {
      recommendedMethod: 'chebyshev99',
      basisString: `ProUCL 5.2 Table 2-12: Nonparametric (log SD = ${sLog.toFixed(3)} >= 3.0) -> 99% Chebyshev UCL${censoredSuffix}`,
      warning: 'Extremely skewed dataset (log SD >= 3.0). Standard Chebyshev UCL may underestimate or yield high variability.'
    };
  }
}
