# FRESH SESSION HANDOFF -- Option C restack correction (2026-07-27)

Session anchor for the Option C candidate-lifecycle restack correction pass on
PR #754. Plain ASCII. Written BEFORE the commit it belongs to, deliberately: see
"Gate status" below.

> **READ FIRST.** This document is written in chronological order, so its middle
> sections describe mechanisms and pins that were later SUPERSEDED. Two final
> sections are authoritative and override everything earlier:
>
> 1. **"Verification architecture SIMPLIFIED (2026-07-28)"** -- the verification
>    method. The RETIRED mechanism is the STATIC RPC ALLOW-LIST analysis on the
>    candidate-route and site-aggregate page contract surfaces addressed by this
>    correction: the regex RPC allow-lists, the TypeScript-compiler AST walkers
>    and their self-tests, the forbidden-pattern regexes and their comment
>    stripper, the type-versus-value lookahead, the consumer inventory and the
>    structural pin. None of those exists on those surfaces.
>
>    **This is NOT a tree-wide claim.** It does not say that no source-text
>    guard, no regex and no source concatenation exists anywhere. Narrowly
>    scoped source checks -- notably the column-projection and containment
>    guards in `page.contract.test.ts`, which read the page and loaders together
>    and use regexes -- were never in scope and remain in place. What was
>    retired is the claim that such a scan can enumerate the RPCs a module can
>    reach.
> 2. **"Exact-ID post-commit verification (2026-07-28)"** -- the candidate
>    write/verify design AND the current SQL pin.
>
> **The SQL pin CHANGED.** It is now 99831 bytes,
> `003E163324004C50649D705896D5FD9C40A97AB188699AE94566D43EA84E6EED`. Any
> reference anywhere to 97326 bytes / `1B8AA3AE...` is superseded, and **every
> FINAL24 receipt is INVALIDATED** -- those bind the old digest.
>
> **THE CURRENT EVIDENCE SET IS `FINAL32`.** It is the only set generated from
> the FINAL harness, test and documentation bytes, and it covers everything:
> - **SQL replay** -- FINAL32 positive (`strict_pass: true`,
>   `missing_test_ids: []`, `required_test_count: 69`, 69 passed / 0 failed),
>   NEG_01 and REAPPLY_01, all binding the unchanged SQL digest.
>   **Regenerated because the replay HARNESS itself changed** -- its required-id
>   baseline stopped at TEST_64 while the suite had grown to TEST_69, so the
>   pre-apply gate could have reported GREEN with the exact-ID contract checks
>   absent. Earlier replay receipts predate that fix.
> - **TypeScript, tests and docs** -- FINAL32 gate logs and manifest.
>
> **Superseded:** FINAL24 (invalidated -- binds a retired SQL digest), FINAL26,
> FINAL27, FINAL28, FINAL29 and FINAL30/FINAL31. Do not cite any of them as
> current. FINAL30's full-suite logs are retained as history only.
>
> **Non-authoritative:** the `.tmp` mutation receipt generator and its derived
> receipt (see the authority note further down). Raw mutation logs remain valid.

---

## 0. BLOCKER -- D2 / live SQL apply is BLOCKED until F2 is resolved and merged

**Read this before scheduling any apply. It is not backlog and not optional
hardening.**

Coordinate cluster identity is implemented INDEPENDENTLY in two runtimes:

| Runtime | Implementation | Location |
|---|---|---|
| JavaScript | `latitude.toFixed(5)` / `longitude.toFixed(5)` | `src/lib/matrix-map/siteAggregates.ts` (`coordinateClusterId`) |
| PostgreSQL | `to_char(round(p_lat::numeric, 5), 'FM9990.00000')` | `matrix_map.canonical_five_decimal_cluster` in the Option C draft SQL |

`toFixed` rounds the binary double; `round(numeric, 5)` is half-away-from-zero
on the decimal value. On a five-decimal rounding boundary they can disagree, so
the admin page renders an aggregate, sends that cluster key to
`upsert_site_aggregate_candidate`, and the RPC answers `snapshot is empty`
(`UE409`) for a site the operator can see.

This is the FOURTH instance in this workstream of one rule implemented twice,
and the only one that could not be closed inside PR #754: unlike the other three
it lives in `siteAggregates.ts`, which is SHARED base code outside this
branch's change set. Correcting it properly crosses into the shared aggregation
architecture and is a design decision, not a patch.

**Owner ruling (2026-07-27):**

- Do NOT patch JavaScript rounding or change `siteAggregates.ts` in this
  correction pass.
- **D2 / live SQL apply is BLOCKED** until a focused follow-up PR establishes ONE
  authoritative cluster-identity path and is reviewed, gated, merged, and
  replay-verified.
- That follow-up PR is **the next flagship task after #754**, before any
  production apply.
- The follow-up should prefer SERVER-DERIVED canonical keys over another
  hand-maintained cross-runtime rounding emulation. That design is explicitly
  NOT authorized in this correction pass.

Why the isolation is safe in the meantime: D2 remains unauthorized and the
lifecycle fails closed without the SQL applied, so the divergence cannot reach
production while this blocker stands. It becomes reachable the moment the SQL is
applied, which is exactly what the block prevents.

---

## 1. Where this lives

| Pin | Value |
|---|---|
| Worktree | `C:\Projects\SSTAC-Dashboard-worktrees\option-c-candidate-restack-20260727` |
| Branch | `feat/option-c-candidate-lifecycle-restack-2026-07-27` |
| Base | `8f4b67eafd4f46a0b4a795c51bbd97838645b977` (= `origin/main` at the time of the restack) |
| PR | **#754**, DRAFT, base `main` |
| Superseded PR | #753, CLOSED as superseded 2026-07-27. Branch and worktree RETAINED, not deleted. |

The local `main` ref in this checkout is STALE. That is expected and is not
drift. Compare against `origin/main`.

PR #754 is left **DRAFT and UNMERGED**. Merge is an owner-only action.

---

## 2. What this correction pass changed, and why

### The problem it fixes

The owner-run pre-apply runbook carried a preflight query (its section "3.3c")
that re-implemented the candidate-audit `publication_id` invariant a second
time, by hand, in a markdown document. The apply-time helper
`matrix_map.apply_candidate_audit_publication_id_invariant(...)` implemented the
same rule in SQL.

Four consecutive targeted review rounds each found a NEW way the two disagreed:

| Round | Findings |
|---|---|
| 1 | 2 P1 + 6 P2 |
| 2 | 2 open of 8 |
| 3 | 2 P1 + 4 P2 + 1 P3 (apply LAXER than preflight) |
| 4 | 2 P1 + 3 P2 (preflight STRICTER than apply) |

Two of those P1s were introduced BY the previous round's fix. Round 4's first P1
was the serious one: because 3.3c demanded a conforming FK before proceeding, a
legacy-shaped table -- exactly the state the apply-time helper exists to UPGRADE
-- failed the preflight and the runbook ordered STOP. The intended upgrade path
was unreachable through the documented procedure.

Contract tests over prose could not close this. They assert that TEXT exists,
not that two implementations agree.

### The fix (owner ruling: collapse to one authority)

- **Runbook 3.3c DELETED.** The preflight is now read-only classification of
  OBJECT and SIGNATURE presence only (3.1, 3.2, 3.3, 3.3b, 3.4). 3.4's exact
  signature comparison was KEPT -- it has no apply-time counterpart, because
  `CREATE OR REPLACE FUNCTION` never removes a stale overload.
- **The apply-time fail-closed block is the SOLE authority** for both upgrade
  and compatibility enforcement. It runs inside the migration's single
  `BEGIN`/`COMMIT`, so a `UE409` aborts and rolls the whole script back.
