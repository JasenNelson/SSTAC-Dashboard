-- engine_v2 frontend Lane 2d / Phase B (v0.5): v2_submission_chunks.
--
-- Submission-side chunk table. One row per evidence slice surfaced by the
-- engine's eval_result.json envelope (Lane 2c schema_version 0.1.0). The
-- evaluation_id + evidence_item_id pair is the natural unique key; the
-- map KEY of evidence_slices is ALWAYS present (the inner source.chunk_id
-- field is nullable and NOT a join key -- see ED-2d4-6).
--
-- Searchable via a STORED generated tsvector + GIN index. Postgres 12+
-- requires STORED (VIRTUAL cannot back a GIN index).
--
-- indigenous_flagged is a content-type relevance signal computed
-- deterministically by the indexer at INSERT time. It is NOT consumed by
-- the chat route or any AI prompt -- see feedback_no_tier_judgment_for_ai
-- (2026-05-12, HIGH AUTHORITY). The flag is owner-editable via the
-- submission_indigenous_keywords.ts list.
--
-- RLS: owner-read only (project owner inherits via v2_evaluations ->
-- v2_projects.user_id = auth.uid()). Service-role writes only; no
-- end-user INSERT/UPDATE/DELETE policy is exposed.
--
-- Round 2 / MINOR 1 (RLS posture): the prior v2_* migrations (lane2a
-- patch) use owner-AND-admin checks via user_roles for end-user CRUD
-- because end users write rows directly (e.g. v2_per_policy_results
-- inserts on import). These Phase B tables are different: writes only
-- happen via the service-role indexer, never via the end-user client.
-- Owner-only SELECT is deliberate; admin-via-user_roles is not added
-- here because (a) the indexer cannot consult user_roles (it has no
-- session), and (b) the admin-as-read-as-owner pattern is enforced
-- upstream at requireAdminForApi(). A non-admin authenticated user who
-- somehow obtained a project's owner-user-id link cannot still trigger
-- writes because there is NO end-user write policy on this table.

CREATE TABLE IF NOT EXISTS v2_submission_chunks (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id      uuid NOT NULL REFERENCES v2_evaluations(id) ON DELETE CASCADE,
  evidence_item_id   text NOT NULL,
  source_chunk_id    text NULL,
  doc_section        text NOT NULL,
  page_num           int NULL,
  content            text NOT NULL,
  content_tsv        tsvector GENERATED ALWAYS AS (to_tsvector('english', content)) STORED,
  indigenous_flagged boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (evaluation_id, evidence_item_id)
);

CREATE INDEX IF NOT EXISTS v2_submission_chunks_tsv_idx
  ON v2_submission_chunks USING GIN (content_tsv);
CREATE INDEX IF NOT EXISTS v2_submission_chunks_eval_item_idx
  ON v2_submission_chunks (evaluation_id, evidence_item_id);
CREATE INDEX IF NOT EXISTS v2_submission_chunks_eval_flag_idx
  ON v2_submission_chunks (evaluation_id, indigenous_flagged);

ALTER TABLE v2_submission_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS v2_submission_chunks_owner_read ON v2_submission_chunks;
CREATE POLICY v2_submission_chunks_owner_read
  ON v2_submission_chunks FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM v2_evaluations e
      JOIN v2_projects p ON p.id = e.project_id
      WHERE e.id = v2_submission_chunks.evaluation_id
        AND p.user_id = auth.uid()
    )
  );

-- Service-role writes only; no end-user INSERT/UPDATE/DELETE policy.

GRANT SELECT ON v2_submission_chunks TO authenticated;
