# SQL Migration Runbook -- SSTAC Dashboard -- 2026-06-05

OWNER-RUN. Plain ASCII (code point <= 127). This is the single sheet for getting through the Supabase
SQL backlog by pasting into the Supabase Studio SQL Editor. Supabase MCP is dead (fails 100%) -- every
batch below is a MANUAL copy-paste. AI never pastes; AI never applies. You paste, you read the verify
query, you decide.

Companion inputs (read-only sources this runbook routes to, NOT re-authored here):
- `DEMO_BLOCKER_RESOLUTION_KIT_2026_06_04.md` -- STEP 1 probes (1a-1n) + Remedies A-H. This runbook's
  STEP 0 IS that kit's STEP 1; the batches below point at its Remedy blocks by name.
- `scripts/matrix-map/etl_bnrrm_to_supabase_output_v1_1_0_multimedium_PATH_B.sql` -- Path B DATA monolith
  (6.03 MB / 9521 lines).
- `supabase/migrations/` -- 30 committed migration files (the repo-backed batches).
- `database_schema.sql` (root) -- the app-tables + CEW source (applied only via guarded extract blocks,
  never raw).

---

## 1. How to use

1. Run STEP 0 (the read-only pre-flight probe block) ONCE against the TARGET project. Its results tell
   you WHICH batches below you actually need. Do not apply anything before STEP 0.
2. Paste order matters. Work the batches in the order of the CHECKLIST table (dependency + size order).
   A batch's "Needed-if" column ties it to a STEP 0 probe -- skip any batch whose probe came back green.
3. Each batch gives you: a PRE-CHECK (which probe gates it), the SQL (inline guarded block OR a pointer
   to the EXACT repo file to copy -- copy that file verbatim, do not retype), whether it is IDEMPOTENT
   (safe to re-run), the EXPECTED result, a VERIFY query, and a ROLLBACK.
4. SIZE NOTE: keep each paste under ~1 MB (Supabase Studio paste limit; the kit cites ~900 KB as the
   practical ceiling). Every `supabase/migrations/` file is < 47 KB -- paste each whole. The ONLY
   oversized artifact is the Path B DATA monolith (6.03 MB) -- Batch 11 is PRE-SPLIT with explicit chunk
   order; never paste the 6 MB file in one shot.
5. When a probe result is ambiguous or a remedy is code-derived (Batches 9, 10) or destructive
   (DEFERRED section), STOP and use the explore-before-assume protocol -- verify the live shape twice
   before any DDL. Do NOT invent SQL.

---

## CHECKLIST (one screen)

| # | Batch | Needed-if (STEP 0 probe) | Size | Idempotent? | Done? |
|---|-------|--------------------------|------|-------------|-------|
| 0 | Pre-flight probe (READ-ONLY) | always run FIRST | ~6 KB | read-only | [ ] |
| 1 | App tables (Remedy B guarded block) | 1b any present=false; 1h drift on documents/review_files | ~30 KB | YES | [ ] |
| 2 | Admin user grant (Remedy C) | 1g returns 0 | <1 KB | YES (ON CONFLICT) | [ ] |
| 3 | Admin -> Users role RPCs (20260527000001) + revoke (000002) | 1n any present=false | ~3.5 KB | YES | [ ] |
| 4 | CEW polls + helper functions (Remedy E) | 1c OR 1c-2 any present=false | ~45 KB | YES | [ ] |
| 5 | Catalog runtime tables (003/004/006/007/008) | 1m any present=false | ~33 KB | NO (plain CREATE TABLE) | [ ] |
| 6 | Catalog approve RPCs (005/20260530000001/20260602000001) | catalog write path needed | ~26 KB | YES (CREATE OR REPLACE) | [ ] |
| 7 | Storage bucket `documents` (Remedy F) | 1i returns 0 rows | <1 KB | YES (ON CONFLICT) | [ ] |
| 8 | Matrix-map RPC chain (11 files, strict order) | 1e<2 OR 1f=0 OR 1k ABSENT | ~174 KB total | YES | [ ] |
| 9 | matrix_reviews (Remedy G; code-derived, LIVE-VERIFY) | 1j false AND code-verified | ~2 KB | YES | [ ] |
| 10 | document_tags (Remedy H; code-derived, LIVE-VERIFY) | 1l false AND code-verified | <2 KB | YES | [ ] |
| 11a | Matrix-map multi-media SCHEMA DELTA (3 columns) | demoing toxicity/community markers | <1 KB | YES | [ ] |
| 11b | Path B DATA paste (pre-split chunks; needs 11a + Batch 8 first) | 1k shows 0 rows / only sediment | 6.03 MB pre-split | YES (ON CONFLICT) | [ ] |
| -- | DEFERRED: eco passes; reset-votes create_vote_backup | OWNER JUDGMENT -- do NOT auto-run | -- | -- | -- |
| -- | DEFERRED: engine-v2 base schema / Remedy A v2 column | OWNER-GATED (out of kit scope) | -- | -- | -- |

