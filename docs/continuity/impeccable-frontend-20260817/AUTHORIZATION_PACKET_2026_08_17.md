# Authorization packet -- impeccable frontend lane, 2026-08-17

STATUS: awaiting owner authorization. Nothing pushed. Nothing merged. This is the single batched
owner gate for the whole lane.

## 1. Exact tips

    origin/main                    120c6f9a04de7e689c54579919f60144466e7f79  (re-verified live)

    STACK A  (independent)
      #783 feat/mo-batch2-20260816        f0f5633066b9390db922cc3e6c6c98274ef381a9  pushed, base main
      #784 feat/section-b-wavea-20260816  c41f1463c8bb91ef2a3687e5d82040cef1b14f8d  pushed, base #783
      #785 feat/deferred-triage-20260816  87b8d2c82d0ade1f3208d01115a32f3eaccb20b8  pushed, base #784
      #788 feat/audit-p0-20260816         ae678fdf16dc7b5f3477e19ee25be8b9ef8e8306  LOCAL, base #785
                                          (remote is 90f4bf7e; was 04c9cc10 at checkpoint)

    STACK B  (independent)
      #782 feat/section-b-wave0-20260815  6caaa34e508cafc174f77b1f666e5bf6289e7e24  pushed, base main
      #787 feat/theme-cookie-20260816     887d9265d2949cd49dfde5428ad24ce97526e6b2  LOCAL, base #782
                                          (remote is 3a5eb26f; was 45293f1a at checkpoint)

Both stacks fast-forward from current origin/main. Zero shared changed files (35 vs 11). Their union
merges clean (merge-tree 597a380f, exit 0). No protected path touched. Zero non-ASCII added.

## 2. Gate evidence -- six gates on the FINAL tips

    ae678fdf   lint 0 | tsc clean | unit 6871 passed / 19 skipped (360 files)
               build exit 0, BUILD_CORROBORATION=OK | e2e 167 passed / 0 failed, 32 chromium-auth refs
               docs PASS | ALL_SIX_GATES_RAN=YES | TREE_UNCHANGED=YES

    887d9265   lint 0 | tsc clean | unit 6847 passed / 19 skipped (360 files)
               build exit 0, BUILD_CORROBORATION=OK | e2e 208 passed / 0 failed, 25 chromium-auth refs
               docs PASS | ALL_SIX_GATES_RAN=YES | TREE_UNCHANGED=YES

Two e2e flakes were hit and each was retried once per the SOP, both then green at the identical
counts as before the corrections: 2 Firefox `browserContext.close` teardown crashes in
admin-agentic-os (causally isolated -- TWGReviewPortal is not in that route's module graph), and one
15s `data-primary-tablist-ready` timeout in matrix-options (the flake class this lane already
documented). No gate was reported green while incomplete; the runner halted correctly both times.

## 3. What changed since the checkpoint, and why

Three P1 defects were found and fixed. All were in PR#788 and all were of the same class this lane
keeps producing: a green suite coexisting with a defect that HIDES a correct regulatory disclosure.

  P1-1  Save Draft permanently erased the unknown-provenance disclosure. A legacy draft (exactly
        5000 chars, no truncation key -- real, because deployed main has maxLength={5000}) correctly
        warned "an unknown amount of text may be missing"; one Save wrote an empty {} truncation
        record; the next mount discarded the at-limit keys and, per the component's own comment,
        {} then positively asserts nothing was lost. Clipped review text could then be submitted
        with no disclosure. FIX: persist the unknown-provenance set under its own storage key.
  P1-2  The cancelled-submit note grew the absolutely-positioned bottom bar past the scroll
        container's fixed pb-32 clearance, occluding the Dismiss controls the note itself tells the
        reviewer to use -- and nothing else clears the record. FIX: bound the note (max-h-40 +
        overflow-y-auto + tabIndex=0) and raise the with-note reservation to pb-72; arithmetic is
        documented in-code (bar worst case 244px vs 288px reserved).
  P1-3  The same disclosure was also erased by a FAILED save. FIX: write order is now antidote
        (unknown-provenance) -> poison (truncation) -> draft, any failure aborting the save.

  Plus two test-only pins: the recommendUcl unresolvedCensoring argument is now pinned at the
  stats.ts call site (previously deletable with every test still green), and three regression tests
  that PR#787's rebase had deleted were restored (this project's CLAUDE.md forbids deleting a
  regression test while its code remains). PR#787 also now genuinely matches its own claim that
  src/lib/theme.ts is the single source of truth, and its bootstrap class removal is length-agnostic
  again. Every new or restored test was falsified two-sided: the bug reintroduced, the failure
  message recorded, the fix restored.

