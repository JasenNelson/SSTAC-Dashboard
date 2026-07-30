-- ============================================================================
-- F2 ELIG -- coordinate-eligibility fixture under the V6 section 13.2 custody
-- mechanism.
--
-- WHY THIS FILE EXISTS AT ALL. Invalid coordinates are NOT reachable by an
-- ordinary INSERT into matrix_map.samples:
--   * `geometry` is `geography(Point, 4326) NOT NULL`, so the "geometry IS NULL"
--     disjunct of samples_lng_lat_geometry_consistency is unreachable;
--   * `samples_populate_lng_lat_from_geometry` fires BEFORE INSERT OR UPDATE OF
--     geometry, longitude, latitude and OVERWRITES both columns from ST_X/ST_Y;
--   * `NOT VALID` suppresses only the initial full-table validation, never the
--     check for new rows.
-- So the eligibility predicate can only be exercised through a controlled,
-- minimal, transactional suspension -- which is what this file is.
--
-- EVERYTHING HERE RUNS IN ONE psql INVOCATION AND ONE TRANSACTION, and ends in
-- ROLLBACK. The seeded rows exist ONLY inside that uncommitted transaction, so
-- every assertion MUST execute on this same connection. An assertion made from
-- any other connection would run against an empty set and PASS VACUOUSLY -- a
-- green result proving nothing. That is why nothing here reaches for PostgREST
-- or opens a second session.
--
-- Results are emitted on STDOUT as `ELIG_RESULT|<id>|<PASS|FAIL>|<detail>` and
-- `ELIG_BASELINE|<key>|<value>` rather than written to public.test_results: the
-- ROLLBACK would erase any table the assertions wrote to, so a persisted result
-- is not available to this step even in principle.
--
-- The harness parses those lines. Any RAISE below aborts the whole invocation
-- under ON_ERROR_STOP, which the harness treats as a hard failure.
-- ============================================================================

\set ON_ERROR_STOP on

BEGIN;

-- ---------------------------------------------------------------------------
-- STEP 2 (V6 13.2.2) -- DATABASE IDENTITY, as the FIRST statement after BEGIN.
--
-- Implemented as a RAISING assertion, not a printed value (implementation-notes
-- 2.1): a guard whose only effect is output is not a guard, it is a log line,
-- and the surrounding script would continue happily past it.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF current_database() <> 'sstac_replay' THEN
    RAISE EXCEPTION 'ELIG custody: expected database sstac_replay, got %', current_database();
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- STEP 3 -- CAPTURE the trigger and constraint catalog definitions BEFORE any
-- suspension. Capturing them afterwards would be circular: the post-rollback
-- comparison would be against a baseline already contaminated by the change it
-- is supposed to detect.
--
-- CATALOG AMBIGUITY IS AN ABORT (V6 13.2.4): each lookup must resolve to
-- EXACTLY ONE object.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_trigger_count integer;
  v_constraint_count integer;
BEGIN
  SELECT count(*) INTO v_trigger_count
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'matrix_map'
    AND c.relname = 'samples'
    AND t.tgname = 'samples_populate_lng_lat_from_geometry';

  IF v_trigger_count <> 1 THEN
    RAISE EXCEPTION 'ELIG custody: expected exactly 1 trigger samples_populate_lng_lat_from_geometry, found %', v_trigger_count;
  END IF;

  SELECT count(*) INTO v_constraint_count
  FROM pg_constraint con
  JOIN pg_class c ON c.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'matrix_map'
    AND c.relname = 'samples'
    AND con.conname = 'samples_lng_lat_geometry_consistency';

  IF v_constraint_count <> 1 THEN
    RAISE EXCEPTION 'ELIG custody: expected exactly 1 constraint samples_lng_lat_geometry_consistency, found %', v_constraint_count;
  END IF;
END
$$;

-- `pg_trigger.tgenabled` is the internal `"char"` type, which has no unambiguous
-- `||` against an untyped literal. The cast is explicit for that reason, not
-- decorative.
SELECT 'ELIG_BASELINE|tgenabled|' || t.tgenabled::text
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'matrix_map'
  AND c.relname = 'samples'
  AND t.tgname = 'samples_populate_lng_lat_from_geometry';

SELECT 'ELIG_BASELINE|condef|' || pg_get_constraintdef(con.oid)
FROM pg_constraint con
JOIN pg_class c ON c.oid = con.conrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'matrix_map'
  AND c.relname = 'samples'
  AND con.conname = 'samples_lng_lat_geometry_consistency';

