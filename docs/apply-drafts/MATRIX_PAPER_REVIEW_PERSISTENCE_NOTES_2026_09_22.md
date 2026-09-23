# matrix_paper_review_responses -- migration draft notes

Status: DRAFT. Nothing in this folder has been applied to any database. No file was created
under `supabase/migrations/`. Applying needs (per SSTAC CLAUDE.md Supabase Protocol rule 2):
GREEN `/codex-review` on the exact SQL, owner flag + explicit owner approval for this exact
write, and an owner-named authorization if MCP `apply_migration` is the tool used.
The SQL has NOT been executed anywhere (no local Postgres; Docker daemon not running), so it is
syntax-reviewed by reading only. Recommended: run it first on a disposable Supabase branch.

REPOSITORY COPY (2026-09-22): these notes and the three SQL files live in `docs/apply-drafts/` as
`MATRIX_PAPER_REVIEW_PERSISTENCE_{DRAFT,ROLLBACK,VERIFY}_2026_09_22.sql`, byte-identical to the
reviewed files (hashes below). They are deliberately NOT under `supabase/migrations/` yet: the
project has Supabase branching enabled, so a migration file merged to main may be applied to
production by the GitHub integration -- merging a UI PR must never perform an unapproved schema
write. APPLY STEP (owner-approved only): copy the DRAFT bytes unchanged into
`supabase/migrations/<timestamp>_matrix_paper_review_persistence.sql` in the same change that applies
them, confirm the sha256 below, apply, run the VERIFY file, and record the applied version.
References below to `matrix_paper_review_persistence_DRAFT.sql`, `rollback.sql`,
`verify_readonly.sql` and `historical/` are the review-workspace names of the same files.

CANONICAL APPLY CANDIDATE (revision 5; the only file to apply):
- `matrix_paper_review_persistence_DRAFT.sql` -- forward migration, one transaction.
  sha256 67e957c272ef1e2100676b8196ee32d4bcdf02c9fd1972fbc149062161437d00
- `rollback.sql` sha256 5526b1278ce5b1619508f76e093b5048174c8e1d215afa2f91a0212a9db6b2bc
- `verify_readonly.sql` sha256 cf4b333362ceb2a4bf2cc03a5ecdb911767ab4201acf90783fd4977bfdf945ff
HISTORICAL (superseded, never apply): everything under `historical/` (revision 1 and 2 SQL,
rollback and verify files). Sections below that describe revision 1 are superseded by the
Revision 2, 3, 4 and 5 sections at the end.

Files:
- `rollback.sql` -- drops exactly what the forward migration creates, reverse order (destructive).
- `verify_readonly.sql` -- SELECT-only post-apply checks with expected results.
- `compute-seed.cjs`, `compute-admin-trusted.cjs`, `server-only-stub.cjs` -- read-only helpers
  used to compute the seed (section 2). They import repo source; they modify nothing.

## 1. Live-DB facts used (read-only MCP catalog queries, 2026-09-22)

- PostgreSQL 17.4. `pgcrypto` lives in schema `extensions`; the SQL uses only core
  `gen_random_uuid()` and `sha256()` (pg_catalog), so no extension or search_path dependency.
- `public.user_roles`: `id bigint`, `user_id uuid NOT NULL -> auth.users(id)`, `role text`
  with CHECK `role IN ('admin','member','matrix_admin')`, UNIQUE `(user_id, role)`.
- `public.is_admin()` exists: `LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public,
  pg_temp`, owner postgres, checks role = 'admin' only. The new helper mirrors its shape and adds
  'matrix_admin' (matching `PAPER_ADMIN_ROLES` and the existing matrix_map / catalog policies,
  which inline `role = ANY (ARRAY['admin','matrix_admin'])`).
- `user_roles` RLS includes "Users can read own role" (so `getPaperAdminAccess` works for the
  caller) and admin policies via `is_admin()`.
- `pg_default_acl` for schema public grants ALL on new tables/sequences and EXECUTE on new
  functions to `anon`, `authenticated`, `service_role`. The migration therefore REVOKEs
  explicitly on every object instead of relying on defaults.
- No `matrix_paper%` tables or functions exist today (matches the prior finding that Save Draft
  is greyed because the backing objects are missing).

