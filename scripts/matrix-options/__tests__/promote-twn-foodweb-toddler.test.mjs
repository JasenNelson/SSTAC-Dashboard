// Guards for the TWN BIWQO 2021 toddler subsistence food-web promotion tool
// (promote-twn-foodweb-toddler.mjs). Plain ASCII only.
//
// Verifies the tool's load-bearing guarantees on synthetic fixtures (independent of catalog state):
//  - arg parsing + apply-option validation,
//  - fail-closed preconditions (missing id, no evidence, identity drift, wrong/second source link,
//    nested-source provenance guard for IR + BW records, source-role policy_compilation/reference_mining,
//    not-current, repo_metadata_only, unexpected/partially-promoted pre-state, drifted source),
//  - idempotency (already-promoted targets are skipped; locator-only reruns write),
//  - exact field edits + reviewed_* key placement + display-stamp (applicability/uncertainty/review_notes),
//  - SCOPE: non-target records are never mutated,
//  - 2-record promotion: IR + BW toddler records + source all promoted together.
//
// Mirrors promote-acfn-foodweb.test.mjs (the ACFN WQCIU precedent) re-scoped to the
// TWN BIWQO 2021 toddler subsistence records.

import { describe, it, expect } from 'vitest';
import {
  TWN_TODDLER_IR_VALUE_ID,
  TWN_TODDLER_BW_VALUE_ID,
  TWN_TODDLER_SOURCE_ID,
  HC_PQRA_SOURCE_ID,
  TWN_TODDLER_PROMOTION_VALUE_IDS,
  parseArgs,
  validateApplyOptions,
  planPromotion,
  applyPromotion,
} from '../promote-twn-foodweb-toddler.mjs';

// A value record for the IR_food toddler in the exact documented pre-promotion state.
function makeIrRecord(overrides = {}) {
  return {
    parameter_value_id: TWN_TODDLER_IR_VALUE_ID,
    substance_key: 'generic',
    pathway: 'human-health-food',
    input_key: 'IR_food_kg_per_day',
    value: 0.094,
    unit: 'kg/day',
    value_type: 'single_value',
    default_status: 'available_option',
    evidence_support_status: 'pending_source_locator',
    qa_status: 'needs_review',
    canonical_source_status: 'needs_direct_source_check',
    candidate_group_id: 'human-health-food__generic__IR_food_kg_per_day__BC',
    jurisdiction: 'BC',
    source_ids: [TWN_TODDLER_SOURCE_ID],
    uncertainty: 'Secondary citation pending direct-source verification.',
    review_notes: 'TWN BIWQO 2021 toddler IR_food (94 g/day).',
    evidence_items: [
      {
        source_id: TWN_TODDLER_SOURCE_ID,
        locator: 'Table 1',
        value_text: 'toddler subsistence: 94 g/day = 0.094 kg/day',
        extraction_method: 'manual_source_extraction',
        extracted_by: 'claude-sonnet-4-6',
        extracted_at: '2026-06-14',
        qa_status: 'needs_review',
        evidence_support_status: 'pending_source_locator',
        evidence_id: 'ev-' + TWN_TODDLER_IR_VALUE_ID + '-1',
        locator_type: 'source_table',
      },
    ],
    ...overrides,
  };
}

