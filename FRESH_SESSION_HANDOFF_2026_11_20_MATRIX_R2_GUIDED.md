# Fresh session handoff 2026-11-20: Matrix Guided R2 review completion

Lifecycle: CURRENT (dated session anchor). Revised 2026-11-22 (activation record unit).
Lane status: `docs/MATRIX_OPTIONS_STATUS.md` section 3.6.
Architecture authority (read before ANY Guided R2 change):
`docs/design/matrix-options/GUIDED_R2_REVIEW_ARCHITECTURE.md`.
Plan of record (owner-approved rev 3):
`C:\Users\jasen\.claude\plans\read-and-follow-c-users-jasen-rosy-avalanche-of-efe4eb6a-2662-4d43-9545-8abebeeee067.md`.
Previous versions (archived, read-only): `docs/archive/root-scratch-2026/FRESH_SESSION_HANDOFF_2026_11_20_MATRIX_R2_GUIDED_pre_astra_correction_r1.md`,
`..._pre_correction_r2.md`, `..._pre_scope_reduction_r1.md`, `..._pre_architecture_docs_r1.md` and
`..._pre_activation_record_r1.md`.

## Scope (owner-approved scope reduction, 2026-11-20)
APPROVE MATRIX R2 SCOPE REDUCTION | KEEP PRODUCT PARITY + ADMIN + DISPOSABLE LOCAL PREVIEW | DEFER
PRODUCTION GO-LIVE PACKET AND ACTIVATION HARNESS.
- The merged release restores Guided R2 product parity (the accepted three-panel reviewer
  experience, Save / Save all / Save all and finish, Finish and revision, conflict resolution,
  unsaved-draft recovery, administrator Guided R2 view and scoped CSV, legacy v0.9.91 read-only
  history).
- No go-live packet, activation tooling or production canary is committed to the repository. The
  2026-11-22 activation was run from a separately reviewed, owner-approved operator packet kept in
  ignored local scratch (not committed).

## Maintenance rule
Content revisions change content and configuration INSIDE the established Guided R2 system. They
never authorize rebuilding the page, replacing storage, bypassing Supabase, disconnecting the admin
view or CSV, or accepting visual similarity as functional parity. Follow the architecture
authority's pre-change investigation and parity checks.

## Where things stand (verified facts only, 2026-11-22)
- MERGED: PR #833 (head `1634662c17f540ead663cf021bfb025b46fa5633`) merged to `main` at
  2026-11-22T14:38:25Z as merge commit `a125006786463964c3872296e5caf709ca78195c`. It carries the
  product commits `93780ab9`, `95733518`, `0ec2afe2` and the architecture-documentation commit
  `1634662c`, on base `45f3c080`.
- DEPLOYED, production ready: the Vercel production deployment status for `a1250067` was success
  at 2026-11-22T14:41:40Z; a read-only, unauthenticated post-deploy smoke passed (10 of 10 probes).
- ACTIVE: Guided R2 writes are ENABLED in production since 2026-11-22T17:10:53Z (the
  `public.matrix_guided_r2_activation` row for `phase2-review-2026-11-fa356b89` is `true`). This was
  an exact, codex-reviewed, owner-approved Supabase write; the approved disposition was
  `KEEP ENABLED ONLY IF SMOKE GREEN, ELSE 03 | MAX WINDOW 60 MIN TO GREEN` (03 = the data-preserving
  disable below). The smoke was GREEN inside the window, so the release stays enabled.
- Authenticated production smoke GREEN (22 of 22 checks, finished 2026-11-22T17:12:15Z), using the
  E2E test reviewer and E2E administrator accounts: the reviewer page opened writable; a disposable
  marker comment was saved, survived a reload, and Finish recorded a completion; the administrator
  default view stayed legacy v0.9.91 and the legacy CSV export returned 200; the `?view=guided` tab
  showed exactly one row carrying the marker; the guided CSV contained exactly one marker row with
  `completionDigest` populated. A read-only database check after the smoke counted 1 guided entry,
  1 completion and 2 events. This also establishes administrator visibility after a reviewer save,
  which the in-memory preview could not.
- Smoke data CLEANED by an exact, reviewed, owner-approved delete scoped to the marker. Verified
  read-only afterwards (snapshot 2026-11-22, about 17:22Z; writes are open, so later counts will
  differ): activation `true`; guided entries / completion / events 0/0/0; no marker row; table,
  policy, function and grant structure checks true; legacy v0.9.91 2 responses / 12 events, as at
  every checkpoint.
- Owner preview ACCEPTED 2026-11-22 on the non-Docker preview
  (`scripts/matrix-options/run-r2-guided-preview.ps1`; reviewer `/r2-guided-fixture`, admin
  `/r2-guided-admin-fixture`, CSV `/api/matrix-options/paper/preview-r2?admin=csv`). Owner evidence:
  the reviewer could type and save comments successfully. Limits: in-memory anonymous sessions; no
  sign-in, RLS, RPC, activation, private-storage or deletion coverage (production persistence is the
  smoke above).
- RETIRED: the Docker/full-stack preview route (`scripts/matrix-options/r2-fullstack-preview.ps1`)
  and the external owner launcher `C:\Users\jasen\.codex\p\matrix-r2-preview.ps1`. Not required for
  page operation; do not resume, regenerate or use them.

## Rollback and kill-switch boundaries
Each of these is a separate Supabase write under the `CLAUDE.md` write gate (exact SQL, codex
GREEN, explicit owner approval). None is authorized by this handoff, and none has been run.
- Data-preserving disable: set the pinned activation row `enabled = false`. Grants are kept, every
  later save or finish returns read-only, and the release can be re-enabled later.
- Stronger containment: the committed kill switch
  `docs/apply-drafts/MATRIX_GUIDED_R2_KILL_SWITCH_2026_11_16.sql` (sha256 `a33dfb62...9beea`)
  disables the row AND revokes EXECUTE on the two write RPCs from `authenticated`. After it,
  re-enabling also needs an exact re-grant of those two EXECUTE privileges.
- Neither path deletes entries, completions, events, functions or migration history.

## Open item (needs its own owner approval)
- Remove the inert Vercel `MATRIX_R2_GUIDED_REVIEW_WRITES` key (no effect since the route flag was
  removed; it is not a kill switch).

## Disclosed incident (this lane, 2026-11-20)
Before the Docker binding was detected, an earlier local preview stack ran with ports published on all
interfaces (about 15:46-16:57 and 17:00-17:14 local time on 2026-11-20). The private R2 paper
objects were reachable for that time, and the E2E_TEST, CANARY_READER_B and E2E_ADMIN emails and
password hashes from about 16:15 to 16:57. That local data is deleted. Rotating those three test
passwords is the owner's call.

## Next-session hygiene
- Remove the scratch inner-loop worktree `C:\Projects\SSTAC-Dashboard-worktrees\matrix-r2-fullstack-preview`
  junction-safely (`cmd /c rmdir` its node_modules junction first, verify, then
  `git worktree remove --force`), if not already done. No per-run preview worktree was created by
  the retired route for this candidate.