## 2. Seed values and how they were computed

Command (from any shell; no repo source modified; `tsx` is not installed in the worktree and
`npx tsx` would download from the network, so the installed `jiti` 2.5.1 was used with an alias
that stubs `server-only`):

    node C:\Projects\SSTAC-Dashboard-worktrees\mo-paper-impeccable-20260922\.tmp\run-mo-paper-impeccable-20260922\sql\compute-seed.cjs

It calls `getReviewManifest()` from `src/lib/matrix-options/paper/review-manifest.ts` and joins
`cohorts-v1.json` (`src/lib/matrix-options/paper/contracts/`) to `reviewer-guide-v1.json` on
`number`. Result:

- documentVersion: `1.0.11-remediated-7-8-successor-20260918-D`
- manifest sha256: `5d83a3c9ba78e4da234c70678fcf57db9abbefc189002303879ebc0c80ac926e`

Cross-check: `compute-admin-trusted.cjs` runs the admin guard's independent
`getTrustedPaperReviewIdentity()` (loads and authenticates the paper file) and printed the same
version and the same sha256.

| # | cohort_id | question_id |
|---|---|---|
| 1 | categories | rpq:1.0.11-remediated-7-8-successor-20260918-D:q01 |
| 2 | categories | rpq:1.0.11-remediated-7-8-successor-20260918-D:q02 |
| 3 | categories | rpq:1.0.11-remediated-7-8-successor-20260918-D:q03 |
| 4 | pathway-grid | rpq:1.0.11-remediated-7-8-successor-20260918-D:q04 |
| 5 | pathway-grid | rpq:1.0.11-remediated-7-8-successor-20260918-D:q05 |
| 6 | exposure-assumptions | rpq:1.0.11-remediated-7-8-successor-20260918-D:q06 |
| 7 | exposure-assumptions | rpq:1.0.11-remediated-7-8-successor-20260918-D:q07 |
| 8 | inputs-evidence | rpq:1.0.11-remediated-7-8-successor-20260918-D:q08 |
| 9 | inputs-evidence | rpq:1.0.11-remediated-7-8-successor-20260918-D:q09 |
| 10 | methods-water-type | rpq:1.0.11-remediated-7-8-successor-20260918-D:q10 |
| 11 | methods-water-type | rpq:1.0.11-remediated-7-8-successor-20260918-D:q11 |
| 12 | inputs-evidence | rpq:1.0.11-remediated-7-8-successor-20260918-D:q12 |

Seed is `INSERT ... ON CONFLICT DO NOTHING`, followed by an in-transaction DO block that aborts
the migration unless exactly 12 rows exist for that release.

IMPORTANT: the manifest sha256 is a digest over the paper version + sha, both contract JSONs and
their release identities. ANY edit to `reviewer-guide-v1.json` or `cohorts-v1.json` (even a typo
fix in a prompt) or a new paper version changes it. The app will then send a manifest the DB
does not know -> every write returns `stale_manifest` (409) and GET returns no rows. Each such
release needs its own seed migration (re-run `compute-seed.cjs`), ideally shipped with the app
change.

## 3. Design decisions

1. Timestamps as TEXT (load-bearing). `submitted_at` / `updated_at` are `text` holding
   `YYYY-MM-DDTHH:MM:SS.mmmZ` (UTC, `to_char(now() AT TIME ZONE 'UTC',
   'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`), pinned by CHECK regex. Reason: the admin page and CSV
   export pass rows through `normalizeTimestamp` (`review-csv.ts`), which accepts ONLY
   `^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$`. PostgREST serializes `timestamptz` as
   `2026-09-22T12:00:00.123456+00:00`, which that function rejects -> every admin load would be
   an integrity-error. zod `z.string()` on the user GET/RPC path accepts either form. The chosen
   format sorts lexicographically in time order. A typed `created_at timestamptz` is kept on
   responses and `occurred_at timestamptz` on events for audit. Alternative (needs an app change,
   not taken): keep `timestamptz` and widen `normalizeTimestamp` to accept offsets/microseconds.
