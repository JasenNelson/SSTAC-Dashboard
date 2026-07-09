# Fresh Session Handoff -- Engine-v2 E-58 Launch Support: Session A Closeout -- 2026-07-09

**Lane:** Regulatory Review / SSTAC engine-v2 (NOT Matrix Options -- see the separate
`FRESH_SESSION_HANDOFF_2026_07_09_MATRIX_OPTIONS_POST_ORGANOMERCURY.md` for that lane).

This is the final close-out for today's engine-v2 E-58 work, covering three sub-phases: the 8-hour
autonomous launch-support run (Phase A production fix + Phase B smoke test + Phase D docs PR), the
Regulatory Review / engine-v2 completion-plan development, and Session A of that plan's execution
(merging #569, closing docs drift via #573). Supersedes
`FRESH_SESSION_HANDOFF_2026_07_09c_ENGINE_V2_E58_LAUNCH_SUPPORT_RUN.md` as the current-state anchor
for this lane; that file remains as the historical record of the autonomous run itself.

## What shipped today (all merged to `origin/main`)

| PR | Merge SHA | Scope |
|---|---|---|
| #559 | `1f74a8a97b08ab808a3e0c171dba8b3b6bbe946a` | Fixed `search_submission_chunks` RPC ambiguous-column bug (code, from an earlier session today) |
| #560 | `a560ff0d7218ba0e4d2f61c66d0b81f03f34743f` | Index-submission-evidence CTA for absent indexing state |
| #561 | `2b335124eade0f0f6595c7a5e4ee3f23e05ff684` | E-58 provenance-clarity safeguard |
| #562 | `74bbdc2c559ea8237397bfdcf94e4f7ac755ee0e` | Supabase protocol reconciliation (owner-approved gated-write workflow) |
| #567 | `8f5e7642a7ec85373d512065e5ce5e35a8bec6f3` | Session handoff refresh |
| #569 | `2f30eac65b639e3421e243fcf10d84dc623f1035` | docs: vitest_test_count fact refresh 5080->5474 (autonomous run's Phase D) |
| #573 | `44c7baf01ffddb02ed76605c79882eb6b04de73a` | docs: close NEXT_STEPS/facts_history drift (completion-plan Session A, WP1) |

Main tip after today: `44c7baf01ffddb02ed76605c79882eb6b04de73a`.

## Production state (live, verified)

- Real E-58 evaluation: `project_id 11111111-1111-1111-1111-111111111111`, `evaluation_id
  33333333-3333-3333-3333-333333333333`, status `completed`, backend `live`, 42 per-policy rows, 420
  submission chunks, 420 citation rows.
- **`search_submission_chunks` RPC fix is LIVE in production** (applied via owner-approved
  `mcp__supabase-project-scoped__execute_sql`, never `apply_migration`, after dual-leg Opus +
  codex review and explicit owner approval of the exact SQL and exact tool). Preflight confirmed the
  bug was present; postflight confirmed the fix.
- **Search submission is LIVE-VERIFIED working**: 3 queries (contamination, remediation, arsenic)
  against the real evaluation, all HTTP 200, real highlighted results with citation badges, zero
  console errors, zero `search_failed` text.
- `v2_judgments`: still 0 rows -- untouched all day, as required.
- No other production Supabase state was changed today (no schema, no migration, no RLS/grant
  change, no Supabase branch).

## Completion plan for the rest of the lane

A full completion plan for the Regulatory Review / engine-v2 front end was developed, adversarially
reviewed (multiple codex correction rounds), and approved. It lives at
`C:\Users\jasen\.claude\plans\start-by-reading-the-foamy-rose.md`. Headline finding: **the engine-v2
front end is essentially feature-complete** (zero TODO/FIXME/stub markers across all pages,
components, lib, and API routes); the real remaining work is live-verification of already-built
features plus closing a structural test-coverage blind spot (100% mocked DB in every API-route test;
zero e2e coverage for Search/Ask-AI/export/judgment-save -- the exact gap that let #559 ship
undetected).

The plan is staged into three sessions:
- **Session A (Bounded Batch) -- DONE TODAY.** Merged #569, closed the NEXT_STEPS/facts_history
  drift via #573, investigated the env-config-seam item (WP6) and found it already documented, no
  change needed.
- **Session B (Bounded Batch, ONE owner-gated sitting) -- NOT STARTED, owner-gated.** Needs the
  owner's real-time presence: browser-handoff login, review of CSV/MD/HTML export output, an
  owner-flagged `v2_memo_exports` write (clicking Export memo), and the owner personally clicking
  Save on one judgment row for evaluation `33333333` (Claude never performs this click). Optionally
  also scheduling a live Ollama session for one real Ask-AI query.
- **Session C (Bounded Batch or short Autonomous Multi-Hour) -- NOT STARTED.** e2e test-coverage
  build-out (Search submission, export, reindex, judgment-save-against-a-local-fixture) closing the
  structural blind spot. Needs a strategic codex review on the local/seeded-fixture design question
  before authoring begins. No owner presence required; no production data involved.

Sessions A and B should complete before Session C, so Session C's specs assert against a fully
current baseline.

## Remaining deferred items (unchanged)

- Export CSV/MD/HTML and Export memo -- live verification against real (non-stub) data (Session B).
- One real judgment save against evaluation `33333333` -- owner-only action (Session B).
- One real Ask-AI chat query -- needs a live Ollama session, owner-gated per
  `OLLAMA_SCHEDULE_PROTOCOL.md` (Session B, optional timing).
- e2e coverage for Search/export/judgment-save/reindex (Session C).
- `PolicySearchPanel`'s "View details" no-op -- deliberately owner-parked (Lane 2e deep-link,
  2026-05-13 lock). Out of scope unless the owner reopens it.

