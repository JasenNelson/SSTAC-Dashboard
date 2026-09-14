# UI/UX Audit Round 2 -- Part 2: Interactive Map, The Guide, Methodology by pathway, TWG Review

Worktree read: `C:\Projects\SSTAC-Dashboard-worktrees\triage-20260816`
Findings-only. No source file was modified, no gate/build/dev server was run.

Contrast ratios below were computed from the ACTUAL Tailwind v4 palette in
`node_modules/tailwindcss/theme.css` (oklch source values converted to sRGB, then WCAG relative
luminance), not from the Tailwind v3 hex table. The v4 values differ from v3 in ways that matter
here (v4 `slate-400` is `#90a1b9`, v4 `rose-600` is `#ec003f`).

---

## Interactive Map

### Summary

The map surface is in better shape than its size suggests: the two collapsible panel wrappers
already carry `inert`, every floating toolbar button clears the 44px floor and carries a visible
text label, the three async surfaces (initial fetch, viewport refetch, measurement RPC) each have a
distinct error state, and `formatCell` is a bare `String(value)` with no rounding anywhere on the
measurement path. Below 768px the whole desktop layout is replaced by `MatrixMapMobileFallback`, so
the 375px overflow risk the brief anticipated does not exist here -- the real mobile defect is a
false claim inside that fallback's own copy. The substantive problems are three: a `boolean | null`
censoring flag rendered as a two-state string, the Value column sitting past the horizontal fold of
a raw (non-`ScrollFadeRegion`) scroller at the panel's default width, and a consistent
`text-slate-400 / dark:text-slate-500` chrome pairing that fails contrast in both themes on exactly
the provenance and station-identity text.

### Findings

#### Null censoring status is rendered as the affirmative "Detected"

Severity: P1
Type: DEFECT
Location: `src/components/matrix-options/MatrixMapRightPanel.tsx:855` (with `:933`)

Evidence:

```
// :933  normalizer -- three-state on purpose
censored: typeof row.censored === 'boolean' ? row.censored : null,

// :855  renderer -- two-state
<td className="px-2 py-2 text-slate-600 dark:text-slate-300">{row.censored ? 'Censored' : 'Detected'}</td>
```

The normalizer deliberately preserves `null` for "the RPC did not supply a censoring flag" (the same
file goes to visible trouble to preserve `null` for the neighbouring date field, `:917-923`, with a
comment explaining why). The renderer then collapses `null` into the same branch as `false` and
prints `Detected`. Every adjacent nullable column in the same row degrades honestly instead
(`row.unit ?? ''` at `:853`, `row.qualifier ?? ''` at `:854`, `row.source_dra_title ?? ... ?? ''` at
`:857`); this is the one column that substitutes a positive assertion for a missing value.

Why it matters: "Detected" versus "non-detect / censored" changes how a concentration may be used in
a derivation. A row with unknown censoring status is presented to the reviewer as a confirmed
detection, with nothing in the UI distinguishing it from a row where the RPC actually said `false`.

#### The Value column is past the horizontal fold at the panel's default width, in a scroller with no overflow affordance

Severity: P2
Type: DEFECT
Location: `src/components/matrix-options/MatrixMapRightPanel.tsx:804-812`

Evidence:

```
// :807  the scroll container -- a plain div, NOT ScrollFadeRegion
'min-h-[260px] flex-1 overflow-auto rounded-lg border border-slate-200 dark:border-slate-700',
// :812
<table className="min-w-[1080px] text-left text-xs">
```

`MATRIX_MAP_RIGHT_PANEL_DEFAULT_WIDTH = 480` (`src/components/matrix-map-panel-layout.ts:19`), and
the panel body adds `p-4` (`MatrixMapRightPanel.tsx:275`), leaving roughly 448px of content box for
a table whose declared minimum is 1080px -- about 41% of the table is visible. `TABLE_HEADERS`
(`:33-44`) orders the columns `Sample, Date, Medium, Substance, Value, Unit, DL Flag, Censoring,
Coord Quality, Source DRA`: Value is column 5 and Unit is column 6, i.e. the first two columns past
the ~4 columns that fit. Every other overflowing table in this codebase is wrapped in
`ScrollFadeRegion`, which paints an edge gradient plus a "Swipe to see more" caption when
`scrollWidth > clientWidth` (`src/components/ScrollFadeRegion.tsx:193-216`); this one is a bare
`overflow-auto` div, so there is no gradient, no caption, and `scrollbar-gutter: stable both-edges`
(`:810`) makes the scrollbar itself a permanent fixture rather than a change-of-state cue.

