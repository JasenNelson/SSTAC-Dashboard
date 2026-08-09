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
| Nightly scheduled task `SSTAC-Wiki-Nightly` (05:30) | REGISTERED + ENABLED; task state last read as `Ready` on 2026-08-06 | Deterministic-only, derived from Contract D but running as an owner-approved `InteractiveToken` EXCEPTION, not strict Contract D (which mandates `Password` logon -- see section 11 and known issue 5 in section 12). CONSEQUENCE: it only fires while the owner is signed in. Durable successful natural-run receipts exist through 2026-08-09; current task state was not reread in this correction lane. The counted streak is canonical only at `facts.wiki_runtime.counted_window` in `docs/_meta/docs-manifest.json`; per-night receipts are in section 12 |
| Watchdog task | NOT REGISTERED (owner-run pattern) | `tooling\wiki\wiki_watchdog.ps1`; if registered, schedule it well clear of 05:30 -- it runs `check_orphans.ps1` with the runtime path in its command line and would otherwise trip the nightly's own custody baseline |
| graphify MCP server | TWO SEPARATE DEFECTS (read-only reverified 2026-08-08): canonical-runtime server cannot START, and the only existing registration points at a SUPERSEDED runtime | (a) In the canonical runtime, `mcp==2.0.0` no longer exports `mcp.types.AnyUrl`, so `graphify.serve` exits 1 (sections 5 and 12). (b) The one registration in `~/.claude.json` (project key `C:/Projects/SSTAC-Dashboard`) targets `kb-runtime-6bb43b-2026-07-23`, NOT the canonical runtime. That venv has `mcp 1.28.1` and DOES start -- so it serves a stale graph rather than failing. These are INDEPENDENT: repairing the canonical venv does not fix the registration. Do NOT add a second registration; the registered non-authoritative repair packet remains `CANDIDATE_UNVERIFIED` |
| Committed `wiki/` output | OFF (gitignored) | graduation criteria unmet; the counted window and semantic count are canonical at `facts.wiki_runtime.counted_window` (do not restate them here), and the semantic >=5/10 criterion remains blocked because every counted night so far ran deterministic-only. Per-night receipts are in section 12. Also blocked by the protected-pathspec interaction (section 12, known issue 2) |
| `-AutoCommit` | OFF, never passed | unattended commits need an explicit recorded owner ruling first |
| Post-commit git hook | INTENTIONALLY ABSENT | 82-worktree shared `.git/hooks` = orphan-process factory; the nightly N0 asserts it stays absent |

The non-authoritative recovery packets
`docs/design/wiki/GRAPHIFY_MCP_REPAIR_PACKET_2026_08_08.md` and
`docs/design/wiki/SEMANTIC_PROMOTION_READINESS_PACKET_2026_08_08.md` are registered as REFERENCE in
the docs manifest. They provide candidate evidence and owner gates only; this runbook and the
manifest remain authoritative.

## 2. Daily operation

