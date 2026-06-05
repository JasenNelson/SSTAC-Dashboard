-- M1a Phase 2: store the HITL-confirmed applicable-policy set on v2_projects.
-- Idempotent. Mirrors the application_types / selected_services JSONB pattern
-- (database_schema_engine_v2_patch.sql lines 18-20).
--
-- DEPLOY ORDER (apply-before-deploy): paste this in Studio BEFORE merging or
-- deploying the companion code change -- the [projectId] page select hard-
-- requires this column; deploying code first 404s the project detail page
-- (PostgREST 42703 -> notFound) until the column exists. Clean failure, no
-- data risk, but avoid it by applying this first.
--
-- No RLS or grant changes required (verified live 2026-06-04 via exploratory
-- SQL): the existing row-level policy v2_projects_owner_admin_all (FOR ALL TO
-- authenticated; owner AND admin in both qual and with_check) is
-- column-agnostic, and authenticated already holds UPDATE. No triggers exist
-- on v2_projects. No SECURITY DEFINER needed -- route admin-gate + RLS suffice.
--
-- Engine-side lineage: Regulatory-Review PR #117 (SIGNED service_kb_crosswalk
-- + policy_applicability_v2 + applicable_policy_proposer). The engine PROPOSES
-- candidates; the HITL reviewer confirms/edits the set in the M1b wizard; the
-- CONFIRMED set becomes the evaluator cohort verbatim and enters with
-- applicability_mode='off' (S14 invariant -- never re-dropped).

ALTER TABLE v2_projects
  ADD COLUMN IF NOT EXISTS applicable_policy_ids JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN v2_projects.applicable_policy_ids IS
  'HITL-CONFIRMED applicable-policy id list (engine v2 M1a). The engine PROPOSES candidates; the reviewer confirms/edits in the M1b wizard; this stored set becomes the evaluator cohort verbatim with applicability_mode=off (S14 invariant). Default [] = not yet confirmed.';

-- Verification:
--   SELECT column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'v2_projects'
--     AND column_name = 'applicable_policy_ids';
--   SELECT id, jsonb_typeof(applicable_policy_ids) AS apid_t FROM v2_projects LIMIT 5;
