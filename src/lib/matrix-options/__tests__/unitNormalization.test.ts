import { describe, expect, it } from 'vitest';

import {
  assessSlotUnitConsistency,
  normalizeToBase,
} from '../unitNormalization';

describe('normalizeToBase', () => {
  it('normalizes inhalation RfC mg/m3 and ug/m3 to the same base value (beryllium case)', () => {
    const mg = normalizeToBase('2e-05', 'mg/m3', 'inhalation_rfc');
    const ug = normalizeToBase('2E-2', 'ug/m3', 'inhalation_rfc');
    expect(mg).toEqual({ value: 2e-5, baseUnit: 'mg/m3' });
    // 2E-2 ug/m3 = 2e-2 * 1e-3 mg/m3 = 2e-5 mg/m3 -- identical to the mg/m3 value
    expect(ug).not.toBeNull();
    expect(ug!.baseUnit).toBe('mg/m3');
    expect(ug!.value).toBeCloseTo(2e-5, 12);
  });

  it('normalizes inhalation unit risk across reciprocal bases (benzene IUR case)', () => {
    const perUg = normalizeToBase('7.8e-6', 'per ug/m3', 'inhalation_unit_risk');
    const perMg = normalizeToBase('1.6E-02', '(mg/m3)-1', 'inhalation_unit_risk');
    expect(perUg).not.toBeNull();
    expect(perUg!.baseUnit).toBe('(mg/m3)-1');
    // 7.8e-6 per ug/m3 = 7.8e-6 * 1000 per mg/m3 = 7.8e-3 (mg/m3)-1
    expect(perUg!.value).toBeCloseTo(7.8e-3, 9);
    expect(perMg).toEqual({ value: 1.6e-2, baseUnit: '(mg/m3)-1' });
  });

  it('normalizes oral RfD mg/kg-d variants and ug/kg-day to one base', () => {
    expect(normalizeToBase('3.0e-4', 'mg/kg-bw/day')!.baseUnit).toBe('mg/kg-d');
    expect(normalizeToBase('3.0e-4', 'mg/kgBW-day')!.baseUnit).toBe('mg/kg-d');
    const ug = normalizeToBase('0.06', 'ug/kg-day');
    expect(ug!.baseUnit).toBe('mg/kg-d');
    expect(ug!.value).toBeCloseTo(6e-5, 12); // 0.06 ug/kg-d = 6e-5 mg/kg-d
  });

  it('normalizes oral slope factor (reciprocal dose) to per mg/kg-d', () => {
    const r = normalizeToBase('1.5', 'per mg/kg-bw/day', 'oral_slope_factor');
    expect(r).toEqual({ value: 1.5, baseUnit: '(mg/kg-d)-1' });
  });

  it('passes dimensionless TEF/RPF through unchanged', () => {
    expect(normalizeToBase('0.1', 'dimensionless')).toEqual({
      value: 0.1,
      baseUnit: 'dimensionless',
    });
  });

  it('FAILS CLOSED on unrecognized units and unparseable values', () => {
    expect(normalizeToBase('1.0', 'not provided by current calculator')).toBeNull();
    expect(normalizeToBase('5', 'mol/L')).toBeNull(); // unrecognized dimension
    expect(normalizeToBase('not provided by current calculator', 'mg/m3')).toBeNull();
    expect(normalizeToBase('0x10', 'mg/kg-d')).toBeNull(); // non-decimal value rejected
  });

  it('FAILS CLOSED on a blank/missing unit (not silently dimensionless)', () => {
    expect(normalizeToBase('1.0', '')).toBeNull();
    expect(normalizeToBase('1.0', '   ')).toBeNull();
  });

  it('does NOT match the g inside kg (rejects kg/day rather than reading it as grams)', () => {
    // numerator 'kg' is not a valid mass prefix -> fail closed, no spurious x1000
    expect(normalizeToBase('1.0', 'kg/day')).toBeNull();
  });

  // Candidate 10: g (1e3) and ng (1e-6) mass-prefix factors are never exercised
  // by any existing test. g is the LARGEST factor in MASS_PREFIX_TO_MG; ng the smallest.
  // A mis-set g or ng, or a broken reciprocal inversion for a g-based slope factor,
  // would silently scale a regulatory TRV by up to 1000x and mis-rank the slot --
  // exactly the defect class this module exists to prevent.
  it('Candidate 10: g/m3 forward air concentration normalizes to mg/m3 with factor 1000', () => {
    // 1.0 g/m3 = 1000 mg/m3
    const result = normalizeToBase('1.0', 'g/m3');
    expect(result).not.toBeNull();
    expect(result!.baseUnit).toBe('mg/m3');
    expect(result!.value).toBeCloseTo(1000, 10);
  });

  it('Candidate 10: per g/kg-d reciprocal slope factor normalizes correctly (inverse of 1e3)', () => {
    // 'per g/kg-d' is a reciprocal dose unit -> factorToBase = 1 / 1e3 = 1e-3
    // 1.0 per g/kg-d = 0.001 per mg/kg-d = 0.001 (mg/kg-d)-1
    const result = normalizeToBase('1.0', 'per g/kg-d');
    expect(result).not.toBeNull();
    expect(result!.baseUnit).toBe('(mg/kg-d)-1');
    expect(result!.value).toBeCloseTo(1e-3, 12);
  });

  it('Candidate 10: ng/m3 air concentration normalizes to mg/m3 with factor 1e-6', () => {
    // 1000 ng/m3 = 1000 * 1e-6 mg/m3 = 0.001 mg/m3
    const result = normalizeToBase('1000', 'ng/m3');
    expect(result).not.toBeNull();
    expect(result!.baseUnit).toBe('mg/m3');
    expect(result!.value).toBeCloseTo(1e-3, 12);
  });

  it('Candidate 10: g/m3 and mg/m3 for the same quantity normalize to the same base value', () => {
    // 0.001 g/m3 and 1.0 mg/m3 must be equal in base units.
    const fromG = normalizeToBase('0.001', 'g/m3');
    const fromMg = normalizeToBase('1.0', 'mg/m3');
    expect(fromG).not.toBeNull();
    expect(fromMg).not.toBeNull();
    expect(fromG!.baseUnit).toBe(fromMg!.baseUnit);
    expect(fromG!.value).toBeCloseTo(fromMg!.value, 12);
  });
});

