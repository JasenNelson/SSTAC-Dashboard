-- =====================================================================
-- matrix_map security hardening -- auth.* grants + RLS read policies
-- =====================================================================
--
-- Branch:  feat/matrix-map-security-hardening
-- Pairs:   20260519000001_matrix_map_schema.sql            (PR-MAP-1)
--          20260519000002_matrix_map_rls.sql               (PR-MAP-1)
--          20260520000001_matrix_map_fetch_samples_rpc.sql (PR-MAP-3a)
-- Anchor:  ~/.claude/projects/C--Projects-Regulatory-Review/memory/
--          dashboard_matrix_map_pr_map_3_post_mortem_2026_05_20.md
--
-- WHY THIS MIGRATION EXISTS
--
--   Pre-existing PR-MAP-1 + PR-MAP-3a infra bugs surfaced during the
--   2026-05-20 Path-B recovery state-discovery sweep:
--
--   (A) matrix_map_owner lacks EXECUTE on auth.uid() + auth.jwt().
--       PR-MAP-1 line 221 grants USAGE on schema auth to matrix_map_owner,
--       but Supabase's auth.uid() / auth.jwt() are by default granted
--       only to anon / authenticated / service_role; no implicit grant
--       flows to custom roles. The SECURITY DEFINER body of
--       matrix_map.fetch_samples_with_hidden_summary switches to
--       matrix_map_owner and tries to call auth.uid() (line 177 of
--       20260520000001_matrix_map_fetch_samples_rpc.sql) and auth.jwt()
--       (line 185). Both fail with "ERROR: 42501: permission denied for
--       schema auth". The RPC has never worked end-to-end under auth
--       context; verified by owner running the smoke call in Supabase
--       SQL Editor 2026-05-20 and getting the permission error. Without
--       this grant, /matrix-map renders the "samples data temporarily
--       unavailable" notice in page.tsx's try/catch (line 154-159 of
--       page.tsx).
--
--   (B) Four matrix_map tables (substances, layers, budget_dimension,
--       budget_caps) had RLS DISABLED but were GRANTed SELECT to
--       authenticated by PR-MAP-1 (lines 358-361 of 20260519000002).
--       Supabase Security Advisor flagged all four as rls_disabled_in_
--       public ERROR-level. Owner enabled RLS on all four via Supabase
--       Studio 2026-05-20. The auto-apply enables RLS but does NOT add
--       policies, so the tables are currently DENY-ALL to authenticated.
--       This migration adds the policies so reads work for legitimate
--       callers while the RLS gate remains in place.
--
-- SCOPE OF THIS FILE
--
--   PART A -- auth.* function grants:
--     GRANT EXECUTE ON FUNCTION auth.uid()  TO matrix_map_owner
--     GRANT EXECUTE ON FUNCTION auth.jwt()  TO matrix_map_owner
--     GRANT EXECUTE ON FUNCTION auth.role() TO matrix_map_owner (defensive)
--
--   PART B -- RLS read policies on the 4 auto-RLS'd tables:
--     substances        + layers           -> allowlisted-read for
--       authenticated (mirrors the samples / measurements / dras policy
--       pattern from PR-MAP-1: is_email_allowlisted(auth.jwt()->>'email'))
--     budget_dimension + budget_caps      -> admin-only read for
--       authenticated holding 'admin' OR 'matrix_admin' in user_roles
--       (mirrors the flip_dra_public admin-gate pattern from PR-MAP-1
--       line 408)
--
-- DESIGN NOTES
--
--   1. PART A uses GRANT EXECUTE -- the minimum privilege required.
--      We do NOT grant ALL on schema auth (over-permission). The
--      auth.users SELECT grant from PR-MAP-1 line 224 is preserved.
--   2. PART B policies are SELECT-only. INSERT/UPDATE/DELETE on these
--      tables is reserved for service_role (ETL) + matrix_admin-mediated
--      flows. RLS for those write paths can be added later if needed;
--      today they are inaccessible to authenticated entirely.
--   3. budget_caps + budget_dimension are admin-only because they expose
--      cost-control telemetry (daily caps, current usage); leaking them
--      to all reviewers would tip our hand on cost-headroom.
--   4. substances + layers are global lookup tables (no per-user
--      sensitivity) BUT the allowlist gate matches the rest of
--      matrix_map -- "anon: ZERO access" per PLAN_V3_4_2 section 4.3.
--      Without the gate, the public lookup data would still leak the
--      EXISTENCE of an authenticated session and the matrix_map schema.
--      The allowlist gate is also the universal "is this a real TWG
--      reviewer / admin" check the rest of the schema uses.
--   5. Policies are CREATE POLICY ... FOR SELECT TO authenticated.
--      anon gets nothing (RLS deny-default after ENABLE ROW LEVEL
--      SECURITY). service_role bypasses RLS entirely (ETL path).
--   6. IF NOT EXISTS guards on the policies so re-running the migration
--      after a partial-apply or rollback-then-redeploy is idempotent.
--
-- PRE-FLIGHT (run READ-ONLY before applying; see also
-- .tmp_state_discovery_matrix_map_auth_grant_2026_05_20.sql):
--
--   -- 1. matrix_map_owner lacks EXECUTE on auth.uid (the bug we fix).
--   SELECT routine_name, grantee, privilege_type
--   FROM information_schema.routine_privileges
--   WHERE routine_schema = 'auth'
--     AND routine_name IN ('uid', 'jwt', 'role')
--     AND grantee = 'matrix_map_owner';
--   -- Expected before apply: 0 rows.  After apply: 3 rows.
--
--   -- 2. All 4 tables RLS-enabled + zero policies (the gap we fill).
--   SELECT tablename, rowsecurity FROM pg_tables
--   WHERE schemaname='matrix_map'
--     AND tablename IN ('substances','layers','budget_dimension','budget_caps');
--   -- Expected before apply: rowsecurity=true on all 4 (auto-applied 2026-05-20).
--   SELECT tablename, COUNT(*) AS policy_count
--   FROM pg_policies
--   WHERE schemaname='matrix_map'
--     AND tablename IN ('substances','layers','budget_dimension','budget_caps')
--   GROUP BY tablename;
--   -- Expected before apply: 0 rows (no policies authored yet).
--
--   -- 3. Helpers + admin convention still match PR-MAP-1 (sanity).
--   SELECT proname, pg_get_function_arguments(oid) FROM pg_proc
--   WHERE proname = 'is_email_allowlisted'
--     AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname='matrix_map');
--   -- Expected: matrix_map.is_email_allowlisted(p_email text).
--
-- Plain ASCII only -- no em-dashes / smart quotes / Unicode arrows.
-- Literal '->' for arrow text. Per L0 CLAUDE.md section 1.1.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- PART A -- auth.* function EXECUTE grants for matrix_map_owner.
--
-- The SECURITY DEFINER bodies in matrix_map (helpers + RPCs) run as the
-- function owner. Without these grants, any auth.uid() / auth.jwt() /
-- auth.role() call inside a SECDEF body owned by matrix_map_owner fails
-- with "ERROR: 42501: permission denied for schema auth". USAGE on the
-- schema (granted in PR-MAP-1 line 221) is necessary but not sufficient;
-- the functions themselves need explicit EXECUTE.
-- ---------------------------------------------------------------------

