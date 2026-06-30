# Station-Coordinate Enrichment Plan for BN-RRM / Matrix-Map

Date: 2026-06-25
Status: APPROVED (Plan Only)
Target Output File: docs/design/matrix-map/COORDINATE_ENRICHMENT_PLAN_2026_06_25.md

This document defines the implementation design for additively enriching the BN-RRM sediment database with station-level latitude and longitude coordinates. Currently, only 40 of 7,986 stations (~0.5%) have coordinates, resulting in stations collapsing into site centroids on the interactive map. Enriching these coordinates will upgrade matched stations to the high-quality, surveyed map tier.

This task is plan-only. No code modifications or database updates will be executed during this step.

---

## 1. Coordinate-Format Reconnaissance Findings

A read-only investigation was conducted across a representative sample of 5 sediment-bearing documents on the G: drive to analyze real-world coordinate formats, projections, and datums.

### Sampled PDF Analysis:
*   **Doc 20 (Keystone Environmental 2022 HHERA - Site 8859)**
    *   *Site-level coordinates*: Stated in text and checklist pages in Degrees-Minutes-Seconds (DMS) format: "Latitude: 49 deg 10' 43\" North", "Longitude: 122 deg 41' 20\" West".
    *   *Station-level coordinates*: Absent in text tables. Appears to rely on figure maps.
*   **Doc 28 (PSI2 Wharves Sediment, Hemmera, 2011 - Site 0141 Nexen)**
    *   *Station-level coordinates*: Absent from the text layer of the report. The stations are likely figure-only (marked visually on site plans).
*   **Doc 53 (AREMP Report, Ecoscape, 2014 - Site 3250 Trail WAS)**
    *   *Station-level coordinates*: Tabular coordinate tables exist in Appendix G ("Large Body Fish Data") and Appendix I ("Small Body Fish Sampling").
    *   *Format*: Explicit columns for "Upstream UTM East", "Upstream UTM North", "Downstream UTM East", and "Downstream UTM North". Coordinates are 6-digit Eastings (e.g., 450892) and 7-digit Northings (e.g., 5464632).
    *   *Projection & Datum*: Stated on mapping sheet legends as "NAD83-UTM Zone 11".
*   **Doc 122 (Goldstream HHERA, Parkland, 2022 - Site 13191)**
    *   *Site boundary coordinates*: Metes and bounds text on page 97 defines coordinates: "Commencing at a point (No. 1) defined by UTM coordinates (Zone 10) at the S.E. corner: E 459440 N 5369217".
    *   *Projection & Datum*: Stated in text as "NAD 1983 UTM Zone 10 U".
