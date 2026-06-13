// Guards for the owner-run US EPA fish-ingestion-rate promotion tool (promote-epa-ir-food.mjs).
// Plain ASCII only.
//
// Verifies the tool's load-bearing guarantees on synthetic fixtures (independent of catalog state):
//  - arg parsing + apply-option validation,
//  - fail-closed preconditions (missing id, no evidence, identity drift, wrong source link,
//    unexpected pre-state, drifted source),
//  - idempotency (already-promoted targets are skipped),
//  - exact field edits + reviewed_* key placement,
//  - SCOPE: non-target records are never mutated.

import { describe, it, expect } from 'vitest';
import {
  EPA_PROMOTION_VALUE_ID,
  EPA_PROMOTION_SOURCE_ID,
  parseArgs,
  validateApplyOptions,
  planPromotion,
  applyPromotion,
} from '../promote-epa-ir-food.mjs';

// A value record in the exact documented pre-promotion state + frame-eligible identity.
function makeValueRecord(overrides = {}) {
  return {
    parameter_value_id: EPA_PROMOTION_VALUE_ID,
    substance_key: 'generic',
    pathway: 'human-health-food',
    input_key: 'IR_food_kg_per_day',
    value: 0.0175,
    unit: 'kg/day',
    value_type: 'single_value',
    default_status: 'available_option',
    evidence_support_status: 'pending_source_locator',
    qa_status: 'needs_review',
    canonical_source_status: 'needs_direct_source_check',
    candidate_group_id: 'human-health-food__generic__IR_food_kg_per_day__US_federal',
    jurisdiction: 'US_federal',
    source_ids: [EPA_PROMOTION_SOURCE_ID],
    uncertainty: 'Secondary citation pending direct-source verification.',
    review_notes: 'US EPA 2000 AWQC default adult fish consumption rate (general population).',
    evidence_items: [
      {
        source_id: EPA_PROMOTION_SOURCE_ID,
        locator: 'EPA 2000 AWQC Human Health Methodology',
        value_text: 'general adult population: 17.5 g/day = 0.0175 kg/day',
        extraction_method: 'manual_source_extraction',
        extracted_by: 'claude-sonnet-4-6',
        extracted_at: '2026-06-10',
        qa_status: 'needs_review',
        note: 'n',
        evidence_id: 'ev-' + EPA_PROMOTION_VALUE_ID + '-1',
        locator_type: 'source_table',
      },
    ],
    ...overrides,
  };
}

// A source record in the exact documented pre-promotion state, with a durable locator so the
// provenance guard is satisfied for the happy path.
function makeSourceRecord(overrides = {}) {
  return {
    source_id: EPA_PROMOTION_SOURCE_ID,
    short_citation: 'US EPA 2000 AWQC Human Health Methodology',
    url: 'https://www.epa.gov/sites/default/files/EPA-822-B-00-004.pdf',
    zotero_item_key: null,
    zotero_status: 'pending_owner_export',
    notes: 'US EPA 2000 AWQC Human Health Methodology; needs_review pending direct-source verification.',
    canonical_source_status: 'needs_direct_source_check',
    // direct-current-source eligibility fields (mirror classifyCandidate / isDirectCurrentSource)
    calculator_source_role: 'canonical_candidate',
    currentness_status: 'current',
    file_storage: 'zotero_or_external',
    ...overrides,
  };
}

function makeFixture(valueOverrides = {}, sourceOverrides = {}) {
  const records = [
    makeValueRecord(valueOverrides),
    {
      parameter_value_id: 'pv-other-untouched',
      substance_key: 'generic',
      pathway: 'human-health-food',
      input_key: 'IR_food_kg_per_day',
      value: 0.5,
      unit: 'kg/day',
      value_type: 'single_value',
      default_status: 'available_option',
      evidence_support_status: 'pending_source_locator',
      qa_status: 'needs_review',
      canonical_source_status: 'needs_direct_source_check',
      candidate_group_id: 'human-health-food__generic__IR_food_kg_per_day__US_federal',
      jurisdiction: 'US_federal',
      source_ids: ['src-other'],
      evidence_items: [{ source_id: 'src-other', qa_status: 'needs_review', evidence_id: 'ev-other-1' }],
    },
  ];
  const sources = [
    makeSourceRecord(sourceOverrides),
    { source_id: 'src-other-untouched', canonical_source_status: 'needs_direct_source_check' },
  ];
  return { records, sources };
}

