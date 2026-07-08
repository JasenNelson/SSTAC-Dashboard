---
name: sessionstart
version: 1.0
last_updated: 2026-07-06
description: "Canonical fresh-session start ritual for SSTAC-Dashboard -- active project orientation, a handoff smell-test, then two short gates (review DEPTH + DELEGATION and codex/AGY posture) calibrated to the handoff/prompt and scarce Claude budget, ending in a printed SESSION CONTRACT. Biases depth HIGH because SSTAC is a live site. AUTO-TRIGGERED at fresh session start by the global SessionStart hook (which delegates here for this project), and also owner-invocable via /sessionstart."
disable-model-invocation: true
---

# /sessionstart -- canonical fresh-session start ritual (SSTAC-Dashboard)

This runs at the FIRST turn of a fresh session -- AUTO-TRIGGERED by the global `~/.claude/settings.json`
SessionStart hook (it injects a BLOCKING instruction to READ this file and PERFORM this ritual before
any substantive work; when this skill exists the hook DELEGATES the codex/AGY question to it rather than
asking separately), and also owner-invocable by typing `/sessionstart`. It converts the passive,
skimmed-past hook orientation into an ACTIVE ritual that (a) orients the session by actually reading the
read-first stack, (b) smell-tests the handoff, (c) picks a review DEPTH and a DELEGATION + codex/AGY
posture via two short gates, and (d) emits a SESSION CONTRACT that the prior-session review, the
/codex-review pass, and any later autonomous run all read as the shared source of truth. It is BLOCKING:
do not begin implementation/research/code changes until the two gates are answered.

RESUME vs fresh STARTUP: the global hook fires on both `startup` and `resume`. On a RESUME where a
SESSION CONTRACT was already produced earlier this session (gates already answered, context intact), do
NOT re-run the full ritual or re-ask the gates -- just re-print the existing contract and continue. Run
the full ritual only for a genuinely fresh session (or if no contract exists yet).

Provenance: ported from the OpenHarness-dev skeleton (adapt-then-port) per
`docs/SESSIONSTART_PORT_BRIEF_2026_07_06.md`. The project-agnostic skeleton (gates, smell-test,
contract) is kept intact; the read-first stack, delegation targets, protected paths, and depth signals
are SSTAC-specific. Do NOT collapse the two gates into one question (that risks accidental consent).

## Execute these steps in order

### Step 0 -- ACTIVE orientation (read, do not skim)
Read, in this order, and note what each says vs what the handoff claims:
1. L0 `C:\Projects\CLAUDE.md` (cross-project rules + the SSTAC routing row in section 2) + L1
   `SSTAC-Dashboard\CLAUDE.md` (project identity, Supabase protocol, AI-never-do list, protected paths).
2. `docs/GATE_MODE_SOP.md` -- the gate-discipline AUTHORITY (read before any commit/push).
3. The kickoff prompt / handoff the owner just gave.
4. The current continuity anchor: the newest root `FRESH_SESSION_HANDOFF_<date>_*.md` /
   `NEXT_SESSION_HANDOFF_<date>_*.md`, plus the active per-lane plan doc(s) under `docs/` and
   `docs/INDEX.md`.
5. The SSTAC auto-memory index (`MEMORY.md`) surfaced in context IS available -- it records what was
   true WHEN WRITTEN; if a memory names a file/flag/PR, VERIFY it still exists before relying on it.
   (There is no local graph DB for SSTAC -- do not look for one.)

### Step 1 -- SMELL-TEST the handoff (verify-before-assert)
The handoff can be stale or wrong -- this is a load-bearing SSTAC lesson (CLAUDE.md "Session End" drift
incident 2026-06-19: root handoffs lagged the code ~19 days because refresh was optional). Pick the 2-3
MOST load-bearing claims in the handoff (a "done"/"merged" status, an "open PR", a "blocked" claim, a
named file/flag/value) and cheaply VERIFY each: `git log --oneline -8`, `gh pr list`, a file read, a
one-line probe. Record which claims are TRUSTED vs UNVERIFIED vs WRONG. Run the L0 1.6
workstream-conflict check if the handoff implies a pivot: `git status --short` + recent `.tmp_*` /
scratch mtimes + `git log --oneline -5` for signs a parallel SSTAC session (or a pr-worktree) is active.
Also confirm the process baseline (L0 1.9): `Get-Process node, python` -- distinguish YOUR orphans from
foreign parallel-session processes (never kill foreign ones).

