-- =====================================================================
-- CORRECTIVE for MATRIX_PAPER_REVIEW_V0991_ACTIVATION_2026_10_14.sql (2026_10_15)
-- Replaces ONLY the body of public.matrix_paper_review_submit with the
-- approved bytes (prosrc sha256 c9f1ee0bea6a711a84476ff3ed5fa17b702bcb3584740a1ef2c9ab95f349a7ad).
-- =====================================================================
--
-- DRAFT -- NOT APPLIED; requires GREEN /codex-review and a separate owner
-- approval of this exact file + sha256.
--
-- Why: the activation was applied 2026-10-15 through MCP execute_sql. The
-- tool-call transport decoded the ten backslash-u escape sequences in the
-- submit blank_submission regex (main file line 596) into literal code
-- points, so the installed body hashes to
-- 8f000481b4974f26768b205ab5fad8bd8cd43833eb0b29867a73cf479abf188d (VERIFY row 99 RED). No other byte of any installed object
-- differs.
--
-- Behaviour change (owner-acknowledged): restoring the approved bytes also
-- restores NOTES M6. A read-only sweep of all 1,112,063 Unicode scalar values
-- (live server, 2026-10-15) found the decoded and approved regexes differ on
-- exactly five code points: U+001C, U+001D, U+001E, U+001F and U+0085. The
-- approved bytes treat them as blank (30 blank code points in all; the decoded
-- body 25). After this corrective a submission made only of blank characters
-- that include any of those five is rejected as blank_submission (HTTP 422),
-- as approved and reviewed, while JS trim() keeps all five. No data or
-- security impact.
--
-- In-flight calls: a submit call that is already executing keeps the body it
-- started with until it finishes; this corrective cannot switch it (cancelling
-- a backend is a separate owner decision). The only observable effect is that
-- such a call could accept a submission made only of blank characters that
-- include one of those five. This is detected, not prevented: the read-only POSTCHECK
-- (..._POSTCHECK.sql) confirms no submit call is still running and counts
-- submitted rows the approved regex treats as blank (expected 0).
--
-- Transport-safe by construction: this file contains NO backslash. The
-- statement text below carries the placeholder ~BS~ where the approved body
-- has a backslash; the server substitutes chr(92) before EXECUTE. The
-- function header is the activation file's header with CREATE -> CREATE OR
-- REPLACE; the body is the activation file's body verbatim (generated
-- programmatically, never typed).
--
-- CREATE OR REPLACE keeps the function oid, owner (postgres) and ACL
-- ({postgres=X/postgres,authenticated=X/postgres}: EXECUTE for the owner and
-- authenticated; none for PUBLIC, anon or service_role). Same signature, so no PostgREST schema
-- reload is needed. Touches no table, row, grant, policy or other function.
--
-- Fail-closed, one transaction: refuses unless current_user is postgres,
-- exactly one public function has that name, and its installed body is the
-- known deviant hash above. After EXECUTE it asserts the installed body hash
-- equals the approved hash and owner, ACL, SECURITY DEFINER, volatility and
-- proconfig are unchanged; any mismatch RAISEs and nothing is committed.
-- =====================================================================

BEGIN;

DO $do$
DECLARE
  v_count    integer;
  v_oid      oid;
  v_sha      text;
  v_acl      text;
  v_owner    oid;
  v_sql      text;
  r          record;
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'corrective must run as postgres, not %', current_user;
  END IF;

  SELECT pg_catalog.count(*) INTO v_count
    FROM pg_catalog.pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname = 'matrix_paper_review_submit';
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'expected exactly 1 public.matrix_paper_review_submit, found %', v_count;
  END IF;

  SELECT p.oid, pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p.prosrc, 'UTF8')), 'hex'),
         p.proacl::text, p.proowner
    INTO v_oid, v_sha, v_acl, v_owner
    FROM pg_catalog.pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname = 'matrix_paper_review_submit';
  IF v_sha <> '8f000481b4974f26768b205ab5fad8bd8cd43833eb0b29867a73cf479abf188d' THEN
    RAISE EXCEPTION 'installed submit body is not the diagnosed deviant (found %); refusing', v_sha;
  END IF;

  v_sql := pg_catalog.replace($q$CREATE OR REPLACE FUNCTION public.matrix_paper_review_submit(
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
$fn$$q$, '~BS~', pg_catalog.chr(92));
  EXECUTE v_sql;

  SELECT p.oid, pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p.prosrc, 'UTF8')), 'hex') AS sha,
         p.proacl::text AS acl, p.proowner, p.prosecdef, p.provolatile, p.proconfig::text AS cfg,
         pg_catalog.pg_get_function_identity_arguments(p.oid) AS args
    INTO r
    FROM pg_catalog.pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname = 'matrix_paper_review_submit';
  IF r.oid <> v_oid THEN
    RAISE EXCEPTION 'function oid changed (% -> %)', v_oid, r.oid;
  END IF;
  IF r.sha <> 'c9f1ee0bea6a711a84476ff3ed5fa17b702bcb3584740a1ef2c9ab95f349a7ad' THEN
    RAISE EXCEPTION 'corrected submit body sha256 is %, expected approved bytes', r.sha;
  END IF;
  IF r.acl IS DISTINCT FROM v_acl OR r.proowner <> v_owner THEN
    RAISE EXCEPTION 'owner or ACL changed (acl % -> %)', v_acl, r.acl;
  END IF;
  IF NOT r.prosecdef OR r.provolatile <> 'v'
     OR r.cfg IS DISTINCT FROM '{"search_path=public, pg_temp"}'
     OR r.args <> 'p_document_version text, p_manifest_sha256 text, p_cohort_id text, p_question_id text, p_text text, p_expected_revision integer' THEN
    RAISE EXCEPTION 'function attributes changed (secdef %, vol %, cfg %, args %)', r.prosecdef, r.provolatile, r.cfg, r.args;
  END IF;
END;
$do$;

COMMIT;
