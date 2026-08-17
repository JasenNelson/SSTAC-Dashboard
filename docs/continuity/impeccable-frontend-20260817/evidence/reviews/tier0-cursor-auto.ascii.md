I'll start by reading the review brief and the gate/docs entrypoints it depends on, then hunt each claimed defect with file:line evidence.The brief is large; I'll read it in sections so the eight questions and exact-target criteria stay intact.The brief names three frozen diffs. I'll read each hunk in full, then verify the live files those SHAs actually contain.The D2 theme path is the likely WCAG trap. Next I'll verify the live SHAs, then the UCL fail-closed guard and print/a11y diffs.I'll verify the frozen SHAs, the UCL call graph, and whether the SSD print classes actually exist rather than only appearing in comments.The UCL wiring is the silent-citation risk. I'll confirm the call site, the null-as-detected tests, and the frozen SHAs next.The previous "782 is self-consistent" reading is wrong. `#782` paints `<html class="dark">` before first paint while `ThemeToggle` still names the control as if the page were light. `#787` is what closes that WCAG 4.1.2 hole. Coupled, the frozen landing does not have a P0/P1.

---

## Findings

**P2 / STRATEGIC -- `parseTheme` retypes `VALID_THEMES`.** `#787` made `src/lib/theme.ts` the value-set source, then `parseTheme` hardcodes `'dark' || 'light'` instead of `VALID_THEMES.includes`. Bootstrap still uses `VALID.indexOf`. Adding a third theme would make the inline script accept a class that `ThemeProvider` rejects. Falsify: change `VALID_THEMES` and watch the two parsers disagree. Not blocking today because the set is still exactly those two strings.

**P2 / TARGETED -- UCL fail-closed is not integration-tested through `computeSelectionStats`.** New tests check the counter and check `recommendUcl(..., 3)` directly. They would still pass if `stats.ts` counted unresolved rows and then omitted the 9th argument (default `0`), which is the production fail-open path. Falsify: delete `unresolvedCensoring` from the `recommendUcl(` call and re-run only the new suites; they stay green. The call site in the diff is correct; the tests do not pin it.

**P2 / TARGETED -- `#787` deleted two `#782` regression suites** that could fail: the `vi.doMock` proof that `ThemeContext` consumed `DEFAULT_THEME` / `VALID_THEMES`, and the `localStorage.setItem` `SecurityError` test. The try/catch on `setItem` remains. Coverage of those exact bugs is gone.

**P3 / TARGETED -- bootstrap `classList.remove(VALID[0], VALID[1])` assumes length 2.** Harmless while `VALID_THEMES` has two entries.

No P0/P1 in the coupled candidate.

---

## 1. `#782` and corrected `#787` are safe ONLY as a coupled landing unit

**Yes.** `#782` landing alone leaves `ThemeToggle` announcing the wrong accessible name on a dark page. The earlier "self-consistent, safe to merge now" reading is wrong.

**TARGETED.** `#782` injects a pre-paint bootstrap that can set `<html class="dark">` from `localStorage` (`src/lib/themeBootstrap.ts` in DIFF 1, the `THEME_BOOTSTRAP_SCRIPT` assignment). `ThemeProvider` still starts `mounted = false` and, for the entire unmounted window, hands consumers `DEFAULT_THEME` (`'light'`):

```641:649:.tmp/cursor_review_impeccable.md
  if (!mounted) {
    return (
      <ThemeContext.Provider value={{ theme: DEFAULT_THEME, toggleTheme: () => {}, setTheme: () => {} }}>
        <div className="min-h-screen bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
          {children}
```

`ThemeToggle` derives both the accessible name and the glyph from that context value, not from the `<html>` class:

```11:13:src/components/ThemeToggle.tsx
    <button
      onClick={toggleTheme}
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
```

(`#782` only changes `h-10 w-10` to `h-11 w-11`; the aria-label formula is unchanged.)

**Failure scenario.** Stored `theme=dark`, no cookie (the `#782` world). Bootstrap runs in `<head>` and adds `dark` before first paint. SSR and the first client render still provide `'light'`. The control's name is "Switch to dark mode" and the glyph is the moon, on an already-dark page. That is WCAG 4.1.2: the name does not match the control's actual destination. `suppressHydrationWarning` on `<html>` silences the class mismatch; it does not cascade to `ThemeToggle`. After the mount effect, the name corrects. For a JS user this is a first-paint / first-frame lie. Hydration itself matches (both sides said `'light'`), which is why a green suite can hide it.

