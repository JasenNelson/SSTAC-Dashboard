# feat/deferred-triage-20260816 -- deferred-findings triage: print-safety, caption honesty, WebKit markers, plus committed test hardening and uncommitted follow-on fixes

## What this changes

A reader printing pages from this dashboard will notice several things stop clipping.
`ScrollFadeRegion` (the shared scroll-container component) now resets its own overflow and
max-width for print, closing a gap where three separate print-clipping bugs had shown up
in one day across different callers -- EvidenceLibrary tables, a doubled katex-display
margin, and the tab bar -- all from the same root cause: a scroll container that clips on
screen also clips on paper unless every caller remembers to reset it. Moving the fix into
the shared component closes the class for every current and future caller instead of
patching them one at a time.

That systemic fix was still incomplete: three SSD Workbench result containers (model
diagnostics, species aggregates, exclusions) clip on `max-height`, an axis the
ScrollFadeRegion fix did not reset, and none of the three uses ScrollFadeRegion in the
first place -- so a follow-up commit resets `max-height` directly on those three
containers.

The SSD Workbench's reference-check value now carries a "full precision" label rather than
silently showing more significant figures (6) than the headline HCp value next to it (3),
which previously read as though the two numbers disagreed.

Two test-hardening commits, both from an external holistic review, replace weaker
assertions with real ones: a print-fidelity e2e test now measures actual layout under
`emulateMedia({ media: 'print' })` rather than asserting a CSS class is present, and both
of this range's print tests, plus one added by uncommitted work, now assert an "existence
precondition" first -- proving the check could actually have failed -- before asserting the
absence of clipping, closing a vacuous-test pattern the reviewer found.

Beyond the four committed commits, this branch currently also carries uncommitted work
that will be committed before this PR is opened: a print fix on the EvidenceLibrary
cross-pathway audit list (the list itself, and the per-row `{row.substance_label}` that
was still truncating inside it even after the list was de-clipped); two new source-text
guard tests (`printCapSweep.test.ts`, `demotedDocumentTabsDrift.test.ts`); an added
existence-half assertion in the runtime print sweep in `e2e/ssd-workbench.spec.ts`; and a
new document, `docs/PRINT_CLIPPING_BACKLOG_2026_08_16.md`, recording a repo-wide scan that
found the same failure class in other files this branch does not touch.

## Commits

Committed range (`c41f1463..3d03c869`):

| sha | subject |
|---|---|
| 5fbdba3e | fix(ui): deferred-findings triage -- print-safety, caption honesty, WebKit disclosure markers |
| f06a3ad7 | fix(print): reset max-height too -- the SSD result tables still clipped on paper |
| 925c3d6d | fix(ssd): label the reference check as full precision (owner decision D8 = option 3) |
| c65a7994 | test(print): prove the de-clipping by rendering, not by asserting a class name |
| 3d03c869 | test(print): assert the overflow precondition, and sweep every capped data table |

Uncommitted work on top of 3d03c869, staged for a follow-on commit before this PR opens
(from `git status --short` and `git diff --stat` in this worktree):

| Path | Change |
|---|---|
| `src/components/matrix-options/EvidenceLibrary.tsx` | modified, +34/-8: print-reset the cross-pathway audit list container and the per-row substance-label truncation; extracts `MAX_AUDIT_ROWS_SHOWN` so the slice and the "showing first N of M" notice cannot drift apart |
| `e2e/ssd-workbench.spec.ts` | modified, +22/-2: adds an existence-half assertion (`swept.examined`) to the runtime print sweep so it cannot report green having measured zero containers |
| `src/components/__tests__/printCapSweep.test.ts` | new, 124 lines: source-text print-cap class contract for `SsdWorkbench.tsx` and `EvidenceLibrary.tsx` |
| `src/components/__tests__/demotedDocumentTabsDrift.test.ts` | new, 83 lines: drift guard pinning `DEMOTED_DOCUMENT_TABS` membership and cardinality against `demoteLeadingH1()` call sites in `MatrixDashboard.tsx` |
| `docs/PRINT_CLIPPING_BACKLOG_2026_08_16.md` | new, 154 lines: repo-wide scan recording 9 verified-high-severity vertical candidates and 3 horizontal candidates still open outside this branch's scope, plus what the new guards do and do not cover |

## Why it matters

This lane remediates a UI/UX and accessibility audit of a regulatory dashboard. The
recurring defect class here is a correct regulatory value being hidden -- clipped,
truncated, or capped -- rather than corrupted, and every commit and every piece of
uncommitted work in this PR is that class or is testing for it:

- 5fbdba3e and f06a3ad7 fix print-clipping directly: shared-component overflow/max-width
  reset, then a follow-up max-height reset for three SSD result containers the first fix
  could not reach.
- 925c3d6d fixes a related but distinct honesty problem: not clipped content, but a
  reference value displayed at a different precision than the headline value it is meant
  to corroborate, which reads as disagreement where there is none.
