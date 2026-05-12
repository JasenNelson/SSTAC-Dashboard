# engine_v2 schema notes (Lane 1)

Companion to `supabase/engine_v2/database_schema_engine_v2_patch.sql`. Captures the non-obvious
invariants and the design rationale behind specific columns/indexes/triggers. Aligned with the
canonical plan at `docs/engine_v2_frontend_lane1_plan_v7.19.md`.

## Core invariants

- **Admin gating at two layers (route + RLS).** Every Lane 1 RLS policy on the three tables AND on
  `storage.objects` for the `v2-submissions` bucket requires BOTH ownership (`auth.uid()` matches
  the project owner, or the storage path's first segment matches `auth.uid()::text`) AND admin role
  (`user_roles.role = 'admin'`). Route-level `requireAdminForApi` alone is insufficient; non-admins
  could otherwise INSERT via direct Supabase REST.

- **No service-role usage in Lane 1.** All storage operations (INSERT via TUS, SELECT via auth
  client, DELETE via auth client) go through the authenticated server client. The DELETE RLS
  policy permits owner+admin to delete their own objects.

- **v2_submission_files.id is the TUS client-supplied file_id** (Finding 58). NOT auto-generated.
  Same value appears in `storage_path` (`<user_id>/<project_id>/<id>/<id>.<ext>`), local
  materialization filename (`<id>.<ext>`), and the AMBIGUOUS-path /files/exists polling query.

## Concurrency-critical indexes

- `idx_v2_submission_files__active_sha` (UNIQUE, partial WHERE `deleted_at IS NULL`): supports the
  INSERT-first race-safe duplicate-SHA pattern at /files/complete step 11 (Finding 4). A 23505 on
  this index means another concurrent request finalized the same content first.

- `idx_v2_extraction_runs__one_active` (UNIQUE, partial WHERE status NOT IN terminal): supports
  the race-safe extract idempotency pattern at /extract step 6 (Finding 5). A 23505 on this index
  means an extraction is already running for the project; the route returns HTTP 409 with the
  existing run_id.

## Trigger: enforce_project_caps_v2

`BEFORE INSERT` on `v2_submission_files`. Acquires `pg_advisory_xact_lock(hashtext('v2_proj_cap_'
|| project_id))` to serialize per-project cap checks (Finding 23). Reads max_files/max_total_bytes
from v2_projects; reads current count + sum(size_bytes) of active files; raises ERRCODE 23514 on
cap violation. Lock auto-releases on transaction commit/rollback. Different-project inserts
proceed concurrently.

Application-level pre-flight cap check at /files/complete step 10 is UX-only; the trigger is
authoritative.

## Named CHECK constraint

`v2_extraction_runs_status_check` is named explicitly in CREATE TABLE. The defensive `DROP
CONSTRAINT IF EXISTS` + `ADD CONSTRAINT` migrates ONLY a prior named variant; UNNAMED prior CHECKs
must be dropped manually at the L1-1 EXIT GATE clean-slate step (Finding 51). Postgres auto-named
unnamed CHECKs use a `<table>_<column>_check` convention that MAY or MAY NOT match the named one
across versions.

## Clean-slate gate (L1-1 EXIT GATE)

Owner runs:
```sql
SELECT to_regclass('public.v2_projects'),
       to_regclass('public.v2_submission_files'),
       to_regclass('public.v2_extraction_runs');
```
All three MUST return null before applying the patch. If any return non-null, drop CASCADE before
running the patch.

## Rollback

To roll back the schema entirely:
```sql
DROP TRIGGER IF EXISTS trg_enforce_project_caps_v2 ON v2_submission_files;
DROP FUNCTION IF EXISTS enforce_project_caps_v2();
DROP POLICY IF EXISTS v2_submissions_insert ON storage.objects;
DROP POLICY IF EXISTS v2_submissions_select ON storage.objects;
DROP POLICY IF EXISTS v2_submissions_delete ON storage.objects;
DROP TABLE IF EXISTS v2_extraction_runs CASCADE;
DROP TABLE IF EXISTS v2_submission_files CASCADE;
DROP TABLE IF EXISTS v2_projects CASCADE;
```
Storage objects in the `v2-submissions` bucket are cleared separately via Supabase Storage API.
