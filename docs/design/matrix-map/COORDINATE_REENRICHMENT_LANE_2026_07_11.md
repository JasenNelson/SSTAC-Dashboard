# Coordinate Re-enrichment Lane (proposal, report only) -- 2026-07-11

Status: REPORT ONLY. No SQL is run or proposed as executable in this document. This is a design
lane proposal for owner review; any actual coordinate data write is OWNER-GATED per the dashboard
rule (AI never mutates catalog/map data without explicit HITL action). If the owner approves a
direction below, the next step is a separate, narrow packet that drafts the exact UPDATE SQL,
runs it through `/codex-review`, and is owner-run in the Supabase SQL Editor -- never auto-applied.

## 1. The live finding (summary; full detail in COORDINATE_PROVENANCE_QA_2026_07_11.md)

Per the read-only QA in `docs/design/matrix-map/COORDINATE_PROVENANCE_QA_2026_07_11.md` (T16,
2026-07-11, live Supabase, SELECT-only):

- 4494 total samples across 574 DRAs. 100% have non-null lat/lng -- but coordinate PRESENCE is
  not coordinate ACCURACY.
- 98.49% (4426/4494) of samples carry `coordinate_source = 'bc_csr_centroid'` /
  `coordinate_quality_tier = 'medium'` -- i.e. they are plotted at the BC Contaminated Sites
  Registry's approximate site centroid, not at a surveyed field sampling position.
- Only 1.51% (68/4494) carry `coordinate_source = 'surveyed'` / tier `'high'`.
- Restricting to the 503 samples that carry at least one `medium = 'sediment'` measurement (the
  data that matters most for the sediment-standards use case): 463 (92.05%) are still centroid,
  only 40 (7.95%) are surveyed.
- No `low` / `manual_steward` / `waterbody_derived` / `other` coordinate_source values exist in
  the live table -- the pipeline that produced this load only ever emitted `surveyed` or
  `bc_csr_centroid`.

Net: the map is visually "100% complete" but substantively a centroid-approximation map for all
but a small surveyed minority, and that minority is thin even where it matters most (sediment).

## 2. Where true surveyed coordinates could plausibly be sourced

This section is a source inventory, not a commitment -- each candidate needs owner confirmation
before any extraction work is scheduled.

### 2a. The existing BN-RRM coordinate-extraction pipeline (scripts/matrix-map/)

Two scripts already implement exactly this problem and already produced the 68 current
`surveyed` rows:

- `scripts/matrix-map/extract_coords.py` -- reads BN-RRM source PDFs directly (via PyMuPDF /
  `fitz`), detects lat/lon or UTM-zone text on a page (`detect_projection`, DMS-to-decimal
  conversion via `dms_to_dd`), matches extracted coordinates to a named station
  (`SELECT station_id, name, latitude, longitude FROM stations WHERE site_id=?`), and validates
  the extracted point against a haversine divergence limit from the site's registry centroid
  before accepting it as a real surveyed value. This is the mechanism that already yields the 68
  `surveyed` rows in production.
- `scripts/matrix-map/geocode_bc_csr.py` -- the fallback/default path: resolves a site-level
  centroid from the BC openmaps WFS layer (`pub:WHSE_WASTE.SITE_ENV_RMDTN_SITES_SVW`) when no
  surveyed station coordinate is available. Its own header explicitly documents the point it
  emits is "the registry's APPROXIMATE site centroid... NOT a surveyed station location" -- this
  is the intentional, honestly-labeled origin of the 98.49% centroid majority, not a bug.

Because `extract_coords.py` already demonstrably works (68 confirmed extractions), the most
direct re-enrichment path is re-running or extending it against source documents that either (a)
were never run through the extractor at all, or (b) were run but the station-name match / page
lat-lon-detection failed and silently fell through to the centroid default. Distinguishing (a)
from (b) needs a pass-rate audit of the extractor's own logs/manifest against the full DRA
corpus -- that audit itself is a bounded, non-data-mutating next step (read the extraction
manifest/log, do not touch the live table) and would tell us how much upside re-running actually
has before committing to it.

