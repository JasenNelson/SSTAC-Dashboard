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
--   -- Confirm postgis is installed (geography type used by samples.geometry)
--   SELECT extname, extversion FROM pg_extension WHERE extname = 'postgis';
--   -- Expected: 1 row with extversion >= 3.0
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
-- SECTION 0 -- SCHEMA + SEARCH_PATH
-- =====================================================================
-- search_path scoped to matrix_map + public + pg_catalog for this
-- migration so unqualified type lookups (geography, jsonb, inet) resolve
-- against postgis (typically installed in public or its own schema) and
-- core catalog without surprises. The search_path SET is statement-local
-- to this transaction; production session search_path is not modified.

CREATE SCHEMA IF NOT EXISTS matrix_map;

SET LOCAL search_path = matrix_map, public, pg_catalog;

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
