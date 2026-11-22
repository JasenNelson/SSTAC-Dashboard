# Fresh session handoff 2026-11-20: Matrix Guided R2 review completion

Lifecycle: CURRENT (dated session anchor). Lane status: `docs/MATRIX_OPTIONS_STATUS.md` section 3.6.
Plan of record (owner-approved rev 3):
`C:\Users\jasen\.claude\plans\read-and-follow-c-users-jasen-rosy-avalanche-of-efe4eb6a-2662-4d43-9545-8abebeeee067.md`.
Previous versions (archived, read-only): `docs/archive/root-scratch-2026/FRESH_SESSION_HANDOFF_2026_11_20_MATRIX_R2_GUIDED_pre_astra_correction_r1.md`,
`..._pre_correction_r2.md` and `..._pre_scope_reduction_r1.md`.

## Scope (owner-approved scope reduction, 2026-11-20)
APPROVE MATRIX R2 SCOPE REDUCTION | KEEP PRODUCT PARITY + ADMIN + DISPOSABLE LOCAL PREVIEW | DEFER
PRODUCTION GO-LIVE PACKET AND ACTIVATION HARNESS.
- This candidate restores Guided R2 product parity (the accepted three-panel reviewer experience,
  Save / Save all / Save all and finish, Finish and revision, conflict resolution, unsaved-draft
  recovery, administrator Guided R2 view and scoped CSV, legacy v0.9.91 read-only history) and adds a
  disposable local full-stack preview.
- No go-live packet, activation tooling or production canary is present in this candidate.
  Production activation and go-live automation are deferred to a separate later unit, after owner
  preview acceptance and merge.

## Where things stand (verified facts only)
- Candidate branch `feat/matrix-r2-guided-completion-20261120` (worktree
  `C:\Projects\SSTAC-Dashboard-worktrees\matrix-r2-guided-completion-20261120`), UNCOMMITTED at the base
  SHA `45f3c0802e1a3d4ee3ce6b3765fc1a55437a7f71`. No commit, PR, gate run or acceptance receipt exists.
- Production, as last verified read-only on 2026-11-20 (catalog fingerprint capture): activation
  `false`, guided rows 0/0/0, legacy 2/12. The database activation row remains `false`, and no
  provider operation is authorized by this candidate.
- Only focused unit/component/static tests, mutation tests, `tsc --noEmit`, PowerShell 5.1/7 parse
  checks and `node --check` have run. The disposable preview has never run end to end.

## Pending steps, in order (none has happened yet)
1. Codex Mission Control review of the uncommitted candidate, iterated to GREEN.
2. Exact-path commits, the six gates on the final tip, one integrated PR.
3. Owner launcher: `C:\Users\jasen\.codex\p\matrix-r2-preview.ps1` is outside the candidate, unmodified
   and NOT READY. After a reviewed commit it must be regenerated from the run-token contract in the
   header of `scripts/matrix-options/r2-fullstack-preview.ps1` (never an automatic `down`; capture the
   `R2_PREVIEW_RUN_ID=<id>` line `up` prints and pass that id as `-RunId` to seed, build, start, accept,
   status and down; show only the disposable sign-ins `start` prints), independently reviewed and
   hash-pinned before owner use.
4. Owner preview through the regenerated launcher. Docker Desktop must publish on 127.0.0.1
   (Settings > Docker Engine `"ip": "127.0.0.1"`, restart Docker; affects all containers); `up`
   refuses otherwise. The preview seeds three fresh disposable local accounts per run.
5. `r2-fullstack-preview.ps1 -Command accept -RunId <id>` for the tree-bound acceptance receipt.
6. Holistic codex release review of the final PR tree (GREEN), owner approval of the exact head SHA
   and scope, merge by an authorized executor once required CI is GREEN, deployment.
7. Separately, later: the production activation / go-live unit (not part of this candidate).

## Disclosed incident (this lane, 2026-11-20)
Before the Docker binding was detected, an earlier local preview stack ran with ports published on all
interfaces (about 15:46-16:57 and 17:00-17:14 local time on 2026-11-20). The private R2 paper
objects were reachable for that time, and the E2E_TEST, CANARY_READER_B and E2E_ADMIN emails and
password hashes from about 16:15 to 16:57. That local data is deleted; the preview now refuses to
start unless Docker publishes on 127.0.0.1 and uses only fresh disposable accounts. Rotating those
three test passwords is the owner's call.

## Next-session hygiene
- Remove the scratch inner-loop worktree `C:\Projects\SSTAC-Dashboard-worktrees\matrix-r2-fullstack-preview`
  junction-safely (`cmd /c rmdir` its node_modules junction first, verify, then
  `git worktree remove --force`), if not already done. Per-run preview worktrees
  (`matrix-r2-preview-<run suffix>`) need the same junction-safe removal after their run is down.
