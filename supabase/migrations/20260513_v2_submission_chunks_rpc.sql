-- engine_v2 frontend Lane 2d / Phase B (v0.5) -- corrective follow-up RLS
-- alignment: transactional submission-chunks replacement RPC.
--
-- Phase B Round 1 used separate DELETE+INSERT calls from the Supabase JS
-- client, which are NOT a single SQL transaction. Codex flagged the
-- following failure modes:
--   1. A concurrent SELECT during the window between DELETE and INSERT
--      sees zero rows for the evaluation (not "stale rows then fresh
--      rows", but "missing rows entirely").
--   2. A process kill mid-INSERT leaves partial data with no retry-side
--      DELETE to heal -- the next run's DELETE handles it, but no run
--      means stale partial data persists indefinitely.
--   3. v2_submission_chunks and v2_chunk_policy_citations are written by
--      separate statements; FK is on evaluation_id which is fine, but
--      readers can observe a chunks-deleted/citations-still-present (or
--      vice-versa) split state.
--
-- Fix: wrap the DELETE + DELETE + INSERT + INSERT in a single Postgres
-- function so they execute inside one implicit transaction (PostgreSQL
-- function bodies are atomic by default; the entire function body is
-- one transaction unless explicitly subdivided).
--
-- Security model (Phase B corrective follow-up):
--   - SECURITY INVOKER: the RPC executes with the caller's privileges,
--     so the owner-AND-admin RLS policies on the three Phase B tables
--     (v2_submission_chunks, v2_chunk_policy_citations,
--     v2_submission_chunks_indexing_status) continue to apply inside
--     the function body. The route layer additionally enforces an
--     explicit ownership probe before invoking the indexer, so the RLS
--     check is defense-in-depth on the happy path.
--   - GRANT EXECUTE TO authenticated: the dashboard's authenticated
--     admin client (the standard client used by every other engine_v2
--     write path) invokes this RPC. No service-role key is required.
--     REVOKE FROM PUBLIC stays so anonymous clients cannot reach the
--     function.
--   - Status side table writes (v2_submission_chunks_indexing_status)
--     are NOT inside this RPC. Status transitions (pending -> running ->
--     complete/error) are intentionally outside the data transaction:
--     'running' is written BEFORE the RPC so observers can see the
--     in-progress state; 'complete' or 'error' is written AFTER. If the
--     RPC throws, the caller catches and writes 'error' explicitly.
--
-- Schema:
--   p_evaluation_id  uuid: the evaluation whose chunks/citations are replaced.
--   p_chunks         jsonb: array of {evidence_item_id, source_chunk_id,
--                            doc_section, page_num, content,
--                            indigenous_flagged}.
--   p_citations      jsonb: array of {evidence_item_id, policy_id}.
--
-- Returns:
--   (chunk_rows int, citation_rows int): the count of rows inserted in
--   each table (informational; the actual rows are visible to subsequent
--   SELECTs once the transaction commits).
--
-- Idempotency: repeated calls with the same p_evaluation_id and any
-- p_chunks / p_citations produce the same row set (the DELETE is
-- unconditional; subsequent INSERTs are the new ground truth).

CREATE OR REPLACE FUNCTION public.replace_submission_chunks(
  p_evaluation_id uuid,
  p_chunks        jsonb,
  p_citations     jsonb
)
RETURNS TABLE (chunk_rows int, citation_rows int)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_chunk_count    int := 0;
  v_citation_count int := 0;
BEGIN
  -- Defensive arg validation. NULL evaluation_id is a programmer error;
  -- NULL arrays are tolerated as "no rows to insert" (caller path for
  -- the missing-evidence-slices case still wants DELETE to run).
  IF p_evaluation_id IS NULL THEN
    RAISE EXCEPTION 'replace_submission_chunks_null_evaluation_id';
  END IF;

  -- Citations FIRST so a partial failure leaves citations cleared and
  -- chunks intact (FK is on evaluation_id, not chunk_id, but symmetry
  -- with the retry-converge logic in the JS indexer prevents drift if
  -- this RPC is ever invoked alongside legacy non-RPC writers).
  DELETE FROM v2_chunk_policy_citations
   WHERE evaluation_id = p_evaluation_id;

  DELETE FROM v2_submission_chunks
   WHERE evaluation_id = p_evaluation_id;

  -- Bulk-insert chunks from the jsonb array. jsonb_to_recordset expands
  -- one element per row. evaluation_id is bound from the arg, not the
  -- payload, so a malicious caller cannot retarget another evaluation.
  IF p_chunks IS NOT NULL AND jsonb_typeof(p_chunks) = 'array' THEN
    INSERT INTO v2_submission_chunks (
      evaluation_id,
      evidence_item_id,
      source_chunk_id,
      doc_section,
      page_num,
      content,
      indigenous_flagged
    )
    SELECT
      p_evaluation_id,
      x.evidence_item_id,
      x.source_chunk_id,
      x.doc_section,
      x.page_num,
      x.content,
      COALESCE(x.indigenous_flagged, false)
    FROM jsonb_to_recordset(p_chunks) AS x (
      evidence_item_id   text,
      source_chunk_id    text,
      doc_section        text,
      page_num           int,
      content            text,
      indigenous_flagged boolean
    );
    GET DIAGNOSTICS v_chunk_count = ROW_COUNT;
  END IF;

  IF p_citations IS NOT NULL AND jsonb_typeof(p_citations) = 'array' THEN
    INSERT INTO v2_chunk_policy_citations (
      evidence_item_id,
      evaluation_id,
      policy_id
    )
    SELECT
      y.evidence_item_id,
      p_evaluation_id,
      y.policy_id
    FROM jsonb_to_recordset(p_citations) AS y (
      evidence_item_id text,
      policy_id        text
    );
    GET DIAGNOSTICS v_citation_count = ROW_COUNT;
  END IF;

  RETURN QUERY SELECT v_chunk_count, v_citation_count;
END;
$$;

-- Lock down execution. Default function grants in Postgres are EXECUTE
-- TO PUBLIC; explicitly revoke and grant only to authenticated. The
-- authenticated admin client is the standard write path used across
-- engine_v2; the owner-AND-admin RLS policies on the three Phase B
-- tables continue to gate row-level access inside the function body
-- (SECURITY INVOKER).
REVOKE EXECUTE ON FUNCTION public.replace_submission_chunks(uuid, jsonb, jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.replace_submission_chunks(uuid, jsonb, jsonb) FROM service_role;
GRANT  EXECUTE ON FUNCTION public.replace_submission_chunks(uuid, jsonb, jsonb) TO authenticated;
