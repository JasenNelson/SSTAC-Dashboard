-- =====================================================================
-- ROLLBACK for MATRIX_PAPER_REVIEW_V0991_ACTIVATION_2026_10_14.sql
-- DRAFT -- NOT RUN.
-- DESTRUCTIVE: drops all three tables and every function. Requires its OWN
-- separate owner approval of this exact file. It is NEVER a reaction to a
-- postflight failure: for a postflight failure use the KILL_SWITCH file and
-- investigate. The transaction refuses to proceed (RAISE EXCEPTION) if any
-- response or event row exists, so reviewer data can never be dropped here.
-- Migration history (supabase_migrations.schema_migrations) is NOT touched.
-- ORDER: apply the KILL_SWITCH file FIRST. The lock order below (events,
-- responses, questions) is the reverse of the RPC lock order, so a concurrent
-- RPC write could deadlock with this transaction. A deadlock is fail-safe (one
-- side aborts; nothing is dropped), and the KILL_SWITCH removes the callers.
-- =====================================================================
BEGIN;

LOCK TABLE public.matrix_paper_review_response_events IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.matrix_paper_review_responses       IN ACCESS EXCLUSIVE MODE;
LOCK TABLE public.matrix_paper_review_questions       IN ACCESS EXCLUSIVE MODE;

DO $$
DECLARE
  v_resp integer;
  v_evt  integer;
BEGIN
  SELECT pg_catalog.count(*) INTO v_resp FROM public.matrix_paper_review_responses;
  SELECT pg_catalog.count(*) INTO v_evt  FROM public.matrix_paper_review_response_events;
  IF v_resp <> 0 OR v_evt <> 0 THEN
    RAISE EXCEPTION 'rollback refused: % response rows and % event rows exist', v_resp, v_evt;
  END IF;
END;
$$;

-- Policies (explicit; they would also drop with their tables).
DROP POLICY IF EXISTS "matrix_paper_review_response_events_select_paper_admin" ON public.matrix_paper_review_response_events;
DROP POLICY IF EXISTS "matrix_paper_review_response_events_select_own"         ON public.matrix_paper_review_response_events;
DROP POLICY IF EXISTS "matrix_paper_review_responses_select_paper_admin"       ON public.matrix_paper_review_responses;
DROP POLICY IF EXISTS "matrix_paper_review_responses_select_own"               ON public.matrix_paper_review_responses;
DROP POLICY IF EXISTS "matrix_paper_review_questions_select_authenticated"     ON public.matrix_paper_review_questions;

-- Write RPCs.
DROP FUNCTION IF EXISTS public.matrix_paper_review_submit(text, text, text, text, text, integer);
DROP FUNCTION IF EXISTS public.matrix_paper_review_save_draft(text, text, text, text, text, integer);

-- Append-only trigger, then its function.
DROP TRIGGER IF EXISTS matrix_paper_review_response_events_no_update
  ON public.matrix_paper_review_response_events;
DROP FUNCTION IF EXISTS public.matrix_paper_review_events_block_update();

-- Tables, dependents first.
DROP TABLE IF EXISTS public.matrix_paper_review_response_events;
DROP TABLE IF EXISTS public.matrix_paper_review_responses;
DROP TABLE IF EXISTS public.matrix_paper_review_questions;

-- Helpers: utf16_length after the responses table (its CHECKs use it), admin helper last.
DROP FUNCTION IF EXISTS public.matrix_paper_review_utf16_length(text);
DROP FUNCTION IF EXISTS public.is_matrix_options_paper_admin();

NOTIFY pgrst, 'reload schema';

COMMIT;
