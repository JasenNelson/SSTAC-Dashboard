-- =====================================================================
-- PR-MAP-1 -- matrix_map RLS, helpers, RPC, GRANTs
-- =====================================================================
--
-- Branch:  feat/matrix-map-pr-map-1-schema
-- Pairs:   20260519000001_matrix_map_schema.sql (lands first;
--          this file references its tables + columns 1:1)
-- Lane:    Matrix Interactive Map (PR-MAP-1 of PR-MAP-0..PR-MAP-7)
-- Plan:    .tmp_interactive_map_plan_v3.md (v3.4.2 LOCKED, codex-GREEN
--          through 8 rounds + owner sign-off on R-1..R-14 residuals)
-- Grants:  .tmp_private_grants_design_v2.md (v2.3, codex 14 findings
--          disposed; v2.1 trigger-vs-RPC pivot folded in)
-- Style:   Mirrors 20260515_matrix_security_audit.sql
--          (SECURITY DEFINER + SET search_path + ALTER FUNCTION OWNER
--           + REVOKE PUBLIC + narrow GRANTs + admin gate inside body).
--
-- SCOPE OF THIS FILE:
--   - CREATE ROLE matrix_map_owner NOLOGIN (function owner; non-login)
--   - 2 SECURITY DEFINER helpers:
--       matrix_map.is_email_allowlisted(text) -> boolean
--       matrix_map.has_private_grant(uuid)    -> boolean
--   - 1 SECURITY DEFINER RPC:
--       matrix_map.flip_dra_public(uuid, boolean, uuid, text) -> void
--   - ENABLE RLS + explicit policies on 5 tables:
--       dras, samples, sample_events, measurements, private_data_grants
--     (codex grants v2 B-3: explicit cascade, NOT auto-cascading FKs)
--   - Per-table GRANTs to authenticated + service_role
--   - Commented-out verification SQL block at end
--
-- NEW user_roles ROLE VALUE: 'matrix_admin'
--   This is a value of public.user_roles.role (NOT a Postgres role).
--   Convention follows public.is_admin() / matrix_security_audit pattern:
--     EXISTS (SELECT 1 FROM public.user_roles
--             WHERE user_id = auth.uid()
--               AND role IN ('admin', 'matrix_admin'))
--   Principle of least surprise: global 'admin' implicitly grants
--   'matrix_admin' privileges (admin > matrix_admin). matrix_admin is
--   the fine-grained role for TWG matrix-map admins who should NOT
--   gain global admin powers across the SSTAC dashboard.
--
--   STATE AS OF 2026-05-19 (verified via Supabase state-discovery SQL):
--     public.user_roles.role distinct values currently in use:
--       'admin'   -- 3 rows (existing global admins)
--       'member'  -- 50 rows (existing regular dashboard users)
--     ZERO existing rows have role = 'matrix_admin'. This migration
--     does NOT auto-populate matrix_admin grants. Owner / global admin
--     must INSERT user_roles rows manually to grant matrix_admin to
--     TWG matrix-map admins as they opt in (sample INSERT in the
--     deployment runbook at docs/design/matrix-map/README.md). Until
--     such inserts land, only the 3 existing 'admin' rows can call
--     flip_dra_public / manage grants / read audit tables -- which
--     IS the intended v1 dev-allowlist posture per R-5.
--
-- DEV ALLOWLIST CONVENTION (R-5):
--   is_email_allowlisted(jwt_email) returns true iff the email
--   corresponds to a user_id that has ANY row in public.user_roles.
--   Initially: jasen.nelson@gmail.com only. TWG members opt in by
--   being added to public.user_roles (admin or matrix_admin row;
--   any non-empty role qualifies for allowlisting). This collapses
--   "is_allowlisted" into "has a user_roles row" -- one source of
--   truth instead of two divergent tables. Expansion path: admin
--   adds a user_roles row, no schema change required.
--
-- OUT OF SCOPE (separate migrations):
--   - ETL seed (samples / dras / substances / layers rows)
--   - matrix_map.bridge_audit (PR-MAP-6; token contract sign-off gate)
--   - Daily-budget cron + RPC wrappers (separate migration)
--   - Admin UI RPCs for grants management (PR-MAP-7)
--   - auth.users delete trigger (soft-revokes grants; PR-MAP-7)
--
-- PRE-FLIGHT VERIFICATION (run READ-ONLY before applying):
--
--   -- Confirm schema + tables exist (schema migration applied first).
--   SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'matrix_map' ORDER BY table_name;
--   -- Expected 13 rows (per 20260519000001 verification block).
--
--   -- Confirm public.user_roles exists (anchor for admin/matrix_admin
--   -- gating + allowlist convention).
--   SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'user_roles'
--   ORDER BY ordinal_position;
--   -- Expected: at minimum user_id uuid, role text.
--
--   -- Confirm matrix_map_owner role does NOT already exist on first
--   -- apply (subsequent re-applies are guarded by DO-block IF NOT EXISTS).
--   SELECT rolname FROM pg_roles WHERE rolname = 'matrix_map_owner';
-- =====================================================================

BEGIN;


-- =====================================================================
-- SECTION 0 -- SEARCH_PATH + STATEMENT-LOCAL DEFAULTS
-- =====================================================================
-- Statement-local search_path so unqualified lookups in this migration
-- resolve cleanly. Production session search_path is not modified.

SET LOCAL search_path = matrix_map, public, pg_catalog;


