# SSTAC AI Pipeline

Status: v0.1 operational draft.
Scope: `C:\Projects\SSTAC-Dashboard`.

## Purpose

This runbook defines the multi-AI workflow for SSTAC-Dashboard so work can be delegated without burning Claude, Codex, and AGY tokens on the wrong layer.

SSTAC has multimodal and data-heavy work: PDFs, images, SQLite ledgers, Supabase-gated deltas, matrix options, batch enrichment, and long-running scripts. The lane should use AGY as the primary execution workhorse, Claude as orchestrator, Codex as reviewer, and OpenCode/GLM-5.2 as a low-risk context and review-prep assistant.

## Roles

| Role | Primary tool | Responsibility |
|---|---|---|
| Orchestrator | Claude | Decide scope, sequence work, adjudicate tradeoffs, stop unsafe runs, synthesize handoffs. |
| Workhorse | AGY/Antigravity | Execute bounded implementation, multimodal extraction, PDF/image/database work, and long batch preparation. |
| Reviewer | Codex CLI | Perform adversarial review, commit gates, and high-risk diff review. Prefer running Codex inside AGY when that saves Claude tokens. |
| Scout | OpenCode/GLM-5.2 | Read-only repo scouting, stale-doc detection, log triage, test-output clustering, handoff drafting, Codex review-bundle preparation. |
| Owner | J. Nelson | Gate live data loads, destructive process actions, major architecture shifts, and cross-lane scheduling conflicts. |

## Default Flow

1. Claude frames the task, constraints, acceptance criteria, and escalation triggers.
2. AGY performs the implementation or data/extraction work with bounded instructions.
3. AGY produces a closeout with changed files, commands run, results, unresolved risks, and artifacts.
4. Codex CLI reviews the diff or artifact bundle. Iterate until GREEN for commit-adjacent work.
5. Claude adjudicates any disagreement and decides whether to continue, pause, or hand off.
6. OpenCode may prepare summaries, line-numbered stale-doc reports, and Codex review bundles, but it does not self-certify final readiness.

## Token-Efficiency Protocol

Claude is the scarce orchestration budget. AGY should be used for bounded mechanical engineering work
once Claude can specify target files, allowed actions, and acceptance checks. Do not reserve AGY only for
dictation, file-copy, or bulk data entry.

Use AGY for:

- Test harnesses and verification scripts.
- Diagnostic scripts and grep/inventory scripts.
- Candidate fixes after Claude defines the root cause and acceptance checks.
- Fixture generation and repetitive test scaffolds.
- Report, handoff, and closeout drafting from existing artifacts.
- Repetitive verification scaffolds that would otherwise become iterative Claude shell probing.

Claude must do:

- Strategy, sequencing, scope decisions, and owner-facing judgment.
- Safety and gate decisions.
- Final verification of AGY output via `git diff`, targeted greps, and repo gates.
- Codex finding adjudication and disposition.

Before any debugging or fix-review loop expected to take more than two Claude turns, Claude must either
write a tight AGY brief or state why AGY is inappropriate. Repeated "one more pass" loops are not free;
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

The push gate still includes lint, unit tests, e2e tests, and any task-specific verification required by the current workstream.

## Long Runs

Any long-running wrapper must have:

- Dated log file.
- Heartbeat or breadcrumb JSON.
- Process ID and launch command.
- Stall threshold and restart/resume instructions.
- Clear stop condition.

Do not start duplicate runners against the same DB/ledger. Verify process ownership and current command line before killing or restarting anything.

## Supabase And Live Data

SSTAC extraction and enrichment runs write to scratch databases and sidecar ledgers until explicitly gated.

Do not load to live Supabase until Claude/Codex gates approve the delta. OpenCode and AGY may prepare evidence, but owner/Claude/Codex gate the live load.

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

Escalate to Claude/owner before:

- Killing or restarting processes.
- Changing shared `AGENTS.md`, `CLAUDE.md`, `.codex`, `.claude`, `.gemini`, or opencode global settings.
- Starting an unattended run expected to exceed 30 minutes.
- Writing to live Supabase or production data stores.
- Modifying migration/auth/security/deploy paths.
- Proceeding after Codex, AGY, or OpenCode disagree on safety.

## Practical Prompt For AGY Workhorse

```text
You are the SSTAC workhorse. Follow C:\Projects\SSTAC-Dashboard\SSTAC_AI_PIPELINE.md.

Claude owns orchestration. Codex owns final review. You own bounded implementation and evidence production.

Do not write live Supabase. Do not kill processes unless explicitly instructed. Do not start duplicate runners. Produce a closeout with files changed, commands run, artifacts, risks, and the next exact command.
```

## Practical Prompt For OpenCode Scout

```text
You are the SSTAC OpenCode scout. Follow C:\Projects\SSTAC-Dashboard\SSTAC_AI_PIPELINE.md.

Use OpenCode/GLM-5.2 for read-only scouting, stale-doc reports, handoff summaries, test-output triage, and Codex review-bundle preparation. Do not self-certify Codex GREEN. Do not invoke other harnesses. Do not edit files unless explicitly asked.
```
