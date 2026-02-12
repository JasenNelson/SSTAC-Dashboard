/**
 * HITL Packet TypeScript Types
 *
 * Matches the contract defined in:
 *   engine/scripts/core/hitl_packet.py (Phase 4)
 *
 * Schema version: hitl_packet_v1
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const SCHEMA_VERSION = 'hitl_packet_v1' as const;

/**
 * Dotted-path keys that MUST exist on every record.
 * Matches REQUIRED_RECORD_KEYS in hitl_packet.py exactly.
 */
export const REQUIRED_RECORD_KEYS = [
  'session_id',
  'policy_id',
  'tier',
  'keyword.raw_score',
  'keyword.capped_score',
  'keyword.decision_score',
  'keyword.threshold',
  'keyword.quality_flags',
  'ai.invoked',
  'ai.invocation_reason',
  'decision.display_status',
  'decision.confidence_label',
  'decision.matched',
  'evidence.best_evidence_location',
  'evidence.best_evidence_excerpt',
  'provenance.keyword_source',
  'criteria.evidence_criteria_used',
] as const;

// ---------------------------------------------------------------------------
// Record sub-types
// ---------------------------------------------------------------------------

export interface QualityFlags {
  high_repeat_density: boolean;
  low_source_diversity: boolean;
  low_keyword_diversity: boolean;
  [key: string]: boolean;
}

export interface KeywordSection {
  raw_score: number;
  capped_score: number;
  decision_score: number;
  threshold: number;
  quality_flags: QualityFlags;
  keywords_searched?: number;
  sections_searched?: number;
  phrase_matches?: number;
  word_matches?: number;
  acronym_matches?: number;
  top_keyword_matches?: unknown[];
  match_breakdown?: Record<string, unknown>;
}

export interface AISection {
  invoked: boolean;
  invocation_reason: string;
  fused_score?: number | null;
  raw_score?: number | null;
  reasoning?: string | null;
  confidence?: string | null;
  classification?: string | null;
  evidence_found?: unknown | null;
  flags?: unknown | null;
}

export interface DecisionSection {
  display_status: string;
  confidence_label: string;
  matched: boolean;
}

export interface EvidenceSection {
  best_evidence_location: string;
  best_evidence_excerpt: string;
  evidence_sections?: string[];
  evidence_chunks?: unknown[];
  trace_completeness?: number;
}

export interface ProvenanceSection {
  keyword_source: string;
  specificity_filter_applied?: boolean;
  specificity_filter_result?: unknown | null;
}

export interface CriteriaSection {
  evidence_criteria_used: boolean;
  required_elements_found?: string[];
  required_elements_missing?: string[];
  fail_indicators_found?: string[];
  criteria_adjustment?: number;
}

// ---------------------------------------------------------------------------
// Record and Packet
// ---------------------------------------------------------------------------

export interface PacketRecord {
  session_id: string;
  policy_id: string;
  tier: string;
  keyword: KeywordSection;
  embedding?: Record<string, unknown>;
  ai: AISection;
  decision: DecisionSection;
  evidence: EvidenceSection;
  provenance: ProvenanceSection;
  criteria: CriteriaSection;
}

export interface PacketMetadata {
  session_id: string;
  generated_at: string;
  schema_version: string;
  record_count: number;
  policies_evaluated: number | null;
  policies_in_kb: number | null;
  policies_filtered: number | null;
}

export interface HitlPacket {
  schema_version: string;
  metadata: PacketMetadata;
  records: PacketRecord[];
}

// ---------------------------------------------------------------------------
// Flat record (for table display, CSV-like)
// ---------------------------------------------------------------------------

export interface FlatRecord {
  policy_id: string;
  tier: string;
  status: string;
  confidence: string;
  matched: boolean;
  raw_score: number | null;
  capped_score: number | null;
  decision_score: number | null;
  threshold: number | null;
  quality_flags: string;
  ai_invoked: boolean;
  ai_invocation_reason: string;
  best_evidence_location: string;
  keyword_source: string;
  evidence_criteria_used: boolean;
  trace_completeness: number;
}

// ---------------------------------------------------------------------------
// Validation result
// ---------------------------------------------------------------------------

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Discovery types
// ---------------------------------------------------------------------------

export interface PacketSession {
  sessionId: string;
  jsonPath: string;
  csvPath: string | null;
  mdPath: string | null;
  metadata: PacketMetadata | null;
  modifiedAt: string;
}