### Step 2 -- RECOMMEND a depth (calibrate; do not ask blind). BIAS HIGH -- SSTAC IS A LIVE SITE.
Weigh (handoff completeness) x (task risk) x (scarce Claude budget). Recommendation signals:
- ANYTHING touching the live site, Supabase schema/migrations, `matrix_map` data, RLS/RPCs, or a long
  autonomous run -> EXHAUSTIVE (reliability must be proven before autonomous work on production).
- Regulatory VALUES / catalog data / matrix-options library changes -> at least DEEP (values are
  verified against PRIMARY sources, never memory; a wrong TRV ships a wrong screening standard).
- Thin prompt / "explore the codebase" / new area -> DEEP.
- Detailed handoff for a small, well-specified, non-production continuation -> STANDARD.
- A handoff claim that FAILED the smell-test -> bump one tier deeper.
- Budget-aware: if the legwork is mechanical and safely delegable, keep the depth but push the reading
  to AGY / Sonnet subagents so Claude is spent on judgment, not mechanical exploration.
Default for an unspecified or production-adjacent task on SSTAC: EXHAUSTIVE.

### Step 3 -- GATE 1 (AskUserQuestion): review DEPTH
Ask ONE question, depth options, your recommendation first + "(Recommended)":
- **Quick (trust-the-handoff):** read named files, verify 1-2 load-bearing claims, plan. ~0-1 Explore agent.
- **Standard:** read named + adjacent, empirically verify the handoff's load-bearing claims,
  1-2 Explore agents, plan.
- **Deep:** 2-3 parallel Explore agents across subsystems, verify ALL handoff claims, read the doc
  stack. For ambiguous scope / new area / regulatory-value work / multi-hour autonomous work.
- **Exhaustive/adversarial (default for live-site / schema / migrations / long autonomous runs):**
  Deep + Plan agent(s) + a codex HOLISTIC on the resulting plan BEFORE any implementation.

### Step 4 -- GATE 2 (AskUserQuestion): DELEGATION + review posture
Separate risk decision (do NOT merge into Gate 1). Ask, recommendation first:
- **Delegation:** Claude-only / Claude + AGY (mechanical authoring workhorse) / Claude + Sonnet
  subagents (exploration + verification + mechanical edits) / a mix. SSTAC's budget rule
  (`feedback_token_efficient_means_delegate_claude_budget`): mechanical authoring -> AGY (AGY WRITES,
  the orchestrator RUNS); investigation + mechanical edits + verification reads -> Sonnet subagents;
  Opus reserved for orchestration + hard reasoning + owner-judgment work. Max 3 background
  subagents (L0 1.9).
- **codex posture:** the L0/L1 mandatory `/codex-review`-to-mutual-agreement-GREEN COMMIT gate ALWAYS
  applies -- this choice only sets the EXTRA cadence: targeted-per-commit (the mandatory floor) /
  +holistic at strategic checkpoints / owner-triggers-holistic-manually. There is NO "codex off." Codex
  CLI preferred; cursor-agent (gpt-5.3-codex-xhigh, `--trust`) is the set-up backup (TOOLING_SETUP B.5).
- **Supabase / data work:** ALWAYS read the `/supabase` skill first. Reads via the project-scoped MCP
  are fine; WRITES/migrations go through the SQL-Editor / `apply_live_load.py` path (never bulk SQL
  through MCP -- token-fatal). Never mutate `supabase/migrations/` that is already applied.
- On AGY selection: BEFORE first use, read the `/AGY` skill + the SSTAC AGY guidance in CLAUDE.md 1.18.
- Shipping: use `/ship-protocols` proactively before any commit/push/PR/merge; the full push gate is
  lint -> `test:ci` -> `build:monitored:clean` -> e2e (never raw `npm run build`).
- This gate IS the canonical codex/AGY start-gate: the global hook DELEGATES here, so there is no
  separate hook question to reconcile. The main session may revise the recommended posture based on the
  kickoff prompt -- expected and good.