**The `#782` tests could not have failed this bug.** `src/components/__tests__/ThemeToggle.test.tsx` mocks `useTheme` as `{ theme: 'light' }` and only asserts `/switch to dark mode/i`. `ThemeContext.test.tsx` asserts post-`render()` (RTL `act()` flushes effects). `e2e/theme-flash.spec.ts` asserts the `<html>` class, never the button name. Classic hide-the-correct-name, not corrupt-the-class.

**STRATEGIC.** `#787` is the actual D2 fix:

- Server reads the raw `cookie` header (not Next `cookies()`) and sets `className={theme}` plus `initialTheme={theme}` (DIFF 2 `src/app/layout.tsx`).
- `seedTheme` uses that server value on render 0; the unmounted provider passes `theme` (the seed), not `DEFAULT_THEME`.
- New tests that **can** fail: `renderToStaticMarkup` of real `ThemeToggle` (effects never run) expecting `/switch to light mode/i` and the sun path `M12 3v1m0 16v1`; e2e `serves the CORRECT toggle label for a dark cookie, with the JS bundle blocked`.

**HOLISTIC residual, not blocking.** Cookie-less + `localStorage=dark` still has one request where the server emits `light`, bootstrap paints `dark` and writes the cookie, and React render 0 follows the server. `#787` documents this as the migration window. After that request, cookie users are server-correct. Do not land `#782` onto `main` without `#787` in the same landing window.

Falsify Q1: show `#782` `ThemeProvider` passing the html class (or a server-resolved `initialTheme`) into the unmounted value. It does not.

---

## 2. Corrected `#787` preserves the quote-agnostic regex and a real bootstrap drift guard; `theme.ts` is a leaf

**(a) Quote-agnostic regex: preserved.** DIFF 2 does not rewrite the first e2e test body. It remains:

```
/localStorage\.getItem\(\s*['"]theme['"]\s*\)/
```

The `#787` script interpolates `JSON.stringify(THEME_STORAGE_KEY)` so the served text is `localStorage.getItem("theme")` (double quotes). The regex still matches. `themeBootstrap.ts` comments that the mixed quotes are why that regex must not be "fixed" back to a single-quoted substring.

**(b) Drift guard: preserved and strengthened.** `#782` had:

```
toContain(JSON.stringify(DEFAULT_THEME))
```

That is tautological against `VALID_THEMES`'s JSON (`["light","dark"]` already contains `"light"`). `#787` anchors it:

```
expect(THEME_BOOTSTRAP_SCRIPT).toContain(`DEF=${JSON.stringify(DEFAULT_THEME)}`);
```

plus `JSON.stringify(THEME_STORAGE_KEY)` and `JSON.stringify(VALID_THEMES)`.

**Would it FAIL if someone hardcoded one interpolation?**

- Hardcode `DEF='light'` while `DEFAULT_THEME` stays `'light'`: anchored `DEF="light"` **fails**. Unanchored `#782` check would not. This is a real guard.
- Hardcode `getItem('theme')` (single quotes): `toContain('"theme"')` **fails**.
- Change `VALID_THEMES` but leave `["light","dark"]` in the template: **fails**.
- Hardcode `getItem("theme")` while `THEME_STORAGE_KEY` remains `'theme'`: **does not fail**. The guard detects divergence, not "interpolation was used." That is the right property.

Cookie-name / `max-age` / `samesite` are a separate attributes `toContain` against `themeCookieString('dark', false)`. Also a real guard.

**Leaf / cycle.** `src/lib/theme.ts` in DIFF 2 has no imports. `themeBootstrap.ts` imports `@/lib/theme`. `ThemeContext.tsx` and `layout.tsx` import both. No cycle.

P2: `parseTheme` still retypes the two literals (finding above). P2: the e2e regex hardcodes `'theme'` rather than the exported key.

Falsify Q2a: show DIFF 2 changing that regex to a single-quoted substring. It does not. Falsify Q2b: revert `DEF=` to a hardcoded `'light'` and watch the anchored test; the packet already records that experiment.

---

## 3. `#788` fail-closed provenance is CORRECT and the disclosure is proportionate

**TARGETED -- placement.** `recommendUcl` keeps `n < 2` first, then the new guard, then `dCount` and every censored/uncensored ProUCL branch (DIFF 3 `src/lib/matrix-map/recommend-ucl.ts`):

```
if (n < 2) { recommendedMethod: 'none'; basisString: '...n < 2...' }
if (unresolvedCensoring > 0) {
  recommendedMethod: 'none';
  basisString: `Censoring status is unresolved for ${unresolvedCensoring} of ${n} row(s): no UCL basis (censored or uncensored) can be claimed.`
}
```

That is before pathway branching. `n < 2` plus unresolved still withholds UCL and does not emit `ProUCL`. Preferable to a false citation.

**Unreachable today, types widened.** Migration:

```368:368:supabase/migrations/20260519000001_matrix_map_schema.sql
  censored            boolean NOT NULL DEFAULT false,
```

