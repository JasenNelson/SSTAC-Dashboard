# BN-RRM Date/Depth Enrichment -- Plan + Handoff (2026-06-24)

Durable spec for ADDITIVELY enriching the shared BN-RRM database with the sampling
dates, depths, and other event metadata that the bulk-site extraction dropped. Plain
ASCII. Authored after a full root-cause investigation this session.

## Working model (owner 2026-06-24, HIGH AUTHORITY -- see memory
`feedback_bnrrm_dataset_additive_only_and_lane_takeover`)
- matrix-options (sstac-dashboard) and BN-RRM are **parallel projects sharing ONE
  mutually useful database**, for efficiency. sstac TEMPORARILY owns the BN-RRM
  extraction lane while BN-RRM is paused.
- **Copy-and-update, both directions:** we COPY BN-RRM's DB output into our workspace,
  enrich the COPY, and BN-RRM later copies our enhanced DB forward. Neither side edits
  the other's repo files in place. Reading the BN-RRM lane to understand mechanism is
  fine; every WRITE lands on our copy.
- **Additive-only, keep ALL fields, no gaps:** preserve everything; ADD the missing
  metadata; populate the FULL BN-RRM field set the source offers (not just what the
  map needs), so BN-RRM inherits no gaps. Any scope-reduction STOPS for owner decision.
- Deliverable = an ENHANCED database = strict SUPERSET (same schema, same quality, more
  data) adoptable by a plain copy.

