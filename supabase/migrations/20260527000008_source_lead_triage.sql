-- =============================================================================
-- source_lead_triage: HITL triage state for source-lead candidate groups
-- =============================================================================
--
-- Purpose: persists triage verdicts on source-lead candidate groups (the
-- "candidates we have not yet promoted to canonical sources" surface in the
-- Evidence Library). One row per lead_set_id; upserted by admin actions.
--
-- Schema source-of-truth: `src/lib/matrix-options/provenance/triage-sync.ts`
-- (SourceLeadTriageRow interface + setTriageStatus upsert payload).
--
-- Author:   Stream D autonomous session (Opus 4.7), 2026-05-28.
-- Branch:   feat/stream-d-catalog-agent-scaffold.
-- Reason:   Stream D Sub-task 2 exploratory SQL confirmed this table does NOT
--           exist in Supabase. triage-sync.ts has been silently no-op-ing
--           via safe-fallback, so the source-lead triage workflow shipped
--           in commit 9465013 (Phase 5) has never actually persisted state.
--
-- HITL gate: owner pastes this migration into Supabase Studio SQL Editor.
--            Independent of the other Stream D migrations -- apply order is
--            flexible.
--
-- CHECK on triage_status: the TS code explicitly validates against a fixed
-- enum (VALID_TRIAGE_STATUSES in triage-sync.ts) AND coerces unknown values
-- to 'untriaged' on read. Adding the CHECK at the DB level is defense-in-
-- depth -- it costs nothing and prevents invalid values from ever landing.
-- The other Stream D tables (catalog_sources, catalog_evidence_items) and
-- the existing catalog tables (promoted_parameter_values, parameter_value_reviews)
-- do NOT have CHECK constraints on their TEXT enum-ish columns; triage_status
-- is the exception because its validation is the strictest (no other status
-- values are ever legal, today or in any future code path the TS surface
-- exposes).
--
-- RLS: matches the two-policy pattern (admin manage + authenticated read).
--
-- Pre-flight exploratory SQL (run BEFORE applying):
--
--   SELECT to_regclass('public.source_lead_triage') AS exists_already;
--   -- Expected: NULL.
--
--   SELECT COUNT(*) FROM public.user_roles WHERE role IN ('admin', 'matrix_admin');
--   -- Expected: >= 1.
--
-- =============================================================================

CREATE TABLE public.source_lead_triage (
  -- Surrogate primary key.
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Unique identifier of the source-lead candidate group being triaged.
  -- One row per lead_set_id; upserted on action.
  lead_set_id TEXT UNIQUE NOT NULL,

  -- Triage verdict. Application validates against the same enum on both read
  -- (mapper coerces unknowns to 'untriaged') and write (setTriageStatus
  -- rejects invalid status values pre-DB-call). CHECK below enforces it at
  -- the DB level too.
  triage_status TEXT NOT NULL DEFAULT 'untriaged',
  triage_note   TEXT NOT NULL DEFAULT '',

  -- Reviewer
  triaged_by UUID REFERENCES auth.users(id),
  triaged_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Updated_at separate from triaged_at because upserts may re-trigger
  -- on the same triage_status (e.g., admin edits the note without changing
  -- the verdict).
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT source_lead_triage_triage_status_check
    CHECK (triage_status IN ('untriaged', 'promoted', 'dismissed', 'deferred'))
);

COMMENT ON TABLE public.source_lead_triage IS
  'HITL triage state for source-lead candidate groups. One row per lead_set_id, upserted by admin actions. Read by the Evidence Library cross-pathway audit + source-lead triage views.';

COMMENT ON COLUMN public.source_lead_triage.lead_set_id IS
  'Stable identifier of the source-lead candidate group (e.g., "wqciu-reference-leads-2026-05-23"). UNIQUE; the upsert conflict key.';

COMMENT ON COLUMN public.source_lead_triage.triage_status IS
  'HITL verdict: untriaged (default; not yet reviewed) | promoted (advanced to canonical) | dismissed (rejected) | deferred (parked for later review). CHECK constraint enforces the enum at the DB level.';

COMMENT ON COLUMN public.source_lead_triage.triaged_by IS
  'auth.users id of the admin who issued the most recent triage verdict. Nullable for symmetry with the existing catalog tables (system or migration inserts may leave it NULL).';

-- Row-level security
ALTER TABLE public.source_lead_triage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage source lead triage"
  ON public.source_lead_triage
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
       WHERE user_id = auth.uid()
         AND role IN ('admin', 'matrix_admin')
    )
  );

CREATE POLICY "Authenticated users can read source lead triage"
  ON public.source_lead_triage
  FOR SELECT
  USING (auth.role() = 'authenticated');

REVOKE ALL ON public.source_lead_triage FROM anon;