Client type is already `boolean | null`:

```25:25:src/stores/matrix-map/measurementStore.ts
  censored: boolean | null;
```

**No calculation change for resolved rows.** The new loop only increments a counter when `censored !== true && censored !== false`. The existing `if (row.censored === true)` / `else` detect path is unchanged. Null still enters the detect/`rawParsed.censored = false` branch (the deferred treatment). The regression test `recommendUcl('Normal', 15, 0.4, null, false)` still expects `studentT95` and `ProUCL 5.2 Section 2.5`.

**Callers.** Production caller is only `computeBucket` in `stats.ts`. DIFF 3 passes `unresolvedCensoring` as the 9th argument. Other `recommendUcl(` sites are tests; the default `= 0` means they need no edits. "No caller needs changing" is true for sites outside this pair; `stats.ts` did need the new argument and received it.

**Disclosure.** Recommended UI path (`MatrixMapSelectionStats.tsx` ~325-327, 409-425): `activeMethod === 'none'` keeps `uclValue` null, so the shown value stays `N/A`, and `basisText` is the unresolved sentence. The table renders `unknown` instead of lying `Detected` (`MatrixMapRightPanel.tsx` in DIFF 3). That is proportionate: refuse the ProUCL citation, do not invent a treatment, do not relabel unknown as detected.

**Could-have-failed.** Direct `recommendUcl(..., 3)` **can** fail if the guard is removed. The counter tests **can** fail if the increment is removed. They **cannot** fail if the increment exists but is not passed into `recommendUcl` (P2 above). The older `censored===null treated as detected` test uses **n = 1**, so `n < 2` already returns `'none'`; it cannot see this guard.

Falsify Q3: put the unresolved check after a Normal `studentT95` return, or omit the 9th argument at the `stats.ts` call. The diff does neither.

---

## 4. Stack A and Stack B are individually safe against `origin/main` `120c6f9a`

**STRATEGIC / HOLISTIC.** Packet claim: both trial trees merge into `120c6f9a` with zero conflicts.

- **Stack B** (`#782` then `#787`) is internally coupled (Q1) and, as a stack, safe vs main: theme files on main have no cookie resolver yet (`src/app/layout.tsx` and `src/contexts/ThemeContext.tsx` in this `#785` worktree are still the pre-782 shapes). No overlap with Stack A's TWG / UCL / SSD files.
- **Stack A** (`#783`..`#788`) does not touch theme bootstrap. `#788` vs `#785` is additive (truncation provenance, unknown censoring badge, UCL guard, SSD `.slice(0, 8)` removal). This worktree still has `.slice(0, 8)` at `SsdWorkbench.tsx:2244`, which is exactly the `#788` delta.

Do not merge the two stacks' internals into each other; merge each onto main. Zero-conflict vs the same main SHA means either stack-first order is tree-safe. Cookie + UCL do not interact.

Falsify: a file both stacks edit, or a conflict vs `120c6f9a`. The packet says none; the three diffs' paths are disjoint across stacks.

---

## 5. Bottom-up merge commits; never squash stacked PRs

**HOLISTIC.**

Exact order:

1. Confirm `origin/main` is still `120c6f9a`.
2. Push local tips: `#787` `45293f1a` with `--force-with-lease` (rebased published history), `#788` `04c9cc10` (first push or lease). Do not `--force` without lease. Do not force `main`.
3. **Stack B:** merge-commit `#782` into `main`, then merge-commit `#787`. Do this in one landing window (Q1). GitHub should retarget `#787` to `main` after `#782` merges; merge the retargeted PR, not a squash of the whole stack.
4. **Stack A:** merge-commit `#783`, `#784`, `#785`, `#788` in that order, each after GitHub retargets the child onto `main`.
5. Stack B vs Stack A: either stack first.

**Method: merge commit**, not squash, not rebase-merge of a child whose branch still contains parent commits.

Squash of `#782` rewrites those commits; `#787` still contains the original `#782` SHAs, so a later merge duplicates or conflicts and the child's CI SHA is no longer what landed. Rebase-merge of a child onto `main` before retarget has the same duplication. After the parent is on `main` and the child is retargeted, GitHub's merge commit of the remaining delta keeps "CI ran on this PR head" meaningful.

`--force-with-lease` on `#787` is the right way to publish the rebase. It fails if the remote moved under you. That is the published-history safety bar for an unmerged feature branch. Do not rewrite `main`.

---

## 6. Exact-tip per-branch gate reruns are not materially required for tree correctness