-- =====================================================================
-- SECTION 0.1 -- WIDEN public.user_roles.role CHECK CONSTRAINT
-- =====================================================================
-- Verified 2026-05-19 via Supabase state-discovery SQL (pg_constraint
-- query against public.user_roles): the live CHECK is
--   CHECK (role = ANY (ARRAY['admin'::text, 'member'::text]))
-- and matrix_admin is NOT yet allowed. PR-MAP-1 introduces matrix_admin
-- as a fine-grained role for TWG matrix-map admins (admin > matrix_admin
-- hierarchy). Without widening the constraint, the runbook step that
-- INSERTs user_roles(user_id, 'matrix_admin', ...) fails on the CHECK.
--
-- Approach: DROP IF EXISTS + ADD with the widened set. Idempotent.
-- Preserves existing 'admin' (3 rows) + 'member' (50 rows). Adds
-- 'matrix_admin' as a permitted value with zero auto-population.
--
-- This is a PUBLIC-schema change (not matrix_map), but it is logically
-- a prerequisite for the matrix_admin role-gating that the matrix_map
-- RLS policies + flip_dra_public RPC depend on. Keeping it in this
-- migration (rather than a separate file) preserves atomicity: if any
-- later section of this transaction fails, the constraint widening
-- rolls back with it.

ALTER TABLE public.user_roles
  DROP CONSTRAINT IF EXISTS user_roles_role_check;

ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_role_check
  CHECK (role IN ('admin', 'member', 'matrix_admin'));

COMMENT ON CONSTRAINT user_roles_role_check ON public.user_roles IS
  'Widened by PR-MAP-1 RLS migration on 2026-05-19 to include '
  'matrix_admin per plan v3.4.2 + grants v2.3 fine-grained role design. '
  'Prior values admin + member preserved.';


-- =====================================================================
-- SECTION 1 -- ROLE: matrix_map_owner (NON-LOGIN function owner)
-- =====================================================================
-- Per grants v2 codex B-1: helper + RPC functions are owned by a
-- dedicated NON-LOGIN role so SECURITY DEFINER privilege escalation is
-- bounded to the matrix_map surface. matrix_map_owner cannot log in,
-- has no table grants of its own beyond what this migration confers,
-- and exists solely to be the proowner for the 3 functions below.
--
-- The function bodies enforce the actual privilege contract; the OWNER
-- assignment is the SECURITY DEFINER execution-context lever. Without
-- a dedicated owner the functions would inherit the migration runner's
-- privileges (typically postgres / supabase_admin) which is broader
-- than needed.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'matrix_map_owner') THEN
    CREATE ROLE matrix_map_owner NOLOGIN;
  END IF;
END
$$;

-- GRANT membership in matrix_map_owner to postgres so the migration
-- runner can ALTER FUNCTION ... OWNER TO matrix_map_owner below.
-- Per codex PR-MAP-1 amend #2 caught at deploy gate 2026-05-19: the
-- Supabase SQL editor runs queries as the postgres role (rolsuper=false
-- per state-discovery), and Postgres requires the executing role to be
-- a member of the target role to transfer object ownership to it. The
-- error without this line is "42501: must be able to SET ROLE
-- matrix_map_owner". supabase CLI db push runs as supabase_admin
-- (rolsuper=true) which doesn't hit this; the SQL editor does.
--
-- Membership formally confers matrix_map_owner's privileges to postgres
-- via SET ROLE, but adds NO new effective privileges since postgres
-- already has broader power than matrix_map_owner (BYPASSRLS via its
-- own attribute; CREATEDB; etc.). matrix_map_owner is strictly less
-- privileged (NOLOGIN; no SUPERUSER; no CREATEROLE) and stays NOLOGIN
-- so nobody can use it interactively. The grant just lets postgres
-- temporarily SET ROLE for the ALTER OWNER transfer.
GRANT matrix_map_owner TO postgres;

-- BYPASSRLS attribute: per codex PR-MAP-1 R2 P1-1 -- the 3 SECURITY DEFINER
-- functions matrix_map_owner owns must read/write base tables that are
-- FORCE ROW LEVEL SECURITY (FORCE applies RLS to the table owner too,
-- which here is postgres, not matrix_map_owner). The functions enforce
-- their own caller-predicate checks (admin role membership, auth.uid()
-- match, expires_at gating), so giving the owning role an explicit
-- RLS-bypass path is correct here -- mirrors the way service_role works
-- in Supabase: a NOLOGIN owner with BYPASSRLS, reached only through
-- code we have audited. Without BYPASSRLS, has_private_grant() returns
-- always-false (sees zero rows under FORCE RLS) and flip_dra_public()
-- fails on the dras UPDATE + dra_visibility_audit INSERT.
ALTER ROLE matrix_map_owner BYPASSRLS;

COMMENT ON ROLE matrix_map_owner IS
  'Non-login role; sole purpose is to own matrix_map SECURITY DEFINER '
  'functions (is_email_allowlisted, has_private_grant, flip_dra_public). '
  'Per grants v2 codex B-1: bounds DEFINER privilege escalation to the '
  'matrix_map surface. Per codex PR-MAP-1 R2 P1-1: has BYPASSRLS so the '
  'functions can read/write FORCE-RLS-armed tables (the functions enforce '
  'their own caller predicates: admin/matrix_admin check, auth.uid() = '
  'p_actor_id, expires_at gating). NEVER GRANT this role to a user.';

