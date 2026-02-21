/**
 * Tests for HITL Packet Zod schema validation.
 */

import { describe, it, expect } from 'vitest';
import { hitlPacketSchema } from '../schema';
import { SCHEMA_VERSION } from '../types';

function makeValidPacket() {
  return {
    schema_version: SCHEMA_VERSION,
    metadata: {
      session_id: 'S1',
      generated_at: '2026-02-12T00:00:00Z',
      schema_version: SCHEMA_VERSION,
      record_count: 1,
      policies_evaluated: 1,
      policies_in_kb: null,
      policies_filtered: null,
    },
    records: [
      {
        session_id: 'S1',
        policy_id: 'POL-001',
        tier: 'TIER_1_BINARY',
        keyword: {
          raw_score: 5.0,
          capped_score: 5.0,
          decision_score: 1.0,
          threshold: 5.0,
          quality_flags: { high_repeat_density: false },
        },
        ai: { invoked: false, invocation_reason: 'ai_disabled' },
        decision: { display_status: 'PASS', confidence_label: 'HIGH', matched: true },
        evidence: { best_evidence_location: 'Section 1', best_evidence_excerpt: 'excerpt' },
        provenance: { keyword_source: 'keyword_metadata' },
        criteria: { evidence_criteria_used: false },
      },
    ],
  };
}

describe('hitlPacketSchema', () => {
  it('accepts valid packet', () => {
    const result = hitlPacketSchema.safeParse(makeValidPacket());
    expect(result.success).toBe(true);
  });

  it('rejects wrong schema_version', () => {
    const pkt = makeValidPacket();
    pkt.schema_version = 'wrong_version' as typeof SCHEMA_VERSION;
    const result = hitlPacketSchema.safeParse(pkt);
    expect(result.success).toBe(false);
  });

  it('rejects missing metadata.session_id', () => {
    const pkt = makeValidPacket();
    delete (pkt.metadata as Record<string, unknown>).session_id;
    const result = hitlPacketSchema.safeParse(pkt);
    expect(result.success).toBe(false);
  });

  it('rejects negative record_count', () => {
    const pkt = makeValidPacket();
    pkt.metadata.record_count = -1;
    const result = hitlPacketSchema.safeParse(pkt);
    expect(result.success).toBe(false);
  });

  it('rejects missing record keyword section', () => {
    const pkt = makeValidPacket();
    delete (pkt.records[0] as Record<string, unknown>).keyword;
    const result = hitlPacketSchema.safeParse(pkt);
    expect(result.success).toBe(false);
  });

  it('rejects missing record decision.matched', () => {
    const pkt = makeValidPacket();
    delete (pkt.records[0].decision as Record<string, unknown>).matched;
    const result = hitlPacketSchema.safeParse(pkt);
    expect(result.success).toBe(false);
  });

  it('accepts packet with extra record fields (passthrough)', () => {
    const pkt = makeValidPacket();
    (pkt.records[0] as Record<string, unknown>).embedding = { extra: true };
    const result = hitlPacketSchema.safeParse(pkt);
    expect(result.success).toBe(true);
  });

  it('accepts empty records array', () => {
    const pkt = makeValidPacket();
    pkt.records = [];
    pkt.metadata.record_count = 0;
    pkt.metadata.policies_evaluated = 0;
    const result = hitlPacketSchema.safeParse(pkt);
    expect(result.success).toBe(true);
  });
});
