# Catalog Extraction Agent (Overnight)

**Purpose:** Extract structured catalog proposals from PDF attachments into
`public.catalog_extraction_staging` (the HITL approval queue). The agent
NEVER writes to production catalog tables; every proposed row is gated
behind an admin / matrix_admin review before promotion.

**Current topology:** Claude-Code-as-worker via `claude -p` headless mode,
invoked by Windows Task Scheduler at 23:30 PT daily. Files in this
directory are the Python LIBRARY (not a CLI) that the Claude Code session
imports at runtime via `python -c` invocations.

**Design:** see `STREAM_D_REDESIGN_2026_05_28.md` v0.3.1 (cursor-agent
reviews GREEN at round 5).
**Architecture spec:** see `docs/STREAM_D_AUTONOMOUS_AGENT.md` v2.0.
**Wrapper:** see `.claude/scripts/launch_catalog_extraction.ps1`.

---

## Files

| File | Purpose |
|---|---|
| `extract.py` | Python LIBRARY (no main, no CLI). Exports: `extract_tables_from_pdf()`, `build_staging_row()`, `StagingRow`, `StagingWriter`, `write_breadcrumb()`. Imported by the autonomous Claude Code session at runtime. |
| `requirements.txt` | Python dependencies: docling, pymupdf, psycopg, pillow, pytest. No ollama (dropped in Phase 3 commit 2). |
| `tests/test_extract.py` | Pytest unit tests (24 tests). Public-surface smoke tests + build_staging_row validation + StagingWriter DSN handling + write_breadcrumb filename invariants + tuning constants. |
| `tests/__init__.py` | Test package marker. |
| `catalog_manifest.csv` | Hand-curated list of PDFs to process. Owner adds 1-3 smoke-test rows pre-first-real-run. Schema: `doc_id,zotero_key_or_url,filepath,priority_tier,target_kind,notes`. |
| `catalog_extraction_progress.json` | Queue state: completed / errors / needs_retry / in_progress. Atomic writes from the autonomous session. |
| `CATALOG_EXTRACTION_STARTER_PROMPT.md` | The prompt template the wrapper inlines into `claude -p`. Hard constraints + 4-step session flow + commit-failure branching. |
| `archive/` | (gitkeep) -- handoff archive rotation target. |

---

## One-time setup (owner)

Per `cross_project_use_venv_python_not_system_python.md`, the Python
library must run under a project-local venv. From PowerShell at the repo
root:

```powershell
cd C:\Projects\SSTAC-Dashboard\scripts\catalog-overnight
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Verify the test suite passes:

```powershell
pytest tests -v --maxfail=1
```

All 24 tests must pass before the first real run.

The `.venv/` directory is gitignored at the repo level.

---

## Smoke test (current topology)

The autonomous overnight workflow is launched via Windows Task Scheduler.
For a smoke test of the wrapper without a real Supabase write:

```powershell
.\.claude\scripts\launch_catalog_extraction.ps1 -DryRun -MaxItems 1
```

Pre-flight requirements:
- `catalog_manifest.csv` populated with at least 1 row.
- `CATALOG_EXTRACTION_HANDOFF.md` exists at the repo root.
- `claude` CLI on PATH at `$env:USERPROFILE\.local\bin\claude.exe`.

Dry-run mode skips:
- The Credential Manager DSN lookup.
- The Supabase psycopg writes (the session still processes the Docling
  step and drafts proposals; insert is just stubbed).

---

## Production run

After smoke test passes, register the daily scheduled task (one-shot):

```powershell
.\.claude\scripts\register_catalog_extraction_task.ps1
```

The task fires daily at 23:30 PT and runs the wrapper non-interactively.
Per design lock #3, the machine must stay awake overnight for the task
to fire (no BIOS wake-on-timer configuration assumed).

To trigger manually (first real run):

```powershell
schtasks /Run /TN "SSTAC-StreamD-CatalogExtract"
```

To disable / re-enable:

```powershell
schtasks /Change /TN "SSTAC-StreamD-CatalogExtract" /DISABLE
schtasks /Change /TN "SSTAC-StreamD-CatalogExtract" /ENABLE
```

See `STREAM_D_REDESIGN_2026_05_28.md` "Rollback runbook" section for
recovery procedures if a pass produces systematically bad proposals.

---

## Credential storage

The Supabase service-role DSN is read by the wrapper from Windows Credential
Manager via the `CredentialManager` PSGallery module:

```powershell
Install-Module CredentialManager -Scope CurrentUser
# Then in interactive PowerShell:
New-StoredCredential `
    -Target 'SSTAC_CATALOG_DSN' `
    -UserName 'service_role' `
    -Password (Read-Host -AsSecureString) `
    -Persist LocalMachine | Out-Null
```

Then paste the Supabase service-role connection string when prompted.

The wrapper reads via `Get-StoredCredential -Target 'SSTAC_CATALOG_DSN'`,
extracts `.GetNetworkCredential().Password`, sets it as `CATALOG_DSN` in
the spawned claude session's environment, and wipes it on exit.

**Never** commit the DSN to git. **Never** put it in `/TR` of a scheduled
task action (the task action is readable by any local administrator).

---

## Breadcrumb format

Per L0 standing rule 1.13:

Files land at `<repo-root>/.tmp/catalog-overnight-breadcrumbs/$PassId-$YYYYMMDDTHHMMSSZ-{ps,py}.json`
with Windows-safe basic ISO timestamps (no colons).

The wrapper emits `-ps.json` crumbs every 60s; the session emits `-py.json`
crumbs every ~120s during long PDF processing + on item completion. The
watchdog filters to pass-scoped `-py.json` (the wrapper's own `-ps.json`
emissions don't reset the stall timer; only Python-side activity does).

Status enum: `STARTED | IN_PROGRESS | COMPLETED_GREEN | COMPLETED_RED | STALLED | SILENT_BAIL`.

---

## Safety invariants (NON-NEGOTIABLE)

Per `docs/STREAM_D_AUTONOMOUS_AGENT.md` v2.0:

1. Agent never writes to production catalog tables. Only
   `catalog_extraction_staging`.
2. Agent never promotes any staging row. Promotion is an explicit HITL
   action via the UI.
3. Agent never approves QA. It does not touch the QA workflow.
4. Agent never mutates `src/data/*`.
5. All LLM calls go through the owner's local Claude Code session under
   their auth subscription. No service-role API keys for paid LLM
   providers in the agent environment.
6. Service-role DSN is never logged or breadcrumbed.

Violations are P0 stop conditions.

---

## Open questions (owner-decides)

| # | Question | Decision needed before |
|---|---|---|
| 1 | First-real-run trigger timing | After smoke test passes |
| 2 | Manifest CSV initial rows (which 1-3 PDFs) | Pre-first-real-run |
| 3 | Telegram script ownership (fork vs cross-project) | Optional follow-up |
| 4 | Zotero programmatic query lane | Follow-up after CSV proves out |
