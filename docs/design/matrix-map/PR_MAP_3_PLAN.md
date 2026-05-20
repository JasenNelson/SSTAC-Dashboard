# PR-MAP-3 -- Sample Rendering + Identify + Partial-Visibility Banner (DESIGN)

**Status:** DRAFT design doc; owner review pending before any
implementation begins. Authored 2026-05-19 EOS as overnight design
artifact after PR-MAP-2 skeleton (`MatrixMap.tsx`) + PR-MAP-1 schema +
RLS landed, and PR-MAP-0 geocoding (40 -> 290 mappable stations) was
approved.

**Supersedes:** none (new file).

**Companion artifacts:**
- [[PLAN_V3_4_2]] -- canonical plan v3.4.2 LOCKED (section 7 PR-MAP-3 row)
- [[PRIVATE_GRANTS_DESIGN_V2_3]] -- grants v2.3 (codex D-1 partial-visibility banner contract)
- [[INVENTORY_AND_RECOMMENDATIONS_V2]] -- R-1..R-14 dispositioned residuals
- [[PR_MAP_0_GEOCODING_REPORT_V1]] -- coverage report (~290 samples; 7 BC regions)
- Memory anchor: [[dashboard_matrix_interactive_map_lane_2026_05_19]]

**Reference files read while authoring:**
- `src/app/(dashboard)/matrix-map/MatrixMap.tsx` -- PR-MAP-2 skeleton this PR extends
- `src/app/(dashboard)/matrix-map/MatrixMapLoader.tsx` -- next/dynamic ssr:false wrapper
- `src/app/(dashboard)/matrix-map/page.tsx` -- server component auth + allowlist gate
- `src/lib/maps/wms-identify.ts` -- hoisted WMS GetFeatureInfo helper library (PR-MAP-2)
- `src/components/bn-rrm/map/SiteMap.tsx` -- existing sample rendering + identify patterns to mirror
- `supabase/migrations/20260519000001_matrix_map_schema.sql` -- samples / sample_events / measurements / dras tables + indexes
- `supabase/migrations/20260519000002_matrix_map_rls.sql` -- RLS policies cascading through `source_dra_id`

**Plain ASCII only.** No em-dashes, no Unicode arrows, no smart quotes.
Literal `--` and `->`. Per L0 `C:\Projects\CLAUDE.md` section 1.1.

---

## 1. Purpose + scope summary

PR-MAP-3 lifts the empty PR-MAP-2 map skeleton into a population-aware
sample-rendering surface. After this PR, an allowlisted reviewer who
loads `/matrix-map` sees the ~290 geocoded sample stations from
`matrix_map.samples` rendered as clustered Leaflet circle markers,
with classification + coordinate-quality coding visible at a glance.
They can click any sample point to identify its station-level metadata,
DRA provenance, and classification rationale. They can ALSO click on a
BC public WMS overlay (the existing PR-MAP-2 surface, which already
supports `bkgdGroundwater`, `csrSites`, etc.) to identify overlay
features -- the two identify code paths share the hoisted
`src/lib/maps/wms-identify.ts` library where appropriate but otherwise
remain independent.

PR-MAP-3 also adds the **reviewer-side partial-visibility banner**
specified in [[PRIVATE_GRANTS_DESIGN_V2_3]] section 4.5 (codex grants
v1 D-1 + v2 C-2 nit). When the reviewer's current map viewport contains
samples in private DRAs they do NOT hold grants for, a banner surfaces
the aggregate counts (`Visible: N samples; Hidden: M samples in X
private DRAs you don't have access to`) with NO row identifiers leaked.
Samples first render in this PR so the banner ships here per the codex
v2-round C-2 nit; PR-MAP-4 layers selection on top without changing the
banner contract.

What this PR does NOT add (intentional deferral):

- **Selection state model.** No `SelectionStore` Zustand store; no
  point-select, area-select, or shift+click selection transitions. The
  marker `selected=true` blue-stroke visual from [[PLAN_V3_4_2]] section
  3.3 lands in PR-MAP-4. PR-MAP-3 markers only have classification +
  coordinate-tier visual state.
- **Selection Stats panel** (left panel State B). Plan section 3.5
  describes UTL / provincial-background / site-specific-background
  stats -- those land in PR-MAP-4 AFTER the R-13 methodology appendix
  sign-off gate. PR-MAP-3 SHIPS the sample rendering but does NOT ship
  any statistical computation.
- **MeasurementWorkbench right panel.** Plan section 3.6. Lands in
  PR-MAP-5.
- **Calculator bridge + audit token.** Plan section 3.7 + section 5.
  Lands in PR-MAP-6.
- **`identify-area` tool** (drag-rectangle WFS GetFeature against
  active overlays). The BN-RRM SiteMap supports it; the matrix-map
  scope per plan section 3.2 includes 5 tools, but PR-MAP-3 ONLY adds
  `identify-single`. The `identify-area` tool lands in PR-MAP-4 with
  the broader selection-tool toolbar.
- **Admin grants UI.** PR-MAP-7 (parallel; not gating).

The reviewer-visible result of PR-MAP-3 is a populated map with
classification + coordinate-tier-coded clustered markers, identify on
single-click for both samples and overlays, and an honest banner about
hidden private-DRA samples when the viewport hides any.

## 2. Data access pattern

### 2.1 Where the query runs

Per [[PLAN_V3_4_2]] section 4.3 + the RLS migration
`20260519000002_matrix_map_rls.sql` SECTION 5.b: the
`samples_authenticated_select` policy gates reads via the email-
allowlist helper + the cascade-through-`source_dra_id` predicate
`(dras.public = true OR has_private_grant(dras.id)) AND
is_deleted = false`. The frontend never bypasses RLS; it queries
through PostgREST as the authenticated user and the policy does the
filtering.

