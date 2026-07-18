-- ============================================================================
-- BATCH 5: Catalog runtime tables (Evidence Library). Creates the catalog-runtime
--   tables the Evidence Library review/admin WRITE paths need:
--   promoted_parameter_values, catalog_extraction_staging, catalog_sources,
--   catalog_evidence_items, source_lead_triage. Reads degrade gracefully (a
--   missing table shows empty, not a 500); only the WRITE paths fail until created.
-- !!! NOT FULLY IDEMPOTENT -- READ THIS BEFORE PASTING !!!
--   These five repo migrations use PLAIN `CREATE TABLE public.<name> (` (NOT
--   IF NOT EXISTS). Re-applying one where the table ALREADY exists ERRORs
--   "relation already exists" and aborts the paste. APPLY ONLY THE SUBSET that
--   STEP 0 probe 1m reports present=false -- this file concatenates all five for
--   convenience, but you must delete the CREATE blocks for tables 1m says already
--   exist, OR run only the per-file sections you need. (The original repo
--   migrations are append-only history; this runbook does not edit them, and we
--   do NOT rewrite their CREATE to IF NOT EXISTS because that would diverge from
--   the committed migration the project's migration ledger tracks.)
--   parameter_value_reviews: 1m also probes it, but it has NO migration file on
--   origin/main -- DEFER (explore-before-assume); do not invent a CREATE here.
-- Needed-if: STEP 0 probe 1m shows a given table present=false (apply only that subset).
-- Source (concatenated verbatim, in order):
--   supabase/migrations/20260527000003_promoted_parameter_values.sql
--   supabase/migrations/20260527000004_catalog_extraction_staging.sql
--   supabase/migrations/20260527000006_catalog_sources.sql
--   supabase/migrations/20260527000007_catalog_evidence_items.sql
--   supabase/migrations/20260527000008_source_lead_triage.sql
-- ============================================================================

-- Promoted parameter values: persists source-lead promotions from the
-- Evidence Library. Apply when ready to migrate from localStorage to
-- Supabase persistence.
--
-- Pre-flight exploratory SQL (run BEFORE applying):
--
--   SELECT table_name FROM information_schema.tables
--     WHERE table_schema = 'public'
--     AND table_name = 'promoted_parameter_values';
--   -- Expected: 0 rows
--
--   SELECT COUNT(*) FROM public.user_roles WHERE role = 'admin';
--   -- Expected: >= 1 (admin users exist for RLS)

CREATE TABLE public.promoted_parameter_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parameter_value_id TEXT UNIQUE NOT NULL,
  substance_key TEXT NOT NULL DEFAULT '',
  pathway TEXT NOT NULL DEFAULT 'eco-direct-eqp',
  input_key TEXT NOT NULL DEFAULT '',
  display_name TEXT NOT NULL,
  value TEXT NOT NULL DEFAULT '',
  unit TEXT NOT NULL DEFAULT '',
  value_type TEXT NOT NULL DEFAULT 'single_value',
  candidate_group_id TEXT NOT NULL,
  default_status TEXT NOT NULL DEFAULT 'available_option',
  evidence_support_status TEXT NOT NULL DEFAULT 'pending_source_locator',
  extraction_status TEXT NOT NULL DEFAULT 'pending_extraction',
  qa_status TEXT NOT NULL DEFAULT 'needs_review',
  source_ids TEXT[] NOT NULL DEFAULT '{}',
  equation_ids TEXT[] NOT NULL DEFAULT '{}',
  jurisdiction TEXT NOT NULL DEFAULT '',
  applicability TEXT NOT NULL DEFAULT '',
  uncertainty TEXT,
  review_notes TEXT NOT NULL DEFAULT '',
  audit_history JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.promoted_parameter_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage promoted values"
  ON public.promoted_parameter_values
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'matrix_admin')
    )
  );

CREATE POLICY "Authenticated users can read promoted values"
  ON public.promoted_parameter_values
  FOR SELECT
  USING (auth.role() = 'authenticated');

