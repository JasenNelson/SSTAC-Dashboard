-- =====================================================================
-- PR-MAP-2 -- matrix_map.layers seed (4 base tile layers + 14 BC WMS overlays)
-- =====================================================================
--
-- Branch: feat/matrix-map-pr-map-2-map-ui (stacked off
--         feat/matrix-map-pr-map-1-schema)
-- Lane:   Matrix Interactive Map (PR-MAP-2 of PR-MAP-0..PR-MAP-7)
-- Plan:   .tmp_interactive_map_plan_v3.md (v3.4.2 LOCKED; R-7 overlay set,
--         R-11 Jermilova GeoJSON exclusion)
--
-- SCOPE OF THIS FILE:
--   - Seed matrix_map.layers with the 4 base tile layers (streets,
--     satellite, topo, terrain) reusing BN-RRM BASE_LAYERS structure
--   - Seed matrix_map.layers with the 14 BC public WMS overlays reusing
--     BN-RRM OVERLAY_LAYERS structure
--   - Idempotent via ON CONFLICT (key) DO NOTHING (re-apply is a no-op)
--   - Document R-11 Jermilova GeoJSON exclusion as comment-only (NOT
--     seeded; per R-11 "ZERO Jermilova GeoJSON artifacts carry over")
--
-- ATTRIBUTION NOTE: BN-RRM source uses Unicode copyright glyph in
-- attribution strings; this seed transliterates to ASCII `(c)` per the
-- HIGH AUTHORITY cross-project plain-ASCII rule (CLAUDE.md L0 section 1.1
-- + cross_project_no_em_dashes.md). All other fields (key, display name,
-- tile_url, layer name, z_index, category) are 1:1 with the BN-RRM source.
--
-- SOURCE OF TRUTH:
--   - C:/Projects/SSTAC-Dashboard/src/components/bn-rrm/map/SiteMap.tsx
--     BASE_LAYERS constant (lines 74-95): streets, satellite, topo, terrain
--     OVERLAY_LAYERS constant (lines 109-194): 14 BC WMS overlays
--     BC_WMS_URL constant (line 97): https://openmaps.gov.bc.ca/geo/pub/ows
--     BC_ATTR constant (line 100): (c) Province of British Columbia
--
-- OUT OF SCOPE (separate migrations):
--   - layers RLS policies (read-public; admin-only write)
--   - Layer ordering / drag-reorder UI state
--   - Jermilova GeoJSON layers (R-11: explicitly NOT seeded; available_in_
--     matrix_map=false would apply if ever added for BN-RRM only)
--
-- DEPENDENCY:
--   - 20260519000001_matrix_map_schema.sql (matrix_map.layers table)
--
-- PRE-FLIGHT VERIFICATION (run READ-ONLY before applying):
--
--   -- Confirm matrix_map.layers exists with expected columns.
--   SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_schema = 'matrix_map' AND table_name = 'layers'
--   ORDER BY ordinal_position;
--   -- Expected: id, key, display_name, tile_url, wms_layer_name,
--   --   attribution, z_index, default_visible, category,
--   --   available_in_matrix_map, created_at
--
--   -- Confirm layers table is currently empty (first apply).
--   SELECT COUNT(*) FROM matrix_map.layers;
--   -- Expected on first apply: 0
-- =====================================================================

BEGIN;

SET LOCAL search_path = matrix_map, public, pg_catalog;


-- =====================================================================
-- SECTION 1 -- SEED 4 base tile layers (category=base, z_index=0)
-- =====================================================================
-- Reused from BN-RRM SiteMap.tsx BASE_LAYERS (lines 74-95).
-- default_visible=false on ALL base layers: the client-side base-layer
-- toggle picks ONE active base at a time (initial pick is streets per
-- SiteMap.tsx useState default at line 221: activeLayer='streets').
-- Persisting default_visible=false here keeps the DB row honest about
-- "the toggle handles which base is visible at runtime".
--
-- z_index=0 for all base layers: base tiles render at the bottom of the
-- Leaflet pane stack; overlays start at z_index=10 below.

INSERT INTO matrix_map.layers (
  key, display_name, tile_url, wms_layer_name, attribution,
  z_index, default_visible, category, available_in_matrix_map
) VALUES
  (
    'streets',
    'Streets',
    'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    NULL,
    '(c) OpenStreetMap contributors',
    0, false, 'base', true
  ),
  (
    'satellite',
    'Satellite',
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    NULL,
    '(c) Esri',
    0, false, 'base', true
  ),
  (
    'topo',
    'Topographic',
    'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    NULL,
    '(c) OpenTopoMap',
    0, false, 'base', true
  ),
  (
    'terrain',
    'Terrain',
    'https://stamen-tiles.a.ssl.fastly.net/terrain/{z}/{x}/{y}.jpg',
    NULL,
    '(c) Stamen Design',
    0, false, 'base', true
  )
ON CONFLICT (key) DO NOTHING;


