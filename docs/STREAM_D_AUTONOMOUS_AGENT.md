# Stream D -- Catalog Extraction Autonomous Agent

**Status:** Scaffold delivered 2026-05-27 by Stream D autonomous session (Opus 4.7).
**Branch:** `feat/stream-d-catalog-agent-scaffold`.
**Author:** autonomous session running against the multi-week plan at `C:\Users\jasen\.claude\plans\lively-stargazing-meadow.md` (Stream D sub-track D.2).
**Owner sign-off:** pending HITL gate (Supabase migration application + Zotero / Ollama wiring).

This document is the end-to-end architecture spec for the Catalog Extraction Agent. It accompanies the six scaffold deliverables shipped on the feature branch (see "Cross-links" below).

---

## Overview

The Catalog Extraction Agent automates the "find PDFs in Zotero, extract structured catalog rows, queue them for HITL review" loop. The agent runs offline (Windows Task Scheduler), processes Zotero PDF attachments through Docling and a local Ollama LLM, and writes proposed catalog rows to a HITL approval queue (`public.catalog_extraction_staging`). A human admin reviews the queue and approves rows individually; only approved rows ever land in production catalog tables.

**Safety posture:** the agent has zero write authority over production catalog tables. It writes only to the staging queue, under service_role, with admin-gated approval as the sole promotion path.

---

## End-to-end data flow

**This diagram describes the intended first-real-run topology.** The scaffold
shipped on `feat/stream-d-catalog-agent-scaffold` exits with code 3
(`SILENT_BAIL`) before invoking the Zotero or Ollama edges; see "Components"
below for what's wired vs. what's deferred to owner first-real-run.

```
+---------------------+     +---------------------+     +---------------------+
| Zotero local API    |     | Docling (PDF        |     | Ollama (local)      |
| http://localhost:   | --> | extraction; tables, | --> | gemma3:12b (text)   |
|   23119/api         |     | sections, captions) |     |   + 4b for fast     |
|                     |     |                     |     |   iteration         |
| Saved-search /      |     | Forks BN-RRM        |     |                     |
| collection key      |     | extract_tables_     |     | LlmClient protocol  |
|                     |     | docling.py pattern  |     | INJECTED; tests     |
|                     |     | (tuning constants   |     | mock the interface  |
|                     |     | mirrored)           |     |                     |
+---------------------+     +---------------------+     +---------------------+
                                                                  |
                                                                  v
                                              +---------------------+
                                              | Proposed catalog    |
                                              | rows (one per       |
                                              | extracted finding): |
                                              |   proposed_kind     |
                                              |   proposed_payload  |
                                              |   confidence        |
                                              |   extraction_notes  |
                                              +---------------------+
                                                                  |
                                                                  v
+---------------------------------------------------------------------------+
|   public.catalog_extraction_staging  (HITL approval queue)                |
|   ---------------------------------------------------------------         |
|   id (UUID PK)                hitl_status                                 |
|   source_zotero_key           hitl_reviewed_by                            |
|   source_attachment_path      hitl_reviewed_at                            |
|   extraction_pass_id          hitl_review_notes                           |
|   extraction_pass_started_at  promoted_to_id                              |
|   extraction_pass_finished_at created_by (NULL for agent service_role)    |
|   extracted_at                created_by_role                             |
|   proposed_kind               created_at                                  |
|   proposed_payload (JSONB)                                                |
|   confidence (0..1)                                                       |
|   extraction_notes                                                        |
|   extraction_model                                                        |
+---------------------------------------------------------------------------+
                                                                  |
                                                                  v
+---------------------+     +---------------------+     +---------------------+
| CatalogStagingReview|     | catalog_approve_    |     | Production tables   |
| HITL approval pane  | --> | staging_row(...)    | --> |   promoted_         |
| (3-column layout)   |     | RPC                 |     |     parameter_      |
|                     |     |                     |     |     values          |
| Admin sees Approve/ |     | SELECT FOR UPDATE   |     |   catalog_          |
| Reject buttons.     |     | + INSERT target     |     |     evidence_items  |
| Non-admin = read-   |     | + UPDATE staging    |     |   source_lead_      |
| only.               |     | (single tx)         |     |     triage          |
+---------------------+     +---------------------+     +---------------------+
```

---

## Components

### 1. Zotero source (input)

- **Endpoint:** `http://localhost:23119/api` (local desktop, no API key per L0 rule 1.14).
- **Linked attachment base directory:** `G:\My Drive\SABCS - Sediment Project\References`.
- **Selection:** Zotero collection key OR saved-search id passed via `--zotero-collection`.
- **First-real-run wiring:** the scaffold does NOT implement the Zotero query layer. Owner adds it at first real run, using the existing TypeScript helper at `src/lib/matrix-options/zotero/client.ts` as a reference for the API shape, or by adding a Python equivalent inside `scripts/catalog-overnight/`.

