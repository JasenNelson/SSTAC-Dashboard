# PR #187 Review Pack -- B1+B3 P3 UI Polish (Conceptual Model + TWG Review)
# Branch: feat/2026-tabs-ui-polish-2026-05-28 | Head: 16f9d86 | Base: main (f970064)
# Prepared: 2026-05-28

---

## 1. TL;DR

PR #187 is a pure UI polish commit touching exactly 2 files (+50 lines total,
no logic changes, no test deletions). It adds (a) a scope label and ARIA list
semantics to ConceptualMatrix, and (b) a scope badge plus a collapsible
onboarding panel to TWGReviewPortal. All three codex Round 1 issues (wrong
pathway codes, absolute-positioning overlap, BSAF Purpose mismatch) were
fixed before Round 2, which returned GREEN mutual agreement. All 4 gates are
GREEN on the Round 2 state. Safe to merge; review focus is visual placement
and the TWG onboarding panel default-collapsed behavior.

---

## 2. Visual Diff Explanation

### 2a. ConceptualMatrix.tsx (76 -> 89 lines, +13/-3)

Three independent edits, all additive:

**Edit 1 -- Scope label (new `<p>`, lines 11-13 in feature branch)**
A small italic caption is inserted immediately after the existing description
paragraph, inside the `<div className="mb-8">` header block:

  "Phase 2 of the BC Sediment Standards Project (2026 scope)."

This sits directly below the subtitle, above the 2x2 grid. No existing text
moved.

**Edit 2 -- ARIA list semantics on the grid wrapper (+4 lines)**
The plain `<div className="grid ...">` gains `role="list"` and
`aria-label="Four sediment derivation pathways arranged in a 2 by 2 matrix"`.
Each of the 4 quadrant divs gains `role="listitem"`. Purely additive; no class
or layout changes.

**Edit 3 -- "Where to go next" block (new `<div>`, 6 lines appended after grid)**
A bordered footer block is appended after the closing `</div>` of the grid,
outside the grid container:

  "Where to go next: Use Jurisdictional Frameworks to compare how other
   regulatory programs approach each pathway, then test specific values in
   the Calculator."

ASCII layout sketch (desktop, 2-column):

```
+--------------------------------------------------+
| h2: Conceptual Model: 2x2 Matrix Framework        |
| p:  A high-level visual architecture...           |
| p:  Phase 2 of the BC Sediment Standards...  <NEW |
+--------------------------------------------------+
| [Eco: Direct Contact]  | [Eco: Food Web]          |
| role=listitem          | role=listitem            |
+------------------------+--------------------------+
| [HH: Direct Contact]   | [HH: Food Web]           |
| role=listitem          | role=listitem            |
+--------------------------------------------------+
| border-t                                          |
| Where to go next: Jurisdictional Frameworks ...  |
|                                                <NEW
+--------------------------------------------------+
```

The scope label is tucked inside the header block, not floating above or below
the grid. The "Where to go next" block is a distinct section, visually
separated by `border-t`.

### 2b. TWGReviewPortal.tsx (346 -> 378 lines, +37/-2)

Two edits: a new state variable and a new JSX block.

**Edit 1 -- `showOnboarding` state (line 47 in feature branch)**
`const [showOnboarding, setShowOnboarding] = useState(false);`
Default `false` = details panel starts collapsed. No other state touched.

**Edit 2 -- Scope badge + collapsible onboarding panel (32 new lines)**

Inserted at the TOP of `<div className="max-w-4xl mx-auto space-y-8">`,
BEFORE the "Final Master Draft" header card. Both elements are wrapped in a
`<div className="flex flex-col gap-2 print:hidden">` that is hidden on print.

The scope badge is an inline pill:
  "Phase 2 (2026) | Options Paper Review"

The onboarding panel is a native `<details>` / `<summary>` element. The
summary text is "How TWG Review works". The body has 3 paragraphs covering
comment workflow, draft autosave, and calculator disclaimer.

**Codex Round 1 P2 finding -- absolute positioning overlap (FIXED)**

Round 1 identified that a prior version of this block used `position: absolute`
inside the `overflow-y-auto` scroll container, which caused the expanded details
panel to overlap the dashboard toolbar above AND the "Final Master Draft" header
card below when opened.

The fix in the committed version moves the entire block into the normal document
flow as the first child of `max-w-4xl mx-auto space-y-8`. Because that container
uses `space-y-8`, the badge+panel are separated from the Final Master Draft card
by a consistent 2rem gap and cannot overlap anything.

ASCII before/after:

BEFORE (absolute, overlapping):
```
+---------- overflow-y-auto scroll container ----------+
| [dashboard toolbar]                                   |
|   +--- position:absolute ---+                        |
|   | scope badge             |  <-- overlaps toolbar  |
|   | details (expanded)      |  <-- overlaps header   |
|   +-------------------------+                        |
| [Final Master Draft header card]  <- obscured        |
+------------------------------------------------------+
```

