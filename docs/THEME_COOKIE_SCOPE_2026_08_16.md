# Theme resolution via cookie -- scoping document (owner decision D2, option C)

Date: 2026-08-16
Status: SCOPING ONLY. Nothing implemented. No gates run for this document.
Decision being scoped: D2 option C -- move theme resolution to a cookie so the server renders
the correct theme, eliminating the one-frame window in which the ThemeToggle's glyph and
aria-label contradict an already-dark page.

## 0. Where the code actually lives (read this before the rest)

The synchronous pre-paint bootstrap is NOT on the triage branch. It is on
`feat/section-b-wave0-20260815`, worktree
`C:\Projects\SSTAC-Dashboard-worktrees\section-b-wave0-20260815`, commits `6c25f740`
(bootstrap) and `d6d4fa0f` (ThemeContext sanitisation). The triage worktree
(`feat/deferred-triage-20260816`, tip `bfbab1c9`) does NOT contain it: its
`src/app/layout.tsx` has no `<head>` and no bootstrap import, and `src/lib/themeBootstrap.ts`
does not exist there.

All file:line citations below are against the **section-b-wave0-20260815** worktree, because
that is the tree in which this change would land. If the two branches are not restacked first,
this work has a merge-order dependency: the cookie change edits the exact lines `6c25f740`
added.

## 1. What exists today

### 1.1 The pre-paint bootstrap

`src/lib/themeBootstrap.ts:29-31` exports `THEME_STORAGE_KEY = 'theme'` and
`THEME_BOOTSTRAP_SCRIPT`, a one-line IIFE that reads `localStorage.getItem('theme')`,
rejects anything that is not exactly `'dark'` or `'light'` (falling back to `'light'`), then
removes both classes from `document.documentElement` and adds the resolved one. It is wrapped
in `try/catch` because `localStorage` throws in Safari private mode.

`src/app/layout.tsx:24-31` injects it via `<script dangerouslySetInnerHTML>` inside `<head>`,
so it runs synchronously before the browser paints any body content. `src/app/layout.tsx:23`
carries `suppressHydrationWarning` on `<html>` -- required, because the server emits `<html>`
with no theme class and the client has one by the time React looks.

### 1.2 Where the `dark` class is applied

Three places, in this order:

1. Pre-paint, by the bootstrap: `src/lib/themeBootstrap.ts:31` -- `<html>` only.
2. Post-mount, by `ThemeContext`: `src/contexts/ThemeContext.tsx:51-60` -- `<html>` AND
   `<body>`, plus a write-back to `localStorage` at `:58`.
3. Never on the server. `src/app/layout.tsx:22-23` emits `<html lang="en">` with no class at
   all.

Tailwind v4 is class-based here: `src/app/globals.css:4` is
`@custom-variant dark (&:where(.dark, .dark *));` -- an ancestor selector, so the class on
`<html>` is sufficient for the whole tree. The `<body>` class added at
`ThemeContext.tsx:56-57` is redundant for styling; it is legacy.

### 1.3 ThemeContext's mount effect

`src/contexts/ThemeContext.tsx:32-33` initialises state to `'light'` and `mounted` to `false`.
The read from storage happens in a post-mount effect at `:36-48` via `readStoredTheme()`
(`:21-29`), which applies the same two-value validation as the bootstrap.

`:71-79` is the important part for D2: **until `mounted` flips true, the provider hands every
consumer the literal value `'light'`** (`:73`), regardless of what the bootstrap already put on
`<html>`. It also wraps children in an extra `<div>` that exists only in the unmounted branch.

### 1.4 What the toggle renders before hydration

`src/components/ThemeToggle.tsx:6` consumes `useTheme()`. Everything visible is derived from
`theme`:

- `:19` `aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}`
- `:20` the same string as `title`
- `:22-46` a moon glyph when `theme === 'light'`, a sun glyph otherwise

So for a returning dark-mode user the sequence is: bootstrap paints the page dark; SSR HTML +
first client render still say `theme === 'light'`; the button therefore shows a **moon** and
announces **"Switch to dark mode"** on top of an already-dark page. That contradiction is the
D2 defect. It resolves on the first post-mount effect tick.

