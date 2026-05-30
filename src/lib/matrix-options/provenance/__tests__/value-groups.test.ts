// Tests for buildValueGroups jurisdiction de-duplication (via buildEvidenceLibraryView).
// Plain ASCII only (code point <= 127).
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { ParameterValueRecord } from '../types';

function makeRecord(opts: {
  substance_key: string;
  input_key: string;
  pathway: ParameterValueRecord['pathway'];
  candidate_group_id: string;
  jurisdiction: string;
  value: string | number;
  unit: string;
}): ParameterValueRecord {
  return {
    parameter_value_id: `pvid-${opts.candidate_group_id}-${opts.jurisdiction}`,
    substance_key: opts.substance_key,
    pathway: opts.pathway,
    input_key: opts.input_key,
    display_name: opts.input_key,
    value: opts.value,
    unit: opts.unit,
    value_type: 'single_value',
    candidate_group_id: opts.candidate_group_id,
    default_status: 'available_option',
    evidence_support_status: 'pending_source_locator',
    extraction_status: 'extracted_from_source',
    qa_status: 'needs_review',
    source_ids: [],
    equation_ids: [],
    jurisdiction: opts.jurisdiction,
    applicability: '',
    uncertainty: null,
    evidence_items: [],
    review_notes: '',
  };
}

vi.mock('../catalog', async (importOriginal) => {
  const original = await importOriginal<typeof import('../catalog')>();
  return {
    ...original,
    get PARAMETER_VALUE_RECORDS() {
      return (
        ((globalThis as unknown as Record<string, unknown>)[
          '__mocked_pvr_groups__'
        ] as ParameterValueRecord[] | undefined) ??
        (original.PARAMETER_VALUE_RECORDS as ParameterValueRecord[])
      );
    },
  };
});

function setRecords(records: ParameterValueRecord[]): void {
  (globalThis as unknown as Record<string, unknown>)['__mocked_pvr_groups__'] =
    records;
}

function clearRecords(): void {
  (globalThis as unknown as Record<string, unknown>)['__mocked_pvr_groups__'] =
    undefined;
}

import { buildEvidenceLibraryView, createEvidenceLibraryFilters } from '../library';

describe('buildValueGroups jurisdiction de-duplication', () => {
  beforeEach(() => {
    clearRecords();
  });

  it('collects the unique set of jurisdictions across a source-agnostic group', () => {
    // Two records in the SAME candidate group (source-agnostic) from different
    // jurisdictions. The group label must reflect both, not just the first record.
    setRecords([
      makeRecord({
        substance_key: 'arsenic',
        input_key: 'oral_rfd',
        pathway: 'hh-toxicity-value',
        candidate_group_id: 'cg-arsenic-oral_rfd',
        jurisdiction: 'US_federal',
        value: '0.0003',
        unit: 'mg/kg-bw/day',
      }),
      makeRecord({
        substance_key: 'arsenic',
        input_key: 'oral_rfd',
        pathway: 'hh-toxicity-value',
        candidate_group_id: 'cg-arsenic-oral_rfd',
        jurisdiction: 'BC',
        value: '0.0003',
        unit: 'mg/kg-bw/day',
      }),
    ]);

    const view = buildEvidenceLibraryView(createEvidenceLibraryFilters());
    const group = view.valueGroups.find(
      (g) => g.groupId === 'cg-arsenic-oral_rfd',
    );
    expect(group).toBeDefined();
    // uniqueArray de-duplicates and sorts, so 'BC' precedes 'US_federal'.
    expect(group?.jurisdictions).toEqual(['BC', 'US_federal']);
  });

  it('de-duplicates a single jurisdiction to one entry', () => {
    setRecords([
      makeRecord({
        substance_key: 'lead_inorganic',
        input_key: 'trv',
        pathway: 'eco-direct-eqp',
        candidate_group_id: 'cg-lead-trv',
        jurisdiction: 'BC',
        value: '1',
        unit: 'mg/kg',
      }),
      makeRecord({
        substance_key: 'lead_inorganic',
        input_key: 'trv',
        pathway: 'eco-direct-eqp',
        candidate_group_id: 'cg-lead-trv',
        jurisdiction: 'BC',
        value: '2',
        unit: 'mg/kg',
      }),
    ]);

    const view = buildEvidenceLibraryView(createEvidenceLibraryFilters());
    const group = view.valueGroups.find((g) => g.groupId === 'cg-lead-trv');
    expect(group).toBeDefined();
    expect(group?.jurisdictions).toEqual(['BC']);
  });
});
