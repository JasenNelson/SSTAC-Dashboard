# Gate Mode Standard Operating Procedure

**Project:** SSTAC-Dashboard
**Status:** Operational
**Last updated:** 2026-05-26
**Source:** Extracted from MATRIX_OPTIONS_WORKFLOW_RECOVERY_CLAUDE_HANDOFF_2026_05_26.md lines 96-220 and refined for durable cross-session use.
**ASCII:** Plain ASCII only (code point <= 127 per L0 CLAUDE.md rule 1.1).

---

## Purpose

Gate Mode codifies how Codex, Claude Code, and Cursor sessions run Commit protocol and Push protocol gates without burning context or stalling in retry loops. It applies to every commit and push on this project.

---

## 1. Gate Mode Activation

At the start of any Commit protocol or Push protocol, announce Gate Mode before running any gate command:

```
Gate Mode active: logs to .tmp/gate-logs/, compact summaries only in chat,
one retry per known Windows failure class, Playwright delegated or stopped
on first local environment failure, no long CI polling loops.
```

The announcement sets expectations for the session. Do not skip it.

---

## 2. State Machine

Gate Mode runs five phases in order. Do not skip or reorder phases.

### Phase 1 -- Preflight

Run the following commands and review the output before any other action:

```
git status --short --branch
git log --oneline -8 --decorate
git diff --stat
```

Also check:
- No `pnpm-lock.yaml`, `yarn.lock`, or `pnpm-workspace.yaml` present (package-manager drift check).
- `CLAUDE.md` remains separate from implementation changes unless owner has explicitly approved its inclusion.

Stop if preflight surfaces unexpected state. Do not proceed until the working tree is understood.

### Phase 2 -- Scope Check

- Identify the exact set of changed files that belong to this commit or push.
- Confirm no untracked artifact cleanup is needed before staging.
- Stop if unexpected tracked diffs appear (files changed that were not part of the planned scope).

Scope check is a hard gate. Unexpected tracked diffs require owner confirmation before proceeding.

### Phase 3 -- Commit Protocol

1. Run targeted `/codex-review` on the exact diff (see section 6).
2. Iterate to mutual-agreement GREEN before staging.
3. Use sonnet subagents for any implementation fixes surfaced by codex review.
4. Stage exact file paths only:

```
git add src/components/foo.tsx src/lib/bar.ts
```

Never use `git add .` or `git add -A` or `git add -u`. Path-scoped staging only (cross_project_path_scope_at_commit.md).

### Phase 4 -- Push Protocol Gates

Run gates in this order. Each gate must reach GREEN before the next gate starts.

1. `npm run lint`
2. `npm run test:ci` -- MANDATORY push-gate unit/coverage gate. Sets `CI=true` and runs Vitest
   coverage to exactly match the GitHub Actions "Unit Tests" job (the CI-conditional `testTimeout`
   and `maxWorkers` in `vitest.config.ts` only activate when `CI` is set). Use `npm run test:unit`
   ONLY for fast inner-loop checks, NEVER as push-gate evidence: it runs no coverage and at default
   workers, so it cannot reproduce coverage/CI-only failures. This exact gap turned `main` RED on
   2026-06-01 (a coverage-only render timeout passed `test:unit` locally). One command names the
   CI contract so local and CI cannot drift; see `feedback_push_gate_must_match_ci_test_coverage`.
3. `npm run build:monitored:clean -- -TimeoutSeconds 360 -PollSeconds 10` -- never raw `npm run build` (see section 10).
4. Focused e2e first when the change has a narrow e2e surface.
5. Full e2e last.

See section 5 for retry limits on known failure classes.

### Phase 5 -- Push and CI Check

1. Re-check `git status --short --branch` to confirm working tree is clean.
2. Push only the intended branch.
3. Run one GitHub Actions status check:

```
gh run list --branch <branch> --limit 5
```

4. Stop if CI is in progress. Report the run URL and next recommendation. Do not poll.

---

## 3. Gate Mode: Compact Variant

The compact variant applies to COMMIT PROTOCOL ONLY for micro-commits (pure type fixes, metadata-only changes, documentation-only changes):

