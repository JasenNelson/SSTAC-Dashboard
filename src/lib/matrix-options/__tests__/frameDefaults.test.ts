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
    expect(FRAME_DEFAULT_PROFILES.length).toBe(2);
    const bc = FRAME_DEFAULT_PROFILES.find((r) => r.frameId === 'bc-protocol1-v5-dra');
    expect(bc).toBeDefined();
    expect(bc?.pathway).toBe('human-health-food');
    expect(bc?.label).toBe('BC WLRS 2023, recreational');
    expect(bc?.defaults[0].parameterValueId).toBe(
      'pv-wlrs-2023-ir-food-recreational-bc',
    );
    const usEpa = FRAME_DEFAULT_PROFILES.find((r) => r.frameId === 'us-epa-usace-sediment');
    expect(usEpa).toBeDefined();
    expect(usEpa?.pathway).toBe('human-health-food');
    expect(usEpa?.label).toBe('US EPA 2000 AWQC, general adult population');
    expect(usEpa?.defaults[0].parameterValueId).toBe('pv-epa-2000-ir-food-general-us');
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

  it('every other ProvenancePathway has an empty seedable-key list', () => {
    const others = PROVENANCE_PATHWAYS.filter(
      (p) => p !== 'human-health-food',
    );
    for (const pathway of others) {
      expect(SEEDABLE_KEYS[pathway]).toEqual([]);
    }
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
