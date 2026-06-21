// Guards for the owner-run Health Canada TRV v4.0 (2025) promotion tool (promote-hc-trv-v4-2025.mjs).
// Plain ASCII only. Mirrors promote-iris-carcinogen-rfd.test.mjs, re-scoped to the 92 pv-hc-* HC TRV
// v4.0 records (src-health-canada-trv-v4-2025), and builds complete fixtures from the tool's exported
// PROMOTION_ROWS table so planPromotion (which iterates all 92 ids) has every record present.
//
// PRE-STATE NOTE: these HC TRV rows are evidence_support_status='approved_source_backed' in the
// pre-promotion state (unchanged by promotion); only qa_status + canonical_source_status move.

import { describe, it, expect } from 'vitest';
import {
  HC_TRV_V4_2025_PROMOTION_VALUE_IDS,
  HC_TRV_V4_2025_PROMOTION_SOURCE_ID,
  PROMOTION_ROWS,
  parseArgs,
  validateApplyOptions,
  planPromotion,
  applyPromotion,
} from '../promote-hc-trv-v4-2025.mjs';

const SOURCE_ID = HC_TRV_V4_2025_PROMOTION_SOURCE_ID;
const JURISDICTION = 'Canada_federal';

// ---------------------------------------------------------------------------
// Fixtures (built from the tool's own PROMOTION_ROWS, so all 92 records exist)
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
    // HC TRV rows are ALREADY approved_source_backed pre-promotion (only qa + canonical move).
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

describe('promote-hc-trv-v4-2025: scope constants', () => {
  it('exports exactly 92 value IDs', () => {
    expect(HC_TRV_V4_2025_PROMOTION_VALUE_IDS).toHaveLength(92);
  });
  it('every id is a pv-hc-* id (never a pv-iris-/pv-p28-/pv-us-epa- id)', () => {
    for (const id of HC_TRV_V4_2025_PROMOTION_VALUE_IDS) {
      expect(id.startsWith('pv-hc-'), id).toBe(true);
      expect(id.startsWith('pv-iris-') || id.startsWith('pv-p28-') || id.startsWith('pv-us-epa-')).toBe(false);
    }
  });
  it('has no duplicate ids', () => {
    expect(new Set(HC_TRV_V4_2025_PROMOTION_VALUE_IDS).size).toBe(HC_TRV_V4_2025_PROMOTION_VALUE_IDS.length);
  });
  it('targets the Health Canada TRV v4.0 2025 source', () => {
    expect(HC_TRV_V4_2025_PROMOTION_SOURCE_ID).toBe('src-health-canada-trv-v4-2025');
  });
  it('only uses the four expected TRV input keys', () => {
    const allowed = new Set([
      'rfd_oral_mg_per_kg_bw_day',
      'sf_oral_per_mg_per_kg_bw_per_day',
      'rfc_inhalation_mg_per_m3',
      'unit_risk_inhalation_per_ug_m3',
    ]);
    for (const row of PROMOTION_ROWS) {
      expect(allowed.has(row.inputKey), row.id).toBe(true);
    }
  });
});

