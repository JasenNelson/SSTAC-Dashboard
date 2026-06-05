-- engine_v2 frontend Lane 1 schema patch.
-- See plan: C:\Projects\SSTAC-Dashboard\docs\engine_v2_frontend_lane1_plan_v7.19.md
-- This patch is idempotent on fresh apply. Defensive ALTERs cover partial-schema cases but are NOT
-- a full migration tool. The L1-1 EXIT GATE requires clean-slate confirmation: run
--   SELECT to_regclass('public.v2_projects'),
--          to_regclass('public.v2_submission_files'),
--          to_regclass('public.v2_extraction_runs');
-- All three MUST return null before applying. If any return non-null, drop those tables CASCADE
-- FIRST. UNNAMED CHECK constraints from earlier partial schema must also be dropped manually.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- v2_projects: per-admin owner; admin enforced at BOTH route layer AND RLS.
CREATE TABLE IF NOT EXISTS v2_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  application_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  selected_services JSONB NOT NULL DEFAULT '[]'::jsonb,
  media_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  applicable_policy_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  submission_context_overrides JSONB NOT NULL DEFAULT '{}'::jsonb,
  applicability_mode TEXT NOT NULL DEFAULT 'off',
  evaluation_backend TEXT NOT NULL DEFAULT 'stub',
  embedder_backend TEXT NOT NULL DEFAULT 'stub',
  reranker_backend TEXT NOT NULL DEFAULT 'disabled',
  model TEXT,
  max_files INTEGER NOT NULL DEFAULT 50,
  max_total_bytes BIGINT NOT NULL DEFAULT 524288000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Defensive (Finding 31): ensure v7.x cap columns exist if v2_projects pre-dates them.
ALTER TABLE v2_projects ADD COLUMN IF NOT EXISTS max_files INTEGER NOT NULL DEFAULT 50;
ALTER TABLE v2_projects ADD COLUMN IF NOT EXISTS max_total_bytes BIGINT NOT NULL DEFAULT 524288000;
-- Defensive (M1a Phase 2): ensure applicable_policy_ids exists if v2_projects pre-dates it
-- (canonical add: supabase/migrations/20260604_v2_projects_applicable_policy_ids.sql).
ALTER TABLE v2_projects ADD COLUMN IF NOT EXISTS applicable_policy_ids JSONB NOT NULL DEFAULT '[]'::jsonb;

