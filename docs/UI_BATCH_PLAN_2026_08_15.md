# UI Batch Implementation Partition Plan (2026-08-15)

Source: `docs/UI_DECISIONS_2026_08_15.md`. Scope: the 16 decision numbers that
are DECIDED or HYBRID and have a concrete UI referent: 1, 2, 3, 5, 6, 8, 9,
10, 11, 12, 13, 14, 15, 17, 19, 21. Decisions #16, #18, #20 are OPEN and are
explicitly OUT OF SCOPE (skip entirely). NOTE on the "18" figure in the task
brief: the source doc's own bookkeeping ("13 DECIDED" then "15 DECIDED, 3
HYBRID" after the #11/#17 follow-up) does not arithmetically reconcile to a
clean 15+3 split against the numbered sections actually present in the file
-- I count 13 DECIDED numbers + 3 HYBRID numbers = 16 distinct decision
numbers with content to implement (decision #1 carries two sub-parts: a
HYBRID map part and a DECIDED-elsewhere part, which is likely where the
doc's own count picked up 2 extra). This plan implements all 16 numbers,
which is the complete non-OPEN set in the source document.

Verified against a fresh read of the code on branch
`feat/mo-design-batch-20260815` (off `origin/main` `65228472`). All
file:line citations below were re-confirmed by Read/Grep, not copied from
the decisions doc.

---

## 1. Per-decision file targets

### #2 -- Edge-fade affordance on overflow-x-auto regions
View: The Guide, methodology-by-pathway, references-and-values
Files:
- `src/components/MathRenderer.tsx` -- the shared math-display wrapper,
  `[&_.math-display]:my-8 [&_.math-display]:overflow-x-auto` (~line 65) and
  the table wrapper `math-renderer-table-wrapper overflow-x-auto` (line 73).
  MathRenderer is used by both The Guide and methodology-by-pathway (both
  render markdown through it inside `MatrixDashboard.tsx`), so fixing it
  here covers both views' math and markdown tables in one place.
- `src/components/matrix-options/Phase2GanttChart.tsx:97` -- the Gantt
  `<figure className="... overflow-x-auto ...">`.
- `src/components/matrix-options/EvidenceLibrary.tsx:4367` and `:4585` --
  the two `overflow-x-auto` table wrappers in references-and-values
  (Parameter Values table, Sources table).
- NEW shared file needed: a small reusable wrapper/hook, e.g.
  `src/components/ui/ScrollFadeRegion.tsx` (client component: wraps
  children in a relatively-positioned div, runtime-checks
  `scrollWidth > clientWidth` via a ResizeObserver/effect, and renders a
  trailing gradient mask + "Swipe to see more" caption only when true).
  This is a new file by necessity (the decision asks for one shared
  treatment reused in 4+ places) -- flag this to the group implementing it
  as the one exception to "no new files" and keep it small and testable.
- OUT OF SCOPE (do not touch): the other ~25 `overflow-x-auto` sites found
  in Admin, BN-RRM, engine-v2, poll-results -- decision #2 is scoped to
  "The Guide, methodology-by-pathway, references-and-values" only.

### #3 -- Semantic color palette on cards
View: The Guide, Conceptual Model, Landing page
Files:
- `src/components/ConceptualMatrix.tsx` -- the 4 quadrant cards (lines
  15-72), each currently a fully-tinted `bg-{color}-50` surface with a
  matching border. Per the reconciliation note in the source doc, this
  decision's axis on this file is Ecological vs Human Health (the axis the
  file already encodes structurally via its 4 quadrants), NOT the
  active/complete axis -- that axis belongs to #17 and is handled there,
  with the color choice already resolved (weight/saturation, not inverted
  hue). Convert each card to a neutral surface (`bg-white dark:bg-slate-800`
  / existing card chrome) with a thin colored top border
  (`border-t-4 border-emerald-500` / `border-t-4 border-sky-500`) encoding
  Ecological (emerald/teal) vs Human Health (sky/indigo) -- collapse the 4
  distinct hues down to 2 (one per axis value) since a real 2-value axis
  does not need 4 colors.