The page.tsx server component already does the dashboard-allowlist gate
(any `user_roles` row). The actual sample fetch happens client-side via
the existing `@supabase/ssr` browser client created inside the matrix
map shell, OR via a server action exposed by `page.tsx` that returns
the initial sample payload as a server-side prop. The owner morning
decision (see section 10 Q-1) is which of these to pick; the design
below assumes the **server-side fetch** path because (a) initial paint
benefits from inline JSON over a client round-trip, (b) the partial-
visibility banner aggregate count is most defensible when computed in
the SAME query that returns visible rows (no client-side race between
two queries with different RLS snapshots).

### 2.2 Query shape (PostgREST or RPC)

Per [[PLAN_V3_4_2]] section 4.3.1: RLS is set up to filter samples
correctly. The fetch needs three pieces:

1. **Visible samples** -- the rows the reviewer is allowed to see, with
   the fields the map needs.
2. **Hidden-sample aggregate** -- counts of `(samples that exist but
   are not visible)`, grouped by `(source_dra_id)` so the banner can
   show "M samples in X private DRAs you don't have access to".
3. **Hidden-DRA-IDs ONLY** -- per grants v2 section 4.5 the banner
   surfaces the count of private DRAs but NOT their titles. The DRA
   IDs are returned as opaque UUIDs to support the "Contact admin to
   request access" link target.

Because RLS strips hidden rows from `SELECT * FROM matrix_map.samples`
entirely, the aggregate-of-hidden cannot be computed against the
authenticated-user RLS surface. Two options for owner morning:

- **Option A (recommended):** ship a `SECURITY DEFINER` RPC
  `matrix_map.fetch_samples_with_hidden_summary()` that the
  frontend calls. The RPC body runs as `matrix_map_owner` (BYPASSRLS
  per migration), runs a single query that returns BOTH the
  authorized-visible rows (filtered via the SAME predicate as the
  RLS policy) AND the hidden aggregate. Caller auth is enforced
  inside the RPC body via `auth.uid()` + `is_email_allowlisted(auth.jwt())`,
  matching `flip_dra_public`'s pattern. The RPC body is responsible
  for re-evaluating the visibility predicate, so its return contract
  is the SINGLE source of truth for "visible vs hidden".
- **Option B:** two separate calls -- one normal PostgREST `select`
  on `matrix_map.samples` (RLS does the filter), one
  `matrix_map.count_hidden_samples_in_viewport(bbox)` SECURITY DEFINER
  RPC for the aggregate. Two trips; risk of inconsistent snapshots if
  someone flips a DRA between them.

**Recommendation:** Option A. The cost is one new RPC + one new
verification gate; the win is a single coherent query payload. The
RPC also gives us a natural place to attach a `data_snapshot_version`
token for the eventual PR-MAP-6 audit-token bridge.

### 2.3 Pagination + viewport handling

Post-ETL row count = ~290 samples (per
[[PR_MAP_0_GEOCODING_REPORT_V1]]). Initial v1 returns ALL samples in
one payload; province-wide bbox is the default + we already have the
data shape. Pagination is NOT needed at this row count -- the cluster
marker handles 290 points without UI degradation in the BN-RRM
SiteMap reference (which handles similar counts).

The hidden-sample aggregate is province-wide for v1 (not viewport-
scoped), because the reviewer's mental model of "samples I cannot see"
is per-dataset, not per-pan. A viewport-scoped variant is deferable to
v1.x if HITL feedback says otherwise.

If the row count grows past ~1500 in v1.x (when BC EMS scale-up
lands), a bbox-scoped query becomes mandatory. The RPC contract above
should already accept an optional `bbox geography(Polygon, 4326)`
parameter so the v1.x switch is non-breaking.

### 2.4 Columns to project

Per `matrix_map.samples` schema:

```
id (uuid)
display_name (text)
geometry (geography(Point, 4326)) -- converted to lat/lng on the wire
classification (text: 'reference' | 'impacted' | 'unknown')
classification_source (text: 'station_type' | 'steward' | 'data_unknown' | 'bkgd_groundwater')
classification_rationale (text, nullable)
classification_confidence (text: 'high' | 'medium' | 'low', nullable)
coordinate_quality_tier (text: 'high' | 'medium' | 'low')
coordinate_source (text: 'surveyed' | 'bc_csr_centroid' | 'manual_steward' | ...)
bc_region (text, nullable)
waterbody (text, nullable)
waterbody_type (text, nullable)
source_dra_id (uuid, nullable)
```

Joined columns from `matrix_map.dras` (via FK):

```
dras.title (text)
dras.citation (text)
dras.year (integer)
dras.agency (text)
dras.public (boolean) -- needed so the identify panel can flag private samples
```

`dras.document_url` and `dras.confidentiality_notes` are NOT projected
in the bulk fetch; the identify panel can fetch them on demand via a
separate scoped RPC if owner decides identify needs them (open
question Q-2 section 10).

NOT projected: `measurements`. PR-MAP-3 sample-identify shows the
station-level row only. Per-substance measurement detail is part of
the MeasurementWorkbench in PR-MAP-5; including measurements here
would over-scope the payload and confuse the identify-vs-workbench
boundary.

The geometry column is returned as a `[lng, lat]` pair via PostGIS
`ST_X(geometry::geometry) AS lng, ST_Y(geometry::geometry) AS lat`
inside the RPC body so the frontend never needs to parse WKB or WKT.

### 2.5 Caching

No client-side caching in v1. The fetch fires once on mount of
`MatrixMap.tsx` (via `useEffect`) and again only on explicit refresh
trigger (see section 5.4 banner refresh). Per R-6 budget breaker, the
RPC increments the `supabase_reads` dimension once per call.

## 3. Sample rendering

### 3.1 leaflet.markercluster integration

