# DRA Pilot Expansion - Source-Coordinate Triage (READ-ONLY)

Date: 2026-07-12
Scope: matrix_map schema, project qyrhsieynzfgyuqzznap. SELECT-only queries via
mcp__supabase-project-scoped__execute_sql + list_tables, plus local filesystem Glob checks
(existence only, no file content read). NO writes, NO OCR/extraction job, NO publish/flip.

## Current pilot (context, confirmed by query)

3 published DRAs, all coordinate_quality_tier = high (surveyed) on every sample:
- cba8b80f-7210-4652-a69a-5d43a416067e - Toquaht Bay PERA (Azimuth 2015) - 20 samples, all high, 300 meas
- 35be55e8-faee-40a4-92ea-c5e9f885358a - CP Nelson Yard HHERA (SNC-Lavalin 2020) - 8 samples, all high, 99 meas
- 920863bd-f548-475f-8f59-81fb80b41341 - Hercules Forwarding H/ERA (Golder 2016) - 6 samples, all high, 78 meas
Total 34 high-tier samples, matches known pilot member-visible sample count.

## Source-locator / provenance columns on matrix_map.dras (schema check)

Columns available: id, bnrrm_doc_id (FK int -> external bnrrm_training.db documents.doc_id),
title, agency, year, site_id, citation, document_url, public, confidentiality_notes,
is_deleted, deleted_at, deleted_by, created_at.

Findings across all 574 non-deleted DRAs:
- document_url: 0/574 populated (NULL on every row). No direct file link exists in this DB.
- citation: 574/574 populated, but two distinct shapes:
  (a) formatted citation "Agency (Year) Title" for reports where agency/year were captured
      during BN-RRM extraction (e.g. Keystone Environmental Ltd. (2014) Howe Sound ...)
  (b) raw source filename only, with agency = NULL and year = NULL (e.g.
      "r-0074-40-01-HHERA-FINAL-v2.pdf") - these are BN-RRM rows where citation metadata
      parsing did not resolve an agency/year, so the filename is the only locator.