// A value record for the BW toddler food-web in the uniform pre-promotion state.
// Both IR and BW records use the same needs_review pre-state shape:
//   qa_status=needs_review, evidence_support_status=pending_source_locator,
//   canonical_source_status=needs_direct_source_check, evidence qa_status=needs_review,
//   no reviewed_by / reviewed_at on the evidence item.
// The BW record carries source_id=HC PQRA v4.0 (src-health-canada-pqra-v4-2024); the HC
// source is already verified as a SOURCE record, but the CATALOG RECORD is needs_review
// until the owner runs --apply for the whole TWN toddler food-web scenario.
function makeBwRecord(overrides = {}) {
  return {
    parameter_value_id: TWN_TODDLER_BW_VALUE_ID,
    substance_key: 'generic',
    pathway: 'human-health-food',
    input_key: 'BW_kg',
    value: 16.5,
    unit: 'kg',
    value_type: 'single_value',
    default_status: 'available_option',
    evidence_support_status: 'pending_source_locator',
    qa_status: 'needs_review',
    canonical_source_status: 'needs_direct_source_check',
    candidate_group_id: 'human-health-food__generic__BW_kg__BC',
    jurisdiction: 'BC',
    source_ids: [HC_PQRA_SOURCE_ID],
    uncertainty: 'HC PQRA v4.0 Appendix E standard toddler BW (16.5 kg). Secondary citation pending direct-source verification.',
    review_notes: 'HC PQRA v4.0 toddler BW (16.5 kg) under human-health-food pathway. Paired with TWN BIWQO 2021 toddler IR_food (0.094 kg/day). needs_review pending owner promotion.',
    evidence_items: [
      {
        source_id: HC_PQRA_SOURCE_ID,
        locator: 'Appendix E, p.69-70: Body weight (kg) row, toddler column',
        value_text: 'toddler (6 mo to <5 yr): 16.5 kg',
        extraction_method: 'manual_source_extraction',
        extracted_by: 'claude-sonnet-4-6',
        extracted_at: '2026-06-14',
        qa_status: 'needs_review',
        evidence_id: 'ev-' + TWN_TODDLER_BW_VALUE_ID + '-1',
        locator_type: 'source_table',
      },
    ],
    ...overrides,
  };
}

// A source record in the exact documented pre-promotion state, with a durable locator.
function makeSourceRecord(overrides = {}) {
  return {
    source_id: TWN_TODDLER_SOURCE_ID,
    short_citation: 'TWN Burrard Inlet WQO -- Tissue Quality Objectives, 2021',
    url: 'https://www2.gov.bc.ca/assets/gov/environment/air-land-water/water/waterquality/water-quality-objectives/burrard_inlet_water_quality_objectives_methods_tissue_rec_june_3-_2021.pdf',
    zotero_item_key: null,
    zotero_status: 'pending_owner_export',
    notes: 'TWN BIWQO 2021; needs_review pending direct-source verification.',
    canonical_source_status: 'needs_direct_source_check',
    calculator_source_role: 'canonical_candidate',
    currentness_status: 'current',
    file_storage: 'zotero_or_external',
    ...overrides,
  };
}

// The HC PQRA v4.0 source the BW record relies on: it must be ALREADY direct_source_verified +
// direct-current eligible (the BW promotion depends on it; it is not upgraded by this helper).
function makeHcSource(overrides = {}) {
  return {
    source_id: HC_PQRA_SOURCE_ID,
    short_citation: 'Health Canada PQRA v4.0, 2024',
    canonical_source_status: 'direct_source_verified',
    calculator_source_role: 'canonical_candidate',
    currentness_status: 'current',
    file_storage: 'zotero_or_external',
    ...overrides,
  };
}

function makeFixture(irOverrides = {}, bwOverrides = {}, sourceOverrides = {}, hcOverrides = {}) {
  const records = [
    makeIrRecord(irOverrides),
    makeBwRecord(bwOverrides),
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
      candidate_group_id: 'human-health-food__generic__IR_food_kg_per_day__BC',
      jurisdiction: 'BC',
      source_ids: ['src-other'],
      evidence_items: [{ source_id: 'src-other', qa_status: 'needs_review', evidence_id: 'ev-other-1' }],
    },
  ];
  const sources = [
    makeSourceRecord(sourceOverrides),
    makeHcSource(hcOverrides),
    { source_id: 'src-other-untouched', canonical_source_status: 'needs_direct_source_check' },
  ];
  return { records, sources };
}

