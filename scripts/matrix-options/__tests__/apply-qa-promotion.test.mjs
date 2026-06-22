// Guards for the owner-run IRIS qa-promotion tool (apply-qa-promotion.mjs). Plain ASCII only.
//
// Verifies the tool's load-bearing guarantees on synthetic fixtures (independent of catalog state):
//  - arg parsing + apply-option validation,
//  - fail-closed preconditions (missing id, unexpected qa_status, no evidence, value drift),
//  - idempotency (already-approved targets are skipped),
//  - exact field edits + canonical variants + reviewed_* key placement,
//  - SCOPE: non-target records are never mutated.

import { describe, it, expect } from 'vitest';
import {
  TARGET_IDS,
  parseArgs,
  validateApplyOptions,
  planPromotion,
  applyPromotion,
} from '../apply-qa-promotion.mjs';

function makeRecord(id, i, overrides = {}) {
  return {
    parameter_value_id: id,
    substance_key: 's' + i,
    input_key: 'k' + i,
    value: 1,
    unit: 'mg/kg-bw/day',
    default_status: 'available_option',
    evidence_support_status: 'approved_source_backed',
    qa_status: 'needs_review',
    canonical_source_status: 'needs_direct_source_check',
    evidence_items: [
      {
        source_id: 'src-x',
        locator: 'loc',
        value_text: '1',
        extraction_method: 'manual_source_extraction',
        extracted_by: 'codex',
        extracted_at: '2026-06-02',
        qa_status: 'needs_review',
        note: 'n',
        evidence_id: 'ev-' + id + '-1',
        locator_type: 'source_table',
      },
    ],
    ...overrides,
  };
}

// All 20 targets present + a non-target record that must never be touched, plus a matching snapshot.
function makeFixture() {
  const records = TARGET_IDS.map((id, i) => makeRecord(id, i));
  records.push(makeRecord('pv-other-untouched', 999, { substance_key: 'sX', input_key: 'kX' }));
  const snapRecords = TARGET_IDS.map((id, i) => ({
    substance_key: 's' + i,
    input_key: 'k' + i,
    epa_values: [1],
  }));
  const snapshotIndex = new Map(snapRecords.map((r) => [r.substance_key + '::' + r.input_key, r]));
  return { records, snapshotIndex };
}

const clone = (x) => JSON.parse(JSON.stringify(x));
const APPLY_OPTS = { reviewer: 'J. Nelson', date: '2026-06-04', canonical: 'verified' };

describe('apply-qa-promotion: scope is exactly the 20 packet rows', () => {
  it('targets exactly 20 ids, all EPA-IRIS hh rows', () => {
    expect(TARGET_IDS).toHaveLength(20);
    expect(new Set(TARGET_IDS).size).toBe(20);
    for (const id of TARGET_IDS) expect(id.startsWith('pv-iris-')).toBe(true);
  });
});

describe('apply-qa-promotion: parseArgs', () => {
  it('parses flags and values', () => {
    const a = parseArgs(['node', 's', '--reviewer', 'J. Nelson', '--date', '2026-06-04', '--canonical', 'keep', '--apply']);
    expect(a).toMatchObject({ reviewer: 'J. Nelson', date: '2026-06-04', canonical: 'keep', apply: true });
  });
  it('defaults to a dry run', () => {
    expect(parseArgs(['node', 's']).apply).toBe(false);
  });
  it('throws on unknown argument', () => {
    expect(() => parseArgs(['node', 's', '--bogus'])).toThrow(/Unknown argument/);
  });
});

describe('apply-qa-promotion: validateApplyOptions', () => {
  it('accepts a complete attestation', () => {
    expect(() => validateApplyOptions(APPLY_OPTS)).not.toThrow();
  });
  it('requires reviewer', () => {
    expect(() => validateApplyOptions({ ...APPLY_OPTS, reviewer: '' })).toThrow(/reviewer/);
  });
  it('requires a YYYY-MM-DD date', () => {
    expect(() => validateApplyOptions({ ...APPLY_OPTS, date: '2026/06/04' })).toThrow(/date/);
  });
  it('requires canonical verified|keep', () => {
    expect(() => validateApplyOptions({ ...APPLY_OPTS, canonical: 'maybe' })).toThrow(/canonical/);
  });
});

