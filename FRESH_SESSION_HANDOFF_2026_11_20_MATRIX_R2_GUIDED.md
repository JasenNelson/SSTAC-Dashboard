# Fresh session handoff 2026-11-20: Matrix Guided R2 review completion

Lifecycle: CURRENT (dated session anchor). Revised 2026-11-22 (architecture documentation unit).
Lane status: `docs/MATRIX_OPTIONS_STATUS.md` section 3.6.
Architecture authority (read before ANY Guided R2 change):
`docs/design/matrix-options/GUIDED_R2_REVIEW_ARCHITECTURE.md`.
Plan of record (owner-approved rev 3):
`C:\Users\jasen\.claude\plans\read-and-follow-c-users-jasen-rosy-avalanche-of-efe4eb6a-2662-4d43-9545-8abebeeee067.md`.
Previous versions (archived, read-only): `docs/archive/root-scratch-2026/FRESH_SESSION_HANDOFF_2026_11_20_MATRIX_R2_GUIDED_pre_astra_correction_r1.md`,
`..._pre_correction_r2.md`, `..._pre_scope_reduction_r1.md` and `..._pre_architecture_docs_r1.md`.

## Scope (owner-approved scope reduction, 2026-11-20)
APPROVE MATRIX R2 SCOPE REDUCTION | KEEP PRODUCT PARITY + ADMIN + DISPOSABLE LOCAL PREVIEW | DEFER
PRODUCTION GO-LIVE PACKET AND ACTIVATION HARNESS.
- This candidate restores Guided R2 product parity (the accepted three-panel reviewer experience,
  Save / Save all / Save all and finish, Finish and revision, conflict resolution, unsaved-draft
  recovery, administrator Guided R2 view and scoped CSV, legacy v0.9.91 read-only history).
- No go-live packet, activation tooling or production canary is present in this candidate.
  Production activation and go-live automation are a separate later unit, after merge.

## Maintenance rule
Content revisions change content and configuration INSIDE the established Guided R2 system. They
never authorize rebuilding the page, replacing storage, bypassing Supabase, disconnecting the admin
view or CSV, or accepting visual similarity as functional parity. Follow the architecture
authority's pre-change investigation and parity checks.

## Where things stand (verified facts only)
- Branch `feat/matrix-r2-guided-completion-20261120` (worktree
  `C:\Projects\SSTAC-Dashboard-worktrees\matrix-r2-guided-completion-20261120`). Product candidate
  COMMITTED: HEAD `0ec2afe2ab7083d8b739c7985131560972d799e3`, tree
  `ff5c273fc706e4c5fc81b07333b3ef1d97bdc74a`, three commits on base `45f3c080` (`93780ab9`,
  `95733518`, `0ec2afe2`). Mission Control reports it reviewed and six-gate GREEN.
- A documentation-only commit (this handoff, the architecture authority, status, index, manifest,
  `AGENTS.md`, `CLAUDE.md`) follows on the same branch; its six gates must run on that tip
  (pending when this handoff was written; results are reported with the commit).
- Owner preview ACCEPTED 2026-11-22 on the non-Docker preview
  (`scripts/matrix-options/run-r2-guided-preview.ps1`; reviewer `/r2-guided-fixture`, admin
  `/r2-guided-admin-fixture`, CSV `/api/matrix-options/paper/preview-r2?admin=csv`). Owner evidence:
  the reviewer could type and save comments successfully. Administrator visibility after that save
  was NOT separately owner-confirmed. Limits: in-memory anonymous sessions; no sign-in, RLS, RPC,
  activation, private-storage or deletion coverage.
- RETIRED: the Docker/full-stack preview route (`scripts/matrix-options/r2-fullstack-preview.ps1`)
  and the external owner launcher `C:\Users\jasen\.codex\p\matrix-r2-preview.ps1`. Not required for
  page operation; do not resume, regenerate or use them. Its `up` never ran for this candidate; no
  run, port reservation, container or volume exists.
- Production, as last verified read-only on 2026-11-20: activation `false`, guided rows 0/0/0,
  legacy 2/12. Not re-verified since. No provider operation or activation is authorized.

## Pending steps, in order
1. Owner approval to push this branch and open one integrated PR (exact head SHA).
2. Required CI GREEN; holistic release review of the PR tree as the owner directs; owner merge
   approval of the exact head; merge by an authorized executor; deployment.
3. Controlled authenticated production persistence smoke (reviewer save -> admin view -> CSV) after
   deployment and before permanent activation. Saves persist only while the activation row is
   `true`, so the smoke needs its own owner-approved, bounded enabling of that row under the
   Supabase write gate in `CLAUDE.md` (exact SQL, codex GREEN, explicit owner approval stating what
   happens afterwards). Not authorized by this candidate.
4. Separately, later: the production activation / go-live unit (not part of this candidate).

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
