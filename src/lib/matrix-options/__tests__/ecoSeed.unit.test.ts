// Unit tests for ecoSeed.ts.
// Exercises edge cases of resolveEcoSeed (jurisdiction rank fallbacks,
// tie-breaker failures, string value parsing, invalid values, and provisional states) in isolation.
// Plain ASCII only (code point <= 127).

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { resolveEcoSeed } from '../ecoSeed';
import {
  getParameterValueRecordsForSubstance,
  getSourceRecord,
} from '../provenance/catalog';
import {
  getEcoProvisionalEligibility,
  getFrameJurisdictionRank,
} from '../defaultSelectionPolicy';
import { getPathwayApplicability } from '../regulatoryFrames';
import type { ParameterValueRecord } from '../provenance/types';

vi.mock('../provenance/catalog', () => ({
  getParameterValueRecordsForSubstance: vi.fn(),
  getSourceRecord: vi.fn(),
}));

vi.mock('../defaultSelectionPolicy', () => ({
  getEcoProvisionalEligibility: vi.fn(),
  getFrameJurisdictionRank: vi.fn(),
}));

vi.mock('../regulatoryFrames', () => ({
  getPathwayApplicability: vi.fn(),
}));

const mockGetRecords = vi.mocked(getParameterValueRecordsForSubstance);
const mockGetSource = vi.mocked(getSourceRecord);
const mockEligibility = vi.mocked(getEcoProvisionalEligibility);
const mockJurisdictionRank = vi.mocked(getFrameJurisdictionRank);
const mockPathwayApplicability = vi.mocked(getPathwayApplicability);

beforeEach(() => {
  vi.resetAllMocks();
  // Default to supported pathway applicability
  mockPathwayApplicability.mockReturnValue({ status: 'needs_review', note: 'mock' });
  // Default source resolver
  mockGetSource.mockImplementation((sid) => ({
    source_id: sid,
    short_citation: 'Mock Citation',
    currentness_status: 'current',
    authority_tier: 'tier_1_government_or_regulatory',
  } as any));
});

function makeEcoRecord(overrides: Partial<ParameterValueRecord>): ParameterValueRecord {
  return {
    parameter_value_id: 'pv-eco-test',
    substance_key: 'benzene',
    pathway: 'eco-direct-eqp',
    input_key: 'fcv_ug_per_L',
    value: 100,
    unit: 'ug/L',
    qa_status: 'approved',
    canonical_source_status: 'direct_source_verified',
    source_ids: ['src-test'],
    ...overrides,
  } as ParameterValueRecord;
}