-- Allow matrix_map_owner USAGE on the schema AND minimum table privileges
-- needed by the 3 SECURITY DEFINER functions it owns. SECURITY DEFINER
-- means the function body executes WITH matrix_map_owner's privileges,
-- not the caller's. Granting only the schema (without table SELECT)
-- would leave the functions failing at runtime with
-- "permission denied for table" -- see codex PR-MAP-1 R1 P1-1.
--
-- Privileges granted (minimum set per function):
--   is_email_allowlisted -- SELECT on auth.users + public.user_roles
--   has_private_grant    -- SELECT on matrix_map.private_data_grants
--   flip_dra_public      -- SELECT + UPDATE on matrix_map.dras
--                        -- INSERT on matrix_map.dra_visibility_audit
--                        -- SELECT on public.user_roles + auth.users
--
-- These grants are scoped tightly: no DELETE on any table; no INSERT
-- on private_data_grants (admin path goes through RLS-gated direct
-- INSERT under matrix_admin policy at SECTION 5). matrix_map_owner is
-- NOLOGIN, so these privileges are only reachable via the 3 owned
-- functions, never via interactive use.
GRANT USAGE  ON SCHEMA matrix_map                          TO matrix_map_owner;
GRANT USAGE  ON SCHEMA auth                                TO matrix_map_owner;
GRANT USAGE  ON SCHEMA public                              TO matrix_map_owner;
GRANT SELECT ON public.user_roles                          TO matrix_map_owner;
GRANT SELECT ON auth.users                                 TO matrix_map_owner;

