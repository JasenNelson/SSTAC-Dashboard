# Next-batches execution plan (2026-08-15) -- staged, copy into docs/ after batch 1 commits

Three parallel planning passes, all verified against live code. Held in scratchpad so batch 1's
gated tree stays frozen.

**Universal warning: EVERY line number cited in the handoff and decisions docs has drifted.**
Batch 1 edited `MatrixDashboard.tsx`, `page.tsx`, `ProjectPhases.tsx` and `MathRenderer.tsx`
heavily today. Re-read each file immediately before implementing; do not trust numbers below.

---

## OWNER DECISIONS -- RESOLVED 2026-08-15

1. **RESOLVED: #16 widens to cover BOTH surfaces.** Owner: "fix both". The Guide tab carries the
   same duplicate-H1 defect (`The_Guide.md:1` `# The Guide: Matrix Options Workspace` rendered
   under the page-chrome `<h1>Matrix Options</h1>`) as methodology-by-pathway. Apply the same
   `demoteLeadingH1` helper at BOTH call sites -- the Jurisdictional Frameworks render (`~:1397`)
   and the Guide's `MathRenderer` calls (`~:1414,1418,1423`). `MathRenderer.tsx` still must NOT
   change: `JermilovaReviewPortal.tsx:819` renders through it with no other `<h1>`, so a global
   fix deletes that page's only title. The Jermilova regression test guarding that is now
   MANDATORY, since two call sites make a global "simplification" more tempting later.
   NOTE the Guide split feeds three MathRenderer instances from `SECTION_BOUNDARY` parts; only
   part 0 can carry the leading `# `, so the helper is a no-op on parts 1 and 2 -- verify rather
   than assume.

2. **RESOLVED: P1 receipt -- lift the timestamp to the shared parent (option B).**
   FACTS: `candidateReviewedAt` is local `useState` at `CalculatorValueSearchPanel.tsx:527`, set
   at `:531`, rendered at `:611-622`. The handler then calls `onOpenEvidenceLibrary(...)`, which
   NAVIGATES away to References & Values -- so the receipt is not click feedback, it is a
   "what did I just do" trace seen on RETURN. That is why losing it matters, and why it is minor.
   DECISION: hoist `candidateReviewedAt` into `MatrixDashboard` and pass it (plus its setter) to
   both instances, so body and rail always agree. Rejected option A (state travels with the
   extracted component) because it creates two sources of truth for one fact -- the exact class
   of defect this codebase hit repeatedly on 2026-08-15. Rejected option C (no body receipt).
   Owner asked whether /codex-review should decide this: no. It reviews diffs for correctness,
   there is no diff yet, and all the technical facts were already known. Batch 2's implementation
   still goes through the mandatory codex commit gate.

3. **Exposure-factor bounds** (audit Section D) -- needs domain ranges per field. STILL OPEN.

