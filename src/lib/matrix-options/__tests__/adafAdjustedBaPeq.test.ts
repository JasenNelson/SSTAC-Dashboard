import { describe, it, expect } from 'vitest';
import { computeBaPeqAgeAdjusted } from '../adafAdjustedBaPeq';
import { computeBaPeq } from '../cumulative';

describe('computeBaPeqAgeAdjusted (opt-in single-bin ADAF)', () => {
  it('DEFAULT path unchanged: the helper is distinct; calling computeBaPeq directly has no ADAF', () => {
    const res = computeBaPeq(
      [{ pahKey: 'benzo_a_pyrene', concentration: 1, unit: 'mg/kg' }],
      'hc-pqra-v3'
    );
    expect(res.equivalent).toBeCloseTo(1.0, 12);
    expect(res.warnings.some((w) => /ADAF/.test(w))).toBe(false);
  });

  it('applies the correct single-bin ADAF: ageYears=1 -> 10, ageYears=5 -> 3, ageYears=20 -> 1', () => {
    const toddler = computeBaPeqAgeAdjusted(
      [{ pahKey: 'benzo_a_pyrene', concentration: 1, unit: 'mg/kg' }],
      'hc-pqra-v3',
      1
    );
    const child = computeBaPeqAgeAdjusted(
      [{ pahKey: 'benzo_a_pyrene', concentration: 1, unit: 'mg/kg' }],
      'hc-pqra-v3',
      5
    );
    const adult = computeBaPeqAgeAdjusted(
      [{ pahKey: 'benzo_a_pyrene', concentration: 1, unit: 'mg/kg' }],
      'hc-pqra-v3',
      20
    );

    expect(toddler.equivalent).toBeCloseTo(10, 12);
    expect(child.equivalent).toBeCloseTo(3, 12);
    expect(adult.equivalent).toBeCloseTo(1, 12);

    expect(toddler.warnings.some((w) => /ADAF 10/.test(w))).toBe(true);
    expect(toddler.warnings.some((w) => /not already ADAF-adjusted/i.test(w))).toBe(true);

    expect(child.warnings.some((w) => /ADAF 3/.test(w))).toBe(true);
    expect(adult.warnings.some((w) => /ADAF 1/.test(w))).toBe(true);
  });

  it('fail-closed: negative or NaN ageYears results in blocked output', () => {
    const invalidAge = computeBaPeqAgeAdjusted(
      [{ pahKey: 'benzo_a_pyrene', concentration: 1, unit: 'mg/kg' }],
      'hc-pqra-v3',
      -5
    );
    expect(invalidAge.blocked).toBe(true);
    expect(invalidAge.warnings.some((w) => /ADAF requested but/i.test(w))).toBe(true);

    const nanAge = computeBaPeqAgeAdjusted(
      [{ pahKey: 'benzo_a_pyrene', concentration: 1, unit: 'mg/kg' }],
      'hc-pqra-v3',
      Number.NaN
    );
    expect(nanAge.blocked).toBe(true);
  });
});