-- Transient CREATE privilege on matrix_map schema, granted ONLY for
-- the ALTER FUNCTION OWNER statements below (Postgres requires the new
-- owner to hold CREATE on the function's schema, in addition to the
-- membership grant above per codex amend #2). REVOKEd at end of
-- SECTION 4 once all 3 OWNER transfers are done -- matrix_map_owner
-- never needs CREATE in steady state (it owns 3 functions; can't and
-- shouldn't create more).
GRANT CREATE  ON SCHEMA matrix_map                         TO matrix_map_owner;
GRANT SELECT ON matrix_map.private_data_grants             TO matrix_map_owner;
GRANT SELECT, UPDATE ON matrix_map.dras                    TO matrix_map_owner;
GRANT INSERT ON matrix_map.dra_visibility_audit            TO matrix_map_owner;
-- Sequence USAGE not needed: dra_visibility_audit.id uses gen_random_uuid()
-- default, not a sequence; no nextval() call inside the RPC body.
-- Per codex PR-MAP-1 R2 P1-1: USAGE on schema auth + public is explicitly
-- granted (Supabase grants USAGE on public to PUBLIC by default but the
-- safe pattern is to grant explicitly so the migration is self-contained;
-- USAGE on auth is the explicit fix for codex's residual schema-USAGE
-- gap).


-- =====================================================================
-- SECTION 2 -- HELPER: matrix_map.is_email_allowlisted(text) -> boolean
-- =====================================================================
-- Per R-5 + dev allowlist convention (file header SECTION above):
-- email is allowlisted iff the corresponding auth.users row maps to a
-- user_id with at least one row in public.user_roles. This collapses
-- "is_allowlisted" into "has a user_roles row" -- one source of truth.
--
-- Initially the only user_roles row is jasen.nelson@gmail.com; expansion
-- to TWG members happens by adding user_roles rows (operational change,
-- no schema migration). Anonymous callers RAISE EXCEPTION '42501' per
-- the matrix_security_audit.sql convention.
--
-- Function returns boolean only -- cannot leak rows (codex grants v2 B-2).
-- SECURITY DEFINER + owner matrix_map_owner + locked search_path.

CREATE OR REPLACE FUNCTION matrix_map.is_email_allowlisted(p_email text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = matrix_map, public, pg_temp
AS $$
DECLARE
  v_allowed boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'matrix_map.is_email_allowlisted requires authenticated context'
      USING ERRCODE = '42501';
  END IF;

  IF p_email IS NULL OR length(trim(p_email)) = 0 THEN
    RETURN false;
  END IF;

  -- Allowlisted iff the email maps (via auth.users) to a user_id that
  -- has at least one row in public.user_roles. This is the canonical
  -- "is this user known to the SSTAC dashboard role system" check.
  SELECT EXISTS (
    SELECT 1
    FROM auth.users au
    JOIN public.user_roles ur ON ur.user_id = au.id
    WHERE lower(au.email) = lower(p_email)
  )
  INTO v_allowed;

  RETURN COALESCE(v_allowed, false);
END;
$$;

ALTER FUNCTION matrix_map.is_email_allowlisted(text) OWNER TO matrix_map_owner;

REVOKE EXECUTE ON FUNCTION matrix_map.is_email_allowlisted(text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION matrix_map.is_email_allowlisted(text) TO authenticated;
GRANT  EXECUTE ON FUNCTION matrix_map.is_email_allowlisted(text) TO service_role;

COMMENT ON FUNCTION matrix_map.is_email_allowlisted(text) IS
  'Per R-5 + grants v2 codex B-2: returns true iff p_email maps to a '
  'public.user_roles row. SECURITY DEFINER + owned by matrix_map_owner '
  '+ locked search_path. Returns boolean ONLY (cannot leak rows). '
  'Anonymous callers raise 42501. Initially the allowlist = '
  'jasen.nelson@gmail.com; TWG members opt in by being added to '
  'public.user_roles (admin or matrix_admin row).';


-- =====================================================================
-- SECTION 3 -- HELPER: matrix_map.has_private_grant(uuid) -> boolean
-- =====================================================================
-- Per grants v2 section 3.1 + codex B-1/B-2:
-- Returns true iff the calling user has an active, non-expired grant
-- for the given DRA. Used in the RLS USING clause of dras, samples,
-- sample_events, measurements.
--
-- SECURITY DEFINER + owner matrix_map_owner so RLS on
-- private_data_grants does not recurse / block the check. Returns
-- boolean only -- cannot leak grant rows or user identities.

CREATE OR REPLACE FUNCTION matrix_map.has_private_grant(p_dra_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = matrix_map, public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM matrix_map.private_data_grants g
    WHERE g.dra_id = p_dra_id
      AND g.user_id = auth.uid()
      AND g.revoked_at IS NULL
      AND (g.expires_at IS NULL OR g.expires_at > now())
  );
$$;

ALTER FUNCTION matrix_map.has_private_grant(uuid) OWNER TO matrix_map_owner;

REVOKE EXECUTE ON FUNCTION matrix_map.has_private_grant(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION matrix_map.has_private_grant(uuid) TO authenticated;
GRANT  EXECUTE ON FUNCTION matrix_map.has_private_grant(uuid) TO service_role;

COMMENT ON FUNCTION matrix_map.has_private_grant(uuid) IS
  'Per grants v2 section 3.1 + codex B-1/B-2: returns true iff the '
  'calling user has an active (not revoked, not expired) grant for the '
  'given DRA. SECURITY DEFINER + owned by matrix_map_owner. Returns '
  'boolean ONLY (cannot leak rows). Anonymous callers receive false '
  '(auth.uid() returns null; the EXISTS clause matches zero rows). '
  'Used by all 4 cascade-RLS policies (dras, samples, sample_events, '
  'measurements) -- explicit cascade per codex B-3.';


-- =====================================================================
-- SECTION 4 -- RPC: matrix_map.flip_dra_public(uuid, boolean, uuid, text)
-- =====================================================================
-- Per grants v2 section 2.2 + codex v2.1 finding B-1:
-- Atomic UPDATE on dras.public + INSERT into dra_visibility_audit, in
-- one transaction. Replaces the earlier trigger pattern that failed
-- under service_role execution (auth.uid() null; NOT NULL columns
-- violate). The RPC enforces:
--   (1) Caller must be authenticated (auth.uid() not null). service_role
--       CANNOT call this RPC in v1; ETL pathways have their own
--       internal helpers per grants v2 design. This is the deferred
--       action per codex grants-v2.1 (service_role flip path is out of
--       v1 scope).
--   (2) Caller's auth.uid() must match p_actor_id (no actor spoofing).
--   (3) Caller must hold 'admin' OR 'matrix_admin' in public.user_roles.
--   (4) p_reason must be non-empty.
--
-- The matrix_admin role check uses the user_roles convention (NOT
-- raw_app_meta_data) for consistency with public.is_admin() and the
-- matrix_security_audit.sql admin gating pattern. admin > matrix_admin
-- per principle of least surprise: a global admin can always flip.

CREATE OR REPLACE FUNCTION matrix_map.flip_dra_public(
  p_dra_id    uuid,
  p_new_value boolean,
  p_actor_id  uuid,
  p_reason    text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = matrix_map, public, pg_temp
AS $$
DECLARE
  v_prior         boolean;
  v_actor_email   text;
  v_is_authorized boolean;
BEGIN
  -- (1) Must be called from an authenticated user-JWT context.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'flip_dra_public must be called from an authenticated user context (auth.uid() is null); service_role cannot call this RPC'
      USING ERRCODE = '42501';
  END IF;

  -- (2) Caller cannot impersonate a different actor.
  IF auth.uid() <> p_actor_id THEN
    RAISE EXCEPTION 'flip_dra_public actor_id (%) must match caller auth.uid() (%)', p_actor_id, auth.uid()
      USING ERRCODE = '42501';
  END IF;

  -- (3) Caller must hold admin OR matrix_admin role.
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin', 'matrix_admin')
  )
  INTO v_is_authorized;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'flip_dra_public requires admin or matrix_admin role'
      USING ERRCODE = '42501';
  END IF;

  -- (4) Reason required (grants v2 section 2.3).
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'flip_dra_public requires a non-empty reason';
  END IF;

  -- Resolve actor email from auth.users for the audit row.
  SELECT email INTO v_actor_email FROM auth.users WHERE id = auth.uid();
  IF v_actor_email IS NULL THEN
    RAISE EXCEPTION 'flip_dra_public could not resolve actor email for auth.uid() %', auth.uid();
  END IF;

  -- Lock + read prior value.
  SELECT public INTO v_prior
  FROM matrix_map.dras
  WHERE id = p_dra_id
    AND is_deleted = false
  FOR UPDATE;

  IF v_prior IS NULL THEN
    RAISE EXCEPTION 'dra % not found or is soft-deleted', p_dra_id;
  END IF;

  -- No-op if value unchanged (avoids gratuitous audit rows).
  IF v_prior IS DISTINCT FROM p_new_value THEN
    UPDATE matrix_map.dras
       SET public = p_new_value
     WHERE id = p_dra_id
       AND is_deleted = false;

    INSERT INTO matrix_map.dra_visibility_audit
      (dra_id, prior_value, new_value, changed_at, changed_by, changed_by_email, reason)
    VALUES
      (p_dra_id, v_prior, p_new_value, now(), auth.uid(), v_actor_email, p_reason);
  END IF;
END;
$$;

ALTER FUNCTION matrix_map.flip_dra_public(uuid, boolean, uuid, text)
  OWNER TO matrix_map_owner;

REVOKE EXECUTE ON FUNCTION matrix_map.flip_dra_public(uuid, boolean, uuid, text)
  FROM PUBLIC, anon, service_role;
GRANT  EXECUTE ON FUNCTION matrix_map.flip_dra_public(uuid, boolean, uuid, text)
  TO authenticated;

COMMENT ON FUNCTION matrix_map.flip_dra_public(uuid, boolean, uuid, text) IS
  'Per grants v2 section 2.2 + codex v2.1 finding B-1: atomic flip of '
  'dras.public + audit insert in one transaction. Replaces trigger '
  'pattern that broke under service_role. Enforces: auth.uid() not null '
  '+ auth.uid() = p_actor_id + admin OR matrix_admin role in '
  'public.user_roles + non-empty reason. SECURITY DEFINER + owned by '
  'matrix_map_owner. EXECUTE granted to authenticated ONLY (service_role '
  'explicitly REVOKED per grants-v2.1 deferred action; ETL has separate '
  'internal helpers out of v1 scope).';

-- Revoke the transient CREATE privilege on matrix_map schema now that
-- all 3 ALTER FUNCTION OWNER transfers (SECTIONS 2/3/4) are complete.
-- Per codex amend #2: matrix_map_owner never needs CREATE in steady
-- state; granting it only for the transfer keeps the role's privileges
-- minimal.
REVOKE CREATE ON SCHEMA matrix_map FROM matrix_map_owner;


-- =====================================================================
-- SECTION 5 -- ROW LEVEL SECURITY POLICIES (5 tables)
-- =====================================================================
-- Per grants v2 codex B-3: explicit cascade through dras.id, NOT
-- auto-cascading FKs. Each policy joins through to dras explicitly so
-- the (public OR has_private_grant) + is_deleted=false gate is uniform.
--
-- Convention: SELECT policies gate read visibility via the helpers.
-- INSERT/UPDATE/DELETE on all data tables (dras, samples,
-- sample_events, measurements) are restricted to admin/matrix_admin
-- via public.user_roles. private_data_grants has a self-select policy
-- so users can see their own grants + admin policy for full management.
--
-- FORCE ROW LEVEL SECURITY ensures even the table owner is subject to
-- policies (defense in depth; the matrix_map schema owner role in
-- Supabase may otherwise bypass RLS).


-- ---------------------------------------------------------------------
-- 5.a  matrix_map.dras
-- ---------------------------------------------------------------------
ALTER TABLE matrix_map.dras ENABLE ROW LEVEL SECURITY;
ALTER TABLE matrix_map.dras FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dras_authenticated_select ON matrix_map.dras;
CREATE POLICY dras_authenticated_select
  ON matrix_map.dras
  FOR SELECT
  TO authenticated
  USING (
    matrix_map.is_email_allowlisted(auth.jwt() ->> 'email')
    AND is_deleted = false
    AND (
      public = true
      OR matrix_map.has_private_grant(id)
    )
  );

COMMENT ON POLICY dras_authenticated_select ON matrix_map.dras IS
  'Per R-10 + grants v2 section 3.5: allowlisted authenticated user sees '
  'a DRA iff it is not soft-deleted AND (public=true OR they hold an '
  'active private grant for it).';

DROP POLICY IF EXISTS dras_admin_all ON matrix_map.dras;
CREATE POLICY dras_admin_all
  ON matrix_map.dras
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'matrix_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'matrix_admin')
    )
  );

COMMENT ON POLICY dras_admin_all ON matrix_map.dras IS
  'admin / matrix_admin full CRUD on dras. Direct UPDATE on dras.public '
  'is policy-allowed but the admin UI must route through '
  'matrix_map.flip_dra_public RPC for atomic audit (documented contract '
  'per grants v2.1 codex B-1; not enforced by trigger).';


-- ---------------------------------------------------------------------
-- 5.b  matrix_map.samples
-- ---------------------------------------------------------------------
ALTER TABLE matrix_map.samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE matrix_map.samples FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS samples_authenticated_select ON matrix_map.samples;
CREATE POLICY samples_authenticated_select
  ON matrix_map.samples
  FOR SELECT
  TO authenticated
  USING (
    matrix_map.is_email_allowlisted(auth.jwt() ->> 'email')
    AND source_dra_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM matrix_map.dras d
      WHERE d.id = samples.source_dra_id
        AND d.is_deleted = false
        AND (d.public = true OR matrix_map.has_private_grant(d.id))
    )
  );

COMMENT ON POLICY samples_authenticated_select ON matrix_map.samples IS
  'Per grants v2 section 3.2 + codex B-3 (explicit cascade): allowlisted '
  'authenticated user sees a sample iff its source DRA is visible per '
  'the dras predicate. NULL source_dra_id samples are hidden from non-'
  'admin (rare; flagged for steward review per schema COMMENT).';

DROP POLICY IF EXISTS samples_admin_all ON matrix_map.samples;
CREATE POLICY samples_admin_all
  ON matrix_map.samples
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'matrix_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'matrix_admin')
    )
  );