It is rendered in three places: `src/app/page.tsx:14` (the public home page) and
`src/components/Header.tsx:243` and `:354` (desktop and mobile header, both inside the
`(dashboard)` group).

### 1.5 Existing test coverage

- `src/components/__tests__/ThemeToggle.test.tsx` mocks `useTheme` outright (`:8-10`), so it
  proves nothing about pre-hydration state.
- `e2e/theme-flash.spec.ts` is the real proof of the bootstrap. Its discriminating move is
  blocking `**/_next/**/*.js*` so React never hydrates (`:25`, `:45`). Tests 1-3 fail if the
  bootstrap is deleted; test 4 (`:65-76`) is a no-flip-back guard and passes either way. This
  file is the natural home for the D2 assertion too.

## 2. The actual change

1. Root layout becomes `async` and reads the cookie:
   `const theme = (await cookies()).get('theme')?.value === 'dark' ? 'dark' : 'light';`
   (Next 15.5.9 -- `cookies()` is async.)
2. Put the class on `<html>` server-side: `src/app/layout.tsx:22` becomes
   `<html lang="en" className={theme} suppressHydrationWarning>`.
3. Pass the resolved value down: `<ThemeProvider initialTheme={theme}>`. In
   `ThemeContext.tsx:32` seed `useState<Theme>(initialTheme)` instead of the hardcoded
   `'light'`, and in the unmounted branch at `:73` hand out `initialTheme` instead of the
   literal `'light'`. That single line is what actually fixes D2 -- `ThemeToggle` needs no
   change at all.
4. The toggle writes the cookie as well as `localStorage`. The write belongs in
   `ThemeContext.tsx`'s persistence effect (`:51-60`), not in `ThemeToggle.tsx`, so the
   programmatic `setTheme` path persists too:
   `document.cookie = 'theme=' + theme + '; path=/; max-age=31536000; samesite=lax'`
   (add `; secure` when `location.protocol === 'https:'`). It must be readable by the
   bootstrap, so it CANNOT be HttpOnly. A cookie holding one of two public enum values is not
   a secret, so that is acceptable -- but it means the cookie is attacker-writable via any XSS
   that already has script execution, which is why step 1 must validate rather than cast.
5. Remove `suppressHydrationWarning` only if step 4 is complete AND the bootstrap is removed
   (see section 4). While both mechanisms coexist, keep it.

## 3. THE COST -- what I actually measured

This is the section the owner's decision card did not have.

**The root layout is NOT already dynamic.** I checked rather than assumed:

- Grep for `next/headers`, `cookies()`, `export const dynamic`, `export const revalidate`
  across `src/app` returns matches only in leaf pages, leaf layouts, and server actions
  (e.g. `src/app/(dashboard)/admin/agentic-os/layout.tsx:32,40,47`,
  `src/app/(dashboard)/admin/matrix-map/health/page.tsx:45-46`). **Zero** matches in
  `src/app/layout.tsx`, `src/app/(dashboard)/layout.tsx`, or any `(auth)` layout.
- Middleware does not force dynamic. `src/middleware.ts` runs per-request on the matcher at
  `:154-165`, but a matched route can still be served from a prerendered static shell; Next
  tracks static-vs-dynamic from the render, not from middleware.
- The providers being Client Components does not force dynamic either. Client Components are
  prerendered to HTML at build time like anything else.

Ground truth from the most recent production build log I could find with a route table
(`C:\Projects\SSTAC-Dashboard\.tmp\build-monitor\sstac-build-20260807-231715-1500-85940.out.log`,
Next 15.5.9, 90 pages generated): **15 routes are `Static`, 119 are `Dynamic`.** The 15:

| Route | Behind `middleware.ts` matcher? |
|---|---|
| `/` | no |
| `/_not-found` | no |
| `/login` | no |
| `/signup` | no |
| `/cew-polls/holistic-protection` | no |
| `/cew-polls/prioritization` | no |
| `/cew-polls/tiered-framework` | no |
| `/cew-polls/wiks` | no |
| `/bn-rrm` | yes |
| `/demo-matrix-graph` | yes |
| `/matrix-options/private-data-access` | yes |
| `/survey-results/detailed-findings` | yes |
| `/survey-results/technical-standards` | yes |
| `/twg/discussions` | yes |
| `/twg/documents/new` | yes |

