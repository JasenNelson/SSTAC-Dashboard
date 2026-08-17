# Print-clipping backlog -- repo-wide scan, 2026-08-16

Status: OPEN. TWO containers are fixed in the branch that carries this document. A third was
previously described here as "fixed in a stacked PR that has not merged"; that is WITHDRAWN --
`MatrixMapRightPanel.tsx:808` was never a print defect, because its host tab is `print:hidden`.
See "Correction: this scan never checked host printability" and the "Withdrawn" section. Nothing
is pending merge FOR THAT ROW specifically -- the two containers listed under "Fixed" are fixed on
this lane's branches and are unmerged like the rest of the lane. Everything else here is recorded
and NOT fixed, and the severity ranking of the remaining candidates is PROVISIONAL until each
one's ancestor chain is re-checked. Owner decision needed on scope and priority.
Raised by: adversarial review of the deferred-triage print-safety work (PR for
`feat/deferred-triage-20260816`).

## Why this file exists

The print-safety commits on this lane fixed the containers they knew about, and a reviewer then
found one they did not: `EvidenceLibrary.tsx` rendered the cross-pathway audit list inside
`max-h-64 overflow-y-auto` with no print reset, around rows printing `entry.value` and
`entry.unit`. The runtime print sweep in `e2e/ssd-workbench.spec.ts` could not have caught it,
because that sweep is deliberately scoped to elements containing a `<table>` and this is a list
of divs.

That prompted a repo-wide scan. The scan says the problem is materially larger than this lane,
and the honest thing is to say so in writing rather than let two green PRs imply the class is
closed. This document is that statement. Nothing here is fixed except the containers named under
"Fixed" below.

The scan has since been shown to have a METHOD GAP of its own -- it never checked whether a
capped container reaches paper at all -- which turned its highest-ranked entry into a
non-defect. That correction is below and it applies to how every remaining entry should be read.

## The failure class, restated

A `max-h-*` container has a scrollbar on screen, so nothing is lost. On paper it has no
scrollbar, no fade and no ellipsis: the content stops, and a truncated list of toxicity values
reads as a complete one. `truncate` and `line-clamp-*` do the same thing horizontally, replacing
the tail of a substance name or citation with an ellipsis that a reader has no way to expand.

Unit tests cannot see any of it. jsdom has no layout engine, and `toBeVisible()` does not model
overflow. This is the same class as the five defects recorded on 2026-08-15 in which a correct
regulatory value was hidden rather than corrupted.

## Scan method (reproducible)

Walked every non-test `.tsx` under `src/`, flagging:

- vertical: any `max-h-<size>` or `max-h-[...]` on a line with no `print:max-h-none`;
- horizontal: any `truncate` or `line-clamp-<n>`.

The scan has been corrected TWICE after a reviewer falsified it, and both corrections are part
of the method rather than footnotes to it.

COMMENTS ARE EXCLUDED, BLOCK-AWARE. The first version recognised a comment only by its FIRST
line, which misses continuation lines. That was falsified by this document's own branch: a code
comment written ABOUT the word `truncate` had a continuation line beginning with a backtick, and
it was counted -- so a doc comment inflated the exact figure whose stated purpose was to be
immune to doc comments. The scan now tracks `/* */` and `{/* */}` state across lines AND
still skips whole-line `//`, `*` and `<!--` comments. Both clauses are load-bearing: four `//`
lines in `MatrixDashboard.tsx` mention `max-h-`, so implementing only the block-state clause
reproduces 52 vertical lines rather than 49.

One more rule the vertical scan applies, stated because omitting it changes the answer: a line
whose ONLY `max-h-` token is `max-h-none` is not a capped container and is discarded. Exactly one
line in `src/` is in that position, which is why the four comment lines above produce a delta of
three rather than four. A reproducer that skips this rule lands on 53, not 52.

HORIZONTAL HITS REQUIRE A CLASS CONTEXT. `truncate` is also an ordinary identifier:
`src/components/engine-v2/TelemetrySidebar.tsx` declares `function truncate(value, length)` and
calls it twice. Those are not Tailwind classes and are not clipping risks. A horizontal hit now
counts only on a line that also carries `className=`, `class=` or `cn(`.

