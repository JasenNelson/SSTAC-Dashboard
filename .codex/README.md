# Codex Config

Codex has no CODEX.md; it reads root AGENTS.md (and CLAUDE.md as fallback).

IMPORTANT -- config.toml loading mechanism: the Codex CLI loads `$CODEX_HOME/config.toml`
(default `~/.codex/config.toml`); it does NOT auto-load this repo-local `.codex/config.toml`.
This file is the project's CANONICAL DOCUMENTED Codex settings. To apply it, MERGE these keys
into your `~/.codex/config.toml`. Do NOT point `CODEX_HOME` at this tracked directory: Codex
treats `CODEX_HOME` as its whole home and writes `auth.json`, history, logs, sessions, and
sqlite state there -- inside a tracked repo path, that risks committing secrets (the repo
.gitignore ignores those artifact patterns as a backstop, but do not rely on it). The
instructions surface (AGENTS.md) loads automatically regardless.

MUST-READ order for a Codex session here: AGENTS.md -> docs/AGENTS.md -> docs/GATE_MODE_SOP.md.

- Monitored build only (never raw npm run build)
- Supabase writes via SQL Editor path only (MCP writes fail here)
- Owner merges (never gh pr merge)
