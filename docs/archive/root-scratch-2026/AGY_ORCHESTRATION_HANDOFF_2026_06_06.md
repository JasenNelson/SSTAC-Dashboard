> **SUPERSEDED 2026-06-23 -- DO NOT FOLLOW THE INSTRUCTIONS IN THIS FILE.** This early AGY
> orchestration handoff is OBSOLETE; do NOT use any `--dangerously-skip-permissions` guidance from it.
> Canonical AGY usage is `docs/AGY_USAGE.md` (+ memory `agy_antigravity_cli_usage`). Retained as an
> audit trail only. (A prior engine-v2 session was misled by this file.)

# AGY ORCHESTRATION HANDOFF -- SSTAC Dashboard matrix-map stats lane (2026-06-06)

Plain ASCII. Purpose: migrate implementation from Claude (weekly token limit) to Google
Antigravity (AGY), with a THIN fresh Claude session as orchestrator and codex CLI as the
independent reviewer of all AGY work. This file is the single anchor for all three parties.

## 0. ROLE ARCHITECTURE (token-efficient split)

- OWNER: runs AGY in its own terminal window; pastes AGY's outputs/questions to the
  orchestrator only when AGY is blocked or a brief is done; merges all PRs.
- AGY (implementer): does ALL code writing, test writing, and gate running. Receives one
  TASK BRIEF at a time (section 5 format). Must follow the RULE PACK (section 2) verbatim.
- CLAUDE ORCHESTRATOR (fresh session, minimal context): writes task briefs, adjudicates
  codex disagreements, verifies AGY claims by running gates/greps itself (cheap tool calls,
  short outputs), maintains lane state. NEVER writes feature code (token discipline).
- CODEX (reviewer): every AGY change goes through the codex loop (section 3) BEFORE commit.
  Either AGY runs the loop itself (preferred -- it has terminal access) or the orchestrator
  runs it; verdicts are pasted into the brief's closeout.

## 1. CURRENT STATE (verified 2026-06-06 ~08:50)

main tip a3cc47c. ALL lane PRs MERGED: #258 Phase 0 panel redesign (d148505), #259 Phase 1
stats engine (f000a8a), #260 Supabase migrations capture (fd5efc7), #261 manifest count
(8575d46), #262 v1.1.0 multimedium ETL restore (a3cc47c). All session worktrees removed;
remote branches deleted; live Supabase already matches the repo migrations.

Shipped Phase 1 surface (read before extending): src/lib/matrix-map/stats.ts (descriptive
set + Student's-t UCL95 + Chebyshev/Cantelli 95/97.5/99; per substance+unit bucketing with
id->key->name identity fallback; DL/2 placeholder for censored===true; null detection freq
for n=0), inverse-t.ts (hand-coded, t-table-validated), filter-measurements.ts (shared),
MatrixMapSelectionStats.tsx (+ MatrixMapStatsShell with live-selection-key readiness gate).
Every ProUCL ambiguity carries a "VERIFY vs ProUCL v5.2 Tech Guide" code comment -- grep
"VERIFY" in src/lib/matrix-map/ for the full list. ~3291 unit tests on main.

