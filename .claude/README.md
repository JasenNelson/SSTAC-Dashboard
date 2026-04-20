# `.claude/` — Claude tooling for this repo

This folder holds skills, settings, and session artifacts for Claude Code when working in `C:\Projects\SSTAC-Dashboard`. It is **not** part of the application; nothing under `.claude/` is built or shipped.

## What lives here

- **`skills/`** — repo-local skills (slash commands) that Claude can invoke.
  - **`safe-exit/SKILL.md`** — pre-exit checklist for ending a session cleanly.
  - **`update-docs/SKILL.md`** — manifest-aware doc-update workflow. See "Known stale" below before following its example commands literally.
- **`settings.local.json`** — local Claude settings (permissions, hooks). Gitignored in spirit; treated as user-local — do not edit as part of normal feature work.
- Root-level session artifact files (`SESSION_CHECKPOINT_*.md`, `REFACTORING_*.md`, `PHASE4_SESSION_SUMMARY.md`, `pending-commit-message.txt`) — historical session captures left here by past runs. They are not part of any gate and are not authoritative.

## When to invoke `/update-docs`

Invoke at session end or after any of the following:

- Significant feature work that introduces new behavior worth a lesson entry.
- A bug fix where the root cause is non-obvious.
- A new architectural decision or convention.
- Manifest fact changes (test counts, grades) — though these are now stored under `docs/_meta/docs-manifest.json` `facts` rather than scattered docs.

The skill knows about this repo's manifest-driven gate system (`docs/INDEX.md`, `docs/_meta/docs-manifest.json`, `npm run docs:gate`). It captures lessons in `docs/LESSONS.md` and updates manifest facts where appropriate.

## Gate-failure remediation

If `npm run docs:gate -- --base origin/main --head HEAD` fails:

1. Read the failing bundle's required docs (printed by the gate output).
2. Update them in the smallest possible diff — match heading text exactly (the heading-verification regex is in the manifest under `policies.gate_evaluation.heading_verification`).
3. Re-run the gate. If a path-glob trigger is misfiring, adjust the manifest bundle's `triggers` rather than skipping the gate.
4. For deeper guidance see `docs/INDEX.md` and `docs/AGENTS.md`.

Never bypass the gate with `--no-verify` on a commit. If a failure looks wrong, fix the manifest or the doc — don't silence the check.

## Authority hierarchy (when guidance conflicts)

1. **`docs/INDEX.md`** — canonical entrypoint and current-status narrative.
2. **`docs/_meta/docs-manifest.json`** — gate definitions and volatile facts.
3. **`docs/AGENTS.md`** — behavioral safety rules (RLS, RPC bridge, API gate).
4. Skill `SKILL.md` files — workflow principles.
5. This README — navigation only.

If a skill's example command contradicts `docs/INDEX.md` or the manifest, the manifest wins.

## Known stale

The `update-docs/SKILL.md` file currently contains example commands and `F:\` paths that predate the move to `C:/Projects/SSTAC-Dashboard`. Follow the **principles** of the skill (manifest-first edits, smallest diff, register-in-same-diff, gate semantics) but verify any literal command/path against the current manifest before running it. A future pass will correct the SKILL.md examples.

## What this README is not

- Not a list of every Claude feature — see Anthropic's Claude Code documentation for the tool itself.
- Not a status doc — it should not contain test counts, grades, "production ready" claims, or anything else volatile.
- Not part of the gate system — adding skills does not require a manifest entry.