Total repo-backed migration files: 30 (~310 KB). Distinct apply batches in this runbook: 11 (1-11),
plus the DEFERRED set.

---

## STEP 0 -- PRE-FLIGHT (READ-ONLY)

Run this ONCE against the TARGET project. It is the SAME block as
`DEMO_BLOCKER_RESOLUTION_KIT_2026_06_04.md` STEP 1 (probes 1a-1n). Do NOT retype it here -- open that
kit, copy its first fenced SQL block (probes `1a` through `1n`, ending at the `1n` role-RPC probe), and
paste it as ONE read-only batch into Supabase Studio. Then run the OPTIONAL count block (1g) ONLY if 1b
shows `user_roles` present. Probe 1k emits via RAISE NOTICE -- read the Studio "Messages" pane.

Every probe is safe on a fresh project: existence is checked with `to_regclass(...)` /
`to_regprocedure(...)` (return NULL, never error) and the one count (1g) is guarded. Nothing in STEP 0
writes.

INTERPRETATION TABLE (probe -> which batch). Full per-probe interpretation is in the kit's STEP 1
INTERPRETATION list; this is the routing summary:

| Probe | What it checks | Result that triggers action | Go to |
|-------|----------------|-----------------------------|-------|
| 1a + 1a-2 | engine-v2 `v2_projects` table + `applicable_policy_ids` column | 1a true + 1a-2 0 rows -> column missing; 1a false -> base schema absent | DEFERRED (Remedy A / engine-v2 base; owner-gated) |
| 1b | 10 app tables present | any present=false | Batch 1 |
| 1h | `documents` / `review_files` column drift + legacy NOT NULL | any `live_col:` false on a present table; any `legacy_not_null:` true | Batch 1 (drift sub-blocks) |
| 1g | at least one admin user | returns 0 | Batch 2 |
| 1n | `manage_user_role_insert/delete` RPCs | any present=false | Batch 3 |
| 1c | 6 CEW poll tables | any present=false | Batch 4 |
| 1c-2 | 3 poll-submit helper functions | any present=false (independent of 1c) | Batch 4 |
| 1m | 6 catalog runtime tables | any present=false | Batch 5 (tables) + Batch 6 (approve RPCs) |
| 1i | `documents` storage bucket | 0 rows | Batch 7 |
| 1e | matrix_map fetch RPC + allowlist | < 2 rows | Batch 8 |
| 1f | matrix_map measurement RPC | 0 rows | Batch 8 |
| 1k | matrix_map DATA row counts (NOTICE) | ABSENT -> Batch 8 first; 0 rows -> Batch 11 (data load) | Batch 8 then 11 |
| 1j | `matrix_reviews` table (no repo DDL) | false -> code-verify then Batch 9, or DEFER | Batch 9 |
| 1l | `document_tags` table (no repo DDL) | false -> code-verify then Batch 10, or DEFER | Batch 10 |
| 1d | `review_submissions` status CHECK | 0 rows on a present table -> reconcile by hand | (manual; surface to owner) |
| -- | `parameter_value_reviews` (no migration file) | 1m shows it absent | DEFERRED -- explore-before-assume, no CREATE |
| -- | `/admin/reset-votes` `create_vote_backup` | NO probe by design | DEFERRED (do not run) |

---

## BATCHES

### Batch 1 -- App tables (admin pages + TWG review)

- WHAT: Creates `user_roles, tags, documents, announcements, milestones, discussions,
  discussion_replies, review_submissions, review_files, likes` + RLS + indexes. These live in
  `database_schema.sql` but were never under `supabase/migrations/`, so they may be absent on a fresh
  target.
- CONDITIONAL? Yes -- only if STEP 0 probe 1b shows any table missing, OR probe 1h flags drift on
  `documents` / `review_files` (present-but-stale columns, or legacy `file_name`/`mime_type` still NOT
  NULL).
- SQL: Use the GUARDED BLOCK in `DEMO_BLOCKER_RESOLUTION_KIT_2026_06_04.md` Remedy B (the fenced
  `== Remedy B: app tables ==` block). DO NOT paste raw `database_schema.sql` -- its `CREATE POLICY`
  has no IF NOT EXISTS (errors on re-run), its sample INSERTs duplicate demo content, and its broad
  `GRANT ... ON ALL TABLES` over-privileges. Remedy B excludes all three and wraps every policy in a
  `DO $$ ... EXCEPTION WHEN duplicate_object THEN NULL` guard. The `documents` and `review_files`
  blocks use the verified LIVE-CODE column contract (live `documents` insert adds `user_id`,
  `user_email`; live `review_files` uses `filename`/`mimetype`/`file_size`/`uploaded_at` and the block
  relaxes the legacy NOT NULLs).
