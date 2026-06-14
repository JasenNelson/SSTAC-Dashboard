// Guards for the owner-run HC PQRA v4.0 residential-adult direct-contact promotion tool
// (promote-hc-pqra-adult.mjs). Plain ASCII only.
// Mirrors promote-hc-pqra-direct.test.mjs re-scoped to the 3 HC PQRA adult-receptor records.

import { describe, it, expect } from 'vitest';
import {
  HC_PQRA_ADULT_PROMOTION_VALUE_IDS,
  HC_PQRA_ADULT_PROMOTION_SOURCE_ID,
  parseArgs,
  validateApplyOptions,
  planPromotion,
  applyPromotion,
} from '../promote-hc-pqra-adult.mjs';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// Minimal per-record fixtures. Each is the exact pre-promotion state expected by planPromotion.
const BASE_VALUE_FIXTURES = [
  // 0: pv-hc-pqra-v4-2024-bw-adult-ca
  {
    parameter_value_id: 'pv-hc-pqra-v4-2024-bw-adult-ca',
    substance_key: 'generic',
    pathway: 'human-health-direct',
    input_key: 'BW_kg',
    value: 70.7,
    unit: 'kg',
    value_type: 'single_value',
    default_status: 'available_option',
    evidence_support_status: 'pending_source_locator',
    qa_status: 'needs_review',
    canonical_source_status: 'needs_direct_source_check',
    candidate_group_id: 'human-health-direct__generic__BW_kg__general',
    jurisdiction: 'general',
    source_ids: [HC_PQRA_ADULT_PROMOTION_SOURCE_ID],
    applicability: 'HC PQRA v4.0 adult body weight. needs_review candidate.',
    uncertainty: 'Pending direct-source verification.',
    review_notes: 'HC PQRA v4.0 Appendix E body weight (adult, 70.7 kg).',
    evidence_items: [{
      source_id: HC_PQRA_ADULT_PROMOTION_SOURCE_ID,
      locator: 'Appendix E, adult column',
      value_text: 'adult: 70.7 kg',
      extraction_method: 'manual_source_extraction',
      extracted_by: 'claude-fable-5',
      extracted_at: '2026-06-12',
      qa_status: 'needs_review',
      evidence_id: 'ev-pv-hc-pqra-v4-2024-bw-adult-ca-1',
      locator_type: 'source_table',
    }],
    source_relationships: [{
      source_id: HC_PQRA_ADULT_PROMOTION_SOURCE_ID,
      role: 'canonical_candidate',
      note: 'HC PQRA v4.0 Appendix E.',
    }],
  },
  // 1: pv-hc-pqra-v4-2024-ir-sed-general-ca
  {
    parameter_value_id: 'pv-hc-pqra-v4-2024-ir-sed-general-ca',
    substance_key: 'generic',
    pathway: 'human-health-direct',
    input_key: 'IR_sed_mg_per_day',
    value: 20,
    unit: 'mg/day',
    value_type: 'single_value',
    default_status: 'available_option',
    evidence_support_status: 'pending_source_locator',
    qa_status: 'needs_review',
    canonical_source_status: 'needs_direct_source_check',
    candidate_group_id: 'human-health-direct__generic__IR_sed_mg_per_day__general',
    jurisdiction: 'general',
    source_ids: [HC_PQRA_ADULT_PROMOTION_SOURCE_ID],
    applicability: 'HC PQRA v4.0 general-population incidental ingestion IR_sed. needs_review candidate.',
    uncertainty: 'Pending direct-source verification.',
    review_notes: 'HC PQRA v4.0 Appendix E IR_sed general population 20 mg/day.',
    evidence_items: [{
      source_id: HC_PQRA_ADULT_PROMOTION_SOURCE_ID,
      qa_status: 'needs_review',
      evidence_id: 'ev-pv-hc-pqra-v4-2024-ir-sed-general-ca-1',
    }],
    source_relationships: [{
      source_id: HC_PQRA_ADULT_PROMOTION_SOURCE_ID,
      role: 'canonical_candidate',
      note: 'HC PQRA v4.0 Appendix E.',
    }],
  },
  // 2: pv-hc-pqra-v4-2024-sa-total-adult-ca
  {
    parameter_value_id: 'pv-hc-pqra-v4-2024-sa-total-adult-ca',
    substance_key: 'generic',
    pathway: 'human-health-direct',
    input_key: 'SA_cm2',
    value: 17640,
    unit: 'cm2',
    value_type: 'single_value',
    default_status: 'available_option',
    evidence_support_status: 'pending_source_locator',
    qa_status: 'needs_review',
    canonical_source_status: 'needs_direct_source_check',
    candidate_group_id: 'human-health-direct__generic__SA_cm2__general',
    jurisdiction: 'general',
    source_ids: [HC_PQRA_ADULT_PROMOTION_SOURCE_ID],
    applicability: 'HC PQRA v4.0 adult total-body skin surface area. needs_review candidate.',
    uncertainty: 'Pending direct-source verification.',
    review_notes: 'HC PQRA v4.0 Appendix E adult SA 17640 cm2.',
    evidence_items: [{
      source_id: HC_PQRA_ADULT_PROMOTION_SOURCE_ID,
      qa_status: 'needs_review',
      evidence_id: 'ev-pv-hc-pqra-v4-2024-sa-total-adult-ca-1',
    }],
    source_relationships: [{
      source_id: HC_PQRA_ADULT_PROMOTION_SOURCE_ID,
      role: 'canonical_candidate',
      note: 'HC PQRA v4.0 Appendix E.',
    }],
  },
];

