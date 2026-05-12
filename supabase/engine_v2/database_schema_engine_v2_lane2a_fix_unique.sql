-- engine_v2 Lane 2a hotfix: replace expression-based unique index on
-- v2_per_policy_results with a plain-column unique index so Supabase
-- upsert({onConflict: "evaluation_id,policy_id,stage,packet_id"}) matches.
--
-- Verified 2026-05-12 against engine eval_result.json: every row emits
-- non-null stage and packet_id, so NOT NULL DEFAULT '' is safe.

UPDATE v2_per_policy_results SET stage = '' WHERE stage IS NULL;
UPDATE v2_per_policy_results SET packet_id = '' WHERE packet_id IS NULL;

ALTER TABLE v2_per_policy_results
  ALTER COLUMN stage SET DEFAULT '',
  ALTER COLUMN stage SET NOT NULL,
  ALTER COLUMN packet_id SET DEFAULT '',
  ALTER COLUMN packet_id SET NOT NULL;

DROP INDEX IF EXISTS idx_v2_per_policy_results__eval_policy_stage_packet;

CREATE UNIQUE INDEX idx_v2_per_policy_results__eval_policy_stage_packet
  ON v2_per_policy_results (evaluation_id, policy_id, stage, packet_id);
