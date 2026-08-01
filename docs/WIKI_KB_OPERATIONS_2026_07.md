# SSTAC-Dashboard KB Wiki / Graphify -- OPERATIONS RUNBOOK (2026-07)

Status: AUTHORITATIVE operations reference for the Phase 4-7 KB/wiki/Graphify system (built
2026-07-22 under the owner's Phase 4-7 completion mandate, superseding the earlier Phase 3.5
STOP-HERE posture). Plan authority: `~/.claude/plans/jolly-marinating-piglet.md` sections 5-8;
reference implementation: OpenHarness-dev (bugs fixed during port, not copied -- see section 8).

## 1. What is ENABLED NOW vs MANUAL vs INTENTIONALLY OFF

| Surface | State | Notes |
|---|---|---|
| Deterministic pipeline (graph build, docs-trust scope, compile, lint, secrets scans, smoke) | ENABLED (on-demand) | end-to-end GREEN on a from-scratch cycle 2026-07-22 |
| Docs semantic TRUST FILTER (default-deny + generated overlay) | ENABLED | `gen_docs_scope.py --emit-overlay`; overlay absent => zero md in scope |
| Session hooks (bootstrap, freshness advisory, graphify nudge) | ENABLED via tracked `.claude/settings.json` | all advisory, exit-0-always, 5-10s timeouts, `SSTAC_WIKI_HOOKS_OFF=1` kill-switch |
| Ollama semantic extraction (label + extract + promotion) | GATED-OFF until the standing block exists | `C:\Projects\OLLAMA_STANDING_BLOCK_SSTAC_WIKI.md` absent => every Ollama step auto-skips (fail-soft); creating it is an OWNER action (section 4) |
| Nightly scheduled task `SSTAC-Wiki-Nightly` (05:30) | NOT REGISTERED -- registration is OWNER-RUN | `tooling\wiki\register_wiki_nightly_task.ps1` is DRY-RUN by default; invoke it from the selected canonical runtime so the /TR path is right |
| Watchdog task | NOT REGISTERED (same owner-run pattern) | `tooling\wiki\wiki_watchdog.ps1`; register like the nightly if wanted |
| graphify MCP server | AVAILABLE + VERIFIED, NOT registered | live stdio JSON-RPC handshake verified against graphifyy 0.9.17 on 2026-07-22; register AFTER the first served wiki exists (section 5) |
| Committed `wiki/` output | OFF (gitignored) | graduation criteria unmet (zero counted nightly receipts); revisit per plan Phase 7 streak math |
| `-AutoCommit` | OFF, never passed | unattended commits need an explicit recorded owner ruling first |
| Post-commit git hook | INTENTIONALLY ABSENT | 82-worktree shared `.git/hooks` = orphan-process factory; the nightly N0 asserts it stays absent |

## 2. Daily operation

- On-demand rebuild (canonical runtime root): `/sync-wiki` skill, or
  `powershell -File tooling\wiki\sync_wiki.ps1 -Stamp <yyyy-MM-dd>`. This path runs the SAME
  Phase 4 gates as the nightly: docs scope + trust overlay regeneration first (fail-closed),
  then guarded build, graph smoke, graph-output secrets scan, staging compile/lint/scan, and a
  rollback-safe served-package swap. A successful run publishes `wiki\.graph\graph.json` and
  `wiki\.build-stamp` together while preserving Manual Notes, promotion state, and contradiction
  state.
- Graph closure and portability: immediately after every identity- or edge-producing
  Graphify mutation, and before promotion or publication identity consumers, the
  repository canonicalizer removes only the exact current absolute runtime-root
  encoding, then rebuilds every edge-only reference as an explicit concept node
  with current edge-derived provenance. It never drops edges. Canonical nonempty
  `hyperedges[].nodes` members are remapped and must also resolve to declared nodes;
  ambiguous aliases, malformed hyperedges, undeclared members, and runtime-derived
  member IDs fail closed. Graph smoke requires portable IDs and closure while
  preserving legitimate non-materialized declared isolates. A prior synthetic
  endpoint community is preserved only when genuine-node community population is
  already complete; deterministic graphs remain wholly unpopulated until clustering.
