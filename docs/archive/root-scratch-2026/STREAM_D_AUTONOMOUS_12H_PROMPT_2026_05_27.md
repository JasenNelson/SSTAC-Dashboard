# Stream D Autonomous Session Prompt -- Catalog Extraction Agent Scaffolding

**Authored:** 2026-05-27 by Opus 4.7 main session.
**Intended use:** Paste the body of this file (starting at the `===` line below) as the first message of a fresh Claude Code session opened in `C:\Projects\SSTAC-Dashboard`. The fresh session works autonomously for up to ~12 hours on Stream D scaffolding of the multi-week plan at `C:\Users\jasen\.claude\plans\lively-stargazing-meadow.md`.

**Parent session continues in parallel:** Stream A (The Guide gap-fill). The parent session is on `main`; the autonomous session must work on a feature branch and never touch `main` directly.

**Plain ASCII only** (code point <= 127) -- no em-dashes, smart quotes, emojis, Unicode arrows.

---

> **HISTORICAL:** this prompt describes the OLD topology (Docling + local Ollama + run.ps1 + LlmClient). It was executed 2026-05-27 and produced the Phase 1 scaffold. The current active topology is Claude-Code-as-worker; see STREAM_D_REDESIGN_2026_05_28.md (committed at b252589). This file is retained as an audit-trail artifact of the executed prompt; do not use it as a current spec.

=== AUTONOMOUS SESSION PROMPT BEGINS BELOW ===

You are a fresh Claude Code session running autonomously on the SSTAC Dashboard project. A parallel parent session is working on Stream A (The Guide content update) on `main`. You are working on Stream D (Catalog Extraction Agent scaffolding) on a feature branch. Do not touch `main`. Do not touch Stream A files.

**Working directory:** `C:\Projects\SSTAC-Dashboard`
**Approved plan:** `C:\Users\jasen\.claude\plans\lively-stargazing-meadow.md` (read it first)
**Owner is away.** You have up to 12 hours of autonomous runtime. The owner will return and review your work.

---

## 1. Mandatory reading at session start (in this order)

1. `C:\Projects\CLAUDE.md` (L0 cross-project rules) -- already loaded via CLAUDE.md hierarchy.
2. `C:\Projects\SSTAC-Dashboard\CLAUDE.md` (project rules).
3. `C:\Projects\SSTAC-Dashboard\docs\GATE_MODE_SOP.md` (gate discipline).
4. `C:\Users\jasen\.claude\plans\lively-stargazing-meadow.md` (the approved multi-week plan -- you are executing Stream D scaffolding from this plan).
5. `C:\Users\jasen\.claude\projects\C--Projects-Regulatory-Review\memory\MEMORY.md` index (standing rules; the L0 file references the key anchors).

**Memory anchors to load (high authority for this work):**
- `cross_project_sonnet_subagents_opus_codex_review.md` (delegate implementation to sonnet; reserve Opus main for orchestration + adversarial review)
- `cross_project_codex_review_adversarial_iterative_loop_default.md` (codex iterate to GREEN, mutual agreement)
- `cross_project_codex_batch_prompts_medium_effort.md` (medium effort default, batch questions)
- `cross_project_codex_fallback_with_rereview_queue.md` (fallback ladder)
- `cross_project_push_protocol_all_gates_must_be_green.md` (4 gates GREEN; waivered is NOT green)
- `cross_project_workstream_conflict_check_before_pivot.md` (check parent session before pivots)
- `cross_project_mid_session_workstream_recheck.md` (~2h cadence re-check)
- `cross_project_local_ollama_only_for_ingestion_pipelines.md` (local Ollama only for ingestion; no paid LLM APIs)
- `cross_project_loader_allowlist_strategy_a.md` (loader allowlist invariants)
- `feedback_no_tier_judgment_for_ai.md` (AI is evidence-finder; HITL judges)
- `cross_project_supabase_protocol_explore_before_assume.md` (read-only exploratory SQL first)
- `cross_project_supabase_mcp_dead_skip_to_sql_editor.md` (no MCP; owner pastes into SQL Editor)
- `cross_project_fork_existing_over_design_new.md` (copy working examples; do not author from scratch)
- `cross_project_never_delete_regression_tests_during_cleanup.md` (preserve regression tests)
- `cross_project_codex_cli_windows_pytest_temp_stall.md` (do not ask codex to run pytest)
- `cross_project_use_venv_python_not_system_python.md` (always venv python)

