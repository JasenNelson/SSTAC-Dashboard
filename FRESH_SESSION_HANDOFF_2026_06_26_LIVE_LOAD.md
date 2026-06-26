# Fresh-Session Handoff -- BN-RRM live load (2026-06-26). Plain ASCII.

ONE task left: load the enriched BN-RRM sediment data into live Supabase `matrix_map`. Everything
else (extraction, enrichment, verification, coordinate investigation) is DONE + committed.

## READ FIRST (do not re-derive -- it cost many tokens)
1. `docs/design/matrix-map/HISTORICAL_LOAD_METHOD_FINDINGS.md` -- AGY is deep-searching the repo for
   the EXACT method prior sessions used to load matrix_map (they loaded ~all the data autonomously).
   If that file exists, USE its method. If not, re-run the AGY search brief:
   `docs/design/matrix-map/HISTORICAL_LOAD_SEARCH_AGY_BRIEF.md`.
2. memory `dashboard_supabase_project_scoped_mcp_live` -- has the VERIFIED facts below.

## VERIFIED (via pg_policies, not assumed)
- `matrix_map` write RLS on samples/sample_events/measurements/dras: `cmd=ALL, roles={authenticated}`,
  WITH CHECK = user is in `user_roles` with role 'admin' OR 'matrix_admin'.
- So the ANON key ALONE cannot write. A load needs: a `service_role` key (bypasses RLS), OR an
  authenticated admin/matrix_admin session (supabase client + admin email/password sign-in), OR a
  Postgres `DATABASE_URL` (postgres role bypasses RLS). `.env.local` has only ANON keys + URL; the
  write credential is a runtime secret (the owner may have signed in to unlock prior loads).
- DO NOT push bulk SQL through `mcp__supabase-project-scoped__execute_sql` (SQL becomes Claude output
  tokens ~112k/450KB batch = budget-fatal). MCP is for READS/verify/small-writes only.
- The owner believes there is a documented/scripted loader already in the project -- FIND IT (the AGY
  search) before proposing pip installs or new scripts. My earlier "install psycopg2 / set
  DATABASE_URL" proposal was likely WRONG.

## Load artifacts (already built + codex-GREEN)
- Enriched source DB: `G:\My Drive\SABCS - Sediment Project\Dashboard\matrix-map-data\bnrrm_enhanced_2026-06-25_960a8b31.db`
  (DB2 + sediment date/depth/chem enrichment; verify_merge 44/45; +171 stations, dated 304->499).
- 27 idempotent FK-ordered SQL batches: `scripts/matrix-map/mm_live_load_batch_01..27.sql` +
  `mm_live_load_manifest.json` (the raw-SQL path needs DATABASE_URL/psql). If the historical method
  is supabase-py row-data, the ETL `etl_bnrrm_to_supabase.py` may need a row-emit mode.
- Junk filter: ~3478 non-station rows excluded (analyte names/criteria/QA). FK order: substances ->
  dras -> samples -> sample_events -> measurements. All ON CONFLICT DO NOTHING (idempotent).
- Apply script (raw-SQL path, if DATABASE_URL): `<scratchpad>/apply_live_load.py` (reports counts).

## Strategic note (from MAP_2A_DATASET_INVESTIGATION_2026_06_23.md, CORRECTED)
The full 345-site load is mostly EMPTY registry stations; the VALUE is the dated sediment data
(+~191 new dated events). bbox map (#413) shipped, so volume is OK. Consider loading the enrichment
delta vs the full registry.

## NEXT STEPS (efficient; offload to AGY -- free tokens; budget <5% weekly)
1. Read HISTORICAL_LOAD_METHOD_FINDINGS.md -> use that method + credential.
2. Get the write credential from the owner (service_role key, or admin email/password, or
   DATABASE_URL -- whatever the historical method uses).
3. Load (AGY runs it via /supabase skill, or Claude via the historical loader) -> verify counts via
   one read-only MCP query -> commit.
4. Refine the `/supabase` skills (Claude `~/.claude/skills/supabase`, AGY
   `~/.gemini/config/plugins/science/skills/supabase`) to match the CONFIRMED historical method.

## State
- Branch `docs/bnrrm-433-batch-handoff-2026-06-24`, tip ~b1d028c (+ this handoff). Not pushed.
- Orphans: 0/0 clean. Deliverable safe on G:.
- `/supabase` + `/AGY` skills + memory all saved. AGY framework: `C:\Projects\AGY_FRAMEWORK_2026_06_25.md`.
