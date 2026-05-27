-- Promoted parameter values: persists source-lead promotions from the
-- Evidence Library. Apply when ready to migrate from localStorage to
-- Supabase persistence.
--
-- Pre-flight exploratory SQL (run BEFORE applying):
--
--   SELECT table_name FROM information_schema.tables
--     WHERE table_schema = 'public'
--     AND table_name = 'promoted_parameter_values';
--   -- Expected: 0 rows
--
--   SELECT COUNT(*) FROM public.user_roles WHERE role = 'admin';
--   -- Expected: >= 1 (admin users exist for RLS)

CREATE TABLE public.promoted_parameter_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parameter_value_id TEXT UNIQUE NOT NULL,
  substance_key TEXT NOT NULL DEFAULT '',
  pathway TEXT NOT NULL DEFAULT 'eco-direct-eqp',
  input_key TEXT NOT NULL DEFAULT '',
  display_name TEXT NOT NULL,
  value TEXT NOT NULL DEFAULT '',
  unit TEXT NOT NULL DEFAULT '',
  value_type TEXT NOT NULL DEFAULT 'single_value',
  candidate_group_id TEXT NOT NULL,
  default_status TEXT NOT NULL DEFAULT 'available_option',
  evidence_support_status TEXT NOT NULL DEFAULT 'pending_source_locator',
  extraction_status TEXT NOT NULL DEFAULT 'pending_extraction',
  qa_status TEXT NOT NULL DEFAULT 'needs_review',
  source_ids TEXT[] NOT NULL DEFAULT '{}',
  equation_ids TEXT[] NOT NULL DEFAULT '{}',
  jurisdiction TEXT NOT NULL DEFAULT '',
  applicability TEXT NOT NULL DEFAULT '',
  uncertainty TEXT,
  review_notes TEXT NOT NULL DEFAULT '',
  audit_history JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.promoted_parameter_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage promoted values"
  ON public.promoted_parameter_values
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'matrix_admin')
    )
  );

CREATE POLICY "Authenticated users can read promoted values"
  ON public.promoted_parameter_values
  FOR SELECT
  USING (auth.role() = 'authenticated');

REVOKE ALL ON public.promoted_parameter_values FROM anon;