COMMENT ON POLICY samples_admin_all ON matrix_map.samples IS
  'admin / matrix_admin full CRUD on samples (ETL via service_role '
  'bypasses RLS by default; this policy covers manual admin edits).';


-- ---------------------------------------------------------------------
-- 5.c  matrix_map.sample_events
-- ---------------------------------------------------------------------
ALTER TABLE matrix_map.sample_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE matrix_map.sample_events FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sample_events_authenticated_select ON matrix_map.sample_events;
CREATE POLICY sample_events_authenticated_select
  ON matrix_map.sample_events
  FOR SELECT
  TO authenticated
  USING (
    matrix_map.is_email_allowlisted(auth.jwt() ->> 'email')
    AND EXISTS (
      SELECT 1
      FROM matrix_map.samples s
      JOIN matrix_map.dras d ON d.id = s.source_dra_id
      WHERE s.id = sample_events.sample_id
        AND d.is_deleted = false
        AND (d.public = true OR matrix_map.has_private_grant(d.id))
    )
  );

COMMENT ON POLICY sample_events_authenticated_select ON matrix_map.sample_events IS
  'Per grants v2 section 3.3 + codex B-3 explicit cascade: joins through '
  'samples.source_dra_id to dras. RLS does NOT auto-cascade via FKs.';

