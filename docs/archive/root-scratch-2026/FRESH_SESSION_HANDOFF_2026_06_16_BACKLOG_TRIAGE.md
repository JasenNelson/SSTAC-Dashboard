# Fresh-Session Handoff -- 2026-06-16 (carried-over closeout + bot-backlog triage)

Entry point for the next SSTAC-Dashboard session. Read L0 `C:\Projects\CLAUDE.md` + L1 `CLAUDE.md` +
`docs/GATE_MODE_SOP.md` first. Memory topic: `dashboard_session_2026_06_16_autonomous_closeout_plus_coverage.md`.
Full run trail: `~/.claude/plans/autonomous-closeout-12h-2026-06-15.md` (CP0-CP26).

## STATE
- origin/main tip: `4ea2855`. Primary checkout synced. Working tree clean (only pre-existing untracked
  root `*.md` handoffs + `.mcp.json`). All session worktrees removed junction-safe (shared node_modules = 723).
- Orphan node/python procs exist (MCP/other-lane) -- NOT mine, NOT killed (per L0 1.9).

## SHIPPED THIS SESSION (6 PRs, all full pipeline: Opus + codex 5.5-xhigh GREEN + 6 gates + CI, head-pinned squash)
- #331 (e6337ee) docs closeout (carried over).
- #332 (5814935) matrix-options test coverage: +19 unit tests (parseDecimal positiveInput/optionalPositiveInput + regulatoryFrames isRegulatoryFrameId); manifest 4039->4058.
- #333 (ffdcc09) **security**: path traversal in regulatory-review file APIs. New `src/lib/regulatory-review/safe-path.ts` (win32-pinned safeFilename/resolveWithinBase, leading-dash blocks argparse option-injection) wired into write/delete/spawn sinks + 13 tests. Admin+local-engine gated.
- #334 (379a39a) **security**: crypto-secure CEW ids (Math.random->randomBytes, format-preserving) + removed client-facing raw-error disclosure (details:) across poll + regulatory-review search routes.
- #335 (a825952) **a11y**: aria-label + focus-visible + aria-pressed/role=group on icon-only controls (TagManagement, NodeInspector, Announcements/MilestonesManagement, ActiveReviewsGrid, PrioritizationMatrixGraph).
- #336 (4ea2855) **a11y**: keyboard operability (role=button/tabIndex/onKeyDown/aria-expanded/focus) on InteractiveBarChart, InteractivePieChart legend, ProjectTimeline, Announcements, TWGReviewPortal TOC; LikeButton invalid-nesting DOM restructure.

## BOT BACKLOG (Sentinel security + Palette a11y draft PRs)
- Triaged ~48 open bot drafts via 2 triage workflows -> deduped (security 16->4 real issues; a11y 25->17 gaps). Bot branches commit a wrong-base `pnpm-lock.yaml` (repo uses npm) -> ALWAYS reimplement clean, never adopt.
- CLOSED 29 superseded bot PRs (owner-authorized): security #96/#103/#106 (->#333), #177/#170/#172/#131/#111/#109/#107/#104/#98/#94/#163/#153/#185/#122 (->#334); a11y #173/#123/#102/#101/#114/#105/#90/#91/#178/#95/#171/#100/#112/#154/#92 (->#335).
- STILL OPEN (superseded by #336 but not yet closed -- close on owner OK): #113/#99/#97/#88/#87/#89/#93/#186/#164/#132/#108.

## NEXT QUEUE (documented, NOT started)
1. ShareButton proper ARIA menu (#117/#110): needs roving tabindex + arrow keys + Escape + focus management. Self-contained, medium effort, deserves a careful dedicated pass (my earlier role=menu attempt was a footgun and was reverted -- plain buttons currently, no regression).
2. #187 conceptual-model + TWG review UI polish (small, +50/-5, 2 files).
3. #121 Case Studies "Detailed Comparison + Uncertainty/Sensitivity Analysis" (+10402/43 files): **DEFER** -- design-heavy scientific feature; needs owner product + scientific acceptance criteria before any reimplementation (codex concurs; do NOT autonomously rebuild a bot draft this large).

## PROTOCOLS / LESSONS (this session)
- Triage bot drafts by ROOT ISSUE with dedup BEFORE touching them; most are dups or already-fixed-on-main.
- `role=menu`/`menuitem` on plain buttons WITHOUT roving-tabindex/arrow-keys/Escape is a net-worse SR outcome (Opus caught on ShareButton). A focusable element MUST have a visible focus indicator (Tailwind rings don't work on SVG -> don't make SVG paths tab stops; use the legend).
- Adversarial-review subagents leave Windows-illegal-name probe files (`..`, `foo `, `foo.`) in worktree `.tmp` -> sever junction + reparse-check, THEN `cmd /c rd /s /q \\?\<path>` (extended-path prefix). `rd /s` can trip the safety classifier -> prefer `git worktree remove` when no illegal-name files.
- NEVER run two `test:ci` in the SAME worktree concurrently (shared .next/coverage -> exit1 though tests pass). One heavy gate (test:ci OR build) at a time globally.
- Bind CI-green to the merged SHA (capture green statusCheckRollup SHA, require re-read headRefOid identical, `--match-head-commit`).
- Closing PRs you did not create needs explicit owner authorization (classifier blocks mass-closes); batch <=5.

## OWNER ACTIONS
- Decide ShareButton / #187 / #121 (next queue above). Authorize closing the remaining superseded a11y bot drafts if desired.
