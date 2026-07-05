import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  resolveSourceRecords,
  resolveEquationRecords,
  resolveEquationsForPathway,
  resolveProvenanceRows,
} from '../resolver';
import type {
  CalculatorUsedValue,
  EquationRecord,
  ParameterValueRecord,
  SourceRecord,
} from '../types';

// ---------------------------------------------------------------------------
// Mock the catalog so resolver logic is tested in isolation from the bundled
// reference JSON. The catalog functions are simple lookups; here we make them
// return controlled fixtures (or undefined) so we exercise resolver's mapping,
// role-resolution, evidence-status, and compaction branches deterministically.
// ---------------------------------------------------------------------------

const mockGetSourceRecord = vi.fn();
const mockGetEquationRecord = vi.fn();
const mockGetPathwayEquationRecords = vi.fn();
const mockGetParameterValueRecord = vi.fn();
const mockGetParameterValueRecordById = vi.fn();
const mockGetParameterValueRecordsForSubstance = vi.fn();
const mockGetFrameJurisdictionRank = vi.fn();

vi.mock('../catalog', () => ({
  getSourceRecord: (id: string) => mockGetSourceRecord(id),
  getEquationRecord: (id: string) => mockGetEquationRecord(id),
  getPathwayEquationRecords: (p: string) => mockGetPathwayEquationRecords(p),
  getParameterValueRecord: (s: string, p: string, i: string) =>
    mockGetParameterValueRecord(s, p, i),
  getParameterValueRecordById: (id: string) =>
    mockGetParameterValueRecordById(id),
  getParameterValueRecordsForSubstance: (s: string, p: string) =>
    mockGetParameterValueRecordsForSubstance(s, p),
}));

// resolver.ts imports getFrameJurisdictionRank from the frame source-priority policy (used only in
// the dual-approved jurisdiction tiebreak, which the real-catalog scenarios cover in
// resolver.integration.test.ts). Mock it here so this ISOLATED unit suite does not pull the policy
// module's transitive `../catalog` (PARAMETER_VALUE_RECORDS) import through its own catalog mock.
// Returning null = "no frame jurisdiction preference", so the tiebreak is inert in these unit cases.
vi.mock('../../defaultSelectionPolicy', () => ({
  getFrameJurisdictionRank: (frameId: unknown, record: unknown) => mockGetFrameJurisdictionRank(frameId, record),
}));

function source(id: string): SourceRecord {
  return {
    source_id: id,
    short_citation: id,
    title: `Title ${id}`,
    year: 2024,
    publisher: null,
    doi: null,
    url: null,
    zotero_item_key: null,
    zotero_collection_path: null,
    zotero_attachment_keys: [],
    zotero_status: 'not_in_zotero',
    external_file_hint: null,
    file_storage: 'repo_metadata_only',
    notes: null,
    authority_scope: 'bc-guidance',
    currentness_status: 'current',
    version: null,
    page_last_modified: null,
    checked_at: null,
    conflict_rule: null,
    supersedes_source_ids: [],
  };
}

function equation(id: string): EquationRecord {
  return {
    equation_id: id,
    pathway: 'human-health-direct',
    display_name: `Equation ${id}`,
    equation_latex: 'x = y',
    plain_language: 'plain',
    input_keys: [],
    output_keys: [],
    unit_notes: '',
    source_ids: [],
    applicability: '',
    qa_status: 'approved',
    evidence_items: [],
    review_notes: '',
    evidence_support_status: 'approved_source_backed',
  };
}

function paramRecord(
  overrides: Partial<ParameterValueRecord> = {},
): ParameterValueRecord {
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
    source_ids: ['src-a', 'src-b'],
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
  mockGetSourceRecord.mockReset();
  mockGetEquationRecord.mockReset();
  mockGetPathwayEquationRecords.mockReset();
  mockGetParameterValueRecord.mockReset();
  mockGetParameterValueRecordById.mockReset();
  mockGetParameterValueRecordsForSubstance.mockReset();
  mockGetParameterValueRecordsForSubstance.mockReturnValue([]);
  mockGetFrameJurisdictionRank.mockReset();
  mockGetFrameJurisdictionRank.mockReturnValue(null);
});

