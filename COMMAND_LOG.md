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
