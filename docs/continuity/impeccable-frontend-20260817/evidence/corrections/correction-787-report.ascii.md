PR #787 correction pass -- report
==================================

Worktree: C:\Projects\SSTAC-Dashboard-worktrees\theme-cookie-20260816
Branch:   feat/theme-cookie-20260816
Base (before this pass): 45293f1a (clean)
New commit: 887d9265ae... (see `git show 887d9265 --stat`)
Commit is a normal commit on top of 45293f1a; no history rewrite, no push.

Files changed (insertions/deletions from `git diff --stat`)
-------------------------------------------------------------
- src/contexts/ThemeContext.test.tsx  : +187 / -0
- src/contexts/ThemeContext.tsx       : +2   / -2
- src/lib/theme.test.ts               : +44  / -0
- src/lib/theme.ts                    : +17  / -4
- src/lib/themeBootstrap.ts           : +9   / -1
Total: 5 files changed, 258 insertions(+), 8 deletions(-)

src/lib/themeBootstrap.test.ts was NOT touched -- no fix required a new assertion there; all 31
existing tests there continued to pass unchanged against the item (B) fix.

Item A -- make the code match its own "single source of truth" claim
----------------------------------------------------------------------
1. src/lib/theme.ts, parseTheme: was `raw === 'dark' || raw === 'light' ? raw : null`. Now tests
   membership in VALID_THEMES via a new internal type-predicate helper `isValidTheme(value):
   value is Theme`, which widens VALID_THEMES to `readonly string[]` for the `.includes()` call
   (a bare `.includes()` against the tuple type cannot accept an arbitrary string argument) and
   narrows the result back to `Theme` for the caller. `parseTheme` itself only gained a
   `typeof raw === 'string'` guard ahead of the predicate to preserve the null/undefined handling
   it already had.
   Behaviour-preserving evidence: VALID_THEMES is currently exactly `['light','dark']`, so
   `isValidTheme('dark')`/`isValidTheme('light')` are true and everything else is false --
   identical truth table to the original `===` check. Confirmed by theme.test.ts's existing
   'accepts exactly the two valid themes' / 'rejects everything else rather than casting it'
   tests, both still green.

2. src/lib/theme.ts, resolveTheme and resolveThemeFromCookieHeader: both fell back to a hardcoded
   'light'; now fall back to DEFAULT_THEME.
   Behaviour-preserving evidence: DEFAULT_THEME = VALID_THEMES[0] = 'light' today. Existing tests
   'is total: resolveTheme always yields a real theme' and the readThemeCookie corrupt/absent
   cases still pass unchanged.

3. src/contexts/ThemeContext.tsx, seedTheme: both hardcoded 'light' fallbacks (the
   `document === 'undefined'` branch and the ternary's else-branch) now use DEFAULT_THEME. The
   'dark' literal in the ternary's condition (checking for the bootstrap's <html> class) was left
   untouched -- it is not a "default" and was not named in the task.
   Behaviour-preserving evidence: same DEFAULT_THEME === 'light' identity as above; all 15
   pre-existing ThemeContext tests plus the two restored structural tests remain green.

No cookie name, attribute, max-age, or cookie-first resolution order was touched anywhere.

Item B -- length-agnostic classList removal in the bootstrap
----------------------------------------------------------------
src/lib/themeBootstrap.ts: `e.classList.remove(VALID[0],VALID[1])` -> `e.classList.remove.apply
(e.classList,VALID)`, matching the form used on feat/section-b-wave0-20260815 (`6caaa34e`) before
this branch's rebase overwrote it (`git show 6caaa34e:src/lib/themeBootstrap.ts` confirms the
`.apply` form predates this branch's own history). Added a paragraph to the file's existing
"written as one line" comment explaining why `.apply` is required instead of the two-argument
form once VALID_THEMES has more than two members. Remains a single synchronous statement inlined
into the same one-line IIFE; no new dependency. All 31 pre-existing themeBootstrap.test.ts tests
(including the two- and one-class removal cases) still pass unchanged, since `.apply` over a
2-element array is behaviourally identical to the 2-argument call it replaced.

Item C -- restored three deleted regression tests (src/contexts/ThemeContext.test.tsx)
-------------------------------------------------------------------------------------------
Recovered from `git show 6caaa34e:src/contexts/ThemeContext.test.tsx` and adapted to the current
module layout (validation now lives in theme.ts's parseTheme; ThemeContext delegates to it rather
than reimplementing it; the provider now also seeds from a server-provided initialTheme).

1. "does not throw/crash when localStorage.setItem throws (Safari private mode, blocked cookies)"
   -- re-added essentially verbatim, but reuses this file's existing top-level ToggleProbe
   instead of a locally-defined duplicate, and added clearThemeCookie() to its beforeEach/afterEach
   per this file's own cookie-hygiene convention. Still exercises the exact try/catch in
   ThemeContext.tsx's persistence effect (the "Safari private mode" comment there).

2. "uses themeBootstrap DEFAULT_THEME, not a hardcoded literal" -- unchanged mechanism: mocks
   '@/lib/themeBootstrap' to override DEFAULT_THEME to 'dark' and asserts an unmounted-with-
   nothing-stored provider follows the mock. Still valid because ThemeContext.tsx directly
   consumes the `DEFAULT_THEME` re-export from themeBootstrap (a genuine cross-module import),
   and item A's seedTheme fix is precisely what makes this consumption real rather than nominal.

