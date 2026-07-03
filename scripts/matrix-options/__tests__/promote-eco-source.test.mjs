// Tests for promote-eco-source.mjs (Step-6 4B eco promotion helper).
// Plain ASCII only (code point <= 127). These exercise the pure plan/apply functions on synthetic
// in-memory catalogs -- they NEVER touch the real eco_values.json / sources.json.

import { describe, it, expect } from 'vitest';
import {
  parseArgs,
  validateOptions,
  planPromotion,
  applyPromotion,
  ECO_SOURCE_CONFIG,
} from '../promote-eco-source.mjs';

const CCME = 'src-ccme-cwqg-aquatic-life'; // expectedCount 1, eco-direct-eqp / fcv_ug_per_L

// Build a fresh needs_review eco row for the CCME source (the 1-row batch -> easy fixtures).
function freshRow(id = 'pv-eco-chloroform-direct-fcv-ccme') {
  return {
    parameter_value_id: id,
    substance_key: 'chloroform',
    pathway: 'eco-direct-eqp',
    input_key: 'fcv_ug_per_L',
    value: 1.8,
    value_type: 'single_value',
    jurisdiction: 'Canada_federal',
    default_status: 'available_option',
    qa_status: 'needs_review',
    evidence_support_status: 'pending_source_locator',
    canonical_source_status: 'needs_direct_source_check',
    source_ids: [CCME],
    applicability: 'CCME candidate; needs review before default use.',
    review_notes: 'CCME ecological candidate. qa_status=needs_review.',
    uncertainty: null,
    source_relationships: [{ source_id: CCME, role: 'canonical_candidate', note: 'CCME is the source.' }],
    evidence_items: [{ source_id: CCME, locator: 'CCME factsheet Table 1', qa_status: 'needs_review', evidence_id: 'ev-1' }],
  };
}

function freshSource(id = CCME) {
  return {
    source_id: id,
    short_citation: 'CCME CWQG',
    url: 'https://ccme.ca/en/res/halogenated-methanes-trichloromethane-...pdf',
    calculator_source_role: 'canonical_candidate',
    file_storage: 'zotero_or_external',
    currentness_status: 'needs_currentness_check',
    canonical_source_status: 'needs_direct_source_check',
    notes: 'CCME freshwater interim aquatic-life guideline.',
  };
}

const OPTS = { source: CCME, reviewer: 'J. Nelson', date: '2026-06-19', apply: true };

describe('parseArgs', () => {
  it('parses --source/--reviewer/--date/--apply', () => {
    const a = parseArgs(['node', 'p', '--source', CCME, '--reviewer', 'J. Nelson', '--date', '2026-06-19', '--apply']);
    expect(a).toMatchObject({ source: CCME, reviewer: 'J. Nelson', date: '2026-06-19', apply: true });
  });
  it('defaults apply=false (dry-run)', () => {
    expect(parseArgs(['node', 'p', '--source', CCME]).apply).toBe(false);
  });
  it('throws on an unknown flag', () => {
    expect(() => parseArgs(['node', 'p', '--nope'])).toThrow(/Unknown argument/);
  });
});

describe('validateOptions', () => {
  it('requires a known --source', () => {
    expect(() => validateOptions({ source: 'src-bogus' }, false)).toThrow(/--source must be one of/);
  });
  it('requires reviewer + date for --apply', () => {
    expect(() => validateOptions({ source: CCME }, true)).toThrow(/--reviewer[\s\S]*--date/);
  });
  it('accepts a valid apply attestation', () => {
    expect(() => validateOptions(OPTS, true)).not.toThrow();
  });
  it('dry-run needs only the source (no attestation)', () => {
    expect(() => validateOptions({ source: CCME }, false)).not.toThrow();
  });
});