const clone = (x) => JSON.parse(JSON.stringify(x));
const APPLY_OPTS = { reviewer: 'J. Nelson', date: '2026-06-10', sourceUrl: null, zoteroKey: null };

// Value-record overrides for the fully-promoted (already-done) state: top-level statuses promoted
// AND every evidence item approved -- the two must agree (the partial-promotion drift guard rejects
// a top-level-done record whose evidence items are still needs_review).
const DONE_VALUE = {
  qa_status: 'approved',
  evidence_support_status: 'approved_source_backed',
  canonical_source_status: 'direct_source_verified',
  evidence_items: [
    {
      source_id: EPA_PROMOTION_SOURCE_ID,
      qa_status: 'approved',
      reviewed_by: 'J. Nelson',
      reviewed_at: '2026-06-10',
      evidence_id: 'ev-' + EPA_PROMOTION_VALUE_ID + '-1',
    },
  ],
};

describe('promote-epa-ir-food: scope constants', () => {
  it('targets exactly the EPA general-population value + EPA 2000 AWQC source', () => {
    expect(EPA_PROMOTION_VALUE_ID).toBe('pv-epa-2000-ir-food-general-us');
    expect(EPA_PROMOTION_SOURCE_ID).toBe('src-epa-2000-awqc-human-health');
  });
});

describe('promote-epa-ir-food: parseArgs', () => {
  it('parses flags and values', () => {
    const a = parseArgs(['node', 's', '--reviewer', 'J. Nelson', '--date', '2026-06-10',
      '--source-url', 'https://epa.gov/x', '--zotero-key', 'ABCD1234', '--apply']);
    expect(a).toMatchObject({
      reviewer: 'J. Nelson', date: '2026-06-10', sourceUrl: 'https://epa.gov/x',
      zoteroKey: 'ABCD1234', apply: true,
    });
  });
  it('defaults to a dry run', () => {
    expect(parseArgs(['node', 's']).apply).toBe(false);
  });
  it('throws on unknown argument', () => {
    expect(() => parseArgs(['node', 's', '--bogus'])).toThrow(/Unknown argument/);
  });
});

describe('promote-epa-ir-food: validateApplyOptions', () => {
  it('accepts a complete attestation', () => {
    expect(() => validateApplyOptions(APPLY_OPTS)).not.toThrow();
  });
  it('requires reviewer', () => {
    expect(() => validateApplyOptions({ ...APPLY_OPTS, reviewer: '' })).toThrow(/reviewer/);
  });
  it('requires a YYYY-MM-DD date', () => {
    expect(() => validateApplyOptions({ ...APPLY_OPTS, date: '2026/06/10' })).toThrow(/date/);
  });
});

