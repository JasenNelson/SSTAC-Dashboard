// Pure-TS unit tests for the matrix-options derivation library (v1).
// Pin numbers track the design doc section 7 anchor cases.
// Plain ASCII only.

import { describe, it, expect } from 'vitest';
import {
  avsSemCheck,
  ecoDirectEqP,
  ecoFoodBSAF,
  humanHealthDirectContact,
  humanHealthFoodWeb,
  utl9595,
} from '../derivations';
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

describe('ecoFoodBSAF', () => {
  // Anchor Case B per design doc section 7: MeHg subsistence-style
  // derivation. Note the design doc Anchor Case B prose mixes the
  // Eco-Food formula with the HH-Food bioaccessibility term BA_o; the
  // quoted 0.0022 mg/kg uses BA_o = 0.55 (HH-Food formula). For the pure
  // Eco-Food pathway here (no BA_o), with codex P1 2026-05-19 fix
  // applied (MeHg back-calc uses BSAF_loc * (f_protein / f_oc) * M_eco):
  //   BSAF_effective = 15 * (0.18 / 0.02) * 1 = 135
  //   SedS = (1e-4 * 70) / (0.388 * 135 * 1.0) = 0.007 / 52.38
  //        = 0.0001336... mg/kg
  // Pin reflects the protein-and-OC-normalized back-calc, which is the
  // correct MeHg form per the design doc definition
  //   BSAF_MeHg = (C_t / f_protein) / (C_s / f_oc).
  // The HH-Food pathway lands in slice 4 with the BA_o term and will
  // reproduce the 0.0022 design-doc number.
  it('matches Anchor Case B (Eco-Food MeHg formula with protein/OC normalization)', () => {
    const result = ecoFoodBSAF({
      TRV_eco_mg_per_kg_bw_day: 1.0e-4,
      BW_eco_kg: 70,
      IR_eco_kg_per_day: 0.388,
      BSAF_loc_freshwater: 15,
      fLipid: 0.05,
      foc: 0.02,
      Fsite: 1.0,
      ecosystem: 'freshwater',
      contaminantClass: 'methyl-Hg',
      // fProtein not supplied -> defaults to 0.18 (fish muscle).
    });
    expect(result.sedS).toBeCloseTo(0.0001337, 6);
    expect(result.M_eco).toBe(1);
    // BSAF_effective = 15 * (0.18 / 0.02) * 1 = 135.
    expect(result.BSAF_effective).toBeCloseTo(135, 6);
    expect(result.blocked).toBe(false);
    expect(result.warnings).toHaveLength(0);
  });

  it('estuarine non-PAH stays at M_eco = 1 with a screening warning (codex 2026-05-19 round 2)', () => {
    // Section 8.2 rule applies equally to estuarine + coastal-marine:
    // M_eco > 1 is PAH-only. Non-PAH classes (PCBs, MeHg, metals) keep
    // M_eco = 1 in estuarine systems and surface a warning so the user
    // understands the selector did not produce the headline multiplier.
    const result = ecoFoodBSAF({
      TRV_eco_mg_per_kg_bw_day: 2.0e-5,
      BW_eco_kg: 0.85,
      IR_eco_kg_per_day: 0.18,
      BSAF_loc_freshwater: 2.0,
      fLipid: 0.05,
      foc: 0.01,
      Fsite: 1.0,
      ecosystem: 'estuarine',
      contaminantClass: 'organic-halogenated', // PCBs
    });
    expect(result.M_eco).toBe(1);
    expect(result.warnings.some((w) => /M_eco = 5/.test(w))).toBe(true);
    expect(result.blocked).toBe(false);
  });

  it('estuarine PAH gets the documented M_eco = 5 (codex 2026-05-19 round 2)', () => {
    // PAH-class IS the one substance class that receives M_eco > 1 in
    // estuarine systems.
    const result = ecoFoodBSAF({
      TRV_eco_mg_per_kg_bw_day: 0.0025,
      BW_eco_kg: 0.85,
      IR_eco_kg_per_day: 0.18,
      BSAF_loc_freshwater: 0.5,
      fLipid: 0.05,
      foc: 0.01,
      Fsite: 1.0,
      ecosystem: 'estuarine',
      contaminantClass: 'organic-PAH',
    });
    expect(result.M_eco).toBe(5);
    expect(result.blocked).toBe(false);
  });

  it('honors the supplied fProtein override on the MeHg branch', () => {
    // If the HITL passes fProtein explicitly (e.g., 0.20 measured from
    // site-specific tissue analysis), the factor changes accordingly.
    const result = ecoFoodBSAF({
      TRV_eco_mg_per_kg_bw_day: 1.0e-4,
      BW_eco_kg: 70,
      IR_eco_kg_per_day: 0.388,
      BSAF_loc_freshwater: 15,
      fLipid: 0.05,
      foc: 0.02,
      Fsite: 1.0,
      ecosystem: 'freshwater',
      contaminantClass: 'methyl-Hg',
      fProtein: 0.2,
    });
    // BSAF_effective = 15 * (0.20 / 0.02) * 1 = 150
    expect(result.BSAF_effective).toBeCloseTo(150, 6);
  });

  it('applies the x15 coastal-marine multiplier for PAH-class substances', () => {
    const freshwaterBaP = ecoFoodBSAF({
      TRV_eco_mg_per_kg_bw_day: 0.0025,
      BW_eco_kg: 0.85,
      IR_eco_kg_per_day: 0.18,
      BSAF_loc_freshwater: 0.5,
      fLipid: 0.05,
      foc: 0.02,
      Fsite: 1.0,
      ecosystem: 'freshwater',
      contaminantClass: 'organic-PAH',
    });
    const coastalBaP = ecoFoodBSAF({
      TRV_eco_mg_per_kg_bw_day: 0.0025,
      BW_eco_kg: 0.85,
      IR_eco_kg_per_day: 0.18,
      BSAF_loc_freshwater: 0.5,
      fLipid: 0.05,
      foc: 0.02,
      Fsite: 1.0,
      ecosystem: 'coastal-marine',
      contaminantClass: 'organic-PAH',
    });
    expect(freshwaterBaP.M_eco).toBe(1);
    expect(coastalBaP.M_eco).toBe(15);
    // BSAF_effective scales by exactly 15x; SedS is inversely proportional
    // so it drops by 15x.
    expect(coastalBaP.BSAF_effective / freshwaterBaP.BSAF_effective).toBeCloseTo(
      15,
      6,
    );
    expect(freshwaterBaP.sedS / coastalBaP.sedS).toBeCloseTo(15, 6);
  });

  it('uses M_eco = 1 in freshwater for PAH-class substances', () => {
    const result = ecoFoodBSAF({
      TRV_eco_mg_per_kg_bw_day: 0.0025,
      BW_eco_kg: 0.85,
      IR_eco_kg_per_day: 0.18,
      BSAF_loc_freshwater: 0.5,
      fLipid: 0.05,
      foc: 0.02,
      Fsite: 1.0,
      ecosystem: 'freshwater',
      contaminantClass: 'organic-PAH',
    });
    expect(result.M_eco).toBe(1);
    expect(result.warnings).toHaveLength(0);
  });

  it('does NOT apply x15 multiplier for non-PAH classes in coastal-marine (emits warning)', () => {
    // Design doc section 8.2: PCBs / dioxins biomagnify rather than
    // passively accumulate; the library BSAF is already trophic-corrected
    // and must not be multiplied by 15.
    const result = ecoFoodBSAF({
      TRV_eco_mg_per_kg_bw_day: 0.00012,
      BW_eco_kg: 0.85,
      IR_eco_kg_per_day: 0.18,
      BSAF_loc_freshwater: 2.0,
      fLipid: 0.05,
      foc: 0.02,
      Fsite: 1.0,
      ecosystem: 'coastal-marine',
      contaminantClass: 'organic-halogenated',
    });
    expect(result.M_eco).toBe(1);
    expect(
      result.warnings.some((w) => w.includes('organic-PAH class only')),
    ).toBe(true);
  });

  it('blocks (warns + sets blocked=true) when foc is below 0.002', () => {
    const result = ecoFoodBSAF({
      TRV_eco_mg_per_kg_bw_day: 0.0025,
      BW_eco_kg: 0.85,
      IR_eco_kg_per_day: 0.18,
      BSAF_loc_freshwater: 0.5,
      fLipid: 0.05,
      foc: 0.001,
      Fsite: 1.0,
      ecosystem: 'freshwater',
      contaminantClass: 'organic-PAH',
    });
    expect(result.blocked).toBe(true);
    expect(result.warnings.some((w) => w.includes('below'))).toBe(true);
    // Diagnostic SedS is still finite so the UI can show consequence.
    expect(Number.isFinite(result.sedS)).toBe(true);
  });

  it('throws on non-positive TRV, BW, IR, or BSAF_loc', () => {
    const validBase = {
      TRV_eco_mg_per_kg_bw_day: 0.0025,
      BW_eco_kg: 0.85,
      IR_eco_kg_per_day: 0.18,
      BSAF_loc_freshwater: 0.5,
      fLipid: 0.05,
      foc: 0.02,
      Fsite: 1.0,
      ecosystem: 'freshwater' as const,
      contaminantClass: 'organic-PAH' as const,
    };
    expect(() =>
      ecoFoodBSAF({ ...validBase, TRV_eco_mg_per_kg_bw_day: 0 }),
    ).toThrow(RangeError);
    expect(() =>
      ecoFoodBSAF({ ...validBase, TRV_eco_mg_per_kg_bw_day: -1e-4 }),
    ).toThrow(RangeError);
    expect(() => ecoFoodBSAF({ ...validBase, BW_eco_kg: 0 })).toThrow(
      RangeError,
    );
    expect(() => ecoFoodBSAF({ ...validBase, IR_eco_kg_per_day: 0 })).toThrow(
      RangeError,
    );
    expect(() =>
      ecoFoodBSAF({ ...validBase, BSAF_loc_freshwater: 0 }),
    ).toThrow(RangeError);
  });

  it('anadromous Fsite = 0.2 produces a SedS 5x higher than Fsite = 1.0', () => {
    // The quick-set button in the UI sets Fsite to 0.2 for anadromous
    // salmon (design doc section 8.4); the operative formula has Fsite
    // in the denominator so SedS scales as 1 / Fsite.
    const resident = ecoFoodBSAF({
      TRV_eco_mg_per_kg_bw_day: 0.0025,
      BW_eco_kg: 0.85,
      IR_eco_kg_per_day: 0.18,
      BSAF_loc_freshwater: 0.5,
      fLipid: 0.05,
      foc: 0.02,
      Fsite: 1.0,
      ecosystem: 'freshwater',
      contaminantClass: 'organic-PAH',
    });
    const anadromous = ecoFoodBSAF({
      TRV_eco_mg_per_kg_bw_day: 0.0025,
      BW_eco_kg: 0.85,
      IR_eco_kg_per_day: 0.18,
      BSAF_loc_freshwater: 0.5,
      fLipid: 0.05,
      foc: 0.02,
      Fsite: 0.2,
      ecosystem: 'freshwater',
      contaminantClass: 'organic-PAH',
    });
    expect(anadromous.sedS / resident.sedS).toBeCloseTo(5, 6);
  });

  it('emits screening warning when Fsite is outside [0.05, 1.0] without blocking', () => {
    const result = ecoFoodBSAF({
      TRV_eco_mg_per_kg_bw_day: 0.0025,
      BW_eco_kg: 0.85,
      IR_eco_kg_per_day: 0.18,
      BSAF_loc_freshwater: 0.5,
      fLipid: 0.05,
      foc: 0.02,
      Fsite: 0.01,
      ecosystem: 'freshwater',
      contaminantClass: 'organic-PAH',
    });
    expect(result.blocked).toBe(false);
    expect(result.warnings.some((w) => w.includes('Fsite'))).toBe(true);
  });

  it('throws when foc > 0.30 without acknowledgeBlackCarbon flag', () => {
    expect(() =>
      ecoFoodBSAF({
        TRV_eco_mg_per_kg_bw_day: 0.0025,
        BW_eco_kg: 0.85,
        IR_eco_kg_per_day: 0.18,
        BSAF_loc_freshwater: 0.5,
        fLipid: 0.05,
        foc: 0.35,
        Fsite: 1.0,
        ecosystem: 'freshwater',
        contaminantClass: 'organic-PAH',
      }),
    ).toThrow(RangeError);
  });
});

