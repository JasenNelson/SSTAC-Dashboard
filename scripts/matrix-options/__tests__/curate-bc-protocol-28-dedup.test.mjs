// Guards for curate-bc-protocol-28-dedup.mjs (deduping BC Protocol 28 rows).
// Synthetic fixtures, independent of catalog state. Plain ASCII.

import { describe, it, expect } from 'vitest';
import {
  planCuration,
  applyCuration,
  parseArgs,
  BC_P28_DELETE_IDS,
  CURATE_OLD_ID,
  CURATE_NEW_ID,
} from '../curate-bc-protocol-28-dedup.mjs';

const clone = (x) => JSON.parse(JSON.stringify(x));

function makeValueRecord(id, sourceIds = [CURATE_OLD_ID]) {
  return {
    parameter_value_id: id,
    jurisdiction: 'US_federal',
    candidate_group_id: 'cg-' + id,
    pathway: 'food',
    input_key: 'rfd',
    substance_key: 'arsenic',
    value: 0.0003,
    unit: 'mg/kg-day',
    value_type: 'single_value',
    default_status: 'available_option',
    qa_status: 'needs_review',
    evidence_support_status: 'approved_source_backed',
    canonical_source_status: 'needs_direct_source_check',
    source_ids: sourceIds,
    applicability: 'test',
    review_notes: 'test',
    evidence_items: [
      { source_id: sourceIds[0], qa_status: 'needs_review', note: 'test', evidence_id: 'ev-' + id },
    ],
    source_relationships: [
      { source_id: sourceIds[0], relationship_type: 'citation' }
    ]
  };
}

function makeSources(oldSuperseded = false) {
  const oldSource = {
    source_id: CURATE_OLD_ID,
    short_citation: 'BC Protocol 28 Old',
    title: 'Old Title',
    notes: 'Existing notes.',
  };
  if (oldSuperseded) {
    oldSource.status = 'superseded';
    oldSource.superseded_by = CURATE_NEW_ID;
    oldSource.notes = 'Existing notes. Superseded duplicate of src-bc-protocol-28-v3-0-2024 (same PDF; stored doc is v3.0 April 2024). 4 exact-duplicate HH rows removed (kept the verification-packet rows in parameter_values.json) and 351 HH rows re-keyed to the canonical id on 2026-06-22.';
  }
  return [
    oldSource,
    {
      source_id: CURATE_NEW_ID,
      short_citation: 'BC Protocol 28 New',
      title: 'New Title',
      notes: 'New notes',
    }
  ];
}

function makeFixture() {
  const records = [];
  for (const delId of BC_P28_DELETE_IDS) {
    records.push(makeValueRecord(delId));
  }
  records.push(makeValueRecord('pv-p28-other-1'));
  records.push(makeValueRecord('pv-p28-other-2'));
  records.push(makeValueRecord('pv-p28-other-new', [CURATE_NEW_ID]));
  records.push(makeValueRecord('pv-p28-both-old-new', [CURATE_OLD_ID, CURATE_NEW_ID]));
  records.push(makeValueRecord('pv-unrelated', ['src-unrelated']));

  return { records, sources: makeSources() };
}

describe('curate-bc-protocol-28-dedup: parseArgs', () => {
  it('parses --apply and --help', () => {
    expect(parseArgs(['node', 'script.mjs', '--apply'])).toEqual({ apply: true, help: false });
    expect(parseArgs(['node', 'script.mjs', '--help'])).toEqual({ apply: false, help: true });
    expect(parseArgs(['node', 'script.mjs', '-h'])).toEqual({ apply: false, help: true });
    expect(() => parseArgs(['node', 'script.mjs', '--bogus'])).toThrow(/Unknown argument/);
  });
});

describe('curate-bc-protocol-28-dedup: planCuration', () => {
  it('plans correct deletes and rekeys', () => {
    const { records, sources } = makeFixture();
    const plan = planCuration(records, sources);
    expect(plan.deleteCount).toBe(4);
    expect(plan.rekeyCount).toBe(3);
    expect(plan.deleteRows).toHaveLength(4);
    expect(plan.rekeyRows).toHaveLength(3);
  });

  it('throws if NEW source record is missing', () => {
    const { records, sources } = makeFixture();
    const badSources = sources.filter(s => s.source_id !== CURATE_NEW_ID);
    expect(() => planCuration(records, badSources)).toThrow(/NEW_ID source record is missing/);
  });

  it('throws if any DELETE_ID row is missing', () => {
    const { records, sources } = makeFixture();
    const badRecords = records.filter(r => r.parameter_value_id !== BC_P28_DELETE_IDS[0]);
    expect(() => planCuration(badRecords, sources)).toThrow(/DELETE_ID not found in HH/);
  });

  it('throws if any DELETE_ID row does not reference OLD_ID', () => {
    const { records, sources } = makeFixture();
    const target = records.find(r => r.parameter_value_id === BC_P28_DELETE_IDS[0]);
    target.source_ids = ['src-some-other'];
    target.evidence_items[0].source_id = 'src-some-other';
    target.source_relationships[0].source_id = 'src-some-other';
    expect(() => planCuration(records, sources)).toThrow(/DELETE_ID row does not reference old source ID/);
  });
});

