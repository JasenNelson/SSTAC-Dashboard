# Fresh-session handoff -- SSTAC-Dashboard, 2026-06-08

Plain ASCII. Single anchor for the next session. Role: Claude = thin ORCHESTRATOR (briefs,
verification, adjudication); AGY (Google Antigravity CLI) = implementer; codex = reviewer;
owner merges (or grants standing merge-on-green per PR).

## 1. Current state
- main tip: dc4dc60 (after #273). Vercel production deploy of f867d5f is READY -- the deploy
  OOM is FIXED.
- OPEN PR: #274 (docs/LESSONS.md session closeout) -- merge on green; CI-only docs change.
- This session merged #266-#273 to main: Options Paper 14-section restructure (#266) + DRAFT
  finalization (#271) + SSTAC/SABCS framing fix (#273); Guide Phase 2 collapsible (#267);
  PDF print-wrap (#268); Jermilova table reformat (#269); MathRenderer responsive tables
  (#270); Vercel build OOM fix (#272).
- Jermilova PDF+Word delivered + on G:\My Drive\SABCS - Sediment Project\2026 (reformatted
  tables). 15 obsolete worktrees torn down junction-safe (shared node_modules store = 722).

## 2. Owner-only open items (NOT AGY work)
- Visual checks of now-live UI: Phase 2 collapsible section; Download(PDF) print-wrap; webpage
  table styling.
- Options Paper 9.4 governance: confirm the internal body names (the one flagged owner-confirm;
  marked "(Owner to confirm...)" in BC_Matrix_Options_Paper_FINAL_DRAFT.md).
- Optional (codex suggested): align the CI Production-Build job to Node 22 so CI validates the
  real deploy runtime (currently CI runs Node 24, Vercel runs Node 22).
- Manifest: if PR #270 changed the vitest test count from 3291, run
  `npm run docs:manifest:update:vitest` and push to docs/_meta/docs-manifest.json (the #274
  subagent left this as a follow-up).

## 3. AGY autonomy setup (LOAD-BEARING -- read before launching AGY)
- settings.json (~/.gemini/antigravity-cli/settings.json) is read ONCE at session launch; a
  RUNNING agy session never reloads it. After ANY settings change, START A FRESH session.
- Perms (v2, applied): allow command(*), read_file(*), write_file scoped to the two project
  trees; deny list = force/mirror/force-with-lease/--delete push, git reset --hard, git clean,
  git worktree remove, gh pr merge/close/repo/api/workflow/secret/release/run/gist, npm
  ci/install/i/update/publish, all recursive deleters, fsutil, mklink + New-Item link types,
  system-admin (format/shutdown/diskpart/reg/sc/netsh/icacls/takeown/Stop-Process/taskkill),
  Start-Process/Start-Job, scp/sftp/ssh, codex exec, nested agy/claude.
- HEADLESS is the only no-approval, no-plan-gate mode for unattended runs:
  `agy -p "<one-line: read brief, execute>" --add-dir <prepared-worktree> --add-dir C:\projects\sstac-dashboard --print-timeout 170m`
  Prepend `$env:CI='1'; $env:GIT_TERMINAL_PROMPT='0'; $env:GH_PROMPT_DISABLED='1'; $env:GIT_EDITOR='true';`
  Best delivered via a .ps1 launcher (paste-wrap mangles multi-line). NEVER use
  --dangerously-skip-permissions (it bypasses the deny floor).
- ORCHESTRATOR pre-creates the worktree + node_modules junction (PowerShell New-Item -ItemType
  Junction or cmd /c mklink) + copies .env.local, then hands AGY the ready path -- mklink/
  worktree-add are denied for AGY. Briefs -> .tmp_agy_brief_<n>.md; closeouts ->
  .tmp_agy_closeout_<n>.md (blocked -> .tmp_agy_blocked_<n>.md). Orchestrator VERIFIES every
  closeout (greps, never trusts claims).

## 4. Review discipline (/codex-review skill, updated 2026-06-08)
Leg-1 Opus reviewer SUBAGENT adversarial loop ALWAYS FIRST -> Leg-2 codex (Spark grind ->
gpt-5.5 -c model_reasoning_effort=xhigh ship gate); mutual-agreement (argue with evidence).
Three modes (targeted/strategic/holistic). ~5 whack-a-mole codex rounds -> escalate to an
informed Opus holistic. Skip only per the rubric, stated. Memory:
feedback_codex_review_process_discipline_2026_06_08. codex is a single-consumer backend -- do
NOT run codex while an AGY codex loop is active.

## 5. Hard-won caveats this session
- SUBAGENT FLAKE: Sonnet ship-subagents twice went off-script (ran gates/codex instead of just
  commit/push/PR) and left work committed-but-UNPUSHED. Always verify a subagent's claims
  directly; scope ship-subagents to "edit + commit only" and do push/PR/merge yourself.
- VERCEL OOM: push-protocol build runs on GitHub (~16GB); Vercel deploys on 8GB -> our gate
  cannot catch a Vercel OOM. Fix that worked: engines.node "22.x" + eslint.ignoreDuringBuilds
  true, KEEP typescript build check (codex: next typegen != build's .next/types/app guards).
  Fallback if recurs: Vercel Enhanced Builds, NOT disabling typecheck. Verify deploys via
  Vercel MCP (team_VypsUZ6DdXs422cwX8vkw7xi, project "sstac-dashboard"; state READY = good).
- JUNCTION TEARDOWN: guard shared-store dir count before/after each fsutil junction delete;
  ABORT on change; one worktree had a REAL node_modules copy (not a junction) -- guard caught it.

## 6. Pointers
- AGY orchestration detail: AGY_ORCHESTRATION_HANDOFF_2026_06_06.md (repo root).
- Memory: agy_antigravity_cli_usage.md (AGY flags/perms/protocol), dashboard_*_2026_06* lane
  files, feedback_codex_review_process_discipline_2026_06_08.
- Ship gates authority: docs/GATE_MODE_SOP.md; L0/L1 CLAUDE.md.
