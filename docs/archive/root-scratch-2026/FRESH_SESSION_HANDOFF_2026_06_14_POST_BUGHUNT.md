# Fresh-Session Handoff -- Matrix-Options lane, post bug-hunt (2026-06-14)

Entry point for a fresh session continuing the autonomous Matrix-Options (MO) work. The prior session
ran very long (manifest + owner-directed deepening + bug-hunt) and is checkpointing to protect context.
Read this first, then `~/.claude/plans/autonomous-mo-15h-RUNLOG.md` (full transaction log) and
`AUTONOMOUS_APPROVAL_QUEUE_2026_06_14.md` (owner-facing actions).

## State (as of checkpoint)
- origin/main tip: `0085405` (after #322). PR #323 (below) merges on top.
- MERGED this session: #318 (nested-source guard x8 promote scripts), #319 (4-lesson + manifest
  closeout), #321 (food-web safety tests + fail-closed CSV + validator dedup), #322 (calc-engine
  safety coverage, 18 tests / 11 magnitude-determining branches). [M0 = #317 pre-merged 5baa953.]
- DRAFT (owner-gated, NOT merged): #320 TWN toddler-94 mixed-source food-web receptor (PRE-PROMOTION).
- All session worktrees removed; shared node_modules store intact (723).

## IMMEDIATE FIRST ACTION -- merge PR #323 (B1 SSD bug fix)
PR #323 "fix(matrix-options): fail-closed block on mixed-unit UPLOADED SSD input", head `c203578`,
base main. Commit + push protocols COMPLETE (codex Spark + 5.5-xhigh mutual-agreement GREEN; the
5.5-xhigh round raised the live-path scope P1, resolved by owner-decided scoping + an in-code
SCOPE-LIMITATION comment + a filed follow-up; codex re-review = no correctness issues). 5 LOCAL gates
GREEN (tsc, lint, CI test:ci 3890/0-failed, build, e2e 138 -- run in an isolated worktree).
- CI BLOCKED (CONFIRMED, owner-decided 2026-06-14): the Unit job failed TWICE (~1min each) with
  `write EPIPE` at vitest `emitWorkerError` -- the STRUCTURAL CI OOM (memory
  `dashboard_phase_d_hc_pqra_direct_contact_2026_06_11`). NOT a #323 logic failure (unrelated
  engine-v2/polls tests; my SSD change passed locally 3890/0). The "rising floor" finally crossed the
  ceiling: this session added many tests, so the current 4-shard config (ci.yml; maxWorkers=1, 8GB
  heap) is no longer enough. THIS NOW BLOCKS ALL MO PRs, not just #323. Owner chose: DEFER + fix infra
  first.

  >>> FRESH-SESSION ORDER OF WORK:
  1. CI-INFRA FIX FIRST (small PR): in `.github/workflows/ci.yml` bump the Unit job from 4 to 6
     SEQUENTIAL shards -- the loop `for i in 1..4` -> `1..6` and `--shard=$i/4` -> `--shard=$i/6`
     (~lines 65-66), AND extend the Codecov merge `files:` list to shard-1..shard-6 (~line 80).
     "Change one variable at a time" (shard count only; keep maxWorkers=1 + 8GB). This is the
     documented next step. Get the infra PR green + merged.
  2. THEN MERGE #323: rebase its branch onto the new main, push, and on CI CLEAN ->
     `gh pr merge 323 --squash --match-head-commit <new head>` (the content is the c203578 SSD fix).
  3. THEN the coverage PR (below) off the post-#323 main.
  (If 6 shards still OOM, the next single-variable step is 8 shards; maxWorkers=2 OOM'd on Node 20
  before -- avoid. Surface to owner if 8 shards is insufficient -- may need a runner with more RAM.)

