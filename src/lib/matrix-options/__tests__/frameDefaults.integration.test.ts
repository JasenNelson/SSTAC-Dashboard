import { describe, it, expect } from 'vitest';
import {
  FRAME_DEFAULT_PROFILES,
  getActiveFrameDefaults,
  getFrameDefaults,
  getFrameScenarios,
  getSelectableFrameScenarios,
  getDefaultSelectableScenarioId,
  validateFrameDefaultProfiles,
} from '../frameDefaults';

// INTEGRATION test: NO mocks. Exercises the REAL FRAME_DEFAULT_PROFILES table,
// the REAL catalog records + sources, and the REAL eligibility gate
// (defaultSelectionPolicy). This is what frameDefaults.test.ts (which mocks
// getFrameSeedCandidateEligibility) cannot prove. Depends on the WLRS Step 0
// promotion (PR #285) being on main.

describe('C-BC frame default (live catalog, real eligibility)', () => {
  it('structurally validates the live table with no errors', () => {
    expect(validateFrameDefaultProfiles()).toEqual([]);
  });

  it('BC Protocol 1 HH-food seeds an ACTIVE IR_food default of 0.111 kg/day', () => {
    const active = getActiveFrameDefaults(
      'bc-protocol1-v5-dra',
      'human-health-food',
    );
    const ir = active.find((d) => d.inputKey === 'IR_food_kg_per_day');
    expect(ir).toBeTruthy();
    expect(ir?.status).toBe('active');
    expect(ir?.value).toBe(0.111);
    expect(ir?.parameterValueId).toBe('pv-wlrs-2023-ir-food-recreational-bc');
    expect(ir?.unit).toBe('kg/day');
  });

  it('the cited generic WLRS row is reachable via the frame-default path (no orphan)', () => {
    const all = getFrameDefaults('bc-protocol1-v5-dra', 'human-health-food');
    const ir = all.find((d) => d.inputKey === 'IR_food_kg_per_day');
    expect(ir?.parameterValueId).toBe('pv-wlrs-2023-ir-food-recreational-bc');
    expect(ir?.candidateGroupId).toBe(
      'human-health-food__generic__IR_food_kg_per_day__BC',
    );
  });

  it('a frame with no profile row seeds nothing', () => {
    // ccme-sediment-quality has no FRAME_DEFAULT_PROFILES row (us-epa-usace-sediment now does -- C-nonBC).
    expect(
      getActiveFrameDefaults('ccme-sediment-quality', 'human-health-food'),
    ).toEqual([]);
  });

  it('the table contains the C-BC, C-nonBC, and both C-HH-direct receptor-scenario rows', () => {
    // C-HH-direct (2026-06-12): the canada-fcsap-aquatic human-health-direct frame now has TWO
    // receptor-scenario rows (residential toddler [default] + residential adult), so the live
    // table is 4 rows: BC HH-food, US EPA HH-food, FCSAP HH-direct toddler, FCSAP HH-direct adult.
    expect(FRAME_DEFAULT_PROFILES.length).toBe(4);
  });
});

describe('C-nonBC frame default (live catalog, real eligibility)', () => {
  it('US EPA frame HH-food seeds an ACTIVE IR_food default of 0.0175 kg/day', () => {
    const active = getActiveFrameDefaults(
      'us-epa-usace-sediment',
      'human-health-food',
    );
    const ir = active.find((d) => d.inputKey === 'IR_food_kg_per_day');
    expect(ir).toBeTruthy();
    expect(ir?.status).toBe('active');
    expect(ir?.value).toBe(0.0175);
    expect(ir?.parameterValueId).toBe('pv-epa-2000-ir-food-general-us');
    expect(ir?.unit).toBe('kg/day');
    // Per-frame label: the EPA source descriptor, NOT BC WLRS.
    expect(ir?.label).toBe('US EPA 2000 AWQC, general adult population');
  });

  it('the cited EPA row is reachable via the frame-default path (no orphan)', () => {
    const all = getFrameDefaults('us-epa-usace-sediment', 'human-health-food');
    const ir = all.find((d) => d.inputKey === 'IR_food_kg_per_day');
    expect(ir?.parameterValueId).toBe('pv-epa-2000-ir-food-general-us');
    expect(ir?.candidateGroupId).toBe(
      'human-health-food__generic__IR_food_kg_per_day__US_federal',
    );
  });
});

