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

**CONFIRMED 2026-05-28:** only 2 of the 5 expected catalog tables exist.

Owner-pasted Q1 result (information_schema.tables):

```
[
  { "table_schema": "public", "table_name": "parameter_value_reviews" },
  { "table_schema": "public", "table_name": "promoted_parameter_values" }
]
```

Stricter verification (pg_class direct lookup, bypasses information_schema
privilege filtering):

```
[
  { "schema_name": "public", "table_name": "parameter_value_reviews",
    "kind": "BASE TABLE", "rls_enabled": true },
  { "schema_name": "public", "table_name": "promoted_parameter_values",
    "kind": "BASE TABLE", "rls_enabled": true }
]
```

Decisive verification (UNION ALL COUNT(*) on all 5 tables):

```
ERROR 42P01: relation "public.catalog_evidence_items" does not exist
  LINE 3:   UNION ALL SELECT 'catalog_evidence_items', COUNT(*) FROM public.catalog_evidence_items
```

The statement aborted at the third UNION ALL branch, confirming
`public.catalog_evidence_items` truly does not exist. By extension (and
by the pg_class result above), `catalog_sources` and `source_lead_triage`
are also missing -- they share the same disposition.

**Missing tables (CONFIRMED):**

- `public.catalog_evidence_items` -- referenced by
  `src/lib/matrix-options/provenance/evidence-sync.ts` (insert / select /
  delete). All calls fail silently via the safe-fallback pattern (return
  `false`/`[]` on error). No data has ever been persisted.
- `public.catalog_sources` -- referenced by
  `src/lib/matrix-options/provenance/source-sync.ts`. Same silent-fail
  pattern.
- `public.source_lead_triage` -- referenced by
  `src/lib/matrix-options/provenance/triage-sync.ts`. Same.

**Impact on Stream D scaffold:**

- `catalog_approve_staging_row()` RPC's CASE branch for `proposed_kind =
  'evidence_item'` and `'source_lead'` will raise SQLSTATE 42P01
  "relation does not exist" at INSERT time. The CatalogStagingReview UI
  surfaces this verbatim in the red action-error banner; the staging row
  remains in `pending` (RPC rolled back; FOR UPDATE lock released).
- The default `proposed_kind = 'parameter_value'` works end-to-end today
  against the existing `public.promoted_parameter_values` table.

**Owner-driven follow-up:**

- Author migrations for the 3 missing tables based on the TypeScript row
  shapes in evidence-sync.ts / source-sync.ts / triage-sync.ts. The
  autonomous session did NOT do this because RLS policies, CHECK
  constraints, and indexes are owner judgment calls.

<!-- Q2: Column shape -->

**Confirmed:** `promoted_parameter_values` matches `supabase/migrations/20260527000003_promoted_parameter_values.sql` exactly (24 columns; `id UUID PK DEFAULT gen_random_uuid()`, `created_at` / `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`, `created_by UUID NULLABLE` FK to `auth.users`).

`parameter_value_reviews` columns (9 total, no on-disk migration exists; this is the live shape):

```
id                            uuid NOT NULL DEFAULT gen_random_uuid()
parameter_value_id            text NOT NULL
old_qa_status                 text NOT NULL
new_qa_status                 text NOT NULL
old_evidence_support_status   text NULL
new_evidence_support_status   text NULL
reviewer_note                 text NOT NULL DEFAULT ''
reviewed_by                   uuid NULL  (FK -> auth.users(id))
reviewed_at                   timestamptz NOT NULL DEFAULT now()
```

Recommendation for owner: author an on-disk migration for `parameter_value_reviews` matching this shape, so the schema is reproducible. (Lower priority than authoring migrations for the 3 missing tables.)

<!-- Q3: Constraints -->

Only auto-generated NOT NULL CHECKs + PKs + UNIQUEs + FKs:

- `parameter_value_reviews`: PK on `id`; FK `reviewed_by -> auth.users(id)`; NOT NULL CHECKs on id, parameter_value_id, old_qa_status, new_qa_status, reviewer_note, reviewed_at.
- `promoted_parameter_values`: PK on `id`; UNIQUE on `parameter_value_id`; FK `created_by -> auth.users(id)`; NOT NULL CHECKs on all non-nullable columns.

**No domain CHECK constraints** (no enum enforcement on `qa_status`, `default_status`, `evidence_support_status`, etc.) -- values are convention-only. Stream D's new staging migration adds explicit enum CHECKs which is stricter than the existing pattern.

<!-- Q4: Foreign keys -->

Two FK relationships, both single-column:

- `parameter_value_reviews.reviewed_by -> auth.users(id)` (NO ACTION on update/delete)
- `promoted_parameter_values.created_by -> auth.users(id)` (NO ACTION)

The Stream D staging migration follows the same pattern (`hitl_reviewed_by -> auth.users(id)`, `created_by -> auth.users(id)`).

<!-- Q5: Indexes -->

Only the PK and UNIQUE indexes exist:

- `parameter_value_reviews_pkey` (on id)
- `promoted_parameter_values_pkey` (on id)
- `promoted_parameter_values_parameter_value_id_key` (UNIQUE on parameter_value_id)

No additional functional indexes. The Stream D staging migration adds a partial index on `(extraction_pass_id) WHERE hitl_status = 'pending'` and a standalone index on `(source_zotero_key)`, which is stricter / more performant than the existing 2 tables.

<!-- Q6a: RLS enabled flag (per-table) -->

Both existing catalog tables have RLS enabled (and NOT forced, so service_role bypasses).

<!-- Q6b: RLS policy text -->

Both tables follow the same two-policy pattern:

- `"Admins can manage..."` -- FOR ALL, USING (user_roles admin or matrix_admin), no WITH CHECK.
- `"Authenticated users can read..."` -- FOR SELECT, USING (auth.role() = 'authenticated' OR true).

The Stream D staging table DEPARTS from this pattern: it has only the admin policy (no authenticated-read), because codex Sub-task 3 R1 flagged unapproved AI proposals as a tighter risk surface than promoted catalog rows. The departure is intentional and documented in the migration header. Owner should confirm this stricter posture is what they want for the staging queue.

<!-- Q7: user_roles role values -->

```
[ { "role": "admin" }, { "role": "member" } ]
```

**Note:** `matrix_admin` role exists in the `user_roles_role_check` CHECK constraint (per `supabase/migrations/20260519000002_matrix_map_rls.sql`) but has ZERO live members. The Stream D staging table + RPC both gate on `role IN ('admin', 'matrix_admin')` which is consistent with the existing pattern; current `admin` users pass the gate today, and the design is forward-compatible for `matrix_admin` provisioning later.

<!-- Q8: extensions -->

```
[ { "extname": "uuid-ossp", "extversion": "1.1" },
  { "extname": "pgcrypto",  "extversion": "1.3" } ]
