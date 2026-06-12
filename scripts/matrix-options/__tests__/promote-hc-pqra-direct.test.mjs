// Guards for the owner-run HC PQRA v4.0 residential-toddler direct-contact promotion tool
// (promote-hc-pqra-direct.mjs). Plain ASCII only.
// Mirrors promote-wlrs-bw-default.test.mjs re-scoped to the 7 HC PQRA records.

import { describe, it, expect } from 'vitest';
import {
  HC_PQRA_PROMOTION_VALUE_IDS,
  HC_PQRA_PROMOTION_SOURCE_ID,
  parseArgs,
  validateApplyOptions,
  planPromotion,
  applyPromotion,
} from '../promote-hc-pqra-direct.mjs';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// Minimal per-record fixtures. Each is the exact pre-promotion state expected by planPromotion.
const BASE_VALUE_FIXTURES = [
  // 0: pv-hc-pqra-v4-2024-bw-toddler-ca
  {
    parameter_value_id: 'pv-hc-pqra-v4-2024-bw-toddler-ca',
    substance_key: 'generic',
    pathway: 'human-health-direct',
    input_key: 'BW_kg',
    value: 16.5,
    unit: 'kg',
    value_type: 'single_value',
    default_status: 'available_option',
    evidence_support_status: 'pending_source_locator',
    qa_status: 'needs_review',
    canonical_source_status: 'needs_direct_source_check',
    candidate_group_id: 'human-health-direct__generic__BW_kg__general',
    jurisdiction: 'general',
    source_ids: [HC_PQRA_PROMOTION_SOURCE_ID],
    applicability: 'HC PQRA v4.0 toddler body weight. needs_review candidate.',
    uncertainty: 'Pending direct-source verification.',
    review_notes: 'HC PQRA v4.0 Appendix E body weight (toddler, 16.5 kg).',
    evidence_items: [{
      source_id: HC_PQRA_PROMOTION_SOURCE_ID,
      locator: 'Appendix E, toddler column',
      value_text: 'toddler: 16.5 kg',
      extraction_method: 'manual_source_extraction',
      extracted_by: 'claude-fable-5',
      extracted_at: '2026-06-11',
      qa_status: 'needs_review',
      evidence_id: 'ev-pv-hc-pqra-v4-2024-bw-toddler-ca-1',
      locator_type: 'source_table',
    }],
    source_relationships: [{
      source_id: HC_PQRA_PROMOTION_SOURCE_ID,
      role: 'canonical_candidate',
      note: 'HC PQRA v4.0 Appendix E.',
    }],
  },
  // 1: pv-hc-pqra-v4-2024-ir-sed-toddler-ca
  {
    parameter_value_id: 'pv-hc-pqra-v4-2024-ir-sed-toddler-ca',
    substance_key: 'generic',
    pathway: 'human-health-direct',
    input_key: 'IR_sed_mg_per_day',
    value: 80,
    unit: 'mg/day',
    value_type: 'single_value',
    default_status: 'available_option',
    evidence_support_status: 'pending_source_locator',
    qa_status: 'needs_review',
    canonical_source_status: 'needs_direct_source_check',
    candidate_group_id: 'human-health-direct__generic__IR_sed_mg_per_day__general',
    jurisdiction: 'general',
    source_ids: [HC_PQRA_PROMOTION_SOURCE_ID],
    applicability: 'HC PQRA v4.0 toddler IR_sed. needs_review candidate.',
    uncertainty: 'Pending direct-source verification.',
    review_notes: 'HC PQRA v4.0 Appendix E IR_sed toddler 80 mg/day.',
    evidence_items: [{
      source_id: HC_PQRA_PROMOTION_SOURCE_ID,
      qa_status: 'needs_review',
      evidence_id: 'ev-pv-hc-pqra-v4-2024-ir-sed-toddler-ca-1',
    }],
    source_relationships: [{
      source_id: HC_PQRA_PROMOTION_SOURCE_ID,
      role: 'canonical_candidate',
      note: 'HC PQRA v4.0 Appendix E.',
    }],
  },
  // 2: pv-hc-pqra-v4-2024-ef-residential-ca
  {
    parameter_value_id: 'pv-hc-pqra-v4-2024-ef-residential-ca',
    substance_key: 'generic',
    pathway: 'human-health-direct',
    input_key: 'EF_days_per_year',
    value: 364,
    unit: 'days/year',
    value_type: 'single_value',
    default_status: 'available_option',
    evidence_support_status: 'pending_source_locator',
    qa_status: 'needs_review',
    canonical_source_status: 'needs_direct_source_check',
    candidate_group_id: 'human-health-direct__generic__EF_days_per_year__general',
    jurisdiction: 'general',
    source_ids: [HC_PQRA_PROMOTION_SOURCE_ID],
    applicability: 'HC PQRA v4.0 residential EF. needs_review candidate.',
    uncertainty: 'Pending direct-source verification.',
    review_notes: 'HC PQRA v4.0 Table 2 residential EF 364 days/year.',
    evidence_items: [{
      source_id: HC_PQRA_PROMOTION_SOURCE_ID,
      qa_status: 'needs_review',
      evidence_id: 'ev-pv-hc-pqra-v4-2024-ef-residential-ca-1',
    }],
    source_relationships: [{
      source_id: HC_PQRA_PROMOTION_SOURCE_ID,
      role: 'canonical_candidate',
      note: 'HC PQRA v4.0 Table 2.',
    }],
  },
  // 3: pv-hc-pqra-v4-2024-ed-residential-ca
  {
    parameter_value_id: 'pv-hc-pqra-v4-2024-ed-residential-ca',
    substance_key: 'generic',
    pathway: 'human-health-direct',
    input_key: 'ED_years',
    value: 80,
    unit: 'years',
    value_type: 'single_value',
    default_status: 'available_option',
    evidence_support_status: 'pending_source_locator',
    qa_status: 'needs_review',
    canonical_source_status: 'needs_direct_source_check',
    candidate_group_id: 'human-health-direct__generic__ED_years__general',
    jurisdiction: 'general',
    source_ids: [HC_PQRA_PROMOTION_SOURCE_ID],
    applicability: 'HC PQRA v4.0 residential ED. needs_review candidate.',
    uncertainty: 'Pending direct-source verification.',
    review_notes: 'HC PQRA v4.0 Table 2 residential ED 80 years.',
    evidence_items: [{
      source_id: HC_PQRA_PROMOTION_SOURCE_ID,
      qa_status: 'needs_review',
      evidence_id: 'ev-pv-hc-pqra-v4-2024-ed-residential-ca-1',
    }],
    source_relationships: [{
      source_id: HC_PQRA_PROMOTION_SOURCE_ID,
      role: 'canonical_candidate',
      note: 'HC PQRA v4.0 Table 2.',
    }],
  },
  // 4: pv-hc-pqra-v4-2024-at-cancer-lifetime-ca
  {
    parameter_value_id: 'pv-hc-pqra-v4-2024-at-cancer-lifetime-ca',
    substance_key: 'generic',
    pathway: 'human-health-direct',
    input_key: 'AT_cancer_years',
    value: 80,
    unit: 'years',
    value_type: 'single_value',
    default_status: 'available_option',
    evidence_support_status: 'pending_source_locator',
    qa_status: 'needs_review',
    canonical_source_status: 'needs_direct_source_check',
    candidate_group_id: 'human-health-direct__generic__AT_cancer_years__general',
    jurisdiction: 'general',
    source_ids: [HC_PQRA_PROMOTION_SOURCE_ID],
    applicability: 'HC PQRA v4.0 cancer AT. needs_review candidate.',
    uncertainty: 'Pending direct-source verification.',
    review_notes: 'HC PQRA v4.0 Table 2 + Box 4 AT_cancer 80 years.',
    evidence_items: [{
      source_id: HC_PQRA_PROMOTION_SOURCE_ID,
      qa_status: 'needs_review',
      evidence_id: 'ev-pv-hc-pqra-v4-2024-at-cancer-lifetime-ca-1',
    }],
    source_relationships: [{
      source_id: HC_PQRA_PROMOTION_SOURCE_ID,
      role: 'canonical_candidate',
      note: 'HC PQRA v4.0 Table 2 + Box 4.',
    }],
  },
  // 5: pv-hc-pqra-v4-2024-sa-total-toddler-ca
  {
    parameter_value_id: 'pv-hc-pqra-v4-2024-sa-total-toddler-ca',
    substance_key: 'generic',
    pathway: 'human-health-direct',
    input_key: 'SA_cm2',
    value: 6130,
    unit: 'cm2',
    value_type: 'single_value',
    default_status: 'available_option',
    evidence_support_status: 'pending_source_locator',
    qa_status: 'needs_review',
    canonical_source_status: 'needs_direct_source_check',
    candidate_group_id: 'human-health-direct__generic__SA_cm2__general',
    jurisdiction: 'general',
    source_ids: [HC_PQRA_PROMOTION_SOURCE_ID],
    applicability: 'HC PQRA v4.0 toddler SA. needs_review candidate.',
    uncertainty: 'Pending direct-source verification.',
    review_notes: 'HC PQRA v4.0 Appendix E toddler SA 6130 cm2.',
    evidence_items: [{
      source_id: HC_PQRA_PROMOTION_SOURCE_ID,
      qa_status: 'needs_review',
      evidence_id: 'ev-pv-hc-pqra-v4-2024-sa-total-toddler-ca-1',
    }],
    source_relationships: [{
      source_id: HC_PQRA_PROMOTION_SOURCE_ID,
      role: 'canonical_candidate',
      note: 'HC PQRA v4.0 Appendix E.',
    }],
  },
  // 6: pv-hc-pqra-v4-2024-af-sed-other-general-ca
  {
    parameter_value_id: 'pv-hc-pqra-v4-2024-af-sed-other-general-ca',
    substance_key: 'generic',
    pathway: 'human-health-direct',
    input_key: 'AF_sed_mg_per_cm2',
    value: 0.01,
    unit: 'mg/cm2',
    value_type: 'single_value',
    default_status: 'available_option',
    evidence_support_status: 'pending_source_locator',
    qa_status: 'needs_review',
    canonical_source_status: 'needs_direct_source_check',
    candidate_group_id: 'human-health-direct__generic__AF_sed_mg_per_cm2__general',
    jurisdiction: 'general',
    source_ids: [HC_PQRA_PROMOTION_SOURCE_ID],
    applicability: 'HC PQRA v4.0 general AF_sed. needs_review candidate.',
    uncertainty: 'Pending direct-source verification.',
    review_notes: 'HC PQRA v4.0 Appendix E non-hand AF_sed 0.01 mg/cm2.',
    evidence_items: [{
      source_id: HC_PQRA_PROMOTION_SOURCE_ID,
      qa_status: 'needs_review',
      evidence_id: 'ev-pv-hc-pqra-v4-2024-af-sed-other-general-ca-1',
    }],
    source_relationships: [{
      source_id: HC_PQRA_PROMOTION_SOURCE_ID,
      role: 'canonical_candidate',
      note: 'HC PQRA v4.0 Appendix E.',
    }],
  },
];

