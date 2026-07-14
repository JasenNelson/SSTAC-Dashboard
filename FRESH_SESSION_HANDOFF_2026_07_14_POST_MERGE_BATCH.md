# FRESH SESSION HANDOFF -- 2026-07-14 post-merge batch

Primary resume anchor for the next SSTAC-Dashboard session. Plain ASCII only. Verify every
load-bearing claim below against live state before trusting it (git + gh), per AGENTS.md startup
checklist -- this handoff records what was true when written.

## 0. Baseline (VERIFY LIVE FIRST)
- `origin/main` = **f7d1976** (after this run's #647 + #646 merges). Verify:
  `gh api repos/JasenNelson/SSTAC-Dashboard/branches/main --jq '.commit.sha'`.
- PRIMARY checkout `C:\Projects\sstac-dashboard` is STALE (was ~237 behind) + dirty with pre-existing
  config/skill edits. DO NOT reset/clean/restore/fast-forward it during a run; branch new work from
  `origin/main` in a fresh worktree (AGENTS.md worktree rules).
- Branch new worktrees from the CURRENT `origin/main` tip, not a stale SHA.

## 1. What shipped 2026-07-14 (two batches)
Morning batch (merged): #641-#645 -> `origin/main` a3d9110.
- #641 T40 admin-tier E2E scaffolding (skip-safe); #642 DRA publish read-back + IOCO investigation;
  #643 sodium design + PCB migration evidence packets; #644 opt-in ADAF-adjusted BaP-eq helper
  (non-default, single-bin); #645 DRA coord dry-run diagnostics + candidate-1 blocker packet.

Afternoon batch (merged this run): #647 then #646 -> `origin/main` **f7d1976**.
- #647 `docs/top50-refresh-2026-07-14`: whole-project Top-50 priority tasks refreshed to 2026-07-14
  (`docs/SSTAC_TOP50_PRIORITY_TASKS_2026_07_14.md`). Docs-only.
- #646 `feat/pcb-rekey-dryrun-2026-07-14`: PCB re-key DRY-RUN plan
  (`docs/MATRIX_OPTIONS_PCB_REKEY_DRYRUN_PLAN_2026_07_14.md`) + fixture-only resolver test
  (`src/lib/matrix-options/provenance/__tests__/pcbRekeyDryrun.test.ts`). NON-APPLIED; no catalog
  mutation. codex-GREEN (xhigh; one P2 caught + fixed: fixture must include the `pv-pcb-hh-direct-rfd`
  current_default scaffold, 2.0e-5, which wins the direct-RfD resolution -- NOT IRIS). All 4 gates GREEN.

## 2. Open PRs at handoff time
- This handoff is itself a small docs-only PR (branch `docs/handoff-2026-07-14-postmerge`). Any
  autonomous-run PRs opened after it are listed in
  `.tmp/autonomous-2026-07-14-postmerge/PR_MANIFEST.md` (gitignored scratch). Re-verify with
  `gh pr list --state open`.

## 3. Remaining owner gates (batched; paste-ready approval lines)
Nothing below is auto-doable; each needs an explicit owner decision. Priority order per the Top-50.
Every production write still requires exact-operation review + the id-keyed fail-closed pattern.

1. IOCO Shoreline publish (DRA `ea15e94a`). In-app admin-JWT publish; #642 read-back now surfaces
   any non-persist. Approve:
   `Publish IOCO Shoreline (ea15e94a) in-app as admin; confirm read-back shows public=true + member samples 34->40.`
2. IOCO admin-JWT publish-retry blocker (distinct from the publish-policy decision). Owner in-app retry.
3. Catalog D2 benzo_a_pyrene anchor-source ruling (sf_oral HC1.289 vs IRIS2.0 vs adult1.0). Owner tox
   judgment. Approve one anchor; default flip stays blocked until ADAF wiring proven.
4. Catalog D3 PCB Option A/B/C ruling. Approve:
   `PCB D3: choose Option A-migrate / B-split / C-defer.`
5. PCB re-key site-congener QP protectiveness check (now scoped by #646): resolve the RfD-food
   duplicate merge-vs-coexist (`pv-p28-pcb-hh-food-rfd`) + FCV duplicate before any re-key.
6. DRA coordinate extraction (Howe Sound candidate-1): attended, page-range-bounded docling-OCR
   session (1234pg AES-encrypted, coord table on image pages). Owner-run/attended.
7. T40 admin-tier activation: owner creates an admin test user + sets `E2E_ADMIN_EMAIL`/`_PASSWORD`
   (`E2E_AUTH_ENABLED` already true). Then #641 admin specs activate. Never inspect/print secrets.
8. Sodium route-specific default: satisfied-by-existing-machinery (both bases + no-default already
   render); no action unless owner wants a lock-in regression test.

## 4. Working posture (owner-reinforced)
- Autonomous Multi-Hour when requested: one launch approval covers the full run; do NOT downshift to
  micro-prompts. AGY-as-default for mechanical work (tests/scripts/fixtures/docs/inventories);
  Claude = orchestration + judgment + verification + owner-facing decisions. Max 3 background agents.
- Gates: lint -> test:ci -> `npm run build:monitored:clean -- -TimeoutSeconds 360 -PollSeconds 10`
  -> e2e. Never raw `npm run build`. Targeted codex per code diff; holistic before final closeout.
- Merge authority: agents never `gh pr merge` EXCEPT under explicit, specific, in-session owner
  authorization naming exact PR numbers (AGENTS.md default overridden only for those PRs).
- Supabase: read/verify via project-scoped MCP; writes only under exact owner-approved operation
  (AGENTS.md Supabase Protocol). DRA visibility via audited app/RPC path.

## 5. Process / worktree state (RECOMMENDATIONS ONLY -- no cleanup performed; owner-gated)
- Worktrees created 2026-07-14 (junction node_modules -- recursive removal is a JUNCTION HAZARD;
  remove junction first, verify shared store untouched, per L0 1.15): `gate0-readonly-2026-07-14`
  (detached, no junction), `b3-pcb-rekey-2026-07-14`, `top50-refresh-2026-07-14`,
  `handoff-2026-07-14pm`, plus this run's lane worktrees. ~60 worktrees + pre-existing orphans exist.
- Check owned processes before exit: `Get-Process node, python`. Do not kill by image name.

## 6. Claude-token spend risk for next step: low. AGY delegation opportunity: yes.
