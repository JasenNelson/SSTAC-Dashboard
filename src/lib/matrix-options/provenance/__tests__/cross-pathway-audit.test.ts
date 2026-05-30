// Tests for buildCrossPathwayAudit and getCrossPathwayValueComparison.
// Plain ASCII only (code point <= 127).
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { ParameterValueRecord } from '../types';

// ---------------------------------------------------------------------------
// Minimal test record factory -- avoids importing the full 160+ record catalog.
// ---------------------------------------------------------------------------
function makeRecord(
  opts: {
    substance_key: string;
    input_key: string;
    pathway: ParameterValueRecord['pathway'];
    value: string | number;
    unit: string;
    default_status?: ParameterValueRecord['default_status'];
    evidence_support_status?: ParameterValueRecord['evidence_support_status'];
    qa_status?: ParameterValueRecord['qa_status'];
  },
): ParameterValueRecord {
  return {
    parameter_value_id: `pvid-${opts.substance_key}-${opts.pathway}-${opts.input_key}`,
    substance_key: opts.substance_key,
    pathway: opts.pathway,
    input_key: opts.input_key,
    display_name: opts.input_key,
    value: opts.value,
    unit: opts.unit,
    value_type: 'single_value',
    candidate_group_id: `cg-${opts.substance_key}-${opts.input_key}`,
    default_status: opts.default_status ?? 'current_default',
    evidence_support_status:
      opts.evidence_support_status ?? 'current_calculator_scaffold',
    extraction_status: 'extracted_from_current_calculator',
    qa_status: opts.qa_status ?? 'needs_review',
    source_ids: [],
    equation_ids: [],
    jurisdiction: 'BC',
    applicability: '',
    uncertainty: null,
    evidence_items: [],
    review_notes: '',
  };
}

// ---------------------------------------------------------------------------
// Mock the catalog module so tests control the record set.
// vi.mock must reference the module path relative to the test file.
// ---------------------------------------------------------------------------
vi.mock('../catalog', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../catalog')>();
  return {
    ...original,
    // PARAMETER_VALUE_RECORDS is overridden per-test via the __mocked__ array.
    get PARAMETER_VALUE_RECORDS() {
      return (
        (globalThis as unknown as Record<string, unknown>)['__mocked_pvr__'] as
          | ParameterValueRecord[]
          | undefined
      ) ?? (original.PARAMETER_VALUE_RECORDS as ParameterValueRecord[]);
    },
  };
});

// ---------------------------------------------------------------------------
// Helper to set the mocked record set for the current test.
// Must be called before importing from library.ts (vitest re-imports lazily).
// ---------------------------------------------------------------------------
function setRecords(records: ParameterValueRecord[]): void {
  (globalThis as unknown as Record<string, unknown>)['__mocked_pvr__'] =
    records;
}

function clearRecords(): void {
  (globalThis as unknown as Record<string, unknown>)['__mocked_pvr__'] =
    undefined;
}

