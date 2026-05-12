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