describe('resolveSourceRecords', () => {
  it('maps ids to records preserving order', () => {
    mockGetSourceRecord.mockImplementation((id: string) => source(id));
    const out = resolveSourceRecords(['s1', 's2']);
    expect(out.map((s) => s.source_id)).toEqual(['s1', 's2']);
  });

  it('drops ids with no matching record (compact removes undefined)', () => {
    mockGetSourceRecord.mockImplementation((id: string) =>
      id === 'known' ? source(id) : undefined,
    );
    const out = resolveSourceRecords(['known', 'missing', 'known']);
    expect(out).toHaveLength(2);
    expect(out.every((s) => s.source_id === 'known')).toBe(true);
  });

  it('returns [] for an empty id list', () => {
    expect(resolveSourceRecords([])).toEqual([]);
  });
});

describe('resolveEquationRecords', () => {
  it('maps and compacts equation ids', () => {
    mockGetEquationRecord.mockImplementation((id: string) =>
      id === 'eq1' ? equation(id) : undefined,
    );
    const out = resolveEquationRecords(['eq1', 'gone']);
    expect(out).toHaveLength(1);
    expect(out[0].equation_id).toBe('eq1');
  });
});

describe('resolveEquationsForPathway', () => {
  it('delegates to getPathwayEquationRecords with the pathway', () => {
    mockGetPathwayEquationRecords.mockReturnValue([equation('eqP')]);
    const out = resolveEquationsForPathway('human-health-direct');
    expect(mockGetPathwayEquationRecords).toHaveBeenCalledWith('human-health-direct');
    expect(out[0].equation_id).toBe('eqP');
  });
});

describe('resolveProvenanceRows -- catalog lookup gating', () => {
  it('does not consult the catalog when substance_key or pathway is absent', () => {
    const used: CalculatorUsedValue[] = [
      { input_key: 'bw', label: 'Body weight', value: 70, role: 'user-entered value' },
    ];
    const [row] = resolveProvenanceRows(used);
    expect(mockGetParameterValueRecordsForSubstance).not.toHaveBeenCalled();
    expect(row.catalog_record).toBeNull();
    expect(row.qa_status).toBe('not_cataloged');
    expect(row.default_status).toBe('not_cataloged');
    expect(row.candidate_group_id).toBeNull();
  });

  it('looks up the catalog with substance/pathway when both keys present', () => {
    mockGetParameterValueRecordsForSubstance.mockReturnValue([paramRecord()]);
    mockGetSourceRecord.mockImplementation((id: string) => source(id));
    const used: CalculatorUsedValue[] = [
      {
        input_key: 'rfd',
        label: '',
        value: 1,
        role: 'source-backed default',
        pathway: 'human-health-direct',
        substance_key: 'lead',
      },
    ];
    resolveProvenanceRows(used);
    expect(mockGetParameterValueRecordsForSubstance).toHaveBeenCalledWith(
      'lead',
      'human-health-direct',
    );
  });

  it('resolves by EXACT parameter_value_id when present (disambiguates a candidate group)', () => {
    // Two records share substance/pathway/input but differ by id + value. The
    // id-based lookup must return the EXACT cited record, not the ambiguous
    // (substance, pathway, input) .find() that getParameterValueRecord would do.
    const recreational = paramRecord({
      parameter_value_id: 'pv-wlrs-2023-ir-food-recreational-bc',
      value: 0.111,
      source_ids: ['src-wlrs'],
    });
    mockGetParameterValueRecordById.mockReturnValue(recreational);
    mockGetSourceRecord.mockImplementation((id: string) => source(id));
    const used: CalculatorUsedValue[] = [
      {
        input_key: 'IR_food_kg_per_day',
        label: 'Food ingestion',
        value: 0.111,
        role: 'source-backed default',
        pathway: 'human-health-food',
        substance_key: 'generic',
        parameter_value_id: 'pv-wlrs-2023-ir-food-recreational-bc',
      },
    ];
    const [row] = resolveProvenanceRows(used);
    // id lookup used; the ambiguous substance/pathway lookup NOT used.
    expect(mockGetParameterValueRecordById).toHaveBeenCalledWith(
      'pv-wlrs-2023-ir-food-recreational-bc',
    );
    expect(mockGetParameterValueRecord).not.toHaveBeenCalled();
    expect(row.catalog_record?.parameter_value_id).toBe(
      'pv-wlrs-2023-ir-food-recreational-bc',
    );
  });
});

