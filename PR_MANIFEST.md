# PR Manifest -- UI/UX audit remediation run, 2026-08-16

Supersedes the Stage 2 manifest preserved below.

| PR | Branch | Base | CI | Retarget owed | State |
|---|---|---|---|---|---|
| #782 | feat/section-b-wave0-20260815 | main | real | no | open |
| #783 | feat/mo-batch2-20260816 | main | real | no | open |
| #784 | feat/section-b-wavea-20260816 | #783 branch | NONE | YES -> main after #783 merges | open |
| #785 | feat/deferred-triage-20260816 | #784 branch | NONE | YES -> main after #784 merges | open |
| #786 | docs/ui-ux-autonomous-run-20260816 | main | real | no | open |
| #787 | feat/theme-cookie-20260816 | #782 branch | NONE | YES -> main after #782 merges | open |

Gate evidence per PR (every exit code corroborated by a pass COUNT, tree hash proven unchanged
across each suite, `chromium-auth` confirmed present in every e2e log):

| PR | lint | unit | build | e2e |
|---|---|---|---|---|
| #782 | 0 err / 76 warn | 6797 / 356 files | ok | 172 passed / 138 skipped |
| #783 | 0 err / 76 warn | 6804 / 354 files | ok | 160 passed / 138 skipped |
| #784 | 0 err / 76 warn | 6813 / 354 files | ok | 160 passed / 138 skipped |
| #785 | 0 err / 76 warn | 6819 / 358 files | ok | 160 passed / 138 skipped |
| #787 | 0 err / 76 warn | 6843 / 357 files | ok | 187 passed / 138 skipped |

The e2e delta on #782 and #787 is their own new theme tests across three browsers, not drift.
---

## PRIOR RUN, PRESERVED BELOW (do not delete)

# PR Manifest -- Stage 2 run 2026-07-16

Baseline origin/main = c5b32fb. NO auto-merge (owner merges each after gates + codex + CI green).

## PRs this run
| PR | Branch | Unit (row) | Gates | codex | CI | Merge |
|----|--------|------------|-------|-------|----|-------|
| #666 | feat/top50-stage2-2026-07-16 | Stage 2 rulings docs + 2 dry-run apply scripts (no-write) | lint0 / tsc0 / test:ci 5750 / build0; e2e deferred-to-CI (no app surface) | GREEN gpt-5.5 xhigh (after 3 fix rounds) | pending | OWNER (report-ready) |

## Prepped-and-stopped (owner-gated; NOT executed autonomously)
| Item | Artifact | Owner action |
|------|----------|--------------|
| Copper #18 dispose | scripts/matrix-options/promote-copper-hc0426.mjs | review + run --apply; ship JSON + 3 coupled guard-test edits in same PR |
| IRIS #17 supersede | scripts/matrix-options/supersede-iris-17-alternates.mjs | review + run --apply (clean standalone; no test coupling) |
| PCB #15 | (no draft -- ruled REQUEST MORE DATA) | provide site congener/logKow data + HH-default call; then revisit D3 |
