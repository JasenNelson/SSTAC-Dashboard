# Plan v3 -- Matrix Options Interactive Map (LOCKED)

**Status:** Decision-locked canonical reference. Authored 2026-05-19 after
the PR-A2 merge (`87935db`) + Q3 inventory pass + 2 codex CLI adversarial
rounds (xhigh v1 RED -> medium v2 YELLOW) + owner walk-through of 14
residuals (all accepted as recommended).

**Supersedes:** `.tmp_interactive_map_plan_v1.md`. Decision trail at
`.tmp_interactive_map_recommendations_v1.md` (initial AI recommendations)
+ `.tmp_interactive_map_inventory_and_recommendations_v2.md` (inventory +
codex-corrected recommendations + owner sign-off log).

**Companion artifacts:**
- `.tmp_seed_station_list_v1.md` (R-3 candidate list awaiting owner
  review)
- `.tmp_codex_recommendations_review_response.md` (codex xhigh v1 RED
  verdict)
- `.tmp_codex_v2_confirmation_response.md` (codex medium v2 YELLOW
  verdict; all findings disposed in v2 + carried into this v3)

---

## 1. Goal

Province-wide BC sediment-data interactive map on the Matrix Options
tab. Reviewer selects sample stations on the map; the system computes
screening-grade background statistics (provincial UTL 95/95 +
site-specific stats) from the selection; reviewer can port those stats
into the Calculator tab's Background Adjustment panel as a defensibly-
audited input. v1 is screening-quality; v1.x adds ProUCL validation +
province-wide coverage.

## 2. Scope (v1 includes; v1.x deferred)

**v1 includes:**
- 4-tile basemap (streets / satellite / topo / terrain) reusing BN-RRM
  `BASE_LAYERS`
- 14 BC public WMS overlays reusing BN-RRM `OVERLAY_LAYERS` (parks,
  conservancy, csrSites = the "Remediation layer", bkgdGroundwater,
  emsMonitoring, watersheds, wetlands, ecoregions, BEC, etc.)
- ~290 mappable stations across 9 sites + 7 BC regions (per
  `.tmp_seed_station_list_v1.md`) migrated from `bnrrm_training.db`
- Sample symbology: green circle (reference) / yellow triangle
  (impacted) / grey hollow circle (unknown) with shape redundancy
  per R-7
- 5 tools: pan / select (point) / select area / identify / identify area
- Left panel: identified-features list OR Selection Stats (depending on
  mode); screening-only labels propagate throughout
- Right panel: MeasurementWorkbench (raw measurements behind the
  selection; observation-only including unknowns)
- Calculator bridge: "Use Provincial Background in Calculator" + "Use
  Site-specific Background in Calculator" one-shot snapshot with
  full-payload audit token
- Sediment + toxicity + community + env_modifiers media (data extracted)
- Cost control: 5-dimensional budget breaker + dev allowlist (R-5 starts
  at jasen.nelson@gmail.com only)
- Mobile: read-only summary view below 768px viewport

**v1.x deferred:**
- ProUCL validation + lifting the "screening-only" label per R-4/R-8
- BC EMS / B-1 / B-2 geocoding scale-up to all 1554 stations
- Steward propose/approve UI per R-12
- Water + tissue media (data not yet extracted)
- Time-slider / temporal-range filter
- Public unauthenticated access (per R-9 confidentiality posture)

## 3. UX architecture

### 3.1 Layout

Reuses MatrixDashboard tool-mode chrome from PR-A2: left sidebar
collapsible via `PanelLeftClose` / `PanelLeftOpen`; right drawer
collapsible via `PanelRightClose` / `PanelRightOpen`; both default
open (PR-A2 UX tweak `3748c5c`).

Main content area = the leaflet map. Left panel header replaced with
"MAP SELECTION" (identified-features or Selection Stats). Right drawer
replaced with MeasurementWorkbench.

### 3.2 Tool palette

Floating top-left toolbar; single-active-at-a-time; keyboard shortcuts
P/S/A/I/B; Esc resets to Pan. Identify + identify-area work on ALL
active layers (per R-1 codex-cleared) with per-layer filter in the
identified-features panel header.

### 3.3 Symbology

