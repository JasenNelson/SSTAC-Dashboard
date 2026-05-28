# Phase 4 Implementation Pack -- Index

**Status:** Ready for use. Open this doc first when owner greenlights Stream C (Phase 4).
**Branch policy:** All Phase 4 commits go on `feat/stream-c-equation-dispatch-2026-05-XX`
(use session-start date for XX). Open draft PR after commit 1.
**Last updated:** 2026-05-28.

---

## 1. Purpose

This index exists so the next session greenlit for Phase 4 can open ONE doc, read the
5 prep docs in execution order, and start commit 1 without re-reading everything.

Phase 4 (Week 8) wires a thin dispatch layer on top of the existing four pathway
calculators so that selecting a regulatory frame in the Calculator can eventually route
to a frame-specific equation variant. Week 8 is behaviorally neutral (all frames fall
back to the BC Protocol 1 baseline; the architecture is locked in before any
user-visible value changes). Week 9 adds real variants when owner provides HITL-curated
parameter values and Evidence Library source IDs (Stream D dependency).

---

## 2. Pack manifest

| Order | Doc | Role | Lines | Read priority |
|---|---|---|---|---|
| 1 | docs/STREAM_C_EQUATION_DISPATCH_DESIGN.md | Binding design | 262 | MUST READ FIRST |
| 2 | STREAM_C_DESIGN_PREREVIEW_2026_05_28.md | Adversarial pre-review of design | 349 | Skim for verdict + open Qs |
| 3 | docs/PHASE_4_FRAMEVARIANTS_SHAPE_SPEC.md | frameVariants.ts row shape | 223 | Read before commit 1 |
| 4 | docs/PHASE_4_FRAME_VARIANT_FALLBACK_NOTICE_SPEC.md | FrameVariantFallbackNotice component spec | 403 | Read before commit 1 |
| 5 | docs/PHASE_4_EQUATION_DISPATCH_TEST_PLAN.md | Test plan for dispatch + data table | 462 | Read before commit 1 |

Pre-review verdict: IMPLEMENTATION-READY for Week 8. All three pre-review findings (P1
Jurisdiction type alias, P2 sibling notice pattern, P3 export count) were folded into
the design doc before this pack was assembled.

---

## 3. Commit 1 execution plan

Commit 1 ships the dispatch infrastructure: dispatch module + conditional types + data
table file + notice component + unit tests. All behaviorally neutral (FRAME_VARIANTS
starts empty; every call returns baseline fallback).

Files to CREATE in commit 1:

- `src/lib/matrix-options/equationDispatch.ts`
  -- `getEquation<P>(frameId, pathway)` function; `EquationVariantId` closed union;
  `FrameVariantMapping` interface; `PathwayInput<P>` and `PathwayResult<P>` conditional
  type maps (4 arms, exhaustive); `VARIANT_FUNCTIONS` registry; `validateFrameVariants()`
  runtime integrity checker. All calls return `{variant:'baseline', usedBaselineFallback:true}`.

- `src/lib/matrix-options/frameVariants.ts`
  -- `FrameVariantRow` interface + `FrameVariantOverrides` discriminated union (5-pathway
  tagged union per shape spec section 5); `FRAME_VARIANTS: readonly FrameVariantRow[] = []`.
  Pure TypeScript data module; no JSX, no React.

- `src/components/matrix-options/FrameVariantFallbackNotice.tsx`
  -- Props: `usedBaselineFallback: boolean` (required); `fallbackReason?: string`;
  `className?: string`. Renders null when false. Uses `role="note"` (not "status").
  Muted slate Tailwind classes (see component spec section 3). No `frameId` prop.

- `src/lib/matrix-options/__tests__/equationDispatch.test.ts`
  -- Groups A (~12), B (~8), C (~2), D (~4) = ~26 tests. Groups B/C trivially pass with
  empty table; they become regression guards as variants are added in Week 9. Reuse
  fixtures from `derivations.test.ts` (see test plan section 4).