The BN-RRM `SiteMap.tsx:343-365` already wires `leaflet.markercluster`
with a custom `iconCreateFunction`. PR-MAP-3 follows the same pattern:

- Dynamic import inside the existing `MatrixMap.tsx` map-init effect
  (which does not exist yet -- PR-MAP-2 uses static react-leaflet
  components; PR-MAP-3 introduces a thin imperative layer for cluster
  + markers because react-leaflet has no first-class cluster
  primitive).
- `maxClusterRadius: 50` (matches BN-RRM).
- `spiderfyOnMaxZoom: true`, `showCoverageOnHover: false`,
  `zoomToBoundsOnClick: true`.
- Cluster icon shows the classification mix as a small inline pie /
  segmented disc -- BN-RRM uses a simple count number; matrix-map adds
  classification breakdown via 3 small colored arcs (green / yellow /
  grey) around a numeric count. Implementation: SVG `divIcon`.

Selection badge ("{selected}/{total}") per plan section 3.3 is
DEFERRED to PR-MAP-4 because PR-MAP-3 has no selection. The
`iconCreateFunction` will accept a `selectedCount` argument but pass 0
in this PR; PR-MAP-4 lifts the argument source.

### 3.2 Marker symbology -- 9 visual states (3 classifications x 3 coordinate tiers)

Per plan section 3.3 + R-7 + R-11:

| Classification | Shape | Color | Outline (high coord) | Outline (medium coord) | Outline (low coord) |
| --- | --- | --- | --- | --- | --- |
| reference | filled circle | green `#10b981` | solid 2px | dashed 2px | dotted 2px |
| impacted | filled triangle | yellow `#eab308` | solid 2px | dashed 2px | dotted 2px |
| unknown | hollow circle | grey `#94a3b8` | solid 2px | dashed 2px | dotted 2px |

All 9 combinations rendered. Marker radius: 8px (smaller than BN-RRM's
12-14px because density is higher and clustering compensates). Hover:
add 1px white outer ring for hit-test feedback. Cursor: pointer when
hovering a marker; default when over empty map.

Hollow circle for unknown = `fillOpacity: 0`, `weight: 2`. Triangle
shape requires `L.divIcon` with inline SVG path (Leaflet's built-in
markers are circle / square only). Pattern: a single
`createSampleIcon(classification, coordTier)` helper returning a
`L.divIcon` with the right SVG content + outline style.

`L.divIcon` is preferable to `L.circleMarker` here because the
triangle shape requires SVG. Using divIcon uniformly across all 3
classifications keeps the marker creation path consistent.

Per R-11: the coordinate-quality outline carries an accompanying
popup tooltip on hover OR on click for `medium` / `low` tiers --
`Coordinate from BC Site Registry centroid (not surveyed).` for
medium, `Coordinate is manually steward-filled (low precision).` for
low. (For `high`, no tooltip; surveyed is the default.)

Coordinate-tier-outline rendering REQUIRES `L.divIcon` because Leaflet
`L.circleMarker` does not support dashed/dotted strokes via the public
API. The SVG `stroke-dasharray` controls outline style.

### 3.3 Legend UI

A new collapsible legend card in the left rail, below the existing BC
public overlays panel from PR-MAP-2. Header: `Sample legend`.
Contents:

- Section 1 `Classification`: 3 rows showing the green-circle /
  yellow-triangle / grey-hollow-circle swatches with their label.
- Section 2 `Coordinate quality`: 3 rows showing solid / dashed /
  dotted outline (rendered against a neutral circle) with their label
  and the R-11 tooltip text inline.
- Section 3 `Selection (PR-MAP-4)`: PLACEHOLDER row noting the blue-
  stroke selected-marker state lands in PR-MAP-4; greyed out.

Legend defaults to collapsed once a reviewer has dismissed it once
(localStorage key `matrix-map.legend.collapsed=true`). Per L0
plain-ASCII rule, no fancy glyphs.

### 3.4 Clustering thresholds

`maxClusterRadius: 50` from BN-RRM. With 290 markers across 7 BC
regions + 9 sites, expected cluster density at zoom 5 (province view)
is ~9-10 visible clusters representing the 9 sites + 7 regions. At
zoom 10 (regional view) clusters break down to per-site. At zoom 14
individual markers appear.

No additional tuning at 290 row count. If the v1.x BC EMS scale-up
pushes count past 1500, re-evaluate -- BN-RRM tests cluster behavior
at similar scale and is known to work.

## 4. Identify tool wiring

### 4.1 Two distinct identify code paths

**Sample-identify** (NEW; PR-MAP-3 surface):
- Click a sample marker -> open a popup OR side panel with the
  station-level row from `matrix_map.samples` + joined `dras` row.
- Pure frontend; no network request (data is already in the cached
  sample payload from the initial RPC fetch).
- Per-marker click handler on the divIcon, similar to BN-RRM
  `SiteMap.tsx:752-769` marker click pattern.

**Overlay-identify** (HOISTED from PR-MAP-2):
- Click on empty map space (away from any sample marker) -> existing
  WMS GetFeatureInfo against any active BC overlay (parks,
  conservancy, csrSites, bkgdGroundwater, emsMonitoring, etc.) using
  the existing `src/lib/maps/wms-identify.ts` library that was
  hoisted in PR-MAP-2.
- Network request (one parallel `fetch` per active overlay through
  the BC WMS proxy at `/api/bn-rrm/wms-identify`).
- Reuses `queryActiveOverlays` from `wms-identify.ts` + the
  `getActiveOverlaysInZOrder` resolver.

PR-MAP-3 wires BOTH; both live inside the map's single `identify`
mode toggle. When a click happens in identify mode:

1. Check if the click is on (or close to, within ~10px) a sample
   marker -- the `markerMap` data structure (key = sample.id, value =
   Leaflet layer reference) is iterated and `L.point` proximity tested.