DROP POLICY IF EXISTS sample_events_admin_all ON matrix_map.sample_events;
CREATE POLICY sample_events_admin_all
  ON matrix_map.sample_events
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'matrix_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'matrix_admin')
    )
  );

COMMENT ON POLICY sample_events_admin_all ON matrix_map.sample_events IS
  'admin / matrix_admin full CRUD on sample_events.';


-- ---------------------------------------------------------------------
-- 5.d  matrix_map.measurements
-- ---------------------------------------------------------------------
ALTER TABLE matrix_map.measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE matrix_map.measurements FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS measurements_authenticated_select ON matrix_map.measurements;
CREATE POLICY measurements_authenticated_select
  ON matrix_map.measurements
  FOR SELECT
  TO authenticated
  USING (
    matrix_map.is_email_allowlisted(auth.jwt() ->> 'email')
    AND EXISTS (
      SELECT 1
      FROM matrix_map.sample_events e
      JOIN matrix_map.samples s ON s.id = e.sample_id
      JOIN matrix_map.dras    d ON d.id = s.source_dra_id
      WHERE e.id = measurements.sample_event_id
        AND d.is_deleted = false
        AND (d.public = true OR matrix_map.has_private_grant(d.id))
    )
  );

COMMENT ON POLICY measurements_authenticated_select ON matrix_map.measurements IS
  'Per grants v2 section 3.4 + codex B-3 explicit cascade: 2-hop join '
  'through sample_events -> samples -> dras. RLS does NOT auto-cascade.';

DROP POLICY IF EXISTS measurements_admin_all ON matrix_map.measurements;
CREATE POLICY measurements_admin_all
  ON matrix_map.measurements
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'matrix_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'matrix_admin')
    )
  );

COMMENT ON POLICY measurements_admin_all ON matrix_map.measurements IS
  'admin / matrix_admin full CRUD on measurements.';


-- ---------------------------------------------------------------------
-- 5.e  matrix_map.private_data_grants
-- ---------------------------------------------------------------------
ALTER TABLE matrix_map.private_data_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE matrix_map.private_data_grants FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS grants_self_select ON matrix_map.private_data_grants;
CREATE POLICY grants_self_select
  ON matrix_map.private_data_grants
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

COMMENT ON POLICY grants_self_select ON matrix_map.private_data_grants IS
  'Per grants v2 section 3.6: a user can read their OWN grants (so the '
  'reviewer-side partial-visibility banner per codex D-1 can show which '
  'private DRAs they currently have access to). Does NOT expose other '
  'users grants.';

DROP POLICY IF EXISTS grants_admin_all ON matrix_map.private_data_grants;
CREATE POLICY grants_admin_all
  ON matrix_map.private_data_grants
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'matrix_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'matrix_admin')
    )
  );

COMMENT ON POLICY grants_admin_all ON matrix_map.private_data_grants IS
  'admin / matrix_admin full CRUD on private_data_grants. The admin UI '
  '(PR-MAP-7) routes grant creation through an UPSERT pattern (grants '
  'v2 section 4.2 codex A-1 fix) so concurrent admins do not race on '
  'the unique active-grants index.';


-- ---------------------------------------------------------------------
-- 5.f  matrix_map.classification_overrides  (codex PR-MAP-1 R1 P1-2 fix)
-- ---------------------------------------------------------------------
-- v1 has no steward override UI (R-12 deferred to v1.x). Lock down to
-- admin / matrix_admin until the propose/approve workflow lands.
ALTER TABLE matrix_map.classification_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE matrix_map.classification_overrides FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS classification_overrides_admin_all ON matrix_map.classification_overrides;
CREATE POLICY classification_overrides_admin_all
  ON matrix_map.classification_overrides
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'matrix_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'matrix_admin')
    )
  );

COMMENT ON POLICY classification_overrides_admin_all ON matrix_map.classification_overrides IS
  'Per codex PR-MAP-1 R1 P1-2: lock down to admin / matrix_admin until '
  'R-12 propose/approve workflow lands in v1.x. Non-admin users cannot '
  'read or write override rows. The samples RLS surface already exposes '
  'the EFFECTIVE classification + classification_source; override metadata '
  'belongs to the admin audit lane.';


-- ---------------------------------------------------------------------
-- 5.g  matrix_map.dra_visibility_audit  (codex PR-MAP-1 R1 P1-2 fix)
-- ---------------------------------------------------------------------
-- Writes flow exclusively through flip_dra_public RPC (SECURITY DEFINER,
-- owned by matrix_map_owner with INSERT privilege). Direct INSERT from
-- authenticated must be REVOKED so the audit trail cannot be forged.
ALTER TABLE matrix_map.dra_visibility_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE matrix_map.dra_visibility_audit FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dra_visibility_audit_admin_select ON matrix_map.dra_visibility_audit;
CREATE POLICY dra_visibility_audit_admin_select
  ON matrix_map.dra_visibility_audit
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'matrix_admin')
    )
  );

