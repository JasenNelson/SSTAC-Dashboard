-- =====================================================================
-- matrix_map RPC: ST_AsText + SQL WKT parse for coordinate extraction
-- =====================================================================
--
-- Branch:  fix/matrix-map-rpc-stastext-wkt-parse
-- Pairs:   20260520000005, 06, 07 (cast / type / function attempts)
--          20260520000004 (JWT refactor)
--          20260520000001 (PR-MAP-3a original)
--
-- WHY THIS MIGRATION EXISTS (FOURTH ITERATION)
--
--   Cascade of geography-related errors over 2026-05-20 session:
--
--     migration 05: ST_AsGeoJSON(s.geometry::geometry)
--                   -> 42704 'type "geometry" does not exist' (search_path
--                      doesn't resolve bare geometry type in SECDEF body)
--
--     migration 06: ST_AsGeoJSON(s.geometry::extensions.geometry)
--                   -> 42501 'permission denied for schema extensions'
--                      (matrix_map_owner lacks USAGE on extensions schema)
--
--     migration 07: ST_X(s.geometry), ST_Y(s.geometry)
--                   -> 42883 'function st_x(extensions.geography) does
--                      not exist' (ST_X/ST_Y geography overloads added
--                      in PostGIS 3.1; Supabase has older PostGIS)
--
--   Constraints proven empirically across 2026-05-20 session:
--     1. matrix_map_owner CAN call unqualified PostGIS functions via
--        search_path (function lookup skips USAGE check).
--     2. matrix_map_owner CANNOT reference types in extensions schema
--        (USAGE check fires for both explicit and search_path lookups
--        of type names).
--     3. ST_X(geography) / ST_Y(geography) overloads NOT available in
--        this PostGIS version.
--
--   Functions that PROVABLY work on geography in this PostGIS version
--   (from the 2026-05-20 error log evidence): ST_AsGeoJSON did NOT find
--   a geography overload; ST_X / ST_Y did NOT find geography overloads.
--   Universal-availability functions for geography: ST_AsText
--   (returns WKT text), ST_AsBinary (returns bytea WKB).
--
-- FIX (fourth iteration; designed to be the LAST iteration)
--
--   Use ST_AsText(geography) to get WKT text "POINT(lng lat)" then
--   parse the text in SQL with built-in string functions (translate,
--   split_part) -- no PostGIS type references, no geometry type lookup,
--   no schema-qualified anything. Build the GeoJSON object manually
--   with jsonb_build_object + jsonb_build_array (built-in pg_catalog
--   functions; no extension dependency).
--
--   ST_AsText(geography) has existed in PostGIS since 2.0; available
--   in every Supabase PostGIS version.
--
--   WKT parse path:
--     ST_AsText(s.geometry)                  -> 'POINT(-123.45 49.28)'
--     translate(..., 'POINT()', '')          -> '-123.45 49.28'
--     split_part(..., ' ', 1)::float8        -> -123.45 (lng)
--     split_part(..., ' ', 2)::float8        -> 49.28   (lat)
--
--   Output GeoJSON shape:
--     {type: "Point", coordinates: [lng, lat]}
--
--   Wire-identical to ST_AsGeoJSON for 2D Point geographies. Matches
--   GeoJsonPoint contract in src/app/(dashboard)/matrix-map/types.ts
--   exactly.
--
-- TRADE-OFFS
--
--   - Slightly slower than ST_AsGeoJSON (string-build + parse vs direct
--     serialization). For ~9 seed sites province-wide: negligible.
--     For 1000+ sites: still well under 100ms total in Postgres.
--   - Assumes ST_AsText returns canonical "POINT(lng lat)" format. This
--     is the WKT standard; PostGIS conforms.
--   - Does NOT support 3D points (POINTZ would be "POINT Z(lng lat z)"
--     not "POINT(lng lat)"); matrix_map.samples.geometry is
--     geography(POINT, 4326) -- 2D only -- so this is safe.
--
-- IDEMPOTENCY + PATTERN
--
--   BEGIN/COMMIT. CREATE OR REPLACE FUNCTION idempotent. Transient
--   GRANT CREATE / REVOKE CREATE around ALTER FUNCTION OWNER (matches
--   PR-MAP-1 / PR-MAP-3a / 20260520000004-07 pattern).
--
-- PRE-FLIGHT (run READ-ONLY in Supabase SQL Editor before applying):
--
--   -- 1. Confirm ST_AsText(geography) works for a sample point.
--   SELECT ST_AsText(s.geometry) AS wkt
--   FROM matrix_map.samples s LIMIT 3;
--   -- Expected: 3 rows; wkt looks like 'POINT(-123.4 49.2)' format.
--
-- POST-APPLY VERIFICATION:
--
--   -- (a) Smoke call -- SQL Editor raises auth gate (42501 requires
--   --     authenticated context). NOT 42883 NOT 42501 (schema) NOT 42704.
--   SELECT matrix_map.fetch_samples_with_hidden_summary(NULL::jsonb);
--   -- Expected: 42501 requires authenticated context.
--
--   -- (b) Browser: /matrix-options -> Interactive Map tab. Sample
--   --     markers should render with 9-state symbology.
--
-- Plain ASCII only -- no em-dashes / smart quotes / Unicode arrows.
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
  -- (1) Auth gate.
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

  -- (3) p_bbox accepted but IGNORED in v1.

  -- (4) Visible samples.
  --
  --     2026-05-20 ST_AsText + WKT-parse fix (fourth iteration; designed
  --     to be the last). Constraints empirically proven this session:
  --       - matrix_map_owner can call unqualified PostGIS functions
  --         via search_path (function lookup skips USAGE check).
  --       - matrix_map_owner CANNOT reference types in extensions
  --         (USAGE blocked).
  --       - ST_X(geography) / ST_Y(geography) overloads missing.
  --       - ST_AsText(geography) is universally available since
  --         PostGIS 2.0.
  --
  --     Path: ST_AsText -> 'POINT(lng lat)' text -> strip 'POINT()'
  --     wrapper with translate() -> split_part on the remaining
  --     'lng lat' -> cast each half to float8 -> assemble into
  --     {type:"Point", coordinates:[lng, lat]}. Wire-identical to
  --     ST_AsGeoJSON for 2D Points. samples.geometry is geography
  --     (POINT, 4326) -- always 2D -- so the WKT format is always
  --     "POINT(lng lat)" without extra dimensions.
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
          split_part(translate(ST_AsText(s.geometry), 'POINT()', ''), ' ', 1)::float8,
          split_part(translate(ST_AsText(s.geometry), 'POINT()', ''), ' ', 2)::float8
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
  '2026-05-20 ST_AsText + WKT-parse fix: extract coordinates via '
  'ST_AsText (universally-available geography function in PostGIS 2.0+) '
  'and SQL string parse (translate + split_part). Build GeoJSON '
  'manually with jsonb_build_object. Avoids all type references and '
  'extensions schema dependencies. Wire-identical to ST_AsGeoJSON for '
  '2D Point geographies.';

REVOKE CREATE ON SCHEMA matrix_map FROM matrix_map_owner;

COMMIT;
