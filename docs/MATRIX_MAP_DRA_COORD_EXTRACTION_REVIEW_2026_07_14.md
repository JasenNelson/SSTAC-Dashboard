# DRA Coordinate Extraction -- Structured Dry-Run Review (2026-07-14)

DRY-RUN extraction for OWNER REVIEW. Does NOT apply coordinates anywhere. NO Supabase write, NO
coordinate apply, NO SQL apply, NO DRA visibility change, NO catalog write. The values below are a
proposed extraction for the owner to review before any (separately owner-gated) coordinate apply via
the audited application/RPC path. Plain ASCII.

Pipeline: `ocr_dra_page_range.py` (bounded fail-closed OCR, PR #654) -> `parse_dra_well_coordinates.py`
(this PR) -> structured records. Companion: PR #653 (triage) + `MATRIX_MAP_DRA_OCR_DRYRUN_RESULTS_2026_07_14.md`.

## The parser (scripts/matrix-map/parse_dra_well_coordinates.py)
Read-only. Reads an OCR/text file, extracts station/well coordinate records (well_id + UTM northing/
easting + datum) from the Stantec borehole/well-log format, writes a JSON report + optional CSV. Never
applies or writes coordinates. Confidence policy (data-integrity, codex-hardened over 6 review rounds):
- **high** ONLY when both values are DIRECTION-BOUND (a `<num> N`/`<num> E` suffix, or a
  `Northing:/Easting: <num>` inline label) and each band has exactly one distinct bound value.
- **low** for proximity/reordered-inferred values, multiple candidates in a band, or a value not
  direction-bound (e.g. an unrelated project number near a coordinate line). Low = owner must verify.
- Never fabricates: whitespace-separated numbers are never merged; a well with no parseable coordinate
  is listed under `unresolved`, not guessed. Comma-grouped values ("5,503,598") are handled.

## Extraction results (DRY-RUN; owner-review required before any apply)

### Site 14764 (e6c0df6d) -- App C well logs p162-172 (OCR)
| well_id | northing (m) | easting (m) | datum | confidence |
|---|---|---|---|---|
| MW08-3 | 5443453.97 | 499448.26 | NAD 83 / CGVD 28 | high |
Unresolved (OCR-garbled coordinate on the page -- re-OCR at higher DPI or manual read): MW09-328,
MW09-329, MW09-330. Only 4 monitoring-well logs appear in this page range; the site's other stations
are not carried as per-station coordinates in this report section.

### Lot C (578bab5d) -- p28 (text)
| well_id | northing (m) | easting (m) | datum | confidence |
|---|---|---|---|---|
| MW/SV24-29S | 5503598.0 | 488123.0 | (see source) | low |
Confidence low because the source text places the values on separate lines from their Easting/Northing
labels (proximity-inferred, not direction-bound) -- owner should confirm against the source page. This
addendum PDF carries only this one well log; the full 114-station surveyed set is in the original DSI
report (not this file).

## Coverage summary + what remains (all owner-gated / needs more source work)
| DRA | Extracted here | Remaining |
|---|---|---|
| Site 14764 (49 stn) | 1 high + 3 unresolved (App C) | re-OCR the 3 garbled wells; find the other stations' coordinates (may be map-only) |
| Lot C (114 stn) | 1 low (p28) | full set in the original DSI report (separate source PDF) |
| Howe Sound (198 stn) | 0 | coordinate table is image-only, page not yet located (App A p556-568 was near-empty) |
| r-0074 (24 stn) | 0 | coordinates are map-embedded (no text/well-log table) -- needs georeferencing, not table OCR |

## Owner gates (nothing here is applied)
Any coordinate apply / DRA visibility change stays owner-gated via the audited application/RPC path.
This artifact is a proposed extraction for review; it writes nothing to Supabase, the catalog, or DRA
state. Recommended: owner reviews the `high` MW08-3 record + verifies the `low` records against source,
before deciding on any per-station coordinate apply.

## Provenance
Parser authored via AGY, then hardened by the orchestrator against 6 codex-review rounds (no
fabrication, direction-bound high-confidence only, comma-grouping, CSV confidence). Run read-only on
the OCR/text output of the real source PDFs. No files under `src/`, `supabase/`, or `matrix_research/`
were touched.