AFTER (normal flow, committed version):
```
+---------- overflow-y-auto scroll container ----------+
| max-w-4xl mx-auto space-y-8                          |
|   [ scope badge + details panel ]   <-- FIRST CHILD  |
|   gap: space-y-8 (2rem)                              |
|   [ Final Master Draft header card ]                 |
|   gap: space-y-8                                     |
|   [ paper body sections ... ]                        |
+------------------------------------------------------+
```

---

## 3. ARIA + Accessibility Audit

### ConceptualMatrix

- `role="list"` on the grid wrapper is correct. A CSS `display: grid` element
  does not expose list semantics by default; the explicit role closes that gap.
- `role="listitem"` on each of the 4 quadrant divs is correct and complete.
- `aria-label="Four sediment derivation pathways arranged in a 2 by 2 matrix"`
  is readable and accurate. NVDA/VoiceOver will announce something like:
  "list, Four sediment derivation pathways arranged in a 2 by 2 matrix, 4 items"
  before reading the first item. This is the intended behavior.
- One nuance: the phrase "2 by 2 matrix" is descriptive of spatial layout, not
  semantic grouping. Screen readers do not convey grid position within a role=list
  (item 1 of 4, not "row 1 col 1"). This is acceptable for a decorative layout
  hint -- the 4 items are independently comprehensible without spatial cues.
  No change needed; flag only if owner has a WCAG 1.3.1 concern on spatial layout.
- No heading hierarchy change. h2 -> h3 inside each quadrant remains correct.

### TWGReviewPortal

- Native `<details>` / `<summary>` is keyboard-accessible by default in all
  modern browsers (Space/Enter on the summary toggles). No JS keyboard handling
  is needed.
- `onToggle` updates `showOnboarding` state for controlled open/closed tracking
  but does NOT override the browser's native open/close; the `open` prop reflects
  state, which is synced from the toggle event. This is correct controlled usage.
- Default `showOnboarding = false` means `<details>` renders without `open` attr,
  so returning reviewers who know the workflow are not interrupted on every load.
  First-time users see the collapsed panel and can expand it once.
- `print:hidden` on the wrapper ensures the scope badge and panel do not appear
  in PDF output. The print layout goes directly to the Final Master Draft body.
  No accessibility concern -- print CSS is a separate modality.
- The summary text "How TWG Review works" is plain and unambiguous. No ARIA
  augmentation needed for a native details element.

---

## 4. Manual Smoke Test Checklist

Start the dev server: `npm run dev` (use `.venv` python if running any backend
gate, but for these UI-only changes the Next.js dev server is sufficient).

### Conceptual Model tab

1. Open the Conceptual Model tab.
2. Confirm scope label "Phase 2 of the BC Sediment Standards Project (2026 scope)."
   is visible below the subtitle paragraph, above the 2x2 grid.
3. Confirm the 2x2 grid renders with all 4 colored quadrant cards.
4. Scroll to the bottom of the tab. Confirm "Where to go next:" block is visible
   with a top border, referencing "Jurisdictional Frameworks" and "Calculator".
5. Resize to mobile width (< 768px). Grid should collapse to 1 column; scope label
   and "Where to go next" block should remain readable.

### TWG Review tab (normal)

1. Open the TWG Review tab.
2. Confirm the sky-blue scope badge "Phase 2 (2026) | Options Paper Review" is
   visible at the top of the center content column, above the Final Master Draft
   card.
3. Confirm "How TWG Review works" details element is visible and collapsed by
   default (no body text visible).
4. Click "How TWG Review works" summary. Confirm 3 paragraphs expand:
   - Comment workflow description.
   - Draft autosave + submit note.
   - Calculator screening-grade disclaimer.
5. Click again to collapse. Confirm Final Master Draft header card is visible
   below without overlap.
6. Enter a draft comment in any section textarea. Reload the page. Confirm draft
   persists (localStorage autosave still works).

### TWG Review tab (panel variants)

7. Test with both left and right panels visible (default). Confirm scope badge
   and onboarding panel are inside the center scroll column only; no overflow
   into left/right panels.
8. Test with left panel hidden. Confirm center content still displays correctly.

### Print mode

9. Open TWG Review tab. Press Ctrl+P (or use browser print preview).
10. Confirm scope badge and onboarding panel are NOT visible in the print preview
    (`print:hidden` applied).
11. Confirm Final Master Draft header and paper body render cleanly as the first
    visible content in print mode.

---

## 5. Acceptance Criteria

- [ ] Visual: scope label visible below subtitle in Conceptual Model tab
- [ ] Visual: "Where to go next" block visible below 2x2 grid in Conceptual Model tab
- [ ] Visual: "Phase 2 (2026) Options Paper Review" scope badge visible at top of
      TWG Review center column