// ---------------------------------------------------------------------------
// Import the functions under test AFTER vi.mock is set up.
// ---------------------------------------------------------------------------
import {
  buildCrossPathwayAudit,
  getCrossPathwayValueComparison,
} from '../library';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('buildCrossPathwayAudit', () => {
  beforeEach(() => {
    clearRecords();
  });

  it('excludes parameters that appear in only 1 pathway', () => {
    setRecords([
      makeRecord({
        substance_key: 'benzo_a_pyrene',
        input_key: 'logKow',
        pathway: 'eco-direct-eqp',
        value: '6.13',
        unit: 'dimensionless',
      }),
    ]);

    const summary = buildCrossPathwayAudit();
    expect(summary.rows).toHaveLength(0);
    expect(summary.totalParameters).toBe(0);
  });

  it('treats parameters with identical values across 2 pathways as consistent', () => {
    setRecords([
      makeRecord({
        substance_key: 'benzo_a_pyrene',
        input_key: 'logKow',
        pathway: 'eco-direct-eqp',
        value: '6.13',
        unit: 'dimensionless',
      }),
      makeRecord({
        substance_key: 'benzo_a_pyrene',
        input_key: 'logKow',
        pathway: 'eco-food-bsaf',
        value: '6.13',
        unit: 'dimensionless',
      }),
    ]);

    const summary = buildCrossPathwayAudit();
    expect(summary.rows).toHaveLength(1);
    const row = summary.rows[0];
    expect(row.is_inconsistent).toBe(false);
    expect(row.inconsistency_severity).toBe('none');
    expect(summary.consistentCount).toBe(1);
    expect(summary.minorIssuesCount).toBe(0);
    expect(summary.majorIssuesCount).toBe(0);
  });

  it('flags minor inconsistency when values differ but units match', () => {
    setRecords([
      makeRecord({
        substance_key: 'total_pcbs_aroclor_1254',
        input_key: 'baf_fish',
        pathway: 'eco-direct-eqp',
        value: '2500',
        unit: 'L/kg',
      }),
      makeRecord({
        substance_key: 'total_pcbs_aroclor_1254',
        input_key: 'baf_fish',
        pathway: 'eco-food-bsaf',
        value: '3100',
        unit: 'L/kg',
      }),
    ]);

    const summary = buildCrossPathwayAudit();
    expect(summary.rows).toHaveLength(1);
    const row = summary.rows[0];
    expect(row.is_inconsistent).toBe(true);
    expect(row.inconsistency_severity).toBe('minor');
    expect(summary.minorIssuesCount).toBe(1);
    expect(summary.majorIssuesCount).toBe(0);
  });

  it('flags major inconsistency when values differ AND units differ', () => {
    setRecords([
      makeRecord({
        substance_key: 'lead_inorganic',
        input_key: 'trv',
        pathway: 'human-health-direct',
        value: '0.0035',
        unit: 'mg/kg-bw/day',
      }),
      makeRecord({
        substance_key: 'lead_inorganic',
        input_key: 'trv',
        pathway: 'human-health-food',
        value: '3.5',
        unit: 'ug/kg-bw/day',
      }),
    ]);

    const summary = buildCrossPathwayAudit();
    expect(summary.rows).toHaveLength(1);
    const row = summary.rows[0];
    expect(row.is_inconsistent).toBe(true);
    expect(row.inconsistency_severity).toBe('major');
    expect(summary.majorIssuesCount).toBe(1);
  });

  it('flags major inconsistency when one pathway has empty value and another has a value', () => {
    setRecords([
      makeRecord({
        substance_key: 'benzo_a_pyrene',
        input_key: 'abs_dermal',
        pathway: 'human-health-direct',
        value: '0.13',
        unit: 'dimensionless',
      }),
      makeRecord({
        substance_key: 'benzo_a_pyrene',
        input_key: 'abs_dermal',
        pathway: 'human-health-food',
        value: '',
        unit: 'dimensionless',
      }),
    ]);

    const summary = buildCrossPathwayAudit();
    expect(summary.rows).toHaveLength(1);
    const row = summary.rows[0];
    expect(row.is_inconsistent).toBe(true);
    expect(row.inconsistency_severity).toBe('major');
    expect(summary.majorIssuesCount).toBe(1);
  });

  it('flags major inconsistency when values are equal but units differ (unit-mismatch-first rule)', () => {
    // "1 mg/kg" vs "1 ug/kg" -- same numeric string, different units.
    // Without the unit-first check this would be misclassified as severity=none.
    setRecords([
      makeRecord({
        substance_key: 'arsenic',
        input_key: 'trv',
        pathway: 'human-health-direct',
        value: '1',
        unit: 'mg/kg',
      }),
      makeRecord({
        substance_key: 'arsenic',
        input_key: 'trv',
        pathway: 'human-health-food',
        value: '1',
        unit: 'ug/kg',
      }),
    ]);

    const summary = buildCrossPathwayAudit();
    expect(summary.rows).toHaveLength(1);
    const row = summary.rows[0];
    expect(row.is_inconsistent).toBe(true);
    expect(row.inconsistency_severity).toBe('major');
    expect(summary.majorIssuesCount).toBe(1);
    expect(summary.minorIssuesCount).toBe(0);
  });

  it('picks current_default record when same pathway has multiple records', () => {
    // Two records for the same substance/input/pathway: one current_default, one available_option.
    // The audit should use the current_default for the comparison.
    setRecords([
      // current_default for human-health-direct
      makeRecord({
        substance_key: 'lead_inorganic',
        input_key: 'trv',
        pathway: 'human-health-direct',
        value: '0.0035',
        unit: 'mg/kg-bw/day',
        default_status: 'current_default',
      }),
      // available_option for the same pathway -- should be ignored
      makeRecord({
        substance_key: 'lead_inorganic',
        input_key: 'trv',
        pathway: 'human-health-direct',
        value: '0.005',
        unit: 'mg/kg-bw/day',
        default_status: 'available_option',
      }),
      // second pathway -- consistent with the current_default
      makeRecord({
        substance_key: 'lead_inorganic',
        input_key: 'trv',
        pathway: 'human-health-food',
        value: '0.0035',
        unit: 'mg/kg-bw/day',
        default_status: 'current_default',
      }),
    ]);

    const summary = buildCrossPathwayAudit();
    expect(summary.rows).toHaveLength(1);
    const row = summary.rows[0];
    // The audit only sees the current_default for human-health-direct (0.0035),
    // which matches human-health-food (0.0035) -> consistent.
    expect(row.is_inconsistent).toBe(false);
    expect(row.inconsistency_severity).toBe('none');
    const directEntry = row.values_by_pathway.get('human-health-direct');
    expect(directEntry?.value).toBe('0.0035');
    expect(directEntry?.default_status).toBe('current_default');
  });

  it('treats "0.5" and "0.50" as equal (value normalization)', () => {
    setRecords([
      makeRecord({
        substance_key: 'benzo_a_pyrene',
        input_key: 'bsaf_freshwater',
        pathway: 'eco-direct-eqp',
        value: '0.5',
        unit: 'kg_oc/kg_dw',
      }),
      makeRecord({
        substance_key: 'benzo_a_pyrene',
        input_key: 'bsaf_freshwater',
        pathway: 'eco-food-bsaf',
        value: '0.50',
        unit: 'kg_oc/kg_dw',
      }),
    ]);

    const summary = buildCrossPathwayAudit();
    expect(summary.rows).toHaveLength(1);
    const row = summary.rows[0];
    expect(row.is_inconsistent).toBe(false);
    expect(row.inconsistency_severity).toBe('none');
  });

  it('sorts results: major first, then minor, then consistent', () => {
    setRecords([
      // consistent pair
      makeRecord({
        substance_key: 'aaa',
        input_key: 'param_x',
        pathway: 'eco-direct-eqp',
        value: '1',
        unit: 'mg/L',
      }),
      makeRecord({
        substance_key: 'aaa',
        input_key: 'param_x',
        pathway: 'eco-food-bsaf',
        value: '1',
        unit: 'mg/L',
      }),
      // minor pair
      makeRecord({
        substance_key: 'bbb',
        input_key: 'param_y',
        pathway: 'eco-direct-eqp',
        value: '2',
        unit: 'mg/L',
      }),
      makeRecord({
        substance_key: 'bbb',
        input_key: 'param_y',
        pathway: 'eco-food-bsaf',
        value: '3',
        unit: 'mg/L',
      }),
      // major pair (units differ)
      makeRecord({
        substance_key: 'ccc',
        input_key: 'param_z',
        pathway: 'eco-direct-eqp',
        value: '10',
        unit: 'ug/L',
      }),
      makeRecord({
        substance_key: 'ccc',
        input_key: 'param_z',
        pathway: 'eco-food-bsaf',
        value: '0.01',
        unit: 'mg/L',
      }),
    ]);

    const summary = buildCrossPathwayAudit();
    expect(summary.rows).toHaveLength(3);
    expect(summary.rows[0].inconsistency_severity).toBe('major');
    expect(summary.rows[1].inconsistency_severity).toBe('minor');
    expect(summary.rows[2].inconsistency_severity).toBe('none');
    expect(summary.majorIssuesCount).toBe(1);
    expect(summary.minorIssuesCount).toBe(1);
    expect(summary.consistentCount).toBe(1);
  });

  it('returns correct summary counts for a mixed record set', () => {
    setRecords([
      // 2 consistent parameters
      makeRecord({
        substance_key: 'sub_a',
        input_key: 'logKow',
        pathway: 'eco-direct-eqp',
        value: '6.0',
        unit: 'dimensionless',
      }),
      makeRecord({
        substance_key: 'sub_a',
        input_key: 'logKow',
        pathway: 'eco-food-bsaf',
        value: '6.0',
        unit: 'dimensionless',
      }),
      makeRecord({
        substance_key: 'sub_b',
        input_key: 'logKow',
        pathway: 'eco-direct-eqp',
        value: '5.5',
        unit: 'dimensionless',
      }),
      makeRecord({
        substance_key: 'sub_b',
        input_key: 'logKow',
        pathway: 'eco-food-bsaf',
        value: '5.5',
        unit: 'dimensionless',
      }),
      // 1 minor inconsistency
      makeRecord({
        substance_key: 'sub_c',
        input_key: 'baf',
        pathway: 'eco-direct-eqp',
        value: '100',
        unit: 'L/kg',
      }),
      makeRecord({
        substance_key: 'sub_c',
        input_key: 'baf',
        pathway: 'eco-food-bsaf',
        value: '200',
        unit: 'L/kg',
      }),
      // 1 major inconsistency (units differ)
      makeRecord({
        substance_key: 'sub_d',
        input_key: 'trv',
        pathway: 'human-health-direct',
        value: '0.01',
        unit: 'mg/kg/day',
      }),
      makeRecord({
        substance_key: 'sub_d',
        input_key: 'trv',
        pathway: 'human-health-food',
        value: '10',
        unit: 'ug/kg/day',
      }),
      // Single-pathway parameter: excluded from audit
      makeRecord({
        substance_key: 'sub_e',
        input_key: 'trv',
        pathway: 'eco-direct-eqp',
        value: '5',
        unit: 'mg/kg/day',
      }),
    ]);

    const summary = buildCrossPathwayAudit();
    expect(summary.totalParameters).toBe(4);
    expect(summary.consistentCount).toBe(2);
    expect(summary.minorIssuesCount).toBe(1);
    expect(summary.majorIssuesCount).toBe(1);
    expect(summary.totalParameters).toBe(
      summary.consistentCount +
        summary.minorIssuesCount +
        summary.majorIssuesCount,
    );
  });

  it('excludes catalog evidence categories from the cross-pathway comparison', () => {
    // A substance/input that appears in one CALCULATOR pathway plus one catalog
    // EVIDENCE category must NOT be surfaced as a cross-pathway comparison: evidence
    // categories are not derivation pathways. After the calculator-only guard the group
    // has a single calculator pathway, so it falls below the 2+ gate and is excluded.
    setRecords([
      makeRecord({
        substance_key: 'arsenic',
        input_key: 'oral_rfd',
        pathway: 'human-health-direct',
        value: '0.0003',
        unit: 'mg/kg-bw/day',
      }),
      makeRecord({
        substance_key: 'arsenic',
        input_key: 'oral_rfd',
        pathway: 'hh-toxicity-value',
        value: '0.0009',
        unit: 'mg/kg-bw/day',
      }),
    ]);

    const summary = buildCrossPathwayAudit();
    expect(summary.rows).toHaveLength(0);
    expect(summary.totalParameters).toBe(0);
  });

  it('keeps the audit calculator-only even when an evidence category shares the substance/input', () => {
    // Two calculator pathways plus an evidence category on the same substance/input:
    // the audit compares only the two calculator pathways; the evidence category never
    // enters values_by_pathway (Map<ProvenancePathway>).
    setRecords([
      makeRecord({
        substance_key: 'benzo_a_pyrene',
        input_key: 'logKow',
        pathway: 'eco-direct-eqp',
        value: '6.13',
        unit: 'dimensionless',
      }),
      makeRecord({
        substance_key: 'benzo_a_pyrene',
        input_key: 'logKow',
        pathway: 'eco-food-bsaf',
        value: '6.13',
        unit: 'dimensionless',
      }),
      makeRecord({
        substance_key: 'benzo_a_pyrene',
        input_key: 'logKow',
        pathway: 'hh-toxicity-value',
        value: '6.13',
        unit: 'dimensionless',
      }),
    ]);

    const summary = buildCrossPathwayAudit();
    expect(summary.rows).toHaveLength(1);
    const row = summary.rows[0];
    expect(row.values_by_pathway.size).toBe(2);
    expect(row.values_by_pathway.get('eco-direct-eqp')).toBeDefined();
    expect(row.values_by_pathway.get('eco-food-bsaf')).toBeDefined();
    // The evidence category is absent from the calculator-only comparison map.
    expect(
      row.values_by_pathway.has('hh-toxicity-value' as never),
    ).toBe(false);
  });

  it('populates values_by_pathway map with correct entries', () => {
    setRecords([
      makeRecord({
        substance_key: 'benzo_a_pyrene',
        input_key: 'logKow',
        pathway: 'eco-direct-eqp',
        value: '6.13',
        unit: 'dimensionless',
        qa_status: 'approved',
        evidence_support_status: 'approved_source_backed',
      }),
      makeRecord({
        substance_key: 'benzo_a_pyrene',
        input_key: 'logKow',
        pathway: 'eco-food-bsaf',
        value: '6.50',
        unit: 'dimensionless',
        qa_status: 'needs_review',
        evidence_support_status: 'pending_source_locator',
      }),
    ]);

    const summary = buildCrossPathwayAudit();
    const row = summary.rows[0];
    expect(row).toBeDefined();
    const eqpEntry = row.values_by_pathway.get('eco-direct-eqp');
    const bsafEntry = row.values_by_pathway.get('eco-food-bsaf');
    expect(eqpEntry).toBeDefined();
    expect(bsafEntry).toBeDefined();
    expect(eqpEntry?.value).toBe('6.13');
    expect(eqpEntry?.qa_status).toBe('approved');
    expect(eqpEntry?.evidence_support_status).toBe('approved_source_backed');
    expect(bsafEntry?.value).toBe('6.50');
    expect(bsafEntry?.qa_status).toBe('needs_review');
  });
});