- IDEMPOTENT? Yes -- every table is `CREATE TABLE IF NOT EXISTS`, every index `IF NOT EXISTS`, every
  policy DO-guarded, the NOT-NULL relax is conditional. Safe to run twice; harmless on tables that
  already exist.
- EXPECTED: 10 tables present after run; the drift ALTERs add columns / relax constraints on the two
  drifted tables.
- VERIFY:
  ```sql
  select t.table_name, to_regclass('public.' || t.table_name) is not null as present
  from (values ('user_roles'),('tags'),('documents'),('announcements'),('milestones'),
               ('discussions'),('discussion_replies'),('review_submissions'),('review_files'),('likes')
  ) as t(table_name) order by t.table_name;
  ```
  Expect all `present = true`. Re-run probe 1h: all `live_col:` true, both `legacy_not_null:` false.
- ROLLBACK: None auto-provided (these are foundational app tables). To undo a freshly created table on a
  throwaway target: `DROP TABLE IF EXISTS public.<name> CASCADE;` -- do NOT drop on a live project that
  already had data; reconcile by hand instead.

### Batch 2 -- Admin user grant

- WHAT: Grants your demo login the `admin` role so `/admin` is reachable.
- CONDITIONAL? Yes -- only if STEP 0 probe 1g returns `admin_count = 0`. Requires `user_roles` (Batch 1)
  to exist first.
- SQL: `DEMO_BLOCKER_RESOLUTION_KIT_2026_06_04.md` Remedy C. Replace the email before running:
  ```sql
  insert into public.user_roles (user_id, role)
  select id, 'admin' from auth.users where email = 'YOUR_DEMO_EMAIL@example.com'
  on conflict do nothing;
  ```
- IDEMPOTENT? Yes (`on conflict do nothing`).
- EXPECTED: 1 row inserted (or 0 if already admin).
- VERIFY: `select count(*) as admin_count from public.user_roles where role = 'admin';` Expect >= 1.
- ROLLBACK: `delete from public.user_roles where role = 'admin' and user_id = (select id from auth.users where email = 'YOUR_DEMO_EMAIL@example.com');`

### Batch 3 -- Admin -> Users role-change RPCs

- WHAT: Creates `manage_user_role_insert` / `manage_user_role_delete` (the Admin Users page calls these
  RPCs, not a direct table write) and revokes direct INSERT/DELETE on `user_roles` from `authenticated`
  to force the RPC path.
- CONDITIONAL? Yes -- only if STEP 0 probe 1n shows either RPC `present=false`. The `user_roles` TABLE
  being present (1b green) is NOT sufficient; without these RPCs the role add/remove buttons 500.
- SQL: copy these EXACT repo files, in order:
  1. `supabase/migrations/20260527000001_user_roles_rpcs.sql` (2999 bytes) -- the two RPCs.
  2. `supabase/migrations/20260527000002_user_roles_revoke_insert_delete.sql` (549 bytes) -- REVOKE only.
- IDEMPOTENT? Yes -- both functions are `CREATE OR REPLACE FUNCTION`; the REVOKE is idempotent.
- EXPECTED: both functions defined; direct INSERT/DELETE on `user_roles` revoked from `authenticated`.
- VERIFY:
  ```sql
  select p.label, to_regprocedure(p.sig) is not null as present
  from (values ('manage_user_role_insert','public.manage_user_role_insert(uuid,text)'),
               ('manage_user_role_delete','public.manage_user_role_delete(uuid,text)')
  ) as p(label,sig) order by p.label;
  ```
  Expect both `present = true`.
- ROLLBACK: `DROP FUNCTION IF EXISTS public.manage_user_role_insert(uuid,text); DROP FUNCTION IF EXISTS public.manage_user_role_delete(uuid,text);` then re-`GRANT INSERT, DELETE ON public.user_roles TO authenticated;` only if you intend to restore direct writes.

### Batch 4 -- CEW poll tables + submit helper functions

- WHAT: Creates the 6 CEW poll tables (`polls, poll_votes, ranking_polls, ranking_votes,
  wordcloud_polls, wordcloud_votes`) + RLS + the 3 `get_or_create_*` helper functions the poll-submit
  routes call before any vote insert.
- CONDITIONAL? Yes -- only if STEP 0 probe 1c OR 1c-2 shows anything missing AND you will demo CEW
  polls. A project can have all 6 tables (1c green) yet 500 on submit because a helper function is
  missing (1c-2). If you will NOT demo CEW polls, DEFER the whole surface (it fails in isolation).
- SQL: `DEMO_BLOCKER_RESOLUTION_KIT_2026_06_04.md` Remedy E -- paste it in FULL (tables + RLS +
  functions + grants in one block). It is extracted verbatim from `database_schema.sql` (tables
  920-995; functions get_or_create_poll 1189 / get_or_create_ranking_poll 1214 /
  get_or_create_wordcloud_poll_fixed 1240).
