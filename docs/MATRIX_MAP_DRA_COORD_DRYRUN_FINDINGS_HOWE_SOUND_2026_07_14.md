# DRA Coordinate-Extraction Dry-Run Findings -- Howe Sound Candidate-1 (2026-07-14)

READ-ONLY dry-run. NO Supabase write, NO coordinate apply, NO SQL apply, NO DRA visibility change.
This packet only records what the merged read-only diagnostics found; any extraction/apply stays
owner-gated. Plain ASCII.

## Headline
The attended-OCR target is narrowed from the full 1234-page report to a **13-page image-only block
(Appendix A, p556-568)** -- the prime candidate for the scanned 198-station coordinate table. A future
targeted OCR should start there, not on the whole document.

## Source
- DRA 052c6a9d Howe Sound (Keystone 2014, 198 stations).
- PDF: `G:\My Drive\Site_Remediation_Data\PDF_Archive\9930\Roster\Reports and supporting documents\Item 1h 11644 141110 FINAL HHERA Sediment.pdf`
- Confirmed accessible: 63,070,283 bytes, 1234 pages, `is_encrypted: true` (opens + decrypts with the
  empty owner-password; outline AND text layer are readable despite encryption).

## Method (all read-only, .venv python, merged scripts)
- `.venv/Scripts/python.exe scripts/matrix-map/dump_dra_outline.py --pdf <PDF> --report howe_outline.json`
  -> status OK, 21 bookmarks, 17 flagged. (Outline read cleanly even though the PDF is encrypted.)
- `.venv/Scripts/python.exe scripts/matrix-map/locate_dra_table_pages.py --pdf <PDF> --report howe_coordpages.json`
  -> status OK, 848/1234 pages have an extractable text layer (386 pages image-only),
  12 coordinate-keyword candidate pages.
- Read-only text scan of the ToC / List-of-Tables (p6-15) and per-section image-only-run detection
  (extract_text length < 15 chars = image page) over the Tables + Appendix ranges.

## Outline / section map (dump_dra_outline.py)
| Section | Pages |
|---|---|
| Title / Exec Summary / ToC | p1-15 |
| General Terms and Definitions | p16-168 |
| Figures | p169-181 |
| Tables (numbered report tables 2.1-8.6) | p182-542 |
| Appendix A | p543-592 |
| Appendix B | p593-595 |
| Appendix C | p596-604 |
| Appendix D | p605-608 |
| Appendix E | p609-621 |
| Appendix F | p622-625 |
| Appendix G | p626-1035 |
| Appendix H | p1036-1046 |
| Appendix I | p1047-1103 |
| Appendix J | p1104-1108 |
| Appendix K | p1109-1156 |
| Appendix L | p1157-1159 |
| Appendix M | p1160-1220 |
| Appendix N | p1221-1228 |
| Appendix O | p1229-1234 |

## Key findings
1. **The numbered Tables section (p182-542) is entirely text-extractable and contains NO station
   coordinate table.** The 46 numbered report tables (2.1 ... 8.6) are chemistry/risk-assessment
   results (EPCs, HQs, ILCR, toxicity), not station coordinates. So the coordinate table is NOT a
   numbered report table.
2. **The 198-station coordinate table is IMAGE-ONLY** (confirms the blocker). The text-layer locator
   found 12 coordinate-KEYWORD pages, but their snippets are prose (LoE, transect, groundwater),
   not a lat/long station grid -- i.e. the actual table has no text layer to extract.
3. **Appendix A (p543-592) contains a contiguous 13-page image-only block at p556-568.** Appendix A is
   the most likely home of a scanned Site Investigation / station-location table. This 13-page block is
   the highest-probability OCR target.
4. Larger image-bearing appendices exist as fallbacks if p556-568 is not the coordinate table -- most
   notably Appendix G (p626-1035, ~410 pages) and the other appendices in the 386 image-page pool.

## Recommendation (dry-run plan; any OCR/extraction remains owner-gated)
- Targeted, MONITORED, RSS-guarded, FAIL-CLOSED OCR on **Appendix A p556-568 (13 pages)** first --
  a 13-page bounded job, not a 1234-page attended session. Verify the OCR output IS the 198-station
  coordinate table before any parse.
- If p556-568 is not the coordinate table, expand to Appendix G's image pages next, then the remaining
  image-page pool.
- Extraction output must be reviewed by the owner; NO coordinate apply / Supabase write / DRA visibility
  change happens from any diagnostic or OCR dry-run. The existing `--apply` path stays fail-closed.

## Provenance
Diagnostics: `scripts/matrix-map/dump_dra_outline.py` (PR #650) + `locate_dra_table_pages.py` (PR #645),
run read-only against the real PDF. Extends `docs/MATRIX_MAP_DRA_COORD_EXTRACTION_DRYRUN_BLOCKER_2026_07_14.md`.
No files under `src/`, `supabase/`, or `matrix_research/` were touched.
