# UI/UX audit round 2 -- 2026-08-16

This is the audit CONTINUATION covering the six views not examined in the 2026-08-14 round.
It is FINDINGS ONLY -- nothing described here has been implemented. It was produced by reading
code at stack tip `bfbab1c9`, which contains that night's batch 2, Wave A, and deferred-triage
work on top of main `120c6f9a`.

Findings were required to carry a file:line and a class string, a computed ratio, or a quoted
line; unsubstantiated findings were excluded.

---

## Summary table

| View | Findings | DEFECT | DESIGN CHOICE | Highest severity |
|---|---|---|---|---|
| References & Values | 8 | 7 | 1 | P1 |
| SSD Workbench | 9 | 8 | 1 | P1 |
| Interactive Map | 8 | 8 | 0 | P1 |
| The Guide | 2 | 2 | 0 | P3 |
| Methodology by pathway | 2 | 1 | 1 | P3 |
| TWG Review | 5 | 4 | 1 | P1 |
| **Total** | **34** | **30** | **4** | -- |

---

## DESIGN CHOICE findings -- owner decisions needed

| View | Finding | Severity | Location |
|---|---|---|---|
| References & Values | R7. Touch targets below the project's own 44px standard on the primary switcher and the empty-state recovery button | P3 | `src/components/matrix-options/EvidenceLibrary.tsx:4276`, `:681`, `:1911` |
| SSD Workbench | S8. HCp is rendered at 3 significant digits in the headline and 6 in the reference check, on the same screen | P2 | `src/components/matrix-options/SsdWorkbench.tsx:1477` vs `:1681`, formatter at `:134-139` |
| Methodology by pathway | Demoted document titles now share heading level 2 with the rails' structural labels | P3 | `src/components/MatrixDashboard.tsx:1421` (demotion) vs `:2065-2074` (left rail `<h2>`) and `:2199-2220` (right rail `<h3>`) |
| TWG Review | Save and error feedback go through blocking `alert()` | P3 | `src/components/TWGReviewPortal.tsx:123`, `:125`, `:159`, `:179`, `:195` |

Four design-choice findings were found across both part-files.

---

## References & Values (Evidence Library)

### Summary

The Parameter Values table -- the surface that actually carries regulatory numbers -- is the
best-hardened part of this view: `table-fixed` column widths total exactly 100%, the value
cell wraps rather than overlaps, the sticky first column is forced fully opaque, a `title`
carries the unbroken string, and the whole thing sits in `ScrollFadeRegion` which now applies
a systemic `print:overflow-visible` reset. I could not find a way to clip or truncate a value
in that table, and I deliberately abandoned a promising-looking "the 320px left panel eats the
375px viewport" hypothesis after measuring it: `MatrixDashboard.tsx:2278-2280` passes
`showLeftPanel={!isMobile && showLeftPanel}`, so both side panels are genuinely off on mobile
and the filters fall back inline at `EvidenceLibrary.tsx:4322`. The real problems are elsewhere:
one scroll container that never got migrated to `ScrollFadeRegion` and therefore still clips on
paper, and a systemic set of computed contrast failures on the view's primary controls and
section headings.

### Findings

#### R1. Values-By-Parameter table clips on paper -- the one scroll container not migrated to ScrollFadeRegion

Severity: P1
Type: DEFECT
Location: `src/components/matrix-options/EvidenceLibrary.tsx:2420`

Evidence:

```
<div className="overflow-x-auto">
  <table className="min-w-full text-sm">
    ...
    <th className="py-2 pr-4 font-semibold">Value</th>
```

and the value cell at `:2446-2447`:

```
<td className="py-2 pr-4 font-mono text-slate-800 dark:text-slate-100">
  {formatValue(row.record.value, row.record.unit)}
```

This is the only bare `overflow-x-auto` left in either audited file (`grep -n
"overflow-x-auto|print:overflow"` returns exactly this one hit in `EvidenceLibrary.tsx`).
Every other scroll region in this file goes through `ScrollFadeRegion`, whose own comment at
`src/components/ScrollFadeRegion.tsx:165-170` states the reason the reset was centralised:
"Three separate caller-side print gaps were found in a single day ... all because a scroll
container that clips on screen also clips on paper unless someone remembers to reset it."
`ScrollFadeRegion.tsx:171` applies `print:overflow-visible print:max-w-none`; line 2420 has
neither. There is no global print rule to catch it -- `grep -n "print:" src/app/globals.css`
returns nothing. The parent shell is explicitly print-enabled:
`src/app/(dashboard)/matrix-options/page.tsx:112` carries `print:block print:h-auto
print:overflow-visible`, and `src/app/(dashboard)/layout.tsx:13` documents that
`window.print()` from any dashboard page is a supported flow.

