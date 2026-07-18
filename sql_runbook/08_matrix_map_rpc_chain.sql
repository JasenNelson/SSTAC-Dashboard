-- ============================================================================
-- BATCH 8: Matrix-map Interactive Map RPC chain (11 files, STRICT ORDER).
--   Builds the full matrix_map schema + RLS/helpers + the fetch/measurement RPC
--   chain the Interactive Map tab and its Measurement Workbench right panel need.
--   Depends on the `postgis` extension being enabled.
-- Idempotent: safe to run even if already applied (every file is idempotent or
--   CREATE OR REPLACE; re-running the chain refreshes the RPC bodies). RECOMMENDED
--   to run the FULL chain whenever there is any doubt the post-creation fix bodies
--   were applied -- 1e/1f only check RPC NAMES, not body freshness.
-- Needed-if: STEP 0 probe 1e < 2 rows OR 1f = 0 rows OR 1k reports ABSENT.
-- POST-APPLY: if PostgREST still 404s the RPC from the app even though the function
--   exists, confirm `matrix_map` is listed under Project Settings -> API ->
--   "Exposed schemas" (a Studio toggle, not SQL).
-- Source (concatenated verbatim from supabase/migrations/, RLS/helpers BEFORE RPCs):
--   1. 20260519000001_matrix_map_schema.sql                         (13 tables)
--   2. 20260519000002_matrix_map_rls.sql                            (helpers + RLS)
--   3. 20260520000001_matrix_map_fetch_samples_rpc.sql
--   4. 20260520000003_matrix_map_security_hardening.sql
--   5. 20260520000004_matrix_map_jwt_via_current_setting.sql
--   6. 20260520000005_matrix_map_rpc_geography_cast.sql
--   7. 20260520000006_matrix_map_rpc_geometry_type_schema_qualify.sql
--   8. 20260520000007_matrix_map_rpc_stxy_geography_avoid_extensions.sql
--   9. 20260521000001_matrix_map_lng_lat_columns.sql
--  10. 20260521000002_matrix_map_admin_bypass_fetch_rpc.sql
--  11. 20260521000003_matrix_map_fetch_measurements_rpc.sql         (RIGHT PANEL)
-- ============================================================================

-- =====================================================================
-- PR-MAP-1 -- matrix_map schema (tables + indexes + seed caps ONLY)
-- =====================================================================
--
-- Branch: feat/matrix-map-pr-map-1-schema
-- Lane:   Matrix Interactive Map (PR-MAP-1 of PR-MAP-0..PR-MAP-7)
-- Plan:   .tmp_interactive_map_plan_v3.md (v3.4.2 LOCKED, codex-GREEN
--         through 8 rounds + owner sign-off on R-1..R-14 residuals)
-- Grants: .tmp_private_grants_design_v2.md (v2.3, codex 14 findings
--         disposed; v2.1 trigger-vs-RPC pivot folded in)
--
-- SCOPE OF THIS FILE:
--   - CREATE SCHEMA matrix_map
--   - 13 tables in matrix_map (samples, sample_events, substances,
--     measurements, dras, layers, classification_overrides,
--     private_data_grants, dra_visibility_audit, service_role_audit,
--     export_audit, budget_dimension, budget_caps)
--   - Indexes per plan v3 section 4.2 + grants v2 section 2.1
--   - Seed budget_caps with 5 starter dimensions per R-6
--   - COMMENT ON TABLE / COMMENT ON COLUMN referencing R-1..R-14 +
--     grants v2 codex findings for audit trail
--
-- OUT OF SCOPE (separate migrations):
--   - matrix_map.bridge_audit (DEFERRED to PR-MAP-6 per plan v3 codex
--     finding -- token contract is signed off at R-13 between PR-MAP-3
--     and PR-MAP-4; shipping the table in PR-MAP-1 would lock contract
--     before sign-off)
--   - RLS policies (samples / sample_events / measurements / dras /
--     private_data_grants explicit cascade per grants v2 B-3)
--   - Helper functions (matrix_map.is_email_allowlisted, has_private_grant)
--   - RPCs (flip_dra_public, ETL helpers, daily-budget cron)
--   - Role definitions (matrix_map_owner non-login role; matrix_admin)
--   - GRANTs on tables / functions to authenticated / service_role
--   - Seed data (~290 sample rows from bnrrm_training.db; ETL migration)
--
-- PRE-FLIGHT VERIFICATION (run READ-ONLY before applying):
--
--   -- Confirm postgis is installed (geography type used by samples.geometry).
--   -- This migration self-installs via SECTION 0 CREATE EXTENSION IF NOT
--   -- EXISTS, so the pre-flight check is informational. If the install
--   -- statement fails (insufficient privileges), enable via Supabase
--   -- Dashboard > Database > Extensions > postgis BEFORE re-running.
--   SELECT extname, extversion FROM pg_extension WHERE extname = 'postgis';
--   -- Expected after apply: 1 row with extversion >= 3.0
--
--   -- Confirm pgcrypto / gen_random_uuid is available
--   SELECT extname FROM pg_extension WHERE extname IN ('pgcrypto');
--   -- (pgcrypto provides gen_random_uuid on older PG; on PG13+
--   --  gen_random_uuid is built-in via pg_catalog. Either path is fine.)
--
--   -- Confirm matrix_map schema does NOT already exist (idempotency
--   -- guard for first apply; subsequent re-applies are no-ops via
--   -- CREATE SCHEMA IF NOT EXISTS / CREATE TABLE IF NOT EXISTS).
--   SELECT nspname FROM pg_namespace WHERE nspname = 'matrix_map';
--   -- Expected on first apply: 0 rows
-- =====================================================================

BEGIN;

-- =====================================================================
-- SECTION 0 -- EXTENSIONS + SCHEMA + SEARCH_PATH
-- =====================================================================
-- PostGIS required by matrix_map.samples.geometry (geography type).
-- Verified 2026-05-19 via state-discovery SQL packet: extension NOT
-- present on target Supabase project (only pg_stat_statements, pgcrypto,
-- plpgsql, supabase_vault, uuid-ossp installed). Adding it here as
-- CREATE EXTENSION IF NOT EXISTS keeps the migration self-sufficient
-- on a fresh project; existing-postgis projects no-op safely. Standard
-- Supabase pattern per https://supabase.com/docs/guides/database/extensions/postgis.
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;

-- search_path includes the `extensions` schema so unqualified type
-- lookups (geography, jsonb, inet) resolve against postgis without
-- surprises. The search_path SET is statement-local to this transaction;
-- production session search_path is not modified.

CREATE SCHEMA IF NOT EXISTS matrix_map;

SET LOCAL search_path = matrix_map, public, extensions, pg_catalog;

COMMENT ON SCHEMA matrix_map IS
  'Matrix Interactive Map lane (PR-MAP-1..PR-MAP-7). Holds sediment-data '
  'samples + measurements + DRA references + grants + audit tables for '
  'the province-wide screening-grade background-statistics workflow. '
  'Default confidentiality posture: samples.public = false; dras.public '
  '= false; matrix_admin flips per-DRA after explicit review per BC EMA '
  's.43 (plan v3 section 5 methodology appendix item 8). All stats '
  'computed from this schema are screening-only (not regulator-submission-'
  'grade) until ProUCL validation + v1.x graduation gate.';


-- =====================================================================
-- SECTION 1 -- dras (referenced by samples FK; create FIRST)
-- =====================================================================
-- DRA = Detailed Risk Assessment source document. samples inherit
-- confidentiality from their source DRA via source_dra_id; per-DRA
-- public flag (default false) gates all downstream RLS via the
-- has_private_grant + public-flag join (RLS policies land in a
-- separate migration). is_deleted is a soft-delete flag (codex
-- grants-v1 A-2): DRA deletion is forbidden by application policy so
-- the audit trail in private_data_grants + dra_visibility_audit +
-- bridge_audit (PR-MAP-6) remains intact.

