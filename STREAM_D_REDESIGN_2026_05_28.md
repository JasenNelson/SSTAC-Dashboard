# Stream D Catalog Extraction -- Redesign 2026-05-28

**Status:** v0.3 DRAFT. Author: autonomous session (Opus 4.7). Pending owner sign-off + cursor-agent round 3 GREEN before implementation lands.
**Branch:** `feat/stream-d-catalog-agent-scaffold` (head: `02dcc2d`).
**Adversarial review history:**
- Round 1 (cursor-agent gpt-5.3-codex-xhigh; codex CLI failed mid-stream): RED. 3 P1 + 7 P2 + 2 P3 findings. v0.2 addressed all 12.
- Round 2 (cursor-agent gpt-5.3-codex-xhigh, confirmation): RED. 9 of 12 prior findings CONFIRMED-FIXED. 1 new P1 surfaced (watchdog parity not fully preserved) + 3 PARTIAL P2s + 2 deep-check gaps. v0.3 addresses all of these. One round-2 finding argue-back: P2-6 "remaining textual /safe-exit references" are load-bearing audit-trail explaining the design-decision history; kept as-is.

**Why:** Prior scaffold's Docling + local Ollama + PowerShell-supervisor + Python-worker topology was based on misread precedents. Owner clarified (a) local-Ollama rule applies to LightRAG/RAG-Anything ingestion (not us), (b) BN-RRM autonomous pipeline was Docling-only with no LLM in the data path, (c) modern Claude Code + auto mode + skill-supported handoff patterns are dramatically more capable than the April-era scheduled-task topology. Three Explore subagents confirmed these corrections + lifted concrete patterns from Regulatory-Review + BN-RRM. Cursor-agent then surfaced 3 BLOCKER issues with the v0.1 redesign: (1) slash commands DON'T fire in `claude -p` headless mode (empirically verified at `src/lib/agentic-os/launch-validator.ts:172-175`), (2) watchdog regression vs current `run.ps1`, (3) invariant 5 contradiction.

---

## Locked decisions (owner sign-off 2026-05-28)

| # | Decision | Choice | Implication |
|---|---|---|---|
| 1 | Handoff doc structure | Single-file `CATALOG_EXTRACTION_HANDOFF.md` | Lighter than DEV_PLAN/HANDOFF split; matches BN-RRM precedent. |
| 2 | First-real-run scope | Smoke 1-3 hand-picked PDFs | Validate end-to-end loop before scaling. |
| 3 | Wake mechanism | Machine stays awake overnight + schtasks at 23:30 PT | Simplest; no BIOS-tweak fragility. |
| 4 | Sentinel + monitoring | Full BN-RRM kit: STOP + PAUSE + PRIORITY_BOOST sentinels + Telegram digest | Richest control surface; reuses proven daily-telegram-status pattern. |

---

## v0.2 corrections (cursor-agent review findings -> resolution)

### P1 BLOCKERs (all 3 accepted; structural fixes)

**P1-1 (slash commands dead in `-p` mode):** Drop `/update-docs` and `/safe-exit` from the session flow entirely. The PowerShell wrapper handles archive-before-edit BEFORE launching the claude session; the claude session ends with plain Python / Bash commands (git add + commit + exit) not slash commands.

**P1-2 (watchdog regression) -- v0.3 expanded:** Port the stall-watchdog logic from `scripts/catalog-overnight/run.ps1:170-216` into `.claude/scripts/launch_catalog_extraction.ps1` with FULL PARITY:
- `$StallSeconds = 600` (default, matches current run.ps1; tunable).
- Pass-scoped breadcrumb filter: wrapper generates a `$PassId` UUID at startup, filters `Get-ChildItem` to `"$PassId-*-py.json"` (matches current run.ps1:188-190). Avoids false-positives from stale breadcrumbs in prior passes.
- Periodic heartbeat during long-item processing: the starter prompt instructs the session to emit a `-py.json` breadcrumb EVERY ~120s during single-item processing (not just on item completion), so the watchdog has signal for long PDFs. Default heartbeat-during-item-processing cadence configurable via `$HeartbeatSeconds`.
- On stall: `taskkill /T /F` claude process tree + STALLED breadcrumb + exit code 124 (POSIX timeout convention).

