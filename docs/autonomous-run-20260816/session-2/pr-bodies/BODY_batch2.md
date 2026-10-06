# feat/mo-batch2-20260816 -- Matrix Options batch 2 (owner-decided audit items) + a P1 self-fix

## What this changes

A reader of Matrix Options will notice: each tab that renders a markdown document
(Jurisdictional Frameworks, and part 0 of The Guide) now shows only ONE level-1 heading
instead of two -- the app shell's `<h1>` and the document's own `# ` title used to both
render. The header gets working auth links reachable from every surface, not just some.
The candidate-defaults review flow is reachable from more places. Padding is corrected on
one or more surfaces. Two touch targets that were below the project's 44px floor are back
at 44px. On paper (print), the four demoted documents (Jurisdictional Frameworks and The
Guide) now print with a level-1 heading again -- the demotion that fixed the on-screen
duplicate heading had also removed the only `<h1>` a printed page of these documents had,
because the app shell's `<h1>` lives inside a print-hidden toolbar.

Also fixed in this range: a stale-state bug in the candidate-review receipt. Lifting a
timestamp from `CalculatorValueSearchPanel` up to `MatrixDashboard` (so the receipt would
survive a substance change) removed an unmount that used to reset it, so a bare timestamp
could keep claiming a specific candidate count was reviewed after the substance under
review had changed. That claim is on screen, so a wrong one is a P1, not a P2.

## Commits

| sha | subject |
|---|---|
| 7885c564 | feat(ui): batch 2 -- duplicate H1, header auth links, candidate-defaults reach, padding |
| 6612fe6b | fix(matrix-options): receipt cannot outlive its context; restore 44px targets; scope the hook |
| f0f56330 | fix(print): restore a level-1 heading on paper, scoped to the demoted tabs only |

## Why it matters

This lane remediates a UI/UX and accessibility audit of a regulatory dashboard. The
recurring defect class in this lane is a correct regulatory value being hidden (clipped,
truncated, capped, or in this case simply removed from the printed page) rather than
corrupted. Commit f0f56330 is an instance of that class: after 7885c564 demoted the
in-document `# ` heading to fix an on-screen duplicate, the four demoted documents printed
with zero level-1 headings, because the app shell's own `<h1>` sits inside a
`print:hidden` toolbar. The document's title still printed (as an h2), so this is
degradation, not loss of the underlying text -- the commit message for f0f56330 records
this as P2, not P1, for that reason.

The 6612fe6b fix is a different kind of correctness bug: a stale on-screen claim ("N
candidates opened for review at TIME") that could describe the wrong substance's candidate
count after a substance change, because MatrixDashboard stays mounted across substance
changes while the component that used to own that state did not. Per the commit message,
no unit test caught the print-heading loss because jsdom implements no print medium; no
per-branch review caught it either because the demote landed in batch 2 while the
print-behaviour review in this stack was scoped to the deferred-triage lane.

## Gates

GATE EVIDENCE: NOT YET RUN AT THIS TIP -- fill before publishing

No RESULT.txt exists for branch tip f0f56330 in the gate-evidence scratchpad
(`g5-wavea-tip`, `g5-p0-pre`, and `g5-triage-tip` cover the waveA, a stacked P0 branch, and
the triage tip respectively -- none of them is this branch or this commit). Lint,
typecheck, unit, build, and e2e results for this tip have not been captured and must not
be assumed from any other branch's numbers.

| Gate | Result |
|---|---|
| Lint | NOT YET RUN AT THIS TIP |
| Typecheck | NOT YET RUN AT THIS TIP |
| Unit | NOT YET RUN AT THIS TIP |
| Build | NOT YET RUN AT THIS TIP |
| E2E | NOT YET RUN AT THIS TIP |

## Not verified

- No gate run (lint, typecheck, unit, build, or e2e) exists for this branch's tip
  (f0f56330). All four npm-script gates and the Playwright suite need to be run against
  this exact commit before this PR can be called green.
- The print-heading fix in f0f56330 is not covered by any e2e or unit assertion in this
  range that renders under `emulateMedia({ media: 'print' })` and checks for an `<h1>` --
  the commit message states the intended behaviour but this range does not add a runtime
  print test for it (that pattern is introduced later, in the triage lane, for a different
  container).
- The receipt-staleness fix in 6612fe6b is described in the commit message as reviewed and
  scoped to a hook, but no gate evidence in this range independently confirms the fix
  under CI conditions.
