# UI/UX autonomous run -- PR manifest 2026-08-16

Follows the format of `docs/MATRIX_OPTIONS_AUTONOMOUS_DOCS_PR_MANIFEST_2026_07_08.md`.

## RETARGET column -- read this first

`.github/workflows/ci.yml` fires only on `pull_request: branches: [main, develop]`, so a PR
whose base is another feature branch gets **zero required CI**. Verified directly, twice.

Earlier in the run I predicted this list would end up empty. **That was half wrong, and the
correction matters.** #781 merged mid-run, so the two branches based on `main` do get real CI.
But batch 2, Wave A and the deferred triage all edit `page.tsx` and `MatrixDashboard.tsx`, so
they are a linear stack -- and everything above the first one is a stacked PR with no CI.

| PR | Branch | Tip | Base | CI | RETARGET after merge |
|---|---|---|---|---|---|
| (pending) | `feat/section-b-wave0-20260815` | `d6d4fa0f` | `main` | **real** | none |
| (pending) | `feat/mo-batch2-20260816` | `6612fe6b` | `main` | **real** | none |
| (pending) | `feat/section-b-wavea-20260816` | `24f90c9d` | `feat/mo-batch2-20260816` | **NONE** | **YES** -- retarget to `main` once batch 2 merges |
| (pending) | `feat/deferred-triage-20260816` | `bfbab1c9` | `feat/section-b-wavea-20260816` | **NONE** | **YES** -- retarget to `main` (or to Wave A's successor) once Wave A merges |

**Merge order is therefore fixed:** wave0 (independent, any time) -> batch 2 -> Wave A ->
deferred triage. Merging out of order will produce conflicts in `page.tsx`.

## Stack shape

```
120c6f9a  main (merge commit of #781)
 |
 +-- d6d4fa0f  feat/section-b-wave0-20260815      (B14, B11)          -> PR to main, real CI
 |
 +-- 7885c564  feat(ui): batch 2
     6612fe6b  fix: batch-2 review fixes           = feat/mo-batch2-20260816   -> PR to main, real CI
      |
      +-- 24f90c9d  feat(a11y): Wave A             = feat/section-b-wavea-20260816  -> stacked, NO CI
           |
           +-- bfbab1c9  fix(ui): deferred triage  = feat/deferred-triage-20260816  -> stacked, NO CI
```

## Upstream PRs (owner-owned, already merged)

| PR | Branch | State |
|---|---|---|
| #780 | `docs/guide-roadmap-20260815` | MERGED (squash, `a7ec047e`) |
| #781 | `feat/mo-design-batch-20260815` | MERGED (merge commit, `120c6f9a`) |

The merge-commit choice for #781 is what let all four branches rebase across a 55-file merge
without a single content conflict.

## Branch contents

### `feat/section-b-wave0-20260815` -- Section B Wave 0

| Commit | Item |
|---|---|
| `cd8422b0` | B14 -- ThemeToggle 40px -> 44px touch floor |
| `6c25f740` | B11 -- synchronous theme bootstrap in `<head>`, kills the light-theme flash |
| `d6d4fa0f` | Review fixes: ThemeContext validates the stored value; e2e glob tightened; lint back to baseline |

Zero file overlap with PR #781's 55-file diff -- verified file-by-file.

### `feat/mo-batch2-20260816` -- batch 2

| Commit | Items |
|---|---|
| `7885c564` | #16 duplicate H1 (both surfaces), #18 header auth links, P1 body-reachable candidate defaults, P2 narrow-screen hint, #20 both padding layers |
| `6612fe6b` | Review fixes: receipt carries its context, 44px touch targets restored, hook scoped to the Calculator tab, line endings repaired |

### `feat/section-b-wavea-20260816` -- Section B Wave A

| Commit | Items |
|---|---|
| `24f90c9d` | B1, B2, B3, B6, B7a (both surfaces), B9. B8 verified as needing no change. Includes the review fixes for the build-frozen year and two vacuous tests. |

### `feat/deferred-triage-20260816` -- deferred-findings triage

| Commit | Items |
|---|---|
| `bfbab1c9` | Systemic print-safety in ScrollFadeRegion, 1px caption honesty, WebKit disclosure-marker sweep across 8 sites (the triage doc said 6) |

## Gate evidence policy for the stacked PRs

Wave A and deferred triage get no CI, so their PR bodies must carry local gate numbers and say
so explicitly. Where a stacked PR's evidence comes from the STACK TIP rather than that branch's
own tree, the PR body says that in those words rather than implying a dedicated run.
