# Fresh-session 12h semi-autonomous workplan -- whole-app demo readiness -- 2026-06-04

Paste this whole file to start the fresh session. Plain ASCII only. Read `MEMORY.md` top entries +
`C:\Projects\CLAUDE.md` (L0) + `SSTAC-Dashboard\CLAUDE.md` (L1) + `docs/GATE_MODE_SOP.md` first.

## Why this session exists (owner intent)

A CEO expressed interest; owner wants a demo in ~2 weeks. Owner is NOT rushing to demo-ready -- the
PRIMARY want is an honest answer to **"how close is the WHOLE regulatory-review app (with engine-v2
powering it) to fully functional?"** -- not just engine-v2, the whole app. Secondary want: make
significant, SAFE progress while the owner is in and out of the office (desktop) and otherwise on
remote control. So: assessment first (the deliverable), conservative autonomous wins second.

This is an EXPANDED-SCOPE session (owner-directed) -- broader than the usual single-lane lock. That
makes conflict-discipline the load-bearing safety rule (see below), since parallel sessions are active.

## Verified starting state (re-confirm: `git fetch && git log --oneline origin/main -4`)

- origin/main @ **a6f617a** at handoff. Recent: #252 (Guide refresh), #251 (engine-v2 M1a Phase 2),
  #250 (IRIS qa-promotion capability), #249 (IRIS verification packet).
- See `SESSION_CHECKPOINT_MATRIX_OPTIONS_2026_06_04_EVENING.md` for what the matrix-options lane just
  shipped and what is parked.
- Primary checkout is on the stale branch `docs/matrix-options-session-2026-05-31`. Start by
  confirming no parallel session is using it, then `git checkout main && git pull` (or just work from
  fresh worktrees off origin/main).

## LOAD-BEARING SAFETY RULES (do not skip -- you are semi-autonomous)

1. **Conflict-check before touching ANY file in a lane.** Before editing code in a subsystem, run:
   `git fetch`, `gh pr list --state open`, `git worktree list`, and check recent commits +
   `.tmp_*`/scratch mtimes. Parallel sessions are ACTIVE in **engine-v2** and **regulatory-review
   front-end** (today). If a lane shows an active parallel session, treat it as READ-ONLY (assess
   only; do not edit). Per L0 1.6 + 1.15.
2. **Worktrees, never `git checkout -b` in the shared checkout.** One worktree per task off
   origin/main; junction node_modules via PowerShell `New-Item -ItemType Junction`; teardown
   junction-safe: assert LinkType=Junction + Target=shared, `$j.Delete()` (.NET; NOT `cmd /c rmdir`
   -- hook-blocked), verify shared count unchanged (723), THEN `git worktree remove --force` + prune.
3. **Full gates before every push** (GATE_MODE_SOP): `npx tsc --noEmit`; `npm run lint`;
   `npm run test:ci`; monitored build (`build:monitored:clean -- -TimeoutSeconds 360 -PollSeconds 10`);
   `npm run test:e2e` (local e2e is dev-server-flaky under load -> CI e2e is authoritative for
   non-frontend changes). Show the consolidated 4-gate block. CI is ~40 min/PR.
4. **Commit protocol (codex iterate-to-GREEN):** codex CLI RECOVERED via the app-local-binary shim
   (`cross_project_codex_cli_binary_drift_use_app_local_2026_06_04`) -- prefer it; fall back to
   cursor-agent (out of usage until ~6/15) then owner codex DESKTOP then Opus+re-review-queue. Always
   Leg-1 Opus adversarial + Leg-2 codex-family to mutual-agreement GREEN before merge.
5. **Standing prohibitions:** AI never writes qa_status / verdicts; never mutates the catalog or
   pastes to Supabase; path-scoped staging only (never `git add .`/`-A`/`-u`); ASCII-only (<=127,
   incl. PR bodies); no mass deletion; max 3 background subagents; never recursive-delete a node_modules
   junction or another session's worktree.
6. **AI-merge** (squash) only once local gates AND all CI checks GREEN for the pushed head (standing
   auth; repo auto-merge OFF -> poll then merge). For OWNER-FACING content/prose or risky changes, do
   NOT auto-merge -- open the PR and wait for owner review via remote control.
7. **Checkpoint for remote control:** every ~2-3h, write/update a progress checkpoint doc the owner
   can read remotely (what landed, what is open, what needs a decision). Surface decisions explicitly.

## PHASE 1 (first ~2-3h, READ-ONLY, the #1 deliverable): whole-app functional readiness assessment

