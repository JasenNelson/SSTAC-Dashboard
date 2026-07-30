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

## 0b. HARD PREREQUISITE -- STOP unless F2 is merged (cluster identity)

**This is a blocking precondition on the apply itself, not background reading.
If it is not satisfied, STOP. Do not run section 3 or anything after it.**

Coordinate cluster identity is currently implemented TWICE, in two runtimes that
can disagree:

| Runtime | Implementation |
|---|---|
| JavaScript | `latitude.toFixed(5)` in `src/lib/matrix-map/siteAggregates.ts` |
| PostgreSQL | `to_char(round(p_lat::numeric, 5), 'FM9990.00000')` in `matrix_map.canonical_five_decimal_cluster` |

`toFixed` rounds the binary double; `round(numeric, 5)` is half-away-from-zero on
the decimal. On a five-decimal boundary they can produce DIFFERENT keys for the
same stored coordinate. The admin page then renders an aggregate, sends that key
to `upsert_site_aggregate_candidate`, and the RPC answers `snapshot is empty`
(`UE409`) for a site the operator can plainly see.

Applying this SQL is what makes that divergence reachable in production. While
the SQL is unapplied the lifecycle fails closed and the defect cannot bite.

**Owner ruling 2026-07-27: D2 / live SQL apply is BLOCKED until a focused
follow-up PR establishes ONE authoritative cluster-identity path and is
reviewed, gated, merged, and replay-verified.** That PR is the next flagship task
after PR #754. It should prefer SERVER-DERIVED canonical keys over another
hand-maintained cross-runtime rounding emulation.

Before proceeding past this section, confirm and record:

| Check | Required |
|---|---|
| The F2 cluster-identity follow-up PR is MERGED into `main` | YES |
| Its replay evidence was captured and reviewed | YES |
| `siteAggregates.ts` no longer derives cluster keys independently of the SQL canonicalizer | YES |

If any answer is NO, this apply is not authorized regardless of any other GREEN
gate in this document. Background: section 0 of
`FRESH_SESSION_HANDOFF_2026_07_27_OPTION_C_RESTACK_CORRECTION.md`.

### 0.1 RELEASE ORDER IS NOW A HARD CONSTRAINT, AND IT IS NOT SOLVED BY THIS SECTION

Added 2026-07-30, as an F2 merge-gate item. **Writing this down does NOT discharge
it.** This section states a constraint and names who must resolve it; it does not
resolve it. Do not read the presence of this text as evidence the sequence is
handled.

WHAT CHANGED. Before F2 the admin site-aggregate preview read `matrix_map.samples`
and `matrix_map.dras` -- tables that EXIST in production today -- and clustered in
TypeScript. It therefore rendered a live preview even with zero Option C objects
installed. **After F2 the application's ONLY preview source is
`matrix_map.fetch_admin_site_aggregate_live_preview`, which the pinned SQL in
section 1 creates.** The application now DEPENDS on the new RPC.

THE CONSEQUENCE, stated plainly: if the application is promoted to production
BEFORE the pinned SQL is applied, the first RPC call returns PostgREST `PGRST202`,
the loader sets its error path, and the admin preview surface FAILS CLOSED -- the
table, the map and every summary statistic render empty behind a load-failure
banner. This is a fail-CLOSED degradation, not a data-integrity or privacy defect,
and no verdict, publication or coordinate is at risk. But it IS a visible outage of
a working admin surface, and it lasts exactly as long as the gap between the two
promotions.

D2 / live SQL apply remains SEPARATELY OWNER-GATED AND UNAUTHORIZED (owner ruling
2026-07-27, above). So the gap cannot be closed simply by applying the SQL first at
an engineer's discretion.

**BEFORE MERGE, the owner must do ONE of the following, explicitly:**

| Option | What it means |
|---|---|
| Establish a coordinated release sequence | Guarantee, operationally, that the application is NOT promoted to production before the pinned SQL apply completes. This requires the D2 authorization to be granted and sequenced FIRST. |
| Explicitly accept a temporary fail-closed outage | Acknowledge on the record that the admin site-aggregate preview will render empty behind an error banner from application promotion until the SQL apply lands, and accept that window. |

Neither option is selectable by an agent, and neither is satisfied by this
document. Until one is recorded, treat the deployment order as an OPEN owner
decision.

## 1. What gets applied, and its exact identity

Single artifact:

| Field | Value |
|---|---|
| Path | `docs/design/matrix-map/OPTION_C_PHASE2_SITE_AGGREGATE_PUBLICATIONS_DRAFT_2026_07_24.sql` |
| Bytes | 126552 |
| SHA-256 | `E57B1E5EBD22BF3D15F577E759840C021AFC348BDF472887BCCF61199990DB72` |

