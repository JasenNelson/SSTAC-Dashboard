-- =====================================================================
-- OPTION A DRAFT -- matrix_map durable longitude/latitude columns
-- =====================================================================
--
-- DO NOT MERGE AS-IS.
--
-- Keep the _OPTION_A_DRAFT suffix until owner approves this reconciled
-- version. Owner applies SQL manually in Supabase Studio; Codex does not
-- apply live SQL.
--
-- Reconciled against:
--   C:/Projects/SSTAC-Dashboard/.tmp_explore_results_2026_05_21.json
--
-- Load-bearing live findings:
-- - Q01/Q02: target is PostgreSQL 17.4 / PostGIS 3.3.7.
-- - Q04/Q06: ST_X/ST_Y have geometry overloads only; geography overload
--   count is 0, so the live migration-07-style RPC fails with 42883.
-- - Q05: ST_AsText(geography) smoke returned POINT(-123.3656 48.4284).
-- - Q08/Q09: matrix_map_owner has no USAGE on extensions; it has only
--   matrix_map/public schema USAGE and narrow table grants.
-- - Q10/Q11: samples.geometry is geography(Point,4326) NOT NULL.
-- - Q13: live RPC body uses ST_X(s.geometry)/ST_Y(s.geometry) on the
--   geography column even though those overloads do not exist.
-- - Q14: samples table is empty, sample_count=0; no data backfill is
--   needed before the new columns can be introduced.
-- - Q17/Q18: samples RLS is enabled and forced with admin_all plus
--   authenticated_select policies.
-- - Q19: no longitude/latitude columns or related constraints/indexes
--   exist yet; Option A is clean to apply.
--
-- Decision R1: choose R1c.
--
-- Rationale: durable numeric coordinates remove all PostGIS calls from
-- the SECURITY DEFINER read RPC. A postgres-owned SECURITY DEFINER
-- BEFORE trigger populates longitude/latitude on INSERT/UPDATE from
-- geometry using ST_X/ST_Y on geometry::geometry, which is safe because
-- Q04/Q06 confirm geometry overloads exist and Q08 shows only
-- matrix_map_owner lacks extensions USAGE. The trigger function does not
-- read or write tables; it only normalizes NEW.longitude/NEW.latitude.
-- Keeping the columns nullable preserves additive migration safety, and
-- the CHECK constraint enforces that rows with geometry have both
-- coordinates in WGS84 bounds.
--
-- Decision R2: the RPC projects GeoJSON directly from durable numeric
-- columns:
--
--   jsonb_build_object(
--     'type', 'Point',
--     'coordinates', jsonb_build_array(s.longitude, s.latitude)
--   )
--
-- This exactly matches the frontend wire shape:
--   {"type":"Point","coordinates":[lng,lat]}
--
-- Decision R3: the samples table is empty per Q14. The separate backfill
-- packet is therefore expected to update 0 rows and then validate the
-- constraint. It remains safe if rows appear before owner runs it.
--
-- This draft is forward-only. It adds columns, a trigger, a constraint,
-- an index, and replaces the fetch RPC. It intentionally does not DROP
-- longitude or latitude. If rollback is ever required, author a separate
-- forward migration.
-- =====================================================================

BEGIN;

SET LOCAL search_path = matrix_map, public, extensions, pg_catalog;

-- Transient CREATE privilege follows the established matrix_map_owner
-- ALTER FUNCTION OWNER pattern from prior matrix_map migrations.
GRANT matrix_map_owner TO postgres;
GRANT CREATE ON SCHEMA matrix_map TO matrix_map_owner;

-- ---------------------------------------------------------------------
-- SECTION 1 -- Add durable coordinate columns.
-- ---------------------------------------------------------------------

ALTER TABLE matrix_map.samples
  ADD COLUMN IF NOT EXISTS longitude float8,
  ADD COLUMN IF NOT EXISTS latitude  float8;

COMMENT ON COLUMN matrix_map.samples.longitude IS
  'Option A 2026-05-21 reconciled draft: durable WGS84 longitude. '
  'Per exploration Q04/Q06/Q13, runtime ST_X/ST_Y calls against the '
  'geography column fail because this PostGIS 3.3.7 target has geometry '
  'overloads only. Future writes are populated by the postgres-owned '
  'samples_populate_lng_lat_from_geometry trigger.';

COMMENT ON COLUMN matrix_map.samples.latitude IS
  'Option A 2026-05-21 reconciled draft: durable WGS84 latitude paired '
  'with samples.longitude. The map RPC builds GeoJSON directly from '
  'longitude/latitude and no longer calls PostGIS functions in the '
  'SECURITY DEFINER projection path.';

-- ---------------------------------------------------------------------
-- SECTION 2 -- R1c write-path trigger.
-- ---------------------------------------------------------------------
--
-- Q08 shows matrix_map_owner has no USAGE on the extensions schema.
-- The read RPC stays owned by matrix_map_owner, so it must not call
-- ST_X/ST_Y, reference extensions.geometry, or otherwise depend on
-- extension schema privileges.
--
-- The trigger function is deliberately owned by postgres and SECURITY
-- DEFINER. It runs only on writes to matrix_map.samples and only mutates
-- NEW.longitude/NEW.latitude. It uses ST_X/ST_Y on geometry::geometry,
-- which Q04/Q06 confirm is the available overload family.