2. If sample hit: run sample-identify, populate the panel/popup from
   the cached payload, RETURN -- do NOT also fire overlay-identify.
   The "topmost wins" rule from BN-RRM SiteMap identify (sample
   markers are visually atop overlays).
3. If no sample hit: run overlay-identify via `queryActiveOverlays`
   against the active WMS overlays, populate the panel from results.

The single `runIdentify(latlng, sampleHit | null)` function is the
single authoritative writer to the identify-panel state (mirrors
BN-RRM `runIdentifyRef` pattern).

### 4.2 Sample-identify panel contents

A new left-panel state appears when a sample is identified (replaces
the per-overlay identified-features list when sample is the hit):

```
SAMPLE IDENTIFIED

Station: <display_name>
ID: <station_id>
Classification: <classification>  (<classification_source>)
Confidence: <classification_confidence | "not set">
Coordinate quality: <coordinate_quality_tier>
Coordinate source: <coordinate_source>
BC region: <bc_region | "not set">
Waterbody: <waterbody | "not set"> (<waterbody_type | "n/a">)

Classification rationale:
  <classification_rationale | "no rationale recorded">

Source DRA:
  <dras.title>
  <dras.agency> (<dras.year>)
  Citation: <dras.citation>
  Public: <dras.public ? "Yes" : "No (private; access granted to you)">

[Close]
```

If `source_dra_id` is null (rare per schema COMMENT but allowed), show
"Source DRA: not recorded" + flag for steward review. If the joined
DRA row is `public=false`, the badge `(private; access granted to
you)` makes it clear the row is being shown via a grant (not via
overall public visibility). This is informational, not a security
boundary -- RLS already only returns rows the user can see.

### 4.3 Overlay-identify panel contents

Unchanged from BN-RRM SiteMap pattern + plan section 3.5 State A.
Reuses `formatIdentifyPopupHtml` from BN-RRM where possible (it lives
in `src/lib/bn-rrm/map-overlay-helpers.ts` today; PR-MAP-3 either
imports it directly or hoists it to a neutral location alongside
wms-identify.ts -- recommend hoist to keep the new
`/lib/maps/identify-format.ts` siblings clean). Owner morning Q-3.

### 4.4 Single-vs-side-panel placement

BN-RRM SiteMap pattern uses a popup ON the map at the click latlng
PLUS a side-panel feature list. PR-MAP-3 should mirror: popup at the
click point for the immediate snapshot (one-line summary), full
detail in the left-panel SAMPLE IDENTIFIED card. Reasoning: popups
are good for "tell me what this thing is" instant feedback; the side
panel is good for sustained reading + future "Add to selection"
actions in PR-MAP-4.

Trade-off: this doubles the rendering surface. Mitigation: keep the
popup short (just station_id + classification + DRA short citation).

Open Q-4 section 10: owner picks modal-popup vs side-panel-only vs
both. Recommendation = both (BN-RRM consistency).

### 4.5 Sample-identify performance

No network. 290 samples cached; marker -> sample.id lookup is O(290)
worst case via a `Map<string, Sample>` indexed by id. Hit-test against
mouse latlng is O(290) but the bounding-box prefilter (zoom + viewport)
collapses the iteration to ~10-30 in practice. No perf concern at v1
scale.

## 5. Partial-visibility banner

### 5.1 Trigger

The banner renders whenever the RPC's `hidden_sample_count > 0`. The
RPC is called on mount and on the explicit refresh trigger (see 5.4).
Per [[PRIVATE_GRANTS_DESIGN_V2_3]] section 4.5: banner suppresses
when `hidden = 0`.

### 5.2 Server-side payload

The RPC `matrix_map.fetch_samples_with_hidden_summary()` returns a
JSON payload like:

```
{
  "visible_samples": [ { id, display_name, lat, lng, classification, ... }, ... ],
  "hidden_sample_count": <integer>,
  "hidden_dra_count": <integer>,
  "hidden_dra_ids": [ <uuid>, ... ],   -- IDs only; no titles per D-1
  "data_snapshot_version": "<text>",   -- e.g. "matrix_map@2026-05-19T22:00:00Z"
  "computed_at": "<timestamptz>"
}
```

`hidden_dra_ids` contains EXACTLY the DRA UUIDs the user is missing
access to. Per grants v2.3 codex D-1 + the design rule from
INVENTORY R-10: NO `title` / `citation` / `agency` for hidden DRAs is
returned; that would leak metadata about content the user has no
grant for. The IDs alone enable the `[Contact admin to request
access]` link to point at a stable identifier for the admin to act on.

Implementation note: the RPC has visibility of BOTH the visible and
hidden DRA sets because it bypasses RLS (BYPASSRLS owner pattern).
Without that, the same query against RLS would silently strip the
hidden rows + we'd have no way to count them. This is also why option
A (RPC) beats option B (two-call) in section 2.2: option B's second
call also needs SECURITY DEFINER, so we'd need the RPC anyway.

### 5.3 UI placement

Floating banner at the top of the map area, below the PR-MAP-2 base-
layer toolbar. Slate-100 background, dark-amber accent border (per
grants v2 styling convention), close button on the right (X). Banner
contents per grants v2 section 4.5 mock:

```
+------------------------------------------------------------------+
|  Visible: 142 samples (15 reference, 99 impacted, 28 unknown)    |
|  Hidden: 23 samples in 2 private DRAs you don't have access to.  |
|  [Contact admin to request access]   [Learn about DRA            |
|                                       confidentiality]  [X]      |
+------------------------------------------------------------------+
```

The composition breakdown ("15 reference, 99 impacted, 28 unknown")
is computed CLIENT-SIDE from the `visible_samples` array (cheap +
deterministic; matches what the user sees on the map). The hidden
counts are SERVER-SIDE only (the client cannot see them otherwise).

