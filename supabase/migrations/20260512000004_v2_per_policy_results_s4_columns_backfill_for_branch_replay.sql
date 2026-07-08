-- Backfill migration: 5 nullable S4 expand-contract columns + index on v2_per_policy_results.
-- (Gate 2B branch-replay fix, Tier 1, file 4 of 6.)
--
-- Verbatim copy of supabase/engine_v2/database_schema_engine_v2_lane2a_s4_expand_record.sql. Same
-- untracked-schema rationale as this tier's file 1. The source file's own header already states it
-- is "safe for record / replay environments (CI, fresh branches)" -- no additional idempotency
-- guards were needed (source already uses ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS
-- throughout). Timestamped 20260512000004 (after this tier's file 3, before 20260513) for
-- dependency order only. Depends on: `v2_per_policy_results` (this tier's file 2, 20260512000002)
-- -- the table must already exist for these ALTER TABLE ADD COLUMN statements.
--
-- This migration adds Tier 1 (engine_v2) branch-replay backfill only. It does NOT solve
-- matrix_reviews and does NOT authorize a Supabase branch-creation retry. Full branch replay is
-- still expected to fail at 20260515_matrix_security_audit.sql until matrix_reviews is resolved.
--
-- Root-cause + investigation trail: .tmp_gate2b_migration_repair_plan_20260708.md,
-- .tmp_gate2b_dbschema_inventory_report_20260708.md,
-- .tmp_gate2b_supabase_change_plan_20260708.md,
-- .tmp_agy_gate2b_tier1/TIER1_PLAN.md (all in the gate2b worktree, not committed).

-- engine_v2 S4 expand-contract: RECORD of columns already applied to the live DB.
--
-- IMPORTANT: This file RECORDS an EXPAND already applied to the live Supabase DB
-- on 2026-06-01, as verified by S4_SUPABASE_EXPLORE_RESULT_2026_06_01.md
-- (5 nullable columns + index live; 467/467 existing rows have NULL for these cols).
-- Do NOT re-run this SQL manually against the production DB -- the columns and
-- index are already present. The statements below use IF NOT EXISTS guards so
-- this file is safe for record / replay environments (CI, fresh branches).
--
-- Authority: engine_v2/docs/S4_DASHBOARD_CHANGE_SPEC.md section 2 + 7.
-- Plain ASCII only (every char code-point <= 127).

-- ---- 5 nullable S4 expand-contract columns ----
--
-- s4_schema_version: per-packet S4 version; the branch key (Rule 1).
--   NULL means legacy 0.0.1 row (predates the 0.1.0 emit; no backfill).
ALTER TABLE v2_per_policy_results
  ADD COLUMN IF NOT EXISTS s4_schema_version TEXT;

-- evidence_present: replaces the old NOT_FOUND verdict.
--   TRUE = evidence located; FALSE = no evidence; NULL = legacy row.
ALTER TABLE v2_per_policy_results
  ADD COLUMN IF NOT EXISTS evidence_present BOOLEAN;

-- evidence_signal_counts: {total_cited, supporting, negating,
--   absence_or_category_mismatch, neutral}. Packet-level rollup.
ALTER TABLE v2_per_policy_results
  ADD COLUMN IF NOT EXISTS evidence_signal_counts JSONB;

-- confidence_scope: const "EVIDENCE_MATCH_NOT_ADEQUACY" on 0.1.0 rows.
--   Guards the confidence number so it is not reread as an adequacy score.
ALTER TABLE v2_per_policy_results
  ADD COLUMN IF NOT EXISTS confidence_scope TEXT;

-- evidence_synthesis_self_score: NEW column (NOT a rename of rubric_self_score).
--   {appropriateness, sufficiency, banned_phrase_hits} for 0.1.0 rows.
--   rubric_self_score is retained separately for legacy 0.0.1 rows.
ALTER TABLE v2_per_policy_results
  ADD COLUMN IF NOT EXISTS evidence_synthesis_self_score JSONB;

-- ---- Index on s4_schema_version for version-branched queries ----
CREATE INDEX IF NOT EXISTS idx_v2_per_policy_results__s4_schema_version
  ON v2_per_policy_results (s4_schema_version);
