// Guards for the owner-run HC PQRA v4.0 commercial/industrial worker direct-contact promotion tool
// (promote-hc-pqra-worker.mjs). Plain ASCII only.
// Mirrors promote-hc-pqra-adult.test.mjs re-scoped to the 5 HC PQRA worker-receptor records.

import { describe, it, expect } from 'vitest';
import {
  HC_PQRA_WORKER_PROMOTION_VALUE_IDS,
  HC_PQRA_WORKER_PROMOTION_SOURCE_ID,
  parseArgs,
  validateApplyOptions,
  planPromotion,
  applyPromotion,
} from '../promote-hc-pqra-worker.mjs';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// Minimal per-record fixtures. Each is the exact pre-promotion state expected by planPromotion.
const BASE_VALUE_FIXTURES = [
  // 0: pv-hc-pqra-v4-2024-ef-commercial-ca
  {
    parameter_value_id: 'pv-hc-pqra-v4-2024-ef-commercial-ca',
    substance_key: 'generic',
    pathway: 'human-health-direct',
    input_key: 'EF_days_per_year',
    value: 240,
    unit: 'days/year',
    value_type: 'single_value',
    default_status: 'available_option',
    evidence_support_status: 'pending_source_locator',
    qa_status: 'needs_review',
    canonical_source_status: 'needs_direct_source_check',
    candidate_group_id: 'human-health-direct__generic__EF_days_per_year__general',
    jurisdiction: 'general',
    source_ids: [HC_PQRA_WORKER_PROMOTION_SOURCE_ID],
    applicability: 'HC PQRA v4.0 commercial/industrial worker exposure frequency. needs_review candidate.',
    uncertainty: 'Pending direct-source verification.',
    review_notes: 'HC PQRA v4.0 Table 2 EF commercial/industrial 240 days/yr (5 d/wk x 48 wk/yr).',
    evidence_items: [{
      source_id: HC_PQRA_WORKER_PROMOTION_SOURCE_ID,
      locator: 'Table 2, commercial/industrial column',
      value_text: 'commercial: 240 days/yr',
      extraction_method: 'manual_source_extraction',
      extracted_by: 'claude-sonnet-4-6',
      extracted_at: '2026-06-13',
      qa_status: 'needs_review',
      evidence_id: 'ev-pv-hc-pqra-v4-2024-ef-commercial-ca-1',
      locator_type: 'source_table',
    }],
    source_relationships: [{
      source_id: HC_PQRA_WORKER_PROMOTION_SOURCE_ID,
      role: 'canonical_candidate',
      note: 'HC PQRA v4.0 Table 2.',
    }],
  },
  // 1: pv-hc-pqra-v4-2024-ed-commercial-ca
  {
    parameter_value_id: 'pv-hc-pqra-v4-2024-ed-commercial-ca',
    substance_key: 'generic',
    pathway: 'human-health-direct',
    input_key: 'ED_years',
    value: 35,
    unit: 'years',
    value_type: 'single_value',
    default_status: 'available_option',
    evidence_support_status: 'pending_source_locator',
    qa_status: 'needs_review',
    canonical_source_status: 'needs_direct_source_check',
    candidate_group_id: 'human-health-direct__generic__ED_years__general',
    jurisdiction: 'general',
    source_ids: [HC_PQRA_WORKER_PROMOTION_SOURCE_ID],
    applicability: 'HC PQRA v4.0 commercial/industrial worker exposure duration. needs_review candidate.',
    uncertainty: 'Pending direct-source verification.',
    review_notes: 'HC PQRA v4.0 Table 2 ED commercial/industrial 35 years.',
    evidence_items: [{
      source_id: HC_PQRA_WORKER_PROMOTION_SOURCE_ID,
      qa_status: 'needs_review',
      evidence_id: 'ev-pv-hc-pqra-v4-2024-ed-commercial-ca-1',
    }],
    source_relationships: [{
      source_id: HC_PQRA_WORKER_PROMOTION_SOURCE_ID,
      role: 'canonical_candidate',
      note: 'HC PQRA v4.0 Table 2.',
    }],
  },
  // 2: pv-hc-pqra-v4-2024-ir-sed-worker-ca
  {
    parameter_value_id: 'pv-hc-pqra-v4-2024-ir-sed-worker-ca',
    substance_key: 'generic',
    pathway: 'human-health-direct',
    input_key: 'IR_sed_mg_per_day',
    value: 100,
    unit: 'mg/day',
    value_type: 'single_value',
    default_status: 'available_option',
    evidence_support_status: 'pending_source_locator',
    qa_status: 'needs_review',
    canonical_source_status: 'needs_direct_source_check',
    candidate_group_id: 'human-health-direct__generic__IR_sed_mg_per_day__general',
    jurisdiction: 'general',
    source_ids: [HC_PQRA_WORKER_PROMOTION_SOURCE_ID],
    applicability: 'HC PQRA v4.0 worker incidental sediment ingestion rate. needs_review candidate.',
    uncertainty: 'Pending direct-source verification.',
    review_notes: 'HC PQRA v4.0 Appendix E worker IR_sed 100 mg/day (MassDEP 2002).',
    evidence_items: [{
      source_id: HC_PQRA_WORKER_PROMOTION_SOURCE_ID,
      qa_status: 'needs_review',
      evidence_id: 'ev-pv-hc-pqra-v4-2024-ir-sed-worker-ca-1',
    }],
    source_relationships: [{
      source_id: HC_PQRA_WORKER_PROMOTION_SOURCE_ID,
      role: 'canonical_candidate',
      note: 'HC PQRA v4.0 Appendix E.',
    }],
  },
  // 3: pv-hc-pqra-v4-2024-sa-total-worker-ca
  {
    parameter_value_id: 'pv-hc-pqra-v4-2024-sa-total-worker-ca',
    substance_key: 'generic',
    pathway: 'human-health-direct',
    input_key: 'SA_cm2',
    value: 16640,
    unit: 'cm2',
    value_type: 'single_value',
    default_status: 'available_option',
    evidence_support_status: 'pending_source_locator',
    qa_status: 'needs_review',
    canonical_source_status: 'needs_direct_source_check',
    candidate_group_id: 'human-health-direct__generic__SA_cm2__general',
    jurisdiction: 'general',
    source_ids: [HC_PQRA_WORKER_PROMOTION_SOURCE_ID],
    applicability: 'HC PQRA v4.0 worker total-body skin surface area. needs_review candidate.',
    uncertainty: 'Pending direct-source verification.',
    review_notes: 'HC PQRA v4.0 Appendix E worker SA 16640 cm2 (owner-attested correction of typesetting error).',
    evidence_items: [{
      source_id: HC_PQRA_WORKER_PROMOTION_SOURCE_ID,
      qa_status: 'needs_review',
      evidence_id: 'ev-pv-hc-pqra-v4-2024-sa-total-worker-ca-1',
    }],
    source_relationships: [{
      source_id: HC_PQRA_WORKER_PROMOTION_SOURCE_ID,
      role: 'canonical_candidate',
      note: 'HC PQRA v4.0 Appendix E.',
    }],
  },
  // 4: pv-hc-pqra-v4-2024-af-sed-other-worker-ca
  {
    parameter_value_id: 'pv-hc-pqra-v4-2024-af-sed-other-worker-ca',
    substance_key: 'generic',
    pathway: 'human-health-direct',
    input_key: 'AF_sed_mg_per_cm2',
    value: 0.1,
    unit: 'mg/cm2',
    value_type: 'single_value',
    default_status: 'available_option',
    evidence_support_status: 'pending_source_locator',
    qa_status: 'needs_review',
    canonical_source_status: 'needs_direct_source_check',
    candidate_group_id: 'human-health-direct__generic__AF_sed_mg_per_cm2__general',
    jurisdiction: 'general',
    source_ids: [HC_PQRA_WORKER_PROMOTION_SOURCE_ID],
    applicability: 'HC PQRA v4.0 worker sediment adherence factor (surfaces other than hands). needs_review candidate.',
    uncertainty: 'Pending direct-source verification.',
    review_notes: 'HC PQRA v4.0 Appendix E worker AF 0.1 mg/cm2 (Kissel).',
    evidence_items: [{
      source_id: HC_PQRA_WORKER_PROMOTION_SOURCE_ID,
      qa_status: 'needs_review',
      evidence_id: 'ev-pv-hc-pqra-v4-2024-af-sed-other-worker-ca-1',
    }],
    source_relationships: [{
      source_id: HC_PQRA_WORKER_PROMOTION_SOURCE_ID,
      role: 'canonical_candidate',
      note: 'HC PQRA v4.0 Appendix E.',
    }],
  },
];