-- =====================================================================
-- SECTION 2 -- SEED 14 BC public WMS overlays (category=overlay, z_index 10..23)
-- =====================================================================
-- Reused from BN-RRM SiteMap.tsx OVERLAY_LAYERS (lines 109-194).
-- tile_url = BC_WMS_URL (line 97) = the BC OpenMaps WMS endpoint shared
-- by all overlays. wms_layer_name = the per-layer "layer" field verbatim
-- (carries the "pub:" prefix exactly as the BN-RRM Leaflet WMS client
-- passes it via { layers: def.layer }).
-- attribution = BC_ATTR (line 100) for all 14 overlays.
-- default_visible=false on ALL overlays: user opts in per-layer via the
-- layer menu; the v1 default-on overlay set is a UI concern (not seeded
-- here; matches PR-MAP-1 schema column default).
-- z_index starts at 10 and increments per layer in OVERLAY_LAYERS array
-- order: parks=10, conservancy=11, nationalParks=12, criticalHabitat=13,
-- wildlifeHabitat=14, oldGrowth=15, watersheds=16, wetlands=17,
-- ecoregions=18, bec=19, csrWildlands=20, csrSites=21,
-- bkgdGroundwater=22, emsMonitoring=23.
-- available_in_matrix_map=true for all 14: per the PR-MAP-0 recon all
-- catalogued overlays are matrix-map-appropriate. BN-RRM-only overlays
-- (e.g. Jermilova GeoJSON per R-11; see SECTION 3 comment) would set
-- this column to false but are NOT seeded here.

INSERT INTO matrix_map.layers (
  key, display_name, tile_url, wms_layer_name, attribution,
  z_index, default_visible, category, available_in_matrix_map
) VALUES
  -- protected (R-7 category)
  (
    'parks',
    'Parks & Protected Areas',
    'https://openmaps.gov.bc.ca/geo/pub/ows',
    'pub:WHSE_TANTALIS.TA_PARK_ECORES_PA_SVW',
    '(c) Province of British Columbia',
    10, false, 'overlay', true
  ),
  (
    'conservancy',
    'Conservancy Areas',
    'https://openmaps.gov.bc.ca/geo/pub/ows',
    'pub:WHSE_TANTALIS.TA_CONSERVANCY_AREAS_SVW',
    '(c) Province of British Columbia',
    11, false, 'overlay', true
  ),
  (
    'nationalParks',
    'National Parks (BC)',
    'https://openmaps.gov.bc.ca/geo/pub/ows',
    'pub:WHSE_ADMIN_BOUNDARIES.CLAB_NATIONAL_PARKS',
    '(c) Province of British Columbia',
    12, false, 'overlay', true
  ),
  (
    'criticalHabitat',
    'Critical Habitat (SARA)',
    'https://openmaps.gov.bc.ca/geo/pub/ows',
    'pub:WHSE_WILDLIFE_MANAGEMENT.WCP_CRITICAL_HABITAT_SP',
    '(c) Province of British Columbia',
    13, false, 'overlay', true
  ),
  (
    'wildlifeHabitat',
    'Wildlife Habitat Areas',
    'https://openmaps.gov.bc.ca/geo/pub/ows',
    'pub:WHSE_WILDLIFE_MANAGEMENT.WCP_WILDLIFE_HABITAT_AREA_POLY',
    '(c) Province of British Columbia',
    14, false, 'overlay', true
  ),
  -- ecology (R-7 category)
  (
    'oldGrowth',
    'Old Growth Forests',
    'https://openmaps.gov.bc.ca/geo/pub/ows',
    'pub:WHSE_FOREST_VEGETATION.OGSR_TAP_OG_FORESTS_SP',
    '(c) Province of British Columbia',
    15, false, 'overlay', true
  ),
  -- aquatic (R-7 category)
  (
    'watersheds',
    'Watersheds',
    'https://openmaps.gov.bc.ca/geo/pub/ows',
    'pub:WHSE_BASEMAPPING.FWA_ASSESSMENT_WATERSHEDS_POLY',
    '(c) Province of British Columbia',
    16, false, 'overlay', true
  ),
  (
    'wetlands',
    'Wetlands',
    'https://openmaps.gov.bc.ca/geo/pub/ows',
    'pub:WHSE_BASEMAPPING.FWA_WETLANDS_POLY',
    '(c) Province of British Columbia',
    17, false, 'overlay', true
  ),
  -- ecology (R-7 category)
  (
    'ecoregions',
    'Freshwater Ecoregions',
    'https://openmaps.gov.bc.ca/geo/pub/ows',
    'pub:WHSE_LAND_AND_NATURAL_RESOURCE.EAUBC_ECOREGIONS_SP',
    '(c) Province of British Columbia',
    18, false, 'overlay', true
  ),
  (
    'bec',
    'Biogeoclimatic Zones',
    'https://openmaps.gov.bc.ca/geo/pub/ows',
    'pub:WHSE_FOREST_VEGETATION.BEC_BIOGEOCLIMATIC_POLY',
    '(c) Province of British Columbia',
    19, false, 'overlay', true
  ),
  -- regulatory (R-7 category)
  (
    'csrWildlands',
    'CSR Natural Wildlands',
    'https://openmaps.gov.bc.ca/geo/pub/ows',
    'pub:WHSE_ENVIRONMENT_ASSESSMENT.CSR_NATURAL_WILDLANDS_SP',
    '(c) Province of British Columbia',
    20, false, 'overlay', true
  ),
  -- waste (R-7 category)
  (
    'csrSites',
    'Contaminated Sites Registry',
    'https://openmaps.gov.bc.ca/geo/pub/ows',
    'pub:WHSE_WASTE.SITE_ENV_RMDTN_SITES_SVW',
    '(c) Province of British Columbia',
    21, false, 'overlay', true
  ),
  (
    'bkgdGroundwater',
    'Background Groundwater Concentration Regions',
    'https://openmaps.gov.bc.ca/geo/pub/ows',
    'pub:WHSE_WASTE.CSR_BKGD_GRNDWTR_CONC_AREAS_SP',
    '(c) Province of British Columbia',
    22, false, 'overlay', true
  ),
  (
    'emsMonitoring',
    'Environmental Monitoring Locations',
    'https://openmaps.gov.bc.ca/geo/pub/ows',
    'pub:WHSE_ENVIRONMENTAL_MONITORING.EMS_MONITORING_LOCN_TYPES_SVW',
    '(c) Province of British Columbia',
    23, false, 'overlay', true
  )