### Step 4A -- HARD TOKEN-EFFICIENCY CHECK
Claude tokens are the scarce orchestration budget. AGY is not just a dictation/file-copy tool. Once the
spec is bounded, mechanical work goes to AGY unless Claude explicitly records why AGY is inappropriate.

Apply these rules before implementation, debugging, or review loops:
- Claude owns strategy, gate decisions, final verification, and owner-facing judgment.
- AGY owns bounded mechanical production: test harnesses, diagnostic scripts, candidate fixes, fixture
  generation, report drafting, grep/inventory scripts, and repetitive verification scaffolds.
- Before any debugging or fix-review loop expected to take more than two Claude turns, write a tight AGY
  brief or record why AGY is inappropriate.
- Prefer one upfront harness/script for verification over iterative live shell probing. Claude defines
  the invariant; AGY drafts the harness when safe.
- Read Codex review output surgically: verdict, blockers, top findings, and named files first. Do not
  paste large reviewer transcripts into context unless needed for a specific finding.
- Track cumulative side-quest cost. If work is not on the flagship path, state why it matters, what it
  has already cost, the next bounded step, and whether AGY can do that step before continuing.
- Stop treating repeated "one more pass" loops as free. If the cumulative work drifts from the current
  goal, pause and re-scope.

### Step 5 -- EXECUTE the chosen depth
Run the exploration for the chosen tier (Explore/Plan agents as above; verify handoff claims
empirically -- regulatory values against PRIMARY sources, not memory). Delegate the mechanical legwork
per Gate 2 to conserve Claude budget where safe.

### Step 6 -- emit the SESSION CONTRACT (print it; it is the shared source of truth)
A compact block the prior-session review + /codex-review + any autonomous run all read:
```
SESSION CONTRACT
- Depth: <tier>          Delegation: <posture>          codex: <posture>
- Task: <one line>
- Trusted handoff claims (each WITH its evidence): <claim -- checked via `<cmd/file:line>`>
- UNVERIFIED / corrected claims (WITH what was found): <claim -- `<probe>` showed <result>>   (need care)
  (Carrying the evidence, not just the label, is what lets the prior-session reviewer + /codex-review
  trust or challenge each claim without re-verifying everything -- the verify-before-assert chain must
  survive the handoff.)
- Allowed delegates + scope: <AGY / Sonnet subagents / etc>
- Protected paths / do-not-touch: supabase/migrations (applied), docs/archive/, src/data catalogs,
  CLAUDE.md, docs/GATE_MODE_SOP.md, src/middleware.ts, package.json/next.config/tsconfig  (+ any lane-specific)
- AI-never-do (L1): write verdicts (ADEQUATE/INADEQUATE), promote/mutate the default-policy library,
  mutate src/data catalogs, propose a push without 4 gates GREEN, Supabase MCP writes/migrations.
- Review loop: plan -> prior-session review -> /codex-review to GREEN -> ship (/ship-protocols)
- Stop conditions: <budget ceiling / incident / codex oscillation past ~5 rounds -> informed holistic>
- Claude-token spend risk for next step: <low/medium/high>
- AGY delegation opportunity: <yes/no>
```

### Step 7 -- proceed to plan + hand back to the owner's loop
Produce the plan (in plan mode). Then remind the owner of the loop: give this plan to the PRIOR session
for review (it has context this fresh session lacks) if one is running, then approve + interrupt for
/codex-review to iterate the plan to robust before implementation. Close-out (CLAUDE.md "Session End")
is mandatory: refresh + COMMIT the dated handoff, orphan sweep, and include `Claude-token spend risk for
next step: low/medium/high` plus `AGY delegation opportunity: yes/no`.

## Notes
- This ritual is only load-bearing if it actually runs. A 2026-07-08 incident shows a session can
  proceed directly into a detailed first-message task without invoking this skill at all, silently
  skipping every gate/rule inside it (including the Supabase-skill-first rule in Step 4) -- CLAUDE.md
  now carries a redundant backstop rule for exactly this failure mode, but do not treat that backstop
  as a substitute for actually running this ritual on a genuinely fresh session.
- This is the SSTAC-Dashboard project skill. It layers an ACTIVE ritual on top of the always-on passive
  SessionStart hook context -- keep both.
- Adapt-then-port discipline: this was derived from the OHD skeleton; keep the gates/smell-test/contract
  structure when updating, and re-gate with codex on any substantive change.