**P1-3 (invariant 5 contradiction):** Rewrite invariant 5 from "All Ollama traffic loopback-only; no paid LLM APIs" to "All LLM calls go through the owner's local Claude Code session under their auth subscription. No autonomous service-role API keys for paid LLM providers (Anthropic, OpenAI, etc.). The DSN passed to the agent is a Supabase service-role token only -- no LLM key in the agent environment."

### P2 IMPORTANTs (all 7 accepted)

- **P2-1 (commit order broken midpoint) -- v0.3 simplified:** Merge prior commits 1 + 3 into a single "scaffold the new topology" commit so the wrapper + its required input files (handoff doc, manifest, progress, starter prompt) land together. Branch is fully usable on the new topology at this commit's tip. 3 commits total instead of 4.
- **P2-2 (test plan gaps):** Add tests for: STOP/PAUSE/PRIORITY_BOOST sentinel handling in wrapper, task-registration script generation, smoke import test for refactored extract.py, breadcrumb-file mtime watchdog logic.
- **P2-3 (upstream stale refs):** Sonnet ripple-sweep produced 14 edits across 6 files; applied in Phase 3 commit 3 (the 3-commit plan; entry 14 LEAVE_AS_AUDIT_TRAIL).
- **P2-4 (rollback runbook):** New "Rollback runbook" section authored (sonnet B); 6 numbered procedures.
- **P2-5 (archive-before-edit via /handoff-update conflicts with -p mode):** Resolved at the WRAPPER layer. `launch_catalog_extraction.ps1` archives `CATALOG_EXTRACTION_HANDOFF.md` to `docs/archive/YYYY-MM/CATALOG_EXTRACTION_HANDOFF_vN.0_ARCHIVED.md` BEFORE launching the claude session. The session then freely edits the live handoff. No `/handoff-update` skill dependency.
- **P2-6 (`/safe-exit` skill broken + cross-repo path):** Drop the dependency entirely. The wrapper handles process cleanup; the session's last action is a plain `git commit` + exit.
- **P2-7 (psycopg vs Supabase REST too broad):** Pick **psycopg only** for smoke phase. Defer REST as a future fallback.

### P3 MINORs

- **P3-1 (`LlmClient` may be dead abstraction):** **Remove the protocol entirely.** The refactored `extract.py` exports Docling helpers + StagingRow dataclass + StagingWriter + a row-builder. No protocol seam. If we ever add Ollama-as-fallback, design that contract fresh.
- **P3-2 (path-scoped staging in starter prompt):** Added to hard constraints in the starter prompt template.

---

## Target architecture (v0.3)

