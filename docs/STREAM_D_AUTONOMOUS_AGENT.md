# Stream D -- Catalog Extraction Autonomous Agent

**Status:** Phase 3 implementation in progress 2026-05-28. Architectural pivot from the prior Docling+Ollama+Python-supervisor scaffold to Claude-Code-as-worker. See `STREAM_D_REDESIGN_2026_05_28.md` v0.3.1 (cursor-agent reviews GREEN at round 5, mutual-agreement methodology) for the full design rationale and review history.
**Branch:** `feat/stream-d-catalog-agent-scaffold`.
**Author:** autonomous session running against the multi-week plan at `C:\Users\jasen\.claude\plans\lively-stargazing-meadow.md` (Stream D sub-track D.2).
**Owner sign-off pending:** Supabase migrations have been applied (verified 2026-05-28 SQL smoke test); Phase 3 implementation lands the scheduling layer (the agent is dormant until owner registers the schtasks task and populates the manifest).

This document is the end-to-end architecture spec for the Catalog Extraction Agent under the v0.3.1 redesign.

---

## Overview

The Catalog Extraction Agent automates the "find PDFs, extract structured catalog rows, queue them for HITL review" loop. The agent runs offline overnight via Windows Task Scheduler. The autonomous worker IS a `claude -p` headless Claude Code session, not a Python+PowerShell supervisor stack. Claude Code reads Docling-extracted PDF tables, reasons over them to draft proposed catalog rows, and `psycopg` INSERTs them into the staging table `public.catalog_extraction_staging`. A human admin reviews the queue at `/admin/catalog-staging-review` and approves rows individually; only approved rows ever land in production catalog tables.

**Safety posture:** the agent has zero write authority over production catalog tables. It writes only to the staging queue, under service-role, with admin-gated approval as the sole promotion path.

---

## End-to-end data flow

```
+----------------+   +---------------------+   +---------------------+
| Manifest CSV   |   | Docling             |   | Claude Code         |
| (catalog_      |   | (PDF table          |   | (claude -p headless |
|  manifest.csv) |   |  extraction;        |   |  session, the       |
|  hand-curated  |-->|  section context;   |-->|  autonomous worker; |
|  smoke phase;  |   |  chunked >200 page) |   |  reasons over       |
|  Zotero query  |   |                     |   |  Docling output     |
|  later)        |   | tuning constants    |   |  + drafts proposed  |
|                |   | mirror BN-RRM       |   |  catalog rows)      |
+----------------+   +---------------------+   +---------------------+
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
+---------------------+   +---------------------+   +---------------------+
| CatalogStagingReview|   | catalog_approve_    |   | Production tables   |
| HITL approval pane  |-->| staging_row()       |-->|   promoted_         |
| at /admin/catalog-  |   | RPC                 |   |     parameter_      |
| staging-review      |   |                     |   |     values          |
|                     |   | SELECT FOR UPDATE   |   |   catalog_          |
| Admin sees Approve/ |   | + INSERT target     |   |     evidence_items  |
| Reject buttons.     |   | + UPDATE staging    |   |   source_lead_      |
| Non-admin = read-   |   | (single tx)         |   |     triage          |
| only.               |   |                     |   |                     |
+---------------------+   +---------------------+   +---------------------+
```

---

## Components

### 1. Manifest CSV (input)

- **File:** `scripts/catalog-overnight/catalog_manifest.csv`.
- **Schema:** `doc_id,zotero_key_or_url,filepath,priority_tier,target_kind,notes`.
- **First-real-run:** hand-curated by owner with 1-3 smoke-test PDFs before triggering the first scheduled run.
- **Future:** Zotero programmatic query lane is a follow-up after the CSV lane proves out; out of scope for this redesign.

### 2. Docling extraction

- **Module:** `scripts/catalog-overnight/extract.py::extract_tables_from_pdf` (thin library; imported by the autonomous session at runtime).
- **Pattern source:** BN-RRM extract_tables_docling.py.
- **Tuning constants (mirror BN-RRM):**
  - `MAX_PAGES_FOR_OCR = 200`
  - `MAX_PAGES_FOR_ACCURATE = 500`
  - `PROACTIVE_CHUNK_THRESHOLD = 200`
  - `DEFAULT_CHUNK_SIZE = 50`
- **Output shape:** list of dicts with `table_index`, `page`, `caption`, `section_context`, `subsection_context`, `headers`, `rows`, `num_rows`, `num_cols`.

