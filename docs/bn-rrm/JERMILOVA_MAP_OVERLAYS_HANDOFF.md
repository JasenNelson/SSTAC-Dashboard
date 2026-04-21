# Jermilova Map Overlays - Multi-Agent Build Handoff

## Purpose

Build a rich Map tab experience for the Jermilova 2025 Mackenzie Mercury BN-RRM benchmark pack by extracting the 12 feature classes from the FRDR geodatabase, wiring them into the pack manifest system, rendering them as toggleable overlays in `SiteMap.tsx`, and auto-loading them when the Jermilova pack is selected.

This is a **fresh-session handoff**. Read this document in full before touching any code.

---

## Session Context

**Project:** `C:\Projects\SSTAC-Dashboard` (Next.js 15, TypeScript strict, Zustand, Leaflet via CDN). Reads policies from `C:\Projects\Regulatory-Review\engine\data\rraa_v3_2.db`. Follow CLAUDE.md in both repos.

**Branch:** `main` (currently ~18 commits ahead of `origin/main`, do not push without user approval).

**Pack system quick primer:**
- Packs live in `C:\Projects\SSTAC-Dashboard\public\bn-rrm\packs\<pack_id>\`
- Each pack has a `pack.json` manifest with an `artifacts` section
- `src\lib\bn-rrm\pack-types.ts` defines the `PackManifest` and related types
- `src\stores\bn-rrm\packStore.ts` manages selected pack + artifact caching
- `src\hooks\bn-rrm\usePackArtifact.ts` is the lazy-loader for review artifacts
- The Jermilova pack ID is `bnrrm-casestudy-jermilova2025-mackenzie-hg` and has `scope_type: 'benchmark'`, `runtime_schema_version: 'generic-bn-rrm-v1'`

**Map system quick primer:**
- `src\components\bn-rrm\map\SiteMap.tsx` renders a Leaflet map
- It reads sites from `useSiteDataStore` (sites are upload-driven, not pack-driven, today)
- BC-specific overlays (parks, conservancies, etc.) are rendered via a WMS layer panel with category toggles (protected / aquatic / ecology / regulatory)
- There is currently no mechanism for pack-native map overlays. You will add one.

---

## The Data

### Source files (already on disk)

Source: `C:\Users\jasen\Downloads\FRDR_dataset_952_download_911_202604061118.zip` (~12 GB).

Inside it, the file you care about is `ManuscriptSpatialData.zip`, and inside THAT is `ManuscriptData/UJermilova_SpatialData.gdb/` (an ESRI File Geodatabase, ~7 MB).

**Already extracted to:** `C:\Users\jasen\Downloads\frdr_extracted\ManuscriptData\UJermilova_SpatialData.gdb\`

Do NOT extract the big rasters (6.4 GB `C_factor_Fall_2020.tif`, 5.3 GB `LS_McCool_300T.tif`, etc.) - they are not needed.

### The 12 layers to extract

All 12 layers should be extracted. File geodatabase opens via `fiona` (Python 3.11, already installed via `python -m pip install fiona`). Use `fiona.listlayers()` then `fiona.open(gdb, layer=name)` to iterate features.

**All layers use CRS `EPSG:3581` (NAD83 / NWT Lambert) EXCEPT `NWT_Commercial_Fisheries` and `Large_Mining_Operations` which are already `EPSG:4326`.** You MUST reproject everything to `EPSG:4326` (WGS84 lat/lon) for Leaflet.

| # | Layer | Geom | Features | Keep fields (schema field name -> output key) | Category | Notes |
|---|---|---|---|---|---|---|
| 1 | `GreatSlaveLake_Buffer50km` | MultiPolygon | 4 | `GSL_Region -> region`, `Area_calc -> area_km2` | `basins` | **Primary overlay**. These are the GSL sub-basin regions (Outlet/Middle/North Arm/East Arm). The whole Jermilova GSL sub-model aggregates fish Hg by these polygons. This MUST be the default-on overlay when a Jermilova pack loads. |
| 2 | `GBS1to4` | MultiPolygon | 4 | `Regions -> region`, `Subbasin -> subbasin`, `WSCSSDANAM -> wsc_name` | `basins` | Great Bear - Slave Region sub-basins for the GBS sub-model (not wired in UI today but include for completeness). |
| 3 | `Lakes_with_Consumption_Advisories` | Point | 28 | `Location -> location`, `Latitude -> lat`, `Longitude -> lon`, `Fish_Species -> species`, `Pregnant_women -> advisory_pregnant_servings_per_wk`, `Child__5_11_ -> advisory_child_5_11`, `Child__1_4_ -> advisory_child_1_4`, `Adult -> advisory_adult`, `Size_______cm_ -> fish_size_cm`, `Serving_size__g_ -> serving_size_g` | `advisories` | Human-health-relevant. Popup should show species + advisory servings per week per demographic. |
| 4 | `NWT_Commercial_Fisheries` | Point | 110 | `Name -> name`, `Location -> location`, `Latitude -> lat`, `Longitude -> lon`, `Species_1..4 -> species` (array), `Catch_quota__kg__LT_and_LW_only -> quota_kg`, `Quota_category -> quota_category`, `Subsubbasin -> subsubbasin`, `Subbasin -> subbasin` | `fisheries` | Commercial fishing stations. Already EPSG:4326. |
| 5 | `Historic_Mining_NWT` | Point | 80 | `Name -> name`, `Primary_Co -> primary_commodity`, `Lat -> lat_str`, `Long -> lon_str`, `Y -> y`, `X -> x`, `Stage_of_D -> stage`, `Years_of_P -> years_production`, `Mine_Devel -> development`, `Prod_num -> prod_num` | `mining` | Historic mine sites. Use X/Y for geometry (already in NAD83 NWT Lambert meters). |
| 6 | `Large_Mining_Operations` | Point | 14 | `Mine_Label -> name`, `Latitude -> lat`, `Longitude -> lon`, `Metal -> metal` | `mining` | Active large mines. Already EPSG:4326. |
| 7 | `Active_Mineral_Claims` | MultiPolygon | 1,070 | `CLAIM_NUM -> claim_num`, `CLAIM_STAT -> claim_status`, `CLAIM_NAME -> claim_name`, `OWNERS -> owners`, `ANNIV_DT -> anniversary_date`, `AREA_HA -> area_ha`, `LAND_CLAIM -> land_claim` | `mining` | **Heavy layer**. Simplify aggressively (Douglas-Peucker tolerance ~50m in projected units before reproject) and split into its own file so it can be lazy-loaded only when the mining category is toggled on. |
| 8 | `Active_Oil_and_Natural_Gas_Claim_50km` | MultiPolygon | 257 | `LAND_ID -> land_id`, `COMPANY_NM -> company`, `SHORT_DESC -> description`, `AGREETYP -> agreement_type`, `STATUS_E -> status`, `ISSUE_DTE -> issue_date`, `EXPIRY_DTE -> expiry_date`, `REGION_E -> region`, `CURR_HECT -> current_hectares` | `energy` | Oil/gas claim polygons. Simplify. |
| 9 | `Hydroelectric_Facilities` | Point | 6 | `Name -> name`, `Location -> location`, `Latitude -> lat`, `Longitude -> lon`, `Capacity__MW_ -> capacity_mw`, `Community_population__2016_survey_ -> community_population` | `energy` | Hydroelectric dams. |
| 10 | `NWT_PopulationEstimate_2021` | Point | 33 | `Community -> community`, `Latitude -> lat`, `Longitude -> lon`, `Total -> population_total`, `Dene -> pop_dene`, `Metis -> pop_metis` (note: source field is `M\xe9tis` with latin-1 char - decode safely), `Inuit -> pop_inuit`, `Non__Indigenous -> pop_non_indigenous`, `Ratio_Indigenous_to_non -> ratio_indigenous_to_non` | `communities` | NWT communities with Indigenous population breakdown. **Handle the encoding issue in the Metis field** - fiona may return it as a mojibake string. Decode to UTF-8 cleanly. |
| 11 | `Climate_Stations_Modern` | Point | 390 | `Station_name -> name`, `Latitude -> lat`, `Longitude -> lon`, `Elevation -> elevation_m`, `Annual_Precipitation__mm_ -> precipitation_mm`, `R_index -> r_index`, `Year -> year` | `climate` | Climate/precip stations. |
| 12 | `Thaw_Slump_Impacted_Waters` | 3D MultiPolygon | 3,980 | `nid -> id`, `WorkUnit -> work_unit`, `Reference -> reference`, `BUFF_DIST -> buffer_distance_m` | `permafrost` | **Heaviest layer, 3D polygons**. Strip Z dimension on output. Simplify aggressively (Douglas-Peucker tolerance ~25m in projected units). If final GeoJSON exceeds 3 MB, further simplify or split into tiles. |

### 6 overlay categories

1. `basins` - GSL + GBS sub-basin polygons
2. `advisories` - Fish consumption advisory lakes
3. `fisheries` - Commercial fishery locations
4. `mining` - Historic mines, large operations, mineral claims
5. `energy` - Oil/gas claims, hydro facilities
6. `communities` - NWT communities with population
7. `climate` - Climate stations
8. `permafrost` - Thaw slump impacted waters

(That is 8 - adjust to 8 categories. I miscounted earlier. Use these 8.)

---

## Team Structure

Launch **five agents**. Agents A/B/C/D work in parallel on independent tracks. Agent E is a code review gate that runs sequentially after A-D finish.

### Agent A: Geodata Extraction (Python)

**Role:** Convert the 12 layers from the ESRI geodatabase into production-ready GeoJSON files inside the Jermilova pack.

**Tools:** `python -m pip install fiona pyproj shapely` (fiona is already installed; add pyproj and shapely if missing). Python 3.11 is the installed interpreter - use `python`, not `python3`.

**Inputs:**
- Source GDB: `C:\Users\jasen\Downloads\frdr_extracted\ManuscriptData\UJermilova_SpatialData.gdb`
- Layer list and field mappings: from the 12-layer table above.

**Outputs:**
- Output directory: `C:\Projects\SSTAC-Dashboard\public\bn-rrm\packs\bnrrm-casestudy-jermilova2025-mackenzie-hg\map\`
- One GeoJSON file per layer: `gsl_basins.geojson`, `gbs_basins.geojson`, `advisory_lakes.geojson`, `commercial_fisheries.geojson`, `historic_mines.geojson`, `large_mines.geojson`, `mineral_claims.geojson`, `oil_gas_claims.geojson`, `hydro_facilities.geojson`, `communities.geojson`, `climate_stations.geojson`, `thaw_slumps.geojson`
- A `MAP_LAYERS_MANIFEST.json` index file summarizing: layer id, file path (relative), category, geometry type, feature count, simplification tolerance used, file size, CRS, bbox.
- A one-shot extraction script at `C:\Projects\SSTAC-Dashboard\scripts\bn-rrm\extract_jermilova_spatial.py` (idempotent, reruns cleanly).

**Requirements:**
1. Reproject everything to `EPSG:4326`. Reproject BEFORE simplification (simplify in degrees is fine for our purposes, or simplify in projected CRS then reproject - document which you chose and why).
2. Keep ONLY the fields listed in the table above. Rename to the output keys specified. Strip all other fields.
3. Write `properties` as plain JSON-safe types (string, number, bool, null). Decode any latin-1/mojibake strings cleanly.
4. For `Thaw_Slump_Impacted_Waters`, strip the Z dimension (use `shapely.ops.transform` or equivalent).
5. For simplification: target total directory size under **3 MB total** (uncompressed). Use Douglas-Peucker (`shapely.geometry.BaseGeometry.simplify(tol, preserve_topology=True)`). Recommended starting tolerances in degrees: basins 0.0001 (~11m), mineral/oil-gas claims 0.0005 (~55m), thaw slumps 0.0003 (~33m). Tune to hit the size target.
6. Add a `bbox` property to each feature and each file (GeoJSON spec allows top-level bbox).
7. Sort features by a meaningful key (e.g., name, region) for stable diffs.
8. Pretty-print with 2-space indent for diff-friendliness, but only if total size stays under 3 MB. Otherwise write compact.
9. For layers where lat/lon fields exist directly (`NWT_Commercial_Fisheries`, `Large_Mining_Operations`, `Lakes_with_Consumption_Advisories`, etc.), CROSS-CHECK the stored geometry matches the lat/lon field values (spot check 3 features per layer). Flag any mismatches in the manifest.
10. The script must log its actions and write a run summary (features in, features out, dropped count, final size per file).

**Do NOT:**
- Commit anything. Agent E handles commits.
- Touch any TypeScript / React code.
- Push to git.
- Modify files outside `public\bn-rrm\packs\bnrrm-casestudy-jermilova2025-mackenzie-hg\map\` and `scripts\bn-rrm\`.

**Done criteria:** Script runs cleanly; 12 GeoJSON files + manifest written; total directory under 3 MB; CRS is `EPSG:4326` for every file; all feature counts match source layer counts (or deltas documented).

---

### Agent B: Pack Schema and Manifest

**Role:** Extend the pack-types schema and Jermilova `pack.json` to support map artifacts. Runs in parallel with Agent A - does not depend on A's files actually existing yet, only on the agreed file names.

**Files to edit:**
- `C:\Projects\SSTAC-Dashboard\src\lib\bn-rrm\pack-types.ts`
- `C:\Projects\SSTAC-Dashboard\public\bn-rrm\packs\bnrrm-casestudy-jermilova2025-mackenzie-hg\pack.json`

**Requirements:**

1. In `pack-types.ts`, add a new interface `MapArtifacts`:
   ```typescript
   export interface MapArtifacts {
     basins_gsl?: string;
     basins_gbs?: string;
     advisory_lakes?: string;
     commercial_fisheries?: string;
     historic_mines?: string;
     large_mines?: string;
     mineral_claims?: string;
     oil_gas_claims?: string;
     hydro_facilities?: string;
     communities?: string;
     climate_stations?: string;
     thaw_slumps?: string;
   }

   export type MapArtifactKey = keyof MapArtifacts;

   export const MAP_ARTIFACT_KEYS: MapArtifactKey[] = [
     'basins_gsl', 'basins_gbs', 'advisory_lakes', 'commercial_fisheries',
     'historic_mines', 'large_mines', 'mineral_claims', 'oil_gas_claims',
     'hydro_facilities', 'communities', 'climate_stations', 'thaw_slumps',
   ];
   ```

2. Extend the existing `PackArtifacts` interface to include an optional `map?: MapArtifacts`. Do not make it required - general/site packs should not need to populate it.

3. In `pack.json` for Jermilova, add the `map` block under `artifacts`:
   ```json
   "artifacts": {
     "runtime_model": "runtime/learned-model.json",
     "training_data": "training_data.json",
     "review": { ... existing ... },
     "map": {
       "basins_gsl": "map/gsl_basins.geojson",
       "basins_gbs": "map/gbs_basins.geojson",
       "advisory_lakes": "map/advisory_lakes.geojson",
       "commercial_fisheries": "map/commercial_fisheries.geojson",
       "historic_mines": "map/historic_mines.geojson",
       "large_mines": "map/large_mines.geojson",
       "mineral_claims": "map/mineral_claims.geojson",
       "oil_gas_claims": "map/oil_gas_claims.geojson",
       "hydro_facilities": "map/hydro_facilities.geojson",
       "communities": "map/communities.geojson",
       "climate_stations": "map/climate_stations.geojson",
       "thaw_slumps": "map/thaw_slumps.geojson"
     }
   }
   ```

4. Add a category classification as a const exported from `pack-types.ts`:
   ```typescript
   export const MAP_ARTIFACT_CATEGORIES: Record<MapArtifactKey, string> = {
     basins_gsl: 'basins',
     basins_gbs: 'basins',
     advisory_lakes: 'advisories',
     commercial_fisheries: 'fisheries',
     historic_mines: 'mining',
     large_mines: 'mining',
     mineral_claims: 'mining',
     oil_gas_claims: 'energy',
     hydro_facilities: 'energy',
     communities: 'communities',
     climate_stations: 'climate',
     thaw_slumps: 'permafrost',
   };
   ```

5. Run `npx tsc --noEmit` after your edits and confirm zero errors. If there are errors elsewhere in the codebase from type widening, FIX them (they are likely consumers that destructure `artifacts`).

**Do NOT:**
- Touch `SiteMap.tsx` or any component files.
- Touch the GeoJSON files themselves.
- Commit anything.

**Done criteria:** `tsc --noEmit` clean; `pack.json` loads without schema errors in the dev server; `MapArtifacts` and related types/consts exported.

---

### Agent C: Map Overlay Rendering

**Role:** Extend `SiteMap.tsx` to render pack-supplied GeoJSON overlays with toggleable category controls. This is the heaviest component work.

**Files to edit:**
- `C:\Projects\SSTAC-Dashboard\src\components\bn-rrm\map\SiteMap.tsx`
- May need to create: `C:\Projects\SSTAC-Dashboard\src\lib\bn-rrm\map-overlay-helpers.ts` for shared popup formatters, color schemes, etc.

**Dependencies:**
- Agent B must have shipped the `MapArtifactKey` and `MAP_ARTIFACT_CATEGORIES` exports before you can import them. If Agent B has not finished, wait - do not duplicate the types.

**Requirements:**

1. **Load pack map artifacts.** Add a new hook (or extend `usePackArtifact`) that loads GeoJSON files from `packManifest.artifacts.map[key]` relative to the pack base URL. Cache results in the pack store.

2. **Render polygon layers.** Use Leaflet's `L.geoJSON(data, options)` to render polygon layers. Each polygon category gets a distinct fill color and stroke:
   - basins: blue (`#3b82f6`, opacity 0.15 fill, 0.8 stroke)
   - mining: amber (`#f59e0b`)
   - energy: orange (`#ea580c`)
   - permafrost: cyan (`#06b6d4`)
   - Others (point layers) get category colors too.

