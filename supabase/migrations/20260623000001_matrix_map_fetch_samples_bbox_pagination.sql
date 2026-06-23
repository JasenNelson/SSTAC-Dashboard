-- =====================================================================
-- BBOX-LANE Stage 1 -- fetch_samples_with_hidden_summary honors p_bbox + caps rows
-- =====================================================================
--
-- Problem this migration solves
-- -----------------------------
-- The v1 RPC (20260521000002) ACCEPTS p_bbox but IGNORES it -- it returns
-- ALL visible samples province-wide in one payload. With the 9-site seed
-- (290 stations) that is fine, but the deferred full DB2 load is 7562
-- stations, and admins bypass public=false so they would receive the whole
-- set in one response. Per docs/design/matrix-map/BBOX_PAGINATION_LANE_2026_06_23.md
-- (+ MAP_2A_DATASET_INVESTIGATION_2026_06_23.md, Claude+codex consensus),
-- viewport-bounded fetch + a row cap must land BEFORE the full data load.
--
-- What changes
-- ------------
-- fetch_samples_with_hidden_summary now:
--   1. Parses an optional viewport bbox from p_bbox jsonb with the shape
--        {"min_lng":num,"min_lat":num,"max_lng":num,"max_lat":num}
--      and filters visible samples to longitude/latitude WITHIN the box.
--      A NULL p_bbox (or any missing / non-numeric / inverted edge) =>
--      province-wide, IDENTICAL to v1 (full backward compatibility).
--   2. Caps the returned visible_samples at MAP_BBOX_SAMPLE_CAP (2500) via
--      LIMIT, and reports total_in_bbox (count before the cap) + truncated
--      so the client can prompt "zoom in to see more". The cap is far above
--      the current 290 stations, so present behavior is unchanged; after the
--      full load a province-wide (null-bbox) call is bounded by the cap by
--      design.
--   3. KEEPS the hidden_* counters PROVINCE-WIDE regardless of p_bbox, exactly
--      as v1. bbox-scoping the hidden counts was REJECTED (codex P1 security):
--      because the RPC is callable with an arbitrary p_bbox, a non-admin
--      allowlisted caller could tile / binary-search tiny bboxes and infer the
--      LOCATIONS of private DRA samples (a spatial oracle). Hidden disclosure
--      stays at v1's province-wide existence/count level (opaque uuids only).
--      ONLY visible_samples is viewport-bounded.
--
-- INVARIANTS PRESERVED (do not weaken):
--   - SECURITY DEFINER, owner matrix_map_owner, STABLE, fixed search_path.
--   - auth (current_user_id) + allowlist (is_email_allowlisted) gates.
--   - admin/matrix_admin bypass (public.user_roles role IN ('admin','matrix_admin')).
--   - the visibility predicate (v_is_admin OR d.public = true OR has_private_grant(d.id)).
--   - the existing return keys + types (new keys are ADDITIVE: the server
--     helper validates only the existing keys, so adding keys is safe).
--
-- Reconciled live findings (read-only MCP verify 2026-06-23)
-- ----------------------------------------------------------
-- - Live RPC body verified via pg_get_functiondef; this migration is a
--   superset that adds bbox filtering on visible_samples + a row cap only.
-- - samples carries durable longitude/latitude (double precision); the RPC
--   builds GeoJSON from them (no PostGIS in the SECDEF projection path).
-- - The bbox range scan is served by the EXISTING partial btree
--   samples_lng_lat_not_null_idx (20260521000001:198-200, same key+predicate);
--   no new index needed (codex P3).
--
-- Append-only: CREATE OR REPLACE FUNCTION (same signature). No new objects.
-- =====================================================================