---

## 2. Hard constraints (NEVER violate)

### Branch policy
- Create branch immediately: `feat/stream-d-catalog-agent-scaffold` from current `main` tip.
- NEVER commit directly to `main`. NEVER `git push origin main`. NEVER force-push anywhere.
- All commits and pushes go to `feat/stream-d-catalog-agent-scaffold`.
- If the parent session pushes new commits to `origin/main` during your run (Stream A), DO NOT rebase or merge them in. Stay on your branch base. The owner will resolve at merge time.

### Files you must NOT modify
- Anything under `matrix_research/content_drafts/` (Stream A territory).
- `CLAUDE.md` at any level.
- Anything under `docs/archive/` (audit trail).
- Anything under `supabase/migrations/` that has been applied (find them by checking which files are not your new ones).
- Anything under `src/data/` (curated HITL catalogs).
- Any `*_HANDOFF.md` file at root (use `/handoff-update` if you really must touch one, but you should not need to).
- `package.json`, `next.config.ts`, `tsconfig.json` (Tier 1 protected per project CLAUDE.md).
- `src/middleware.ts` (Tier 1 protected).

### Plain ASCII
- Every file you author must contain only code points <= 127.
- Spot-check with `python -c "any(ord(c) > 127 for c in open('path', encoding='utf-8').read())"` before each commit.

### No Supabase MCP, no DDL execution
- You may NOT apply any Supabase migration. You DRAFT migration SQL files; the owner pastes them into Supabase Studio SQL Editor.
- For any Supabase read needed: provide the owner with read-only exploratory SQL in a clearly-marked block; if you cannot proceed without the output, write a HITL pause artifact (see Section 6) and continue with other work.

### No Ollama calls
- The agent design DEFINES the local-Ollama integration but DOES NOT run it. End-to-end Docling+Ollama extraction is out of scope for this 12h session (it would burn the Ollama lane per L0 rule 1.12 and you do not have authority to allocate that lane).
- You may unit-test `staging.ts` and `extract.py` helpers without invoking Ollama (mock the LLM client).

### No catalog mutation
- Never write to `promoted_parameter_values`, `parameter_value_reviews`, `catalog_evidence_items`, `catalog_sources`, `source_lead_triage` (the 5 existing tables).
- Your new `catalog_extraction_staging` table is the ONLY catalog surface you may design / draft. Even there, you do not execute the migration.

### Process safety
- Max 3 background subagents simultaneously.
- If running `Get-Process python` shows orphans you didn't spawn, do not kill them -- they may be the parent session's. Write a HITL pause artifact and stop.
- Per `cross_project_harness_background_processes_die_on_exit.md`: do not use `Bash run_in_background: true` for any task you expect to outlive a tool call. Use `schtasks` / WMI Win32_Process.Create only if you must, and only for genuine long-runners (you should not need to in this scaffold work).

---

## 3. Scope -- 7 sub-tasks in order

Execute these sequentially. Each is a separate commit (or small commit group). After each commit, run the commit protocol (codex iterate-to-GREEN, OR Opus adversarial subagent fallback per Section 5). After each functional milestone, run the push protocol (4 gates GREEN, then push to your feature branch).

### Sub-task 1: Branch + workstream-conflict check (first action)
- `git fetch origin && git status --short --branch && git log --oneline origin/main -5`.
- Verify `origin/main` tip is `9465013` (or later if parent session pushed Stream A).
- Verify clean tree (the only untracked files at root should be handoff `.md` files + `.mcp.json` + `coverage/` + scratch `.tmp_*`).
- `git checkout -b feat/stream-d-catalog-agent-scaffold` from current `main`.
- Confirm in your first chat message back to the user: branch base SHA, expected tip, what you will commit first.

