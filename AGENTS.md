# SSTAC-Dashboard Agent Notes

## Build Gate

Do not run raw `npm run build` from Codex/agent shells by default. Stale or interrupted `.next` state has caused Next.js builds to stall at the banner stage in this repo.

Use the monitored clean build gate instead:

```powershell
npm run build:monitored:clean -- -TimeoutSeconds 360 -PollSeconds 10
```

This quarantines `.next` under `.tmp/next-quarantine-*`, writes logs under `.tmp/build-monitor/`, and times out with process-tree cleanup instead of leaving an unbounded build running. If sandboxing blocks `.next` quarantine, rerun with the required approval/escalation rather than falling back to raw build.

For push protocol, this monitored clean build satisfies the build step; still run the repo's unit tests, e2e tests, and linting as required.

## Ship Protocols (COMMIT / PUSH / MERGE)
- Authority: docs/GATE_MODE_SOP.md (single source of truth; its five ordered phases must not be
  skipped or reordered). Gate logs go to .tmp/gate-logs/.
- COMMIT protocol: an independent codex review iterated to mutual-agreement GREEN before commit.
- PUSH protocol: the full gate suite on the FINAL tip, never compact: lint -> unit tests
  (npm run test:ci) -> monitored clean build (the Build Gate above) -> e2e. All GREEN.
- MERGE protocol: push protocol confirmed + GitHub CI green on the PR head; the OWNER merges --
  agents never run gh pr merge.

## Supabase Protocol
- Full policy: see CLAUDE.md's "Supabase Protocol (HIGH AUTHORITY)" section -- this is the
  condensed version; CLAUDE.md is authoritative if the two ever drift.
- The Supabase MCP server (see .mcp.json) and the `/supabase` skill MAY be used for both reads and,
  under the gate below, writes (owner-reconciled 2026-07-09 -- supersedes the prior blanket
  "MCP write ops fail 100%" rule as the default posture).
- Reads/verification queries: MCP is allowed without owner paste, as long as the query is
  read-only and scoped.
- Any write/change (DDL, RPC replacement, RLS change, data write, migration application) requires
  ALL of: (1) the exact SQL/operation drafted first, (2) `/codex-review` GREEN on that exact
  SQL/operation with no unresolved P0/P1/P2, (3) the write explicitly flagged to the owner, (4) the
  owner's explicit approval of that exact write. Only then may the agent run it.
- MCP `apply_migration` remains disallowed unless separately and explicitly authorized for that
  exact operation.
- For bulk data loads, do not push large SQL through MCP execute_sql -- use the documented pooler
  loader or another `/supabase`-skill-approved path.
- `v2_judgments`: never write a real verdict value for any reason, including a throwaway test
  against a disposable branch (see CLAUDE.md item 11 for the full rule). The only acceptable paths
  are (a) a test designed to avoid writing meaningful verdict semantics entirely, or (b) the owner
  supplies or personally runs that one write. This workflow's write gate (codex-review + owner
  approval) does not create a third path around that rule.
- Report every write before (exact SQL, codex verdict, owner approval status) and after (result,
  verification query result, rollback/stop status). If the operation deviates from the reviewed
  SQL or produces unexpected output, STOP.
- Never edit files under supabase/migrations/ that are already applied.

## Never Rules
- Never write verdicts or judgments into policy/verdict data; never promote/demote the policy
  library; never mutate src/data/ catalogs by hand.
- Never git add . / -A / -u (path-scoped staging only). Never git reset --hard, git clean -f,
  git checkout . / git restore . against the working tree.
- Plain ASCII only (code points <= 127) in all files AUTHORED by an agent in this repo.
  Vendored third-party content (e.g. upstream skills under .agents/skills/) is exempt --
  do not normalize vendored files; that creates drift from upstream.
- Never run raw npm run build (see Build Gate above); never bypass hooks with --no-verify.
- No more than 3 concurrent background agents.

## Worktrees
- Parallel work uses git worktree add under C:\Projects\SSTAC-Dashboard-worktrees\ (never
  git checkout -b in a shared checkout).
- node_modules in worktrees is a JUNCTION to the primary checkout's store: never recursively
  delete a worktree without removing the junction first (fsutil reparsepoint delete), or the
  shared store gets emptied.

## Agent Surfaces
- opencode.json (OpenCode project config: instructions, Supabase MCP, permissions, commands).
- .mcp.json (MCP server definitions, consumed by Claude Code and other MCP-aware tools).
- .agents/skills/ (provider-neutral vendored skills: supabase, supabase-postgres-best-practices).
- .claude/ (Claude Code: repo skills safe-exit + update-docs, settings, ship-protocols hook).
- docs/AGENTS.md (behavioral safety rules: RLS, RPC bridge, API gate) -- read it for any
  data-touching work.
