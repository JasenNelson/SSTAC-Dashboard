# AGY BRIEF -- APPLY the matrix-map live load to Supabase (AGY runs it, not Claude)

Plain ASCII. You are the workhorse. APPLY the already-built, codex-GREEN load batches to the live
Supabase `matrix_map` schema via a local Postgres client. AGY does this (not Claude) because Claude
pushing SQL through MCP would burn ~112k tokens PER 450 KB batch -- AGY runs it Postgres-side for free.

## Prerequisite (STOP if missing)
- `DATABASE_URL` must be set in your env = the Supabase Postgres connection string (the OWNER provides
  it; Supabase dashboard -> Settings -> Database -> Connection string -> URI; use the **Session
  pooler or Direct** connection, NOT the transaction pooler, since each batch is a multi-statement
  transaction). If `DATABASE_URL` is unset, STOP and tell the owner -- do not proceed.
- Do NOT print, log, or commit the connection string.

## What to load
- 27 batch files: `scripts/matrix-map/mm_live_load_batch_01_substances.sql` ...
  `_27_measurements.sql`. Apply IN NUMERIC ORDER (FK-safe: substances -> dras -> samples ->
  sample_events -> measurements). Manifest: `scripts/matrix-map/_enrichment_working/mm_live_load_manifest.json`
  (or wherever it was written) has the exact order + expected counts.
- They are already VERIFIED safe (codex-GREEN; data-only INSERTs; every statement ON CONFLICT DO
  NOTHING = idempotent + safe to re-run; junk-filtered; transaction-bracketed). Do NOT re-review --
  just apply.

## Steps
1. Ensure a client: `.venv\Scripts\python.exe -m pip install psycopg2-binary` (or use `psql` if on
   PATH). Read `DATABASE_URL` from env.
2. PRE-LOAD counts (record for the diff + rollback):
   `SELECT 'substances',count(*) FROM matrix_map.substances UNION ALL SELECT 'dras',count(*) FROM
   matrix_map.dras UNION ALL SELECT 'samples',count(*) FROM matrix_map.samples UNION ALL SELECT
   'sample_events',count(*) FROM matrix_map.sample_events UNION ALL SELECT 'measurements',count(*)
   FROM matrix_map.measurements;` plus `SELECT medium,count(*) FROM matrix_map.measurements GROUP BY medium;`
3. APPLY each batch file in order (a small psycopg2 loop: open conn, for each file in sorted order
   execute its full text, the file's own BEGIN/COMMIT handles the transaction; on any error STOP,
   report which batch + the error, do not continue). Do NOT alter schema/RLS/RPCs.
4. POST-LOAD counts (same queries) + verify the deltas roughly match the manifest (stations/samples
   up by the loaded set; measurements medium in sediment/toxicity/community only; idempotent re-run
   would add 0).
5. REPORT in the closeout `.tmp_agy_closeout_liveload_apply.md`: pre vs post counts per table +
   medium breakdown, batches applied, any errors, and confirm no schema/RLS/RPC change. Do NOT git
   commit, do NOT git push (Claude/owner commits the artifacts separately).

## Rollback (if needed)
The load is additive + idempotent. To undo: `DELETE FROM matrix_map.measurements WHERE medium IN
('toxicity','community');` for the multimedium rows, or delete by the `bnrrm_*_id` ranges the load
added; or restore the `matrix_map_backup_20260624` snapshot. Report counts so the owner can decide.

## Note (optional, surface only)
A prior investigation (`docs/design/matrix-map/MAP_2A_DATASET_INVESTIGATION_2026_06_23.md`) noted the
full 345-site load is mostly EMPTY registry stations; the real value is the enrichment's dated
sediment data. Apply as instructed, but in the report note how many of the loaded stations actually
have measurements vs are empty, so the owner can judge.