- confidentiality_notes: 574/574 populated but boilerplate ("Default public=false per plan
  v3.4.2 R-10; matrix_admin to review per-DRA") - carries no source-locator information.
- bnrrm_doc_id: 574/574 populated - FK into bnrrm_training.db (external SQLite, NOT queried
  in this pass per scope). This is the only lead to an original file path/location if one
  exists in the BN-RRM extraction metadata.
- samples.station_id: 100% populated for every candidate below (named_station_ids ==
  sample_count) - so station IDs exist in the loaded data for potential cross-referencing
  against a source station table, IF that table can be located.

Local filesystem check (existence only, no content read): searched
C:\Projects\Regulatory-Review for the exact source filenames of the top anonymous-citation
candidates (r-0074-40-01-HHERA-FINAL-v2.pdf, 20200415_130884_RPT_HHERA_FINAL*, "Lot
C_Addendum*", "*IOCO*Shoreline*", "*Howe Sound*"). NONE were found under this repo tree
(bnrrm_extraction/ contains only 3 unrelated PDFs). The BN-RRM extraction corpus is not
locally mirrored under Regulatory-Review by filename; the only remaining lead is the
bnrrm_doc_id -> bnrrm_training.db lookup (out of scope this pass) or the G:\My Drive\SABCS -
Sediment Project\References / Zotero canonical root per L0 section 1.14 (not checked this
pass - no fetch/parse performed).

## Step 1/2 - Candidate triage table

Ranked by real measurement volume among non-published DRAs (published 3 excluded), with the
2 known "high volume but centroid-only" DRAs explicitly separated per task instructions.

| dra_id | name | agency/year | coord provenance (samples) | meas count | source-evidence availability | extraction feasibility | recommendation |
|---|---|---|---|---|---|---|---|
| ea15e94a-b093-4cb4-bd4d-80ab9eae16d4 | Detailed ERA - IOCO Shoreline, 2225 Ioco Rd, Port Moody, BC (DRAFT) | Golder Associates Ltd. / 2017 | 6/6 samples HIGH (surveyed) | 72 | citation formatted (agency+year), no document_url, bnrrm_doc_id present | N/A - already surveyed | **PUBLISH-AS-IS** (coord-safe; owner-gated flip only) |
| 052c6a9d-cd65-4b25-b675-eee489d50b6d | Howe Sound Sediment HHERA | Keystone Environmental Ltd. / 2014 | 198/198 MEDIUM (BC-CSR centroid) | 6946 | citation formatted (agency+year), no document_url; PDF not found locally | MEDIUM - HHERA of this scale (198 stations) almost certainly has a station-coordinate table/figure in a Site Investigation appendix; report needs to be located first (bnrrm_doc_id lookup) | **NOT recommended on coordinate grounds despite highest volume** - extract-coords-first if pursued |
| 90d54294-53fd-48d9-bd64-431ed83268d1 | r-0074-40-01-HHERA-FINAL-v2.pdf | unknown (filename-only citation) | 24/24 MEDIUM (centroid) | 1780 | citation = raw filename only, agency/year NULL, no document_url; PDF not found locally | LOW-MEDIUM - filename pattern (BC ENV site-registry style "r-0074-40-01") suggests a formal HHERA, likely has a station table, but no metadata to confirm and file not yet located | **NOT recommended on coordinate grounds despite 2nd-highest volume** - extract-coords-first if pursued |
| 578bab5d-079a-4e25-8469-39c682b801bf | Lot C_Addendum to DSI and HHERA_Flow Through_20240801.pdf | unknown (filename-only citation) | 114/114 MEDIUM (centroid) | 898 | citation = raw filename only, agency/year NULL, no document_url; PDF not found locally | MEDIUM - title indicates a combined DSI (Detailed Site Investigation) + HHERA addendum; DSI reports typically carry a full surveyed station-coordinate table, making this a promising extraction target structurally | extract-coords-first |
| e6c0df6d-b270-4498-8660-8fde2ee3d86a | 2013-07-01 Site 14764 Supp Site Inv CoR and HHERA by Keystone.pdf | Keystone (named in filename only; agency/year fields NULL) | 49/49 MEDIUM (centroid) | 780 | citation = raw filename, but explicitly attributes Keystone; Keystone-authored reports elsewhere in this corpus (Howe Sound, 855 Centennial, Island Copper Mine) use a consistent HHERA structure that includes station tables | MEDIUM - "Supplemental Site Investigation" title suggests a coordinate table exists; same locate-first blocker | extract-coords-first |

Additional context rows (not top-5, for completeness of the volume ranking):
8d040610 (927 meas, centroid, anonymous filename) and b3783fe5/64aab2e3/6a5b85ef (420/399/372
meas, all centroid, anonymous filenames) sit just below the top-5 cut; same locate-first
feasibility profile as 90d54294/578bab5d. a3b95869 (HHERA_FINAL.pdf, 247 samples, 2 high + 245
medium) was EXCLUDED from ranking despite the largest sample count because it has 0 loaded
measurements (no real data yet).

## Narrative

**Safe to add to the pilot AS-IS (already surveyed):** Only one non-published candidate
qualifies: ea15e94a (IOCO Shoreline DRAFT ERA, Golder 2017). All 6 of its samples are
coordinate_quality_tier = high, and it carries 72 real measurements. This is coordinate-safe
by the same standard as the 3 current pilot DRAs. No extraction work is needed for this one -
the only remaining step is the owner-gated publication review (see below).

**High volume, centroid-only, explicitly NOT recommended for publication on coordinate
grounds:** Howe Sound (052c6a9d, ~6946 measurements) and r-0074 (90d54294, ~1780
measurements) both have 100% medium-tier (BC-CSR centroid, approximate-location) coordinates.
Despite being the two largest real-data candidates in the province-wide dataset, centroid
precision is not disclosure-appropriate for per-station publication; both need sample-specific
coordinate extraction from source before they could be considered, and that determination
cannot be made from metadata alone in this pass - it requires locating and inspecting the
actual source report.

**Need coordinate extraction before consideration:** 578bab5d (Lot C DSI/HHERA addendum,
898 meas) and e6c0df6d (Site 14764 Supplemental SI + HHERA by Keystone, 780 meas) are the
next-best structural candidates - their titles suggest formal Site Investigation content
(DSI / Supplemental SI) that commonly carries a full station-coordinate table, which is a
stronger structural signal than a bare HHERA filename. 8d040610 and the 420/399/372-meas rows
sit in the same feasibility tier as 90d54294 - anonymous filename citations, no agency/year,
no document_url, and the source PDF was not found under the local Regulatory-Review tree in
this pass. Actual extraction feasibility for all of these cannot be confirmed until the
bnrrm_doc_id -> bnrrm_training.db linkage (or the G:\ SABCS References root / Zotero) is
checked for a real file locator - that lookup, and any OCR/table extraction, was explicitly
out of scope for this triage pass.

**Hold:** a3b95869 (HHERA_FINAL.pdf, 247 samples, 2 high-tier) has zero loaded measurements -
no real data to gain from expanding the pilot with it regardless of its favorable sample
count. Hold until/unless measurements are loaded for it.

## Reiteration (per task rules)

No DRA was published or unpublished. No visibility flag was flipped. No SQL write executed.
No OCR/extraction job was run. Publication of any DRA (including the one coordinate-safe
candidate, ea15e94a) remains entirely owner-gated via the matrix_map.flip_dra_public RPC,
per-DRA, after explicit owner review.
