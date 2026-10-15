-- =====================================================================
-- PREFLIGHT (read-only) for MATRIX_PAPER_REVIEW_V0991_ACTIVATION_2026_10_14.sql
-- DRAFT -- NOT RUN. SELECT-only catalog queries; reads no user data.
-- One result set: check_name / expected / actual / ok. Every ok must be
-- true before the activation file is applied.
-- =====================================================================
WITH
tbls AS (
  SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relname IN ('matrix_paper_review_questions','matrix_paper_review_responses','matrix_paper_review_response_events')
),
fn_ids(fname, argtypes) AS (
  -- EXACT collision keys the activation creates in public: proname + INPUT TYPE
  -- signature (oidvectortypes of proargtypes). PostgreSQL function uniqueness
  -- ignores argument NAMES, so names are deliberately not compared.
  VALUES ('is_matrix_options_paper_admin', ''),
         ('matrix_paper_review_utf16_length', 'text'),
         ('matrix_paper_review_events_block_update', ''),
         ('matrix_paper_review_save_draft', 'text, text, text, text, text, integer'),
         ('matrix_paper_review_submit', 'text, text, text, text, text, integer')
),
fns AS (
  SELECT p.proname || '(' || oidvectortypes(p.proargtypes) || ')' AS ident
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    JOIN fn_ids f ON f.fname = p.proname AND f.argtypes = oidvectortypes(p.proargtypes)
   WHERE n.nspname = 'public'
),
pols AS (
  SELECT policyname FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename IN ('matrix_paper_review_questions','matrix_paper_review_responses','matrix_paper_review_response_events')
),
trg AS (
  SELECT t.tgname FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE t.tgname = 'matrix_paper_review_response_events_no_update' AND NOT t.tgisinternal
     AND n.nspname = 'public' AND c.relname = 'matrix_paper_review_response_events'
),
seqs AS (
  SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind = 'S' AND c.relname = 'matrix_paper_review_response_events_id_seq'
),
wr_any AS (
  -- ANY public function named like a write RPC, whatever its argument types. PostgREST
  -- resolves an RPC by name + the JSON argument names, so a stale overload with different
  -- types is ambiguous (PGRST203) even though the exact-type check in fns finds nothing.
  SELECT p.proname || '(' || oidvectortypes(p.proargtypes) || ')' AS ident
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname IN ('matrix_paper_review_save_draft','matrix_paper_review_submit')
),
hij_names(fname) AS (
  -- Every unqualified function the two RPC bodies, the helper and the table
  -- DEFAULT/CHECK expressions call (now, jsonb_build_object, pg_advisory_xact_lock,
  -- hashtext, count, encode, sha256, convert_to, to_char, char_length,
  -- regexp_count, gen_random_uuid), plus close relatives. A same-named function
  -- in public could hijack a call under search_path = public, pg_temp.
  VALUES ('convert_to'),('length'),('octet_length'),('encode'),('digest'),('sha256'),('now'),
         ('jsonb_build_object'),('to_char'),('regexp_count'),('char_length'),('btrim'),
         ('hashtext'),('pg_advisory_xact_lock'),('count'),('gen_random_uuid')
),
hij AS (
  SELECT p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' AS ident
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname IN (SELECT fname FROM hij_names)
),
own_rels(nm) AS (
  -- EXACT relation names the activation creates in schema public: the 3 tables,
  -- the events identity sequence, the 4 explicit indexes, and every index that
  -- backs a PRIMARY KEY / UNIQUE constraint (named or auto-named). Nothing broader.
  VALUES ('matrix_paper_review_questions'),
         ('matrix_paper_review_questions_identity_key'),
         ('matrix_paper_review_questions_number_key'),
         ('matrix_paper_review_questions_pkey'),
         ('matrix_paper_review_questions_probe_idx'),
         ('matrix_paper_review_response_events'),
         ('matrix_paper_review_response_events_id_seq'),
         ('matrix_paper_review_response_events_pkey'),
         ('matrix_paper_review_response_events_response_idx'),
         ('matrix_paper_review_response_events_user_idx'),
         ('matrix_paper_review_responses'),
         ('matrix_paper_review_responses_identity_key'),
         ('matrix_paper_review_responses_pkey'),
         ('matrix_paper_review_responses_release_idx')
),
own_cons(nm) AS (
  -- EXACT constraint names the activation creates (explicit and auto-named).
  VALUES ('matrix_paper_review_questions_cohort_chk'),
         ('matrix_paper_review_questions_identity_key'),
         ('matrix_paper_review_questions_number_chk'),
         ('matrix_paper_review_questions_number_key'),
         ('matrix_paper_review_questions_pkey'),
         ('matrix_paper_review_questions_question_chk'),
         ('matrix_paper_review_questions_sha_chk'),
         ('matrix_paper_review_questions_version_chk'),
         ('matrix_paper_review_response_events_action_chk'),
         ('matrix_paper_review_response_events_len_chk'),
         ('matrix_paper_review_response_events_pkey'),
         ('matrix_paper_review_response_events_response_id_fkey'),
         ('matrix_paper_review_response_events_revision_chk'),
         ('matrix_paper_review_response_events_sha_chk'),
         ('matrix_paper_review_response_events_user_id_fkey'),
         ('matrix_paper_review_responses_draft_len_chk'),
         ('matrix_paper_review_responses_identity_key'),
         ('matrix_paper_review_responses_pkey'),
         ('matrix_paper_review_responses_question_fkey'),
         ('matrix_paper_review_responses_revision_chk'),
         ('matrix_paper_review_responses_submitted_len_chk'),
         ('matrix_paper_review_responses_submitted_revision_chk'),
         ('matrix_paper_review_responses_submitted_set_chk'),
         ('matrix_paper_review_responses_user_id_fkey')
),
own_types(nm) AS (
  -- EXACT row types the 3 tables would create (same names as the tables).
  VALUES ('matrix_paper_review_questions'),
         ('matrix_paper_review_response_events'),
         ('matrix_paper_review_responses')
)
SELECT * FROM (
  SELECT 1 AS ord, 'matrix_paper_review tables present' AS check_name, '0' AS expected,
         (SELECT count(*) FROM tbls)::text AS actual, (SELECT count(*) FROM tbls) = 0 AS ok
  UNION ALL
  SELECT 2, 'matrix_paper_review / paper_admin functions present', '0',
         (SELECT count(*) FROM fns)::text, (SELECT count(*) FROM fns) = 0
  UNION ALL
  SELECT 3, 'matrix_paper_review_* policies present', '0',
         (SELECT count(*) FROM pols)::text, (SELECT count(*) FROM pols) = 0
  UNION ALL
  SELECT 4, 'append-only trigger present', '0',
         (SELECT count(*) FROM trg)::text, (SELECT count(*) FROM trg) = 0
  UNION ALL
  SELECT 5, 'events id sequence present', '0',
         (SELECT count(*) FROM seqs)::text, (SELECT count(*) FROM seqs) = 0
  UNION ALL
  SELECT 6, 'dependency: table public.user_roles exists', '1',
         (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'public' AND c.relname = 'user_roles' AND c.relkind IN ('r','p'))::text,
         (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'public' AND c.relname = 'user_roles' AND c.relkind IN ('r','p')) = 1
  UNION ALL
  SELECT 7, 'dependency: user_roles columns user_id,role', '2',
         (SELECT count(*) FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'user_roles' AND column_name IN ('user_id','role'))::text,
         (SELECT count(*) FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'user_roles' AND column_name IN ('user_id','role')) = 2
  UNION ALL
  SELECT 8, 'dependency: auth.users table exists', '1',
         (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'auth' AND c.relname = 'users')::text,
         (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'auth' AND c.relname = 'users') = 1
  UNION ALL
  SELECT 9, 'dependency: function auth.uid() exists', '>=1',
         (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'auth' AND p.proname = 'uid')::text,
         (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'auth' AND p.proname = 'uid') >= 1
  UNION ALL
  SELECT 10, 'roles anon, authenticated, service_role, postgres exist', '4',
         (SELECT count(*) FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role','postgres'))::text,
         (SELECT count(*) FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role','postgres')) = 4
  UNION ALL
  SELECT 11, 'server_encoding is UTF8 (utf16_length self-test needs it)', 'UTF8',
         current_setting('server_encoding'), current_setting('server_encoding') = 'UTF8'
  UNION ALL
  SELECT 12, 'dependency: pg_catalog.regexp_count available (PG15+)', '>=1',
         (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'pg_catalog' AND p.proname = 'regexp_count')::text,
         (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'pg_catalog' AND p.proname = 'regexp_count') >= 1
  UNION ALL
  SELECT 13, 'I2: current_user is postgres (same role must run the activation file)', 'postgres',
         current_user::text, current_user = 'postgres'
  UNION ALL
  SELECT 14, 'I2: postgres rolbypassrls (report)', 'true',
         coalesce((SELECT rolbypassrls::text FROM pg_roles WHERE rolname = 'postgres'), 'missing'),
         coalesce((SELECT rolbypassrls FROM pg_roles WHERE rolname = 'postgres'), false)
  UNION ALL
  SELECT 15, 'M2: dependency: function auth.jwt() exists', '>=1',
         (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'auth' AND p.proname = 'jwt' AND p.pronargs = 0)::text,
         (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname = 'auth' AND p.proname = 'jwt' AND p.pronargs = 0) >= 1
  UNION ALL
  SELECT 16, 'M2: public.user_roles.role data type', 'text',
         coalesce((SELECT data_type::text FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'user_roles' AND column_name = 'role'), 'missing'),
         coalesce((SELECT data_type::text FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'user_roles' AND column_name = 'role') = 'text', false)
  UNION ALL
  SELECT 17, 'M2: server_version_num >= 170000 (PG17+ (MAINTAIN privilege used by VERIFY/KILL_SWITCH))', '>=170000',
         current_setting('server_version_num'), current_setting('server_version_num')::integer >= 170000
  UNION ALL
  SELECT 18, 'no relation in public holds an EXACT name the activation creates (tables, sequence, indexes)', '0',
         (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'public' AND c.relname IN (SELECT nm FROM own_rels))::text,
         (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'public' AND c.relname IN (SELECT nm FROM own_rels)) = 0
  UNION ALL
  SELECT 19, 'info: constraints in public with an EXACT activation constraint name (informational; names collide only per table and the tables are checked absent by row 1)', '0',
         (SELECT count(*) FROM pg_constraint k JOIN pg_namespace n ON n.oid = k.connamespace
           WHERE n.nspname = 'public' AND k.conname IN (SELECT nm FROM own_cons))::text,
         true
  UNION ALL
  SELECT 20, 'no type in public holds an EXACT row-type name the activation tables would own', '0',
         (SELECT count(*) FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
           WHERE n.nspname = 'public' AND t.typname IN (SELECT nm FROM own_types))::text,
         (SELECT count(*) FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
           WHERE n.nspname = 'public' AND t.typname IN (SELECT nm FROM own_types)) = 0
  UNION ALL
  SELECT 21, 'no public function named matrix_paper_review_save_draft or matrix_paper_review_submit, any argument types (PostgREST overload ambiguity PGRST203)', '0',
         (SELECT count(*) FROM wr_any)::text, (SELECT count(*) FROM wr_any) = 0
  UNION ALL
  SELECT 30, 'I1: no CREATE on schema public for role ' || r.rolname, 'false',
         CASE WHEN EXISTS (SELECT 1 FROM pg_roles x WHERE x.rolname = r.rolname)
              THEN has_schema_privilege(r.rolname, 'public', 'CREATE')::text ELSE 'role missing' END,
         CASE WHEN EXISTS (SELECT 1 FROM pg_roles x WHERE x.rolname = r.rolname)
              THEN NOT has_schema_privilege(r.rolname, 'public', 'CREATE') ELSE true END
    FROM (VALUES ('anon'),('authenticated'),('authenticator'),('service_role')) AS r(rolname)
  UNION ALL
  SELECT 31, 'I1: nspacl of public has no PUBLIC CREATE entry', 'false',
         EXISTS (SELECT 1 FROM pg_namespace n, aclexplode(coalesce(n.nspacl, acldefault('n', n.nspowner))) a
                  WHERE n.nspname = 'public' AND a.grantee = 0 AND a.privilege_type = 'CREATE')::text,
         NOT EXISTS (SELECT 1 FROM pg_namespace n, aclexplode(coalesce(n.nspacl, acldefault('n', n.nspowner))) a
                  WHERE n.nspname = 'public' AND a.grantee = 0 AND a.privilege_type = 'CREATE')
  UNION ALL
  SELECT 32, 'I1: no hijack-capable function in public named like an unqualified call', '<none>',
         coalesce((SELECT string_agg(ident, ', ' ORDER BY ident) FROM hij), '<none>'),
         (SELECT count(*) FROM hij) = 0
) r
ORDER BY ord, check_name;