Why it matters: the first column of this table is the regulatory value plus its unit. Printing
the Values-By-Parameter view emits a page where the columns past the container width are simply
absent, with no ellipsis, no scrollbar, and no indication anything was cut. This is the same
class as the previously-shipped truncated print, and it is the last caller still exposed to it.

#### R2. White text on mid-tone accent backgrounds fails 4.5:1 -- including the view's primary navigation control

Severity: P2
Type: DEFECT
Location: `src/components/matrix-options/EvidenceLibrary.tsx:4278` (primary), also `:1839`, `:2581`, `:1280`, `:784`, `:1146`

Evidence: the active segment of the three-way view switcher (`Values` / `By parameter` /
`Sources`), `:4275-4280`:

```
'min-h-9 whitespace-nowrap px-3 text-xs font-semibold transition-colors',
viewMode === mode.id
  ? 'rounded-md bg-sky-600 text-white shadow-sm dark:bg-sky-500'
```

`text-xs` = 12px semibold, which is normal text (large text requires >=18.66px bold or >=24px),
so the threshold is 4.5:1. Computed ratios for `#ffffff` foreground:

| Class | Hex | Relative luminance | Ratio vs white | Verdict |
|---|---|---|---|---|
| `bg-sky-600` | `#0284c7` | 0.2065 | **4.09:1** | fail |
| `dark:bg-sky-500` | `#0ea5e9` | 0.3288 | **2.77:1** | fail |
| `bg-emerald-600` (`:1839`, `:2767`) | `#059669` | 0.2286 | **3.77:1** | fail |
| `dark:bg-emerald-500` (`:1839`) | `#10b981` | 0.3698 | **2.50:1** | fail |
| `bg-amber-600` (`:2581`) | `#d97706` | 0.2796 | **3.19:1** | fail |
| `dark:bg-amber-500` (`:2581`) | `#f59e0b` | 0.4389 | **2.15:1** | fail |
| `bg-amber-500` (`:1280`, minor-severity badge) | `#f59e0b` | 0.4389 | **2.15:1** | fail |

Why it matters: `:4278` is the selected state of the control that decides which slice of the
catalog you are looking at, so the least readable text on the screen is the label telling you
where you are -- and it is worse in dark mode than light. `:1280` is the severity badge on a
cross-pathway inconsistency card, i.e. the word "minor" vs "major" on a flagged value conflict,
at 2.15:1.

#### R3. Section headings use `text-slate-400 dark:text-slate-500` and fail in BOTH themes

Severity: P2
Type: DEFECT
Location: `src/components/matrix-options/EvidenceLibrary.tsx:4087`, `:4933-4934`, `:3240`

Evidence, `:4087` (the left panel's "Filters" heading, on the panel's `bg-slate-50` at `:4081`):

```
<h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
  Filters
```

and `:4933-4934`, the right panel heading that reports which mode the inspector is in
("Catalog Dashboard" / "Inspecting value" / "Inspecting source"), on `bg-white dark:bg-slate-900`
(`:4913`):

```
className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500"
```

`text-xs` = 12px, so `font-bold` does not reach the 18.66px large-text threshold; 4.5:1 applies.
Computed:

- Light, `slate-400 #94a3b8` (L 0.3595) on `slate-50 #f8fafc` (L 0.9449): **2.43:1**
- Light, `slate-400 #94a3b8` on `#ffffff` (L 1.0): **2.56:1**
- Dark, `slate-500 #64748b` (L 0.1707) on `slate-900 #0f172a` (L 0.0088): **3.75:1**
- Dark, `slate-500 #64748b` on `slate-950 #020617` (L 0.0021): **4.24:1**

Why it matters: all four values are below 4.5:1, so this pair fails in every theme and on every
surface it is used on. `:4933` in particular is the only text distinguishing "you are looking at
the catalog dashboard" from "you are inspecting THIS value" in the right rail.

#### R4. `text-slate-500` used without a `dark:` variant on near-black surfaces

