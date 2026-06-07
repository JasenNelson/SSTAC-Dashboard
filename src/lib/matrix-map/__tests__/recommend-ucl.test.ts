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

    // Censored Normal
    const recCensored = recommendUcl('Normal', 15, 0.4, null, true, 10);
    expect(recCensored.basisString).toContain('DL/2 substitution');
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

    // Highly skewed n = 18 (< 20)
    const recSmallSkewed2 = recommendUcl('Gamma', 18, 0.8, 0.9, false);
    expect(recSmallSkewed2.recommendedMethod).toBe('bootstrapT');
    expect(recSmallSkewed2.basisString).toContain('n = 18 < 20');

    // Large n
    const recLarge = recommendUcl('Gamma', 60, 0.4, 1.5, false);
    expect(recLarge.recommendedMethod).toBe('approximateGamma');
    expect(recLarge.basisString).toContain('Approximate Gamma');

    // Small n, mild skewness (n = 25 >= 20)
    const recSmallMild = recommendUcl('Gamma', 25, 0.4, 2.5, false);
    expect(recSmallMild.recommendedMethod).toBe('adjustedGamma');
    expect(recSmallMild.basisString).toContain('Adjusted Gamma');
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
  });
});
