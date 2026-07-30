-- ============================================================================
-- F2 ELIG -- INDEPENDENT ROLLBACK VERIFICATION (V6 section 13.2.3).
--
-- Executed through a NEW `docker exec -i <same run-owned container> psql`
-- connection. The freshness of the connection IS the point: it cannot see
-- anything the rolled-back transaction did, so it is a genuine independent
-- observer of the post-rollback catalog and table state.
--
-- Emits `ELIG_AFTER|<key>|<value>` for the catalog state and
-- `ELIG_RESULT|<id>|<PASS|FAIL>|<detail>` for the row-absence assertion. The
-- harness compares the ELIG_AFTER values against the ELIG_BASELINE values
-- captured BEFORE suspension, byte for byte.
--
-- This file performs NO DDL and NO writes. If it ever needs to, something has
-- gone wrong with the rollback and the correct response is to STOP, not to
-- repair -- V6 section 15: do not continue testing against a database whose
-- trigger or constraint state is unproven.
-- ============================================================================

\set ON_ERROR_STOP on

-- The database identity guard applies here too. A verification run against the
-- wrong database would report a pristine catalog that says nothing about the
-- one the fixture actually touched.
DO $$
BEGIN
  IF current_database() <> 'sstac_replay' THEN
    RAISE EXCEPTION 'ELIG rollback verification: expected database sstac_replay, got %', current_database();
  END IF;
END
$$;

-- The trigger must EXIST and carry its captured tgenabled (expected 'O').
SELECT 'ELIG_AFTER|tgenabled|' || coalesce(max(t.tgenabled)::text, '(absent)')
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'matrix_map'
  AND c.relname = 'samples'
  AND t.tgname = 'samples_populate_lng_lat_from_geometry';

-- The constraint must EXIST with a byte-identical definition...
SELECT 'ELIG_AFTER|condef|' || coalesce(max(pg_get_constraintdef(con.oid)), '(absent)')
FROM pg_constraint con
JOIN pg_class c ON c.oid = con.conrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'matrix_map'
  AND c.relname = 'samples'
  AND con.conname = 'samples_lng_lat_geometry_consistency';

-- ...and must still be in its original NOT VALID state. A rollback that somehow
-- left it VALIDATED would be a different constraint in practice.
-- Cast to text BEFORE aggregating: there is no max(boolean).
SELECT 'ELIG_AFTER|convalidated|' || coalesce(max(con.convalidated::text), '(absent)')
FROM pg_constraint con
JOIN pg_class c ON c.oid = con.conrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'matrix_map'
  AND c.relname = 'samples'
  AND con.conname = 'samples_lng_lat_geometry_consistency';

-- ELIG_08 -- none of the seeded rows survive.
SELECT 'ELIG_RESULT|ELIG_08|'
    || CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END
    || '|seeded ELIG samples still present after rollback: ' || count(*) || ' (expected 0)'
FROM matrix_map.samples
WHERE source_dra_id IN (
  'e1111111-1111-4111-8111-111111111111',
  'e2222222-2222-4222-8222-222222222222',
  'e3333333-3333-4333-8333-333333333333',
  'e4444444-4444-4444-8444-444444444444'
);

-- ELIG_09 -- nor do the DRAs the fixture created.
SELECT 'ELIG_RESULT|ELIG_09|'
    || CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END
    || '|seeded ELIG DRAs still present after rollback: ' || count(*) || ' (expected 0)'
FROM matrix_map.dras
WHERE id IN (
  'e1111111-1111-4111-8111-111111111111',
  'e2222222-2222-4222-8222-222222222222',
  'e3333333-3333-4333-8333-333333333333',
  'e4444444-4444-4444-8444-444444444444'
);

-- ELIG_10 -- POSITIVE CONTROL on the restored protections. With the trigger
-- back in force, an INSERT supplying a deliberately wrong latitude must have
-- that value OVERWRITTEN from the geometry rather than stored. This proves the
-- trigger is not merely PRESENT in the catalog but actually FIRING again --
-- `tgenabled = 'O'` is a catalog claim; this is behaviour.
--
-- Executed in its own transaction and rolled back, so it leaves nothing behind.
BEGIN;
INSERT INTO matrix_map.samples (
  id, bnrrm_station_id, station_id, display_name, latitude, longitude,
  geometry, coordinate_quality_tier, coordinate_source, classification, classification_source, source_dra_id, public
) VALUES (
  'e0000009-0000-4000-8000-000000000009', 90999, 'ELIG-STN-90999', 'ELIG Trigger Probe',
  500.0, -999.0,
  extensions.st_setsrid(extensions.st_makepoint(-123.25, 49.25), 4326)::extensions.geography,
  'medium', 'bc_csr_centroid', 'reference', 'station_type', NULL, false
);

SELECT 'ELIG_RESULT|ELIG_10|'
    || CASE
         WHEN round(latitude::numeric, 5) = 49.25000
          AND round(longitude::numeric, 5) = -123.25000
         THEN 'PASS' ELSE 'FAIL' END
    || '|supplied (500, -999) was stored as (' || latitude || ', ' || longitude
    || '); the restored trigger must overwrite it from the geometry (49.25, -123.25)'
FROM matrix_map.samples
WHERE id = 'e0000009-0000-4000-8000-000000000009';
ROLLBACK;
