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

  INSERT INTO public.user_roles (user_id, role, created_at, updated_at)
  VALUES (p_user_id, p_role, NOW(), NOW())
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