**STRATEGIC.** Stale gates (`#788` at `90f4bf7e` vs tip `04c9cc10`; `#787` at `3a5eb26f` vs tip `45293f1a`) would matter if those old SHAs were what you merged. The packet says both **final** commits are in the combined trial trees that already ran all six gates green, and those trees are the stack tips merged to `120c6f9a`.

A per-tip run can catch what a combined tree cannot only if (a) a later stack commit masks a failure on an earlier PR, or (b) tests inspect git identity rather than the tree. (a) is irrelevant for the **tips** (`04c9cc10` / `45293f1a` **are** the stack heads). (b) does not appear in these diffs.

What still matters, and is not the same question: after `--force-with-lease`, GitHub Actions must run on the **published** tips, because branch protection sees GHA, not the local trial. That is runner identity, not a unique per-tip-vs-combined defect in this code.

Falsify: show a test that fails on `04c9cc10` alone but passes on `0d2d85e8` with a different tree. Zero-conflict merge of that tip into `120c6f9a` should be the same tree.

---

## 7. Remote state that can invalidate the trial trees

**HOLISTIC.** The diffs do not read live Supabase, CDN cookies, or a remote schema. The UCL guard is local TypeScript. Invalidation paths:

1. **`origin/main` moves off `120c6f9a`.** Both trials are then stale. Recreate the trial merges.
2. **Merging GitHub's current PR heads without pushing the local tips.** `#787` and `#788` are local-only. Clicking merge on `3a5eb26f` / `90f4bf7e` lands the **pre-trial** commits. This is the real remote-identity trap. Push tips first (Q5).
3. **A live `theme` cookie from some other app on the same site** with a junk value: both parsers resolve it to `'light'` and do not fall through. No trial break.
4. **CSP tightened to nonce/hash on `/`:** bootstrap would be blocked and FOUC returns. Not current: public routes emit no CSP; middleware routes allow `unsafe-inline` (comment in `#787` `themeBootstrap.ts`).
5. **DB `censored` dropped to nullable** is the event the UCL guard is for; it does not invalidate the trial, it is why the guard exists.

No dependency on Next's cookie parser version: layout uses `headers().get('cookie')` plus `readThemeCookie`.

---

## 8. No material rendered-browser / a11y / theme / print gap that BLOCKS this landing

**HOLISTIC, blocking only.**

- **Theme / WCAG 4.1.2:** blocking if `#782` ships alone (Q1). Not blocking if `#782+#787` land together. Residual one-request migration mismatch is documented. Landing `/` has a single `ThemeToggle` (`src/app/page.tsx:52`); the e2e `.first()` + `toBeVisible()` is not a hidden-duplicate trap on that URL. Dashboard `Header.tsx:243` / `354` is desktop vs closed mobile menu; out of scope for `/`.
- **Print:** `#788` comment that a print reset on `MatrixMapRightPanel` is a no-op is true: Interactive Map tabpanel is `print:hidden` (`src/components/MatrixDashboard.tsx:2301-2302`). SSD exclusions container already has `print:max-h-none print:overflow-visible` (`SsdWorkbench.tsx:2232`); `#788` only removes `.slice(0, 8)` so paper can show rows 9+. That test **can** fail (`bodyRows.length === 12` and `Feeding-12`). Not a class-string theatre.
- **jsdom `toBeVisible`:** TWG alerts use `toBeInTheDocument` / roles, not layout. SSD count uses `querySelectorAll('tbody tr')`. Honest.
- **Deferred, not re-opened:** unresolved-row **treatment**; cross-tab clipped-draft + empty truncation record; four BN-RRM items; 26 remaining audit items.

---

## Could-have-failed (defect class)

| Test | Could it fail the bug it claims to guard? |
|---|---|
| `#782` ThemeToggle name (mocked `'light'`) | No. Cannot see D2. |
| `#782` e2e html class | Yes for missing bootstrap; **no** for wrong toggle name. |
| `#787` `renderToStaticMarkup` ThemeToggle | **Yes.** Effects never run. |
| `#787` e2e blocked-bundle toggle label | **Yes.** |
| `#787` `DEF=` bootstrap guard | **Yes** for hardcoded `DEF='light'`. |
| `#788` `recommendUcl(..., 3)` | **Yes** for a missing guard. |
| `#788` unresolved **counter** | Yes for a missing increment; **no** for a missing `recommendUcl` argument. |
| `#788` null-as-detected (n=1) | No for this guard (`n < 2` wins). |
| `#788` SSD 12 exclusions | **Yes** if `.slice(0, 8)` returns. |
| `#788` "unknown" vs "Detected" | **Yes.** |

The hide-correct-value class on this lane is `#782` alone (correct `dark` class, wrong name) and the old SSD `.slice(0, 8)` (correct Excluded count, missing rows). Coupled `#787` and `#788` close both.

Claude-token spend risk for next step: low. AGY delegation opportunity: no.

