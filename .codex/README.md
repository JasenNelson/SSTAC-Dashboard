# Codex Setup For SSTAC-Dashboard

Codex has no `CODEX.md`; it reads root `AGENTS.md` and may fall back to
`CLAUDE.md` when configured. This directory documents the intended Codex behavior
for `C:\Projects\SSTAC-Dashboard`.

## Loading Mechanism

The Codex CLI loads `$CODEX_HOME/config.toml`, defaulting to:

```text
C:\Users\jasen\.codex\config.toml
```

It does not automatically load this repo-local `.codex/config.toml`. This file is
documentation for the project settings, not an active runtime config by itself.

Do not point `CODEX_HOME` at this tracked `.codex` directory. Codex writes
`auth.json`, history, logs, sessions, sqlite state, and other secrets/state under
`CODEX_HOME`. The repo `.gitignore` ignores those patterns as a backstop, but the
safe setup is to keep `CODEX_HOME` in the user profile and merge only the intended
settings into the user-local config.

## Required Read Order

For a Codex session in this repo:

1. `C:\Projects\CLAUDE.md`
2. `AGENTS.md`
3. `docs/INDEX.md`
4. `docs/GATE_MODE_SOP.md`
5. For data/API/auth/Supabase work: `docs/AGENTS.md`
6. Before broad code searches: `wiki\03_Indexes\000-Modules.md` and
   `wiki\03_Indexes\000-Concepts.md` from the canonical wiki runtime root.

## Runtime Settings Reference

The repo-local `.codex/config.toml` is reference-only. Do not copy or merge it
wholesale into `C:\Users\jasen\.codex\config.toml`.

Its `model`, `approval_policy`, `sandbox_mode`, `web_search`, reasoning, and fallback
keys are top-level settings. Copying them changes defaults for the entire selected
`CODEX_HOME`; placing their source file inside this repo does not make them
project-scoped. In particular, preserve a newer live model selection rather than
downgrading it to the reference file's older model.

The verified project-scoped entry in the user config is the trust record:

```toml
[projects.'C:\Projects\SSTAC-Dashboard']
trust_level = "trusted"
```

Before changing user-local Codex configuration, verify the installed CLI schema and
reconcile only the intended keys while preserving MCP, plugin, marketplace, desktop,
and other projects' settings.

## SSTAC Checklist For Codex

Startup:

- Read the required documents above.
- Run or inspect `git status --short --branch`.
- Treat pasted plans, handoffs, closeouts, and status docs as claim lists.
- Do not clean untracked artifacts unless the owner explicitly asks.
- If a task involves Supabase, load the Supabase skill and follow the exact write
  gate in root `AGENTS.md`.

Build and gates:

- Never run raw `npm run build`.
- Use `npm run build:monitored:clean -- -TimeoutSeconds 360 -PollSeconds 10`.
- For push protocol, run the full six-gate suite on the final tip:
  `npm run lint`, `npx tsc --noEmit`, `npm run test:ci`, monitored build,
  `npm run test:e2e`, and `npm run docs:gate`.
- Put gate logs in `.tmp/gate-logs/` and summarize; do not paste full logs.

GitHub:

- Public repo: `JasenNelson/SSTAC-Dashboard`.
- Default branch: `main`.
- Merge requires explicit owner/HITL APPROVAL of the exact reviewed SHA and scope, with
  required CI green. Approval is not execution: after that approval an authorized executor
  may run the merge. An executor may NEVER self-approve, and approval never carries forward
  to a different SHA. See the MERGE protocol in `AGENTS.md` (corrected 2026-07-30).
- After push, perform one CI status check and report the run URL/status.

Supabase:

- Project ref: `qyrhsieynzfgyuqzznap`.
- Load the Supabase skill and follow the complete ordered protocol in root
  `AGENTS.md`; do not replace it with a shorter restatement.
- Reads must be scoped and read-only.
- Writes require exact reviewed bytes, read-only preflight, exact owner approval,
  execution limited to the approved operation, read-only postflight, and a recorded
  override.
- MCP `apply_migration` remains disallowed unless separately and explicitly
  authorized for that exact operation.
- Never write meaningful `v2_judgments` verdict values; use a non-semantic test or
  owner-run/supplied write only.

Safe exit:

- Check `Get-Process node, python -ErrorAction SilentlyContinue`.
- Do not kill by image name.
- Only propose cleanup for processes clearly owned by this session or its helpers.