// Source fixture: canonical pre-promotion state (canonical_source_status ABSENT as on the real record).
function makeSourceRecord(overrides = {}) {
  return {
    source_id: HC_PQRA_PROMOTION_SOURCE_ID,
    short_citation: 'Health Canada PQRA v4.0, 2024',
    url: 'https://www.canada.ca/en/health-canada/services/environmental-workplace-health/reports-publications/contaminated-sites/federal-contaminated-site-risk-assessment-canada-part-guidance-human-health-preliminary-quantitative-risk-assessment-pqra.html',
    zotero_item_key: 'SFH7ARKQ',
    zotero_status: 'linked',
    notes: 'Current federal PQRA guidance.',
    // canonical_source_status intentionally absent (mirrors real record)
    currentness_status: 'current',
    file_storage: 'zotero_or_external',
    ...overrides,
  };
}

// Build a full fixture with all 7 value records + 1 untouched extra + the source.
function makeFixture(valueOverrides = {}, sourceOverrides = {}) {
  // Clone all 7 base fixtures, apply per-id overrides if provided.
  const records = BASE_VALUE_FIXTURES.map((base) => {
    const ov = valueOverrides[base.parameter_value_id] || {};
    return { ...JSON.parse(JSON.stringify(base)), ...ov };
  });
  // Add an untouched bystander record.
  records.push({
    parameter_value_id: 'pv-other-untouched',
    substance_key: 'generic',
    pathway: 'human-health-direct',
    input_key: 'BW_kg',
    value: 99,
    unit: 'kg',
    value_type: 'single_value',
    default_status: 'available_option',
    evidence_support_status: 'pending_source_locator',
    qa_status: 'needs_review',
    canonical_source_status: 'needs_direct_source_check',
    candidate_group_id: 'human-health-direct__generic__BW_kg__general',
    jurisdiction: 'general',
    source_ids: ['src-other'],
    evidence_items: [{ source_id: 'src-other', qa_status: 'needs_review', evidence_id: 'ev-other-1' }],
  });
  const sources = [
    makeSourceRecord(sourceOverrides),
    { source_id: 'src-other-untouched', currentness_status: 'current' },
  ];
  return { records, sources };
}