VERDICT: GREEN
[RESULT]
I'll start by reading the review brief and the gate/docs entrypoints it depends on, then hunt each claimed defect with file:line evidence.The brief is large; I'll read it in sections so the eight questions and exact-target criteria stay intact.The brief names three frozen diffs. I'll read each hunk in full, then verify the live files those SHAs actually contain.The D2 theme path is the likely WCAG trap. Next I'll verify the live SHAs, then the UCL fail-closed guard and print/a11y diffs.I'll verify the frozen SHAs, the UCL call graph, and whether the SSD print classes actually exist rather than only appearing in comments.The UCL wiring is the silent-citation risk. I'll confirm the call site, the null-as-detected tests, and the frozen SHAs next.The previous "782 is self-consistent" reading is wrong. `#782` paints `<html class="dark">` before first paint while `ThemeToggle` still names the control as if the page were light. `#787` is what closes that WCAG 4.1.2 hole. Coupled, the frozen landing does not have a P0/P1.

---

## Findings

**P2 / STRATEGIC -- `parseTheme` retypes `VALID_THEMES`.** `#787` made `src/lib/theme.ts` the value-set source, then `parseTheme` hardcodes `'dark' || 'light'` instead of `VALID_THEMES.includes`. Bootstrap still uses `VALID.indexOf`. Adding a third theme would make the inline script accept a class that `ThemeProvider` rejects. Falsify: change `VALID_THEMES` and watch the two parsers disagree. Not blocking today because the set is still exactly those two strings.

**P2 / TARGETED -- UCL fail-closed is not integration-tested through `computeSelectionStats`.** New tests check the counter and check `recommendUcl(..., 3)` directly. They would still pass if `stats.ts` counted unresolved rows and then omitted the 9th argument (default `0`), which is the production fail-open path. Falsify: delete `unresolvedCensoring` from the `recommendUcl(` call and re-run only the new suites; they stay green. The call site in the diff is correct; the tests do not pin it.

**P2 / TARGETED -- `#787` deleted two `#782` regression suites** that could fail: the `vi.doMock` proof that `ThemeContext` consumed `DEFAULT_THEME` / `VALID_THEMES`, and the `localStorage.setItem` `SecurityError` test. The try/catch on `setItem` remains. Coverage of those exact bugs is gone.

**P3 / TARGETED -- bootstrap `classList.remove(VALID[0], VALID[1])` assumes length 2.** Harmless while `VALID_THEMES` has two entries.

No P0/P1 in the coupled candidate.

---

## 1. `#782` and corrected `#787` are safe ONLY as a coupled landing unit

**Yes.** `#782` landing alone leaves `ThemeToggle` announcing the wrong accessible name on a dark page. The earlier "self-consistent, safe to merge now" reading is wrong.

**TARGETED.** `#782` injects a pre-paint bootstrap that can set `<html class="dark">` from `localStorage` (`src/lib/themeBootstrap.ts` in DIFF 1, the `THEME_BOOTSTRAP_SCRIPT` assignment). `ThemeProvider` still starts `mounted = false` and, for the entire unmounted window, hands consumers `DEFAULT_THEME` (`'light'`):

```641:649:.tmp/cursor_review_impeccable.md
  if (!mounted) {
    return (
      <ThemeContext.Provider value={{ theme: DEFAULT_THEME, toggleTheme: () => {}, setTheme: () => {} }}>
        <div className="min-h-screen bg-white dark:bg-slate-900 text-slate-900 dark:text-white">
          {children}
```

`ThemeToggle` derives both the accessible name and the glyph from that context value, not from the `<html>` class:

```11:13:src/components/ThemeToggle.tsx
    <button
      onClick={toggleTheme}
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
```

(`#782` only changes `h-10 w-10` to `h-11 w-11`; the aria-label formula is unchanged.)

**Failure scenario.** Stored `theme=dark`, no cookie (the `#782` world). Bootstrap runs in `<head>` and adds `dark` before first paint. SSR and the first client render still provide `'light'`. The control's name is "Switch to dark mode" and the glyph is the moon, on an already-dark page. That is WCAG 4.1.2: the name does not match the control's actual destination. `suppressHydrationWarning` on `<html>` silences the class mismatch; it does not cascade to `ThemeToggle`. After the mount effect, the name corrects. For a JS user this is a first-paint / first-frame lie. Hydration itself matches (both sides said `'light'`), which is why a green suite can hide it.

**The `#782` tests could not have failed this bug.** `src/components/__tests__/ThemeToggle.test.tsx` mocks `useTheme` as `{ theme: 'light' }` and only asserts `/switch to dark mode/i`. `ThemeContext.test.tsx` asserts post-`render()` (RTL `act()` flushes effects). `e2e/theme-flash.spec.ts` asserts the `<html>` class, never the button name. Classic hide-the-correct-name, not corrupt-the-class.

