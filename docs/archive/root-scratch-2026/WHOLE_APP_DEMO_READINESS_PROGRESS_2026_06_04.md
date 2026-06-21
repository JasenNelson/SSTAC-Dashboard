# Progress checkpoint -- whole-app demo-readiness session -- 2026-06-04 (autonomous)

Plain ASCII. This is the remote-control progress doc (updated every ~2-3h). Owner is away ~6h,
no approvals possible -> I am running fully autonomously, parking everything owner-gated.

## Status at a glance

- **Plan:** WRITTEN + reviewed. Leg-1 Opus adversarial loop = GREEN (round 1 YELLOW with 6
  IMPORTANTs -> all folded into v2 -> round 2 confirmed GREEN with runtime verification).
  Leg-2 codex-family ship gate = DEFERRED (all 3 rungs unavailable: codex CLI skipped because
  the codex DESKTOP APP is open / 4 codex.exe; cursor-agent confirmed OUT OF USAGE; owner-app
  needs you). Logged to the codex re-review queue. Proceeding on Opus-GREEN per your "do not stop
  and wait"; the binding codex gate is applied per Phase-2 CODE PR (re-probe when the app closes).
  Plan file: `C:\Users\jasen\.claude\plans\can-you-explore-the-zazzy-mountain.md`.
- **Phase 0 (conflict scan):** DONE. origin/main @ a6f617a. engine-v2 (m1a-phase2) lane confirmed
  ACTIVE today -> hands-off. regulatory-review-FE -> default assess-only. ~22 leftover worktrees +
  the codex desktop app + a parallel engine-v2 session are live -> NO process kills, NO touching
  other sessions' worktrees. Primary checkout is on the stale branch with pre-existing uncommitted
  files (NOT mine to commit); all my work happens in fresh worktrees off origin/main.
- **Phase 1 (the #1 deliverable -- read-only whole-app readiness assessment):** RUNNING now as a
  Workflow (9 surface readers + synthesis). Output -> `WHOLE_APP_READINESS_REPORT_2026_06_04.md`.
  This answers your question: "how close is the whole app to fully functional?"
- **Phase 2 (conservative autonomous wins):** queued, starts after Phase 1. Only safe,
  non-conflicting, non-owner-facing items; one PR each; full gates + codex-family GREEN; AI-merge
  reserved to the narrowest classes (manifest refresh / pure test additions / trivial mechanical),
  everything else PR-open for your review.
- **Phase 3 (owner-gated -- PARKED until you return):** MO qa-promotion FLIP, frame-aware variant
  (Type-A vs Type-B decision + data), eco-passes SQL paste. I will NOT start these.

## What you may want to decide on return (no rush)

1. Optional codex desktop re-confirm of the plan + any Phase-2 PRs (the codex-family leg was
   deferred this window).
2. The three parked owner-gated items above (each needs your call / data / paste).

## PHASE 1 COMPLETE -- the answer

Full report: `WHOLE_APP_READINESS_REPORT_2026_06_04.md`. Headline:

**On origin/main the app is ~75-80% demo-functional, and the gap is almost ENTIRELY owner-only
confirmations -- NOT missing code.** Two unknowns gate it: (1) which environment hosts the demo
(engine v1 + Agentic OS terminal are local-dev-only BY DESIGN, fail gracefully on Vercel);
(2) which Supabase migrations are applied to the target project (admin tables live in
database_schema.sql, and TWG `review_submissions` has no migration -- both likely already applied
on the long-running project, but I cannot query to confirm). If demoed on the existing
local/production env with migrations applied, it is ~85%.

IMPORTANT CORRECTION: the automated pass flagged an engine-v2 `applicable_policy_ids` column/type
MISMATCH as the "#1 blocker" -- that was a STALE-BRANCH artifact. On origin/main #251 already
synced the type (types.ts:38) + the page SELECT (page.tsx:35) + the migration. The only engine-v2
action is APPLY the 20260604 migration before deploying main (ordering, not a code gap).

Demo-blockers (all owner actions, each small): apply the engine-v2 migration; confirm/apply admin
tables + review_submissions; lock the demo environment. Path to 90%+ is "confirm-and-configure,"
not "build more code."

## Phase 2 (now): conservative autonomous wins -- NOTE codex-family is DOWN this window

Because codex CLI (desktop app open), cursor-agent (out of usage), and owner-app (you away) are
all unavailable, NO PR can meet the codex-family ship gate right now -> I cannot AI-MERGE anything
this window. So Phase 2 produces PR-open / prep artifacts (Opus-GREEN + local-gates-GREEN +
codex-deferred-queued) for you to codex-confirm + merge on return. Highest-value safe work: a
demo-blocker resolution kit (exploratory SQL you run first + ready-to-paste migration drafts +
env checklist) so you can clear the demo-blockers fast. I will NOT apply any SQL or merge any PR.

## Phase 2 delivered (docs -- safe, no merge needed, you act on return)

- `WHOLE_APP_READINESS_REPORT_2026_06_04.md` -- the #1 deliverable (per-surface ratings + honest %
  + prioritized, tagged backlog), corrected for stale-branch artifacts and verified vs origin/main.