## 4. Review record

    Tier 0  cursor-agent --model auto      GREEN   3 P2 + 1 P3; missed all three P1s
    Leg 1a  Opus subagent (round 1)        RED     2 P1, both independently confirmed against source
    Leg 1b  context-inheriting fork        RED     3rd P1; also overturned two of Mission Control's
                                                   own claims (see section 7)
    Leg 1a  Opus subagent (round 2, fresh) GREEN   all 3 P1 closed, no vacuous tests, 2 residual P2
    Leg 2   codex gpt-5.6-luna high        findings: 2 P1 + 1 P2 (adjudicated below)
    Leg 2   codex gpt-5.6-sol xhigh        NOT RUN -- see section 6 decision D4

Codex adjudication (mutual-agreement; codex is an adversarial reviewer, not an oracle):
  - REFUTED, codex P1 "pre-mount theme context not seeded". Codex read THIS worktree, which is
    PR#785 and contains zero occurrences of seedTheme. At the actual candidate 887d9265:
    ThemeContext.tsx:95 `useState<Theme>(() => seedTheme(initialTheme))` and :172 passes `theme`
    (the seed) in the unmounted branch. That is exactly codex's own stated falsifier.
  - DOWNGRADED to P2, codex P1 "unpaired truncation marker". Its premise is a deployed population
    carrying a stale {} truncation record; main contains ZERO occurrences of "truncation", so no
    such population exists. The residual is narrower: the disclosure is lost only if the
    unknown-provenance record is separately lost or corrupted while the truncation record survives.
  - ACCEPTED, codex P2 "dismissal before saving is not durable". On a legacy draft with no
    truncation key, dismissing writes {} to the new key but leaves the truncation key absent, so the
    next mount re-derives the at-limit keys and the dismissed notice returns. It OVER-warns (the
    safe direction) and does not block landing. The existing test only dismisses after a save.

## 5. THE CI FINDING THAT CHANGES THE MERGE PLAN

.github/workflows/ci.yml declares `on: pull_request: branches: [main, develop]` with NO `types:`
key, so it uses the defaults opened / synchronize / reopened. Therefore:

  - #782 and #783 (base main) HAVE all four required contexts green.
  - #784, #785, #787, #788 (base = another feature branch) have NEVER run ci.yml. They carry only
    GitGuardian plus two docs gates.
  - Retargeting a stacked PR to main emits `edited`, which is NOT a default type. The required
    contexts would never fire and the PR would sit permanently blocked. There is no
    workflow_dispatch on ci.yml.

Live branch protection on main: strict=false (no up-to-date requirement), required contexts exactly
Lint & TypeScript Check / Unit Tests / Production Build / E2E Tests, no required approving reviews,
enforce_admins=false, required_linear_history=false, allow_force_pushes=false. Feature branches are
UNPROTECTED; there are no rulesets.

RECOMMENDED PLAN -- merge bottom-up INTO THE PARENT BRANCH, so only the two base-main PRs merge into
main. Codex reviewed this specific question and called it "a legitimate exact-tip CI strategy rather
than a gate bypass".

  STACK B first (this is the coupled pair; landing it first minimises exposure):
    1. merge #787 into feat/section-b-wave0-20260815
    2. that push fires `synchronize` on #782, whose base IS main, so the four required contexts run
       on the exact combined content
    3. merge #782 into main  ->  #782 and #787 land ATOMICALLY; main is never left carrying #782
       without #787, which matters because #782 alone introduces a WCAG 4.1.2 wrong-accessible-name
       defect that main does not currently have
  STACK A second:
    4. merge #788 into feat/deferred-triage-20260816
    5. merge #785 into feat/section-b-wavea-20260816
    6. merge #784 into feat/mo-batch2-20260816
    7. that fires `synchronize` on #783 (base main); required contexts run on the full stack
    8. merge #783 into main

  Merge method: MERGE COMMIT throughout. Never squash a stacked PR -- squashing #782 or #783 would
  rewrite commits that the child branches still contain.

