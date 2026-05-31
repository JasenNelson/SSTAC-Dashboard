-- =============================================================================
-- user_saved_views: per-user Matrix Options Evidence Library saved filter views
-- =============================================================================
--
-- Migrates the former localStorage key 'matrix-options-saved-views-v1' to
-- Supabase so a user's saved References & Values filter views follow them
-- across devices/sessions.
--
-- This is PER-USER UI STATE ONLY. It does NOT touch the default-policy library,
-- QA verdicts, catalog reference data, or any HITL judgment surface. RLS scopes
-- every row to its owner (auth.uid() = user_id); admins get read-only visibility
-- for support, consistent with promoted_parameter_values, but may NOT author or
-- edit another user's personal views.
--
-- Supabase MCP apply_migration is dead per project protocol; the owner pastes
-- this into the Supabase Studio SQL Editor. Self-contained + idempotent-ish.
--
-- Pre-flight exploratory SQL (run BEFORE applying; verify, do not assume):
--
--   SELECT to_regclass('public.user_saved_views') AS table_exists;
--   -- Expected: NULL (table does not exist yet).
--
--   SELECT routine_name FROM information_schema.routines
--    WHERE routine_schema = 'public' AND routine_name = 'update_updated_at_column';
--   -- Expected: 1 row (the shared updated_at trigger fn already exists;
--   --           defined in 20260517_document_reviews.sql).
--
--   SELECT COUNT(*) FROM public.user_roles WHERE role IN ('admin', 'matrix_admin');
--   -- Expected: >= 1 (admin users exist for the admin read policy).
--
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.user_saved_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  view_mode TEXT NOT NULL DEFAULT 'values',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_saved_views_name_not_blank CHECK (length(btrim(name)) > 0),
  CONSTRAINT user_saved_views_view_mode_allowed
    CHECK (view_mode IN ('by-parameter', 'sources', 'source-leads',
                         'values', 'equations', 'assumptions'))
);

-- Primary read path: "all of MY views, newest first".
CREATE INDEX IF NOT EXISTS user_saved_views_user_created_idx
  ON public.user_saved_views (user_id, created_at DESC);

-- Reuse the shared updated_at trigger fn (same convention as document_reviews).
DROP TRIGGER IF EXISTS update_user_saved_views_updated_at
  ON public.user_saved_views;
CREATE TRIGGER update_user_saved_views_updated_at
  BEFORE UPDATE ON public.user_saved_views
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.user_saved_views ENABLE ROW LEVEL SECURITY;

-- Owner can do everything to their OWN rows only. WITH CHECK blocks inserting or
-- updating a row owned by someone else.
DROP POLICY IF EXISTS "Users manage their own saved views"
  ON public.user_saved_views;
CREATE POLICY "Users manage their own saved views"
  ON public.user_saved_views
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins may READ all rows (support/debugging). Deliberately read-only -- admins
-- must not author or mutate another user's personal views. The two policies are
-- OR-ed, so an admin sees their own (owner policy) plus everyone's (this policy).
DROP POLICY IF EXISTS "Admins can read all saved views"
  ON public.user_saved_views;
CREATE POLICY "Admins can read all saved views"
  ON public.user_saved_views
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'matrix_admin')
    )
  );

REVOKE ALL ON public.user_saved_views FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_saved_views TO authenticated;