- On-demand rebuild (canonical runtime root): `/sync-wiki` skill, or
  `powershell -File tooling\wiki\sync_wiki.ps1 -Stamp <yyyy-MM-dd>`. The wrapper resolves Python
  and, by default, Graphify from that selected runtime's exact
  `.venv-graphify\Scripts\` directory and fails closed if either required executable is absent;
  it never falls back to a bare PATH command. A full non-`-SkipGraph` run regenerates docs scope
  and trust overlay, performs guarded `update . --no-cluster`, canonicalizes and smoke-checks the
  deterministic graph, performs guarded `cluster-only <runtime> --no-label --no-viz`, then runs
  final canonicalization and a final smoke requiring complete communities. Only after exact receipt
  counts, graph-hash binding, graph-output secrets scan, staging compile/lint/scan, and final
  hash-bound preparation may rollback-safe publication swap the served package. Any failed,
  timed-out, orphan-risk, incomplete-cluster, malformed-receipt, hash, or secrets path stops before
  publication. A successful run publishes `wiki\.graph\graph.json` and `wiki\.build-stamp`
  together while preserving Manual Notes, promotion state, and contradiction state.
- `-SkipGraph` skips both update and clustering. It is safe only when an existing
  `graphify-out\graph.json` passes final canonicalization, community-required smoke, exact receipt
  validation, hash binding, secrets scan, and every normal staging/publication gate. It never turns
  a missing, unclustered, or partially populated graph into publishable output.
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

`EvidenceMode`, `ExpectedSchedulerContract`, `ExpectedSchedulerPhase`, and generator
`SchedulerContract` values are case-sensitive. They must use the exact documented spellings;
recased values fail before path resolution, control reads, XML output, or scheduler handling.
`EvidenceMode` is exactly `Live` or `Fixture`; `Live` is the default. Live uses the canonical
runtime configuration, scheduler query/XML, MCP status, Graphify version, standing-block path,
and active-lock path. It rejects `ConfigPath` and every fixture or evidence override. `Fixture`
requires one complete base tuple: an isolated ordinary `RuntimeRoot`, task query text, task XML,
MCP text, Graphify version, standing-block evidence path, and active-lock evidence path. Active
Fixture phases additionally require `ActiveTransitionReceiptPath` and
`ExpectedActiveTransitionReceiptSha256` as one complete pair; non-active Fixture phases reject
either parameter. Every fixture path must resolve below the exact
`SSTAC_WIKI_EXECUTOR_EVIDENCE_ROOT` and the fixture runtime before it is read, and must cross no
reparse point or alternate data stream. An absent standing-block or active-lock leaf is valid only
below an existing ordinary parent. An existing optional leaf must itself be an ordinary file, and
its full ancestor chain must remain ordinary. Missing, partial, mixed, escaping, or malformed
tuples fail before a real scheduler, MCP, version, runtime-pointer, configuration, standing-block,
or lock call. An early invalid or incomplete Fixture invocation ends with `RESULT NOT_READY`.

Both standing-block and active-lock reads use one production exact-literal-path evidence helper.
Its canonical compact ASCII JSON has exactly these ordered fields:

```text
schema_version,evidence_type,path,status,present,error
```

`PASS` requires one boolean `present` value and JSON null `error`. `ERROR` requires JSON null
`present` and one bounded nonempty diagnostic. No value, multiple values, incidental output,
wrong types, missing or extra fields, changed order or casing, contradictions, or changed bytes
fail validation. Immediate validation records the exact JSON bytes and SHA-256. Terminal defense
freshly calls the same exact-path helper for both paths, serializes and hashes each new object, and
requires the fresh object, JSON, hash, status, and presence to match the initial observation.
Owner actions, when any, are printed before exactly one
last `RESULT` line. A complete passing Fixture run ends with `RESULT FIXTURE_NON_ACTIVATION` and
native exit 1. Fixture evidence never grants READY status or activation eligibility.

### Canonical runtime and detached worktrees

- The default canonical runtime is `C:\Projects\SSTAC-Dashboard`. To use a dedicated worktree,
  set user environment variable `SSTAC_WIKI_RUNTIME_ROOT` to its absolute root before starting
  consuming sessions. Session bootstrap and graphify nudge hooks then read that runtime instead of
  a stale main-checkout wiki.
- A dedicated runtime may be detached. Branch name is not trusted: N1 fetches exactly the
  configured remote/branch from `wiki_nightly_config.json` and records its OID; N6 serves only
  when `HEAD`, the remote-tracking ref, and that same-run fetched OID still match.
- The N0 autofollow evaluation checks and repins the runtime `HEAD` to match the configured
  remote-tracking ref. It operates in sequentially gated phases:
  1. Hook-drift and dirty-tree gates run first.
  2. `rev-parse HEAD` validity check (`REFUSED_UNEXPECTED`). Failure or empty stdout -> FAILED / exit 1.
  3. HEAD branch-attachment check (`REFUSED_ATTACHED`). HEAD attached -> FAILED / exit 1.
  4. Git-dir and working tree checks:
     - 4a. Git-dir resolution. Failure or empty stdout -> `REFUSED_UNEXPECTED`, FAILED / exit 1.
     - 4b. Working-tree cleanliness and merge/rebase/cherry-pick/bisect state -> `REFUSED_DIRTY`,
       FAILED / exit 1. All refusals (listed below) terminalize as FAILED / exit 1.
  5. Fetch validity check (`REFUSED_FETCH_FAIL`).
  6. Fast-forward ancestry check (`REFUSED_DIVERGENT`).
  7. The `diff --name-only` protected-pathspec check (`REFUSED_TOOLING_CHANGE`),
     which is the operationally dominant gate.
  8. `ls-tree` enumerates protected paths to build a pre-checkout SHA-256 baseline
     (`REFUSED_UNEXPECTED` / `ls-tree failed or empty`).
  9. Hook suppression setup (`REFUSED_HOOK_SETUP_FAILED`).
  10. Checkout and post-checkout manifest comparison (`REFUSED_REPIN_VERIFY_FAILED`).

  | Decision Value | Autorepin Result | Terminal State | Exit Code | Description |
  | :--- | :--- | :--- | :--- | :--- |
  | `NOT_EVALUATED` | `NOT_RUN` | `FAILED` | 1 | Sentinel value, default state before evaluation. |
  | `REFUSED_UNEXPECTED` | `SKIP` | `FAILED` | 1 | Unexpected Git error, missing configuration, or parsing failure. |
  | `REFUSED_ATTACHED` | `SKIP` | `FAILED` | 1 | HEAD is attached to a branch (must be detached). |
  | `REFUSED_DIRTY` | `SKIP` | `FAILED` | 1 | Working tree dirty or merge/rebase/cherry-pick/bisect in progress. |
  | `REFUSED_FETCH_FAIL` | `SKIP` | `FAILED` | 1 | Fetch failed or returned an invalid OID format. |
  | `REFUSED_DIVERGENT` | `SKIP` | `FAILED` | 1 | Target is not a fast-forward descendant of HEAD (or is a rewind/ancestor). |
  | `REFUSED_TOOLING_CHANGE` | `SKIP` | `FAILED` | 1 | Diff touches protected pathspec (requires manual operator repin). |
  | `REFUSED_HOOK_SETUP_FAILED` | `SKIP` | `FAILED` | 1 | Failed to set up the empty/suppressed hooks directory. |
  | `REFUSED_REPIN_VERIFY_FAILED` | `FAIL` | `FAILED` | 1 | Post-checkout validation checks failed or post-checkout state was dirty. |
  | `ALREADY_CURRENT` | `PASS` | `SUCCESS` / `FAILED` | 0 / 1 | HEAD is already at target_oid. Run continues to N1-N6. |
  | `REPINNED` | `PASS` | `SUCCESS` / `FAILED` | 0 / 1 | Successfully checked out target_oid. Run continues to N1-N6. |

  CRITICAL: `REFUSED_TOOLING_CHANGE` and `REFUSED_DIVERGENT` both terminalize as FAILED
  (exit 1). So every merge to `main` touching `wiki`, `tooling/wiki`, `.gitignore`,
  `.graphifyignore`, `AGENTS.md`, `.gitattributes`, or `tooling/.gitattributes` hard-fails the nightly run, every
  night, until manual repin. (Do NOT read this as a severity increase over pre-#771: a stale pin
  ALSO hard-failed the night then -- receipt `f7db140f` shows `serve_gate=FAIL`, exit 1,
  `terminal_state=FAILED` AND `SERVED_WIKI_KEPT_LAST_GOOD`. Both regimes fail the night and leave
  the last-good package served; the only change is that the run now stops at N0 instead of the N6
  serve gate. See section 12, known issue 2.) To
  remediate a tooling-change failure, the operator must manually repin: fetch, then run
  `git -C <runtime> checkout --detach <reviewed oid>`, and then rebuild the wiki.
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

1. The formerly named third-lane request
   `C:\Projects\HITL_OLLAMA_THIRD_LANE_REQUEST_2026-07-22.md` is absent as of the 2026-08-08
   read-only check. No current request or model/window authority may be inferred from this runbook;
   the owner must select and approve a superseding coordination artifact. OWNER APPROVES by creating
   `C:\Projects\OLLAMA_STANDING_BLOCK_SSTAC_WIKI.md` (lane, window, model -- per
   OLLAMA_SCHEDULE_PROTOCOL.md section 2.5/third-lane rules).
2. Every Ollama call path goes through `tooling\wiki\ollama_lock.ps1`: full 4-clause preflight
   (standing block, drift-log scan, peer-lock liveness-first, /api/ps fail-closed), CreateNew
   acquire, declare-before-call (mandatory -- acquisition rolls back if the drift row cannot be
   written), and observed release evidence. Release ownership must match lane, session, owner PID,
   and scheduled block. Normal release is successful only after terminating deletion, absence
   readback, and the terminal drift row. MANUAL_HOLD is successful only after exact hold readback,
   GPU-orphan marker creation, and the MANUAL_HOLD drift row. Missing, mismatched, failed, or
   contradictory release evidence is red; selected release intent is never reported as observed
   disposition.
3. FIRST semantic pass (standalone, 2-5h): owner declares a reserved block in
   `OLLAMA_SCHEDULE_<date>.md`, then
   `powershell -File tooling\wiki\semantic_extract.ps1 -TimeoutSec 14400 -LockExpiryMinutes 270`.
   Exit codes: 0 ok / 1 fail / 3 lock-unavailable / 124 = hard timeout or explicit GPU-orphan/custody risk. Promotion runs ONLY from
   the nightly N5 (single-invocation rule); after a standalone pass run
   `python tooling\wiki\promotion.py --graph graphify-out\graph.json --state
   wiki\.graph\promotion.json --commit <short-sha> --report` explicitly.
4. MANUAL_HOLD recovery: a lock whose `process_id` is non-numeric is NEVER auto-reclaimed.
   Owner: verify GPU idle (`nvidia-smi`, `ollama ps`), then delete `C:\Projects\OLLAMA_ACTIVE.lock`
   and clear the `HITL_OLLAMA_GPU_ORPHAN_SSTAC_*.md` marker.

Semantic and label graph mutations have one common post-N5 `graphify-out` secrets scan after the
final graph mutator and before promotion or publication. LABEL_ONLY, SEMANTIC_ONLY, and
LABEL_AND_SEMANTIC require an exact exit 0 from that scan. SKIP_ALL and lock-unavailable runs with
no mutation record the scan as NOT_REQUIRED. Semantic success also requires observed wrapper exit
0, graphify exit 0/status OK, no timeout, no guardrail or orphan risk, and redirect cleanup status
REMOVED with an empty cleanup error.

Redirected graphify stdout/stderr files are security-sensitive temporary evidence. Either
PARTIAL_REMOVAL_FAILED or REMOVAL_FAILED is an auxiliary guardrail failure. Residue preserves an
existing nonzero child exit or timeout 124; otherwise it forces exit 1. Residue alone does not set
OrphanRisk, request MANUAL_HOLD, or create a GPU-orphan marker. Standalone and nightly callers use
an observed normal COMPLETED_RED release for residue-only failure and block promotion,
compilation, publication, and terminal success.

Timeout cleanup terminates only the exact retained root `Process` object. `Killed` remains false,
and descendant termination is unproven without a Windows Job Object. The root-only termination
evidence is fail-closed custody evidence; by itself, it is not eligible evidence for unattended
scheduling.

## 5. MCP registration (after the first served wiki exists in the canonical runtime)

Verified available (live stdio handshake, 2026-07-22). Register LOCAL scope only (a project
.mcp.json would propagate to worktrees where the venv/graph do not exist).

WARNING -- `--scope local` binds to the CURRENT project namespace in `~/.claude.json`, and this repo
already has several colliding namespace keys (see the third caution below). Running the bare `add`
below from a different directory than the existing entry's key would create a SECOND `graphify`
entry rather than replacing the stale one, leaving the false-healthy registration intact. Do a
namespace-bound REPLACEMENT instead: remove/update the entry under the key that currently holds it
(`C:/Projects/SSTAC-Dashboard`), add the canonical target under the one namespace you intend to
keep, then verify exactly ONE `graphify` entry exists across all keys:

```powershell
$h = Get-Content "$env:USERPROFILE\.claude.json" -Raw | ConvertFrom-Json -AsHashtable
($h.projects.Keys | Where-Object { $h.projects[$_].mcpServers.ContainsKey('graphify') })  # expect exactly 1
```

The same namespace caveat applies to any `claude mcp remove` in the rollback section -- scope it to
the key that actually holds the entry, then re-verify the count.

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

BLOCKED as of 2026-08-06: a registration against the CANONICAL runtime cannot currently work (for
the separate stale-registration problem, see the third caution below). The canonical `.venv-graphify` has
`mcp==2.0.0`, whose `mcp.types` no longer exports `AnyUrl`; graphify 0.9.17 `serve.py` requires it, so
`python -m graphify.serve` exits 1. The 2026-07-22 handshake above predates that drift. Root cause
and the deferred fix are in section 12.

Three cautions when checking this (all verified 2026-08-06):

- **Do not probe with `--help` or a bare import.** `python -c "import graphify.serve"` and
  `python -m graphify.serve --help` BOTH exit 0. `serve.py` does the `from mcp.types import AnyUrl`
  INSIDE `_build_server`, not at module scope, so nothing fails until a server is actually
  constructed. The error it then raises,
  `ImportError: mcp not installed. Run: pip install "graphifyy[mcp]"`, is misleading -- `mcp` IS
  installed, at the wrong major -- so do not act on it literally.
- **Judge the real probe by EXIT CODE, not by process liveness.** Start it for real
  (`python -m graphify.serve <graph.json> --transport stdio`) and check for exit 1 plus the
  `mcp not installed` traceback on stderr. Do NOT use "the process stays alive" as the pass
  criterion: under stdio with no stdin attached, a correctly-working server also terminates promptly
  on EOF, so "it exited" would read as failure even after the fix lands. Broken = exit 1 with that
  ImportError traceback. A clean exit 0 with no traceback only clears THIS specific `AnyUrl`
  startup-compatibility failure -- treat it as an `AnyUrl startup check`, NOT as "healthy". It does
  not demonstrate MCP initialization, tool registration, or working graph queries. Reserve "healthy"
  for a real MCP client attaching over stdio plus the documented tool smoke below
  (`graph_stats`, `get_node`, one `query_graph`).
- **A registration already exists, and it points at a SUPERSEDED runtime -- it does not fail, it
  serves stale data.** `claude mcp add` was run in an earlier session, and `~/.claude.json` carries a
  `graphify` entry under project key `C:/Projects/SSTAC-Dashboard`. Verified 2026-08-06, it targets:

  ```
  command: ...\kb-runtime-6bb43b-2026-07-23\.venv-graphify\Scripts\python.exe
  args:    -m graphify.serve ...\kb-runtime-6bb43b-2026-07-23\wiki\.graph\graph.json --transport stdio
  ```

  That is NOT the canonical runtime. Its venv has `mcp 1.28.1` (which DOES export `AnyUrl`) and the
  server starts cleanly, but its graph is from build stamp 2026-07-30 at HEAD `d298f548`
  (`graph.json` = `b105d670...`) versus the canonical 2026-08-06 / `a821e519` (`f8331a34...`). So
  anyone attaching to it gets confident answers from a stale graph -- a FALSE-HEALTHY outcome, which
  is more dangerous than an outright failure.

  **These are two independent defects.** Repairing the canonical runtime's `.venv-graphify` does
  NOTHING for this registration; re-pointing or removing the registration does NOTHING for the venv.
  Fix them separately, and do not treat either as done because the other was.
  Beware the separator/case collision: `~/.claude.json` currently holds FOUR distinct ROOT project
  keys for this one repo -- `C:/Projects/SSTAC-Dashboard` (the one carrying the `graphify` entry),
  `C:/Projects/sstac-dashboard`, `C:\Projects\SSTAC-Dashboard`, and `C:/projects/sstac-dashboard`
  (plus several further keys under `...\.claude\worktrees\`). They differ by path separator AND
  case, and each is a separate config namespace, so this entry is invisible from the other three.
  Remove or re-point it INDEPENDENTLY of the venv fix; a registration that silently serves a stale
  graph is worse than none.
  (Because of those colliding keys the file must be parsed with `ConvertFrom-Json -AsHashtable`;
  plain `ConvertFrom-Json` throws.)

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
  (`python -m unittest discover -v -s tooling\wiki\tests`). Rollback pin: 0.9.6 (documented).

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
- Suite: `python -m unittest discover -v -s tooling\wiki\tests`.
- Graduation streak math + wiki-commit criteria: plan Phase 7. The 10-counted-night window has
  STARTED. Do NOT restate the count here -- it is canonical only at
  `facts.wiki_runtime.counted_window` in `docs/_meta/docs-manifest.json`, with the per-night
  receipts in section 12. Every counted night so far records semantic SKIPPED, so the window
  cannot satisfy `semantic ran >=5/10 nights` under deterministic-only Contract D, and Phase 7
  remains NOT READY regardless of how many deterministic nights accumulate.

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

## 11. Candidate Contract D deterministic-only scheduler preflight

Contract D is a sibling of Contract A and does not change Contract A behavior. Generation is
dry-run only and refuses both `-Apply` and `-Unregister`. It uses the same exact task identity,
fresh canonical definition ID, local daily 05:30 boundary, `Password` logon,
`LeastPrivilege`, one disabled daily trigger, Contract A settings, and `PT6H` limit. Its exact
description is:

```text
SSTAC Wiki nightly candidate D: deterministic-only network-capable run; label and semantic disabled. Staged with the daily trigger disabled.
```

Its exact action is the absolute Windows PowerShell 5.1 executable followed by exactly:

```text
-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "<runtime>\tooling\wiki\nightly_wiki_sync.ps1" -RepoRoot "<runtime>" -TaskDefinitionId "<id>" -SkipLabeling -SkipSemantic
```

The two skip flags are inseparable and ordered. A missing, single, duplicate, reversed, recased,
or extra flag, `-AutoCommit`, a relative host, changed working directory, changed definition ID,
or Contract A/D cross-use fails closed. Generate a staged candidate with:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "$runtimeRoot\tooling\wiki\register_wiki_nightly_task.ps1" `
  -SchedulerContract D `
  -RuntimeRoot $runtimeRoot `
  -RegistrationDate $registrationDate `
  -StartBoundary $startBoundary `
  -TaskDefinitionId $taskDefinitionId `
  -OutputXmlPath "C:\tmp\contract_d_staged.xml"
```