Severity: P2
Type: DEFECT
Location: `src/components/matrix-options/EvidenceLibrary.tsx:4517`, `:1922`, `:1930`, `:1938`, `:1946`

Evidence, `:4517-4519` -- the substance name printed under each parameter name in the values
table, inside a cell whose dark background is `dark:bg-slate-950` (`:4510`):

```
<div className="text-xs text-slate-500">
  {row.substanceLabel}
</div>
```

and `:1922`, `:1930`, `:1938`, `:1946` -- the four field labels ("Value", "Jurisdiction",
"Evidence items", "Candidate group") in the selected-value detail card, on tiles that are
`dark:bg-slate-900` (`:1921`, `:1929`, `:1937`, `:1945`):

```
<div className="text-[11px] font-semibold uppercase text-slate-500">
```

No `dark:` override is present on any of these five, so `slate-500 #64748b` (L 0.1707) is used
in dark mode too:

- `:4517`, 12px normal on `slate-950 #020617`: **4.24:1** (needs 4.5)
- `:1922` etc., 11px semibold on `slate-900 #0f172a`: **3.75:1** (needs 4.5)

In light mode the same class passes (`slate-500` on `slate-50` = 4.51:1, on white = 4.76:1),
which is why the missing variant is easy to ship unnoticed.

Why it matters: `:4517` is the substance identity attached to every row of the values table. A
parameter name without a legible substance is not enough to identify which regulatory value you
are reading, and this only degrades in dark mode.

#### R5. Right-panel resize handle is a focusable control with no keyboard operation

Severity: P2
Type: DEFECT
Location: `src/components/matrix-options/EvidenceLibrary.tsx:4920-4928`

Evidence:

```
<button
  type="button"
  role="separator"
  aria-orientation="vertical"
  aria-label="Resize references and values panel"
  data-testid="references-values-right-panel-resize-handle"
  onPointerDown={handleRightPanelResizePointerDown}
  className="absolute inset-y-0 left-0 z-10 w-2 cursor-col-resize border-l border-transparent hover:border-blue-300 focus:border-blue-500 focus:outline-none dark:hover:border-blue-700"
/>
```

Three concrete problems in one element. (1) It is a native `<button>`, so it is in the tab
order, but its only handler is `onPointerDown` -- there is no `onKeyDown`, so Enter, Space and
the arrow keys do nothing. (2) `role="separator"` overrides the implicit `button` role; a
focusable separator is an ARIA widget that requires `aria-valuenow` / `aria-valuemin` /
`aria-valuemax`, none of which are present, so it announces as a separator with no value and no
operable behaviour. (3) `focus:outline-none` removes the native ring and replaces it with
`focus:border-blue-500` on a `w-2` element whose border was `border-transparent` -- a 1px line
is the entire focus indicator.

Why it matters: a keyboard user tabs onto an element that announces as a separator, cannot
operate it, and gets a 1px focus cue. It is a dead stop in the tab order of the view's main
layout.

#### R6. `aria-label` on a role-less `<div>` is dropped by assistive tech

Severity: P3
Type: DEFECT
Location: `src/components/matrix-options/EvidenceLibrary.tsx:4265-4268`

Evidence:

```
<div
  className="grid w-full grid-cols-3 rounded-lg border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900 sm:inline-grid sm:w-auto sm:grid-cols-3"
  aria-label="Evidence library view"
>
```

The element has no `role`, so it maps to `role="generic"`. ARIA prohibits naming generic
elements, and browsers do not expose `aria-label` on them. Adding `role="group"` (or
`role="radiogroup"` with `aria-checked` children, given the buttons already use `aria-pressed`)
would make the name real.

Why it matters: the three `aria-pressed` buttons inside are announced individually with no
grouping name, so a screen-reader user hears three unrelated toggles rather than "Evidence
library view, 1 of 3".

#### R7. Touch targets below the project's own 44px standard on the primary switcher and the empty-state recovery button

Severity: P3
Type: DESIGN CHOICE
Location: `src/components/matrix-options/EvidenceLibrary.tsx:4276`, `:681`, `:1911`

Evidence: the view switcher segments are `min-h-9` = 36px (`:4276`); the "Clear filters" button
inside `EmptyDatabaseState` is `min-h-8` = 32px with `px-2.5` and no vertical padding (`:681`);
the detail-panel "Close" button is `min-h-9` = 36px (`:1911`). The same file deliberately uses
`min-h-[44px]` elsewhere -- `:557`, `:568` (pagination) and `:4574` (the per-row Details
disclosure) -- and `SsdWorkbench.tsx:452` sets `min-h-[44px] min-w-[44px]` on its shared
`ToggleButton`.