```

`pgcrypto` provides `gen_random_uuid()`, used by both existing tables and by the Stream D staging migration. All good.

<!-- Q9: catalog_extraction_staging existence sanity check -->

Owner reported 0 rows (query echoed without result rows in the OUTPUT paste, which is the expected "no such table" shape from `information_schema.tables`). Safe to apply `supabase/migrations/20260527000004_catalog_extraction_staging.sql`.

<!-- Q10: auth.users existence -->

Owner reported 1 row (query echoed, expected shape). `auth.users` is present; FK targets in the Stream D staging migration are valid.

---

## On return: owner action items (UPDATED 2026-05-28 after OUTPUT in)

The OUTPUT surfaced a CRITICAL FINDING: 3 of the 5 expected catalog tables
(`catalog_evidence_items`, `catalog_sources`, `source_lead_triage`) do NOT
exist in Supabase. The TypeScript helpers that target them silently
no-op via safe-fallback. The Stream D RPC fails for two of the three
`proposed_kind` values until the missing tables are created.

Recommended sequence:

1. **Optional:** author on-disk migrations for the 3 missing tables based
   on the TypeScript type shapes in:
     - `src/lib/matrix-options/provenance/evidence-sync.ts` -> `catalog_evidence_items`
     - `src/lib/matrix-options/provenance/source-sync.ts`   -> `catalog_sources`
     - `src/lib/matrix-options/provenance/triage-sync.ts`   -> `source_lead_triage`
   This is owner-driven follow-up. The autonomous session did NOT author
   them because: (a) the TypeScript types may have drift relative to the
   intended schema; (b) RLS policies, CHECK constraints, and indexes are
   owner judgment calls; (c) the scaffold's promote path requires them
   only when `proposed_kind` is `evidence_item` or `source_lead` -- the
   default `parameter_value` kind works end-to-end today against the
   existing `promoted_parameter_values` table.
2. **Apply** `supabase/migrations/20260527000004_catalog_extraction_staging.sql`
   and `supabase/migrations/20260527000005_catalog_approve_staging_rpc.sql`
   via Supabase Studio SQL Editor (in order). Even without the 3 missing
   tables, the staging queue + approve RPC work for `parameter_value`
   kind; the other two kinds raise a clear "relation does not exist"
   error that the UI surfaces via the existing error path.
3. **Compare** the conservative defaults in the staging migration against
   the live shapes confirmed by Q2/Q3/Q4/Q5/Q6 above. The autonomous
   session's conservative defaults match the live `promoted_parameter_values`
   pattern, plus stricter additions (enum CHECKs, partial index,
   admin-only RLS, polymorphic discriminator). No amendments needed
   before applying.
4. **Resolve** this pause artifact (move to `docs/archive/` per archive-
   before-edit when fully addressed).

### Apply order (both migrations must land together)

The staging surface ships in TWO migration files; apply them in this order in
Supabase Studio SQL Editor:

1. `supabase/migrations/20260527000004_catalog_extraction_staging.sql` -- the
   `catalog_extraction_staging` table itself (Sub-task 3 deliverable).
2. `supabase/migrations/20260527000005_catalog_approve_staging_rpc.sql` -- the
   `catalog_approve_staging_row()` Postgres function that the HITL approve
   path calls. Added in Sub-task 5 after codex review surfaced a race in the
   client-side multi-statement approve flow; the RPC runs the
   SELECT FOR UPDATE + INSERT target + UPDATE staging steps in one
   transaction with row-level locking.

`src/lib/catalog/staging.ts::approveStagingRow()` calls the RPC directly;
without the RPC migration applied, every approve will fail with
"function catalog_approve_staging_row does not exist".
