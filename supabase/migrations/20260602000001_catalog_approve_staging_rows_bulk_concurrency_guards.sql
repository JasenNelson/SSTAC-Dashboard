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