### 3. Claude Code worker

- **Invocation:** `claude -p "<starter prompt>"` headless mode, spawned by `.claude/scripts/launch_catalog_extraction.ps1`.
- **Auto mode:** the wrapper does not pass an explicit `--auto-mode` flag because the in-session prompt asserts hard constraints + the wrapper does not interact with the session after spawn (no stdin), so the session must work autonomously without owner intervention.
- **Reasoning step:** Claude Code reads Docling-extracted tables (via Bash + Python -c invocations that import from `extract.py`) and drafts proposed catalog rows. No external LLM client; Claude's own reasoning is the proposal generator.
- **No paid LLM API:** the agent runs under the owner's local Claude Code session under their auth subscription. No service-role API key for any paid LLM provider is provisioned in the agent's environment.
- **Slash commands UNAVAILABLE:** per empirical verification in `src/lib/agentic-os/launch-validator.ts:172-175`, `claude -p` does not process slash commands. The session uses plain git / Bash for end-of-session actions instead of `/update-docs` / `/safe-exit`.

### 4. Staging row builder

- **Module:** `scripts/catalog-overnight/extract.py::build_staging_row`.
- **Validations** (fail-fast at build time so the agent never inserts rows that violate the schema):
  - `proposed_kind` in `('parameter_value', 'evidence_item', 'source_lead')`
  - `proposed_payload` is a JSON-serializable `dict`
  - `confidence` is `None` or `float` in `[0, 1]` (rejects `bool` because `bool < int < float`)
  - `extraction_notes` is `None` or `str`
  - `zotero_key` is non-empty
- **Output:** `StagingRow` dataclass with `to_db_tuple()` matching the 11-placeholder `_INSERT_SQL`.

### 5. Staging writer (psycopg)

- **Module:** `scripts/catalog-overnight/extract.py::StagingWriter`.
- **DSN source:** process env var `CATALOG_DSN`, set by the wrapper from Windows Credential Manager (target name `SSTAC_CATALOG_DSN`). Never logged.
- **Connection role:** service-role; bypasses RLS on the staging table.
- **Atomicity:** `write_batch` is transactional -- on any per-row error, rolls back and re-raises.
- **created_by handling:** left NULL (service-role does not correspond to an `auth.users` session). The `created_by_role` column DEFAULTs to `'agent_service_role'`.

### 6. schtasks wrapper + sentinel discipline