4. ~~`ConceptualMatrix` `find()` throw vs placeholder~~ -- **RESOLVED AND SHIPPED in batch 1
   (PR #781): visible placeholder. Do not re-decide.**

5. **Section B Wave C** -- `/contact` and `/accessibility` routes do not exist. Creating them is
   new surface area needing an auth-gating decision (`PUBLIC_ROUTES`) and a scope call
   (mailto stub vs real form).

---

## BATCH 2 (five owner-decided items) -- ONE PR, not five

All five except #18 edit `MatrixDashboard.tsx`; five separate PRs would force four rebases.

- **#16 (b) duplicate H1.** Do NOT touch `MathRenderer.tsx`: `JermilovaReviewPortal.tsx:819`
  renders through it and has NO other `<h1>`, so a global change deletes that page's only title.
  Instead add a pure `demoteLeadingH1(md)` helper (replaces a leading `# ` with `## `, no-op
  otherwise) and apply it ONLY at the Jurisdictional Frameworks call site (`~:1397`). All three
  source docs have exactly one `^# ` on line 1 (verified).
  TEST: unit-test the helper two-sided; assert the mocked MathRenderer receives a `## `-prefixed
  string (NOT the mock's rendered text -- the mock does not parse markdown, so a text check is
  vacuous); add a real-component render asserting no `heading level 1` and a `level 2`; and add
  a Jermilova regression asserting its `level 1` SURVIVES.

- **#18 (a) auth links into header.** Header at `page.tsx:9-17` is logo + ThemeToggle only.
  Delete the "Get Involved" box -- **range is `:128-150`**, comment at `:128`, opening
  `<div className="bg-sky-50 ...">` at `:129`, its closing `</div>` at `:150`. (`:151` is
  the PARENT container's closing tag: deleting `130-152` as an earlier draft of this plan
  said would orphan line 129 and consume the parent's close, breaking the JSX.) Add Log
  In / Create Account to the header reusing
  the existing sky-700 filled/outlined classes at smaller padding. No test collisions exist.
  `page.test.tsx:71-80` already anticipates a header nav.
  RISK: header becomes 4 children in a fixed `h-16` bar; "SSTAC & TWG Dashboard" is long --
  check 375px for wrap/clip in a real browser.
  TEST: assert `link.textContent` equals the label, not just an accessible name (guards against
  an icon-only button with a matching aria-label).

- **P1 (b) surface Review-candidate-defaults in the calculator body.** Extract the data +
  button out of `CalculatorValueSearchPanel.tsx` into a shared component; render it BOTH in the
  body (after `CalculatorSummaryBar`) and in the rail, so the action is reachable in two places
  rather than moved. Gating of reference DATA stands.
  **MUST land in the same commit as the e2e edit**: `e2e/matrix-options.spec.ts:37` clicks
  "Show Value Search panel" purely as a workaround for the gate; delete that line and its
  comment block (`:29-36`).
  RISK: two instances rendering at once makes the Playwright `getByRole(name:...)` query
  ambiguous -- add distinguishing testids if the rail can be open at that point in the flow.
  TEST: render Calculator WITHOUT Stage 3 and assert the button is present and `toBeVisible()`;
  must fail today. Do not settle for `toBeInTheDocument()`.

- **P2 (b) narrow-screen Stage-3 hint.** **Do NOT use `useIsMobile()`** -- it is 768px while the
  layout stacks the rail at 1024px (`lg`), so it under-triggers across 768-1023px. Use CSS
  `lg:hidden`. Render only when `calculatorRailOpen` is true.
  TEST: two-sided (present when Stage 3 reached, ABSENT when not). A class-string check is the
  ceiling in jsdom; real disappearance at desktop width needs a browser.

- **#20 (a) both padding layers.** Real sites are `MatrixDashboard.tsx:2257` (outer
  `px-8 py-12`) and `:1406` (`cardClassName` `p-8`) -- NOT the handoff's `:2234`/`:1395`. They
  stack on The Guide: 32px + 32px = 64px each side at any width (64/375 = the audited 17%).
  Use the file's own precedent (`:2041` `p-4 lg:p-8`).
  NOTE `:2257` is now shared with the Vision page -- check batch 1's matrix layout does not
  assume the fixed `px-8`/`max-w-7xl` pairing.
  TEST two-sided: assert the UNPREFIXED `p-8`/`px-8` is GONE, not merely that responsive
  classes were added (a lazy fix keeping the bare base would look identical and pass).

Effort: ~6-8 hrs plus one 375px browser pass covering #16, P1, P2, #20 together.

---

## SECTION B (14 landing-page requirements) -- waves

**Wave 0 -- ZERO collision with batch 1, can start immediately:**
- **B14 -- ALREADY IMPLEMENTED, DO NOT REDO.** Done on branch
  `feat/section-b-wave0-20260815` (worktree
  `C:\Projects\SSTAC-Dashboard-worktrees\section-b-wave0-20260815`), with 3 tests,
  falsified two-sided. **UNCOMMITTED** -- commit and push it before doing anything else in
  that worktree, or it will be lost. Details below are the original spec, kept for
  reference only.
  ThemeToggle `h-10 w-10` (40px) -> `h-11 w-11`. The class is on `ThemeToggle.tsx:11`
  (`:9` is the `<button` line).
  Shared with `Header.tsx:243,354` -- verify the `h-16` header row still balances. ~15 min.
- **B11** theme-flash bootstrap. `ThemeContext.tsx:16` defaults light and only reads storage in
  a post-mount effect (`:20-26`); `layout.tsx` has no inline head script (`suppressHydrationWarning`
  at `:22` silences the warning, it does NOT prevent the flash). Needs a synchronous inline
  `<script dangerouslySetInnerHTML>` in `<head>`.
  RISK: real CSP interaction -- check `next.config.ts`/middleware for a header that would block
  an unhashed inline script before implementing. ~1-1.5 hr.

**Wave A -- blocked on batch 1 (all touch `page.tsx`), one PR, copy/markup only:**
B1 sign-in-required labels on the 3 gated cards; B2 `<main>` + skip link (assert the skip
link's href matches the landmark id, not merely that an anchor exists); B3 heading hierarchy
(4 orphaned h3s, not 5 -- add an owning h2 for the card grid, promote "Get Involved" to h2);
B6 acronyms (TWG and BN-RRM never expanded anywhere; SSTAC is expanded only on its SECOND
occurrence); B7a footer (dynamic year, drop "all rights reserved"); B8 phase stated twice, not
three times (`page.tsx:27` and `ProjectPhases.tsx:14`); B9 five raw `<a>` -> `next/link`
(`Header.tsx` already does this correctly but is not rendered on this route).

**Wave B -- blocked, wants its own review:**
- **B4 contrast -- STILL OPEN, both cited failures.** My Active-chip fix was a THIRD separate
  issue. Current: `ProjectPhases.tsx:53-55` amber note `#D97706` on `#FFFBEB` = **3.07:1**;
  `:87` sub-bullets `#94A3B8` on `#F8FAFC` = **2.45:1**. Both light mode. Dark variants
  unverified. Fix by darkening text, then re-measure in a browser (do not trust the formula).
  TEST must compute contrast, not match class names (renaming to another failing class passes).
- **B10** delete `'use client'` from `page.tsx:1`. Trivially feasible -- the file has ZERO hooks
  and ZERO handlers; `ThemeToggle` and `ProjectPhases` already carry their own boundary. Isolate
  the commit anyway (RSC boundary change). No unit test can prove it; verify via build output.
- **B12** reduced-motion. Zero `prefers-reduced-motion` in `globals.css`; unconditional
  `hover:-translate-y-2`/`group-hover:scale-110` at `page.tsx:85,88,100,103,115,118`. Add a
  global media block. Verify with Playwright `emulateMedia({reducedMotion:'reduce'})`.

**Wave C -- needs scoping:** B7b contact + accessibility routes (neither exists).
**N/A:** B13 (preservation instruction, contingent on a redesign that was never scheduled).
**Already queued:** B5 = batch 2's #18.