describe('apply-qa-promotion: planPromotion preconditions (fail-closed)', () => {
  it('plans all 20 when every target is needs_review and anchored', () => {
    const { records, snapshotIndex } = makeFixture();
    const { promote, skip } = planPromotion(records, snapshotIndex, APPLY_OPTS);
    expect(promote).toHaveLength(20);
    expect(skip).toHaveLength(0);
  });
  it('throws when a target id is missing', () => {
    const { records, snapshotIndex } = makeFixture();
    const filtered = records.filter((r) => r.parameter_value_id !== TARGET_IDS[3]);
    expect(() => planPromotion(filtered, snapshotIndex, APPLY_OPTS)).toThrow(/not found/);
  });
  it('throws on an unexpected qa_status', () => {
    const { records, snapshotIndex } = makeFixture();
    records.find((r) => r.parameter_value_id === TARGET_IDS[0]).qa_status = 'superseded';
    expect(() => planPromotion(records, snapshotIndex, APPLY_OPTS)).toThrow(/unexpected qa_status/);
  });
  it('throws when a target has no evidence_items', () => {
    const { records, snapshotIndex } = makeFixture();
    records.find((r) => r.parameter_value_id === TARGET_IDS[1]).evidence_items = [];
    expect(() => planPromotion(records, snapshotIndex, APPLY_OPTS)).toThrow(/no evidence_items/);
  });
  it('throws when no EPA snapshot anchor exists', () => {
    const { records, snapshotIndex } = makeFixture();
    snapshotIndex.delete('s2::k2'); // remove the anchor for TARGET_IDS[2]
    expect(() => planPromotion(records, snapshotIndex, APPLY_OPTS)).toThrow(/snapshot anchor/);
  });
  it('throws when a value has drifted from the EPA snapshot (>2%)', () => {
    const { records, snapshotIndex } = makeFixture();
    records.find((r) => r.parameter_value_id === TARGET_IDS[4]).value = 2; // anchor epa_values=[1]
    expect(() => planPromotion(records, snapshotIndex, APPLY_OPTS)).toThrow(/within 2%|drifted/);
  });
  it('fails closed when an ALREADY-APPROVED target value has drifted (repair path is snapshot-guarded)', () => {
    const { records, snapshotIndex } = makeFixture();
    const r = records.find((x) => x.parameter_value_id === TARGET_IDS[5]);
    r.qa_status = 'approved'; // routed to skip -> the snapshot gate still applies (repair writes it)
    r.value = 2; // anchor epa_values=[1] -> drifted from the EPA source
    expect(() => planPromotion(records, snapshotIndex, APPLY_OPTS)).toThrow(/within 2%|drifted/);
  });
});

describe('apply-qa-promotion: idempotency', () => {
  it('skips targets that are already approved', () => {
    const { records, snapshotIndex } = makeFixture();
    for (const r of records) {
      if (TARGET_IDS.includes(r.parameter_value_id)) r.qa_status = 'approved';
    }
    const { promote, skip } = planPromotion(records, snapshotIndex, APPLY_OPTS);
    expect(promote).toHaveLength(0);
    expect(skip).toHaveLength(20);
  });
  it('applyPromotion run twice is a no-op on the second run', () => {
    const { records, snapshotIndex } = makeFixture();
    applyPromotion(records, snapshotIndex, APPLY_OPTS);
    const second = applyPromotion(records, snapshotIndex, APPLY_OPTS);
    expect(second.promote).toHaveLength(0);
    expect(second.skip).toHaveLength(20);
    // The note is stamped exactly once across two runs (the marker guard prevents double-stamping).
    const ev0 = records.find((r) => r.parameter_value_id === TARGET_IDS[0]).evidence_items[0];
    expect(ev0.note.match(/Evidence PROMOTED to approved/g)).toHaveLength(1);
  });
});

