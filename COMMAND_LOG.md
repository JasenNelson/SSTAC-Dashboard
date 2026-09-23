# COMMAND_LOG -- Matrix-Options top-50 autonomous run

Key owner-gated + gate commands (chronological). Orchestrator-run unless marked OWNER.

## Copper #18 (merged #666 prep / #667 apply)
- OWNER: node scripts/matrix-options/promote-copper-hc0426.mjs --reviewer "J. Nelson" --date 2026-07-16 --apply
- gates: lint0 / tsc0 / test:ci 5750 / build0; codex GREEN (grind+xhigh). merge #667 -> 2f85b65.

## IRIS #17 (merged #668)
- OWNER: node scripts/matrix-options/supersede-iris-17-alternates.mjs --reviewer "J. Nelson" --date 2026-07-16 --apply
- codex xhigh caught RfC source-mislabel P2 -> fixed source-neutral. gates green. merge #668 -> c21ab08.

## PCB HH-default (in flight)
- OWNER: node scripts/matrix-options/promote-pcb-hc-nondioxin-default.mjs --reviewer "J. Nelson" --date 2026-07-17 --apply
- OWNER/codex applied docs/apply-drafts/PCB_HH_DEFAULT_COUPLED_EDITS_2026-07-16.patch
- orchestrator: verify diff (5 files, HC->current_default, scaffolds->superseded, lib 1e-5); lint0/tsc0;
  test:ci 2-failed (coupled ripple: defaultSelectionPolicy.test + HHFoodWebCalculator.test) -> fixing.
- pending: monitored build; test:e2e; /codex-review; commit; push; PR; CI monitor.

## Standing gate recipes
- build: npm run build:monitored:clean -- -TimeoutSeconds 360 -PollSeconds 10
- test:ci: npm run test:ci  (CI vitest coverage)
- codex: PYTHONDONTWRITEBYTECODE=1 timeout 590 codex review [--base origin/main | -] -c model_reasoning_effort=xhigh
  (grind first: -c model="gpt-5.3-codex-spark"; --base cannot combine with a stdin prompt)
- CI poll: gh api repos/JasenNelson/SSTAC-Dashboard/commits/<sha>/check-runs (REST; gh pr view hits GraphQL proxy)
- required checks (branch protection): Lint & TypeScript Check, Unit Tests, Production Build, E2E Tests.
  Vercel status is NON-required (ignore its failure for catalog/docs PRs).

---

# COMMAND_LOG -- UI/UX audit remediation autonomous run, 2026-08-16

The Matrix-Options section above is PRIOR-RUN HISTORY and is preserved deliberately. An earlier
version of this commit REPLACED that section with a stub, which would have destroyed the record
of owner-run promote commands for copper, IRIS and PCB catalog changes. Caught by adversarial
review before merge. Append to this file; never overwrite it.

## Gate recipe used throughout (unchanged from the recipes above)
- gates: lint -> tsc -> test:ci -> build:monitored:clean -> e2e, each redirected to a log file.
  NEVER piped through `tail`: in a pipeline `$?` is tail's exit status, which reports success
  while a gate fails in the same log.
- e2e REQUIRES `E2E_AUTH_ENABLED=true`. Without it the authenticated Playwright project silently
  runs ZERO tests and still reports green. Every run was corroborated by grepping the log for
  `chromium-auth` (expect ~25 refs) before any pass count was quoted.
- every gate exit code was corroborated against a pass COUNT, and the tree hash was captured
  before and after each suite to prove the tree did not move mid-run.

## Branches and PRs opened (all awaiting owner merge; the agent merges nothing)
- #782 feat/section-b-wave0-20260815 (base main)      B14 44px toggle; B11 pre-paint theme bootstrap
- #783 feat/mo-batch2-20260816 (base main)            batch 2, five owner-decided items
- #784 feat/section-b-wavea-20260816 (base #783)      Section B Wave A; owner decision D7
- #785 feat/deferred-triage-20260816 (base #784)      deferred triage; owner decision D8
- #786 docs/ui-ux-autonomous-run-20260816 (base main) this documentation
- #787 feat/theme-cookie-20260816 (base #782)         owner decision D2, cookie-resolved theme

## Owner-gated actions in this run
- No catalog, regulatory value, unit or rounding rule was changed by this run.
- No Supabase read or write was performed.
- Owner decisions D1-D11 were returned as a printed PDF of the decision artifact and are
  recorded in docs/UI_UX_OWNER_DECISIONS_2026_08_16.md.

## Verification commands worth reusing
- static-route cost, measured before and after on the same codebase:
  `npm run build:monitored:clean` then count `.next/prerender-manifest.json` routes.
  Result: 16 prerendered entries before the cookie change, 0 after.
- merge-method conflict simulation without touching any ref:
  `git merge-tree --write-tree <a> <b>` for the merge-commit path; `git commit-tree` to synthesise
  a squashed or rebased main, then `git merge-tree` against the child branch.