Contract D remains network-capable only because the existing N1 serve gate fetches the configured
remote. N5 is exactly `SKIP_ALL`: no label, semantic extraction, Ollama lock, Ollama call, GPU,
promotion mutation, or N5 post-mutation scan occurs. The terminal JSON adds these ordered typed
decision fields:

```text
n5_mode,n5_skip_labeling,n5_skip_semantic,n5_run_label,n5_run_semantic,n5_lock_expiry_minutes,n5_mutation_attempted,semantic_execution_attempted,n5_release_required
```

A Contract D success requires exact values `SKIP_ALL`, true, true, false, false, 0, false, false,
false; `n5_semantic=SEMANTIC_SKIPPED_SkipFlags`; post-mutation scan `NOT_REQUIRED`; release
evidence not required; all existing deterministic N0-N4/N6, serve, graph, secrets, and custody
gates; and native exit 0. Manual and natural proof type-check every field and reject nulls,
string booleans, wrong integers, mutations, semantic execution, lock/release activity, or other
contradictions.

The Contract D phase results are:

- Disabled: `READY_FOR_DETERMINISTIC_REPLACEMENT_REVIEW`, exit 0.
- StagedAwaitingManual: `READY_FOR_DETERMINISTIC_MANUAL_RUN_REVIEW`, exit 0.
- StagedManualProven: `READY_FOR_DETERMINISTIC_TRIGGER_ENABLE_REVIEW`, exit 0.
- ActiveAwaitingNatural: `NOT_READY_DETERMINISTIC_AWAITING_NATURAL_RUN`, exit 1.
- Active0530Correlated: `READY_FOR_OWNER_DETERMINISTIC_NATURAL_PROVENANCE_REVIEW`, exit 0.