### Sub-task 2: Read-only Supabase exploratory SQL (HITL pause point)
- Draft a read-only SQL block at `.tmp/stream-d-explore-queries.sql` that queries:
  - `information_schema.tables` filtered to the 5 existing catalog tables and any matrix_options schema tables.
  - `information_schema.columns` for each existing catalog table.
  - Any existing constraints / indexes / RLS policies on those 5 tables.
- Per L0 explore-before-assume: ZERO ASSUMPTIONS about column types or RLS shape. The output you get back from owner-run SQL drives Sub-task 3's migration design.
- Write a HITL pause artifact at `STREAM_D_HITL_PAUSE_SQL_EXPLORE_2026_05_27.md` containing the SQL block + instructions ("paste into Supabase Studio SQL Editor, copy output, paste back into this file under the OUTPUT section, then notify me").
- If owner is not available (you are running unattended): commit the pause artifact + SQL file, push, then continue with Sub-task 3 using **conservative defaults** (UUID PKs, TIMESTAMPTZ timestamps, RLS that defers to admin / authenticated patterns from existing migrations). Document the assumptions clearly in the migration file header so the owner can correct them on return.

### Sub-task 3: Draft `catalog_extraction_staging` migration
- File: `supabase/migrations/2026xxxxxxxx_catalog_extraction_staging.sql` (use a timestamp 2 minutes after the most recent existing migration filename to maintain chronological ordering).
- Schema baseline (from the approved plan; refine if Sub-task 2 SQL output indicates a column name / type to match):
  - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `source_zotero_key TEXT NOT NULL` (Zotero item key the row was extracted from)
  - `source_attachment_path TEXT` (PDF attachment path, if known)
  - `extracted_at TIMESTAMPTZ NOT NULL DEFAULT now()`
  - `extraction_pass_id UUID NOT NULL` (groups rows from one agent run)
  - `extraction_pass_started_at TIMESTAMPTZ NOT NULL`
  - `extraction_pass_finished_at TIMESTAMPTZ`
  - `proposed_kind TEXT NOT NULL CHECK (proposed_kind IN ('parameter_value', 'evidence_item', 'source_lead'))`
  - `proposed_payload JSONB NOT NULL` (the proposed catalog row contents)
  - `confidence NUMERIC` (0..1, agent self-confidence; may be NULL)
  - `extraction_notes TEXT` (free-text agent commentary)
  - `extraction_model TEXT` (which Ollama model produced this; for audit)
  - `hitl_status TEXT NOT NULL DEFAULT 'pending' CHECK (hitl_status IN ('pending', 'approved', 'rejected', 'superseded'))`
  - `hitl_reviewed_by UUID REFERENCES auth.users(id)`
  - `hitl_reviewed_at TIMESTAMPTZ`
  - `hitl_review_notes TEXT`
  - `promoted_to_id UUID` (the production-table row this was promoted into; null if rejected/pending; FK NOT enforced because target table depends on `proposed_kind`)
  - `created_by UUID NOT NULL REFERENCES auth.users(id) DEFAULT auth.uid()` (the agent service-role user)
- RLS: authenticated SELECT; admin INSERT/UPDATE/DELETE (mirror the existing `promoted_parameter_values` migration RLS shape -- copy it; do not invent).
- Add index on `(hitl_status, extraction_pass_id)` for the staging-review UI query path.
- Add index on `(source_zotero_key)` for cross-pass dedup checks.
- Add column comment on every column (per `cross_project_supabase_protocol_explore_before_assume.md` documentation hygiene).
- Header comment block in the SQL file: who authored, what the table is for, link to the plan file, link to the design doc (Sub-task 7).
- **Codex review on this SQL file is a HARD GATE.** Do not start Sub-task 4 until codex GREEN (or Opus adversarial fallback GREEN) on the migration.

