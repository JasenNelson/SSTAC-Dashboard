# SSTAC Graphify/KB wiki -- Row 10 guarded build + ledger-seed receipt (2026-07-22)

Status: EVIDENCE RECEIPT (docs-only). Resolves Top-50 row 10 ("confirm whether SSTAC's guarded graph
build / wiki compile / ledger seed actually ran"). SSTAC-Dashboard's OWN `tooling/wiki` pilot (NOT
Regulatory-Review). Run in a fresh worktree using the D1-guarded `sync_wiki.ps1` (PR #733). NO
`-AutoCommit`, NO Ollama, NO Phase 4-7.

## What was run
- Fresh worktree off `origin/main` (`b493f8c7`) on the D1 branch (`fix/sync-wiki-guardrail-2026-07-22`,
  commit `276a5edc`) so the graph build goes through `Invoke-GraphifyGuarded` (D1 fix).
- Pinned toolchain: `python -m venv .venv-graphify` + `pip install -r tooling/wiki/requirements-graphify.txt`
  (`graphifyy[sql,mcp]==0.9.17`). `graphify.exe` entry point `graphify.__main__:main`.
- Guarded build: `powershell.exe -File tooling/wiki/sync_wiki.ps1 -Stamp <ts> -GraphifyExe <venv>\graphify.exe`
  (steps: graph gen -> wiki compile -> wiki lint -> copy graph -> report changed files). NOT `-SkipGraph`.
- One-time ledger seed: `promotion.py --graph graphify-out/graph.json --state wiki/.graph/promotion.json
  --commit 276a5edc --report` (first run seeds the coverage baseline).

## Receipt (durable evidence -- the outputs themselves are gitignored/local)

| Stage | Result |
|---|---|
| **Guarded graph build** | **exit 0** -- the D1 `Invoke-GraphifyGuarded` wrapper ran the build and did NOT false-trip its timeout. `graphify-out/graph.json` written (~10 MB). |
| **Graph size** | **8743 nodes / 19535 edges** -- built with `--no-cluster`, so NO community count was computed and `graph_smoke.py`'s num_communities band was NOT checked in this run. Node count is consistent with the earlier calibration (~8517 nodes; grew with the repo). |
| **Wiki compile** | **1271 wiki `.md` pages** produced under the (gitignored) `wiki/` tree. |
| **Wiki lint** | PASS (no FAIL emitted; the run continued through copy-graph + changed-files). |
| **Ledger seed** | **exit 0** -- `promotion.json` seeded: `coverage_baseline.inferred_edge_count = 271`, commit `276a5edc`; `entries` = 271 INFERRED. |
| **Zero-node files** | 22 source files produced zero nodes (graphify warning #1666) -- all JSON/data files (e.g. `docs-manifest.json`, result/progress JSONs), benign; graphify does not parse them into code nodes. Not a defect. |

## Verdict for row 10
The Phase 2 guarded graph build, the Phase 3 wiki compile + lint, and the one-time ledger seed **DO
run successfully end-to-end** on the current tip, now through the D1 guardrail. This is the durable
receipt the Phase 3.5 gate asked for on the "did it build" question. (The outputs `graphify-out/`,
`wiki/`, `wiki/.graph/promotion.json` remain gitignored local artifacts per the pilot design; this doc
is the committed evidence.)

## What this does NOT establish (still open for Phase 3.5)
- **"The wiki demonstrably helped real work"** -- a build receipt is not usage evidence; the Phase 3.5
  gate still needs at least one real SSTAC task where the wiki helped.
- No Phase 4-7 work was done: no Ollama, no semantic extraction, no nightly task, no session hooks, no
  MCP, no committed wiki output.

## References
- D1 guardrail fix: PR #733 (`tooling/wiki/sync_wiki.ps1`).
- Phase-state audit + Phase 3.5 options: `docs/design/GRAPHIFY_KB_WIKI_PHASE_STATE_AUDIT_2026-07-22.md` (PR #732).
- Tooling: `tooling/wiki/sync_wiki.ps1`, `promotion.py`, `graphify_guardrail.ps1`, `conventions.md`.