```
Owner (offline overnight; machine stays awake)
    |
    v
Windows Task Scheduler "SSTAC-StreamD-CatalogExtract" fires at 23:30 PT
    |
    v
.claude/scripts/launch_catalog_extraction.ps1  (the schtasks-invoked wrapper)
    |  Pre-flight (round 1):
    |   - Generate $PassId UUID for this run.
    |   - Check .tmp/CATALOG_EXTRACTION_STOP sentinel; exit 0 if present.
    |   - Check .tmp/CATALOG_EXTRACTION_PAUSE sentinel; exit 0 if present.
    |   - Honor .tmp/CATALOG_EXTRACTION_PRIORITY_BOOST sentinel by passing it
    |     forward to the claude session via prompt arg.
    |  Archive-before-edit:
    |   - cp CATALOG_EXTRACTION_HANDOFF.md to
    |     docs/archive/YYYY-MM/CATALOG_EXTRACTION_HANDOFF_v<N>.0_ARCHIVED.md
    |  Pre-flight (round 2 -- post-archive race close):
    |   - Re-check .tmp/CATALOG_EXTRACTION_STOP sentinel. If it appeared after
    |     pre-flight round 1 (during the archive cp), exit 0 here instead of
    |     spawning a session.
    |  Breadcrumbs:
    |   - Emit STARTED breadcrumb to .tmp/catalog-overnight-breadcrumbs/$PassId-<ts>-ps.json
    |  Spawn claude session:
    |   - claude -p "<inlined starter prompt with $PassId injected>" --output-format text
    |   - Set CATALOG_DSN env var from Credential Manager lookup
    |  Watchdog loop (every 60s while claude alive):
    |   - Find newest "$PassId-*-py.json" breadcrumb in .tmp/catalog-overnight-breadcrumbs/
    |     (PASS-SCOPED filter; avoids stale breadcrumbs from prior passes)
    |   - If no new pass-scoped -py.json breadcrumb for $StallSeconds (default 600s = 10min,
    |     matches current run.ps1; tunable via wrapper arg):
    |       taskkill /PID <claude-pid> /T /F
    |       Emit STALLED breadcrumb
    |       Exit 124 (POSIX timeout convention)
    |   - Else emit IN_PROGRESS breadcrumb with stalled_for_seconds counter
    v
claude -p headless session (auto mode active per L0 stream)
    |
    v
Session reads (no slash commands):
    - CATALOG_EXTRACTION_HANDOFF.md (state + immediate actions)
    - scripts/catalog-overnight/catalog_extraction_progress.json (queue state)
    - scripts/catalog-overnight/catalog_manifest.csv (work items)
    - .tmp/CATALOG_EXTRACTION_*_BOOST sentinels (priority signals)
    |
    v
For each pending manifest item (max N per session; smoke phase N=3):
    1. Check sentinels (STOP halt; PAUSE skip-remaining-cleanly).
    2. Read PDF via Bash + Python (extract.py library functions imported from CLI).
       During this potentially-long step: emit -py.json HEARTBEAT breadcrumb
       every ~120s so the watchdog has signal for long PDFs (parity P1-2 v0.3 fix).
    3. Reason over the Docling-extracted tables -> draft 1-N proposed catalog rows.
    4. Validate proposals (kind enum, payload shape, confidence range).
    5. psycopg INSERT into catalog_extraction_staging (DSN from CATALOG_DSN env).
    6. Atomic UPDATE catalog_extraction_progress.json (`completed` / `errors`).
    7. Emit -py.json COMPLETION breadcrumb to .tmp/catalog-overnight-breadcrumbs/.
    |
    v
At session end (no slash commands; inline instructions with explicit failure branching):
    - git add CATALOG_EXTRACTION_HANDOFF.md
                catalog_extraction_progress.json
                catalog_manifest.csv (if modified)
    - Try: git commit -m "catalog: overnight pass <pass_id> -- <N> proposed, <M> errors"
        - On commit SUCCESS:
            * Append memory anchor at
              ~/.claude/projects/C--Projects-SSTAC-Dashboard/memory/
              dashboard_catalog_extraction_pass_<YYYY_MM_DD>_<pass_id_short>.md
            * Emit COMPLETED_GREEN -py.json breadcrumb
            * Exit 0
        - On commit FAILURE (pre-commit hook reject, lint fail, conflict):
            * Capture commit stderr to .tmp/catalog-overnight-breadcrumbs/$PassId-commit-failure.log
            * git stash push --include-untracked
                              --message "catalog-pass-$PassId-commit-failure"
                              -- CATALOG_EXTRACTION_HANDOFF.md
                                 scripts/catalog-overnight/catalog_extraction_progress.json
                                 scripts/catalog-overnight/catalog_manifest.csv
              (PATHSPEC-SCOPED stash matching the session's staged paths; prevents
              stashing unrelated untracked files from concurrent lanes. Named so
              it's locatable in next session; --include-untracked preserves any
              new files the session created within these paths.)
            * Capture the stash ref from `git stash list | head -1` and write it
              into the COMPLETED_RED breadcrumb under stash_ref + into a new
              section "Recovery" in CATALOG_EXTRACTION_HANDOFF.md
            * Optionally `git stash show -p stash@{0} > .tmp/catalog-overnight-breadcrumbs/$PassId-stash.patch`
              as a belt-and-braces patch export
            * Emit COMPLETED_RED -py.json breadcrumb with note="commit failed; work stashed" + stash_ref
            * Exit 1 (signals wrapper to write COMPLETED_RED final state)
    - (wrapper detects session exit code: 0 = green, 1 = red, 124 = stalled,
      else = red with note)
    |
    v
Morning (05:00 PT): owner reviews
    - Git log on feat/stream-d-catalog-agent-scaffold
    - Telegram digest (extended daily-telegram-status.ps1; see Telegram section)
    - CatalogStagingReview UI at /admin/catalog-staging-review
    - Approve / reject staged rows (RPC promotes to production tables)
```