So the honest cost statement is: **the cost is NOT zero, but it is bounded at 15 routes, and
only 8 of them are genuinely cheap today.** The 7 middleware-matched ones already pay a
per-request edge invocation plus a Supabase `getUser()` round trip
(`src/middleware.ts:105`) before the static HTML is served; converting them to dynamic adds a
render on top of a request they already could not skip. The 8 that matter are `/`,
`/_not-found`, `/login`, `/signup` and the four `/cew-polls/*` pages -- i.e. exactly the
unauthenticated, CDN-cacheable, highest-traffic surface, including the two auth pages and the
public poll pages used at events.

Secondary, non-obvious consequences:

- `export const dynamic = 'force-dynamic'` is not needed; `cookies()` in the root layout
  makes the whole app dynamic implicitly. That implicitness is itself a risk: there will be no
  marker in the code saying "this made 15 routes dynamic", only a `cookies()` call.
- `/_not-found` becoming dynamic means every 404 -- including bot and scanner traffic -- costs
  a function invocation instead of a CDN hit.
- One partial mitigation exists and should be named: Next's `<html>` element can be kept
  static while only a small server component reads the cookie, IF the cookie read is pushed
  below a `<Suspense>` boundary (PPR). This project is on the stable Next 15 App Router with
  no `ppr` flag in `next.config.ts`, so that mitigation is NOT available today and should not
  be scoped as if it were.

## 4. What happens to the localStorage bootstrap

Three coherent end states:

- **(a) Remove it.** Server-rendered class is authoritative; `localStorage` stops being read
  at boot. Cleanest, and it deletes `themeBootstrap.ts` plus three of the four e2e tests.
  Risk: a user whose cookie is stripped (privacy extension, cookie-blocking mode, or the
  `/_next` static HTML being served from a shared CDN cache before the cookie exists) gets a
  hard flash back, with no fallback. Also strictly regresses the very defect B11 just fixed
  for anyone in that population.
- **(b) Keep it as a pure fallback.** Bootstrap runs only when the cookie is absent. Two
  mechanisms, one of which is rarely exercised -- so its failure mode is silent.
- **(c) Keep it, and make it a synchroniser.** Bootstrap reads the cookie FIRST, falls back to
  `localStorage`, and if the two disagree writes the cookie from `localStorage` (see
  section 5). Both stores converge on the next paint.

**Recommendation: (c).** The bootstrap is already written, already covered by three
falsified e2e tests, and costs one inline script tag. It is the only option that keeps the
no-flash guarantee intact for cookie-less users while giving the cookie authority everywhere
else, and it doubles as the migration path in section 5 at no extra cost. Option (a) trades a
proven fix for an unproven one; option (b) has (c)'s complexity without (c)'s migration.

The load-bearing constraint under (c) is that the bootstrap and the server MUST resolve
identically or the page flips after hydration. Both must apply the same validation -- only
`'dark'` and `'light'` accepted, everything else `'light'` -- which is already the contract
documented at `themeBootstrap.ts:12-20` and enforced at `ThemeContext.tsx:21-29`.

## 5. Migration for existing users

Existing users have `localStorage.theme` and no cookie. On their first request after deploy
the server sees no cookie, resolves `'light'`, and emits `<html class="light">` -- which is
wrong for every dark-mode user, and is exactly the D2 defect again, once.

Under recommendation (c) the bootstrap closes this in the same frame it already runs in:

1. Read `document.cookie` for `theme`. If valid, use it; done.
2. Else read `localStorage`. If valid, apply it to `<html>` AND write the cookie
   (`path=/; max-age=31536000; samesite=lax`).
3. Else `'light'`.

Cost to the user: one wrong server-rendered class that is corrected before first paint, once,
per browser. That is strictly better than today. No server-side migration, no user action.

