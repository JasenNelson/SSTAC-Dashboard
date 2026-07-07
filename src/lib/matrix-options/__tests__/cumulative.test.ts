import { describe, it, expect } from 'vitest';

import {
  computeTEQ,
  computeBaPeq,
  compareEquivalentToStandard,
  normalizeConcentration,
  resolveTefEdition,
  authorityForFrame,
  RPF_SCHEME_BY_AUTHORITY,
  CANONICAL_UNIT,
} from '../cumulative';

// Anchor cases use HAND-COMPUTED expected values (not "whatever it returns").
// pg/g = 1e-6 mg/kg; ug/kg = 1e-3 mg/kg; ug/g = mg/kg = 1.

describe('normalizeConcentration -- mass/mass only, canonical mg/kg', () => {
  it('converts the standard reporting units to mg/kg', () => {
    expect(normalizeConcentration(1, 'mg/kg').valueMgPerKg).toBeCloseTo(1, 12);
    expect(normalizeConcentration(1, 'ug/kg').valueMgPerKg).toBeCloseTo(1e-3, 15);
    expect(normalizeConcentration(1, 'ug/g').valueMgPerKg).toBeCloseTo(1, 12); // ug/g = mg/kg = ppm
    expect(normalizeConcentration(1, 'pg/g').valueMgPerKg).toBeCloseTo(1e-6, 18);
    expect(normalizeConcentration(1, 'ng/kg').valueMgPerKg).toBeCloseTo(1e-6, 18);
    expect(normalizeConcentration(1, 'mg/g').valueMgPerKg).toBeCloseTo(1e3, 9);
  });

  it('BLOCKS volume-based units (mass/mass media only)', () => {
    const r = normalizeConcentration(1, 'ug/L');
    expect(r.blocked).toBe(true);
    expect(r.valueMgPerKg).toBeNull();
    expect(r.warning).toMatch(/volume-based/i);
  });

  it('BLOCKS a missing or unrecognized unit (never silently coerces)', () => {
    expect(normalizeConcentration(1, '').blocked).toBe(true);
    expect(normalizeConcentration(1, 'widgets').blocked).toBe(true);
    expect(normalizeConcentration(Number.NaN, 'mg/kg').blocked).toBe(true);
  });
});

