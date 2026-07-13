# DRA Pilot Expansion -- Source Locators + IOCO Publish Packet (2026-07-12)

Lane 4 of the mo-nextrun-2026-07-12 run. NON-MUTATING prep: no DRA published/flipped, no coordinate
write, no OCR/extraction job run. This resolves the `bnrrm_doc_id -> source file` linkage the triage
packet (`docs/design/matrix-map/DRA_PILOT_EXPANSION_TRIAGE_2026_07_12.md`) left open, and prepares the
one coordinate-safe publish candidate for an owner decision.

## Method (read-only)
- Candidate DRA ids + `bnrrm_doc_id` read via project-scoped MCP (SELECT-only) from `matrix_map.dras`.
- `bnrrm_doc_id` resolved against `ra_documents` (doc_id, doc_type, total_pages, filepath) in the
  external BN-RRM training DB `bnrrm_training_DB2_20260503.db` (G:\...\matrix-map-data), opened
  read-only. File EXISTENCE checked (os.path.exists only -- no content read, no OCR).

## 1. IOCO Shoreline -- PUBLISH CANDIDATE (owner-gated flip)
- dra_id `ea15e94a-b093-4cb4-bd4d-80ab9eae16d4`; bnrrm_doc_id 6.
- Coordinate-safe: all 6 samples `coordinate_quality_tier = high` (surveyed), 72 real measurements --
  the same disclosure standard as the 3 currently-published pilot DRAs. No extraction needed.
- Source located + EXISTS: `G:\My Drive\Site_Remediation_Data\PDF_Archive\3130\2017 Risk Assessment\
  1_Shoreline Risk Assessment_Draft.pdf` (Golder Associates 2017; doc_type ERA; 66 pages). NOTE: the
  title/filename says **Draft** -- publishing means publishing a DRAFT ERA's sample locations.
- DECISION NEEDED: publish ea15e94a as-is (accept a DRAFT-sourced DRA on the public map) yes/no.
- owner --apply required: YES -- publication is owner-gated, per-DRA, via `matrix_map.flip_dra_public`
  (needs an admin JWT; NOT SQL Editor / not the pooler service role). AI does not flip.
- PASTE-READY APPROVAL SENTENCE: "I approve publishing DRA ea15e94a (IOCO Shoreline ERA, Golder 2017,
  all 6 samples surveyed/high-tier, 72 measurements) to the public map via flip_dra_public, accepting
  that the source is a DRAFT ERA; verify member-visible sample count increases by 6 afterward."

## 2. Coordinate-extraction candidates -- LOCATORS RESOLVED (all source PDFs exist)
The four high-volume centroid-only (BC-CSR approximate-location) DRAs are NOT publishable as-is
(centroid precision is not disclosure-appropriate per station). All four source reports are now
LOCATED and confirmed present, so the extract-coords-first path is feasible:

| dra_id | doc_id | doc_type | pages | source file (EXISTS) | extraction feasibility |
|---|---|---|---|---|---|
| 052c6a9d Howe Sound (Keystone 2014, ~6946 meas, 198 stn) | 1 | HHERA | 159 | `...\PDF_Archive\9930\Roster\...\Item 1h 11644 141110 FINAL HHERA Sediment.pdf` | HIGH -- 159pp HHERA of 198 stations almost certainly carries a Site Investigation station-coordinate table/appendix. |
| 90d54294 r-0074 (unknown, ~1780 meas, 24 stn) | 351 | ERA | (n/a) | `...\PDF_Archive\19661\...\r-0074-40-01-HHERA-FINAL-v2.pdf` | MEDIUM -- formal HHERA filename pattern; needs page inspection for a station table. |
| 578bab5d Lot C (unknown, ~898 meas, 114 stn) | 26 | ERA | (n/a) | `...\PDF_Archive\0141 Nexen\...\Lot C_Addendum to DSI and HHERA_Flow Through_20240801.pdf` | MEDIUM-HIGH -- combined DSI + HHERA addendum; DSI reports typically carry a full surveyed station table. |
| e6c0df6d Site 14764 (Keystone 2013, ~780 meas, 49 stn) | 497 | ERA | (n/a) | `...\PDF_Archive\14764\...\Supp Site Inv CoR and HHERA by Keystone.pdf` | MEDIUM -- Supplemental Site Investigation; Keystone reports elsewhere in the corpus carry station tables. |

(total_pages is NULL for doc_ids 26/351/497 in ra_documents -- their page counts were not recorded at
ingest; a page probe is part of the extraction step, not this read-only pass.)

### 2a. FULL source locators (doc_id -> absolute path; verified os.path.exists = True, 2026-07-12)
The follow-on extraction lane MUST use these exact paths (the table above abbreviates for readability).
Re-verify existence at extraction time (Google Drive contents can move):
- doc_id 1 (Howe Sound HHERA, 052c6a9d): `G:\My Drive\Site_Remediation_Data\PDF_Archive\9930\Roster\Reports and supporting documents\Item 1h 11644 141110 FINAL HHERA Sediment.pdf`
- doc_id 6 (IOCO Shoreline ERA, ea15e94a): `G:\My Drive\Site_Remediation_Data\PDF_Archive\3130\2017 Risk Assessment\1_Shoreline Risk Assessment_Draft.pdf`
- doc_id 26 (Lot C DSI+HHERA addendum, 578bab5d): `G:\My Drive\Site_Remediation_Data\PDF_Archive\0141 Nexen\2024 CoC-DRisk App 14849\2024-08-02 Addendum\Lot C_Addendum to DSI and HHERA_Flow Through_20240801.pdf`
- doc_id 351 (r-0074 HHERA, 90d54294): `G:\My Drive\Site_Remediation_Data\PDF_Archive\19661\2024 CoC DRisk App 15112\Supporting docs\r-0074-40-01-HHERA-FINAL-v2.pdf`
- doc_id 497 (Site 14764 Supp SI + HHERA, e6c0df6d): `G:\My Drive\Site_Remediation_Data\PDF_Archive\14764\2013-07-01 Site 14764 Supp Site Inv CoR and HHERA by Keystone.pdf`

Reproduce the mapping: read `ra_documents` (doc_id, filepath) in `bnrrm_training_DB2_20260503.db` (the
relative filepaths for doc_id 1/6 resolve under root `G:\My Drive\Site_Remediation_Data\PDF_Archive`).

## 3. What remains (owner-gated / deferred -- NOT done here)
The extraction itself is a follow-on lane, deliberately NOT run in this pass:
- It is a LONG OCR/table-extraction job (Docling/OCR on 66-159pp PDFs) that cannot finish within a lane
  checkpoint window; per the run contract it must be bounded to a checkpoint or handed off, not left to
  block the run.
- It produces sample-specific coordinate WRITES (updating `coordinate_quality_tier`/geom per station),
  which are HELD under the prep-only envelope -- owner-gated, codex-gated, with pre/postflight.
- Extraction key: `stations.station_id` (100% populated on these DRAs' samples) cross-referenced to the
  station-coordinate table parsed from each source PDF; follow the Docling SOP (OCR-on for regulatory
  PDFs). AGY should draft the extraction harness (parse station table -> station_id->lat/lon); the
  orchestrator runs it; the coordinate write stays owner-gated.

## Reiteration
No DRA published or unpublished, no visibility flag flipped, no SQL write executed, no OCR/extraction
job run, no coordinate mutated. The IOCO publication (section 1) and every coordinate extraction/write
(section 2/3) remain owner-gated.
