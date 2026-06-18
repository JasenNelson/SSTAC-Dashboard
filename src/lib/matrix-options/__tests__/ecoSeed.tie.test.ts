// Unit test for resolveEcoSeed's WITHHOLD-on-tie branch. No real catalog data produces a genuine tie
// (the two real eco-direct sources differ in source preference), so this mocks the dependencies to
// construct one: two eligible candidates with the SAME jurisdiction rank AND the same (unlisted)
// source preference -> resolveEcoSeed must return null rather than guess. Plain ASCII only.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ParameterValueRecord } from '../provenance/types';

const mockGetRecordsForSubstance = vi.fn();
const mockGetEcoProvisionalEligibility = vi.fn();
const mockGetFrameJurisdictionRank = vi.fn();
const mockGetPathwayApplicability = vi.fn();

vi.mock('../provenance/catalog', () => ({
  getParameterValueRecordsForSubstance: (s: string, p: string) =>
    mockGetRecordsForSubstance(s, p),
  getSourceRecord: (id: string) => ({ source_id: id, short_citation: id }),
}));
vi.mock('../defaultSelectionPolicy', () => ({
  getEcoProvisionalEligibility: (f: string, p: string, r: ParameterValueRecord) =>
    mockGetEcoProvisionalEligibility(f, p, r),
  getFrameJurisdictionRank: (f: string, r: ParameterValueRecord) =>
    mockGetFrameJurisdictionRank(f, r),
}));
vi.mock('../regulatoryFrames', () => ({
  getPathwayApplicability: (f: string, p: string) =>
    mockGetPathwayApplicability(f, p),
}));

import { resolveEcoSeed } from '../ecoSeed';

function rec(overrides: Partial<ParameterValueRecord>): ParameterValueRecord {
  return {
    parameter_value_id: 'pv-x',
    substance_key: 'somesub',
    pathway: 'eco-direct-eqp',
    input_key: 'fcv_ug_per_L',
    display_name: 'somesub fcv',
    value: 1,
    unit: 'ug/L',
    value_type: 'single_value',
    candidate_group_id: 'g',
    default_status: 'available_option',
    evidence_support_status: 'pending_source_locator',
    extraction_status: 'extracted_from_source',
    qa_status: 'needs_review',
    source_ids: ['src-unknown-a'],
    equation_ids: [],
    jurisdiction: 'US_federal',
    applicability: '',
    uncertainty: null,
    evidence_items: [],
    review_notes: '',
    ...overrides,
  } as ParameterValueRecord;
}

beforeEach(() => {
  mockGetRecordsForSubstance.mockReset();
  mockGetEcoProvisionalEligibility.mockReset();
  mockGetFrameJurisdictionRank.mockReset();
  mockGetPathwayApplicability.mockReset();
  mockGetPathwayApplicability.mockReturnValue({ status: 'needs_review', note: '' });
  mockGetEcoProvisionalEligibility.mockReturnValue({
    eligible: true,
    disposition: 'blocked_needs_direct_source',
    rationale: '',
  });
  mockGetFrameJurisdictionRank.mockReturnValue(0);
});

describe('resolveEcoSeed -- withhold on an unbreakable tie', () => {
  it('returns null when two eligible candidates share jurisdiction rank AND source preference', () => {
    const a = rec({ parameter_value_id: 'pv-a', value: 10, source_ids: ['src-unknown-a'] });
    const b = rec({ parameter_value_id: 'pv-b', value: 20, source_ids: ['src-unknown-b'] });
    mockGetRecordsForSubstance.mockReturnValue([a, b]);
    const seed = resolveEcoSeed(
      'somesub',
      'eco-direct-eqp',
      'fcv_ug_per_L',
      'bc-protocol1-v5-dra',
    );
    expect(seed).toBeNull();
  });

  it('picks the preferred source when the tie IS breakable (ESB beats an unlisted source)', () => {
    const esb = rec({
      parameter_value_id: 'pv-esb',
      value: 10,
      source_ids: ['src-us-epa-esb-tier2-nonionic-organics-2008'],
    });
    const other = rec({ parameter_value_id: 'pv-other', value: 20, source_ids: ['src-unknown-b'] });
    mockGetRecordsForSubstance.mockReturnValue([other, esb]);
    const seed = resolveEcoSeed(
      'somesub',
      'eco-direct-eqp',
      'fcv_ug_per_L',
      'bc-protocol1-v5-dra',
    );
    expect(seed?.parameterValueId).toBe('pv-esb');
  });
});