*   **Doc 158 (Brilliant Siding HHERA, SNC-Lavalin, 2022 - Site 6137)**
    *   *Site-level coordinates*: Table 3-1 has site-centroid "Latitude/Longitude 49 deg 19' 7.5\" N / 117 deg 38' 5.5\" W" and metes-and-bounds start point "Beginning at 453782.4 m E, 5463108.2 m N (UTM Zone 11N)". Page 125 has Protocol 20 checklist DMS coordinates: "Latitude 49 Degrees 19' 75.5\"N, Longitude 117 Degrees 38' 5.5\"W". (Note: The 75.5\" seconds value is likely a scan/transcription error in the source PDF or text layer, showing the importance of quality gates).
    *   *Station-level coordinates*: Absent in text tables.

### Key Reconnaissance Conclusions:
1.  **Tabular station coordinates** exist in the text layer of a subset of reports, predominantly as UTM Easting/Northing values (6 and 7 digits).
2.  **Datums and zones** vary between NAD83 and NAD27, and UTM Zone 10 and Zone 11.
3.  **Site-level coordinates** are frequently written in DMS (Degrees-Minutes-Seconds) format.
4.  **A significant portion of reports** are figure-only (coordinates are absent from text tables and only present on visual basemaps).

---

## 2. Detailed Pipeline Design

The coordinate enrichment pipeline consists of five sequential phases, mimicking the text-targeting and resumable batch-load patterns established in the BN-RRM lane.

```
+------------------+     +--------------------+     +-------------------+
|  1. Recon &      | --> | 2. Targeting       | --> | 3. Coordinate     |
|  pyproj Setup    |     |    Scanner (JSON)  |     |    Extractor (AGY)|
+------------------+     +--------------------+     +-------------------+
                                                              |
                                                              v
+------------------+     +--------------------+     +-------------------+
|  5. Quality      | <-- | 4. Coordinate      | <-- | Station-Name      |
|  Gates & Load    |     |    Conversion      |     |    Matching       |
+------------------+     +--------------------+     +-------------------+
```

### Phase 1: Setup and Control Point Validation
1.  **Environment Preparation**: Install `pyproj` in the virtual environment:
    ```powershell
    .venv/Scripts/pip install pyproj
    ```
2.  **Control Point Verification**: Before executing any batch conversions, the pipeline must execute a test script (`test_projection_control.py`) to convert a known control point and assert matching coordinates against a GIS standard.
    *   *Control Point*: Site 6137 metes-and-bounds start: `UTM Zone 11N, NAD83, Easting: 453782.4, Northing: 5463108.2`.
    *   *Expected Output*: `Latitude: 49.318750, Longitude: -117.634861`.
    *   *Verification*: Assert calculated coordinate is within 100 meters of target (to validate the conversion math against the document's approximate DMS coordinates).

### Phase 2: Targeting-First Scanner
1.  **Tooling Reuse**: Model the coordinate scanner on `scripts/matrix-map/scan_sediment_docs.py`.
2.  **Keyword Classification**: Scan the PDF text layer (using PyMuPDF/fitz) for keyword signals:
    *   *Coordinate terms*: "easting", "northing", "utm", "latitude", "longitude", "nad83", "nad27", "bc albers", "zone 10", "zone 11", "zone 9", "zone 8", "zone 7".
3.  **Classification Rules**:
    *   `HAS_COORD_TABLE`: Document contains "easting" and "northing" (or "latitude" and "longitude") in close proximity, indicating a coordinate list.
    *   `FIGURE_ONLY`: Document contains zone and datum keywords (e.g. "NAD83 UTM Zone 11") but lacks coordinate-table keyword groupings in text tables, typically containing map sheets (like Doc 53 pages 169-174).
    *   `NONE`: No spatial coordinate signals detected.
4.  **Output**: A manifest `mm_coordinate_targets.json` to quantify the exact size of the extractable subset *before* running extraction.

### Phase 3: Coordinate Extraction (AGY/Text Parsing)
1.  **Batch Runner Pattern**: Follow the resumable, sidecar-ledgered pattern from `scripts/matrix-map/mm_batch_runner.py` (using `mm_coord_batch_ops.db` and a separate quarantine ledger).
2.  **Target Scope**: Process only documents classified as `HAS_COORD_TABLE`.
3.  **Datum and Zone Detection (Mandatory)**:
    *   The extractor must read the datum and zone by performing a doc-wide scan across the entire PDF text (including map-sheet legends on other pages) for datum and zone. We assume a single datum/zone per document.
    *   If the datum is unstated, or if multiple conflicting zones/datums are found, the extractor must **quarantine the records as "unstated_projection"** and never write to the DB. Projections must never be assumed.
4.  **Station-Name Matching Design (Strict Guard)**:
    *   **Additive-Only**: Coordinates will only be added to existing stations. The extraction script will *never* create a new station in the `stations` table.
    *   **Matching Key**: Match by `(site_id, normalized_name)` where the station name is normalized using a new shared normalizer function `normalize_station_name` in `scripts/matrix-map/mm_loader_common.py` (which removes all non-alphanumeric characters, converts to uppercase, and provides consistent normalization across the etl and runner).
    *   **Quarantine Rules**:
        *   If the extracted station name does not match any existing station for that `site_id`, quarantine the coordinates as `unmatched_station_name`.
        *   If name normalization leads to multiple candidate matches, quarantine as `ambiguous_station_match`.
        *   If the target station already has coordinates, do not overwrite them; skip or write to a log.
        *   All quarantined records must be saved with full detail in the sidecar ledger (`mm_quarantine` table) so they are preserved for auditing.

### Phase 4: Projection Conversion
1.  **Conversion Library**: Use `pyproj` to perform coordinates transformation.
2.  **EPSG Code Reference Mapping**:
    *   *BC Albers (NAD83)*: `EPSG:3005`
    *   *NAD83 UTM Zone 7N*: `EPSG:26907`
    *   *NAD83 UTM Zone 8N*: `EPSG:26908`
    *   *NAD83 UTM Zone 9N*: `EPSG:26909`
    *   *NAD83 UTM Zone 10N*: `EPSG:26910`
    *   *NAD83 UTM Zone 11N*: `EPSG:26911`
    *   *NAD83 UTM Zone 12N*: `EPSG:26912`
    *   *NAD27 UTM Zone 7N*: `EPSG:26707`
    *   *NAD27 UTM Zone 8N*: `EPSG:26708`
    *   *NAD27 UTM Zone 9N*: `EPSG:26709`
    *   *NAD27 UTM Zone 10N*: `EPSG:26710`
    *   *NAD27 UTM Zone 11N*: `EPSG:26711`
    *   *NAD27 UTM Zone 12N*: `EPSG:26712`
3.  **DMS Support**: If a document specifies coordinates in Degrees-Minutes-Seconds (DMS), convert DMS values to decimal degrees before loading:
    `Decimal Degrees = Degrees + (Minutes / 60) + (Seconds / 3600)`.

### Phase 5: Quality Gates & Verification
1.  **BC Geographical Boundary Gate**:
    *   Assert that the converted WGS84 coordinates fall within the geographical box of British Columbia:
        *   Latitude: `[48.0, 60.0]`
        *   Longitude: `[-139.0, -114.0]`
    *   Any coordinate outside these bounds must be quarantined as `out_of_bc_bounds`.
2.  **Site Centroid Divergence Gate**:
    *   Cross-check the converted coordinate against the station's site-centroid (from `PR_MAP_8_GEOCODING_DATA_FULL.csv` / `sites` table).
    *   Calculate the distance (Haversine formula).
    *   If the distance is `> 5.0 km` (or `> 10.0 km` for large-extent sites), flag and quarantine the row as `excessive_site_centroid_divergence`. A site is classified as large-extent if:
        *   The site has 40 or more registered stations in the `stations` table, or
        *   The site name contains 'Trail' (e.g. Teck Trail Smelter) or 'Alcan'.
        *   Otherwise, the default 5.0 km threshold applies strictly.
3.  **Verification Script**: Extend `scripts/matrix-map/verify_merge.py` into a coordinate validation module to run:
    *   Same-schema validation (`sqlite_master` matching pristine).
    *   Data updates check:
        *   Verify that all tables *except* `stations` are strictly unchanged (`pristine EXCEPT enhanced == 0`).
        *   For `stations`, verify that all columns *except* `latitude` and `longitude` are strictly unchanged.
        *   For `stations`, verify that the total row count is identical (no new station rows are created).
        *   For `stations`, verify that any coordinates that were already populated with non-NULL values in the pristine database remain identical (never overwritten).
    *   Foreign Key integrity check.
    *   Golden control check (verify that a chosen control station converts and loads to the correct lat/lon float value within 100 meters).

---

## 3. Scope and Sequencing

### Scope Recommendation:
*   **Sediment Stations First**: The enrichment pipeline must focus exclusively on stations that possess records in the `sediment_chemistry` table. While soil and groundwater stations exist in the source PDFs, they are outside the scope of the sediment mapping dashboard. Storing them would pollute the coordinate tables and increase the risk of station-matching collisions.
*   **Figure-Only Documents**: Extracting coordinates from figures (georeferencing maps and digitizing station dots) is designated as **Future Scope** and will not be executed in Phase 1.

### Yield and Effort Estimate:
*   **Yield**: The targeting scanner will determine the exact numbers. Based on the 48 likely-sediment PDFs, we estimate ~10-15% will have extractable text coordinate tables, yielding coordinates for ~100-300 sediment stations.
*   **Effort**:
    *   *Phase 1 Setup & Test*: ~0.5 day.
    *   *Phase 2 Targeting Scanner*: ~0.5 day.
    *   *Phase 3-4 Extractor & Conversion*: ~1.5 days.
    *   *Phase 5 Verification & Load*: ~0.5 day.
    *   *Total estimated pipeline build*: ~3 days.

---

## 4. Build Acceptance Checklist

The coordinate enrichment pipeline build will be considered complete and ready for PR merge only when the following criteria are met:

- [ ] **Code Quality**: All extractor, scanner, and verification scripts are written in plain ASCII (character code points <= 127).
- [ ] **Codex Gate**: All new python scripts successfully pass the local `codex-review` syntax and logic gates.
- [ ] **Targeting Complete**: The targeting scanner runs and generates the target manifest `mm_coordinate_targets.json` with all docs classified.
- [ ] **Preservation of Seed Coordinates**: The load step asserts that the 40 original manual surveyed station coordinates are unchanged.
- [ ] **Zero Table Writes**: The script never inserts new rows into the `stations` table; it only performs `UPDATE` on `latitude` and `longitude` fields.
- [ ] **Datum and Zone Detection Validation**: Verified that documents with unstated or ambiguous datums/zones are quarantined, not loaded.
- [ ] **BC Boundary and Divergence Gate**: 100% of loaded coordinates pass the BC boundary test and are verified to be within 5-10 km of their respective site centroids.
- [ ] **Quarantine Integrity**: All skipped, unmatched, or failed coordinate records are written to `mm_quarantine` in the sidecar database with a valid reason code.
- [ ] **Golden Test Pass**: The verification script asserts that the control station coordinates map to the correct lat/lon within 100 meters.
- [ ] **Monitored Clean Build Gate**: The Next.js frontend builds cleanly via the monitored gate:
    `npm run build:monitored:clean -- -TimeoutSeconds 360 -PollSeconds 10`