SELECT 'ELIG_BASELINE|convalidated|' || con.convalidated::text
FROM pg_constraint con
JOIN pg_class c ON c.oid = con.conrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'matrix_map'
  AND c.relname = 'samples'
  AND con.conname = 'samples_lng_lat_geometry_consistency';

-- ---------------------------------------------------------------------------
-- STEPS 4 and 5 -- THE MINIMAL SUSPENSION. Exactly one trigger, exactly one
-- constraint. Do not widen this: `DISABLE TRIGGER ALL` or dropping any other
-- constraint would suspend protections this fixture has no business touching.
--
-- Both are transactional DDL, so the ROLLBACK at the end restores them. Do NOT
-- re-ENABLE or re-ADD by hand -- re-adding risks different bytes or a different
-- validation state than the originals.
-- ---------------------------------------------------------------------------
ALTER TABLE matrix_map.samples DISABLE TRIGGER samples_populate_lng_lat_from_geometry;
ALTER TABLE matrix_map.samples DROP CONSTRAINT samples_lng_lat_geometry_consistency;

-- ---------------------------------------------------------------------------
-- STEP 6 -- SEED. Every row carries VALID geometry (it is NOT NULL and PostGIS
-- validates it) together with deliberately INVALID longitude/latitude column
-- values, which the trigger would otherwise have overwritten from the geometry.
--
-- Three DRAs, each isolating one question:
--   e11...  ONLY ineligible rows            -> must produce NO preview row
--   e22...  one eligible medium + ineligible siblings
--                                           -> exactly ONE row, counting ONLY
--                                              the eligible sample
--   e33...  the in-range BOUNDARY values    -> must be INCLUDED
-- ---------------------------------------------------------------------------
INSERT INTO matrix_map.dras (id, title, citation, public, is_deleted) VALUES
  ('e1111111-1111-4111-8111-111111111111', 'ELIG Ineligible Only', 'ELIG a', false, false),
  ('e2222222-2222-4222-8222-222222222222', 'ELIG Mixed Siblings',  'ELIG b', false, false),
  ('e3333333-3333-4333-8333-333333333333', 'ELIG Boundary Values', 'ELIG c', false, false)
ON CONFLICT (id) DO NOTHING;

-- DRA e1 -- one row per required ineligible case, and nothing else.
INSERT INTO matrix_map.samples (
  id, bnrrm_station_id, station_id, display_name, latitude, longitude,
  geometry, coordinate_quality_tier, coordinate_source, classification, classification_source, source_dra_id, public
)
SELECT
  g.id::uuid, g.stn, 'ELIG-STN-' || g.stn, 'ELIG Station ' || g.stn,
  g.lat, g.lng,
  -- A deliberately ORDINARY, valid geography for every row. The geometry is not
  -- what is under test; the lat/lng COLUMNS are.
  extensions.st_setsrid(extensions.st_makepoint(-123.0, 49.0), 4326)::extensions.geography,
  'medium', 'bc_csr_centroid', 'reference', 'station_type',
  'e1111111-1111-4111-8111-111111111111', false
FROM (VALUES
  ('e0000001-0000-4000-8000-000000000001', 90001, NULL::double precision, -123.0::double precision),
  ('e0000001-0000-4000-8000-000000000002', 90002, 49.0, NULL::double precision),
  ('e0000001-0000-4000-8000-000000000003', 90003, 'NaN'::double precision, -123.0),
  ('e0000001-0000-4000-8000-000000000004', 90004, 49.0, 'NaN'::double precision),
  ('e0000001-0000-4000-8000-000000000005', 90005, 'Infinity'::double precision, -123.0),
  ('e0000001-0000-4000-8000-000000000006', 90006, '-Infinity'::double precision, -123.0),
  ('e0000001-0000-4000-8000-000000000007', 90007, 49.0, 'Infinity'::double precision),
  ('e0000001-0000-4000-8000-000000000008', 90008, 49.0, '-Infinity'::double precision),
  ('e0000001-0000-4000-8000-000000000009', 90009, 90.00001, -123.0),
  ('e0000001-0000-4000-8000-000000000010', 90010, -90.00001, -123.0),
  ('e0000001-0000-4000-8000-000000000011', 90011, 49.0, 180.00001),
  ('e0000001-0000-4000-8000-000000000012', 90012, 49.0, -180.00001),
  -- The exact value the TypeScript display-side helper would ACCEPT:
  -- `hasUsableCoordinate` checks Number.isFinite with no range check. SQL is
  -- stricter and SQL is the authority.
  ('e0000001-0000-4000-8000-000000000013', 90013, 500.0, -123.0)
) AS g(id, stn, lat, lng);