2. Write path = two SECURITY DEFINER RPCs owned by postgres, `SET search_path = public, pg_temp`,
   all references schema-qualified, `REVOKE ALL ... FROM PUBLIC, anon, authenticated,
   service_role` then `GRANT EXECUTE ... TO authenticated`. Identity comes only from
   `auth.uid()`. No INSERT/UPDATE/DELETE grant or policy exists on any of the three tables for
   anon/authenticated.
3. Row JSON built with an explicit `jsonb_build_object` of exactly the 11 keys (no `user_id`,
   no `created_at`); `id::text`; integers stay JSON numbers; timestamps are already text.
   Non-row outcomes return `{"outcome": ..., "row": null}`.
4. Concurrency: `SELECT ... FOR UPDATE` on the (user, release, question) row, then revision CAS
   (`p_expected_revision IS DISTINCT FROM revision` -> `stale_revision` with current row). First
   insert uses `INSERT ... ON CONFLICT ON CONSTRAINT ..._identity_key DO NOTHING RETURNING`; if
   nothing is returned the concurrent winner has committed (READ COMMITTED, which PostgREST
   uses), the row is re-read and returned as `stale_revision`. This is the unique_violation case
   handled without an exception block (same observable result, no subtransaction). If the
   re-read somehow finds nothing -> `persistence_unavailable`.
5. Submit: noop check BEFORE CAS. If `submitted_revision = revision AND submitted_text = p_text`
   the requested end state already holds, so the call returns `noop_already_submitted` with the
   row even when `p_expected_revision` is stale. Rationale: makes a retried submit (response lost
   in transit, or double click racing) idempotent instead of raising a false "changed in another
   tab" conflict; nothing is written, so CAS protection is not weakened. Invariant relied on:
   when `submitted_revision = revision`, `draft_text = submitted_text` (submit sets both; any
   draft save bumps revision). Flip the two ELSIF branches if the owner prefers strict CAS-first.
6. `save_draft` never touches `submitted_text` / `submitted_revision` / `submitted_at`.
7. Identity recheck: exact `(document_version, manifest_sha256, cohort_id, question_id)` must
   exist in `matrix_paper_review_questions`; otherwise if `(document_version, cohort_id,
   question_id)` exists under another manifest -> `stale_manifest`, else `unknown_identity`.
   Added `accepting_responses boolean DEFAULT true`: a retired release returns `stale_manifest`
   (lets a future release close an old one without deleting referenced rows). This column is
   an addition beyond the stated contract -- see open question Q2.
8. Check order in both RPCs: unauthenticated -> NULL p_text (RAISE 22004, route maps any RPC
   error to persistence_unavailable) -> too_large (`char_length > 20000`) -> identity -> lock ->
   (submit: noop) -> CAS. NULL identity args simply fail the lookup -> `unknown_identity`.
9. Events: one row per successful write only (not noop / stale / rejected), `revision` = value
   after the write, `text_sha256 = encode(sha256(convert_to(p_text,'UTF8')),'hex')`,
   `text_length = char_length(p_text)`. FK to responses and auth.users with ON DELETE CASCADE.
   Append-only enforced by grants (no client write) plus a BEFORE UPDATE trigger that raises for
   every role. DELETE is deliberately not trigger-blocked so user-deletion cascades still work.
   The trigger function is SECURITY INVOKER with no EXECUTE grant: it is not an RPC, so the
   "all functions SECURITY DEFINER + GRANT authenticated" rule is intentionally not applied to it.
10. RLS: questions SELECT for authenticated (`USING (true)`); responses and events SELECT own
    (`(SELECT auth.uid()) = user_id`) or admin (`(SELECT public.is_matrix_options_paper_admin())`).
    The `(SELECT ...)` wrapper is Supabase's initplan performance pattern. RLS enabled, not
    forced (the definer-owner write path must bypass it). anon: no grants, no policies.
11. Indexes: the UNIQUE `(user_id, document_version, manifest_sha256, question_id)` index serves
    the GET filter + `ORDER BY question_id`; `responses_release_idx` serves admin filters and the
    composite FK; `questions_probe_idx` serves the stale_manifest probe.
12. `updated_at` maintained by the RPCs, not by the repo's `update_updated_at_column()` trigger
    (that trigger writes `timestamptz`, incompatible with decision 1, and there is no direct
    client UPDATE path to catch).
