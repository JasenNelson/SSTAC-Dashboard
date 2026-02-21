/**
 * Tests for HITL Packet validator.
 *
 * Mirrors the 6 validation checks from Python validate_packet().
 */

import { describe, it, expect } from 'vitest';
import { validatePacket } from '../validator';
import { SCHEMA_VERSION } from '../types';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeRecord(overrides: Record<string, unknown> = {}) {
  return {
    session_id: 'S1',
    policy_id: 'POL-001',
    tier: 'TIER_1_BINARY',
    keyword: {
      raw_score: 5.0,
      capped_score: 5.0,
      decision_score: 1.0,
      threshold: 5.0,
      quality_flags: { high_repeat_density: false, low_source_diversity: false, low_keyword_diversity: false },
    },
    ai: { invoked: false, invocation_reason: 'ai_disabled' },
    decision: { display_status: 'PASS', confidence_label: 'HIGH', matched: true },
    evidence: { best_evidence_location: 'Section 1', best_evidence_excerpt: 'excerpt' },
    provenance: { keyword_source: 'keyword_metadata' },
    criteria: { evidence_criteria_used: false },
    ...overrides,
  };
}

function makePacket(overrides: Record<string, unknown> = {}, records?: unknown[]) {
  const recs = records ?? [makeRecord()];
  return {
    schema_version: SCHEMA_VERSION,
    metadata: {
      session_id: 'S1',
      generated_at: '2026-02-12T00:00:00Z',
      schema_version: SCHEMA_VERSION,
      record_count: recs.length,
      policies_evaluated: recs.length,
      policies_in_kb: null,
      policies_filtered: null,
    },
    records: recs,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('validatePacket', () => {
  it('valid packet passes', () => {
    const result = validatePacket(makePacket());
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('non-object input fails', () => {
    const result = validatePacket(null);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Packet is not an object');
  });

  // Check 1: top-level keys
  it('missing schema_version detected', () => {
    const pkt = makePacket();
    delete (pkt as Record<string, unknown>).schema_version;
    const result = validatePacket(pkt);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Missing top-level key: schema_version');
  });

  it('missing metadata detected', () => {
    const pkt = makePacket();
    delete (pkt as Record<string, unknown>).metadata;
    const result = validatePacket(pkt);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Missing top-level key: metadata');
  });

  it('missing records detected', () => {
    const pkt = makePacket();
    delete (pkt as Record<string, unknown>).records;
    const result = validatePacket(pkt);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Missing top-level key: records');
  });

  // Check 2: metadata fields
  it('missing metadata session_id detected', () => {
    const pkt = makePacket();
    delete (pkt.metadata as Record<string, unknown>).session_id;
    const result = validatePacket(pkt);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Missing or null metadata field: session_id');
  });

  it('null metadata generated_at detected', () => {
    const pkt = makePacket();
    (pkt.metadata as Record<string, unknown>).generated_at = null;
    const result = validatePacket(pkt);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Missing or null metadata field: generated_at');
  });

  // Check 3: record count mismatch
  it('record_count mismatch detected', () => {
    const pkt = makePacket();
    pkt.metadata.record_count = 999;
    const result = validatePacket(pkt);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('record_count mismatch'))).toBe(true);
  });

  // Check 4: required record keys
  it('missing nested record key detected', () => {
    const rec = makeRecord();
    delete (rec.ai as Record<string, unknown>).invocation_reason;
    const pkt = makePacket({}, [rec]);
    const result = validatePacket(pkt);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('ai.invocation_reason'))).toBe(true);
  });

  it('missing top-level record key detected', () => {
    const rec = makeRecord();
    delete (rec as Record<string, unknown>).tier;
    const pkt = makePacket({}, [rec]);
    const result = validatePacket(pkt);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('missing key tier'))).toBe(true);
  });

  // Check 5: sort order
  it('unsorted records detected', () => {
    const recs = [makeRecord({ policy_id: 'ZZZ-001' }), makeRecord({ policy_id: 'AAA-001' })];
    const pkt = makePacket({}, recs);
    pkt.metadata.record_count = 2;
    const result = validatePacket(pkt);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Records are not sorted by policy_id');
  });

  it('sorted records pass', () => {
    const recs = [makeRecord({ policy_id: 'AAA-001' }), makeRecord({ policy_id: 'ZZZ-001' })];
    const pkt = makePacket({}, recs);
    pkt.metadata.record_count = 2;
    const result = validatePacket(pkt);
    expect(result.isValid).toBe(true);
  });

  // Check 6: duplicates
  it('duplicate policy_ids detected', () => {
    const recs = [makeRecord({ policy_id: 'DUP-001' }), makeRecord({ policy_id: 'DUP-001' })];
    const pkt = makePacket({}, recs);
    pkt.metadata.record_count = 2;
    const result = validatePacket(pkt);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('Duplicate policy_id: DUP-001'))).toBe(true);
  });

  // Empty packet
  it('empty records is valid', () => {
    const pkt = makePacket({}, []);
    pkt.metadata.record_count = 0;
    const result = validatePacket(pkt);
    expect(result.isValid).toBe(true);
  });

  // Multi-record valid
  it('multi-record sorted packet passes', () => {
    const recs = [
      makeRecord({ policy_id: 'AAA-001' }),
      makeRecord({ policy_id: 'BBB-002' }),
      makeRecord({ policy_id: 'CCC-003' }),
    ];
    const pkt = makePacket({}, recs);
    pkt.metadata.record_count = 3;
    const result = validatePacket(pkt);
    expect(result.isValid).toBe(true);
  });

  // Type guard hardening: never throw on malformed input
  it('records as string does not throw', () => {
    const pkt = makePacket();
    (pkt as Record<string, unknown>).records = 'not-an-array';
    const result = validatePacket(pkt);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('records is not an array');
  });

  it('metadata as string does not throw', () => {
    const pkt = makePacket();
    (pkt as Record<string, unknown>).metadata = 'not-an-object';
    const result = validatePacket(pkt);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('metadata is not an object');
  });

  it('record entry as null does not throw', () => {
    const pkt = makePacket({}, [null as unknown]);
    pkt.metadata.record_count = 1;
    const result = validatePacket(pkt);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((e) => e.includes('not an object'))).toBe(true);
  });

  it('records as number does not throw', () => {
    const pkt = makePacket();
    (pkt as Record<string, unknown>).records = 42;
    const result = validatePacket(pkt);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('records is not an array');
  });
});
