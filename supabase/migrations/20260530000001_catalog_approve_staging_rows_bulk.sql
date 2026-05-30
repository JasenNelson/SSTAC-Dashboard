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