-- DRA e2 -- ONE eligible medium sample plus ineligible siblings at what would
-- be the same cluster. The eligible sample must still form its cluster, and the
-- siblings must contribute nothing to any count.
INSERT INTO matrix_map.samples (
  id, bnrrm_station_id, station_id, display_name, latitude, longitude,
  geometry, coordinate_quality_tier, coordinate_source, classification, classification_source, source_dra_id, public
)
SELECT
  g.id::uuid, g.stn, 'ELIG-STN-' || g.stn, 'ELIG Station ' || g.stn,
  g.lat, g.lng,
  extensions.st_setsrid(extensions.st_makepoint(-123.0, 49.0), 4326)::extensions.geography,
  'medium', 'bc_csr_centroid', 'reference', 'station_type',
  'e2222222-2222-4222-8222-222222222222', false
FROM (VALUES
  ('e0000002-0000-4000-8000-000000000001', 90101, 47.12345::double precision, -121.12345::double precision),
  ('e0000002-0000-4000-8000-000000000002', 90102, 'NaN'::double precision, -121.12345),
  ('e0000002-0000-4000-8000-000000000003', 90103, 500.0, -121.12345),
  ('e0000002-0000-4000-8000-000000000004', 90104, NULL::double precision, -121.12345)
) AS g(id, stn, lat, lng);

-- DRA e3 -- the in-range BOUNDARY values, which MUST be included.
INSERT INTO matrix_map.samples (
  id, bnrrm_station_id, station_id, display_name, latitude, longitude,
  geometry, coordinate_quality_tier, coordinate_source, classification, classification_source, source_dra_id, public
)
SELECT
  g.id::uuid, g.stn, 'ELIG-STN-' || g.stn, 'ELIG Station ' || g.stn,
  g.lat, g.lng,
  extensions.st_setsrid(extensions.st_makepoint(-123.0, 49.0), 4326)::extensions.geography,
  'medium', 'bc_csr_centroid', 'reference', 'station_type',
  'e3333333-3333-4333-8333-333333333333', false
FROM (VALUES
  ('e0000003-0000-4000-8000-000000000001', 90201, -90.0::double precision, -180.0::double precision),
  ('e0000003-0000-4000-8000-000000000002', 90202, 90.0::double precision, 180.0::double precision)
) AS g(id, stn, lat, lng);

