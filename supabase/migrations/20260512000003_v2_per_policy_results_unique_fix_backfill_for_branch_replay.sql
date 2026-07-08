-- Backfill migration: v2_per_policy_results unique-index hotfix (plain-column index instead of an
-- expression-based one, so onConflict matches). (Gate 2B branch-replay fix, Tier 1, file 3 of 6.)
--
-- Verbatim copy of supabase/engine_v2/database_schema_engine_v2_lane2a_fix_unique.sql. Same
-- untracked-schema rationale as this tier's file 1. Timestamped 20260512000003 (after this tier's
-- file 2, before 20260513) for dependency order only. Depends on: `v2_per_policy_results` (this
-- tier's file 2, 20260512000002) -- the table, its `stage`/`packet_id` columns, and its existing
-- unique index must already exist for this file's UPDATE/ALTER/DROP INDEX/CREATE INDEX statements
-- to have something to operate on. On a fresh branch replay, the two UPDATE statements below affect
-- 0 rows (table just created empty) -- harmless no-ops.
--
-- This migration adds Tier 1 (engine_v2) branch-replay backfill only. It does NOT solve
-- matrix_reviews and does NOT authorize a Supabase branch-creation retry. Full branch replay is
-- still expected to fail at 20260515_matrix_security_audit.sql until matrix_reviews is resolved.
--
-- Root-cause + investigation trail: .tmp_gate2b_migration_repair_plan_20260708.md,
-- .tmp_gate2b_dbschema_inventory_report_20260708.md,
-- .tmp_gate2b_supabase_change_plan_20260708.md,
-- .tmp_agy_gate2b_tier1/TIER1_PLAN.md (all in the gate2b worktree, not committed).

-- engine_v2 Lane 2a hotfix: replace expression-based unique index on
-- v2_per_policy_results with a plain-column unique index so Supabase
-- upsert({onConflict: "evaluation_id,policy_id,stage,packet_id"}) matches.
--
-- Verified 2026-05-12 against engine eval_result.json: every row emits
-- non-null stage and packet_id, so NOT NULL DEFAULT '' is safe.

UPDATE v2_per_policy_results SET stage = '' WHERE stage IS NULL;
UPDATE v2_per_policy_results SET packet_id = '' WHERE packet_id IS NULL;

ALTER TABLE v2_per_policy_results
  ALTER COLUMN stage SET DEFAULT '',
  ALTER COLUMN stage SET NOT NULL,
  ALTER COLUMN packet_id SET DEFAULT '',
  ALTER COLUMN packet_id SET NOT NULL;

DROP INDEX IF EXISTS idx_v2_per_policy_results__eval_policy_stage_packet;

CREATE UNIQUE INDEX idx_v2_per_policy_results__eval_policy_stage_packet
  ON v2_per_policy_results (evaluation_id, policy_id, stage, packet_id);