> **PIN CHANGED 2026-07-28.** The previous pin (97326 bytes,
> `1B8AA3AE...`) is SUPERSEDED and must not be used. A review found a real
> correctness defect in those bytes: post-commit verification paged the
> candidate collection, and OFFSET pages across independent statements are not
> a snapshot, so a concurrent refresh could make the readback report
> `verification_failed` for a candidate that had in fact committed.
>
> The fix changes `upsert_site_aggregate_candidate` to `RETURNS uuid` so the
> caller verifies by exact id. A changed return type cannot be applied with
> `CREATE OR REPLACE`, so the script now performs a reapply-safe
> `DROP FUNCTION IF EXISTS ... RESTRICT` followed by a plain `CREATE FUNCTION`
> and restores the owner, revoke and grant posture explicitly.
>
> **Every FINAL24 replay receipt is INVALIDATED by this change** (historical
> note): those receipts bind `draft_sql_sha256 1B8AA3AE...` and are evidence
> about bytes that no longer exist.
>
> **PIN CHANGED AGAIN 2026-07-29 (F2).** The 2026-07-28 pin (99831 bytes,
> `003E1633...`) is SUPERSEDED and must not be used. F2 makes SQL the sole
> authority for coordinate-cluster identity: it adds
> `fetch_admin_site_aggregate_live_preview`, moves
> `upsert_site_aggregate_candidate` to a 7-argument signature that derives the
> cluster id from an independent representative pair BEFORE sample selection and
> raises `UE412` pre-commit on disagreement, and rewrites three per-group
> correlated subqueries in the preview aggregate as set-based aggregates.
>
> That last change was not cosmetic. With a 502,000-row performance fixture, a
> single first-page `EXPLAIN (ANALYZE, BUFFERS)` of the inner aggregate SELECT
> did not return within ten minutes while the correlated subqueries were present;
> after the rewrite the same page plans and executes with one aggregate node at
> one loop and zero SubPlan nodes.
>
> **Every FINAL32 replay receipt is INVALIDATED by this change**: those receipts
> bind `draft_sql_sha256 003E1633...` and are evidence about bytes that no longer
> exist.
>
> **PIN CHANGED AGAIN 2026-07-30 (F2, holistic round 8 finding V2).** The pin
> `6A94FBB1...` (123637 bytes) is SUPERSEDED and must not be used.
>
> A terminal holistic review found that the admin preview could display
> provenance the upsert would not persist: on a mixed-tier cluster the flattened
> `coordinate_source` strings were only checked for nullability, so a
> version-skewed response could show a preview source absent from the lifecycle
> set. The obvious client-side fix -- splitting the `'; '`-joined text back into
> a set and testing inclusion -- is UNSOUND, because `coordinate_source` is
> free-form text and may itself contain that separator, so the flattened string
> is a LOSSY serialization and a split-based check can reject legitimate database
> output.
>
> The projection therefore now also returns `preview_coordinate_sources text[]`
> and `lifecycle_coordinate_sources text[]`: sorted, DISTINCT, blank-filtered
> arrays built from the SAME expressions, population and `COLLATE "C"` ordering
> as the existing `string_agg` text. The arrays are the authoritative sets; the
> text is retained as a display/compatibility rendering and is verified by
> JOINING the array, never by splitting the text.
>
> **Every receipt binding `6A94FBB1...` is INVALIDATED by this change**: the
> positive, NEG_01 and REAPPLY_01 receipts from the F2-FINAL set are evidence
> about bytes that no longer exist.
>
> **THE CURRENT EVIDENCE SET IS F2-V8**, whose positive, NEG_01 and REAPPLY_01
> receipts bind `E57B1E5E...`.
>
> **PERFORMANCE EVIDENCE SUPERSEDED 2026-07-30: use `perf-v9-04`. `perf-v8-01`,
> `perf-v9-01`, `perf-v9-02` AND `perf-v9-03` are all superseded.**
> The SQL did not change, so the positive, NEG_01 and REAPPLY_01 receipts above
> remain valid and were re-verified against `E57B1E5E...` rather than re-run. The
> PERFORMANCE receipt is different: a codex review found that Measurement B's
> "warm" cache posture never measured a warm session at all. Every timing went
> through a helper that starts a NEW `docker exec ... psql` process, so both arms
> used fresh backends and `DISCARD ALL` was a no-op on a connection that had
> nothing to discard -- yet the receipt gated and reported BOTH postures as
> passing. `perf-v8-01` therefore asserts a posture it did not exercise and MUST
> NOT be cited as current.
>
> Measurement B now proves session custody by EXECUTION: the cold arm records five
> timed calls over five DISTINCT `pg_backend_pid()` values, and the warm arm holds
> ONE persistent backend across an explicit untimed priming call plus five timed
> calls, re-probing the pid after every one.
>
> `strict_pass` requires ALL of: at least five cold observations; a distinct cold
> backend pid for EVERY cold observation; at least five warm observations; exactly
> ONE distinct warm pid across all of them; a priming call that returned a full
> page AND ran in the SAME backend the timed calls used; and both posture maxima
> within the 250 ms budget. The required count is a CONTRACT LITERAL, not the
> `-Repeats` parameter -- raising `-Repeats` strengthens the evidence, and lowering
> it cannot weaken the gate. A negative self-check proves the predicate goes FALSE
> on multiple warm pids, a shared cold pid, an unprimed arm, priming in a different
> backend, a short run, and a budget breach in either arm.
>
> The two arms are deliberately NOT symmetric -- cold wall clock includes process
> and connection startup, warm excludes it -- so the two figures must not be
> differenced to infer a connection cost. Neither arm clears the OS page cache or
> shared buffers, so "cold" means a cold SESSION, not a cold cache. Note also that
> the COLD figure is startup-DOMINATED: the same statement costs about 56 ms warm
> against a cold maximum near 242 ms, so the remaining margin under the 250 ms
> budget is NOT query headroom, and a red cold gate on a slow host may be
> attributable to Docker rather than to the RPC. In `perf-v9-04` the same statement
> cost at most 58.18 ms warm against a cold maximum of 242.03 ms, compared maximum
> to maximum.
>
> `perf-v9-01` is ALSO superseded, for a narrower reason: a review of the rewrite
> found that its gate still compared the observation counts against the `-Repeats`
> PARAMETER rather than against a contract literal, so a caller passing
> `-Repeats 1` would have satisfied "exactly one warm backend pid" VACUOUSLY. The
> `perf-v9-01` numbers were not wrong (it ran at the default five), but it was
> produced by a harness whose gate could be switched off from the command line, and
> it therefore does not describe the bytes that ship. The same review also found
> that the persistent session redirected psql's stderr without ever draining it,
> which destroyed the diagnostic distinguishing a dead backend from bad SQL.
>
> `perf-v9-02` is superseded for one further reason, found by testing the fix rather
> than trusting it: the stderr drain it introduced DID NOT WORK. It used an
> `ErrorDataReceived` handler appending to a script-scope buffer, but a
> `Register-ObjectEvent -Action` scriptblock runs in its own runspace, so `$script:`
> inside it resolves to that runspace's variable and the parent's buffer stayed
> empty. A probe against a process writing a known line to stderr collected zero
> bytes -- meaning the helper would have confidently reported "psql stderr was
> empty" for every real failure, which is WORSE than having no diagnostic. The
> shipping harness drains stderr with `ReadToEndAsync` instead, which needs no
> cross-runspace state and cannot fill the pipe.
>
> `perf-v9-03` is superseded for a documentation-honesty reason found on re-review:
> its receipt contrasted the warm MINIMUM against the cold MAXIMUM, the most
> flattering framing available, in a receipt that elsewhere insists the MAXIMUM is
> the reported figure. The shipping harness compares maximum against maximum.
>
> **`perf-v9-04` IS THE CURRENT PERFORMANCE EVIDENCE**, generated by the shipping
> harness bytes. Measured on the 502,000-row PERF fixture: cold pids
> 687/694/701/708/715 (five distinct) with median 213.25 ms and maximum 242.03 ms;
> warm pid 722 for all five observations with median 56.26 ms and maximum 58.18 ms,
> and the priming call confirmed to have run in that SAME backend 722; Measurement C
> five of five traversals with slowest 6231.26 ms against the 8000 ms budget; 26
> buffer positions accounted with zero capture failures; all 24 assertions PASS and
> `strict_pass: true` with zero failures and the negative self-check passing.
>
> **THE COLD GATE PASSED WITH ONLY ABOUT 8 MS OF MARGIN, AND ITS OWN RUN-TO-RUN
> VARIANCE IS LARGER THAN THAT MARGIN. Surface this to the owner rather than
> treating the green as comfortable.** Across the four measurement runs taken during
> this change the cold maximum was 205.20, 219.74, 215.17 and 242.03 ms -- a spread
> of about 37 ms against a 250 ms budget -- while the warm maximum over the same four
> runs was 57.87, 57.99, 58.33 and 58.18 ms, a spread of under half a millisecond.
> The query is evidently stable; the cold arm is measuring `docker exec` and backend
> startup. A slower host can therefore turn the cold gate RED for reasons that have
> nothing to do with the RPC. The 250 ms figure is a PROVISIONAL release regression
> budget, not a service commitment, and whether to re-baseline the cold arm (or gate
> only the warm arm, which is the one that isolates query cost) is an OWNER decision
> that this change deliberately does not make.
>
> The separation between the arms is the point: the original `perf-v8-01` receipt
> reported 213.20 ms cold and 235.42 ms warm, which were two COLD measurements.
>
> **PIN REFRESHED WITHIN THE SAME F2 CHANGE (2026-07-29, review round 1).** The
> interim F2 pin `CB910E4E...` (121484 bytes) never left this branch and must not
> be used. A targeted SQL review found that
> `current_site_aggregate_snapshot` selected its cluster members by DRA and
> canonical key ALONE, with no coordinate-eligibility predicate -- so a row just
> outside a bound that ROUNDS onto the bound (longitude 180.000001 ->
> 180.00000) was excluded from the live preview but still COUNTED in what the
> upsert persisted. That breaks the write-preview contract F2 exists to
> establish. The snapshot now applies the identical predicate. The positive
> suite also grew to 85 assertions across two review rounds.
>
> **FINAL25 through FINAL31 are SUPERSEDED and must not be used as current.**
> They predate a fix to this very procedure's acceptance gate: the replay
> harness required test ids only through `TEST_64` while the suite had grown to
> `TEST_69`, so a replay that never emitted the exact-ID contract checks could
> still have reported `strict_pass: true`. FINAL32 is the first set generated
> from the corrected harness. The active positive suite is now **85 tests**
> (`TEST_01`..`TEST_85`, no gaps), raised from 69 in the same change that added
> `TEST_70`..`TEST_85`.
>
> **CORRECTED 2026-07-30.** This line previously read "81 tests" while the header,
> the acceptance table (`required_test_count | 85`) and the section-5 STOP
> condition all said 85 -- in a document whose own instruction is to STOP when the
> count does not match. It was also self-contradictory: 69 plus
> `TEST_70`..`TEST_85` is 85, not 81. Ground truth, measured rather than asserted:
> `test-option-c.sql` contains exactly 85 distinct ids `TEST_01`..`TEST_85` with no
> gaps, and `replay-migrations-postgis.ps1` builds `$requiredTestIds = @(1..85 ...)`.

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

