-- Phase 2 Security: revoke INSERT/DELETE on user_roles from authenticated
--
-- Apply AFTER 20260527000001 (RPCs) and AFTER deploying the TypeScript
-- changes that switch to .rpc() calls. After this migration:
--   authenticated: SELECT only on user_roles
--   INSERT/DELETE: only via manage_user_role_insert/delete RPCs
--   handle_new_user trigger: unaffected (runs as postgres)

REVOKE INSERT ON public.user_roles FROM authenticated;
REVOKE DELETE ON public.user_roles FROM authenticated;