describe('computeTEQ -- WHO-2005 anchor case', () => {
  it('sums C_i * TEF_i to a hand-computed TEQ', () => {
    // TCDD 10 pg/g (TEF 1.0) + PCB-126 100 pg/g (TEF 0.1) + OCDD 1000 pg/g (TEF 0.0003).
    // 10 pg/g = 1e-5 mg/kg -> 1e-5 ; 100 pg/g = 1e-4 -> 1e-5 ; 1000 pg/g = 1e-3 -> 3e-7.
    // TEQ = 1e-5 + 1e-5 + 3e-7 = 2.03e-5 mg/kg.
    const res = computeTEQ(
      [
        { congenerId: '2378-tcdd', concentration: 10, unit: 'pg/g' },
        { congenerId: 'pcb-126', concentration: 100, unit: 'pg/g' },
        { congenerId: 'ocdd', concentration: 1000, unit: 'pg/g' },
      ],
      'who-2005',
    );
    expect(res.blocked).toBe(false);
    expect(res.equivalentUnit).toBe(CANONICAL_UNIT);
    expect(res.equivalent).toBeCloseTo(2.03e-5, 12);
    expect(res.contributions).toHaveLength(3);
  });

  it('handles MIXED units by normalizing before summing', () => {
    // TCDD 1000 pg/g (=1e-3 mg/kg, TEF 1.0) + PCB-126 1 ug/kg (=1e-3 mg/kg, TEF 0.1).
    // TEQ = 1e-3 + 1e-4 = 1.1e-3.
    const res = computeTEQ(
      [
        { congenerId: '2378-tcdd', concentration: 1000, unit: 'pg/g' },
        { congenerId: 'pcb-126', concentration: 1, unit: 'ug/kg' },
      ],
      'who-2005',
    );
    expect(res.equivalent).toBeCloseTo(1.1e-3, 12);
  });

  it('non-detect uses 0.5 * MDL by default', () => {
    // TCDD non-detect, MDL 4 pg/g -> 2 pg/g = 2e-6 mg/kg * TEF 1.0 = 2e-6.
    const res = computeTEQ(
      [{ congenerId: '2378-tcdd', concentration: 0, unit: 'pg/g', isNonDetect: true, mdl: 4, mdlUnit: 'pg/g' }],
      'who-2005',
    );
    expect(res.equivalent).toBeCloseTo(2e-6, 15);
  });

  it('surfaces a censored upper-bound TEF as a warning', () => {
    const res = computeTEQ(
      [{ congenerId: 'ocdd', concentration: 1000, unit: 'pg/g' }],
      'who-1998-avian', // OCDD avian is a censored "<0.0001"
    );
    expect(res.warnings.some((w) => /upper bound/i.test(w))).toBe(true);
  });

  it('fails closed on empty input (blocked, warning) -- not a silent 0 pass', () => {
    const res = computeTEQ([], 'who-2005');
    expect(res.blocked).toBe(true);
    expect(res.warnings.length).toBeGreaterThan(0);
    // the edition-QA warning must survive the empty-input fail-closed path (codex)
    expect(res.warnings.some((w) => /needs_review/i.test(w))).toBe(true);
  });

  it('fails closed on an unknown congener (component not summed)', () => {
    const res = computeTEQ(
      [{ congenerId: 'not-real', concentration: 100, unit: 'pg/g' }],
      'who-2005',
    );
    expect(res.blocked).toBe(true);
    expect(res.warnings.some((w) => /unknown congener/i.test(w))).toBe(true);
    // the row is recorded but never contributes
    expect(res.contributions[0].contribution).toBeNull();
  });

  it('blocks a component whose unit is volume-based (never mis-normalized)', () => {
    const res = computeTEQ(
      [{ congenerId: '2378-tcdd', concentration: 5, unit: 'ug/L' }],
      'who-2005',
    );
    expect(res.warnings.some((w) => /volume-based/i.test(w))).toBe(true);
    expect(res.blocked).toBe(true);
  });

  it('BLOCKS a PARTIAL TEQ where one congener scores and another is skipped (P1 fail-closed)', () => {
    // A valid TCDD plus an unknown congener: the sum is an underestimate -> must be blocked, not
    // returned as a complete standard.
    const res = computeTEQ(
      [
        { congenerId: '2378-tcdd', concentration: 100, unit: 'pg/g' },
        { congenerId: 'not-real', concentration: 100, unit: 'pg/g' },
      ],
      'who-2005',
    );
    expect(res.blocked).toBe(true);
    expect(res.warnings.some((w) => /underestimate/i.test(w))).toBe(true);
    // the partial sum is still exposed for transparency, but blocked prevents its use as complete
    expect(res.equivalent).toBeGreaterThan(0);
  });

  it('BLOCKS a negative concentration (never offsets valid contributions)', () => {
    const res = computeTEQ(
      [{ congenerId: '2378-tcdd', concentration: -5, unit: 'pg/g' }],
      'who-2005',
    );
    expect(res.blocked).toBe(true);
    expect(res.warnings.some((w) => /negative/i.test(w))).toBe(true);
  });

  it('surfaces a needs_review warning for a non-HC (needs_review) TEF edition', () => {
    const res = computeTEQ(
      [{ congenerId: '2378-tcdd', concentration: 10, unit: 'pg/g' }],
      'who-2005',
    );
    expect(res.warnings.some((w) => /needs_review/i.test(w))).toBe(true);
  });

  it('the primary-verified DeVito-2024 edition does NOT emit a needs_review warning', () => {
    const res = computeTEQ(
      [{ congenerId: '2378-tcdd', concentration: 10, unit: 'pg/g' }],
      'who-2022-devito-2024',
    );
    expect(res.warnings.some((w) => /needs_review/i.test(w))).toBe(false);
  });
});