// Source fixture: canonical pre-promotion state (canonical_source_status ABSENT as on the real record).
function makeSourceRecord(overrides = {}) {
  return {
    source_id: HC_PQRA_ADULT_PROMOTION_SOURCE_ID,
    short_citation: 'Health Canada PQRA v4.0, 2024',
    url: 'https://www.canada.ca/en/health-canada/services/environmental-workplace-health/reports-publications/contaminated-sites/federal-contaminated-site-risk-assessment-canada-part-guidance-human-health-preliminary-quantitative-risk-assessment-pqra.html',
    zotero_item_key: 'SFH7ARKQ',
    zotero_status: 'linked',
    notes: 'Current federal PQRA guidance.',
    // canonical_source_status intentionally absent (mirrors real record)
    currentness_status: 'current',
    file_storage: 'zotero_or_external',
    ...overrides,
  };
}

// Build a full fixture with all 3 value records + 1 untouched extra + the source.
function makeFixture(valueOverrides = {}, sourceOverrides = {}) {
  // Clone all 3 base fixtures, apply per-id overrides if provided.
  const records = BASE_VALUE_FIXTURES.map((base) => {
    const ov = valueOverrides[base.parameter_value_id] || {};
    return { ...JSON.parse(JSON.stringify(base)), ...ov };
  });
  // Add an untouched bystander record.
  records.push({
    parameter_value_id: 'pv-other-untouched',
    substance_key: 'generic',
    pathway: 'human-health-direct',
    input_key: 'BW_kg',
    value: 99,
    unit: 'kg',
    value_type: 'single_value',
    default_status: 'available_option',
    evidence_support_status: 'pending_source_locator',
    qa_status: 'needs_review',
    canonical_source_status: 'needs_direct_source_check',
    candidate_group_id: 'human-health-direct__generic__BW_kg__general',
    jurisdiction: 'general',
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
const APPLY_OPTS = { reviewer: 'J. Nelson', date: '2026-06-12', sourceUrl: null, zoteroKey: null };

// Fully-promoted state for a single value record.
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
      reviewed_at: '2026-06-12',
    })),
  };
}

// Build a valueOverrides map where all 3 records are in the done state.
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

describe('promote-hc-pqra-adult: scope constants', () => {
  it('exports exactly 3 value IDs', () => {
    expect(HC_PQRA_ADULT_PROMOTION_VALUE_IDS).toHaveLength(3);
  });
  it('lists the correct value IDs in order', () => {
    expect(HC_PQRA_ADULT_PROMOTION_VALUE_IDS[0]).toBe('pv-hc-pqra-v4-2024-bw-adult-ca');
    expect(HC_PQRA_ADULT_PROMOTION_VALUE_IDS[1]).toBe('pv-hc-pqra-v4-2024-ir-sed-general-ca');
    expect(HC_PQRA_ADULT_PROMOTION_VALUE_IDS[2]).toBe('pv-hc-pqra-v4-2024-sa-total-adult-ca');
  });
  it('targets the correct source', () => {
    expect(HC_PQRA_ADULT_PROMOTION_SOURCE_ID).toBe('src-health-canada-pqra-v4-2024');
  });
});