Note the cache interaction: with the root layout dynamic there is no shared CDN copy of the
HTML, so one user's resolved theme can never be served to another. Under any scheme that kept
the pages static, a cookie-varying `<html class>` would be a genuine cache-poisoning bug --
another reason the dynamic cost in section 3 is not optional.

## 6. Test plan

**Assertable in jsdom (Vitest + RTL):**
- `ThemeProvider` seeded with `initialTheme='dark'` hands `'dark'` to consumers on the FIRST
  render, before any effect flush. This is the direct D2 regression test.
- `ThemeToggle` rendered under a provider seeded `'dark'` has `aria-label="Switch to light
  mode"` and renders the sun path on first render -- assert the accessible name, not a class.
- Cookie validation is total: `'chartreuse'`, `''`, absent, and a cookie of the wrong name all
  resolve `'light'`. Factor the resolver into a pure exported function so this is a plain unit
  test with no DOM.
- `setTheme`/`toggleTheme` writes a `theme=` cookie with `path=/` and `samesite=lax`
  (jsdom implements `document.cookie` well enough for the name/value; it does NOT expose
  `SameSite` or `Secure` on read).

**Needs Playwright:**
- The end-to-end D2 assertion: set the cookie, load with the JS bundle blocked
  (`e2e/theme-flash.spec.ts:25,45` already has the pattern), and assert the button's
  accessible name is "Switch to light mode" in the SERVER HTML. This is the only place the
  claim can actually be proven, because it requires a real server render.
- Server HTML carries `class="dark"` on `<html>` (string-inspect the response body, as
  `theme-flash.spec.ts:29-41` already does).
- The migration path: seed `localStorage` only, no cookie, load, assert the cookie now exists
  and `<html>` is dark.
- No post-hydration flip (extend `theme-flash.spec.ts:65-76`).

**CANNOT be proven at unit level -- state this in the test file, do not let a green suite
imply it:**
- That there is no visible flash. jsdom has no paint pipeline and no layout engine; a test
  asserting "the provider ends up dark" passes identically whether the class lands in frame 0
  or frame 30. This is already written down at `e2e/theme-flash.spec.ts:6-8` and the same
  limitation applies verbatim to D2.
- That the route actually became dynamic or stayed static. That is only observable in the
  `next build` route table. If the prerender cost matters, the guard is a build-log check, not
  a unit test.
- `Secure`/`SameSite`/`HttpOnly` attribute behaviour, cross-origin cookie handling, and
  cookie-blocking browser modes.
- That the server-resolved theme and the bootstrap agree in production. Only the blocked-JS
  Playwright run distinguishes "they agree" from "hydration quietly corrected a disagreement".

## 7. Risks

- **SSR/client mismatch.** Today `suppressHydrationWarning` at `layout.tsx:23` masks a known,
  deliberate mismatch on `<html>`. Once the server emits a class, that suppression starts
  masking real bugs -- for instance a cookie/localStorage disagreement -- silently. Removing
  the suppression is desirable but only safe when the bootstrap is guaranteed to agree with
  the server, which under recommendation (c) it is, by construction, on every request that
  carries a valid cookie. Sequence it as a separate, later PR.
- **The unmounted-branch DOM shape.** `ThemeContext.tsx:71-79` returns children wrapped in an
  extra `<div>` that the mounted branch (`:81-85`) does not have. That is a structural
  hydration difference already present today and unrelated to theme; seeding `initialTheme`
  does not fix it, and anyone touching this file should not "clean it up" in the same PR.
- **CSP.** `src/middleware.ts:11` includes `'unsafe-inline'` in `script-src`, which is the
  only reason the unhashed inline bootstrap is permitted at all
  (documented at `themeBootstrap.ts:25-27`). If CSP is ever tightened to nonce or hash, the
  bootstrap is blocked and, under recommendation (c), the cookie-less fallback and the
  migration path both disappear **silently** -- no console error the user will ever see, just
  the flash returning. Whoever tightens CSP must be handed this dependency. Note the cookie
  approach does not by itself remove the `'unsafe-inline'` requirement, because the fallback
  script stays.
