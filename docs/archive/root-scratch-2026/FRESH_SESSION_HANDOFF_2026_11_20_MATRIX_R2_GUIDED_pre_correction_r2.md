# Fresh session handoff 2026-11-20: Matrix Guided R2 review completion

Lifecycle: CURRENT (dated session anchor). Lane status: `docs/MATRIX_OPTIONS_STATUS.md` section 3.6.
Plan of record (owner-approved rev 3):
`C:\Users\jasen\.claude\plans\read-and-follow-c-users-jasen-rosy-avalanche-of-efe4eb6a-2662-4d43-9545-8abebeeee067.md`.
Previous version (before the Astra correction R1 rewrite): `docs/archive/root-scratch-2026/FRESH_SESSION_HANDOFF_2026_11_20_MATRIX_R2_GUIDED_pre_astra_correction_r1.md`.

## Where things stand (verified facts only)
- Candidate branch `feat/matrix-r2-guided-completion-20261120` (worktree
  `C:\Projects\SSTAC-Dashboard-worktrees\matrix-r2-guided-completion-20261120`). The candidate is
  UNCOMMITTED at the base SHA `45f3c0802e1a3d4ee3ce6b3765fc1a55437a7f71`: no commit, no PR, no PR
  body, no gate run and no acceptance receipt exists for it yet.
- The Codex HQ correction round (Astra correction R1: P1-1..P1-3, P2-1..P2-6, P3) has been applied to
  the uncommitted candidate and only focused unit/static tests, `tsc --noEmit` and PowerShell parse
  checks were run on it. Independent Codex Mission Control review of the corrected candidate is
  PENDING.
- Production, as last verified read-only on 2026-11-20 (catalog fingerprint capture): activation
  false, guided rows 0/0/0, legacy 2/12. No provider write has been made by this lane.

## Pending steps, in order (none has happened yet)
1. Codex Mission Control review of the corrected uncommitted candidate, iterated to GREEN.
2. Planned exact-path commits (source; local full-stack preview tooling; go-live packet; docs), then
   the six gates on the final tip and one integrated PR. Each is pending until its evidence exists.
3. Local preview: run `pwsh -File C:\Users\jasen\.codex\p\matrix-r2-preview.ps1` after the executor
   re-pins it to the committed candidate. The wrapper now binds only the local Docker Desktop
   engine, takes the machine-wide lease (`C:\ProgramData\sstac-r2-preview\lease.json`) under a new
   run id, and refuses to stop, reset or reuse anything it cannot prove it owns; `down` with no
   lease stops nothing. On this machine Docker publishes container ports on every interface, so `up`
   stops until the owner either sets Docker Desktop > Settings > Docker Engine `"ip": "127.0.0.1"`
   (restart Docker; affects all containers; the real E2E test accounts are then reused) or relaunches
   with `-AllowLanExposure` on a trusted network (stand-in accounts). Stop with `-Stop`.
   Ripple for the executor: the launcher's leading `down` is now a no-op without a lease and fails
   closed if containers exist without one; a stale lease needs `-Command reclaim
   -ConfirmReclaimRunId <id>`, which never stops anything.
4. After the owner's choice, the executor runs `r2-fullstack-preview.ps1 -Command accept` for the
   tree-bound acceptance receipt (pending; it proves the listener is this run's app before any
   credential is read).
5. One holistic codex release review of the final PR tree (GREEN), then owner approval of the exact
   head SHA and scope; an authorized executor merges once required CI is GREEN.
6. Go-live packet finalization (identify pass for the UUID and the legacy export digest, run ID,
   legacy and ledger digests, sidecars, review) and one exact approval:
   `docs/apply-drafts/MATRIX_GUIDED_R2_GO_LIVE_2026_11_20_PACKET.md`. RECONCILE decides every step
   after a write.

## Disclosed incident (this lane, 2026-11-20)
Before the Docker binding was detected, the local preview stack ran with ports published on all
interfaces (about 15:46-16:57 and 17:00-17:14 local time on 2026-11-20). The private R2 paper
objects were reachable for that time, and the E2E_TEST, CANARY_READER_B and E2E_ADMIN emails and
password hashes from about 16:15 to 16:57. The local data is deleted and the tooling now fails
closed. Rotating those three test passwords is the owner's call.

## Next-session hygiene
- Remove the scratch inner-loop worktree `C:\Projects\SSTAC-Dashboard-worktrees\matrix-r2-fullstack-preview`
  junction-safely (`cmd /c rmdir` its node_modules junction first, verify, then
  `git worktree remove --force`), if not already done.
