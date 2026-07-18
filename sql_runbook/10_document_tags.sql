-- ============================================================================
-- BATCH 10: document_tags JOIN table (TWG Documents page embed document_tags(tags(...))
--   + documents-edit API tag write).
-- NOTE: code-derived (no repo DDL). NO CREATE TABLE for document_tags exists in
--   database_schema.sql or supabase/migrations/ -- same no-DDL class as matrix_reviews
--   (Batch 9). The DDL below is reconstructed from the live column contract
--   (document_id BIGINT FK -> documents, tag_id BIGINT FK -> tags, composite PK).
--   LIVE-VERIFY before running: if document_tags already exists with a DIFFERENT
--   shape, do NOT run this -- reconcile by hand. CREATE TABLE IF NOT EXISTS so this
--   is a no-op if your table already exists.
-- Idempotent: safe to run even if already applied (CREATE TABLE IF NOT EXISTS,
--   DO-guarded policies). Run after BATCH 1 (FKs reference documents + tags).
-- Needed-if: STEP 0 probe 1l returns document_tags_present = false AND you will demo
--   the TWG Documents tag surface (else DEFER -- mark out-of-demo-scope).
-- Source: DEMO_BLOCKER_RESOLUTION_KIT_2026_06_04.md Remedy H (verbatim).
-- ============================================================================

-- == Remedy H: document_tags JOIN table (contract derived from live code; NO DDL source in repo). ==
-- Idempotent; safe to run twice. VERIFY against the live project first (see caveat above).
CREATE TABLE IF NOT EXISTS public.document_tags (
    document_id BIGINT NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    tag_id BIGINT NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
    PRIMARY KEY (document_id, tag_id)
);
ALTER TABLE public.document_tags ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Anyone can view document tags" ON public.document_tags FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Admins can manage document tags" ON public.document_tags FOR ALL USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_document_tags_tag_id ON public.document_tags(tag_id);