describe('resolveProvenanceRows -- formatValue', () => {
  function rowFor(value: CalculatorUsedValue['value'], unit?: string) {
    mockGetParameterValueRecord.mockReturnValue(undefined);
    const used: CalculatorUsedValue[] = [
      { input_key: 'k', label: 'L', value, unit, role: 'user-entered value' },
    ];
    return resolveProvenanceRows(used)[0];
  }

  it('renders value with a unit suffix', () => {
    expect(rowFor(70, 'kg').current_value).toBe('70 kg');
  });

  it('omits the suffix for a "unitless" unit', () => {
    expect(rowFor(0.5, 'unitless').current_value).toBe('0.5');
  });

  it('omits the suffix when no unit is provided', () => {
    expect(rowFor(42).current_value).toBe('42');
  });

  it('renders "Not provided" for null', () => {
    expect(rowFor(null, 'kg').current_value).toBe('Not provided');
  });

  it('renders "Not provided" for an empty string', () => {
    expect(rowFor('', 'kg').current_value).toBe('Not provided');
  });

  it('prefers the used-value unit over the catalog unit', () => {
    mockGetParameterValueRecordsForSubstance.mockReturnValue([paramRecord({ unit: 'catalog-unit' })]);
    mockGetSourceRecord.mockImplementation((id: string) => source(id));
    const used: CalculatorUsedValue[] = [
      {
        input_key: 'rfd',
        label: 'L',
        value: 1,
        unit: 'used-unit',
        role: 'user-entered value',
        pathway: 'human-health-direct',
        substance_key: 'lead',
      },
    ];
    expect(resolveProvenanceRows(used)[0].current_value).toBe('1 used-unit');
  });

  it('falls back to the catalog unit when the used value omits a unit', () => {
    mockGetParameterValueRecordsForSubstance.mockReturnValue([paramRecord({ unit: 'catalog-unit' })]);
    mockGetSourceRecord.mockImplementation((id: string) => source(id));
    const used: CalculatorUsedValue[] = [
      {
        input_key: 'rfd',
        label: 'L',
        value: 1,
        role: 'user-entered value',
        pathway: 'human-health-direct',
        substance_key: 'lead',
      },
    ];
    expect(resolveProvenanceRows(used)[0].current_value).toBe('1 catalog-unit');
  });
});

describe('resolveProvenanceRows -- label fallback chain', () => {
  it('uses the used-value label when present', () => {
    mockGetParameterValueRecord.mockReturnValue(undefined);
    const [row] = resolveProvenanceRows([
      { input_key: 'k', label: 'Used label', value: 1, role: 'user-entered value' },
    ]);
    expect(row.label).toBe('Used label');
  });

  it('falls back to the catalog display_name when the label is blank', () => {
    mockGetParameterValueRecordsForSubstance.mockReturnValue([
      paramRecord({ display_name: 'Catalog name' }),
    ]);
    mockGetSourceRecord.mockImplementation((id: string) => source(id));
    const [row] = resolveProvenanceRows([
      {
        input_key: 'rfd',
        label: '',
        value: 1,
        role: 'user-entered value',
        pathway: 'human-health-direct',
        substance_key: 'lead',
      },
    ]);
    expect(row.label).toBe('Catalog name');
  });

  it('falls back to input_key when both label and catalog name are unavailable', () => {
    mockGetParameterValueRecord.mockReturnValue(undefined);
    const [row] = resolveProvenanceRows([
      { input_key: 'the_key', label: '', value: 1, role: 'user-entered value' },
    ]);
    expect(row.label).toBe('the_key');
  });
});