**Key shifts from v0.1 redesign (carried forward through v0.3):**

- **No slash commands in session flow.** `/update-docs` and `/safe-exit` are removed. Replaced by inline `git add` + `git commit` + plain exit, plus archive-before-edit at the wrapper layer.
- **Wrapper owns the watchdog.** Watchdog logic ported from the current `run.ps1`; same stall semantics (600s / 10 min default + taskkill process tree + STALLED breadcrumb), same exit-code conventions (0 = green, 124 = timeout, other nonzero = red).
- **Wrapper owns archive-before-edit.** The session never has to invoke `/handoff-update`; the wrapper does the `cp -> archive/YYYY-MM/` move pre-session.
- **psycopg-only data path.** No Supabase REST fallback in smoke phase. If psycopg fails, the run aborts with a clear error and HITL pause; we don't half-commit through a different path.

---

## File inventory (what changes)

### NEW files

| Path | Purpose |
|---|---|
| `STREAM_D_REDESIGN_2026_05_28.md` | This file. Design lock-in (v0.2 post-review). |
| `CATALOG_EXTRACTION_HANDOFF.md` | Single-file handoff at repo root. Versioned (v1.0 initial). Mirrors BN-RRM template. |
| `scripts/catalog-overnight/catalog_extraction_progress.json` | Initial empty state: `{"started":null,"last_updated":null,"completed":{},"errors":{},"needs_retry":[],"in_progress":null}`. Atomic writes. |
| `scripts/catalog-overnight/catalog_manifest.csv` | Schema: `doc_id,zotero_key_or_url,filepath,priority_tier,target_kind,notes`. Hand-curated 3 rows for smoke test (rows themselves added at first-real-run time). |
| `scripts/catalog-overnight/.gitkeep` | Keep dir alive after we remove the Ollama-era files. |
| `scripts/catalog-overnight/archive/.gitkeep` | Archive dir for any extract.py-local archive artifacts. |
| `docs/archive/.gitkeep` | Archive dir for `CATALOG_EXTRACTION_HANDOFF.md` rotation. |
| `scripts/catalog-overnight/CATALOG_EXTRACTION_STARTER_PROMPT.md` | Starter prompt template the schtasks wrapper inlines into `claude -p`. Contains: session capsule, mandatory reading list, hard constraints (incl. path-scoped staging per P3-2), autonomous-flow checklist, inline end-of-session steps (replaces /update-docs + /safe-exit). |
| `.claude/scripts/launch_catalog_extraction.ps1` | The schtasks-invoked PowerShell wrapper. Pre-flight sentinels + archive-before-edit + STARTED breadcrumb + spawn `claude -p` + watchdog loop + finalize breadcrumb. |
| `.claude/scripts/register_catalog_extraction_task.ps1` | One-shot script (run by owner once) that registers the Windows task via `schtasks /Create` using the `yyyy/MM/dd` date format + temp-file wrapper pattern (avoids 261-char `/TR` limit per BN-RRM commit 403fcfb1). |
| `.claude/scripts/catalog_telegram_extension.ps1` | Optional: small companion script invoked from the existing `C:/Projects/Regulatory-Review/.claude/scripts/daily-telegram-status.ps1` cross-project to include SSTAC-Dashboard Stream D status in the daily digest. Owner decides forking vs cross-project extension at first real run. |
### REFACTORED files

