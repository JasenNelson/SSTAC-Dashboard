-- Migration: matrix_map.measurements multimedium source-id columns
-- (repo capture of changes applied LIVE via the project-scoped MCP on
-- 2026-06-05 for the toxicity + community data load -- see
-- FRESH_SESSION_PLAN_MATRIX_MAP_STATS_2026_06_05.md "LIVE SUPABASE CHANGES").
--
-- ALREADY APPLIED to the production project (qyrhsieynzfgyuqzznap); all
-- statements are IDEMPOTENT. Definitions read back verbatim from the live
-- database (information_schema.columns + pg_indexes) on 2026-06-06.
--
-- Semantics (mirrors the existing measurements_bnrrm_chemistry_id_key
-- pattern for the sediment-chemistry medium):
--   bnrrm_toxicity_id  -- source row id in the BN-RRM toxicity table; one
--                         measurement per source row -> UNIQUE(bnrrm_toxicity_id).
--   bnrrm_community_id -- source row id in the BN-RRM community table; one
--                         source row fans out to one measurement per
--                         substance/metric -> UNIQUE(bnrrm_community_id, substance_id).
-- Both nullable: rows from other media leave them NULL.

alter table matrix_map.measurements
  add column if not exists bnrrm_toxicity_id integer;

alter table matrix_map.measurements
  add column if not exists bnrrm_community_id integer;

create unique index if not exists measurements_bnrrm_toxicity_id_key
  on matrix_map.measurements using btree (bnrrm_toxicity_id);

create unique index if not exists measurements_bnrrm_community_id_substance_id_key
  on matrix_map.measurements using btree (bnrrm_community_id, substance_id);