- IDEMPOTENT? Yes -- `CREATE TABLE IF NOT EXISTS`, DO-guarded policies, `CREATE OR REPLACE FUNCTION`.
- EXPECTED: 6 tables + 3 functions present.
- VERIFY:
  ```sql
  select t.table_name, to_regclass('public.' || t.table_name) is not null as present
  from (values ('polls'),('poll_votes'),('ranking_polls'),('ranking_votes'),
               ('wordcloud_polls'),('wordcloud_votes')) as t(table_name) order by t.table_name;
  select p.label, to_regprocedure(p.sig) is not null as present
  from (values
    ('get_or_create_poll','public.get_or_create_poll(text,integer,text,jsonb)'),
    ('get_or_create_ranking_poll','public.get_or_create_ranking_poll(text,integer,text,jsonb)'),
    ('get_or_create_wordcloud_poll_fixed','public.get_or_create_wordcloud_poll_fixed(character varying,integer,text,integer,integer)')
  ) as p(label,sig) order by p.label;
  ```
  Expect all `present = true`.
- NOTE: poll RESULTS views (`poll_results` 1051, `ranking_results` 1084, `wordcloud_results` 1122 in
  `database_schema.sql`) are NOT in this block; apply the matching `CREATE OR REPLACE VIEW` separately if
  a results page errors on a missing view. Seeding poll questions is a content step, not schema.
- ROLLBACK: `DROP TABLE IF EXISTS public.poll_votes, public.ranking_votes, public.wordcloud_votes, public.polls, public.ranking_polls, public.wordcloud_polls CASCADE;` plus `DROP FUNCTION IF EXISTS` for the 3 helpers. Only on a throwaway target -- this deletes votes.

### Batch 5 -- Catalog runtime tables (Evidence Library)

- WHAT: Creates the catalog-runtime tables the Evidence Library review/admin WRITE paths need:
  `promoted_parameter_values, catalog_extraction_staging, catalog_sources, catalog_evidence_items,
  source_lead_triage`. Reads degrade gracefully (helpers return []/{}), so a MISSING table shows empty,
  not a 500 -- but promote/review/add-evidence/add-source/triage/staging-approve WRITES fail until the
  table exists.
- CONDITIONAL? Yes -- only if STEP 0 probe 1m shows a given table `present=false`. Apply ONLY the
  subset 1m reports absent.
- SQL: copy these EXACT repo files, in this order, ONLY for tables 1m says are missing:
  1. `supabase/migrations/20260527000003_promoted_parameter_values.sql` (2166 bytes)
  2. `supabase/migrations/20260527000004_catalog_extraction_staging.sql` (12449 bytes)
  3. `supabase/migrations/20260527000006_catalog_sources.sql` (6706 bytes)
  4. `supabase/migrations/20260527000007_catalog_evidence_items.sql` (6541 bytes)
  5. `supabase/migrations/20260527000008_source_lead_triage.sql` (4913 bytes)
- IDEMPOTENT? NO. These five use PLAIN `CREATE TABLE public.<name> (` (NOT `IF NOT EXISTS`). Re-applying
  one where the table ALREADY exists ERRORs "relation already exists" and aborts the paste. Apply a
  table migration ONLY for a table 1m reports `present=false`.
- IMPORTANT -- `parameter_value_reviews`: 1m also probes this, but it has NO migration file anywhere on
  origin/main (it was applied directly via Supabase Studio). If 1m shows it absent there is NO named
  migration to apply -- DEFER: surface the 1m result and recover its shape via explore-before-assume
  before any CREATE. Do not invent it.
- EXPECTED: each applied table now present.
- VERIFY:
  ```sql
  select t.table_name, to_regclass('public.' || t.table_name) is not null as present
  from (values ('promoted_parameter_values'),('catalog_extraction_staging'),('catalog_sources'),
               ('catalog_evidence_items'),('source_lead_triage')) as t(table_name)
  order by t.table_name;
  ```
  Expect the applied ones `present = true`.
- ROLLBACK: `DROP TABLE IF EXISTS public.<name> CASCADE;` for any table you just created (throwaway
  target only).

### Batch 6 -- Catalog approve RPCs

- WHAT: Creates the staging-approve RPCs: `catalog_approve_staging_row` (single) and the bulk
  `catalog_approve_staging_rows_bulk` + its concurrency-guard replacement.
- CONDITIONAL? Yes -- apply if the Evidence Library staging-approve write path is in scope and Batch 5
  created `catalog_extraction_staging` (these RPCs depend on it). If the staging table already existed
  with these RPCs, re-applying simply refreshes them.