- Run: lint + focused test + build only.
- Still requires `/codex-review` targeted loop before staging (section 6). No exceptions.

PUSH PROTOCOL IS NEVER COMPACT. The full 4-gate suite (lint + unit + build + e2e) runs before every push per L0 CLAUDE.md rule 1.3, even for one-line fixups. The compact variant does not override Push protocol.

The compact variant does not apply to commit protocol when the diff touches component logic, API routes, database queries, or test files.

---

## 4. Logging Rule

All gate output goes to `.tmp/gate-logs/` with timestamped filenames. Chat receives only compact status reports.

Format for GREEN gates:

```
gate: npm run test:ci
status: GREEN
duration: 42s
log: .tmp/gate-logs/unit-20260526-183000.log
```

Format for RED gates:

```
gate: npm run test:e2e
status: RED
duration: 0.8s
log: .tmp/gate-logs/e2e-20260526-183100.log
failure_class: local_spawn_eperm
tail: Error: spawn EPERM
decision: stop; delegate or request waiver
```

Do not stream raw gate output into chat. Do not paste full log contents inline. Link to the log file only.

Notes field is optional; include it when stderr has known-benign noise (mocked error paths, deprecation warnings) that would cause confusion without context.

---

## 5. Retry Limits

One retry maximum per known machine failure class. Do not retry more than once. Stop and escalate after the retry fails.

### Vitest spawn EPERM (before tests load)

1. Retry the same command once with escalation (e.g., elevated PowerShell if available).
2. If it fails again: stop. Report failure_class and log path. Do not continue past this gate.

### .next quarantine Access Denied

1. Retry the same monitored clean build once with escalation.
2. If it fails again: stop. Report failure_class and log path. Do not attempt manual .next deletion.

### Playwright EPERM / spawn EPERM / locked .last-run.json / stale runner

This is the highest-friction failure class. Follow all four steps in order:

1. Inspect process and artifact state:
   - Check for stale Playwright Node PIDs.
   - Check for locked `.last-run.json` or stale playwright artifacts in `.tmp/`.
2. With owner approval:
   - Stop only confirmed stale Playwright Node PIDs (by PID, not by image-name kill per cross_project_no_image_name_kill_mcp.md).
   - Remove only the exact stale Playwright artifacts after verifying paths.
3. Run focused e2e once.
4. If local environment still fails: stop, delegate to Claude Code (section 8), or request an explicit local e2e waiver from owner.

Do not attempt a second cleanup cycle. Do not widen the artifact removal scope.

### GitHub Actions in progress

1. Run one status check.
2. Report the run URL and status.
3. Do not poll unless owner explicitly asks for continued monitoring.

---

## 6. /codex-review Integration

`/codex-review` is an adversarial iterative loop to mutual-agreement GREEN, not a single-run report.

**Targeted mode** (before every commit):

1. Run codex CLI on the exact diff.
2. Read each finding.
3. For any disagreement: quote the finding, cite counter-evidence, ask codex to defend or revise.
4. Re-run codex with the argument. Iterate until mutual agreement on every finding.
5. Never single-run-and-report. A codex invocation without iteration is not a targeted review.

**Holistic mode** (at strategic checkpoints):

Run holistic at: feature branch merges, multi-commit push gates, lane boundaries, and after any re-ingest or schema migration.

**When disagreeing with a finding:**
- Quote the exact finding text.
- Cite specific file + line evidence as counter-argument.
- Do not silently accept a finding that is wrong.
- Do not stubbornly reject a finding without argument.
- Mutual-agreement methodology: codex_review_mutual_agreement_methodology_2026_05_16.md.

**Tool preference:**
- Codex CLI (preferred): xhigh reasoning + tool-use catches more than MCP.
- Fallback ladder: codex CLI -> Opus adversarial iterative loop -> Cursor agent (sparingly, per feedback_codex_fallback_with_rereview_queue.md).
- After any Opus or Cursor fallback, append artifact + verdict + disposition to the codex re-review queue at `C:\Users\jasen\.claude\projects\C--Projects-Regulatory-Review\memory\codex_rereview_queue_2026_05_17.md`.