describe('resolveProvenanceRows -- resolveRole', () => {
  function roleFor(
    usedRole: CalculatorUsedValue['role'],
    record: ParameterValueRecord | null,
  ) {
    mockGetParameterValueRecordsForSubstance.mockReturnValue(record ? [record] : []);
    mockGetSourceRecord.mockImplementation((id: string) => source(id));
    return resolveProvenanceRows([
      {
        input_key: 'rfd',
        label: 'L',
        value: 1,
        role: usedRole,
        pathway: 'human-health-direct',
        substance_key: 'lead',
      },
    ])[0].role;
  }

  it('keeps "source-backed default" when the catalog record IS approved_source_backed', () => {
    expect(
      roleFor(
        'source-backed default',
        paramRecord({ evidence_support_status: 'approved_source_backed' }),
      ),
    ).toBe('source-backed default');
  });

  it('downgrades to "current calculator default" when not source-backed and default is current', () => {
    expect(
      roleFor(
        'source-backed default',
        paramRecord({
          evidence_support_status: 'current_calculator_scaffold',
          default_status: 'current_default',
        }),
      ),
    ).toBe('current calculator default');
  });

  it('downgrades to "placeholder default" when not source-backed and not the current default', () => {
    expect(
      roleFor(
        'source-backed default',
        paramRecord({
          evidence_support_status: 'pending_source_locator',
          default_status: 'available_option',
        }),
      ),
    ).toBe('placeholder default');
  });

  it('downgrades to "placeholder default" when the role is source-backed but there is no catalog record', () => {
    // catalogRecord is null -> not approved_source_backed -> not current_default -> placeholder.
    expect(roleFor('source-backed default', null)).toBe('placeholder default');
  });

  it('passes through a non-"source-backed default" role unchanged', () => {
    expect(roleFor('user-entered value', paramRecord())).toBe('user-entered value');
  });
});

describe('resolveProvenanceRows -- resolveEvidenceSupportStatus', () => {
  function statusFor(
    usedRole: CalculatorUsedValue['role'],
    record: ParameterValueRecord | null,
  ) {
    mockGetParameterValueRecordsForSubstance.mockReturnValue(record ? [record] : []);
    mockGetSourceRecord.mockImplementation((id: string) => source(id));
    return resolveProvenanceRows([
      {
        input_key: 'rfd',
        label: 'L',
        value: 1,
        role: usedRole,
        pathway: 'human-health-direct',
        substance_key: 'lead',
      },
    ])[0].evidence_support_status;
  }

  it('uses the catalog record status when a record exists', () => {
    expect(
      statusFor('user-entered value', paramRecord({ evidence_support_status: 'reference_mining_lead' })),
    ).toBe('reference_mining_lead');
  });

  it('maps user-entered/derived/screening roles to user_entered_or_derived when uncataloged', () => {
    expect(statusFor('user-entered value', null)).toBe('user_entered_or_derived');
    expect(statusFor('derived value', null)).toBe('user_entered_or_derived');
    expect(statusFor('screening assumption', null)).toBe('user_entered_or_derived');
  });

  it('maps other roles to current_calculator_scaffold when uncataloged', () => {
    expect(statusFor('source-backed option', null)).toBe('current_calculator_scaffold');
  });
});

