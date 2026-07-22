---
name: sync-wiki
version: 1.0
last_updated: 2026-07-21
description: "On-demand recompile of the local Knowledge-Base wiki for SSTAC-Dashboard (Phase 0-3.5 pilot). Runs tooling/wiki/sync_wiki.ps1: graph generation (graphify) -> wiki compile -> wiki lint -> copy graph -> report changed files, over the gitignored local wiki/ artifact. Use when the user types /sync-wiki, or asks to sync/recompile/refresh the wiki or knowledge-base graph. NON-Ollama, on-demand only; never auto-commits during the pilot."
disable-model-invocation: false
---

# /sync-wiki -- recompile the local KB wiki (SSTAC-Dashboard, Phase 0-3.5 pilot)

Invocation surface for the existing wrapper `tooling/wiki/sync_wiki.ps1`. The wiki is a **local,
on-demand, gitignored artifact** (`wiki/`, `graphify-out/`, `.venv-graphify/` are untracked per
`tooling/wiki/conventions.md`): this skill regenerates it; it commits nothing and touches no remote,
no Supabase, no production, no secrets, and no LLM/Ollama (the compile uses graphify + local Python,
not a model).

## When to run
- The user types `/sync-wiki`, or asks to "sync / recompile / refresh the wiki" or the KB graph.
- After code or docs changes when the operator wants the local wiki view refreshed.

## How to run
Run from the repo root via the PowerShell tool (this environment is Windows PowerShell 5.1 --
`powershell.exe`, not `pwsh`/PowerShell Core). Either invoke the script with the call operator:

```
& '.\tooling\wiki\sync_wiki.ps1' -Stamp <timestamp> [-SkipGraph]
```

or, if an execution-policy prompt blocks it, run the host explicitly:

```
powershell.exe -NoProfile -ExecutionPolicy Bypass -File tooling\wiki\sync_wiki.ps1 -Stamp <timestamp> [-SkipGraph]
```

- **`-Stamp` is MANDATORY** -- pass a run timestamp (e.g. the current date-time) used to stamp the
  compiled wiki. It is a plain label, not fetched by the script.
- **`-SkipGraph`** skips step 1 (graphify graph generation) and recompiles from the existing
  `graphify-out/graph.json` -- the fast path when the graph is already current. Omit it to regenerate
  the graph first (slower).
- **NEVER pass `-AutoCommit`** during the Phase 0-3.5 pilot. `wiki/` is gitignored; there is nothing
  to commit, and the script's own guard says to stop if you find yourself passing it before Phase 7
  graduation.

The script uses the pinned `.venv-graphify` interpreter (graphifyy[sql,mcp]==0.9.17); do not
substitute a bare `python`.

## What it does (steps)
1. **Graph Generation** -- `graphify update . --no-cluster` (skipped with `-SkipGraph`).
2. **Wiki Compile** -- `wiki_compile.py --graph graphify-out/graph.json --repo-root . --out wiki --stamp <Stamp>`.
3. **Wiki Lint** -- `wiki_lint.py --wiki wiki`.
4. **Copy Graph** -- copies `graphify-out/graph.json` into `wiki/.graph/`.
5. **Changed Files** -- `git status --porcelain -- wiki/` for operator visibility only (untracked; not stageable).

A non-zero exit at any step fails the run; report the failing step. `promotion.py` is deliberately
NOT invoked here (single-invocation rule; see `conventions.md` section 4.1) -- seed/refresh the
ledger by running `tooling/wiki/promotion.py` directly.

## Pilot gate (do not exceed)
The KB wiki is an owner-approved Phase 0-3.5 pilot with a STOP-default gate: **on-demand only** -- no
nightly automation, no hooks, no auto-commit, no Ollama. This skill honors that: it only regenerates
the local artifact when explicitly invoked. Do not wire it into a recurring task or hook, and do not
advance past Phase 3.5 without owner sign-off (see the plan's Phase 3.5 gate + `conventions.md`).

## Notes
- Reference: `tooling/wiki/sync_wiki.ps1`, `tooling/wiki/conventions.md` (which anticipates this
  skill: "refreshed manually via `sync_wiki.ps1 -SkipGraph` (or `/sync-wiki` once the pilot skill
  lands)").
- Output is local; nothing here is shipped. If the compile/lint reports real content issues, surface
  them to the owner -- do not auto-fix generated wiki content.