- **Module:** `.claude/scripts/launch_catalog_extraction.ps1`.
- **Task name:** `SSTAC-StreamD-CatalogExtract` (registered via `.claude/scripts/register_catalog_extraction_task.ps1`).
- **Schedule:** daily at 23:30 PT (per design lock #3: machine stays awake overnight).
- **Pre-flight (round 1):** check `.tmp/CATALOG_EXTRACTION_STOP` and `.tmp/CATALOG_EXTRACTION_PAUSE` sentinels; exit cleanly if present. Read `.tmp/CATALOG_EXTRACTION_PRIORITY_BOOST` and pass forward via prompt substitution.
- **Archive-before-edit:** copy current `CATALOG_EXTRACTION_HANDOFF.md` to `docs/archive/YYYY-MM/CATALOG_EXTRACTION_HANDOFF_v<N>_ARCHIVED_<ts>.md` (per L0 1.2; `/handoff-update` slash command doesn't work in `claude -p` so the wrapper owns this step).
- **Pre-flight (round 2):** re-check STOP / PAUSE sentinels after archive (closes the archive-window race).
- **DSN load:** read CATALOG_DSN from Windows Credential Manager via `Get-StoredCredential -Target 'SSTAC_CATALOG_DSN'`. Set as process env for the spawned claude session.
- **Spawn:** `claude -p "<inlined prompt>" --output-format text`. Prompt has `$PassId` / `$YYYYMMDDTHHMMSSZ` / `$N` markers substituted by the wrapper before invocation.
- **STARTED breadcrumb** emitted to `.tmp/catalog-overnight-breadcrumbs/$PassId-<ts>-ps.json`.
- **Watchdog loop** (parity with `scripts/catalog-overnight/run.ps1:170-216` in the pre-pivot scaffold):
  - Every `$HeartbeatSeconds` (default 60s), look for pass-scoped `$PassId-*-py.json` breadcrumbs in `.tmp/catalog-overnight-breadcrumbs/`.
  - Pass-scoped filter is essential -- avoids stale prior-pass crumbs fooling the watchdog.
  - If no new `-py.json` breadcrumb for `$StallSeconds` (default 600s = 10 min), `taskkill /T /F` the claude process tree + write STALLED breadcrumb + exit 124.
  - Bounded `WaitForExit` (30s) so a hung taskkill cannot block the watchdog.
- **Finalize:** based on claude exit code: 0 = COMPLETED_GREEN, 124 = STALLED (already written), other nonzero = COMPLETED_RED, no exit code = SILENT_BAIL.

### 7. HITL approval surface

- **Component:** `src/components/matrix-options/CatalogStagingReview.tsx`.
- **Mounted at:** `/admin/catalog-staging-review` with admin / matrix_admin role gate.
- **Layout:** 3-column matching Evidence Library Phase 0.5 (commit `0225a53`).
- **Server actions:** `src/lib/catalog/staging.ts` (`listPendingStagingRows`, `approveStagingRow`, `rejectStagingRow`, `markSupersededStagingRows`).

### 8. Production targets (per `proposed_kind`)

| `proposed_kind` | Target table | Mapping |
|---|---|---|
| `parameter_value` | `public.promoted_parameter_values` | Payload fields map column-by-column. Defaults fire for id / created_at / updated_at + workflow-state columns (per the RPC denylist). |
| `evidence_item` | `public.catalog_evidence_items` | Same. |
| `source_lead` | `public.source_lead_triage` | Same. |

The mapping is authoritative in the `catalog_approve_staging_row` RPC's `CASE v_staging_row.proposed_kind` branch.

---

## Safety invariants (NON-NEGOTIABLE) -- v0.3.1 updated

Per the v0.3.1 redesign's P1-3 fix:

1. **Agent never writes to production catalog tables.** Only `catalog_extraction_staging`. No exceptions.
2. **Agent never promotes any staging row.** Promotion is an explicit HITL action via `approveStagingRow()` / the RPC.
3. **Agent never approves QA.** It does not touch the `parameter_value_reviews` QA workflow.
4. **Agent never mutates `src/data/`.** The curated HITL JSON catalogs are Tier 2 protected.
5. **All LLM calls go through the owner's local Claude Code session under their auth subscription.** No autonomous service-role API keys for paid LLM providers (Anthropic, OpenAI, etc.). The DSN passed to the agent is a Supabase service-role token only; no LLM key in the agent environment.
6. **Service-role DSN is never logged or breadcrumbed.** The wrapper reads it from Windows Credential Manager at runtime and sets it as a process env var; never written to disk or to logs.

Violations are P0 stop conditions.

---

## Breadcrumb format

Per L0 standing rule 1.13 (external CLI subagent monitoring -- breadcrumb discipline):

Files land at `<repo-root>/.tmp/catalog-overnight-breadcrumbs/$PassId-$YYYYMMDDTHHMMSSZ-{ps,py}.json` with the Windows-safe basic ISO timestamp (no colons; colons are invalid in Windows filenames and would silently fail to write, producing false STALLED watchdog kills).

Schema (PS side):

```json
{
  "pass_id": "uuid",
  "status": "STARTED | IN_PROGRESS | COMPLETED_GREEN | COMPLETED_RED | STALLED | SILENT_BAIL",
  "last_progress_at": "ISO 8601 UTC",
  "started_at": "ISO 8601 UTC",
  "note": "freeform",
  "output_artifacts": ["paths"],
  "host": "COMPUTERNAME",
  "source": "launch_catalog_extraction.ps1",
  "dry_run": true | false
}
```

Schema (Python side, emitted by `extract.write_breadcrumb`):

```json
{
  "pass_id": "uuid",
  "status": "STARTED | IN_PROGRESS | COMPLETED_GREEN | COMPLETED_RED",
  "last_progress_at": "ISO 8601 UTC",
  "current_zotero_key": "string",
  "output_artifacts": ["paths"],
  "note": "freeform",
  "source": "extract.py"
}
```

The Python side emits every ~120s during long-PDF processing (heartbeat) and on item completion. The pass-scoped `$PassId` prefix lets the wrapper's watchdog filter to this run's crumbs and ignore stale prior-pass crumbs.

---

## Cadence + scheduling

- **Schedule:** daily at 23:30 PT (design lock #3). Owner registers the task via `.claude/scripts/register_catalog_extraction_task.ps1`. Disable / re-enable via standard `schtasks /Change /Disable|/Enable`.
- **Active hours constraint:** 5am-11pm PT are owner-active hours; overnight slot 23:00-05:00 minimizes resource overlap.
- **Machine state:** must stay awake at trigger time. No BIOS wake-on-timer assumed.
- **First-real-run:** owner triggers manually after smoke test passes; the daily schedule resumes thereafter.

---

## Telegram digest (optional follow-up)

Subagent Phase 1 C found that `daily-telegram-status.ps1` exists in `C:/Projects/Regulatory-Review/.claude/scripts/`, not in SSTAC-Dashboard. Owner has two options for Stream D coverage:

1. Fork the script into `.claude/scripts/catalog_telegram_extension.ps1` (cleaner project separation).
2. Extend the Regulatory-Review script to scan SSTAC-Dashboard repos too (one script for all projects).

Owner decides post-Phase-3. Not blocking for first-real-run.

---

## Rollback runbook

If a pass produces systematically bad proposals, follow the runbook in `STREAM_D_REDESIGN_2026_05_28.md` "Rollback runbook" section. Quick reference:

1. Drop `.tmp/CATALOG_EXTRACTION_STOP` to halt the in-progress pass cleanly.
2. `schtasks /Change /TN "SSTAC-StreamD-CatalogExtract" /DISABLE` to prevent the next nightly fire.
3. `UPDATE public.catalog_extraction_staging SET hitl_status='superseded' WHERE extraction_pass_id = '<pass>' AND hitl_status='pending'` to bulk-remove from the HITL queue (non-destructive; audit trail preserved).
4. After diagnosis: `schtasks /Change /TN "SSTAC-StreamD-CatalogExtract" /ENABLE` to resume the schedule.

Trigger criteria: > 50% confidence < 0.3, > 90% malformed payload, or > 3x expected yield per PDF.

---

## Open questions deferred (per design)

| # | Question | Decision needed before |
|---|---|---|
| 1 | First-real-run schedule (when to trigger the first manual run) | Owner-decides post-Phase-3 |
| 2 | Manifest CSV initial rows (which 1-3 PDFs for smoke test) | Owner picks pre-first-real-run |
| 3 | DSN credential storage mechanism | Owner chose Credential Manager via `CredentialManager` PSGallery module per Phase 1 C subagent recommendation |
| 4 | Telegram script ownership (fork vs cross-project extension) | Owner picks at first-real-run |
| 5 | Zotero programmatic query lane | Follow-up after CSV lane proves out |

---

## Cross-links

| Stream D deliverable | File |
|---|---|
| Phase 3 commit 1 (scaffold new topology) | `b252589` (head of branch as of commit-1 land) |
| Phase 3 commit 2 (extract.py thin library + delete run.ps1 + drop ollama) | `011613a` |
| Phase 3 commit 3 (this rewrite + ripple-sweep + telegram note) | (current commit) |
| Design doc with 5-round review history | `STREAM_D_REDESIGN_2026_05_28.md` |
| Wrapper (schtasks-invoked) | `.claude/scripts/launch_catalog_extraction.ps1` |
| Task registration (one-shot) | `.claude/scripts/register_catalog_extraction_task.ps1` |
| Handoff doc | `CATALOG_EXTRACTION_HANDOFF.md` |
| Progress JSON | `scripts/catalog-overnight/catalog_extraction_progress.json` |
| Manifest CSV | `scripts/catalog-overnight/catalog_manifest.csv` |
| Starter prompt template | `scripts/catalog-overnight/CATALOG_EXTRACTION_STARTER_PROMPT.md` |
| Library (Docling + StagingWriter + breadcrumb) | `scripts/catalog-overnight/extract.py` |
| Migrations (applied) | `supabase/migrations/20260527000004` through `20260527000008` |
| HITL approval surface | `src/lib/catalog/staging.ts` + `src/components/matrix-options/CatalogStagingReview.tsx` |
| Admin route | `src/app/(dashboard)/admin/catalog-staging-review/page.tsx` |

---

*v2.0. Rewritten 2026-05-28 per Phase 3 commit 3 of STREAM_D_REDESIGN_2026_05_28.md v0.3.1. The prior v1.0 of this doc described the Docling+Ollama+Python-supervisor topology and is preserved in git history at commit `e953df4`.*