Note this is not a WCAG 2.2 AA failure: 2.5.8 Target Size (Minimum) requires 24x24 CSS px and
all three clear that. It is an inconsistency with the standard this codebase has otherwise
adopted, which is why it is filed as a judgment call rather than a bug.

Why it matters: `:681` is the only control that recovers from an over-filtered empty result set,
and at 32px it is the smallest tap target on the screen at the moment the user is most stuck.

#### R8. Cross-pathway audit card truncates the substance label with no `title` fallback

Severity: P3
Type: DEFECT
Location: `src/components/matrix-options/EvidenceLibrary.tsx:1270-1273`

Evidence:

```
<div className="min-w-0">
  <div className="font-semibold text-slate-900 dark:text-white truncate">
    {row.substance_label}
  </div>
```

The card sits in a `max-h-64 overflow-y-auto` list (`:1372`) inside the left panel, whose inner
container is `min-w-[270px] ... overflow-x-hidden` (`:4086`). `truncate` applies
`overflow:hidden; text-overflow:ellipsis; white-space:nowrap`, and unlike the values table cell
at `:4541` -- which carries `title={formatValue(...)}` precisely so the unbroken string stays
reachable -- there is no `title` here and no other rendering of the full label in the card.

Why it matters: this panel exists to flag substances whose value differs across pathways. The
row shows the severity badge and the per-pathway values (`:1289-1291`, not truncated) but can
cut the substance name to an ellipsis, so the reader sees a "major" inconsistency without being
able to read which substance it is on.

---

## SSD Workbench

### Summary

The two headline correctness guards are in good shape: the mixed-unit block genuinely suppresses
the HCp, the per-species table, the plot and the export (`:1442-1458`, `:2087-2097`), and the
five-species floor produces an explicit explanation rather than a blank chart (`:1917-1921`,
`:2030-2037`). The defects concentrate in the four `max-h-* overflow-auto` panels that hold the
per-species and per-model numbers: they clip on paper, they are unreachable by keyboard, and one
of them silently shows the first 8 of N rows while a tile a few hundred pixels up reports the
true N. Alongside that there is one focus indicator removed with no replacement, and the same
white-on-sky contrast failure as the other view, this time on the selected state of every filter
toggle.

### Findings

#### S1. Species-aggregate, model-diagnostics and exclusion tables clip on paper -- vertically, with no cue

Severity: P1
Type: DEFECT
Location: `src/components/matrix-options/SsdWorkbench.tsx:2072`, `:1830`, `:2215`

Evidence, `:2072` (the per-species SSD values that the HCp is derived from):

```
<div className="mt-4 max-h-72 overflow-auto rounded-md border border-slate-200 dark:border-slate-800">
  <table className="min-w-full text-left text-xs" data-testid="ssd-species-aggregate-table">
```

Same pattern at `:1830` (`max-h-64`, model diagnostics -- per-model HCp, weight, delta AICc,
fitted parameters) and `:2215` (`max-h-44`, exclusions). None of the three carries
`print:overflow-visible` or `print:max-h-none`; `grep -n "print:"` over `SsdWorkbench.tsx`
returns zero hits, and there is no global print rule (`grep -n "print:" src/app/globals.css` is
empty). The shell above is print-enabled:
`src/app/(dashboard)/matrix-options/page.tsx:112` = `print:block print:h-auto
print:overflow-visible`, and `src/app/(dashboard)/layout.tsx:13` documents `window.print()` as a
supported dashboard flow.

Arithmetic: `max-h-72` = 18rem = 288px. Rows are `px-3 py-2 text-xs`, i.e. 12px text at normal
leading (16px) plus 16px vertical padding = ~33px, plus a 41px header row. That is
`(288 - 41) / 33` = about 7 visible rows. An SSD needs at least 5 species and routinely uses 20
to 40; at 30 species a printed page shows 7 and drops 23.

Why it matters: this is a vertical clip, which is strictly worse than the horizontal case,
because a printed page gives no scrollbar, no ellipsis and no fade -- the page simply ends mid
table and reads as complete. The dropped rows are the per-species toxicity values underpinning
the HCp, i.e. exactly the "correct but invisible" failure mode.

