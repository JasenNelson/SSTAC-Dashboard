-- engine_v2 Lane 2b hotfix: make the judgment-history trigger writable under RLS.
--
-- DEFECT (found 2026-07-04, codex + Opus holistic review of the M6 Steps 3-6 round-trip):
-- v2_judgments_history_trigger() (defined in database_schema_engine_v2_lane2b_patch.sql)
-- ran as SECURITY INVOKER. When an authenticated owner-admin RE-JUDGES a policy (an UPDATE
-- to v2_judgments that changes verdict/rationale/evidence_refs), the BEFORE UPDATE trigger
-- INSERTs the prior values into v2_judgment_history. v2_judgment_history has RLS enabled with
-- only a SELECT policy (no INSERT/ALL policy), so under the authenticated role that INSERT is
-- denied by RLS -> the whole re-judge UPDATE 500s. (First-judgment INSERTs do not fire the
-- BEFORE UPDATE trigger, so normal judging + memo export were unaffected; only re-judge hit it.)
--
-- Live-DB ground truth confirmed via direct connection 2026-07-04: pg_proc.prosecdef = false,
-- authenticated held INSERT/UPDATE/DELETE/... grants on v2_judgment_history (broader than the
-- lane2b_patch GRANT SELECT), and there was NO INSERT/ALL RLS policy -> RLS default-deny bound.
--
-- FIX (recommended by codex, mutual-agreement): make the trigger fn SECURITY DEFINER (owned by
-- postgres, which bypasses RLS and can INSERT), pin an empty search_path and schema-qualify all
-- objects, and REVOKE the over-broad direct DML grants so the audit table is trigger-write-only.
-- This does NOT broaden who can write history: only an owner-admin who passes the v2_judgments
-- owner-admin UPDATE policy can fire the trigger. auth.uid() still resolves from the request JWT
-- under SECURITY DEFINER (it is not based on current_user).
--
-- Idempotent (CREATE OR REPLACE / ALTER / REVOKE / GRANT). Applied to the live project
-- qyrhsieynzfgyuqzznap on 2026-07-04; committed here so the migration history matches live.

BEGIN;

CREATE OR REPLACE FUNCTION public.v2_judgments_history_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF (OLD.verdict IS DISTINCT FROM NEW.verdict
      OR OLD.rationale IS DISTINCT FROM NEW.rationale
      OR OLD.evidence_refs IS DISTINCT FROM NEW.evidence_refs) THEN
    INSERT INTO public.v2_judgment_history
      (judgment_id, prior_verdict, prior_rationale, prior_evidence_refs, changed_by_user_id)
    VALUES
      (OLD.id, OLD.verdict, OLD.rationale, OLD.evidence_refs, auth.uid());

    NEW.updated_at = pg_catalog.now();
  END IF;

  RETURN NEW;
END
$$;

ALTER FUNCTION public.v2_judgments_history_trigger() OWNER TO postgres;

-- Defense-in-depth for the SECURITY DEFINER function: revoke EXECUTE from PUBLIC and from the
-- Supabase client roles (anon, authenticated). Supabase's default privileges grant EXECUTE on
-- public functions to anon/authenticated/service_role in addition to PUBLIC, so a PUBLIC-only
-- revoke leaves those explicit grants; revoke the client roles too, keeping only owner (postgres)
-- and the trusted service_role. (A trigger function cannot be invoked directly -- Postgres rejects
-- a plain SELECT of it -- so this is hardening, not a live exploit fix; it does NOT affect the
-- trigger firing, which is not gated by the invoker's EXECUTE privilege.)
REVOKE EXECUTE ON FUNCTION public.v2_judgments_history_trigger() FROM PUBLIC, anon, authenticated;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.v2_judgment_history
  FROM authenticated;

GRANT SELECT
  ON TABLE public.v2_judgment_history
  TO authenticated;

COMMIT;
