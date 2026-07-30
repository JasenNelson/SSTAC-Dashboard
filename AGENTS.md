# SSTAC-Dashboard Agent Notes

This is the primary Codex-readable operating guide for `C:\Projects\SSTAC-Dashboard`.
Claude also inherits `C:\Projects\CLAUDE.md`; Codex agents must read that parent file
early when working in this repo.

## KB Wiki (read-first; ALL agents -- Claude, Codex, AGY, OpenCode)

A compiled code-knowledge wiki lives under the canonical runtime root at `wiki\` (untracked
output). The runtime defaults to the MAIN checkout; a dedicated worktree is supported only when
`SSTAC_WIKI_RUNTIME_ROOT` points every hook/session consumer to that same absolute root. Before
repo-wide grepping, consult `<runtime>\wiki\03_Indexes\000-Modules.md` and
`000-Concepts.md`; rebuild on demand from the runtime root with `/sync-wiki` (Claude) or
`tooling\wiki\sync_wiki.ps1`. Operations runbook: `docs/WIKI_KB_OPERATIONS_2026_07.md`.
Read-only usage is always safe.

## Project Identity

SSTAC-Dashboard is a Next.js 15 / React 19 / TypeScript dashboard for SSTAC and TWG
workflows. It includes:

- Supabase auth, user roles, poll systems, matrix-map tables, Matrix Options state,
  and audited Matrix Map export paths.
- Protected dashboard routes for BN-RRM, Matrix Options, regulatory review, TWG,
  CEW results, HITL packets, and admin workflows.
- Local Regulatory-Review and engine-v2 integration for read-side policy data and
  local engine actions.
- Agentic OS local tooling for launching and monitoring local agents.

Key locations:

- `src/app/(dashboard)/`: authenticated dashboard routes.
- `src/app/(auth)/`: login and signup.
- `src/app/api/`: API route handlers; API routes are not protected by middleware and
  must enforce their own guards.
- `src/lib/`: shared auth, API guards, engine-v2 helpers, matrix-options utilities.
- `src/data/`: curated reference catalogs; treat as read-only unless owner approves.
- `supabase/migrations/`: applied migrations; append-only and never edit already
  applied files.
- `docs/INDEX.md`: canonical documentation entrypoint.
- `docs/_meta/docs-manifest.json`: documentation gate and volatile fact registry.
- `docs/GATE_MODE_SOP.md`: commit/push protocol authority.

## Startup Checklist

At session start or before broad repo claims:

1. Read `C:\Projects\CLAUDE.md`.
2. Read this file.
3. Read `docs/INDEX.md` and `docs/GATE_MODE_SOP.md`.
4. For data/API/auth/Supabase work, also read `docs/AGENTS.md` and the relevant
   manifest bundle from `docs/_meta/docs-manifest.json`.
5. Run or inspect `git status --short --branch` before planning edits.
6. Treat pasted plans, handoffs, closeouts, and status docs as claim lists; verify
   against live files, branch tips, current diffs, PR/check state, and artifacts.

## Build Gate

Do not run raw `npm run build` from Codex/agent shells by default. Stale or interrupted
`.next` state has caused Next.js builds to stall at the banner stage in this repo.

Use the monitored clean build gate instead:

```powershell
npm run build:monitored:clean -- -TimeoutSeconds 360 -PollSeconds 10
```

This quarantines `.next` under `.tmp/next-quarantine-*`, writes logs under
`.tmp/build-monitor/`, and times out with process-tree cleanup. If sandboxing blocks
`.next` quarantine, rerun with the required approval/escalation rather than falling
back to raw build.

For push protocol, this monitored clean build satisfies the build step; still run the
repo's lint, typecheck, unit/coverage, e2e, and docs gates as required.

## Ship Protocols (COMMIT / PUSH / MERGE)

Authority: `docs/GATE_MODE_SOP.md`. Its five ordered phases must not be skipped or
reordered. Gate logs go to `.tmp/gate-logs/`.

- COMMIT protocol: independent adversarial review iterated to mutual-agreement GREEN
  before commit.
- PUSH protocol: full six-gate suite on the final tip, never compact:
  `npm run lint` -> `npx tsc --noEmit` -> `npm run test:ci` -> monitored clean build ->
  `npm run test:e2e` -> `npm run docs:gate`.
- MERGE protocol: push protocol confirmed plus GitHub CI green on the PR head, PLUS
  explicit owner/HITL APPROVAL of that exact reviewed SHA and scope.
  **Merge requires owner APPROVAL, not necessarily owner EXECUTION.** Once the owner has
  explicitly approved the exact SHA and scope, and the required CI checks are green, an
  authorized executor may perform the merge and observe the resulting deployment.
  **An executor may NEVER self-approve**, and approval of one SHA never carries forward to
  another: a new head SHA, a changed scope, or a re-run needs its own approval.
  (Corrected 2026-07-30. The previous wording, "The owner merges; agents never run
  `gh pr merge`", conflated approval with execution and contradicted actual owner practice.
  This is not standing merge authority.)

GitHub facts verified 2026-07-25:

- Remote: `https://github.com/JasenNelson/SSTAC-Dashboard.git`.
- Visibility: public.
- Default branch: `main`.
- Branch protection requires `Lint & TypeScript Check`, `Unit Tests`,
  `Production Build`, and `E2E Tests`.
