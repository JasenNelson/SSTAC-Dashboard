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
| Nightly scheduled task `SSTAC-Wiki-Nightly` (05:30) | NOT REGISTERED -- registration is OWNER-RUN | `tooling\wiki\register_wiki_nightly_task.ps1` is DRY-RUN by default; `-Apply` executes (run from the MAIN checkout so the /TR path is right) |
| Watchdog task | NOT REGISTERED (same owner-run pattern) | `tooling\wiki\wiki_watchdog.ps1`; register like the nightly if wanted |
| graphify MCP server | AVAILABLE + VERIFIED, NOT registered | live stdio JSON-RPC handshake verified against graphifyy 0.9.17 on 2026-07-22; register AFTER the first served wiki exists (section 5) |
| Committed `wiki/` output | OFF (gitignored) | graduation criteria unmet (zero counted nightly receipts); revisit per plan Phase 7 streak math |
| `-AutoCommit` | OFF, never passed | unattended commits need an explicit recorded owner ruling first |
| Post-commit git hook | INTENTIONALLY ABSENT | 82-worktree shared `.git/hooks` = orphan-process factory; the nightly N0 asserts it stays absent |

## 2. Daily operation

- On-demand rebuild (main checkout): `/sync-wiki` skill, or
  `powershell -File tooling\wiki\sync_wiki.ps1 -Stamp <yyyy-MM-dd>`. This path runs the SAME
  Phase 4 gates as the nightly: docs scope + trust overlay regeneration first (fail-closed),
  then guarded build, graph smoke, and the graphify-out secrets scan before compile/lint.
- Full nightly pipeline manually: `powershell -File tooling\wiki\nightly_wiki_sync.ps1`
  (steps N0-N7; receipt at `.tmp_wiki_nightly\receipt-<date>.md`; transcript alongside).
- Freshness: `powershell -File tooling\wiki\check_nightly_freshness.ps1` (exit 1 = stale >48h).
- Orphan check: `powershell -File tooling\wiki\check_orphans.ps1` (report-only).
- Guardrail self-test: `powershell -File tooling\wiki\guardrail_smoke.ps1`.
- Sessions read ONLY the SERVED set: `wiki\` pages, `wiki\.graph\graph.json`,
  `wiki\.build-stamp`. `graphify-out\` is the pipeline-internal working copy -- never read it
  from session-facing tools.
- Config: `tooling\wiki\wiki_nightly_config.json` (model, timeouts, expiries, freshness
  threshold). Edit via gated PR only.

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

## 5. MCP registration (after the first served wiki exists in the MAIN checkout)

Verified available (live stdio handshake, 2026-07-22). Register LOCAL scope only (a project
.mcp.json would propagate to worktrees where the venv/graph do not exist):

```
claude mcp add --scope local graphify -- C:\Projects\SSTAC-Dashboard\.venv-graphify\Scripts\python.exe -m graphify.serve C:\Projects\SSTAC-Dashboard\wiki\.graph\graph.json --transport stdio
```

Smoke after registration: `graph_stats`, `get_node` on a known module, one `query_graph`.
NOTE: requires `.venv-graphify` provisioned in the main checkout
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
  ownership-checked release; (3) hardcoded model in two scripts -> `wiki_nightly_config.json`.
- SSTAC additions OHD lacks: docs-trust overlay mechanism (`.graphifyinclude` is dead code in
  graphifyy 0.9.17 -- verified -- so gitignore negation overlay is used instead); staging-dir
  compile + atomic serve gate (sessions never see partial builds); nested-archive +
  SENSITIVE_DOCS hard exclusion; ASCII sanitation at compile; receipts with freshness telemetry;
  register script with dry-run default; watchdog with starvation/staleness markers.
- Schedule: SSTAC 05:30 (KB vault 02:00, OHD 03:30 with worst-case hold ~06:55 -- late OHD
  nights merely skip SSTAC semantic, fail-soft).

## 9. Receipts + verification quick reference

- Nightly receipt: `.tmp_wiki_nightly\receipt-<date>.md` (step statuses, durations, graph
  metrics, promotion +P/-D/~R, freshness block: commits-behind/age vs origin/main; thresholds
  >50 commits / >7 days).
- Suite: `python -m unittest discover -s tooling\wiki\tests` (69 tests as of 2026-07-22).
- Graduation streak math + wiki-commit criteria: plan Phase 7 (unchanged; not yet started --
  the 10-counted-night window begins once the nightly is registered and producing receipts).
