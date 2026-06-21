# Overnight autonomous session -- summary for J. Nelson (2026-06-13)

Plain ASCII. Matrix-options lane. Everything below shipped GREEN (6 gates + codex mutual-agreement)
or was explicitly BANKED for your decision (see BANKED_HITL_2026_06_13.md). Read that bank file +
this summary first.

---

## SHIPPED + MERGED to main (in order)

| PR | Title | Merge SHA | What it does |
|----|-------|-----------|--------------|
| #307 | docs: Phase D session closeout | 8ba9efd | 4 LESSONS.md lessons + manifest vitest_test_count refresh (#300-#306 closeout). |
| #308 | feat: multi-receptor scenarios (residential adult) | 4aa7388 | Added a receptor-scenario dimension to the HC PQRA direct-contact frame default; wired the residential ADULT receptor (BW 70.7 / IR_sed 20 / SA 17640, dual-verified vs the PQRA PDF + codex) alongside the toddler default. New contract: receptorScenarioId + completeness gate + fail-closed resolver. |
| #309 | feat: frame-independent receptor/age selector | 8e98347 | FIXES your "i don't see an option to change age" feedback. The receptor/age selector + HC PQRA seeds now appear under EVERY regulatory frame (was: only Canada FCSAP). The frame still governs the equation/policy; the receptor governs the exposure factors. New getReceptorScenarioFrame() provider concept. |
| #310 | test: cover the untested baseline-validation queries | 08bcc87 | 22 tests for src/lib/sqlite/queries/validation.ts (precision/recall/F1 math, SQL clauses, tier mapping) -- it had zero coverage. Test-only. |
| #311 | test: cover siteDataStore edge cases | 7be4830 | 17 tests for the bn-rrm site-data store (addSite upsert, removeSite selection-fallback, setPrimaryFeatureIndex index guards, selectAllSites). Test-only; the store was already well-covered, this fills the remaining edges. |

| #312 | docs(lessons): capture the 2026-06-13 receptor-scenario + verification patterns | 3287487 | 4 reusable LESSONS.md lessons (the receptor-scenario contract, frame-independent provider, dual-verify-then-bank discipline, PDF-extraction-artifact caution). Docs-only. |

main tip after #312 = 3287487. ALL 6 PRs merged; all worktrees cleaned; primary clean + synced.

Every PR: 6 gates GREEN (lint 0 err / tsc 0 / test:ci ~3700 passed, no OOM / monitored build / e2e 138
passed / docs:gate PASS) + codex adversarial loop to GREEN. The CI shard fix (#306) held -- no OOM all
night.

## How to see the age selector now (live after #309)
On the matrix-options Calculator tab, the Human Health Direct Contact calculator shows a "Receptor
scenario" dropdown (Residential toddler / Residential adult) under ANY regulatory frame. Switching it
reseeds BW/IR_sed/SA to that receptor's HC PQRA values; the other factors (EF/ED/AT/AF) are shared.
(Before #309 it only appeared if you first switched the jurisdiction dropdown to "Canada FCSAP".)

## BANKED for your decision (did NOT guess) -- see BANKED_HITL_2026_06_13.md
1. **Worker receptor scenario**: built-ready on the same contract, EXCEPT the worker total-body SA is a
   data-integrity call: the HC PQRA PDF literally prints "1 640" but that is physically impossible
   (< the worker's own hands+arms+legs = 9110; the worker is a 70.7 kg adult). Almost certainly an HC
   typo for 16,640, but that is inference (no erratum found). YOU decide: correct to 16640 (with a
   "HC source typo" note) and I ship the worker scenario, or keep as-printed, or defer. The other 4
   worker values (IR_sed 100, EF 240, ED 35, AF 0.1) are CONFIRMED vs the primary.
2. **python.exe crash** (~23:44): single-process native-extension fault, safe to dismiss. 9 persistent
   python.exe were running (services / other sessions); I did NOT kill them. cleanup-orphans.ps1 if
   they are orphans.

## NEXT autonomous options (no owner gate needed; pick any in the morning or I continue)
- More test-coverage hygiene: src/stores/bn-rrm/siteDataStore.ts gaps (clearSitesByTag,
  getSitesByRegion, batchAssessmentProgress are untested).
- Worker scenario -- as soon as you make the SA call.
- Food-web receptor scenarios (recreational vs subsistence fisher) -- needs your receptor/source choice.

## Standing context (unchanged)
- Inline approval IS the attestation; AI finds+verifies values (dual: subagent primary-PDF read +
  codex), only banks genuine judgment calls. PQRA v4.0 (not DQRAChem) has the operationalized defaults.
- 6-gate push protocol serialized; codex two-tier; push-protocol-complete = merge-safe (your standing
  authorization this session). Junction-safe worktree cleanup throughout (shared store intact at 722).

*Autonomous overnight 2026-06-13. 6 PRs shipped + merged (#307-#312), 1 worker-scenario + 1 data
call banked. Primary checkout clean + synced to 3287487; all worktrees cleaned junction-safe (shared
node_modules store intact at 722 throughout). Session wound down here -- the remaining high-value work
is the BANKED worker scenario (needs your SA decision) + owner-input items (food-web receptors); the
autonomous-safe backlog (test coverage) is largely exhausted, so I stopped rather than ship
diminishing-value PRs at deep context.*
