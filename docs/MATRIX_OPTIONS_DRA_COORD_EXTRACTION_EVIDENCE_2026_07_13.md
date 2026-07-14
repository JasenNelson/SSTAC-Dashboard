# DRA Coordinate Extraction Evidence (2026-07-13)

## 1. Candidate DRAs

1. Howe Sound
   - DRA ID: 052c6a9d
   - Station Count: 198
   - Source PDF: G:\My Drive\Site_Remediation_Data\PDF_Archive\9930\Roster\Reports and supporting documents\Item 1h 11644 141110 FINAL HHERA Sediment.pdf

2. r-0074
   - DRA ID: 90d54294
   - Station Count: 24
   - Source PDF: G:\My Drive\Site_Remediation_Data\PDF_Archive\19661\2024 CoC DRisk App 15112\Supporting docs\r-0074-40-01-HHERA-FINAL-v2.pdf

3. Lot C
   - DRA ID: 578bab5d
   - Station Count: 114
   - Source PDF: G:\My Drive\Site_Remediation_Data\PDF_Archive\0141 Nexen\2024 CoC-DRisk App 14849\2024-08-02 Addendum\Lot C_Addendum to DSI and HHERA_Flow Through_20240801.pdf

4. Site 14764
   - DRA ID: e6c0df6d
   - Station Count: 49
   - Source PDF: G:\My Drive\Site_Remediation_Data\PDF_Archive\14764\2013-07-01 Site 14764 Supp Site Inv CoR and HHERA by Keystone.pdf

## 2. Extraction Approach

- **Library**: `docling` (with `pyproj` fallback if UTM conversion is needed).
- **Table-Parse Heuristic**: The harness scans the document for tables with headers indicative of coordinates (e.g. 'Station', 'Latitude', 'Longitude', 'Easting', 'Northing'). Exact layout logic is marked as NEEDS-TUNING for each specific PDF.
- **Coordinate-System Handling**: Coordinates are assumed to be in lat/lon WGS84 or UTM. If UTM, they must be converted using `pyproj`. The harness validates resulting coordinates against BC bounds (approx Lat 48 to 60, Lon -140 to -114) and fails closed if any fall outside.
- **Station ID Join**: Extracted labels are joined to `matrix_map.samples.station_id`. The strategy is an exact string match first, falling back to a normalized match (strip whitespace, unify case, remove dashes).

## 3. Acceptance Criteria (Future Run)

- **Station Coverage**: 100% of reported stations per DRA must be successfully extracted and matched.
- **Coordinate Bounds**: All extracted lat/lon pairs must be within valid BC geographic bounds.
- **ID Mapping**: All extracted station labels must map to a real `matrix_map.samples.station_id`.
- **Idempotency**: The generated `UPDATE` statements must be idempotent.
- **Verification**: The generated SQL must include PRE- and POST-flight verification queries.

## 4. OWNER-GATE

**CRITICAL**: Running the harness and applying coordinates requires **explicit owner approval of the exact operation** plus a **codex review** and rigorous **pre/postflight verification** (similar to T31/D1 processes). The harness enforces this: `--apply` fails closed with exit code 2 (live DB writes owner-gated, not implemented).

## 5. Harness hardening (2026-07-13d revision)

The harness was revised from an inert scaffold into a real no-write dry-run tool:

- `--apply` fails closed with a NONZERO exit (2); no Supabase connection, no SQL apply.
- Dry-run always writes a structured JSON report (`<out-sql>.dryrun.json`) and, when 0 stations are extracted, exits 1 (fail-closed, no SQL emitted, coordinates never fabricated).
- UTM handling is explicitly removed (`normalize_and_validate_coords(is_utm=True)` raises `NotImplementedError`) until a real pyproj conversion is implemented under owner approval.
- SQL literal handling is hardened: DRA id validated against a UUID regex, station id validated against a safe-character regex and quote-escaped; coordinates formatted as floats (no raw string interpolation of untrusted text). The prior literal `\n` join bug is fixed.
- Pure functions raise exceptions (unit-testable); `scripts/matrix-map/test_extract_dra_coordinates.py` (stdlib `unittest`, 6 tests) covers bounds/rejection, UUID + station-id validation, SQL shape, the dry-run report, and the `--apply` (exit 2) / no-station (exit 1) fail-closed paths.

### Dry-run result -- candidate 1 (Howe Sound, real source PDF)

Run against the real source PDF (`...9930/...Item 1h 11644 141110 FINAL HHERA Sediment.pdf`, `pdf_exists: true`):

```
status: BLOCKED
stations_extracted: 0
docling_available: false
pyproj_available: true
missing_inputs:
  - docling not installed in this environment (pip install docling)
  - extract_station_table table-parse heuristic is NEEDS-TUNING (returns 0 rows); implement real docling table parsing before any run
```

**Exact missing inputs before any real run:** (1) install `docling` in the run environment, and (2) implement the real `docling` table-parse heuristic in `extract_station_table` (currently a NEEDS-TUNING stub that returns 0 rows and fails closed rather than fabricate). Only then, under explicit owner approval + codex review + pre/postflight verification, would coordinates be generated (still never applied by this harness).