#### S2. Exclusions table renders `slice(0, 8)` with no truncation notice, while the tile above reports the true total

Severity: P1
Type: DEFECT
Location: `src/components/matrix-options/SsdWorkbench.tsx:2227` (contrast with `:1481-1482`)

Evidence, `:2227`:

```
{result.excludedRecords.slice(0, 8).map((record, index) => (
```

The only other branch in that `<tbody>` is the zero case at `:2237` (`result.excludedRecords.length === 0`).
There is no `length > 8` branch anywhere in the file -- `grep -n "showing|Showing|slice(0,"`
over `SsdWorkbench.tsx` returns only `:222` (a date `.slice(0,10)`), `:1075` and `:2227`.
Meanwhile the summary tile at `:1481-1482` prints the real count:

```
['Records used', String(result.cleanedRecordCount)],
['Excluded', String(result.excludedRecordCount)],
```

The project already has the correct idiom in the other audited file --
`EvidenceLibrary.tsx:1380-1383`:

```
{inconsistentRows.length > 50 && (
  <p className="text-[11px] text-slate-500 dark:text-slate-400 px-1 py-1">
    Showing first 50 of {inconsistentRows.length}. Use filters to narrow the scope.
```

The same omission exists for the chemical suggestion list at `:1075`
(`chemicalSuggestions.slice(0, 8)` with no count), though the consequence there is lower.

Why it matters: the tile says "Excluded: 137", the table under "Warnings and exclusions" shows 8
rows and stops. Nothing on screen says the other 129 exclusion reasons exist. A reviewer
checking why records were dropped from a regulatory derivation reads a complete-looking list
that is 6% of the data.

#### S3. Scrollable result tables have no focusable children and no `tabIndex`, so keyboard users cannot scroll them

Severity: P2
Type: DEFECT
Location: `src/components/matrix-options/SsdWorkbench.tsx:2072`, `:1830`, `:2215`

Evidence: all three containers are `max-h-* overflow-auto` plain `<div>`s with no `tabIndex`.
Their table bodies contain only text -- `:2099-2117` (species aggregates), `:1848-1886` (model
diagnostics) and `:2227-2236` (exclusions) render `<td>`s of interpolated strings with no
`<button>`, `<a>`, input or `tabIndex` anywhere inside. The codebase is aware of this exact
mechanism: `src/components/ScrollFadeRegion.tsx:36-41` documents that "Chrome 127+ makes any
`overflow-x-auto` container with no focusable children implicitly tabbable" and handles the
inverse case explicitly. The EvidenceLibrary tables sidestep the issue because their rows carry
`tabIndex={0}` (`EvidenceLibrary.tsx:4476`, `:4706`); these do not.

Why it matters: outside Chrome's implicit-tabbability heuristic there is no way to reach rows
past the visible ~7 without a pointer. Combined with S1, the per-species values below the fold
are unavailable to a keyboard user on screen and to everyone on paper.

#### S4. Chemical search input removes its focus outline with no replacement

Severity: P2
Type: DEFECT
Location: `src/components/matrix-options/SsdWorkbench.tsx:1020-1025`

Evidence:

```
<input
  id="ssd-chemical-search"
  value={chemicalSearch}
  onChange={(event) => setChemicalSearch(event.target.value)}
  className="min-w-0 flex-1 bg-transparent text-sm font-medium text-slate-900 outline-none dark:text-white"
/>
```

`outline-none` with no `focus:ring-*`, `focus:border-*` or `focus-visible:*` on the input, and
the wrapping `<div>` at `:1018` has no `focus-within:` treatment either
(`"mt-2 flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"`).
This is the only unreplaced `outline-none` in either audited file: `grep -n "outline-none"`
returns 9 hits, and the other 8 all pair it with `focus:ring-2` / `focus-visible:ring-2` /
`focus:border-blue-500`.

Why it matters: WCAG 2.4.7. Tabbing into the workbench sidebar, focus lands on the chemical
search field with zero visual indication, and the next Tab moves to "Search mirror" -- so the
user cannot tell whether their keystrokes are going into the search box.

#### S5. Selected-state filter toggles and the primary Run button fail 4.5:1 on white

Severity: P2
Type: DEFECT
Location: `src/components/matrix-options/SsdWorkbench.tsx:454`, `:1367`, `:1068`