REVOKE ALL ON public.promoted_parameter_values FROM anon;
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
-- =============================================================================
-- catalog_sources: HITL-added catalog source records
-- =============================================================================
--
-- Purpose: persists HITL-added source records (citations, regulatory authorities,
-- Zotero linkages) used by the Evidence Library + Stream D Catalog Extraction
-- Agent. Referenced by `catalog_evidence_items.source_id` (TEXT slug) and by
-- the `source_ids TEXT[]` column on `promoted_parameter_values`. The latter
-- cross-references are convention-only (no DB-level FK) to match the existing
-- `promoted_parameter_values.source_ids` pattern; this is intentional.
--
-- Schema source-of-truth: `src/lib/matrix-options/provenance/source-sync.ts`
-- (CatalogSourceRow interface + submitSource payload). Column types and
-- defaults mirror what the TS code already inserts.
--
-- Author:   Stream D autonomous session (Opus 4.7), 2026-05-28.
-- Branch:   feat/stream-d-catalog-agent-scaffold.
-- Reason:   Stream D Sub-task 2 exploratory SQL confirmed this table does NOT
--           exist in Supabase, even though src/lib/matrix-options/provenance/
--           source-sync.ts has been targeting it. Calls silently no-op via
--           the safe-fallback pattern; the Evidence Library's "Add Source"
--           feature is effectively dead until this migration applies.
--
-- HITL gate: owner pastes this migration into Supabase Studio SQL Editor.
--            Does NOT depend on the Stream D staging table (20260527000004) or
--            RPC (20260527000005). Apply order is flexible relative to those.
--
-- RLS: matches the existing two-policy pattern on `parameter_value_reviews`
-- and `promoted_parameter_values`:
--   - admin / matrix_admin: manage (FOR ALL)
--   - authenticated:        read (FOR SELECT)
-- This is a catalog-grade surface (curated source records), so the broader
-- authenticated-read is appropriate; if owner wants admin-only read for
-- this surface (similar to Stream D's catalog_extraction_staging staging
-- queue), drop the authenticated-read policy below before applying.
--
-- Pre-flight exploratory SQL (run BEFORE applying):
--
--   SELECT to_regclass('public.catalog_sources') AS exists_already;
--   -- Expected: NULL.
--
--   SELECT COUNT(*) FROM public.user_roles WHERE role IN ('admin', 'matrix_admin');
--   -- Expected: >= 1 (the admin RLS gate needs at least one admin user).
--
-- =============================================================================

CREATE TABLE public.catalog_sources (
  -- Surrogate primary key.
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Stable slug identifier (e.g., 'src-hitl-acfn-wqciu-1716822000000'). Unique;
  -- the application generates this from short_citation + timestamp, or accepts
  -- a manually-slugified value. Used as the cross-table reference key by
  -- `catalog_evidence_items.source_id` (convention; no DB FK to match the
  -- existing `promoted_parameter_values.source_ids` pattern).
  source_id TEXT UNIQUE NOT NULL,

  -- Bibliographic core
  short_citation TEXT NOT NULL,
  title          TEXT NOT NULL,
  year           INTEGER,
  publisher      TEXT NOT NULL DEFAULT '',
  doi            TEXT,
  url            TEXT,

  -- Zotero linkage (nullable; sources may be added without a Zotero anchor).
  zotero_key         TEXT,
  zotero_item_type   TEXT,
  zotero_parent_key  TEXT,

  -- Authority + curation metadata. TS code passes specific enum values
  -- (see SubmitSourceRequest comments in source-sync.ts) but the existing
  -- catalog tables use TEXT without CHECK enforcement; matching that pattern
  -- here for consistency. Application layer remains authoritative on values.
  authority_scope         TEXT NOT NULL DEFAULT '',
  authority_tier          TEXT NOT NULL DEFAULT '',
  currentness_status      TEXT NOT NULL DEFAULT 'unknown',
  bc_protocol_alignment   TEXT NOT NULL DEFAULT 'none',
  canonical_source_status TEXT NOT NULL DEFAULT '',
  role                    TEXT NOT NULL DEFAULT '',

  -- Provenance
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.catalog_sources IS
  'HITL-added source records (citations, regulatory authorities, Zotero linkages). Referenced by source_id (TEXT slug) from catalog_evidence_items and from promoted_parameter_values.source_ids[]. Cross-references are convention-only; no DB FK on those references to match the existing array-of-strings pattern.';

COMMENT ON COLUMN public.catalog_sources.source_id IS
  'Stable slug identifier. Generated by submitSource() as src-hitl-<slug>-<timestamp> or accepted as a manually-slugified value. UNIQUE; referenced cross-table by catalog_evidence_items.source_id and promoted_parameter_values.source_ids[].';

COMMENT ON COLUMN public.catalog_sources.authority_scope IS
  'Geographic / jurisdictional scope: BC | Canada_federal | US_federal | general. Application layer enforces values.';

COMMENT ON COLUMN public.catalog_sources.authority_tier IS
  'Authority weighting tier: tier_1_government_or_regulatory | tier_2_peer_reviewed_literature | tier_3_supporting_science | implementation_scaffold.';

COMMENT ON COLUMN public.catalog_sources.canonical_source_status IS
  'Canonical-source state: direct_source_verified | needs_direct_source_check | needs_exact_source_locator | not_applicable.';

COMMENT ON COLUMN public.catalog_sources.role IS
  'Source role: canonical_candidate | reference_mining | policy_compilation | implementation_scaffold.';

-- Indexes
-- Query path: Zotero lookups during agent runs ("do we already have a source
-- for this Zotero key?"). Standalone since fetchHitlSources sorts by created_at
-- but doesn't filter on zotero_key today.
CREATE INDEX catalog_sources_zotero_key_idx
  ON public.catalog_sources (zotero_key)
  WHERE zotero_key IS NOT NULL;
COMMENT ON INDEX public.catalog_sources_zotero_key_idx IS
  'Supports Zotero-key dedup lookups during Catalog Extraction Agent runs and during HITL Add Source form submissions. Partial: zotero_key is NULL for sources added without a Zotero anchor.';

-- Row-level security
ALTER TABLE public.catalog_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage catalog sources"
  ON public.catalog_sources
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
       WHERE user_id = auth.uid()
         AND role IN ('admin', 'matrix_admin')
    )
  );