KNOWN LIMIT, stated because this section's whole job is to produce a number someone else can
reproduce: a class list composed across MULTIPLE lines inside `cn(...)` is counted only on the
lines carrying the token, so a horizontal token on a continuation line of such a call is missed.
A reviewer independently counted 85 horizontal lines against this scan's 84; that one-line
difference is this limit, not a drift.

These are LINE counts -- lines carrying at least one match -- not token counts and not container
counts. The vertical TOKEN count is 52, higher than the 49 lines because three lines carry two
cap tokens each, and all three are ternary pairs (`isFocused ? 'max-h-[68vh]' : 'max-h-[42vh]'`)
-- two mutually exclusive states of ONE container, which a token count double-counts. An earlier
draft of this paragraph labelled the table "Occurrences"; a reader reproducing that would have
landed on a different number and concluded the document had drifted.

Earlier drafts of this section reported 52 vertical lines and 91 horizontal lines. Those figures
came from the weaker rules above and should not be reconciled against these -- the method
changed, not the tree.

Counts measured on tip `3d03c869` plus this lane's then-uncommitted work. Part of that work has
since been committed as `87b8d2c8`, so the tip label is historical; the NUMBERS were re-derived
against the current tree and are unchanged:

| Axis | Lines |
|---|---:|
| Un-reset vertical caps | 49 |
| Horizontal clips (`truncate` / `line-clamp`) | 84 |

Those are RAW counts, not defect counts. The large majority are chrome: modal shells, dropdown
menus, accordion transitions (`max-h-0` / `max-h-[800px]`), terminal panels, word clouds. Chrome
that stays capped on paper costs the reader nothing. The counts are recorded unfiltered so the
next person can see the size of the haystack rather than inheriting someone's filtered view of
it.

## Verified high-severity candidates

Each of these was opened and read. They hold measured values, units, substance identities, or
model outputs -- content a professional would rely on.

Two rules govern this table, and they are different rules:

1. A container stays here until its fix is MERGED, even if a fix exists on an unmerged branch. An
   earlier draft moved one out on the strength of a stacked PR, and the effect was that the
   highest-severity finding in the whole scan appeared nowhere as open.
2. A container is REMOVED outright, not held pending merge, if it turns out never to have been a
   defect. That is not the same as being fixed, and rule 1 does not apply to it.

One row -- `MatrixMapRightPanel.tsx:808` -- is in case 2. It is retained in the table below only
so the reclassification is visible to anyone who read an earlier revision; it is NOT open and
nothing about it is pending merge. Every OTHER row here is open, and their severities are
PROVISIONAL for the reason given in the correction immediately below.

### Correction: this scan never checked host printability (added 2026-08-16)

The scan method below finds a container carrying a `max-h-*` with no `print:max-h-none`. It never
asks a prior question: **does the container reach paper at all?** A `print:hidden` anywhere in the
ancestor chain removes the whole subtree from print, and then no cap inside it can clip on paper,
because nothing inside it prints.

That gap produced a wrong entry, and not a marginal one -- the container this table used to call
"the highest-value surface in the scan" is inside a `print:hidden` tabpanel and cannot clip on
paper at all. It was caught by an adversarial code reviewer, not by this scan and not by a unit
test, because the unit test asserted a CLASS STRING and a class string cannot see an ancestor.

Consequences for the rest of this document, stated rather than quietly fixed:

- **The severity ranking of the remaining high-severity candidates is UNVERIFIED against this
  question.** Any of them may sit under a `print:hidden` host and be equally inert. Re-verifying
  all of them is filed as follow-up work; until that is done, treat every severity in the table
  below as provisional.
- The reproducible counts (49 vertical, 84 horizontal) are unaffected. They are honest counts of
  what the regex matches, and they were always described as raw counts rather than defect counts.
  What changes is the interpretation: an un-reset cap is a print defect only if its host prints.
- A future scan should resolve each hit's ancestor chain for `print:hidden` before ranking it, and
  should verify a print fix at RUNTIME (as `e2e/ssd-workbench.spec.ts` does by measuring layout),
  never by asserting classes.