- SQL: copy these EXACT repo files, in order:
  1. `supabase/migrations/20260527000005_catalog_approve_staging_rpc.sql` (9708 bytes) -- single-row RPC;
     needs `catalog_extraction_staging` first.
  2. `supabase/migrations/20260530000001_catalog_approve_staging_rows_bulk.sql` (6703 bytes) -- bulk RPC.
  3. `supabase/migrations/20260602000001_catalog_approve_staging_rows_bulk_concurrency_guards.sql` --
     CREATE OR REPLACE of the bulk RPC with advisory-lock + supersede guards (the protected
     20260530000001 is NOT edited).
- IDEMPOTENT? Yes -- all three are `CREATE OR REPLACE FUNCTION` (signature/RETURNS/OWNER/grants
  preserved). Safe to re-run.
- EXPECTED: the approve RPCs present and refreshed to the guarded bodies.
- VERIFY:
  ```sql
  select routine_name from information_schema.routines
  where routine_schema = 'public'
    and routine_name in ('catalog_approve_staging_row','catalog_approve_staging_rows_bulk');
  ```
  Expect both names.
- ROLLBACK: `DROP FUNCTION IF EXISTS` the two RPC names (match the exact signatures from the files);
  throwaway target only.

### Batch 7 -- Storage bucket `documents`

- WHAT: Creates the Supabase Storage bucket `documents` the TWG upload route writes to BEFORE inserting
  the `review_files` row. No repo SQL creates it.
- CONDITIONAL? Yes -- only if STEP 0 probe 1i returns 0 rows AND you will demo file upload at
  `/twg/review`. If upload is not in the demo script, mark TWG uploads OUT-OF-DEMO-SCOPE (the save/submit
  path works without any bucket).
- SQL: `DEMO_BLOCKER_RESOLUTION_KIT_2026_06_04.md` Remedy F. Prefer the Dashboard UI (Storage -> New
  bucket -> `documents` -> leave PRIVATE -> Create). OR the SQL form:
  ```sql
  insert into storage.buckets (id, name, public)
  values ('documents', 'documents', false)
  on conflict (id) do nothing;
  ```
- IDEMPOTENT? Yes (`on conflict (id) do nothing`).
- EXPECTED: 1 bucket row.
- VERIFY: `select id, name, public from storage.buckets where id = 'documents';` Expect 1 row.
- STORAGE RLS CAVEAT: the repo defines NO `storage.objects` policies for this bucket. If uploads 500
  with a row-level-security error AFTER the bucket exists, add storage policies via the dashboard
  (Storage -> Policies -> `documents` -> allow authenticated INSERT and SELECT). This runbook does NOT
  author storage policies (none exist in the repo to copy; policy shape is an access-control decision).
- ROLLBACK: `delete from storage.buckets where id = 'documents';` (only when the bucket has no objects).

### Batch 8 -- Matrix-map Interactive Map RPC chain

- WHAT: Builds the full matrix_map schema + RLS/helpers + the fetch/measurement RPC chain that the
  Interactive Map tab and its Measurement Workbench right panel depend on.
- CONDITIONAL? Yes -- apply if STEP 0 probe 1e returns < 2 rows OR 1f returns 0 rows OR 1k reports
  ABSENT. RECOMMENDATION (from the kit): run the FULL 11-file chain whenever there is ANY doubt the
  post-creation fix bodies were applied -- 1e/1f only check RPC NAMES, not body freshness; re-applying is
  safe and refreshes the bodies.
- SQL: copy these EXACT repo files from `supabase/migrations/` IN THIS ORDER (RLS/helpers BEFORE RPCs):
  1. `20260519000001_matrix_map_schema.sql` (37262 bytes) -- 13 tables (schema first)
  2. `20260519000002_matrix_map_rls.sql` (46454 bytes) -- helper functions + RLS policies
  3. `20260520000001_matrix_map_fetch_samples_rpc.sql` (20406 bytes) -- fetch_samples_with_hidden_summary
  4. `20260520000003_matrix_map_security_hardening.sql` (14689 bytes) -- SELECT policies
  5. `20260520000004_matrix_map_jwt_via_current_setting.sql` (27464 bytes) -- JWT read fix
  6. `20260520000005_matrix_map_rpc_geography_cast.sql` (10214 bytes) -- geo cast fix
  7. `20260520000006_matrix_map_rpc_geometry_type_schema_qualify.sql` (9207 bytes) -- geometry-type fix
  8. `20260520000007_matrix_map_rpc_stxy_geography_avoid_extensions.sql` (9055 bytes) -- ST_X/ST_Y fix
  9. `20260521000001_matrix_map_lng_lat_columns.sql` (13052 bytes) -- lng/lat columns + trigger
  10. `20260521000002_matrix_map_admin_bypass_fetch_rpc.sql` (8448 bytes) -- admin-bypass fetch variant
  11. `20260521000003_matrix_map_fetch_measurements_rpc.sql` (6613 bytes) -- fetch_measurements_for_samples (RIGHT PANEL)
  (Total ~174 KB; the two largest files, 46.5 KB and 27.5 KB, are well under the paste limit -- no split
  required. Depends on the `postgis` extension being enabled.)
