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
