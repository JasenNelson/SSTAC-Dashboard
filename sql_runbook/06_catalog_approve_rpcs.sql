-- ============================================================================
-- BATCH 6: Catalog approve RPCs. Creates the staging-approve RPCs:
--   catalog_approve_staging_row (single) + catalog_approve_staging_rows_bulk
--   (bulk) + its concurrency-guard replacement (advisory-lock + supersede guards).
-- Idempotent: safe to run even if already applied (all three are
--   CREATE OR REPLACE FUNCTION; signature/RETURNS/OWNER/grants preserved). Run
--   after BATCH 5 (these RPCs depend on catalog_extraction_staging).
-- Needed-if: catalog staging-approve write path is in scope.
-- Source (concatenated verbatim, in order):
--   supabase/migrations/20260527000005_catalog_approve_staging_rpc.sql
--   supabase/migrations/20260530000001_catalog_approve_staging_rows_bulk.sql
--   supabase/migrations/20260602000001_catalog_approve_staging_rows_bulk_concurrency_guards.sql
-- ============================================================================

-- =============================================================================
-- catalog_approve_staging_row RPC: transactional approve flow for staging rows
-- =============================================================================
--
-- Author:   Stream D autonomous session (Opus 4.7), 2026-05-27.
-- Branch:   feat/stream-d-catalog-agent-scaffold.
-- Reason:   Sub-task 5 codex review surfaced a race condition: two admins
--           approving the same staging row simultaneously could each insert
--           a production row, then only one UPDATEs the staging row, leaving
--           an orphan production row with no staging back-link. Fix is a
--           Postgres function that runs SELECT ... FOR UPDATE -> INSERT
--           target -> UPDATE staging atomically in one transaction.
--
-- HITL gate: this migration MUST be applied AFTER 20260527000004
--            (the catalog_extraction_staging table). Owner pastes both into
--            Supabase Studio SQL Editor in order.
--
-- Security:  SECURITY DEFINER with search_path locked to public, pg_temp.
--            The function performs its own admin gating against
--            public.user_roles (admin or matrix_admin). EXECUTE is granted
--            to authenticated; anon is denied.
--
-- Pre-flight exploratory SQL (run BEFORE applying):
--
--   SELECT proname, pronargs FROM pg_proc WHERE proname = 'catalog_approve_staging_row';
--   -- Expected: 0 rows.
--
--   SELECT routine_name FROM information_schema.routines
--    WHERE routine_schema = 'public' AND routine_name = 'catalog_approve_staging_row';
--   -- Expected: 0 rows.
--
-- =============================================================================