describe('promote-epa-ir-food: planPromotion preconditions (fail-closed)', () => {
  it('plans both records from the expected pre-state', () => {
    const { records, sources } = makeFixture();
    const plan = planPromotion(records, sources, APPLY_OPTS);
    expect(plan.promoteValue).toBe(true);
    expect(plan.promoteSource).toBe(true);
  });
  it('throws when the value record is missing', () => {
    const { records, sources } = makeFixture();
    const filtered = records.filter((r) => r.parameter_value_id !== EPA_PROMOTION_VALUE_ID);
    expect(() => planPromotion(filtered, sources, APPLY_OPTS)).toThrow(/not found/);
  });
  it('throws when the value has no evidence_items', () => {
    const { records, sources } = makeFixture({ evidence_items: [] });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/no evidence_items/);
  });
  it('throws on a frame-eligibility identity mismatch (wrong jurisdiction)', () => {
    const { records, sources } = makeFixture({ jurisdiction: 'BC' });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/expected frame-eligible identity/);
  });
  it('throws on a value drift (wrong value)', () => {
    const { records, sources } = makeFixture({ value: 0.0065 });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/expected frame-eligible identity/);
  });
  it('throws when source_ids does not link the EPA source', () => {
    const { records, sources } = makeFixture({ source_ids: ['src-wrong'] });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/source_ids must be EXACTLY/);
  });
  it('throws when source_ids has a SECOND linked source (under-block risk)', () => {
    const { records, sources } = makeFixture({ source_ids: [EPA_PROMOTION_SOURCE_ID, 'src-extra'] });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/source_ids must be EXACTLY/);
  });
  it('throws on a drifted pre-state (qa_status superseded)', () => {
    const { records, sources } = makeFixture({ qa_status: 'superseded' });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/expected pre-promotion state/);
  });
  it('throws on a drifted source canonical_source_status', () => {
    const { records, sources } = makeFixture({}, { canonical_source_status: 'not_applicable' });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/neither needs_direct_source_check/);
  });
  // Fail-closed on the SAME source-role / currentness fields classifyCandidate examines.
  it('throws when the source role is policy_compilation (would be blocked by the frame pipeline)', () => {
    const { records, sources } = makeFixture({}, { calculator_source_role: 'policy_compilation' });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/policy_compilation\/reference_mining/);
  });
  it('throws when a source_relationships role is reference_mining', () => {
    const { records, sources } = makeFixture({
      source_relationships: [{ source_id: EPA_PROMOTION_SOURCE_ID, role: 'reference_mining' }],
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
});

describe('promote-epa-ir-food: idempotency', () => {
  it('skips when both records are already in target state', () => {
    const { records, sources } = makeFixture(
      DONE_VALUE,
      { canonical_source_status: 'direct_source_verified' },
    );
    const plan = planPromotion(records, sources, APPLY_OPTS);
    expect(plan.promoteValue).toBe(false);
    expect(plan.promoteSource).toBe(false);
  });
  // Attestation guard (uniform backport 2026-06-13): an approved-but-UNATTESTED evidence item must
  // NOT be accepted as "already done" -- it is a drift that fails closed, so re-running cannot
  // silently skip a record that never carried the owner attestation.
  it('rejects an approved record whose evidence is missing the owner attestation (reviewed_by/reviewed_at)', () => {
    const unattested = {
      ...DONE_VALUE,
      evidence_items: DONE_VALUE.evidence_items.map((ev) => {
        const copy = { ...ev };
        delete copy.reviewed_by;
        delete copy.reviewed_at;
        return copy;
      }),
    };
    const { records, sources } = makeFixture(unattested, { canonical_source_status: 'direct_source_verified' });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/drifted\/partially-promoted/);
  });
  // Fail-closed: a top-level-promoted record whose evidence items are still needs_review is a
  // partially-promoted drift and must be rejected, not treated as already-done (which would skip
  // approveEvidence and leave stale evidence QA in the Evidence Library).
  it('throws on a partially-promoted record (top-level done, evidence still needs_review)', () => {
    const { records, sources } = makeFixture(
      {
        qa_status: 'approved',
        evidence_support_status: 'approved_source_backed',
        canonical_source_status: 'direct_source_verified',
        // evidence_items default to needs_review -> top-level and evidence disagree
      },
      { canonical_source_status: 'direct_source_verified' },
    );
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/drifted\/partially-promoted/);
  });
  it('applyPromotion run twice is a no-op on the second run', () => {
    const { records, sources } = makeFixture();
    applyPromotion(records, sources, APPLY_OPTS);
    const second = applyPromotion(records, sources, APPLY_OPTS);
    expect(second.promoteValue).toBe(false);
    expect(second.promoteSource).toBe(false);
  });
  // Regression: locator-only update (both records already promoted, only the url changing) must
  // report sourceTouched=true and mutate the url, so the caller's write guard fires. The CLI's
  // write decision reads this returned flag; a caller that ignores it would skip the file write.
  it('on a locator-only re-run, returns sourceTouched=true and updates the url', () => {
    const { records, sources } = makeFixture(
      DONE_VALUE,
      { canonical_source_status: 'direct_source_verified', url: '<placeholder>' },
    );
    const applied = applyPromotion(records, sources, { ...APPLY_OPTS, sourceUrl: 'https://epa.gov/real.pdf' });
    expect(applied.promoteValue).toBe(false);
    expect(applied.promoteSource).toBe(false);
    expect(applied.sourceTouched).toBe(true);
    const s = sources.find((x) => x.source_id === EPA_PROMOTION_SOURCE_ID);
    expect(s.url).toBe('https://epa.gov/real.pdf');
  });
});