Evidence, `:451-455` -- the shared `ToggleButton` used for Data source, Media filter,
Environment filter and Plot scale, i.e. the active state is what tells you which filter is
selected:

```
'min-h-[44px] min-w-[44px] rounded-md border px-4 py-2.5 text-sm font-semibold transition-colors',
active
  ? 'border-sky-600 bg-sky-600 text-white shadow-sm dark:border-sky-500 dark:bg-sky-500'
```

`:1367`, the primary "Run SSD" action:

```
className="shrink-0 rounded-md bg-sky-700 px-3 py-2 text-sm font-bold text-white shadow-sm hover:bg-sky-800 dark:bg-sky-500 dark:hover:bg-sky-400"
```

`:1068`, "Load records":

```
className="rounded-md bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
```

All three are `text-sm` = 14px, below the 18.66px-bold large-text threshold, so 4.5:1 applies.
Computed for `#ffffff`:

| Class | Hex | Luminance | Ratio | Verdict |
|---|---|---|---|---|
| `bg-sky-700` (`:1367` light) | `#0369a1` | 0.1272 | 5.93:1 | pass |
| `dark:bg-sky-500` (`:1367` dark, `:454` dark) | `#0ea5e9` | 0.3288 | **2.77:1** | fail |
| `dark:hover:bg-sky-400` (`:1367` dark hover) | `#38bdf8` | 0.4593 | **2.06:1** | fail |
| `bg-sky-600` (`:454` light, `:1068` both themes) | `#0284c7` | 0.2065 | **4.09:1** | fail |

Why it matters: `:454` means the label of the *currently selected* filter is the least readable
label in the panel, and `:1367` means the primary action of the whole workbench sits at 2.77:1
in dark mode and drops to 2.06:1 while the pointer is on it.

#### S6. Mirror status, failure and row-cap messages are plain `<p>` elements with no live region

Severity: P3
Type: DEFECT
Location: `src/components/matrix-options/SsdWorkbench.tsx:1168`, `:1169-1173`, `:1003-1006`

Evidence:

```
{liveMessage && <p className="mt-1">{liveMessage}</p>}
{liveRowsTruncated && (
  <p className="mt-1 text-amber-700 dark:text-amber-300">
    Results were capped at 5,000 rows for browser safety.
  </p>
)}
```

`liveMessage` carries the full async lifecycle from `liveStatusLabel` (`:289-305`), including
`'Loading selected ECOTOX records...'` and `'ECOTOX mirror request failed.'`, and the upload
path renders its own outcome the same way at `:1003-1006`. None carries `role="status"`,
`role="alert"` or `aria-live`. The file already knows the idiom -- the mixed-units block banner
at `:1443-1446` uses `role="alert"` -- and `grep -n 'role="alert"|role="status"'` over
`SsdWorkbench.tsx` returns exactly that one hit.

Note the related visual gap: `:1059` and `:1067` disable the two mirror buttons during a fetch
but their labels stay "Search mirror" / "Load records" with no spinner, so the loading state is
communicated only by this un-announced paragraph nested inside the health panel.

Why it matters: a failed mirror load is silent to a screen reader, and the 5,000-row cap notice
-- which changes what the resulting HCp was computed from -- is announced to nobody.

#### S7. Chip remove button is a ~12x12px target, below the WCAG 2.5.8 24px floor

Severity: P3
Type: DEFECT
Location: `src/components/matrix-options/SsdWorkbench.tsx:1040-1047`

Evidence:

```
<button
  type="button"
  aria-label={`Remove ${name}`}
  onClick={() => setSelectedChemicals(prev => prev.filter(c => c !== name))}
  className="ml-0.5 hover:text-sky-600"
>
  <X className="h-3 w-3" />
</button>
```

The button has no padding and no min-height/min-width; its box is the icon, `h-3 w-3` = 12x12
CSS px. WCAG 2.2 SC 2.5.8 (AA) requires 24x24 unless a spacing exception applies, and it does
not here -- the chip label sits immediately to its left with only `gap-1`. The same file sets
`min-h-[44px] min-w-[44px]` on its shared `ToggleButton` at `:452`, so this is a deviation from
both the standard and the local convention.

Secondarily, the chemical suggestion buttons at `:1078-1094` (`px-2 py-1.5 text-xs` = about
28px tall) clear the 24px AA floor but sit well under the file's own 44px standard.