// Source fixture: canonical pre-promotion state (canonical_source_status ABSENT as on the real record).
function makeSourceRecord(overrides = {}) {
  return {
    source_id: HC_PQRA_WORKER_PROMOTION_SOURCE_ID,
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

// Build a full fixture with all 5 value records + 1 untouched extra + the source.
function makeFixture(valueOverrides = {}, sourceOverrides = {}) {
  // Clone all 5 base fixtures, apply per-id overrides if provided.
  const records = BASE_VALUE_FIXTURES.map((base) => {
    const ov = valueOverrides[base.parameter_value_id] || {};
    return { ...JSON.parse(JSON.stringify(base)), ...ov };
  });
  // Add an untouched bystander record.
  records.push({
    parameter_value_id: 'pv-other-untouched',
    substance_key: 'generic',
    pathway: 'human-health-direct',
    input_key: 'EF_days_per_year',
    value: 365,
    unit: 'days/year',
    value_type: 'single_value',
    default_status: 'available_option',
    evidence_support_status: 'pending_source_locator',
    qa_status: 'needs_review',
    canonical_source_status: 'needs_direct_source_check',
    candidate_group_id: 'human-health-direct__generic__EF_days_per_year__general',
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
const APPLY_OPTS = { reviewer: 'J. Nelson', date: '2026-06-13', sourceUrl: null, zoteroKey: null };

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
      reviewed_at: '2026-06-13',
    })),
  };
}