### 2. Docling extraction

- **Module:** `scripts/catalog-overnight/extract.py::extract_tables_from_pdf`.
- **Pattern source:** `C:\Projects\Regulatory-Review\2026_Database_Development\data_acquisition\bnrrm_extraction\extract_tables_docling.py`.
- **Tuning constants (mirror BN-RRM):**
  - `MAX_PAGES_FOR_OCR = 200`
  - `MAX_PAGES_FOR_ACCURATE = 500`
  - `PROACTIVE_CHUNK_THRESHOLD = 200`
  - `DEFAULT_CHUNK_SIZE = 50`
- **Output shape:** list of dicts with `table_index`, `page`, `caption`, `section_context`, `subsection_context`, `headers`, `rows`, `num_rows`, `num_cols`.

### 3. Ollama LLM

- **Models:** `gemma3:12b` (default), `gemma3:4b` (fast iteration), `gemma3:27b` (offload opt-in).
- **Endpoint:** local Ollama only (`http://localhost:11434`), per `cross_project_local_ollama_only_for_ingestion_pipelines.md`.
- **Interface:** `LlmClient` protocol in `extract.py`:
  ```python
  def extract_proposals(*, zotero_key, attachment_path, table_data, model) -> list[dict]
  ```
  Each returned dict must have `proposed_kind`, `proposed_payload`, `confidence`, `extraction_notes`.
- **Injected (not invoked):** the scaffold does NOT call Ollama end-to-end. Tests mock the protocol; real Ollama wiring lands at owner-driven first-real-run.
- **Lane coordination:** per `OLLAMA_SCHEDULE_PROTOCOL.md` v0.5, if engine-v2 + DRA-KB + this agent want to run concurrently (3 ollama-bound lanes), write `HITL_OLLAMA_THIRD_LANE_REQUEST_<ts>.md` for owner mediation.

### 4. Staging row builder

- **Module:** `scripts/catalog-overnight/extract.py::build_staging_row`.
- **Validations** (fail-fast at build time so the agent never inserts rows that violate the schema):
  - `proposed_kind` in `('parameter_value', 'evidence_item', 'source_lead')`
  - `proposed_payload` is a `dict`
  - `proposed_payload` is JSON-serializable (`json.dumps` round-trip)
  - `confidence` is `None` or `float` in `[0, 1]` (rejects `bool` because `bool < int < float`)
  - `extraction_notes` is `None` or `str`
  - `zotero_key` is non-empty
- **Output:** `StagingRow` dataclass with `to_db_tuple()` matching the 11-placeholder `_INSERT_SQL` exactly.

### 5. Staging writer (psycopg)

- **Module:** `scripts/catalog-overnight/extract.py::StagingWriter`.
- **Connection:** service-role DSN, bypasses RLS in Supabase.
- **Atomicity:** `write_batch` is transactional -- on any per-row error inside the batch, rolls back and re-raises so the caller can recover without partial commits or an aborted connection.
- **created_by handling:** left NULL (service_role does not correspond to an `auth.users` session). The `created_by_role` column DEFAULTs to `'agent_service_role'`, which the CHECK constraint allows alongside NULL `created_by`.

### 6. PowerShell harness (breadcrumbs + watchdog)

- **Module:** `scripts/catalog-overnight/run.ps1`.
- **Breadcrumb spec (per L0 standing rule 1.13):**
  - One JSON file per heartbeat at `<repo-root>/.tmp/catalog-overnight-breadcrumbs/<pass-id>-<iso-ts>-{ps,py}.json`.
  - Suffix `-ps.json` = harness side (`run.ps1`), every `HeartbeatSeconds` (default 60s).
  - Suffix `-py.json` = Python side (`extract.py`), on phase transitions.
  - Status enum: `STARTED | IN_PROGRESS | COMPLETED_GREEN | COMPLETED_RED | STALLED | SILENT_BAIL`.
- **Stall watchdog:** if no NEW `-py.json` breadcrumb is written for `StallSeconds` (default 600s = 10 minutes), the harness terminates the Python process tree via `taskkill /T /F` and emits a final `STALLED` breadcrumb. The watchdog explicitly filters out `-ps.json` so the harness's own heartbeats don't mask a Python stall.
- **Exit code propagation:**
  - extract.py exit 0 -> harness writes `COMPLETED_GREEN`.
  - extract.py exit 3 (scaffold-deferred mode) -> harness writes `COMPLETED_RED` (truthful signal).
  - extract.py exit other nonzero -> harness writes `COMPLETED_RED`.
  - Harness watchdog timeout -> `STALLED`.
  - Harness lost the child without an exit code -> `SILENT_BAIL`.

### 7. HITL approval surface