**STRATEGIC.** `#787` is the actual D2 fix:

- Server reads the raw `cookie` header (not Next `cookies()`) and sets `className={theme}` plus `initialTheme={theme}` (DIFF 2 `src/app/layout.tsx`).
- `seedTheme` uses that server value on render 0; the unmounted provider passes `theme` (the seed), not `DEFAULT_THEME`.
- New tests that **can** fail: `renderToStaticMarkup` of real `ThemeToggle` (effects never run) expecting `/switch to light mode/i` and the sun path `M12 3v1m0 16v1`; e2e `serves the CORRECT toggle label for a dark cookie, with the JS bundle blocked`.

**HOLISTIC residual, not blocking.** Cookie-less + `localStorage=dark` still has one request where the server emits `light`, bootstrap paints `dark` and writes the cookie, and React render 0 follows the server. `#787` documents this as the migration window. After that request, cookie users are server-correct. Do not land `#782` onto `main` without `#787` in the same landing window.

Falsify Q1: show `#782` `ThemeProvider` passing the html class (or a server-resolved `initialTheme`) into the unmounted value. It does not.

---

## 2. Corrected `#787` preserves the quote-agnostic regex and a real bootstrap drift guard; `theme.ts` is a leaf

**(a) Quote-agnostic regex: preserved.** DIFF 2 does not rewrite the first e2e test body. It remains:

```
/localStorage\.getItem\(\s*['"]theme['"]\s*\)/
```

The `#787` script interpolates `JSON.stringify(THEME_STORAGE_KEY)` so the served text is `localStorage.getItem("theme")` (double quotes). The regex still matches. `themeBootstrap.ts` comments that the mixed quotes are why that regex must not be "fixed" back to a single-quoted substring.

**(b) Drift guard: preserved and strengthened.** `#782` had:

```
toContain(JSON.stringify(DEFAULT_THEME))
```

That is tautological against `VALID_THEMES`'s JSON (`["light","dark"]` already contains `"light"`). `#787` anchors it:

```
expect(THEME_BOOTSTRAP_SCRIPT).toContain(`DEF=${JSON.stringify(DEFAULT_THEME)}`);
```

plus `JSON.stringify(THEME_STORAGE_KEY)` and `JSON.stringify(VALID_THEMES)`.

**Would it FAIL if someone hardcoded one interpolation?**

- Hardcode `DEF='light'` while `DEFAULT_THEME` stays `'light'`: anchored `DEF="light"` **fails**. Unanchored `#782` check would not. This is a real guard.
- Hardcode `getItem('theme')` (single quotes): `toContain('"theme"')` **fails**.
- Change `VALID_THEMES` but leave `["light","dark"]` in the template: **fails**.
- Hardcode `getItem("theme")` while `THEME_STORAGE_KEY` remains `'theme'`: **does not fail**. The guard detects divergence, not "interpolation was used." That is the right property.

Cookie-name / `max-age` / `samesite` are a separate attributes `toContain` against `themeCookieString('dark', false)`. Also a real guard.

**Leaf / cycle.** `src/lib/theme.ts` in DIFF 2 has no imports. `themeBootstrap.ts` imports `@/lib/theme`. `ThemeContext.tsx` and `layout.tsx` import both. No cycle.

P2: `parseTheme` still retypes the two literals (finding above). P2: the e2e regex hardcodes `'theme'` rather than the exported key.

Falsify Q2a: show DIFF 2 changing that regex to a single-quoted substring. It does not. Falsify Q2b: revert `DEF=` to a hardcoded `'light'` and watch the anchored test; the packet already records that experiment.

---

## 3. `#788` fail-closed provenance is CORRECT and the disclosure is proportionate

**TARGETED -- placement.** `recommendUcl` keeps `n < 2` first, then the new guard, then `dCount` and every censored/uncensored ProUCL branch (DIFF 3 `src/lib/matrix-map/recommend-ucl.ts`):

```
if (n < 2) { recommendedMethod: 'none'; basisString: '...n < 2...' }
if (unresolvedCensoring > 0) {
  recommendedMethod: 'none';
  basisString: `Censoring status is unresolved for ${unresolvedCensoring} of ${n} row(s): no UCL basis (censored or uncensored) can be claimed.`
}
```

That is before pathway branching. `n < 2` plus unresolved still withholds UCL and does not emit `ProUCL`. Preferable to a false citation.

**Unreachable today, types widened.** Migration:

```368:368:supabase/migrations/20260519000001_matrix_map_schema.sql
  censored            boolean NOT NULL DEFAULT false,
```

