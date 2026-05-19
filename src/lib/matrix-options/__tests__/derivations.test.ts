// Pure-TS unit tests for the matrix-options derivation library (v1).
// Pin numbers track the design doc section 7 anchor cases.
// Plain ASCII only.

import { describe, it, expect } from 'vitest';
import { avsSemCheck, ecoDirectEqP, utl9595 } from '../derivations';
import { lookupK9595 } from '../utlTable';

describe('utl9595', () => {
  it('computes mean + K * sd for n = 10 (K = 2.911)', () => {
    // Construct a sample with mean 5 and sample sd (Bessel-corrected) of 1.
    // Easiest path: pick five pairs of mean +/- d so the deviations sum to
    // a known value. For 10 samples with mean = 5 and sd = 1 we need
    // sum of squared deviations = (n - 1) * sd^2 = 9. Use five +1 and
    // five -1 deviations -> sum of squared deviations = 10, sd = sqrt(10/9).
    // Easier: directly construct samples whose mean is 5 and whose
    // Bessel sd is exactly 1 by solving for the offset d:
    // 10 deviations of magnitude d -> sum_sq = 10 * d^2, sd = sqrt(10 * d^2 / 9) = 1
    // -> d = sqrt(9/10) = 0.9486832...
    const d = Math.sqrt(9 / 10);
    const samples = [
      5 - d, 5 + d, 5 - d, 5 + d, 5 - d, 5 + d, 5 - d, 5 + d, 5 - d, 5 + d,
    ];
    const result = utl9595(samples);
    expect(result.n).toBe(10);
    expect(result.mean).toBeCloseTo(5, 10);
    expect(result.sd).toBeCloseTo(1, 10);
    expect(result.K).toBeCloseTo(2.911, 3);
    // UTL = 5 + 2.911 * 1 = 7.911
    expect(result.utl).toBeCloseTo(7.911, 3);
  });

  it('throws when fewer than 2 finite samples are provided', () => {
    expect(() => utl9595([5])).toThrow(RangeError);
    expect(() => utl9595([NaN, Infinity])).toThrow(RangeError);
  });

  it('returns an empty warnings array when n is at a tabulated row', () => {
    const samples = Array.from({ length: 10 }, (_, i) => 5 + (i - 4.5) * 0.1);
    const result = utl9595(samples);
    expect(result.warnings).toEqual([]);
  });

  it('propagates a clamp warning when n is below the tabulated minimum', () => {
    // n = 3 is below the smallest tabulated row (n = 5); lookupK9595 clamps
    // K to 4.166 and surfaces a warning. utl9595 must propagate that warning
    // so the UI can mark the verdict as screening-only. Codex P2 finding.
    const result = utl9595([4.8, 5.1, 5.3]);
    expect(result.n).toBe(3);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toMatch(/below tabulated minimum/);
  });

  it('propagates a clamp warning when n exceeds the tabulated maximum', () => {
    const samples = Array.from({ length: 150 }, (_, i) => 5 + i * 0.001);
    const result = utl9595(samples);
    expect(result.n).toBe(150);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toMatch(/exceeds tabulated maximum/);
  });
});

describe('lookupK9595 (linear interpolation)', () => {
  it('returns the exact tabulated value at known rows', () => {
    expect(lookupK9595(5).K).toBeCloseTo(4.166, 3);
    expect(lookupK9595(10).K).toBeCloseTo(2.911, 3);
    expect(lookupK9595(100).K).toBeCloseTo(1.927, 3);
  });

  it('interpolates linearly between tabulated rows', () => {
    // Midpoint between n = 10 (K = 2.911) and n = 20 (K = 2.396) is
    // K = (2.911 + 2.396) / 2 = 2.6535 at n = 15.
    expect(lookupK9595(15).K).toBeCloseTo(2.6535, 4);
  });

  it('clamps and warns above the tabulated maximum', () => {
    const { K, warning } = lookupK9595(500);
    expect(K).toBeCloseTo(1.927, 3);
    expect(warning).not.toBeNull();
  });
});

