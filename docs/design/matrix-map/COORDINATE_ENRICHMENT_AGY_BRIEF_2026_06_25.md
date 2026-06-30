# AGY BRIEF -- Station-coordinate enrichment for BN-RRM / matrix-map (PLAN FIRST)

Plain ASCII only (code point <= 127). You are the implementation workhorse for the SSTAC-Dashboard
BN-RRM lane. **THIS TASK IS PLAN-ONLY.** Produce a detailed PLAN document (path below) for a human +
Claude orchestrator to review. Do NOT build the scanners/extractors or modify any database yet.
Light READ-ONLY investigation (sampling a few PDFs to see real coordinate formats) is encouraged to
make the plan concrete -- but cap it; do not rabbit-hole. Follow the AGY framework
(`C:\Projects\AGY_FRAMEWORK_2026_06_25.md`): write-script-not-execute, verify by file/git diff,
plain ASCII, no destructive commands, no git commit/push.

## WHY this task exists (the real bottleneck)
The BN-RRM sediment database has rich chemistry + (now) dates/depths, but it is almost
UN-MAPPABLE at the station level: **only 40 of 7,986 stations (~0.5%) have latitude/longitude.**
The interactive map therefore collapses every station at a site to ONE site-centroid dot (from the
BC CSR / IMAPBC site-remediation registry, joined at ETL time). The project's own ingestion design
states coordinate acquisition is ~80% of the mapping bottleneck. STATION-LEVEL COORDINATES are the
single biggest lever for a meaningfully richer map (true sampling locations vs one dot per site).
Coordinates were NOT captured by the recent vision extraction (its schema was station_id / date /
depth / media / parameters only).

## CURRENT STATE + the data
- Enriched deliverable DB (the source to enrich; sha-stamped, durable):
  `G:\My Drive\SABCS - Sediment Project\Dashboard\matrix-map-data\bnrrm_enhanced_2026-06-25_960a8b31.db`
  (== canonical DB2 + the sediment dates/depths enrichment; 7,986 stations / 8,559 events /
  17,021 sediment_chemistry; 100% additive superset, verified). COPY it to a working location;
  enrich the COPY (additive-only). Never edit the BN-RRM repo copies in place.
- Schema (already has the target columns -- no schema change needed):
  `stations(station_id INTEGER PK, site_id, name, station_type, latitude REAL, longitude REAL,
   depth_m, habitat_type, notes, UNIQUE(site_id,name))`;
  `sites(site_id, registry_id, name, latitude, longitude, site_type, region, waterbody, ...)`.
  The ETL already supports a per-station "high quality / surveyed" coordinate tier when
  stations.latitude/longitude are populated (vs the medium-quality site-centroid fallback). So
  populating stations.latitude/longitude additively AUTO-UPGRADES those points on the map.