const clone = (x) => JSON.parse(JSON.stringify(x));
const APPLY_OPTS = { reviewer: 'J. Nelson', date: '2026-06-14', sourceUrl: null, zoteroKey: null };

const DONE_IR = {
  qa_status: 'approved',
  evidence_support_status: 'approved_source_backed',
  canonical_source_status: 'direct_source_verified',
  evidence_items: [
    {
      source_id: TWN_TODDLER_SOURCE_ID,
      qa_status: 'approved',
      reviewed_by: 'J. Nelson',
      reviewed_at: '2026-06-14',
      evidence_id: 'ev-' + TWN_TODDLER_IR_VALUE_ID + '-1',
    },
  ],
};
const DONE_BW = {
  qa_status: 'approved',
  evidence_support_status: 'approved_source_backed',
  canonical_source_status: 'direct_source_verified',
  evidence_items: [
    {
      source_id: HC_PQRA_SOURCE_ID,
      qa_status: 'approved',
      reviewed_by: 'J. Nelson',
      reviewed_at: '2026-06-12',
      evidence_id: 'ev-' + TWN_TODDLER_BW_VALUE_ID + '-1',
    },
  ],
};

describe('promote-twn-foodweb-toddler: scope constants', () => {
  it('targets exactly the two TWN toddler food-web value IDs + TWN BIWQO 2021 source + HC PQRA v4.0 source', () => {
    expect(TWN_TODDLER_IR_VALUE_ID).toBe('pv-twn-biwqo-2021-ir-food-toddler-bc');
    // BW is now sourced to HC PQRA v4.0 (not TWN); provenance fix 2026-06-14.
    expect(TWN_TODDLER_BW_VALUE_ID).toBe('pv-hc-pqra-v4-2024-bw-toddler-food-bc');
    expect(TWN_TODDLER_SOURCE_ID).toBe('src-bc-twn-burrard-inlet-wqo-tissue-2021');
    // HC PQRA v4.0 source is already direct_source_verified; exported so tests can reference it.
    expect(HC_PQRA_SOURCE_ID).toBe('src-health-canada-pqra-v4-2024');
    expect(TWN_TODDLER_PROMOTION_VALUE_IDS).toEqual([
      'pv-twn-biwqo-2021-ir-food-toddler-bc',
      'pv-hc-pqra-v4-2024-bw-toddler-food-bc',
    ]);
  });
});

describe('promote-twn-foodweb-toddler: parseArgs', () => {
  it('parses flags and values', () => {
    const a = parseArgs(['node', 's', '--reviewer', 'J. Nelson', '--date', '2026-06-14',
      '--source-url', 'https://example.com/twn.pdf', '--zotero-key', 'TWNABC1', '--apply']);
    expect(a).toMatchObject({
      reviewer: 'J. Nelson', date: '2026-06-14',
      sourceUrl: 'https://example.com/twn.pdf',
      zoteroKey: 'TWNABC1', apply: true,
    });
  });
  it('defaults to a dry run', () => {
    expect(parseArgs(['node', 's']).apply).toBe(false);
  });
  it('throws on unknown argument', () => {
    expect(() => parseArgs(['node', 's', '--bogus'])).toThrow(/Unknown argument/);
  });
});

describe('promote-twn-foodweb-toddler: validateApplyOptions', () => {
  it('accepts a complete attestation', () => {
    expect(() => validateApplyOptions(APPLY_OPTS)).not.toThrow();
  });
  it('requires reviewer', () => {
    expect(() => validateApplyOptions({ ...APPLY_OPTS, reviewer: '' })).toThrow(/reviewer/);
  });
  it('requires a YYYY-MM-DD date', () => {
    expect(() => validateApplyOptions({ ...APPLY_OPTS, date: '2026/06/14' })).toThrow(/date/);
  });
});

