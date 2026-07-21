# Option D -- r-0074 Text-First Pilot Evidence + Owner Gate (2026-07-20)

READ-ONLY PILOT RESULT. This run executed the owner-approved text-first extraction pilot on ONE DRA
(r-0074) per `docs/design/matrix-map/OPTION_D_COORDINATE_UPGRADE_DESIGN_2026-07-20.md`. It ran only
read-only PDF text-layer diagnostics (pypdf). **No OCR, no vision, no external map estimation, no
coordinate write, no Supabase write, no publication.** AGY was intentionally not invoked (see
section 5). The determination is a **text-first NO-GO**; the run STOPS at the owner OCR/vision gate.

## 1. Pilot inputs (verified read-only)

- DRA: r-0074, `id 90d54294-53fd-48d9-bd64-431ed83268d1`, `site_id 162`, `bnrrm_doc_id 351`.
- Sample rows: 24, all `coordinate_quality_tier='medium'`. Printed labels (`display_name`) are
  sediment stations `SED11-137A` .. `SED11-160`; `station_id` is the BN-RRM integer surrogate.
- Source PDF: `r-0074-40-01-HHERA-FINAL-v2.pdf`
  (`G:\My Drive\Site_Remediation_Data\PDF_Archive\19661\2024 CoC DRisk App 15112\Supporting docs\`),
  13.9 MB, 200 pages, encrypted-readable (empty password). It is a 2024 Human Health + Ecological
  Risk Assessment for 660 Quayside Drive, New Westminster, BC (BOSA Development), report 0074-40.01.
- Environment: pypdf 6.13.3, pyproj 3.7.2 available; docling NOT installed (text path used, no OCR).

## 2. What was run (read-only, merged Gen-B diagnostics + two preflight probes)

1. `dump_dra_outline.py` -> 49 bookmarks, 6 flagged (Table of Contents, List of Figures/Tables,
   Appendix 1-4). No coordinate-table bookmark.
2. `locate_dra_table_pages.py` -> `text_layer_present=True`; 27 candidate pages, but every candidate
   is a KEYWORD-only match (0 coordinate-regex hits). The candidates inspected are map-figure title blocks.
3. Read-only text-signal probe (pypdf, whitespace-collapsed): searched the full 200-page text layer
   for the sediment sample labels and for UTM coordinate pairs.
4. Read-only image-page probe: identified near-empty (image-only) pages.

Evidence artifacts (scratch, gitignored): `.tmp/option-d-r0074-pilot/evidence/` --
`r0074_outline.json`, `r0074_pages.json`, `r0074_signal_probe.json`, `r0074_imagepages.json`.

## 3. Evidence (what the probes proved)

| Check | Result |
|---|---|
| `SED11-*` sediment labels (the 24 actual sample rows) in the text layer | **0 pages** (even whitespace-collapsed); spot-checks `SED11-137A` / `SED11-138` / `SED11-160` all **absent** |
| Extractable UTM coordinate pairs (7-digit northing + 6-digit easting) in text | **0 pages** |
| Coordinate keyword pages (`UTM` / `Zone 10` / `NAD`) | Map-figure legend captions only (e.g. "SITE LOCATION", "SURROUNDING LAND USE", "SOIL RESULTS - EPH" for 660 Quayside Dr) -- no coordinate values |
| Well/borehole labels (`MW` / `BH`) in text | 123 pages -- a DIFFERENT feature class than the sediment sample rows |
| Image-only / near-empty pages | 8 pages (p22, 27, 28, 33, 180, 184, 188, 189) -- appendix dividers; NO large raster data table |

## 4. Determination: text-first NO-GO (with two distinct blockers)

**Blocker A -- no text-layer coordinate table.** There is no machine-readable coordinate table in
this PDF. The only coordinate-bearing content is map FIGURES that carry a "UTM Zone 10 NAD83" legend
caption but no textual coordinate values -- i.e. the coordinates are MAP-EMBEDDED (georeferencing /
vision territory), which is explicitly out of scope for this text-first run. This confirms the
`EXTRACTION_REVIEW` warning carried into the design doc (section 6).

**Blocker B -- the sediment sample stations are absent from this document's TEXT LAYER.** The 24
sample rows are 2011 sediment stations (`SED11-*`); they appear ZERO times in this 2024 HHERA text
layer (the probe ran text-layer diagnostics only -- it cannot rule out labels embedded in
raster/vector figure content, which would require OCR/vision to confirm). The figures that do carry
text-layer locations are labelled with boreholes / monitoring wells (`MW-`/`BH-`), a different
feature class (the exact `display_name` / feature-class mapping hazard from design section 8). A
text-first path therefore cannot recover the `SED11-*` coordinates from this source; they are most
plausibly tabulated in the ORIGINAL 2011 sediment investigation report, a different source document
than `bnrrm_doc_id 351`.

Net: the mapping cannot be tied to `display_name` / sample rows with evidence from this source via a
text-first path. Per the pilot contract, the run STOPS here and does not self-upgrade to OCR/vision.

## 5. Why AGY was not invoked

The pilot contract permitted one AGY call for mechanical extractor/helper scripting. The read-only
preflight established NO-GO BEFORE any extractor was warranted: there is no text-layer coordinate
table to parse, so there is no mechanical extraction task to delegate. Building an extractor (or a
NAD83/26910 helper, or a `display_name` mapping probe) for a text-layer coordinate table that is not present would be
wasted work. AGY remains the correct workhorse for a future GO pilot.

## 6. Owner gate -- decide the next step (no work proceeds without this)

1. **Source-document gate (recommended first):** confirm whether the `SED11-*` sediment coordinates
   live in the original 2011 sediment investigation report rather than the 2024 HHERA
   (`bnrrm_doc_id 351`). If yes, a text-first re-pilot should target THAT document, not this one.
2. **OCR/vision gate:** approve a bounded OCR/vision + georeferencing pilot ONLY if the owner accepts
   that (a) this HHERA's coordinate content is map figures (georeferencing, not table OCR) and (b) it
   may still not contain the sediment stations. This is a larger tooling scope (vision + georef) than
   the merged text/OCR dry-run scripts cover.
3. **Different-pilot gate:** pick a DRA whose sample stations are present as a text/table coordinate
   list in an available source, per a fresh triage (r-0074 is not viable text-first from this source).
4. **Accept-centroid gate:** leave r-0074 at centroid `medium` tier and defer coordinate upgrade.

Recommended: gate 1 (cheap, read-only source-locator check) before any OCR/vision spend.

## 7. Scope statement

No coordinate was written, no Supabase write occurred, no publication or `flip_dra_public` was
performed, and no OCR/vision/external-map estimation was run. This document records read-only pilot
evidence and the owner gate/options; it records no completed owner decision and authorises nothing further.
