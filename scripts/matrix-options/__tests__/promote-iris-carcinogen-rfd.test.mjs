// Guards for the owner-run US EPA IRIS oral-RfD promotion tool (promote-iris-carcinogen-rfd.mjs).
// Plain ASCII only. Mirrors promote-hc-pqra-lifestage.test.mjs re-scoped to the 6 IRIS pv-iris-*
// records (hexachlorobenzene + pentachlorophenol + 1,4-dioxane; direct + food).
//
// PRE-STATE NOTE: these IRIS rows are evidence_support_status='approved_source_backed' in the
// pre-promotion state (unchanged by promotion); only qa_status + canonical_source_status move.

import { describe, it, expect } from 'vitest';
import {
  IRIS_CARCINOGEN_RFD_PROMOTION_VALUE_IDS,
  IRIS_CARCINOGEN_RFD_PROMOTION_SOURCE_ID,
  parseArgs,
  validateApplyOptions,
  planPromotion,
  applyPromotion,
} from '../promote-iris-carcinogen-rfd.mjs';

const SOURCE_ID = IRIS_CARCINOGEN_RFD_PROMOTION_SOURCE_ID;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// Per-record (id, substance, pathway, value, candidate_group_id) drivers; the rest is shared shape.
const RECORD_SPECS = [
  ['pv-iris-hexachlorobenzene-hh-direct-rfd', 'hexachlorobenzene', 'human-health-direct', 0.0008],
  ['pv-iris-hexachlorobenzene-hh-food-rfd', 'hexachlorobenzene', 'human-health-food', 0.0008],
  ['pv-iris-pentachlorophenol-hh-direct-rfd', 'pentachlorophenol', 'human-health-direct', 0.005],
  ['pv-iris-pentachlorophenol-hh-food-rfd', 'pentachlorophenol', 'human-health-food', 0.005],
  ['pv-iris-1_4_dioxane-hh-direct-rfd', '1_4_dioxane', 'human-health-direct', 0.03],
  ['pv-iris-1_4_dioxane-hh-food-rfd', '1_4_dioxane', 'human-health-food', 0.03],
];

function baseRecord([id, substance, pathway, value]) {
  return {
    parameter_value_id: id,
    substance_key: substance,
    pathway,
    input_key: 'rfd_oral_mg_per_kg_bw_day',
    value,
    unit: 'mg/kg-bw/day',
    value_type: 'single_value',
    default_status: 'available_option',
    // IRIS rows are ALREADY approved_source_backed pre-promotion (only qa + canonical move).
    evidence_support_status: 'approved_source_backed',
    qa_status: 'needs_review',
    canonical_source_status: 'needs_direct_source_check',
    candidate_group_id: pathway + '__' + substance + '__rfd_oral_mg_per_kg_bw_day__US_federal',
    jurisdiction: 'US_federal',
    source_ids: [SOURCE_ID],
    applicability: 'US EPA IRIS RFD for ' + substance + '; needs_review candidate.',
    uncertainty: null,
    review_notes: 'US EPA IRIS RFD candidate, robot-extracted. qa_status=needs_review.',
    evidence_items: [{
      source_id: SOURCE_ID,
      locator: 'US EPA IRIS, ' + substance + ' Oral RfD Summary',
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
      note: 'US EPA IRIS is the source for this extracted TRV row.',
    }],
  };
}

const BASE_VALUE_FIXTURES = RECORD_SPECS.map(baseRecord);

