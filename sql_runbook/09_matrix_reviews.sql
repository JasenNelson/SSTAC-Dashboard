-- ============================================================================
-- BATCH 9: matrix_reviews (Matrix Options "TWG Review" tab write target +
--   /admin/matrix-review read).
-- NOTE: code-derived (no repo DDL). NO CREATE TABLE for matrix_reviews exists in
--   database_schema.sql or supabase/migrations/ -- the security-audit migration
--   20260515_matrix_security_audit.sql:95-116 only ASSUMES it exists. The DDL below
--   is a code-derived reconstruction. LIVE-VERIFY before running: if matrix_reviews
--   already exists on the target with a DIFFERENT shape, do NOT run this -- reconcile
--   by hand. CREATE TABLE IF NOT EXISTS so this is a no-op if your table already exists.
-- Idempotent: safe to run even if already applied (CREATE TABLE IF NOT EXISTS,
--   DO-guarded constraint + policies). Run after BATCH 1 (RLS references user_roles).
-- Needed-if: STEP 0 probe 1j returns matrix_reviews_present = false AND you will demo
--   the Matrix Review surface (else DEFER -- mark out-of-demo-scope).
-- Source: DEMO_BLOCKER_RESOLUTION_KIT_2026_06_04.md Remedy G (verbatim).
-- ============================================================================

-- == Remedy G: matrix_reviews (contract derived from live code; NO DDL source exists in repo). ==
-- Idempotent; safe to run twice. VERIFY against the live project first (see caveat above).
CREATE TABLE IF NOT EXISTS public.matrix_reviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'SUBMITTED')),
    poll_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    comments_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- UNIQUE(user_id): the security-audit migration (20260515:108-116) adds this so re-submits upsert
-- one row per user. The live TWGReviewPortal does a manual lookup-then-update (it notes the
-- constraint "can't be used for onConflict"), so the table works WITHOUT this constraint too; it is
-- included to match the audited live shape. Wrapped so a re-run (or a pre-existing constraint) is a
-- no-op rather than an error.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname  = 'matrix_reviews_user_id_unique'
      AND conrelid = 'public.matrix_reviews'::regclass
  ) THEN
    ALTER TABLE public.matrix_reviews
      ADD CONSTRAINT matrix_reviews_user_id_unique UNIQUE (user_id);
  END IF;
END $$;
ALTER TABLE public.matrix_reviews ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Users can view their own matrix reviews" ON public.matrix_reviews FOR SELECT USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can create their own matrix reviews" ON public.matrix_reviews FOR INSERT WITH CHECK (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can update their own matrix reviews" ON public.matrix_reviews FOR UPDATE USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Admins can view all matrix reviews" ON public.matrix_reviews FOR SELECT USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_matrix_reviews_user_id ON public.matrix_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_matrix_reviews_created_at ON public.matrix_reviews(created_at);
