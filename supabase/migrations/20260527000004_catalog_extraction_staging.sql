-- =============================================================================
-- catalog_extraction_staging: HITL approval queue for AI-proposed catalog rows
-- =============================================================================
--
-- Purpose: stores AI-proposed additions to the catalog (parameter_value rows,
-- evidence_item rows, source_lead rows) from the overnight Catalog Extraction
-- Agent. Every row is gated behind a HITL review (admin or matrix_admin) before
-- being promoted into a production table. The agent NEVER writes directly to
-- production catalog tables.
--
-- Author:   Stream D autonomous session (Opus 4.7), 2026-05-27.
-- Branch:   feat/stream-d-catalog-agent-scaffold @ base 9465013.
-- Plan:     C:\Users\jasen\.claude\plans\lively-stargazing-meadow.md (Stream D, sub-track D.2).
-- Design:   docs/STREAM_D_AUTONOMOUS_AGENT.md (Sub-task 7 deliverable).
-- HITL gate: this migration MUST be applied by the owner via Supabase Studio
--            SQL Editor. The Stream D autonomous session does NOT apply it.
--
-- Conservative defaults: this migration was drafted before the exploratory SQL
-- block in STREAM_D_HITL_PAUSE_SQL_EXPLORE_2026_05_27.md returned. If the OUTPUT
-- section of that pause artifact comes back with a different column type / RLS
-- role-name shape than the existing catalog tables (parameter_value_reviews,
-- catalog_evidence_items, catalog_sources, source_lead_triage), the owner
-- should edit this file before pasting it into SQL Editor.
--
-- Pre-flight exploratory SQL (run BEFORE applying):
--
--   SELECT table_name FROM information_schema.tables
--     WHERE table_schema = 'public'
--       AND table_name = 'catalog_extraction_staging';
--   -- Expected: 0 rows.
--
--   SELECT extname FROM pg_extension WHERE extname = 'pgcrypto';
--   -- Expected: 1 row (gen_random_uuid() requires pgcrypto on Supabase).
--
--   SELECT COUNT(*) FROM public.user_roles WHERE role IN ('admin', 'matrix_admin');
--   -- Expected: >= 1 (RLS gate references these role names).
--
-- =============================================================================

CREATE TABLE public.catalog_extraction_staging (
  -- Surrogate primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source attribution
  source_zotero_key       TEXT        NOT NULL,
  source_attachment_path  TEXT,

  -- Extraction pass grouping (one agent run = one pass)
  extraction_pass_id            UUID        NOT NULL,
  extraction_pass_started_at    TIMESTAMPTZ NOT NULL,
  extraction_pass_finished_at   TIMESTAMPTZ,
  extracted_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Proposal payload
  proposed_kind  TEXT  NOT NULL,
  proposed_payload JSONB NOT NULL,
  confidence     NUMERIC,
  extraction_notes TEXT,
  extraction_model TEXT,

  -- HITL review state
  hitl_status        TEXT NOT NULL DEFAULT 'pending',
  hitl_reviewed_by   UUID REFERENCES auth.users(id),
  hitl_reviewed_at   TIMESTAMPTZ,
  hitl_review_notes  TEXT,

  -- Promotion linkage (FK target depends on proposed_kind; not enforced at DB level)
  promoted_to_id UUID,

  -- Provenance + audit
  -- created_by is nullable because the agent inserts via service_role, which
  -- bypasses RLS but does NOT correspond to an auth.users session. auth.uid()
  -- returns null under service_role, so a NOT NULL + DEFAULT auth.uid() column
  -- would reject agent inserts. The agent records its principal via the
  -- created_by_role discriminator below; HITL-driven UI inserts pass a real
  -- auth.uid() value through the application layer.
  created_by      UUID REFERENCES auth.users(id),
  created_by_role TEXT NOT NULL DEFAULT 'agent_service_role',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Domain enums
  CONSTRAINT catalog_extraction_staging_proposed_kind_check
    CHECK (proposed_kind IN ('parameter_value', 'evidence_item', 'source_lead')),
  CONSTRAINT catalog_extraction_staging_hitl_status_check
    CHECK (hitl_status IN ('pending', 'approved', 'rejected', 'superseded')),
  CONSTRAINT catalog_extraction_staging_created_by_role_check
    CHECK (created_by_role IN ('agent_service_role', 'admin_ui')),
  CONSTRAINT catalog_extraction_staging_confidence_range_check
    CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  CONSTRAINT catalog_extraction_staging_created_by_principal_check
    CHECK (
         (created_by_role = 'agent_service_role')
      OR (created_by_role = 'admin_ui' AND created_by IS NOT NULL)
    ),
  -- Reviewer fields are required for approved/rejected (human verdict);
  -- pending and superseded leave reviewer fields nullable. superseded rows are
  -- bulk-marked by markSupersededStagingRows() when a later extraction pass
  -- supersedes the proposal, which is not a human review event.
  CONSTRAINT catalog_extraction_staging_review_consistency_check
    CHECK (
         (hitl_status = 'pending'    AND hitl_reviewed_by IS NULL AND hitl_reviewed_at IS NULL)
      OR (hitl_status IN ('approved', 'rejected')
            AND hitl_reviewed_by IS NOT NULL AND hitl_reviewed_at IS NOT NULL)
      OR (hitl_status = 'superseded')
    ),
  -- Promotion linkage is set only when a row was approved-and-promoted.
  -- pending / rejected / superseded rows must have promoted_to_id IS NULL.
  CONSTRAINT catalog_extraction_staging_promoted_to_id_consistency_check
    CHECK (
         (hitl_status = 'approved' AND promoted_to_id IS NOT NULL)
      OR (hitl_status <> 'approved' AND promoted_to_id IS NULL)
    )
);

