/**
 * Flatten a nested PacketRecord into a single-level FlatRecord.
 *
 * Mirrors _flatten_record() in engine/scripts/core/hitl_packet.py.
 */

import type { PacketRecord, FlatRecord } from './types';

/**
 * Flatten a nested packet record for table display.
 *
 * Quality flags are compacted to a comma-separated string
 * of active (true) flag names, matching the Python behaviour.
 */
export function flattenRecord(rec: PacketRecord): FlatRecord {
  const kw = rec.keyword ?? {};
  const ai = rec.ai ?? {};
  const dec = rec.decision ?? {};
  const ev = rec.evidence ?? {};
  const prov = rec.provenance ?? {};
  const crit = rec.criteria ?? {};
  const qf = kw.quality_flags ?? {};

  // Compact quality flags: only active (true) flags, comma-separated
  const activeFlags =
    typeof qf === 'object' && qf !== null
      ? Object.entries(qf)
          .filter(([, v]) => v === true)
          .map(([k]) => k)
          .join(',')
      : String(qf);

  return {
    policy_id: rec.policy_id ?? '',
    tier: rec.tier ?? '',
    status: dec.display_status ?? '',
    confidence: dec.confidence_label ?? '',
    matched: dec.matched ?? false,
    raw_score: kw.raw_score ?? null,
    capped_score: kw.capped_score ?? null,
    decision_score: kw.decision_score ?? null,
    threshold: kw.threshold ?? null,
    quality_flags: activeFlags,
    ai_invoked: ai.invoked ?? false,
    ai_invocation_reason: ai.invocation_reason ?? '',
    best_evidence_location: ev.best_evidence_location ?? '',
    keyword_source: prov.keyword_source ?? '',
    evidence_criteria_used: crit.evidence_criteria_used ?? false,
    trace_completeness: ev.trace_completeness ?? 0.0,
  };
}
