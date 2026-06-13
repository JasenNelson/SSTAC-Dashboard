// Unit tests for frameDefaults.ts.
// Covers every branch of getFrameDefaults, getActiveFrameDefaults,
// validateFrameDefaultProfiles, SEEDABLE_KEYS, and the empty-table invariants.
// Plain ASCII only (code point <= 127).

import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { ParameterValueRecord } from '../provenance/types';
import type { FrameDefaultProfileRow } from '../frameDefaults';
import {
  SEEDABLE_KEYS,
  FRAME_DEFAULT_PROFILES,
  getFrameDefaults,
  getActiveFrameDefaults,
  getFrameScenarios,
  getSelectableFrameScenarios,
  getDefaultSelectableScenarioId,
  getActiveScenarioFrameDefaults,
  validateFrameDefaultProfiles,
} from '../frameDefaults';
import { PROVENANCE_PATHWAYS } from '../provenance/pathways';
import { getFrameSeedCandidateEligibility } from '../defaultSelectionPolicy';

// ---------------------------------------------------------------------------
// Mock the eligibility dependency so frameDefaults is tested in isolation.
// The real logic of getFrameSeedCandidateEligibility is exercised by its own
// test suite (defaultSelectionPolicy tests). Here we only test that
// frameDefaults.ts correctly delegates to it and handles the result.
// ---------------------------------------------------------------------------
vi.mock('../defaultSelectionPolicy', () => ({
  getFrameSeedCandidateEligibility: vi.fn(),
}));

const mockEligibility = vi.mocked(getFrameSeedCandidateEligibility);