- IDEMPOTENT? Yes -- every file is idempotent or `CREATE OR REPLACE`; re-running the chain refreshes
  bodies.
- EXPECTED: after applying, probe 1e returns 2 rows and 1f returns 1 row.
- VERIFY: re-run STEP 0 probes 1e and 1f. If PostgREST still 404s the RPC from the app even though the
  function exists, confirm `matrix_map` is listed under Project Settings -> API -> "Exposed schemas"
  (a Studio toggle, not SQL).
- ROLLBACK: None safe in bulk (this is a 13-table schema + RPC chain). On a throwaway target:
  `DROP SCHEMA IF EXISTS matrix_map CASCADE;` -- this also discards any Path B data; do not run on a live
  project.

### Batch 9 -- matrix_reviews (code-derived; LIVE-VERIFY before running)

- WHAT: Creates `matrix_reviews` (Matrix Options "TWG Review" tab write target + `/admin/matrix-review`
  read).
- CONDITIONAL? Yes -- only if STEP 0 probe 1j returns `matrix_reviews_present = false`. If the Matrix
  Review surface is not in the demo script, DEFER (mark out-of-demo-scope) and skip.
- IMPORTANT -- READ BEFORE RUNNING: this is NOT a repo migration. NO `CREATE TABLE` for `matrix_reviews`
  exists anywhere in `database_schema.sql` or `supabase/migrations/` -- the security-audit migration
  `20260515_matrix_security_audit.sql:95-116` only ASSUMES it exists. The DDL in Remedy G is a
  code-derived reconstruction. The owner MUST verify the reconstructed column/RLS contract against the
  LIVE project AND confirm absence via 1j BEFORE running. If it already exists with a different shape,
  do NOT run -- reconcile by hand.
- SQL: `DEMO_BLOCKER_RESOLUTION_KIT_2026_06_04.md` Remedy G (the `== Remedy G: matrix_reviews ==` block;
  columns id/user_id/status/poll_data/comments_data/created_at/updated_at + UNIQUE(user_id) + RLS).
- IDEMPOTENT? Yes -- `CREATE TABLE IF NOT EXISTS`, DO-guarded constraint + policies.
- EXPECTED: `matrix_reviews` present.
- VERIFY: `select to_regclass('public.matrix_reviews') is not null as matrix_reviews_present;` Expect true.
- ROLLBACK: `DROP TABLE IF EXISTS public.matrix_reviews CASCADE;` (throwaway target only).

### Batch 10 -- document_tags (code-derived; LIVE-VERIFY before running)

- WHAT: Creates the `document_tags` JOIN table (TWG Documents page embed `document_tags(tags(...))` +
  documents-edit API tag write).
- CONDITIONAL? Yes -- only if STEP 0 probe 1l returns `document_tags_present = false`. If the TWG
  Documents tag surface is not in the demo script, DEFER and skip.
- IMPORTANT -- READ BEFORE RUNNING: same no-DDL class as Batch 9. NO `CREATE TABLE` for `document_tags`
  exists in the repo; Remedy H reconstructs it from the live column contract (`document_id` BIGINT FK ->
  documents, `tag_id` BIGINT FK -> tags, composite PK). Verify against the live project BEFORE running;
  if it exists with a different shape, reconcile by hand. Depends on Batch 1 (`documents`, `tags`).
- SQL: `DEMO_BLOCKER_RESOLUTION_KIT_2026_06_04.md` Remedy H (the `== Remedy H: document_tags ==` block).
- IDEMPOTENT? Yes -- `CREATE TABLE IF NOT EXISTS`, DO-guarded policies.
- EXPECTED: `document_tags` present.
- VERIFY: `select to_regclass('public.document_tags') is not null as document_tags_present;` Expect true.
- ROLLBACK: `DROP TABLE IF EXISTS public.document_tags CASCADE;` (throwaway target only).

### Batch 11a -- Matrix-map multi-media SCHEMA DELTA (apply BEFORE 11b)

- WHAT: Adds the three integer idempotency-key columns Path B's multi-medium INSERTs need to the live
  `matrix_map.measurements` table. The live schema (`20260519000001_matrix_map_schema.sql`) has only
  `bnrrm_chemistry_id integer UNIQUE` (sediment). Path B adds toxicity / community / env_modifier rows
  keyed on three NEW columns.
- CONDITIONAL? Yes -- only if you will demo the multi-media markers (toxicity / community) AND Batch 8
  has run (the `matrix_map` schema must exist first). The DATA in 11b REQUIRES this delta first -- a
  Path B paste without these columns fails ("column bnrrm_toxicity_id does not exist").
