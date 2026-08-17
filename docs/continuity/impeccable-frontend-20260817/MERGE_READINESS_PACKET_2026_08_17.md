# Merge-readiness packet -- SSTAC-Dashboard, 2026-08-17

STATUS: STOPPED FOR INDEPENDENT REVIEW. Nothing merged. Nothing pushed. Two commits are LOCAL ONLY.
Scope of this unit was a bounded merge-readiness correction: rebase #787, reconcile F3-1/F3-2, make
#788's disclosure accurate, add the smallest fail-closed provenance invariant, build and gate the
combined landing trees, freeze, stop.

## 1. Frozen inputs (measured, not inherited)

    origin/main            120c6f9a04de7e689c54579919f60144466e7f79
    #782 wave0             6caaa34e508cafc174f77b1f666e5bf6289e7e24   pushed
    #787 theme-cookie      45293f1ae4f72f4a06007464a89ad2f7e532a310   LOCAL ONLY (rebased)
    #783 batch2            f0f5633066b9390db922cc3e6c6c98274ef381a9   pushed
    #784 waveA             c41f1463c8bb91ef2a3687e5d82040cef1b14f8d   pushed
    #785 triage            87b8d2c82d0ade1f3208d01115a32f3eaccb20b8   pushed
    #788 p0                04c9cc1062d6dc9b08c2494dfc4792f87e1104db   LOCAL ONLY (new commit)

    Trial tree STACK A     0d2d85e8f7687c81c88627a814f1b59b96bbbf77   main+783+784+785+788
    Trial tree STACK B     d43972277903c3d9659e1e0b58e4b5c350bd07d2   main+782+787

Rollback points: tag `p787-prerebase-3a5eb26f`; `freeze/787-prerebase-sha.txt`;
`freeze/p0-worktree-restore-point.txt`. The p0 worktree was returned to
`feat/audit-p0-20260816 @ 04c9cc10`, clean, and verified against that file.

## 2. What changed in this unit

### #787 -- rebased onto the exact #782 tip
`git rebase --onto 6caaa34e d6d4fa0f -X theirs`, 5 commits replayed, base confirmed by
`git merge-base --is-ancestor 6caaa34e HEAD` = TRUE. New tip after reconciliation: 45293f1a.

    2c38c6a6  seed ThemeProvider during render (audit D2)
    88d19322  resolve the theme from a cookie on the server
    b5a90a00  one cookie parser for server and client
    59f0ad15  scope document
    1588714a  make the wire assertions prove what they claim
    45293f1a  restore one source of truth for the theme value set after the rebase   <- NEW

**F3-1 (quote-fragile e2e assertion): no change required.** The quote-agnostic regex from #782's
6caaa34e survived the rebase intact in `e2e/theme-flash.spec.ts`. Verified by reading the file, not
inferred. DO NOT revert it to an exact substring: `JSON.stringify` emits double quotes, and an
exact-substring version of that assertion previously reported the bootstrap "absent from the served
HTML" in three browsers while it was present and working.

**F3-2 (deleted drift guard): fixed in 45293f1a.** After the rebase the theme value set was retyped
in three places -- the inline bootstrap script (cookie branch AND localStorage branch), the
provider, and #787's own new cookie parser -- and `tsc` failed with three "Cannot find name" errors
from the surviving guard. Resolution: `src/lib/theme.ts` OWNS `VALID_THEMES`, the derived `Theme`
type, and `DEFAULT_THEME = VALID_THEMES[0]`. It is the leaf -- `themeBootstrap.ts` imports from it
and it imports nothing back, so there is no cycle. The inline script derives its storage key, valid
-value guard and default from those constants via `JSON.stringify`. Cookie-first resolution order,
cookie name, attributes and max-age are UNCHANGED; the server resolution path was not touched.
Falsified: hardcoding one interpolation fails the guard "generates its storage key, valid-value
guard, and default from the exported constants, not retyped literals".

    Files: src/contexts/ThemeContext.tsx, src/lib/theme.ts, src/lib/themeBootstrap.ts,
           src/lib/themeBootstrap.test.ts
    tsc clean; 57 tests pass across themeBootstrap.test.ts, ThemeContext.test.tsx, theme.test.ts.

### #788 -- disclosure corrected, fail-closed invariant added (04c9cc10)

**The previous disclosure was WRONG and is withdrawn.** It asserted a live statistical error. The
state is NOT REACHABLE on the live path:
`supabase/migrations/20260519000001_matrix_map_schema.sql:368` declares
`censored boolean NOT NULL DEFAULT false`, and the measurements RPC selects `m.censored` directly.
Only the TypeScript types widen it to `boolean | null`
(`src/stores/matrix-map/measurementStore.ts:25`, `src/app/api/matrix-map/export/route.ts:52`).
So the `unknown` badge is DEFENSIVE rendering, not evidence that live statistics are wrong.

**The real failure mode, had a null ever appeared, was false provenance -- not a bad label.**
`stats.ts` counts a null as a DETECT; `hasCensored = nonDetects > 0` gates Kaplan-Meier; and
`recommend-ucl.ts` returns UNCENSORED ProUCL citations when that flag is false. A dataset of unknown
censoring status would have been reported as e.g. "ProUCL 5.2 Section 2.5: Normal distribution ->
95% Student's-t UCL" -- a citable false provenance claim about a screening estimate.

