// Guards for the owner-run US EPA IRIS oral-RfD batch promotion tool (promote-iris-rfd-batch.mjs).
// Plain ASCII only. Builds complete fixtures from the tool's exported PROMOTION_ROWS so planPromotion
// (which iterates every id) has all records present. Mirrors promote-hc-trv-v4-2025.test.mjs.

import { describe, it, expect } from 'vitest';
import {
  IRIS_RFD_BATCH_PROMOTION_VALUE_IDS,
  IRIS_RFD_BATCH_PROMOTION_SOURCE_ID,
  PROMOTION_ROWS,
  parseArgs,
  validateApplyOptions,
  planPromotion,
  applyPromotion,
} from '../promote-iris-rfd-batch.mjs';

const SOURCE_ID = IRIS_RFD_BATCH_PROMOTION_SOURCE_ID;
const JURISDICTION = 'US_federal';

function baseRecord(spec) {
  const { id, substanceKey, pathway, inputKey, value, unit } = spec;
  return {
    parameter_value_id: id,
    substance_key: substanceKey,
    pathway,
    input_key: inputKey,
    value,
    unit,
    value_type: 'single_value',
    default_status: 'available_option',
    evidence_support_status: 'approved_source_backed',
    qa_status: 'needs_review',
    canonical_source_status: 'needs_direct_source_check',
    candidate_group_id: pathway + '__' + substanceKey + '__' + inputKey + '__' + JURISDICTION,
    jurisdiction: JURISDICTION,
    source_ids: [SOURCE_ID],
    applicability: 'US EPA IRIS oral RfD for ' + substanceKey + '; needs_review candidate.',
    uncertainty: null,
    review_notes: 'US EPA IRIS RfD candidate, robot-extracted. qa_status=needs_review.',
    evidence_items: [{
      source_id: SOURCE_ID,
      locator: 'US EPA IRIS, ' + substanceKey + ' Oral RfD Summary',
      value_text: String(value),
      extraction_method: 'manual_source_extraction',
      extracted_by: 'claude-opus-4-8',
      extracted_at: '2026-05-31',
      qa_status: 'needs_review',
      evidence_id: 'ev-' + id + '-1',
      locator_type: 'source_table',
      note: 'Robot-extracted from US EPA IRIS; pending direct-source verification.',
    }],
    source_relationships: [{ source_id: SOURCE_ID, role: 'canonical_candidate', note: 'IRIS source.' }],
  };
}

const BASE_VALUE_FIXTURES = PROMOTION_ROWS.map(baseRecord);

function makeSourceRecord(overrides = {}) {
  return {
    source_id: SOURCE_ID,
    short_citation: 'US EPA IRIS RfD table, live',
    url: 'https://iris.epa.gov/AdvancedSearch/rfd_toxicity_values',
    zotero_item_key: null,
    zotero_status: 'pending_owner_export',
    notes: 'Live IRIS human-health RfD toxicity-value table.',
    currentness_status: 'current',
    file_storage: 'zotero_or_external',
    calculator_source_role: 'canonical_candidate',
    canonical_source_status: 'direct_source_verified',
    ...overrides,
  };
}

function makeFixture(valueOverrides = {}, sourceOverrides = {}) {
  const records = BASE_VALUE_FIXTURES.map((base) => {
    const ov = valueOverrides[base.parameter_value_id] || {};
    return { ...JSON.parse(JSON.stringify(base)), ...ov };
  });
  records.push({
    parameter_value_id: 'pv-other-untouched',
    substance_key: 'generic',
    pathway: 'human-health-direct',
    input_key: 'rfd_oral_mg_per_kg_bw_day',
    value: 99,
    unit: 'mg/kg-bw/day',
    value_type: 'single_value',
    default_status: 'available_option',
    evidence_support_status: 'approved_source_backed',
    qa_status: 'needs_review',
    canonical_source_status: 'needs_direct_source_check',
    candidate_group_id: 'human-health-direct__generic__rfd_oral_mg_per_kg_bw_day__' + JURISDICTION,
    jurisdiction: JURISDICTION,
    source_ids: ['src-other'],
    evidence_items: [{ source_id: 'src-other', qa_status: 'needs_review', evidence_id: 'ev-other-1' }],
  });
  const sources = [makeSourceRecord(sourceOverrides), { source_id: 'src-other-untouched', currentness_status: 'current' }];
  return { records, sources };
}