13. service_role keeps default table privileges (server-only, bypasses RLS) but has EXECUTE
    revoked on the RPCs (they need an end-user `auth.uid()` anyway).
14. No `NOTIFY pgrst, 'reload schema'` (no repo migration uses it; Supabase's DDL watcher
    reloads the PostgREST schema cache). If the RPCs 404 (PGRST202) right after apply, run it.

## 4. Assumptions

- A1. Migrations run as `postgres` (tables owned by postgres; SECURITY DEFINER bodies bypass RLS
  as owner). `ALTER FUNCTION ... OWNER TO postgres` matches `20260527000001_user_roles_rpcs.sql`.
- A2. PostgREST runs RPCs in READ COMMITTED (needed for the race re-read in decision 4).
- A3. `question_id` belongs to exactly one cohort per release (true today; enforced by the
  questions PK). The responses unique key omits cohort_id, per the contract.
- A4. (CORRECTED in revision 3 -- the original reasoning was wrong.) Originally: "char_length
  (code points) <= 20000 is at least as permissive as zod max(20000)". True for the INBOUND route,
  but it ignored direct RPC calls and the OUTBOUND strict parsers: a caller hitting the RPC with
  20000 astral characters (40000 UTF-16 units) would be stored, then fail zod max(20000) on the
  user GET (503) and review-csv text() on the admin page/export (fail closed for ALL rows).
  Revision 3 counts UTF-16 units in the DB (public.matrix_paper_review_utf16_length), so the DB
  limit now equals the app limit exactly.
- A5. Timestamp at transaction start (`now()`) is acceptable; each PostgREST call is one txn.

## 5. Gaps between this SQL and the app code

- G1. (Handled) Admin timestamp format -- see decision 1. Without text timestamps the admin page
  and CSV export would fail closed on every row that has a timestamp.
- G2. Release drift: any contract/paper change alters the manifest sha (section 2). Until a new
  seed lands, PUT returns `stale_manifest` (409 -> client state 'error', local buffer kept) and
  GET returns `persistence: 'available'` with zero rows (earlier drafts appear missing because
  they belong to the old manifest). No auto-carry-forward of drafts across releases exists.
- G3. Admin multi-release: admin page/export with no documentVersion filter selects ALL rows;
  `normalizeReviewRows` rejects any row not matching the current trusted release, so once a
  second release has responses the unfiltered admin view becomes an integrity-error. Not an
  issue with a single release; needs an app-side default filter before the first release bump.
- G4. `stale_revision` with `row: null` (client sends expectedRevision N > 0 but the DB has no
  row, e.g. after a manual cleanup or cascade delete) is converted by `normalizeRpcData` into
  `persistence_unavailable` (503 -> client 'offline') because it requires a matching row for
  that outcome. Contract-conformant, but the user sees "server persistence is unavailable" with
  no recovery path other than reload (GET then yields no row, expectedRevision becomes null).
- G5. `unknown_identity` / `stale_manifest` / `too_large` / `unauthenticated` from the RPC are
  normally unreachable because the route pre-validates identity, length and auth; they are
  defense in depth. Client renders all of them as 'error' (401 via route as 'error' too for PUT).
- G6. A save_draft with text identical to the submitted text still bumps revision, so status
  becomes 'changed-since-submit' although the text did not change. Matches the stated contract
  (row exists -> always bump); flag if the owner wants a draft noop.
- G7. Text containing U+0000 cannot be stored in Postgres `text`; PostgREST/the RPC errors ->
  route maps to `persistence_unavailable` (503 -> 'offline'), local buffer keeps the text.
- G8. GET error path: any query error (e.g. objects missing, RLS denial) -> 503
  `persistence: 'unavailable'` -> client disables Save/Submit. With this migration applied the
  select returns exactly the 11 strict-schema keys; `id` is a uuid string, integers are numbers,
  timestamps are strings -> passes `reviewResponseRowSchema.strict()`.
- G9. Admin guard: `getPaperAdminAccess` reads `user_roles` via RLS "Users can read own role" ->
  works for admin and matrix_admin; the new SELECT policy uses the same role set, so an admin the
  guard admits can see all rows (no silent empty admin view).