-- Column comments (table self-documentation; per cross_project_supabase_protocol_explore_before_assume.md hygiene)
COMMENT ON TABLE public.catalog_extraction_staging IS
  'HITL approval queue for AI-proposed catalog rows produced by the overnight Catalog Extraction Agent. Every row requires admin or matrix_admin review before promotion to a production catalog table. The agent never writes directly to production tables.';

COMMENT ON COLUMN public.catalog_extraction_staging.id IS
  'Surrogate primary key. UUID via gen_random_uuid().';

COMMENT ON COLUMN public.catalog_extraction_staging.source_zotero_key IS
  'Zotero item key the row was extracted from. Required for cross-pass dedup checks and provenance back-reference.';

COMMENT ON COLUMN public.catalog_extraction_staging.source_attachment_path IS
  'Path to the Zotero PDF attachment that was extracted, if available. Nullable because some Zotero items have no attachment or attachment access is restricted at agent run time.';

COMMENT ON COLUMN public.catalog_extraction_staging.extraction_pass_id IS
  'UUID identifying one agent run; all rows from a single pass share this id. Used by markSupersededStagingRows() to mark prior-pass proposals as superseded.';

COMMENT ON COLUMN public.catalog_extraction_staging.extraction_pass_started_at IS
  'When the agent run that produced this row started.';

COMMENT ON COLUMN public.catalog_extraction_staging.extraction_pass_finished_at IS
  'When the agent run finished. Nullable if the run was terminated by the stall watchdog before completion.';

COMMENT ON COLUMN public.catalog_extraction_staging.extracted_at IS
  'When this specific row was emitted by the agent within the pass. Independent of pass_started/finished.';

COMMENT ON COLUMN public.catalog_extraction_staging.proposed_kind IS
  'What target catalog table this row proposes content for. One of: parameter_value (promoted_parameter_values), evidence_item (catalog_evidence_items), source_lead (source_lead_triage).';

COMMENT ON COLUMN public.catalog_extraction_staging.proposed_payload IS
  'The proposed row contents as a JSON object. Shape varies by proposed_kind; the HITL approval helper validates the shape before promoting.';

COMMENT ON COLUMN public.catalog_extraction_staging.confidence IS
  'Agent self-confidence in [0, 1]. Nullable if the agent did not produce a confidence score. Used to sort the HITL review queue.';

COMMENT ON COLUMN public.catalog_extraction_staging.extraction_notes IS
  'Free-text agent commentary -- e.g. ambiguity flags, page references, parser warnings. Surfaced verbatim in the HITL review UI.';

