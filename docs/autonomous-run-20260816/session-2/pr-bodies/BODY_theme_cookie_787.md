# PR #787 -- feat/theme-cookie-20260816

CI does not run on this PR (base is not `main`). Gate evidence is local and reproduced below.

STACKED on PR #782 (`feat/section-b-wave0-20260815`), which carries the pre-paint theme bootstrap
this work builds on. **Retarget this PR to `main` once #782 merges.**

## What this changes

The theme toggle's glyph and `aria-label` were rendered from the provider's pre-mount `light`
value, so for one frame an already-dark page carried a control announcing "Switch to dark mode".
That is an accessibility defect, not a cosmetic one.

The theme is now resolved on the SERVER from a `theme` cookie, so the served HTML is correct for
first paint, for crawlers, and for readers without JS. The synchronous pre-paint bootstrap stays,
covering cookie-less visitors and migrating them.

## Commits

| sha | subject |
|---|---|
| `6c25f740` | eliminate the light-theme flash with a synchronous bootstrap (audit B11) |
| `b5f953bb` | seed ThemeProvider during render, not in a post-mount effect (audit D2) |
| `6818d1fb` | resolve the theme from a cookie on the server (owner decision D2, option C) |
| `0117e8e0` | one cookie parser for server and client, and stop issuing unasked-for cookies |
| `239a4e27` | land the scope document the code already cites |
| `3a5eb26f` | make the wire assertions prove what they claim, and stop the docs prescribing the anti-patterns |

## The accepted cost

Reading a request header in the ROOT layout opts the whole app out of static prerendering. This
was priced before the decision, not discovered after it: the 2026-08-07 baseline measured 15
Static / 119 Dynamic = 134 routes, and the owner approved option C with that number in front of
them.

Confirmed on this branch: the 08:20 build log carries a route table with **zero Static rows** --
Next omits the `(Static)` legend line entirely -- and 134 Dynamic rows, matching 15 + 119. The
prediction that all 15 previously-static routes become dynamic is measured fact.

Caveat: that log lives under `.tmp/`, which is gitignored, so the evidence does not survive a
fresh clone and will need re-running to re-verify.

## KNOWN RESIDUAL -- please read before approving

**The accessibility defect is fully closed for requests carrying a cookie, and NARROWED, not
eliminated, for one population.** A visitor who set a theme preference BEFORE the cookie existed,
and therefore has `localStorage.theme = 'dark'` but no cookie, gets a server-rendered `light`
document. The pre-paint bootstrap corrects the page before paint, but React's first render is
seeded from the server's value, so for that ONE render the toggle draws the moon glyph and the
label "Switch to dark mode" on an already-dark page. The mount effect corrects it a tick later,
and the bootstrap writes the cookie on that same visit, so every subsequent request is
server-correct. One render, once per browser, for a shrinking population. No hydration mismatch
is involved -- server and client render 0 are identical.

This was raised as a P1 by an adversarial holistic review, argued down to P2 on the evidence
below, and accepted as a documented residual rather than fixed:

- Seeding the first client render from the DOM (the reviewer's first suggestion) would make client
  render 0 disagree with the server HTML for this population, producing a real hydration mismatch
  on the toggle's `aria-label`, `title` and glyph. `suppressHydrationWarning` sits on `<html>` and
  does not cascade to descendants.
- Having the server mint a cookie on first sight would close the window, and is exactly what
  `0117e8e0` REMOVED, because it handed `theme=light` to visitors who never chose anything.

The reviewer's endorsed remedy -- render a theme-independent accessible name in both trees, then
switch to the directional label after mount -- is recorded as a FOLLOW-UP. It is not done here
because it changes the toggle's accessible name for EVERY user on first render, including the
majority who currently get a correct directional label immediately, and that trade deserves its
own review and its own falsification rather than landing at the end of a review cycle.

## ROLLBACK IS NOT FULLY CLEAN -- state this before merging

Reverting the code stops the cookie being read, and the reverted code falls back to
`localStorage`, which the provider keeps current. No user loses a preference.

But a **one-year `theme` cookie remains** on every visitor who expressed a preference while this
was live. Nothing reads it after a revert and nothing mis-reads it, so it is inert -- but it is
persistent client state that a revert does not clean up, and it should be a conscious acceptance
rather than a surprise.

## Caching -- checked, closed, with one forward-looking note

A themed HTML response cached and served to a user with the opposite preference would be silent
and real. It cannot happen here. Measured on a live server: both the no-cookie and `theme=dark`
responses carry `Cache-Control: no-store, must-revalidate`. `vercel.json` sets no headers,
`next.config.ts` defines no `headers()`, and `src/middleware.ts` sets no cache headers. Dynamic
Next responses are `private, no-cache, no-store` by default. No shared cache can store them.

**Forward-looking:** the response `Vary` lists rsc/router keys but NOT `Cookie`. That is harmless
under `no-store`. If anyone ever introduces caching on these routes, the missing `Vary: Cookie` is
precisely the poisoning vector, on a response that now varies by cookie. Worth a comment in
whatever change introduces caching.

Measured on `next dev`, not a production build.

## What `3a5eb26f` fixes (this session's commit)

Three verification-layer defects. No runtime behaviour changed: `src/app/layout.tsx`,
`src/contexts/ThemeContext.tsx`, `src/lib/theme.ts` and `src/middleware.ts` are untouched, and
`THEME_BOOTSTRAP_SCRIPT` is byte-identical (md5 confirmed before and after).

1. **A falsification record that had quietly stopped holding.** The spec header claimed tests 1-3
   fail without the bootstrap. Re-measured by blanking `THEME_BOOTSTRAP_SCRIPT`: 3 fail, 6 pass,
   and test 3 is NOT among them -- once the server began emitting the class, test 3 could no
   longer discriminate the bootstrap. Test 3 was rewritten to assert on the SERVED MARKUP and now
   fails if the server resolution is removed.

2. **The helper those assertions rest on was wrong three further times**, each caught by a
   constructed counter-example: substring-matching the tag scored on `data-theme="light"`;
   matching `class=` scored on class-like text inside another attribute; and a non-sticky walk
   resumed INSIDE a value it had failed to parse. It now strips comments, anchors to the prologue,
   walks attributes with a sticky regex, and bails to an empty list on anything unparseable -- so a
   wrong answer is an EMPTY one, which fails loud because every call site makes a positive
   assertion. Seven guard tests assert every counter-example the reviewers built.

3. **A CSP comment that was wrong where it mattered.** It named `src/middleware.ts` as the policy
   governing the inline script. True only where middleware runs: `config.matcher` excludes `/`,
   `/login`, `/signup` and `/cew-polls/*` -- exactly where a cookie-less first-time visitor meets
   the script, and where no CSP is emitted at all.

4. **A scope document prescribing the anti-patterns the code forbids.** It landed unchanged as the
   final commit of the branch that implemented it, still saying "SCOPING ONLY. Nothing
   implemented.", while `layout.tsx` points maintainers at it. It prescribes Next's `cookies()`
   (the code deliberately reads the raw header, because `cookies()` percent-decodes, does not trim,
   lets the LAST duplicate win, and reports a valueless `theme` as `"true"`) and the
   persistence-effect cookie write (removed in `0117e8e0`). An 8-item superseded banner plus inline
   markers at every instruction that contradicts the shipped code.

## Review

- **Leg 1a (independent Opus, 8 rounds to GREEN).** Rounds 1-7 each found a real defect; several
  were introduced by the previous round's repair. The round-8 reviewer served the real app,
  hexdumped byte 0, extracted the helper verbatim and executed it, and verified React's escaping
  empirically rather than assuming it.
- **Leg 1b (situation review).** Found that this pair had NO completed Leg 2 verdict at any tier
  when the session began, and later that this PR body did not exist -- which is why it does now.
- **Leg 2 (codex `gpt-5.6-luna`, gate tier): targeted GREEN, strategic GREEN, holistic GREEN.**
  Stated honestly: targeted and holistic verdicts came from explicit verdict-closure rounds after
  luna omitted the mandatory verdict line, which is a documented quirk of that model. The holistic
  GREEN is conditional on the residual and rollback disclosures above.

## Gates (local, frozen tree, tip `3a5eb26f`)

| Gate | Result |
|---|---|
| Lint | `76 problems (0 errors, 76 warnings)` -- matches baseline |
| Typecheck | clean, `tsc.log` 0 bytes |
| Unit | **6843 passed** / 19 skipped / 2 todo (6864); 357 files passed, 3 skipped |
| Build | exit 0, corroborated by route table + `First Load JS` in the compiler stdout |
| E2E | exit 0, **208 passed / 0 failed** of 346 (138 skipped), 25 `chromium-auth` refs |
| Tree | `TREE_UNCHANGED=YES`, 0 dirty files at start and end |

`e2e/theme-flash.spec.ts` executed rather than skipping -- verified by running it directly across
all projects: **48 tests, 48 passed** (16 tests x chromium + firefox + webkit).

Note for the record: an earlier run of this same suite on this same content reported
`BUILD_EXIT=1` and 70 e2e failures. That was a `.next` quarantine collision caused by concurrent
Playwright dev servers in the same worktree (`Cannot find module .next/server/pages/_app.js`), not
a code defect. Re-run solo, it is the green above.

## Not verified

- No real-browser visual check beyond the Playwright assertions.
- Cache headers measured on `next dev`, not a production build.
- The route-table evidence lives in gitignored `.tmp/` and will not survive a fresh clone.
- `#782`, on which this is stacked, has NOT had a Leg 2 review in this session; its gate evidence
  is inherited from the prior session rather than re-run.
