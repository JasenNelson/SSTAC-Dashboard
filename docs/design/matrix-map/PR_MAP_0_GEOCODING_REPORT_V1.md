# PR-MAP-0 Geocoding ETL -- Coverage Report v1

**Status:** Geocoding pass COMPLETE for v1 seed (9 sites approved). Owner
review gate before PR-MAP-1 schema work begins.

**Date:** 2026-05-19. Source data: `bnrrm_training.db` (16.2 MB SQLite at
`C:\Projects\Regulatory-Review\2026_Database_Development\data_acquisition\bnrrm_extraction\bnrrm_training.db`).
WFS source: BC openmaps Contaminated Sites Registry
(`pub:WHSE_WASTE.SITE_ENV_RMDTN_SITES_SVW`) reprojected to EPSG:4326.

Data file: `.tmp_pr_map_0_geocoding_data.csv` (9 rows; one per site).

---

## Coverage delta

| Metric | Before PR-MAP-0 | After PR-MAP-0 | Delta |
| --- | --- | --- | --- |
| Geocoded stations | 40 | **290** | +250 |
| Geocoded sites | 4 (Tier A) | **9** (Tier A + Tier B) | +5 |
| Sediment chemistry rows mappable | 292 | **7847** | +7555 (+27x) |
| BC regions covered | 4 (VI / Kootenay / LMain / MetroVan) | **7** | +3 (Sea-to-Sky / VI North / Central BC / North Coast) |
| Reference stations mappable | 4 | **12** | +8 |
| Impacted stations mappable | 36 | **84** | +48 |

## Tier A: surveyed coordinates (4 sites; 40 stations; carried over unchanged)

| Site | Region | Waterbody | Stations | Reference | Impacted |
| --- | --- | --- | --- | --- | --- |
| Toquaht Bay Marina and Campground | Vancouver Island | Toquaht Bay | 20 | 0 | 20 |
| CP Nelson Yard (Hall Mines Smelter) | Kootenay | Kootenay Lake | 8 | 2 | 6 |
| IOCO Shoreline (2225 Ioco Road) | Lower Mainland | Burrard Inlet | 6 | 0 | 6 |
| Hercules Forwarding ULC | Metro Vancouver | Brunette River | 6 | 2 | 4 |

All Tier A stations carry `coordinate_source='surveyed'` and
`coordinate_quality_tier='high'` (solid marker outline per R-11).

## Tier B: BC Site Registry centroids (5 sites; ~250 stations; NEW)

| Site | Registry ID | BC CSR Name | Region | Lat | Lon | Stations |
| --- | --- | --- | --- | --- | --- | --- |
| Woodfibre (Former Squamish Pulp Mill) | 9930 | Woodfibre Mill near Squamish | Sea-to-Sky | 49.666858 | -123.253600 | 198 |
| Blue Water (855 Centennial Road) | 15125 | 855 Centennial Road, Vancouver | Lower Mainland | 49.283644 | -123.085022 | 24 |
| Island Copper Mine (Foreshore) | 4205 | BHP Minerals Island Copper Mine Site | Vancouver Island North | 50.597253 | -127.501833 | 15 |
| Pinchi Lake Mercury Mine | 5668 | Pinchi Mine, Fort St. James | Central BC | 54.627231 | -124.432461 | 8 |
| Rio Tinto BC Works (ALCAN Smelter) Kitimat | 331 | Alcan Smelters Kitimat | North Coast | 54.015611 | -128.691222 | 5 |

All Tier B stations will carry `coordinate_source='bc_csr_centroid'`
and `coordinate_quality_tier='medium'` (dashed marker outline per R-11;
popup tooltip "Coordinate from BC Site Registry centroid (not surveyed).
Approximate location only.").

**Sanity check (manual review):**
- Woodfibre at Squamish ~50 km N of Vancouver: lat 49.667 / lon -123.254 ✓
- Blue Water in Vancouver-Burrard Inlet area: lat 49.284 / lon -123.085 ✓
- Island Copper on northwest Vancouver Island: lat 50.597 / lon -127.502 ✓
- Pinchi Mine in Central BC near Fort St James: lat 54.627 / lon -124.432 ✓
- ALCAN Kitimat on North Coast: lat 54.016 / lon -128.691 ✓

All five coordinates plot in expected BC regions.

## Implementation note (PR-MAP-1 ingest)

PR-MAP-0 deliberately does NOT modify `bnrrm_training.db` in place. The
geocoding data lands in `.tmp_pr_map_0_geocoding_data.csv` and the
PR-MAP-1 ETL migration script applies it during the Supabase load:

1. For each row in the CSV, INSERT/UPDATE `matrix_map.samples` with:
   - `bnrrm_station_id` (joined from `bnrrm_training.db` for Tier A)
   - `geometry` = ST_MakePoint(longitude, latitude)::geography
   - `coordinate_source` + `coordinate_quality_tier` from the CSV
   - All other fields per the v3.4 schema
2. For Tier B (centroid-based): fan out the single centroid to ALL
   stations belonging to that site_id. ~250 stations get the same
   coord; appropriate for v1 since the actual station-level positions
   are NOT in the source data and the centroid is the best v1 estimate.
3. Per the R-11 visual: dashed marker outline for Tier B; solid for
   Tier A.

This split preserves the BN-RRM source-of-truth (left alone) and means
PR-MAP-1's migration script is the only thing that knows about the
two-tier coordinate provenance.

## What this report does NOT include

- **Per-station Tier B disambiguation.** All 250 Tier B stations share
  their site's centroid in v1. v1.x B-1 (re-parse DRA narratives) +
  B-2 (cross-reference BC EMS) will geocode many of these per-station.
- **Manual B-3 fills.** No manual geocoding was done in PR-MAP-0; if
  any of the 5 Tier B sites need station-level refinement BEFORE v1
  ships, owner can author per-station coords in a follow-on
  `.tmp_pr_map_0_manual_fills.csv` and the PR-MAP-1 ETL ingests both.
- **Unsupported sites.** The 41 BN-RRM sites NOT in the v1 seed remain
  ungeocoded; they're scheduled for v1.x.

## Owner sign-off checklist

- [ ] Coverage delta acceptable (40 -> 290 stations; +7555 chem rows; 7 regions)
- [ ] BC CSR centroid coordinates for the 5 Tier B sites look correct (sanity-check rows above)
- [ ] Two-tier coordinate provenance OK (high = surveyed; medium = centroid)
- [ ] Skip Tier B per-station manual fills for v1 (defer to v1.x)
- [ ] Approve handoff to PR-MAP-1 (Supabase schema + RLS + grants + ETL migration)

Reply `PR-MAP-0 approved` (or with edits) to start PR-MAP-1.

---

End of PR-MAP-0 coverage report.