3. **Render point layers.** For points, use `L.circleMarker` (not default icons - we want category coloring). Radius 5-6px, fill color matches category, stroke white.

4. **Popups.** Each feature gets a popup with a human-readable table of its properties. Use a popup formatter in `map-overlay-helpers.ts` keyed by `MapArtifactKey`. Examples:
   - `advisory_lakes`: bold location, species, then "Adults: X servings/wk, Pregnant: Y servings/wk, Children 5-11: Z servings/wk" with fish size and serving size.
   - `commercial_fisheries`: name, location, species list, quota.
   - `basins_gsl`: "GSL Region: {region}" + area.
   - `communities`: community name, total population, Indigenous breakdown.

5. **Toggleable overlay panel.** The existing SiteMap has a layer control for BC WMS overlays (parks, conservancies, etc.) with category groupings. Extend this panel with a NEW section "Jermilova Study Area" (only visible when the selected pack has `artifacts.map` defined) containing the 8 categories as checkboxes. Each checkbox toggles all layers under that category. Default-on: `basins` only. Default-off: everything else (to keep first-load fast).

6. **Auto-fit viewport.** When a Jermilova pack is selected and basins layer loads, fit the map viewport to the basins bbox with some padding. Use `map.fitBounds(layer.getBounds(), {padding: [40, 40]})`.

