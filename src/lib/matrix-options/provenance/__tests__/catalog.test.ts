import { describe, expect, it } from 'vitest';
import {
  EQUATION_RECORDS,
  PARAMETER_VALUE_RECORDS,
  SOURCE_RECORDS,
  getParameterValueRecord,
  getPathwayEquationRecords,
  getSourceRecord,
} from '../catalog';
import {
  resolveEquationsForPathway,
  resolveProvenanceRows,
} from '../resolver';

function expectUnique(values: string[]): void {
  expect(new Set(values).size).toBe(values.length);
}

describe('matrix options provenance catalog', () => {
  it('uses unique source, equation, and parameter identifiers', () => {
    expectUnique(SOURCE_RECORDS.map((record) => record.source_id));
    expectUnique(EQUATION_RECORDS.map((record) => record.equation_id));
    expectUnique(
      PARAMETER_VALUE_RECORDS.map((record) => record.parameter_value_id),
    );
  });

  it('does not store source files in the repo catalog or Supabase', () => {
    for (const source of SOURCE_RECORDS) {
      expect(['zotero_or_external', 'repo_metadata_only']).toContain(
        source.file_storage,
      );
      expect(source.zotero_attachment_keys).toEqual(expect.any(Array));
    }
  });

  it('requires explicit authority and currentness metadata on every source', () => {
    for (const source of SOURCE_RECORDS) {
      expect(source.authority_scope, source.source_id).toMatch(
        /^(bc-legal|bc-guidance|federal-guidance|international-guidance|supporting-science|repo-design)$/,
      );
      expect(source.currentness_status, source.source_id).toMatch(
        /^(current|needs_currentness_check|superseded|unknown)$/,
      );
      expect(source.supersedes_source_ids, source.source_id).toEqual(
        expect.any(Array),
      );
    }
  });

  it('leaves Zotero item keys pending until owner export is available', () => {
    const pending = SOURCE_RECORDS.filter(
      (source) => source.zotero_status === 'pending_owner_export',
    );
    expect(pending.length).toBeGreaterThan(0);
    for (const source of pending) {
      expect(source.zotero_item_key).toBeNull();
    }
  });

  it('resolves every parameter source and equation reference', () => {
    for (const parameter of PARAMETER_VALUE_RECORDS) {
      for (const sourceId of parameter.source_ids) {
        expect(getSourceRecord(sourceId), sourceId).toBeDefined();
      }
      for (const equationId of parameter.equation_ids) {
        expect(
          EQUATION_RECORDS.some(
            (equation) => equation.equation_id === equationId,
          ),
          equationId,
        ).toBe(true);
      }
    }
  });

  it('records extraction evidence metadata for values and equations', () => {
    const allowedMethods = [
      'current_calculator_scaffold',
      'manual_source_extraction',
      'zotero_metadata_import',
      'external_inventory',
    ];
    const allowedLocatorTypes = [
      'current_calculator',
      'source_page',
      'source_table',
      'source_section',
      'equation_citation',
      'external_file',
    ];
    const evidenceIds: string[] = [];

    for (const parameter of PARAMETER_VALUE_RECORDS) {
      expect(parameter.evidence_items.length, parameter.parameter_value_id).toBeGreaterThan(0);
      for (const evidence of parameter.evidence_items) {
        evidenceIds.push(evidence.evidence_id);
        expect(evidence.evidence_id, parameter.parameter_value_id).toBeTruthy();
        expect(evidence.locator, parameter.parameter_value_id).toBeTruthy();
        expect(allowedLocatorTypes).toContain(evidence.locator_type);
        expect(allowedMethods).toContain(evidence.extraction_method);
        expect(evidence.extracted_at, parameter.parameter_value_id).toMatch(
          /^\d{4}-\d{2}-\d{2}$/,
        );
        expect(evidence.qa_status).toBe(parameter.qa_status);
        if (evidence.source_id) {
          expect(getSourceRecord(evidence.source_id), evidence.source_id).toBeDefined();
        }
      }
    }

    for (const equation of EQUATION_RECORDS) {
      expect(equation.evidence_items.length, equation.equation_id).toBeGreaterThan(0);
      for (const evidence of equation.evidence_items) {
        evidenceIds.push(evidence.evidence_id);
        expect(evidence.evidence_id, equation.equation_id).toBeTruthy();
        expect(evidence.locator, equation.equation_id).toBeTruthy();
        expect(allowedLocatorTypes).toContain(evidence.locator_type);
        expect(allowedMethods).toContain(evidence.extraction_method);
        expect(evidence.qa_status).toBe(equation.qa_status);
        if (evidence.source_id) {
          expect(getSourceRecord(evidence.source_id), evidence.source_id).toBeDefined();
        }
      }
    }

    expectUnique(evidenceIds);
  });

  it('does not allow pending scaffold evidence to be marked approved', () => {
    const allEvidence = [
      ...PARAMETER_VALUE_RECORDS.flatMap((record) => record.evidence_items),
      ...EQUATION_RECORDS.flatMap((record) => record.evidence_items),
    ];

    for (const evidence of allEvidence) {
      if (evidence.qa_status !== 'approved') continue;
      expect(evidence.locator, evidence.evidence_id).not.toMatch(/pending/i);
      expect(evidence.extraction_method, evidence.evidence_id).not.toBe(
        'current_calculator_scaffold',
      );
      expect(evidence.reviewed_by, evidence.evidence_id).toBeTruthy();
      expect(evidence.reviewed_at, evidence.evidence_id).toMatch(
        /^\d{4}-\d{2}-\d{2}$/,
      );
    }
  });

  it('resolves every equation source reference', () => {
    for (const equation of EQUATION_RECORDS) {
      for (const sourceId of equation.source_ids) {
        expect(getSourceRecord(sourceId), sourceId).toBeDefined();
      }
    }
  });

  it('marks placeholder defaults as requiring owner review', () => {
    const placeholders = PARAMETER_VALUE_RECORDS.filter(
      (record) => record.default_status === 'placeholder_default',
    );
    expect(placeholders.length).toBeGreaterThan(0);
    for (const placeholder of placeholders) {
      expect(placeholder.qa_status).toBe('needs_owner_review');
    }
  });

  it('records currentness metadata for current Health Canada sources', () => {
    const trv = getSourceRecord('src-health-canada-trv-v4-2025');
    const pqra = getSourceRecord('src-health-canada-pqra-v4-2024');
    const overview = getSourceRecord(
      'src-health-canada-fcsra-overview-v2-2026',
    );

    expect(trv?.zotero_item_key).toBe('SSESKHQW');
    expect(trv?.currentness_status).toBe('current');
    expect(trv?.authority_scope).toBe('federal-guidance');
    expect(trv?.version).toBe('4.0');
    expect(trv?.page_last_modified).toBe('2025-10-15');
    expect(pqra?.currentness_status).toBe('current');
    expect(overview?.currentness_status).toBe('current');
  });

  it('keeps the BC hierarchy rule on federal Health Canada guidance', () => {
    const federalHealthCanadaSources = SOURCE_RECORDS.filter(
      (source) =>
        source.publisher === 'Health Canada' &&
        source.authority_scope === 'federal-guidance',
    );
    expect(federalHealthCanadaSources.length).toBeGreaterThan(0);
    for (const source of federalHealthCanadaSources) {
      expect(source.conflict_rule).toMatch(/BC legal requirements/i);
    }
  });

  it('resolves current Benzo[a]pyrene Eco-Direct defaults', () => {
    expect(
      getParameterValueRecord(
        'benzo_a_pyrene',
        'eco-direct-eqp',
        'logKow',
      )?.value,
    ).toBe(6.13);
    expect(
      getParameterValueRecord(
        'benzo_a_pyrene',
        'eco-direct-eqp',
        'fcv_ug_per_L',
      )?.value,
    ).toBe(0.014);
  });

  it('provides pathway equation records for calculator panels', () => {
    expect(getPathwayEquationRecords('eco-direct-eqp')).toHaveLength(1);
    expect(resolveEquationsForPathway('eco-food-bsaf')).toHaveLength(1);
    expect(resolveEquationsForPathway('background-adjustment')).toHaveLength(1);
  });

  it('resolves display rows with catalog metadata and user-entered rows', () => {
    const rows = resolveProvenanceRows([
      {
        input_key: 'fcv_ug_per_L',
        label: 'FCV',
        value: 0.014,
        role: 'source-backed default',
        pathway: 'eco-direct-eqp',
        substance_key: 'benzo_a_pyrene',
      },
      {
        input_key: 'foc',
        label: 'Fraction organic carbon',
        value: '2.00%',
        role: 'user-entered value',
        note: 'Site input.',
      },
      {
        input_key: 'fcv_ug_per_L',
        label: 'PCB FCV',
        value: 0.014,
        role: 'source-backed default',
        pathway: 'eco-direct-eqp',
        substance_key: 'total_pcbs_aroclor_1254',
      },
    ]);

    expect(rows[0].catalog_record?.parameter_value_id).toBe('pv-bap-fcv');
    expect(rows[0].sources.length).toBeGreaterThan(0);
    expect(rows[0].evidence_items[0]?.locator).toMatch(/source page\/table pending/i);
    expect(rows[1].catalog_record).toBeNull();
    expect(rows[1].qa_status).toBe('not_cataloged');
    expect(rows[2].catalog_record?.default_status).toBe('placeholder_default');
    expect(rows[2].role).toBe('placeholder default');
  });
});