describe('C-HH-direct frame default (live catalog, real eligibility)', () => {
  it('canada-fcsap-aquatic HH-direct seeds 7 ACTIVE exposure-factor defaults', () => {
    const active = getActiveFrameDefaults(
      'canada-fcsap-aquatic',
      'human-health-direct',
    );
    expect(active).toHaveLength(7);
    expect(active.every((d) => d.status === 'active')).toBe(true);
  });

  it('the canada-fcsap-aquatic HH-direct BW seed is an ACTIVE 16.5 kg toddler value', () => {
    const active = getActiveFrameDefaults(
      'canada-fcsap-aquatic',
      'human-health-direct',
    );
    const bw = active.find((d) => d.inputKey === 'BW_kg');
    expect(bw).toBeTruthy();
    expect(bw?.status).toBe('active');
    expect(bw?.value).toBe(16.5);
    expect(bw?.parameterValueId).toBe('pv-hc-pqra-v4-2024-bw-toddler-ca');
    expect(bw?.unit).toBe('kg');
  });

  it('the cited HC PQRA toddler rows are reachable via the frame-default path (no orphan)', () => {
    const all = getFrameDefaults('canada-fcsap-aquatic', 'human-health-direct');
    const bw = all.find((d) => d.inputKey === 'BW_kg');
    expect(bw?.parameterValueId).toBe('pv-hc-pqra-v4-2024-bw-toddler-ca');
    expect(bw?.candidateGroupId).toBe(
      'human-health-direct__generic__BW_kg__general',
    );
  });
});

describe('C-HH-direct receptor scenarios (live catalog, real eligibility)', () => {
  it('exposes residential toddler (default) + residential adult as SELECTABLE scenarios', () => {
    const scenarios = getSelectableFrameScenarios('canada-fcsap-aquatic', 'human-health-direct');
    const ids = scenarios.map((s) => s.scenarioId).sort();
    expect(ids).toEqual(['residential-adult', 'residential-toddler']);
    // Every scenario's seeds resolve ACTIVE (the completeness gate) -> both are offered.
    expect(getFrameScenarios('canada-fcsap-aquatic', 'human-health-direct')).toHaveLength(2);
  });

  it('the default selectable scenario is the residential toddler', () => {
    expect(
      getDefaultSelectableScenarioId('canada-fcsap-aquatic', 'human-health-direct'),
    ).toBe('residential-toddler');
    // No scenarioId -> the default (toddler) profile, identical to pre-scenario behavior.
    const bwDefault = getActiveFrameDefaults('canada-fcsap-aquatic', 'human-health-direct').find(
      (d) => d.inputKey === 'BW_kg',
    );
    expect(bwDefault?.value).toBe(16.5);
  });

  it('the residential-adult scenario seeds 7 ACTIVE adult exposure-factor defaults', () => {
    const active = getActiveFrameDefaults('canada-fcsap-aquatic', 'human-health-direct', {
      scenarioId: 'residential-adult',
    });
    expect(active).toHaveLength(7);
    expect(active.every((d) => d.status === 'active')).toBe(true);
    const byKey = (k: string) => active.find((d) => d.inputKey === k);
    // The 3 adult-specific receptor seeds resolve to the verified HC PQRA v4.0 Appendix E values.
    expect(byKey('BW_kg')?.value).toBe(70.7);
    expect(byKey('BW_kg')?.parameterValueId).toBe('pv-hc-pqra-v4-2024-bw-adult-ca');
    expect(byKey('IR_sed_mg_per_day')?.value).toBe(20);
    expect(byKey('IR_sed_mg_per_day')?.parameterValueId).toBe('pv-hc-pqra-v4-2024-ir-sed-general-ca');
    expect(byKey('SA_cm2')?.value).toBe(17640);
    expect(byKey('SA_cm2')?.parameterValueId).toBe('pv-hc-pqra-v4-2024-sa-total-adult-ca');
    // The 4 shared seeds (EF/ED/AT/AF) match the toddler scenario (receptor-independent).
    expect(byKey('EF_days_per_year')?.value).toBe(364);
    expect(byKey('ED_years')?.value).toBe(80);
    expect(byKey('AT_cancer_years')?.value).toBe(80);
    expect(byKey('AF_sed_mg_per_cm2')?.value).toBe(0.01);
  });

  it('an unknown scenarioId resolves to no defaults (does not silently fall back)', () => {
    expect(
      getActiveFrameDefaults('canada-fcsap-aquatic', 'human-health-direct', {
        scenarioId: 'no-such-scenario',
      }),
    ).toEqual([]);
  });
});