describe('promote-hc-trv-v4-2025: parseArgs', () => {
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

describe('promote-hc-trv-v4-2025: validateApplyOptions', () => {
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

describe('promote-hc-trv-v4-2025: planPromotion -- happy path', () => {
  it('plans all 92 values to promote + skips the already-verified source', () => {
    const { records, sources } = makeFixture();
    const plan = planPromotion(records, sources, APPLY_OPTS);
    expect(plan.valueResults).toHaveLength(92);
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

describe('promote-hc-trv-v4-2025: planPromotion -- fail-closed preconditions', () => {
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
  it('throws on identity mismatch (wrong jurisdiction)', () => {
    const { records, sources } = makeFixture({ [firstId]: { jurisdiction: 'US_federal' } });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/expected frame-eligible identity/);
  });
  it('throws on identity mismatch (wrong unit)', () => {
    const { records, sources } = makeFixture({ [firstId]: { unit: 'bogus-unit' } });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/expected frame-eligible identity/);
  });
  it('throws when source_ids does not match the HC TRV source', () => {
    const { records, sources } = makeFixture({ [firstId]: { source_ids: ['src-bc-protocol-28-2021-jan'] } });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/source_ids must be EXACTLY/);
  });
  it('throws when source_ids has a second linked source (under-block risk)', () => {
    const { records, sources } = makeFixture({ [firstId]: { source_ids: [SOURCE_ID, 'src-extra'] } });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/source_ids must be EXACTLY/);
  });
  it('throws on a drifted pre-state (qa_status superseded)', () => {
    const { records, sources } = makeFixture({ [firstId]: { qa_status: 'superseded' } });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/expected pre-promotion state/);
  });
  it('throws on a drifted pre-state (evidence_support_status pending, not approved_source_backed)', () => {
    const { records, sources } = makeFixture({ [firstId]: { evidence_support_status: 'pending_source_locator' } });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/expected pre-promotion state/);
  });
  it('throws on a drifted source canonical_source_status', () => {
    const { records, sources } = makeFixture({}, { canonical_source_status: 'not_applicable' });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/neither needs_direct_source_check/);
  });
  it('throws when the source role is policy_compilation (via source_relationships)', () => {
    const { records, sources } = makeFixture({
      [firstId]: { source_relationships: [{ source_id: SOURCE_ID, role: 'policy_compilation' }] },
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
    const filteredSrc = sources.filter((s) => s.source_id !== SOURCE_ID);
    expect(() => planPromotion(records, filteredSrc, APPLY_OPTS)).toThrow(/not found in sources.json/);
  });
  it('throws when evidence_items[0].source_id is a stale foreign reference (nested-source guard)', () => {
    const base = BASE_VALUE_FIXTURES[0];
    const staleEv = { ...base.evidence_items[0], source_id: 'src-FOREIGN-stale' };
    const { records, sources } = makeFixture({ [firstId]: { evidence_items: [staleEv] } });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/nested provenance source/);
  });
});

describe('promote-hc-trv-v4-2025: idempotency', () => {
  it('skips all value records when everything is already done', () => {
    const { records, sources } = makeFixture(allDoneOverrides());
    const plan = planPromotion(records, sources, APPLY_OPTS);
    expect(plan.valueResults.every((vr) => !vr.promoteValue && vr.valueAlreadyDone)).toBe(true);
    expect(plan.promoteSource).toBe(false);
  });
  it('rejects an approved record whose evidence is missing the owner attestation', () => {
    const base = BASE_VALUE_FIXTURES[0];
    const done = doneValue(base);
    const unattested = {
      ...done,
      evidence_items: done.evidence_items.map((ev) => {
        const copy = { ...ev };
        delete copy.reviewed_by;
        delete copy.reviewed_at;
        return copy;
      }),
    };
    const { records, sources } = makeFixture({ [base.parameter_value_id]: unattested });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/drifted\/partially-promoted/);
  });
  it('throws on a partially-promoted record (top-level done, evidence still needs_review)', () => {
    const { records, sources } = makeFixture({
      [PROMOTION_ROWS[0].id]: {
        qa_status: 'approved',
        evidence_support_status: 'approved_source_backed',
        canonical_source_status: 'direct_source_verified',
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
});

describe('promote-hc-trv-v4-2025: field edits across the 92 records', () => {
  it('flips qa + canonical + evidence + adds attestation on all 92 (esS unchanged)', () => {
    const { records, sources } = makeFixture();
    applyPromotion(records, sources, APPLY_OPTS);
    for (const valueId of HC_TRV_V4_2025_PROMOTION_VALUE_IDS) {
      const r = records.find((x) => x.parameter_value_id === valueId);
      expect(r.qa_status, valueId).toBe('approved');
      expect(r.evidence_support_status, valueId).toBe('approved_source_backed'); // unchanged
      expect(r.canonical_source_status, valueId).toBe('direct_source_verified');
      expect(r.default_status, valueId).toBe('available_option');
      const ev = r.evidence_items[0];
      expect(ev.qa_status, valueId).toBe('approved');
      expect(ev.reviewed_by, valueId).toBe('J. Nelson');
      expect(ev.reviewed_at, valueId).toBe('2026-06-21');
      const keys = Object.keys(ev);
      const qi = keys.indexOf('qa_status');
      expect(keys[qi + 1]).toBe('reviewed_by');
      expect(keys[qi + 2]).toBe('reviewed_at');
    }
  });
  it('does not promote the already-verified source', () => {
    const { records, sources } = makeFixture();
    const applied = applyPromotion(records, sources, APPLY_OPTS);
    expect(applied.promoteSource).toBe(false);
    const s = sources.find((x) => x.source_id === SOURCE_ID);
    expect(s.canonical_source_status).toBe('direct_source_verified');
  });
  it('stamps the string provenance fields but skips null uncertainty', () => {
    const { records, sources } = makeFixture();
    applyPromotion(records, sources, APPLY_OPTS);
    for (const valueId of HC_TRV_V4_2025_PROMOTION_VALUE_IDS) {
      const r = records.find((x) => x.parameter_value_id === valueId);
      expect(r.applicability, valueId).toContain('PROMOTED to approved');
      expect(r.review_notes, valueId).toContain('PROMOTED to approved');
      expect(r.uncertainty, valueId).toBeNull(); // null is skipped, never stamped
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
    const stamped = ' [PROMOTED to approved on 2026-06-21 by J. Nelson]';
    const doneOverrides = {};
    for (const base of BASE_VALUE_FIXTURES) {
      doneOverrides[base.parameter_value_id] = {
        ...doneValue(base),
        applicability: base.applicability + stamped,
        review_notes: base.review_notes + stamped,
      };
    }
    const { records, sources } = makeFixture(doneOverrides);
    const applied = applyPromotion(records, sources, APPLY_OPTS);
    expect(applied.valueTouchedFlags.every((t) => t === false)).toBe(true);
    for (const valueId of HC_TRV_V4_2025_PROMOTION_VALUE_IDS) {
      const r = records.find((x) => x.parameter_value_id === valueId);
      expect(r.applicability.match(/PROMOTED to approved/g)).toHaveLength(1);
    }
  });
});
