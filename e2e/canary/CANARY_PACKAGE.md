# Production canary package -- Matrix Options paper v0.9.91 review workflow

RUN COMPLETE -- DO NOT RUN AGAIN. This package was approved and run once on 2026-10-15 against the
deployed merge `032cfcd5065c5e415fcf6b75f9f396634e599c53` (run ID below): GREEN. Record:
`docs/apply-drafts/MATRIX_PAPER_REVIEW_V0991_APPLIED_RECORD_2026_10_15.md`. The text below is the
manifest as approved (its sha256 at that commit was
`d2799a08aedc10629aa9ebec48cf4fbbea080fbc6183868b96acfbc2a6105436`). This added paragraph changes the
file, so the config's byte binding refuses a run against `032cfcd5`; any new canary needs a new
package, run ID and approval.

Status at approval time (historical; superseded by RUN COMPLETE above): PROPOSED. Nothing in this package runs until the owner approves it explicitly. The run
needs its own separate approval after the backend activation; this file is the manifest approved.

- runId (fixed, generated once from a random source): `canary-20261014-2849`
- Target: https://sstac-dashboard.vercel.app (exact HTTPS baseURL, no local server)
- Expected deployed sha: the approved merge sha goes ONLY into the `CANARY_EXPECTED_SHA` environment
  value at launch, never into this package (this file is inside the byte binding; editing it would change
  its bytes and the config would refuse at load). The spec reads GET /api/health and throws if sha differs from it or env is not
  `production`: before the first write, before EACH UI-driven write W1-W8 and each stale attempt, and before the negative probes (which would write if grants were broken). The sha seen at
  the start and at the end of the run is recorded in the results file.
- Spec: `e2e/matrix-options-paper-canary.spec.ts`; config: `playwright.paper-canary.config.ts`
  (excluded from default and paper e2e runs).
- Account creation: none.

## Identities (by alias only)
Reader A, reader B (both ordinary), admin. Managed accounts supplied by the owner; never the
owner's own account. Credentials come from environment variables only (names in the spec header
list: CANARY_READER_A/B_EMAIL/PASSWORD, CANARY_ADMIN_EMAIL/PASSWORD, plus CANARY_RUN_ID,
CANARY_EXPECTED_SHA, CANARY_AUTHORIZED=yes, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY).
A missing input aborts the run before any request.

## Pre-write gates (all must pass, in this order, before the marker file and any write)
00. Byte binding and single-run refusal AT CONFIG LOAD (playwright.paper-canary.config.ts, runner process,
   before Playwright resolves or cleans its output directory and before any request). The package is
   approved together with the merge sha, and CANARY_EXPECTED_SHA is that sha, so this proves the local
   bytes equal the deployed bytes:
   a. a real run (anything but `--list`) refuses unless CANARY_EXPECTED_SHA is a 40-hex sha;
   b. `git cat-file -e <sha>^{commit}` must succeed (the commit must exist locally: run `git fetch origin`);
   c. `git diff --quiet <sha> -- <scoped paths>` must pass and `git status --porcelain --untracked-files=all
      --ignored -- <scoped paths>` must be empty (no modified, staged, untracked or ignored scoped file);
   d. for every scoped file, `git rev-parse <sha>:<file>` must equal `git hash-object <file>`.
   Scoped paths: e2e/matrix-options-paper-canary.spec.ts, playwright.paper-canary.config.ts,
   e2e/canary/CANARY_PACKAGE.md, and every src/ module the spec imports transitively:
   src/lib/matrix-options/cohort-contract.ts, src/lib/matrix-options/reviewer-guide.ts,
   src/lib/matrix-options/paper/contracts.ts, src/lib/matrix-options/paper/releases.ts and the six JSON files
   in src/lib/matrix-options/paper/contracts/ (cohorts-v0.9.88-r4-presentation-001, cohorts-v0.9.91-run109-001,
   cohorts-v1, reviewer-guide-v0.9.88-r4-presentation-001, reviewer-guide-v0.9.91-run109-001, reviewer-guide-v1);
   the whole directory src/lib/matrix-options/paper is also covered by the diff and status checks.
   Accepted residual: npm dependencies under node_modules (zod, Playwright itself) are OUTSIDE the byte binding;
   their integrity is the store custody check recorded in .tmp/r4-run/FIXTURE_RECEIPT.md.
   The spec also asserts at start that it runs under playwright.paper-canary.config.ts (config file name check).
   `--list` WITHOUT CANARY_EXPECTED_SHA skips the binding check (a listing makes no request and writes
   nothing); `--list` WITH it enforces the check.
   Single-run refusal: if `.tmp/canary-output/canary-20261014-2849.started` or
   `.tmp/canary-output/results-canary-20261014-2849.json` exists, the config throws at load, so a refused
   rerun never reaches Playwright's outputDir cleanup and the first run's failure screenshots survive.