describe('curate-bc-protocol-28-dedup: applyCuration', () => {
  it('removes exactly the DELETE_IDS rows from newParamValues', () => {
    const { records, sources } = makeFixture();
    const { newParamValues } = applyCuration(records, sources);
    for (const delId of BC_P28_DELETE_IDS) {
      expect(newParamValues.some(r => r.parameter_value_id === delId)).toBe(false);
    }
    expect(newParamValues.length).toBe(records.length - 4);
  });

  it('re-keys OLD->NEW in all 3 field locations on a remaining row and leaves other fields unchanged', () => {
    const { records, sources } = makeFixture();
    const targetId = 'pv-p28-other-1';
    const beforeRecord = clone(records.find(r => r.parameter_value_id === targetId));
    const { newParamValues } = applyCuration(records, sources);
    const afterRecord = newParamValues.find(r => r.parameter_value_id === targetId);

    const unchangedFields = ['value', 'unit', 'qa_status', 'default_status', 'candidate_group_id'];
    for (const f of unchangedFields) {
      expect(afterRecord[f]).toEqual(beforeRecord[f]);
    }

    expect(afterRecord.source_ids).toEqual([CURATE_NEW_ID]);
    expect(afterRecord.evidence_items[0].source_id).toBe(CURATE_NEW_ID);
    expect(afterRecord.source_relationships[0].source_id).toBe(CURATE_NEW_ID);
  });

  it('marks OLD source superseded (+superseded_by NEW +notes appended) without deleting it or modifying NEW', () => {
    const { records, sources } = makeFixture();
    const beforeNew = clone(sources.find(s => s.source_id === CURATE_NEW_ID));
    
    applyCuration(records, sources);

    const oldSource = sources.find(s => s.source_id === CURATE_OLD_ID);
    expect(oldSource).toBeDefined();
    expect(oldSource.status).toBe('superseded');
    expect(oldSource.superseded_by).toBe(CURATE_NEW_ID);
    expect(oldSource.notes).toContain('Superseded duplicate of src-bc-protocol-28-v3-0-2024');

    const afterNew = sources.find(s => s.source_id === CURATE_NEW_ID);
    expect(afterNew).toEqual(beforeNew);
  });

  it('is idempotent (second applyCuration on applied state yields 0 deletes, 0 rekeys, no OLD refs)', () => {
    const { records, sources } = makeFixture();
    
    const res1 = applyCuration(records, sources);
    expect(res1.deleteCount).toBe(4);
    expect(res1.rekeyCount).toBe(3);
    expect(res1.sourceTouched).toBe(true);

    const res2 = applyCuration(res1.newParamValues, sources);
    expect(res2.deleteCount).toBe(0);
    expect(res2.rekeyCount).toBe(0);
    expect(res2.sourceTouched).toBe(false);

    for (const r of res2.newParamValues) {
      expect(r.source_ids).not.toContain(CURATE_OLD_ID);
      if (Array.isArray(r.evidence_items)) {
        for (const ev of r.evidence_items) {
          if (ev) expect(ev.source_id).not.toBe(CURATE_OLD_ID);
        }
      }
      if (Array.isArray(r.source_relationships)) {
        for (const rel of r.source_relationships) {
          if (rel) expect(rel.source_id).not.toBe(CURATE_OLD_ID);
        }
      }
    }
  });

  it('deduplicates source_ids if NEW is already present alongside OLD', () => {
    const { records, sources } = makeFixture();
    const targetId = 'pv-p28-both-old-new';
    const beforeRecord = records.find(r => r.parameter_value_id === targetId);
    expect(beforeRecord.source_ids).toEqual([CURATE_OLD_ID, CURATE_NEW_ID]);

    const { newParamValues } = applyCuration(records, sources);
    const afterRecord = newParamValues.find(r => r.parameter_value_id === targetId);
    expect(afterRecord.source_ids).toEqual([CURATE_NEW_ID]);
  });
});
