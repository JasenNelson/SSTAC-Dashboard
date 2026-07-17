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
// The exactly-20 IRIS rows the 2026-06-04 apply sheet sanctions for qa-promotion. Imported from the
// owner-run tool so the test and tool share ONE source of truth for the sanctioned set.
import { TARGET_IDS as IRIS_QA_PROMOTION_TARGET_IDS } from '../../../../../scripts/matrix-options/apply-qa-promotion.mjs';
// 2026-06-21: two further owner-attested promote tools sanction additional human-health TRV rows.
// Import their exported id allowlists so this tripwire stays a single-source-of-truth union.
import { IRIS_CARCINOGEN_RFD_PROMOTION_VALUE_IDS } from '../../../../../scripts/matrix-options/promote-iris-carcinogen-rfd.mjs';
import {
  US_EPA_PFAS_PROMOTION_VALUE_IDS,
  US_EPA_PFAS_PROMOTION_SOURCE_IDS,
} from '../../../../../scripts/matrix-options/promote-us-epa-pfas.mjs';
// 2026-06-21: owner-attested Health Canada TRV v4.0 (2025) batch -- 92 HC TRV rows. Import its
// exported id allowlist so the HH tripwire union below stays a single source of truth.
import { HC_TRV_V4_2025_PROMOTION_VALUE_IDS } from '../../../../../scripts/matrix-options/promote-hc-trv-v4-2025.mjs';
// 2026-06-21: US EPA IRIS batch promotions (oral RfD + chemical-details). Both are IRIS-sourced, so the
// existing /iris/i per-record source branch covers them; add their allowlists to the tripwire union.
import { IRIS_RFD_BATCH_PROMOTION_VALUE_IDS } from '../../../../../scripts/matrix-options/promote-iris-rfd-batch.mjs';
import { IRIS_CHEMDETAILS_PROMOTION_VALUE_IDS } from '../../../../../scripts/matrix-options/promote-iris-chemdetails.mjs';
import { IRIS_DUPE_CG_CANONICAL_VALUE_IDS } from '../../../../../scripts/matrix-options/promote-iris-dupe-cg-canonical.mjs';
import { IRIS_PFAS_DUPE_CG_CANONICAL_VALUE_IDS } from '../../../../../scripts/matrix-options/promote-iris-pfas-dupe-cg-canonical.mjs';
import { IRIS_PFDA_DUPE_CG_CANONICAL_VALUE_IDS } from '../../../../../scripts/matrix-options/promote-iris-pfda-dupe-cg-canonical.mjs';
// 2026-06-21: parameter_values.json mass-promotion tripwire -- union of the owner-run promote tools
// that target the exposure-parameter catalog (one source of truth per tool, mirroring the HH TRV
// tripwire). Adding a NEW parameter_values promote tool requires adding its allowlist below.
import { WLRS_PROMOTION_VALUE_ID as WLRS_RECREATIONAL_PROMOTION_VALUE_ID } from '../../../../../scripts/matrix-options/promote-wlrs-default.mjs';
import { BW_PROMOTION_VALUE_ID as WLRS_BW_PROMOTION_VALUE_ID } from '../../../../../scripts/matrix-options/promote-wlrs-bw-default.mjs';
import { WLRS_SUBSISTENCE_PROMOTION_VALUE_ID } from '../../../../../scripts/matrix-options/promote-wlrs-subsistence.mjs';
import { WLRS_LOW_LEVEL_PROMOTION_VALUE_ID } from '../../../../../scripts/matrix-options/promote-wlrs-low-level.mjs';
import { EPA_PROMOTION_VALUE_ID as EPA_IR_FOOD_PROMOTION_VALUE_ID } from '../../../../../scripts/matrix-options/promote-epa-ir-food.mjs';
import { EPA_BW_PROMOTION_VALUE_ID } from '../../../../../scripts/matrix-options/promote-epa-bw-default.mjs';
import { ACFN_FOODWEB_PROMOTION_VALUE_ID } from '../../../../../scripts/matrix-options/promote-acfn-foodweb.mjs';
import { HC_PQRA_PROMOTION_VALUE_IDS as HC_PQRA_DIRECT_PROMOTION_VALUE_IDS } from '../../../../../scripts/matrix-options/promote-hc-pqra-direct.mjs';
import { HC_PQRA_ADULT_PROMOTION_VALUE_IDS } from '../../../../../scripts/matrix-options/promote-hc-pqra-adult.mjs';
import { HC_PQRA_WORKER_PROMOTION_VALUE_IDS } from '../../../../../scripts/matrix-options/promote-hc-pqra-worker.mjs';
import { HC_PQRA_LIFESTAGE_PROMOTION_VALUE_IDS } from '../../../../../scripts/matrix-options/promote-hc-pqra-lifestage.mjs';
import { TWN_TODDLER_PROMOTION_VALUE_IDS } from '../../../../../scripts/matrix-options/promote-twn-foodweb-toddler.mjs';
// 2026-07-02: owner-approved eco-statics correction re-cited pv-pcb-fcv (total_pcbs_aroclor_1254
// eco-direct FCV) to the real US EPA NRWQC total-PCBs criterion and promoted it. Import its allowlist
// so the mass-promotion tripwire union stays a single source of truth.
import { PCB_FCV_PROMOTION_VALUE_ID } from '../../../../../scripts/matrix-options/promote-pcb-fcv-nrwqc.mjs';
import { findSubstance } from '@/lib/matrix-options/substanceLibrary';
import type { SubstanceEntry } from '@/lib/matrix-options/types';
import parameterValuesRaw from '../../../../../matrix_research/reference_catalog/parameter_values.json';
import wqciuSourceLeadsRaw from '../../../../../matrix_research/reference_catalog/source_leads/wqciu_reference_leads_2026_05_23.json';
import epaEcoSslSourceLeadsRaw from '../../../../../matrix_research/reference_catalog/source_leads/epa_ecossl_reference_leads_2026_05_23.json';
import erdcBsafSourceLeadsRaw from '../../../../../matrix_research/reference_catalog/source_leads/erdc_bsaf_reference_leads_2026_05_23.json';
import bcProtocol28TrvSourceLeadsRaw from '../../../../../matrix_research/reference_catalog/source_leads/bc_protocol28_trv_reference_leads_2026_05_23.json';

function expectUnique(values: string[]): void {
  expect(new Set(values).size).toBe(values.length);
}

function normalizeUnit(s: string | null | undefined): string {
  if (!s) return '';
  let norm = s.toLowerCase().replace(/[\s()]/g, '');
  // Inverse notation "(X)-1" is equivalent to "per X" (e.g. an oral slope factor is written
  // "(mg/kgBW-day)-1" in value_text but "per mg/kg-bw/day" in the catalog unit). Strip both the
  // leading "per" and a trailing inverse marker so the two forms canonicalize identically. This
  // does NOT collapse genuine unit conversions: an inhalation unit risk is "per ug/m3" vs
  // "(mg/m3)-1", whose ug-vs-mg base-unit difference survives and keeps those rows excluded.
  if (norm.startsWith('per')) {
    norm = norm.substring(3);
  }
  norm = norm.replace(/-1$/, '');
  if (norm === 'mg/kgbw-day' || norm === 'mg/kg-bw/day') norm = 'mg/kgbwday';
  return norm;
}