2026-06-06 PM updates: BRIEF 1 (codex-review skill acceptance test) COMPLETE + orchestrator-
VERIFIED PASS -- loop proven end-to-end on a planted 2-defect diff (7 rounds; R1 Spark RED
caught both defects; R7 xhigh explicit VERDICT: GREEN). Pitfalls learned (now in skill):
sandbox vitest EPERM -> static-only prompts; verdict-line omission -> exit-2 + unambiguous
no-findings text counts, or re-prompt for explicit line. Closeout: .tmp_agy_closeout_1.md.
Primary checkout FIXED: on main a3cc47c (stale docs-branch edits stashed: "stale docs-branch
edits 2026-06-06"); AGENTS.md ship-protocols committed 6cc10c7 on
chore/agents-ship-protocols-2026-06-06 (codex one-shot xhigh GREEN; NOT pushed yet).

BRIEF 4 (PHASE 3) COMPLETE + MERGED (2026-06-07): PR #265 squashed to main 4e2a0f0 (gamma
approx/adjusted UCL, Land H-UCL Brent solver CLEAN-ROOM-verified, KM censored stats direct-SD,
Dixon/Rosner outlier flags, censored decision ladder, KM/ROS/DL2 selector). 14-round codex
loop; full GitHub CI green on tip 844e152; Sonnet parity-verified (k-star/KM math match
packet, no fixture special-casing, clean-room H-solver). ONE OPEN QUESTION (BRIEF 5 DONE, outcome c):
KM-lognormal H-vs-t threshold uses logN (positive-detect count) vs total-n. Tech Guide
RE-READ confirmed SILENT/ambiguous on the censored path (closest text Section 4.11 p.195).
No code change; current logN behavior + VERIFY comment in stats.ts left intact. RESOLUTION
PENDING OWNER: 10-min ProUCL GUI run per .tmp_agy_owner_card_5.md (dataset 15 detects/15 NDs,
log_SD 1.505: H-UCL => total-n correct; KM-t UCL => detect-count correct). Phase3 worktree
TORN DOWN (722 dirs verified intact). AGY TRIAL NOTE: does not honor explicit round ceilings (ran R7-R17
vs R14 cap; ran ad-hoc test cmds vs the test:ci gate) -- enforce ceilings structurally; work
still landed clean every time.

BRIEF 3 COMPLETE + VERIFIED (2026-06-07): Phase 2 stats engine (GOF Shapiro-Wilk/Lilliefors/
gamma AD-KS, ProUCL-Recommended meta-method ladder, bootstrap Web Worker percentile/BCA/
bootstrap-t) = PR #263 (f00ea61, includes packet 199ed23), 6 gates GREEN (unit 3301, e2e
138/69/0), 11-round codex trail, GPL-clean (EnvStats formulas-only). KEY CORRECTION: v5.2
Table 2-13 does NOT recommend Chebyshev for lognormal (historical/informational only) -- the
section-4 "0.5-3.0 Chebyshev ladder" description was stale v5.1-era memory; Guide text is
authority. Owner decisions D1 (direct KM SD) / D2 (ProUCL Recommended meta-method default +
manual selector) / D3 (Chebyshev retained where Guide recommends) are binding. #263 MERGED
2026-06-07 (squash, owner-instructed, CI 11/11 green; remote branch deleted; phase2 worktree
teardown pending). NEXT: Phase 3 = BRIEF 4 (.tmp_agy_brief_4.md) ready (gamma approx/adjusted UCL, Land H-UCL tables,
Dixon/Rosner flags, KM censored + KM/ROS/DL2 selector).

BRIEF 2 COMPLETE + VERIFIED (2026-06-06 eve): ProUCL v5.2 extraction packet at
docs/PROUCL_V52_EXTRACTION_PACKET_2026_06_06.md, commit 199ed23 on worktree branch
docs/proucl-v52-extraction-packet-2026-06-06 (NOT pushed). 5-round codex trail GREEN. All 8
in-code VERIFY comments answered; parity targets: Chromium/Pyrene/Oahu. SECTION 4 BLOCKER NOW
REDUCED TO: owner reviews the packet's "Owner Must Confirm" list (3 items: direct KM SD for
BTVs, nonparametric default selections, Chebyshev deprecation) + optional 10-min ProUCL GUI
check. Phase 2 brief can be drafted once owner confirms.

OWNER ITEMS OUTSTANDING (not AGY work): delete stale branch
feat/matrix-map-etl-multi-medium-extension local+origin; IRIS qa-promotion sheet; eco SQL
pastes; decide when to push/PR chore/agents-ship-protocols-2026-06-06.

NEXT IMPLEMENTATION WORK (owner-gated until cutoffs supplied -- see section 4):
Stats engine Phases 2-3 per C:\projects\sstac-dashboard\MATRIX_MAP_STATS_ENGINE_DESIGN_2026_06_05.md
and the approved plan C:\Users\jasen\.claude\plans\read-c-projects-sstac-dashboard-fresh-s-structured-kitten.md.

