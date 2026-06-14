// Guards for the owner-run BC WLRS adult body-weight promotion tool (promote-wlrs-bw-default.mjs).
// Plain ASCII only. Mirrors promote-wlrs-default.test.mjs re-scoped to the BW_kg record.

import { describe, it, expect } from 'vitest';
import {
  BW_PROMOTION_VALUE_ID,
  BW_PROMOTION_SOURCE_ID,
  parseArgs,
  validateApplyOptions,
  planPromotion,
  applyPromotion,
} from '../promote-wlrs-bw-default.mjs';

function makeValueRecord(overrides = {}) {
  return {
    parameter_value_id: BW_PROMOTION_VALUE_ID,
    substance_key: 'generic',
    pathway: 'human-health-food',
    input_key: 'BW_kg',
    value: 70.7,
    unit: 'kg',
    value_type: 'single_value',
    default_status: 'available_option',
    evidence_support_status: 'pending_source_locator',
    qa_status: 'needs_review',
    canonical_source_status: 'needs_direct_source_check',
    candidate_group_id: 'human-health-food__generic__BW_kg__BC',
    jurisdiction: 'BC',
    source_ids: [BW_PROMOTION_SOURCE_ID],
    uncertainty: 'Secondary citation pending direct-source verification.',
    review_notes: 'BC WLRS 2023 adult body weight (70.7 kg, general Canadian adult).',
    evidence_items: [
      {
        source_id: BW_PROMOTION_SOURCE_ID,
        locator: 'Section 2 / Table 1, document page 2',
        value_text: 'adult (males and females combined, age >=20): 70.7 kg',
        extraction_method: 'manual_source_extraction',
        extracted_by: 'claude-sonnet-4-6',
        extracted_at: '2026-06-11',
        qa_status: 'needs_review',
        note: 'n',
        evidence_id: 'ev-' + BW_PROMOTION_VALUE_ID + '-1',
        locator_type: 'source_table',
      },
    ],
    ...overrides,
  };
}

// The WLRS source record. For the BW record this source is normally ALREADY verified (the IR
// promotion did it), so the default fixture here uses the verified state; tests that exercise the
// pre-promotion source path override canonical_source_status explicitly.
function makeSourceRecord(overrides = {}) {
  return {
    source_id: BW_PROMOTION_SOURCE_ID,
    short_citation: 'BC WLRS 2023 Fish Tissue Screening Values',
    url: 'https://www2.gov.bc.ca/assets/bc_fish_tissue_screening_derivation_feb_2023.pdf',
    zotero_item_key: null,
    zotero_status: 'pending_owner_export',
    notes: 'BC WLRS 2023.',
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
      candidate_group_id: 'human-health-food__generic__BW_kg__BC',
      jurisdiction: 'BC',
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
      source_id: BW_PROMOTION_SOURCE_ID,
      qa_status: 'approved',
      reviewed_by: 'J. Nelson',
      reviewed_at: '2026-06-11',
      evidence_id: 'ev-' + BW_PROMOTION_VALUE_ID + '-1',
    },
  ],
};

describe('promote-wlrs-bw-default: scope constants', () => {
  it('targets exactly the WLRS adult body-weight value + WLRS 2023 source', () => {
    expect(BW_PROMOTION_VALUE_ID).toBe('pv-wlrs-2023-bw-adult-bc');
    expect(BW_PROMOTION_SOURCE_ID).toBe('src-bc-wlrs-fish-tissue-screening-2023');
  });
});