CREATE TABLE IF NOT EXISTS matrix_map.dras (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bnrrm_doc_id          integer UNIQUE,
  title                 text NOT NULL,
  agency                text,
  year                  integer,
  site_id               text,
  citation              text NOT NULL,
  document_url          text,
  public                boolean NOT NULL DEFAULT false,
  confidentiality_notes text,
  is_deleted            boolean NOT NULL DEFAULT false,
  deleted_at            timestamptz,
  deleted_by            uuid,
  created_at            timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE matrix_map.dras IS
  'Detailed Risk Assessment source documents. Per R-10: default '
  'public=false; matrix_admin flips per-DRA after explicit review of '
  'public-record status (BC EMA s.43 anchor; plan v3 section 5 item 8). '
  'Soft-delete via is_deleted (grants v2 codex A-2): hard DELETE is '
  'forbidden by application policy to preserve grants + bridge_audit '
  'history. DRA deletion (rare retract-from-registry case) sets '
  'is_deleted=true + populates deleted_at/deleted_by; RLS hides soft-'
  'deleted DRAs from authenticated users.';

COMMENT ON COLUMN matrix_map.dras.bnrrm_doc_id IS
  'Foreign reference to bnrrm_training.db documents.doc_id; unique so '
  'the PR-MAP-1 ETL is idempotent (re-running does not duplicate rows).';

COMMENT ON COLUMN matrix_map.dras.public IS
  'Per R-10 + grants v2 design: defaults false. Flipping requires the '
  'matrix_map.flip_dra_public RPC (separate migration) which atomically '
  'updates this column + writes dra_visibility_audit. Direct UPDATE is '
  'RLS-restricted to matrix_admin; the admin UI always routes through '
  'the RPC per documented contract (grants v2.1 codex finding B-1).';

COMMENT ON COLUMN matrix_map.dras.is_deleted IS
  'Soft-delete flag per grants v2 codex A-2. Hard DELETE forbidden to '
  'preserve audit FK integrity (private_data_grants.dra_id ON DELETE '
  'RESTRICT; dra_visibility_audit.dra_id ON DELETE RESTRICT).';


-- =====================================================================
-- SECTION 2 -- samples
-- =====================================================================
-- One row per sediment-data sampling station (NOT per visit -- repeat
-- visits = rows in matrix_map.sample_events). Classification is the
-- DRA-derived screening-only label per R-1 (station_type primary;
-- "sampling" type maps to unknown; bkgdGroundwater scoped to ground-
-- water only via classification_source='bkgd_groundwater'; data-
-- steward override path tracked via classification_overrides).

CREATE TABLE IF NOT EXISTS matrix_map.samples (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bnrrm_station_id          integer NOT NULL UNIQUE,
  station_id                text NOT NULL,
  display_name              text NOT NULL,
  geometry                  geography(Point, 4326) NOT NULL,
  coordinate_quality_tier   text NOT NULL CHECK (
    coordinate_quality_tier IN ('high', 'medium', 'low')
  ),
  coordinate_source         text NOT NULL,
  classification            text NOT NULL CHECK (
    classification IN ('reference', 'impacted', 'unknown')
  ),
  classification_source     text NOT NULL CHECK (
    classification_source IN ('station_type', 'steward', 'data_unknown', 'bkgd_groundwater')
  ),
  classification_rationale  text,
  classification_confidence text CHECK (
    classification_confidence IN ('high', 'medium', 'low')
  ),
  receptor_metadata         jsonb,
  source_site_id            integer,
  bc_region                 text,
  waterbody                 text,
  waterbody_type            text,
  source_dra_id             uuid REFERENCES matrix_map.dras(id),
  public                    boolean NOT NULL DEFAULT false,
  notes                     text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE matrix_map.samples IS
  'Sediment-data sampling stations (one row per station; repeat visits '
  'live in sample_events). Per R-1: DRA-derived station_type is the '
  'primary classification with screening-only authority; data-steward '
  'override path tracked in classification_overrides. Per R-11: '
  'coordinate_quality_tier drives the marker outline (solid surveyed / '
  'dashed centroid / dotted manual). Default public=false inherits the '
  'DRA confidentiality posture from source_dra_id.';

COMMENT ON COLUMN matrix_map.samples.bnrrm_station_id IS
  'Foreign reference to bnrrm_training.db stations.station_id (16.2 MB '
  'source SQLite at 2026_Database_Development/data_acquisition/'
  'bnrrm_extraction/bnrrm_training.db). UNIQUE so PR-MAP-1 ETL is '
  'idempotent across re-runs.';

COMMENT ON COLUMN matrix_map.samples.geometry IS
  'WGS84 point geometry. Backed by GIST index for bbox / radius '
  'selection queries (samples_geom_gist). PR-MAP-0 geocoded 40 -> 290 '
  'stations via BC Public Site Registry centroids + manual steward '
  'fill for the 9-site seed list (R-3).';

COMMENT ON COLUMN matrix_map.samples.coordinate_quality_tier IS
  'Per R-11: high = surveyed coords (solid marker outline); medium = '
  'BC Site Registry centroid (dashed outline + popup tooltip); low = '
  'manual data-steward fill or waterbody-derived (dotted outline + '
  'popup tooltip).';

COMMENT ON COLUMN matrix_map.samples.coordinate_source IS
  'Free-form lineage label: surveyed | bc_csr_centroid | manual_steward '
  '| waterbody_derived | other. Drives the coordinate_quality_tier '
  'mapping during ETL.';

COMMENT ON COLUMN matrix_map.samples.classification IS
  'Per R-1: DRA-derived primary classification (station_type field from '
  'source DRA tables). reference = clean baseline; impacted = '
  'contaminated; unknown = sampling-type stations + DRA-silent stations. '
  'Screening-only authority -- not regulator-adjudicated. Override path '
  'via classification_overrides (data-steward fill; v1.x functional UI).';

COMMENT ON COLUMN matrix_map.samples.classification_source IS
  'Per R-1: station_type = DRA-derived (primary); steward = data-'
  'steward override; data_unknown = DRA-silent / sampling-type fallback; '
  'bkgd_groundwater = bkgdGroundwater layer derivation (scoped to '
  'groundwater substances only; not the primary classifier for sediment).';

COMMENT ON COLUMN matrix_map.samples.receptor_metadata IS
  'JSONB matching the TS interface at src/types/matrix-map/receptor-'
  'metadata.ts. Receptors flagged here drive future receptor-aware '
  'background statistics (v1.x).';

COMMENT ON COLUMN matrix_map.samples.source_dra_id IS
  'FK to dras.id. Drives the RLS join (samples are visible only if '
  'the source DRA is public OR the authenticated user holds a '
  'private_data_grant for it AND the DRA is not soft-deleted). NULL '
  'allowed for stations without a DRA provenance (rare; flagged for '
  'steward review).';

COMMENT ON COLUMN matrix_map.samples.public IS
  'Per R-10: defaults false. Inherits the source DRA confidentiality '
  'posture; samples.public is denormalized for fast index filtering '
  '(samples_public index) but the authoritative gate is via the RLS '
  'join through dras.public OR has_private_grant.';

CREATE INDEX IF NOT EXISTS samples_geom_gist
  ON matrix_map.samples USING GIST (geometry);

CREATE INDEX IF NOT EXISTS samples_classification
  ON matrix_map.samples (classification);

CREATE INDEX IF NOT EXISTS samples_public
  ON matrix_map.samples (public);

CREATE INDEX IF NOT EXISTS samples_source_dra_id
  ON matrix_map.samples (source_dra_id);


-- =====================================================================
-- SECTION 3 -- sample_events
-- =====================================================================
-- One row per sampling visit at a station. Multiple events per
-- sample_id over time. ON DELETE CASCADE because an event has no
-- meaning without its station; the cascade is bounded by the
-- ETL-only invariant that samples are never hard-deleted (steward
-- workflow would soft-flag via a future v1.x column).

CREATE TABLE IF NOT EXISTS matrix_map.sample_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bnrrm_event_id  integer UNIQUE,
  sample_id       uuid NOT NULL REFERENCES matrix_map.samples(id) ON DELETE CASCADE,
  event_date      date NOT NULL,
  pre_remediation boolean,
  depth_min_m     numeric,
  depth_max_m     numeric,
  sampling_method text,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE matrix_map.sample_events IS
  'One row per sampling visit at a station. Multiple events per '
  'sample_id over time. pre_remediation flag (when known) lets the '
  'Selection Stats panel exclude post-remediation observations from '
  'background-baseline computation per R-13 methodology appendix.';

COMMENT ON COLUMN matrix_map.sample_events.bnrrm_event_id IS
  'Foreign reference to bnrrm_training.db events.event_id. UNIQUE for '
  'idempotent ETL.';

COMMENT ON COLUMN matrix_map.sample_events.pre_remediation IS
  'Tri-state: true = sampled BEFORE remediation works at the site; '
  'false = sampled AFTER remediation; NULL = unknown / no remediation '
  'context. Selection Stats v1.x methodology may filter by this.';

CREATE INDEX IF NOT EXISTS sample_events_sample_id
  ON matrix_map.sample_events (sample_id);

CREATE INDEX IF NOT EXISTS sample_events_date
  ON matrix_map.sample_events (event_date);


-- =====================================================================
-- SECTION 4 -- substances
-- =====================================================================
-- Canonical substance dictionary (chemical analyte registry). key is
-- the slug used in URLs + SharedGlobalInputs; cas_number is the
-- authoritative cross-reference; aliases capture the messy real-world
-- naming variations across DRAs (B[a]P / BaP / benzo(a)pyrene / etc.).

CREATE TABLE IF NOT EXISTS matrix_map.substances (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key               text NOT NULL UNIQUE,
  display_name      text NOT NULL,
  cas_number        text,
  aliases           jsonb,
  contaminant_class text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE matrix_map.substances IS
  'Canonical substance dictionary keyed by slug + CAS number. aliases '
  'JSONB normalizes DRA-source naming variation (e.g. ["benzo(a)pyrene", '
  '"B[a]P", "BAP"]). contaminant_class enables grouping (metals / PAH / '
  'pesticide / etc.) for the Calculator SharedGlobalInputs picker.';

COMMENT ON COLUMN matrix_map.substances.key IS
  'URL-safe slug (e.g. "benzo_a_pyrene"). UNIQUE; stable across re-ETL.';

COMMENT ON COLUMN matrix_map.substances.cas_number IS
  'Chemical Abstracts Service number (e.g. "50-32-8"). Nullable for '
  'composite analytes (e.g. TPH, total PCBs).';

CREATE INDEX IF NOT EXISTS substances_cas
  ON matrix_map.substances (cas_number);


-- =====================================================================
-- SECTION 5 -- measurements
-- =====================================================================
-- One row per analyte measurement at an event. Carries raw_value /
-- raw_unit alongside normalized value/unit for audit (the bridge token
-- snapshot captured at PR-MAP-6 must be able to reproduce the source
-- reading). censored + qualifier + detection_limit drive the 1/2-DL
-- substitution policy in v1 (and ROS in v1.x per R-13).

CREATE TABLE IF NOT EXISTS matrix_map.measurements (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bnrrm_chemistry_id  integer UNIQUE,
  sample_event_id     uuid NOT NULL REFERENCES matrix_map.sample_events(id) ON DELETE CASCADE,
  substance_id        uuid NOT NULL REFERENCES matrix_map.substances(id),
  medium              text NOT NULL CHECK (
    medium IN ('sediment', 'water', 'tissue', 'toxicity', 'community')
  ),
  value               numeric NOT NULL,
  unit                text NOT NULL,
  raw_value           numeric,
  raw_unit            text,
  detection_limit     numeric,
  qualifier           text,
  censored            boolean NOT NULL DEFAULT false,
  method              text,
  lab                 text,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE matrix_map.measurements IS
  'Per-analyte measurements backing the selection. v1 ships sediment + '
  'toxicity + community + env_modifiers (water + tissue deferred to '
  'v1.x per plan v3 section 2). raw_value/raw_unit preserved alongside '
  'normalized value/unit for bridge-audit reproducibility (PR-MAP-6).';

COMMENT ON COLUMN matrix_map.measurements.medium IS
  'sediment / water / tissue / toxicity / community. v1.x will add unit '
  'enums per medium; v1 keeps unit as free text for ETL simplicity.';

COMMENT ON COLUMN matrix_map.measurements.value IS
  'NORMALIZED numeric value in canonical unit per medium. For censored '
  'observations the v1 default is 1/2 detection_limit substitution per '
  'R-13 methodology appendix (screening-only label); the raw_value/'
  'raw_unit pair preserves the source reading.';

COMMENT ON COLUMN matrix_map.measurements.qualifier IS
  'Source-data qualifier flag: "<" for censored / "J" estimated / "U" '
  'undetected / etc. censored bool derived from qualifier during ETL.';

COMMENT ON COLUMN matrix_map.measurements.bnrrm_chemistry_id IS
  'Per codex PR-MAP-1 R1 P2-1: idempotency key for BN-RRM ETL. UNIQUE '
  'foreign reference to bnrrm_training.db sediment_chemistry.id so the '
  'ETL can ON CONFLICT DO NOTHING on re-run without duplicating rows. '
  'NULL allowed for non-BN-RRM-sourced rows (none in v1; reserved for '
  'BC EMS / future ingest paths). v1.x BC EMS ETL will use a separate '
  'integer-coded ems_measurement_id column.';

CREATE INDEX IF NOT EXISTS measurements_event
  ON matrix_map.measurements (sample_event_id);

CREATE INDEX IF NOT EXISTS measurements_substance_medium
  ON matrix_map.measurements (substance_id, medium);


-- =====================================================================
-- SECTION 6 -- layers
-- =====================================================================
-- Catalog of WMS + tile layers available on the Matrix Interactive Map.
-- Seeds 4 base tile layers + 14 BC public WMS overlays (per plan v3
-- section 2; data seeding deferred to ETL migration). available_in_
-- matrix_map distinguishes layers that are appropriate for this lane
-- vs other map consumers (BN-RRM SiteMap shares the same catalog).

CREATE TABLE IF NOT EXISTS matrix_map.layers (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key                     text NOT NULL UNIQUE,
  display_name            text NOT NULL,
  tile_url                text,
  wms_layer_name          text,
  attribution             text,
  z_index                 integer NOT NULL DEFAULT 0,
  default_visible         boolean NOT NULL DEFAULT false,
  category                text NOT NULL,
  available_in_matrix_map boolean NOT NULL DEFAULT true,
  created_at              timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE matrix_map.layers IS
  'Catalog of tile + WMS layers. The PR-MAP-2 (map UI) commit will seed '
  '4 base tile layers (streets / satellite / topo / terrain) + 14 BC '
  'public WMS overlays (parks, conservancy, csrSites, bkgdGroundwater, '
  'emsMonitoring, watersheds, wetlands, ecoregions, BEC, etc.) reusing '
  'BN-RRM BASE_LAYERS + OVERLAY_LAYERS catalogs. PR-MAP-1 leaves this '
  'table EMPTY by design (codex PR-MAP-1 holistic P2 disposition): the '
  'PR-MAP-1 ETL ingests samples + measurements only; layer-catalog seeding '
  'lives with the UI commit that consumes it. The /admin/matrix-map/health '
  'page does NOT depend on layers being populated.';

COMMENT ON COLUMN matrix_map.layers.key IS
  'Stable URL-safe slug matching the BN-RRM layer key (e.g. "csrSites" '
  '= the "Remediation layer"). Cross-consumer identifier.';

COMMENT ON COLUMN matrix_map.layers.available_in_matrix_map IS
  'Distinguishes layers approved for this lane vs general catalog. '
  'BN-RRM-only layers (e.g. Jermilova GeoJSON) get available_in_'
  'matrix_map=false per R-11 ("ZERO Jermilova GeoJSON artifacts '
  'carry over").';


-- =====================================================================
-- SECTION 7 -- classification_overrides
-- =====================================================================
-- Audit trail for data-steward classification overrides per R-1.
-- prior_value / new_value capture the transition; rationale + approved_by
-- preserve accountability. v1 admin-only via separate RLS migration;
-- v1.x adds steward propose/approve UI per R-12.

CREATE TABLE IF NOT EXISTS matrix_map.classification_overrides (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sample_id   uuid NOT NULL REFERENCES matrix_map.samples(id),
  prior_value text NOT NULL,
  new_value   text NOT NULL,
  rationale   text NOT NULL,
  confidence  text NOT NULL CHECK (
    confidence IN ('high', 'medium', 'low')
  ),
  approved_by uuid NOT NULL,
  approved_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE matrix_map.classification_overrides IS
  'Audit trail for steward overrides of DRA-derived classifications '
  '(R-1 + R-12). v1 ships as a placeholder table populated via direct '
  'SQL by matrix_admin; v1.x adds the steward propose/approve UI. '
  'No FK from samples.classification back here -- samples carries the '
  'CURRENT classification + classification_source; this table is the '
  'append-only history of transitions.';

COMMENT ON COLUMN matrix_map.classification_overrides.confidence IS
  'Steward confidence in the override decision: high / medium / low. '
  'Surfaced in the Selection Stats panel methodology badge when an '
  'overridden sample contributes to UTL computation.';


-- =====================================================================
-- SECTION 8 -- private_data_grants
-- =====================================================================
-- Per-user per-DRA grants. ON DELETE RESTRICT on dra_id per grants v2
-- codex A-2 (cascade would destroy audit log if a DRA were ever
-- deleted; soft-delete via dras.is_deleted is the only allowed
-- removal path). Unique partial index enforces single active grant
-- per (user, DRA); revoked rows persist for audit. Renew updates the
-- prior row in place (UPSERT semantics per grants v2 section 4.2).

CREATE TABLE IF NOT EXISTS matrix_map.private_data_grants (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL,
  user_email       text NOT NULL,
  dra_id           uuid NOT NULL REFERENCES matrix_map.dras(id) ON DELETE RESTRICT,
  granted_by       uuid NOT NULL,
  granted_by_email text NOT NULL,
  granted_at       timestamptz NOT NULL DEFAULT now(),
  rationale        text NOT NULL,
  expires_at       timestamptz,
  revoked_at       timestamptz,
  revoked_by       uuid,
  revoke_reason    text
);

COMMENT ON TABLE matrix_map.private_data_grants IS
  'Per-user per-DRA access grants. Per grants v2 section 1: granularity '
  'is per-user per-DRA (codex CLEARED). FK to dras ON DELETE RESTRICT '
  'per grants v2 codex A-2 (preserves audit log; dras use soft-delete '
  'via is_deleted instead). user_email + granted_by_email denormalized '
  'per codex A-3 (audit hardening: emails preserved even if auth.users '
  'rows are later modified). DUA columns intentionally omitted per '
  'owner override 2026-05-19 (codex E-1 owner-OVERRIDDEN: "we are not '
  'using DUA in this project"). Grants helper (has_private_grant) + '
  'flip_dra_public RPC + RLS policies land in a separate migration.';

COMMENT ON COLUMN matrix_map.private_data_grants.user_email IS
  'Denormalized for audit per grants v2 codex A-3. The authoritative '
  'identity is user_id (FK target auth.users.id); the email persists '
  'here so revoked / historical grants remain readable even if the '
  'auth.users row is later modified.';

COMMENT ON COLUMN matrix_map.private_data_grants.rationale IS
  'Required free-form admin note describing why this user is being '
  'granted access (e.g. "TWG reviewer assigned to Site 8859 quarterly '
  'review"). Surfaced in the admin grants table + captured in the '
  'bridge_audit.grants_used IMMUTABLE snapshot at PR-MAP-6 bridge fire '
  '(grants v2 codex C-1).';

COMMENT ON COLUMN matrix_map.private_data_grants.expires_at IS
  'Optional grant expiry. NULL = indefinite (admin manually revokes per '
  'Q-G1). Email-on-expiry notification deferred to v1.x per Q-G2.';

COMMENT ON COLUMN matrix_map.private_data_grants.revoked_at IS
  'Soft-revoke timestamp. NULL = active grant; non-NULL = revoked. '
  'MVCC race on in-flight queries documented in grants v2 codex B-4 '
  '(revoke takes effect on NEXT statement only). Unique active-grants '
  'index uses WHERE revoked_at IS NULL so re-grant after revoke is '
  'allowed as a fresh row.';

-- Unique active grant per (user, DRA) -- grants v2 codex A-1. Renew
-- updates the prior row in place; revoked rows are excluded from the
-- uniqueness predicate so a user can be re-granted after a revoke.
CREATE UNIQUE INDEX IF NOT EXISTS private_grants_active_unique
  ON matrix_map.private_data_grants (user_id, dra_id)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS private_grants_user_id
  ON matrix_map.private_data_grants (user_id);

CREATE INDEX IF NOT EXISTS private_grants_dra_id
  ON matrix_map.private_data_grants (dra_id);


-- =====================================================================
-- SECTION 9 -- dra_visibility_audit
-- =====================================================================
-- Atomic audit trail of dras.public flips. Written by the
-- flip_dra_public RPC (separate migration) inside the same transaction
-- as the dras UPDATE per grants v2.1 codex finding B-1 (replacing the
-- earlier trigger pattern that failed under service-role).

CREATE TABLE IF NOT EXISTS matrix_map.dra_visibility_audit (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dra_id           uuid NOT NULL REFERENCES matrix_map.dras(id) ON DELETE RESTRICT,
  prior_value      boolean NOT NULL,
  new_value        boolean NOT NULL,
  changed_at       timestamptz NOT NULL DEFAULT now(),
  changed_by       uuid NOT NULL,
  changed_by_email text NOT NULL,
  reason           text NOT NULL
);

COMMENT ON TABLE matrix_map.dra_visibility_audit IS
  'Audit log of dras.public flips. Per grants v2 codex C-3: enables '
  '"who had access on date X" reconstruction via the join (grants '
  'active during X) + (dra visibility state during X) + (bridge_audit '
  'computations during X). Written atomically by the flip_dra_public '
  'RPC; direct UPDATE on dras.public does NOT auto-create an audit '
  'row (documented contract per grants v2.1 codex finding; admin UI '
  'always routes through the RPC). ON DELETE RESTRICT on dra_id '
  'preserves history even when DRAs are soft-deleted.';

COMMENT ON COLUMN matrix_map.dra_visibility_audit.reason IS
  'Required free-form reason for the visibility flip. The RPC raises '
  'an exception if reason is null or blank (grants v2 section 2.3).';

CREATE INDEX IF NOT EXISTS dra_visibility_audit_dra
  ON matrix_map.dra_visibility_audit (dra_id);


-- =====================================================================
-- SECTION 10 -- service_role_audit
-- =====================================================================
-- Application-policy audit of server-side service_role invocations.
-- Per grants v2 codex C-2: service_role is NEVER exposed to the
-- frontend; only used in server-side Next.js API routes (ETL, daily-
-- budget cron, admin CSV export, admin user-list fetch). Every call
-- through the approved RPC set writes a row here via a wrapper helper.

CREATE TABLE IF NOT EXISTS matrix_map.service_role_audit (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rpc_name        text NOT NULL,
  invoked_at      timestamptz NOT NULL DEFAULT now(),
  invoked_by_role text NOT NULL,
  args_summary    jsonb,
  affected_rows   integer,
  client_ip       inet,
  notes           text
);

COMMENT ON TABLE matrix_map.service_role_audit IS
  'Per grants v2 codex C-2: application-policy audit of server-side '
  'service_role calls into matrix_map. Approved RPCs (initial set): '
  'ETL migration; daily-budget cron; admin CSV export; admin user-list '
  'fetch for grant form. Direct table access via service_role outside '
  'the approved RPC set is forbidden by application policy (RLS does '
  'not gate service_role; the audit table + code review are the '
  'enforcement boundary).';

COMMENT ON COLUMN matrix_map.service_role_audit.args_summary IS
  'JSONB summary of RPC arguments (PII-scrubbed). NOT a verbatim args '
  'log; capture the operational shape (counts, IDs, intent) without '
  'leaking the payload contents.';


-- =====================================================================
-- SECTION 11 -- export_audit
-- =====================================================================
-- Admin-only CSV export audit. selection_token cross-references the
-- bridge_audit row (PR-MAP-6) when an export derives from a bridged
-- selection; standalone exports leave selection_token null.

CREATE TABLE IF NOT EXISTS matrix_map.export_audit (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exported_at     timestamptz NOT NULL DEFAULT now(),
  exported_by     uuid NOT NULL,
  selection_token text,
  row_count       integer NOT NULL,
  bytes           integer,
  filter_summary  jsonb
);

COMMENT ON TABLE matrix_map.export_audit IS
  'Admin-only CSV export audit (PR-MAP-5). selection_token references '
  'matrix_map.bridge_audit.token (table lands in PR-MAP-6) when the '
  'export derives from a Calculator-bridged selection; standalone '
  'exports leave selection_token NULL. filter_summary captures the '
  'filter chips active at export time (medium / QA flag / date range / '
  'classification) for reproducibility.';


-- =====================================================================
-- SECTION 12 -- budget_dimension + budget_caps (5-dimensional breaker per R-6)
-- =====================================================================
-- Per R-6: cost control via a 5-dimensional daily-counter / cap pair.
-- Every server-side RPC + ETL job + export increments the relevant
-- budget_dimension row for today's UTC date. Middleware checks
-- count_value / daily_cap before serving; >= 1.0 returns 503;
-- >= warning_pct surfaces admin-only warning banner.

CREATE TABLE IF NOT EXISTS matrix_map.budget_dimension (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dimension   text NOT NULL CHECK (
    dimension IN ('supabase_reads', 'wms_proxy', 'etl_runs', 'egress_gb', 'csv_exports')
  ),
  ymd         date NOT NULL,
  count_value numeric NOT NULL DEFAULT 0,
  UNIQUE (dimension, ymd)
);

COMMENT ON TABLE matrix_map.budget_dimension IS
  'Per R-6: daily UTC counter per cost dimension. Incremented by server-'
  'side RPCs + ETL jobs + exports via a wrapper helper. Reset at 00:00 '
  'UTC by daily cron (separate migration). UNIQUE (dimension, ymd) '
  'enforces single counter row per (dimension, day); UPSERT increments.';

COMMENT ON COLUMN matrix_map.budget_dimension.dimension IS
  'One of: supabase_reads (postgres read ops via Supabase) / wms_proxy '
  '(BC WMS identify calls proxied through Next.js API) / etl_runs '
  '(daily ETL job count) / egress_gb (cumulative response payload) / '
  'csv_exports (admin CSV exports). Caps in budget_caps.';

CREATE TABLE IF NOT EXISTS matrix_map.budget_caps (
  dimension   text PRIMARY KEY CHECK (
    dimension IN ('supabase_reads', 'wms_proxy', 'etl_runs', 'egress_gb', 'csv_exports')
  ),
  daily_cap   numeric NOT NULL,
  warning_pct numeric NOT NULL DEFAULT 0.80
);

COMMENT ON TABLE matrix_map.budget_caps IS
  'Per R-6: daily cap + warning threshold per dimension. count_value / '
  'daily_cap >= warning_pct surfaces admin-only banner; >= 1.0 returns '
  '503. Per plan v3 section 4.4: caps tightened to ~3x measured baseline '
  'at 2-week mark per owner review. Initial caps seeded below.';

COMMENT ON COLUMN matrix_map.budget_caps.warning_pct IS
  'Fraction of daily_cap above which the admin warning banner shows '
  '(default 0.80 = 80%).';


-- =====================================================================
-- SECTION 13 -- SEED budget_caps (5 starter rows per R-6)
-- =====================================================================
-- Initial daily caps per plan v3 section 4.2. ON CONFLICT DO NOTHING
-- so this migration is idempotent (re-applies do not overwrite owner-
-- tuned cap values).

INSERT INTO matrix_map.budget_caps (dimension, daily_cap, warning_pct) VALUES
  ('supabase_reads', 50000, 0.80),
  ('wms_proxy',      10000, 0.80),
  ('etl_runs',          10, 0.80),
  ('egress_gb',          5, 0.80),
  ('csv_exports',       20, 0.80)
ON CONFLICT (dimension) DO NOTHING;


COMMIT;


-- =====================================================================
-- VERIFICATION (run READ-ONLY after apply):
--
--   -- 1. Schema + 13 tables exist.
--   SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'matrix_map' ORDER BY table_name;
--   -- Expected 13 rows: budget_caps, budget_dimension,
--   --   classification_overrides, dra_visibility_audit, dras,
--   --   export_audit, layers, measurements, private_data_grants,
--   --   sample_events, samples, service_role_audit, substances
--
--   -- 2. Index count = 12 explicit indexes (PRIMARY KEY indexes excluded).
--   --    samples: 4 (geom_gist, classification, public, source_dra_id)
--   --    sample_events: 2 (sample_id, date)
--   --    substances: 1 (cas)
--   --    measurements: 2 (event, substance_medium)
--   --    private_data_grants: 3 (active_unique partial, user_id, dra_id)
--   --    dra_visibility_audit: 1 (dra)
--   --    + UNIQUE (dimension, ymd) on budget_dimension (counts as a constraint-backed index)
--   SELECT indexname FROM pg_indexes
--   WHERE schemaname = 'matrix_map' ORDER BY indexname;
--
--   -- 3. Seed budget_caps = 5 rows.
--   SELECT dimension, daily_cap, warning_pct FROM matrix_map.budget_caps
--   ORDER BY dimension;
--   -- Expected 5 rows summing daily_cap = 60035; all warning_pct = 0.80
--
--   -- 4. CHECK constraints present (samples coordinate_quality_tier,
--   --    classification, classification_source; measurements medium;
--   --    classification_overrides confidence; budget_dimension dimension;
--   --    budget_caps dimension).
--   SELECT conname FROM pg_constraint
--   WHERE conrelid::regclass::text LIKE 'matrix_map.%'
--     AND contype = 'c'
--   ORDER BY conname;
-- =====================================================================
-- =====================================================================
-- PR-MAP-1 -- matrix_map RLS, helpers, RPC, GRANTs
-- =====================================================================
--
-- Branch:  feat/matrix-map-pr-map-1-schema
-- Pairs:   20260519000001_matrix_map_schema.sql (lands first;
--          this file references its tables + columns 1:1)
-- Lane:    Matrix Interactive Map (PR-MAP-1 of PR-MAP-0..PR-MAP-7)
-- Plan:    .tmp_interactive_map_plan_v3.md (v3.4.2 LOCKED, codex-GREEN
--          through 8 rounds + owner sign-off on R-1..R-14 residuals)
-- Grants:  .tmp_private_grants_design_v2.md (v2.3, codex 14 findings
--          disposed; v2.1 trigger-vs-RPC pivot folded in)
-- Style:   Mirrors 20260515_matrix_security_audit.sql
--          (SECURITY DEFINER + SET search_path + ALTER FUNCTION OWNER
--           + REVOKE PUBLIC + narrow GRANTs + admin gate inside body).
--
-- SCOPE OF THIS FILE:
--   - CREATE ROLE matrix_map_owner NOLOGIN (function owner; non-login)
--   - 2 SECURITY DEFINER helpers:
--       matrix_map.is_email_allowlisted(text) -> boolean
--       matrix_map.has_private_grant(uuid)    -> boolean
--   - 1 SECURITY DEFINER RPC:
--       matrix_map.flip_dra_public(uuid, boolean, uuid, text) -> void
--   - ENABLE RLS + explicit policies on 5 tables:
--       dras, samples, sample_events, measurements, private_data_grants
--     (codex grants v2 B-3: explicit cascade, NOT auto-cascading FKs)
--   - Per-table GRANTs to authenticated + service_role
--   - Commented-out verification SQL block at end
--
-- NEW user_roles ROLE VALUE: 'matrix_admin'
--   This is a value of public.user_roles.role (NOT a Postgres role).
--   Convention follows public.is_admin() / matrix_security_audit pattern:
--     EXISTS (SELECT 1 FROM public.user_roles
--             WHERE user_id = auth.uid()
--               AND role IN ('admin', 'matrix_admin'))
--   Principle of least surprise: global 'admin' implicitly grants
--   'matrix_admin' privileges (admin > matrix_admin). matrix_admin is
--   the fine-grained role for TWG matrix-map admins who should NOT
--   gain global admin powers across the SSTAC dashboard.
--
--   STATE AS OF 2026-05-19 (verified via Supabase state-discovery SQL):
--     public.user_roles.role distinct values currently in use:
--       'admin'   -- 3 rows (existing global admins)
--       'member'  -- 50 rows (existing regular dashboard users)
--     ZERO existing rows have role = 'matrix_admin'. This migration
--     does NOT auto-populate matrix_admin grants. Owner / global admin
--     must INSERT user_roles rows manually to grant matrix_admin to
--     TWG matrix-map admins as they opt in (sample INSERT in the
--     deployment runbook at docs/design/matrix-map/README.md). Until
--     such inserts land, only the 3 existing 'admin' rows can call
--     flip_dra_public / manage grants / read audit tables -- which
--     IS the intended v1 dev-allowlist posture per R-5.
--
-- DEV ALLOWLIST CONVENTION (R-5):
--   is_email_allowlisted(jwt_email) returns true iff the email
--   corresponds to a user_id that has ANY row in public.user_roles.
--   Initially: jasen.nelson@gmail.com only. TWG members opt in by
--   being added to public.user_roles (admin or matrix_admin row;
--   any non-empty role qualifies for allowlisting). This collapses
--   "is_allowlisted" into "has a user_roles row" -- one source of
--   truth instead of two divergent tables. Expansion path: admin
--   adds a user_roles row, no schema change required.
--
-- OUT OF SCOPE (separate migrations):
--   - ETL seed (samples / dras / substances / layers rows)
--   - matrix_map.bridge_audit (PR-MAP-6; token contract sign-off gate)
--   - Daily-budget cron + RPC wrappers (separate migration)
--   - Admin UI RPCs for grants management (PR-MAP-7)
--   - auth.users delete trigger (soft-revokes grants; PR-MAP-7)
--
-- PRE-FLIGHT VERIFICATION (run READ-ONLY before applying):
--
--   -- Confirm schema + tables exist (schema migration applied first).
--   SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'matrix_map' ORDER BY table_name;
--   -- Expected 13 rows (per 20260519000001 verification block).
--
--   -- Confirm public.user_roles exists (anchor for admin/matrix_admin
--   -- gating + allowlist convention).
--   SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_schema = 'public' AND table_name = 'user_roles'
--   ORDER BY ordinal_position;
--   -- Expected: at minimum user_id uuid, role text.
--
--   -- Confirm matrix_map_owner role does NOT already exist on first
--   -- apply (subsequent re-applies are guarded by DO-block IF NOT EXISTS).
--   SELECT rolname FROM pg_roles WHERE rolname = 'matrix_map_owner';
-- =====================================================================

BEGIN;


-- =====================================================================
-- SECTION 0 -- SEARCH_PATH + STATEMENT-LOCAL DEFAULTS
-- =====================================================================
-- Statement-local search_path so unqualified lookups in this migration
-- resolve cleanly. Production session search_path is not modified.

SET LOCAL search_path = matrix_map, public, pg_catalog;


-- =====================================================================
-- SECTION 0.1 -- WIDEN public.user_roles.role CHECK CONSTRAINT
-- =====================================================================
-- Verified 2026-05-19 via Supabase state-discovery SQL (pg_constraint
-- query against public.user_roles): the live CHECK is
--   CHECK (role = ANY (ARRAY['admin'::text, 'member'::text]))
-- and matrix_admin is NOT yet allowed. PR-MAP-1 introduces matrix_admin
-- as a fine-grained role for TWG matrix-map admins (admin > matrix_admin
-- hierarchy). Without widening the constraint, the runbook step that
-- INSERTs user_roles(user_id, 'matrix_admin', ...) fails on the CHECK.
--
-- Approach: DROP IF EXISTS + ADD with the widened set. Idempotent.
-- Preserves existing 'admin' (3 rows) + 'member' (50 rows). Adds
-- 'matrix_admin' as a permitted value with zero auto-population.
--
-- This is a PUBLIC-schema change (not matrix_map), but it is logically
-- a prerequisite for the matrix_admin role-gating that the matrix_map
-- RLS policies + flip_dra_public RPC depend on. Keeping it in this
-- migration (rather than a separate file) preserves atomicity: if any
-- later section of this transaction fails, the constraint widening
-- rolls back with it.

ALTER TABLE public.user_roles
  DROP CONSTRAINT IF EXISTS user_roles_role_check;

ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_role_check
  CHECK (role IN ('admin', 'member', 'matrix_admin'));

COMMENT ON CONSTRAINT user_roles_role_check ON public.user_roles IS
  'Widened by PR-MAP-1 RLS migration on 2026-05-19 to include '
  'matrix_admin per plan v3.4.2 + grants v2.3 fine-grained role design. '
  'Prior values admin + member preserved.';


-- =====================================================================
-- SECTION 1 -- ROLE: matrix_map_owner (NON-LOGIN function owner)
-- =====================================================================
-- Per grants v2 codex B-1: helper + RPC functions are owned by a
-- dedicated NON-LOGIN role so SECURITY DEFINER privilege escalation is
-- bounded to the matrix_map surface. matrix_map_owner cannot log in,
-- has no table grants of its own beyond what this migration confers,
-- and exists solely to be the proowner for the 3 functions below.
--
-- The function bodies enforce the actual privilege contract; the OWNER
-- assignment is the SECURITY DEFINER execution-context lever. Without
-- a dedicated owner the functions would inherit the migration runner's
-- privileges (typically postgres / supabase_admin) which is broader
-- than needed.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'matrix_map_owner') THEN
    CREATE ROLE matrix_map_owner NOLOGIN;
  END IF;
END
$$;

-- GRANT membership in matrix_map_owner to postgres so the migration
-- runner can ALTER FUNCTION ... OWNER TO matrix_map_owner below.
-- Per codex PR-MAP-1 amend #2 caught at deploy gate 2026-05-19: the
-- Supabase SQL editor runs queries as the postgres role (rolsuper=false
-- per state-discovery), and Postgres requires the executing role to be
-- a member of the target role to transfer object ownership to it. The
-- error without this line is "42501: must be able to SET ROLE
-- matrix_map_owner". supabase CLI db push runs as supabase_admin
-- (rolsuper=true) which doesn't hit this; the SQL editor does.
--
-- Membership formally confers matrix_map_owner's privileges to postgres
-- via SET ROLE, but adds NO new effective privileges since postgres
-- already has broader power than matrix_map_owner (BYPASSRLS via its
-- own attribute; CREATEDB; etc.). matrix_map_owner is strictly less
-- privileged (NOLOGIN; no SUPERUSER; no CREATEROLE) and stays NOLOGIN
-- so nobody can use it interactively. The grant just lets postgres
-- temporarily SET ROLE for the ALTER OWNER transfer.
GRANT matrix_map_owner TO postgres;

-- BYPASSRLS attribute: per codex PR-MAP-1 R2 P1-1 -- the 3 SECURITY DEFINER
-- functions matrix_map_owner owns must read/write base tables that are
-- FORCE ROW LEVEL SECURITY (FORCE applies RLS to the table owner too,
-- which here is postgres, not matrix_map_owner). The functions enforce
-- their own caller-predicate checks (admin role membership, auth.uid()
-- match, expires_at gating), so giving the owning role an explicit
-- RLS-bypass path is correct here -- mirrors the way service_role works
-- in Supabase: a NOLOGIN owner with BYPASSRLS, reached only through
-- code we have audited. Without BYPASSRLS, has_private_grant() returns
-- always-false (sees zero rows under FORCE RLS) and flip_dra_public()
-- fails on the dras UPDATE + dra_visibility_audit INSERT.
ALTER ROLE matrix_map_owner BYPASSRLS;

COMMENT ON ROLE matrix_map_owner IS
  'Non-login role; sole purpose is to own matrix_map SECURITY DEFINER '
  'functions (is_email_allowlisted, has_private_grant, flip_dra_public). '
  'Per grants v2 codex B-1: bounds DEFINER privilege escalation to the '
  'matrix_map surface. Per codex PR-MAP-1 R2 P1-1: has BYPASSRLS so the '
  'functions can read/write FORCE-RLS-armed tables (the functions enforce '
  'their own caller predicates: admin/matrix_admin check, auth.uid() = '
  'p_actor_id, expires_at gating). NEVER GRANT this role to a user.';

-- Allow matrix_map_owner USAGE on the schema AND minimum table privileges
-- needed by the 3 SECURITY DEFINER functions it owns. SECURITY DEFINER
-- means the function body executes WITH matrix_map_owner's privileges,
-- not the caller's. Granting only the schema (without table SELECT)
-- would leave the functions failing at runtime with
-- "permission denied for table" -- see codex PR-MAP-1 R1 P1-1.
--
-- Privileges granted (minimum set per function):
--   is_email_allowlisted -- SELECT on auth.users + public.user_roles
--   has_private_grant    -- SELECT on matrix_map.private_data_grants
--   flip_dra_public      -- SELECT + UPDATE on matrix_map.dras
--                        -- INSERT on matrix_map.dra_visibility_audit
--                        -- SELECT on public.user_roles + auth.users
--
-- These grants are scoped tightly: no DELETE on any table; no INSERT
-- on private_data_grants (admin path goes through RLS-gated direct
-- INSERT under matrix_admin policy at SECTION 5). matrix_map_owner is
-- NOLOGIN, so these privileges are only reachable via the 3 owned
-- functions, never via interactive use.
GRANT USAGE  ON SCHEMA matrix_map                          TO matrix_map_owner;
GRANT USAGE  ON SCHEMA auth                                TO matrix_map_owner;
GRANT USAGE  ON SCHEMA public                              TO matrix_map_owner;
GRANT SELECT ON public.user_roles                          TO matrix_map_owner;
GRANT SELECT ON auth.users                                 TO matrix_map_owner;

-- Transient CREATE privilege on matrix_map schema, granted ONLY for
-- the ALTER FUNCTION OWNER statements below (Postgres requires the new
-- owner to hold CREATE on the function's schema, in addition to the
-- membership grant above per codex amend #2). REVOKEd at end of
-- SECTION 4 once all 3 OWNER transfers are done -- matrix_map_owner
-- never needs CREATE in steady state (it owns 3 functions; can't and
-- shouldn't create more).
GRANT CREATE  ON SCHEMA matrix_map                         TO matrix_map_owner;
GRANT SELECT ON matrix_map.private_data_grants             TO matrix_map_owner;
GRANT SELECT, UPDATE ON matrix_map.dras                    TO matrix_map_owner;
GRANT INSERT ON matrix_map.dra_visibility_audit            TO matrix_map_owner;
-- Sequence USAGE not needed: dra_visibility_audit.id uses gen_random_uuid()
-- default, not a sequence; no nextval() call inside the RPC body.
-- Per codex PR-MAP-1 R2 P1-1: USAGE on schema auth + public is explicitly
-- granted (Supabase grants USAGE on public to PUBLIC by default but the
-- safe pattern is to grant explicitly so the migration is self-contained;
-- USAGE on auth is the explicit fix for codex's residual schema-USAGE
-- gap).


-- =====================================================================
-- SECTION 2 -- HELPER: matrix_map.is_email_allowlisted(text) -> boolean
-- =====================================================================
-- Per R-5 + dev allowlist convention (file header SECTION above):
-- email is allowlisted iff the corresponding auth.users row maps to a
-- user_id with at least one row in public.user_roles. This collapses
-- "is_allowlisted" into "has a user_roles row" -- one source of truth.
--
-- Initially the only user_roles row is jasen.nelson@gmail.com; expansion
-- to TWG members happens by adding user_roles rows (operational change,
-- no schema migration). Anonymous callers RAISE EXCEPTION '42501' per
-- the matrix_security_audit.sql convention.
--
-- Function returns boolean only -- cannot leak rows (codex grants v2 B-2).
-- SECURITY DEFINER + owner matrix_map_owner + locked search_path.

CREATE OR REPLACE FUNCTION matrix_map.is_email_allowlisted(p_email text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = matrix_map, public, pg_temp
AS $$
DECLARE
  v_allowed boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'matrix_map.is_email_allowlisted requires authenticated context'
      USING ERRCODE = '42501';
  END IF;

  IF p_email IS NULL OR length(trim(p_email)) = 0 THEN
    RETURN false;
  END IF;

  -- Allowlisted iff the email maps (via auth.users) to a user_id that
  -- has at least one row in public.user_roles. This is the canonical
  -- "is this user known to the SSTAC dashboard role system" check.
  SELECT EXISTS (
    SELECT 1
    FROM auth.users au
    JOIN public.user_roles ur ON ur.user_id = au.id
    WHERE lower(au.email) = lower(p_email)
  )
  INTO v_allowed;

  RETURN COALESCE(v_allowed, false);
END;
$$;

ALTER FUNCTION matrix_map.is_email_allowlisted(text) OWNER TO matrix_map_owner;

REVOKE EXECUTE ON FUNCTION matrix_map.is_email_allowlisted(text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION matrix_map.is_email_allowlisted(text) TO authenticated;
GRANT  EXECUTE ON FUNCTION matrix_map.is_email_allowlisted(text) TO service_role;

COMMENT ON FUNCTION matrix_map.is_email_allowlisted(text) IS
  'Per R-5 + grants v2 codex B-2: returns true iff p_email maps to a '
  'public.user_roles row. SECURITY DEFINER + owned by matrix_map_owner '
  '+ locked search_path. Returns boolean ONLY (cannot leak rows). '
  'Anonymous callers raise 42501. Initially the allowlist = '
  'jasen.nelson@gmail.com; TWG members opt in by being added to '
  'public.user_roles (admin or matrix_admin row).';


-- =====================================================================
-- SECTION 3 -- HELPER: matrix_map.has_private_grant(uuid) -> boolean
-- =====================================================================
-- Per grants v2 section 3.1 + codex B-1/B-2:
-- Returns true iff the calling user has an active, non-expired grant
-- for the given DRA. Used in the RLS USING clause of dras, samples,
-- sample_events, measurements.
--
-- SECURITY DEFINER + owner matrix_map_owner so RLS on
-- private_data_grants does not recurse / block the check. Returns
-- boolean only -- cannot leak grant rows or user identities.

CREATE OR REPLACE FUNCTION matrix_map.has_private_grant(p_dra_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = matrix_map, public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM matrix_map.private_data_grants g
    WHERE g.dra_id = p_dra_id
      AND g.user_id = auth.uid()
      AND g.revoked_at IS NULL
      AND (g.expires_at IS NULL OR g.expires_at > now())
  );
$$;

ALTER FUNCTION matrix_map.has_private_grant(uuid) OWNER TO matrix_map_owner;

REVOKE EXECUTE ON FUNCTION matrix_map.has_private_grant(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION matrix_map.has_private_grant(uuid) TO authenticated;
GRANT  EXECUTE ON FUNCTION matrix_map.has_private_grant(uuid) TO service_role;

COMMENT ON FUNCTION matrix_map.has_private_grant(uuid) IS
  'Per grants v2 section 3.1 + codex B-1/B-2: returns true iff the '
  'calling user has an active (not revoked, not expired) grant for the '
  'given DRA. SECURITY DEFINER + owned by matrix_map_owner. Returns '
  'boolean ONLY (cannot leak rows). Anonymous callers receive false '
  '(auth.uid() returns null; the EXISTS clause matches zero rows). '
  'Used by all 4 cascade-RLS policies (dras, samples, sample_events, '
  'measurements) -- explicit cascade per codex B-3.';


-- =====================================================================
-- SECTION 4 -- RPC: matrix_map.flip_dra_public(uuid, boolean, uuid, text)
-- =====================================================================
-- Per grants v2 section 2.2 + codex v2.1 finding B-1:
-- Atomic UPDATE on dras.public + INSERT into dra_visibility_audit, in
-- one transaction. Replaces the earlier trigger pattern that failed
-- under service_role execution (auth.uid() null; NOT NULL columns
-- violate). The RPC enforces:
--   (1) Caller must be authenticated (auth.uid() not null). service_role
--       CANNOT call this RPC in v1; ETL pathways have their own
--       internal helpers per grants v2 design. This is the deferred
--       action per codex grants-v2.1 (service_role flip path is out of
--       v1 scope).
--   (2) Caller's auth.uid() must match p_actor_id (no actor spoofing).
--   (3) Caller must hold 'admin' OR 'matrix_admin' in public.user_roles.
--   (4) p_reason must be non-empty.
--
-- The matrix_admin role check uses the user_roles convention (NOT
-- raw_app_meta_data) for consistency with public.is_admin() and the
-- matrix_security_audit.sql admin gating pattern. admin > matrix_admin
-- per principle of least surprise: a global admin can always flip.

CREATE OR REPLACE FUNCTION matrix_map.flip_dra_public(
  p_dra_id    uuid,
  p_new_value boolean,
  p_actor_id  uuid,
  p_reason    text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = matrix_map, public, pg_temp
AS $$
DECLARE
  v_prior         boolean;
  v_actor_email   text;
  v_is_authorized boolean;
BEGIN
  -- (1) Must be called from an authenticated user-JWT context.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'flip_dra_public must be called from an authenticated user context (auth.uid() is null); service_role cannot call this RPC'
      USING ERRCODE = '42501';
  END IF;

  -- (2) Caller cannot impersonate a different actor.
  IF auth.uid() <> p_actor_id THEN
    RAISE EXCEPTION 'flip_dra_public actor_id (%) must match caller auth.uid() (%)', p_actor_id, auth.uid()
      USING ERRCODE = '42501';
  END IF;

  -- (3) Caller must hold admin OR matrix_admin role.
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN ('admin', 'matrix_admin')
  )
  INTO v_is_authorized;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'flip_dra_public requires admin or matrix_admin role'
      USING ERRCODE = '42501';
  END IF;

  -- (4) Reason required (grants v2 section 2.3).
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'flip_dra_public requires a non-empty reason';
  END IF;

  -- Resolve actor email from auth.users for the audit row.
  SELECT email INTO v_actor_email FROM auth.users WHERE id = auth.uid();
  IF v_actor_email IS NULL THEN
    RAISE EXCEPTION 'flip_dra_public could not resolve actor email for auth.uid() %', auth.uid();
  END IF;

  -- Lock + read prior value.
  SELECT public INTO v_prior
  FROM matrix_map.dras
  WHERE id = p_dra_id
    AND is_deleted = false
  FOR UPDATE;

  IF v_prior IS NULL THEN
    RAISE EXCEPTION 'dra % not found or is soft-deleted', p_dra_id;
  END IF;

  -- No-op if value unchanged (avoids gratuitous audit rows).
  IF v_prior IS DISTINCT FROM p_new_value THEN
    UPDATE matrix_map.dras
       SET public = p_new_value
     WHERE id = p_dra_id
       AND is_deleted = false;

    INSERT INTO matrix_map.dra_visibility_audit
      (dra_id, prior_value, new_value, changed_at, changed_by, changed_by_email, reason)
    VALUES
      (p_dra_id, v_prior, p_new_value, now(), auth.uid(), v_actor_email, p_reason);
  END IF;
END;
$$;

ALTER FUNCTION matrix_map.flip_dra_public(uuid, boolean, uuid, text)
  OWNER TO matrix_map_owner;

REVOKE EXECUTE ON FUNCTION matrix_map.flip_dra_public(uuid, boolean, uuid, text)
  FROM PUBLIC, anon, service_role;
GRANT  EXECUTE ON FUNCTION matrix_map.flip_dra_public(uuid, boolean, uuid, text)
  TO authenticated;

COMMENT ON FUNCTION matrix_map.flip_dra_public(uuid, boolean, uuid, text) IS
  'Per grants v2 section 2.2 + codex v2.1 finding B-1: atomic flip of '
  'dras.public + audit insert in one transaction. Replaces trigger '
  'pattern that broke under service_role. Enforces: auth.uid() not null '
  '+ auth.uid() = p_actor_id + admin OR matrix_admin role in '
  'public.user_roles + non-empty reason. SECURITY DEFINER + owned by '
  'matrix_map_owner. EXECUTE granted to authenticated ONLY (service_role '
  'explicitly REVOKED per grants-v2.1 deferred action; ETL has separate '
  'internal helpers out of v1 scope).';

-- Revoke the transient CREATE privilege on matrix_map schema now that
-- all 3 ALTER FUNCTION OWNER transfers (SECTIONS 2/3/4) are complete.
-- Per codex amend #2: matrix_map_owner never needs CREATE in steady
-- state; granting it only for the transfer keeps the role's privileges
-- minimal.
REVOKE CREATE ON SCHEMA matrix_map FROM matrix_map_owner;


-- =====================================================================
-- SECTION 5 -- ROW LEVEL SECURITY POLICIES (5 tables)
-- =====================================================================
-- Per grants v2 codex B-3: explicit cascade through dras.id, NOT
-- auto-cascading FKs. Each policy joins through to dras explicitly so
-- the (public OR has_private_grant) + is_deleted=false gate is uniform.
--
-- Convention: SELECT policies gate read visibility via the helpers.
-- INSERT/UPDATE/DELETE on all data tables (dras, samples,
-- sample_events, measurements) are restricted to admin/matrix_admin
-- via public.user_roles. private_data_grants has a self-select policy
-- so users can see their own grants + admin policy for full management.
--
-- FORCE ROW LEVEL SECURITY ensures even the table owner is subject to
-- policies (defense in depth; the matrix_map schema owner role in
-- Supabase may otherwise bypass RLS).


-- ---------------------------------------------------------------------
-- 5.a  matrix_map.dras
-- ---------------------------------------------------------------------
ALTER TABLE matrix_map.dras ENABLE ROW LEVEL SECURITY;
ALTER TABLE matrix_map.dras FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dras_authenticated_select ON matrix_map.dras;
CREATE POLICY dras_authenticated_select
  ON matrix_map.dras
  FOR SELECT
  TO authenticated
  USING (
    matrix_map.is_email_allowlisted(auth.jwt() ->> 'email')
    AND is_deleted = false
    AND (
      public = true
      OR matrix_map.has_private_grant(id)
    )
  );

COMMENT ON POLICY dras_authenticated_select ON matrix_map.dras IS
  'Per R-10 + grants v2 section 3.5: allowlisted authenticated user sees '
  'a DRA iff it is not soft-deleted AND (public=true OR they hold an '
  'active private grant for it).';

DROP POLICY IF EXISTS dras_admin_all ON matrix_map.dras;
CREATE POLICY dras_admin_all
  ON matrix_map.dras
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'matrix_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'matrix_admin')
    )
  );

COMMENT ON POLICY dras_admin_all ON matrix_map.dras IS
  'admin / matrix_admin full CRUD on dras. Direct UPDATE on dras.public '
  'is policy-allowed but the admin UI must route through '
  'matrix_map.flip_dra_public RPC for atomic audit (documented contract '
  'per grants v2.1 codex B-1; not enforced by trigger).';


-- ---------------------------------------------------------------------
-- 5.b  matrix_map.samples
-- ---------------------------------------------------------------------
ALTER TABLE matrix_map.samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE matrix_map.samples FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS samples_authenticated_select ON matrix_map.samples;
CREATE POLICY samples_authenticated_select
  ON matrix_map.samples
  FOR SELECT
  TO authenticated
  USING (
    matrix_map.is_email_allowlisted(auth.jwt() ->> 'email')
    AND source_dra_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM matrix_map.dras d
      WHERE d.id = samples.source_dra_id
        AND d.is_deleted = false
        AND (d.public = true OR matrix_map.has_private_grant(d.id))
    )
  );

COMMENT ON POLICY samples_authenticated_select ON matrix_map.samples IS
  'Per grants v2 section 3.2 + codex B-3 (explicit cascade): allowlisted '
  'authenticated user sees a sample iff its source DRA is visible per '
  'the dras predicate. NULL source_dra_id samples are hidden from non-'
  'admin (rare; flagged for steward review per schema COMMENT).';

DROP POLICY IF EXISTS samples_admin_all ON matrix_map.samples;
CREATE POLICY samples_admin_all
  ON matrix_map.samples
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'matrix_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'matrix_admin')
    )
  );

COMMENT ON POLICY samples_admin_all ON matrix_map.samples IS
  'admin / matrix_admin full CRUD on samples (ETL via service_role '
  'bypasses RLS by default; this policy covers manual admin edits).';


-- ---------------------------------------------------------------------
-- 5.c  matrix_map.sample_events
-- ---------------------------------------------------------------------
ALTER TABLE matrix_map.sample_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE matrix_map.sample_events FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sample_events_authenticated_select ON matrix_map.sample_events;
CREATE POLICY sample_events_authenticated_select
  ON matrix_map.sample_events
  FOR SELECT
  TO authenticated
  USING (
    matrix_map.is_email_allowlisted(auth.jwt() ->> 'email')
    AND EXISTS (
      SELECT 1
      FROM matrix_map.samples s
      JOIN matrix_map.dras d ON d.id = s.source_dra_id
      WHERE s.id = sample_events.sample_id
        AND d.is_deleted = false
        AND (d.public = true OR matrix_map.has_private_grant(d.id))
    )
  );

COMMENT ON POLICY sample_events_authenticated_select ON matrix_map.sample_events IS
  'Per grants v2 section 3.3 + codex B-3 explicit cascade: joins through '
  'samples.source_dra_id to dras. RLS does NOT auto-cascade via FKs.';

DROP POLICY IF EXISTS sample_events_admin_all ON matrix_map.sample_events;
CREATE POLICY sample_events_admin_all
  ON matrix_map.sample_events
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'matrix_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'matrix_admin')
    )
  );

COMMENT ON POLICY sample_events_admin_all ON matrix_map.sample_events IS
  'admin / matrix_admin full CRUD on sample_events.';


-- ---------------------------------------------------------------------
-- 5.d  matrix_map.measurements
-- ---------------------------------------------------------------------
ALTER TABLE matrix_map.measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE matrix_map.measurements FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS measurements_authenticated_select ON matrix_map.measurements;
CREATE POLICY measurements_authenticated_select
  ON matrix_map.measurements
  FOR SELECT
  TO authenticated
  USING (
    matrix_map.is_email_allowlisted(auth.jwt() ->> 'email')
    AND EXISTS (
      SELECT 1
      FROM matrix_map.sample_events e
      JOIN matrix_map.samples s ON s.id = e.sample_id
      JOIN matrix_map.dras    d ON d.id = s.source_dra_id
      WHERE e.id = measurements.sample_event_id
        AND d.is_deleted = false
        AND (d.public = true OR matrix_map.has_private_grant(d.id))
    )
  );

COMMENT ON POLICY measurements_authenticated_select ON matrix_map.measurements IS
  'Per grants v2 section 3.4 + codex B-3 explicit cascade: 2-hop join '
  'through sample_events -> samples -> dras. RLS does NOT auto-cascade.';

DROP POLICY IF EXISTS measurements_admin_all ON matrix_map.measurements;
CREATE POLICY measurements_admin_all
  ON matrix_map.measurements
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'matrix_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'matrix_admin')
    )
  );

COMMENT ON POLICY measurements_admin_all ON matrix_map.measurements IS
  'admin / matrix_admin full CRUD on measurements.';


-- ---------------------------------------------------------------------
-- 5.e  matrix_map.private_data_grants
-- ---------------------------------------------------------------------
ALTER TABLE matrix_map.private_data_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE matrix_map.private_data_grants FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS grants_self_select ON matrix_map.private_data_grants;
CREATE POLICY grants_self_select
  ON matrix_map.private_data_grants
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

COMMENT ON POLICY grants_self_select ON matrix_map.private_data_grants IS
  'Per grants v2 section 3.6: a user can read their OWN grants (so the '
  'reviewer-side partial-visibility banner per codex D-1 can show which '
  'private DRAs they currently have access to). Does NOT expose other '
  'users grants.';

DROP POLICY IF EXISTS grants_admin_all ON matrix_map.private_data_grants;
CREATE POLICY grants_admin_all
  ON matrix_map.private_data_grants
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'matrix_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'matrix_admin')
    )
  );