| Location | Cap | Content at risk |
|---|---|---|
| `src/components/matrix-options/MatrixMapRightPanel.tsx:808` | `max-h-[68vh]` / `max-h-[42vh]` via `cn()`, `overflow-auto` | **RECLASSIFIED 2026-08-16 -- NOT a print defect. See "Correction: this scan never checked host printability" ABOVE this table, and the "Withdrawn" section further down.** The PRIMARY matrix-map measurement table (`matrix-map-measurement-table-scroll`). This panel renders ONLY under `case 'Interactive Map'` in `MatrixDashboard.tsx`, and that branch's tabpanel carries `print:hidden` with no reset of its own, so the container never reaches paper and cannot clip there. A `print:` reset was written on the stacked `feat/audit-p0-20260816` branch, verified to be a no-op, and REMOVED. It is not a fix awaiting merge; there is nothing to fix here unless the map tab is made printable, which is a design decision, not a defect. |
| `src/components/engine-v2/PolicySearchPanel.tsx:162` | `max-h-40 overflow-y-auto`, `whitespace-pre-wrap` | Full `policy.originalText` -- regulatory text containing numeric thresholds. |
| `src/components/engine-v2/PolicySearchPanel.tsx:407` | `max-h-64 overflow-y-auto` | Policy search results list. |
| `src/components/engine-v2/TelemetrySidebar.tsx:242` | `max-h-[calc(100vh-2rem)]` | Run ids, config hash, coverage counts. A `vh` cap behaves especially unpredictably in print media. |
| `src/components/bn-rrm/review/ValidationDashboard.tsx:123` | `max-h-96 overflow-auto` | Per-station predicted vs observed classification -- model validation output. |
| `src/components/bn-rrm/review/RiskComparison.tsx:463` | `max-h-96 overflow-auto` | Predicted vs WOE rule classification per station. |
| `src/components/bn-rrm/review/DataProvenance.tsx:335` | `max-h-[28rem] overflow-auto` | Station chemistry / toxicity / community coverage counts. |
| `src/components/bn-rrm/casestudies/TrainingSites.tsx:279` | `max-h-72 overflow-auto` | Station / BN-RRM / WOE / match comparison table. |
| `src/components/matrix-options/CatalogStagingReview.tsx:655` | `max-h-48 overflow-auto` | `JSON.stringify(proposed_payload)` -- staged catalog value, unit and substance. |

Horizontal, same class, sampled rather than exhaustive. Located by BLOCK NAME rather than line
number: an earlier draft used tilde-hedged lines and this document's own diff shifted all three
of them, which is the defect two review rounds were spent removing from the code comments.

| Location | Mechanism | Content at risk |
|---|---|---|
| `src/components/matrix-options/EvidenceLibrary.tsx` references list (the `max-h-80` `<ul>` of `references`) | `truncate` | `short_citation`. |
| `src/components/matrix-options/EvidenceLibrary.tsx` hitl-sources list (the `hitl-sources-list` block) | `truncate` | `short_citation`, `source_id` -- a DIFFERENT block from the references list; an earlier draft of this table attributed `source_id` to the references list, which was wrong. |
| `src/components/matrix-options/EvidenceLibrary.tsx` cross-pathway row card (`CrossPathwayAuditRowCard`) | `truncate` | `{row.substance_label}` on SCREEN. The print side is fixed; the screen ellipsis is not recoverable (overflow-hidden on the element, and the panel scrolls only vertically). |
| `src/components/matrix-options/CalculatorValueSearchPanel.tsx:563,566,578,590` | `truncate` | substance label, pathway/jurisdiction, quality summary, default-policy audit. |
| `src/components/engine-v2/PerPolicyResultsTable.tsx:1299` | `line-clamp-2` | Per-policy AI judgment summary. |

## Cleared on inspection

Recorded so the next pass does not re-litigate them: BN-RRM canvas and engine-v2 progress-bar
`overflow-hidden` (decorative fills; the numeric value renders as adjacent text); bare
`whitespace-nowrap` table cells with no width constraint (they widen, they do not truncate);
`SiteMap.tsx` map chrome; `SubstanceCombobox.tsx:173` and `MatrixMapRightPanel.tsx:635` filter
and dropdown affordances; `SsdWorkbench.tsx:1950` (`h-[19rem] overflow-hidden` wrapping a
Recharts `ResponsiveContainer` sized TO the frame, so it does not clip content);
`SsdWorkbench.tsx:1081` typeahead suggestions (an input affordance -- recorded as a deliberate
exception in `printCapSweep.test.ts`).

## Fixed

### In THIS branch (`feat/deferred-triage-20260816`)

