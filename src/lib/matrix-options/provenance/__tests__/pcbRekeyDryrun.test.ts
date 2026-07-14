// FIXTURE-ONLY dry-run. Does NOT apply the PCB re-key; no production catalog
// or resolver behavior changes. See docs/MATRIX_OPTIONS_PCB_REKEY_DRYRUN_PLAN_2026_07_14.md.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveProvenanceRows } from '../resolver';
import type { CalculatorUsedValue, ParameterValueRecord } from '../types';

// Mock the catalog
const mockGetParameterValueRecord = vi.fn();
const mockGetParameterValueRecordsForSubstance = vi.fn();
const mockGetSourceRecord = vi.fn();
const mockGetParameterValueRecordById = vi.fn();

vi.mock('../catalog', () => ({
  getParameterValueRecord: (s: string, p: string, i: string) => mockGetParameterValueRecord(s, p, i),
  getParameterValueRecordsForSubstance: (s: string, p: string) => mockGetParameterValueRecordsForSubstance(s, p),
  getSourceRecord: (id: string) => mockGetSourceRecord(id),
  getParameterValueRecordById: (id: string) => mockGetParameterValueRecordById(id),
}));

vi.mock('../../defaultSelectionPolicy', () => ({
  getFrameJurisdictionRank: vi.fn().mockReturnValue(null),
}));

function paramRecord(overrides: Partial<ParameterValueRecord> = {}): ParameterValueRecord {
  return {
    parameter_value_id: 'pv-1',
    substance_key: 'lead',
    pathway: 'human-health-direct',
    input_key: 'rfd',
    display_name: 'Reference dose',
    value: 1,
    unit: 'mg/kg-bw/day',
    value_type: 'single_value',
    candidate_group_id: 'lead::human-health-direct::rfd',
    default_status: 'current_default',
    evidence_support_status: 'approved_source_backed',
    extraction_status: 'extracted_from_source',
    qa_status: 'approved',
    source_ids: [],
    equation_ids: [],
    jurisdiction: 'BC',
    applicability: '',
    uncertainty: null,
    evidence_items: [],
    review_notes: '',
    ...overrides,
  };
}

beforeEach(() => {
  mockGetParameterValueRecord.mockReset();
  mockGetParameterValueRecordsForSubstance.mockReset();
  mockGetSourceRecord.mockReset();
  mockGetParameterValueRecordById.mockReset();
});

