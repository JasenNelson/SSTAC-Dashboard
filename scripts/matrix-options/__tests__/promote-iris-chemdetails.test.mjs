// Guards for the owner-run US EPA IRIS chemical-details promotion tool (promote-iris-chemdetails.mjs).
// Plain ASCII only. Builds complete fixtures from the tool's exported PROMOTION_ROWS. Mirrors
// promote-iris-rfd-batch.test.mjs (here the SOURCE pre-state is needs_direct_source_check -> promotes).

import { describe, it, expect } from 'vitest';
import {
  IRIS_CHEMDETAILS_PROMOTION_VALUE_IDS,
  IRIS_CHEMDETAILS_PROMOTION_SOURCE_ID,
  PROMOTION_ROWS,
  parseArgs,
  validateApplyOptions,
  planPromotion,
  applyPromotion,
} from '../promote-iris-chemdetails.mjs';

const SOURCE_ID = IRIS_CHEMDETAILS_PROMOTION_SOURCE_ID;
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
    applicability: 'US EPA IRIS chem-details for ' + substanceKey + '; needs_review candidate.',
    uncertainty: null,
    review_notes: 'US EPA IRIS chem-details candidate, robot-extracted. qa_status=needs_review.',
    evidence_items: [{
      source_id: SOURCE_ID,
      locator: 'US EPA IRIS chemical details, ' + substanceKey,
      value_text: String(value),
      extraction_method: 'manual_source_extraction',
      extracted_by: 'claude-opus-4-8',
      extracted_at: '2026-05-23',
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
    short_citation: 'US EPA IRIS chemical details, live',
    url: 'https://iris.epa.gov/AdvancedSearch/alt/chemical_details',
    zotero_item_key: null,
    zotero_status: 'pending_owner_export',
    notes: 'Live IRIS chemical-details toxicity-value table.',
    currentness_status: 'current',
    file_storage: 'zotero_or_external',
    calculator_source_role: 'canonical_candidate',
    canonical_source_status: 'needs_direct_source_check',
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
    input_key: 'rfc_inhalation_mg_per_m3',
    value: 99,
    unit: 'mg/m3',
    value_type: 'single_value',
    default_status: 'available_option',
    evidence_support_status: 'approved_source_backed',
    qa_status: 'needs_review',
    canonical_source_status: 'needs_direct_source_check',
    candidate_group_id: 'human-health-direct__generic__rfc_inhalation_mg_per_m3__' + JURISDICTION,
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

describe('promote-iris-chemdetails: scope constants', () => {
  it('exports EXACTLY the 275 clean ids (290 needs_review minus 15 dupe-candidate_group_id)', () => {
    // Pinned scope: 290 needs_review src-us-epa-iris-chemical-details-live rows MINUS the 15
    // dupe-candidate_group_id RfC rows (trimethylbenzenes/TCA), excluded + deferred. Exact count keeps
    // the attestation scope honest.
    expect(IRIS_CHEMDETAILS_PROMOTION_VALUE_IDS).toHaveLength(275);
  });
  it('every id is a pv-iris-* id', () => { for (const id of IRIS_CHEMDETAILS_PROMOTION_VALUE_IDS) expect(id.startsWith('pv-iris-'), id).toBe(true); });
  it('has no duplicate ids', () => { expect(new Set(IRIS_CHEMDETAILS_PROMOTION_VALUE_IDS).size).toBe(IRIS_CHEMDETAILS_PROMOTION_VALUE_IDS.length); });
  it('has no duplicate candidate_group_id (the 15 dupe-cg rows are excluded)', () => {
    const cg = PROMOTION_ROWS.map((r) => r.pathway + '__' + r.substanceKey + '__' + r.inputKey + '__' + JURISDICTION);
    expect(new Set(cg).size).toBe(cg.length);
  });
  it('targets the live IRIS chemical-details source', () => { expect(IRIS_CHEMDETAILS_PROMOTION_SOURCE_ID).toBe('src-us-epa-iris-chemical-details-live'); });
});

describe('promote-iris-chemdetails: parseArgs + validateApplyOptions', () => {
  it('parses flags', () => { expect(parseArgs(['n', 's', '--reviewer', 'J. Nelson', '--date', '2026-06-21', '--apply'])).toMatchObject({ reviewer: 'J. Nelson', date: '2026-06-21', apply: true }); });
  it('defaults to dry run', () => { expect(parseArgs(['n', 's']).apply).toBe(false); });
  it('throws on unknown arg', () => { expect(() => parseArgs(['n', 's', '--bogus'])).toThrow(/Unknown argument/); });
  it('requires reviewer + date', () => { expect(() => validateApplyOptions({ ...APPLY_OPTS, reviewer: '' })).toThrow(/reviewer/); expect(() => validateApplyOptions({ ...APPLY_OPTS, date: 'x' })).toThrow(/date/); });
});

describe('promote-iris-chemdetails: planPromotion happy path + preconditions', () => {
  const firstId = PROMOTION_ROWS[0].id;
  it('plans all values to promote AND promotes the not-yet-verified source', () => {
    const { records, sources } = makeFixture();
    const plan = planPromotion(records, sources, APPLY_OPTS);
    expect(plan.valueResults).toHaveLength(IRIS_CHEMDETAILS_PROMOTION_VALUE_IDS.length);
    expect(plan.valueResults.every((vr) => vr.promoteValue)).toBe(true);
    expect(plan.promoteSource).toBe(true); // source pre-state is needs_direct_source_check
  });
  it('skips an already-verified source', () => {
    const { records, sources } = makeFixture({}, { canonical_source_status: 'direct_source_verified' });
    expect(planPromotion(records, sources, APPLY_OPTS).promoteSource).toBe(false);
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
});

describe('promote-iris-chemdetails: apply + idempotency', () => {
  it('flips values + promotes the source on apply', () => {
    const { records, sources } = makeFixture();
    applyPromotion(records, sources, APPLY_OPTS);
    for (const id of IRIS_CHEMDETAILS_PROMOTION_VALUE_IDS) {
      const r = records.find((x) => x.parameter_value_id === id);
      expect(r.qa_status, id).toBe('approved');
      expect(r.evidence_support_status, id).toBe('approved_source_backed');
      expect(r.canonical_source_status, id).toBe('direct_source_verified');
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
    expect(second.promoteSource).toBe(false);
  });
  it('skips all when already done', () => {
    const ov = {}; for (const b of BASE_VALUE_FIXTURES) ov[b.parameter_value_id] = doneValue(b);
    const { records, sources } = makeFixture(ov, { canonical_source_status: 'direct_source_verified' });
    const plan = planPromotion(records, sources, APPLY_OPTS);
    expect(plan.valueResults.every((vr) => vr.valueAlreadyDone)).toBe(true);
    expect(plan.promoteSource).toBe(false);
  });
  it('never mutates a non-target record', () => {
    const { records, sources } = makeFixture();
    const before = clone(records.find((r) => r.parameter_value_id === 'pv-other-untouched'));
    applyPromotion(records, sources, APPLY_OPTS);
    expect(records.find((r) => r.parameter_value_id === 'pv-other-untouched')).toEqual(before);
  });
});
