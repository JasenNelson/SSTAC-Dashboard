import { describe, expect, it } from 'vitest';
import { deriveInhalationStandards } from '../calculator';
import type { HumanHealthInhalationInput } from '../calculator';

// Baseline valid input: benzene-like values used in the hand-worked example in
// calculator.ts's module header. Individual tests null-out or corrupt one field
// at a time (see FAIL-CLOSED section) to prove independent gating.
const BASE_VALID: HumanHealthInhalationInput = {
  rfc_inhalation_mg_per_m3: 0.03,
  iur_inhalation_per_mg_per_m3: 0.016,
  targetRisk: 1e-5,
  hazardQuotient: 1,
  volatilization_factor_m3_per_kg: 1.0e4,
  particulate_emission_factor_m3_per_kg: 1.36e9,
  EF_days_per_year: 350,
  ED_years: 30,
  AT_cancer_years: 70,
};

describe('deriveInhalationStandards -- fail-closed gating', () => {
  it('is fully blocked when VF, PEF, RfC, and IUR are all null', () => {
    const result = deriveInhalationStandards({
      ...BASE_VALID,
      volatilization_factor_m3_per_kg: null,
      particulate_emission_factor_m3_per_kg: null,
      rfc_inhalation_mg_per_m3: null,
      iur_inhalation_per_mg_per_m3: null,
    });
    expect(result.blocked).toBe(true);
    expect(result.nonCancerBlocked).toBe(true);
    expect(result.cancerBlocked).toBe(true);
    expect(result.sedS).toBeNull();
    expect(result.nonCancerSedS).toBeNull();
    expect(result.cancerSedS).toBeNull();
    expect(result.airConcentration_mg_per_m3).toBeNull();
    expect(result.vfPefCombined_m3_per_kg).toBeNull();
    expect(result.warnings.some((w) => w.includes('VF and/or PEF must be supplied'))).toBe(
      true,
    );
  });

  it('is blocked when RfC and IUR are both missing even though VF and PEF are supplied', () => {
    const result = deriveInhalationStandards({
      ...BASE_VALID,
      rfc_inhalation_mg_per_m3: null,
      iur_inhalation_per_mg_per_m3: null,
    });
    expect(result.blocked).toBe(true);
    expect(result.nonCancerBlocked).toBe(true);
    expect(result.cancerBlocked).toBe(true);
    expect(result.sedS).toBeNull();
    // Transport factor itself should still resolve (diagnostic), proving the
    // block is specifically a toxicity-value gap, not a transport gap.
    expect(result.vfPefCombined_m3_per_kg).not.toBeNull();
    expect(
      result.warnings.some((w) => w.includes('RfC (non-cancer) not supplied')),
    ).toBe(true);
    expect(result.warnings.some((w) => w.includes('IUR (cancer) not supplied'))).toBe(
      true,
    );
  });

  it('is blocked when VF and PEF are both missing even though RfC and IUR are supplied', () => {
    const result = deriveInhalationStandards({
      ...BASE_VALID,
      volatilization_factor_m3_per_kg: null,
      particulate_emission_factor_m3_per_kg: null,
    });
    expect(result.blocked).toBe(true);
    expect(result.nonCancerBlocked).toBe(true);
    expect(result.cancerBlocked).toBe(true);
    expect(result.sedS).toBeNull();
    expect(result.airConcentration_mg_per_m3).toBeNull();
    expect(result.vfPefCombined_m3_per_kg).toBeNull();
  });

  it('never fabricates a VF or PEF default -- omitting both never yields a numeric transport factor', () => {
    // Regression guard for the owner ruling: no code path may substitute a
    // hardcoded/looked-up VF or PEF. Sweep every other field present/absent and
    // confirm vfPefCombined_m3_per_kg stays null whenever VF and PEF are both null.
    for (const rfc of [null, 0.03]) {
      for (const iur of [null, 0.016]) {
        const result = deriveInhalationStandards({
          ...BASE_VALID,
          volatilization_factor_m3_per_kg: null,
          particulate_emission_factor_m3_per_kg: null,
          rfc_inhalation_mg_per_m3: rfc,
          iur_inhalation_per_mg_per_m3: iur,
        });
        expect(result.vfPefCombined_m3_per_kg).toBeNull();
        expect(result.blocked).toBe(true);
      }
    }
  });

  it('remains blocked when EF is invalid (zero) even with every other input valid', () => {
    const result = deriveInhalationStandards({ ...BASE_VALID, EF_days_per_year: 0 });
    expect(result.blocked).toBe(true);
    expect(result.sedS).toBeNull();
    expect(
      result.warnings.some((w) => w.includes('Exposure frequency (EF) and exposure duration')),
    ).toBe(true);
  });

  it('remains blocked when ED is invalid (negative) even with every other input valid', () => {
    const result = deriveInhalationStandards({ ...BASE_VALID, ED_years: -5 });
    expect(result.blocked).toBe(true);
    expect(result.sedS).toBeNull();
  });

  it('treats a non-finite VF (NaN) as not-supplied and warns, rather than crashing', () => {
    const result = deriveInhalationStandards({
      ...BASE_VALID,
      volatilization_factor_m3_per_kg: Number.NaN,
      particulate_emission_factor_m3_per_kg: null,
      rfc_inhalation_mg_per_m3: null,
      iur_inhalation_per_mg_per_m3: null,
    });
    expect(result.blocked).toBe(true);
    expect(
      result.warnings.some((w) =>
        w.includes('Volatilization factor (VF) was supplied but is not a positive finite number'),
      ),
    ).toBe(true);
  });

  it('treats a negative PEF as not-supplied and warns, rather than silently negating the result', () => {
    const result = deriveInhalationStandards({
      ...BASE_VALID,
      volatilization_factor_m3_per_kg: null,
      particulate_emission_factor_m3_per_kg: -1,
    });
    expect(result.vfPefCombined_m3_per_kg).toBeNull();
    expect(result.blocked).toBe(true);
  });
});

