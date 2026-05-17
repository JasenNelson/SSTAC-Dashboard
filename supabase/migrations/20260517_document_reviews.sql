-- =====================================================================
-- document_reviews: collaborative-review storage for static documents
-- =====================================================================
--
-- This table backs the per-document collaborative-review UX modelled after
-- the existing matrix_reviews flow (see /matrix-options TWG Review).
-- Unlike matrix_reviews, it carries a `document_id` discriminator so the
-- same schema can host multiple independent review streams (Jermilova
-- BN-RRM methodology, future BN-RRM extracted documents, future TWG-style
-- collaborative reads) without proliferating one-table-per-document.
--
-- First consumer: /bn-rrm/jermilova-review (user-facing review portal) +
-- /admin/jermilova-review (admin pool). document_id is the literal string
-- 'jermilova_bnrrm' for that stream.
--
-- Conventions mirrored from matrix_reviews + 20260515 security audit:
--   - RLS on; users see only own rows, admins see all (is_admin() from
--     the prior security-audit migration).
--   - UNIQUE(user_id, document_id) prevents the matrix_reviews HIGH-1
--     bug (duplicate rows on every Submit click) by construction. The
--     portal code does upsert-with-WHERE-eq (mirrors the matrix_reviews
--     code path), but the constraint is the authoritative guard.
--   - updated_at auto-bumped by trigger; created_at immutable.
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.document_reviews (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_id   text NOT NULL,
  status        text NOT NULL DEFAULT 'IN_PROGRESS'
                  CHECK (status IN ('IN_PROGRESS', 'SUBMITTED')),
  comments_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT document_reviews_user_document_unique
    UNIQUE (user_id, document_id)
);

CREATE INDEX IF NOT EXISTS document_reviews_document_id_idx
  ON public.document_reviews (document_id);

CREATE INDEX IF NOT EXISTS document_reviews_document_status_idx
  ON public.document_reviews (document_id, status);

-- updated_at trigger. The function may already exist from prior migrations;
-- CREATE OR REPLACE is safe.
CREATE OR REPLACE FUNCTION public.set_updated_at_now()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS document_reviews_set_updated_at
  ON public.document_reviews;
CREATE TRIGGER document_reviews_set_updated_at
  BEFORE UPDATE ON public.document_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at_now();

ALTER TABLE public.document_reviews ENABLE ROW LEVEL SECURITY;

-- Drop any prior policies (idempotent re-run safety).
DROP POLICY IF EXISTS "Users can read own document_reviews"
  ON public.document_reviews;
DROP POLICY IF EXISTS "Users can insert own document_reviews"
  ON public.document_reviews;
DROP POLICY IF EXISTS "Users can update own document_reviews"
  ON public.document_reviews;
DROP POLICY IF EXISTS "Admins can read all document_reviews"
  ON public.document_reviews;

-- Users can read only their own review rows.
CREATE POLICY "Users can read own document_reviews"
  ON public.document_reviews
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own row (one per document_id by UNIQUE
-- constraint, but RLS gates user_id).
CREATE POLICY "Users can insert own document_reviews"
  ON public.document_reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own row only. Status flip + comments_data edits
-- are both allowed (save-edit-resubmit semantics: SUBMITTED is not a
-- one-way gate from the user's perspective; the admin pool gets notified
-- on flip but the user can keep editing afterward).
CREATE POLICY "Users can update own document_reviews"
  ON public.document_reviews
  FOR UPDATE
  TO authenticated
  USING       (auth.uid() = user_id)
  WITH CHECK  (auth.uid() = user_id);

-- No DELETE policy: users cannot delete their reviews. (If we ever need
-- a user-facing delete, add it explicitly; for the current admin pool
-- workflow, retention is the default.)

-- Admins (via is_admin() from the 2026-05-15 security-audit migration)
-- can read all rows for the admin-pool page.
CREATE POLICY "Admins can read all document_reviews"
  ON public.document_reviews
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Grants. Supabase API uses the `authenticated` role for signed-in users.
-- Column-level grants prevent users from writing to immutable metadata
-- (id, created_at, updated_at) or rewriting their row's discriminator
-- (document_id) after creation. Codex 2026-05-17 P2 security finding:
-- table-level UPDATE grant + ownership-only RLS would let a user
-- timestamp-rewrite their review or reassign it to a different
-- document_id, polluting the admin pool. The RLS WITH CHECK still
-- enforces auth.uid() = user_id; the column grants make the surface
-- minimum-viable.
GRANT SELECT ON public.document_reviews TO authenticated;
GRANT INSERT (user_id, document_id, status, comments_data)
  ON public.document_reviews TO authenticated;
GRANT UPDATE (status, comments_data)
  ON public.document_reviews TO authenticated;
-- Note: id is auto-generated by gen_random_uuid() default;
-- created_at / updated_at default to now() + trigger; user_id +
-- document_id are required on INSERT but not in the UPDATE grant,
-- so they are effectively write-once.

COMMIT;

-- =====================================================================
-- VERIFICATION (run after apply):
--   SELECT relrowsecurity FROM pg_class WHERE relname='document_reviews';
--     -- expect t (RLS enabled)
--   SELECT policyname FROM pg_policies WHERE tablename='document_reviews';
--     -- expect 4 policies: read own, insert own, update own, admin read all
--   SELECT conname FROM pg_constraint
--    WHERE conrelid='public.document_reviews'::regclass;
--     -- expect document_reviews_user_document_unique + PK + check
-- =====================================================================
