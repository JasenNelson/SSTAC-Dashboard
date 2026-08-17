# EXACT-TARGET ADVERSARIAL PRE-LANDING REVIEW -- SSTAC-Dashboard frontend stack

You are reviewing a FROZEN merge candidate. This is the last review before an owner authorizes a
force-push and six merges into `main` of a production Next.js 15 / React 19 regulatory-science
dashboard. Findings here change what ships. MAXIMUM DIFFICULTY. Surface review is insufficient.

## Frozen identities (do not review anything else)

    origin/main             120c6f9a   (unmoved, verified live)

    STACK A (independent)    base main
      #783 feat/mo-batch2-20260816          f0f56330  base main
      #784 feat/section-b-wavea-20260816    c41f1463  base #783
      #785 feat/deferred-triage-20260816    87b8d2c8  base #784
      #788 feat/audit-p0-20260816           04c9cc10  base #785   LOCAL ONLY, not yet pushed
      combined trial tree 0d2d85e8: six gates GREEN, 6865 unit passed, 167 e2e passed / 0 failed

    STACK B (independent)    base main
      #782 feat/section-b-wave0-20260815    6caaa34e  base main
      #787 feat/theme-cookie-20260816       45293f1a  base #782   LOCAL ONLY, rebased history,
                                                                  needs --force-with-lease
      combined trial tree d4397227: six gates GREEN, 6843 unit passed, 208 e2e passed / 0 failed

Both trial trees merged into origin/main 120c6f9a with ZERO conflicts.

The diffs embedded below are the exact frozen content:
  - DIFF 1: `git diff 120c6f9a..6caaa34e`  = all of #782 against main
  - DIFF 2: `git diff 6caaa34e..45293f1a`  = all of #787 against its base #782
  - DIFF 3: `git diff 87b8d2c8..04c9cc10`  = all of #788 against its base #785
Two long pure-documentation `.md` files are omitted deliberately; every source and test change is here.

## Required reasoning depth

COMPREHENSIVE, DETAILED, exhaustive, adversarial, deep multi-step reasoning. Reason at all three
levels and say which level each finding belongs to: TARGETED (this hunk), STRATEGIC (this branch's
interaction with its stack and with main), HOLISTIC (the whole landing as one delivered frontend).
Hard technical domains in scope: SSR/CSR hydration ordering in the React 19 App Router, pre-paint
inline bootstrap scripts and FOUC, cookie parsing on both server and client, WCAG 4.1.2 accessible
name correctness, CSS print media behavior, JSDOM's inability to lay out (no layout engine, so
`toBeVisible()` cannot see a zero-height ancestor), statistical provenance and citation honesty for
censored environmental data, and force-push safety on published Git history.

Do not accept a claim because a test passes. Ask whether the test COULD have failed. A regression
test that has never seen its own bug is an assertion, not a guard. Prior defects on this exact lane
passed a full green gate battery while silently HIDING a correct regulatory value rather than
corrupting it -- that is the defect class to hunt.

## Answer these eight questions explicitly, each with file:line evidence

1. Are #782 and the corrected #787 safe ONLY as a coupled landing unit? Specifically: does #782
   landing alone leave `ThemeContext.tsx` handing consumers `'light'` while the pre-paint script has
   already set `<html class="dark">`, so that `ThemeToggle` announces the wrong accessible name on a
   dark page (WCAG 4.1.2)? Note for adjudication: one strong reviewer previously concluded #782 was
   "self-consistent and safe to merge now" and that conclusion was challenged as WRONG. Decide for
   yourself from the code and say which reading the code supports.
2. Did the corrected #787 PRESERVE (a) the quote-agnostic regex assertion in `e2e/theme-flash.spec.ts`
   that #782 introduced, and (b) a real drift guard tying the inline bootstrap's theme value set,
   storage key and default to the exported constants rather than retyped literals? Would that guard
   actually FAIL if someone hardcoded one interpolation? Is `src/lib/theme.ts` genuinely a leaf with
   no import cycle?
3. Is #788's fail-closed provenance behavior CORRECT, and is its disclosure proportionate? The claim
   is: the unresolved-censoring state is unreachable today because the migration declares
   `censored boolean NOT NULL DEFAULT false` and only the TypeScript types widen it to
   `boolean | null`; the guard exists so a future migration dropping NOT NULL turns the UCL OFF
   instead of emitting a false ProUCL citation. Verify the guard's placement relative to the existing
   `n < 2` guard and to any pathway branching, verify no caller needs changing, and verify no
   calculation changes for data with resolved censoring status.
4. Are Stack A and Stack B individually safe against origin/main 120c6f9a?
5. What exact bottom-up merge order and merge METHOD (merge commit vs squash vs rebase) preserves the
   stacked history and keeps CI meaning intact for stacked PRs whose bases are other PRs?
6. Are exact-tip per-branch gate reruns MATERIALLY required? Two per-branch results are stale: #788
   was gated at 90f4bf7e but its tip is 04c9cc10; #787 was gated at 3a5eb26f but its tip is 45293f1a.
   Both final commits ARE included in the combined trial trees that ran all six gates green. Is the
   combined evidence sufficient, or is there a specific failure mode only a per-tip run could catch?
7. Does anything in these diffs depend on remote state that could invalidate either trial tree?
8. Is there any MATERIAL rendered-browser, accessibility, theme, or print gap that BLOCKS landing?
   Blocking only. Do not reopen deferred design work, do not propose refactors, do not propose new
   audits. Known and deliberately deferred, do not re-report: the statistical TREATMENT choice for an
   unresolved censoring row; cross-tab concurrent save pairing a clipped draft with an empty
   truncation record; four named BN-RRM findings; 26 remaining audit findings.

## Output contract

For every finding: SEVERITY (P0 blocks landing / P1 fix before landing / P2 follow-up / P3 note),
LEVEL (TARGETED / STRATEGIC / HOLISTIC), exact `file:line`, the concrete failure scenario with inputs
and the wrong output, and what would falsify your own claim. Then answer all eight questions in
order. Then end with exactly one line, `VERDICT: GREEN` or `VERDICT: RED`. RED means at least one P0
or P1 blocks this landing.

---

