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
