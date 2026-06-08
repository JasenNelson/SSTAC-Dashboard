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
  detects?: number,
  censoredMethod?: 'KM' | 'ROS' | 'DL2',
  logN?: number
): Recommendation {
  // If sample size is insufficient (n < 2), UCL is not possible
  if (n < 2) {
    return {
      recommendedMethod: 'none',
      basisString: 'Sample size n < 2: UCL is not computable.'
    };
  }

  const dCount = detects !== undefined ? detects : n;

  // ProUCL Section 1.12: Censored data with detects < 4 or NDs > 95% (detects < 5%) -> recommends non-statistical methods
  const isExtremelyCensored = hasCensored && (dCount / n) < 0.05;
  if (hasCensored && (dCount < 4 || isExtremelyCensored)) {
    return {
      recommendedMethod: 'none',
      basisString: `ProUCL 5.2 Section 1.12: Censored data with ${dCount < 4 ? `detects = ${dCount} < 4` : `NDs > 95% (detects = ${dCount}/${n})`} -> Recommends non-statistical/ad-hoc methods (e.g. Max Detect/Median/Mode as EPC)`
    };
  }

  // ---------------------------------------------------------------------------
  // Censored Pathway (Kaplan-Meier, ROS, or DL/2 based recommendations)
  // ---------------------------------------------------------------------------
  if (hasCensored) {
    const methodPrefix = censoredMethod === 'ROS' ? 'ROS' : censoredMethod === 'DL2' ? 'DL/2' : 'KM';

    // 1. Normal / Approximate Normal (censored)
    if (verdict === 'Normal') {
      return {
        recommendedMethod: 'kmT',
        basisString: `ProUCL 5.2 Section 4.5.1: Normal distribution with censored data -> 95% ${methodPrefix} (t) UCL`
      };
    }

    // 2. Gamma / Approximate Gamma (censored)
    if (verdict === 'Gamma') {
      if (n > 50) {
        return {
          recommendedMethod: 'kmApproxGamma',
          basisString: `ProUCL 5.2 Section 4.6.2: Gamma (n = ${n} > 50) with censored data -> 95% Approximate Gamma ${methodPrefix}-UCL`
        };
      } else {
        return {
          recommendedMethod: 'kmAdjustedGamma',
          basisString: `ProUCL 5.2 Section 4.6.2: Gamma (n = ${n} <= 50) with censored data -> 95% Adjusted Gamma ${methodPrefix}-UCL`
        };
      }
    }

    // 3. Lognormal / Approximate Lognormal (censored)
    if (verdict === 'Lognormal') {
      const sLog = sigmaHat !== null ? sigmaHat : 0.5;
      const effectiveN = logN !== undefined ? logN : n;
      if (effectiveN >= 28) {
        return {
          recommendedMethod: 'kmH',
          basisString: `ProUCL 5.2 Section 4.5.3: Lognormal (n = ${effectiveN} >= 28) with censored data -> 95% H-UCL (${methodPrefix}-Log)`
        };
      } else if (sLog < 1.5) {
        return {
          recommendedMethod: 'kmH',
          basisString: `ProUCL 5.2 Section 4.5.3: Lognormal (n = ${effectiveN} < 28, log SD = ${sLog.toFixed(3)} < 1.5) with censored data -> 95% H-UCL (${methodPrefix}-Log)`
        };
      } else {
        return {
          recommendedMethod: 'kmT',
          basisString: `ProUCL 5.2 Section 4.5.3: Lognormal (n = ${effectiveN} < 28, log SD = ${sLog.toFixed(3)} >= 1.5) with censored data -> 95% ${methodPrefix} (t) UCL`,
          warning: `Lognormal distribution with small sample size and high log-scale standard deviation; ${methodPrefix} (t) UCL recommended.`
        };
      }
    }

    // 4. Nonparametric / Non-discernible (censored)
    const sLog = sigmaHat !== null ? sigmaHat : 0.5;

    if (sLog < 0.5) {
      return {
        recommendedMethod: 'kmT',
        basisString: `ProUCL 5.2 Table 4-13: Nonparametric (log SD = ${sLog.toFixed(3)} < 0.5) with censored data -> 95% ${methodPrefix} (t) UCL`
      };
    } else if (sLog < 1.0) {
      return {
        recommendedMethod: 'kmChebyshev95',
        basisString: `ProUCL 5.2 Table 4-13: Nonparametric (log SD = ${sLog.toFixed(3)} < 1.0) with censored data -> 95% ${methodPrefix} Chebyshev UCL`
      };
    } else if (sLog < 1.5) {
      return {
        recommendedMethod: 'kmChebyshev975',
        basisString: `ProUCL 5.2 Table 4-13: Nonparametric (log SD = ${sLog.toFixed(3)} < 1.5) with censored data -> 97.5% ${methodPrefix} Chebyshev UCL`
      };
    } else if (sLog < 2.0) {
      return {
        recommendedMethod: 'kmChebyshev99',
        basisString: `ProUCL 5.2 Table 4-13: Nonparametric (log SD = ${sLog.toFixed(3)} < 2.0) with censored data -> 99% ${methodPrefix} Chebyshev UCL`
      };
    } else if (sLog < 3.0) {
      if (n < 50) {
        return {
          recommendedMethod: 'kmChebyshev99',
          basisString: `ProUCL 5.2 Table 4-13: Nonparametric (log SD = ${sLog.toFixed(3)} < 3.0, n = ${n} < 50) with censored data -> 99% ${methodPrefix} Chebyshev UCL`
        };
      } else {
        return {
          recommendedMethod: 'kmChebyshev975',
          basisString: `ProUCL 5.2 Table 4-13: Nonparametric (log SD = ${sLog.toFixed(3)} < 3.0, n = ${n} >= 50) with censored data -> 97.5% ${methodPrefix} Chebyshev UCL`
        };
      }
    } else {
      return {
        recommendedMethod: 'kmChebyshev99',
        basisString: `ProUCL 5.2 Table 4-13: Nonparametric (log SD = ${sLog.toFixed(3)} >= 3.0) with censored data -> 99% ${methodPrefix} Chebyshev UCL`,
        warning: `Extremely skewed censored dataset (log SD >= 3.0). ${methodPrefix} Chebyshev UCL may underestimate or yield high variability.`
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Uncensored Pathway
  // ---------------------------------------------------------------------------

  // 1. Normal / Approximate Normal
  if (verdict === 'Normal') {
    return {
      recommendedMethod: 'studentT95',
      basisString: `ProUCL 5.2 Section 2.5: Normal distribution -> 95% Student's-t UCL`
    };
  }

  // 2. Gamma / Approximate Gamma
  if (verdict === 'Gamma') {
    const ks = kStar !== null ? kStar : 1.0;
    if (ks <= 1.0 && n < 20) {
      return {
        recommendedMethod: 'bootstrapT',
        basisString: `ProUCL 5.2 Section 2.5: Gamma (k* = ${ks.toFixed(3)} <= 1.0, n = ${n} < 20) -> 95% Bootstrap-t UCL`,
        warning: 'Highly skewed gamma distribution with small sample size. Results may be sensitive to outliers.'
      };
    } else if (n > 50) {
      return {
        recommendedMethod: 'approximateGamma',
        basisString: `ProUCL 5.2 Section 2.4.2: Gamma (n = ${n} > 50) -> 95% Approximate Gamma UCL (Wilson-Hilferty)`
      };
    } else {
      return {
        recommendedMethod: 'adjustedGamma',
        basisString: `ProUCL 5.2 Section 2.4.2: Gamma (n = ${n} <= 50) -> 95% Adjusted Gamma UCL (Grice-Bain)`
      };
    }
  }

  // 3. Lognormal / Approximate Lognormal
  if (verdict === 'Lognormal') {
    const sLog = sigmaHat !== null ? sigmaHat : 0.5;
    const effectiveN = logN !== undefined ? logN : n;
    if (effectiveN >= 28) {
      return {
        recommendedMethod: 'hUcl',
        basisString: `ProUCL 5.2 Table 2-13: Lognormal (n = ${effectiveN} >= 28) -> 95% H-UCL`
      };
    } else if (sLog < 1.5) {
      return {
        recommendedMethod: 'hUcl',
        basisString: `ProUCL 5.2 Table 2-13: Lognormal (n = ${effectiveN} < 28, log SD = ${sLog.toFixed(3)} < 1.5) -> 95% H-UCL`
      };
    } else {
      return {
        recommendedMethod: 'studentT95',
        basisString: `ProUCL 5.2 Table 2-13: Lognormal (n = ${effectiveN} < 28, log SD = ${sLog.toFixed(3)} >= 1.5) -> 95% Student's-t UCL`,
        warning: 'Lognormal distribution with small sample size and high log-scale standard deviation; Student\'s t-UCL recommended.'
      };
    }
  }

  // 4. Nonparametric / Non-discernible
  const sLog = sigmaHat !== null ? sigmaHat : 0.5;

  if (sLog < 0.5) {
    return {
      recommendedMethod: 'studentT95',
      basisString: `ProUCL 5.2 Section 2.5: Nonparametric (log SD = ${sLog.toFixed(3)} < 0.5) -> 95% Student's-t UCL`
    };
  } else if (sLog < 1.0) {
    return {
      recommendedMethod: 'chebyshev95',
      basisString: `ProUCL 5.2 Table 2-12: Nonparametric (log SD = ${sLog.toFixed(3)} < 1.0) -> 95% Chebyshev UCL`
    };
  } else if (sLog < 1.5) {
    return {
      recommendedMethod: 'chebyshev975',
      basisString: `ProUCL 5.2 Table 2-12: Nonparametric (log SD = ${sLog.toFixed(3)} < 1.5) -> 97.5% Chebyshev UCL`
    };
  } else if (sLog < 2.0) {
    return {
      recommendedMethod: 'chebyshev99',
      basisString: `ProUCL 5.2 Table 2-12: Nonparametric (log SD = ${sLog.toFixed(3)} < 2.0) -> 99% Chebyshev UCL`
    };
  } else if (sLog < 3.0) {
    if (n < 50) {
      return {
        recommendedMethod: 'chebyshev99',
        basisString: `ProUCL 5.2 Table 2-12: Nonparametric (log SD = ${sLog.toFixed(3)} < 3.0, n = ${n} < 50) -> 99% Chebyshev UCL`
      };
    } else {
      return {
        recommendedMethod: 'chebyshev975',
        basisString: `ProUCL 5.2 Table 2-12: Nonparametric (log SD = ${sLog.toFixed(3)} < 3.0, n = ${n} >= 50) -> 97.5% Chebyshev UCL`
      };
    }
  } else {
    return {
      recommendedMethod: 'chebyshev99',
      basisString: `ProUCL 5.2 Table 2-12: Nonparametric (log SD = ${sLog.toFixed(3)} >= 3.0) -> 99% Chebyshev UCL`,
      warning: 'Extremely skewed dataset (log SD >= 3.0). Standard Chebyshev UCL may underestimate or yield high variability.'
    };
  }
}

