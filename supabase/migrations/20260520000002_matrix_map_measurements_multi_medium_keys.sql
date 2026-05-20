-- =====================================================================
-- PR-MAP-1 multi-medium extension -- idempotency keys for toxicity /
-- community / env_modifier measurements
-- =====================================================================
--
-- Branch: feat/matrix-map-etl-multi-medium-extension
-- Plan:   Extend etl_bnrrm_to_supabase.py to load toxicity_tests,
--         benthic_community, env_modifiers from bnrrm_training.db
--         into matrix_map.measurements alongside the existing
--         sediment_chemistry path. medium CHECK constraint already
--         permits ('sediment','water','tissue','toxicity','community').
--
-- WHY a migration is needed:
--   The PR-MAP-1 schema added matrix_map.measurements.bnrrm_chemistry_id
--   UNIQUE as the idempotency key for sediment_chemistry rows. The three
--   new source tables (toxicity_tests, benthic_community, env_modifiers)
--   each carry their own integer primary key in bnrrm_training.db, so we
--   add three sibling key columns + matching partial UNIQUE indexes
--   (WHERE NOT NULL so existing chemistry-only rows do not conflict).
--
-- This mirrors the existing pattern (bnrrm_chemistry_id UNIQUE) without
-- repurposing it. Path (a) from the orchestrator scope note: smallest
-- schema change that keeps the audit trail clean per source table.
--
-- PRE-FLIGHT (run READ-ONLY before applying):
--
--   -- Confirm matrix_map.measurements already exists with
--   -- bnrrm_chemistry_id column (PR-MAP-1 schema landed).
--   SELECT column_name FROM information_schema.columns
--   WHERE table_schema = 'matrix_map'
--     AND table_name   = 'measurements'
--     AND column_name IN ('bnrrm_chemistry_id', 'bnrrm_toxicity_id',
--                         'bnrrm_community_id', 'bnrrm_env_modifier_id')
--   ORDER BY column_name;
--   -- Expected before apply: 1 row (bnrrm_chemistry_id).
--   -- Expected after apply : 4 rows.
-- =====================================================================

BEGIN;

SET LOCAL search_path = matrix_map, public, extensions, pg_catalog;

-- ---------------------------------------------------------------------
-- 1. Add three sibling idempotency-key columns.
-- ---------------------------------------------------------------------
ALTER TABLE matrix_map.measurements
  ADD COLUMN IF NOT EXISTS bnrrm_toxicity_id     integer,
  ADD COLUMN IF NOT EXISTS bnrrm_community_id    integer,
  ADD COLUMN IF NOT EXISTS bnrrm_env_modifier_id integer;

COMMENT ON COLUMN matrix_map.measurements.bnrrm_toxicity_id IS
  'Idempotency key for toxicity_tests ETL. UNIQUE foreign reference to '
  'bnrrm_training.db toxicity_tests.id. NULL for non-toxicity rows. '
  'Sibling to bnrrm_chemistry_id; chosen over a unified (source_type, '
  'source_id) composite to mirror the existing per-source key pattern '
  '(samples.bnrrm_station_id / sample_events.bnrrm_event_id / '
  'dras.bnrrm_doc_id all dedicated columns).';

COMMENT ON COLUMN matrix_map.measurements.bnrrm_community_id IS
  'Idempotency key for benthic_community ETL. UNIQUE foreign reference '
  'to bnrrm_training.db benthic_community.id. NULL for non-community '
  'rows. Each benthic_community source row may emit multiple measurement '
  'rows (one per non-null metric: shannon_h / simpson_d / abundance / '
  'etc.); the (source_id, substance_id) pair is what makes each emitted '
  'row unique, so the unique index also includes substance_id.';

COMMENT ON COLUMN matrix_map.measurements.bnrrm_env_modifier_id IS
  'Idempotency key for env_modifiers ETL. UNIQUE foreign reference to '
  'bnrrm_training.db env_modifiers.id. NULL for non-modifier rows. '
  'medium tag = sediment per scope note (sediment-pathway bioavailability '
  'controls -- SEM/AVS, TOC, grain size); notes column carries the '
  '"env_modifier" tag so downstream queries can distinguish env modifiers '
  'from sediment chemistry.';

-- ---------------------------------------------------------------------
-- 2. Partial UNIQUE indexes (WHERE NOT NULL so the existing chemistry-
--    only rows from PR-MAP-1 do not conflict).
-- ---------------------------------------------------------------------
-- toxicity_tests: 1 source row -> 1 measurement row (test_type/endpoint
-- composite represented via substance_key namespacing in the ETL).
CREATE UNIQUE INDEX IF NOT EXISTS measurements_bnrrm_toxicity_id_uniq
  ON matrix_map.measurements (bnrrm_toxicity_id)
  WHERE bnrrm_toxicity_id IS NOT NULL;

-- benthic_community: 1 source row -> N measurement rows (one per non-
-- null metric). Uniqueness key is (source_id, substance_id) so the ETL
-- can ON CONFLICT DO NOTHING per metric.
CREATE UNIQUE INDEX IF NOT EXISTS measurements_bnrrm_community_id_substance_uniq
  ON matrix_map.measurements (bnrrm_community_id, substance_id)
  WHERE bnrrm_community_id IS NOT NULL;

-- env_modifiers: 1 source row -> 1 measurement row (parameter already
-- normalized into substances; bnrrm_env_modifier_id alone is unique).
CREATE UNIQUE INDEX IF NOT EXISTS measurements_bnrrm_env_modifier_id_uniq
  ON matrix_map.measurements (bnrrm_env_modifier_id)
  WHERE bnrrm_env_modifier_id IS NOT NULL;

COMMIT;

-- =====================================================================
-- VERIFICATION (run READ-ONLY after apply):
--
--   -- 1. Four idempotency-key columns present.
--   SELECT column_name FROM information_schema.columns
--   WHERE table_schema = 'matrix_map' AND table_name = 'measurements'
--     AND column_name LIKE 'bnrrm_%_id'
--   ORDER BY column_name;
--   -- Expected 4 rows: bnrrm_chemistry_id, bnrrm_community_id,
--   --                  bnrrm_env_modifier_id, bnrrm_toxicity_id
--
--   -- 2. Three new partial unique indexes present.
--   SELECT indexname FROM pg_indexes
--   WHERE schemaname = 'matrix_map'
--     AND tablename  = 'measurements'
--     AND indexname  LIKE 'measurements_bnrrm_%'
--   ORDER BY indexname;
--   -- Expected at least the three new indexes (plus the original
--   -- bnrrm_chemistry_id UNIQUE constraint backing index from the
--   -- PR-MAP-1 schema migration).
-- =====================================================================
