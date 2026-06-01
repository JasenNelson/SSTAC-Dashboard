# Design: Autonomous overnight catalog-enrichment agent (Matrix-Options References & Values)

Status: DRAFT design for owner review (2026-06-01). No code. Plain ASCII.
Author: autonomous session. Owner decision required before any implementation.

## 1. Goal

Let an unattended (overnight / scheduled) agent grow the References & Values candidate
library from authoritative sources, so the QP/HITL wakes up to a queue of NEW candidate
values to review -- never to silently-changed defaults or auto-approved data. The agent
PROPOSES; humans DISPOSE.

This is an enrichment pipeline, not an authority. Its only durable output is rows in a
STAGING table awaiting human approval.

## 2. Hard guardrails (non-negotiable; these are the whole point)

1. STAGING-ONLY OUTPUT. The agent writes only to `catalog_extraction_staging`
   (`supabase/migrations/20260527000004_catalog_extraction_staging.sql`), every row
   `hitl_status='pending'`. It NEVER writes `promoted_parameter_values`,
   `parameter_value_reviews`, `catalog_sources`, `catalog_evidence_items`, or
   `source_lead_triage` directly, and NEVER calls the approve RPCs
   (`catalog_approve_staging_row` / `..._rows_bulk`).
2. NEVER mutate the static JSON catalogs (`matrix_research/reference_catalog/*.json`).
   Those are curated, code-reviewed artifacts edited only through the deterministic
   generator + a human-reviewed PR (see this session's `generate-catalog-records.mjs`).
   The overnight agent's surface is the DB staging table, not the repo JSON.
3. AI NEVER sets a default. Proposed values carry `default_status=available_option`,
   `qa_status=needs_review`. No `current_default`, ever.
4. AI NEVER approves QA. `approved_source_backed` and verdicts are HITL-only.
5. UNITS ALWAYS normalized, fail-closed. Reuse the generator's `normalizeToCanonical`
   (throws on any unrecognized unit; Greek-mu/micro mapped before lowercasing).
6. VALIDATE AGAINST THE AUTHORITATIVE SOURCE, NEVER AI MEMORY. Every extracted value is
   checked against the committed source-of-truth for its source family before staging:
   - US EPA IRIS: the EPA snapshot gate built this session
     (`epa_iris_canonical_snapshot.json` + `irisSnapshotDropReason`, within 2%). A value
     with no anchor or out of tolerance is DROPPED and reported, not staged.
   - Protocol 28 / Health Canada: the dirty-extraction heuristic
     (`dirtyExtractionReason`: doubled units, empty CAS, CAS bleed) excludes malformed
     rows; a per-source canonical snapshot (HC TRV v4.0, P28 Appendix tables) is the
     next guardrail to add (see Open Questions).
   This is the load-bearing lesson from 2026-05-31: AI-memorized "canonical" values
   produced false corrections; the EPA Excel was authoritative. See
   `dashboard_iris_values_validate_against_epa_excel_not_memory.md`.
7. NO SILENT CAPS. If the agent bounds a run (top-N, sampling, skipped sources), it logs
   exactly what it dropped, in the breadcrumb and the run report.
8. BOUNDED + MONITORED. The agent emits breadcrumbs (`{status, last_progress_at,
   output_artifacts}`) per L0 1.13; a stall watchdog terminates a hung run. Process
   safety per L0 1.9 (no orphan accumulation; detach long runs properly per L0 1.8).

## 3. Build on existing infrastructure (do not reinvent)

- `scripts/catalog-overnight/extract.py` -- thin extraction library (no main, no DB
  connection): `extract_tables_from_pdf`, `build_staging_row`, `save_proposals`,
  `generate_staging_sql`, `write_breadcrumb`. Validates payloads against the staging
  CHECK constraints. NEVER writes production tables or approves. This is the producer.
- `docs/CATALOG_HEADLESS_ENABLEMENT.md` -- the headless-worker enablement plan (ships
  UNARMED). The overnight agent is the "armed" successor; arming is an explicit owner act.
- `scripts/catalog-overnight/CATALOG_EXTRACTION_STARTER_PROMPT.md` -- the existing
  agent prompt; extend it with the guardrails above.
- The d0c00001..d0c00013 `.tmp/catalog-paste/*.sql` pass pattern + this session's
  `generate-catalog-records.mjs` (parse payloads -> normalize -> validate -> emit) is
  the reference transform. The overnight agent's DB path mirrors it but targets STAGING.

## 4. Pipeline (per scheduled run)

```
trigger (schtasks / cron, owner-armed)
  -> 1. SOURCE SELECT: pick next un-extracted source from a manifest
        (catalog_manifest.csv pattern), or a Zotero collection, or a Drive/OneDrive
        reference folder inventory. Skip already-extracted (idempotent by source+locator).
  -> 2. ACQUIRE: resolve the source file (Zotero local API at http://localhost:23119
        for metadata + attachment path; SABCS Drive root G:\My Drive\SABCS... per L0 1.14
        as the file root). Do NOT copy source files into the repo.
  -> 3. EXTRACT: Docling (tables/figures, OCR on for regulatory PDFs per the Docling SOP)
        -> structured rows via extract.py. Preserve source_excerpt + locator verbatim.
  -> 4. NORMALIZE + VALIDATE (fail-closed): units to canonical base; source-family
        guardrail (IRIS snapshot / HC / P28); dirty-extraction exclusion. Drop+report
        anything that fails. Carry source_excerpt_fidelity ('verbatim'|'reconstructed').
  -> 5. STAGE: insert pending rows into catalog_extraction_staging (proposed_kind in
        {parameter_value, evidence_item, source_lead}); confidence score; extraction
        model + timestamp. Emit the paste-SQL artifact too (owner-paste fallback).
  -> 6. REPORT: breadcrumb + a run summary (counts staged, dropped-with-reasons,
        ADJUDICATE/DATA-INTEGRITY list) to a dated artifact + optional notification.
  -> 7. HUMAN GATE (out of band): HITL reviews the staging queue in the
        CatalogStagingReview UI and calls the approve RPC to promote selected rows.
```

## 5. Inputs

- Zotero local API (read-only; L0 1.14): DOI/title/attachment metadata.
- Docling extraction (L0 Docling SOP): tables, OCR for regulatory PDFs.
- Authoritative source files under the SABCS Drive root (never copied into the repo).
- Per-source-family canonical snapshots for validation (IRIS exists; HC + P28 to add).

## 6. Output

- ONLY `catalog_extraction_staging` rows (`hitl_status='pending'`).
- A per-run paste-SQL artifact under `.tmp/catalog-paste/` (owner-paste fallback path,
  consistent with the JSON-first workflow; the agent never pastes to Supabase itself).
- A dated run report + breadcrumbs.

## 7. HITL approval gates (unchanged, human-only)

- Review in the CatalogStagingReview admin UI (RBAC: admin reviewers only).
- Approve via `catalog_approve_staging_row` / `catalog_approve_staging_rows_bulk`.
- Only approval promotes a staged row into the live candidate library. The agent has no
  path to this step.

## 8. Open questions for the owner

1. SCOPE OF SOURCES: which corpus first (remaining IRIS via EPA Excel? CCME eco-soil?
   the SABCS Drive reference folder)? The agent should not choose its own substance scope.
2. PER-SOURCE-FAMILY SNAPSHOTS: build a Health Canada TRV v4.0 and a Protocol 28
   canonical snapshot (like the EPA IRIS one) so HC/P28 values get the same
   validate-against-source guardrail IRIS now has. Recommended before arming for those
   families.
3. ARMING + CADENCE: when (if ever) to arm the headless worker, on what schedule, and
   the per-run budget (max sources, max staged rows) before the owner reviews.
4. NOTIFICATION: how the owner wants the morning run report (Telegram inbox / file / PR
   comment).
5. ECO PATHWAYS: eco-soil/EcoSSL passes need a pathway-mapping decision (see the eco
   mapping design) before the agent stages eco values.

## 9. Recommendation

Build the per-source-family snapshots (HC, P28) and a small DB-staging adapter around
the existing `extract.py` + generator, keep the worker UNARMED, and run it ONLY
attended for the first few sources so the owner can audit the staging queue and the
drop/ADJUDICATE reports before any unattended schedule. Do not arm an unattended
schedule until the validate-against-source guardrail covers every source family the run
will touch.
