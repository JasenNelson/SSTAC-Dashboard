# Fresh session handoff 2026-11-20: Matrix Guided R2 review completion

Lifecycle: CURRENT (dated session anchor). Lane status: `docs/MATRIX_OPTIONS_STATUS.md` section 3.6.
Plan of record (owner-approved rev 3):
`C:\Users\jasen\.claude\plans\read-and-follow-c-users-jasen-rosy-avalanche-of-efe4eb6a-2662-4d43-9545-8abebeeee067.md`.

## Where things stand
- Candidate branch `feat/matrix-r2-guided-completion-20261120` (worktree
  `C:\Projects\SSTAC-Dashboard-worktrees\matrix-r2-guided-completion-20261120`), one integrated PR.
  Four exact-path commits: source; local full-stack preview tooling; go-live packet; docs.
- Production is unchanged: activation false, guided rows 0/0/0, legacy 2/12. No provider write was
  made by this lane; production was read only (catalog fingerprint capture).
- Review: Leg 1 (independent Opus + situation fork) iterated to GREEN over four rounds; codex luna
  and sol rounds and the six gates are recorded in the PR body.

## Owner gates, in order
1. Local preview: run `pwsh -File C:\Users\jasen\.codex\p\matrix-r2-preview.ps1`. On this machine
   Docker publishes container ports on every interface, so the launcher stops until the owner
   either sets Docker Desktop > Settings > Docker Engine `"ip": "127.0.0.1"` (restart Docker; affects
   all containers; the real E2E test accounts are then reused) or relaunches with
   `-AllowLanExposure` on a trusted network (stand-in accounts). Stop with `-Stop`.
2. After the owner's choice, the executor runs `r2-fullstack-preview.ps1 -Command accept` for the
   tree-bound acceptance receipt (not yet produced; see the PR body).
3. One holistic codex release review of the final PR tree (GREEN), then owner approval of the exact
   head SHA and scope; an authorized executor merges once required CI is GREEN.
4. Go-live packet finalization (identify pass, UUID, sidecars, review) and one exact approval:
   `docs/apply-drafts/MATRIX_GUIDED_R2_GO_LIVE_2026_11_20_PACKET.md`.

## Disclosed incident (this session)
Before the Docker binding was detected, the local preview stack ran with ports published on all
interfaces (about 15:46-16:57 and 17:00-17:14 local time on 2026-11-20). The private R2 paper
objects were reachable for that time, and the E2E_TEST, CANARY_READER_B and E2E_ADMIN emails and
password hashes from about 16:15 to 16:57. The local data is deleted and the tooling now fails
closed. Rotating those three test passwords is the owner's call.

## Next-session hygiene
- Remove the scratch inner-loop worktree `C:\Projects\SSTAC-Dashboard-worktrees\matrix-r2-fullstack-preview`
  junction-safely (`cmd /c rmdir` its node_modules junction first, verify, then
  `git worktree remove --force`), if not already done.
