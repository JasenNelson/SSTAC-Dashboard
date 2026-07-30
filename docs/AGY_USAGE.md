# AGY CLI Usage - SSTAC-Dashboard

Status: canonical repo-specific runbook. **PARTIALLY STALE -- see the drift notice below.**
Last verified: 2026-07-25.
Scope: `C:\Projects\SSTAC-Dashboard` and its linked worktrees.

> **STALE FOR AGY 1.1.8 (recorded 2026-07-30). Do not follow the invocation details in this
> file without re-probing them first.**
>
> This runbook's invocation specifics were verified against **AGY 1.1.7 on 2026-07-25**. AGY
> has since moved to **1.1.8**, and at least two classes of detail are known to have drifted:
> **model slugs**, and **Go-duration syntax** for timeout-style flags. Any command below that
> names a model or a duration should be treated as unverified until re-probed against the
> installed CLI.
>
> WHAT IS NOT CLAIMED HERE. A replacement AGY-first workflow is **NOT** documented as proven.
> Mission Control has containment and review canaries pending; **those receipts must land
> before this runbook's workflow sections are rewritten.** Guessing the 1.1.8 invocation now
> would repeat the exact failure this file exists to prevent -- a runbook that reads as
> authoritative while describing a CLI that no longer behaves that way.
>
> FOLLOW-UP, owner-triaged: re-probe `agy --version`, `agy --help`, the model menu and the
> duration/timeout flag syntax on 1.1.8, capture the receipts, and only then update the
> invocation and workflow sections. Until then, prefer a bounded live probe over this file's
> examples.

This guide overrides generic AGY examples when work targets SSTAC-Dashboard.
Read it with:

1. `C:\Projects\CLAUDE.md`
2. `C:\Projects\sstac-dashboard\AGENTS.md`
3. `C:\Projects\AI_CLI_REFERENCE.md`
4. `C:\Projects\sstac-dashboard\SSTAC_AI_PIPELINE.md`
5. `C:\Projects\sstac-dashboard\docs\GATE_MODE_SOP.md`

The shared CLI reference owns installed-version and general CLI facts. This
file owns SSTAC permissions, launch shape, supervision, review cadence, and
acceptance rules.

## Role And Mode Selection

- Claude or the active mission-control Codex session owns scope, safety,
  sequencing, final verification, and owner-facing decisions.
- AGY owns bounded mechanical implementation, evidence gathering, test
  harnesses, inventories, long verification runs, and packet drafting.
- Codex review runs inside the AGY runway at planned checkpoints. AGY must
  correct accepted findings and re-review; a one-shot review label is not a
  ship gate.
- The owner should not be a prompt courier. Mission control launches AGY
  directly when its environment permits. Otherwise it provides one file-backed
  workplan and one short PowerShell command.

Choose one mode before launch:

| Mode | Typical duration | Use |
|---|---:|---|
| Rapid Interactive | under 30 minutes | High-uncertainty exploration or an immediate owner decision |
| Bounded Batch | 30-120 minutes | One clearly bounded implementation or verification unit |
| Autonomous Multi-Hour | 4-12 hours | A runway of independent units, reviews, gates, and fallback work |
| Correction/Recovery | bounded by the defect | Repair a failed run, review finding, or existing PR candidate |

Requests for overnight, multi-hour, autonomous, or workhorse execution default
to Autonomous Multi-Hour. Do not split an approved runway into repeated small
prompts unless a true owner gate or safety deviation requires recovery.

## SSTAC-Specific Boundaries

SSTAC differs from other projects on this machine:

- The primary checkout is often dirty and may be far behind `origin/main`.
  Inspect it, but use object-pinned reads or a dedicated worktree instead of
  switching branches in the shared checkout.
