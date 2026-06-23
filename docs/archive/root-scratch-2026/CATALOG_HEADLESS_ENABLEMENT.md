# Catalog robot -- headless enablement (OWNER DECISION)

Plain ASCII. This documents the ONE change an agent must not make autonomously:
arming the `claude -p` headless worker to run with no human in the loop. It is a
security decision for the owner. The wrapper
(`.claude/scripts/launch_catalog_extraction.ps1`) ships UNARMED on purpose -- an
unarmed worker narrates instead of acting and the wrapper records SILENT_BAIL.

## Why two flags are needed (the two RED-review BLOCKERs)

1. **SessionStart hook blocks the worker.** The owner's global
   `~/.claude/settings.json` has a SessionStart hook (matcher `startup|resume`)
   that injects a BLOCKING "ask the user about /codex-review first" instruction.
   In a no-human `-p` session the worker reads it and stops to ask -> never acts.
2. **No permission approver.** A headless worker has no one to approve tool use,
   so without a bypass it cannot run Bash / file-write / git and again just
   narrates.

Confirmed present in `claude` CLI 2.1.156:
- `--setting-sources <user,project,local>` -- load only the named sources.
- `--dangerously-skip-permissions` / `--permission-mode bypassPermissions`.
- `--allowedTools <tools...>` -- a curated allowlist (safer alternative).

## How to arm (owner)

In `.claude/scripts/launch_catalog_extraction.ps1`, find the `$claudeArgs` array
(it has a big OWNER-DECISION comment directly above it) and add the two flags:

```powershell
$claudeArgs = @(
    '-p',
    '--output-format', 'text',
    '--setting-sources', 'project,local',    # drop the user SessionStart hook (repo-local;
                                             # does NOT edit your global settings). The repo
                                             # project/local settings carry no SessionStart hook.
    '--dangerously-skip-permissions'         # let the worker run its tools with no approver.
)
```

### Security posture / tradeoff
- `--setting-sources project,local` is repo-local and benign: it simply does not
  load the `user` settings source for this one spawned process. It does not
  modify any file. (Do NOT instead edit the global hook -- that changes every
  session.)
- `--dangerously-skip-permissions` is the powerful one. Its blast radius is
  bounded by: (a) L0 1.15 worktree isolation -- the wrapper pins
  `-WorkingDirectory` to the robot's own worktree; (b) the starter prompt's hard
  constraints (path-scoped `git add` only, never commit to main, never touch
  `src/data/*`, no DB). Still, it lets the worker run arbitrary Bash.
- **Safer alternative:** replace `--dangerously-skip-permissions` with a curated
  `--allowedTools` allowlist. It must still include `Bash` (the worker runs the
  venv python + git), so the practical constraint is modest, but it blocks
  unexpected tool classes:
  ```powershell
  '--allowedTools', 'Bash', 'Read', 'Edit', 'Write'
  ```
  Validate the exact accepted form with a DryRun smoke before relying on it.

## Smoke test after arming (writes nothing, no commit)

```powershell
.\.claude\scripts\launch_catalog_extraction.ps1 -DryRun -MaxItems 1
```

Expected: the worker reads the manifest, runs Docling on the item, drafts +
validates proposals, then (because of `-DryRun`) writes NOTHING under
`proposals/` and does NOT commit -- it reports the count it would have written
and the wrapper records a single `COMPLETED_GREEN` breadcrumb (exit 0). If you
instead see `SILENT_BAIL`, the arming did not take (re-check the two flags).

Then a real single-item run:

```powershell
.\.claude\scripts\launch_catalog_extraction.ps1 -MaxItems 1
```

Expected: `proposals/<PassId>.json` + `<PassId>.sql` are written + committed
(path-scoped), and a single `COMPLETED_GREEN` breadcrumb is emitted.

## Process safety (L0 1.9 / 1.13)

The wrapper's stall watchdog kills a hung worker (`taskkill /T /F`) after 600s of
no `-py.json` breadcrumb. After any run, confirm no orphans:
`Get-Process node, python -ErrorAction SilentlyContinue`.