- **Component:** `src/components/matrix-options/CatalogStagingReview.tsx`.
- **Layout:** 3-column matching Evidence Library Phase 0.5 (commit `0225a53`):
  - Left panel (w-80): filter controls (extraction_pass_id input, Apply / Clear / Refresh, pending count, read-only notice for non-admin).
  - Center panel: pending row list sorted by confidence DESC (server-side sort).
  - Right panel (w-96): detail inspector (full payload, extraction notes, model) + admin-only Approve / Reject form.
- **Server actions:** `src/lib/catalog/staging.ts`:
  - `listPendingStagingRows({ extractionPassId?, limit?, offset? })` -- safe-fallback read (returns `[]` on error).
  - `approveStagingRow({ stagingId, hitlNotes? })` -- throws on auth / validation failure; delegates to the `catalog_approve_staging_row` RPC for transactional approve.
  - `rejectStagingRow({ stagingId, hitlNotes? })` -- throws on auth / validation failure.
  - `markSupersededStagingRows({ extractionPassId })` -- bulk supersede (typically called by a later agent pass).

### 8. Production targets

| `proposed_kind` | Target table | Promotion mapping | Live in Supabase? (per 2026-05-28 SQL output) |
|---|---|---|---|
| `parameter_value` | `public.promoted_parameter_values` | LLM payload fields map column-by-column to the target table's schema. Columns with DEFAULTs (id, created_at, updated_at) are OMITTED from the INSERT so the defaults fire. | YES (migration `20260527000003_promoted_parameter_values.sql` applied) |
| `evidence_item` | `public.catalog_evidence_items` | Same column-list strategy. | **PENDING VERIFICATION** -- 2026-05-28 Q1 returned only 2 of 5 table names, suggesting this table may be missing; could also be an `information_schema` privilege artifact or a PostgREST schema-cache miss. See `STREAM_D_HITL_PAUSE_SQL_EXPLORE_2026_05_27.md` Q1 for the stricter verification query. |
| `source_lead` | `public.source_lead_triage` | Same. | **PENDING VERIFICATION** -- same disposition as `catalog_evidence_items`. |

The mapping is authoritative in the `catalog_approve_staging_row` RPC's `CASE v_staging_row.proposed_kind` branch. The TypeScript layer no longer carries a duplicate mapping (codex review Sub-task 5 R2 cleanup).

**Operational consequence (conditional):** if the verification query confirms the tables exist, all 3 `proposed_kind` values work end-to-end. If the verification confirms they are missing, approving a staging row with `proposed_kind = 'parameter_value'` works but `'evidence_item'` and `'source_lead'` raise a Postgres error (SQLSTATE 42P01) at INSERT time; the CatalogStagingReview UI surfaces the error in its red action-error banner and the staging row remains in `pending` state (FOR UPDATE lock is released on transaction rollback).

---

## Safety invariants (NON-NEGOTIABLE)

These mirror the multi-week plan's Stream D invariants and the autonomous-session prompt's hard constraints. Violations are P0 stop conditions.

1. **Agent never writes to production catalog tables.** Only `catalog_extraction_staging`. No exceptions.
2. **Agent never promotes any staging row.** Promotion is an explicit HITL action via `approveStagingRow()` / the RPC.
3. **Agent never approves QA.** It does not touch the `parameter_value_reviews` QA workflow.
4. **Agent never mutates `src/data/`.** The curated HITL JSON catalogs are Tier 2 protected (read-only).
5. **All Ollama traffic loopback-only** (`http://localhost:11434`). No paid LLM APIs; no remote endpoints.
6. **Service-role DSN is never logged or breadcrumbed.** The harness redacts it from console output and from breadcrumb JSON.

---

## Scheduling cadence (OPEN QUESTION)

The multi-week plan and the scaffold both defer cadence to owner decision. Options:

| Cadence | Pro | Con |
|---|---|---|
| Nightly (02:30 local) | Fresh proposals every morning; consistent rhythm | Burns Ollama lane every night even when Zotero hasn't changed |
| Weekly (Sunday 02:30) | Lighter Ollama footprint; matches typical Zotero growth pattern | Backlog can grow if Zotero adds many sources mid-week |
| On-demand (manual schtasks fire) | No background burn; owner pulls when ready | Requires manual trigger; less automation value |

The harness supports all three -- the choice lives in the `schtasks /SC` flag at scheduling time, not in the harness itself.

**Recommended for first month:** on-demand. Lets the owner control the Ollama lane and validate the agent's output quality before automating.

---

## Stall watchdog spec

The L0 standing rule 1.13 (external CLI subagent monitoring -- breadcrumb discipline) requires every long-running CLI invocation to emit structured progress and have a stall detector. The Stream D harness implements this:

1. **Heartbeat cadence:** `extract.py` emits `-py.json` breadcrumbs on phase boundaries (started, per-PDF, completed). `run.ps1` emits `-ps.json` every `HeartbeatSeconds` (default 60s).
2. **Stall threshold:** `StallSeconds` (default 600s) since the last NEW `-py.json` breadcrumb.
3. **Action on stall:** harness writes a final `STALLED` breadcrumb naming the stall duration, then issues `taskkill /PID <child-pid> /T /F` to terminate the Python process tree.
4. **Detection vector for the owner:** the latest breadcrumb file in `.tmp/catalog-overnight-breadcrumbs/` carries `"status": "STALLED"` and a note describing the stall window. Monitoring scripts can grep for this.

---

## Rollback story

**At the row level:** `rejectStagingRow` sets `hitl_status = 'rejected'`; no production write happens. `markSupersededStagingRows` bulk-marks pending rows in a given `extraction_pass_id` as `superseded` (typically when a later agent pass replaces an earlier proposal). Both are admin-only and audit-logged.

**At the production-row level:** if an approved staging row turns out to be wrong, the admin deletes the resulting row from the target production table directly (those tables have their own admin RLS). The staging row's `hitl_status = 'approved'` and `promoted_to_id` linkage remain as audit history; the staging table is append-only for auditability.

**At the migration level:** the two staging migrations (`20260527000004_catalog_extraction_staging.sql` and `20260527000005_catalog_approve_staging_rpc.sql`) are forward-only. If they need to be rolled back the owner authors a follow-up migration that DROPs the function and the table. The autonomous session does NOT author rollback migrations -- that's a HITL judgment call about what state to roll back to.

---

## HITL pause artifacts (this branch)

| File | Purpose | Blocking? |
|---|---|---|
| `STREAM_D_HITL_PAUSE_SQL_EXPLORE_2026_05_27.md` | Owner runs 10 read-only SQL queries (Q1..Q10) in Supabase Studio to surface the live shape of the 5 existing catalog tables, then pastes results back. Sub-task 3 + 5 used conservative defaults in the meantime; the OUTPUT may reveal divergences to amend. | No (non-blocking; agent proceeded with defaults documented in migration headers) |

When the owner applies migrations 20260527000004 + 20260527000005 via Supabase Studio SQL Editor, that resolves the implicit "migration apply" HITL gate (no separate pause artifact was authored because the apply order is documented in the SQL-explore pause and in the migration headers themselves).

---

## Cross-links

| Stream D deliverable | File |
|---|---|
| Sub-task 1: branch | `feat/stream-d-catalog-agent-scaffold` (base `9465013`) |
| Sub-task 2: SQL exploration | `STREAM_D_HITL_PAUSE_SQL_EXPLORE_2026_05_27.md` |
| Sub-task 3: staging table migration | `supabase/migrations/20260527000004_catalog_extraction_staging.sql` |
| Sub-task 4: harness scaffold | `scripts/catalog-overnight/` (extract.py, run.ps1, requirements.txt, README.md, tests/test_extract.py) |
| Sub-task 5: server helpers + RPC | `src/lib/catalog/staging.ts`, `supabase/migrations/20260527000005_catalog_approve_staging_rpc.sql`, `src/lib/catalog/__tests__/staging.test.ts` |
| Sub-task 6: HITL approval pane | `src/components/matrix-options/CatalogStagingReview.tsx`, `src/components/matrix-options/__tests__/CatalogStagingReview.test.tsx` |
| Sub-task 7: this design doc | `docs/STREAM_D_AUTONOMOUS_AGENT.md` |
| Session progress | `STREAM_D_PROGRESS_2026_05_27.md` |
| Approved multi-week plan | `C:\Users\jasen\.claude\plans\lively-stargazing-meadow.md` (Stream D sub-track D.2) |
| Autonomous session prompt | `STREAM_D_AUTONOMOUS_12H_PROMPT_2026_05_27.md` |

---

## Open questions for owner (final batch)

1. **Cadence:** nightly / weekly / on-demand? (Recommended: on-demand for first month.)
2. **Zotero collection or saved-search to drive the agent:** which one becomes the canonical input?
3. **DSN storage mechanism:** Credential Manager / DPAPI vault file / env var? (Wrapper pattern documented in `scripts/catalog-overnight/README.md`.)
4. **Ollama lane allocation:** when does this agent run relative to engine-v2 and DRA-KB? (Triggers `HITL_OLLAMA_THIRD_LANE_REQUEST` if concurrent.)
5. **First-real-run validation set:** which 3 PDFs from the chosen Zotero collection should be the smoke-test input before scaling to the full collection?

Owner returns to find these surfaced in `STREAM_D_PROGRESS_2026_05_27.md`. The autonomous session does not answer them; they are HITL judgment calls about scope and operational policy.

---

*Authored 2026-05-28 by Stream D autonomous session (Opus 4.7). Sub-task 7 deliverable. Holistic codex review pending.*
