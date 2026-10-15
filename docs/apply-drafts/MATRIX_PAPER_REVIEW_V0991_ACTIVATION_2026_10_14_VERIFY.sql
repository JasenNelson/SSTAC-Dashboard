-- =====================================================================
-- VERIFY (read-only) for MATRIX_PAPER_REVIEW_V0991_ACTIVATION_2026_10_14.sql
-- DRAFT -- NOT RUN. SELECT-only; reads no user response rows (only the
-- seeded reference table and aggregate counts). One result set of labelled
-- rows: check_name / expected / actual / ok. Every ok must be true.
-- Rows 70/71 are informational (label starts with 'info:', expected 'n/a', ok
-- always true): legitimate reviewer traffic after the activation commit may make
-- the v0.9.91 counts > 0, so they must not gate the postflight.
-- Manifest sha256 expected:
--   6d336b08b7214a17456ff943eb6f56f33e90d3477f4bd9fe1488c5fe0846a272
-- =====================================================================
WITH
fn AS (
  SELECT p.oid, p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' AS ident,
         p.prosecdef, p.provolatile, p.proconfig, pg_get_userbyid(p.proowner) AS owner, p.proacl, p.proowner
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname IN ('is_matrix_options_paper_admin','matrix_paper_review_utf16_length',
                       'matrix_paper_review_events_block_update','matrix_paper_review_save_draft',
                       'matrix_paper_review_submit')
),
want(ident, secdef, vol, cfg, auth_exec) AS (
  VALUES
  ('is_matrix_options_paper_admin()', true, 's', '{"search_path=public, pg_temp"}'::text, true),
  ('matrix_paper_review_utf16_length(p_text text)', false, 'i', '{"search_path=pg_catalog, pg_temp"}'::text, false),
  ('matrix_paper_review_events_block_update()', false, 'v', '{"search_path=public, pg_temp"}'::text, false),
  ('matrix_paper_review_save_draft(p_document_version text, p_manifest_sha256 text, p_cohort_id text, p_question_id text, p_text text, p_expected_revision integer)', true, 'v', '{"search_path=public, pg_temp"}'::text, true),
  ('matrix_paper_review_submit(p_document_version text, p_manifest_sha256 text, p_cohort_id text, p_question_id text, p_text text, p_expected_revision integer)', true, 'v', '{"search_path=public, pg_temp"}'::text, true)
),
seed AS (
  SELECT document_version, manifest_sha256, cohort_id, question_id, question_number
    FROM public.matrix_paper_review_questions
),
want_seed(document_version, manifest_sha256, cohort_id, question_id, question_number) AS (
  VALUES
  ('v0.9.91', '6d336b08b7214a17456ff943eb6f56f33e90d3477f4bd9fe1488c5fe0846a272', 'categories', 'rpq:v0.9.91:q01', 1),
  ('v0.9.91', '6d336b08b7214a17456ff943eb6f56f33e90d3477f4bd9fe1488c5fe0846a272', 'categories', 'rpq:v0.9.91:q02', 2),
  ('v0.9.91', '6d336b08b7214a17456ff943eb6f56f33e90d3477f4bd9fe1488c5fe0846a272', 'categories', 'rpq:v0.9.91:q03', 3),
  ('v0.9.91', '6d336b08b7214a17456ff943eb6f56f33e90d3477f4bd9fe1488c5fe0846a272', 'pathway-grid', 'rpq:v0.9.91:q04', 4),
  ('v0.9.91', '6d336b08b7214a17456ff943eb6f56f33e90d3477f4bd9fe1488c5fe0846a272', 'pathway-grid', 'rpq:v0.9.91:q05', 5),
  ('v0.9.91', '6d336b08b7214a17456ff943eb6f56f33e90d3477f4bd9fe1488c5fe0846a272', 'exposure-assumptions', 'rpq:v0.9.91:q06', 6),
  ('v0.9.91', '6d336b08b7214a17456ff943eb6f56f33e90d3477f4bd9fe1488c5fe0846a272', 'exposure-assumptions', 'rpq:v0.9.91:q07', 7),
  ('v0.9.91', '6d336b08b7214a17456ff943eb6f56f33e90d3477f4bd9fe1488c5fe0846a272', 'inputs-evidence', 'rpq:v0.9.91:q08', 8),
  ('v0.9.91', '6d336b08b7214a17456ff943eb6f56f33e90d3477f4bd9fe1488c5fe0846a272', 'inputs-evidence', 'rpq:v0.9.91:q09', 9),
  ('v0.9.91', '6d336b08b7214a17456ff943eb6f56f33e90d3477f4bd9fe1488c5fe0846a272', 'methods-water-type', 'rpq:v0.9.91:q10', 10),
  ('v0.9.91', '6d336b08b7214a17456ff943eb6f56f33e90d3477f4bd9fe1488c5fe0846a272', 'methods-water-type', 'rpq:v0.9.91:q11', 11),
  ('v0.9.91', '6d336b08b7214a17456ff943eb6f56f33e90d3477f4bd9fe1488c5fe0846a272', 'inputs-evidence', 'rpq:v0.9.91:q12', 12)
),
seed_diff AS (
  SELECT count(*) AS n FROM (
    (SELECT * FROM want_seed EXCEPT SELECT * FROM seed)
    UNION ALL
    (SELECT * FROM seed EXCEPT SELECT * FROM want_seed)
  ) d
),
want_cols(tbl, col, dtype, nullable) AS (
  VALUES
  ('matrix_paper_review_questions', 'document_version', 'text', 'NO'),
  ('matrix_paper_review_questions', 'manifest_sha256', 'text', 'NO'),
  ('matrix_paper_review_questions', 'cohort_id', 'text', 'NO'),
  ('matrix_paper_review_questions', 'question_id', 'text', 'NO'),
  ('matrix_paper_review_questions', 'question_number', 'integer', 'NO'),
  ('matrix_paper_review_questions', 'created_at', 'timestamp with time zone', 'NO'),
  ('matrix_paper_review_responses', 'id', 'uuid', 'NO'),
  ('matrix_paper_review_responses', 'user_id', 'uuid', 'NO'),
  ('matrix_paper_review_responses', 'document_version', 'text', 'NO'),
  ('matrix_paper_review_responses', 'manifest_sha256', 'text', 'NO'),
  ('matrix_paper_review_responses', 'cohort_id', 'text', 'NO'),
  ('matrix_paper_review_responses', 'question_id', 'text', 'NO'),
  ('matrix_paper_review_responses', 'draft_text', 'text', 'NO'),
  ('matrix_paper_review_responses', 'submitted_text', 'text', 'YES'),
  ('matrix_paper_review_responses', 'revision', 'integer', 'NO'),
  ('matrix_paper_review_responses', 'submitted_revision', 'integer', 'YES'),
  ('matrix_paper_review_responses', 'submitted_at', 'timestamp with time zone', 'YES'),
  ('matrix_paper_review_responses', 'updated_at', 'timestamp with time zone', 'NO'),
  ('matrix_paper_review_responses', 'created_at', 'timestamp with time zone', 'NO'),
  ('matrix_paper_review_response_events', 'id', 'bigint', 'NO'),
  ('matrix_paper_review_response_events', 'response_id', 'uuid', 'NO'),
  ('matrix_paper_review_response_events', 'user_id', 'uuid', 'NO'),
  ('matrix_paper_review_response_events', 'document_version', 'text', 'NO'),
  ('matrix_paper_review_response_events', 'manifest_sha256', 'text', 'NO'),
  ('matrix_paper_review_response_events', 'cohort_id', 'text', 'NO'),
  ('matrix_paper_review_response_events', 'question_id', 'text', 'NO'),
  ('matrix_paper_review_response_events', 'action', 'text', 'NO'),
  ('matrix_paper_review_response_events', 'revision', 'integer', 'NO'),
  ('matrix_paper_review_response_events', 'text_sha256', 'text', 'NO'),
  ('matrix_paper_review_response_events', 'text_length', 'integer', 'NO'),
  ('matrix_paper_review_response_events', 'occurred_at', 'timestamp with time zone', 'NO')
),
act_cols AS (
  SELECT table_name::text AS tbl, column_name::text AS col, data_type::text AS dtype, is_nullable::text AS nullable
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name IN ('matrix_paper_review_questions','matrix_paper_review_responses','matrix_paper_review_response_events')
),
cols_diff AS (
  SELECT count(*) AS n FROM (
    (SELECT * FROM want_cols EXCEPT SELECT * FROM act_cols)
    UNION ALL
    (SELECT * FROM act_cols EXCEPT SELECT * FROM want_cols)
  ) d
),
want_con(tbl, conname, contype) AS (
  VALUES
  ('matrix_paper_review_questions', 'matrix_paper_review_questions_pkey', 'p'),
  ('matrix_paper_review_questions', 'matrix_paper_review_questions_identity_key', 'u'),
  ('matrix_paper_review_questions', 'matrix_paper_review_questions_number_key', 'u'),
  ('matrix_paper_review_questions', 'matrix_paper_review_questions_version_chk', 'c'),
  ('matrix_paper_review_questions', 'matrix_paper_review_questions_sha_chk', 'c'),
  ('matrix_paper_review_questions', 'matrix_paper_review_questions_cohort_chk', 'c'),
  ('matrix_paper_review_questions', 'matrix_paper_review_questions_question_chk', 'c'),
  ('matrix_paper_review_questions', 'matrix_paper_review_questions_number_chk', 'c'),
  ('matrix_paper_review_responses', 'matrix_paper_review_responses_pkey', 'p'),
  ('matrix_paper_review_responses', 'matrix_paper_review_responses_identity_key', 'u'),
  ('matrix_paper_review_responses', 'matrix_paper_review_responses_user_id_fkey', 'f'),
  ('matrix_paper_review_responses', 'matrix_paper_review_responses_question_fkey', 'f'),
  ('matrix_paper_review_responses', 'matrix_paper_review_responses_draft_len_chk', 'c'),
  ('matrix_paper_review_responses', 'matrix_paper_review_responses_submitted_len_chk', 'c'),
  ('matrix_paper_review_responses', 'matrix_paper_review_responses_revision_chk', 'c'),
  ('matrix_paper_review_responses', 'matrix_paper_review_responses_submitted_revision_chk', 'c'),
  ('matrix_paper_review_responses', 'matrix_paper_review_responses_submitted_set_chk', 'c'),
  ('matrix_paper_review_response_events', 'matrix_paper_review_response_events_pkey', 'p'),
  ('matrix_paper_review_response_events', 'matrix_paper_review_response_events_response_id_fkey', 'f'),
  ('matrix_paper_review_response_events', 'matrix_paper_review_response_events_user_id_fkey', 'f'),
  ('matrix_paper_review_response_events', 'matrix_paper_review_response_events_action_chk', 'c'),
  ('matrix_paper_review_response_events', 'matrix_paper_review_response_events_revision_chk', 'c'),
  ('matrix_paper_review_response_events', 'matrix_paper_review_response_events_sha_chk', 'c'),
  ('matrix_paper_review_response_events', 'matrix_paper_review_response_events_len_chk', 'c')
),
act_con AS (
  SELECT cl.relname::text AS tbl, c.conname::text AS conname, c.contype::text AS contype
    FROM pg_constraint c JOIN pg_class cl ON cl.oid = c.conrelid
   WHERE cl.relnamespace = 'public'::regnamespace
     AND cl.relname IN ('matrix_paper_review_questions','matrix_paper_review_responses','matrix_paper_review_response_events')
     AND c.contype IN ('p','u','f','c')
),
con_diff AS (
  SELECT count(*) AS n FROM (
    (SELECT * FROM want_con EXCEPT SELECT * FROM act_con)
    UNION ALL
    (SELECT * FROM act_con EXCEPT SELECT * FROM want_con)
  ) d
),
want_idx(tbl, indexname) AS (
  VALUES
  ('matrix_paper_review_questions', 'matrix_paper_review_questions_pkey'),
  ('matrix_paper_review_questions', 'matrix_paper_review_questions_identity_key'),
  ('matrix_paper_review_questions', 'matrix_paper_review_questions_number_key'),
  ('matrix_paper_review_questions', 'matrix_paper_review_questions_probe_idx'),
  ('matrix_paper_review_responses', 'matrix_paper_review_responses_pkey'),
  ('matrix_paper_review_responses', 'matrix_paper_review_responses_identity_key'),
  ('matrix_paper_review_responses', 'matrix_paper_review_responses_release_idx'),
  ('matrix_paper_review_response_events', 'matrix_paper_review_response_events_pkey'),
  ('matrix_paper_review_response_events', 'matrix_paper_review_response_events_response_idx'),
  ('matrix_paper_review_response_events', 'matrix_paper_review_response_events_user_idx')
),
act_idx AS (
  SELECT tablename::text AS tbl, indexname::text AS indexname
    FROM pg_indexes
   WHERE schemaname = 'public'
     AND tablename IN ('matrix_paper_review_questions','matrix_paper_review_responses','matrix_paper_review_response_events')
),
idx_diff AS (
  SELECT count(*) AS n FROM (
    (SELECT * FROM want_idx EXCEPT SELECT * FROM act_idx)
    UNION ALL
    (SELECT * FROM act_idx EXCEPT SELECT * FROM want_idx)
  ) d
),
hij_names(fname) AS (
  -- Same list as PREFLIGHT: every unqualified function the RPC bodies call, plus relatives.
  VALUES ('convert_to'),('length'),('octet_length'),('encode'),('digest'),('sha256'),('now'),
         ('jsonb_build_object'),('to_char'),('regexp_count'),('char_length'),('btrim'),
         ('hashtext'),('pg_advisory_xact_lock'),('count'),('gen_random_uuid')
),
hij AS (
  SELECT p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' AS ident
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname IN (SELECT fname FROM hij_names)
)
SELECT * FROM (
  SELECT 10 AS ord, 'table ' || t.relname || ' rls_enabled' AS check_name, 'true' AS expected,
         coalesce(c.relrowsecurity::text, 'missing') AS actual, coalesce(c.relrowsecurity, false) AS ok
    FROM (VALUES ('matrix_paper_review_questions'),('matrix_paper_review_responses'),('matrix_paper_review_response_events')) AS t(relname)
    LEFT JOIN pg_class c ON c.relname = t.relname AND c.relnamespace = 'public'::regnamespace
  UNION ALL
  SELECT 20, 'function present: ' || w.ident, '1', (SELECT count(*) FROM fn WHERE fn.ident = w.ident)::text,
         (SELECT count(*) FROM fn WHERE fn.ident = w.ident) = 1
    FROM want w
  UNION ALL
  SELECT 21, 'function security_definer: ' || w.ident, w.secdef::text, coalesce(f.prosecdef::text, 'missing'),
         coalesce(f.prosecdef = w.secdef, false)
    FROM want w LEFT JOIN fn f ON f.ident = w.ident
  UNION ALL
  SELECT 22, 'function provolatile: ' || w.ident, w.vol, coalesce(f.provolatile::text, 'missing'),
         coalesce(f.provolatile::text = w.vol, false)
    FROM want w LEFT JOIN fn f ON f.ident = w.ident
  UNION ALL
  SELECT 23, 'function proconfig: ' || w.ident, coalesce(w.cfg, '<null>'), coalesce(f.proconfig::text, '<null>'),
         f.ident IS NOT NULL AND f.proconfig::text IS NOT DISTINCT FROM w.cfg
    FROM want w LEFT JOIN fn f ON f.ident = w.ident
  UNION ALL
  SELECT 24, 'function owner: ' || w.ident, 'postgres', coalesce(f.owner, 'missing'), coalesce(f.owner = 'postgres', false)
    FROM want w LEFT JOIN fn f ON f.ident = w.ident
  UNION ALL
  SELECT 25, 'function EXECUTE anon: ' || w.ident, 'false',
         has_function_privilege('anon', f.oid, 'EXECUTE')::text, NOT has_function_privilege('anon', f.oid, 'EXECUTE')
    FROM want w JOIN fn f ON f.ident = w.ident
  UNION ALL
  SELECT 26, 'function EXECUTE authenticated: ' || w.ident, w.auth_exec::text,
         has_function_privilege('authenticated', f.oid, 'EXECUTE')::text,
         has_function_privilege('authenticated', f.oid, 'EXECUTE') = w.auth_exec
    FROM want w JOIN fn f ON f.ident = w.ident
  UNION ALL
  SELECT 27, 'function EXECUTE service_role: ' || w.ident, 'false',
         has_function_privilege('service_role', f.oid, 'EXECUTE')::text,
         NOT has_function_privilege('service_role', f.oid, 'EXECUTE')
    FROM want w JOIN fn f ON f.ident = w.ident
  UNION ALL
  SELECT 28, 'function PUBLIC ACL entry: ' || w.ident, 'false',
         EXISTS (SELECT 1 FROM aclexplode(coalesce(f.proacl, acldefault('f', f.proowner))) a WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE')::text,
         NOT EXISTS (SELECT 1 FROM aclexplode(coalesce(f.proacl, acldefault('f', f.proowner))) a WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE')
    FROM want w JOIN fn f ON f.ident = w.ident
  UNION ALL
  SELECT 29, 'exactly ONE public function named ' || w.fname || ' (no extra overloads; PostgREST PGRST203)', '1',
         (SELECT count(*) FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = w.fname)::text,
         (SELECT count(*) FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = w.fname) = 1
    FROM (VALUES ('matrix_paper_review_save_draft'),('matrix_paper_review_submit')) AS w(fname)
  UNION ALL
  SELECT 30, 'table grants: authenticated SELECT rows on ' || t.relname, '1',
         (SELECT count(*) FROM information_schema.role_table_grants g
           WHERE g.table_schema = 'public' AND g.table_name = t.relname
             AND g.grantee = 'authenticated' AND g.privilege_type = 'SELECT')::text,
         (SELECT count(*) FROM information_schema.role_table_grants g
           WHERE g.table_schema = 'public' AND g.table_name = t.relname
             AND g.grantee = 'authenticated' AND g.privilege_type = 'SELECT') = 1
    FROM (VALUES ('matrix_paper_review_questions'),('matrix_paper_review_responses'),
                 ('matrix_paper_review_response_events')) AS t(relname)
  UNION ALL
  SELECT 31, 'table grants: any other privilege for authenticated/anon/PUBLIC on ' || t.relname, '0',
         (SELECT count(*) FROM information_schema.role_table_grants g
           WHERE g.table_schema = 'public' AND g.table_name = t.relname
             AND g.grantee IN ('anon','authenticated','PUBLIC')
             AND NOT (g.grantee = 'authenticated' AND g.privilege_type = 'SELECT'))::text,
         (SELECT count(*) FROM information_schema.role_table_grants g
           WHERE g.table_schema = 'public' AND g.table_name = t.relname
             AND g.grantee IN ('anon','authenticated','PUBLIC')
             AND NOT (g.grantee = 'authenticated' AND g.privilege_type = 'SELECT')) = 0
    FROM (VALUES ('matrix_paper_review_questions'),('matrix_paper_review_responses'),
                 ('matrix_paper_review_response_events')) AS t(relname)
  UNION ALL
  SELECT 32, 'sequence privileges anon/authenticated (any of SELECT, UPDATE, USAGE)', 'false',
         (has_sequence_privilege('anon', 'public.matrix_paper_review_response_events_id_seq', 'SELECT,UPDATE,USAGE')
          OR has_sequence_privilege('authenticated', 'public.matrix_paper_review_response_events_id_seq', 'SELECT,UPDATE,USAGE'))::text,
         NOT (has_sequence_privilege('anon', 'public.matrix_paper_review_response_events_id_seq', 'SELECT,UPDATE,USAGE')
          OR has_sequence_privilege('authenticated', 'public.matrix_paper_review_response_events_id_seq', 'SELECT,UPDATE,USAGE'))
  UNION ALL
  SELECT 33, 'P2: service_role has no ' || p.priv || ' on ' || t.relname, 'false',
         has_table_privilege('service_role', 'public.' || t.relname, p.priv)::text,
         NOT has_table_privilege('service_role', 'public.' || t.relname, p.priv)
    FROM (VALUES ('matrix_paper_review_questions'),('matrix_paper_review_responses'),
                 ('matrix_paper_review_response_events')) AS t(relname)
    CROSS JOIN (VALUES ('INSERT'),('UPDATE'),('DELETE'),('TRUNCATE'),('REFERENCES'),('TRIGGER'),('MAINTAIN')) AS p(priv)
  UNION ALL
  SELECT 34, 'P2: service_role has no ' || p.priv || ' on the events identity sequence', 'false',
         has_sequence_privilege('service_role', 'public.matrix_paper_review_response_events_id_seq', p.priv)::text,
         NOT has_sequence_privilege('service_role', 'public.matrix_paper_review_response_events_id_seq', p.priv)
    FROM (VALUES ('USAGE'),('SELECT'),('UPDATE')) AS p(priv)
  UNION ALL
  SELECT 35, 'P2: service_role keeps SELECT on ' || t.relname, 'true',
         has_table_privilege('service_role', 'public.' || t.relname, 'SELECT')::text,
         has_table_privilege('service_role', 'public.' || t.relname, 'SELECT')
    FROM (VALUES ('matrix_paper_review_questions'),('matrix_paper_review_responses'),
                 ('matrix_paper_review_response_events')) AS t(relname)
  UNION ALL
  SELECT 36, 'P2: ' || r.rolname || ' has no ' || p.priv || ' on ' || t.relname || ' (has_table_privilege; information_schema omits MAINTAIN)', 'false',
         has_table_privilege(r.rolname, 'public.' || t.relname, p.priv)::text,
         NOT has_table_privilege(r.rolname, 'public.' || t.relname, p.priv)
    FROM (VALUES ('matrix_paper_review_questions'),('matrix_paper_review_responses'),
                 ('matrix_paper_review_response_events')) AS t(relname)
    CROSS JOIN (VALUES ('anon'),('authenticated')) AS r(rolname)
    CROSS JOIN (VALUES ('REFERENCES'),('TRIGGER'),('MAINTAIN')) AS p(priv)
  UNION ALL
  SELECT 40, 'policy ' || w.policyname || ' (SELECT, authenticated, USING)', '1',
         (SELECT count(*) FROM pg_policies p WHERE p.schemaname = 'public' AND p.policyname = w.policyname
             AND p.tablename = w.tbl AND p.cmd = 'SELECT' AND p.roles = '{authenticated}'
             AND p.qual LIKE w.qual_like)::text,
         (SELECT count(*) FROM pg_policies p WHERE p.schemaname = 'public' AND p.policyname = w.policyname
             AND p.tablename = w.tbl AND p.cmd = 'SELECT' AND p.roles = '{authenticated}'
             AND p.qual LIKE w.qual_like) = 1
    FROM (VALUES ('matrix_paper_review_questions_select_authenticated', 'matrix_paper_review_questions', 'true'),
                 ('matrix_paper_review_responses_select_own', 'matrix_paper_review_responses', '%auth.uid()%user_id%'),
                 ('matrix_paper_review_responses_select_paper_admin', 'matrix_paper_review_responses', '%is_matrix_options_paper_admin()%'),
                 ('matrix_paper_review_response_events_select_own', 'matrix_paper_review_response_events', '%auth.uid()%user_id%'),
                 ('matrix_paper_review_response_events_select_paper_admin', 'matrix_paper_review_response_events', '%is_matrix_options_paper_admin()%')
         ) AS w(policyname, tbl, qual_like)
  UNION ALL
  SELECT 41, 'policies total on the 3 activation tables', '5',
         (SELECT count(*) FROM pg_policies WHERE schemaname = 'public'
             AND tablename IN ('matrix_paper_review_questions','matrix_paper_review_responses','matrix_paper_review_response_events'))::text,
         (SELECT count(*) FROM pg_policies WHERE schemaname = 'public'
             AND tablename IN ('matrix_paper_review_questions','matrix_paper_review_responses','matrix_paper_review_response_events')) = 5
  UNION ALL
  SELECT 50, 'append-only trigger present and enabled', '1',
         (SELECT count(*) FROM pg_trigger WHERE tgrelid = 'public.matrix_paper_review_response_events'::regclass
             AND tgname = 'matrix_paper_review_response_events_no_update' AND NOT tgisinternal AND tgenabled = 'O')::text,
         (SELECT count(*) FROM pg_trigger WHERE tgrelid = 'public.matrix_paper_review_response_events'::regclass
             AND tgname = 'matrix_paper_review_response_events_no_update' AND NOT tgisinternal AND tgenabled = 'O') = 1
  UNION ALL
  SELECT 60, 'seed rows rpq:v0.9.91:q% under manifest sha', '12',
         (SELECT count(*) FROM seed WHERE document_version = 'v0.9.91'
             AND manifest_sha256 = '6d336b08b7214a17456ff943eb6f56f33e90d3477f4bd9fe1488c5fe0846a272'
             AND question_id LIKE 'rpq:v0.9.91:q%')::text,
         (SELECT count(*) FROM seed WHERE document_version = 'v0.9.91'
             AND manifest_sha256 = '6d336b08b7214a17456ff943eb6f56f33e90d3477f4bd9fe1488c5fe0846a272'
             AND question_id LIKE 'rpq:v0.9.91:q%') = 12
  UNION ALL
  SELECT 61, 'seed rows for any other document_version or sha', '0',
         (SELECT count(*) FROM seed WHERE NOT (document_version = 'v0.9.91'
             AND manifest_sha256 = '6d336b08b7214a17456ff943eb6f56f33e90d3477f4bd9fe1488c5fe0846a272'))::text,
         (SELECT count(*) FROM seed WHERE NOT (document_version = 'v0.9.91'
             AND manifest_sha256 = '6d336b08b7214a17456ff943eb6f56f33e90d3477f4bd9fe1488c5fe0846a272')) = 0
  UNION ALL
  SELECT 63, 'M1: seed exact set (cohort_id + question_number per question), symmetric difference', '0',
         (SELECT n FROM seed_diff)::text, (SELECT n FROM seed_diff) = 0
  UNION ALL
  SELECT 62, 'seed total rows', '12', (SELECT count(*) FROM seed)::text, (SELECT count(*) FROM seed) = 12
  UNION ALL
  SELECT 70, 'info: v0.9.91 response_rows (aggregate only; legitimate reviewer traffic may make this > 0)', 'n/a',
         (SELECT count(*) FROM public.matrix_paper_review_responses
           WHERE document_version = 'v0.9.91' AND manifest_sha256 = '6d336b08b7214a17456ff943eb6f56f33e90d3477f4bd9fe1488c5fe0846a272')::text,
         true
  UNION ALL
  SELECT 71, 'info: v0.9.91 event_rows (aggregate only; legitimate reviewer traffic may make this > 0)', 'n/a',
         (SELECT count(*) FROM public.matrix_paper_review_response_events
           WHERE document_version = 'v0.9.91' AND manifest_sha256 = '6d336b08b7214a17456ff943eb6f56f33e90d3477f4bd9fe1488c5fe0846a272')::text,
         true
  UNION ALL
  SELECT 72, 'response/event rows for any other document_version or manifest sha', '0',
         ((SELECT count(*) FROM public.matrix_paper_review_responses
            WHERE NOT (document_version = 'v0.9.91' AND manifest_sha256 = '6d336b08b7214a17456ff943eb6f56f33e90d3477f4bd9fe1488c5fe0846a272'))
        + (SELECT count(*) FROM public.matrix_paper_review_response_events
            WHERE NOT (document_version = 'v0.9.91' AND manifest_sha256 = '6d336b08b7214a17456ff943eb6f56f33e90d3477f4bd9fe1488c5fe0846a272')))::text,
         ((SELECT count(*) FROM public.matrix_paper_review_responses
            WHERE NOT (document_version = 'v0.9.91' AND manifest_sha256 = '6d336b08b7214a17456ff943eb6f56f33e90d3477f4bd9fe1488c5fe0846a272'))
        + (SELECT count(*) FROM public.matrix_paper_review_response_events
            WHERE NOT (document_version = 'v0.9.91' AND manifest_sha256 = '6d336b08b7214a17456ff943eb6f56f33e90d3477f4bd9fe1488c5fe0846a272'))) = 0
  UNION ALL
  SELECT 73, 'response/event rows whose question identity is not one of the 12 seeds', '0',
         ((SELECT count(*) FROM public.matrix_paper_review_responses r
            WHERE NOT EXISTS (SELECT 1 FROM seed s WHERE s.document_version = r.document_version
                AND s.manifest_sha256 = r.manifest_sha256 AND s.cohort_id = r.cohort_id AND s.question_id = r.question_id))
        + (SELECT count(*) FROM public.matrix_paper_review_response_events e
            WHERE NOT EXISTS (SELECT 1 FROM seed s WHERE s.document_version = e.document_version
                AND s.manifest_sha256 = e.manifest_sha256 AND s.cohort_id = e.cohort_id AND s.question_id = e.question_id)))::text,
         ((SELECT count(*) FROM public.matrix_paper_review_responses r
            WHERE NOT EXISTS (SELECT 1 FROM seed s WHERE s.document_version = r.document_version
                AND s.manifest_sha256 = r.manifest_sha256 AND s.cohort_id = r.cohort_id AND s.question_id = r.question_id))
        + (SELECT count(*) FROM public.matrix_paper_review_response_events e
            WHERE NOT EXISTS (SELECT 1 FROM seed s WHERE s.document_version = e.document_version
                AND s.manifest_sha256 = e.manifest_sha256 AND s.cohort_id = e.cohort_id AND s.question_id = e.question_id))) = 0
  UNION ALL
  SELECT 74, 'response/event rows with a NULL user_id', '0',
         ((SELECT count(*) FROM public.matrix_paper_review_responses WHERE user_id IS NULL)
        + (SELECT count(*) FROM public.matrix_paper_review_response_events WHERE user_id IS NULL))::text,
         ((SELECT count(*) FROM public.matrix_paper_review_responses WHERE user_id IS NULL)
        + (SELECT count(*) FROM public.matrix_paper_review_response_events WHERE user_id IS NULL)) = 0
  UNION ALL
  SELECT 80, 'I2: relowner is postgres: ' || t.relname, 'postgres',
         coalesce(pg_get_userbyid(c.relowner), 'missing'), coalesce(pg_get_userbyid(c.relowner) = 'postgres', false)
    FROM (VALUES ('matrix_paper_review_questions'),('matrix_paper_review_responses'),
                 ('matrix_paper_review_response_events'),('matrix_paper_review_response_events_id_seq')) AS t(relname)
    LEFT JOIN pg_class c ON c.relname = t.relname AND c.relnamespace = 'public'::regnamespace
  UNION ALL
  SELECT 81, 'I1: no CREATE on schema public for role ' || r.rolname, 'false',
         CASE WHEN EXISTS (SELECT 1 FROM pg_roles x WHERE x.rolname = r.rolname)
              THEN has_schema_privilege(r.rolname, 'public', 'CREATE')::text ELSE 'role missing' END,
         CASE WHEN EXISTS (SELECT 1 FROM pg_roles x WHERE x.rolname = r.rolname)
              THEN NOT has_schema_privilege(r.rolname, 'public', 'CREATE') ELSE true END
    FROM (VALUES ('anon'),('authenticated'),('authenticator'),('service_role')) AS r(rolname)
  UNION ALL
  SELECT 82, 'I1: nspacl of public has no PUBLIC CREATE entry', 'false',
         EXISTS (SELECT 1 FROM pg_namespace n, aclexplode(coalesce(n.nspacl, acldefault('n', n.nspowner))) a
                  WHERE n.nspname = 'public' AND a.grantee = 0 AND a.privilege_type = 'CREATE')::text,
         NOT EXISTS (SELECT 1 FROM pg_namespace n, aclexplode(coalesce(n.nspacl, acldefault('n', n.nspowner))) a
                  WHERE n.nspname = 'public' AND a.grantee = 0 AND a.privilege_type = 'CREATE')
  UNION ALL
  SELECT 83, 'I1: no hijack-capable function in public named like an unqualified call', '<none>',
         coalesce((SELECT string_agg(ident, ', ' ORDER BY ident) FROM hij), '<none>'),
         (SELECT count(*) FROM hij) = 0
  UNION ALL
  SELECT 84, 'M1: columns (name/type/nullability) vs expected, symmetric difference', '0',
         (SELECT n FROM cols_diff)::text, (SELECT n FROM cols_diff) = 0
  UNION ALL
  SELECT 85, 'M1: columns total (6 + 13 + 12)', '31', (SELECT count(*) FROM act_cols)::text, (SELECT count(*) FROM act_cols) = 31
  UNION ALL
  SELECT 86, 'M1: constraints (name/type) vs expected, symmetric difference', '0',
         (SELECT n FROM con_diff)::text, (SELECT n FROM con_diff) = 0
  UNION ALL
  SELECT 87, 'M1: indexes vs expected, symmetric difference', '0',
         (SELECT n FROM idx_diff)::text, (SELECT n FROM idx_diff) = 0
  UNION ALL
  SELECT 88, 'M1: FK responses -> questions (4 columns, ON DELETE RESTRICT)', '1',
         (SELECT count(*) FROM pg_constraint c
           WHERE c.conname = 'matrix_paper_review_responses_question_fkey'
             AND c.conrelid = 'public.matrix_paper_review_responses'::regclass
             AND c.confrelid = 'public.matrix_paper_review_questions'::regclass
             AND c.confdeltype = 'r'
             AND pg_get_constraintdef(c.oid) LIKE 'FOREIGN KEY (document_version, manifest_sha256, cohort_id, question_id)%')::text, (SELECT count(*) FROM pg_constraint c
           WHERE c.conname = 'matrix_paper_review_responses_question_fkey'
             AND c.conrelid = 'public.matrix_paper_review_responses'::regclass
             AND c.confrelid = 'public.matrix_paper_review_questions'::regclass
             AND c.confdeltype = 'r'
             AND pg_get_constraintdef(c.oid) LIKE 'FOREIGN KEY (document_version, manifest_sha256, cohort_id, question_id)%') = 1
  UNION ALL
  SELECT 89, 'M1: utf16 CHECKs use the helper, <= 20000, not char_length: ' || w.conname, '1',
         (SELECT count(*) FROM pg_constraint c
           WHERE c.conrelid = 'public.matrix_paper_review_responses'::regclass AND c.conname = w.conname
             AND pg_get_constraintdef(c.oid) LIKE '%matrix_paper_review_utf16_length(' || w.col || ')%'
             AND pg_get_constraintdef(c.oid) LIKE '%<= 20000%'
             AND pg_get_constraintdef(c.oid) NOT LIKE '%char_length(%')::text, (SELECT count(*) FROM pg_constraint c
           WHERE c.conrelid = 'public.matrix_paper_review_responses'::regclass AND c.conname = w.conname
             AND pg_get_constraintdef(c.oid) LIKE '%matrix_paper_review_utf16_length(' || w.col || ')%'
             AND pg_get_constraintdef(c.oid) LIKE '%<= 20000%'
             AND pg_get_constraintdef(c.oid) NOT LIKE '%char_length(%') = 1
    FROM (VALUES ('matrix_paper_review_responses_draft_len_chk', 'draft_text'),
                 ('matrix_paper_review_responses_submitted_len_chk', 'submitted_text')) AS w(conname, col)
  UNION ALL
  SELECT 90, 'M1: events_user_idx is ON (user_id, occurred_at)', '1',
         (SELECT count(*) FROM pg_indexes WHERE schemaname = 'public'
             AND indexname = 'matrix_paper_review_response_events_user_idx'
             AND indexdef LIKE '%(user_id, occurred_at)')::text, (SELECT count(*) FROM pg_indexes WHERE schemaname = 'public'
             AND indexname = 'matrix_paper_review_response_events_user_idx'
             AND indexdef LIKE '%(user_id, occurred_at)') = 1
  UNION ALL
  SELECT 91, 'M1: trigger is BEFORE UPDATE FOR EACH ROW (tgtype 19) calling events_block_update()', '1',
         (SELECT count(*) FROM pg_trigger
           WHERE tgrelid = 'public.matrix_paper_review_response_events'::regclass
             AND tgname = 'matrix_paper_review_response_events_no_update' AND NOT tgisinternal
             AND tgtype = 19
             AND tgfoid = 'public.matrix_paper_review_events_block_update()'::regprocedure)::text, (SELECT count(*) FROM pg_trigger
           WHERE tgrelid = 'public.matrix_paper_review_response_events'::regclass
             AND tgname = 'matrix_paper_review_response_events_no_update' AND NOT tgisinternal
             AND tgtype = 19
             AND tgfoid = 'public.matrix_paper_review_events_block_update()'::regprocedure) = 1
  UNION ALL
  SELECT 92, 'M1: RPC body guards (anonymous reject, rate limit, advisory lock, too_large, identity): ' || p.proname, 'true',
         (p.prosrc LIKE '%is_anonymous%' AND p.prosrc LIKE '%rate_limited%' AND p.prosrc LIKE '%pg_advisory_xact_lock%'
          AND p.prosrc LIKE '%too_large%' AND p.prosrc LIKE '%unknown_identity%' AND p.prosrc LIKE '%stale_manifest%')::text, (p.prosrc LIKE '%is_anonymous%' AND p.prosrc LIKE '%rate_limited%' AND p.prosrc LIKE '%pg_advisory_xact_lock%'
          AND p.prosrc LIKE '%too_large%' AND p.prosrc LIKE '%unknown_identity%' AND p.prosrc LIKE '%stale_manifest%')
    FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname IN ('matrix_paper_review_save_draft', 'matrix_paper_review_submit')
  UNION ALL
  SELECT 93, 'M1: blank_submission guard only in submit: ' || p.proname,
         (p.proname = 'matrix_paper_review_submit')::text,
         (p.prosrc LIKE '%blank_submission%')::text,
         (p.prosrc LIKE '%blank_submission%') = (p.proname = 'matrix_paper_review_submit')
    FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname IN ('matrix_paper_review_save_draft', 'matrix_paper_review_submit')
  UNION ALL
  SELECT 94, 'M1: removed column accepting_responses absent', '0',
         (SELECT count(*) FROM act_cols WHERE col = 'accepting_responses')::text,
         (SELECT count(*) FROM act_cols WHERE col = 'accepting_responses') = 0
  UNION ALL
  SELECT 95, 'M1: installed prosrc sha256 = approved activation bytes: is_matrix_options_paper_admin', 'fe36eefb668d80898bea8247f44aa9f8dbe99e5a292443f9ab5300257393f080',
         coalesce((SELECT string_agg(encode(sha256(convert_to(p.prosrc, 'UTF8')), 'hex'), ',' ORDER BY p.oid)
                     FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'is_matrix_options_paper_admin'), 'missing'),
         coalesce((SELECT string_agg(encode(sha256(convert_to(p.prosrc, 'UTF8')), 'hex'), ',' ORDER BY p.oid)
                     FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'is_matrix_options_paper_admin'), 'missing') = 'fe36eefb668d80898bea8247f44aa9f8dbe99e5a292443f9ab5300257393f080'
  UNION ALL
  SELECT 96, 'M1: installed prosrc sha256 = approved activation bytes: matrix_paper_review_utf16_length', '81a1d91ec6c09e5a81dce3bf02bf7289695018cb5c4b5266da9f52017e69a9aa',
         coalesce((SELECT string_agg(encode(sha256(convert_to(p.prosrc, 'UTF8')), 'hex'), ',' ORDER BY p.oid)
                     FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'matrix_paper_review_utf16_length'), 'missing'),
         coalesce((SELECT string_agg(encode(sha256(convert_to(p.prosrc, 'UTF8')), 'hex'), ',' ORDER BY p.oid)
                     FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'matrix_paper_review_utf16_length'), 'missing') = '81a1d91ec6c09e5a81dce3bf02bf7289695018cb5c4b5266da9f52017e69a9aa'
  UNION ALL
  SELECT 97, 'M1: installed prosrc sha256 = approved activation bytes: matrix_paper_review_events_block_update', 'fb7cc0d423f1c7e16179ec4bf4b2961aefdaa33e6b29a13f960c66bf6bc07968',
         coalesce((SELECT string_agg(encode(sha256(convert_to(p.prosrc, 'UTF8')), 'hex'), ',' ORDER BY p.oid)
                     FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'matrix_paper_review_events_block_update'), 'missing'),
         coalesce((SELECT string_agg(encode(sha256(convert_to(p.prosrc, 'UTF8')), 'hex'), ',' ORDER BY p.oid)
                     FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'matrix_paper_review_events_block_update'), 'missing') = 'fb7cc0d423f1c7e16179ec4bf4b2961aefdaa33e6b29a13f960c66bf6bc07968'
  UNION ALL
  SELECT 98, 'M1: installed prosrc sha256 = approved activation bytes: matrix_paper_review_save_draft', 'e1283bac453ef1ad03ce2c42c6936f435490392cf431501713fb7bd394ac6c73',
         coalesce((SELECT string_agg(encode(sha256(convert_to(p.prosrc, 'UTF8')), 'hex'), ',' ORDER BY p.oid)
                     FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'matrix_paper_review_save_draft'), 'missing'),
         coalesce((SELECT string_agg(encode(sha256(convert_to(p.prosrc, 'UTF8')), 'hex'), ',' ORDER BY p.oid)
                     FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'matrix_paper_review_save_draft'), 'missing') = 'e1283bac453ef1ad03ce2c42c6936f435490392cf431501713fb7bd394ac6c73'
  UNION ALL
  SELECT 99, 'M1: installed prosrc sha256 = approved activation bytes: matrix_paper_review_submit', 'c9f1ee0bea6a711a84476ff3ed5fa17b702bcb3584740a1ef2c9ab95f349a7ad',
         coalesce((SELECT string_agg(encode(sha256(convert_to(p.prosrc, 'UTF8')), 'hex'), ',' ORDER BY p.oid)
                     FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'matrix_paper_review_submit'), 'missing'),
         coalesce((SELECT string_agg(encode(sha256(convert_to(p.prosrc, 'UTF8')), 'hex'), ',' ORDER BY p.oid)
                     FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'matrix_paper_review_submit'), 'missing') = 'c9f1ee0bea6a711a84476ff3ed5fa17b702bcb3584740a1ef2c9ab95f349a7ad'
) r
ORDER BY ord, check_name;