**THREE separate invocations are required, not one.** The harness runs one
control per invocation and EXITS, and the two full-script controls are opt-in
switches. Running only the first command yields a GREEN full-suite receipt while
proving nothing about reapply behaviour or rollback - which is exactly the gap
that let a non-reapply-safe migration reach review. All three receipts are
mandatory.

```
# PowerShell, from the repository root. Bound each externally -- the harness
# implements no internal timeout (see the note in its header).
# Use a DIFFERENT -OutputDir per invocation so receipts are not overwritten.

# 1 of 3 - migration replay + the 85-assertion suite (TEST_01..TEST_85)
pwsh -File scripts/matrix-map/validation/option-c-phase2/replay-migrations-postgis.ps1 `
  -OutputDir <a path OUTSIDE any worktree> `
  -RepoRoot  <this repository root>

# 2 of 3 - NEG_01, full-script negative control (malformed legacy shape)
pwsh -File scripts/matrix-map/validation/option-c-phase2/replay-migrations-postgis.ps1 `
  -OutputDir <a DIFFERENT path OUTSIDE any worktree> `
  -RepoRoot  <this repository root> `
  -NegativeLegacyReplay

# 3 of 3 - REAPPLY_01, full-script positive reapply control
pwsh -File scripts/matrix-map/validation/option-c-phase2/replay-migrations-postgis.ps1 `
  -OutputDir <a THIRD path OUTSIDE any worktree> `
  -RepoRoot  <this repository root> `
  -PositiveReapplyControl
```

Acceptance, read from `<OutputDir>/migration_replay_summary.json` and
`<OutputDir>/test_receipt.json`:

| Field | Required value |
|---|---|
| `overall_status` | `COMPLETED_GREEN` |
| `failed_tests` | `0` |
| `strict_pass` | `true` |
| `missing_test_ids` | empty (`[]`) |
| `required_test_count` | `85` |
| `required_test_ids` | runs through `TEST_85` |
| `draft_sql_sha256` | equals the SHA-256 pinned in section 1 |

**THE HARNESS IS THE SINGLE AUTHORITY on which tests are required.** Every field
above except the digest is derived inside the harness from one
`$requiredTestIds` array and emitted into `test_receipt.json`. Read them from the
receipt; do NOT maintain a separate "at least N passed" threshold here.

That separate threshold is exactly what failed before: this table said "at least
64" while the suite had grown to TEST_69, so a replay that never emitted
TEST_65-69 -- the exact-ID return identity, refresh identity, single-row
readback, DROP/CREATE ownership and grants, and single-overload checks -- would
have satisfied both the harness baseline and this table, and the gate would have
reported GREEN with the newest safety checks absent.

If `required_test_count` in the receipt is not 85, or `required_test_ids` does
not run through `TEST_85`, the harness is older than the suite: **STOP** and
reconcile them rather than accepting the receipt.

Read `test_results.txt` and confirm the assertion log is **non-empty** and every
`TEST_*` line reads `PASS`. An exit code of 0 is not acceptance on its own.

The two full-script controls have their own receipts, and BOTH are required:

| Receipt | Required |
|---|---|
| `<OutputDir 2>/neg01_receipt.json` | `status` = `PASS`, `saw_ue409` = true, `fingerprints_match` = true, `candidate_audit_shape_unchanged` = true |
| `<OutputDir 3>/reapply01_receipt.json` | `status` = `PASS`, `second_apply_exit_code` = `0`, `second_apply_reached_commit` = true, `fingerprints_match` = true |

In BOTH receipts, `draft_sql_sha256` MUST equal the SHA-256 pinned in section 1.
A receipt that green-lights different bytes is not evidence about this apply.

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
    'fetch_site_aggregate_candidate_audit',
    'apply_candidate_audit_publication_id_invariant','blank_trim')
ORDER BY 1;

-- 3.2 Baseline the visibility invariant you must not change.
SELECT count(*) FILTER (WHERE public) AS public_dras, count(*) AS total_dras
FROM matrix_map.dras WHERE is_deleted = false;

SELECT count(*) FILTER (WHERE public) AS public_samples, count(*) AS total_samples
FROM matrix_map.samples;