describe('resolveProvenanceRows -- sources, note, and passthrough fields', () => {
  it('resolves catalog source_ids into source records', () => {
    mockGetParameterValueRecordsForSubstance.mockReturnValue([paramRecord({ source_ids: ['s1', 's2'] })]);
    mockGetSourceRecord.mockImplementation((id: string) => source(id));
    const [row] = resolveProvenanceRows([
      {
        input_key: 'rfd',
        label: 'L',
        value: 1,
        role: 'user-entered value',
        pathway: 'human-health-direct',
        substance_key: 'lead',
      },
    ]);
    expect(row.sources.map((s) => s.source_id)).toEqual(['s1', 's2']);
  });

  it('returns no sources for an uncataloged value', () => {
    mockGetParameterValueRecord.mockReturnValue(undefined);
    const [row] = resolveProvenanceRows([
      { input_key: 'k', label: 'L', value: 1, role: 'user-entered value' },
    ]);
    expect(row.sources).toEqual([]);
  });

  it('prefers the used-value note over the catalog review_notes', () => {
    mockGetParameterValueRecordsForSubstance.mockReturnValue([paramRecord({ review_notes: 'catalog note' })]);
    mockGetSourceRecord.mockImplementation((id: string) => source(id));
    const [row] = resolveProvenanceRows([
      {
        input_key: 'rfd',
        label: 'L',
        value: 1,
        role: 'user-entered value',
        pathway: 'human-health-direct',
        substance_key: 'lead',
        note: 'used note',
      },
    ]);
    expect(row.note).toBe('used note');
  });

  it('falls back to the catalog review_notes when there is no used-value note', () => {
    mockGetParameterValueRecordsForSubstance.mockReturnValue([paramRecord({ review_notes: 'catalog note' })]);
    mockGetSourceRecord.mockImplementation((id: string) => source(id));
    const [row] = resolveProvenanceRows([
      {
        input_key: 'rfd',
        label: 'L',
        value: 1,
        role: 'user-entered value',
        pathway: 'human-health-direct',
        substance_key: 'lead',
      },
    ]);
    expect(row.note).toBe('catalog note');
  });

  it('carries qa_status / default_status / candidate_group_id from the catalog record', () => {
    mockGetParameterValueRecordsForSubstance.mockReturnValue([
      paramRecord({
        qa_status: 'approved',
        default_status: 'current_default',
        candidate_group_id: 'cg-7',
      }),
    ]);
    mockGetSourceRecord.mockImplementation((id: string) => source(id));
    const [row] = resolveProvenanceRows([
      {
        input_key: 'rfd',
        label: 'L',
        value: 1,
        role: 'user-entered value',
        pathway: 'human-health-direct',
        substance_key: 'lead',
      },
    ]);
    expect(row.qa_status).toBe('approved');
    expect(row.default_status).toBe('current_default');
    expect(row.candidate_group_id).toBe('cg-7');
  });

  it('maps every used value to exactly one resolved row (order + count preserved)', () => {
    mockGetParameterValueRecord.mockReturnValue(undefined);
    const used: CalculatorUsedValue[] = [
      { input_key: 'a', label: 'A', value: 1, role: 'user-entered value' },
      { input_key: 'b', label: 'B', value: 2, role: 'derived value' },
      { input_key: 'c', label: 'C', value: 3, role: 'screening assumption' },
    ];
    const rows = resolveProvenanceRows(used);
    expect(rows.map((r) => r.input_key)).toEqual(['a', 'b', 'c']);
  });
});

