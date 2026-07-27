# Option C - Pre-Apply Runbook (2026-07-26)

**Status: AUTHORITATIVE procedure. NOT an authorization.**

## 0. This procedure is OWNER-RUN. Never Claude-run.

Every command in sections 3 through 6 is executed by the owner, or by someone the
owner has explicitly designated, against the live Supabase project. No AI session
runs any of them. This is not a formality and it is not waivable by a code review:

- Applying this SQL is owner decision **D2**, and D2 is **NOT AUTHORIZED** as of
  this document's date.
- A GREEN `/codex-review` on the SQL does not authorize the apply. Review
  establishes that the bytes are defensible; only the owner authorizes execution.
- The repository rule that AI must never write verdicts or perform unapproved
  live writes is not suspended by this runbook's existence.

An AI session may: assemble this evidence, run the OFFLINE replay (section 2),
and report. It may not connect to the live project to apply anything here.

## 1. What gets applied, and its exact identity

Single artifact:

| Field | Value |
|---|---|
| Path | `docs/design/matrix-map/OPTION_C_PHASE2_SITE_AGGREGATE_PUBLICATIONS_DRAFT_2026_07_24.sql` |
| Bytes | 38954 |
| SHA-256 | `AEE9F8A29CDB241D32D1A69E443CFC93364FFFADB96B288556B5CF28C90EF028` |

Verify before doing anything else:

```
# PowerShell, from the repository root
(Get-FileHash -Algorithm SHA256 `
  docs/design/matrix-map/OPTION_C_PHASE2_SITE_AGGREGATE_PUBLICATIONS_DRAFT_2026_07_24.sql).Hash
```

If the hash differs from the table above, **STOP**. The bytes are not the
reviewed bytes. Re-run review and re-issue this runbook with the new hash. Do not
"eyeball the diff and proceed".

This file is a **design/publication primitive**, NOT an applied append-only
migration under `supabase/migrations/`. Applying it does not make it a migration
and does not exempt it from the append-only rule that governs that directory.

## 2. MANDATORY precondition: the offline replay must be GREEN

The apply is blocked until the offline PostGIS replay has been run against these
exact bytes and returned GREEN. This is a gate, not a suggestion.

```
# PowerShell, from the repository root. Bound it externally -- the harness
# implements no internal timeout (see the note in its header).
pwsh -File scripts/matrix-map/validation/option-c-phase2/replay-migrations-postgis.ps1 `
  -OutputDir <a path OUTSIDE any worktree> `
  -RepoRoot  <this repository root>
```

Acceptance, read from `<OutputDir>/migration_replay_summary.json` and
`<OutputDir>/test_receipt.json`:

| Field | Required value |
|---|---|
| `overall_status` | `COMPLETED_GREEN` |
| `failed_tests` | `0` |
| `strict_pass` | `true` |
| `missing_test_ids` | empty |
| `passed_tests` | at least 16 |

Read `test_results.txt` and confirm the assertion log is **non-empty** and every
`TEST_*` line reads `PASS`. An exit code of 0 is not acceptance on its own.

The harness requires Docker and a locally present pinned PostGIS image. It fails
closed if the image is absent and never pulls one.

## 3. Read-only preflight (owner, against live)

Run these first. All are read-only; none mutates anything. Record the output.

```sql
-- 3.1 Do the Option C objects already exist? (expect the pre-apply state you think you are in)
SELECT p.proname
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'matrix_map'
  AND p.proname IN (
    'site_aggregate_count_bucket','enforce_site_aggregate_publication_via_rpc',
    'fetch_published_site_aggregates','fetch_admin_site_aggregate_publications',
    'fetch_site_aggregate_publication_audit','canonical_five_decimal_cluster',
    'current_site_aggregate_snapshot','lock_site_aggregate_publication_sources',
    'flip_site_aggregate_public','upsert_site_aggregate_candidate',
    'fetch_site_aggregate_candidate_audit')
ORDER BY 1;

-- 3.2 Baseline the visibility invariant you must not change.
SELECT count(*) FILTER (WHERE public) AS public_dras, count(*) AS total_dras
FROM matrix_map.dras WHERE is_deleted = false;

SELECT count(*) FILTER (WHERE public) AS public_samples, count(*) AS total_samples
FROM matrix_map.samples;

-- 3.3 Existing publications, if any.
SELECT count(*) FILTER (WHERE is_published) AS published, count(*) AS total
FROM matrix_map.site_aggregate_publications;
```

Record 3.2's numbers. They are the invariant: **applying this SQL must not change
`dras.public` or `samples.public` for any row.**

## 4. Apply (owner only)

Apply the exact verified file. Do not retype it, do not apply a fragment, and do
not interleave it with other statements.

Stop immediately and do not continue to section 5 if:

- any statement errors;
- the output mentions an object you did not expect from section 3.1;
- you are prompted for a credential you did not intend to use;
- the connection is not the one you intended.

## 5. Read-only postflight (owner, against live)

```sql
-- 5.1 All eleven functions now present.
--     (Same query as 3.1; expect the full set.)

-- 5.2 THE INVARIANT. These must match section 3.2 EXACTLY.
SELECT count(*) FILTER (WHERE public) AS public_dras, count(*) AS total_dras
FROM matrix_map.dras WHERE is_deleted = false;

SELECT count(*) FILTER (WHERE public) AS public_samples, count(*) AS total_samples
FROM matrix_map.samples;

-- 5.3 No publication was silently flipped by the apply.
SELECT count(*) FILTER (WHERE is_published) AS published, count(*) AS total
FROM matrix_map.site_aggregate_publications;

-- 5.4 The member projection is still owner-restricted and member-safe.
SELECT proname, proacl
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'matrix_map' AND proname = 'fetch_published_site_aggregates';
```

If 5.2 differs from 3.2 in any way, treat it as an incident: stop, do not
publish anything, and surface it. A publication primitive that moved DRA or
sample visibility has violated its core contract.

## 6. What this runbook does NOT authorize

- It does not authorize **publishing** any aggregate. Applying the DDL and
  flipping a publication are separate acts; the second is its own owner decision.
- It does not authorize any change to `dras.public` or `samples.public`.
- It does not authorize an AI session to run any of section 3 to 6.

## 7. Why there is no CI job for the replay (explicitly deferred)

Verified, not assumed:

- `git ls-tree origin/main -- scripts/matrix-map/validation/` returns **empty**.
  The harness does not exist on the default branch at all, so no workflow on
  `main` could invoke it.
- The harness is Windows/PowerShell and requires a local Docker daemon plus a
  locally pre-pulled pinned image, failing closed when the image is absent and
  never pulling. It cannot run as written on a standard Linux runner.

Wiring it into CI is therefore a separate piece of work with its own design
(portability, image provisioning, runner cost), deliberately out of scope here.
Until then the replay is a **local, owner-or-session-run gate** whose evidence is
attached to the PR, and this runbook is the thing that makes it mandatory.
