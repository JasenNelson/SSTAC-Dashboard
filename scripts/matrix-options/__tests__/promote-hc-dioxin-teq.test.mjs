// Guards for the owner-run Health Canada TRV v4.0 (2025) promotion tool (promote-hc-dioxin-teq.mjs).
// Plain ASCII only. Mirrors promote-hc-trv-v4-2025.test.mjs, re-scoped to the 1 pv-hc-* HC TRV
// v4.0 record (src-health-canada-trv-v4-2025).

import { describe, it, expect } from 'vitest';
import {
  HC_DIOXIN_TEQ_PROMOTION_VALUE_IDS,
  HC_DIOXIN_TEQ_PROMOTION_SOURCE_ID,
  PROMOTION_ROWS,
  parseArgs,
  validateApplyOptions,
  planPromotion,
  applyPromotion,
} from '../promote-hc-dioxin-teq.mjs';

const SOURCE_ID = HC_DIOXIN_TEQ_PROMOTION_SOURCE_ID;
const JURISDICTION = 'Canada_federal';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

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
    applicability: 'Health Canada TRV v4.0 for ' + substanceKey + '; needs_review candidate.',
    uncertainty: null,
    review_notes: 'HC TRV v4.0 candidate, source-extracted. qa_status=needs_review.',
    evidence_items: [{
      source_id: SOURCE_ID,
      locator: 'Health Canada TRVs v4.0 (2025), Table 1, ' + substanceKey,
      value_text: String(value),
      extraction_method: 'manual_source_extraction',
      extracted_by: 'claude-opus-4-8',
      extracted_at: '2026-05-29',
      qa_status: 'needs_review',
      evidence_id: 'ev-' + id + '-1',
      locator_type: 'source_table',
      note: 'Robot-extracted; pending direct-source verification.',
    }],
    source_relationships: [{
      source_id: SOURCE_ID,
      role: 'canonical_candidate',
      note: 'HC TRV v4.0 is the source for this extracted TRV row.',
    }],
  };
}

const BASE_VALUE_FIXTURES = PROMOTION_ROWS.map(baseRecord);

function makeSourceRecord(overrides = {}) {
  return {
    source_id: SOURCE_ID,
    short_citation: 'Health Canada TRVs v4.0 (2025)',
    url: 'https://www.canada.ca/en/health-canada/services/environmental-workplace-health/reports-publications/contaminated-sites/federal-contaminated-site-risk-assessment-canada-part-health-canada-toxicological-reference-values-trvs-chemical-specific-factors.html',
    zotero_item_key: 'SSESKHQW',
    zotero_status: 'linked',
    notes: 'Federal contaminated site risk assessment TRVs version 4.0 (2025).',
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
  const sources = [
    makeSourceRecord(sourceOverrides),
    { source_id: 'src-other-untouched', currentness_status: 'current' },
  ];
  return { records, sources };
}

const clone = (x) => JSON.parse(JSON.stringify(x));
const APPLY_OPTS = { reviewer: 'J. Nelson', date: '2026-06-21', sourceUrl: null, zoteroKey: null };

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
      reviewed_at: '2026-06-21',
    })),
  };
}

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

describe('promote-hc-dioxin-teq: scope constants', () => {
  it('exports exactly 1 value IDs', () => {
    expect(HC_DIOXIN_TEQ_PROMOTION_VALUE_IDS).toHaveLength(1);
  });
  it('targets the Health Canada TRV v4.0 2025 source', () => {
    expect(HC_DIOXIN_TEQ_PROMOTION_SOURCE_ID).toBe('src-health-canada-trv-v4-2025');
  });
});

describe('promote-hc-dioxin-teq: parseArgs', () => {
  it('parses flags and values', () => {
    const a = parseArgs(['node', 's', '--reviewer', 'J. Nelson', '--date', '2026-06-21', '--apply']);
    expect(a).toMatchObject({ reviewer: 'J. Nelson', date: '2026-06-21', apply: true });
  });
  it('defaults to a dry run', () => {
    expect(parseArgs(['node', 's']).apply).toBe(false);
  });
  it('throws on unknown argument', () => {
    expect(() => parseArgs(['node', 's', '--bogus'])).toThrow(/Unknown argument/);
  });
});

