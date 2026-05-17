# Agentic-OS AI Subscriptions Panel + IA Refactor Handoff (2026-05-16)

Lifecycle: REFERENCE
Last reframed: 2026-05-16

This is a feature-handoff doc for the AI Subscriptions panel and the
companion information-architecture (IA) refactor that landed under
`/admin/agentic-os/*` this session. It is REFERENCE-tier: helpful for the
next contributor (human or AI in a fresh context) to understand what
shipped, what was deferred, and where to start PR-2. It is NOT canonical
project status -- canonical lives in `docs/INDEX.md` and
`docs/_meta/docs-manifest.json`. Do not treat anything here as global
"current project status" and do not repeat volatile metrics (test counts,
build sizes) -- those belong in the manifest's `facts` section or in
commit bodies.

## TL;DR

- New panel: `/admin/agentic-os/subscriptions` shows a card grid of AI
  provider subscriptions sourced from owner-curated markdown at
  `C:\Projects\Knowledge-Base\AI_SUBSCRIPTIONS.md`.
- 4 new `check_*` launch templates let the panel fire Pattern A live-check
  launches (claude auth status, codex login status, cursor agent about,
  ollama list) through the existing `/api/agentic-os/launch` route.
- IA refactor: introduced a shared server-layout + sidebar + runtime
  context pattern at `/admin/agentic-os/*` so future PR-2 sibling panels
  (GitHub, Vercel, NotebookLM) drop in without rebuilding chrome.
- Defense in depth: every `/admin/agentic-os/*` page also calls
  `requireAgenticOsPageAccess()` directly (layout RSC caching on
  client-side sibling nav cannot be relied on as a per-navigation guard).
- Branch `feat/agentic-os-ai-subscriptions-panel` is pushed; PR #116 is
  open (draft) against `main`. 6 commits ahead of `main` (`ceaedb6`).

## Branch + commit chain