CREATE POLICY "Authenticated users can read catalog sources"
  ON public.catalog_sources
  FOR SELECT
  USING (auth.role() = 'authenticated');

REVOKE ALL ON public.catalog_sources FROM anon;
-- =============================================================================
-- catalog_evidence_items: HITL-added evidence locators on parameter values
-- =============================================================================
--
-- Purpose: persists HITL-added evidence locators (which source + which table /
-- figure / page supports a specific parameter value). Read by the Evidence
-- Library detail panel; written by the source-locator entry form and (post-
-- approval) by the Stream D Catalog Extraction Agent via the
-- catalog_approve_staging_row RPC.
--
-- Schema source-of-truth: `src/lib/matrix-options/provenance/evidence-sync.ts`
-- (CatalogEvidenceItem interface + submitEvidenceItem payload).
--
-- Author:   Stream D autonomous session (Opus 4.7), 2026-05-28.
-- Branch:   feat/stream-d-catalog-agent-scaffold.
-- Reason:   Stream D Sub-task 2 exploratory SQL confirmed this table does NOT
--           exist in Supabase. evidence-sync.ts has been silently no-op-ing
--           all insert / select / delete calls via safe-fallback.
--
-- HITL gate: owner pastes this migration into Supabase Studio SQL Editor.
--            Apply AFTER 20260527000006_catalog_sources.sql (this migration
--            does NOT enforce a DB-level FK on source_id, but the application
--            layer expects catalog_sources rows to exist for the source_id
--            slugs it inserts here, so apply order matters for HITL workflows).
--
-- Cross-reference convention: catalog_evidence_items.source_id (TEXT slug)
-- refers to catalog_sources.source_id; not a DB FK because the existing
-- pattern on promoted_parameter_values.source_ids[] uses array-of-strings
-- without enforcement. Application layer is authoritative on referential
-- integrity. Same applies to parameter_value_id, which refers to
-- promoted_parameter_values.parameter_value_id without a DB FK.
--
-- RLS: matches the two-policy pattern from parameter_value_reviews +
-- promoted_parameter_values (admin manage + authenticated read).
--
-- Pre-flight exploratory SQL (run BEFORE applying):
--
--   SELECT to_regclass('public.catalog_evidence_items') AS exists_already;
--   -- Expected: NULL.
--
--   SELECT to_regclass('public.catalog_sources') AS sources_table_present;
--   -- Expected: public.catalog_sources (so the convention-only FK target exists).
--
-- =============================================================================

