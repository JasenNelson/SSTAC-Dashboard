-- =====================================================================
-- verify_readonly.sql -- post-apply checks for
-- matrix_paper_review_persistence_DRAFT.sql (revision 5)
-- SELECT-only catalog queries; reads no user response rows (only the
-- seeded reference table and aggregate counts). Each query lists its
-- expected result. Safe for read-only MCP execute_sql.
-- =====================================================================

-- V1. Tables exist. Expect 3 rows.
SELECT c.relname, c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public'
   AND c.relname IN ('matrix_paper_review_questions',
                     'matrix_paper_review_responses',
                     'matrix_paper_review_response_events')
 ORDER BY c.relname;
-- Expect: all three rls_enabled = true, rls_forced = false.

-- V2. Response table columns exposed to the app. Expect 13 rows:
--   id uuid, user_id uuid, document_version text, manifest_sha256 text,
--   cohort_id text, question_id text, draft_text text, submitted_text text,
--   revision integer, submitted_revision integer,
--   submitted_at timestamp with time zone (nullable),
--   updated_at timestamp with time zone (NOT NULL, default now()),
--   created_at timestamp with time zone.
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name = 'matrix_paper_review_responses'
 ORDER BY ordinal_position;

-- V3. Constraints. Expect on responses: pkey, identity_key (UNIQUE
--   user_id, document_version, manifest_sha256, question_id),
--   question_fkey, user_id fkey, 5 CHECKs (draft_len, submitted_len,
--   revision, submitted_revision, submitted_set; no timestamp-format CHECKs); on questions: pkey,
--   identity_key, number_key, 5 CHECKs; on events: pkey, 2 FKs, 4 CHECKs.
SELECT conrelid::regclass AS table_name, conname, contype,
       pg_get_constraintdef(oid) AS definition
  FROM pg_constraint
 WHERE conrelid IN ('public.matrix_paper_review_questions'::regclass,
                    'public.matrix_paper_review_responses'::regclass,
                    'public.matrix_paper_review_response_events'::regclass)
 ORDER BY 1, 2;

-- V4. Indexes. Expect questions_probe_idx, responses_release_idx,
--   events_response_idx, events_user_idx plus the constraint indexes.
--   events_user_idx must be ON (user_id, occurred_at) (serves the RPC write throttle).
SELECT tablename, indexname, indexdef
  FROM pg_indexes
 WHERE schemaname = 'public'
   AND tablename LIKE 'matrix_paper_review%'
 ORDER BY 1, 2;

-- V5. Policies. Expect exactly 5, all cmd = SELECT, roles = {authenticated}:
--   questions_select_authenticated (qual true),
--   responses_select_own, responses_select_paper_admin,
--   response_events_select_own, response_events_select_paper_admin.
--   No INSERT / UPDATE / DELETE / ALL policies.
SELECT tablename, policyname, cmd, roles, qual, with_check
  FROM pg_policies
 WHERE schemaname = 'public'
   AND tablename LIKE 'matrix_paper_review%'
 ORDER BY 1, 2;

-- V6. Table grants to API roles. Expect exactly 3 rows:
--   authenticated SELECT on each table. Zero rows for anon. No
--   INSERT/UPDATE/DELETE/TRUNCATE for anon or authenticated.
SELECT table_name, grantee, privilege_type
  FROM information_schema.role_table_grants
 WHERE table_schema = 'public'
   AND table_name LIKE 'matrix_paper_review%'
   AND grantee IN ('anon', 'authenticated', 'PUBLIC')
 ORDER BY 1, 2, 3;

-- V7. Sequence privileges. Expect all false.
SELECT has_sequence_privilege('anon', 'public.matrix_paper_review_response_events_id_seq', 'USAGE')          AS anon_usage,
       has_sequence_privilege('authenticated', 'public.matrix_paper_review_response_events_id_seq', 'USAGE') AS auth_usage,
       has_sequence_privilege('authenticated', 'public.matrix_paper_review_response_events_id_seq', 'UPDATE') AS auth_update;

