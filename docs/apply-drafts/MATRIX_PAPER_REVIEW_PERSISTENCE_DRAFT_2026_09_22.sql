-- =====================================================================
-- matrix_paper_review_responses: server persistence for the revised
-- Matrix Options paper "My Review" panel (draft autosave + submit).
-- =====================================================================
--
-- DRAFT ONLY -- NOT APPLIED. Requires GREEN /codex-review on this exact SQL
-- and explicit owner approval before any apply (CLAUDE.md Supabase
-- Protocol rule 2). See NOTES.md beside this file for rationale,
-- assumptions, seed provenance and open questions.
--
-- App contract served (must work unchanged):
--   GET  /api/matrix-options/paper/reviews
--        -> SELECT id,document_version,manifest_sha256,cohort_id,question_id,
--           draft_text,submitted_text,revision,submitted_revision,
--           submitted_at,updated_at FROM matrix_paper_review_responses
--           WHERE user_id = <self> AND document_version = ? AND manifest_sha256 = ?
--   PUT  /api/matrix-options/paper/reviews/[questionId]
--        -> rpc matrix_paper_review_save_draft | matrix_paper_review_submit
--           (p_document_version, p_manifest_sha256, p_cohort_id,
--            p_question_id, p_text, p_expected_revision)
--           returning jsonb {outcome, row}
--   Admin page + CSV export (admin / matrix_admin) -> SELECT all rows incl.
--        user_id via the authenticated (RLS) client.
--
-- Objects created (in order):
--   1. public.is_matrix_options_paper_admin()            helper (RLS)
--   1b. public.matrix_paper_review_utf16_length(text)    helper (CHECK + too_large)
--   2. public.matrix_paper_review_questions              release-bound seeded identities
--   3. public.matrix_paper_review_responses              one row per user+release+question
--   4. public.matrix_paper_review_response_events        append-only write log (hash, not text)
--   5. public.matrix_paper_review_events_block_update()  trigger fn (append-only guard)
--   6. public.matrix_paper_review_save_draft(...)        SECURITY DEFINER write RPC
--   7. public.matrix_paper_review_submit(...)            SECURITY DEFINER write RPC
--   8. Seed: 12 question identities for the current release
--
-- REVISION 2 (orchestrator decisions, see NOTES.md "Revision 2"):
--   * submitted_at / updated_at are timestamptz (set to now() by the RPCs).
--     The RPC jsonb row renders them as UTC 'YYYY-MM-DDTHH:MM:SS.mmmZ'
--     via to_char (NULL stays JSON null). The table-select path (GET and
--     admin) returns PostgREST's native form; the app normalizer is being
--     widened by the orchestrator to accept it.
--   * No accepting_responses column; identity recheck is exactly the
--     stated contract (unknown_identity / stale_manifest).
--
-- REVISION 3 (Leg 1a review RED fixes, see NOTES.md "Revision 3"):
--   * Text limit counted in UTF-16 code units via
--     public.matrix_paper_review_utf16_length (CHECKs + RPC too_large).
--   * Plain CREATE TABLE / INDEX / FUNCTION: a leftover older shape
--     aborts the migration instead of being silently kept.
--   * Seed asserts the exact identity set (symmetric difference empty),
--     ON CONFLICT has an explicit target.
--   * submit's lost-insert-race re-read applies the noop test first.
--
-- REVISION 4 (codex UI round 2 fixes, see NOTES.md "Revision 4"):
--   * Both write RPCs reject anonymous sessions (is_anonymous claim not
--     false -> 'unauthenticated'; a missing claim is rejected).
--   * Both write RPCs throttle: >= 60 event rows for the caller in the last
--     minute -> 'rate_limited' (direct PostgREST calls bypass the app's
--     rate limiter). events_user_idx is (user_id, occurred_at).
--
-- REVISION 5 (codex sol final round fixes, see NOTES.md "Revision 5"):
--   * The throttle count-and-write is serialized per user with a shared
--     pg_advisory_xact_lock (both RPCs), so it is an exact bound.
--   * submit rejects blank text (empty or only whitespace) ->
--     'blank_submission'; blank DRAFT saves stay allowed (clearing a draft).
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Admin helper. True when the caller (auth.uid()) holds role 'admin'
--    or 'matrix_admin' in public.user_roles. Mirrors public.is_admin()
--    (STABLE SECURITY DEFINER, search_path public, pg_temp) and the
--    admin/matrix_admin predicate used by existing matrix policies and by
--    src/lib/matrix-options/paper-admin-guard.ts PAPER_ADMIN_ROLES.
--    SECURITY DEFINER so the user_roles lookup is not itself filtered by
--    user_roles RLS. Returns false for anon / NULL auth.uid().
-- ---------------------------------------------------------------------
CREATE FUNCTION public.is_matrix_options_paper_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.user_roles ur
     WHERE ur.user_id = auth.uid()
       AND ur.role IN ('admin', 'matrix_admin')
  );