- `src/components/matrix-options/__tests__/FrameVariantFallbackNotice.test.tsx`
  -- 5 tests: T1 renders null when false; T2 default copy; T3 custom reason; T4
  className; T5 role="note" accessibility.

Files to NOT modify in commit 1:

- `src/lib/matrix-options/derivations.ts` -- do not add frameId param; stays pure.
- The 4 calculator components (wired in commits 2-5).
- Existing calculator test files (commits 2-5 add new assertions there).
- `src/components/matrix-options/RegulatoryFrameNotice.tsx` -- stays unchanged throughout
  Phase 4; FrameVariantFallbackNotice is a sibling, not a modification.

Commit 1 implementation note: author the `PathwayInput<P>` and `PathwayResult<P>`
conditional type maps FIRST and verify they compile before writing the function body.
The 4-arm discriminated union is the highest TypeScript complexity in the commit; a
compile error there blocks everything else.

After commit 1: run codex holistic review on the dispatch surface (type contract) BEFORE
starting commit 2. Per the pre-review recommendation, the generic type surface deserves
its own GREEN before 4 calculator components depend on it.

---

## 4. Commits 2-5 outline

Each commit wires one calculator through `getEquation()` + inserts the
`<FrameVariantFallbackNotice>` sibling + adds new test assertions to that calculator's
test file. Order per design doc section 4.

| Commit | File wired | Pathway id | RegulatoryFrameNotice insertion point |
|---|---|---|---|
| 2 | EcoDirectEqPCalculator.tsx | `eco-direct-eqp` | After line 222 |
| 3 | EcoFoodBSAFCalculator.tsx | `eco-food-bsaf` | After line 333 |
| 4 | HHDirectContactCalculator.tsx | `human-health-direct` | After line 300 |
| 5 | HHFoodWebCalculator.tsx | `human-health-food` | After line 297 |

For each commit:
1. Replace direct `derivations.ts` import with `getEquation()` call (see design doc
   section 3.3 wiring pattern).
2. Add `<FrameVariantFallbackNotice usedBaselineFallback={usedBaselineFallback}
   fallbackReason={fallbackReason} />` immediately after `<RegulatoryFrameNotice>`.
3. Add test assertions: `expect(screen.getByTestId('frame-variant-fallback-notice'))`
   present for non-default frames. Do NOT delete the "uses the selected regulatory frame
   without crashing" loop tests (load-bearing regression guards per
   `cross_project_never_delete_regression_tests_during_cleanup.md`).
4. Note for commits 4-5 (HH calculators): they lack the 6-frame loop test. Add the loop
   as part of the wiring commit for symmetry with EcoDirectEqP + EcoFoodBSAF.
5. Codex targeted iterate-to-GREEN + 4 gates GREEN before push.

End of Week 8: dispatch infrastructure in place; no behavior changes for users; all
frames fall back to baseline; the "Using BC Protocol 1 v5 DRA baseline equation" notice
is visible for non-default frames.

Week 9 commits 6+: per-variant commits. One variant per PR. Each requires owner-
provided HITL parameter values + Stream D `catalog_sources` UUIDs. Each gets codex
targeted iterate-to-GREEN + 4 gates GREEN.

---

## 5. Open questions cross-reference

Owner answers needed BEFORE commit 1:

None that are strictly blocking. The design doc + pre-review together resolve the
key architecture decisions. However, the following affect commit-1 implementation
specifics and should be confirmed at session start:

- **EquationVariantId: closed union vs open string.** Shape spec section 9 Q1. The
  recommendation is closed union. Confirm before declaring the type in
  equationDispatch.ts so the union is declared correctly from the start.

- **background-adjustment dispatch scope.** Test plan section 8 Q3. Design doc excludes
  this pathway from dispatch routing. Confirm: should `getEquation(frameId,
  'background-adjustment')` throw or return an explicit typed error? Affects Group A
  negative test and the dispatch function body.

- **Fallback notice copy wording.** Component spec section 8 Q1. This spec uses "BC
  Protocol 1 v5 DRA baseline equation." Confirm the wording before commit 1 locks it
  into the component copy and test assertions.