0. Config load guard (playwright.paper-canary.config.ts, runs when Playwright loads the config, before
   any output directory is resolved or cleaned): process.cwd() and the config file's own directory must
   both equal the approved worktree (normalized, case-insensitive on Windows), and process.argv must not
   contain `-o` or any argument beginning with `--output` (`--output` is the only output flag Playwright
   has; it has no short alias). Otherwise the config throws at load and nothing is created.
   The config also (a) walks every path component from the approved root down to
   `.tmp/canary-output/playwright` and refuses any existing component that is a symlink or junction
   (fs.lstatSync().isSymbolicLink(); verified on this machine to be true for a `mklink /J` junction)
   or whose fs.realpathSync differs from the expected path (case-insensitive); and (b) enforces an ARGV ALLOWLIST in the
   runner process: after the `test` subcommand the only accepted arguments are `--config`/`-c` followed
   by a path that resolves to this config file (or `--config=<that path>`), and `--list`. Anything else
   (test file filters, --max-failures, -x, --headed, --trace, --reporter, --timeout, --retries,
   --repeat-each, --workers, --project, --grep, ...) throws at load. Worker processes (recognized by process
   state only: forked from Playwright's common/process.js with an IPC channel; TEST_WORKER_INDEX is NOT accepted and is
   refused in the launch shell) re-load the config without CLI flags
   and are not subject to the allowlist. The config also sets retries 0 and repeatEach 1.
1. Artifact root: the spec's location (repo root = parent of e2e/) equals the approved worktree
   `C:\Projects\SSTAC-Dashboard-worktrees\matrix-v0991-review-activation` (normalized separators,
   case-insensitive on Windows); process.cwd() equals it; `git rev-parse --show-toplevel` run in that
   root equals it; `.tmp/canary-output` passes `git check-ignore`. Marker, results and screenshots
   live only under `<root>/.tmp/canary-output`.
2. Inputs: CANARY_AUTHORIZED=yes, CANARY_RUN_ID equals the fixed runId, CANARY_EXPECTED_SHA is 40-hex,
   baseURL is the approved production target, all credential variables present.
3. Supabase target: NEXT_PUBLIC_SUPABASE_URL equals `https://qyrhsieynzfgyuqzznap.supabase.co`; the
   NEXT_PUBLIC_SUPABASE_ANON_KEY is classified without printing it: `sb_secret_` -> refuse;
   `sb_publishable_` -> accept; a JWT -> payload must have role `anon` and ref `qyrhsieynzfgyuqzznap`;
   anything else -> refuse.
4. Single-run guard: neither the marker nor the results file for the runId exists.
5. (Output containment, item 6 below, is executed before this item.) Deployed sha equals CANARY_EXPECTED_SHA and env is production.
6. Output containment (runs right after the single-run guard, BEFORE the deployed-sha request, so no
   network request precedes a refusal; second layer behind the config load guard): testInfo.project.outputDir must equal `<root>/.tmp/canary-output/playwright`,
   testInfo.outputDir must be inside `<root>/.tmp/canary-output`, and no `--output` argument may be
   present; otherwise refuse before any request (rejects output overrides).
7. Identity preflight (read-only): reader A, reader B and admin each sign in (none anonymous); the three
   user ids are distinct; admin loads the admin review page (200, table "Review responses" present);
   reader A and reader B are redirected to /dashboard from it. Contexts are closed on failure.
8. Readiness poll (plan s5 step 9, enforced by the spec itself): reader A's authenticated review GET
   (v0.9.91, pinned manifest sha) must return persistence 'available'; polled every 5 s, max 60 s in
   total; each request carries a timeout of max(1, remaining poll time) ms so the total never exceeds 60 s
   (a failed or timed-out request counts as not available). If not available within 60 s the spec STOPS before the marker is written (runId not burned).
Only then is the marker written and the run marked started.

## Exact writes (all by reader A, question `rpq:v0.9.91:q01`, cohort `categories`)
The run is a single serial spec with three tests: (1) identity and positive journeys, (2) admin
page and CSV export, (3) negative probes. Synthetic text base: `CANARY canary-20261014-2849 synthetic test text - not a review response`;
edits append ` edit-1` etc. Preconditions (asserted before W1): reader A has no prior row and no prior event on q01.