Every progression still requires attended proof and a separate owner decision. A later reduced-risk
owner exception to enable Contract D would not prove descendant custody: timeout cleanup terminates
only the retained root `Process` object, `Killed` remains false, and descendant termination remains
unproven without a Windows Job Object. This evidence alone is not eligible for unattended
scheduling. The Phase-7 window remains 10 counted nights. Contract D can count toward deterministic
reliability, but it cannot satisfy the separate `semantic ran >=5/10 nights` criterion. Semantic
operation, MCP registration, `-AutoCommit`, committed `wiki/`, task import/enablement, and the
graduation decision remain deferred.

SUPERSEDED IN PART 2026-08-08: task import/enablement is DONE -- `SSTAC-Wiki-Nightly` was registered
and enabled under the owner-approved exception, and durable receipts now establish a counted
natural streak at DAY 3 of 10 through the 2026-08-08 run. IMPORTANT: what was installed is NOT
strict Contract D. The live task uses
`LogonType=InteractiveToken`, whereas the Contract D definition above mandates `Password` and
`activation_preflight.ps1` rejects anything else. It runs as an owner-approved deterministic-only
exception, and therefore only fires while an interactive session exists (section 12, known issue 5).

An MCP registration also already exists, but it targets a superseded runtime, so a WORKING
canonical-runtime MCP registration still remains deferred (sections 1, 5, and 12, known issue 1).
Semantic operation, `-AutoCommit`, committed `wiki/`, and the graduation decision DO remain
deferred.