### Sub-task 4: `scripts/catalog-overnight/` scaffold
- New directory: `scripts/catalog-overnight/`
- Files:
  - `README.md` -- explains the harness, the breadcrumb format, the Windows Task Scheduler setup steps, the HITL approval gate, and the safety invariants.
  - `extract.py` -- Docling-first PDF extraction; mirrors the pattern at `C:\Projects\Regulatory-Review\2026_Database_Development\data_acquisition\bnrrm_extraction\extract_tables_docling.py` BUT scoped to "extract structured value records from PDF tables / figure captions, write to staging table via service-role psycopg connection." Per `cross_project_fork_existing_over_design_new.md`: copy the bnrrm_extraction pattern; do not author from scratch. Constants to mirror: `MAX_PAGES_FOR_OCR`, `PROACTIVE_CHUNK_THRESHOLD`, `DEFAULT_CHUNK_SIZE`. Local Ollama only (per `cross_project_local_ollama_only_for_ingestion_pipelines.md`); no paid LLM API. Do NOT actually invoke Ollama in this scaffold -- the LLM client is structured for injection (mocked in tests).
  - `run.ps1` -- Windows PowerShell harness. Emits breadcrumb JSON `{status, last_progress_at, output_artifacts, current_zotero_key}` to `.tmp/catalog-overnight-breadcrumbs/<timestamp>.json` every 60 seconds (heartbeat). Stall watchdog: if no breadcrumb update for 10 minutes, terminate the python subprocess + write a STALLED breadcrumb. On normal exit: writes COMPLETED_GREEN or COMPLETED_RED breadcrumb with final summary. Per L0 standing rule 1.13: status enum is STARTED | IN_PROGRESS | COMPLETED_GREEN | COMPLETED_RED | STALLED | SILENT_BAIL.
  - `requirements.txt` -- python deps (docling, psycopg, pillow, etc.). Do NOT `pip install` anything from this session; just author the file.
  - `.venv/` directory creation is documented in README.md but you do NOT create it (per use-venv rule; owner sets up the venv at first real run).
  - Unit tests for `extract.py` at `scripts/catalog-overnight/tests/test_extract.py` using pytest -- mock the Ollama client + Docling output; assert the staging-row builder produces the right shape.
- Reuse: import from existing helpers where they exist. The BN-RRM `extract_tables_docling.py` is in a different repo; copy the pattern, do not symlink.

### Sub-task 5: `src/lib/catalog/staging.ts` server-side helpers
- New file: `src/lib/catalog/staging.ts`
- Exports:
  - TypeScript types matching the `catalog_extraction_staging` table (mirror the column shape exactly).
  - `listPendingStagingRows({ extractionPassId?, limit?, offset? }) -> Promise<StagingRow[]>` -- server-side, uses the existing Supabase server-client pattern (look at how QA review queries are written and fork that).
  - `approveStagingRow({ stagingId, hitlNotes? }) -> Promise<{ok, promotedToId}>` -- explicit HITL action; inserts into the target table based on `proposed_kind`. **Throws if called from a non-admin session.** **Throws if `proposed_kind` is unrecognized.**
  - `rejectStagingRow({ stagingId, hitlNotes? }) -> Promise<{ok}>` -- explicit HITL action; sets hitl_status='rejected'.
  - `markSupersededStagingRows({ extractionPassId }) -> Promise<{ok, count}>` -- bulk marker for when a later pass replaces an earlier one's proposals.
- All functions write `hitl_reviewed_by = auth.uid()` and `hitl_reviewed_at = now()` on the staging row.
- All functions audit-log to a logger consistent with the existing QA review path (find it; do not invent).
- Unit tests at `src/lib/catalog/__tests__/staging.test.ts` using Vitest with `--pool=forks --maxWorkers=1` (IPC stability on Windows). Test: admin can approve; non-admin cannot; unknown proposed_kind throws; rejected row does not promote; superseded row stays in table with new status.

### Sub-task 6: `src/components/matrix-options/CatalogStagingReview.tsx`
- New file: a HITL approval pane for reviewing staging rows.
- Per `cross_project_fork_existing_over_design_new.md`: find an existing review pane in the codebase (likely the QA review surface from Phase 3 commit `2112733`) and copy its scaffold. Do not author from scratch.
- Layout: 3-column matching the existing Evidence Library 3-column (Phase 0.5 commit `0225a53`).
- Initial scope of this commit: READ-ONLY display of pending staging rows + filter by extraction_pass_id + sortable by confidence. Promote/Reject buttons exist but call `staging.ts` helpers -- they ARE wired, but rendered behind an admin-only check.
- Accessibility: aria-labels on all interactive elements (recent calculator commits set this baseline).
- Tests at `src/components/matrix-options/__tests__/CatalogStagingReview.test.tsx`: renders empty state when no rows; renders rows when present; admin sees promote/reject; non-admin does not; promote button calls helper with correct args.