- SQL (inline guarded delta -- follows the existing `bnrrm_chemistry_id` pattern):
  ```sql
  -- Batch 11a: matrix_map.measurements multi-media idempotency keys. Idempotent; safe to re-run.
  ALTER TABLE matrix_map.measurements ADD COLUMN IF NOT EXISTS bnrrm_toxicity_id integer;
  ALTER TABLE matrix_map.measurements ADD COLUMN IF NOT EXISTS bnrrm_community_id integer;
  ALTER TABLE matrix_map.measurements ADD COLUMN IF NOT EXISTS bnrrm_env_modifier_id integer;
  -- bnrrm_toxicity_id: standalone UNIQUE (ON CONFLICT (bnrrm_toxicity_id) DO NOTHING)
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
  -- bnrrm_env_modifier_id: standalone UNIQUE (ON CONFLICT (bnrrm_env_modifier_id) DO NOTHING)
  DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint
      WHERE conname='measurements_bnrrm_env_modifier_id_key'
        AND conrelid='matrix_map.measurements'::regclass) THEN
      ALTER TABLE matrix_map.measurements
        ADD CONSTRAINT measurements_bnrrm_env_modifier_id_key UNIQUE (bnrrm_env_modifier_id);
    END IF;
  END $$;
  ```
- ENUM HAZARD -- LIVE-VERIFY BEFORE 11b: the live `measurements.medium` CHECK is
  `IN ('sediment','water','tissue','toxicity','community')` -- it does NOT include `env_modifier`. The
  Path B input names `env_modifier` as a third new medium (~25 rows) but its own notes say "Path B uses
  sediment/toxicity/community only", and a direct scan of the Path B file confirms toxicity/community are
  present. Whether any `env_modifier` rows are actually emitted is AMBIGUOUS in the inputs. If Path B
  DOES insert `medium = 'env_modifier'` and the CHECK lacks it, those INSERTs will FAIL the constraint.
  BEFORE running 11b: confirm which `medium` literals Path B emits, and if `env_modifier` appears, the
  owner must extend the enum (a deliberate schema decision, surfaced not assumed):
  ```sql
  -- ONLY if Path B emits medium='env_modifier' AND it is in scope. Verify first; do not assume.
  -- ALTER TABLE matrix_map.measurements DROP CONSTRAINT measurements_medium_check;
  -- ALTER TABLE matrix_map.measurements ADD CONSTRAINT measurements_medium_check
  --   CHECK (medium IN ('sediment','water','tissue','toxicity','community','env_modifier'));
  ```
- IDEMPOTENT? Yes -- `ADD COLUMN IF NOT EXISTS` + DO-guarded constraints.
- EXPECTED: three new columns + their UNIQUE constraints on `matrix_map.measurements`.
- VERIFY:
  ```sql
  select column_name from information_schema.columns
  where table_schema='matrix_map' and table_name='measurements'
    and column_name in ('bnrrm_toxicity_id','bnrrm_community_id','bnrrm_env_modifier_id')
  order by column_name;
  ```
  Expect 3 rows.
- ROLLBACK: `ALTER TABLE matrix_map.measurements DROP COLUMN IF EXISTS bnrrm_toxicity_id, DROP COLUMN IF EXISTS bnrrm_community_id, DROP COLUMN IF EXISTS bnrrm_env_modifier_id;` (drops dependent constraints via CASCADE only if you add CASCADE; review first).

### Batch 11b -- Path B DATA paste (pre-split; needs 11a + Batch 8 first)

- WHAT: Loads the BN-RRM multi-medium measurement data into `matrix_map` (substances, samples,
  sample_events, measurements across sediment + toxicity + community).
- CONDITIONAL? Yes -- apply if STEP 0 probe 1k shows `matrix_map.measurements` at 0 rows (or only
  sediment) and you want markers on the Interactive Map. PRECONDITIONS: Batch 8 (schema/RPC chain) AND
  Batch 11a (the 3 idempotency columns) MUST be applied first.
- REGEN? NOT NEEDED. Path B is a FINALIZED SQL monolith with computed values
  (`scripts/matrix-map/etl_bnrrm_to_supabase_output_v1_1_0_multimedium_PATH_B.sql`, 6.03 MB, 9521 lines,
  generated by `etl_bnrrm_to_supabase.py v1.1.0`). No Python re-generation. Every INSERT is
  `... ON CONFLICT (<key>) DO NOTHING`, so the paste is idempotent.