function parseTrvValue(vt: string): { num: number; unit: string } | null {
  const trvIdx = vt.toLowerCase().indexOf('trv value:');
  if (trvIdx === -1) return null;
  const targetText = vt.substring(trvIdx + 10);
  const numMatch = targetText.match(/[-+]?\d*\.?\d+([eE][-+]?\d+)?/);
  if (!numMatch || numMatch.index === undefined) return null;
  const num = Number(numMatch[0]);
  const afterNum = targetText.substring(numMatch.index + numMatch[0].length);
  const pipeIdx = afterNum.indexOf('|');
  const unit = pipeIdx !== -1 ? afterNum.substring(0, pipeIdx).trim() : afterNum.trim();
  return { num, unit };
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
    direct_source_review?: {
      result: string;
      packet: string;
      reviewed_at: string;
      compared_sources: string[];
      value_ids: string[];
      required_catalog_posture: {
        default_status: string;
        evidence_support_status: string;
        qa_status: string;
        canonical_source_status: string;
      };
      note: string;
    };
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

// 2026-07-16: Stage 2 copper #18 disposal (scripts/matrix-options/promote-copper-hc0426.mjs, owner
// --apply pending) will flip these 6 redundant copper oral-RfD candidates from needs_review ->
// superseded. HC v4.0 0.426 (src-health-canada-trv-v4-2025) is the owner-approved canonical copper
// oral RfD (pv-hc-copper-hh-direct-rfd-tdi / pv-hc-copper-hh-food-rfd-tdi, current_default); the 4
// BC Protocol 28 rows (0.09 / 0.141) and the 2 legacy current-calculator scaffold rows (0.426,
// unsourced) are superseded redundant alternates for the same slot. Except them from the
// "still needs_review / still pending" invariants below so this test stays green both BEFORE and
// AFTER --apply, without this test itself asserting the post-apply 'superseded' status (that is the
// dispose tool's job, not a catalog-shape invariant).
const DISPOSED_COPPER_IDS = new Set([
  'pv-p28-copper-hh-direct-rfd',
  'pv-p28-copper-hh-food-rfd',
  'pv-p28-copper-hh-direct-rfd-copper-rfd-water',
  'pv-p28-copper-hh-food-rfd-copper-rfd-water',
  'pv-copper-hh-direct-rfd',
  'pv-copper-hh-food-rfd',
]);

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
      'approved_source_backed',
      'current_calculator_scaffold',
      'pending_source_locator',
    ]);
    expect([...defaultStatuses]).not.toContain('source_backed_default');
    expect([...defaultStatuses]).not.toContain('placeholder_default');
    expect(
      PARAMETER_VALUE_RECORDS.filter(
        (record) => record.evidence_support_status === 'approved_source_backed',
      ).length,
    ).toBeGreaterThan(0);
    expect(
      PARAMETER_VALUE_RECORDS.filter(
        (record) =>
          record.default_status === 'current_default' &&
          record.evidence_support_status === 'pending_source_locator',
      ).length,
    ).toBeGreaterThan(0);
    // pv-bap-trv-eco was deleted: benzo_a_pyrene's eco TRV was nulled in the library (#444), so no
    // current_default scaffold should remain for it (integrity fix 2026-07-02).
    expect(
      PARAMETER_VALUE_RECORDS.find(
        (record) => record.parameter_value_id === 'pv-bap-trv-eco',
      ),
    ).toBeUndefined();
    // Eco-statics correction (2026-07-02): pv-bap-fcv, pv-pcb-trv-eco, and pv-mehg-trv-eco cited
    // fabricated/mismatched sources and were DELETED (their library fields nulled -- see
    // substanceLibrary.ts benzo_a_pyrene / total_pcbs_aroclor_1254 / methylmercury notes). No
    // current_default scaffold should remain for any of them.
    expect(
      PARAMETER_VALUE_RECORDS.find(
        (record) => record.parameter_value_id === 'pv-bap-fcv',
      ),
    ).toBeUndefined();
    expect(
      PARAMETER_VALUE_RECORDS.find(
        (record) => record.parameter_value_id === 'pv-pcb-trv-eco',
      ),
    ).toBeUndefined();
    expect(
      PARAMETER_VALUE_RECORDS.find(
        (record) => record.parameter_value_id === 'pv-mehg-trv-eco',
      ),
    ).toBeUndefined();
    // pv-pcb-fcv is the OPPOSITE correction: the value (0.014 ug/L) was verified against the real US
    // EPA NRWQC total-PCBs chronic criterion, so it was re-cited and PROMOTED to approved (2026-07-02).
    expect(
      PARAMETER_VALUE_RECORDS.find(
        (record) => record.parameter_value_id === 'pv-pcb-fcv',
      )?.qa_status,
    ).toBe('approved');
  });

  it('assigns candidate groups to every parameter value', () => {
    // candidate_group_id is the 4-part slot key pathway__substance_key__input_key__jurisdiction.
    // It is a SHARED display-grouping key: multi-endpoint substances (e.g. BaP neuro/repro/immune,
    // cadmium water/food media, methylmercury sensitive/adult) keep all their distinct candidate
    // values under one group so the QP can compare them. The 4-part prefix must always match.
    // (startsWith also tolerates any future basis-suffixed key without weakening the prefix check.)
    const prefix4 = (record: { pathway: string; substance_key: string; input_key: string; jurisdiction: string }) =>
      [record.pathway, record.substance_key, record.input_key, record.jurisdiction].join('__');
    for (const record of PARAMETER_VALUE_RECORDS) {
      const p = prefix4(record);
      expect(
        record.candidate_group_id === p || record.candidate_group_id.startsWith(p + '__'),
        record.parameter_value_id + ': candidate_group_id ' + record.candidate_group_id + ' does not start with ' + p,
      ).toBe(true);
    }
  });

  it('collapses class-1 pure duplicates (no same-tuple same-value rows)', () => {
    // The codex P2 (2026-05-31) was duplicate candidate tuples in the expanded catalog. The
    // actual defect is class-1 PURE duplicates: two records with the same
    // (source_ids[0], substance_key, input_key, pathway, jurisdiction) AND the same normalized
    // value. The generator collapses these; this guards against a re-derived id slug smuggling
    // one back in. (Distinct-value records sharing a candidate_group_id is NOT a defect -- it is
    // the designed candidate-grouping behavior: candidate_group_id is a SHARED display-grouping
    // key so the QP can compare alternative values for one parameter slot. See
    // value-groups.test.ts and iris-canonical.test.ts. Default-selection pools by
    // (substance_key, pathway, input_key) and ignores candidate_group_id.)
    const seenTupleValue = new Map<string, string>(); // tupleValueKey -> first parameter_value_id
    const duplicates: string[] = [];
    for (const record of PARAMETER_VALUE_RECORDS) {
      const sid = Array.isArray(record.source_ids) ? record.source_ids[0] : '';
      const k = [sid, record.substance_key, record.input_key, record.pathway, record.jurisdiction, String(record.value)].join('|');
      if (seenTupleValue.has(k)) {
        duplicates.push(record.parameter_value_id + ' == ' + seenTupleValue.get(k) + ' (' + k + ')');
      } else {
        seenTupleValue.set(k, record.parameter_value_id);
      }
    }
    expect(
      duplicates,
      'class-1 pure duplicates (same source+substance+input+pathway+jurisdiction+value): ' + duplicates.join(' ; ') +
      '. Collapse the duplicate rather than emitting both.',
    ).toEqual([]);
  });

  it('groups multi-endpoint candidates under one shared candidate_group_id', () => {
    // Guards the designed grouping: IRIS benzo[a]pyrene's three distinct oral RfD endpoints
    // (neuro 3e-4 / repro 4e-4 / immune 2e-3) must share ONE candidate_group_id so the Evidence
    // Library shows them as alternative candidates for the same slot (not three singletons).
    const bapDirectRfd = PARAMETER_VALUE_RECORDS.filter(
      (r) =>
        r.substance_key === 'benzo_a_pyrene' &&
        r.pathway === 'human-health-direct' &&
        r.input_key === 'rfd_oral_mg_per_kg_bw_day' &&
        r.jurisdiction === 'US_federal',
    );
    expect(bapDirectRfd.length).toBeGreaterThanOrEqual(3);
    const groupIds = new Set(bapDirectRfd.map((r) => r.candidate_group_id));
    expect(groupIds.size).toBe(1);
    const distinctValues = new Set(bapDirectRfd.map((r) => String(r.value)));
    expect(distinctValues.size).toBeGreaterThanOrEqual(3);
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

  it('does not cite IRIS as an Eco-Direct benzo[a]pyrene source', () => {
    const ecoDirectBapRecords = PARAMETER_VALUE_RECORDS.filter(
      (record) =>
        record.pathway === 'eco-direct-eqp' &&
        record.substance_key === 'benzo_a_pyrene',
    );
    const iris = getSourceRecord('src-us-epa-iris-rfd-table-live');

    expect(iris?.url).toBe('https://iris.epa.gov/AdvancedSearch/rfd_toxicity_values');
    expect(iris?.notes).toMatch(/human-health.*toxicity-value/i);
    expect(iris?.notes).toMatch(/do not cite IRIS as an ecological EqP/i);
    expect(iris?.source_authority_tier).toBe(
      'tier_1_government_or_regulatory',
    );
    expect(ecoDirectBapRecords.length).toBeGreaterThan(0);
    for (const record of ecoDirectBapRecords) {
      expect(record.source_ids, record.parameter_value_id).not.toContain(
        'src-us-epa-iris-rfd-table-live',
      );
    }
  });

  it('catalogs the frozen 2026-05-23 source-verified HC/IRIS human-health TRV batch', () => {
    // The original tier-1 TRV batch was extracted and direct-source-verified on 2026-05-23. It is
    // identified here by a STABLE predicate that is independent of any later qa-promotion: approved
    // human-health TRVs that are direct_source_verified AND whose every evidence item was extracted
    // on 2026-05-23. This frozen set must stay at exactly 84 -- a later qa-promotion of other IRIS
    // rows carries its own later extraction date and is covered by the next test, not this one.
    // Protocol 28 d0c00003 records use pending_source_locator (not approved_source_backed) because
    // P28 is a policy compilation whose values require direct-source verification before use.
    // They are excluded from this filter by evidence_support_status='approved_source_backed'.
    const frozenBatch = PARAMETER_VALUE_RECORDS.filter(
      (record) =>
        record.pathway.startsWith('human-health') &&
        record.evidence_support_status === 'approved_source_backed' &&
        record.assumption_tags?.includes('TRV') &&
        record.qa_status === 'approved' &&
        record.canonical_source_status === 'direct_source_verified' &&
        record.evidence_items.every((evidence) => evidence.extracted_at === '2026-05-23'),
    );
    const sourceIds = new Set(frozenBatch.flatMap((record) => record.source_ids));

    expect(frozenBatch).toHaveLength(84);
    expect(sourceIds).toEqual(
      new Set([
        'src-health-canada-trv-v4-2025',
        'src-us-epa-iris-rfd-table-live',
        'src-us-epa-iris-chemical-details-live',
      ]),
    );
    expect(new Set(frozenBatch.map((record) => record.substance_key))).toEqual(
      new Set([
        'arsenic_inorganic',
        'barium',
        'benzene',
        'benzo_a_pyrene',
        'beryllium',
        'cadmium',
        'chlorobenzene',
        'chromium_hexavalent',
        'chromium_trivalent',
        'copper',
        'lead',
        'methylmercury',
        'naphthalene',
        'tetrachloroethylene',
        'total_pcbs_aroclor_1254',
        'trichloroethylene',
        'vinyl_chloride',
        'zinc',
      ]),
    );

    for (const record of frozenBatch) {
      expect(record.default_status, record.parameter_value_id).toMatch(
        /^(available_option|current_default)$/,
      );
      expect(record.qa_status, record.parameter_value_id).toBe('approved');
      expect(record.source_authority_tier, record.parameter_value_id).toBe(
        'tier_1_government_or_regulatory',
      );
      expect(record.canonical_source_status, record.parameter_value_id).toBe(
        'direct_source_verified',
      );
      expect(record.bc_protocol_alignment, record.parameter_value_id).toBe(
        'protocol_1_v5_0_tier_1_government_source',
      );
      for (const evidence of record.evidence_items) {
        expect(evidence.extracted_at, evidence.evidence_id).toBe('2026-05-23');
        expect(evidence.locator, evidence.evidence_id).toMatch(
          /checked 2026-05-23/i,
        );
        expect(evidence.note ?? '', evidence.evidence_id).not.toMatch(
          /C:\\|Downloads|Chemicals_Details\.xlsx/i,
        );
      }
    }
  });

  it('pins the owner-approved current_default row for each 2026-07-05 default-selection tuple', () => {
    // 2026-07-05: owner approved a single current_default per (substance, input, pathway) for 18
    // affected tuples x {human-health-direct, human-health-food} = 36 rows. The frozen-batch
    // default_status checks above were widened to also accept 'current_default'; this test restores
    // the lost guard by pinning EXACTLY which row may be the current_default in each affected tuple.
    // A stray default flip (another row in the tuple flipping to current_default, or the wrong pvid
    // holding it) fails here. NOTE: the catalog legitimately has ~81 current_default rows overall, so
    // this does NOT assert "only these 36 are current_default catalog-wide" -- only that within each of
    // these 36 tuples, the current_default is exactly the owner-approved pvid and there is only one.
    const APPROVED_CURRENT_DEFAULT_IDS = [
      // HC oral RfD
      'pv-hc-barium-hh-direct-rfd', 'pv-hc-barium-hh-food-rfd',
      'pv-hc-carbon_tetrachloride-hh-direct-rfd', 'pv-hc-carbon_tetrachloride-hh-food-rfd',
      'pv-hc-chromium_trivalent-hh-direct-rfd', 'pv-hc-chromium_trivalent-hh-food-rfd',
      'pv-hc-dichloroethylene_1_1-hh-direct-rfd', 'pv-hc-dichloroethylene_1_1-hh-food-rfd',
      'pv-hc-ethylbenzene-hh-direct-rfd', 'pv-hc-ethylbenzene-hh-food-rfd',
      'pv-hc-manganese-hh-direct-rfd', 'pv-hc-manganese-hh-food-rfd',
      'pv-hc-tetrachloroethylene-hh-direct-rfd', 'pv-hc-tetrachloroethylene-hh-food-rfd',
      'pv-hc-toluene-hh-direct-rfd', 'pv-hc-toluene-hh-food-rfd',
      'pv-hc-xylenes-hh-direct-rfd', 'pv-hc-xylenes-hh-food-rfd',
      'pv-hc-cadmium-hh-direct-rfd-tdi', 'pv-hc-cadmium-hh-food-rfd-tdi',
      'pv-hc-mehg-hh-direct-rfd-sensitive', 'pv-hc-mehg-hh-food-rfd-sensitive',
      // 2026-07-06 CORRECTION: chlorobenzene moved HERE (was under "US EPA IRIS oral RfD" below) --
      // PR #513 (2026-07-05) had picked the interim EPA row believing HC's 0.43 was a mis-attribution;
      // that was disproven by direct verification against the real HC v4.0 source PDF, so current_default
      // now pins to the HC row per the recency rule (see docs/MATRIX_OPTIONS_HC_TRV_V4_CROSSCHECK_2026_07_06.md).
      'pv-hc-chlorobenzene-hh-direct-rfd', 'pv-hc-chlorobenzene-hh-food-rfd',
      // US EPA IRIS oral RfD
      'pv-iris-dichlorobenzene_1_2-hh-direct-rfd', 'pv-iris-dichlorobenzene_1_2-hh-food-rfd',
      'pv-iris-dichloromethane-hh-direct-rfd', 'pv-iris-dichloromethane-hh-food-rfd',
      'pv-iris-trichloroethylene-hh-direct-rfd', 'pv-iris-trichloroethylene-hh-food-rfd',
      'pv-iris-zinc-hh-direct-rfd', 'pv-iris-zinc-hh-food-rfd',
      // US EPA IRIS oral slope factor
      'pv-iris-arsenic-hh-direct-sf', 'pv-iris-arsenic-hh-food-sf',
      'pv-iris-dichloromethane-hh-direct-sf', 'pv-iris-dichloromethane-hh-food-sf',
      'pv-iris-trichloroethylene-hh-direct-sf', 'pv-iris-trichloroethylene-hh-food-sf',
      // Health Canada 2026-07-13 approvals
      'pv-hc-bap-hh-direct-rfd-tdi',
      'pv-hc-copper-hh-direct-rfd-tdi', 'pv-hc-copper-hh-food-rfd-tdi',
      // Health Canada 2026-07-16 PCB HH-default (non-dioxin-like; more protective + newer than IRIS 1994)
      'pv-hc-pcb-hh-direct-rfd-nondioxin', 'pv-hc-pcb-hh-food-rfd-nondioxin',
    ];
    expect(new Set(APPROVED_CURRENT_DEFAULT_IDS).size).toBe(43);

    for (const pvid of APPROVED_CURRENT_DEFAULT_IDS) {
      const record = PARAMETER_VALUE_RECORDS.find(
        (item) => item.parameter_value_id === pvid,
      );
      expect(record, pvid).toBeDefined();
      expect(record!.default_status, pvid).toBe('current_default');
      expect(record!.qa_status, pvid).toBe('approved');

      // Exactly one row in this (substance, input, pathway) tuple is current_default, and it is pvid.
      const tupleCurrentDefaults = PARAMETER_VALUE_RECORDS.filter(
        (item) =>
          item.substance_key === record!.substance_key &&
          item.input_key === record!.input_key &&
          item.pathway === record!.pathway &&
          item.default_status === 'current_default',
      );
      expect(
        tupleCurrentDefaults.map((item) => item.parameter_value_id),
        `${record!.substance_key} / ${record!.input_key} / ${record!.pathway}`,
      ).toEqual([pvid]);
    }
  });

  it('constrains any qa-promoted IRIS TRV beyond the frozen batch (apply sheet 2026-06-04)', () => {
    // Approved human-health TRVs that are NOT in the frozen 2026-05-23 batch are the qa-promotion
    // candidates documented in
    // matrix_research/reference_catalog/iris_qa_promotion_apply_sheet_2026_06_04.md (the 20 EPA-IRIS
    // rows verified against the live EPA Excel by the #249 packet). BEFORE the owner runs
    // scripts/matrix-options/apply-qa-promotion.mjs this set is empty; AFTER, it is up to 20 IRIS
    // rows. This test stays green in BOTH states and in either --canonical variant. It does NOT relax
    // the frozen-batch check above; it constrains new promotions to be well-formed, source-backed,
    // HITL-attested IRIS rows in one of the two sanctioned canonical-status states. This replaces the
    // old hardcoded 84-count snapshot, which would have turned RED on a sanctioned promotion (see
    // docs/LESSONS.md).
    const promotedBeyondFrozen = PARAMETER_VALUE_RECORDS.filter(
      (record) =>
        record.pathway.startsWith('human-health') &&
        record.evidence_support_status === 'approved_source_backed' &&
        record.assumption_tags?.includes('TRV') &&
        record.qa_status === 'approved' &&
        !record.evidence_items.every((evidence) => evidence.extracted_at === '2026-05-23'),
    );

    // Mass-promotion / substitution tripwire: every approved-beyond-frozen row MUST be one of the
    // exactly-20 EPA-IRIS rows the 2026-06-04 apply sheet sanctions (the apply tool's TARGET_IDS),
    // not merely a well-formed IRIS row -- a swap-in of a non-target IRIS row or a bulk promotion
    // must fail here. And once promoted, the set must be EXACTLY those 20 (no more, no fewer, no
    // substitutions). This restores and tightens the catalog-wide tripwire the old hardcoded
    // 84-count test provided.
    // Union of the FOUR owner-attested promote tools' allowlists (single source of truth, imported
    // from each tool): apply-qa-promotion.mjs (20 IRIS rows), promote-iris-carcinogen-rfd.mjs (6 IRIS
    // HCB/PCP/1,4-dioxane RfD rows), promote-us-epa-pfas.mjs (4 US EPA PFOA/PFOS RfD rows), and
    // promote-hc-trv-v4-2025.mjs (92 Health Canada TRV v4.0 rows), promote-iris-rfd-batch.mjs (US EPA
    // IRIS oral-RfD batch), promote-iris-chemdetails.mjs (US EPA IRIS chem-details batch). A swap-in of
    // any non-sanctioned row or a bulk promotion still fails the set-equality below.
    const sanctionedPromotionIds = new Set([
      ...IRIS_QA_PROMOTION_TARGET_IDS,
      ...IRIS_CARCINOGEN_RFD_PROMOTION_VALUE_IDS,
      ...US_EPA_PFAS_PROMOTION_VALUE_IDS,
      ...HC_TRV_V4_2025_PROMOTION_VALUE_IDS,
      ...IRIS_RFD_BATCH_PROMOTION_VALUE_IDS,
      ...IRIS_CHEMDETAILS_PROMOTION_VALUE_IDS,
      ...IRIS_DUPE_CG_CANONICAL_VALUE_IDS,
      ...IRIS_PFAS_DUPE_CG_CANONICAL_VALUE_IDS,
      ...IRIS_PFDA_DUPE_CG_CANONICAL_VALUE_IDS,
      // 2026-07-06: chlorobenzene's two HC v4.0 oral RfD rows, re-approved OUTSIDE the bulk
      // promote-hc-trv-v4-2025.mjs tool (PR #513 on 2026-07-05 had dropped them from that tool's
      // PROMOTION_ROWS when it quarantined them, believing 0.43 was a 1,2-DCB mis-attribution). Direct
      // extraction of the real HC TRV v4.0 (2025) source PDF confirmed 0.43 mg/kgBW-day IS chlorobenzene's
      // genuine, correctly-derived Oral TDI (page 25) -- it was never mis-filed. This correction restores
      // qa_status=approved directly on the catalog rows (not via the bulk tool, since the bulk tool's
      // "90 rows" scope is a separate, already-executed historical action) -- see
      // docs/MATRIX_OPTIONS_HC_TRV_V4_CROSSCHECK_2026_07_06.md.
      'pv-hc-chlorobenzene-hh-direct-rfd',
      'pv-hc-chlorobenzene-hh-food-rfd',
      // 2026-07-13: HC TRV v4.0 (2025) dioxin-like TEQ oral TDI (2.3e-9 mg TEQ/kg-bw/day, PDF p.42),
      // promoted via the dedicated promote-hc-dioxin-teq.mjs tool (not the bulk promote-hc-trv-v4-2025.mjs),
      // owner-attested 2026-07-13. See docs/MATRIX_OPTIONS_D1_DIOXIN_APPLY_PLAN_2026_07_13.md.
      'pv-hc-dioxin-like-teq-hh-direct-oral-tdi',
    ]);
    if (promotedBeyondFrozen.length > 0) {
      expect(new Set(promotedBeyondFrozen.map((record) => record.parameter_value_id))).toEqual(
        sanctionedPromotionIds,
      );
    }

    const pfasPromotionIds = new Set(US_EPA_PFAS_PROMOTION_VALUE_IDS);
    const hcTrvPromotionIds = new Set(HC_TRV_V4_2025_PROMOTION_VALUE_IDS);
    // 2026-07-06: chlorobenzene's two HC v4.0 oral RfD rows -- re-approved directly (see the
    // sanctionedPromotionIds comment above), not via the bulk promote-hc-trv-v4-2025.mjs tool, but they
    // carry the SAME single Health Canada v4.0 source as that tool's rows.
    const chlorobenzeneCorrectionIds = new Set([
      'pv-hc-chlorobenzene-hh-direct-rfd',
      'pv-hc-chlorobenzene-hh-food-rfd',
    ]);
    // 2026-07-13: dioxin-like TEQ oral TDI promoted via promote-hc-dioxin-teq.mjs, which carries the
    // single Health Canada v4.0 source (same source constraint as the bulk HC TRV rows below).
    const dioxinTeqCorrectionIds = new Set(['pv-hc-dioxin-like-teq-hh-direct-oral-tdi']);
    for (const record of promotedBeyondFrozen) {
      // Each promoted row is one of the sanctioned set (defense in depth with the set-equality above).
      expect(sanctionedPromotionIds.has(record.parameter_value_id), record.parameter_value_id).toBe(
        true,
      );
      // Source check: the IRIS apply-sheet + IRIS-carcinogen rows are EPA-IRIS-sourced; the US EPA
      // PFOA/PFOS rows use their own per-document EPA sources (non-IRIS); the HC TRV v4.0 rows use the
      // single Health Canada source -- constrain each row to its tool's exact source.
      if (pfasPromotionIds.has(record.parameter_value_id)) {
        // Each PFAS value must carry EXACTLY its own per-document EPA source (PFOA->pfoa, PFOS->pfos):
        // catches an empty array, a cross-linked source, or both sources on one row.
        const expectedPfasSource = record.parameter_value_id.includes('perfluorooctane_sulfonate')
          ? 'src-us-epa-pfos-2024'
          : 'src-us-epa-pfoa-2024';
        expect(US_EPA_PFAS_PROMOTION_SOURCE_IDS).toContain(expectedPfasSource);
        expect(record.source_ids, record.parameter_value_id).toEqual([expectedPfasSource]);
      } else if (
        hcTrvPromotionIds.has(record.parameter_value_id) ||
        chlorobenzeneCorrectionIds.has(record.parameter_value_id) ||
        dioxinTeqCorrectionIds.has(record.parameter_value_id)
      ) {
        // Each HC TRV v4.0 row must carry EXACTLY the single Health Canada source.
        expect(record.source_ids, record.parameter_value_id).toEqual(['src-health-canada-trv-v4-2025']);
      } else {
        expect(record.source_ids.join(' '), record.parameter_value_id).toMatch(/iris/i);
      }
      // A qa promotion never makes a value a calculator default.
      expect(record.default_status, record.parameter_value_id).toMatch(
        /^(available_option|current_default)$/,
      );
      expect(record.source_authority_tier, record.parameter_value_id).toBe(
        'tier_1_government_or_regulatory',
      );
      // qa_status and canonical_source_status are independent gates: both sanctioned states allowed.
      expect(
        ['direct_source_verified', 'needs_direct_source_check'],
        record.parameter_value_id,
      ).toContain(record.canonical_source_status);
      for (const evidence of record.evidence_items) {
        expect(evidence.qa_status, evidence.evidence_id).toBe('approved');
        expect(evidence.reviewed_by, evidence.evidence_id).toBeTruthy();
        expect(evidence.reviewed_at, evidence.evidence_id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(evidence.note ?? '', evidence.evidence_id).not.toMatch(
          /C:\\|Downloads|Chemicals_Details\.xlsx/i,
        );
      }
    }
  });

  it('constrains parameter_values.json approvals to the union of owner-run promote-script allowlists', () => {
    // Mass-promotion tripwire for the exposure-parameter catalog (parameter_values.json), mirroring the
    // human-health TRV tripwire above. Every approved row in parameter_values.json MUST be sanctioned by
    // one of the owner-run promote-*.mjs tools (single source of truth: each tool's exported *_VALUE_ID(S)).
    // Previously this catalog was guarded only by a count assertion in library.test.ts -- a lower-fidelity
    // guard than set-equality. A bulk promotion or a swap-in of a non-sanctioned row now fails here.
    // Adding a NEW parameter_values promote tool requires adding its allowlist to this union (by design).
    const sanctionedParameterValueIds = new Set<string>([
      WLRS_RECREATIONAL_PROMOTION_VALUE_ID,
      WLRS_BW_PROMOTION_VALUE_ID,
      WLRS_SUBSISTENCE_PROMOTION_VALUE_ID,
      WLRS_LOW_LEVEL_PROMOTION_VALUE_ID,
      EPA_IR_FOOD_PROMOTION_VALUE_ID,
      EPA_BW_PROMOTION_VALUE_ID,
      ACFN_FOODWEB_PROMOTION_VALUE_ID,
      ...HC_PQRA_DIRECT_PROMOTION_VALUE_IDS,
      ...HC_PQRA_ADULT_PROMOTION_VALUE_IDS,
      ...HC_PQRA_WORKER_PROMOTION_VALUE_IDS,
      ...HC_PQRA_LIFESTAGE_PROMOTION_VALUE_IDS,
      ...TWN_TODDLER_PROMOTION_VALUE_IDS,
      PCB_FCV_PROMOTION_VALUE_ID,
    ]);
    const approvedParameterValueIds = (
      parameterValuesRaw as Array<{ qa_status: string; parameter_value_id: string }>
    )
      .filter((record) => record.qa_status === 'approved')
      .map((record) => record.parameter_value_id);
    // Set-equality: the approved set must be EXACTLY the sanctioned union -- no more (unsanctioned
    // promotion), no fewer (a reverted/dropped --apply), no substitutions.
    expect(new Set(approvedParameterValueIds)).toEqual(sanctionedParameterValueIds);
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
    expect(protocol28?.zotero_status).toBe('linked');
    expect(protocol28?.zotero_item_key).toBe('LPZUVAC2');
    expect(protocol28?.zotero_attachment_keys).toContain('HYNUIDR5');
    expect(protocol28?.external_file_hint).toMatch(
      /do not copy the PDF into the repo/i,
    );
    expect(protocol28?.notes).toMatch(/source-mining/i);
    expect(protocol28?.conflict_rule).toMatch(/Do not treat Protocol 28/i);
  });

  it('keeps Protocol 28 TRV candidates pending until original sources are checked', () => {
    const protocol28Values = PARAMETER_VALUE_RECORDS.filter((record) =>
      record.source_ids.includes('src-bc-protocol-28-v3-0-2024') &&
      // 2026-07-16: exclude the 4 copper #18 disposal candidates (see DISPOSED_COPPER_IDS above) --
      // they legitimately leave this "still pending" invariant once promote-copper-hc0426.mjs
      // --apply flips them to superseded.
      !DISPOSED_COPPER_IDS.has(record.parameter_value_id),
    );

    // 2026-06-22: BC P28 source dedup -- the mislabeled src-bc-protocol-28-2021-jan was retired and
    // its 355 HH rows curated onto the canonical v3.0 id (4 exact-duplicate twins of the
    // verification-packet rows deleted, 351 re-keyed). So the v3.0 set is now 351 HH + 6 PV = 357,
    // all still available_option / pending_source_locator / needs_direct_source_check / needs_review.
    // 2026-07-16: -4 (357 -> 353) -- copper #18 disposal excludes its 4 BC Protocol 28 oral-RfD
    // candidates (pv-p28-copper-hh-direct-rfd, pv-p28-copper-hh-food-rfd,
    // pv-p28-copper-hh-direct-rfd-copper-rfd-water, pv-p28-copper-hh-food-rfd-copper-rfd-water) from
    // this loop; see DISPOSED_COPPER_IDS.
    expect(protocol28Values).toHaveLength(353);
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
      // 2026-06-22: broadened from /policy compilation/i to /Protocol 28/i. After the BC P28 source
      // dedup this loop spans 357 rows: the 6 curated verification-packet rows ("...Treat Protocol 28
      // as policy compilation...") AND the 351 re-keyed bulk rows ("BC Protocol 28 ... candidate").
      // The "cannot drive a default" guardrail is enforced structurally above (default_status=
      // available_option, source_relationships role=policy_compilation, canonical_source_status=
      // needs_direct_source_check) + the source conflict_rule, not by this corroborating text check.
      expect(record.review_notes, record.parameter_value_id).toMatch(/Protocol 28/i);
      for (const evidence of record.evidence_items) {
        expect(evidence.extraction_method, evidence.evidence_id).toBe(
          'manual_source_extraction',
        );
        expect(evidence.locator_type, evidence.evidence_id).toBe(
          'source_table',
        );
      }
    }

    // The 6 curated verification-packet rows (parameter_values.json, 2026-05-25 review of As/BaP/PCB/Zn)
    // carry the stricter "policy compilation" + "Original source" framing. The 351 re-keyed bulk rows use
    // the older robot-extracted framing; the structural blocked-guarantee above covers all 357. Assert the
    // curated framing on exactly the 6 (identified by the "policy compilation" review-note wording).
    const curatedProtocol28Values = protocol28Values.filter((record) =>
      /policy compilation/i.test(record.review_notes),
    );
    expect(curatedProtocol28Values).toHaveLength(6);
    for (const record of curatedProtocol28Values) {
      for (const evidence of record.evidence_items) {
        expect(evidence.note, evidence.evidence_id).toMatch(/Original source/i);
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

  it('records the BaP direct-source discrepancy without promoting either pathway value', () => {
    const bapLead = BC_PROTOCOL28_TRV_SOURCE_LEADS.parameter_value_leads.find(
      (lead) => lead.lead_id === 'p28-appendix-8a-bap-sfo',
    );

    expect(bapLead?.direct_source_review?.result).toBe(
      'DISCREPANCY_RECORDED_NO_PROMOTION',
    );
    expect(bapLead?.direct_source_review?.packet).toBe(
      'matrix_research/reference_catalog/protocol28_bap_direct_source_verification_packet_2026_05_25.md',
    );
    expect(bapLead?.direct_source_review?.compared_sources).toEqual([
      'src-us-epa-iris-chemical-details-live',
      'src-health-canada-trv-v4-2025',
    ]);
    expect(bapLead?.direct_source_review?.value_ids).toEqual([
      'pv-p28-bap-hh-direct-slope',
      'pv-p28-bap-hh-food-slope',
    ]);
    expect(bapLead?.direct_source_review?.required_catalog_posture).toEqual({
      default_status: 'available_option',
      evidence_support_status: 'pending_source_locator',
      qa_status: 'needs_review',
      canonical_source_status: 'needs_direct_source_check',
    });

    for (const valueId of bapLead?.direct_source_review?.value_ids ?? []) {
      const record = PARAMETER_VALUE_RECORDS.find(
        (candidate) => candidate.parameter_value_id === valueId,
      );
      expect(record?.default_status, valueId).toBe('available_option');
      expect(record?.evidence_support_status, valueId).toBe(
        'pending_source_locator',
      );
      expect(record?.qa_status, valueId).toBe('needs_review');
      expect(record?.canonical_source_status, valueId).toBe(
        'needs_direct_source_check',
      );
      expect(record?.canonical_source_ids, valueId).toEqual([]);
      expect(record?.source_relationships, valueId).toEqual([
        {
          source_id: 'src-bc-protocol-28-v3-0-2024',
          role: 'policy_compilation',
          note: expect.stringMatching(/original source pending direct check/i),
        },
      ]);
    }

    const protocol28Bap = PARAMETER_VALUE_RECORDS.find(
      (candidate) =>
        candidate.parameter_value_id === 'pv-p28-bap-hh-direct-slope',
    );
    const irisBap = PARAMETER_VALUE_RECORDS.find(
      (candidate) =>
        candidate.parameter_value_id === 'pv-iris-bap-hh-direct-sf',
    );
    const healthCanadaBap = PARAMETER_VALUE_RECORDS.find(
      (candidate) =>
        candidate.parameter_value_id === 'pv-hc-bap-hh-direct-sf',
    );

    expect(protocol28Bap?.value).not.toBe(irisBap?.value);
    expect(protocol28Bap?.value).not.toBe(healthCanadaBap?.value);
    expect(irisBap?.evidence_support_status).toBe('approved_source_backed');
    expect(irisBap?.qa_status).toBe('approved');
    expect(irisBap?.canonical_source_status).toBe('direct_source_verified');
    expect(healthCanadaBap?.evidence_support_status).toBe(
      'approved_source_backed',
    );
    expect(healthCanadaBap?.qa_status).toBe('approved');
    expect(healthCanadaBap?.canonical_source_status).toBe(
      'direct_source_verified',
    );
  });

  it('records the arsenic direct-source discrepancy without promoting values', () => {
    const arsenicLead = BC_PROTOCOL28_TRV_SOURCE_LEADS.parameter_value_leads.find(
      (lead) => lead.lead_id === 'p28-appendix-8a-arsenic-rfd-sfo',
    );

    expect(arsenicLead?.direct_source_review?.result).toBe(
      'DISCREPANCY_RECORDED_NO_PROMOTION',
    );
    expect(arsenicLead?.direct_source_review?.packet).toBe(
      'matrix_research/reference_catalog/protocol28_arsenic_direct_source_verification_packet_2026_05_25.md',
    );
    expect(arsenicLead?.direct_source_review?.compared_sources).toEqual([
      'src-us-epa-iris-rfd-table-live',
      'src-us-epa-iris-chemical-details-live',
      'src-health-canada-trv-v4-2025',
    ]);
    expect(arsenicLead?.direct_source_review?.value_ids).toEqual([
      'pv-p28-arsenic-hh-food-rfd',
      'pv-p28-arsenic-hh-food-slope',
    ]);
    expect(
      arsenicLead?.direct_source_review?.required_catalog_posture,
    ).toEqual({
      default_status: 'available_option',
      evidence_support_status: 'pending_source_locator',
      qa_status: 'needs_review',
      canonical_source_status: 'needs_direct_source_check',
    });

    for (const valueId of arsenicLead?.direct_source_review?.value_ids ?? []) {
      const record = PARAMETER_VALUE_RECORDS.find(
        (candidate) => candidate.parameter_value_id === valueId,
      );
      expect(record?.default_status, valueId).toBe('available_option');
      expect(record?.evidence_support_status, valueId).toBe(
        'pending_source_locator',
      );
      expect(record?.qa_status, valueId).toBe('needs_review');
      expect(record?.canonical_source_status, valueId).toBe(
        'needs_direct_source_check',
      );
    }
  });

  it('records the PCB mapping ambiguity without promoting the Protocol 28 value', () => {
    const pcbLead = BC_PROTOCOL28_TRV_SOURCE_LEADS.parameter_value_leads.find(
      (lead) => lead.lead_id === 'p28-appendix-8a-pcb-rfd',
    );

    expect(pcbLead?.direct_source_review?.result).toBe(
      'AMBIGUOUS_MAPPING_NO_PROMOTION',
    );
    expect(pcbLead?.direct_source_review?.packet).toBe(
      'matrix_research/reference_catalog/protocol28_pcb_direct_source_verification_packet_2026_05_25.md',
    );
    expect(pcbLead?.direct_source_review?.compared_sources).toEqual([
      'src-us-epa-iris-rfd-table-live',
      'src-us-epa-iris-chemical-details-live',
      'src-us-epa-iris-aroclor-1254',
      'src-health-canada-trv-v4-2025',
    ]);
    expect(pcbLead?.direct_source_review?.value_ids).toEqual([
      'pv-p28-pcb-hh-food-rfd',
    ]);
    expect(pcbLead?.direct_source_review?.required_catalog_posture).toEqual({
      default_status: 'available_option',
      evidence_support_status: 'pending_source_locator',
      qa_status: 'needs_review',
      canonical_source_status: 'needs_direct_source_check',
    });
    expect(pcbLead?.direct_source_review?.note).toMatch(
      /total-PCBs versus Aroclor\/congener\/mixture mapping/i,
    );

    const protocol28Pcb = PARAMETER_VALUE_RECORDS.find(
      (candidate) =>
        candidate.parameter_value_id === 'pv-p28-pcb-hh-food-rfd',
    );
    const irisPcbFood = PARAMETER_VALUE_RECORDS.find(
      (candidate) =>
        candidate.parameter_value_id ===
        'pv-iris-pcb-hh-food-rfd-aroclor1254',
    );
    const irisPcbDirect = PARAMETER_VALUE_RECORDS.find(
      (candidate) =>
        candidate.parameter_value_id ===
        'pv-iris-pcb-hh-direct-rfd-aroclor1254',
    );
    const healthCanadaPcbFood = PARAMETER_VALUE_RECORDS.find(
      (candidate) =>
        candidate.parameter_value_id === 'pv-hc-pcb-hh-food-rfd-nondioxin',
    );
    const healthCanadaPcbDirect = PARAMETER_VALUE_RECORDS.find(
      (candidate) =>
        candidate.parameter_value_id === 'pv-hc-pcb-hh-direct-rfd-nondioxin',
    );

    expect(protocol28Pcb?.value).not.toBe(irisPcbFood?.value);
    expect(protocol28Pcb?.value).not.toBe(healthCanadaPcbFood?.value);
    expect(protocol28Pcb?.source_ids).toEqual([
      'src-bc-protocol-28-v3-0-2024',
    ]);
    expect(protocol28Pcb?.canonical_source_ids).toEqual([]);
    expect(protocol28Pcb?.source_relationships).toEqual([
      {
        source_id: 'src-bc-protocol-28-v3-0-2024',
        role: 'policy_compilation',
        note: expect.stringMatching(/original source pending direct check/i),
      },
    ]);
    expect(protocol28Pcb?.default_status).toBe('available_option');
    expect(protocol28Pcb?.evidence_support_status).toBe(
      'pending_source_locator',
    );
    expect(protocol28Pcb?.qa_status).toBe('needs_review');
    expect(protocol28Pcb?.canonical_source_status).toBe(
      'needs_direct_source_check',
    );
    // IRIS Aroclor 1254 rows remain available_option candidates (never promoted to default).
    for (const sourceBackedPcb of [irisPcbFood, irisPcbDirect]) {
      expect(sourceBackedPcb?.default_status).toBe('available_option');
      expect(sourceBackedPcb?.evidence_support_status).toBe(
        'approved_source_backed',
      );
      expect(sourceBackedPcb?.qa_status).toBe('approved');
      expect(sourceBackedPcb?.canonical_source_status).toBe(
        'direct_source_verified',
      );
    }
    // Health Canada non-dioxin-like rows are the owner-ruled 2026-07-16 human-health default
    // (more protective + newer than IRIS Aroclor 1254 1994; see
    // promote-pcb-hc-nondioxin-default.mjs). qa/evidence/canonical status unchanged.
    for (const sourceBackedPcb of [healthCanadaPcbFood, healthCanadaPcbDirect]) {
      expect(sourceBackedPcb?.default_status).toBe('current_default');
      expect(sourceBackedPcb?.evidence_support_status).toBe(
        'approved_source_backed',
      );
      expect(sourceBackedPcb?.qa_status).toBe('approved');
      expect(sourceBackedPcb?.canonical_source_status).toBe(
        'direct_source_verified',
      );
    }
  });

  it('records the zinc direct-source match without promoting the Protocol 28 value', () => {
    const zincLead = BC_PROTOCOL28_TRV_SOURCE_LEADS.parameter_value_leads.find(
      (lead) => lead.lead_id === 'p28-appendix-8a-zinc-rfd',
    );

    expect(zincLead?.direct_source_review?.result).toBe(
      'DIRECT_SOURCE_MATCH_NO_PROMOTION',
    );
    expect(zincLead?.direct_source_review?.packet).toBe(
      'matrix_research/reference_catalog/protocol28_zinc_direct_source_verification_packet_2026_05_25.md',
    );
    expect(zincLead?.direct_source_review?.compared_sources).toEqual([
      'src-us-epa-iris-rfd-table-live',
      'src-health-canada-trv-v4-2025',
    ]);
    expect(zincLead?.direct_source_review?.value_ids).toEqual([
      'pv-p28-zinc-hh-food-rfd',
    ]);
    expect(zincLead?.direct_source_review?.required_catalog_posture).toEqual({
      default_status: 'available_option',
      evidence_support_status: 'pending_source_locator',
      qa_status: 'needs_review',
      canonical_source_status: 'needs_direct_source_check',
    });

    const protocol28Zinc = PARAMETER_VALUE_RECORDS.find(
      (candidate) =>
        candidate.parameter_value_id === 'pv-p28-zinc-hh-food-rfd',
    );
    const irisZinc = PARAMETER_VALUE_RECORDS.find(
      (candidate) =>
        candidate.parameter_value_id === 'pv-iris-zinc-hh-food-rfd',
    );

    expect(protocol28Zinc?.value).toBe(irisZinc?.value);
    expect(protocol28Zinc?.source_ids).toEqual([
      'src-bc-protocol-28-v3-0-2024',
    ]);
    expect(protocol28Zinc?.canonical_source_ids).toEqual([]);
    expect(protocol28Zinc?.source_relationships).toEqual([
      {
        source_id: 'src-bc-protocol-28-v3-0-2024',
        role: 'policy_compilation',
        note: expect.stringMatching(/original source pending direct check/i),
      },
    ]);
    expect(protocol28Zinc?.default_status).toBe('available_option');
    expect(protocol28Zinc?.evidence_support_status).toBe(
      'pending_source_locator',
    );
    expect(protocol28Zinc?.qa_status).toBe('needs_review');
    expect(protocol28Zinc?.canonical_source_status).toBe(
      'needs_direct_source_check',
    );
    expect(irisZinc?.evidence_support_status).toBe('approved_source_backed');
    expect(irisZinc?.qa_status).toBe('approved');
    expect(irisZinc?.canonical_source_status).toBe('direct_source_verified');
  });

  it('resolves current Benzo[a]pyrene Eco-Direct defaults', () => {
    expect(
      getParameterValueRecord(
        'benzo_a_pyrene',
        'eco-direct-eqp',
        'logKow',
      )?.value,
    ).toBe(6.13);
    // fcv_ug_per_L: pv-bap-fcv was DELETED 2026-07-02 (fabricated-source demotion -- see
    // substanceLibrary.ts benzo_a_pyrene notes). No catalog row remains for this tuple.
    expect(
      getParameterValueRecord(
        'benzo_a_pyrene',
        'eco-direct-eqp',
        'fcv_ug_per_L',
      ),
    ).toBeUndefined();
  });

  it('provides pathway equation records for calculator panels', () => {
    expect(getPathwayEquationRecords('eco-direct-eqp')).toHaveLength(1);
    expect(resolveEquationsForPathway('eco-food-bsaf')).toHaveLength(1);
    expect(resolveEquationsForPathway('background-adjustment')).toHaveLength(1);
    expect(resolveEquationsForPathway('human-health-direct')).toHaveLength(1);
    expect(resolveEquationsForPathway('human-health-food')).toHaveLength(1);
  });

  it('resolves display rows with catalog metadata and user-entered rows', () => {
    // rows[0] used to cite benzo_a_pyrene's fcv_ug_per_L (pv-bap-fcv), but that row was DELETED
    // 2026-07-02 (fabricated-source demotion). Use logKow instead -- still a current_default,
    // pending_source_locator row (pv-bap-logkow) unaffected by the correction -- to keep exercising
    // the "current calculator default" scaffold-attribution path this test covers.
    const rows = resolveProvenanceRows([
      {
        input_key: 'logKow',
        label: 'log Kow',
        value: 6.13,
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

    expect(rows[0].catalog_record?.parameter_value_id).toBe('pv-bap-logkow');
    expect(rows[0].sources.length).toBeGreaterThan(0);
    expect(rows[0].evidence_items[0]?.locator).toMatch(/source page\/table pending/i);
    expect(rows[0].default_status).toBe('current_default');
    expect(rows[0].evidence_support_status).toBe('pending_source_locator');
    expect(rows[0].role).toBe('current calculator default');
    expect(rows[1].catalog_record).toBeNull();
    expect(rows[1].qa_status).toBe('not_cataloged');
    expect(rows[1].evidence_support_status).toBe('user_entered_or_derived');
    // rows[2] (total_pcbs_aroclor_1254 fcv_ug_per_L, pv-pcb-fcv) was PROMOTED to approved_source_backed
    // 2026-07-02 (re-cited to the real US EPA NRWQC total-PCBs chronic criterion). default_status stays
    // current_default (unchanged); role stays the usedValue's own role since resolveRole no longer
    // downgrades an approved_source_backed catalog record to "current calculator default".
    expect(rows[2].catalog_record?.default_status).toBe('current_default');
    expect(rows[2].evidence_support_status).toBe('approved_source_backed');
    expect(rows[2].role).toBe('source-backed default');
  });

  it('keeps current_default catalog scaffolds in sync with the live substance library (integrity fix 2026-07-02)', () => {
    // Map the catalog's input_key vocabulary to the corresponding SubstanceEntry field. A
    // current_default row is supposed to be a scaffold MIRROR of whatever the live calculator
    // (substanceLibrary.ts) currently ships -- if the library value moves (a correction) and the
    // catalog scaffold isn't synced, or the library nulls the field entirely, the scaffold goes
    // stale and misleads reviewers. This guard catches both cases going forward. See PR #444 (the
    // copper/lead/BaP corrections) and the pv-bap-trv-eco deletion this same fix landed.
    const INPUT_KEY_TO_LIBRARY_FIELD: Record<string, keyof SubstanceEntry> = {
      rfd_oral_mg_per_kg_bw_day: 'rfd_oral_mg_per_kg_bw_per_day',
      sf_oral_per_mg_per_kg_bw_per_day: 'sf_oral_per_mg_per_kg_bw_per_day',
      fcv_ug_per_L: 'fcv_ug_per_L',
      trv_eco_mg_per_kg_bw_day: 'trv_eco_mg_per_kg_bw_day',
      logKow: 'logKow',
      bsaf_loc_freshwater: 'bsaf_loc_freshwater',
      abs_dermal: 'abs_dermal',
      ba_oral: 'ba_oral',
    };

    const currentDefaultDriftFailures: string[] = [];

    for (const record of PARAMETER_VALUE_RECORDS) {
      if (record.default_status !== 'current_default') {
        continue;
      }
      const libraryField = INPUT_KEY_TO_LIBRARY_FIELD[record.input_key];
      if (!libraryField) {
        continue;
      }
      const substance = findSubstance(record.substance_key);
      const libraryValue = substance?.[libraryField];

      if (typeof libraryValue !== 'number') {
        currentDefaultDriftFailures.push(
          `${record.parameter_value_id} (substance_key=${record.substance_key}, input_key=${record.input_key}): ` +
            `catalog current_default value=${String(record.value)} but library field ` +
            `'${String(libraryField)}' is ${String(libraryValue)} (null/missing) -- a current_default ` +
            'scaffold must not exist for a nulled library field.',
        );
        continue;
      }
      if (libraryValue !== record.value) {
        currentDefaultDriftFailures.push(
          `${record.parameter_value_id} (substance_key=${record.substance_key}, input_key=${record.input_key}): ` +
            `catalog current_default value=${String(record.value)} != library '${String(libraryField)}' ` +
            `value=${String(libraryValue)}.`,
        );
      }
    }

    expect(currentDefaultDriftFailures).toEqual([]);
  });

  // Notes for value/value_text consistency guard:
  // - This intentionally does NOT assert on rows without a "TRV Value:" label (P28 policy-compilation rows)
  //   or unit-converted rows (IUR/RfC) -- the same scope as the audit's class-A.
  it('keeps each single_value catalog row numeric value in sync with its evidence value_text (same-unit; integrity guard 2026-07-04)', () => {
    const mismatches: string[] = [];
    let compared = 0;
    for (const record of PARAMETER_VALUE_RECORDS) {
      if (record.value_type !== 'single_value') continue;
      if (typeof record.value !== 'number' || !Number.isFinite(record.value)) continue;
      const ev = Array.isArray(record.evidence_items) ? record.evidence_items[0] : undefined;
      const vt = ev && typeof ev.value_text === 'string' ? ev.value_text : '';
      // Only compare when the value_text has an explicit "TRV Value:" anchor (else unparseable -> skip).
      const parsed = parseTrvValue(vt); // { num, unit } | null  -- ported from audit-hc-p28-integrity.mjs
      if (!parsed || !Number.isFinite(parsed.num)) continue;
      // Only compare when the published unit matches the canonical unit (no conversion).
      if (normalizeUnit(parsed.unit) !== normalizeUnit(record.unit ?? '')) continue;
      compared += 1;
      const a = record.value, b = parsed.num;
      if (Math.abs(a - b) > 0.01 * Math.max(Math.abs(a), Math.abs(b))) {
        mismatches.push(`${record.parameter_value_id}: value=${a} != value_text=${b} (unit ${record.unit})`);
      }
    }
    expect(mismatches, `value/value_text drift (same unit):\n${mismatches.join('\n')}`).toEqual([]);
    // Coverage floor: guard against the parser silently going vacuous (e.g. a value_text
    // format change). Currently ~69 same-unit rows are comparable; assert a conservative floor
    // so a future regression that skips everything fails loudly rather than passing on 0 rows.
    expect(compared).toBeGreaterThanOrEqual(50);
  });
});