Why it matters: the default state of the Measurement Workbench shows station, date, medium and
substance while hiding the number and its unit, and gives the reader no indication that a value
column exists to the right.

#### Measurement table rows are click-only

Severity: P2
Type: DEFECT
Location: `src/components/matrix-options/MatrixMapRightPanel.tsx:830-836`

Evidence:

```
<tr
  key={rowKey}
  className={cn(
    'cursor-pointer bg-white hover:bg-blue-50 dark:bg-slate-950 dark:hover:bg-blue-950/40',
    active && 'bg-blue-50 dark:bg-blue-950/40',
  )}
  onClick={() => onRowClick(row)}
>
```

No `role`, no `tabIndex`, no `onKeyDown`. The handler is not decorative -- `onRowClick`
(`:375-378`) sets `activeRowKey` and calls `requestPanToSample(row.sample_id)`, which recentres the
map on that station. There is no alternative control in the table that performs the same action.

Why it matters: recentring the map on the station behind a measurement is the workbench's primary
row-level action and it is unreachable without a pointer.

#### "Override their classification here" looks like a link and does nothing

Severity: P2
Type: DEFECT
Location: `src/components/matrix-options/MatrixMapLeftPanel.tsx:94-105`

Evidence:

```
{unknownCount} selected {unknownCount === 1 ? 'station has' : 'stations have'} unclassified status and are EXCLUDED from UTL computation.
{' '}
<span className="font-semibold underline decoration-dotted">
  Override their classification here
</span>
{' '}
to include.
```

A `<span>` with `underline decoration-dotted` and `font-semibold`, carrying the word "here" -- link
affordance, link copy, no `onClick`, no `href`, no `button`, and no override control anywhere else
in the panel.

Why it matters: the sentence it sits in tells the reader that some of their selected stations are
being dropped from the UTL calculation and offers a remedy that does not exist. A reader who clicks
and gets nothing has no way to distinguish "the control is broken" from "I clicked the wrong part of
the sentence", and the exclusion silently stands.

#### Map chrome uses a slate-400 / slate-500 pair that fails contrast in both themes, including on station identity and coordinate provenance

Severity: P2
Type: DEFECT
Location: `src/app/(dashboard)/matrix-map/MatrixMap.tsx:1860`, `:1866`, `:1905`, `:1939`, `:1952`,
`:1991`, `:1692`, `:1711`

Evidence: the repeated class pairing is `text-slate-400 dark:text-slate-500` on card surfaces
declared `bg-white dark:bg-slate-800` (the legend at `:1833`, the count card at `:1881`, the sample
list at `:1924`, the layer menu at `:1690`). Computed from the Tailwind v4 palette:

- light: `slate-400` `#90a1b9` on `white` `#ffffff` = **2.63:1** (need 4.5:1)
- dark: `slate-500` `#62748e` on `slate-800` `#1d293d` = **3.07:1** (need 4.5:1)

All the affected text is 10-12px, so none of it qualifies for the 3:1 large-text allowance. The
specific strings:

- `:1905` -- "Most plotted locations (~98.5%) are approximate BC CSR site centroids, not surveyed
  sediment coordinates."
- `:1866` -- "Centroid = approximate BC CSR parcel location, not a surveyed point."
- `:1860` -- the "Coordinate quality" legend group label
- `:1991` -- `{sample.station_id} -- {lat.toFixed(4)}, {lng.toFixed(4)}` for every row of the
  sample list
- `:1939` -- "Shift+click add, Ctrl+click remove", the only place multi-select is documented
- `:1952` -- the "Clear" button label (an interactive control at 2.63:1)
- `:1692`, `:1711` -- the layer menu's "Base Map" and per-category group headings

Why it matters: `:1905` and `:1866` are the disclosure that ~98.5% of plotted points are parcel
centroids rather than surveyed sediment positions. That caveat is the difference between a map a
reader trusts positionally and one they do not, and it is set at the lowest contrast on the page.

#### Sample popup coordinate-quality caption is hardcoded #94a3b8 on white

Severity: P3
Type: DEFECT
Location: `src/app/(dashboard)/matrix-map/MatrixMap.tsx:2202`

Evidence:

```
<p style="font-size: 10px; color: #94a3b8; margin: 2px 0 0; font-style: italic;">${tierCaption}</p>
```