describe('deriveInhalationStandards -- single-route transport (VF-only / PEF-only)', () => {
  it('computes a result from VF alone (PEF null) -- non-cancer endpoint', () => {
    const result = deriveInhalationStandards({
      ...BASE_VALID,
      particulate_emission_factor_m3_per_kg: null,
      iur_inhalation_per_mg_per_m3: null,
    });
    expect(result.blocked).toBe(false);
    expect(result.cancerBlocked).toBe(true);
    expect(result.nonCancerBlocked).toBe(false);
    expect(result.nonCancerSedS).not.toBeNull();
    // 1/VF alone (PEF absent): Cs = THQ * RfC * 365 / (EF / VF) = THQ*RfC*365*VF/EF
    const expected = (1 * 0.03 * 365 * 1.0e4) / 350;
    expect(result.nonCancerSedS as number).toBeCloseTo(expected, 6);
    expect(result.vfPefCombined_m3_per_kg).toBeCloseTo(1.0e4, 6);
  });

  it('computes a result from PEF alone (VF null) -- cancer endpoint', () => {
    const result = deriveInhalationStandards({
      ...BASE_VALID,
      volatilization_factor_m3_per_kg: null,
      rfc_inhalation_mg_per_m3: null,
    });
    expect(result.blocked).toBe(false);
    expect(result.nonCancerBlocked).toBe(true);
    expect(result.cancerBlocked).toBe(false);
    expect(result.cancerSedS).not.toBeNull();
    const expected = (1e-5 * 70 * 365 * 1.36e9) / (350 * 30 * 0.016);
    expect(result.cancerSedS as number).toBeCloseTo(expected, 0);
  });
});

describe('deriveInhalationStandards -- cancer vs non-cancer driver selection', () => {
  it('selects the lower (more protective) of the two endpoints as the driver', () => {
    const result = deriveInhalationStandards(BASE_VALID);
    expect(result.blocked).toBe(false);
    expect(result.nonCancerSedS).not.toBeNull();
    expect(result.cancerSedS).not.toBeNull();
    expect(result.driver).toBe('cancer');
    expect(result.sedS).toBe(result.cancerSedS);
    expect((result.cancerSedS as number) < (result.nonCancerSedS as number)).toBe(true);
  });

  it('drives on non-cancer when RfC-based value is lower than the IUR-based value', () => {
    // Make the cancer endpoint far less restrictive by using a much smaller IUR.
    const result = deriveInhalationStandards({
      ...BASE_VALID,
      iur_inhalation_per_mg_per_m3: 1e-9,
    });
    expect(result.driver).toBe('non-cancer');
    expect(result.sedS).toBe(result.nonCancerSedS);
  });

  it('falls back to the only available endpoint when the other toxicity value is absent (non-cancer only)', () => {
    const result = deriveInhalationStandards({
      ...BASE_VALID,
      iur_inhalation_per_mg_per_m3: null,
    });
    expect(result.blocked).toBe(false);
    expect(result.driver).toBe('non-cancer');
    expect(result.sedS).toBe(result.nonCancerSedS);
    expect(result.cancerBlocked).toBe(true);
  });

  it('falls back to the only available endpoint when the other toxicity value is absent (cancer only)', () => {
    const result = deriveInhalationStandards({
      ...BASE_VALID,
      rfc_inhalation_mg_per_m3: null,
    });
    expect(result.blocked).toBe(false);
    expect(result.driver).toBe('cancer');
    expect(result.sedS).toBe(result.cancerSedS);
    expect(result.nonCancerBlocked).toBe(true);
  });
});