CREATE TABLE public.catalog_evidence_items (
  -- Surrogate primary key.
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Cross-references (TEXT slugs; convention-only, no DB FKs).
  parameter_value_id TEXT NOT NULL,
  source_id          TEXT NOT NULL,

  -- Evidence locator (what to find inside the source PDF / page).
  locator       TEXT NOT NULL,
  locator_type  TEXT NOT NULL,
  value_text    TEXT,

  -- Extraction provenance
  extraction_method TEXT NOT NULL DEFAULT 'hitl_manual',
  extracted_by      UUID REFERENCES auth.users(id),

  -- QA workflow state. TEXT without CHECK to match the existing
  -- promoted_parameter_values pattern (application enforces values).
  qa_status TEXT NOT NULL DEFAULT 'needs_review',

  -- Free-text reviewer note.
  note TEXT NOT NULL DEFAULT '',

  -- Provenance
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.catalog_evidence_items IS
  'HITL-added evidence locators tying a parameter value to a specific page / table / figure within a catalog source. Read by the Evidence Library detail panel; written by the source-locator entry form and post-approval by the Stream D Catalog Extraction Agent.';

COMMENT ON COLUMN public.catalog_evidence_items.parameter_value_id IS
  'Slug-style identifier of the parameter value this evidence supports. References promoted_parameter_values.parameter_value_id (convention-only; no DB FK to match the existing array-of-strings cross-reference pattern).';

COMMENT ON COLUMN public.catalog_evidence_items.source_id IS
  'Slug-style identifier of the catalog source. References catalog_sources.source_id (convention-only; no DB FK).';

COMMENT ON COLUMN public.catalog_evidence_items.locator IS
  'Free-text locator within the source -- e.g. "Table 3, page 12", "Figure 4a", "Section 2.1.3".';

COMMENT ON COLUMN public.catalog_evidence_items.locator_type IS
  'Locator kind: table | figure | section | page | other. Application enforces values.';

COMMENT ON COLUMN public.catalog_evidence_items.extraction_method IS
  'How the row was produced: hitl_manual (today) | agent_extracted (post-Stream D first-real-run). Application enforces values.';

COMMENT ON COLUMN public.catalog_evidence_items.qa_status IS
  'QA workflow state: needs_review (default) | approved | superseded. Mirrors the qa_status values used on promoted_parameter_values + parameter_value_reviews.';

-- Indexes
-- Query path: fetchEvidenceItems(parameterValueId) selects WHERE parameter_value_id = ?
-- ORDER BY created_at DESC. Compound index on (parameter_value_id, created_at DESC)
-- covers both the filter and the sort in one index scan; PostgreSQL can walk the
-- index in reverse for the DESC order without an extra Sort node.
CREATE INDEX catalog_evidence_items_parameter_value_id_created_at_idx
  ON public.catalog_evidence_items (parameter_value_id, created_at DESC);
COMMENT ON INDEX public.catalog_evidence_items_parameter_value_id_created_at_idx IS
  'Supports the Evidence Library detail-panel query path: WHERE parameter_value_id = ? ORDER BY created_at DESC. Compound index avoids a separate Sort node as the table grows.';

-- Optional secondary path: cross-referencing all evidence rows tied to a single source.
CREATE INDEX catalog_evidence_items_source_id_idx
  ON public.catalog_evidence_items (source_id);
COMMENT ON INDEX public.catalog_evidence_items_source_id_idx IS
  'Supports "what evidence items cite this source?" queries during HITL source review.';

-- Row-level security
ALTER TABLE public.catalog_evidence_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage evidence items"
  ON public.catalog_evidence_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
       WHERE user_id = auth.uid()
         AND role IN ('admin', 'matrix_admin')
    )
  );

CREATE POLICY "Authenticated users can read evidence items"
  ON public.catalog_evidence_items
  FOR SELECT
  USING (auth.role() = 'authenticated');

