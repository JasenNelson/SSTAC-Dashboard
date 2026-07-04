// Integration tests for resolveEcoSeed against the REAL wired catalog (eco_values.json is wired in
// Step 2). Covers: positive substance-aware seed, source-priority tie-break (ESB over NRWQC), receptor
// selection (mammal vs bird), the frame applicability guard (reference_only / unsupported -> null), the
// jurisdiction gate (-> null), and the provisional flag. Plain ASCII only.
import { describe, it, expect } from 'vitest';
import { resolveEcoSeed } from '../ecoSeed';

describe('resolveEcoSeed -- real wired catalog', () => {
  it('seeds eco-direct fcv from the catalog for a frame+substance (approved -> not provisional)', () => {
    // bc-protocol1-v5-dra: eco-direct benzene, US_federal jurisdiction eligible. The benzene ESB row
    // was HITL-promoted to approved (Step-6 4B), so provisional is now false (the seed still resolves).
    const seed = resolveEcoSeed(
      'benzene',
      'eco-direct-eqp',
      'fcv_ug_per_L',
      'bc-protocol1-v5-dra',
    );
    expect(seed).not.toBeNull();
    expect(seed?.value).toBe(130);
    expect(seed?.unit).toBe('ug/L');
    expect(seed?.parameterValueId).toBe('pv-eco-benzene-direct-fcv-esb');
    expect(seed?.provisional).toBe(false);
  });

  it('breaks a multi-source eco-direct tie toward the preferred source (ESB over NRWQC)', () => {
    // diazinon has ESB 0.1699 + NRWQC 0.17 (both US_federal); ESB is preferred.
    const seed = resolveEcoSeed(
      'diazinon',
      'eco-direct-eqp',
      'fcv_ug_per_L',
      'bc-protocol1-v5-dra',
    );
    expect(seed?.parameterValueId).toBe('pv-eco-diazinon-direct-fcv-esb');
    expect(seed?.value).toBe(0.1699);
  });

  it('selects the receptor-specific eco-food TRV (mammal vs bird)', () => {
    const mammal = resolveEcoSeed(
      'arsenic_inorganic',
      'eco-food-bsaf',
      'trv_eco_mg_per_kg_bw_day',
      'canada-fcsap-aquatic',
      'mammal',
    );
    const bird = resolveEcoSeed(
      'arsenic_inorganic',
      'eco-food-bsaf',
      'trv_eco_mg_per_kg_bw_day',
      'canada-fcsap-aquatic',
      'bird',
    );
    expect(mammal?.value).toBe(1.04);
    expect(mammal?.parameterValueId).toBe(
      'pv-eco-arsenic_inorganic-food-trveco-mammal-fcsap',
    );
    expect(bird?.value).toBe(4.4);
    expect(bird?.parameterValueId).toBe(
      'pv-eco-arsenic_inorganic-food-trveco-bird-fcsap',
    );
  });

  it('selects the receptor-specific methylmercury eco-food TRV (CCME, approved)', () => {
    // MeHg wildlife TDIs from CCME 2000 (live-verified 2026-07-03): mammal 0.022, bird 0.031
    // mg/kg-bw/day (22 / 31 ug/kg-bw/day). Rows were HITL-promoted to approved (2026-07-03,
    // J. Nelson, promote-eco-source.mjs --apply), so provisional is now false.
    const mammal = resolveEcoSeed(
      'methylmercury',
      'eco-food-bsaf',
      'trv_eco_mg_per_kg_bw_day',
      'canada-fcsap-aquatic',
      'mammal',
    );
    const bird = resolveEcoSeed(
      'methylmercury',
      'eco-food-bsaf',
      'trv_eco_mg_per_kg_bw_day',
      'canada-fcsap-aquatic',
      'bird',
    );
    expect(mammal?.value).toBe(0.022);
    expect(mammal?.parameterValueId).toBe(
      'pv-eco-methylmercury-food-trveco-mammal-ccmetrg',
    );
    expect(mammal?.provisional).toBe(false);
    expect(bird?.value).toBe(0.031);
    expect(bird?.parameterValueId).toBe(
      'pv-eco-methylmercury-food-trveco-bird-ccmetrg',
    );
    expect(bird?.provisional).toBe(false);
  });

  it('returns null when the frame marks the pathway reference_only', () => {
    // canada-fcsap-aquatic: eco-direct = reference_only.
    expect(
      resolveEcoSeed(
        'benzene',
        'eco-direct-eqp',
        'fcv_ug_per_L',
        'canada-fcsap-aquatic',
      ),
    ).toBeNull();
  });

  it('returns null when the frame marks the pathway unsupported', () => {
    // ccme-sediment-quality: eco-food = unsupported.
    expect(
      resolveEcoSeed(
        'arsenic_inorganic',
        'eco-food-bsaf',
        'trv_eco_mg_per_kg_bw_day',
        'ccme-sediment-quality',
        'mammal',
      ),
    ).toBeNull();
  });

  it('returns null when the record jurisdiction is not eligible for the frame', () => {
    // us-epa-usace-sediment: eco-food = needs_review BUT eligible jurisdictions are US_federal/general;
    // the FCSAP eco-food TRV is Canada_federal, so it is jurisdiction-blocked -> no seed.
    expect(
      resolveEcoSeed(
        'arsenic_inorganic',
        'eco-food-bsaf',
        'trv_eco_mg_per_kg_bw_day',
        'us-epa-usace-sediment',
        'mammal',
      ),
    ).toBeNull();
  });

  it('returns null when no catalog candidate exists for the substance', () => {
    expect(
      resolveEcoSeed(
        'not_a_real_substance_key',
        'eco-direct-eqp',
        'fcv_ug_per_L',
        'bc-protocol1-v5-dra',
      ),
    ).toBeNull();
  });
});