- Force pushes and branch deletions are disabled on `main`.

## Supabase Protocol

This protocol supplements `CLAUDE.md` and overrides conflicting vendored-skill
guidance.

- Project ref: `qyrhsieynzfgyuqzznap`.
- `.mcp.json`, `.gemini/settings.json`, and `opencode.json` define the
  project-scoped Supabase MCP server.
- Default posture: read/exploration first. Run scoped read-only verification before
  proposing a migration, RPC, RLS policy, role, or data-publication change.
- For any owner-approved write/change, all of these are mandatory:
  1. Identify the exact SQL/operation.
  2. Obtain `/codex-review` GREEN on those exact bytes with no unresolved P0/P1/P2.
  3. Run a scoped read-only preflight confirming the expected starting state.
  4. Explicitly flag the operation and obtain owner approval for that exact write.
  5. Execute only the reviewed and approved statement(s), with no opportunistic extras.
  6. Run a scoped read-only postflight and report the result and rollback/stop status.
  7. Record the owner-approved override in the run state, PR, or closeout.
- An explicit owner-approved `/supabase` or MCP write overrides stale "SQL Editor
  only" language for that exact operation only. It is not blanket write authority.
- Prefer Supabase Studio SQL Editor for broad, bulk, irreversible,
  credential-sensitive, or data-publication operations unless the owner separately
  approves the exact MCP operation. For DRA visibility/publication, use the audited
  application/RPC path unless the owner accepts an explicitly documented alternative.
- Do not use MCP `apply_migration` unless the owner separately approves that exact
  command and the migration-history implications are documented.
- For bulk data loads, do not push large SQL through MCP `execute_sql`; use the
  documented pooler loader or another `/supabase`-skill-approved path.
- `v2_judgments`: never write a real verdict value for any reason, including a throwaway
  test against a disposable branch. Acceptable paths are a test designed to avoid writing
  meaningful verdict semantics entirely, or the owner supplies or personally runs that one
  write.
- Never edit files under `supabase/migrations/` that are already applied.
- Never expose or log `SUPABASE_SERVICE_ROLE_KEY`; it is server-only and privileged.

Auth model:

- `src/middleware.ts` refreshes Supabase sessions and gates matched app routes.
- API routes do not go through middleware; they must use route-level guards.
- Regulatory-review and engine-v2 admin API paths use `requireAdmin()` or
  `requireAdminForApi()` and verify `user_roles.role = 'admin'`.
- Other domains may use narrower custom guards. Matrix Map administration, for
  example, intentionally supports both `admin` and `matrix_admin`; inspect the
  route-specific guard before changing access rules.
- CEW poll routes intentionally support anonymous/CEW flows through
  `createClientForPagePath()`.