| Classification | Shape | Color | Outline |
| --- | --- | --- | --- |
| Reference | filled circle | green (#10b981) | solid |
| Impacted | filled triangle | yellow (#eab308) | solid |
| Unknown | hollow circle | grey (#94a3b8) | solid |
| Selected (any classification) | (above shape) | (above color) | **thick blue stroke #2563eb 3px** |

Coordinate quality overlay (R-11):
- Surveyed (high) coords: solid marker outline
- Centroid (medium) coords: dashed marker outline; popup tooltip
  "Coordinate from BC Site Registry centroid (not surveyed)."
- Manual/waterbody (low) coords: dotted marker outline; popup tooltip

Cluster behavior: BN-RRM `leaflet.markercluster`; cluster icon shows
classification mix; selection adds a numeric badge "{selected_count} of
{total_count} selected".

### 3.4 Selection state model

`SelectionStore` (Zustand) at `src/stores/matrix-map/selectionStore.ts`.
Flat list of sample IDs (UUIDs). Standard transitions: replace on click;
add on shift-click; remove on ctrl-click; replace on select-area;
clear via panel button. Ephemeral (not persisted to localStorage in v1);
only the DERIVED audit token persists after the Calculator bridge fires.

### 3.5 Left panel content (two render states)

**State A: identify just fired (no selection):** scrollable identified-
features list grouped by layer with collapse/expand; click-to-zoom; per-
layer suppress filter in header.

**State B: 1+ samples selected:** Selection Stats panel:
- Selection summary line with composition: "47 selected (5 reference, 12
  impacted, 30 unknown)"
- Substance (controlled by Calculator's SharedGlobalInputs; not editable
  here)
- Medium radio group (Sediment / Water / Tissue / Toxicity / Community;
  default Sediment); only mediums with data are enabled
- "Provincial Background" stats block (computed from reference subset
  only): n, mean, median, sd, min, max, 95th percentile, UTL 95/95, 90%
  UCL of UTL, censoring fraction. Every stat carries the
  **"screening-only -- not regulator-submission-grade"** label
- "Site-specific Background" stats block (computed from all classified
  in selection): same 10 stats
- "30 selected stations have unclassified status and are EXCLUDED from
  UTL computation. Override their classification {here} to include."
  link to override UI (placeholder in v1; functional in v1.x)
- Methodology badge: "UTL via K-table (utlTable.ts); censoring via 1/2
  DL (ROS in v1.x); see methodology appendix {link}"
- Two action buttons: "Use Provincial Background in Calculator", "Use
  Site-specific Background in Calculator"
- Admin-only: "Export selection as CSV"

### 3.6 Right panel (MeasurementWorkbench)

Tabular view of raw measurements backing the current selection (includes
unknowns -- observation-only per R-14).

Columns: Sample | Date | Medium | Substance | Value | Unit | DL Flag |
Censoring | Coord Quality | Source DRA

Filter chips: medium, QA flag, date range, classification
(reference/impacted/unknown).

Pagination at 100 rows/page. Click row -> highlights sample on map +
scrolls to it.

Admin-only "Export current view as CSV" button.

### 3.7 Calculator integration

Click "Use Provincial Background in Calculator":
1. Compute UTL on reference subset of current selection (with
   "screening-only" methodology applied)
2. Generate audit token containing: sample IDs + event dates + result
   IDs + units + censoring policy + ROS-vs-substitution flag + method
   version + ProUCL version (null in v1; populated in v1.x) + data-
   snapshot version + computed-at UTC timestamp + per-sample
   classification + per-sample coordinate quality tier
3. Persist token to `matrix_map.bridge_audit` table
4. Switch active top-tab to Calculator
5. Populate BackgroundAdjustment provincial UTL input with computed value
6. Show metadata badge on the Background Adjustment panel: "Sourced from
   N samples (screening-only; token #abc123, computed YYYY-MM-DD HH:MM
   UTC from events Y-Z)" with click-through to restore the selection
7. "Refresh from current map selection" button on the BG Adjustment
   panel for re-linking on demand

"Use Site-specific Background in Calculator" = same flow into the
regional UTL input instead of provincial.

### 3.8 Mobile fallback (< 768px viewport)

Read-only summary view: site list + most-recent-measurement table; no
selection; no stats; no CSV export. Banner: "Use a desktop or tablet
(768px or wider) for the full interactive map."

## 4. Data architecture

### 4.1 Source data

- **Primary:** `bnrrm_training.db` (16.2 MB SQLite at
  `C:\Projects\Regulatory-Review\2026_Database_Development\data_acquisition\bnrrm_extraction\bnrrm_training.db`).
  Migrated to Supabase `matrix_map` schema in PR-MAP-1.
- **Live context (no migration):** 14 BC public WMS overlays via
  existing `openmaps.gov.bc.ca/geo/pub/ows` proxy.
- **Geocoding sources (per R-2):**
  - 40 stations already geocoded in bnrrm_training.db (Tier A
    surveyed)
  - BC Public Site Registry centroids for sites 1, 3, 4, 7, 9 (R-3 Tier
    B; ~250 stations expected; Tier "medium" coordinate quality)
  - Manual data-steward fill for residual high-priority gaps (B-3; Tier
    "low" coordinate quality)

### 4.2 `matrix_map` Supabase schema

```sql
create schema if not exists matrix_map;

create table matrix_map.samples (
  id                       uuid primary key default gen_random_uuid(),
  bnrrm_station_id         integer unique not null,  -- foreign reference to source SQLite
  station_id               text not null,           -- agency / DRA station ID
  display_name             text not null,
  geometry                 geography(POINT, 4326) not null,
  coordinate_quality_tier  text not null check (
    coordinate_quality_tier in ('high', 'medium', 'low')
  ),
  coordinate_source        text not null,           -- 'surveyed', 'bc_csr_centroid', 'manual_steward', etc.
  classification           text not null check (
    classification in ('reference', 'impacted', 'unknown')
  ),
  classification_source    text not null check (
    classification_source in ('station_type', 'steward', 'data_unknown')
  ),                                                  -- v1.x adds 'bkgd_groundwater' for groundwater-substance scope only
  classification_rationale text,
  classification_confidence text check (
    classification_confidence in ('high', 'medium', 'low')
  ),
  receptor_metadata        jsonb,                   -- TS interface at src/types/matrix-map/receptor-metadata.ts
  source_site_id           integer,                 -- bnrrm_training.db sites.site_id
  bc_region                text,
  waterbody                text,
  waterbody_type           text,
  source_dra_id            uuid references matrix_map.dras(id),
  public                   boolean not null default false,
  notes                    text,
  created_at               timestamptz default now(),
  updated_at               timestamptz default now()
);
create index samples_geom_gist on matrix_map.samples using gist (geometry);
create index samples_classification on matrix_map.samples (classification);
create index samples_public on matrix_map.samples (public);

create table matrix_map.sample_events (
  id              uuid primary key default gen_random_uuid(),
  bnrrm_event_id  integer unique,
  sample_id       uuid not null references matrix_map.samples(id) on delete cascade,
  event_date      date not null,
  pre_remediation boolean,
  depth_min_m     numeric,
  depth_max_m     numeric,
  sampling_method text,
  notes           text,
  created_at      timestamptz default now()
);
create index sample_events_sample_id on matrix_map.sample_events (sample_id);
create index sample_events_date on matrix_map.sample_events (event_date);

create table matrix_map.substances (
  id                uuid primary key default gen_random_uuid(),
  key               text not null unique,
  display_name      text not null,
  cas_number        text,
  aliases           jsonb,        -- ["benzo(a)pyrene", "B[a]P", "BAP", ...]
  contaminant_class text,
  created_at        timestamptz default now()
);
create index substances_cas on matrix_map.substances (cas_number);

create table matrix_map.measurements (
  id              uuid primary key default gen_random_uuid(),
  sample_event_id uuid not null references matrix_map.sample_events(id) on delete cascade,
  substance_id    uuid not null references matrix_map.substances(id),
  medium          text not null check (
    medium in ('sediment','water','tissue','toxicity','community')
  ),
  value           numeric not null,
  unit            text not null,   -- v1.x: ENUM with canonical units
  raw_value       numeric,         -- source value pre-normalization
  raw_unit        text,            -- source unit pre-normalization (audit)
  detection_limit numeric,
  qualifier       text,            -- '<' for censored; 'J' estimated; etc.
  censored        boolean default false,
  method          text,
  lab             text,
  notes           text,
  created_at      timestamptz default now()
);
create index measurements_event on matrix_map.measurements (sample_event_id);
create index measurements_substance_medium on matrix_map.measurements (substance_id, medium);

create table matrix_map.dras (
  id              uuid primary key default gen_random_uuid(),
  bnrrm_doc_id    integer unique,
  title           text not null,
  agency          text,
  year            int,
  site_id         text,
  citation        text not null,
  document_url    text,
  public          boolean not null default false,  -- R-10: default private
  confidentiality_notes text,
  created_at      timestamptz default now()
);

create table matrix_map.layers (
  id              uuid primary key default gen_random_uuid(),
  key             text not null unique,
  display_name    text not null,
  tile_url        text,
  wms_layer_name  text,
  attribution     text,
  z_index         int not null default 0,
  default_visible boolean not null default false,
  category        text not null,
  available_in_matrix_map boolean not null default true,
  created_at      timestamptz default now()
);

-- NOTE: bridge_audit DDL DEFERRED to PR-MAP-6 per codex v3 finding 1.
-- The audit-token contract is signed off by owner at R-13 methodology
-- gate (between PR-MAP-3 and PR-MAP-4); shipping the table in PR-MAP-1
-- would lock the contract before sign-off. Table lands in PR-MAP-6
-- migration, alongside the Calculator bridge code that uses it. Schema
-- skeleton shown below is the PROPOSAL for R-13 sign-off; final form
-- ships with PR-MAP-6.
--
-- create table matrix_map.bridge_audit (
--   id               uuid primary key default gen_random_uuid(),
--   token            text not null unique,
--   selection_ids    uuid[] not null,
--   event_ids        uuid[] not null,
--   result_ids       uuid[] not null,
--   substance_id     uuid not null,
--   medium           text not null,
--   bridge_target    text not null check (
--     bridge_target in ('provincial', 'site_specific')
--   ),
--   computed_value   numeric not null,
--   unit             text not null,
--   censoring_policy text not null,
--   method_version   text not null,
--   proucl_version   text,
--   data_snapshot_version text not null,
--   classifications  jsonb not null,
--   coordinate_tiers jsonb not null,
--   screening_only   boolean not null default true,
--   computed_at      timestamptz not null default now(),
--   computed_by_user uuid,
--   notes            text
-- );

create table matrix_map.classification_overrides (
  id            uuid primary key default gen_random_uuid(),
  sample_id     uuid not null references matrix_map.samples(id),
  prior_value   text not null,
  new_value     text not null,
  rationale     text not null,
  confidence    text not null check (confidence in ('high','medium','low')),
  approved_by   uuid not null,
  approved_at   timestamptz not null default now()
);

create table matrix_map.export_audit (
  id               uuid primary key default gen_random_uuid(),
  exported_at      timestamptz not null default now(),
  exported_by      uuid not null,
  selection_token  text,
  row_count        int not null,
  bytes            int,
  filter_summary   jsonb
);

create table matrix_map.budget_dimension (
  id              uuid primary key default gen_random_uuid(),
  dimension       text not null check (
    dimension in ('supabase_reads','wms_proxy','etl_runs','egress_gb','csv_exports')
  ),
  ymd             date not null,
  count_value     numeric not null default 0,
  unique (dimension, ymd)
);

create table matrix_map.budget_caps (
  dimension       text primary key check (
    dimension in ('supabase_reads','wms_proxy','etl_runs','egress_gb','csv_exports')
  ),
  daily_cap       numeric not null,
  warning_pct     numeric not null default 0.80
);
-- Starter caps per R-6:
insert into matrix_map.budget_caps values
  ('supabase_reads', 50000, 0.80),
  ('wms_proxy', 10000, 0.80),
  ('etl_runs', 10, 0.80),
  ('egress_gb', 5, 0.80),
  ('csv_exports', 20, 0.80);
```

### 4.3 RLS policies

- `anon`: ZERO access to matrix_map.
- `authenticated`: SELECT on samples/sample_events/measurements/
  substances/dras/layers WHERE the relevant `public` flag is true AND
  the user's email is in `MATRIX_MAP_DEV_ALLOWLIST` env var.
- `matrix_admin`: SELECT/INSERT/UPDATE on all matrix_map tables; CSV
  export action.

Email-allowlist enforcement via PL/pgSQL helper
`matrix_map.is_email_allowlisted(jwt) returns boolean` called from RLS
policies. Allowlist initial value per R-5: jasen.nelson@gmail.com only.

### 4.3.1 Private data grants (added v3.4 per owner request 2026-05-19; logically an extension of 4.3 RLS -- grants flip the public/private predicate per-user)

Per-user per-DRA grants allow matrix_admin to selectively share
`public=false` DRAs with specific TWG reviewers without elevating them
to matrix_admin globally. Full spec at
`.tmp_private_grants_design_v2.md`; summary:

- New tables: `matrix_map.private_data_grants`,
  `matrix_map.dra_visibility_audit`,
  `matrix_map.service_role_audit` (codex v1 review C-2 + C-3).
- New columns on `dras`: `is_deleted` + `deleted_at` + `deleted_by`
  (soft-delete pattern; codex v1 review A-2: FK changed from cascade to
  restrict to preserve audit trail).
- (DUA columns removed 2026-05-19 per owner decision: "we're not using
  DUA in this project". Codex v1 finding E-1 owner-OVERRIDDEN. Grants
  audit relies on (granted_by, granted_at, rationale, expires_at) alone.)
- New helper: `matrix_map.has_private_grant(uuid) returns boolean`
  (security definer; owned by non-login `matrix_map_owner` role;
  `set search_path = matrix_map, pg_catalog`; narrow EXECUTE; codex
  v1 review B-1 hardening).
- New RPC: `matrix_map.flip_dra_public(p_dra_id, p_new_value,
  p_actor_id, p_actor_email, p_reason)` (security definer; matrix_admin
  authorization checked internally; auth.uid() = p_actor_id enforced;
  atomic UPDATE + `dra_visibility_audit` INSERT; replaces the earlier
  trigger pattern that failed under service-role per codex grants-v2.1
  findings B-1 + v2.1 finding 1).
- Updated RLS: samples / sample_events / measurements / dras /
  private_data_grants all get explicit SELECT policies that join
  through `source_dra_id` (codex v1 review B-3: RLS does NOT
  auto-cascade through FKs); policy clause is
  `is_email_allowlisted(auth.jwt()) AND dra not deleted AND
  (dra.public OR has_private_grant(dra.id))`.
- Updated `bridge_audit`: `grants_used` JSONB carries IMMUTABLE
  snapshots per grant (grant_id, user_id/email, dra_id/title/citation,
  granted_by/email, granted_at, rationale, expires_at, checked_at) so
  later grant or DRA mutation doesn't change historical token meaning
  (codex v1 review C-1).
- New seed-script template: `supabase/seed/matrix_map/grants.yaml`
  ships in PR-MAP-1 so matrix_admin can manage grants via direct
  SQL during the PR-MAP-1..PR-MAP-7 gap (codex v1 review F-1; matches
  v3 R-14 scripts-only pattern).
- Service-role policy: NEVER exposed to frontend; only used in
  server-side Next.js API routes (ETL, daily-budget cron, admin
  CSV export, admin user-list fetch for grant form); every call
  logged to `matrix_map.service_role_audit` (codex C-2).

### 4.4 Cost control

5-dimensional budget breaker per R-6:
- Every server-side RPC + ETL job + export increments the relevant
  `matrix_map.budget_dimension` row for today's UTC date.
- Middleware checks `count_value / daily_cap` before serving; >= 1.0
  returns 503 with explanatory banner; >= 0.80 surfaces an admin-only
  warning banner.
- Daily reset at 00:00 UTC (job).
- Telemetry exposed at `/admin/matrix-map/budget` for owner review.
- Caps tightened to ~3x measured baseline at 2-week mark per owner
  review.

## 5. Methodology appendix (signed off before PR-MAP-4 per R-13)

Plan v3 includes a draft methodology appendix that owner signs off on
between PR-MAP-3 and PR-MAP-4. Outline:

1. UTL 95/95 K-table source: `utlTable.ts` (existing code; screening-
   only per file warnings)
2. Censoring policy v1: 1/2 detection limit substitution; per-stat label
   "computed via 1/2 DL substitution -- screening only"
3. Censoring policy v1.x: ROS via Postgres extension or vetted JS
   implementation; ProUCL 5.2 validation; label flip
4. K-factor source documentation per derivation
5. Code hash captured per stat (in `bridge_audit.method_version`)
6. Audit-token contract spec (the bridge_audit row format)
7. Acceptance criteria for graduating from "screening-only" to
   "regulatory-support"
8. **DRA confidentiality posture anchored in BC EMA s.43** (added v3.4
   per codex grants-v1 review E-2). BC Site Registry is public under
   EMA s.43; private DRA / NDA material is a separate confidentiality
   posture. matrix-map defaults all migrated samples to `public=false`;
   matrix_admin flips per-DRA after explicit review of the source DRA's
   public-record status. Per-user grants
   (`matrix_map.private_data_grants`) allow controlled sharing of
   private DRA data with TWG reviewers without elevating them to
   matrix_admin globally. Citations:
   - https://www2.gov.bc.ca/gov/content/environment/air-land-water/site-remediation/legislation-and-protocols
   - https://www2.gov.bc.ca/gov/content/environment/air-land-water/site-remediation/site-information
   - https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/375_96_05

## 6. Stack decisions

- react-leaflet ^5.0.0 + leaflet.markercluster ^1.5.3 (reuse from BN-RRM)
- Hoist `src/lib/bn-rrm/wms-identify.ts` to `src/lib/maps/wms-identify.ts`
  (PR-MAP-2 work); BN-RRM re-imports from new location
- Base tiles + 14 BC WMS overlays carry over from BN-RRM `SiteMap.tsx`
- ZERO Jermilova GeoJSON artifacts carry over (R-11 confirmed)
- Zustand for SelectionStore (matches existing project pattern)

## 7. PR sequencing

| PR | Scope | Gates |
| --- | --- | --- |
| **PR-MAP-0** | Geocoding ETL pass: B-4 centroids for sites 1, 3, 4, 7, 9 from BC Public Site Registry; B-3 manual fill for residual high-priority gaps; updates bnrrm_training.db with lat/lon + coordinate_source + coordinate_quality_tier columns | Owner approves seed station list (`.tmp_seed_station_list_v1.md`) |
| PR-MAP-1 | matrix_map Supabase schema (includes `private_data_grants` + `dra_visibility_audit` + `service_role_audit` tables + `dras.is_deleted` columns + `has_private_grant` helper + **`flip_dra_public` RPC** (replaces earlier trigger pattern per codex grants-v2.1 B-1) per v3.4 section 4.3.1) + RLS policies (explicit on samples/sample_events/measurements/dras/private_data_grants per codex grants-v1 B-3) + email-allowlist helper + 5-dimensional budget breaker + ETL migration script from bnrrm_training.db to matrix_map + `supabase/seed/matrix_map/grants.yaml` seed-script template. Seed data: ~290 stations + their measurements. `/admin/matrix-map/health` page | PR-MAP-0 done |
| PR-MAP-2 | "Interactive Map" tab wire-up: MapTab component + react-leaflet base map + 14 BC WMS overlays + 4 base tile layers + layer-toggle UI + Jermilova exclusion guard + hoisted wms-identify | PR-MAP-1 done |
| PR-MAP-3 | Sample point rendering from matrix_map.samples + shape+color symbology per R-7 + coordinate-quality outlines per R-11 + cluster + identify single tool + **reviewer-side partial-visibility banner** (codex grants-v1 D-1 + v2 C-2 nit: banner lands in PR-MAP-3 since samples first render here with API contracts; PR-MAP-4 layers selection on top without changing the banner spec) | PR-MAP-2 done |
| **METHODOLOGY APPENDIX SIGN-OFF GATE (R-13)** | Owner signs off on the methodology appendix language before PR-MAP-4 | PR-MAP-3 done |
| PR-MAP-4 | Selection tools (pan / select / select area / identify area) + SelectionStore + left-panel Selection Stats with screening-only labels + methodology badge | METHODOLOGY APPENDIX SIGN-OFF DONE |
| PR-MAP-5 | Right-panel MeasurementWorkbench + raw-measurements API + admin-only CSV export + export_audit logging | PR-MAP-4 done |
| PR-MAP-6 | Calculator bridge: **`matrix_map.bridge_audit` table DDL migration** (deferred from PR-MAP-1 per codex v3 finding -- table form was a candidate at R-13 sign-off and lands here in final form) + token contract implementation with `grants_used` IMMUTABLE-SNAPSHOT JSONB shape (codex grants-v1 C-1) + "Sourced from N samples (screening-only; token #abc, computed YYYY-MM-DD UTC)" badge on BackgroundAdjustment panel + click-through restore + "Refresh from current map selection" button | PR-MAP-5 done; R-13 methodology appendix signed off |
| **PR-MAP-7 (NEW v3.4)** | Admin UI `/admin/matrix-map/grants` (matrix_admin only): active grants table + grant form with **renew-vs-new mode semantics (codex grants-v1 A-1)** + service-role-keyed user autocomplete (codex A-3) + free-form rationale field + revoked history tab + per-user view + per-DRA view + **DRA-flip review modal (codex D-2: NOT one-click bulk; per-grant rationale required)** + auth.users delete trigger that soft-revokes user's grants. Does NOT gate PR-MAP-2..6; ships parallel after PR-MAP-1. NOTE: DUA acceptance flow (codex E-1) owner-overridden 2026-05-19 -- not in scope. | PR-MAP-1 done |

## 8. Risks

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Geocoding gap (40/1554) blocks PR-MAP-1 | HIGH | PR-MAP-0 dedicated to geocoding; ships ~290 mappable points |
| Supabase egress cost blow-up | MED | 5-dimensional budget breaker + telemetry + allowlist |
| BC WMS / WFS rate limits unknown | MED | Add wms_proxy dimension to budget breaker; cache popular identify results 5min |
| DRA confidentiality leak | HIGH | Default `public=false`; per-DRA matrix_admin flip; cascading sample inheritance |
| station_type classification disputes | MED | "Screening-only" label propagates everywhere; steward override path; audit trail |
| react-leaflet perf at 290+ markers | LOW | Cluster behavior handles it; bbox queries server-side |
| Color-blind misreading of ref/impacted | LOW | Shape redundancy per R-7 (triangle vs circle vs hollow) |
| Methodology drift | MED | Methodology appendix sign-off gate per R-13 |
| Private-grant privilege escalation via `has_private_grant` misconfig | MED | security definer hardening per codex grants-v1 B-1 (non-login owner; locked search_path; narrow EXECUTE; tests) |
| Race on DRA public flip leaks data | MED | DRA-flip review modal (codex grants-v1 D-2) + `dra_visibility_audit` populated atomically by `flip_dra_public` RPC (codex grants-v2.1 B-1) |
| Bridge-token stale data after grant mutation | LOW | Immutable snapshot per codex grants-v1 C-1 |
| Service-role direct table access bypasses RLS | MED | Application policy: service_role only via audited RPCs; `service_role_audit` table (codex C-2) |
(DUA risk row removed -- owner override 2026-05-19; DUA not in project scope.)

## 9. Effort estimate

| Phase | Hours |
| --- | --- |
| PR-MAP-0 geocoding | 4-6 |
| PR-MAP-1 schema + RLS + ETL + grants schema/helper/audit (codex v1) | 10-14 |
| PR-MAP-2 map + WMS overlays | 5-7 |
| PR-MAP-3 sample render + identify + partial-visibility banner | 7-10 |
| PR-MAP-4 selection + stats | 10-14 |
| PR-MAP-5 workbench + CSV | 5-7 |
| PR-MAP-6 Calculator bridge + audit (immutable grants_used snapshot) | 6-8 |
| PR-MAP-7 Admin grants UI + DRA-flip modal | 5-7 |
| Per-PR codex iterate (~2 rounds) | 10-14 |
| 4-gate suites (~30 min x 7) | 4 |
| Methodology appendix authoring + owner sign-off | 4-6 |
| **Total orchestrator-side** | **70-97h** (+9-11h vs pre-grants v3) |
| **Owner HITL** | **5-9h** (R-3 seed sign-off + methodology appendix + ~7 PR review/merge + grants policy decisions) |

## 10. Adversarial review path

Plan v3 -> codex CLI medium final confirmation (this round) -> owner
acknowledges no further changes -> PR-MAP-0 begins.

Each subsequent PR follows the PR-A2 cadence: cursor iterative + codex
batched final round per commit + 4-gate suite before push.

---

End of plan v3.
