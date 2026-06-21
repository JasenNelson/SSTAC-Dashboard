// Guards for the owner-run US EPA 2024 PFOA + PFOS oral-RfD promotion tool (promote-us-epa-pfas.mjs).
// Plain ASCII only. Mirrors promote-hc-pqra-lifestage.test.mjs re-scoped to the 4 PFAS records,
// with extra coverage for the TWO distinct per-substance sources (src-us-epa-pfoa-2024 /
// src-us-epa-pfos-2024).

import { describe, it, expect } from 'vitest';
import {
  US_EPA_PFAS_PROMOTION_VALUE_IDS,
  US_EPA_PFAS_PROMOTION_SOURCE_IDS,
  parseArgs,
  validateApplyOptions,
  planPromotion,
  applyPromotion,
} from '../promote-us-epa-pfas.mjs';

const PFOA_SRC = 'src-us-epa-pfoa-2024';
const PFOS_SRC = 'src-us-epa-pfos-2024';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// [id, substance, pathway, value, sourceId]
const RECORD_SPECS = [
  ['pv-us-epa-2024-perfluoroctanoic_acid_pfoa-hh-direct-rfd', 'perfluoroctanoic_acid_pfoa', 'human-health-direct', 3e-8, PFOA_SRC],
  ['pv-us-epa-2024-perfluoroctanoic_acid_pfoa-hh-food-rfd', 'perfluoroctanoic_acid_pfoa', 'human-health-food', 3e-8, PFOA_SRC],
  ['pv-us-epa-2024-perfluorooctane_sulfonate-hh-direct-rfd', 'perfluorooctane_sulfonate', 'human-health-direct', 1e-7, PFOS_SRC],
  ['pv-us-epa-2024-perfluorooctane_sulfonate-hh-food-rfd', 'perfluorooctane_sulfonate', 'human-health-food', 1e-7, PFOS_SRC],
];

function baseRecord([id, substance, pathway, value, sourceId]) {
  return {
    parameter_value_id: id,
    substance_key: substance,
    pathway,
    input_key: 'rfd_oral_mg_per_kg_bw_day',
    value,
    unit: 'mg/kg-bw/day',
    value_type: 'single_value',
    default_status: 'available_option',
    evidence_support_status: 'pending_source_locator',
    qa_status: 'needs_review',
    canonical_source_status: 'needs_direct_source_check',
    candidate_group_id: pathway + '__' + substance + '__rfd_oral_mg_per_kg_bw_day__US_federal',
    jurisdiction: 'US_federal',
    source_ids: [sourceId],
    applicability: 'US EPA 2024 toxicity assessment RfD for ' + substance + '; needs_review candidate.',
    uncertainty: null,
    review_notes: 'US EPA 2024 RfD candidate; value read verbatim. qa_status=needs_review.',
    evidence_items: [{
      source_id: sourceId,
      locator: 'US EPA 2024 (' + sourceId + '), RfD Selection',
      value_text: String(value),
      extraction_method: 'manual_source_extraction',
      extracted_by: 'claude-opus-4-8',
      extracted_at: '2026-06-20',
      qa_status: 'needs_review',
      evidence_id: 'ev-' + id + '-1',
      locator_type: 'source_section',
    }],
    source_relationships: [{
      source_id: sourceId,
      role: 'canonical_candidate',
      note: 'US EPA 2024 toxicity assessment is the primary source for this RfD.',
    }],
  };
}

const BASE_VALUE_FIXTURES = RECORD_SPECS.map(baseRecord);

function makeSourceRecord(sourceId, overrides = {}) {
  return {
    source_id: sourceId,
    short_citation: 'US EPA 2024 ' + sourceId,
    url: 'https://www.epa.gov/sdwa/' + sourceId,
    zotero_item_key: null,
    zotero_status: 'pending_owner_export',
    notes: 'US EPA 2024 final human health toxicity assessment.',
    currentness_status: 'current',
    file_storage: 'zotero_or_external',
    calculator_source_role: 'canonical_candidate',
    canonical_source_status: 'direct_source_verified',
    ...overrides,
  };
}

