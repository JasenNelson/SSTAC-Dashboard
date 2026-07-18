# sql_runbook -- paste-ready Supabase SQL, numbered, idempotent

Paste 01..10 in order; each is safe to re-run. 00 is optional read-only. 50/51 = the
multi-media map data (decide the env_modifier enum question FIRST -- see 50). 90/91 = do
NOT run unless you are deciding to. Supabase MCP is dead -- paste each file into the
Supabase Studio SQL Editor by hand; AI never applies. Files 02 and 51 need an edit before
running (see "needed-if / note").

| File | What it does | Idempotent? | Needed-if / note |
|------|--------------|-------------|------------------|
| 00_preflight_readonly.sql | READ-ONLY probes 1a-1n (+ 1g) -- shows what is missing | read-only | Optional. Run first to see which batches you need; the apply files are all idempotent so you may skip it. |
| 01_app_tables.sql | 10 app tables (user_roles, documents, review_files, ...) + RLS + indexes | YES (IF NOT EXISTS / DO-guarded / cond. NOT-NULL relax) | Probe 1b any present=false, OR 1h drift. Foundation -- run before 02/03/07/09/10. |
| 02_admin_user_grant.sql | Grants your login the admin role | YES (ON CONFLICT DO NOTHING) | Probe 1g = 0. EDIT the email first. After 01. |
| 03_admin_role_rpcs.sql | manage_user_role_insert/delete RPCs + revoke direct writes | YES (CREATE OR REPLACE + idempotent REVOKE) | Probe 1n any present=false. After 01. |
| 04_cew_polls.sql | 6 CEW poll tables + RLS + 3 get_or_create_* helpers | YES (IF NOT EXISTS / DO-guarded / CREATE OR REPLACE) | Probe 1c OR 1c-2 any present=false AND demoing CEW polls. |
| 05_catalog_runtime_tables.sql | 5 Evidence Library catalog tables | NO -- plain CREATE TABLE | Probe 1m present=false. Apply ONLY the subset 1m reports missing (re-applying an existing one ERRORs). |
| 06_catalog_approve_rpcs.sql | catalog approve RPCs (single + bulk + concurrency guards) | YES (all CREATE OR REPLACE) | Catalog staging-approve write path in scope. After 05. |
| 07_storage_bucket_documents.sql | Creates the 'documents' storage bucket | YES (ON CONFLICT DO NOTHING) | Probe 1i = 0 rows AND demoing /twg/review upload. May still need storage policies (see file). |
| 08_matrix_map_rpc_chain.sql | matrix_map schema + RLS + 11-file fetch/measurement RPC chain | YES (idempotent / CREATE OR REPLACE) | Probe 1e<2 OR 1f=0 OR 1k ABSENT. Needs postgis. May need API "Exposed schemas" toggle. |
| 09_matrix_reviews.sql | matrix_reviews (code-derived; no repo DDL) | YES (IF NOT EXISTS / DO-guarded) | Probe 1j false AND demoing Matrix Review. LIVE-VERIFY shape first. After 01. |
| 10_document_tags.sql | document_tags join table (code-derived; no repo DDL) | YES (IF NOT EXISTS / DO-guarded) | Probe 1l false AND demoing TWG Documents tags. LIVE-VERIFY shape first. After 01. |
| 50_multimedia_schema_delta.sql | Adds 3 bnrrm_*_id columns + UNIQUE to matrix_map.measurements | YES (ADD COLUMN IF NOT EXISTS / DO-guarded) | Demoing multi-media markers. After 08, BEFORE 51. Read its env_modifier ENUM WARNING. |
| 51_multimedia_data_PATHB.README.txt | How to split + paste the 6 MB Path B data monolith | n/a (instructions) | After 50. Resolve the enum question, repoint + run the splitter, paste chunks in order. |
| 90_DEFERRED_eco.README.txt | Eco-soil / Eco-SSL staging (~2364 rows) | n/a (do not run) | OWNER JUDGMENT. Local-only disk SQL; never-promote staging. |
| 91_DEFERRED_reset_votes.README.txt | reset-votes create_vote_backup | n/a (do not run) | OWNER JUDGMENT. No repo DDL + permanent vote deletion. |

## Dependency order (apply files only)

01 (app tables) is the foundation. 02, 03, 09, 10 depend on it (user_roles / documents /
tags). 06 depends on 05 (catalog_extraction_staging). 50 depends on 08 (matrix_map schema);
51 depends on 50. 04 and 07 are independent surfaces. Inside 08 the 11 migrations are in
strict order (RLS/helpers before RPCs) -- paste 08 whole, do not reorder.

## Idempotency note (the one exception)

Every apply file is idempotent EXCEPT 05_catalog_runtime_tables.sql, whose five committed
repo migrations use plain `CREATE TABLE public.<name>` (not IF NOT EXISTS) -- re-applying a
table that already exists ERRORs "relation already exists" and aborts the paste. Apply only
the subset probe 1m reports present=false. (This is left as-is rather than rewritten to
IF NOT EXISTS: these are the project's committed, append-only migration history, and changing
their DDL here would diverge from the migration ledger. The fix is operational -- apply only
the missing subset -- not a rewrite.) All other files use IF NOT EXISTS / CREATE OR REPLACE /
DO-wrapped policies / ON CONFLICT and are safe to re-run.
