-- ORCHESTRATOR CORRECTION (not AGY's): the DRAs are created with
-- public = false. AGY emitted them public. Every existing fixture DRA is
-- false, and a pagination fixture has no business flipping member visibility --
-- `dras.public` gates the member RLS path. The admin preview is SECURITY
-- DEFINER and reads the same rows either way, so this changes nothing the
-- fixture is measuring and removes a privilege it never needed.
--
-- PAGINATION FIXTURE GENERATOR (page-fixture.sql)
--
-- Purpose:
-- Builds a 197 sample row dataset across 3 non-deleted DRAs prefixed with 'f'
-- to test pagination traversal independently of existing lower-digit fixture rows.
--
-- Arithmetic Breakdown:
-- 1. DRAs:
--    - DRA-A (f1111111-1111-4111-8111-111111111111):
--      * 19 preview-eligible clusters of size 4 (2 medium, 1 high, 1 low) = 76 samples
--      * 1 lifecycle-only cluster (index 19) of size 3 (0 medium, 2 high, 1 low) = 3 samples
--      * Total = 79 samples across 20 clusters.
--    - DRA-B (f2222222-2222-4222-8222-222222222222):
--      * 14 preview-eligible clusters of size 4 (2 medium, 1 high, 1 low) = 56 samples
--      * 1 lifecycle-only cluster (index 14) of size 3 (0 medium, 2 high, 1 low) = 3 samples
--      * Total = 59 samples across 15 clusters.
--    - DRA-C (f3333333-3333-4333-8333-333333333333):
--      * 14 preview-eligible clusters of size 4 (2 medium, 1 high, 1 low) = 56 samples
--      * 1 lifecycle-only cluster (index 14) of size 3 (0 medium, 2 high, 1 low) = 3 samples
--      * Total = 59 samples across 15 clusters.
--
-- 2. Totals:
--    - Total DRAs = 3.
--    - Total clusters = 20 + 15 + 15 = 50.
--    - Preview-eligible clusters = 19 + 14 + 14 = 47.
--    - Lifecycle-only clusters = 3.
--    - Total samples = 47*4 + 3*3 = 188 + 9 = 197 samples.
--    - Quality Tiers:
--      * Medium: 47 * 2 = 94.
--      * High: 47 * 1 + 3 * 2 = 53.
--      * Low: 47 * 1 + 3 * 1 = 50.

INSERT INTO matrix_map.dras (id, title, citation, public, is_deleted)
VALUES
  ('f1111111-1111-4111-8111-111111111111', 'PAGE DRA A', 'Citation PAGE A', false, false),
  ('f2222222-2222-4222-8222-222222222222', 'PAGE DRA B', 'Citation PAGE B', false, false),
  ('f3333333-3333-4333-8333-333333333333', 'PAGE DRA C', 'Citation PAGE C', false, false)
ON CONFLICT (id) DO NOTHING;

WITH clusters AS (
  -- DRA-A (20 clusters: 0..18 preview, 19 lifecycle)
  SELECT
    'f1111111-1111-4111-8111-111111111111'::uuid AS source_dra_id,
    c,
    CASE WHEN c = 19 THEN 3 ELSE 4 END AS cluster_size,
    CASE WHEN c = 19 THEN 'lifecycle' ELSE 'preview' END AS cluster_kind
  FROM generate_series(0, 19) c

  UNION ALL

  -- DRA-B (15 clusters: 0..13 preview, 14 lifecycle)
  SELECT
    'f2222222-2222-4222-8222-222222222222'::uuid AS source_dra_id,
    c,
    CASE WHEN c = 14 THEN 3 ELSE 4 END AS cluster_size,
    CASE WHEN c = 14 THEN 'lifecycle' ELSE 'preview' END AS cluster_kind
  FROM generate_series(0, 14) c

  UNION ALL

  -- DRA-C (15 clusters: 0..13 preview, 14 lifecycle)
  SELECT
    'f3333333-3333-4333-8333-333333333333'::uuid AS source_dra_id,
    c,
    CASE WHEN c = 14 THEN 3 ELSE 4 END AS cluster_size,
    CASE WHEN c = 14 THEN 'lifecycle' ELSE 'preview' END AS cluster_kind
  FROM generate_series(0, 14) c
),
samples_raw AS (
  SELECT
    cl.source_dra_id,
    cl.c,
    s.s,
    (41.0 + cl.c * 0.00001) AS lat,
    -121.0 AS lng,
    CASE cl.cluster_kind
      WHEN 'preview' THEN
        CASE WHEN s.s <= 2 THEN 'medium' WHEN s.s = 3 THEN 'high' ELSE 'low' END
      WHEN 'lifecycle' THEN
        CASE WHEN s.s <= 2 THEN 'high' ELSE 'low' END
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
  (md5('page-sample-' || (19000000 + seq)))::uuid AS id,
  (19000000 + seq)::integer AS bnrrm_station_id,
  'PAGE-STN-' || (19000000 + seq) AS station_id,
  'Page Station ' || (19000000 + seq) AS display_name,
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
  v_total_groups bigint;
  v_medium_groups bigint;
  v_medium_samples bigint;
  v_high_samples bigint;
  v_low_samples bigint;
BEGIN
  -- 1. Total sample rows across the 3 PAGE DRAs
  SELECT COUNT(*) INTO v_total_samples
  FROM matrix_map.samples s
  WHERE s.source_dra_id IN (
    'f1111111-1111-4111-8111-111111111111'::uuid,
    'f2222222-2222-4222-8222-222222222222'::uuid,
    'f3333333-3333-4333-8333-333333333333'::uuid
  );

  IF v_total_samples <> 197 THEN
    RAISE EXCEPTION 'page-fixture check failed: total sample rows expected 197, got %', v_total_samples;
  END IF;

  -- 2. Distinct (source_dra_id, rounded coordinate) groups
  SELECT COUNT(*) INTO v_total_groups
  FROM (
    SELECT s.source_dra_id, ROUND(s.latitude::numeric, 5), ROUND(s.longitude::numeric, 5)
    FROM matrix_map.samples s
    WHERE s.source_dra_id IN (
      'f1111111-1111-4111-8111-111111111111'::uuid,
      'f2222222-2222-4222-8222-222222222222'::uuid,
      'f3333333-3333-4333-8333-333333333333'::uuid
    )
    GROUP BY s.source_dra_id, ROUND(s.latitude::numeric, 5), ROUND(s.longitude::numeric, 5)
  ) g;

  IF v_total_groups <> 50 THEN
    RAISE EXCEPTION 'page-fixture check failed: total groups expected 50, got %', v_total_groups;
  END IF;

  -- 3. Groups with at least one medium sample
  SELECT COUNT(*) INTO v_medium_groups
  FROM (
    SELECT s.source_dra_id, ROUND(s.latitude::numeric, 5), ROUND(s.longitude::numeric, 5)
    FROM matrix_map.samples s
    WHERE s.source_dra_id IN (
      'f1111111-1111-4111-8111-111111111111'::uuid,
      'f2222222-2222-4222-8222-222222222222'::uuid,
      'f3333333-3333-4333-8333-333333333333'::uuid
    ) AND s.coordinate_quality_tier = 'medium'
    GROUP BY s.source_dra_id, ROUND(s.latitude::numeric, 5), ROUND(s.longitude::numeric, 5)
  ) g;

  IF v_medium_groups <> 47 THEN
    RAISE EXCEPTION 'page-fixture check failed: medium groups expected 47, got %', v_medium_groups;
  END IF;

  -- 4. Medium samples
  SELECT COUNT(*) INTO v_medium_samples
  FROM matrix_map.samples s
  WHERE s.source_dra_id IN (
    'f1111111-1111-4111-8111-111111111111'::uuid,
    'f2222222-2222-4222-8222-222222222222'::uuid,
    'f3333333-3333-4333-8333-333333333333'::uuid
  ) AND s.coordinate_quality_tier = 'medium';

  IF v_medium_samples <> 94 THEN
    RAISE EXCEPTION 'page-fixture check failed: medium samples expected 94, got %', v_medium_samples;
  END IF;

  -- 5. High samples
  SELECT COUNT(*) INTO v_high_samples
  FROM matrix_map.samples s
  WHERE s.source_dra_id IN (
    'f1111111-1111-4111-8111-111111111111'::uuid,
    'f2222222-2222-4222-8222-222222222222'::uuid,
    'f3333333-3333-4333-8333-333333333333'::uuid
  ) AND s.coordinate_quality_tier = 'high';

  IF v_high_samples <> 53 THEN
    RAISE EXCEPTION 'page-fixture check failed: high samples expected 53, got %', v_high_samples;
  END IF;

  -- 6. Low samples
  SELECT COUNT(*) INTO v_low_samples
  FROM matrix_map.samples s
  WHERE s.source_dra_id IN (
    'f1111111-1111-4111-8111-111111111111'::uuid,
    'f2222222-2222-4222-8222-222222222222'::uuid,
    'f3333333-3333-4333-8333-333333333333'::uuid
  ) AND s.coordinate_quality_tier = 'low';

  IF v_low_samples <> 50 THEN
    RAISE EXCEPTION 'page-fixture check failed: low samples expected 50, got %', v_low_samples;
  END IF;

END $$;