- `DEMO_BLOCKER_RESOLUTION_KIT_2026_06_04.md` -- read-only pre-flight SQL (you paste first) +
  conditional remedies + an environment decision matrix + a 10-min demo dry-run click-path.
  (synced rev9 2026-06-05 per codex Leg-2 round 8 -- this block previously claimed remedies point
  ONLY at existing repo files and that I authored no schema; that is NO LONGER accurate and is
  corrected here the same way the DO-THIS-WHEN-YOU-RETURN block was.) MOST remedies DO point at
  existing repo files (database_schema.sql, the `supabase/migrations/` chain incl. the catalog
  migrations and `20260527000001_user_roles_rpcs.sql`) and are safe to run, BUT Remedies G
  (`matrix_reviews`) and H (`document_tags`) are CODE-DERIVED RECONSTRUCTIONS -- there is NO
  `CREATE TABLE` for those two tables anywhere in the repo -- so each is GATED on you live-verifying
  the reconstructed contract against the target project (or explicitly DEFERRING that surface) BEFORE
  running; do not treat G/H as repo-backed safe. Separately, `/admin/reset-votes` is OWNER-GATED /
  OUT-OF-DEMO-SCOPE: its `create_vote_backup` RPC has NO definition in the repo and the page exposes
  permanent vote deletion -- the kit provides no probe/remedy for it by design (DEFER). KEY finding
  still holds for the admin/TWG TABLES: they live in ONE authoritative file already in the repo
  (database_schema.sql), so that part is a SINGLE owner check, not new schema. I paste nothing.

DELIBERATELY NOT DONE this window (logged, not skipped silently):
- Manifest vitest_test_count refresh: ready-to-run but un-mergeable now (codex gate down) + it runs
  a full coverage build; not worth spinning a worktree + heavy build alongside the active parallel
  session for a cosmetic, un-mergeable change. Ready when you/codex are back.
- Agentic OS card hide / admin status honesty / SSD scope: these are UX/product JUDGMENT calls
  (you may WANT the card visible to discuss the capability) -> surfaced as recommendations in the
  report, not auto-built.

## Verification COMPLETE (review-throughout discipline; Opus stood in for codex)

An adversarial Opus fact-checker re-verified every load-bearing claim in the report + kit against
origin/main: engine-v2 column+SELECT, middleware 6 prefixes, static-import catalog, better-sqlite3
externalization, the pty sidecar/port, all 10 database_schema.sql tables WITH exact line numbers,
the review_submissions CHECK shape, and all 3 cited migrations -- ALL verified TRUE. No remaining
stale-branch artifacts. Verdict YELLOW -> 3 minor corrections, all FOLDED:
1. (material) Agentic OS terminal is DUAL-FLAG: NEXT_PUBLIC_AGENTIC_OS_ENABLED renders the card;
   the pty SPAWN also needs NODE_ENV=development OR AGENTIC_OS_LOCAL=true. A prod-build local demo
   must set BOTH. (Kit STEP 3 + report updated.)
2. Catalog "1573" is the HH-TRV file alone; ~1.6k total bundled. (Reworded.)
3. regulatory-review.db ~166MB is a local-disk artifact, not in the repo. (Noted.)
Also extended the report with the standalone routes (/matrix-map, /hitl-packets, /wiks,
/cew-results, /twg-results, admin sub-pages) for completeness.

## DO-THIS-WHEN-YOU-RETURN (ranked)

1. Read `WHOLE_APP_READINESS_REPORT_2026_06_04.md` (the answer: ~75-80% on main, gated on
   confirmations not code).
2. Run the read-only STEP 1 SQL in `DEMO_BLOCKER_RESOLUTION_KIT_2026_06_04.md` against your TARGET
   Supabase project (paste through probe `1n`, the last in the block -- rev9 added 1n for the
   Admin->Users `manage_user_role_*` RPCs). It tells you in one paste whether the engine-v2 column
   + the 10 app tables + the Matrix Options catalog-runtime tables (probe `1m`) + the role RPCs
   (probe `1n`) + the map/staging RPCs are present. The admin-user COUNT is the separate optional
   `1g` block (run only after `user_roles` confirms present). Apply only the remedies it flags.
   (synced rev8 2026-06-05) SAFETY DISTINCTION -- not every remedy is repo-backed, so I can no longer
   claim "I authored no schema": MOST remedies point at existing repo files (database_schema.sql, the
   `supabase/migrations/` chain) and are safe to run, BUT Remedies G (`matrix_reviews`) and H
   (`document_tags`) are CODE-DERIVED RECONSTRUCTIONS -- there is NO `CREATE TABLE` for those two app
   tables anywhere in the repo, so each carries an "IMPORTANT -- READ BEFORE RUNNING" caveat and is
   GATED on you live-verifying the reconstructed column/RLS contract against the target project (and
   confirming the table is truly absent via probe 1j/1l) BEFORE running, OR explicitly DEFERRING that
   surface. Running a reconstruction mutates production schema from a code inference, not an approved
   migration -- so treat G/H as owner-gated, not auto-safe. Everything else (engine-v2 column =
   Remedy A; the 10 app tables = Remedy B; CEW = Remedy E; map = Remedy D; the `1m` Matrix Options
   catalog tables = the named catalog migrations, four of five repo-backed, `parameter_value_reviews`
   the lone Studio-applied exception with no migration on disk) is repo-backed. I paste nothing
   (Supabase MCP is dead; AI never pastes).
