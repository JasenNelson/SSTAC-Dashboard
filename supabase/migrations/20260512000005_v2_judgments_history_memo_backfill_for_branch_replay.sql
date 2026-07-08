-- Backfill migration: v2_judgments, v2_judgment_history, v2_memo_exports,
-- v2_judgments_history_trigger() (pre-SECDEF-fix version -- see file 6 of this tier for the fix),
-- their RLS policies, GRANTs. (Gate 2B branch-replay fix, Tier 1, file 5 of 6.)
--
-- Verbatim copy of supabase/engine_v2/database_schema_engine_v2_lane2b_patch.sql. Same untracked-
-- schema rationale as this tier's file 1. Timestamped 20260512000005 (after this tier's file 4,
-- before 20260513) for dependency order only. Depends on: `v2_per_policy_results` (this tier's file
-- 2, 20260512000002) for v2_judgments' FK; `v2_evaluations` (this tier's file 2) for v2_memo_exports'
-- FK; `auth.users` (Supabase default) for reviewer_user_id/changed_by_user_id FKs; `user_roles`
-- (Tier 0, 20260510000001) for RLS policy checks. This file's own trigger function
-- (`v2_judgments_history_trigger()`) is SECURITY INVOKER as originally written -- file 6 of this
-- tier (`CREATE OR REPLACE FUNCTION`) supersedes it with a SECURITY DEFINER fix; both apply in this
-- order so a fresh branch ends up in the CURRENT (fixed) state, not the pre-2026-07-04 broken one.
--
-- This migration adds Tier 1 (engine_v2) branch-replay backfill only. It does NOT solve
-- matrix_reviews and does NOT authorize a Supabase branch-creation retry. Full branch replay is
-- still expected to fail at 20260515_matrix_security_audit.sql until matrix_reviews is resolved.
--
-- Root-cause + investigation trail: .tmp_gate2b_migration_repair_plan_20260708.md,
-- .tmp_gate2b_dbschema_inventory_report_20260708.md,
-- .tmp_gate2b_supabase_change_plan_20260708.md,
-- .tmp_agy_gate2b_tier1/TIER1_PLAN.md (all in the gate2b worktree, not committed).