const clone = (x) => JSON.parse(JSON.stringify(x));
const APPLY_OPTS = { reviewer: 'J. Nelson', date: '2026-06-12', sourceUrl: null, zoteroKey: null };

// Fully-promoted state for a single value record.
function doneValue(base) {
  return {
    ...base,
    qa_status: 'approved',
    evidence_support_status: 'approved_source_backed',
    canonical_source_status: 'direct_source_verified',
    evidence_items: base.evidence_items.map((ev) => ({
      ...ev,
      qa_status: 'approved',
      reviewed_by: 'J. Nelson',
      reviewed_at: '2026-06-12',
    })),
  };
}

// Build a valueOverrides map where all 7 records are in the done state.
function allDoneOverrides() {
  const ov = {};
  for (const base of BASE_VALUE_FIXTURES) {
    ov[base.parameter_value_id] = doneValue(base);
  }
  return ov;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('promote-hc-pqra-direct: scope constants', () => {
  it('exports exactly 7 value IDs', () => {
    expect(HC_PQRA_PROMOTION_VALUE_IDS).toHaveLength(7);
  });
  it('lists the correct value IDs in order', () => {
    expect(HC_PQRA_PROMOTION_VALUE_IDS[0]).toBe('pv-hc-pqra-v4-2024-bw-toddler-ca');
    expect(HC_PQRA_PROMOTION_VALUE_IDS[1]).toBe('pv-hc-pqra-v4-2024-ir-sed-toddler-ca');
    expect(HC_PQRA_PROMOTION_VALUE_IDS[2]).toBe('pv-hc-pqra-v4-2024-ef-residential-ca');
    expect(HC_PQRA_PROMOTION_VALUE_IDS[3]).toBe('pv-hc-pqra-v4-2024-ed-residential-ca');
    expect(HC_PQRA_PROMOTION_VALUE_IDS[4]).toBe('pv-hc-pqra-v4-2024-at-cancer-lifetime-ca');
    expect(HC_PQRA_PROMOTION_VALUE_IDS[5]).toBe('pv-hc-pqra-v4-2024-sa-total-toddler-ca');
    expect(HC_PQRA_PROMOTION_VALUE_IDS[6]).toBe('pv-hc-pqra-v4-2024-af-sed-other-general-ca');
  });
  it('targets the correct source', () => {
    expect(HC_PQRA_PROMOTION_SOURCE_ID).toBe('src-health-canada-pqra-v4-2024');
  });
});

describe('promote-hc-pqra-direct: parseArgs', () => {
  it('parses flags and values', () => {
    const a = parseArgs(['node', 's', '--reviewer', 'J. Nelson', '--date', '2026-06-12',
      '--source-url', 'https://canada.ca/x', '--zotero-key', 'SFH7ARKQ', '--apply']);
    expect(a).toMatchObject({
      reviewer: 'J. Nelson', date: '2026-06-12', sourceUrl: 'https://canada.ca/x',
      zoteroKey: 'SFH7ARKQ', apply: true,
    });
  });
  it('defaults to a dry run', () => {
    expect(parseArgs(['node', 's']).apply).toBe(false);
  });
  it('throws on unknown argument', () => {
    expect(() => parseArgs(['node', 's', '--bogus'])).toThrow(/Unknown argument/);
  });
});

describe('promote-hc-pqra-direct: validateApplyOptions', () => {
  it('accepts a complete attestation', () => {
    expect(() => validateApplyOptions(APPLY_OPTS)).not.toThrow();
  });
  it('requires reviewer', () => {
    expect(() => validateApplyOptions({ ...APPLY_OPTS, reviewer: '' })).toThrow(/reviewer/);
  });
  it('requires a YYYY-MM-DD date', () => {
    expect(() => validateApplyOptions({ ...APPLY_OPTS, date: '2026/06/12' })).toThrow(/date/);
  });
});

describe('promote-hc-pqra-direct: planPromotion -- happy path', () => {
  it('plans all 7 values to promote + source (absent canonical_source_status = promotable)', () => {
    const { records, sources } = makeFixture();
    const plan = planPromotion(records, sources, APPLY_OPTS);
    expect(plan.valueResults).toHaveLength(7);
    expect(plan.valueResults.every((vr) => vr.promoteValue)).toBe(true);
    expect(plan.promoteSource).toBe(true);
  });
  it('treats needs_direct_source_check on source as promotable', () => {
    const { records, sources } = makeFixture({}, { canonical_source_status: 'needs_direct_source_check' });
    const plan = planPromotion(records, sources, APPLY_OPTS);
    expect(plan.promoteSource).toBe(true);
  });
  it('skips source when already direct_source_verified', () => {
    const { records, sources } = makeFixture({}, { canonical_source_status: 'direct_source_verified' });
    const plan = planPromotion(records, sources, APPLY_OPTS);
    expect(plan.promoteSource).toBe(false);
    expect(plan.sourceAlreadyDone).toBe(true);
  });
});

describe('promote-hc-pqra-direct: planPromotion -- fail-closed preconditions', () => {
  it('throws when a value record is missing', () => {
    const { records, sources } = makeFixture();
    const filtered = records.filter((r) => r.parameter_value_id !== 'pv-hc-pqra-v4-2024-bw-toddler-ca');
    expect(() => planPromotion(filtered, sources, APPLY_OPTS)).toThrow(/not found/);
  });
  it('throws when a value has no evidence_items', () => {
    const { records, sources } = makeFixture({
      'pv-hc-pqra-v4-2024-bw-toddler-ca': { evidence_items: [] },
    });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/no evidence_items/);
  });
  it('throws on identity mismatch (wrong value)', () => {
    const { records, sources } = makeFixture({
      'pv-hc-pqra-v4-2024-bw-toddler-ca': { value: 99 },
    });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/expected frame-eligible identity/);
  });
  it('throws on identity mismatch (wrong jurisdiction)', () => {
    const { records, sources } = makeFixture({
      'pv-hc-pqra-v4-2024-ef-residential-ca': { jurisdiction: 'BC' },
    });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/expected frame-eligible identity/);
  });
  it('throws on identity mismatch (wrong unit)', () => {
    const { records, sources } = makeFixture({
      'pv-hc-pqra-v4-2024-ir-sed-toddler-ca': { unit: 'g/day' },
    });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/expected frame-eligible identity/);
  });
  it('throws when source_ids does not match the HC PQRA source', () => {
    const { records, sources } = makeFixture({
      'pv-hc-pqra-v4-2024-bw-toddler-ca': { source_ids: ['src-wrong'] },
    });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/source_ids must be EXACTLY/);
  });
  it('throws when source_ids has a second linked source (under-block risk)', () => {
    const { records, sources } = makeFixture({
      'pv-hc-pqra-v4-2024-bw-toddler-ca': { source_ids: [HC_PQRA_PROMOTION_SOURCE_ID, 'src-extra'] },
    });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/source_ids must be EXACTLY/);
  });
  it('throws on a drifted pre-state (qa_status superseded)', () => {
    const { records, sources } = makeFixture({
      'pv-hc-pqra-v4-2024-sa-total-toddler-ca': { qa_status: 'superseded' },
    });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/expected pre-promotion state/);
  });
  it('throws on a drifted source canonical_source_status', () => {
    const { records, sources } = makeFixture({}, { canonical_source_status: 'not_applicable' });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/neither needs_direct_source_check\/absent/);
  });
  it('throws when the source role is policy_compilation', () => {
    // Inject via source_relationships on a value record.
    const { records, sources } = makeFixture({
      'pv-hc-pqra-v4-2024-bw-toddler-ca': {
        source_relationships: [{ source_id: HC_PQRA_PROMOTION_SOURCE_ID, role: 'policy_compilation' }],
      },
    });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/policy_compilation\/reference_mining/);
  });
  it('throws when a source_relationships role is reference_mining', () => {
    const { records, sources } = makeFixture({
      'pv-hc-pqra-v4-2024-ef-residential-ca': {
        source_relationships: [{ source_id: HC_PQRA_PROMOTION_SOURCE_ID, role: 'reference_mining' }],
      },
    });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/policy_compilation\/reference_mining/);
  });
  it('throws when the source is not current (not direct-current eligible)', () => {
    const { records, sources } = makeFixture({}, { currentness_status: 'superseded' });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/direct-current eligible/);
  });
  it('throws when the source is repo_metadata_only', () => {
    const { records, sources } = makeFixture({}, { file_storage: 'repo_metadata_only' });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/direct-current eligible/);
  });
  it('throws when the source record is missing', () => {
    const { records, sources } = makeFixture();
    const filteredSrc = sources.filter((s) => s.source_id !== HC_PQRA_PROMOTION_SOURCE_ID);
    expect(() => planPromotion(records, filteredSrc, APPLY_OPTS)).toThrow(/not found in sources.json/);
  });
});

