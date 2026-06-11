import { describe, it, expect } from 'vitest';
import {
  FRAME_DEFAULT_PROFILES,
  getActiveFrameDefaults,
  getFrameDefaults,
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

  it('the table contains exactly the C-BC and C-nonBC rows', () => {
    expect(FRAME_DEFAULT_PROFILES.length).toBe(2);
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
