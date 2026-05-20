# Regression Watch -- features that MUST NOT be silently removed

Central registry of UI features in this repo that have been silently regressed
in past cleanup passes. Each entry below is a LOAD-BEARING feature with
regression tests + a documented restoration history.

When a PR touches one of these surfaces -- including for lint / test / codex
cleanup -- the reviewer must verify the feature still works and the regression
tests still exist. If a regression test starts failing, **FIX the test**
(update prop name / import / selector); **DO NOT delete** the test.

Standing rule that this registry exists to enforce:
`cross_project_never_delete_regression_tests_during_cleanup.md` (HIGH AUTHORITY).

Plain ASCII only.

---

## Active entries

### 1. Jermilova review portal -- panel-collapse toggle controls

- **Feature:** the TOC (left) + Comments (right) side panels in
  `JermilovaReviewPortal` can be collapsed and reopened by the user via
  in-header collapse buttons + floating reopen handles. Props
  `initialShowLeftPanel` / `initialShowRightPanel` seed the FIRST render only;
  the portal owns live state thereafter.
- **Accessibility:** `aria-expanded` + `aria-controls` on all four toggle
  controls (collapse buttons + reopen handles), referencing stable panel
  ids `twg-toc-panel` / `twg-comments-panel`. Collapsed panels get
  `aria-hidden="true"` + the `inert` attribute. Focus handoff between
  collapse button + reopen handle (WCAG 2.4.3 visible-focus).
- **Where it ships:**
  - `src/components/document-reviews/JermilovaReviewPortal.tsx`
  - Mounted at `/bn-rrm/jermilova-review` (standalone) and inside
    `src/components/bn-rrm/casestudies/AiAssistedDevelopmentView.tsx`
    under Case Studies > AI-assisted BN-RRM development > TWG Review tier.
- **Regression tests** (all in
  `src/components/document-reviews/__tests__/JermilovaReviewPortal.test.tsx`,
  prefix `REGRESSION:`):
  1. `REGRESSION: renders both panels open by default with collapse buttons visible (no reopen handles)`
  2. `REGRESSION: TOC collapse hides the panel and shows the floating reopen handle`
  3. `REGRESSION: TOC reopen restores the panel from the floating reopen handle`
  4. `REGRESSION: Comments collapse hides the panel and shows the floating reopen handle`
  5. `REGRESSION: TOC collapse moves focus to the floating reopen handle (WCAG 2.4.3)`
  6. `REGRESSION: TOC reopen moves focus back to the in-header collapse button`
  7. `REGRESSION: initialShowRightPanel=false starts Comments collapsed (reopen handle visible, panel inert)`
- **History:**
  - 2026-05-17 -- feature implemented in commits `b81c4ad` + `84a1abb`
    on `feat/jermilova-detailed-comparison-and-us` / `fix/twg-review-fullwidth-layout`.
  - 2026-05-20 -- owner discovered the feature was missing on `main`.
    Investigation found BOTH the feature AND its 7 regression tests had
    been silently wiped (lint / test / codex cleanup pass; never
    documented). Initial PR #138 cherry-picked only the toggle controls
    (`b81c4ad` + `84a1abb`) but missed the companion full-width layout
    fix (`e859617` + `d5cda3c`). Owner tested the partial restoration
    and discovered the screen locked on first collapse click -- the
    ancestor `max-w-4xl mx-auto` cap in CaseStudiesView squashed the
    layout when a panel collapsed. PR-#138 superseded by a comprehensive
    PR that cherry-picks all 4 companion commits + adds `REGRESSION:`
    prefix + this registry + standing rule
    `cross_project_never_delete_regression_tests_during_cleanup.md`.
  - **Lesson** -- the panel-collapse feature has TWO companion fixes
    that must travel together: (1) the toggle controls (`b81c4ad` +
    `84a1abb`) and (2) the tier-aware full-width layout breakout
    (`e859617` + `d5cda3c`). Restoring only (1) without (2) leaves
    the layout in a state where the central column locks at first
    collapse. Future restorations MUST include both halves.

---

## Adding a new entry

When a feature has been regressed at least once and you have restored it:

1. Confirm the feature has regression tests (or write them now).
2. Add the `REGRESSION:` prefix to each test name.
3. Add a top-of-file warning comment in the component AND its test file
   citing this registry + the standing rule.
4. Add a new section to this file following the template above. Include:
   - Feature description (one paragraph)
   - Accessibility / contract requirements (if any)
   - Where it ships (file paths + routes)
   - List of regression test names (verbatim)
   - History (date + commits + how it was regressed + restoration PR)

## How reviewers use this file

When reviewing a PR that touches a file referenced in the "Where it ships"
section of an entry below, check:

- The regression tests with the `REGRESSION:` prefix are still present.
- The PR does not weaken the accessibility contract documented for the
  feature.
- If the PR proposes to delete a regression test: STOP. Read the entry
  here + read the standing rule
  `cross_project_never_delete_regression_tests_during_cleanup.md`. If the
  test is failing, the fix is to update the test, not delete it. If the
  feature is genuinely being retired, the deletion belongs in a focused
  PR with the feature removal, not in a cleanup PR.