CREATE OR REPLACE FUNCTION public.catalog_approve_staging_row(
  p_staging_id UUID,
  p_hitl_notes TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_uid    UUID;
  v_staging_row   public.catalog_extraction_staging%ROWTYPE;
  v_target_table  TEXT;
  v_promoted_id   UUID;
  v_insert_cols   TEXT;
BEGIN
  -- ---------------------------------------------------------------------
  -- Admin gating
  -- ---------------------------------------------------------------------
  v_caller_uid := auth.uid();
  IF v_caller_uid IS NULL THEN
    RAISE EXCEPTION 'catalog_approve_staging_row: no authenticated user'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = v_caller_uid
       AND role IN ('admin', 'matrix_admin')
  ) THEN
    RAISE EXCEPTION 'catalog_approve_staging_row: user lacks admin or matrix_admin role'
      USING ERRCODE = '42501';
  END IF;

  -- ---------------------------------------------------------------------
  -- Load + lock the staging row. FOR UPDATE blocks any other concurrent
  -- approve call on the same row until this transaction commits or rolls
  -- back, eliminating the SELECT-then-UPDATE race.
  -- ---------------------------------------------------------------------
  SELECT * INTO v_staging_row
    FROM public.catalog_extraction_staging
   WHERE id = p_staging_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'catalog_approve_staging_row: staging row % not found', p_staging_id
      USING ERRCODE = 'P0002';
  END IF;

  IF v_staging_row.hitl_status <> 'pending' THEN
    RAISE EXCEPTION
      'catalog_approve_staging_row: staging row % is %, cannot approve',
      p_staging_id, v_staging_row.hitl_status
      USING ERRCODE = 'P0001';
  END IF;

  -- ---------------------------------------------------------------------
  -- Resolve target table from proposed_kind.
  -- ---------------------------------------------------------------------
  CASE v_staging_row.proposed_kind
    WHEN 'parameter_value' THEN v_target_table := 'promoted_parameter_values';
    WHEN 'evidence_item'   THEN v_target_table := 'catalog_evidence_items';
    WHEN 'source_lead'     THEN v_target_table := 'source_lead_triage';
    ELSE
      RAISE EXCEPTION
        'catalog_approve_staging_row: unknown proposed_kind % on staging row %',
        v_staging_row.proposed_kind, p_staging_id
        USING ERRCODE = 'P0001';
  END CASE;

  -- ---------------------------------------------------------------------
  -- Insert into the target production table.
  --
  -- Naive approach `INSERT INTO target SELECT * FROM jsonb_populate_record(...)`
  -- is WRONG because INSERT supplies every column explicitly (including
  -- explicit NULLs for keys not in the payload), which bypasses column
  -- DEFAULT expressions like `id UUID DEFAULT gen_random_uuid()` and
  -- `created_at TIMESTAMPTZ DEFAULT now()`. Defaults only fire when a column
  -- is OMITTED from the INSERT column list.
  --
  -- Correct approach: build an explicit column list from the intersection of
  --   (a) the target table's columns (information_schema.columns)
  --   (b) the payload's top-level keys (jsonb_object_keys)
  -- excluding TWO classes of columns:
  --   - system-defaulted     (id, created_at, updated_at)
  --   - provenance/QA/audit  (qa_status, created_by, extracted_by,
  --                           triaged_by, reviewed_by, reviewed_at,
  --                           audit_history)
  --   Excluding the second class blocks an agent-authored payload from
  --   escalating a row's HITL / QA / workflow state at promote time. These
  --   columns rely on their table-level DEFAULTs (e.g. qa_status DEFAULT
  --   'needs_review'), server-owned writes from other code paths
  --   (evidence-sync.ts / triage-sync.ts set created_by / extracted_by /
  --   triaged_by from auth.uid() during HITL-driven flows), or remain NULL
  --   for agent-promoted rows. If a target column is NOT NULL with no
  --   DEFAULT and the agent payload omits it, the INSERT fails with a
  --   clear error message naming the column.
  --
  -- The denylist below is the union of workflow / status / provenance
  -- columns across the three target tables today. Adding new target tables
  -- requires reviewing whether they introduce new workflow fields that
  -- belong in the denylist; per-target allowlists are the long-term
  -- preferred shape but require schemas for all targets (Sub-task 2 SQL
  -- output is the prerequisite for moving to allowlists).
  -- ---------------------------------------------------------------------
  SELECT string_agg(quote_ident(c.column_name), ', ' ORDER BY c.column_name)
    INTO v_insert_cols
    FROM information_schema.columns c
   WHERE c.table_schema = 'public'
     AND c.table_name = v_target_table
     AND c.column_name NOT IN (
       -- System-defaulted columns; let DEFAULT fire.
       'id', 'created_at', 'updated_at',
       -- Provenance / authorship columns; never agent-controllable.
       'created_by', 'extracted_by', 'triaged_by',
       'reviewed_by', 'reviewed_at',
       -- HITL / QA / workflow status columns; agent must not pre-set state.
       'qa_status',
       'default_status', 'evidence_support_status', 'extraction_status',
       'triage_status', 'triaged_at',
       -- Reviewer-controlled freeform fields.
       'review_notes', 'triage_note',
       -- Server-managed extraction method (set by HITL flow, not agent).
       'extraction_method',
       -- Server-managed audit history JSONB.
       'audit_history'
     )
     AND c.column_name IN (
       SELECT jsonb_object_keys(v_staging_row.proposed_payload)
     );

  IF v_insert_cols IS NULL OR v_insert_cols = '' THEN
    RAISE EXCEPTION
      'catalog_approve_staging_row: no payload columns match target table % schema for staging row %',
      v_target_table, p_staging_id
      USING ERRCODE = 'P0001';
  END IF;

  EXECUTE format(
    'INSERT INTO public.%I (%s) SELECT %s FROM jsonb_populate_record(NULL::public.%I, $1) RETURNING id',
    v_target_table, v_insert_cols, v_insert_cols, v_target_table
  )
  INTO v_promoted_id
  USING v_staging_row.proposed_payload;

  IF v_promoted_id IS NULL THEN
    RAISE EXCEPTION
      'catalog_approve_staging_row: INSERT into % returned no id for staging row %',
      v_target_table, p_staging_id
      USING ERRCODE = 'P0001';
  END IF;

  -- ---------------------------------------------------------------------
  -- Mark the staging row approved with reviewer fields + promoted_to_id.
  -- The CHECK constraints on catalog_extraction_staging enforce all three
  -- transitions happen together; doing it in one UPDATE keeps the row
  -- consistent. We already locked the row above so no race here.
  -- ---------------------------------------------------------------------
  UPDATE public.catalog_extraction_staging
     SET hitl_status       = 'approved',
         hitl_reviewed_by  = v_caller_uid,
         hitl_reviewed_at  = now(),
         hitl_review_notes = p_hitl_notes,
         promoted_to_id    = v_promoted_id
   WHERE id = p_staging_id;

  RETURN v_promoted_id;
