-- Backfill migration: v2_evaluations, v2_per_policy_results, their RLS policies, GRANTs.
-- (Gate 2B branch-replay fix, Tier 1, file 2 of 6.)
--
-- Verbatim copy of supabase/engine_v2/database_schema_engine_v2_lane2a_patch.sql. Same untracked-
-- schema rationale as file 1 of this tier. Timestamped 20260512000002 (after file 1 in this same
-- tier, before 20260513) for dependency order only. Depends on: `v2_projects`, `v2_extraction_runs`
-- (this tier's file 1, 20260512000001) for its FK REFERENCES; `user_roles` (Tier 0, 20260510000001)
-- for its RLS policy checks.
--
-- This migration adds Tier 1 (engine_v2) branch-replay backfill only. It does NOT solve
-- matrix_reviews and does NOT authorize a Supabase branch-creation retry. Full branch replay is
-- still expected to fail at 20260515_matrix_security_audit.sql until matrix_reviews is resolved.
--
-- Root-cause + investigation trail: .tmp_gate2b_migration_repair_plan_20260708.md,
-- .tmp_gate2b_dbschema_inventory_report_20260708.md,
-- .tmp_gate2b_supabase_change_plan_20260708.md,
-- .tmp_agy_gate2b_tier1/TIER1_PLAN.md (all in the gate2b worktree, not committed).

-- engine_v2 frontend Lane 2a (demo MVP) schema patch.
-- See plan: docs/engine_v2_frontend_lane2a_plan_2026_05_12.md
-- Idempotent on fresh apply. EXIT GATE requires clean-slate confirmation:
--   SELECT to_regclass('public.v2_evaluations'),
--          to_regclass('public.v2_per_policy_results');
-- Both MUST return NULL before applying. If non-null, drop tables CASCADE first.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- v2_evaluations: one row per evaluation invocation.
CREATE TABLE IF NOT EXISTS v2_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES v2_projects(id) ON DELETE CASCADE,
  extraction_run_id UUID NOT NULL REFERENCES v2_extraction_runs(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'pending'
    CONSTRAINT v2_evaluations_status_check
    CHECK (status IN ('pending','running','completed','completed_with_errors','error')),
  run_id_engine UUID NULL,
  variant_config_hash TEXT NULL,
  evaluation_backend TEXT NOT NULL DEFAULT 'stub',
  embedder_backend TEXT NOT NULL DEFAULT 'stub',
  reranker_backend TEXT NOT NULL DEFAULT 'disabled',
  model TEXT NULL,
  bench_fixture TEXT NOT NULL DEFAULT 'bench_43_full',
  applicability_mode TEXT NOT NULL DEFAULT 'off',
  coverage_statement JSONB NOT NULL DEFAULT '{}'::jsonb,
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  raw_eval_result_json JSONB NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Race-safe idempotency: only one non-terminal evaluation per project at a time.
CREATE UNIQUE INDEX IF NOT EXISTS idx_v2_evaluations__one_active
  ON v2_evaluations (project_id)
  WHERE status NOT IN ('completed','completed_with_errors','error');

-- Engine-side run_id uniqueness so duplicate imports of same eval_result.json are no-op.
CREATE UNIQUE INDEX IF NOT EXISTS idx_v2_evaluations__run_id_engine
  ON v2_evaluations (run_id_engine) WHERE run_id_engine IS NOT NULL;

-- v2_per_policy_results: one row per (eval, policy, stage, packet_id) tuple.
CREATE TABLE IF NOT EXISTS v2_per_policy_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID NOT NULL REFERENCES v2_evaluations(id) ON DELETE CASCADE,
  policy_id TEXT NOT NULL,
  stage TEXT NULL,
  packet_id TEXT NULL,
  tier TEXT NULL,
  verdict_suggestion TEXT NULL,
  ai_suggestion TEXT NULL,
  confidence NUMERIC NULL,
  confidence_method TEXT NULL,
  summary TEXT NULL,
  evidence_packet JSONB NOT NULL DEFAULT '{}'::jsonb,
  pathway_notes JSONB NOT NULL DEFAULT '{}'::jsonb,
  rubric_self_score JSONB NULL,
  raw_result_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Idempotency key includes stage + packet_id to preserve multi-stage rows
-- per codex v0.2 amendment.
CREATE UNIQUE INDEX IF NOT EXISTS idx_v2_per_policy_results__eval_policy_stage_packet
  ON v2_per_policy_results (
    evaluation_id,
    policy_id,
    COALESCE(stage, ''),
    COALESCE(packet_id, '')
  );

-- RLS: per-admin-owner inherited from Lane 1 pattern. Owner of the parent
-- v2_projects row is the only authenticated admin who can access.
ALTER TABLE v2_evaluations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS v2_evaluations_owner_admin_all ON v2_evaluations;
CREATE POLICY v2_evaluations_owner_admin_all ON v2_evaluations FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM v2_projects p WHERE p.id = v2_evaluations.project_id AND p.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM v2_projects p WHERE p.id = v2_evaluations.project_id AND p.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

ALTER TABLE v2_per_policy_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS v2_per_policy_results_owner_admin_all ON v2_per_policy_results;
CREATE POLICY v2_per_policy_results_owner_admin_all ON v2_per_policy_results FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM v2_evaluations e
      JOIN v2_projects p ON p.id = e.project_id
      WHERE e.id = v2_per_policy_results.evaluation_id AND p.user_id = auth.uid()
    )
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM v2_evaluations e
      JOIN v2_projects p ON p.id = e.project_id
      WHERE e.id = v2_per_policy_results.evaluation_id AND p.user_id = auth.uid()
    )
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON v2_evaluations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON v2_per_policy_results TO authenticated;