describe('promote-twn-foodweb-toddler: planPromotion preconditions (fail-closed)', () => {
  it('plans all three records from the expected pre-state', () => {
    const { records, sources } = makeFixture();
    const plan = planPromotion(records, sources, APPLY_OPTS);
    expect(plan.promoteIr).toBe(true);
    expect(plan.promoteBw).toBe(true);
    expect(plan.promoteSource).toBe(true);
  });
  it('throws when the IR value record is missing', () => {
    const { records, sources } = makeFixture();
    const filtered = records.filter((r) => r.parameter_value_id !== TWN_TODDLER_IR_VALUE_ID);
    expect(() => planPromotion(filtered, sources, APPLY_OPTS)).toThrow(/not found/);
  });
  it('throws when the BW value record is missing', () => {
    const { records, sources } = makeFixture();
    const filtered = records.filter((r) => r.parameter_value_id !== TWN_TODDLER_BW_VALUE_ID);
    expect(() => planPromotion(filtered, sources, APPLY_OPTS)).toThrow(/not found/);
  });
  it('throws when the IR value has no evidence_items', () => {
    const { records, sources } = makeFixture({ evidence_items: [] });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/no evidence_items/);
  });
  it('throws when the BW value has no evidence_items', () => {
    const { records, sources } = makeFixture({}, { evidence_items: [] });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/no evidence_items/);
  });
  it('throws on a frame-eligibility identity mismatch for IR (wrong value)', () => {
    const { records, sources } = makeFixture({ value: 0.22 });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/expected frame-eligible identity/);
  });
  it('throws on a frame-eligibility identity mismatch for BW (wrong value)', () => {
    const { records, sources } = makeFixture({}, { value: 70.7 });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/expected frame-eligible identity/);
  });
  it('throws on a frame-eligibility identity mismatch for IR (wrong jurisdiction)', () => {
    const { records, sources } = makeFixture({ jurisdiction: 'general' });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/expected frame-eligible identity/);
  });
  it('throws when IR source_ids does not link the TWN source', () => {
    const { records, sources } = makeFixture({ source_ids: ['src-wrong'] });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/source_ids must be EXACTLY/);
  });
  it('throws when IR source_ids has a SECOND linked source (under-block risk)', () => {
    const { records, sources } = makeFixture({ source_ids: [TWN_TODDLER_SOURCE_ID, 'src-extra'] });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/source_ids must be EXACTLY/);
  });
  it('throws when BW source_ids does not link the HC PQRA v4.0 source', () => {
    const { records, sources } = makeFixture({}, { source_ids: ['src-wrong'] });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/source_ids must be EXACTLY/);
  });

  // Nested-source provenance guard (the key regression coverage).
  // Each record's nested refs must match ITS OWN expected source:
  //   IR: all nested refs must be TWN source (src-bc-twn-burrard-inlet-wqo-tissue-2021)
  //   BW: all nested refs must be HC PQRA v4.0 source (src-health-canada-pqra-v4-2024)
  it('throws when IR evidence_items source_id is a stale non-TWN nested source', () => {
    const { records, sources } = makeFixture({
      evidence_items: [{ source_id: 'src-bc-wlrs-fish-tissue-screening-2023', qa_status: 'needs_review' }],
    });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/nested provenance source/);
  });
  it('throws when BW evidence_items source_id is a stale non-HC nested source (e.g. old TWN source)', () => {
    // BW record must link HC PQRA v4.0; a stale TWN or WLRS source_id would be wrong.
    const { records, sources } = makeFixture({}, {
      evidence_items: [{ source_id: TWN_TODDLER_SOURCE_ID, qa_status: 'approved',
        reviewed_by: 'J. Nelson', reviewed_at: '2026-06-12', evidence_id: 'ev-bw-wrong' }],
    });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/nested provenance source/);
  });
  it('throws when IR source_relationships source_id is a stale non-TWN nested source', () => {
    const { records, sources } = makeFixture({
      source_relationships: [{ source_id: 'src-bc-wlrs-fish-tissue-screening-2023', role: 'canonical_candidate' }],
    });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/nested provenance source/);
  });
  it('throws when BW source_relationships source_id is a stale non-HC nested source', () => {
    const { records, sources } = makeFixture({}, {
      source_relationships: [{ source_id: 'src-acfn-wqciu-2023', role: 'canonical_candidate' }],
    });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/nested provenance source/);
  });
  it('throws when IR source_relationships carries a blocking role (policy_compilation) on the expected source', () => {
    // source_id is the EXPECTED TWN source (passes the nested-source-id guard) but the relationship
    // role is blocking -> the frame-seed eligibility path would block it; the helper must reject it.
    const { records, sources } = makeFixture({
      source_relationships: [{ source_id: TWN_TODDLER_SOURCE_ID, role: 'policy_compilation' }],
    });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/blocking role/);
  });
  it('throws when BW source_relationships carries a blocking role (reference_mining) on the expected source', () => {
    const { records, sources } = makeFixture({}, {
      source_relationships: [{ source_id: 'src-health-canada-pqra-v4-2024', role: 'reference_mining' }],
    });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/blocking role/);
  });
  it('throws when the HC PQRA v4.0 source the BW relies on is missing from sources.json', () => {
    const { records, sources } = makeFixture();
    const without = sources.filter((s) => s.source_id !== HC_PQRA_SOURCE_ID);
    expect(() => planPromotion(records, without, APPLY_OPTS)).toThrow(/BW source record not found/);
  });
  it('throws when the HC PQRA v4.0 source is not yet direct_source_verified', () => {
    const { records, sources } = makeFixture({}, {}, {}, { canonical_source_status: 'needs_direct_source_check' });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/not direct_source_verified/);
  });
  it('throws when the HC PQRA v4.0 source has drifted out of direct-current eligibility', () => {
    const { records, sources } = makeFixture({}, {}, {}, { currentness_status: 'needs_currentness_check' });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/not direct-current eligible/);
  });

  it('throws on a drifted pre-state for IR (qa_status superseded)', () => {
    const { records, sources } = makeFixture({ qa_status: 'superseded' });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/drifted\/partially-promoted/);
  });
  it('throws on a drifted pre-state for BW (qa_status superseded)', () => {
    const { records, sources } = makeFixture({}, { qa_status: 'superseded' });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/drifted\/partially-promoted/);
  });
  it('throws on a drifted source canonical_source_status', () => {
    const { records, sources } = makeFixture({}, {}, { canonical_source_status: 'not_applicable' });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/neither needs_direct_source_check/);
  });
  it('throws when the source role is policy_compilation', () => {
    const { records, sources } = makeFixture({}, {}, { calculator_source_role: 'policy_compilation' });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/policy_compilation\/reference_mining/);
  });
  it('throws when the source is not current', () => {
    const { records, sources } = makeFixture({}, {}, { currentness_status: 'superseded' });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/direct-current eligible/);
  });
  it('throws when the source is repo_metadata_only', () => {
    const { records, sources } = makeFixture({}, {}, { file_storage: 'repo_metadata_only' });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/direct-current eligible/);
  });
  it('throws when the source record is missing', () => {
    const { records, sources } = makeFixture();
    const filteredSources = sources.filter((s) => s.source_id !== TWN_TODDLER_SOURCE_ID);
    expect(() => planPromotion(records, filteredSources, APPLY_OPTS)).toThrow(/not found/);
  });
});