- G10. Event log is not read by any app code today (audit only). No retention policy defined.

## 6. Open questions for the owner

- Q1. Approve text-typed timestamps (decision 1), or prefer timestamptz plus an app change to
  `normalizeTimestamp`?
- Q2. Keep the `accepting_responses` column (beyond the stated contract) or drop it?
- Q3. Noop-before-CAS on submit (decision 5) or strict CAS-first?
- Q4. Release-bump process: ship a seed migration with every contract/paper change (G2), and
  should drafts carry forward to a new release?
- Q5. Event log retention and whether admins need an app view of it.
- Q6. Should service_role retain EXECUTE on the RPCs for server-side tooling (currently revoked)?

## Revision 2 (2026-09-22, orchestrator decisions)

Forward SQL: `matrix_paper_review_persistence_DRAFT.sql` (supersedes
`20260922120000_matrix_paper_review_responses.sql`, which is kept unchanged for history).
`rollback.sql` and `verify_readonly.sql` now target revision 2; the revision 1 versions are kept
as `rollback_rev1.sql` and `verify_readonly_rev1.sql`. Still a draft: not applied, not executed
on any Postgres.

Diffs from revision 1:
- Q1 resolved: `submitted_at timestamptz` (nullable) and `updated_at timestamptz NOT NULL
  DEFAULT now()`. The two timestamp-format CHECK regexes are gone (responses now have 5 CHECKs).
  RPCs set both to `now()` (transaction time), and the RPC jsonb row renders them with
  `to_char(ts AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`; NULL stays JSON null.
  Supersedes section 3 decision 1.
- Q2 resolved: `accepting_responses` column and its stale_manifest branch removed. Identity
  recheck is now exactly the contract: exact (version, manifest, cohort, question) -> proceed;
  (version, cohort, question) known under another manifest -> `stale_manifest`; else
  `unknown_identity`. Supersedes section 3 decision 7 (the column part).
- Q3 kept: noop-before-CAS on submit (section 3 decision 5).
- Q6 kept: EXECUTE revoked from service_role on the RPCs and the helper.
- No `update_updated_at_column()` trigger; RPCs own `updated_at` (decision 12 still holds).
- verify_readonly.sql: V2 column types, V3 CHECK count, V12 column list updated; added V12b
  (accepting_responses absent) and V14 (no API role can CREATE in public).

G1 / G8 re-check under revision 2:
- G1: RPC rows carry `...T..:..:..mmmZ` strings, which already pass the admin normalizer. Rows
  read by table SELECT (user GET, admin page, CSV export) carry PostgREST's timestamptz form,
  e.g. `2026-09-22T12:00:00.123456+00:00`. The CURRENT `normalizeTimestamp` rejects that, so the
  admin page and CSV export fail closed (integrity-error) on any row with a timestamp until the
  orchestrator's widening lands. Ship order: the app widening must deploy before or together
  with this migration. Note the widened regex must also accept fewer than 6 fractional digits and
  no fraction at all (Postgres trims trailing zeros, e.g. `12:00:00.12+00:00` or `12:00:00+00:00`).
  Rows are always UTC offset because PostgREST sessions run in UTC by default; if a DB/role
  TimeZone setting other than UTC were ever configured, offsets other than +00:00 would appear.
- G8: the user GET path is unaffected: `reviewResponseRowSchema` types both timestamps as
  `z.string().nullable()`, so either form parses. One cosmetic consequence: the client's row map
  holds GET rows (`+00:00` form) and RPC rows (`Z` form) side by side; both are only strings to
  the client, and no code compares timestamps, so behaviour is unchanged.

Self-review pass (revision 2):
- SECURITY DEFINER hygiene: all three definer functions `SET search_path = public, pg_temp`
  (pg_temp last), owner postgres; every table/type/function reference in their bodies is
  schema-qualified (`public.*`, `auth.uid()`); unqualified names are only pg_catalog built-ins
  (`now`, `to_char`, `char_length`, `sha256`, `convert_to`, `encode`, `jsonb_build_object`),
  and pg_catalog is searched before public. Live check: anon/authenticated/service_role have no
  CREATE on schema public, so nothing can be planted to shadow them (added as V14).
