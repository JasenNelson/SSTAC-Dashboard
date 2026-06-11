// Guards for the owner-run US EPA adult body-weight promotion tool (promote-epa-bw-default.mjs).
// Plain ASCII only. Mirrors promote-wlrs-bw-default.test.mjs re-scoped to the EPA BW_kg record.

import { describe, it, expect } from 'vitest';
import {
  EPA_BW_PROMOTION_VALUE_ID,
  EPA_BW_PROMOTION_SOURCE_ID,
  parseArgs,
  validateApplyOptions,
  planPromotion,
  applyPromotion,
} from '../promote-epa-bw-default.mjs';

function makeValueRecord(overrides = {}) {
  return {
    parameter_value_id: EPA_BW_PROMOTION_VALUE_ID,
    substance_key: 'generic',
    pathway: 'human-health-food',
    input_key: 'BW_kg',
    value: 70,
    unit: 'kg',
    value_type: 'single_value',
    default_status: 'available_option',
    evidence_support_status: 'pending_source_locator',
    qa_status: 'needs_review',
    canonical_source_status: 'needs_direct_source_check',
    candidate_group_id: 'human-health-food__generic__BW_kg__US_federal',
    jurisdiction: 'US_federal',
    source_ids: [EPA_BW_PROMOTION_SOURCE_ID],
    uncertainty: 'Secondary citation pending direct-source verification.',
    review_notes: 'US EPA 2000 AWQC adult body weight (70 kg, general population).',
    evidence_items: [
      {
        source_id: EPA_BW_PROMOTION_SOURCE_ID,
        locator: 'Equation parameter key (Ch.1 p.1-9) + Section 4.3.1.1 (p.4-19)',
        value_text: 'general adult population: 70 kg',
        extraction_method: 'manual_source_extraction',
        extracted_by: 'claude-sonnet-4-6',
        extracted_at: '2026-06-11',
        qa_status: 'needs_review',
        reviewed_by: null,
        reviewed_at: null,
        note: 'n',
        evidence_id: 'ev-' + EPA_BW_PROMOTION_VALUE_ID + '-1',
        locator_type: 'source_table',
      },
    ],
    ...overrides,
  };
}