### Sub-task 7: Design doc + final consolidation
- New file: `docs/STREAM_D_AUTONOMOUS_AGENT.md`
- Contents: end-to-end architecture (Zotero -> Docling -> Ollama -> staging table -> HITL review -> production tables), data flow diagram in ASCII, safety invariants (the 6 from the plan, restated), scheduling cadence proposal (owner answers nightly / weekly / on-demand later), the breadcrumb spec, the stall watchdog spec, the HITL review surface, the rollback story.
- Cross-link to: the plan file, the migration file, the script files, the lib file, the UI file.
- **Run a HOLISTIC codex review on the entire branch diff at this point** (per `cross_project_codex_review_targeted_vs_holistic_2026_05_13`). Use medium effort; batch all open questions into one prompt. Iterate to mutual-agreement GREEN.
- If holistic codex surfaces P1 issues: fix them, re-review, iterate.

---

## 4. Commit + push protocol (per standing rules)

### Commit protocol (before every commit)
1. Path-scoped staging only: `git add <specific-file>` (never `.` / `-A` / `-u`).
2. Codex iterate-to-GREEN on the diff (see Section 5 for adversarial loop methodology + fallback).
3. Commit with descriptive message. Co-authored line: `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>` (you are running with sonnet subagents; the orchestrator is Opus). Actually: use `Co-Authored-By: Claude <noreply@anthropic.com>` to avoid version specifics drifting.
4. Update `STREAM_D_PROGRESS_2026_05_27.md` at repo root after every commit with a one-line entry: timestamp, commit SHA, sub-task progressed, next planned action. This is your handoff to the parent session and the owner.

### Push protocol (before every push)
**Per `cross_project_push_protocol_all_gates_must_be_green.md` -- ALL 4 gates must be GREEN. Waivered is NOT GREEN. Skipped is NOT GREEN.**

1. **Lint:** `npm run lint`. Capture full output to `.tmp/gate-logs/lint-<timestamp>.log`. Confirm 0 errors.
2. **Unit:** `npm run test:unit -- --pool=forks --maxWorkers=1`. Capture to `.tmp/gate-logs/unit-<timestamp>.log`. Confirm all tests pass.
3. **Monitored build:** `npm run build:monitored:clean -- -TimeoutSeconds 360 -PollSeconds 10`. Capture to `.tmp/gate-logs/build-<timestamp>.log`. Confirm GREEN. Never raw `npm run build`.
4. **E2E:** `npm run test:e2e`. Capture to `.tmp/gate-logs/e2e-<timestamp>.log`. Confirm GREEN. If Playwright EPERM: one retry per `docs/GATE_MODE_SOP.md`. If still RED: stop, write HITL pause artifact, do not push.

Then `git push origin feat/stream-d-catalog-agent-scaffold`.

If you have run gates and any gate is non-GREEN: **do not push.** Investigate root cause. Fix. Re-run. Only push when all 4 are GREEN.

---

## 5. Adversarial review loop (codex primary; Opus subagent fallback)

### Primary: Codex CLI (per `cross_project_codex_review_adversarial_iterative_loop_default.md`)
- Invocation: ALWAYS via stdin pipe per L0 rule 1.13. Example:
  ```
  codex exec -C C:/Projects/SSTAC-Dashboard -s read-only - <<'PROMPT'
  <review prompt>
  PROMPT
  ```
- Effort: medium default (per `cross_project_codex_batch_prompts_medium_effort.md`). Reserve xhigh for the holistic checkpoint in Sub-task 7.
- Methodology: when codex returns findings you disagree with, argue back with quoted evidence in a follow-up codex invocation. Iterate to mutual-agreement GREEN. Do not silently accept; do not stubbornly reject.