describe('promote-twn-foodweb-toddler: attestation guard', () => {
  it('rejects an approved IR record whose evidence is missing the owner attestation', () => {
    const unattested = {
      ...DONE_IR,
      evidence_items: DONE_IR.evidence_items.map((ev) => {
        const copy = { ...ev };
        delete copy.reviewed_by;
        delete copy.reviewed_at;
        return copy;
      }),
    };
    const { records, sources } = makeFixture(unattested, DONE_BW, { canonical_source_status: 'direct_source_verified' });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/drifted\/partially-promoted/);
  });
  it('rejects an approved BW record whose evidence is missing the owner attestation', () => {
    const unattested = {
      ...DONE_BW,
      evidence_items: DONE_BW.evidence_items.map((ev) => {
        const copy = { ...ev };
        delete copy.reviewed_by;
        delete copy.reviewed_at;
        return copy;
      }),
    };
    const { records, sources } = makeFixture(DONE_IR, unattested, { canonical_source_status: 'direct_source_verified' });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/drifted\/partially-promoted/);
  });
});

describe('promote-twn-foodweb-toddler: idempotency', () => {
  it('skips when all three records are already in target state', () => {
    const { records, sources } = makeFixture(
      DONE_IR, DONE_BW, { canonical_source_status: 'direct_source_verified' },
    );
    const plan = planPromotion(records, sources, APPLY_OPTS);
    expect(plan.promoteIr).toBe(false);
    expect(plan.promoteBw).toBe(false);
    expect(plan.promoteSource).toBe(false);
  });
  it('throws on a partially-promoted IR record (top-level done, evidence still needs_review)', () => {
    const { records, sources } = makeFixture(
      {
        qa_status: 'approved',
        evidence_support_status: 'approved_source_backed',
        canonical_source_status: 'direct_source_verified',
      },
      {},
      { canonical_source_status: 'direct_source_verified' },
    );
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/drifted\/partially-promoted/);
  });
  it('applyPromotion run twice is a no-op on the second run', () => {
    const { records, sources } = makeFixture();
    applyPromotion(records, sources, APPLY_OPTS);
    const second = applyPromotion(records, sources, APPLY_OPTS);
    expect(second.promoteIr).toBe(false);
    expect(second.promoteBw).toBe(false);
    expect(second.promoteSource).toBe(false);
  });
  it('on a locator-only re-run, returns sourceTouched=true and updates the url', () => {
    const { records, sources } = makeFixture(
      DONE_IR, DONE_BW,
      { canonical_source_status: 'direct_source_verified', url: '<placeholder>' },
    );
    const applied = applyPromotion(records, sources, { ...APPLY_OPTS, sourceUrl: 'https://example.com/twn_real.pdf' });
    expect(applied.promoteIr).toBe(false);
    expect(applied.promoteBw).toBe(false);
    expect(applied.promoteSource).toBe(false);
    expect(applied.sourceTouched).toBe(true);
    const s = sources.find((x) => x.source_id === TWN_TODDLER_SOURCE_ID);
    expect(s.url).toBe('https://example.com/twn_real.pdf');
  });
});