function makeSourceRecord(overrides = {}) {
  return {
    source_id: EPA_BW_PROMOTION_SOURCE_ID,
    short_citation: 'US EPA 2000 AWQC Human Health Methodology',
    url: 'https://www.epa.gov/sites/default/files/EPA-822-B-00-004.pdf',
    zotero_item_key: null,
    zotero_status: 'pending_owner_export',
    notes: 'US EPA 2000 AWQC Human Health Methodology.',
    canonical_source_status: 'needs_direct_source_check',
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
      input_key: 'BW_kg',
      value: 80,
      unit: 'kg',
      value_type: 'single_value',
      default_status: 'available_option',
      evidence_support_status: 'pending_source_locator',
      qa_status: 'needs_review',
      canonical_source_status: 'needs_direct_source_check',
      candidate_group_id: 'human-health-food__generic__BW_kg__US_federal',
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
const APPLY_OPTS = { reviewer: 'J. Nelson', date: '2026-06-11', sourceUrl: null, zoteroKey: null };

const DONE_VALUE = {
  qa_status: 'approved',
  evidence_support_status: 'approved_source_backed',
  canonical_source_status: 'direct_source_verified',
  evidence_items: [
    {
      source_id: EPA_BW_PROMOTION_SOURCE_ID,
      qa_status: 'approved',
      reviewed_by: 'J. Nelson',
      reviewed_at: '2026-06-11',
      evidence_id: 'ev-' + EPA_BW_PROMOTION_VALUE_ID + '-1',
    },
  ],
};

describe('promote-epa-bw-default: scope constants', () => {
  it('targets exactly the EPA adult body-weight value + EPA 2000 AWQC source', () => {
    expect(EPA_BW_PROMOTION_VALUE_ID).toBe('pv-epa-2000-bw-adult-us');
    expect(EPA_BW_PROMOTION_SOURCE_ID).toBe('src-epa-2000-awqc-human-health');
  });
});

describe('promote-epa-bw-default: parseArgs', () => {
  it('parses flags and values', () => {
    const a = parseArgs(['node', 's', '--reviewer', 'J. Nelson', '--date', '2026-06-11',
      '--source-url', 'https://epa.gov/x', '--zotero-key', 'ABCD1234', '--apply']);
    expect(a).toMatchObject({
      reviewer: 'J. Nelson', date: '2026-06-11', sourceUrl: 'https://epa.gov/x',
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

describe('promote-epa-bw-default: validateApplyOptions', () => {
  it('accepts a complete attestation', () => {
    expect(() => validateApplyOptions(APPLY_OPTS)).not.toThrow();
  });
  it('requires reviewer', () => {
    expect(() => validateApplyOptions({ ...APPLY_OPTS, reviewer: '' })).toThrow(/reviewer/);
  });
  it('requires a YYYY-MM-DD date', () => {
    expect(() => validateApplyOptions({ ...APPLY_OPTS, date: '2026/06/11' })).toThrow(/date/);
  });
});

describe('promote-epa-bw-default: planPromotion preconditions (fail-closed)', () => {
  it('plans the value (source already verified -> source skip)', () => {
    const { records, sources } = makeFixture({}, { canonical_source_status: 'direct_source_verified' });
    const plan = planPromotion(records, sources, APPLY_OPTS);
    expect(plan.promoteValue).toBe(true);
    expect(plan.promoteSource).toBe(false);
  });
  it('throws when the value record is missing', () => {
    const { records, sources } = makeFixture();
    const filtered = records.filter((r) => r.parameter_value_id !== EPA_BW_PROMOTION_VALUE_ID);
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
    const { records, sources } = makeFixture({ value: 80 });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/expected frame-eligible identity/);
  });
  it('throws on a unit drift (g instead of kg)', () => {
    const { records, sources } = makeFixture({ unit: 'g' });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/expected frame-eligible identity/);
  });
  it('throws when source_ids does not link the EPA source', () => {
    const { records, sources } = makeFixture({ source_ids: ['src-wrong'] });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/source_ids must be EXACTLY/);
  });
  it('throws when source_ids has a SECOND linked source (under-block risk)', () => {
    const { records, sources } = makeFixture({ source_ids: [EPA_BW_PROMOTION_SOURCE_ID, 'src-extra'] });
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
  it('throws when the source role is policy_compilation', () => {
    const { records, sources } = makeFixture({}, { calculator_source_role: 'policy_compilation' });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/policy_compilation\/reference_mining/);
  });
  it('throws when a source_relationships role is reference_mining', () => {
    const { records, sources } = makeFixture({
      source_relationships: [{ source_id: EPA_BW_PROMOTION_SOURCE_ID, role: 'reference_mining' }],
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

describe('promote-epa-bw-default: idempotency', () => {
  it('skips when both records are already in target state', () => {
    const { records, sources } = makeFixture(
      DONE_VALUE,
      { canonical_source_status: 'direct_source_verified' },
    );
    const plan = planPromotion(records, sources, APPLY_OPTS);
    expect(plan.promoteValue).toBe(false);
    expect(plan.promoteSource).toBe(false);
  });
  it('throws on a partially-promoted record (top-level done, evidence still needs_review)', () => {
    const { records, sources } = makeFixture(
      {
        qa_status: 'approved',
        evidence_support_status: 'approved_source_backed',
        canonical_source_status: 'direct_source_verified',
      },
      { canonical_source_status: 'direct_source_verified' },
    );
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/drifted\/partially-promoted/);
  });
  it('applyPromotion run twice is a no-op on the second run', () => {
    const { records, sources } = makeFixture({}, { canonical_source_status: 'direct_source_verified' });
    applyPromotion(records, sources, APPLY_OPTS);
    const second = applyPromotion(records, sources, APPLY_OPTS);
    expect(second.promoteValue).toBe(false);
    expect(second.promoteSource).toBe(false);
  });
  it('on a locator-only re-run, returns sourceTouched=true and updates the url', () => {
    const { records, sources } = makeFixture(
      DONE_VALUE,
      { canonical_source_status: 'direct_source_verified', url: '<placeholder>' },
    );
    const applied = applyPromotion(records, sources, { ...APPLY_OPTS, sourceUrl: 'https://epa.gov/real.pdf' });
    expect(applied.promoteValue).toBe(false);
    expect(applied.sourceTouched).toBe(true);
    const s = sources.find((x) => x.source_id === EPA_BW_PROMOTION_SOURCE_ID);
    expect(s.url).toBe('https://epa.gov/real.pdf');
  });
});

describe('promote-epa-bw-default: field edits', () => {
  it('flips qa + evidence + adds attestation + sets direct_source_verified', () => {
    const { records, sources } = makeFixture({}, { canonical_source_status: 'direct_source_verified' });
    applyPromotion(records, sources, APPLY_OPTS);
    const r = records.find((x) => x.parameter_value_id === EPA_BW_PROMOTION_VALUE_ID);
    expect(r.qa_status).toBe('approved');
    expect(r.evidence_support_status).toBe('approved_source_backed');
    expect(r.canonical_source_status).toBe('direct_source_verified');
    expect(r.default_status).toBe('available_option');
    expect(r.value).toBe(70);
    const ev = r.evidence_items[0];
    expect(ev.qa_status).toBe('approved');
    expect(ev.reviewed_by).toBe('J. Nelson');
    expect(ev.reviewed_at).toBe('2026-06-11');
    const keys = Object.keys(ev);
    const qi = keys.indexOf('qa_status');
    expect(keys[qi + 1]).toBe('reviewed_by');
    expect(keys[qi + 2]).toBe('reviewed_at');
  });
  it('promotes the source when it is still in the pre-state', () => {
    const { records, sources } = makeFixture();
    const applied = applyPromotion(records, sources, APPLY_OPTS);
    expect(applied.promoteSource).toBe(true);
    const s = sources.find((x) => x.source_id === EPA_BW_PROMOTION_SOURCE_ID);
    expect(s.canonical_source_status).toBe('direct_source_verified');
  });
  it('repairs a stale zotero_status when the key already matches', () => {
    const { records, sources } = makeFixture(
      {},
      { canonical_source_status: 'direct_source_verified', zotero_item_key: 'ZK99', zotero_status: 'pending_owner_export' },
    );
    const applied = applyPromotion(records, sources, { ...APPLY_OPTS, zoteroKey: 'ZK99' });
    const s = sources.find((x) => x.source_id === EPA_BW_PROMOTION_SOURCE_ID);
    expect(s.zotero_status).toBe('linked');
    expect(applied.sourceTouched).toBe(true);
  });
  it('stamps the applicability field on fresh promotion (Evidence Library renders it verbatim)', () => {
    const { records, sources } = makeFixture(
      { applicability: 'US EPA 2000 AWQC adult body weight (70 kg). needs_review candidate.' },
      { canonical_source_status: 'direct_source_verified' },
    );
    applyPromotion(records, sources, APPLY_OPTS);
    const r = records.find((x) => x.parameter_value_id === EPA_BW_PROMOTION_VALUE_ID);
    expect(r.applicability).toContain('PROMOTED to approved');
    expect(r.uncertainty).toContain('PROMOTED to approved');
    expect(r.review_notes).toContain('PROMOTED to approved');
  });
  it('repairs a missing applicability stamp on an already-approved record (valueTouched=true)', () => {
    const { records, sources } = makeFixture(
      {
        ...DONE_VALUE,
        applicability: 'US EPA 2000 AWQC adult body weight (70 kg). needs_review candidate.',
        uncertainty: 'secondary citation [PROMOTED to approved on 2026-06-11 by J. Nelson]',
        review_notes: 'note [PROMOTED to approved on 2026-06-11 by J. Nelson]',
      },
      { canonical_source_status: 'direct_source_verified' },
    );
    const applied = applyPromotion(records, sources, APPLY_OPTS);
    expect(applied.promoteValue).toBe(false);
    expect(applied.valueTouched).toBe(true);
    const r = records.find((x) => x.parameter_value_id === EPA_BW_PROMOTION_VALUE_ID);
    expect(r.applicability).toContain('PROMOTED to approved');
    expect(r.uncertainty.match(/PROMOTED to approved/g)).toHaveLength(1);
    expect(r.review_notes.match(/PROMOTED to approved/g)).toHaveLength(1);
  });
  it('does not double-stamp an already-stamped record (idempotent, valueTouched=false)', () => {
    const stamped = ' [PROMOTED to approved on 2026-06-11 by J. Nelson]';
    const { records, sources } = makeFixture(
      {
        ...DONE_VALUE,
        applicability: 'US EPA 2000 AWQC adult body weight.' + stamped,
        uncertainty: 'secondary citation.' + stamped,
        review_notes: 'note.' + stamped,
      },
      { canonical_source_status: 'direct_source_verified' },
    );
    const applied = applyPromotion(records, sources, APPLY_OPTS);
    expect(applied.valueTouched).toBe(false);
    const r = records.find((x) => x.parameter_value_id === EPA_BW_PROMOTION_VALUE_ID);
    expect(r.applicability.match(/PROMOTED to approved/g)).toHaveLength(1);
  });
  it('never mutates a non-target value or source record', () => {
    const { records, sources } = makeFixture({}, { canonical_source_status: 'direct_source_verified' });
    const beforeVal = clone(records.find((r) => r.parameter_value_id === 'pv-other-untouched'));
    const beforeSrc = clone(sources.find((s) => s.source_id === 'src-other-untouched'));
    applyPromotion(records, sources, APPLY_OPTS);
    expect(records.find((r) => r.parameter_value_id === 'pv-other-untouched')).toEqual(beforeVal);
    expect(sources.find((s) => s.source_id === 'src-other-untouched')).toEqual(beforeSrc);
  });
});
