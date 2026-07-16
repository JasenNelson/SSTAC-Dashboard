# PR Manifest -- Stage 2 run 2026-07-16

Baseline origin/main = c5b32fb. NO auto-merge (owner merges each after gates + codex + CI green).

## PRs this run
| PR | Branch | Unit (row) | Gates | codex | CI | Merge |
|----|--------|------------|-------|-------|----|-------|
| (pending) | feat/top50-stage2-2026-07-16 | Stage 2 rulings docs + 2 dry-run apply scripts (no-write) | (running) | grind found 3 fail-closed items -> fixing -> re-gate | pending | OWNER (report-ready) |

## Prepped-and-stopped (owner-gated; NOT executed autonomously)
| Item | Artifact | Owner action |
|------|----------|--------------|
| Copper #18 dispose | scripts/matrix-options/promote-copper-hc0426.mjs | review + run --apply; ship JSON + 3 coupled guard-test edits in same PR |
| IRIS #17 supersede | scripts/matrix-options/supersede-iris-17-alternates.mjs | review + run --apply (clean standalone; no test coupling) |
| PCB #15 | (no draft -- ruled REQUEST MORE DATA) | provide site congener/logKow data + HH-default call; then revisit D3 |