- SIZE / SPLIT: 6.03 MB FAR exceeds the ~1 MB Studio paste limit -- DO NOT paste it whole. PRE-SPLIT it
  into ~700 KB chunks at statement boundaries, then paste the chunks IN NUMBERED ORDER (the file keeps
  FK-safe statement order: substances -> samples -> sample_events -> measurements, so chunk order MUST be
  preserved).
  - Helper: `scripts/matrix-map/split_etl_output.py` produces chunks under
    `scripts/matrix-map/etl_output_chunks/NN_<purpose>.sql`, wraps each in its own BEGIN/COMMIT +
    `SET LOCAL search_path = matrix_map, public, extensions`, preserves the header, targets ~700 KB,
    splits only at `;` boundaries.
  - GOTCHA: that splitter's `SOURCE` is hard-coded to `etl_bnrrm_to_supabase_output.sql` (the v1.0.0
    single-medium file), NOT the Path B multi-medium file. To split Path B, point the splitter's SOURCE
    at the Path B file first (edit the `SOURCE = ...` line, or copy Path B to
    `etl_bnrrm_to_supabase_output.sql`), then run it with the repo `.venv` if present
    (`.venv/Scripts/python.exe scripts/matrix-map/split_etl_output.py`). Confirm the emitted chunk count
    and that the LAST chunk ends cleanly on a `;` before pasting. (This split is a local prep step, not a
    Studio paste.)
- IDEMPOTENT? Yes -- all INSERTs `ON CONFLICT DO NOTHING`; re-pasting any chunk is safe.
- EXPECTED: 8675 total measurements (8166 sediment + 504 toxicity + 10 community + ~25 env_modifier per
  the input; the input's own breakdown also lists 8705 -- treat 8675 as the headline target and the
  variance as TBD to reconcile against the actual by-medium counts below). The Path B file contains 8675
  measurement INSERT statements (confirmed by an exact count of `ON CONFLICT (bnrrm_*_id` lines).
- VERIFY (by medium):
  ```sql
  select medium, count(*) from matrix_map.measurements group by medium order by medium;
  select count(*) as total_measurements from matrix_map.measurements;
  ```
  Expect total ~8675; sediment ~8166, toxicity ~504, community ~10 (env_modifier ~25 only if those rows
  were emitted and the enum was extended in 11a).
- ROLLBACK: `DELETE FROM matrix_map.measurements WHERE medium <> 'sediment';` (preserves the 290-sample
  / sediment baseline; removes only the multi-media rows this batch added).

---

## DEFERRED / OWNER-JUDGMENT (do NOT auto-run)

These are deliberately NOT batched above. Each is owner-gated or carries a named hazard.

1. ECO PASSES (catalog eco-soil / Eco-SSL staging). The prior eco staging SQL was generated to
   `.tmp/catalog-paste/` (gitignored, local-only): `d0c00010` (60 EPA Eco-SSL) + `d0c00005` (2305 P28
   eco-soil), both `catalog_extraction_staging` INSERTs (needs_review, never-promote). HAZARD: these are
   HITL-gated catalog data the owner pastes from disk at the desktop, then HITL-samples; AI never
   promotes. Eco-soil / Eco-SSL are TERRESTRIAL evidence categories, NOT sediment calc pathways -- scope
   is an OWNER decision. Do NOT auto-run; surface to owner.

2. RESET VOTES -- `create_vote_backup` (`/admin/reset-votes`). NO probe, NO remedy, BY DESIGN. The route
   calls `rpc('create_vote_backup')`, a FUNCTION with ZERO DDL anywhere in the repo (only the single call
   site on origin/main). HAZARDS: (a) the function body would have to be reverse-engineered with no repo
   source -- out of reconstruction scope; (b) the same page exposes PERMANENT vote deletion
   (`poll_votes`/`ranking_votes` `.delete()`) -- destructive. RECOMMENDATION: mark the route
   out-of-demo-scope; do not open or click it during a demo. If backup capability is ever needed, recover
   the function via explore-before-assume -- this runbook authors no reconstructed function.

3. ENGINE-V2 base schema / Remedy A (`applicable_policy_ids` column). If STEP 0 probe 1a shows
   `v2_projects_present = false`, the engine-v2 BASE schema is absent -- Remedy A's `ALTER TABLE
   v2_projects ADD COLUMN` would error. Applying the full engine-v2 base (sources under
   `supabase/engine_v2/`) is a SEPARATE owner decision, OUT OF KIT SCOPE. Even Remedy A itself
   (`supabase/migrations/20260604_v2_projects_applicable_policy_ids.sql`) is owner-provided and not yet
   in the repo. Surface the 1a result to the owner; do not auto-apply.

4. `parameter_value_reviews` (if 1m shows it absent). NO migration file on origin/main (Studio-applied
   class). Do NOT attempt a CREATE -- recover its shape via explore-before-assume before any DDL.

5. `review_submissions` status CHECK reconciliation (if 1d returns 0 rows on a present table). Do NOT
   DROP the constraint -- reconcile by hand and surface to the owner.
