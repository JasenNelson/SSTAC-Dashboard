import { describe, it, expect } from 'vitest';
import {
  FRAME_DEFAULT_PROFILES,
  getActiveFrameDefaults,
  getFrameDefaults,
  getFrameScenarios,
  getSelectableFrameScenarios,
  getDefaultSelectableScenarioId,
  getReceptorScenarioFrame,
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

  it('the table contains the C-BC, C-nonBC, and all C-HH-direct receptor-scenario rows', () => {
    // C-HH-direct (2026-06-13): the canada-fcsap-aquatic human-health-direct frame now has THREE
    // receptor-scenario rows (residential toddler [default] + residential adult +
    // commercial/industrial worker).
    // Phase D food-web (2026-06-14): bc-protocol1-v5-dra human-health-food now has THREE
    // receptor-scenario rows (recreational-fisher [default] + subsistence-fisher +
    // ACFN community-specific).
    // Live table total = 7 rows:
    // BC HH-food recreational, BC HH-food subsistence, BC HH-food ACFN community-specific,
    // US EPA HH-food, FCSAP HH-direct toddler, FCSAP HH-direct adult, FCSAP HH-direct worker.
    expect(FRAME_DEFAULT_PROFILES.length).toBe(7);
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
  it('exposes residential toddler (default) + residential adult + commercial/industrial worker as SELECTABLE scenarios', () => {
    const scenarios = getSelectableFrameScenarios('canada-fcsap-aquatic', 'human-health-direct');
    const ids = scenarios.map((s) => s.scenarioId).sort();
    expect(ids).toEqual(['commercial-industrial-worker', 'residential-adult', 'residential-toddler']);
    // Every scenario's seeds resolve ACTIVE (the completeness gate) -> all 3 are offered.
    expect(getFrameScenarios('canada-fcsap-aquatic', 'human-health-direct')).toHaveLength(3);
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

describe('C-BC food-web receptor scenarios (live catalog, real eligibility)', () => {
  it('exposes recreational (default) + subsistence + ACFN community-specific fishers as SELECTABLE scenarios', () => {
    const scenarios = getSelectableFrameScenarios('bc-protocol1-v5-dra', 'human-health-food');
    const ids = scenarios.map((s) => s.scenarioId).sort();
    expect(ids).toEqual(['acfn-community-specific', 'recreational-fisher', 'subsistence-fisher']);
    // Every scenario's seeds resolve ACTIVE (the completeness gate) -> all 3 are offered.
    expect(getFrameScenarios('bc-protocol1-v5-dra', 'human-health-food')).toHaveLength(3);
  });

  it('the default selectable scenario is the recreational fisher (IR 0.111 kg/day, BW 70.7 kg)', () => {
    expect(
      getDefaultSelectableScenarioId('bc-protocol1-v5-dra', 'human-health-food'),
    ).toBe('recreational-fisher');
    const active = getActiveFrameDefaults('bc-protocol1-v5-dra', 'human-health-food', {
      scenarioId: 'recreational-fisher',
    });
    expect(active.every((d) => d.status === 'active')).toBe(true);
    const byKey = (k: string) => active.find((d) => d.inputKey === k);
    expect(byKey('IR_food_kg_per_day')?.value).toBe(0.111);
    expect(byKey('IR_food_kg_per_day')?.parameterValueId).toBe('pv-wlrs-2023-ir-food-recreational-bc');
    expect(byKey('BW_kg')?.value).toBe(70.7);
    expect(byKey('BW_kg')?.parameterValueId).toBe('pv-wlrs-2023-bw-adult-bc');
  });

  it('the subsistence-fisher scenario seeds the ACTIVE 0.22 kg/day (220 g/day) rate + the shared 70.7 kg BW', () => {
    const active = getActiveFrameDefaults('bc-protocol1-v5-dra', 'human-health-food', {
      scenarioId: 'subsistence-fisher',
    });
    expect(active.every((d) => d.status === 'active')).toBe(true);
    const byKey = (k: string) => active.find((d) => d.inputKey === k);
    // The subsistence IR is the now-approved 0.22 kg/day (BC WLRS 2023 / TWN BIWQO 2021).
    expect(byKey('IR_food_kg_per_day')?.value).toBe(0.22);
    expect(byKey('IR_food_kg_per_day')?.parameterValueId).toBe('pv-wlrs-2023-ir-food-subsistence-bc');
    // Body weight reuses the SAME approved general adult record as the recreational scenario.
    expect(byKey('BW_kg')?.value).toBe(70.7);
    expect(byKey('BW_kg')?.parameterValueId).toBe('pv-wlrs-2023-bw-adult-bc');
  });

  it('the acfn-community-specific scenario seeds the ACTIVE 0.388 kg/day (388 g/day) rate + the shared 70.7 kg BW', () => {
    // Depends on the ACFN IR record (pv-acfn-wqciu-2023-ir-food-community-specific) being
    // promoted to approved (qa_status=approved + evidence_support_status=approved_source_backed).
    // Written for the post-promotion state; asserts fail pre-promotion by design (PENDING).
    const active = getActiveFrameDefaults('bc-protocol1-v5-dra', 'human-health-food', {
      scenarioId: 'acfn-community-specific',
    });
    expect(active.every((d) => d.status === 'active')).toBe(true);
    const byKey = (k: string) => active.find((d) => d.inputKey === k);
    // ACFN community-specific IR: 0.388 kg/day (WQCIU 2023, Lower Athabasca 95th-pct).
    expect(byKey('IR_food_kg_per_day')?.value).toBe(0.388);
    expect(byKey('IR_food_kg_per_day')?.parameterValueId).toBe(
      'pv-acfn-wqciu-2023-ir-food-community-specific',
    );
    // Body weight reuses the SAME approved general adult record as the other BC scenarios.
    expect(byKey('BW_kg')?.value).toBe(70.7);
    expect(byKey('BW_kg')?.parameterValueId).toBe('pv-wlrs-2023-bw-adult-bc');
  });
});

describe('getReceptorScenarioFrame (integration, live FRAME_DEFAULT_PROFILES)', () => {
  it('bc-protocol1-v5-dra resolves to canada-fcsap-aquatic for human-health-direct', () => {
    // bc-protocol1-v5-dra has no direct-contact profile rows, so it falls back to the
    // fixed HC PQRA provider. This is the key frame-independence invariant.
    expect(getReceptorScenarioFrame('bc-protocol1-v5-dra', 'human-health-direct')).toBe(
      'canada-fcsap-aquatic',
    );
  });

  it('the resolved provider frame exposes 3 selectable receptor scenarios (the selector is reachable from a non-FCSAP frame)', () => {
    // Confirm the full round-trip: a non-FCSAP frame -> provider -> scenario selector has 3 options.
    const providerFrame = getReceptorScenarioFrame('bc-protocol1-v5-dra', 'human-health-direct');
    const scenarios = getSelectableFrameScenarios(providerFrame, 'human-health-direct');
    expect(scenarios).toHaveLength(3);
    const ids = scenarios.map((s) => s.scenarioId).sort();
    expect(ids).toEqual(['commercial-industrial-worker', 'residential-adult', 'residential-toddler']);
  });
});