`[Contact admin to request access]` link target: open a mailto: URL to
the matrix_admin contact (`MATRIX_ADMIN_CONTACT_EMAIL` env var or
similar) pre-populated with the hidden_dra_ids in the body. Owner
morning Q-5.

`[Learn about DRA confidentiality]` link target: open the methodology
appendix section anchored at the EMA s.43 anchor (plan v3 section 5
item 8). Internal anchor URL.

If `[X]` is clicked, the banner dismisses for the current session
(non-persistent; reappears on reload). This is intentional -- we want
the reviewer to be reminded of the hidden samples on each session, not
to suppress them permanently.

### 5.4 Refresh trigger

Per grants v2 the banner can refresh when:
- The reviewer toggles overlays (no -- the banner is about samples,
  not overlays; overlay toggles do not change visibility);
- The reviewer pans / zooms (no in v1, per 2.3 the count is province-
  wide; v1.x can revisit if viewport-scoped);
- An admin grants the reviewer new access mid-session (yes -- the
  count must drop; ship an explicit `[Refresh]` button on the banner
  to trigger a re-call of the RPC. Auto-refresh-on-focus is OUT OF
  SCOPE for v1 because it adds an event hook + a budget-breaker cost
  every time the user alt-tabs back to the dashboard).

So: explicit `[Refresh]` button next to `[X]`. One supabase_reads
increment per click.

## 6. State + component shape

### 6.1 Component tree change vs PR-MAP-2

```
MatrixMapPage (server component; UNCHANGED)
  -> MatrixMapLoader (client component; UNCHANGED)
       -> MatrixMap (client component; CHANGED)
            -- existing state from PR-MAP-2:
                 baseLayer: BaseLayerKey
                 visibleOverlays: Set<string>
                 panelExpanded: boolean
            -- NEW state for PR-MAP-3:
                 samples: VisibleSample[] | null   -- from RPC; null=loading
                 hidden: HiddenSummary | null
                 fetchError: string | null
                 fetchStatus: 'idle' | 'loading' | 'success' | 'error'
                 interactionMode: 'pan' | 'identify'   -- v1 simpler than BN-RRM
                 identifiedSample: VisibleSample | null
                 identifiedOverlayFeatures: IdentifiedFeature[]
                 legendCollapsed: boolean
                 bannerDismissed: boolean
            -- NEW imperative refs (mirrors BN-RRM SiteMap pattern):
                 mapRef: leaflet.Map | null
                 markersLayerRef: leaflet.MarkerClusterGroup | null
                 markerMapRef: Map<uuid, leaflet.Layer>
                 identifyPopupRef: leaflet.Popup | null
                 interactionModeRef: typeof interactionMode (for handler closures)
                 runIdentifyRef: typeof runIdentify | null
                 identifyRequestIdRef: number (stale-response guard)
```

### 6.2 New components introduced

Beyond the changes inside `MatrixMap.tsx`, PR-MAP-3 ships these new
sub-components in `src/components/matrix-map/`:

- `SampleLegend.tsx` -- the 3-section legend card (section 3.3).
- `PartialVisibilityBanner.tsx` -- the banner per section 5.3.
- `SampleIdentifyPanel.tsx` -- the identify-result side panel (3-4
  modes: idle / loading / sample-hit / overlay-hits).
- `MarkerIcons.tsx` -- the `createSampleIcon(classification, tier,
  selected)` factory returning `L.divIcon` configurations.

PR-MAP-3 also adds these new library modules:

- `src/lib/maps/sample-identify.ts` -- proximity hit-test +
  identify-panel data shaping (mirrors `wms-identify.ts` but for
  sample-side hits; intentionally a separate module from
  `wms-identify.ts` because the two have very different data flows --
  WMS is network + parallel; sample is local + sync).
- `src/lib/maps/sample-icons.ts` -- the divIcon SVG builders for the
  9-state grid.
- `src/types/matrix-map/sample.ts` -- TS interface for `VisibleSample`
  + `HiddenSummary` + the RPC return shape.

### 6.3 Data flow

```
   page.tsx (server)
     |
     | auth + allowlist gate
     v
   MatrixMapLoader (client)
     |
     | dynamic import ssr:false
     v
   MatrixMap (client; new RPC call on mount)
     |
     |  on mount:
     |    1. fetch_samples_with_hidden_summary() -> visible[] + hidden
     |    2. populate cluster layer with divIcons (per row)
     |    3. fit bounds to visible samples (or to BC if 0 visible)
     |
     |  on identify mode entered:
     |    1. install map click handler
     |    2. install per-marker click handlers (via cluster onEachLayer)
     |
     |  on sample marker click in identify mode:
     |    1. runIdentify(latlng, sampleHit)
     |    2. populate SampleIdentifyPanel with sampleHit + joined DRA
     |    3. open popup at latlng with short summary
     |
     |  on empty-map click in identify mode:
     |    1. runIdentify(latlng, null)
     |    2. queryActiveOverlays (existing PR-MAP-2 logic)
     |    3. populate SampleIdentifyPanel with overlay features
     |
     |  on [Refresh] banner button:
     |    1. re-fetch RPC
     |    2. re-render cluster layer + banner
```

## 7. State-discovery SQL packet

Per the new HIGH AUTHORITY rule `cross_project_supabase_protocol_explore_before_assume.md`:
the owner runs the following READ-ONLY SQL via the Supabase MCP **before**
PR-MAP-3 implementation begins, to verify the prerequisite state. AI
should NOT propose any DDL based on assumptions about post-ETL state;
the morning-of run of this packet is the ground truth.

### Packet 7.1 -- ETL applied; samples table populated

