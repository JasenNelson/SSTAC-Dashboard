-- =====================================================================
-- PR-MAP-1.1 -- admin/matrix_admin bypass for fetch_samples_with_hidden_summary
-- =====================================================================
--
-- Problem this migration solves
-- -----------------------------
-- The Option A migration (20260521000001) made the fetch RPC filter
-- samples through:
--
--     (d.public = true OR matrix_map.has_private_grant(d.id))
--
-- There is no admin bypass. After the Path A ETL load all 19 DRAs land
-- with public=false and there are 0 private_data_grants rows. The result:
-- admins logged in to /matrix-options see 0 visible samples and the
-- partial-visibility banner reports 282/8 hidden because the visibility
-- predicate gives the same answer to admins as to any other allowlisted
-- caller.
--
-- The intended product behaviour is that holders of the admin or
-- matrix_admin role see all non-deleted DRAs regardless of d.public, and
-- their hidden_* counters are zero (nothing is hidden from them, so the
-- banner suppresses itself client-side).
--
-- Reconciled live findings (read-only MCP verify packet 2026-05-21)
-- -----------------------------------------------------------------
-- - fetch_samples_with_hidden_summary owner = matrix_map_owner.
-- - flip_dra_public owner = matrix_map_owner. flip_dra_public already
--   queries public.user_roles for the same role gate; reusing its
--   pattern is the path of least surprise.
-- - matrix_map_owner has SELECT on public.user_roles and USAGE on the
--   public schema, so the role lookup runs cleanly under SECURITY
--   DEFINER without additional grants.
-- - public.user_roles columns: id bigint, user_id uuid, role text,
--   created_at timestamptz.
-- - public.user_roles distinct values: 'admin', 'member'. No
--   'matrix_admin' rows exist today; the IN ('admin','matrix_admin')
--   gate future-proofs without forcing seed data.
-- - 3 users currently hold the admin role.
--
-- What changes
-- ------------
-- 1. Declare v_is_admin and populate it from public.user_roles using the
--    same EXISTS pattern as flip_dra_public.
-- 2. Extend the visible_samples WHERE disjunction to
--    (v_is_admin OR d.public = true OR matrix_map.has_private_grant(d.id)).
--    Non-admin callers are unaffected because v_is_admin is false.
-- 3. Short-circuit the hidden_sample_count and hidden_dra_ids
--    computations when v_is_admin -- admins have nothing hidden, so
--    return 0 and an empty array directly. This also skips two
--    full-table-scan counter queries on the admin path.
-- 4. data_snapshot_version logic unchanged.
--
-- What does NOT change
-- --------------------
-- - Function signature, ownership, SECURITY DEFINER setting, search_path,
--   GRANT/REVOKE pattern -- all preserved from migration 20260521000001.
-- - The 8 samples with source_dra_id IS NULL remain invisible to all
--   callers including admins because the INNER JOIN on dras drops them.
--   That is an ETL data-quality gap (BN-RRM doc_ids referenced by
--   stations but missing from the 19 seed-site DRAs), tracked
--   separately and out of scope for this RPC patch.
-- - The non-admin visibility logic is byte-identical for the partial-
--   visibility banner counts. Anonymous and member-only sessions still
--   see the same hidden_sample_count / hidden_dra_count they saw before
--   this migration.
--
-- Forward-only. No DROP / no rollback emitted here. If an inverse is
-- ever needed, author a separate migration.
-- =====================================================================

BEGIN;

SET LOCAL search_path = matrix_map, public, extensions, pg_catalog;

-- Same transient owner-grant pattern as migration 20260521000001.
GRANT matrix_map_owner TO postgres;
GRANT CREATE ON SCHEMA matrix_map TO matrix_map_owner;

DROP FUNCTION IF EXISTS matrix_map.fetch_samples_with_hidden_summary(jsonb);

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
  v_is_admin            boolean;
  v_visible             jsonb;
  v_hidden_sample_count int;
  v_hidden_dra_ids      uuid[];
  v_hidden_dra_count    int;
  v_snapshot            text;
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

  -- Admin bypass gate. Same EXISTS pattern as flip_dra_public so the
  -- role surface stays consistent across matrix_map RPCs.
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = v_uid
      AND role IN ('admin', 'matrix_admin')
  )
  INTO v_is_admin;

  -- p_bbox is accepted but ignored in v1. Future bbox filtering should
  -- use longitude/latitude and the samples_lng_lat_not_null_idx index.

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
    ORDER BY s.bnrrm_station_id NULLS LAST, s.id
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
    'data_snapshot_version', v_snapshot
  );
END;
$$;

ALTER FUNCTION matrix_map.fetch_samples_with_hidden_summary(jsonb)
  OWNER TO matrix_map_owner;

REVOKE EXECUTE ON FUNCTION matrix_map.fetch_samples_with_hidden_summary(jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION matrix_map.fetch_samples_with_hidden_summary(jsonb)
  TO authenticated;

COMMENT ON FUNCTION matrix_map.fetch_samples_with_hidden_summary(jsonb) IS
  'PR-MAP-1.1 admin-bypass: admins and matrix_admins see all non-deleted '
  'DRAs regardless of d.public, and their hidden_sample_count/hidden_dra_* '
  'counters return 0/empty so the partial-visibility banner suppresses '
  'itself client-side. Non-admins are unaffected. The role gate is '
  'identical to matrix_map.flip_dra_public for surface consistency.';

REVOKE CREATE ON SCHEMA matrix_map FROM matrix_map_owner;

COMMIT;
