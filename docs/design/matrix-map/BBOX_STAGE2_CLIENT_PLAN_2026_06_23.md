# Matrix-Map bbox Stage 2 -- CLIENT build plan (the real complexity)

Status: PLANNED. Backend is DONE: Stage 1 RPC (#407, migration applied live) + Stage 2a typed helper
(#409, `src/lib/matrix-map/bbox.ts` toRpcBbox + typed `fetchMatrixMapSamplesServerSide`). This doc is
the precise client spec so the UX build can run with a visual-QA loop (browser required). Plain ASCII.

## Why this is a fresh-session / visual-QA task
- It exposes the RPC to BROWSER fetches via a NEW authenticated route (a real security surface).
- It refactors marker rendering + adds a refetch loop in a 1698-line file -- correctness is VISUAL
  (clustering, smooth pan, no refetch storms, no flicker), which needs a real browser to verify.

## Verified integration points (current code)
- `src/app/(dashboard)/matrix-map/MatrixMap.tsx` (1698 lines):
  - props `MatrixMapProps` (line 78): `initialMapData: MatrixMapData`, `fetchErrorMessage`.
  - line 305: `const allSamples = initialMapData.visible_samples;` -- the STATIC source today.
  - line 449: `L.map(...)` map init (inside the load useEffect).
  - marker-render useEffect ~line 665 (codex earlier cited 305 + 664): builds/clears the marker layer
    from `allSamples`.
  - `leaflet` is lazy-loaded into state (`leaflet`, line 271).
- Server fetch today is server-only: `page.tsx` / `matrix-options/page.tsx` call
  `fetchMatrixMapSamplesServerSide(supabase)` (no bbox) and pass `initialMapData` down. There is NO
  client-callable samples endpoint yet (only `/api/matrix-map/export`).
- Deps present: `leaflet.markercluster` ^1.5.3 + `@types/leaflet.markercluster`.

## Build steps
1. **NEW route `src/app/api/matrix-map/samples/route.ts`** (runtime nodejs). GET with query
   `?min_lng&min_lat&max_lng&max_lat` (all optional -> null/province-wide). Build the SSR supabase
   client from cookies (mirror `/api/matrix-map/export/route.ts` lines ~1-160 createServerClient block),
   parse the 4 numbers into a `MatrixMapBbox` (or null), call
   `fetchMatrixMapSamplesServerSide(supabase, bbox)`, return `initialMapData` as JSON (+ the
   fetchErrorMessage as a non-200 only on hard error). Auth is enforced by the RPC's own gate
   (current_user_id + allowlist) + RLS -- but ALSO gate the route to authenticated users (same posture
   as the page). NO CSRF needed for a GET read (export uses POST + checkCsrf; a read GET does not mutate).
   Add a route unit test (mock the helper): bbox params -> forwarded; bad params -> province-wide; auth fail.
2. **MatrixMap.tsx client refetch:**
   - Replace the static `allSamples = initialMapData.visible_samples` with state:
     `const [mapData, setMapData] = useState(initialMapData)` and `const allSamples = mapData.visible_samples`.
   - Add a DEBOUNCED (~300ms) handler bound to Leaflet `moveend` + `zoomend` (in the map-init useEffect,
     line ~449): read `map.getBounds()` -> `{minLng:west,minLat:south,maxLng:east,maxLat:north}` ->
     `toRpcBbox` guards it -> `fetch('/api/matrix-map/samples?...')` -> `setMapData`. Use an
     AbortController to DROP the in-flight request when a newer move arrives (no race / no storm). Guard
     with a MIN ZOOM (skip fetch when zoomed out past a threshold -> keep the province-wide initial set).
   - On `truncated === true` (or `total_in_bbox > returned_sample_count`), show a "zoom in to see all N
     samples" hint banner (the data already carries total_in_bbox / returned_sample_count / truncated).
3. **Clustering:** wrap the markers in `L.markerClusterGroup(...)` (markercluster) instead of a plain
   layer, so 2500 markers render cleanly. Re-bind the existing marker popups/symbology to the cluster
   group. Keep the existing classification/coordinate-tier symbology.
4. **Initial server render:** still passes the province-wide `initialMapData` (null bbox) -- fine as the
   first paint; the first `moveend` after load narrows it. (Optionally seed the server fetch from a
   default BC bbox later; not required for v1.)
5. **budget_caps:** pan-heavy use = many small reads. Confirm the per-fetch min-zoom + debounce keep
   `supabase_reads` / `egress_gb` within `matrix_map.budget_caps`; consider a client-side throttle ceiling.
6. **Tests + e2e:** route unit test; a MatrixMap behavior test for debounce/abort if feasible; an e2e
   that pans/zooms the map and asserts a bounded refetch + the truncated hint. Bump manifest.

## Acceptance (VISUAL QA REQUIRED)
With the live RPC (already deployed) + ideally a larger dataset in staging: panning fetches only the
viewport's samples (Network tab shows one debounced request per settle, in-flight dropped on fast pans),
markers cluster + render smoothly, the truncated hint appears when capped, and an admin no longer pulls
all rows at once. Then the full undated DB2 load (snapshot-gated) becomes safe.

## Security notes (carry the Stage 1 rigor)
- The new GET route makes the RPC browser-reachable. The RPC already auth-gates (current_user_id +
  allowlist) + the visibility predicate + the province-wide hidden_* (no spatial oracle -- see
  feedback_bbox_scoped_private_aggregate_is_a_spatial_oracle). Do NOT add any client-trusted filter that
  bypasses those. codex-review the route hard.