describe('promote-hc-dioxin-teq: validateApplyOptions', () => {
  it('accepts a complete attestation', () => {
    expect(() => validateApplyOptions(APPLY_OPTS)).not.toThrow();
  });
  it('requires reviewer', () => {
    expect(() => validateApplyOptions({ ...APPLY_OPTS, reviewer: '' })).toThrow(/reviewer/);
  });
  it('requires a YYYY-MM-DD date', () => {
    expect(() => validateApplyOptions({ ...APPLY_OPTS, date: '2026/06/21' })).toThrow(/date/);
  });
});

describe('promote-hc-dioxin-teq: planPromotion -- happy path', () => {
  it('plans all 1 values to promote + skips the already-verified source', () => {
    const { records, sources } = makeFixture();
    const plan = planPromotion(records, sources, APPLY_OPTS);
    expect(plan.valueResults).toHaveLength(1);
    expect(plan.valueResults.every((vr) => vr.promoteValue)).toBe(true);
    expect(plan.promoteSource).toBe(false);
    expect(plan.sourceAlreadyDone).toBe(true);
  });
  it('treats needs_direct_source_check on source as promotable', () => {
    const { records, sources } = makeFixture({}, { canonical_source_status: 'needs_direct_source_check' });
    const plan = planPromotion(records, sources, APPLY_OPTS);
    expect(plan.promoteSource).toBe(true);
  });
});

describe('promote-hc-dioxin-teq: planPromotion -- fail-closed preconditions', () => {
  const firstId = PROMOTION_ROWS[0].id;
  it('throws when a value record is missing', () => {
    const { records, sources } = makeFixture();
    const filtered = records.filter((r) => r.parameter_value_id !== firstId);
    expect(() => planPromotion(filtered, sources, APPLY_OPTS)).toThrow(/not found/);
  });
  it('throws when a value has no evidence_items', () => {
    const { records, sources } = makeFixture({ [firstId]: { evidence_items: [] } });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/no evidence_items/);
  });
  it('throws on identity mismatch (wrong value)', () => {
    const { records, sources } = makeFixture({ [firstId]: { value: 99999 } });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/expected frame-eligible identity/);
  });
  it('throws when source_ids does not match the HC TRV source', () => {
    const { records, sources } = makeFixture({ [firstId]: { source_ids: ['src-bc-protocol-28-2021-jan'] } });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/source_ids must be EXACTLY/);
  });
  it('throws on a drifted pre-state (qa_status superseded)', () => {
    const { records, sources } = makeFixture({ [firstId]: { qa_status: 'superseded' } });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/expected pre-promotion state/);
  });
});

describe('promote-hc-dioxin-teq: idempotency', () => {
  it('skips all value records when everything is already done', () => {
    const { records, sources } = makeFixture(allDoneOverrides());
    const plan = planPromotion(records, sources, APPLY_OPTS);
    expect(plan.valueResults.every((vr) => !vr.promoteValue && vr.valueAlreadyDone)).toBe(true);
    expect(plan.promoteSource).toBe(false);
  });
  it('applyPromotion run twice is a no-op on the second run', () => {
    const { records, sources } = makeFixture();
    applyPromotion(records, sources, APPLY_OPTS);
    const second = applyPromotion(records, sources, APPLY_OPTS);
    expect(second.valueResults.every((vr) => !vr.promoteValue)).toBe(true);
    expect(second.promoteSource).toBe(false);
  });
});

describe('promote-hc-dioxin-teq: field edits', () => {
  it('flips qa + canonical + evidence + adds attestation (esS unchanged)', () => {
    const { records, sources } = makeFixture();
    applyPromotion(records, sources, APPLY_OPTS);
    for (const valueId of HC_DIOXIN_TEQ_PROMOTION_VALUE_IDS) {
      const r = records.find((x) => x.parameter_value_id === valueId);
      expect(r.qa_status, valueId).toBe('approved');
      expect(r.evidence_support_status, valueId).toBe('approved_source_backed'); // unchanged
      expect(r.canonical_source_status, valueId).toBe('direct_source_verified');
      expect(r.default_status, valueId).toBe('available_option');
      const ev = r.evidence_items[0];
      expect(ev.qa_status, valueId).toBe('approved');
      expect(ev.reviewed_by, valueId).toBe('J. Nelson');
      expect(ev.reviewed_at, valueId).toBe('2026-06-21');
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
});
