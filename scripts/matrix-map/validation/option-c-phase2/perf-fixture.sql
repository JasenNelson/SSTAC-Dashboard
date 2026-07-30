-- ORCHESTRATOR CORRECTION 2 (not AGY's): `to_char(n, 'FM02')` replaced with
-- `lpad(n::text, 2, '0')`. In a numeric template '0' is ONE digit position and
-- '2' is a literal character, so to_char(40, 'FM02') yields '#2' -- an overflow
-- marker -- and the generated uuid failed to parse. Caught by EXECUTION; the
-- AGY closeout had claimed compliance.
--
-- ORCHESTRATOR CORRECTION (not AGY's): the DRAs are created with
-- public = false. AGY emitted `true AS public`. Every existing fixture DRA is
-- false, and a performance/pagination fixture has no business flipping member
-- visibility -- `dras.public` gates the member RLS path. The admin preview is
-- SECURITY DEFINER and reads the same rows either way, so this changes nothing
-- the fixture is measuring and removes a privilege it never needed.
--
-- PERFORMANCE FIXTURE GENERATOR (perf-fixture.sql)
--
-- Purpose:
-- Builds a 502,000 sample row dataset across 42 DRAs (40 non-deleted, 2 deleted)
-- to test preview and full-lifecycle performance in matrix_map.
--
-- Arithmetic Breakdown:
-- 1. Non-deleted DRAs:
--    - DRAs 01 to 20: 700 clusters per DRA.
--      * 125 preview-eligible clusters of size 50 (28 medium, 15 high, 7 low)
--      * 550 preview-eligible clusters of size 10 (6 medium, 3 high, 1 low)
--      * 25 lifecycle-only clusters of size 100 (0 medium, 70 high, 30 low)
--      * Samples per DRA = 125*50 + 550*10 + 25*100 = 6250 + 5500 + 2500 = 14,250
--      * Subtotal = 20 * 14,250 = 285,000 samples.
--    - DRAs 21 to 40: 575 clusters per DRA.
--      * 125 preview-eligible clusters of size 50 (28 medium, 15 high, 7 low)
--      * 450 preview-eligible clusters of size 10 (6 medium, 3 high, 1 low)
--      * Samples per DRA = 125*50 + 450*10 = 6250 + 4500 = 10,750
--      * Subtotal = 20 * 10,750 = 215,000 samples.
--    - Total non-deleted samples = 285,000 + 215,000 = 500,000.
--    - Total non-deleted clusters = 20*700 + 20*575 = 14,000 + 11,500 = 25,500.
--    - Preview-eligible clusters = 20*675 + 20*575 = 13,500 + 11,500 = 25,000.
--    - Lifecycle-only clusters = 20*25 = 500.
--    - Quality Tiers in non-deleted DRAs:
--      * Medium: 5,000*28 + 20,000*6 + 500*0 = 140,000 + 120,000 = 260,000.
--      * High: 5,000*15 + 20,000*3 + 500*70 = 75,000 + 60,000 + 35,000 = 170,000.
--      * Low: 5,000*7 + 20,000*1 + 500*30 = 35,000 + 20,000 + 15,000 = 70,000.
--
-- 2. Deleted DRAs:
--    - DRAs 01 to 02 (marked is_deleted = true):
--      * 100 clusters per DRA of size 10 (6 medium, 3 high, 1 low).
--      * Samples per DRA = 100*10 = 1,000.
--      * Subtotal = 2 * 1,000 = 2,000 samples.
--
-- Grand total samples = 500,000 + 2,000 = 502,000 samples.

INSERT INTO matrix_map.dras (id, title, citation, public, is_deleted)
SELECT
  ('c0000000-0000-4000-8000-0000000000' || lpad(i::text, 2, '0'))::uuid AS id,
  'PERF DRA ' || lpad(i::text, 2, '0') AS title,
  'Citation PERF ' || lpad(i::text, 2, '0') AS citation,
  false AS public,
  false AS is_deleted
FROM generate_series(1, 40) AS i
ON CONFLICT (id) DO NOTHING;

INSERT INTO matrix_map.dras (id, title, citation, public, is_deleted)
SELECT
  ('c0000000-0000-4000-8000-0000000009' || lpad(i::text, 2, '0'))::uuid AS id,
  'PERF Deleted DRA ' || lpad(i::text, 2, '0') AS title,
  'Citation PERF Deleted ' || lpad(i::text, 2, '0') AS citation,
  false AS public,
  true AS is_deleted
FROM generate_series(1, 2) AS i
ON CONFLICT (id) DO NOTHING;

WITH clusters AS (
  -- Non-deleted DRAs 1..20 (700 clusters: 0..124 size 50, 125..674 size 10, 675..699 size 100)
  SELECT
    d AS dra_num,
    false AS is_del,
    ('c0000000-0000-4000-8000-0000000000' || lpad(d::text, 2, '0'))::uuid AS source_dra_id,
    c,
    CASE
      WHEN c < 125 THEN 50
      WHEN c < 675 THEN 10
      ELSE 100
    END AS cluster_size,
    CASE
      WHEN c < 125 THEN 'preview_50'
      WHEN c < 675 THEN 'preview_10'
      ELSE 'lifecycle_100'
    END AS cluster_kind
  FROM generate_series(1, 20) d
  CROSS JOIN generate_series(0, 699) c

  UNION ALL

  -- Non-deleted DRAs 21..40 (575 clusters: 0..124 size 50, 125..574 size 10)
  SELECT
    d AS dra_num,
    false AS is_del,
    ('c0000000-0000-4000-8000-0000000000' || lpad(d::text, 2, '0'))::uuid AS source_dra_id,
    c,
    CASE
      WHEN c < 125 THEN 50
      ELSE 10
    END AS cluster_size,
    CASE
      WHEN c < 125 THEN 'preview_50'
      ELSE 'preview_10'
    END AS cluster_kind
  FROM generate_series(21, 40) d
  CROSS JOIN generate_series(0, 574) c

  UNION ALL

  -- Deleted DRAs 1..2 (100 clusters: 0..99 size 10)
  SELECT
    d + 100 AS dra_num,
    true AS is_del,
    ('c0000000-0000-4000-8000-0000000009' || lpad(d::text, 2, '0'))::uuid AS source_dra_id,
    c,
    10 AS cluster_size,
    'deleted_10' AS cluster_kind
  FROM generate_series(1, 2) d
  CROSS JOIN generate_series(0, 99) c
),
samples_raw AS (
  SELECT
    cl.source_dra_id,
    cl.is_del,
    cl.c,
    s.s,
    (40.0 + cl.c * 0.00001) AS lat,
    -120.0 AS lng,
    CASE cl.cluster_kind
      WHEN 'preview_50' THEN
        CASE WHEN s.s <= 28 THEN 'medium' WHEN s.s <= 43 THEN 'high' ELSE 'low' END
      WHEN 'preview_10' THEN
        CASE WHEN s.s <= 6 THEN 'medium' WHEN s.s <= 9 THEN 'high' ELSE 'low' END
      WHEN 'deleted_10' THEN
        CASE WHEN s.s <= 6 THEN 'medium' WHEN s.s <= 9 THEN 'high' ELSE 'low' END
      WHEN 'lifecycle_100' THEN
        CASE WHEN s.s <= 70 THEN 'high' ELSE 'low' END
    END AS tier,
    ROW_NUMBER() OVER (ORDER BY cl.source_dra_id, cl.c, s.s) AS seq
  FROM clusters cl
  CROSS JOIN LATERAL generate_series(1, cl.cluster_size) AS s(s)
)
INSERT INTO matrix_map.samples (
  id,
  bnrrm_station_id,
  station_id,
  display_name,
  latitude,
  longitude,
  geometry,
  coordinate_quality_tier,
  coordinate_source,
  classification,
  classification_source,
  source_dra_id,
  public
)
SELECT
  (md5('perf-sample-' || (10000000 + seq)))::uuid AS id,
  (10000000 + seq)::integer AS bnrrm_station_id,
  'PERF-STN-' || (10000000 + seq) AS station_id,
  'Perf Station ' || (10000000 + seq) AS display_name,
  lat AS latitude,
  lng AS longitude,
  extensions.st_setsrid(extensions.st_makepoint(lng, lat), 4326)::extensions.geography AS geometry,
  tier AS coordinate_quality_tier,
  'bc_csr_centroid' AS coordinate_source,
  'reference' AS classification,
  'station_type' AS classification_source,
  source_dra_id,
  false AS public
FROM samples_raw
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE
  v_total_samples bigint;
  v_non_del_samples bigint;
  v_del_samples bigint;
  v_medium_samples bigint;
  v_high_samples bigint;
  v_low_samples bigint;
  v_total_groups bigint;
  v_medium_groups bigint;
BEGIN
  -- 1. Total sample rows across the 42 fixture DRAs
  SELECT COUNT(*) INTO v_total_samples
  FROM matrix_map.samples s
  JOIN matrix_map.dras d ON s.source_dra_id = d.id
  WHERE d.id::text LIKE 'c0000000-0000-4000-8000-000000000%';

  IF v_total_samples <> 502000 THEN
    RAISE EXCEPTION 'perf-fixture check failed: total sample rows expected 502000, got %', v_total_samples;
  END IF;

  -- 2. Sample rows in the 40 non-deleted DRAs
  SELECT COUNT(*) INTO v_non_del_samples
  FROM matrix_map.samples s
  JOIN matrix_map.dras d ON s.source_dra_id = d.id
  WHERE d.id::text LIKE 'c0000000-0000-4000-8000-0000000000%' AND d.is_deleted = false;

  IF v_non_del_samples <> 500000 THEN
    RAISE EXCEPTION 'perf-fixture check failed: non-deleted sample rows expected 500000, got %', v_non_del_samples;
  END IF;

  -- 3. Sample rows in the 2 deleted DRAs
  SELECT COUNT(*) INTO v_del_samples
  FROM matrix_map.samples s
  JOIN matrix_map.dras d ON s.source_dra_id = d.id
  WHERE d.id::text LIKE 'c0000000-0000-4000-8000-0000000009%' AND d.is_deleted = true;

  IF v_del_samples <> 2000 THEN
    RAISE EXCEPTION 'perf-fixture check failed: deleted sample rows expected 2000, got %', v_del_samples;
  END IF;

  -- 4. Medium samples in non-deleted DRAs
  SELECT COUNT(*) INTO v_medium_samples
  FROM matrix_map.samples s
  JOIN matrix_map.dras d ON s.source_dra_id = d.id
  WHERE d.id::text LIKE 'c0000000-0000-4000-8000-0000000000%' AND d.is_deleted = false
    AND s.coordinate_quality_tier = 'medium';

  IF v_medium_samples <> 260000 THEN
    RAISE EXCEPTION 'perf-fixture check failed: medium samples expected 260000, got %', v_medium_samples;
  END IF;

  -- 5. High samples in non-deleted DRAs
  SELECT COUNT(*) INTO v_high_samples
  FROM matrix_map.samples s
  JOIN matrix_map.dras d ON s.source_dra_id = d.id
  WHERE d.id::text LIKE 'c0000000-0000-4000-8000-0000000000%' AND d.is_deleted = false
    AND s.coordinate_quality_tier = 'high';

  IF v_high_samples <> 170000 THEN
    RAISE EXCEPTION 'perf-fixture check failed: high samples expected 170000, got %', v_high_samples;
  END IF;

  -- 6. Low samples in non-deleted DRAs
  SELECT COUNT(*) INTO v_low_samples
  FROM matrix_map.samples s
  JOIN matrix_map.dras d ON s.source_dra_id = d.id
  WHERE d.id::text LIKE 'c0000000-0000-4000-8000-0000000000%' AND d.is_deleted = false
    AND s.coordinate_quality_tier = 'low';

  IF v_low_samples <> 70000 THEN
    RAISE EXCEPTION 'perf-fixture check failed: low samples expected 70000, got %', v_low_samples;
  END IF;

  -- 7. Distinct (source_dra_id, round(latitude::numeric,5), round(longitude::numeric,5)) groups in non-deleted DRAs
  SELECT COUNT(*) INTO v_total_groups
  FROM (
    SELECT s.source_dra_id, ROUND(s.latitude::numeric, 5), ROUND(s.longitude::numeric, 5)
    FROM matrix_map.samples s
    JOIN matrix_map.dras d ON s.source_dra_id = d.id
    WHERE d.id::text LIKE 'c0000000-0000-4000-8000-0000000000%' AND d.is_deleted = false
    GROUP BY s.source_dra_id, ROUND(s.latitude::numeric, 5), ROUND(s.longitude::numeric, 5)
  ) g;

  IF v_total_groups <> 25500 THEN
    RAISE EXCEPTION 'perf-fixture check failed: total groups expected 25500, got %', v_total_groups;
  END IF;

  -- 8. Groups having at least one medium sample in non-deleted DRAs
  SELECT COUNT(*) INTO v_medium_groups
  FROM (
    SELECT s.source_dra_id, ROUND(s.latitude::numeric, 5), ROUND(s.longitude::numeric, 5)
    FROM matrix_map.samples s
    JOIN matrix_map.dras d ON s.source_dra_id = d.id
    WHERE d.id::text LIKE 'c0000000-0000-4000-8000-0000000000%' AND d.is_deleted = false
      AND s.coordinate_quality_tier = 'medium'
    GROUP BY s.source_dra_id, ROUND(s.latitude::numeric, 5), ROUND(s.longitude::numeric, 5)
  ) g;

  IF v_medium_groups <> 25000 THEN
    RAISE EXCEPTION 'perf-fixture check failed: medium groups expected 25000, got %', v_medium_groups;
  END IF;

END $$;
