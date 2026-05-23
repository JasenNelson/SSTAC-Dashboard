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
import wqciuSourceLeadsRaw from '../../../../../matrix_research/reference_catalog/source_leads/wqciu_reference_leads_2026_05_23.json';
import epaEcoSslSourceLeadsRaw from '../../../../../matrix_research/reference_catalog/source_leads/epa_ecossl_reference_leads_2026_05_23.json';
import erdcBsafSourceLeadsRaw from '../../../../../matrix_research/reference_catalog/source_leads/erdc_bsaf_reference_leads_2026_05_23.json';
import bcProtocol28TrvSourceLeadsRaw from '../../../../../matrix_research/reference_catalog/source_leads/bc_protocol28_trv_reference_leads_2026_05_23.json';

function expectUnique(values: string[]): void {
  expect(new Set(values).size).toBe(values.length);
}

type WqciuLeadRecord = {
  lead_id: string;
  promotion_status?: string;
  canonical_source_status?: string;
  canonical_source_leads?: string[];
  rows?: WqciuLeadRecord[];
  values?: WqciuLeadRecord[];
};

const WQCIU_SOURCE_LEADS = wqciuSourceLeadsRaw as {
  status: string;
  source_of_sources_rule: string;
  equation_leads: WqciuLeadRecord[];
  parameter_value_leads: WqciuLeadRecord[];
  canonical_source_leads: Array<{
    lead_id: string;
    zotero_match_status: string;
    catalog_match_status: string;
  }>;
};

const EPA_ECOSSL_SOURCE_LEADS = epaEcoSslSourceLeadsRaw as {
  status: string;
  source_of_sources_rule: string;
  hub_pages: Array<{
    source_id: string;
    calculator_source_role: string;
    promotion_status: string;
  }>;
  document_leads: Array<{
    lead_id: string;
    substance: string;
    url: string;
    promotion_status: string;
    canonical_source_status: string;
  }>;
};

const ERDC_BSAF_SOURCE_LEADS = erdcBsafSourceLeadsRaw as {
  status: string;
  primary_source: {
    source_id: string;
    homepage_url: string;
    database_spreadsheet_url: string;
    version: string;
    promotion_status: string;
    canonical_source_status: string;
  };
  document_leads: Array<{
    lead_id: string;
    url: string;
    promotion_status: string;
    canonical_source_status: string;
  }>;
};

const BC_PROTOCOL28_TRV_SOURCE_LEADS = bcProtocol28TrvSourceLeadsRaw as {
  status: string;
  source_of_sources_rule: string;
  primary_document: {
    source_id: string;
    calculator_source_role: string;
    canonical_source_status: string;
    source_crystallization_date: string;
  };
  section_leads: Array<{
    lead_id: string;
    canonical_source_status: string;
  }>;
  parameter_value_leads: Array<{
    lead_id: string;
    parameter_value_ids?: string[];
    promotion_status: string;
    canonical_source_status: string;
  }>;
  document_leads: Array<{
    lead_id: string;
    canonical_source_status: string;
  }>;
};