## 2. RULE PACK FOR AGY (distilled from CLAUDE.md L0/L1 + standing memory; NON-NEGOTIABLE)

R1  ASCII ONLY (code point <= 127) in every file, comment, test name, doc. No emoji,
    em-dashes, smart quotes, Unicode arrows.
R2  REGULATORY STATS DISCIPLINE: never silently guess a ProUCL convention. Any formula,
    cutoff, table, or alpha not verified against the ProUCL v5.2 Technical Guide gets a
    code comment "VERIFY vs ProUCL v5.2 Tech Guide: <question>". Every constant carries a
    source citation comment. All hand-computed test fixtures show their arithmetic in
    comments. Units are never mixed; values never compared without unit normalization.
- R3  AI never writes: qa_status promotions, assessment verdicts (ADEQUATE/INADEQUATE),
    default-policy library changes, src/data/ catalog edits.
R4  GIT: path-scoped staging ONLY (never git add . / -A / -u). Never git reset --hard or
    clean against shared trees. Never force-push. supabase/migrations/ is APPEND-ONLY.
    Never delete regression tests except in the same PR as a documented feature removal.
    Commit messages end with the agent attribution line.
R5  WORKTREES: each task = own worktree off origin/main:
      git worktree add C:/Projects/SSTAC-Dashboard-worktrees/<lane>-<date> -b <branch> origin/main
      cmd /c mklink /J <wt>\node_modules "C:\Projects\sstac-dashboard\node_modules"   (capital P
      target; from Git-Bash use cmd //c) ; copy .env.local from C:\Projects\SSTAC-Dashboard.
    TEARDOWN (DESTRUCTIVE-TRAP): fsutil reparsepoint delete <wt>\node_modules FIRST, verify
    the shared store still has ~722 dirs, THEN git worktree remove + prune. NEVER recursive-
    delete over a live junction. Never touch worktrees you did not create (engine-v2 etc).
R6  GATES (all 6, in the worktree, on the FINAL tip, before push; capture UN-piped exits):
      npm run lint                      -> 0 errors (34 legacy warnings OK)
      npx tsc --noEmit                  -> clean (CI typechecks tests; vitest/lint do not)
      CI=true npm run test:coverage     -> exit 0 (PowerShell: $env:CI='true'; ...)
      npm run build:monitored:clean -- -TimeoutSeconds 360 -PollSeconds 10  (NEVER raw build)
      npm run test:e2e                  -> expect 138 passed / 69 skipped / 0 failed
      npm run docs:gate                 -> STATUS: PASS
    Report the consolidated per-gate block with pass counts tied to the commit SHA.
R7  SUPABASE: never write to the DB. SQL changes = append-only migration files; the owner
    applies them. (Schemas can be READ via the owner's MCP if needed -- ask the orchestrator.)
R8  PROTECTED: CLAUDE.md, package.json, next.config.ts, tsconfig.json, src/middleware.ts,
    docs/GATE_MODE_SOP.md, supabase/migrations/* (existing), docs/archive/**, src/data/**.
R9  PR ETIQUETTE: PR per task, base main, body = summary + gate block + codex review trail.
    Owner merges. CI quirk: a PR that becomes UNMERGEABLE (conflict) silently gets NO CI
    runs -- resolve the conflict first, never chase triggers.
R10 PROCESS HYGIENE: max ~3 background processes; long codex runs from the main terminal
    (not nested agents); kill by PID only, never by process name (shared node/codex infra).

## 3. CODEX-REVIEW SKILL FOR AGY (operational distillation; build this as an AGY workflow)

Binary: `codex` on PATH (npm shim -> app-local binary). Review mode only (never codex exec).
codex is stateless per invocation: every prompt must be SELF-CONTAINED.

LOOP (before EVERY commit; iterate, never one-and-done):
  TIER 1 (iterate until GREEN):
    printf '%s' "<self-contained prompt>" | codex review -c model="gpt-5.3-codex-spark" -
  TIER 2 (ship gate, after Spark GREEN; iterate until ITS GREEN; never drop back):
    printf '%s' "<prompt+history>"        | codex review -c model_reasoning_effort=xhigh -
  One-shot confirmations (tiny generated diffs) may go straight to tier 2.

PROMPT TEMPLATE: state WHAT the diff is (files, intent, constraints), the rule pack items
that apply (R1/R2 especially), KNOWN/ACCEPTED items not to re-raise, ROUND HISTORY
(verdicts + fixes so far), and ALWAYS end with:
  "YOU MUST END YOUR FINAL MESSAGE WITH EXACTLY ONE LINE: VERDICT: GREEN or VERDICT: RED"

CAPTURE: redirect to a file (output can exceed 30KB): `... - < prompt.txt > findings.txt 2>&1`.
Read the FINAL codex message (grep "VERDICT" + read the tail block); a buried finding can sit
above the tail, so skim the whole findings section. No explicit verdict = INCONCLUSIVE; the
withdrawal/"no findings" sentence counts only if unambiguous.

MUTUAL AGREEMENT (the part that needs judgment -- escalate to the orchestrator when unsure):
never silently accept OR ignore a finding. If you disagree: next round quotes the finding
verbatim, states the counter-evidence (file:line, measured numbers, schema read-backs), and
asks codex to DEFEND / REVISE / WITHDRAW. Fix accepted findings + add a regression test
locking each one BEFORE the re-review round. After 2-3 unresolved rounds, stop and surface
both positions to the orchestrator/owner.

OPS: stall ceiling ~10 min per round (kill the process by PID and retry once); error
signatures "usage limit" (quota; wait/notify owner) and "Transport channel closed"/
"Reconnecting N/5" (backend down; notify). Track every round in the brief closeout:
model, round #, findings, disposition, verdict. Session evidence this loop works: it caught
16 real findings across 5 PRs in the last 24h (stale-store paints, SSR hydration, a
0/0-frequency misreport, null-substance aggregation, reverted fixes, schema gaps).

## 4. NEXT WORK SPEC -- STATS ENGINE PHASES 2-3 (blocked on owner inputs)

OWNER MUST SUPPLY FIRST (the "verify before hardcode" cutoffs, design doc section F):
  (a) ProUCL v5.2 lognormal Chebyshev-by-sigma band cutoffs (the 0.5/1.0/1.5/2.0/3.0 ladder
      + the small-n ~50-60 switch); (b) confirmation of GOF default alphas (normal 1% /
      gamma 5% / lognormal 10%); (c) Tech Guide worked-example datasets + published outputs
      for the bit-for-bit parity suite; (d) resolution of every in-code VERIFY comment.
PHASE 2 (one PR): GOF tests (Shapiro-Wilk + Lilliefors on raw and logged data; ProUCL gamma
  AD/KS with simulated critical-value tables), accept-if-either rule, best-fit verdict
  (normal -> gamma -> lognormal), recommended-UCL decision logic driving the panel basis
  string, bootstrap UCLs (percentile/BCA/bootstrap-t) in a Web Worker (none exists yet --
  next.config.ts has no worker config; stats.ts is already React-free/worker-portable).
PHASE 3 (one PR): gamma approximate+adjusted UCL (Grice & Bain), Land H-UCL with critical-
  value tables (Land 1971/1975; read GPL EnvStats for formulas only, NEVER copy code),
  Dixon (n<=25) / Rosner (n>25) outlier flags (flag-only, never auto-remove), Kaplan-Meier
  censored UCLs + the KM/ROS/DL2 runtime selector (initial KM; replaces the DL/2 placeholder).
Architecture locks (do not re-litigate): client-side TS only (Vercel cannot run Python);
  per-(substance+unit) buckets; recommended-logic default with all methods selectable;
  scaling lever later = server-side filter pushdown into the fetch RPC, never server stats.

## 5. TASK BRIEF FORMAT (orchestrator -> AGY; one brief at a time)

  BRIEF <n>: <title>
  WORKTREE/BRANCH: <per R5>            SCOPE: exact files allowed
  CONTEXT: <what exists, file:line>    SPEC: <exact behavior + formulas + sources>
  TESTS: <fixtures w/ hand arithmetic> RULES: R1..R10 + any brief-specific
  DONE = codex loop GREEN (sec 3) + gates GREEN (R6) + PR open w/ trail.
  CLOSEOUT (AGY returns): files changed, gate block, codex round table, deviations.

## 6. FRESH CLAUDE ORCHESTRATOR -- BOOTSTRAP PROMPT (owner: paste into a NEW Claude session)

  Read C:\projects\sstac-dashboard\AGY_ORCHESTRATION_HANDOFF_2026_06_06.md fully; it is
  your anchor. You are the ORCHESTRATOR only: write AGY task briefs (section 5), verify
  AGY closeouts yourself (run the R6 gates / targeted greps -- never trust claims), drive
  or adjudicate the codex loop (section 3), keep this handoff's section 1 state current.
  Token discipline: never write feature code; no subagents unless verification demands it
  (then Sonnet); keep replies terse. Lane background if needed:
  MATRIX_MAP_STATS_ENGINE_DESIGN_2026_06_05.md + memory
  dashboard_matrix_map_stats_lane_2026_06_05.md. Start by asking the owner whether the
  section-4 owner inputs (Tech Guide cutoffs) are ready; if not, ask which other lane AGY
  should work instead.

## 7. WHAT THIS FILE CANNOT FREEZE (orchestrator compensates)

Judgment calls (argue-vs-accept on codex findings, scope discipline, when a finding is
disproven by measurement), cross-session memory (the [[anchors]] in Claude memory), and
multi-session process coordination (parallel sessions, shared codex backend, ollama locks).
When AGY hits any of these: STOP and ask the orchestrator -- do not improvise.

## 8. CONTEXT PACK (frozen 2026-06-06 from a fully-verified session -- read INSTEAD of exploring)

AUTH (how a request is allowed):
- Supabase SSR auth; src/middleware.ts refreshes the session + gates all (dashboard) routes.
  NEVER edit middleware (protected, R8).
- Roles live in public.user_roles (user_id, role); admin checks use role IN
  ('admin','matrix_admin') -- client helper checkCurrentUserAdminStatus() in
  src/lib/admin-utils. Admin-only UI (CSV exports etc.) keys off that.
- matrix_map data access: RPC matrix_map.fetch_measurements_for_samples(p_sample_ids uuid[])
  is SECURITY DEFINER; requires an authenticated caller AND membership in the matrix_map
  email allowlist; admins bypass to all non-deleted DRAs, non-admins see public/granted
  DRAs only. The map UI calls it via supabase.schema('matrix_map').rpc(...).
- Storage: private bucket 'documents'; review files at review-files/<auth.uid()>/...;
  owner-scoped insert/select/update/delete policies + BUCKET-WIDE admin select
  (see supabase/migrations/20260606000001_*).
- Python/engine surfaces are hard-gated local-only: requireLocalEngine() (src/lib/api-guards.ts)
  returns 503 unless LOCAL_ENGINE_ENABLED='true' -- nothing Python ever runs on Vercel.

SUPABASE (project qyrhsieynzfgyuqzznap; live == repo migrations as of a3cc47c):
- Schema matrix_map: substances, source_dras, samples, sample_events, measurements
  (key cols: medium in sediment/toxicity/community + water/tissue empty; value, unit,
  detection_limit, qualifier, censored bool; provenance bnrrm_chemistry_id UNIQUE,
  bnrrm_toxicity_id UNIQUE, (bnrrm_community_id,substance_id) UNIQUE; bnrrm_env_modifier_id
  DOES NOT EXIST by owner decision), service_role_audit (invoked_by_role NOT NULL).
  Row counts ~: sediment 7472-7508, toxicity 334, community 175, substances ~194, dras 19.
- public schema: app tables incl. user_roles, review_submissions (status CHECK
  IN_PROGRESS|SUBMITTED), catalog staging/promotion tables (OWNER-GATED lane -- AGY never
  touches qa_status or promotions, R3).
- engine-v2 tables (v2_projects, v2_judgments, ...) exist: NEVER touch (parallel lane).
- DB writes happen ONLY via append-only migration files the owner applies (R7). The owner
  has a read-capable MCP; route read-back requests through the orchestrator.

DATA FLOW the stats engine sits in (all client-side after the RPC):
  RPC fetch -> normalizeMeasurementRows -> measurementStore (selectedIdKey, rows, isLoading)
  -> filterStore filterState -> shared filterMeasurementRows (src/lib/matrix-map/
  filter-measurements.ts) -> computeSelectionStats (src/lib/matrix-map/stats.ts)
  -> MatrixMapSelectionStats.tsx cards, mounted by MatrixMapStatsShell.tsx in the left
  panel (readiness = measurementStore.selectedIdKey === selectionStore key join('|')
  AND !isLoading -- this staleness gate was a codex P2, do not weaken).
  Panel layout/drag/clamp: src/components/MatrixDashboard.tsx + matrix-map-panel-layout.ts.

QUIRKS that look like bugs but are not:
- e2e expects exactly 138 passed / 69 skipped; "permission denied for table
  source_lead_triage" in e2e webserver logs is pre-existing noise, not a failure.
- Lint has 34 legacy warnings (0 errors is the bar). better-sqlite3/node-pty are
  webpack-externalized local-dev modules. Worktree dev servers: npx next dev WITHOUT
  --turbopack (junction casing). PR unmergeable => GitHub silently runs NO CI (R9).

## 9. AGY SUBAGENT + MODEL PLANNING (orchestrator specifies per brief)

Every task brief (section 5) gains a line:
  SUBAGENT PLAN: <role> -> <AGY model tier> [, ...]

Assignment principles (proven in the Claude-era of this lane):
- NUMERICAL CORE (stats.ts math, GOF implementations, critical-value tables, parity
  fixtures, anything under the R2 parity bar) -> STRONGEST tier (Gemini 3.1 Pro High).
  Rationale: the expensive failure mode is RED codex rounds, not implementer tokens.
- MECHANICAL work (test scaffolding, UI wiring, Web Worker plumbing, gate running,
  characterization tests, doc updates) -> FAST tier (Gemini 3.5 Fast High).
- INTERNAL PRE-REVIEW: before the codex loop, spawn a FRESH adversarial reviewer subagent
  (strongest tier, read-only, self-contained prompt: "find real bugs, verify the arithmetic
  by hand, do not rubber-stamp") and fix its findings first. This is the Leg-1 pattern that
  kept codex rounds short: cheap internal rounds absorb the easy findings so codex quota is
  spent on hard cross-file issues. The implementer must NEVER review its own diff.
- VERIFICATION subagents re-run claims (diffs, regenerated outputs, gate exits) rather than
  trusting the implementer's report -- fresh subagent, fast tier.
- Concurrency: max ~3 subagents; never two writers in one worktree; reviewers are read-only.
- The orchestrator may override the plan per brief; AGY may NOT silently downgrade the tier
  on numerical-core work.

## 10. TOKEN-EFFICIENT BRIEF DELIVERY (owner directive 2026-06-06)

Orchestrator writes each task brief to a FILE (.tmp_agy_brief_<n>.md in the repo root)
and hands AGY ONE LINE: "Read C:\projects\sstac-dashboard\.tmp_agy_brief_<n>.md and
execute it." Never paste lengthy instructions inline. AGY closeouts likewise go to a
FILE (.tmp_agy_closeout_<n>.md); the owner relays only the one-line path. The
orchestrator reads closeouts with targeted greps before full reads.