```sql
-- 7.1.a -- samples row count post-ETL.
-- Expected post-PR-MAP-1 + PR-MAP-0 geocoding: ~290 rows.
SELECT count(*) FROM matrix_map.samples;

-- 7.1.b -- samples broken down by classification.
-- Expected: ~15 reference, ~99 impacted, ~176 unknown.
-- (Total may not equal 290 if PR-MAP-0 geocoding caught additional
-- sampling-type rows; treat exact counts as informational.)
SELECT classification, count(*)
FROM matrix_map.samples
GROUP BY classification
ORDER BY classification;

-- 7.1.c -- samples broken down by coordinate_quality_tier.
-- Expected: 40 high (surveyed) + ~250 medium (BC CSR centroid) + low (manual fill).
SELECT coordinate_quality_tier, count(*)
FROM matrix_map.samples
GROUP BY coordinate_quality_tier
ORDER BY coordinate_quality_tier;

-- 7.1.d -- samples broken down by classification_source.
-- Expected distribution per R-1: station_type primary; data_unknown
-- for sampling-type rows; steward only after v1.x overrides.
SELECT classification_source, count(*)
FROM matrix_map.samples
GROUP BY classification_source
ORDER BY classification_source;

-- 7.1.e -- samples broken down by bc_region.
-- Expected ~7 distinct BC regions.
SELECT bc_region, count(*)
FROM matrix_map.samples
GROUP BY bc_region
ORDER BY bc_region NULLS FIRST;

-- 7.1.f -- dras row count + public-flag distribution.
SELECT public, is_deleted, count(*)
FROM matrix_map.dras
GROUP BY public, is_deleted
ORDER BY public, is_deleted;

-- 7.1.g -- samples without source_dra_id (flagged-for-steward case).
-- Expected: 0 in a healthy ETL; >0 means PR-MAP-1 ETL has gaps to fix
-- BEFORE PR-MAP-3 ships.
SELECT count(*)
FROM matrix_map.samples
WHERE source_dra_id IS NULL;
```

### Packet 7.2 -- RLS behaves correctly

Run as `jasen.nelson@gmail.com` (the initial allowlist user per R-5):

```sql
-- 7.2.a -- authenticated user sees the visible samples.
-- Expected: same row count as 7.1.a (only public + granted DRAs
-- visible) -- if all DRAs default to public=false, expect 0 here
-- until owner flips some via flip_dra_public.
SELECT count(*) FROM matrix_map.samples;

-- 7.2.b -- authenticated user CANNOT see hidden DRAs without grants.
-- Run this as an authenticated user WITHOUT admin role + WITHOUT
-- any private_data_grants rows. Expected: 0 rows for any DRA where
-- public=false AND no grant exists.
SELECT count(*) FROM matrix_map.samples WHERE source_dra_id IS NOT NULL;

-- 7.2.c -- helpers callable.
SELECT matrix_map.is_email_allowlisted('jasen.nelson@gmail.com');
-- Expected: true
SELECT matrix_map.is_email_allowlisted('unknown@example.com');
-- Expected: false (and no error)

-- 7.2.d -- has_private_grant returns false when no grant exists.
SELECT matrix_map.has_private_grant('00000000-0000-0000-0000-000000000000'::uuid);
-- Expected: false
```

### Packet 7.3 -- prerequisite for the new RPC (Option A)

This packet identifies whether the new
`fetch_samples_with_hidden_summary` RPC can be authored as a SECURITY
DEFINER owned by `matrix_map_owner` without introducing additional
grants:

```sql
-- 7.3.a -- confirm matrix_map_owner role exists + BYPASSRLS.
SELECT rolname, rolcanlogin, rolbypassrls
FROM pg_roles
WHERE rolname = 'matrix_map_owner';
-- Expected: 1 row; rolcanlogin=false; rolbypassrls=true.

-- 7.3.b -- confirm matrix_map_owner can SELECT on samples + dras
-- (it currently has SELECT on dras + UPDATE on dras + INSERT on
-- dra_visibility_audit; SELECT on samples is NOT yet granted).
-- This will inform whether PR-MAP-3 needs an additional GRANT.
SELECT grantee, privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'matrix_map'
  AND table_name IN ('samples', 'dras', 'private_data_grants')
  AND grantee = 'matrix_map_owner'
ORDER BY table_name, privilege_type;
-- Expected before PR-MAP-3: { dras: SELECT, UPDATE; private_data_grants: SELECT }
-- PR-MAP-3 migration adds:                   { samples: SELECT }
```

### Packet 7.4 -- budget breaker state

```sql
-- 7.4.a -- budget_caps seeded.
SELECT dimension, daily_cap, warning_pct FROM matrix_map.budget_caps ORDER BY dimension;
-- Expected: 5 rows summing daily_cap = 60035; all warning_pct = 0.80.

-- 7.4.b -- supabase_reads counter today (informational).
SELECT count_value FROM matrix_map.budget_dimension
WHERE dimension = 'supabase_reads' AND ymd = (now() AT TIME ZONE 'utc')::date;
-- Expected: 0..N depending on prior usage.
```

The packet is intentionally READ-ONLY -- it confirms state but does
not modify. Owner runs this BEFORE PR-MAP-3 implementation begins. If
counts do not match expectations, the morning HITL conversation surfaces
the gap (e.g., ETL did not run, owner needs to run it; or DRA flips
have not happened yet, so visible-sample count is 0).

## 8. Sub-PR breakdown

Per the plan v3.4.2 effort estimate (PR-MAP-3: 7-10 hours), PR-MAP-3 is
already on the upper end of single-PR scope. Recommend splitting into
THREE sub-PRs to keep each round of codex review focused + manageable:

| Sub-PR | Scope | Estimate |
| --- | --- | --- |
| **PR-MAP-3a -- samples + symbology** | Build the `fetch_samples_with_hidden_summary` RPC + migration; wire client-side fetch on mount; render samples via `leaflet.markercluster` with the 9 divIcon states; add `SampleLegend.tsx` left-rail card; coordinate-tier popup tooltips on hover/click. NO identify mode. NO banner. | 3-4h |
| **PR-MAP-3b -- identify-single** | Add identify mode toggle to top toolbar; install map+marker click handlers; build `SampleIdentifyPanel.tsx` + sample-vs-overlay routing; reuse hoisted `wms-identify.ts` for overlay path; popup-at-latlng + side-panel data shaping. | 2-3h |
| **PR-MAP-3c -- partial-visibility banner** | Extend the RPC return shape with `hidden_sample_count` + `hidden_dra_count` + `hidden_dra_ids`; build `PartialVisibilityBanner.tsx` + `[Refresh]` + `[Contact admin]` + `[Learn more]` links; client-side composition-breakdown computation. | 2-3h |

**Each sub-PR gets its own codex iterate-to-GREEN cycle + 4-gate suite
before push.** Per cross-project rule
`cross_project_codex_iterate_to_green_before_commit_plus_4_gates_before_push`.

The split is justified because:
- 3a is mostly DB + symbology and lands without identify wiring (easy
  to verify visually + via SQL).
- 3b adds the identify code path which has a known dual-handler bug
  surface (the BN-RRM SiteMap learned this the hard way -- popups,
  cluster suppression, request id stale-response). Better to land it
  on a clean base.
- 3c is the partial-visibility banner with a contract change to the
  RPC. Codex will want to scrutinize the no-row-identifiers-leaked
  invariant.

Cross-PR coupling:
- 3b assumes 3a's RPC + markers; cannot merge without 3a.
- 3c assumes 3a's RPC shape (extends it); cannot merge without 3a.
- 3b and 3c are independent; can land in parallel.

Recommend serial landing: 3a -> 3b -> 3c (3 sequential codex cycles)
to keep cognitive load + gauntlet retry surface bounded.

## 9. Test strategy

### 9.1 Vitest unit specs

In `src/app/(dashboard)/matrix-map/__tests__/`:

- `MatrixMap.samples.test.tsx` (3a) -- mock `react-leaflet` + mock
  `leaflet.markercluster`; assert that given a mock RPC response of N
  samples, the component renders the correct cluster count + the
  legend; assert default state (loading -> success transition);
  assert error state.
- `MatrixMap.identify.test.tsx` (3b) -- mock the identify code path;
  assert sample-hit and overlay-hit routes; assert stale-response
  guard ignores late returns; assert sample-hit short-circuits
  overlay query.
- `MatrixMap.banner.test.tsx` (3c) -- mock RPC with
  `hidden_sample_count > 0`; assert banner renders; assert
  `hidden_dra_ids` is included but no titles are shown; assert
  `[Refresh]` triggers re-fetch; assert dismiss button hides banner
  for session.

In `src/lib/maps/__tests__/`:

- `sample-identify.test.ts` (3b) -- unit test the proximity hit-test
  helper (given mock markers + latlng, return correct sample or null).
- `sample-icons.test.ts` (3a) -- unit test `createSampleIcon` returns
  correct SVG content for the 9 combinations.

In `supabase/tests/` (mirroring existing matrix_security_audit tests):

- `matrix_map.fetch_samples_with_hidden_summary.test.sql` (3a + 3c) --
  insert fixtures: 1 public DRA with 3 samples, 1 private DRA with 2
  samples; assert authenticated-non-admin user gets visible=3, hidden=2,
  hidden_dra_count=1, hidden_dra_ids=[that uuid]; grant access; re-call
  RPC; assert visible=5, hidden=0; revoke; assert again visible=3,
  hidden=2.

### 9.2 E2E smoke (playwright)

One E2E test per sub-PR landing:
- 3a: navigate to `/matrix-map`; assert >=1 cluster marker rendered;
  assert legend card visible.
- 3b: navigate; click identify mode; click a sample marker;
  assert SampleIdentifyPanel populates with the station_id.
- 3c: navigate; assert banner visibility matches RPC fixture state
  (`hidden_sample_count` > 0 -> banner; = 0 -> no banner).

E2E uses the matrix-map dev seed fixtures (PR-MAP-1 ships a
deterministic ~5-station fixture pack that the test database loads in
CI; matches existing BN-RRM pattern).

### 9.3 Mock data shape (for vitest specs)

`src/__mocks__/matrix-map/samples-fixture.ts`:

```
export const MOCK_VISIBLE_SAMPLES: VisibleSample[] = [
  { id: '...-001', display_name: 'Station 1', lat: 49.0, lng: -123.0,
    classification: 'reference', coordinate_quality_tier: 'high', ... },
  { id: '...-002', display_name: 'Station 2', lat: 49.1, lng: -123.1,
    classification: 'impacted', coordinate_quality_tier: 'medium', ... },
  // ... 9 entries covering all 9 visual states + a couple repeats
];

export const MOCK_HIDDEN_SUMMARY: HiddenSummary = {
  hidden_sample_count: 5,
  hidden_dra_count: 2,
  hidden_dra_ids: ['dra-uuid-1', 'dra-uuid-2'],
};
```

Fixtures ship in 3a and are imported by all subsequent sub-PRs.

## 10. Risks + open questions

Items needing owner morning input BEFORE implementation begins. Each
labeled `Q-N` for traceability into the next codex cycle.

