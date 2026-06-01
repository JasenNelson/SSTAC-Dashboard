# SSTAC Dashboard - Claude Code Instructions

**L0 cross-project rules inherited from `C:\Projects\CLAUDE.md`. Read L0 first.**
**Gate discipline authority: `docs/GATE_MODE_SOP.md`. Read before any commit or push.**

---

## Project Identity

SSTAC Dashboard is a Next.js 15 / React 19 "Agentic OS" dashboard that:
- Renders regulatory review assessment results from the RRAA engine v1 policy database (SQLite,
  read directly from `C:\Projects\Regulatory-Review\engine\data\rraa_v3_2.db`).
- Uses Supabase for auth, user/role management, matrix-map data, and lane-2b judgment writes.
- Hosts BN-RRM (Bayesian Network Risk/Resource Management) interactive maps and HITL packet views.
- Hosts Matrix Options calculators with Protocol 28 policy evidence, provenance tracking, and
  default-policy library.
- Hosts SSD (Species Sensitivity Distribution) workbench, CEW polls, TWG review portal.
- Embeds an Agentic OS terminal via node-pty sidecar (`scripts/agentic-os-pty-server.mjs`).

Tech stack: Next.js App Router, React 19, TypeScript, Tailwind CSS v4, Zustand stores,
Supabase SSR, better-sqlite3 (local-dev only, webpack-externalized), Leaflet, Recharts,
Vitest + Testing Library (unit), Playwright (e2e), Sentry.

---

## Key Locations

| Path | Description |
|------|-------------|
| `src/app/(dashboard)/` | Main dashboard routes (bn-rrm, matrix-map, matrix-options, regulatory-review, admin, hitl-packets, ...) |
| `src/app/(auth)/` | Login + signup routes |
| `src/app/api/` | Next.js API route handlers |
| `src/components/` | Feature component trees (bn-rrm/, matrix-options/, agentic-os/, engine-v2/, ...) |
| `src/stores/` | Zustand stores (bn-rrm/, matrix-map/) |
| `src/lib/` | Shared utilities and engine-v2 types |
| `supabase/migrations/` | PROTECTED. Supabase schema migrations (append-only, never edit existing) |
| `supabase/engine_v2/` | Engine v2 lane-2b schema patches |
| `docs/GATE_MODE_SOP.md` | Gate discipline authority (read before commit/push) |
| `docs/INDEX.md` | Documentation index |
| `scripts/verify/monitored-build.ps1` | Monitored clean build script (always use this, not raw build) |
| `package.json` | npm scripts; use `npm run build:monitored:clean` not `npm run build` |

---

## Architecture

### App Router
- Route groups: `(dashboard)` for authenticated views, `(auth)` for login/signup.
- Server Components for data fetching; Client Components for interactive state.
- Middleware at `src/middleware.ts` handles Supabase session refresh + auth gating.

### State Management
- Zustand stores under `src/stores/` (bn-rrm, matrix-map). Do not add global state outside stores.

### Database
- **Policy DB:** SQLite at `C:\Projects\Regulatory-Review\engine\data\rraa_v3_2.db`. Read-only.
  Accessed via better-sqlite3 (externalized from webpack; dev-only surface).
  DO NOT copy this database into the dashboard folder. There is no copy here.
- **Supabase:** Auth, matrix-map tables, assessment results (`regulatory-review.db` sync),
  lane-2b `v2_judgments` write path. Migrations in `supabase/migrations/` are append-only.

### Supabase Protocol (HIGH AUTHORITY)
- Per `cross_project_supabase_mcp_dead_skip_to_sql_editor.md`: Supabase MCP fails 100%.
  DO NOT attempt MCP apply_migration or execute_sql.
  Author SQL + commit + push to PR. Owner pastes into Supabase Studio SQL Editor.
- Per `cross_project_supabase_protocol_explore_before_assume.md`: ALWAYS give owner
  read-only exploratory SQL BEFORE drafting any migration, RPC, RLS policy, or role.
  ZERO assumptions about schema; verify "missing" objects twice before creating.

---

## Gate Discipline

**Authority: `docs/GATE_MODE_SOP.md`** -- read this file before any commit or push.

Quick reference:
- Announce Gate Mode before any Commit or Push protocol run.
- **Build gate:** always `npm run build:monitored:clean -- -TimeoutSeconds 360 -PollSeconds 10`.
  Never raw `npm run build` from agent shells (no quarantine / no timeout protection).
- **Push protocol (full, never compact):** lint -> unit -> monitored build -> e2e. All GREEN.
- **Commit protocol:** `/codex-review` adversarial iterative loop to mutual-agreement GREEN first.
- Gate logs to `.tmp/gate-logs/` with timestamped filenames. Chat receives compact status only.
- One retry per known failure class (Vitest EPERM, .next quarantine, Playwright EPERM).
- Stop conditions and retry limits: `docs/GATE_MODE_SOP.md` sections 5 and 9.