## NEXT WORK (autonomous) -- the COVERAGE PR (sweep items C2/C3/C4), off post-#323 main
A bug-hunt+coverage sweep (Workflow) confirmed these magnitude-determining COVERAGE gaps (test-only,
lower-risk; ship as ONE bounded PR via the full per-PR pipeline -- fresh junction-safe worktree off
origin/main, 5 gates, Opus + codex Spark->5.5-xhigh, head-pinned merge):
- C2: `scripts/matrix-options/generate-catalog-records.mjs` generate() orchestration (lines ~389-507)
  is exported but untested: class-1 same-tuple/same-value dedup, class-3 dirty-routing, IRIS 2%
  integrity drop, in-batch slug disambiguation. A regression here drops a real catalog candidate or
  emits a wrong/dup row silently. (generate() has zero test imports repo-wide.)
- C3: same file, `dirtyExtractionReason` + `irisSnapshotDropReason` (~345-387) -- the two corruption
  gates -- untested for their accept/reject boundaries.
- C4: `src/lib/matrix-map/stats.ts` (~560-563, 648-649) -- the censored-KM Gamma UCL chain
  (KM-moments shape -> k* -> Approximate/Adjusted Gamma EPC) is entirely unpinned; a wrong 95% UCL =
  wrong exceedance decision. Pin it with hand-computed expected values.
NOTE: C1 (defaultSelectionPolicy unitBlocked end-to-end) is ALREADY covered by #322 -- skip it.
After the coverage PR, the autonomous MO well is genuinely near-dry; assess honestly and stop clean.

## OWNER-GATED (parked in AUTONOMOUS_APPROVAL_QUEUE_2026_06_14.md -- AI ran NO promote --apply)
- M5-A: TWN WOCBA-220 -- overlap with shipped #316; Option A (do nothing) vs B (small BW-69.8 row).
- M5-B / #320: review the draft, file the TWN PDF in Zotero, run promote-twn-foodweb-toddler.mjs --apply.
- M6: HC-2017 sediment -- values verified; needs the risk-assessor operationalization judgment.
- SSD live-path follow-up (NEW, from #323): the live ecotox_mirror path does NOT fetch the unit
  column, so the mixed-unit guard is upload-only. Read-only SQL in the approval queue to confirm the
  mirror's unit column, then add it to ECOTOX_OPERATIONAL_COLUMNS + cover the live route.

## LESSONS / CAUTIONS for the fresh session
- RUNAWAY SUBAGENT: the B1 authoring subagent went runaway -- it WMI-DETACHED a `test:ci` and entered
  a monitor wait-loop that re-spawned the run on every kill, churning ~10+ orphan vitest processes and
  corrupting the worktree coverage temp. Workaround used: gate in a SEPARATE detached worktree
  (`git worktree add --detach <path> <commit>`) so orphans (pinned to the old path) cannot contend.
  GUARDRAIL: do NOT instruct a subagent to run a long detached/monitored test:ci itself; have the
  subagent author + run only SCOPED fast suites, and run the full `test:ci` gate yourself.
- Run the FULL `CI=true npm run test:ci`, not just touched suites (catalog-wide invariants live
  elsewhere -- catalog.test.ts evidence.qa_status; the #322<->B1 hcp.test.ts Candidate 2 interaction).
- When branching off a pre-merge base, REBASE onto current origin/main before pushing + reconcile any
  test that asserted behavior your change altered (B1 had to reconcile #322's Candidate 2).
- VERIFY subagent claims (they flaked repeatedly this session: "2 tool_uses", unparseable summaries,
  wrong file paths) -- re-run the authoritative gate yourself.
- codex 5.5-xhigh catches what Spark + Opus + you miss (the live-path P1) -- keep it as the ship gate.
- Junction cleanup: `fsutil reparsepoint delete` (NOT `cmd /c rmdir`, which trips a safety hook); kill
  worktree test procs precisely by command-line match (taskkill /F /T /PID), never node by name.

## Pointers
- Run-log: `~/.claude/plans/autonomous-mo-15h-RUNLOG.md` (RESUME line at top).
- Playbook: `~/.claude/plans/autonomous-mo-15h-2026-06-14.md`.
- Approval queue: `AUTONOMOUS_APPROVAL_QUEUE_2026_06_14.md` (repo root).
- Memory: `dashboard_session_2026_06_14_autonomous_mo_lane.md` + MEMORY.md index.
