# SSTAC AI Pipeline

Status: authoritative operational runbook (v0.2).
Scope: `C:\Projects\SSTAC-Dashboard`.

## Purpose

This runbook defines the multi-AI workflow for SSTAC-Dashboard so work can be delegated without burning Claude, Codex, and AGY tokens on the wrong layer.

SSTAC has multimodal and data-heavy work: PDFs, images, SQLite ledgers,
Supabase-gated deltas, matrix options, batch enrichment, and long-running scripts.
The lane should use AGY as the primary execution workhorse, Claude or the active
mission-control Codex session as orchestrator, Codex as reviewer, and
OpenCode/GLM-5.2 as a low-risk context and review-prep assistant.

## Roles

| Role | Primary tool | Responsibility |
|---|---|---|
| Orchestrator | Claude or mission-control Codex | Decide scope, sequence work, adjudicate tradeoffs, stop unsafe runs, synthesize handoffs. |
| Workhorse | AGY CLI | Execute bounded implementation, multimodal extraction, PDF/image/database work, long verification runs, and autonomous multi-hour runways. |
| Reviewer | Codex CLI | Perform targeted, strategic, holistic, and comprehensive adversarial review loops. Prefer running Codex inside AGY and iterating corrections to mutual GREEN. |
| Scout | OpenCode/GLM-5.2 | Read-only repo scouting, stale-doc detection, log triage, test-output clustering, handoff drafting, Codex review-bundle preparation. |
| Owner | J. Nelson | Gate live data loads, destructive process actions, major architecture shifts, and cross-lane scheduling conflicts. |

## Default Flow

1. Active mission control frames the task, constraints, acceptance criteria, and
   escalation triggers.
2. Mission control selects Rapid Interactive, Bounded Batch, Autonomous
   Multi-Hour, or Correction/Recovery mode and writes one file-backed workplan.
3. AGY executes the bounded runway and runs Codex review/correction loops at
   the planned checkpoints.
4. A controller supervises every run over five minutes using PID custody,
   breadcrumbs, logs, stall thresholds, and required artifact acceptance.
5. AGY produces a closeout with changed files, commands, results, review
   dispositions, unresolved risks, and durable artifacts.
6. Claude or mission-control Codex independently verifies the closeout against
   live refs, diffs, gates, PR state, and forbidden-action compliance.
7. OpenCode may prepare summaries, line-numbered stale-doc reports, and Codex
   review bundles, but it does not self-certify final readiness.

## Token-Efficiency Protocol

Claude and Codex are scarce orchestration and review budgets. AGY should be used
for bounded mechanical engineering work once mission control can specify target
files, allowed actions, and acceptance checks. Do not reserve AGY only for
dictation, file-copy, or bulk data entry.

Use AGY for:

- Test harnesses and verification scripts.
- Diagnostic scripts and grep/inventory scripts.
- Candidate fixes after mission control defines the root cause and acceptance checks.
- Fixture generation and repetitive test scaffolds.
- Report, handoff, and closeout drafting from existing artifacts.
- Repetitive verification scaffolds that would otherwise become iterative
  mission-control shell probing.

Mission control must do:

- Strategy, sequencing, scope decisions, and owner-facing judgment.
- Safety and gate decisions.
- Final verification of AGY output via `git diff`, targeted greps, and repo gates.
- Codex finding adjudication and disposition.

Before any debugging or fix-review loop expected to take more than two
mission-control turns, mission control must either write a tight AGY brief or
state why AGY is inappropriate. Repeated "one more pass" loops are not free;
when work drifts from the current project goal, pause and re-scope.

Read Codex review output surgically: verdict, blockers, top findings, and named files first. Do not paste
or tail large reviewer transcripts into context unless a specific finding requires it.

For side quests, state before continuing:

- Why it matters.
- What it has already cost.
- The next bounded step.
- Whether AGY can do that step.

Every closeout must include:

- `Claude-token spend risk for next step: low/medium/high`
- `AGY delegation opportunity: yes/no`

## OpenCode Allowed Work

OpenCode/GLM-5.2 may do:

- Read-only file inventory and source mapping.
- Stale documentation checks with exact file and line references.
- Log and ledger triage summaries.
- Test failure clustering and likely-root-cause notes.
- Handoff drafting from existing artifacts.
- First-pass plan critique.
- Pre-review bundle generation for Codex.

OpenCode may run commands only when explicitly asked and when the command is non-destructive or owner-approved. It must read project instructions before selecting gate commands.

