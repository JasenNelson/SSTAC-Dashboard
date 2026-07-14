# DRA Coordinate OCR Dry-Run -- Harness + Results (2026-07-14)

READ-ONLY dry-run. NO Supabase write, NO coordinate apply, NO SQL apply, NO DRA visibility change.
Owner-approved bounded/monitored/fail-closed OCR dry-run on the narrowed coordinate-table page ranges
from the DRA triage (`MATRIX_MAP_DRA_COORD_DRYRUN_TRIAGE_4CANDIDATES_2026_07_14.md`, PR #653). Plain ASCII.

## Headline
- The OCR path is FUNCTIONAL and SAFE. A new bounded harness (`scripts/matrix-map/ocr_dra_page_range.py`)
  OCRs a single page range under a hard timeout + RSS cap in a killable child process, fail-closed,
  read-only, leaving no owned orphan process.
- **Site 14764 (49 stn) station coordinates are OCR-RECOVERABLE**: Appendix C well logs (p162-172) OCR'd
  cleanly to monitoring-well IDs + UTM co-ordinates + datum, e.g.
  `MONITORING WELL ID: MW08-3 ... Co-ordinates: 5443453.97 N, 499448.26 E ... Datum: NAD 83/ CGVD 28`.
  This proves DRA coordinate extraction via OCR is feasible on a narrowed range.

## The harness (scripts/matrix-map/ocr_dra_page_range.py)
- Usage: `.venv/Scripts/python.exe scripts/matrix-map/ocr_dra_page_range.py --pdf <PDF> --start-page N
  --end-page M --report <out.json> [--out-md <out.md>] [--timeout-seconds 600] [--rss-cap-mb 6000]
  [--max-pages 40]`.
- Read-only: extracts pages [N,M] to a TEMP pdf (PyMuPDF, empty-password authenticate for encrypted
  source), OCRs the temp pdf with docling + RapidOCR (`do_ocr=True, force_full_page_ocr=True`), then
  deletes the temp. Never writes the source, repo, Supabase, or any data store.
- Guards (L0 1.7 monitoring-as-baseline): bounded range (`--max-pages`, refuse exit 2), same-path/hard-link
  refusal (never overwrite the source), OCR runs in a `multiprocessing` child, a parent monitor emits a
  heartbeat every 5s and TERMINATES the child tree on timeout or RSS-cap breach, and a `finally` always
  kills the child + removes the temp. Fail-closed: any error -> status ERROR, exit 1, no fabricated text.
- Dependency: docling RapidOCR needs `onnxruntime` (installed into the SSTAC `.venv` this run, alongside
  the pre-existing docling==2.112.0). Models (PP-OCRv6 ONNX) auto-download to the venv on first use.

## Results per range (all read-only, within guardrails)
| DRA | Range | Pages | Status | Peak RSS | Elapsed | Finding |
|---|---|---|---|---|---|---|
| Site 14764 | App C p162-172 | 11 | OK | ~2.0 GB | ~35 s | **Station coordinates FOUND** (MW IDs + UTM N/E + NAD83). 11 coordinate lines. |
| Lot C | p40-46 | 7 | OK | ~1.4 GB | ~30 s | Bureau Veritas water-analysis lab report -- NOT coordinates. |
| Lot C | p83-101 | 19 | OK | ~2.2 GB | ~45 s | ARD/ML acid-base-accounting lab data (SGS) -- NOT coordinates. |
| Howe Sound | App A p556-568 | 13 | OK | ~1.9 GB | ~35 s | Near-empty (~1.2 KB text) -- NOT the coordinate table; it is elsewhere in the image pages. |

Every run stayed far under the 5 GB RSS cap and the timeout, produced trustworthy OCR text, and left no
owned orphan process (python process count stable at baseline across all 5 runs).

## Interpretation + next steps (extraction/apply remain owner-gated)
- **Site 14764:** ready for a targeted OCR extraction of App C p162-172 -> parse MW-id + UTM (Zone 10N)
  per station -> owner review -> owner-gated coordinate apply. Nearest-term win.
- **Lot C (114 stn):** the surveyed-station table was NOT in the two image blocks tried (p40-46, p83-101,
  both lab data). The DSI surveyed table is likely in the text near "2.1 Location" (p2) or another range;
  recommend a read-only text pass on p2 + OCR of the remaining Lot C image block (p149-153) next.
- **Howe Sound (198 stn):** App A p556-568 is not it. Recommend OCR of the other large image ranges
  (the outline had no descriptive appendix titles) -- a short iterative search using this harness.
- No coordinate value is written anywhere from any diagnostic or OCR dry-run; `--apply` paths stay
  fail-closed; any coordinate apply / DRA visibility change stays owner-gated (audited app/RPC path).

## Provenance
Harness authored via AGY, verified + guard-tested + regex-hardened by the orchestrator, run read-only
against the real source PDFs. Extends PR #653. No files under `src/`, `supabase/`, or `matrix_research/`
were touched.