Client type is already `boolean | null`:

```25:25:src/stores/matrix-map/measurementStore.ts
  censored: boolean | null;
```

**No calculation change for resolved rows.** The new loop only increments a counter when `censored !== true && censored !== false`. The existing `if (row.censored === true)` / `else` detect path is unchanged. Null still enters the detect/`rawParsed.censored = false` branch (the deferred treatment). The regression test `recommendUcl('Normal', 15, 0.4, null, false)` still expects `studentT95` and `ProUCL 5.2 Section 2.5`.

**Callers.** Production caller is only `computeBucket` in `stats.ts`. DIFF 3 passes `unresolvedCensoring` as the 9th argument. Other `recommendUcl(` sites are tests; the default `= 0` means they need no edits. "No caller needs changing" is true for sites outside this pair; `stats.ts` did need the new argument and received it.

**Disclosure.** Recommended UI path (`MatrixMapSelectionStats.tsx` ~325-327, 409-425): `activeMethod === 'none'` keeps `uclValue` null, so the shown value stays `N/A`, and `basisText` is the unresolved sentence. The table renders `unknown` instead of lying `Detected` (`MatrixMapRightPanel.tsx` in DIFF 3). That is proportionate: refuse the ProUCL citation, do not invent a treatment, do not relabel unknown as detected.

**Could-have-failed.** Direct `recommendUcl(..., 3)` **can** fail if the guard is removed. The counter tests **can** fail if the increment is removed. They **cannot** fail if the increment exists but is not passed into `recommendUcl` (P2 above). The older `censored===null treated as detected` test uses **n = 1**, so `n < 2` already returns `'none'`; it cannot see this guard.

Falsify Q3: put the unresolved check after a Normal `studentT95` return, or omit the 9th argument at the `stats.ts` call. The diff does neither.

---

## 4. Stack A and Stack B are individually safe against `origin/main` `120c6f9a`

**STRATEGIC / HOLISTIC.** Packet claim: both trial trees merge into `120c6f9a` with zero conflicts.

- **Stack B** (`#782` then `#787`) is internally coupled (Q1) and, as a stack, safe vs main: theme files on main have no cookie resolver yet (`src/app/layout.tsx` and `src/contexts/ThemeContext.tsx` in this `#785` worktree are still the pre-782 shapes). No overlap with Stack A's TWG / UCL / SSD files.
- **Stack A** (`#783`..`#788`) does not touch theme bootstrap. `#788` vs `#785` is additive (truncation provenance, unknown censoring badge, UCL guard, SSD `.slice(0, 8)` removal). This worktree still has `.slice(0, 8)` at `SsdWorkbench.tsx:2244`, which is exactly the `#788` delta.

Do not merge the two stacks' internals into each other; merge each onto main. Zero-conflict vs the same main SHA means either stack-first order is tree-safe. Cookie + UCL do not interact.

Falsify: a file both stacks edit, or a conflict vs `120c6f9a`. The packet says none; the three diffs' paths are disjoint across stacks.

---

## 5. Bottom-up merge commits; never squash stacked PRs

**HOLISTIC.**

Exact order:

1. Confirm `origin/main` is still `120c6f9a`.
2. Push local tips: `#787` `45293f1a` with `--force-with-lease` (rebased published history), `#788` `04c9cc10` (first push or lease). Do not `--force` without lease. Do not force `main`.
3. **Stack B:** merge-commit `#782` into `main`, then merge-commit `#787`. Do this in one landing window (Q1). GitHub should retarget `#787` to `main` after `#782` merges; merge the retargeted PR, not a squash of the whole stack.
4. **Stack A:** merge-commit `#783`, `#784`, `#785`, `#788` in that order, each after GitHub retargets the child onto `main`.
5. Stack B vs Stack A: either stack first.

**Method: merge commit**, not squash, not rebase-merge of a child whose branch still contains parent commits.

Squash of `#782` rewrites those commits; `#787` still contains the original `#782` SHAs, so a later merge duplicates or conflicts and the child's CI SHA is no longer what landed. Rebase-merge of a child onto `main` before retarget has the same duplication. After the parent is on `main` and the child is retargeted, GitHub's merge commit of the remaining delta keeps "CI ran on this PR head" meaningful.

`--force-with-lease` on `#787` is the right way to publish the rebase. It fails if the remote moved under you. That is the published-history safety bar for an unmerged feature branch. Do not rewrite `main`.

---

## 6. Exact-tip per-branch gate reruns are not materially required for tree correctness

**STRATEGIC.** Stale gates (`#788` at `90f4bf7e` vs tip `04c9cc10`; `#787` at `3a5eb26f` vs tip `45293f1a`) would matter if those old SHAs were what you merged. The packet says both **final** commits are in the combined trial trees that already ran all six gates green, and those trees are the stack tips merged to `120c6f9a`.

