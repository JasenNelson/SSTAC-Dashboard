-- =====================================================================
-- Migration: matrix_map.sample_events event_date nullable (D-dates Option B)
-- =====================================================================
-- Append-only migration. Do NOT edit any existing migration file.
--
-- CONTEXT (D-dates Option B):
-- The original matrix_map schema (20260519000001_matrix_map_schema.sql,
-- SECTION 3) declared sample_events.event_date as 'date NOT NULL'. A large
-- slice of the source sediment-chemistry corpus has no recorded sampling
-- date. Under the NOT NULL constraint those undated measurements cannot be
-- loaded at all, which silently drops roughly 6,742 additional
-- measurements from the map.
--
-- Option B relaxes the constraint instead of imputing fake dates: undated
-- rows load with event_date IS NULL and are explicitly tagged via a new
-- date_precision column set to 'undated'. Dated rows keep their real
-- event_date and default to date_precision = 'exact'. This preserves data
-- honesty (no fabricated dates), keeps the undated rows queryable, and
-- lets downstream UI / stats logic filter or annotate by precision.
--
-- This migration is additive and backward-compatible:
--   1. Existing dated rows are untouched (event_date stays populated).
--   2. The new date_precision column defaults to 'exact' NOT NULL, so all
--      pre-existing rows are stamped 'exact' automatically.
--   3. The ETL loader sets date_precision = 'undated' (and event_date NULL)
--      for undated source measurements going forward.
--
-- PRE-FLIGHT (read-only; per Supabase explore-before-assume rule):
-- Owner should run this SELECT in the Supabase SQL Editor BEFORE applying,
-- to confirm current column state and that date_precision does not yet
-- exist, and to see how many rows currently have a NULL event_date (should
-- be 0 before this migration, since the column is still NOT NULL):
--
--   SELECT
--     (SELECT is_nullable
--        FROM information_schema.columns
--       WHERE table_schema = 'matrix_map'
--         AND table_name   = 'sample_events'
--         AND column_name  = 'event_date')                  AS event_date_is_nullable,
--     EXISTS (SELECT 1
--               FROM information_schema.columns
--              WHERE table_schema = 'matrix_map'
--                AND table_name   = 'sample_events'
--                AND column_name  = 'date_precision')        AS date_precision_exists,
--     (SELECT count(*) FROM matrix_map.sample_events)        AS total_rows,
--     (SELECT count(*) FROM matrix_map.sample_events
--       WHERE event_date IS NULL)                            AS null_event_date_rows;
--
-- Expected before apply: event_date_is_nullable = 'NO',
-- date_precision_exists = false, null_event_date_rows = 0.
-- =====================================================================

-- 1. Relax the NOT NULL constraint so undated measurements can load.
ALTER TABLE matrix_map.sample_events
  ALTER COLUMN event_date DROP NOT NULL;

-- 2. Add an explicit date-precision tag. Defaults to 'exact' so every
--    existing (dated) row is stamped 'exact'; the ETL sets 'undated' for
--    rows loaded with a NULL event_date.
ALTER TABLE matrix_map.sample_events
  ADD COLUMN IF NOT EXISTS date_precision text NOT NULL DEFAULT 'exact'
    CHECK (date_precision IN ('exact', 'undated'));

COMMENT ON COLUMN matrix_map.sample_events.event_date IS
  'Sampling visit date. Nullable as of D-dates Option B: undated source '
  'measurements load with event_date NULL and date_precision = ''undated''. '
  'Dated rows keep their real date with date_precision = ''exact''.';

COMMENT ON COLUMN matrix_map.sample_events.date_precision IS
  'Tag for event_date provenance: ''exact'' = a real recorded sampling '
  'date is present; ''undated'' = no date in the source, event_date is '
  'NULL. Lets UI / Selection Stats filter or annotate undated observations '
  '(D-dates Option B; enables loading ~6,742 additional undated '
  'measurements).';

-- 3. Tie the precision tag to the date so undated rows cannot be silently
--    misclassified as 'exact' (the column default). A NULL event_date MUST be
--    'undated', and a present event_date MUST be 'exact'. Existing dated rows
--    (all 'exact' with a real date) satisfy this; a bad undated load that omits
--    date_precision (defaulting to 'exact' with a NULL date) fails instead.
ALTER TABLE matrix_map.sample_events
  ADD CONSTRAINT sample_events_date_precision_matches_date
    CHECK ((event_date IS NULL) = (date_precision = 'undated'));
