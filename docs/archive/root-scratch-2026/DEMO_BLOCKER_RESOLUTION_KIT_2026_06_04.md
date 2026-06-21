# Demo-blocker resolution kit -- SSTAC Dashboard -- 2026-06-04/05

Plain ASCII. Companion to `WHOLE_APP_READINESS_REPORT_2026_06_04.md`. This is OWNER-RUN: it leads
with READ-ONLY exploratory SQL (per the Supabase explore-before-assume protocol -- verify before
you create), then gives conditional remedies. The remedies point ONLY at files already in the repo
(`database_schema.sql`, the `supabase/migrations/` chain) -- EXCEPT Remedies G (`matrix_reviews`)
and H (`document_tags`), which are RECONSTRUCTED FROM LIVE CODE because NO `CREATE TABLE` DDL for
those two JOIN/app tables exists anywhere in `database_schema.sql` or `supabase/migrations/` on
origin/main (rev6 2026-06-05 per codex Leg-2 round 5). I author no new schema for any repo-backed
remedy and apply nothing (Supabase MCP is dead; AI never pastes). The repo-backed remedies are safe
to run in Supabase Studio SQL Editor. Remedies G and H are the only DDL in this kit NOT traceable to
an approved repo source: each carries an "IMPORTANT -- READ BEFORE RUNNING" caveat (the column/RLS
contract is code-derived, not a repo source), and the owner MUST verify the reconstructed contract
against the LIVE project (and confirm the table is truly absent via probe 1j/1l) BEFORE running them,
since applying a reconstruction would mutate production schema from a code inference rather than an
approved migration. See the Remedy G/H caveats for the cross-reference.

KEY SIMPLIFICATION (verified 2026-06-05): MOST surfaces flagged as demo-blockers (admin pages, TWG
review) depend on tables that live in ONE authoritative file already in the repo:
`database_schema.sql` (root). It defines `user_roles, tags, documents, announcements, milestones,
discussions, discussion_replies, review_submissions, review_files, likes` + their RLS + views, all
with `CREATE TABLE IF NOT EXISTS` (safe to re-run). These tables are NOT in `supabase/migrations/`,
so they were never auto-applied -- but they were almost certainly applied manually long ago (the
public dashboard renders announcements/milestones today). For those, the demo-blocker question
reduces to: "is `database_schema.sql` applied to the TARGET project, and is the engine-v2 migration
applied?"

CAVEAT (rev4 2026-06-05 per codex Leg-2 round 4): this "one file" simplification is NOT total. The
round-4 audit (see the DEMO-SURFACE DEPENDENCY MATRIX appendix, the coverage authority) found four
dependencies that the single-file framing missed: the CEW poll-submit HELPER FUNCTIONS (in
database_schema.sql but as functions, not tables -- a tables-only fix leaves submits 500ing), the
`matrix_reviews` table (NO DDL anywhere in the repo -- one of two app tables with no CREATE source;
the other is the `document_tags` JOIN table, added rev5 2026-06-05 per Opus matrix verify), a
PARTIALLY-repaired `review_files` (live columns present but legacy NOT NULLs still fatal), and empty
`matrix_map` DATA despite live RPCs (rows come from an owner-run ETL, not migrations). The probes and
remedies below now cover all of these. The SQL below answers the full question in one read-only paste.

---

## STEP 1 -- Pre-flight (READ-ONLY; paste into Supabase Studio against the TARGET project) (rev 2026-06-05 per codex Leg-2)

Every probe below is safe to run even when the objects are ABSENT: existence is checked with
`to_regclass(...)` / `to_regprocedure(...)` (both return NULL instead of erroring on a missing
relation/function) and the only count (`user_roles`) is guarded so it does not error when that table
does not exist. Paste the ENTIRE first fenced SQL block (probes 1a-1f plus 1c-2, 1h, 1i, 1j, 1k,
and 1l -- the rev3 column-contract + storage-bucket probes, the rev4 poll-function + matrix_reviews
+ legacy-NOT-NULL + matrix_map-data probes, the rev5 document_tags probe, the rev8 Matrix Options
catalog-runtime probe 1m, and the rev9 Admin Users role-RPC probe 1n) as one read-only batch
(rev6 2026-06-05 per codex Leg-2 round 5: the earlier
prose stopped at `1j` and omitted `1l`; rev8 2026-06-05 per codex Leg-2 round 7 adds `1m`; rev9
2026-06-05 per codex Leg-2 round 8 adds `1n`; paste
through `1n`, now the last probe in the block, or the Evidence Library catalog-runtime dependencies
and the Admin Users role-RPC dependency stay undetected);
then run the OPTIONAL count block (1g) only for tables 1b reported as present. Probe 1k (matrix_map
DATA counts) is a read-only DO block that emits its result via RAISE NOTICE (read the Studio
"Messages" pane); it is parse-safe and never errors on a fresh project. (Probes 1c-2/1h/1i/1j/1k/1l are
read-only: `to_regprocedure`, `information_schema.columns`, the `storage.buckets` catalog table,
`to_regclass`, and a dynamic-SQL count guarded by `to_regclass`; all return rows-or-zero / NULL /
NOTICE on a fresh project without erroring.)

```sql
-- 1a. Engine-v2 base table present at all? (rev2 2026-06-05 per codex Leg-2 round 2)
--     to_regclass returns NULL when v2_projects does not exist (no error). This DISAMBIGUATES the
--     "0 rows" case in 1a-2 below: a fresh project with NO v2_projects table returns the SAME 0-row
--     result as "table present but applicable_policy_ids column missing", and those need DIFFERENT
--     remedies (see INTERPRETATION 1a). Run this FIRST.
select to_regclass('public.v2_projects') is not null as v2_projects_present;

-- 1a-2. Engine-v2 M1a Phase 2 column present? (blocks /dashboard/engine-v2/[projectId] if code
--     deployed without it). 0 rows = column NOT present. Safe if v2_projects itself is absent
--     (information_schema just returns 0 rows). Interpret TOGETHER with 1a's present flag.
select column_name, data_type, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name   = 'v2_projects'
  and column_name  = 'applicable_policy_ids';

-- 1b. App tables present? (admin pages + TWG review). One row per table, present=true/false.
--     to_regclass returns NULL when the relation does not exist (no error).
select t.table_name,
       to_regclass('public.' || t.table_name) is not null as present
from (values
  ('user_roles'),('tags'),('documents'),('announcements'),('milestones'),
  ('discussions'),('discussion_replies'),('review_submissions'),('review_files'),('likes')
) as t(table_name)
order by t.table_name;

-- 1c. CEW poll tables present? (CEW polls + admin poll surfaces). Same present=true/false shape.
--     These live ONLY in database_schema.sql (920-995), NOT under supabase/migrations/.
select t.table_name,
       to_regclass('public.' || t.table_name) is not null as present
from (values
  ('polls'),('poll_votes'),('ranking_polls'),('ranking_votes'),
  ('wordcloud_polls'),('wordcloud_votes')
) as t(table_name)
order by t.table_name;

-- 1c-2. CEW poll HELPER FUNCTIONS present? (rev4 2026-06-05 per codex Leg-2 round 4).
--     The three poll-submit routes do NOT insert into the poll tables directly: each calls a
--     get_or_create_* RPC first (origin/main src/app/api/polls/submit/route.ts:27,
--     ranking-polls/submit/route.ts:39, wordcloud-polls/submit/route.ts:82). Those helper
--     functions live ONLY in database_schema.sql (1189/1214/1240), NOT under supabase/migrations/,
--     so a project can have all SIX poll TABLES present (1c green) and STILL 500 every poll submit
--     because the RPC is missing. to_regprocedure returns NULL (no error) when the function with
--     that exact signature is absent. Read-only.
select p.label,
       to_regprocedure(p.sig) is not null as present
from (values
  ('get_or_create_poll',                 'public.get_or_create_poll(text,integer,text,jsonb)'),
  ('get_or_create_ranking_poll',         'public.get_or_create_ranking_poll(text,integer,text,jsonb)'),
  ('get_or_create_wordcloud_poll_fixed', 'public.get_or_create_wordcloud_poll_fixed(character varying,integer,text,integer,integer)')
) as p(label, sig)
order by p.label;

-- 1d. review_submissions status CHECK constraint correct? Verifies the actual CHECK definition,
--     not just that a status column exists. Expect a row whose definition references
--     'IN_PROGRESS' and 'SUBMITTED'. No row = constraint missing/renamed -> reconcile by hand.
select con.conname, pg_get_constraintdef(con.oid) as definition
from pg_constraint con
join pg_class rel on rel.oid = con.conrelid
join pg_namespace nsp on nsp.oid = rel.relnamespace
where nsp.nspname = 'public'
  and rel.relname = 'review_submissions'
  and con.contype = 'c'
  and pg_get_constraintdef(con.oid) ilike '%status%';

-- 1e. Matrix-options Interactive Map RPC present? (Interactive Map tab for authed users).
--     Returns 0 rows if the matrix_map schema is absent (no error).
select routine_name
from information_schema.routines
where routine_schema = 'matrix_map'
  and routine_name in ('fetch_samples_with_hidden_summary','is_email_allowlisted');

-- 1f. Matrix Map right-panel measurement RPC present? (Measurement Workbench right panel calls
--     fetch_measurements_for_samples from migration 20260521000003). 0 rows = panel will fail.
select routine_name
from information_schema.routines
where routine_schema = 'matrix_map'
  and routine_name = 'fetch_measurements_for_samples';

-- 1k. Matrix Map DATA present? (rev4 2026-06-05 per codex Leg-2 round 4).
--     Schema + RPC presence (1e/1f) does NOT mean the map has markers: matrix_map.samples /
--     matrix_map.measurements rows are loaded by scripts/matrix-map/etl_bnrrm_to_supabase.py
--     (INSERT INTO matrix_map.samples at line 613), NOT by any migration -- there is no
--     INSERT INTO matrix_map.samples under supabase/migrations/. So 1e/1f can BOTH pass on a fresh
--     project while the Interactive Map renders zero markers.
--     PARSE-SAFE NOTE: a plain `select count(*) from matrix_map.samples` would fail to PARSE on a
--     fresh project where the table is absent (Postgres resolves relations at parse time, so even a
--     to_regclass-guarded CASE around a STATIC subquery still errors). This DO block uses DYNAMIC
--     SQL (EXECUTE format) so the count query is only compiled when to_regclass confirms the table
--     exists; otherwise it RAISES NOTICE 'absent'. It is strictly read-only (SELECT count only) and
--     never errors when the schema/table is absent. Read the NOTICE output (Studio "Messages" pane).
--     Schema-qualified names verified vs 20260519000001_matrix_map_schema.sql
--     (CREATE TABLE matrix_map.samples L158, matrix_map.measurements L354).
DO $$
DECLARE
  t text;
  n bigint;
BEGIN
  FOREACH t IN ARRAY ARRAY['matrix_map.samples','matrix_map.measurements'] LOOP
    IF to_regclass(t) IS NULL THEN
      RAISE NOTICE '1k % : ABSENT (schema/table not present)', t;
    ELSE
      EXECUTE format('select count(*) from %s', t) INTO n;
      RAISE NOTICE '1k % : % row(s)', t, n;
    END IF;
  END LOOP;
END $$;

-- 1h. COLUMN CONTRACT for the two DRIFTED tables (rev3 2026-06-05 per codex Leg-2 round 3).
--     Presence alone (1b) is NOT enough for `documents` and `review_files`: on a long-running
--     project where database_schema.sql was applied BEFORE the current code, those tables are
--     PRESENT but carry the STALE schema-doc columns, while origin/main writes DIFFERENT columns:
--       documents     live insert -> user_id, user_email (src/app/(dashboard)/twg/documents/actions.ts:69-76)
--       review_files  live insert -> filename, mimetype, file_size (+ admin SELECT aliases uploaded_at)
--                                    (src/app/api/review/upload/route.ts:105-111)
--     This block is read-only (information_schema.columns only). For each live-required column it
--     reports present=true/false; ANY false on a table that 1b shows PRESENT = present-but-STALE
--     -> route that table to Remedy B's defensive ALTER/relax section (do NOT clear it). All
--     live-required columns present = current -> that table is clear.
--     rev4 2026-06-05 per codex Leg-2 round 4: presence of the LIVE columns alone is STILL not a
--     clear-to-skip signal for review_files. A project can be PARTIALLY repaired -- the live
--     filename/mimetype/file_size/uploaded_at columns added, but the LEGACY file_name/mime_type
--     columns still NOT NULL with no default. The upload route inserts only filename/mimetype/
--     file_size/file_path (route.ts:105-111) and never supplies file_name/mime_type, so those
--     legacy NOT NULL constraints make /api/review/upload 500 even with every live column present.
--     The extra rows below report each legacy column as check='legacy_not_null', present=true ONLY
--     when that column EXISTS AND is currently NOT NULL (is_nullable='NO') -- i.e. present=true here
--     means STILL-FATAL, route to Remedy B's NOT-NULL-relax block. present=false = absent or already
--     relaxed = fine.
select 'documents' as table_name, 'live_col:' || c.column_name as check_name,
       (information_schema_present.column_name is not null) as present
from (values ('user_id'),('user_email')) as c(column_name)
left join information_schema.columns information_schema_present
  on information_schema_present.table_schema = 'public'
 and information_schema_present.table_name   = 'documents'
 and information_schema_present.column_name  = c.column_name
union all
select 'review_files' as table_name, 'live_col:' || c.column_name as check_name,
       (information_schema_present.column_name is not null) as present
from (values ('filename'),('mimetype'),('file_size'),('uploaded_at')) as c(column_name)
left join information_schema.columns information_schema_present
  on information_schema_present.table_schema = 'public'
 and information_schema_present.table_name   = 'review_files'
 and information_schema_present.column_name  = c.column_name
union all
-- Legacy NOT-NULL audit (rev4): present=true means the legacy column EXISTS and is STILL NOT NULL
-- (fatal to the live insert) -> route review_files to Remedy B's NOT-NULL-relax block.
select 'review_files' as table_name, 'legacy_not_null:' || c.column_name as check_name,
       (exists (
          select 1 from information_schema.columns col
          where col.table_schema = 'public'
            and col.table_name   = 'review_files'
            and col.column_name  = c.column_name
            and col.is_nullable  = 'NO'
       )) as present
from (values ('file_name'),('mime_type')) as c(column_name)
order by table_name, check_name;

-- 1i. Storage bucket for TWG uploads present? (rev3 2026-06-05 per codex Leg-2 round 3).
--     The upload route writes the file to Supabase Storage bucket id 'documents'
--     (src/app/api/review/upload/route.ts:97: supabase.storage.from('documents')) BEFORE inserting
--     the review_files row, and NO repo SQL/migration creates this bucket or its storage policies.
--     0 rows = bucket missing -> /api/review/upload 500s even when every table+column is correct.
--     Read-only (storage.buckets is a catalog table).
select id, name, public
from storage.buckets
where id = 'documents';

-- 1j. matrix_reviews table present? (rev4 2026-06-05 per codex Leg-2 round 4).
--     The Matrix Options "TWG Review" tab writes this table (origin/main
--     src/components/TWGReviewPortal.tsx:162,178,182) and /admin/matrix-review reads it
--     (src/app/(dashboard)/admin/matrix-review/page.tsx:41). UNLIKE every other app table, there is
--     NO CREATE TABLE for matrix_reviews anywhere in database_schema.sql OR supabase/migrations/ on
--     origin/main -- the security-audit migration 20260515_matrix_security_audit.sql:95-116 only
--     ASSUMES it already exists (it DELETEs dupes + adds UNIQUE(user_id)). So this table can be
--     silently absent on a fresh project and the other probes would never catch it. to_regclass
--     returns NULL (no error) when absent. Read-only.
select to_regclass('public.matrix_reviews') is not null as matrix_reviews_present;

-- 1l. document_tags JOIN table present? (rev5 2026-06-05 per Opus matrix verify).
--     The TWG documents page reads it via a PostgREST embed -- document_tags(tags(...)) -- on
--     origin/main src/app/(dashboard)/twg/documents/page.tsx:49, and the documents API writes it:
--     DELETE then INSERT { document_id, tag_id } in src/app/api/documents/[id]/route.ts:82,94 (also
--     src/lib/db/queries.ts:106 deleteTag cascade + :316 createDocumentTag). Columns confirmed in
--     code: document_id + tag_id. UNLIKE the eight non-drifted app tables, there is NO CREATE TABLE
--     for document_tags anywhere in database_schema.sql OR supabase/migrations/ on origin/main -- it
--     is the SAME no-DDL class as matrix_reviews (1j). The 1b loop does NOT probe it, so it can be
--     silently absent on a fresh project. to_regclass returns NULL (no error) when absent. Read-only.
select to_regclass('public.document_tags') is not null as document_tags_present;

-- 1m. Matrix Options EVIDENCE LIBRARY / catalog runtime tables present? (rev8 2026-06-05 per codex
--     Leg-2 round 7). The MO calculator happy path is static-JSON only, BUT the Evidence Library
--     review/admin runtime reads AND writes Supabase catalog tables on origin/main:
--       promoted_parameter_values  hydrate on mount + promote-write
--                                  (EvidenceLibrary.tsx:3149 hydrateFromSupabase();
--                                   promotedCandidatesStore.ts:177-180 hydrateFromSupabase ->
--                                   supabase-sync.ts:123-128 fetchPromotedValues .from('promoted_parameter_values'))
--       parameter_value_reviews    qa-review-sync.ts:115/145 (.from('parameter_value_reviews'))
--       catalog_evidence_items     evidence-sync.ts:139/169/222 (.from('catalog_evidence_items'))
--       catalog_sources            source-sync.ts:245/278/330 (.from('catalog_sources'))
--       source_lead_triage         triage-sync.ts:83/171 (.from('source_lead_triage'))
--       catalog_extraction_staging admin Catalog Staging Review (staging.ts:250/443/509;
--                                   listPendingStagingRows .from('catalog_extraction_staging'))
--     Each helper degrades gracefully on a missing table (fetch* returns []/{}), so a MISSING table
--     does NOT 500 the read path -- the Evidence Library just shows no promoted/review/evidence/source
--     rows -- but the WRITE paths (promote, submit review, add evidence/source, triage, staging
--     approve) FAIL until the table exists. to_regclass returns NULL (no error) when absent. Read-only.
select t.table_name,
       to_regclass('public.' || t.table_name) is not null as present
from (values
  ('promoted_parameter_values'),('parameter_value_reviews'),('catalog_evidence_items'),
  ('catalog_sources'),('source_lead_triage'),('catalog_extraction_staging')
) as t(table_name)
order by t.table_name;

-- 1n. Admin -> Users role-change RPCs present? (rev9 2026-06-05 per codex Leg-2 round 8).
--     The Admin Users page does NOT write user_roles directly: it calls the manage_user_role_*
--     RPCs (origin/main src/app/(dashboard)/admin/users/actions.ts:454 manage_user_role_delete,
--     :464 + :527 manage_user_role_insert). Those functions are defined in
--     supabase/migrations/20260527000001_user_roles_rpcs.sql (CREATE OR REPLACE FUNCTION
--     public.manage_user_role_insert at :11, public.manage_user_role_delete at :56). A target
--     with the user_roles TABLE present (1b green) but that migration NOT applied passes the kit
--     today yet the role add/remove buttons 500. to_regprocedure returns NULL (no error) when the
--     function with that exact signature is absent. Read-only.
select p.label,
       to_regprocedure(p.sig) is not null as present
from (values
  ('manage_user_role_insert', 'public.manage_user_role_insert(uuid,text)'),
  ('manage_user_role_delete', 'public.manage_user_role_delete(uuid,text)')
) as p(label, sig)
order by p.label;
```

