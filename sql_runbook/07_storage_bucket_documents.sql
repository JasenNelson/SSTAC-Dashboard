-- ============================================================================
-- BATCH 7: Storage bucket 'documents'. Creates the Supabase Storage bucket the
--   TWG upload route writes to before inserting the review_files row. No repo SQL
--   creates it. (Prefer the Studio UI: Storage -> New bucket -> 'documents' ->
--   leave PRIVATE -> Create. The SQL below is the equivalent.)
-- Idempotent: safe to run even if already applied (ON CONFLICT (id) DO NOTHING).
-- Needed-if: STEP 0 probe 1i returns 0 rows AND you will demo file upload at /twg/review.
-- STORAGE RLS CAVEAT: the repo defines NO storage.objects policies for this bucket.
--   If uploads 500 with a row-level-security error AFTER the bucket exists, add
--   storage policies via the dashboard (Storage -> Policies -> 'documents' ->
--   allow authenticated INSERT and SELECT). This runbook does not author storage
--   policies (none exist in the repo to copy; the shape is an access-control decision).
-- Source: DEMO_BLOCKER_RESOLUTION_KIT_2026_06_04.md Remedy F (verbatim SQL form).
-- ============================================================================

-- Remedy F: create the 'documents' storage bucket the TWG upload route writes to.
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;