- Parallel worktrees normally live under
  `C:\Projects\SSTAC-Dashboard-worktrees\`; task-specific candidates may also
  exist under `C:\tmp`. Grant only the exact roots needed by the workplan.
- `node_modules` may be a junction to the primary checkout. AGY may not delete
  worktrees, prune branches, clean files, or manipulate junctions.
- Use exact-path staging only. Never authorize `git add .`, `git add -A`, or
  `git add -u`.
- Use `npm run build:monitored:clean -- -TimeoutSeconds 360 -PollSeconds 10`.
  Never substitute raw `npm run build`.
- API routes must enforce their own guards; middleware does not protect them.
- Supabase is read/exploration first. No live SQL write, migration apply,
  publication flip, or data write without the owner's explicit approval of the
  exact operation and the preflight/postflight protocol in `AGENTS.md`.
- Merge requires explicit owner/HITL APPROVAL of the exact reviewed SHA and scope, with
  required CI green. Approval is not the same as execution: once the owner has approved
  that exact SHA, an authorized executor may perform the merge. **AGY is not such an
  executor** -- it must not run `gh pr merge` -- and no executor may ever self-approve.
  See `AGENTS.md` MERGE protocol, corrected 2026-07-30.
- Draft-to-ready conversion remains owner-gated and requires explicit authorization
  for that exact PR.
- Scheduler, MCP, and Ollama mutation, deploy, cleanup, process termination,
  branch pruning, and worktree deletion remain owner-gated unless the owner
  explicitly authorizes that exact action in the launch contract.

## Prompt Contract

Put the full workplan in a run-scoped file such as:

`C:\Projects\sstac-dashboard\.tmp\mission-control\<lane>-<date>\AGY_WORKPLAN.md`

The workplan must contain:

1. mission objective and measurable completion criteria;
2. mode, maximum runtime, and minimum useful runtime;
3. launch queue plus fallback backlog large enough for the timebox;
4. exact readable and writable roots;
5. forbidden paths and actions;
6. ranked execution units and dependencies;
7. required tests, SSTAC gates, and GitHub checks;
8. targeted, strategic, holistic, and comprehensive Codex checkpoints as
   appropriate to the scope;
9. durable state, heartbeat, command-log, and resume artifacts;
10. stall criteria, retry budget, and stop conditions;
11. final artifact and owner-decision contract.

For a multi-hour run, the initial units are a runway, not a short checklist.
AGY continues into safe fallback work until the minimum runtime is met or every
remaining item is blocked with evidence.

Treat all previous handoffs and closeouts as claim lists. Require AGY to
re-prove volatile SHAs, PR state, worktree state, runtime state, test counts,
and external-check status.

## Codex Review Loops Inside AGY

Scale review depth with the work:

- Targeted review after a code, SQL, test, harness, or security-sensitive diff.
- Strategic review before changing the lane, architecture, or project framing.
- Holistic review before milestone closeout across all affected surfaces.
- Comprehensive final review for a large autonomous packet or multi-unit run.

At every checkpoint AGY must:

1. create an object-pinned, self-contained review prompt;
2. run Codex and save the full receipt;
3. classify each finding as accepted, disputed with evidence, or owner-gated;
4. correct accepted findings and perform a ripple sweep;
5. re-run a fresh review over the corrected bytes;
6. iterate to mutual-agreement GREEN or preserve an evidence-backed
   YELLOW/RED result.

Use the current `codex-review` skill for the two-tier model strategy. Never
guess a model ID. A first-round GREEN satisfies an iterative checkpoint only
when it contains no actionable findings and the required high-reasoning
confirmation is GREEN on identical bytes.

## Validated AGY Invocation

The live CLI was AGY 1.1.7 when rechecked on 2026-07-25. The exact SSTAC
model/mode/root invocation passed bounded probes and launched with:

```text
--model "Gemini 3.1 Pro (High)"
--mode accept-edits
--add-dir "<each exact required root>"
--print-timeout "<the bounded run time>"
-p "Read <absolute workplan path> and execute it exactly."
```

Important:

- Do not pass `--effort` with `Gemini 3.1 Pro (High)`. AGY rejects that
  combination before doing work.
- Do not pass `--dangerously-skip-permissions`.
- Use one `--add-dir` per exact repo, worktree, scratch, or skill root required
  by the contract. Do not grant `C:\Projects` or a whole `.git` parent merely
  for convenience.
- Verify `agy --version`, `agy --help`, the selected model, login, and a bounded
  smoke from the actual launch environment before a long run.
- Use `System.Diagnostics.ProcessStartInfo.ArgumentList` rather than building a
  shell-quoted command string. Set `UseShellExecute = $false`,
  `CreateNoWindow = $true`, and redirect stdout/stderr.
- AGY output is evidence, not authority. Final acceptance uses live files,
  receipts, exit status, and independent verification.
- A successful invocation probe does not establish multi-hour reliability. The
  2026-07-25 broad recovery worker accepted the invocation but closed RED after
  about 12 minutes with 11 of 22 required artifacts.

## Supervised Multi-Hour Launch

Every AGY run expected to exceed five minutes uses the
`supervise-headless-ai-worker` skill and a controller-owned contract.

Recommended bundle:

```text
.tmp\mission-control\<lane>-<date>\
  AGY_WORKPLAN.md
  launch-supervised-agy.ps1
  run-agy-worker.ps1
  runs\<UTC stamp>\
    AGY_WORKPLAN_RESOLVED.md
    preflight\
    controller\
    worker\
```

The owner-facing launch should be one short command:

```powershell
pwsh -NoLogo -NoProfile -File `
  "C:\Projects\SSTAC-Dashboard\.tmp\mission-control\<bundle>\launch-supervised-agy.ps1"
```

Mission control may launch the same script hidden and detached when it can
retain process custody and write a launch receipt. Do not use Task Scheduler
just to avoid a terminal window; scheduler mutation is separately owner-gated.

### Required Supervisor Invariants