function makeFixture(valueOverrides = {}, pfoaSrcOverrides = {}, pfosSrcOverrides = {}) {
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
    evidence_support_status: 'pending_source_locator',
    qa_status: 'needs_review',
    canonical_source_status: 'needs_direct_source_check',
    jurisdiction: 'US_federal',
    source_ids: ['src-other'],
    evidence_items: [{ source_id: 'src-other', qa_status: 'needs_review', evidence_id: 'ev-other-1' }],
  });
  const sources = [
    makeSourceRecord(PFOA_SRC, pfoaSrcOverrides),
    makeSourceRecord(PFOS_SRC, pfosSrcOverrides),
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

describe('promote-us-epa-pfas: scope constants', () => {
  it('exports exactly 4 value IDs', () => {
    expect(US_EPA_PFAS_PROMOTION_VALUE_IDS).toHaveLength(4);
  });
  it('lists the correct value IDs in order', () => {
    expect(US_EPA_PFAS_PROMOTION_VALUE_IDS).toEqual([
      'pv-us-epa-2024-perfluoroctanoic_acid_pfoa-hh-direct-rfd',
      'pv-us-epa-2024-perfluoroctanoic_acid_pfoa-hh-food-rfd',
      'pv-us-epa-2024-perfluorooctane_sulfonate-hh-direct-rfd',
      'pv-us-epa-2024-perfluorooctane_sulfonate-hh-food-rfd',
    ]);
  });
  it('targets the two distinct per-substance sources', () => {
    expect(US_EPA_PFAS_PROMOTION_SOURCE_IDS).toEqual([PFOA_SRC, PFOS_SRC]);
  });
});

describe('promote-us-epa-pfas: parseArgs', () => {
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

describe('promote-us-epa-pfas: validateApplyOptions', () => {
  it('accepts a complete attestation', () => {
    expect(() => validateApplyOptions(APPLY_OPTS)).not.toThrow();
  });
  it('requires reviewer', () => {
    expect(() => validateApplyOptions({ ...APPLY_OPTS, reviewer: '' })).toThrow(/reviewer/);
  });
  it('requires a YYYY-MM-DD date', () => {
    expect(() => validateApplyOptions({ ...APPLY_OPTS, date: '2026/06/20' })).toThrow(/date/);
  });
  it('rejects --source-url (two distinct sources cannot share one locator)', () => {
    expect(() => validateApplyOptions({ ...APPLY_OPTS, sourceUrl: 'https://x' }))
      .toThrow(/NOT supported by this two-source tool/);
  });
  it('rejects --zotero-key (two distinct sources cannot share one locator)', () => {
    expect(() => validateApplyOptions({ ...APPLY_OPTS, zoteroKey: 'ABCD1234' }))
      .toThrow(/NOT supported by this two-source tool/);
  });
});

describe('promote-us-epa-pfas: planPromotion -- happy path', () => {
  it('plans all 4 values to promote + skips both already-verified sources', () => {
    const { records, sources } = makeFixture();
    const plan = planPromotion(records, sources, APPLY_OPTS);
    expect(plan.valueResults).toHaveLength(4);
    expect(plan.valueResults.every((vr) => vr.promoteValue)).toBe(true);
    expect(plan.sourceResults).toHaveLength(2);
    expect(plan.sourceResults.every((sr) => sr.sourceAlreadyDone)).toBe(true);
    expect(plan.promoteSource).toBe(false);
  });
  it('attaches the correct expected source to each value (PFOA vs PFOS)', () => {
    const { records, sources } = makeFixture();
    const plan = planPromotion(records, sources, APPLY_OPTS);
    expect(plan.valueResults[0].expectedSourceId).toBe(PFOA_SRC);
    expect(plan.valueResults[1].expectedSourceId).toBe(PFOA_SRC);
    expect(plan.valueResults[2].expectedSourceId).toBe(PFOS_SRC);
    expect(plan.valueResults[3].expectedSourceId).toBe(PFOS_SRC);
  });
  it('promotes only the PFOA source when only it is pre-state', () => {
    const { records, sources } = makeFixture({}, { canonical_source_status: 'needs_direct_source_check' });
    const plan = planPromotion(records, sources, APPLY_OPTS);
    expect(plan.promoteSource).toBe(true);
    const pfoa = plan.sourceResults.find((sr) => sr.sourceRecord.source_id === PFOA_SRC);
    const pfos = plan.sourceResults.find((sr) => sr.sourceRecord.source_id === PFOS_SRC);
    expect(pfoa.promoteSource).toBe(true);
    expect(pfos.promoteSource).toBe(false);
  });
});

describe('promote-us-epa-pfas: planPromotion -- fail-closed preconditions', () => {
  it('throws when a value record is missing', () => {
    const { records, sources } = makeFixture();
    const filtered = records.filter((r) => r.parameter_value_id !== US_EPA_PFAS_PROMOTION_VALUE_IDS[0]);
    expect(() => planPromotion(filtered, sources, APPLY_OPTS)).toThrow(/not found/);
  });
  it('throws when a value has no evidence_items', () => {
    const { records, sources } = makeFixture({ [US_EPA_PFAS_PROMOTION_VALUE_IDS[0]]: { evidence_items: [] } });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/no evidence_items/);
  });
  it('throws on identity mismatch (wrong value)', () => {
    const { records, sources } = makeFixture({ [US_EPA_PFAS_PROMOTION_VALUE_IDS[2]]: { value: 99 } });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/expected frame-eligible identity/);
  });
  it('throws on identity mismatch (wrong jurisdiction)', () => {
    const { records, sources } = makeFixture({ [US_EPA_PFAS_PROMOTION_VALUE_IDS[3]]: { jurisdiction: 'general' } });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/expected frame-eligible identity/);
  });
  it('throws when a PFOA row points at the PFOS source (cross-source mismatch)', () => {
    const { records, sources } = makeFixture({ [US_EPA_PFAS_PROMOTION_VALUE_IDS[0]]: { source_ids: [PFOS_SRC] } });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/source_ids must be EXACTLY/);
  });
  it('throws when source_ids has a second linked source (under-block risk)', () => {
    const { records, sources } = makeFixture({ [US_EPA_PFAS_PROMOTION_VALUE_IDS[0]]: { source_ids: [PFOA_SRC, 'src-extra'] } });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/source_ids must be EXACTLY/);
  });
  it('throws on a drifted pre-state (qa_status superseded)', () => {
    const { records, sources } = makeFixture({ [US_EPA_PFAS_PROMOTION_VALUE_IDS[3]]: { qa_status: 'superseded' } });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/expected pre-promotion state/);
  });
  it('throws on a drifted source canonical_source_status (PFOS)', () => {
    const { records, sources } = makeFixture({}, {}, { canonical_source_status: 'not_applicable' });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/neither needs_direct_source_check/);
  });
  it('throws when a PFOS source role is policy_compilation', () => {
    const { records, sources } = makeFixture({}, {}, { calculator_source_role: 'policy_compilation' });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/policy_compilation/);
  });
  it('throws when the PFOA source is not current', () => {
    const { records, sources } = makeFixture({}, { currentness_status: 'superseded' });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/direct-current eligible/);
  });
  it('throws when the PFOA source is repo_metadata_only', () => {
    const { records, sources } = makeFixture({}, { file_storage: 'repo_metadata_only' });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/direct-current eligible/);
  });
  it('throws when a source record is missing', () => {
    const { records, sources } = makeFixture();
    const filteredSrc = sources.filter((s) => s.source_id !== PFOS_SRC);
    expect(() => planPromotion(records, filteredSrc, APPLY_OPTS)).toThrow(/not found in sources.json/);
  });
  it('throws when evidence_items[0].source_id is a stale foreign reference (nested-source guard)', () => {
    const target = US_EPA_PFAS_PROMOTION_VALUE_IDS[2];
    const base = BASE_VALUE_FIXTURES[2];
    const staleEv = { ...base.evidence_items[0], source_id: 'src-FOREIGN-stale' };
    const { records, sources } = makeFixture({ [target]: { evidence_items: [staleEv] } });
    expect(() => planPromotion(records, sources, APPLY_OPTS)).toThrow(/nested provenance source/);
  });
});

