-- =============================================================================
-- catalog_sources: per-reference retrieval status + retrieval/source/QA dates
-- =============================================================================
--
-- Adds four NULLABLE columns to public.catalog_sources so each HITL source record
-- can carry a full/partial/none retrieval status plus three distinct dates
-- (retrieval, source, QA). Supports the Matrix Options Evidence Library references
-- inventory (Lane 2 P2-4). Schema + UI scaffold only; the actual date VALUES are
-- owner-supplied later (these columns ship empty / NULL). AI never populates them
-- (CLAUDE.md: reference catalogs are read-only for AI sessions).
--
-- Naming reconciliation with the JSON SourceRecord vocabulary
-- (src/lib/matrix-options/provenance/types.ts):
--   - retrieval_date is INTENTIONALLY distinct from the JSON `checked_at`
--       (checked_at = "last verified the source still exists / is current";
--        retrieval_date = "date the content was actually retrieved/extracted").
--   - source_date corresponds to the JSON `source_crystallization_date`
--       (the as-of date the source content was fixed/published).
--   - qa_date and retrieval_status (full|partial|none) are new; no JSON equivalent.
--
-- Owner pastes this into Supabase Studio (MCP apply_migration is dead). Depends on
-- 20260527000006_catalog_sources.sql. Idempotent: IF NOT EXISTS on every column +
-- a guarded CHECK so re-pasting is safe.
--
-- Pre-flight exploratory SQL (run BEFORE applying):
--
--   SELECT to_regclass('public.catalog_sources') AS table_exists;
--   -- Expected: 'catalog_sources'. If NULL, apply 20260527000006 first.
--
--   SELECT column_name FROM information_schema.columns
--    WHERE table_schema = 'public' AND table_name = 'catalog_sources'
--      AND column_name IN ('retrieval_status','retrieval_date','source_date','qa_date');
--   -- Expected: 0 rows (none added yet). If present, this migration already ran.
--
-- =============================================================================

ALTER TABLE public.catalog_sources
  ADD COLUMN IF NOT EXISTS retrieval_status TEXT,
  ADD COLUMN IF NOT EXISTS retrieval_date   DATE,
  ADD COLUMN IF NOT EXISTS source_date      DATE,
  ADD COLUMN IF NOT EXISTS qa_date          DATE;

-- CHECK on retrieval_status: full | partial | none (NULL allowed = "not recorded").
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'catalog_sources_retrieval_status_check'
       AND conrelid = 'public.catalog_sources'::regclass
  ) THEN
    ALTER TABLE public.catalog_sources
      ADD CONSTRAINT catalog_sources_retrieval_status_check
      CHECK (retrieval_status IS NULL
             OR retrieval_status IN ('full', 'partial', 'none'));
  END IF;
END
$$;

COMMENT ON COLUMN public.catalog_sources.retrieval_status IS
  'Per-reference retrieval completeness: full | partial | none. NULL = not recorded. Owner-curated; AI never sets this (read-only catalog data).';
COMMENT ON COLUMN public.catalog_sources.retrieval_date IS
  'Date the source content was actually retrieved/extracted. Distinct from the JSON SourceRecord.checked_at ("last verified current"). NULL = not recorded.';
COMMENT ON COLUMN public.catalog_sources.source_date IS
  'As-of date the source content was fixed/published (JSON SourceRecord.source_crystallization_date). NULL = not recorded.';
COMMENT ON COLUMN public.catalog_sources.qa_date IS
  'Date this source record passed HITL QA review. NULL = not yet QA-reviewed / not recorded.';
