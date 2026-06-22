-- =====================================================================
-- matrix_map.fetch_measurements_for_samples -- expose date_precision + NULLS LAST
-- =====================================================================
--
-- OWNER-PASTE-GATED (do NOT auto-apply): paste this into the Supabase Studio
-- SQL Editor. The app-layer change (PR feat/matrix-map-undated-consumer) is
-- additive + backward-compatible: until this migration is applied the RPC
-- response simply omits date_precision and the consumers derive it from a null
-- event_date (undated). After apply, the RPC reports the authoritative value.
--
-- DEPENDS ON: 20260620000001_matrix_map_event_date_nullable.sql (which makes
-- sample_events.event_date nullable and adds the date_precision column,
-- default 'exact' NOT NULL). Apply that first.
--
-- What changes vs 20260521000003_matrix_map_fetch_measurements_rpc.sql:
--   1. The measurement_rows projection now also selects se.date_precision, so
--      the JSON each row carries includes date_precision ('exact' | 'undated').
--   2. The ORDER BY on se.event_date gains NULLS LAST so undated rows (event_date
--      IS NULL) sort to the end of each sample group rather than the front.
-- Everything else (security, allowlist, admin/private-grant visibility, the
-- provenance-chain join, grants) is IDENTICAL to the prior definition.
--
-- Forward-only. No rollback emitted here.
-- =====================================================================

BEGIN;

SET LOCAL search_path = matrix_map, public, extensions, pg_catalog;

-- Same transient owner-grant pattern as the prior matrix_map RPC migrations so
-- CREATE OR REPLACE runs as the function's owning role.
GRANT matrix_map_owner TO postgres;
GRANT CREATE ON SCHEMA matrix_map TO matrix_map_owner;

CREATE OR REPLACE FUNCTION matrix_map.fetch_measurements_for_samples(
  p_sample_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = matrix_map, public, extensions, pg_temp
AS $$
DECLARE
  v_uid          uuid;
  v_caller_email text;
  v_is_admin     boolean;
  v_rows         jsonb;
BEGIN
  v_uid := matrix_map.current_user_id();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'fetch_measurements_for_samples requires authenticated context'
      USING ERRCODE = '42501';
  END IF;

  v_caller_email := (matrix_map.jwt_claims() ->> 'email')::text;
  IF NOT matrix_map.is_email_allowlisted(v_caller_email) THEN
    RAISE EXCEPTION 'caller not on matrix_map allowlist'
      USING ERRCODE = '42501';
  END IF;

  IF p_sample_ids IS NULL OR array_length(p_sample_ids, 1) IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = v_uid
      AND role IN ('admin', 'matrix_admin')
  )
  INTO v_is_admin;

  WITH input_sample_ids AS (
    SELECT DISTINCT unnest(p_sample_ids) AS sample_id
  ),
  measurement_rows AS (
    SELECT
      s.id AS sample_id,
      s.display_name AS sample_display_name,
      s.station_id AS sample_station_id,
      se.id AS sample_event_id,
      se.event_date,
      se.date_precision,
      m.id AS measurement_id,
      m.medium,
      sub.id AS substance_id,
      sub.key AS substance_key,
      sub.display_name AS substance_display_name,
      m.value,
      m.unit,
      m.detection_limit,
      m.qualifier,
      m.censored,
      s.coordinate_quality_tier,
      s.classification,
      s.source_dra_id,
      d.title AS source_dra_title,
      d.citation AS source_dra_citation
    FROM input_sample_ids i
    JOIN matrix_map.samples s ON s.id = i.sample_id
    JOIN matrix_map.dras d ON d.id = s.source_dra_id
    JOIN matrix_map.sample_events se ON se.sample_id = s.id
    JOIN matrix_map.measurements m ON m.sample_event_id = se.id
    JOIN matrix_map.substances sub ON sub.id = m.substance_id
    WHERE s.source_dra_id IS NOT NULL
      AND d.is_deleted = false
      AND (v_is_admin OR d.public = true OR matrix_map.has_private_grant(d.id))
    ORDER BY
      s.bnrrm_station_id NULLS LAST,
      s.id,
      se.event_date NULLS LAST,
      sub.display_name,
      m.id
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(measurement_rows)), '[]'::jsonb)
  FROM measurement_rows
  INTO v_rows;

  RETURN v_rows;
END;
$$;

ALTER FUNCTION matrix_map.fetch_measurements_for_samples(uuid[])
  OWNER TO matrix_map_owner;

REVOKE EXECUTE ON FUNCTION matrix_map.fetch_measurements_for_samples(uuid[])
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION matrix_map.fetch_measurements_for_samples(uuid[])
  TO authenticated;

COMMENT ON FUNCTION matrix_map.fetch_measurements_for_samples(uuid[]) IS
  'Measurement Workbench RPC. 2026-06-22: now also projects se.date_precision '
  '(exact | undated) and sorts se.event_date NULLS LAST so undated rows trail '
  'each sample group. Same admin-bypass / private-grant visibility and '
  'provenance-chain join as 20260521000003. Depends on 20260620000001 (nullable '
  'event_date + date_precision column).';

REVOKE CREATE ON SCHEMA matrix_map FROM matrix_map_owner;

COMMIT;
