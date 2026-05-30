# Catalog Extraction Agent (Overnight)

**Purpose:** Extract structured catalog proposals from PDF attachments and write
them to a LOCAL JSON file (`proposals/<PassId>.json`) plus a paste-ready SQL
packet (`proposals/<PassId>.sql`). The owner imports approved rows to
`public.catalog_extraction_staging` via the Supabase Studio SQL Editor and
approves them through the `catalog_approve_staging_row` RPC. The agent has NO
database connection (no DSN, no psycopg, no Supabase). Every proposed row is
gated behind an admin / matrix_admin HITL review before promotion to a
production table; the agent NEVER promotes or approves.

**Current topology:** Claude-Code-as-worker via `claude -p` headless mode,
invoked by Windows Task Scheduler. Files in this directory are the Python
LIBRARY (not a CLI) that the Claude Code session imports at runtime via
`python -c` / script invocations using the local venv interpreter.

**Design:** `STREAM_D_REDESIGN_2026_05_28.md` v0.3.1 (cursor-agent GREEN round 5).
**Architecture spec:** `docs/STREAM_D_AUTONOMOUS_AGENT.md` v2.0.
**Wrapper:** `.claude/scripts/launch_catalog_extraction.ps1`.
**Headless enablement (owner decision):** `docs/CATALOG_HEADLESS_ENABLEMENT.md`.

---

## Files

| File | Purpose |
|---|---|
| `extract.py` | Python LIBRARY (no main, no CLI). Exports: `extract_tables_from_pdf()`, `build_staging_row()`, `StagingRow`, `save_proposals()`, `generate_staging_sql()`, `write_breadcrumb()`, plus `PAYLOAD_REQUIRED_KEYS` / `PROVENANCE_REQUIRED_KEYS`. Imported by the autonomous Claude Code session at runtime. No database code. |
| `requirements.txt` | Python dependencies: docling, pymupdf, pillow, pytest. No psycopg, no ollama. |
| `tests/test_extract.py` | Pytest unit tests (46 tests): public-surface smoke tests, build_staging_row validation (provenance + per-kind required keys, confidence, JSON-serializable payload), save_proposals (append / atomic / corrupt-quarantine / unique-temp), generate_staging_sql (staging-only, injection-safe, casts), write_breadcrumb filename invariants, tuning constants. |
| `tests/__init__.py` | Test package marker. |
| `catalog_manifest.csv` | Hand-curated list of PDFs to process. Owner adds rows. Schema: `doc_id,zotero_key_or_url,filepath,priority_tier,target_kind,notes`. |
| `catalog_extraction_progress.json` | Queue state: completed / errors / needs_retry / in_progress. Atomic writes from the autonomous session. |
| `CATALOG_EXTRACTION_STARTER_PROMPT.md` | The prompt template the wrapper inlines into `claude -p`. Hard constraints + session flow + commit-failure branching + DryRun branch. |
| `proposals/` | Per-pass output: `<PassId>.json` (StagingRow proposals) + `<PassId>.sql` (paste-ready staging INSERTs) + per-pass REVIEW_NOTE. Committed (the run's durable output). |
| `archive/` | (gitkeep) -- handoff archive rotation target. |

---

## One-time setup (owner)

Per `cross_project_use_venv_python_not_system_python.md`, the Python library runs
under a project-local venv. From PowerShell at the repo root:

```powershell
cd C:\Projects\SSTAC-Dashboard\scripts\catalog-overnight
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Verify the test suite passes (all 46 tests must pass before the first real run):

```powershell
pytest tests -v --maxfail=1
```

The `.venv/` directory is gitignored at the repo level. A fresh git worktree
starts WITHOUT a venv -- the wrapper's pre-flight fails fast with a clear
breadcrumb if the venv or docling is missing.

---

## Output + import flow (no database connection)

1. A pass writes `proposals/<PassId>.json` (the proposals) and
   `proposals/<PassId>.sql` (INSERTs into `catalog_extraction_staging`, all
   `hitl_status='pending'`, inside BEGIN/COMMIT).
2. The owner pastes `<PassId>.sql` into the Supabase Studio SQL Editor and runs
   it. It touches ONLY the staging table -- never a production table.
3. The owner reviews the pending rows in the CatalogStagingReview admin UI and
   approves selected rows; approval calls `catalog_approve_staging_row(id,
   notes)`, which promotes the payload into the target table
   (`promoted_parameter_values` / `catalog_evidence_items` /
   `source_lead_triage`) under HITL authority.

You can regenerate the SQL from a proposals JSON at any time via
`extract.generate_staging_sql(json_path, sql_path)`.

---

## Smoke test + production run

The autonomous overnight workflow is launched via Windows Task Scheduler. Before
any autonomous run, the wrapper must be ARMED (owner decision -- see
`docs/CATALOG_HEADLESS_ENABLEMENT.md`); as shipped it intentionally does NOT
bypass permissions or the SessionStart hook, so an unarmed `claude -p` worker
will narrate-not-act and the wrapper records SILENT_BAIL.

After arming, smoke-test the wrapper (writes NOTHING, makes no commit):

```powershell
.\.claude\scripts\launch_catalog_extraction.ps1 -DryRun -MaxItems 1
```

`-DryRun` runs Docling extraction + drafts and validates proposals, but the
worker does NOT call `save_proposals` / `generate_staging_sql` and does NOT
commit. Pre-flight requirements: `catalog_manifest.csv` has at least 1 row;
`CATALOG_EXTRACTION_HANDOFF.md` exists; the `claude` CLI and the catalog-overnight
venv (with docling) are present.

Register + trigger the scheduled task:

```powershell
.\.claude\scripts\register_catalog_extraction_task.ps1     # one-shot registration
schtasks /Run /TN "SSTAC-StreamD-CatalogExtract"           # manual trigger (first real run)
schtasks /Change /TN "SSTAC-StreamD-CatalogExtract" /DISABLE
schtasks /Change /TN "SSTAC-StreamD-CatalogExtract" /ENABLE
```

Per design lock #3 the machine must stay awake overnight for the task to fire.
See `STREAM_D_REDESIGN_2026_05_28.md` "Rollback runbook" for recovery if a pass
produces systematically bad proposals.

---

## Breadcrumb format

Per L0 standing rule 1.13. Files land at
`<repo-root>/.tmp/catalog-overnight-breadcrumbs/$PassId-$YYYYMMDDTHHMMSSZ-{ps,py}.json`
with Windows-safe basic ISO timestamps (no colons). The wrapper emits `-ps.json`
crumbs every 60s; the session emits `-py.json` crumbs every ~120s during long
PDF processing + on item completion. The watchdog filters to pass-scoped
`-py.json`. The wrapper emits EXACTLY ONE terminal status per run.

Status enum: `STARTED | IN_PROGRESS | COMPLETED_GREEN | COMPLETED_RED | STALLED | SILENT_BAIL`.

---

## Safety invariants (NON-NEGOTIABLE)

Per `docs/STREAM_D_AUTONOMOUS_AGENT.md` v2.0:

1. Agent never writes to production catalog tables. It writes only a local JSON
   proposals file + SQL targeting `catalog_extraction_staging`.
2. Agent never promotes any staging row. Promotion is an explicit HITL action
   via the UI / the `catalog_approve_staging_row` RPC.
3. Agent never approves QA. It does not touch the QA workflow.
4. Agent never mutates `src/data/*`.
5. No database connection of any kind: no DSN, no psycopg, no Supabase, no
   service-role keys in the agent environment. All LLM work runs through the
   owner's local Claude Code session under their auth subscription.

Violations are P0 stop conditions.