describe('promote-hc-pqra-adult: parseArgs', () => {
  it('parses flags and values', () => {
    const a = parseArgs(['node', 's', '--reviewer', 'J. Nelson', '--date', '2026-06-12',
      '--source-url', 'https://canada.ca/x', '--zotero-key', 'SFH7ARKQ', '--apply']);
    expect(a).toMatchObject({
      reviewer: 'J. Nelson', date: '2026-06-12', sourceUrl: 'https://canada.ca/x',
      zoteroKey: 'SFH7ARKQ', apply: true,
    });
  });
  it('defaults to a dry run', () => {
    expect(parseArgs(['node', 's']).apply).toBe(false);
  });
  it('throws on unknown argument', () => {
    expect(() => parseArgs(['node', 's', '--bogus'])).toThrow(/Unknown argument/);
  });
});

describe('promote-hc-pqra-adult: validateApplyOptions', () => {
  it('accepts a complete attestation', () => {
    expect(() => validateApplyOptions(APPLY_OPTS)).not.toThrow();
  });
  it('requires reviewer', () => {
    expect(() => validateApplyOptions({ ...APPLY_OPTS, reviewer: '' })).toThrow(/reviewer/);
  });
  it('requires a YYYY-MM-DD date', () => {
    expect(() => validateApplyOptions({ ...APPLY_OPTS, date: '2026/06/12' })).toThrow(/date/);
  });
});

describe('promote-hc-pqra-adult: planPromotion -- happy path', () => {
  it('plans all 3 values to promote + source (absent canonical_source_status = promotable)', () => {
    const { records, sources } = makeFixture();
    const plan = planPromotion(records, sources, APPLY_OPTS);
    expect(plan.valueResults).toHaveLength(3);
    expect(plan.valueResults.every((vr) => vr.promoteValue)).toBe(true);
    expect(plan.promoteSource).toBe(true);
  });
  it('treats needs_direct_source_check on source as promotable', () => {
    const { records, sources } = makeFixture({}, { canonical_source_status: 'needs_direct_source_check' });
    const plan = planPromotion(records, sources, APPLY_OPTS);
    expect(plan.promoteSource).toBe(true);
  });
  it('skips source when already direct_source_verified', () => {
    const { records, sources } = makeFixture({}, { canonical_source_status: 'direct_source_verified' });
    const plan = planPromotion(records, sources, APPLY_OPTS);
    expect(plan.promoteSource).toBe(false);
    expect(plan.sourceAlreadyDone).toBe(true);
  });
});

describe('promote-hc-pqra-adult: planPromotion -- fail-closed preconditions', () => {
  it('throws when a value record is missing', () => {
    const { records, sources } = makeFixture();
    const filtered = records.filter((r) => r.parameter_value_id !== 'pv-hc-pqra-v4-2024-bw-adult-ca');
    expect(() => planPromotion(filtered, sources, APPLY_OPTS)).toThrow(/not found/);
  });
  it('throws when a value has no evidence_items', () => {
    const { records, sources } = makeFixture({
      'pv-hc-pqra-v4-2024-bw-adult-ca': { evidence_items: [] },
    });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/no evidence_items/);
  });
  it('throws on identity mismatch (wrong value)', () => {
    const { records, sources } = makeFixture({
      'pv-hc-pqra-v4-2024-bw-adult-ca': { value: 99 },
    });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/expected frame-eligible identity/);
  });
  it('throws on identity mismatch (wrong jurisdiction)', () => {
    const { records, sources } = makeFixture({
      'pv-hc-pqra-v4-2024-sa-total-adult-ca': { jurisdiction: 'BC' },
    });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/expected frame-eligible identity/);
  });
  it('throws on identity mismatch (wrong unit)', () => {
    const { records, sources } = makeFixture({
      'pv-hc-pqra-v4-2024-ir-sed-general-ca': { unit: 'g/day' },
    });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/expected frame-eligible identity/);
  });
  it('throws when source_ids does not match the HC PQRA source', () => {
    const { records, sources } = makeFixture({
      'pv-hc-pqra-v4-2024-bw-adult-ca': { source_ids: ['src-wrong'] },
    });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/source_ids must be EXACTLY/);
  });
  it('throws when source_ids has a second linked source (under-block risk)', () => {
    const { records, sources } = makeFixture({
      'pv-hc-pqra-v4-2024-bw-adult-ca': { source_ids: [HC_PQRA_ADULT_PROMOTION_SOURCE_ID, 'src-extra'] },
    });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/source_ids must be EXACTLY/);
  });
  it('throws on a drifted pre-state (qa_status superseded)', () => {
    const { records, sources } = makeFixture({
      'pv-hc-pqra-v4-2024-sa-total-adult-ca': { qa_status: 'superseded' },
    });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/expected pre-promotion state/);
  });
  it('throws on a drifted source canonical_source_status', () => {
    const { records, sources } = makeFixture({}, { canonical_source_status: 'not_applicable' });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/neither needs_direct_source_check\/absent/);
  });
  it('throws when the source role is policy_compilation', () => {
    // Inject via source_relationships on a value record.
    const { records, sources } = makeFixture({
      'pv-hc-pqra-v4-2024-bw-adult-ca': {
        source_relationships: [{ source_id: HC_PQRA_ADULT_PROMOTION_SOURCE_ID, role: 'policy_compilation' }],
      },
    });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/policy_compilation\/reference_mining/);
  });
  it('throws when a source_relationships role is reference_mining', () => {
    const { records, sources } = makeFixture({
      'pv-hc-pqra-v4-2024-ir-sed-general-ca': {
        source_relationships: [{ source_id: HC_PQRA_ADULT_PROMOTION_SOURCE_ID, role: 'reference_mining' }],
      },
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
    const filteredSrc = sources.filter((s) => s.source_id !== HC_PQRA_ADULT_PROMOTION_SOURCE_ID);
    expect(() => planPromotion(records, filteredSrc, APPLY_OPTS)).toThrow(/not found in sources.json/);
  });
  it('throws when evidence_items[0].source_id is a stale foreign reference (nested-source guard)', () => {
    const target = HC_PQRA_ADULT_PROMOTION_VALUE_IDS[0];
    const base = BASE_VALUE_FIXTURES[0];
    const staleEv = { ...base.evidence_items[0], source_id: 'src-FOREIGN-stale' };
    const { records, sources } = makeFixture({ [target]: { evidence_items: [staleEv] } });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/nested provenance source/);
  });
});

