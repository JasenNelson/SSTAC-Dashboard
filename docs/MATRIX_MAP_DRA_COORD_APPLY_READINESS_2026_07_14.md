# DRA Coordinate Apply-Readiness Packet (2026-07-14)

NON-WRITING apply-readiness artifact. NOTHING here is applied. Coordinate apply is NOT approved.
This packet documents the EXACT mechanism, an owner review table, a source-review checklist, and a
rollback plan so that IF the owner later approves a coordinate apply, it can be executed as an exact,
reviewed, fail-closed operation via the audited path. NO Supabase write, NO coordinate apply, NO SQL
apply, NO DRA visibility change. Plain ASCII.

Inputs: the dry-run extraction in `MATRIX_MAP_DRA_COORD_EXTRACTION_REVIEW_2026_07_14.md` (PR #655),
produced by `ocr_dra_page_range.py` (#654) + `parse_dra_well_coordinates.py` (#655).

## 1. Target mechanism (verified from schema, read-only)
- Table: `matrix_map.samples`. Coordinate column: `geometry geography(Point, 4326) NOT NULL` (WGS84).
- A postgres-owned SECURITY DEFINER BEFORE trigger (`samples_populate_lng_lat_from_geometry`)
  auto-populates durable `longitude`/`latitude` from `geometry` on INSERT/UPDATE -- so an apply sets
  `geometry` ONLY; the trigger derives lng/lat. The CHECK `samples_lng_lat_geometry_consistency`
  enforces WGS84 bounds.
- Also on the row: `coordinate_quality_tier` (CHECK IN 'high'|'medium'|'low'), `coordinate_source`,
  `source_dra_id` (uuid -> `matrix_map.dras`), `station_id` / `bnrrm_station_id`, `id` (uuid PK).
- CRS conversion REQUIRED: extracted values are UTM Zone 10N easting/northing (NAD83). The column is
  WGS84 (SRID 4326). Convert with `ST_Transform(ST_SetSRID(ST_MakePoint(<easting>, <northing>), 26910), 4326)`
  (26910 = NAD83 / UTM Zone 10N; `ST_MakePoint(x=easting, y=northing)`).
- Apply channel: the audited application/RPC path, OR the established bulk method (`apply_live_load.py`
  via the IPv4 session pooler) using the id-keyed, LOCK + `lock_timeout`, rowcount-asserted, fail-closed
  DO-block template (the T32-applied 2026-07-13 pattern). Owner runs; agents never write.

## 2. Owner review table (DRY-RUN extraction; verify before any apply)
| DRA | well_id | UTM E (m) | UTM N (m) | derived lng,lat (WGS84)* | conf | source | station map |
|---|---|---|---|---|---|---|---|
| Site 14764 (e6c0df6d) | MW08-3 | 499448.26 | 5443453.97 | ~ -123.0xx, 49.1xx (compute via ST_Transform) | high | App C p162-172 (OCR) | UNVERIFIED |
| Lot C (578bab5d) | MW/SV24-29S | 488123.0 | 5503598.0 | (compute) | low | p28 (text) | UNVERIFIED |

*Derived lng/lat is left to the ST_Transform at apply time (do not hand-compute). Unresolved wells
(Site 14764 MW09-328/329/330 -- OCR-garbled) are NOT in scope for apply until re-OCR'd + verified.

## 3. BLOCKING prerequisites before ANY apply (owner/data decisions)
1. **Well-id -> sample-row mapping is UNVERIFIED.** The OCR'd ids are MONITORING WELLS; `matrix_map.samples`
   rows are per-DRA sample stations. Whether MW08-3 / MW/SV24-29S correspond to (and which) sample
   `id`/`station_id` under the right `source_dra_id` MUST be confirmed (read-only) before an apply.
   Apply MUST target the exact sample `id` (uuid), not a fuzzy station name.
2. **coordinate_quality_tier decision.** OCR-extracted from a report figure/log is not a surveyed
   high-precision source; owner sets the tier ('medium' likely) + `coordinate_source` label.
3. **Low-confidence records need source verification.** Lot C MW/SV24-29S is `low` (reorder-inferred);
   verify against the source page before considering apply. Only verified records are apply-eligible.
4. **Coverage is partial** (2 wells). A broader apply should wait for fuller extraction (re-OCR garbled
   wells; locate Howe Sound / r-0074 / full Lot C sources).

## 4. EXACT apply operation TEMPLATE (NOT run; fill placeholders after prereqs)
Per sample row, id-keyed + rowcount-asserted + fail-closed (mirror the T32 DO-block):
```sql
-- OWNER-RUN ONLY, after prereqs 1-3. Replace <sample_id>, <source_dra_id>, <easting>, <northing>, <tier>, <source>.
DO $$
DECLARE v_rows int;
BEGIN
  SET LOCAL lock_timeout = '5s';
  UPDATE matrix_map.samples
     SET geometry = ST_Transform(ST_SetSRID(ST_MakePoint(<easting>, <northing>), 26910), 4326)::geography,
         coordinate_quality_tier = '<tier>',            -- e.g. 'medium'
         coordinate_source = '<source>',                -- e.g. 'OCR: Site 14764 App C p162-172, well MW08-3'
         updated_at = now()
   WHERE id = '<sample_id>'::uuid                        -- EXACT row (verified mapping), NOT a name match
     AND source_dra_id = '<source_dra_id>'::uuid;         -- defense-in-depth against cross-DRA mapping mistakes
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION 'apply aborted: expected 1 row for sample/source_dra_id pair, updated %', v_rows;  -- fail-closed
  END IF;
END $$;
```
Postflight (read-only): re-fetch the row's geometry -> confirm lng/lat within Zone-10N BC bounds
(~lng -128..-114, lat 48..60) and coordinate_quality_tier/coordinate_source as intended.

## 5. Rollback packet
PREFLIGHT (capture BEFORE any apply -- required): for each `<sample_id>`, record the current
`geometry` (as `ST_AsText(geometry)` or the lng/lat), `coordinate_quality_tier`, `coordinate_source`,
`updated_at`. Rollback = the same id-keyed + source-dra-id-guarded fail-closed DO-block setting those
columns back to the captured values. Because `matrix_map.samples.geometry` is NOT NULL, rollback MUST
restore the exact prior geometry; do not use `geometry = NULL`. Keep the preflight capture with the
apply record (T32 practice).

## 6. Source-review checklist (per record, before apply)
- [ ] Well id read matches the source page (OCR verified against the PDF page image).
- [ ] UTM easting/northing digits confirmed against source (no OCR transposition); datum = NAD83 Zone 10N.
- [ ] Confidence is `high` OR the `low` record was manually verified against source.
- [ ] The sample-row `id` mapping (prereq 1) is confirmed for the correct `source_dra_id`, and both are included in the filled SQL `WHERE` clause.
- [ ] `coordinate_quality_tier` + `coordinate_source` set per owner decision (prereq 2).
- [ ] Preflight rollback capture recorded (section 5).
- [ ] `/codex-review` on the exact filled DO-block (per the exact-operation gate).

## 7. Status
Apply is NOT approved and this packet applies nothing. It is ready to support an owner-approved,
exact-operation coordinate apply once prereqs 1-3 are resolved. All owner-gated: coordinate apply,
any Supabase write, DRA visibility change. No files under `src/`, `supabase/`, `matrix_research/` touched.