-- V8. Functions: security definer, volatility, search_path, owner.
--   Expect:
--   is_matrix_options_paper_admin  secdef=true  volatility=s  config {search_path=public, pg_temp}
--   matrix_paper_review_save_draft secdef=true  volatility=v  config {search_path=public, pg_temp}
--   matrix_paper_review_submit     secdef=true  volatility=v  config {search_path=public, pg_temp}
--   matrix_paper_review_utf16_length secdef=false volatility=i  config {search_path=pg_catalog, pg_temp}
--   matrix_paper_review_events_block_update secdef=false (trigger fn)
--   owner postgres for all; result_type boolean / jsonb / jsonb / trigger.
SELECT p.proname,
       pg_get_function_identity_arguments(p.oid) AS args,
       pg_get_function_result(p.oid)             AS result_type,
       p.prosecdef                               AS security_definer,
       p.provolatile                             AS volatility,
       p.proconfig                               AS config,
       pg_get_userbyid(p.proowner)               AS owner
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname IN ('is_matrix_options_paper_admin',
                     'matrix_paper_review_save_draft',
                     'matrix_paper_review_submit',
                     'matrix_paper_review_utf16_length',
                     'matrix_paper_review_events_block_update')
 ORDER BY p.proname;

-- V9. Function EXECUTE privileges. Expect:
--   helper, save_draft, submit: anon=false, authenticated=true,
--     service_role=false, public_acl_entry=false
--   utf16_length, events_block_update: all false.
SELECT p.proname,
       has_function_privilege('anon', p.oid, 'EXECUTE')          AS anon_exec,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_exec,
       has_function_privilege('service_role', p.oid, 'EXECUTE')  AS service_exec,
       EXISTS (SELECT 1 FROM aclexplode(p.proacl) a
                WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE') AS public_acl_entry
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname IN ('is_matrix_options_paper_admin',
                     'matrix_paper_review_save_draft',
                     'matrix_paper_review_submit',
                     'matrix_paper_review_utf16_length',
                     'matrix_paper_review_events_block_update')
 ORDER BY p.proname;

-- V10. Append-only trigger present. Expect 1 row, BEFORE UPDATE, enabled 'O'.
SELECT tgname, tgenabled, pg_get_triggerdef(oid) AS definition
  FROM pg_trigger
 WHERE tgrelid = 'public.matrix_paper_review_response_events'::regclass
   AND NOT tgisinternal;

-- V11. Seed count for the current release. Expect 12.
SELECT count(*) AS seeded_questions
  FROM public.matrix_paper_review_questions
 WHERE document_version = '1.0.11-remediated-7-8-successor-20260918-D'
   AND manifest_sha256  = '5d83a3c9ba78e4da234c70678fcf57db9abbefc189002303879ebc0c80ac926e';

-- V12. Seed content (reference data, not user data). Expect 12 rows:
--   1-3 categories, 4-5 pathway-grid, 6-7 exposure-assumptions,
--   8-9 inputs-evidence, 10-11 methods-water-type, 12 inputs-evidence;
--   question_id = rpq:1.0.11-remediated-7-8-successor-20260918-D:qNN;
--   no accepting_responses column exists (V12b expects 0 rows).
SELECT question_number, cohort_id, question_id
  FROM public.matrix_paper_review_questions
 WHERE document_version = '1.0.11-remediated-7-8-successor-20260918-D'
   AND manifest_sha256  = '5d83a3c9ba78e4da234c70678fcf57db9abbefc189002303879ebc0c80ac926e'
 ORDER BY question_number;

-- V12b. Removed-in-revision-2 column must be absent. Expect 0 rows.
SELECT column_name
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name = 'matrix_paper_review_questions'
   AND column_name = 'accepting_responses';

-- V13. Aggregate-only sanity (no row contents). Expect 0 / 0 right after apply.
SELECT (SELECT count(*) FROM public.matrix_paper_review_responses)       AS response_rows,
       (SELECT count(*) FROM public.matrix_paper_review_response_events) AS event_rows;

-- V14. search_path hygiene precondition for the SECURITY DEFINER functions
--   (search_path = public, pg_temp; pg_catalog is implicitly searched first).
--   Expect all false: no API role can create objects in public that could
--   shadow a referenced name.
SELECT r AS role_name, has_schema_privilege(r, 'public', 'CREATE') AS can_create_in_public
  FROM unnest(ARRAY['anon', 'authenticated', 'service_role']) AS r;

-- V15 (revision 3). Text-length CHECKs use the UTF-16 helper, not
--   char_length. Expect 2 rows (draft_len_chk, submitted_len_chk), each
--   definition containing matrix_paper_review_utf16_length and
--   uses_helper = true, uses_char_length = false.
SELECT conname,
       pg_get_constraintdef(oid) AS definition,
       pg_get_constraintdef(oid) LIKE '%matrix_paper_review_utf16_length(%' AS uses_helper,
       pg_get_constraintdef(oid) LIKE '%char_length(%'                      AS uses_char_length
  FROM pg_constraint
 WHERE conrelid = 'public.matrix_paper_review_responses'::regclass
   AND conname IN ('matrix_paper_review_responses_draft_len_chk',
                   'matrix_paper_review_responses_submitted_len_chk')
 ORDER BY conname;

-- V16 (revision 3). UTF-16 helper behaviour (pure function over
--   literals; reads no table). Run as a role that can execute it (the
--   migration owner / SQL editor). Expect 4, 3, 0, 40000.
SELECT public.matrix_paper_review_utf16_length('a' || chr(128512) || 'b') AS astral_mixed,
       public.matrix_paper_review_utf16_length('abc')                    AS bmp_only,
       public.matrix_paper_review_utf16_length('')                       AS empty,
       public.matrix_paper_review_utf16_length(repeat(chr(128512), 20000)) AS astral_20000;

-- V17 (revision 3). Session TimeZone is UTC (PostgREST renders
--   timestamptz with this offset). Expect tz = 'UTC'. Note: this is the
--   verifying session's value; V18 covers the PostgREST roles.
SELECT current_setting('TimeZone') AS tz;

-- V18 (revision 3). No TimeZone override at database level or for the
--   PostgREST roles (authenticator / authenticated / anon), including
--   database-wide (setrole = 0) and all-database (setdatabase = 0)
--   entries. Expect 0 rows.
SELECT s.setdatabase, s.setrole::regrole AS role_name, s.setconfig
  FROM pg_db_role_setting s
 WHERE (s.setdatabase = 0
        OR s.setdatabase = (SELECT oid FROM pg_database WHERE datname = current_database()))
   AND (s.setrole = 0
        OR s.setrole IN (SELECT oid FROM pg_roles
                          WHERE rolname IN ('authenticator', 'authenticated', 'anon')))
   AND EXISTS (SELECT 1 FROM unnest(s.setconfig) AS c WHERE c ILIKE 'timezone=%');

-- V19 (revisions 4-5). Both write RPCs carry the anonymous-session reject
--   and the serialized write throttle; submit also rejects blank text.
--   Expect exactly 2 rows: has_guards = true for both; blank_guard = true
--   for matrix_paper_review_submit and false for save_draft.
SELECT p.proname,
       pg_get_functiondef(p.oid) LIKE '%is_anonymous%'
         AND pg_get_functiondef(p.oid) LIKE '%rate_limited%'
         AND pg_get_functiondef(p.oid) LIKE '%pg_advisory_xact_lock%' AS has_guards,
       pg_get_functiondef(p.oid) LIKE '%blank_submission%' AS blank_guard
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname IN ('matrix_paper_review_save_draft', 'matrix_paper_review_submit')
 ORDER BY 1;
