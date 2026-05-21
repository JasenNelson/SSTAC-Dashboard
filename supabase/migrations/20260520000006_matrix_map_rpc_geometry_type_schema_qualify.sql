-- =====================================================================
-- matrix_map RPC geometry-type schema-qualify fix
-- =====================================================================
--
-- Branch:  fix/matrix-map-rpc-geometry-type-qualify
-- Pairs:   20260520000005_matrix_map_rpc_geography_cast.sql (prior cast fix)
--          20260520000004_matrix_map_jwt_via_current_setting.sql (JWT refactor)
--          20260520000001_matrix_map_fetch_samples_rpc.sql (PR-MAP-3a)
--
-- WHY THIS MIGRATION EXISTS
--
--   Migration 20260520000005 applied the `s.geometry::geometry` cast to
--   fix the `function st_asgeojson(extensions.geography) does not exist`
--   error (code 42883). That fix worked at the function-overload level,
--   BUT exposed a follow-on type-resolution error from owner's dev
--   terminal 2026-05-20:
--
--     [matrix-map] RPC fetch_samples_with_hidden_summary failed: {
--       message: 'type "geometry" does not exist',
--       details: null, hint: null,
--       code: '42704'
--     }
--
--   Root cause: the RPC body has `SET search_path = matrix_map, public,
--   extensions, pg_temp`. The cast `s.geometry::geometry` resolves the
--   unqualified type name `geometry` via search_path. Even though
--   `extensions` is in the search_path, the type lookup is failing.
--   Possible contributing factors:
--     - Supabase keeps PostGIS in the `extensions` schema, but at
--       function-PARSE time the search_path may resolve types
--       differently than at function-CALL time.
--     - The column alias `AS geometry` in the same SELECT may shadow
--       the type name lookup in the cast expression.
--     - Function lockdown SET search_path is per-statement; type
--       resolution inside SECDEF body has been known to behave
--       differently than top-level queries.
--
--   The geography column was findable via `extensions.geography` in
--   the original 42883 error message, so PostGIS IS in `extensions`.
--   The schema-qualified type name `extensions.geometry` should
--   resolve unambiguously regardless of search_path quirks.
--
-- FIX
--
--   Change cast target from unqualified `geometry` to schema-qualified
--   `extensions.geometry`:
--
--     BEFORE:  ST_AsGeoJSON(s.geometry::geometry)::jsonb AS geometry,
--     AFTER:   ST_AsGeoJSON(s.geometry::extensions.geometry)::jsonb AS geometry,
--
--   Schema-qualified type lookup bypasses search_path resolution
--   entirely. PostgreSQL parser goes directly to extensions schema
--   for the type. Same semantics; same SRID; same coordinates; same
--   NULL behavior; same wire payload shape.
--
-- IDEMPOTENCY + PATTERN
--
--   Wrapped in BEGIN / COMMIT. CREATE OR REPLACE FUNCTION idempotent.
--   Transient GRANT CREATE / REVOKE CREATE around ALTER FUNCTION
--   OWNER (mirrors PR-MAP-1 / PR-MAP-3a / 20260520000004 / 20260520000005
--   pattern).
--
-- PRE-FLIGHT (run READ-ONLY in Supabase SQL Editor before applying):
--
--   -- 1. Confirm extensions.geometry type exists.
--   SELECT t.typname, n.nspname
--   FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
--   WHERE t.typname = 'geometry';
--   -- Expected: 1+ rows; typname = 'geometry', nspname likely 'extensions'.
--
--   -- 2. Confirm ST_AsGeoJSON(geometry) overload exists in extensions.
--   SELECT p.proname, pg_get_function_arguments(p.oid)
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE p.proname = 'st_asgeojson' AND n.nspname = 'extensions';
--   -- Expected: multiple rows (PostGIS has several ST_AsGeoJSON
--   --           overloads -- geometry, jsonb, etc.). The geometry-taking
--   --           overload is what our fix resolves to.
--
-- POST-APPLY VERIFICATION (run READ-ONLY):
--
--   -- (a) Smoke call -- SQL Editor has no JWT session so this raises
--   --     the auth gate (42501 'requires authenticated context'). If
--   --     you see that, the cast resolved + we executed far enough to
--   --     reach the auth gate. ANTI-EXPECTED: 42704 'type "geometry"
--   --     does not exist' OR 42883 'function st_asgeojson does not
--   --     exist'.
--   SELECT matrix_map.fetch_samples_with_hidden_summary(NULL::jsonb);
--   -- Expected: 42501 requires authenticated context.
--
--   -- (b) End-to-end -- reload /matrix-options -> Interactive Map tab
--   --     in the dashboard. Sample markers should render with the
--   --     9-state symbology. "Samples data temporarily unavailable"
--   --     notice should be gone.
--
-- Plain ASCII only -- no em-dashes / smart quotes / Unicode arrows.
-- Per L0 CLAUDE.md section 1.1.
-- =====================================================================

BEGIN;

-- Transient CREATE so ALTER FUNCTION ... OWNER TO matrix_map_owner
-- below succeeds.
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

  -- (2) Allowlist gate.
  v_caller_email := (matrix_map.jwt_claims() ->> 'email')::text;
  IF NOT matrix_map.is_email_allowlisted(v_caller_email) THEN
    RAISE EXCEPTION 'caller not on matrix_map allowlist'
      USING ERRCODE = '42501';
  END IF;

  -- (3) p_bbox -- accepted but IGNORED in v1 body.

  -- (4) Visible samples.
  --
  --     2026-05-20 geometry-type schema-qualify fix: the cast must use
  --     extensions.geometry (schema-qualified) instead of bare geometry
  --     because the SECDEF body's locked search_path is not resolving
  --     the bare `geometry` type at parse time even though `extensions`
  --     is listed. Schema-qualified lookup bypasses the search_path
  --     ambiguity entirely.
  SELECT COALESCE(jsonb_agg(row_obj), '[]'::jsonb)
  FROM (
    SELECT
      s.id,
      s.bnrrm_station_id,
      s.station_id,
      s.display_name,
      ST_AsGeoJSON(s.geometry::extensions.geometry)::jsonb AS geometry,
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

  -- (5) Hidden sample count.
  SELECT COUNT(*)
  FROM matrix_map.samples s
  JOIN matrix_map.dras d ON d.id = s.source_dra_id
  WHERE d.is_deleted = false
    AND d.public = false
    AND NOT matrix_map.has_private_grant(d.id)
  INTO v_hidden_sample_count;

  -- (6) Hidden DRA ids.
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

COMMENT ON FUNCTION matrix_map.fetch_samples_with_hidden_summary(jsonb) IS
  '2026-05-20 geometry-type schema-qualify fix: cast uses '
  'extensions.geometry (schema-qualified) instead of bare geometry to '
  'bypass search_path type-resolution quirks in SECDEF body parse '
  'context. All other logic preserved verbatim from 20260520000005. '
  'Wire contract unchanged.';

REVOKE CREATE ON SCHEMA matrix_map FROM matrix_map_owner;

COMMIT;