describe('resolveProvenanceRows -- value-aware multi-candidate tuple fallback', () => {
  it('returns the single tuple match when only one candidate exists (legacy behavior)', () => {
    const rec = paramRecord({ value: 0.0036 });
    mockGetParameterValueRecord.mockReturnValue(rec);
    mockGetParameterValueRecordsForSubstance.mockReturnValue([rec]);
    mockGetSourceRecord.mockImplementation((id: string) => source(id));
    const [row] = resolveProvenanceRows([
      {
        input_key: 'rfd',
        label: 'L',
        value: 0.0036,
        role: 'user-entered value',
        pathway: 'human-health-direct',
        substance_key: 'lead',
      },
    ]);
    expect(row.catalog_record?.parameter_value_id).toBe('pv-1');
  });

  it('attributes to the candidate whose VALUE matches the used value (multi-source)', () => {
    const esb = paramRecord({ parameter_value_id: 'pv-esb', value: 0.1699 });
    const nrwqc = paramRecord({ parameter_value_id: 'pv-nrwqc', value: 0.17 });
    mockGetParameterValueRecord.mockReturnValue(esb); // first-match = esb
    mockGetParameterValueRecordsForSubstance.mockReturnValue([esb, nrwqc]);
    mockGetSourceRecord.mockImplementation((id: string) => source(id));
    const [row] = resolveProvenanceRows([
      {
        input_key: 'rfd',
        label: 'L',
        value: 0.17, // matches nrwqc, NOT the first-match esb
        role: 'user-entered value',
        pathway: 'human-health-direct',
        substance_key: 'lead',
      },
    ]);
    expect(row.catalog_record?.parameter_value_id).toBe('pv-nrwqc');
  });

  it('returns null (no mis-attribution) when the used value matches NO candidate', () => {
    const a = paramRecord({ parameter_value_id: 'pv-a', value: 1.04 });
    const b = paramRecord({ parameter_value_id: 'pv-b', value: 4.4 });
    mockGetParameterValueRecord.mockReturnValue(a);
    mockGetParameterValueRecordsForSubstance.mockReturnValue([a, b]);
    const [row] = resolveProvenanceRows([
      {
        input_key: 'rfd',
        label: 'L',
        value: 0.043, // library-seeded value; matches neither catalog candidate
        role: 'user-entered value',
        pathway: 'human-health-direct',
        substance_key: 'lead',
      },
    ]);
    expect(row.catalog_record).toBeNull();
    expect(row.qa_status).toBe('not_cataloged');
  });

  it('returns null when the used value matches MORE THAN ONE candidate and none is current_default', () => {
    const a = paramRecord({ parameter_value_id: 'pv-a', value: 0.056, default_status: 'available_option' });
    const b = paramRecord({ parameter_value_id: 'pv-b', value: 0.056, default_status: 'available_option' });
    mockGetParameterValueRecord.mockReturnValue(a);
    mockGetParameterValueRecordsForSubstance.mockReturnValue([a, b]);
    const [row] = resolveProvenanceRows([
      {
        input_key: 'rfd',
        label: 'L',
        value: 0.056,
        role: 'user-entered value',
        pathway: 'human-health-direct',
        substance_key: 'lead',
      },
    ]);
    expect(row.catalog_record).toBeNull();
  });

  it('breaks a value tie toward the current_default candidate (HH default-load attribution)', () => {
    // Mirrors the real HH-direct case: a current_default scaffold + a same-valued IRIS/P28 sibling.
    // The default-load value matches BOTH; the current_default must keep the attribution.
    const wired = paramRecord({
      parameter_value_id: 'pv-arsenic-hh-direct-rfd',
      value: 0.0003,
      default_status: 'current_default',
    });
    const sibling = paramRecord({
      parameter_value_id: 'pv-arsenic-iris-rfd',
      value: 0.0003,
      default_status: 'available_option',
    });
    mockGetParameterValueRecordsForSubstance.mockReturnValue([wired, sibling]);
    mockGetSourceRecord.mockImplementation((id: string) => source(id));
    const [row] = resolveProvenanceRows([
      {
        input_key: 'rfd',
        label: 'Oral RfD',
        value: 0.0003,
        unit: 'mg/kg-bw/day',
        role: 'current calculator default',
        pathway: 'human-health-direct',
        substance_key: 'arsenic_inorganic',
      },
    ]);
    expect(row.catalog_record?.parameter_value_id).toBe('pv-arsenic-hh-direct-rfd');
    expect(row.default_status).toBe('current_default');
  });

  it('falls back to null when parameter_value_id is provided but not found in catalog', () => {
    mockGetParameterValueRecordById.mockReturnValue(undefined);
    const [row] = resolveProvenanceRows([
      {
        input_key: 'rfd',
        label: 'Oral RfD',
        value: 0.0003,
        role: 'current calculator default',
        pathway: 'human-health-direct',
        substance_key: 'arsenic_inorganic',
        parameter_value_id: 'non-existent-id',
      },
    ]);
    expect(row.catalog_record).toBeNull();
  });

  it('returns null when valuesMatch receives null or empty usedValue', () => {
    const a = paramRecord({ parameter_value_id: 'pv-a', value: 0.056 });
    mockGetParameterValueRecordsForSubstance.mockReturnValue([a]);
    const [rowNull] = resolveProvenanceRows([
      {
        input_key: 'rfd',
        label: 'L',
        value: null,
        role: 'user-entered value',
        pathway: 'human-health-direct',
        substance_key: 'lead',
      },
    ]);
    const [rowEmpty] = resolveProvenanceRows([
      {
        input_key: 'rfd',
        label: 'L',
        value: '',
        role: 'user-entered value',
        pathway: 'human-health-direct',
        substance_key: 'lead',
      },
    ]);
    expect(rowNull.catalog_record).toBeNull();
    expect(rowEmpty.catalog_record).toBeNull();
  });

  it('resolves to the single approved candidate when tie cannot be resolved by current_default', () => {
    const a = paramRecord({ parameter_value_id: 'pv-a', value: 0.056, qa_status: 'approved', default_status: 'available_option' });
    const b = paramRecord({ parameter_value_id: 'pv-b', value: 0.056, qa_status: 'needs_review', default_status: 'available_option' });
    mockGetParameterValueRecordsForSubstance.mockReturnValue([a, b]);
    mockGetSourceRecord.mockImplementation((id: string) => source(id));
    const [row] = resolveProvenanceRows([
      {
        input_key: 'rfd',
        label: 'L',
        value: 0.056,
        role: 'user-entered value',
        pathway: 'human-health-direct',
        substance_key: 'lead',
      },
    ]);
    expect(row.catalog_record?.parameter_value_id).toBe('pv-a');
  });

  it('resolves by frame jurisdiction rank when multiple approved tie-breaker candidates exist', () => {
    const a = paramRecord({ parameter_value_id: 'pv-a', value: 0.056, qa_status: 'approved', default_status: 'available_option', jurisdiction: 'Canada_federal' });
    const b = paramRecord({ parameter_value_id: 'pv-b', value: 0.056, qa_status: 'approved', default_status: 'available_option', jurisdiction: 'US_federal' });
    mockGetParameterValueRecordsForSubstance.mockReturnValue([a, b]);
    mockGetSourceRecord.mockImplementation((id: string) => source(id));
    mockGetFrameJurisdictionRank.mockImplementation((frameId, record) => {
      if (record.jurisdiction === 'Canada_federal') return 1;
      if (record.jurisdiction === 'US_federal') return 2;
      return null;
    });

    const [row] = resolveProvenanceRows([
      {
        input_key: 'rfd',
        label: 'L',
        value: 0.056,
        role: 'user-entered value',
        pathway: 'human-health-direct',
        substance_key: 'lead',
      },
    ], 'bc-protocol1-v5-dra');

    expect(row.catalog_record?.parameter_value_id).toBe('pv-a');
    expect(mockGetFrameJurisdictionRank).toHaveBeenCalledTimes(4); // 2 in map, plus repeats in rank comparison/filtering
  });

  it('returns null when top ranked candidates are tied', () => {
    const a = paramRecord({ parameter_value_id: 'pv-a', value: 0.056, qa_status: 'approved', default_status: 'available_option', jurisdiction: 'Canada_federal' });
    const b = paramRecord({ parameter_value_id: 'pv-b', value: 0.056, qa_status: 'approved', default_status: 'available_option', jurisdiction: 'US_federal' });
    mockGetParameterValueRecordsForSubstance.mockReturnValue([a, b]);
    mockGetSourceRecord.mockImplementation((id: string) => source(id));
    mockGetFrameJurisdictionRank.mockReturnValue(1); // tied top rank

    const [row] = resolveProvenanceRows([
      {
        input_key: 'rfd',
        label: 'L',
        value: 0.056,
        role: 'user-entered value',
        pathway: 'human-health-direct',
        substance_key: 'lead',
      },
    ]);

    expect(row.catalog_record).toBeNull();
  });

  it('returns null when frame jurisdiction rank returns null for all approved tied candidates', () => {
    const a = paramRecord({ parameter_value_id: 'pv-a', value: 0.056, qa_status: 'approved', default_status: 'available_option' });
    const b = paramRecord({ parameter_value_id: 'pv-b', value: 0.056, qa_status: 'approved', default_status: 'available_option' });
    mockGetParameterValueRecordsForSubstance.mockReturnValue([a, b]);
    mockGetSourceRecord.mockImplementation((id: string) => source(id));
    mockGetFrameJurisdictionRank.mockReturnValue(null); // non-finite rank for all

    const [row] = resolveProvenanceRows([
      {
        input_key: 'rfd',
        label: 'L',
        value: 0.056,
        role: 'user-entered value',
        pathway: 'human-health-direct',
        substance_key: 'lead',
      },
    ]);

    expect(row.catalog_record).toBeNull();
  });

  it('returns null when multiple matching candidates exist but none are approved', () => {
    const a = paramRecord({ parameter_value_id: 'pv-a', value: 0.056, qa_status: 'needs_review', default_status: 'available_option' });
    const b = paramRecord({ parameter_value_id: 'pv-b', value: 0.056, qa_status: 'needs_review', default_status: 'available_option' });
    mockGetParameterValueRecordsForSubstance.mockReturnValue([a, b]);
    mockGetSourceRecord.mockImplementation((id: string) => source(id));

    const [row] = resolveProvenanceRows([
      {
        input_key: 'rfd',
        label: 'L',
        value: 0.056,
        role: 'user-entered value',
        pathway: 'human-health-direct',
        substance_key: 'lead',
      },
    ]);

    expect(row.catalog_record).toBeNull();
  });
});