Every write is now issued BY THE PRODUCTION PANEL (the deployed v0.9.91 review UI at
`/matrix-options/paper/publication/v/v0.9.91/questions/rpq:v0.9.91:q01`), never by a direct API call:
text is entered with the textarea (role textbox 'Your response'), the 1.5 s autosave or the buttons
('Submit response' / 'Re-submit response' / 'Keep mine' / 'Use saved') send the PUT. The API-level
count and row assertions (bootstrap GET, REST selects scoped to reader A, q01 and the pinned manifest sha) remain.
Two contexts of reader A are used: A1 (page pageA, the main journey) and A2 (page pageB, loaded at
revision 5, used for the conflicts).

| # | Driver (UI) | Text suffix | PUT status | Rev after |
|---|---|---|---|---|
| W1 | A1 types in textarea, autosave, waits for 'Draft saved'; then reload shows the text | none | 200 ok | 1 |
| W2 | A1 types (edit), autosave | edit-1 | 200 ok | 2 |
| W3 | A1 clicks 'Submit response' | edit-1 | 200 ok | 3 |
| W4 | A1 types (edit), autosave (submitted text stays edit-1) | edit-2 | 200 ok | 4 |
| W5 | A1 clicks 'Re-submit response' | edit-2 | 200 ok | 5 |
| W6 | A1 types, autosave | edit-3 | 200 ok | 6 |
| -- | A2 types (stale base 5), autosave; conflict UI shown; A2 clicks 'Use saved' (no write) | stale-1 | 409 stale_revision | unchanged |
| W7 | A1 types, autosave | edit-4 | 200 ok | 7 |
| -- | A2 types (stale base 6), autosave; conflict UI shown | keep-mine | 409 stale_revision | unchanged |
| W8 | A2 clicks 'Keep mine' (re-bases on the revision carried by the 409) | keep-mine | 200 ok | 8 |

Count derivation (from the RPCs in docs/apply-drafts/MATRIX_PAPER_REVIEW_V0991_ACTIVATION_2026_10_14.sql): every
successful save_draft or submit bumps revision by 1 and appends exactly one event; a stale_revision outcome and
a noop_already_submitted outcome append no event and bump nothing. W1-W8 are 8 successful writes, so 8 events
and final revision 8; the two stale attempts append none. Page-issued PUTs = 8 successful + 2 stale 409 = 10.
Every `pageA`/`pageB` PUT is counted (page.on('request')) and its status recorded (page.on('response')); before
each write the count must equal the writes made so far (no stray autosave), and after a 3 s settle at the end it
must be exactly 10 with statuses [200,200,200,200,200,200,409,200,409,200] in order. Each write is preceded by
the deployed-sha gate (identity: sha equals CANARY_EXPECTED_SHA, env production), including the two stale attempts
(they would write if the revision were not stale).

Expected created data: 1 response row (user = reader A, q01) and 8 event rows. Final draft text: `... keep-mine`
at revision 8; submitted text: `... edit-2` at submitted_revision 5. The spec asserts the final row and, via
reader A's own select scoped to her user id and q01, exactly 8 events with revisions 1..8 and actions
save-draft, save-draft, submit, save-draft, submit, save-draft, save-draft, save-draft.
No other table is written by the journeys.

Reads (all read-only): bootstrap GETs; fresh-context API restoration; UI restoration (reader A, a
fresh authenticated context opens the v0.9.91 question page for q01 and asserts the response
textarea shows the saved text; no typing, any PUT is aborted and counted, must be zero); identity
check (reader A's token selects matrix_paper_review_questions for v0.9.91: exactly 12 rows, all under
the manifest sha, and the (cohort, question, number) set equals the set computed in code from the
same release, reviewer-guide and cohort contract modules the app uses; the computed manifest sha is
also cross-checked against the pinned sha when the spec loads); admin page (admin context: the table
named "Review responses" has exactly one row for reader A / q01 holding the keep-mine draft and the
edit-2 submitted text); CSV export (filtered to reader A and q01).

## Probes (no row may be created; each asserts EXACT status and code)
| Probe | Expected |
|---|---|
| anon key: INSERT / UPDATE / DELETE on questions, responses, response_events (9) | 401, code 42501 |
| anon key: RPC save_draft, submit (2) | 401, code 42501 |
| reader B: INSERT / UPDATE / DELETE on all three tables (9) | 403, code 42501 |
| reader B: direct select on responses and events for reader A's user id (2) | 200, zero rows |
| reader B: GET paper reviews route | 200, none of reader A's data |
| reader B: admin page | redirect to /dashboard |
| reader B: CSV export | 403 |
| no session: PUT review route | 401 `unauthenticated` |
| no session: GET review route | 401 |

The authenticated-anonymous probe is NOT part of this package (covered by hermetic tests and
the VERIFY step).

