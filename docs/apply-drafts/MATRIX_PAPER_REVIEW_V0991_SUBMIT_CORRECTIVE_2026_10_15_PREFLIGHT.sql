-- =====================================================================
-- PREFLIGHT + TRANSPORT PROOF (read-only) for
-- MATRIX_PAPER_REVIEW_V0991_SUBMIT_CORRECTIVE_2026_10_15.sql
-- (corrective file sha256 584bf5122056a74f5f3068bb252143fc1e7794ba548a1aa1f88d554050b8646a)
-- =====================================================================
-- SELECT-only. Reads catalog rows and two aggregate counts; no user text.
-- Every ok must be true before the corrective is applied.
-- Rows 1-9: the live state is exactly the diagnosed state (one submit
-- function, deviant body, owner/ACL/attributes as the activation set them).
-- Rows 10-13: TRANSPORT PROOF. The literal below is byte-identical to the
-- one in the corrective file (generated programmatically). The server
-- substitutes chr(92) for the placeholder exactly as the corrective does and
-- hashes the rebuilt body; it must equal the approved bytes. This query
-- travels the same MCP execute_sql path as the corrective, so a decoded or
-- mangled literal fails here first, with nothing written.
-- Row 20 (four rows): the four other activation function bodies still equal the
-- approved bytes (surrounding state). This file contains no backslash.
-- =====================================================================
WITH lit AS (
  SELECT pg_catalog.replace($q$CREATE OR REPLACE FUNCTION public.matrix_paper_review_submit(
  p_document_version  text,
  p_manifest_sha256   text,
  p_cohort_id         text,
  p_question_id       text,
  p_text              text,
  p_expected_revision integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_uid       uuid := auth.uid();
  v_now       timestamptz := now();
  v_row       public.matrix_paper_review_responses%ROWTYPE;
  v_outcome   text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('outcome', 'unauthenticated', 'row', NULL);
  END IF;

  -- Anonymous Supabase sessions hold the authenticated role too; only a
  -- signed-in reviewer may write. Fail closed: a missing claim is rejected.
  IF (auth.jwt() ->> 'is_anonymous')::boolean IS NOT FALSE THEN
    RETURN jsonb_build_object('outcome', 'unauthenticated', 'row', NULL);
  END IF;

  -- Direct PostgREST calls bypass the app's rate limiter, so the database
  -- bounds writes itself: at most 60 successful writes (event rows) per user
  -- in any rolling minute. Served by events_user_idx (user_id, occurred_at).
  -- The per-user transaction advisory lock (shared by both RPCs, released at
  -- commit/rollback) serializes count-then-write, so concurrent calls cannot
  -- all observe fewer than 60 events and all write.
  PERFORM pg_advisory_xact_lock(hashtext('matrix_paper_review_write'), hashtext(v_uid::text));
  IF (SELECT count(*)
        FROM public.matrix_paper_review_response_events e
       WHERE e.user_id = v_uid
         AND e.occurred_at > v_now - interval '1 minute') >= 60 THEN
    RETURN jsonb_build_object('outcome', 'rate_limited', 'row', NULL);
  END IF;

  IF p_text IS NULL THEN
    RAISE EXCEPTION 'p_text must not be null' USING ERRCODE = '22004';
  END IF;

  -- Limit counted in UTF-16 code units, matching the app's zod max(20000).
  IF public.matrix_paper_review_utf16_length(p_text) > 20000 THEN
    RETURN jsonb_build_object('outcome', 'too_large', 'row', NULL);
  END IF;

  -- A submission must say something (the UI disables Submit for blank text;
  -- this is the write boundary for direct calls). Blank drafts stay allowed.
  -- "Blank" matches the app's JavaScript trim(): ASCII whitespace plus the
  -- Unicode space separators, line/paragraph separators and U+FEFF.
  IF p_text ~ '^[[:space:]~BS~u00a0~BS~u1680~BS~u2000-~BS~u200a~BS~u2028~BS~u2029~BS~u202f~BS~u205f~BS~u3000~BS~ufeff]*$' THEN
    RETURN jsonb_build_object('outcome', 'blank_submission', 'row', NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.matrix_paper_review_questions q
     WHERE q.document_version = p_document_version
       AND q.manifest_sha256  = p_manifest_sha256
       AND q.cohort_id        = p_cohort_id
       AND q.question_id      = p_question_id
  ) THEN
    IF EXISTS (
      SELECT 1
        FROM public.matrix_paper_review_questions q
       WHERE q.document_version = p_document_version
         AND q.cohort_id        = p_cohort_id
         AND q.question_id      = p_question_id
    ) THEN
      RETURN jsonb_build_object('outcome', 'stale_manifest', 'row', NULL);
    END IF;
    RETURN jsonb_build_object('outcome', 'unknown_identity', 'row', NULL);
  END IF;

  SELECT r.*
    INTO v_row
    FROM public.matrix_paper_review_responses r
   WHERE r.user_id          = v_uid
     AND r.document_version = p_document_version
     AND r.manifest_sha256  = p_manifest_sha256
     AND r.question_id      = p_question_id
     FOR UPDATE;

  IF NOT FOUND THEN
    IF p_expected_revision IS NOT NULL AND p_expected_revision <> 0 THEN
      RETURN jsonb_build_object('outcome', 'stale_revision', 'row', NULL);
    END IF;

    INSERT INTO public.matrix_paper_review_responses
      (user_id, document_version, manifest_sha256, cohort_id, question_id,
       draft_text, submitted_text, revision, submitted_revision,
       submitted_at, updated_at)
    VALUES
      (v_uid, p_document_version, p_manifest_sha256, p_cohort_id, p_question_id,
       p_text, p_text, 1, 1, v_now, v_now)
    ON CONFLICT ON CONSTRAINT matrix_paper_review_responses_identity_key DO NOTHING
    RETURNING * INTO v_row;

    IF FOUND THEN
      v_outcome := 'ok';
    ELSE
      SELECT r.*
        INTO v_row
        FROM public.matrix_paper_review_responses r
       WHERE r.user_id          = v_uid
         AND r.document_version = p_document_version
         AND r.manifest_sha256  = p_manifest_sha256
         AND r.question_id      = p_question_id;
      IF NOT FOUND THEN
        RETURN jsonb_build_object('outcome', 'persistence_unavailable', 'row', NULL);
      END IF;
      -- Same noop test as the existing-row path (revision 3): a concurrent
      -- identical submit that won the insert race is an idempotent success.
      IF v_row.submitted_revision IS NOT NULL
         AND v_row.submitted_revision = v_row.revision
         AND v_row.submitted_text = p_text THEN
        v_outcome := 'noop_already_submitted';
      ELSE
        v_outcome := 'stale_revision';
      END IF;
    END IF;
  ELSIF v_row.submitted_revision IS NOT NULL
        AND v_row.submitted_revision = v_row.revision
        AND v_row.submitted_text = p_text THEN
    v_outcome := 'noop_already_submitted';
  ELSIF p_expected_revision IS DISTINCT FROM v_row.revision THEN
    v_outcome := 'stale_revision';
  ELSE
    UPDATE public.matrix_paper_review_responses r
       SET draft_text         = p_text,
           submitted_text     = p_text,
           revision           = r.revision + 1,
           submitted_revision = r.revision + 1,
           submitted_at       = v_now,
           updated_at         = v_now
     WHERE r.id = v_row.id
    RETURNING r.* INTO v_row;
    v_outcome := 'ok';
  END IF;

  IF v_outcome = 'ok' THEN
    INSERT INTO public.matrix_paper_review_response_events
      (response_id, user_id, document_version, manifest_sha256, cohort_id,
       question_id, action, revision, text_sha256, text_length)
    VALUES
      (v_row.id, v_uid, v_row.document_version, v_row.manifest_sha256,
       v_row.cohort_id, v_row.question_id, 'submit', v_row.revision,
       encode(sha256(convert_to(p_text, 'UTF8')), 'hex'), public.matrix_paper_review_utf16_length(p_text));
  END IF;

  RETURN jsonb_build_object(
    'outcome', v_outcome,
    'row', jsonb_build_object(
      'id',                 v_row.id::text,
      'document_version',   v_row.document_version,
      'manifest_sha256',    v_row.manifest_sha256,
      'cohort_id',          v_row.cohort_id,
      'question_id',        v_row.question_id,
      'draft_text',         v_row.draft_text,
      'submitted_text',     v_row.submitted_text,
      'revision',           v_row.revision,
      'submitted_revision', v_row.submitted_revision,
      'submitted_at',       to_char(v_row.submitted_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'updated_at',         to_char(v_row.updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
    )
  );
END;
$fn$$q$, '~BS~', pg_catalog.chr(92)) AS s
),
sub AS (
  SELECT p.oid, p.prosrc, p.proowner, p.prosecdef, p.provolatile, p.proconfig::text AS cfg, p.proacl
    FROM pg_catalog.pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'matrix_paper_review_submit'
)
SELECT * FROM (
  SELECT 1 AS ord, 'current_user is postgres' AS check_name, 'postgres' AS expected,
         current_user::text AS actual, current_user = 'postgres' AS ok
  UNION ALL
  SELECT 2, 'exactly one public.matrix_paper_review_submit', '1',
         (SELECT pg_catalog.count(*) FROM sub)::text, (SELECT pg_catalog.count(*) FROM sub) = 1
  UNION ALL
  SELECT 3, 'installed submit body is the diagnosed deviant', '8f000481b4974f26768b205ab5fad8bd8cd43833eb0b29867a73cf479abf188d',
         coalesce((SELECT pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(prosrc, 'UTF8')), 'hex') FROM sub), 'missing'), coalesce((SELECT pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(prosrc, 'UTF8')), 'hex') FROM sub), 'missing') = '8f000481b4974f26768b205ab5fad8bd8cd43833eb0b29867a73cf479abf188d'
  UNION ALL
  SELECT 4, 'submit owner is postgres', 'postgres',
         coalesce((SELECT pg_catalog.pg_get_userbyid(proowner) FROM sub), 'missing'),
         coalesce((SELECT pg_catalog.pg_get_userbyid(proowner) FROM sub) = 'postgres', false)
  UNION ALL
  SELECT 5, 'submit SECURITY DEFINER, volatile, search_path pinned', 'true/v/{"search_path=public, pg_temp"}',
         coalesce((SELECT prosecdef::text || '/' || provolatile::text || '/' || cfg FROM sub), 'missing'),
         coalesce((SELECT prosecdef AND provolatile = 'v' AND cfg = '{"search_path=public, pg_temp"}' FROM sub), false)
  UNION ALL
  SELECT 6, 'submit EXECUTE: authenticated true, anon false, service_role false', 'true/false/false',
         coalesce((SELECT pg_catalog.has_function_privilege('authenticated', oid, 'EXECUTE')::text || '/' ||
                          pg_catalog.has_function_privilege('anon', oid, 'EXECUTE')::text || '/' ||
                          pg_catalog.has_function_privilege('service_role', oid, 'EXECUTE')::text FROM sub), 'missing'),
         coalesce((SELECT pg_catalog.has_function_privilege('authenticated', oid, 'EXECUTE')
                      AND NOT pg_catalog.has_function_privilege('anon', oid, 'EXECUTE')
                      AND NOT pg_catalog.has_function_privilege('service_role', oid, 'EXECUTE') FROM sub), false)
  UNION ALL
  SELECT 7, 'submit has no PUBLIC EXECUTE ACL entry', 'false',
         coalesce((SELECT EXISTS (SELECT 1 FROM pg_catalog.aclexplode(coalesce(proacl, pg_catalog.acldefault('f', proowner))) a
                                  WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE')::text FROM sub), 'missing'),
         coalesce((SELECT NOT EXISTS (SELECT 1 FROM pg_catalog.aclexplode(coalesce(proacl, pg_catalog.acldefault('f', proowner))) a
                                  WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE') FROM sub), false)
  UNION ALL
  SELECT 8, 'info: submit proacl (recorded; the corrective asserts it is unchanged)', 'n/a',
         coalesce((SELECT proacl::text FROM sub), '<null>'), true
  UNION ALL
  SELECT 9, 'info: response / event rows, all releases (aggregate only)', 'n/a',
         (SELECT pg_catalog.count(*) FROM public.matrix_paper_review_responses)::text || ' / ' ||
         (SELECT pg_catalog.count(*) FROM public.matrix_paper_review_response_events)::text, true
  UNION ALL
  SELECT 10, 'TRANSPORT: rebuilt literal holds exactly 10 backslashes', '10',
         (SELECT pg_catalog.length(s) - pg_catalog.length(pg_catalog.replace(s, pg_catalog.chr(92), '')) FROM lit)::text, (SELECT pg_catalog.length(s) - pg_catalog.length(pg_catalog.replace(s, pg_catalog.chr(92), '')) FROM lit) = 10
  UNION ALL
  SELECT 11, 'TRANSPORT: rebuilt literal is pure ASCII (no decoded code points)', 'true',
         (SELECT (pg_catalog.octet_length(s) = pg_catalog.length(s))::text FROM lit),
         (SELECT pg_catalog.octet_length(s) = pg_catalog.length(s) FROM lit)
  UNION ALL
  SELECT 12, 'TRANSPORT: rebuilt body sha256 = approved activation bytes', 'c9f1ee0bea6a711a84476ff3ed5fa17b702bcb3584740a1ef2c9ab95f349a7ad',
         (SELECT pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.split_part(s, '$fn$', 2), 'UTF8')), 'hex') FROM lit), (SELECT pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.split_part(s, '$fn$', 2), 'UTF8')), 'hex') FROM lit) = 'c9f1ee0bea6a711a84476ff3ed5fa17b702bcb3584740a1ef2c9ab95f349a7ad'
  UNION ALL
  SELECT 13, 'TRANSPORT: literal starts with the CREATE OR REPLACE header of public.matrix_paper_review_submit', 'true',
         (SELECT pg_catalog.left(s, 65) = 'CREATE OR REPLACE FUNCTION public.matrix_paper_review_submit(' || pg_catalog.chr(10) || '  p' FROM lit)::text, (SELECT pg_catalog.left(s, 65) = 'CREATE OR REPLACE FUNCTION public.matrix_paper_review_submit(' || pg_catalog.chr(10) || '  p' FROM lit)
  UNION ALL
  SELECT 20, 'unchanged neighbour body sha256: is_matrix_options_paper_admin', 'fe36eefb668d80898bea8247f44aa9f8dbe99e5a292443f9ab5300257393f080',
         coalesce((SELECT string_agg(pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p.prosrc, 'UTF8')), 'hex'), ',')
                     FROM pg_catalog.pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'is_matrix_options_paper_admin'), 'missing'),
         coalesce((SELECT string_agg(pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p.prosrc, 'UTF8')), 'hex'), ',')
                     FROM pg_catalog.pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'is_matrix_options_paper_admin'), 'missing') = 'fe36eefb668d80898bea8247f44aa9f8dbe99e5a292443f9ab5300257393f080'
  UNION ALL
  SELECT 20, 'unchanged neighbour body sha256: matrix_paper_review_utf16_length', '81a1d91ec6c09e5a81dce3bf02bf7289695018cb5c4b5266da9f52017e69a9aa',
         coalesce((SELECT string_agg(pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p.prosrc, 'UTF8')), 'hex'), ',')
                     FROM pg_catalog.pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'matrix_paper_review_utf16_length'), 'missing'),
         coalesce((SELECT string_agg(pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p.prosrc, 'UTF8')), 'hex'), ',')
                     FROM pg_catalog.pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'matrix_paper_review_utf16_length'), 'missing') = '81a1d91ec6c09e5a81dce3bf02bf7289695018cb5c4b5266da9f52017e69a9aa'
  UNION ALL
  SELECT 20, 'unchanged neighbour body sha256: matrix_paper_review_events_block_update', 'fb7cc0d423f1c7e16179ec4bf4b2961aefdaa33e6b29a13f960c66bf6bc07968',
         coalesce((SELECT string_agg(pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p.prosrc, 'UTF8')), 'hex'), ',')
                     FROM pg_catalog.pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'matrix_paper_review_events_block_update'), 'missing'),
         coalesce((SELECT string_agg(pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p.prosrc, 'UTF8')), 'hex'), ',')
                     FROM pg_catalog.pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'matrix_paper_review_events_block_update'), 'missing') = 'fb7cc0d423f1c7e16179ec4bf4b2961aefdaa33e6b29a13f960c66bf6bc07968'
  UNION ALL
  SELECT 20, 'unchanged neighbour body sha256: matrix_paper_review_save_draft', 'e1283bac453ef1ad03ce2c42c6936f435490392cf431501713fb7bd394ac6c73',
         coalesce((SELECT string_agg(pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p.prosrc, 'UTF8')), 'hex'), ',')
                     FROM pg_catalog.pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'matrix_paper_review_save_draft'), 'missing'),
         coalesce((SELECT string_agg(pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p.prosrc, 'UTF8')), 'hex'), ',')
                     FROM pg_catalog.pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = 'matrix_paper_review_save_draft'), 'missing') = 'e1283bac453ef1ad03ce2c42c6936f435490392cf431501713fb7bd394ac6c73'
) r
ORDER BY ord, check_name;
