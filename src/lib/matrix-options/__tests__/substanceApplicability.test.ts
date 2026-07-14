import { describe, it, expect } from 'vitest';
import { getSubstanceApplicability } from '../substanceApplicability';
import { findSubstance } from '../substanceLibrary';
import { DEFAULT_REGULATORY_FRAME_ID } from '../regulatoryFrames';

describe('getSubstanceApplicability', () => {
  it('handles unknown substance', () => {
    const res = getSubstanceApplicability('unknown_xyz', DEFAULT_REGULATORY_FRAME_ID);
    expect(res['human-health-direct'].state).toBe('missing-input');
    expect(res['human-health-direct'].reason).toBe('Unknown substance.');
    expect(res['human-health-food'].state).toBe('missing-input');
    expect(res['eco-direct-eqp'].state).toBe('missing-input');
    expect(res['eco-food-bsaf'].state).toBe('missing-input');
    
    expect(Object.keys(res)).toEqual([
      'human-health-direct',
      'human-health-food',
      'eco-direct-eqp',
      'eco-food-bsaf',
    ]);
  });

  it('handles a dormant metal like nickel (missing HH input; EqP not-applicable for class)', () => {
    // nickel is still dormant (unwired rfd/sf); chromium_trivalent/barium were wired 2026-07-04b.
    const s = findSubstance('nickel');
    expect(s).toBeDefined();
    expect(s?.logKow).toBeNull();
    expect(s?.rfd_oral_mg_per_kg_bw_per_day).toBeNull();

    const res = getSubstanceApplicability('nickel', DEFAULT_REGULATORY_FRAME_ID);
    expect(res['human-health-direct'].state).toBe('missing-input');
    expect(res['human-health-food'].state).toBe('missing-input');
    expect(res['eco-direct-eqp'].state).toBe('not-applicable-for-class');
  });

  it('marks a wired metal (chromium_trivalent 0.3) HH-computable but EqP not-applicable-for-class', () => {
    const s = findSubstance('chromium_trivalent');
    expect(s?.rfd_oral_mg_per_kg_bw_per_day).toBe(0.3);
    expect(s?.logKow).toBeNull();
    const res = getSubstanceApplicability('chromium_trivalent', DEFAULT_REGULATORY_FRAME_ID);
    expect(res['human-health-direct'].state).toBe('computable');
    expect(res['human-health-food'].state).toBe('computable');
    expect(res['eco-direct-eqp'].state).toBe('not-applicable-for-class');
  });

  it('handles a wired organic with logKow and rfd (e.g. benzene)', () => {
    const s = findSubstance('benzene');
    expect(s).toBeDefined();
    expect(s?.logKow).not.toBeNull();
    expect(s?.rfd_oral_mg_per_kg_bw_per_day).not.toBeNull();

    const res = getSubstanceApplicability('benzene', DEFAULT_REGULATORY_FRAME_ID);
    expect(res['human-health-direct'].state).toBe('computable');
    expect(res['eco-direct-eqp'].state).toBe('computable');
  });

  it('handles benzo_a_pyrene (organic-PAH, sf non-null, rfd non-null / wired)', () => {
    const s = findSubstance('benzo_a_pyrene');
    expect(s).toBeDefined();
    expect(s?.logKow).not.toBeNull();
    expect(s?.sf_oral_per_mg_per_kg_bw_per_day).not.toBeNull();
    expect(s?.rfd_oral_mg_per_kg_bw_per_day).toBe(0.0003);

    const res = getSubstanceApplicability('benzo_a_pyrene', DEFAULT_REGULATORY_FRAME_ID);
    expect(res['human-health-direct'].state).toBe('computable');
    expect(res['eco-direct-eqp'].state).toBe('computable');
  });

  it('handles an unsupported frame case', () => {
    const res = getSubstanceApplicability('benzene', 'bc-csr-sediment-numerical');
    expect(res['eco-food-bsaf'].state).toBe('hidden-by-frame');
    expect(res['eco-food-bsaf'].reason).toBe('Not applicable under the selected regulatory frame.');
  });
});