## Git/worktree notes

- Worktrees used today, all left in place (not cleaned up, per this repo's no-auto-cleanup rule):
  `C:\Projects\SSTAC-Dashboard-worktrees\e58-launch-20260709` (the 8h autonomous run),
  `C:\Projects\SSTAC-Dashboard-worktrees\session-a-20260709` (completion-plan Session A),
  `C:\Projects\SSTAC-Dashboard-worktrees\closeout-20260709` (this handoff).
- A harmless misplaced worktree remains at
  `C:\Projects\SSTAC-Dashboard\ProjectsSSTAC-Dashboard-worktreese58-launch-20260709` (a bash
  path-mangling artifact from earlier today, no node_modules junction, no data risk). Still
  recommended for owner manual cleanup (`git worktree remove` + `git branch -D
  fix/engine-v2-e58-launch-support-20260709` -- note: no `b` suffix, distinct from the now-merged-and-
  retained `fix/engine-v2-e58-launch-support-20260709b`).
- Primary checkout (`C:\Projects\SSTAC-Dashboard`) was never used for any edit today; only for
  fetching, orphan-process checks, and creating worktrees. It remains behind `origin/main` and
  dirty with unrelated prior-session artifacts, unchanged from before today.
- This session's own dev server (port 3010, in the `e58-launch-20260709` worktree) was stopped at
  close-out (it was this session's own process; no longer needed).
- Two build-only placeholder `.env.local` files were created in fresh worktrees today
  (`session-a-20260709`, `closeout-20260709`) containing only dummy `NEXT_PUBLIC_*` values --
  never real credentials, never read/printed.

## Workflow note for the next session

Per this repo's rules, no session merges its own newly-opened PR without the owner's explicit,
real-time authorization for that exact PR/SHA -- both #569 and #573 were merged this session only
after the owner separately confirmed each PR's exact head SHA, all-checks-SUCCESS, and
`mergeStateStatus: CLEAN` state and explicitly authorized the merge. The next session (Session B)
requires the owner's presence; it cannot be launched as a background autonomous prompt the way
Session A could.