describe('promote-hc-pqra-adult: idempotency', () => {
  it('skips all value records + source when everything is already done', () => {
    const { records, sources } = makeFixture(
      allDoneOverrides(),
      { canonical_source_status: 'direct_source_verified' },
    );
    const plan = planPromotion(records, sources, APPLY_OPTS);
    expect(plan.valueResults.every((vr) => !vr.promoteValue && vr.valueAlreadyDone)).toBe(true);
    expect(plan.promoteSource).toBe(false);
  });
  it('rejects an approved record whose evidence is missing the owner attestation (reviewed_by/reviewed_at)', () => {
    // Attestation guard (uniform backport 2026-06-13): an approved-but-UNATTESTED evidence item must
    // NOT be accepted as "already done" -- it is a drift that fails closed, so re-running cannot
    // silently skip a record that never carried the owner attestation.
    const target = HC_PQRA_ADULT_PROMOTION_VALUE_IDS[0];
    const base = BASE_VALUE_FIXTURES.find((b) => b.parameter_value_id === target);
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
    const { records, sources } = makeFixture({ [target]: unattested });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/drifted\/partially-promoted/);
  });
  it('throws on a partially-promoted record (top-level done, evidence still needs_review)', () => {
    const { records, sources } = makeFixture({
      'pv-hc-pqra-v4-2024-bw-adult-ca': {
        qa_status: 'approved',
        evidence_support_status: 'approved_source_backed',
        canonical_source_status: 'direct_source_verified',
        // evidence_items still needs_review (partial drift)
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
  it('on a locator-only re-run with all done, returns sourceTouched=true and updates the url', () => {
    const { records, sources } = makeFixture(
      allDoneOverrides(),
      { canonical_source_status: 'direct_source_verified', url: '<placeholder>' },
    );
    const applied = applyPromotion(records, sources, { ...APPLY_OPTS, sourceUrl: 'https://canada.ca/real.pdf' });
    expect(applied.valueResults.every((vr) => !vr.promoteValue)).toBe(true);
    expect(applied.sourceTouched).toBe(true);
    const s = sources.find((x) => x.source_id === HC_PQRA_ADULT_PROMOTION_SOURCE_ID);
    expect(s.url).toBe('https://canada.ca/real.pdf');
  });
});

describe('promote-hc-pqra-adult: field edits on each of the 3 value records', () => {
  it('flips qa + evidence + adds attestation on all 3 records', () => {
    const { records, sources } = makeFixture();
    applyPromotion(records, sources, APPLY_OPTS);
    for (const valueId of HC_PQRA_ADULT_PROMOTION_VALUE_IDS) {
      const r = records.find((x) => x.parameter_value_id === valueId);
      expect(r.qa_status).toBe('approved');
      expect(r.evidence_support_status).toBe('approved_source_backed');
      expect(r.canonical_source_status).toBe('direct_source_verified');
      expect(r.default_status).toBe('available_option'); // never promoted to a default
      const ev = r.evidence_items[0];
      expect(ev.qa_status).toBe('approved');
      expect(ev.reviewed_by).toBe('J. Nelson');
      expect(ev.reviewed_at).toBe('2026-06-12');
      // reviewed_by and reviewed_at must be immediately after qa_status in the evidence item.
      const keys = Object.keys(ev);
      const qi = keys.indexOf('qa_status');
      expect(keys[qi + 1]).toBe('reviewed_by');
      expect(keys[qi + 2]).toBe('reviewed_at');
    }
  });
  it('promotes the source and ADDS canonical_source_status when absent', () => {
    const { records, sources } = makeFixture(); // source has no canonical_source_status
    const applied = applyPromotion(records, sources, APPLY_OPTS);
    expect(applied.promoteSource).toBe(true);
    const s = sources.find((x) => x.source_id === HC_PQRA_ADULT_PROMOTION_SOURCE_ID);
    expect(s.canonical_source_status).toBe('direct_source_verified');
  });
  it('stamps provenance fields on all 3 records on fresh promotion', () => {
    const { records, sources } = makeFixture();
    applyPromotion(records, sources, APPLY_OPTS);
    for (const valueId of HC_PQRA_ADULT_PROMOTION_VALUE_IDS) {
      const r = records.find((x) => x.parameter_value_id === valueId);
      expect(r.applicability).toContain('PROMOTED to approved');
      expect(r.uncertainty).toContain('PROMOTED to approved');
      expect(r.review_notes).toContain('PROMOTED to approved');
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
    const stamped = ' [PROMOTED to approved on 2026-06-12 by J. Nelson]';
    const doneOverrides = {};
    for (const base of BASE_VALUE_FIXTURES) {
      doneOverrides[base.parameter_value_id] = {
        ...doneValue(base),
        applicability: base.applicability + stamped,
        uncertainty: base.uncertainty + stamped,
        review_notes: base.review_notes + stamped,
      };
    }
    const { records, sources } = makeFixture(doneOverrides, { canonical_source_status: 'direct_source_verified' });
    const applied = applyPromotion(records, sources, APPLY_OPTS);
    expect(applied.valueTouchedFlags.every((t) => t === false)).toBe(true);
    for (const valueId of HC_PQRA_ADULT_PROMOTION_VALUE_IDS) {
      const r = records.find((x) => x.parameter_value_id === valueId);
      expect(r.applicability.match(/PROMOTED to approved/g)).toHaveLength(1);
    }
  });
  it('repairs a missing provenance stamp on an already-approved record (valueTouched=true)', () => {
    const doneOverrides = {};
    for (const base of BASE_VALUE_FIXTURES) {
      doneOverrides[base.parameter_value_id] = {
        ...doneValue(base),
        // applicability missing stamp; uncertainty + review_notes already stamped
        applicability: base.applicability,
        uncertainty: base.uncertainty + ' [PROMOTED to approved on 2026-06-12 by J. Nelson]',
        review_notes: base.review_notes + ' [PROMOTED to approved on 2026-06-12 by J. Nelson]',
      };
    }
    const { records, sources } = makeFixture(doneOverrides, { canonical_source_status: 'direct_source_verified' });
    const applied = applyPromotion(records, sources, APPLY_OPTS);
    expect(applied.valueTouchedFlags.every((t) => t === true)).toBe(true);
    for (const valueId of HC_PQRA_ADULT_PROMOTION_VALUE_IDS) {
      const r = records.find((x) => x.parameter_value_id === valueId);
      expect(r.applicability).toContain('PROMOTED to approved');
      // uncertainty and review_notes should still have only 1 stamp
      expect(r.uncertainty.match(/PROMOTED to approved/g)).toHaveLength(1);
    }
  });
  it('repairs a stale zotero_status when the key already matches', () => {
    const { records, sources } = makeFixture(
      allDoneOverrides(),
      { canonical_source_status: 'direct_source_verified', zotero_item_key: 'SFH7ARKQ', zotero_status: 'pending_owner_export' },
    );
    const applied = applyPromotion(records, sources, { ...APPLY_OPTS, zoteroKey: 'SFH7ARKQ' });
    const s = sources.find((x) => x.source_id === HC_PQRA_ADULT_PROMOTION_SOURCE_ID);
    expect(s.zotero_status).toBe('linked');
    expect(applied.sourceTouched).toBe(true);
  });
});