---

## 7. Sonnet Subagent Delegation

- All implementation work goes to sonnet subagents: code edits, test fixes, file creation, package installs, lint fixes.
- Opus main session orchestrates, runs `/codex-review`, and makes architectural decisions.
- Gate runs can be delegated to sonnet subagents with log-to-file output; subagent reports compact status back to Opus.
- `/codex-review` always runs at Opus level or via codex CLI. Never delegate the review loop itself to a subagent.
- Before spawning 2 or more subagents with potentially large returns, run `/checkpoint save` (cross_project_sonnet_subagents_opus_codex_review.md).

---

## 8. Claude Code Delegation Triggers

Delegate to Claude Code early when Codex is the bottleneck -- not after context is already damaged.

Delegate for:

- Focused Playwright e2e when Codex local Playwright hits spawn EPERM.
- Browser-only validation of a narrow component or flow.
- Independent review of a small diff when owner has approved external disclosure.
- Planning a recovery strategy when Codex has already hit one circuit breaker.

Do not delegate broad private repo diffs to external Claude Code without owner explicit approval of external disclosure.

---

## 9. Stop Conditions

Stop the current protocol run and hand off to owner if any of these occur:

- Two gate failures in one protocol run.
- Any Playwright local environment failure after one cleanup attempt (section 5).
- A command exceeds its explicit timeout.
- A command would require more than one escalation retry.
- CI is still in progress after one status check (report links, recommend next action, stop).
- `CLAUDE.md` becomes entangled with implementation changes in the same commit.
- Package-manager drift appears (`pnpm-lock.yaml`, `yarn.lock`, or `pnpm-workspace.yaml` created or modified).
- Unexpected tracked diffs appear that were not part of the planned scope.
- Context pressure or autocompaction risk detected.

When stopping, always report:
- Which stop condition was triggered.
- The last gate that ran (GREEN or RED with log path).
- The recommended next action (delegate to Claude Code, owner triage, explicit waiver).

---

## 10. Build Gate

Never run raw `npm run build` from agent shells. Use the monitored clean build command:

```
npm run build:monitored:clean -- -TimeoutSeconds 360 -PollSeconds 10
```

This command:
- Quarantines the `.next/` directory before the build to avoid Access Denied failures on stale artifacts.
- Writes detailed build logs to `.tmp/build-monitor/` (the script default). Gate Mode captures the wrapper stdout/stderr separately to `.tmp/gate-logs/`.
- Times out at 360 seconds with process-tree cleanup so no build process escapes as an orphan.
- Reports GREEN or RED with a log path that Gate Mode can include in the compact status report.

Raw `npm run build` does not provide the quarantine step or timeout protection. Do not substitute it.

---

## Registration

This SOP is not yet registered in docs/INDEX.md or docs/_meta/docs-manifest.json because this repo does not yet have a CLAUDE.md or canonical docs index (marked "TO AUTHOR" in L0 routing table). When the SSTAC-Dashboard CLAUDE.md is authored, this SOP should be cross-referenced there as the gate-discipline authority.

---

## Reference

- L0 cross-project rule 1.1 (ASCII only): `C:\Projects\CLAUDE.md`
- Path-scoped staging: `cross_project_path_scope_at_commit.md`
- Codex fallback ladder + re-review queue: `feedback_codex_fallback_with_rereview_queue.md`
- Codex mutual-agreement methodology: `codex_review_mutual_agreement_methodology_2026_05_16.md`
- Sonnet subagents + Opus codex review: `cross_project_sonnet_subagents_opus_codex_review.md`
- Push protocol all gates must be GREEN: `cross_project_push_protocol_all_gates_must_be_green.md`
- Run gates before proposing push: `cross_project_run_gates_before_proposing_push.md`
- No image-name-kill MCP processes: `cross_project_no_image_name_kill_mcp.md`
- Harness background processes die on exit: `cross_project_harness_background_processes_die_on_exit.md`
- Source draft: `MATRIX_OPTIONS_WORKFLOW_RECOVERY_CLAUDE_HANDOFF_2026_05_26.md` lines 96-220
