# PR / commit mapping and merge evidence -- impeccable frontend lane, 2026-08-17

All values below were read from the GitHub REST API after the merges completed, and from
`git ls-remote origin`. They are measured, not inferred.

## main

    before   120c6f9a04de7e689c54579919f60144466e7f79
    after    0ef90f48b663dbab3af7e1527995ff1747896b33

## Merge evidence, exact

| PR | state | merged | head at merge | base at merge | merge commit | merged_at (UTC) |
|----|-------|--------|---------------|---------------|--------------|-----------------|
| 787 | closed | true | 887d9265d2949cd49dfde5428ad24ce97526e6b2 | feat/section-b-wave0-20260815 | 2cc388d932f2acee0d6d4f83d153931228f1bc76 | 2026-08-17T18:21:48Z |
| 788 | closed | true | ae678fdf16dc7b5f3477e19ee25be8b9ef8e8306 | feat/deferred-triage-20260816 | 27af9525ab6bc8f54a50efe0d79f8a342e6c8ba9 | 2026-08-17T18:33:45Z |
| 785 | closed | true | 27af9525ab6bc8f54a50efe0d79f8a342e6c8ba9 | feat/section-b-wavea-20260816 | 2d9ea7725fa8424f13b8fbfddf11b64ed65a25d2 | 2026-08-17T18:33:49Z |
| 784 | closed | true | 2d9ea7725fa8424f13b8fbfddf11b64ed65a25d2 | feat/mo-batch2-20260816 | a567edda7de3deb8bc082daf8ff04778883b26ca | 2026-08-17T18:34:09Z |
| 782 | closed | true | 2cc388d932f2acee0d6d4f83d153931228f1bc76 | main | 22ef453272c5bf47a925c83ccca7a9ef17de885c | 2026-08-17T18:51:18Z |
| 783 | closed | true | a567edda7de3deb8bc082daf8ff04778883b26ca | main | 0ef90f48b663dbab3af7e1527995ff1747896b33 | 2026-08-17T19:06:10Z |
| 786 | open | false | 7e465cca59fa031795467c4d05d0772f449cfa9b | main | (none) | -- |

PR #786 is docs-only and was deliberately left OPEN and outside this lane by owner decision. Its
head `7e465cca` is recorded here so a later session can confirm it was never touched.

Note the chain visible in the table: each child's merge commit becomes the next parent's head. That
is the bottom-up parent-branch aggregation described below, and it is why only #782 and #783 ever
merged into `main`.

## The ten intended commits, all verified present on main 0ef90f48

    f0f56330   #783 batch2 tip
    c41f1463   #784 waveA tip
    87b8d2c8   #785 triage tip
    04c9cc10   #788 original tip (pre-correction)
    16281814   #788 correction round 1
    ae678fdf   #788 correction round 2 (final tip)
    6caaa34e   #782 wave0 tip
    2c38c6a6   #787 seedTheme commit
    45293f1a   #787 pre-correction tip
    887d9265   #787 correction (final tip)

Verified with `git merge-base --is-ancestor <sha> origin/main` for each; all returned true. No
unintended reversion was found.

## Why the merge order was what it was

`.github/workflows/ci.yml` declares `on: pull_request: branches: [main, develop]` with NO `types:`
key, so it uses the GitHub defaults opened / synchronize / reopened. Consequences, all confirmed
empirically during this run:

  - #782 and #783 (base `main`) had the four required contexts.
  - #784, #785, #787, #788 (base = another feature branch) had NEVER run `ci.yml`. Measured: the
    pushed tips `887d9265` and `ae678fdf` each carried exactly 2 checks (docs gate + archive gate),
    with no Lint / Unit / Build / E2E.
  - Retargeting a stacked PR to `main` emits `edited`, which is NOT a default type, so the required
    contexts would never have fired and each retargeted PR would have blocked permanently. There is
    no `workflow_dispatch` on `ci.yml`.

Therefore each stack was merged bottom-up INTO ITS PARENT BRANCH, so only the two base-main PRs
merged into `main`. Merging a child into its parent fires `synchronize` on the parent PR, whose base
IS `main`, so the four required contexts run on exactly the combined content that is about to land.
This was confirmed live: after #787 merged into `feat/section-b-wave0-20260815`, PR #782's checks
went from 2 to 6 and then to the full 11, including all four required contexts.

Merge method was a MERGE COMMIT throughout. Squashing was never used: squashing #782 or #783 would
have rewritten commits that the child branches still contained.

`gpt-5.6-sol` at xhigh was asked this question directly and judged the approach "a legitimate
exact-tip CI strategy rather than a gate bypass".

## Branch protection on main, as read live on 2026-08-17

    strict (require branches up to date)   false
    required contexts                      Lint & TypeScript Check, Unit Tests,
                                           Production Build, E2E Tests
    required approving reviews             none
    enforce_admins                         false
    required_linear_history                false
    allow_force_pushes                     false
    rulesets                               none (classic branch protection only)
    feature branches                       UNPROTECTED (404 on the protection endpoint)

`strict = false` is what removed the up-to-date/staleness hazard for the second root PR.

## Publication evidence

    #788   ordinary fast-forward push      90f4bf7e..ae678fdf
    #787   force-with-lease                + 3a5eb26f...887d9265 (forced update)
           lease used: feat/theme-cookie-20260816:3a5eb26fefaee9e7644dbca0a980987519b0069e

`main` was never force-pushed. Both rollback tags survived the operation and were re-verified after
it: `p787-prerebase-3a5eb26f` -> `3a5eb26f`, `p0-precommit-87b8d2c8` -> `87b8d2c8`.

## Operating condition during the merges

GitHub was in a declared partial outage (Git Operations degraded, Issues degraded, Copilot major
outage; Actions operational). Several merge calls returned HTTP 503 and were retried with an
idempotency guard that re-read `merged` before each attempt, so no double-merge was possible. The
#787 merge succeeded on attempt 5; #788 on attempt 5; #785 on attempt 1; #784 on attempt 2 (after
one "Base branch was modified" which is the expected consequence of the preceding merge); #782 and
#783 on attempt 1.