const ALLOWED_WQCIU_PROMOTION_STATUSES = [
  'needs_review',
  'needs_exact_source_locator',
  'needs_formula_verification',
];

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

  it('separates calculator default role from evidence support status', () => {
    const defaultStatuses = new Set(
      PARAMETER_VALUE_RECORDS.map((record) => record.default_status),
    );
    const supportStatuses = new Set(
      PARAMETER_VALUE_RECORDS.map((record) => record.evidence_support_status),
    );

    expect([...defaultStatuses].sort()).toEqual([
      'available_option',
      'current_default',
      'not_default',
    ]);
    expect([...supportStatuses].sort()).toEqual([
      'current_calculator_scaffold',
      'pending_source_locator',
    ]);
    expect([...defaultStatuses]).not.toContain('source_backed_default');
    expect([...defaultStatuses]).not.toContain('placeholder_default');
    expect([...supportStatuses]).not.toContain('approved_source_backed');
    expect(
      PARAMETER_VALUE_RECORDS.filter(
        (record) =>
          record.default_status === 'current_default' &&
          record.evidence_support_status === 'pending_source_locator',
      ).length,
    ).toBeGreaterThan(0);
    expect(
      PARAMETER_VALUE_RECORDS.find(
        (record) => record.parameter_value_id === 'pv-bap-trv-eco',
      )?.qa_status,
    ).toBe('needs_review');
    expect(
      PARAMETER_VALUE_RECORDS.find(
        (record) => record.parameter_value_id === 'pv-pcb-fcv',
      )?.qa_status,
    ).toBe('needs_review');
  });

  it('assigns candidate groups to every parameter value', () => {
    for (const record of PARAMETER_VALUE_RECORDS) {
      expect(record.candidate_group_id, record.parameter_value_id).toBe(
        [
          record.pathway,
          record.substance_key,
          record.input_key,
          record.jurisdiction,
        ].join('__'),
      );
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

  it('treats WQCIU as a source-of-sources lead, not a canonical value shortcut', () => {
    const wqciu = getSourceRecord('src-acfn-wqciu');

    expect(wqciu?.notes).toMatch(/source-of-sources/i);
    expect(wqciu?.notes).toMatch(/underlying modern equations/i);
    expect(wqciu?.conflict_rule).toMatch(/Underlying cited sources/i);
    expect(wqciu?.calculator_source_role).toBe('reference_mining');
  });

  it('does not use reference-mining sources as canonical value or equation sources', () => {
    const referenceMiningSourceIds = new Set(
      SOURCE_RECORDS.filter(
        (source) => source.calculator_source_role === 'reference_mining',
      ).map((source) => source.source_id),
    );
    expect([...referenceMiningSourceIds]).toContain('src-acfn-wqciu');

    const valueOffenders = PARAMETER_VALUE_RECORDS.flatMap((record) =>
      record.source_ids
        .filter((sourceId) => referenceMiningSourceIds.has(sourceId))
        .map((sourceId) => `${record.parameter_value_id}:${sourceId}`),
    );
    const equationOffenders = EQUATION_RECORDS.flatMap((record) =>
      record.source_ids
        .filter((sourceId) => referenceMiningSourceIds.has(sourceId))
        .map((sourceId) => `${record.equation_id}:${sourceId}`),
    );

    expect([...valueOffenders, ...equationOffenders]).toEqual([]);
  });

  it('keeps the current calculator scaffold as implementation provenance only', () => {
    const scaffold = getSourceRecord('src-current-calculator-design-v1');

    expect(scaffold?.file_storage).toBe('repo_metadata_only');
    expect(scaffold?.calculator_source_role).toBe('implementation_scaffold');
    expect(scaffold?.notes).toMatch(/Do not cite/i);
  });

  it('keeps WQCIU source leads unpromoted until canonical locators are verified', () => {
    expect(WQCIU_SOURCE_LEADS.status).toBe('needs_review');
    expect(WQCIU_SOURCE_LEADS.source_of_sources_rule).toMatch(
      /underlying cited source as canonical/i,
    );
    expect(WQCIU_SOURCE_LEADS.canonical_source_leads.length).toBeGreaterThan(0);

    for (const lead of WQCIU_SOURCE_LEADS.equation_leads) {
      expect(
        ALLOWED_WQCIU_PROMOTION_STATUSES,
        lead.lead_id,
      ).toContain(lead.promotion_status);
      expect(lead.canonical_source_leads?.length, lead.lead_id).toBeGreaterThan(0);
    }

    for (const lead of WQCIU_SOURCE_LEADS.parameter_value_leads) {
      expect(
        ALLOWED_WQCIU_PROMOTION_STATUSES,
        lead.lead_id,
      ).toContain(lead.promotion_status);
      const extractedItems = [...(lead.rows ?? []), ...(lead.values ?? [])];
      for (const item of extractedItems) {
        expect(item.promotion_status, item.lead_id).toBe('needs_review');
        expect(item.canonical_source_status, item.lead_id).toBe(
          'needs_exact_source_locator',
        );
      }
    }
  });

  it('catalogs EPA Eco-SSL pages as reference-mining hubs only', () => {
    const overview = getSourceRecord('src-us-epa-eco-ssl-overview-2026');
    const index = getSourceRecord('src-us-epa-interim-eco-ssl-documents-2026');

    expect(overview?.calculator_source_role).toBe('reference_mining');
    expect(index?.calculator_source_role).toBe('reference_mining');
    expect(overview?.currentness_status).toBe('current');
    expect(index?.currentness_status).toBe('current');
    expect(overview?.conflict_rule).toMatch(/not cleanup levels/i);
    expect(index?.conflict_rule).toMatch(/not cleanup levels/i);
  });

  it('keeps EPA Eco-SSL linked PDF leads unpromoted pending exact locators', () => {
    expect(EPA_ECOSSL_SOURCE_LEADS.status).toBe('needs_review');
    expect(EPA_ECOSSL_SOURCE_LEADS.source_of_sources_rule).toMatch(
      /individual linked PDF/i,
    );
    expect(EPA_ECOSSL_SOURCE_LEADS.hub_pages).toHaveLength(2);
    expect(EPA_ECOSSL_SOURCE_LEADS.document_leads).toHaveLength(21);

    for (const hub of EPA_ECOSSL_SOURCE_LEADS.hub_pages) {
      expect(hub.calculator_source_role, hub.source_id).toBe('reference_mining');
      expect(hub.promotion_status, hub.source_id).toBe('needs_review');
    }

    for (const lead of EPA_ECOSSL_SOURCE_LEADS.document_leads) {
      expect(lead.url, lead.lead_id).toMatch(/^https:\/\/www\.epa\.gov\//);
      expect(lead.promotion_status, lead.lead_id).toBe('needs_review');
      expect(lead.canonical_source_status, lead.lead_id).toBe(
        'needs_exact_source_locator',
      );
    }
  });

  it('catalogs the ERDC BSAF database homepage and spreadsheet locator', () => {
    const source = getSourceRecord('src-erdc-bsaf-db');

    expect(source?.url).toBe('https://bsaf.el.erdc.dren.mil/');
    expect(source?.version).toBe('October 2022');
    expect(source?.currentness_status).toBe('current');
    expect(source?.external_file_hint).toContain(
      'USACE_ERDC_BSAF_Database_October2022.xlsx',
    );
    expect(source?.notes).toMatch(/exact record\/row locator review/i);
  });

  it('keeps ERDC BSAF database leads unpromoted pending exact row locators', () => {
    expect(ERDC_BSAF_SOURCE_LEADS.status).toBe('needs_review');
    expect(ERDC_BSAF_SOURCE_LEADS.primary_source.source_id).toBe(
      'src-erdc-bsaf-db',
    );
    expect(ERDC_BSAF_SOURCE_LEADS.primary_source.version).toBe('October 2022');
    expect(ERDC_BSAF_SOURCE_LEADS.primary_source.promotion_status).toBe(
      'needs_review',
    );
    expect(ERDC_BSAF_SOURCE_LEADS.primary_source.canonical_source_status).toBe(
      'needs_exact_source_locator',
    );
    expect(ERDC_BSAF_SOURCE_LEADS.document_leads).toHaveLength(2);

    for (const lead of ERDC_BSAF_SOURCE_LEADS.document_leads) {
      expect(lead.url, lead.lead_id).toMatch(/^https:\/\/bsaf\.el\.erdc\.dren\.mil\//);
      expect(lead.promotion_status, lead.lead_id).toBe('needs_review');
      expect(lead.canonical_source_status, lead.lead_id).toBe(
        'needs_exact_source_locator',
      );
    }
  });

  it('keeps ERDC BSAF values pending until exact row locators are reviewed', () => {
    const erdcBsafValues = PARAMETER_VALUE_RECORDS.filter((record) =>
      record.source_ids.includes('src-erdc-bsaf-db'),
    );

    expect(erdcBsafValues.length).toBeGreaterThan(0);
    for (const record of erdcBsafValues) {
      expect(record.default_status, record.parameter_value_id).toBe(
        'current_default',
      );
      expect(record.evidence_support_status, record.parameter_value_id).toBe(
        'pending_source_locator',
      );
      expect(record.qa_status, record.parameter_value_id).toBe('needs_review');
      expect(record.extraction_status, record.parameter_value_id).toBe(
        'extracted_from_current_calculator',
      );
      expect(record.review_notes, record.parameter_value_id).toMatch(
        /exact ERDC spreadsheet row/i,
      );
      for (const evidence of record.evidence_items) {
        expect(evidence.extraction_method, evidence.evidence_id).toBe(
          'current_calculator_scaffold',
        );
        expect(evidence.locator_type, evidence.evidence_id).toBe(
          'current_calculator',
        );
      }
    }
  });

  it('catalogs Protocol 28 as a policy compilation, not calculator evidence', () => {
    const protocol28 = getSourceRecord('src-bc-protocol-28-v3-0-2024');

    expect(protocol28?.calculator_source_role).toBe('policy_compilation');
    expect(protocol28?.source_authority_tier).toBe(
      'tier_1_government_or_regulatory',
    );
    expect(protocol28?.canonical_source_status).toBe(
      'needs_direct_source_check',
    );
    expect(protocol28?.bc_protocol_alignment).toBe(
      'protocol_28_v3_0_policy_compilation',
    );
    expect(protocol28?.source_crystallization_date).toBe('2015-11-30');
    expect(protocol28?.notes).toMatch(/source-mining/i);
    expect(protocol28?.conflict_rule).toMatch(/Do not treat Protocol 28/i);
  });

  it('keeps Protocol 28 TRV candidates pending until original sources are checked', () => {
    const protocol28Values = PARAMETER_VALUE_RECORDS.filter((record) =>
      record.source_ids.includes('src-bc-protocol-28-v3-0-2024'),
    );

    expect(protocol28Values).toHaveLength(6);
    for (const record of protocol28Values) {
      expect(record.default_status, record.parameter_value_id).toBe(
        'available_option',
      );
      expect(record.evidence_support_status, record.parameter_value_id).toBe(
        'pending_source_locator',
      );
      expect(record.canonical_source_status, record.parameter_value_id).toBe(
        'needs_direct_source_check',
      );
      expect(record.qa_status, record.parameter_value_id).toBe('needs_review');
      expect(record.extraction_status, record.parameter_value_id).toBe(
        'extracted_from_source',
      );
      expect(record.source_relationships?.[0]?.role).toBe(
        'policy_compilation',
      );
      expect(record.review_notes, record.parameter_value_id).toMatch(
        /policy compilation/i,
      );
      for (const evidence of record.evidence_items) {
        expect(evidence.extraction_method, evidence.evidence_id).toBe(
          'manual_source_extraction',
        );
        expect(evidence.locator_type, evidence.evidence_id).toBe(
          'source_table',
        );
        expect(evidence.note, evidence.evidence_id).toMatch(
          /Original source/i,
        );
      }
    }
  });

  it('keeps Protocol 28 source leads as unpromoted TRV workbench records', () => {
    expect(BC_PROTOCOL28_TRV_SOURCE_LEADS.status).toBe('needs_review');
    expect(
      BC_PROTOCOL28_TRV_SOURCE_LEADS.source_of_sources_rule,
    ).toMatch(/original cited government or regulatory source/i);
    expect(
      BC_PROTOCOL28_TRV_SOURCE_LEADS.primary_document.source_id,
    ).toBe('src-bc-protocol-28-v3-0-2024');
    expect(
      BC_PROTOCOL28_TRV_SOURCE_LEADS.primary_document.calculator_source_role,
    ).toBe('policy_compilation');
    expect(
      BC_PROTOCOL28_TRV_SOURCE_LEADS.primary_document.canonical_source_status,
    ).toBe('needs_direct_source_check');
    expect(
      BC_PROTOCOL28_TRV_SOURCE_LEADS.primary_document.source_crystallization_date,
    ).toBe('2015-11-30');
    expect(BC_PROTOCOL28_TRV_SOURCE_LEADS.section_leads).toHaveLength(2);
    expect(BC_PROTOCOL28_TRV_SOURCE_LEADS.parameter_value_leads).toHaveLength(4);
    expect(BC_PROTOCOL28_TRV_SOURCE_LEADS.document_leads).toHaveLength(2);

    for (const lead of BC_PROTOCOL28_TRV_SOURCE_LEADS.parameter_value_leads) {
      expect(lead.promotion_status, lead.lead_id).toBe('needs_review');
      expect(lead.canonical_source_status, lead.lead_id).toBe(
        'needs_direct_source_check',
      );
      for (const valueId of lead.parameter_value_ids ?? []) {
        expect(
          PARAMETER_VALUE_RECORDS.some(
            (record) => record.parameter_value_id === valueId,
          ),
          valueId,
        ).toBe(true);
      }
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
    expect(resolveEquationsForPathway('human-health-direct')).toHaveLength(1);
    expect(resolveEquationsForPathway('human-health-food')).toHaveLength(1);
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
    expect(rows[0].default_status).toBe('current_default');
    expect(rows[0].evidence_support_status).toBe('pending_source_locator');
    expect(rows[0].role).toBe('current calculator default');
    expect(rows[1].catalog_record).toBeNull();
    expect(rows[1].qa_status).toBe('not_cataloged');
    expect(rows[1].evidence_support_status).toBe('user_entered_or_derived');
    expect(rows[2].catalog_record?.default_status).toBe('current_default');
    expect(rows[2].evidence_support_status).toBe('current_calculator_scaffold');
    expect(rows[2].role).toBe('current calculator default');
  });
});
