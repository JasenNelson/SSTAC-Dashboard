# Leg 1b -- context-inheriting SITUATION review, impeccable-frontend lane, 2026-08-17

Scope: attack Mission Control's own premises, verification claims and operational plan.
Read-only on the repository. Everything below was checked with git/shell/file reads this leg,
not inferred from the transcript. Where I did not re-check something, I say so.

---

## CONFIRMED

- P1-1 has no escape path. `src/components/TWGReviewPortal.tsx` at 04c9cc10 is 773 lines and
  contains exactly ONE `useEffect` that touches storage (line 85, deps `[]`, mount-only). There is
  no `storage` event listener, no `beforeunload`, no second restore path. `unknownProvenanceKeys`
  is never persisted: the only `setItem` calls in the file are line 320 (truncation) and line 331
  (draft). `atLimitKeys` occurs only at 106, 115, 132, 134, and 132/134 sit inside the
  `if (rawT === null)` block, so it is genuinely dead in the `rawT !== null` path.
- The legacy population is reachable, not hypothetical. `DRAFT_STORAGE_KEY` is the fixed literal
  `'twg-matrix-review-draft-v6'` (line 30) with no dynamic version component, so drafts written by
  the currently deployed build share the exact key #788 reads.
- `handleDismissUnknownProvenance` (line 288) mutates state only; it does not persist, so it
  cannot be the missing writer.
- P1-2 is reachable. `handleSubmit` sets `submitCancelledNote` in the `if (!proceed)` branch
  (line 411 onward) whenever the confirm is declined and either `droppedTotal > 0` or
  `unknownFields > 0`.
- P1-2's structure is as described. The panel is `w-96 ... flex flex-col relative` (line 585); the
  scroll container is `p-6 overflow-y-auto flex-1 space-y-6 pb-32` (line 598); the bar is
  `absolute bottom-0 left-0 right-0 p-4` (line 739) and carries no `max-h` or overflow. `pb-32` is
  the only clearance reservation.
- `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` IS the SHA-256 of the empty
  string (`printf '' | sha256sum`).
- The ci.yml trigger claim is correct. `on: push: branches:[main,develop]` and
  `on: pull_request: branches:[main,develop]`, nothing else. No `merge_group`, no
  `pull_request_target`, and no `workflow_dispatch` in ci.yml. The four required contexts are job
  names defined ONLY in ci.yml (`Lint & TypeScript Check`, `Unit Tests`, `Production Build`,
  `E2E Tests`, plus `CI Status Check`); no other workflow can satisfy them by name.
  docs-gate.yml and docs-archive-investigation.yml carry no branch filter, which is exactly why
  the stacked PRs show 2-3 checks.
- Union merge tree recomputed independently: `597a380fdef59358ff39a3d37e49aa4899b0f080`. Matches.
- Cross-stack file overlap recomputed with `comm -12`: 0.
- Non-ASCII in added lines, byte-level over all three ranges: 0, 0, 0.
- No `.gitmodules`, so the submodule gap in the digest question does not apply.

NOT re-checked this leg (inherited, still unverified by me): the two rollback tag resolutions,
the force-with-lease necessity, and the protected-path sweep.

---

## OVERTURNED_OR_WEAKENED

### 1. OVERTURNED -- "FROZEN_TREE_DIGEST is the empty hash, therefore TREE_UNCHANGED=YES is vacuous"

This is wrong and must not reach the owner packet.

I found the runner at
`<prior-session-scratchpad>/gates.sh` and read `tree_digest()` (lines 35-46). It hashes
`git status --porcelain` + `git diff` + `git diff --cached` + the bytes of every untracked
non-ignored file. On a genuinely clean worktree all four inputs are empty, so the empty-string
digest is the CORRECT and EXPECTED output, not a sign the computation produced nothing. I
reproduced the identical value by running the same pipeline against this clean worktree.

So `TREE_UNCHANGED=YES` does carry real content: HEAD unchanged, no dirty tracked file, no staged
change, and no untracked non-ignored file added or edited during the run. The guard is sound and
the runner comment at line 9 ("compares a CONTENT DIGEST, not a dirty-file COUNT") is accurate.

Residual, P3 and worth one line in the packet rather than a finding: `--exclude-standard` excludes
gitignored paths, so a change to a gitignored input that tests read (`.env.local` is the realistic
one) is invisible to the guard; and the receipt prints no positive control, so a reader cannot
distinguish "tree was clean" from "the digest function had its inputs suppressed" from the receipt
alone. Recommend the runner also emit the number of inputs hashed. This is receipt legibility, not
a broken guard.

### 2. OVERTURNED -- "retargeting each PR to main will cause the required contexts to run, and CI will therefore progressively gate the union"

This is the material one, and it breaks the merge plan as written.

`ci.yml` declares `on: pull_request:` with NO `types:` key. The default activity types are
`opened`, `synchronize`, `reopened`. Changing a pull request's base branch emits `pull_request`
with action `edited`, which is NOT in that default set. Therefore retargeting #784, #785, #788 or
#787 onto `main` does NOT trigger ci.yml. The four required contexts never report, branch
protection sees them as expected-but-missing, and the merge is blocked indefinitely. There is no
`workflow_dispatch` on ci.yml, so it cannot be kicked manually either.

