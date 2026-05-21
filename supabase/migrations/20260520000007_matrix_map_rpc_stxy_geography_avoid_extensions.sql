-- =====================================================================
-- matrix_map RPC: replace ST_AsGeoJSON(geometry-cast) with manual
-- jsonb_build_object using ST_X + ST_Y geography overloads
-- =====================================================================
--
-- Branch:  fix/matrix-map-rpc-stxy-geography
-- Pairs:   20260520000005, 20260520000006 (prior cast attempts)
--          20260520000004 (JWT refactor)
--          20260520000001 (PR-MAP-3a original)
--
-- WHY THIS MIGRATION EXISTS
--
--   Cascade of geography-related errors over 2026-05-20 session:
--
--     migration 05: cast s.geometry::geometry -> fixed 42883 'st_asgeojson
--                   (extensions.geography) does not exist' BUT exposed
--                   42704 'type "geometry" does not exist' (search_path
--                   doesn't resolve bare geometry type in SECDEF body).
--
--     migration 06: cast s.geometry::extensions.geometry -> fixed 42704
--                   BUT exposed 42501 'permission denied for schema
--                   extensions' (matrix_map_owner lacks USAGE on the
--                   extensions schema; managed-DB lockdown like the
--                   auth schema issue we hit earlier in PR #145).
--
--   Function calls resolve via search_path WITHOUT triggering USAGE
--   checks (search_path walks accessible schemas only and silently
--   skips inaccessible ones). Type references and schema-qualified
--   names DO trigger USAGE checks.
--
--   So the path to success: avoid ALL references to the extensions
--   schema (type names, qualified names) and stick to unqualified
--   function calls that resolve via search_path.
--
-- FIX
--
--   PostGIS provides geography-typed overloads of ST_X and ST_Y for
--   point geographies. They return lng + lat respectively (geography
--   coordinate convention). Construct the GeoJSON manually:
--
--     BEFORE: ST_AsGeoJSON(s.geometry::extensions.geometry)::jsonb AS geometry,
--     AFTER:
--       jsonb_build_object(
--         'type', 'Point',
--         'coordinates', jsonb_build_array(
--           ST_X(s.geometry),
--           ST_Y(s.geometry)
--         )
--       ) AS geometry,
--
--   The output shape is IDENTICAL to what ST_AsGeoJSON would have
--   produced for a Point geography: {type: "Point", coordinates: [lng, lat]}.
--   Matches the GeoJsonPoint contract in
--   src/app/(dashboard)/matrix-map/types.ts line 65-68 exactly.
--
--   Why this works under the SECDEF body's locked search_path:
--     - ST_X and ST_Y are unqualified function references; search_path
--       resolution skips schemas matrix_map_owner can't access.
--     - jsonb_build_object + jsonb_build_array are built-in pg_catalog
--       functions; no schema lookup needed.
--     - No type names referenced.
--     - No extensions.* references.
--
-- ALTERNATIVE THE SESSION DID NOT TAKE
--
--   `GRANT USAGE ON SCHEMA extensions TO matrix_map_owner` would also
--   solve this if it succeeds, but per cross_project_supabase_protocol_
--   explore_before_assume + cross_project_supabase_mcp_dead_skip_to_sql_
--   editor lessons: managed-DB grants to custom roles on system schemas
--   (auth, extensions) routinely fail silently. The function-rewrite
--   path is more reliable + doesn't depend on Supabase managed-DB
--   permission policies.
--
-- IDEMPOTENCY + PATTERN
--
--   Wrapped in BEGIN / COMMIT. CREATE OR REPLACE FUNCTION idempotent.
--   Transient GRANT CREATE / REVOKE CREATE around ALTER FUNCTION OWNER.
--
-- POST-APPLY VERIFICATION:
--
--   -- (a) SQL Editor smoke -- auth gate fires (42501 requires
--   --     authenticated context). NOT 42501 permission denied for
--   --     schema extensions. NOT 42704 type does not exist. NOT 42883
--   --     function st_asgeojson does not exist.
--   SELECT matrix_map.fetch_samples_with_hidden_summary(NULL::jsonb);
--   -- Expected: 42501 requires authenticated context.
--
--   -- (b) Browser end-to-end -- reload /matrix-options Interactive Map
--   --     tab. Sample markers should render with the 9-state symbology.
--
-- Plain ASCII only -- no em-dashes / smart quotes / Unicode arrows.
-- Per L0 CLAUDE.md section 1.1.
-- =====================================================================

BEGIN;

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
  --     2026-05-20 ST_X/ST_Y geography manual-build fix: prior attempts
  --     to cast s.geometry to geometry hit "type does not exist" (search_
  --     path resolution) and "permission denied for schema extensions"
  --     (USAGE check on schema-qualified reference). ST_X + ST_Y have
  --     geography overloads that take s.geometry directly. Building the
  --     GeoJSON manually with jsonb_build_object avoids any type-name or
  --     schema-qualified reference, so SECDEF body search_path resolves
  --     cleanly without triggering USAGE checks. Output is identical to
  --     ST_AsGeoJSON for a Point: {type:"Point", coordinates:[lng,lat]}.
  SELECT COALESCE(jsonb_agg(row_obj), '[]'::jsonb)
  FROM (
    SELECT
      s.id,
      s.bnrrm_station_id,
      s.station_id,
      s.display_name,
      jsonb_build_object(
        'type', 'Point',
        'coordinates', jsonb_build_array(
          ST_X(s.geometry),
          ST_Y(s.geometry)
        )
      ) AS geometry,
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
  '2026-05-20 ST_X/ST_Y geography manual-build fix: avoid the '
  'extensions schema reference entirely by constructing GeoJSON with '
  'jsonb_build_object + ST_X + ST_Y geography overloads. Wire contract '
  'unchanged ({type: "Point", coordinates: [lng, lat]}).';

REVOKE CREATE ON SCHEMA matrix_map FROM matrix_map_owner;

COMMIT;