### Fallback: Opus adversarial subagent (when codex CLI is unavailable)
**Per owner directive 2026-05-27: when codex becomes unavailable, use an Opus subagent in the same iterative-loop pattern as codex.**

- Spawn via `Agent` tool: `subagent_type=general-purpose`, `model=opus`. Prompt the subagent as an adversarial code reviewer with the same checklist you would have given codex.
- Subagent returns findings. You (orchestrator) read them, argue back via `SendMessage` if you disagree, iterate to mutual-agreement GREEN.
- Treat the Opus subagent's verdict as the GREEN gate equivalent (per owner directive 2026-05-27).
- Append the artifact + verdict + disposition to the codex re-review queue at `C:\Users\jasen\.claude\projects\C--Projects-Regulatory-Review\memory\codex_rereview_queue_2026_05_17.md` so when codex CLI is back, the owner / next session can re-review (per `cross_project_codex_fallback_with_rereview_queue.md`).

### When to invoke
- Before every commit: targeted iterative loop on the diff.
- Sub-task 3 (migration SQL): HARD GATE -- do not start Sub-task 4 until GREEN.
- Sub-task 7 (final): holistic on the entire branch diff. Use codex xhigh if codex CLI is available, otherwise Opus subagent.

---

## 6. HITL pause artifacts (how to wait for the owner without idling)

When you genuinely need the owner before proceeding (Supabase migration application, ambiguous schema decision, scope expansion request), DO NOT just stop. Instead:

1. Write a markdown file at repo root: `STREAM_D_HITL_PAUSE_<TOPIC>_2026_05_27.md`.
2. Header: what you need, why you need it, what you are doing in the meantime.
3. Commit + push the pause artifact so it appears in the feature branch.
4. Continue with the NEXT sub-task that does not depend on the pause.
5. When the owner answers (returns to find your work, reads the pause artifact, replies via the next message in your session), pick up the paused sub-task.

If you reach a point where ALL remaining sub-tasks depend on a pause: write the pause artifact, run a final gate sweep on what you have, push, then stop. Better to stop cleanly than to drift.

---

## 7. Workstream-conflict re-check cadence (every ~2 hours)

Per `cross_project_mid_session_workstream_recheck.md`:

1. `git fetch origin`.
2. `git log origin/main -5` -- did the parent session push new commits to main? If yes: read the commit messages, confirm they are Stream A (file paths under `matrix_research/content_drafts/`). If you see commits touching files in your Stream D scope, STOP and write a pause artifact.
3. Look at `.tmp_*` scratch files at repo root with `ls -lah .tmp_*` -- recent mtimes from another session indicate parallel work. Cross-reference against your stream's files.
4. Document the re-check in `STREAM_D_PROGRESS_2026_05_27.md` with timestamp + result.

---

## 8. Stop conditions (hard)

Stop and write a HITL pause artifact (do NOT continue, do NOT improvise) if:
- A Sub-task touches a file you are forbidden from modifying (see Section 2).
- A gate goes RED twice on the same root cause after one retry.
- Workstream-conflict re-check shows parent session committed in your scope.
- Codex CLI is unavailable AND the Opus adversarial subagent fallback also fails (rare; if both are down, something larger is wrong).
- You are about to make any decision the owner specifically gated in the approved plan (e.g., autonomous agent cadence, HITL review surface design lock-in beyond scaffold).
- You hit a 4-gate failure that you cannot diagnose in <30 minutes.
- You discover a file under `supabase/migrations/` that was applied but is malformed (do not touch it; document and pause).
- Process count exceeds 3 background subagents simultaneously.
- You think you might be exceeding scope of Section 3 -- when in doubt, write a pause artifact and ask.

---

## 9. Deliverables checklist (what "done for the night" looks like)

At the end of the 12h window (or when you decide you are stopping):