GRANT EXECUTE ON FUNCTION auth.uid()  TO matrix_map_owner;
GRANT EXECUTE ON FUNCTION auth.jwt()  TO matrix_map_owner;
GRANT EXECUTE ON FUNCTION auth.role() TO matrix_map_owner;

-- ---------------------------------------------------------------------
-- PART B -- RLS read policies on the 4 previously-flagged tables.
--
-- The owner auto-applied ENABLE ROW LEVEL SECURITY via Supabase Studio
-- 2026-05-20 (after the Security Advisor flag). This migration MUST
-- still issue ENABLE + FORCE here so the change is captured in the
-- migration audit trail and a fresh DB rebuilt from migrations alone
-- (e.g. supabase db reset, a clean branch deploy, or a disaster-recovery
-- restore from the migration source) ends in the same RLS-enforced state
-- WITHOUT depending on a Studio click. Codex P1 finding 2026-05-20:
-- CREATE POLICY does NOT activate RLS by itself; without ENABLE, the
-- prior GRANT SELECT on these tables (PR-MAP-1 lines 358-361) would
-- remain unrestricted and the Security Advisor error would re-surface
-- on the rebuilt environment.
--
-- ALTER TABLE ... ENABLE / FORCE ROW LEVEL SECURITY are idempotent --
-- safe to re-issue against the already-enabled live DB. FORCE matches
-- the PR-MAP-1 pattern (applied to private_data_grants / service_role_
-- audit / export_audit) so the matrix_map_owner table-owner cannot
-- bypass RLS through a SECDEF body that reads these tables directly.
--
-- The CREATE POLICY block uses DROP IF EXISTS + CREATE so re-applying
-- after a partial rollback is idempotent.
-- ---------------------------------------------------------------------

ALTER TABLE matrix_map.substances       ENABLE ROW LEVEL SECURITY;
ALTER TABLE matrix_map.substances       FORCE  ROW LEVEL SECURITY;

ALTER TABLE matrix_map.layers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE matrix_map.layers           FORCE  ROW LEVEL SECURITY;

ALTER TABLE matrix_map.budget_dimension ENABLE ROW LEVEL SECURITY;
ALTER TABLE matrix_map.budget_dimension FORCE  ROW LEVEL SECURITY;

ALTER TABLE matrix_map.budget_caps      ENABLE ROW LEVEL SECURITY;
ALTER TABLE matrix_map.budget_caps      FORCE  ROW LEVEL SECURITY;

-- PART B.1 -- substances (global substance lookup table)
-- Allowlisted authenticated users can read all rows. Mirrors the
-- samples / measurements / dras read-policy pattern from PR-MAP-1
-- (is_email_allowlisted(auth.jwt()->>'email')).
DROP POLICY IF EXISTS substances_select_allowlisted ON matrix_map.substances;
CREATE POLICY substances_select_allowlisted
  ON matrix_map.substances
  FOR SELECT
  TO authenticated
  USING (matrix_map.is_email_allowlisted(auth.jwt() ->> 'email'));