describe('computeBaPeq -- hc-pqra-v3 anchor case', () => {
  it('sums C_i * RPF_i to a hand-computed BaP-eq', () => {
    // BaP 1 mg/kg (1.0) + BaA 2 mg/kg (0.1) + chrysene 10 mg/kg (0.01) = 1.0 + 0.2 + 0.1 = 1.3.
    const res = computeBaPeq(
      [
        { pahKey: 'benzo_a_pyrene', concentration: 1, unit: 'mg/kg' },
        { pahKey: 'benz_a_anthracene', concentration: 2, unit: 'mg/kg' },
        { pahKey: 'chrysene', concentration: 10, unit: 'mg/kg' },
      ],
      'hc-pqra-v3',
    );
    expect(res.equivalent).toBeCloseTo(1.3, 12);
  });

  it('excluded PAH contributes 0 with an informational warning (not silently dropped)', () => {
    const res = computeBaPeq(
      [
        { pahKey: 'benzo_a_pyrene', concentration: 1, unit: 'mg/kg' },
        { pahKey: 'naphthalene', concentration: 100, unit: 'mg/kg' }, // excluded
      ],
      'hc-pqra-v3',
    );
    expect(res.equivalent).toBeCloseTo(1.0, 12); // naphthalene adds 0
    expect(res.warnings.some((w) => /excluded/i.test(w))).toBe(true);
  });

  it('applies ADAF when requested (age-binned multiplier)', () => {
    // BaP 1 mg/kg * RPF 1.0 * ADAF 10 (age 1) = 10.
    const res = computeBaPeq(
      [{ pahKey: 'benzo_a_pyrene', concentration: 1, unit: 'mg/kg' }],
      'hc-pqra-v3',
      { applyAdaf: true, ageYears: 1 },
    );
    expect(res.equivalent).toBeCloseTo(10, 12);
    expect(res.warnings.some((w) => /ADAF 10/.test(w))).toBe(true);
    // The ADAF warning reminds the caller not to double-count if the anchor SF already embeds ADAFs.
    expect(res.warnings.some((w) => /not already ADAF-adjusted/i.test(w))).toBe(true);
  });

  it('BLOCKS scoring for the BC who-1998-pah placeholder scheme (over-sum risk, framework-A2 pending)', () => {
    const res = computeBaPeq(
      [{ pahKey: 'benzo_a_pyrene', concentration: 1, unit: 'mg/kg' }],
      'who-1998-pah',
    );
    // A warning alone is not enough for a screening tool -- the result must be blocked so a caller
    // that ignores warnings cannot ship an over-summed BaP-eq.
    expect(res.blocked).toBe(true);
    expect(res.equivalent).toBe(0);
    expect(res.warnings.some((w) => /not verified for scoring|framework-A2/i.test(w))).toBe(true);
  });

  it('all-excluded PAHs is a VALID BaP-eq of 0 (not blocked) -- excluded != skipped', () => {
    const res = computeBaPeq(
      [
        { pahKey: 'naphthalene', concentration: 100, unit: 'mg/kg' },
        { pahKey: 'fluorene', concentration: 50, unit: 'mg/kg' },
      ],
      'hc-pqra-v3',
    );
    expect(res.blocked).toBe(false);
    expect(res.equivalent).toBe(0);
  });

  it('under a group scheme, the COMBINED benzo[b+j+k] key scores once (no over-count)', () => {
    // ccme-2010 defines ONE PEF 0.1 for benzo[b+j+k]fluoranthene. BaP 1.0 + bjk 3 mg/kg * 0.1 = 1.3.
    const res = computeBaPeq(
      [
        { pahKey: 'benzo_a_pyrene', concentration: 1, unit: 'mg/kg' },
        { pahKey: 'benzo_bjk_fluoranthene', concentration: 3, unit: 'mg/kg' },
      ],
      'ccme-2010',
    );
    expect(res.blocked).toBe(false);
    expect(res.equivalent).toBeCloseTo(1.3, 12);
  });

  it('under a group scheme, an INDIVIDUAL benzo[b] fails closed (prevents the 3x over-count)', () => {
    // Entering benzo_b (or j/k) separately under ccme-2010 must NOT score 0.1 each -- it is not-defined
    // there, so the reducer blocks (forcing the combined benzo_bjk key). Guards the over-count bug.
    const res = computeBaPeq(
      [
        { pahKey: 'benzo_a_pyrene', concentration: 1, unit: 'mg/kg' },
        { pahKey: 'benzo_b_fluoranthene', concentration: 3, unit: 'mg/kg' },
      ],
      'ccme-2010',
    );
    expect(res.blocked).toBe(true);
    expect(res.warnings.some((w) => /no rpf defined|not scored/i.test(w))).toBe(true);
  });

  it('under nisbet-1992, individual benzo[b]/benzo[k] ARE scored per-isomer (not a group there)', () => {
    // BaP 1.0 + benzo_b 2*0.1 + benzo_k 3*0.1 = 1.0 + 0.2 + 0.3 = 1.5.
    const res = computeBaPeq(
      [
        { pahKey: 'benzo_a_pyrene', concentration: 1, unit: 'mg/kg' },
        { pahKey: 'benzo_b_fluoranthene', concentration: 2, unit: 'mg/kg' },
        { pahKey: 'benzo_k_fluoranthene', concentration: 3, unit: 'mg/kg' },
      ],
      'nisbet-1992',
    );
    expect(res.blocked).toBe(false);
    expect(res.equivalent).toBeCloseTo(1.5, 12);
  });

  it('BLOCKS when a valid PAH is mixed with a not-defined PAH (underestimate)', () => {
    const res = computeBaPeq(
      [
        { pahKey: 'benzo_a_pyrene', concentration: 1, unit: 'mg/kg' },
        { pahKey: 'cyclopenta_cd_pyrene', concentration: 5, unit: 'mg/kg' }, // not-defined under nisbet
      ],
      'nisbet-1992',
    );
    expect(res.blocked).toBe(true);
    expect(res.warnings.some((w) => /underestimate/i.test(w))).toBe(true);
  });

  it('BLOCKS an ADAF request with a missing age (never silently uses ADAF = 1)', () => {
    const res = computeBaPeq(
      [{ pahKey: 'benzo_a_pyrene', concentration: 1, unit: 'mg/kg' }],
      'hc-pqra-v3',
      { applyAdaf: true }, // ageYears omitted
    );
    expect(res.blocked).toBe(true);
    expect(res.warnings.some((w) => /ADAF requested but/i.test(w))).toBe(true);
  });
});

