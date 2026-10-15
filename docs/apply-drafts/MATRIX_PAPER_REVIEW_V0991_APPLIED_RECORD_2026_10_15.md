# Matrix paper review persistence: v0.9.91 applied record (2026_10_15)

Status: APPLIED to production Supabase project qyrhsieynzfgyuqzznap on 2026-10-15 and proven by the
one-shot production canary (GREEN). This file records what was run, in order, with its evidence. It
changes nothing by itself.

DO NOT APPLY AGAIN. The activation SQL files (`MATRIX_PAPER_REVIEW_V0991_ACTIVATION_2026_10_14*.sql`)
and the three corrective files (`MATRIX_PAPER_REVIEW_V0991_SUBMIT_CORRECTIVE_2026_10_15*.sql`) are
kept byte-for-byte as the approved, hash-pinned inputs, so any draft marker in their headers (for
example "DRAFT -- NOT APPLIED" or "DRAFT -- NOT RUN") is historical. Both writes were committed on 2026-10-15 (section
1). A repeat would also fail closed: the activation uses plain `CREATE TABLE` / `CREATE FUNCTION`
(errors on the existing objects, transaction rolls back), and the corrective raises unless the
installed submit body is the pre-corrective one (`8f000481...`). The activation NOTES carries a
pointer to this record and marks its draft status as superseded; the rest is the pre-apply text.

Every write below had its own exact owner approval naming the file and sha256 (CLAUDE.md Supabase
Protocol rule 2). No step used `apply_migration`, service_role, or a retry.

## 1. Sequence

| Step | When (UTC) | What | Result |
|---|---|---|---|
| Merge | 2026-10-15 | PR #816 merged at head `ee207e4eb3afa5a68ace8d98c687fc07a3d314ba`, merge commit `032cfcd5065c5e415fcf6b75f9f396634e599c53` | production `/api/health` reported the merge sha at 10:55:03Z |
| Activation PREFLIGHT | before 10:57Z | `..._2026_10_14_PREFLIGHT.sql` sha256 `8c64529646a1ec453a08c9ebd17cd0c7d2a4deef12ff1505ba686d86eafa4126`, read-only | 27/27 ok; server_version_num 170004; current_user postgres |
| Advisor baseline | 10:57:45Z | security + performance advisors | recorded; 0 performance findings mention matrix_paper_review |
| Activation | after 10:57Z | ONE MCP `execute_sql` of `..._2026_10_14.sql` sha256 `ab08d9d268a6cd6f273d054c1749186bfaa23efb579cb25d84997a51a316391f` | committed, no error |
| Activation VERIFY | after apply | `..._2026_10_14_VERIFY.sql` sha256 `37f7ae2c607b0b4383f68e855fe3da7b5e348124f2aa6cb48c896677459ad4f5` | 130/131 ok; row 99 RED (section 2); stopped per NOTES section 4 step 4 |
| Corrective PREFLIGHT | before 12:00Z | `..._SUBMIT_CORRECTIVE_2026_10_15_PREFLIGHT.sql` sha256 `0284d277052e8d76bf423cc152d0628cbfa8c7f67902ef56e3660d12016075ef`, read-only | 17/17 ok |
| Corrective | before 12:00Z | ONE MCP `execute_sql` of `..._SUBMIT_CORRECTIVE_2026_10_15.sql` sha256 `584bf5122056a74f5f3068bb252143fc1e7794ba548a1aa1f88d554050b8646a` | committed; in-transaction guards passed |
| VERIFY again | after corrective | activation VERIFY, same bytes | 131/131 ok; row 99 submit prosrc sha256 `c9f1ee0bea6a711a84476ff3ed5fa17b702bcb3584740a1ef2c9ab95f349a7ad` |
| POSTCHECK | after corrective | `..._SUBMIT_CORRECTIVE_2026_10_15_POSTCHECK.sql` sha256 `2d450c80ef8a436f0173060457402904a06d9e9e3082f208331b1992e51ea84b`, run twice | both runs all ok; no in-flight old-body submit (0 rows) |
| Advisors after | 12:00:26Z | same advisors | expected changes only (section 3) |
| Readiness | 12:00:45Z | anonymous GET of `/rest/v1/matrix_paper_review_questions` | HTTP 401, code 42501: schema cache converged, anon denied |
| Canary | 15:01:18Z-15:02:24Z | one launch of the production canary (section 4) | GREEN |

## 2. Why a corrective was needed (transport defect, not a SQL defect)

Line 596 of the approved activation file holds ten ASCII escape sequences (backslash, `u`, four hex
digits) inside the submit RPC's blank-submission regex. The tool-call transport between the agent and
the MCP server decoded them into the literal code points before the SQL reached Postgres, so the
installed `matrix_paper_review_submit` body hashed `8f000481b4974f26768b205ab5fad8bd8cd43833eb0b29867a73cf479abf188d`
instead of the approved `c9f1ee0b...a7ad`. The other four function bodies, all tables, constraints,
indexes, grants, policies, the trigger and the 12 seed rows matched.

Read-only diagnosis: the approved body with those ten escapes decoded reproduces the installed body
exactly. A sweep of every code point found the two regexes differ only on U+001C..U+001F and U+0085.