- **Print/PDF rendering of fallback notice.** Component spec section 8 Q4. Commit 1
  ships the component; adding `print:hidden` is a one-line change, but the decision
  affects whether the test assertions need a print-mode branch. Confirm preference.

Can defer to Week 9 (variant content phase):

- Design doc OQ2: which frames have real equation differences vs aspirational?
- Design doc OQ3: background-adjustment treatment per frame (frame-invariant assumed).
- Design doc OQ4: site-specific frame treatment (always-baseline assumed).
- Shape spec Q2: deprecated/superseded_by field for variant rows.
- Shape spec Q3: first_added_date field for audit trail.
- Shape spec Q4: markdown support in the note field.
- Shape spec Q5: background-adjustment frame-invariance confirmation.
- Component spec Q2: Evidence Library link in the fallback notice.
- Component spec Q3: dismissible/onboarding pattern.
- Component spec Q5: pathway name in default fallback copy.
- Test plan Q1: integration-level testing scope for Week 8.
- Test plan Q2: frameVariants.test.ts split at Phase 4 close.
- Test plan Q4: site-specific always-baseline enforcement test.

---

## 6. Methodology reminder

- Sonnet subagents for ALL implementation work (per
  `cross_project_sonnet_subagents_opus_codex_review.md`).
- Opus main session orchestrates codex iterate-to-GREEN cycles.
- Codex CLI preferred (xhigh reasoning). If unavailable: Opus adversarial iterative
  loop. Step-3 fallback: `& 'agent.ps1' --print --mode ask --model gpt-5.3-codex-xhigh`
  from PowerShell (not Bash; confirmed 2026-05-18). Append result + disposition to
  `codex_rereview_queue_2026_05_17.md` after any non-codex-CLI fallback.
- Codex holistic checkpoint after commit 1 (type contract review); targeted
  iterate-to-GREEN on commits 2-5 each.
- 4 gates GREEN (lint + unit + build + e2e) before every push. WAIVERED is NOT GREEN.
  Run via `.venv/Scripts/python.exe` equivalent for TS project (npm run lint + vitest
  + next build + playwright).
- Path-scoped staging; never `git add .` or `-A`.
- One variant per PR in Week 9 commits.

---

## 7. Branch policy

Per the two-tier push policy (2026-05-28): code-touching commits go to a feature branch
with a PR; doc-only commits may land directly on origin/main after codex GREEN.

Phase 4 Week 8 feature branch name:

  feat/stream-c-equation-dispatch-2026-05-XX

Use the session-start date for XX. Open a DRAFT PR after commit 1 is pushed. Convert to
ready-for-review after commit 5 passes all gates. Tag or mention PR #187 as a dependency
check in the PR description.

---

## 8. Pre-Phase-4 gates (prerequisites)

Before starting any Phase 4 code:

- [ ] Stream D PR merged to origin/main. Stream D builds the `catalog_sources` and
      `catalog_evidence_items` tables in Supabase. Phase 4 commit 1 dispatch
      infrastructure does NOT require these tables (sourceIds arrays start empty), but
      confirming Stream D merged prevents a future mid-sprint surprise when Week 9
      variant rows need real UUIDs.

- [ ] PR #187 merged to origin/main (Phase 2 security + dark mode closed). Phase 4 is a
      net-new feature lane; it can technically run in parallel with an open PR #187, but
      merging it first gives a clean base and avoids rebase noise if #187 and Phase 4
      both touch the calculator components.

- [ ] Owner has confirmed the commit-1 open questions in Section 5 above (EquationVariantId
      shape; background-adjustment dispatch scope; fallback notice copy wording;
      print/PDF rendering).

- [ ] Codex opt-in mode confirmed for this session (BLOCKING per session-start protocol
      in CLAUDE.md -- do not begin implementation until answered).

---

*Authored 2026-05-28. Plain ASCII only. Read-only pass on all 5 source documents.*
*Source line counts verified: design 262, prereview 349, shape spec 223, component spec 403, test plan 462.*