`#94a3b8` on the Leaflet default popup background (`#ffffff`; verified that no `.leaflet-popup-*`
override exists for this map -- the only Leaflet dark overrides in `src/app/globals.css:500-509` are
scoped to `.bn-rrm-wrapper`, and `MatrixMap` is not inside it) computes to **2.59:1**, at 10px
italic. The line directly above it (`:2201`, `#64748b`, 4.79:1) passes.

Why it matters: `tierCaption` is the per-point explanation of whether that marker is a surveyed
coordinate or a parcel centroid -- the same provenance disclosure as the legend finding above,
repeated in the popup and set even lighter.

#### The mobile fallback tells the user TWG Review is fully usable on their phone

Severity: P2
Type: DEFECT
Location: `src/components/matrix-options/MatrixMapMobileFallback.tsx:37-40`

Evidence:

```
<p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
  The other Matrix Options tabs (Guide, Vision for Modernizing Schedule 3.4,
  Methodology by pathway, TWG Review, Calculator) are fully usable on this device.
</p>
```

This banner renders only when `useIsMobile()` is true, i.e. viewport `<= 767px`
(`src/hooks/useIsMobile.ts:19,26`). At those widths the TWG Review tab collapses its document column
to zero width -- see the TWG Review section below, finding "TWG Review document column is squeezed to
zero width below 704px".

Why it matters: the one piece of copy in the product that tells a phone user where to go instead
sends them to the one tab that is measurably broken at that width.

#### Map loading state has no dark-mode surface

Severity: P3
Type: DEFECT
Location: `src/app/(dashboard)/matrix-map/MatrixMapLoader.tsx:39-40`

Evidence:

```
<div className="flex h-full w-full items-center justify-center bg-slate-50">
  <div className="flex items-center gap-3 text-slate-500">
```

`bg-slate-50` and `text-slate-500` with no `dark:` counterpart, while every sibling surface in the
map tree pairs them. In dark mode this paints a full-bleed near-white panel for the duration of the
Leaflet chunk load, then swaps to the dark map.

Why it matters: it is the only unthemed surface on the tab, and it occupies the entire map area
during the load. Not a data problem -- the spinner does have accompanying "Loading map..." text, so
it is not a bare spinner.

---

## The Guide

### Summary

`The_Guide.md` is 37 lines with exactly one `^# ` heading, zero tables, zero fenced code, zero
links and zero math, so the whole `MathRenderer` risk surface (table clipping, KaTeX overflow,
inline-code contrast, link contrast) is simply not exercised by this tab -- I checked rather than
assumed. `demoteLeadingH1` at the call site fully covers this document. Padding is already
responsive (`p-4 lg:p-8` on the cards, `px-4 py-8 lg:px-8 lg:py-12` on the measure), body text is
`text-slate-800 / dark:text-slate-200` at 11.8:1 on the card surfaces, and the section cards stack
cleanly at 375px. The two findings are both about the boundary-split mechanism rather than about
rendering.

### Findings

#### The section-boundary split silently discards any part after the third

Severity: P3
Type: DEFECT
Location: `src/components/MatrixDashboard.tsx:1425-1428` (rendered at `:1441-1456`)

Evidence:

```
const guideParts = guideContent.split('<!-- SECTION_BOUNDARY -->');
const introContent   = guideParts[0] || '';
const section1Content = guideParts[1] || '';
const section2Content = guideParts[2] || '';
```

Three hardcoded indices, no `slice(3)`, no `.map()` over the remainder, no length check.
`The_Guide.md` currently contains exactly 2 boundary markers (verified: `grep -c 'SECTION_BOUNDARY'`
= 2), producing exactly 3 parts, so the code and the content agree today by coincidence of count. A
third marker added by an author makes part index 3 vanish from the page with no error, no warning
and no visual gap -- the preceding cards render normally.

Why it matters: this is a content-authoring surface where the failure mode is invisible. The author
adds a section, the page keeps rendering, and nobody sees that the last section is gone.

#### File-read failure renders as ordinary body prose, not an error state

Severity: P3
Type: DEFECT
Location: `src/app/(dashboard)/matrix-options/page.tsx:44-53`, consumed at
`src/components/MatrixDashboard.tsx:1445`

Evidence:

```
// page.tsx :52
return `Error loading ${filename}.`;
```

That string is passed straight into `demoteLeadingH1(...)` and then into `MathRenderer`, where it
renders as a plain `<p>` styled `[&>p]:mb-5 [&>p]:leading-relaxed` inside the normal white section
card. There is no error border, no icon, no colour, and no retry. Sections 1 and 2 then evaluate
falsy in the `{section1Content && ...}` guards at `:1447` and `:1452`, so the tab shows a single
card containing one grey sentence, followed by the Phase 2 tasks card, which reads as a very short
guide rather than a failure.