**The invariant added.** `stats.ts` counts unresolved-censoring rows (observational only; no row is
handled differently) and exposes `unresolvedCensoring`. `recommendUcl` takes that count and, after
the existing `n < 2` guard and before any pathway branching, FAILS CLOSED when non-zero:
`recommendedMethod: 'none'` -- the shape the `n < 2` case already returns, so no caller changes --
with a basis string citing no ProUCL section and asserting neither censored nor uncensored
treatment. Unreachable today by construction, which is the point: a future migration dropping
NOT NULL turns the UCL OFF rather than mislabelling its provenance.

    Files: src/lib/matrix-map/stats.ts, src/lib/matrix-map/recommend-ucl.ts, and their tests.
    NO existing calculation or output changes for data with resolved censoring status.
    Falsified: neutralising the guard makes an unresolved dataset return 'studentT95' again, and
    the test fails on "expected 'studentT95' to be 'none'".

**Explicitly NOT done:** choosing the statistical treatment for an unresolved row (exclude /
non-detect at the detection limit / detect). Each moves the estimate. `gpt-5.6-sol` (xhigh)
confirmed there is no conventional default -- EPA ProUCL 5.2 assumes observations are already
classified and gives no rule for an absent indicator. Failing closed refuses to pick one silently.
No adjacent statistics logic was refactored; no new audit scope was opened.

## 3. Gate evidence -- COMBINED landing trees (the new evidence)

Finding F4-2 was that no gate had ever run the merged result. Both combined trees were constructed
against `origin/main 120c6f9a` and gated in full. Both merged with ZERO conflicts, which also
verifies F4-1's caveat that the zero-overlap claim holds only against origin/main (local main is 17
commits stale, where the stacks share 99 files).

    STACK A  0d2d85e8   lint 0 | tsc clean | unit 6865 passed/19 skipped (360 files)
                        build exit 0 CORROBORATION=OK | e2e 167 passed/0 failed, 32 auth refs
                        docs STATUS: PASS | ALL_SIX_GATES_RAN=YES | TREE_UNCHANGED=YES

    STACK B  d4397227   lint 0 | tsc clean | unit 6843 passed/19 skipped (360 files)
                        build exit 0 CORROBORATION=OK | e2e 208 passed/0 failed, 25 auth refs
                        docs STATUS: PASS | ALL_SIX_GATES_RAN=YES | TREE_UNCHANGED=YES

Per-branch evidence (frozen in `freeze/`): wave0 6800/172, batch2 6804/165, waveA 6813/165,
triage 6824/167, p0 6861/167 (at 90f4bf7e), theme 6843/208 (at 3a5eb26f).

**TWO PER-BRANCH RESULTS ARE NOW STALE, deliberately noted rather than quietly carried:**
 - #788 was gated at 90f4bf7e; its tip is 04c9cc10. Covered by the STACK A combined run.
 - #787 was gated at 3a5eb26f; its tip is 45293f1a. Covered by the STACK B combined run.
If per-branch evidence on the exact final tips is required, those two need re-running. The combined
runs are the stronger evidence and both include the final commits.

## 4. What still requires authorisation -- NOT done in this unit

1. **`--force-with-lease` push of #787.** The rebase rewrote already-published history
   (3a5eb26f -> 45293f1a). This is the first action requiring a decision. Rollback: tag
   `p787-prerebase-3a5eb26f`.
2. **Ordinary push of #788's 04c9cc10.**
3. **All merges.** Stack A bottom-up: #783 -> #784 -> #785 -> #788. Stack B: #782 -> #787.
   The stacks are independent at these tips.
4. **#782 must not land alone** (finding F1-1, independently confirmed): `ThemeContext.tsx:34,86`
   hand consumers 'light' while the pre-paint script has already set `<html class="dark">`, so
   `ThemeToggle.tsx:19` announces "Switch to dark mode" on a dark page -- WCAG 4.1.2. #787's
   `seedTheme` (commit 2c38c6a6, "audit item D2") fixes it. NOTE: `gpt-5.6-sol` at xhigh, asked this
   directly with 45 tool calls, said #782 was "self-consistent and safe to merge now" -- that was
   WRONG, and an Opus adversarial pass caught it. Worth an independent adjudication.

## 5. Open items carried forward, unchanged by this unit

 - Cross-tab concurrent save can pair a clipped TWG draft with an empty truncation record; needs a
   shared revision/hash across both storage keys.
 - BN-RRM: `RiskComparison.tsx:463` print clip (host chain IS print-enabled, so it does reach
   paper), `:456` vs `:350` predicate/denominator mismatch, `BNRRMClient.tsx:438` count-after-slice,
   `memo-generator.ts` dead third-state guards. Confirmed by two models; follow-up lane.
 - Audit remainder: 26 of 34 findings open (2 P1, 13 P2, 11 P3). Plan in
   `plan/AUDIT_REMAINDER_PLAN.md`, 9 lanes. Lane 1 (TWG responsive P1) never started.
 - `stats.ts` statistical TREATMENT decision (see section 2).

## 6. Evidence index

    freeze/frozen-inputs.txt              the SHAs above
    freeze/trial-stackA-RESULT.txt        combined Stack A six-gate run
    freeze/trial-stackB-RESULT.txt        combined Stack B six-gate run
    freeze/{wave0,batch2,wavea,triage,p0-FINAL2}-RESULT.txt   per-branch runs
    freeze/theme-note.txt                 why theme has no per-branch run at its final tip
    freeze/787-prerebase-sha.txt          rollback point for the rebase
    freeze/p0-worktree-restore-point.txt  worktree restore point (verified)
    review/premerge-adversarial.md        the RED review this unit responds to (F1-1..F4-2)
    review/787-f32-reconcile.md           F3-2 reconciliation note
    review/788-failclosed-guard.md        fail-closed guard note
    artifacts/pr-body-p0.md               #788 body with the corrected disclosure
    PROJECT_HQ_HANDOFF_2026_08_17.md      the wider situation summary
    gates.sh                              the six-gate runner used throughout