describe('promote-hc-pqra-direct: idempotency', () => {
  it('skips all value records + source when everything is already done', () => {
    const { records, sources } = makeFixture(
      allDoneOverrides(),
      { canonical_source_status: 'direct_source_verified' },
    );
    const plan = planPromotion(records, sources, APPLY_OPTS);
    expect(plan.valueResults.every((vr) => !vr.promoteValue && vr.valueAlreadyDone)).toBe(true);
    expect(plan.promoteSource).toBe(false);
  });
  it('throws on a partially-promoted record (top-level done, evidence still needs_review)', () => {
    const { records, sources } = makeFixture({
      'pv-hc-pqra-v4-2024-bw-toddler-ca': {
        qa_status: 'approved',
        evidence_support_status: 'approved_source_backed',
        canonical_source_status: 'direct_source_verified',
        // evidence_items still needs_review (partial drift)
      },
    });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/drifted\/partially-promoted/);
  });
  it('applyPromotion run twice is a no-op on the second run', () => {
    const { records, sources } = makeFixture();
    applyPromotion(records, sources, APPLY_OPTS);
    const second = applyPromotion(records, sources, APPLY_OPTS);
    expect(second.valueResults.every((vr) => !vr.promoteValue)).toBe(true);
    expect(second.promoteSource).toBe(false);
  });
  it('on a locator-only re-run with all done, returns sourceTouched=true and updates the url', () => {
    const { records, sources } = makeFixture(
      allDoneOverrides(),
      { canonical_source_status: 'direct_source_verified', url: '<placeholder>' },
    );
    const applied = applyPromotion(records, sources, { ...APPLY_OPTS, sourceUrl: 'https://canada.ca/real.pdf' });
    expect(applied.valueResults.every((vr) => !vr.promoteValue)).toBe(true);
    expect(applied.sourceTouched).toBe(true);
    const s = sources.find((x) => x.source_id === HC_PQRA_PROMOTION_SOURCE_ID);
    expect(s.url).toBe('https://canada.ca/real.pdf');
  });
});

