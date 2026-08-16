# UI Audit 2026-08-14 -- status reconciliation (checked 2026-08-15)

Reconciles the "Sediment Dashboard UI Audit" artifact (38 unique items merged from 57 raw
findings across four assessments; artifact
`https://claude.ai/code/artifact/6447433a-c191-4514-b4ca-e01f6b20c9d0`) against the code as
it stands on `feat/mo-design-batch-20260815`.

**Why this file exists.** That audit is a DIFFERENT document from
`docs/UI_DECISIONS_2026_08_15.md` (the 21 owner-decided design items this branch
implements). The two were being tracked separately, and the owner reasonably asked whether
the audit's findings were still outstanding. They are -- but only in one section, and that
section was never scheduled into any batch. Recording the reconciliation so the answer is
not re-derived from scratch next session.

Every status below was verified against the current working tree, not inferred from commit
messages.

---

## Section A -- "Fix this session" (8 items): ALL LANDED

Landed principally via PR #778 (`fix(matrix-options): keyboard access, write-failure
handling, and a stuck calculation`, merged 2026-08-14), with the 44px work overlapping
decision #1 on this branch.

| Item | Finding | Verified evidence |
|---|---|---|
| A1 (P0) | Methodology side-tabs mouse-only | `role="tab"` + `role="tablist"` present in `MatrixDashboard.tsx`, with `onKeyDown` roving-tabindex handlers |
| A2 (P1) | Primary 8-tab nav lacks tab semantics | 2 tablists, 2 `role="tab"` render sites, 7 tabpanels, `aria-selected` + `aria-controls` |
| A3 (P1) | Bootstrap calc stuck on "Calculating..." | `failedKeys` referenced 10x plus retry copy in `MatrixMapSelectionStats.tsx` |
| A4 (P1) | Failed writes silently swallowed (4 sites) | 12 error-state identifiers (`submitError`/`writeError`/`saveError`) in `EvidenceLibrary.tsx` |
| A5 (P1) | No live regions | 6 `aria-live` in `EvidenceLibrary.tsx`; 19 `role="status"` and 22 `role="alert"` across `matrix-options/` |
| A6 (P2) | Icon-only button named only by `title` | `aria-label="Remove promoted candidate"` present |
| A7 (P2) | Touch targets under 44px | `min-h-[44px]` in `MatrixDashboard.tsx`; decision #1 extended the floor across map, SSD, and EvidenceLibrary |
| A8 (P3) | Heading hierarchy h1 -> h3 | `MatrixDashboard.tsx` now renders h2 between h1 and h3 |

No Section A work remains.

---

## Section B -- landing-page redesign requirements (14 items): LARGELY OPEN

**This is the real outstanding work, and it is NOT scheduled into any batch.**

The audit deliberately issued Section B as redesign REQUIREMENTS rather than tickets, on
the premise that the landing page's visual world would be replaced wholesale. That premise
was never scheduled. Batch 1 touched this route only through decisions #10 (hero), #11 (nav
cards), #17 (project phases) and a WCAG contrast fix -- it was never scoped to Section B.
Batch 2 covers exactly one item (#18 = B5).

| Req | Requirement | Status |
|---|---|---|
| B1 | Never let a public visitor click into an unlabeled login wall | OPEN |
| B2 | Ship a `main` landmark and a skip link | OPEN -- zero `<main>` and zero skip links in `page.tsx` or `layout.tsx` |
| B3 | Give every visual section its own heading level | PARTIAL -- 1 h2 against 5 h3 on the landing route |
| B4 | Meet 4.5:1 contrast in both themes, verified | PARTIAL -- the Active chip is now 5.86:1 (browser-measured this session); the audit's second citation is unverified |
| B5 | Persistent, primary sign-in for returning members | QUEUED as batch 2 #18 |
| B6 | Expand acronyms on first use | OPEN -- SSTAC / TWG / BN-RRM / CSR still unexpanded |
| B7 | Fix the stale, wrong-register footer | OPEN -- hardcoded 2025 + "all rights reserved" |
| B8 | State the delivery phase once | PARTIAL -- batch 1 removed the duplicated emoji pill; repetition not fully resolved |
| B9 | Route navigation through `next/link` | OPEN -- no `next/link` import on the route |
| B10 | Keep the page a Server Component | OPEN -- `'use client'` still at the top of `page.tsx` |
| B11 | Avoid the light-mode flash | OPEN -- no inline theme bootstrap in `<head>` |
| B12 | Respect reduced-motion preferences | OPEN -- zero `prefers-reduced-motion` in `globals.css` |
| B13 | Carry the two good controls forward verbatim | N/A until the redesign happens |
| B14 | 44px touch targets on repeated controls | OPEN -- `ThemeToggle` has no 44px floor |

Note that B9, B10 and B11 are STRUCTURAL (routing, server/client boundary, theme
bootstrap), not cosmetic. They should not ride along on a UI-polish commit; they want their
own batch with its own gate run.

---

## Section C -- deferred backlog: UNCHANGED, deliberately

God components (`EvidenceLibrary.tsx` 4552 lines, `SsdWorkbench.tsx` 2216,
`MatrixDashboard.tsx` 1269), the missing shared-primitives directory, the duplicated
numeric-field class string, status-tone extraction, raw hex colours in the workbench chart,
inert filter chips, popover focus return, combobox colour-only highlighting, tab-bar scroll
affordance, and the working-set bar. All explicitly out of scope; the owner designated the
god-component split a separate refactor.

One Section C item is now PARTLY addressed incidentally: "the tab bar's horizontal scroll
container has no scroll affordance" -- decision #2's `ScrollFadeRegion` provides exactly
that affordance for other overflow regions, but has NOT been applied to the tab bar itself.
The tab bar's ancestor is `overflow-x: auto` (measured 375px visible / 1338px scrollable at
phone width), so this remains open, and the Vision tab rename lengthened that scroll
distance by roughly 118px.

---

## Section D -- needs owner decision: STILL OPEN

Exposure-factor inputs accept any value at all -- unconstrained free text, no numeric type,
min, max, or step, across `HHDirectContactCalculator.tsx` (14 fields) plus the food-web and
inhalation calculators. A negative body weight or an ingestion rate of 1e9 flows straight
into a screening value.

Correctly still open: setting real bounds needs domain range decisions per field, and a UI
pass must not make those unilaterally. This is the same item the branch handoff lists under
"Still open, unanswered" as "Exposure-factor bounds". Awaiting owner-supplied ranges; the
attribute work afterwards is low-risk.

---

## Recommendation on sequencing

1. Land batch 1 (this branch). Gated and reviewed; Section A already merged.
2. Batch 2 as planned (#16b, #18a, #20a, P1b, P2b) -- carries B5.
3. **Schedule Section B as its own batch.** Split it: the accessibility/content items (B1,
   B2, B3, B6, B7, B14) are low-risk and additive; the structural items (B9, B10, B11) want
   their own review because they change the route's rendering model.
4. Section D stays owner-gated. Section C stays deferred.
