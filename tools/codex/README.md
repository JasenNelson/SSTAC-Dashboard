# SSTAC Codex Autonomous Executor Adapter

This Phase 1 adapter prepares and launches a bounded Codex executor in a clean,
dedicated SSTAC-Dashboard worktree. It stops at READY_FOR_REVIEW and does not
grant commit, staging, push, PR, deployment, merge, Supabase, production-write,
secret-inspection, process-cleanup, or worktree-cleanup authority.

## Phase 1 files

- `.codex/rules/autonomous-executor.rules` denies Git, GitHub, network,
  deployment, Supabase, database, raw-build, package-mutation, environment,
  interpreter-wrapper, arbitrary cleanup, process-termination, and junction
  deletion commands.
- `tools/codex/Invoke-SstacAutonomousExecutor.ps1` performs controller-owned
  preflight, launch, JSONL audit, postflight, exact diff, and acceptance.
- `tools/codex/Test-SstacAutonomousExecutor.ps1` runs policy, freshness,
  configuration, negative-evidence, and optional real-executor canaries.

No existing `.codex/config.toml` setting is modified.

## Required Mission Control receipt

The launcher requires an absolute receipt path and its exact SHA-256. The
receipt is schema version 1 and contains exactly:

- a unique receipt ID and UTC creation timestamp;
- the canonical repository root and exact origin URL;
- the exact query `git ls-remote origin refs/heads/main`;
- the freshly observed remote `origin/main` SHA and verification timestamp;
- an absolute active-session inventory path, its SHA-256, and its timestamp.

The active-session inventory is also schema version 1 and contains the complete
canonical path and branch list. The launcher rejects a receipt or inventory
that is stale, future-dated, hash-mismatched, duplicated, incomplete, or
ambiguous. The default maximum age is 15 minutes. The receipt remote SHA, the
caller pin, local `origin/main`, HEAD, base, and merge-base must all agree.

That strict `HEAD == base == merge-base == origin/main` contract remains the
default. Omitting approved-baseline parameters cannot authorize any local
commit ahead of `origin/main`.

## Approved local-baseline authorization

A separate fail-closed path permits one exact, controller-approved local
baseline commit. It is enabled only when both of these are supplied:

- `-ApprovedBaselineAuthorizationPath`
- `-ApprovedBaselineAuthorizationSha256`

The schema-version-1 authorization has exactly these properties:

- `schema_version`, `receipt_id`, `recorded_at_utc`, and `repository_root`;
- `approved_baseline_sha`, `approved_parent_sha`,
  `local_origin_main_sha`, `live_remote_origin_main_sha`, and
  `merge_base_sha`;
- `baseline_commit_receipt_path` and
  `baseline_commit_receipt_sha256`;
- `exact_commit_patch_path` and `exact_commit_patch_sha256`;
- `active_session_inventory_path` and
  `active_session_inventory_sha256`;
- `secret_path_inventory_path` and `secret_path_inventory_sha256`.

Missing, extra, malformed, stale, future-dated, mismatched, duplicated, or
ambiguous values close the run before launch. The authorization itself is bound
by the caller-supplied SHA-256 and must reside under the controller allowed root
`C:\tmp`, outside the unique per-run `ControllerRoot`, which must remain absent
before launch.
Its baseline receipt, exact patch, active-session inventory, and secret-path
inventory are independently rehashed and schema-validated.

This path is intentionally not general ahead-of-origin permission. The
approved HEAD must equal the caller base and the authorization SHA. Its actual
first parent must equal the approved parent, and that parent must equal both
local and freshly receipted live `origin/main`. The actual merge-base must be
`origin/main`, the exact approved commit must descend from it, and the baseline
receipt must prove exactly one local commit ahead with no push. The patch header
and hash must bind that same commit.

The target must be a registered, clean linked worktree. It cannot be the
primary checkout, a declared active-session path or branch, or a path with an
ambiguous reparse chain. Run and controller roots must be unique and absent.
The controller root is outside the worker worktree under `C:\tmp`.

## Explicit legacy sandbox boundary