COMMENT ON COLUMN public.catalog_extraction_staging.extraction_model IS
  'Which Ollama model produced this row (e.g. gemma3:12b). For audit + drift detection across model upgrades.';

COMMENT ON COLUMN public.catalog_extraction_staging.hitl_status IS
  'HITL review verdict. Values: pending (default; in queue), approved (promoted), rejected (declined), superseded (replaced by a later pass).';

COMMENT ON COLUMN public.catalog_extraction_staging.hitl_reviewed_by IS
  'auth.users id of the reviewer who acted on this row. Null while pending.';

COMMENT ON COLUMN public.catalog_extraction_staging.hitl_reviewed_at IS
  'When the reviewer acted. Null while pending.';

COMMENT ON COLUMN public.catalog_extraction_staging.hitl_review_notes IS
  'Free-text reviewer notes -- rationale for approve / reject, supersession reason, etc.';

COMMENT ON COLUMN public.catalog_extraction_staging.promoted_to_id IS
  'When hitl_status = approved, the id of the row inserted into the production catalog table identified by proposed_kind. FK not enforced at DB level because the referenced table differs by proposed_kind; the application layer is responsible for setting this correctly.';

COMMENT ON COLUMN public.catalog_extraction_staging.created_by IS
  'auth.users id of the principal that inserted the row. Null when created_by_role = agent_service_role (service_role inserts bypass RLS but do not correspond to an auth.users session). Required when created_by_role = admin_ui.';

COMMENT ON COLUMN public.catalog_extraction_staging.created_by_role IS
  'Which principal class inserted the row. Values: agent_service_role (the overnight Catalog Extraction Agent), admin_ui (an admin acting through the UI). Lets us audit agent-originated rows separately from admin-originated rows.';

COMMENT ON COLUMN public.catalog_extraction_staging.created_at IS
  'When the row was inserted into the staging table (typically matches extracted_at but recorded independently for audit).';

-- Indexes
-- Partial index on (extraction_pass_id) WHERE hitl_status = 'pending':
-- serves both "list all pending across passes" (full-scan of pending subset)
-- and "list pending in pass X" (B-tree lookup on extraction_pass_id within
-- pending subset). Cheaper than a (hitl_status, extraction_pass_id) compound
-- index for typical pending-queue traffic.
CREATE INDEX catalog_extraction_staging_pending_pass_idx
  ON public.catalog_extraction_staging (extraction_pass_id)
  WHERE hitl_status = 'pending';
COMMENT ON INDEX public.catalog_extraction_staging_pending_pass_idx IS
  'Supports the CatalogStagingReview UI query path: list pending rows, optionally filtered by extraction_pass_id. Partial index on the pending subset.';

CREATE INDEX catalog_extraction_staging_source_zotero_key_idx
  ON public.catalog_extraction_staging (source_zotero_key);
COMMENT ON INDEX public.catalog_extraction_staging_source_zotero_key_idx IS
  'Supports cross-pass dedup checks (do we already have a proposal from this Zotero item?).';
-- (No standalone index on proposed_kind: low cardinality, planner would ignore.
-- Filtering by proposed_kind in queries is best combined with hitl_status,
-- which the partial index above already serves.)

-- Row-level security
-- Stricter than promoted_parameter_values: staging contains UNAPPROVED AI
-- proposals (raw extraction notes, attachment paths, model self-confidence,
-- and parser warnings). Only admin and matrix_admin can read or write. The
-- agent inserts via service_role, which bypasses RLS in Supabase (the table
-- is NOT FORCE-RLS-enabled, so service_role bypass is honored).
ALTER TABLE public.catalog_extraction_staging ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage catalog staging"
  ON public.catalog_extraction_staging
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
       WHERE user_id = auth.uid()
         AND role IN ('admin', 'matrix_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
       WHERE user_id = auth.uid()
         AND role IN ('admin', 'matrix_admin')
    )
  );

REVOKE ALL ON public.catalog_extraction_staging FROM anon;
REVOKE ALL ON public.catalog_extraction_staging FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalog_extraction_staging TO authenticated;
