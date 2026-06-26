# AGY BRIEF -- Build the matrix-map LIVE-LOAD artifact from the enriched DB (codex-gated)

> SUPERSEDED + RESOLVED 2026-06-26: the live load is DONE. The CONFIRMED apply method is the LOCAL
> psycopg2 + DATABASE_URL session-pooler loader `scripts/matrix-map/apply_live_load.py` -- NOT the
> `mcp__supabase-project-scoped__execute_sql` path this brief proposes. Bulk SQL through MCP is
> token-fatal (~2.7M output tokens); MCP is reads/verify/small-writes only. Keep this brief only as a
> historical record. Canonical: `docs/design/matrix-map/HISTORICAL_LOAD_METHOD_FINDINGS.md`
> (CONFIRMED section) + the `/supabase` skill.

Plain ASCII only (<=127). You are the implementation workhorse. BUILD the load artifact + run the
codex-review loop to GREEN; do NOT apply to Supabase (Claude applies via the project-scoped Supabase
MCP). No destructive commands; no git push; no writes to any live database. Follow the AGY framework
(`C:\Projects\AGY_FRAMEWORK_2026_06_25.md`): verify by file/git diff, never trust your own closeout.

To save review round-trips: do PLAN + BUILD in ONE pass -- put a concise PLAN/RATIONALE section at
the top of the manifest (below), then build, then run the codex loop. Claude reviews the SQL +
manifest ONCE, then applies.

## Goal
Produce the SQL to load the validated ENRICHED BN-RRM dataset into the live `matrix_map` Postgres
schema (Supabase), so the interactive map shows the dated/auditable sediment data. Claude executes
the SQL via `mcp__supabase-project-scoped__execute_sql` (NOT Studio paste; NOT psycopg2) -- so size
the SQL for MCP execute_sql calls (a handful of LARGE idempotent batches, NOT 700 KB paste-chunks).

## Source data
- Enriched DB (validated, sha-stamped): `G:\My Drive\SABCS - Sediment Project\Dashboard\matrix-map-data\bnrrm_enhanced_2026-06-25_960a8b31.db`
  (== DB2 + the sediment date/depth/chemistry enrichment; 7,986 stations / 8,559 events / 17,021
  sediment_chemistry; same DB2 schema). COPY it to a working location; READ-ONLY for the build.

## REUSE the existing ETL (do NOT rebuild from scratch)
- `scripts/matrix-map/etl_bnrrm_to_supabase.py` ALREADY converts the BN-RRM DB -> matrix_map SQL
  (--source-db, --out-sql dry-run, substance CAS mapping, coordinate resolution surveyed/centroid,
  classification, multi-medium). ADAPT it: point --source-db at the enriched DB; emit MCP-sized
  idempotent batches. Study `db2_guard.py`, `substance_cas_map.json`, and
  `docs/design/matrix-map/PR_MAP_8_GEOCODING_DATA_FULL.csv` (site-centroid coords -- most stations
  have no surveyed coord, so they resolve to the site centroid, medium tier).
- `scripts/matrix-map/mm_loader_common.py::passes_name_gate` is the JUNK FILTER (see below).

## CRITICAL correctness requirements (codex must gate these HARD)
1. **ARTIFACT / JUNK FILTER (load-bearing).** Do NOT load junk "stations". DB2 has ~3,478 of 7,986
   stations that are NOT real sampling stations (analyte names mis-parsed as stations e.g.
   "Arsenic","Benzo(a)pyrene"; purely-numeric; criteria/QA columns "BC Standard"/"CSR *"/"QA/QC *"/
   "RPD *"). EXCLUDE every station failing `mm_loader_common.passes_name_gate(...)` (and its
   measurements/events) from the load. The OLD ETL only filtered the ~192 criteria names -- you must
   extend it to the FULL gate (~3,478). Report the filtered count in the manifest.
2. **IDEMPOTENT.** Every INSERT uses `ON CONFLICT ... DO NOTHING` on the existing idempotency keys
   (bnrrm_chemistry_id / bnrrm_toxicity_id / bnrrm_community_id / bnrrm_env_modifier_id, and the
   natural keys for dras/samples/sample_events/substances). Re-running must not duplicate -- the live
   DB already has the 9 seed sites loaded; this load must MERGE, not double them.
3. **FK-SAFE ORDER**, batched for MCP: substances -> dras -> samples -> sample_events -> measurements.
   Each batch a self-contained transaction (BEGIN; SET LOCAL search_path = matrix_map, extensions;
   ... ; COMMIT;). Size each batch to a few hundred KB / a few thousand rows (MCP execute_sql limit).
4. **DATA-ONLY, no security surface.** INSERT rows into EXISTING matrix_map tables ONLY. Do NOT
   create/alter tables, RLS policies, RPCs, roles, or the spatial-oracle bbox functions (the
   #407/#409/#410 posture must stay intact). If the schema needs a column the enriched data has and
   matrix_map lacks, STOP and flag it -- do not alter the live schema.
5. **AUDITABILITY fields** the map needs (carry them): source report (DRA), sampling date, depth when
   available, station classification. Page number not needed.

## Deliverables (working dir or scripts/matrix-map/)
- The adapted ETL + the emitted SQL batch files (e.g. `mm_live_load_batch_01_substances.sql`, ...
  `_NN_measurements.sql`) -- idempotent, FK-ordered, MCP-sized.
- `mm_live_load_manifest.json`: a PLAN/RATIONALE section (1 paragraph) + counts: stations loaded vs
  junk-filtered, dras/samples/events/measurements rows per batch, dated-event count, medium
  breakdown, and the batch file list IN APPLY ORDER. This is what Claude reads to apply.
- A codex round-table (tier/round/findings/verdict) in the closeout `.tmp_agy_closeout_liveload.md`.

## Codex review (run the loop to GREEN yourself)
Run the upgraded codex_review skill: targeted + strategic (does it integrate with the live
matrix_map schema + the seed data already there?) + holistic. Spark grind -> xhigh gate. Focus codex
on: the junk filter completeness, idempotency/ON-CONFLICT correctness, FK order, NO security-surface
changes, and CAS/substance mapping correctness. Mutual-agreement rebuttal; never silent-reject.

## What Claude does after (do NOT do these)
Claude reviews the manifest + SQL once, takes a pre-load Supabase snapshot, executes the batches in
order via the project-scoped MCP, verifies post-load counts vs the manifest, then commits the ETL +
SQL artifacts. Do NOT apply to Supabase yourself; do NOT git commit (Claude commits after verifying
the live load).