describe('assessSlotUnitConsistency', () => {
  it('marks a mg/m3 + ug/m3 RfC slot comparable (same base after normalization)', () => {
    const c = assessSlotUnitConsistency([
      { value: '2e-05', unit: 'mg/m3', input_key: 'inhalation_rfc' },
      { value: '2E-2', unit: 'ug/m3', input_key: 'inhalation_rfc' },
    ]);
    expect(c.allNormalizable).toBe(true);
    expect(c.baseUnits).toEqual(['mg/m3']);
    expect(c.comparable).toBe(true);
  });

  it('marks a slot NON-comparable (fail closed) when any unit is unrecognized', () => {
    const c = assessSlotUnitConsistency([
      { value: '2e-05', unit: 'mg/m3' },
      { value: '1.0', unit: 'not provided by current calculator' },
    ]);
    expect(c.allNormalizable).toBe(false);
    expect(c.comparable).toBe(false);
  });

  it('marks a slot NON-comparable when forward and reciprocal bases mix', () => {
    const c = assessSlotUnitConsistency([
      { value: '2e-05', unit: 'mg/m3' }, // air forward
      { value: '1.6e-2', unit: '(mg/m3)-1' }, // air reciprocal
    ]);
    expect(c.baseUnits.length).toBe(2);
    expect(c.homogeneousBase).toBe(false);
    expect(c.comparable).toBe(false);
  });
});