- Client code uses public `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  only.

## Never Rules

- Never write verdict determinations or judgments into policy/verdict data.
- Never promote, demote, re-rank, or mutate the default-policy library.
- Never mutate `src/data/` catalogs by hand without explicit owner approval.
- Never `git add .`, `git add -A`, or `git add -u`; stage exact paths only.
- Never `git reset --hard`, `git clean -f`, `git checkout .`, or `git restore .`
  against the working tree.
- Never run raw `npm run build`; use the monitored build gate.
- Never bypass hooks with `--no-verify`.
- Never run `gh pr merge` WITHOUT explicit owner/HITL approval of that exact reviewed SHA
  and scope, with required CI green. Never self-approve. See the MERGE protocol above:
  approval is the owner's, execution may be delegated, and approval never carries to a
  different SHA.
- Never normalize vendored files or stale legacy docs solely for style.
- Plain ASCII only (code points <= 127) in files authored by an agent in this repo.
- No more than 3 concurrent background agents.

## Dirty Checkout Rules

This repo often contains owner-created or agent-created untracked operational artifacts.

- Do not clean, delete, or archive untracked files unless the owner explicitly asks.
- Ignore unrelated dirty files when implementing a scoped change.
- If reviewing or comparing branches, prefer object-pinned commands such as
  `git rev-parse`, `git merge-base`, and `git diff origin/main...<branch>` over
  switching branches in the shared checkout.
- Stop and ask only if unexpected tracked diffs directly block the requested work.

## Worktrees

- Parallel work uses `git worktree add` under `C:\Projects\SSTAC-Dashboard-worktrees\`.
- Never use `git checkout -b` in a shared checkout for parallel work.
- `node_modules` in worktrees is a junction to the primary checkout's store. Before
  deleting a worktree, remove the junction first and verify the shared store was not
  touched.

## Agent Surfaces

- `AGENTS.md`: primary Codex/agent operating guide.
- `CLAUDE.md`: Claude Code project guide and cross-project inheritance pointer.
- `.codex/`: documented Codex settings and local workflow checklist.
- `opencode.json`: OpenCode project config, permissions, commands, and Supabase MCP.
- `.mcp.json`: MCP server definitions consumed by MCP-aware tools.
- `.agents/skills/`: provider-neutral vendored skills.
- `.claude/`: Claude Code repo skills, local settings, and hooks.
- `.gemini/`: AGY/Gemini project context and MCP settings.
- `SSTAC_AI_PIPELINE.md`: role split for Claude, AGY, Codex, OpenCode, and owner.
- `docs/AGENTS.md`: behavioral safety rules for RLS, RPC bridge, API gate, and
  historical data-touching patterns.

## AGY Autonomous Runs

Before choosing or launching AGY, read `docs/AGY_USAGE.md`,
`SSTAC_AI_PIPELINE.md`, `C:\Projects\CLAUDE.md`, and the shared
`C:\Projects\AI_CLI_REFERENCE.md`.

For any AGY task expected to exceed five minutes:

- Use a file-backed workplan and the `supervise-headless-ai-worker` contract.
- Supervision is detection and acceptance, not write prevention. Never grant a
  write-enabled autonomous worker the dirty primary checkout; use an isolated
  worktree or an independently enforced read-only boundary.
- Give the owner one short PowerShell launch, not a sequence of prompts.
- Use a unique run/controller root, a no-AGY supervisor handshake, PID custody,
  breadcrumbs, logs, stall criteria, required artifacts, and retry budget zero.
- Scale Codex review inside AGY from targeted to strategic, holistic, and
  comprehensive checkpoints; correct and re-review to mutual GREEN.
- Treat the worker closeout as a claim list and independently verify live refs,
  diffs, gates, PR state, artifacts, and forbidden-action compliance.
- Follow `docs/AGY_USAGE.md` for the validated AGY model/flag combination and
  SSTAC-specific failure-prevention rules.

## Mission-Control Token Efficiency

Claude and Codex tokens are scarce orchestration and review budgets. AGY is not just
a dictation or file-copy tool; once the spec is bounded, use AGY for mechanical
engineering work: test harnesses, diagnostic scripts, candidate fixes, fixture
generation, report drafting, grep or inventory scripts, and repetitive verification
scaffolds.

- Claude or the active mission-control Codex session owns strategy, gate decisions,
  final verification, and owner-facing judgment.
- AGY owns bounded mechanical production when target files, allowed actions, and
  acceptance checks can be specified.
- Before any debugging or fix-review loop expected to take more than two
  mission-control turns, write a tight AGY brief or explicitly state why AGY is
  inappropriate.
- Build one upfront harness or verification script instead of iterative live shell
  probing. Prefer AGY to draft the harness after mission control defines the invariant.
- Read Codex review output surgically: verdict, blockers, top findings, and named
  files first. Do not paste or tail large reviewer transcripts into context unless
  a specific finding requires it.
- Track cumulative side-quest cost. Before continuing work that is not on the
  flagship path, state why it matters, what it has already cost, the next bounded
  step, and whether AGY can do that step.
- Do not treat repeated "one more pass" loops as free. If work drifts from the
  current project goal, pause and re-scope.
- Every closeout must include `Claude-token spend risk for next step: low/medium/high`
  and `AGY delegation opportunity: yes/no`.

## Session Closeout

For substantive work, recommend the next step instead of ending with a status-only
summary. If closing a session after code or docs changes:

1. Report changed files and verification commands.
2. Mention any gate that was not run.
3. Check for owned long-running processes before exit:

```powershell
Get-Process node, python -ErrorAction SilentlyContinue
```

Do not kill processes by image name. Only propose cleanup for processes whose ownership
is clear, and ask the owner before terminating them.
