-- ============================================================================
-- 50_multimedia_schema_delta.sql
--   AUTHORED additive migration. Adds the three integer idempotency-key columns
--   Path B's multi-medium INSERTs need to matrix_map.measurements:
--     bnrrm_toxicity_id, bnrrm_community_id, bnrrm_env_modifier_id
--   plus their UNIQUE constraints (follows the existing bnrrm_chemistry_id pattern
--   in 20260519000001_matrix_map_schema.sql). Without these columns a Path B paste
--   fails with "column bnrrm_toxicity_id does not exist".
-- Idempotent: safe to run even if already applied. ADD COLUMN IF NOT EXISTS +
--   DO-guarded constraints (each checks pg_constraint before adding).
-- Needed-if: you will demo the multi-media markers (toxicity / community /
--   env_modifier) AND Batch 8 (08_matrix_map_rpc_chain.sql) has already run (the
--   matrix_map schema must exist first). REQUIRED BEFORE 51 (the Path B data paste).
-- Source: hand-authored from SQL_MIGRATION_RUNBOOK_2026_06_05.md Batch 11a +
--   MO_PHASE0_DECISION_BRIEFS_2026_06_05.md Brief 1. (Not a repo migration file --
--   the schema never caught up to the v1.1.0 multi-media ETL.)
-- ============================================================================

ALTER TABLE matrix_map.measurements ADD COLUMN IF NOT EXISTS bnrrm_toxicity_id integer;
ALTER TABLE matrix_map.measurements ADD COLUMN IF NOT EXISTS bnrrm_community_id integer;
ALTER TABLE matrix_map.measurements ADD COLUMN IF NOT EXISTS bnrrm_env_modifier_id integer;

-- bnrrm_toxicity_id: standalone UNIQUE (Path B uses ON CONFLICT (bnrrm_toxicity_id) DO NOTHING)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
    WHERE conname='measurements_bnrrm_toxicity_id_key'
      AND conrelid='matrix_map.measurements'::regclass) THEN
    ALTER TABLE matrix_map.measurements
      ADD CONSTRAINT measurements_bnrrm_toxicity_id_key UNIQUE (bnrrm_toxicity_id);
  END IF;
END $$;

-- bnrrm_community_id: COMPOSITE UNIQUE (bnrrm_community_id, substance_id) per Path B ON CONFLICT
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
    WHERE conname='measurements_bnrrm_community_id_substance_id_key'
      AND conrelid='matrix_map.measurements'::regclass) THEN
    ALTER TABLE matrix_map.measurements
      ADD CONSTRAINT measurements_bnrrm_community_id_substance_id_key
      UNIQUE (bnrrm_community_id, substance_id);
  END IF;
END $$;

-- bnrrm_env_modifier_id: standalone UNIQUE (Path B uses ON CONFLICT (bnrrm_env_modifier_id) DO NOTHING)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
    WHERE conname='measurements_bnrrm_env_modifier_id_key'
      AND conrelid='matrix_map.measurements'::regclass) THEN
    ALTER TABLE matrix_map.measurements
      ADD CONSTRAINT measurements_bnrrm_env_modifier_id_key UNIQUE (bnrrm_env_modifier_id);
  END IF;
END $$;

-- VERIFY (expect 3 rows):
--   select column_name from information_schema.columns
--   where table_schema='matrix_map' and table_name='measurements'
--     and column_name in ('bnrrm_toxicity_id','bnrrm_community_id','bnrrm_env_modifier_id')
--   order by column_name;

-- ============================================================================
-- !!! ENUM HAZARD -- RESOLVE THIS BEFORE RUNNING 51 (the Path B data paste) !!!
-- ============================================================================
-- The live measurements.medium CHECK is (20260519000001_matrix_map_schema.sql:359-360):
--     medium IN ('sediment','water','tissue','toxicity','community')
-- It does NOT include 'env_modifier'.
--
-- CONTRADICTION IN THE SOURCE ARTIFACTS, RESOLVED BY DIRECT FILE SCAN:
--   - SQL_MIGRATION_RUNBOOK_2026_06_05.md Batch 11a called whether Path B emits
--     medium='env_modifier' "AMBIGUOUS" and left this block commented as optional.
--   - MO_PHASE0_DECISION_BRIEFS_2026_06_05.md Brief 1 states the v1.1.0 monolith
--     contains 658 environmental-modifier rows.
--   - A DIRECT scan of the Path B file
--     (scripts/matrix-map/etl_bnrrm_to_supabase_output_v1_1_0_multimedium_PATH_B.sql)
--     CONFIRMS it: 658 `bnrrm_env_modifier_id` ON CONFLICT lines AND 670 occurrences
--     of the literal 'env_modifier' (vs 334 toxicity rows / 175 community rows).
--   => Path B DOES insert medium='env_modifier'. With the CHECK as-is, every one of
--      those ~658 INSERTs FAILS the constraint ("new row violates check constraint
--      measurements_medium_check") and the paste aborts.
--
-- This is a DELIBERATE SCHEMA DECISION (extend an enum), so it stays COMMENTED here
-- and is surfaced, not auto-applied. Before running 51, decide:
--   (a) EXTEND the enum to accept 'env_modifier' (recommended if multi-media incl.
--       grain-size / TOC modifiers is in demo scope) -- uncomment the block below
--       AFTER live-verifying the current constraint name; OR
--   (b) DEFER env_modifier -- regenerate Path B to emit only sediment/toxicity/
--       community (a v1.1.x ETL re-run), so this enum change is unnecessary.
--
-- LIVE-VERIFY the constraint name first (it is 'measurements_medium_check' in the
-- repo DDL, but confirm on the live project):
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--   where conrelid='matrix_map.measurements'::regclass and contype='c'
--     and pg_get_constraintdef(oid) ilike '%medium%';
--
-- THEN, ONLY if you chose (a) extend, run (idempotent: drop-then-add the CHECK):
--   ALTER TABLE matrix_map.measurements DROP CONSTRAINT measurements_medium_check;
--   ALTER TABLE matrix_map.measurements ADD CONSTRAINT measurements_medium_check
--     CHECK (medium IN ('sediment','water','tissue','toxicity','community','env_modifier'));
-- ============================================================================
