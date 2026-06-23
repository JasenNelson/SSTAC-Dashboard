# Matrix-Map: bbox + pagination lane (PREREQUISITE for the 345-site DB2 load)

Status: PLANNED (next concrete task). Authored 2026-06-23 as the prerequisite the Map-2a dataset
investigation (`MAP_2A_DATASET_INVESTIGATION_2026_06_23.md`) + codex consult identified. Plain ASCII.

## Why this comes BEFORE the full data load
The full DB2 dataset is 7562 stations (vs the live 290). The map's read path is province-wide with NO
viewport bounding today, so loading 7562 stations would ship the whole set in one response and render it as
one marker batch -- worst for admins, who bypass `public=false` and therefore receive ALL samples. So:
**land viewport-bounded fetch + pagination/clustering FIRST, then do the full undated load.** Skipping this
order means a province-wide all-samples payload the UI is not built to handle.

Verified current state:
- `matrix_map.fetch_samples_with_hidden_summary(p_bbox)` ACCEPTS `p_bbox` but IGNORES it
  (`supabase/migrations/20260521000002_matrix_map_admin_bypass_fetch_rpc.sql:122`); the v1 contract is
  province-wide (`src/lib/matrix-map/fetch-samples-server.ts:56-61`).
- Admins see all non-deleted DRAs regardless of `public=false`
  (`20260521000002_matrix_map_admin_bypass_fetch_rpc.sql:153`).
- `samples` has `geometry` (geography, GIST index `samples_geom_gist`) + durable `longitude`/`latitude`
  columns; the RPC already builds GeoJSON from longitude/latitude (no PostGIS in the SECDEF projection path).
- Client materializes `visible_samples` into Leaflet markers + clears/recreates marker layers
  (`src/app/(dashboard)/matrix-map/MatrixMap.tsx:305,664`).

## Scope (the lane)
1. **RPC: honor `p_bbox` + bound the result (append-only migration).** Filter samples to the viewport
   (use `longitude`/`latitude` BETWEEN the bbox edges to keep the GeoJSON projection path PostGIS-free, OR
   `geometry && ST_MakeEnvelope(...)` via the GIST index -- pick one and document why). Add a server-side
   row CAP (e.g. N max per fetch) + return a `truncated`/`total_in_bbox` flag so the client can show "zoom
   in to see more". Keep the existing hidden-summary aggregate, but make it bbox-scoped (hidden counts for
   the current viewport). PRESERVE the SECURITY DEFINER owner + the admin-bypass + RLS visibility join
   EXACTLY -- this is a security-sensitive function; do not widen visibility. Supabase MCP is available
   (project-scoped, writes owner-OK + scoped to matrix_map) OR apply via SQL Editor.
2. **Server helper:** thread the real bbox through `fetchMatrixMapSamplesServerSide` (today it hardcodes
   `p_bbox = null`). Initial server render can use a default province bbox or the last-viewport cookie.
3. **Client (`MatrixMap.tsx`):** on Leaflet `moveend`/`zoomend` (DEBOUNCED ~300ms), refetch with the
   current viewport bbox; replace the marker layer with the new viewport set; add marker CLUSTERING
   (leaflet.markercluster or supercluster) for density; surface the "truncated -> zoom in" hint. Avoid a
   refetch storm (debounce + drop in-flight on a newer move).
4. **Budget:** per-viewport fetch should REDUCE `supabase_reads`/`egress_gb` vs province-wide; re-check the
   `budget_caps` math for the pan-heavy case (many small fetches) and set a sane min-zoom for fetching.
5. **Tests:** RPC bbox filtering (in-bbox included / out-of-bbox excluded / cap + truncated flag / hidden
   aggregate scoped); server helper bbox passthrough; client debounced-refetch + cluster render; e2e map
   pan/zoom triggers a bounded refetch.

## Acceptance
With the full 7562-station DB2 dataset loaded in a STAGING/snapshot environment: panning the map fetches
only the viewport's samples (bounded payload), clusters render smoothly, the hidden-summary reflects the
viewport, and an admin no longer pulls all 7562 rows in one response. Then -- and only then -- run the
production full clean reload + `--allow-undated` (snapshot-backed, migration `20260620000001` applied,
ON CONFLICT unique-index preflight).

## Sequencing
bbox/pagination lane (this doc) -> staging validation with the full dataset (or a bounded `--site-ids`
pilot) -> production full undated reload. Do NOT load the full dataset into production before the bbox lane
lands.