## 12. Operational state and known issues

EVIDENCE BOUNDARY -- read before citing anything in this section. The observations below are
ACCEPTED THROUGH 2026-08-09; individual claims carry their own verification dates. This section is
NOT a live dashboard, and its heading deliberately carries no "as of" date because the underlying
state changes nightly while this prose does not. Current accepted facts live in
`docs/_meta/docs-manifest.json` under `facts` (`facts.wiki_runtime.counted_window` and
`facts.wiki_runtime.first_repinned` for this lane); `facts_history` is frozen history and is never
current authority. Reverify against the canonical runtime before any operational use.

The 2026-08-09 night HAS been adjudicated against its terminal receipt and IS counted -- see the
streak table below and `facts.wiki_runtime.counted_window`. Accepted evidence therefore runs
THROUGH 2026-08-09.

PROVENANCE CAVEAT, applying to every "natural nightly" row in the table below: calendar-trigger
provenance is NOT receipt-provable. Per section 10, a manual task run at the local 05:30 minute
produces the same correlation a scheduler-fired run does, so the "natural" label rests on an
external owner gate rather than on receipt evidence. It is accepted here on the same basis for the
2026-08-07, 2026-08-08, and 2026-08-09 nights. Every OTHER counting criterion in those rows is
carried by the terminal receipts themselves.

