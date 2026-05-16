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

## Step 9 / Pattern E (embedded xterm.js modal) -- not E2E covered

The embedded terminal modal at `/admin/agentic-os` (the "Open in embedded
terminal" buttons on the project row + detail panel) is intentionally NOT
exercised by Playwright in this MVP step. It depends on:

1. The PTY sidecar server (`scripts/agentic-os-pty-server.mjs`) being
   running on `ws://127.0.0.1:3101/pty`. The sidecar refuses to start
   unless `AGENTIC_OS_PTY_SECRET` is set in the environment.
2. A working `node-pty` (Windows prebuilds ship with the npm install but
   Playwright's hermetic container does not guarantee them).
3. A live `claude` CLI in `PATH` -- the PTY spawns it directly. There is
   no equivalent of `AGENTIC_OS_SPAWN_STUB=true` for the WS server path
   in this MVP step.

The unit tests cover the JWT signing/verification, the feature-flag
matrix, the token-mint route's gate chain, and the `open_embedded` guard
on the launch route. Manual smoke-test procedure is documented in the
project root README / commit message body.

A future test pass could add a WS-mode stub (`AGENTIC_OS_PTY_STUB=true`)
that replaces `pty.spawn` with a fake emitting a fixed transcript, but
that is out of scope for step 9 itself.

## Why a stubbed spawn (and not a mocked fetch / real CLI)

The holistic reviewer recommended this boundary explicitly:
`spawnAwaitingReady` is the single function that produces a `ChildProcess`
from a validated `{exe, args, cwd}` triple. Stubbing it leaves every gate
(feature flag, localhost, CSRF, admin, payload, allowlist) on the real
code path; only the syscall is replaced. The launch route, run registry,
and SSE plumbing all run their production code -- the test exercises the
6-gate chain end-to-end and just stops the real `claude` CLI from being
invoked.
