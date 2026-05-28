# Catalog Extraction Agent (Overnight)

**Purpose:** Extract structured catalog proposals from Zotero PDF attachments
into `public.catalog_extraction_staging` (the HITL approval queue). The agent
NEVER writes to production catalog tables; every proposed row is gated behind
an admin / matrix_admin review before promotion.

**Scope of this scaffold:** harness + breadcrumb spec + staging-row builder
+ unit tests. The Zotero query layer and Ollama client wiring are deferred
to owner-driven first-real-run time.

**Authored:** 2026-05-27 by Stream D autonomous session (Opus 4.7).
**Branch:** `feat/stream-d-catalog-agent-scaffold` (base `9465013`).
**Plan:** `C:\Users\jasen\.claude\plans\lively-stargazing-meadow.md` (Stream D sub-track D.2).
**Design:** `docs/STREAM_D_AUTONOMOUS_AGENT.md` (Sub-task 7 deliverable).
**Pattern source:** `C:\Projects\Regulatory-Review\2026_Database_Development\data_acquisition\bnrrm_extraction\extract_tables_docling.py`.

---

## Files

| File | Purpose |
|---|---|
| `extract.py` | Python entry point. Docling -> Ollama -> psycopg pipeline. LlmClient protocol is injected; tests mock it. |
| `run.ps1` | PowerShell harness. Launches `extract.py` via the venv interpreter, emits breadcrumb JSON every 60s, includes a 10-minute stall watchdog. |
| `requirements.txt` | Python dependencies. Autonomous session does NOT pip install. |
| `tests/test_extract.py` | Pytest unit tests. Mock LlmClient + table extractor + writer; no Docling / psycopg / Ollama required at test time. |
| `tests/__init__.py` | Test package marker. |

---

## One-time setup (owner)

Per `cross_project_use_venv_python_not_system_python.md`, the agent must run
under a project-local venv. From PowerShell at the repo root:

```powershell
cd C:\Projects\SSTAC-Dashboard\scripts\catalog-overnight
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Then verify the test suite passes:

```powershell
pytest tests -v --maxfail=1
```

All tests must pass before the first real run. The autonomous session did NOT
execute these tests (no venv at scaffold time); the owner is the first to run
them.

The `.venv/` directory is gitignored at the repo level (`.gitignore` line 49,
`.venv`). Do not commit it.

---

## Smoke test (dry-run)

After the venv is set up, run the harness in dry-run mode against an
arbitrary Zotero collection key. Dry-run skips the Supabase write.

```powershell
.\run.ps1 -ZoteroCollection <your_collection_key> -Model gemma3:12b -DryRun
```

This launches `extract.py --dry-run --zotero-collection <key>` and emits
breadcrumbs to `<repo-root>\.tmp\catalog-overnight-breadcrumbs\<pass-id>-*-*.json`
(suffix `-py.json` from extract.py; `-ps.json` from run.ps1). The scaffold
exits with code 3 (`SILENT_BAIL`) noting that Zotero querying and Ollama
wiring are deferred to first-real-run; the harness writes `COMPLETED_RED`
to reflect that no real work happened.

---

## Production run (after first-real-run wiring is complete)

```powershell
.\run.ps1 `
  -ZoteroCollection <key> `
  -Model gemma3:12b `
  -Dsn 'postgresql://<service-role-user>:<password>@<host>:6543/postgres?sslmode=require'
```

**Service-role DSN handling:**

- The `-Dsn` argument is the ONLY DSN entry point that the harness and
  `extract.py` honor. Both reject missing `-Dsn` outside `-DryRun`. There is
  no environment-variable fallback inside the agent.
- Owner-written wrappers (e.g., `run-scheduled.ps1`) may read the DSN from
  Windows Credential Manager / a vault file / an environment variable, and
  then pass the value to `run.ps1 -Dsn ...`. The wrapper pattern is shown
  in the "Scheduling" section below; the scaffold does not ship one.
- The DSN is never logged or breadcrumbed. The harness redacts it from
  console output and from breadcrumb files.