-- v2_submission_files: id is the TUS client-supplied file_id (Finding 58); NOT auto-generated.
CREATE TABLE IF NOT EXISTS v2_submission_files (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES v2_projects(id) ON DELETE CASCADE,
  original_filename TEXT NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,
  size_bytes BIGINT NOT NULL,
  mime_type TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_v2_submission_files__active_sha
  ON v2_submission_files (project_id, sha256) WHERE deleted_at IS NULL;

-- v2_extraction_runs with named status CHECK constraint (Findings 39, 44).
CREATE TABLE IF NOT EXISTS v2_extraction_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES v2_projects(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CONSTRAINT v2_extraction_runs_status_check
    CHECK (status IN ('pending', 'extracting', 'completed', 'completed_with_errors', 'error')),
  total_files INTEGER NOT NULL DEFAULT 0,
  completed_files INTEGER NOT NULL DEFAULT 0,
  current_file TEXT,
  progress INTEGER NOT NULL DEFAULT 0,
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  chunk_progress TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ NULL
);
CREATE INDEX IF NOT EXISTS idx_v2_extraction_runs__project_started
  ON v2_extraction_runs (project_id, started_at DESC);

-- Defensive (Findings 39, 44): ensure v7.x columns + named CHECK on v2_extraction_runs.
-- These are no-ops on fresh CREATE TABLE above; migration-safe for prior partial schema.
ALTER TABLE v2_extraction_runs ADD COLUMN IF NOT EXISTS current_file TEXT;
ALTER TABLE v2_extraction_runs ADD COLUMN IF NOT EXISTS chunk_progress TEXT;
ALTER TABLE v2_extraction_runs ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ NULL;

-- Finding 51: DROP IF EXISTS by name only matches the named v7.x constraint; UNNAMED prior CHECK
-- constraints must be dropped manually per the EXIT GATE clean-slate gate.
ALTER TABLE v2_extraction_runs DROP CONSTRAINT IF EXISTS v2_extraction_runs_status_check;
ALTER TABLE v2_extraction_runs ADD CONSTRAINT v2_extraction_runs_status_check
  CHECK (status IN ('pending', 'extracting', 'completed', 'completed_with_errors', 'error'));

-- Race-safe extract idempotency (Finding 5): only one non-terminal run per project at a time.
CREATE UNIQUE INDEX IF NOT EXISTS idx_v2_extraction_runs__one_active
  ON v2_extraction_runs (project_id)
  WHERE status NOT IN ('completed', 'completed_with_errors', 'error');

-- Cap-enforcement trigger (Finding 23): atomic per-project cap via advisory lock.
CREATE OR REPLACE FUNCTION enforce_project_caps_v2() RETURNS TRIGGER AS $$
DECLARE
  v_count INTEGER;
  v_sum BIGINT;
  v_max_files INTEGER;
  v_max_total_bytes BIGINT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('v2_proj_cap_' || NEW.project_id::text));
  SELECT max_files, max_total_bytes INTO v_max_files, v_max_total_bytes
    FROM v2_projects WHERE id = NEW.project_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'parent v2_projects row not found' USING ERRCODE = '23503';
  END IF;
  SELECT count(*), COALESCE(sum(size_bytes), 0) INTO v_count, v_sum
    FROM v2_submission_files
    WHERE project_id = NEW.project_id AND deleted_at IS NULL;
  IF v_count + 1 > v_max_files THEN
    RAISE EXCEPTION 'project file count cap exceeded (% files; limit %)', v_count + 1, v_max_files
      USING ERRCODE = '23514';
  END IF;
  IF v_sum + NEW.size_bytes > v_max_total_bytes THEN
    RAISE EXCEPTION 'project total bytes cap exceeded (% bytes; limit %)', v_sum + NEW.size_bytes, v_max_total_bytes
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_project_caps_v2 ON v2_submission_files;
CREATE TRIGGER trg_enforce_project_caps_v2
  BEFORE INSERT ON v2_submission_files
  FOR EACH ROW EXECUTE FUNCTION enforce_project_caps_v2();

-- RLS: every policy requires BOTH ownership AND admin role.

ALTER TABLE v2_projects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS v2_projects_owner_admin_all ON v2_projects;
CREATE POLICY v2_projects_owner_admin_all ON v2_projects FOR ALL TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

ALTER TABLE v2_submission_files ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS v2_submission_files_owner_admin_all ON v2_submission_files;
CREATE POLICY v2_submission_files_owner_admin_all ON v2_submission_files FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM v2_projects p WHERE p.id = v2_submission_files.project_id AND p.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM v2_projects p WHERE p.id = v2_submission_files.project_id AND p.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

ALTER TABLE v2_extraction_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS v2_extraction_runs_owner_admin_all ON v2_extraction_runs;
CREATE POLICY v2_extraction_runs_owner_admin_all ON v2_extraction_runs FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM v2_projects p WHERE p.id = v2_extraction_runs.project_id AND p.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM v2_projects p WHERE p.id = v2_extraction_runs.project_id AND p.user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- storage.objects RLS for v2-submissions bucket: INSERT, SELECT, DELETE each require BOTH
-- ownership (path starts with auth.uid() and project_id matches owner) AND admin role.

DROP POLICY IF EXISTS v2_submissions_insert ON storage.objects;
CREATE POLICY v2_submissions_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'v2-submissions'
    AND split_part(name, '/', 1) = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM v2_projects p
      WHERE p.id::text = split_part(name, '/', 2) AND p.user_id = auth.uid()
    )
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS v2_submissions_select ON storage.objects;
CREATE POLICY v2_submissions_select ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'v2-submissions'
    AND split_part(name, '/', 1) = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM v2_projects p
      WHERE p.id::text = split_part(name, '/', 2) AND p.user_id = auth.uid()
    )
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS v2_submissions_delete ON storage.objects;
CREATE POLICY v2_submissions_delete ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'v2-submissions'
    AND split_part(name, '/', 1) = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM v2_projects p
      WHERE p.id::text = split_part(name, '/', 2) AND p.user_id = auth.uid()
    )
    AND EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- GRANTs: re-run the all-tables grant pattern after CREATE TABLE statements.
GRANT SELECT, INSERT, UPDATE, DELETE ON v2_projects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON v2_submission_files TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON v2_extraction_runs TO authenticated;