COMMENT ON POLICY dra_visibility_audit_admin_select ON matrix_map.dra_visibility_audit IS
  'Per codex PR-MAP-1 R1 P1-2: SELECT-only to admin / matrix_admin. '
  'No INSERT / UPDATE / DELETE policy on purpose: writes flow ONLY '
  'through matrix_map.flip_dra_public (SECURITY DEFINER, owner = '
  'matrix_map_owner) which has the explicit INSERT grant. Audit trail '
  'integrity is non-negotiable.';


-- ---------------------------------------------------------------------
-- 5.h  matrix_map.service_role_audit  (codex PR-MAP-1 R1 P1-2 fix)
-- ---------------------------------------------------------------------
-- Writes flow exclusively through service_role (server-side ETL +
-- background jobs). Direct INSERT from authenticated must be REVOKED.
ALTER TABLE matrix_map.service_role_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE matrix_map.service_role_audit FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_audit_admin_select ON matrix_map.service_role_audit;
CREATE POLICY service_role_audit_admin_select
  ON matrix_map.service_role_audit
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'matrix_admin')
    )
  );

COMMENT ON POLICY service_role_audit_admin_select ON matrix_map.service_role_audit IS
  'Per codex PR-MAP-1 R1 P1-2 + grants v2 codex C-2: SELECT-only to '
  'admin / matrix_admin. service_role bypasses RLS (BYPASSRLS owner '
  'pattern) so its INSERT path is unaffected by the absence of an '
  'INSERT policy. authenticated cannot forge audit rows.';


-- ---------------------------------------------------------------------
-- 5.i  matrix_map.export_audit  (codex PR-MAP-1 R1 P1-2 fix)
-- ---------------------------------------------------------------------
-- CSV export action is admin-only (PR-MAP-5 admin UI); writes flow
-- through service_role from the server-side export route. Direct
-- INSERT from authenticated must be REVOKED.
ALTER TABLE matrix_map.export_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE matrix_map.export_audit FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS export_audit_admin_select ON matrix_map.export_audit;
CREATE POLICY export_audit_admin_select
  ON matrix_map.export_audit
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'matrix_admin')
    )
  );

COMMENT ON POLICY export_audit_admin_select ON matrix_map.export_audit IS
  'Per codex PR-MAP-1 R1 P1-2: SELECT-only to admin / matrix_admin. '
  'CSV export path (PR-MAP-5) runs through a server-side route using '
  'service_role for the audit insert; no direct INSERT from '
  'authenticated.';


-- =====================================================================
-- SECTION 6 -- PER-TABLE GRANTS (REVOKE-then-GRANT pattern)
-- =====================================================================
-- Per grants v2 codex C-2: service_role is NEVER exposed to the
-- frontend; only used in server-side Next.js API routes. RLS does not
-- gate service_role (BYPASSRLS owner pattern); the application policy
-- + service_role_audit table are the enforcement boundary.
--
-- anon + PUBLIC get nothing (no public read path; the dashboard
-- requires authentication). authenticated gets SELECT on data tables
-- (RLS performs the actual filtering). private_data_grants gets
-- SELECT + INSERT to authenticated so the admin UI server actions can
-- create grants under the admin policy (RLS gates writes to admin
-- role). Audit tables get SELECT + INSERT to authenticated; RLS gates
-- visibility / writes to admin role at SECTION 5 + future admin policy
-- additions.

REVOKE ALL ON SCHEMA matrix_map FROM anon, PUBLIC;
GRANT  USAGE ON SCHEMA matrix_map TO authenticated, service_role;

-- Strip any default-acquired grants then re-grant from a known baseline.
REVOKE ALL ON ALL TABLES    IN SCHEMA matrix_map FROM anon, PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA matrix_map FROM anon, PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA matrix_map FROM anon, PUBLIC;

-- Data tables: SELECT to authenticated; RLS does the per-row filtering.
GRANT SELECT ON matrix_map.dras           TO authenticated;
GRANT SELECT ON matrix_map.samples        TO authenticated;
GRANT SELECT ON matrix_map.sample_events  TO authenticated;
GRANT SELECT ON matrix_map.measurements   TO authenticated;
GRANT SELECT ON matrix_map.substances     TO authenticated;
GRANT SELECT ON matrix_map.layers         TO authenticated;

-- classification_overrides: SELECT to authenticated; admin-only RLS at
-- SECTION 5.f gates the actual read. (Per codex PR-MAP-1 R1 P1-2.)
GRANT SELECT ON matrix_map.classification_overrides TO authenticated;

-- Grants table: SELECT + INSERT to authenticated. SELECT is gated by
-- grants_self_select (own rows) + grants_admin_all (admin sees all);
-- INSERT is gated by grants_admin_all WITH CHECK (admin-only).
GRANT SELECT, INSERT ON matrix_map.private_data_grants TO authenticated;

-- Audit tables (per codex PR-MAP-1 R1 P1-2): SELECT to authenticated;
-- admin-only RLS at SECTION 5.g/h/i gates the read. INSERT is INTENTIONALLY
-- NOT granted: writes flow ONLY through matrix_map.flip_dra_public
-- (dra_visibility_audit) or service_role (service_role_audit, export_audit).
-- This prevents authenticated users from forging audit rows.
GRANT SELECT ON matrix_map.dra_visibility_audit TO authenticated;
GRANT SELECT ON matrix_map.service_role_audit   TO authenticated;
GRANT SELECT ON matrix_map.export_audit         TO authenticated;