ALTERNATIVE -- retarget each child to main, then close and reopen it so `reopened` fires ci.yml.
Preserves one-merge-per-PR into main, but costs four extra CI cycles, four close/reopen actions, and
leaves a real window where main carries #782 without #787.

## 6. DECISIONS REQUESTED

  D1  Authorize publication of the two corrected branches:
        ordinary push          #788  ae678fdf   (fast-forward over remote 90f4bf7e)
        force-with-lease       #787  887d9265   (lease 3a5eb26f)
  D2  Authorize the merge plan: RECOMMENDED (parent-branch bottom-up) or ALTERNATIVE (retarget +
      close/reopen).
  D3  The two accepted non-blocking findings -- codex's dismissal-durability P2 and the
      unpaired-provenance P2: fix now (one more small correction + re-gate of Stack A) or land as-is
      and carry them as follow-ups?
  D4  The codex sol xhigh FINAL ship-gate round has not been run; only luna. Options: (a) run it now
      before any push, (b) run it in parallel while CI runs after the push, (c) proceed on the luna
      round plus the two Opus legs and log the deferred sol round to the re-review queue.
  D5  PR #786 (docs/ui-ux-autonomous-run-20260816) is open, base main, mergeable clean, 28 files,
      docs-only with zero code-bearing files (24 under docs/ plus RUN_STATE.md, PR_MANIFEST.md,
      COMMAND_LOG.md, RESUME_PROMPT.md at root). It sits inside the literal "#782 through #788"
      range but was NOT in the checkpoint's enumerated six and has NOT been gated by this lane.
      Land it, leave it, or out of scope?

## 7. Corrections to Mission Control's own earlier claims (recorded, not buried)

  - I claimed the gate runner's TREE_UNCHANGED check was vacuous because the digest was the SHA-256
    of the empty string. WRONG. gates.sh tree_digest() hashes porcelain + diff + cached + untracked
    bytes; on a genuinely clean tree all four are empty, so that IS the correct digest and it would
    change if anything were dirty. The guard is sound.
  - I claimed that retargeting a stacked PR to main would run the required contexts and thereby
    progressively gate the union. WRONG, and it would have deadlocked every stacked PR. See
    section 5.
  - I asserted the long-lived codex/node/python processes belong to live parent sessions without
    performing the Win32_Process.ParentProcessId join the standing rule requires. The conclusion
    (not a blocker) still holds, but it was asserted more strongly than the evidence supported.

## 8. Rollback

  tag p787-prerebase-3a5eb26f  -> 3a5eb26f  (verified; the pre-rebase #787 tip, still reachable)
  tag p0-precommit-87b8d2c8    -> 87b8d2c8  (verified)
  #787 rollback: git push --force-with-lease=feat/theme-cookie-20260816:887d9265 origin
                 p787-prerebase-3a5eb26f:feat/theme-cookie-20260816
  #788 rollback: the remote still holds 90f4bf7e until the push; after it, reset to 90f4bf7e by the
                 same lease form.
  main is never force-pushed. Every pre-correction commit (04c9cc10, 45293f1a) is an ancestor of its
  corrected tip, so nothing is lost by landing.
  Trial branches trial/stackA2, trial/stackA3, trial/stackB2 and the trial worktree
  C:/Projects/SSTAC-Dashboard-worktrees/trial-refreeze-20260817 are retained as evidence. Its
  node_modules is a JUNCTION to the shared store -- do not recursive-delete it.

## 9. External conditions

  GitHub is in a declared partial outage: Git Operations degraded_performance, Issues degraded,
  Copilot major outage. Actions is operational, so pushes and CI should work but may be slow. The
  GraphQL API was returning 503 for part of this session; REST worked throughout. Remote leases and
  origin/main will be re-verified immediately before any push.

## 10. What runs after authorization

  push -> verify remote PR head identities match the authorized SHAs -> wait for and adjudicate the
  four required contexts on each base-main PR -> merge in the authorized order -> after each merge
  confirm the next PR's reviewed assumptions still hold -> verify final main contains the intended
  commits with no unintended reversions -> six gates on the landed main -> rendered-browser
  verification of theme initialisation and accessible name, no theme flash, print behaviour, and the
  TWG truncation/provenance surfaces -> closeout distinguishing local, CI, merged-main and deployed
  evidence.
