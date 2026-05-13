-- engine_v2 frontend Lane 2d / Phase C Round 2 (IMPORTANT 1 fix):
-- search_submission_chunks RPC.
--
-- Provides rank-ordered FTS over v2_submission_chunks with snippet
-- highlighting + cited-by count subselect, eliminating Phase C Round 1's
-- PostgREST limitation (no ts_rank as sort key). Both Phase C UI
-- (Submission Search tab) and Phase D chat retrieval (when wired) call
-- this RPC instead of the PostgREST query builder so they get consistent
-- relevance ordering. The shared submission_search.ts lib's raw-SQL
-- emitter (buildSubmissionSearchQuery) stays as a reference for the
-- query shape; both surfaces now route through this RPC.
--
-- Security model:
--   SECURITY INVOKER -- the RPC executes with the caller's privileges,
--   so the existing RLS policies on v2_submission_chunks
--   (v2_submission_chunks_owner_read) and v2_chunk_policy_citations
--   (v2_chunk_policy_citations_owner_read) continue to apply. The route
--   handler additionally performs an explicit ownership probe via the
--   v2_evaluations -> v2_projects.user_id JOIN before calling this RPC,
--   so p_evaluation_id is guaranteed to be a row the caller owns.
--   Combined with REVOKE FROM PUBLIC + GRANT EXECUTE TO authenticated,
--   only an authenticated (signed-in) admin client can invoke this RPC.
--
--   This is intentionally DIFFERENT from replace_submission_chunks
--   (which is SECURITY DEFINER, service-role only) because that RPC is
--   a write path that requires bypassing RLS for the bulk DELETE+INSERT;
--   search is a read path that benefits from RLS being honored.
--
-- Schema:
--   p_evaluation_id  uuid:  the evaluation to search.
--   p_query          text:  raw user query (fed to plainto_tsquery).
--   p_limit          int:   row cap; clamped internally to [1, 100].
--
-- Returns one row per matching chunk, ordered by ts_rank DESC with a
-- stable tie-break (page_num ASC NULLS LAST, then id ASC). The snippet
-- column is the ts_headline output with <mark>...</mark> highlighting;
-- the cited_by_count column is a correlated subselect against
-- v2_chunk_policy_citations.

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
  -- NEVER concatenated into a to_tsquery expression. The 'english'
  -- config matches the GENERATED ALWAYS AS expression on content_tsv.
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
    SELECT evidence_item_id, COUNT(*)::bigint AS count
    FROM v2_chunk_policy_citations
    WHERE evaluation_id = p_evaluation_id
    GROUP BY evidence_item_id
  ) cc ON cc.evidence_item_id = c.evidence_item_id
  WHERE c.evaluation_id = p_evaluation_id
    AND c.content_tsv @@ v_query
  ORDER BY rank DESC, c.page_num ASC NULLS LAST, c.id ASC
  LIMIT v_limit;
END;
$$;

-- Lock down execution. Default function grants are EXECUTE TO PUBLIC;
-- explicitly revoke and grant only to authenticated. Anonymous web
-- clients cannot invoke this RPC, and RLS still gates row visibility
-- inside the function body (SECURITY INVOKER).
REVOKE EXECUTE ON FUNCTION public.search_submission_chunks(uuid, text, int) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.search_submission_chunks(uuid, text, int) TO authenticated;