COMMENT ON POLICY substances_select_allowlisted ON matrix_map.substances IS
  'Allowlisted-read: any authenticated user whose email maps via auth.users '
  'to a public.user_roles row may read all substance lookup rows. Mirrors '
  'the dras / samples / measurements pattern from PR-MAP-1 RLS migration. '
  'anon gets nothing (RLS deny-default). service_role bypasses RLS for ETL.';

-- PART B.2 -- layers (WMS layer catalog)
-- Same pattern as substances. The catalog drives the left-rail overlay
-- toggles in MatrixMap.tsx (rendered for any allowlisted reviewer).
DROP POLICY IF EXISTS layers_select_allowlisted ON matrix_map.layers;
CREATE POLICY layers_select_allowlisted
  ON matrix_map.layers
  FOR SELECT
  TO authenticated
  USING (matrix_map.is_email_allowlisted(auth.jwt() ->> 'email'));

COMMENT ON POLICY layers_select_allowlisted ON matrix_map.layers IS
  'Allowlisted-read: any authenticated user whose email maps via auth.users '
  'to a public.user_roles row may read the WMS layer catalog. The catalog '
  'powers MatrixMap.tsx left-rail overlay toggles + the future PR-MAP-7 '
  'admin grants UI. Mirrors the substances pattern (B.1).';

-- PART B.3 -- budget_dimension (cost-control current-day rolling counters)
-- Admin-only: only users with 'admin' OR 'matrix_admin' in user_roles
-- may read. Mirrors the flip_dra_public admin gate (PR-MAP-1 line 408).
-- Reviewers without admin role cannot see daily-usage counts (would
-- leak our cost headroom).
DROP POLICY IF EXISTS budget_dimension_admin_select ON matrix_map.budget_dimension;
CREATE POLICY budget_dimension_admin_select
  ON matrix_map.budget_dimension
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'matrix_admin')
    )
  );

COMMENT ON POLICY budget_dimension_admin_select ON matrix_map.budget_dimension IS
  'Admin-only read: only authenticated users holding admin or matrix_admin '
  'in public.user_roles may read daily-usage cost counters. Reviewers '
  'without admin do NOT see budget telemetry. Mirrors the flip_dra_public '
  'admin gate from PR-MAP-1.';

-- PART B.4 -- budget_caps (cost-control daily caps)
-- Same admin-only pattern as budget_dimension.
DROP POLICY IF EXISTS budget_caps_admin_select ON matrix_map.budget_caps;
CREATE POLICY budget_caps_admin_select
  ON matrix_map.budget_caps
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'matrix_admin')
    )
  );

COMMENT ON POLICY budget_caps_admin_select ON matrix_map.budget_caps IS
  'Admin-only read: only authenticated users holding admin or matrix_admin '
  'in public.user_roles may read daily-cap thresholds. Mirrors B.3.';

COMMIT;

-- =====================================================================
-- POST-APPLY VERIFICATION (run READ-ONLY after the migration applies):
--
--   -- (a) Part A: 3 EXECUTE rows for matrix_map_owner on auth.*.
--   SELECT routine_name, grantee, privilege_type
--   FROM information_schema.routine_privileges
--   WHERE routine_schema = 'auth'
--     AND routine_name IN ('uid', 'jwt', 'role')
--     AND grantee = 'matrix_map_owner';
--
--   -- (b) Part B: 4 policies exist (one per table).
--   SELECT schemaname, tablename, policyname, cmd, roles
--   FROM pg_policies
--   WHERE schemaname = 'matrix_map'
--     AND tablename IN ('substances','layers','budget_dimension','budget_caps')
--   ORDER BY tablename, policyname;
--
--   -- (c) End-to-end smoke: the RPC that errored at line 11
--   --     (auth.uid()) now succeeds.
--   SELECT jsonb_typeof(matrix_map.fetch_samples_with_hidden_summary(NULL::jsonb));
--   -- Expected: 'object'  (the previous error was 42501: permission denied).
--
--   -- (d) Allowlisted read of substances + layers works for an
--   --     authenticated user with a user_roles row (run from the
--   --     dashboard, NOT from the SQL editor as postgres):
--   SELECT COUNT(*) FROM matrix_map.substances;
--   SELECT COUNT(*) FROM matrix_map.layers;
--   -- Expected: non-zero counts (full catalogs visible).
--
--   -- (e) Admin-only read of budget_* works only for admin / matrix_admin.
--   --     Run as a non-admin allowlisted user first (should return 0
--   --     rows due to RLS denial), then as admin (should return rows).
--   SELECT COUNT(*) FROM matrix_map.budget_dimension;
--   SELECT COUNT(*) FROM matrix_map.budget_caps;
--
--   -- (f) Supabase Security Advisor re-scan: zero rls_disabled_in_public
--   --     ERRORs for matrix_map. (auto-fixed earlier by owner; this
--   --     check confirms it stuck after policies landed.)
-- =====================================================================
