# Confirmation review -- round 2 (Leg 1a, independent adversarial, read-only)

Scope: exactly two correction commits.
  A. `git diff 04c9cc10..16281814` (PR #788, feat/audit-p0-20260816)
  B. `git diff 45293f1a..887d9265` (PR #787, feat/theme-cookie-20260816)

All line numbers below are as read from the commit tree
(`git show <sha>:<path>`), NOT from the worktree HEAD (87b8d2c8), which is a
different branch. Nothing was modified, staged, or run.

---

## FINDINGS

### P2-1. handleSave writes the poison before the antidote: a partial provenance-write failure still strands a legacy at-limit draft with no disclosure

`src/components/TWGReviewPortal.tsx:392-411` (at 16281814).

The corrected handleSave performs three independent, ordered writes:

    392  try { setItem(TRUNCATION_STORAGE_KEY, JSON.stringify(truncatedBy)) } catch { alert; return }
    402  try { setItem(UNKNOWN_PROVENANCE_STORAGE_KEY, JSON.stringify(unknownProvenanceKeys)) } catch { alert; return }
    412  try { setItem(DRAFT_STORAGE_KEY, JSON.stringify(comments)) } catch { alert; return }

The truncation record is the POISON in this defect class: once
`TRUNCATION_STORAGE_KEY` exists, the restore effect takes the `rawT !== null`
branch (line 171-183) and the at-limit re-derivation is permanently skipped for
that draft. The unknown-provenance record is the ANTIDOTE. The fix writes the
poison FIRST and the antidote SECOND, so there is a window in which the poison
lands and the antidote does not.

Concrete failure scenario (inputs -> wrong output):
1. Storage holds a legacy pre-provenance draft, e.g.
   `twg-matrix-review-draft-v6 = {"general":"x".repeat(5000)}`, and NO
   `-truncation` key and NO `-unknown-provenance` key. This is exactly the state
   the deployed build (`maxLength={5000}`) produces.
2. The reviewer mounts the page. `atLimitKeys = ['general']`, `rawT === null`,
   so `unknownProvenanceKeys = {general:true}` and the unknown-provenance
   `role="alert"` is shown. Correct.
3. The origin's localStorage is near its quota (the same precondition the
   already-accepted P1-3 scenario depends on), with free space in the narrow
   band that admits a ~44-byte new key but not a second ~60-byte new key. Or a
   second tab of the same origin consumes the remaining quota between the two
   synchronous calls.
4. The reviewer clicks Save Draft. Line 393 writes `-truncation = "{}"` and
   SUCCEEDS. Line 403 throws QuotaExceededError. The handler alerts "the draft
   was NOT saved either" and returns. Line 414 never runs, so the legacy draft
   is left untouched and still present.
5. Storage now holds: the legacy at-limit draft (present), `-truncation = "{}"`
   (present -- a positive statement from the current build that nothing was
   lost), `-unknown-provenance` (ABSENT).
6. Next mount: `rawT !== null`, so `atLimitKeys` is discarded exactly as in the
   original P1-1; `persistedUnknown` is empty, so line 219 does not fire.
   NO NOTICE. `unknownFields === 0`, `droppedTotal === 0`, so handleSubmit's
   confirmation gate at line 469 is skipped entirely and the possibly-clipped
   5000-character comment is written to `matrix_reviews` with no disclosure.
   This is byte-for-byte the outcome P1-1 and P1-3 describe, reached through a
   third door.

Fix is one line of ordering: write `UNKNOWN_PROVENANCE_STORAGE_KEY` FIRST, then
`TRUNCATION_STORAGE_KEY`, then the draft. Then the failure inverts correctly --
if the unknown write fails, the truncation key is never created, `rawT` stays
null, and the at-limit re-derivation still fires on the next mount. (Belt and
braces: on a later-write failure, `removeItem` the keys this save already
created.)

Why P2 and not P1: the reachable window is genuinely narrow. If free space is
below the first key's size, line 393 throws and the handler returns having
written nothing (safe). If free space exceeds both provenance keys, both land
and the ~100KB-plus draft write is the one that fails -- which is precisely the
case the new test at `src/components/__tests__/TWGReviewPortal.test.tsx`
(the "DRAFT write fails but the provenance writes succeed" test) covers and
closes. Only the roughly 60-byte band between those two produces the hole. The
IMPACT, however, is identical to P1-3 (permanent, silent, submitted
regulatory-review text), and the remedy costs one statement swap.

Falsifier for my own claim: show that a browser cannot fail `setItem` for a
~60-byte new key while having just succeeded on a ~44-byte new key in the same
synchronous block, and that no concurrent same-origin tab can consume quota
between two `setItem` calls. Either would reduce this to theoretical. Note that
the existing regression test suite cannot see this path at all -- the new
failure-injection test throws only for the draft key.

### P2-2. The cancelled-submit note now clips its own remediation instruction, and the clipped remainder is not reachable by keyboard

`src/components/TWGReviewPortal.tsx:853-858` (the `role="status"` note) and the
comment block at 682-700.

The bound is `max-h-24` (6rem = 96px) plus `overflow-y-auto`, on a `<p>` with
`text-xs` (0.75rem font, 1rem = 16px line-height) inside a `w-96` (384px) drawer
with `p-4` on the bar, i.e. about 352px of text width, roughly 55-60 characters
per line at 12px.

The shorter of the two note variants (unknown-provenance only) is about 400
characters -> about 7 lines -> about 112px. The combined variant (known count
AND unknown provenance, joined with "; and ") is longer still. So in the real
browser this note WILL overflow its 96px cap in the normal case, not the edge
case. What is below the fold is the tail:

  "... Otherwise, use the Dismiss control next to each notice to acknowledge
  the loss, then press Submit again to proceed."

That is the actionable instruction -- the one the P1-2 defect report itself
identifies as the reason the Dismiss controls must stay reachable. The fix
correctly stopped the bar from covering the Dismiss buttons, and in doing so
moved the clipping onto the sentence that tells the reviewer to use them.

The element has `overflow-y-auto` but no `tabIndex={0}`. A scrollable region
with no focusable descendant cannot be scrolled by keyboard (WCAG 2.1.1); a
sighted keyboard-only reviewer can never read the tail. Mouse users get a
scrollbar (an affordance, though a thin one). Assistive technology is not
affected -- `role="status"` puts the whole string in the accessibility tree
regardless of the visual clip.

This is the exact defect class in this project's own standing memory ("gates are
blind to silent-hiding defects": clipped text hides a correct value rather than
corrupting it), and no gate can see it -- jsdom has no layout engine, and the
new unit test asserts only that `max-h-24` and `overflow-y-auto` are present.

