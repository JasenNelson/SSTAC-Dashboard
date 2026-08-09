---
name: sync-wiki
version: 1.2
last_updated: 2026-08-08
description: "On-demand deterministic rebuild of the SSTAC-Dashboard Knowledge-Base wiki. Runs docs-scope generation, guarded update and clustering, a community-required final smoke, staging compile/lint/secrets gates, and rollback-safe served-package swap. Use for /sync-wiki or a requested KB refresh. Non-Ollama and never auto-commit unless separately owner-authorized."
disable-model-invocation: false
---

# /sync-wiki -- rebuild the deterministic served KB wiki

Invocation surface for `tooling/wiki/sync_wiki.ps1`. The wiki is a local, gitignored artifact
(`wiki/`, `graphify-out/`, `.venv-graphify/` are untracked). This command commits nothing and
touches no remote, Supabase, production, secrets, scheduled tasks, MCP registration, or
LLM/Ollama. The deterministic docs trust scope is regenerated on every run.

## When to run
- The user types `/sync-wiki`, or asks to "sync / recompile / refresh the wiki" or the KB graph.
- After code or docs changes when the operator wants the local wiki view refreshed.

## Runtime root

Run in the canonical runtime root. The default is the main checkout. If
`SSTAC_WIKI_RUNTIME_ROOT` is set for a dedicated runtime worktree, change to that exact directory
before invoking the wrapper; hooks and future MCP registration must use the same root.

## How to run
Run from the canonical runtime repo root via PowerShell (Windows PowerShell 5.1 --
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
- **`-SkipGraph`** skips Graphify update and clustering, then canonicalizes and validates the
  existing `graphify-out/graph.json`. Publication still requires complete communities and every
  final graph, hash, secrets, staging, and swap gate. Use it only when the existing clustered graph
  is already current. Omit it to regenerate and re-cluster the graph first (slower).
- **NEVER pass `-AutoCommit`** without a separate recorded owner ruling. The current wiki remains
  gitignored and unattended commits are off.

The script resolves both Python and, by default, Graphify from the selected runtime's pinned
`.venv-graphify\Scripts\` directory. It fails before scope generation if the exact pinned Python
is absent, and a full run also fails if the exact Graphify executable is absent. Bare executable
names and PATH fallback are not accepted.

## What it does (steps)
1. **Scope + graph gates** -- regenerates the docs trust overlay. A full run performs guarded
   `update --no-cluster`, pre-cluster canonicalization and deterministic smoke, guarded
   `cluster-only --no-label --no-viz`, final canonicalization, final smoke with required complete
   communities, graph-hash binding, and the graph-output secrets scan. Any update or cluster
   timeout, custody risk, guardrail failure, nonzero exit, malformed receipt, incomplete community
   population, hash failure, or secret hit stops before publication.
2. **Staging compile** -- seeds `wiki.staging/` from the last-good served wiki so Manual Notes,
   promotion state, and contradiction state survive; compiles into staging.
3. **Staging gates** -- wiki lint and staging secrets scan.
4. **Finalize + swap** -- packages graph/report/build-stamp in staging, then swaps it into `wiki/`
   with rollback to the last-good wiki on rename failure.
5. **Changed Files** -- `git status --porcelain -- wiki/` for operator visibility only (untracked; not stageable).

A non-zero exit at any step fails the run; report the failing step. No graph from a failed or
incomplete clustering path is staged or published. `promotion.py` is deliberately
NOT invoked here (single-invocation rule; see `conventions.md` section 4.1) -- seed/refresh the
ledger by running `tooling/wiki/promotion.py` directly.

## Activation boundary

Phase 4-7 infrastructure is tracked, but activation remains separate: this command does not
register the nightly task, add MCP, create the Ollama standing block, run semantic extraction, or
enable auto-commit. Those actions retain the owner gates in the operations runbook.

## Notes
- Reference: `tooling/wiki/sync_wiki.ps1`, `tooling/wiki/conventions.md`, and
  `docs/WIKI_KB_OPERATIONS_2026_07.md`.
- Output is local; nothing here is shipped. If the compile/lint reports real content issues, surface
  them to the owner -- do not auto-fix generated wiki content.
