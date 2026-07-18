-- ============================================================================
-- BATCH 3: Admin -> Users role-change RPCs. Creates manage_user_role_insert /
--   manage_user_role_delete (the Admin Users page calls these RPCs, not a direct
--   table write) and revokes direct INSERT/DELETE on user_roles from authenticated.
-- Idempotent: safe to run even if already applied (both functions are
--   CREATE OR REPLACE FUNCTION; the REVOKE is idempotent). Run after BATCH 1
--   (needs the user_roles table).
-- Needed-if: STEP 0 probe 1n shows either RPC present=false.
-- Source (concatenated verbatim, in order):
--   supabase/migrations/20260527000001_user_roles_rpcs.sql
--   supabase/migrations/20260527000002_user_roles_revoke_insert_delete.sql
-- ============================================================================

-- Phase 2 Security: user_roles INSERT/DELETE via SECURITY DEFINER RPCs
--
-- Creates two RPCs that replace direct INSERT/DELETE on user_roles.
-- After the companion migration (20260527000002) revokes INSERT/DELETE
-- from authenticated, these RPCs are the only application write path.
-- handle_new_user() trigger (SECDEF, owner=postgres) is unaffected.

BEGIN;

-- manage_user_role_insert: admin-only INSERT with role validation
CREATE OR REPLACE FUNCTION public.manage_user_role_insert(
  p_user_id UUID,
  p_role TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'admin role required'
      USING ERRCODE = '42501';
  END IF;

  IF p_role NOT IN ('admin', 'member', 'matrix_admin') THEN
    RAISE EXCEPTION 'invalid role value: %', p_role
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user_id, p_role)
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

ALTER FUNCTION public.manage_user_role_insert(UUID, TEXT) OWNER TO postgres;

REVOKE EXECUTE ON FUNCTION public.manage_user_role_insert(UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.manage_user_role_insert(UUID, TEXT)
  TO authenticated;
GRANT  EXECUTE ON FUNCTION public.manage_user_role_insert(UUID, TEXT)
  TO service_role;


-- manage_user_role_delete: admin-only DELETE with last-admin lockout guard
CREATE OR REPLACE FUNCTION public.manage_user_role_delete(
  p_user_id UUID,
  p_role TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_count INT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'admin role required'
      USING ERRCODE = '42501';
  END IF;

  IF p_role = 'admin' THEN
    SELECT COUNT(*) INTO v_admin_count
    FROM (
      SELECT 1 FROM public.user_roles
      WHERE role = 'admin'
      FOR UPDATE
    ) locked_admins;

    IF v_admin_count <= 1 THEN
      RAISE EXCEPTION 'cannot remove last admin -- bootstrap lockout protection'
        USING ERRCODE = '55000';
    END IF;
  END IF;

  DELETE FROM public.user_roles
  WHERE user_id = p_user_id
    AND role = p_role;
END;
$$;

ALTER FUNCTION public.manage_user_role_delete(UUID, TEXT) OWNER TO postgres;

REVOKE EXECUTE ON FUNCTION public.manage_user_role_delete(UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.manage_user_role_delete(UUID, TEXT)
  TO authenticated;
GRANT  EXECUTE ON FUNCTION public.manage_user_role_delete(UUID, TEXT)
  TO service_role;

COMMIT;
-- Phase 2 Security: revoke INSERT/DELETE on user_roles from authenticated
--
-- Apply AFTER 20260527000001 (RPCs) and AFTER deploying the TypeScript
-- changes that switch to .rpc() calls. After this migration:
--   authenticated: SELECT only on user_roles
--   INSERT/DELETE: only via manage_user_role_insert/delete RPCs
--   handle_new_user trigger: unaffected (runs as postgres)

REVOKE INSERT ON public.user_roles FROM authenticated;
REVOKE DELETE ON public.user_roles FROM authenticated;
REVOKE UPDATE ON public.user_roles FROM authenticated;