CREATE TABLE IF NOT EXISTS v2_judgments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  per_policy_result_id UUID NOT NULL REFERENCES v2_per_policy_results(id) ON DELETE CASCADE,
  reviewer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  tier TEXT NOT NULL,
  verdict TEXT NOT NULL,
  rationale TEXT NULL,
  evidence_refs JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT v2_judgments_tier_verdict_check CHECK (
    (tier = 'TIER_1_BINARY'
      AND verdict IN ('ADEQUATE','INADEQUATE','DEFICIENT','REQUIRES_REVIEW')) OR
    (tier = 'TIER_2_PROFESSIONAL'
      AND verdict IN ('DEFICIENT','REQUIRES_REVIEW')) OR
    (tier = 'TIER_3_STATUTORY'
      AND verdict = 'OBSERVATION_ONLY')
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_v2_judgments__one_per_result
  ON v2_judgments (per_policy_result_id);
CREATE INDEX IF NOT EXISTS idx_v2_judgments__per_policy_created
  ON v2_judgments (per_policy_result_id, created_at DESC);

CREATE TABLE IF NOT EXISTS v2_judgment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  judgment_id UUID NOT NULL REFERENCES v2_judgments(id) ON DELETE CASCADE,
  prior_verdict TEXT NULL,
  prior_rationale TEXT NULL,
  prior_evidence_refs JSONB NULL,
  changed_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_v2_judgment_history__judgment_changed
  ON v2_judgment_history (judgment_id, changed_at DESC);

-- BEFORE UPDATE trigger: copy prior to history, refresh updated_at
CREATE OR REPLACE FUNCTION v2_judgments_history_trigger()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF (OLD.verdict IS DISTINCT FROM NEW.verdict
      OR OLD.rationale IS DISTINCT FROM NEW.rationale
      OR OLD.evidence_refs IS DISTINCT FROM NEW.evidence_refs) THEN
    INSERT INTO v2_judgment_history
      (judgment_id, prior_verdict, prior_rationale, prior_evidence_refs, changed_by_user_id)
    VALUES
      (OLD.id, OLD.verdict, OLD.rationale, OLD.evidence_refs, auth.uid());
    NEW.updated_at = now();
  END IF;
  RETURN NEW;
END
$$;
DROP TRIGGER IF EXISTS v2_judgments_history_before_update ON v2_judgments;
CREATE TRIGGER v2_judgments_history_before_update
  BEFORE UPDATE ON v2_judgments
  FOR EACH ROW EXECUTE FUNCTION v2_judgments_history_trigger();

CREATE TABLE IF NOT EXISTS v2_memo_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID NOT NULL REFERENCES v2_evaluations(id) ON DELETE CASCADE,
  generator_version TEXT NOT NULL,
  judgment_snapshot_hash TEXT NOT NULL,
  content_sha256 TEXT NOT NULL,
  storage_path TEXT NULL,
  content_blob BYTEA NULL,
  byte_size INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT v2_memo_exports_content_present CHECK (
    (storage_path IS NOT NULL) OR (content_blob IS NOT NULL)
  )
);
CREATE INDEX IF NOT EXISTS idx_v2_memo_exports__eval_created
  ON v2_memo_exports (evaluation_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_v2_memo_exports__eval_snapshot
  ON v2_memo_exports (evaluation_id, judgment_snapshot_hash);

-- RLS (mirrors Lane 2a per-admin-owner pattern)
ALTER TABLE v2_judgments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS v2_judgments_owner_admin_all ON v2_judgments;
CREATE POLICY v2_judgments_owner_admin_all ON v2_judgments FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM v2_per_policy_results r
      JOIN v2_evaluations e ON e.id = r.evaluation_id
      JOIN v2_projects p ON p.id = e.project_id
      WHERE r.id = v2_judgments.per_policy_result_id AND p.user_id = auth.uid()
    )
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM v2_per_policy_results r
      JOIN v2_evaluations e ON e.id = r.evaluation_id
      JOIN v2_projects p ON p.id = e.project_id
      WHERE r.id = v2_judgments.per_policy_result_id AND p.user_id = auth.uid()
    )
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

ALTER TABLE v2_judgment_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS v2_judgment_history_owner_admin_select ON v2_judgment_history;
CREATE POLICY v2_judgment_history_owner_admin_select ON v2_judgment_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM v2_judgments j
      JOIN v2_per_policy_results r ON r.id = j.per_policy_result_id
      JOIN v2_evaluations e ON e.id = r.evaluation_id
      JOIN v2_projects p ON p.id = e.project_id
      WHERE j.id = v2_judgment_history.judgment_id AND p.user_id = auth.uid()
    )
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
-- history INSERT is trigger-only; no INSERT/UPDATE/DELETE policies exposed to users

ALTER TABLE v2_memo_exports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS v2_memo_exports_owner_admin_all ON v2_memo_exports;
CREATE POLICY v2_memo_exports_owner_admin_all ON v2_memo_exports FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM v2_evaluations e
      JOIN v2_projects p ON p.id = e.project_id
      WHERE e.id = v2_memo_exports.evaluation_id AND p.user_id = auth.uid()
    )
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM v2_evaluations e
      JOIN v2_projects p ON p.id = e.project_id
      WHERE e.id = v2_memo_exports.evaluation_id AND p.user_id = auth.uid()
    )
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

GRANT SELECT, INSERT, UPDATE ON v2_judgments TO authenticated;
GRANT SELECT ON v2_judgment_history TO authenticated;
GRANT SELECT, INSERT, DELETE ON v2_memo_exports TO authenticated;