COMMENT ON POLICY grants_admin_all ON matrix_map.private_data_grants IS
  'admin / matrix_admin full CRUD on private_data_grants. The admin UI '
  '(PR-MAP-7) routes grant creation through an UPSERT pattern (grants '
  'v2 section 4.2 codex A-1 fix) so concurrent admins do not race on '
  'the unique active-grants index.';


-- ---------------------------------------------------------------------
-- 5.f  matrix_map.classification_overrides  (codex PR-MAP-1 R1 P1-2 fix)
-- ---------------------------------------------------------------------
-- v1 has no steward override UI (R-12 deferred to v1.x). Lock down to
-- admin / matrix_admin until the propose/approve workflow lands.
ALTER TABLE matrix_map.classification_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE matrix_map.classification_overrides FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS classification_overrides_admin_all ON matrix_map.classification_overrides;
CREATE POLICY classification_overrides_admin_all
  ON matrix_map.classification_overrides
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'matrix_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'matrix_admin')
    )
  );

COMMENT ON POLICY classification_overrides_admin_all ON matrix_map.classification_overrides IS
  'Per codex PR-MAP-1 R1 P1-2: lock down to admin / matrix_admin until '
  'R-12 propose/approve workflow lands in v1.x. Non-admin users cannot '
  'read or write override rows. The samples RLS surface already exposes '
  'the EFFECTIVE classification + classification_source; override metadata '
  'belongs to the admin audit lane.';


-- ---------------------------------------------------------------------
-- 5.g  matrix_map.dra_visibility_audit  (codex PR-MAP-1 R1 P1-2 fix)
-- ---------------------------------------------------------------------
-- Writes flow exclusively through flip_dra_public RPC (SECURITY DEFINER,
-- owned by matrix_map_owner with INSERT privilege). Direct INSERT from
-- authenticated must be REVOKED so the audit trail cannot be forged.
ALTER TABLE matrix_map.dra_visibility_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE matrix_map.dra_visibility_audit FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dra_visibility_audit_admin_select ON matrix_map.dra_visibility_audit;
CREATE POLICY dra_visibility_audit_admin_select
  ON matrix_map.dra_visibility_audit
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'matrix_admin')
    )
  );

COMMENT ON POLICY dra_visibility_audit_admin_select ON matrix_map.dra_visibility_audit IS
  'Per codex PR-MAP-1 R1 P1-2: SELECT-only to admin / matrix_admin. '
  'No INSERT / UPDATE / DELETE policy on purpose: writes flow ONLY '
  'through matrix_map.flip_dra_public (SECURITY DEFINER, owner = '
  'matrix_map_owner) which has the explicit INSERT grant. Audit trail '
  'integrity is non-negotiable.';


-- ---------------------------------------------------------------------
-- 5.h  matrix_map.service_role_audit  (codex PR-MAP-1 R1 P1-2 fix)
-- ---------------------------------------------------------------------
-- Writes flow exclusively through service_role (server-side ETL +
-- background jobs). Direct INSERT from authenticated must be REVOKED.
ALTER TABLE matrix_map.service_role_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE matrix_map.service_role_audit FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_role_audit_admin_select ON matrix_map.service_role_audit;
CREATE POLICY service_role_audit_admin_select
  ON matrix_map.service_role_audit
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'matrix_admin')
    )
  );

COMMENT ON POLICY service_role_audit_admin_select ON matrix_map.service_role_audit IS
  'Per codex PR-MAP-1 R1 P1-2 + grants v2 codex C-2: SELECT-only to '
  'admin / matrix_admin. service_role bypasses RLS (BYPASSRLS owner '
  'pattern) so its INSERT path is unaffected by the absence of an '
  'INSERT policy. authenticated cannot forge audit rows.';


-- ---------------------------------------------------------------------
-- 5.i  matrix_map.export_audit  (codex PR-MAP-1 R1 P1-2 fix)
-- ---------------------------------------------------------------------
-- CSV export action is admin-only (PR-MAP-5 admin UI); writes flow
-- through service_role from the server-side export route. Direct
-- INSERT from authenticated must be REVOKED.
ALTER TABLE matrix_map.export_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE matrix_map.export_audit FORCE  ROW LEVEL SECURITY;

DROP POLICY IF EXISTS export_audit_admin_select ON matrix_map.export_audit;
CREATE POLICY export_audit_admin_select
  ON matrix_map.export_audit
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'matrix_admin')
    )
  );

COMMENT ON POLICY export_audit_admin_select ON matrix_map.export_audit IS
  'Per codex PR-MAP-1 R1 P1-2: SELECT-only to admin / matrix_admin. '
  'CSV export path (PR-MAP-5) runs through a server-side route using '
  'service_role for the audit insert; no direct INSERT from '
  'authenticated.';


-- =====================================================================
-- SECTION 6 -- PER-TABLE GRANTS (REVOKE-then-GRANT pattern)
-- =====================================================================
-- Per grants v2 codex C-2: service_role is NEVER exposed to the
-- frontend; only used in server-side Next.js API routes. RLS does not
-- gate service_role (BYPASSRLS owner pattern); the application policy
-- + service_role_audit table are the enforcement boundary.
--
-- anon + PUBLIC get nothing (no public read path; the dashboard
-- requires authentication). authenticated gets SELECT on data tables
-- (RLS performs the actual filtering). private_data_grants gets
-- SELECT + INSERT to authenticated so the admin UI server actions can
-- create grants under the admin policy (RLS gates writes to admin
-- role). Audit tables get SELECT + INSERT to authenticated; RLS gates
-- visibility / writes to admin role at SECTION 5 + future admin policy
-- additions.

REVOKE ALL ON SCHEMA matrix_map FROM anon, PUBLIC;
GRANT  USAGE ON SCHEMA matrix_map TO authenticated, service_role;

-- Strip any default-acquired grants then re-grant from a known baseline.
REVOKE ALL ON ALL TABLES    IN SCHEMA matrix_map FROM anon, PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA matrix_map FROM anon, PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA matrix_map FROM anon, PUBLIC;

-- Data tables: SELECT to authenticated; RLS does the per-row filtering.
GRANT SELECT ON matrix_map.dras           TO authenticated;
GRANT SELECT ON matrix_map.samples        TO authenticated;
GRANT SELECT ON matrix_map.sample_events  TO authenticated;
GRANT SELECT ON matrix_map.measurements   TO authenticated;
GRANT SELECT ON matrix_map.substances     TO authenticated;
GRANT SELECT ON matrix_map.layers         TO authenticated;

-- classification_overrides: SELECT to authenticated; admin-only RLS at
-- SECTION 5.f gates the actual read. (Per codex PR-MAP-1 R1 P1-2.)
GRANT SELECT ON matrix_map.classification_overrides TO authenticated;

-- Grants table: SELECT + INSERT to authenticated. SELECT is gated by
-- grants_self_select (own rows) + grants_admin_all (admin sees all);
-- INSERT is gated by grants_admin_all WITH CHECK (admin-only).
GRANT SELECT, INSERT ON matrix_map.private_data_grants TO authenticated;

-- Audit tables (per codex PR-MAP-1 R1 P1-2): SELECT to authenticated;
-- admin-only RLS at SECTION 5.g/h/i gates the read. INSERT is INTENTIONALLY
-- NOT granted: writes flow ONLY through matrix_map.flip_dra_public
-- (dra_visibility_audit) or service_role (service_role_audit, export_audit).
-- This prevents authenticated users from forging audit rows.
GRANT SELECT ON matrix_map.dra_visibility_audit TO authenticated;
GRANT SELECT ON matrix_map.service_role_audit   TO authenticated;
GRANT SELECT ON matrix_map.export_audit         TO authenticated;

-- Budget tables: SELECT to authenticated (admin banner needs to read
-- caps + counts for the warning UI per R-6); writes gated to admin via
-- the daily-cron migration which lands in a separate file.
GRANT SELECT ON matrix_map.budget_dimension TO authenticated;
GRANT SELECT ON matrix_map.budget_caps      TO authenticated;