## OpenCode CLI Compatibility

Current host finding from 2026-06-29:

- Claude's normal shell can invoke `opencode` directly. `opencode --version` returned `1.17.11` with exit code 0.
- This managed Codex sandbox cannot reliably invoke `opencode run` directly. It fails before model execution while opening `C:\Users\jasen\.local\share\opencode\log\opencode.log`; redirecting profile/XDG paths into `.tmp` also failed with `disk I/O error`.
- Therefore, Codex should treat OpenCode as owner-mediated or Claude-mediated unless a future session verifies that the sandbox/filesystem issue is fixed.
- The wrapper at `.tmp\opencode-delegation-kit\run_opencode_eval.ps1` was patched for PowerShell 5.1 compatibility on 2026-06-29. Its first draft used `ProcessStartInfo.ArgumentList`, which exists in PowerShell 7/.NET Core but not Windows PowerShell 5.1.
- Claude validated the patched wrapper on 2026-06-29: it launches opencode, writes breadcrumb/log outputs, and tree-kills on timeout without leaving owned orphans.
- Headless `opencode run` from Claude still timed out with empty stdout/stderr in both `C:\Projects\SSTAC-Dashboard` and a clean throwaway directory, using cloud models and local `mistral-nemo:latest`. Direct Ollama generation with `mistral-nemo:latest` returned normally, so this is not a model, wrapper, or directory-content issue.
- Current best hypothesis: headless OpenCode startup is blocking on a shared/global OpenCode runtime/server handshake, possibly due to a concurrently running interactive OpenCode process. Do not kill that process without owner-confirmed ownership.
- Operational rule until disproven: use interactive OpenCode or owner-mediated OpenCode prompts; do not depend on Claude/Codex launching `opencode run` headlessly for delegated work.

Do not rediscover this by repeatedly launching long OpenCode tasks from Codex. If Claude tokens are exhausted and Codex is acting as backup, ask the owner to run OpenCode prompts or use Claude/OpenCode artifacts already written under `.tmp`.

## OpenCode Forbidden Work

OpenCode must not:

- Self-certify Codex GREEN.
- Invoke or impersonate Claude, AGY, Cursor Agent, or Codex fallback rungs.
- Write directly to Codex governance queues unless explicitly instructed by the owner.
- Kill, restart, or clean up processes.
- Touch live Supabase, production data loads, secrets, auth, billing, migrations, or deploy configuration.
- Rewrite shared governance files because another tool's model ID or CLI syntax is not valid OpenCode syntax.

## Codex Review Prep Bundle

For commit-adjacent work, OpenCode may prepare a bundle at `.tmp/codex-review-bundle.md` containing:

1. Current branch and commit identity.
2. Path-scoped staged or unstaged diff summary.
3. Files changed and intent per file.
4. Test/build/lint/e2e gate results, with exact commands.
5. Known risks and edge cases.
6. Questions for Codex where OpenCode has low confidence.

Codex remains the authority for the final review verdict.

## Gates

Use repo-specific commands from `AGENTS.md`, `package.json`, and task instructions. Do not infer raw build commands.

Known SSTAC build gate:

```powershell
npm run build:monitored:clean -- -TimeoutSeconds 360 -PollSeconds 10
```

The push protocol uses the full six-gate sequence on the final tip:
`npm run lint` -> `npx tsc --noEmit` -> `npm run test:ci` -> monitored clean
build -> `npm run test:e2e` -> `npm run docs:gate`, plus any task-specific
verification required by the current workstream.

## Long Runs

`docs/AGY_USAGE.md` is the authority for SSTAC AGY launches. For runs over five minutes, `supervise-headless-ai-worker` governs Mission Control custody; the foreground controller (`tooling/agy/Invoke-AgyAutonomousWorker.ps1`) is the worker launcher and does not itself recover after controller loss.
Supervision detects and rejects bad runs; it does not prevent a write-enabled
worker from mutating a granted root. Never grant the dirty primary checkout to
an autonomous writer. Use an isolated worktree or an independently enforced
read-only boundary, and give audit workers pre-captured primary-state receipts.

Required properties:

- One run-scoped prompt and one short owner launch command.
- A unique run root and an absent or empty controller root.
- A no-AGY supervisor handshake before the production worker.
- Wrapper-owned breadcrumb JSON with valid status and non-future UTC progress
  timestamps.
