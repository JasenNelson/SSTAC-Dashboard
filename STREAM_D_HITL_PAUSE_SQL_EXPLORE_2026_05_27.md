# Stream D HITL Pause -- Read-only Supabase Exploratory SQL

**Authored:** 2026-05-27 by Stream D autonomous session (Opus 4.7).
**Branch:** `feat/stream-d-catalog-agent-scaffold` (base SHA `9465013`).
**Sub-task:** 2 (Supabase exploratory SQL before drafting Sub-task 3 migration).
**Blocking status:** NON-BLOCKING. Sub-task 3 proceeds with conservative defaults if owner does not return in time. All assumptions are documented in the Sub-task 3 migration file header so the owner can correct on return.

---

## What you (owner) need to do

1. Open Supabase Studio for the SSTAC Dashboard project -> SQL Editor.
2. Copy the SQL block below (10 queries: Q1..Q10) into SQL Editor.
3. Run each query block separately; copy each result set.
4. Paste the results into the corresponding `<!-- Q1 -->` ... `<!-- Q10 -->` blocks in the OUTPUT section at the bottom of this file.
5. Commit + push this file with the OUTPUT filled in. Stream D (or the next session) will pick it up and refine the Sub-task 3 migration if any column / RLS shape differs from the conservative defaults.

All queries are read-only (SELECT only). They do not modify any data. A convenience copy also lives at `.tmp/stream-d-explore-queries.sql` (gitignored; not pushed).

---

## SQL block (copy below into Supabase Studio SQL Editor)

```sql
-- Stream D Sub-task 2: Read-only Supabase exploratory SQL
-- Purpose: surface live schema for the 5 existing catalog tables so the
-- catalog_extraction_staging migration (Sub-task 3) can match column names,
-- types, and RLS shape exactly.
-- Per L0 rule: explore-before-assume; zero assumptions about column types.
-- Author: Stream D autonomous session (Opus 4.7) 2026-05-27.
-- Branch: feat/stream-d-catalog-agent-scaffold @ base 9465013.

-- =============================================================================
-- Q1: Confirm the 5 expected catalog tables exist + their schemas
-- =============================================================================
SELECT table_schema, table_name
  FROM information_schema.tables
 WHERE table_name IN (
     'promoted_parameter_values',
     'parameter_value_reviews',
     'catalog_evidence_items',
     'catalog_sources',
     'source_lead_triage'
   )
 ORDER BY table_schema, table_name;

-- =============================================================================
-- Q2: Column shape for each catalog table (ordinal position preserved)
-- =============================================================================
SELECT table_schema,
       table_name,
       ordinal_position,
       column_name,
       data_type,
       udt_name,
       is_nullable,
       column_default,
       character_maximum_length
  FROM information_schema.columns
 WHERE table_name IN (
     'promoted_parameter_values',
     'parameter_value_reviews',
     'catalog_evidence_items',
     'catalog_sources',
     'source_lead_triage'
   )
 ORDER BY table_schema, table_name, ordinal_position;

-- =============================================================================
-- Q3: Table constraints (PK, UNIQUE, CHECK, FK) including CHECK clause text
-- =============================================================================
SELECT tc.table_schema,
       tc.table_name,
       tc.constraint_name,
       tc.constraint_type,
       cc.check_clause
  FROM information_schema.table_constraints tc
  LEFT JOIN information_schema.check_constraints cc
    ON tc.constraint_name = cc.constraint_name
   AND tc.constraint_schema = cc.constraint_schema
 WHERE tc.table_name IN (
     'promoted_parameter_values',
     'parameter_value_reviews',
     'catalog_evidence_items',
     'catalog_sources',
     'source_lead_triage'
   )
 ORDER BY tc.table_schema, tc.table_name, tc.constraint_type, tc.constraint_name;

-- =============================================================================
-- Q4: Foreign key column pairing (source column -> referenced column, ordinal-preserving)
--     Joins a second key_column_usage on the referenced side via
--     rc.unique_constraint_* and matches kcu.position_in_unique_constraint
--     to ref_kcu.ordinal_position, so composite FKs report correct pairings.
-- =============================================================================
SELECT kcu.table_schema,
       kcu.table_name,
       kcu.column_name,
       kcu.constraint_name,
       kcu.ordinal_position                AS source_position,
       ref_kcu.table_schema                AS referenced_schema,
       ref_kcu.table_name                  AS referenced_table,
       ref_kcu.column_name                 AS referenced_column,
       ref_kcu.ordinal_position            AS referenced_position,
       rc.update_rule,
       rc.delete_rule
  FROM information_schema.key_column_usage kcu
  JOIN information_schema.referential_constraints rc
    ON kcu.constraint_name = rc.constraint_name
   AND kcu.constraint_schema = rc.constraint_schema
  JOIN information_schema.key_column_usage ref_kcu
    ON ref_kcu.constraint_name   = rc.unique_constraint_name
   AND ref_kcu.constraint_schema = rc.unique_constraint_schema
   AND ref_kcu.ordinal_position  = kcu.position_in_unique_constraint
 WHERE kcu.table_name IN (
     'promoted_parameter_values',
     'parameter_value_reviews',
     'catalog_evidence_items',
     'catalog_sources',
     'source_lead_triage'
   )
 ORDER BY kcu.table_schema, kcu.table_name, kcu.constraint_name, kcu.ordinal_position;

-- =============================================================================
-- Q5: Indexes (including expression / partial / WHERE clauses)
-- =============================================================================
SELECT schemaname, tablename, indexname, indexdef
  FROM pg_indexes
 WHERE tablename IN (
     'promoted_parameter_values',
     'parameter_value_reviews',
     'catalog_evidence_items',
     'catalog_sources',
     'source_lead_triage'
   )
 ORDER BY schemaname, tablename, indexname;

-- =============================================================================
-- Q6a: RLS enabled flag (per-table)
-- =============================================================================
SELECT c.relname                          AS table_name,
       n.nspname                          AS table_schema,
       c.relrowsecurity                   AS rls_enabled,
       c.relforcerowsecurity              AS rls_forced
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE c.relname IN (
     'promoted_parameter_values',
     'parameter_value_reviews',
     'catalog_evidence_items',
     'catalog_sources',
     'source_lead_triage'
   )
 ORDER BY n.nspname, c.relname;

-- =============================================================================
-- Q6b: RLS policy text (one row per policy on each catalog table)
-- =============================================================================
SELECT schemaname,
       tablename,
       policyname,
       permissive,
       roles,
       cmd,
       qual,
       with_check
  FROM pg_policies
 WHERE tablename IN (
     'promoted_parameter_values',
     'parameter_value_reviews',
     'catalog_evidence_items',
     'catalog_sources',
     'source_lead_triage'
   )
 ORDER BY schemaname, tablename, policyname;

-- =============================================================================
-- Q7: Confirm user_roles role values currently in use (RLS gate baseline)
-- =============================================================================
SELECT DISTINCT role
  FROM public.user_roles
 ORDER BY role;

-- =============================================================================
-- Q8: Extension availability (gen_random_uuid + jsonb GIN if relevant)
-- =============================================================================
SELECT extname, extversion
  FROM pg_extension
 WHERE extname IN ('pgcrypto', 'uuid-ossp', 'btree_gin');

-- =============================================================================
-- Q9: Sanity check -- catalog_extraction_staging MUST NOT exist yet
-- (Sub-task 3 will create it; if a row comes back, Stream D pauses.)
-- =============================================================================
SELECT table_schema, table_name
  FROM information_schema.tables
 WHERE table_name = 'catalog_extraction_staging';
-- Expected: 0 rows.

-- =============================================================================
-- Q10: Confirm auth.users target table exists for FK references
-- =============================================================================
SELECT table_schema, table_name
  FROM information_schema.tables
 WHERE table_schema = 'auth'
   AND table_name = 'users';
-- Expected: 1 row.
```