Why it matters: the same helper feeds the Methodology documents (`:66-69` of `page.tsx`) and the
TWG paper, so the pattern is shared. Compare the map tab, which has a real amber error notice
(`MatrixMap.tsx:1602`).

---

## Methodology by pathway (internal tab name: Jurisdictional Frameworks)

### Summary

I verified each of the three source documents rather than assuming: `CaseStudy_BSAF.md`,
`CaseStudy_EqP_AVS.md` and `Framework_HumanHealth.md` each contain exactly ONE `^# ` heading, at
line 1, so `demoteLeadingH1` at `MatrixDashboard.tsx:1421` fully resolves the duplicate-h1 defect
for this tab -- there is no residual mid-document `# ` here. None of the three contains a table or a
fenced code block; `CaseStudy_BSAF.md` has 2 markdown links and the other two have none. The side-tab
roving tabindex is implemented correctly (`:1150-1174`, automatic activation, `tabIndex={selected ?
0 : -1}`, `aria-controls` pointing at a real panel id) and the panel carries matching `role`/`id`/
`aria-labelledby`. The one real problem is that the document's scroll container is not reachable by
keyboard on two of the three side-tabs.

### Findings

#### The document scroll region has no keyboard entry point on two of the three pathway tabs

Severity: P3
Type: DEFECT
Location: `src/components/MatrixDashboard.tsx:2105-2113`

Evidence:

```
'flex-1 relative p-4 lg:overflow-y-auto lg:p-8',
...
role="tabpanel"
id={PRIMARY_TABPANEL_ID}
aria-labelledby={primaryTabId(activeTopTab)}
tabIndex={-1}
```

At `lg` and up this div is the scroller for the Methodology document. It is hardcoded
`tabIndex={-1}`. Its content for this tab is `renderContent()`'s Jurisdictional Frameworks case
(`:1402-1423`), which renders nothing but `MathRenderer` prose. `Framework_HumanHealth.md` and
`CaseStudy_EqP_AVS.md` contain zero links and zero tables, so that subtree has zero focusable
descendants -- there is nothing to Tab to inside the scroller and the scroller itself refuses focus.
The file's own comment for the sibling non-tool branch (`:2302-2315`) reasons about exactly this
tradeoff and concludes `tabIndex={0}` is required when a tabpanel has no focusable children; that
reasoning was not applied to the `isToolMode` branch.

Caveat, stated honestly: Chrome 127+ makes an overflow container with no focusable children
implicitly tabbable (this codebase documents that behaviour at
`src/components/ScrollFadeRegion.tsx:36-39`), which masks the problem in Chrome. It is not masked in
Firefox or Safari, and on the BSAF tab -- which does have 2 links -- Chrome's heuristic does not
apply either.

Why it matters: a keyboard user on the two link-free pathways cannot scroll the methodology document
at all on a desktop viewport.

#### Demoted document titles now share heading level 2 with the rails' structural labels

Severity: P3
Type: DESIGN CHOICE
Location: `src/components/MatrixDashboard.tsx:1421` (demotion) vs `:2065-2074` (left rail `<h2>`)
and `:2199-2220` (right rail `<h3>`)

Evidence: after `demoteLeadingH1`, "Case Study: Ecological Direct Contact (EqP & AVS/SEM)" is an
`<h2>` styled by `MathRenderer.tsx:89` (`text-2xl font-bold`, `border-b`). The left rail's
`leftSidebarHeading` -- the literal string `PATHWAY / APPROACH` (`:1310`) -- is also an `<h2>`,
styled `text-xs font-bold uppercase`. Both sit under the shell's single `<h1>Matrix Options</h1>`
(`:1847`), and the rail's h2 precedes the document's h2 in DOM order.

Why it matters: a screen-reader heading walk presents the layout label and the document title as
peers, with the layout label first. This is a consequence of the (correct) call-site demotion
approach, not a bug in it -- the alternatives (make the rail label an `h3`, or drop the document's
leading title entirely and rely on the tab name) are owner-judgment calls about how much heading
structure the shell should own.

---

## TWG Review

### Summary