A per-tip run can catch what a combined tree cannot only if (a) a later stack commit masks a failure on an earlier PR, or (b) tests inspect git identity rather than the tree. (a) is irrelevant for the **tips** (`04c9cc10` / `45293f1a` **are** the stack heads). (b) does not appear in these diffs.

What still matters, and is not the same question: after `--force-with-lease`, GitHub Actions must run on the **published** tips, because branch protection sees GHA, not the local trial. That is runner identity, not a unique per-tip-vs-combined defect in this code.

Falsify: show a test that fails on `04c9cc10` alone but passes on `0d2d85e8` with a different tree. Zero-conflict merge of that tip into `120c6f9a` should be the same tree.

---

## 7. Remote state that can invalidate the trial trees

**HOLISTIC.** The diffs do not read live Supabase, CDN cookies, or a remote schema. The UCL guard is local TypeScript. Invalidation paths:

1. **`origin/main` moves off `120c6f9a`.** Both trials are then stale. Recreate the trial merges.
2. **Merging GitHub's current PR heads without pushing the local tips.** `#787` and `#788` are local-only. Clicking merge on `3a5eb26f` / `90f4bf7e` lands the **pre-trial** commits. This is the real remote-identity trap. Push tips first (Q5).
3. **A live `theme` cookie from some other app on the same site** with a junk value: both parsers resolve it to `'light'` and do not fall through. No trial break.
4. **CSP tightened to nonce/hash on `/`:** bootstrap would be blocked and FOUC returns. Not current: public routes emit no CSP; middleware routes allow `unsafe-inline` (comment in `#787` `themeBootstrap.ts`).
5. **DB `censored` dropped to nullable** is the event the UCL guard is for; it does not invalidate the trial, it is why the guard exists.

No dependency on Next's cookie parser version: layout uses `headers().get('cookie')` plus `readThemeCookie`.

---

## 8. No material rendered-browser / a11y / theme / print gap that BLOCKS this landing

**HOLISTIC, blocking only.**

- **Theme / WCAG 4.1.2:** blocking if `#782` ships alone (Q1). Not blocking if `#782+#787` land together. Residual one-request migration mismatch is documented. Landing `/` has a single `ThemeToggle` (`src/app/page.tsx:52`); the e2e `.first()` + `toBeVisible()` is not a hidden-duplicate trap on that URL. Dashboard `Header.tsx:243` / `354` is desktop vs closed mobile menu; out of scope for `/`.
- **Print:** `#788` comment that a print reset on `MatrixMapRightPanel` is a no-op is true: Interactive Map tabpanel is `print:hidden` (`src/components/MatrixDashboard.tsx:2301-2302`). SSD exclusions container already has `print:max-h-none print:overflow-visible` (`SsdWorkbench.tsx:2232`); `#788` only removes `.slice(0, 8)` so paper can show rows 9+. That test **can** fail (`bodyRows.length === 12` and `Feeding-12`). Not a class-string theatre.
- **jsdom `toBeVisible`:** TWG alerts use `toBeInTheDocument` / roles, not layout. SSD count uses `querySelectorAll('tbody tr')`. Honest.
- **Deferred, not re-opened:** unresolved-row **treatment**; cross-tab clipped-draft + empty truncation record; four BN-RRM items; 26 remaining audit items.

---

## Could-have-failed (defect class)

| Test | Could it fail the bug it claims to guard? |
|---|---|
| `#782` ThemeToggle name (mocked `'light'`) | No. Cannot see D2. |
| `#782` e2e html class | Yes for missing bootstrap; **no** for wrong toggle name. |
| `#787` `renderToStaticMarkup` ThemeToggle | **Yes.** Effects never run. |
| `#787` e2e blocked-bundle toggle label | **Yes.** |
| `#787` `DEF=` bootstrap guard | **Yes** for hardcoded `DEF='light'`. |
| `#788` `recommendUcl(..., 3)` | **Yes** for a missing guard. |
| `#788` unresolved **counter** | Yes for a missing increment; **no** for a missing `recommendUcl` argument. |
| `#788` null-as-detected (n=1) | No for this guard (`n < 2` wins). |
| `#788` SSD 12 exclusions | **Yes** if `.slice(0, 8)` returns. |
| `#788` "unknown" vs "Detected" | **Yes.** |

The hide-correct-value class on this lane is `#782` alone (correct `dark` class, wrong name) and the old SSD `.slice(0, 8)` (correct Excluded count, missing rows). Coupled `#787` and `#788` close both.

Claude-token spend risk for next step: low. AGY delegation opportunity: no.

VERDICT: GREEN