Codex configuration precedence permits a project or global `sandbox_mode` to
displace named permission profiles. Phase 1 therefore does not use
`default_permissions`, `[permissions]`, `-P`, or a named profile.

Every executor launch explicitly uses:

```text
--sandbox workspace-write
--ask-for-approval never
-c windows.sandbox="unelevated"
-c sandbox_workspace_write.network_access=false
```

No `--add-dir` is supplied. Apps, plugins, subagents, web search, MCP servers,
and shell network access are disabled. Credential-like environment names are
removed from the subprocess environment. `EXECUTOR_CONFIG.json` records the
exact arguments, empty additional-writable-root list, disabled MCP inventory,
Codex binary path, version, and SHA-256.

`workspace-write` is a worktree boundary, not a hard exact-file ACL. Exact-path
control is defense in depth: a dedicated worktree, project rules, protected
surface preflight, exact baselines, full tracked/untracked/ignored postflight,
staging rejection, JSONL command audit, and controller acceptance.

Command-text forbidden-path auditing is detection and evidence. It is not a
hard Windows per-file deny-read boundary, and it can assess only paths that are
materialized in the preserved command text.

## Ignored and protected surfaces

Before launch, the controller records every ignored file outside only these
generated-artifact roots:

- `.tmp`
- `.next`
- `coverage`
- `playwright-report`
- `test-results`

Each ignored file is bound by path, byte count, and SHA-256. The same inventory
is recomputed after exit. Unexpected ignored additions, removals, or content
changes are included in changed-path acceptance and close RED.

`node_modules` is not treated as an exemption. Git traversal is suppressed to
avoid entering a shared junction; the controller instead compares exact
existence, link type, and target metadata before and after. It never deletes or
replaces the junction. The controller also proves `.env.local` absent before
and after and separately rejects changes under `.codex`, `wiki`, `.env`,
`node_modules`, applied migrations, and `src/data` protected prefixes.

## Structured worker evidence

Production workers must write plain-ASCII schema-version-2 artifacts under the
run root:

- `RUN_STATE.json`
- `COMMAND_LOG.json`
- `HEARTBEAT.json`
- `RESUME_PROMPT.md`
- `GATE_RESULTS.json`
- `FORBIDDEN_ACTION_ATTESTATION.json`

JSON objects must contain exactly the contract-defined properties and bind the
unique run ID and controller contract SHA-256. Missing properties, extra
properties, wrong types, stale or contradictory timestamps, inconsistent
states, or a true forbidden-action boolean close RED.

Worker attestations are claims, not acceptance evidence. The controller hashes
every worker artifact and writes `EVIDENCE_AUDIT.json`.

## Runtime command audit

The executor runs `codex exec --json`. Stdout is preserved as
`CODEX_EVENTS.jsonl`; stderr is separate. The controller parses every nonempty
JSONL line, requires lifecycle completion, inventories every command event,
and hashes commands and outputs. Completed, failed, and denied events are all
audited.