- Source PDFs: `G:\My Drive\Site_Remediation_Data\PDF_Archive\` (filepath in ra_documents;
  relative to that base, or absolute -- handle both, as mm_batch_runner does).
- Site-centroid geocoding already in place (do NOT redo): `docs/design/matrix-map/PR_MAP_8_GEOCODING_DATA_FULL.csv`
  (BC CSR registry centroid per site, the current fallback).

## REUSE this existing tooling (do NOT reinvent)
- `scripts/matrix-map/scan_sediment_docs.py` -- the TEXT-LAYER targeting-scanner PATTERN (fitz text
  scan + keyword classify + JSON output). Model the coordinate-table scanner on this.
- `scripts/matrix-map/mm_loader_common.py` -- shared gates/normalizers (passes_name_gate,
  normalize_ascii, coerce_value, parse helpers); find_or_create_station matches by (site_id, name).
- `scripts/matrix-map/mm_extract_render.py` -- PDF page render (PyMuPDF) for vision if needed.
- `scripts/matrix-map/mm_batch_runner.py` -- the RESUMABLE, sidecar-ledgered, multi-pass,
  acceptance-gated vision orchestrator (render -> AGY vision -> gated load). The coordinate
  EXTRACTION phase should follow this proven pattern (resumable ledger, per-doc gate, quarantine).
- `scripts/matrix-map/verify_merge.py` -- the additive/same-schema/FK/no-dup verification gate
  pattern (extend for coordinate plausibility).
- `.venv\Scripts\python.exe` (PyMuPDF installed). NOTE: **pyproj is NOT installed** -- coordinate
  conversion (UTM/MTM/BC-Albers -> WGS84 lat/lon) will need `pip install pyproj` into the .venv, OR
  a vetted pure-python converter. The plan must address this.

## THE TASK TO PLAN (station-coordinate enrichment, targeting-first)
Plan these phases (mirroring the discipline that just worked for dates/depths -- TARGET before you
spend extraction effort):

1. **Coordinate-format reconnaissance (read-only, do a little now to ground the plan).** Sample
   ~5-10 sediment-bearing PDFs (start from the 48 likely-sediment docs in
   `mm_sediment_targets.json` if present, else any DRA with station tables) and CATALOG how station
   coordinates actually appear: a coordinate TABLE (columns: Easting/Northing, UTM, Lat/Lon, MTM,
   X/Y) vs only a LOCATION FIGURE/site map (dots on a basemap, no numbers) vs absent. Record which
   projection/datum strings appear (UTM zone 7-11, NAD83, NAD27, BC Albers, MTM zone). This sizes
   what is realistically recoverable.

2. **Targeting scanner (design; build later).** A text-layer scanner (like scan_sediment_docs.py)
   that classifies each doc: HAS_COORD_TABLE (extractable) / FIGURE_ONLY (hard -- georeferencing,
   out of scope for phase 1) / NONE. Keyword signals: "easting","northing","utm","latitude",
   "longitude","mtm","nad83","nad27","bc albers","zone 1[01]","zone [7-9]". Output a JSON manifest +
   counts so we know the extractable subset size BEFORE extraction.

3. **Coordinate extraction (design).** For HAS_COORD_TABLE docs: extract per-station
   {station_id, easting/northing or lat/lon, datum, zone/projection} (vision via the mm_batch_runner
   pattern, or text-table parse where reliable). MATCH to existing stations by (site_id, normalized
   station name) -- reuse the name normalization; do NOT create new stations, only ADD coords to
   existing ones (additive UPSERT of latitude/longitude on matched stations; NEVER overwrite the 40
   existing surveyed coords; quarantine unmatched/ambiguous).

4. **Projection conversion (design).** Convert UTM/MTM/BC-Albers -> WGS84 lat/lon (the map CRS,
   EPSG:4326), handling the datum (NAD83 vs NAD27) and zone. Specify the library (pyproj, install
   needed) + the exact EPSG codes per BC projection. This is a correctness-critical step -- a wrong
   zone/datum silently misplaces points by hundreds of metres.

5. **Quality gates + verification (design).** Plausibility: resulting lat in ~[48,60], lon in
   ~[-139,-114] (BC bounds) -- out-of-bounds -> quarantine, never load. Cross-check a sample of
   converted coords against the station's SITE centroid (a station should be within a few km of its
   site centroid; large divergence -> flag). Additive/same-schema/no-overwrite verification (extend
   verify_merge.py). A golden-style fixture (pick one known station with a known coordinate).

6. **Scope + sequencing.** Recommend scope: sediment stations first (the lane's focus) vs all 7,946
   coordless stations (bigger, but the map shows whatever is loaded). Estimate yield (how many docs
   have coord tables vs figure-only) + effort/time, and where Cursor IDE or AGY-vision each fit.
   FIGURE-ONLY docs (georeferencing a basemap image) are a SEPARATE, harder, later problem -- name
   it but do not scope it into phase 1.

## CONVENTIONS (non-negotiable, from the BN-RRM lane)
- ADDITIVE-ONLY: only ADD coords to existing stations; never overwrite existing values; never delete;
  quarantine ambiguous (record, never discard). Same-schema deliverable.
- TARGETING-FIRST: scan to size the extractable subset before spending extraction effort (the 25-doc
  batch proved blind bulk extraction is wasteful -- the corpus is 78% HHERA).
- RESUMABLE + sidecar ledger + per-doc acceptance gate + quarantine (mirror mm_batch_runner).
- NEVER trust an AGY/vision closeout -- the plan must specify verification (git diff, plausibility,
  golden) + a codex-review gate on the extraction/conversion code.
- Plain ASCII; no destructive commands; no git push.

## DELIVERABLE (this task)
Write the PLAN to:
  `C:\Projects\sstac-dashboard\docs\design\matrix-map\COORDINATE_ENRICHMENT_PLAN_2026_06_25.md`
Plain ASCII. It must contain: (a) the reconnaissance findings (real coordinate formats you observed
in the sampled PDFs, with which datums/zones), (b) each phase's design (scanner, extractor,
conversion, gates, verification) referencing the reuse tooling above, (c) the projection/datum
handling with exact EPSG codes + the pyproj install note, (d) scope recommendation + yield/effort
estimate + figure-only-as-future, (e) risks + open questions, (f) a concise acceptance checklist for
the eventual build. Also write a short closeout `.tmp_agy_closeout_coord_plan.md` (files created,
recon summary, key risks). Do NOT build scanners/extractors or touch any DB beyond read-only recon.