describe('planPromotion (fail-closed)', () => {
  it('plans the expected-count batch in the pre-promotion state', () => {
    const plan = planPromotion([freshRow()], [freshSource()], OPTS);
    expect(plan.rowResults).toHaveLength(1);
    expect(plan.rowResults[0].promote).toBe(true);
    expect(plan.promoteSource).toBe(true);
  });
  it('FAILS CLOSED when the per-source row count != expectedCount', () => {
    expect(() => planPromotion([freshRow('a'), freshRow('b')], [freshSource()], OPTS))
      .toThrow(/expected EXACTLY 1 single-source rows/);
  });
  it('FAILS CLOSED on a row with a 2nd source_id (cross-linked guard fires first)', () => {
    const r = freshRow();
    r.source_ids = [CCME, 'src-other'];
    // The cross-linked guard rejects a row that references this source alongside another, BEFORE the
    // single-source filter could silently drop it.
    expect(() => planPromotion([r], [freshSource()], OPTS)).toThrow(/reference source[\s\S]*alongside other sources/);
  });
  it('FAILS CLOSED on a stale nested evidence source_id', () => {
    const r = freshRow();
    r.evidence_items[0].source_id = 'src-stale';
    expect(() => planPromotion([r], [freshSource()], OPTS)).toThrow(/nested provenance source ref/);
  });
  it('FAILS CLOSED on a drifted/partial row (qa approved but evidence needs_review)', () => {
    const r = freshRow();
    r.qa_status = 'approved';
    expect(() => planPromotion([r], [freshSource()], OPTS)).toThrow(/neither the expected pre-promotion/);
  });
  it('FAILS CLOSED on a drifted source (currentness not promotable/done)', () => {
    const s = freshSource();
    s.currentness_status = 'stale_unknown';
    expect(() => planPromotion([freshRow()], [s], OPTS)).toThrow(/partial\/drifted pin state/);
  });
  it('FAILS CLOSED on a PARTIAL source pin (currentness current but canonical still needs-check)', () => {
    const s = freshSource();
    s.currentness_status = 'current'; // flipped...
    s.canonical_source_status = 'needs_direct_source_check'; // ...but canonical not -> interrupted
    expect(() => planPromotion([freshRow()], [s], OPTS)).toThrow(/partial\/drifted pin state/);
  });
  it('FAILS CLOSED on a source with NO durable locator (no url + no zotero key)', () => {
    const s = freshSource();
    delete s.url;
    expect(() => planPromotion([freshRow()], [s], OPTS)).toThrow(/no durable locator/);
  });
  it('FAILS CLOSED on a row that is already a default (default_status != available_option)', () => {
    const r = freshRow();
    r.default_status = 'current_default';
    expect(() => planPromotion([r], [freshSource()], OPTS)).toThrow(/default_status[\s\S]*available_option/);
  });
  it('FAILS CLOSED on a wrong value_type row', () => {
    const r = freshRow();
    r.value_type = 'range';
    expect(() => planPromotion([r], [freshSource()], OPTS)).toThrow(/value_type[\s\S]*single_value/);
  });
  it('FAILS CLOSED on a cross-linked multi-source row referencing this source', () => {
    // expectedCount single-source rows PLUS an extra row that includes CCME alongside another source.
    const single = freshRow('pv-single');
    const crossed = freshRow('pv-crossed');
    crossed.source_ids = [CCME, 'src-other'];
    expect(() => planPromotion([single, crossed], [freshSource()], OPTS))
      .toThrow(/reference source[\s\S]*alongside other sources/);
  });
  it('FAILS CLOSED on a non-canonical source role', () => {
    const s = freshSource();
    s.calculator_source_role = 'reference_mining';
    expect(() => planPromotion([freshRow()], [s], OPTS)).toThrow(/calculator_source_role[\s\S]*not canonical_candidate/);
  });
  it('FAILS CLOSED on a repo_metadata_only source', () => {
    const s = freshSource();
    s.file_storage = 'repo_metadata_only';
    expect(() => planPromotion([freshRow()], [s], OPTS)).toThrow(/repo_metadata_only/);
  });
  it('FAILS CLOSED on a blocked source_relationships role', () => {
    const r = freshRow();
    r.source_relationships[0].role = 'policy_compilation';
    expect(() => planPromotion([r], [freshSource()], OPTS)).toThrow(/blocked source_relationships role/);
  });
  it('accepts the ESB/FCSAP shape: canonical_source_status ABSENT + role absent (defaults canonical)', () => {
    const r = freshRow();
    r.canonical_source_status = 'needs_direct_source_check';
    const s = freshSource();
    delete s.calculator_source_role; // absent -> defaults to canonical_candidate
    delete s.canonical_source_status; // absent -> promotable (css == null accepted)
    const plan = planPromotion([r], [s], OPTS);
    expect(plan.promoteSource).toBe(true);
    expect(plan.rowResults[0].promote).toBe(true);
  });
  it('treats a fully-approved batch as alreadyDone (idempotent plan)', () => {
    const r = freshRow();
    r.qa_status = 'approved';
    r.evidence_support_status = 'approved_source_backed';
    r.canonical_source_status = 'direct_source_verified';
    r.evidence_items = [{ ...r.evidence_items[0], qa_status: 'approved', reviewed_by: 'J. Nelson', reviewed_at: '2026-06-19' }];
    const s = freshSource();
    s.currentness_status = 'current';
    s.canonical_source_status = 'direct_source_verified';
    const plan = planPromotion([r], [s], OPTS);
    expect(plan.rowResults[0].alreadyDone).toBe(true);
    expect(plan.promoteSource).toBe(false);
  });
});