describe('deriveInhalationStandards -- hand-worked example (regression, verified by node arithmetic)', () => {
  // See calculator.ts module header "HAND-WORKED EXAMPLE" for the full derivation.
  // Inputs: VF=1.0e4 m3/kg, PEF=1.36e9 m3/kg, RfC=0.03 mg/m3, IUR=0.016 per mg/m3,
  // TR=1e-5, THQ=1, EF=350 d/yr, ED=30 yr, AT_cancer=70 yr.
  it('matches the hand-worked non-cancer value (~312.85 mg/kg)', () => {
    const result = deriveInhalationStandards(BASE_VALID);
    expect(result.nonCancerSedS as number).toBeCloseTo(312.85484245388943, 5);
  });

  it('matches the hand-worked cancer value (~15.208 mg/kg)', () => {
    const result = deriveInhalationStandards(BASE_VALID);
    expect(result.cancerSedS as number).toBeCloseTo(15.208221508175185, 5);
  });

  it('matches the hand-worked combined VF/PEF transport factor (~9999.93 m3/kg)', () => {
    const result = deriveInhalationStandards(BASE_VALID);
    expect(result.vfPefCombined_m3_per_kg as number).toBeCloseTo(9999.926471128887, 3);
  });

  it('matches the hand-worked forward air-concentration check at the driver value (~0.00152 mg/m3)', () => {
    const result = deriveInhalationStandards(BASE_VALID);
    expect(result.driver).toBe('cancer');
    expect(result.airConcentration_mg_per_m3 as number).toBeCloseTo(
      0.0015208333333333337,
      6,
    );
  });

  it('reports sedS as the driver-selected (cancer, lower) value', () => {
    const result = deriveInhalationStandards(BASE_VALID);
    expect(result.sedS as number).toBeCloseTo(15.208221508175185, 5);
  });
});

describe('deriveInhalationStandards -- unit-basis sanity checks', () => {
  it('scaling VF up (weaker volatilization coupling) increases the non-cancer standard proportionally', () => {
    const base = deriveInhalationStandards({
      ...BASE_VALID,
      particulate_emission_factor_m3_per_kg: null,
      iur_inhalation_per_mg_per_m3: null,
    });
    const doubledVf = deriveInhalationStandards({
      ...BASE_VALID,
      volatilization_factor_m3_per_kg: (BASE_VALID.volatilization_factor_m3_per_kg as number) * 2,
      particulate_emission_factor_m3_per_kg: null,
      iur_inhalation_per_mg_per_m3: null,
    });
    // Cs is linear in VF when PEF is absent (Cs = THQ*RfC*365*VF/EF).
    expect(doubledVf.nonCancerSedS as number).toBeCloseTo(
      (base.nonCancerSedS as number) * 2,
      4,
    );
  });

  it('a larger IUR (more potent carcinogen) yields a lower (more protective) cancer standard', () => {
    const weak = deriveInhalationStandards({ ...BASE_VALID, iur_inhalation_per_mg_per_m3: 0.001 });
    const strong = deriveInhalationStandards({ ...BASE_VALID, iur_inhalation_per_mg_per_m3: 0.1 });
    expect(strong.cancerSedS as number).toBeLessThan(weak.cancerSedS as number);
  });

  it('a larger RfC (less toxic non-cancer effect) yields a higher (less restrictive) non-cancer standard', () => {
    const low = deriveInhalationStandards({ ...BASE_VALID, rfc_inhalation_mg_per_m3: 0.001 });
    const high = deriveInhalationStandards({ ...BASE_VALID, rfc_inhalation_mg_per_m3: 1 });
    expect(high.nonCancerSedS as number).toBeGreaterThan(low.nonCancerSedS as number);
  });

  it('the non-cancer endpoint is independent of ED (AT_noncancer = ED cancellation, per EPA SSL convention)', () => {
    const shortED = deriveInhalationStandards({ ...BASE_VALID, ED_years: 6 });
    const longED = deriveInhalationStandards({ ...BASE_VALID, ED_years: 30 });
    expect(shortED.nonCancerSedS as number).toBeCloseTo(longED.nonCancerSedS as number, 6);
  });

  it('the cancer endpoint DOES depend on ED (no cancellation for the cancer branch)', () => {
    const shortED = deriveInhalationStandards({ ...BASE_VALID, ED_years: 6 });
    const longED = deriveInhalationStandards({ ...BASE_VALID, ED_years: 30 });
    expect(shortED.cancerSedS as number).not.toBeCloseTo(longED.cancerSedS as number, 3);
    // Shorter ED means less cumulative exposure for the same annual pattern, so the
    // risk-based screening concentration is LESS restrictive (higher).
    expect(shortED.cancerSedS as number).toBeGreaterThan(longED.cancerSedS as number);
  });

  it('surfaces the medium-basis (soil vs sediment) caveat whenever a result is computed', () => {
    const result = deriveInhalationStandards(BASE_VALID);
    expect(result.blocked).toBe(false);
    expect(result.warnings.some((w) => w.includes('Medium-basis caveat'))).toBe(true);
  });

  it('does not surface the medium-basis caveat when fully blocked', () => {
    const result = deriveInhalationStandards({
      ...BASE_VALID,
      volatilization_factor_m3_per_kg: null,
      particulate_emission_factor_m3_per_kg: null,
    });
    expect(result.warnings.some((w) => w.includes('Medium-basis caveat'))).toBe(false);
  });
});