const clone = (x) => JSON.parse(JSON.stringify(x));
const APPLY_OPTS = { reviewer: 'J. Nelson', date: '2026-06-21', sourceUrl: null, zoteroKey: null };

function doneValue(base) {
  return {
    ...base,
    qa_status: 'approved',
    canonical_source_status: 'direct_source_verified',
    evidence_items: base.evidence_items.map((ev) => ({ ...ev, qa_status: 'approved', reviewed_by: 'J. Nelson', reviewed_at: '2026-06-21' })),
  };
}

describe('promote-iris-rfd-batch: scope constants', () => {
  it('exports EXACTLY the 680 clean RfD ids (726 needs_review minus 46 dupe-candidate_group_id)', () => {
    // Pinned scope: the data file is the 726 needs_review src-us-epa-iris-rfd-table-live rows MINUS the
    // 46 dupe-candidate_group_id rows (trimethylbenzenes/TCA/RDX/short-chain PFAS multi-estimate RfDs),
    // which are excluded + deferred for separate owner resolution. Asserting the exact count keeps the
    // attestation scope honest (a silent truncation or expansion fails here).
    expect(IRIS_RFD_BATCH_PROMOTION_VALUE_IDS).toHaveLength(680);
  });
  it('every id is a pv-iris-* id', () => {
    for (const id of IRIS_RFD_BATCH_PROMOTION_VALUE_IDS) expect(id.startsWith('pv-iris-'), id).toBe(true);
  });
  it('has no duplicate ids', () => {
    expect(new Set(IRIS_RFD_BATCH_PROMOTION_VALUE_IDS).size).toBe(IRIS_RFD_BATCH_PROMOTION_VALUE_IDS.length);
  });
  it('has no duplicate candidate_group_id (frame-seed uniqueness)', () => {
    const cg = PROMOTION_ROWS.map((r) => r.pathway + '__' + r.substanceKey + '__' + r.inputKey + '__' + JURISDICTION);
    expect(new Set(cg).size).toBe(cg.length);
  });
  it('targets the live IRIS RfD source', () => {
    expect(IRIS_RFD_BATCH_PROMOTION_SOURCE_ID).toBe('src-us-epa-iris-rfd-table-live');
  });
  it('is exclusively oral RfD rows', () => {
    for (const r of PROMOTION_ROWS) expect(r.inputKey, r.id).toBe('rfd_oral_mg_per_kg_bw_day');
  });
});

describe('promote-iris-rfd-batch: parseArgs + validateApplyOptions', () => {
  it('parses flags', () => { expect(parseArgs(['n', 's', '--reviewer', 'J. Nelson', '--date', '2026-06-21', '--apply'])).toMatchObject({ reviewer: 'J. Nelson', date: '2026-06-21', apply: true }); });
  it('defaults to dry run', () => { expect(parseArgs(['n', 's']).apply).toBe(false); });
  it('throws on unknown arg', () => { expect(() => parseArgs(['n', 's', '--bogus'])).toThrow(/Unknown argument/); });
  it('accepts a complete attestation', () => { expect(() => validateApplyOptions(APPLY_OPTS)).not.toThrow(); });
  it('requires reviewer', () => { expect(() => validateApplyOptions({ ...APPLY_OPTS, reviewer: '' })).toThrow(/reviewer/); });
  it('requires a YYYY-MM-DD date', () => { expect(() => validateApplyOptions({ ...APPLY_OPTS, date: 'x' })).toThrow(/date/); });
});