describe('applyPromotion', () => {
  it('promotes the row (status flips + evidence attestation + prose stamp) and pins the source', () => {
    const rows = [freshRow()];
    const sources = [freshSource()];
    const res = applyPromotion(rows, sources, OPTS);
    expect(res.promoted).toBe(1);
    const r = rows[0];
    expect(r.qa_status).toBe('approved');
    expect(r.evidence_support_status).toBe('approved_source_backed');
    expect(r.canonical_source_status).toBe('direct_source_verified');
    expect(r.default_status).toBe('available_option'); // UNCHANGED
    expect(r.evidence_items[0]).toMatchObject({ qa_status: 'approved', reviewed_by: 'J. Nelson', reviewed_at: '2026-06-19' });
    expect(r.applicability).toMatch(/PROMOTED to approved/);
    expect(r.review_notes).toMatch(/PROMOTED to approved/);
    expect(r.source_relationships[0].note).toMatch(/PROMOTED to approved/);
    // source pinned
    expect(sources[0].canonical_source_status).toBe('direct_source_verified');
    expect(sources[0].currentness_status).toBe('current');
    expect(sources[0].notes).toMatch(/Source promoted to direct_source_verified/);
  });
  it('is IDEMPOTENT: re-applying does not double-stamp or change statuses', () => {
    const rows = [freshRow()];
    const sources = [freshSource()];
    applyPromotion(rows, sources, OPTS);
    const afterFirst = JSON.parse(JSON.stringify({ rows, sources }));
    const res2 = applyPromotion(rows, sources, OPTS);
    expect(res2.promoted).toBe(0); // already approved
    // no second stamp appended
    expect((rows[0].applicability.match(/PROMOTED to approved/g) || []).length).toBe(1);
    expect((sources[0].notes.match(/Source promoted to direct_source_verified/g) || []).length).toBe(1);
    expect({ rows, sources }).toEqual(afterFirst);
  });
});

describe('ECO_SOURCE_CONFIG', () => {
  it('covers the 5 eco sources with the frozen 99-row counts (32+19+45+1+2)', () => {
    // 2026-07-03: +1 source (src-ccme-wildlife-trv-mehg, expectedCount 2) -- the CCME methylmercury
    // wildlife TDIs (mammal 0.022 + bird 0.031 mg/kg-bw/day) added to eco-food-bsaf; 97 -> 99.
    const counts = Object.values(ECO_SOURCE_CONFIG).map((c) => c.expectedCount);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(99);
    expect(Object.keys(ECO_SOURCE_CONFIG)).toHaveLength(5);
  });
});
