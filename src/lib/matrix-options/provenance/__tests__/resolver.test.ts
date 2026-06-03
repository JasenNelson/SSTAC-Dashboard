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

vi.mock('../catalog', () => ({
  getSourceRecord: (id: string) => mockGetSourceRecord(id),
  getEquationRecord: (id: string) => mockGetEquationRecord(id),
  getPathwayEquationRecords: (p: string) => mockGetPathwayEquationRecords(p),
  getParameterValueRecord: (s: string, p: string, i: string) =>
    mockGetParameterValueRecord(s, p, i),
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
    value: 0.0036,
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
    expect(mockGetParameterValueRecord).not.toHaveBeenCalled();
    expect(row.catalog_record).toBeNull();
    expect(row.qa_status).toBe('not_cataloged');
    expect(row.default_status).toBe('not_cataloged');
    expect(row.candidate_group_id).toBeNull();
  });

  it('looks up the catalog with substance/pathway/input when both keys present', () => {
    mockGetParameterValueRecord.mockReturnValue(paramRecord());
    mockGetSourceRecord.mockImplementation((id: string) => source(id));
    const used: CalculatorUsedValue[] = [
      {
        input_key: 'rfd',
        label: '',
        value: 0.0036,
        role: 'source-backed default',
        pathway: 'human-health-direct',
        substance_key: 'lead',
      },
    ];
    resolveProvenanceRows(used);
    expect(mockGetParameterValueRecord).toHaveBeenCalledWith(
      'lead',
      'human-health-direct',
      'rfd',
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
    mockGetParameterValueRecord.mockReturnValue(paramRecord({ unit: 'catalog-unit' }));
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
    mockGetParameterValueRecord.mockReturnValue(paramRecord({ unit: 'catalog-unit' }));
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
    mockGetParameterValueRecord.mockReturnValue(
      paramRecord({ display_name: 'Catalog name' }),
    );
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
    mockGetParameterValueRecord.mockReturnValue(record ?? undefined);
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
    mockGetParameterValueRecord.mockReturnValue(record ?? undefined);
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
    mockGetParameterValueRecord.mockReturnValue(paramRecord({ source_ids: ['s1', 's2'] }));
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
    mockGetParameterValueRecord.mockReturnValue(paramRecord({ review_notes: 'catalog note' }));
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
    mockGetParameterValueRecord.mockReturnValue(paramRecord({ review_notes: 'catalog note' }));
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
    mockGetParameterValueRecord.mockReturnValue(
      paramRecord({
        qa_status: 'approved',
        default_status: 'current_default',
        candidate_group_id: 'cg-7',
      }),
    );
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