// Source fixture: real record state (already direct_source_verified).
function makeSourceRecord(overrides = {}) {
  return {
    source_id: SOURCE_ID,
    short_citation: 'US EPA IRIS RfD table, live',
    url: 'https://iris.epa.gov/AdvancedSearch/rfd_toxicity_values',
    zotero_item_key: null,
    zotero_status: 'pending_owner_export',
    notes: 'Live IRIS human-health RfD toxicity-value table.',
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
  // Add an untouched bystander record.
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
    candidate_group_id: 'human-health-direct__generic__rfd_oral_mg_per_kg_bw_day__US_federal',
    jurisdiction: 'US_federal',
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
const APPLY_OPTS = { reviewer: 'J. Nelson', date: '2026-06-20', sourceUrl: null, zoteroKey: null };

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
      reviewed_at: '2026-06-20',
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

describe('promote-iris-carcinogen-rfd: scope constants', () => {
  it('exports exactly 6 value IDs', () => {
    expect(IRIS_CARCINOGEN_RFD_PROMOTION_VALUE_IDS).toHaveLength(6);
  });
  it('lists the correct pv-iris-* value IDs in order (NOT pv-p28-*)', () => {
    expect(IRIS_CARCINOGEN_RFD_PROMOTION_VALUE_IDS).toEqual([
      'pv-iris-hexachlorobenzene-hh-direct-rfd',
      'pv-iris-hexachlorobenzene-hh-food-rfd',
      'pv-iris-pentachlorophenol-hh-direct-rfd',
      'pv-iris-pentachlorophenol-hh-food-rfd',
      'pv-iris-1_4_dioxane-hh-direct-rfd',
      'pv-iris-1_4_dioxane-hh-food-rfd',
    ]);
  });
  it('never lists a Protocol 28 (pv-p28-*) id', () => {
    expect(IRIS_CARCINOGEN_RFD_PROMOTION_VALUE_IDS.some((id) => id.startsWith('pv-p28-'))).toBe(false);
  });
  it('targets the live IRIS source', () => {
    expect(IRIS_CARCINOGEN_RFD_PROMOTION_SOURCE_ID).toBe('src-us-epa-iris-rfd-table-live');
  });
});

describe('promote-iris-carcinogen-rfd: parseArgs', () => {
  it('parses flags and values', () => {
    const a = parseArgs(['node', 's', '--reviewer', 'J. Nelson', '--date', '2026-06-20', '--apply']);
    expect(a).toMatchObject({ reviewer: 'J. Nelson', date: '2026-06-20', apply: true });
  });
  it('defaults to a dry run', () => {
    expect(parseArgs(['node', 's']).apply).toBe(false);
  });
  it('throws on unknown argument', () => {
    expect(() => parseArgs(['node', 's', '--bogus'])).toThrow(/Unknown argument/);
  });
});

describe('promote-iris-carcinogen-rfd: validateApplyOptions', () => {
  it('accepts a complete attestation', () => {
    expect(() => validateApplyOptions(APPLY_OPTS)).not.toThrow();
  });
  it('requires reviewer', () => {
    expect(() => validateApplyOptions({ ...APPLY_OPTS, reviewer: '' })).toThrow(/reviewer/);
  });
  it('requires a YYYY-MM-DD date', () => {
    expect(() => validateApplyOptions({ ...APPLY_OPTS, date: '2026/06/20' })).toThrow(/date/);
  });
});

describe('promote-iris-carcinogen-rfd: planPromotion -- happy path', () => {
  it('plans all 6 values to promote + skips the already-verified source', () => {
    const { records, sources } = makeFixture();
    const plan = planPromotion(records, sources, APPLY_OPTS);
    expect(plan.valueResults).toHaveLength(6);
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

describe('promote-iris-carcinogen-rfd: planPromotion -- fail-closed preconditions', () => {
  it('throws when a value record is missing', () => {
    const { records, sources } = makeFixture();
    const filtered = records.filter((r) => r.parameter_value_id !== 'pv-iris-hexachlorobenzene-hh-direct-rfd');
    expect(() => planPromotion(filtered, sources, APPLY_OPTS)).toThrow(/not found/);
  });
  it('throws when a value has no evidence_items', () => {
    const { records, sources } = makeFixture({
      'pv-iris-hexachlorobenzene-hh-direct-rfd': { evidence_items: [] },
    });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/no evidence_items/);
  });
  it('throws on identity mismatch (wrong value)', () => {
    const { records, sources } = makeFixture({
      'pv-iris-pentachlorophenol-hh-direct-rfd': { value: 99 },
    });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/expected frame-eligible identity/);
  });
  it('throws on identity mismatch (wrong jurisdiction)', () => {
    const { records, sources } = makeFixture({
      'pv-iris-1_4_dioxane-hh-food-rfd': { jurisdiction: 'general' },
    });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/expected frame-eligible identity/);
  });
  it('throws on identity mismatch (wrong unit)', () => {
    const { records, sources } = makeFixture({
      'pv-iris-hexachlorobenzene-hh-food-rfd': { unit: 'ug/kg-bw/day' },
    });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/expected frame-eligible identity/);
  });
  it('throws when source_ids does not match the IRIS source', () => {
    const { records, sources } = makeFixture({
      'pv-iris-hexachlorobenzene-hh-direct-rfd': { source_ids: ['src-bc-protocol-28-2021-jan'] },
    });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/source_ids must be EXACTLY/);
  });
  it('throws when source_ids has a second linked source (under-block risk)', () => {
    const { records, sources } = makeFixture({
      'pv-iris-hexachlorobenzene-hh-direct-rfd': { source_ids: [SOURCE_ID, 'src-extra'] },
    });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/source_ids must be EXACTLY/);
  });
  it('throws on a drifted pre-state (qa_status superseded)', () => {
    const { records, sources } = makeFixture({
      'pv-iris-1_4_dioxane-hh-food-rfd': { qa_status: 'superseded' },
    });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/expected pre-promotion state/);
  });
  it('throws on a drifted pre-state (evidence_support_status pending, not approved_source_backed)', () => {
    // IRIS pre-state requires approved_source_backed; a pending_source_locator row is a drift here.
    const { records, sources } = makeFixture({
      'pv-iris-pentachlorophenol-hh-food-rfd': { evidence_support_status: 'pending_source_locator' },
    });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/expected pre-promotion state/);
  });
  it('throws on a drifted source canonical_source_status', () => {
    const { records, sources } = makeFixture({}, { canonical_source_status: 'not_applicable' });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/neither needs_direct_source_check/);
  });
  it('throws when the source role is policy_compilation (via source_relationships)', () => {
    const { records, sources } = makeFixture({
      'pv-iris-hexachlorobenzene-hh-direct-rfd': {
        source_relationships: [{ source_id: SOURCE_ID, role: 'policy_compilation' }],
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
    const filteredSrc = sources.filter((s) => s.source_id !== SOURCE_ID);
    expect(() => planPromotion(records, filteredSrc, APPLY_OPTS)).toThrow(/not found in sources.json/);
  });
  it('throws when evidence_items[0].source_id is a stale foreign reference (nested-source guard)', () => {
    const target = IRIS_CARCINOGEN_RFD_PROMOTION_VALUE_IDS[0];
    const base = BASE_VALUE_FIXTURES[0];
    const staleEv = { ...base.evidence_items[0], source_id: 'src-FOREIGN-stale' };
    const { records, sources } = makeFixture({ [target]: { evidence_items: [staleEv] } });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/nested provenance source/);
  });
});