$$;

ALTER FUNCTION public.is_matrix_options_paper_admin() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.is_matrix_options_paper_admin()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_matrix_options_paper_admin()
  TO authenticated;

COMMENT ON FUNCTION public.is_matrix_options_paper_admin() IS
  'True when auth.uid() has role admin or matrix_admin in public.user_roles. Used by matrix_paper_review_* RLS policies.';

-- ---------------------------------------------------------------------
-- 1b. UTF-16 length helper (revision 3). The app's strict parsers count
--     text length in UTF-16 code units (JS string .length: zod
--     z.string().max(20000) in review-responses.ts, text() in
--     review-csv.ts). Postgres char_length counts code points, so a code
--     point above U+FFFF (stored as a surrogate pair in UTF-16) counts 1
--     here but 2 in the app. utf16_length = code points + astral code
--     points. Used in the table CHECKs and the RPC too_large test so the
--     DB can never hold text the app's outbound parsers reject.
--     IMMUTABLE (regexp_count and char_length are immutable), STRICT
--     (NULL in -> NULL out), every reference schema-qualified and
--     search_path pinned so the CHECKs do not depend on the caller's
--     search_path. Requires server_encoding UTF8 (asserted below).
--     Not an RPC: no EXECUTE grant to any API role; it is only evaluated
--     inside the SECURITY DEFINER RPCs and CHECKs (as the table owner's
--     write path).
-- ---------------------------------------------------------------------
CREATE FUNCTION public.matrix_paper_review_utf16_length(p_text text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path = pg_catalog, pg_temp
AS $$
  SELECT pg_catalog.char_length(p_text)
       -- E'' string: the regex escape reaches the regex engine as \U...
       -- regardless of the session's standard_conforming_strings.
       + pg_catalog.regexp_count(p_text, E'[\\U00010000-\\U0010FFFF]');
$$;

ALTER FUNCTION public.matrix_paper_review_utf16_length(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.matrix_paper_review_utf16_length(text)
  FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON FUNCTION public.matrix_paper_review_utf16_length(text) IS
  'Length of the text in UTF-16 code units (JS .length). Used by matrix_paper_review_* CHECKs and RPCs.';

-- Abort unless the helper behaves as specified on this server:
-- 'a' + U+1F600 + 'b' is 3 code points and 4 UTF-16 units.
DO $$
BEGIN
  IF pg_catalog.current_setting('server_encoding') <> 'UTF8' THEN
    RAISE EXCEPTION 'matrix_paper_review_utf16_length requires UTF8, got %',
      pg_catalog.current_setting('server_encoding');
  END IF;
  IF public.matrix_paper_review_utf16_length('a' || pg_catalog.chr(128512) || 'b') <> 4
     OR public.matrix_paper_review_utf16_length('abc') <> 3
     OR public.matrix_paper_review_utf16_length('') <> 0 THEN
    RAISE EXCEPTION 'matrix_paper_review_utf16_length self-test failed';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------
-- 2. Reference table: the release-bound question identities a response
--    may target. Seeded per release (section 8). A (document_version,
--    manifest_sha256) pair identifies one review release; question_id is
--    unique within a release and belongs to exactly one cohort.
-- ---------------------------------------------------------------------
CREATE TABLE public.matrix_paper_review_questions (
  document_version    text        NOT NULL,
  manifest_sha256     text        NOT NULL,
  cohort_id           text        NOT NULL,
  question_id         text        NOT NULL,
  question_number     integer     NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT matrix_paper_review_questions_pkey
    PRIMARY KEY (document_version, manifest_sha256, question_id),
  -- FK target for responses (includes cohort_id so a response cannot
  -- claim a cohort the question does not belong to).
  CONSTRAINT matrix_paper_review_questions_identity_key
    UNIQUE (document_version, manifest_sha256, cohort_id, question_id),
  CONSTRAINT matrix_paper_review_questions_number_key
    UNIQUE (document_version, manifest_sha256, question_number),
  CONSTRAINT matrix_paper_review_questions_version_chk
    CHECK (char_length(document_version) BETWEEN 1 AND 128),
  CONSTRAINT matrix_paper_review_questions_sha_chk
    CHECK (manifest_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT matrix_paper_review_questions_cohort_chk
    CHECK (char_length(cohort_id) BETWEEN 1 AND 80),
  CONSTRAINT matrix_paper_review_questions_question_chk
    CHECK (char_length(question_id) BETWEEN 1 AND 256),
  CONSTRAINT matrix_paper_review_questions_number_chk
    CHECK (question_number > 0)
);

-- Supports the stale_manifest probe: same (version, cohort, question),
-- any manifest.
CREATE INDEX matrix_paper_review_questions_probe_idx
  ON public.matrix_paper_review_questions (document_version, cohort_id, question_id);

COMMENT ON TABLE public.matrix_paper_review_questions IS
  'Release-bound seeded review question identities (document_version, manifest_sha256, cohort_id, question_id). Written only by migrations.';

-- ---------------------------------------------------------------------
-- 3. Response table. One row per (user, release, question). Written ONLY
--    by the SECURITY DEFINER RPCs below (no client write grants).
--    revision is the optimistic-concurrency token; submitted_* capture
--    the last submitted snapshot. updated_at is set to now() by the RPCs
--    (no update_updated_at_column() trigger; there is no client UPDATE
--    path for a trigger to catch).
-- ---------------------------------------------------------------------
CREATE TABLE public.matrix_paper_review_responses (
  id                 uuid        NOT NULL DEFAULT gen_random_uuid(),
  user_id            uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_version   text        NOT NULL,
  manifest_sha256    text        NOT NULL,
  cohort_id          text        NOT NULL,
  question_id        text        NOT NULL,
  draft_text         text        NOT NULL DEFAULT '',
  submitted_text     text,
  revision           integer     NOT NULL DEFAULT 0,
  submitted_revision integer,
  submitted_at       timestamptz,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT matrix_paper_review_responses_pkey PRIMARY KEY (id),
  -- One response per user per release per question. Leading columns also
  -- serve the GET filter (user_id, document_version, manifest_sha256)
  -- ORDER BY question_id, so no separate index is needed for it.
  CONSTRAINT matrix_paper_review_responses_identity_key
    UNIQUE (user_id, document_version, manifest_sha256, question_id),
  CONSTRAINT matrix_paper_review_responses_question_fkey
    FOREIGN KEY (document_version, manifest_sha256, cohort_id, question_id)
    REFERENCES public.matrix_paper_review_questions
      (document_version, manifest_sha256, cohort_id, question_id)
    ON DELETE RESTRICT,
  CONSTRAINT matrix_paper_review_responses_draft_len_chk
    CHECK (public.matrix_paper_review_utf16_length(draft_text) <= 20000),
  CONSTRAINT matrix_paper_review_responses_submitted_len_chk
    CHECK (submitted_text IS NULL
           OR public.matrix_paper_review_utf16_length(submitted_text) <= 20000),
  CONSTRAINT matrix_paper_review_responses_revision_chk
    CHECK (revision >= 0),
  CONSTRAINT matrix_paper_review_responses_submitted_revision_chk
    CHECK (submitted_revision IS NULL
           OR (submitted_revision >= 1 AND submitted_revision <= revision)),
  -- The three submitted_* columns are set together or not at all.
  CONSTRAINT matrix_paper_review_responses_submitted_set_chk
    CHECK ((submitted_revision IS NULL) = (submitted_text IS NULL)
       AND (submitted_revision IS NULL) = (submitted_at IS NULL))
);

-- Admin filters (release / cohort / question) and FK-side lookups.
CREATE INDEX matrix_paper_review_responses_release_idx
  ON public.matrix_paper_review_responses
  (document_version, manifest_sha256, cohort_id, question_id);

COMMENT ON TABLE public.matrix_paper_review_responses IS
  'Per-user review responses for the revised Matrix Options paper. Written only via matrix_paper_review_save_draft / matrix_paper_review_submit.';
COMMENT ON COLUMN public.matrix_paper_review_responses.updated_at IS
  'Time of the last successful RPC write (set to now() by the RPCs).';
COMMENT ON COLUMN public.matrix_paper_review_responses.submitted_at IS
  'Time of the last successful submit, or NULL when never submitted.';

-- ---------------------------------------------------------------------
-- 4. Append-only event log. One row per successful write (not for
--    noop/stale/rejected calls). Stores a SHA-256 of the text and its
--    length, never the text itself.
-- ---------------------------------------------------------------------
CREATE TABLE public.matrix_paper_review_response_events (
  id               bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  response_id      uuid        NOT NULL
                     REFERENCES public.matrix_paper_review_responses(id) ON DELETE CASCADE,
  user_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_version text        NOT NULL,
  manifest_sha256  text        NOT NULL,
  cohort_id        text        NOT NULL,
  question_id      text        NOT NULL,
  action           text        NOT NULL,
  revision         integer     NOT NULL,
  text_sha256      text        NOT NULL,
  text_length      integer     NOT NULL,
  occurred_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT matrix_paper_review_response_events_action_chk
    CHECK (action IN ('save-draft', 'submit')),
  CONSTRAINT matrix_paper_review_response_events_revision_chk
    CHECK (revision >= 1),
  CONSTRAINT matrix_paper_review_response_events_sha_chk
    CHECK (text_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT matrix_paper_review_response_events_len_chk
    CHECK (text_length BETWEEN 0 AND 20000)
);

CREATE INDEX matrix_paper_review_response_events_response_idx
  ON public.matrix_paper_review_response_events (response_id, revision);
CREATE INDEX matrix_paper_review_response_events_user_idx
  ON public.matrix_paper_review_response_events (user_id, occurred_at);

COMMENT ON TABLE public.matrix_paper_review_response_events IS
  'Append-only log of successful review writes: action, revision after write, sha256 + UTF-16 length of the text (text itself is not stored).';

-- ---------------------------------------------------------------------
-- 5. Append-only guard: reject UPDATE on the event log for every role
--    (defense in depth beyond grants). DELETE is not trigger-blocked so
--    ON DELETE CASCADE from auth.users / responses still works; anon and
--    authenticated hold no DELETE grant. This is a trigger function, not
--    an RPC: SECURITY INVOKER and no EXECUTE grant to any API role.
-- ---------------------------------------------------------------------
CREATE FUNCTION public.matrix_paper_review_events_block_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'matrix_paper_review_response_events is append-only'
    USING ERRCODE = '42501';
END;
$$;

ALTER FUNCTION public.matrix_paper_review_events_block_update() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.matrix_paper_review_events_block_update()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS matrix_paper_review_response_events_no_update
  ON public.matrix_paper_review_response_events;
CREATE TRIGGER matrix_paper_review_response_events_no_update
  BEFORE UPDATE ON public.matrix_paper_review_response_events
  FOR EACH ROW
  EXECUTE FUNCTION public.matrix_paper_review_events_block_update();

-- ---------------------------------------------------------------------
-- RLS + grants for the three tables.
-- Supabase default privileges in public grant ALL on new tables and
-- sequences to anon and authenticated (verified via pg_default_acl), so
-- everything is revoked explicitly and only SELECT is re-granted to
-- authenticated. service_role keeps its default privileges (it bypasses
-- RLS and is server-only).
-- Policies wrap auth.uid() / the helper in (SELECT ...) so Postgres
-- evaluates them once per statement (Supabase RLS performance guidance).
-- ---------------------------------------------------------------------
ALTER TABLE public.matrix_paper_review_questions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matrix_paper_review_responses       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matrix_paper_review_response_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.matrix_paper_review_questions       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.matrix_paper_review_responses       FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.matrix_paper_review_response_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.matrix_paper_review_response_events_id_seq
  FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.matrix_paper_review_questions       TO authenticated;
GRANT SELECT ON TABLE public.matrix_paper_review_responses       TO authenticated;
GRANT SELECT ON TABLE public.matrix_paper_review_response_events TO authenticated;

-- Questions: readable by any signed-in user (identities are not secret;
-- they are also compiled into the app). No write policies.
DROP POLICY IF EXISTS "matrix_paper_review_questions_select_authenticated"
  ON public.matrix_paper_review_questions;
CREATE POLICY "matrix_paper_review_questions_select_authenticated"
  ON public.matrix_paper_review_questions
  FOR SELECT
  TO authenticated
  USING (true);

-- Responses: own rows, or all rows for admin / matrix_admin. No
-- INSERT/UPDATE/DELETE policies: the RPCs are the only write path.
DROP POLICY IF EXISTS "matrix_paper_review_responses_select_own"
  ON public.matrix_paper_review_responses;
CREATE POLICY "matrix_paper_review_responses_select_own"
  ON public.matrix_paper_review_responses
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "matrix_paper_review_responses_select_paper_admin"
  ON public.matrix_paper_review_responses;
CREATE POLICY "matrix_paper_review_responses_select_paper_admin"
  ON public.matrix_paper_review_responses
  FOR SELECT
  TO authenticated
  USING ((SELECT public.is_matrix_options_paper_admin()));

-- Events: same visibility as responses.
DROP POLICY IF EXISTS "matrix_paper_review_response_events_select_own"
  ON public.matrix_paper_review_response_events;
CREATE POLICY "matrix_paper_review_response_events_select_own"
  ON public.matrix_paper_review_response_events
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "matrix_paper_review_response_events_select_paper_admin"
  ON public.matrix_paper_review_response_events;
CREATE POLICY "matrix_paper_review_response_events_select_paper_admin"
  ON public.matrix_paper_review_response_events
  FOR SELECT
  TO authenticated
  USING ((SELECT public.is_matrix_options_paper_admin()));

-- ---------------------------------------------------------------------
-- 6. matrix_paper_review_save_draft
--    Check order: unauthenticated (NULL uid, then anonymous) ->
--    rate_limited -> NULL text (error) -> too_large ->
--    identity (unknown_identity / stale_manifest) -> row lock -> CAS.
--    No row: expected must be NULL or 0 (else stale_revision, row null);
--      insert draft_text = p_text, revision = 1.
--      Concurrent first insert (unique conflict) -> stale_revision with the
--      now-existing row (ON CONFLICT DO NOTHING + re-read; no exception).
--    Row exists: expected IS DISTINCT FROM revision -> stale_revision with
--      the current row; else draft_text = p_text, revision + 1.
--    NEVER touches submitted_text / submitted_revision / submitted_at.
--    Every successful write appends one event ('save-draft').
--    Returns jsonb {outcome, row}; row has exactly the 11 keys of
--    reviewResponseRowSchema (no user_id) or is JSON null.
-- ---------------------------------------------------------------------
CREATE FUNCTION public.matrix_paper_review_save_draft(
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
AS $$
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

  -- Identity recheck against the seeded reference table.
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

  -- Serialize writers on this (user, release, question) row.
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
       draft_text, revision, updated_at)
    VALUES
      (v_uid, p_document_version, p_manifest_sha256, p_cohort_id, p_question_id,
       p_text, 1, v_now)
    ON CONFLICT ON CONSTRAINT matrix_paper_review_responses_identity_key DO NOTHING
    RETURNING * INTO v_row;

    IF FOUND THEN
      v_outcome := 'ok';
    ELSE
      -- Lost the first-insert race: the concurrent winner has committed.
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
      v_outcome := 'stale_revision';
    END IF;
  ELSIF p_expected_revision IS DISTINCT FROM v_row.revision THEN
    v_outcome := 'stale_revision';
  ELSE
    UPDATE public.matrix_paper_review_responses r
       SET draft_text = p_text,
           revision   = r.revision + 1,
           updated_at = v_now
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
       v_row.cohort_id, v_row.question_id, 'save-draft', v_row.revision,
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
$$;

ALTER FUNCTION public.matrix_paper_review_save_draft(text, text, text, text, text, integer)
  OWNER TO postgres;
REVOKE ALL ON FUNCTION public.matrix_paper_review_save_draft(text, text, text, text, text, integer)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.matrix_paper_review_save_draft(text, text, text, text, text, integer)
  TO authenticated;

-- ---------------------------------------------------------------------
-- 7. matrix_paper_review_submit
--    Same prechecks (including anonymous reject and rate_limited) and
--    lock as save_draft, plus blank text -> 'blank_submission' (after
--    too_large). Then, on an existing row:
--      (a) NOOP FIRST: if submitted_revision = revision AND
--          submitted_text = p_text, the requested end state already holds
--          -> noop_already_submitted with the row, no revision bump, no
--          event, regardless of p_expected_revision (idempotent retry of
--          a submit whose response was lost). See NOTES.md section 5.
--      (b) CAS: expected IS DISTINCT FROM revision -> stale_revision.
--      (c) draft_text = submitted_text = p_text, revision + 1,
--          submitted_revision = new revision, submitted_at = updated_at = now.
--    No row: expected must be NULL or 0; insert already-submitted row at
--    revision 1. Race handling as in save_draft.
--    Race loser (revision 3): the re-read row gets the same noop test
--    before falling back to stale_revision.
--    Every successful write appends one event ('submit').
-- ---------------------------------------------------------------------
CREATE FUNCTION public.matrix_paper_review_submit(
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
AS $$
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
  IF p_text ~ '^[[:space:]\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]*$' THEN
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
$$;

ALTER FUNCTION public.matrix_paper_review_submit(text, text, text, text, text, integer)
  OWNER TO postgres;
REVOKE ALL ON FUNCTION public.matrix_paper_review_submit(text, text, text, text, text, integer)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.matrix_paper_review_submit(text, text, text, text, text, integer)
  TO authenticated;

-- ---------------------------------------------------------------------
-- 8. Seed: current release identity, computed from the app
--    (getReviewManifest(); see NOTES.md section 2 for the command).
--    documentVersion = 1.0.11-remediated-7-8-successor-20260918-D
--    manifestSha256  = 5d83a3c9ba78e4da234c70678fcf57db9abbefc189002303879ebc0c80ac926e
--    12 (cohort_id, question_id, question_number) from cohorts-v1.json
--    joined to reviewer-guide-v1.json on number.
-- ---------------------------------------------------------------------
-- Revision 3: one DO block holds the expected identity set once (as a
-- jsonb constant), inserts it with an explicit conflict target, then
-- aborts the whole migration unless the table's rows for this release are
-- EXACTLY that set (symmetric difference over all five columns is empty)
-- and the set has 12 members. A pre-existing row with a different cohort
-- or number for the same question_id therefore aborts instead of being
-- silently kept by DO NOTHING.
DO $$
DECLARE
  v_dv       constant text := '1.0.11-remediated-7-8-successor-20260918-D';
  v_sha      constant text := '5d83a3c9ba78e4da234c70678fcf57db9abbefc189002303879ebc0c80ac926e';
  v_expected constant jsonb := '[
    {"cohort_id": "categories",           "question_id": "rpq:1.0.11-remediated-7-8-successor-20260918-D:q01", "question_number": 1},
    {"cohort_id": "categories",           "question_id": "rpq:1.0.11-remediated-7-8-successor-20260918-D:q02", "question_number": 2},
    {"cohort_id": "categories",           "question_id": "rpq:1.0.11-remediated-7-8-successor-20260918-D:q03", "question_number": 3},
    {"cohort_id": "pathway-grid",         "question_id": "rpq:1.0.11-remediated-7-8-successor-20260918-D:q04", "question_number": 4},
    {"cohort_id": "pathway-grid",         "question_id": "rpq:1.0.11-remediated-7-8-successor-20260918-D:q05", "question_number": 5},
    {"cohort_id": "exposure-assumptions", "question_id": "rpq:1.0.11-remediated-7-8-successor-20260918-D:q06", "question_number": 6},
    {"cohort_id": "exposure-assumptions", "question_id": "rpq:1.0.11-remediated-7-8-successor-20260918-D:q07", "question_number": 7},
    {"cohort_id": "inputs-evidence",      "question_id": "rpq:1.0.11-remediated-7-8-successor-20260918-D:q08", "question_number": 8},
    {"cohort_id": "inputs-evidence",      "question_id": "rpq:1.0.11-remediated-7-8-successor-20260918-D:q09", "question_number": 9},
    {"cohort_id": "methods-water-type",   "question_id": "rpq:1.0.11-remediated-7-8-successor-20260918-D:q10", "question_number": 10},
    {"cohort_id": "methods-water-type",   "question_id": "rpq:1.0.11-remediated-7-8-successor-20260918-D:q11", "question_number": 11},
    {"cohort_id": "inputs-evidence",      "question_id": "rpq:1.0.11-remediated-7-8-successor-20260918-D:q12", "question_number": 12}
  ]'::jsonb;
  v_expected_count integer;
  v_diff           integer;
BEGIN
  SELECT pg_catalog.count(*) INTO v_expected_count
    FROM pg_catalog.jsonb_to_recordset(v_expected)
         AS e(cohort_id text, question_id text, question_number integer);
  IF v_expected_count <> 12 THEN
    RAISE EXCEPTION 'seed literal has % entries, expected 12', v_expected_count;
  END IF;

  INSERT INTO public.matrix_paper_review_questions
    (document_version, manifest_sha256, cohort_id, question_id, question_number)
  SELECT v_dv, v_sha, e.cohort_id, e.question_id, e.question_number
    FROM pg_catalog.jsonb_to_recordset(v_expected)
         AS e(cohort_id text, question_id text, question_number integer)
  ON CONFLICT (document_version, manifest_sha256, question_id) DO NOTHING;

  WITH expected AS (
    SELECT v_dv AS document_version, v_sha AS manifest_sha256,
           e.cohort_id, e.question_id, e.question_number
      FROM pg_catalog.jsonb_to_recordset(v_expected)
           AS e(cohort_id text, question_id text, question_number integer)
  ), actual AS (
    SELECT q.document_version, q.manifest_sha256, q.cohort_id, q.question_id,
           q.question_number
      FROM public.matrix_paper_review_questions q
     WHERE q.document_version = v_dv
       AND q.manifest_sha256  = v_sha
  )
  SELECT pg_catalog.count(*) INTO v_diff
    FROM ((SELECT * FROM expected EXCEPT SELECT * FROM actual)
          UNION ALL
          (SELECT * FROM actual EXCEPT SELECT * FROM expected)) AS d;
  IF v_diff <> 0 THEN
    RAISE EXCEPTION 'matrix_paper_review_questions seed mismatch: % differing identities', v_diff;
  END IF;
END;
$$;

COMMIT;