### Runtime state

The runtime now runs the auto-follow wrapper (section 2, "Canonical runtime and detached worktrees").
Merges to `main` that do NOT touch the protected pathspec no longer cost a night. Merges that DO
touch it still hard-fail the night (`REFUSED_TOOLING_CHANGE`, terminal FAILED / exit 1) until an
operator manually repins -- see section 2 and known issue 2 below. Landed by PR #771, squash-merged as
`a821e51968982c0b3dfe2b40e910e9aac1c112c6` (8 files, +1395/-28), which added the guarded in-wrapper
N0 auto-follow. The frozen design and test spec are
`docs/design/wiki/WIKI_RUNTIME_AUTOFOLLOW_BOOTSTRAP_DESIGN_2026_08_05.md`
(sha256 `a46929bd0f06d2ab67f915ffbe3eb283965bb6e447916559528d6d65cffb08f2`) and
`docs/design/wiki/WIKI_RUNTIME_AUTOFOLLOW_BOOTSTRAP_TEST_SPEC_2026_08_05.md`
(sha256 `fd6ac80767a451c59fc24ffac3886ed50395befb50a9daa2bb21f7a777348cdf`).

Motivating incident: on 2026-08-05 the first natural nightly (run `f7db140f`) passed custody, build,
cluster, canonicalization, and smoke, then stopped at `serve_gate=FAIL` because `main` had advanced
via PR #770. Every gate worked; the defect was drift, and each drift night is a lost night against
the Phase 7 10-counted-night window.

### Counted natural streak

| Date / time | Run id | Result |
| :--- | :--- | :--- |
| 2026-08-06 05:30 (natural nightly) | `65672054-2f94-4279-ad10-f424ce9453f5` | PASS. `LastTaskResult 0`; custody PASS / 0 survivors; `serve_gate=PASS`; `SERVED_WIKI_SWAPPED`. COUNTED NATURAL STREAK DAY 1 of 10. |
| 2026-08-06 07:33 (post-merge bootstrap, scheduler-fired) | `14459a28-4f81-437d-afba-329f393fc8cc` | PASS. `autofollow_decision=ALREADY_CURRENT`; `autofollow_attempted=false`; `autofollow_result=PASS`. The `bfa344dd` -> `a821e519` repin was done OUT OF BAND by the one-time bootstrap script (STEP 2, explicit `git checkout --detach`; ephemeral, under `C:\tmp`, not in this repo) BEFORE this run -- which is why the run observed `ALREADY_CURRENT`. Task XML byte-identical before and after: sha256 `484f791453c8b9d6969390480eee8d4c2fac471723c6cfab9a49ff6a4c91b3f4` (recompute with `schtasks /Query /TN SSTAC-Wiki-Nightly /XML ONE \| Out-String` -> `WriteAllText` -> `Get-FileHash`; other serializations give different hashes). |
| 2026-08-07 05:30 (natural nightly) | `3646680a-5dc5-4e0b-b332-ab52d847e874` | PASS. Terminal receipt records `SUCCESS`, native exit 0, custody PASS, `SERVED_WIKI_SWAPPED`, and `autofollow_decision=ALREADY_CURRENT`. COUNTED NATURAL STREAK DAY 2 of 10; semantic skipped. |
| 2026-08-08 05:30 (natural nightly) | `96502ca2-80da-4b27-9716-31f634407ed0` | PASS. Terminal receipt records `SUCCESS`, native exit 0, custody PASS, `SERVED_WIKI_SWAPPED`, and the first production `autofollow_decision=REPINNED`: `a821e519` -> `50d42e0`, attempted true, result PASS, final HEAD/ref/build-stamp all `50d42e0`. COUNTED NATURAL STREAK DAY 3 of 10; semantic skipped. Receipt SHA-256 `469f887fdb22ef3fa54317ef08d9da25ef943c66e8a42b40648357e80c4773b1`. |
| 2026-08-09 05:30 (natural nightly) | `c8df3813-0ea5-4a6e-a28a-7e28c0421b5c` | PASS. Terminal receipt records `SUCCESS`, native exit 0, custody PASS with `survivor_count` 0, `serve_gate=PASS`, `SERVED_WIKI_SWAPPED`, and `autofollow_decision=ALREADY_CURRENT` (`attempted=false`, `result=PASS`) because `origin/main` was still `50d42e0a` at 05:30; head, required-ref, and build-stamp OIDs all `50d42e0a`. Graph 12115 nodes / 23762 links / 687 communities. COUNTED NATURAL STREAK DAY 4 of 10; semantic skipped (`n5_mode=SKIP_ALL`). Terminal receipt SHA-256 `72ad4daf8dafd881e992fdaed51321cfe87df8a29f594dfcb6591e0fe6f83d87`; summary receipt SHA-256 `83c33286be2a00f6d4e528fd78b8709e9c34f5361a5f50c0f884125b4dbd120d`. `ALREADY_CURRENT` here is CORRECT, not a regression from the 2026-08-08 `REPINNED`: there was nothing to follow. |

