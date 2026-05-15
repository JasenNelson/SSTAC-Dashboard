-- =====================================================================
-- Matrix Options Review -- security audit migration
-- Applied to production:           2026-05-15
-- Verified via Supabase branch:    matrix-security-audit-20260515
--
-- Closes three audit findings:
--   CRITICAL-1  Email enumeration via get_users_with_emails RPC
--   HIGH-1      Duplicate matrix_reviews rows on every Submit Review click
--   HIGH-4      user_roles privilege escalation via permissive RLS
--
-- This file is the canonical record for git history and future branch
-- baselines. It will not re-apply against the current production DB
-- (Supabase tracks migrations by filename; the change is already live).
-- See matrix_security_audit_summary.md (repo root) for the full findings.
--
-- Pre-flight checks confirmed before apply (run separately, READ-ONLY):
--
--   SELECT pg_get_function_result(p.oid) AS current_signature
--   FROM pg_proc p
--   JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'public' AND p.proname = 'get_users_with_emails';
--   -- Expected last column: last_sign_in
--
--   SELECT proname, prosecdef,
--          (SELECT rolname FROM pg_roles WHERE oid = proowner) AS owner,
--          (SELECT rolbypassrls FROM pg_roles WHERE oid = proowner) AS owner_bypasses_rls
--   FROM pg_proc
--   WHERE proname IN ('handle_new_user','get_users_with_emails')
--     AND pronamespace = 'public'::regnamespace;
--   -- Expected: owner=postgres, owner_bypasses_rls=true for both
--
--   SELECT COUNT(*) AS admin_count
--   FROM public.user_roles
--   WHERE role = 'admin';
--   -- Must be >= 1 to avoid bootstrap lockout
-- =====================================================================

BEGIN;

-- =====================================================================
-- SECTION 1 -- CRITICAL-1: admin-gated wrapper around get_users_with_emails
-- =====================================================================
-- The function previously had EXECUTE granted to PUBLIC + anon, letting
-- anyone with the public anon key (which ships in browser JS) enumerate
-- every confirmed user's email. Fix: add an inline admin check inside
-- the function body, REVOKE PUBLIC + anon, leave authenticated and
-- service_role grants in place (the inline check is the authoritative
-- gate, the proacl is defense-in-depth).

CREATE OR REPLACE FUNCTION public.get_users_with_emails()
RETURNS TABLE (
    id UUID,
    email CHARACTER VARYING(255),
    created_at TIMESTAMP WITH TIME ZONE,
    last_sign_in TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'admin role required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT au.id,
           au.email::CHARACTER VARYING(255),
           au.created_at,
           au.last_sign_in_at
    FROM auth.users au
    WHERE au.email_confirmed_at IS NOT NULL
    ORDER BY au.created_at DESC;
END;
$$;

ALTER FUNCTION public.get_users_with_emails() OWNER TO postgres;

REVOKE EXECUTE ON FUNCTION public.get_users_with_emails() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.get_users_with_emails() TO authenticated;
GRANT  EXECUTE ON FUNCTION public.get_users_with_emails() TO service_role;


-- =====================================================================
-- SECTION 2 -- HIGH-1: dedupe matrix_reviews + UNIQUE(user_id)
-- =====================================================================
-- The table had no UNIQUE(user_id), so every Submit Review click created
-- a new row instead of updating the existing one. Fix: dedupe existing
-- rows (window-function ranking handles identical-timestamp ties), then
-- add the UNIQUE constraint so future upserts are atomic.

DELETE FROM public.matrix_reviews
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY user_id
             ORDER BY updated_at DESC, id DESC
           ) AS rn
    FROM public.matrix_reviews
  ) ranked
  WHERE rn > 1
);

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


-- =====================================================================
-- SECTION 3 -- HIGH-4: lock down user_roles policies
-- =====================================================================
-- The table previously had "Allow admins to manage" with qual=true for
-- cmd=ALL and "Allow trigger inserts on user_roles" with with_check=true
-- for INSERT. If those policies bound to role public/authenticated, any
-- authenticated user could self-grant admin and bypass every admin gate.
-- Fix: replace with strict own-row + admin-only policies via an
-- is_admin() SECURITY DEFINER helper. Keeps "Allow system function
-- inserts" so the auth.users signup trigger still fires (the trigger
-- bypasses RLS anyway since handle_new_user runs as a BYPASSRLS owner,
-- but the policy stays as belt-and-suspenders).

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;

ALTER FUNCTION public.is_admin() OWNER TO postgres;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.is_admin() TO authenticated;

DROP POLICY IF EXISTS "Allow admins to manage"                ON public.user_roles;
DROP POLICY IF EXISTS "Allow trigger inserts on user_roles"   ON public.user_roles;
DROP POLICY IF EXISTS "Allow all authenticated users to read" ON public.user_roles;
DROP POLICY IF EXISTS "Allow admin role management"           ON public.user_roles;

CREATE POLICY "Users can read own role"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL TO authenticated
  USING       (public.is_admin())
  WITH CHECK  (public.is_admin());

COMMIT;


-- =====================================================================
-- POST-APPLY NOTE
-- =====================================================================
-- When this migration was rolled into main via Supabase's auto-merge of
-- branch matrix-security-audit-20260515, the schema diff (function
-- bodies, constraint, policies) replayed correctly but the REVOKE
-- EXECUTE statements above did NOT replay automatically (Supabase's
-- introspection treats function privileges as separate from schema).
-- The two REVOKEs were re-run manually against main immediately after
-- merge to restore the clean proacl. The statements above are still the
-- correct source of truth -- if this file is ever replayed against a
-- fresh DB, no manual follow-up is needed.