Minimal remedies: add `tabIndex={0}` to the note (keyboard scrollability), and
either raise the cap to `max-h-32` with `pb-56`/`pb-60` on the container, or
shorten the note so its worst case fits. Falsifier: render the longer note at
384px width in a real browser and measure `scrollHeight <= 96`; if it fits, this
finding collapses to the keyboard-affordance half only.

### P3-1. The production comment justifying the immediate dismissal write states a behaviour the code does not have

`src/components/TWGReviewPortal.tsx:338-345` claims the write exists so that
"a reviewer who dismisses without an intervening Save" does not see the notice
reappear on the next remount. That is false. In the no-Save state the truncation
key is still absent, so the next mount takes the `rawT === null` branch
(171-183), which UNIONs `atLimitKeys` into `persistedUnknown` and never
subtracts:

    177  const unknown = makeBareRecord<true>();
    178  for (const k of atLimitKeys) unknown[k] = true;
    179  for (const k of Object.keys(persistedUnknown)) unknown[k] = true;

A persisted `{}` is not a tombstone; it cannot suppress re-derivation. So
dismiss-then-reload-without-saving DOES bring the notice back. The persistence
only takes effect once a Save has created the truncation record -- which is
exactly the sequence the new test
("Dismiss ... is durable across a remount, after a Save Draft already persisted
it") builds, so the test authors evidently knew. The behaviour is safe-direction
(over-warning, never under-warning), so this is a comment defect, not a data
defect. Fix the comment, or add a real dismissal tombstone.

### P3-2. localStorage side effect inside a setState updater

`src/components/TWGReviewPortal.tsx:346-361`. `handleDismissUnknownProvenance`
performs the `window.localStorage.setItem` INSIDE the `setUnknownProvenanceKeys`
updater. React treats updaters as pure and may invoke them more than once
(StrictMode development double-invoke) or discard the resulting render under
concurrent rendering. The double-invoke case is harmless here (idempotent write
of the same value). The discarded-render case is not symmetric: the write has
already happened while the in-memory state may not settle, which would leave
storage saying "dismissed" while the UI still shows the notice -- an
under-warning direction on the next mount. Not observed, not reachable through
today's event-handler-only call site, but the pattern is wrong and cheap to fix:
compute `next` outside the updater, call `setUnknownProvenanceKeys(next)`, and
write after.

### P3-3. The #787 P3 ("assumes exactly two members") is closed in the bootstrap only; the same assumption survives in ThemeContext.tsx

`src/lib/themeBootstrap.ts` now uses
`e.classList.remove.apply(e.classList,VALID)` -- correct, length-agnostic, one
synchronous pre-paint statement, valid JS. But the identical hardcoded pair
remains at `src/contexts/ThemeContext.tsx:122` and `:124`
(`classList.remove('light', 'dark')` on documentElement and on body), and
`:85` still reads `classList.contains('dark') ? 'dark' : DEFAULT_THEME`. If
`VALID_THEMES` is widened to a third value, the bootstrap strips it correctly
and the provider's class-sync effect does not -- leaving two theme classes on
`<html>` one tick after hydration, which is the failure the bootstrap fix was
written to prevent. (`:156`'s `theme === 'light' ? 'dark' : 'light'` toggle is
inherently binary and is a separate design question, not this finding.) No
current-behaviour impact at today's two values.

### P3-4. Restored test name no longer describes what the test proves

`src/contexts/ThemeContext.test.tsx`, "uses themeBootstrap VALID_THEMES, not a
hardcoded accepted-value set". The test mocks `@/lib/theme`'s `parseTheme`, not
`VALID_THEMES`, and what it actually proves is that ThemeContext DELEGATES
validation to the imported `parseTheme`. The block comment above it says so
explicitly and honestly; only the `it()` string is stale. A later reader
grepping for VALID_THEMES coverage will be misled.

### P3-5. Informational: 04c9cc10 must not ship on its own

Verified: `git merge-base --is-ancestor 04c9cc10 origin/main` -> NO;
04c9cc10 appears only on feat/audit-p0-20260816 and two trial/stack* branches.
This matters because 04c9cc10 writes `-truncation` but never writes
`-unknown-provenance`. Any user who saved a legacy at-limit draft under 04c9cc10
would land on 16281814 with `rawT !== null` and no persisted unknown record --
i.e. the disclosure is unrecoverable for that cohort, and 16281814 contains no
migration for it. Because 04c9cc10 never shipped, this is currently vacuous.
It becomes real if the PR is split or the intermediate is deployed.

### P3-6. Typo in a load-bearing comment

`src/components/TWGReviewPortal.tsx:176`: "because the loss it is unknown".
ASCII-clean, but the sentence is broken in the comment that explains why the
branch does not gate on `atLimitKeys`.

### Not a finding, recorded because I checked it

The `pb-32`/`pb-52` arithmetic in the comment at 690-699 OVERSTATES the bar
chrome (it assumes `text-sm` on the buttons; the buttons carry no text-size
class, so the real content box is `py-2` 16px + ~24px normal line-height + 2px
border = ~42px, giving a ~75px bar rather than the stated ~82px). The error is
in the conservative direction, so `pb-52` (13rem = 208px) still clears the
stated 190px worst case and the real ~183px one, with room to spare. All the
units involved are rem-based (`pb-52`, `max-h-24`, `mb-3`, `p-4`, `py-2`,
`text-xs`), so the whole relationship scales together under a changed root font
size or browser zoom -- no hazard there. `pb-52` and `max-h-24` are both valid
Tailwind v4 utilities (dynamic spacing scale: 52 * 0.25rem = 13rem; 24 * 0.25rem
= 6rem), both appear as static literals so JIT will emit them, and Tailwind
emits `pb-*` after `p-*` so `pb-52` wins over the sibling `p-6` at equal
specificity -- the same mechanism the pre-existing `p-6 ... pb-32` already
relied on, and `cn`/tailwind-merge keeps both classes (which the test's baseline
`.pb-32` existence assertion confirms).

### Falsifiability audit of the new/restored tests

Every new test can be made to fail by a single production change. Specifically:

- "keeps the unknown-provenance notice after Save Draft and a remount": red if
  you delete the `setItem(UNKNOWN_PROVENANCE_STORAGE_KEY, ...)` at :403, OR the
  `setUnknownProvenanceKeys(persistedUnknown)` at :219.
- "keeps ... when the DRAFT write fails but the provenance writes succeed": red
  on the same two deletions; also pins the write ORDER relative to the draft.
- "Dismiss ... durable across a remount": red if you delete the `setItem` at
  :354. It correctly pairs an existence assertion (notice present after the
  first remount) with the absence assertion, per this project's standing rule.
- "bounds the cancelled-submit note height and grows the scroll container
  reservation": red if `max-h-24` or `overflow-y-auto` is dropped from the note,
  or if the container's conditional is reverted to a fixed `pb-32`. It also
  pairs existence (`.pb-32` present at baseline) with absence. It is a
  class-level contract only, which the test's own comment states plainly, and it
  is the RIGHT contract -- bounded note plus enlarged reservation is the only
  thing that can be asserted without a layout engine.
- stats.ts call-site pin: red if the trailing `unresolvedCensoring` argument is
  removed from the `recommendUcl(...)` call at `src/lib/matrix-map/stats.ts`
  (the parameter defaults to 0, so with the argument gone this fixture --
  n = 3, `hasCensored = false`, verdict from [1,2,3] -- reaches a real ProUCL
  branch and both `recommendedMethod === 'none'` and
  `basisString` not-matching-/ProUCL/ fail). The `n = 3` precondition assertion
  correctly rules out the unrelated `n < 2` guard producing the same 'none'.
- theme.test.ts "accepts a third theme value once VALID_THEMES includes it":
  red if `parseTheme` is reverted to `raw === 'dark' || raw === 'light'`. It
  mutates the REAL exported singleton rather than a double, which is what makes
  it a proof about production. Push/pop is in try/finally, vitest isolates
  module registries per file (no `isolate: false` in vitest.config.ts), and
  `THEME_BOOTSTRAP_SCRIPT` is materialised at import time, so the mutation
  cannot leak.
- ThemeContext "does not throw/crash when localStorage.setItem throws": red if
  the try/catch at ThemeContext.tsx:133-136 is removed.
- ThemeContext "uses themeBootstrap DEFAULT_THEME": red if `seedTheme`'s two
  fallbacks are reverted to the `'light'` literal (the mocked `'dark'` default
  would stop surfacing).
- ThemeContext "uses themeBootstrap VALID_THEMES" (misnamed, see P3-4): red if
  `readPersistedTheme`'s localStorage branch reimplements a literal check
  instead of calling the imported `parseTheme`.

No vacuous test found in either commit.

---

## CLOSED

- P1-1 (#788, disclosure erased by a successful Save): CLOSED. The
  unknown-provenance set is now persisted under its own key at
  TWGReviewPortal.tsx:403 and read UNCONDITIONALLY at :154-169, before the
  `rawT` branch, then applied on BOTH branches (:179 and :219). Traced every
  write (:354, :403, :575-577) and every read (:156) and every early return in
  the mount effect (:104 no draft, :106 non-object, :172-182 rawT-null branch,
  :220 catch): with a successful Save the notice survives arbitrarily many
  remounts. The `{}` truncation record still means exactly "nothing NEWLY lost",
  as the component's own comment requires, and cannot erase the separate record.
- P1-2 (#788, unbounded note in the absolute bottom bar covering the Dismiss
  controls): CLOSED as to the stated defect. The note is bounded (`max-h-24`
  + `overflow-y-auto`, :855) and the scroll container's reservation grows to
  `pb-52` when the note is present (:701). The arithmetic is conservative in the
  safe direction (documented 190px worst case vs a real ~183px; reservation
  208px), the units are all rem so it scales coherently, and the class-level
  test contract is the right one given jsdom has no layout engine. See P2-2 for
  the NEW clipping the fix introduces inside the note itself -- that is a new
  defect, not a failure to close this one.
- P1-3 (#788, disclosure erased by a FAILED save): CLOSED FOR THE STATED PATH,
  with a residual. The draft-write-fails-while-a-legacy-draft-exists path is
  genuinely closed and directly tested with failure injection, and the false
  claim in the old comment ("inert because the restore effect returns early")
  has been corrected in the comment at :381-391. The residual is P2-1 above: the
  provenance keys are written in the wrong order relative to each other, so a
  failure landing on the SECOND provenance write reopens the identical outcome.
- P2 (#788, `unresolvedCensoring` call-site never pinned): CLOSED. The new
  `stats.test.ts` block drives the real `computeSelectionStats ->
  computeBucket -> recommendUcl` path with three `censored: null` rows, asserts
  the parse precondition (`n === 3`, `unresolvedCensoring === 3`) so the `n < 2`
  guard cannot masquerade as the fail-closed guard, and asserts both the absence
  of a ProUCL citation and the presence of "unresolved". Deleting the trailing
  argument at the call site makes it red.
- P2 (#787, theme.ts not actually the single source of truth + three deleted
  regression tests): CLOSED. `parseTheme` now validates through
  `isValidTheme` against the real `VALID_THEMES` (theme.ts:60, 72-73), and
  the `'light'` fallbacks in `resolveTheme` (:78),
  `resolveThemeFromCookieHeader` (:124) and `seedTheme`
  (ThemeContext.tsx:84-85) are `DEFAULT_THEME`. Behaviour is preserved at
  today's values (`DEFAULT_THEME = 'light'`, `VALID_THEMES = ['light','dark']`)
  -- `parseTheme` returns `Theme | null` and still narrows via the type
  predicate rather than a cast, and null/undefined still return null.
  `src/lib/theme.ts` is still a leaf (no imports at all), so no cycle:
  theme.ts <- themeBootstrap.ts <- ThemeContext.tsx, one direction. All three
  deleted regression tests are restored, adapted, and falsifiable (see the
  audit above); the CLAUDE.md prohibition on deleting regression tests is
  satisfied.
- P3 (#787, `remove(VALID[0],VALID[1])` assumes two members): CLOSED IN THE
  BOOTSTRAP. `e.classList.remove.apply(e.classList,VALID)` is length-agnostic,
  remains a single synchronous statement after `var e=d.documentElement;` and
  before `e.classList.add(t)`, and the generated script is syntactically valid
  (`VALID` is a JSON array literal; `Function.prototype.apply` on a native
  DOMTokenList method is fine). The e2e theme-flash spec matches the script with
  a quote-agnostic regex and still passes. NOT closed in ThemeContext.tsx --
  see P3-3.

---

No P0 or P1 is outstanding. P2-1 is a real, permanent-consequence residual of
the P1-3 class with a one-statement fix and I would take it before merge, but
its trigger window is materially narrower than the path that was closed, and
P2-2 is an accessibility/legibility regression rather than a data-integrity one.

VERDICT: GREEN