**The first production `REPINNED` path is now durably proven.** The canonical-runtime terminal
receipt `.tmp_wiki_nightly\terminal-receipt-96502ca2-80da-4b27-9716-31f634407ed0.json` records the
2026-08-08 transition from `a821e519` to `50d42e0`, `autofollow_attempted=true`,
`autofollow_result=PASS`, terminal `SUCCESS`, native exit 0, custody PASS, final build/smoke PASS,
and served publication. This proves one eligible repin; it does not weaken the refusal rules for a
dirty or attached runtime, fetch failure, divergence, protected-path change, or verification
failure, and it does not establish semantic or Phase 7 graduation.

### Known issues (open)

1. **TWO INDEPENDENT graphify MCP defects: (a) the CANONICAL runtime's server cannot START, and
   (b) the only existing registration targets a SUPERSEDED runtime and serves a stale graph
   (see section 5).** Repairing the venv does NOT fix the registration, and re-pointing the
   registration does NOT fix the venv -- do not treat either as done because the other was.
   For (a): the CANONICAL runtime's `.venv-graphify` has `mcp==2.0.0`, whose `mcp.types` no
   longer exports `AnyUrl`; graphify 0.9.17 `serve.py` requires it, so `python -m graphify.serve`
   exits 1 (see section 5). Root cause: `tooling/wiki/requirements-graphify.txt` pins only the
   top-level `graphifyy[sql,mcp]==0.9.17` and carries an explicit unresolved TODO that transitive
   pins were never frozen, so `mcp` drifted to a new major. The fix requires pinning a compatible
   `mcp` in the LIVE runtime venv that the nightly depends on, so it must be sequenced against the
   nightly schedule rather than applied casually.

2. **The protected-pathspec refusal is LIVE today, and committed wiki output would widen it.**
   The pathspec is seven paths (section 2): `wiki`, `tooling/wiki`, `.gitignore`, `.graphifyignore`,
   `AGENTS.md`, `.gitattributes`, `tooling/.gitattributes`. FOUR are tracked right now
   (`tooling/wiki` at 44 files, `.gitignore`, `.graphifyignore`, `AGENTS.md`).
   - **Live:** any merge touching one of those four makes auto-follow refuse
     (`REFUSED_TOOLING_CHANGE`) and terminalize the night FAILED / exit 1, repeating every night
     until an operator manually repins. PR #771 itself touched `tooling/wiki`. Plan a bootstrap in
     the same sitting as any such merge. Do not overstate the change versus pre-#771: a stale pin
     ALSO lost the night then (receipt `f7db140f`: `serve_gate=FAIL`, exit 1, `terminal_state=FAILED`
     AND `SERVED_WIKI_KEPT_LAST_GOOD`). The delta is only where the run stops -- N0 refusal rather
     than the N6 serve gate. Both lose the night; the served package is untouched either way.
   - **Future:** if `wiki/` becomes tracked, it joins that class and every wiki-bearing merge
     refuses. Phase 7 graduation to committed wiki output must resolve this interaction FIRST.