npm scripts:
- `npm run lint` -- ESLint via next lint
- `npm run test:ci` -- Vitest coverage with `CI=true` (matches the GitHub Actions Unit Tests job).
  This is the MANDATORY push-gate unit command. `npm run test:unit` (`vitest run`, no coverage) is
  for fast inner-loop dev ONLY, never push-gate evidence -- it cannot reproduce coverage/CI-only
  failures (see `docs/GATE_MODE_SOP.md` Phase 4).
- `npm run build:monitored:clean -- -TimeoutSeconds 360 -PollSeconds 10` -- monitored build
- `npm run test:e2e` -- Playwright

---

## Working Rules

### Inherited from L0 (`C:\Projects\CLAUDE.md`) -- not duplicated here
- Plain ASCII only (code point <= 127). No em-dashes, no smart quotes, no Unicode arrows.
- Archive-before-edit for any `*_HANDOFF.md` or `DEV_PLAN*.md` file (use `/handoff-update`).
- Codex iterate-to-GREEN before commit + 4 gates before push.
- Path-scoped staging only. Never `git add .` / `-A` / `-u`.
- No mass deletions. No auto-deletion of project artifacts.
- Monitoring as baseline for all long-running wrappers.
- Process safety: max 3 background subagents; detect-orphans before multi-agent ops.

### Dashboard-specific rules
- **No default policy promotion.** The default-policy library is curated by HITL. AI must
  not automatically promote, demote, or re-rank policies in the library.
- **No QA promotion.** Assessment verdicts (ADEQUATE / INADEQUATE / OBSERVATION_ONLY) are
  HITL professional judgments. AI never writes through `v2_judgments` or proposes verdicts.
- **No catalog mutation.** `src/data/` reference catalogs are read-only for AI sessions
  unless owner has explicitly approved a change to the catalog itself.
- **Protocol 28 is policy-compilation context.** It defines evidence compilation workflow;
  it is not a source of new policy authority. Do not cite or extend Protocol 28 as if it
  were a regulatory source.
- **Fork existing components over designing new ones.** Per `cross_project_fork_existing_over_design_new.md`:
  when owner points at a working component as the pattern, `cp` it first. Do not author
  from-scratch design docs when an example exists.
- **Never delete regression tests.** Per `cross_project_never_delete_regression_tests_during_cleanup.md`:
  investigate why a test was added before deleting it. Fix the test; only delete in the
  same PR as the documented feature removal.
- **Venv / Node check.** For any Python helper scripts under `scripts/`, check for `.venv/`
  before running `python`. Use `.venv/Scripts/python.exe` if present.

---

## What AI Must Never Do

1. Write verdict determinations (ADEQUATE / INADEQUATE) into any table or UI surface.
2. Promote, demote, or mutate the default-policy evidence library without explicit HITL action.
3. Propose a push without having run and reported all 4 gates GREEN inline.
4. Run raw `npm run build` from an agent shell (no quarantine, causes Access Denied stalls).
5. Attempt Supabase MCP apply_migration or execute_sql (fails 100%; use SQL Editor path).
6. Copy `rraa_v3_2.db` into the dashboard folder or suggest sync commands for it.
7. Use `git add .` / `-A` / `-u` for staging.
8. Delete or modify any file under `supabase/migrations/` that has already been applied.
9. Use emoji, smart quotes, em-dashes, or any non-ASCII character (code point > 127) in docs.
10. Spawn more than 3 background subagents simultaneously.

---

## Protected Paths

### Tier 1 -- Never Delete or Overwrite Without Owner Confirmation
- `CLAUDE.md` (this file)
- `package.json`, `next.config.ts`, `tsconfig.json`
- `supabase/migrations/` (append-only; never edit applied migrations)
- `docs/GATE_MODE_SOP.md` (gate discipline authority)
- `src/middleware.ts` (auth gating; changes break all protected routes)

### Tier 2 -- Read-Only
- Any `docs/archive/` folder (audit trail).
- `src/data/` reference catalogs (curated HITL artifacts; read before proposing changes).

### Tier 3 -- Handle With Care
- Any `*_HANDOFF.md` file at root level: invoke `/handoff-update` before editing.
- `.claude/settings.local.json`: use `/update-config` skill for permission changes.

---

## Session End

Before ending any session, check for orphaned processes (per L0 rule 1.9):

```powershell
Get-Process node, python -ErrorAction SilentlyContinue
```

If processes found: ask owner before terminating. Run cleanup script from
`C:\Projects\Regulatory-Review\.claude\scripts\cleanup-orphans.ps1 -Force` after confirmation.
If no processes: report "Safe to exit - no orphaned processes."

---

*Authored: 2026-05-27. References L0: `C:\Projects\CLAUDE.md`. Gate SOP: `docs/GATE_MODE_SOP.md`.*
