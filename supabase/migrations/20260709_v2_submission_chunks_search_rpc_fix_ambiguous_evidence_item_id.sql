-- engine_v2 frontend: fix ambiguous column reference in search_submission_chunks.
--
-- Bug (found live 2026-07-09 against the real E-58 evaluation
-- 33333333-3333-3333-3333-333333333333): calling this RPC always failed with
--   "column reference \"evidence_item_id\" is ambiguous"
-- because the function's RETURNS TABLE(... evidence_item_id text ...) clause
-- (see the original definition in 20260513_v2_submission_chunks_search_rpc.sql)
-- implicitly declares evidence_item_id as a PL/pgSQL block variable in scope
-- for the ENTIRE function body. The inner correlated subquery that aggregates
-- v2_chunk_policy_citations referenced evidence_item_id UNQUALIFIED in both
-- its SELECT list and its GROUP BY clause:
--
--   SELECT evidence_item_id, COUNT(*)::bigint AS count
--   FROM v2_chunk_policy_citations
--   WHERE evaluation_id = p_evaluation_id
--   GROUP BY evidence_item_id
--
-- Postgres cannot tell whether that unqualified name means the table column
-- v2_chunk_policy_citations.evidence_item_id or the outer function's
-- evidence_item_id OUT-parameter variable, so it raises "ambiguous" at
-- execution time (this is a run-time PL/pgSQL resolution error, not a
-- parse-time error, which is why it was not caught until the function was
-- actually invoked against real data).
--
-- Fix: qualify every reference to evidence_item_id inside the subquery with
-- an explicit table alias (cpc), matching the style already used for the
-- outer query's c.* / cc.* aliases. No other behavior changes: same
-- signature, same RETURNS TABLE shape, same security model, same grants,
-- same ordering/ranking/highlighting logic.
--
-- This is a NEW forward migration (not an in-place edit of the already-
-- applied 20260513 migration), per this repo's established convention (see
-- 20260512000003_v2_per_policy_results_unique_fix_backfill_for_branch_replay.sql
-- for the prior precedent of shipping a fix as its own dated migration).
-- CREATE OR REPLACE FUNCTION is idempotent and safe to apply on top of the
-- already-deployed (buggy) function in production.

CREATE OR REPLACE FUNCTION public.search_submission_chunks(
  p_evaluation_id uuid,
  p_query         text,
  p_limit         int
)
RETURNS TABLE (
  id                 uuid,
  evidence_item_id   text,
  source_chunk_id    text,
  doc_section        text,
  page_num           int,
  snippet            text,
  indigenous_flagged boolean,
  cited_by_count     bigint,
  rank               real
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_query  tsquery;
  v_limit  int;
BEGIN
  IF p_evaluation_id IS NULL THEN
    RAISE EXCEPTION 'search_submission_chunks_null_evaluation_id';
  END IF;
  IF p_query IS NULL OR length(btrim(p_query)) = 0 THEN
    RAISE EXCEPTION 'search_submission_chunks_empty_query';
  END IF;

  -- Defense-in-depth clamp; route also clamps via clampSubmissionSearchLimit
  -- but a missing/garbage param should not allow an unbounded scan.
  v_limit := GREATEST(1, LEAST(COALESCE(p_limit, 20), 100));

  -- plainto_tsquery is the safe parameterized variant; raw user text is
  -- NEVER concatenated into a to_tsquery expression. The 'english' config
  -- matches the GENERATED ALWAYS AS expression on content_tsv.
  v_query := plainto_tsquery('english', p_query);

  RETURN QUERY
  SELECT
    c.id,
    c.evidence_item_id,
    c.source_chunk_id,
    c.doc_section,
    c.page_num,
    ts_headline(
      'english',
      c.content,
      v_query,
      'MaxFragments=2,MaxWords=30,MinWords=10,ShortWord=2,StartSel=<mark>,StopSel=</mark>'
    ) AS snippet,
    c.indigenous_flagged,
    COALESCE(cc.count, 0)::bigint AS cited_by_count,
    ts_rank(c.content_tsv, v_query) AS rank
  FROM v2_submission_chunks c
  LEFT JOIN (
    -- Fix: qualify with the cpc alias so evidence_item_id cannot be
    -- confused with this function's own evidence_item_id OUT parameter.
    SELECT cpc.evidence_item_id, COUNT(*)::bigint AS count
    FROM v2_chunk_policy_citations cpc
    WHERE cpc.evaluation_id = p_evaluation_id
    GROUP BY cpc.evidence_item_id
  ) cc ON cc.evidence_item_id = c.evidence_item_id
  WHERE c.evaluation_id = p_evaluation_id
    AND c.content_tsv @@ v_query
  ORDER BY rank DESC, c.page_num ASC NULLS LAST, c.id ASC
  LIMIT v_limit;
END;
$$;

-- Grants are idempotent to restate; unchanged from the original migration.
REVOKE EXECUTE ON FUNCTION public.search_submission_chunks(uuid, text, int) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.search_submission_chunks(uuid, text, int) TO authenticated;
