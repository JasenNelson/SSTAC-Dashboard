# Correction pass report -- PR #788, branch feat/audit-p0-20260816

## Commit

New commit SHA: `1628181481653161bc32b4b4d8b7527d14ff44ca` (short: `16281814`)
Parent: `04c9cc1062d6dc9b08c2494dfc4792f87e1104db`
Message subject: `fix(twg): persist unknown-provenance keys under their own storage key, and cap the cancelled-submit note`

Not pushed. Working tree clean after commit.

## Files changed (path-scoped stage, one commit)

- `src/components/TWGReviewPortal.tsx` -- 146 insertions(+), 17 deletions(-) (net diff lines per `git diff --stat`)
- `src/components/__tests__/TWGReviewPortal.test.tsx` -- 158 insertions(+)
- `src/lib/matrix-map/__tests__/stats.test.ts` -- 32 insertions(+)
- Total: `3 files changed, 319 insertions(+), 17 deletions(-)`

No other files were touched. `git status --short` before staging showed exactly these three
paths modified; nothing was staged with `git add .`/`-A`/`-u` -- each path was passed explicitly.

## Changes made

### Defect 1 & 2 (shared root cause) -- `TWGReviewPortal.tsx`

- Added `UNKNOWN_PROVENANCE_STORAGE_KEY = DRAFT_STORAGE_KEY + '-unknown-provenance'`, derived the
  same way `TRUNCATION_STORAGE_KEY` is, with a comment explaining why it must be a separate key
  rather than folded into the truncation record (an empty `{}` truncatedBy write must never be
  able to erase a nonempty unknown-provenance set).
- Mount effect: reads and validates the persisted set (own keys, string keys, reserved keys
  rejected, value must be exactly `true`) BEFORE the `rawT === null` branch, then unions it into
  `unknownProvenanceKeys` on BOTH branches. The at-limit string-shape re-derivation stays gated on
  `rawT === null` exactly as before -- that invariant was not touched or weakened. The new
  persisted set is applied independently of what the truncation record says.
- `handleSave`: added a second provenance write (`UNKNOWN_PROVENANCE_STORAGE_KEY`) between the
  existing truncation write and the draft write, with the same fail-closed ordering and alert/
  return-without-saving-draft behavior as the truncation write.
- `handleDismissUnknownProvenance`: now also writes the updated set to
  `UNKNOWN_PROVENANCE_STORAGE_KEY` immediately (best-effort, non-fatal on write failure), because
  the at-limit re-derivation runs on every mount where the truncation key is absent regardless of
  whether a Save has occurred -- without an immediate write, a dismissal with no intervening Save
  would reappear on the next remount.
- `handleSubmit` success path: added `window.localStorage.removeItem(UNKNOWN_PROVENANCE_STORAGE_KEY)`
  alongside the existing draft/truncation removals.
- Corrected the false claim in the `handleSave` comment ("the reverse orphan ... is inert") to
  state precisely when it holds (no prior draft existed) and when it does not (a legacy draft
  already exists and is left untouched by a failed write).

### Defect 3 (layout) -- `TWGReviewPortal.tsx`

- Cancelled-submit note (`role="status"`): added `max-h-24 overflow-y-auto` so its growth is
  capped at 96px and independently scrollable.
- Scroll container above the bottom bar: changed from a static `pb-32` to
  `cn('p-6 overflow-y-auto flex-1 space-y-6', submitCancelledNote ? 'pb-52' : 'pb-32')` -- static
  Tailwind class names selected by whether the note is present, no inline pixel styles, no
  ref-measurement effect.
- Arithmetic recorded in a comment above the container: bar chrome without the note is ~82px
  (p-4 padding + button row); with the note, worst case is max-h-24 (96px) + mb-3 (12px) = 108px
  added, so bar worst case = 82 + 108 = 190px, comfortably under the 208px `pb-52` reservation
  (18px buffer). Baseline `pb-32` (128px) is unchanged and still clears the 82px no-note case.

### Fourth item -- `stats.test.ts`

- Added `computeSelectionStats -- fail-closed recommendation when censoring is unresolved
  (recommend-ucl.ts call-site pin)` with 3 rows all `censored: null` (n = 3, so the `n < 2` guard
  is not what produces the result), asserting `recommendation.recommendedMethod === 'none'` and
  `basisString` does not match `/ProUCL/` but does match `/unresolved/i`. This goes through
  `computeSelectionStats` (the real production entry point), not `recommendUcl` directly.

## Falsification results (two-sided, each temporarily broken then restored)

1. **Legacy draft, Save Draft, remount -- notice still present.**
   Broke it by making the `UNKNOWN_PROVENANCE_STORAGE_KEY` write in `handleSave` a no-op.
   Failure seen: `AssertionError: expected null to deeply equal { general: true }` at the
   post-Save storage assertion (test:
   `keeps the unknown-provenance notice after Save Draft and a remount ...`).
   Restored the write; re-ran `-t "unknown-provenance notice"`: 4 passed / 39 skipped.