ON CONFLICT (key) DO NOTHING;


-- =====================================================================
-- SECTION 3 -- R-11 Jermilova GeoJSON exclusion (comment-only documentation)
-- =====================================================================
-- Per R-11 ("ZERO Jermilova GeoJSON artifacts carry over"): the BN-RRM
-- pack-supplied GeoJSON overlays (basins_gsl, jermilova_*, etc. wired
-- through src/lib/bn-rrm/map-overlay-helpers.ts MAP_ARTIFACT_KEYS) are
-- NOT seeded into matrix_map.layers. These artifacts live in BN-RRM
-- pack manifests and are loaded via packStore + loadMapArtifact, not
-- via the matrix_map.layers catalog.
--
-- If a future cross-lane need ever calls for surfacing them in this
-- catalog (e.g. a shared layer-picker), they MUST be inserted with
-- available_in_matrix_map=false to honor R-11. The matrix-map UI must
-- filter on available_in_matrix_map=true so any such future row stays
-- hidden from this lane by default.
--
-- No INSERT is emitted for Jermilova GeoJSON layers by design.


COMMIT;


-- =====================================================================
-- VERIFICATION (run READ-ONLY after apply):
--
--   -- 1. Total row count = 18 (4 base + 14 overlays)
--   SELECT COUNT(*) FROM matrix_map.layers;
--   -- Expected: 18
--
--   -- 2. Per-category breakdown
--   SELECT category, COUNT(*) FROM matrix_map.layers
--   GROUP BY category ORDER BY category;
--   -- Expected: base=4, overlay=14
--
--   -- 3. All 14 overlay keys present in expected order
--   SELECT key, z_index FROM matrix_map.layers
--   WHERE category = 'overlay' ORDER BY z_index;
--   -- Expected 14 rows in this order:
--   --   parks            (z=10)
--   --   conservancy      (z=11)
--   --   nationalParks    (z=12)
--   --   criticalHabitat  (z=13)
--   --   wildlifeHabitat  (z=14)
--   --   oldGrowth        (z=15)
--   --   watersheds       (z=16)
--   --   wetlands         (z=17)
--   --   ecoregions       (z=18)
--   --   bec              (z=19)
--   --   csrWildlands     (z=20)
--   --   csrSites         (z=21)
--   --   bkgdGroundwater  (z=22)
--   --   emsMonitoring    (z=23)
--
--   -- 4. All 4 base keys present at z_index=0
--   SELECT key, default_visible FROM matrix_map.layers
--   WHERE category = 'base' ORDER BY key;
--   -- Expected 4 rows: satellite, streets, terrain, topo
--   -- All default_visible = false (client toggle picks one at runtime)
--
--   -- 5. All rows are available_in_matrix_map=true (R-11 Jermilova
--   --    GeoJSON layers NOT in this catalog at all; see SECTION 3 comment)
--   SELECT COUNT(*) FROM matrix_map.layers
--   WHERE available_in_matrix_map = true;
--   -- Expected: 18
--
--   -- 6. WMS overlays all share BC OpenMaps endpoint + attribution
--   SELECT DISTINCT tile_url, attribution FROM matrix_map.layers
--   WHERE category = 'overlay';
--   -- Expected 1 row:
--   --   tile_url=https://openmaps.gov.bc.ca/geo/pub/ows
--   --   attribution=(c) Province of British Columbia
-- =====================================================================