describe('resolveEcoSeed unit tests', () => {
  it('falls back to Number.MAX_SAFE_INTEGER when getFrameJurisdictionRank returns null', () => {
    const record = makeEcoRecord({ parameter_value_id: 'pv-1' });
    mockGetRecords.mockReturnValue([record]);
    mockEligibility.mockReturnValue({ eligible: true, disposition: 'eligible_pending_approval', rationale: '' });
    mockJurisdictionRank.mockReturnValue(null); // rank is null

    const seed = resolveEcoSeed('benzene', 'eco-direct-eqp', 'fcv_ug_per_L', 'bc-protocol1-v5-dra');
    expect(seed).not.toBeNull();
    expect(seed?.parameterValueId).toBe('pv-1');
    expect(mockJurisdictionRank).toHaveBeenCalledWith('bc-protocol1-v5-dra', record);
  });

  it('returns null when top two candidates are tied (same rank and source pref)', () => {
    const r1 = makeEcoRecord({ parameter_value_id: 'pv-1', source_ids: ['src-1'] });
    const r2 = makeEcoRecord({ parameter_value_id: 'pv-2', source_ids: ['src-1'] }); // identical source
    mockGetRecords.mockReturnValue([r1, r2]);
    mockEligibility.mockReturnValue({ eligible: true, disposition: 'eligible_pending_approval', rationale: '' });
    mockJurisdictionRank.mockReturnValue(1); // identical rank

    const seed = resolveEcoSeed('benzene', 'eco-direct-eqp', 'fcv_ug_per_L', 'bc-protocol1-v5-dra');
    expect(seed).toBeNull();
  });

  it('converts string value to number and returns seed', () => {
    const record = makeEcoRecord({ value: '150' as any });
    mockGetRecords.mockReturnValue([record]);
    mockEligibility.mockReturnValue({ eligible: true, disposition: 'eligible_pending_approval', rationale: '' });
    mockJurisdictionRank.mockReturnValue(1);

    const seed = resolveEcoSeed('benzene', 'eco-direct-eqp', 'fcv_ug_per_L', 'bc-protocol1-v5-dra');
    expect(seed).not.toBeNull();
    expect(seed?.value).toBe(150);
  });

  it('returns null for non-finite or non-positive value', () => {
    const r1 = makeEcoRecord({ value: NaN });
    const r2 = makeEcoRecord({ value: -10 });
    const r3 = makeEcoRecord({ value: 'invalid-string' as any });

    mockEligibility.mockReturnValue({ eligible: true, disposition: 'eligible_pending_approval', rationale: '' });
    mockJurisdictionRank.mockReturnValue(1);

    mockGetRecords.mockReturnValue([r1]);
    expect(resolveEcoSeed('benzene', 'eco-direct-eqp', 'fcv_ug_per_L', 'bc-protocol1-v5-dra')).toBeNull();

    mockGetRecords.mockReturnValue([r2]);
    expect(resolveEcoSeed('benzene', 'eco-direct-eqp', 'fcv_ug_per_L', 'bc-protocol1-v5-dra')).toBeNull();

    mockGetRecords.mockReturnValue([r3]);
    expect(resolveEcoSeed('benzene', 'eco-direct-eqp', 'fcv_ug_per_L', 'bc-protocol1-v5-dra')).toBeNull();
  });

  it('handles provisional flags correctly based on qa_status and canonical_source_status', () => {
    // Both approved + direct_source_verified -> provisional: false
    const r1 = makeEcoRecord({ qa_status: 'approved', canonical_source_status: 'direct_source_verified' });
    mockGetRecords.mockReturnValue([r1]);
    mockEligibility.mockReturnValue({ eligible: true, disposition: 'eligible_pending_approval', rationale: '' });
    mockJurisdictionRank.mockReturnValue(1);
    expect(resolveEcoSeed('benzene', 'eco-direct-eqp', 'fcv_ug_per_L', 'bc-protocol1-v5-dra')?.provisional).toBe(false);

    // approved but NOT direct_source_verified -> provisional: true
    const r2 = makeEcoRecord({ qa_status: 'approved', canonical_source_status: 'needs_direct_source_check' });
    mockGetRecords.mockReturnValue([r2]);
    expect(resolveEcoSeed('benzene', 'eco-direct-eqp', 'fcv_ug_per_L', 'bc-protocol1-v5-dra')?.provisional).toBe(true);

    // NOT approved but direct_source_verified -> provisional: true
    const r3 = makeEcoRecord({ qa_status: 'needs_review', canonical_source_status: 'direct_source_verified' });
    mockGetRecords.mockReturnValue([r3]);
    expect(resolveEcoSeed('benzene', 'eco-direct-eqp', 'fcv_ug_per_L', 'bc-protocol1-v5-dra')?.provisional).toBe(true);
  });

  it('sorts candidates by jurisdictionRank first, then sourcePref', () => {
    const r1 = makeEcoRecord({ parameter_value_id: 'pv-1', source_ids: ['src-1'] });
    const r2 = makeEcoRecord({ parameter_value_id: 'pv-2', source_ids: ['src-2'] });
    mockGetRecords.mockReturnValue([r1, r2]);
    mockEligibility.mockReturnValue({ eligible: true, disposition: 'eligible_pending_approval', rationale: '' });
    mockJurisdictionRank.mockImplementation((fid, rec) => {
      return rec.parameter_value_id === 'pv-1' ? 2 : 1;
    });

    const seed = resolveEcoSeed('benzene', 'eco-direct-eqp', 'fcv_ug_per_L', 'bc-protocol1-v5-dra');
    expect(seed).not.toBeNull();
    expect(seed?.parameterValueId).toBe('pv-2');
  });

  it('handles source label fallbacks correctly when citation is missing or source_ids is empty', () => {
    mockEligibility.mockReturnValue({ eligible: true, disposition: 'eligible_pending_approval', rationale: '' });
    mockJurisdictionRank.mockReturnValue(1);

    // case 1: getSourceRecord returns undefined -> fallback to source id
    const r1 = makeEcoRecord({ parameter_value_id: 'pv-1', source_ids: ['src-unknown'] });
    mockGetRecords.mockReturnValue([r1]);
    mockGetSource.mockReturnValue(undefined); // unknown source
    const seed1 = resolveEcoSeed('benzene', 'eco-direct-eqp', 'fcv_ug_per_L', 'bc-protocol1-v5-dra');
    expect(seed1?.sourceShortLabel).toBe('src-unknown');

    // case 2: source_ids is empty -> fallback to 'unknown source'
    const r2 = makeEcoRecord({ parameter_value_id: 'pv-2', source_ids: [] });
    mockGetRecords.mockReturnValue([r2]);
    const seed2 = resolveEcoSeed('benzene', 'eco-direct-eqp', 'fcv_ug_per_L', 'bc-protocol1-v5-dra');
    expect(seed2?.sourceShortLabel).toBe('unknown source');
  });
});