- `src/app/page.tsx` -- the "About the Sediment Standards Project" card
  (lines 44-73) is neutral already (`bg-white`); the icon tiles at lines
  54, 82, 97, 112 use decorative `bg-sky-100`/`bg-green-100`/`bg-purple-100`
  circles with emoji, not a semantic axis. #10 already removes the hero
  gradient; #11 (Option C) keeps the 3-card grid's icon language but this
  decision (#3) is the one that should flatten the 3 nav-card icon tiles'
  decorative color to neutral (they don't encode any real axis -- Dashboard
  vs Survey Results vs CEW 2025 is not a 2-state axis). Change lines 82,
  97, 112 icon-tile backgrounds to a single neutral tile style.
- `docs/UI_DECISIONS_2026_08_15.md` search for "The Guide" card chrome:
  The Guide is rendered through `MatrixDashboard.tsx`'s markdown pipeline
  (via `MathRenderer`), which does not itself apply per-section card color
  coding in `.tsx` -- any color coding in The Guide view lives in the
  markdown/HTML content string, not in component code. CALL THIS OUT: if a
  card-chrome color pattern in The Guide turns out to live in a markdown
  source file rather than a `.tsx`, it is NO-OP for this batch (content
  edit, not a code change) -- confirm by grep for `bg-.*-50` inside
  whatever markdown source feeds The Guide tab before spending time on it.

### #5 -- Sticky first column on Parameter Values table
View: references-and-values
File: `src/components/matrix-options/EvidenceLibrary.tsx`, the table at
lines 4367-4482 (`overflow-x-auto` wrapper at 4367, `<colgroup>` at
4372-4380, `<thead>` at 4381-4391, first `<td>` at 4436-4443). CSS-only:
add `sticky left-0 z-10 bg-white dark:bg-slate-950` (matching row hover/
selected background) to the Parameter `<th>` and `<td>`, plus a right-edge
shadow divider (`shadow-[2px_0_4px_rgba(0,0,0,0.08)]` or a pseudo-border)
on narrow viewports only if desktop must stay pixel-identical -- simplest
correct implementation applies it unconditionally since sticky-with-no-
overflow is a no-op on wide viewports anyway.

### #6 -- Promote evidence_support_status, demote the other three pills
View: references-and-values
File: `src/components/matrix-options/EvidenceLibrary.tsx`, lines 4462-4466
(the "Default / evidence" `<td>` inside the SAME table block as #5).
Change: render `<StatusBadge value={row.record.evidence_support_status} />`
alone (colored pill), then a plain-text line below it built from
`default_status`, `qa_status`, `extraction_status`, e.g.
`{humanizeCatalogLabel(default_status)} . {humanizeCatalogLabel(qa_status)} . {humanizeCatalogLabel(extraction_status)}`
in `text-xs text-slate-500 dark:text-slate-400`.
OUT OF SCOPE, deliberately not touched (two other StatusBadge clusters
exist in the same file and look similar but are NOT "four pills per row"
in the sense the decision describes):
  - Lines 1921-1927: the right-panel value-detail drawer shows 5 badges
    (adds `canonical_source_status`) as a deliberate full-detail view, not
    a dense table row.
  - Lines 2415-2437: the candidate-group comparison table already puts
    each status in its OWN column (`Default role` / `Evidence support` /
    `QA` are separate `<th>`s), so there is no "bury the one that matters"
    problem there.

### #8 -- Render LaTeX in the right-drawer "Derivation equations" accordion
View: methodology-by-pathway
File: `src/components/MatrixDashboard.tsx`, `renderToolReference()`,
lines 1332-1358. The raw source is at line 1342-1344:
`<pre className="overflow-x-auto ...">{eq.equation_latex}</pre>`. Replace
with `<MathRenderer content={`$$${eq.equation_latex}$$`} />` (or whatever
prop name `MathRenderer` exposes -- confirm its public API before wiring;
it is already imported/used elsewhere in this same file for the main
document body). Verify in a real 320-360px-wide right-drawer that KaTeX
output does not overflow -- if it does, this equation instance also needs
the #2 edge-fade wrapper (`ScrollFadeRegion`), which is a legitimate
overlap point between #2 and #8 -- see Risk section.

### #9 -- 2x2 mini-diagram legend + numbered detail cards
View: Conceptual Model
File: `src/components/ConceptualMatrix.tsx` (same 77-line file as #3/#19).
Add a small 2x2 legend diagram (4 colored squares, axis labels, numbered
1-4, no prose) above the existing `grid grid-cols-1 md:grid-cols-2` block
(lines 13-73). Add matching number badges to each of the 4 existing cards
(e.g. a small numbered circle in the card header next to the icon) so the
legend and the detail cards share numbers/colors. This is a straightforward
addition-in-place; no other file involved.

### #10 -- Editorial header (drop hero gradient, no emoji pill)
View: Landing page
File: `src/app/page.tsx`, lines 19-39. Change:
- Line 20: remove `bg-gradient-to-r from-slate-900 via-slate-800 to-sky-900`
  -> plain surface background consistent with the rest of the page
  (`bg-white dark:bg-slate-800` or a slightly distinct neutral banding).
- Lines 22-25: left-align (`text-left` in place of `text-center`), drop
  `text-5xl` centering wrapper if the parent `text-center` div is removed.
- Lines 29-33: replace the `bg-white/10 backdrop-blur-md rounded-full`
  pill containing "[rocket U+1F680] Current Focus: ..." with a plain mono-style status
  line directly under the title, no emoji, no pill chrome, e.g.
  `<p className="font-mono text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Current Focus: Phase 2 -- Foundational Research and Framework Development (2026-2027)</p>`.
- Line 34-36: keep description short (trim, do not necessarily delete).
Text colors (`text-sky-200`, `text-sky-100`) must be re-derived for a
light/neutral surface in both themes -- see Risk section (theming).

### #11 -- RESOLVED Option C: keep the 3-card grid, unify icon language
View: Landing page
File: `src/app/page.tsx`, lines 76-121 (the 3 `<a>` nav cards: Dashboard,
Survey Results, CEW 2025). Per the doc's resolution, this is the smallest
change consistent with "maybe c could work" -- unify the icon tile
treatment across the 3 cards. This overlaps directly with #3's instruction
to flatten these same icon tiles to neutral color (lines 82, 97, 112) --
implement as ONE change: neutral icon-tile background
(`bg-slate-100 dark:bg-slate-700` for all three, replacing
`bg-sky-100`/`bg-green-100`/`bg-purple-100`), keep the emoji (audit flagged
"emoji-tile generic grid" as the smell but the resolution note explicitly
rejects a structural nav-bar rebuild -- the emoji themselves were not
called out as the problem in the Option C resolution text, the per-card
color variance was). Do not add a header nav bar or hamburger to this
logged-out page -- doc explicitly scopes that as "SEPARATE, NOT DONE".

### #12 -- Single stacked notice column for map banners
View: Interactive Map (matrix-map)
File: `src/app/(dashboard)/matrix-map/MatrixMap.tsx`, lines 1563-1588.
Currently three independently `absolute`-positioned divs at
`top-20`/`top-44`/`top-32` (note: these overlap/z-order oddly already --
top-32 is BETWEEN top-20 and top-44, confirming the "guessed pixel offset"
finding). Replace with one `absolute top-20 left-4 right-4 z-[1000] flex
flex-col gap-2` container; render each notice as a child only when its
condition is true, in priority order: `fetchErrorMessage`, then
`siteAggregateFetchErrorMessage`, then `refetchError` (keep refetchError's
existing dismiss button). No pixel math, `gap-2` handles spacing.

### #13 -- Split legend panel: relocate filter, collapse the rest
View: Interactive Map (matrix-map)
File: `src/app/(dashboard)/matrix-map/MatrixMap.tsx`.
- Move the "Surveyed only" checkbox (lines 1785-1794, inside the legend
  panel at 1761-1796) OUT to wherever the map's other filter controls live
  (the interaction-mode toolbar block at lines 1688-1759, or the sample-
  count header block at 1798+ -- inspect at implementation time for the
  existing filter-affordance location; the doc says "the existing
  filter/toolbar surface where other view filters live" -- if no such
  surface currently exists as a distinct filter row, add the checkbox as
  its own small always-visible chip near the zoom/layer stack, not buried).
- Wrap what remains of the legend/provenance block (lines 1762-1784,
  1769-1784: classification legend, coordinate-quality legend,
  site-aggregate note) in a `<details>`/`<summary>` (or local `useState`)
  collapsible: collapsed by default under a mobile breakpoint check,
  expanded by default at `md:`+ (use `open` attribute conditioned on a
  `useMediaQuery`-style hook, or simplest: `<details className="md:open" open={!isMobile}>` -- confirm `isMobile` state already exists in this
  component, it is referenced elsewhere in the file, e.g. line 1814).
This decision and #1's map 44px/label work both touch lines 1688-1796 of
the SAME file -- they must be implemented together or in immediate
sequence within one group (see Partition section).

### #14 -- Move ECOTOX corpus-size figure into verification panel
View: SSD Workbench
File: `src/components/matrix-options/SsdWorkbench.tsx`.
- Remove the badge at lines 1872-1875 (`ECOTOX mirror approx {...} rows`
  pill on the "Empirical SSD preview" chart card header).
- Add a labeled row inside the existing "Current source" `<dl>` at lines
  1490-1493+ (the `Validation and verification` collapsible panel,
  opened around line 1478) -- e.g. a `<dt>Mirror corpus size</dt>
  <dd>{OWNER_REPORTED_ECOTOX_ROWS.toLocaleString()} rows</dd>` pair,
  visually separated (own bordered sub-block or a `border-t` divider) from
  whatever "Rows used" row already exists in that `<dl>` -- confirm exact
  existing row structure by reading lines 1493-1532 before inserting.
`OWNER_REPORTED_ECOTOX_ROWS` constant (line 57) stays; only its render
site moves. This is a NUMERIC/DATA-ADJACENT change in the loose sense (it
touches a labeled data figure) but the number itself is not a regulatory
value or calculation output -- it is a static corpus-size label. Do not
change the value, only its location and framing.

### #15 -- Icon-shape + hidden-text mirror status indicator
View: SSD Workbench
File: `src/components/matrix-options/SsdWorkbench.tsx`, lines 919-938 (the
3 colored-dot spans inside the "ECOTOX mirror" `ToggleButton`, lines
900-940). Replace each `<span className="... rounded-full bg-{color}-500" />`
dot with a small icon (check / warning-triangle / x -- this repo already
imports `lucide-react` icons elsewhere in this file, e.g. `Database`,
`ChevronDown` -- use `Check`, `AlertTriangle`, `X` from the same package
for consistency) sized similarly (`h-3.5 w-3.5`), colored to match the
existing status-to-color mapping (ready=emerald/Check,
not_configured|invalid_config|checking=amber/AlertTriangle,
unavailable=red/X). Add `aria-hidden="true"` on the icon, and an
`sr-only` span carrying `mirrorHealthTitle(mirrorHealth)` (function
already defined at lines 309-324) plus a `title` attribute on the wrapping
element using the same string, per the decision. Do not add an
always-visible text pill (explicitly rejected -- that was Option C).

### #17 -- Status-chip list, weight/saturation NOT color-inversion
View: Landing page
File: `src/components/dashboard/ProjectPhases.tsx` (whole file, 104
lines). Changes:
- Phase 2 block (lines 10-35): replace the emoji tile (`[rocket U+1F680]`, lines 12-14)
  and numbered circles (`1`, `2` badges at lines 22-24, 28-30) with an
  "Active" status chip near the phase heading (solid, saturated,
  stronger border per the resolved color spec -- e.g.
  `bg-sky-600 text-white border-sky-700` or reuse the app's existing
  strong-accent token if one exists) plus plain (non-numbered) bullet
  sub-items for "Matrix Sediment Standards Derivation Options Paper" and
  "BN-RRM Implementation".
- Phase 1 block (lines 40-100): replace the `[check U+2705]` emoji tile (lines 41-43)
  with a "Complete" status chip (muted outline, low saturation, formalize
  the existing `opacity-80`/`grayscale` treatment at line 40-41 rather
  than removing it), replace numbered circles at lines 53-55, 93-95 with
  plain bullets, keep the existing expandable white-paper sub-list
  mechanism (lines 50-89) as-is -- that interaction is not part of this
  decision.
- Do NOT invert green/blue semantics -- do not introduce a blue chip
  color for "Complete" (per the resolution, there is no `--db-*` blue
  token and green already means "approved/complete" elsewhere, e.g.
  `EvidenceLibrary.tsx:387-408` `statusTone`'s `approved` ->
  `emerald`). "Active" gets the stronger/saturated treatment (sky or
  amber, whichever reads clearly as "in progress" against the app's
  existing palette), "Complete" gets a muted/outline treatment -- exact
  hue is an implementation call as long as it is not a saturated green
  chip (which would collide with "approved" semantics) and not a
  fabricated blue-token.

### #19 -- Plain-language lead + technical detail line
View: Conceptual Model
File: `src/components/ConceptualMatrix.tsx` (same file as #3/#9). For each
of the 4 cards (paragraph at lines 24-26, 39-41, 54-56, 69-71), split into
a bold one-line plain-language takeaway (`text-sm font-bold`) followed by
a smaller muted line carrying the technical method names (`text-xs
text-{color}-700/60` or similar, muted relative to the current single
paragraph). Requires writing new copy for 4 cards (roughly doubles copy
per the decision's own estimate) -- this is content authoring, not just
markup; the implementer must draft plain-language takeaways, e.g.
"Protects tiny creatures living IN the mud" / technical line "Equilibrium
Partitioning (EqP), Acid Volatile Sulfide (AVS) normalization".

### #21 -- Delete the restated-tab banner
View: methodology-by-pathway
File: `src/components/MatrixDashboard.tsx`, lines 1378-1385 (`<div
id={JURISDICTIONAL_SIDE_TABPANEL_ID}>` wraps the banner at 1381-1384: the
`bg-sky-50 ... border-l-4 border-sky-500` block). Delete lines 1381-1384
(the inner banner div) only -- confirm the outer `id`-bearing wrapper div
(1378-1380) is still needed for `aria-labelledby`/tabpanel wiring and is
NOT deleted, only its banner child. Note the decision's own text ties
justification partly to "once the #16 heading hierarchy fix lands" -- #16
is OPEN/skipped this batch, so ship #21 now on its OWN merits (sidebar
selected-tab highlight already orients the reader); do not block #21 on
#16.

### #1 (HYBRID) -- 44px touch targets
Three independent sub-parts, three different files:

**1a. Interactive Map -> Option B (44px + always-visible labels)**
File: `src/app/(dashboard)/matrix-map/MatrixMap.tsx`.
- Zoom/layer stack buttons, lines 1602-1685 (`p-2.5` currently ~40px with
  a `w-5 h-5` icon -- bump to a floor of `min-h-[44px] min-w-[44px]`, e.g.
  `p-3`, and verify no visual regression against the export/layers menu
  popover positioning).
- 5-button interaction-mode toolbar, lines 1688-1759: already has
  `sm:inline` labels ("Pan", "Select", "Area", "Identify", "Identify
  Area") gated by `hidden sm:inline` (lines 1701, 1714, 1727, 1742,
  1757) -- drop the `hidden sm:` gating so labels always show, and bump
  each button's `p-2` to a 44px-tall floor including the label (the
  button becomes wider, not just taller -- `flex-col` layout with icon
  above/label below may be needed at narrow widths to keep width sane;
  implementer's call).
- Resolve the top-right overlap this creates between the widened mode
  toolbar (currently `absolute top-4 right-[72px]`) and the zoom stack
  (`absolute top-4 right-4`) on narrow screens: stack them vertically
  (mode toolbar below zoom stack) or wrap the mode toolbar's buttons onto
  a second row below `sm:` breakpoint. This is a REAL layout risk --
  needs a real (not jsdom) viewport check at 375px and ~768px.
- This block (1602-1796) is the SAME block #13 touches (legend panel
  restructure, checkbox relocation). 1a and #13 MUST be implemented
  together / sequentially in one group -- see Partition.

**1b. References & Values pagination + row-expand -> Option C**
File: `src/components/matrix-options/EvidenceLibrary.tsx`.
- Pager: `ValuesPagination` function, lines 492-538 (Prev/Next buttons,
  currently `px-2 py-1` -- well under 44px). The doc's literal "opens a
  labeled list" framing does not map cleanly onto a 2-button pager (there
  is no list to open) -- IMPLEMENTER NOTE / DEVIATION: raise Prev/Next to
  a `min-h-[44px]` floor (e.g. `px-4 py-3`) rather than forcing a
  dropdown that would be a worse UX for 2 actions. If a page-count is
  large enough to want a jump control, a page-number `<select>` MAY be
  added alongside Prev/Next (matching the decision's "matching the
  native `<select>` pattern" instruction) but is not mandatory to satisfy
  the 44px requirement -- flag this deviation in the PR description for
  owner visibility, do not silently reinterpret.
- Row-expand: the `<details><summary>Details</summary></details>` at
  lines 4485-4488 (inside the SAME table block as #5/#6, `colSpan={7}`
  row at 4483-4519+). This is a binary open/close disclosure, not a
  multi-option list either -- same deviation note applies: give the
  `<summary>` a `min-h-[44px] flex items-center` treatment (full-width
  tap target) rather than converting it into a "select" (there is nothing
  to select between).
- This file is ALSO touched by #2, #5, #6 (same table block, overlapping
  line ranges 4367-4488). All of EvidenceLibrary.tsx's table-block work
  (#2's table-wrapper piece, #5, #6, #1b) must land in ONE group to avoid
  merge conflicts on adjacent lines.

**1c. SSD Workbench ToggleButton groups -> Option C**
File: `src/components/matrix-options/SsdWorkbench.tsx`. Convert the
3-across/2-across `ToggleButton` grids to a single full-width 44px
`<select>`-driven control, matching the existing `<select>` pattern the
same file already uses for Analysis mode (line 1286) and Distribution
(line 1301):
- Data source mode (Validation / Upload / ECOTOX mirror), grid at lines
  900-941. NOTE: this grid also contains the #15 status-icon change (line
  917-939, inside the "ECOTOX mirror" `ToggleButton`'s children) -- #1c
  and #15 touch the SAME `ToggleButton` block and MUST land together /
  sequentially in one group.
- Media filter (Water / Sediment), lines 1171-1189.
- Aquatic environment (All / Freshwater / Marine), lines 1191-1221.
- Endpoint filters (dynamic list via `ENDPOINT_OPTIONS.map`), lines
  1223-1238 -- this one is genuinely multi-select (`endpointFilters`
  is an array via `toggleEndpoint`), so it cannot become a single-value
  `<select>`; a `<select multiple>` or a checkbox-list-in-a-details is
  the closest fit. Flag this as a real design gap in the decision (it
  assumes single-select ToggleButton groups; this one is multi-select)
  and implement the least-surprising option: a `<details>`-collapsed
  checkbox list, each checkbox row at a `min-h-[44px]` tap target.
The `ToggleButton` component itself is defined once at line 438 -- if its
own base size can be bumped to satisfy 44px without full select
conversion for some groups, that is a legitimate lighter-touch reading of
"fewer, bigger controls"; the implementer should pick ONE consistent
approach across 1c's groups and note the choice in the PR.

---

## 2. Partition into 3 file-disjoint groups

File-level conflicts found (must be respected):
- `MatrixDashboard.tsx`: #2 (MathRenderer share point only -- see note),
  #8, #21 all touch this file (different, non-adjacent line ranges:
  ~1332-1358 for #8, ~1378-1385 for #21; #2's actual edit to this file is
  none directly -- MathRenderer.tsx is the shared file, MatrixDashboard.tsx
  just consumes it -- so #2 does NOT create a conflict here as long as the
  edit stays inside MathRenderer.tsx).
- `MatrixMap.tsx`: #1a, #12, #13 all touch this file, with #1a and #13
  overlapping the SAME line block (1688-1796).
- `EvidenceLibrary.tsx`: #2 (table wrapper divs), #5, #6, #1b all touch
  the SAME table block (4367-4488) plus the separate pager function
  (492-538).
- `SsdWorkbench.tsx`: #1c and #15 touch the SAME ToggleButton block
  (900-941); #14 touches different, non-adjacent lines (1490-1532,
  1872-1875) in the same file.
- `ConceptualMatrix.tsx`: #3, #9, #19 all touch this whole 77-line file
  end to end -- inherently NOT line-disjoint (every change reshapes the
  same 4 card blocks). This file must be ONE group's exclusive work, done
  as one combined pass (see Group C brief -- implement #3, #9, #19 in a
  single sequence of edits to avoid three separate diffs fighting over
  the same JSX).
- `page.tsx` + `ProjectPhases.tsx`: #10, #11 (page.tsx) and #17
  (ProjectPhases.tsx) are two different files but are both "Landing page"
  and are trivially small -- group with whichever group has spare
  capacity.

Given the above, TRUE file-disjoint partition into exactly 3 groups is not
possible for every pair (MatrixMap.tsx and EvidenceLibrary.tsx each host 3-
4 decisions that must be serialized within themselves). The partition
below assigns EACH FILE to exactly one group -- decisions inside a shared
file are serialized within that group, not parallelized across groups.

### Group A -- Interactive Map
Files (exclusive to this group):
- `src/app/(dashboard)/matrix-map/MatrixMap.tsx`
Decisions: #1a, #12, #13 (implement #12 first -- independent, lines
1563-1588 -- then #1a + #13 together as a single serialized pass over
lines 1688-1796 since they share the block).
Effort: medium-high (the most layout-risk-heavy group; the 44px + label
change genuinely reflows the top-right corner).

