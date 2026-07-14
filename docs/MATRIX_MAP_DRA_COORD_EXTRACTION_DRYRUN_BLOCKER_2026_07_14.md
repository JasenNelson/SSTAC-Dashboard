# DRA Coordinate Extraction -- Candidate 1 Dry-Run: Findings + Blocker + Executable Plan (2026-07-14)

Candidate 1: Howe Sound DRA (052c6a9d), 198 stations. Source PDF (G:):
`...9930/Roster/Reports and supporting documents/Item 1h 11644 141110 FINAL HHERA Sediment.pdf`.
This run attempted a monitored, bounded, NO-WRITE dry-run. No coordinate apply, no Supabase write,
`--apply` remains fail-closed and owner-gated.

## What was done (this run)

1. Installed `docling==2.112.0` (pinned) into the SSTAC `.venv`; verified `DocumentConverter` imports.
2. Installed `cryptography` (the source PDF is AES-encrypted; pypdf could not read it without it).
3. Wrote two NO-WRITE diagnostic scripts (shipped in this PR):
   - `scripts/matrix-map/explore_dra_pdf_tables.py` -- bounded docling table probe.
   - `scripts/matrix-map/locate_dra_table_pages.py` -- light pypdf text-scan page-locator.
4. Ran both, monitored.

## Findings (the blockers)

- **The PDF is 1234 pages** and AES-encrypted. docling's `max_num_pages` guard REJECTS an over-limit
  document rather than converting the first N pages, so a bounded first-N docling probe is not
  possible; a FULL 1234-page docling conversion (layout + table-structure + OCR) is a heavy,
  multi-hour, high-RAM operation with real OOM/unkillable-process risk (cross-project rule L0 1.7).
- **The station-coordinate table is NOT in the text layer.** The pypdf locator scanned all 1234
  pages: 848 have extractable text, **386 are image-only** (scanned, no text). Zero pages contained
  multiple BC decimal-degree coordinates; the 12 keyword hits are narrative prose ("station",
  "transect"), not a coordinate table. The coordinate table is almost certainly on the scanned/image
  appendix pages, which require OCR to read.
- Net: automated extraction requires running docling with OCR on an UNKNOWN page (somewhere in a
  1234-page doc) -- a needle-in-a-haystack heavy operation that cannot be safely bounded in an
  unattended overnight run.

## Status: BLOCKED (for a bounded automated dry-run). Not a code failure.

The harness itself (PR #629, #639) is ready: `--apply` fails closed (exit 2), extraction fails
closed (exit 1, never fabricates), real UTM->WGS84 + BC-bounds validation + station-id matching are
implemented and tested. The blocker is purely the SOURCE-DOCUMENT reality (1234 pages, encrypted,
image-only coordinate table), not the tooling.

## Executable next-step plan (dedicated, monitored session)

1. **Locate the table page(s) manually/cheaply:** open the PDF's table of contents / appendix list
   (the report references appendices) and identify the specific page range that holds the station
   coordinate table (e.g. "Appendix X: Sample Location Coordinates"). The `locate_dra_table_pages.py`
   report (848 text pages) narrows the search; the 386 image pages are the likely location.
2. **Convert ONLY that page range with docling + OCR** (docling supports a page range / `page_range`).
   This bounds the heavy operation to a handful of pages instead of 1234, with monitoring (heartbeat,
   RSS guard, hard timeout) per L0 1.7/1.9.
3. **Extract + validate:** feed the docling table into `extract_dra_coordinates.py`'s parser (tuned
   to that table's headers), run `normalize_and_validate_coords` (lat/lon or UTM+zone -> WGS84, BC
   bounds), and `match_station_id` against the real `matrix_map.samples.station_id` list for
   dra 052c6a9d (198 stations).
4. **Dry-run only:** generate the id-keyed UPDATE SQL FILE + JSON report; review 100% station
   coverage + BC-bounds + station-id join. NO apply.
5. **Owner-gated apply:** only after review, under an exact-operation owner approval + codex + pre/
   postflight, would coordinates be applied (still never by this harness's `--apply`).

## Failure modes to watch (documented)

- docling OCR memory on large/image pages (bound the page range; RSS guard; MAX_PAGES_FOR_OCR-style
  cap per the Docling SOP).
- UTM zone ambiguity (BC spans zones 7-11); the harness requires an explicit zone.
- Station-id mismatch between the PDF labels and `matrix_map.samples.station_id` (normalized match).
- 0 stations extracted -> the harness fails closed (exit 1), never fabricates.

## Recommendation

Treat candidate-1 extraction as a dedicated, attended/monitored session that starts from a
KNOWN table page range (step 1), not an unattended full-doc conversion. The diagnostic tools + the
fail-closed harness are in place; the missing input is the specific appendix page range, which a
person can identify from the report's ToC in minutes.

## Additional NO-WRITE diagnostic: dump_dra_outline.py (2026-07-14)

The new `dump_dra_outline.py` script extracts a PDF's outline/bookmark tree and flags potential coordinate-table locations.
Run it with:
`python scripts/matrix-map/dump_dra_outline.py --pdf <path> --report <out.json>`
This can narrow or eliminate the attended-OCR step by reading the bookmark tree, which is often readable even in image-only/encrypted PDFs.
The script is strictly READ-ONLY, fail-closed, and performs no coordinate apply.
