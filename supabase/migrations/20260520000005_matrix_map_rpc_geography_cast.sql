-- =====================================================================
-- matrix_map RPC geography-cast fix
-- =====================================================================
--
-- Branch:  fix/matrix-map-rpc-geography-cast
-- Pairs:   20260520000001_matrix_map_fetch_samples_rpc.sql (PR-MAP-3a; original)
--          20260520000004_matrix_map_jwt_via_current_setting.sql (JWT refactor)
--
-- WHY THIS MIGRATION EXISTS
--
--   2026-05-20 diagnostic from owner's dev-server terminal (after merging
--   PR #147's logging patch) revealed the actual failure mode behind the
--   "samples data temporarily unavailable" notice:
--
--     [matrix-map] RPC fetch_samples_with_hidden_summary failed: {
--       message: 'function st_asgeojson(extensions.geography) does not exist',
--       details: null,
--       hint: 'No function matches the given name and argument types.
--              You might need to add explicit type casts.',
--       code: '42883'
--     }
--
--   Root cause: the RPC body has `ST_AsGeoJSON(s.geometry)::jsonb AS
--   geometry`, but matrix_map.samples.geometry is declared
--   `geography(POINT, 4326)` (per PR-MAP-1 schema migration line 213).
--   PostGIS only ships `ST_AsGeoJSON(geometry)` -- there is no
--   `ST_AsGeoJSON(geography)` overload. PostgREST surfaces this as
--   42883 (undefined_function) when the function is called.
--
--   The bug has existed since PR-MAP-3a (20260520000001) deployed.
--   Earlier diagnostic surfaces hid it: (a) the SQL-Editor smoke call
--   raised the auth-context error BEFORE reaching the SELECT in
--   line ~221 (we never got past the auth gate to see the cast error);
--   (b) the prior security-hardening + JWT-refactor migrations did not
--   modify the geometry-projection logic.
--
-- FIX
--
--   One-line body change: cast s.geometry to geometry inside the
--   SELECT projection. PostGIS supplies the `geography -> geometry`
--   cast operator; once we apply it, ST_AsGeoJSON(geometry) resolves
--   cleanly. The cast preserves the SRID (4326) and the point
--   coordinates exactly -- no data semantics change.
--
--   BEFORE:  ST_AsGeoJSON(s.geometry)::jsonb AS geometry,
--   AFTER:   ST_AsGeoJSON(s.geometry::geometry)::jsonb AS geometry,
--
--   The rest of the function body is preserved verbatim from
--   20260520000004 (the JWT-via-current-setting refactor). Same
--   matrix_map.current_user_id() + matrix_map.jwt_claims() helpers,
--   same auth gate, same allowlist gate, same hidden-summary
--   computation, same return-payload shape.
--
-- IDEMPOTENCY
--
--   Wrapped in BEGIN/COMMIT. CREATE OR REPLACE FUNCTION is idempotent.
--   Transient GRANT CREATE / REVOKE CREATE pattern from PR-MAP-1 /
--   PR-MAP-3a / 20260520000004 is preserved so ALTER FUNCTION OWNER
--   succeeds even when matrix_map_owner has no steady-state CREATE
--   privilege on the schema.
--
-- PRE-FLIGHT (run READ-ONLY in Supabase SQL Editor before applying):
--
--   -- 1. Confirm the function exists + owned by matrix_map_owner.
--   SELECT p.proname,
--          (SELECT rolname FROM pg_roles WHERE oid = p.proowner) AS owner
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'matrix_map'
--     AND p.proname = 'fetch_samples_with_hidden_summary';
--   -- Expected: 1 row; owner = matrix_map_owner.
--
--   -- 2. Confirm samples.geometry is geography (the column the cast
--   --    targets).
--   SELECT column_name, udt_name
--   FROM information_schema.columns
--   WHERE table_schema = 'matrix_map'
--     AND table_name   = 'samples'
--     AND column_name  = 'geometry';
--   -- Expected: udt_name = 'geography'.
--
-- POST-APPLY VERIFICATION (run READ-ONLY in SQL Editor):
--
--   -- (a) Smoke call -- SQL Editor has no JWT session so this raises
--   --     the auth gate (which is the EXPECTED failure mode after the
--   --     fix; not the previous 42883 cast error). If you see the
--   --     "requires authenticated context" error, the cast fix landed
--   --     cleanly and the function compiles + executes far enough to
--   --     reach the auth gate.
--   SELECT matrix_map.fetch_samples_with_hidden_summary(NULL::jsonb);
--   -- Expected: 42501 fetch_samples_with_hidden_summary requires
--   --           authenticated context.
--   -- ANTI-EXPECTED: 42883 st_asgeojson(geography) does not exist.
--
--   -- (b) End-to-end -- reload /matrix-map (or /matrix-options ->
--   --     Interactive Map tab) in the dashboard. Sample markers
--   --     should render with the 9-state symbology. The "samples
--   --     data temporarily unavailable" notice should be gone.
--
-- Plain ASCII only -- no em-dashes / smart quotes / Unicode arrows.
-- Per L0 CLAUDE.md section 1.1.
-- =====================================================================

BEGIN;

-- Transient CREATE so ALTER FUNCTION ... OWNER TO matrix_map_owner
-- below succeeds (matches PR-MAP-1 / PR-MAP-3a / 20260520000004 pattern).
GRANT CREATE ON SCHEMA matrix_map TO matrix_map_owner;

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

  -- (2) Allowlist gate. is_email_allowlisted (refactored in
  --     20260520000004) looks up via JWT sub directly; the email
  --     parameter is passed for signature compatibility but is ignored
  --     in the body.
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
  --
  --     2026-05-20 cast fix: s.geometry is geography(POINT, 4326);
  --     ST_AsGeoJSON only has a geometry overload. Cast s.geometry::
  --     geometry before passing into ST_AsGeoJSON. SRID + coordinates
  --     preserved exactly by the geography->geometry cast.
  SELECT COALESCE(jsonb_agg(row_obj), '[]'::jsonb)
  FROM (
    SELECT
      s.id,
      s.bnrrm_station_id,
      s.station_id,
      s.display_name,
      ST_AsGeoJSON(s.geometry::geometry)::jsonb AS geometry,
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

-- Re-issue ownership + grants (idempotent; mirrors 20260520000004).
ALTER FUNCTION matrix_map.fetch_samples_with_hidden_summary(jsonb)
  OWNER TO matrix_map_owner;

REVOKE EXECUTE ON FUNCTION matrix_map.fetch_samples_with_hidden_summary(jsonb)
  FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION matrix_map.fetch_samples_with_hidden_summary(jsonb)
  TO authenticated;
-- Intentionally NOT granted to service_role (mirrors prior migrations).

COMMENT ON FUNCTION matrix_map.fetch_samples_with_hidden_summary(jsonb) IS
  '2026-05-20 geography-cast fix: s.geometry::geometry inside '
  'ST_AsGeoJSON projection resolves the PostGIS function-overload '
  'mismatch (geography column vs geometry-typed ST_AsGeoJSON). All '
  'other logic preserved verbatim from 20260520000004 (the JWT-via-'
  'current-setting refactor). Wire contract (visible_samples / '
  'hidden_sample_count / hidden_dra_count / hidden_dra_ids / '
  'data_snapshot_version) is unchanged.';

-- Revoke the transient CREATE (steady-state matches PR-MAP-1 posture).
REVOKE CREATE ON SCHEMA matrix_map FROM matrix_map_owner;

COMMIT;