- [ ] Branch `feat/stream-d-catalog-agent-scaffold` pushed to `origin`.
- [ ] Migration SQL file authored + codex GREEN + push GREEN. NOT applied to Supabase (HITL gate).
- [ ] `scripts/catalog-overnight/` scaffold authored + tests passing + push GREEN.
- [ ] `src/lib/catalog/staging.ts` + tests authored + push GREEN.
- [ ] `src/components/matrix-options/CatalogStagingReview.tsx` + tests authored + push GREEN.
- [ ] `docs/STREAM_D_AUTONOMOUS_AGENT.md` design doc authored + holistic codex GREEN.
- [ ] `STREAM_D_PROGRESS_2026_05_27.md` updated with final summary (last entry: status COMPLETED_GREEN or PAUSED_HITL_<reason>).
- [ ] At least one HITL pause artifact for the Supabase migration application (since you cannot apply it yourself).
- [ ] All 4 gates GREEN on the final branch tip.
- [ ] No orphan python processes (`Get-Process python` shows none you spawned).
- [ ] Memory anchor `dashboard_stream_d_autonomous_scaffold_2026_05_27.md` written summarizing what shipped (link to commits + handoff for next session).
- [ ] Optional but recommended: a final `Get-Process node, python` snapshot in your progress doc confirming safe-to-exit.

---

## 10. First-message format (when you start)

Confirm in your first message back to the user (or in `STREAM_D_PROGRESS_2026_05_27.md` if no user is present):

1. Working directory: `C:\Projects\SSTAC-Dashboard`.
2. Branch base SHA: `<sha>` (expected `9465013` or later if Stream A pushed first).
3. Branch created: `feat/stream-d-catalog-agent-scaffold`.
4. Codex CLI availability: tested with `codex --version`; result.
5. Workstream-conflict check: clean.
6. First commit planned: Sub-task 2 SQL exploration artifact + HITL pause.

If anything in the mandatory reading (Section 1) or hard constraints (Section 2) seems contradicted by the current state of the repo: STOP and write a HITL pause artifact before any commits.

---

## 11. Session end protocol

Before you stop:
1. Final gate sweep: lint + unit + monitored build + e2e. All GREEN.
2. `git status --short` -- no uncommitted changes you intended to commit. Untracked files OK if they are pause artifacts / progress doc / breadcrumbs.
3. `Get-Process node, python -ErrorAction SilentlyContinue` -- no orphans you spawned. Report.
4. Write final progress doc entry: COMPLETED_GREEN / PAUSED_HITL_<reason> / STALLED.
5. Write memory anchor `dashboard_stream_d_autonomous_scaffold_2026_05_27.md` per Section 9.
6. Final message to the user (or to the progress doc): summary of what shipped, branch tip SHA, what is pending HITL action (Supabase migration application), what the next session would pick up.

=== AUTONOMOUS SESSION PROMPT ENDS ===

---

## Parent session notes (for owner reference; not part of the prompt)

- Parent session is on `main` running Stream A (The Guide gap-fill). Working on `matrix_research/content_drafts/The_Guide.md` only. Different file tree from Stream D. Conflict risk is low.
- Owner answered 2026-05-27: push policy = feature branch after each GREEN gate. Codex offline fallback = Opus adversarial subagent iterative loop (NOT pause + re-review queue).
- The autonomous session can run any time. Owner spawns by opening a fresh Claude Code session pointed at `C:\Projects\SSTAC-Dashboard` and pasting the body between the two `=== AUTONOMOUS SESSION PROMPT ===` markers above.
- Owner can monitor via:
  - `git log origin/feat/stream-d-catalog-agent-scaffold --oneline` to see commits as they push.
  - `STREAM_D_PROGRESS_2026_05_27.md` at repo root (the autonomous session updates this after every commit).
  - `.tmp/catalog-overnight-breadcrumbs/` (won't have content yet -- agent doesn't run end-to-end in this 12h scope; the harness scaffold is what gets built).
  - Any `STREAM_D_HITL_PAUSE_*.md` artifacts at repo root indicate the autonomous session needs owner input.
- When the owner returns: read the progress doc + the HITL pause artifacts in order, answer any open questions, decide whether to apply the staged Supabase migration via SQL Editor, then merge `feat/stream-d-catalog-agent-scaffold` -> `main` (via PR or fast-forward, owner's call).
