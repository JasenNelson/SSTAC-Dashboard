# DRA Coordinate-Extraction Dry-Run Triage -- 4 Candidates (2026-07-14)

READ-ONLY dry-run. NO Supabase write, NO coordinate apply, NO SQL apply, NO DRA visibility change.
Read-only outline + text/image analysis of the 4 located centroid-only DRA source PDFs, to narrow each
one's coordinate-extraction target. Any OCR/extraction/apply stays owner-gated + fail-closed. Plain ASCII.

Companion to `MATRIX_MAP_DRA_COORD_DRYRUN_FINDINGS_HOWE_SOUND_2026_07_14.md` (candidate 1, full detail).
Source locators: `docs/design/matrix-map/DRA_EXPANSION_LOCATORS_AND_IOCO_PACKET_2026_07_12.md`.

## Method (all read-only, .venv python, merged scripts + one-off image/text scan)
`dump_dra_outline.py` (outline map) + a page-level scan classifying each page text-vs-image (extract_text
length < 15 = image) and flagging coordinate keywords (easting/northing/utm/lat/long/coordinate) and
lat+lon decimal-data pages. No file under src/, supabase/, matrix_research/ touched.

## Per-candidate triage

### 1. 052c6a9d Howe Sound (198 stn) -- see the companion Howe Sound findings doc
1234pp, encrypted-readable. Coordinate table is IMAGE-ONLY; prime target Appendix A p556-568 (13 image
pages). Targeted OCR there first.

### 2. 90d54294 r-0074 (24 stn)
- 200 pages, encrypted-readable. **Nearly all text (198/200 pages have a text layer; only 2 image pages).**
- Coordinate system present: "NAD 1983 UTM Zone 10N" labels on many pages (p23-24, p39-45) -- these read
  as site-map / figure captions, so the station coordinates may live in map FIGURES rather than a clean
  text table. 29 coordinate-keyword pages; no lat/long decimal pairs (UTM easting/northing site).
- **Next step:** targeted read-only content review of p23-24 and p39-45 to confirm whether a 24-station
  UTM table is text-extractable (likely OCR-free) or map-embedded. Highest OCR-avoidance potential of the four.

### 3. 578bab5d Lot C (114 stn)
- 153 pages, NOT encrypted. Text 117 / image 36. Only 1 coordinate-keyword page (p28); "2.1 Location"
  bookmark at p2; "Attachment D - Table 1 GW Results" at p38.
- Image-only blocks: **p40-46 (7pp)**, p83-101 (19pp), p149-153 (5pp).
- **Next step:** inspect p28 (text, coordinate keyword) and the p40-46 image block (adjacent to the
  Attachment D tables) -- a DSI surveyed-station table is the expected home of the 114-station coordinates.

### 4. e6c0df6d Site 14764 (49 stn)
- 716 pages, encrypted-readable. **Heavily scanned: 325/716 pages image-only.** Only 2 coordinate-keyword
  text pages (p20, p695). Descriptive appendix bookmarks (unlike the others).
- Prime image-block targets by appendix:
  - **Appendix C - Borehole and Monitoring Well Logs (p161-172; image block p162-172, 11pp)** -- well
    logs routinely carry per-station coordinates. Top candidate.
  - Tables section (p136; image block p123-136, 14pp).
  - Large image blocks also at p179-226 (48pp), p264-349 (86pp) as fallbacks.
- **Next step:** targeted OCR on Appendix C p162-172 first, then the Tables image block p123-136.

## Summary recommendation (dry-run plan; extraction/apply owner-gated)
| DRA | Stations | Pages | Prime coordinate target | OCR needed? |
|---|---|---|---|---|
| Howe Sound 052c6a9d | 198 | 1234 | Appendix A p556-568 (13pp image) | Yes (targeted) |
| r-0074 90d54294 | 24 | 200 | p23-24 / p39-45 (mostly text; UTM) | Maybe OCR-free -- verify first |
| Lot C 578bab5d | 114 | 153 | p28 + p40-46 image block | Partial (targeted) |
| Site 14764 e6c0df6d | 49 | 716 | Appendix C well logs p162-172 (11pp image) | Yes (targeted) |

All four are narrowed from full-document OCR to small bounded page ranges. Recommended order by
OCR-cost/benefit: r-0074 (verify text-extractability first, possibly no OCR) -> Lot C -> Howe Sound ->
Site 14764. Any OCR runs monitored/RSS-guarded/fail-closed; any coordinate write stays owner-gated.