This directly answers the owner's question and is zero-conflict (read-only). Recommended: run it as a
**Workflow** (ultracode is on) -- parallel subsystem readers -> synthesis. Assess each surface for:
does it work END-TO-END for a demo user? what is stubbed / mocked / broken / incomplete? what is a
DEMO-BLOCKER vs polish? what data/migrations must be live? Rate each surface (e.g.
Working / Partial / Stub / Broken) with evidence (file:line, missing migration, failing path).

Surfaces to assess (adjust after a quick repo scan):
- Auth + middleware (login/signup, role gating, protected routes) -- `src/middleware.ts`, `(auth)/`.
- Dashboard shell + nav + admin (users/roles, PROJECTS_MAP / AI_SUBSCRIPTIONS, announcements).
- Regulatory-review: engine v1 results views (reads `rraa_v3_2.db`) + engine-v2-powered views (the
  M1a `applicable_policy_ids`, evaluate route, methodology paper) -- note engine-v2 is a PARALLEL lane
  (assess read-only).
- Matrix Options (calculators x4, Evidence Library, Guide, Jurisdictional Frameworks, SSD Workbench,
  Interactive Map) -- mostly shipped; verify end-to-end.
- BN-RRM (interactive maps, HITL packet views, stores).
- CEW polls / TWG Review portal / SSD.
- Agentic OS terminal (node-pty sidecar `scripts/agentic-os-pty-server.mjs`) -- demo-sensitive.
- Data/infra: which Supabase migrations are applied live (owner-applied; you cannot query -- infer
  from migration files + note "owner to confirm applied"); Vercel deploy health; env/secrets posture.

DELIVERABLE: `WHOLE_APP_READINESS_REPORT_2026_06_04.md` -- per-surface rating + evidence + an overall
"how close to fully functional" read (honest %, with the basis) + a PRIORITIZED demo-readiness backlog
(demo-blockers first, then high-value polish), each item tagged: lane, conflict-risk (is a parallel
session active there?), autonomous-safe vs owner-gated, rough effort. Surface this to the owner for
remote review BEFORE doing Phase 2 code work.

## PHASE 2 (~6-8h, CONSERVATIVE autonomous wins): execute SAFE, NON-CONFLICTING backlog items

From the Phase-1 backlog, execute ONLY items that are: (a) in a lane with NO active parallel session
(conflict-checked), (b) low-risk, (c) not owner-facing-prose and not owner-gated. Favor: test-coverage
gaps, obvious bug fixes, a11y, broken links/imports, dead-code cleanup, doc accuracy, small DX. ONE PR
per item, full gates, codex-GREEN, AI-merge on green. AVOID engine-v2 + regulatory-review front-end
edits while those parallel sessions are active (assess-only there). When in doubt, SURFACE the item
for owner approval rather than autonomously merging. Log anything you intentionally skip.

## PHASE 3 (only if owner responds via remote control): owner-gated execution

If the owner answers a parked decision via remote control, execute it with full discipline:
- Matrix Options qa-promotion: if owner says run it, THEY run `apply-qa-promotion.mjs --apply ...`
  (AI never writes qa_status) -- you can dry-run + verify.
- Frame-aware variant: if owner picks **Type-B** (wrapper, shippable now) vs **Type-A** (dispatcher
  surgery) AND supplies the variant data (substance + RfD/SF + verified catalog_sources UUID), build
  it per `MATRIX_OPTIONS_OWNER_GATED_PREP_2026_06_04.md` (one variant per PR; test asserts variant !=
  baseline; promote the pair to calculation_ready in regulatoryFrames.ts).
- Eco passes: if owner scopes them in, the owner pastes the staging SQL (you never paste).

## Preliminary readiness sketch (UNVERIFIED -- confirm/replace in Phase 1)

Orienting guess only, to be replaced by the real assessment: the app has a LOT shipped and demo-able
(auth, dashboard, matrix-options calculators + evidence library + guide, BN-RRM maps, CEW polls, TWG
review, regulatory-review v1 results). The engine-v2 cutover (v2 powering regulatory-review) is
IN-PROGRESS (M1a Phase 2 just landed applicable_policy_ids; M1b wizard + M1c evaluate-route cutover are
the next milestones per the engine-v2 session). So "the whole app with engine-v2 powering it" is
likely the gating storyline for demo-readiness. Phase 1 must verify this and quantify the gap honestly
-- do not assume.

## End-of-session

Run `/update-docs`; write a closing checkpoint + a next fresh-session handoff; junction-safe teardown
of all worktrees; orphan-process check (do NOT kill -- parallel sessions + MCP servers live).