- c65a7994 and 3d03c869 hold the class accountable: they replace a class-name assertion
  with a real print-media render, and then add an existence precondition so the test
  cannot pass by measuring nothing.
- The uncommitted EvidenceLibrary fix is the same class again, found by a reviewer after
  the four committed fixes were already reviewed and gated: a `max-h-64 overflow-y-auto`
  list of divs (not a table) rendering `entry.value` and `entry.unit`, which the
  table-scoped runtime sweep could never have caught, and a per-row `truncate` on
  `{row.substance_label}` sitting inside that same list -- fixing the list without the row
  would have fixed how many rows print while still clipping which substance each one is
  about.
- `docs/PRINT_CLIPPING_BACKLOG_2026_08_16.md` documents that the class is larger than this
  branch: a repo-wide scan found 52 un-reset vertical caps and 91 horizontal clips
  (raw counts, not filtered to defects), with 9 vertical and 3 horizontal candidates read
  and confirmed to hold measured values, units, substance identities, or model outputs.
  One of those nine (`MatrixMapRightPanel.tsx:808`, the primary matrix-map measurement
  table) has a fix on a separate stacked branch (`feat/audit-p0-20260816`) that has not
  merged, so the backlog document keeps it listed as open until that PR merges rather than
  crediting this branch for it.

## Gates

Source for E2E: `g5-triage-tip/RESULT.txt` (FROZEN_HEAD
`3d03c8693e45561a9d71d760bbb5ab8ed86da0f6`, matches this branch's committed tip; MODE was
`e2e-only`, so this run did not exercise lint, typecheck, unit, or build).

| Gate | Result | Source |
|---|---|---|
| Lint | NOT YET RUN AT THIS TIP -- fill before publishing | -- |
| Typecheck | NOT YET RUN AT THIS TIP -- fill before publishing | -- |
| Unit | NOT YET RUN AT THIS TIP -- fill before publishing | -- |
| Build | NOT YET RUN AT THIS TIP -- fill before publishing | -- |
| E2E | exit 1: `E2E_SUMMARY=166 passed (4.8m)`, `E2E_FAILED_LINE=2 failed`, `E2E_CHROMIUM_AUTH_REFS=32` | `g5-triage-tip/RESULT.txt` |

Do not describe the triage tip as green on e2e. The e2e run at this exact tip has 2 failed
tests. Both failures are in `e2e/admin-agentic-os.spec.ts`. Per the task evidence supplied
for this PR body, those 2 failures were established as pre-existing (not caused by this
lane) by control runs: the same spec fails identically (2 failed, 8 skipped) on
`feat/section-b-wave0-20260815` at commit `d6d4fa0f`, a branch that contains none of this
lane's work, and again on the triage stack when run under webkit. Neither the triage
commits nor the wave0 commits touch `src/middleware.ts` or the agentic-os auth path. That
control-run finding is stated here as reported; it is not independently re-derived from a
RESULT.txt file in this session, unlike the 166/2/32 figures above, which are read directly
from `g5-triage-tip/RESULT.txt`.

Also note this run's E2E numbers are for the four COMMITTED commits only
(tip `3d03c869`); the uncommitted EvidenceLibrary and test changes described above have not
been through this or any other e2e run.

## Not verified

- Lint, typecheck, unit, and build gates have not been run at this branch's committed tip
  (`3d03c869`) -- the only gate evidence available for this exact tip is e2e-only.
- The 2 e2e failures in `e2e/admin-agentic-os.spec.ts` are asserted here to be pre-existing
  based on control-run evidence supplied for this task, not on a fresh independent
  re-verification in this session.
- None of the uncommitted work (EvidenceLibrary print fixes, the two new source-text guard
  tests, the e2e existence-half addition, or the new backlog document) has been through any
  gate run yet -- lint, typecheck, unit, build, or e2e. It needs a full gate pass once
  committed, before this PR can be called green.
- The two new source-text guard tests (`printCapSweep.test.ts`,
  `demotedDocumentTabsDrift.test.ts`) are, by their own doc comments, source-text checks
  only: they read files and run regular expressions over them. They do not compile,
  render, or measure layout, and are explicitly documented as blind to caps composed
  through `cn()`, template literals, or variables, and blind to the horizontal axis
  (`truncate`, `line-clamp-*`, fixed `h-*`) entirely.
- `docs/PRINT_CLIPPING_BACKLOG_2026_08_16.md` documents 9 verified-high-severity vertical
  candidates and 3 horizontal candidates as OPEN outside this branch's scope; none of those
  is fixed by this PR, and the document itself is a triage record, not a remediation.
- The uncommitted EvidenceLibrary print fix has not been proven under
  `emulateMedia({ media: 'print' })` by a runtime e2e test in this branch -- the runtime
  print sweep in `e2e/ssd-workbench.spec.ts` is documented (in the new
  `printCapSweep.test.ts` comment and the backlog document) as scoped to elements
  containing a `<table>`, and the cross-pathway audit list is a list of divs, so that
  sweep does not reach it.
