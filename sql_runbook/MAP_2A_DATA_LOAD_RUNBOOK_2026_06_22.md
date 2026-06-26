# Matrix-Map data load -- Map-2a (env_modifiers EXCLUDED) -- 2026-06-22

> CORRECTION (2026-06-26): the "Supabase MCP is dead / owner pastes in Studio" framing below is
> SUPERSEDED. The project-scoped MCP is LIVE (the seed was loaded via it); and the canonical BULK
> load method is now: **AGY runs the load Postgres-side via psycopg2/psql + DATABASE_URL** (free
> tokens; Claude must NOT push >100KB SQL through MCP). See
> `docs/design/matrix-map/LIVE_LOAD_APPLY_AGY_BRIEF_2026_06_26.md` +
> `docs/design/matrix-map/MAP_2A_DATASET_INVESTIGATION_2026_06_23.md` (CORRECTED) + memory
> `dashboard_supabase_project_scoped_mcp_live`. Studio-paste remains a valid token-free fallback.

Self-contained runbook for the Matrix-Map multimedium data load. Plain ASCII.

## Decision (owner, 2026-06-22): Map-2a -- EXCLUDE env_modifiers

The earlier PATH_B monolith emitted `env_modifier` measurement rows on a
`bnrrm_env_modifier_id` column that does NOT exist in the live/canonical schema, and the owner
EXCLUDED env_modifiers as a map medium on 2026-06-05 (grain size / TOC / pH etc. are
sediment-characterization metadata, not contaminant layers). Map-2a regenerates the load WITHOUT
env_modifiers, so:

- NO `bnrrm_env_modifier_id` column migration is needed (and none is applied).
- NO `measurements.medium` enum/CHECK change is needed.
- The load is sediment + toxicity + community only.

(If the owner ever re-includes env_modifiers, that is "Map-2b": it would require a NEW owner-approved
migration adding nullable `bnrrm_env_modifier_id` + a unique index BEFORE any env_modifier rows.)

## Source + scope

- Source DB: the canonical DB2 `bnrrm_training_DB2_20260503.db`
  (`G:\My Drive\SABCS - Sediment Project\Dashboard\matrix-map-data\`), per
  `docs/design/matrix-map/DB2_ADOPTION.md` (MAP-3: full 345-site scope). The ETL auto-arms its
  SHA-256 integrity check on the default-path DB2 run.
- Regenerated 2026-06-22 dry-run counts (no env_modifiers, dated rows only):
  182 substances, 574 DRAs, 7562 samples, 302 sample_events,
  14244 sediment + 334 toxicity + 178 community measurements, 0 env_modifier, 0 undated.

## Prerequisites (Supabase Studio SQL Editor -- Supabase MCP is dead, use the editor)

Apply in this order if not already applied (check `supabase/migrations/` applied state first):

1. `20260606000002_matrix_map_measurements_bnrrm_multimedium_columns.sql` -- adds
   `bnrrm_toxicity_id` + `bnrrm_community_id` columns + unique indexes. (Per the ETL header this was
   already applied LIVE in PR #260; verify before re-applying. It is idempotent.)
2. `20260620000001_matrix_map_event_date_nullable.sql` -- nullable `event_date` + `date_precision`.
   Required ONLY for the optional undated load (step C below); harmless to apply now.
3. `20260622000001_matrix_map_fetch_measurements_date_precision.sql` -- RPC `date_precision`
   (depends on 20260620000001). The app layer is already live + backward-compatible.

NO env_modifier-column migration. NO enum change.

## A. Regenerate the dated monolith (no env_modifiers)

```
.venv/Scripts/python.exe scripts/matrix-map/etl_bnrrm_to_supabase.py \
  --out-sql scripts/matrix-map/etl_bnrrm_to_supabase_output_v1_1_0_no_envmod_2026_06_22.sql
```

(Default = dry-run, default source-db = DB2. Do NOT pass `--include-env-modifiers`.)

## B. Split into paste-sized chunks

```
.venv/Scripts/python.exe scripts/matrix-map/split_etl_output.py \
  --source scripts/matrix-map/etl_bnrrm_to_supabase_output_v1_1_0_no_envmod_2026_06_22.sql
```

Writes ~700 KB chunks to `scripts/matrix-map/etl_output_chunks/NN_<purpose>.sql` (26 chunks as of
2026-06-22), each wrapped in BEGIN/COMMIT + `SET LOCAL search_path`, split only at `;` boundaries.
Delete any STALE chunks in that dir first. Confirm 0 chunks contain `bnrrm_env_modifier_id`
(`grep -l bnrrm_env_modifier_id scripts/matrix-map/etl_output_chunks/*.sql` must return nothing).

## C. Paste into Supabase Studio IN NUMERIC ORDER (01, 02, ... 26)

Order is FK-safe and MUST be preserved (substances -> samples -> sample_events -> measurements).
Every INSERT is `ON CONFLICT DO NOTHING`, so re-pasting a chunk is idempotent.

### Optional: undated rows

To also load the ~8052 measurements with no event_date (skipped by the default run), re-run step A
with `--allow-undated` (emits `event_date NULL` + `date_precision='undated'`; REQUIRES migration
20260620000001 applied), then split + paste those chunks too. The app layer already handles undated
rows (event_date nullable + date_precision; undated rows excluded when a date filter is active).

## Verify

```
select medium, count(*) from matrix_map.measurements group by medium order by medium;
select count(*) as total from matrix_map.measurements;
```

Expect medium in ('sediment','toxicity','community') only -- NO 'env_modifier'.

## Rollback (leaves the sediment baseline intact)

```
DELETE FROM matrix_map.measurements WHERE medium IN ('toxicity','community');
```

## Notes

- AI never writes Supabase (MCP dead per `cross_project_supabase_mcp_dead_skip_to_sql_editor`); the
  owner pastes in the SQL Editor.
- The regenerated monolith + chunks are LOCAL scratch (reproducible from A + B); they are not
  committed to git (an ~18 MB generated artifact). This runbook is the durable record.
