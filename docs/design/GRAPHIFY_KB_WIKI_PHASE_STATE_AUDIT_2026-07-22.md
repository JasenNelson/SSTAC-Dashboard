# SSTAC-Dashboard Graphify / KB-wiki -- phase-state audit + Phase 3.5 owner packet (2026-07-22)

Status: EVIDENCE + OWNER-DECISION PACKET (docs-only). Scope: **SSTAC-Dashboard's own** `tooling/wiki`
Graphify/LLM-wiki pilot -- **NOT** the Regulatory-Review KB. Audited at `origin/main = b493f8c7`.

Plan (owner-approved 2026-07-17, Phases 0-3.5 ONLY): `~/.claude/plans/jolly-marinating-piglet.md`
(outside this repo). Commit chain that landed the pilot: `fb4f7d9c` (Phase 2 config surface) ->
`4811fef9` (Phase 3 tooling + tests) -> `ae8d48db` (community-band calibration) -> `b493f8c7`
(`/sync-wiki` skill, #731).

## 1. Phase-by-phase state

| Phase | Goal | Status | Evidence |
|---|---|---|---|
| 0 Pre-flight | py/pip/ollama/worktree/disk/staleness checks (read-only scratchpad note) | **NOT GIT-VERIFIABLE** | Phase 0 is a scratchpad note, not a tracked artifact. `.graphifyignore` carries a "confirmed 2026-07-17" comment (evidence a check happened); no committed pre-flight receipt. Tracked by Top-50 row 10. |
| 1 Root organization | optional root-md governance lane | **NOT-LANDED (optional)** | No `ROOT_ORGANIZATION_RECOMMENDATION_*.md`; `docs/_meta/ARCHIVE_POLICY.md` absent. Plan marks it non-blocking (`.graphifyignore` excludes root historical md regardless). |
| 2 Toolchain + first graph | config surface + guardrail + first FULL guarded build with baseline metrics | **PARTIAL (code LANDED, run UNVERIFIED)** | Config landed verbatim (`.graphifyignore`/`.gitignore` match plan section 7 line-for-line; `requirements-graphify.txt` pins `graphifyy[sql,mcp]==0.9.17`; `graphify_guardrail.ps1` present). The actual guarded `graphify update` + `.baseline_metrics.json` outputs are gitignored -> not verifiable from git. `ae8d48db`'s comment ("SSTAC's Phase 2 graph is 534 communities / 8517 nodes") is inference that a build ran, not a stored receipt. |
| 3 Wiki compile/lint/ledger (no LLM) | port compile/lint/promotion/conventions/sync + tests + one-time ledger seed | **LANDED (code) / UNVERIFIED (run)** | All ports + `scan_secrets.py` + `graph_smoke.py` + 6 test files landed (`4811fef9`). Enhancements present: `promotion.py:10-14` DEMOTION_GRACE_RUNS=2 / churn breaker / 0.90 coverage guard; `wiki_compile.py:189-219,251-372` doc-provenance hook (inert pre-Phase-4) + structured contradiction JSON; `wiki_lint.py:36-132` both new FAIL rules. `conventions.md` section 10 records a "224 INFERRED entries" seed count (evidence a seed ran once). `promotion.json`/`wiki/` are untracked -> lint-exit-0 / page-count / round-trip not git-verifiable (row 10). |
| **3.5 GO/NO-GO** | mid-pilot owner gate; **STOP-HERE is the DEFAULT** | **GATED -- decision NOT made/recorded** | No commit/file records a 3.5 decision. Top-50 row 48 still OWNER/open; it gates all of Phases 4-7. |
| 4 Docs semantic (Ollama) | third-lane HITL, `gen_docs_scope.py`, semantic pass | **NOT-LANDED (confirmed)** | `gen_docs_scope.py` absent; no `HITL_OLLAMA_THIRD_LANE_*` / standing-block file. |
| 5 Nightly automation | nightly/freshness/register/orphan scripts + scheduled task | **NOT-LANDED (confirmed)** | None of the nightly `.ps1` files exist. |
| 6 Session integration | `.claude/settings.json` hooks, `session_bootstrap.py`, nudge hook, graphify MCP | **NOT-LANDED (confirmed)** | `.claude/settings.json` absent; `.mcp.json` has only supabase entries (no graphify MCP). |
| 7 Graduation | runbook + committed wiki + wiki-sync branch | **NOT-LANDED (confirmed)** | `docs/WIKI_KB_OPERATIONS_*` absent; no tracked `wiki/`. |

`/sync-wiki` skill (part of approved 0-3.5 scope): landed `b493f8c7` / #731 (`.claude/skills/sync-wiki/SKILL.md`),
correctly declared Phase-0-3.5-scoped, no-commit, no-Ollama, on-demand.

## 2. Run evidence produced by this audit

- **`tooling/wiki` test suite: 48/48 PASS** under plain Python 3.11.9 (all tests + scripts are
  stdlib-only; NO graphify package required). Covers promotion state machine (demotion-grace, revival,
  churn breaker, coverage guard), wiki_compile provenance/contradiction hooks, wiki_lint rules,
  conventions/scan-secrets/graph-smoke. This confirms the deterministic Phase 0-3.5 tooling is
  internally sound.
- **NOT run (deliberate):** an actual `graphify update` build / ledger seed. It requires a `.venv-graphify`
  (graphifyy==0.9.17) and, per drift D1 below, `sync_wiki.ps1`'s graph step is currently UNGUARDED
  (no timeout) -- the plan itself warns graphify has no timeout/memory cap on Windows. Running it
  unguarded in an autonomous session is the wrong risk; whether the guarded build/seed ever ran stays
  an owner-verifiable item (Top-50 row 10).

## 3. Drift between plan and landed code (flag before any "proceed")

- **D1 (IMPORTANT -- safety) `sync_wiki.ps1` step 1 bypasses the guardrail.** Its bare
  `& $GraphifyExe update . --no-cluster` call (the `if (-not $SkipGraph)` block near line 20) runs
  DIRECTLY, with no `Invoke-GraphifyGuarded` wrapper and no
  `TimeoutSec`, even though `graphify_guardrail.ps1` (with `Invoke-GraphifyGuarded`) sits in the same
  directory. The plan's Phase-2 acceptance grep requires "zero bare graphify calls outside
  Invoke-GraphifyGuarded." So an interactive `/sync-wiki` graph-generation step is currently unguarded
  -- a hang there would not fail closed. **Recommend fixing this (wrap the call in
  `Invoke-GraphifyGuarded` with a timeout) before any Phase 3.5 "proceed", and it also makes a live
  `/sync-wiki` graph build safe to run.** (This is a code change, out of scope for this docs packet.)
- **D2 (minor) plan-text vs code band.** `ae8d48db` widened `graph_smoke.py` `num_communities` healthy
  band 250 -> 700 (comment-documented: SSTAC's real 534-community / 8517-node graph). The plan text
  (still says 15-250) was not updated, so a plan-only reader would see a false mismatch. Deliberate,
  evidenced deviation -- not silent drift.
- **D3 (minor) forward-ref.** `check_conventions.py:13` references the Phase-6 `session_bootstrap.py`
  (not yet landed) but degrades gracefully with a "not found" warning -- forward-compatible scaffolding.
- No drift found in the config surface, promotion enhancements, lint rules, or compile hooks (all
  match the plan).

## 4. Phase 3.5 gate -- the three owner options (verbatim intent from the plan)

Everything through Phase 3 is the CHEAP, deterministic half. Phase 3.5 is a HARD owner gate;
**STOP-HERE is the DEFAULT**. With evidence in hand (graph quality, wiki usefulness, spend so far):

- **STOP-HERE (DEFAULT; requires no action):** keep only the deterministic layer, refreshed manually /
  on-demand via `/sync-wiki`. Phases 4-7 remain contingent shelf designs; nothing in them is built
  unless the gate is affirmatively passed.
- **PROCEED to Phases 4-7 (Ollama third-lane, nightly automation, session integration):** ONLY on an
  affirmative, evidence-based owner override requiring ALL THREE simultaneously true -- (1) code-graph
  smoke metrics healthy, (2) the Phase 3 wiki demonstrably helped real work, (3) owner re-affirms the
  priority sanction vs the Matrix Options flagship. Phases 4-7 concentrate the plan's
  new-infrastructure risk (recurring scheduled tasks, GPU-lock lane, uncovered Python stack).
- **ABANDON:** delete untracked outputs; revert the tooling commits via a normal gated PR.

## 5. Owner decision packet

1. **Phase 3.5 go/no-go (row 48):** STOP-HERE (default) / PROCEED (needs the 3 conditions) / ABANDON.
   Recommendation: **STOP-HERE** unless the owner has concrete evidence the deterministic wiki already
   helped real work AND re-affirms priority over Matrix Options -- the default exists precisely so
   momentum can't build Phases 4-7, only evidence can.
2. **Row 10 (did the guarded build + ledger seed actually run?):** owner-verifiable by inspecting the
   local untracked `graphify-out/`, `wiki/`, `promotion.json` on the machine where the pilot ran
   (they are gitignored by design). The tooling tests passing (48/48) does not substitute for that.
3. **D1 guardrail-bypass fix:** authorize a small `sync_wiki.ps1` PR wrapping the `graphify update`
   call in `Invoke-GraphifyGuarded` (timeout) -- restores the plan-mandated fail-closed property and
   makes a live `/sync-wiki` graph build safe. (Code change; separate PR if approved.)
4. **D2:** optionally update the plan text's `num_communities` band 250 -> 700 to match the shipped,
   evidenced calibration (plan is outside this repo; owner edits it).

Forbidden-scope confirmation (this lane): no Ollama, no semantic extraction, no nightly task, no
hooks, no MCP/wiki integration, no committed wiki output, no `-AutoCommit`, no graduation. No Supabase/
deploy/secrets/publication. Investigation was read-only + the stdlib test suite; no graphify build run.
