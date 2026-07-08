-- Backfill migration: update_updated_at_column() function (Gate 2B branch-replay fix)
--
-- Same rationale as 20260510000001_user_roles_backfill_for_branch_replay.sql: this function has
-- existed in PRODUCTION since database_schema.sql was hand-pasted into Supabase Studio, long before
-- this repo tracked Supabase migrations. It was never itself a tracked migration. A fresh Supabase
-- branch replays only tracked migrations, so without this backfill the function does not exist on a
-- branch -- and supabase/migrations/20260517_document_reviews.sql's own trigger creation
-- (`update_updated_at_column()` used at that file's CREATE TRIGGER statement) would fail on replay.
-- Timestamped 20260511 (before 20260513, after the user_roles backfill) purely for replay order; not
-- a claim about when the function was actually first created in production. `CREATE OR REPLACE` is
-- already idempotent as written in the source (database_schema.sql lines ~826-829) -- no additional
-- guard needed.
--
-- Root-cause + investigation trail: .tmp_gate2b_migration_repair_plan_20260708.md,
-- .tmp_gate2b_dbschema_inventory_report_20260708.md (both in the gate2b worktree, not committed).

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Verification (run read-only against a branch after this migration replays):
--   SELECT proname FROM pg_proc WHERE proname = 'update_updated_at_column';