describe('getCrossPathwayValueComparison', () => {
  beforeEach(() => {
    clearRecords();
  });

  it('returns null when the parameter appears in fewer than 2 pathways', () => {
    setRecords([
      makeRecord({
        substance_key: 'benzo_a_pyrene',
        input_key: 'logKow',
        pathway: 'eco-direct-eqp',
        value: '6.13',
        unit: 'dimensionless',
      }),
    ]);

    const result = getCrossPathwayValueComparison('benzo_a_pyrene', 'logKow');
    expect(result).toBeNull();
  });

  it('returns null for a substance/input pair not in any record', () => {
    setRecords([
      makeRecord({
        substance_key: 'benzo_a_pyrene',
        input_key: 'logKow',
        pathway: 'eco-direct-eqp',
        value: '6.13',
        unit: 'dimensionless',
      }),
    ]);

    const result = getCrossPathwayValueComparison('unknown_substance', 'unknown_input');
    expect(result).toBeNull();
  });

  it('returns the matching audit row when the parameter appears in 2+ pathways', () => {
    setRecords([
      makeRecord({
        substance_key: 'benzo_a_pyrene',
        input_key: 'logKow',
        pathway: 'eco-direct-eqp',
        value: '6.13',
        unit: 'dimensionless',
      }),
      makeRecord({
        substance_key: 'benzo_a_pyrene',
        input_key: 'logKow',
        pathway: 'eco-food-bsaf',
        value: '6.50',
        unit: 'dimensionless',
      }),
    ]);

    const result = getCrossPathwayValueComparison('benzo_a_pyrene', 'logKow');
    expect(result).not.toBeNull();
    expect(result?.substance_key).toBe('benzo_a_pyrene');
    expect(result?.input_key).toBe('logKow');
    expect(result?.is_inconsistent).toBe(true);
    expect(result?.inconsistency_severity).toBe('minor');
  });
});