7. **Lazy loading.** Do NOT fetch heavy layers (`mineral_claims`, `oil_gas_claims`, `thaw_slumps`) until their category toggle is flipped on. Track load state per layer. Show a small spinner on the toggle while loading.

8. **Pack switch cleanup.** On pack change (`selectedPackId` effect), remove all existing GeoJSON layers from the map. Do not leak layers across pack switches.

9. **Accessibility.** Keep existing keyboard navigation intact. New checkboxes must be focusable and properly labeled.

10. **No regressions.** BC-specific WMS overlays (parks, conservancies) must still work for the general / site-specific packs. The new Jermilova overlay panel should ONLY appear when `packManifest?.artifacts?.map` is defined and non-empty.

**Tests to add:**
- Unit test (vitest): `map-overlay-helpers.test.ts` covering popup formatters for at least 4 of the 12 layer types with representative feature inputs.
- Unit test: Verify that when `packManifest.artifacts.map` is undefined, no Jermilova overlay UI is rendered.

**Do NOT:**
- Modify `packStore.ts` beyond adding a caching method for map artifacts (if needed).
- Modify `pack-types.ts` (that is Agent B's domain).
- Bundle the GeoJSON at build time - it must be fetched at runtime.
- Commit anything.

**Done criteria:** Jermilova pack loaded shows basins by default, other categories toggleable; general pack shows no Jermilova overlays; pack switch is clean (no leaked layers); unit tests pass.

---

### Agent D: Pack Auto-Load on Select

**Role:** Add a `useEffect` in `BNRRMClient.tsx` (or a new dedicated hook) that loads a pack's reference sites (from `site_reports` artifact) into the `siteDataStore` automatically when a pack is selected. This fixes both Jermilova AND the general pack (which currently requires a manual "Import Training Sites" click).

**Files to edit:**
- `C:\Projects\SSTAC-Dashboard\src\app\(dashboard)\bn-rrm\BNRRMClient.tsx`
- May need: `C:\Projects\SSTAC-Dashboard\src\hooks\bn-rrm\useAutoLoadPackSites.ts` (new hook)

**Requirements:**

1. On `selectedPackId` change, clear prior `training` + `comparison` sites from `siteDataStore` (`clearSitesByTag('training')`, `clearSitesByTag('comparison')`).

2. Load the pack's `site_reports` artifact via the pack store.

3. Call `adaptTrainingSites(siteReports)` from `src\lib\bn-rrm\transparency-adapters.ts` and push result into the store.

4. Handle the case where `site_reports` has no valid coordinates (Jermilova's current state - `lat: null, lon: null`). In that case, do NOT call the adapter - log a debug message and skip silently. The Map tab will rely entirely on the new GeoJSON overlay system for Jermilova.

5. Race-condition safety: use a generation counter like `networkStore.loadPackModel` does, so a slow load for pack A does not clobber a fresh load for pack B.

6. Do NOT clear user-uploaded sites (`sourceTag: 'user'`). Those belong to the user and should persist across pack switches.

**Tests to add:**
- Vitest: verify clearing is tag-scoped (user sites preserved, training/comparison cleared).
- Vitest: verify `useEffect` dependency array is correct (no infinite loops).

**Do NOT:**
- Modify the adapters themselves.
- Touch Agent C's work on `SiteMap.tsx`.
- Commit anything.

**Done criteria:** General pack auto-loads its 8 training sites on first open; switching to Jermilova clears them cleanly and does not crash; switching back to general reloads them.

---

### Agent E: Code Review, Tests, and Commit Gate

**Role:** **DO NOT run in parallel with A/B/C/D.** Wait until all four finish, then run sequentially. This agent is the final gate before any commit.

**Tools:** Full toolset - Read, Bash, Grep, Glob, Edit (for fixing issues you find), TaskList.

**Phase 1 - Review (no code changes):**

1. Read every file that A/B/C/D touched or created. Build a mental model of the whole change.

2. **Architectural review:**
   - Is the `MapArtifacts` schema clean and extensible for future packs?
   - Does the overlay toggle UI degrade gracefully for packs without `artifacts.map`?
   - Are there any hardcoded Jermilova-specific assumptions in generic code paths? (There should be none - everything should be driven by the pack manifest.)
   - Does the auto-load hook handle concurrent pack switches correctly?

3. **Code review:**
   - Any `any` types introduced? (Project rule: `any` is banned except where justified with an inline comment.)
   - Any `eslint-disable` directives? Are they justified?
   - Any TODO/FIXME comments? These must be resolved or moved to a tracked issue before commit.
   - Are error paths handled? (Network errors loading GeoJSON, malformed feature, missing artifact key, etc.)
   - Memory leaks: Are Leaflet layers properly removed on unmount and pack switch?
   - Are magic numbers (simplification tolerances, default zoom, colors) extracted to named constants?

4. **Data review:**
   - Spot-check 3 features from each of the 12 GeoJSON files. Verify lat/lon ranges are plausible for the NWT (roughly lat 59 to 70, lon -135 to -100).
   - Verify the `MAP_LAYERS_MANIFEST.json` totals match what ended up on disk.
   - Verify total directory size is under 3 MB.
   - Decode check: grep for literal `\u00e9` or `Metis` misencoding in `communities.geojson`. Flag any mojibake.

5. **UX review:** Start the dev server (`npm run dev` in a background process), open `http://localhost:3000/bn-rrm`, switch between general and Jermilova packs. Confirm:
   - Map tab shows Jermilova basins on first switch
   - Toggles work
   - Pack switch is clean (no ghost layers)
   - General pack Map tab still works (BC overlays, uploaded sites if any)
   - No console errors

   **Kill the dev server** when done. Do not leave orphaned processes. Follow the CLAUDE.md Session End Safety Check.

**Phase 2 - Fix (make minimal surgical edits):**

For every issue found in Phase 1, fix it yourself directly - do not spawn new agents. Keep edits minimal and focused. If an issue is too large to fix (architectural redesign needed), STOP, write a findings report, and return control to the user without committing.

**Phase 3 - Verify (run the full gauntlet):**

Run all of these and report the results verbatim:

```bash
cd /c/Projects/SSTAC-Dashboard

# TypeScript
npx tsc --noEmit --pretty

# ESLint (full codebase, not just changed files)
npx eslint src --max-warnings=0

# Unit tests
npx vitest run

# E2E tests
npx playwright test

# Production build
npm run build
```

**Thresholds:**
- TypeScript: 0 errors.
- ESLint: 0 warnings (there is ONE known pre-existing warning in `ProcessLauncher.tsx` that can be ignored - document it in the report if it is still the only one).
- Unit tests: 690+ tests pass, 0 failures. New tests added by Agent C and Agent D should increase the count.
- E2E tests: 108+ tests pass, 0 failures.
- Production build: succeeds, no webpack errors.

**If any check fails:** Go back to Phase 2 and fix. Do not commit a broken build.

**Phase 4 - Session End Safety Check:**

Before declaring done, run:
```powershell
powershell -Command "Get-Process python -ErrorAction SilentlyContinue"
powershell -Command "Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -eq 'node' }"
```

If any stray `python` or `node` processes are found (not counting Claude Code's own processes), terminate them cleanly. Never kill processes you did not spawn.

**Phase 5 - Commit preparation (do NOT execute the commit):**

Write a proposed commit message to a file at `C:\Projects\SSTAC-Dashboard\.claude\pending-commit-message.txt`:

```
feat(bn-rrm): Jermilova map overlays from FRDR spatial data

Extract 12 feature classes from the Jermilova 2025 FRDR geodatabase
(GSL/GBS sub-basins, advisory lakes, fisheries, mines, oil/gas claims,
hydro facilities, communities, climate stations, thaw slumps) and wire
them into SiteMap as toggleable overlays. Basins default-on, heavy
layers lazy-loaded on toggle. Adds pack-native map artifact schema
(MapArtifacts interface, MAP_ARTIFACT_KEYS, MAP_ARTIFACT_CATEGORIES)
extensible to future packs. Adds auto-load of pack reference sites on
pack select for all packs (fixes manual import requirement).

All source data sourced from:
Jermilova et al. 2025, IEAM 21(2):396-413, doi:10.1093/inteam/vjae011
FRDR dataset: 10.20383/103.0943

Verified: tsc clean, eslint clean, NNN unit tests pass, NNN e2e tests pass,
production build succeeds.
```

Fill in the test counts. Then STOP and return control to the user with a summary of everything done. Do NOT run `git add` or `git commit`. The user approves commits.

**Do NOT:**
- Commit or push.
- Modify CLAUDE.md or memory files.
- Skip any verification step.
- Let any dev server run past end-of-session.

**Done criteria:** All 5 phases complete; every check green; findings report + proposed commit message written; no orphaned processes.

---

## Execution Order

1. Read this entire document. Read `C:\Projects\SSTAC-Dashboard\CLAUDE.md` and `C:\Projects\Regulatory-Review\CLAUDE.md` and absorb their rules. Read `SiteMap.tsx`, `pack-types.ts`, `packStore.ts`, `BNRRMClient.tsx` for current-state grounding.

2. Create a task list (TaskCreate) with 5 tasks for agents A/B/C/D/E.

3. **Launch A, B, C, D in parallel** via the Agent tool (single message, four tool calls). Use `subagent_type: general-purpose` unless a more specific agent matches.

4. Wait for all four to return. Read their summaries carefully. If any of them failed or returned partial work, decide whether to re-launch that specific agent with corrective guidance or escalate to the user.

5. **Launch E sequentially** (single agent call) once A/B/C/D are all green.

6. Review E's report. If everything is green and a commit message is staged, present a final summary to the user and ask for commit approval. Do not commit on your own initiative.

---

## Hard Rules (from CLAUDE.md - do not violate)

- **No em dashes** anywhere in user-facing text, code comments, or docs. Use commas/colons/periods.
- **Plain ASCII only** in docs - no emoji, no smart quotes, no unicode arrows.
- **Dashboard reads `rraa_v3_2.db` directly from `engine\data\`** - never copy the DB.
- **Process safety** - at most 3 background subagents at once; A/B/C/D run in parallel is at the limit, do not spawn more without cleaning up first.
- **Never bypass pre-commit hooks** (`--no-verify` is forbidden).
- **Protected files** - never touch `CLAUDE.md`, `_INDEX.md`, schemas, or the production DB without asking the user.
- **Feedback memory** - the user prefers brief responses and no trailing "here is a summary" blocks. Lead with the answer.

---

## Open Questions for the User (ask before launching if unclear)

None expected - but if Agent A finds fields that differ from the table above (schema drift between my inspection and the actual GDB), stop and flag. Do not silently guess at mappings.

---

## Reference: Existing Conventions

- `src\components\bn-rrm\review\ReviewView.tsx` shows the `HIDDEN_BY_SCOPE` pattern for hiding sections per pack type - reuse that pattern if you need to hide the Jermilova overlay panel for non-Jermilova packs.
- `src\lib\bn-rrm\normalize-artifacts.ts` shows the `isObj()` + `asArray()` helpers used for safe parsing of untyped JSON. Use these if you need to validate GeoJSON at runtime.
- `src\hooks\bn-rrm\usePackArtifact.ts` is the template for any new artifact-loading hook. Do not fetch directly in components.

---

*Handoff author: Claude Code (Opus 4.6), session 2026-04-06*
*Estimated total scope: ~800-1200 lines of TypeScript + 150-line Python extraction script + 12 GeoJSON files*