### 2b. The original BN-RRM station data (DB2 / bnrrm_training.db)

`extract_coords.py` reads its match candidates from a `stations` table (`site_id`, `name`,
`latitude`, `longitude`) inside what its sibling script's docstring calls "DB2 (bnrrm_training.db)".
If that source database already has surveyed station-level lat/lon for stations that were never
carried through to the current `matrix_map.samples` load (e.g. because the live-load batches
under `scripts/matrix-map/mm_live_load_batch_*.sql` only picked up a subset, or because a station
row's coordinates were populated in DB2 after the current samples load was generated), a direct
DB2-to-Supabase coordinate backfill for already-loaded samples could be cheaper than re-running
PDF extraction. This needs a read-only comparison: DB2 `stations.latitude/longitude` (non-null)
joined against `matrix_map.samples` by the same station-identity key used at load time, restricted
to samples currently on `coordinate_source = 'bc_csr_centroid'`. That comparison is itself
read-only and would tell us the DB2-side surveyed-but-unloaded count before proposing any write.

### 2c. Original DRA source documents not yet in the extraction corpus

If DB2's `stations` table itself is coordinate-sparse (i.e. the gap is upstream of both scripts,
in the source documents never having been OCR'd/extracted for coordinates at all), the remaining
option is new extraction work against DRA source PDFs -- same tooling as 2a, applied to a
previously-unprocessed document set. This is the most expensive option (new Docling/OCR +
extraction runs, subject to the cross-project OCR-required invariant in `DOCLING_CONSISTENCY_SOP.md`)
and should only be scoped after 2a and 2b are exhausted, since both are cheaper re-use of coordinates
that likely already exist somewhere in the pipeline's own state.

## 3. Proposed prioritization (if the owner approves scoping this lane)

In priority order, narrowest/cheapest first:

1. **Sediment-bearing + currently-centroid samples** (463 of 4494; see QA section 5) -- these are
   the samples that carry real sediment chemistry data (13122 measurement rows across the 503
   sediment-bearing samples) but are plotted at a site centroid rather than the actual sampling
   location. This is the highest-value subset: it is where inaccurate coordinates could most
   directly mislead a spatial read of contamination extent.
2. **Sediment-bearing samples on publishable/soon-to-be-published DRAs** -- cross-reference against
   the DRA publication flow shipped in PR #605 (`flip_dra_public`, admin-only, single-DRA). As DRAs
   are published (currently 0 of 574; see the section 0 continuation update in
   `MATRIX_OPTIONS_COMPLETION_STATUS_2026_07_11.md`), any coordinate re-enrichment for a DRA about
   to go public is higher-value than re-enrichment for a DRA that will stay private indefinitely --
   public DRAs are the ones a non-admin viewer will actually see plotted.
3. **Remaining sediment-bearing samples, then the broader 3982-sample no-measurement population**
   last -- station records with no attached chemistry/toxicity/community data yet are lowest
   priority for coordinate precision since they are not yet informative map points regardless of
   position accuracy.

## 4. Explicit scope boundary

- This document proposes a LANE (an investigation + prioritization plan), not an executed fix.
- No SQL, UPDATE, or coordinate value is written, drafted-for-execution, or applied here.
- No script under `scripts/matrix-map/` was modified or run as part of producing this report; the
  script descriptions above come from reading existing source (`extract_coords.py`,
  `geocode_bc_csr.py`) and the T16 live QA (`COORDINATE_PROVENANCE_QA_2026_07_11.md`), not from a
  new extraction run.
- If the owner approves proceeding: the next steps are (a) the two read-only audits in sections
  2a/2b (extractor pass-rate + DB2-vs-live comparison), both non-mutating; then (b), only if those
  surface real upside, a narrow packet with a drafted UPDATE SQL statement, scoped to the section 3
  priority-1 subset, run through `/codex-review`, and owner-run in the Supabase SQL Editor. AI
  does not apply coordinate writes at any stage of this lane.
