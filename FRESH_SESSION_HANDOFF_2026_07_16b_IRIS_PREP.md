# FRESH SESSION HANDOFF -- 2026-07-16b (Autonomous run: copper merged, IRIS prepped)

Matrix-Options top-50 completion path. Plain ASCII. VERIFY load-bearing claims against live git/gh.

## 0. Baseline (verify live)
- `origin/main` = **2f85b65** (Merge #667 copper apply; verify `gh api repos/JasenNelson/SSTAC-Dashboard/branches/main --jq .commit.sha`).
- Copper #18 disposal is LIVE on main (6 rows superseded; HC 0.426 sole canonical current_default).

## 1. Merged this run
- **#666** (498b207) -- Stage 2 dispose scripts + rulings docs.
- **#667** (2f85b65) -- copper #18 apply: 6 rows needs_review->superseded (top-level + nested), value/default_status unchanged; guard-test exclusions (DISPOSED_COPPER_IDS). 10/10 CI green incl E2E. codex GREEN (grind + xhigh).

## 2. IRIS #17 apply lane -- PREPPED, STOPPED at owner --apply gate
- Worktree: `C:\Projects\SSTAC-Dashboard-worktrees\iris-apply-2026-07-16` (branch `feat/iris-apply-2026-07-16` off 2f85b65; junctioned; .env.local copied).
- Script `scripts/matrix-options/supersede-iris-17-alternates.mjs` present on main (from #666); dry-run CLEAN = 41 records to dispose, 0 already in target state, no JSON written.
- GUARD-TEST COUPLING: **NONE** (verified on this main): none of the 41 disposed `pv-iris-*` ids appear by-id in any test; all needs_review count/loop assertions filter by non-IRIS sources (P28 / ERDC-BSAF) or specific non-disposed ids (arsenic/PCB leads); frozen-batch test counts only approved rows. -> IRIS apply is JSON-only; test:ci unchanged (expect 5750).

### OWNER COMMAND (run in the IRIS worktree; AI never runs --apply):
```
cd C:\Projects\SSTAC-Dashboard-worktrees\iris-apply-2026-07-16
node scripts/matrix-options/supersede-iris-17-alternates.mjs --reviewer "J. Nelson" --date 2026-07-16 --apply
```
After you run it, AI will: verify the diff (41 rows, top-level + nested -> superseded, 20 canonical
siblings + default_status untouched, no drift), commit ONLY the JSON path-scoped, run full gates
(tsc/lint/test:ci/monitored build; e2e->CI) + /codex-review to GREEN, open the IRIS apply PR, monitor CI.

## 3. Owner-gated / blocked (forbidden without a fresh gate)
- **PCB #15**: BLOCKED pending site congener/Aroclor profile + representative logKow + HC-1.0e-5-vs-IRIS-2.0e-5 HH-default call. Unblocks #13 (D3 re-key), #15 (QP attest), #23 (dl-PCB TEQ full).
- **IOCO #7** publish flip; **T40 #29** admin user + E2E_ADMIN_* secrets; **RLS #27** hardening migration.

## 4. State
- PRs merged this run: #666, #667. PRs open: none (IRIS PR opens after owner --apply).
- Claude-token spend risk for next step (IRIS apply assembly): low-medium (gates + codex on a clean JSON diff).
- AGY delegation opportunity: yes (future dispose/promote scripts; PCB data-request scaffold).
