-- ============================================================================
-- 00_preflight_readonly.sql
-- READ-ONLY. Run first if you want to see what's missing. Optional -- the apply
-- blocks below (01..NN) are ALL idempotent, so you can skip this and just paste
-- them in order. Nothing in this file writes; every probe uses to_regclass /
-- to_regprocedure / information_schema / a guarded count, so it never errors on a
-- fresh project. Probe 1k emits via RAISE NOTICE -- read the Studio "Messages" pane.
-- Source: DEMO_BLOCKER_RESOLUTION_KIT_2026_06_04.md STEP 1 probes 1a-1n (verbatim).
-- Run the 1a-1n block as ONE batch; then run the 1g count block ONLY if 1b shows
-- user_roles present. See README.md for the probe -> batch routing table.
-- ============================================================================

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


-- ----------------------------------------------------------------------------
-- OPTIONAL count block (1g): run ONLY after 1b confirms user_roles is present,
-- so it never errors on a fresh project. Gates Batch 02 (admin grant).
-- ----------------------------------------------------------------------------
-- 1g. At least one admin user exists? (gates /admin). Expect >= 1. Run only if 1b shows
--     user_roles present.
select count(*) as admin_count
from public.user_roles
where role = 'admin';
