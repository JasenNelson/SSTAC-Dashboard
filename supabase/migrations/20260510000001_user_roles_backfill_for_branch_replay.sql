-- Backfill migration: user_roles table (Gate 2B branch-replay fix)
--
-- WHY THIS EXISTS OUT OF CHRONOLOGICAL ORDER: user_roles has existed in PRODUCTION since before this
-- repo tracked Supabase migrations at all -- it was created via database_schema.sql, hand-pasted into
-- Supabase Studio's SQL Editor (see AGENTS.md Supabase Protocol), never as a tracked migration. On
-- PRODUCTION this file is a no-op (all statements are idempotent guards). On a FRESH Supabase branch
-- (which replays only tracked migrations), user_roles did not exist at all -- and the very first
-- tracked migration by filename order, 20260513_v2_chunk_policy_citations.sql, references it in an RLS
-- policy, causing branch creation to fail with MIGRATIONS_FAILED. This migration is timestamped
-- 20260510 (before 20260513) purely so replay order is correct; it does not reflect when user_roles
-- was actually first created in production. This migration intentionally creates ONLY the table,
-- enables RLS, and grants SELECT to authenticated (see the two correction notes below for why) --
-- it does NOT create any policy (20260515_matrix_security_audit.sql is the sole, authoritative
-- policy source) and does NOT create the update_user_roles_updated_at trigger (see the "Deliberately
-- still NOT included" note below).
--
-- Root-cause + investigation trail: .tmp_gate2b_migration_repair_plan_20260708.md,
-- .tmp_gate2b_dbschema_inventory_report_20260708.md,
-- .tmp_gate2b_supabase_change_plan_20260708.md (all in the gate2b worktree, not committed).
--
-- CORRECTED 2026-07-08 after adversarial codex review: this file originally also created the two
-- ORIGINAL database_schema.sql policy names ("Users can view their own roles", "Admins can manage
-- all roles"). That was WRONG -- supabase/migrations/20260515_matrix_security_audit.sql:152-155 drops
-- FOUR different, newer policy names ("Allow admins to manage", "Allow trigger inserts on
-- user_roles", "Allow all authenticated users to read", "Allow admin role management") that do not
-- match either the original names or its own new hardened names, proving production went through an
-- UNDOCUMENTED intermediate policy-naming generation this repo has no record of. Creating the
-- original policy names here would leave two stale, pre-hardening policies on a fresh branch that
-- 20260515's own migration never touches (it doesn't need to -- DROP POLICY IF EXISTS is a no-op
-- against names that were never created). 20260513_v2_chunk_policy_citations.sql's RLS subquery
-- (`EXISTS (SELECT 1 FROM user_roles WHERE ...)`) only needs the TABLE to exist to compile -- it does
-- NOT require any policy to exist on user_roles itself. This file is therefore reduced to table +
-- RLS-enable only; 20260515_matrix_security_audit.sql remains the sole, authoritative source for
-- user_roles policies.
--
-- SECOND CORRECTION 2026-07-08 (owner-relayed external codex review): this file originally granted
-- NO privileges at all on user_roles. That was a real functional gap, not just a replay-compile
-- concern: database_schema.sql:903 (`GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;`)
-- is a one-time, schema-wide grant that is the ACTUAL production source of `authenticated`'s SELECT
-- privilege on user_roles -- it was never re-granted per-table anywhere else.
-- supabase/migrations/20260527000002_user_roles_revoke_insert_delete.sql's own header states the
-- intended end-state is "authenticated: SELECT only on user_roles", but that migration only REVOKEs
-- INSERT/UPDATE/DELETE -- it assumes SELECT already exists from the broad grant and never grants it
-- itself. Without an explicit GRANT SELECT here, a fresh branch would leave `authenticated` with ZERO
-- privileges on user_roles. This is not cosmetic: dozens of RLS policies elsewhere in this schema
-- (e.g. 20260513_v2_chunk_policy_citations.sql's own policy, and the matrix_reviews reconstruction
-- referenced above) check `EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role =
-- 'admin')` in a plain (non-SECURITY-DEFINER) policy body -- that subquery runs with the CALLING
-- role's own table privileges, so without GRANT SELECT here, every one of those policy checks would
-- fail with a permission-denied error on user_roles, not just silently return no rows, regardless of
-- whether the RLS policy logic itself is otherwise correct. Added the explicit grant to match the
-- documented end-state exactly (SELECT only -- no INSERT/UPDATE/DELETE, consistent with
-- 20260527000002 revoking those for authenticated).
--
-- Deliberately still NOT included (explained, not a silent omission): the `update_user_roles_updated_at`
-- trigger from database_schema.sql. No tracked migration references it, and it only affects whether
-- `updated_at` auto-bumps on UPDATE -- it does not affect RLS/GRANT/API access correctness, which was
-- the scope of this second correction. Sequence-level GRANT (USAGE/SELECT on user_roles_id_seq) is
-- also not needed: `authenticated` never gets INSERT on user_roles (see 20260527000002), and the two
-- SECURITY DEFINER RPCs (manage_user_role_insert/delete, owner=postgres) that perform the only
-- application write path always have full privileges as their owning role.

CREATE TABLE IF NOT EXISTS user_roles (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, role)
);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.user_roles TO authenticated;

-- Verification (run read-only against a branch after this migration replays):
--   SELECT to_regclass('public.user_roles');
--   SELECT grantee, privilege_type FROM information_schema.role_table_grants
--     WHERE table_name = 'user_roles' AND grantee = 'authenticated';
--   -- expect exactly: SELECT (no INSERT/UPDATE/DELETE)
--   -- (no policy check here -- 20260515_matrix_security_audit.sql is the policy source of truth)