describe('ecoDirectEqP', () => {
  it('matches Anchor Case A: B[a]P EqP at foc = 0.020 -> ~0.2973 mg/kg', () => {
    // Design doc section 7 Anchor Case A. The doc quotes SedS = 0.2974
    // mg/kg, derived by rounding K_oc to 1.062e6 L/kg-OC at an
    // intermediate step. Carrying full precision through the chain gives
    // 0.29732... mg/kg, which agrees with the design doc to 3 sig figs.
    // We pin the precise value (0.2973) so the test catches algebraic
    // drift while staying faithful to the worked example.
    //
    // Also note: the design doc's prose formula in section 2.1 writes
    // "10^-6 converts FCV from ug/L to mg/L"; the actual conversion is
    // 1 ug/L = 1e-3 mg/L, and only the 1e-3 conversion reproduces the
    // Anchor Case A worked example. Implementation uses 1e-3. Surfaced
    // to orchestrator in the agent report.
    const result = ecoDirectEqP({
      Cs_mg_per_kg: Number.NaN, // benchmark-only mode
      foc: 0.020,
      logKow: 6.13,
      fcv_ug_per_L: 0.014,
    });
    expect(result.sedS).toBeCloseTo(0.2973, 4);
    // log K_oc = 0.00028 + 0.983 * 6.13 = 6.02607 (design doc quotes
    // 6.0259, rounded to 4 sig figs).
    expect(result.logKoc).toBeCloseTo(6.02607, 5);
    expect(result.verdict).toBeNull();
    // foc = 0.020 is inside the validity window -> no warnings.
    expect(result.warnings).toHaveLength(0);
  });

  it('returns PASS verdict when Cs <= sedS and FAIL when Cs > sedS', () => {
    const benchmark = ecoDirectEqP({
      Cs_mg_per_kg: Number.NaN,
      foc: 0.020,
      logKow: 6.13,
      fcv_ug_per_L: 0.014,
    }).sedS;

    const passResult = ecoDirectEqP({
      Cs_mg_per_kg: benchmark * 0.5,
      foc: 0.020,
      logKow: 6.13,
      fcv_ug_per_L: 0.014,
    });
    expect(passResult.verdict).toBe('PASS');

    const failResult = ecoDirectEqP({
      Cs_mg_per_kg: benchmark * 2.0,
      foc: 0.020,
      logKow: 6.13,
      fcv_ug_per_L: 0.014,
    });
    expect(failResult.verdict).toBe('FAIL');
  });

  it('blocks (warns + suppresses verdict) when foc is below 0.002', () => {
    // Pass a Cs that would otherwise produce a PASS verdict; the out-of-
    // window foc must suppress the verdict per design doc section 2.1
    // "reject (do not compute)". Codex P2 finding 2026-05-18 round 2.
    const result = ecoDirectEqP({
      Cs_mg_per_kg: 0.0001,
      foc: 0.001,
      logKow: 6.13,
      fcv_ug_per_L: 0.014,
    });
    expect(result.warnings.some((w) => w.includes('below'))).toBe(true);
    expect(result.blocked).toBe(true);
    expect(result.verdict).toBeNull();
    // sedS still computed for diagnostic display; do NOT quote as benchmark.
    expect(Number.isFinite(result.sedS)).toBe(true);
  });

  it('blocks (warns + suppresses verdict) when foc is above 0.10 but below the 0.30 hard reject', () => {
    const result = ecoDirectEqP({
      Cs_mg_per_kg: 0.0001,
      foc: 0.15,
      logKow: 6.13,
      fcv_ug_per_L: 0.014,
    });
    expect(result.warnings.some((w) => w.includes('above'))).toBe(true);
    expect(result.blocked).toBe(true);
    expect(result.verdict).toBeNull();
    expect(Number.isFinite(result.sedS)).toBe(true);
  });

  it('blocks (warns + suppresses verdict) when Cs is negative', () => {
    // Codex P2 finding 2026-05-18 round 2: negative Cs is finite and
    // trivially less than a positive sedS, so the prior code returned PASS.
    // Site analytical concentrations are constrained to >= 0.
    const result = ecoDirectEqP({
      Cs_mg_per_kg: -1.0,
      foc: 0.020,
      logKow: 6.13,
      fcv_ug_per_L: 0.014,
    });
    expect(result.warnings.some((w) => w.includes('negative'))).toBe(true);
    expect(result.blocked).toBe(true);
    expect(result.verdict).toBeNull();
  });

  it('valid inputs report blocked=false', () => {
    const result = ecoDirectEqP({
      Cs_mg_per_kg: 0.1,
      foc: 0.020,
      logKow: 6.13,
      fcv_ug_per_L: 0.014,
    });
    expect(result.blocked).toBe(false);
    expect(result.verdict).not.toBeNull();
  });

  it('throws when |logKow| exceeds the physical plausibility bound of 10', () => {
    // Opus adversarial review P3 2026-05-18: defensive bound against
    // future HITL logKow-override paths. Math.pow(10, 400) -> Infinity,
    // which silently passes through to the verdict comparison and yields
    // PASS for any finite Cs. The guard now throws explicitly.
    expect(() =>
      ecoDirectEqP({
        Cs_mg_per_kg: Number.NaN,
        foc: 0.020,
        logKow: 15,
        fcv_ug_per_L: 0.014,
      }),
    ).toThrow(RangeError);
    expect(() =>
      ecoDirectEqP({
        Cs_mg_per_kg: Number.NaN,
        foc: 0.020,
        logKow: -15,
        fcv_ug_per_L: 0.014,
      }),
    ).toThrow(RangeError);
  });

  it('throws when foc > 0.30 without the acknowledgeBlackCarbon flag', () => {
    expect(() =>
      ecoDirectEqP({
        Cs_mg_per_kg: Number.NaN,
        foc: 0.35,
        logKow: 6.13,
        fcv_ug_per_L: 0.014,
      }),
    ).toThrow(RangeError);

    // Same input with the flag set should NOT throw, but should still warn.
    const result = ecoDirectEqP({
      Cs_mg_per_kg: Number.NaN,
      foc: 0.35,
      logKow: 6.13,
      fcv_ug_per_L: 0.014,
      acknowledgeBlackCarbon: true,
    });
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

describe('avsSemCheck', () => {
  it('reports nonToxic when sum(SEM) <= AVS', () => {
    const result = avsSemCheck({ semSum_umol_per_g: 2.0, avs_umol_per_g: 5.0 });
    expect(result.deltaSEMminusAVS).toBeCloseTo(-3.0, 6);
    expect(result.nonToxic).toBe(true);
  });

  it('reports toxic potential when sum(SEM) > AVS', () => {
    const result = avsSemCheck({ semSum_umol_per_g: 8.0, avs_umol_per_g: 2.5 });
    expect(result.deltaSEMminusAVS).toBeCloseTo(5.5, 6);
    expect(result.nonToxic).toBe(false);
  });
});
