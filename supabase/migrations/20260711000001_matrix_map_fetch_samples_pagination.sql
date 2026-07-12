-- =====================================================================
-- matrix_map.fetch_samples_with_hidden_summary -- raise visible-row cap
-- =====================================================================
-- Lane: data-truth 2026-07-11 (T13). APPLIED 2026-07-11 to production via the owner-approved
-- project-scoped /supabase MCP path (per current AGENTS.md Supabase Protocol: owner-approved MCP
-- writes are allowed for an exact, drafted, codex-reviewed operation). This file re-homes the
-- already-applied SQL into repo migration history so the repo matches the live DB. Post-apply verify
-- confirmed cap_is_5000=true, still_2500=false, owner=matrix_map_owner, secdef=true, signature
-- unchanged, and 0 DRA-visibility change. (The prior "STAGED / do NOT apply via MCP" banner reflected
-- the superseded SQL-Editor-only posture.)
--
-- PROBLEM (verified 2026-07-11, MAP_ACCESS_DIAGNOSIS.md): the province-wide
-- admin view has 4486 valid samples but the RPC capped at v_cap=2500
-- (LIMIT 2500) -> 1986 rows silently dropped for admins/granted viewers.
--
-- FIX (minimal, security-preserving): raise v_cap 2500 -> 5000 so the CURRENT
-- dataset (4486) returns in full. The honest 'truncated' flag + the
-- "Showing N of M -- zoom in to see all" banner (MatrixMap.tsx) already
-- handle any FUTURE dataset > 5000, and the viewport refetch (zoom >= 7)
-- pages by geography. True offset-pagination (a signature change) is a
-- deferred future lane if the dataset grows substantially past the cap --
-- see MAP_CAP_PAGINATION_SPEC.md.
--
-- WHY CREATE OR REPLACE (same signature) and NOT drop+recreate: CREATE OR
-- REPLACE preserves the existing function OWNER (matrix_map_owner -> the
-- SECDEF execution identity with BYPASSRLS) and the existing grants
-- (authenticated:EXECUTE, matrix_map_owner:EXECUTE; anon/service_role: no).
-- A DROP+CREATE would reset ownership to the migrating role (postgres) and
-- default-grant EXECUTE to PUBLIC -- a security regression. Keeping the
-- single-arg signature is therefore REQUIRED, not merely convenient.
--
-- Every auth/allowlist/admin/visibility predicate and the PROVINCE-WIDE
-- (spatial-oracle-safe) hidden-summary aggregate are byte-for-byte
-- unchanged from 20260623000001; the ONLY change is the v_cap constant.
-- Append-only. Plain ASCII only.
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
  v_cap                 constant int := 5000;  -- raised from 2500 (covers 4486 + headroom)
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
    v_has_bbox := false;
  END;

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
    'total_in_bbox',         v_total_in_bbox,
    'returned_sample_count', LEAST(v_total_in_bbox, v_cap),
    'truncated',             v_truncated,
    'bbox_applied',          v_has_bbox
  );
END;
$function$;