3. **Two unaudited scheduled tasks are in `Ready` state.**
   `SSTAC-Wiki-FirstNightly-Verify-20260724` (one-time trigger already past,
   `LastTaskResult 2147946720`) and `SSTAC-Wiki-Nightly-Streak-Verify` (daily 06:15 trigger, never
   run, empty `NextRunTime`). Both point at scripts under `C:\tmp\sstac-kb-post750-20260723\`, which
   still exist. Neither was created or audited by the auto-follow session; disposition is an owner
   decision (this runbook does not authorize task changes).

4. **Phase 7 graduation needs BOTH criteria.** 10 counted nights AND semantic having run on at least
   5 of those 10. Per section 11, Contract D is deterministic-only and cannot satisfy the semantic
   half, so banking deterministic nights alone does not graduate.

5. **The installed task is an `InteractiveToken` EXCEPTION, not strict Contract D -- and it only
   runs while the owner is signed in.** Verified 2026-08-06: the live task XML carries
   `<LogonType>InteractiveToken</LogonType>`, while `tooling/wiki/activation_preflight.ps1`
   (line ~1244) requires `LogonType must be Password` for Contract D conformance, and the Contract D
   generator refuses to install otherwise. Two consequences, both material to the Phase 7 window:
   - **Streak risk:** an `InteractiveToken` task does not fire when no interactive session is
     present. A logout, a reboot without signing back in, or a locked-out console before 05:30 costs
     a counted night through no fault of the pipeline. Anyone banking the 10-night window must keep
     a signed-in session alive across the boundary, or accept the gap.
   - **False-unhealthy risk:** running the documented Contract D preflight against the live task
     will report it NON-CONFORMANT on `LogonType`. That is the expected result of the accepted
     exception, NOT evidence of a broken task. Do not "fix" it by re-registering under Contract D
     without an explicit owner decision -- switching to `Password` logon is a separate, owner-gated
     change with its own preflight cycle.

### Working-session hazard: your own shell can fail the night's custody baseline

The N0 custody baseline classifies a process as relevant if the full runtime root path appears as a
delimited token in its COMMAND LINE, or if its executable lives under the runtime root
(`check_orphans.ps1::Test-RuntimeReference`). That test does not care whether the process is a wiki
worker. **Any ordinary working session -- a Claude/Codex shell, an editor terminal, a
`git -C <runtime> ...` command -- becomes a candidate `DISALLOWED_RELEVANT_PROCESS` for as long as it
lives, simply by carrying the runtime path.** If such a process is alive at 05:30, it can trip the
baseline and cost a counted night. (The one exemption is a correctly-classified pre-existing graphify
MCP process; see below.)

Observed directly on 2026-08-06: a read-only verification shell that merely ran
`git -C <runtime-root> status` showed up in
`Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*wiki-runtime-9af819a-20260804*" }`
for its lifetime. It was transient and exited, so no night was at risk -- but a long-lived shell,
a paused agent, or a background task would not have.

This was previously understood only as a LAUNCHER problem (it is what failed the very first canary).
It is broader than that: it is a standing hazard for ordinary sessions.

Practical rules:

- Prefer inspecting the runtime through short-lived commands; do not leave a long-running shell
  parked on a command line containing the runtime path.
- Before ending any session that touched the runtime, confirm nothing is left referencing it. Do NOT
  exclude your own `$PID` from that check: the N0 baseline does not exclude the operator's shell, so
  a self-excluding check reports "clear" while the very shell running it is what trips the baseline.

  **There is NO supported standalone authoritative check.** Know what the production classifier
  (`tooling/wiki/check_orphans.ps1::Test-RuntimeReference`) actually does, because its semantics are
  both narrower and wider than a naive `-like "*name*"` test:
  - It matches the FULL runtime path as a DELIMITED TOKEN in the command line (`Test-PathToken`).
    The delimiters are ASYMMETRIC: on the LEFT the match must be preceded by start-of-string,
    whitespace, `"`, `'`, or `=`; on the RIGHT it must be followed by end-of-string, `\`, `/`, `"`,
    `'`, or whitespace. A leaf-name substring test is not equivalent.
  - It ALSO flags a process whose `ExecutablePath` lives under the runtime root even when the
    command line never mentions it -- a case a command-line-only query silently MISSES.
  - It EXEMPTS correctly-classified `PREEXISTING_GRAPHIFY_MCP` processes (executable
    `.venv-graphify\Scripts\python.exe` running `-m graphify.serve`, runtime-referencing but not a
    run descendant). A naive query flags these as violations when they are allowed.
  - KNOWN BLIND SPOT: namespace-prefixed paths (`\\?\`, `\??\`) are NOT covered here.
    `Test-NamespacePrefixedPathToken` is called from exactly one site --
    `Test-ExpectedRunConsoleHost`, and negated -- NOT from `Test-RuntimeReference`. A command line
    carrying only the `\\?\C:\...` form fails `Test-PathToken` (the leading `\` is not in the
    allowed left-delimiter set) and goes unflagged.

  So a raw substring count both false-clears and false-flags. Treat ad-hoc queries as a SCREEN only:
  if one returns something, investigate; if it returns nothing, that is NOT proof. Do NOT run
  `check_orphans.ps1` expecting an authoritative answer -- invoked without `-Mode` it falls through
  to `Invoke-LegacyReportOnly`, which this runbook already states (section 2) is not Contract A
  process-custody proof. The run-bound `CaptureBaseline` / `EvaluateTerminal` modes are wrapper-only:
  they require a canonical run id, the exact nightly parent PID, output paths, and validated
  parent/checker ancestry. The ONLY authoritative custody evidence is the nightly's own run-bound N0
  baseline receipt.

- If the only hit is the shell you are typing in, that is still a hit -- it is safe only because you
  are about to close it. Anything else must be closed before 05:30.
- Scope the check to the RESOURCE (processes referencing this runtime root), never to an image name
  such as `agy.exe` or `python.exe` -- image-name gates produce both false alarms and false clears.
- Windows just AFTER a nightly are the safest time to do runtime-referencing work, because a
  forgotten shell then has the full day to be noticed before the next 05:30 boundary.