-- 3.3 Existing publications, if any.
--
-- MUST NOT reference the relation directly. On a CLEAN FIRST APPLY the table does
-- not exist yet, and a bare SELECT would raise 42P01 and abort the preflight
-- before the owner could apply anything - the preflight would block the very
-- state it exists to describe. to_regclass() returns NULL instead of erroring.
SELECT
  to_regclass('matrix_map.site_aggregate_publications') IS NOT NULL
    AS publications_table_exists;

-- NOTE: the published/total COUNT over site_aggregate_publications is
-- deliberately NOT in this block. It references the relation DIRECTLY, so on a
-- clean first apply -- the only state this runbook authorizes -- it would raise
-- 42P01 and abort the very block that exists to describe that state. It is a
-- separate, explicitly conditional query below.

-- 3.3b The OTHER TWO lifecycle tables. This draft creates THREE tables:
-- site_aggregate_publications (3.3 above), site_aggregate_publication_audit,
-- and site_aggregate_candidate_audit. A complete install requires ALL THREE.
-- Checking fewer misclassifies a reachable partial install as complete - e.g.
-- publications and candidate_audit present with publication_audit dropped
-- would otherwise be misread as a complete install rather than the partial
-- one it is. (Either way an existing install now STOPS -- see the state table
-- below -- but the signal must still be accurate for the adjudication.)
-- Same tolerant style as 3.3: to_regclass() returns NULL instead of erroring,
-- so this must not error when a table is absent.
SELECT
  to_regclass('matrix_map.site_aggregate_publication_audit') IS NOT NULL
    AS publication_audit_table_exists,
  to_regclass('matrix_map.site_aggregate_candidate_audit') IS NOT NULL
    AS candidate_audit_table_exists;

-- NOTE: this preflight deliberately does NOT check the candidate-audit
-- publication_id schema invariants (NOT NULL, and exactly one conforming
-- VALIDATED foreign key). That rule has exactly ONE implementation, and it is
-- the apply-time fail-closed block inside the migration's single transaction.
-- See "Invariant ownership" below section 3.4.

-- 3.4 Classify the starting state by EXACT SIGNATURE, never by a name count.
--
-- A bare count(*) over proname is unsafe: if one required function is MISSING
-- while another allow-listed name carries a second overload, the count still
-- reaches the expected total and a partial install is misread as complete.
-- CREATE OR REPLACE FUNCTION also never removes an obsolete overload, so a
-- reapply can leave stale callable code behind. Compare regprocedure signatures
-- and reject anything unexpected.
WITH expected(sig) AS (
  VALUES
    ('matrix_map.apply_candidate_audit_publication_id_invariant(text, text)'),
    ('matrix_map.assert_conforming_dra_cluster_index(text, text, regclass)'),
    ('matrix_map.blank_trim(text)'),
    ('matrix_map.canonical_five_decimal_cluster(double precision, double precision)'),
    ('matrix_map.current_site_aggregate_snapshot(uuid, text)'),
    ('matrix_map.enforce_site_aggregate_publication_via_rpc()'),
    ('matrix_map.fetch_admin_site_aggregate_publications(uuid, integer, integer)'),
    ('matrix_map.fetch_published_site_aggregates(integer, integer)'),
    ('matrix_map.fetch_site_aggregate_candidate_audit(uuid)'),
    ('matrix_map.fetch_site_aggregate_publication_audit(uuid)'),
    ('matrix_map.flip_site_aggregate_public(uuid, boolean, uuid, text, timestamp with time zone)'),
    ('matrix_map.lock_site_aggregate_publication_sources()'),
    ('matrix_map.site_aggregate_count_bucket(integer)'),
    ('matrix_map.fetch_admin_site_aggregate_live_preview(uuid, text, integer)'),
    ('matrix_map.upsert_site_aggregate_candidate(uuid, text, double precision, double precision, text, uuid, text)')
),
actual(sig) AS (
  -- TYPE-ONLY identity. pg_get_function_identity_arguments() includes PARAMETER
  -- NAMES for functions declared with them, so it renders
  -- 'apply_candidate_audit_publication_id_invariant(p_schema text, p_table text)'
  -- and would never match the expected '(text, text)' - blocking a CONFORMING
  -- reapply. oidvectortypes() renders types only.
  SELECT format('%s.%s(%s)', n.nspname, p.proname, pg_catalog.oidvectortypes(p.proargtypes))
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'matrix_map'
    AND p.proname IN (
      'site_aggregate_count_bucket','enforce_site_aggregate_publication_via_rpc',
      'fetch_published_site_aggregates','fetch_admin_site_aggregate_publications',
      'fetch_site_aggregate_publication_audit','canonical_five_decimal_cluster',
      'current_site_aggregate_snapshot','lock_site_aggregate_publication_sources',
      'flip_site_aggregate_public','upsert_site_aggregate_candidate',
      'fetch_site_aggregate_candidate_audit',
      'apply_candidate_audit_publication_id_invariant','blank_trim',
      'assert_conforming_dra_cluster_index',
      'fetch_admin_site_aggregate_live_preview')
)
SELECT
  (SELECT count(*) FROM expected e JOIN actual a ON a.sig = e.sig) AS matching_signatures,
  (SELECT count(*) FROM expected) AS expected_signatures,
  COALESCE((SELECT array_agg(sig ORDER BY sig) FROM (
     SELECT sig FROM expected EXCEPT SELECT sig FROM actual) m), '{}') AS missing,
  COALESCE((SELECT array_agg(sig ORDER BY sig) FROM (
     SELECT sig FROM actual EXCEPT SELECT sig FROM expected) u), '{}') AS unexpected_overloads;
