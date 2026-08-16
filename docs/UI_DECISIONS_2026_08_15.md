# UI QA Audit -- Owner Decisions (2026-08-15)

Source: UI/UX audit spec (21 decisions: 3 global + 18 per-view), rendered at
`design-decisions.html` in the session scratchpad. Numbering below matches that
page's numbering exactly (verified 1-21, same titles, same order).

Three groups:
- **DECIDED** -- owner picked a single option; ready to implement as-is.
- **HYBRID** -- owner combined parts of multiple options; needs the combination
  spelled out before implementation (done below).
- **OPEN** -- owner could not decide, usually because they could not tell what
  part of the app the decision referred to. See
  `scratchpad/OPEN_QUESTIONS.md` for the briefing that unblocks each one.

Counts: 13 DECIDED, 3 HYBRID (covering 4 decisions -- #1 counts as hybrid for
map, decided for other views), 5 OPEN (#11, #16, #18, #20, and the "active vs
complete" color half of #17).

---

## DECIDED (ready to implement)

### 2. Wide content scrolls sideways on phones with no affordance
View: The Guide, methodology-by-pathway, references-and-values | Severity: medium
Owner: "a"
**Decision: Option A -- Edge-fade affordance everywhere.** Add a shared
scrollable-region treatment (trailing gradient mask + a small "swipe to see
more" caption) to every `overflow-x-auto` wrapper (math display, tables, the
Gantt figure), toggled by a runtime overflow check so it disappears when
content already fits.

### 3. Heavy card chrome and unexplained color coding across informational views
View: The Guide, Conceptual Model, Landing page | Severity: low | aiSlop: true
Owner: "b"
**Decision: Option B -- Keep color, but make it mean something.** Reduce to a
small semantic palette where color encodes a real axis (e.g. Ecological vs
Human Health, active vs complete) as a thin top border on an otherwise neutral
surface; use neutral surfaces everywhere color would otherwise be purely
decorative.
NOTE: this option's own example text ("active vs complete") is the same axis
the owner later revisits in #17 with an inverted color proposal (green=active,
blue=complete) that conflicts with the app's existing green=approved/complete
semantic (see OPEN_QUESTIONS.md #17). Implementer should reconcile the two
before choosing which axis/colors #3 actually encodes on the Conceptual Model
cards.

### 5. Values table breaks down at 375px
View: references-and-values | Severity: high
Owner: "c"
**Decision: Option C -- Sticky first column, scroll the rest.** Keep the full
7-column table exactly as-is on desktop; on narrow viewports make only the
Parameter column sticky (`position: sticky; left: 0`, with a shadow divider)
so row identity stays visible while the rest of the row scrolls horizontally
under the user's thumb. CSS-only, cheapest of the three, does not eliminate
horizontal scroll.

### 6. Four status pills per row bury the one that matters
View: references-and-values | Severity: high
Owner: "a"
**Decision: Option A -- Promote one, demote three.** Render
`evidence_support_status` (answers "is this sourced") as the one visible
colored pill; fold `default_status`, `qa_status`, `extraction_status` into a
small plain-text line beneath it, e.g. "Default . QA passed . Extracted".

**Follow-up P2-1 -- RESOLVED 2026-08-15 (owner).** Demoting `qa_status` into the
muted line created a new problem the original decision did not anticipate: 41 rows
are simultaneously `qa_status=superseded` AND
`evidence_support_status=approved_source_backed`. Those rows showed a green
"Approved source-backed" pill above undifferentiated 12px grey text, so the row
read as two reassuring signals with the only warning visually demoted.

**Decision: tone the demoted text, keep the pill.** The green pill STAYS -- it
reports evidence PROVENANCE, and for these rows the provenance genuinely is
source-backed. What changes is that `qa_status` no longer renders neutral grey when
it carries a warning: amber for `needs_review`, rose for `superseded`, unchanged
(inherited muted grey) for settled statuses.

This deliberately reuses the tones `statusTone()` already assigns to the PILL form
of the same statuses, so the two renderings of one status can never disagree.
Implemented as a shared `qaStatusTextTone()` / `QaStatusText` pair in
`EvidenceLibrary.tsx` and applied at ALL FOUR sites that fold a `qa_status` into
muted text (the row-level default-evidence cell plus three per-evidence-item
lines) -- fixed as a class, not only at the row that prompted it.

Supersedes the "PROVISIONAL ASSERTION" note in `EvidenceLibrary.test.tsx`; that
test now pins an AGREED contract and may be cited as evidence of intended
behaviour.

### 8. Right-drawer equations show raw LaTeX source, not rendered math
View: methodology-by-pathway | Severity: high
Owner: "a"
**Decision: Option A -- Render it too.** Wrap `eq.equation_latex` in `$$...$$`
and pass it through `MathRenderer` in the drawer (`MatrixDashboard.tsx`,
"Derivation equations" accordion) so both panes show the same typeset
equation. Confirm KaTeX fits the narrow drawer column without overflow.

### 9. Give the "2x2 Matrix" an actual matrix shape
View: Conceptual Model | Severity: high
Owner: "c"
**Decision: Option C -- Mini-diagram + detail cards.** Add a small 2x2 legend
diagram (four colored squares with axis labels, no prose) at the top of the
view, numbered 1-4. Keep the existing four detail cards below, each carrying
the matching number, so overview and deep-dive stay visibly linked (matching
numbers/colors) but are not merged into one dense grid.

### 10. Hero: gradient banner + emoji status pill
View: Landing page | Severity: high | aiSlop: true
Owner: "a"
**Decision: Option A -- Editorial header.** Drop the gradient. Left-align the
title over a plain surface background; put the phase status as a small
mono-style status line (no emoji, no pill) directly under the title; keep the
description short.

### 12. Error/notice banners stack with guessed pixel offsets, not layout flow
View: Interactive Map (matrix-map) | Severity: medium
Owner: "a"
**Decision: Option A -- Single stacked notice column.** Replace the three
separately-positioned banners (`fetchErrorMessage`, `siteAggregateFetchErrorMessage`,
`refetchError`) with one flex column container that any active notice pushes
into automatically. Order follows priority (fetch error, then aggregate
error, then refetch error); spacing is `gap`, not guessed pixel offsets.

### 14. Chart badge always claims "ECOTOX mirror" data, even when it isn't
View: SSD Workbench | Severity: medium
Owner: "c"
**Decision: Option C -- Move corpus size into the verification panel.** Drop
the `OWNER_REPORTED_ECOTOX_ROWS` badge from the chart card. Add the
582,125-row mirror-corpus figure as a labeled row inside the existing
"Current source" `dl` in the Validation and verification panel, clearly
separated from "Rows used".

### 19. Plain-language first, jargon second
View: Conceptual Model | Severity: medium
Owner: "a"
**Decision: Option A -- Plain lead + technical detail line.** Split each card
into a bold one-line plain-language takeaway, followed by a smaller, muted
line carrying the technical method names (e.g. "Equilibrium Partitioning
(EqP)", "BSAF"). Roughly doubles the copy to write per card.

### 21. Blue accent-border banner restates the tab you just clicked
View: methodology-by-pathway | Severity: low
Owner: "a"
**Decision: Option A -- Delete it.** Remove the
`bg-sky-50 ... border-l-4 border-sky-500` banner outright. The sidebar's
selected-tab highlight and the document's own heading (once the #16 heading
hierarchy fix lands -- currently OPEN, see below) already orient the reader.

**Sequencing note (logged 2026-08-15, Leg 1 round 4).** This decision's rationale
leans on the #16 heading-hierarchy fix to carry the orientation the banner used to
provide -- but #16 was OPEN at batch-1 plan time and is now scheduled in BATCH 2.
So between batch 1 shipping and batch 2 shipping, the methodology-by-pathway view
has neither the banner nor the corrected heading. The residual orientation cue is
the sidebar's selected-tab highlight alone.

Judged acceptable and NOT a batch-1 blocker: the banner was rated severity LOW, the
gap is temporary, and re-adding copy now only to delete it again in batch 2 is
churn. Recorded here because it is a real consequence of splitting the batches that
was not visible in either batch's own plan. If batch 2 slips materially, revisit.

---

## HYBRID (decided, spec below)

### 1. Primary controls are under the 44px touch minimum app-wide
View: references-and-values, Interactive Map (matrix-map), SSD Workbench | Severity: high
Owner: "b for map and c for other (might be situation specific)"
**Decision:**
- **Interactive Map -> Option B (44px plus always-visible micro-labels).**
  Apply a 44px floor to the zoom/layer stack and the 5-button interaction-mode
  toolbar (`MatrixMap.tsx:1602-1758`), AND drop every `sm:`-gated label so
  every icon-only control always shows a short word under/beside the icon
  (label included inside the 44px height). Expect the mode toolbar to widen
  and compete with the zoom stack in the top-right corner on narrow screens --
  implementer must resolve that overlap (stack vertically or wrap).
- **References & Values pagination + row-expand, and SSD Workbench's
  `ToggleButton` groups -> Option C (fewer, bigger controls: collapse into
  menus).** Replace pager buttons / row-expand `<summary>` / SSD's 3-across
  toggle grids with a single full-width 44px control that opens a labeled
  list, matching the native `<select>` pattern SSD already uses for
  Distribution and Analysis mode.
**AMENDMENT -- owner-decided 2026-08-15, after the round-4 spec audit.** The audit
compared this decision's text against what shipped and found the 44px floor applied
everywhere named, but the "collapse into menus" mechanism implemented only for SSD's
Endpoint filters. Specifically:

- **#1b (References & Values pager + row-expand): SHIPPED AS "BIGGER", NOT "COLLAPSED".**
  Prev/Next remain two buttons at a 44px height floor; the row-expand stayed a binary
  `<summary>` disclosure at 44px. Neither became "a single full-width control that opens
  a labeled list". Partly defensible on the merits -- a two-button pager and a binary
  disclosure have no meaningful list to open -- but it is not what this text asked for.
- **#1c (SSD ToggleButton groups): 1 of 4 GROUPS COLLAPSED.** Endpoint filters (the one
  genuine multi-select) became a `<details>` + checkbox `<fieldset>`. Data source, Media
  filter, and Aquatic environment remain 3-across / 2-across toggle grids, each button
  simply raised to the 44px floor. The implementer's stated reason was that converting
  the shared `ToggleButton` to a menu pattern would force a rewrite across 30+ call
  sites.