2. **Legacy draft, draft write throws but provenance writes succeed, remount -- notice still present.**
   Broken by the SAME no-op above (single root cause for both).
   Failure seen: `AssertionError: expected null to deeply equal { general: true }` at the same
   line pattern in the second test
   (`keeps the unknown-provenance notice when the DRAFT write fails ...`).
   Restored; re-ran the same filter: passed (see combined run below).

3. **Dismiss -> remount: gone and stays gone (paired with existence).**
   Broke it independently by short-circuiting the immediate write inside
   `handleDismissUnknownProvenance` (`if (false && typeof window !== 'undefined') { ... }`).
   Failure seen: `AssertionError: expected { general: true } to deeply equal {}` -- the persisted
   record still contained `general: true` after Dismiss, because it was never re-written.
   Restored (`if (typeof window !== 'undefined')`); re-ran `-t "Dismiss of the unknown-provenance
   notice is durable"`: 1 passed / 42 skipped.

4. **Defect 3 layout class-level test.**
   Broke it by reverting both the note's `max-h-24 overflow-y-auto` classes and the container's
   `pb-32`/`pb-52` toggle back to their pre-fix static forms.
   Failure seen: `Error: expect(element).toHaveClass("max-h-24") -- Received: text-xs
   font-semibold text-amber-700 dark:text-amber-400 mb-3` (the first assertion in the test tripped
   before the container-class assertions were reached, which is expected since the note-class
   check runs first).
   Restored both changes; re-ran `-t "bounds the cancelled-submit note height"`: 1 passed / 42
   skipped.

5. **stats.ts fail-closed integration test.**
   Broke it by dropping the trailing `unresolvedCensoring` argument at the `recommendUcl(...)`
   call site in `stats.ts` (defaults to 0).
   Failure seen: `AssertionError: expected 'chebyshev95' to be 'none'` -- with the argument
   dropped, the fail-open path proceeded past the guard and produced a real, ProUCL-cited
   recommendation (`ProUCL 5.2 Table 2-12: Nonparametric ... -> 95% Chebyshev UCL`) instead of the
   fail-closed `none`.
   Restored the argument; re-ran `-t "fail-closed recommendation"`: passed (see combined run
   below).

## Verification (final, after all restorations)

- `npx tsc --noEmit` -- clean, no output, exit 0.
- `npx eslint src/components/TWGReviewPortal.tsx src/components/__tests__/TWGReviewPortal.test.tsx src/lib/matrix-map/__tests__/stats.test.ts`
  -- clean, no output, exit 0.
- `npx vitest run src/components/__tests__/TWGReviewPortal.test.tsx src/lib/matrix-map/__tests__/stats.test.ts src/lib/matrix-map/__tests__/recommend-ucl.test.ts`
  -- `Test Files: 3 passed (3)`; `Tests: 128 passed | 1 skipped (129)`.
  Breakdown: `recommend-ucl.test.ts` 8 passed; `stats.test.ts` 78 tests (77 passed + 1 pre-existing
  skip, unrelated TODO placeholder for a worked-example dataset); `TWGReviewPortal.test.tsx` 43
  passed (39 pre-existing + 4 new).

Full unit suite, build, and e2e were intentionally NOT run, per the task's instruction that the
orchestrator owns those gates.

## Things chosen NOT to do, and why

- Did **not** make `handleDismissTruncation` (the truncation-count Dismiss handler) write
  immediately to `TRUNCATION_STORAGE_KEY` the way `handleDismissUnknownProvenance` now does.
  The task's required-fix list scoped "Wherever a notice is dismissed, remove that key from the
  persisted set" to the newly introduced unknown-provenance persisted set; `truncatedBy` has no
  equivalent re-derivation-on-every-mount hazard (the at-limit re-derivation only ever produces
  `unknownProvenanceKeys` entries, never `truncatedBy` entries), so a Dismiss there without an
  intervening Save cannot resurrect itself the same way. Changing that handler's persistence
  behavior was out of scope for the three named defects and risked touching behavior no defect
  description asked for.
- Did **not** add a rendered-browser / Playwright check for the Defect 3 geometry. Per the task's
  explicit instruction, jsdom has no layout engine and cannot see ancestor occlusion, so the new
  unit test only pins the class-level contract (bounded/scrollable note; reservation-class toggle
  driven by the note's presence). The real geometry (does `pb-52` actually clear the bar in a real
  browser) is left to the orchestrator's rendered check.
- Did **not** touch `recommend-ucl.test.ts` itself (only pointed the new test at
  `computeSelectionStats` in `stats.test.ts`, per the task's explicit instruction to go through
  the real production entry point rather than `recommendUcl` directly).