3. Lock the demo ENVIRONMENT (local dev:all vs Vercel) -- this alone resolves 2 "Partial" surfaces.
4. Optional codex re-confirm of the plan + (when you want them) the deferred owner-gated MO items
   (qa-promotion flip, frame-aware Type-A/B + data, eco-passes paste) -- see
   `MATRIX_OPTIONS_OWNER_GATED_PREP_2026_06_04.md`.

## Deliberately deferred this window (reasoned, not blocked-on-you)

- All code PRs: codex-family ship gate is DOWN (desktop app open + cursor-agent out + you away),
  so NOTHING can be AI-merged this window -- producing un-mergeable PRs adds risk without payoff.
- Manifest vitest_test_count refresh: ready-to-run (`npm run docs:manifest:update -- --vitest` in a
  fresh worktree off origin/main), but it runs a full coverage build; not worth spinning a heavy
  build alongside the ACTIVE parallel engine-v2 session (Windows process-safety, L0 1.9) for a
  cosmetic, un-mergeable change.
- Judgment-laden polish (Agentic OS card visibility, admin "system status", standalone SSD scope):
  surfaced as recommendations -- they are YOUR product calls, not autonomous edits.

## Session hygiene

I created NO worktrees and made NO commits (all deliverables are untracked working-tree docs, per
the repo's handoff convention). Nothing of mine to tear down. I did not kill any process.

---

## Checkpoint 2026-06-05 ~07:00 (24/7 ops session, it2-it3)

- KIT + READINESS REPORT now rev2: codex Leg-2 round-1 (6 findings) AND round-2 (4 new findings)
  all fixed + independently adversarially verified GREEN. Key catch: review_files (and documents)
  in database_schema.sql are STALE vs live code -- Remedy B now creates the LIVE contract
  (filename/mimetype/file_size/uploaded_at). Kit is materially safer than the 06-04 version;
  codex round-3 confirmation still queued (codex busy: app open + parallel session reviewing).
- PR #254 OPEN: manifest vitest_test_count 481 -> 2992 + stripAnsi extractor fix. lint/tsc/unit
  (2992 CI=true)/build/docs:gate GREEN; local e2e RED x2 ENVIRONMENTAL (worktree path-casing
  cold-page timeouts) -> owner-approved exception, CI required E2E arbitrates. Merge gated on CI
  green + codex GREEN.
- P1 queries.ts CHECK-violation: implemented in worktree p1-review-status-2026-06-05 (4 dead-code
  literals + stale type; new regression test 6/6; tsc 0). Awaits codex commit-review + gates.
- 3 HITL walkthroughs READY at repo root (qa-flip / Type-B / eco), adversarially verified;
  recommendations: flip-all-20 / one-pilot-variant / defer-eco.
- /grill-me-codex installed (user-level, security-clean, /codex-review collision avoided).
- OWNER-OWED unchanged: STEP 1 pre-flight SQL (kit rev2 is the one to use), eco yes/no (Card C,
  2304 rows), qa-flip run (Card A), Type-B blanks (Card B).

## Checkpoint 2026-06-05 ~09:30 (it6)

- PR LEDGER (rev11 2026-06-05 per codex Leg-2 round 10): #254 (`8dc6224`, manifest 2992 + stripAnsi),
  #255 (`a210844`, queries.ts CHECK fix -- IN_PROGRESS|SUBMITTED), and #256 (`aa69796`, coverage tests
  +421) are ALL MERGED to origin/main (verified via git log on origin/main, 2026-06-05). Nothing of
  this session's PRs remains open; no merge-#255 follow-up is owed.
- E2E ENV: root-caused (junction target casing) + fixed + verified in 3 worktrees (138P/69S/0F,
  0 casing warnings). Rule in workplan rails + session memory.
- KIT: rev5. 15 findings closed (codex rounds 1-4 = 14, Opus matrix verify = 1: document_tags).
  Awaiting codex round-5 confirmation at the 10:23 usage window before owner runs STEP 1.
- DEAD-CODE SWEEP: report-only DEAD_CODE_SWEEP_REPORT_2026_06_05.md. Clean: no broken imports.
  Candidates: html2canvas (unused dep; package.json = owner-gated), api/db dead layer (DEFERRED --
  PR #255 test now imports it; owner decides live-vs-retire), 18 dead API types (conditional).
- OWNER QUEUE (rev11 2026-06-05 per codex Leg-2 round 10: #255/#256 now MERGED -- merge step removed):
  HITL walkthroughs (Cards A/B/C); STEP 1 SQL after kit round-5 GREEN; html2canvas removal yes/no;
  db/api layer live-vs-retire.
