// engine_v2 frontend Lane 2a: TypeScript types for evaluation flow.
// Mirrors database/Zod boundaries. See plan v0.2.

export type EvaluationStatus =
  | "pending"
  | "running"
  | "completed"
  | "completed_with_errors"
  | "error";

export const TERMINAL_EVALUATION_STATUSES: readonly EvaluationStatus[] = [
  "completed",
  "completed_with_errors",
  "error",
] as const;

export interface V2Evaluation {
  id: string;
  project_id: string;
  extraction_run_id: string;
  status: EvaluationStatus;
  run_id_engine: string | null;
  variant_config_hash: string | null;
  evaluation_backend: string;
  embedder_backend: string;
  reranker_backend: string;
  model: string | null;
  bench_fixture: string;
  applicability_mode: string;
  coverage_statement: Record<string, unknown>;
  errors: unknown[];
  raw_eval_result_json: Record<string, unknown> | null;
  started_at: string;
  completed_at: string | null;
  updated_at: string;
}

export interface V2PerPolicyResult {
  id: string;
  evaluation_id: string;
  policy_id: string;
  stage: string | null;
  packet_id: string | null;
  tier: string | null;
  verdict_suggestion: string | null;
  ai_suggestion: string | null;
  confidence: number | null;
  confidence_method: string | null;
  summary: string | null;
  evidence_packet: Record<string, unknown>;
  pathway_notes: Record<string, unknown>;
  rubric_self_score: Record<string, unknown> | null;
  raw_result_json: Record<string, unknown>;
  created_at: string;
}

export interface EvalCoverageStatement {
  total_policies?: number;
  evaluated?: number;
  deferred?: number;
  error?: number;
  deferred_reasons?: Record<string, number>;
}

// Lane 2b: judgment + memo types (appended; do not modify Lane 2a exports above).

export type JudgmentTier = "TIER_1_BINARY" | "TIER_2_PROFESSIONAL" | "TIER_3_STATUTORY";

export type JudgmentVerdict =
  | "ADEQUATE"
  | "INADEQUATE"
  | "DEFICIENT"
  | "REQUIRES_REVIEW"
  | "OBSERVATION_ONLY";

// Mirrors the SQL CHECK constraint v2_judgments_tier_verdict_check exactly.
// Source of truth: docs/engine_v2_frontend_lane2b_plan_2026_05_12.md L2b-1.
export const ALLOWED_VERDICTS_BY_TIER: Record<JudgmentTier, readonly JudgmentVerdict[]> = {
  TIER_1_BINARY: ["ADEQUATE", "INADEQUATE", "DEFICIENT", "REQUIRES_REVIEW"],
  TIER_2_PROFESSIONAL: ["DEFICIENT", "REQUIRES_REVIEW"],
  TIER_3_STATUTORY: ["OBSERVATION_ONLY"],
} as const;

export interface V2Judgment {
  id: string;
  per_policy_result_id: string;
  reviewer_user_id: string;
  tier: JudgmentTier;
  verdict: JudgmentVerdict;
  rationale: string | null;
  evidence_refs: unknown[];
  created_at: string;
  updated_at: string;
}

export interface V2JudgmentHistoryRow {
  id: string;
  judgment_id: string;
  prior_verdict: JudgmentVerdict | null;
  prior_rationale: string | null;
  prior_evidence_refs: unknown[] | null;
  changed_by_user_id: string;
  changed_at: string;
}

export interface V2MemoExport {
  id: string;
  evaluation_id: string;
  generator_version: string;
  judgment_snapshot_hash: string;
  content_sha256: string;
  storage_path: string | null;
  content_blob: unknown | null; // Buffer / Uint8Array on Node; opaque on the wire.
  byte_size: number;
  created_at: string;
}