**Owner ruling: ACCEPT the deviation as shipped.** The severity-high part of this
decision was the touch-target floor, and that is met everywhere. The menu-collapse was
the mechanism, not the goal. Recorded here so this is a decision on the record rather
than an undocumented gap; revisit only if the enlarged grids prove awkward in real
phone use.

**NOT accepted, fixed in batch 1:** the zoom/layer stack shipped with the 44px floor but
WITHOUT the visible labels this decision explicitly requires ("every icon-only control
always shows a short word"). Those controls had `aria-label` + `title` only, and a
`title` tooltip does not render on touch devices at all -- so on a phone they had no
label by any means, defeating the decision's own purpose. Zoom in/out, Fit to samples,
the layer switcher, and Export now carry visible words (In / Out / Fit / Layers /
Export) under the icon, inside the 44px box, with the longer `aria-label` retained for
screen readers.

- Implementer note: this makes the map an outlier vs. the rest of the app
  (labels-on-buttons instead of collapsed menus). That is what "situation
  specific" means in the owner's quote -- keep the map's toolbar visible at a
  glance because mode-switching is high-frequency there; collapse
  lower-frequency multi-option groups elsewhere.

### 13. Legend panel is overloaded: symbology + filter control + provenance essay in one card
View: Interactive Map (matrix-map) | Severity: medium
Owner: "hybrid using a but use collapsible for filters as in c"
**Decision: Option A's split, restructured with Option C's collapsible
mechanism.** Move the "Surveyed only" filter checkbox out of the
legend/provenance panel (`MatrixMap.tsx:1762-1796`) into the existing
filter/toolbar surface where other view filters live (Option A's structural
move) -- so the panel that currently reads as passive reference material no
longer also carries a live filter action. Then make the remaining
legend/provenance content (classification legend, coordinate-quality legend,
site-aggregate note) itself a collapsible panel: collapsed by default on
mobile, expanded by default on desktop (Option C's collapse mechanism,
applied to what's left after the filter is removed -- not to the filter
itself, which per Option C should stay always-visible once relocated).

### 15. ECOTOX mirror status is signalled by color alone
View: SSD Workbench | Severity: medium
Owner: "hybrid a and b - use check instead of dot but use screen reader for hidden text"
**Decision: Combine A's hidden-text mechanism with B's shape coding.** Replace
the plain colored dot (`SsdWorkbench.tsx:919-938`) with a small check /
warning-triangle / x icon (Option B's shape-by-status mapping), so status is
legible by shape as well as color. Additionally apply Option A's
accessibility wiring: `aria-hidden` on the icon itself plus a `title`
attribute and an `sr-only` span carrying the plain-language status word
(`mirrorHealthTitle`/`mirrorHealthMessage`, `SsdWorkbench.tsx:309-356`) so
screen readers announce it without waiting for the health panel to open. No
always-visible text pill (that was Option C, not selected) -- the icon shape
plus the hidden/tooltip text is the whole fix.

---

## OPEN (needs owner input -- see scratchpad/OPEN_QUESTIONS.md for full briefings)

### 11. Navigation cards: emoji-tile generic grid
View: Landing page | Severity: high | aiSlop: true
Owner: "unsure since I opted for hamburger because of too much content in
the menu - none of these provided options work, maybe c could work"
**Status: OPEN.** The owner's reasoning ("too much content in the menu") does
not describe this decision's actual subject: the public landing page's 3-card
grid (Dashboard / Survey Results / CEW 2025) at `src/app/page.tsx:85-129`. A
hamburger + categorized dropdown menu with 15 items across 5 categories
already exists elsewhere in the app -- the authenticated dashboard header
(`src/components/Header.tsx:254-269` mobile hamburger, `:179-226` desktop
"Menu" dropdown, items from `src/components/header/menuConfig.ts`). See
OPEN_QUESTIONS.md for the recommendation once the owner confirms which menu
they meant.

### 16. Duplicate H1s between page chrome and methodology document
View: methodology-by-pathway | Severity: medium
Owner: "not sure, hard to decide without seeing what this actually is
referring to - they all seem fine to me, so the best solution makes sense,
but you flagged that one solution might not fit all instances"
**Status: OPEN.** Needs the owner to see the actual two-H1 rendering
(`MatrixDashboard.tsx:1768` page H1 "Matrix Options", vs. the markdown
document's own H1 rendered through `MathRenderer` at `MatrixDashboard.tsx`
~1306-1310) before picking A/B/C, and needs confirmation on the specific
multi-instance risk the audit flagged (Option A's tradeoff: must not break
the Jermilova review portal, which reuses the same `MathRenderer` component
for a longer document). See OPEN_QUESTIONS.md.

### 17. Project Phases: emoji icons + meaningless numbered circles
View: Landing page | Severity: medium
Owner: "hybrid - I'm not clear what part of the page this actually is, I
like a but if we go with that I'd reverse color scheme of active and
complete so active is green and complete is blue, emphasizing active"
**Status: PARTIALLY DECIDED, color choice OPEN.**
- DECIDED: base layout is **Option A -- Status-chip list.** Replace the
  numbered circles and emoji tiles in `ProjectPhases.tsx` with a small
  "Active" / "Complete" status chip per phase, and plain (non-numbered)
  bullet sub-items.
- OPEN: the owner's proposed color inversion (active=green, complete=blue)
  needs to be checked against the app's existing semantic color use before
  it ships -- the app already uses green/emerald to mean "approved / passed /
  trustworthy" everywhere else (e.g. `StatusBadge`/`statusTone` in
  `EvidenceLibrary.tsx:387-408`), which is closer to "complete" than
  "active" in meaning, and no blue semantic token exists in the app's `--db-*`
  palette (`src/app/globals.css:308-351`) at all. See OPEN_QUESTIONS.md for
  the full analysis and recommendation.

### 18. Get Involved: redundant boxed CTA with filler copy
View: Landing page | Severity: medium
Owner: "a seems good but hard to say without seeing the page, b might also
work"
**Status: OPEN.** Owner is choosing between Option A (header auth links,
drop the bottom box entirely) and Option B (fold Log In / Create Account
into the hero) but wants to see the actual page first. See
OPEN_QUESTIONS.md for a description of the current page
(`src/app/page.tsx:135-160`) and a recommendation.

### 20. Non-responsive page padding wastes 17% of phone width
View: The Guide | Severity: medium
Owner: "unsure none of the options seems like the best solution"
**Status: OPEN.** None of A (responsive step-down), B (full-bleed mobile,
drops card borders), or C (fluid `clamp()` padding) satisfied the owner.
Needs a fourth option or a hybrid. See OPEN_QUESTIONS.md for the current
code (`MatrixDashboard.tsx:2234` outer wrapper, `:1395` per-section card) and
a proposed alternative.

---

## Owner follow-up, 2026-08-15: #11 and #17 resolved

The owner asked for a recommendation on these two and said "go with them for now".
Both are now DECIDED. Rationale recorded here because in each case the decision
departs from the owner's first instinct, and a future reader needs to know why.

### #11 -- RESOLVED: Option C (keep the grid, unify the icon language)

The owner's stated reasoning ("I opted for hamburger because of too much content
in the menu") describes a DIFFERENT surface: the authenticated dashboard header
(`src/components/Header.tsx`), whose `MENU_LINKS` carry 15 links across 5
categories and which already has both a mobile hamburger and a desktop menu.
That menu is not part of this audit and is not broken.

Decision #11 is the PUBLIC logged-out landing page (`src/app/page.tsx:85-129`),
which renders exactly 3 cards. There is no volume problem, so a nav-bar or
hamburger treatment solves a problem this page does not have. Option C is the
smallest change consistent with the owner's "maybe c could work".

SEPARATE, NOT DONE, needs its own scoping: the logged-out landing page has ZERO
header navigation (`page.tsx:9-16` is logo + theme toggle only). If the intent is
"make navigation discoverable everywhere, dashboard-menu style", that is a
structural change well beyond this decision's framing.

### #17 -- RESOLVED: Option A layout, WITHOUT the colour inversion

The owner asked for active=green and complete=blue, to emphasize active. The
layout half (Option A status chips) is adopted. The colour inversion is NOT,
because it conflicts with semantics already established elsewhere in the app:

- `--db-pass` (green) consistently means "approved / passed / trustworthy /
  done being reviewed" -- see `EvidenceLibrary.tsx:387-408` `statusTone`.
- There is NO blue semantic token in the `--db-*` set (`globals.css:285-390`).
  The sky-blue marking "active" in `ProjectPhases.tsx:12-30` is a Tailwind
  default, decorative and not anchored to any app-wide meaning.
- Decision #6 puts green "Approved" pills on the References and Values table. A
  green "Active" chip on the landing page would read as "this phase is done".

The owner's underlying goal is met a different way: emphasize through WEIGHT and
SATURATION rather than by swapping which colour means what. Active chip = solid,
saturated, stronger border. Complete chip = muted outline, low saturation
(formalising what `ProjectPhases.tsx:40-53` already gestures at with
`opacity-80` + `grayscale`).

Status after this follow-up: 15 DECIDED, 3 HYBRID, 3 OPEN (#16, #18, #20).

---

## Owner follow-up, 2026-08-15 (late): #22 -- Conceptual Model rebuilt as the Vision page

NEW scope, not one of the original 21. Raised by the owner after viewing the running
dev server, and DECIDED and implemented the same session. It SUPERSEDES decision #9's
implementation entirely.

### What triggered it
Decision #9 (Option C) had been built to spec on the second attempt: a 2x2 legend of
four filled colour squares with rendered axis labels, numbered 1-4, above four detail
cards. The owner's verdict on seeing it: "the matrix is a matrix now, but I don't like
that each quadrant has a single number in it and it's very small on the page -- looks
ridiculous since we have a huge page with very little content".

That is a fair judgement that no amount of spec-conformance would have caught: #9 as
written asked for a small legend diagram plus separate detail cards, and the small
legend diagram plus separate detail cards is exactly what made the page feel empty.
The decision itself was the problem, not the implementation of it.

### Decision (owner)
1. **Merge the legend and the four detail cards into ONE object.** The matrix IS the
   content: axis headers across the top (Direct Exposure / Exposure through Food) and
   row labels down the side (Ecological Health / Human Health), with real content in
   each quadrant.
2. **Each quadrant shows its plain-language lead always**, with the technical
   receptor/method detail behind a collapsible disclosure.
3. **Ditch the 1-4 numbering** -- it carried no meaning.
4. **Scale with the viewport.** Widened from `max-w-4xl` to `max-w-7xl` (joining The
   Guide); below 768px the grid stacks and each quadrant self-labels, since column and
   row headers cannot label a single-column stack.
5. **Rename the tab** from "Conceptual Model" to "Vision for Modernizing Schedule 3.4".
6. **Structure the page overview-first** (owner, on reviewing the first rebuild): lead
   with all THREE parts of Schedule 3.4 as peer cards, and only then drill into Part 1's
   four-quadrant matrix.
7. **Add Purpose and Objectives**, compressed (owner, after asking whether it was too
   much content): section 1.2's purpose as a framing line, and section 1.4's four
   NON-structural objectives. 1.4's first three objectives restate Parts 1/2/3 and are
   deliberately EXCLUDED -- the three cards already carry them, and including both would
   make the page state the same thing twice in two shapes.
8. **Objectives name their home tab** as plain text (Interactive Map, References &
   Values, TWG Review). The substance-prioritization objective gets NO pointer, because
   no tab owns that work; inventing a plausible one would be a content defect that looks
   fine on screen. Plain text, not navigation controls -- wiring this page into tab state
   would add failure modes for no real gain.

### Content authority
`C:\Users\jasen\OneDrive - Government of BC\My Documents\Science Projects & Groups\SABCS\2025 Sediment Standards Project\TOR, planner and Issues\Draft Project Plan - Phase 2 Sediment Standards (SABCS).docx`,
sections 1.2 (Project Purpose), 1.3 (Vision Statement), 1.4 (Project Objectives). The
three-part structure, the four receptor-pathway names, the matrix-vs-generic
distinction, and the prioritization factors are taken from that document, not
paraphrased from memory. Owner explicitly authorised reading this Government of BC
OneDrive path for this task (L0 1.14 otherwise discourages it as a default source).

Word counts that drove decision 7: 1.2 is 44 words, 1.3 is 197, 1.4 is 483. Including
1.4 verbatim would have roughly tripled the page's prose and buried the matrix, which
is the exact problem this rebuild exists to fix. Compressed and de-duplicated it adds
about 130.

### Knock-on change the rebuild forced
`MatrixDashboard.tsx` granted this tabpanel `tabIndex={0}` specifically because
ConceptualMatrix "has no interactive elements at all". The four disclosures make that
false. Per WAI-ARIA APG a tabpanel CONTAINING focusable children must not itself be in
the tab order, so it is now `tabIndex={-1}` like every other tab; leaving it at 0 would
insert a redundant keyboard stop before the disclosures.

### Superseded
Decision #9's "small 2x2 legend diagram + separate detail cards" shape is DEAD. Do not
restore it. #9's underlying intent -- give the 2x2 an actual matrix shape with visible
axes -- survives and is satisfied more fully here.

Status after this follow-up: 16 DECIDED (adds #22), 3 HYBRID, 3 OPEN (#16, #18, #20).