| Path | Change |
|---|---|
| `scripts/catalog-overnight/extract.py` | Becomes a thin Python library (no `main`, no CLI args, no SILENT_BAIL, no LlmClient protocol). Exports: `extract_tables_from_pdf()`, `build_staging_row()`, `StagingRow` dataclass, `StagingWriter` context manager. Import surface kept stable for tests. |
| `scripts/catalog-overnight/tests/test_extract.py` | Drop tests for the deleted `main()` CLI behavior + LlmClient protocol + run_pass orchestrator (orchestration moves into the session prompt). Keep `build_staging_row`, `to_db_tuple`, `write_breadcrumb` tests. ADD: smoke import test (`from extract import build_staging_row, StagingWriter, ...` works) + new tests for sentinel-handling in the wrapper (Pester or PowerShell-Pester). |
| `scripts/catalog-overnight/requirements.txt` | DROP `ollama>=0.4.0,<1.0.0`. KEEP `docling`, `pymupdf`, `psycopg[binary]`, `pillow`, `pytest`, `pytest-mock`. Add comment block documenting the redesign. |
| `scripts/catalog-overnight/README.md` | Rewrite to describe the Claude-Code-as-worker topology + schtasks recipe + sentinel discipline. Per ripple-sweep entries 10-12: replace `run.ps1` smoke/production command blocks with redesign-pointer notes. |
| `STREAM_D_PROGRESS_2026_05_27.md` | Per ripple-sweep entries 1-4: add HISTORICAL banner above the commit-log table + deliverables list; rewrite the "Pending HITL action item 6" to reflect the redesign. |
| `STREAM_D_AUTONOMOUS_12H_PROMPT_2026_05_27.md` | Per ripple-sweep entry 5: add HISTORICAL banner above the `=== AUTONOMOUS SESSION PROMPT BEGINS BELOW ===` line redirecting to STREAM_D_REDESIGN_2026_05_28.md. |
| `docs/STREAM_D_AUTONOMOUS_AGENT.md` | Rewrite end-to-end architecture spec. Replaces the prior Docling+Ollama section per ripple-sweep entries 7, 8, 9. (Reclassified from NEW to REFACTORED per round 2 P2-3 PARTIAL fix; the file already exists and is being rewritten, not created.) |

### DELETED files

| Path | Reason |
|---|---|
| `scripts/catalog-overnight/run.ps1` | Replaced by `.claude/scripts/launch_catalog_extraction.ps1`. The new wrapper lives in `.claude/scripts/` alongside `daily-telegram-status.ps1` and other repo-level scheduling helpers. |

### KEPT verbatim (no changes)

| Path | Status |
|---|---|
| `supabase/migrations/20260527000004_catalog_extraction_staging.sql` | Schema is right. Applied to live Supabase. |
| `supabase/migrations/20260527000005_catalog_approve_staging_rpc.sql` | RPC is extractor-agnostic. Applied. |
| `supabase/migrations/20260527000006-8_*.sql` | Three target tables. Applied. |
| `src/lib/catalog/staging.ts` + tests | HITL surface unchanged. Note: only callable from Next.js request context, NOT from the headless claude session. |
| `src/components/matrix-options/CatalogStagingReview.tsx` + tests | UI unchanged. |
| `src/app/(dashboard)/admin/catalog-staging-review/page.tsx` | Route unchanged. |
| `e2e/catalog-staging-review-rbac.spec.ts` | E2E unchanged. |
| `src/app/(dashboard)/admin/AdminDashboardClient.tsx` (Inbox card) | Card link unchanged. |
| `STREAM_D_HITL_PAUSE_SQL_EXPLORE_2026_05_27.md` | Per ripple-sweep: zero stale refs; pure SQL + schema. |
| Codex re-review queue Stream D entry | Per ripple-sweep entry 14: LEAVE_AS_AUDIT_TRAIL. |

---

## Starter prompt skeleton

The prompt is INLINED into the `claude -p` invocation by the wrapper. No slash commands; all end-of-session steps are explicit.