-- service_role: full table access for ETL + cron + server-side API
-- routes. Per grants v2 codex C-2: NEVER exposed to frontend; only
-- used in server-side Next.js routes; every call writes a
-- service_role_audit row via a wrapper helper.
GRANT ALL ON ALL TABLES    IN SCHEMA matrix_map TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA matrix_map TO service_role;

-- Function execution grants (helpers + RPC).
-- Note: the per-function REVOKE PUBLIC + GRANT statements at SECTIONS
-- 2/3/4 are the authoritative grants for these 3 functions; the
-- statements below ensure they survive the bulk REVOKE above.
GRANT EXECUTE ON FUNCTION matrix_map.is_email_allowlisted(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION matrix_map.has_private_grant(uuid)    TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION matrix_map.flip_dra_public(uuid, boolean, uuid, text) TO authenticated;
-- flip_dra_public intentionally NOT granted to service_role (grants
-- v2.1 deferred action; service_role cannot satisfy auth.uid() check).


COMMIT;


-- =====================================================================
-- POST-APPLY VERIFICATION (run READ-ONLY after apply; admin context):
--
--   -- 1. matrix_map_owner role exists, NOLOGIN, BYPASSRLS (per codex R2 P1-1).
--   SELECT rolname, rolcanlogin, rolbypassrls FROM pg_roles WHERE rolname = 'matrix_map_owner';
--   -- Expected: 1 row, rolcanlogin = false, rolbypassrls = true
--
--   -- 2. The 3 functions exist with correct owner + SECURITY DEFINER.
--   SELECT n.nspname AS schema,
--          p.proname AS function,
--          (SELECT rolname FROM pg_roles WHERE oid = p.proowner) AS owner,
--          p.prosecdef AS security_definer
--   FROM pg_proc p
--   JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'matrix_map'
--     AND p.proname IN ('is_email_allowlisted', 'has_private_grant', 'flip_dra_public')
--   ORDER BY p.proname;
--   -- Expected 3 rows; all owner = matrix_map_owner; all security_definer = true
--
--   -- 3. RLS enabled + forced on the 9 protected tables (5 data + 4
--   --    admin/audit per codex PR-MAP-1 R1 P1-2).
--   SELECT c.relname,
--          c.relrowsecurity     AS rls_enabled,
--          c.relforcerowsecurity AS rls_forced
--   FROM pg_class c
--   JOIN pg_namespace n ON n.oid = c.relnamespace
--   WHERE n.nspname = 'matrix_map'
--     AND c.relname IN (
--       'dras','samples','sample_events','measurements','private_data_grants',
--       'classification_overrides','dra_visibility_audit','service_role_audit','export_audit'
--     )
--   ORDER BY c.relname;
--   -- Expected 9 rows; all rls_enabled = true; all rls_forced = true
--
--   -- 4. Policy count per table.
--   SELECT schemaname, tablename, COUNT(*) AS policy_count
--   FROM pg_policies
--   WHERE schemaname = 'matrix_map'
--   GROUP BY schemaname, tablename
--   ORDER BY tablename;
--   -- Expected:
--   --   classification_overrides   1  (admin all)
--   --   dra_visibility_audit       1  (admin select only)
--   --   dras                       2  (select + admin all)
--   --   export_audit               1  (admin select only)
--   --   measurements               2  (select + admin all)
--   --   private_data_grants        2  (self select + admin all)
--   --   sample_events              2  (select + admin all)
--   --   samples                    2  (select + admin all)
--   --   service_role_audit         1  (admin select only)
--   --   TOTAL                     14
--
--   -- 5. flip_dra_public rejects non-admin caller. As an authenticated
--   --    non-admin user, the following must raise EXCEPTION 42501:
--   --      SELECT matrix_map.flip_dra_public(
--   --        '00000000-0000-0000-0000-000000000000'::uuid,
--   --        true,
--   --        auth.uid(),
--   --        'verification test'
--   --      );
--   --    Expected error message includes 'admin or matrix_admin role'.
--
--   -- 6. flip_dra_public rejects service_role caller (EXECUTE revoked).
--   --    As service_role, SELECT on the function must error with
--   --    'permission denied for function flip_dra_public'.
--
--   -- 7. is_email_allowlisted returns false for an unknown email and
--   --    true for jasen.nelson@gmail.com (assuming the user_roles row
--   --    exists). Anon caller raises 42501.
--   --      SELECT matrix_map.is_email_allowlisted('unknown@example.com');
--   --      SELECT matrix_map.is_email_allowlisted('jasen.nelson@gmail.com');
--
--   -- 8. Function execute grants. authenticated must have EXECUTE on
--   --    all 3 functions; anon must have NONE; service_role on the 2
--   --    helpers only.
--   SELECT p.proname,
--          pg_catalog.array_to_string(p.proacl, E'\n') AS acl
--   FROM pg_proc p
--   JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'matrix_map'
--     AND p.proname IN ('is_email_allowlisted','has_private_grant','flip_dra_public')
--   ORDER BY p.proname;
-- =====================================================================
-- =====================================================================
-- PR-MAP-3a -- matrix_map.fetch_samples_with_hidden_summary RPC
-- =====================================================================
--
-- Branch:  feat/matrix-map-pr-map-3a-samples-symbology
-- Lane:    Matrix Interactive Map (PR-MAP-3a of PR-MAP-0..PR-MAP-7)
-- Pairs:   20260519000001_matrix_map_schema.sql (PR-MAP-1; tables)
--          20260519000002_matrix_map_rls.sql    (PR-MAP-1; helpers + RLS)
-- Plan:    docs/design/matrix-map/PR_MAP_3_PLAN.md
--          (canonical 3a design; section 2.2 RPC contract; section 7
--           state-discovery; Q-1..Q-8 owner answers section 10)
-- Grants:  docs/design/matrix-map/PRIVATE_GRANTS_DESIGN_V2_3.md
--          (codex D-1: partial-visibility banner invariant -- no row
--           identifiers leaked; uuids only acceptable, no titles)
-- Style:   Mirrors 20260519000002_matrix_map_rls.sql
--          (SECURITY DEFINER + SET search_path + ALTER FUNCTION OWNER
--           + REVOKE PUBLIC + narrow GRANTs + auth gate inside body).
--
-- SCOPE OF THIS FILE:
--   - Grant matrix_map_owner SELECT on matrix_map.samples (caught at
--     2026-05-20 state-discovery: missing privilege required for the
--     new RPC's SECDEF body).
--   - CREATE OR REPLACE the RPC matrix_map.fetch_samples_with_hidden_summary
--     (signature: jsonb -> jsonb) per PR_MAP_3_PLAN section 2.2.
--   - ALTER FUNCTION OWNER + REVOKE PUBLIC + GRANT authenticated.
--   - Transient CREATE on matrix_map schema (matrix_map_owner) so the
--     ALTER FUNCTION OWNER transfer is permitted under the Supabase SQL
--     editor's postgres role context (per PR-MAP-1 amend #2 pattern).
--
-- Q-N OWNER DEFAULTS APPLIED (per task brief 2026-05-20):
--   Q-1 server-side server action -> RPC returns one coherent jsonb payload
--   Q-2 on-demand DRA URL fetch    -> RPC does NOT include document_url
--                                    or confidentiality_notes; identify
--                                    click in PR-MAP-3b fetches those
--   Q-6 RPC accepts bbox NOW, ignores in v1 body -> p_bbox jsonb DEFAULT
--                                    NULL parameter present but body is
--                                    province-wide; v1.x adds filter
--   (Q-3, Q-4, Q-5, Q-7, Q-8 are frontend-side; not in this migration.)
--
-- OUT OF SCOPE (separate migrations / files):
--   - Frontend wiring (MatrixMap.tsx, SampleLegend.tsx, divIcon factory)
--   - PR-MAP-3b identify panel + popup (separate sub-PR)
--   - PR-MAP-3c partial-visibility banner UI (separate sub-PR; the
--     hidden_* fields land in 3a as zero-valued for empty case and
--     non-zero when matching samples exist, so the RPC contract does
--     not drift across sub-PRs per section 8 risk table row 1)
--
-- PRE-FLIGHT VERIFICATION (run READ-ONLY before applying; matches the
-- 2026-05-20 state-discovery output cited in the task brief):
--
--   -- (a) matrix_map_owner role exists, NOLOGIN, BYPASSRLS.
--   SELECT rolname, rolcanlogin, rolbypassrls FROM pg_roles
--   WHERE rolname = 'matrix_map_owner';
--   -- Expected: 1 row, rolcanlogin=false, rolbypassrls=true.
--
--   -- (b) Helpers exist + are owned by matrix_map_owner.
--   SELECT p.proname,
--          (SELECT rolname FROM pg_roles WHERE oid = p.proowner) AS owner
--   FROM pg_proc p
--   JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'matrix_map'
--     AND p.proname IN ('is_email_allowlisted', 'has_private_grant');
--   -- Expected: 2 rows; both owner = matrix_map_owner.
--
--   -- (c) The new RPC does NOT yet exist (idempotency guard).
--   SELECT p.proname FROM pg_proc p
--   JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'matrix_map'
--     AND p.proname = 'fetch_samples_with_hidden_summary';
--   -- Expected on first apply: 0 rows.
--
--   -- (d) matrix_map_owner has SELECT on dras + private_data_grants but
--   --     NOT on samples (the gap this migration closes).
--   SELECT grantee, table_name, privilege_type
--   FROM information_schema.table_privileges
--   WHERE table_schema = 'matrix_map'
--     AND grantee = 'matrix_map_owner'
--     AND table_name IN ('samples', 'dras', 'private_data_grants')
--   ORDER BY table_name, privilege_type;
--   -- Expected before apply: dras SELECT + UPDATE; private_data_grants
--   -- SELECT. NO samples row. After apply: + samples SELECT.
-- =====================================================================

BEGIN;


-- =====================================================================
-- SECTION 0 -- SEARCH_PATH + SUPABASE ADMIN-MEMBERSHIP PREP
-- =====================================================================
-- Statement-local search_path so unqualified lookups (jsonb, geography,
-- uuid) resolve cleanly against postgis + pg_catalog. Production session
-- search_path is not modified.
SET LOCAL search_path = matrix_map, public, extensions, pg_catalog;

-- GRANT matrix_map_owner TO postgres so the migration runner can issue
-- ALTER FUNCTION ... OWNER TO matrix_map_owner below. Per PR-MAP-1 amend
-- #2 caught at deploy gate 2026-05-19: Supabase SQL editor runs as
-- postgres (rolsuper=false), and Postgres requires the executing role to
-- be a member of the target role to transfer object ownership to it.
-- The error without this line is "42501: must be able to SET ROLE
-- matrix_map_owner". Idempotent (GRANT membership is no-op if already
-- granted). supabase CLI db push runs as supabase_admin (rolsuper=true)
-- which doesn't hit this; the SQL editor does. Same pattern as the
-- PR-MAP-1 RLS migration SECTION 1.
GRANT matrix_map_owner TO postgres;

-- Transient CREATE privilege on the matrix_map schema, granted ONLY for
-- the ALTER FUNCTION OWNER statement in SECTION 2. Postgres requires the
-- new owner to hold CREATE on the function's schema (in addition to the
-- role-membership grant above). REVOKEd at end of this migration (SECTION
-- 3) so matrix_map_owner never holds CREATE in steady state. Same pattern
-- as the PR-MAP-1 RLS migration.
GRANT CREATE ON SCHEMA matrix_map TO matrix_map_owner;


-- =====================================================================
-- SECTION 1 -- MISSING PRIVILEGE GRANT: matrix_map_owner SELECT on samples
-- =====================================================================
-- Verified 2026-05-20 via has_table_privilege probe + state-discovery
-- table_privileges query: matrix_map_owner had SELECT on dras +
-- private_data_grants from PR-MAP-1 (granted in SECTION 1 of the RLS
-- migration) but did NOT have SELECT on samples. The new RPC below needs
-- to read samples (the visible-rows query + the hidden-count query both
-- scan matrix_map.samples), so grant the minimum SELECT here.
--
-- SECDEF + matrix_map_owner ownership means the function body executes
-- with matrix_map_owner's privileges. matrix_map_owner has BYPASSRLS (per
-- PR-MAP-1 RLS migration SECTION 1, codex PR-MAP-1 R2 P1-1), which means
-- it bypasses RLS on samples + dras when reading. BUT BYPASSRLS does NOT
-- confer table SELECT; the base-table grant is still required.
GRANT SELECT ON matrix_map.samples TO matrix_map_owner;


-- =====================================================================
-- SECTION 2 -- RPC: matrix_map.fetch_samples_with_hidden_summary(jsonb)
-- =====================================================================
-- Per PR_MAP_3_PLAN section 2.2 (Option A; recommended):
-- Single SECDEF RPC returns ONE coherent jsonb payload with both the
-- visible-rows array AND the hidden-aggregate counts. The visible-row
-- predicate (source_dra_id NULL OR dras visible) is re-evaluated inside
-- the function body; the hidden-row predicate is the complement (DRA
-- exists AND not soft-deleted AND not public AND no grant for caller).
-- Both queries scan via matrix_map_owner BYPASSRLS, so the function is
-- the single source of truth for visible-vs-hidden.
--
-- Q-6: p_bbox accepted now (jsonb DEFAULT NULL) but IGNORED in v1 body;
-- v1.x will use it to filter by bounding box. Frontend can pass either
-- '{}' or omit / pass NULL in v1.
--
-- Q-2: document_url + confidentiality_notes are NOT projected. PR-MAP-3b
-- identify panel will fetch those on demand via a separate scoped RPC.
--
-- D-1 (grants v2 codex): hidden_dra_ids carries uuids ONLY -- no titles,
-- no citations, no agency, no year. uuid is opaque to anyone without
-- admin access, and the admin contact-form flow can resolve uuid -> title
-- server-side via the admin-only dras_admin_all RLS policy (PR-MAP-1 RLS
-- SECTION 5.a).

CREATE OR REPLACE FUNCTION matrix_map.fetch_samples_with_hidden_summary(
  p_bbox jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = matrix_map, public, extensions, pg_temp
AS $$
DECLARE
  v_caller_email      text;
  v_visible           jsonb;
  v_hidden_sample_count int;
  v_hidden_dra_ids    uuid[];
  v_hidden_dra_count  int;
  v_snapshot          text;
BEGIN
  -- (1) Auth gate: anon callers receive 42501.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'fetch_samples_with_hidden_summary requires authenticated context'
      USING ERRCODE = '42501';
  END IF;

  -- (2) Allowlist gate (same convention as the other matrix_map RLS
  --     surfaces: is_email_allowlisted resolves the JWT email against
  --     auth.users + public.user_roles).
  v_caller_email := (auth.jwt() ->> 'email')::text;
  IF NOT matrix_map.is_email_allowlisted(v_caller_email) THEN
    RAISE EXCEPTION 'caller not on matrix_map allowlist'
      USING ERRCODE = '42501';
  END IF;

  -- (3) p_bbox -- accepted but IGNORED in v1 body (Q-6 future-compat
  --     parameter). v1.x will use ST_Intersects(geometry, bbox_polygon)
  --     to filter samples; v1 returns province-wide. Frontend may pass
  --     NULL, '{}' jsonb, or a GeoJSON Polygon -- all are accepted +
  --     produce the same province-wide result in v1.

  -- (4) Visible samples. Predicate mirrors the PR-MAP-1 RLS samples
  --     SELECT policy (samples_authenticated_select) WITH ONE
  --     DELIBERATE WIDENING: rows with source_dra_id IS NULL are
  --     ALSO included here (the RLS policy hides them from non-admin).
  --     Rationale per PR_MAP_3_PLAN section 4.2 + samples schema
  --     COMMENT: NULL source_dra_id is a "flagged for steward review"
  --     case -- rare; surfaces in the SAMPLE IDENTIFIED panel as
  --     "Source DRA: not recorded". Treating these as visible at the
  --     RPC layer keeps the reviewer-visible sample count honest;
  --     the alternative (silently dropping) would create a population
  --     blind spot that the partial-visibility banner cannot describe
  --     (the banner counts samples behind PRIVATE DRAs, not samples
  --     with no DRA provenance).
  --
  --     Geometry serialization: ST_AsGeoJSON returns a GeoJSON Point
  --     ({type:"Point", coordinates:[lng,lat]}) cast to jsonb. Frontend
  --     reads .coordinates for the [lng, lat] pair; no WKB/WKT parsing.
  SELECT COALESCE(jsonb_agg(row_obj), '[]'::jsonb)
  FROM (
    SELECT
      s.id,
      s.bnrrm_station_id,
      s.station_id,
      s.display_name,
      ST_AsGeoJSON(s.geometry)::jsonb AS geometry,
      s.coordinate_quality_tier,
      s.coordinate_source,
      s.classification,
      s.classification_source,
      s.classification_rationale,
      s.classification_confidence,
      s.source_dra_id,
      s.public,
      s.bc_region,
      s.waterbody,
      s.waterbody_type
    FROM matrix_map.samples s
    LEFT JOIN matrix_map.dras d ON d.id = s.source_dra_id
    WHERE s.source_dra_id IS NULL
       OR (d.is_deleted = false
           AND (d.public = true OR matrix_map.has_private_grant(d.id)))
    ORDER BY s.bnrrm_station_id NULLS LAST, s.id
  ) row_obj
  INTO v_visible;

  -- (5) Hidden sample count: samples whose source DRA EXISTS, is not
  --     soft-deleted, is private, and the caller does NOT hold a grant.
  --     NULL source_dra_id samples are excluded (they're visible per
  --     step 4 -- not hidden).
  SELECT COUNT(*)
  FROM matrix_map.samples s
  JOIN matrix_map.dras d ON d.id = s.source_dra_id
  WHERE d.is_deleted = false
    AND d.public = false
    AND NOT matrix_map.has_private_grant(d.id)
  INTO v_hidden_sample_count;

  -- (6) Hidden DRA ids: uuids ONLY, NO titles / citations / agency /
  --     year (codex grants v2 D-1: banner must not leak row identifiers
  --     for content the caller has no grant for). uuid is acceptable
  --     because admin can resolve uuid -> title server-side via the
  --     admin-only dras_admin_all RLS policy when handling the
  --     contact-form access request from the banner CTA.
  --
  --     DISTINCT on source_dra_id collapses multiple hidden samples in
  --     the same DRA to one uuid. Stable sort by uuid for deterministic
  --     output (helps client-side memoization + makes test snapshots
  --     reproducible).
  SELECT COALESCE(array_agg(d_id ORDER BY d_id), ARRAY[]::uuid[])
  FROM (
    SELECT DISTINCT s.source_dra_id AS d_id
    FROM matrix_map.samples s
    JOIN matrix_map.dras d2 ON d2.id = s.source_dra_id
    WHERE d2.is_deleted = false
      AND d2.public = false
      AND NOT matrix_map.has_private_grant(d2.id)
  ) hidden_dras
  INTO v_hidden_dra_ids;

  -- array_length returns NULL for an empty array in Postgres (not 0).
  -- COALESCE keeps the wire contract integer-typed + non-null. Derive
  -- the count from the array itself (not a separate COUNT(DISTINCT))
  -- so hidden_dra_count cannot drift from length(hidden_dra_ids).
  v_hidden_dra_count := array_length(v_hidden_dra_ids, 1);
  IF v_hidden_dra_count IS NULL THEN
    v_hidden_dra_count := 0;
  END IF;

  -- (7) Snapshot version (for the PR-MAP-6 bridge_audit integrity gate).
  --     v1: text rendering of the latest samples.updated_at; defaults to
  --     now() when the table is empty (e.g. pre-ETL state) so the field
  --     is always present + always a valid timestamp string. v1.x may
  --     switch to a content-addressable digest (e.g. md5 of sorted ids
  --     + updated_at) if HITL wants a tamper-evident token; the contract
  --     stays "opaque text" so the upgrade is non-breaking.
  SELECT COALESCE(MAX(updated_at)::text, now()::text)
  FROM matrix_map.samples
  INTO v_snapshot;

  -- (8) Final payload. Field order matches PR_MAP_3_PLAN section 5.2
  --     wire shape for ease of grep/diff.
  RETURN jsonb_build_object(
    'visible_samples',       v_visible,
    'hidden_sample_count',   v_hidden_sample_count,
    'hidden_dra_count',      v_hidden_dra_count,
    'hidden_dra_ids',        to_jsonb(v_hidden_dra_ids),
    'data_snapshot_version', v_snapshot
  );
END;
$$;

ALTER FUNCTION matrix_map.fetch_samples_with_hidden_summary(jsonb)
  OWNER TO matrix_map_owner;

REVOKE EXECUTE ON FUNCTION matrix_map.fetch_samples_with_hidden_summary(jsonb)
  FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION matrix_map.fetch_samples_with_hidden_summary(jsonb)
  TO authenticated;
-- Intentionally NOT granted to service_role: this is a reviewer-facing
-- UI RPC. service_role bypasses RLS (BYPASSRLS) and has direct table
-- access for ETL + admin jobs; it does not need this aggregation helper.
-- Mirrors flip_dra_public's exclusion of service_role from PR-MAP-1.

COMMENT ON FUNCTION matrix_map.fetch_samples_with_hidden_summary(jsonb) IS
  'Per plan v3.4.2 + PR_MAP_3_PLAN.md section 2.2: atomic visible + '
  'hidden summary. Returns ONE jsonb payload with visible_samples '
  '(RLS-filtered to public OR granted DRAs; NULL source_dra_id samples '
  'included with flag-for-steward semantics), hidden_sample_count, '
  'hidden_dra_count, hidden_dra_ids (uuids only -- no titles, per codex '
  'grants v2 D-1 no-row-identifier-leak invariant), data_snapshot_version. '
  'p_bbox accepted but ignored in v1 (Q-6 future-compat); v1.x adds bbox '
  'filter. Owned by matrix_map_owner + BYPASSRLS so the visibility test '
  'in the WHERE clause uses has_private_grant directly without recursing '
  'back through RLS. EXECUTE granted to authenticated only; service_role '
  'explicitly excluded (this is a reviewer-facing UI RPC, not an ETL '
  'helper).';


-- =====================================================================
-- SECTION 3 -- REVOKE TRANSIENT CREATE PRIVILEGE
-- =====================================================================
-- matrix_map_owner never needs CREATE in steady state (it owns 3 helpers
-- + 1 RPC from PR-MAP-1 plus 1 RPC from this migration; can't and
-- shouldn't create more outside of explicit migrations). Mirrors the
-- PR-MAP-1 RLS migration SECTION 4 cleanup at line 479.
REVOKE CREATE ON SCHEMA matrix_map FROM matrix_map_owner;


COMMIT;


-- =====================================================================
-- POST-APPLY VERIFICATION (run READ-ONLY after apply; admin context):
--
--   -- 1. The new RPC exists, owned by matrix_map_owner, SECURITY DEFINER.
--   SELECT n.nspname AS schema,
--          p.proname AS function,
--          (SELECT rolname FROM pg_roles WHERE oid = p.proowner) AS owner,
--          p.prosecdef AS security_definer,
--          pg_catalog.pg_get_function_arguments(p.oid) AS args,
--          pg_catalog.pg_get_function_result(p.oid)    AS returns
--   FROM pg_proc p
--   JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'matrix_map'
--     AND p.proname = 'fetch_samples_with_hidden_summary';
--   -- Expected: 1 row; owner = matrix_map_owner; security_definer = true;
--   -- args = "p_bbox jsonb DEFAULT NULL"; returns = jsonb.
--
--   -- 2. matrix_map_owner now has SELECT on samples (the new grant).
--   SELECT grantee, table_name, privilege_type
--   FROM information_schema.table_privileges
--   WHERE table_schema = 'matrix_map'
--     AND grantee = 'matrix_map_owner'
--     AND table_name = 'samples'
--   ORDER BY privilege_type;
--   -- Expected: 1 row; privilege_type = SELECT.
--
--   -- 3. Transient CREATE on matrix_map was revoked from matrix_map_owner.
--   SELECT has_schema_privilege('matrix_map_owner', 'matrix_map', 'CREATE') AS can_create;
--   -- Expected: false.
--
--   -- 4. EXECUTE grants on the new RPC: authenticated yes; anon + PUBLIC no.
--   SELECT pg_catalog.array_to_string(p.proacl, E'\n') AS acl
--   FROM pg_proc p
--   JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'matrix_map'
--     AND p.proname = 'fetch_samples_with_hidden_summary';
--   -- Expected ACL contains "authenticated=X/matrix_map_owner" entry;
--   -- no anon entry; no PUBLIC entry.
--
--   -- 5. Test call as authenticated admin (jasen.nelson@gmail.com) on
--   --    empty DB (pre-ETL state per 2026-05-20 state-discovery: samples
--   --    + dras rowcount = 0).
--   SELECT matrix_map.fetch_samples_with_hidden_summary('{}'::jsonb);
--   -- Expected payload:
--   --   {
--   --     "visible_samples":       [],
--   --     "hidden_sample_count":   0,
--   --     "hidden_dra_count":      0,
--   --     "hidden_dra_ids":        [],
--   --     "data_snapshot_version": "<now() iso8601 timestamp>"
--   --   }
--
--   -- 6. Test call as anon (no JWT). Must raise 42501.
--   --    From anon Supabase client:
--   --      select * from rpc('matrix_map_fetch_samples_with_hidden_summary');
--   --    Expected error: "fetch_samples_with_hidden_summary requires
--   --    authenticated context" (SQLSTATE 42501).
--
--   -- 7. Test call as authenticated NON-allowlisted user (no user_roles
--   --    row). Must raise 42501 with message "caller not on matrix_map
--   --    allowlist".
--
--   -- 8. Future smoke (after PR-MAP-1 ETL applies): with 290 samples +
--   --    N public DRAs visible to caller + M private DRAs hidden,
--   --    expect visible_samples length = (samples in visible DRAs +
--   --    samples with NULL source_dra_id), hidden_sample_count =
--   --    (samples in hidden private DRAs), hidden_dra_count = M,
--   --    hidden_dra_ids = uuid array of length M.
-- =====================================================================
-- =====================================================================
-- matrix_map security hardening -- auth.* grants + RLS read policies
-- =====================================================================
--
-- Branch:  feat/matrix-map-security-hardening
-- Pairs:   20260519000001_matrix_map_schema.sql            (PR-MAP-1)
--          20260519000002_matrix_map_rls.sql               (PR-MAP-1)
--          20260520000001_matrix_map_fetch_samples_rpc.sql (PR-MAP-3a)
-- Anchor:  ~/.claude/projects/C--Projects-Regulatory-Review/memory/
--          dashboard_matrix_map_pr_map_3_post_mortem_2026_05_20.md
--
-- WHY THIS MIGRATION EXISTS
--
--   Pre-existing PR-MAP-1 + PR-MAP-3a infra bugs surfaced during the
--   2026-05-20 Path-B recovery state-discovery sweep:
--
--   (A) matrix_map_owner lacks EXECUTE on auth.uid() + auth.jwt().
--       PR-MAP-1 line 221 grants USAGE on schema auth to matrix_map_owner,
--       but Supabase's auth.uid() / auth.jwt() are by default granted
--       only to anon / authenticated / service_role; no implicit grant
--       flows to custom roles. The SECURITY DEFINER body of
--       matrix_map.fetch_samples_with_hidden_summary switches to
--       matrix_map_owner and tries to call auth.uid() (line 177 of
--       20260520000001_matrix_map_fetch_samples_rpc.sql) and auth.jwt()
--       (line 185). Both fail with "ERROR: 42501: permission denied for
--       schema auth". The RPC has never worked end-to-end under auth
--       context; verified by owner running the smoke call in Supabase
--       SQL Editor 2026-05-20 and getting the permission error. Without
--       this grant, /matrix-map renders the "samples data temporarily
--       unavailable" notice in page.tsx's try/catch (line 154-159 of
--       page.tsx).
--
--   (B) Four matrix_map tables (substances, layers, budget_dimension,
--       budget_caps) had RLS DISABLED but were GRANTed SELECT to
--       authenticated by PR-MAP-1 (lines 358-361 of 20260519000002).
--       Supabase Security Advisor flagged all four as rls_disabled_in_
--       public ERROR-level. Owner enabled RLS on all four via Supabase
--       Studio 2026-05-20. The auto-apply enables RLS but does NOT add
--       policies, so the tables are currently DENY-ALL to authenticated.
--       This migration adds the policies so reads work for legitimate
--       callers while the RLS gate remains in place.
--
-- SCOPE OF THIS FILE
--
--   PART A -- auth.* function grants:
--     GRANT EXECUTE ON FUNCTION auth.uid()  TO matrix_map_owner
--     GRANT EXECUTE ON FUNCTION auth.jwt()  TO matrix_map_owner
--     GRANT EXECUTE ON FUNCTION auth.role() TO matrix_map_owner (defensive)
--
--   PART B -- RLS read policies on the 4 auto-RLS'd tables:
--     substances        + layers           -> allowlisted-read for
--       authenticated (mirrors the samples / measurements / dras policy
--       pattern from PR-MAP-1: is_email_allowlisted(auth.jwt()->>'email'))
--     budget_dimension + budget_caps      -> admin-only read for
--       authenticated holding 'admin' OR 'matrix_admin' in user_roles
--       (mirrors the flip_dra_public admin-gate pattern from PR-MAP-1
--       line 408)
--
-- DESIGN NOTES
--
--   1. PART A uses GRANT EXECUTE -- the minimum privilege required.
--      We do NOT grant ALL on schema auth (over-permission). The
--      auth.users SELECT grant from PR-MAP-1 line 224 is preserved.
--   2. PART B policies are SELECT-only. INSERT/UPDATE/DELETE on these
--      tables is reserved for service_role (ETL) + matrix_admin-mediated
--      flows. RLS for those write paths can be added later if needed;
--      today they are inaccessible to authenticated entirely.
--   3. budget_caps + budget_dimension are admin-only because they expose
--      cost-control telemetry (daily caps, current usage); leaking them
--      to all reviewers would tip our hand on cost-headroom.
--   4. substances + layers are global lookup tables (no per-user
--      sensitivity) BUT the allowlist gate matches the rest of
--      matrix_map -- "anon: ZERO access" per PLAN_V3_4_2 section 4.3.
--      Without the gate, the public lookup data would still leak the
--      EXISTENCE of an authenticated session and the matrix_map schema.
--      The allowlist gate is also the universal "is this a real TWG
--      reviewer / admin" check the rest of the schema uses.
--   5. Policies are CREATE POLICY ... FOR SELECT TO authenticated.
--      anon gets nothing (RLS deny-default after ENABLE ROW LEVEL
--      SECURITY). service_role bypasses RLS entirely (ETL path).
--   6. IF NOT EXISTS guards on the policies so re-running the migration
--      after a partial-apply or rollback-then-redeploy is idempotent.
--
-- PRE-FLIGHT (run READ-ONLY before applying; see also
-- .tmp_state_discovery_matrix_map_auth_grant_2026_05_20.sql):
--
--   -- 1. matrix_map_owner lacks EXECUTE on auth.uid (the bug we fix).
--   SELECT routine_name, grantee, privilege_type
--   FROM information_schema.routine_privileges
--   WHERE routine_schema = 'auth'
--     AND routine_name IN ('uid', 'jwt', 'role')
--     AND grantee = 'matrix_map_owner';
--   -- Expected before apply: 0 rows.  After apply: 3 rows.
--
--   -- 2. All 4 tables RLS-enabled + zero policies (the gap we fill).
--   SELECT tablename, rowsecurity FROM pg_tables
--   WHERE schemaname='matrix_map'
--     AND tablename IN ('substances','layers','budget_dimension','budget_caps');
--   -- Expected before apply: rowsecurity=true on all 4 (auto-applied 2026-05-20).
--   SELECT tablename, COUNT(*) AS policy_count
--   FROM pg_policies
--   WHERE schemaname='matrix_map'
--     AND tablename IN ('substances','layers','budget_dimension','budget_caps')
--   GROUP BY tablename;
--   -- Expected before apply: 0 rows (no policies authored yet).
--
--   -- 3. Helpers + admin convention still match PR-MAP-1 (sanity).
--   SELECT proname, pg_get_function_arguments(oid) FROM pg_proc
--   WHERE proname = 'is_email_allowlisted'
--     AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname='matrix_map');
--   -- Expected: matrix_map.is_email_allowlisted(p_email text).
--
-- Plain ASCII only -- no em-dashes / smart quotes / Unicode arrows.
-- Literal '->' for arrow text. Per L0 CLAUDE.md section 1.1.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- PART A -- auth.* function EXECUTE grants for matrix_map_owner.
--
-- The SECURITY DEFINER bodies in matrix_map (helpers + RPCs) run as the
-- function owner. Without these grants, any auth.uid() / auth.jwt() /
-- auth.role() call inside a SECDEF body owned by matrix_map_owner fails
-- with "ERROR: 42501: permission denied for schema auth". USAGE on the
-- schema (granted in PR-MAP-1 line 221) is necessary but not sufficient;
-- the functions themselves need explicit EXECUTE.
-- ---------------------------------------------------------------------

