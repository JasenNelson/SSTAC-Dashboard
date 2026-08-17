# Correction 788 round 2 report

Worktree: C:\Projects\SSTAC-Dashboard-worktrees\p0-audit-20260816
Branch: feat/audit-p0-20260816
New commit SHA: ae678fdf (full: run `git rev-parse ae678fdf` in the worktree for the 40-char form; short id confirmed via `git log --oneline -1`)
Parent commit: 16281814

## Files touched (exactly the two allowed)

- src/components/TWGReviewPortal.tsx: 63 lines changed (insertions+deletions per `git diff --stat`)
- src/components/__tests__/TWGReviewPortal.test.tsx: 99 lines changed (insertions+deletions per `git diff --stat`)

Total: 2 files changed, 131 insertions(+), 31 deletions(-)

## Defect 1 -- write order (handleSave, formerly lines ~392-411)

Fix: swapped the two provenance writes so `UNKNOWN_PROVENANCE_STORAGE_KEY` (the antidote) is
written first, then `TRUNCATION_STORAGE_KEY` (the poison), then the draft. Abort-on-failure
behaviour preserved for all three writes (each `catch` still alerts and `return`s before the
next write is attempted).

Comment updated in place: the existing "provenance before draft" explanation was kept verbatim
(still true, not the point being added), and a new paragraph was appended explaining the
antidote-before-poison ordering rule: a present-but-empty truncation record is a positive
"nothing lost" claim, so writing it before the antidote risks leaving the poison durably stored
with no antidote if the antidote write then fails.

## Defect 2 -- cancelled-submit note clipping (formerly lines ~853-858, container ~701)

Chosen classes and arithmetic:

- Panel content width: w-96 (384px) - p-4 bar padding (32px) = 352px of text width.
- At text-xs (12px font / 16px line-height): ~58 characters per line (352/6 approx).
- Realistic worst-case note text (both truncation + unknown-provenance sentences joined,
  largest plausible field counts): measured at 475-479 characters (Python len() check on the
  actual `noteParts.join('; and ')` template with plural forms and large numeric substitutions).
- Lines: ceil(479 / 58) = 9 lines = 144px of text.
- Note max-height chosen: **max-h-40 (10rem = 160px)** -- 16px/one-line buffer over the 144px
  computed worst case.
- Note's worst-case contribution to the bar: 160 (max-height) + 12 (mb-3) = 172px.
- Bar worst-case total: p-4 top (16) + note max-height (160) + mb-3 (12) + button row (~40) +
  p-4 bottom (16) = 244px.
- Reservation class chosen: **pb-72 (18rem = 288px)** -- 44px buffer over the 244px computed
  worst case (next Tailwind scale step above pb-64/256px, which would leave only 12px).

Also added: `tabIndex={0}` on the bounded `<p role="status">` scroll region, so a keyboard-only
reviewer can focus and scroll it. `overflow-y-auto` kept as backstop for pathologically long
notes beyond the 479-char estimate. No inline styles, no measurement effect -- static Tailwind
classes only, per the hard limit.

Arithmetic comment above the scroll container (`pb-32`/`pb-72` toggle) and the note's own
comment were both rewritten with these new numbers.

## Tests added/updated

1. NEW: "writes the antidote before the poison: an antidote-write failure must leave no
   truncation record and no resumable draft, and disclosure must survive the next mount (order
   regression guard)" -- mocks storage to throw only on `UNKNOWN_PROVENANCE_STORAGE_KEY` while
   passing every other key through to the real `setItem`. Distinguishes ordering because: with
   the antidote written first (the fix), the throw aborts the save before the truncation write
   is ever attempted, so `TRUNCATION_STORAGE_KEY` stays absent and the legacy draft's disclosure
   re-derives correctly on the next mount; with the poison written first (the bug), the
   truncation write would have already durably succeeded before the antidote throw, leaving
   `TRUNCATION_STORAGE_KEY` = "{}" and losing the disclosure on the next mount.

2. UPDATED: the DEFECT-3-renamed-to-DEFECT-2 height/reservation test ("bounds the
   cancelled-submit note height, makes it keyboard-focusable, and grows the scroll container
   reservation when the note is present") -- now asserts `max-h-40` (not `max-h-24`), `pb-72`
   (not `pb-52`), and `tabIndex="0"`.

All other existing tests in the ordering family (FIX 5, the pre-existing "order regression
guard" for provenance-before-draft, and the unknown-provenance persistence tests) were checked
against the new code and continue to pass unmodified -- their mocks either throw on a specific
key that is unaffected by the antidote/poison sub-ordering, or delegate other keys to the real
`setItem`, so they were not sensitive to which of the two provenance writes goes first.

## Falsification (two-sided)

### Defect 1 test

- Reintroduced the bug (truncation write first, then unknown-provenance write) and ran the new
  test alone. It FAILED with:
  `AssertionError: expected '{}' to be null` at
  `TWGReviewPortal.test.tsx:1187` (the `TRUNCATION_STORAGE_KEY` getItem assertion) -- proving the
  poison had been durably written before the antidote write threw, under the wrong order.
- Restored the fix and re-ran: PASSED.

### Defect 2 test

- Reintroduced the bug (`max-h-24` on the note, `pb-52` on the container, removed `tabIndex`)
  and ran the updated test alone. It FAILED with:
  `Error: expect(element).toHaveClass("max-h-40") -- Received: text-xs font-semibold
  text-amber-700 dark:text-amber-400 mb-3 max-h-24 overflow-y-auto` at
  `TWGReviewPortal.test.tsx:1321`.
- Restored the fix and re-ran: PASSED.

Full suite after restoring the fix: 44/44 passed.

## Verification outcomes

1. `npx tsc --noEmit` -- clean, no output, exit 0.
2. `npx eslint src/components/TWGReviewPortal.tsx src/components/__tests__/TWGReviewPortal.test.tsx`
   -- clean, no output, exit 0.
3. `npx vitest run src/components/__tests__/TWGReviewPortal.test.tsx` -- 44 tests, 44 passed,
   1 file passed, ~1.3s test duration.

## Notes

- No push, no rebase performed. Working tree left clean after commit (backup file
  `TWGReviewPortal.tsx.bak` created during falsification was removed before the final commit).
- `git add -- src/components/TWGReviewPortal.tsx src/components/__tests__/TWGReviewPortal.test.tsx`
  used for explicit path-scoped staging; no `git add .`/`-A`/`-u`.