```

### Which starting state are you in? Only ONE is authorized to proceed.

This preflight reads three signals: 3.3 (publications table), 3.3b (the other
two lifecycle tables - publication_audit AND candidate_audit), and 3.4 (exact
function SIGNATURES, not a name count). Exactly ONE combination of the three is
authorized by this generic runbook:

| State | 3.3 publications | 3.3b publication_audit + candidate_audit | 3.4 signatures | What to do |
|---|---|---|---|---|
| **Clean first apply** | absent | BOTH absent | 0 matching, 0 unexpected | The ONLY state this generic runbook authorizes. Proceed to section 4. |
| **Any existing install** | present | either present | any | **STOP.** This runbook does not authorize it. See below. |

All THREE tables move together. Any mix - one present and another absent, in
either direction - is a partial install, and is equally covered by the STOP.

### Conditional: counting existing publications (adjudication input only)

Run this ONLY if 3.3 returned `true`. **Skip it entirely on a clean first
apply** - the relation does not exist and this statement raises `42P01`. It is
kept out of the block above for exactly that reason.

Its output is input to the case-specific adjudication described below, not a
preflight signal that authorizes anything.

```sql
SELECT count(*) FILTER (WHERE is_published) AS published, count(*) AS total
FROM matrix_map.site_aggregate_publications;
```

### Why "complete object presence" is NOT an authorization to reapply

This runbook authorizes exactly ONE state: a clean first apply, everything
absent. Any pre-existing lifecycle object means STOP, and a separate,
case-specific reapply/recovery adjudication based on the LIVE evidence in front
of you - not this generic document.

An earlier revision let "complete object presence" proceed to section 4. That
was unsafe generic authority, and the caveat under it being truthful did not
make it safe:

- The preflight proves that named relations and function SIGNATURES exist. It
  proves nothing about function BODIES, grants, policies, triggers, CHECK
  constraints, or column types on the objects that are already there.
- `CREATE TABLE IF NOT EXISTS` does not inspect an existing table at all, so a
  drifted column type or a dropped CHECK survives the apply untouched.
- **REAPPLY_01 does not close this gap.** It proves the PINNED BYTES are
  idempotent against a controlled fixture the harness itself created. It says
  nothing about an arbitrary live installation that may have been hand-edited,
  partially applied, or produced by an older revision of this file.

So an existing install is not "probably fine because the reapply is tested". It
is an UNKNOWN schema that happens to share object names. Adjudicate it
separately: capture the live definitions, diff them against the pinned bytes,
and decide with the owner what to do. Then, if a reapply is chosen, it is
authorized by THAT adjudication, not by this table.

What remains true and is NOT weakened by the above:

- The apply-time candidate-audit invariant remains the SINGLE implementation of
  that rule. Do not restore preflight 3.3c or reproduce its logic here.
- The migration is one transaction: a server-reported statement error before
  commit rolls everything back. Transport failures at or after `COMMIT` remain
  INDETERMINATE - go and look, per section 4.
- The reapply capability itself is real and tested. It is the generic
  AUTHORIZATION that is withdrawn, not the capability.

**Why the second row is NOT called "compatible reapply".** Presence is not
compatibility. This query set proves that the expected relations and function
signatures exist - it does NOT prove every grant, trigger, policy and function
BODY matches this exact draft.
Nor does the APPLY establish full compatibility. Be precise about what the
apply-time block actually validates: it checks the candidate-audit
`publication_id` invariant and nothing else. `CREATE TABLE IF NOT EXISTS` does
not inspect an existing table's definition at all, so drift in any OTHER
object - a dropped CHECK constraint, an altered column type, a changed policy
predicate, a revoked grant - survives BOTH the preflight and the apply, and the
migration can still commit. So the honest reading of this row is:

> **complete object presence only; neither this preflight nor the apply
> establishes full compatibility.**

Do not treat a green preflight as a guarantee that the apply will succeed. It
is a guarantee that you are not in an obviously partial state.

**Anything other than a clean first apply -- STOP. Do not apply.** Any
combination of the three preflight signals other than "everything absent" is
outside this runbook's authority. This is a RULE, not an enumerable checklist of
bad combinations: it is everything that is not the single authorized row.
Examples, not limits: either table present with a
signature mismatch; either table absent with any signature present; all
signatures present but one or both tables missing; one table present while the
other is absent; or any unexpected overload. A partial install means a previous
attempt failed midway or an object was hand-edited, and applying over it can
leave grants and triggers inconsistent with the function bodies. Surface the
exact 3.1 list, the 3.3 / 3.3b booleans and the 3.4 arrays, and get an explicit
decision.

### Invariant ownership -- read this before reporting a candidate-audit problem

The preflight above is READ-ONLY and classifies OBJECT and SIGNATURE presence
only. It deliberately does NOT evaluate the candidate-audit `publication_id`
invariant (NOT NULL, plus exactly one conforming foreign key: referencing
`matrix_map.site_aggregate_publications(id)`, `ON DELETE RESTRICT`,
single-column on both sides, and VALIDATED).

**That invariant has exactly ONE implementation: the apply-time fail-closed
block, `matrix_map.apply_candidate_audit_publication_id_invariant(...)`, which
runs inside this migration's single `BEGIN`/`COMMIT` transaction.** It is the
sole authority for both UPGRADE and COMPATIBILITY enforcement.

An earlier revision of this runbook carried a second, hand-maintained copy of
that rule as a preflight query (section "3.3c"). Two independent
implementations of one invariant disagreed in a different direction on each
review round - first the apply was laxer than the preflight, then the preflight
was stricter than the apply - and the second disagreement made the intended
legacy-upgrade path unreachable through this procedure. The duplicate was
removed rather than repaired again.

Two consequences, and note what the FIRST one does NOT authorize:

- **A legacy-shaped candidate-audit table (nullable `publication_id`, or no
  foreign key on it) does not fail any check in this section** - the preflight
  simply does not evaluate that invariant any more. **That is NOT permission to
  apply.** Such a table only exists on an EXISTING install, and an existing
  install STOPS under this generic runbook (see the state table above) pending a
  case-specific adjudication. The apply-time block is capable of upgrading it;
  whether that upgrade is run against your live database is decided by that
  adjudication, not here.
- **A genuinely incompatible shape is reported by the APPLY, not by this
  preflight** - and it aborts the whole script. Because the migration is one
  transaction, that abort rolls everything back: nothing is installed, nothing
  is dropped, validated, renamed, or repaired.

  **Handle whatever error you actually get, by its exact message. The list
  below is EXAMPLES, not an exhaustive set.** Enumerating every failure mode
  here would be a hand-maintained copy of the apply's decision tree, which is
  the defect this runbook was rewritten to remove; other structural drift can
  and does fail differently (a wrong-typed `publication_id` column, for
  instance, passes this preflight and then fails `ADD CONSTRAINT` with `42804`,
  which is none of the shapes below). Nothing is ever repaired for you.

  **The rollback guarantee has one limit, and it matters.** A SERVER-REPORTED
  statement error BEFORE commit aborts the transaction and rolls everything
  back - that is the case the examples below cover, and it is what NEG_01
  proves. But a TRANSPORT failure - the client times out, the connection drops,
  or the session dies at or just after `COMMIT` - can report an error to you
  while PostgreSQL actually COMMITTED. In that situation the outcome is
  INDETERMINATE and you must not assume nothing was installed. Go and look:
  run the section 5 postflight read-only, and treat what you find as the truth
  rather than what the client told you.

  The examples are worth naming because two of them share SQLSTATE `UE409`
  while calling for OPPOSITE remedies - so read the message, not just the code:
  - `UE409` naming a CONSTRAINT. The helper's fail-closed raise when a foreign
    key on `publication_id` already exists but does not match the exact spec
    (wrong delete action, wrong target, composite, or `NOT VALID`).
    **Do NOT simply drop the constraint the message names.** The message
    prefixes it with `e.g.` for a reason: the helper samples the
    ALPHABETICALLY FIRST foreign key on the column, which in a multi-FK failure
    can be the CONFORMING one. A table carrying the correct FK plus an extra
    incompatible one is a real, tested state, and if the correct constraint
    sorts first it is the one you will see named. Enumerate every foreign key
    on the column first (section 4.1) and remove only the one that fails the
    spec.
  - **`UE409` naming a COUNT OF ROWS, with no constraint mentioned.** Raised
    earlier, by the helper's data preflight, when the column is still nullable
    and already holds rows with a NULL `publication_id`; it fires BEFORE any
    foreign key is inspected, so there is no offending constraint to look for.
    Remedy: backfill or remove those rows. Do NOT go hunting for a constraint.
  - **`23503` `foreign_key_violation`, raised by PostgreSQL itself.** Route
    this one by SQLSTATE, not by whether a constraint is named: the message
    DOES name `site_aggregate_candidate_audit_publication_id_fkey`, but that
    constraint is the one the apply was ATTEMPTING to add, and it is rolled
    back with the transaction - it will not exist afterwards, so do not go
    looking for it. This is the case where NO foreign key exists yet and the
    table holds rows whose `publication_id` matches no publication:
    the helper reaches its `ADD CONSTRAINT`, PostgreSQL validates the existing
    rows, and the constraint creation fails. The data, not the schema, is the
    incompatibility. Resolve the orphaned rows (backfill or remove them) rather
    than looking for a constraint to fix.

  In every case the remedy is manual, and resolving the named defect does NOT
  by itself make a reapply safe. You are on an existing installation, which
  STOPS under section 3: the other live objects remain unchecked. Return to the
  case-specific adjudication, which is what authorizes any reapply.

Do not add a candidate-audit foreign-key or nullability check back into this
section. A contract test (`scripts/verify/__tests__/preapply-runbook.contract.test.mjs`)
fails if one reappears.

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

### 4.1 If the apply failed with a `UE409` naming a constraint

Read-only diagnostic. Run this BEFORE dropping anything.

This lives in section 4, deliberately NOT in the preflight. It is not a gate and
it decides nothing: the apply has already failed and rolled back by the time you
run it. Putting it in section 3 would recreate the duplicated-authority defect
this runbook was rewritten to remove.

The helper's message names only the alphabetically first foreign key on the
column, which is not necessarily the offending one. This lists them all with the
four properties the invariant requires, so you can identify which single
constraint fails the spec.

```sql
SELECT
  con.conname,
  con.confdeltype = 'r'                       AS on_delete_restrict,
  -- Explicit schema/table/COLUMN boolean, not a rendered relation name.
  -- confrelid::regclass omits the schema when the relation is visible on
  -- search_path, and a foreign key can target some OTHER unique column of the
  -- right table - which the apply-time helper rejects via fa.attname = 'id'.
  -- Displaying only the table name would show such a constraint as fully
  -- conforming and send you looking for a non-existent problem elsewhere.
  (fn.nspname = 'matrix_map'
    AND fc.relname = 'site_aggregate_publications'
    AND fa.attname = 'id')                    AS targets_publications_id,
  fn.nspname || '.' || fc.relname || '(' || fa.attname || ')' AS actual_target,
  array_length(con.conkey, 1) = 1
    AND array_length(con.confkey, 1) = 1      AS single_column_both_sides,
  con.convalidated                            AS validated
