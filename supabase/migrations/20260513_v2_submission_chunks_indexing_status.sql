-- engine_v2 frontend Lane 2d / Phase B (v0.5): submission chunks indexing
-- status side table (added per IMPORTANT 3).
--
-- Tracks the state of the post-eval indexer so the UI can distinguish a
-- legitimately-empty search result (indexing complete, nothing matched)
-- from an actual indexer failure (status='error', error_message set).
-- The UI surfaces a "Search unavailable: indexing failed (retry)" CTA
-- when status='error'; the POST reindex route consumes the same row.
--
-- One row per evaluation_id. Rows are written by the indexer via the
-- service-role client inside importEvalResult (BLOCKER 1 fix:
-- non-blocking on indexer failure -- the parent function still returns
-- success, but a row is written with status='error' here so the failure
-- is observable).
--
-- RLS: owner-read only. Service-role writes only. See
-- submission_chunks migration for the deliberate-divergence rationale
-- (Round 2 / MINOR 1: prior v2_* tables used owner-AND-admin because
-- end users wrote directly; Phase B tables are service-role-only on
-- writes, so the admin-via-user_roles predicate is enforced upstream at
-- requireAdminForApi instead of in the policy).

CREATE TABLE IF NOT EXISTS v2_submission_chunks_indexing_status (
  evaluation_id  uuid PRIMARY KEY REFERENCES v2_evaluations(id) ON DELETE CASCADE,
  status         text NOT NULL CHECK (status IN ('pending','running','complete','error')),
  error_message  text NULL,
  started_at     timestamptz NULL,
  completed_at   timestamptz NULL,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE v2_submission_chunks_indexing_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS v2_submission_chunks_indexing_status_owner_read
  ON v2_submission_chunks_indexing_status;
CREATE POLICY v2_submission_chunks_indexing_status_owner_read
  ON v2_submission_chunks_indexing_status FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM v2_evaluations e
      JOIN v2_projects p ON p.id = e.project_id
      WHERE e.id = v2_submission_chunks_indexing_status.evaluation_id
        AND p.user_id = auth.uid()
    )
  );

-- Service-role writes only; no end-user INSERT/UPDATE/DELETE policy.

GRANT SELECT ON v2_submission_chunks_indexing_status TO authenticated;