3. "uses themeBootstrap VALID_THEMES, not a hardcoded accepted-value set" -- mechanism adapted.
   The original mocked VALID_THEMES directly because the old ThemeContext.tsx had its own inline
   `VALID_THEMES.includes(stored)` check. That check no longer exists in ThemeContext.tsx; it now
   calls the imported `parseTheme` from '@/lib/theme'. The restored test therefore mocks
   '@/lib/theme''s `parseTheme` export (still a genuine cross-module import from ThemeContext.tsx's
   point of view) to accept a value ('sepia') the real VALID_THEMES set does not contain, and
   asserts the provider surfaces it -- provable only if ThemeContext.tsx actually delegates to the
   imported function instead of a hardcoded check. Test name kept verbatim per the task; the
   describe-block comment documents the adaptation in full.

Item D -- new test closing the "does the server side honor a widened VALID_THEMES" gap
--------------------------------------------------------------------------------------------
Added to src/lib/theme.test.ts (fits the file's existing subject: the pure server-side resolver
functions). `VALID_THEMES` is `as const` only at the type level; at runtime it is the same plain,
mutable array every resolver closes over, so the test pushes a third value ('sepia', cast through
`unknown` since it shares no members with the Theme union) directly onto the real VALID_THEMES
array, asserts parseTheme / resolveTheme / readThemeCookie / resolveThemeFromCookieHeader all
accept it, then pops it back off in a `finally` so no other test observes the widened set.

Falsification results (all two-sided; exact messages observed)
-------------------------------------------------------------------
1. theme.test.ts "accepts a third theme value once VALID_THEMES includes it, instead of silently
   falling back to DEFAULT_THEME" (also falsifies item A's parseTheme fix):
   - Reverted parseTheme to `raw === 'dark' || raw === 'light' ? raw : null`.
   - FAILED with: `AssertionError: expected null to be 'sepia' // Object.is equality`
     (at the `expect(parseTheme(THIRD_THEME)).toBe(THIRD_THEME)` line).
   - Restored the fix; full 4-file vitest run re-confirmed 64/64 green.

2. ThemeContext.test.tsx "does not throw/crash when localStorage.setItem throws (Safari private
   mode, blocked cookies)":
   - Removed the try/catch around `localStorage.setItem(THEME_STORAGE_KEY, theme)` in the
     persistence effect.
   - FAILED with: `AssertionError: expected [Function] to not throw an error but 'Error:
     SecurityError: localStorage is...' was thrown`.
   - Restored the try/catch; re-confirmed green.

3. ThemeContext.test.tsx "uses themeBootstrap DEFAULT_THEME, not a hardcoded literal":
   - Reverted seedTheme's two DEFAULT_THEME fallbacks to hardcoded 'light'.
   - FAILED with: `Error: expect(element).toHaveTextContent() / Expected element to have text
     content: dark / Received: light`.
   - Restored the fix; re-confirmed green.

4. ThemeContext.test.tsx "uses themeBootstrap VALID_THEMES, not a hardcoded accepted-value set":
   - Reverted readPersistedTheme's localStorage branch from `parseTheme(...)` to a hardcoded
     `stored === 'dark' || stored === 'light' ? stored : null` check.
   - FAILED with: `Error: expect(element).toHaveTextContent() / Expected element to have text
     content: sepia / Received: light`.
   - Restored the fix; re-confirmed green.

Every falsification was able to fail with a message that names the real problem -- none of the
four restored/added tests turned out to be vacuous.

Verification outcomes (final, post-restoration)
-----------------------------------------------
- `npx tsc --noEmit` -- clean, zero errors/warnings, zero output.
- `npx eslint src/lib/theme.ts src/lib/themeBootstrap.ts src/contexts/ThemeContext.tsx
  src/contexts/ThemeContext.test.tsx src/lib/theme.test.ts src/lib/themeBootstrap.test.ts` --
  clean, zero errors/warnings, zero output.
- `npx vitest run src/contexts/ThemeContext.test.tsx src/lib/theme.test.ts
  src/lib/themeBootstrap.test.ts src/components/__tests__/ThemeToggle.test.tsx` -- 4 test files
  passed, 64/64 tests passed (theme.test.ts 12, themeBootstrap.test.ts 31, ThemeToggle.test.tsx 3,
  ThemeContext.test.tsx 18 -- 15 pre-existing + 3 restored).

Not run (per instructions -- orchestrator owns these): full unit suite, build, e2e.

What I chose NOT to do, and why
--------------------------------
- Did not touch the `'dark'` literal inside seedTheme's ternary condition
  (`document.documentElement.classList.contains('dark') ? 'dark' : DEFAULT_THEME`). The task named
  only the two 'light' fallbacks; the 'dark' there is testing for a specific CSS class already
  written by the bootstrap script, not standing in for "the default", so retyping it against
  VALID_THEMES would be a broader (and unrequested) change to seedTheme's shape.
- Did not add a new bootstrap-script-level test proving the item (B) fix specifically (e.g. a
  3-theme removal scenario executed through THEME_BOOTSTRAP_SCRIPT). The task's instructions for
  item B only required restoring the length-agnostic form and keeping existing bootstrap tests
  green, not adding a new one; the existing 31 themeBootstrap.test.ts assertions (including the
  "does not leave both classes on <html> when one is already present" case) already exercise the
  changed line and stayed green, and `.apply` over a fixed-length array is a standard, low-risk JS
  idiom rather than something that needed its own new regression test to be trustworthy.
- Did not rename the restored test-3 describe block or test name beyond what the task allowed --
  kept the exact `it(...)` name "uses themeBootstrap VALID_THEMES, not a hardcoded accepted-value
  set" even though the mechanism now mocks '@/lib/theme' rather than '@/lib/themeBootstrap', since
  the task said to preserve names and only adapt mocking/setup; the describe-block comment carries
  the full explanation of the adaptation.
- Did not touch src/lib/themeBootstrap.test.ts -- no fix required a new or changed assertion there.