- Full nightly pipeline manually: `powershell -File tooling\wiki\nightly_wiki_sync.ps1`
  (steps N0-N7; receipt at `.tmp_wiki_nightly\receipt-<date>.md`; transcript alongside).
- Freshness: `powershell -File tooling\wiki\check_nightly_freshness.ps1` (exit 1 = stale >48h).
- Legacy orphan report: `powershell -File tooling\wiki\check_orphans.ps1` (report-only;
  it is not Contract A process-custody proof). The run-bound custody modes are wrapper-only.
- Guardrail self-test: `powershell -File tooling\wiki\guardrail_smoke.ps1`.
- Sessions read ONLY the SERVED set: `wiki\` pages, `wiki\.graph\graph.json`,
  `wiki\.build-stamp`. `graphify-out\` is the pipeline-internal working copy -- never read it
  from session-facing tools.
- Config: `tooling\wiki\wiki_nightly_config.json` (model, timeouts, expiries, freshness
  threshold, and exact serve-gate remote/branch). Edit via gated PR only.

### Owner activation preflight (no activation)

Before any owner-run scheduler or local MCP registration step, run this command from the selected
canonical runtime:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tooling\wiki\activation_preflight.ps1
```

The preflight is read-only: it does not fetch, register tasks, add or remove MCPs, invoke Ollama,
alter standing blocks, or delete locks. Structural graph checks apply in every
  scheduler phase: unique node IDs, declared edge and canonical hyperedge members,
  portable IDs, and legitimate non-materialized isolate preservation.
  Communities may be wholly absent after deterministic `--no-cluster`; partial
  population is invalid, and accepted manual or natural nightly proof requires
  complete non-negative integral JSON numeric community population with at least
  one distinct label. Numeric strings, floats, booleans, and negative values fail
  closed. `RESULT READY` requires a clean tracked runtime, Graphify 0.9.17, a served
  graph with nodes and links, a build stamp matching `HEAD`, and `HEAD`
matching the configured remote-tracking ref. If scheduler or MCP entries already exist, they must
match the expected command shape for the selected runtime. Resolve FAIL before activation and
resolve material UNKNOWN checks manually.

### Canonical runtime and detached worktrees

- The default canonical runtime is `C:\Projects\SSTAC-Dashboard`. To use a dedicated worktree,
  set user environment variable `SSTAC_WIKI_RUNTIME_ROOT` to its absolute root before starting
  consuming sessions. Session bootstrap and graphify nudge hooks then read that runtime instead of
  a stale main-checkout wiki.
- A dedicated runtime may be detached. Branch name is not trusted: N1 fetches exactly the
  configured remote/branch from `wiki_nightly_config.json` and records its OID; N6 serves only
  when `HEAD`, the remote-tracking ref, and that same-run fetched OID still match.
- Before registering or manually running nightly, advance the detached runtime to the desired
  remote commit and verify a clean tracked tree. If the remote advances later, nightly keeps the
  last-good served wiki until an operator advances runtime `HEAD`.
- The registration script records the wrapper path from the checkout where it is invoked. Inspect
  its dry-run output. Task registration remains an owner action; this runbook does not authorize
  `-Apply`.
- One machine must use one canonical consumer root. Do not schedule a detached runtime while
  leaving hooks or future MCP registration pointed at the main checkout.

## 3. Docs-trust scope (Phase 4)

- Root `.graphifyignore` keeps a DEFAULT-DENY `*.md` blanket. The registered docs set is
  re-admitted per run by the GENERATED `docs\.graphifyignore` negation overlay
  (`python tooling\wiki\gen_docs_scope.py --repo-root . --out graphify-out\docs_scope.json
  --emit-overlay`). Overlay absent => no md in scope (fail-closed).
