// Unit tests for the ProUCL Recommended UCL selection logic.
// Traced to: docs/PROUCL_V52_EXTRACTION_PACKET_2026_06_06.md Section A, C, & D.
// Plain ASCII only.

import { describe, it, expect } from 'vitest';
import { recommendUcl } from '../recommend-ucl';

describe('UCL Recommendation Ladder (recommend-ucl)', () => {
  it('handles small sample size n < 2', () => {
    const rec = recommendUcl('Normal', 1, 0.4, 0.8, false);
    expect(rec.recommendedMethod).toBe('none');
    expect(rec.basisString).toContain('UCL is not computable');
  });

  it('handles Normal distribution', () => {
    const rec = recommendUcl('Normal', 15, 0.4, null, false);
    expect(rec.recommendedMethod).toBe('studentT95');
    expect(rec.basisString).toContain("Student's-t UCL");

    // Censored Normal -> kmT
    const recCensored = recommendUcl('Normal', 15, 0.4, null, true, 10);
    expect(recCensored.recommendedMethod).toBe('kmT');
    expect(recCensored.basisString).toContain('KM (t) UCL');
  });

  it('handles Censored low-detection (detects < 4) and extreme censoring (NDs > 95%)', () => {
    const recLowDetect = recommendUcl('Normal', 20, 0.4, null, true, 2);
    expect(recLowDetect.recommendedMethod).toBe('none');
    expect(recLowDetect.basisString).toContain('detects = 2 < 4');

    // 4 detects in 100 observations (96% NDs, < 5% detects)
    const recExtreme = recommendUcl('Normal', 100, 0.4, null, true, 4);
    expect(recExtreme.recommendedMethod).toBe('none');
    expect(recExtreme.basisString).toContain('NDs > 95%');
  });

  it('handles Gamma distribution', () => {
    // Highly skewed small n (< 20)
    const recSmallSkewed = recommendUcl('Gamma', 12, 0.8, 0.9, false);
    expect(recSmallSkewed.recommendedMethod).toBe('bootstrapT');
    expect(recSmallSkewed.basisString).toContain('Bootstrap-t');
    expect(recSmallSkewed.warning).toBeDefined();

    // Large n
    const recLarge = recommendUcl('Gamma', 60, 0.4, 1.5, false);
    expect(recLarge.recommendedMethod).toBe('approximateGamma');
    expect(recLarge.basisString).toContain('Approximate Gamma');

    // Small n, mild skewness (n = 25 >= 20)
    const recSmallMild = recommendUcl('Gamma', 25, 0.4, 2.5, false);
    expect(recSmallMild.recommendedMethod).toBe('adjustedGamma');
    expect(recSmallMild.basisString).toContain('Adjusted Gamma');

    // Censored Gamma n > 50 -> kmApproxGamma
    const recCensoredLarge = recommendUcl('Gamma', 55, 0.4, 1.5, true, 45);
    expect(recCensoredLarge.recommendedMethod).toBe('kmApproxGamma');
    expect(recCensoredLarge.basisString).toContain('Approximate Gamma KM-UCL');

    // Censored Gamma n <= 50 -> kmAdjustedGamma
    const recCensoredSmall = recommendUcl('Gamma', 24, 0.4, 1.5, true, 11);
    expect(recCensoredSmall.recommendedMethod).toBe('kmAdjustedGamma');
    expect(recCensoredSmall.basisString).toContain('Adjusted Gamma KM-UCL');

    // Boundary check: Censored Gamma n exactly 50 -> kmAdjustedGamma
    const recCensoredExact50 = recommendUcl('Gamma', 50, 0.4, 1.5, true, 40);
    expect(recCensoredExact50.recommendedMethod).toBe('kmAdjustedGamma');

    // Boundary check: Censored Gamma n exactly 51 -> kmApproxGamma
    const recCensoredExact51 = recommendUcl('Gamma', 51, 0.4, 1.5, true, 41);
    expect(recCensoredExact51.recommendedMethod).toBe('kmApproxGamma');
  });

  it('handles Lognormal distribution', () => {
    // Large n
    const recLarge = recommendUcl('Lognormal', 35, 1.2, null, false);
    expect(recLarge.recommendedMethod).toBe('hUcl');

    // Small n, log SD < 1.5
    const recSmallLowSkew = recommendUcl('Lognormal', 15, 1.2, null, false);
    expect(recSmallLowSkew.recommendedMethod).toBe('hUcl');

    // Small n, log SD >= 1.5
    const recSmallHighSkew = recommendUcl('Lognormal', 15, 1.8, null, false);
    expect(recSmallHighSkew.recommendedMethod).toBe('studentT95');
    expect(recSmallHighSkew.warning).toBeDefined();

    // Censored Lognormal n >= 28 -> kmH
    const recCensoredLarge = recommendUcl('Lognormal', 30, 1.2, null, true, 20);
    expect(recCensoredLarge.recommendedMethod).toBe('kmH');
    expect(recCensoredLarge.basisString).toContain('H-UCL (KM-Log)');

    // Censored Lognormal n < 28, log SD < 1.5 -> kmH
    const recCensoredSmallLow = recommendUcl('Lognormal', 24, 1.2, null, true, 11);
    expect(recCensoredSmallLow.recommendedMethod).toBe('kmH');

    // Censored Lognormal n < 28, log SD >= 1.5 -> kmT
    const recCensoredSmallHigh = recommendUcl('Lognormal', 24, 1.8, null, true, 11);
    expect(recCensoredSmallHigh.recommendedMethod).toBe('kmT');
  });

  it('handles Nonparametric / Non-discernible distribution', () => {
    // log SD < 0.5
    const recLowSkew = recommendUcl('Nonparametric', 20, 0.4, null, false);
    expect(recLowSkew.recommendedMethod).toBe('studentT95');

    // log SD < 1.0
    const recCheb95 = recommendUcl('Nonparametric', 20, 0.8, null, false);
    expect(recCheb95.recommendedMethod).toBe('chebyshev95');

    // log SD < 1.5
    const recCheb975 = recommendUcl('Nonparametric', 20, 1.2, null, false);
    expect(recCheb975.recommendedMethod).toBe('chebyshev975');

    // log SD < 2.0
    const recCheb99 = recommendUcl('Nonparametric', 20, 1.8, null, false);
    expect(recCheb99.recommendedMethod).toBe('chebyshev99');

    // log SD < 3.0, n < 50
    const recCheb99Small = recommendUcl('Nonparametric', 25, 2.5, null, false);
    expect(recCheb99Small.recommendedMethod).toBe('chebyshev99');

    // log SD < 3.0, n >= 50
    const recCheb975Large = recommendUcl('Nonparametric', 60, 2.5, null, false);
    expect(recCheb975Large.recommendedMethod).toBe('chebyshev975');

    // log SD >= 3.0
    const recCheb99Extreme = recommendUcl('Nonparametric', 25, 3.2, null, false);
    expect(recCheb99Extreme.recommendedMethod).toBe('chebyshev99');
    expect(recCheb99Extreme.warning).toBeDefined();

    // Censored Nonparametric log SD < 0.5 -> kmT
    const recCensoredLow = recommendUcl('Nonparametric', 20, 0.4, null, true, 15);
    expect(recCensoredLow.recommendedMethod).toBe('kmT');

    // Censored Nonparametric log SD < 1.0 -> kmChebyshev95
    const recCensoredCheb95 = recommendUcl('Nonparametric', 20, 0.8, null, true, 15);
    expect(recCensoredCheb95.recommendedMethod).toBe('kmChebyshev95');

    // Censored Nonparametric log SD < 1.5 -> kmChebyshev975
    const recCensoredCheb975 = recommendUcl('Nonparametric', 20, 1.2, null, true, 15);
    expect(recCensoredCheb975.recommendedMethod).toBe('kmChebyshev975');

    // Censored Nonparametric log SD < 2.0 -> kmChebyshev99
    const recCensoredCheb99 = recommendUcl('Nonparametric', 20, 1.8, null, true, 15);
    expect(recCensoredCheb99.recommendedMethod).toBe('kmChebyshev99');
  });
});