| # | Question | Recommendation | Why owner picks |
| --- | --- | --- | --- |
| Q-1 | Server-side initial fetch (section 2.1) via server action, or client-side via supabase-js? | Server-side server action (single coherent snapshot; no RLS-race) | Affects payload shape + the React initial-render path |
| Q-2 | Identify panel: bulk-fetch DRA `document_url` + `confidentiality_notes` at startup, or fetch on-demand when identify clicks? | On-demand (smaller initial payload; URL is admin-only data anyway) | Affects RPC return shape |
| Q-3 | Hoist `formatIdentifyPopupHtml` from `src/lib/bn-rrm/map-overlay-helpers.ts` to a neutral `src/lib/maps/identify-format.ts`? | Yes (already hoisted wms-identify in PR-MAP-2; this is the symmetric move) | Touches BN-RRM module; potential merge conflict with parallel BN-RRM work |
| Q-4 | Sample identify UX: popup-at-latlng + side-panel (BN-RRM pattern), OR side-panel only, OR popup only? | Popup + side panel (BN-RRM consistency) | Sets the UX expectation reviewers carry from BN-RRM to matrix-map |
| Q-5 | `[Contact admin to request access]` link target: mailto: prepopulated, OR open an admin-form modal that requires PR-MAP-7 to be live first? | mailto: in v1 (works today; not gated on PR-MAP-7) | Affects PR-MAP-7 dependency |
| Q-6 | RPC opt: should `fetch_samples_with_hidden_summary` accept an optional `bbox` parameter NOW (for v1.x non-breaking future) or land flat in v1 and add bbox in v1.x? | Accept now; ignore in v1 body (just province-wide) | Smaller v1.x migration |
| Q-7 | Sample-identify proximity threshold (pixels for hit-test radius around click)? | 10 pixels at any zoom (matches BN-RRM identify-buffer default of 8 + small safety margin) | UX feel |
| Q-8 | Should the partial-visibility banner show when `hidden_sample_count == 0`? | No -- suppress per grants v2 4.5 | Confirmed in design but call out to owner |

Risks (none rated HIGH; all MED/LOW):

| Risk | Severity | Mitigation |
| --- | --- | --- |
| RPC contract drift between 3a payload + 3c extension | MED | Keep `hidden_*` fields in the SAME RPC from 3a (just zero-valued); 3c only adds the UI consumer side |
| BN-RRM identify pattern complexity (popup unbinding, request-id race, cluster suppression) | MED | Copy the exact pattern from BN-RRM SiteMap; reuse runIdentifyRef + identifyRequestIdRef structure verbatim; codex will catch drift |
| Cluster icon SVG rendering perf at 290 markers | LOW | BN-RRM proven; if drift, fall back to numeric-only cluster icons (decoupled from per-marker icons) |
| Test fixture drift vs real ETL output | MED | Pin test fixtures to a known-good ETL snapshot; document data_snapshot_version in fixtures |
| Banner contact-mailto exposes internal email | LOW | env var; owner picks the address; not committed to repo |
| `hidden_dra_ids` could be combined externally with other leaked info to deanonymize a DRA | LOW | UUIDs only; no title/citation; opaque to anyone without admin access; grants v2 D-1 explicit decision |

### Schema-gap surfacing

PR-MAP-3 **does NOT propose any DB schema migration**. The
`fetch_samples_with_hidden_summary` RPC is a new function but lives
in a NEW migration file (e.g.
`20260520000001_matrix_map_pr_map_3a_fetch_rpc.sql`) and:
- Adds the function definition only.
- Adds the GRANT EXECUTE to authenticated.
- Adds the SELECT grant on `matrix_map.samples` to
  `matrix_map_owner` (per packet 7.3.b discovery, this is the only
  missing grant).
- Does NOT alter any existing table.
- Does NOT add any new column.

If state-discovery packet 7.3.b returns a different shape than
expected (e.g., samples SELECT already granted to matrix_map_owner
because a peer migration landed in parallel), the additive nature of
the migration makes it idempotent.

**No new column on `matrix_map.samples` needed.** All 13 fields in
section 2.4 already exist in the PR-MAP-1 schema.

## 11. Estimated effort

Per plan v3.4.2 section 9: PR-MAP-3 = 7-10h. Sub-PR breakdown:

| Sub-PR | Implementation | Codex | 4-gate | Owner review | Total |
| --- | --- | --- | --- | --- | --- |
| 3a samples + symbology | 3-4h | ~1h (2 rounds medium) | 30m | 30m | 5-6h |
| 3b identify-single | 2-3h | ~1.5h (2-3 rounds; identify complexity) | 30m | 30m | 4.5-5.5h |
| 3c partial-visibility banner | 2-3h | ~1h (1-2 rounds; security-sensitive but contract small) | 30m | 30m | 4-5h |
| **Sub-total (3 sub-PRs)** | **7-10h** | **~3.5h** | **1.5h** | **1.5h** | **13.5-16.5h** |

The 13.5-16.5h estimate exceeds plan v3.4.2 original 7-10h by ~50%.
Two reasons:
- Plan v3.4.2 estimate did not break out codex + 4-gate + owner per
  sub-PR (it counted them in a separate row).
- The grants v2 partial-visibility banner adds the 3c sub-PR which
  was logically rolled into PR-MAP-3 effort estimate but is in
  practice its own contained piece of work.

Reconciling: 7-10h is implementation-only; 13.5-16.5h is full
codex+gates+review. Both are correct readings of the plan.

**Owner HITL specifically:**
- ~30 min reviewing 7 Q-N questions in section 10 + signing off the
  design BEFORE 3a starts.
- ~30 min reviewing each sub-PR after codex GREEN + before push.
- Total: ~2h HITL across the 3 sub-PRs + 1h pre-PR design review = 3h.

---

## End of design doc

This doc is the DESIGN ONLY -- no implementation code is written. The
state-discovery SQL packet in section 7 is the morning-of HITL gate;
the Q-1..Q-8 questions in section 10 are the morning-of disambiguation
points. Once owner accepts the design + the 8 Q-N answers, PR-MAP-3a
implementation begins.

Codex review of THIS DOC (the design itself) is recommended BEFORE the
3a implementation begins, per
`cross_project_codex_iterate_to_green_before_commit_plus_4_gates_before_push`.

Plain ASCII only. No em-dashes. No Unicode arrows.