- Registration = referenced in `docs/INDEX.md` or `docs/_meta/docs-manifest.json`. Hard-excluded
  regardless of registration: any `archive`/`_archive` path segment, `*.pre-*`, root md (except
  README), agent-surface dirs, `wiki/`, and the SENSITIVE_DOCS list in `gen_docs_scope.py`
  (currently `docs/ENVIRONMENT_REFERENCE.md` -- it re-emits credential MARKERS into compiled
  pages and trips the secrets scan; verified live).
- A scope change forces a full rebuild via the config-hash sentinel
  (`graphify-out\.scan_config_hash`).
- Compiled pages are ASCII-sanitized at write time (`wiki_compile.py ascii_sanitize`) -- legacy
  non-ASCII in source docs cannot fail the wiki lint.

## 4. Ollama / semantic tier (owner enablement path)

1. The third-lane REQUEST file is at `C:\Projects\HITL_OLLAMA_THIRD_LANE_REQUEST_2026-07-22.md`
   (lane `sstac-wiki`, scheduled-only 05:30, model qwen3:14b). OWNER APPROVES by creating
   `C:\Projects\OLLAMA_STANDING_BLOCK_SSTAC_WIKI.md` (lane, window, model -- per
   OLLAMA_SCHEDULE_PROTOCOL.md section 2.5/third-lane rules).
2. Every Ollama call path goes through `tooling\wiki\ollama_lock.ps1`: full 4-clause preflight
   (standing block, drift-log scan, peer-lock liveness-first, /api/ps fail-closed), CreateNew
   acquire, declare-before-call (mandatory -- acquisition rolls back if the drift row cannot be
   written), ownership-checked release, MANUAL_HOLD on GPU-orphan risk.
3. FIRST semantic pass (standalone, 2-5h): owner declares a reserved block in
   `OLLAMA_SCHEDULE_<date>.md`, then
   `powershell -File tooling\wiki\semantic_extract.ps1 -TimeoutSec 14400 -LockExpiryMinutes 270`.
   Exit codes: 0 ok / 1 fail / 3 lock-unavailable / 124 hard timeout. Promotion runs ONLY from
   the nightly N5 (single-invocation rule); after a standalone pass run
   `python tooling\wiki\promotion.py --graph graphify-out\graph.json --state
   wiki\.graph\promotion.json --commit <short-sha> --report` explicitly.
4. MANUAL_HOLD recovery: a lock whose `process_id` is non-numeric is NEVER auto-reclaimed.
   Owner: verify GPU idle (`nvidia-smi`, `ollama ps`), then delete `C:\Projects\OLLAMA_ACTIVE.lock`
   and clear the `HITL_OLLAMA_GPU_ORPHAN_SSTAC_*.md` marker.

## 5. MCP registration (after the first served wiki exists in the canonical runtime)

Verified available (live stdio handshake, 2026-07-22). Register LOCAL scope only (a project
.mcp.json would propagate to worktrees where the venv/graph do not exist):

```powershell
$runtimeRoot = if ($env:SSTAC_WIKI_RUNTIME_ROOT) {
    (Resolve-Path -LiteralPath $env:SSTAC_WIKI_RUNTIME_ROOT).Path
} else {
    'C:\Projects\SSTAC-Dashboard'
}
claude mcp add --scope local graphify -- `
    (Join-Path $runtimeRoot '.venv-graphify\Scripts\python.exe') `
    -m graphify.serve (Join-Path $runtimeRoot 'wiki\.graph\graph.json') --transport stdio
```

Smoke after registration: `graph_stats`, `get_node` on a known module, one `query_graph`.
NOTE: requires `.venv-graphify` provisioned in the canonical runtime
(`python -m venv .venv-graphify; .venv-graphify\Scripts\pip install -r
tooling\wiki\requirements-graphify.txt`).