describe('promote-epa-ir-food: field edits', () => {
  it('flips qa + evidence + adds attestation + sets direct_source_verified', () => {
    const { records, sources } = makeFixture();
    applyPromotion(records, sources, APPLY_OPTS);
    const r = records.find((x) => x.parameter_value_id === EPA_PROMOTION_VALUE_ID);
    expect(r.qa_status).toBe('approved');
    expect(r.evidence_support_status).toBe('approved_source_backed');
    expect(r.canonical_source_status).toBe('direct_source_verified');
    expect(r.default_status).toBe('available_option'); // never promoted to a default
    expect(r.value).toBe(0.0175); // value untouched
    const ev = r.evidence_items[0];
    expect(ev.qa_status).toBe('approved');
    expect(ev.reviewed_by).toBe('J. Nelson');
    expect(ev.reviewed_at).toBe('2026-06-10');
    // reviewed_by/reviewed_at sit immediately AFTER qa_status (canonical schema order).
    const keys = Object.keys(ev);
    const qi = keys.indexOf('qa_status');
    expect(keys[qi + 1]).toBe('reviewed_by');
    expect(keys[qi + 2]).toBe('reviewed_at');
    // source promoted
    const s = sources.find((x) => x.source_id === EPA_PROMOTION_SOURCE_ID);
    expect(s.canonical_source_status).toBe('direct_source_verified');
  });
  it('sets the source url + zotero key + linked status from options', () => {
    const { records, sources } = makeFixture({}, { url: null });
    applyPromotion(records, sources, { ...APPLY_OPTS, sourceUrl: 'https://epa.gov/doc', zoteroKey: 'ZK99' });
    const s = sources.find((x) => x.source_id === EPA_PROMOTION_SOURCE_ID);
    expect(s.url).toBe('https://epa.gov/doc');
    expect(s.zotero_item_key).toBe('ZK99');
    expect(s.zotero_status).toBe('linked');
  });
  // Regression: a rerun where the key already matches but zotero_status is stale must still repair
  // the status (mirrors the url locator-only repair) and report sourceTouched so the write fires.
  it('repairs a stale zotero_status when the key already matches', () => {
    const { records, sources } = makeFixture({}, { zotero_item_key: 'ZK99', zotero_status: 'pending_owner_export' });
    const applied = applyPromotion(records, sources, { ...APPLY_OPTS, zoteroKey: 'ZK99' });
    const s = sources.find((x) => x.source_id === EPA_PROMOTION_SOURCE_ID);
    expect(s.zotero_status).toBe('linked');
    expect(applied.sourceTouched).toBe(true);
  });
  it('stamps the applicability field on fresh promotion (Evidence Library renders it verbatim)', () => {
    const { records, sources } = makeFixture({
      applicability: 'US EPA 2000 AWQC general adult population. needs_review candidate; not a calculator default.',
    });
    applyPromotion(records, sources, APPLY_OPTS);
    const r = records.find((x) => x.parameter_value_id === EPA_PROMOTION_VALUE_ID);
    expect(r.applicability).toContain('PROMOTED to approved');
    expect(r.uncertainty).toContain('PROMOTED to approved');
    expect(r.review_notes).toContain('PROMOTED to approved');
  });
  // Display-stamp REPAIR: an already-approved record missing the applicability stamp (an earlier tool
  // version stamped uncertainty/review_notes but not applicability) is repaired on rerun.
  it('repairs a missing applicability stamp on an already-approved record (valueTouched=true)', () => {
    const { records, sources } = makeFixture(
      {
        ...DONE_VALUE,
        applicability: 'US EPA 2000 AWQC general adult population. needs_review candidate.',
        uncertainty: 'secondary citation [PROMOTED to approved on 2026-06-10 by J. Nelson]',
        review_notes: 'note [PROMOTED to approved on 2026-06-10 by J. Nelson]',
      },
      { canonical_source_status: 'direct_source_verified' },
    );
    const applied = applyPromotion(records, sources, APPLY_OPTS);
    expect(applied.promoteValue).toBe(false);
    expect(applied.valueTouched).toBe(true);
    const r = records.find((x) => x.parameter_value_id === EPA_PROMOTION_VALUE_ID);
    expect(r.applicability).toContain('PROMOTED to approved');
  });
  it('does not double-stamp an already-stamped record (idempotent, valueTouched=false)', () => {
    const stamped = ' [PROMOTED to approved on 2026-06-10 by J. Nelson]';
    const { records, sources } = makeFixture(
      {
        ...DONE_VALUE,
        applicability: 'US EPA 2000 AWQC.' + stamped,
        uncertainty: 'secondary citation.' + stamped,
        review_notes: 'note.' + stamped,
      },
      { canonical_source_status: 'direct_source_verified' },
    );
    const applied = applyPromotion(records, sources, APPLY_OPTS);
    expect(applied.valueTouched).toBe(false);
    const r = records.find((x) => x.parameter_value_id === EPA_PROMOTION_VALUE_ID);
    // exactly one stamp marker -- not doubled
    expect(r.applicability.match(/PROMOTED to approved/g)).toHaveLength(1);
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