This is the weakest of the four views and the only one with a P1. The portal's two rails are hard
`w-80` / `w-96` with `flex-shrink-0` and no breakpoint scoping at all, inside a shell branch that is
`flex ... overflow-hidden` with no responsive stacking -- 704px of non-shrinkable chrome in a 375px
box, which squeezes the document column to zero and clips it. Separately, both rails collapse to
`w-0 overflow-hidden` WITHOUT `inert`, which is precisely the defect that was already fixed at four
other collapse sites in `MatrixDashboard.tsx`; this portal was missed. On the known duplicate-h1
item: I checked the source document and it has a SECOND `^# ` mid-document, which changes the fix.

### Findings

#### TWG Review document column is squeezed to zero width below 704px

Severity: P1
Type: DEFECT
Location: `src/components/TWGReviewPortal.tsx:234`, `:258`, `:290`; shell branch at
`src/components/MatrixDashboard.tsx:2228-2237`; defaults at `:340-341`

Evidence:

```
// MatrixDashboard.tsx :2229-2230  -- the isReviewMode branch. No lg: scoping, no flex-col.
<div
  className="flex-1 flex overflow-hidden print:block print:overflow-visible print:h-auto"

// TWGReviewPortal.tsx :234  -- left TOC rail
'transition-all ... overflow-hidden flex-shrink-0 ... flex flex-col print:hidden', showLeftPanel ? 'w-80' : 'w-0'

// TWGReviewPortal.tsx :290  -- right comments rail
'transition-all ... overflow-hidden flex-shrink-0 ... flex flex-col relative print:hidden', showRightPanel ? 'w-96' : 'w-0'

// TWGReviewPortal.tsx :258  -- the document column
<div className="flex-1 relative overflow-y-auto bg-white dark:bg-slate-950 px-8 py-10 sm:px-12 ...">
```

Arithmetic at a 375px viewport: `w-80` = 320px plus `w-96` = 384px = **704px** of `flex-shrink-0`
chrome. The document column at `:258` is `flex-1` with `overflow-y-auto`; because its overflow is
not `visible`, CSS Flexbox 4.5 resolves its automatic minimum size to 0 rather than to content size,
so it is the only item that can absorb the deficit and it collapses to **0px**. The remaining 704px
still exceed 375px and are clipped by the branch's `overflow-hidden`. Both panels default to open
(`MatrixDashboard.tsx:340-341`, `useState(true)` for each) and nothing gates them on `isMobile` --
`:1471` passes `showLeftPanel`/`showRightPanel` through raw, unlike the map branch which
early-returns a fallback at `:1643`, and unlike the `isToolMode` shell which is explicitly
`flex-col lg:flex-row` at `:1979`.

Note the exact class of defect: this is the horizontal twin of the `max-h-[2400px]` clipping that
the D1 fix at `:2006-2035` reverted for the same reason, and of the `min-height:0` squeeze the P1
fix at `:2085-2104` repaired for the Calculator's main content -- neither fix reached this branch.

Why it matters: the TWG Review tab is where the Technical Working Group reads the options paper.
On a phone the paper body is not merely awkward, it is zero pixels wide, and the two panels flanking
it are themselves cut off. See also the Interactive Map finding "The mobile fallback tells the user
TWG Review is fully usable on their phone".

#### Collapsed TWG rails stay in the tab order (no `inert`)

Severity: P2
Type: DEFECT
Location: `src/components/TWGReviewPortal.tsx:234`, `:290`

Evidence: both wrappers collapse with `overflow-hidden` + `w-0` and carry no `inert` attribute. The
collapsed left rail still contains one `<button>` per document heading (`:242-248`, 26 of them for
the current paper). The collapsed right rail still contains the General Comments `<textarea>`
(`:306`), one `<textarea>` per heading (`:322`), and the Save Draft / Submit Review buttons
(`:339`, `:345`).

This exact pattern was diagnosed and fixed at four other collapse sites in the sibling file, all
carrying the same "NEW-P3-3 / P3-6 (a11y audit)" rationale:
`MatrixDashboard.tsx:1681` (map left panel), `:1768` (map right panel), `:2057` (tool-mode left
sidebar), `:2188` (tool-mode right drawer). The TWG portal collapses in its own file and was not
covered by that sweep.

Why it matters: with both rails closed, a keyboard user Tabs through roughly 55 invisible controls,
including text areas that accept and retain typed input, before reaching the document.

#### The paper has a SECOND `^# ` heading mid-document, so a leading-only demotion will not fix the duplicate-h1