## 6. Disable / rollback (all reversible, no data loss)

- Instant global hook disable: set `SSTAC_WIKI_HOOKS_OFF=1` (user env var) -- every hook becomes
  a silent no-op. Or delete `.claude/settings.json` (nothing else reads it).
- Unregister nightly/watchdog: `schtasks /Delete /TN "SSTAC-Wiki-Nightly" /F` (and the watchdog
  task name if registered).
- Remove MCP: `claude mcp remove graphify`.
- Full teardown: the untracked outputs (`wiki\`, `graphify-out\`, `wiki.staging\`,
  `.venv-graphify\`, `docs\.graphifyignore`) can be deleted (owner action; they regenerate);
  tracked tooling reverts via normal gated PR.

## 7. From-scratch rebuild + pin upgrade

- From-scratch: delete `graphify-out\` ENTIRELY (the extract cache retains stale content
  otherwise -- verified live 2026-07-22 when a cached AST kept a secrets-marker after its source
  doc left scope), re-run `gen_docs_scope --emit-overlay`, then the guarded full build; the
  config-hash sentinel forces this automatically on scope changes.
- Pin upgrade (graphifyy 0.9.17 -> newer): fresh `.venv-graphify`, re-run in order:
  `guardrail_smoke.ps1`, the from-scratch rebuild, `graph_smoke.py`, `wiki_compile` +
  `wiki_lint` + both secrets scans, the MCP handshake probe, and the python test suite
  (`python -m unittest discover -s tooling\wiki\tests`). Rollback pin: 0.9.6 (documented).

## 8. Port provenance (OHD -> SSTAC; what was deliberately changed)

- OHD bugs FIXED not copied: (1) double promotion invocation (sync_wiki + semantic_extract) ->
  single invocation in nightly N5 only; (2) bare CreateNew lock with no protocol preflight ->
  full 4-clause preflight helper (`ollama_lock.ps1`), mandatory declaration with rollback,
  ownership-checked release; (3) hardcoded model in two scripts -> `wiki_nightly_config.json`;
  (4) branch-name-only serve gating -> exact configured remote-branch fetch attestation.
- SSTAC additions OHD lacks: docs-trust overlay mechanism (`.graphifyinclude` is dead code in
  graphifyy 0.9.17 -- verified -- so gitignore negation overlay is used instead); staging-dir
  compile + rollback-safe served-package swap (sessions never see partial builds; Manual Notes,
  promotion state, and contradiction state survive); canonical runtime routing for hooks; nested-archive +
  SENSITIVE_DOCS hard exclusion; ASCII sanitation at compile; receipts with freshness telemetry;
  register script with dry-run default; watchdog with starvation/staleness markers.
- Schedule: SSTAC 05:30 (KB vault 02:00, OHD 03:30 with worst-case hold ~06:55 -- late OHD
  nights merely skip SSTAC semantic, fail-soft).

## 9. Receipts + verification quick reference

- Nightly receipt: `.tmp_wiki_nightly\receipt-<date>.md` (step statuses, durations, graph
  metrics, promotion +P/-D/~R, freshness block: commits-behind/age vs the configured serve-gate
  remote branch; thresholds >50 commits / >7 days).
- Suite: `python -m unittest discover -s tooling\wiki\tests`.
- Graduation streak math + wiki-commit criteria: plan Phase 7 (unchanged; not yet started --
  the 10-counted-night window begins once the nightly is registered and producing receipts).

## 10. Candidate Contract A scheduler preflight (not installation authority)

This section documents a candidate-only verification interface. It does not authorize task
creation, replacement, execution, or enablement. Contract A uses `Password` logon for true
logged-out operation. Credential entry is an owner-only Task Scheduler action; a password must
never appear in XML candidates, scripts, command lines, logs, receipts, or evidence.

Use owner-recorded exact values for these variables:

```powershell
$runtimeRoot = 'C:\Projects\SSTAC-Dashboard-worktrees\kb-runtime-6bb43b-2026-07-23'
$registrationDate = '<EXACT_REVIEWED_REGISTRATION_DATE>'
$startBoundary = '<EXACT_TIMEZONELESS_LOCAL_YYYY-MM-DDT05:30:00>'
$taskDefinitionId = '<NEW_CANONICAL_GUID_FOR_THIS_EXACT_DEFINITION>'
$proofNotBeforeUtc = '<OWNER_RECORDED_UTC_TIMESTAMP_ENDING_IN_Z>'
$activeTransitionReceipt = '<OWNER_ACCEPTED_IMMUTABLE_ACTIVE_TRANSITION_JSON_PATH>'
$activeTransitionReceiptSha256 = '<EXACT_LOWERCASE_SHA256_OF_ACCEPTED_TRANSITION_BYTES>'
```

The exact read-only phase invocations are:

```powershell
# Replacement installed, task enabled, daily trigger disabled; no execution proof required.
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File "$runtimeRoot\tooling\wiki\activation_preflight.ps1" `
  -RuntimeRoot $runtimeRoot -ExpectedSchedulerContract A `
  -ExpectedSchedulerPhase StagedAwaitingManual `
  -ExpectedStartBoundary $startBoundary -ExpectedRegistrationDate $registrationDate `
  -ExpectedTaskDefinitionId $taskDefinitionId

# Same staged definition after one separately authorized manual execution.
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File "$runtimeRoot\tooling\wiki\activation_preflight.ps1" `
  -RuntimeRoot $runtimeRoot -ExpectedSchedulerContract A `
  -ExpectedSchedulerPhase StagedManualProven `
  -ExpectedStartBoundary $startBoundary -ExpectedRegistrationDate $registrationDate `
  -ExpectedTaskDefinitionId $taskDefinitionId -ProofNotBeforeUtc $proofNotBeforeUtc

# Trigger enabled, but no accepted 05:30-correlated execution yet. This always returns NOT_READY.
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File "$runtimeRoot\tooling\wiki\activation_preflight.ps1" `
  -RuntimeRoot $runtimeRoot -ExpectedSchedulerContract A `
  -ExpectedSchedulerPhase ActiveAwaitingNatural `
  -ExpectedStartBoundary $startBoundary -ExpectedRegistrationDate $registrationDate `
  -ExpectedTaskDefinitionId $taskDefinitionId `
  -ActiveTransitionReceiptPath $activeTransitionReceipt `
  -ExpectedActiveTransitionReceiptSha256 $activeTransitionReceiptSha256

# Trigger enabled after one run correlated to the local 05:30 minute. Provenance remains external.
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File "$runtimeRoot\tooling\wiki\activation_preflight.ps1" `
  -RuntimeRoot $runtimeRoot -ExpectedSchedulerContract A `
  -ExpectedSchedulerPhase Active0530Correlated `
  -ExpectedStartBoundary $startBoundary -ExpectedRegistrationDate $registrationDate `
  -ExpectedTaskDefinitionId $taskDefinitionId -ProofNotBeforeUtc $proofNotBeforeUtc `
  -ActiveTransitionReceiptPath $activeTransitionReceipt `
  -ExpectedActiveTransitionReceiptSha256 $activeTransitionReceiptSha256

# Installed definition intentionally disabled.
powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File "$runtimeRoot\tooling\wiki\activation_preflight.ps1" `
  -RuntimeRoot $runtimeRoot -ExpectedSchedulerContract A `
  -ExpectedSchedulerPhase Disabled `
  -ExpectedStartBoundary $startBoundary -ExpectedRegistrationDate $registrationDate `
  -ExpectedTaskDefinitionId $taskDefinitionId
```

Transitioning from the accepted staged definition to an active definition requires a new
`TaskDefinitionId`. The active task action and its terminal receipts must contain that new ID;
the owner-accepted transition JSON must identify a different canonical prior staged ID, bind the
current active ID, exact registration date, exact start boundary, and activation time, and match
the separately recorded lowercase SHA-256. A receipt from the staged/manual definition cannot
qualify the active phase. Reusing a path with different bytes fails closed.

The proof correlator accepts exactly one terminal receipt whose start is within 60 seconds of
the scheduler `Last Run Time`. The verbose fixture parser intentionally recognizes the English
labels emitted on the reviewed owner machine (`Status`, `Scheduled Task State`, `Last Run Time`,
and `Last Result`). A missing or differently localized label fails closed; it is not evidence
that the task is unhealthy.

Preserved Task Scheduler XML demonstrates the reviewed encoding, namespace, SID-form `UserId`,
and readback shape. Separate synthetic candidate fixtures test semantic equivalence when reviewed
optional fields are omitted. Those synthetic omissions are not represented as preserved exports,
and the list is not an assertion that every field has an XSD default. In particular, omission of
`RunLevel` is a frozen reviewed normalization to `LeastPrivilege`, not an XSD-default claim.
No normalization permits a changed semantic value, extra attribute, extra principal, extra
trigger, executable surface, retry policy, or Task schema version other than 1.4.

Phase verdicts are deliberately limited:

- `READY_FOR_MANUAL_RUN_REVIEW` permits only a separate owner decision about a bounded manual run.
- `READY_FOR_TRIGGER_ENABLE_REVIEW` permits only a separate owner decision about active-definition
  installation and trigger enablement.
- `NOT_READY_AWAITING_NATURAL_RUN` proves no unattended behavior.
- `READY_FOR_OWNER_NATURAL_PROVENANCE_MCP_AND_LOGGED_OUT_GATES` proves only that a run for the
  accepted active definition correlated to the local 05:30 minute. A manual task run at exactly
  05:30 can produce this result. Calendar-trigger provenance, owner-shell MCP health, and accepted
  logged-out operation remain explicit external owner gates.
- `READY_FOR_REPLACEMENT_REVIEW` reports only disabled-definition conformance.

The original no-ID Legacy manual invocation in section 2 remains supported; its zero-definition
terminal receipt is informational and cannot qualify Contract A. The no-argument
`check_orphans.ps1` report is likewise informational and can never satisfy process-custody proof.
For Contract A, the wrapper captures the fail-closed process baseline before workload execution,
binds it to the canonical run ID and its immediate SHA-256, and performs terminal evaluation as
the last child process while the nightly parent remains alive. The terminal receipt contains both
  the top-level process-custody verdict and bounded nested evidence. It also binds
  the run-unique final canonicalization and graph-smoke receipt names, SHA-256 hashes,
  bounded node/link/materialization/community counts, closure status, and hard-abort
  state. Preflight independently rehashes those files and rejects missing, malformed,
  contradictory, truncated, failed, or run/baseline/runtime-mismatched evidence.
The Contract A action remains
exact Windows PowerShell 5.1 with `-RepoRoot` and a nonempty `-TaskDefinitionId`; it never contains
`-AutoCommit`. Successful proof additionally requires exact runtime HEAD/ref/build-stamp
binding, a terminal `SUCCESS` receipt with native exit 0, build/cluster/publication/orphan/serve
gates, terminal process custody, endpoint parity, portable IDs, and populated communities.

### Contract A XML Generation

To generate the exact deterministic XML required for the Contract A staged task:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "$runtimeRoot\tooling\wiki\register_wiki_nightly_task.ps1" `
  -SchedulerContract A `
  -RuntimeRoot $runtimeRoot `
  -RegistrationDate $registrationDate `
  -StartBoundary $startBoundary `
  -TaskDefinitionId $taskDefinitionId `
  -OutputXmlPath "C:\tmp\contract_a_staged.xml"
```

This generation never imports, installs, enables, or executes a task. Credential entry and XML import remain separate owner-only actions.