The workaround that does NOT disturb the frozen tips is to CLOSE and REOPEN each retargeted PR:
`reopened` IS a default activity type, and the base at that moment is `main`, so ci.yml runs
against the unchanged frozen head. Pushing a commit would also work but changes the tip and
invalidates the frozen evidence, so it is the wrong tool here.

Consequence for sequencing, which is the dangerous part: if #782 is merged first and #787 then
cannot obtain its required checks, `main` is left containing #782 WITHOUT #787. That is precisely
the half-landed Stack B state that ships the WCAG 4.1.2 wrong-accessible-name defect to
production, and it is reached by following the plan as written, not by any accident. Likelihood is
high, not low, because the blocking mechanism is the default behaviour rather than an edge case.

### 3. WEAKENED -- "the long-lived codex/node/python processes belong to live parent sessions"

Stated as established fact. It was not established: no `Win32_Process.ParentProcessId` join to
live PIDs was run, which is exactly what this project's own standing rule requires before
characterising process lineage either way. The operative conclusion (not a blocker, do not touch)
is still right, but it is right because none of them references the gated worktrees, not because
their parents were shown to be alive.

---

## NEW_FINDINGS

### P1-1b -- the disclosure is also erased by a FAILED save, and the code's own inertness claim does not hold

SEVERITY: P1 (a distinct trigger for the same data-integrity defect, not a duplicate)
FILE: `src/components/TWGReviewPortal.tsx:319-333` against `:89` and the comment at `:316-318`

`handleSave` writes the truncation record FIRST (line 320) and the draft SECOND (line 331), each
in its own try. The comment at 316-318 justifies that order by asserting the reverse orphan --
provenance stored with no draft -- "is inert, because the restore effect reads the draft first and
returns early when there is none."

For the legacy population that claim is false. The restore effect's early return is `if (!raw)
return;` (line 89), which fires only when NO draft exists. A legacy v6 draft DOES exist. So if the
truncation write succeeds and the draft write then fails on quota or access, storage is left
holding `{}` truncation plus the ORIGINAL legacy draft, the user is told the draft was not saved,
and the next mount takes the `rawT !== null` path and discards `atLimitKeys`. The disclosure is
gone even though nothing was successfully saved and the user was told so.

FALSIFIER: a rollback of the truncation write when the draft write fails, or a restore-path branch
that treats provenance-without-a-matching-save as absent. Neither exists at 04c9cc10.

### P2 -- the P1-1 remedy is constrained, and one obvious fix contradicts the component's documented invariant

SEVERITY: P2 (a constraint on the correction, not a defect)
FILE: `src/components/TWGReviewPortal.tsx:122-129`

Re-deriving at-limit keys inside the `rawT !== null` branch is the tempting one-line fix and it is
the wrong one: lines 122-129 state that a present-but-empty record written by the current build
"is a positive statement that nothing was lost, and must keep meaning exactly that". Flagging
at-limit keys that have no entry in a PRESENT record would break that invariant and turn every
intentional exactly-5000-character comment into a permanent unknown-provenance warning.

The remedy must therefore PERSIST the unknown-provenance set (its own storage key, or a
discriminated form inside the existing record), so a save carries the disclosure forward instead
of overwriting it. That is a bounded, mechanical change with a clear correctness criterion, so it
is not an owner policy decision -- but it is a third storage key, and whoever implements it must
also decide what a dismissal persists, since dismissal is currently state-only and already does
not survive a reload.

### P2 -- the merge sequence cannot be certified while required_status_checks.strict is unknown

SEVERITY: P2, precondition
If `strict` (require branches to be up to date) is ON, then after the first merge every remaining
PR is behind `main` and must take a main-merge or rebase into its branch. That changes the tip,
invalidates the frozen per-branch identity the whole packet is built on, and re-triggers CI
anyway. The plan's shape depends on this single boolean, and the branch-protection endpoint is
503 under the current GitHub outage. It must be read before the owner authorizes anything.

### P3 -- auto-retarget itself should be verified, not assumed

`delete_branch_on_merge=false` means the base branches survive the merges. GitHub's documented
auto-retarget fires when a PR whose head is another PR's base is merged, which should still apply,
but the plan should verify the retarget actually happened after each merge rather than assume it,
because a silent non-retarget leaves the child pointing at a merged branch and its diff reads as
empty.

Note on empty/duplicate merges, checked and NOT a problem: each child already contains its
parent's commits, so after the parent lands, a merge commit of the retargeted child carries only
the child's own delta. No duplication, no empty merge.

---

## VERDICT_ON_PLAN

PLAN_MUST_CHANGE:
1. Do not rely on retargeting to trigger the required checks. After each auto-retarget, CLOSE and
   REOPEN the PR to fire `reopened` and run ci.yml against the unchanged frozen head.
2. Prove #787 can reach green required checks BEFORE #782 is merged (retarget #787 to main while
   #782 is still open, close/reopen, confirm green). Merging #782 first without that proof risks
   leaving main with the WCAG defect and #787 blocked.
3. Read `required_status_checks.strict` before authorization; the sequence is not certifiable
   without it.
4. Constrain the P1-1 remedy to PERSISTING the unknown-provenance set. Do not re-derive at-limit
   keys in the `rawT !== null` branch.
5. Add P1-1b (failed-save erasure) to the correction scope; it is the same defect through a second
   door and a fix that only covers the successful-save path leaves it open.
6. Drop the "TREE_UNCHANGED is vacuous" finding entirely. It is false.

VERDICT: RED