-- Budget tables: SELECT to authenticated (admin banner needs to read
-- caps + counts for the warning UI per R-6); writes gated to admin via
-- the daily-cron migration which lands in a separate file.
GRANT SELECT ON matrix_map.budget_dimension TO authenticated;
GRANT SELECT ON matrix_map.budget_caps      TO authenticated;

-- service_role: full table access for ETL + cron + server-side API
-- routes. Per grants v2 codex C-2: NEVER exposed to frontend; only
-- used in server-side Next.js routes; every call writes a
-- service_role_audit row via a wrapper helper.
GRANT ALL ON ALL TABLES    IN SCHEMA matrix_map TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA matrix_map TO service_role;

-- Function execution grants (helpers + RPC).
-- Note: the per-function REVOKE PUBLIC + GRANT statements at SECTIONS
-- 2/3/4 are the authoritative grants for these 3 functions; the
-- statements below ensure they survive the bulk REVOKE above.
GRANT EXECUTE ON FUNCTION matrix_map.is_email_allowlisted(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION matrix_map.has_private_grant(uuid)    TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION matrix_map.flip_dra_public(uuid, boolean, uuid, text) TO authenticated;
-- flip_dra_public intentionally NOT granted to service_role (grants
-- v2.1 deferred action; service_role cannot satisfy auth.uid() check).


COMMIT;


-- =====================================================================
-- POST-APPLY VERIFICATION (run READ-ONLY after apply; admin context):
--
--   -- 1. matrix_map_owner role exists, NOLOGIN, BYPASSRLS (per codex R2 P1-1).
--   SELECT rolname, rolcanlogin, rolbypassrls FROM pg_roles WHERE rolname = 'matrix_map_owner';
--   -- Expected: 1 row, rolcanlogin = false, rolbypassrls = true
--
--   -- 2. The 3 functions exist with correct owner + SECURITY DEFINER.
--   SELECT n.nspname AS schema,
--          p.proname AS function,
--          (SELECT rolname FROM pg_roles WHERE oid = p.proowner) AS owner,
--          p.prosecdef AS security_definer
--   FROM pg_proc p
--   JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'matrix_map'
--     AND p.proname IN ('is_email_allowlisted', 'has_private_grant', 'flip_dra_public')
--   ORDER BY p.proname;
--   -- Expected 3 rows; all owner = matrix_map_owner; all security_definer = true
--
--   -- 3. RLS enabled + forced on the 9 protected tables (5 data + 4
--   --    admin/audit per codex PR-MAP-1 R1 P1-2).
--   SELECT c.relname,
--          c.relrowsecurity     AS rls_enabled,
--          c.relforcerowsecurity AS rls_forced
--   FROM pg_class c
--   JOIN pg_namespace n ON n.oid = c.relnamespace
--   WHERE n.nspname = 'matrix_map'
--     AND c.relname IN (
--       'dras','samples','sample_events','measurements','private_data_grants',
--       'classification_overrides','dra_visibility_audit','service_role_audit','export_audit'
--     )
--   ORDER BY c.relname;
--   -- Expected 9 rows; all rls_enabled = true; all rls_forced = true
--
--   -- 4. Policy count per table.
--   SELECT schemaname, tablename, COUNT(*) AS policy_count
--   FROM pg_policies
--   WHERE schemaname = 'matrix_map'
--   GROUP BY schemaname, tablename
--   ORDER BY tablename;
--   -- Expected:
--   --   classification_overrides   1  (admin all)
--   --   dra_visibility_audit       1  (admin select only)
--   --   dras                       2  (select + admin all)
--   --   export_audit               1  (admin select only)
--   --   measurements               2  (select + admin all)
--   --   private_data_grants        2  (self select + admin all)
--   --   sample_events              2  (select + admin all)
--   --   samples                    2  (select + admin all)
--   --   service_role_audit         1  (admin select only)
--   --   TOTAL                     14
--
--   -- 5. flip_dra_public rejects non-admin caller. As an authenticated
--   --    non-admin user, the following must raise EXCEPTION 42501:
--   --      SELECT matrix_map.flip_dra_public(
--   --        '00000000-0000-0000-0000-000000000000'::uuid,
--   --        true,
--   --        auth.uid(),
--   --        'verification test'
--   --      );
--   --    Expected error message includes 'admin or matrix_admin role'.
--
--   -- 6. flip_dra_public rejects service_role caller (EXECUTE revoked).
--   --    As service_role, SELECT on the function must error with
--   --    'permission denied for function flip_dra_public'.
--
--   -- 7. is_email_allowlisted returns false for an unknown email and
--   --    true for jasen.nelson@gmail.com (assuming the user_roles row
--   --    exists). Anon caller raises 42501.
--   --      SELECT matrix_map.is_email_allowlisted('unknown@example.com');
--   --      SELECT matrix_map.is_email_allowlisted('jasen.nelson@gmail.com');
--
--   -- 8. Function execute grants. authenticated must have EXECUTE on
--   --    all 3 functions; anon must have NONE; service_role on the 2
--   --    helpers only.
--   SELECT p.proname,
--          pg_catalog.array_to_string(p.proacl, E'\n') AS acl
--   FROM pg_proc p
--   JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'matrix_map'
--     AND p.proname IN ('is_email_allowlisted','has_private_grant','flip_dra_public')
--   ORDER BY p.proname;
-- =====================================================================