## Containment
- INSERT probes use document_version `canary-canary-20261014-2849` and question id
  `canary-canary-20261014-2849-probe`; UPDATE/DELETE probes filter on BOTH that synthetic
  document_version and that synthetic question id, so even if an INSERT denial were broken, no
  canonical seed or other row could match. Canonical seeds and other rows are never touched.
- Every response and event assertion (precondition and final) is scoped to reader A's user id +
  document_version `v0.9.91` + the pinned manifest_sha256 + question id `rpq:v0.9.91:q01`: zero
  responses and zero events before W1; afterwards exactly one response (its id equals the id returned
  by W1 when present) and exactly 8 events, all carrying that response id. Never global counts.
- Credentials, session tokens, traces and videos are never logged or stored; trace and video are off;
  fresh browser contexts per identity; no storage state written. Output (results JSON, failure
  screenshots only) goes under the gitignored `.tmp/canary-output/`.

## Launch prerequisites
1. `git fetch origin` (the approved merge commit must exist locally).
2. The approved worktree must be checked out at a commit whose scoped paths (gate 00) are byte-identical to the
   approved merge sha, with a clean tree for those paths (no modified, staged, untracked or ignored scoped file).
3. Set CANARY_EXPECTED_SHA to the approved merge sha (env value only; never edit it into this package), plus the other approved env, and unset
   the forbidden Playwright env names (see Run discipline).

## Run discipline
The ONE allowed launch command (from the approved worktree root, with the approved env set):
`npx playwright test --config playwright.paper-canary.config.ts`
(`--list` may be added for a dry listing; `-c <path>` and `--config=<path>` forms are equivalent; no other flag or argument is accepted). The whole 3-test serial suite
runs exactly once. In the spec, before any request: testInfo.project.repeatEach === 1,
testInfo.repeatEachIndex === 0, testInfo.retry === 0 and testInfo.config.workers === 1. Before and
after creating `.tmp/canary-output` (and again before the marker and results writes) the spec re-walks
every component from the approved root down to `.tmp/canary-output/playwright`, refusing a symlink or
junction or a realpath mismatch; directories are created only after the first check passes.
Single run, zero retries (config retries 0, serial). A marker file refuses a second run of the same
runId. The marker and results file are local to this worktree's gitignored `.tmp/canary-output/`, so
the run must be launched from this worktree only (another checkout would not see the marker).
The results file `results-<runId>.json` is written once (exclusive create) and only by a run that
passed its pre-write gates; a refused rerun never touches it. Its `allOk` is true only if all 3
declared tests passed, every recorded check is ok, AND the final GET /api/health (end of run) returns 200
with sha equal to CANARY_EXPECTED_SHA and env production (a mismatch or failed final fetch is recorded as a
failed check and makes allOk false); it also records the expected, start and end
deployed shas. A failed test also records a short reason (first line of the error message, max 300
characters; never credentials or tokens). On ANY failure: STOP, report, and wait; do not rerun or
improvise.

Launch-shell environment requirements: the config refuses to load (in the runner process) if the shell has ANY
environment variable whose name starts with PW_, PWTEST_, PWDEBUG, PWMCP or PLAYWRIGHT_ (case-insensitive: PW_*, PWTEST_*, PWDEBUG*,
PWMCP*, PLAYWRIGHT_*), or is named TEST_WORKER_INDEX, TEST_PARALLEL_INDEX, DEBUG, CI or FORCE_COLOR. The only exception is
PLAYWRIGHT_BROWSERS_PATH. The error lists the offending names, never values. Unset them (or start a clean shell)
before launch; this blocks watch mode (PWTEST_WATCH), reporter overrides (PW_TEST_REPORTER,
PLAYWRIGHT_HTML_OUTPUT_DIR) and spoofed worker identity. Worker detection uses process state (argv[1] is
Playwright's own node_modules/playwright*/lib/common/process.js and an IPC channel exists), not an env var, and the
reporter is pinned to [['list']] in the config.

Start condition: the plan s5 step 9 readiness poll (pre-write gate 8) is enforced by the spec before
the marker is written; if reader A's GET does not return persistence 'available' within 60 s, the
spec stops without burning the runId.

Note: the default and paper e2e configs exclude the canary spec (playwright.config.ts per-project
testIgnore; in playwright.paper.config.ts the top-level testIgnore is shadowed by per-project ones
but its testMatch cannot match the canary file, and the spec also refuses any baseURL other than
production).

## Data retention and cleanup
Canary rows are retained and are labelled by the runId text. Cleanup is NOT part of this package: it
is a separate destructive operation, bound to the exact created response and event ids and their
preimages, needing its own owner approval.