// Build a valueOverrides map where all 5 records are in the done state.
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

describe('promote-hc-pqra-worker: scope constants', () => {
  it('exports exactly 5 value IDs', () => {
    expect(HC_PQRA_WORKER_PROMOTION_VALUE_IDS).toHaveLength(5);
  });
  it('lists the correct value IDs in order', () => {
    expect(HC_PQRA_WORKER_PROMOTION_VALUE_IDS[0]).toBe('pv-hc-pqra-v4-2024-ef-commercial-ca');
    expect(HC_PQRA_WORKER_PROMOTION_VALUE_IDS[1]).toBe('pv-hc-pqra-v4-2024-ed-commercial-ca');
    expect(HC_PQRA_WORKER_PROMOTION_VALUE_IDS[2]).toBe('pv-hc-pqra-v4-2024-ir-sed-worker-ca');
    expect(HC_PQRA_WORKER_PROMOTION_VALUE_IDS[3]).toBe('pv-hc-pqra-v4-2024-sa-total-worker-ca');
    expect(HC_PQRA_WORKER_PROMOTION_VALUE_IDS[4]).toBe('pv-hc-pqra-v4-2024-af-sed-other-worker-ca');
  });
  it('targets the correct source', () => {
    expect(HC_PQRA_WORKER_PROMOTION_SOURCE_ID).toBe('src-health-canada-pqra-v4-2024');
  });
});

