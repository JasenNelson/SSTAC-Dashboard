-- =====================================================================
-- matrix_map JWT-via-current-setting refactor
-- =====================================================================
--
-- Branch:  feat/matrix-map-jwt-via-current-setting
-- Pairs:   20260519000002_matrix_map_rls.sql               (PR-MAP-1)
--          20260520000001_matrix_map_fetch_samples_rpc.sql (PR-MAP-3a)
--          20260520000003_matrix_map_security_hardening.sql (this lane)
--
-- WHY THIS MIGRATION EXISTS
--
--   The prior 20260520000003 security-hardening migration attempted to
--   GRANT EXECUTE on auth.uid / auth.jwt / auth.role to matrix_map_owner.
--   Empirical verification 2026-05-20 (owner ran VERIFY 1-4 from
--   .tmp_state_discovery_matrix_map_auth_grant_2026_05_20.sql in the
--   Supabase SQL Editor) showed:
--
--     VERIFY 1: 0 rows -- the GRANT EXECUTE statements never landed.
--     VERIFY 2: matrix_map_owner has_auth_usage = false. Custom roles
--               (matrix_map_owner, authenticator) lack USAGE on auth
--               schema; default-granted roles (authenticated, service_
--               role, postgres) have it.
--     VERIFY 3: 4 policies present (PART B did land).
--     VERIFY 4: auth.uid / auth.jwt / auth.role all owned by
--               supabase_auth_admin.
--
--   Root cause: Supabase managed DB locks down the auth schema. The
--   postgres role cannot SET ROLE supabase_auth_admin (confirmed by
--   owner 2026-05-20: "permission denied to set role supabase_auth_
--   admin"), and only supabase_auth_admin can GRANT on functions it
--   owns. There is no SQL-Editor-accessible path to grant USAGE on the
--   auth schema (or EXECUTE on auth.*) to a custom role like
--   matrix_map_owner. This is by Supabase managed-DB design.
--
--   Impact: every matrix_map function OWNED BY matrix_map_owner that
--   calls auth.uid() / auth.jwt() / reads auth.users fails under its
--   SECURITY DEFINER body with:
--     ERROR: 42501: permission denied for schema auth
--   The functions affected are:
--     - matrix_map.is_email_allowlisted(text)           (PR-MAP-1)
--     - matrix_map.has_private_grant(uuid)              (PR-MAP-1)
--     - matrix_map.flip_dra_public(uuid,bool,uuid,text) (PR-MAP-1)
--     - matrix_map.fetch_samples_with_hidden_summary    (PR-MAP-3a)
--
--   RLS POLICIES that call auth.uid() / auth.jwt() are NOT affected --
--   policy predicates run in the calling role's context (authenticated),
--   not in the table owner's context, so they retain auth schema access.
--
-- FIX APPROACH
--
--   Add two small helper functions in the matrix_map schema that read
--   the JWT claims directly from the session-local PostgreSQL GUC
--   `request.jwt.claims` that PostgREST sets per-request. This GUC is
--   accessible to ANY role via the built-in pg_catalog current_setting()
--   function -- no auth schema dependency.
--
--     matrix_map.current_user_id() -> uuid
--       returns the JWT 'sub' claim as uuid (or NULL if no session).
--       Drop-in replacement for auth.uid() inside matrix_map SECDEF
--       bodies.
--
--     matrix_map.jwt_claims() -> jsonb
--       returns the full JWT claims jsonb (or NULL if no session).
--       Drop-in replacement for auth.jwt() inside matrix_map SECDEF
--       bodies.
--
--   Then CREATE OR REPLACE each of the 4 affected functions with bodies
--   that use the helpers instead of auth.* calls. is_email_allowlisted
--   + flip_dra_public additionally need to bypass their auth.users reads
--   (matrix_map_owner cannot reference auth.users without USAGE on the
--   auth schema). Both reads were resolving the caller's email; the JWT
--   carries the email claim directly so we read it from the JWT instead.
--
-- BEHAVIOR PRESERVATION
--
--   Every function signature is preserved IDENTICALLY. Every
--   ALTER FUNCTION ... OWNER + REVOKE/GRANT statement is re-issued so
--   the migration is self-contained on a fresh DB.
--
--   Two SUBTLE semantic changes worth flagging (both safe; both more
--   robust than the prior auth.users-roundtrip):
--
--   1. is_email_allowlisted(p_email) previously matched the parameter
--      against auth.users.email then looked up user_roles by that
--      user_id. The new body looks up user_roles directly by the JWT
--      sub claim, IGNORING the p_email parameter. Equivalent for the
--      canonical call sites (RLS policies + fetch_samples both pass
--      auth.jwt() ->> 'email' which always belongs to the caller). MORE
--      robust because (a) sub is canonical identity vs email which may
--      vary in case / be NULL / be spoofable in some JWT-issuer
--      scenarios, and (b) avoids the auth.users join entirely. The
--      parameter is retained in the signature for backward compatibility
--      (so existing RLS policies don't need to be re-authored).
--
--   2. flip_dra_public previously did `SELECT email FROM auth.users
--      WHERE id = auth.uid()` to populate the audit row. The new body
--      reads `email` from the JWT claims directly. Equivalent for the
--      canonical Supabase JWT issuer (GoTrue) which always includes
--      email. Raises a clear error if email is unavailable.
--
-- WHAT THIS MIGRATION DOES NOT TOUCH
--
--   - RLS policies (Category 2 in the auth.* grep). Those run in
--     caller context and retain their auth.uid() / auth.jwt() calls.
--   - The PART A grants from 20260520000003 (they were no-ops anyway;
--     leaving them in the migration history as documented intent +
--     idempotent harmless re-issue).
--   - The PART B RLS policies from 20260520000003 (already landed
--     correctly per VERIFY 3).
--
-- IDEMPOTENCY: Wrapped in BEGIN/COMMIT. All CREATE OR REPLACE statements
-- are idempotent. ALTER FUNCTION OWNER + GRANT statements are
-- idempotent. Re-applying the migration after a partial rollback is
-- safe.
--
-- PRE-FLIGHT (run READ-ONLY before applying):
--
--   -- 1. Confirm the 4 broken functions still exist + are owned by
--   --    matrix_map_owner.
--   SELECT n.nspname, p.proname, (SELECT rolname FROM pg_roles WHERE oid=p.proowner) AS owner
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'matrix_map'
--     AND p.proname IN ('is_email_allowlisted', 'has_private_grant',
--                       'flip_dra_public', 'fetch_samples_with_hidden_summary')
--   ORDER BY p.proname;
--   -- Expected: 4 rows; all owner = matrix_map_owner.
--
--   -- 2. Confirm current_setting() is accessible (it is, but proves
--   --    pg_catalog access works for the executing role).
--   SELECT current_setting('search_path', true) AS sp;
--
-- POST-APPLY VERIFICATION at the bottom of this file.
--
-- Plain ASCII only -- no em-dashes / smart quotes / Unicode arrows.
-- Per L0 CLAUDE.md section 1.1.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- SECTION 0 -- TRANSIENT GRANT CREATE for owner-transfer dance.
-- ---------------------------------------------------------------------
-- Codex P1 round 1 (2026-05-20): PR-MAP-1 + PR-MAP-3a both REVOKE
-- CREATE on schema matrix_map from matrix_map_owner at the end of their
-- bodies. ALTER FUNCTION ... OWNER TO matrix_map_owner requires the
-- target owner to hold CREATE on the containing schema. Without this
-- transient grant, the first ALTER FUNCTION OWNER below errors and the
-- whole transaction rolls back before any body refactor lands. Mirror
-- the PR-MAP-1 section 0 / PR-MAP-3a transient-CREATE pattern.
--
-- REVOKEd at the bottom of this file (SECTION 6) so the post-migration
-- state matches PR-MAP-1's REVOKEd posture (matrix_map_owner does NOT
-- retain CREATE on the schema in steady state).
-- ---------------------------------------------------------------------

GRANT CREATE ON SCHEMA matrix_map TO matrix_map_owner;


-- ---------------------------------------------------------------------
-- SECTION 1 -- HELPERS: matrix_map.current_user_id() + jwt_claims()
-- ---------------------------------------------------------------------
-- Both read from current_setting('request.jwt.claims', true). The
-- second arg (missing_ok=true) returns NULL instead of erroring if the
-- GUC is unset (which happens outside PostgREST-mediated calls, e.g.
-- from psql / SQL Editor with no auth session). The NULLIF wrapper
-- normalizes empty-string to NULL (PostgREST sometimes sets the GUC to
-- '' on no-session paths). The ::jsonb cast happens only when the value
-- is non-null + non-empty.
--
-- STABLE -- the GUC is constant within a single transaction. SECDEF is
-- NOT needed here because current_setting() doesn't require special
-- privileges; the helpers are owned by matrix_map_owner only for
-- ergonomics (so other matrix_map SECDEF bodies can call them
-- predictably). EXECUTE is granted to authenticated + service_role for
-- the same reason the existing matrix_map helpers are (consistency).
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION matrix_map.current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = matrix_map, pg_catalog
AS $$
  SELECT (
    nullif(current_setting('request.jwt.claims', true), '')::jsonb
      ->> 'sub'
  )::uuid
$$;

ALTER FUNCTION matrix_map.current_user_id() OWNER TO matrix_map_owner;

REVOKE EXECUTE ON FUNCTION matrix_map.current_user_id() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION matrix_map.current_user_id() TO authenticated;
GRANT  EXECUTE ON FUNCTION matrix_map.current_user_id() TO service_role;

COMMENT ON FUNCTION matrix_map.current_user_id() IS
  'Drop-in replacement for auth.uid() inside matrix_map SECDEF bodies '
  'owned by matrix_map_owner. Reads the JWT sub claim from the session-'
  'local request.jwt.claims GUC that PostgREST sets per-request. Avoids '
  'the Supabase managed-DB restriction that prevents granting USAGE on '
  'auth schema (or EXECUTE on auth.uid()) to custom roles. Returns NULL '
  'outside an authenticated PostgREST context (e.g. SQL Editor with no '
  'session). 2026-05-20 incident anchor: dashboard_matrix_map_pr_map_3_'
  'post_mortem_2026_05_20.';


CREATE OR REPLACE FUNCTION matrix_map.jwt_claims()
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = matrix_map, pg_catalog
AS $$
  SELECT nullif(current_setting('request.jwt.claims', true), '')::jsonb
$$;

ALTER FUNCTION matrix_map.jwt_claims() OWNER TO matrix_map_owner;

REVOKE EXECUTE ON FUNCTION matrix_map.jwt_claims() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION matrix_map.jwt_claims() TO authenticated;
GRANT  EXECUTE ON FUNCTION matrix_map.jwt_claims() TO service_role;

COMMENT ON FUNCTION matrix_map.jwt_claims() IS
  'Drop-in replacement for auth.jwt() inside matrix_map SECDEF bodies '
  'owned by matrix_map_owner. Reads the full JWT claims jsonb from the '
  'session-local request.jwt.claims GUC. Sibling to current_user_id(); '
  'same managed-DB-restriction rationale.';


-- ---------------------------------------------------------------------
-- SECTION 2 -- REFACTOR: matrix_map.is_email_allowlisted(text)
-- ---------------------------------------------------------------------
-- Original body (PR-MAP-1 lines 262-294) joined auth.users on lower(email)
-- to look up the user_id, then checked public.user_roles. Both reads fail
-- under matrix_map_owner SECDEF (no USAGE on auth schema).
--
-- New body: read the user_id directly from the JWT sub claim via
-- matrix_map.current_user_id(). Check public.user_roles by user_id
-- directly. The p_email parameter is RETAINED for backward compatibility
-- (existing RLS policies call this with auth.jwt() ->> 'email') but is
-- IGNORED in the body -- the JWT sub is the canonical identity.
--
-- Equivalent for the canonical call sites; more robust than the email
-- roundtrip; see migration header "BEHAVIOR PRESERVATION" note 1.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION matrix_map.is_email_allowlisted(p_email text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = matrix_map, public, pg_temp
AS $$
DECLARE
  v_uid     uuid;
  v_allowed boolean;
BEGIN
  v_uid := matrix_map.current_user_id();

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'matrix_map.is_email_allowlisted requires authenticated context'
      USING ERRCODE = '42501';
  END IF;

  -- Canonical identity = JWT sub. The p_email parameter is intentionally
  -- ignored (kept in the signature for RLS-policy backward compat). See
  -- migration header BEHAVIOR PRESERVATION note 1.
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = v_uid
  )
  INTO v_allowed;

  RETURN COALESCE(v_allowed, false);
END;
$$;

-- Re-issue ownership + grants (idempotent; mirrors PR-MAP-1 lines 296-300).
ALTER FUNCTION matrix_map.is_email_allowlisted(text) OWNER TO matrix_map_owner;

REVOKE EXECUTE ON FUNCTION matrix_map.is_email_allowlisted(text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION matrix_map.is_email_allowlisted(text) TO authenticated;
GRANT  EXECUTE ON FUNCTION matrix_map.is_email_allowlisted(text) TO service_role;

COMMENT ON FUNCTION matrix_map.is_email_allowlisted(text) IS
  '2026-05-20 refactor: returns true iff the JWT sub claim maps to a '
  'public.user_roles row. The p_email parameter is IGNORED (retained '
  'for RLS-policy backward compat; the canonical identity is JWT sub, '
  'not the email roundtrip via auth.users). SECURITY DEFINER + owned '
  'by matrix_map_owner + locked search_path. Returns boolean ONLY '
  '(cannot leak rows). Anonymous callers raise 42501.';


-- ---------------------------------------------------------------------
-- SECTION 3 -- REFACTOR: matrix_map.has_private_grant(uuid)
-- ---------------------------------------------------------------------
-- Original body (PR-MAP-1 lines 323-338): SELECT EXISTS ... WHERE
-- g.user_id = auth.uid() ... Replace auth.uid() with current_user_id().
-- Pure mechanical swap; semantics unchanged.
-- ---------------------------------------------------------------------

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
      AND g.user_id = matrix_map.current_user_id()
      AND g.revoked_at IS NULL
      AND (g.expires_at IS NULL OR g.expires_at > now())
  );
$$;

ALTER FUNCTION matrix_map.has_private_grant(uuid) OWNER TO matrix_map_owner;

REVOKE EXECUTE ON FUNCTION matrix_map.has_private_grant(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION matrix_map.has_private_grant(uuid) TO authenticated;
GRANT  EXECUTE ON FUNCTION matrix_map.has_private_grant(uuid) TO service_role;

COMMENT ON FUNCTION matrix_map.has_private_grant(uuid) IS
  '2026-05-20 refactor: returns true iff the calling user (JWT sub) '
  'holds an active, non-expired grant for the given DRA. Pure mechanical '
  'swap of auth.uid() -> matrix_map.current_user_id(). SECURITY DEFINER '
  '+ owned by matrix_map_owner. RLS on private_data_grants is bypassed '
  'by the owner role so the check is non-recursive.';


-- ---------------------------------------------------------------------
-- SECTION 4 -- REFACTOR: matrix_map.flip_dra_public(...)
-- ---------------------------------------------------------------------
-- Original body (PR-MAP-1 lines 380-454) used auth.uid() at 5 sites +
-- read auth.users for the actor's email. Replace auth.uid() with
-- current_user_id(); read email from jwt_claims() instead of auth.users.
--
-- See migration header BEHAVIOR PRESERVATION note 2 for the audit-email
-- semantic-equivalence rationale.
-- ---------------------------------------------------------------------

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
  v_uid           uuid;
  v_claims        jsonb;
  v_prior         boolean;
  v_actor_email   text;
  v_is_authorized boolean;
BEGIN
  v_uid    := matrix_map.current_user_id();
  v_claims := matrix_map.jwt_claims();

  -- (1) Must be called from an authenticated user-JWT context.
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'flip_dra_public must be called from an authenticated user context (jwt sub is null); service_role cannot call this RPC'
      USING ERRCODE = '42501';
  END IF;

  -- (2) Caller cannot impersonate a different actor.
  IF v_uid <> p_actor_id THEN
    RAISE EXCEPTION 'flip_dra_public actor_id (%) must match caller jwt sub (%)', p_actor_id, v_uid
      USING ERRCODE = '42501';
  END IF;

  -- (3) Caller must hold admin OR matrix_admin role.
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_uid
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

  -- Resolve actor email from the JWT claims (bypasses auth.users read
  -- which would fail under matrix_map_owner SECDEF -- no USAGE on auth
  -- schema). The Supabase GoTrue issuer always includes the email claim
  -- for password / OAuth sessions.
  v_actor_email := (v_claims ->> 'email')::text;
  IF v_actor_email IS NULL OR length(trim(v_actor_email)) = 0 THEN
    RAISE EXCEPTION 'flip_dra_public could not resolve actor email from JWT for sub %', v_uid;
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
      (p_dra_id, v_prior, p_new_value, now(), v_uid, v_actor_email, p_reason);
  END IF;
END;
$$;

ALTER FUNCTION matrix_map.flip_dra_public(uuid, boolean, uuid, text)
  OWNER TO matrix_map_owner;

REVOKE EXECUTE ON FUNCTION matrix_map.flip_dra_public(uuid, boolean, uuid, text)
  FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION matrix_map.flip_dra_public(uuid, boolean, uuid, text)
  TO authenticated;

COMMENT ON FUNCTION matrix_map.flip_dra_public(uuid, boolean, uuid, text) IS
  '2026-05-20 refactor: admin / matrix_admin only RPC to flip a DRA''s '
  'public flag. auth.uid() replaced with matrix_map.current_user_id(); '
  'auth.users email lookup replaced with JWT email claim from '
  'matrix_map.jwt_claims(). Behavior preserved -- see migration header '
  'BEHAVIOR PRESERVATION note 2.';


-- ---------------------------------------------------------------------
-- SECTION 5 -- REFACTOR: matrix_map.fetch_samples_with_hidden_summary
-- ---------------------------------------------------------------------
-- Original body (PR-MAP-3a 20260520000001 lines 159-306) used
-- auth.uid() at line 177 + auth.jwt() at line 185. Replace both with
-- the matrix_map helpers. All other logic preserved verbatim.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION matrix_map.fetch_samples_with_hidden_summary(
  p_bbox jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = matrix_map, public, extensions, pg_temp
AS $$
DECLARE
  v_uid                 uuid;
  v_caller_email        text;
  v_visible             jsonb;
  v_hidden_sample_count int;
  v_hidden_dra_ids      uuid[];
  v_hidden_dra_count    int;
  v_snapshot            text;
BEGIN
  -- (1) Auth gate: anon callers receive 42501.
  v_uid := matrix_map.current_user_id();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'fetch_samples_with_hidden_summary requires authenticated context'
      USING ERRCODE = '42501';
  END IF;

  -- (2) Allowlist gate. is_email_allowlisted (refactored above) now
  --     looks up via JWT sub directly; the email parameter is passed for
  --     signature compatibility but is ignored in the body.
  v_caller_email := (matrix_map.jwt_claims() ->> 'email')::text;
  IF NOT matrix_map.is_email_allowlisted(v_caller_email) THEN
    RAISE EXCEPTION 'caller not on matrix_map allowlist'
      USING ERRCODE = '42501';
  END IF;

  -- (3) p_bbox -- accepted but IGNORED in v1 body (Q-6 future-compat
  --     parameter).

  -- (4) Visible samples. Predicate mirrors the PR-MAP-1 RLS samples
  --     SELECT policy with ONE DELIBERATE WIDENING: source_dra_id IS
  --     NULL samples are included (flagged-for-steward-review).
  SELECT COALESCE(jsonb_agg(row_obj), '[]'::jsonb)
  FROM (
    SELECT
      s.id,
      s.bnrrm_station_id,
      s.station_id,
      s.display_name,
      ST_AsGeoJSON(s.geometry)::jsonb AS geometry,
      s.coordinate_quality_tier,
      s.coordinate_source,
      s.classification,
      s.classification_source,
      s.classification_rationale,
      s.classification_confidence,
      s.source_dra_id,
      s.public,
      s.bc_region,
      s.waterbody,
      s.waterbody_type
    FROM matrix_map.samples s
    LEFT JOIN matrix_map.dras d ON d.id = s.source_dra_id
    WHERE s.source_dra_id IS NULL
       OR (d.is_deleted = false
           AND (d.public = true OR matrix_map.has_private_grant(d.id)))
    ORDER BY s.bnrrm_station_id NULLS LAST, s.id
  ) row_obj
  INTO v_visible;

  -- (5) Hidden sample count: samples whose source DRA EXISTS, is not
  --     soft-deleted, is private, and the caller does NOT hold a grant.
  SELECT COUNT(*)
  FROM matrix_map.samples s
  JOIN matrix_map.dras d ON d.id = s.source_dra_id
  WHERE d.is_deleted = false
    AND d.public = false
    AND NOT matrix_map.has_private_grant(d.id)
  INTO v_hidden_sample_count;

  -- (6) Hidden DRA ids: uuids ONLY, NO titles / citations / agency / year.
  SELECT COALESCE(array_agg(d_id ORDER BY d_id), ARRAY[]::uuid[])
  FROM (
    SELECT DISTINCT s.source_dra_id AS d_id
    FROM matrix_map.samples s
    JOIN matrix_map.dras d2 ON d2.id = s.source_dra_id
    WHERE d2.is_deleted = false
      AND d2.public = false
      AND NOT matrix_map.has_private_grant(d2.id)
  ) hidden_dras
  INTO v_hidden_dra_ids;

  v_hidden_dra_count := array_length(v_hidden_dra_ids, 1);
  IF v_hidden_dra_count IS NULL THEN
    v_hidden_dra_count := 0;
  END IF;

  -- (7) Snapshot version.
  SELECT COALESCE(MAX(updated_at)::text, now()::text)
  FROM matrix_map.samples
  INTO v_snapshot;

  -- (8) Final payload.
  RETURN jsonb_build_object(
    'visible_samples',       v_visible,
    'hidden_sample_count',   v_hidden_sample_count,
    'hidden_dra_count',      v_hidden_dra_count,
    'hidden_dra_ids',        to_jsonb(v_hidden_dra_ids),
    'data_snapshot_version', v_snapshot
  );
END;
$$;

ALTER FUNCTION matrix_map.fetch_samples_with_hidden_summary(jsonb)
  OWNER TO matrix_map_owner;

REVOKE EXECUTE ON FUNCTION matrix_map.fetch_samples_with_hidden_summary(jsonb)
  FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION matrix_map.fetch_samples_with_hidden_summary(jsonb)
  TO authenticated;
-- Intentionally NOT granted to service_role (mirrors PR-MAP-3a 313-318).

COMMENT ON FUNCTION matrix_map.fetch_samples_with_hidden_summary(jsonb) IS
  '2026-05-20 refactor: matrix_map.current_user_id() + jwt_claims() '
  'replace auth.uid() + auth.jwt() inside the SECDEF body. All other '
  'logic preserved verbatim from PR-MAP-3a (20260520000001). The wire '
  'contract (visible_samples / hidden_sample_count / hidden_dra_count / '
  'hidden_dra_ids / data_snapshot_version) is unchanged.';


-- ---------------------------------------------------------------------
-- SECTION 6 -- REVOKE the transient CREATE granted in SECTION 0.
-- ---------------------------------------------------------------------
-- Mirrors PR-MAP-1 + PR-MAP-3a: matrix_map_owner does NOT retain
-- CREATE on the schema in steady state. The CREATE was granted only
-- for the duration of this migration so the ALTER FUNCTION OWNER
-- statements above could succeed.
-- ---------------------------------------------------------------------

REVOKE CREATE ON SCHEMA matrix_map FROM matrix_map_owner;

COMMIT;

-- =====================================================================
-- POST-APPLY VERIFICATION (run READ-ONLY, one block at a time, after
-- the migration applies):
--
--   -- (a) Helpers exist + owned by matrix_map_owner.
--   SELECT p.proname,
--          (SELECT rolname FROM pg_roles WHERE oid = p.proowner) AS owner
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'matrix_map'
--     AND p.proname IN ('current_user_id', 'jwt_claims')
--   ORDER BY p.proname;
--   -- Expected: 2 rows; owner = matrix_map_owner.
--
--   -- (b) Refactored functions still exist + owned by matrix_map_owner.
--   SELECT p.proname,
--          (SELECT rolname FROM pg_roles WHERE oid = p.proowner) AS owner
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'matrix_map'
--     AND p.proname IN ('is_email_allowlisted', 'has_private_grant',
--                       'flip_dra_public', 'fetch_samples_with_hidden_summary')
--   ORDER BY p.proname;
--   -- Expected: 4 rows; all owner = matrix_map_owner.
--
--   -- (c) Smoke call: the RPC that errored at line 11 (auth.uid()) now
--   --     either succeeds (if you have an authenticated session) OR
--   --     raises the expected 42501 "requires authenticated context"
--   --     from the new gate -- NOT the auth-schema permission error.
--   --     From the SQL Editor (which has no JWT session), expect the
--   --     "requires authenticated context" exception, which CONFIRMS
--   --     the refactor closed the bug.
--   SELECT matrix_map.fetch_samples_with_hidden_summary(NULL::jsonb);
--   -- Expected: ERROR fetch_samples_with_hidden_summary requires
--   --          authenticated context.
--   --   (The "schema auth" permission error must be GONE. If you see
--   --    the "requires authenticated context" message, that is GREEN.)
--
--   -- (d) End-to-end test from the dashboard: log in, navigate to
--   --     /matrix-map. The page should now render sample markers
--   --     instead of the "samples data temporarily unavailable" notice.
-- =====================================================================