```
# SSTAC-Dashboard Stream D Catalog Extraction -- Autonomous Session

## Session capsule

1) Objective: process next N manifest items into catalog_extraction_staging via Docling + Claude-Code reasoning + psycopg.
2) Active session ID: catalog-extract-<YYYYMMDD>-<run_id>
3) Active pivots: (read CATALOG_EXTRACTION_HANDOFF.md "Next Session Starter" section)
4) Current blockers: (read handoff "Open blockers" section)
5) Next 3 actions: (read handoff "Immediate Actions" section)
6) Hard constraints (LOAD-BEARING; honor without exception):
   - NEVER write to production catalog tables directly. ONLY catalog_extraction_staging.
   - NEVER auto-promote staging rows. HITL via UI only.
   - NEVER mutate src/data/* (Tier 2 protected).
   - NEVER commit to main. Only feat/stream-d-catalog-agent-scaffold.
   - NEVER use `git add .` / `-A` / `-u`. Path-scoped staging only.
   - Plain ASCII only (code point <= 127).
   - Honor sentinels (.tmp/CATALOG_EXTRACTION_STOP, _PAUSE, _PRIORITY_BOOST) between items.
   - No slash commands at end of session. Use plain git commands + exit.

## Mandatory reading

- C:/Projects/CLAUDE.md (L0)
- C:/Projects/SSTAC-Dashboard/CLAUDE.md (L1)
- C:/Projects/SSTAC-Dashboard/CATALOG_EXTRACTION_HANDOFF.md (state + immediate actions)
- C:/Projects/SSTAC-Dashboard/scripts/catalog-overnight/catalog_extraction_progress.json (queue state)
- C:/Projects/SSTAC-Dashboard/scripts/catalog-overnight/catalog_manifest.csv (work items)

## Session flow

1. Read handoff + progress + manifest. Check sentinels (STOP / PAUSE).
2. Filter manifest to pending items (not in completed/errors).
3. For each pending item (max 3 per session in smoke phase):
   a. Extract tables via scripts/catalog-overnight/extract.py library (import in a Bash + python -c invocation).
   b. Reason over extracted tables -> draft 1-N proposed catalog rows (parameter_value | evidence_item | source_lead).
   c. Validate proposals (kind enum, payload shape, confidence in [0,1]).
   d. Insert into catalog_extraction_staging via psycopg (DSN from env CATALOG_DSN).
   e. Update progress.json atomically.
   f. Emit "$PassId-$YYYYMMDDTHHMMSSZ-py.json" breadcrumb to .tmp/catalog-overnight-breadcrumbs/.
      The timestamp uses Windows-safe basic ISO format (no colons; "20260528T230530Z"
      not "2026-05-28T23:05:30Z"); colons are invalid in Windows filenames and
      would silently fail to write, producing false STALLED watchdog kills.
      Pass-scoped $PassId prefix lets the wrapper watchdog filter to this run's
      breadcrumbs and ignore stale prior-pass crumbs.
   g. Check sentinels before next item.
4. End-of-session (NO slash commands):
   a. Write a one-paragraph summary to CATALOG_EXTRACTION_HANDOFF.md "Prior Session" section.
   b. Bump version in handoff doc header.
   c. git add CATALOG_EXTRACTION_HANDOFF.md scripts/catalog-overnight/catalog_extraction_progress.json
   d. git commit -m "catalog: pass <pass_id> -- <N> proposed, <M> errors"
   e. Append memory anchor at the canonical path with the pass summary.
   f. Emit COMPLETED_GREEN breadcrumb (or COMPLETED_RED on exit-with-errors).
   g. Exit.
```

---

## Implementation order (Phase 3) -- v0.3 SIMPLIFIED (3 commits per round-2 P2-1 PARTIAL fix)

Sequential. Each step is one logical commit. The branch is fully usable on the new topology at commit 1's tip (wrapper + all required inputs land together).

1. **Commit 1 -- "redesign: scaffold the new topology end-to-end":** add the wrapper + register script + watchdog logic + sentinel paths + handoff doc + progress.json + manifest.csv + starter prompt template + relevant `.gitkeep` files in one logical change. Specifically:
   - `.claude/scripts/launch_catalog_extraction.ps1` (with pass-scoped breadcrumb filter + 600s stall threshold + post-archive sentinel re-check).
   - `.claude/scripts/register_catalog_extraction_task.ps1`.
   - `CATALOG_EXTRACTION_HANDOFF.md` v1.0.
   - `scripts/catalog-overnight/catalog_extraction_progress.json` initial state.
   - `scripts/catalog-overnight/catalog_manifest.csv` schema (empty rows; owner adds smoke-test rows pre-first-real-run).
   - `scripts/catalog-overnight/CATALOG_EXTRACTION_STARTER_PROMPT.md` (with periodic heartbeat instruction + commit-failure branching).
   - `docs/archive/.gitkeep`.
   The old `run.ps1` still exists at this commit; the two topologies coexist briefly.

2. **Commit 2 -- "redesign: refactor extract.py to library + delete run.ps1 + drop ollama dep":** strip `extract.py` to library form (no main, no LlmClient, no SILENT_BAIL); update `test_extract.py` to match + add smoke import test + watchdog tests + sentinel-handling tests; drop `ollama` from `requirements.txt`; DELETE `scripts/catalog-overnight/run.ps1`. At this commit the branch is fully on the new topology.