- Service-role bypasses RLS in Supabase, so the agent can insert into
  `catalog_extraction_staging` even though authenticated users without
  admin role cannot.

---

## Scheduling (Windows Task Scheduler)

Per `cross_project_harness_background_processes_die_on_exit.md`, do NOT
spawn this harness via `Bash run_in_background: true`. Use Task Scheduler
(`schtasks`) so the process is genuinely detached and survives Claude Code
session exits.

**Credential storage:** the service-role DSN is sensitive. Do NOT embed it in
the Task Scheduler `/TR` action; that field is readable by any local
administrator. Instead, store the DSN in Windows Credential Manager
(`cmdkey /add:...`) or a vault file outside the repo, and have a tiny
wrapper `.ps1` read it just before invoking `run.ps1`. The wrapper pattern
(owner picks the credential mechanism; the wrapper is owner-written, NOT
shipped by the scaffold):

```powershell
# C:\Projects\SSTAC-Dashboard\scripts\catalog-overnight\run-scheduled.ps1
# Owner-authored wrapper. Reads the service-role DSN at run time and
# delegates to run.ps1. Never commit a real DSN to this file or any other
# file in the repo.
#
# Pick ONE of the following credential mechanisms (each shown in shape;
# owner adapts to their environment):
#
#   (a) Windows Credential Manager via the 'CredentialManager' PSGallery
#       module (Install-Module CredentialManager -Scope CurrentUser):
#         $Cred = Get-StoredCredential -Target 'SSTAC_CatalogOvernight_DSN'
#         $Dsn  = $Cred.GetNetworkCredential().Password
#
#   (b) DPAPI-encrypted vault file the current user owns:
#         $Dsn = ConvertTo-SecureString -String (
#             Get-Content "$env:LOCALAPPDATA\sstac\dsn.txt"
#         ) | ConvertFrom-SecureString -AsPlainText  # PS 7+
#
#   (c) Environment variable scoped to the scheduled task user:
#         $Dsn = [System.Environment]::GetEnvironmentVariable(
#             'SSTAC_CATALOG_OVERNIGHT_DSN', 'User'
#         )
#
# After acquiring $Dsn:
& "$PSScriptRoot\run.ps1" `
    -ZoteroCollection '<key>' `
    -Model 'gemma3:12b' `
    -Dsn $Dsn
```

Example schtasks invocation (points at the wrapper, NOT at run.ps1 directly,
so the DSN is never in the task action):

```powershell
$Wrapper = 'C:\Projects\SSTAC-Dashboard\scripts\catalog-overnight\run-scheduled.ps1'

schtasks /Create `
    /TN 'SSTAC_CatalogOvernight_Daily' `
    /TR ('powershell.exe -NoProfile -ExecutionPolicy Bypass -File "{0}"' -f $Wrapper) `
    /SC DAILY /ST 02:30 /F
```

The `run-scheduled.ps1` wrapper itself is owner-authored (specifically because
Credential Manager / vault choice is an owner decision, not an autonomous-session
decision); the scaffold does not ship it.

**Cadence:** the daily cadence above is a placeholder; the autonomous-agent
cadence (nightly / weekly / on-demand) is an open question per the multi-week
plan. Owner answers this before the first real production run.

**Ollama coordination:** if multiple ollama-bound jobs run concurrently
(engine-v2 + DRA-KB + this agent = 3 lanes), the third lane must follow
`C:\Projects\OLLAMA_SCHEDULE_PROTOCOL.md`. The HITL_OLLAMA_THIRD_LANE_REQUEST
artifact is required before scheduling this agent in parallel.

---

## Breadcrumb format

Per L0 standing rule 1.13 (external CLI subagent monitoring -- breadcrumb
discipline), every >5-min CLI invocation emits structured breadcrumb JSON.

Files land at `<repo-root>\.tmp\catalog-overnight-breadcrumbs\<pass-id>-<iso-ts>.json`
with colons stripped from the timestamp (Windows filename safety).

