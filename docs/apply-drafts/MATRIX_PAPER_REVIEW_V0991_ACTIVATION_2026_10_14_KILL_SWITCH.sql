-- =====================================================================
-- KILL SWITCH for MATRIX_PAPER_REVIEW_V0991_ACTIVATION_2026_10_14.sql
-- DRAFT -- NOT RUN; requires its own explicit owner approval of this exact file.
-- Stops NEW review writes: revokes EXECUTE on the two write RPCs (PUBLIC, anon, authenticated, the server-only role)
-- every privilege of the server-only role on the three tables except SELECT (REVOKE ALL,
-- then GRANT SELECT) and all privileges on the events sequence (idempotent). Writes by the table owner / superuser
-- roles (postgres) are outside its scope.
-- PRESERVES ALL DATA: no table, row, policy, trigger or function is dropped.
-- A call that already passed its EXECUTE check (for example queued on the per-user advisory
-- lock) is NOT cancelled by this file: run ..._KILL_SWITCH_DRAIN.sql afterwards and report
-- "writes stopped" only when it shows zero in-flight calls and a stable event count.
-- Reads (RLS SELECT policies) keep working. Reversible by re-granting:
--   GRANT EXECUTE ON FUNCTION <fn> TO authenticated;
-- =====================================================================
BEGIN;

DO $$
BEGIN
  IF pg_catalog.current_setting('server_version_num')::integer < 170000 THEN
    RAISE EXCEPTION 'kill switch requires PG17+ (MAINTAIN privilege), server_version_num is %', pg_catalog.current_setting('server_version_num');
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.matrix_paper_review_save_draft(text, text, text, text, text, integer)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.matrix_paper_review_submit(text, text, text, text, text, integer)
  FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON TABLE public.matrix_paper_review_questions, public.matrix_paper_review_responses, public.matrix_paper_review_response_events FROM service_role;
GRANT SELECT ON TABLE public.matrix_paper_review_questions, public.matrix_paper_review_responses, public.matrix_paper_review_response_events TO service_role;
REVOKE ALL ON SEQUENCE public.matrix_paper_review_response_events_id_seq FROM service_role;

DO $$
DECLARE
  v_bad text;
BEGIN
  -- Fail closed: EVERY role that is not a superuser, not the function owner and does not
  -- inherit the owner's privileges must be unable to execute either write RPC
  -- (has_function_privilege includes inherited and PUBLIC grants). The switch revokes from
  -- the known grantees above; if any OTHER role can still execute, this raises, the
  -- transaction rolls back, and the operator investigates (no blind revoke).
  -- Out of scope (cannot be restricted by revoking): superusers, the function owner, and any
  -- role with USAGE on the owner role (pg_has_role) - those hold the owner's privileges.
  SELECT pg_catalog.string_agg(r.rolname || ' -> ' || f.fname, ', ' ORDER BY r.rolname, f.fname)
    INTO v_bad
    FROM pg_catalog.pg_roles r,
         (VALUES ('public.matrix_paper_review_save_draft(text, text, text, text, text, integer)'::regprocedure::oid, 'save_draft'),
                 ('public.matrix_paper_review_submit(text, text, text, text, text, integer)'::regprocedure::oid, 'submit')) AS f(fid, fname),
         pg_catalog.pg_proc p
   WHERE p.oid = f.fid
     AND NOT r.rolsuper
     AND r.oid <> p.proowner
     AND NOT pg_catalog.pg_has_role(r.oid, p.proowner, 'USAGE')
     AND pg_catalog.has_function_privilege(r.oid, f.fid, 'EXECUTE');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'kill switch failed: non-owner role(s) can still execute a write RPC: %', v_bad;
  END IF;
  IF EXISTS (
       SELECT 1
         FROM pg_catalog.pg_proc p, pg_catalog.aclexplode(coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))) a
        WHERE p.oid IN ('public.matrix_paper_review_save_draft(text, text, text, text, text, integer)'::regprocedure,
                        'public.matrix_paper_review_submit(text, text, text, text, text, integer)'::regprocedure)
          AND a.grantee = 0 AND a.privilege_type = 'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'kill switch failed: a write RPC is still executable by PUBLIC';
  END IF;
  IF pg_catalog.has_table_privilege('service_role', 'public.matrix_paper_review_questions', 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
     OR pg_catalog.has_table_privilege('service_role', 'public.matrix_paper_review_responses', 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
     OR pg_catalog.has_table_privilege('service_role', 'public.matrix_paper_review_response_events', 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
     OR pg_catalog.has_sequence_privilege('service_role', 'public.matrix_paper_review_response_events_id_seq', 'USAGE,SELECT,UPDATE') THEN
    RAISE EXCEPTION 'kill switch failed: the server-only role still holds a non-SELECT table privilege or a sequence privilege';
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