Why it matters: on a 375px touch screen, removing a wrongly-selected chemical from the SSD input
set requires hitting a 12px target; a mis-tap lands on the chip or the neighbouring chip instead.

#### S8. HCp is rendered at 3 significant digits in the headline and 6 in the reference check, on the same screen

Severity: P2
Type: DESIGN CHOICE
Location: `src/components/matrix-options/SsdWorkbench.tsx:1477` vs `:1681`, formatter at `:134-139`

Evidence, the formatter:

```
function formatNumber(value: number, digits = 3): string {
  if (!Number.isFinite(value)) return 'n/a';
  return value.toLocaleString(undefined, {
    maximumSignificantDigits: digits,
  });
}
```

The headline HCp tile calls it with the default, `:1477`:

```
? `${formatNumber(result.hcp)} ${result.unit}`
```

while the reference-check card renders the identical `result.hcp` at 6 digits, `:1681`:

```
? `${formatNumber(result.hcp, 6)} ${result.unit}`
```

and the reference value it is compared against also uses 6 (`:1649`), with the delta and
tolerance at 4 (`:1692`, `:1700`). The per-species table (`:2108`), the per-model diagnostics
HCp (`:1854`) and the bootstrap interval (`:2177-2178`) all use the 3-digit default.

To be precise about what this is and is not: `maximumSignificantDigits` never rounds a non-zero
value to zero and never drops the exponent, so no value is hidden or zeroed. The issue is that
the same number appears twice on one screen with different precision, and that the exported
receipt/CSV precision is set by a different path than the on-screen headline.

Why it matters: 3 significant figures is a defensible presentation choice for an HCp, but it is
the owner's call whether the primary derived candidate should be shown at lower precision than
the validation figure it is being checked against a few hundred pixels below. Filed as a
judgment call, not a bug, because there is no objectively correct answer here.

#### S9. Panel titles are styled `<div>`s and `<summary>`s, so most of the view is missing from the heading outline

Severity: P3
Type: DEFECT
Location: `src/components/matrix-options/SsdWorkbench.tsx:896`, `:1180`, `:1355`, `:1392`, `:1505`, `:1818`

Evidence: `grep -n "<h1|<h2|<h3|<h4"` over `SsdWorkbench.tsx` returns exactly five hits -- `:878`
(the `h2` "Species Sensitivity Distribution candidate generator") and four `h3`s at `:1907`
"Empirical SSD preview", `:2045` "Species aggregates", `:2139` "Derived candidate receipt",
`:2203` "Warnings and exclusions". Everything else that reads as a section title is a styled
`div` or a `summary`:

```
:896   <div className="text-xs font-bold uppercase tracking-wider ...">Data source</div>
:1180  <div className="text-xs font-bold uppercase tracking-wider ...">Media filter</div>
:1355  <div className="text-xs font-bold uppercase tracking-wider ...">Run control</div>
:1392  <div className="text-xs font-bold uppercase tracking-wider ...">Plot options</div>
:1505  Validation and verification   (inside <summary>, :1502)
:1818  Model diagnostics             (inside <summary>, :1815)
```

Why it matters: the entire settings sidebar and the two collapsible evidence panels -- including
"Validation and verification", which is where the run is checked against the official ssdtools
snapshot -- are absent from the document outline, so heading navigation jumps from the page
title straight to "Empirical SSD preview" and skips how the run was configured and whether it
validated.

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

---

## Known and already handled -- do not re-report

- **Duplicate-H1 fix (Guide + Methodology tabs):** landed via a `demoteLeadingH1` helper applied at
  the `MatrixDashboard` call sites, not inside `MathRenderer` -- deliberately, because
  `JermilovaReviewPortal` renders through `MathRenderer` and has no other h1 to worry about, so
  putting the demotion inside `MathRenderer` itself would have been the wrong scope for the fix.
- **TWG Review still carries the duplicate-H1 defect.** Its source document,
  `matrix_research/options_paper/BC_Matrix_Options_Paper_FINAL_DRAFT.md`, has TWO `^# ` headings --
  the leading one and `# Technical Appendices` at line 1362 -- so the leading-H1 helper alone would
  NOT fix that tab (see the TWG Review finding above for the TOC-index consequence of a naive fix).
  This is why it was left out of batch 2 and is going to the owner as a decision, alongside the
  other three DESIGN CHOICE findings in this document.
