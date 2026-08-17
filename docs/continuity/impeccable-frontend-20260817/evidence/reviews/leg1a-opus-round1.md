# EXACT-TARGET ADVERSARIAL PRE-LANDING REVIEW -- findings (Leg 1a, Opus)

Reviewed frozen identities: 120c6f9a (origin/main), 6caaa34e (#782), 45293f1a (#787),
87b8d2c8 (#785), 04c9cc10 (#788), 0d2d85e8 (trial/stackA), d4397227 (trial/stackB).
Every claim below was checked against the files at their real state via `git show <sha>:<path>`,
not against the embedded diffs alone.

---

## FINDINGS

### P1-1 -- Saving a draft PERMANENTLY DESTROYS the unknown-provenance disclosure that #788 exists to create

SEVERITY: P1
LEVEL: TARGETED
FILE: `src/components/TWGReviewPortal.tsx:130-140` (restore branch) and
`src/components/TWGReviewPortal.tsx:320` (the only provenance write)

`unknownProvenanceKeys` is derived at mount ONLY when the truncation key is absent
entirely (`rawT === null`, line 130). In the `rawT !== null` path (lines 141-171) the
`atLimitKeys` array computed at lines 106/115 is never read at all, and
`setUnknownProvenanceKeys` is never called. `handleSave` (line 320) persists
`JSON.stringify(truncatedBy)` and NOTHING ELSE -- `unknownProvenanceKeys` is never
persisted anywhere in the file (grep of the whole file: the identifier appears only at
76, 284, 381, 648, 713).

Concrete failure scenario, inputs and wrong output:

1. Reviewer is on the CURRENTLY DEPLOYED build (main), which has `maxLength={5000}` on the
   textareas, so any over-long paste is silently clipped to EXACTLY 5000 characters and
   saved. localStorage now holds
   `twg-matrix-review-draft-v6 = {"general":"<5000 chars>"}` and NO
   `twg-matrix-review-draft-v6-truncation` key. This is not a hypothetical population: it
   is exactly the population #788's unknown-provenance feature was written for, and the old
   `maxLength` guarantees its drafts land on exactly 5000.
2. #788 ships. Reviewer opens the TWG portal. `rawT === null`, `atLimitKeys = ['general']`
   -> the `role="alert"` unknown-provenance notice renders ("An unknown amount of text may
   be missing"), and `handleSubmit`'s gate would fire. Correct so far.
3. Reviewer clicks **Save Draft** -- the most ordinary action in this component, and the one
   the amber banner at line 594 explicitly invites ("Reviews can be saved and updated at any
   time"). `truncatedBy` is empty, so line 320 writes the literal string `{}` to
   `twg-matrix-review-draft-v6-truncation`.
4. Reviewer closes the tab and resumes later (or another tab remounts). Now
   `rawT === "{}"` , so the code takes the `rawT !== null` path, `atLimitKeys` is discarded,
   `unknownProvenanceKeys` stays empty, `truncatedBy` stays empty.
   **Wrong output: no alert, no submit confirmation, and the possibly-clipped comment is
   written to `matrix_reviews` with no disclosure whatsoever.**

This is the exact defect class the code's own comment forbids. Lines 122-129 state that a
present-but-empty record "is a positive statement that nothing was lost, and must keep
meaning exactly that". Step 3 makes the component ITSELF emit that positive statement about
a field whose loss it had just declared unknowable. The action that erases the disclosure is
a save, and a save is the one action the feature assumes is safe.

No test covers it. The suite tests legacy-draft -> flagged, `{}`-present -> not flagged, and
Dismiss -> cleared. It never runs legacy-draft -> Save -> remount. The absence check
("does NOT flag unknown provenance when an empty truncation record ({}) is present") is
paired with an existence check for a DIFFERENT input, not for the same draft after a save.

WHAT WOULD FALSIFY THIS: a re-derivation of at-limit keys in the `rawT !== null` path (i.e.
flagging an at-limit key that has no entry in the parsed record), or a persistence of
`unknownProvenanceKeys` under its own key, anywhere in the file. Neither exists at
04c9cc10. Alternatively, evidence that no v6 draft can ever sit at exactly MAX_CHARS -- but
the pre-#788 `maxLength={5000}` guarantees the opposite.

### P1-2 -- The cancelled-submit note grows the absolutely-positioned action bar past the scroll container's clearance, occluding the Dismiss controls it tells the reviewer to use

SEVERITY: P1
LEVEL: TARGETED
FILE: `src/components/TWGReviewPortal.tsx:739-746` (the bar, now variable-height) against
`src/components/TWGReviewPortal.tsx:598` (the scroll container's fixed `pb-32`)

Before #788 the bottom bar was a single button row: `absolute bottom-0 left-0 right-0 p-4`
plus one `py-2 text-sm` row, i.e. about 32 + 36 = 68px. The scroll container above it
(line 598, `p-6 overflow-y-auto flex-1 space-y-6 pb-32`) reserves 128px (`pb-32` = 8rem),
so there was roughly 60px of slack.

#788 inserts a `text-xs ... mb-3` paragraph INSIDE that same absolutely positioned bar
(lines 740-746) whose content is built at lines 429-435. Its narrowest realistic form is
about 372 characters:

    Submission was not sent: 1,000 characters are still missing from 1 comment field.
    Editing a field will NOT remove these warnings -- they carry forward across edits. If
    you still have the missing text, paste it back in (a shorter draft may fit under the
    limit). Otherwise, use the Dismiss control next to each notice to acknowledge the loss,
    then press Submit again to proceed.

The panel is `w-96` (384px, line 585); minus the bar's `p-4` the text box is 352px. At
`text-xs` (12px / 16px line-height) that is roughly 58 characters per line -> 7 lines ->
112px, plus `mb-3` (12px). Bar height becomes about 32 + 124 + 36 = 192px against 128px of
reserved clearance: **roughly 64px of the scroll container's content tail is covered even
when scrolled fully to the bottom, and cannot be scrolled clear because `pb-32` is the
whole reservation.** Even a conservative 4-line note (80 + 12px) exceeds the clearance.

Concrete failure scenario: a document with several `## ` headings; the reviewer over-pastes
into the LAST section's textarea, presses Submit, and declines the confirmation. The note
appears, the bar grows, and the bottom ~64px -- which is precisely that last field's
`role="alert"` line and its `Dismiss truncation notice for <label>` button (lines 692-736)
-- is hidden behind the note. If the field also carries an unknown-provenance notice
(lines 713-736) the occluded region is larger. The reviewer is instructed by the note to use
a control the note is covering, and there is no other non-submit way to clear the record
(handleCommentChange deliberately never clears it; see lines 208-250).

This is invisible to every gate in the repo: jsdom has no layout engine, so
`toBeVisible()` on the Dismiss button passes while an ancestor overlays it, and the new
tests assert presence and click it programmatically (which ignores occlusion). There is no
e2e coverage of the TWG portal's right panel at all.

WHAT WOULD FALSIFY THIS: a rendered-browser measurement in a 384px-wide panel showing the
bar's `offsetHeight` at or below 128px with the note displayed, or a `max-h`/scroll on the
note, or a matching increase of the container's `pb-32`. None of those exist at 04c9cc10.
The claim is a layout computation, not a measurement -- it is the one finding here that a
single browser check could overturn.

### P2-1 -- #782 landing ALONE introduces a WCAG 4.1.2 wrong accessible name (and wrong glyph) on a dark page that main does not have

SEVERITY: P2 as delivered (the plan lands #782 and #787 together); **escalates to P1 if #782
is merged without #787 in the same operation**
LEVEL: STRATEGIC
FILES: `src/contexts/ThemeContext.tsx` at 6caaa34e (`useState<Theme>(DEFAULT_THEME)` and the
`!mounted` provider value `theme: DEFAULT_THEME`), `src/components/ThemeToggle.tsx:19-20`
and `:35` / `:51` at 45293f1a (unchanged since #782)

At 6caaa34e the provider's state starts at `DEFAULT_THEME` = `'light'` and only reaches the
real value in the post-mount effect; the pre-mount branch hands consumers
`theme: DEFAULT_THEME` explicitly. `ThemeToggle` derives BOTH halves of its identity from
that value: `aria-label`/`title` = `Switch to ${theme === 'light' ? 'dark' : 'light'} mode`
(lines 19-20) and the moon path `M20.354 15.354...` (line 35) versus the sun path
`M12 3v1m0 16v1...` (line 51).

Inputs: a returning user with `localStorage.theme === 'dark'`, JS enabled, cold cache.
The #782 bootstrap sets `<html class="dark">` synchronously in `<head>`, so the FIRST PAINT
is dark. The server-rendered markup and React's first client render both say `'light'`.
Wrong output: on an already-dark page the button is announced as "Switch to dark mode" and
draws a moon, for the whole interval between first paint and the mount effect -- i.e. for
however long the JS bundle takes to download, parse and hydrate, which on a slow connection
is seconds, not a frame.

On main (120c6f9a) this cannot happen: with no bootstrap the page is light during that same
window, so "Switch to dark mode" is CORRECT. #782 alone therefore trades a flash for a new
accessible-name defect. The reading that #782 is "self-consistent and safe to merge now" is
not supported by the code: it is self-consistent only in the sense that both halves say
'light', which is exactly the problem once the bootstrap has made the page dark. #787 is
what closes it, by seeding state during render (`seedTheme`, ThemeContext.tsx:81-95) and by
handing out the seed rather than the literal in the unmounted branch (line 172).

WHAT WOULD FALSIFY THIS: evidence that the mount effect runs before first paint (it cannot;
`useEffect` is post-commit and hydration cannot precede the synchronous `<head>` script), or
that no user reaches the dark first paint with a 'light' render 0 -- but that population is
the entire target of #782.

### P2-2 -- #787 deletes three regression guards while the code they guarded remains, and re-introduces the hardcoded literals its own commit message says it removed

SEVERITY: P2
LEVEL: STRATEGIC
FILES: `src/contexts/ThemeContext.test.tsx` at 45293f1a (describe blocks: lines 63, 149,
273 only); `src/lib/theme.ts:60`, `:65`, `:111`; `src/contexts/ThemeContext.tsx:84-85`

Commit 45293f1a is titled "restore one source of truth for the theme value set after the
rebase", and `src/lib/theme.ts:34-38` claims "Every consumer that needs to know 'what are
the valid theme values' or 'what do we default to' imports these two constants ... instead
of retyping the literals". Three consumers in that same file and its client re-typed them:

- `theme.ts:60` -- `parseTheme` validates with `raw === 'dark' || raw === 'light'`, not
  against `VALID_THEMES`.
- `theme.ts:65` and `theme.ts:111` -- `resolveTheme` and `resolveThemeFromCookieHeader`
  fall back to a hardcoded `'light'`, not `DEFAULT_THEME`.
- `ThemeContext.tsx:84-85` -- `seedTheme` returns hardcoded `'light'` twice.

Meanwhile #787 removed, from `ThemeContext.test.tsx`, BOTH `vi.doMock`-based structural
tests that #782 added specifically to prove ThemeContext consumes `DEFAULT_THEME` and
`VALID_THEMES` through the import rather than from its own literals (they are gone; no
`doMock` remains in the file), AND the "does not throw/crash when localStorage.setItem
throws (Safari private mode, blocked cookies)" regression test -- while the `try`/`catch` it
guarded is still in the code at `ThemeContext.tsx:135-139`, its explanatory comment reduced
to `// Safari private mode.`. That is a regression test deleted without the feature being
removed, which this project's CLAUDE.md forbids outright.

Concrete drift scenario: add `'sepia'` to `VALID_THEMES`. The generated bootstrap script
accepts a `theme=sepia` cookie (`VALID.indexOf(v)!==-1`, themeBootstrap.ts:92) and puts
`class="sepia"` on `<html>`, while the server (`resolveThemeFromCookieHeader` ->
`parseTheme`) resolves `'light'` and renders `class="light"`, and ThemeProvider seeds
`'light'`. Wrong output: server/client theme disagreement on every request for that user,
plus the wrong ThemeToggle label -- the precise defect D2 exists to fix. `parseTheme`
returning a subset of a widened `Theme` union still typechecks, so `tsc` is silent, and the
parity corpus (themeBootstrap.test.ts) contains no `sepia` row, so it is silent too.

This is a P2 rather than P1 because today's divergence class IS caught: the corpus rows
`theme=chartreuse -> light` and `theme= -> light` compare `readThemeCookie` against the
bootstrap's DEF, so changing `DEFAULT_THEME` alone fails several tests loudly. It is the
value-SET axis that is unguarded.

WHAT WOULD FALSIFY THIS: a test anywhere in the tree that mocks or widens `VALID_THEMES` and
asserts the server/client resolvers follow it. `git grep VALID_THEMES` at 45293f1a returns
only theme.ts, themeBootstrap.ts and themeBootstrap.test.ts's text-matching assertions.

### P3-1 -- The bootstrap's class removal was de-generalised from "all valid themes" to exactly two indices, and the drift guard cannot see it

SEVERITY: P3
LEVEL: TARGETED
FILE: `src/lib/themeBootstrap.ts:92` (tail: `e.classList.remove(VALID[0],VALID[1])`)

#782 wrote `e.classList.remove.apply(e.classList, v)`, which removed every member of the
value set whatever its length. #787 replaced it with two positional reads. With a third
theme value the stale class is never removed, so `<html>` can carry two theme classes at
once -- and `expect(THEME_BOOTSTRAP_SCRIPT).toContain(JSON.stringify(VALID_THEMES))`
(themeBootstrap.test.ts:117) still passes, because the array literal is still interpolated.
The "does not leave both classes on <html>" test only ever exercises light/dark.
FALSIFIED BY: restoring `.apply(...)`, or a test that adds a third value and asserts single-
class output.

### P3-2 -- `unresolvedCensoring` counts rows that are excluded from `n`, so the fail-closed message can be arithmetically impossible

SEVERITY: P3
LEVEL: TARGETED
FILES: `src/lib/matrix-map/stats.ts:337-340` (counter) vs `stats.ts:371` (`const n =
rawParsed.length`) and `src/lib/matrix-map/recommend-ucl.ts:43`

The counter increments for every row whose `censored` is neither `true` nor `false`,
including rows that the same loop then drops via `excludedCount++; continue;` because
`row.value` did not parse. `n` counts only rows that survived. Inputs: 4 rows, 2 of them
`censored: null` with unparseable values, 2 clean detects -> `unresolvedCensoring = 2`,
`n = 2`. With 3 such rows and 2 clean: `unresolvedCensoring = 3`, `n = 2`, and the emitted
string reads "Censoring status is unresolved for 3 of 2 row(s)". It also withholds the UCL
because of rows that contributed nothing to the bucket. Both are the SAFE direction and the
whole branch is unreachable while the DB column is `NOT NULL`
(supabase/migrations/20260519000001_matrix_map_schema.sql:368, verified), so this is a note,
not a blocker. FALSIFIED BY: moving the counter inside the two accept branches.

### P3-3 -- The fail-closed guard suppresses the UCL only on the `recommended` pathway

SEVERITY: P3
LEVEL: STRATEGIC
FILES: `src/lib/matrix-map/recommend-ucl.ts:40-46` and
`src/components/matrix-options/MatrixMapSelectionStats.tsx:273-275`

`activeMethod = selectedMethod === 'recommended' ? bucket.recommendation.recommendedMethod
: selectedMethod`. With `recommendedMethod: 'none'` and `selectedMethod === 'recommended'`,
`uclValue` stays `null` and no UCL is shown -- the guard does turn the UCL off. But if the
user has manually selected a method, the UCL is still computed and displayed (the
computations at stats.ts:635+ run regardless), alongside the guard's honest basis string.
Unreachable today; recorded because "turns the UCL OFF" is only true for the default
selection. FALSIFIED BY: a `recommendation.recommendedMethod === 'none'` check at the
`activeMethod` site.

### P3-4 -- A stale positional truncation count can be persisted and resurface against a different section of the same draft-key version

SEVERITY: P3
LEVEL: TARGETED
FILE: `src/components/TWGReviewPortal.tsx:376-383` (dialog scoping) and `:320` (write)

`relevantEntries` correctly excludes `h::<idx>` keys with no currently-rendered heading from
the dialog and the inline alert, but `handleSave` persists the UNFILTERED `truncatedBy`. If
`finalDraftContent` changes without a `DRAFT_STORAGE_KEY` bump (the exact scenario the FIX 3
test simulates with `rerender`), a stale `h::1` count is written and later restored against
whatever section now occupies index 1 -- reporting a loss that never happened for that
field. Over-warning, i.e. the safe direction, and the key-derivation comment at lines 32-43
only addresses the case where the draft key DOES bump. FALSIFIED BY: filtering `truncatedBy`
to rendered heading keys before the write.

### P3-5 -- After #787 the build route table will contain no "(Static)" line, which is one of the three BUILD corroboration markers

SEVERITY: P3
LEVEL: HOLISTIC
EVIDENCE: `.tmp/gate-logs/triage-six/RESULT.txt` (`BUILD_MARKERS route_table=1
static_pages=5 first_load_js=2`, `BUILD_CORROBORATION=OK`) at FROZEN_HEAD 87b8d2c8, versus
`src/app/layout.tsx:47-48` at 45293f1a

Reading `headers()` in the root layout makes all 15 previously-static routes dynamic (the
layout comment states this and the owner approved it). Next only prints a legend entry for
symbols the table actually uses, so `static_pages` becomes 0 on post-#787 builds. If the
mission-control gate script treats that marker as required corroboration, the BUILD gate on
main will report a corroboration failure after landing; if it does NOT (which the reported
GREEN on trial/stackB implies), then a corroboration marker silently went to zero and
nothing noticed -- the same shape as the recorded "BUILD had no pass count in all 5 runs"
incident. FALSIFIED BY: the `BUILD_MARKERS` line in the trial/stackB build log. Either
outcome is worth one look before the owner reads a post-merge GREEN.

### P3-6 -- No gate has ever run on a tree containing BOTH stacks

SEVERITY: P3
LEVEL: HOLISTIC

Verified there is no textual overlap: `comm -12` over the two changed-file lists is empty,
and no test in stack A reads any file stack B changes (`git grep readFileSync` sweep;
`printCapSweep.test.ts` is scoped to SsdWorkbench.tsx + EvidenceLibrary.tsx only, and
`performance.test.ts` inspects only `.next/static/chunks` sizes, never the prerender
manifest or route table). The one shared surface is `src/app/__tests__/page.test.tsx`
(stack A) which imports the real `ThemeProvider` (stack B) -- compatible, since
`initialTheme` is optional and `seedTheme` degrades to a `classList` read. Residual risk is
low, but the six gates should be run once on main after all six merges rather than inferred
from two disjoint trial trees.

---

## Verified NOT defects (checked because the code makes a load-bearing claim)

- `MatrixMapRightPanel.tsx:808-818`'s claim that adding a print reset would be a no-op is
  TRUE: `MatrixMapRightPanel` has exactly one render site (`MatrixDashboard.tsx:1831`), it
  sits inside the `case 'Interactive Map'` arm of `renderContent()`, and the only tabpanel
  that renders `renderContent()` for `isMapMode` is `MatrixDashboard.tsx:2302`, whose
  className is `flex-1 flex overflow-hidden print:hidden`.
- `SsdWorkbench.tsx:2249`'s claim is TRUE on both halves: the container at line 2232 carries
  `max-h-44 overflow-auto print:max-h-none print:overflow-visible`, and
  `hcp.ts:375` sets `excludedRecordCount: excludedRecords.length`, so the tile and the table
  now agree.
- `themeBootstrap.ts`'s CSP note matches reality: `src/middleware.ts:11` includes
  `'unsafe-inline'` in `script-src`, and the matcher at `src/middleware.ts:155-164` is
  exactly the eight prefixes named, so `/`, `/login`, `/signup` and `/cew-polls/*` emit no
  CSP at all.
- `stats.ts:84-90`'s NOT NULL claim matches
  `supabase/migrations/20260519000001_matrix_map_schema.sql:368`
  (`censored boolean NOT NULL DEFAULT false`), and the TS widening is real
  (`src/stores/matrix-map/measurementStore.ts:25`).
- No route sets `dynamic = 'force-static'` or `'error'`, and there is no
  `sitemap`/`robots`/`opengraph-image` route, so `headers()` in the root layout cannot break
  the build.
- Deliberately not re-reported per the brief: the statistical TREATMENT of an unresolved
  censoring row (the descriptive statistics still fold a `censored: null` row in as a
  detect while the new cell says "unknown"), the cross-tab concurrent-save pairing, the four
  BN-RRM findings, and the 26 remaining audit findings.

---

## ANSWERS

### 1. Are #782 and the corrected #787 safe ONLY as a coupled landing unit?

Yes, and the code supports the challenge, not the "self-consistent and safe to merge now"
reading. See P2-1 for the full trace. In short: at 6caaa34e `ThemeProvider` initialises state
to `DEFAULT_THEME` (`'light'`) and its pre-mount branch hands consumers
`theme: DEFAULT_THEME` explicitly, while the new `<head>` bootstrap has already put
`class="dark"` on `<html>` before first paint. `ThemeToggle` at
`src/components/ThemeToggle.tsx:19-20` derives its accessible name from that value and at
`:35`/`:51` its glyph, so a stored-dark user gets "Switch to dark mode" plus a moon on an
already-dark page for the entire pre-hydration window. Main does not have this defect,
because without a bootstrap the page is light during that window and the label is correct;
#782 alone converts a visual flash into a WCAG 4.1.2 name/state mismatch. #787 is the fix
(`seedTheme`, `ThemeContext.tsx:81-95`, plus handing out the seed at `:172`). Land them
together.

### 2. Did the corrected #787 preserve the quote-agnostic assertion and a real drift guard? Is `src/lib/theme.ts` a leaf?

(a) PRESERVED. `e2e/theme-flash.spec.ts:215` at 45293f1a still reads
`/localStorage\.getItem\(\s*['"]theme['"]\s*\)/`, and the surrounding assertions still test
POSITION (`:222-223`, `scriptAt < headEnd` and `scriptAt < bodyStart`), not mere presence.

(b) A real guard exists, and it is stronger than #782's on the axis that matters most, but it
is incomplete in a named way.
- Present: `themeBootstrap.test.ts:116-118` asserts the script text contains
  `JSON.stringify(THEME_STORAGE_KEY)`, `JSON.stringify(VALID_THEMES)`, and -- anchored --
  `` `DEF=${JSON.stringify(DEFAULT_THEME)}` ``. The anchoring is genuinely load-bearing:
  `"light"` occurs inside `["light","dark"]`, so the unanchored form was self-satisfying.
- Present and stronger: the 18-row PARITY CORPUS (`themeBootstrap.test.ts`, the
  "cookie-parsing parity" describe) runs each cookie header through BOTH `readThemeCookie`
  and the bootstrap script executed in jsdom, recovering the bootstrap's tri-state verdict by
  running it twice (empty store vs a `'dark'` sentinel). That catches the cookie NAME, the
  trim rule, first-duplicate-wins, the no-percent-decode rule and the valueless-pair rule.
  A cookie-attribute guard also exists (script text must contain
  `themeCookieString('dark', false)`'s attribute tail).
- WOULD IT FAIL IF SOMEONE HARDCODED ONE INTERPOLATION? It fails on DIVERGENCE, not on
  DE-DERIVATION. Hand-writing `DEF='light'` (single quotes) fails, because `JSON.stringify`
  emits double quotes. Hand-writing `DEF="light"` or `["light","dark"]` verbatim passes,
  because the text is byte-identical -- so the guard proves the script AGREES with the
  constants today, not that it is generated from them. That is the correct property to care
  about, and it is enforced; the residual gap is the value-SET axis (P2-2) plus the
  positional `remove(VALID[0],VALID[1])` (P3-1). #787 also DELETED #782's two
  `vi.doMock`-based structural guards over ThemeContext and the localStorage-write
  regression test while keeping the code they guarded (P2-2).

(c) LEAF: yes. `git show 45293f1a:src/lib/theme.ts` contains no `import` and no `require`.
The dependency direction is `theme.ts` (leaf) <- `themeBootstrap.ts` <- `ThemeContext.tsx`,
with `ThemeContext.tsx` also importing `theme.ts` directly (lines 4-5) and `layout.tsx`
importing both. No cycle.

### 3. Is #788's fail-closed provenance behavior correct, and proportionate?

Correct and proportionate, with two P3 caveats.

- PREMISE VERIFIED, not taken on trust: `supabase/migrations/20260519000001_matrix_map_schema.sql:368`
  is `censored boolean NOT NULL DEFAULT false`, and the TS widening to `boolean | null` is
  real (`src/stores/matrix-map/measurementStore.ts:25`). So the branch is genuinely
  unreachable today, and the guard is an invariant made executable rather than a live fix.
- PLACEMENT: `recommend-ucl.ts:26-31` is the `n < 2` guard; the new guard is
  `recommend-ucl.ts:40-46`, immediately after it and BEFORE `const dCount = ...` (line 48)
  and before every pathway branch (the Section 1.12 branch at 51, the censored pathway from
  62, the uncensored pathway after). Correct: no pathway can be entered, so no ProUCL
  section can be cited either way. The ordering relative to `n < 2` is also right -- an
  n<2 bucket already returns `'none'` with a citation-free basis string.
- NO CALLER NEEDS CHANGING: `recommendUcl` has exactly one non-test caller
  (`stats.ts:619-629`), which now passes the counter as the ninth argument; the parameter is
  defaulted to `0`, so any future caller is safe by construction. `recommendedMethod: 'none'`
  is a pre-existing value produced by two other branches, and
  `MatrixMapSelectionStats.tsx` already handles it by leaving `uclValue` null.
  `unresolvedCensoring` has exactly one construction site in `DescriptiveStats`
  (`stats.ts:570`), and nothing iterates the descriptive object generically, so the new
  required field cannot surface as an unexpected table row or export column.
- NO CALCULATION CHANGES FOR RESOLVED DATA: the counter increments only when
  `row.censored !== true && row.censored !== false` (`stats.ts:337-340`) and the comment is
  accurate -- the row's downstream handling is untouched. With `unresolvedCensoring === 0`
  the function is byte-for-byte the previous behaviour, and the paired regression test
  ("the same otherwise-Normal dataset ... is unchanged", asserting `studentT95` and the
  ProUCL 5.2 Section 2.5 citation) is the correct existence half for the new absence check.
- DISCLOSURE proportionality: the `unknown` badge
  (`MatrixMapRightPanel.tsx:870-877`) replaces a two-state ternary that asserted "Detected"
  for an unknown status. That is the honest minimum and matches the explicit `===`
  comparisons already used in `filter-measurements.ts`.
- Caveats: P3-2 (the counter includes rows excluded from `n`, so the message can read
  "3 of 2") and P3-3 (a manually selected method still shows a UCL).

### 4. Are Stack A and Stack B individually safe against origin/main 120c6f9a?

Individually, yes, with the P1s in stack A's #788 being content defects rather than
integration defects.
- Both trial merges are clean and, more usefully, byte-identical to their tips:
  `git diff 04c9cc10 0d2d85e8` and `git diff 45293f1a d4397227` are BOTH EMPTY. So each
  trial tree is exactly "main plus that stack", with no merge-resolution content anywhere.
- The two stacks touch disjoint files (`comm -12` over the changed-file lists: empty), and
  the only cross-stack coupling I could find is stack A's `page.test.tsx` importing the real
  `ThemeProvider`, which remains compatible.
- Stack A's only shared-config change is `playwright.config.ts`, and it only adds `-print`
  to the `chromium-auth` `testMatch`; it cannot affect `theme-flash.spec.ts`, which runs in
  the three unauthenticated projects.
- Stack B's one app-wide side effect is that `headers()` in the root layout makes all 15
  static routes dynamic. Verified this cannot break the build: no route exports
  `dynamic = 'force-static'` or `'error'`, and there are no metadata routes.
- Blocking, and inside stack A: P1-1 and P1-2, both in `TWGReviewPortal.tsx` (#788).

### 5. Exact bottom-up merge order and merge METHOD

ORDER (either stack first; they are content-independent):

    Stack B:  #782 (base main)  ->  retarget #787 base to main  ->  #787
    Stack A:  #783  ->  #784  ->  #785  ->  #788

After each parent merges, retarget the child PR's base to `main` on GitHub and wait for its
CI to re-run and go green against real main BEFORE merging it. That re-run is the only CI
result that means anything for a stacked PR: while the base is another PR branch, the check
run describes the merge of the head with that branch, not with main.

METHOD: a real MERGE COMMIT for every one of the six ("Create a merge commit", or local
`git merge --no-ff`). Do NOT squash and do NOT rebase-merge.
- Squash-merging #783 creates a brand-new commit whose tree matches but whose SHA is not an
  ancestor of #784. #784's merge-base with main falls back to 120c6f9a, so #784's PR diff
  re-displays all of #783's changes, its "files changed" and CI stop describing #784's own
  work, and every descendant needs a rebase. The same argument applies at each level, so a
  squash of #783 forces three rebases and re-review.
- Rebase-merge rewrites the SHAs with identical consequences.
- With merge commits, each tip stays an ancestor of main, so retargeting leaves exactly the
  child's own diff.
Note also that because each stack is a linear chain, merging only #788 with a merge commit
would land all four of stack A at once; the four separate merges exist to preserve per-PR
review and CI records, not because they are needed for content.

PREREQUISITES: #788 is LOCAL ONLY -- push it and open the PR (based on #785) before any of
this. #787 has rebased history and needs `git push --force-with-lease` (keep the lease; do
not use bare `--force`).
AFTERWARDS: run the six gates once on the resulting main (see P3-6).

### 6. Are exact-tip per-branch gate reruns MATERIALLY required?

No, not for content -- and the reason is stronger than "the tips are included". I verified
that `git diff 04c9cc10 0d2d85e8` and `git diff 45293f1a d4397227` are both EMPTY. The trial
trees are not merely "trees that contain the tip commits"; their working trees are
byte-identical to the tips. Lint, tsc, unit, build, e2e and docs therefore ran on exactly
the bytes that will land. A per-tip rerun of #788 at 04c9cc10 or #787 at 45293f1a would
compile and execute the same files, so it can only reproduce the same verdict.

The counts corroborate rather than conflict, which is worth stating because a mismatch here
would have been the tell: the local gate log at `.tmp/gate-logs/triage-six/RESULT.txt` is
FROZEN_HEAD 87b8d2c8 (#785) with `UNIT_SUMMARY=6824 passed` and `E2E_SUMMARY=167 passed`.
#788 adds no `e2e/` file, so stack A's trial e2e count being ALSO 167 is exactly right, and
6865 - 6824 = 41 matches #788's new unit tests. Stack B's 208 e2e = a 160-test main baseline
plus `theme-flash.spec.ts`'s 16 tests across the three unauthenticated projects (48).

The specific failure modes that per-tip runs do NOT cover, and that matter more:
- No run has ever seen BOTH stacks (P3-6). This is the real residual, and one post-merge run
  on main closes it.
- The e2e number only means what it says if the `chromium-auth` project actually ran; that
  project is conditional on `E2E_AUTH_ENABLED`, and stack A's whole print-correction lane is
  authenticated-only. The #785 log does prove it ran there (`E2E_CHROMIUM_AUTH_REFS=32`,
  with `e2e\matrix-options-print.spec.ts` present in the run), so the pattern is being
  honoured; confirm the same marker in the stack A trial log rather than reading "167
  passed" as sufficient on its own.
- The BUILD gate's corroboration markers deserve one look post-#787 (P3-5).

### 7. Does anything in these diffs depend on remote state that could invalidate either trial tree?

Content-wise, no. Process-wise, three things.
- `origin/main` must still be 120c6f9a when the merges happen. Both trial trees were
  computed against that commit; if main moves first, both trials are stale evidence.
- #787 needs `--force-with-lease`, so the remote `feat/theme-cookie-20260816` ref must still
  be what the lease expects; #788 is unpushed and has no remote state at all yet.
- `E2E_AUTH_ENABLED` is a repo-level variable and it decides whether the `chromium-auth`
  project exists (`playwright.config.ts:98-119`). It cannot invalidate a trial tree, but it
  decides what a green e2e line MEANS for stack A (see Q6).

No data dependency: #788 adds no migration and only READS an existing one's guarantee
(migration 20260519000001, already on main). The theme cookie is client-set and needs no
server config, no new env var, and no Supabase change. Nothing in either stack touches
`supabase/`, and no diff hunk reads a value that lives outside the repo.

### 8. Any MATERIAL rendered-browser, accessibility, theme, or print gap that BLOCKS landing?

Yes -- two, both in #788's TWG portal, and both of the exact class this lane keeps shipping
(a correct fact HIDDEN rather than corrupted, invisible to a green suite):

1. P1-1, `src/components/TWGReviewPortal.tsx:130-140` + `:320`. A Save Draft turns a
   declared "unknown amount of text may be missing" into a persisted positive statement that
   nothing was lost, and the submit gate then passes the possibly-clipped comment through
   silently on the next mount. Not rendered-browser at all -- it is a producer/consumer split
   (`atLimitKeys` computed at :106/:115 and never read in the `rawT !== null` path;
   `unknownProvenanceKeys` never persisted) that unit tests could catch and do not.
2. P1-2, `src/components/TWGReviewPortal.tsx:739-746` vs `:598`. The new cancelled-submit
   note makes the absolutely-positioned action bar roughly 192px tall against 128px of
   `pb-32` clearance, occluding the tail of the scrollable comment list -- including the
   Dismiss control the note itself instructs the reviewer to use. This is the rendered-browser
   gap: jsdom has no layout engine, `toBeVisible()` cannot see an overlaying sibling, and a
   programmatic click ignores occlusion, so nothing in the suite can fail on it.

Print: no blocking gap. The map measurement table's cap is genuinely unreachable on paper
(the `print:hidden` tabpanel at `MatrixDashboard.tsx:2302` is verified, and
`MatrixMapRightPanel` has exactly one render site inside it), the SSD exclusions de-cap is
genuinely de-clipped (`SsdWorkbench.tsx:2232`), and `printCapSweep.test.ts` is honestly
scoped and DOES pair its absence check with an existence check
(`expect(cappedCount).toBeGreaterThan(0)` and `expect(resetCount).toBeGreaterThan(0)`).

Accessibility and theme: no blocking gap in the coupled landing. `ThemeToggle` is 44px on
both axes with a 20px glyph; the new `unknown` badge's accessible text is the word "unknown";
the D2 first-render assertions correctly use `renderToStaticMarkup` rather than RTL's
`render` so they observe render 0 rather than an effect-corrected DOM, and the `renders[0]`
recording probe is the right instrument for the defect. The theme-related items are P2-1
(which the coupled landing resolves) and P2-2/P3-1 (drift guards, not user-facing today).

VERDICT: RED