Every canonical active worktree from the validated active-session inventory
and every canonical path from the validated secret-path inventory is a
forbidden runtime target. Matching is Windows case-insensitive and covers
forward or back slashes, quotes, descendants, and ordinary `\\?\` aliases. A
reference closes RED even if policy denied the command or the command failed.
Targets come only from controller-authenticated inventories; an unrelated
outside governance path such as `C:\Projects\CLAUDE.md` is not classified by
location alone.

Target-bearing command text is redacted from `COMMAND_AUDIT.json`. The
controller preserves the command SHA-256, output SHA-256, event type, status,
exit code, target kind, target-path SHA-256, and match kind. Raw JSONL remains
controller-owned evidence; acceptance summaries do not reproduce command
output or secret contents. The controller also rejects a forbidden command
that reaches execution.
A real positive canary may make one direct `git status --short` probe; it is
accepted only when JSONL independently proves the project rule denied it and
contains the rule's exact justification.

`COMMAND_AUDIT.json` and `EVIDENCE_AUDIT.json` are controller-owned. A worker
cannot reach READY_FOR_REVIEW through its own attestation alone.

## Ordered production gates

The production contract encodes exactly:

1. `npm run lint`
2. `npx tsc --noEmit`
3. `npm run test:ci`
4. `npm run build:monitored:clean -- -TimeoutSeconds 360 -PollSeconds 10`
5. `npm run test:e2e`
6. `npm run docs:gate`

Raw `npm run build` is forbidden. Missing, failed, timed-out, skipped, or
vacuous gates are not PASS. Each executed gate binds its command, UTC start and
completion timestamps, integer exit status, timeout/vacuity booleans, and every
preserved log's relative path, byte count, and SHA-256. After the first FAIL,
all later gates must be structurally honest NOT_RUN entries.

Coverage, build logs, gate logs, Playwright output, and test artifacts are
preserved.

## Deterministic and real canaries

The deterministic harness proves:

- primary, active-session, dirty, and pin-drift refusal;
- stale, hash-mismatched, and ambiguous Mission Control receipt refusal;
- the unchanged strict origin-main pin path;
- a valid approved one-commit local baseline;
- stale, malformed, mismatched, arbitrary-ahead, wrong-parent, remote-drift,
  baseline-receipt-hash, active-inventory-hash, and secret-inventory-hash
  authorization refusal;
- pure Windows path matching for case, slash, quote, descendant, and canonical
  alias variants;
- safe no-target events and synthetic forbidden active/secret events in
  completed, failed, and denied states;
- direct, absolute, and indirect forbidden policy matches;
- explicitly unmatched safe commands remain unmatched;
- the explicit legacy sandbox arguments contain no named profile or additional
  writable root;
- missing structured evidence and missing JSONL close RED.

Optional real canaries require two separately created clean disposable
`C:\tmp` worktrees on `test/codex-*` branches. They run the real Codex executor
under native foreground cell custody:

- Positive: the one allowed file is written, direct Git is denied by the real
  project rule layer, JSONL proves the denial, and controller acceptance reaches
  READY_FOR_REVIEW.
- UnexpectedEdit: the real executor writes an additional unexpected file and
  controller acceptance closes RED even when worker receipts claim completion.

All canary worktrees, controller roots, run roots, JSONL, and receipts are
preserved. No cleanup or process termination is performed.

## Usage

Run `-PrepareOnly` first with a fresh hash-bound Mission Control receipt:

```powershell
pwsh -NoLogo -NoProfile -File `
  .\tools\codex\Invoke-SstacAutonomousExecutor.ps1 `
  -WorktreePath '<absolute-clean-worktree>' `
  -ExpectedBranch '<exact-branch>' `
  -BaseSha '<40-character-sha>' `
  -OriginMainSha '<same-remote-sha>' `
  -RunRoot '<unique-worktree-local-run-root>' `
  -ControllerRoot '<unique-C:\tmp-controller-root>' `
  -MissionControlReceiptPath '<absolute-receipt-path>' `
  -MissionControlReceiptSha256 '<64-character-sha256>' `
  -AllowedPath '<exact-relative-file>' `
  -PromptSourcePath '<absolute-ASCII-prompt>' `
  -PrepareOnly
```

Review `PREFLIGHT.json`, `CONTRACT.json`, `EXECUTOR_CONFIG.json`, ignored-surface
receipts, initial status, and the resolved prompt before launch. A non-prepare
launch must stay in the foreground and be supervised through the platform's
native yielded cell. Retry budget is zero.

For an approved local baseline, use the same command plus the two explicit
authorization parameters. `-BaseSha` is the approved local commit and
`-OriginMainSha` remains the freshly verified remote SHA:

```powershell
  -ApprovedBaselineAuthorizationPath '<absolute-controller-authorization>' `
  -ApprovedBaselineAuthorizationSha256 '<exact-authorization-sha256>'
```

The deterministic harness now also requires a separate clean approved-baseline
canary worktree plus the approved SHA, parent SHA, baseline commit receipt, and
exact patch. Its pure non-Git runtime audit can be run independently:

```powershell
.\tools\codex\Test-SstacAutonomousExecutor.ps1 -PureRuntimeAuditOnly
```

READY_FOR_REVIEW is not GREEN. Mission Control independently reviews the exact
diff, command audit, evidence audit, changed paths, pins, gates, artifacts,
final status, and forbidden-action evidence.