describe('promote-us-epa-pfas: idempotency', () => {
  it('skips all value records when everything is already done', () => {
    const { records, sources } = makeFixture(allDoneOverrides());
    const plan = planPromotion(records, sources, APPLY_OPTS);
    expect(plan.valueResults.every((vr) => !vr.promoteValue && vr.valueAlreadyDone)).toBe(true);
    expect(plan.promoteSource).toBe(false);
  });
  it('rejects an approved record whose evidence is missing the owner attestation', () => {
    const target = US_EPA_PFAS_PROMOTION_VALUE_IDS[0];
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
      [US_EPA_PFAS_PROMOTION_VALUE_IDS[0]]: {
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

describe('promote-us-epa-pfas: field edits on each of the 4 value records', () => {
  it('flips qa + evidence_support + canonical + adds attestation on all 4 records', () => {
    const { records, sources } = makeFixture();
    applyPromotion(records, sources, APPLY_OPTS);
    for (const valueId of US_EPA_PFAS_PROMOTION_VALUE_IDS) {
      const r = records.find((x) => x.parameter_value_id === valueId);
      expect(r.qa_status).toBe('approved');
      expect(r.evidence_support_status).toBe('approved_source_backed');
      expect(r.canonical_source_status).toBe('direct_source_verified');
      expect(r.default_status).toBe('available_option');
      const ev = r.evidence_items[0];
      expect(ev.qa_status).toBe('approved');
      expect(ev.reviewed_by).toBe('J. Nelson');
      expect(ev.reviewed_at).toBe('2026-06-20');
      const keys = Object.keys(ev);
      const qi = keys.indexOf('qa_status');
      expect(keys[qi + 1]).toBe('reviewed_by');
      expect(keys[qi + 2]).toBe('reviewed_at');
    }
  });
  it('does not promote the already-verified sources', () => {
    const { records, sources } = makeFixture();
    const applied = applyPromotion(records, sources, APPLY_OPTS);
    expect(applied.sourceTouched).toBe(false);
    for (const sid of US_EPA_PFAS_PROMOTION_SOURCE_IDS) {
      expect(sources.find((x) => x.source_id === sid).canonical_source_status).toBe('direct_source_verified');
    }
  });
  it('promotes a pre-state PFOA source and stamps its notes', () => {
    const { records, sources } = makeFixture({}, { canonical_source_status: 'needs_direct_source_check' });
    const applied = applyPromotion(records, sources, APPLY_OPTS);
    expect(applied.sourceTouched).toBe(true);
    const pfoa = sources.find((x) => x.source_id === PFOA_SRC);
    expect(pfoa.canonical_source_status).toBe('direct_source_verified');
    expect(pfoa.notes).toContain('Source promoted to direct_source_verified');
    // PFOS source was already done -> untouched
    const pfos = sources.find((x) => x.source_id === PFOS_SRC);
    expect(pfos.notes).not.toContain('Source promoted to direct_source_verified');
  });
  it('stamps the string provenance fields but skips null uncertainty', () => {
    const { records, sources } = makeFixture();
    applyPromotion(records, sources, APPLY_OPTS);
    for (const valueId of US_EPA_PFAS_PROMOTION_VALUE_IDS) {
      const r = records.find((x) => x.parameter_value_id === valueId);
      expect(r.applicability).toContain('PROMOTED to approved');
      expect(r.review_notes).toContain('PROMOTED to approved');
      expect(r.uncertainty).toBeNull();
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
      doneOverrides[base.parameter_value_id] = {
        ...doneValue(base),
        applicability: base.applicability + stamped,
        review_notes: base.review_notes + stamped,
      };
    }
    const { records, sources } = makeFixture(doneOverrides);
    const applied = applyPromotion(records, sources, APPLY_OPTS);
    expect(applied.valueTouchedFlags.every((t) => t === false)).toBe(true);
    for (const valueId of US_EPA_PFAS_PROMOTION_VALUE_IDS) {
      const r = records.find((x) => x.parameter_value_id === valueId);
      expect(r.applicability.match(/PROMOTED to approved/g)).toHaveLength(1);
    }
  });
});