describe('apply-qa-promotion: field edits', () => {
  it('canonical=verified flips qa + evidence + adds attestation + sets direct_source_verified', () => {
    const { records, snapshotIndex } = makeFixture();
    applyPromotion(records, snapshotIndex, APPLY_OPTS);
    for (const id of TARGET_IDS) {
      const r = records.find((x) => x.parameter_value_id === id);
      expect(r.qa_status).toBe('approved');
      expect(r.canonical_source_status).toBe('direct_source_verified');
      expect(r.default_status).toBe('available_option'); // never promoted to a default
      expect(r.value).toBe(1); // value untouched
      const ev = r.evidence_items[0];
      expect(ev.qa_status).toBe('approved');
      expect(ev.reviewed_by).toBe('J. Nelson');
      expect(ev.reviewed_at).toBe('2026-06-04');
      // A promoted evidence item must not keep a "pending direct-source verification" note.
      expect(ev.note, id).toContain('Evidence PROMOTED to approved');
      // reviewed_by/reviewed_at sit immediately AFTER qa_status (canonical schema order).
      const keys = Object.keys(ev);
      const qi = keys.indexOf('qa_status');
      expect(keys[qi + 1]).toBe('reviewed_by');
      expect(keys[qi + 2]).toBe('reviewed_at');
    }
  });
  it('canonical=keep leaves canonical_source_status unchanged', () => {
    const { records, snapshotIndex } = makeFixture();
    applyPromotion(records, snapshotIndex, { ...APPLY_OPTS, canonical: 'keep' });
    for (const id of TARGET_IDS) {
      const r = records.find((x) => x.parameter_value_id === id);
      expect(r.qa_status).toBe('approved');
      expect(r.canonical_source_status).toBe('needs_direct_source_check');
      // The note stamp fires independent of --canonical (the caveat is superseded by HITL approval).
      expect(r.evidence_items[0].note, id).toContain('Evidence PROMOTED to approved');
    }
  });
  it('never mutates a non-target record', () => {
    const { records, snapshotIndex } = makeFixture();
    const before = clone(records.find((r) => r.parameter_value_id === 'pv-other-untouched'));
    applyPromotion(records, snapshotIndex, APPLY_OPTS);
    const after = records.find((r) => r.parameter_value_id === 'pv-other-untouched');
    expect(after).toEqual(before);
  });
});

describe('apply-qa-promotion: evidence-note repair on already-approved rows', () => {
  // The backport must repair the contradiction (approved row + "pending" evidence note) on rows
  // that were promoted by a PRIOR run, independent of the --canonical choice, and stay idempotent.
  it('stamps a stale note on already-approved rows under BOTH canonical variants; canonical is a no-op', () => {
    for (const canonical of ['verified', 'keep']) {
      const { records, snapshotIndex } = makeFixture();
      // Simulate a prior promotion: targets already approved + direct_source_verified, but their
      // evidence note still carries the stale robot-extraction "pending" caveat (the contradiction).
      for (const r of records) {
        if (!TARGET_IDS.includes(r.parameter_value_id)) continue;
        r.qa_status = 'approved';
        r.canonical_source_status = 'direct_source_verified';
        r.evidence_items[0].qa_status = 'approved';
        r.evidence_items[0].reviewed_by = 'J. Nelson';
        r.evidence_items[0].reviewed_at = '2026-06-04';
        r.evidence_items[0].note = 'Robot-extracted; pending direct-source verification.';
      }
      const res = applyPromotion(records, snapshotIndex, { ...APPLY_OPTS, canonical });
      expect(res.promote, canonical).toHaveLength(0); // nothing to promote -- repair-only
      expect(res.repaired, canonical).toHaveLength(20);
      for (const id of TARGET_IDS) {
        const r = records.find((x) => x.parameter_value_id === id);
        expect(r.evidence_items[0].note, id).toContain('Evidence PROMOTED to approved');
        // canonical_source_status is never read or written by the repair pass -> stays as-was.
        expect(r.canonical_source_status, id).toBe('direct_source_verified');
        expect(r.qa_status, id).toBe('approved');
      }
      // Idempotent: a second repair run stamps nothing more.
      const second = applyPromotion(records, snapshotIndex, { ...APPLY_OPTS, canonical });
      expect(second.repaired, canonical).toHaveLength(0);
    }
  });

  it('does NOT stamp a row whose evidence is only partially approved (fail-safe, no false approval)', () => {
    const { records, snapshotIndex } = makeFixture();
    const partialId = TARGET_IDS[0];
    for (const r of records) {
      if (!TARGET_IDS.includes(r.parameter_value_id)) continue;
      r.qa_status = 'approved'; // top-level approved -> planPromotion routes it to skip
      r.evidence_items[0].qa_status = 'approved';
      r.evidence_items[0].reviewed_by = 'J. Nelson';
      r.evidence_items[0].reviewed_at = '2026-06-04';
      r.evidence_items[0].note = 'Robot-extracted; pending direct-source verification.';
    }
    // Drift ONE row into a partial state: its evidence is still needs_review (NOT approved/attested).
    const partial = records.find((r) => r.parameter_value_id === partialId);
    partial.evidence_items[0].qa_status = 'needs_review';
    delete partial.evidence_items[0].reviewed_by;
    delete partial.evidence_items[0].reviewed_at;

    const res = applyPromotion(records, snapshotIndex, APPLY_OPTS);
    // The partial row is NOT stamped (we never assert approval on unapproved evidence).
    expect(res.repaired).not.toContain(partialId);
    expect(partial.evidence_items[0].note).not.toContain('Evidence PROMOTED to approved');
    // The fully-approved rows ARE still repaired.
    expect(res.repaired).toContain(TARGET_IDS[1]);
  });
});
