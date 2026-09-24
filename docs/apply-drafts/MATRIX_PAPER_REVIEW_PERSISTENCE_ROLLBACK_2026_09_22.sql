-- =====================================================================
-- ROLLBACK for matrix_paper_review_persistence_DRAFT.sql (revision 5;
-- statements unchanged since revision 3 -- every object is dropped by name)
-- (revision 3 adds public.matrix_paper_review_utf16_length(text); earlier
-- copies kept as rollback_rev1.sql / rollback_rev2.sql)
-- DRAFT ONLY -- NOT APPLIED. Drops exactly the objects the forward
-- migration creates, in reverse dependency order.
--
-- WARNING: DESTRUCTIVE. Dropping the response and event tables deletes
-- every stored reviewer draft/submission and the write log. Before
-- running against a database that has received real responses, export
-- them (admin CSV export or a SELECT ... into a file) and get explicit
-- owner approval for this exact rollback.
--
-- MIGRATION HISTORY IS NOT TOUCHED. If the forward file was applied via
-- the Supabase CLI (supabase db push) or MCP apply_migration, a row for it
-- exists in supabase_migrations.schema_migrations and this rollback does
-- NOT remove it, so the recorded history will claim the migration is still
-- applied. Repairing that is a separate write that needs its own explicit
-- owner approval (and codex review of the exact command) -- do not run it
-- as part of this file. Candidate repair, owner-approval-only:
--   supabase migration repair --status reverted <version>
-- (or the equivalent single-row DELETE from
--  supabase_migrations.schema_migrations WHERE version = <version>,
--  after a read-only SELECT confirming exactly one matching row).
-- =====================================================================

BEGIN;

-- 7 / 6. Write RPCs.
DROP FUNCTION IF EXISTS public.matrix_paper_review_submit(text, text, text, text, text, integer);
DROP FUNCTION IF EXISTS public.matrix_paper_review_save_draft(text, text, text, text, text, integer);

-- 5. Append-only trigger, then its function.
DROP TRIGGER IF EXISTS matrix_paper_review_response_events_no_update
  ON public.matrix_paper_review_response_events;
DROP FUNCTION IF EXISTS public.matrix_paper_review_events_block_update();

-- 4. Event log (policies, indexes and identity sequence drop with it).
DROP TABLE IF EXISTS public.matrix_paper_review_response_events;

-- 3. Responses (policies, indexes, FK drop with it).
DROP TABLE IF EXISTS public.matrix_paper_review_responses;

-- 2. Reference table incl. the 12 seed rows.
DROP TABLE IF EXISTS public.matrix_paper_review_questions;

-- 1b. UTF-16 length helper. Dropped after the responses table, whose
--     CHECK constraints reference it.
DROP FUNCTION IF EXISTS public.matrix_paper_review_utf16_length(text);

-- 1. Helper. Dropped last: the policies that call it are already gone.
DROP FUNCTION IF EXISTS public.is_matrix_options_paper_admin();

COMMIT;
