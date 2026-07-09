# Fresh Session Handoff -- Engine-v2 E-58 Launch Support Autonomous Run -- 2026-07-09

**Lane:** Regulatory Review / SSTAC engine-v2 (NOT Matrix Options -- see the separate, concurrent
`FRESH_SESSION_HANDOFF_2026_07_09_MATRIX_OPTIONS_POST_ORGANOMERCURY.md` for that lane).

This handoff closes out the 8-hour Autonomous Multi-Hour plan at
`C:\Users\jasen\.claude\plans\start-by-reading-the-foamy-rose.md`, executed in an isolated worktree
(`C:\Projects\SSTAC-Dashboard-worktrees\e58-launch-20260709`, branch
`fix/engine-v2-e58-launch-support-20260709b`) off `origin/main` at `88033cb` (11 commits past PR
#567's tip, all unrelated Matrix Options work).

## What this run did (production write + verification + one docs PR)

### Phase A -- Production write (owner-approved, the run's single interruption point)

Applied the already-merged migration
`supabase/migrations/20260709_v2_submission_chunks_search_rpc_fix_ambiguous_evidence_item_id.sql`
directly to production Supabase via `mcp__supabase-project-scoped__execute_sql` (not
`apply_migration`), after:
1. Byte-diff verification (Python, comment-stripped) confirming the packet's SQL matched the
   committed migration exactly.
2. Leg 1: Opus adversarial subagent review -- GREEN, no blockers.
3. Leg 2: codex targeted review (gpt-5.5 xhigh) -- GREEN, no blockers.
4. Explicit owner approval of the exact SQL, exact preflight/postflight queries, and exact tool
   (`execute_sql`, never `apply_migration`).

Execution: preflight confirmed the buggy version was live (`has_buggy_group_by=true`,
`has_buggy_select=true`); the `CREATE OR REPLACE FUNCTION` + `REVOKE`/`GRANT` block executed with
no error; postflight confirmed success (`has_qualified_reference=true`, both buggy flags `false`).
No other SQL was run. `apply_migration` was never used. `v2_judgments` was never touched.

### Phase B -- Read-only Search-submission smoke test: PASS

No test-login fixture exists in this repo (confirmed via e2e comments) and `.env.local` was never
read. Used the `browse` skill's sanctioned handoff flow: opened a visible browser at `/login`, the
owner signed in manually, then the session resumed read-only. Navigated to the real E-58 route
(project `11111111-1111-1111-1111-111111111111`, evaluation `33333333-3333-3333-3333-333333333333`);
page state matched the known DB state exactly (42/42 evaluated, 0/42 judged). Submitted 3 queries
(contamination, remediation, arsenic) to the Search-submission tab: all HTTP 200, real highlighted
results with citation badges, zero console errors, zero `search_failed` text. Save judgment, Ask AI,
and Export were not touched. Screenshot evidence:
`.tmp_evidence/phaseB_search_arsenic.png` (worktree-local, not committed).

### Phase C -- Skipped (no bugs found in Phase B)

### Phase D -- One docs-only PR opened, deliberately thin

**PR #569** (`docs: refresh vitest_test_count fact to 5474`, branch
`fix/engine-v2-e58-launch-support-20260709b`, same branch as this handoff): refreshed the stale
`facts.testing.vitest_test_count` (5080 -> 5474, 11 upstream commits' worth of Matrix Options test
growth), moved the superseded value to `facts_history` per this repo's own `facts_policy`. Also
carries an incidental `.gitignore` `+.gstack/` line from the browse tooling's own setup during
Phase B. Targeted codex review: GREEN. All 4 push gates GREEN on the final tip (lint 0 errors;
`npm run test:ci` -- run as `CI=true npm run test:coverage`, the identical underlying invocation
(`cross-env CI=true vitest run --coverage` per `package.json`) -- 279 files / 5474 tests passed;
monitored build exit 0, 85 static pages; e2e 40 passed / 0 failed). **Left UNMERGED per this run's
launch contract** -- the owner batches merges;
this session never runs `gh pr merge`.

Investigated and found NOT APPLICABLE (logged, no PR manufactured): extending the #559 fix's
RPC-column-shadowing safeguard-test pattern to other `RETURNS TABLE` functions in the repo. Checked
`replace_submission_chunks`, the admin-list RPC in `matrix_security_audit`, and both
`catalog_approve_staging_rows_bulk` variants -- none share the shadowing risk shape (no returned
column name collides with a queried-table column the way `evidence_item_id` did).

### Phase E -- Holistic strategic review: GREEN

First holistic codex attempt derailed (wandered into unrelated `gstack` skill markdown files,
never produced a verdict) -- correctly treated as INCONCLUSIVE, not guessed GREEN, per review
discipline. A second, tightly-scoped attempt (reading only `git show HEAD`, `CLAUDE.md`'s Supabase
Protocol + Never-Do sections, and `GATE_MODE_SOP.md`) concluded: the PR #569 diff is docs/ignore-
only and in scope; the Supabase Protocol explicitly permits owner-approved, codex-reviewed
`execute_sql` writes; no missed Gate Mode requirement in this session's process. Explicit
`VERDICT: GREEN` confirmed via a one-line follow-up.

