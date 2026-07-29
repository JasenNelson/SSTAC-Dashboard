# FRESH SESSION HANDOFF - 2026-07-26 / 2026-07-27

Continuity anchor for the Matrix Options / Option C lane.

**SCOPE OF THIS DOCUMENT (read first).** This file records state **as of the
candidate-lifecycle commit it ships in, and nothing later**. It deliberately does
NOT assert a gate block, a PR number, a pushed SHA, or any CI result: those facts
are produced AFTER this commit exists, and a committed sentence claiming them
would be false the moment the gates ran. Where to find them instead:

- the **PR body** of the candidate-lifecycle pull request, and
- `CLOSEOUT.md` in the run root
  `.tmp/mission-control/matrix-options-claude-autonomous-20260726/runs/<run-id>/`.

Status documents and handoffs are CLAIMS, not truth. Verify against git, the PR,
and the run-root receipts before acting on anything here.

---

## 1. Where the lane stands

### PR #752 - Option C aggregate publication primitive

**MERGED 2026-07-27** (squash; merge commit `8f4b67ea`, now `origin/main`).
Implements the hardened publication foundation: an audited publication
flip, a member-safe RPC projection (opaque ids, neutral labels, bucketed counts,
3-decimal coordinates), SECURITY DEFINER lock helpers, and trigger-enforced
write paths.

Reviewed in four passes (three scoped partitions plus one holistic integration
pass) against its exact bytes, with an executed offline PostGIS replay rather
than text-matched assertions. Corrections were applied to #752's OWN files as a
separate corrective cycle, because the review found defects in the foundation
itself - which is preferable to merging a known-RED foundation and hoping a
stacked PR repairs it later.

### This branch - `feat/option-c-candidate-lifecycle-restack-2026-07-27`

Implements the candidate lifecycle on top of #752: create / refresh / publish /
unpublish of site-aggregate candidates, an audited upsert RPC, admin UI actions,
and the audit-history wiring.

**Updated 2026-07-27.** #752 has MERGED, so the old "non-mergeable until #752
lands" dependency is DISCHARGED. This branch is a **clean restack**: the
candidate-only tree delta (`git diff 2908e96f f9661a84`, exactly 18 paths) applied
onto a fresh worktree cut from merged `main`. It is NOT stacked on a feature
branch and must not be treated as such.

The predecessor PR #753 was left conflict-dirty by the squash merge (which
destroyed the stacked ancestry) and is superseded, not rebased.

Its existence still implies **no Supabase deployability**. The SQL here is a
design/publication primitive, not an applied append-only migration, and the live
apply remains owner decision D2.

---

## 2. Owner decisions - current state

| # | Decision | State |
|---|---|---|
| D1(a) | Expose `coordinate_quality_tier` to members | **DECIDED 2026-07-27: KEEP** as a fixed coarse enum (`high`/`medium`/`low`). It carries no location information and the member RPC takes no parameters, so it cannot be probed. |
| D1(b) | `visible_sample_suppression_key` | **DECIDED 2026-07-27: KEEP for v1**, with a **v2 opaque-token follow-up**. Reviewers settled it at P3 (architectural hardening, not a privilege leak): it is non-NULL only under the same predicate that gates the member sample RPC, so a recipient can already derive it. The v2 work replaces it with a random or keyed token shared with the visible-sample projection. |
| D1(c) | Legacy fallback shape | **DECIDED: FAIL_CLOSED.** When the member-safe RPC is unavailable the ordinary member map returns NO aggregate markers plus an explicit unavailable state. It must never silently substitute the legacy RLS-derived admin-shaped projection. |
| D2 | Live Option C SQL apply | **NOT AUTHORIZED.** Owner-run only, via `docs/design/matrix-map/OPTION_C_PREAPPLY_RUNBOOK_2026_07_26.md`. |
| D3 | PR-MAP-6 / PR-MAP-7 / mobile summary in v1 scope? | OPEN. Each is a full runway. |
| D4 | Matrix Options completion boundary | OPEN. No written definition of done exists. |
| D5 | KB/wiki runtime advance | OPEN. Separate bounded lane. |
| D6 | Cleanup backlog (stale drafts, 130+ worktrees, stopped containers, root handoffs) | OPEN. Owner-run or owner-supervised. |
| D7 | Does `test@example.com` exist as a live auth account? | **RESOLVED: ABSENT** (2026-07-27, one-time owner-authorized read-only check). Gate 5 therefore runs full and unmodified. |
| D8 | GitGuardian on flagged commit `4a0c638c` | OPEN. Non-required check; whether a future push clears it is UNVERIFIED. |

---

## 3. What this commit contains

- Unit tests for the candidate route (auth, CSRF, payload validation,
  deterministic RPC error mapping, readback verification, success shape).
- Component tests for the admin actions (button matrices, modal, validation,
  pending/disabled, inline error recovery, drift badge).
- Drift detection corrected to compare the persisted snapshot TUPLE against live
  data instead of `sample_count_total` alone. A true hash comparison is NOT
  possible from the web tier: the live hash is produced only by
  `matrix_map.current_site_aggregate_snapshot`, whose EXECUTE is revoked from
  every role the app can use. Reimplementing that md5 in TypeScript would
  duplicate a SQL definition and silently drift from it.
- Corrected page copy: the page previously claimed to be a read-only preview
  where "nothing here is published" while rendering publish/unpublish controls.
- `fetch_site_aggregate_candidate_audit` wired into the audit-history route
  (it had ZERO callers, so candidate history was written but never surfaced).
- Candidate-delta SQL assertions added to the offline validation suite, and the
  replay harness parameterised so it can run against this branch's modified SQL.
- The owner-run pre-apply runbook.
- Documentation recovery: Matrix Map / Option C authorities registered in the
  docs manifest, and two gate bundles added, with **identity-based** regression
  tests.

---

## 4. The documentation-gate trap this lane hit twice

Worth reading before touching `docs/_meta/docs-manifest.json`:

1. **The gate passed vacuously.** No bundle's triggers matched the Matrix Map /
   Option C lane, so `npm run docs:gate` exited 0 without inspecting anything on
   every matrix-map change.
2. **The fix was gated on the wrong branch.** The recovery initially existed only
   in the primary checkout's working tree, while the gate runs against the
   candidate tip - so it would have reproduced exactly the vacuous pass it was
   meant to eliminate.
3. **The regression test was itself vacuous.** It asserted
   `activated_bundles.length > 0`. For any `src/app/api/**` path the generic
   `API_GATE` fires, so that passed whether or not the Matrix Map domain
   authority activated. The test written to prevent a vacuous gate pass WAS a
   vacuous assertion.

The tests in `scripts/verify/__tests__/docs-gate.test.mjs` now assert **exact
bundle identity and expected authority document ids**, with negative controls.
Never reintroduce a count-based assertion there.

---

## 5. Standing constraints

- Owner alone controls merge, live SQL, publication, and destructive cleanup.
- Never write a real verdict value into `v2_judgments` for any reason.
- Exact-path staging only; never `git add .` / `-A` / `-u`.
- Plain ASCII only (code point <= 127).
- Both Option C worktrees carry a real `.env.local` and a `node_modules`
  junction to the shared store: a recursive delete or `git worktree remove`
  follows the junction and empties that store.
- The primary checkout contains a NESTED live worktree that appears untracked;
  `git clean` there would destroy it.
- Three of this branch's baselined paths are UNTRACKED; `git clean -fd` destroys
  them irrecoverably.
