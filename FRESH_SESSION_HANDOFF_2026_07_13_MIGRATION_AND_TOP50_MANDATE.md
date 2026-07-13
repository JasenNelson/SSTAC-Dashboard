# FRESH SESSION HANDOFF -- Migration + Top-50 Priority Mandate (2026-07-13)

Migration point from the mo-nextrun-2026-07-12 run (tokens ran low). This is the PRIMARY resume anchor.
Read this first, then the two linked packets, then execute the MANDATE below.

## 0. FRESH-SESSION MANDATE (what the owner wants next)
**Explore the whole SSTAC-Dashboard project and produce the TOP 50 PRIORITY TASKS to move it toward
its goal and completion.** Deliver a ranked, deduplicated list (most-impactful first), each task with:
a 1-line description, the lane/area, the blocking gate (owner decision / code / data / verification),
rough size, and a pointer to the source doc/code. Draw from -- do NOT re-derive from memory:
- The consolidated owner-decision queue: `docs/MATRIX_OPTIONS_MO_NEXTRUN_OWNER_DECISIONS_CONSOLIDATED_2026_07_12.md`
  (15 batched owner-gated items -- catalog D1-D3 + IRIS/copper/sodium/P28, T31 STEP-2, E2E secrets,
  IOCO publish, coordinate extraction, inhalation).
- `docs/MATRIX_OPTIONS_COMPLETION_STATUS_2026_07_11.md` (section 3 HITL queue + Part-3 unlock map).
- The four #618 readiness packets (catalog arbitration, measurement/waterbody, T40 E2E, DRA triage).
- `docs/INDEX.md`, the project goal in `CLAUDE.md`, and `C:\Projects\Knowledge-Base\PROJECTS_MAP.md`.
Use Sonnet Explore subagents (fan out across subsystems) to gather, then Opus to rank/synthesize the 50.
The project GOAL (per CLAUDE.md L1): a complete Next.js "Agentic OS" dashboard -- Matrix Options
calculators + Matrix Map + BN-RRM + SSD + CEW/TWG + Agentic OS terminal, backed by verified regulatory
values. "Completion" = the owner-gated catalog arbitration finished, matrix-map data fully loaded +
published appropriately, E2E coverage on, and the remaining feature lanes (inhalation, coordinate
extraction) shipped.

## 1. Baseline (current, post-merge)
- `origin/main` = **5b5d74b** (this run's PR #619 merged 2026-07-13; main CI all-green). Branch the
  fresh session off CURRENT origin/main, NOT feb99a6.
- **PRIMARY checkout `C:\Projects\sstac-dashboard` is STALE** (left at deede52, now far behind + dirty
  with 7 config/skill edits). L0 1.6 conflict-check said skip its fast-forward during the run. A fresh
  session should either work in a NEW worktree off origin/main (L0 1.15) or, if idle, fast-forward the
  primary (stash the 7 edits first, never reset). ~50 worktrees + foreign processes exist (incl a 9.3GB
  engine_v2 evaluator from another session -- not ours; leave it).

## 2. What this run shipped + APPLIED
- **PR #619 (MERGED)** -- Lanes 1-4 prep: catalog arbitration owner packet + P28 worklist (357);
  T31 undated measurement-load STEP-1 (generation only: +4178 undated events / +5752 measurements, 25
  idempotent chunks, data-safe rollback, apply_live_load.py --manifest/--scripts-dir/--report + guards);
  T32 waterbody packet; T40 member-side E2E specs (skip-safe, steady state e2e 132/93) + admin-tier gate;
  DRA source locators (all 5 PDFs located) + IOCO publish packet. codex-hardened (T32 op 8 rounds).
- **T32 waterbody normalization -- APPLIED 2026-07-13** (owner-approved). The ONLY production data write
  this run. Evidence: Marine 268 / Freshwater 22 / lowercase 0 / (empty) 4204 / total 4494. Applied via
  an exact id-keyed, LOCK+lock_timeout, rowcount-asserted, full-distribution-postcondition, fail-closed
  DO block (updated_at bumped). Exact rollback is committed in the T32 packet.
- **PR #620 (OPEN)** -- docs-only: marks T32 APPLIED + embeds the exact executed SQL/rollback as the
  committed source of truth + archive-before-edit. CI at handoff: 8 pass, E2E + Production Build pending
  (monitor bjrsa16ez). Next session: confirm #620 CI green, then merge it (owner-authorized merge).

## 3. Immediate next gated item (owner's stated order)
After #620 merges: **D1 dioxin-TEQ `--apply`** (narrow, well-reviewed) -- the promote script + the exact
coupled tripwire edit are in the consolidated packet item 1 (tripwire embedded there so it survives).
Then T31 STEP-2 (larger blast radius) after the small applies prove the workflow. Every production
write needs exact-operation `/codex-review` GREEN + owner approval (the id-keyed fail-closed DO-block
pattern used for T32 is the template).

## 4. Working posture (token efficiency -- owner-reinforced this session)
Opus = orchestration + hard judgment + the codex adversarial loop ONLY. Delegate: mechanical authoring
(scripts, ETL wrappers, promote scaffolds, report/packet drafts) -> AGY (AGY writes, orchestrator runs;
read the SSTAC AGY doc + /AGY skill first). Investigation + verification reads + the top-50 exploration
-> Sonnet Explore subagents (max 3 concurrent). codex gates every commit (targeted) + holistic per lane.
Supabase: reads/small-writes via project-scoped MCP; bulk via apply_live_load.py/pooler (never bulk SQL
through MCP). AGENTS.md Supabase Protocol supersedes the stale CLAUDE.md "MCP fails 100%" text.

## 5. Run artifacts (in this worktree .tmp/mo-nextrun-2026-07-12/)
RUN_STATE.md, PR_MANIFEST.md, HEARTBEAT.log, COMMAND_LOG.md (every codex round + AGY + owner-approval),
t32_exact_operation.md (the applied DO block + rollback). The T31 STEP-1 generated artifacts
(etl_undated_output.sql 17MB, 25 chunks, manifest, rollback) are NOT committed -- regenerated by the
STEP-2 runbook (T31 STEP-1 report section 9).

## 6. Process/hygiene
Orphan sweep clean (0 orphans; this run left no OS processes). No owned background tasks except the
#620 CI monitor (bjrsa16ez) -- it self-terminates. Token budget: LOW (reason for this migration).