describe('promote-hc-pqra-worker: parseArgs', () => {
  it('parses flags and values', () => {
    const a = parseArgs(['node', 's', '--reviewer', 'J. Nelson', '--date', '2026-06-13',
      '--source-url', 'https://canada.ca/x', '--zotero-key', 'SFH7ARKQ', '--apply']);
    expect(a).toMatchObject({
      reviewer: 'J. Nelson', date: '2026-06-13', sourceUrl: 'https://canada.ca/x',
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

describe('promote-hc-pqra-worker: validateApplyOptions', () => {
  it('accepts a complete attestation', () => {
    expect(() => validateApplyOptions(APPLY_OPTS)).not.toThrow();
  });
  it('requires reviewer', () => {
    expect(() => validateApplyOptions({ ...APPLY_OPTS, reviewer: '' })).toThrow(/reviewer/);
  });
  it('requires a YYYY-MM-DD date', () => {
    expect(() => validateApplyOptions({ ...APPLY_OPTS, date: '2026/06/13' })).toThrow(/date/);
  });
});

describe('promote-hc-pqra-worker: planPromotion -- happy path', () => {
  it('plans all 5 values to promote + source (absent canonical_source_status = promotable)', () => {
    const { records, sources } = makeFixture();
    const plan = planPromotion(records, sources, APPLY_OPTS);
    expect(plan.valueResults).toHaveLength(5);
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

describe('promote-hc-pqra-worker: planPromotion -- fail-closed preconditions', () => {
  it('throws when a value record is missing', () => {
    const { records, sources } = makeFixture();
    const filtered = records.filter((r) => r.parameter_value_id !== 'pv-hc-pqra-v4-2024-ef-commercial-ca');
    expect(() => planPromotion(filtered, sources, APPLY_OPTS)).toThrow(/not found/);
  });
  it('throws when a value has no evidence_items', () => {
    const { records, sources } = makeFixture({
      'pv-hc-pqra-v4-2024-ef-commercial-ca': { evidence_items: [] },
    });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/no evidence_items/);
  });
  it('throws on identity mismatch (wrong value)', () => {
    const { records, sources } = makeFixture({
      'pv-hc-pqra-v4-2024-ef-commercial-ca': { value: 999 },
    });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/expected frame-eligible identity/);
  });
  it('throws on identity mismatch (wrong jurisdiction)', () => {
    const { records, sources } = makeFixture({
      'pv-hc-pqra-v4-2024-sa-total-worker-ca': { jurisdiction: 'BC' },
    });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/expected frame-eligible identity/);
  });
  it('throws on identity mismatch (wrong unit)', () => {
    const { records, sources } = makeFixture({
      'pv-hc-pqra-v4-2024-ir-sed-worker-ca': { unit: 'g/day' },
    });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/expected frame-eligible identity/);
  });
  it('throws when source_ids does not match the HC PQRA source', () => {
    const { records, sources } = makeFixture({
      'pv-hc-pqra-v4-2024-ef-commercial-ca': { source_ids: ['src-wrong'] },
    });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/source_ids must be EXACTLY/);
  });
  it('throws when source_ids has a second linked source (under-block risk)', () => {
    const { records, sources } = makeFixture({
      'pv-hc-pqra-v4-2024-ef-commercial-ca': { source_ids: [HC_PQRA_WORKER_PROMOTION_SOURCE_ID, 'src-extra'] },
    });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/source_ids must be EXACTLY/);
  });
  it('throws on a drifted pre-state (qa_status superseded)', () => {
    const { records, sources } = makeFixture({
      'pv-hc-pqra-v4-2024-sa-total-worker-ca': { qa_status: 'superseded' },
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
      'pv-hc-pqra-v4-2024-ef-commercial-ca': {
        source_relationships: [{ source_id: HC_PQRA_WORKER_PROMOTION_SOURCE_ID, role: 'policy_compilation' }],
      },
    });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/policy_compilation\/reference_mining/);
  });
  it('throws when a source_relationships role is reference_mining', () => {
    const { records, sources } = makeFixture({
      'pv-hc-pqra-v4-2024-ir-sed-worker-ca': {
        source_relationships: [{ source_id: HC_PQRA_WORKER_PROMOTION_SOURCE_ID, role: 'reference_mining' }],
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
    const filteredSrc = sources.filter((s) => s.source_id !== HC_PQRA_WORKER_PROMOTION_SOURCE_ID);
    expect(() => planPromotion(records, filteredSrc, APPLY_OPTS)).toThrow(/not found in sources.json/);
  });
});

describe('promote-hc-pqra-worker: idempotency', () => {
  it('skips all value records + source when everything is already done', () => {
    const { records, sources } = makeFixture(
      allDoneOverrides(),
      { canonical_source_status: 'direct_source_verified' },
    );
    const plan = planPromotion(records, sources, APPLY_OPTS);
    expect(plan.valueResults.every((vr) => !vr.promoteValue && vr.valueAlreadyDone)).toBe(true);
    expect(plan.promoteSource).toBe(false);
  });
  it('throws on a partially-promoted record (top-level done, evidence still needs_review)', () => {
    const { records, sources } = makeFixture({
      'pv-hc-pqra-v4-2024-ef-commercial-ca': {
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
    const s = sources.find((x) => x.source_id === HC_PQRA_WORKER_PROMOTION_SOURCE_ID);
    expect(s.url).toBe('https://canada.ca/real.pdf');
  });
});

describe('promote-hc-pqra-worker: field edits on each of the 5 value records', () => {
  it('flips qa + evidence + adds attestation on all 5 records', () => {
    const { records, sources } = makeFixture();
    applyPromotion(records, sources, APPLY_OPTS);
    for (const valueId of HC_PQRA_WORKER_PROMOTION_VALUE_IDS) {
      const r = records.find((x) => x.parameter_value_id === valueId);
      expect(r.qa_status).toBe('approved');
      expect(r.evidence_support_status).toBe('approved_source_backed');
      expect(r.canonical_source_status).toBe('direct_source_verified');
      expect(r.default_status).toBe('available_option'); // never promoted to a default
      const ev = r.evidence_items[0];
      expect(ev.qa_status).toBe('approved');
      expect(ev.reviewed_by).toBe('J. Nelson');
      expect(ev.reviewed_at).toBe('2026-06-13');
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
    const s = sources.find((x) => x.source_id === HC_PQRA_WORKER_PROMOTION_SOURCE_ID);
    expect(s.canonical_source_status).toBe('direct_source_verified');
  });
  it('stamps provenance fields on all 5 records on fresh promotion', () => {
    const { records, sources } = makeFixture();
    applyPromotion(records, sources, APPLY_OPTS);
    for (const valueId of HC_PQRA_WORKER_PROMOTION_VALUE_IDS) {
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
    const stamped = ' [PROMOTED to approved on 2026-06-13 by J. Nelson]';
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
    for (const valueId of HC_PQRA_WORKER_PROMOTION_VALUE_IDS) {
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
        uncertainty: base.uncertainty + ' [PROMOTED to approved on 2026-06-13 by J. Nelson]',
        review_notes: base.review_notes + ' [PROMOTED to approved on 2026-06-13 by J. Nelson]',
      };
    }
    const { records, sources } = makeFixture(doneOverrides, { canonical_source_status: 'direct_source_verified' });
    const applied = applyPromotion(records, sources, APPLY_OPTS);
    expect(applied.valueTouchedFlags.every((t) => t === true)).toBe(true);
    for (const valueId of HC_PQRA_WORKER_PROMOTION_VALUE_IDS) {
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
    const s = sources.find((x) => x.source_id === HC_PQRA_WORKER_PROMOTION_SOURCE_ID);
    expect(s.zotero_status).toBe('linked');
    expect(applied.sourceTouched).toBe(true);
  });
});