- **`AND con.convalidated` added** to the helper's conforming-FK predicate
  (round 4's second P1). A `NOT VALID` foreign key is enforced for NEW rows
  only, so it never establishes the invariant over rows that already exist. Such
  a constraint now fails closed with `UE409` and is NOT dropped, validated,
  renamed, or repaired.
- **A new "Invariant ownership" section** in the runbook states plainly that the
  preflight no longer evaluates that invariant at all, and that an incompatible
  shape is reported by the APPLY rather than the preflight. It also states
  explicitly that a legacy-shaped table NOT failing the preflight is not
  permission to apply: any existing install STOPS pending a case-specific
  adjudication (see "The runbook now authorizes ONLY a clean first apply").

### The SECOND, larger correction: drift became SERVER-AUTHORITATIVE

After the 3.3c collapse landed, ten adversarial review rounds exposed a deeper
problem in the admin UI. The client recomputed the live aggregate in TypeScript
and compared it field-by-field against the persisted candidate. That made the
client a SECOND implementation of a PostgreSQL aggregate, and over an
unconstrained `text` column the two could not be reconciled:

| Divergence | SQL | TypeScript |
|---|---|---|
| sample population | all tiers | medium-only (pre-filtered query) |
| blank sources | `length(trim(...)) > 0` | truthiness, so `'   '` survived |
| trim character set | `trim` strips U+0020 ONLY | `.trim()` strips all ECMAScript whitespace |
| sort order | `COLLATE "C"` = UTF-8 BYTES | `.sort()` = UTF-16 CODE UNITS |

Every one produced PERMANENT drift that no Refresh could clear, and each fix
revealed the next. The owner ruled Option 3: retire the whole parity class.

**`matrix_map.fetch_admin_site_aggregate_publications` now returns
`snapshot_drift_state`** ('match' | 'drift' | 'unknown'), derived server-side by
comparing the persisted `source_sample_hash` against the one recomputed by
`current_site_aggregate_snapshot` via a LEFT JOIN LATERAL. The client only reads
it (`resolveSnapshotDriftState`), mapping absent/unrecognised to `unknown`,
never `match`.

**HIGHEST-RISK CHANGE IN THIS PR - review it as such.** Adding a column to a
`RETURNS TABLE` cannot go through `CREATE OR REPLACE` (PostgreSQL raises 42P13,
"cannot change return type of existing function"). The function is therefore
installed as:

```sql
DROP FUNCTION IF EXISTS matrix_map.fetch_admin_site_aggregate_publications(uuid) RESTRICT;
DROP FUNCTION IF EXISTS matrix_map.fetch_admin_site_aggregate_publications(uuid, integer, integer) RESTRICT;
CREATE FUNCTION matrix_map.fetch_admin_site_aggregate_publications(...)
```

RESTRICT and never CASCADE, so it fails closed on any dependent object;
ownership, REVOKE and GRANT are reinstated immediately after, inside the same
transaction. REAPPLY_01 exercises this path.

Access posture is UNCHANGED: `current_site_aggregate_snapshot` is granted to
nobody and stays REVOKEd from PUBLIC/anon/authenticated/service_role. The RPC
reaches it only by being SECURITY DEFINER owned by `matrix_map_owner`, which
owns it. TEST_35 asserts exactly this.

LEFT, not INNER: a publication whose live aggregate has vanished still appears
and reports `unknown`, so an orphan keeps its Unpublish route (TEST_34).

Consequently the admin page was REVERTED to its medium-only query and single
medium-only aggregate, and `siteAggregates.ts` was reverted to base - the
all-tier plumbing and the trim/blank emulation existed only to serve the client
comparison that no longer exists.

### Operator surface: medium-tier preview, ALL-TIER candidate

The table, map and summary are a MEDIUM-TIER preview. The candidate that
Create/Refresh persist - and that becomes member-visible - spans EVERY tier in
the cluster. Those two populations legitimately differ, and conflating them let
an operator review one and publish another.

The Actions column therefore renders the persisted all-tier candidate
("All-tier publication candidate": total, high/medium/low, distinct points,
dominant tier, count bucket) beside the medium-tier row. Those values come from
the admin RPC - they are NOT recomputed client-side, and must not be.

Fail-closed action rules, all covered by component tests:

| State | Publish | Refresh | Unpublish |
|---|---|---|---|
| `match` | enabled | enabled | n/a |
| `drift` | DISABLED, badge shown | enabled (it is the remedy) | n/a |
| `unknown` | DISABLED, badge shown | enabled | n/a |
| published + any state | n/a | n/a | ALWAYS available |

Drift/unknown badges render OUTSIDE the button branches, so a PUBLISHED stale
candidate still shows them. Publish is gated at the handler as well as the
attribute.

### Post-commit responses are not retryable

BOTH admin routes now share one contract. Post-commit outcomes return
`committed: true`, `verified: false`, `retry_safe: false` and an operator-facing
`detail`, at **409 rather than 5xx** -- a 5xx read as "transient, safe to retry"
and invited a second write against an already-changed row:

- candidate route: `readback_failed`, `verification_incomplete`,
  `verification_failed`, `verification_label_mismatch`;
- publish route: `readback_failed`, `readback_missing`, `verification_failed`.

A TRANSPORT failure at either RPC (postgrest-js `status === 0`) returns
`commit_indeterminate` with `committed: null` -- genuinely unknown, so it
asserts neither outcome. A 5xx does the same, with exactly ONE exemption:
`55P03`.

The exemption is narrow because PostgREST derives HTTP status from SQLSTATE,
and only one code in this system both lands at 5xx and is definitionally
pre-commit. `55P03` (lock_not_available, raised by our `LOCK ... NOWAIT`) falls
in the `55*` class and maps to 500, and the lock failing means the mutation
never ran. By contrast our custom `UE*` codes hit PostgREST's catch-all and
arrive at 400, and `42501` arrives at 403 -- neither reaches the 5xx branch at
all, so neither needs exempting. `XX*` internal errors map to 500 and stay
indeterminate, because they genuinely are.

Consequently a forged application code inside an anomalous 5xx body is NOT
trusted: `UE409` at 500 did not come from PostgREST, so the outcome is unknown
and the response fails closed. `rpc_failed` is reachable only where PostgREST
answered with a 4xx. Both route test helpers encode this mapping
(`realisticPostgrestStatus`) so no test can assert an impossible status/code
pair -- an earlier helper defaulted every errored RPC to HTTP 200, which no
PostgREST deployment returns, and that default concealed a real defect.

Pre-commit failures (a SQLSTATE reported at a non-5xx status) carry BOTH
fields explicitly: `committed: false` and `retry_safe: true`. Silence is not
used to mean "safe", because these routes also return 409 for POST-commit
outcomes, so the client cannot infer retryability from status alone. The client
requires a BOOLEAN `retry_safe` on any status that is not provably pre-commit
(400/401/403/404/415/422) and latches on anything else.

The client latches its submit control when the server says
`retry_safe: false`, AND when a dispatched request yields no usable answer at
all (`dispatched && !responseObserved`) -- which covers a dropped connection, an
unreadable body, and a body that parses to `null`. Once latched the control
reads "Reload required" and is gated at BOTH the handler and the attribute.

### The runbook now authorizes ONLY a clean first apply

Any pre-existing lifecycle object means STOP and a separate, case-specific
reapply/recovery adjudication from live evidence. Object and signature presence
prove nothing about bodies, grants, policies, triggers, CHECK constraints or
column types on objects already there, and REAPPLY_01 proves only that the
PINNED BYTES are idempotent against a controlled fixture - not that an arbitrary
live installation is compatible. The reapply CAPABILITY is real and tested; the
generic AUTHORIZATION is what was withdrawn.

### Two things a future session must NOT undo

1. **Do not add a candidate-audit foreign-key or nullability check back into
   runbook section 3.** A contract test in
   `scripts/verify/__tests__/preapply-runbook.contract.test.mjs` fails if any
   executable preflight statement combines the candidate-audit relation with a
   constraint/nullability catalog. The guard is deliberately narrow: a
   `pg_constraint` query about a DIFFERENT table stays legal.
2. **Do not add a duplicate FK-shape assertion to the POSTFLIGHT (section 5)
   either.** That would recreate the same root cause in a new location. Section
   5.1 already asserts all thirteen functions are present, and a COMMITTED
   transaction in which the helper ran is itself the proof.

---

## 3. Files changed in this commit

**All 23 paths carry uncommitted correction bytes and are NOT identical to
`dee37c5e`. A reviewer must include every one of them in scope.**

The authoritative, always-current list is `paths[]` in `EVIDENCE_MANIFEST.json`.
That file lives OUTSIDE this repository, under the mission-control run root
(`.tmp/mission-control/.../restack-20260727/`), deliberately: it is process
evidence, not shipped source. If this prose and that manifest ever disagree, the
manifest is right and this prose is stale -- but the prose is reproduced in full
here so a reviewer with no access to the run root can still scope correctly.

 1. `FRESH_SESSION_HANDOFF_2026_07_27_OPTION_C_RESTACK_CORRECTION.md`
 2. `docs/_meta/docs-manifest.json`
 3. `docs/design/matrix-map/OPTION_C_PHASE2_SITE_AGGREGATE_PUBLICATIONS_DRAFT_2026_07_24.sql`
 4. `docs/design/matrix-map/OPTION_C_PREAPPLY_RUNBOOK_2026_07_26.md`
 5. `scripts/matrix-map/validation/option-c-phase2/replay-migrations-postgis.ps1`
 6. `scripts/matrix-map/validation/option-c-phase2/test-option-c.sql`
 7. `scripts/verify/__tests__/preapply-runbook.contract.test.mjs`
 8. `src/app/(dashboard)/admin/matrix-map/site-aggregates/SiteAggregateAdminActions.tsx`
 9. `src/app/(dashboard)/admin/matrix-map/site-aggregates/__tests__/SiteAggregateAdminActions.test.tsx`
10. `src/app/(dashboard)/admin/matrix-map/site-aggregates/__tests__/page.contract.test.ts`
11. `src/app/(dashboard)/admin/matrix-map/site-aggregates/page.tsx`
12. `src/app/api/matrix-map/admin/site-aggregates/candidate/__tests__/route.contract.test.ts`
13. `src/app/api/matrix-map/admin/site-aggregates/candidate/__tests__/route.test.ts`
14. `src/app/api/matrix-map/admin/site-aggregates/candidate/route.ts`
15. `src/app/api/matrix-map/admin/site-aggregates/publish/__tests__/route.test.ts`
16. `src/app/api/matrix-map/admin/site-aggregates/publish/route.ts`
17. `src/lib/matrix-map/__tests__/blank-trim.test.ts`
18. `src/lib/matrix-map/__tests__/fetch-site-aggregates-server.test.ts`
19. `src/lib/matrix-map/__tests__/site-aggregate-lifecycle-rows.test.ts`
20. `src/lib/matrix-map/__tests__/site-aggregate-publication-migration.test.ts`
21. `src/lib/matrix-map/blank-trim.ts`
22. `src/lib/matrix-map/fetch-site-aggregates-server.ts`
23. `src/lib/matrix-map/site-aggregate-lifecycle-rows.ts`

`docs/_meta/docs-manifest.json` designates this file as the authoritative
continuity handoff, so this inventory must be refreshed whenever the path set
changes.

Complete inventory at the time of writing (23):

 1. `FRESH_SESSION_HANDOFF_2026_07_27_OPTION_C_RESTACK_CORRECTION.md`
 2. `docs/_meta/docs-manifest.json`
 3. `docs/design/matrix-map/OPTION_C_PHASE2_SITE_AGGREGATE_PUBLICATIONS_DRAFT_2026_07_24.sql`
 4. `docs/design/matrix-map/OPTION_C_PREAPPLY_RUNBOOK_2026_07_26.md`
 5. `scripts/matrix-map/validation/option-c-phase2/replay-migrations-postgis.ps1`
 6. `scripts/matrix-map/validation/option-c-phase2/test-option-c.sql`
 7. `scripts/verify/__tests__/preapply-runbook.contract.test.mjs`
 8. `src/app/(dashboard)/admin/matrix-map/site-aggregates/SiteAggregateAdminActions.tsx`
 9. `src/app/(dashboard)/admin/matrix-map/site-aggregates/__tests__/SiteAggregateAdminActions.test.tsx`
10. `src/app/(dashboard)/admin/matrix-map/site-aggregates/__tests__/page.contract.test.ts`
11. `src/app/(dashboard)/admin/matrix-map/site-aggregates/page.tsx`
12. `src/app/api/matrix-map/admin/site-aggregates/candidate/__tests__/route.contract.test.ts`
13. `src/app/api/matrix-map/admin/site-aggregates/candidate/__tests__/route.test.ts`
14. `src/app/api/matrix-map/admin/site-aggregates/candidate/route.ts`
15. `src/app/api/matrix-map/admin/site-aggregates/publish/__tests__/route.test.ts`
16. `src/app/api/matrix-map/admin/site-aggregates/publish/route.ts`
17. `src/lib/matrix-map/__tests__/blank-trim.test.ts`
18. `src/lib/matrix-map/__tests__/fetch-site-aggregates-server.test.ts`
19. `src/lib/matrix-map/__tests__/site-aggregate-lifecycle-rows.test.ts`
20. `src/lib/matrix-map/__tests__/site-aggregate-publication-migration.test.ts`
21. `src/lib/matrix-map/blank-trim.ts`
22. `src/lib/matrix-map/fetch-site-aggregates-server.ts`
23. `src/lib/matrix-map/site-aggregate-lifecycle-rows.ts`

Grouped by what changed:

**SQL and its controls:**

- `docs/design/matrix-map/OPTION_C_PHASE2_SITE_AGGREGATE_PUBLICATIONS_DRAFT_2026_07_24.sql`
  -- `con.convalidated` in the conforming-FK predicate; reapply safety for the
  lock helper (`DROP ... RESTRICT` + bare `CREATE`) and the candidate-audit
  policy (`DROP POLICY IF EXISTS`); and the server-authoritative
  `snapshot_drift_state` on the admin RPC, installed via `DROP ... RESTRICT` +
  `CREATE` because the RETURNS TABLE shape changed.
- `docs/design/matrix-map/OPTION_C_PREAPPLY_RUNBOOK_2026_07_26.md` -- 3.3c
  removed; state table reduced to three signals; Invariant ownership section;
  error shapes stated as EXAMPLES not an exhaustive list; commit-time transport
  failures called INDETERMINATE; executable 5.1; all three lifecycle tables in
  both flights; section 4.1 post-failure diagnostic; the mandatory gate now
  requires THREE invocations and both control receipts; SQL digest re-pinned.
- `scripts/matrix-map/validation/option-c-phase2/test-option-c.sql` -- TEST_29
  (NOT VALID negative control) plus TEST_30-TEST_35 for server-authoritative
  drift: match; coordinate_source-only drift; sample-IDENTITY-only drift (the
  case no field-by-field comparison could ever see); mixed-tier match after
  refresh; missing live snapshot reporting unknown with the row still returned;
  and an authorization assertion that the snapshot helper stays unreachable
  directly while the admin RPC keeps its 42501 role boundary. TEST_03's
  description was corrected so it no longer implies the migration is CREATE-only.
- `scripts/matrix-map/validation/option-c-phase2/replay-migrations-postgis.ps1`
  -- `requiredTestIds` through TEST_35; `-NegativeLegacyReplay` (NEG_01) and
  `-PositiveReapplyControl` (REAPPLY_01) modes; one canonical semantic catalog
  fingerprint shared by both.

**Client, now free of any SQL reimplementation:**

- `.../site-aggregates/SiteAggregateAdminActions.tsx` -- `computeSnapshotDrift`,
  `LiveAggregateSnapshot`, `round5` and the `liveSnapshot` prop DELETED;
  replaced by `resolveSnapshotDriftState`, which reads the server verdict and
  maps absent/unrecognised to `unknown`. Also surfaces the post-commit
  "already committed, do not retry blindly" detail instead of the bare code.
- `.../site-aggregates/page.tsx` -- medium-only query and single medium-only
  aggregate (unchanged visible behaviour); no client drift comparison; the
  misleading "there is no write path here" footer corrected.
- `.../site-aggregates/__tests__/SiteAggregateAdminActions.test.tsx` and
  `.../__tests__/page.contract.test.ts` -- rewritten for the server-authoritative
  contract; the page contract asserts the client reimplements no SQL string
  aggregation or hash semantics.
- `.../candidate/route.ts`, `.../candidate/__tests__/route.test.ts`,
  `.../candidate/__tests__/route.contract.test.ts` -- audited write path plus
  `unwrapCallee` so a wrapped callee like `(client.rpc)('x')` cannot evade the
  RPC allow-list.
- `src/lib/matrix-map/fetch-site-aggregates-server.ts` and its test.
- `src/lib/matrix-map/__tests__/site-aggregate-publication-migration.test.ts` --
  order/count-anchored, comment-stripped assertions for the lock helper's
  DROP-before-CREATE, with adjacency; the negative assertion forbidding
  `CREATE OR REPLACE` on that helper is PRESERVED.
- `scripts/verify/__tests__/preapply-runbook.contract.test.mjs` (new) -- runbook
  contract guards, including the narrow anti-duplication guard and the
  three-invocation gate assertions.

Plus this handoff.

### 3a. The lock helper's create form -- do not "simplify" this

The migration installs `matrix_map.lock_site_aggregate_publication_sources()`
with an ordered pair:

```sql
DROP FUNCTION IF EXISTS matrix_map.lock_site_aggregate_publication_sources() RESTRICT;

CREATE FUNCTION matrix_map.lock_site_aggregate_publication_sources()
```

Three constraints hold this shape in place, and a future session should not
collapse it into something shorter:

1. **Not `CREATE OR REPLACE`.** The helper is `SECURITY DEFINER` owned by
   `postgres`. `CREATE OR REPLACE` would let a later edit silently swap the body
   of a privileged definer function. A regression assertion in
   `site-aggregate-publication-migration.test.ts` forbids it, and that assertion
   predates this pass -- it came in with the feature (`8f4b67ea`, PR #752).
2. **Not a create-only-if-absent guard.** That is reapply-safe but becomes a
   silent no-op that preserves a STALE privileged body on reapply.
3. **`RESTRICT`, never `CASCADE`.** If a real catalog dependency ever exists the
   drop must fail closed rather than quietly removing dependents. PostgreSQL
   records no dependency for one function's body merely CALLING another, so
   `flip_site_aggregate_public` does not block this drop.

**Object identity:** a successful reapply intentionally creates a NEW function
OID. REAPPLY_01 proves SEMANTIC equivalence -- identical definition, owner,
comment, grants, and catalog fingerprint -- NOT object-identity equivalence.
That is the accepted trade for never preserving a stale body.

---

## 4. Evidence design (read this before adding evidence of your own)

Every receipt in this pass refers to ONE identity, so review, commit, and
closeout cannot silently describe different bytes:

- `EVIDENCE_MANIFEST.json` holds `base_sha`, `precommit_head`, the ordered path
  list, a per-file SHA-256 map, and the SHA-256 of the full binary diff taken
  WORKTREE-vs-base.
- It contains **no self-digest** -- a file cannot hold its own hash. The digest
  lives in a sidecar, `EVIDENCE_MANIFEST.sha256`, computed over the manifest's
  exact UTF-8 bytes. Receipts quote the SIDECAR value.

An index detail that matters if you recompute any of this: the new contract
test was added with **intent-to-add**, so it sits in the index with git's empty
blob. `git diff --binary <base>` from the worktree INCLUDES its content;
`git diff --cached <base>` EXCLUDES it. Take the full-diff receipt
worktree-vs-base.

### Rollback proof

The claim that a `UE409` rolls the whole script back is proven by execution, not
by pointing at `BEGIN`/`COMMIT`. `replay-migrations-postgis.ps1
-NegativeLegacyReplay` applies the draft cleanly, mutates the candidate-audit
table into a malformed legacy shape (nullable column, an orphan row, a
conforming-looking but NOT VALID foreign key), fingerprints the `matrix_map`
catalog, reapplies the FULL draft expecting failure, fingerprints again, and
requires the two fingerprints to be identical. The fingerprint covers tables and
columns, functions, constraints, triggers, policies, and grants.

---

## 5. Gate status

**The six push gates were not run as of this commit.** This file is written and
committed BEFORE they execute, so it cannot report their outcome. Current status
must be read from **PR #754** and from the external closeout artifacts under
`.tmp/mission-control/` -- never inferred from this document.

The gate suite itself is defined by `docs/GATE_MODE_SOP.md` Phase 4 (lint, tsc,
`test:ci`, monitored clean build, full unmodified e2e, `docs:gate`).

---

## 6. Authority boundaries still in force

- **D2 is NOT authorized.** No live SQL apply, no database write, no migration,
  no publication change, no deployment.
- **D7 = ABSENT**, verified 2026-07-27T04:46:42Z by a single read-only `EXISTS`
  query under a one-time owner authorization. Receipt:
  `.tmp/mission-control/matrix-options-claude-autonomous-20260726/runs/20260727T033623Z/D7_RESOLUTION_RECEIPT.md`
  Because D7 is ABSENT, the e2e gate runs FULL and UNMODIFIED, and its Auth
  attempt is the only authorized live interaction in this pass.
- Merge is owner-only and absolute.
- Preserved decisions: D1(a) = KEEP the fixed coarse enum; D1(b) = KEEP v1 with
  an opaque-token v2 follow-up; D1(c) = FAIL_CLOSED.

---

## 7. Known follow-ups (not in this PR)

- An opaque-token v2 for D1(b).
- A postflight FK-shape assertion, IF the owner decides the reapply-with-older-
  SQL scenario justifies it -- deliberately omitted here to avoid recreating the
  duplication this pass removed.
- The `NOT VALID` remediation path is manual by design: the helper reports, a
  human resolves.

---

## Holistic-review corrections (2026-07-27, owner-ruled)

The terminal holistic review returned five P2 findings. Four were fixed in this
pass; the fifth (F2) is the D2 blocker in section 0.

**F1 -- incomplete evidence no longer manufactures orphans.** The orphan filter
ran BEFORE the incomplete-evidence signal existed and ignored it, so a failed or
truncated load emptied `aggregates` and every publication was labelled "No live
aggregate" -- with Unpublish offered on that false premise. Classification now
runs AFTER the signal and distinguishes two cases: a CONFIRMED ORPHAN (evidence
complete, the live aggregate is genuinely gone) and STATUS UNKNOWN (any relevant
load errored or truncated, or a duplicate publication identity was seen). Both
render, so the Unpublish escape hatch is never stranded, but the unknown case is
labelled "Live aggregate status unavailable: preview evidence incomplete" and
never claims the aggregate is gone. The logic lives in one pure module,
`src/lib/matrix-map/site-aggregate-lifecycle-rows.ts`, because the page is an
async server component that jsdom cannot render -- inline, it could only be
"tested" by asserting that source text exists.

**F3 -- one SQL text-meaningfulness authority.** PostgreSQL `trim(text)` is
`btrim(text, ' ')`: SPACES ONLY. A tab-only or NBSP-only member-facing label
passed every `length(trim(x)) > 0` predicate and the table CHECK, and persisted
as a visually blank label -- while the SQL block was commented "DEFENSE IN
DEPTH, NOT ROUTE-ONLY". `matrix_map.blank_trim(text)` is now the single
authority for validation AND persistence, with an explicit documented TrimString
set (ASCII controls, NBSP, Unicode separator spaces, line/paragraph separators,
ZWSP, BOM). ZWNJ and ZWJ are deliberately EXCLUDED: they are invisible but carry
orthographic meaning, and stripping them would corrupt legitimate text rather
than reject blank text. It is IMMUTABLE (a CHECK constraint depends on it),
STRICT, `search_path`-fixed, and EXECUTE is revoked from PUBLIC/anon/
authenticated/service_role. It uses CREATE OR REPLACE rather than DROP+CREATE --
deliberately unlike the lock helper -- because a dependent CHECK constraint makes
`DROP ... RESTRICT` fail by design, and the signature never changes.

Two `trim()` call sites are deliberately NOT converted, each with an inline
reason: `canonical_five_decimal_cluster` (strips `to_char` sign padding, always
U+0020 by construction) and the `coordinate_source` predicate inside the
snapshot (an internal provenance column that feeds `source_sample_hash`;
widening it would change which rows contribute and silently reclassify existing
publications as drifted).

**F4 -- pagination moved inside the admin RPC.**
`fetch_admin_site_aggregate_publications` is PL/pgSQL, so `RETURN QUERY`
materializes the entire result before PostgREST's outer `.range()` applies. With
the drift LATERAL in the main query, `current_site_aggregate_snapshot` ran for
EVERY publication on EVERY page request -- up to ~625,000 snapshot computations
across 25 pages at the documented cap. The function now takes explicit
`p_limit` / `p_offset` with NO defaults, validates them (1..1000, offset >= 0)
and raises `UE422` otherwise, and selects the page in a `WITH page AS
MATERIALIZED` stage whose LIMIT/OFFSET is applied BEFORE the LATERAL.
MATERIALIZED is load-bearing, not a hint: without it the planner may inline the
CTE and re-evaluate the snapshot across the whole set. Both the old `(uuid)` and
the current `(uuid, integer, integer)` signatures are dropped, so PostgREST
cannot resolve to an unpaginated overload and no argument-default ambiguity
exists. All three callers -- the admin page loader, the candidate readback and
the publish readback -- pass explicit bounds; `.range()` is no longer the
pagination authority anywhere.

**F5 -- indexed candidate lookup.** The render called `candidates.find(...)` per
aggregate: ~625M comparisons at the 25,000-row cap, able to stall the page after
the queries had already succeeded. A single `candidateByKey` map is built once.
Duplicate `(source_dra_id, coordinate_cluster_id)` identities are DETECTED and
fail closed rather than resolved by arbitrary iteration order -- silently keeping
either row would attach a real `publication_id` to the wrong row and let
Unpublish act on a publication the operator never saw.

New replay coverage: TEST_37 (every blank class stripped), TEST_38 (meaningful
text including CJK, accented letters and ZWJ/ZWNJ preserved), TEST_39 (tab-only
label rejected end-to-end with UE422), TEST_40 (consecutive pages have no gap or
duplicate), TEST_41 (all six invalid bound cases fail closed), TEST_42
(exact-id readback stays bounded). Strict pass is now 42/42.

---

## Targeted-review corrections (2026-07-27, second round)

The fresh current-byte review of the F1/F3/F4/F5 work returned 2 P1 + 4 P2. All
six were real and are fixed.

**P1 -- the F2 blocker was documented but NOT enforceable.** It lived only in
section 0 of this handoff. The authoritative pre-apply runbook carried no
cluster-identity prerequisite, `docs/INDEX.md` routes a cold applicator to that
runbook, and the docs gate does not require this file -- so a later D2
authorization could satisfy every documented gate and apply the SQL with F2
still open. The runbook now carries section **0b, a HARD PREREQUISITE STOP**
ahead of section 1, with a three-row confirmation table (F2 PR merged, replay
evidence captured, `siteAggregates.ts` no longer deriving keys independently)
and an explicit statement that a NO on any row voids the apply regardless of any
other GREEN gate.

**P1 -- `blank_trim` would have made every successful apply look like an
incident.** It was added to the postflight's ACTUAL-function query but omitted
from the `expected(sig)` list, so step 5.1 would always have reported
`blank_trim(text)` in `unexpected_overloads` and contradicted its own required
empty result. Added to both `expected(sig)` lists.

**P2 -- a high/low-only cluster was called orphaned.** The page's aggregate set
is a MEDIUM-TIER preview while a candidate spans every tier, so a cluster that
keeps high- or low-tier samples but loses its last medium one vanished from the
preview and was classified a confirmed orphan -- printing "No live aggregate"
beside a Drifted badge derived from the very aggregate it declared gone.
Classification is now SERVER-authoritative, consistent with the Option 3 ruling:
only `snapshot_drift_state` of `unknown`/absent counts as gone. A third row kind,
`outsidePreviewTier`, renders as "Live, but outside this medium-tier preview".

**P2 -- duplicate identities silently kept the first row.** The contract claimed
no candidate was chosen arbitrarily, but the map retained the first, so a
published SECOND candidate had no reachable Unpublish control. Duplicates are now
QUARANTINED: the key is removed from the lookup entirely and every colliding
candidate surfaces as unknown-status, keeping each row and its Unpublish
reachable.

**P2 -- the readback would have falsely rejected its own successful write.**
JavaScript `.trim()` keeps U+200B (it strips U+FEFF, which is whitespace per
spec, but does not track the SQL's enumerated set); the new SQL `blank_trim` strips
them. The route compared the persisted label against the RAW payload, so a label
with a zero-width space committed correctly and then failed verification with
`verification_label_mismatch`. The route now compares against
`blankTrim(payload...)`. That mirror is in `src/lib/matrix-map/blank-trim.ts`,
and its duplication is made SAFE rather than merely documented: a contract test
parses the character set out of the SQL function and requires it to equal
`BLANK_TRIM_CODEPOINTS` exactly, so the two cannot drift.

**P2 -- the disabled banner contradicted a live button.** It read "Actions
disabled: data incomplete" directly above an active Unpublish, which
deliberately ignores `disabled`. It now reads "Create, Refresh and Publish
disabled: data incomplete (Unpublish remains available)".

Both classification fixes were MUTATION-TESTED: ignoring the server verdict
fails exactly the two outside-tier cases, and retaining the first duplicate
fails exactly the two quarantine cases.

---

## Final classification correction (2026-07-27)

Superseding the "CONFIRMED ORPHAN vs STATUS UNKNOWN" description earlier in this
file: **the classifier no longer claims absence at all.**

`snapshot_drift_state = 'unknown'` is OVERLOADED server-side. The admin RPC emits
it both when the snapshot genuinely returns no row AND when the publication's DRA
is soft-deleted (`WHEN d.is_deleted THEN 'unknown'`), which is a fail-closed
guard for Publish rather than a statement that the aggregate is gone. The admin
page separately filters soft-deleted DRAs out of its own aggregate load, so such
a candidate is absent from the preview AND reports `unknown` -- while its samples
may still exist and still recompute. Treating that as proof of absence printed
"No live aggregate for this publication" for a live-but-deleted DRA.

Because the current RPC contract cannot separate those two causes, the page now
reports only what is true:

| Server state | Bucket | Rendered as |
|---|---|---|
| `match` / `drift` | `outsidePreviewTier` | "Live, but outside this medium-tier preview" |
| anything else, or a duplicated identity | `unknownStatusCandidates` | "Live aggregate status unavailable" |

Liveness still requires positive evidence; absence is never asserted. Rows in
both buckets stay visible and keep their Unpublish control, so the escape hatch
is unaffected -- only the unfounded claim is gone.

RESTORING a confirmed-orphan signal would require the SQL to emit a DISTINCT
state for soft-deleted (for example `'deleted'`) so the two causes are
separable. That is an owner-scoped change and was deliberately NOT made here.

---

## Terminal-holistic corrections F6/F7/F8 (2026-07-28)

The terminal holistic returned RED with one P1 and two P2. All three are fixed.

**F6 [P1] -- a candidate-RPC failure blanked the whole preview.** The candidate
paging loop wrote any failure into `loadError`, the SAME sentinel as the
sample/DRA load, and the page computed `aggregates` only when `loadError` was
null. Because `matrix_map.fetch_admin_site_aggregate_publications` does not exist
until the Option C SQL is applied -- and D2 is blocked by F2 -- merging this
branch would have rendered an EMPTY table, summary and map on every load, for the
entire duration of that block. It was the default state, not an edge case.

The fix splits the evidence into TWO AXES that are never conflated:

| Axis | Signals | Governs |
|---|---|---|
| `previewIncomplete` | sample load error, DRA load error, sample truncation | what the medium-tier preview can be said to prove |
| `candidateIncomplete` | candidate RPC error, candidate truncation, duplicated identity | the lifecycle surface |

`deriveLifecycleEvidenceAxes()` is a pure exported helper, so the rule is
exercised by tests directly rather than inferred from page source. Its
`previewRenderable` output depends on the preview axis ALONE. A candidate failure
now surfaces a distinct warning stating the preview is unaffected, and Create /
Refresh / Publish fail closed on EITHER axis via `lifecycleBlocked`. Unpublish
remains available, and only ever for candidate rows actually returned -- no
candidate or publication id is ever fabricated.

**F7 [P2] -- Publish could approve a label the operator never saw.** The
member-label field rendered only for Create and Refresh, while the table row
beside it shows the PRIVATE DRA name. A second admin arriving after a reload
could publish `member_display_label` without ever seeing the member-visible
string. The persisted label now appears verbatim in the all-tier candidate
summary AND again in the Publish confirmation immediately before approval,
rendered read-only. Publish sends no label at all -- the database serves the
stored value -- and a test asserts the request body carries no
`member_display_label`, so nothing can substitute or recompute it.

**F8 [P2] -- an unsupported cause was asserted for a local omission.** Server
liveness (`match`/`drift`) proves an aggregate EXISTS; it does not explain why a
row is missing from the LOCAL preview. When the sample load errored or was
truncated, the omission could equally be an artefact of the short read. The
explanation now depends on the PREVIEW axis alone:

| Evidence | Rendered as |
|---|---|
| preview complete + unmatched + `match`/`drift` | "Live, but outside this medium-tier preview" |
| preview incomplete + unmatched + `match`/`drift` | "Live aggregate confirmed; preview incomplete, so its local omission cannot be classified" |
| unmatched, no positive liveness evidence | "Live aggregate status unavailable" |

Candidate-side incompleteness deliberately does NOT degrade the explanation for a
row that DID come back: that would re-conflate the axes in the opposite
direction. A test asserts exactly that case.

All three fixes are MUTATION-TESTED: restoring the preview-blanking behaviour
fails exactly the two axis-contamination cases, re-conflating the omission
explanation fails exactly the two incomplete-preview cases, and removing the
Publish approval surface fails exactly the two label-confirmation cases.

This correction is TypeScript and test only. The draft SQL is byte-identical at
`76968DEBDA62A39C6F94FE8F002B66CB0569C24F63D392D96F17C1514425E609`, so the three
replay receipts (positive 42/42, NEG_01, REAPPLY_01) remain applicable and are
carried forward rather than re-run.

---

## Second terminal-holistic corrections F9-F13 (2026-07-28)

**F9 [P1] -- publish is now bound to the REVIEWED version.** Showing the operator
the persisted `member_display_label` (the earlier F7 fix) was necessary but did
not BIND the approval to it: the publish request identified the publication only
by id, so if another admin refreshed the candidate between page load and
confirmation, the RPC published whatever label was CURRENT. The first operator
became the author of a member-visible string they never saw.

`site_aggregate_publications.updated_at` is the optimistic-concurrency token --
the table's trigger already advances it on every candidate refresh and every
publication flip, so it IS "the version the operator reviewed".

- `fetch_admin_site_aggregate_publications` returns `updated_at`.
- The TypeScript candidate type carries it as an OPAQUE STRING. It is never
  parsed into a `Date` and re-serialised: that round trip drops sub-millisecond
  precision and would turn every publish into a spurious conflict.
- Publish sends `expected_updated_at` verbatim.
- `flip_site_aggregate_public` takes `p_expected_updated_at timestamptz`. The
  four-argument overload is DROPPED, so a direct authenticated PostgREST caller
  cannot resolve the pre-token signature and bypass the contract.
- The check runs AFTER `SELECT ... FOR UPDATE` and BEFORE any mutation, so no
  concurrent writer can slip between the comparison and the write. Publishing
  requires a non-null token and an exact match; a mismatch raises a pre-commit
  `UE409` and performs no publication or audit write.
- UNPUBLISH deliberately tolerates a stale or missing token. That asymmetry is
  the established visibility-reducing boundary: retraction only REMOVES member
  visibility and must stay reachable as the emergency path even from a stale
  view. Publish increases visibility and therefore must not.
- The API route validates too, but the SQL is the real boundary -- a direct RPC
  caller never reaches the route.

**F10 [P2] -- the in-flight guard was on the attribute only.** `handleAction`
returned early on `nonRetryable` but not on `loading`, and `onClick` stayed
wired, so clearing the `disabled` attribute during an in-flight request
dispatched a second upsert. Both the handler and the click wiring now gate on
`loading || nonRetryable`.

**F11 [P2] -- the DRA query was the one evidence source never paged.** Samples
and candidates page to exhaustion with truncation flags; DRAs did not. Above the
PostgREST row cap the DRA read silently omitted rows, `computeSiteAggregates`
dropped every sample whose DRA was missing, and the omission never reached
`previewIncomplete` -- so a live candidate could be labelled "outside this
medium-tier preview" when it was absent only because the DRA read truncated. The
DRA query now pages with stable `id` ordering and explicit bounds, and
`previewDrasTruncated` feeds the preview axis.

**F12 [P2] -- MEASURED, then fixed with the narrowest remedy.** An offline
investigation on a disposable PostGIS instance (427,500 samples, one DRA holding
3,000 clusters -- the adversarial shape) measured a full `p_limit=1000` admin
page at 57.93 s / 735,488 buffers without a matching index, and 0.21-0.24 s with
a composite expression index on
`(source_dra_id, canonical_five_decimal_cluster(latitude, longitude))`. The
per-cluster cost was table-size independent (46.4 ms at 27.5k rows, 47.5 ms at
227.5k), confirming the bottleneck is the unindexable predicate rather than table
growth. `canonical_five_decimal_cluster` is IMMUTABLE, which is what makes the
expression indexable.

A set-wise rewrite was considered and REJECTED: it would reintroduce a second
implementation of snapshot semantics, which this SQL's own comments say was
deliberately eliminated. The index is built from the SAME function the query
calls, so cluster identity has no second definition to drift.

HONEST SCOPE NOTE: production `matrix_map.samples` is currently in the low
thousands of rows, far below the tested scale. The cliff is not being hit today
and the build at D2 time is effectively instantaneous. This index is
PREVENTATIVE -- trivial now, painful to add later under load.

**F13 [P2] -- the member path had the same defect the admin path had.**
`fetch_published_site_aggregates` took no bounds while the caller paged with
`.range()`; being PL/pgSQL, its `RETURN QUERY` materialized the whole sorted set
before the outer range trimmed it, so a 25-page member load recomputed the full
list 25 times. It now takes validated `p_limit`/`p_offset` with no defaults,
applies `ORDER BY ... LIMIT/OFFSET` inside the function, and the no-argument
overload is dropped. The member-safe projection is unchanged and asserted so:
same opaque aggregate id, label, 3-decimal coordinate rounding, bucketed counts,
conditional suppression key and ordering.

New SQL controls: TEST_43 (stale-token publish rejected, audit count unchanged),
TEST_44 (re-read then publish serves exactly the reviewed label), TEST_45 (direct
RPC with null or stale token fails closed), TEST_46 (four-argument overload
absent), TEST_47 (unpublish succeeds with a stale token), TEST_48/49 (index
present and planner-usable for the snapshot predicate), TEST_50-53 (member RPC
overload absent, bounds fail closed, pages have no gap or duplicate, member
projection unchanged). Strict pass was 53/53 at that round.

---

## Confirmation-review corrections G1/G2/G3 (2026-07-28)

A targeted confirmation review of the F9-F13 corrections returned three P2
findings. All three are fixed together. G2 could not be deferred: it is a real
duplicate-write race, and an unresolved P2 does not satisfy the commit protocol.

### G1 -- the member-projection control was vacuous (evidence)

`scripts/matrix-map/validation/option-c-phase2/test-option-c.sql`, TEST_53.

The previous assertion was `v_lat IS NULL OR (v_lat = round(v_lat::numeric, 3)
...)`. Two defects: `v_lat = round(v_lat, 3)` is SELF-REFERENTIAL, a tautology
for any value already at three or fewer decimals, so it could not detect the
member RPC's rounding being removed or changed; and the `IS NULL OR` prefix let a
NULL short-circuit the bucket and opaque-id checks as well. Its seed,
`49.52000 + i * 0.001`, was already exactly three decimals, so it never exercised
rounding at all.

TEST_53 now seeds two published rows from SEVEN-decimal source coordinates
(49.5266749 / -123.5312351 and 49.5313982 / -123.5268531), chosen so each axis
carries a round-up and a round-down case and every expected value differs from
both the source value and the 5-decimal persisted value. The returned rows are
compared against INDEPENDENTLY DERIVED literals through an explicit
source-to-expected table, never by re-rounding the returned value. Three
requirements are asserted independently: the expected row count, zero NULL or
absent values (counted first and required to be zero on its own, so a NULL fails
rather than short-circuits), and every row conforming on exact rounded latitude,
exact rounded longitude, exact bucket, a non-null opaque id, and that opaque id
being neither the source DRA id nor any DRA id.

### G2 -- same-tick double submission (production behaviour)

`src/app/(dashboard)/admin/matrix-map/site-aggregates/SiteAggregateAdminActions.tsx`.

`loading` is React state read from the render closure, so two submissions
dispatched within a single tick both observed the same stale `false` and both
proceeded. A synchronous `useRef` lock now sits on the form's single semantic
submission path: `preventDefault()` first, then a combined
`submitLockRef.current || loading || nonRetryable` guard, then the ref is taken
BEFORE any async work is invoked. It is released in `finally`, so validation
returns, retry-safe errors and thrown failures all release it. `nonRetryable`
remains an independent condition, so releasing the lock never weakens the
post-commit latch. The pre-existing state guard and every `disabled` attribute
are retained.

### G3 -- the index collision check was substring-based (evidence)

`docs/design/matrix-map/OPTION_C_PHASE2_SITE_AGGREGATE_PUBLICATIONS_DRAFT_2026_07_24.sql`.

The guard for `samples_dra_canonical_cluster` tested only that the rendered
definition CONTAINED `source_dra_id` and `canonical_five_decimal_cluster`. A
reversed key order, swapped expression arguments, a partial predicate, a
non-default opclass, an INCLUDE column, UNIQUE, a DESC key, and an index of that
name on another table all contain both tokens and were therefore accepted.

The predicate now lives in
`matrix_map.assert_conforming_dra_cluster_index(text, text, regclass)` -- a
function rather than an inline block, so the negative controls execute the
SHIPPED bytes instead of a second hand-maintained copy. It validates through
`pg_index`, `pg_class`, `pg_namespace`, `pg_am`, `pg_attribute`, `pg_opclass`,
`pg_depend` and `pg_get_expr`: the indexed relation, btree access method,
valid/ready/live, non-unique, exactly two key attributes with no INCLUDE
columns, `source_dra_id` as the first key, the second key being precisely
`canonical_five_decimal_cluster(latitude, longitude)` in that argument order,
absence of a partial predicate, `uuid_ops`/`text_ops` opclasses, the expected
collations, and ASC/NULLS-LAST options on both keys. It raises UE409 and repairs
nothing.

This raises the function total from thirteen to fourteen; runbook sections 3.4
and 5.1 are updated accordingly.

### Controls added

TEST_54 (clean first apply accepted), TEST_55 (exactly conforming index
accepted, definition untouched), TEST_56 (reversed key order), TEST_57 (partial
predicate), TEST_58 (swapped expression arguments), TEST_59 (incompatible
opclass, three ways -- see below), TEST_60 (UNIQUE / INCLUDE / DESC), TEST_61
(wrong-table collision and a non-index relation holding the name). Every negative
control also asserts the offending object survives the UE409 with a
byte-identical definition. Strict pass is now 61/61.

### G3 follow-up correction: operator classes pinned by OID, not by name

A targeted confirmation of the above found one further P2, accepted and fixed
here. The first version of the guard compared `pg_opclass.opcname` against the
literals `uuid_ops` and `text_ops`. Operator-class names are unique only per
(access method, schema), so a CUSTOM btree class in ANY other schema may
legitimately carry either name while belonging to an operator family that does
not support the equality predicate the drift snapshot issues -- and it would have
been accepted. That is the same defect class as the substring probe the guard
replaced: a NAME standing in for an IDENTITY.

The guard now resolves the expected operator classes dynamically from the
catalog -- access method `btree`, input type `pg_catalog.uuid` and
`pg_catalog.text` respectively, `opcdefault` true, namespace `pg_catalog` -- and
FAILS CLOSED with UE409 if either resolution is missing or non-unique rather
than comparing against an unknown expectation. Compatibility is then decided by
comparing `pg_index.indclass[0]` and `indclass[1]` to those OIDs. Operator-class
NAMES now appear only in the diagnostic message and decide nothing.

TEST_59 correspondingly grew from one case to three: the built-in
`text_pattern_ops`, plus CUSTOM classes deliberately named `uuid_ops` and
`text_ops` created in the probe schema and used at the FIRST and SECOND key
positions independently. Each custom case first PROVES its index really was
built with a class carrying the expected name from a non-`pg_catalog` schema, so
the control cannot silently degrade into a duplicate of the first case.

Client-side, a same-tick regression submits the real form twice inside one
`act()` scope with no await between the events while the first fetch is
unresolved, and requires exactly one dispatch. The distinct after-render
disabled-attribute bypass regression (F10) is retained; neither subsumes the
other.

### Mutation receipts

Every new guard was mutation-tested and the receipts are preserved externally
under `.tmp/mission-control/`: `G2_MUTATION_RECEIPT.md` and
`G1_G3_MUTATION_RECEIPT.md`. Removing only the ref protection double-dispatches;
removing or changing the member rounding fails TEST_53; reverting the index guard
to the two substring probes fails all six negative controls while both positive
controls stay green.

---

## Terminal-holistic corrections FIX 6 / FIX 7 (2026-07-28)

The terminal holistic accepted two findings. Both are fixed here; the offset
finding was filed P1 and adjudicated by mission control to P2 hardening, with the
"unbounded scan" rationale rejected -- PostgreSQL discards only rows that exist,
so the work is bounded by the published-set size. What it DOES defeat is the
bounded-pagination contract, which is why it is still fixed.

### FIX 6 -- label identifier containment canonicalizes to ASCII HEX

`OPTION_C_PHASE2_SITE_AGGREGATE_PUBLICATIONS_DRAFT_2026_07_24.sql` and
`src/app/api/matrix-map/admin/site-aggregates/candidate/route.ts`.

The guard normalized both sides by lowercasing and stripping `-`, `{`, `}`.
`matrix_map.blank_trim` is `btrim`, which strips from the ENDS only, so an
INTERIOR invisible character survived: a label carrying the source uuid
interleaved with U+200B, U+200C, U+200D or U+FEFF failed the containment test
while still RENDERING to members as the raw identifier.

Widening `blank_trim` was REJECTED as the fix. That set deliberately excludes
U+200C ZWNJ and U+200D ZWJ because they are meaningful in legitimate persisted
text and stripping them would corrupt real writing. The containment value is a
temporary comparison copy that is never stored, so it carries no such
constraint.

Both layers now canonicalize as: lowercase, then discard every character that is
not ASCII hexadecimal, then search for the complete 32-character uuid.

    SQL:  regexp_replace(lower(value), '[^0-9a-f]', '', 'g')
    TS:   value.toLowerCase().replace(/[^0-9a-f]/g, '')

The class is written as an explicit ASCII range so behaviour cannot vary with
collation or locale. The PERSISTED label is never altered to perform the
comparison. The SQL boundary remains the authority -- the RPC is reachable
directly through PostgREST -- and the route copy is documented as an early
duplicate precheck, not independent security authority.

### FIX 7 -- bounded-pagination ceiling on p_offset

Both `fetch_published_site_aggregates` and
`fetch_admin_site_aggregate_publications` ceilinged `p_limit` but left `p_offset`
unbounded above. Each now rejects `p_offset > c_max_offset` with UE422 before any
query executes, preserving the existing NULL and negative rejection.

The ceiling is DERIVED from the shipped client contract rather than invented:
`src/lib/matrix-map/site-aggregate-pagination.ts` now owns `PAGE_SIZE = 1000`,
`MAX_PAGES = 25` and `MAX_PAGE_OFFSET = (MAX_PAGES - 1) * PAGE_SIZE = 24000`.
The admin page consumes those constants instead of re-declaring them, and a
cross-layer contract test binds the TypeScript pair to the SQL literal so the two
cannot silently drift.

### Controls added

- **TEST_62** -- the uuid is rejected with UE422 in canonical, compact,
  mixed-case, brace-wrapped, and U+200B / U+200C / U+200D / U+FEFF / space /
  punctuation-interleaved forms (10 shapes), each writing NO candidate and NO
  audit row, while an innocuous label sharing only a few hex characters is still
  accepted. Every evasion is built with `chr()` so the test file stays plain
  ASCII.
- **TEST_63 / TEST_64** -- for the member and admin RPC respectively: offset
  24000 ACCEPTED, 24001 and 2147483647 and a negative offset each UE422, and the
  oversized rejection proven to occur BEFORE the publication query executes by
  requiring the `pg_stat_xact_user_tables` scan count for
  `site_aggregate_publications` to be unchanged across the rejected call.
- **Cross-layer contract test** -- `site-aggregate-cross-layer.contract.test.ts`
  pins the SQL and TypeScript canonicalization rules to each other by executable
  text AND by behavioural equivalence over an evasion corpus, and binds the
  24000 ceiling to the TypeScript pagination constants in both RPCs.

Strict pass is now 64/64.

### Mutation receipts

`FIX67_MUTATION_RECEIPT.md`. Restoring the `[-{}]`-only normalization drops
TEST_62 to 4/10 rejected -- all six interleaved evasions sail past the label
guard. Removing ONLY the upper-bound predicate (constant retained) fails TEST_63
and TEST_64 with `24001 accepted; int max accepted` AND an observed increase in
the publication scan counter, proving the query really was executed.

---

## Pagination consolidation + regex enumeration (2026-07-28)

A targeted confirmation of FIX 6 / FIX 7 accepted one further P2 and filed one
P1. Mission control ruled on both.

### Accepted P2 -- ONE pagination envelope for every RPC consumer

The prior revision moved only the ADMIN PAGE onto the shared module while
claiming the values could not silently drift. Two other runtime consumers kept
their own numeric copies, so raising the shared values with the SQL ceiling would
have left member loading failing at the old cap and the candidate readback
reporting `verification_incomplete` at the old cap, with the contract test green.

There is ONE legal database pagination envelope for these consumers:
`PAGE_SIZE = 1000`, `MAX_PAGES = 25`, `MAX_PAGE_OFFSET = 24000`. All three now
import `src/lib/matrix-map/site-aggregate-pagination.ts` and declare no local
numeric copy: the admin page, the `fetch-site-aggregates-server.ts` member
loader, and the `candidate/route.ts` post-commit readback. The readback imports
ALIASED (`PAGE_SIZE as READBACK_PAGE_SIZE`, `MAX_PAGES as READBACK_MAX_PAGES`) so
each use site still reads as readback-specific: it keeps its distinct FAILURE
semantics but, calling `fetch_admin_site_aggregate_publications`, has no
independent NUMERIC contract.

The cross-layer contract test now ENUMERATES all three consumers and proves each
imports the shared module, none re-declares
`PAGE_SIZE`/`MAX_PAGES`/`READBACK_PAGE_SIZE`/`READBACK_MAX_PAGES` as a numeric,
every generated offset is within `MAX_PAGE_OFFSET`, and the shared values stay
bound to both SQL RPC ceilings.

New behaviour tests prove consolidation changed no runtime behaviour: the member
loader requests exactly `0..24000` in `PAGE_SIZE` steps, surfaces a failure at
the page cap rather than serving a partial map, stops at the first short page,
and issues a single request when the first page is short. The readback's existing
page-ceiling test is now bound to the shared envelope and additionally asserts
the full offset envelope, with its 409 `verification_incomplete` outcome
unchanged.

### Filed P1 -- REFUTED on the target platform, hardening applied anyway

The claim was that PostgreSQL bracket RANGES are collation-defined, so a
non-ASCII character could fall inside `[a-f]`, survive `[^0-9a-f]`, break the
contiguous hex run and let an interleaved uuid evade `position()`.

Measured rather than argued, on the pinned image: PostgreSQL 17.10, database
collation en_US.utf8, and again under explicit `COLLATE "C"` and
`COLLATE "en-US-x-icu"`. The range and enumerated forms were IDENTICAL for
a-acute, e-acute, a-ring, c-cedilla, sharp-s, Cyrillic a, fullwidth a, U+200B and
U+200C. The premise does not hold here, and mission control accepted the
refutation.

Both canonicalizations nevertheless now enumerate the sixteen characters --
`[^0123456789abcdef]` in SQL and TypeScript alike. It costs nothing and retires
the argument permanently. A direct assertion proves neither implementation
contains a bracket range, scoped to the canonicalization bodies; `UUID_RE`
legitimately uses ranges for FORMAT validation and is untouched.

### Mutation receipts

`FIX89_MUTATION_RECEIPT.md`. Reintroducing a local numeric copy in the member
loader, or in the readback, each fails two consumer assertions -- precisely what
the previous single-consumer test could not catch. Reverting only the TypeScript
canonicalization to the range form fails the TypeScript assertion while the SQL
one stays green, proving the two are asserted independently. Both files restored
and hash-verified identical.

---

## Pagination authority + SQL dual-binding (2026-07-28)

A targeted confirmation accepted four P2s about the SCAFFOLDING that was meant to
prove the consolidation permanently. Mission control ruled on the design.

### Full-diff evidence

`git add -N` was applied by exact path to the four formerly-untracked files, and
to `site-aggregate-admin-loaders.ts` once the extraction below created it. There
are now zero untracked paths and zero staged content, and every file's complete
contents appear in `git diff --binary <base>`.

Applying the ruling's own bidirectional check exposed a discrepancy that had gone
unnoticed all run: `git status` reports worktree-vs-HEAD (27 paths) while
`git diff --binary <base>` reports worktree-vs-BASE (33, including 18 already
committed on the branch). Every earlier manifest enumerated the 27 while its
digest covered the 33. The manifest's `paths[]` is now the worktree-vs-base set
-- exactly what the digest covers -- with the uncommitted subset and both
sub-counts recorded separately, verified equal in both directions.

### One pagination authority

`siteAggregatePageArgs(page)` is the sole constructor of `{ p_limit, p_offset }`
and `siteAggregatePageIndexes()` the sole definition of the valid index set. The
constructor FAILS CLOSED on non-integer, negative and out-of-range indexes rather
than producing an offset the SQL ceiling would reject at runtime.

All three consumers pass its return value straight through. The admin page's
three loops were extracted VERBATIM into
`src/lib/matrix-map/site-aggregate-admin-loaders.ts` -- same ordering, break
conditions, truncation flags and error routing -- because the server component
could not be executed directly, which is why it was the one consumer whose
pagination arguments had no runtime evidence.

The overbroad "no local numeric copy" claim is replaced by narrower enforceable
ones: every consumer imports AND invokes the constructor; every PAGINATED RPC
call receives its result; no consumer computes `page * PAGE_SIZE` or writes a
`p_limit:`/`p_offset:` literal.

### Runtime evidence for all three consumers

Captured actual arguments, compared ELEMENT FOR ELEMENT -- never a count, a
minimum, a maximum or the endpoints. Every paginating consumer carries BOTH
traversal modes: the full 25-page traversal `[0,999], [1000,1999], ...,
[24000,24999]` (offsets `0, 1000, ..., 24000`), and a short-page termination
asserted as an exact ordered PREFIX with an explicit assertion that nothing was
requested after the short page. Each consumer's distinct behaviour at 25 full
pages is also asserted: admin loaders flag truncation, the member loader fails
closed, the readback returns 409 `verification_incomplete`.

### Both SQL dimensions bound, per RPC

Each RPC body is section-scoped and asserted independently: exactly one
`c_max_limit` equal to `PAGE_SIZE`, exactly one `c_max_offset` equal to
`MAX_PAGE_OFFSET`, and both USED in their fail-closed predicates.

### Mutation receipts

`FIXAB_MUTATION_RECEIPT.md`. Six controls, all discriminating: the constructor
off-by-one fails 9 assertions; bypassing it in each consumer fails that
consumer's tests; and each RPC's `c_max_limit` fails INDEPENDENTLY, proving the
two are section-scoped rather than conflated. No SQL bytes changed -- the draft
is byte-identical at `1B8AA3AE...`, so FINAL24's replay receipts remain
applicable and that applicability is recorded.

### Regression suites repaired, not deleted

The extraction moved code that existing guards scanned, so they failed honestly.
`page.contract.test.ts` reads the page AND the loaders as one surface so the
five-column projection, paged reads and truncation flags keep being checked.
(It also carried an AST RPC allow-list at the time; that was retired later --
see the authoritative section below.)

The F4 caller-bounds guard was initially repaired here to accept the shared
constructor's result. It was subsequently RETIRED outright -- see
"Verification architecture SIMPLIFIED" below, which supersedes any earlier
description of it in this document.

---

## Verification-method recovery (2026-07-28)

A targeted confirmation accepted three P2s, all in verification scaffolding.
Mission control ruled this a FINAL VERIFICATION-METHOD RECOVERY CYCLE with a
single governing rule: no assertion may claim a safety property unless it is
proven capable of firing against a positive violating fixture or mutation.

### The root cause, and the structural fix

Four `not.toMatch` guards carried a literal BACKSPACE (0x08) where `\b` was
intended. A regex that cannot match makes a negative assertion vacuously true,
so all four reported green while enforcing nothing -- and the plain-ASCII sweep
could not catch it, because 0x08 is code point 8, inside the `<= 127` ceiling
that sweep tests.

The immediate response was a guard-proving helper in
`src/lib/matrix-map/__tests__/guard-regex.ts` that ran every forbidden-pattern
guard in two halves. **That helper and every forbidden-pattern guard it served
have since been RETIRED** -- see "Verification architecture SIMPLIFIED" below.
That module now holds ONLY the control-character scan described next. Do not
reintroduce the forbidden-pattern machinery.

A control-character check rejects 0x00-0x08, 0x0B, 0x0C, 0x0E-0x1F and
0x7F, permitting only TAB, LF and CR. It scans the repository tree directly
rather than the run manifest, so it cannot pass locally and error in CI. It
immediately found a REAL pre-existing 0x08 in
`docs/design/matrix-map/DB2_bnrrm_training_schema.sql:5` -- same defect class, a
Windows path in a comment where `\b` became a backspace -- byte-identical in the
base commit and outside this correction surface. It is excepted by an exact
file:line:codepoint triple whose reachability is itself asserted, and surfaced
to mission control rather than edited.

Two guards had to be TIGHTENED once they actually started firing: they were
matching a doc comment describing the hazard, and a TYPE annotation rather than
a constructed value. The fixes -- a TypeScript comment stripper and a
type-versus-value lookahead -- were the last iteration of the source-text
approach before it was retired entirely. **Neither the stripper nor the
lookahead exists any more.** They are recorded here only as the history that
motivated the simplification below.

### The complete pagination sequence

`expectExactSequence` compares observed offsets element-for-element against
`[0, 1000, ..., 24000]`, derived through the shared authority. Its negative
control constructs the duplicate-9000 / omit-10000 corruption, proves it defeats
the previous count-plus-endpoints-plus-range style, and requires the new
assertion to reject it.

### The page actually invokes the loaders

The three loops' orchestration is now one function,
`loadSiteAggregateAdminSurface`, which `page.tsx` calls; ordering and error
routing are unchanged. Invocation is proved BEHAVIOURALLY by observed calls --
`['samples', 'dras']` and `['fetch_admin_site_aggregate_publications']` -- with
each loader's result reaching the returned surface. Three properties are
separated with their own proofs: the implementation exists, it is internally
constrained, and the page invokes it.

The structural pin that once stood alongside this has been DELETED, not
narrowed. Page-result consumption is now proved by
`site-aggregate-page-binding.test.ts`, which executes the REAL async server
component with `next/headers`, `next/navigation`, `@supabase/ssr` and the
orchestration mocked to return distinctive sentinels, and asserts those
sentinels reach the rendered tree; its negative control renders an empty surface
and requires the sentinels to be absent. No production refactor was needed.

---

## Verification architecture SIMPLIFIED (2026-07-28) -- AUTHORITATIVE

**This section supersedes every earlier description of the verification method
in this document.** Where an earlier section describes source-text guards,
forbidden-pattern regexes, a comment stripper, a type-versus-value lookahead, a
consumer import/invoke inventory or a structural pin, that description is
HISTORY. None of those mechanisms exists on the candidate-route or
site-aggregate page contract surfaces this correction addressed.

That is a SCOPED statement, not a tree-wide one. Narrowly scoped source checks
elsewhere -- including the column-projection and containment guards in
`page.contract.test.ts`, which still read the page and loaders together and use
regexes -- were never in scope and remain.

Five consecutive review cycles were caused by source-text guards claiming more
than they enforced. Mission control ruled: retire the mechanism, keep the
runtime coverage.

**DELETED -- do not reintroduce, and do not replace with new regexes, token
scanning, comment stripping, AST approximation or identifier-name detection:**

- the TypeScript comment stripper and its self-test;
- the `p_limit`/`p_offset` forbidden-pattern regexes and their fixtures;
- the consumer import/invoke token checks and the paginated-RPC window check;
- the F4 caller-bounds guard, which located the RPC by exact source token and
  inspected a fixed 600-character window;
- the `CONSUMERS` inventory in `site-aggregate-cross-layer.contract.test.ts`;
- the structural pin that merely proved `page.tsx` calls the orchestration;
- `assertForbiddenPattern` and its helpers.

**KEPT:** the raw-byte control-character scan (0x00-0x08, 0x0B, 0x0C,
0x0E-0x1F, 0x7F; TAB/LF/CR permitted) with its documented exact exception for
the pre-existing base-file 0x08 in `DB2_bnrrm_training_schema.sql:5`, and the
separate plain-ASCII and whitespace checks. `guard-regex.ts` now holds that scan
and nothing else. The SQL-side contract assertions and the per-RPC
`c_max_limit`/`c_max_offset` bindings are unchanged. The extraction guard in
`site-aggregate-publication-migration.test.ts` -- that `page.tsx` delegates to
the loaders module and calls the RPC nowhere itself -- is also kept; it exists
so the loops stay in a module whose arguments are executable in a test at all,
and it is not a restatement of the bounds invariant.

### Behavioural pagination evidence

Every consumer is checked on its ACTUAL recorded calls, element-for-element --
never a count, a minimum, a maximum or the endpoints. Each paginating consumer
carries BOTH traversal modes.

| Consumer | Full traversal | Short-page termination |
|---|---|---|
| admin samples range loader | exact `[0,999], [1000,1999], ..., [24000,24999]` | exact 4-window prefix, nothing after |
| admin DRA range loader | exact `[0,999], [1000,1999], ..., [24000,24999]` | exact 2-window prefix, nothing after |
| admin candidate RPC loader | exact offsets `0, 1000, ..., 24000` | exact 3-call prefix, nothing after |
| member publication RPC | exact offsets `0, 1000, ..., 24000` | exact 3-call prefix, and a 1-call prefix |
| candidate readback RPC | exact offsets `0, 1000, ..., 24000` | exact 2-call prefix, nothing after |

Every mock is keyed on the SUPPLIED `p_offset` (or `.range()` window), never on
the call index. Keyed on the index, a loop that re-requested offset 0 would
still be handed the full page then the short page, terminate identically and
produce the same result -- so a short-page case would pass while the traversal
was corrupt.

### Mutation evidence

Each production loop was independently mutated to duplicate page 9 and omit
page 10, and each loader's OWN test failed while the others stayed green. (The
`.tmp` mutation receipts are retained for forensics but are NON-AUTHORITATIVE --
see the authority note in the exact-ID section below.)

- samples loader mutated -> only the samples full-traversal test failed (both
  DRA tests green);
- DRA loader mutated -> only the DRA full-traversal test failed (both samples
  tests green);
- candidate RPC loader mutated -> only its own full-traversal test failed;
- readback loop mutated -> the page-ceiling test failed;
- readback loop mutated to repeat offset 0 -> three readback tests failed, which
  is the direct proof that the offset-keyed mock closed the earlier gap.

Both production files were restored to their exact pre-mutation SHA-256, and
that restoration is verified in the receipt. Earlier mutation receipts
(`G2_`, `G1_G3_`, `G3B_OPCLASS_`, `FIX67_`, `FIX89_`, `FIXAB_`,
`VERIFICATION_METHOD_`, `VERIFICATION_SIMPLIFICATION_`) remain as history.

### Page-consumption evidence

`site-aggregate-page-binding.test.ts` executes the real async server component
against distinctive sentinels and asserts they reach the rendered tree, with a
negative control requiring their absence. This is what replaced the structural
pin.

### SQL applicability -- read this carefully

The draft SQL is byte-identical at
`1B8AA3AEF558F458F99399797EA9560A082EDA77FC6873BDEBB9F0F8EF90CF90`, 97326 bytes,
equal to the runbook pin. FINAL24's positive (64/64, `strict_pass=true`), NEG_01
and REAPPLY_01 replay receipts bind that same `draft_sql_sha256` and therefore
remain applicable **TO THOSE SQL BYTES ONLY.**

**FINAL24 covers NO TypeScript.** It is a SQL replay result and must never be
cited as evidence for the TypeScript, tests or documentation in this change set.

**SUPERSEDED.** FINAL28 was the TypeScript evidence for the five corrections
above, but the SQL has since changed (next section), which invalidated the SQL
side. The current evidence set for SQL replay, TypeScript, tests and
documentation alike is FINAL32; see the banner at the top of this document.

### F2 is unaffected

**F2 remains a separate hard blocker before D2**, independently of PR #754 and
of everything in this section. Nothing here resolves, weakens or substitutes for
it. PR #754 stays DRAFT; no Supabase contact, no live SQL apply, no D2, no
publication, and merge is owner-only.

---

## Exact-ID post-commit verification (2026-07-28) -- AUTHORITATIVE

A terminal holistic review found a real correctness defect and mission control
authorized reopening the frozen SQL to fix it. This section is authoritative for
the candidate write/verify design and for the SQL pin.

### The defect

Post-commit verification PAGED the candidate collection looking for a matching
`(source_dra_id, coordinate_cluster_id)` tuple. The fetch RPC's
`ORDER BY sample_count_total DESC, member_display_label ASC, id ASC` is a total
order **within one statement**, but each page is its own statement against live
data. `sample_count_total` and `member_display_label` are part of that sort key,
so a concurrent refresh between two page requests can move a row across an
OFFSET boundary: one row comes back twice, another never comes back at all.

The scan could therefore report 409 `verification_failed` for a candidate that
HAD committed -- a false negative in the path built specifically to avoid false
negatives. The old SQL comment asserted the opposite ("pages cannot overlap or
skip rows between requests"); that claim was wrong and has been corrected in
place.

### The fix -- smallest exact-ID design

`matrix_map.upsert_site_aggregate_candidate` now **RETURNS uuid**: the persisted
publication id, returned only after the persisted-row write and the audit write
both complete. A changed return type cannot go through `CREATE OR REPLACE`, so
the script does a reapply-safe
`DROP FUNCTION IF EXISTS ... (uuid, text, text, uuid, text) RESTRICT` followed
by a plain `CREATE FUNCTION`, then restores OWNER, REVOKE and the `authenticated`
GRANT explicitly. `RESTRICT` is deliberate: nothing in the schema depends on this
function, so it fails loudly if a future dependency appears rather than silently
dropping it.

The route captures that id, validates it as a UUID, and performs **exactly one**
verification call:

    fetch_admin_site_aggregate_publications({
      p_publication_id: <returned id>, p_limit: 1, p_offset: 0
    })

`p_limit 1 / p_offset 0` is the bounded shape of a single-row lookup, not a first
page. It then validates the row's `publication_id`, `source_dra_id`,
`coordinate_cluster_id` and `member_display_label`.

**Admin inventory pagination is unchanged** -- deliberately. It remains bounded
best-effort presentation and is not the basis of any correctness claim. No
cursor/keyset API was introduced; exact-ID readback made one unnecessary.

### Post-commit semantics

| Condition | Response |
|---|---|
| Upsert succeeded, returned id malformed or missing | `verification_id_missing`, committed=true, verified=false, retry_safe=false, and NO fallback scan |
| Exact-ID readback errored | `readback_failed`, committed=true, not retry-safe |
| No row for that id, or a row that is not the one written | `verification_failed`, committed=true, not retry-safe |
| Row found, label differs | `verification_label_mismatch`, committed=true, not retry-safe -- never a claim the write did not happen |

All are 409, never 5xx: the upsert has already committed, and 5xx invites the
automated retry that would write a duplicate refresh plus audit row.

**`verification_incomplete` is GONE.** It meant only "the paged search hit its
ceiling, so absence is not proven". Exact-ID lookup has no ceiling and no pages,
so the state is unreachable rather than merely unused.

### SQL pin and replay evidence -- FINAL32

| Field | Value |
|---|---|
| Bytes | 99831 |
| SHA-256 | `003E163324004C50649D705896D5FD9C40A97AB188699AE94566D43EA84E6EED` |
| Positive replay | `strict_pass: true`, `missing_test_ids: []`, `required_test_count: 69`, 69 passed / 0 failed, concurrency PASS, COMPLETED_GREEN |
| NEG_01 | PASS -- full-script reapply aborted with UE409, catalog fingerprint unchanged |
| REAPPLY_01 | PASS -- identical reapply succeeded through COMMIT, semantic fingerprint unchanged |

All three bind the digest above and were generated from the CORRECTED harness
bytes. Earlier replay sets (FINAL29 and before) predate the harness fix
described next and must not be cited as current.

**The replay acceptance gate was itself defective and is now fixed.** Its
`$requiredTestIds` baseline stopped at TEST_64 while the suite had grown to
TEST_69, and the runbook carried a matching "at least 64" threshold as a second
authority. A replay that never emitted TEST_65-69 -- the exact-ID contract
checks -- would have satisfied both and reported `strict_pass: true` with those
checks absent. The harness is now the single authority: it derives
`required_test_ids`, `required_test_count`, `missing_test_ids` and `strict_pass`
from one array covering TEST_01..TEST_69 and emits them into the receipt, the
runbook accepts on those receipt fields with no separate threshold, and a
contract test binds the SQL suite, the harness and the runbook to one number.

Proven by negative control: suppressing TEST_69's emitted id made the harness
exit 1 with `strict_pass: false` and `missing_test_ids: ['TEST_69']` -- while
`fail_count` was 0 and 69 tests still passed, so ONLY the required-id mechanism
caught it. The suite was then restored to its exact pre-mutation SHA-256.

**FINAL24 IS INVALIDATED.** Its receipts bind `1B8AA3AE...`, which no longer
exists. Do not cite FINAL24 for anything. The runbook pin has been updated to
match the table above.

New SQL controls: TEST_65 (create returns the ACTUAL persisted id, matched
against an independent natural-key lookup), TEST_66 (refresh returns the SAME id
and creates no second row), TEST_67 (the returned id resolves through
`(p_publication_id, 1, 0)` to exactly one row), TEST_68 (the DROP/CREATE left
RETURNS uuid, owner `matrix_map_owner`, EXECUTE granted to `authenticated` and
revoked from PUBLIC/anon/service_role), TEST_69 (exactly one overload survives,
so PostgREST cannot resolve a legacy void-returning signature).

### The last two source-analysis guards are retired

The regex RPC allow-lists and TypeScript-compiler AST walkers in
`candidate/__tests__/route.contract.test.ts` and
`site-aggregates/__tests__/page.contract.test.ts` are DELETED, along with their
self-tests and the `typescript` imports. They claimed a universal static
allow-list they could not enforce: an RPC reached through an alias or a bound
function is not a call expression whose callee is named `rpc`.

Replaced by behavioural evidence that records ACTUAL calls: the route invokes
exactly `[upsert_site_aggregate_candidate,
fetch_admin_site_aggregate_publications]` in that order; each loader's real RPC
and table set is asserted; loader ordering columns are asserted from the actual
`.order()` calls. **No test on these surfaces claims a universal static RPC
allow-list any more**, and their headers state that narrowed scope. Do not
reintroduce regex, AST, token-window, identifier-name or source-concatenation
analysis as a way to enumerate reachable RPCs.

### Mutation evidence

**Authority note.** The mutation RECEIPTS under `.tmp/mission-control/...` and
the scratch generator that produced `RULING2_MUTATION_RECEIPT.md` are
**NON-AUTHORITATIVE and SUPERSEDED**. They are retained for forensics only. Two
defects disqualified the generator: its integrity check trusted a stored
`integrity_ok` flag instead of recomputing counts from the retained per-mutation
JSON, and the "exact command" it recorded omitted arguments that were actually
executed. Nothing in this document, and nothing committed, may cite them as
proof. The raw per-mutation JSON and complete logs are retained unmodified and
remain usable as raw evidence.

What is independently established, and is cited here on that basis:

- Removing ONLY the route's `rowPublicationId !== returnedPublicationId`
  comparison fails EXACTLY ONE test -- the one named for that property,
  "rejects a readback row whose publication_id differs, when source, cluster AND
  label all match". This one-test discrimination was independently confirmed by
  adversarial review against current bytes.
- Reverting `p_publication_id` to null, and restoring the paged collection scan
  outright, each fail the route suite.
- A malformed or missing returned id fails closed with zero readback calls
  (asserted directly in `route.test.ts`, not via any receipt).
- Production files were restored to their exact pre-mutation hashes.

Exact per-mutation failure counts are deliberately NOT restated here; read them
from the retained raw JSON if needed.