- `EvidenceLibrary.tsx` cross-pathway audit list -- `print:max-h-none print:overflow-visible`.
- `EvidenceLibrary.tsx` cross-pathway row card -- `truncate` on `{row.substance_label}` undone
  for print. This one sits INSIDE the list de-clipped above, so deferring it would have fixed
  how MANY rows print while still clipping WHICH substance each row is about. A reviewer made
  the point that "it is in another file" was not available as a defence here.

### Withdrawn -- `MatrixMapRightPanel.tsx:808` was never a print defect

An earlier revision of this section listed this container as "fixed in the stacked
`feat/audit-p0-20260816` PR". That is WITHDRAWN. The stacked branch did add
`print:max-h-none print:overflow-visible` here, and it was then established that the container
sits inside a `print:hidden` tabpanel (the `case 'Interactive Map'` branch in
`MatrixDashboard.tsx`) and therefore never reaches paper. The reset was a no-op and was removed
from that branch; the entry is reclassified in the candidates table above.

Nothing about this file is pending merge. See "Correction: this scan never checked host
printability" for what this implies about the other candidates.

Everything else in this document is OPEN.

## What the existing guards do and do not cover

- `e2e/ssd-workbench.spec.ts` runtime print sweep (`no height-capped data table clips under the
  print medium`): measures REAL layout under `emulateMedia({ media: 'print' })`. Strongest guard
  we have. Scoped to elements containing a `<table>`, and only on views that spec visits -- and
  within those views only what is already rendered, so anything behind a disclosure toggle no
  spec clicks is invisible to it.
  It was, until this change, an OFFENDERS-ONLY assertion: it collected clipping containers and
  asserted the list was empty, which passes on a view where it finds none. An existence half was
  added (`expect(swept.examined).toBeGreaterThan(0)`) so it can no longer report green having
  measured nothing. That bears directly on recommendation 2 below, which proposes extending this
  sweep to other views.
- `e2e/ssd-workbench.spec.ts` species-aggregate test (`species-aggregate table is not
  height-clipped when printed`): a DIFFERENT test, targeting one `data-testid`. This is the one
  carrying the screen-side anti-vacuity precondition
  (`expect(screenState.scrollH).toBeGreaterThan(screenState.clientH)` before switching media),
  proving the fixture could actually demonstrate clipping. An earlier draft of this document
  credited that precondition to the sweep. The sweep did not have one.
- `src/components/__tests__/printCapSweep.test.ts`: a source-text class contract over
  `SsdWorkbench.tsx` and `EvidenceLibrary.tsx` only. It does not compile or render anything, is
  blind to caps composed through `cn()` or template literals, and does not look at the horizontal
  axis at all. It is a cheap net under the e2e sweep, not a substitute for it.

Note the `cn()` blindness is not hypothetical: `MatrixMapRightPanel.tsx:808` -- which this document
previously ranked as the highest-severity container in the scan -- is `cn()`-composed, so a
source-text sweep would not have found it even with that file in scope. It was found by an external
reviewer reading the code. A regex is the wrong tool for the general case.

That example now carries a second, sharper lesson. The container turned out not to be a print
defect at all (its host tab is `print:hidden`), and the way that was MISSED is instructive: a unit
test asserted the print classes on the rendered element, was falsified two-sided, and passed --
while certifying nothing, because a class-string assertion cannot see an ancestor that removes the
element from print. Regex blindness and assertion blindness are different failures. Neither is
fixed by the other, and only a runtime measurement addresses the second.

## Recommended next step (owner decision)

1. Triage the remaining 8 vertical and 5 horizontal candidates above into fix / accept /
   not-a-defect. (Was 9 vertical; `MatrixMapRightPanel.tsx:808` has since been triaged to
   not-a-defect and is excluded from that count.) Before ranking any of them, resolve each one's
   ancestor chain for `print:hidden` -- that is the check whose absence produced the wrong entry.
2. For the ones that are fixed, extend the RUNTIME e2e sweep to the views that hold them, rather
   than growing the source-text sweep. Real layout measurement is the only thing that has caught
   this class reliably.
3. Decide whether a repo-wide print stylesheet rule (for example, lifting vertical caps on any
   container carrying a data-testid marked as value-bearing) is preferable to per-container
   utilities. That is an architecture decision, not a cleanup, and is why this is a document
   rather than a commit.