describe('humanHealthDirectContact', () => {
  it('computes the lower of non-cancer and cancer direct-contact values', () => {
    const result = humanHealthDirectContact({
      rfd_oral_mg_per_kg_bw_day: 3.0e-4,
      sf_oral_per_mg_per_kg_bw_per_day: 1.5,
      targetRisk: 1.0e-5,
      hazardQuotient: 1,
      BW_kg: 15,
      ED_years: 6,
      EF_days_per_year: 40,
      AT_cancer_years: 70,
      IR_sed_mg_per_day: 200,
      SA_cm2: 2800,
      AF_sed_mg_per_cm2: 0.2,
      abs_dermal: 0.03,
      ba_oral: 0.6,
    });

    expect(result.nonCancerSedS).toBeCloseTo(300.16, 2);
    expect(result.cancerSedS).toBeCloseTo(77.82, 2);
    expect(result.sedS).toBeCloseTo(result.cancerSedS as number, 6);
    expect(result.driver).toBe('cancer');
    expect(result.contactRate_mg_per_day).toBeCloseTo(136.8, 6);
  });

  it('uses the available endpoint when only RfD is present', () => {
    const result = humanHealthDirectContact({
      rfd_oral_mg_per_kg_bw_day: 3.5e-3,
      sf_oral_per_mg_per_kg_bw_per_day: null,
      targetRisk: 1.0e-5,
      hazardQuotient: 1,
      BW_kg: 15,
      ED_years: 6,
      EF_days_per_year: 40,
      AT_cancer_years: 70,
      IR_sed_mg_per_day: 200,
      SA_cm2: 2800,
      AF_sed_mg_per_cm2: 0.2,
      abs_dermal: 0.001,
      ba_oral: 0.5,
    });

    expect(result.driver).toBe('non-cancer');
    expect(result.cancerSedS).toBeNull();
    expect(result.warnings.some((w) => w.includes('Cancer endpoint'))).toBe(true);
  });
});