### Group B -- References & Values + Guide/Methodology scroll affordance
Files (exclusive to this group):
- `src/components/matrix-options/EvidenceLibrary.tsx`
- `src/components/MathRenderer.tsx`
- `src/components/matrix-options/Phase2GanttChart.tsx`
- `src/components/MatrixDashboard.tsx` (only for #8 and #21 -- both are
  small, non-overlapping edits at lines ~1332-1358 and ~1378-1385; give
  this file to Group B rather than splitting it, since Group B already
  owns the shared `MathRenderer` that #8 depends on)
- NEW: `src/components/ui/ScrollFadeRegion.tsx` (created here, for #2)
Decisions: #2, #5, #6, #1b, #8, #21. Implementation order within the
group: build `ScrollFadeRegion` first (needed by #2's four call sites),
then EvidenceLibrary.tsx's table block as ONE combined pass covering #2's
wrapper additions + #5's sticky column + #6's pill/text-line split + #1b's
pager/row-expand sizing (all in the 492-538 and 4367-4569 ranges), then
Phase2GanttChart.tsx (#2), then MatrixDashboard.tsx (#8, #21 -- unrelated
to each other, any order).
Effort: highest of the three (owns the largest single file and the new
shared component).

### Group C -- SSD Workbench + Conceptual Model + Landing Page
Files (exclusive to this group):
- `src/components/matrix-options/SsdWorkbench.tsx`
- `src/components/ConceptualMatrix.tsx`
- `src/app/page.tsx`
- `src/components/dashboard/ProjectPhases.tsx`
Decisions: #1c, #15, #14 (SsdWorkbench.tsx -- #1c and #15 serialized
together on the 900-941 block, #14 independent); #3, #9, #19
(ConceptualMatrix.tsx -- one combined pass per the note above); #10, #11
(page.tsx -- #11's icon-tile-neutralization overlaps #3's page.tsx note,
serialize together); #17 (ProjectPhases.tsx, fully independent file).
Effort: medium (most files, but each is individually smaller than
EvidenceLibrary.tsx or MatrixMap.tsx).

No decision number needs to be split across groups. No file is written by
more than one group.

---

## 3. Group briefs

### Group A brief -- Interactive Map (`MatrixMap.tsx` only)
1. #12 first: replace the 3 separately-`absolute`-positioned banner divs
   (current: `top-20`/`top-44`/`top-32`, lines 1563-1588) with one
   `absolute top-20 left-4 right-4 z-[1000] flex flex-col gap-2`
   container; each notice renders conditionally in priority order
   (fetch error, aggregate error, refetch error); keep the existing
   dismiss button on refetchError.
2. #13 + #1a together, as one pass over lines 1688-1796:
   a. Move the "Surveyed only" checkbox (currently lines 1785-1794) out
      of the legend panel into the toolbar/filter surface near the
      interaction-mode buttons (1688-1759) or the sample-count header
      (1798+) -- pick whichever placement keeps it visually grouped with
      other filter-like controls; it must stay ALWAYS VISIBLE (not
      inside the new collapsible).
   b. Wrap what remains at 1762-1784 (classification legend, coordinate-
      quality legend, site-aggregate note) in a collapsible: collapsed
      by default on mobile, open by default at `md:`+ (this component
      already tracks an `isMobile`-like signal -- reuse it, do not add a
      second breakpoint mechanism).
   c. Add a 44px floor to every zoom/layer button (1602-1685) and to the
      5 interaction-mode buttons (1688-1759): drop the `hidden sm:`
      label gating (lines 1701, 1714, 1727, 1742, 1757) so labels always
      show; resolve the top-right overlap between the now-wider mode
      toolbar (`right-[72px]`) and the zoom stack (`right-4`) by either
      stacking the mode toolbar BELOW the zoom stack or wrapping its
      buttons onto two rows under a narrow-viewport breakpoint.
Done = at 375px width, no control is under 44px in either dimension, all
5 mode-toolbar labels are visible without truncation or overlap with the
zoom stack, the "Surveyed only" checkbox is reachable outside the
collapsed legend, and the legend collapses/expands correctly at the
mobile/desktop boundary. Both themes must render correctly (map chrome
uses `dark:` variants throughout -- keep them on every new/changed class).

### Group B brief -- References & Values + shared scroll affordance + 2 MatrixDashboard fixes
1. Build `src/components/ui/ScrollFadeRegion.tsx`: a client component
   taking `children` and rendering a wrapper `div` with `relative
   overflow-x-auto`, a `useEffect`/`ResizeObserver` that toggles a
   `hasOverflow` boolean by comparing `scrollWidth > clientWidth` on the
   scroll container, and (only when `hasOverflow`) a trailing gradient
   mask (`absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white
   dark:from-slate-900 to-transparent pointer-events-none`) plus a small
   caption ("Swipe to see more" / "Scroll to see more") below the region.
   Keep it themeable (light/dark gradient stops) and keep the caption
   text conditional on `hasOverflow` too (it should disappear once
   content fits, per the decision).
2. Use it in: `MathRenderer.tsx` (wrap the math-display and table-wrapper
   divs, ~lines 65 and 73), `Phase2GanttChart.tsx` (wrap the `<figure>`
   at line 97), and `EvidenceLibrary.tsx` (wrap the two
   `overflow-x-auto` divs at lines 4367 and 4585).
3. In `EvidenceLibrary.tsx`, do the Parameter Values table block
   (492-538, 4367-4569) as one combined pass:
   - #5: sticky-left the Parameter column (`<th>`/`<td>` at 4383 and
     4436-4443) with `sticky left-0 z-10` + matching row-hover/selected
     background classes + a right-edge shadow divider.
   - #6: in the "Default / evidence" cell (4460-4467), keep only
     `evidence_support_status` as the colored `StatusBadge`; render
     `default_status`, `qa_status`, `extraction_status` as one muted
     plain-text line beneath it.
   - #1b: raise `ValuesPagination`'s Prev/Next buttons (492-538) to a
     44px floor; raise the row-expand `<summary>` (4485-4488) to a
     44px-tall full-width tap target. Note the deviation from a literal
     "opens a labeled list" reading in the PR description (see #1b spec
     above for why).
4. In `MatrixDashboard.tsx`:
   - #8: in `renderToolReference()` (1332-1358), replace the raw
     `<pre>{eq.equation_latex}</pre>` at line 1342-1344 with a
     `MathRenderer` render of `$$${eq.equation_latex}$$`. Confirm no
     horizontal overflow in the drawer at its real rendered width; wrap
     in `ScrollFadeRegion` if it does.
   - #21: delete the banner div at lines 1381-1384
     (`bg-sky-50 ... border-l-4 border-sky-500 ...`); keep the outer
     wrapper div (1378-1380) intact for its `id`/`aria-labelledby` wiring.
Done = every touched `overflow-x-auto` region shows the fade+caption only
when content actually overflows (verify by shrinking viewport, not by
reading code), the Parameter column stays legible while scrolling
horizontally on a 375px viewport, the 4-pill row is now 1 pill + 1 text
line, Prev/Next and the row-expand summary are >=44px tall, the drawer
equation renders typeset (not raw LaTeX source), and the sky banner is
gone with the tab panel still correctly labelled for a11y.

### Group C brief -- SSD Workbench, Conceptual Model, Landing Page
1. `SsdWorkbench.tsx`:
   - #1c + #15 together on the "ECOTOX mirror" `ToggleButton` block
     (900-941): pick ONE approach for converting the Data source mode /
     Media filter / Aquatic environment 3-across-or-fewer grids to
     44px-floor full-width controls (either enlarge `ToggleButton` itself
     to 44px, or convert to `<select>`s matching lines 1286/1301's
     pattern -- state the choice once and apply it consistently across
     all three single-select groups). Endpoint filters (1223-1238) stay
     multi-select -- use a `<details>`-collapsed 44px-row checkbox list
     instead of a `<select>`. Inside the ECOTOX mirror option specifically,
     replace the status dot (919-938) with a `Check`/`AlertTriangle`/`X`
     lucide icon (`aria-hidden`), add a `title` + `sr-only` span using
     `mirrorHealthTitle(mirrorHealth)` (defined at 309-324).
   - #14: remove the badge at 1872-1875; add a "Mirror corpus size" row
     to the "Current source" `<dl>` inside the Validation-and-
     verification panel (read 1478-1532 first to see the existing `<dl>`
     shape and match its row style), visually separated from any
     existing "Rows used" row.
2. `ConceptualMatrix.tsx` -- one combined pass (#3 + #9 + #19 together,
   since all three reshape the same 4 card blocks):
   - Add a small 2x2 legend diagram (4 colored squares + axis labels,
     numbered 1-4, no prose) above the card grid.
   - Convert each card from a fully-tinted surface to a neutral surface
     (`bg-white dark:bg-slate-800`) with a `border-t-4` top border in one
     of 2 colors keyed to Ecological vs Human Health (collapse from 4
     hues to 2), plus a small numbered badge matching the legend.
   - Split each card's single paragraph into a bold plain-language
     takeaway line + a smaller muted technical-terms line. Draft new
     copy for all 4 cards.
3. `page.tsx`:
   - #10: drop the hero gradient (line 20), left-align the title, replace
     the emoji status pill (29-33) with a plain mono status line, keep
     description short.
   - #11: neutralize the 3 nav-card icon-tile backgrounds (lines 82, 97,
     112) to one consistent neutral style; keep emoji and the 3-card
     grid structure; do not add header navigation to this page.
4. `ProjectPhases.tsx` (independent of the above 3):
   - #17: replace emoji tiles + numbered circles with "Active"/"Complete"
     status chips (Active = solid/saturated/stronger border; Complete =
     muted/outline/low-saturation, formalizing the existing
     `opacity-80`/`grayscale`); plain (non-numbered) bullets for
     sub-items; no color inversion, no fabricated blue token, do not
     reuse a saturated-green chip for "Complete".
Done = SSD Workbench's 3+1 control groups are all >=44px tall with no
loss of the multi-select capability on Endpoint filters; the mirror
status icon reads correctly with a screen reader (title + sr-only text
present, decorative icon `aria-hidden`); the corpus-size badge is gone
from the chart card and present in the verification panel; the 4
Conceptual Model cards show a 2x2 legend, neutral+top-border chrome, and
2-line copy; the landing hero has no gradient/emoji/pill; the 3 nav cards
share one icon-tile style; ProjectPhases shows chips not circles/emoji
with the resolved (non-inverted) color treatment.

---

## 4. Test plan per group

General note: jsdom (Vitest/Testing Library, this repo's `test:ci`) has NO
layout engine -- it cannot measure real pixel heights/widths, cannot
detect `scrollWidth > clientWidth` overflow, cannot verify sticky
positioning renders correctly, cannot verify 44px tap targets visually,
and cannot verify the top-right toolbar overlap in Group A. Every
responsive/visual claim in this plan (44px sizing, scroll-fade visibility,
sticky-column behavior, toolbar overlap resolution, legend collapse
breakpoint) needs a REAL BROWSER check -- Playwright, run at both a phone
viewport (375px, matching the existing
`e2e/matrix-options-phone-layout.spec.ts` pattern) and a desktop
viewport. jsdom unit tests can verify: DOM structure/text content, ARIA
attributes present, conditional rendering logic (e.g. the notice column
renders 0/1/2/3 children correctly for #12; the pill vs text-line split
for #6; the `sr-only`/`title` text for #15), and that click handlers still
fire (button/select `onChange` wiring for #1's converted controls).

### Group A (MatrixMap.tsx)
- Existing coverage: `src/app/(dashboard)/matrix-map/__tests__/MatrixMap.test.tsx`
  plus `src/components/matrix-options/__tests__/MatrixMapLeftPanel.test.tsx`,
  `MatrixMapRightPanel.test.tsx`, `MatrixMapSelectionStats.test.tsx`,
  `MatrixMapStatsShell.test.tsx`, `MatrixMapMobileFallback.test.tsx` --
  read these before editing to see if any assert on the OLD 3-banner
  markup, the old legend structure, or the old `hidden sm:inline` label
  classes; update assertions that hard-code removed classes/structure.
- jsdom-testable: #12's conditional rendering (mock `fetchErrorMessage`/
  `siteAggregateFetchErrorMessage`/`refetchError` combinations, assert
  correct child count and order in the new flex column); #13's checkbox
  relocation (assert the "Surveyed only" `input[aria-label="Show surveyed
  locations only"]` exists OUTSIDE the collapsible's DOM subtree and is
  always rendered regardless of collapse state); #1a's label presence
  (assert the 5 mode-toolbar buttons' text content includes "Pan",
  "Select", "Area", "Identify", "Identify Area" unconditionally -- this
  DOES catch a regression of the `hidden sm:` removal even though it
  can't verify visual layout).
- Needs a browser (new or extended Playwright spec): 44px `boundingBox()`
  checks at 375px on the zoom stack and mode-toolbar buttons; visual
  non-overlap between the mode toolbar and zoom stack at 375px (assert
  bounding boxes do not intersect); legend collapsed at 375px / expanded
  at >=768px (assert `<details open>` state or computed height).

### Group B (EvidenceLibrary.tsx, MathRenderer.tsx, Phase2GanttChart.tsx, MatrixDashboard.tsx, new ScrollFadeRegion.tsx)
- Existing coverage: `src/components/matrix-options/__tests__/EvidenceLibrary.test.tsx`,
  `EvidenceLibrary.pagination.test.tsx` (this one almost certainly
  hard-codes Prev/Next button assertions -- read it before touching
  `ValuesPagination`), `Phase2GanttChart.test.tsx`,
  `src/components/__tests__/MatrixDashboard.test.tsx`. No existing
  `MathRenderer.test.tsx` or `ScrollFadeRegion.test.tsx` found -- write
  new unit tests for `ScrollFadeRegion` (mock `scrollWidth`/`clientWidth`
  on the container ref since jsdom reports 0 for both by default; assert
  the fade+caption render only when the mocked values indicate overflow).
- jsdom-testable: #6's pill/text-line split (assert exactly one
  `StatusBadge`-rendered element plus a text node containing the other 3
  statuses, per row); #5's sticky classes present on the Parameter
  `<th>`/`<td>` (class-list assertion only, not actual stickiness); #8's
  drawer content (assert the raw `equation_latex` string is NOT present
  as literal pre-formatted text and that a MathRenderer/KaTeX output
  container IS present); #21 (assert the sky banner text/class is gone,
  the tabpanel `id`/`aria-labelledby` pairing still resolves).
- Needs a browser: the scroll-fade actually appearing/disappearing on
  real overflow (mock-based jsdom tests only prove the component's
  branching logic, not real overflow detection); the sticky column
  actually staying pinned while scrolling horizontally at 375px; the
  KaTeX-rendered equation not overflowing the drawer's real rendered
  width (#8's stated risk).

### Group C (SsdWorkbench.tsx, ConceptualMatrix.tsx, page.tsx, ProjectPhases.tsx)
- Existing coverage: `src/components/matrix-options/__tests__/SsdWorkbench.test.tsx`
  (almost certainly asserts on `ssd-ecotox-status-dot` `data-testid` --
  grep it first; #15 removes that dot entirely, so this test needs an
  update, not just a passive pass-through -- update the testid to
  whatever the new icon element carries, or add a new one, and update
  the assertion to check for the icon + `sr-only` text instead of a
  colored dot). No `ConceptualMatrix.test.tsx`, `ProjectPhases.test.tsx`,
  or `page.test.tsx` exist -- these three views currently have ZERO
  component-level test coverage; adding basic render + content-presence
  tests for all three is in scope as part of "done" for this group (not
  strictly required by the decisions doc, but is the only way to jsdom-
  verify #3/#9/#17/#19's DOM changes at all going forward).
- jsdom-testable: #15's icon + sr-only text present for each mirror
  health status (parametrize over the `MirrorHealthState` variants);
  #1c's `<select>`/checkbox-list `onChange` wiring still updates the
  same state (`dataSourceMode`, `mediaFilter`, `environmentFilter`,
  `endpointFilters`) as before -- these are pure state-wiring assertions,
  fully testable without layout; #14's badge removed from the chart card
  and the new `<dl>` row present with the same `OWNER_REPORTED_ECOTOX_ROWS`
  value; #9's 4 numbered badges present and matching the legend's 4
  numbers/colors (text/attribute assertion); #19's two-line split present
  per card (assert both a "lead" and "detail" text node exist per card);
  #17's chip text ("Active"/"Complete") present, no emoji character
  present in the rendered output, no fabricated blue class name present
  (e.g. assert absence of a literal `bg-blue-` class if the implementer
  is tempted to add one).
- Needs a browser: #1c's 44px floor on the converted controls; #3's
  top-border-only chrome rendering distinctly from a filled card (mostly
  a visual/design-taste check, but if a real screenshot diff tool is
  available, use it); general light/dark screenshot comparison for all 4
  files given the theming risk below.

---

## 5. Risk section

**Forbidden -- do not touch under this batch, in any group:**
- Any calculation, regulatory value, unit, rounding rule, or numeric
  default. The only numeric-adjacent touch in this batch is #14's
  `OWNER_REPORTED_ECOTOX_ROWS` (582,125) -- its VALUE and its
  `.toLocaleString()` formatting must not change, only where on the page
  it renders. If any group's edit touches `src/lib/matrix-options/**`,
  `src/lib/agentic-os/**`, any `defaultSelectionPolicy.ts`,
  `provenance/**`, or any `*.sql`/`supabase/migrations/**` file, STOP --
  that is out of this batch's scope entirely (per repo CLAUDE.md: no
  catalog mutation, no v2_judgments writes, no default-policy promotion).
- `evidence_support_status`, `default_status`, `qa_status`,
  `extraction_status` VALUES and their `statusTone()`/color-mapping logic
  (lines 387-409 of `EvidenceLibrary.tsx`) are read-only inputs to #6 --
  #6 changes which pill is PROMOTED to visible, not what the statuses
  mean or how they're colored.

**Theming (hard constraint -- both `.light` and `.dark` must keep
working, per `ThemeContext`):**
- Every new/changed Tailwind class in every group needs its `dark:`
  counterpart. This repo does not consistently use the `--db-*` CSS
  variable set found in `globals.css` (lines ~285-395) inside the
  components this batch touches -- those components use direct Tailwind
  color utilities (`slate`/`sky`/`emerald`/`amber`/etc.) with explicit
  `dark:` variants throughout. Follow that EXISTING pattern (Tailwind
  utility + `dark:` variant), do not introduce `--db-*` var usage into
  these files as a one-off (that would create a second, inconsistent
  theming mechanism inside the same view).
- #17 is the one decision where a hue choice could DRIFT into the
  `--db-pass` (green/emerald = approved/complete) semantic collision the
  owner explicitly rejected. Re-read the resolution text before picking
  colors: no color inversion, no green "Active" chip, no fabricated blue
  token.
- #10's hero background change (dark gradient -> plain surface) needs its
  child text colors (`text-sky-200`, `text-sky-100`, `text-white`)
  re-derived for a light surface in light mode AND a correspondingly
  readable set in dark mode -- verify contrast in both, not just one.
- #3's card-chrome flattening (tinted surface -> neutral + top border)
  must keep sufficient dark-mode contrast on the top-border color against
  a `dark:bg-slate-800` surface -- test both themes, not just light.

**Responsive-shell regression risk (the D3 fix just merged, see
`e2e/matrix-options-phone-layout.spec.ts`'s own comments):**
- That spec guards a SPECIFIC bug class: an unscoped `overflow-y-auto` on
  a flex-1 column collapsing to near-zero height at a phone viewport due
  to CSS Flexbox 4.5 automatic-minimum-size. None of this batch's changes
  add a new `overflow-y-auto` to a flex column, but Group A's #1a/#13
  changes DO add new flex/wrap behavior to the map's toolbar rows and a
  new collapsible to the legend panel -- if either introduces its own
  unscoped `overflow-y-auto`/`overflow-auto` on a flex item, re-read that
  spec's comments before assuming it's safe; consider adding an
  equivalent phone-viewport assertion for the map view specifically,
  since the existing spec only covers the Calculator tab, not matrix-map.
- Group B's new `ScrollFadeRegion` wraps content in `overflow-x-auto`
  (horizontal, not vertical) -- lower risk of the same bug class, but
  verify it does not accidentally clip vertical content if any wrapped
  region (e.g. the Gantt figure) has variable height content.

**Ambiguity flagged during planning (see decision write-ups above for
full detail, not repeated here):**
- #1b (pager + row-expand) and #1c (Endpoint filters) both ask for a
  "select"/"list" treatment that does not literally fit a 2-button pager,
  a binary disclosure, or a multi-select filter group. Implementers must
  make a documented judgment call rather than force a literal
  `<select>` where the underlying interaction does not have discrete,
  single-choice options -- see each sub-section above for the
  recommended fallback.
- #3's application to "The Guide" specifically could not be confirmed
  against `.tsx` source (The Guide's content likely lives in markdown
  rendered through `MathRenderer`) -- Group B/C's implementer should
  verify before claiming this sub-part done; if the color-coded chrome
  lives in markdown content rather than component code, mark it NO-OP
  with evidence (grep result) in the PR description rather than silently
  skipping it.