OPTIONAL count block (1g) -- run ONLY after 1b confirms `user_roles` is present, so it never errors
on a fresh project:

```sql
-- 1g. At least one admin user exists? (gates /admin). Expect >= 1. Run only if 1b shows
--     user_roles present.
select count(*) as admin_count
from public.user_roles
where role = 'admin';
```

INTERPRETATION:
- 1a + 1a-2 together (rev2 2026-06-05 per codex Leg-2 round 2) -- read BOTH before routing:
  - 1a `v2_projects_present` = true  AND 1a-2 returns 0 rows -> base table exists but the
                              applicable_policy_ids COLUMN is missing -> Remedy A (the idempotent
                              ALTER ... ADD COLUMN can run; v2_projects already exists).
  - 1a `v2_projects_present` = true  AND 1a-2 returns 1 row  -> column already applied -> nothing to do.
  - 1a `v2_projects_present` = false (1a-2 will also be 0 rows) -> the engine-v2 BASE SCHEMA itself is
                              absent on this project. Remedy A does NOT apply: its `ALTER TABLE
                              v2_projects ADD COLUMN ...` would error "relation v2_projects does not
                              exist". This is OWNER-GATED and OUT OF KIT SCOPE: applying the full
                              engine-v2 base schema is a separate decision (sources under
                              `supabase/engine_v2/` -- e.g. database_schema_engine_v2_patch.sql, which
                              itself CREATEs v2_projects WITH applicable_policy_ids and has a
                              clean-slate EXIT GATE; plus the lane2a/lane2b patches). Do NOT auto-apply
                              it from this kit; surface to me with the 1a result so we decide whether
                              engine-v2 is even in scope for this demo target.
- 1b any present=false      -> that app table is missing -> see Remedy B (paste the guarded block).
- 1b present=true for `documents` / `review_files` is NOT a clear-to-skip signal on its own (rev3
                              2026-06-05 per codex Leg-2 round 3): those two tables drifted, so a
                              present=true table can still be STALE. READ 1h before deciding. (The
                              earlier "present=true => do not run Remedy B" shortcut does NOT apply to
                              these two -- it only ever applied to the eight non-drifted tables.)
- 1h (rev3; clear-condition tightened rev4 2026-06-05 per codex Leg-2 round 4) per drifted table.
  The rows are keyed by check_name: `live_col:<col>` (live column present?) and, for review_files,
  `legacy_not_null:<col>` (legacy column STILL NOT NULL?). A review_files table is CURRENT only when
  ALL `live_col:` rows are present=true AND BOTH `legacy_not_null:` rows are present=false:
  - all `live_col:` present=true AND (review_files) both `legacy_not_null:` present=false -> table is
                              CURRENT -> clear (no Remedy B needed for it).
  - any `live_col:` present=false AND 1b shows the table PRESENT -> present-but-STALE -> run Remedy B's
                              block for that table: its `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` adds
                              the live columns, and (review_files only) the NOT-NULL-relax block clears
                              the legacy fatal constraints. The presence-only check would have wrongly
                              cleared this.
  - (review_files only, rev4) any `legacy_not_null:` present=true EVEN IF all `live_col:` are present
                              -> PARTIALLY-REPAIRED-but-STILL-FATAL: the live insert still violates the
                              legacy NOT NULL constraint -> route review_files to Remedy B's NOT-NULL-
                              relax block (the `live_col` ADDs are no-ops; the relax DO-blocks do the
                              work). This is the exact false-clear case round 4 closes -- a table that
                              passes presence AND the live-column check can STILL 500 on upload.
  - table ABSENT in 1b (1h `live_col:` rows all present=false because the table does not exist; the
                              `legacy_not_null:` rows are present=false because the column does not
                              exist) -> just create it via Remedy B (the CREATE TABLE uses the live
                              contract; no legacy columns are created, so nothing to relax).
- 1i (rev3) returns 0 rows  -> the `documents` storage bucket is missing -> /api/review/upload will
                              500 even when 1b/1h are all green. Either create the bucket (Remedy F)
                              OR mark TWG uploads out-of-demo-scope. 1 row = bucket present -> clear.
- 1j (rev4 2026-06-05 per codex Leg-2 round 4) `matrix_reviews_present = false` -> the Matrix Options
                              "TWG Review" tab + /admin/matrix-review will 500 (no such relation). NO
                              DDL for this table exists in the repo, so this is one of two app tables the
                              kit must CREATE from a code-derived contract (the other is document_tags,
                              1l) -> see Remedy G (read its caveat). `true` -> table present -> clear. If
                              the Matrix Review surface is not in the demo script, you may DEFER it
                              instead of running Remedy G.
- 1l (rev5 2026-06-05 per Opus matrix verify) `document_tags_present = false` -> the TWG Documents page
                              (/twg/documents) PostgREST embed `document_tags(tags(...))` will fail and
                              the documents-edit API tag write (DELETE+INSERT on document_tags) will 500
                              (no such relation). Like matrix_reviews (1j), NO DDL for this JOIN table
                              exists in the repo, so the kit must CREATE it from a code-derived contract
                              -> see Remedy H (read its caveat). `true` -> table present -> clear. If the
                              TWG Documents tag surface is not in the demo script, you may DEFER it
                              instead of running Remedy H.
- 1m (rev8 2026-06-05 per codex Leg-2 round 7) any present=false -> that Matrix Options catalog table
                              is missing. The MO CALCULATOR happy path does NOT need these (static JSON),
                              so a demo limited to running the calculators is unaffected. But the EVIDENCE
                              LIBRARY review/admin workflows (promote a value, submit a qa-review, add an
                              evidence item or source, triage a source-lead, approve a staging row) WRITE
                              these tables and will FAIL the write until the table exists (reads degrade
                              gracefully -- the helpers return []/{} -- so the surface shows empty, not a
                              500). If those workflows are in the demo script, apply the REPO-BACKED catalog
                              migrations for whichever tables 1m reports absent, IN THIS ORDER (each is a
                              committed file under `supabase/migrations/`, so this is a normal migration
                              apply, NOT a code-derived reconstruction like Remedy G/H):
                                1. `20260527000003_promoted_parameter_values.sql`  (promoted_parameter_values)
                                2. `20260527000004_catalog_extraction_staging.sql` (catalog_extraction_staging)
                                3. `20260527000005_catalog_approve_staging_rpc.sql` (catalog_approve_staging_row RPC; needs staging table first)
                                4. `20260527000006_catalog_sources.sql`            (catalog_sources)
                                5. `20260527000007_catalog_evidence_items.sql`     (catalog_evidence_items)
                                6. `20260527000008_source_lead_triage.sql`         (source_lead_triage)
                                7. `20260530000001_catalog_approve_staging_rows_bulk.sql` then
                                   `20260602000001_catalog_approve_staging_rows_bulk_concurrency_guards.sql` (bulk RPC + guards)
                              IDEMPOTENCY CAVEAT (verified rev8 against origin/main): the five catalog
                              CREATE TABLE migrations (003/004/006/007/008) use PLAIN `CREATE TABLE
                              public.<name> (` -- NOT `CREATE TABLE IF NOT EXISTS` -- so re-applying one on
                              a project where that table ALREADY exists will ERROR "relation already
                              exists" and abort the paste. Apply a table migration ONLY for a table 1m
                              reports present=false. (The RPC migrations 005/001/the-guards use `CREATE OR
                              REPLACE FUNCTION` and ARE safe to re-run.) SEPARATE CAVEAT: `parameter_value_reviews`
                              has NO migration file anywhere on origin/main -- it was applied directly via
                              Supabase Studio (same Studio-applied class noted in
                              STREAM_D_HITL_PAUSE_SQL_EXPLORE_2026_05_27.md) -- so if 1m shows it absent
                              there is no named migration to apply; surface to me with the 1m result and we
                              recover its shape via the explore-before-assume protocol before any CREATE.
                              GRACEFUL-DEGRADATION NOTE: the read helpers fail soft (e.g.
                              `listPendingStagingRows` returns [] on any error, staging.ts:244/271/282;
                              fetchPromotedValues/fetchEvidenceItems/fetchHitlSources/fetchTriageState
                              likewise return []/{}) so a missing table never 500s the Evidence Library
                              READ; only the WRITE paths fail without the tables. All present=true -> clear.