- [ ] Visual: "How TWG Review works" panel collapsed by default; expands/collapses
      correctly on click/keyboard
- [ ] Accessibility: DevTools Accessibility tree shows role=list on grid wrapper +
      role=listitem on 4 quadrant divs + aria-label on wrapper
- [ ] Accessibility: `<details>` / `<summary>` keyboard-navigable (Tab to summary,
      Space/Enter to toggle)
- [ ] Functional: existing TWG Review comment workflow unchanged -- drafts autosave
      to localStorage (DRAFT_STORAGE_KEY = 'twg-matrix-review-draft-v3'); Submit
      button behavior unchanged
- [ ] Functional: print mode on TWG Review produces clean PDF (scope badge + panel
      hidden; paper body renders from Final Master Draft header)
- [ ] Gates GREEN on Round 2 state (lint warnings all pre-existing; unit 2550
      passed; build exit 0 221kB; e2e 135 passed 1.8m) -- re-run gate suite if
      any new local change was made after 16f9d86
- [ ] No new regression test deletions (per cross_project_never_delete_regression
      _tests_during_cleanup standing rule)

---

## 6. Codex Review Trace

Codex Round 1 log: `.tmp/codex-logs/wave2-review-20260528T052529.txt`
Codex Round 2 log: `.tmp/codex-logs/wave2-round2-20260528T053624.txt`
Retry log:        `.tmp/codex-logs/stream-a-rereview-retry-20260528T071447.txt`

**Round 1 findings and dispositions:**

P1 (FIXED) -- Wrong pathway codes in scope badge: the initial draft used codes
"EqP" and "AVS" as if they were pathway labels in the TWG badge, creating
factual mismatch with the 4-pathway nomenclature. Fixed by replacing badge text
with the correct "Phase 2 (2026) / Options Paper Review" label that matches the
paper scope without inventing pathway abbreviations.

P2 (FIXED) -- Absolute positioning overlap: the initial draft placed the scope
badge + onboarding panel block using `position: absolute` inside the
`overflow-y-auto` scroll container. When the details panel expanded it overlapped
the toolbar above and the Final Master Draft header card below. Fixed by moving
the block into normal document flow as the first child of the
`max-w-4xl mx-auto space-y-8` center container (see section 2b above).

P3 (FIXED) -- BSAF Purpose mismatch: the initial "Where to go next" block in
ConceptualMatrix contained a sentence describing BSAF as a standalone tool the
user could access directly, which misrepresents its role (BSAF is a calculation
methodology within the Food Web pathway, not a separate tab or action). Fixed by
replacing the BSAF reference with the current accurate text pointing to
"Jurisdictional Frameworks" and "Calculator" tabs, which actually exist.

**Round 2 verdict:** GREEN mutual agreement. No outstanding findings. Codex
confirmed the 3 fixes resolved all P1/P2/P3 issues and no new issues were
introduced.

---

## 7. Risk Assessment

**TWGReviewPortal JSX restructure (block moved from absolute to normal flow)**
Risk: LOW.
No logic changes. The `showOnboarding` state and `onToggle` handler are
self-contained. The moved block renders the same DOM content in a different
position. The surrounding `space-y-8` container handles spacing; no margin or
padding overrides were added that could displace other elements. The localStorage
draft autosave path (`DRAFT_STORAGE_KEY`, `makeBareRecord`, prototype-pollution
guards) is untouched. The Submit/isSubmitting/isSubmitted flow is untouched.

**ConceptualMatrix ARIA additions**
Risk: LOW.
Purely additive. No existing class, style, or behavior was changed. The 3
additions (scope label, role attributes, "Where to go next" block) each sit in
distinct locations in the JSX tree with no shared state or event handlers.
Regression risk is effectively zero; the ARIA additions do not affect visual
rendering in any browser that ignores unknown attributes (all modern browsers
handle role= natively).

**Markdown content in JF drafts (sibling commit 05c6059 on main)**
N/A for this PR. The JF draft content changes landed in 05c6059 which is already
on main and is the base for this PR's branch. PR #187 does not touch any
Jurisdictional Frameworks file.

---

## 8. Merge Command (if approved)

Squash merge (standard for small polish PRs):

```
gh pr merge 187 --squash --delete-branch
```

If you prefer a merge commit to preserve the single commit message verbatim:

```
gh pr merge 187 --merge --delete-branch
```

Squash is recommended. The entire change is one cohesive UI polish commit;
squashing keeps main history clean.

---

*Review pack authored from worktree C:\Projects\SSTAC-Dashboard-worktree-stream-a.*
*Source read via: git diff HEAD origin/feat/2026-tabs-ui-polish-2026-05-28*
*Codex logs at: .tmp/codex-logs/ (3 files; see section 6)*