- **Cookie and localStorage disagree.** Possible whenever a user has two tabs, or an older
  build in bfcache, or clears one store and not the other. Resolution order must be written
  down and implemented once: **cookie wins** (it is what the server rendered; preferring
  `localStorage` would guarantee a post-hydration flip), and the winner is written back to the
  loser. Section 5's step 2 is the same code path.
- **Cookie is client-writable.** Not HttpOnly by necessity. Validate on the server; never
  interpolate the raw value into a class attribute.
- **Merge-order dependency.** See section 0. This edits lines that only exist on
  `feat/section-b-wave0-20260815`.

## 8. PR breakdown and size

| PR | Content | Rough size |
|---|---|---|
| 1 | Pure `resolveTheme(raw: string \| undefined): Theme` helper + unit tests. No wiring. | ~40 lines src, ~60 lines test |
| 2 | `ThemeProvider` accepts `initialTheme`, seeds state at `:32` and the unmounted branch at `:73`; persistence effect at `:51-60` also writes the cookie. Unit tests for the first-render claim. **This PR alone fixes the D2 contradiction for any user whose theme is already known at render time.** | ~30 lines src, ~80 lines test |
| 3 | Root layout reads the cookie, becomes async, sets `className` on `<html>`, passes `initialTheme`. This is the PR that pays the prerender cost. Record the before/after route table from `npm run build:monitored:clean` in the PR body. | ~15 lines src |
| 4 | Bootstrap becomes cookie-first with `localStorage` sync-forward (section 5). Extend `e2e/theme-flash.spec.ts`. | ~15 lines src, ~60 lines e2e |
| 5 | Optional, later: drop `suppressHydrationWarning`; drop the redundant `<body>` class writes at `ThemeContext.tsx:56-57`. | ~10 lines |

Total: roughly 110 lines of source and 200 of test across five small PRs. Half a day of
focused work plus gate time, not counting codex rounds.

## 9. Recommendation -- read this before approving the whole thing

The owner picked option C from a card that did not say "this makes `/`, `/login`, `/signup`
and the four public poll pages server-rendered on every request". Stating it plainly now:

**PR 2 alone fixes the user-visible defect for the overwhelmingly common case, at zero
prerender cost.** The contradiction is not caused by the server rendering the wrong class --
the bootstrap already fixes the class. It is caused by `ThemeContext.tsx:73` handing consumers
a hardcoded `'light'` during the unmounted window. Any mechanism that tells the provider the
true theme earlier closes the window. A cookie read in the root layout is one such mechanism;
it is also the most expensive one available.

Two cheaper mechanisms exist and should be weighed explicitly:

1. **Read the class the bootstrap already wrote.** `ThemeProvider` can seed state from
   `document.documentElement.classList.contains('dark')` in a `useState` initialiser rather
   than an effect. On the client's FIRST render the bootstrap has already run, so the seed is
   correct and the toggle is correct on first paint. Cost: zero server change, zero prerender
   change. Limitation, stated honestly: this cannot fix the SERVER-rendered HTML, so a no-JS
   reader or a crawler still sees the light-mode glyph. It fixes what a real user perceives; it
   does not fix what curl sees.
2. **Make the glyph CSS-driven and the label state-independent.** Render both icons with
   `dark:hidden` / `hidden dark:block`; the correct one shows pre-paint because `<html>.dark`
   is already correct. Then give the button a name that is never wrong -- "Toggle dark mode"
   with `aria-pressed` -- instead of a name that asserts a direction. Cost: zero server change.
   This removes the contradiction rather than racing it.

If the requirement is genuinely "the served HTML must be correct for crawlers, no-JS readers,
and email-preview renderers", option C is the right answer and the 15-route cost is the price.
If the requirement is "a returning dark-mode user must never see a moon on a dark page", then
mechanism 1 or 2 achieves the same user-visible outcome for a fraction of the work and none of
the runtime cost, and option C is over-engineering.

My recommendation: **do PR 2 first and ship it, then decide.** It is a prerequisite for option
C anyway, it is independently valuable, and once it is in, the owner can look at the remaining
gap -- server HTML only -- and judge whether 15 routes going dynamic is worth closing it.
That ordering costs nothing and defers the only irreversible-feeling decision until after the
cheap half has been observed working.