- 1n (rev9 2026-06-05 per codex Leg-2 round 8) any present=false -> the Admin -> Users role-change RPC
                              is missing. The user_roles TABLE being present (1b green) is NOT sufficient:
                              the Admin Users page calls `manage_user_role_insert` / `manage_user_role_delete`
                              (actions.ts:454/:464/:527), not a direct table write, so a target with the
                              table present but migration 20260527000001 NOT applied will render the admin
                              Users surface yet 500 on every role add/remove. REMEDY: apply the REPO-BACKED
                              migration `supabase/migrations/20260527000001_user_roles_rpcs.sql` (a normal
                              migration apply, NOT a code-derived reconstruction). It is SAFE TO RE-RUN: both
                              functions are `CREATE OR REPLACE FUNCTION` (the GRANT/REVOKE/ALTER OWNER lines
                              are idempotent), so applying it on a project where the RPCs already exist simply
                              re-asserts them. If Admin -> Users role changes are not in the demo script, you
                              may DEFER. Both present=true -> clear.
- RESET VOTES (`/admin/reset-votes`) -- NO PROBE, NO REMEDY, BY DESIGN (rev9 2026-06-05 per codex Leg-2
                              round 8). This route is OWNER-GATED / OUT-OF-DEMO-SCOPE (matrix row #13). Its
                              "with backup" path calls `rpc('create_vote_backup')` (ResetVotesClient.tsx:20),
                              a FUNCTION with NO definition anywhere in the repo (verified: the only
                              occurrence of `create_vote_backup` on origin/main is that single call site --
                              no DDL in `database_schema.sql` or `supabase/migrations/`). The kit deliberately
                              provides neither a probe nor a remedy for it: unlike the no-DDL TABLES (1j
                              matrix_reviews / 1l document_tags) which the kit reconstructs from a clear
                              column contract, a FUNCTION body would have to be reverse-engineered with no
                              repo source, so reconstructing it is OUT OF SCOPE. The page also exposes
                              PERMANENT vote-deletion (`poll_votes`/`ranking_votes` `.delete()`,
                              ResetVotesClient.tsx:27/33) -- a destructive action. DEFER recommended: do not
                              open or click this route during a demo. If a backup capability is ever needed,
                              surface to me to recover the function via the explore-before-assume protocol --
                              the kit authors no reconstructed function here.
- 1c any present=false      -> CEW poll table(s) missing -> see Remedy E (CEW surfaces not demoable
                              until applied, OR explicitly defer the CEW demo).
- 1c-2 any present=false (rev4 2026-06-05 per codex Leg-2 round 4) -> the matching poll-submit RPC is
                              missing -> see Remedy E (its rev4 FUNCTION block creates all three). This
                              is INDEPENDENT of 1c: a project can show every poll TABLE present (1c all
                              true) yet 500 on submit because the helper function is absent. If you will
                              demo CEW polls, Remedy E must be applied in FULL (tables + functions). If
                              you will NOT demo CEW polls, defer the whole CEW surface.
- 1d returns 0 rows         -> review_submissions status CHECK missing/renamed. If the table exists
                              but the constraint is wrong, do NOT drop -- reconcile by hand and
                              surface to me on return. If the table is absent, Remedy B creates it
                              correctly.
- 1e returns < 2 rows       -> map RPC/allowlist not applied -> Remedy D (full chain).
- 1f returns 0 rows         -> measurement RPC missing -> Remedy D (the chain includes it).
- 1k (rev4 2026-06-05 per codex Leg-2 round 4) NOTICE output, per table:
  - `ABSENT`                 -> the matrix_map schema/table is not present -> apply Remedy D first
                              (schema + RPC chain), THEN load data (below).
  - `0 row(s)`               -> schema/RPC may be live but the map has NO markers. This is NOT a
                              schema bug and Remedy D will NOT fix it: rows come from the owner-run
                              ETL `scripts/matrix-map/etl_bnrrm_to_supabase.py` (and its chunked
                              output via `scripts/matrix-map/split_etl_output.py`), which is OUT OF KIT
                              SQL SCOPE (the kit pastes no data). To populate the map, run that ETL
                              against the target project (owner action), or DEFER the Interactive Map /
                              accept an empty map for the demo. The anon empty-map fallback is by
                              design, but an AUTHED empty map with 0 samples is a data-load gap, not a
                              code gap.
  - `N row(s)` (N > 0)       -> data present -> map will render markers (assuming 1e/1f green). Clear.
- 1g (if run) returns 0     -> no admin -> Remedy C (grant your demo account admin).

---

## STEP 2 -- Conditional remedies (apply ONLY what STEP 1 says is missing)

### Remedy A -- engine-v2 column missing (rev2 2026-06-05 per codex Leg-2 round 2)
PRECONDITION: STEP 1a showed `v2_projects_present = true` (the base table exists) AND 1a-2 returned
0 rows (column missing). If 1a showed `v2_projects_present = false`, the base engine-v2 schema is
absent and this remedy does NOT apply -- see INTERPRETATION 1a (owner-gated, out of kit scope); do
NOT run the ALTER below, it will error "relation v2_projects does not exist".

Apply the migration ALREADY in the repo, THEN deploy main. Order matters (deployed main code
SELECTs the column; applying after deploy avoids a window of column-not-found only if you deploy
after). Safest: apply first, then deploy.
- File: `supabase/migrations/20260604_v2_projects_applicable_policy_ids.sql` (idempotent ALTER ADD
  COLUMN ... JSONB DEFAULT '[]'). Paste its contents into Studio.
- Code is already correct on origin/main (#251): `src/lib/engine-v2/types.ts` has
  `applicable_policy_ids`; the `[projectId]/page.tsx` SELECT includes it. No code change needed.

### Remedy B -- app tables missing (admin pages and/or TWG review) (rev 2026-06-05 per codex Leg-2)

DO NOT paste the whole `database_schema.sql` file. Pasting it wholesale is UNSAFE on a live or
partially-applied project: (1) its `CREATE POLICY` statements have no `IF NOT EXISTS` and will ERROR
with "policy already exists" the second time (`database_schema.sql:240` and throughout), aborting
the rest of the paste; (2) it INSERTs sample announcements/milestones with no unique key for the
`ON CONFLICT DO NOTHING` to catch, so re-running DUPLICATES visible demo content
(`database_schema.sql:881-896`); (3) it runs `GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA
public TO authenticated` (`database_schema.sql:904`), which BROADENS privileges on every unrelated
table in the schema. The demo seed INSERTs and that broad GRANT are deliberately EXCLUDED below.

Paste the following self-contained, idempotent block instead. It is safe to run twice: every table
is `CREATE TABLE IF NOT EXISTS`, every index is `CREATE INDEX IF NOT EXISTS`, `ENABLE ROW LEVEL
SECURITY` is a no-op when already enabled, and each policy is wrapped in a `DO $$ ... EXCEPTION WHEN
duplicate_object THEN NULL` block (PostgreSQL `CREATE POLICY` has no `IF NOT EXISTS`). DDL copied
verbatim from `database_schema.sql` (user_roles 227, tags 256, documents 282, announcements 312,
milestones 343, discussions 375, discussion_replies 410, review_submissions 449, review_files 480,
likes 546; indexes 583-586 / 791-819) EXCEPT `documents` and `review_files`, whose schema-doc DDL is
STALE vs the live code -- those two blocks use the verified LIVE-CODE column contract instead (see
the rev2 WARNING in each block below). Run STEP 1 first and paste only the table blocks STEP 1b
flagged as missing -- but running the whole block is harmless on tables that already exist.

```sql
-- == Remedy B: app tables (admin pages + TWG review). Idempotent; safe to run twice. ==
-- Excludes the sample-data INSERTs (duplicate demo content) and the broad
-- GRANT INSERT/UPDATE/DELETE ON ALL TABLES (privilege broadening) from database_schema.sql.

-- 1) user_roles (gates /admin)
CREATE TABLE IF NOT EXISTS user_roles (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, role)
);
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Users can view their own roles" ON user_roles FOR SELECT USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Admins can manage all roles" ON user_roles FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);

-- 2) tags
CREATE TABLE IF NOT EXISTS tags (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    color TEXT NOT NULL DEFAULT '#6B7280',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by TEXT
);
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Anyone can view tags" ON tags FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Admins can manage tags" ON tags FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
CREATE INDEX IF NOT EXISTS idx_tags_created_at ON tags(created_at);

-- 3) documents (rev2 2026-06-05 per codex Leg-2 round 2)
-- WARNING: database_schema.sql:282-289 (and the prior version of this block) is STALE vs the LIVE
--   code for documents. The live create path INSERTs user_id + user_email
--   (src/app/(dashboard)/twg/documents/actions.ts:69-76: { title, file_url, description, user_id,
--    user_email }), but neither the schema doc nor the prior Remedy B DDL defined those two columns.
--   Creating documents from the stale DDL makes the table PRESENT while the admin "create document"
--   action 500s (column user_id / user_email not found). Live reads use file_url/description/
--   created_at (twg/documents/[id]/edit/page.tsx:46) -- those are unchanged. The two columns are
--   added below (nullable, so existing rows + SELECT * reads are unaffected).
--   FOLLOW-UP BACKLOG: fold user_id/user_email into database_schema.sql:282 so the doc stops drifting.
CREATE TABLE IF NOT EXISTS documents (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    file_url TEXT NOT NULL,
    tag TEXT,
    user_id UUID REFERENCES auth.users(id),
    user_email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Defensive: if documents already exists from the stale DDL, add the live columns so the create
-- action stops erroring. No-ops when the table was just created with the live contract above.
ALTER TABLE documents ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE documents ADD COLUMN IF NOT EXISTS user_email TEXT;
-- NOT-NULL audit (rev3 2026-06-05 per codex Leg-2 round 3): the stale documents DDL
-- (database_schema.sql:282-289) has only two NOT-NULL-without-default columns, title and file_url,
-- and the live insert (actions.ts:69-76) supplies BOTH. No legacy NOT NULL column is omitted by the
-- live insert, so -- unlike review_files -- there is NOTHING to relax here; the two ADD COLUMNs above
-- (added nullable) are the only drift fix documents needs.
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Anyone can view documents" ON documents FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Admins can manage all documents" ON documents FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at);
CREATE INDEX IF NOT EXISTS idx_documents_tag ON documents(tag);

-- 4) announcements
CREATE TABLE IF NOT EXISTS announcements (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
    is_active BOOLEAN DEFAULT true,
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Anyone can view active announcements" ON announcements FOR SELECT USING (is_active = true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Admins can manage all announcements" ON announcements FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_announcements_is_active ON announcements(is_active);
CREATE INDEX IF NOT EXISTS idx_announcements_priority ON announcements(priority);
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON announcements(created_at);

-- 5) milestones
CREATE TABLE IF NOT EXISTS milestones (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    target_date DATE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'delayed')),
    priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
    created_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Anyone can view milestones" ON milestones FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Admins can manage all milestones" ON milestones FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_milestones_target_date ON milestones(target_date);
CREATE INDEX IF NOT EXISTS idx_milestones_status ON milestones(status);
CREATE INDEX IF NOT EXISTS idx_milestones_priority ON milestones(priority);

-- 6) discussions
CREATE TABLE IF NOT EXISTS discussions (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    user_email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE discussions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Anyone can view discussions" ON discussions FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can create discussions" ON discussions FOR INSERT WITH CHECK (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can update their own discussions" ON discussions FOR UPDATE USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can delete their own discussions" ON discussions FOR DELETE USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Admins can manage all discussions" ON discussions FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_discussions_user_id ON discussions(user_id);
CREATE INDEX IF NOT EXISTS idx_discussions_created_at ON discussions(created_at);

-- 7) discussion_replies
CREATE TABLE IF NOT EXISTS discussion_replies (
    id BIGSERIAL PRIMARY KEY,
    discussion_id BIGINT NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    user_email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE discussion_replies ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Anyone can view replies" ON discussion_replies FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can create replies" ON discussion_replies FOR INSERT WITH CHECK (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can update their own replies" ON discussion_replies FOR UPDATE USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can delete their own replies" ON discussion_replies FOR DELETE USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Admins can manage all replies" ON discussion_replies FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_discussion_replies_discussion_id ON discussion_replies(discussion_id);
CREATE INDEX IF NOT EXISTS idx_discussion_replies_user_id ON discussion_replies(user_id);
CREATE INDEX IF NOT EXISTS idx_discussion_replies_created_at ON discussion_replies(created_at);

-- 8) review_submissions (TWG review portal)
CREATE TABLE IF NOT EXISTS review_submissions (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('IN_PROGRESS', 'SUBMITTED')),
    form_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE review_submissions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Users can view their own submissions" ON review_submissions FOR SELECT USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can create their own submissions" ON review_submissions FOR INSERT WITH CHECK (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can update their own submissions" ON review_submissions FOR UPDATE USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Admins can view all submissions" ON review_submissions FOR SELECT USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 9) review_files (TWG review uploads) (rev2 2026-06-05 per codex Leg-2 round 2)
-- WARNING: database_schema.sql:480-488 is STALE vs the LIVE code for review_files. It defines
--   file_name / mime_type / created_at, but origin/main's upload route INSERTs
--   filename / mimetype / file_size (src/app/api/review/upload/route.ts:105-111) and the admin
--   synthesis page SELECTs filename / mimetype / uploaded_at via aliases
--   (src/app/(dashboard)/admin/twg-synthesis/page.tsx:59:
--    'id, submission_id, file_name:filename, file_path, mime_type:mimetype, file_size,
--     created_at:uploaded_at'). The route test asserts the same insert shape
--   (src/app/api/review/upload/__tests__/route.test.ts:322-325). Creating the table from the STALE
--   schema-doc DDL makes review_files PRESENT while /api/review/upload STILL 500s (column not found)
--   and the admin synthesis SELECT errors. The block below creates the LIVE-CODE contract instead.
--   FOLLOW-UP BACKLOG: reconcile database_schema.sql:480 with the live filename/mimetype/uploaded_at
--   columns (and add a forward migration) so the schema doc stops drifting. Do NOT use its DDL here.
CREATE TABLE IF NOT EXISTS review_files (
    id BIGSERIAL PRIMARY KEY,
    submission_id BIGINT NOT NULL REFERENCES review_submissions(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    mimetype TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Defensive: if review_files already exists from the STALE schema-doc DDL (file_name/mime_type/
-- created_at), add the live columns so the upload route + admin SELECT stop erroring. These ADDs are
-- no-ops when the table was just created with the live contract above. Manual follow-up may still be
-- needed to backfill/drop the stale columns; this only un-blocks the demo path.
ALTER TABLE review_files ADD COLUMN IF NOT EXISTS filename TEXT;
ALTER TABLE review_files ADD COLUMN IF NOT EXISTS mimetype TEXT;
ALTER TABLE review_files ADD COLUMN IF NOT EXISTS file_size BIGINT;
ALTER TABLE review_files ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
-- Defensive NOT-NULL RELAX (rev3 2026-06-05 per codex Leg-2 round 3): the STALE schema-doc DDL made
-- file_name and mime_type NOT NULL with no default, but the live upload route inserts only
-- filename/mimetype (route.ts:105-111) and never supplies file_name/mime_type -- so adding the live
-- columns alone is NOT enough: the INSERT still fails the legacy NOT NULL constraints. Each block
-- below drops NOT NULL only when the legacy column EXISTS and is currently NOT NULL, so it is a
-- no-op on a fresh schema created with the live contract above (the IF EXISTS guard) and idempotent
-- on re-run (once relaxed, is_nullable='YES' and the IF is skipped). We relax (not drop) the columns
-- to avoid touching existing data; backfilling/removing the stale columns is a manual follow-up.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_schema='public' AND table_name='review_files'
              AND column_name='file_name' AND is_nullable='NO') THEN
    ALTER TABLE public.review_files ALTER COLUMN file_name DROP NOT NULL;
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
            WHERE table_schema='public' AND table_name='review_files'
              AND column_name='mime_type' AND is_nullable='NO') THEN
    ALTER TABLE public.review_files ALTER COLUMN mime_type DROP NOT NULL;
  END IF;
END $$;
ALTER TABLE review_files ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Users can view files for their submissions" ON review_files FOR SELECT USING (EXISTS (SELECT 1 FROM review_submissions WHERE id = review_files.submission_id AND user_id = auth.uid())); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can create files for their submissions" ON review_files FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM review_submissions WHERE id = review_files.submission_id AND user_id = auth.uid())); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Admins can view all files" ON review_files FOR SELECT USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 10) likes
CREATE TABLE IF NOT EXISTS likes (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    discussion_id BIGINT REFERENCES discussions(id) ON DELETE CASCADE,
    reply_id BIGINT REFERENCES discussion_replies(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT like_target_check CHECK (
        (discussion_id IS NOT NULL AND reply_id IS NULL) OR
        (discussion_id IS NULL AND reply_id IS NOT NULL)
    ),
    UNIQUE(user_id, discussion_id, reply_id)
);
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Anyone can view likes" ON likes FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can create their own likes" ON likes FOR INSERT WITH CHECK (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can delete their own likes" ON likes FOR DELETE USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Admins can manage all likes" ON likes FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_likes_user_id ON likes(user_id);
CREATE INDEX IF NOT EXISTS idx_likes_discussion_id ON likes(discussion_id);
CREATE INDEX IF NOT EXISTS idx_likes_reply_id ON likes(reply_id);
CREATE INDEX IF NOT EXISTS idx_likes_created_at ON likes(created_at);
```

WARNING -- intentionally EXCLUDED from the block above (do NOT add them back blindly):
- The sample tags/announcements/milestones INSERTs (`database_schema.sql:871-896`). The announcement
  and milestone INSERTs have no unique key, so their `ON CONFLICT DO NOTHING` catches nothing and
  re-running DUPLICATES the demo content. If you want non-zero admin metrics, add a FEW rows by hand
  AFTER confirming the tables are empty, or seed via the admin UI.
- `GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated`
  (`database_schema.sql:904`). It broadens write privileges on every table in the schema (including
  tables unrelated to these features). The RLS policies above already scope access correctly;
  Supabase's default role grants plus RLS are sufficient. Do not run the broad GRANT.

NOTE on `admin_review_submissions` view (`database_schema.sql:519-539`): it depends on
`get_users_with_emails()` (defined at `database_schema.sql:594`). It is NOT included above because
the TWG portal save/submit path does not require it; if the admin "review submissions" list page
errors with "function get_users_with_emails() does not exist", apply that function block from
`database_schema.sql` separately. This is a later-polish item, not a demo-blocker for the save path.

### Remedy C -- no admin user
Replace the email with the demo account, then:
```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'YOUR_DEMO_EMAIL@example.com'
on conflict do nothing;
```

### Remedy D -- matrix-map RPC/allowlist missing (only if you will demo the Interactive Map tab) (rev 2026-06-05 per codex Leg-2)

Applying only the two files the old version named is NOT enough: the Interactive Map and its
Measurement Workbench right panel depend on a CHAIN of migrations. The right panel calls
`fetch_measurements_for_samples`, which is created in `20260521000003`, and the fetch RPC went
through several post-creation fixes. RLS/helpers MUST be applied BEFORE the RPCs (the RPCs and their
read paths depend on the matrix_map schema, helper functions, and RLS policies existing first).

Apply these files from `supabase/migrations/` IN THIS ORDER (each is already in the repo; rev6
2026-06-05 per codex Leg-2 round 5):

IMPORTANT -- RPC-NAME PRESENCE IS NECESSARY, NOT SUFFICIENT. Probes 1e/1f only check that the RPC
NAMES exist in `information_schema.routines` (the routine name), NOT that the later create-or-replace
BODY fixes in this chain were applied. A target with STALE RPC bodies (created by an early migration
but never updated by the geography/JWT/geometry/admin-bypass fixes below) will PASS 1e/1f yet still
render a broken Interactive Map. Therefore: 1e/1f presence is for triaging TRUE ABSENCE only (0 rows
= the RPC is definitely missing -> you definitely need this chain). Because every file here is
idempotent or create-or-replace, re-applying the full chain on a project that already has the RPCs is
SAFE and simply refreshes the bodies to the fixed versions. RECOMMENDATION: run the FULL ordered
chain below whenever there is ANY doubt that all the post-creation fixes were applied (a fresh or
partially-migrated target, or any uncertainty about migration history). Do NOT skip a file merely
because 1e/1f reported its RPC name present -- name-present does not prove body-current. (Skip only if
you have independently confirmed every fix in this chain was already applied to the live project.)

1. `20260519000001_matrix_map_schema.sql`            -- tables (schema first)
2. `20260519000002_matrix_map_rls.sql`               -- helper functions + RLS policies (RLS BEFORE RPC)
3. `20260520000001_matrix_map_fetch_samples_rpc.sql` -- fetch_samples_with_hidden_summary RPC
4. `20260520000003_matrix_map_security_hardening.sql`-- auth.* grants + RLS read policies for the RPC
5. `20260520000004_matrix_map_jwt_via_current_setting.sql` -- JWT read fix the RPC relies on
6. `20260520000005_matrix_map_rpc_geography_cast.sql`      -- RPC geo cast fix
7. `20260520000006_matrix_map_rpc_geometry_type_schema_qualify.sql` -- RPC geometry-type fix
8. `20260520000007_matrix_map_rpc_stxy_geography_avoid_extensions.sql` -- RPC ST_X/ST_Y fix
9. `20260521000001_matrix_map_lng_lat_columns.sql`   -- lng/lat columns the panel reads
10. `20260521000002_matrix_map_admin_bypass_fetch_rpc.sql` -- admin-bypass variant of the fetch RPC
11. `20260521000003_matrix_map_fetch_measurements_rpc.sql` -- fetch_measurements_for_samples (RIGHT PANEL needs this)

After applying, RE-RUN STEP 1 probes 1e and 1f -- 1e should return 2 rows and 1f should return 1
row. If PostgREST still 404s the RPC from the app even though the function exists, the `matrix_map`
schema may not be in the API's exposed-schema list: in Supabase Studio go to Project Settings -> API
-> "Exposed schemas" and confirm `matrix_map` is listed (Studio applies it; this is a settings
toggle, not SQL). Anon users always see the empty-map fallback by design -- that is NOT an error.

### Remedy E -- CEW poll tables + submit helper functions missing (only if you will demo CEW polls / admin poll surfaces) (rev4 2026-06-05 per codex Leg-2 round 4)

The six CEW poll tables (`polls`, `poll_votes`, `ranking_polls`, `ranking_votes`, `wordcloud_polls`,
`wordcloud_votes`) AND the three poll-submit helper functions (`get_or_create_poll`,
`get_or_create_ranking_poll`, `get_or_create_wordcloud_poll_fixed`) live ONLY in
`database_schema.sql` (tables 920-995; functions 1189/1214/1240) and are NOT under
`supabase/migrations/`, so a fresh project lacks them. The block below creates BOTH (tables + RLS +
functions + grants) in one paste -- apply it in FULL, because a project with the tables but not the
functions still 500s on every submit (STEP 1 probe 1c-2 catches that case). If STEP 1c OR 1c-2 shows
anything missing AND you will demo the CEW poll surfaces, paste the guarded block below. If you will
NOT demo CEW polls, you can explicitly DEFER this -- the CEW surface is the only thing affected and it
fails in isolation, not the rest of the app.

```sql
-- == Remedy E: CEW poll tables. Idempotent; safe to run twice. ==
CREATE TABLE IF NOT EXISTS polls (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    page_path VARCHAR(255) NOT NULL,
    poll_index INTEGER NOT NULL,
    question TEXT NOT NULL,
    options JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS poll_votes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    poll_id UUID REFERENCES polls(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    option_index INTEGER NOT NULL,
    other_text TEXT,
    voted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS unique_authenticated_poll_vote
ON poll_votes (poll_id, user_id)
WHERE user_id NOT LIKE '%session_%' AND user_id NOT LIKE '%CEW%';
CREATE TABLE IF NOT EXISTS ranking_polls (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    page_path VARCHAR(255) NOT NULL,
    poll_index INTEGER NOT NULL,
    question TEXT NOT NULL,
    options JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS wordcloud_polls (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    page_path VARCHAR(255) NOT NULL,
    poll_index INTEGER NOT NULL,
    question TEXT NOT NULL,
    max_words INTEGER DEFAULT 3,
    word_limit INTEGER DEFAULT 20,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS ranking_votes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ranking_poll_id UUID REFERENCES ranking_polls(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    option_index INTEGER NOT NULL,
    rank INTEGER NOT NULL,
    voted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS wordcloud_votes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    poll_id UUID REFERENCES wordcloud_polls(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    word TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(poll_id, user_id, word)
);
ALTER TABLE polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ranking_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE ranking_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE wordcloud_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE wordcloud_votes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Anyone can view polls" ON polls FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Anyone can create polls" ON polls FOR INSERT WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Anyone can vote in polls" ON poll_votes FOR INSERT WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Anyone can view poll votes" ON poll_votes FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Authenticated users can delete their own votes" ON poll_votes FOR DELETE USING (auth.uid()::text = user_id AND user_id NOT LIKE '%session_%' AND user_id NOT LIKE '%CEW%'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Anyone can view ranking polls" ON ranking_polls FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Anyone can create ranking polls" ON ranking_polls FOR INSERT WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Anyone can vote in ranking polls" ON ranking_votes FOR INSERT WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Anyone can view ranking votes" ON ranking_votes FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Authenticated users can delete their own ranking votes" ON ranking_votes FOR DELETE USING (auth.uid()::text = user_id AND user_id NOT LIKE '%session_%' AND user_id NOT LIKE '%CEW%'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Anyone can view wordcloud polls" ON wordcloud_polls FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Anyone can create wordcloud polls" ON wordcloud_polls FOR INSERT WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Anyone can vote in wordcloud polls" ON wordcloud_votes FOR INSERT WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Anyone can view wordcloud votes" ON wordcloud_votes FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Authenticated users can delete their own wordcloud votes" ON wordcloud_votes FOR DELETE USING (auth.uid()::text = user_id AND user_id NOT LIKE '%session_%' AND user_id NOT LIKE '%CEW%'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- == Remedy E (cont.): poll-submit HELPER FUNCTIONS (rev4 2026-06-05 per codex Leg-2 round 4). ==
-- Copied EXACTLY from database_schema.sql (get_or_create_poll 1189, get_or_create_ranking_poll
-- 1214, get_or_create_wordcloud_poll_fixed 1240). These are what the three /api/*-polls/submit
-- routes call BEFORE any vote insert; without them every poll submit 500s even with all six tables
-- present (see STEP 1 probe 1c-2). CREATE OR REPLACE is idempotent / safe to run twice. The bodies
-- are self-contained (they only touch the poll tables created above). The paired GRANT EXECUTE
-- statements are the EXACT ones database_schema.sql:1302-1304 pairs with these functions -- scoped
-- to authenticated, anon only (the live submit routes run anon for CEW live polling); no broad grant.
CREATE OR REPLACE FUNCTION get_or_create_poll(
    p_page_path TEXT,
    p_poll_index INTEGER,
    p_question TEXT,
    p_options JSONB
) RETURNS UUID AS $$
DECLARE
    poll_id UUID;
BEGIN
    -- Try to get existing poll
    SELECT id INTO poll_id 
    FROM polls 
    WHERE page_path = p_page_path AND poll_index = p_poll_index;
    
    -- Create poll if it doesn't exist
    IF poll_id IS NULL THEN
        INSERT INTO polls (page_path, poll_index, question, options)
        VALUES (p_page_path, p_poll_index, p_question, p_options)
        RETURNING id INTO poll_id;
    END IF;
    
    RETURN poll_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_or_create_ranking_poll(
    p_page_path TEXT,
    p_poll_index INTEGER,
    p_question TEXT,
    p_options JSONB
) RETURNS UUID AS $$
DECLARE
    poll_id UUID;
BEGIN
    -- Try to get existing ranking poll
    SELECT id INTO poll_id 
    FROM ranking_polls 
    WHERE page_path = p_page_path AND poll_index = p_poll_index;
    
    -- Create ranking poll if it doesn't exist
    IF poll_id IS NULL THEN
        INSERT INTO ranking_polls (page_path, poll_index, question, options)
        VALUES (p_page_path, p_poll_index, p_question, p_options)
        RETURNING id INTO poll_id;
    END IF;
    
    RETURN poll_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_or_create_wordcloud_poll_fixed(
    p_page_path VARCHAR(255),
    p_poll_index INTEGER,
    p_question TEXT,
    p_max_words INTEGER DEFAULT 3,
    p_word_limit INTEGER DEFAULT 20
) RETURNS UUID AS $$
DECLARE
    poll_id UUID;
BEGIN
    -- Try to find existing poll
    SELECT id INTO poll_id
    FROM wordcloud_polls
    WHERE page_path = p_page_path AND poll_index = p_poll_index;
    
    -- If not found, create new poll
    IF poll_id IS NULL THEN
        INSERT INTO wordcloud_polls (page_path, poll_index, question, max_words, word_limit)
        VALUES (p_page_path, p_poll_index, p_question, p_max_words, p_word_limit)
        RETURNING id INTO poll_id;
    END IF;
    
    RETURN poll_id;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_or_create_poll TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_or_create_ranking_poll TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_or_create_wordcloud_poll_fixed TO authenticated, anon;
```

NOTE: this block creates the tables + RLS + the three poll-submit helper functions. The
poll/ranking/wordcloud RESULTS views and any
seed poll definitions in `database_schema.sql` are not included; if a CEW results page errors on a
missing view, apply the matching `CREATE OR REPLACE VIEW` block from `database_schema.sql`
(`poll_results` 1051, `ranking_results` 1084, `wordcloud_results` 1122 -- all three, aligned with the
matrix appendix #8 rev5 2026-06-05 per Opus matrix verify) separately. Seeding actual poll questions
is a content step, not a schema step.

### Remedy F -- TWG upload storage bucket missing (only if you will demo file upload at /twg/review) (rev3 2026-06-05 per codex Leg-2 round 3)

PRECONDITION: STEP 1i (`select id, name, public from storage.buckets where id = 'documents'`)
returned 0 rows. The upload route writes the file to Supabase Storage bucket id `documents`
(`src/app/api/review/upload/route.ts:97`: `supabase.storage.from('documents').upload(...)`) BEFORE
inserting the review_files row, and NO repo SQL or migration creates this bucket. Without it,
`/api/review/upload` 500s ("Failed to upload file") even when every table and column from Remedy B is
correct. Two ways to create it (pick ONE):

(i) Dashboard UI (recommended -- Supabase manages the storage schema): Studio -> Storage -> New
    bucket -> name `documents` -> leave it PRIVATE (Public off; the route uses an authenticated
    client and the app does not rely on public object URLs) -> Create.

(ii) SQL (paste into Studio SQL Editor). Idempotent via ON CONFLICT; safe to run twice:
```sql
-- Remedy F: create the 'documents' storage bucket the TWG upload route writes to.
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;
```

STORAGE RLS / POLICIES: the repo defines NO storage.objects policies for this bucket (the
`git grep` for `storage.buckets` / bucket policies on origin/main finds none). With RLS enabled on
`storage.objects` (the Supabase default) an authenticated upload can still be denied until a policy
allows INSERT/SELECT on objects in the `documents` bucket. If uploads 500 with a row-level-security /
permission error AFTER the bucket exists, the owner must add storage policies via the dashboard
(Storage -> Policies -> bucket `documents` -> allow authenticated INSERT and SELECT) -- this kit does
NOT author storage policies because the repo defines none to copy from, and a policy shape is a
deliberate access-control decision. ALTERNATIVELY: if file upload is not part of the demo
script, mark TWG uploads OUT-OF-DEMO-SCOPE -- the save/submit path (Remedy B tables) works without
any bucket; only the optional attach-file step needs it.

### Remedy G -- matrix_reviews table missing (only if you will demo the Matrix Options "TWG Review" tab or /admin/matrix-review) (rev4 2026-06-05 per codex Leg-2 round 4)

PRECONDITION: STEP 1j returned `matrix_reviews_present = false`.

IMPORTANT -- READ BEFORE RUNNING: the column/RLS contract below is DERIVED FROM LIVE CODE; NO DDL
source for `matrix_reviews` exists anywhere in the repo (not in `database_schema.sql`, not in
`supabase/migrations/`). The security-audit migration `20260515_matrix_security_audit.sql:95-116`
only assumes the table already exists. So this CREATE TABLE is the kit's best reconstruction of what
the live project's table looks like, NOT a copy of a repo artifact. VERIFY IT AGAINST YOUR LIVE
PROJECT before running -- if `matrix_reviews` already exists on the target with a different shape,
do NOT run this; reconcile by hand. ALTERNATIVELY, if the Matrix Review surface is not in the demo
script, DEFER it (mark out-of-demo-scope) and skip this remedy entirely.

Contract derived from (every column traced to a reader/writer on origin/main):
- `id` uuid PK              -- read at admin/matrix-review/page.tsx:41 (selected) + used as UPDATE
                              target key in TWGReviewPortal.tsx:180 (`.eq('id', existing.id)`).
- `user_id` uuid           -- written TWGReviewPortal.tsx:182 (insert), looked up :163-164
                              (`.eq('user_id', user.id)`); read admin page:41; the security-audit
                              migration partitions/dedupes BY user_id and adds UNIQUE(user_id) (95-116).
- `status` text            -- written 'SUBMITTED' (TWGReviewPortal.tsx:179,182); read as
                              'IN_PROGRESS' | 'SUBMITTED' (admin page BaseReview type:60). Default
                              'IN_PROGRESS' + CHECK mirrors review_submissions.
- `poll_data` jsonb        -- written `{}` (TWGReviewPortal.tsx:179,182); read admin page:41.
- `comments_data` jsonb    -- written payload (TWGReviewPortal.tsx:179,182); read admin page:41.
- `created_at` timestamptz -- ordered-by + read (admin page:41; TWGReviewPortal.tsx:165 order).
- `updated_at` timestamptz -- read admin page:41; the dedupe orders by updated_at (audit mig:101).

RLS modeled on `20260515_matrix_security_audit.sql` (own-row via `auth.uid() = user_id`; admin via
a `user_roles` EXISTS check, matching the pattern that migration uses elsewhere and the same shape as
Remedy B's app-table policies). The TWGReviewPortal comment (TWGReviewPortal.tsx:155-160) states the
authoritative gates are INSERT `WITH CHECK (auth.uid() = user_id)` and UPDATE `USING (auth.uid() =
user_id)`; SELECT is own-row + admin-all so /admin/matrix-review can read every row.

```sql
-- == Remedy G: matrix_reviews (contract derived from live code; NO DDL source exists in repo). ==
-- Idempotent; safe to run twice. VERIFY against the live project first (see caveat above).
CREATE TABLE IF NOT EXISTS public.matrix_reviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'SUBMITTED')),
    poll_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    comments_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- UNIQUE(user_id): the security-audit migration (20260515:108-116) adds this so re-submits upsert
-- one row per user. The live TWGReviewPortal does a manual lookup-then-update (it notes the
-- constraint "can't be used for onConflict"), so the table works WITHOUT this constraint too; it is
-- included to match the audited live shape. Wrapped so a re-run (or a pre-existing constraint) is a
-- no-op rather than an error.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname  = 'matrix_reviews_user_id_unique'
      AND conrelid = 'public.matrix_reviews'::regclass
  ) THEN
    ALTER TABLE public.matrix_reviews
      ADD CONSTRAINT matrix_reviews_user_id_unique UNIQUE (user_id);
  END IF;
END $$;
ALTER TABLE public.matrix_reviews ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Users can view their own matrix reviews" ON public.matrix_reviews FOR SELECT USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can create their own matrix reviews" ON public.matrix_reviews FOR INSERT WITH CHECK (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can update their own matrix reviews" ON public.matrix_reviews FOR UPDATE USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Admins can view all matrix reviews" ON public.matrix_reviews FOR SELECT USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_matrix_reviews_user_id ON public.matrix_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_matrix_reviews_created_at ON public.matrix_reviews(created_at);
```

FOLLOW-UP BACKLOG (rev4): land a canonical `matrix_reviews` DDL as a dated migration under
`supabase/migrations/` (the security-audit migration assumes the table but never creates it; the only
definition is this code-derived reconstruction). Until then, this kit is the sole CREATE source and
must be verified against the live project per-target.

### Remedy H -- document_tags JOIN table missing (only if you will demo TWG Documents tags at /twg/documents or admin document-tag editing) (rev5 2026-06-05 per Opus matrix verify)

PRECONDITION: STEP 1l returned `document_tags_present = false`.

IMPORTANT -- READ BEFORE RUNNING: the column contract below is DERIVED FROM LIVE CODE; NO DDL source
for `document_tags` exists anywhere in the repo (not in `database_schema.sql`, not in
`supabase/migrations/`) -- the SAME no-DDL class as matrix_reviews (Remedy G). So this CREATE TABLE is
the kit's best reconstruction of the live join table, NOT a copy of a repo artifact. VERIFY IT
AGAINST YOUR LIVE PROJECT before running -- if `document_tags` already exists on the target with a
different shape, do NOT run this; reconcile by hand. ALTERNATIVELY, if the TWG Documents tag surface
is not in the demo script, DEFER it (mark out-of-demo-scope) and skip this remedy entirely.

Contract derived from (every column traced to a reader/writer on origin/main):
- `document_id`            -- embed key read at twg/documents/page.tsx:49 (`document_tags(tags(...))`);
                             written in documents/[id]/route.ts:82 (DELETE `.eq('document_id', ...)`)
                             and :94 (INSERT `{ document_id, tag_id }`); queries.ts:316 createDocumentTag
                             inserts `{ document_id }`. FK -> public.documents(id).
- `tag_id`                 -- written documents/[id]/route.ts:94 (INSERT `{ document_id, tag_id }`);
                             queries.ts:106 deleteTag cascades `.eq('tag_id', ...)`; :316 inserts
                             `{ tag_id }`. FK -> public.tags(id).

Column TYPES match the kit's own Remedy B DDL: `public.documents.id` and `public.tags.id` are both
BIGSERIAL (i.e. BIGINT) in database_schema.sql, so both FK columns are BIGINT. The PK is the
composite `(document_id, tag_id)` -- a standard many-to-many join with no surface that reads any other
column. RLS is modeled on how the documents/tags policies are shaped elsewhere in the kit (anyone can
SELECT so the documents page embed resolves for any authed reader; admins manage writes via a
`user_roles` EXISTS check, matching Remedy B's app-table policy pattern and database_schema.sql's
tags/documents policies). DO-wrapped so re-runs are no-ops.

```sql
-- == Remedy H: document_tags JOIN table (contract derived from live code; NO DDL source in repo). ==
-- Idempotent; safe to run twice. VERIFY against the live project first (see caveat above).
CREATE TABLE IF NOT EXISTS public.document_tags (
    document_id BIGINT NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    tag_id BIGINT NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
    PRIMARY KEY (document_id, tag_id)
);
ALTER TABLE public.document_tags ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Anyone can view document tags" ON public.document_tags FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Admins can manage document tags" ON public.document_tags FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_document_tags_tag_id ON public.document_tags(tag_id);
```

FOLLOW-UP BACKLOG (rev5): land a canonical `document_tags` DDL as a dated migration under
`supabase/migrations/` (no migration or schema doc creates this join table; the only definition is
this code-derived reconstruction). Until then, this kit is the sole CREATE source and must be verified
against the live project per-target.

---

## STEP 3 -- Lock the demo ENVIRONMENT (this single choice resolves 2 "Partial" surfaces)

Two real surfaces are LOCAL-DEV-ONLY by design and only work on a local box:
- Regulatory-review ENGINE V1 (better-sqlite3; needs `LOCAL_ENGINE_ENABLED=true` + the sibling
  `C:/Projects/Regulatory-Review` repo + Python for evaluate/extract). Dead-but-graceful on Vercel.
- Agentic OS terminal (node-pty sidecar `scripts/agentic-os-pty-server.mjs`, port 3101; needs
  `npm run dev:all`). No serverless story. THREE gates (rev 2026-06-05 per codex Leg-2 -- the secret
  is a third gate beyond the two flags):
  (1) `NEXT_PUBLIC_AGENTIC_OS_ENABLED=true` makes the CARD/page RENDER;
  (2) the pty SPAWN additionally requires `NODE_ENV=development` OR `AGENTIC_OS_LOCAL=true`
      (so a PRODUCTION build on the local box must set BOTH the flag above AND `AGENTIC_OS_LOCAL=true`);
  (3) `AGENTIC_OS_PTY_SECRET` (at least 32 chars; e.g. `openssl rand -hex 32`) MUST be set, or the
      token route returns `pty_disabled` (`src/app/api/agentic-os/pty-token/route.ts:65-72`) AND the
      sidecar refuses to start / exits 1 (`scripts/agentic-os-pty-server.mjs:48-58`, length check 60-68).
  With all three set the card shows AND the terminal connects; miss any one and the card may show but
  the terminal will not connect.

DECISION MATRIX:
- Demo on the LOCAL dev box with `npm run dev:all`: BOTH work (assets). Engine-v2 evaluate/extract
  subprocesses also reachable if `REG_REVIEW_ENGINE_V2_SCRIPT_PATH` / `_ADAPTER_PATH` point at the
  local Python. This is the richest demo.
- Demo on VERCEL/cloud: engine-v1 + Agentic OS show friendly "local-only" messages (no crash).
  Engine-v2 read views work (Supabase-backed) but live evaluate/extract needs the Python backend
  reachable from the host (usually NOT on Vercel) -- so demo engine-v2 with PRE-COMPUTED results,
  not a live evaluation run. Consider hiding the Agentic OS admin card (autonomous PR available --
  see the readiness report item 6) so the CEO does not see a non-functional card.

Required env either way: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

ENV CHECKLIST for a LOCAL demo (rev 2026-06-05 per codex Leg-2 -- the prior list was incomplete):
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` -- always required (build + runtime).
- Agentic OS terminal (if demoed): `NEXT_PUBLIC_AGENTIC_OS_ENABLED=true` AND `AGENTIC_OS_LOCAL=true`
  (or `NODE_ENV=development`) AND `AGENTIC_OS_PTY_SECRET=<>=32 chars>`. All THREE are required, or the
  terminal will not connect (see the THREE-gate note above). Without the secret the token route
  returns `pty_disabled` and the sidecar exits 1.
- Engine-v2 LIVE evaluate/extract (if demoed, not just read views): `LOCAL_ENGINE_ENABLED=true` --
  the `requireLocalEngine()` guard in `src/lib/api-guards.ts` makes the engine-v2 evaluate/extract
  routes return 503 unless this is exactly `'true'`. (Engine-v2 READ views are Supabase-backed and
  do NOT need this; only the live subprocess flows do.) The subprocess paths
  (`REG_REVIEW_ENGINE_V2_SCRIPT_PATH` / `_ADAPTER_PATH`) must also point at the local Python.
- Engine-v2 POLICY PROPOSER (if you demo the new-project wizard step 4 OR create a v2 project with a
  curated `applicable_policy_ids` list; rev6 2026-06-05 per codex Leg-2 round 5 -- #253 added these
  paths): the proposer CLI is a SEPARATE subprocess seam from evaluate/extract and needs its OWN env.
  Verified on origin/main:
  - `LOCAL_ENGINE_ENABLED=true` -- the wizard step-4 fetch hits
    `/api/engine-v2/projects/propose-policies`, whose `route.ts:82` returns 503 unless this is exactly
    `'true'` (gate documented `route.ts:11`). This is the SAME flag as evaluate/extract, but the
    proposer is gated independently, so it can 503 even when read views work.
  - `REG_REVIEW_PYTHON_PATH` -- python interpreter for the proposer subprocess; default `"python"`
    (`src/app/api/engine-v2/projects/propose-policies/route.ts:52`, `getPythonPath`). On the live box
    `.env.local` points this at the engine venv.
  - `REG_REVIEW_ENGINE_V2_PROPOSE_CLI_PATH` -- absolute path to `propose_applicable_policies_cli.py`;
    default points at the engine-v2 worktree
    (`src/app/api/engine-v2/projects/propose-policies/route.ts:57-58`, `getProposeCliPath`). A fresh
    default checkout is STALE and lacks the CLI (route.ts:25-26 calls this a known HELD-FOR-OWNER
    seam), so this MUST be overridden to the deployed engine path or the proposer fails closed.
  Same-flow note: PROJECT CREATION with a non-empty `applicable_policy_ids` ALSO runs this proposer
  for server-side universe validation and FAILS CLOSED -- if the CLI is unavailable the create route
  returns 502 `proposer_unavailable` and does NOT insert the project
  (`src/app/api/engine-v2/projects/route.ts:104-130`; it reuses `getPythonPath`/`getProposeCliPath` at
  `route.ts:44/51` per the env-path convention noted at `route.ts:18-20`). So a local demo that
  creates a new v2 project (or shows live policy proposal) can still hit 503/502 after the rest of the
  kit is satisfied unless all three vars above are set. (A demo using PRE-COMPUTED v2 results and the
  Supabase-backed read views does NOT need the proposer.)
- `/hitl-packets` page (if demoed; rev5 2026-06-05 per codex Leg-2 round 5): `HITL_PACKET_DIR` --
  the route reads packet JSON/CSV/MD files from this LOCAL FILESYSTEM directory
  (`src/lib/hitl-packets/discovery.ts`, `fs.readdirSync`/`readFileSync`). OPTIONAL: if unset it
  defaults to `path.join(process.cwd(),'..','Regulatory-Review','1_Active_Reviews',
  'Teck_Trail-WARP','2_Evaluation_Output')` (the sibling `Regulatory-Review` repo). LOCAL-ONLY BY
  DESIGN (like engine-v1); if the dir is absent the discovery returns `[]` and the page shows
  "No packets found" (NOT a 500). To demo populated packets, set `HITL_PACKET_DIR` to a directory
  holding `HITL_PACKET_{sessionId}.{json,csv,md}` files; otherwise the surface degrades gracefully.
- Agentic OS admin pages (if demoed; rev6 2026-06-05 per codex Leg-2 round 6): `KNOWLEDGE_BASE_PATH`
  -- the `/admin/agentic-os` (projects) and `/admin/agentic-os/subscriptions` pages read the LOCAL
  FILESYSTEM files `PROJECTS_MAP.md` and `AI_SUBSCRIPTIONS.md` via `fs.readFile`
  (`src/lib/agentic-os/parse-projects-map.ts:254`, `parse-ai-subscriptions.ts:287/303`). OPTIONAL:
  if unset it defaults to `path.join(process.cwd(),'..','Knowledge-Base')` (the sibling
  `Knowledge-Base` repo). LOCAL-ONLY BY DESIGN (like engine-v1 and `/hitl-packets`); if the file is
  absent the page wraps the read in try/catch and renders an admin-friendly load-error envelope that
  names the expected path and the env var (NOT a 500). To demo populated data, point
  `KNOWLEDGE_BASE_PATH` at a directory holding those two markdown files; otherwise the surface
  degrades gracefully. Admin-only.
- Optional: Sentry vars (silently skipped if absent).

---

## STEP 4 -- 10-minute demo dry-run (click-path to verify each surface BEFORE the CEO)

1. Log in -> dashboard shell renders (hero, announcements, timeline, quick-nav). [Working]
2. /admin -> click Users, Announcements, Milestones -> each loads WITHOUT a 500. (If 500 -> STEP 1b
   said a table was missing -> Remedy B.)
3. Matrix Options -> click all 8 tabs; run one calculator; open References & Values (~1.6k catalog
   records; 1573 are the human-health TRV file); open Interactive Map while authed (map loads with
   markers, or empty fallback if Remedy D pending OR 1k showed 0 rows -> run the ETL or accept an
   empty map). If the demo includes the Matrix Options "TWG Review" tab, submit a review -> success,
   not 500. (If 500 -> STEP 1j said `matrix_reviews` is missing -> Remedy G; verify against the live
   project first.) [Working]
4. BN-RRM -> load a pack, run inference, open a peer-review artifact tab. [Working]
5. Engine-v2 -> open a project at /dashboard/engine-v2/[projectId] -> loads WITHOUT 404. (If 404
   PostgREST 42703 -> STEP 1a said the column was missing -> Remedy A.)
6. TWG review -> /twg/review -> fill Part 1, click Save -> success (not 500). (If 500 -> Remedy B.)
   Then attach a file and Upload (rev3 2026-06-05): success, not 500. (If 500 here but Save worked ->
   it is the upload-only gates: STEP 1h column contract incl. the rev4 legacy-NOT-NULL audit ->
   Remedy B relax block, and/or STEP 1i missing `documents` bucket -> Remedy F. If upload is not in
   the demo script, skip it -- Save works without the bucket.)
7. CEW polls (rev4 2026-06-05) -> if the demo includes CEW poll surfaces, submit one poll/ranking/
   wordcloud vote -> success, not 500. (If 500 -> STEP 1c said a poll table is missing OR 1c-2 said a
   submit RPC is missing -> apply Remedy E in FULL. If CEW polls are not in the demo, defer them.)
8. (Local only) Agentic OS terminal opens + connects; engine-v1 results render.

---

## Code-quality note -- RESOLVED (rev10 2026-06-05)

The `src/lib/db/queries.ts` `createReviewSubmission()` CHECK-violation flagged here was FIXED and
merged to main via PR #255 on 2026-06-05: literals aligned to `'IN_PROGRESS'`/`'SUBMITTED'`
(database_schema.sql:452), a shared `REVIEW_SUBMISSION_STATUSES` const + type added, and a
regression test now guards every write path. No remaining action.

---

## APPENDIX -- DEMO-SURFACE DEPENDENCY MATRIX (rev8 2026-06-05 per codex Leg-2 round 7)

This appendix is the AUTHORITY for kit coverage-completeness. It has ONE row per rated demo surface
in `WHOLE_APP_READINESS_REPORT_2026_06_04.md` (the 10 rows of its per-surface table, lines 65-74),
plus the standalone-routes line (report 180-188) and dedicated rows #11 for `/hitl-packets`, #12
for the Agentic OS admin pages (`/admin/agentic-os` projects + `/admin/agentic-os/subscriptions`), and
#13 for `/admin/reset-votes` (rev9 2026-06-05 per codex Leg-2 round 8 -- OWNER-GATED / OUT-OF-DEMO-SCOPE).
Both were split out of the standalone-routes line because their dependency is a local FS file
+ env var, NOT a Supabase table, so the earlier "inherits from #2/#7/#8" claim was factually wrong
for them (rev5 closed #11; rev6 closes the structurally identical #12 agentic-os sibling, which the
rev5 pass missed). For EVERY surface it audits, against origin/main,
all six dependency classes -- tables+columns / constraints+RLS / functions+RPCs / storage buckets /
data rows / env vars -- and for each cell either (a) cites the STEP-1 probe + remedy that covers it,
or (b) marks it OUT-OF-SCOPE / DEFER with a one-line rationale. NO cell is silently absent: every
dependency a surface has is either probe+remedy-covered or explicitly deferred. The J1-J4 round-4
additions (poll RPCs, matrix_reviews, legacy-NOT-NULL, matrix_map data) were FOUND by this very
audit and are now closed below.

Legend for cells: `[probe -> remedy]` = covered; `none` = surface has no dependency of that class;
`OUT-OF-SCOPE` / `DEFER` = real dependency the kit deliberately does not paste (rationale inline).

| # | Surface (report row) | Tables + columns | Constraints + RLS | Functions + RPCs | Storage buckets | Data rows | Env vars |
|---|---|---|---|---|---|---|---|
| 1 | Auth + middleware + RBAC | `user_roles` [1b -> Remedy B] | RLS own-row + admin [in Remedy B] | none | none | admin row [1g -> Remedy C] | `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY` [STEP 3] |
| 2 | Matrix Options (8 tabs) | CALC happy path: none (catalog is static JSON import). EVIDENCE LIBRARY review/admin runtime DOES touch Supabase (rev8 2026-06-05 per codex Leg-2 round 7): `promoted_parameter_values` (hydrate on mount + promote-write), `parameter_value_reviews` (qa-review), `catalog_evidence_items`, `catalog_sources`, `source_lead_triage` (+`user_roles` admin gate) [1m -> apply named catalog migrations]; admin Catalog Staging Review adds `catalog_extraction_staging` [1m -> migration 20260527000004]. Saved-views uses `user_saved_views`, migration-backed | RLS for saved-views [migration 20260530000002; DEFER if absent]; per-table RLS for the catalog tables ships IN each named catalog migration (rev8) | Interactive Map: `fetch_samples_with_hidden_summary`, `is_email_allowlisted`, `fetch_measurements_for_samples` [1e/1f -> Remedy D]. Staging approve: `catalog_approve_staging_row` + `catalog_approve_staging_rows_bulk` RPCs [1m -> migrations 20260527000005 / 20260530000001 / 20260602000001] | none | catalog static (in build); map data [1k -> ETL OUT-OF-SCOPE]; promoted/review/evidence/source/triage/staging ROWS created in-app (DEFER) | Supabase URL/ANON [STEP 3] |
| 3 | BN-RRM (maps, HITL, canvas) | Jermilova portal `document_reviews` [migration 20260517; covered by normal migration apply] | `document_reviews` RLS [same migration] | none | none | static JSON under `public/bn-rrm/` (ships in build) -- none in DB | Supabase URL/ANON [STEP 3] |
| 4 | Regulatory-review engine v1 | none (SQLite, not Supabase) | none | none | none | local `src/data/regulatory-review.db` (local-disk, ~166MB; not in repo) -- OUT-OF-SCOPE (local-only by design) | `LOCAL_ENGINE_ENABLED=true` + subprocess paths [STEP 3] |
| 5 | Engine-v2 views (cutover) | `v2_projects.applicable_policy_ids` [1a/1a-2 -> Remedy A]; base `v2_projects`/`v2_submission_files`/`v2_extraction_runs`/`v2_evaluations` [1a -> OUT-OF-SCOPE base schema] | RLS `auth.uid()=user_id` on v2_projects (base schema) [OUT-OF-SCOPE] | none on read views | none | per-project rows (owner-created via wizard) -- DEFER (created in-app) | Supabase URL/ANON [STEP 3]; LIVE evaluate/extract: `LOCAL_ENGINE_ENABLED` + `REG_REVIEW_ENGINE_V2_SCRIPT_PATH/_ADAPTER_PATH` [STEP 3] |
| 6 | Dashboard shell + nav | none (static menu config + public reads of announcements/milestones) | none new | none | none | sample announcements/milestones [DEFER -- seed by hand/admin UI; kit EXCLUDES the duplicate-prone seed INSERTs] | Supabase URL/ANON [STEP 3] |
| 7 | Admin feature pages | `announcements,milestones,discussions,discussion_replies,tags,likes,documents` (+`user_id/user_email` drift on documents) [1b/1h -> Remedy B]; `document_tags` JOIN table (no DDL in repo; written by the document-edit tag DELETE+INSERT `documents/[id]/route.ts:82,94` + read by the `/twg/documents` embed `document_tags(tags(...))` page.tsx:49) [1l -> Remedy H] | per-table RLS [in Remedy B]; `document_tags` RLS [in Remedy H] | Admin -> Users role changes call `manage_user_role_insert`/`manage_user_role_delete` (`admin/users/actions.ts:454/:464/:527`), defined in `supabase/migrations/20260527000001_user_roles_rpcs.sql` (CREATE OR REPLACE) [1n -> apply migration 20260527000001; safe re-run] (rev9 2026-06-05 per codex Leg-2 round 8); `get_users_with_emails()` for admin review-submissions list [DEFER -- apply from database_schema.sql:594 if that list errors; not a save-path blocker] | none | seed data [DEFER -- see #6] | Supabase URL/ANON [STEP 3] |
| 8 | CEW polls / TWG review / SSD | CEW: `polls,poll_votes,ranking_polls,ranking_votes,wordcloud_polls,wordcloud_votes` [1c -> Remedy E]. TWG review: `review_submissions,review_files` (+filename/mimetype/file_size/uploaded_at drift; legacy file_name/mime_type NOT NULL) [1b/1h -> Remedy B]. Matrix-Options TWG-Review tab: `matrix_reviews` [1j -> Remedy G]. SSD: none (lives in Matrix Options tab) | CEW RLS + TWG RLS [in Remedy E / Remedy B]; `review_submissions` status CHECK [1d]; `matrix_reviews` RLS+UNIQUE [Remedy G] | CEW submit RPCs `get_or_create_poll/_ranking_poll/_wordcloud_poll_fixed` [1c-2 -> Remedy E]; results views `poll_results/ranking_results/wordcloud_results` [DEFER -- apply from database_schema.sql 1051/1084/1122 if a results page errors] | TWG upload bucket `documents` [1i -> Remedy F] | CEW vote/poll rows (created in-app); no standalone SSD route -- scope gap noted in report | Supabase URL/ANON [STEP 3] |
| 9 | Agentic OS terminal | none | none | none | none | none | `NEXT_PUBLIC_AGENTIC_OS_ENABLED` + (`AGENTIC_OS_LOCAL`/`NODE_ENV`) + `AGENTIC_OS_PTY_SECRET>=32` [STEP 3 three-gate] |
| 10 | Data / infra / deploy posture | (meta-row: the union of all above) | (union) | (union) | (union) | (union) | Supabase URL/ANON always; Sentry optional [STEP 3] |
| -- | Standalone routes (report 180-188) | MOST inherit from data deps of #2/#7/#8 (e.g. `/matrix-map` = same matrix_map dep as #2 [1e/1f/1k -> Remedy D + ETL]; `/cew-results`/`/twg-results` = CEW/TWG deps of #8). `/twg/documents` reads the `document_tags` JOIN table via the `document_tags(tags(...))` embed (page.tsx:49) -- a no-DDL-in-repo table now covered by row #7 [1l -> Remedy H], NOT a pure inherit. EXCEPTIONS `/hitl-packets` (+`[sessionId]`) and the Agentic OS admin pages (`/admin/agentic-os` + `/admin/agentic-os/subscriptions`): see dedicated rows #11 and #12 below -- their dep is a LOCAL FS file/dir + env var, NOT a Supabase table, so they do NOT inherit from #2/#7/#8 | inherited (except #11/#12; `document_tags` RLS via #7/Remedy H) | inherited (except #11/#12) | inherited (except #11/#12) | inherited (except #11/#12) | Supabase URL/ANON [STEP 3]; `/hitl-packets` adds `HITL_PACKET_DIR` -- see #11; Agentic OS admin pages add `KNOWLEDGE_BASE_PATH` -- see #12 |
| 11 | `/hitl-packets` + `/hitl-packets/[sessionId]` (report 184) | none in Supabase (reads packet JSON/CSV/MD files from a LOCAL FS dir via `fs.readdirSync`/`readFileSync`, `src/lib/hitl-packets/discovery.ts:13-31`) | none | none | none (local FS dir, NOT a Supabase Storage bucket) | local packet files under `HITL_PACKET_DIR` (default `path.join(process.cwd(),'..','Regulatory-Review','1_Active_Reviews','Teck_Trail-WARP','2_Evaluation_Output')`, `discovery.ts:25-31`) -- OUT-OF-SCOPE (local-only by design, structurally like #4 engine-v1; discovery returns `[]` gracefully when the dir is absent, so the page shows "No packets found", not a 500) | `HITL_PACKET_DIR` [STEP 3 ENV CHECKLIST] (optional; default path used if unset) |
| 12 | `/admin/agentic-os` (projects) + `/admin/agentic-os/subscriptions` (report 185-186) | none in Supabase (reads LOCAL FS files `PROJECTS_MAP.md` / `AI_SUBSCRIPTIONS.md` via `fs.readFile`, `src/lib/agentic-os/parse-projects-map.ts` `readProjectsMap`, `parse-ai-subscriptions.ts:303` `readAiSubscriptions`) | none | none | none (local FS files, NOT a Supabase Storage bucket) | local files `PROJECTS_MAP.md` / `AI_SUBSCRIPTIONS.md` under `KNOWLEDGE_BASE_PATH` (default `path.join(process.cwd(),'..','Knowledge-Base')`, `parse-projects-map.ts:254` / `parse-ai-subscriptions.ts:287`) -- OUT-OF-SCOPE (local-only by design, structurally like #4 engine-v1 and #11 hitl-packets; the page wraps the read in try/catch and renders an admin-friendly load-error envelope naming the expected path, NOT a 500, when the file is absent; admin-only) | `KNOWLEDGE_BASE_PATH` [STEP 3 ENV CHECKLIST] (optional; default path used if unset) |
| 13 | `/admin/reset-votes` (rev9 2026-06-05 per codex Leg-2 round 8) | reads/deletes `poll_votes` + `ranking_votes` (`ResetVotesClient.tsx:27/33` `.delete()`) -- TABLES are covered by #8 (Remedy E), but this surface adds a DESTRUCTIVE permanent-delete failure mode the #8 inherit does NOT capture | none new | `create_vote_backup` (`ResetVotesClient.tsx:20`, the "with backup" path) -- NO DEFINITION anywhere in repo (verified: the ONLY occurrence of `create_vote_backup` on origin/main is that single call site; no DDL in `database_schema.sql` or `supabase/migrations/`). OWNER-GATED / OUT-OF-DEMO-SCOPE; the "with backup" path 500s until defined. NO PROBE / NO REMEDY PROVIDED BY DESIGN -- a reconstruction would be a code-derived guess with no repo source -> DEFER recommended (do not click in a demo) | none | n/a (this route DELETES vote rows -- permanent) | Supabase URL/ANON [STEP 3] |

### Cells explicitly marked DEFER / OUT-OF-SCOPE (every one, with rationale)

- #2 saved-views RLS / `user_saved_views`: migration-backed (`20260530000002_user_saved_views.sql`) ->
  covered by the normal migration-apply path, not a kit paste; DEFER if a saved-view error appears
  (apply that migration). Matrix Options core (8 tabs, calculators, catalog) has NO DB dep.
- #2 / #-- map DATA rows: loaded by the owner-run ETL `scripts/matrix-map/etl_bnrrm_to_supabase.py`
  (+ `split_etl_output.py`), NOT by migrations -> OUT-OF-KIT-SQL-SCOPE; 1k surfaces the empty-map
  case so it is not silently green.
- #3 BN-RRM static JSON: ships in the build under `public/bn-rrm/` -> no runtime DB/env dep; nothing
  to probe. `document_reviews` (Jermilova) is migration-backed (`20260517`) -> normal apply path.
- #4 engine-v1 SQLite + `regulatory-review.db`: local-disk artifact, local-only BY DESIGN ->
  OUT-OF-SCOPE for a Supabase kit; STEP 3 covers its env gate.
- #5 engine-v2 BASE schema (`v2_projects` and siblings) + its RLS: owner-gated, sources under
  `supabase/engine_v2/` -> OUT-OF-KIT-SCOPE per INTERPRETATION 1a (only the `applicable_policy_ids`
  column is in-scope via Remedy A). Per-project rows are created in-app via the wizard -> DEFER.
- #6 / #7 seed announcements/milestones: the kit DELIBERATELY EXCLUDES the duplicate-prone seed
  INSERTs (database_schema.sql:871-896) -> DEFER (seed by hand or via admin UI for non-zero metrics).
- #7 `get_users_with_emails()`: needed only by the admin review-submissions LIST view, not the
  save/submit path -> DEFER (apply that one function block from database_schema.sql:594 if the list
  errors; not a demo-blocker).
- #8 poll RESULTS views (`poll_results`,`ranking_results`,`wordcloud_results`): not on the submit
  path -> DEFER (apply the matching CREATE OR REPLACE VIEW from database_schema.sql if a results page
  errors).
- #8 SSD standalone route: no separate SSD route exists (SSD is a Matrix Options tab) -> scope gap,
  noted in the report; nothing to probe.
- #11 `/hitl-packets` (+`[sessionId]`) packet files + `HITL_PACKET_DIR`: the page reads packet
  JSON/CSV/MD from a LOCAL FILESYSTEM directory (`fs.readdirSync`/`readFileSync` in
  `src/lib/hitl-packets/discovery.ts`), sourced from env `HITL_PACKET_DIR` (default path under the
  sibling `Regulatory-Review` repo) -- structurally like #4 engine-v1: a local-disk artifact,
  local-only BY DESIGN -> OUT-OF-SCOPE for a Supabase kit. The page prints the dir it looked in and
  the discovery returns `[]` when the dir is absent, so the surface degrades to "No packets found"
  (NOT a 500). STEP 3 ENV CHECKLIST now lists `HITL_PACKET_DIR` (optional; default path if unset).
  This corrects the earlier matrix claim that `/hitl-packets` inherited from #2/#7/#8 data deps --
  it does not; its only dependency is the local FS dir + env var, now covered by row #11 + STEP 3.
- #12 Agentic OS admin pages (`/admin/agentic-os` projects + `/admin/agentic-os/subscriptions`) local
  files + `KNOWLEDGE_BASE_PATH`: both pages read `PROJECTS_MAP.md` / `AI_SUBSCRIPTIONS.md` from the
  LOCAL FILESYSTEM via `fs.readFile` (`src/lib/agentic-os/parse-projects-map.ts` `readProjectsMap`,
  `parse-ai-subscriptions.ts:303` `readAiSubscriptions`), sourced from env `KNOWLEDGE_BASE_PATH`
  (default `path.join(process.cwd(),'..','Knowledge-Base')`, resolver at
  `parse-projects-map.ts:254` / `parse-ai-subscriptions.ts:287`) -- structurally like #4 engine-v1
  and #11 hitl-packets: a local-disk artifact, local-only BY DESIGN -> OUT-OF-SCOPE for a Supabase
  kit. Each page wraps the read in try/catch and renders an admin-friendly load-error envelope that
  names the expected path and the env var when the file is absent, so the surface degrades to a
  helpful message (NOT a 500); admin-only. STEP 3 ENV CHECKLIST now lists `KNOWLEDGE_BASE_PATH`
  (optional; default path if unset). This corrects the earlier standalone-routes claim that these
  admin sub-pages inherited Working/Partial from the #2/#7/#8 Supabase data deps -- they do not;
  their only dependency is the local FS file + env var, now covered by row #12 + STEP 3.
- #-- `/demo-matrix-graph`: public static demo page, no auth and no DB -> no dependency to cover.

### New uncovered dependencies this J5 audit found, and how they were closed

The matrix audit SURFACED four round-4 gaps plus one round-5 gap plus one round-6 gap plus one rev5
Opus-verify gap plus one round-7 gap (the Matrix Options Evidence Library catalog runtime) plus two
round-8 gaps (the Admin Users role-change RPCs and the reset-votes destructive/no-DDL route); all are
now closed in STEP 1 + Remedies + STEP 3:
1. CEW submit RPCs (`get_or_create_poll/_ranking_poll/_wordcloud_poll_fixed`) -- helper functions
   only in database_schema.sql, not migrations; tables-only Remedy E left submits 500ing. CLOSED:
   probe 1c-2 + Remedy E rev4 FUNCTION block (+ paired GRANT EXECUTE).
2. `matrix_reviews` -- written by the Matrix Options TWG-Review tab + read by /admin/matrix-review,
   with NO CREATE TABLE anywhere in the repo. CLOSED: probe 1j + new Remedy G (code-derived contract,
   verify-against-live caveat, or DEFER) + a follow-up backlog item to land canonical DDL.
3. review_files legacy NOT-NULL (`file_name`/`mime_type`) -- a partially-repaired table with live
   columns present but legacy NOT NULLs intact would false-clear and still 500 on upload. CLOSED:
   1h extended with an `is_nullable` legacy-NOT-NULL audit + tightened clear-condition routing to
   Remedy B's relax block.
4. matrix_map DATA -- schema/RPC probes (1e/1f) pass on an empty map because rows come from the
   owner-run ETL, not migrations. CLOSED: parse-safe count probe 1k + interpretation (0 rows = run
   the ETL or DEFER the map; OUT-OF-KIT-SQL-SCOPE).
5. (rev5 2026-06-05) `/hitl-packets` `HITL_PACKET_DIR` + local packet files -- the `/hitl-packets`
   surface (an enumerated demo route, report line 184) reads packet JSON/CSV/MD from a LOCAL FS dir
   via `fs.readdirSync`/`readFileSync` (`src/lib/hitl-packets/discovery.ts:13-31`), sourced from env
   `HITL_PACKET_DIR` (default path under the sibling `Regulatory-Review` repo). The matrix's
   standalone-routes row had WRONGLY claimed it inherited from the Supabase data deps of #2/#7/#8; its
   real dependency is a local FS dir + env var, structurally like #4 engine-v1. Low severity (the
   discovery returns `[]` gracefully when the dir is absent -> "No packets found", not a 500), but a
   live dependency absent from the matrix is still a gap. CLOSED: dedicated matrix row #11 marking the
   local-packet-files dependency OUT-OF-SCOPE (local-only by design) + `HITL_PACKET_DIR` added to the
   STEP 3 ENV CHECKLIST (optional; default path if unset) + the standalone-routes row corrected to
   point at #11 instead of falsely inheriting.
6. (rev6 2026-06-05) Agentic OS admin pages `KNOWLEDGE_BASE_PATH` + local files -- the
   `/admin/agentic-os` (projects) and `/admin/agentic-os/subscriptions` surfaces (enumerated demo
   routes, report lines 185-186) read the LOCAL FS files `PROJECTS_MAP.md` / `AI_SUBSCRIPTIONS.md`
   via `fs.readFile` (`src/lib/agentic-os/parse-projects-map.ts` `readProjectsMap`,
   `parse-ai-subscriptions.ts:303` `readAiSubscriptions`), gated on env `KNOWLEDGE_BASE_PATH`
   (default `path.join(process.cwd(),'..','Knowledge-Base')`, resolver at
   `parse-projects-map.ts:254` / `parse-ai-subscriptions.ts:287`). This is the SAME defect class the
   round-5 audit closed for `/hitl-packets`: the standalone-routes line had WRONGLY enumerated these
   admin sub-pages as adding "NO new failure mode" and inheriting Working/Partial from the Supabase
   data deps of #2/#7/#8 -- factually wrong, since their data source is a local file + env var, not a
   covered Supabase table. The rev5 pass corrected only `/hitl-packets` and left the structurally
   identical agentic-os sibling uncovered. Low severity (each page wraps the read in try/catch and
   renders an admin-friendly load-error envelope, NOT a 500; admin-only; env has a sensible default),
   but a live dependency absent from the matrix is still a gap under the J5 rule. CLOSED: dedicated
   matrix row #12 marking the local-files dependency OUT-OF-SCOPE (local-only by design) +
   `KNOWLEDGE_BASE_PATH` added to the STEP 3 ENV CHECKLIST (optional; default path if unset) + the
   standalone-routes row corrected to point at #12 instead of falsely inheriting + report line 186
   inheritance claim corrected.

7. (rev5 2026-06-05 per Opus matrix verify) `document_tags` JOIN table -- read by the `/twg/documents`
   page via the PostgREST embed `document_tags(tags(...))` (`src/app/(dashboard)/twg/documents/page.tsx:49`)
   and written by the document-edit API tag DELETE+INSERT of `{ document_id, tag_id }`
   (`src/app/api/documents/[id]/route.ts:82,94`; also `src/lib/db/queries.ts:106` cascade delete +
   `:316` createDocumentTag), with NO CREATE TABLE anywhere in the repo (database_schema.sql or
   supabase/migrations/). This is the SAME no-DDL-in-repo class as gap #2 (matrix_reviews): the 1b
   loop never probed it, so it can be silently absent on a fresh project and 500 the documents tag
   surface. CLOSED: probe 1l + new Remedy H (code-derived contract -- both FK columns BIGINT to match
   the live `documents.id`/`tags.id` BIGSERIAL in database_schema.sql, verify-against-live caveat, or
   DEFER) + matrix row #7 + standalone-routes cells citing 1l -> Remedy H + a follow-up backlog item
   to land canonical DDL.

8. (rev8 2026-06-05 per codex Leg-2 round 7) Matrix Options EVIDENCE LIBRARY catalog-runtime tables --
   row #2 had claimed "none on happy path" for tables, true ONLY for the calculator path. The Evidence
   Library review/admin runtime on origin/main reads AND writes six Supabase catalog tables:
   `promoted_parameter_values` (hydrate on mount + promote-write -- EvidenceLibrary.tsx:3149
   `hydrateFromSupabase()`; store hydrateFromSupabase at promotedCandidatesStore.ts:177-180 ->
   supabase-sync.ts:123-128 `fetchPromotedValues` `.from('promoted_parameter_values')`),
   `parameter_value_reviews` (qa-review-sync.ts:115/145), `catalog_evidence_items`
   (evidence-sync.ts:139/169/222), `catalog_sources` (source-sync.ts:245/278/330), `source_lead_triage`
   (triage-sync.ts:83/171), and -- via the admin Catalog Staging Review surface -- `catalog_extraction_staging`
   (staging.ts:250/443/509) plus the `catalog_approve_staging_row` / `catalog_approve_staging_rows_bulk`
   RPCs (staging.ts:326/387). Marking row #2 as having no table dependency except saved-views meant STEP 1
   could go green while these catalog actions silently emptied out (reads fail soft -> []/{}) or FAILED
   their writes. UNLIKE gaps #2/#7 (matrix_reviews/document_tags, NO DDL in repo), these ARE repo-backed:
   four of five tables + both staging RPCs have committed migrations under `supabase/migrations/`
   (`20260527000003/_000004/_000005/_000006/_000007/_000008`, `20260530000001`, `20260602000001`);
   `parameter_value_reviews` is the lone exception -- Studio-applied, NO migration on disk (per
   STREAM_D_HITL_PAUSE_SQL_EXPLORE_2026_05_27.md). CLOSED: probe 1m (batched read-only to_regclass set) +
   interpretation listing the named migrations in dependency order + an idempotency caveat (the five
   CREATE TABLE migrations are PLAIN `CREATE TABLE`, NOT `IF NOT EXISTS` -- apply only for a 1m-absent
   table or they error "relation already exists"; the RPC migrations are `CREATE OR REPLACE`, safe to
   re-run) + a graceful-degradation note (read helpers fail soft; writes fail without the tables) +
   matrix row #2 cells updated with the tables + RPCs + probe/remedy refs.

9. (rev9 2026-06-05 per codex Leg-2 round 8) Admin -> Users role-change RPCs
   (`manage_user_role_insert` / `manage_user_role_delete`) -- row #7 covered the admin TABLES but its
   Functions+RPCs cell listed only `get_users_with_emails()`. The Admin Users page does NOT write
   `user_roles` directly: it calls the two manage_user_role_* RPCs
   (`src/app/(dashboard)/admin/users/actions.ts:454` delete, `:464` + `:527` insert), which are defined
   in `supabase/migrations/20260527000001_user_roles_rpcs.sql` (CREATE OR REPLACE FUNCTION
   `public.manage_user_role_insert` at :11, `public.manage_user_role_delete` at :56). A target with the
   `user_roles` table present (1b green) but that migration NOT applied would pass the kit and still
   show broken role add/remove buttons (500). UNLIKE gaps #2/#7 (matrix_reviews/document_tags, no DDL in
   repo), this IS repo-backed -- a normal migration apply, safe to re-run (`CREATE OR REPLACE`). CLOSED:
   probe 1n (to_regprocedure for both signatures) + interpretation (apply migration 20260527000001 for
   any present=false; safe re-run; or DEFER if role changes are out of the demo script) + matrix row #7
   Functions+RPCs cell updated.
10. (rev9 2026-06-05 per codex Leg-2 round 8) `/admin/reset-votes` -- the standalone-routes line had
   grouped it with admin sub-pages that "add no new failure mode," inheriting the covered poll-table
   deps of #8. That is wrong on two counts: (a) the "with backup" path calls `rpc('create_vote_backup')`
   (`ResetVotesClient.tsx:20`), a FUNCTION with NO definition anywhere in the repo (verified: the only
   `create_vote_backup` occurrence on origin/main is that single call site -- no DDL in
   `database_schema.sql` or `supabase/migrations/`), so it 500s on a clean project; and (b) the page
   exposes PERMANENT vote deletion (`poll_votes`/`ranking_votes` `.delete()`, `ResetVotesClient.tsx:27/33`)
   -- a destructive action no covered surface has. CLOSED differently from the other no-DDL gaps: the kit
   provides NEITHER a probe NOR a remedy BY DESIGN. The no-DDL TABLES (1j/1l) are reconstructable from a
   clear column contract; a FUNCTION body has no repo source to reconstruct from safely, so it is
   OUT-OF-SCOPE and the route is marked OWNER-GATED / OUT-OF-DEMO-SCOPE with a DEFER recommendation (do
   not click in a demo). CLOSED: matrix row #13 + a STEP 1 INTERPRETATION reset-votes note (no probe/no
   remedy, DEFER, name the permanent-deletion hazard) + the readiness report standalone-routes para
   pulling reset-votes OUT of the "no new failure mode" group.

No FURTHER uncovered dependency was found beyond these ten: every cell in the matrix above is either
probe+remedy-covered or explicitly DEFER/OUT-OF-SCOPE with a rationale.