- Policies: 5, all `FOR SELECT TO authenticated`; no INSERT/UPDATE/DELETE/ALL policy.
- Grants: `REVOKE ALL` from PUBLIC, anon, authenticated on all three tables and the identity
  sequence; only SELECT re-granted to authenticated. Functions: `REVOKE ALL` from PUBLIC, anon,
  authenticated, service_role; EXECUTE re-granted to authenticated only (trigger fn: none).
- jsonb row: exactly 11 keys (id, document_version, manifest_sha256, cohort_id, question_id,
  draft_text, submitted_text, revision, submitted_revision, submitted_at, updated_at); no
  user_id / created_at; id as text; integers as numbers.
- FOR UPDATE + CAS: lock is taken before the CAS compare, and the UPDATE targets the locked row
  by id, so two concurrent writers with the same expected revision serialize and the second sees
  the bumped revision -> stale_revision.
- Race re-read: when no row exists nothing is locked; the loser's `INSERT ... ON CONFLICT DO
  NOTHING` waits on the winner's uncommitted index entry, then skips; the following SELECT takes
  a fresh READ COMMITTED snapshot (volatile plpgsql) and returns the committed winner as
  stale_revision. If the winner rolled back, the loser's insert proceeds instead (no conflict).
- Changes made during self-review: added V14 to verify_readonly.sql. No defects found in the
  forward SQL beyond the decision-driven edits above.

Remaining owner-facing items:
- Q4. Release-bump process: every change to the paper version or either contract JSON changes
  the manifest sha, so a new seed migration must ship with it (otherwise writes return
  stale_manifest and GET shows no rows). Should drafts carry forward to a new release?
- Q5. Event log retention, and whether admins need an app view of it.

## Revision 3 (2026-09-22, Leg 1a review RED fixes)

Forward SQL edited in place: `matrix_paper_review_persistence_DRAFT.sql`; revision 2 kept as
`matrix_paper_review_persistence_DRAFT_rev2.sql` (also `rollback_rev2.sql`,
`verify_readonly_rev2.sql`). Still a draft: not applied, not executed on any Postgres. Read-only
live checks run for this revision: `TimeZone` = UTC, `server_encoding` = UTF8, zero TimeZone
overrides in pg_db_role_setting for the database or authenticator/authenticated/anon,
`regexp_count('a'||chr(128512)||'b', '[\U00010000-\U0010FFFF]')` = 1 (char_length 3), and
`pg_catalog.regexp_count(text,text)` is IMMUTABLE.

Changes:
- P1 (UTF-16 length): new `public.matrix_paper_review_utf16_length(text) RETURNS integer`,
  `LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE`, `SET search_path = pg_catalog, pg_temp`, body
  fully qualified: `pg_catalog.char_length(t) + pg_catalog.regexp_count(t,
  E'[\U00010000-\U0010FFFF]')` (E'' string so the regex escape does not depend on
  standard_conforming_strings). No EXECUTE grant to any API role (not an RPC; evaluated inside
  the definer RPCs and the CHECKs). Used in both text CHECKs on responses, in both RPCs'
  `too_large` test, and for the events `text_length` column (now UTF-16 units, same unit as the
  limit). An in-migration DO block aborts unless server_encoding is UTF8 and the helper returns
  4 / 3 / 0 for 'a'+U+1F600+'b' / 'abc' / ''. A4 corrected above.
  Consequence: service_role (or any role without EXECUTE on the helper) can no longer INSERT or
  UPDATE response text directly, because the CHECK calls the helper; that is consistent with
  "RPCs are the only write path". Grant EXECUTE to service_role only if a server-side tool needs
  direct writes.
- P3(a) Seed: one DO block holds the 12 identities once (jsonb constant), inserts with
  `ON CONFLICT (document_version, manifest_sha256, question_id) DO NOTHING`, then aborts unless
  the symmetric difference between that set and the table rows for the release, over all five
  columns (version, sha, cohort, question_id, number), is empty, and the literal has 12 entries.
  A conflicting row on another unique key (number or identity key) raises and aborts.
- P3(b) Plain `CREATE TABLE` / `CREATE INDEX` / `CREATE FUNCTION` (no IF NOT EXISTS / OR REPLACE):
  any leftover object with the same name aborts the migration instead of being silently kept in
  an older shape. (Policies keep `DROP POLICY IF EXISTS` + CREATE; on fresh tables it is a no-op.)
- P3(c) submit: in the lost-first-insert-race re-read, the same noop test (submitted_revision =
  revision AND submitted_text = p_text) runs before falling back to `stale_revision`, so two
  identical concurrent first submits both succeed (one `ok`, one `noop_already_submitted`).
- P3(d) verify_readonly.sql: V17 `current_setting('TimeZone')` = UTC; V18 no TimeZone entries in
  pg_db_role_setting for the database (or all databases) and roles authenticator /
  authenticated / anon (or all roles). Also V15 (both text CHECK definitions call the helper and
  not char_length) and V16 (helper returns 4 / 3 / 0 / 40000); V8/V9 now list the helper.
- P3(e) rollback.sql: header states that rollback does not touch
  `supabase_migrations.schema_migrations`; the history repair (`supabase migration repair
  --status reverted <version>` or an equivalent single-row delete) is a separate,
  owner-approval-only write. Rollback also drops the new helper after the responses table.
- P3(f) recorded below under Q5 and follow-ups.

Self-review of the revision 3 diff (one pass):
- Helper is safe in a CHECK: IMMUTABLE, STRICT, pinned search_path, every call qualified with
  pg_catalog; the only session-dependent input would be the regex literal, removed by using E''.
  NOT NULL on draft_text means STRICT never yields NULL there; submitted_text CHECK tests IS NULL
  first.
- Helper is created before the tables that reference it and dropped after them in rollback.
- The RPC `too_large` test runs before identity/lock, unchanged position; the error message and
  outcome set are unchanged.
- Seed DO block: expected and actual CTEs project the same five columns in the same order and
  types (text x4, integer), so EXCEPT is well-typed; count uses pg_catalog.count.
- Race-noop branch assigns v_outcome in both arms; the event insert still fires only for `ok`.
- No other lines changed. No defects found.

Remaining owner-facing items:
- Q4. Release-bump process (unchanged from revision 2): each paper/contract change needs a new
  seed migration; decide whether drafts carry forward.
- Q5. Event log retention AND throttling. The route applies `getAuthAndRateLimit`, but the RPCs
  are callable directly by any authenticated user through PostgREST (`/rest/v1/rpc/...`) with
  their own JWT, bypassing the app rate limiter. Each successful save appends one event row, so a
  scripted client can grow `matrix_paper_review_response_events` without bound (and churn its own
  response row). Options: a retention job, a per-user DB-side throttle (e.g. reject when the
  user's last event is younger than N ms), a per-user event cap, or accept the risk for a small
  invited reviewer set.

Follow-up (app side, not in this migration):
- The admin page and CSV export select all matching rows in one request with no pagination.
  PostgREST's max-rows (Supabase default 1000) silently truncates beyond that, so with more than
  1000 response rows the admin view/export would be incomplete without any error. Add range
  pagination (or a count check) before reviewer volume approaches that.

## Revision 3 addendum (orchestrator)
- Leg 1a round 2 (Opus): GREEN, P3 only. Decisions 1, 8, 9 and the "exactly 12 rows" wording in sections 2-3 are SUPERSEDED by Revisions 2-3 (timestamptz; UTF-16 helper; symmetric-difference seed assertion).
- Read-only check 2026-09-22: no is_matrix_options_paper_admin / utf16 helper / RPC functions exist live.
- Owner items: Q4 release-bump seeding, Q5 event retention + per-user throttle, and whether submit should reject blank text in the DB (UI already blocks it).

## Revision 4 addendum (orchestrator, 2026-09-22)
Driven by codex gpt-5.6-luna UI round 2 (P1 anonymous sessions, P2 direct RPC writes bypass the app
rate limiter). Revision 3 (sha256 e5d0f6cd...) is SUPERSEDED; its bytes are kept under
`.tmp/run-mo-paper-impeccable-20260922/sql/historical/` in the run folder only.
- Both RPCs (save_draft, submit): after the NULL auth.uid() check, reject anonymous sessions
  (`(auth.jwt() ->> 'is_anonymous')::boolean IS NOT FALSE` -> outcome `unauthenticated`; fail closed
  on a missing claim). Matches the app routes, which now require `user.is_anonymous === false`
  (same rule as the existing downloads route).
- Both RPCs: DB-side write throttle. At most 60 successful writes (event rows) per user per rolling
  minute -> outcome `rate_limited` (app maps it to HTTP 429; the client keeps the text and reports
  "Could not save ... Try again"). Noop / stale / rejected calls write no event and are not counted.
  The count is not serialized, so concurrent calls can exceed 60 by the number in flight; this is a
  growth bound, not an exact quota. Worst case per user: 86,400 event rows per day.
- `events_user_idx` is now on `(user_id, occurred_at)` (serves the throttle and the select-own policy).
- VERIFY: V4 comment names the new index shape; new V19 checks both RPC bodies carry the guards.
  ROLLBACK statements unchanged (drops by name); header relabelled revision 4.
- Q5 NARROWED: throttling is now in the package; event RETENTION remains an owner decision.
- Owner-tunable: the 60/minute threshold (the app autosaves at most once per 1.5 s idle per question).
- TESTING NOTE (disposable branch / SQL editor): the RPCs now read `auth.jwt() ->> 'is_anonymous'`.
  A simulated call must set `request.jwt.claims` to include `"is_anonymous": false` (and `sub`),
  otherwise every call correctly returns 'unauthenticated'.
- SOURCE OF TRUTH: `docs/apply-drafts/` is the only apply source. The review-workspace copies
  (`.tmp/.../sql/matrix_paper_review_persistence_DRAFT.sql`, `rollback.sql`, `verify_readonly.sql`)
  are refreshed to the same bytes; the sha256 lines above are authoritative.
- Residual (owner, Q5): event RETENTION; rejected/noop/stale calls are not throttled (they write
  nothing; the app route limiter covers app traffic).
- POST-APPLY SMOKE (required, owner or owner-approved): one real signed-in reviewer saves ONE draft
  with non-verdict text (e.g. "smoke test - delete") through the app and gets outcome ok. This is
  the only check that live session JWTs carry `is_anonymous: false`; if they did not, every save
  would return 'unauthenticated' after apply. Never use a verdict value (ADEQUATE / INADEQUATE /
  OBSERVATION_ONLY) as smoke text.

## Revision 5 addendum (orchestrator, 2026-09-22)
Driven by the final codex gpt-5.6-sol xhigh round (reviewed revision 4, sha256 2aa0d198...; migration-ledger
dispute WITHDRAWN by sol). Revision 4 is SUPERSEDED (bytes kept in the run folder sql/historical/rev4).
- Throttle serialized: both RPCs take `pg_advisory_xact_lock(hashtext('matrix_paper_review_write'),
  hashtext(uid))` before counting, so concurrent direct calls cannot all pass. The lock is per user (a
  hash collision only serializes two users' writes) and is released at transaction end. The 'growth bound,
  not an exact quota' caveat in Revision 4 is SUPERSEDED: it is now an exact 60 per rolling minute.
- Blank submit rejected: submit returns 'blank_submission' when p_text is empty or only whitespace
  (the JavaScript trim() set -- see the Revision 5 amendment below); the app maps it to HTTP 422 and the API schema rejects a blank submit with 400
  before calling the RPC. Blank DRAFT saves remain allowed (a reviewer may clear a draft). This answers
  the earlier open owner question "should the DB reject a blank submit" -- yes (owner may still override).
- VERIFY V19 extended (advisory lock + blank_guard). ROLLBACK statements unchanged (header relabelled).
- Revision 5 amendment (Leg 1a review): the blank-submit test uses the same character set as the app's
  JavaScript trim() (ASCII whitespace, U+00A0, U+1680, U+2000-U+200A, U+2028, U+2029, U+202F, U+205F,
  U+3000, U+FEFF), written as \uXXXX regex escapes so the file stays ASCII. The throttle is exact under
  READ COMMITTED (the PostgREST default: each statement after the advisory lock takes a fresh snapshot);
  under REPEATABLE READ / SERIALIZABLE the count would use the transaction snapshot. `v_now` is the
  transaction start time, so the window is anchored there, not at lock acquisition.