describe('humanHealthFoodWeb', () => {
  it('back-calculates a human-health food-web value through BSAF', () => {
    const result = humanHealthFoodWeb({
      rfd_oral_mg_per_kg_bw_day: 2.0e-5,
      sf_oral_per_mg_per_kg_bw_per_day: 2.0,
      targetRisk: 1.0e-5,
      hazardQuotient: 1,
      BW_kg: 70,
      IR_food_kg_per_day: 0.142,
      ba_oral: 1,
      BSAF_loc_freshwater: 2,
      fLipid: 0.05,
      foc: 0.02,
      ecosystem: 'freshwater',
      contaminantClass: 'organic-halogenated',
    });

    expect(result.BSAF_effective).toBeCloseTo(5, 6);
    expect(result.nonCancerTissue_mg_per_kg).toBeCloseTo(0.009859, 6);
    expect(result.cancerTissue_mg_per_kg).toBeCloseTo(0.002465, 6);
    expect(result.sedS).toBeCloseTo(0.000493, 6);
    expect(result.driver).toBe('cancer');
  });

  it('supports the MeHg protein-normalized BSAF branch', () => {
    const result = humanHealthFoodWeb({
      rfd_oral_mg_per_kg_bw_day: 1.0e-4,
      sf_oral_per_mg_per_kg_bw_per_day: null,
      targetRisk: 1.0e-5,
      hazardQuotient: 1,
      BW_kg: 70,
      IR_food_kg_per_day: 0.388,
      ba_oral: 0.55,
      BSAF_loc_freshwater: 15,
      fLipid: 0.05,
      foc: 0.02,
      ecosystem: 'freshwater',
      contaminantClass: 'methyl-Hg',
    });

    expect(result.BSAF_effective).toBeCloseTo(135, 6);
    expect(result.tissueTarget_mg_per_kg).toBeCloseTo(0.0328, 4);
    expect(result.sedS).toBeCloseTo(0.000243, 6);
    expect(result.driver).toBe('non-cancer');
  });

  it('D-1: fLipid above FLIPID_MAX emits a screening warning but does not block the calc', () => {
    // FLIPID_MAX = 0.15; use 0.20 to exceed it.
    // The fLipid-out-of-range branch is a screening WARNING, not a block (derivations.ts:
    // "fLipid outside [0.01, 0.15] -> screening warning, not blocked"). foc 0.02 is valid,
    // so blocked must stay false and a finite sedS is still produced.
    const result = humanHealthFoodWeb({
      rfd_oral_mg_per_kg_bw_day: 2.0e-5,
      sf_oral_per_mg_per_kg_bw_per_day: 2.0,
      targetRisk: 1.0e-5,
      hazardQuotient: 1,
      BW_kg: 70,
      IR_food_kg_per_day: 0.142,
      ba_oral: 1,
      BSAF_loc_freshwater: 2,
      fLipid: 0.20,
      foc: 0.02,
      ecosystem: 'freshwater',
      contaminantClass: 'organic-halogenated',
    });
    // Warning must reference the screening range.
    expect(result.warnings.some((w) => /outside the typical screening range/.test(w))).toBe(true);
    // Calc is NOT blocked (the load-bearing assertion: a blocked result can also have a
    // finite sedS, so blocked===false is what proves the warning-not-block behavior).
    expect(result.blocked).toBe(false);
    expect(Number.isFinite(result.sedS)).toBe(true);
  });

  it('D-2: non-organic-PAH class in coastal-marine uses M_eco = 1 and emits a warning', () => {
    // Section 8.2 rule: M_eco > 1 applies only to organic-PAH.
    // coastal-marine + organic-halogenated -> M_eco = 1 + warning.
    const result = humanHealthFoodWeb({
      rfd_oral_mg_per_kg_bw_day: 2.0e-5,
      sf_oral_per_mg_per_kg_bw_per_day: 2.0,
      targetRisk: 1.0e-5,
      hazardQuotient: 1,
      BW_kg: 70,
      IR_food_kg_per_day: 0.142,
      ba_oral: 1,
      BSAF_loc_freshwater: 2,
      fLipid: 0.05,
      foc: 0.02,
      ecosystem: 'coastal-marine',
      contaminantClass: 'organic-halogenated',
    });
    expect(result.M_eco).toBe(1);
    // Warning must mention the class restriction.
    expect(
      result.warnings.some((w) => /organic-PAH class only/.test(w)),
    ).toBe(true);
  });

  it('D-3: rfd_oral null with a non-null slope factor -> cancer driver, non-cancer tissue null, warning', () => {
    const result = humanHealthFoodWeb({
      rfd_oral_mg_per_kg_bw_day: null,
      sf_oral_per_mg_per_kg_bw_per_day: 2.0,
      targetRisk: 1.0e-5,
      hazardQuotient: 1,
      BW_kg: 70,
      IR_food_kg_per_day: 0.142,
      ba_oral: 1,
      BSAF_loc_freshwater: 2,
      fLipid: 0.05,
      foc: 0.02,
      ecosystem: 'freshwater',
      contaminantClass: 'organic-halogenated',
    });
    expect(result.driver).toBe('cancer');
    expect(result.nonCancerTissue_mg_per_kg).toBeNull();
    // The non-cancer-not-available warning must be present.
    expect(
      result.warnings.some((w) => /Non-cancer endpoint not available/.test(w)),
    ).toBe(true);
  });
});