describe('PCB Re-key Dry Run', () => {
  // Post-re-key synthetic rows
  const aliasFCV = paramRecord({
    parameter_value_id: 'pv-eco-polychlorinated_biphenyls_total_pcbs-direct-fcv-nrwqc',
    substance_key: 'total_pcbs_aroclor_1254',
    pathway: 'eco-direct-eqp',
    input_key: 'fcv_ug_per_L',
    value: 0.014,
    default_status: 'available_option',
    qa_status: 'approved'
  });

  const canonicalFCV = paramRecord({
    parameter_value_id: 'pv-pcb-fcv',
    substance_key: 'total_pcbs_aroclor_1254',
    pathway: 'eco-direct-eqp',
    input_key: 'fcv_ug_per_L',
    value: 0.014,
    default_status: 'current_default',
    qa_status: 'approved'
  });

  const aliasDirect = paramRecord({
    parameter_value_id: 'pv-p28-polychlorinated_biphenyls_total_pcbs-hh-direct-rfd',
    substance_key: 'total_pcbs_aroclor_1254',
    pathway: 'human-health-direct',
    input_key: 'rfd_oral_mg_per_kg_bw_day',
    value: 0.00013,
    default_status: 'available_option',
    qa_status: 'needs_review'
  });

  const canonicalIrisDirect = paramRecord({
    parameter_value_id: 'pv-iris-pcb-hh-direct-rfd-aroclor1254',
    substance_key: 'total_pcbs_aroclor_1254',
    pathway: 'human-health-direct',
    input_key: 'rfd_oral_mg_per_kg_bw_day',
    value: 0.00002,
    default_status: 'available_option',
    qa_status: 'approved'
  });

  // The canonical direct-RfD tuple is ALREADY anchored by a current_default
  // scaffold (pv-pcb-hh-direct-rfd, also 2.0e-5) in the real catalog
  // (parameter_values.json). resolveTupleRecord prefers a single current_default
  // BEFORE the approved fallback, so this row -- not the IRIS available_option --
  // wins the direct-RfD resolution. Omitting it (as an earlier draft did) would
  // prove an impossible case. See resolver.ts current_default preference.
  const canonicalDirectDefault = paramRecord({
    parameter_value_id: 'pv-pcb-hh-direct-rfd',
    substance_key: 'total_pcbs_aroclor_1254',
    pathway: 'human-health-direct',
    input_key: 'rfd_oral_mg_per_kg_bw_day',
    value: 0.00002,
    default_status: 'current_default',
    qa_status: 'needs_review'
  });

  const aliasFood = paramRecord({
    parameter_value_id: 'pv-p28-polychlorinated_biphenyls_total_pcbs-hh-food-rfd',
    substance_key: 'total_pcbs_aroclor_1254',
    pathway: 'human-health-food',
    input_key: 'rfd_oral_mg_per_kg_bw_day',
    value: 0.00013,
    default_status: 'available_option',
    qa_status: 'needs_review'
  });

  const canonicalFood = paramRecord({
    parameter_value_id: 'pv-p28-pcb-hh-food-rfd',
    substance_key: 'total_pcbs_aroclor_1254',
    pathway: 'human-health-food',
    input_key: 'rfd_oral_mg_per_kg_bw_day',
    value: 0.00013,
    default_status: 'available_option',
    qa_status: 'needs_review'
  });

  const fixtureDb = [aliasFCV, canonicalFCV, aliasDirect, canonicalDirectDefault, canonicalIrisDirect, aliasFood, canonicalFood];

  beforeEach(() => {
    mockGetParameterValueRecordsForSubstance.mockImplementation((s: string, p: string) => {
      return fixtureDb.filter(r => r.substance_key === s && r.pathway === p);
    });
    mockGetParameterValueRecord.mockImplementation((s: string, p: string, i: string) => {
      return fixtureDb.find(r => r.substance_key === s && r.pathway === p && r.input_key === i);
    });
    mockGetSourceRecord.mockReturnValue({
      source_id: 'mock-source'
    });
  });

  it('FCV tuple resolves to the canonical current_default record without double-supplying', () => {
    const used: CalculatorUsedValue[] = [{
      input_key: 'fcv_ug_per_L',
      label: 'FCV',
      value: 0.014,
      role: 'current calculator default',
      pathway: 'eco-direct-eqp',
      substance_key: 'total_pcbs_aroclor_1254'
    }];
    const rows = resolveProvenanceRows(used);
    expect(rows).toHaveLength(1);
    expect(rows[0].catalog_record).not.toBeNull();
    expect(rows[0].catalog_record?.parameter_value_id).toBe('pv-pcb-fcv');
  });

  it('RfD-direct tuple resolves to the existing current_default scaffold (not IRIS, not the re-keyed alias)', () => {
    // The canonical direct-RfD tuple already carries a current_default scaffold
    // (pv-pcb-hh-direct-rfd, 2.0e-5). resolveTupleRecord prefers a single
    // current_default over the approved IRIS available_option, so IRIS does NOT
    // win. The re-keyed alias (0.00013) is a non-matching value and is filtered
    // out. Net: re-keying the direct alias has NO effect on direct-RfD resolution.
    const used: CalculatorUsedValue[] = [{
      input_key: 'rfd_oral_mg_per_kg_bw_day',
      label: 'RfD',
      value: 0.00002,
      role: 'current calculator default',
      pathway: 'human-health-direct',
      substance_key: 'total_pcbs_aroclor_1254'
    }];
    const rows = resolveProvenanceRows(used);
    expect(rows).toHaveLength(1);
    expect(rows[0].catalog_record).not.toBeNull();
    expect(rows[0].catalog_record?.parameter_value_id).toBe('pv-pcb-hh-direct-rfd');
  });

  it('RfD-food DUPLICATE condition is detectable', () => {
    const candidates: ParameterValueRecord[] = mockGetParameterValueRecordsForSubstance('total_pcbs_aroclor_1254', 'human-health-food');
    const matching = candidates.filter(c => c.value === 0.00013);
    expect(matching).toHaveLength(2);

    const used: CalculatorUsedValue[] = [{
      input_key: 'rfd_oral_mg_per_kg_bw_day',
      label: 'RfD',
      value: 0.00013,
      role: 'current calculator default',
      pathway: 'human-health-food',
      substance_key: 'total_pcbs_aroclor_1254'
    }];
    const rows = resolveProvenanceRows(used);
    expect(rows[0].catalog_record).toBeNull();
  });
});