A supervisor detects stalls and rejects incomplete output; it does not prevent a
write-enabled worker from violating its prompt before exit. Textual prohibitions
are not a permission boundary.

- Never grant a write-enabled autonomous worker the dirty primary checkout.
  Use a dedicated worktree with only the task's files and git authority, or an
  independently enforced read-only sandbox for audit work.
- If an audit needs primary-checkout facts, mission control captures object-
  pinned read-only receipts and gives those receipts to AGY. Do not let AGY
  normalize, stash, pull, back up, move, or clean the primary checkout.
- A dedicated worker output directory does not make the separately granted repo
  root read-only. Validate the actual permission boundary before launch.
- Create a unique run root for every attempt.
- Keep `ControllerRoot` absent or empty at supervisor start. The resolved
  prompt belongs in the run root, not inside the controller directory.
- Run a short, no-AGY supervisor handshake before the real worker.
- The wrapper, not AGY, owns `breadcrumb.json`.
- Initial `last_progress_at` uses the wrapper process start time in UTC. Later
  updates use a safely non-future UTC value. This avoids clock-boundary
  rejection by the supervisor.
- Record wrapper PID, AGY PID, start times, executable paths, logs, exact
  arguments, owned descendants, artifact paths, and the project boundary.
- Require fresh, nonempty artifacts. Completion text alone is insufficient.
- Accept GREEN only when the native exit code is zero, the terminal breadcrumb
  is valid, all required artifacts are accepted, and the packet's own terminal
  status is consistent.
- Default retry budget is zero. A retry uses a new attempt/controller
  directory after proving prior process cleanup and unchanged authority.
- The reference supervisor cannot recover after controller loss. Never claim
  that a new session adopted an unknown worker.
- Never kill by image name. Re-prove PID, start time, executable path, and
  ownership before any bounded termination.

## Durable Artifacts

Every multi-hour worker creates immediately:

- `RUN_STATE.md`
- `COMMAND_LOG.md`
- `HEARTBEAT.log`
- `RESUME_PROMPT.md`

Add task-specific evidence and review artifacts to the supervisor's required
artifact list. `RUN_STATE.md` is updated before and after every long command.
Heartbeat cadence should normally be 5-10 minutes; the supervisor stall window
must be longer than the expected quiet phase.

Classify a stall using multiple signals: owned process state, heartbeat,
artifact/log growth, current phase, and expected timeout. Silence alone is not
proof of a stall.

## Failures Seen In SSTAC

| Failure | Cause | Prevention |
|---|---|---|
| `ControllerRoot must be new or empty` | Prompt or another file was written under the controller root before launch | Put prompts in the run root and create a new controller directory per attempt |
| `INVALID_BREADCRUMB: progress is in the future` | Startup timestamp was slightly ahead of the supervisor clock comparison | Use process start UTC initially and safely non-future UTC for later writes |
| `INVALID_BREADCRUMB: invalid status` | Wrapper used a status outside the supervisor schema | Use only the supervisor's documented states |
| Immediate nonzero exit with no artifacts | `--effort high` was passed to a model that does not support it | Probe the exact production invocation and omit unsupported flags |
| False or fabricated state-map facts | AGY trusted prior packets or expanded short SHAs | Re-run volatile facts, store raw receipts, and never construct a full SHA |
| Premature `COMPLETED_GREEN` | A broad inventory was treated as a short checklist | Enforce minimum runtime, fallback backlog, iterative reviews, and artifact acceptance |
| Primary checkout mutation despite a read-only prompt | A write-enabled worker received the dirty primary repo and ran stash, backup/move, and pull operations | Do not grant the primary checkout; use an isolated worktree or enforced read-only boundary and pre-captured receipts |
| Worker says GREEN but controller says RED | Closeout text ignored missing artifacts, stale state, or contract violations | Controller acceptance wins; preserve the RED packet and independently audit side effects |

## Acceptance And Closeout

Mission control independently checks:

- exact ref and PR SHAs from live commands;
- primary checkout dirtiness and worktree/branch crosswalk;
- diff scope and exact staged paths when staging was authorized;
- local gate receipts and GitHub checks on the final tip;
- review finding dispositions and identical-byte final confirmation;
- required artifacts, timestamps, hashes, and terminal process cleanup;
- absence of forbidden live writes, deploy, scheduler/MCP/Ollama mutation, cleanup, merge,
  and broad-staging actions.

Every closeout includes:

- summary and verification status;
- what the run establishes and what remains a claim or owner gate;
- options;
- recommendation with rationale;
- the next full AGY workplan or short launch command when more work is useful;
- `Claude-token spend risk for next step: low/medium/high`;
- `AGY delegation opportunity: yes/no`.

Do not respond to a completed multi-hour run with a new series of small AGY
prompts. Verify the packet comprehensively, batch owner decisions, and launch
the next substantial runway only when the current one is genuinely complete.