-- DRA e4 -- THE ROUNDING COLLISION. One ELIGIBLE row exactly on the boundary
-- and one INELIGIBLE row just outside it that ROUNDS onto the same canonical
-- key. This is the population that proves current_site_aggregate_snapshot
-- shares the preview's eligibility predicate (see ELIG_11A..C below).
INSERT INTO matrix_map.dras (id, title, citation, public, is_deleted) VALUES
  ('e4444444-4444-4444-8444-444444444444', 'ELIG Rounding Collision', 'ELIG d', false, false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO matrix_map.samples (
  id, bnrrm_station_id, station_id, display_name, latitude, longitude,
  geometry, coordinate_quality_tier, coordinate_source, classification, classification_source, source_dra_id, public
)
SELECT
  g.id::uuid, g.stn, 'ELIG-STN-' || g.stn, 'ELIG Station ' || g.stn,
  g.lat, g.lng,
  extensions.st_setsrid(extensions.st_makepoint(-123.0, 49.0), 4326)::extensions.geography,
  'medium', 'bc_csr_centroid', 'reference', 'station_type',
  'e4444444-4444-4444-8444-444444444444', false
FROM (VALUES
  -- ELIGIBLE: the exact boundary, which MUST be included.
  ('e0000004-0000-4000-8000-000000000001', 90301,  90.0::double precision,  180.0::double precision),
  -- INELIGIBLE: just outside, but round(180.000001, 5) = 180.00000, so it renders
  -- to the SAME canonical key as the row above.
  ('e0000004-0000-4000-8000-000000000002', 90302,  90.0::double precision,  180.000001::double precision)
) AS g(id, stn, lat, lng);

-- ---------------------------------------------------------------------------
-- STEP 7 -- ASSERT, on THIS connection, inside THIS transaction.
-- ---------------------------------------------------------------------------
SELECT set_config('request.jwt.claims',
  '{"sub":"11111111-1111-1111-1111-111111111111","email":"admin@example.com"}', true);

-- ELIG_01 -- the seed actually landed. Without this, every "absent" assertion
-- below would pass vacuously against a transaction that inserted nothing.
SELECT 'ELIG_RESULT|ELIG_01|'
    || CASE WHEN count(*) = 21 THEN 'PASS' ELSE 'FAIL' END
    || '|seeded ' || count(*) || ' rows across 4 ELIG DRAs (expected 21)'
FROM matrix_map.samples
WHERE source_dra_id IN (
  'e1111111-1111-4111-8111-111111111111',
  'e2222222-2222-4222-8222-222222222222',
  'e3333333-3333-4333-8333-333333333333',
  'e4444444-4444-4444-8444-444444444444'
);

-- ELIG_02 -- a DRA of ONLY ineligible rows produces NO preview row at all.
SELECT 'ELIG_RESULT|ELIG_02|'
    || CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END
    || '|ineligible-only DRA produced ' || count(*) || ' preview rows (expected 0)'
FROM matrix_map.fetch_admin_site_aggregate_live_preview(NULL, NULL, 1000) r
WHERE r.source_dra_id = 'e1111111-1111-4111-8111-111111111111';

-- ELIG_03 -- an ineligible sample does NOT suppress the cluster its eligible
-- sibling forms, and contributes to NO count: exactly one row, totals of 1.
SELECT 'ELIG_RESULT|ELIG_03|'
    || CASE
         WHEN count(*) = 1
          AND max(r.lifecycle_sample_count_total) = 1
          AND max(r.preview_sample_count_total) = 1
          AND max(r.lifecycle_distinct_point_count) = 1
         THEN 'PASS' ELSE 'FAIL' END
    || '|rows=' || count(*)
    || ' lifecycle_total=' || coalesce(max(r.lifecycle_sample_count_total), -1)
    || ' preview_total=' || coalesce(max(r.preview_sample_count_total), -1)
    || ' (expected 1/1/1)'
FROM matrix_map.fetch_admin_site_aggregate_live_preview(NULL, NULL, 1000) r
WHERE r.source_dra_id = 'e2222222-2222-4222-8222-222222222222';

-- ELIG_04 -- the in-range BOUNDARY values are INCLUDED, not excluded.
SELECT 'ELIG_RESULT|ELIG_04|'
    || CASE WHEN count(*) = 2 THEN 'PASS' ELSE 'FAIL' END
    || '|boundary DRA produced ' || count(*) || ' preview rows (expected 2: -90/-180 and 90/180)'
FROM matrix_map.fetch_admin_site_aggregate_live_preview(NULL, NULL, 1000) r
WHERE r.source_dra_id = 'e3333333-3333-4333-8333-333333333333';

-- ELIG_05 -- and they are the EXACT boundary clusters, not some rounded
-- neighbour. A count alone would not catch a value silently clamped into range.
SELECT 'ELIG_RESULT|ELIG_05|'
    || CASE WHEN count(*) = 2 THEN 'PASS' ELSE 'FAIL' END
    || '|boundary clusters found: ' || coalesce(string_agg(r.canonical_cluster_id, ' + ' ORDER BY r.canonical_cluster_id COLLATE "C"), '(none)')
FROM matrix_map.fetch_admin_site_aggregate_live_preview(NULL, NULL, 1000) r
WHERE r.source_dra_id = 'e3333333-3333-4333-8333-333333333333'
  AND r.canonical_cluster_id IN ('-90.00000,-180.00000', '90.00000,180.00000');

-- ELIG_06 -- NO preview row anywhere carries a non-finite or out-of-range
-- representative coordinate. This is the whole-relation form of the predicate,
-- not just the ELIG fixture's own DRAs.
SELECT 'ELIG_RESULT|ELIG_06|'
    || CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END
    || '|preview rows with an ineligible representative pair: ' || count(*) || ' (expected 0)'
FROM matrix_map.fetch_admin_site_aggregate_live_preview(NULL, NULL, 1000) r
WHERE r.lifecycle_representative_latitude IS NULL
   OR r.lifecycle_representative_longitude IS NULL
   OR r.lifecycle_representative_latitude = 'NaN'::double precision
   OR r.lifecycle_representative_longitude = 'NaN'::double precision
   OR r.lifecycle_representative_latitude NOT BETWEEN -90 AND 90
   OR r.lifecycle_representative_longitude NOT BETWEEN -180 AND 180;

-- ELIG_11 -- current_site_aggregate_snapshot applies the SAME eligibility
-- predicate as the live preview, on the ONE population where it matters.
--
-- WHY THIS BELONGS HERE. The snapshot decides what the upsert PERSISTS. It used
-- to select cluster members by DRA plus canonical key alone, and rounding carries
-- a just-out-of-range row onto an in-range key -- longitude 180.000001 renders to
-- '180.00000', exactly what an eligible 180.0 row renders to. So the preview
-- excluded that row while the snapshot still counted it, and the operator
-- approved counts that were not the ones persisted.
--
-- A review pointed out that the fix had NO test: ELIG_03 only queries the preview
-- RPC, so deleting the snapshot's new predicate would leave all 84 suite
-- assertions and every other ELIG assertion green while restoring the exact
-- divergence. This is the only place the test can live, because an ineligible
-- coordinate is unreachable outside this suspended transaction.
--
-- DRA e4 holds one ELIGIBLE medium row at (90, 180) and one INELIGIBLE medium row
-- at (90, 180.000001). Both render to the same canonical key. The snapshot must
-- count ONE. The rows themselves are seeded in STEP 6 with the other fixtures,
-- so ELIG_01's total covers them.

-- Both rows really do collide on the key -- otherwise the assertion below would
-- pass for the wrong reason.
SELECT 'ELIG_RESULT|ELIG_11A|'
    || CASE WHEN count(*) = 2 THEN 'PASS' ELSE 'FAIL' END
    || '|rows rendering to the boundary key 90.00000,180.00000: ' || count(*)
    || ' (expected 2 -- one eligible, one just-out-of-range, so the collision is real)'
FROM matrix_map.samples s
WHERE s.source_dra_id = 'e4444444-4444-4444-8444-444444444444'
  AND matrix_map.canonical_five_decimal_cluster(s.latitude, s.longitude) = '90.00000,180.00000';

-- ...and the snapshot counts only the ELIGIBLE one.
SELECT 'ELIG_RESULT|ELIG_11B|'
    || CASE WHEN coalesce(max(snap.sample_count_total), -1) = 1
              AND coalesce(max(snap.sample_count_medium), -1) = 1
            THEN 'PASS' ELSE 'FAIL' END
    || '|current_site_aggregate_snapshot total=' || coalesce(max(snap.sample_count_total), -1)
    || ' medium=' || coalesce(max(snap.sample_count_medium), -1)
    || ' (expected 1 and 1 -- the just-out-of-range row must NOT be counted even though it renders to this key)'
FROM matrix_map.current_site_aggregate_snapshot(
  'e4444444-4444-4444-8444-444444444444', '90.00000,180.00000') snap;

-- AND the preview agrees with it, which is the write-preview contract itself.
SELECT 'ELIG_RESULT|ELIG_11C|'
    || CASE WHEN count(*) = 1 AND coalesce(max(r.lifecycle_sample_count_total), -1) = 1
            THEN 'PASS' ELSE 'FAIL' END
    || '|preview rows=' || count(*)
    || ' lifecycle_total=' || coalesce(max(r.lifecycle_sample_count_total), -1)
    || ' (expected 1 and 1, matching the snapshot exactly)'
FROM matrix_map.fetch_admin_site_aggregate_live_preview(NULL, NULL, 1000) r
WHERE r.source_dra_id = 'e4444444-4444-4444-8444-444444444444';

-- ELIG_07 -- the PREDICTIONS V6 section 7.2 asks to pin, measured rather than
-- assumed: PostgreSQL defines NaN = NaN as TRUE for floats (so the `x = x`
-- idiom does NOT detect NaN), and BETWEEN alone excludes NaN and both
-- infinities because NaN sorts above every non-NaN value.
SELECT 'ELIG_RESULT|ELIG_07|'
    || CASE
         WHEN ('NaN'::double precision = 'NaN'::double precision)
          AND NOT ('NaN'::double precision BETWEEN -90 AND 90)
          AND NOT ('Infinity'::double precision BETWEEN -90 AND 90)
          AND NOT ('-Infinity'::double precision BETWEEN -90 AND 90)
          AND (90.0::double precision BETWEEN -90 AND 90)
          AND (-90.0::double precision BETWEEN -90 AND 90)
         THEN 'PASS' ELSE 'FAIL' END
    || '|NaN=NaN is ' || ('NaN'::double precision = 'NaN'::double precision)::text
    || '; NaN BETWEEN is ' || ('NaN'::double precision BETWEEN -90 AND 90)::text
    || '; Infinity BETWEEN is ' || ('Infinity'::double precision BETWEEN -90 AND 90)::text;

-- ---------------------------------------------------------------------------
-- STEP 8 -- ROLLBACK. The trigger, the constraint and the seeded rows all go
-- away together, because DISABLE TRIGGER and DROP CONSTRAINT are transactional.
-- Section 13.2.3 proves that from a NEW connection rather than trusting it.
-- ---------------------------------------------------------------------------
ROLLBACK;
