# DB2 Adoption + Custody Record (matrix-map sediment substrate)

Status: ADOPTED 2026-06-16. This records the canonical sediment-data source for the matrix-map
lane, its custody, integrity hash, and lineage, so the substrate survives a worktree cleanup and
any future session can verify it by content (not just size/mtime).

## Canonical artifact (owner-managed custody)

- **Path:** `G:\My Drive\SABCS - Sediment Project\Dashboard\matrix-map-data\bnrrm_training_DB2_20260503.db`
- **SHA-256:** `73a4aa9ca7ff70446c367f7429a3be611ec8bd01e27daa3d9d6467dd7c3631df`
- **Size:** 65,466,368 bytes (62.4 MB). **DB mtime:** 2026-05-03 12:04.
- Google Drive = durable owner-managed custody (survives machine + worktree cleanup). The 62 MB
  binary is NOT committed to git. Any rerun of the geocoder / ETL MUST verify this SHA-256 and
  hard-fail / warn on mismatch.

## Lineage

- **Source (read-only):** `C:\Projects\Regulatory-Review-worktrees\bnrrm-fixes\2026_Database_Development\data_acquisition\bnrrm_extraction\bnrrm_training.db`
- **Source worktree branch:** `bnrrm/fixes-20260421` @ `d00a2f66` (last commit 2026-05-06).
- Copied with SHA-256 verified identical (source == dest). No `.db-wal`/`.db-shm` sidecars at copy
  time (no open writer; consistent snapshot).
- **Schema reference (committed):** `DB2_bnrrm_training_schema.sql` (this folder).
- **Canonical-vs-stale:** DB1 (main RR tree, `...\Regulatory-Review\...\bnrrm_training.db`, 16 MB,
  2026-04-17, 50 sites) is STALE -- do NOT use. DB2 (this record) is the canonical 345-site extract.

## Contents (verified by `geocode_bc_csr.py` + `analyze_db2_load_decision.py`)

- 345 sites / 7,815 stations / 14,583 sediment_chemistry / 1,727 env_modifiers / 334 toxicity /
  63 benthic_community / 574 ra_documents.
- Key columns: `sites(site_id PK, registry_id TEXT UNIQUE [BC CSR site number, may carry leading
  zeros], name, latitude, longitude, region, waterbody)`; `stations(station_id PK, site_id FK, name,
  station_type, latitude, longitude)`; `sampling_events(event_id PK, station_id FK, date_sampled,
  source_table_ref)`; `sediment_chemistry(event_id FK, ...)`; `ra_documents(doc_id PK, site_id FK,
  doc_type, filepath)`.

## Key findings (see the companion reports)

- **Geocoding (`PR_MAP_8_GEOCODING_COVERAGE.md`):** 343 of 345 sites resolved a BC CSR registry
  centroid (WFS `SITE_ID`, GeoJSON lon/lat), covering all 14,583 chem rows; 2 WFS misses carry 0
  chemistry. **Coordinates are essentially solved.** BUT only 40 of 7,815 stations (0.5%) are
  surveyed -- the map is a registry-centroid SITE-INDEX, and medium-tier centroids must be excluded
  from station-level stats + the calculator bridge (the analytical guard).
- **Load decision (`PR_MAP_8_LOAD_DECISION_REPORT.md`):** the binding constraints are DATES +
  VISIBILITY, not coordinates. Only 302 of 8,354 events have a parseable date (7,807 chem rows ~=
  the current seed), so a dated-only load does NOT grow the map; relaxing/imputing dates unlocks the
  full 14,583 but is a schema + consumer-contract change. All new rows load `public=false`
  (admin-only) so the end-user delta is zero without a publish/grant decision. The load is OWNER-GATED
  on the date / visibility / provenance / analytical-guard / CAS decisions in that report.

## Tooling (this folder's lane, read-only against DB2)

- `scripts/matrix-map/geocode_bc_csr.py` -- BC CSR WFS geocoder -> the geocoding CSV + coverage report.
- `scripts/matrix-map/analyze_db2_load_decision.py` -- the decision-scenario report.
- The ETL two-pass generalization + load remain in the (owner-gated) LOAD PR, sequenced after the
  owner picks a date/visibility path -- not in this PR.