- Wrapper and worker PIDs, process start times, executable paths, exact
  arguments, stdout/stderr logs, and owned-descendant inventory.
- `RUN_STATE.md`, `COMMAND_LOG.md`, `HEARTBEAT.log`, `RESUME_PROMPT.md`, and
  task-specific required artifacts.
- Maximum runtime, phase-aware stall threshold, stop conditions, and retry
  budget zero unless a separately reviewed controller supports retries.
- Native exit zero plus valid terminal breadcrumb and accepted artifacts before
  controller GREEN.

The tracked controller (`tooling/agy/Invoke-AgyAutonomousWorker.ps1`) intentionally uses the PowerShell foreground call operator (`&`) with stdout/stderr redirection. For AGY 1.1.8, use model slug `gemini-3.1-pro-high` with `--effort high` (the pinned project contract for the verified 1.1.8 model slug `gemini-3.1-pro-high`, not a universal CLI requirement), `--mode accept-edits`, `--sandbox=false`, `--output-format stream-json`, `--log-file <log.txt>`, `--print-timeout <duration>`, and `-p <prompt text>`. Never use `--dangerously-skip-permissions`.

Do not start duplicate runners against the same DB/ledger. Verify process
ownership and current command line before proposing any termination. Never kill
by image name and never adopt another session's worker.

For a multi-hour mission, include a minimum useful runtime and fallback backlog.
The launch queue is not the entire mission, and AGY must not close early merely
because the first units are complete.

## Review Depth Inside AGY

AGY invokes Codex itself at planned checkpoints:

- targeted after code, SQL, test, harness, auth, or security-sensitive diffs;
- strategic before changing architecture, sequencing, or project framing;
- holistic before milestone closeout across affected surfaces;
- comprehensive before closing a broad multi-unit autonomous run.

Each checkpoint is review -> finding disposition -> correction -> ripple sweep
-> fresh re-review. Preserve full receipts and a finding ledger. A worker may
report GREEN only after mutual-agreement GREEN and any required high-reasoning
confirmation on identical bytes.

## Supabase And Live Data

SSTAC extraction and enrichment runs write to scratch databases and sidecar ledgers until explicitly gated.

Do not load to live Supabase until the exact operation completes the root
AGENTS.md review/preflight protocol and the owner explicitly approves it.
OpenCode and AGY may prepare evidence, but they do not grant live-write authority.

## Handoff Format

Every AI handoff should include:

- Objective and current status.
- Files changed or artifacts created.
- Commands run and pass/fail results.
- Current process IDs for active long-running jobs.
- Latest heartbeat/log/ledger locations.
- Known blockers and exact next command.
- Whether live data, destructive actions, or cross-lane resources are involved.

## Escalation Triggers

Escalate to mission control or the owner before:

- Killing or restarting processes.
- Changing shared `AGENTS.md`, `CLAUDE.md`, `.codex`, `.claude`, `.gemini`, or opencode global settings.
- Starting an unattended run expected to exceed 30 minutes without an
  owner-approved launch contract.
- Writing to live Supabase or production data stores.
- Modifying migration/auth/security/deploy paths.
- Proceeding after Codex, AGY, or OpenCode disagree on safety.

## Practical Prompt For AGY Workhorse

```text
You are the SSTAC AGY-primary executor. Read:
- C:\Projects\CLAUDE.md
- C:\Projects\SSTAC-Dashboard\AGENTS.md
- C:\Projects\SSTAC-Dashboard\docs\AGY_USAGE.md
- C:\Projects\SSTAC-Dashboard\SSTAC_AI_PIPELINE.md

Execute the file-backed workplan for its full bounded runway. Maintain the
required state, heartbeat, command log, review receipts, and resume artifact.
Run the specified Codex review/correction loops to mutual GREEN.

Do not write live Supabase, mutate scheduler/MCP/Ollama, deploy, merge, clean,
prune, delete worktrees, kill unowned processes, or broaden staging. Treat
prior closeouts as claim lists. Produce the contracted artifacts and closeout.
```

## Practical Prompt For OpenCode Scout

```text
You are the SSTAC OpenCode scout. Follow C:\Projects\SSTAC-Dashboard\SSTAC_AI_PIPELINE.md.

Use OpenCode/GLM-5.2 for read-only scouting, stale-doc reports, handoff summaries, test-output triage, and Codex review-bundle preparation. Do not self-certify Codex GREEN. Do not invoke other harnesses. Do not edit files unless explicitly asked.
```
