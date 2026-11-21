# Fresh session handoff 2026-11-20: Matrix Guided R2 review completion

Lifecycle: CURRENT (dated session anchor). Lane status: `docs/MATRIX_OPTIONS_STATUS.md` section 3.6.
Plan of record (owner-approved rev 3):
`C:\Users\jasen\.claude\plans\read-and-follow-c-users-jasen-rosy-avalanche-of-efe4eb6a-2662-4d43-9545-8abebeeee067.md`.
Previous versions: `docs/archive/root-scratch-2026/FRESH_SESSION_HANDOFF_2026_11_20_MATRIX_R2_GUIDED_pre_astra_correction_r1.md`
(before correction R1) and `..._pre_correction_r2.md` (before correction R2).

## Where things stand (verified facts only)
- Candidate branch `feat/matrix-r2-guided-completion-20261120` (worktree
  `C:\Projects\SSTAC-Dashboard-worktrees\matrix-r2-guided-completion-20261120`). The candidate is
  UNCOMMITTED at the base SHA `45f3c0802e1a3d4ee3ce6b3765fc1a55437a7f71`: no commit, no PR, no PR
  body, no gate run and no acceptance receipt exists for it yet.
- Two correction rounds have been applied to the uncommitted candidate (R1: Codex HQ P1-1..P1-3,
  P2-1..P2-6, P3; R2: the independent full static review's P1, P2-1..P2-9, P3; the reviewing model
  and effort for R2 were not recorded). Only focused unit/static/mutation tests, `tsc --noEmit`,
  PowerShell 5.1/7 parse checks and `node --check` were run. No packet SQL has ever executed and the
  preview harness has never run end to end. Independent Codex Mission Control review of the
  corrected candidate is PENDING.
- Production, as last verified read-only on 2026-11-20 (catalog fingerprint capture): activation
  false, guided rows 0/0/0, legacy 2/12. No provider write has been made by this lane.

## Pending steps, in order (none has happened yet)
1. Codex Mission Control review of the corrected uncommitted candidate, iterated to GREEN.
2. Planned exact-path commits (source; local full-stack preview tooling; go-live packet; docs), then
   the six gates on the final tip and one integrated PR. Each is pending until its evidence exists.
3. Owner launcher (outside the repository, `C:\Users\jasen\.codex\p\matrix-r2-preview.ps1`): NOT
   READY and not modified by the correction sessions. It still calls `down` automatically and does
   not pass `-RunId`, so it no longer works with the corrected wrapper. After the candidate is
   committed it must be regenerated from the launcher contract in the header of
   `scripts/matrix-options/r2-fullstack-preview.ps1` (never an automatic `down`; capture the
   `R2_PREVIEW_RUN_ID=<id>` line `up` prints and pass that id as `-RunId` to every later call of the
   same session), independently reviewed and hash-pinned. Do not declare the owner preview ready
   before that.
4. Local preview through the regenerated launcher. The wrapper binds only the local Docker Desktop
   engine, takes the machine-wide lease (`C:\ProgramData\sstac-r2-preview\lease.json`) under a new
   run id, records its live wrapper process, and refuses to stop, reset or reuse anything it cannot
   prove it owns. On this machine Docker publishes container ports on every interface, so `up` stops
   until the owner either sets Docker Desktop > Settings > Docker Engine `"ip": "127.0.0.1"` (restart
   Docker; affects all containers; the real E2E test accounts are then reused) or relaunches with
   `-AllowLanExposure` on a trusted network (stand-in accounts). A stale lease needs
   `-Command reclaim -ConfirmReclaimRunId <id>`, which never stops anything; a stuck
   `lease.mutex` is never broken automatically.
5. The executor runs `r2-fullstack-preview.ps1 -Command accept -RunId <id>` for the tree-bound
   acceptance receipt (pending; the journey re-proves lease, wrapper, listener, build and auth
   endpoint before every credential use).
6. One holistic codex release review of the final PR tree (GREEN), then owner approval of the exact
   head SHA and scope; an authorized executor merges once required CI is GREEN.
7. Go-live packet finalization (identify pass for the UUID and the legacy export digest, run ID,
   starting transition T0, legacy digest, sidecars, review) and one exact approval:
   `docs/apply-drafts/MATRIX_GUIDED_R2_GO_LIVE_2026_11_20_PACKET.md`. RECONCILE decides every step
   after a write; an unknown ENABLE outcome is closed only by FENCE. If PREFLIGHT check 21 (exact
   migration ledger identity) fails, stop for owner adjudication.

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
