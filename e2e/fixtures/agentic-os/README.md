# Agentic OS E2E fixtures

These fixtures back `e2e/admin-agentic-os.spec.ts`. They give the Agentic
OS admin page a hermetic, in-repo Knowledge-Base + project tree so the
test never depends on the developer's real `C:\Projects` layout.

## Structure

```
e2e/fixtures/agentic-os/
  knowledge-base/
    PROJECTS_MAP.md          # consumed by parse-projects-map.ts
  projects/
    test-project-1/
      .claude/
        skills/
          test-skill/
            SKILL.md         # discovered by skill-discovery.ts
        agents/
          test-agent.md      # discovered by agent-discovery.ts
    test-project-2/
      .gitkeep               # sibling with no .claude/ -- empty-state coverage
```

## Project name rule

The two projects in `PROJECTS_MAP.md` use the names `SSTAC-Dashboard` and
`Site3250-KB`. They MUST appear in the launch validator's `ALLOWED_PROJECTS`
set (see `src/lib/agentic-os/launch-validator.ts`) because launch route
gate 6 rejects any other project name. The validator builds the spawn
`cwd` as `C:\Projects\<name>` -- but the spawn step is stubbed in E2E
mode (see below) so that path is never actually used.

Skill / agent discovery, in contrast, follows the `Path:` field on each
project, which DOES point into this fixture tree. That is how the spec
proves the dynamic discovery layer works without hitting the real repo.

## Required environment variables

The spec assumes the Playwright `webServer` boots `next dev` with these
three variables set:

| Variable | Value | Why |
|----------|-------|-----|
| `AGENTIC_OS_LOCAL` | `true` | Lets launch route gate 1 pass outside `NODE_ENV=development`. |
| `AGENTIC_OS_SPAWN_STUB` | `true` | Swaps `spawnAwaitingReady`'s real `child_process.spawn` for a fake that emits `[stub] launched ...` + close 0. NO `claude` / `wt.exe` is ever invoked. |
| `KNOWLEDGE_BASE_PATH` | absolute path to `e2e/fixtures/agentic-os/knowledge-base` | Tells `parse-projects-map.ts` where to read the fixture `PROJECTS_MAP.md`. |

## Running locally

From the repo root (`C:\Projects\SSTAC-Dashboard`):

```bash
# bash / git-bash
KB=$(pwd)/e2e/fixtures/agentic-os/knowledge-base
AGENTIC_OS_LOCAL=true AGENTIC_OS_SPAWN_STUB=true KNOWLEDGE_BASE_PATH="$KB" \
  npm run test:e2e -- --project=chromium agentic-os
```

```powershell
# PowerShell
$env:AGENTIC_OS_LOCAL = 'true'
$env:AGENTIC_OS_SPAWN_STUB = 'true'
$env:KNOWLEDGE_BASE_PATH = "$PWD\e2e\fixtures\agentic-os\knowledge-base"
npm run test:e2e -- --project=chromium agentic-os
```

`playwright.config.ts` forwards `process.env` to the Next.js dev server it
boots, so setting these in the parent shell is sufficient -- no edits to
the config required.

## Why a stubbed spawn (and not a mocked fetch / real CLI)

The holistic reviewer recommended this boundary explicitly:
`spawnAwaitingReady` is the single function that produces a `ChildProcess`
from a validated `{exe, args, cwd}` triple. Stubbing it leaves every gate
(feature flag, localhost, CSRF, admin, payload, allowlist) on the real
code path; only the syscall is replaced. The launch route, run registry,
and SSE plumbing all run their production code -- the test exercises the
6-gate chain end-to-end and just stops the real `claude` CLI from being
invoked.