describe('promote-iris-rfd-batch: planPromotion happy path + preconditions', () => {
  const firstId = PROMOTION_ROWS[0].id;
  it('plans all values to promote + skips the already-verified source', () => {
    const { records, sources } = makeFixture();
    const plan = planPromotion(records, sources, APPLY_OPTS);
    expect(plan.valueResults).toHaveLength(IRIS_RFD_BATCH_PROMOTION_VALUE_IDS.length);
    expect(plan.valueResults.every((vr) => vr.promoteValue)).toBe(true);
    expect(plan.promoteSource).toBe(false);
  });
  it('throws when a value record is missing', () => {
    const { records, sources } = makeFixture();
    expect(() => planPromotion(records.filter((r) => r.parameter_value_id !== firstId), sources, APPLY_OPTS)).toThrow(/not found/);
  });
  it('throws on identity mismatch (wrong value)', () => {
    const { records, sources } = makeFixture({ [firstId]: { value: 99999 } });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/expected frame-eligible identity/);
  });
  it('throws when source_ids has a second linked source', () => {
    const { records, sources } = makeFixture({ [firstId]: { source_ids: [SOURCE_ID, 'src-extra'] } });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/source_ids must be EXACTLY/);
  });
  it('throws on a stale nested evidence source', () => {
    const base = BASE_VALUE_FIXTURES[0];
    const staleEv = { ...base.evidence_items[0], source_id: 'src-FOREIGN' };
    const { records, sources } = makeFixture({ [firstId]: { evidence_items: [staleEv] } });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/nested provenance source/);
  });
  it('throws on a drifted pre-state (evidence_support_status pending)', () => {
    const { records, sources } = makeFixture({ [firstId]: { evidence_support_status: 'pending_source_locator' } });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/expected pre-promotion state/);
  });
  it('throws when the source is repo_metadata_only', () => {
    const { records, sources } = makeFixture({}, { file_storage: 'repo_metadata_only' });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/direct-current eligible/);
  });
});

describe('promote-iris-rfd-batch: apply + idempotency', () => {
  it('flips qa + canonical + evidence on every row (esS unchanged); source stays verified', () => {
    const { records, sources } = makeFixture();
    applyPromotion(records, sources, APPLY_OPTS);
    for (const id of IRIS_RFD_BATCH_PROMOTION_VALUE_IDS) {
      const r = records.find((x) => x.parameter_value_id === id);
      expect(r.qa_status, id).toBe('approved');
      expect(r.evidence_support_status, id).toBe('approved_source_backed');
      expect(r.canonical_source_status, id).toBe('direct_source_verified');
      expect(r.default_status, id).toBe('available_option');
      expect(r.evidence_items[0].reviewed_by, id).toBe('J. Nelson');
      // A promoted evidence item must not keep a "pending direct-source verification" note (codex P2).
      expect(r.evidence_items[0].note, id).toContain('Evidence PROMOTED to approved');
    }
    expect(sources.find((s) => s.source_id === SOURCE_ID).canonical_source_status).toBe('direct_source_verified');
  });
  it('second apply is a no-op (idempotent)', () => {
    const { records, sources } = makeFixture();
    applyPromotion(records, sources, APPLY_OPTS);
    const second = applyPromotion(records, sources, APPLY_OPTS);
    expect(second.valueResults.every((vr) => !vr.promoteValue)).toBe(true);
  });
  it('skips all when already done', () => {
    const ov = {}; for (const b of BASE_VALUE_FIXTURES) ov[b.parameter_value_id] = doneValue(b);
    const { records, sources } = makeFixture(ov);
    const plan = planPromotion(records, sources, APPLY_OPTS);
    expect(plan.valueResults.every((vr) => vr.valueAlreadyDone)).toBe(true);
  });
  it('never mutates a non-target record', () => {
    const { records, sources } = makeFixture();
    const before = clone(records.find((r) => r.parameter_value_id === 'pv-other-untouched'));
    applyPromotion(records, sources, APPLY_OPTS);
    expect(records.find((r) => r.parameter_value_id === 'pv-other-untouched')).toEqual(before);
  });
});