Branch: `feat/agentic-os-ai-subscriptions-panel` (pushed to origin; PR
#116 open as draft).

6 commits ahead of `main` (`ceaedb6`, the prior PR #115 merge):

| SHA       | Type | Summary |
|-----------|------|---------|
| 8d35d31   | feat | AI subscriptions parser + panel + check-usage launches |
| 586eaab   | feat | IA refactor -- shared layout + sidebar + subscriptions route |
| c1a3b21   | fix  | Wrap codex/agent .cmd shims via cmd.exe (codex P2 on 8d35d31) |
| 0b3dcde   | fix  | Page-level auth guards on projects + subscriptions routes (codex P2 on 586eaab) |
| e8654ed   | docs | Add AI subscriptions panel + IA refactor handoff (R4 YELLOW -> R5 GREEN) |
| this commit | fix + docs | Strip `extras` from RSC payload (codex holistic P2) + update handoff chain (codex holistic P3) |

See individual commit bodies for module-level detail, test counts, and
file-by-file rationale.

## Architecture summary

### Route structure

```
/admin/agentic-os/
  layout.tsx                       <- server layout: auth + flag-gate + PTY probe + agent-count fetch
  page.tsx                         <- Projects view (existing PR-115 panel; AgenticOsClient)
  subscriptions/
    page.tsx                       <- AI Subscriptions view entry (calls requireAgenticOsPageAccess)
    SubscriptionsView.tsx          <- card grid + Pattern A launch glue
```

### Layout + chrome pattern

- Server layout at `src/app/(dashboard)/admin/agentic-os/layout.tsx` runs
  auth + flag-gate + PTY probe + agent-count fetch ONCE for all child
  routes, then renders `AgenticOsLayoutClient` with the resulting
  runtime state.
- `src/app/(dashboard)/admin/agentic-os/AgenticOsLayoutClient.tsx` owns
  the client chrome and wraps `{children}` in an
  `AgenticOsRuntimeProvider`.
- `src/components/agentic-os/AgenticOsSidebar.tsx` is a left-rail
  category nav: Projects + AI Subs are active; GitHub / Vercel /
  NotebookLM are disabled with "Future PR-2" tooltips.
- `src/lib/agentic-os/runtime-context.ts` exposes
  `AgenticOsRuntimeProvider` + `useAgenticOsRuntime()` (hook hard-throws
  on missing provider so accidental top-level usage fails loudly).

### Page-level auth-guard helper

- `src/lib/agentic-os/page-auth-guard.ts` exposes
  `requireAgenticOsPageAccess()`. BOTH route entry points
  (`page.tsx` for Projects and Subscriptions) call this in addition to
  the layout's auth check. See "Page-level auth-guard lesson" below.

### Data flow (AI Subscriptions)

```
Knowledge-Base/AI_SUBSCRIPTIONS.md  (owner-curated; frontmatter + per-provider sections)
        |
        v
src/lib/agentic-os/parse-ai-subscriptions.ts  (parser; mirrors PROJECTS_MAP.md pattern)
        |
        v
/admin/agentic-os/subscriptions/page.tsx  (server reads + parses)
        |
        v
SubscriptionsView.tsx  (card grid: tier, billing cycle, reset date, last-checked, usage URL, optional "Check now")
        |
        v (on "Check now")
/api/agentic-os/launch  (existing Pattern A route; runs check_* template)
```

### check_* launch templates

Added in `src/lib/agentic-os/launch-validator.ts`:

| Template | Command | Spawn shape |
|----------|---------|-------------|
| check_claude_auth     | `claude auth status`        | Direct spawn (real .exe) |
| check_codex_login     | `cmd.exe /c codex login status` | cmd.exe wrapper (.cmd shim) |
| check_cursor_about    | `cmd.exe /c agent about`        | cmd.exe wrapper (.cmd shim) |
| check_ollama_models   | `ollama list`               | Direct spawn (real .exe) |

The cmd.exe wrapper shape for codex/agent mirrors the wt.exe BUG-3 fix
from PR #115 (commits `85e069c` + `3df94ab`). See ".cmd shim lesson"
below.

## Files added / changed

Grouped by category. Use `git show <sha>` against the 4 commits for
authoritative file lists.

| Category | Path | Purpose |
|----------|------|---------|
| Server (layout) | `src/app/(dashboard)/admin/agentic-os/layout.tsx` | Auth + flag-gate + PTY probe + agent-count |
| Server (route) | `src/app/(dashboard)/admin/agentic-os/subscriptions/page.tsx` | Subscriptions route entry + page-auth-guard call |
| Server (route) | `src/app/(dashboard)/admin/agentic-os/page.tsx` | Projects route (calls page-auth-guard; otherwise unchanged behavior) |
| Client (chrome) | `src/app/(dashboard)/admin/agentic-os/AgenticOsLayoutClient.tsx` | Client layout wrapper + runtime provider |
| Client (chrome) | `src/components/agentic-os/AgenticOsSidebar.tsx` | Left-rail category nav |
| Client (view) | `src/app/(dashboard)/admin/agentic-os/subscriptions/SubscriptionsView.tsx` | Route-scoped view wrapper (server data -> client panel) |
| Client (panel) | `src/components/agentic-os/AiSubscriptionsPanel.tsx` | Reusable subscriptions card grid + Pattern A launch glue |
| Lib (runtime) | `src/lib/agentic-os/runtime-context.ts` | Provider + hook |
| Lib (parser) | `src/lib/agentic-os/parse-ai-subscriptions.ts` | Parses AI_SUBSCRIPTIONS.md |
| Lib (auth) | `src/lib/agentic-os/page-auth-guard.ts` | requireAgenticOsPageAccess() |
| Lib (launch) | `src/lib/agentic-os/launch-validator.ts` | 4 new check_* templates |
| Data | `C:\Projects\Knowledge-Base\AI_SUBSCRIPTIONS.md` | Owner-curated subscriptions source (outside this repo) |
| Tests | (per commit bodies) | vitest passed per session verification; see commit bodies for counts |

## Codex iterative-review audit trail

8 rounds, converged GREEN at R8. Mutual-agreement discipline applied
throughout: every finding was empirically verified against the codebase
before agreeing or pushing back; no hallucinated findings were accepted
across these rounds.

| Round | Target | Verdict | Outcome |
|-------|--------|---------|---------|
| R1 | 8d35d31 (subscriptions feat) | YELLOW | 1 P2 valid: codex/agent .cmd shims spawn ENOENT -> fixed in `c1a3b21` |
| R2 | 586eaab (IA refactor) | YELLOW | 1 P2 valid: layout-only auth not a per-nav guard -> fixed in `0b3dcde` |
| R3 | Holistic over 4 commits | GREEN | No blockers at the 4-commit state |
| R4 | Handoff doc (uncommitted) | YELLOW | 2 P2 valid: wrong client paths + missing INDEX/manifest registration -> fixed in `e8654ed` |
| R5 | Handoff doc + INDEX + manifest (staged) | GREEN | No new findings on the doc commit |
| R6 | Holistic over 5 commits (pre-merge checkpoint) | YELLOW | 2 valid: P2 `extras` RSC payload leak + P3 stale handoff commit chain -> fixed in this commit |
| R7 | This combined fix (uncommitted) | YELLOW | P2 code fix verified structurally sound (tsc + targeted vitest GREEN); 1 P3 inline doc self-consistency (R7 row marked pending while doc claimed convergence) -- resolved by this edit |
| R8 | Closeout verify (uncommitted, self-consistency fix) | GREEN | All findings closed; mark-ready gate cleared |

How the P2/P3 findings from R6 were verified before agreeing:

- **RSC payload leak**: read `parse-ai-subscriptions.ts` confirming
  `extras: Record<string, string>` lands on `AiSubscription` and the
  parser preserves unknown `**Bold:**` fields there; grep'd
  `AiSubscriptionsPanel.tsx` confirming no `extras` reference (only the
  named fields). Page.tsx passed the full objects unchanged, so RSC
  serialized `extras` into the client component props. Fix narrows the
  type chain to `DisplayAiSubscription = Omit<AiSubscription, 'extras'>`
  and transforms at the server -> client boundary via
  `toDisplayAiSubscription`.
- **Stale commit chain**: literal -- handoff said "4 commits" but the
  branch tip was 5 (incl. `e8654ed`). Updated to 6 (incl. this commit).

How the R1-R4 P2 findings were verified before agreeing:

- **.cmd shim**: reproduced `child_process.spawn('codex', ['login', 'status'])`
  -> `ENOENT` on Windows; reproduced `spawn('cmd.exe', ['/c', 'codex',
  'login', 'status'])` -> exit 0 with expected output. Same shape as the
  PR #115 wt.exe BUG-3 fix; high prior. Agreed and fixed.
- **Layout-only auth**: Next.js App Router caches layout RSC on
  client-side sibling navigation between routes that share a layout;
  layout auth runs at the initial server render, not on every nav. A
  signed-out client transitioning between sibling routes does NOT
  re-trigger layout auth. Page-level guard at each `page.tsx` is the
  defense-in-depth fix.

## The .cmd shim lesson (for future Windows CLI integrations)

`child_process.spawn(name, args)` on Windows resolves `name` against
`PATHEXT` only when `shell: true` is set OR when the resolved file is a
real `.exe`. `.cmd` and `.bat` shims (the way npm-installed CLIs like
`codex` and Cursor's `agent` ship on Windows) do NOT spawn directly and
return `ENOENT`. The portable fix:

```
spawn('cmd.exe', ['/c', '<tool>', ...args], { shell: false })
```

NOT `shell: true` (introduces argument-quoting hazards). Same shape as
the wt.exe BUG-3 fix in PR #115 commits `85e069c` + `3df94ab`. Apply
this whenever wiring a new Windows CLI launch template -- if the tool
ships as a `.cmd` shim, wrap it. If it ships as a real `.exe` (claude,
ollama), spawn it directly.

## Page-level auth-guard lesson

Next.js App Router caches the rendered layout RSC payload on
client-side sibling navigation. Concretely: when a user is on
`/admin/agentic-os` and the client router navigates to
`/admin/agentic-os/subscriptions`, the layout component is NOT
re-rendered on the server -- only the child page is fetched. This means
auth checks placed in the layout run only on initial entry to the
layout subtree, not on every navigation within it.

Mitigation: call `requireAgenticOsPageAccess()` at the top of EVERY
`/admin/agentic-os/*/page.tsx`. The layout check stays (cheap belt for
initial loads + cold-cache cases); the page check is the suspenders.
This is defense in depth, not redundancy.

## IA divergence rationale

The original brief envisioned the sidebar component as a true layout
shell whose `{children}` slot held each route's view-specific sub-nav
(e.g., Projects' Views/Running/Quick-Actions column). The clean way to
do this in Next.js App Router requires parallel routes (`@sidebar` slot)
or React portals -- both meaningful additional complexity for PR-1.

Pragmatic resolution for PR-1:

- The sidebar's `{children}` slot stays empty.
- Each route renders its own sub-nav inline within its main pane.
- Projects view keeps its existing Views/Running/Quick-actions as the
  leftmost column of its OWN 3-col internal grid (no change to
  AgenticOsClient layout).
- `AgenticOsSidebar` accepts a `children` prop and is structurally
  ready for the cleaner pattern when a future PR adopts parallel routes.

Documented in commit `586eaab` body.

## PR-2 scope sketch

Three sibling panels, all following the same shape as Subscriptions:

1. **GitHub repo info** -- per-repo cards (PRs, stars, last commit, CI
   status). Data via `gh` CLI; spawn shape: `gh` is a real .exe -> direct
   spawn.
2. **Vercel deploy info** -- per-project cards (latest deploy URL, build
   time, function logs). Data via `vercel` CLI; verify spawn shape on
   the install (likely a .cmd shim under npm global -> use cmd.exe
   wrapper).
3. **NotebookLM projects** -- static URL list with optional MCP query
   integration (the `notebooklm` MCP server is already in the owner's
   Claude Code config).

Each panel:

- Adds a `C:\Projects\Knowledge-Base\<TOPIC>.md` data file
  (frontmatter + per-item sections; mirrors `AI_SUBSCRIPTIONS.md`).
- Adds a parser in `src/lib/agentic-os/parse-<topic>.ts`.
- Adds a view component + `/admin/agentic-os/<topic>/page.tsx` route.
- Enables the corresponding sidebar slot (currently disabled with
  "Future PR-2" tooltip).
- Calls `requireAgenticOsPageAccess()` at the top of its `page.tsx`.

If PR-2 also adopts parallel routes for the sidebar children-slot, the
right-detail panel currently inside `AgenticOsClient`'s 3-col grid
(Projects-only) should move to a layout-level right-side slot,
conditional on the active route.

## Open items (not new to this session)

1. **`/safe-exit` Pattern A launch returns HTTP 500** in owner's local
   environment; parked previously pending DevTools response detail (see
   PR #115 close).
2. **Admin-guard `next` param refactor**: when
   `requireAdminForServerComponent` learns a `next` parameter, both
   `src/app/(dashboard)/admin/agentic-os/layout.tsx` and
   `src/lib/agentic-os/page-auth-guard.ts` should switch from inline
   `createServerClient` to the shared helper. The matrix-review-admin
   page has the same divergence for the same reason; coordinate the
   sweep.
3. **Right-detail panel relocation**: when PR-2 adopts the
   sidebar+children-slot pattern, move the right-detail panel out of
   `AgenticOsClient`'s 3-col grid into the layout's right-side slot
   (conditional on the active route).

## Pointers (canonical sources)

- `docs/INDEX.md` -- documentation index (authoritative navigation).
- `docs/_meta/docs-manifest.json` -- machine-readable facts (test counts,
  versions, etc.); update there, not here.
- Commits `8d35d31`, `586eaab`, `c1a3b21`, `0b3dcde` -- module-level
  rationale, file lists, and test results.
- PR #115 merge commit `ceaedb6` -- prior agentic-os baseline (Projects
  panel + Pattern A launch route + wt.exe BUG-3 fix shape).
- Engine repo session memo:
  `C:\Projects\Regulatory-Review\.tmp_presentation\master\AGENTIC_OS_SESSION_HANDOFF_2026_05_16_EOD.md`
  -- cross-repo session context (Knowledge-Base data layer authoring,
  codex review orchestration, owner timeline).

---

End of handoff.
