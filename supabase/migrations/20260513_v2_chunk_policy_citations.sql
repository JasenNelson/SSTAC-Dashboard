-- engine_v2 frontend Lane 2d / Phase B (v0.5): v2_chunk_policy_citations.
--
-- Inverse-index table: which policies cited each submission chunk. Populated
-- by the indexer from v2_per_policy_results.evidence_packet entries. Only
-- submission-side citations are recorded; policy-text citations are
-- excluded (the engine's Phase 2.7 corpus-side filter separates these
-- upstream; the indexer additionally requires the evidence_item_id to
-- resolve to an entry in evidence_slices to avoid orphan citations).
--
-- Join key is evidence_item_id (the evidence_slices map KEY), NOT
-- source.chunk_id (which is often null) -- see ED-2d4-6.
--
-- RLS: owner-read only via the same v2_evaluations -> v2_projects join
-- pattern used for v2_submission_chunks. Service-role writes only.
-- See submission_chunks migration for the rationale (Round 2 / MINOR 1).

CREATE TABLE IF NOT EXISTS v2_chunk_policy_citations (
  evidence_item_id  text NOT NULL,
  evaluation_id     uuid NOT NULL REFERENCES v2_evaluations(id) ON DELETE CASCADE,
  policy_id         text NOT NULL,
  PRIMARY KEY (evidence_item_id, evaluation_id, policy_id)
);

CREATE INDEX IF NOT EXISTS v2_chunk_policy_citations_eval_item_idx
  ON v2_chunk_policy_citations (evaluation_id, evidence_item_id);
CREATE INDEX IF NOT EXISTS v2_chunk_policy_citations_eval_policy_idx
  ON v2_chunk_policy_citations (evaluation_id, policy_id);

ALTER TABLE v2_chunk_policy_citations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS v2_chunk_policy_citations_owner_read ON v2_chunk_policy_citations;
CREATE POLICY v2_chunk_policy_citations_owner_read
  ON v2_chunk_policy_citations FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM v2_evaluations e
      JOIN v2_projects p ON p.id = e.project_id
      WHERE e.id = v2_chunk_policy_citations.evaluation_id
        AND p.user_id = auth.uid()
    )
  );

-- Service-role writes only; no end-user INSERT/UPDATE/DELETE policy.

GRANT SELECT ON v2_chunk_policy_citations TO authenticated;
