// Guards for promote-iris-dupe-cg-canonical.mjs (owner-run promotion of 14 EPA-verified canonical
// dupe-cg IRIS rows). Synthetic fixtures, independent of catalog state. Plain ASCII.

import { describe, it, expect } from 'vitest';
import {
  PROMOTION_ROWS,
  IRIS_DUPE_CG_CANONICAL_VALUE_IDS,
  parseArgs,
  validateApplyOptions,
  planPromotion,
  applyPromotion,
} from '../promote-iris-dupe-cg-canonical.mjs';

const JURISDICTION = 'US_federal';
const APPLY_OPTS = { reviewer: 'J. Nelson', date: '2026-06-22', apply: true };
const clone = (x) => JSON.parse(JSON.stringify(x));

function makeValueRecord(row) {
  return {
    parameter_value_id: row.id,
    jurisdiction: JURISDICTION,
    candidate_group_id: row.pathway + '__' + row.substanceKey + '__' + row.inputKey + '__' + JURISDICTION,
    pathway: row.pathway,
    input_key: row.inputKey,
    substance_key: row.substanceKey,
    value: row.value,
    unit: row.unit,
    value_type: 'single_value',
    default_status: 'available_option',
    qa_status: 'needs_review',
    evidence_support_status: 'approved_source_backed',
    canonical_source_status: 'needs_direct_source_check',
    source_ids: [row.sourceId],
    applicability: 'US EPA IRIS value; needs review before default use.',
    review_notes: 'robot-extracted; pending direct-source verification.',
    evidence_items: [
      { source_id: row.sourceId, qa_status: 'needs_review', note: 'pending direct-source verification.', evidence_id: 'ev-' + row.id },
    ],
  };
}
function makeSources() {
  return [
    { source_id: 'src-us-epa-iris-rfd-table-live', canonical_source_status: 'direct_source_verified', calculator_source_role: 'canonical_candidate', file_storage: 'zotero_or_external', currentness_status: 'current', notes: 'x' },
    { source_id: 'src-us-epa-iris-chemical-details-live', canonical_source_status: 'direct_source_verified', calculator_source_role: 'canonical_candidate', file_storage: 'zotero_or_external', currentness_status: 'current', notes: 'x' },
  ];
}
function makeFixture() {
  const records = PROMOTION_ROWS.map(makeValueRecord);
  // Add a non-canonical sibling in one group (the row we are NOT promoting) -- must stay needs_review.
  records.push({ ...makeValueRecord(PROMOTION_ROWS[0]), parameter_value_id: 'pv-iris-sibling-not-promoted', value: 999 });
  return { records, sources: makeSources() };
}

describe('promote-iris-dupe-cg-canonical: scope', () => {
  it('targets exactly 14 EPA-verified canonical ids', () => {
    expect(IRIS_DUPE_CG_CANONICAL_VALUE_IDS).toHaveLength(14);
    expect(new Set(IRIS_DUPE_CG_CANONICAL_VALUE_IDS).size).toBe(14);
    for (const id of IRIS_DUPE_CG_CANONICAL_VALUE_IDS) expect(id.startsWith('pv-iris-')).toBe(true);
  });
  it('every data row carries an EPA IRIS url + a verified value', () => {
    for (const r of PROMOTION_ROWS) {
      expect(r.irisUrl).toMatch(/epa\.gov/);
      expect(typeof r.value).toBe('number');
      expect(['src-us-epa-iris-rfd-table-live', 'src-us-epa-iris-chemical-details-live']).toContain(r.sourceId);
    }
  });
});

describe('promote-iris-dupe-cg-canonical: parseArgs + validateApplyOptions', () => {
  it('parses flags', () => {
    expect(parseArgs(['n', 's', '--reviewer', 'J. Nelson', '--date', '2026-06-22', '--apply'])).toMatchObject({ reviewer: 'J. Nelson', date: '2026-06-22', apply: true });
  });
  it('requires reviewer + YYYY-MM-DD date for --apply', () => {
    expect(() => validateApplyOptions({ reviewer: '', date: '2026-06-22' })).toThrow(/reviewer/);
    expect(() => validateApplyOptions({ reviewer: 'x', date: '2026/06/22' })).toThrow(/date/);
    expect(() => validateApplyOptions({ reviewer: 'x', date: '2026-06-22' })).not.toThrow();
  });
});

describe('promote-iris-dupe-cg-canonical: planPromotion (fail-closed)', () => {
  it('plans all 14 clean rows', () => {
    const { records, sources } = makeFixture();
    const plan = planPromotion(records, sources, APPLY_OPTS);
    expect(plan.valueResults.filter((vr) => vr.promoteValue)).toHaveLength(14);
    expect(plan.sourceResults).toHaveLength(2); // both sources read-only (verified pre-req)
  });
  it('fails closed if a source is not already direct_source_verified (value-only lane)', () => {
    const { records, sources } = makeFixture();
    sources[0].canonical_source_status = 'needs_direct_source_check';
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/must already be direct_source_verified/);
  });
  it('applyPromotion never mutates sources.json', () => {
    const { records, sources } = makeFixture();
    const before = clone(sources);
    applyPromotion(records, sources, APPLY_OPTS);
    expect(sources).toEqual(before);
  });
  it('throws on a value drifted from the EPA-verified canonical value', () => {
    const { records, sources } = makeFixture();
    records.find((r) => r.parameter_value_id === PROMOTION_ROWS[0].id).value = 7; // verified is 2
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/identity mismatch/);
  });
  it('throws on a wrong source_id', () => {
    const { records, sources } = makeFixture();
    records.find((r) => r.parameter_value_id === PROMOTION_ROWS[0].id).source_ids = ['src-bogus'];
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/source_ids must be EXACTLY/);
  });
  it('fails closed when another approved member already exists in a group', () => {
    const { records, sources } = makeFixture();
    // Make the non-canonical sibling (same group as row 0) already approved.
    records.find((r) => r.parameter_value_id === 'pv-iris-sibling-not-promoted').qa_status = 'approved';
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/already has a different approved member/);
  });
});

describe('promote-iris-dupe-cg-canonical: applyPromotion', () => {
  it('flips qa + canonical + stamps evidence note + value provenance', () => {
    const { records, sources } = makeFixture();
    applyPromotion(records, sources, APPLY_OPTS);
    for (const id of IRIS_DUPE_CG_CANONICAL_VALUE_IDS) {
      const r = records.find((x) => x.parameter_value_id === id);
      expect(r.qa_status).toBe('approved');
      expect(r.canonical_source_status).toBe('direct_source_verified');
      expect(r.default_status).toBe('available_option'); // never a default
      expect(r.evidence_items[0].qa_status).toBe('approved');
      expect(r.evidence_items[0].note).toContain('Evidence PROMOTED to approved');
      expect(r.review_notes).toContain('PROMOTED to approved');
    }
    // The non-canonical sibling is untouched.
    expect(records.find((x) => x.parameter_value_id === 'pv-iris-sibling-not-promoted').qa_status).toBe('needs_review');
  });
  it('is idempotent (second apply changes nothing; single stamp)', () => {
    const { records, sources } = makeFixture();
    applyPromotion(records, sources, APPLY_OPTS);
    const before = clone(records);
    applyPromotion(records, sources, APPLY_OPTS);
    expect(records).toEqual(before);
    const r0 = records.find((x) => x.parameter_value_id === IRIS_DUPE_CG_CANONICAL_VALUE_IDS[0]);
    expect(r0.review_notes.match(/PROMOTED to approved/g)).toHaveLength(1);
  });
});