beforeEach(() => {
  mockEligibility.mockReset();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal ParameterValueRecord with sane defaults. Override any field
 * needed by the test.
 */
function makeRecord(
  overrides: Partial<ParameterValueRecord> & {
    parameter_value_id: string;
  },
): ParameterValueRecord {
  return {
    substance_key: 'generic',
    pathway: 'human-health-food',
    input_key: 'IR_food_kg_per_day',
    display_name: 'Fish ingestion rate',
    value: 0.1,
    unit: 'kg/day',
    value_type: 'single_value',
    candidate_group_id: 'cg-ir-food-hh',
    default_status: 'available_option',
    evidence_support_status: 'pending_source_locator',
    extraction_status: 'extracted_from_source',
    qa_status: 'approved',
    source_ids: [],
    equation_ids: [],
    jurisdiction: 'general',
    applicability: '',
    uncertainty: null,
    evidence_items: [],
    review_notes: '',
    ...overrides,
  } as ParameterValueRecord;
}

/**
 * Build a minimal FrameDefaultProfileRow that passes validation.
 * Uses bc-protocol1-v5-dra + human-health-food (both non-unsupported).
 */
function makeProfile(
  overrides?: Partial<FrameDefaultProfileRow>,
): FrameDefaultProfileRow {
  return {
    frameId: 'bc-protocol1-v5-dra',
    pathway: 'human-health-food',
    note: 'Test profile',
    label: 'Test label',
    sourceIds: ['src-test-001'],
    defaults: [
      {
        inputKey: 'IR_food_kg_per_day',
        parameterValueId: 'pvid-test-ir',
        candidateGroupId: 'cg-ir-food-hh',
      },
    ],
    ...overrides,
  };
}

// A minimal approved IR_food record that passes ALL resolver contract checks.
// Evidence fields (evidence_support_status etc.) are optional here because the
// resolver now delegates all eligibility decisions to getFrameSeedCandidateEligibility
// (which is mocked), so these fields are only read by the mock, not by frameDefaults.
const APPROVED_IR_RECORD = makeRecord({
  parameter_value_id: 'pvid-test-ir',
  substance_key: 'generic',
  pathway: 'human-health-food',
  input_key: 'IR_food_kg_per_day',
  value: 0.1,
  unit: 'kg/day',
  candidate_group_id: 'cg-ir-food-hh',
  qa_status: 'approved',
  jurisdiction: 'general',
  source_ids: ['src-test-001'],
});

// Synthetic source seam for validateFrameDefaultProfiles (so the profile's
// sourceId resolves without coupling tests to the live catalog).
const TEST_SOURCES = [
  { source_id: 'src-test-001' },
] as unknown as Parameters<typeof validateFrameDefaultProfiles>[2];

// ---------------------------------------------------------------------------
// 1. Live-table invariants (C-BC: the table now has exactly one row)
// ---------------------------------------------------------------------------

describe('FRAME_DEFAULT_PROFILES live-table invariants', () => {
  it('has the C-BC and C-nonBC rows (found by frameId, not positional)', () => {
    // C-HH-direct (2026-06-12): the table now has the canada-fcsap-aquatic human-health-direct
    // frame as TWO receptor-scenario rows (residential toddler [default] + residential adult),
    // so the live table is 4 rows.
    expect(FRAME_DEFAULT_PROFILES.length).toBe(4);
    const bc = FRAME_DEFAULT_PROFILES.find((r) => r.frameId === 'bc-protocol1-v5-dra');
    expect(bc).toBeDefined();
    expect(bc?.pathway).toBe('human-health-food');
    expect(bc?.label).toBe('BC WLRS 2023, recreational');
    expect(bc?.defaults[0].parameterValueId).toBe(
      'pv-wlrs-2023-ir-food-recreational-bc',
    );
    // C-3: the BC row now also seeds adult body weight (BW_kg), with a per-seed label
    // override (the body weight is the general adult value, not "recreational").
    expect(bc?.defaults).toHaveLength(2);
    const bcBw = bc?.defaults.find((d) => d.inputKey === 'BW_kg');
    expect(bcBw?.parameterValueId).toBe('pv-wlrs-2023-bw-adult-bc');
    expect(bcBw?.candidateGroupId).toBe('human-health-food__generic__BW_kg__BC');
    expect(bcBw?.label).toBe('BC WLRS 2023, adult 70.7 kg (Table 1)');
    const usEpa = FRAME_DEFAULT_PROFILES.find((r) => r.frameId === 'us-epa-usace-sediment');
    expect(usEpa).toBeDefined();
    expect(usEpa?.pathway).toBe('human-health-food');
    expect(usEpa?.label).toBe('US EPA 2000 AWQC, general adult population');
    expect(usEpa?.defaults[0].parameterValueId).toBe('pv-epa-2000-ir-food-general-us');
    // C-4: the US EPA row now also seeds adult body weight (BW_kg = 70 kg). No per-seed
    // label override here -- the row label "general adult population" is already correct
    // for the body weight (unlike the BC row's "recreational" descriptor).
    expect(usEpa?.defaults).toHaveLength(2);
    const usBw = usEpa?.defaults.find((d) => d.inputKey === 'BW_kg');
    expect(usBw?.parameterValueId).toBe('pv-epa-2000-bw-adult-us');
    expect(usBw?.candidateGroupId).toBe('human-health-food__generic__BW_kg__US_federal');
    expect(usBw?.label).toBeUndefined();
  });

  it('validateFrameDefaultProfiles() returns [] against the live table', () => {
    // The real C-BC row must structurally validate against the live catalog +
    // sources (resolves, subset, generic, kg/day, candidate_group match).
    const errors = validateFrameDefaultProfiles();
    expect(errors).toEqual([]);
  });

  it('getFrameDefaults with no profile row for the (frame, pathway) returns []', () => {
    const results = getFrameDefaults('bc-protocol1-v5-dra', 'human-health-food', {
      profiles: [],
    });
    expect(results).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 2. SEEDABLE_KEYS shape
// ---------------------------------------------------------------------------

describe('SEEDABLE_KEYS', () => {
  it('human-health-food has exactly IR_food_kg_per_day and BW_kg', () => {
    expect(SEEDABLE_KEYS['human-health-food']).toEqual([
      'IR_food_kg_per_day',
      'BW_kg',
    ]);
  });

  it('human-health-direct has exactly the 7 HC PQRA exposure-factor keys', () => {
    expect(SEEDABLE_KEYS['human-health-direct']).toEqual([
      'BW_kg',
      'IR_sed_mg_per_day',
      'EF_days_per_year',
      'ED_years',
      'AT_cancer_years',
      'SA_cm2',
      'AF_sed_mg_per_cm2',
    ]);
  });

  it('every other ProvenancePathway has an empty seedable-key list', () => {
    // human-health-food and human-health-direct now have seeds; all others are [].
    const others = PROVENANCE_PATHWAYS.filter(
      (p) => p !== 'human-health-food' && p !== 'human-health-direct',
    );
    for (const pathway of others) {
      expect(SEEDABLE_KEYS[pathway]).toEqual([]);
    }
  });
});

// ---------------------------------------------------------------------------
// 2b. Per-seed label override (C-3)
// ---------------------------------------------------------------------------

describe('getFrameDefaults: per-seed label override', () => {
  const BW_RECORD = makeRecord({
    parameter_value_id: 'pvid-test-bw',
    input_key: 'BW_kg',
    value: 70.7,
    unit: 'kg',
    candidate_group_id: 'cg-bw-hh',
    qa_status: 'approved',
  });

  it('uses the seed label when present, and the row label when omitted', () => {
    mockEligibility.mockReturnValue({
      eligible: true,
      disposition: 'eligible_pending_approval',
      rationale: 'ok',
    });
    const profile = makeProfile({
      label: 'ROW LABEL',
      defaults: [
        // no seed label -> inherits the row label
        { inputKey: 'IR_food_kg_per_day', parameterValueId: 'pvid-test-ir', candidateGroupId: 'cg-ir-food-hh' },
        // seed label -> overrides the row label for THIS input only
        { inputKey: 'BW_kg', parameterValueId: 'pvid-test-bw', candidateGroupId: 'cg-bw-hh', label: 'SEED LABEL' },
      ],
    });
    const results = getFrameDefaults('bc-protocol1-v5-dra', 'human-health-food', {
      profiles: [profile],
      records: [APPROVED_IR_RECORD, BW_RECORD],
    });
    expect(results.find((r) => r.inputKey === 'IR_food_kg_per_day')?.label).toBe('ROW LABEL');
    expect(results.find((r) => r.inputKey === 'BW_kg')?.label).toBe('SEED LABEL');
  });

  it('validateFrameDefaultProfiles rejects an empty-string seed label override', () => {
    const profile = makeProfile({
      defaults: [
        { inputKey: 'IR_food_kg_per_day', parameterValueId: 'pvid-test-ir', candidateGroupId: 'cg-ir-food-hh', label: '   ' },
      ],
    });
    const errors = validateFrameDefaultProfiles([profile], [APPROVED_IR_RECORD], TEST_SOURCES);
    expect(errors.some((e) => /label override, when present, must be a non-empty/.test(e))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2b. Receptor scenarios: multi-profile (frameId, pathway) selection + discovery
// ---------------------------------------------------------------------------

describe('receptor scenarios: getFrameDefaults scenarioId selection', () => {
  // Two scenarios for the same (frameId, pathway): a default + a named alternative.
  const toddler = makeProfile({
    receptorScenarioId: 'toddler',
    scenarioLabel: 'Toddler',
    isDefaultScenario: true,
    defaults: [{ inputKey: 'IR_food_kg_per_day', parameterValueId: 'pvid-toddler', candidateGroupId: 'cg-ir-food-hh' }],
  });
  const adult = makeProfile({
    receptorScenarioId: 'adult',
    scenarioLabel: 'Adult',
    defaults: [{ inputKey: 'IR_food_kg_per_day', parameterValueId: 'pvid-adult', candidateGroupId: 'cg-ir-food-hh' }],
  });
  const records = [
    makeRecord({ parameter_value_id: 'pvid-toddler', value: 0.05, candidate_group_id: 'cg-ir-food-hh' }),
    makeRecord({ parameter_value_id: 'pvid-adult', value: 0.2, candidate_group_id: 'cg-ir-food-hh' }),
  ];

  it('a passed scenarioId resolves THAT scenario profile', () => {
    mockEligibility.mockReturnValue({ eligible: true, disposition: 'eligible_pending_approval', rationale: 'ok' });
    const adultDefaults = getFrameDefaults('bc-protocol1-v5-dra', 'human-health-food', {
      profiles: [toddler, adult],
      records,
      scenarioId: 'adult',
    });
    expect(adultDefaults[0].parameterValueId).toBe('pvid-adult');
    expect(adultDefaults[0].value).toBe(0.2);
  });

  it('no scenarioId resolves the isDefaultScenario profile (not the first)', () => {
    mockEligibility.mockReturnValue({ eligible: true, disposition: 'eligible_pending_approval', rationale: 'ok' });
    // Order adult-first to prove it picks by the isDefaultScenario flag, not position.
    const def = getFrameDefaults('bc-protocol1-v5-dra', 'human-health-food', {
      profiles: [adult, toddler],
      records,
    });
    expect(def[0].parameterValueId).toBe('pvid-toddler');
  });

  it('an unknown scenarioId resolves to [] (no silent fallback)', () => {
    mockEligibility.mockReturnValue({ eligible: true, disposition: 'eligible_pending_approval', rationale: 'ok' });
    expect(
      getFrameDefaults('bc-protocol1-v5-dra', 'human-health-food', {
        profiles: [toddler, adult],
        records,
        scenarioId: 'nope',
      }),
    ).toEqual([]);
  });

  it('getFrameScenarios lists every NAMED scenario; getSelectableFrameScenarios gates on completeness', () => {
    mockEligibility.mockReturnValue({ eligible: true, disposition: 'eligible_pending_approval', rationale: 'ok' });
    const named = getFrameScenarios('bc-protocol1-v5-dra', 'human-health-food', { profiles: [toddler, adult], records });
    expect(named.map((s) => s.scenarioId).sort()).toEqual(['adult', 'toddler']);
    // Both records approved + eligible -> both scenarios selectable.
    const selectable = getSelectableFrameScenarios('bc-protocol1-v5-dra', 'human-health-food', { profiles: [toddler, adult], records });
    expect(selectable.map((s) => s.scenarioId).sort()).toEqual(['adult', 'toddler']);
    expect(getDefaultSelectableScenarioId('bc-protocol1-v5-dra', 'human-health-food', { profiles: [toddler, adult], records })).toBe('toddler');
  });

  it('a scenario with a non-active (needs_review) seed is EXCLUDED from selectable (no hybrid)', () => {
    mockEligibility.mockReturnValue({ eligible: true, disposition: 'eligible_pending_approval', rationale: 'ok' });
    const recordsAdultPending = [
      makeRecord({ parameter_value_id: 'pvid-toddler', value: 0.05, candidate_group_id: 'cg-ir-food-hh', qa_status: 'approved' }),
      makeRecord({ parameter_value_id: 'pvid-adult', value: 0.2, candidate_group_id: 'cg-ir-food-hh', qa_status: 'needs_review' }),
    ];
    const selectable = getSelectableFrameScenarios('bc-protocol1-v5-dra', 'human-health-food', {
      profiles: [toddler, adult],
      records: recordsAdultPending,
    });
    expect(selectable.map((s) => s.scenarioId)).toEqual(['toddler']);
    // The default selectable scenario is still the (complete) toddler.
    expect(getDefaultSelectableScenarioId('bc-protocol1-v5-dra', 'human-health-food', { profiles: [toddler, adult], records: recordsAdultPending })).toBe('toddler');
  });

  // getActiveScenarioFrameDefaults fail-closed semantics (the calculator's resolver).
  it('getActiveScenarioFrameDefaults resolves a valid scenarioId to that scenario actives', () => {
    mockEligibility.mockReturnValue({ eligible: true, disposition: 'eligible_pending_approval', rationale: 'ok' });
    const active = getActiveScenarioFrameDefaults('bc-protocol1-v5-dra', 'human-health-food', 'adult', { profiles: [toddler, adult], records });
    expect(active).toHaveLength(1);
    expect(active[0].parameterValueId).toBe('pvid-adult');
  });

  it('getActiveScenarioFrameDefaults FAILS CLOSED: named frame + no scenarioId selectable -> [] (no hybrid)', () => {
    mockEligibility.mockReturnValue({ eligible: true, disposition: 'eligible_pending_approval', rationale: 'ok' });
    // Both scenarios incomplete (every record needs_review) -> none selectable; the calculator
    // resolves no scenarioId, and the legacy fallback would have seeded the active subset.
    const pendingRecords = [
      makeRecord({ parameter_value_id: 'pvid-toddler', value: 0.05, candidate_group_id: 'cg-ir-food-hh', qa_status: 'needs_review' }),
      makeRecord({ parameter_value_id: 'pvid-adult', value: 0.2, candidate_group_id: 'cg-ir-food-hh', qa_status: 'needs_review' }),
    ];
    expect(
      getActiveScenarioFrameDefaults('bc-protocol1-v5-dra', 'human-health-food', undefined, { profiles: [toddler, adult], records: pendingRecords }),
    ).toEqual([]);
  });

  it('getActiveScenarioFrameDefaults keeps legacy behavior for a frame with NO named scenarios', () => {
    mockEligibility.mockReturnValue({ eligible: true, disposition: 'eligible_pending_approval', rationale: 'ok' });
    // A sole scenario-less profile (no receptorScenarioId) -> undefined resolves it normally.
    const sole = makeProfile({ defaults: [{ inputKey: 'IR_food_kg_per_day', parameterValueId: 'pvid-test-ir', candidateGroupId: 'cg-ir-food-hh' }] });
    const active = getActiveScenarioFrameDefaults('bc-protocol1-v5-dra', 'human-health-food', undefined, { profiles: [sole], records: [APPROVED_IR_RECORD] });
    expect(active).toHaveLength(1);
    expect(active[0].parameterValueId).toBe('pvid-test-ir');
  });
});

describe('receptor scenarios: validateFrameDefaultProfiles multi-profile invariants', () => {
  const seedDefaults = [{ inputKey: 'IR_food_kg_per_day', parameterValueId: 'pvid-test-ir', candidateGroupId: 'cg-ir-food-hh' }];
  const records = [APPROVED_IR_RECORD];

  it('rejects two scenario-less rows for the same (frameId, pathway)', () => {
    const a = makeProfile({ defaults: seedDefaults });
    const b = makeProfile({ defaults: seedDefaults });
    const errors = validateFrameDefaultProfiles([a, b], records, TEST_SOURCES);
    expect(errors.some((e) => e.includes('duplicate (frameId, pathway, receptorScenarioId)'))).toBe(true);
  });

  it('rejects a multi-scenario group with ZERO isDefaultScenario', () => {
    const a = makeProfile({ receptorScenarioId: 's1', scenarioLabel: 'S1', defaults: seedDefaults });
    const b = makeProfile({ receptorScenarioId: 's2', scenarioLabel: 'S2', defaults: seedDefaults });
    const errors = validateFrameDefaultProfiles([a, b], records, TEST_SOURCES);
    expect(errors.some((e) => e.includes('EXACTLY ONE isDefaultScenario; found 0'))).toBe(true);
  });

  it('rejects a multi-scenario group with TWO isDefaultScenario', () => {
    const a = makeProfile({ receptorScenarioId: 's1', scenarioLabel: 'S1', isDefaultScenario: true, defaults: seedDefaults });
    const b = makeProfile({ receptorScenarioId: 's2', scenarioLabel: 'S2', isDefaultScenario: true, defaults: seedDefaults });
    const errors = validateFrameDefaultProfiles([a, b], records, TEST_SOURCES);
    expect(errors.some((e) => e.includes('EXACTLY ONE isDefaultScenario; found 2'))).toBe(true);
  });

  it('rejects a named scenario missing its scenarioLabel', () => {
    const a = makeProfile({ receptorScenarioId: 's1', scenarioLabel: 'S1', isDefaultScenario: true, defaults: seedDefaults });
    const b = makeProfile({ receptorScenarioId: 's2', defaults: seedDefaults } as Partial<FrameDefaultProfileRow>);
    const errors = validateFrameDefaultProfiles([a, b], records, TEST_SOURCES);
    expect(errors.some((e) => e.includes('scenarioLabel must be a non-empty string'))).toBe(true);
  });

  it('accepts a well-formed two-scenario group', () => {
    const a = makeProfile({ receptorScenarioId: 's1', scenarioLabel: 'S1', isDefaultScenario: true, defaults: seedDefaults });
    const b = makeProfile({ receptorScenarioId: 's2', scenarioLabel: 'S2', defaults: seedDefaults });
    expect(validateFrameDefaultProfiles([a, b], records, TEST_SOURCES)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 3. getFrameDefaults -- active (approved + eligible record)
// ---------------------------------------------------------------------------

describe('getFrameDefaults: approved -> active', () => {
  const profile = makeProfile();
  const records = [APPROVED_IR_RECORD];

  it('returns one entry with status active and delegates to eligibility gate', () => {
    mockEligibility.mockReturnValue({
      eligible: true,
      disposition: 'eligible_pending_approval',
      rationale: 'ok',
    });
    const results = getFrameDefaults('bc-protocol1-v5-dra', 'human-health-food', {
      profiles: [profile],
      records,
    });
    expect(results.length).toBe(1);
    const r = results[0];
    expect(r.status).toBe('active');
    expect(r.inputKey).toBe('IR_food_kg_per_day');
    expect(r.parameterValueId).toBe('pvid-test-ir');
    expect(r.candidateGroupId).toBe('cg-ir-food-hh');
    expect(r.value).toBe(0.1);
    expect(r.unit).toBe('kg/day');
    expect(r.qaStatus).toBe('approved');
    // Verify the resolver actually called the canonical eligibility gate with
    // (frameId, pathway, record) -- proves wiring to defaultSelectionPolicy.
    expect(mockEligibility).toHaveBeenCalledOnce();
    expect(mockEligibility).toHaveBeenCalledWith(
      'bc-protocol1-v5-dra',
      'human-health-food',
      APPROVED_IR_RECORD,
    );
  });

  it('getActiveFrameDefaults includes the active entry', () => {
    mockEligibility.mockReturnValue({
      eligible: true,
      disposition: 'eligible_pending_approval',
      rationale: 'ok',
    });
    const actives = getActiveFrameDefaults('bc-protocol1-v5-dra', 'human-health-food', {
      profiles: [profile],
      records,
    });
    expect(actives.length).toBe(1);
    expect(actives[0].status).toBe('active');
  });
});

// ---------------------------------------------------------------------------
// 4. pending (needs_review record)
// ---------------------------------------------------------------------------

describe('getFrameDefaults: needs_review -> pending', () => {
  const pendingRecord = makeRecord({
    parameter_value_id: 'pvid-test-ir',
    qa_status: 'needs_review',
  });
  const profile = makeProfile();
  const records = [pendingRecord];

  it('returns status pending and still has a value (mock not reached)', () => {
    // needs_review is handled BEFORE eligibility check; mock should not be called.
    const results = getFrameDefaults('bc-protocol1-v5-dra', 'human-health-food', {
      profiles: [profile],
      records,
    });
    expect(results.length).toBe(1);
    const r = results[0];
    expect(r.status).toBe('pending');
    expect(r.value).toBe(0.1);
    expect(r.qaStatus).toBe('needs_review');
    expect(mockEligibility).not.toHaveBeenCalled();
  });

  it('getActiveFrameDefaults returns [] for a pending entry', () => {
    const actives = getActiveFrameDefaults('bc-protocol1-v5-dra', 'human-health-food', {
      profiles: [profile],
      records,
    });
    expect(actives).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 5. superseded record
// ---------------------------------------------------------------------------

describe('getFrameDefaults: superseded record', () => {
  const supersededRecord = makeRecord({
    parameter_value_id: 'pvid-test-ir',
    qa_status: 'superseded',
  });
  const profile = makeProfile();

  it('returns status superseded with value null (mock not reached)', () => {
    // superseded is handled BEFORE eligibility check; mock should not be called.
    const results = getFrameDefaults('bc-protocol1-v5-dra', 'human-health-food', {
      profiles: [profile],
      records: [supersededRecord],
    });
    expect(results.length).toBe(1);
    const r = results[0];
    expect(r.status).toBe('superseded');
    expect(r.value).toBeNull();
    expect(r.qaStatus).toBe('superseded');
    expect(mockEligibility).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 6. unresolved (parameterValueId absent from records)
// ---------------------------------------------------------------------------

describe('getFrameDefaults: unresolved (pvid not in records)', () => {
  const profile = makeProfile();

  it('returns status unresolved when record is not found', () => {
    const results = getFrameDefaults('bc-protocol1-v5-dra', 'human-health-food', {
      profiles: [profile],
      records: [], // no records at all
    });
    expect(results.length).toBe(1);
    expect(results[0].status).toBe('unresolved');
    expect(results[0].value).toBeNull();
    expect(results[0].reason).toMatch(/not found in catalog/i);
  });
});

// ---------------------------------------------------------------------------
// 7. invalid: non-seedable input key
// ---------------------------------------------------------------------------

describe('getFrameDefaults: invalid -- non-seedable input key', () => {
  const profile = makeProfile({
    defaults: [
      {
        inputKey: 'foc',
        parameterValueId: 'pvid-foc',
        candidateGroupId: 'cg-foc',
      },
    ],
  });
  const focRecord = makeRecord({
    parameter_value_id: 'pvid-foc',
    input_key: 'foc',
    pathway: 'human-health-food',
    candidate_group_id: 'cg-foc',
    substance_key: 'generic',
    value: 0.02,
  });

  it('returns status invalid with "not seedable" in reason', () => {
    const results = getFrameDefaults('bc-protocol1-v5-dra', 'human-health-food', {
      profiles: [profile],
      records: [focRecord],
    });
    expect(results.length).toBe(1);
    const r = results[0];
    expect(r.status).toBe('invalid');
    expect(r.reason).toMatch(/not seedable/i);
  });
});

// ---------------------------------------------------------------------------
// 8. invalid: record field mismatches
// ---------------------------------------------------------------------------

describe('getFrameDefaults: invalid -- record mismatches', () => {
  const profile = makeProfile();

  it('(a) substance_key !== generic -> invalid with substance_key in reason', () => {
    const record = makeRecord({
      parameter_value_id: 'pvid-test-ir',
      substance_key: 'arsenic', // not generic
    });
    const results = getFrameDefaults('bc-protocol1-v5-dra', 'human-health-food', {
      profiles: [profile],
      records: [record],
    });
    expect(results.length).toBe(1);
    const r = results[0];
    expect(r.status).toBe('invalid');
    expect(r.reason).toMatch(/substance_key/);
  });

  it('(b) record.input_key does not match seed.inputKey -> invalid', () => {
    const record = makeRecord({
      parameter_value_id: 'pvid-test-ir',
      input_key: 'BW_kg', // seed says IR_food_kg_per_day
    });
    const results = getFrameDefaults('bc-protocol1-v5-dra', 'human-health-food', {
      profiles: [profile],
      records: [record],
    });
    expect(results.length).toBe(1);
    expect(results[0].status).toBe('invalid');
    expect(results[0].reason).toMatch(/input_key/);
  });

  it('(c) candidate_group_id mismatch -> invalid', () => {
    const record = makeRecord({
      parameter_value_id: 'pvid-test-ir',
      candidate_group_id: 'cg-different', // profile seeds cg-ir-food-hh
    });
    const results = getFrameDefaults('bc-protocol1-v5-dra', 'human-health-food', {
      profiles: [profile],
      records: [record],
    });
    expect(results.length).toBe(1);
    expect(results[0].status).toBe('invalid');
    expect(results[0].reason).toMatch(/candidate_group_id/);
  });

  it('(d) non-numeric value -> invalid with value in reason', () => {
    // ParameterValueRecord.value is typed as number|string; cast to satisfy TS.
    const record = makeRecord({
      parameter_value_id: 'pvid-test-ir',
      value: 'not-a-number' as unknown as number,
    });
    const results = getFrameDefaults('bc-protocol1-v5-dra', 'human-health-food', {
      profiles: [profile],
      records: [record],
    });
    expect(results.length).toBe(1);
    expect(results[0].status).toBe('invalid');
    expect(results[0].reason).toMatch(/value/);
  });
});

// ---------------------------------------------------------------------------
// 9. unsupported-pathway guard
// ---------------------------------------------------------------------------

describe('getFrameDefaults: unsupported pathway short-circuits to []', () => {
  // bc-csr-sediment-numerical has human-health-food === unsupported (verified in regulatoryFrames.ts).
  const profile: FrameDefaultProfileRow = {
    frameId: 'bc-csr-sediment-numerical',
    pathway: 'human-health-food',
    note: 'Test unsupported pathway',
    label: 'Test label',
    sourceIds: ['src-x'],
    defaults: [
      {
        inputKey: 'IR_food_kg_per_day',
        parameterValueId: 'pvid-test-ir',
        candidateGroupId: 'cg-ir-food-hh',
      },
    ],
  };

  it('returns [] even when a matching profile + valid record exists', () => {
    const results = getFrameDefaults('bc-csr-sediment-numerical', 'human-health-food', {
      profiles: [profile],
      records: [APPROVED_IR_RECORD],
    });
    expect(results).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 10. No matching row (profile exists but for a different frame/pathway)
// ---------------------------------------------------------------------------

describe('getFrameDefaults: no matching profile row', () => {
  const profile = makeProfile({
    frameId: 'us-epa-usace-sediment',
    pathway: 'human-health-food',
  });

  it('returns [] when querying a frame that has no profile row', () => {
    // Query bc-protocol1-v5-dra but only us-epa-usace-sediment is in profiles.
    const results = getFrameDefaults('bc-protocol1-v5-dra', 'human-health-food', {
      profiles: [profile],
      records: [APPROVED_IR_RECORD],
    });
    expect(results).toEqual([]);
  });

  it('returns [] when querying a pathway that has no profile row', () => {
    // Profile is for human-health-food; query eco-direct-eqp.
    const results = getFrameDefaults('us-epa-usace-sediment', 'eco-direct-eqp', {
      profiles: [profile],
      records: [],
    });
    expect(results).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 11. validateFrameDefaultProfiles: per-error-branch assertions
// ---------------------------------------------------------------------------

describe('validateFrameDefaultProfiles', () => {
  it('a fully-valid synthetic profile returns no errors', () => {
    const profile = makeProfile();
    const errors = validateFrameDefaultProfiles(
      [profile],
      [APPROVED_IR_RECORD],
      TEST_SOURCES,
    );
    expect(errors).toEqual([]);
  });

  it('sourceId that does not resolve to a catalog source -> error', () => {
    const profile = makeProfile({ sourceIds: ['src-does-not-exist'] });
    const errors = validateFrameDefaultProfiles(
      [profile],
      [APPROVED_IR_RECORD],
      TEST_SOURCES,
    );
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => /does not resolve to a catalog source/i.test(e))).toBe(
      true,
    );
  });

  it('empty label -> error (the per-frame source descriptor must be non-empty)', () => {
    const profile = makeProfile({ label: '   ' });
    const errors = validateFrameDefaultProfiles(
      [profile],
      [APPROVED_IR_RECORD],
      TEST_SOURCES,
    );
    expect(errors.some((e) => /label must be a non-empty string/i.test(e))).toBe(true);
  });

  it('sourceId not in the cited record source_ids -> error', () => {
    // src-test-001 resolves, but the record does not claim it.
    const record = makeRecord({
      parameter_value_id: 'pvid-test-ir',
      source_ids: ['src-other'],
    });
    const profile = makeProfile();
    const errors = validateFrameDefaultProfiles(
      [profile],
      [record],
      [
        { source_id: 'src-test-001' },
        { source_id: 'src-other' },
      ] as unknown as Parameters<typeof validateFrameDefaultProfiles>[2],
    );
    expect(errors.length).toBeGreaterThan(0);
    expect(
      errors.some((e) => /not in the cited record source_ids/i.test(e)),
    ).toBe(true);
  });

  it('duplicate (frameId, pathway) pair -> error', () => {
    const profile = makeProfile();
    const errors = validateFrameDefaultProfiles(
      [profile, { ...profile }], // same frameId + pathway twice
      [APPROVED_IR_RECORD],
    );
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => /duplicate/i.test(e))).toBe(true);
  });

  it('unsupported (frameId, pathway) -> error', () => {
    // bc-csr-sediment-numerical + human-health-food is unsupported.
    const profile: FrameDefaultProfileRow = {
      frameId: 'bc-csr-sediment-numerical',
      pathway: 'human-health-food',
      note: 'bad',
      label: 'Test label',
      sourceIds: ['src-x'],
      defaults: [
        {
          inputKey: 'IR_food_kg_per_day',
          parameterValueId: 'pvid-test-ir',
          candidateGroupId: 'cg-ir-food-hh',
        },
      ],
    };
    const errors = validateFrameDefaultProfiles([profile], [APPROVED_IR_RECORD]);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => /unsupported/i.test(e))).toBe(true);
  });

  it('empty sourceIds -> error', () => {
    const profile = makeProfile({ sourceIds: [] });
    const errors = validateFrameDefaultProfiles([profile], [APPROVED_IR_RECORD]);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => /sourceIds/i.test(e))).toBe(true);
  });

  it('empty defaults -> error', () => {
    const profile = makeProfile({ defaults: [] });
    const errors = validateFrameDefaultProfiles([profile], [APPROVED_IR_RECORD]);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => /defaults/i.test(e))).toBe(true);
  });

  it('non-seedable input_key in a default -> error', () => {
    const profile = makeProfile({
      defaults: [
        {
          inputKey: 'foc',
          parameterValueId: 'pvid-foc',
          candidateGroupId: 'cg-foc',
        },
      ],
    });
    const focRecord = makeRecord({
      parameter_value_id: 'pvid-foc',
      input_key: 'foc',
      candidate_group_id: 'cg-foc',
    });
    const errors = validateFrameDefaultProfiles([profile], [focRecord]);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => /seedable|allowlist/i.test(e))).toBe(true);
  });

  it('duplicate input_key within a profile -> error', () => {
    const profile = makeProfile({
      defaults: [
        {
          inputKey: 'IR_food_kg_per_day',
          parameterValueId: 'pvid-test-ir',
          candidateGroupId: 'cg-ir-food-hh',
        },
        {
          inputKey: 'IR_food_kg_per_day', // duplicate
          parameterValueId: 'pvid-test-ir-2',
          candidateGroupId: 'cg-ir-food-hh',
        },
      ],
    });
    const records = [
      APPROVED_IR_RECORD,
      makeRecord({ parameter_value_id: 'pvid-test-ir-2' }),
    ];
    const errors = validateFrameDefaultProfiles([profile], records);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => /duplicate input_key/i.test(e))).toBe(true);
  });

  it('missing parameter_value_id in catalog -> error', () => {
    const profile = makeProfile({
      defaults: [
        {
          inputKey: 'IR_food_kg_per_day',
          parameterValueId: 'pvid-nonexistent',
          candidateGroupId: 'cg-ir-food-hh',
        },
      ],
    });
    const errors = validateFrameDefaultProfiles([profile], []); // empty records
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => /not found/i.test(e))).toBe(true);
  });

  it('record pathway mismatch -> error', () => {
    const record = makeRecord({
      parameter_value_id: 'pvid-test-ir',
      pathway: 'eco-direct-eqp', // profile expects human-health-food
    });
    const profile = makeProfile();
    const errors = validateFrameDefaultProfiles([profile], [record]);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => /pathway mismatch/i.test(e))).toBe(true);
  });

  it('record candidate_group_id mismatch -> error', () => {
    const record = makeRecord({
      parameter_value_id: 'pvid-test-ir',
      candidate_group_id: 'cg-different', // seed has cg-ir-food-hh
    });
    const profile = makeProfile();
    const errors = validateFrameDefaultProfiles([profile], [record]);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => /candidate_group_id mismatch/i.test(e))).toBe(true);
  });

  it('record substance_key not generic -> error', () => {
    const record = makeRecord({
      parameter_value_id: 'pvid-test-ir',
      substance_key: 'arsenic',
    });
    const profile = makeProfile();
    const errors = validateFrameDefaultProfiles([profile], [record]);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => /substance_key.*generic|generic.*substance/i.test(e))).toBe(true);
  });

  it('record value non-numeric -> error', () => {
    const record = makeRecord({
      parameter_value_id: 'pvid-test-ir',
      value: 'not-a-number' as unknown as number,
    });
    const profile = makeProfile();
    const errors = validateFrameDefaultProfiles([profile], [record]);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => /finite number|non-numeric/i.test(e))).toBe(true);
  });

  it('record unit mismatch -> error mentioning unit', () => {
    // An otherwise-valid record except unit is g/day instead of kg/day.
    const record = makeRecord({
      parameter_value_id: 'pvid-test-ir',
      unit: 'g/day', // wrong unit; canonical is kg/day
    });
    const profile = makeProfile();
    const errors = validateFrameDefaultProfiles([profile], [record]);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => /unit/i.test(e))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 12. getFrameDefaults: blocked (approved but not default-eligible)
//     Tests use mock-driven dispositions to isolate frameDefaults from the
//     real eligibility logic (tested in defaultSelectionPolicy's own suite).
// ---------------------------------------------------------------------------

describe('getFrameDefaults: approved -> blocked (mock-driven eligibility)', () => {
  const bcProfile = makeProfile();

  it('(i) disposition blocked_not_default -> status blocked, value null, reason contains token', () => {
    const disposition = 'blocked_not_default';
    const rationale = 'default_status is not_default; explicitly excluded from default pool';
    mockEligibility.mockReturnValue({ eligible: false, disposition, rationale });
    const results = getFrameDefaults('bc-protocol1-v5-dra', 'human-health-food', {
      profiles: [bcProfile],
      records: [APPROVED_IR_RECORD],
    });
    expect(results.length).toBe(1);
    const r = results[0];
    expect(r.status).toBe('blocked');
    expect(r.value).toBeNull();
    expect(r.reason).toContain(disposition);
    expect(r.reason).toContain(rationale);
    expect(
      getActiveFrameDefaults('bc-protocol1-v5-dra', 'human-health-food', {
        profiles: [bcProfile],
        records: [APPROVED_IR_RECORD],
      }),
    ).toEqual([]);
  });

  it('(ii) disposition blocked_frame_jurisdiction -> status blocked, value null, reason contains token', () => {
    const disposition = 'blocked_frame_jurisdiction';
    const rationale = 'jurisdiction Canada_federal not eligible for frame us-epa-usace-sediment';
    mockEligibility.mockReturnValue({ eligible: false, disposition, rationale });
    const usProfile: FrameDefaultProfileRow = {
      frameId: 'us-epa-usace-sediment',
      pathway: 'human-health-food',
      note: 'Test us-epa blocked jurisdiction via mock',
      label: 'Test label',
      sourceIds: ['src-us-001'],
      defaults: [
        {
          inputKey: 'IR_food_kg_per_day',
          parameterValueId: 'pvid-blocked-jur',
          candidateGroupId: 'cg-ir-food-hh',
        },
      ],
    };
    const record = makeRecord({
      parameter_value_id: 'pvid-blocked-jur',
      qa_status: 'approved',
    });
    const results = getFrameDefaults('us-epa-usace-sediment', 'human-health-food', {
      profiles: [usProfile],
      records: [record],
    });
    expect(results.length).toBe(1);
    const r = results[0];
    expect(r.status).toBe('blocked');
    expect(r.value).toBeNull();
    expect(r.reason).toContain(disposition);
    expect(r.reason).toContain(rationale);
    expect(
      getActiveFrameDefaults('us-epa-usace-sediment', 'human-health-food', {
        profiles: [usProfile],
        records: [record],
      }),
    ).toEqual([]);
  });

  it('(iii) disposition blocked_reference_mining -> status blocked, value null, reason contains token', () => {
    const disposition = 'blocked_reference_mining';
    const rationale = 'evidence_support_status is not approved_source_backed';
    mockEligibility.mockReturnValue({ eligible: false, disposition, rationale });
    const results = getFrameDefaults('bc-protocol1-v5-dra', 'human-health-food', {
      profiles: [bcProfile],
      records: [APPROVED_IR_RECORD],
    });
    expect(results.length).toBe(1);
    const r = results[0];
    expect(r.status).toBe('blocked');
    expect(r.value).toBeNull();
    expect(r.reason).toContain(disposition);
    expect(r.reason).toContain(rationale);
    expect(
      getActiveFrameDefaults('bc-protocol1-v5-dra', 'human-health-food', {
        profiles: [bcProfile],
        records: [APPROVED_IR_RECORD],
      }),
    ).toEqual([]);
  });

  it('(iv) disposition blocked_needs_qa -> status blocked, value null, reason contains token', () => {
    const disposition = 'blocked_needs_qa';
    const rationale = 'canonical_source_status is not direct_source_verified';
    mockEligibility.mockReturnValue({ eligible: false, disposition, rationale });
    const results = getFrameDefaults('bc-protocol1-v5-dra', 'human-health-food', {
      profiles: [bcProfile],
      records: [APPROVED_IR_RECORD],
    });
    expect(results.length).toBe(1);
    const r = results[0];
    expect(r.status).toBe('blocked');
    expect(r.value).toBeNull();
    expect(r.reason).toContain(disposition);
    expect(r.reason).toContain(rationale);
    expect(
      getActiveFrameDefaults('bc-protocol1-v5-dra', 'human-health-food', {
        profiles: [bcProfile],
        records: [APPROVED_IR_RECORD],
      }),
    ).toEqual([]);
  });

  it('mock-call-args: resolver calls getFrameSeedCandidateEligibility with (frameId, pathway, record)', () => {
    // Verify the wiring: when an approved record passes all contract checks,
    // the resolver delegates to the canonical gate with the right arguments.
    mockEligibility.mockReturnValue({
      eligible: false,
      disposition: 'blocked_not_default',
      rationale: 'test wiring check',
    });
    getFrameDefaults('bc-protocol1-v5-dra', 'human-health-food', {
      profiles: [bcProfile],
      records: [APPROVED_IR_RECORD],
    });
    expect(mockEligibility).toHaveBeenCalledOnce();
    expect(mockEligibility).toHaveBeenCalledWith(
      'bc-protocol1-v5-dra',
      'human-health-food',
      APPROVED_IR_RECORD,
    );
  });
});

// ---------------------------------------------------------------------------
// 13. getFrameDefaults: invalid -- unit mismatch
// ---------------------------------------------------------------------------

describe('getFrameDefaults: approved+eligible except unit mismatch -> invalid', () => {
  it('unit g/day for IR_food_kg_per_day -> status invalid, reason mentions unit', () => {
    // Unit mismatch is caught BEFORE the qa_status switch, so mock is not called.
    const record = makeRecord({
      parameter_value_id: 'pvid-unit-mismatch',
      substance_key: 'generic',
      pathway: 'human-health-food',
      input_key: 'IR_food_kg_per_day',
      value: 100,
      unit: 'g/day', // wrong: canonical is kg/day
      candidate_group_id: 'cg-ir-food-hh',
      qa_status: 'approved',
    });
    const profile = makeProfile({
      defaults: [
        {
          inputKey: 'IR_food_kg_per_day',
          parameterValueId: 'pvid-unit-mismatch',
          candidateGroupId: 'cg-ir-food-hh',
        },
      ],
    });
    const results = getFrameDefaults('bc-protocol1-v5-dra', 'human-health-food', {
      profiles: [profile],
      records: [record],
    });
    expect(results.length).toBe(1);
    const r = results[0];
    expect(r.status).toBe('invalid');
    expect(r.reason).toMatch(/unit/i);
    // Mismatch path exits before qa_status check, so eligibility gate not called.
    expect(mockEligibility).not.toHaveBeenCalled();
  });
});
