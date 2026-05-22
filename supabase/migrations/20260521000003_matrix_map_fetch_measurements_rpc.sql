-- =====================================================================
-- PR-MAP-5 -- fetch measurements for selected matrix-map samples
-- =====================================================================
--
-- Reconciled live findings (owner-run read-only verify 2026-05-21)
-- -----------------------------------------------------------------
-- - matrix_map schema exists.
-- - matrix_map.fetch_measurements_for_samples does NOT exist.
-- - matrix_map_owner is NOLOGIN and BYPASSRLS.
-- - matrix_map_owner already has SELECT on matrix_map.samples,
--   matrix_map.dras, and public.user_roles.
-- - matrix_map_owner does NOT yet have SELECT on matrix_map.measurements,
--   matrix_map.sample_events, or matrix_map.substances; this migration
--   grants only those additional SELECT privileges to the no-login owner
--   role so the SECURITY DEFINER function can read its join surface.
-- - Live row counts: 290 samples, 302 sample_events, 7472 measurements,
--   157 substances, 19 dras.
-- - The strict sample_event -> sample -> source_dra -> substances join
--   currently returns 7409 measurements; excluded rows remain out of
--   scope for this RPC because they lack the provenance chain required
--   for the Measurement Workbench and confidentiality filtering.
-- - Measurement domain is sediment-only today: 2899 censored rows with
--   qualifier '<' and 4573 uncensored rows with NULL qualifier.
--
-- What this creates
-- -----------------
-- matrix_map.fetch_measurements_for_samples(p_sample_ids uuid[])
--
-- The RPC returns a JSON array for the selected sample IDs:
--   sample_id, sample_display_name, sample_station_id, sample_event_id,
--   event_date, measurement_id, medium, substance_id, substance_key,
--   substance_display_name, value, unit, detection_limit, qualifier,
--   censored, coordinate_quality_tier, classification, source_dra_id,
--   source_dra_title, source_dra_citation.
--
-- Security behaviour mirrors fetch_samples_with_hidden_summary:
-- - authenticated context required
-- - matrix_map email allowlist required
-- - admin / matrix_admin callers see non-deleted DRAs regardless of
--   public/private state
-- - non-admin callers see only public or privately-granted DRAs
-- - samples without source_dra_id are intentionally excluded
--
-- Forward-only. No rollback emitted here.
-- =====================================================================

BEGIN;

SET LOCAL search_path = matrix_map, public, extensions, pg_catalog;

-- Same transient owner-grant pattern as prior matrix_map RPC migrations.
GRANT matrix_map_owner TO postgres;
GRANT CREATE ON SCHEMA matrix_map TO matrix_map_owner;

-- The verified live grant surface lacked these three SELECT grants for
-- the no-login function owner. Keep the grant set narrow and read-only.
GRANT SELECT ON matrix_map.measurements TO matrix_map_owner;
GRANT SELECT ON matrix_map.sample_events TO matrix_map_owner;
GRANT SELECT ON matrix_map.substances TO matrix_map_owner;

DROP FUNCTION IF EXISTS matrix_map.fetch_measurements_for_samples(uuid[]);

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
      se.event_date,
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
  'PR-MAP-5 Measurement Workbench RPC. Owner-run read-only verify on '
  '2026-05-21 showed the function was absent; matrix_map_owner is '
  'NOLOGIN BYPASSRLS; matrix_map_owner needed additional SELECT on '
  'measurements, sample_events, and substances; live domain was 290 '
  'samples / 302 events / 7472 measurements / 157 substances / 19 DRAs. '
  'Returns only measurements with a valid sample -> DRA provenance chain, '
  'using the same admin-bypass and private-grant visibility semantics as '
  'fetch_samples_with_hidden_summary.';

REVOKE CREATE ON SCHEMA matrix_map FROM matrix_map_owner;

COMMIT;