The corrective is one `CREATE OR REPLACE FUNCTION` of the submit RPC inside a DO block. The file
carries no backslash: it writes a placeholder and rebuilds the backslashes server-side with
`chr(92)`, then checks inside the transaction that current_user, the function count, the pre- and
post-body sha256, the oid, the ACL, the owner, SECURITY DEFINER, volatility, proconfig and the
argument list are exactly as expected, and raises (rolling back) otherwise. Its PREFLIGHT proves the
deviant pre-state and the rebuilt body before the write; its POSTCHECK confirms that no submit was
in flight on the old body (pg_stat_activity and the advisory lock the RPC takes).

The owner approved restoring the approved body and accepting NOTES M6 behaviour for U+001C-U+001F and
U+0085 (the database may reject as blank a few code points that JavaScript `trim()` keeps; HTTP 422,
UX-only).

Lesson for future applies through MCP `execute_sql`: any backslash-u escape in SQL text is at risk of
being decoded in transit. Write such SQL without backslash escapes (code points via `chr()`), and
pin every function body by sha256 in VERIFY, which is what caught this.

## 3. Advisors (12:00:26Z vs the 10:57:45Z baseline)

- Security: `authenticated_security_definer_function_executable` 29 -> 32, the three new SECURITY
  DEFINER functions callable by signed-in users by design (`is_matrix_options_paper_admin`,
  save-draft, submit). Every other count unchanged. No anon, search_path or RLS finding on the new
  objects.
- Performance: 268 -> 273. New: `multiple_permissive_policies` x2 (responses, response events) and
  `unused_index` x3 (new indexes, not yet used). All expected; nothing else new, nothing removed.

## 4. Production canary (one launch, GREEN)

Owner approval named ApprovalId `R4-CANARY-20261015-1`, the runner sha256, HEAD `ee207e4e`, deployed
sha `032cfcd5`, run ID `canary-20261014-2849`, the three identity sources, retained rows and no retry.
Screenshot decision S1 (keep failure screenshots locally); none were produced.

Runner receipt (local, gitignored `.tmp/gate-logs/`; log sha256
`d27dded4b6786015d8ac207f93d28544bdeecbcb93d3ba560bff64d4efea4406`):
- deployed sha observed `032cfcd5...` in env production, HTTP 200; HEAD and tree re-checked unchanged
  after the run (3 allow-listed local records, the same before and after).
- child exit 0; results file fresh; `allOk` true; 53 checks ok, 0 failed; 3/3 tests ok.
- leak scan clean (pre-run, live watcher and post-run); 0 redactions; nothing wiped; no surviving process.
- The spec, its config and the package were byte-bound to the deployed sha; the package ran as
  approved (`e2e/canary/CANARY_PACKAGE.md` sha256
  `d2799a08aedc10629aa9ebec48cf4fbbea080fbc6183868b96acfbc2a6105436` at `032cfcd5`). This record's
  PR prepends a "RUN COMPLETE -- DO NOT RUN AGAIN" paragraph to that file and marks its old
  "Status: PROPOSED" line as historical; the rest of it is the approved manifest.

Identities (verified read-only before the run, no credential printed): reader A and reader B are two
distinct ordinary `member` accounts and the admin a third distinct account with `admin,member`; all
confirmed and non-anonymous. Reader B is a new ordinary account the owner created in the Supabase
dashboard on 2026-10-15 for this run (role `member` from the existing `on_auth_user_created` trigger).

Production rows after the run (read-only):
- Reader A, question `rpq:v0.9.91:q01`: 1 response row at revision 8, submitted revision 5, and 8
  event rows (save-draft 1, save-draft 2, submit 3, save-draft 4, submit 5, save-draft 6, 7, 8),
  matching the package exactly. Two deliberately stale write attempts were refused (409) and wrote nothing.
- Reader B: no rows.
- Separately, before the canary (13:59-14:00Z), the admin account holds 1 response submitted at
  revision 4 with 4 events. This is owner-created evidence from the owner's own UI check, not a canary
  row.

## 5. Retained state and open owner decisions

- Retained by approval: the canary rows and the reader B account. Removing either is a separate,
  future owner approval.
- Migration ledger: applying through `execute_sql` recorded nothing in
  `supabase_migrations.schema_migrations` (7 rows, latest `20260712164723`, none for paper review, read
  on 2026-10-15) and added no file under `supabase/migrations/` (NOTES M3). Preview branches and
  migration replays therefore do not contain these objects. Whether to record a migration file or a
  ledger entry is an OPEN owner decision; this record does not change the ledger.
- Not covered by this canary (not in the approved plan or the byte-bound spec): TWG regression checks
  and native content / download checks.

## 6. Files

| File | sha256 |
|---|---|
| `MATRIX_PAPER_REVIEW_V0991_SUBMIT_CORRECTIVE_2026_10_15.sql` | `584bf5122056a74f5f3068bb252143fc1e7794ba548a1aa1f88d554050b8646a` |
| `MATRIX_PAPER_REVIEW_V0991_SUBMIT_CORRECTIVE_2026_10_15_PREFLIGHT.sql` | `0284d277052e8d76bf423cc152d0628cbfa8c7f67902ef56e3660d12016075ef` |
| `MATRIX_PAPER_REVIEW_V0991_SUBMIT_CORRECTIVE_2026_10_15_POSTCHECK.sql` | `2d450c80ef8a436f0173060457402904a06d9e9e3082f208331b1992e51ea84b` |

The activation file set and its hashes are listed in
`MATRIX_PAPER_REVIEW_V0991_ACTIVATION_2026_10_14_NOTES.md` section 3.