REVOKE ALL ON public.catalog_evidence_items FROM anon;
-- =============================================================================
-- source_lead_triage: HITL triage state for source-lead candidate groups
-- =============================================================================
--
-- Purpose: persists triage verdicts on source-lead candidate groups (the
-- "candidates we have not yet promoted to canonical sources" surface in the
-- Evidence Library). One row per lead_set_id; upserted by admin actions.
--
-- Schema source-of-truth: `src/lib/matrix-options/provenance/triage-sync.ts`
-- (SourceLeadTriageRow interface + setTriageStatus upsert payload).
--
-- Author:   Stream D autonomous session (Opus 4.7), 2026-05-28.
-- Branch:   feat/stream-d-catalog-agent-scaffold.
-- Reason:   Stream D Sub-task 2 exploratory SQL confirmed this table does NOT
--           exist in Supabase. triage-sync.ts has been silently no-op-ing
--           via safe-fallback, so the source-lead triage workflow shipped
--           in commit 9465013 (Phase 5) has never actually persisted state.
--
-- HITL gate: owner pastes this migration into Supabase Studio SQL Editor.
--            Independent of the other Stream D migrations -- apply order is
--            flexible.
--
-- CHECK on triage_status: the TS code explicitly validates against a fixed
-- enum (VALID_TRIAGE_STATUSES in triage-sync.ts) AND coerces unknown values
-- to 'untriaged' on read. Adding the CHECK at the DB level is defense-in-
-- depth -- it costs nothing and prevents invalid values from ever landing.
-- The other Stream D tables (catalog_sources, catalog_evidence_items) and
-- the existing catalog tables (promoted_parameter_values, parameter_value_reviews)
-- do NOT have CHECK constraints on their TEXT enum-ish columns; triage_status
-- is the exception because its validation is the strictest (no other status
-- values are ever legal, today or in any future code path the TS surface
-- exposes).
--
-- RLS: matches the two-policy pattern (admin manage + authenticated read).
--
-- Pre-flight exploratory SQL (run BEFORE applying):
--
--   SELECT to_regclass('public.source_lead_triage') AS exists_already;
--   -- Expected: NULL.
--
--   SELECT COUNT(*) FROM public.user_roles WHERE role IN ('admin', 'matrix_admin');
--   -- Expected: >= 1.
--
-- =============================================================================

CREATE TABLE public.source_lead_triage (
  -- Surrogate primary key.
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Unique identifier of the source-lead candidate group being triaged.
  -- One row per lead_set_id; upserted on action.
  lead_set_id TEXT UNIQUE NOT NULL,

  -- Triage verdict. Application validates against the same enum on both read
  -- (mapper coerces unknowns to 'untriaged') and write (setTriageStatus
  -- rejects invalid status values pre-DB-call). CHECK below enforces it at
  -- the DB level too.
  triage_status TEXT NOT NULL DEFAULT 'untriaged',
  triage_note   TEXT NOT NULL DEFAULT '',

  -- Reviewer
  triaged_by UUID REFERENCES auth.users(id),
  triaged_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Updated_at separate from triaged_at because upserts may re-trigger
  -- on the same triage_status (e.g., admin edits the note without changing
  -- the verdict).
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT source_lead_triage_triage_status_check
    CHECK (triage_status IN ('untriaged', 'promoted', 'dismissed', 'deferred'))
);

COMMENT ON TABLE public.source_lead_triage IS
  'HITL triage state for source-lead candidate groups. One row per lead_set_id, upserted by admin actions. Read by the Evidence Library cross-pathway audit + source-lead triage views.';

COMMENT ON COLUMN public.source_lead_triage.lead_set_id IS
  'Stable identifier of the source-lead candidate group (e.g., "wqciu-reference-leads-2026-05-23"). UNIQUE; the upsert conflict key.';

COMMENT ON COLUMN public.source_lead_triage.triage_status IS
  'HITL verdict: untriaged (default; not yet reviewed) | promoted (advanced to canonical) | dismissed (rejected) | deferred (parked for later review). CHECK constraint enforces the enum at the DB level.';

COMMENT ON COLUMN public.source_lead_triage.triaged_by IS
  'auth.users id of the admin who issued the most recent triage verdict. Nullable for symmetry with the existing catalog tables (system or migration inserts may leave it NULL).';

-- Row-level security
ALTER TABLE public.source_lead_triage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage source lead triage"
  ON public.source_lead_triage
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
       WHERE user_id = auth.uid()
         AND role IN ('admin', 'matrix_admin')
    )
  );

CREATE POLICY "Authenticated users can read source lead triage"
  ON public.source_lead_triage
  FOR SELECT
  USING (auth.role() = 'authenticated');

REVOKE ALL ON public.source_lead_triage FROM anon;