CREATE OR REPLACE FUNCTION matrix_map.populate_sample_lng_lat_from_geometry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = matrix_map, public, extensions, pg_catalog, pg_temp
AS $$
BEGIN
  IF NEW.geometry IS NULL THEN
    NEW.longitude := NULL;
    NEW.latitude := NULL;
    RETURN NEW;
  END IF;

  NEW.longitude := ST_X(NEW.geometry::geometry);
  NEW.latitude := ST_Y(NEW.geometry::geometry);
  RETURN NEW;
END;
$$;

ALTER FUNCTION matrix_map.populate_sample_lng_lat_from_geometry()
  OWNER TO postgres;

COMMENT ON FUNCTION matrix_map.populate_sample_lng_lat_from_geometry() IS
  'Option A 2026-05-21 R1c trigger function. Owned by postgres and '
  'SECURITY DEFINER so write-time coordinate extraction can use the '
  'extensions geometry overloads confirmed by exploration Q04/Q06. The '
  'SECURITY DEFINER map RPC remains free of PostGIS calls.';

DROP TRIGGER IF EXISTS samples_populate_lng_lat_from_geometry
  ON matrix_map.samples;

CREATE TRIGGER samples_populate_lng_lat_from_geometry
  BEFORE INSERT OR UPDATE OF geometry, longitude, latitude
  ON matrix_map.samples
  FOR EACH ROW
  EXECUTE FUNCTION matrix_map.populate_sample_lng_lat_from_geometry();

COMMENT ON TRIGGER samples_populate_lng_lat_from_geometry ON matrix_map.samples IS
  'Option A 2026-05-21 R1c: populate durable longitude/latitude from '
  'samples.geometry on INSERT and coordinate-affecting UPDATE. Existing '
  'sample_count=0 per exploration Q14, so the backfill packet is a safe '
  'no-op unless rows are loaded before it runs.';

-- ---------------------------------------------------------------------
-- SECTION 3 -- Presence/range constraint and coordinate index.
-- ---------------------------------------------------------------------
--
-- NOT VALID is intentional even though Q14 says the table is empty. It
-- keeps the migration additive and lets the owner-run backfill packet
-- perform the explicit validation step. PostgreSQL still enforces a
-- NOT VALID CHECK constraint for subsequent INSERT/UPDATE rows.
--
-- The CHECK does not call PostGIS functions. The trigger is the only
-- PostGIS-dependent write-time mechanism, avoiding extension privilege
-- surprises in low-privilege write paths.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'matrix_map'
      AND c.relname = 'samples'
      AND con.conname = 'samples_lng_lat_geometry_consistency'
  ) THEN
    ALTER TABLE matrix_map.samples
      ADD CONSTRAINT samples_lng_lat_geometry_consistency
      CHECK (
        geometry IS NULL
        OR (
          longitude IS NOT NULL
          AND latitude IS NOT NULL
          AND longitude BETWEEN -180 AND 180
          AND latitude BETWEEN -90 AND 90
        )
      ) NOT VALID;
  END IF;
END
$$;

COMMENT ON CONSTRAINT samples_lng_lat_geometry_consistency
  ON matrix_map.samples IS
  'Option A 2026-05-21 reconciled draft: rows with geometry must carry '
  'non-null WGS84 longitude/latitude in valid bounds. Numeric consistency '
  'is supplied by the postgres-owned R1c trigger; this CHECK intentionally '
  'avoids PostGIS calls.';

CREATE INDEX IF NOT EXISTS samples_lng_lat_not_null_idx
  ON matrix_map.samples (longitude, latitude)
  WHERE longitude IS NOT NULL AND latitude IS NOT NULL;

COMMENT ON INDEX matrix_map.samples_lng_lat_not_null_idx IS
  'Option A 2026-05-21 reconciled draft: partial coordinate index for '
  'map bbox, analytics, and future viewport filtering without runtime '
  'geography casts in the fetch RPC.';

-- ---------------------------------------------------------------------
-- SECTION 4 -- RPC body: build GeoJSON from numeric columns.
-- ---------------------------------------------------------------------

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
      AND (d.public = true OR matrix_map.has_private_grant(d.id))
    ORDER BY s.bnrrm_station_id NULLS LAST, s.id
  ) row_obj
  INTO v_visible;

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
  'Option A 2026-05-21 reconciled draft: build visible sample GeoJSON '
  'from durable samples.longitude/samples.latitude columns. Per '
  'exploration Q04/Q06/Q13, the live ST_X/ST_Y geography RPC fails on '
  'this target; this RPC projection contains no PostGIS function calls.';

REVOKE CREATE ON SCHEMA matrix_map FROM matrix_map_owner;

COMMIT;
