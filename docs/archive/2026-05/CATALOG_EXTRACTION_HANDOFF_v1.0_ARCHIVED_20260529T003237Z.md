# Catalog Extraction Handoff

**Purpose:** Session continuity for the SSTAC catalog extraction overnight workflow.
**Version:** 1.0
**Last Updated:** 2026-05-28
**Status:** INITIAL SCAFFOLDING. No passes have run yet. Awaiting owner trigger of first smoke run.

---

## Last Session

v1.0 -- Initial handoff scaffolding created as part of Stream D Phase 3 commit 1.
No extraction passes have run.

---

## Prior Sessions

(none yet)

---

## Next Session Starter

### Active Program Focus

First-real-run smoke test. The scheduled overnight workflow has not yet fired.

### Reference State

- Branch: `feat/stream-d-catalog-agent-scaffold`
- Live Supabase migrations (applied): 20260527000004 staging table + 20260527000005 approve RPC + 20260527000006-8 catalog_sources / catalog_evidence_items / source_lead_triage.
- Wrapper: `.claude/scripts/launch_catalog_extraction.ps1` (registered with Task Scheduler as `SSTAC-StreamD-CatalogExtract`; runs daily at 23:30 PT when enabled).
- Sentinel paths under `C:/Projects/SSTAC-Dashboard/.tmp/`:
  - `CATALOG_EXTRACTION_STOP` -- presence halts the run gracefully.
  - `CATALOG_EXTRACTION_PAUSE` -- presence pauses without halt (resumes next session).
  - `CATALOG_EXTRACTION_PRIORITY_BOOST` -- presence boosts priority for the next pass.

### Immediate Actions

1. Owner registers the scheduled task via `.claude/scripts/register_catalog_extraction_task.ps1` (one-shot).
2. Owner populates `scripts/catalog-overnight/catalog_manifest.csv` with 1-3 smoke-test PDFs.
3. Owner ensures `CATALOG_DSN` is stored in Windows Credential Manager (target name: `SSTAC_CATALOG_DSN`).
4. Owner triggers the task manually (`schtasks /Run /TN "SSTAC-StreamD-CatalogExtract"`) for the first smoke run.

---

## Open Blockers

(none -- pending first-real-run trigger)

---

## Recovery

(empty -- populated by sessions on commit-failure events with stash refs)

---

## Archive-before-edit

This file is archive-before-edit. The wrapper `.claude/scripts/launch_catalog_extraction.ps1`
automatically copies the current version to
`docs/archive/YYYY-MM/CATALOG_EXTRACTION_HANDOFF_v<N>.0_ARCHIVED.md` before launching each
session. Manual edits should follow the same convention.