describe('promote-hc-pqra-direct: field edits on each of the 7 value records', () => {
  it('flips qa + evidence + adds attestation on all 7 records', () => {
    const { records, sources } = makeFixture();
    applyPromotion(records, sources, APPLY_OPTS);
    for (const valueId of HC_PQRA_PROMOTION_VALUE_IDS) {
      const r = records.find((x) => x.parameter_value_id === valueId);
      expect(r.qa_status).toBe('approved');
      expect(r.evidence_support_status).toBe('approved_source_backed');
      expect(r.canonical_source_status).toBe('direct_source_verified');
      expect(r.default_status).toBe('available_option'); // never promoted to a default
      const ev = r.evidence_items[0];
      expect(ev.qa_status).toBe('approved');
      expect(ev.reviewed_by).toBe('J. Nelson');
      expect(ev.reviewed_at).toBe('2026-06-12');
      // reviewed_by and reviewed_at must be immediately after qa_status in the evidence item.
      const keys = Object.keys(ev);
      const qi = keys.indexOf('qa_status');
      expect(keys[qi + 1]).toBe('reviewed_by');
      expect(keys[qi + 2]).toBe('reviewed_at');
    }
  });
  it('promotes the source and ADDS canonical_source_status when absent', () => {
    const { records, sources } = makeFixture(); // source has no canonical_source_status
    const applied = applyPromotion(records, sources, APPLY_OPTS);
    expect(applied.promoteSource).toBe(true);
    const s = sources.find((x) => x.source_id === HC_PQRA_PROMOTION_SOURCE_ID);
    expect(s.canonical_source_status).toBe('direct_source_verified');
  });
  it('stamps provenance fields on all 7 records on fresh promotion', () => {
    const { records, sources } = makeFixture();
    applyPromotion(records, sources, APPLY_OPTS);
    for (const valueId of HC_PQRA_PROMOTION_VALUE_IDS) {
      const r = records.find((x) => x.parameter_value_id === valueId);
      expect(r.applicability).toContain('PROMOTED to approved');
      expect(r.uncertainty).toContain('PROMOTED to approved');
      expect(r.review_notes).toContain('PROMOTED to approved');
    }
  });
  it('never mutates a non-target value or source record', () => {
    const { records, sources } = makeFixture();
    const beforeVal = clone(records.find((r) => r.parameter_value_id === 'pv-other-untouched'));
    const beforeSrc = clone(sources.find((s) => s.source_id === 'src-other-untouched'));
    applyPromotion(records, sources, APPLY_OPTS);
    expect(records.find((r) => r.parameter_value_id === 'pv-other-untouched')).toEqual(beforeVal);
    expect(sources.find((s) => s.source_id === 'src-other-untouched')).toEqual(beforeSrc);
  });
  it('does not double-stamp an already-stamped record (idempotent stamp, valueTouched=false)', () => {
    const stamped = ' [PROMOTED to approved on 2026-06-12 by J. Nelson]';
    const doneOverrides = {};
    for (const base of BASE_VALUE_FIXTURES) {
      doneOverrides[base.parameter_value_id] = {
        ...doneValue(base),
        applicability: base.applicability + stamped,
        uncertainty: base.uncertainty + stamped,
        review_notes: base.review_notes + stamped,
      };
    }
    const { records, sources } = makeFixture(doneOverrides, { canonical_source_status: 'direct_source_verified' });
    const applied = applyPromotion(records, sources, APPLY_OPTS);
    expect(applied.valueTouchedFlags.every((t) => t === false)).toBe(true);
    for (const valueId of HC_PQRA_PROMOTION_VALUE_IDS) {
      const r = records.find((x) => x.parameter_value_id === valueId);
      expect(r.applicability.match(/PROMOTED to approved/g)).toHaveLength(1);
    }
  });
  it('repairs a missing provenance stamp on an already-approved record (valueTouched=true)', () => {
    const doneOverrides = {};
    for (const base of BASE_VALUE_FIXTURES) {
      doneOverrides[base.parameter_value_id] = {
        ...doneValue(base),
        // applicability missing stamp; uncertainty + review_notes already stamped
        applicability: base.applicability,
        uncertainty: base.uncertainty + ' [PROMOTED to approved on 2026-06-12 by J. Nelson]',
        review_notes: base.review_notes + ' [PROMOTED to approved on 2026-06-12 by J. Nelson]',
      };
    }
    const { records, sources } = makeFixture(doneOverrides, { canonical_source_status: 'direct_source_verified' });
    const applied = applyPromotion(records, sources, APPLY_OPTS);
    expect(applied.valueTouchedFlags.every((t) => t === true)).toBe(true);
    for (const valueId of HC_PQRA_PROMOTION_VALUE_IDS) {
      const r = records.find((x) => x.parameter_value_id === valueId);
      expect(r.applicability).toContain('PROMOTED to approved');
      // uncertainty and review_notes should still have only 1 stamp
      expect(r.uncertainty.match(/PROMOTED to approved/g)).toHaveLength(1);
    }
  });
  it('repairs a stale zotero_status when the key already matches', () => {
    const { records, sources } = makeFixture(
      allDoneOverrides(),
      { canonical_source_status: 'direct_source_verified', zotero_item_key: 'SFH7ARKQ', zotero_status: 'pending_owner_export' },
    );
    const applied = applyPromotion(records, sources, { ...APPLY_OPTS, zoteroKey: 'SFH7ARKQ' });
    const s = sources.find((x) => x.source_id === HC_PQRA_PROMOTION_SOURCE_ID);
    expect(s.zotero_status).toBe('linked');
    expect(applied.sourceTouched).toBe(true);
  });
});