GRANT EXECUTE ON FUNCTION auth.uid()  TO matrix_map_owner;
GRANT EXECUTE ON FUNCTION auth.jwt()  TO matrix_map_owner;
GRANT EXECUTE ON FUNCTION auth.role() TO matrix_map_owner;

-- ---------------------------------------------------------------------
-- PART B -- RLS read policies on the 4 previously-flagged tables.
--
-- The owner auto-applied ENABLE ROW LEVEL SECURITY via Supabase Studio
-- 2026-05-20 (after the Security Advisor flag). This migration MUST
-- still issue ENABLE + FORCE here so the change is captured in the
-- migration audit trail and a fresh DB rebuilt from migrations alone
-- (e.g. supabase db reset, a clean branch deploy, or a disaster-recovery
-- restore from the migration source) ends in the same RLS-enforced state
-- WITHOUT depending on a Studio click. Codex P1 finding 2026-05-20:
-- CREATE POLICY does NOT activate RLS by itself; without ENABLE, the
-- prior GRANT SELECT on these tables (PR-MAP-1 lines 358-361) would
-- remain unrestricted and the Security Advisor error would re-surface
-- on the rebuilt environment.
--
-- ALTER TABLE ... ENABLE / FORCE ROW LEVEL SECURITY are idempotent --
-- safe to re-issue against the already-enabled live DB. FORCE matches
-- the PR-MAP-1 pattern (applied to private_data_grants / service_role_
-- audit / export_audit) so the matrix_map_owner table-owner cannot
-- bypass RLS through a SECDEF body that reads these tables directly.
--
-- The CREATE POLICY block uses DROP IF EXISTS + CREATE so re-applying
-- after a partial rollback is idempotent.
-- ---------------------------------------------------------------------

ALTER TABLE matrix_map.substances       ENABLE ROW LEVEL SECURITY;
ALTER TABLE matrix_map.substances       FORCE  ROW LEVEL SECURITY;

ALTER TABLE matrix_map.layers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE matrix_map.layers           FORCE  ROW LEVEL SECURITY;

ALTER TABLE matrix_map.budget_dimension ENABLE ROW LEVEL SECURITY;
ALTER TABLE matrix_map.budget_dimension FORCE  ROW LEVEL SECURITY;

ALTER TABLE matrix_map.budget_caps      ENABLE ROW LEVEL SECURITY;
ALTER TABLE matrix_map.budget_caps      FORCE  ROW LEVEL SECURITY;

-- PART B.1 -- substances (global substance lookup table)
-- Allowlisted authenticated users can read all rows. Mirrors the
-- samples / measurements / dras read-policy pattern from PR-MAP-1
-- (is_email_allowlisted(auth.jwt()->>'email')).
DROP POLICY IF EXISTS substances_select_allowlisted ON matrix_map.substances;
CREATE POLICY substances_select_allowlisted
  ON matrix_map.substances
  FOR SELECT
  TO authenticated
  USING (matrix_map.is_email_allowlisted(auth.jwt() ->> 'email'));

COMMENT ON POLICY substances_select_allowlisted ON matrix_map.substances IS
  'Allowlisted-read: any authenticated user whose email maps via auth.users '
  'to a public.user_roles row may read all substance lookup rows. Mirrors '
  'the dras / samples / measurements pattern from PR-MAP-1 RLS migration. '
  'anon gets nothing (RLS deny-default). service_role bypasses RLS for ETL.';

-- PART B.2 -- layers (WMS layer catalog)
-- Same pattern as substances. The catalog drives the left-rail overlay
-- toggles in MatrixMap.tsx (rendered for any allowlisted reviewer).
DROP POLICY IF EXISTS layers_select_allowlisted ON matrix_map.layers;
CREATE POLICY layers_select_allowlisted
  ON matrix_map.layers
  FOR SELECT
  TO authenticated
  USING (matrix_map.is_email_allowlisted(auth.jwt() ->> 'email'));

COMMENT ON POLICY layers_select_allowlisted ON matrix_map.layers IS
  'Allowlisted-read: any authenticated user whose email maps via auth.users '
  'to a public.user_roles row may read the WMS layer catalog. The catalog '
  'powers MatrixMap.tsx left-rail overlay toggles + the future PR-MAP-7 '
  'admin grants UI. Mirrors the substances pattern (B.1).';

-- PART B.3 -- budget_dimension (cost-control current-day rolling counters)
-- Admin-only: only users with 'admin' OR 'matrix_admin' in user_roles
-- may read. Mirrors the flip_dra_public admin gate (PR-MAP-1 line 408).
-- Reviewers without admin role cannot see daily-usage counts (would
-- leak our cost headroom).
DROP POLICY IF EXISTS budget_dimension_admin_select ON matrix_map.budget_dimension;
CREATE POLICY budget_dimension_admin_select
  ON matrix_map.budget_dimension
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'matrix_admin')
    )
  );

COMMENT ON POLICY budget_dimension_admin_select ON matrix_map.budget_dimension IS
  'Admin-only read: only authenticated users holding admin or matrix_admin '
  'in public.user_roles may read daily-usage cost counters. Reviewers '
  'without admin do NOT see budget telemetry. Mirrors the flip_dra_public '
  'admin gate from PR-MAP-1.';

-- PART B.4 -- budget_caps (cost-control daily caps)
-- Same admin-only pattern as budget_dimension.
DROP POLICY IF EXISTS budget_caps_admin_select ON matrix_map.budget_caps;
CREATE POLICY budget_caps_admin_select
  ON matrix_map.budget_caps
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('admin', 'matrix_admin')
    )
  );

COMMENT ON POLICY budget_caps_admin_select ON matrix_map.budget_caps IS
  'Admin-only read: only authenticated users holding admin or matrix_admin '
  'in public.user_roles may read daily-cap thresholds. Mirrors B.3.';

COMMIT;