Orphan-process sweep: inventoried all node/python processes at closeout. This run's own dev server
(port 3010, started for Phase B) is the only process this session owns; all others (the gate2b
worktree's known foreign cluster, codex/gdrive/hermes/windows MCP servers, a parallel session's
`agy-mo-autonomous` test run, a foreign pytest run) are confirmed foreign and untouched. No orphans
found requiring cleanup.

## PR ledger (this run)

| PR | URL | Branch | Scope | Gate status | Codex verdict | Merged? |
|---|---|---|---|---|---|---|
| #569 | https://github.com/JasenNelson/SSTAC-Dashboard/pull/569 | `fix/engine-v2-e58-launch-support-20260709b` | docs: vitest_test_count fact refresh + this handoff | lint 0 err / test:coverage 5474 pass / build exit 0 / e2e 40 pass 0 fail | GREEN | **NO** -- owner batch review |

No other PR was opened or merged by this session. Baseline (already merged before this run, NOT
this run's work): #556, #559-#562, #567 (engine-v2 E-58 lane), #563-#566 (Matrix Options, unrelated
lane, merged into `origin/main` between this run's base commit and the prior E-58 session).

## Real E-58 evaluation state (production, confirmed live and NOW SEARCHABLE)

- `project_id`: `11111111-1111-1111-1111-111111111111`
- `evaluation_id`: `33333333-3333-3333-3333-333333333333`
- status: `completed`, backend: `live`
- 42 per-policy rows, 420 submission chunks, 420 citation rows
- `search_submission_chunks` RPC: **FIXED in production** (this run's Phase A) and **VERIFIED
  working end-to-end** (this run's Phase B)
- `v2_judgments`: still 0 -- untouched by this run, as required

## Remaining deferred items (unchanged from the prior session's handoff)

- Export CSV/MD/HTML and Export memo verification against real (non-stub) data.
- One real judgment save + one real "Ask AI" chat query against evaluation `33333333` -- both
  remain untested end-to-end; the latter needs a live Ollama session (owner-gated per
  `OLLAMA_SCHEDULE_PROTOCOL.md`). Explicitly out of scope for this run per the launch contract.
- Any further `absent`/`error` indexing-state UI edge cases beyond #560's CTA -- not independently
  re-verified this run; a genuine gap was not found but deeper investigation was not attempted
  given this run's remaining budget after the primary mission (fix + verify) completed.

## Git/process notes

- Worktree: `C:\Projects\SSTAC-Dashboard-worktrees\e58-launch-20260709`, branch
  `fix/engine-v2-e58-launch-support-20260709b`, created from `origin/main` at `88033cb`; upstream
  now tracks `origin/fix/engine-v2-e58-launch-support-20260709b` (the PR branch) after `git push -u`.
- A second, misplaced worktree was accidentally created at
  `C:\Projects\SSTAC-Dashboard\ProjectsSSTAC-Dashboard-worktreese58-launch-20260709` early in this
  run (a bash backslash-path-mangling artifact) on branch
  `fix/engine-v2-e58-launch-support-20260709` (no `b` suffix). It has **no node_modules junction**
  (confirmed via `Test-Path`, the `mklink` attempt into it failed before creating anything) and was
  deliberately left untouched -- both because this run's launch contract excludes broad
  cleanup/delete, and because the harness's own safety classifier blocked a `git worktree remove`
  on it citing the L0 1.15 junction-trap history (correctly cautious, even though this specific
  case has no junction). **Recommend the owner review and clean this up manually** (either
  `git worktree remove` + `git branch -D fix/engine-v2-e58-launch-support-20260709`, or repurpose
  it) -- it is harmless clutter, not a data-loss risk, but it is unused.
- Primary checkout (`C:\Projects\SSTAC-Dashboard`) was never touched by this run; it remains 54+
  commits behind `origin/main` with 68 dirty/untracked paths from unrelated prior sessions, exactly
  as found at the start of this run.
- This run's own dev server (port 3010, `npx next dev -p 3010`, webpack not Turbopack -- Turbopack
  rejected the node_modules junction with "Symlink node_modules is invalid, it points out of the
  filesystem root") is still running at handoff time; safe to stop, or leave for the next session's
  convenience. Not orphaned (this session's own process, known ownership).

## Workflow note for the next session

Per the launch contract, this session never merges its own PR. When ready:
1. Review PR #569 (small, docs-only, all gates green).
2. Merge it (or decline/request changes) via the normal owner-merge flow.
3. Optionally clean up the misplaced worktree noted above.
4. The production fix (Phase A) is already live and verified independent of PR #569's merge status
   -- #569 is a documentation freshness fix, not a deploy gate for the actual production change.