describe('compareEquivalentToStandard -- dimensional contract (D1)', () => {
  it('PASS when the equivalent is at or below the mass/mass standard', () => {
    const r = compareEquivalentToStandard(
      { value: 2.03e-5, unit: 'mg/kg' },
      { value: 1e-4, unit: 'mg/kg' },
    );
    expect(r.blocked).toBe(false);
    expect(r.verdict).toBe('PASS');
    expect(r.marginRatio).toBeCloseTo(0.203, 6);
  });

  it('FAIL when the equivalent exceeds the standard', () => {
    const r = compareEquivalentToStandard(
      { value: 2.03e-5, unit: 'mg/kg' },
      { value: 1e-5, unit: 'mg/kg' },
    );
    expect(r.verdict).toBe('FAIL');
    expect(r.marginRatio).toBeGreaterThan(1);
  });

  it('BLOCKS a raw dose TDI standard (dimensionally incomparable to a concentration)', () => {
    const r = compareEquivalentToStandard(
      { value: 2.03e-5, unit: 'mg/kg' },
      { value: 2.3e-9, unit: 'mg/kg-bw/day' },
    );
    expect(r.blocked).toBe(true);
    expect(r.warning).toMatch(/dose|slope|screening standard/i);
  });

  it('BLOCKS a slope-factor standard', () => {
    const r = compareEquivalentToStandard(
      { value: 1, unit: 'mg/kg' },
      { value: 1.289, unit: '(mg/kgBW-day)-1' },
    );
    expect(r.blocked).toBe(true);
  });

  it('normalizes both sides before comparing (mixed mass/mass units)', () => {
    // equivalent 1000 ug/kg = 1 mg/kg vs standard 1 mg/kg -> PASS (equal).
    const r = compareEquivalentToStandard(
      { value: 1000, unit: 'ug/kg' },
      { value: 1, unit: 'mg/kg' },
    );
    expect(r.verdict).toBe('PASS');
    expect(r.marginRatio).toBeCloseTo(1, 9);
  });
});

describe('edition / scheme / authority selection', () => {
  it('resolveTefEdition is receptor-aware (HC-HH -> DeVito; CCME eco -> taxa)', () => {
    expect(resolveTefEdition('hc', 'human-health')).toBe('who-2022-devito-2024');
    expect(resolveTefEdition('bc-csr', 'human-health')).toBe('who-2005');
    expect(resolveTefEdition('us-epa', 'human-health')).toBe('who-2005');
    expect(resolveTefEdition('ontario', 'human-health')).toBe('who-2005');
    expect(resolveTefEdition('ccme', 'human-health')).toBe('who-1998-mammal');
    expect(resolveTefEdition('ccme', 'avian')).toBe('who-1998-avian');
    expect(resolveTefEdition('fcsap', 'fish')).toBe('who-1998-fish');
    expect(resolveTefEdition('fcsap', 'mammal')).toBe('who-1998-mammal');
  });

  it('RPF_SCHEME_BY_AUTHORITY covers the 5 human-health authorities (fcsap excluded by type)', () => {
    expect(RPF_SCHEME_BY_AUTHORITY.hc).toBe('hc-pqra-v3');
    // D4 (owner-approved, 2026-07-07): BC TG-7 (2017) remap -- bc-csr -> ccme-2010, not who-1998-pah.
    expect(RPF_SCHEME_BY_AUTHORITY['bc-csr']).toBe('ccme-2010');
    expect(RPF_SCHEME_BY_AUTHORITY.ccme).toBe('ccme-2010');
    expect(RPF_SCHEME_BY_AUTHORITY['us-epa']).toBe('epa-2010-draft');
    expect(RPF_SCHEME_BY_AUTHORITY.ontario).toBe('ccme-2010');
  });

  it('authorityForFrame bridges the existing sediment frames', () => {
    expect(authorityForFrame('us-epa-usace-sediment')).toBe('us-epa');
    expect(authorityForFrame('ccme-sediment-quality')).toBe('ccme');
    expect(authorityForFrame('bc-protocol1-v5-dra')).toBe('bc-csr');
    expect(authorityForFrame('bc-csr-sediment-numerical')).toBe('bc-csr');
    expect(authorityForFrame('canada-fcsap-aquatic')).toBe('fcsap');
    expect(authorityForFrame('site-specific')).toBeNull();
  });
});