describe('promote-iris-carcinogen-rfd: idempotency', () => {
  it('skips all value records when everything is already done', () => {
    const { records, sources } = makeFixture(allDoneOverrides());
    const plan = planPromotion(records, sources, APPLY_OPTS);
    expect(plan.valueResults.every((vr) => !vr.promoteValue && vr.valueAlreadyDone)).toBe(true);
    expect(plan.promoteSource).toBe(false);
  });
  it('rejects an approved record whose evidence is missing the owner attestation', () => {
    const target = IRIS_CARCINOGEN_RFD_PROMOTION_VALUE_IDS[0];
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
      'pv-iris-hexachlorobenzene-hh-direct-rfd': {
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
    expect(records.find((x) => x.parameter_value_id === IRIS_CARCINOGEN_RFD_PROMOTION_VALUE_IDS[0]).evidence_items[0].note.match(/Evidence PROMOTED to approved/g)).toHaveLength(1);
  });
});

describe('promote-iris-carcinogen-rfd: field edits on each of the 6 value records', () => {
  it('flips qa + canonical + evidence + adds attestation on all 6 records (esS unchanged)', () => {
    const { records, sources } = makeFixture();
    applyPromotion(records, sources, APPLY_OPTS);
    for (const valueId of IRIS_CARCINOGEN_RFD_PROMOTION_VALUE_IDS) {
      const r = records.find((x) => x.parameter_value_id === valueId);
      expect(r.qa_status).toBe('approved');
      expect(r.evidence_support_status).toBe('approved_source_backed'); // unchanged
      expect(r.canonical_source_status).toBe('direct_source_verified');
      expect(r.default_status).toBe('available_option');
      const ev = r.evidence_items[0];
      expect(ev.qa_status).toBe('approved');
      expect(r.evidence_items[0].note, valueId).toContain('Evidence PROMOTED to approved');
      expect(ev.reviewed_by).toBe('J. Nelson');
      expect(ev.reviewed_at).toBe('2026-06-20');
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
  it('stamps the string provenance fields (applicability, review_notes) but skips null uncertainty', () => {
    const { records, sources } = makeFixture();
    applyPromotion(records, sources, APPLY_OPTS);
    for (const valueId of IRIS_CARCINOGEN_RFD_PROMOTION_VALUE_IDS) {
      const r = records.find((x) => x.parameter_value_id === valueId);
      expect(r.applicability).toContain('PROMOTED to approved');
      expect(r.review_notes).toContain('PROMOTED to approved');
      expect(r.uncertainty).toBeNull(); // null is skipped, never stamped
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
    const stamped = ' [PROMOTED to approved on 2026-06-20 by J. Nelson]';
    const doneOverrides = {};
    for (const base of BASE_VALUE_FIXTURES) {
      const dv = doneValue(base);
      dv.evidence_items[0].note += stamped;
      doneOverrides[base.parameter_value_id] = {
        ...dv,
        applicability: base.applicability + stamped,
        review_notes: base.review_notes + stamped,
      };
    }
    const { records, sources } = makeFixture(doneOverrides);
    const applied = applyPromotion(records, sources, APPLY_OPTS);
    expect(applied.valueTouchedFlags.every((t) => t === false)).toBe(true);
    for (const valueId of IRIS_CARCINOGEN_RFD_PROMOTION_VALUE_IDS) {
      const r = records.find((x) => x.parameter_value_id === valueId);
      expect(r.applicability.match(/PROMOTED to approved/g)).toHaveLength(1);
    }
  });
});
