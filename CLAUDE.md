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
- **BACKSTOP RULE (applies even if the sessionstart ritual was skipped): before ANY work touching
  Supabase, SQL, migrations, branches, RLS, service_role keys, DATABASE_URL, matrix_map, or backend
  data-loads, do ALL of the following, in order, before taking any live action:**
  1. Scan the available-skills list (shown in every system-reminder) for a skill whose description
     matches the task's domain keywords -- do not wait for the user to type the slash command.
  2. Read `docs/INDEX.md` (this project's canonical documentation entrypoint) before any ad-hoc
     `rg`/filename-guessing doc search.
  3. Invoke the `/supabase` skill (`~/.claude/skills/supabase/SKILL.md`) specifically, every time,
     for Supabase/migration/branch/backend-data work -- not only when the task looks unfamiliar.
  4. **If `/supabase` or `docs/INDEX.md` cannot be found or read, STOP and tell the owner** rather
     than proceeding from memory or assumption about how Supabase works in this repo.
  5. **(D-lite, not full duplication)** `/supabase` holds safety-critical, project-specific facts --
     the direct-Postgres pooler write path, its RLS-bypass implication, and a historical
     password-reset-not-applied credential gotcha. Their EXISTENCE is named here so a session that
     reads only `CLAUDE.md` still knows to go look; the operational details themselves (connection
     string form, exact credentials, exact fix steps) are NOT copied here -- that content lives in
     ONE place (`/supabase`) to avoid drift between two copies of safety-critical facts.
  This rule's PROCESS (scan skills -> read the doc index -> invoke a matching skill if one exists)
  generalizes to other domains this project has its own tooling for (poll system, matrix-map,
  BN-RRM). It does NOT mean every domain must have a matching skill -- most don't (this project's
  local skills are currently `safe-exit`, `sessionstart`, `update-docs`; `/supabase` is a global
  skill). For a domain with no matching skill, the equivalent step is: read the domain's docs as
  routed by `docs/INDEX.md` (e.g. the Polling Gate's required doc list) instead of invoking a skill --
  do not treat "no skill exists for this domain" as a stop condition; only stop if `docs/INDEX.md`
  itself, or a skill that IS known to exist (like `/supabase`), cannot be found/read.
  (Root-caused 2026-07-08: a full Gate 2B session missed `/supabase` until pushed three times by the
  owner, and separately skipped the `sessionstart` ritual entirely, whose Step 4 already contained
  this exact instruction.)

- **SAFE AUTONOMOUS SUPABASE WORKFLOW (owner-reconciled 2026-07-09 -- supersedes the prior blanket
  "MCP fails 100%, always paste into Studio" rule as the default posture; this is the current HIGH
  AUTHORITY policy for all Supabase operations, not only Engine-v2/Regulatory Review).** The goal
  is NOT to force manual owner copy-paste for every operation -- it is owner-approved,
  codex-reviewed, exact-operation autonomous execution:
  1. Claude MAY use the `/supabase` skill and the project-scoped MCP server for Supabase
     operations, including reads and, under the gate in rule 2, writes.
  2. For ANY Supabase write/change (DDL, RPC replacement, RLS change, data write, migration
     application), ALL of the following must happen, in order, before Claude runs anything:
     a. The exact SQL or operation is drafted first -- the literal statement(s) to be run, not a
        description of intent.
     b. `/codex-review` reviews that EXACT SQL/operation BEFORE it is run. The verdict must be
        GREEN with no unresolved P0/P1/P2 findings.
     c. The planned write/change is explicitly flagged to the owner: what table/function/policy,
        what it does, and what it does NOT do.
     d. The owner explicitly approves that EXACT write/change. A prior general "yes, do Supabase
        work" does not carry forward -- each distinct write gets its own explicit approval.
     e. Only then may Claude run it, using `/supabase`/project-scoped MCP if that is the
        appropriate path for the operation (see rule 4 for bulk loads, which have a different
        approved path).
  3. For reads/verification queries: MCP is allowed WITHOUT owner paste, as long as the query is
     read-only and scoped (no `INSERT`/`UPDATE`/`DELETE`/`CREATE`/`ALTER`/`DROP`, and not a call
     into a function that itself writes).
  4. For bulk data loads: do NOT push large SQL through MCP execute_sql (the SQL becomes Claude's
     own output tokens -- budget-fatal at scale, per `/supabase`'s own guidance). Use the
     documented pooler loader (`scripts/matrix-map/apply_live_load.py`) or another
     `/supabase`-skill-approved bulk path.
  5. MCP `apply_migration` specifically remains DISALLOWED unless separately and explicitly
     authorized for that EXACT operation -- passing the rule-2 gate for a write does not, by
     itself, authorize using this specific tool; the owner must name it.
  6. Engine-v2 / Regulatory Review scope:
     - Default posture is NO WRITES.
     - An exact, owner-approved, codex-reviewed write MAY be run by Claude after a GREEN review +
       explicit owner approval, per rule 2.
     - `v2_judgments` writes follow item 11 under "What AI Must Never Do" EXACTLY, not a stricter
       or looser version of it: never write a real verdict value, for any reason, including a
       throwaway test against a disposable branch; the only acceptable paths remain (a) a test
       designed to avoid writing meaningful verdict semantics entirely, or (b) the owner supplies
       or personally runs that one write. This workflow's rule-2 write gate does NOT create a
       third path -- passing codex-review + owner approval never makes an AI-authored real-verdict
       write acceptable. Any request to loosen item 11 itself is a major protected decision
       requiring its own explicit, unambiguous owner statement, not something a general "writes
       are now allowed" policy update (like this one) covers on its own.
  7. Report every write, before and after:
     - BEFORE: the exact SQL/operation, the codex verdict, and the owner approval status.
     - AFTER: the result, the verification query's result, and rollback/stop status.
  8. If the operation deviates from the reviewed SQL, or produces unexpected output, STOP --
     report it and wait for the owner rather than improvising a fix or workaround.
- Per `cross_project_supabase_protocol_explore_before_assume.md`: ALWAYS give the owner (or, under
  the read-path in rule 3 above, retrieve directly via scoped read-only MCP) exploratory
  information BEFORE drafting any migration, RPC, RLS policy, or role. ZERO assumptions about
  schema; verify "missing" objects twice before creating.

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
- `npm run lint` -- ESLint CLI (`eslint .`; migrated off the deprecated `next lint`, removed in
  Next 16). `npm run lint:fix` applies autofixes. Uses the flat config `eslint.config.mjs`.
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
  HITL professional judgments. AI never writes through `v2_judgments` or proposes verdicts --
  see item 11 under "What AI Must Never Do" for the exact rule, including its two narrow
  carve-outs, which this line does not restate.
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
5. Call MCP `apply_migration` without a SEPARATE, explicit owner authorization naming that exact
   operation (default: disallowed). Call MCP `execute_sql` for a WRITE without first: drafting the
   exact SQL, getting a GREEN `/codex-review` on that exact SQL, flagging it to the owner, and
   getting the owner's explicit approval for that exact write (see the Supabase Protocol section
   above). Read-only, scoped `execute_sql` queries do not need this gate.
6. Copy `rraa_v3_2.db` into the dashboard folder or suggest sync commands for it.
7. Use `git add .` / `-A` / `-u` for staging.
8. Delete or modify any file under `supabase/migrations/` that has already been applied.
9. Use emoji, smart quotes, em-dashes, or any non-ASCII character (code point > 127) in docs.
10. Spawn more than 3 background subagents simultaneously.
11. Write a real verdict value (e.g. `ADEQUATE`) into `v2_judgments` for ANY reason, including a
    throwaway test/validation script against a disposable Supabase branch -- rule 1 has NO
    "it's just a test" exception, and NO owner sign-off makes it acceptable for the AI itself to
    perform this write. If a test needs to exercise the judgment-upsert mechanism, the only
    acceptable paths are: (a) design the test to avoid writing meaningful verdict semantics
    entirely (e.g. a value that is not a real verdict enum member, if schema/constraints allow), or
    (b) have the OWNER supply or personally run that one write -- never assume disposability makes
    an AI-authored verdict write fine. (Root-caused 2026-07-08: an AGY-drafted Gate 2B
    branch-validation script wrote `verdict: "ADEQUATE"` into `v2_judgments` as a self-check; caught
    by adversarial codex review before any branch existed to run it against, not by design.)

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

Two required close-out steps, in order.

### 1. Continuity-doc refresh (MANDATORY at every checkpoint / close-out)

The session-to-session handoff is the **primary** continuity mechanism; auto-memory and scattered
per-feature plan docs are **supplements, not substitutes**. At every checkpoint or close-out:

- Refresh the current handoff -- the DATED session-anchor continuity file, i.e. the newest
  `*_HANDOFF_*.md` (this repo uses `FRESH_SESSION_HANDOFF_<date>_*.md` /
  `NEXT_SESSION_HANDOFF_<date>_*.md`; matches L0's `*_HANDOFF_*.md` rule, not a bare `*_HANDOFF.md`) --
  archive-before-edit + version/date bump, via `/handoff-update`.
- **COMMIT it** (path-scoped). A handoff left untracked in the working tree does not survive as
  continuity for the next session and is not visible to a fresh checkout.
- This is a REQUIRED close-out step, not optional. Memory and per-feature plan docs do not discharge it.

Drift incident (2026-06-19): a cross-project audit found this repo's ROOT-LEVEL session-anchor handoffs
(`FRESH_SESSION_HANDOFF_*` / `NEXT_SESSION_HANDOFF_*`) lagging the code by ~19 days -- the newest such
files were untracked working-tree scratch and the last *committed* root session-anchor handoff was
2026-05-31, because the refresh was optional and these handoffs were left uncommitted. (Per-lane
handoffs under `docs/` were committed more recently; this rule is about the ROOT continuity anchor.)
This rule (mandatory refresh + commit) exists so that cannot recur silently. (Parallel to the
Sediment-DRA-Pipeline / DRA-KB doc-drift fix.)

### 2. Orphaned-process check (per L0 rule 1.9)

Before ending any session, check for orphaned processes:

```powershell
Get-Process node, python -ErrorAction SilentlyContinue
```

If processes found: ask owner before terminating. Run cleanup script from
`C:\Projects\Regulatory-Review\.claude\scripts\cleanup-orphans.ps1 -Force` after confirmation.
If no processes: report "Safe to exit - no orphaned processes."

---

*Authored: 2026-05-27. References L0: `C:\Projects\CLAUDE.md`. Gate SOP: `docs/GATE_MODE_SOP.md`.*