describe('promote-wlrs-bw-default: parseArgs', () => {
  it('parses flags and values', () => {
    const a = parseArgs(['node', 's', '--reviewer', 'J. Nelson', '--date', '2026-06-11',
      '--source-url', 'https://gov.bc.ca/x', '--zotero-key', 'ABCD1234', '--apply']);
    expect(a).toMatchObject({
      reviewer: 'J. Nelson', date: '2026-06-11', sourceUrl: 'https://gov.bc.ca/x',
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

describe('promote-wlrs-bw-default: validateApplyOptions', () => {
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

describe('promote-wlrs-bw-default: planPromotion preconditions (fail-closed)', () => {
  it('plans the value (source already verified -> source skip)', () => {
    const { records, sources } = makeFixture({}, { canonical_source_status: 'direct_source_verified' });
    const plan = planPromotion(records, sources, APPLY_OPTS);
    expect(plan.promoteValue).toBe(true);
    expect(plan.promoteSource).toBe(false);
  });
  it('throws when the value record is missing', () => {
    const { records, sources } = makeFixture();
    const filtered = records.filter((r) => r.parameter_value_id !== BW_PROMOTION_VALUE_ID);
    expect(() => planPromotion(filtered, sources, APPLY_OPTS)).toThrow(/not found/);
  });
  it('throws when the value has no evidence_items', () => {
    const { records, sources } = makeFixture({ evidence_items: [] });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/no evidence_items/);
  });
  it('throws on a frame-eligibility identity mismatch (wrong jurisdiction)', () => {
    const { records, sources } = makeFixture({ jurisdiction: 'US_federal' });
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
  it('throws when source_ids does not link the WLRS source', () => {
    const { records, sources } = makeFixture({ source_ids: ['src-wrong'] });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/source_ids must be EXACTLY/);
  });
  it('throws when source_ids has a SECOND linked source (under-block risk)', () => {
    const { records, sources } = makeFixture({ source_ids: [BW_PROMOTION_SOURCE_ID, 'src-extra'] });
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
      source_relationships: [{ source_id: BW_PROMOTION_SOURCE_ID, role: 'reference_mining' }],
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
  it('throws when evidence_items[0].source_id is a stale foreign reference (nested-source guard)', () => {
    const base = makeValueRecord();
    const staleEv = { ...base.evidence_items[0], source_id: 'src-FOREIGN-stale' };
    const { records, sources } = makeFixture({ evidence_items: [staleEv] });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/nested provenance source/);
  });
});

describe('promote-wlrs-bw-default: idempotency', () => {
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
    const applied = applyPromotion(records, sources, { ...APPLY_OPTS, sourceUrl: 'https://gov.bc.ca/real.pdf' });
    expect(applied.promoteValue).toBe(false);
    expect(applied.sourceTouched).toBe(true);
    const s = sources.find((x) => x.source_id === BW_PROMOTION_SOURCE_ID);
    expect(s.url).toBe('https://gov.bc.ca/real.pdf');
  });
});

describe('promote-wlrs-bw-default: field edits', () => {
  it('flips qa + evidence + adds attestation + sets direct_source_verified', () => {
    const { records, sources } = makeFixture({}, { canonical_source_status: 'direct_source_verified' });
    applyPromotion(records, sources, APPLY_OPTS);
    const r = records.find((x) => x.parameter_value_id === BW_PROMOTION_VALUE_ID);
    expect(r.qa_status).toBe('approved');
    expect(r.evidence_support_status).toBe('approved_source_backed');
    expect(r.canonical_source_status).toBe('direct_source_verified');
    expect(r.default_status).toBe('available_option'); // never promoted to a default
    expect(r.value).toBe(70.7); // value untouched
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
    const { records, sources } = makeFixture(); // source pre-state needs_direct_source_check
    const applied = applyPromotion(records, sources, APPLY_OPTS);
    expect(applied.promoteSource).toBe(true);
    const s = sources.find((x) => x.source_id === BW_PROMOTION_SOURCE_ID);
    expect(s.canonical_source_status).toBe('direct_source_verified');
  });
  it('repairs a stale zotero_status when the key already matches', () => {
    const { records, sources } = makeFixture(
      {},
      { canonical_source_status: 'direct_source_verified', zotero_item_key: 'ZK99', zotero_status: 'pending_owner_export' },
    );
    const applied = applyPromotion(records, sources, { ...APPLY_OPTS, zoteroKey: 'ZK99' });
    const s = sources.find((x) => x.source_id === BW_PROMOTION_SOURCE_ID);
    expect(s.zotero_status).toBe('linked');
    expect(applied.sourceTouched).toBe(true);
  });
  it('stamps the applicability field on fresh promotion (Evidence Library renders it verbatim)', () => {
    const { records, sources } = makeFixture(
      { applicability: 'BC HHRA adult body weight (WLRS 2023, Table 1). needs_review candidate.' },
      { canonical_source_status: 'direct_source_verified' },
    );
    applyPromotion(records, sources, APPLY_OPTS);
    const r = records.find((x) => x.parameter_value_id === BW_PROMOTION_VALUE_ID);
    expect(r.applicability).toContain('PROMOTED to approved');
    expect(r.uncertainty).toContain('PROMOTED to approved');
    expect(r.review_notes).toContain('PROMOTED to approved');
  });
  it('repairs a missing applicability stamp on an already-approved record (valueTouched=true)', () => {
    const { records, sources } = makeFixture(
      {
        ...DONE_VALUE,
        applicability: 'BC HHRA adult body weight (WLRS 2023, Table 1). needs_review candidate.',
        uncertainty: 'secondary citation [PROMOTED to approved on 2026-06-11 by J. Nelson]',
        review_notes: 'note [PROMOTED to approved on 2026-06-11 by J. Nelson]',
      },
      { canonical_source_status: 'direct_source_verified' },
    );
    const applied = applyPromotion(records, sources, APPLY_OPTS);
    expect(applied.promoteValue).toBe(false);
    expect(applied.valueTouched).toBe(true);
    const r = records.find((x) => x.parameter_value_id === BW_PROMOTION_VALUE_ID);
    expect(r.applicability).toContain('PROMOTED to approved');
    expect(r.uncertainty.match(/PROMOTED to approved/g)).toHaveLength(1);
    expect(r.review_notes.match(/PROMOTED to approved/g)).toHaveLength(1);
  });
  it('does not double-stamp an already-stamped record (idempotent, valueTouched=false)', () => {
    const stamped = ' [PROMOTED to approved on 2026-06-11 by J. Nelson]';
    const { records, sources } = makeFixture(
      {
        ...DONE_VALUE,
        applicability: 'BC HHRA adult body weight.' + stamped,
        uncertainty: 'secondary citation.' + stamped,
        review_notes: 'note.' + stamped,
      },
      { canonical_source_status: 'direct_source_verified' },
    );
    const applied = applyPromotion(records, sources, APPLY_OPTS);
    expect(applied.valueTouched).toBe(false);
    const r = records.find((x) => x.parameter_value_id === BW_PROMOTION_VALUE_ID);
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