Severity: P2
Type: DEFECT
Location: `matrix_research/options_paper/BC_Matrix_Options_Paper_FINAL_DRAFT.md:1` and `:1362`;
consumer at `src/components/TWGReviewPortal.tsx:283`

Evidence: `grep -n "^# "` on the document returns two hits, not one:

```
1:# DRAFT Matrix Sediment Standards Options Paper
1362:# Technical Appendices
```

`demoteLeadingH1` is scoped by design to the opening heading only -- its regex is anchored
(`src/lib/matrix-options/demoteLeadingH1.ts:22`, `/^([\s\uFEFF]*)#[ \t]/`) and its module comment
states "A `# ` appearing later is left alone". So applying the existing helper at the TWG call site
would leave `# Technical Appendices` as a second `<h1>` and the tab would still ship two level-1
headings under the shell's `<h1>Matrix Options</h1>`.

There is a second consequence that matters more than the heading level. The TOC is built by regex
over the RAW prop:

```
// TWGReviewPortal.tsx :78
const regex = /^##\s+(.*)$/gm;
// TWGReviewPortal.tsx :101  -- resolved positionally against the DOM
const target = root.querySelectorAll('h2')[idx];
```

Today the document has 26 `^## ` headings and the DOM has 26 `<h2>` (verified: no fenced code blocks
in the document, `grep -c '^\`\`\`'` = 0, so no false regex matches). Those two counts are only
equal because nothing demotes. Demoting the leading `# ` inside the render path while `headings`
continues to be computed from the undemoted `finalDraftContent` prop would insert a 27th `<h2>` at
DOM index 0 and shift every TOC link one section early, silently. Any fix must either demote both
`^# ` headings in the SOURCE document (leaving the runtime alone), or demote in the render path AND
recompute `headings` from the same demoted string.

Why it matters: the brief asked specifically whether the document has additional `^# ` headings
because it changes how the known defect can be fixed. It does, and the naive fix introduces a
silent off-by-one in the navigation of a 26-section regulatory paper.

#### Reviewer comments are silently truncated at 5000 characters, signalled only by a 3.76:1 counter

Severity: P2
Type: DEFECT
Location: `src/components/TWGReviewPortal.tsx:107`, `:309`, `:314`, `:326`, `:330`

Evidence:

```
// :107
const clipped = value.length > MAX_CHARS ? value.slice(0, MAX_CHARS) : value;
// :309 / :326
maxLength={MAX_CHARS}
// :314 (identical at :330)
className={cn("text-right text-xs mt-1 transition-colors", (comments[GENERAL_KEY]?.length || 0) >= MAX_CHARS ? "text-rose-500 font-bold" : "text-slate-500")}
```

A paste longer than 5000 characters is truncated by `maxLength` at the DOM level and again by
`slice` in the handler, with no toast, no inline warning, and no `aria-live` announcement. The only
signal is the counter turning `text-rose-500` at 12px bold. Computed against the right rail's own
surfaces (`bg-white dark:bg-slate-900`, `:290`):

- at-limit, light: `rose-500` `#ff2056` on `white` `#ffffff` = **3.76:1** (need 4.5:1; 12px bold is
  not large text, which starts at 18.66px bold)
- normal, dark: `slate-500` `#62748e` on `slate-900` `#0f172b` = **3.74:1**

So the counter fails contrast in light mode exactly in the state where it is the sole indicator of
data loss, and fails in dark mode in its resting state.

Why it matters: a TWG reviewer pasting a long prepared comment loses the tail of it with no
notification, and the one visual cue that something happened is the least legible element in the
panel.

#### Save and error feedback go through blocking `alert()`

Severity: P3
Type: DESIGN CHOICE
Location: `src/components/TWGReviewPortal.tsx:123`, `:125`, `:159`, `:179`, `:195`

Evidence:

```
alert('Progress saved to local storage.');
alert('Unable to save draft locally (storage quota or access denied).');
alert('You must be logged in to submit a review.');
alert('There was an error submitting your review.');
```

Four of the five user-facing outcomes in this component are native modal dialogs. The fifth -- the
success path -- is a properly designed in-page state (`:210-228`), which shows the component knows
how to do this. The submit path does have a real loading state (`isSubmitting`, `:350`) and a real
disabled state (`:347`), so the gap is specifically in the notification channel, not in state
coverage.

Why it matters: `alert()` is unstyled, untranslatable, steals focus, and cannot be dismissed
without a round trip. It is a judgment call rather than a defect -- the owner may prefer the
bluntness for a submit confirmation -- but the inconsistency with the component's own success state
is worth a decision.
