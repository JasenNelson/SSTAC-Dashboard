# Fresh-session handoff -- SSTAC-Dashboard matrix-options lane -- 2026-06-13

Plain ASCII. Single anchor for the next session in this lane. Read L0 (C:\Projects\CLAUDE.md) +
SSTAC-Dashboard\CLAUDE.md + docs/GATE_MODE_SOP.md first. Owner: J. Nelson.
Companion docs (read both): OVERNIGHT_SESSION_SUMMARY_2026_06_13.md (full PR list) +
BANKED_HITL_2026_06_13.md (decisions + the runaway-python flag).
Supersedes FRESH_SESSION_HANDOFF_2026_06_12_MATRIX_OPTIONS.md.

---

## 0. VERIFY STATE FIRST (state drifts; owner runs parallel sessions -- L0 1.6)
```
git fetch origin
git log --oneline -8 origin/main   # expect tip 3287487 (#312), then 7be4830 (#311), 08bcc87 (#310),
                                   # 8e98347 (#309), 4aa7388 (#308), 8ba9efd (#307)
gh pr list --state merged --limit 6   # expect #307-#312 MERGED 2026-06-12/13
git status --short                 # primary clean of tracked changes, synced to 3287487
```
If origin/main tip != 3287487, a parallel session shipped past this -- reconcile before proceeding.

## 1. CHECK FIRST -- runaway python (process safety)
Per BANKED_HITL_2026_06_13.md section 0: a python PID 9540 was using ~14.5 GB (started 05:34). Likely
a parallel session's process, NOT this lane's. Inspect (`Get-Process -Id 9540 | Format-List *`) and
Stop-Process if it is an orphan. There was an earlier python.exe crash dialog -- watch RAM.

## 2. WHAT SHIPPED (all merged to origin/main, 6-gate GREEN + codex)
- #307 (8ba9efd) Phase D docs closeout (4 lessons + manifest refresh).
- #308 (4aa7388) Multi-receptor scenarios -- residential ADULT wired (dual-verified). New contract:
  receptorScenarioId + completeness gate + fail-closed resolver in frameDefaults.ts.
- #309 (8e98347) Frame-independent receptor/age selector (fixes owner "can't change age"): the
  receptor picker + HC PQRA seeds now show under EVERY frame via getReceptorScenarioFrame().
- #310 (08bcc87) Tests: src/lib/sqlite/queries/validation.ts (was untested).
- #311 (7be4830) Tests: siteDataStore edge cases.
- #312 (3287487) LESSONS.md: 4 reusable patterns (receptor-scenario contract, frame-independent
  provider, dual-verify-then-bank, PDF-extraction-artifact caution).

## 3. QUEUED / OWNER-GATED (next-session work)
1. **WORKER receptor scenario -- DO THIS FIRST once the owner decides the SA value.** Built-ready on
   the #308/#309 contract. BLOCKED only on a data-integrity call (BANKED_HITL section 1): HC PQRA v4.0
   Appendix E PRINTS worker total-body SA = "1 640", but that is physically impossible (< the worker's
   own hands+arms+legs = 9110; worker is a 70.7 kg adult) -- almost certainly an HC typo for 16,640,
   but no erratum. Owner decides: (A) correct to 16640 (note the source typo) -> then ship the worker
   scenario; (B) keep 1640 (do NOT ship -- known-bad); (C) defer pending Richardson 1997.
   The other 4 worker seeds CONFIRMED vs primary: IR_sed 100, EF 240, ED 35, AF 0.1; BW-adult 70.7 +
   AT-cancer 80 already approved (#308). On an (A) decision: add the worker FRAME_DEFAULT_PROFILES row
   (3rd scenario), promote the 5 worker records via a promote-hc-pqra-worker.mjs (mirror
   promote-hc-pqra-adult.mjs), wire (the selector auto-shows once >=2 selectable), update library.test
   counts, gate + codex + ship.
2. **Food-web receptor scenarios** (recreational vs subsistence fisher) -- the same contract extends to
   HHFoodWebCalculator; needs owner's receptor choice + IR_food/BW sources.
3. **Per-region dermal SA** (hands/arms/legs/feet) -- new catalog rows from Appendix E region splits.

## 4. HOUSEKEEPING FOLLOW-UPS (low-priority)
- docs/_meta/docs-manifest.json facts.testing.vitest_test_count is STALE (3618; actual on 3287487 is
  3719 per #312's test:ci). Refresh via the #307 pattern (hand-edit + facts_history snapshot) in a
  future docs closeout.
- Workspace .tmp_ scratch from prior/AGY sessions lingers in the repo root (.tmp_agy_*, .tmp_phaseD_*,
  .tmp_cbc_*, .tmp_zotero_inventory/). All gitignored. SAFE to clear EXCEPT .tmp_collision_backup/
  (a referenced backup of removed work from the #303 ff-pull collision). Owner-confirm before deleting.

## 5. STANDING DIRECTIVES (HIGH AUTHORITY)
- Inline approval IS the attestation; AI finds + DUAL-verifies values (primary-source subagent read +
  codex), applies when clean, BANKS genuine judgment calls (source-vs-reality conflicts). PQRA v4.0
  (not DQRAChem) has the operationalized defaults.
- 6-gate push protocol serialized; codex two-tier; push-protocol-complete = merge-safe; junction-safe
  worktree cleanup (junction-delete-first, verify shared store ~722, never batch-remove).
- Avoid python/pypdf-heavy subagents (a python crashed this session; pypdf can segfault + balloon RAM).

## 6. KEY FILES
- src/lib/matrix-options/frameDefaults.ts -- the scenario contract: receptorScenarioId, getFrameScenarios,
  getSelectableFrameScenarios (completeness gate), getActiveScenarioFrameDefaults (fail-closed),
  getReceptorScenarioFrame (frame-independent provider), FRAME_DEFAULT_PROFILES (toddler+adult rows).
- src/components/matrix-options/HHDirectContactCalculator.tsx -- the selector wiring (receptorFrame).
- scripts/matrix-options/promote-hc-pqra-{direct,adult}.mjs -- promotion-helper templates.
- src/lib/matrix-options/provenance/__tests__/library.test.ts -- audit-count guard.
- Memory: dashboard_phase_d_hc_pqra_direct_contact_2026_06_11.md (the lane record, #300-#309).

*Handoff authored 2026-06-13 ~07:40. main = 3287487; 6 PRs merged; primary clean + synced; all
worktrees cleaned. NEXT first task: the runaway-python check + the WORKER scenario once the SA call is made.*