-- =====================================================================
-- POST-APPLY VERIFICATION (run READ-ONLY after the migration applies):
--
--   -- (a) Part A: 3 EXECUTE rows for matrix_map_owner on auth.*.
--   SELECT routine_name, grantee, privilege_type
--   FROM information_schema.routine_privileges
--   WHERE routine_schema = 'auth'
--     AND routine_name IN ('uid', 'jwt', 'role')
--     AND grantee = 'matrix_map_owner';
--
--   -- (b) Part B: 4 policies exist (one per table).
--   SELECT schemaname, tablename, policyname, cmd, roles
--   FROM pg_policies
--   WHERE schemaname = 'matrix_map'
--     AND tablename IN ('substances','layers','budget_dimension','budget_caps')
--   ORDER BY tablename, policyname;
--
--   -- (c) End-to-end smoke: the RPC that errored at line 11
--   --     (auth.uid()) now succeeds.
--   SELECT jsonb_typeof(matrix_map.fetch_samples_with_hidden_summary(NULL::jsonb));
--   -- Expected: 'object'  (the previous error was 42501: permission denied).
--
--   -- (d) Allowlisted read of substances + layers works for an
--   --     authenticated user with a user_roles row (run from the
--   --     dashboard, NOT from the SQL editor as postgres):
--   SELECT COUNT(*) FROM matrix_map.substances;
--   SELECT COUNT(*) FROM matrix_map.layers;
--   -- Expected: non-zero counts (full catalogs visible).
--
--   -- (e) Admin-only read of budget_* works only for admin / matrix_admin.
--   --     Run as a non-admin allowlisted user first (should return 0
--   --     rows due to RLS denial), then as admin (should return rows).
--   SELECT COUNT(*) FROM matrix_map.budget_dimension;
--   SELECT COUNT(*) FROM matrix_map.budget_caps;
--
--   -- (f) Supabase Security Advisor re-scan: zero rls_disabled_in_public
--   --     ERRORs for matrix_map. (auto-fixed earlier by owner; this
--   --     check confirms it stuck after policies landed.)
-- =====================================================================
-- =====================================================================
-- matrix_map JWT-via-current-setting refactor
-- =====================================================================
--
-- Branch:  feat/matrix-map-jwt-via-current-setting
-- Pairs:   20260519000002_matrix_map_rls.sql               (PR-MAP-1)
--          20260520000001_matrix_map_fetch_samples_rpc.sql (PR-MAP-3a)
--          20260520000003_matrix_map_security_hardening.sql (this lane)
--
-- WHY THIS MIGRATION EXISTS
--
--   The prior 20260520000003 security-hardening migration attempted to
--   GRANT EXECUTE on auth.uid / auth.jwt / auth.role to matrix_map_owner.
--   Empirical verification 2026-05-20 (owner ran VERIFY 1-4 from
--   .tmp_state_discovery_matrix_map_auth_grant_2026_05_20.sql in the
--   Supabase SQL Editor) showed:
--
--     VERIFY 1: 0 rows -- the GRANT EXECUTE statements never landed.
--     VERIFY 2: matrix_map_owner has_auth_usage = false. Custom roles
--               (matrix_map_owner, authenticator) lack USAGE on auth
--               schema; default-granted roles (authenticated, service_
--               role, postgres) have it.
--     VERIFY 3: 4 policies present (PART B did land).
--     VERIFY 4: auth.uid / auth.jwt / auth.role all owned by
--               supabase_auth_admin.
--
--   Root cause: Supabase managed DB locks down the auth schema. The
--   postgres role cannot SET ROLE supabase_auth_admin (confirmed by
--   owner 2026-05-20: "permission denied to set role supabase_auth_
--   admin"), and only supabase_auth_admin can GRANT on functions it
--   owns. There is no SQL-Editor-accessible path to grant USAGE on the
--   auth schema (or EXECUTE on auth.*) to a custom role like
--   matrix_map_owner. This is by Supabase managed-DB design.
--
--   Impact: every matrix_map function OWNED BY matrix_map_owner that
--   calls auth.uid() / auth.jwt() / reads auth.users fails under its
--   SECURITY DEFINER body with:
--     ERROR: 42501: permission denied for schema auth
--   The functions affected are:
--     - matrix_map.is_email_allowlisted(text)           (PR-MAP-1)
--     - matrix_map.has_private_grant(uuid)              (PR-MAP-1)
--     - matrix_map.flip_dra_public(uuid,bool,uuid,text) (PR-MAP-1)
--     - matrix_map.fetch_samples_with_hidden_summary    (PR-MAP-3a)
--
--   RLS POLICIES that call auth.uid() / auth.jwt() are NOT affected --
--   policy predicates run in the calling role's context (authenticated),
--   not in the table owner's context, so they retain auth schema access.
--
-- FIX APPROACH
--
--   Add two small helper functions in the matrix_map schema that read
--   the JWT claims directly from the session-local PostgreSQL GUC
--   `request.jwt.claims` that PostgREST sets per-request. This GUC is
--   accessible to ANY role via the built-in pg_catalog current_setting()
--   function -- no auth schema dependency.
--
--     matrix_map.current_user_id() -> uuid
--       returns the JWT 'sub' claim as uuid (or NULL if no session).
--       Drop-in replacement for auth.uid() inside matrix_map SECDEF
--       bodies.
--
--     matrix_map.jwt_claims() -> jsonb
--       returns the full JWT claims jsonb (or NULL if no session).
--       Drop-in replacement for auth.jwt() inside matrix_map SECDEF
--       bodies.
--
--   Then CREATE OR REPLACE each of the 4 affected functions with bodies
--   that use the helpers instead of auth.* calls. is_email_allowlisted
--   + flip_dra_public additionally need to bypass their auth.users reads
--   (matrix_map_owner cannot reference auth.users without USAGE on the
--   auth schema). Both reads were resolving the caller's email; the JWT
--   carries the email claim directly so we read it from the JWT instead.
--
-- BEHAVIOR PRESERVATION
--
--   Every function signature is preserved IDENTICALLY. Every
--   ALTER FUNCTION ... OWNER + REVOKE/GRANT statement is re-issued so
--   the migration is self-contained on a fresh DB.
--
--   Two SUBTLE semantic changes worth flagging (both safe; both more
--   robust than the prior auth.users-roundtrip):
--
--   1. is_email_allowlisted(p_email) previously matched the parameter
--      against auth.users.email then looked up user_roles by that
--      user_id. The new body looks up user_roles directly by the JWT
--      sub claim, IGNORING the p_email parameter. Equivalent for the
--      canonical call sites (RLS policies + fetch_samples both pass
--      auth.jwt() ->> 'email' which always belongs to the caller). MORE
--      robust because (a) sub is canonical identity vs email which may
--      vary in case / be NULL / be spoofable in some JWT-issuer
--      scenarios, and (b) avoids the auth.users join entirely. The
--      parameter is retained in the signature for backward compatibility
--      (so existing RLS policies don't need to be re-authored).
--
--   2. flip_dra_public previously did `SELECT email FROM auth.users
--      WHERE id = auth.uid()` to populate the audit row. The new body
--      reads `email` from the JWT claims directly. Equivalent for the
--      canonical Supabase JWT issuer (GoTrue) which always includes
--      email. Raises a clear error if email is unavailable.
--
-- WHAT THIS MIGRATION DOES NOT TOUCH
--
--   - RLS policies (Category 2 in the auth.* grep). Those run in
--     caller context and retain their auth.uid() / auth.jwt() calls.
--   - The PART A grants from 20260520000003 (they were no-ops anyway;
--     leaving them in the migration history as documented intent +
--     idempotent harmless re-issue).
--   - The PART B RLS policies from 20260520000003 (already landed
--     correctly per VERIFY 3).
--
-- IDEMPOTENCY: Wrapped in BEGIN/COMMIT. All CREATE OR REPLACE statements
-- are idempotent. ALTER FUNCTION OWNER + GRANT statements are
-- idempotent. Re-applying the migration after a partial rollback is
-- safe.
--
-- PRE-FLIGHT (run READ-ONLY before applying):
--
--   -- 1. Confirm the 4 broken functions still exist + are owned by
--   --    matrix_map_owner.
--   SELECT n.nspname, p.proname, (SELECT rolname FROM pg_roles WHERE oid=p.proowner) AS owner
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'matrix_map'
--     AND p.proname IN ('is_email_allowlisted', 'has_private_grant',
--                       'flip_dra_public', 'fetch_samples_with_hidden_summary')
--   ORDER BY p.proname;
--   -- Expected: 4 rows; all owner = matrix_map_owner.
--
--   -- 2. Confirm current_setting() is accessible (it is, but proves
--   --    pg_catalog access works for the executing role).
--   SELECT current_setting('search_path', true) AS sp;
--
-- POST-APPLY VERIFICATION at the bottom of this file.
--
-- Plain ASCII only -- no em-dashes / smart quotes / Unicode arrows.
-- Per L0 CLAUDE.md section 1.1.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- SECTION 0 -- TRANSIENT GRANT CREATE for owner-transfer dance.
-- ---------------------------------------------------------------------
-- Codex P1 round 1 (2026-05-20): PR-MAP-1 + PR-MAP-3a both REVOKE
-- CREATE on schema matrix_map from matrix_map_owner at the end of their
-- bodies. ALTER FUNCTION ... OWNER TO matrix_map_owner requires the
-- target owner to hold CREATE on the containing schema. Without this
-- transient grant, the first ALTER FUNCTION OWNER below errors and the
-- whole transaction rolls back before any body refactor lands. Mirror
-- the PR-MAP-1 section 0 / PR-MAP-3a transient-CREATE pattern.
--
-- REVOKEd at the bottom of this file (SECTION 6) so the post-migration
-- state matches PR-MAP-1's REVOKEd posture (matrix_map_owner does NOT
-- retain CREATE on the schema in steady state).
-- ---------------------------------------------------------------------

GRANT CREATE ON SCHEMA matrix_map TO matrix_map_owner;


-- ---------------------------------------------------------------------
-- SECTION 1 -- HELPERS: matrix_map.current_user_id() + jwt_claims()
-- ---------------------------------------------------------------------
-- Both read from current_setting('request.jwt.claims', true). The
-- second arg (missing_ok=true) returns NULL instead of erroring if the
-- GUC is unset (which happens outside PostgREST-mediated calls, e.g.
-- from psql / SQL Editor with no auth session). The NULLIF wrapper
-- normalizes empty-string to NULL (PostgREST sometimes sets the GUC to
-- '' on no-session paths). The ::jsonb cast happens only when the value
-- is non-null + non-empty.
--
-- STABLE -- the GUC is constant within a single transaction. SECDEF is
-- NOT needed here because current_setting() doesn't require special
-- privileges; the helpers are owned by matrix_map_owner only for
-- ergonomics (so other matrix_map SECDEF bodies can call them
-- predictably). EXECUTE is granted to authenticated + service_role for
-- the same reason the existing matrix_map helpers are (consistency).
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION matrix_map.current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SET search_path = matrix_map, pg_catalog
AS $$
  SELECT (
    nullif(current_setting('request.jwt.claims', true), '')::jsonb
      ->> 'sub'
  )::uuid
$$;

ALTER FUNCTION matrix_map.current_user_id() OWNER TO matrix_map_owner;

REVOKE EXECUTE ON FUNCTION matrix_map.current_user_id() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION matrix_map.current_user_id() TO authenticated;
GRANT  EXECUTE ON FUNCTION matrix_map.current_user_id() TO service_role;

COMMENT ON FUNCTION matrix_map.current_user_id() IS
  'Drop-in replacement for auth.uid() inside matrix_map SECDEF bodies '
  'owned by matrix_map_owner. Reads the JWT sub claim from the session-'
  'local request.jwt.claims GUC that PostgREST sets per-request. Avoids '
  'the Supabase managed-DB restriction that prevents granting USAGE on '
  'auth schema (or EXECUTE on auth.uid()) to custom roles. Returns NULL '
  'outside an authenticated PostgREST context (e.g. SQL Editor with no '
  'session). 2026-05-20 incident anchor: dashboard_matrix_map_pr_map_3_'
  'post_mortem_2026_05_20.';


CREATE OR REPLACE FUNCTION matrix_map.jwt_claims()
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = matrix_map, pg_catalog
AS $$
  SELECT nullif(current_setting('request.jwt.claims', true), '')::jsonb
$$;

ALTER FUNCTION matrix_map.jwt_claims() OWNER TO matrix_map_owner;

REVOKE EXECUTE ON FUNCTION matrix_map.jwt_claims() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION matrix_map.jwt_claims() TO authenticated;
GRANT  EXECUTE ON FUNCTION matrix_map.jwt_claims() TO service_role;

COMMENT ON FUNCTION matrix_map.jwt_claims() IS
  'Drop-in replacement for auth.jwt() inside matrix_map SECDEF bodies '
  'owned by matrix_map_owner. Reads the full JWT claims jsonb from the '
  'session-local request.jwt.claims GUC. Sibling to current_user_id(); '
  'same managed-DB-restriction rationale.';


-- ---------------------------------------------------------------------
-- SECTION 2 -- REFACTOR: matrix_map.is_email_allowlisted(text)
-- ---------------------------------------------------------------------
-- Original body (PR-MAP-1 lines 262-294) joined auth.users on lower(email)
-- to look up the user_id, then checked public.user_roles. Both reads fail
-- under matrix_map_owner SECDEF (no USAGE on auth schema).
--
-- New body: read the user_id directly from the JWT sub claim via
-- matrix_map.current_user_id(). Check public.user_roles by user_id
-- directly. The p_email parameter is RETAINED for backward compatibility
-- (existing RLS policies call this with auth.jwt() ->> 'email') but is
-- IGNORED in the body -- the JWT sub is the canonical identity.
--
-- Equivalent for the canonical call sites; more robust than the email
-- roundtrip; see migration header "BEHAVIOR PRESERVATION" note 1.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION matrix_map.is_email_allowlisted(p_email text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = matrix_map, public, pg_temp
AS $$
DECLARE
  v_uid     uuid;
  v_allowed boolean;
BEGIN
  v_uid := matrix_map.current_user_id();

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'matrix_map.is_email_allowlisted requires authenticated context'
      USING ERRCODE = '42501';
  END IF;

  -- Canonical identity = JWT sub. The p_email parameter is intentionally
  -- ignored (kept in the signature for RLS-policy backward compat). See
  -- migration header BEHAVIOR PRESERVATION note 1.
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = v_uid
  )
  INTO v_allowed;

  RETURN COALESCE(v_allowed, false);
END;
$$;

-- Re-issue ownership + grants (idempotent; mirrors PR-MAP-1 lines 296-300).
ALTER FUNCTION matrix_map.is_email_allowlisted(text) OWNER TO matrix_map_owner;

REVOKE EXECUTE ON FUNCTION matrix_map.is_email_allowlisted(text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION matrix_map.is_email_allowlisted(text) TO authenticated;
GRANT  EXECUTE ON FUNCTION matrix_map.is_email_allowlisted(text) TO service_role;

COMMENT ON FUNCTION matrix_map.is_email_allowlisted(text) IS
  '2026-05-20 refactor: returns true iff the JWT sub claim maps to a '
  'public.user_roles row. The p_email parameter is IGNORED (retained '
  'for RLS-policy backward compat; the canonical identity is JWT sub, '
  'not the email roundtrip via auth.users). SECURITY DEFINER + owned '
  'by matrix_map_owner + locked search_path. Returns boolean ONLY '
  '(cannot leak rows). Anonymous callers raise 42501.';


-- ---------------------------------------------------------------------
-- SECTION 3 -- REFACTOR: matrix_map.has_private_grant(uuid)
-- ---------------------------------------------------------------------
-- Original body (PR-MAP-1 lines 323-338): SELECT EXISTS ... WHERE
-- g.user_id = auth.uid() ... Replace auth.uid() with current_user_id().
-- Pure mechanical swap; semantics unchanged.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION matrix_map.has_private_grant(p_dra_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = matrix_map, public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM matrix_map.private_data_grants g
    WHERE g.dra_id = p_dra_id
      AND g.user_id = matrix_map.current_user_id()
      AND g.revoked_at IS NULL
      AND (g.expires_at IS NULL OR g.expires_at > now())
  );
$$;

ALTER FUNCTION matrix_map.has_private_grant(uuid) OWNER TO matrix_map_owner;

REVOKE EXECUTE ON FUNCTION matrix_map.has_private_grant(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION matrix_map.has_private_grant(uuid) TO authenticated;
GRANT  EXECUTE ON FUNCTION matrix_map.has_private_grant(uuid) TO service_role;

COMMENT ON FUNCTION matrix_map.has_private_grant(uuid) IS
  '2026-05-20 refactor: returns true iff the calling user (JWT sub) '
  'holds an active, non-expired grant for the given DRA. Pure mechanical '
  'swap of auth.uid() -> matrix_map.current_user_id(). SECURITY DEFINER '
  '+ owned by matrix_map_owner. RLS on private_data_grants is bypassed '
  'by the owner role so the check is non-recursive.';


-- ---------------------------------------------------------------------
-- SECTION 4 -- REFACTOR: matrix_map.flip_dra_public(...)
-- ---------------------------------------------------------------------
-- Original body (PR-MAP-1 lines 380-454) used auth.uid() at 5 sites +
-- read auth.users for the actor's email. Replace auth.uid() with
-- current_user_id(); read email from jwt_claims() instead of auth.users.
--
-- See migration header BEHAVIOR PRESERVATION note 2 for the audit-email
-- semantic-equivalence rationale.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION matrix_map.flip_dra_public(
  p_dra_id    uuid,
  p_new_value boolean,
  p_actor_id  uuid,
  p_reason    text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = matrix_map, public, pg_temp
AS $$
DECLARE
  v_uid           uuid;
  v_claims        jsonb;
  v_prior         boolean;
  v_actor_email   text;
  v_is_authorized boolean;
BEGIN
  v_uid    := matrix_map.current_user_id();
  v_claims := matrix_map.jwt_claims();

  -- (1) Must be called from an authenticated user-JWT context.
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'flip_dra_public must be called from an authenticated user context (jwt sub is null); service_role cannot call this RPC'
      USING ERRCODE = '42501';
  END IF;

  -- (2) Caller cannot impersonate a different actor.
  IF v_uid <> p_actor_id THEN
    RAISE EXCEPTION 'flip_dra_public actor_id (%) must match caller jwt sub (%)', p_actor_id, v_uid
      USING ERRCODE = '42501';
  END IF;

  -- (3) Caller must hold admin OR matrix_admin role.
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_uid
      AND role IN ('admin', 'matrix_admin')
  )
  INTO v_is_authorized;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'flip_dra_public requires admin or matrix_admin role'
      USING ERRCODE = '42501';
  END IF;

  -- (4) Reason required (grants v2 section 2.3).
  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'flip_dra_public requires a non-empty reason';
  END IF;

  -- Resolve actor email from the JWT claims (bypasses auth.users read
  -- which would fail under matrix_map_owner SECDEF -- no USAGE on auth
  -- schema). The Supabase GoTrue issuer always includes the email claim
  -- for password / OAuth sessions.
  v_actor_email := (v_claims ->> 'email')::text;
  IF v_actor_email IS NULL OR length(trim(v_actor_email)) = 0 THEN
    RAISE EXCEPTION 'flip_dra_public could not resolve actor email from JWT for sub %', v_uid;
  END IF;

  -- Lock + read prior value.
  SELECT public INTO v_prior
  FROM matrix_map.dras
  WHERE id = p_dra_id
    AND is_deleted = false
  FOR UPDATE;

  IF v_prior IS NULL THEN
    RAISE EXCEPTION 'dra % not found or is soft-deleted', p_dra_id;
  END IF;

  -- No-op if value unchanged (avoids gratuitous audit rows).
  IF v_prior IS DISTINCT FROM p_new_value THEN
    UPDATE matrix_map.dras
       SET public = p_new_value
     WHERE id = p_dra_id
       AND is_deleted = false;

    INSERT INTO matrix_map.dra_visibility_audit
      (dra_id, prior_value, new_value, changed_at, changed_by, changed_by_email, reason)
    VALUES
      (p_dra_id, v_prior, p_new_value, now(), v_uid, v_actor_email, p_reason);
  END IF;
END;
$$;

ALTER FUNCTION matrix_map.flip_dra_public(uuid, boolean, uuid, text)
  OWNER TO matrix_map_owner;

REVOKE EXECUTE ON FUNCTION matrix_map.flip_dra_public(uuid, boolean, uuid, text)
  FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION matrix_map.flip_dra_public(uuid, boolean, uuid, text)
  TO authenticated;

COMMENT ON FUNCTION matrix_map.flip_dra_public(uuid, boolean, uuid, text) IS
  '2026-05-20 refactor: admin / matrix_admin only RPC to flip a DRA''s '
  'public flag. auth.uid() replaced with matrix_map.current_user_id(); '
  'auth.users email lookup replaced with JWT email claim from '
  'matrix_map.jwt_claims(). Behavior preserved -- see migration header '
  'BEHAVIOR PRESERVATION note 2.';


-- ---------------------------------------------------------------------
-- SECTION 5 -- REFACTOR: matrix_map.fetch_samples_with_hidden_summary
-- ---------------------------------------------------------------------
-- Original body (PR-MAP-3a 20260520000001 lines 159-306) used
-- auth.uid() at line 177 + auth.jwt() at line 185. Replace both with
-- the matrix_map helpers. All other logic preserved verbatim.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION matrix_map.fetch_samples_with_hidden_summary(
  p_bbox jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = matrix_map, public, extensions, pg_temp
AS $$
DECLARE
  v_uid                 uuid;
  v_caller_email        text;
  v_visible             jsonb;
  v_hidden_sample_count int;
  v_hidden_dra_ids      uuid[];
  v_hidden_dra_count    int;
  v_snapshot            text;
BEGIN
  -- (1) Auth gate: anon callers receive 42501.
  v_uid := matrix_map.current_user_id();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'fetch_samples_with_hidden_summary requires authenticated context'
      USING ERRCODE = '42501';
  END IF;

  -- (2) Allowlist gate. is_email_allowlisted (refactored above) now
  --     looks up via JWT sub directly; the email parameter is passed for
  --     signature compatibility but is ignored in the body.
  v_caller_email := (matrix_map.jwt_claims() ->> 'email')::text;
  IF NOT matrix_map.is_email_allowlisted(v_caller_email) THEN
    RAISE EXCEPTION 'caller not on matrix_map allowlist'
      USING ERRCODE = '42501';
  END IF;

  -- (3) p_bbox -- accepted but IGNORED in v1 body (Q-6 future-compat
  --     parameter).

  -- (4) Visible samples. Predicate mirrors the PR-MAP-1 RLS samples
  --     SELECT policy with ONE DELIBERATE WIDENING: source_dra_id IS
  --     NULL samples are included (flagged-for-steward-review).
  SELECT COALESCE(jsonb_agg(row_obj), '[]'::jsonb)
  FROM (
    SELECT
      s.id,
      s.bnrrm_station_id,
      s.station_id,
      s.display_name,
      ST_AsGeoJSON(s.geometry)::jsonb AS geometry,
      s.coordinate_quality_tier,
      s.coordinate_source,
      s.classification,
      s.classification_source,
      s.classification_rationale,
      s.classification_confidence,
      s.source_dra_id,
      s.public,
      s.bc_region,
      s.waterbody,
      s.waterbody_type
    FROM matrix_map.samples s
    LEFT JOIN matrix_map.dras d ON d.id = s.source_dra_id
    WHERE s.source_dra_id IS NULL
       OR (d.is_deleted = false
           AND (d.public = true OR matrix_map.has_private_grant(d.id)))
    ORDER BY s.bnrrm_station_id NULLS LAST, s.id
  ) row_obj
  INTO v_visible;

  -- (5) Hidden sample count: samples whose source DRA EXISTS, is not
  --     soft-deleted, is private, and the caller does NOT hold a grant.
  SELECT COUNT(*)
  FROM matrix_map.samples s
  JOIN matrix_map.dras d ON d.id = s.source_dra_id
  WHERE d.is_deleted = false
    AND d.public = false
    AND NOT matrix_map.has_private_grant(d.id)
  INTO v_hidden_sample_count;

  -- (6) Hidden DRA ids: uuids ONLY, NO titles / citations / agency / year.
  SELECT COALESCE(array_agg(d_id ORDER BY d_id), ARRAY[]::uuid[])
  FROM (
    SELECT DISTINCT s.source_dra_id AS d_id
    FROM matrix_map.samples s
    JOIN matrix_map.dras d2 ON d2.id = s.source_dra_id
    WHERE d2.is_deleted = false
      AND d2.public = false
      AND NOT matrix_map.has_private_grant(d2.id)
  ) hidden_dras
  INTO v_hidden_dra_ids;

  v_hidden_dra_count := array_length(v_hidden_dra_ids, 1);
  IF v_hidden_dra_count IS NULL THEN
    v_hidden_dra_count := 0;
  END IF;

  -- (7) Snapshot version.
  SELECT COALESCE(MAX(updated_at)::text, now()::text)
  FROM matrix_map.samples
  INTO v_snapshot;

  -- (8) Final payload.
  RETURN jsonb_build_object(
    'visible_samples',       v_visible,
    'hidden_sample_count',   v_hidden_sample_count,
    'hidden_dra_count',      v_hidden_dra_count,
    'hidden_dra_ids',        to_jsonb(v_hidden_dra_ids),
    'data_snapshot_version', v_snapshot
  );
END;
$$;

ALTER FUNCTION matrix_map.fetch_samples_with_hidden_summary(jsonb)
  OWNER TO matrix_map_owner;

REVOKE EXECUTE ON FUNCTION matrix_map.fetch_samples_with_hidden_summary(jsonb)
  FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION matrix_map.fetch_samples_with_hidden_summary(jsonb)
  TO authenticated;
-- Intentionally NOT granted to service_role (mirrors PR-MAP-3a 313-318).

COMMENT ON FUNCTION matrix_map.fetch_samples_with_hidden_summary(jsonb) IS
  '2026-05-20 refactor: matrix_map.current_user_id() + jwt_claims() '
  'replace auth.uid() + auth.jwt() inside the SECDEF body. All other '
  'logic preserved verbatim from PR-MAP-3a (20260520000001). The wire '
  'contract (visible_samples / hidden_sample_count / hidden_dra_count / '
  'hidden_dra_ids / data_snapshot_version) is unchanged.';


-- ---------------------------------------------------------------------
-- SECTION 6 -- REVOKE the transient CREATE granted in SECTION 0.
-- ---------------------------------------------------------------------
-- Mirrors PR-MAP-1 + PR-MAP-3a: matrix_map_owner does NOT retain
-- CREATE on the schema in steady state. The CREATE was granted only
-- for the duration of this migration so the ALTER FUNCTION OWNER
-- statements above could succeed.
-- ---------------------------------------------------------------------

REVOKE CREATE ON SCHEMA matrix_map FROM matrix_map_owner;

COMMIT;

-- =====================================================================
-- POST-APPLY VERIFICATION (run READ-ONLY, one block at a time, after
-- the migration applies):
--
--   -- (a) Helpers exist + owned by matrix_map_owner.
--   SELECT p.proname,
--          (SELECT rolname FROM pg_roles WHERE oid = p.proowner) AS owner
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'matrix_map'
--     AND p.proname IN ('current_user_id', 'jwt_claims')
--   ORDER BY p.proname;
--   -- Expected: 2 rows; owner = matrix_map_owner.
--
--   -- (b) Refactored functions still exist + owned by matrix_map_owner.
--   SELECT p.proname,
--          (SELECT rolname FROM pg_roles WHERE oid = p.proowner) AS owner
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'matrix_map'
--     AND p.proname IN ('is_email_allowlisted', 'has_private_grant',
--                       'flip_dra_public', 'fetch_samples_with_hidden_summary')
--   ORDER BY p.proname;
--   -- Expected: 4 rows; all owner = matrix_map_owner.
--
--   -- (c) Smoke call: the RPC that errored at line 11 (auth.uid()) now
--   --     either succeeds (if you have an authenticated session) OR
--   --     raises the expected 42501 "requires authenticated context"
--   --     from the new gate -- NOT the auth-schema permission error.
--   --     From the SQL Editor (which has no JWT session), expect the
--   --     "requires authenticated context" exception, which CONFIRMS
--   --     the refactor closed the bug.
--   SELECT matrix_map.fetch_samples_with_hidden_summary(NULL::jsonb);
--   -- Expected: ERROR fetch_samples_with_hidden_summary requires
--   --          authenticated context.
--   --   (The "schema auth" permission error must be GONE. If you see
--   --    the "requires authenticated context" message, that is GREEN.)
--
--   -- (d) End-to-end test from the dashboard: log in, navigate to
--   --     /matrix-map. The page should now render sample markers
--   --     instead of the "samples data temporarily unavailable" notice.
-- =====================================================================
-- =====================================================================
-- matrix_map RPC geography-cast fix
-- =====================================================================
--
-- Branch:  fix/matrix-map-rpc-geography-cast
-- Pairs:   20260520000001_matrix_map_fetch_samples_rpc.sql (PR-MAP-3a; original)
--          20260520000004_matrix_map_jwt_via_current_setting.sql (JWT refactor)
--
-- WHY THIS MIGRATION EXISTS
--
--   2026-05-20 diagnostic from owner's dev-server terminal (after merging
--   PR #147's logging patch) revealed the actual failure mode behind the
--   "samples data temporarily unavailable" notice:
--
--     [matrix-map] RPC fetch_samples_with_hidden_summary failed: {
--       message: 'function st_asgeojson(extensions.geography) does not exist',
--       details: null,
--       hint: 'No function matches the given name and argument types.
--              You might need to add explicit type casts.',
--       code: '42883'
--     }
--
--   Root cause: the RPC body has `ST_AsGeoJSON(s.geometry)::jsonb AS
--   geometry`, but matrix_map.samples.geometry is declared
--   `geography(POINT, 4326)` (per PR-MAP-1 schema migration line 213).
--   PostGIS only ships `ST_AsGeoJSON(geometry)` -- there is no
--   `ST_AsGeoJSON(geography)` overload. PostgREST surfaces this as
--   42883 (undefined_function) when the function is called.
--
--   The bug has existed since PR-MAP-3a (20260520000001) deployed.
--   Earlier diagnostic surfaces hid it: (a) the SQL-Editor smoke call
--   raised the auth-context error BEFORE reaching the SELECT in
--   line ~221 (we never got past the auth gate to see the cast error);
--   (b) the prior security-hardening + JWT-refactor migrations did not
--   modify the geometry-projection logic.
--
-- FIX
--
--   One-line body change: cast s.geometry to geometry inside the
--   SELECT projection. PostGIS supplies the `geography -> geometry`
--   cast operator; once we apply it, ST_AsGeoJSON(geometry) resolves
--   cleanly. The cast preserves the SRID (4326) and the point
--   coordinates exactly -- no data semantics change.
--
--   BEFORE:  ST_AsGeoJSON(s.geometry)::jsonb AS geometry,
--   AFTER:   ST_AsGeoJSON(s.geometry::geometry)::jsonb AS geometry,
--
--   The rest of the function body is preserved verbatim from
--   20260520000004 (the JWT-via-current-setting refactor). Same
--   matrix_map.current_user_id() + matrix_map.jwt_claims() helpers,
--   same auth gate, same allowlist gate, same hidden-summary
--   computation, same return-payload shape.
--
-- IDEMPOTENCY
--
--   Wrapped in BEGIN/COMMIT. CREATE OR REPLACE FUNCTION is idempotent.
--   Transient GRANT CREATE / REVOKE CREATE pattern from PR-MAP-1 /
--   PR-MAP-3a / 20260520000004 is preserved so ALTER FUNCTION OWNER
--   succeeds even when matrix_map_owner has no steady-state CREATE
--   privilege on the schema.
--
-- PRE-FLIGHT (run READ-ONLY in Supabase SQL Editor before applying):
--
--   -- 1. Confirm the function exists + owned by matrix_map_owner.
--   SELECT p.proname,
--          (SELECT rolname FROM pg_roles WHERE oid = p.proowner) AS owner
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'matrix_map'
--     AND p.proname = 'fetch_samples_with_hidden_summary';
--   -- Expected: 1 row; owner = matrix_map_owner.
--
--   -- 2. Confirm samples.geometry is geography (the column the cast
--   --    targets).
--   SELECT column_name, udt_name
--   FROM information_schema.columns
--   WHERE table_schema = 'matrix_map'
--     AND table_name   = 'samples'
--     AND column_name  = 'geometry';
--   -- Expected: udt_name = 'geography'.
--
-- POST-APPLY VERIFICATION (run READ-ONLY in SQL Editor):
--
--   -- (a) Smoke call -- SQL Editor has no JWT session so this raises
--   --     the auth gate (which is the EXPECTED failure mode after the
--   --     fix; not the previous 42883 cast error). If you see the
--   --     "requires authenticated context" error, the cast fix landed
--   --     cleanly and the function compiles + executes far enough to
--   --     reach the auth gate.
--   SELECT matrix_map.fetch_samples_with_hidden_summary(NULL::jsonb);
--   -- Expected: 42501 fetch_samples_with_hidden_summary requires
--   --           authenticated context.
--   -- ANTI-EXPECTED: 42883 st_asgeojson(geography) does not exist.
--
--   -- (b) End-to-end -- reload /matrix-map (or /matrix-options ->
--   --     Interactive Map tab) in the dashboard. Sample markers
--   --     should render with the 9-state symbology. The "samples
--   --     data temporarily unavailable" notice should be gone.
--
-- Plain ASCII only -- no em-dashes / smart quotes / Unicode arrows.
-- Per L0 CLAUDE.md section 1.1.
-- =====================================================================

BEGIN;

-- Transient CREATE so ALTER FUNCTION ... OWNER TO matrix_map_owner
-- below succeeds (matches PR-MAP-1 / PR-MAP-3a / 20260520000004 pattern).
GRANT CREATE ON SCHEMA matrix_map TO matrix_map_owner;

CREATE OR REPLACE FUNCTION matrix_map.fetch_samples_with_hidden_summary(
  p_bbox jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = matrix_map, public, extensions, pg_temp
AS $$
DECLARE
  v_uid                 uuid;
  v_caller_email        text;
  v_visible             jsonb;
  v_hidden_sample_count int;
  v_hidden_dra_ids      uuid[];
  v_hidden_dra_count    int;
  v_snapshot            text;
BEGIN
  -- (1) Auth gate: anon callers receive 42501.
  v_uid := matrix_map.current_user_id();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'fetch_samples_with_hidden_summary requires authenticated context'
      USING ERRCODE = '42501';
  END IF;

  -- (2) Allowlist gate. is_email_allowlisted (refactored in
  --     20260520000004) looks up via JWT sub directly; the email
  --     parameter is passed for signature compatibility but is ignored
  --     in the body.
  v_caller_email := (matrix_map.jwt_claims() ->> 'email')::text;
  IF NOT matrix_map.is_email_allowlisted(v_caller_email) THEN
    RAISE EXCEPTION 'caller not on matrix_map allowlist'
      USING ERRCODE = '42501';
  END IF;

  -- (3) p_bbox -- accepted but IGNORED in v1 body (Q-6 future-compat
  --     parameter).

  -- (4) Visible samples. Predicate mirrors the PR-MAP-1 RLS samples
  --     SELECT policy with ONE DELIBERATE WIDENING: source_dra_id IS
  --     NULL samples are included (flagged-for-steward-review).
  --
  --     2026-05-20 cast fix: s.geometry is geography(POINT, 4326);
  --     ST_AsGeoJSON only has a geometry overload. Cast s.geometry::
  --     geometry before passing into ST_AsGeoJSON. SRID + coordinates
  --     preserved exactly by the geography->geometry cast.
  SELECT COALESCE(jsonb_agg(row_obj), '[]'::jsonb)
  FROM (
    SELECT
      s.id,
      s.bnrrm_station_id,
      s.station_id,
      s.display_name,
      ST_AsGeoJSON(s.geometry::geometry)::jsonb AS geometry,
      s.coordinate_quality_tier,
      s.coordinate_source,
      s.classification,
      s.classification_source,
      s.classification_rationale,
      s.classification_confidence,
      s.source_dra_id,
      s.public,
      s.bc_region,
      s.waterbody,
      s.waterbody_type
    FROM matrix_map.samples s
    LEFT JOIN matrix_map.dras d ON d.id = s.source_dra_id
    WHERE s.source_dra_id IS NULL
       OR (d.is_deleted = false
           AND (d.public = true OR matrix_map.has_private_grant(d.id)))
    ORDER BY s.bnrrm_station_id NULLS LAST, s.id
  ) row_obj
  INTO v_visible;

  -- (5) Hidden sample count: samples whose source DRA EXISTS, is not
  --     soft-deleted, is private, and the caller does NOT hold a grant.
  SELECT COUNT(*)
  FROM matrix_map.samples s
  JOIN matrix_map.dras d ON d.id = s.source_dra_id
  WHERE d.is_deleted = false
    AND d.public = false
    AND NOT matrix_map.has_private_grant(d.id)
  INTO v_hidden_sample_count;

  -- (6) Hidden DRA ids: uuids ONLY, NO titles / citations / agency / year.
  SELECT COALESCE(array_agg(d_id ORDER BY d_id), ARRAY[]::uuid[])
  FROM (
    SELECT DISTINCT s.source_dra_id AS d_id
    FROM matrix_map.samples s
    JOIN matrix_map.dras d2 ON d2.id = s.source_dra_id
    WHERE d2.is_deleted = false
      AND d2.public = false
      AND NOT matrix_map.has_private_grant(d2.id)
  ) hidden_dras
  INTO v_hidden_dra_ids;

  v_hidden_dra_count := array_length(v_hidden_dra_ids, 1);
  IF v_hidden_dra_count IS NULL THEN
    v_hidden_dra_count := 0;
  END IF;

  -- (7) Snapshot version.
  SELECT COALESCE(MAX(updated_at)::text, now()::text)
  FROM matrix_map.samples
  INTO v_snapshot;

  -- (8) Final payload.
  RETURN jsonb_build_object(
    'visible_samples',       v_visible,
    'hidden_sample_count',   v_hidden_sample_count,
    'hidden_dra_count',      v_hidden_dra_count,
    'hidden_dra_ids',        to_jsonb(v_hidden_dra_ids),
    'data_snapshot_version', v_snapshot
  );
END;
$$;

-- Re-issue ownership + grants (idempotent; mirrors 20260520000004).
ALTER FUNCTION matrix_map.fetch_samples_with_hidden_summary(jsonb)
  OWNER TO matrix_map_owner;

REVOKE EXECUTE ON FUNCTION matrix_map.fetch_samples_with_hidden_summary(jsonb)
  FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION matrix_map.fetch_samples_with_hidden_summary(jsonb)
  TO authenticated;
-- Intentionally NOT granted to service_role (mirrors prior migrations).

COMMENT ON FUNCTION matrix_map.fetch_samples_with_hidden_summary(jsonb) IS
  '2026-05-20 geography-cast fix: s.geometry::geometry inside '
  'ST_AsGeoJSON projection resolves the PostGIS function-overload '
  'mismatch (geography column vs geometry-typed ST_AsGeoJSON). All '
  'other logic preserved verbatim from 20260520000004 (the JWT-via-'
  'current-setting refactor). Wire contract (visible_samples / '
  'hidden_sample_count / hidden_dra_count / hidden_dra_ids / '
  'data_snapshot_version) is unchanged.';

-- Revoke the transient CREATE (steady-state matches PR-MAP-1 posture).
REVOKE CREATE ON SCHEMA matrix_map FROM matrix_map_owner;

COMMIT;
-- =====================================================================
-- matrix_map RPC geometry-type schema-qualify fix
-- =====================================================================
--
-- Branch:  fix/matrix-map-rpc-geometry-type-qualify
-- Pairs:   20260520000005_matrix_map_rpc_geography_cast.sql (prior cast fix)
--          20260520000004_matrix_map_jwt_via_current_setting.sql (JWT refactor)
--          20260520000001_matrix_map_fetch_samples_rpc.sql (PR-MAP-3a)
--
-- WHY THIS MIGRATION EXISTS
--
--   Migration 20260520000005 applied the `s.geometry::geometry` cast to
--   fix the `function st_asgeojson(extensions.geography) does not exist`
--   error (code 42883). That fix worked at the function-overload level,
--   BUT exposed a follow-on type-resolution error from owner's dev
--   terminal 2026-05-20:
--
--     [matrix-map] RPC fetch_samples_with_hidden_summary failed: {
--       message: 'type "geometry" does not exist',
--       details: null, hint: null,
--       code: '42704'
--     }
--
--   Root cause: the RPC body has `SET search_path = matrix_map, public,
--   extensions, pg_temp`. The cast `s.geometry::geometry` resolves the
--   unqualified type name `geometry` via search_path. Even though
--   `extensions` is in the search_path, the type lookup is failing.
--   Possible contributing factors:
--     - Supabase keeps PostGIS in the `extensions` schema, but at
--       function-PARSE time the search_path may resolve types
--       differently than at function-CALL time.
--     - The column alias `AS geometry` in the same SELECT may shadow
--       the type name lookup in the cast expression.
--     - Function lockdown SET search_path is per-statement; type
--       resolution inside SECDEF body has been known to behave
--       differently than top-level queries.
--
--   The geography column was findable via `extensions.geography` in
--   the original 42883 error message, so PostGIS IS in `extensions`.
--   The schema-qualified type name `extensions.geometry` should
--   resolve unambiguously regardless of search_path quirks.
--
-- FIX
--
--   Change cast target from unqualified `geometry` to schema-qualified
--   `extensions.geometry`:
--
--     BEFORE:  ST_AsGeoJSON(s.geometry::geometry)::jsonb AS geometry,
--     AFTER:   ST_AsGeoJSON(s.geometry::extensions.geometry)::jsonb AS geometry,
--
--   Schema-qualified type lookup bypasses search_path resolution
--   entirely. PostgreSQL parser goes directly to extensions schema
--   for the type. Same semantics; same SRID; same coordinates; same
--   NULL behavior; same wire payload shape.
--
-- IDEMPOTENCY + PATTERN
--
--   Wrapped in BEGIN / COMMIT. CREATE OR REPLACE FUNCTION idempotent.
--   Transient GRANT CREATE / REVOKE CREATE around ALTER FUNCTION
--   OWNER (mirrors PR-MAP-1 / PR-MAP-3a / 20260520000004 / 20260520000005
--   pattern).
--
-- PRE-FLIGHT (run READ-ONLY in Supabase SQL Editor before applying):
--
--   -- 1. Confirm extensions.geometry type exists.
--   SELECT t.typname, n.nspname
--   FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
--   WHERE t.typname = 'geometry';
--   -- Expected: 1+ rows; typname = 'geometry', nspname likely 'extensions'.
--
--   -- 2. Confirm ST_AsGeoJSON(geometry) overload exists in extensions.
--   SELECT p.proname, pg_get_function_arguments(p.oid)
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE p.proname = 'st_asgeojson' AND n.nspname = 'extensions';
--   -- Expected: multiple rows (PostGIS has several ST_AsGeoJSON
--   --           overloads -- geometry, jsonb, etc.). The geometry-taking
--   --           overload is what our fix resolves to.
--
-- POST-APPLY VERIFICATION (run READ-ONLY):
--
--   -- (a) Smoke call -- SQL Editor has no JWT session so this raises
--   --     the auth gate (42501 'requires authenticated context'). If
--   --     you see that, the cast resolved + we executed far enough to
--   --     reach the auth gate. ANTI-EXPECTED: 42704 'type "geometry"
--   --     does not exist' OR 42883 'function st_asgeojson does not
--   --     exist'.
--   SELECT matrix_map.fetch_samples_with_hidden_summary(NULL::jsonb);
--   -- Expected: 42501 requires authenticated context.
--
--   -- (b) End-to-end -- reload /matrix-options -> Interactive Map tab
--   --     in the dashboard. Sample markers should render with the
--   --     9-state symbology. "Samples data temporarily unavailable"
--   --     notice should be gone.
--
-- Plain ASCII only -- no em-dashes / smart quotes / Unicode arrows.
-- Per L0 CLAUDE.md section 1.1.
-- =====================================================================

BEGIN;

-- Transient CREATE so ALTER FUNCTION ... OWNER TO matrix_map_owner
-- below succeeds.
GRANT CREATE ON SCHEMA matrix_map TO matrix_map_owner;

CREATE OR REPLACE FUNCTION matrix_map.fetch_samples_with_hidden_summary(
  p_bbox jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = matrix_map, public, extensions, pg_temp
AS $$
DECLARE
  v_uid                 uuid;
  v_caller_email        text;
  v_visible             jsonb;
  v_hidden_sample_count int;
  v_hidden_dra_ids      uuid[];
  v_hidden_dra_count    int;
  v_snapshot            text;
BEGIN
  -- (1) Auth gate: anon callers receive 42501.
  v_uid := matrix_map.current_user_id();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'fetch_samples_with_hidden_summary requires authenticated context'
      USING ERRCODE = '42501';
  END IF;

  -- (2) Allowlist gate.
  v_caller_email := (matrix_map.jwt_claims() ->> 'email')::text;
  IF NOT matrix_map.is_email_allowlisted(v_caller_email) THEN
    RAISE EXCEPTION 'caller not on matrix_map allowlist'
      USING ERRCODE = '42501';
  END IF;

  -- (3) p_bbox -- accepted but IGNORED in v1 body.

  -- (4) Visible samples.
  --
  --     2026-05-20 geometry-type schema-qualify fix: the cast must use
  --     extensions.geometry (schema-qualified) instead of bare geometry
  --     because the SECDEF body's locked search_path is not resolving
  --     the bare `geometry` type at parse time even though `extensions`
  --     is listed. Schema-qualified lookup bypasses the search_path
  --     ambiguity entirely.
  SELECT COALESCE(jsonb_agg(row_obj), '[]'::jsonb)
  FROM (
    SELECT
      s.id,
      s.bnrrm_station_id,
      s.station_id,
      s.display_name,
      ST_AsGeoJSON(s.geometry::extensions.geometry)::jsonb AS geometry,
      s.coordinate_quality_tier,
      s.coordinate_source,
      s.classification,
      s.classification_source,
      s.classification_rationale,
      s.classification_confidence,
      s.source_dra_id,
      s.public,
      s.bc_region,
      s.waterbody,
      s.waterbody_type
    FROM matrix_map.samples s
    LEFT JOIN matrix_map.dras d ON d.id = s.source_dra_id
    WHERE s.source_dra_id IS NULL
       OR (d.is_deleted = false
           AND (d.public = true OR matrix_map.has_private_grant(d.id)))
    ORDER BY s.bnrrm_station_id NULLS LAST, s.id
  ) row_obj
  INTO v_visible;

  -- (5) Hidden sample count.
  SELECT COUNT(*)
  FROM matrix_map.samples s
  JOIN matrix_map.dras d ON d.id = s.source_dra_id
  WHERE d.is_deleted = false
    AND d.public = false
    AND NOT matrix_map.has_private_grant(d.id)
  INTO v_hidden_sample_count;

  -- (6) Hidden DRA ids.
  SELECT COALESCE(array_agg(d_id ORDER BY d_id), ARRAY[]::uuid[])
  FROM (
    SELECT DISTINCT s.source_dra_id AS d_id
    FROM matrix_map.samples s
    JOIN matrix_map.dras d2 ON d2.id = s.source_dra_id
    WHERE d2.is_deleted = false
      AND d2.public = false
      AND NOT matrix_map.has_private_grant(d2.id)
  ) hidden_dras
  INTO v_hidden_dra_ids;

  v_hidden_dra_count := array_length(v_hidden_dra_ids, 1);
  IF v_hidden_dra_count IS NULL THEN
    v_hidden_dra_count := 0;
  END IF;

  -- (7) Snapshot version.
  SELECT COALESCE(MAX(updated_at)::text, now()::text)
  FROM matrix_map.samples
  INTO v_snapshot;

  -- (8) Final payload.
  RETURN jsonb_build_object(
    'visible_samples',       v_visible,
    'hidden_sample_count',   v_hidden_sample_count,
    'hidden_dra_count',      v_hidden_dra_count,
    'hidden_dra_ids',        to_jsonb(v_hidden_dra_ids),
    'data_snapshot_version', v_snapshot
  );
END;
$$;

ALTER FUNCTION matrix_map.fetch_samples_with_hidden_summary(jsonb)
  OWNER TO matrix_map_owner;

REVOKE EXECUTE ON FUNCTION matrix_map.fetch_samples_with_hidden_summary(jsonb)
  FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION matrix_map.fetch_samples_with_hidden_summary(jsonb)
  TO authenticated;

COMMENT ON FUNCTION matrix_map.fetch_samples_with_hidden_summary(jsonb) IS
  '2026-05-20 geometry-type schema-qualify fix: cast uses '
  'extensions.geometry (schema-qualified) instead of bare geometry to '
  'bypass search_path type-resolution quirks in SECDEF body parse '
  'context. All other logic preserved verbatim from 20260520000005. '
  'Wire contract unchanged.';

REVOKE CREATE ON SCHEMA matrix_map FROM matrix_map_owner;

COMMIT;
-- =====================================================================
-- matrix_map RPC: replace ST_AsGeoJSON(geometry-cast) with manual
-- jsonb_build_object using ST_X + ST_Y geography overloads
-- =====================================================================
--
-- Branch:  fix/matrix-map-rpc-stxy-geography
-- Pairs:   20260520000005, 20260520000006 (prior cast attempts)
--          20260520000004 (JWT refactor)
--          20260520000001 (PR-MAP-3a original)
--
-- WHY THIS MIGRATION EXISTS
--
--   Cascade of geography-related errors over 2026-05-20 session:
--
--     migration 05: cast s.geometry::geometry -> fixed 42883 'st_asgeojson
--                   (extensions.geography) does not exist' BUT exposed
--                   42704 'type "geometry" does not exist' (search_path
--                   doesn't resolve bare geometry type in SECDEF body).
--
--     migration 06: cast s.geometry::extensions.geometry -> fixed 42704
--                   BUT exposed 42501 'permission denied for schema
--                   extensions' (matrix_map_owner lacks USAGE on the
--                   extensions schema; managed-DB lockdown like the
--                   auth schema issue we hit earlier in PR #145).
--
--   Function calls resolve via search_path WITHOUT triggering USAGE
--   checks (search_path walks accessible schemas only and silently
--   skips inaccessible ones). Type references and schema-qualified
--   names DO trigger USAGE checks.
--
--   So the path to success: avoid ALL references to the extensions
--   schema (type names, qualified names) and stick to unqualified
--   function calls that resolve via search_path.
--
-- FIX
--
--   PostGIS provides geography-typed overloads of ST_X and ST_Y for
--   point geographies. They return lng + lat respectively (geography
--   coordinate convention). Construct the GeoJSON manually:
--
--     BEFORE: ST_AsGeoJSON(s.geometry::extensions.geometry)::jsonb AS geometry,
--     AFTER:
--       jsonb_build_object(
--         'type', 'Point',
--         'coordinates', jsonb_build_array(
--           ST_X(s.geometry),
--           ST_Y(s.geometry)
--         )
--       ) AS geometry,
--
--   The output shape is IDENTICAL to what ST_AsGeoJSON would have
--   produced for a Point geography: {type: "Point", coordinates: [lng, lat]}.
--   Matches the GeoJsonPoint contract in
--   src/app/(dashboard)/matrix-map/types.ts line 65-68 exactly.
--
--   Why this works under the SECDEF body's locked search_path:
--     - ST_X and ST_Y are unqualified function references; search_path
--       resolution skips schemas matrix_map_owner can't access.
--     - jsonb_build_object + jsonb_build_array are built-in pg_catalog
--       functions; no schema lookup needed.
--     - No type names referenced.
--     - No extensions.* references.
--
-- ALTERNATIVE THE SESSION DID NOT TAKE
--
--   `GRANT USAGE ON SCHEMA extensions TO matrix_map_owner` would also
--   solve this if it succeeds, but per cross_project_supabase_protocol_
--   explore_before_assume + cross_project_supabase_mcp_dead_skip_to_sql_
--   editor lessons: managed-DB grants to custom roles on system schemas
--   (auth, extensions) routinely fail silently. The function-rewrite
--   path is more reliable + doesn't depend on Supabase managed-DB
--   permission policies.
--
-- IDEMPOTENCY + PATTERN
--
--   Wrapped in BEGIN / COMMIT. CREATE OR REPLACE FUNCTION idempotent.
--   Transient GRANT CREATE / REVOKE CREATE around ALTER FUNCTION OWNER.
--
-- POST-APPLY VERIFICATION:
--
--   -- (a) SQL Editor smoke -- auth gate fires (42501 requires
--   --     authenticated context). NOT 42501 permission denied for
--   --     schema extensions. NOT 42704 type does not exist. NOT 42883
--   --     function st_asgeojson does not exist.
--   SELECT matrix_map.fetch_samples_with_hidden_summary(NULL::jsonb);
--   -- Expected: 42501 requires authenticated context.
--
--   -- (b) Browser end-to-end -- reload /matrix-options Interactive Map
--   --     tab. Sample markers should render with the 9-state symbology.
--
-- Plain ASCII only -- no em-dashes / smart quotes / Unicode arrows.
-- Per L0 CLAUDE.md section 1.1.
-- =====================================================================

BEGIN;

GRANT CREATE ON SCHEMA matrix_map TO matrix_map_owner;

CREATE OR REPLACE FUNCTION matrix_map.fetch_samples_with_hidden_summary(
  p_bbox jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = matrix_map, public, extensions, pg_temp
AS $$
DECLARE
  v_uid                 uuid;
  v_caller_email        text;
  v_visible             jsonb;
  v_hidden_sample_count int;
  v_hidden_dra_ids      uuid[];
  v_hidden_dra_count    int;
  v_snapshot            text;
BEGIN
  -- (1) Auth gate: anon callers receive 42501.
  v_uid := matrix_map.current_user_id();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'fetch_samples_with_hidden_summary requires authenticated context'
      USING ERRCODE = '42501';
  END IF;

  -- (2) Allowlist gate.
  v_caller_email := (matrix_map.jwt_claims() ->> 'email')::text;
  IF NOT matrix_map.is_email_allowlisted(v_caller_email) THEN
    RAISE EXCEPTION 'caller not on matrix_map allowlist'
      USING ERRCODE = '42501';
  END IF;

  -- (3) p_bbox -- accepted but IGNORED in v1 body.

  -- (4) Visible samples.
  --
  --     2026-05-20 ST_X/ST_Y geography manual-build fix: prior attempts
  --     to cast s.geometry to geometry hit "type does not exist" (search_
  --     path resolution) and "permission denied for schema extensions"
  --     (USAGE check on schema-qualified reference). ST_X + ST_Y have
  --     geography overloads that take s.geometry directly. Building the
  --     GeoJSON manually with jsonb_build_object avoids any type-name or
  --     schema-qualified reference, so SECDEF body search_path resolves
  --     cleanly without triggering USAGE checks. Output is identical to
  --     ST_AsGeoJSON for a Point: {type:"Point", coordinates:[lng,lat]}.
  SELECT COALESCE(jsonb_agg(row_obj), '[]'::jsonb)
  FROM (
    SELECT
      s.id,
      s.bnrrm_station_id,
      s.station_id,
      s.display_name,
      jsonb_build_object(
        'type', 'Point',
        'coordinates', jsonb_build_array(
          ST_X(s.geometry),
          ST_Y(s.geometry)
        )
      ) AS geometry,
      s.coordinate_quality_tier,
      s.coordinate_source,
      s.classification,
      s.classification_source,
      s.classification_rationale,
      s.classification_confidence,
      s.source_dra_id,
      s.public,
      s.bc_region,
      s.waterbody,
      s.waterbody_type
    FROM matrix_map.samples s
    LEFT JOIN matrix_map.dras d ON d.id = s.source_dra_id
    WHERE s.source_dra_id IS NULL
       OR (d.is_deleted = false
           AND (d.public = true OR matrix_map.has_private_grant(d.id)))
    ORDER BY s.bnrrm_station_id NULLS LAST, s.id
  ) row_obj
  INTO v_visible;

  -- (5) Hidden sample count.
  SELECT COUNT(*)
  FROM matrix_map.samples s
  JOIN matrix_map.dras d ON d.id = s.source_dra_id
  WHERE d.is_deleted = false
    AND d.public = false
    AND NOT matrix_map.has_private_grant(d.id)
  INTO v_hidden_sample_count;

  -- (6) Hidden DRA ids.
  SELECT COALESCE(array_agg(d_id ORDER BY d_id), ARRAY[]::uuid[])
  FROM (
    SELECT DISTINCT s.source_dra_id AS d_id
    FROM matrix_map.samples s
    JOIN matrix_map.dras d2 ON d2.id = s.source_dra_id
    WHERE d2.is_deleted = false
      AND d2.public = false
      AND NOT matrix_map.has_private_grant(d2.id)
  ) hidden_dras
  INTO v_hidden_dra_ids;

  v_hidden_dra_count := array_length(v_hidden_dra_ids, 1);
  IF v_hidden_dra_count IS NULL THEN
    v_hidden_dra_count := 0;
  END IF;

  -- (7) Snapshot version.
  SELECT COALESCE(MAX(updated_at)::text, now()::text)
  FROM matrix_map.samples
  INTO v_snapshot;

  -- (8) Final payload.
  RETURN jsonb_build_object(
    'visible_samples',       v_visible,
    'hidden_sample_count',   v_hidden_sample_count,
    'hidden_dra_count',      v_hidden_dra_count,
    'hidden_dra_ids',        to_jsonb(v_hidden_dra_ids),
    'data_snapshot_version', v_snapshot
  );
END;
$$;

ALTER FUNCTION matrix_map.fetch_samples_with_hidden_summary(jsonb)
  OWNER TO matrix_map_owner;

REVOKE EXECUTE ON FUNCTION matrix_map.fetch_samples_with_hidden_summary(jsonb)
  FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION matrix_map.fetch_samples_with_hidden_summary(jsonb)
  TO authenticated;

COMMENT ON FUNCTION matrix_map.fetch_samples_with_hidden_summary(jsonb) IS
  '2026-05-20 ST_X/ST_Y geography manual-build fix: avoid the '
  'extensions schema reference entirely by constructing GeoJSON with '
  'jsonb_build_object + ST_X + ST_Y geography overloads. Wire contract '
  'unchanged ({type: "Point", coordinates: [lng, lat]}).';

REVOKE CREATE ON SCHEMA matrix_map FROM matrix_map_owner;

COMMIT;
-- =====================================================================
-- OPTION A DRAFT -- matrix_map durable longitude/latitude columns
-- =====================================================================
--
-- DO NOT MERGE AS-IS.
--
-- Keep the _OPTION_A_DRAFT suffix until owner approves this reconciled
-- version. Owner applies SQL manually in Supabase Studio; Codex does not
-- apply live SQL.
--
-- Reconciled against:
--   C:/Projects/SSTAC-Dashboard/.tmp_explore_results_2026_05_21.json
--
-- Load-bearing live findings:
-- - Q01/Q02: target is PostgreSQL 17.4 / PostGIS 3.3.7.
-- - Q04/Q06: ST_X/ST_Y have geometry overloads only; geography overload
--   count is 0, so the live migration-07-style RPC fails with 42883.
-- - Q05: ST_AsText(geography) smoke returned POINT(-123.3656 48.4284).
-- - Q08/Q09: matrix_map_owner has no USAGE on extensions; it has only
--   matrix_map/public schema USAGE and narrow table grants.
-- - Q10/Q11: samples.geometry is geography(Point,4326) NOT NULL.
-- - Q13: live RPC body uses ST_X(s.geometry)/ST_Y(s.geometry) on the
--   geography column even though those overloads do not exist.
-- - Q14: samples table is empty, sample_count=0; no data backfill is
--   needed before the new columns can be introduced.
-- - Q17/Q18: samples RLS is enabled and forced with admin_all plus
--   authenticated_select policies.
-- - Q19: no longitude/latitude columns or related constraints/indexes
--   exist yet; Option A is clean to apply.
--
-- Decision R1: choose R1c.
--
-- Rationale: durable numeric coordinates remove all PostGIS calls from
-- the SECURITY DEFINER read RPC. A postgres-owned SECURITY DEFINER
-- BEFORE trigger populates longitude/latitude on INSERT/UPDATE from
-- geometry using ST_X/ST_Y on geometry::geometry, which is safe because
-- Q04/Q06 confirm geometry overloads exist and Q08 shows only
-- matrix_map_owner lacks extensions USAGE. The trigger function does not
-- read or write tables; it only normalizes NEW.longitude/NEW.latitude.
-- Keeping the columns nullable preserves additive migration safety, and
-- the CHECK constraint enforces that rows with geometry have both
-- coordinates in WGS84 bounds.
--
-- Decision R2: the RPC projects GeoJSON directly from durable numeric
-- columns:
--
--   jsonb_build_object(
--     'type', 'Point',
--     'coordinates', jsonb_build_array(s.longitude, s.latitude)
--   )
--
-- This exactly matches the frontend wire shape:
--   {"type":"Point","coordinates":[lng,lat]}
--
-- Decision R3: the samples table is empty per Q14. The separate backfill
-- packet is therefore expected to update 0 rows and then validate the
-- constraint. It remains safe if rows appear before owner runs it.
--
-- This draft is forward-only. It adds columns, a trigger, a constraint,
-- an index, and replaces the fetch RPC. It intentionally does not DROP
-- longitude or latitude. If rollback is ever required, author a separate
-- forward migration.
-- =====================================================================

BEGIN;

SET LOCAL search_path = matrix_map, public, extensions, pg_catalog;

-- Transient CREATE privilege follows the established matrix_map_owner
-- ALTER FUNCTION OWNER pattern from prior matrix_map migrations.
GRANT matrix_map_owner TO postgres;
GRANT CREATE ON SCHEMA matrix_map TO matrix_map_owner;

-- ---------------------------------------------------------------------
-- SECTION 1 -- Add durable coordinate columns.
-- ---------------------------------------------------------------------

ALTER TABLE matrix_map.samples
  ADD COLUMN IF NOT EXISTS longitude float8,
  ADD COLUMN IF NOT EXISTS latitude  float8;

COMMENT ON COLUMN matrix_map.samples.longitude IS
  'Option A 2026-05-21 reconciled draft: durable WGS84 longitude. '
  'Per exploration Q04/Q06/Q13, runtime ST_X/ST_Y calls against the '
  'geography column fail because this PostGIS 3.3.7 target has geometry '
  'overloads only. Future writes are populated by the postgres-owned '
  'samples_populate_lng_lat_from_geometry trigger.';

COMMENT ON COLUMN matrix_map.samples.latitude IS
  'Option A 2026-05-21 reconciled draft: durable WGS84 latitude paired '
  'with samples.longitude. The map RPC builds GeoJSON directly from '
  'longitude/latitude and no longer calls PostGIS functions in the '
  'SECURITY DEFINER projection path.';

-- ---------------------------------------------------------------------
-- SECTION 2 -- R1c write-path trigger.
-- ---------------------------------------------------------------------
--
-- Q08 shows matrix_map_owner has no USAGE on the extensions schema.
-- The read RPC stays owned by matrix_map_owner, so it must not call
-- ST_X/ST_Y, reference extensions.geometry, or otherwise depend on
-- extension schema privileges.
--
-- The trigger function is deliberately owned by postgres and SECURITY
-- DEFINER. It runs only on writes to matrix_map.samples and only mutates
-- NEW.longitude/NEW.latitude. It uses ST_X/ST_Y on geometry::geometry,
-- which Q04/Q06 confirm is the available overload family.

CREATE OR REPLACE FUNCTION matrix_map.populate_sample_lng_lat_from_geometry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = matrix_map, public, extensions, pg_catalog, pg_temp
AS $$
BEGIN
  IF NEW.geometry IS NULL THEN
    NEW.longitude := NULL;
    NEW.latitude := NULL;
    RETURN NEW;
  END IF;

  NEW.longitude := ST_X(NEW.geometry::geometry);
  NEW.latitude := ST_Y(NEW.geometry::geometry);
  RETURN NEW;
END;
$$;

ALTER FUNCTION matrix_map.populate_sample_lng_lat_from_geometry()
  OWNER TO postgres;

COMMENT ON FUNCTION matrix_map.populate_sample_lng_lat_from_geometry() IS
  'Option A 2026-05-21 R1c trigger function. Owned by postgres and '
  'SECURITY DEFINER so write-time coordinate extraction can use the '
  'extensions geometry overloads confirmed by exploration Q04/Q06. The '
  'SECURITY DEFINER map RPC remains free of PostGIS calls.';

DROP TRIGGER IF EXISTS samples_populate_lng_lat_from_geometry
  ON matrix_map.samples;

CREATE TRIGGER samples_populate_lng_lat_from_geometry
  BEFORE INSERT OR UPDATE OF geometry, longitude, latitude
  ON matrix_map.samples
  FOR EACH ROW
  EXECUTE FUNCTION matrix_map.populate_sample_lng_lat_from_geometry();

COMMENT ON TRIGGER samples_populate_lng_lat_from_geometry ON matrix_map.samples IS
  'Option A 2026-05-21 R1c: populate durable longitude/latitude from '
  'samples.geometry on INSERT and coordinate-affecting UPDATE. Existing '
  'sample_count=0 per exploration Q14, so the backfill packet is a safe '
  'no-op unless rows are loaded before it runs.';

-- ---------------------------------------------------------------------
-- SECTION 3 -- Presence/range constraint and coordinate index.
-- ---------------------------------------------------------------------
--
-- NOT VALID is intentional even though Q14 says the table is empty. It
-- keeps the migration additive and lets the owner-run backfill packet
-- perform the explicit validation step. PostgreSQL still enforces a
-- NOT VALID CHECK constraint for subsequent INSERT/UPDATE rows.
--
-- The CHECK does not call PostGIS functions. The trigger is the only
-- PostGIS-dependent write-time mechanism, avoiding extension privilege
-- surprises in low-privilege write paths.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'matrix_map'
      AND c.relname = 'samples'
      AND con.conname = 'samples_lng_lat_geometry_consistency'
  ) THEN
    ALTER TABLE matrix_map.samples
      ADD CONSTRAINT samples_lng_lat_geometry_consistency
      CHECK (
        geometry IS NULL
        OR (
          longitude IS NOT NULL
          AND latitude IS NOT NULL
          AND longitude BETWEEN -180 AND 180
          AND latitude BETWEEN -90 AND 90
        )
      ) NOT VALID;
  END IF;
END
$$;

COMMENT ON CONSTRAINT samples_lng_lat_geometry_consistency
  ON matrix_map.samples IS
  'Option A 2026-05-21 reconciled draft: rows with geometry must carry '
  'non-null WGS84 longitude/latitude in valid bounds. Numeric consistency '
  'is supplied by the postgres-owned R1c trigger; this CHECK intentionally '
  'avoids PostGIS calls.';

CREATE INDEX IF NOT EXISTS samples_lng_lat_not_null_idx
  ON matrix_map.samples (longitude, latitude)
  WHERE longitude IS NOT NULL AND latitude IS NOT NULL;

COMMENT ON INDEX matrix_map.samples_lng_lat_not_null_idx IS
  'Option A 2026-05-21 reconciled draft: partial coordinate index for '
  'map bbox, analytics, and future viewport filtering without runtime '
  'geography casts in the fetch RPC.';

-- ---------------------------------------------------------------------
-- SECTION 4 -- RPC body: build GeoJSON from numeric columns.
-- ---------------------------------------------------------------------

DROP FUNCTION IF EXISTS matrix_map.fetch_samples_with_hidden_summary(jsonb);

CREATE OR REPLACE FUNCTION matrix_map.fetch_samples_with_hidden_summary(
  p_bbox jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = matrix_map, public, extensions, pg_temp
AS $$
DECLARE
  v_uid                 uuid;
  v_caller_email        text;
  v_visible             jsonb;
  v_hidden_sample_count int;
  v_hidden_dra_ids      uuid[];
  v_hidden_dra_count    int;
  v_snapshot            text;
BEGIN
  v_uid := matrix_map.current_user_id();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'fetch_samples_with_hidden_summary requires authenticated context'
      USING ERRCODE = '42501';
  END IF;

  v_caller_email := (matrix_map.jwt_claims() ->> 'email')::text;
  IF NOT matrix_map.is_email_allowlisted(v_caller_email) THEN
    RAISE EXCEPTION 'caller not on matrix_map allowlist'
      USING ERRCODE = '42501';
  END IF;

  -- p_bbox is accepted but ignored in v1. Future bbox filtering should
  -- use longitude/latitude and the samples_lng_lat_not_null_idx index.

  SELECT COALESCE(jsonb_agg(row_obj), '[]'::jsonb)
  FROM (
    SELECT
      s.id,
      s.bnrrm_station_id,
      s.station_id,
      s.display_name,
      jsonb_build_object(
        'type', 'Point',
        'coordinates', jsonb_build_array(s.longitude, s.latitude)
      ) AS geometry,
      s.coordinate_quality_tier,
      s.coordinate_source,
      s.classification,
      s.classification_source,
      s.classification_rationale,
      s.classification_confidence,
      s.source_dra_id,
      s.public,
      s.bc_region,
      s.waterbody,
      s.waterbody_type
    FROM matrix_map.samples s
    JOIN matrix_map.dras d ON d.id = s.source_dra_id
    WHERE s.longitude IS NOT NULL
      AND s.latitude IS NOT NULL
      AND s.source_dra_id IS NOT NULL
      AND d.is_deleted = false
      AND (d.public = true OR matrix_map.has_private_grant(d.id))
    ORDER BY s.bnrrm_station_id NULLS LAST, s.id
  ) row_obj
  INTO v_visible;

  SELECT COUNT(*)
  FROM matrix_map.samples s
  JOIN matrix_map.dras d ON d.id = s.source_dra_id
  WHERE d.is_deleted = false
    AND d.public = false
    AND NOT matrix_map.has_private_grant(d.id)
  INTO v_hidden_sample_count;

  SELECT COALESCE(array_agg(d_id ORDER BY d_id), ARRAY[]::uuid[])
  FROM (
    SELECT DISTINCT s.source_dra_id AS d_id
    FROM matrix_map.samples s
    JOIN matrix_map.dras d2 ON d2.id = s.source_dra_id
    WHERE d2.is_deleted = false
      AND d2.public = false
      AND NOT matrix_map.has_private_grant(d2.id)
  ) hidden_dras
  INTO v_hidden_dra_ids;

  v_hidden_dra_count := array_length(v_hidden_dra_ids, 1);
  IF v_hidden_dra_count IS NULL THEN
    v_hidden_dra_count := 0;
  END IF;

  SELECT COALESCE(MAX(updated_at)::text, now()::text)
  FROM matrix_map.samples
  INTO v_snapshot;

  RETURN jsonb_build_object(
    'visible_samples',       v_visible,
    'hidden_sample_count',   v_hidden_sample_count,
    'hidden_dra_count',      v_hidden_dra_count,
    'hidden_dra_ids',        to_jsonb(v_hidden_dra_ids),
    'data_snapshot_version', v_snapshot
  );
END;
$$;

ALTER FUNCTION matrix_map.fetch_samples_with_hidden_summary(jsonb)
  OWNER TO matrix_map_owner;

REVOKE EXECUTE ON FUNCTION matrix_map.fetch_samples_with_hidden_summary(jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION matrix_map.fetch_samples_with_hidden_summary(jsonb)
  TO authenticated;

COMMENT ON FUNCTION matrix_map.fetch_samples_with_hidden_summary(jsonb) IS
  'Option A 2026-05-21 reconciled draft: build visible sample GeoJSON '
  'from durable samples.longitude/samples.latitude columns. Per '
  'exploration Q04/Q06/Q13, the live ST_X/ST_Y geography RPC fails on '
  'this target; this RPC projection contains no PostGIS function calls.';

REVOKE CREATE ON SCHEMA matrix_map FROM matrix_map_owner;

COMMIT;
-- =====================================================================
-- PR-MAP-1.1 -- admin/matrix_admin bypass for fetch_samples_with_hidden_summary
-- =====================================================================
--
-- Problem this migration solves
-- -----------------------------
-- The Option A migration (20260521000001) made the fetch RPC filter
-- samples through:
--
--     (d.public = true OR matrix_map.has_private_grant(d.id))
--
-- There is no admin bypass. After the Path A ETL load all 19 DRAs land
-- with public=false and there are 0 private_data_grants rows. The result:
-- admins logged in to /matrix-options see 0 visible samples and the
-- partial-visibility banner reports 282/8 hidden because the visibility
-- predicate gives the same answer to admins as to any other allowlisted
-- caller.
--
-- The intended product behaviour is that holders of the admin or
-- matrix_admin role see all non-deleted DRAs regardless of d.public, and
-- their hidden_* counters are zero (nothing is hidden from them, so the
-- banner suppresses itself client-side).
--
-- Reconciled live findings (read-only MCP verify packet 2026-05-21)
-- -----------------------------------------------------------------
-- - fetch_samples_with_hidden_summary owner = matrix_map_owner.
-- - flip_dra_public owner = matrix_map_owner. flip_dra_public already
--   queries public.user_roles for the same role gate; reusing its
--   pattern is the path of least surprise.
-- - matrix_map_owner has SELECT on public.user_roles and USAGE on the
--   public schema, so the role lookup runs cleanly under SECURITY
--   DEFINER without additional grants.
-- - public.user_roles columns: id bigint, user_id uuid, role text,
--   created_at timestamptz.
-- - public.user_roles distinct values: 'admin', 'member'. No
--   'matrix_admin' rows exist today; the IN ('admin','matrix_admin')
--   gate future-proofs without forcing seed data.
-- - 3 users currently hold the admin role.
--
-- What changes
-- ------------
-- 1. Declare v_is_admin and populate it from public.user_roles using the
--    same EXISTS pattern as flip_dra_public.
-- 2. Extend the visible_samples WHERE disjunction to
--    (v_is_admin OR d.public = true OR matrix_map.has_private_grant(d.id)).
--    Non-admin callers are unaffected because v_is_admin is false.
-- 3. Short-circuit the hidden_sample_count and hidden_dra_ids
--    computations when v_is_admin -- admins have nothing hidden, so
--    return 0 and an empty array directly. This also skips two
--    full-table-scan counter queries on the admin path.
-- 4. data_snapshot_version logic unchanged.
--
-- What does NOT change
-- --------------------
-- - Function signature, ownership, SECURITY DEFINER setting, search_path,
--   GRANT/REVOKE pattern -- all preserved from migration 20260521000001.
-- - The 8 samples with source_dra_id IS NULL remain invisible to all
--   callers including admins because the INNER JOIN on dras drops them.
--   That is an ETL data-quality gap (BN-RRM doc_ids referenced by
--   stations but missing from the 19 seed-site DRAs), tracked
--   separately and out of scope for this RPC patch.
-- - The non-admin visibility logic is byte-identical for the partial-
--   visibility banner counts. Anonymous and member-only sessions still
--   see the same hidden_sample_count / hidden_dra_count they saw before
--   this migration.
--
-- Forward-only. No DROP / no rollback emitted here. If an inverse is
-- ever needed, author a separate migration.
-- =====================================================================

BEGIN;

SET LOCAL search_path = matrix_map, public, extensions, pg_catalog;

-- Same transient owner-grant pattern as migration 20260521000001.
GRANT matrix_map_owner TO postgres;
GRANT CREATE ON SCHEMA matrix_map TO matrix_map_owner;

DROP FUNCTION IF EXISTS matrix_map.fetch_samples_with_hidden_summary(jsonb);

CREATE OR REPLACE FUNCTION matrix_map.fetch_samples_with_hidden_summary(
  p_bbox jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = matrix_map, public, extensions, pg_temp
AS $$
DECLARE
  v_uid                 uuid;
  v_caller_email        text;
  v_is_admin            boolean;
  v_visible             jsonb;
  v_hidden_sample_count int;
  v_hidden_dra_ids      uuid[];
  v_hidden_dra_count    int;
  v_snapshot            text;
BEGIN
  v_uid := matrix_map.current_user_id();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'fetch_samples_with_hidden_summary requires authenticated context'
      USING ERRCODE = '42501';
  END IF;

  v_caller_email := (matrix_map.jwt_claims() ->> 'email')::text;
  IF NOT matrix_map.is_email_allowlisted(v_caller_email) THEN
    RAISE EXCEPTION 'caller not on matrix_map allowlist'
      USING ERRCODE = '42501';
  END IF;

  -- Admin bypass gate. Same EXISTS pattern as flip_dra_public so the
  -- role surface stays consistent across matrix_map RPCs.
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = v_uid
      AND role IN ('admin', 'matrix_admin')
  )
  INTO v_is_admin;

  -- p_bbox is accepted but ignored in v1. Future bbox filtering should
  -- use longitude/latitude and the samples_lng_lat_not_null_idx index.

  SELECT COALESCE(jsonb_agg(row_obj), '[]'::jsonb)
  FROM (
    SELECT
      s.id,
      s.bnrrm_station_id,
      s.station_id,
      s.display_name,
      jsonb_build_object(
        'type', 'Point',
        'coordinates', jsonb_build_array(s.longitude, s.latitude)
      ) AS geometry,
      s.coordinate_quality_tier,
      s.coordinate_source,
      s.classification,
      s.classification_source,
      s.classification_rationale,
      s.classification_confidence,
      s.source_dra_id,
      s.public,
      s.bc_region,
      s.waterbody,
      s.waterbody_type
    FROM matrix_map.samples s
    JOIN matrix_map.dras d ON d.id = s.source_dra_id
    WHERE s.longitude IS NOT NULL
      AND s.latitude IS NOT NULL
      AND s.source_dra_id IS NOT NULL
      AND d.is_deleted = false
      AND (v_is_admin OR d.public = true OR matrix_map.has_private_grant(d.id))
    ORDER BY s.bnrrm_station_id NULLS LAST, s.id
  ) row_obj
  INTO v_visible;

  IF v_is_admin THEN
    v_hidden_sample_count := 0;
    v_hidden_dra_ids      := ARRAY[]::uuid[];
  ELSE
    SELECT COUNT(*)
    FROM matrix_map.samples s
    JOIN matrix_map.dras d ON d.id = s.source_dra_id
    WHERE d.is_deleted = false
      AND d.public = false
      AND NOT matrix_map.has_private_grant(d.id)
    INTO v_hidden_sample_count;

    SELECT COALESCE(array_agg(d_id ORDER BY d_id), ARRAY[]::uuid[])
    FROM (
      SELECT DISTINCT s.source_dra_id AS d_id
      FROM matrix_map.samples s
      JOIN matrix_map.dras d2 ON d2.id = s.source_dra_id
      WHERE d2.is_deleted = false
        AND d2.public = false
        AND NOT matrix_map.has_private_grant(d2.id)
    ) hidden_dras
    INTO v_hidden_dra_ids;
  END IF;

  v_hidden_dra_count := array_length(v_hidden_dra_ids, 1);
  IF v_hidden_dra_count IS NULL THEN
    v_hidden_dra_count := 0;
  END IF;

  SELECT COALESCE(MAX(updated_at)::text, now()::text)
  FROM matrix_map.samples
  INTO v_snapshot;

  RETURN jsonb_build_object(
    'visible_samples',       v_visible,
    'hidden_sample_count',   v_hidden_sample_count,
    'hidden_dra_count',      v_hidden_dra_count,
    'hidden_dra_ids',        to_jsonb(v_hidden_dra_ids),
    'data_snapshot_version', v_snapshot
  );
END;
$$;

ALTER FUNCTION matrix_map.fetch_samples_with_hidden_summary(jsonb)
  OWNER TO matrix_map_owner;

REVOKE EXECUTE ON FUNCTION matrix_map.fetch_samples_with_hidden_summary(jsonb)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION matrix_map.fetch_samples_with_hidden_summary(jsonb)
  TO authenticated;

COMMENT ON FUNCTION matrix_map.fetch_samples_with_hidden_summary(jsonb) IS
  'PR-MAP-1.1 admin-bypass: admins and matrix_admins see all non-deleted '
  'DRAs regardless of d.public, and their hidden_sample_count/hidden_dra_* '
  'counters return 0/empty so the partial-visibility banner suppresses '
  'itself client-side. Non-admins are unaffected. The role gate is '
  'identical to matrix_map.flip_dra_public for surface consistency.';

REVOKE CREATE ON SCHEMA matrix_map FROM matrix_map_owner;

COMMIT;
-- =====================================================================
-- PR-MAP-5 -- fetch measurements for selected matrix-map samples
-- =====================================================================
--
-- Reconciled live findings (owner-run read-only verify 2026-05-21)
-- -----------------------------------------------------------------
-- - matrix_map schema exists.
-- - matrix_map.fetch_measurements_for_samples does NOT exist.
-- - matrix_map_owner is NOLOGIN and BYPASSRLS.
-- - matrix_map_owner already has SELECT on matrix_map.samples,
--   matrix_map.dras, and public.user_roles.
-- - matrix_map_owner does NOT yet have SELECT on matrix_map.measurements,
--   matrix_map.sample_events, or matrix_map.substances; this migration
--   grants only those additional SELECT privileges to the no-login owner
--   role so the SECURITY DEFINER function can read its join surface.
-- - Live row counts: 290 samples, 302 sample_events, 7472 measurements,
--   157 substances, 19 dras.
-- - The strict sample_event -> sample -> source_dra -> substances join
--   currently returns 7409 measurements; excluded rows remain out of
--   scope for this RPC because they lack the provenance chain required
--   for the Measurement Workbench and confidentiality filtering.
-- - Measurement domain is sediment-only today: 2899 censored rows with
--   qualifier '<' and 4573 uncensored rows with NULL qualifier.
--
-- What this creates
-- -----------------
-- matrix_map.fetch_measurements_for_samples(p_sample_ids uuid[])
--
-- The RPC returns a JSON array for the selected sample IDs:
--   sample_id, sample_display_name, sample_station_id, sample_event_id,
--   event_date, measurement_id, medium, substance_id, substance_key,
--   substance_display_name, value, unit, detection_limit, qualifier,
--   censored, coordinate_quality_tier, classification, source_dra_id,
--   source_dra_title, source_dra_citation.
--
-- Security behaviour mirrors fetch_samples_with_hidden_summary:
-- - authenticated context required
-- - matrix_map email allowlist required
-- - admin / matrix_admin callers see non-deleted DRAs regardless of
--   public/private state
-- - non-admin callers see only public or privately-granted DRAs
-- - samples without source_dra_id are intentionally excluded
--
-- Forward-only. No rollback emitted here.
-- =====================================================================

BEGIN;

SET LOCAL search_path = matrix_map, public, extensions, pg_catalog;

-- Same transient owner-grant pattern as prior matrix_map RPC migrations.
GRANT matrix_map_owner TO postgres;
GRANT CREATE ON SCHEMA matrix_map TO matrix_map_owner;

-- The verified live grant surface lacked these three SELECT grants for
-- the no-login function owner. Keep the grant set narrow and read-only.
GRANT SELECT ON matrix_map.measurements TO matrix_map_owner;
GRANT SELECT ON matrix_map.sample_events TO matrix_map_owner;
GRANT SELECT ON matrix_map.substances TO matrix_map_owner;

DROP FUNCTION IF EXISTS matrix_map.fetch_measurements_for_samples(uuid[]);

CREATE OR REPLACE FUNCTION matrix_map.fetch_measurements_for_samples(
  p_sample_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = matrix_map, public, extensions, pg_temp
AS $$
DECLARE
  v_uid          uuid;
  v_caller_email text;
  v_is_admin     boolean;
  v_rows         jsonb;
BEGIN
  v_uid := matrix_map.current_user_id();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'fetch_measurements_for_samples requires authenticated context'
      USING ERRCODE = '42501';
  END IF;

  v_caller_email := (matrix_map.jwt_claims() ->> 'email')::text;
  IF NOT matrix_map.is_email_allowlisted(v_caller_email) THEN
    RAISE EXCEPTION 'caller not on matrix_map allowlist'
      USING ERRCODE = '42501';
  END IF;

  IF p_sample_ids IS NULL OR array_length(p_sample_ids, 1) IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = v_uid
      AND role IN ('admin', 'matrix_admin')
  )
  INTO v_is_admin;

  WITH input_sample_ids AS (
    SELECT DISTINCT unnest(p_sample_ids) AS sample_id
  ),
  measurement_rows AS (
    SELECT
      s.id AS sample_id,
      s.display_name AS sample_display_name,
      s.station_id AS sample_station_id,
      se.id AS sample_event_id,
      se.event_date,
      m.id AS measurement_id,
      m.medium,
      sub.id AS substance_id,
      sub.key AS substance_key,
      sub.display_name AS substance_display_name,
      m.value,
      m.unit,
      m.detection_limit,
      m.qualifier,
      m.censored,
      s.coordinate_quality_tier,
      s.classification,
      s.source_dra_id,
      d.title AS source_dra_title,
      d.citation AS source_dra_citation
    FROM input_sample_ids i
    JOIN matrix_map.samples s ON s.id = i.sample_id
    JOIN matrix_map.dras d ON d.id = s.source_dra_id
    JOIN matrix_map.sample_events se ON se.sample_id = s.id
    JOIN matrix_map.measurements m ON m.sample_event_id = se.id
    JOIN matrix_map.substances sub ON sub.id = m.substance_id
    WHERE s.source_dra_id IS NOT NULL
      AND d.is_deleted = false
      AND (v_is_admin OR d.public = true OR matrix_map.has_private_grant(d.id))
    ORDER BY
      s.bnrrm_station_id NULLS LAST,
      s.id,
      se.event_date,
      sub.display_name,
      m.id
  )
  SELECT COALESCE(jsonb_agg(to_jsonb(measurement_rows)), '[]'::jsonb)
  FROM measurement_rows
  INTO v_rows;

  RETURN v_rows;
END;
$$;

ALTER FUNCTION matrix_map.fetch_measurements_for_samples(uuid[])
  OWNER TO matrix_map_owner;

REVOKE EXECUTE ON FUNCTION matrix_map.fetch_measurements_for_samples(uuid[])
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION matrix_map.fetch_measurements_for_samples(uuid[])
  TO authenticated;

COMMENT ON FUNCTION matrix_map.fetch_measurements_for_samples(uuid[]) IS
  'PR-MAP-5 Measurement Workbench RPC. Owner-run read-only verify on '
  '2026-05-21 showed the function was absent; matrix_map_owner is '
  'NOLOGIN BYPASSRLS; matrix_map_owner needed additional SELECT on '
  'measurements, sample_events, and substances; live domain was 290 '
  'samples / 302 events / 7472 measurements / 157 substances / 19 DRAs. '
  'Returns only measurements with a valid sample -> DRA provenance chain, '
  'using the same admin-bypass and private-grant visibility semantics as '
  'fetch_samples_with_hidden_summary.';

REVOKE CREATE ON SCHEMA matrix_map FROM matrix_map_owner;

COMMIT;