FROM pg_constraint con
JOIN pg_class c ON c.oid = con.conrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_class fc ON fc.oid = con.confrelid
JOIN pg_namespace fn ON fn.oid = fc.relnamespace
JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY(con.conkey)
JOIN pg_attribute fa ON fa.attrelid = con.confrelid AND fa.attnum = con.confkey[1]
WHERE n.nspname = 'matrix_map'
  AND c.relname = 'site_aggregate_candidate_audit'
  AND con.contype = 'f'
  AND a.attname = 'publication_id'
ORDER BY con.conname;
```

**The remedy is stated as a required END STATE, not as a list of cases.** That is
deliberate: an enumeration of failure modes here would be a second hand-written
copy of the helper's decision tree, and keeping two copies in agreement is the
exact defect this runbook was rewritten to remove. The end state below is
complete on its own.

> **Required end state: EXACTLY ONE row, with all four booleans true**
> (`on_delete_restrict`, `targets_publications_id`, `single_column_both_sides`,
> `validated`).

These are the same four conditions the apply-time helper enforces, so a row with
all four true is one the helper accepts. Act on whatever you actually see:

- **More than one row, some failing** - remove the failing ones. `actual_target`
  tells you why a row failed `targets_publications_id`.
- **More than one row, ALL passing** - they are duplicates. The invariant needs
  exactly one, so KEEP one and remove the rest. The helper counts foreign keys,
  not conforming ones, so two valid constraints still fail it.
- **Exactly one row, failing** - fix or remove it.
- **Exactly one row, all passing, AND you have just removed a non-conforming
  constraint** - this is the required end state for THIS constraint.
- **Exactly one row, all passing, on FIRST inspection** - the failure was NOT a
  foreign-key problem. Re-read the error message: most likely the NULL-rows
  `UE409` (a data problem) or a `23503`.
- **ZERO rows, and you have just removed a non-conforming constraint** - this
  is DONE for THIS constraint, not an error. The apply's no-foreign-key path
  creates the canonical constraint on the next run; do not hand-create a
  replacement.
- **ZERO rows on FIRST inspection, with a `UE409` naming a constraint** - the
  message named something that is not a foreign key on `publication_id` at all.
  This is the name-collision path: some other constraint (a CHECK, a UNIQUE, or
  an FK on a different column) already holds the name the migration wants to
  create. Inspect it BY NAME and rename or remove it:

```sql
SELECT con.conname, con.contype, pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_class c ON c.oid = con.conrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'matrix_map'
  AND c.relname = 'site_aggregate_candidate_audit'
  AND con.conname = 'site_aggregate_candidate_audit_publication_id_fkey';