describe('promote-twn-foodweb-toddler: 2-record promotion + source', () => {
  it('flips IR qa + evidence + adds attestation + sets direct_source_verified', () => {
    const { records, sources } = makeFixture();
    applyPromotion(records, sources, APPLY_OPTS);
    const r = records.find((x) => x.parameter_value_id === TWN_TODDLER_IR_VALUE_ID);
    expect(r.qa_status).toBe('approved');
    expect(r.evidence_support_status).toBe('approved_source_backed');
    expect(r.canonical_source_status).toBe('direct_source_verified');
    expect(r.default_status).toBe('available_option');
    expect(r.value).toBe(0.094);
    const ev = r.evidence_items[0];
    expect(ev.qa_status).toBe('approved');
    expect(ev.reviewed_by).toBe('J. Nelson');
    expect(ev.reviewed_at).toBe('2026-06-14');
    const keys = Object.keys(ev);
    const qi = keys.indexOf('qa_status');
    expect(keys[qi + 1]).toBe('reviewed_by');
    expect(keys[qi + 2]).toBe('reviewed_at');
  });
  it('flips BW qa + evidence + adds attestation + sets direct_source_verified', () => {
    const { records, sources } = makeFixture();
    applyPromotion(records, sources, APPLY_OPTS);
    const r = records.find((x) => x.parameter_value_id === TWN_TODDLER_BW_VALUE_ID);
    expect(r.qa_status).toBe('approved');
    expect(r.evidence_support_status).toBe('approved_source_backed');
    expect(r.canonical_source_status).toBe('direct_source_verified');
    expect(r.default_status).toBe('available_option');
    expect(r.value).toBe(16.5);
    const ev = r.evidence_items[0];
    expect(ev.qa_status).toBe('approved');
    expect(ev.reviewed_by).toBe('J. Nelson');
    expect(ev.reviewed_at).toBe('2026-06-14');
  });
  it('promotes the TWN source to direct_source_verified', () => {
    const { records, sources } = makeFixture();
    applyPromotion(records, sources, APPLY_OPTS);
    const s = sources.find((x) => x.source_id === TWN_TODDLER_SOURCE_ID);
    expect(s.canonical_source_status).toBe('direct_source_verified');
  });
  it('sets the source url + zotero key + linked status from options', () => {
    const { records, sources } = makeFixture({}, {}, { url: null });
    applyPromotion(records, sources, { ...APPLY_OPTS, sourceUrl: 'https://example.com/twn.pdf', zoteroKey: 'ZK88' });
    const s = sources.find((x) => x.source_id === TWN_TODDLER_SOURCE_ID);
    expect(s.url).toBe('https://example.com/twn.pdf');
    expect(s.zotero_item_key).toBe('ZK88');
    expect(s.zotero_status).toBe('linked');
  });
  it('repairs a stale zotero_status when the key already matches', () => {
    const { records, sources } = makeFixture({}, {}, { zotero_item_key: 'TWNABC1', zotero_status: 'pending_owner_export' });
    const applied = applyPromotion(records, sources, { ...APPLY_OPTS, zoteroKey: 'TWNABC1' });
    const s = sources.find((x) => x.source_id === TWN_TODDLER_SOURCE_ID);
    expect(s.zotero_status).toBe('linked');
    expect(applied.sourceTouched).toBe(true);
  });
  it('stamps the applicability + uncertainty + review_notes on IR promotion (Evidence Library renders them verbatim)', () => {
    const { records, sources } = makeFixture({
      applicability: 'TWN BIWQO 2021 toddler IR. needs_review.',
    });
    applyPromotion(records, sources, APPLY_OPTS);
    const r = records.find((x) => x.parameter_value_id === TWN_TODDLER_IR_VALUE_ID);
    expect(r.applicability).toContain('PROMOTED to approved');
    expect(r.uncertainty).toContain('PROMOTED to approved');
    expect(r.review_notes).toContain('PROMOTED to approved');
  });
  it('stamps the applicability + uncertainty + review_notes on BW promotion', () => {
    const { records, sources } = makeFixture({}, {
      applicability: 'TWN BIWQO 2021 toddler BW. needs_review.',
    });
    applyPromotion(records, sources, APPLY_OPTS);
    const r = records.find((x) => x.parameter_value_id === TWN_TODDLER_BW_VALUE_ID);
    expect(r.applicability).toContain('PROMOTED to approved');
    expect(r.uncertainty).toContain('PROMOTED to approved');
    expect(r.review_notes).toContain('PROMOTED to approved');
  });
  it('does not double-stamp an already-stamped IR record', () => {
    const stamped = ' [PROMOTED to approved on 2026-06-14 by J. Nelson]';
    const { records, sources } = makeFixture(
      {
        ...DONE_IR,
        applicability: 'TWN toddler IR.' + stamped,
        uncertainty: 'secondary citation.' + stamped,
        review_notes: 'note.' + stamped,
      },
      DONE_BW,
      { canonical_source_status: 'direct_source_verified' },
    );
    const applied = applyPromotion(records, sources, APPLY_OPTS);
    expect(applied.irTouched).toBe(false);
    const r = records.find((x) => x.parameter_value_id === TWN_TODDLER_IR_VALUE_ID);
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
