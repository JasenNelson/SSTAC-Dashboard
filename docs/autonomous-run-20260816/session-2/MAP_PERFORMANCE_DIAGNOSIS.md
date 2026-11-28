# Interactive Map -- load performance diagnosis (2026-08-16)

Commissioned after the owner reported the map is very slow and suspected inefficient SQL loading.
Read-only investigation; nothing changed. All figures measured, not estimated.

## Headline

**The owner's hypothesis is about one-third right.** The database query is FAST. The dominant
costs are elsewhere.

## Ruled OUT as the bottleneck

- `EXPLAIN ANALYZE` of the RPC's heavy `jsonb_agg` query: **94 ms** (hash join over a 4486-row seq
  scan, plus an external-merge sort spilling 1640 kB from the `ORDER BY`).
- The non-admin hidden-count query with its per-row `has_private_grant` call: **21.5 ms**
  (memoized, 4371 cache hits).
- Total server-side SQL is well under ~200 ms.
- Also ruled out: measurement over-fetch (measurements load only for selected sample ids), the
  bootstrap UCL computation (selection-stats only, off-thread worker), and the sample/aggregate
  filter helpers (Set-based, linear).

## What actually costs, ranked by evidence

1. **The map is paid for on EVERY page load, even when never opened.**
   `src/app/(dashboard)/matrix-options/page.tsx:101` and `:105` await two map fetches during SSR
   before returning any JSX. The default tab is `'The Guide'` (`MatrixDashboard.tsx:348`) and the
   map only renders under `case 'Interactive Map'` (`:1644`). Most visits pay in full and see
   nothing.

2. **Client-side Leaflet marker construction -- likely dominant of the rendering costs.**
   `MatrixMap.tsx:934-1010` loops all 4486 samples and for each EAGERLY builds popup HTML
   (`:974`, builder at `:2158`), builds an SVG divIcon for impacted samples (`:948`), attaches a
   click handler, and calls `addLayer` one at a time (`:1009`). The cluster group is created
   WITHOUT `chunkedLoading` (`:608-612`), so the whole cluster tree builds synchronously on the
   main thread.

3. **An unvirtualized 4486-row React list.** `MatrixMap.tsx:1959` renders one `<button>` per
   sample inside a `max-h-40` scroller, reconciled on every MatrixMap render -- and MatrixMap
   re-renders on every selection/filter/interaction-mode store change (`:450-468`).

4. **3.1 MB payload.** Measured: 4486 qualifying rows x ~715 avg bytes = **3133 KB** of JSON for a
   full-visibility caller. 16 columns, one nested geometry, no joined child data. Real cost, but a
   fraction of items 2 and 3.

5. **O(n^2) selection restyle -- a CLICK-latency bug, not a load bug.**
   `MatrixMap.tsx:1043-1044` runs `markerMapRef.forEach(...)` with
   `sampleMarkers.find((s) => s.id === sampleId)` INSIDE it: 4486 x 4486 ~ **20 million
   comparisons per selection change**, plus `refreshClusters()` at `:1075`.

6. **No caching, and a full rebuild on tab switch.** `dynamic = 'force-dynamic'` +
   `revalidate = 0` (`page.tsx:25-26`); the API route sets `private, no-store`. The map renders
   from a `switch (activeTopTab)`, so leaving and returning UNMOUNTS Leaflet and rebuilds all 4486
   markers and clears selection/filters. Filter changes correctly do NOT hit the server; a
   SELECTION change does issue a new RPC, and pan/zoom at zoom >= 7 issues a viewport query.

## THE QUESTION THAT CHANGES THE ANSWER

**Which account reported the slowness?**

- Admin / full visibility: **4486 rows, 3.1 MB**.
- Ordinary TWG member: only **5 public DRAs / 40 samples, ~28 KB**, because `dras.public = true`
  gates the set.

If an ordinary member finds it slow, data volume is definitively NOT the cause, and the entire
answer is the SSR block plus bundle/Leaflet initialisation. This should be settled before any
optimisation work is scoped.

## Recommended fixes, ranked by impact/effort -- NOT implemented

1. **Highest impact, lowest effort, and correct regardless of which client cost dominates:**
   stop paying for the map when the map is not open. Either `Suspense`-stream the map subtree or
   fetch on first activation of the Interactive Map tab, so the default Guide tab paints
   immediately. Files: `page.tsx`, `MatrixDashboard.tsx`.
2. **High impact, medium effort:** make marker construction non-blocking and the list virtual --
   add `chunkedLoading: true` (+ `chunkInterval`/`chunkDelay`) to the cluster group, bind popups
   LAZILY via `popupopen` instead of eagerly stringifying 4486 of them, and virtualize the sample
   list. File: `MatrixMap.tsx` only (`:608-612`, `:974`, `:1959`).
3. **Medium impact, low effort:** kill the O(n^2) restyle -- build one `Map<id, sample>` once and
   look up by key. File: `MatrixMap.tsx:1041-1076`. Improves click latency more than load.

## Measurement gap -- what would settle it

**No timing instrumentation exists anywhere on this path.** The split between server SQL,
transfer/parse of 3.1 MB, and marker/render work is unmeasured. A `performance.mark`/`measure`
pair around `MatrixMap.tsx:927-1011` and `:1041-1076`, plus a server-side timer around
`page.tsx:101` and `:105`, would settle the ranking in a single load.

Not determinable statically: wire bytes after compression; real RPC latency including Supabase
network hops (the 94 ms is SQL execution inside the DB, not the round trip); how many sequential
paging round trips the site-aggregate fetch makes; and whether the initial `fitBounds`
(`MatrixMap.tsx:1469-1478`) lands at zoom >= 7 and so triggers an immediate second fetch.

## Note on scope

The Interactive Map serves the aquatic/sediment database deliverable. Fix 1 is a genuine UX win
for every visit to the whole Matrix-Options page, not just the map tab -- it is the cheapest
improvement available anywhere on that page.
