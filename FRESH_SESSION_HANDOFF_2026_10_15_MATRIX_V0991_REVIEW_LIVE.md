# FRESH SESSION HANDOFF -- 2026-10-15 -- MATRIX OPTIONS v0.9.91 PAPER REVIEW IS LIVE

## State in one paragraph

The Matrix Options paper v0.9.91 review workflow (save draft, submit, admin review view and
CSV export) is LIVE in production and proven. Plan R4 completed all three owner gates on
2026-10-15: (a) PR #816 merged (032cfcd5); (b) the database activation was applied to
Supabase qyrhsieynzfgyuqzznap, followed by an owner-approved submit-body corrective after the
tool transport decoded ten escapes in transit (VERIFY now 131/131); (c) the one-shot
production canary ran GREEN (53/53 checks, expected rows only). The applied-facts record
merged as PR #817 (df4e3391). Nothing is running and no write is pending.

## Authoritative records (committed)

- docs/apply-drafts/MATRIX_PAPER_REVIEW_V0991_APPLIED_RECORD_2026_10_15.md -- what was run,
  in order, with every sha256, result, advisor delta, canary receipt and retained row.
- docs/apply-drafts/MATRIX_PAPER_REVIEW_V0991_ACTIVATION_2026_10_14_NOTES.md -- the
  pre-apply runbook (kill switch, drain, rollback ordering, M3-M7 notes).
- docs/MATRIX_OPTIONS_STATUS.md section 3.5 -- current truth for the paper sub-lane.
- Do NOT re-apply the activation or corrective SQL (both fail closed on the live state) and
  do NOT re-run the canary. Its run marker is local to the worktree that ran it; what stops a
  rerun elsewhere is the spec's no-prior-row precondition (reader A now has rows) and the
  package edit in PR #817 (the config's byte binding against 032cfcd5). Never rely on these:
  a new canary needs a new package, run ID and owner approval.

Local, gitignored evidence (this worktree only; not recoverable from git):
C:\Projects\SSTAC-Dashboard-worktrees\matrix-v0991-review-activation\.tmp\r4-run\
(receipts, packets, reviews, canary runner and its self-tests) and .tmp\gate-logs\
(R4-CANARY-20261015T150118Z log and receipt).

## Open owner decisions (none blocks the live workflow)

1. Migration ledger: the objects were applied through execute_sql, so
   supabase_migrations.schema_migrations has no entry and supabase/migrations/ has no file;
   preview branches and migration replays lack these tables. Record a migration or accept
   the drift.
2. Reader B test account (an ordinary member account the owner created for the canary; its
   address is the CANARY_READER_B_EMAIL value in the managed .env.local): its password was
   exposed in a local session transcript on 2026-10-15; the owner deferred rotation. Rotate it (dashboard + CANARY_READER_B_PASSWORD in the managed .env.local)
   before reusing the account, or remove the account.
3. Retained production data: reader A's canary response (q01, revision 8) and 8 events,
   and the owner's own admin-account test response (revision 4, 4 events). Cleanup needs
   its own approval.
4. Coverage not in the canary: TWG regression and native content / download checks.
   Adding them needs a new spec, PR, deploy and canary approval.

## Lessons from this lane (candidates for docs/LESSONS.md / memory, owner to approve)

- MCP execute_sql transport decodes backslash-u escapes inside SQL text; write SQL
  without them (chr()) and pin every function body by sha256 in VERIFY.
- PowerShell variable names are case-insensitive: `$l` in a loop overwrote `$L`, and a
  credential reached an error message. Use distinct names in any script touching secrets.
- Local unit gate needs MATRIX_PAPER_PRIVATE_FIXTURE=skip (as CI sets it); the e2e gate
  needs the E2E_* names in the process environment.

## Next session

Pick up from the owner's choice among the four open decisions above. The activation,
corrective and canary work is complete; the lane stays open until those decisions are made. Verify with `git log --oneline -3 origin/main` (df4e3391 or later).