```

In every branch: reach EITHER the required end state (exactly one row, all four
booleans true) OR zero rows with no name collision - the apply creates the
constraint itself from a clean no-FK state.

**Reaching that end state does NOT authorize the reapply.** You are on an
existing installation, which STOPS under this generic runbook (section 3). You
have fixed ONE constraint; that says nothing about the compatibility of the
other objects already in that database - function bodies, grants, policies,
triggers, CHECK constraints, column types. Return to the case-specific
adjudication, which is what authorizes any reapply. This section only tells you
what the invariant requires, not that you may proceed.

If a later reapply fails with a DIFFERENT message, treat that as a new
diagnosis from scratch rather than assuming this section covers it.

## 5. Read-only postflight (owner, against live)

Postflight is an ASSERTION step, not an observation step. Unlike the preflight -
which must tolerate an absent relation - every check below is REQUIRED to hold.
Any failure is an incident.

```sql
-- 5.0 REQUIRED: ALL THREE lifecycle tables now exist. Unlike 3.3 every one of
--     these must be TRUE. A false here means the apply did not take.
SELECT
  to_regclass('matrix_map.site_aggregate_publications') IS NOT NULL
    AS publications_table_exists,
  to_regclass('matrix_map.site_aggregate_publication_audit') IS NOT NULL
    AS publication_audit_table_exists,
  to_regclass('matrix_map.site_aggregate_candidate_audit') IS NOT NULL
    AS candidate_audit_table_exists;

-- 5.1 REQUIRED: all fifteen functions present. Expect exactly 15.
--     (The invariant-upgrade helper raised the total from 11 to 12; the text
-- meaningfulness helper `blank_trim` then raised it to 13; the semantic index
-- conformance guard `assert_conforming_dra_cluster_index` raised it to 14; F2
-- added `fetch_admin_site_aggregate_live_preview` to reach 15.)
--
--     F2 ALSO REPLACED THE UPSERT SIGNATURE. The five-argument
-- `upsert_site_aggregate_candidate(uuid, text, text, uuid, text)` is DROPPED and
-- the seven-argument form -- which carries the representative coordinate pair the
-- server derives the cluster id from -- is what conforms. This list previously
-- still expected the five-argument form and omitted the preview RPC entirely, so
-- after a CORRECT apply the check would have reported the old signature missing,
-- the new one unexpected, and never validated the preview function at all. A
-- holistic review caught it: a postflight that false-alarms on a correct apply is
-- worse than no postflight, because it burns the operator's trust in the gate.
--     (Same object list as 3.1 / 3.4.)
--
--     This step previously carried only the prose above and no query, so the
--     check section 5 declares REQUIRED could not actually be performed. It is
--     executable now. Compare by exact SIGNATURE, not by a name count, for the
--     same reason 3.4 does: a missing function plus a stale overload still
--     reaches the expected total.
WITH expected(sig) AS (
  VALUES
    ('matrix_map.apply_candidate_audit_publication_id_invariant(text, text)'),
    ('matrix_map.assert_conforming_dra_cluster_index(text, text, regclass)'),
    ('matrix_map.blank_trim(text)'),
    ('matrix_map.canonical_five_decimal_cluster(double precision, double precision)'),
    ('matrix_map.current_site_aggregate_snapshot(uuid, text)'),
    ('matrix_map.enforce_site_aggregate_publication_via_rpc()'),
    ('matrix_map.fetch_admin_site_aggregate_publications(uuid, integer, integer)'),
    ('matrix_map.fetch_published_site_aggregates(integer, integer)'),
    ('matrix_map.fetch_site_aggregate_candidate_audit(uuid)'),
    ('matrix_map.fetch_site_aggregate_publication_audit(uuid)'),
    ('matrix_map.flip_site_aggregate_public(uuid, boolean, uuid, text, timestamp with time zone)'),
    ('matrix_map.lock_site_aggregate_publication_sources()'),
    ('matrix_map.site_aggregate_count_bucket(integer)'),
    ('matrix_map.fetch_admin_site_aggregate_live_preview(uuid, text, integer)'),
    ('matrix_map.upsert_site_aggregate_candidate(uuid, text, double precision, double precision, text, uuid, text)')
),
actual(sig) AS (
  SELECT format('%s.%s(%s)', n.nspname, p.proname, pg_catalog.oidvectortypes(p.proargtypes))
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'matrix_map'
    AND p.proname IN (
      'site_aggregate_count_bucket','enforce_site_aggregate_publication_via_rpc',
      'fetch_published_site_aggregates','fetch_admin_site_aggregate_publications',
      'fetch_site_aggregate_publication_audit','canonical_five_decimal_cluster',
      'current_site_aggregate_snapshot','lock_site_aggregate_publication_sources',
      'flip_site_aggregate_public','upsert_site_aggregate_candidate',
      'fetch_site_aggregate_candidate_audit',
      'apply_candidate_audit_publication_id_invariant','blank_trim',
      'assert_conforming_dra_cluster_index',
      'fetch_admin_site_aggregate_live_preview')
)
SELECT
  (SELECT count(*) FROM expected e JOIN actual a ON a.sig = e.sig) AS matching_signatures,
  (SELECT count(*) FROM expected) AS expected_signatures,
  COALESCE((SELECT array_agg(sig ORDER BY sig) FROM (
     SELECT sig FROM expected EXCEPT SELECT sig FROM actual) m), '{}') AS missing,
  COALESCE((SELECT array_agg(sig ORDER BY sig) FROM (
     SELECT sig FROM actual EXCEPT SELECT sig FROM expected) u), '{}') AS unexpected_overloads;

-- 5.1 REQUIRED result: matching_signatures = 15, expected_signatures = 15,
--     missing = {} and unexpected_overloads = {}. Anything else is an incident.

-- 5.2 THE INVARIANT. These must match section 3.2 EXACTLY.
SELECT count(*) FILTER (WHERE public) AS public_dras, count(*) AS total_dras
FROM matrix_map.dras WHERE is_deleted = false;

SELECT count(*) FILTER (WHERE public) AS public_samples, count(*) AS total_samples
FROM matrix_map.samples;

-- 5.3 No publication was silently flipped by the apply.
SELECT count(*) FILTER (WHERE is_published) AS published, count(*) AS total
FROM matrix_map.site_aggregate_publications;