## Root cause (fully diagnosed + verified this session)
- `matrix_map`/BN-RRM `sampling_events.date_sampled` is populated for only **304 / 8354
  events** -- ONLY the 8-9 original seed sites. `depth_top_cm`/`depth_bottom_cm`: **11 /
  8354**. `ra_documents.doc_date`: **19 / 574 docs** (same seed DRAs). Identical coverage
  across the 50-site canonical DB, the 345-site `588docs` snapshot (DB2's source), and the
  pre-reextract backup -> **no richer source DB exists**.
- **Why:** two different extraction approaches.
  - **Seed sites (9):** manual `seed_*.py` scripts hand-transcribed `SAMPLING_DATES` dicts
    + table data from the PDFs -> dates/depths POPULATED. (e.g.
    `Regulatory-Review\...\bnrrm_extraction\seed_alcan_0331.py:516-520`.)
  - **Bulk sites (336):** automated `batch_pipeline.py` + `extract_tables_docling.py`
    extract TABLE STRUCTURES only and call `get_or_create_event(date_sampled=None)` --
    metadata (date/depth/method) never captured. This was a LIMITED pass that grabbed
    chemistry VALUES but dropped event metadata.
- **Good news -- the data is largely recoverable WITHOUT re-OCR:** the raw Docling output
  `*_VERBATIM_COMPLETE.json` for **132 docs** (in `Regulatory-Review\...\bnrrm_extraction\
  __reextract_staging\`) ALREADY contains the columns -- verified header hits across those
  files: "sample date" (447), "sampling date" (415), "date sampled" (83), "depth (m)" (152),
  "depth interval (m)", "sample depth (m)", etc. They were extracted but never PROMOTED to
  `sampling_events` by the mapping/load step. The remaining **~439 bulk docs have no VERBATIM
  artifact** (extraction paused 2026-04-25) and need a fresh read of the source PDF.
- **Source PDFs all available:** `G:\My Drive\Site_Remediation_Data\PDF_Archive\` (601 docs;
  `EXTRACTION_MANIFEST_DEDUPED.csv` has 100% filepaths).

## Extraction method: AGY (Gemini 3.1 Pro High), owner-proposed 2026-06-24
AGY has UNLIMITED tokens (use hard to conserve Claude); `--model "Gemini 3.1 Pro (High)"`
is the strong reasoning tier (no downgrade for regulatory data). See memory
`agy_antigravity_cli_usage`. AGY is the extraction + promotion workhorse; Claude orchestrates
thin; codex is the ship gate.

CAVEAT to retire in Phase 0: AGY has historically worked from PDF word-coordinates and can
rabbit-hole on visual reconstruction -- confirm true multimodal/OCR PDF ingestion on ONE doc
before committing the 439-doc run. Cap exploration in every brief (AGY rabbit-hole watch).

## Phases (execute in a FOCUSED FRESH session)
**Phase 0 -- setup + AGY capability smoke test (~30 min).**
- Copy the 588-doc snapshot DB into our workspace (NEVER edit the BN-RRM repo copy):
  source `Regulatory-Review\...\bnrrm_extraction\_preserved_db_snapshots\bnrrm_training_588docs_from_bnrrm-fixes_20260503\bnrrm_training.db`
  (== the G: `bnrrm_training_DB2_20260503.db`, sha256 73a4aa9c...).
- AGY smoke test: brief AGY (3.1 Pro High) to read ONE bulk-site source PDF + emit a
  structured `{station, date_sampled, depth_top_cm, depth_bottom_cm, media_type,
  sampling_method}` JSON. Confirm it can actually read the PDF content (OCR/multimodal),
  not just guess. If it can't ingest PDFs, fall back to the Docling re-run path for the 439.

**Phase 1 -- promote from the 132 VERBATIM artifacts (cheap, AGY, ~hours).**
- AGY parses each `*_VERBATIM_COMPLETE.json`, pulls the date/depth/method columns,
  normalizes (ISO-8601 dates; depths -> consistent unit), correlates to station + event,
  and emits an additive UPSERT set against the copy's `sampling_events` (+ `ra_documents.doc_date`).
- NEVER overwrite the manual seed-site dates; only fill NULLs. Populate the full field set.

**Phase 2 -- extract the 439 docs with no artifact (AGY multimodal, ~days, monitored).**
- AGY (3.1 Pro High) reads each source PDF from `G:\...\PDF_Archive\` and emits the same
  structured per-station metadata; promote additively to the copy.
- Monitored-wrapper + breadcrumb discipline (L0 1.7 + 1.13); quality gate per
  `Regulatory-Review\...\bnrrm_extraction\DOCLING_REMEDIATION_SCOPING_20260421.md`
  (multi-row headers / row-merge issues). Cap AGY exploration per brief.

**Phase 3 -- validate + load.**
- Verify the enhanced DB is a strict superset: row counts only grow; existing values
  unchanged; schema identical; date/depth coverage way up. Spot-check against source PDFs.
- Verification (AI finds + verifies, owner principle): cross-check AGY-extracted dates vs
  the VERBATIM table values where BOTH exist; sample a set against the source PDF; codex /
  Claude-subagent adversarial pass on the extractor + a value sample.
- Regenerate the matrix-map load from the enhanced DB WITH the artifact filter (drop
  regulatory-criteria/QA "stations" -- "BC Standard"/"CSR *"/"QA/QC *"/"RPD *"; ~192+ in DB2,
  see below), then load the dated/auditable data via project-scoped Supabase MCP with a
  pre/post snapshot diff (DB snapshot first for the province-wide write).

## Carry-over findings from this session (do not lose)
- **Extraction artifacts:** ~192+ of 7815 DB2 "stations" are regulatory-criteria/QA column
  headers mis-parsed as stations (e.g. "BC Standard" 14x, "CSR Drinking Water (DW)" 11x,
  "QA/QC RPD%" 10x). The clean 9-site live seed has ZERO. The map load MUST filter these.
  (Ideally fix upstream in the extraction so the enhanced DB itself is clean -- additive
  filtering, flagged not silently dropped.)
- **Auditability fields the map must carry (owner):** source report (DRA), sampling date,
  depth when available, tox + community data per location. Page number NOT needed.
- **Schema prereqs ALREADY APPLIED live (this session, via MCP, reviewed):**
  `20260620000001` (event_date nullable + date_precision + cross-column CHECK, PR #373) and
  `20260622000001` (fetch_measurements RPC projects date_precision + NULLS LAST, PR #390).
  Harmless + forward-compatible; the undated/dated data just isn't loaded yet.
- **Map frontend is READY:** bbox Stage 2 client (PR #413) makes the map viewport-bounded,
  so a large dated dataset is safe to load when ready. Batch F substances (PR #412) shipped.

## Key paths
- Enhanced-DB working copy source: G: `bnrrm_training_DB2_20260503.db` / the 588-doc snapshot.
- Extraction lane (READ-ONLY ref): `C:\Projects\Regulatory-Review\2026_Database_Development\data_acquisition\bnrrm_extraction\` (batch_pipeline.py, extract_tables_docling.py, map_tables_to_schema.py, load_to_sqlite.py, seed_*.py, BNRRM_HANDOFF.md, BNRRM_PARKED_STATE_AND_DB_DIVERGENCE_20260619.md, DOCLING_REMEDIATION_SCOPING_20260421.md).
- VERBATIM artifacts (Phase 1 source): `...\bnrrm_extraction\__reextract_staging\*_VERBATIM_COMPLETE.json` (132).
- Source PDFs (Phase 2 source): `G:\My Drive\Site_Remediation_Data\PDF_Archive\`.
- matrix-map ETL: `scripts/matrix-map/etl_bnrrm_to_supabase.py` (--site-ids, --allow-undated,
  reads default DB2; dry-run emits SQL).
- Prior investigation: `docs/design/matrix-map/MAP_2A_DATASET_INVESTIGATION_2026_06_23.md`.