CREATE OR REPLACE FUNCTION matrix_map.fetch_samples_with_hidden_summary(p_bbox jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'matrix_map', 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_uid                 uuid;
  v_caller_email        text;
  v_is_admin            boolean;
  v_visible             jsonb;
  v_hidden_sample_count int;
  v_hidden_dra_ids      uuid[];
  v_hidden_dra_count    int;
  v_snapshot            text;
  v_has_bbox            boolean := false;
  v_min_lng             double precision;
  v_min_lat             double precision;
  v_max_lng             double precision;
  v_max_lat             double precision;
  v_total_in_bbox       int;
  v_cap                 constant int := 2500;  -- MAP_BBOX_SAMPLE_CAP
  v_truncated           boolean := false;
BEGIN
  v_uid := matrix_map.current_user_id();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'fetch_samples_with_hidden_summary requires authenticated context'
      USING ERRCODE = '42501';
  END IF;

  v_caller_email := (matrix_map.jwt_claims() ->> 'email')::text;
  IF NOT matrix_map.is_email_allowlisted(v_caller_email) THEN
    RAISE EXCEPTION 'caller not on matrix_map allowlist'
      USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = v_uid
      AND role IN ('admin', 'matrix_admin')
  )
  INTO v_is_admin;

  -- Parse the optional viewport bbox. NULL or ANY malformed / missing /
  -- non-numeric / inverted / out-of-WGS84-range edge => province-wide
  -- (v1 behavior preserved). The whole parse is wrapped so any cast failure
  -- (e.g. an absurd JSON magnitude) fails SAFE to province-wide, never errors.
  BEGIN
    IF p_bbox IS NOT NULL
       AND jsonb_typeof(p_bbox -> 'min_lng') = 'number'
       AND jsonb_typeof(p_bbox -> 'min_lat') = 'number'
       AND jsonb_typeof(p_bbox -> 'max_lng') = 'number'
       AND jsonb_typeof(p_bbox -> 'max_lat') = 'number' THEN
      v_min_lng := (p_bbox ->> 'min_lng')::double precision;
      v_min_lat := (p_bbox ->> 'min_lat')::double precision;
      v_max_lng := (p_bbox ->> 'max_lng')::double precision;
      v_max_lat := (p_bbox ->> 'max_lat')::double precision;
      IF v_min_lng <= v_max_lng AND v_min_lat <= v_max_lat
         AND v_min_lng >= -180 AND v_max_lng <= 180
         AND v_min_lat >= -90  AND v_max_lat <= 90 THEN
        v_has_bbox := true;
      END IF;
    END IF;
  EXCEPTION WHEN others THEN
    v_has_bbox := false;  -- fail safe: any parse/cast error => province-wide
  END;

  -- Total visible-eligible samples in scope BEFORE the cap (for truncated hint).
  SELECT COUNT(*)
  FROM matrix_map.samples s
  JOIN matrix_map.dras d ON d.id = s.source_dra_id
  WHERE s.longitude IS NOT NULL
    AND s.latitude IS NOT NULL
    AND s.source_dra_id IS NOT NULL
    AND d.is_deleted = false
    AND (v_is_admin OR d.public = true OR matrix_map.has_private_grant(d.id))
    AND (NOT v_has_bbox
         OR (s.longitude BETWEEN v_min_lng AND v_max_lng
             AND s.latitude BETWEEN v_min_lat AND v_max_lat))
  INTO v_total_in_bbox;

  v_truncated := v_total_in_bbox > v_cap;

  SELECT COALESCE(jsonb_agg(row_obj), '[]'::jsonb)
  FROM (
    SELECT
      s.id,
      s.bnrrm_station_id,
      s.station_id,
      s.display_name,
      jsonb_build_object(
        'type', 'Point',
        'coordinates', jsonb_build_array(s.longitude, s.latitude)
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
    JOIN matrix_map.dras d ON d.id = s.source_dra_id
    WHERE s.longitude IS NOT NULL
      AND s.latitude IS NOT NULL
      AND s.source_dra_id IS NOT NULL
      AND d.is_deleted = false
      AND (v_is_admin OR d.public = true OR matrix_map.has_private_grant(d.id))
      AND (NOT v_has_bbox
           OR (s.longitude BETWEEN v_min_lng AND v_max_lng
               AND s.latitude BETWEEN v_min_lat AND v_max_lat))
    ORDER BY s.bnrrm_station_id NULLS LAST, s.id
    LIMIT v_cap
  ) row_obj
  INTO v_visible;

  IF v_is_admin THEN
    v_hidden_sample_count := 0;
    v_hidden_dra_ids      := ARRAY[]::uuid[];
  ELSE
    -- PROVINCE-WIDE (NOT bbox-scoped) -- identical to v1. Do NOT add the bbox
    -- predicate here: it would turn the hidden summary into a spatial oracle
    -- for private DRA locations (codex P1). Hidden disclosure stays at v1's
    -- province-wide existence/count level.
    SELECT COUNT(*)
    FROM matrix_map.samples s
    JOIN matrix_map.dras d ON d.id = s.source_dra_id
    WHERE d.is_deleted = false
      AND d.public = false
      AND NOT matrix_map.has_private_grant(d.id)
    INTO v_hidden_sample_count;

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
  END IF;

  v_hidden_dra_count := array_length(v_hidden_dra_ids, 1);
  IF v_hidden_dra_count IS NULL THEN
    v_hidden_dra_count := 0;
  END IF;

  SELECT COALESCE(MAX(updated_at)::text, now()::text)
  FROM matrix_map.samples
  INTO v_snapshot;

  RETURN jsonb_build_object(
    'visible_samples',       v_visible,
    'hidden_sample_count',   v_hidden_sample_count,
    'hidden_dra_count',      v_hidden_dra_count,
    'hidden_dra_ids',        to_jsonb(v_hidden_dra_ids),
    'data_snapshot_version', v_snapshot,
    -- NEW (additive; existing consumers ignore these):
    'total_in_bbox',         v_total_in_bbox,
    'returned_sample_count', LEAST(v_total_in_bbox, v_cap),
    'truncated',             v_truncated,
    'bbox_applied',          v_has_bbox
  );
END;
$function$;
