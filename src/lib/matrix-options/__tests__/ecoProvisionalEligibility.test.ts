// Tests for getEcoProvisionalEligibility (the Path B provisional seed gate). Runs against the REAL
// frames + sources (classifyCandidate reads them) with constructed catalog-row fixtures so we can
// exercise states the live eco data does not yet contain (superseded, reference-mining, user-entered).
// The contract: admit a row ONLY when it clears every STRUCTURAL check AND is merely pending
// verification/approval (real extracted source value). Plain ASCII only.
import { describe, it, expect } from 'vitest';
import { getEcoProvisionalEligibility } from '../defaultSelectionPolicy';
import type { ParameterValueRecord } from '../provenance/types';

function ecoRow(overrides: Partial<ParameterValueRecord> = {}): ParameterValueRecord {
  return {
    parameter_value_id: 'pv-eco-benzene-direct-fcv-esb',
    substance_key: 'benzene',
    pathway: 'eco-direct-eqp',
    input_key: 'fcv_ug_per_L',
    display_name: 'benzene fcv',
    value: 130,
    unit: 'ug/L',
    value_type: 'single_value',
    candidate_group_id: 'eco-direct-eqp__benzene__fcv_ug_per_L__US_federal',
    default_status: 'available_option',
    evidence_support_status: 'pending_source_locator',
    extraction_status: 'extracted_from_source',
    qa_status: 'needs_review',
    source_ids: ['src-us-epa-esb-tier2-nonionic-organics-2008'],
    equation_ids: ['eq-eco-direct-eqp-di-toro'],
    jurisdiction: 'US_federal',
    applicability: '',
    uncertainty: null,
    canonical_source_status: 'needs_direct_source_check',
    evidence_items: [],
    review_notes: '',
    ...overrides,
  } as ParameterValueRecord;
}

const FRAME = 'bc-protocol1-v5-dra';
const PATHWAY = 'eco-direct-eqp';

describe('getEcoProvisionalEligibility', () => {
  it('admits a needs_review / pending_source_locator eco row (build-first)', () => {
    expect(getEcoProvisionalEligibility(FRAME, PATHWAY, ecoRow()).eligible).toBe(true);
  });

  it('rejects a superseded row (value was replaced)', () => {
    expect(
      getEcoProvisionalEligibility(FRAME, PATHWAY, ecoRow({ qa_status: 'superseded' })).eligible,
    ).toBe(false);
  });

  it('rejects a reference-mining-lead evidence row (not source-backed)', () => {
    expect(
      getEcoProvisionalEligibility(
        FRAME,
        PATHWAY,
        ecoRow({ evidence_support_status: 'reference_mining_lead' }),
      ).eligible,
    ).toBe(false);
  });

  it('rejects a user-entered/derived evidence row', () => {
    expect(
      getEcoProvisionalEligibility(
        FRAME,
        PATHWAY,
        ecoRow({ evidence_support_status: 'user_entered_or_derived' }),
      ).eligible,
    ).toBe(false);
  });

  it('rejects a not_default row (structural exclusion)', () => {
    expect(
      getEcoProvisionalEligibility(FRAME, PATHWAY, ecoRow({ default_status: 'not_default' })).eligible,
    ).toBe(false);
  });

  it('rejects a row whose jurisdiction is ineligible for the frame', () => {
    // canada-fcsap-aquatic does not include US_federal -> structural jurisdiction block.
    expect(
      getEcoProvisionalEligibility('canada-fcsap-aquatic', PATHWAY, ecoRow()).eligible,
    ).toBe(false);
  });
});