3. **Commit 3 -- "redesign: ripple-sweep upstream docs + rewrite STREAM_D_AUTONOMOUS_AGENT.md + Telegram extension":** apply the 13 ripple-sweep edits from the sonnet sweep (entries 1-13; entry 14 LEAVE_AS_AUDIT_TRAIL). Rewrite `docs/STREAM_D_AUTONOMOUS_AGENT.md` overview + components 3 + 6 per the new topology. Add `.claude/scripts/catalog_telegram_extension.ps1` (or document the cross-project extension path) for Telegram digest coverage.

---

## Risks / open considerations

1. **`claude -p` headless mode behavioral verification.** Auto mode behavior under `-p` has not been directly tested. Mitigation: Phase 3 commit 1's wrapper smoke test does a dry-run that exercises the spawn path + watchdog (without doing real Docling). If `-p` behaves unexpectedly, owner sees a STALLED or COMPLETED_RED breadcrumb the next morning and the manifest items are not lost (still in `pending`).

2. **Path-scoped staging discipline inside the autonomous session.** The starter prompt mandates `never git add ./-A/-u`, but the session is paid-LLM-grade autonomous; a mistake here commits unintended files. Mitigation: the wrapper can do a final `git status --short` post-session and refuse to push (or emit an alert) if unexpected paths are staged. (Open: implement this guard in the wrapper or trust the prompt? Default: trust the prompt for smoke; add wrapper guard if first run shows drift.)

3. **DSN secret handling.** The wrapper reads the service-role DSN from Windows Credential Manager at runtime via `Get-StoredCredential -Target 'SSTAC_CATALOG_DSN'` (requires `CredentialManager` PSGallery module installed once by owner). DSN is set as process env `CATALOG_DSN` before spawning the claude session. Never logged, never breadcrumbed.

4. **Telegram script ownership.** Owner decides at first real run: (a) fork `daily-telegram-status.ps1` into SSTAC-Dashboard's `.claude/scripts/` (cleaner separation), or (b) extend the Regulatory-Review script to also scan SSTAC-Dashboard repos (one script for all projects, more cross-project coupling).

5. **Bad-run recovery.** Documented in the new "Rollback runbook" section below.

---

## Rollback runbook

This runbook covers bulk recovery procedures for the Stream D autonomous overnight catalog extraction job. Use it when a full extraction pass produces systematically bad proposals that cannot be cleaned up by individual HITL click-through in the UI.

### 1. Stop tonight's run before it finishes

Drop a sentinel file to signal the running headless session to halt cleanly. The agent polls for this file between document iterations; it will finish the current document, skip subsequent queued PDFs, and exit without inserting further rows.

```powershell
New-Item -ItemType File -Force "C:\Projects\SSTAC-Dashboard\.tmp\CATALOG_EXTRACTION_STOP"
```

Verify the job has stopped by checking that the `SSTAC-StreamD-CatalogExtract` scheduled task is no longer in RUNNING state:

```powershell
schtasks /Query /TN "SSTAC-StreamD-CatalogExtract" /FO LIST | Select-String "Status"
```

Rows already inserted by the time the sentinel is detected remain in the staging table. Proceed to step 3 or 4 to clean them up.

### 2. Disable tomorrow's scheduled task

Prevents the task from firing again at 23:30 PT until explicitly re-enabled by the owner.

```powershell
schtasks /Change /TN "SSTAC-StreamD-CatalogExtract" /DISABLE
```

Confirm:

```powershell
schtasks /Query /TN "SSTAC-StreamD-CatalogExtract" /FO LIST | Select-String "Status"
```

Expected output: `Status: Disabled`

### 3. Bulk-supersede all rows from a bad pass (preferred recovery path)

Marks every staging row from the bad extraction pass as `superseded`. These rows drop off the active HITL queue (which filters on `hitl_status = 'pending'`) but remain in the table as an audit trail. This is the preferred recovery path because it is non-destructive and reversible.

Find the pass UUID:

```sql
SELECT extraction_pass_id, COUNT(*) AS row_count, MIN(created_at) AS run_started
FROM public.catalog_extraction_staging
GROUP BY extraction_pass_id
ORDER BY run_started DESC
LIMIT 10;
```

Apply (replace `<extraction_pass_id>` with the UUID):

```sql
UPDATE public.catalog_extraction_staging
SET
    hitl_status         = 'superseded',
    hitl_review_notes   = 'Bulk superseded via rollback runbook: bad extraction pass',
    hitl_reviewed_at    = NOW()
WHERE
    extraction_pass_id = '<extraction_pass_id>'
    AND hitl_status    = 'pending';
```

Verify:

```sql
SELECT COUNT(*)
FROM public.catalog_extraction_staging
WHERE extraction_pass_id = '<extraction_pass_id>'
  AND hitl_status = 'pending';
```

### 4. Bulk-delete a truly garbage pass (last-resort only)

Permanently removes staging rows for a pass when retaining them in the audit trail provides no value. This is irreversible. The audit trail for these proposals will be lost.

**Only use this path after owner confirmation.** Do not use it if any row has already been promoted.

```sql
-- Safety check: ensure no rows were promoted before deleting
SELECT COUNT(*)
FROM public.catalog_extraction_staging
WHERE extraction_pass_id = '<extraction_pass_id>'
  AND promoted_to_id IS NOT NULL;
-- If count > 0, stop. Use supersede (step 3) instead.

-- Delete only if promoted count is zero
DELETE FROM public.catalog_extraction_staging
WHERE extraction_pass_id = '<extraction_pass_id>'
  AND promoted_to_id IS NULL;
```

### 5. Re-enable the scheduled task after cleanup

```powershell
schtasks /Change /TN "SSTAC-StreamD-CatalogExtract" /ENABLE
```

Confirm: `schtasks /Query /TN "SSTAC-StreamD-CatalogExtract" /FO LIST | Select-String "Status"` returns `Status: Ready`.

### 6. Criteria for "first run was bad"

Trigger this runbook (starting at step 2) if any of the following are observed in the staging table for the new extraction_pass_id:

- More than 50% of proposals for the pass have `confidence < 0.3`.
- More than 90% of proposals have a `proposed_payload` that is NULL, empty (`'{}'`), or fails to parse as valid JSONB matching the expected schema for their `proposed_kind`.
- The run wall-clock time exceeded the 4-hour budget AND the volume of inserted rows is anomalously high (more than 3x the expected yield per PDF).

Diagnostic query:

```sql
SELECT
    extraction_pass_id,
    COUNT(*)                                                        AS total_rows,
    SUM(CASE WHEN confidence < 0.3 THEN 1 ELSE 0 END)             AS low_confidence,
    SUM(CASE WHEN proposed_payload IS NULL
              OR proposed_payload = '{}'::jsonb THEN 1 ELSE 0 END) AS empty_payload,
    MIN(created_at)                                                 AS first_insert,
    MAX(created_at)                                                 AS last_insert
FROM public.catalog_extraction_staging
WHERE extraction_pass_id = '<extraction_pass_id>'
GROUP BY extraction_pass_id;
```

### When NOT to use this runbook

If fewer than 10-15 proposals from a pass need to be dismissed and they span multiple failure modes with no single pattern, use the HITL queue UI to reject them individually -- bulk supersede at the pass level would also discard any valid proposals mixed into the same pass. This runbook is for systematic, pass-wide failures only.

---

## Decision points NOT in scope of this redesign

- **First-real-run schedule:** when the first actual schtasks fire happens. Owner-decides post-implementation.
- **Manifest CSV initial rows:** which 3 specific PDFs are the smoke-test set. Owner picks before first run.
- **DSN credential storage mechanism:** Credential Manager (recommended) vs vault vs env-scoped task user. Owner picks before first run.
- **Telegram script ownership** (risk 4 above): owner picks at first real run.
- **Zotero query lane** (per owner's "both lanes" preference): authored as a follow-up after the CSV lane proves out, not in this redesign.

---

*v0.3. Cursor-agent round 3 YELLOW with 5 cleanup nits (3 P2 + 2 P3) -- all applied as deterministic text fixes in this v0.3 tip. Round 4 confirmation pass pending before Phase 3 starts.*