Schema:

```json
{
  "pass_id": "uuid",
  "status": "STARTED | IN_PROGRESS | COMPLETED_GREEN | COMPLETED_RED | STALLED | SILENT_BAIL",
  "last_progress_at": "ISO 8601 UTC",
  "started_at": "ISO 8601 UTC",
  "current_zotero_key": "string",
  "output_artifacts": ["paths"],
  "note": "freeform",
  "host": "COMPUTERNAME",
  "model": "ollama model name",
  "dry_run": true
}
```

Both `run.ps1` (harness side, every 60s) and `extract.py` (Python side, on
phase transitions) emit breadcrumbs to the same directory. The most recent
file wins for "still alive?" checks.

**Stall watchdog:** `run.ps1` terminates the python tree if no breadcrumb has
been written for `-StallSeconds` (default 600 = 10 minutes) and emits a final
`STALLED` breadcrumb. This catches the silent-bail / hung-Docling failure
mode without requiring HITL monitoring.

---

## HITL approval gate

Every row the agent writes to `catalog_extraction_staging` starts in status
`pending`. Approval / rejection happens exclusively in the
`CatalogStagingReview` UI (Stream D Sub-task 6) by admin / matrix_admin users.
The agent has zero ability to set `hitl_status = 'approved'`.

| Status | Set by | Meaning |
|---|---|---|
| `pending` | DB default on insert | Awaiting HITL review |
| `approved` | admin via `approveStagingRow()` | Promoted to production table |
| `rejected` | admin via `rejectStagingRow()` | Declined; not promoted |
| `superseded` | `markSupersededStagingRows()` | A later extraction pass replaced this proposal |

The `CHECK` constraint on the staging table enforces that `approved` and
`rejected` rows have reviewer fields populated; `pending` and `superseded`
allow them to be null.

---

## Safety invariants (non-negotiable)

These mirror the multi-week plan's Stream D safety invariants and the
autonomous-session prompt's hard constraints:

1. **Agent never writes to production catalog tables** -- only the staging
   table is touched. No exceptions.
2. **Agent never promotes any staging row** -- promotion is an explicit HITL
   action via `src/lib/catalog/staging.ts::approveStagingRow()`.
3. **Agent never approves QA** -- it does not touch the parameter_value_reviews
   QA workflow.
4. **Agent never mutates `src/data/`** -- the curated HITL JSON catalogs are
   Tier 2 protected (read-only).
5. **All Ollama traffic loopback-only** (`http://localhost:11434`) -- no paid
   LLM APIs; no remote endpoints.
6. **Service-role DSN is never logged or breadcrumbed.**

Violations are P0 stop conditions.

---

## Field cheatsheet (Sub-task 5 reference)

The `src/lib/catalog/staging.ts` helpers (Sub-task 5) read/write the same
table this agent populates. They expose:

- `listPendingStagingRows({ extractionPassId?, limit?, offset? })` -- query path.
- `approveStagingRow({ stagingId, hitlNotes? })` -- HITL approve + promote.
- `rejectStagingRow({ stagingId, hitlNotes? })` -- HITL reject.
- `markSupersededStagingRows({ extractionPassId })` -- bulk supersede.

All four enforce admin / matrix_admin via the existing user_roles pattern
mirrored from `src/lib/matrix-options/provenance/qa-review-sync.ts`.

---

## Open questions surfaced to owner

| # | Question | Decision needed before |
|---|---|---|
| 1 | Agent cadence (nightly / weekly / on-demand)? | First real production run |
| 2 | Which Zotero collection or saved-search drives the agent? | First real production run |
| 3 | Ollama lane allocation: when does this agent run relative to engine-v2 and DRA-KB? | Concurrent operation triggers HITL_OLLAMA_THIRD_LANE_REQUEST |
| 4 | Service-role DSN storage: Windows Credential Manager, vault file, or env var? | First scheduled run |

These are documented in the Sub-task 7 design doc and in
`STREAM_D_PROGRESS_2026_05_27.md`.
