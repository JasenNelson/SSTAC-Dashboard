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
