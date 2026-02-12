/**
 * Tests for HITL Packet flatten utility.
 */

import { describe, it, expect } from 'vitest';
import { flattenRecord } from '../flatten';
import type { PacketRecord } from '../types';

function makeRecord(overrides: Partial<PacketRecord> = {}): PacketRecord {
  return {
    session_id: 'S1',
    policy_id: 'POL-001',
    tier: 'TIER_1_BINARY',
    keyword: {
      raw_score: 5.0,
      capped_score: 4.0,
      decision_score: 0.8,
      threshold: 5.0,
      quality_flags: {
        high_repeat_density: false,
        low_source_diversity: false,
        low_keyword_diversity: false,
      },
    },
    ai: { invoked: false, invocation_reason: 'ai_disabled' },
    decision: { display_status: 'PASS', confidence_label: 'HIGH', matched: true },
    evidence: {
      best_evidence_location: 'Section 1',
      best_evidence_excerpt: 'excerpt text',
      trace_completeness: 1.0,
    },
    provenance: { keyword_source: 'keyword_metadata' },
    criteria: { evidence_criteria_used: false },
    ...overrides,
  };
}

describe('flattenRecord', () => {
  it('maps all expected columns', () => {
    const flat = flattenRecord(makeRecord());

    expect(flat.policy_id).toBe('POL-001');
    expect(flat.tier).toBe('TIER_1_BINARY');
    expect(flat.status).toBe('PASS');
    expect(flat.confidence).toBe('HIGH');
    expect(flat.matched).toBe(true);
    expect(flat.raw_score).toBe(5.0);
    expect(flat.capped_score).toBe(4.0);
    expect(flat.decision_score).toBe(0.8);
    expect(flat.threshold).toBe(5.0);
    expect(flat.ai_invoked).toBe(false);
    expect(flat.ai_invocation_reason).toBe('ai_disabled');
    expect(flat.best_evidence_location).toBe('Section 1');
    expect(flat.keyword_source).toBe('keyword_metadata');
    expect(flat.evidence_criteria_used).toBe(false);
    expect(flat.trace_completeness).toBe(1.0);
  });

  it('compacts active quality flags to comma-separated string', () => {
    const rec = makeRecord();
    rec.keyword.quality_flags = {
      high_repeat_density: true,
      low_source_diversity: false,
      low_keyword_diversity: true,
    };
    const flat = flattenRecord(rec);

    expect(flat.quality_flags).toContain('high_repeat_density');
    expect(flat.quality_flags).toContain('low_keyword_diversity');
    expect(flat.quality_flags).not.toContain('low_source_diversity');
  });

  it('empty quality flags yields empty string', () => {
    const rec = makeRecord();
    rec.keyword.quality_flags = {} as PacketRecord['keyword']['quality_flags'];
    const flat = flattenRecord(rec);
    expect(flat.quality_flags).toBe('');
  });

  it('no active flags yields empty string', () => {
    const rec = makeRecord();
    rec.keyword.quality_flags = {
      high_repeat_density: false,
      low_source_diversity: false,
      low_keyword_diversity: false,
    };
    const flat = flattenRecord(rec);
    expect(flat.quality_flags).toBe('');
  });
});