-- 5.4 The installed member RPC has the reviewed IDENTITY, SECURITY ENVELOPE,
--     EXECUTE ACL and exact exposed RETURN PROJECTION.
--
--     WHAT THIS PROVES, precisely:
--       * the function installed at
--         matrix_map.fetch_published_site_aggregates(integer, integer) exists;
--       * its owner is matrix_map_owner;
--       * it is SECURITY DEFINER with the reviewed search_path;
--       * it is set-returning and its output projection is EXACTLY the reviewed
--         eight columns, in order;
--       * its DIRECT EXECUTE ACL grantees are EXACTLY {the owner, authenticated};
--       * PUBLIC holds no direct EXECUTE privilege;
--       * anon and service_role have no EFFECTIVE EXECUTE privilege under the
--         installed role graph.
--
--     WHAT IT DOES NOT CLAIM, stated so the claim stays honest:
--       * it does NOT claim superusers cannot execute -- they bypass ACLs;
--       * it does NOT universally analyse arbitrary future role-membership
--         relationships. It compares the DIRECT grantee set exactly. Effective
--         EXECUTE privilege is checked for all three named roles: authenticated
--         must have EXECUTE; anon and service_role must not have EXECUTE;
--       * it does NOT prove the semantics of the function BODY. Member safety of
--         the body -- suppressing raw source_dra_id, bucketing counts, rounding
--         coordinates -- is bound to the pinned reviewed SQL bytes and the replay
--         evidence. A body rewritten in place while keeping this envelope would
--         pass here; the byte pin and the replay are what cover that.
--
--     NULL proacl IS NOT AN EMPTY ACL. For functions the DEFAULT ACL includes
--     PUBLIC EXECUTE, so a NULL proacl means PUBLIC CAN execute and MUST fail
--     this postflight. An earlier version of this query expanded proacl directly
--     and therefore reported "PUBLIC denied" for exactly that case. The
--     COALESCE below is load-bearing, not defensive style.
WITH f AS (
  SELECT p.oid, p.proowner, p.prosecdef, p.proconfig, p.proretset,
         COALESCE(p.proacl, acldefault('f', p.proowner)) AS acl,
         p.proargnames, p.proallargtypes, p.proargmodes
  FROM pg_proc p
  WHERE p.oid = to_regprocedure('matrix_map.fetch_published_site_aggregates(integer,integer)')::oid
),
proj AS (
  SELECT string_agg(format('%s %s', u.name, format_type(u.typ, NULL)), ', ' ORDER BY u.ord) AS cols
  FROM f, unnest(f.proargnames, f.proallargtypes, f.proargmodes)
       WITH ORDINALITY AS u(name, typ, mode, ord)
  WHERE u.mode = 't'
),
actual AS (
  SELECT DISTINCT a.grantee FROM f, aclexplode(f.acl) a WHERE a.privilege_type = 'EXECUTE'
),
expected AS (
  SELECT proowner AS grantee FROM f
  UNION
  SELECT 'authenticated'::regrole::oid
),
unexpected AS (SELECT grantee FROM actual EXCEPT SELECT grantee FROM expected),
missing    AS (SELECT grantee FROM expected EXCEPT SELECT grantee FROM actual)
SELECT
  (SELECT count(*) FROM f) = 1 AS identity_exists,
  (SELECT pg_get_userbyid(proowner) FROM f) = 'matrix_map_owner' AS owner_ok,
  (SELECT prosecdef FROM f) AS security_definer_ok,
  (SELECT proconfig @> ARRAY['search_path=matrix_map, public, pg_temp'] FROM f) AS search_path_ok,
  (SELECT proretset FROM f) AS returns_set_ok,
  (SELECT cols FROM proj) = 'aggregate_id uuid, label text, representative_latitude double precision, representative_longitude double precision, coordinate_quality_tier text, sample_count_bucket text, data_snapshot_version text, visible_sample_suppression_key text' AS return_projection_exact,
  ((SELECT count(*) FROM unexpected) = 0 AND (SELECT count(*) FROM missing) = 0) AS direct_exec_grantees_exact,
  (SELECT count(*) = 0 FROM actual WHERE grantee = 0) AS public_direct_exec_denied,
  (SELECT has_function_privilege('authenticated', oid, 'EXECUTE') FROM f) AS authenticated_exec_ok,
  (SELECT NOT has_function_privilege('anon', oid, 'EXECUTE') FROM f) AS anon_exec_denied,
  (SELECT NOT has_function_privilege('service_role', oid, 'EXECUTE') FROM f) AS service_role_exec_denied,
  COALESCE((SELECT array_agg(CASE WHEN grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END ORDER BY grantee) FROM unexpected), '{}') AS unexpected_direct_exec_grantees,
  COALESCE((SELECT array_agg(CASE WHEN grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END ORDER BY grantee) FROM missing), '{}') AS missing_direct_exec_grantees,
  (SELECT pg_get_userbyid(proowner) FROM f) AS actual_owner,
  (SELECT array_to_string(proconfig, ' | ') FROM f) AS actual_search_path,
  (SELECT cols FROM proj) AS actual_projection;
```

**REQUIRED RESULT for 5.4 -- exactly ONE row, matching ALL of the following.**

| Column | Required |
|---|---|
| `identity_exists` | `t` |
| `owner_ok` | `t` |
| `security_definer_ok` | `t` |
| `search_path_ok` | `t` |
| `returns_set_ok` | `t` |
| `return_projection_exact` | `t` |
| `direct_exec_grantees_exact` | `t` |
| `public_direct_exec_denied` | `t` |
| `authenticated_exec_ok` | `t` |
| `anon_exec_denied` | `t` |
| `service_role_exec_denied` | `t` |
| `unexpected_direct_exec_grantees` | `{}` |
| `missing_direct_exec_grantees` | `{}` |

The three trailing value columns are triage diagnostics; their expected values:

| Column | Expected |
|---|---|
| `actual_owner` | `matrix_map_owner` |
| `actual_search_path` | `search_path=matrix_map, public, pg_temp` |
| `actual_projection` | `aggregate_id uuid, label text, representative_latitude double precision, representative_longitude double precision, coordinate_quality_tier text, sample_count_bucket text, data_snapshot_version text, visible_sample_suppression_key text` |

**ANYTHING ELSE IS AN INCIDENT: stop, do not publish anything, surface it.**
`unexpected_direct_exec_grantees` names any role that gained EXECUTE (rendering
grantee OID 0 as `PUBLIC`); `missing_direct_exec_grantees` names any expected
grant that disappeared. A missing function blanks `identity_exists` and the
dependent columns.

Effective EXECUTE privilege is checked for all three named roles: authenticated
must have EXECUTE; anon and service_role must not have EXECUTE.
`has_function_privilege` is never used for PUBLIC: PUBLIC is not an ordinary
role, and `has_function_privilege`
on a real role already returns true when PUBLIC holds the privilege. The PUBLIC
condition is therefore tested by expanding the ACL directly, which also names
the cause.

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

- **Updated 2026-07-27:** the harness now DOES exist on `main` - it landed with
  the PR #752 squash merge (`8f4b67ea`). An earlier revision of this section said
  `git ls-tree origin/main -- scripts/matrix-map/validation/` returns empty; that
  was true when written and is now FALSE. "No workflow could invoke it" is
  therefore no longer the reason CI is deferred.
- The reason that DOES still hold: the harness is Windows/PowerShell and requires
  a local Docker daemon plus a locally pre-pulled pinned image, failing closed
  when the image is absent and never pulling. It cannot run as written on a
  standard Linux runner.

Wiring it into CI is therefore a separate piece of work with its own design
(portability, image provisioning, runner cost), deliberately out of scope here.
Until then the replay is a **local, owner-or-session-run gate** whose evidence is
attached to the PR, and this runbook is the thing that makes it mandatory.