---

## Why this is needed

Stream D Sub-task 3 drafts a new `catalog_extraction_staging` migration. Per the L0 `cross_project_supabase_protocol_explore_before_assume.md` standing rule, the migration must mirror the column types, constraints, and RLS shape of the existing 5 catalog tables. Only `promoted_parameter_values` has a migration file on disk (`supabase/migrations/20260527000003_promoted_parameter_values.sql`). The other 4 tables (`parameter_value_reviews`, `catalog_evidence_items`, `catalog_sources`, `source_lead_triage`) were applied directly through Supabase Studio SQL Editor without committing migration files. The autonomous session has zero on-disk source-of-truth for their column shape, constraints, or RLS without the owner running this exploratory SQL.

---

## What the autonomous session is doing in the meantime

Per Sub-task 2 spec: drafting Sub-task 3 migration with conservative defaults:

- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()` (pgcrypto)
- `TIMESTAMPTZ NOT NULL DEFAULT now()` for timestamp columns
- `JSONB NOT NULL` for `proposed_payload`
- `TEXT CHECK (... IN (...))` enums for `proposed_kind` and `hitl_status`
- RLS mirrors `promoted_parameter_values`: authenticated SELECT; admin / `matrix_admin` ALL
- FK on `auth.users(id)` for `created_by`, `hitl_reviewed_by`
- Indexes on `(hitl_status, extraction_pass_id)` and `(source_zotero_key)`

Subsequent sub-tasks 4..7 proceed in parallel and do not depend on this output. The session does not apply the migration; the owner pastes it into SQL Editor as a HITL action (see `STREAM_D_HITL_PAUSE_MIGRATION_APPLY_2026_05_27.md` when that artifact lands).

---

## OUTPUT (paste results below)

<!-- Q1: 5 expected catalog tables + schemas -->
```
(pending owner)
```

<!-- Q2: Column shape -->
```
(pending owner)
```

<!-- Q3: Constraints -->
```
(pending owner)
```

<!-- Q4: Foreign keys -->
```
(pending owner)
```

<!-- Q5: Indexes -->
```
(pending owner)
```

<!-- Q6a: RLS enabled flag (per-table) -->
```
(pending owner)
```

<!-- Q6b: RLS policy text -->
```
(pending owner)
```

<!-- Q7: user_roles role values -->
```
(pending owner)
```

<!-- Q8: extensions -->
```
(pending owner)
```

<!-- Q9: catalog_extraction_staging existence sanity check -->
```
(pending owner) -- expected: 0 rows
```

<!-- Q10: auth.users existence -->
```
(pending owner) -- expected: 1 row
```

---

## On return: owner action items

Once OUTPUT is filled in:

1. Compare actual `parameter_value_reviews`, `catalog_evidence_items`, `catalog_sources`, `source_lead_triage` column shapes against the conservative defaults used in `supabase/migrations/20260527000004_catalog_extraction_staging.sql`.
2. If divergences exist (e.g. different column type for FK to `auth.users`, different RLS role name), file a follow-up issue or directly amend the staging migration before pasting it into SQL Editor.
3. Apply the staging migration via Supabase Studio SQL Editor (see `STREAM_D_HITL_PAUSE_MIGRATION_APPLY_2026_05_27.md`).
4. Resolve this pause artifact (move to `docs/archive/` per archive-before-edit on resolution).