END;
$$;

ALTER FUNCTION public.catalog_approve_staging_row(UUID, TEXT) OWNER TO postgres;

COMMENT ON FUNCTION public.catalog_approve_staging_row(UUID, TEXT) IS
  'Transactional approve flow for catalog_extraction_staging. Locks the staging row (FOR UPDATE), validates pending status, INSERTs into the target production table (resolved from proposed_kind), and UPDATEs the staging row with reviewer fields + promoted_to_id, all in one transaction. Eliminates the SELECT-then-UPDATE race that allowed two concurrent approvals to each insert orphan production rows. Authored 2026-05-27 by Stream D autonomous session.';

REVOKE EXECUTE ON FUNCTION public.catalog_approve_staging_row(UUID, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.catalog_approve_staging_row(UUID, TEXT) TO authenticated;
-- =============================================================================
-- catalog_approve_staging_rows_bulk RPC: bulk HITL approval for staging rows
-- =============================================================================
--
-- Author:   Matrix-Options session, 2026-05-30.
-- Reason:   The single-row catalog_approve_staging_row RPC requires an
--           authenticated admin and runs all-or-nothing per call. Approving a
--           large canonical pass (thousands of pending rows) one row at a time
--           in the UI is infeasible, and a single bulk SELECT over the RPC
--           rolls the whole batch back the first time it hits a row whose
--           target already exists (unique_violation). This function loops
--           server-side, approving every pending row of the requested kind,
--           SKIPPING rows that would duplicate an already-promoted row, and
--           returns counts. One authenticated round-trip from the admin UI.
--
-- Depends on: 20260527000005_catalog_approve_staging_rpc.sql (the single-row
--             RPC this function calls per row) and 20260527000004
--             (the catalog_extraction_staging table). Paste AFTER both.
--
-- Security:  SECURITY DEFINER, search_path locked to public, pg_temp. Performs
--            its own admin gating against public.user_roles (admin or
--            matrix_admin) BEFORE the loop. The inner single-row RPC re-checks
--            the same gate per row (defence in depth). EXECUTE granted to
--            authenticated; anon/PUBLIC denied. auth.uid() resolves from the
--            caller's authenticated session, so the inner RPC stamps
--            hitl_reviewed_by with the real reviewer.
--
-- Behaviour per row (in a subtransaction so one bad row never aborts the rest):
--   - success                -> approved += 1
--   - unique_violation       -> the target was already promoted in a prior pass;
--                               mark this staging row 'superseded' (drains it from
--                               the pending queue so it is not retried forever) and
--                               skipped_duplicates += 1
--   - any other exception    -> RAISE WARNING with the row id + SQLSTATE/SQLERRM for
--                               diagnostics, then failed += 1 (row left pending)
--
-- Pre-flight exploratory SQL (run BEFORE applying):
--
--   SELECT proname FROM pg_proc WHERE proname = 'catalog_approve_staging_rows_bulk';
--   -- Expected: 0 rows.
--
-- =============================================================================

CREATE OR REPLACE FUNCTION public.catalog_approve_staging_rows_bulk(
  p_kind       TEXT DEFAULT NULL,
  p_hitl_notes TEXT DEFAULT NULL
)
RETURNS TABLE (approved INT, skipped_duplicates INT, failed INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_uid UUID;
  r            RECORD;
  v_ok         INT := 0;
  v_dupe       INT := 0;
  v_fail       INT := 0;
BEGIN
  -- ---------------------------------------------------------------------
  -- Admin gating (mirrors catalog_approve_staging_row).
  -- ---------------------------------------------------------------------
  v_caller_uid := auth.uid();
  IF v_caller_uid IS NULL THEN
    RAISE EXCEPTION 'catalog_approve_staging_rows_bulk: no authenticated user'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = v_caller_uid
       AND role IN ('admin', 'matrix_admin')
  ) THEN
    RAISE EXCEPTION 'catalog_approve_staging_rows_bulk: user lacks admin or matrix_admin role'
      USING ERRCODE = '42501';
  END IF;

  IF p_kind IS NOT NULL
     AND p_kind NOT IN ('parameter_value', 'evidence_item', 'source_lead') THEN
    RAISE EXCEPTION 'catalog_approve_staging_rows_bulk: invalid kind %', p_kind
      USING ERRCODE = '22023';
  END IF;

  -- ---------------------------------------------------------------------
  -- Loop over pending rows (optionally filtered by kind). Each approve runs
  -- in its own subtransaction (BEGIN ... EXCEPTION) so a duplicate or a bad
  -- row does not roll back the whole batch.
  -- ---------------------------------------------------------------------
  FOR r IN
    SELECT id
      FROM public.catalog_extraction_staging
     WHERE hitl_status = 'pending'
       AND (p_kind IS NULL OR proposed_kind = p_kind)
     ORDER BY extracted_at
  LOOP
    BEGIN
      PERFORM public.catalog_approve_staging_row(r.id, p_hitl_notes);
      v_ok := v_ok + 1;
    EXCEPTION
      WHEN unique_violation THEN
        -- Target row already promoted in a prior pass. Mark this staging row
        -- 'superseded' so it drains from the pending queue instead of being
        -- retried on every future bulk run. 'superseded' allows null reviewer
        -- fields and requires promoted_to_id IS NULL (per the staging table
        -- CHECK constraints), so this UPDATE is constraint-safe.
        UPDATE public.catalog_extraction_staging
           SET hitl_status       = 'superseded',
               hitl_reviewed_by  = v_caller_uid,
               hitl_reviewed_at  = now(),
               hitl_review_notes = COALESCE(p_hitl_notes || ' ', '')
                 || '[bulk: target already promoted; superseded]'
         WHERE id = r.id;
        v_dupe := v_dupe + 1;
      WHEN OTHERS THEN
        -- Surface systemic failures (schema/data bugs) instead of silently
        -- counting them: a non-zero failed count alone is too opaque.
        RAISE WARNING 'catalog_approve_staging_rows_bulk: staging row % failed (%): %',
          r.id, SQLSTATE, SQLERRM;
        v_fail := v_fail + 1;
    END;
  END LOOP;

  approved           := v_ok;
  skipped_duplicates := v_dupe;
  failed             := v_fail;
  RETURN NEXT;
END;
$$;

ALTER FUNCTION public.catalog_approve_staging_rows_bulk(TEXT, TEXT) OWNER TO postgres;

COMMENT ON FUNCTION public.catalog_approve_staging_rows_bulk(TEXT, TEXT) IS
  'Bulk HITL approval for catalog_extraction_staging. Admin-gated; loops over pending rows (optionally one proposed_kind) and calls catalog_approve_staging_row per row in a subtransaction. unique_violation duplicates (target already promoted) are marked superseded so they drain from the queue; other failures are logged via RAISE WARNING. Returns (approved, skipped_duplicates, failed). Authored 2026-05-30.';

REVOKE EXECUTE ON FUNCTION public.catalog_approve_staging_rows_bulk(TEXT, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.catalog_approve_staging_rows_bulk(TEXT, TEXT) TO authenticated;
-- =============================================================================
-- catalog_approve_staging_rows_bulk RPC: concurrency / robustness hardening (#201)
-- =============================================================================
--
-- Author:   #201 RPC hardening session, 2026-06-02.
-- Supersedes the function body defined in
--   20260530000001_catalog_approve_staging_rows_bulk.sql
-- via CREATE OR REPLACE. That earlier migration is PROTECTED / append-only and
-- is NOT edited; this new migration replaces the function in place. The
-- signature, return shape (approved, skipped_duplicates, failed), OWNER, and
-- grants are all preserved -- the app (src/lib/catalog/staging.ts) and UI
-- (CatalogStagingReview.tsx) read those three counts by name, unchanged.
--
-- Background (review #201): the bulk RPC's outer pending-row SELECT does NOT
-- take FOR UPDATE. Analysis
--   docs/CATALOG_BULK_APPROVE_RPC_LOCKING_ANALYSIS_2026_06_02.md
-- established this is NOT a data-integrity bug: the inner single-row RPC
-- catalog_approve_staging_row already does SELECT ... FOR UPDATE per row
-- (20260527000005_...sql:73-76), which closes the only double-promotion /
-- orphan-row race. This migration adds three OPTIONAL hardening guards that make
-- the design's "single admin, sequential" assumption self-enforcing and remove a
-- latent foot-gun, without changing behaviour for the documented use:
--
--   Guard 1 (advisory lock): pg_try_advisory_xact_lock fast-fail so a SECOND
--     concurrent bulk run cleanly errors (55P03) instead of silently racing the
--     first and producing wasted work + misleading 'failed' counts. The lock is
--     transaction-scoped (auto-released at function-transaction end) and is taken
--     ONLY by this bulk RPC -- single-row UI approvals are unaffected.
--
--   Guard 2 (constraint-name check): the unique_violation handler now confirms
--     the violated constraint is one of the two intended business-key uniques
--     before marking a staging row 'superseded'. Any OTHER unique violation
--     (e.g. a future second unique index on a target table) is surfaced via
--     RAISE WARNING and counted 'failed' rather than being silently mislabeled
--     'superseded'. The supersede UPDATE is also status-conditional
--     (AND hitl_status = 'pending') so it can never clobber a concurrent
--     single-row HITL decision (the inner FOR UPDATE lock is already released by
--     the time this outer handler runs).
--
--   Guard 3 (count honesty): the inner RPC's "is X, cannot approve" status-guard
--     P0001 (raised when a row another pass/caller already finalized is re-seen)
--     is counted as a skip rather than inflating 'failed' + emitting a WARNING.
--     The other three P0001 sites in the inner RPC remain real failures.
--
-- Depends on: 20260527000005 (inner single-row RPC), 20260527000004 (staging
--             table + CHECK constraints), 20260527000003 / 20260527000008 (the
--             two target tables whose UNIQUE constraints drive unique_violation).
--             Apply AFTER all of those and AFTER 20260530000001.
--
-- Supabase MCP fails 100% -- the owner pastes this file into the Studio SQL
-- Editor. Pre-flight exploratory SQL (run BEFORE applying):
--
--   -- The function already exists; CREATE OR REPLACE is the expected verb here.
--   SELECT proname, pg_get_function_identity_arguments(oid) AS args
--     FROM pg_proc
--    WHERE proname = 'catalog_approve_staging_rows_bulk';
--   -- Expected: 1 row, args = 'p_kind text, p_hitl_notes text'.
--
--   -- Capture the current definition so the change is auditable / reversible:
--   SELECT pg_get_functiondef(
--     'public.catalog_approve_staging_rows_bulk(text, text)'::regprocedure);
--
--   -- Confirm the two business-key constraint names Guard 2 hard-codes still
--   -- exist (they are the Postgres auto-names for the inline UNIQUE columns):
--   SELECT conrelid::regclass AS tbl, conname
--     FROM pg_constraint
--    WHERE conname IN ('promoted_parameter_values_parameter_value_id_key',
--                      'source_lead_triage_lead_set_id_key');
--   -- Expected: 2 rows.
--
-- =============================================================================

CREATE OR REPLACE FUNCTION public.catalog_approve_staging_rows_bulk(
  p_kind       TEXT DEFAULT NULL,
  p_hitl_notes TEXT DEFAULT NULL
)
RETURNS TABLE (approved INT, skipped_duplicates INT, failed INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_uid UUID;
  r            RECORD;
  v_ok         INT  := 0;
  v_dupe       INT  := 0;
  v_fail       INT  := 0;
  v_constraint TEXT;
BEGIN
  -- ---------------------------------------------------------------------
  -- Admin gating (mirrors catalog_approve_staging_row).
  -- ---------------------------------------------------------------------
  v_caller_uid := auth.uid();
  IF v_caller_uid IS NULL THEN
    RAISE EXCEPTION 'catalog_approve_staging_rows_bulk: no authenticated user'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = v_caller_uid
       AND role IN ('admin', 'matrix_admin')
  ) THEN
    RAISE EXCEPTION 'catalog_approve_staging_rows_bulk: user lacks admin or matrix_admin role'
      USING ERRCODE = '42501';
  END IF;

  IF p_kind IS NOT NULL
     AND p_kind NOT IN ('parameter_value', 'evidence_item', 'source_lead') THEN
    RAISE EXCEPTION 'catalog_approve_staging_rows_bulk: invalid kind %', p_kind
      USING ERRCODE = '22023';
  END IF;

  -- ---------------------------------------------------------------------
  -- Guard 1: single-admin self-enforcement (transaction-scoped advisory lock).
  --
  -- The documented usage is one admin, sequential. A second concurrent bulk
  -- run would not corrupt data (the inner RPC's FOR UPDATE + status guard
  -- prevent double-promotion) but WOULD waste work and report misleading
  -- 'failed' counts for rows the other run already handled. Fast-fail here so
  -- the second caller gets a clean, actionable error instead of silently
  -- racing. pg_try_advisory_xact_lock takes the single-arg bigint overload;
  -- the key is a stable hash of the function name (collision would only cause
  -- harmless false serialization, never data loss). The lock auto-releases when
  -- this function's transaction ends. Only this bulk RPC takes the lock, so
  -- single-row UI approvals (catalog_approve_staging_row) are never blocked.
  -- ---------------------------------------------------------------------
  IF NOT pg_try_advisory_xact_lock(hashtext('catalog_approve_staging_rows_bulk')::BIGINT) THEN
    RAISE EXCEPTION 'catalog_approve_staging_rows_bulk: another bulk approval is already running'
      USING ERRCODE = '55P03';  -- lock_not_available
  END IF;

  -- ---------------------------------------------------------------------
  -- Loop over pending rows (optionally filtered by kind). Each approve runs
  -- in its own subtransaction (BEGIN ... EXCEPTION) so a duplicate or a bad
  -- row does not roll back the whole batch. The outer SELECT intentionally
  -- does NOT take FOR UPDATE (per #201 analysis Option A): the inner RPC's
  -- per-row FOR UPDATE is the integrity-critical lock.
  -- ---------------------------------------------------------------------
  FOR r IN
    SELECT id
      FROM public.catalog_extraction_staging
     WHERE hitl_status = 'pending'
       AND (p_kind IS NULL OR proposed_kind = p_kind)
     ORDER BY extracted_at
  LOOP
    BEGIN
      PERFORM public.catalog_approve_staging_row(r.id, p_hitl_notes);
      v_ok := v_ok + 1;
    EXCEPTION
      WHEN unique_violation THEN
        -- Guard 2: confirm WHICH unique constraint was violated before treating
        -- this as "target already promoted". CONSTRAINT_NAME carries through the
        -- nested PERFORM + the inner RPC's dynamic EXECUTE INSERT intact.
        GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
        IF v_constraint IN (
             'promoted_parameter_values_parameter_value_id_key',
             'source_lead_triage_lead_set_id_key'
           ) THEN
          -- Intended case: the target business key already exists (promoted in a
          -- prior pass). Mark this staging row 'superseded' so it drains from the
          -- pending queue. 'superseded' allows null reviewer fields and requires
          -- promoted_to_id IS NULL (per the catalog_extraction_staging CHECK
          -- constraints), so this UPDATE is constraint-safe.
          --
          -- Status-conditional: the inner FOR UPDATE lock was released when the
          -- per-row subtransaction rolled back on the violation, so a concurrent
          -- single-row action (e.g. an admin rejecting this row) could have
          -- changed it in the gap. Only overwrite if still pending -- never
          -- clobber a concurrent HITL decision. The duplicate is still counted
          -- regardless (it genuinely occurred for this run).
          UPDATE public.catalog_extraction_staging
             SET hitl_status       = 'superseded',
                 hitl_reviewed_by  = v_caller_uid,
                 hitl_reviewed_at  = now(),
                 hitl_review_notes = COALESCE(p_hitl_notes || ' ', '')
                   || '[bulk: target already promoted; superseded]'
           WHERE id = r.id
             AND hitl_status = 'pending';
          v_dupe := v_dupe + 1;
        ELSE
          -- Unexpected unique constraint (e.g. a future second unique index on a
          -- target table). Do NOT silently mislabel it 'superseded'; surface it
          -- like any other failure so it is investigated.
          RAISE WARNING 'catalog_approve_staging_rows_bulk: staging row % hit unexpected unique constraint % (%): %',
            r.id, COALESCE(v_constraint, '<none>'), SQLSTATE, SQLERRM;
          v_fail := v_fail + 1;
        END IF;
      WHEN OTHERS THEN
        -- Guard 3: distinguish the inner RPC's "is X, cannot approve" status
        -- guard (20260527000005_...sql:83-88) -- raised when a row another pass
        -- or a concurrent single-row approve already finalized is re-seen -- from
        -- genuine failures. That message is the ONLY inner P0001 ending in
        -- ", cannot approve"; the other three P0001 sites (unknown
        -- proposed_kind, no matching payload columns, INSERT returned no id) end
        -- with the staging id and remain failures. Matching on message text is a
        -- pragmatic coupling to the inner RPC (the return shape is fixed at three
        -- columns, so a "not pending" row folds into skipped_duplicates); the
        -- future-proof alternative is a dedicated SQLSTATE on the inner guard.
        IF SQLSTATE = 'P0001' AND SQLERRM LIKE '%, cannot approve' THEN
          v_dupe := v_dupe + 1;
        ELSE
          -- Surface systemic failures (schema/data bugs) instead of silently
          -- counting them: a non-zero failed count alone is too opaque.
          RAISE WARNING 'catalog_approve_staging_rows_bulk: staging row % failed (%): %',
            r.id, SQLSTATE, SQLERRM;
          v_fail := v_fail + 1;
        END IF;
    END;
  END LOOP;

  approved           := v_ok;
  skipped_duplicates := v_dupe;
  failed             := v_fail;
  RETURN NEXT;
END;
$$;

ALTER FUNCTION public.catalog_approve_staging_rows_bulk(TEXT, TEXT) OWNER TO postgres;

COMMENT ON FUNCTION public.catalog_approve_staging_rows_bulk(TEXT, TEXT) IS
  'Bulk HITL approval for catalog_extraction_staging. Admin-gated; loops over pending rows (optionally one proposed_kind) and calls catalog_approve_staging_row per row in a subtransaction. Hardened 2026-06-02 (#201): a transaction-scoped advisory lock fast-fails a second concurrent bulk run (55P03); the unique_violation handler confirms the violated constraint is an intended business key before marking the row superseded (status-conditional, never clobbers a concurrent HITL decision) and routes any other unique violation to failed; the inner "cannot approve" status-guard is counted as a skip rather than a failure. Returns (approved, skipped_duplicates, failed). Original body 2026-05-30.';

REVOKE EXECUTE ON FUNCTION public.catalog_approve_staging_rows_bulk(TEXT, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.catalog_approve_staging_rows_bulk(TEXT, TEXT) TO authenticated;
