-- Option C Phase 2 -- audited aggregate publication primitive (DRAFT ONLY).
--
-- This migration is committed for review only. Do not apply live until the owner approves
-- the exact SQL and live apply authority is separately granted.
--
-- Contract:
-- - aggregate publication does not update matrix_map.dras.public
-- - aggregate publication does not update matrix_map.samples.public
-- - member reads return opaque ids, neutral labels, bucketed counts, and no raw DRA provenance
-- - admin reads retain exact counts and raw provenance
-- - publication writes flow only through matrix_map.flip_site_aggregate_public(...)

BEGIN;

GRANT CREATE ON SCHEMA matrix_map TO matrix_map_owner;

-- ---------------------------------------------------------------------------
-- ONE meaningfulness authority for member-facing and audit text.
-- ---------------------------------------------------------------------------
-- PostgreSQL `trim(text)` is `btrim(text, ' ')`: it strips U+0020 ONLY. So a
-- label of a single TAB, newline, non-breaking space, or BOM passed every
-- `length(trim(x)) > 0` predicate in this script and persisted as a visually
-- blank member-facing label. The API route's JavaScript `.trim()` happens to
-- catch those, which is precisely the problem: the SQL boundary is documented
-- as DEFENSE IN DEPTH, NOT ROUTE-ONLY, and it was not independently sound.
--
-- `blank_trim` is the single authority. Every validation AND every persistence
-- site uses it, so "what counts as blank" cannot drift between them.
--
-- TrimString character set, stated explicitly rather than left to a locale or a
-- regex class. Written with backslash-u escapes so this file stays plain ASCII:
--   U+0009 tab           U+000A line feed      U+000B vertical tab
--   U+000C form feed     U+000D carriage ret   U+0020 space
--   U+00A0 no-break space                      U+1680 ogham space mark
--   U+2000..U+200A       en quad .. hair space
--   U+200B zero width space                    U+2028 line separator
--   U+2029 paragraph separator                 U+202F narrow no-break space
--   U+205F medium mathematical space           U+3000 ideographic space
--   U+FEFF zero width no-break space (BOM)
--
-- DELIBERATELY EXCLUDED: U+200C ZERO WIDTH NON-JOINER and U+200D ZERO WIDTH
-- JOINER. Both are invisible, but they carry orthographic meaning in Indic,
-- Arabic and emoji sequences -- stripping them would CORRUPT legitimate text
-- rather than reject blank text. Blankness is the target, not invisibility.
--
-- IMMUTABLE because a CHECK constraint below depends on it, and PARALLEL SAFE +
-- STRICT so a NULL input yields NULL (callers test NULL separately).
--
-- CREATE OR REPLACE, not DROP + CREATE, ON PURPOSE and unlike the lock helper:
-- a CHECK constraint depends on this function, so a `DROP ... RESTRICT` on
-- reapply would fail by design. The signature never changes, so REPLACE is
-- both safe and the only reapply-safe form.
CREATE OR REPLACE FUNCTION matrix_map.blank_trim(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
STRICT
SET search_path = pg_catalog
AS $blank_trim$
  SELECT pg_catalog.btrim(
    p_text,
    -- ONE literal, deliberately. Adjacent E-string constants are NOT implicitly
    -- concatenated the way plain quoted literals are, so splitting this across
    -- lines is a syntax error rather than a longer character set. The offline
    -- replay caught that; no source-level contract test would have.
    E'\u0009\u000A\u000B\u000C\u000D\u0020\u00A0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u200B\u2028\u2029\u202F\u205F\u3000\uFEFF'
  )
$blank_trim$;

COMMENT ON FUNCTION matrix_map.blank_trim(text) IS
  'Single authority for text meaningfulness on member-facing and audit columns. '
  'Strips the explicit TrimString set (ASCII whitespace, NBSP, Unicode separator '
  'spaces, line/paragraph separators, ZWSP and BOM), so a visually blank value '
  'cannot pass validation or be persisted. Excludes ZWNJ/ZWJ, which carry '
  'orthographic meaning. Used by both the table CHECK constraints and every RPC.';

-- OWNERSHIP IS LOAD-BEARING, not cosmetic. A CHECK constraint that calls this
-- function is evaluated with the privileges of whoever performs the INSERT --
-- and every write here happens inside a SECURITY DEFINER RPC owned by
-- matrix_map_owner. Without this line the function stays owned by the role that
-- ran the script, the REVOKEs below strip matrix_map_owner's inherited PUBLIC
-- grant, and every candidate write fails with 42501 "permission denied for
-- function blank_trim". The offline replay proved exactly that.
ALTER FUNCTION matrix_map.blank_trim(text) OWNER TO matrix_map_owner;

REVOKE ALL ON FUNCTION matrix_map.blank_trim(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION matrix_map.blank_trim(text) FROM anon;
REVOKE ALL ON FUNCTION matrix_map.blank_trim(text) FROM authenticated;
REVOKE ALL ON FUNCTION matrix_map.blank_trim(text) FROM service_role;

CREATE TABLE IF NOT EXISTS matrix_map.site_aggregate_publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_dra_id uuid NOT NULL REFERENCES matrix_map.dras(id) ON DELETE RESTRICT,
  coordinate_cluster_id text NOT NULL,
  representative_latitude double precision NOT NULL,
  representative_longitude double precision NOT NULL,
  coordinate_quality_tier text NOT NULL DEFAULT 'medium',
  coordinate_source text,
  member_display_label text NOT NULL,
  is_published boolean NOT NULL DEFAULT false,
  sample_count_total integer NOT NULL,
  sample_count_high integer NOT NULL DEFAULT 0,
  sample_count_medium integer NOT NULL DEFAULT 0,
  sample_count_low integer NOT NULL DEFAULT 0,
  distinct_point_count integer NOT NULL DEFAULT 1,
  data_snapshot_version text NOT NULL,
  source_sample_hash text NOT NULL,
  published_at timestamptz,
  published_by uuid,
  publish_reason text,
  unpublished_at timestamptz,
  unpublished_by uuid,
  unpublish_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT site_aggregate_publications_unit_unique UNIQUE (source_dra_id, coordinate_cluster_id),
  CONSTRAINT site_aggregate_publications_tier_check
    CHECK (coordinate_quality_tier IN ('high', 'medium', 'low')),
  CONSTRAINT site_aggregate_publications_lat_check
    CHECK (representative_latitude BETWEEN -90 AND 90),
  CONSTRAINT site_aggregate_publications_lng_check
    CHECK (representative_longitude BETWEEN -180 AND 180),
  CONSTRAINT site_aggregate_publications_counts_nonnegative
    CHECK (
      sample_count_total > 0
      AND sample_count_high >= 0
      AND sample_count_medium >= 0
      AND sample_count_low >= 0
      AND distinct_point_count >= 1
    ),
  CONSTRAINT site_aggregate_publications_counts_sum
    CHECK (sample_count_total = sample_count_high + sample_count_medium + sample_count_low),
  CONSTRAINT site_aggregate_publications_label_nonblank
    CHECK (length(matrix_map.blank_trim(member_display_label)) > 0),
  CONSTRAINT site_aggregate_publications_publish_metadata
    CHECK (
      is_published = false
      OR (
        published_at IS NOT NULL
        AND published_by IS NOT NULL
        AND publish_reason IS NOT NULL
        AND length(matrix_map.blank_trim(publish_reason)) > 0
      )
    )
);

COMMENT ON TABLE matrix_map.site_aggregate_publications IS
  'Option C aggregate publication backing table. Raw source_dra_id and exact counts are admin-only. '
  'Members must read only through matrix_map.fetch_published_site_aggregates(), which projects opaque '
  'publication ids, neutral labels, and bucketed counts. This table does not publish sample rows.';

COMMENT ON COLUMN matrix_map.site_aggregate_publications.id IS
  'Opaque publication id. This is the only aggregate id members may receive.';

COMMENT ON COLUMN matrix_map.site_aggregate_publications.source_dra_id IS
  'Raw DRA provenance for admin/audit use only. Never expose this for unpublished DRAs in member payloads.';

COMMENT ON COLUMN matrix_map.site_aggregate_publications.member_display_label IS
  'Owner-reviewed neutral member label. The member read path must not fall back to raw DRA title.';

CREATE INDEX IF NOT EXISTS site_aggregate_publications_published_idx
  ON matrix_map.site_aggregate_publications (is_published, member_display_label, id);

CREATE INDEX IF NOT EXISTS site_aggregate_publications_unit_idx
  ON matrix_map.site_aggregate_publications (source_dra_id, coordinate_cluster_id);

CREATE INDEX IF NOT EXISTS site_aggregate_publications_published_at_idx
  ON matrix_map.site_aggregate_publications (published_at DESC);

CREATE TABLE IF NOT EXISTS matrix_map.site_aggregate_publication_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id uuid NOT NULL REFERENCES matrix_map.site_aggregate_publications(id) ON DELETE RESTRICT,
  source_dra_id uuid NOT NULL,
  coordinate_cluster_id text NOT NULL,
  prior_value boolean NOT NULL,
  new_value boolean NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by uuid NOT NULL,
  changed_by_email text NOT NULL,
  reason text NOT NULL,
  prior_snapshot jsonb NOT NULL,
  new_snapshot jsonb NOT NULL
);

COMMENT ON TABLE matrix_map.site_aggregate_publication_audit IS
  'Audit log for Option C aggregate publication flips. Written only by '
  'matrix_map.flip_site_aggregate_public(...).';

CREATE INDEX IF NOT EXISTS site_aggregate_publication_audit_publication_idx
  ON matrix_map.site_aggregate_publication_audit (publication_id, changed_at DESC);

CREATE OR REPLACE FUNCTION matrix_map.site_aggregate_count_bucket(p_count integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = matrix_map, pg_temp
AS $$
  SELECT CASE
    WHEN p_count <= 1 THEN '1'
    WHEN p_count <= 9 THEN '2-9'
    WHEN p_count <= 99 THEN '10-99'
    ELSE '100+'
  END
$$;

ALTER FUNCTION matrix_map.site_aggregate_count_bucket(integer) OWNER TO matrix_map_owner;
REVOKE EXECUTE ON FUNCTION matrix_map.site_aggregate_count_bucket(integer)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION matrix_map.site_aggregate_count_bucket(integer)
  TO authenticated;

CREATE OR REPLACE FUNCTION matrix_map.enforce_site_aggregate_publication_via_rpc()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = matrix_map, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.is_published IS TRUE THEN
      RAISE EXCEPTION
        'site aggregate publication rows must be inserted unpublished and flipped through matrix_map.flip_site_aggregate_public(...)'
        USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
  END IF;

  IF ROW(
    NEW.source_dra_id,
    NEW.coordinate_cluster_id,
    NEW.is_published,
    NEW.member_display_label,
    NEW.representative_latitude,
    NEW.representative_longitude,
    NEW.coordinate_quality_tier,
    NEW.coordinate_source,
    NEW.sample_count_total,
    NEW.sample_count_high,
    NEW.sample_count_medium,
    NEW.sample_count_low,
    NEW.distinct_point_count,
    NEW.data_snapshot_version,
    NEW.source_sample_hash,
    NEW.published_at,
    NEW.published_by,
    NEW.publish_reason,
    NEW.unpublished_at,
    NEW.unpublished_by,
    NEW.unpublish_reason
  ) IS DISTINCT FROM ROW(
    OLD.source_dra_id,
    OLD.coordinate_cluster_id,
    OLD.is_published,
    OLD.member_display_label,
    OLD.representative_latitude,
    OLD.representative_longitude,
    OLD.coordinate_quality_tier,
    OLD.coordinate_source,
    OLD.sample_count_total,
    OLD.sample_count_high,
    OLD.sample_count_medium,
    OLD.sample_count_low,
    OLD.distinct_point_count,
    OLD.data_snapshot_version,
    OLD.source_sample_hash,
    OLD.published_at,
    OLD.published_by,
    OLD.publish_reason,
    OLD.unpublished_at,
    OLD.unpublished_by,
    OLD.unpublish_reason
  ) THEN
    IF current_user IS DISTINCT FROM 'matrix_map_owner' THEN
      RAISE EXCEPTION
        'matrix_map.site_aggregate_publications may only be changed via matrix_map.flip_site_aggregate_public(...)'
        USING ERRCODE = '42501';
    END IF;

    IF current_setting('matrix_map.audited_site_aggregate_publication', true) IS DISTINCT FROM '1' THEN
      IF current_setting('matrix_map.audited_site_aggregate_candidate', true) = '1' THEN
        -- Candidate upsert path: reject any changes to publication metadata
        IF NEW.is_published IS DISTINCT FROM OLD.is_published
           OR NEW.published_at IS DISTINCT FROM OLD.published_at
           OR NEW.published_by IS DISTINCT FROM OLD.published_by
           OR NEW.publish_reason IS DISTINCT FROM OLD.publish_reason
           OR NEW.unpublished_at IS DISTINCT FROM OLD.unpublished_at
           OR NEW.unpublished_by IS DISTINCT FROM OLD.unpublished_by
           OR NEW.unpublish_reason IS DISTINCT FROM OLD.unpublish_reason THEN
          RAISE EXCEPTION
            'site aggregate candidate UPDATE cannot change publication state'
            USING ERRCODE = '42501';
        END IF;
      ELSE
        RAISE EXCEPTION
          'site aggregate publication UPDATE seen outside matrix_map.flip_site_aggregate_public or audited candidate path'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION matrix_map.enforce_site_aggregate_publication_via_rpc()
  OWNER TO matrix_map_owner;

REVOKE EXECUTE ON FUNCTION matrix_map.enforce_site_aggregate_publication_via_rpc()
  FROM PUBLIC, anon, authenticated, service_role;

DROP TRIGGER IF EXISTS trg_site_aggregate_publication_rpc_only
  ON matrix_map.site_aggregate_publications;

CREATE TRIGGER trg_site_aggregate_publication_rpc_only
  BEFORE INSERT OR UPDATE ON matrix_map.site_aggregate_publications
  FOR EACH ROW
  EXECUTE FUNCTION matrix_map.enforce_site_aggregate_publication_via_rpc();

ALTER TABLE matrix_map.site_aggregate_publications
  ENABLE ALWAYS TRIGGER trg_site_aggregate_publication_rpc_only;

-- PAGINATION IS INSIDE THIS FUNCTION, for the same reason as the admin RPC.
-- This is PL/pgSQL, so `RETURN QUERY` materializes the ENTIRE sorted result
-- before any outer PostgREST `.range()` trims it -- a 25-page member load
-- recomputed and re-sorted the whole published set 25 times. `.range()` bounds
-- the payload, never the database work.
--
-- BOTH signatures are dropped: leaving the no-argument form installed would let
-- PostgREST resolve an unbounded path and silently restore the defect.
-- No argument defaults, so every caller states its own bounds.
--
-- The member-safe projection below is UNCHANGED: same opaque aggregate id, same
-- label, same 3-decimal coordinate rounding, same bucketed counts, same
-- conditional suppression key, same ordering. Only the bounds are new.
DROP FUNCTION IF EXISTS matrix_map.fetch_published_site_aggregates() RESTRICT;
DROP FUNCTION IF EXISTS matrix_map.fetch_published_site_aggregates(integer, integer) RESTRICT;

CREATE FUNCTION matrix_map.fetch_published_site_aggregates(
  p_limit integer,
  p_offset integer
)
RETURNS TABLE (
  aggregate_id uuid,
  label text,
  representative_latitude double precision,
  representative_longitude double precision,
  coordinate_quality_tier text,
  sample_count_bucket text,
  data_snapshot_version text,
  visible_sample_suppression_key text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = matrix_map, public, pg_temp
AS $$
DECLARE
  v_uid uuid;
  v_email text;
  -- Hard ceiling on one member page, mirroring the admin RPC.
  c_max_limit constant integer := 1000;
  -- Largest legitimate first row of the last client page:
  -- (MAX_PAGES - 1) * PAGE_SIZE = (25 - 1) * 1000.
  c_max_offset constant integer := 24000;
BEGIN
  v_uid := matrix_map.current_user_id();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'fetch_published_site_aggregates requires authenticated user context'
      USING ERRCODE = '42501';
  END IF;

  -- Fail closed on invalid bounds rather than coercing them into a default
  -- page, which is how an unbounded scan returns.
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > c_max_limit THEN
    RAISE EXCEPTION
      'fetch_published_site_aggregates requires 1 <= p_limit <= %, got %',
      c_max_limit, coalesce(p_limit::text, 'NULL')
      USING ERRCODE = 'UE422';
  END IF;

  -- BOUNDED-PAGINATION CONTRACT (FIX 7, accepted holistic finding). p_limit was
  -- ceilinged but p_offset had no UPPER bound, so an arbitrarily large offset
  -- was accepted. PostgreSQL discards only rows that EXIST, so the work is
  -- bounded by the published-set size rather than by the offset value -- but an
  -- arbitrary offset still defeats the BOUNDED-PAGINATION contract this function
  -- exists to enforce, and it forces a full sort where a small LIMIT would
  -- otherwise permit a bounded top-N sort.
  --
  -- The ceiling is derived from the shipped client contract, not invented here:
  -- src/lib/matrix-map/site-aggregate-pagination.ts pages at PAGE_SIZE = 1000
  -- with MAX_PAGES = 25, so the largest LEGITIMATE request begins at
  -- (25 - 1) * 1000 = 24000. A contract test binds that TypeScript pair to this
  -- literal so the two cannot silently drift.
  IF p_offset IS NULL OR p_offset < 0 OR p_offset > c_max_offset THEN
    RAISE EXCEPTION
      'fetch_published_site_aggregates requires 0 <= p_offset <= %, got %',
      c_max_offset, coalesce(p_offset::text, 'NULL')
      USING ERRCODE = 'UE422';
  END IF;

  -- Note: is_email_allowlisted checks if the caller holds a valid role. The email itself
  -- is currently ignored, but we pass it to satisfy the function signature.
  v_email := matrix_map.jwt_claims() ->> 'email';
  IF v_email IS NULL OR NOT matrix_map.is_email_allowlisted(v_email) THEN
    RAISE EXCEPTION 'fetch_published_site_aggregates requires an allowlisted member'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    sap.id AS aggregate_id,
    sap.member_display_label AS label,
    round(sap.representative_latitude::numeric, 3)::double precision AS representative_latitude,
    round(sap.representative_longitude::numeric, 3)::double precision AS representative_longitude,
    sap.coordinate_quality_tier,
    matrix_map.site_aggregate_count_bucket(sap.sample_count_total) AS sample_count_bucket,
    sap.data_snapshot_version,
    -- Clarify the conditional duplicate-suppression contract:
    -- The member RPC returns a DRA-derived suppression key only when the caller can
    -- already see that DRA through d.public, an existing private grant, or an admin role.
    -- It must remain NULL for independently published hidden aggregates to prevent
    -- any privilege expansion or raw DRA id leakage.
    CASE
      WHEN d.public = true
        OR matrix_map.has_private_grant(d.id)
        OR EXISTS (
          SELECT 1
          FROM public.user_roles ur
          WHERE ur.user_id = v_uid
            AND ur.role IN ('admin', 'matrix_admin')
        )
        THEN sap.source_dra_id::text || ':' || sap.coordinate_cluster_id
      ELSE NULL
    END AS visible_sample_suppression_key
  FROM matrix_map.site_aggregate_publications sap
  JOIN matrix_map.dras d ON d.id = sap.source_dra_id
  WHERE sap.is_published = true
    AND d.is_deleted = false
  -- TOTAL order (id is unique), applied BEFORE the bounds, so consecutive pages
  -- cannot overlap or skip rows.
  ORDER BY sap.member_display_label ASC, sap.id ASC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

ALTER FUNCTION matrix_map.fetch_published_site_aggregates(integer, integer)
  OWNER TO matrix_map_owner;

REVOKE EXECUTE ON FUNCTION matrix_map.fetch_published_site_aggregates(integer, integer)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION matrix_map.fetch_published_site_aggregates(integer, integer)
  TO authenticated;

-- ---------------------------------------------------------------------------
-- SERVER-AUTHORITATIVE DRIFT (architectural correction, 2026-07-27 restack).
--
-- This function now returns `snapshot_drift_state`, and it is the ONLY place
-- candidate drift is decided.
--
-- WHY. The admin UI previously recomputed the live aggregate in TypeScript and
-- compared it field-by-field against the persisted candidate. That made the
-- client a SECOND implementation of a PostgreSQL aggregate, and the two could
-- not be made to agree over an unconstrained `text` column: successive review
-- rounds found the population differed (medium-only vs all-tier), then blank
-- handling differed (JS truthiness vs `length(trim(...)) > 0`), then trim
-- semantics differed (PostgreSQL `trim` strips U+0020 only; JS `.trim()` strips
-- the whole ECMAScript whitespace set), then sort order differed (`COLLATE "C"`
-- compares UTF-8 BYTES; JS `.sort()` compares UTF-16 CODE UNITS, which invert
-- for e.g. U+E000 vs U+10000). Each disagreement produced PERMANENT drift that
-- no refresh could clear. The remaining surface - collation, normalization,
-- encoding, locale - is unbounded, so the duplicate authority was removed
-- rather than chased.
--
-- HOW. `matrix_map.current_site_aggregate_snapshot` is invoked through a
-- LEFT JOIN LATERAL and the comparison is made on `source_sample_hash`, which
-- that function already computes and which the publish path already treats as
-- authoritative. The client now displays this value and computes nothing.
--
-- ACCESS. `current_site_aggregate_snapshot` stays REVOKEd from PUBLIC, anon,
-- authenticated and service_role, and is NOT granted to anyone here. It is
-- reachable only because this function is SECURITY DEFINER owned by
-- matrix_map_owner, which owns the snapshot function and therefore retains
-- EXECUTE on it. No new privilege is created.
--
-- LEFT, not INNER: a publication whose live aggregate has vanished (no samples,
-- so the snapshot returns zero rows) must still appear, reporting `unknown`.
-- An INNER join would silently drop exactly the orphaned publications whose
-- Unpublish control is the reason this admin list exists. Row count and ORDER
-- BY are therefore unchanged, so no second independently truncated set is
-- introduced.
--
-- REAPPLY SAFETY: adding a column to RETURNS TABLE cannot be done with
-- CREATE OR REPLACE - PostgreSQL raises 42P13 "cannot change return type of
-- existing function". The DROP below is therefore REQUIRED for a reapply over
-- an older install, and is RESTRICT so it fails closed if any dependent object
-- exists rather than silently removing it. Ownership, REVOKEs and GRANTs are
-- reinstated immediately after the CREATE, inside this same transaction.
-- ---------------------------------------------------------------------------
-- PAGINATION IS INSIDE THIS FUNCTION, deliberately.
-- This is PL/pgSQL, so `RETURN QUERY` materializes the ENTIRE result before any
-- outer PostgREST `.range()` is applied. With the drift LATERAL in the main
-- query that meant `current_site_aggregate_snapshot` was evaluated for EVERY
-- publication on EVERY page request: at the documented 25,000-row cap, 25 pages
-- could trigger ~625,000 snapshot computations, each scanning and sorting
-- sample data. `.range()` limits what crosses the wire, never what the database
-- does. Callers now pass explicit bounds and must NOT rely on `.range()`.
--
-- BOTH signatures are dropped: the pre-pagination `(uuid)` form and the current
-- one. Leaving the old form installed would let PostgREST resolve a call to the
-- unpaginated function and silently restore the defect, and an overload pair
-- would make resolution ambiguous. There are NO argument defaults for the same
-- reason -- every caller states its own bounds.
DROP FUNCTION IF EXISTS matrix_map.fetch_admin_site_aggregate_publications(uuid) RESTRICT;
DROP FUNCTION IF EXISTS matrix_map.fetch_admin_site_aggregate_publications(uuid, integer, integer) RESTRICT;

CREATE FUNCTION matrix_map.fetch_admin_site_aggregate_publications(
  p_publication_id uuid,
  p_limit integer,
  p_offset integer
)
RETURNS TABLE (
  publication_id uuid,
  source_dra_id uuid,
  source_dra_title text,
  coordinate_cluster_id text,
  representative_latitude double precision,
  representative_longitude double precision,
  coordinate_quality_tier text,
  coordinate_source text,
  member_display_label text,
  is_published boolean,
  sample_count_total integer,
  sample_count_high integer,
  sample_count_medium integer,
  sample_count_low integer,
  distinct_point_count integer,
  count_bucket text,
  data_snapshot_version text,
  source_sample_hash text,
  published_at timestamptz,
  published_by uuid,
  publish_reason text,
  unpublished_at timestamptz,
  unpublished_by uuid,
  unpublish_reason text,
  -- 'match' | 'drift' | 'unknown'. The SOLE authority on candidate drift.
  snapshot_drift_state text,
  -- OPTIMISTIC-CONCURRENCY TOKEN. Advanced by the table's trigger on every
  -- candidate refresh and publication flip, so it identifies exactly the
  -- version an operator reviewed. flip_site_aggregate_public requires it back
  -- unchanged before it will publish.
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = matrix_map, public, pg_temp
AS $$
DECLARE
  v_uid uuid;
  v_is_authorized boolean;
  -- Hard ceiling on one page of drift computation. Bounded so a caller cannot
  -- request the whole table and reinstate the defect this fix removes.
  c_max_limit constant integer := 1000;
  -- Largest legitimate first row of the last client page:
  -- (MAX_PAGES - 1) * PAGE_SIZE = (25 - 1) * 1000.
  c_max_offset constant integer := 24000;
BEGIN
  v_uid := matrix_map.current_user_id();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'fetch_admin_site_aggregate_publications requires authenticated user context'
      USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_uid
      AND role IN ('admin', 'matrix_admin')
  )
  INTO v_is_authorized;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'fetch_admin_site_aggregate_publications requires admin or matrix_admin role'
      USING ERRCODE = '42501';
  END IF;

  -- Validate bounds BEFORE any work. Fail closed: a NULL, non-positive, or
  -- oversized limit, or a negative offset, is a caller defect, not something to
  -- silently coerce into a default page.
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > c_max_limit THEN
    RAISE EXCEPTION
      'fetch_admin_site_aggregate_publications requires 1 <= p_limit <= %, got %',
      c_max_limit, coalesce(p_limit::text, 'NULL')
      USING ERRCODE = 'UE422';
  END IF;

  -- BOUNDED-PAGINATION CONTRACT (FIX 7, accepted holistic finding). p_limit was
  -- ceilinged but p_offset had no UPPER bound, so an arbitrarily large offset
  -- was accepted. PostgreSQL discards only rows that EXIST, so the work is
  -- bounded by the published-set size rather than by the offset value -- but an
  -- arbitrary offset still defeats the BOUNDED-PAGINATION contract this function
  -- exists to enforce, and it forces a full sort where a small LIMIT would
  -- otherwise permit a bounded top-N sort.
  --
  -- The ceiling is derived from the shipped client contract, not invented here:
  -- src/lib/matrix-map/site-aggregate-pagination.ts pages at PAGE_SIZE = 1000
  -- with MAX_PAGES = 25, so the largest LEGITIMATE request begins at
  -- (25 - 1) * 1000 = 24000. A contract test binds that TypeScript pair to this
  -- literal so the two cannot silently drift.
  IF p_offset IS NULL OR p_offset < 0 OR p_offset > c_max_offset THEN
    RAISE EXCEPTION
      'fetch_admin_site_aggregate_publications requires 0 <= p_offset <= %, got %',
      c_max_offset, coalesce(p_offset::text, 'NULL')
      USING ERRCODE = 'UE422';
  END IF;

  RETURN QUERY
  -- MATERIALIZED is load-bearing, not a hint. It forces the page to be chosen
  -- BEFORE the LATERAL below runs, so the snapshot is computed for at most
  -- p_limit publications. Without it the planner may inline this CTE into the
  -- outer join and evaluate the snapshot across the whole filtered set again.
  WITH page AS MATERIALIZED (
    SELECT sap.*
    FROM matrix_map.site_aggregate_publications sap
    WHERE p_publication_id IS NULL OR sap.id = p_publication_id
    -- ORDERING AND PAGINATION -- stated precisely, because an earlier version of
    -- this comment overclaimed and a review caught it.
    --
    -- `id` is unique, so this ORDER BY is a TOTAL order WITHIN ONE STATEMENT:
    -- a single execution cannot return a row twice or leave one out.
    --
    -- It does NOT make OFFSET pages across INDEPENDENT requests a database
    -- snapshot. Each page RPC is its own statement against live data. If
    -- `sample_count_total` or `member_display_label` changes between two page
    -- requests -- a concurrent refresh does exactly that -- a row can move
    -- across an OFFSET boundary, so one row is returned twice and another is
    -- never returned. The unique `id` breaks ties within a statement; it does
    -- not pin the sort keys ahead of it across statements.
    --
    -- THEREFORE: correctness-sensitive MUTATION VERIFICATION must not page this
    -- collection. It must call this function with p_publication_id set to the id
    -- returned by the mutation, p_limit 1 and p_offset 0 -- an exact-ID lookup
    -- that no concurrent reordering can move.
    --
    -- General admin inventory pagination remains BOUNDED BEST-EFFORT
    -- PRESENTATION: it is a browsable operator view, not a consistent snapshot,
    -- and it is not the basis of any correctness claim. Mutation RPCs enforce
    -- their own concurrency contracts.
    ORDER BY sap.sample_count_total DESC, sap.member_display_label ASC, sap.id ASC
    LIMIT p_limit OFFSET p_offset
  )
  SELECT
    sap.id,
    sap.source_dra_id,
    d.title,
    sap.coordinate_cluster_id,
    sap.representative_latitude,
    sap.representative_longitude,
    sap.coordinate_quality_tier,
    sap.coordinate_source,
    sap.member_display_label,
    sap.is_published,
    sap.sample_count_total,
    sap.sample_count_high,
    sap.sample_count_medium,
    sap.sample_count_low,
    sap.distinct_point_count,
    matrix_map.site_aggregate_count_bucket(sap.sample_count_total),
    sap.data_snapshot_version,
    sap.source_sample_hash,
    sap.published_at,
    sap.published_by,
    sap.publish_reason,
    sap.unpublished_at,
    sap.unpublished_by,
    sap.unpublish_reason,
    -- Hash equality, not a field-by-field tuple. source_sample_hash is derived
    -- by the snapshot function from the id-sorted per-sample canonical string,
    -- so it also catches a sample-identity substitution that leaves every
    -- visible count and coordinate unchanged -- something no comparison of
    -- aggregate fields can see.
    CASE
      -- FAIL CLOSED on a soft-deleted DRA. Its samples may still exist, so the
      -- snapshot can still recompute an identical hash and report 'match' --
      -- but flip_site_aggregate_public refuses to publish under a deleted DRA
      -- (UE409). Reporting 'match' would leave Publish enabled on the admin
      -- surface and fail only at dispatch. 'unknown' disables Publish while
      -- leaving the row (and its Unpublish control) reachable.
      WHEN d.is_deleted THEN 'unknown'
      WHEN cur.source_sample_hash IS NULL OR sap.source_sample_hash IS NULL THEN 'unknown'
      WHEN cur.source_sample_hash = sap.source_sample_hash THEN 'match'
      ELSE 'drift'
    END,
    sap.updated_at
  FROM page sap
  -- FK-guaranteed, so this join cannot shorten a page.
  JOIN matrix_map.dras d ON d.id = sap.source_dra_id
  -- Returns 0 or 1 row per publication: the snapshot aggregates one cluster and
  -- filters `total_cnt > 0`, so a publication with no live samples yields no
  -- row and LEFT preserves it as 'unknown'. Evaluated for AT MOST p_limit rows.
  LEFT JOIN LATERAL matrix_map.current_site_aggregate_snapshot(
    sap.source_dra_id, sap.coordinate_cluster_id
  ) cur ON true
  ORDER BY sap.sample_count_total DESC, sap.member_display_label ASC, sap.id ASC;
END;
$$;

ALTER FUNCTION matrix_map.fetch_admin_site_aggregate_publications(uuid, integer, integer)
  OWNER TO matrix_map_owner;

REVOKE EXECUTE ON FUNCTION matrix_map.fetch_admin_site_aggregate_publications(uuid, integer, integer)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION matrix_map.fetch_admin_site_aggregate_publications(uuid, integer, integer)
  TO authenticated;

CREATE OR REPLACE FUNCTION matrix_map.fetch_site_aggregate_publication_audit(p_publication_id uuid)
RETURNS TABLE (
  id uuid,
  publication_id uuid,
  source_dra_id uuid,
  coordinate_cluster_id text,
  prior_value boolean,
  new_value boolean,
  changed_at timestamptz,
  changed_by uuid,
  changed_by_email text,
  reason text,
  prior_snapshot jsonb,
  new_snapshot jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = matrix_map, public, pg_temp
AS $$
DECLARE
  v_uid uuid;
  v_is_authorized boolean;
BEGIN
  v_uid := matrix_map.current_user_id();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'fetch_site_aggregate_publication_audit requires authenticated user context'
      USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_uid
      AND role IN ('admin', 'matrix_admin')
  )
  INTO v_is_authorized;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'fetch_site_aggregate_publication_audit requires admin or matrix_admin role'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    a.id,
    a.publication_id,
    a.source_dra_id,
    a.coordinate_cluster_id,
    a.prior_value,
    a.new_value,
    a.changed_at,
    a.changed_by,
    a.changed_by_email,
    a.reason,
    a.prior_snapshot,
    a.new_snapshot
  FROM matrix_map.site_aggregate_publication_audit a
  WHERE a.publication_id = p_publication_id
  ORDER BY a.changed_at DESC, a.id DESC
  LIMIT 50;
END;
$$;

ALTER FUNCTION matrix_map.fetch_site_aggregate_publication_audit(uuid)
  OWNER TO matrix_map_owner;

REVOKE EXECUTE ON FUNCTION matrix_map.fetch_site_aggregate_publication_audit(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION matrix_map.fetch_site_aggregate_publication_audit(uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION matrix_map.canonical_five_decimal_cluster(p_lat double precision, p_lng double precision)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_temp
AS $$
  -- Plain `trim` ON PURPOSE, not blank_trim. This strips the sign-position pad
  -- that `to_char` emits, which is always U+0020 by construction -- it is not a
  -- meaningfulness test on user text, and widening the character set here would
  -- change cluster identity for no benefit.
  SELECT trim(to_char(round(p_lat::numeric, 5), 'FM9990.00000')) || ',' || trim(to_char(round(p_lng::numeric, 5), 'FM9990.00000'));
$$;

ALTER FUNCTION matrix_map.canonical_five_decimal_cluster(double precision, double precision) OWNER TO matrix_map_owner;
REVOKE EXECUTE ON FUNCTION matrix_map.canonical_five_decimal_cluster(double precision, double precision) FROM PUBLIC, anon, authenticated, service_role;

-- SEMANTIC INDEX-COMPATIBILITY GUARD (G3 correction, 2026-07-28).
--
-- The previous guard was two substring probes over `pg_indexes.indexdef`:
--   NOT (v_def LIKE '%source_dra_id%' AND v_def LIKE '%canonical_five_decimal_cluster%')
-- An existing index of the same NAME that merely CONTAINS both tokens passed it
-- and was then accepted, so the guard verified far less than the message it
-- raises claims. Every one of these passes token presence while defeating the
-- purpose of the index: reversed key order; a swapped argument order
-- (`canonical_five_decimal_cluster(longitude, latitude)`, a DIFFERENT definition
-- of cluster identity); a partial WHERE predicate; a non-default opclass such as
-- `text_pattern_ops`; a CUSTOM operator class in another schema that merely
-- shares the name `uuid_ops` or `text_ops`; an INCLUDE column; UNIQUE; DESC or
-- NULLS FIRST; or an index of that name sitting on an entirely different table.
--
-- This replaces the substring test with a pg_catalog conformance check.
--
-- It is a FUNCTION rather than an inline DO block for the same reason
-- apply_candidate_audit_publication_id_invariant is one: an inline block cannot
-- be invoked by an executable negative control, and a control that
-- re-implements the predicate would be a second hand-maintained copy of it --
-- the exact root cause this restack already removed once. TEST_54..TEST_61 call
-- THIS function, so the shipped guard and the tested guard are the same bytes.
--
-- READ-ONLY and FAIL-CLOSED. It raises UE409 and never drops, renames,
-- reindexes, replaces or otherwise repairs anything.
CREATE OR REPLACE FUNCTION matrix_map.assert_conforming_dra_cluster_index(
  p_index_schema text,
  p_index_name text,
  p_table regclass
)
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  -- Schema-qualified, so this resolves regardless of the caller's search_path.
  c_expr_fn constant oid := 'matrix_map.canonical_five_decimal_cluster(double precision, double precision)'::regprocedure::oid;
  c_text_collation constant oid := (SELECT t.typcollation FROM pg_type t WHERE t.oid = 'pg_catalog.text'::regtype);
  v_indexrelid oid;
  v_relkind "char";
  v_amname text;
  v_indrelid oid;
  v_isvalid boolean;
  v_isready boolean;
  v_islive boolean;
  v_isunique boolean;
  v_isprimary boolean;
  v_isexclusion boolean;
  v_nkeyatts smallint;
  v_natts smallint;
  v_key1 smallint;
  v_key2 smallint;
  v_key1_attname text;
  v_haspred boolean;
  v_expr_text text;
  v_expr_norm text;
  v_fn_deps oid[];
  v_indclass1 oid;
  v_indclass2 oid;
  v_exp_opc_uuid oid;
  v_exp_opc_text oid;
  v_exp_opc_uuid_n integer;
  v_exp_opc_text_n integer;
  -- DIAGNOSTIC ONLY. These render the schema-qualified opclass names for the
  -- error message; they play NO part in the compatibility decision.
  v_opc1 text;
  v_opc2 text;
  v_coll1 oid;
  v_coll2 oid;
  v_opt1 smallint;
  v_opt2 smallint;
  v_def text;
  v_reason text := NULL;
BEGIN
  SELECT c.oid, c.relkind INTO v_indexrelid, v_relkind
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = p_index_schema
    AND c.relname = p_index_name;

  -- CLEAN FIRST APPLY: nothing of that name exists, so the CREATE INDEX below
  -- builds exactly the intended definition. Accept.
  IF v_indexrelid IS NULL THEN
    RETURN;
  END IF;

  -- NAME OCCUPIED BY A NON-INDEX. `CREATE INDEX IF NOT EXISTS` does not skip
  -- for a table/view/sequence of that name, so this would abort later with a
  -- generic message; fail here with the actionable one instead.
  IF v_relkind <> 'i' THEN
    RAISE EXCEPTION
      'relation %.% already exists and is NOT an index (relkind=%); drop or rename it before applying, or the drift snapshot predicate silently stays unindexed',
      p_index_schema, p_index_name, v_relkind
      USING ERRCODE = 'UE409';
  END IF;

  SELECT
    i.indrelid, i.indisvalid, i.indisready, i.indislive,
    i.indisunique, i.indisprimary, i.indisexclusion,
    i.indnkeyatts, i.indnatts,
    i.indkey[0], i.indkey[1],
    (i.indpred IS NOT NULL),
    pg_get_expr(i.indexprs, i.indrelid),
    i.indcollation[0], i.indcollation[1],
    i.indoption[0], i.indoption[1]
  INTO
    v_indrelid, v_isvalid, v_isready, v_islive,
    v_isunique, v_isprimary, v_isexclusion,
    v_nkeyatts, v_natts,
    v_key1, v_key2,
    v_haspred,
    v_expr_text,
    v_coll1, v_coll2,
    v_opt1, v_opt2
  FROM pg_index i
  WHERE i.indexrelid = v_indexrelid;

  SELECT am.amname INTO v_amname
  FROM pg_class c
  JOIN pg_am am ON am.oid = c.relam
  WHERE c.oid = v_indexrelid;

  -- OPERATOR CLASSES ARE PINNED BY CATALOG IDENTITY (OID), NEVER BY NAME.
  --
  -- An earlier revision of this guard compared `pg_opclass.opcname` against the
  -- literals 'uuid_ops' and 'text_ops'. Operator-class names are only unique per
  -- (access method, schema), so a CUSTOM btree operator class in ANY other
  -- schema may legitimately also be called `uuid_ops` or `text_ops` -- and it can
  -- belong to an operator family that does not support the equality predicate
  -- the drift snapshot issues. Such an index passed the name comparison,
  -- `CREATE INDEX IF NOT EXISTS` then preserved it, and the measured lookup was
  -- left effectively unindexed. That is the same defect class as the substring
  -- probe this function replaced -- a NAME standing in for an IDENTITY -- so the
  -- decision is made on OIDs.
  SELECT i.indclass[0], i.indclass[1] INTO v_indclass1, v_indclass2
  FROM pg_index i
  WHERE i.indexrelid = v_indexrelid;

  -- Resolve the EXPECTED opclass OIDs from the catalog rather than hardcoding
  -- them: the pg_catalog-resident, DEFAULT btree operator class for each input
  -- type. Resolved dynamically so this stays correct across server versions.
  SELECT count(*), min(oc.oid) INTO v_exp_opc_uuid_n, v_exp_opc_uuid
  FROM pg_opclass oc
  JOIN pg_am am ON am.oid = oc.opcmethod
  WHERE am.amname = 'btree'
    AND oc.opcintype = 'pg_catalog.uuid'::regtype
    AND oc.opcdefault
    AND oc.opcnamespace = 'pg_catalog'::regnamespace;

  SELECT count(*), min(oc.oid) INTO v_exp_opc_text_n, v_exp_opc_text
  FROM pg_opclass oc
  JOIN pg_am am ON am.oid = oc.opcmethod
  WHERE am.amname = 'btree'
    AND oc.opcintype = 'pg_catalog.text'::regtype
    AND oc.opcdefault
    AND oc.opcnamespace = 'pg_catalog'::regnamespace;

  -- FAIL CLOSED on an ambiguous or missing resolution. Silently comparing
  -- against a NULL expectation would make every subsequent comparison vacuous,
  -- which is precisely the failure mode this whole function exists to retire.
  IF v_exp_opc_uuid_n <> 1 OR v_exp_opc_uuid IS NULL
     OR v_exp_opc_text_n <> 1 OR v_exp_opc_text IS NULL THEN
    RAISE EXCEPTION
      'cannot resolve the expected pg_catalog default btree operator classes unambiguously (uuid matches=%, text matches=%); refusing to evaluate index %.% compatibility against an unknown expectation',
      v_exp_opc_uuid_n, v_exp_opc_text_n, p_index_schema, p_index_name
      USING ERRCODE = 'UE409';
  END IF;

  -- Human-readable labels for the message ONLY. Schema-qualified precisely so a
  -- same-named class in another schema is legible in the diagnostic.
  SELECT format('%s.%s', n1.nspname, oc1.opcname), format('%s.%s', n2.nspname, oc2.opcname)
  INTO v_opc1, v_opc2
  FROM pg_index i
  LEFT JOIN pg_opclass oc1 ON oc1.oid = i.indclass[0]
  LEFT JOIN pg_namespace n1 ON n1.oid = oc1.opcnamespace
  LEFT JOIN pg_opclass oc2 ON oc2.oid = i.indclass[1]
  LEFT JOIN pg_namespace n2 ON n2.oid = oc2.opcnamespace
  WHERE i.indexrelid = v_indexrelid;

  -- The set of functions this index actually DEPENDS on. This pins the
  -- expression's function IDENTITY (schema, name AND argument types) from the
  -- catalog rather than from its rendered text, so a same-named function in
  -- another schema, or a different overload, cannot satisfy it.
  SELECT coalesce(array_agg(DISTINCT d.refobjid), '{}'::oid[]) INTO v_fn_deps
  FROM pg_depend d
  WHERE d.classid = 'pg_class'::regclass
    AND d.objid = v_indexrelid
    AND d.refclassid = 'pg_proc'::regclass;

  IF v_key1 IS NOT NULL AND v_key1 <> 0 THEN
    SELECT a.attname INTO v_key1_attname
    FROM pg_attribute a
    WHERE a.attrelid = v_indrelid AND a.attnum = v_key1 AND NOT a.attisdropped;
  END IF;

  -- Rendered expression text, normalized: whitespace removed, lowercased, and a
  -- single outer parenthesis pair stripped if pg_get_expr added one. This is the
  -- ONLY check that carries ARGUMENT ORDER, which the catalog does not expose as
  -- a scalar. Function identity is already pinned structurally above, so the
  -- schema qualifier is accepted either way rather than making the check
  -- depend on the caller's search_path.
  v_expr_norm := regexp_replace(lower(coalesce(v_expr_text, '')), '\s', '', 'g');
  IF length(v_expr_norm) >= 2 AND left(v_expr_norm, 1) = '(' AND right(v_expr_norm, 1) = ')' THEN
    v_expr_norm := substr(v_expr_norm, 2, length(v_expr_norm) - 2);
  END IF;

  -- FIRST failing condition wins, so the message names one actionable cause.
  IF v_indrelid <> p_table::oid THEN
    v_reason := format('it indexes %s, not %s', v_indrelid::regclass::text, p_table::text);
  ELSIF v_amname IS DISTINCT FROM 'btree' THEN
    v_reason := format('access method is %s, expected btree', coalesce(v_amname, '<null>'));
  ELSIF NOT (v_isvalid AND v_isready AND v_islive) THEN
    v_reason := format('it is not valid/ready/live (indisvalid=%s indisready=%s indislive=%s)', v_isvalid, v_isready, v_islive);
  ELSIF v_isunique OR v_isprimary OR v_isexclusion THEN
    v_reason := format('it is unique/primary/exclusion (indisunique=%s indisprimary=%s indisexclusion=%s), expected a plain non-unique index', v_isunique, v_isprimary, v_isexclusion);
  ELSIF v_nkeyatts <> 2 OR v_natts <> 2 THEN
    v_reason := format('it has %s key attribute(s) and %s total attribute(s), expected exactly 2 keys and no INCLUDE columns', v_nkeyatts, v_natts);
  ELSIF v_key1 = 0 OR v_key1_attname IS DISTINCT FROM 'source_dra_id' THEN
    v_reason := format('first key is %s, expected the column source_dra_id', coalesce(v_key1_attname, '<expression>'));
  ELSIF v_key2 <> 0 THEN
    v_reason := 'second key is a plain column, expected the expression canonical_five_decimal_cluster(latitude, longitude)';
  ELSIF v_fn_deps IS DISTINCT FROM ARRAY[c_expr_fn] THEN
    v_reason := format('its expression does not depend on exactly matrix_map.canonical_five_decimal_cluster(double precision, double precision) (dependencies: %s)', coalesce(array_to_string(v_fn_deps, ', '), '<none>'));
  ELSIF v_expr_norm NOT IN (
      'matrix_map.canonical_five_decimal_cluster(latitude,longitude)',
      'canonical_five_decimal_cluster(latitude,longitude)') THEN
    v_reason := format('its expression is %s, expected canonical_five_decimal_cluster(latitude, longitude) in that argument order', coalesce(v_expr_text, '<null>'));
  ELSIF v_haspred THEN
    v_reason := 'it is a PARTIAL index (has a WHERE predicate), so it cannot serve the snapshot predicate for every row';
  ELSIF v_indclass1 IS DISTINCT FROM v_exp_opc_uuid OR v_indclass2 IS DISTINCT FROM v_exp_opc_text THEN
    -- OID comparison. The names in this message are diagnostics; they did not
    -- decide anything.
    v_reason := format(
      'operator classes are (%s [oid %s], %s [oid %s]), expected the pg_catalog DEFAULT btree classes (oid %s for uuid, oid %s for text); a same-NAMED class in another schema is not the same class',
      coalesce(v_opc1, '<null>'), coalesce(v_indclass1::text, '<null>'),
      coalesce(v_opc2, '<null>'), coalesce(v_indclass2::text, '<null>'),
      v_exp_opc_uuid, v_exp_opc_text);
  ELSIF v_coll1 <> 0 OR v_coll2 <> c_text_collation THEN
    v_reason := format('collations are (%s, %s), expected (0, %s -- the default text collation)', v_coll1, v_coll2, c_text_collation);
  ELSIF v_opt1 <> 0 OR v_opt2 <> 0 THEN
    v_reason := format('per-column options are (%s, %s), expected (0, 0) -- ASC with NULLS LAST on both keys', v_opt1, v_opt2);
  END IF;

  IF v_reason IS NOT NULL THEN
    SELECT pg_get_indexdef(v_indexrelid) INTO v_def;
    RAISE EXCEPTION
      'index %.% already exists with an INCOMPATIBLE definition: %. Definition: %. Refusing to drop, rename, reindex or repair automatically -- drop or rename it before applying, or the drift snapshot predicate silently stays unindexed.',
      p_index_schema, p_index_name, v_reason, coalesce(v_def, '<unavailable>')
      USING ERRCODE = 'UE409';
  END IF;
END;
$$;

ALTER FUNCTION matrix_map.assert_conforming_dra_cluster_index(text, text, regclass) OWNER TO matrix_map_owner;
REVOKE ALL ON FUNCTION matrix_map.assert_conforming_dra_cluster_index(text, text, regclass)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION matrix_map.assert_conforming_dra_cluster_index(text, text, regclass)
  TO matrix_map_owner;

-- SUPPORTING INDEX for the drift snapshot's lookup predicate.
--
-- MEASURED, not assumed. The snapshot filters samples by BOTH source_dra_id and
-- the canonicalized coordinate cluster. `samples_source_dra_id` narrows only to
-- "this DRA's rows"; every one of them must then be filtered by evaluating
-- canonical_five_decimal_cluster(), which no existing index can satisfy. The
-- admin page evaluates the snapshot once per publication, so the cost compounds
-- per row on the page.
--
-- Offline measurement on a disposable PostGIS instance, 427,500 samples with one
-- DRA holding 3,000 clusters (the adversarial shape -- many clusters under one
-- DRA), full p_limit=1000 admin page:
--   without this index   57.93 s   735,488 buffers
--   with this index      0.21-0.24 s  (~54x fewer buffers)
-- The per-cluster cost was table-size independent (46.4 ms/cluster at 27.5k rows,
-- 47.5 ms at 227.5k), confirming the bottleneck is the unindexable predicate
-- rather than table growth. Write cost measured at +14.8% on bulk insert and
-- ~25.6% additional index storage.
--
-- HONEST SCOPE NOTE: production matrix_map.samples is currently in the low
-- thousands of rows, far below the tested scale, so the cliff is not being hit
-- today and the build at D2 time is effectively instantaneous. This index is
-- preventative -- it removes a cliff that arrives with data growth, at a cost
-- that is trivial now and would be painful to add later under load.
--
-- canonical_five_decimal_cluster is IMMUTABLE, which is what makes this
-- expression indexable; the index is created from the SAME function the query
-- calls, so there is no second definition of cluster identity to drift.
-- FAIL CLOSED ON A NAME COLLISION. `CREATE INDEX IF NOT EXISTS` is a
-- notice-only no-op when an index of that NAME already exists, whatever its
-- definition -- so a pre-existing, differently-defined `samples_dra_canonical_cluster`
-- would let apply and postflight both succeed while the measured snapshot
-- predicate stayed unindexed. The whole point of this index is silently lost.
--
-- The conformance predicate itself lives in
-- matrix_map.assert_conforming_dra_cluster_index (defined above), so the shipped
-- guard is the same bytes the negative controls execute.
SELECT matrix_map.assert_conforming_dra_cluster_index(
  'matrix_map', 'samples_dra_canonical_cluster', 'matrix_map.samples'::regclass);

CREATE INDEX IF NOT EXISTS samples_dra_canonical_cluster
  ON matrix_map.samples (
    source_dra_id,
    matrix_map.canonical_five_decimal_cluster(latitude, longitude)
  );

CREATE OR REPLACE FUNCTION matrix_map.current_site_aggregate_snapshot(p_source_dra_id uuid, p_cluster_id text)
RETURNS TABLE (
  representative_latitude double precision,
  representative_longitude double precision,
  sample_count_total integer,
  sample_count_high integer,
  sample_count_medium integer,
  sample_count_low integer,
  distinct_point_count integer,
  coordinate_quality_tier text,
  coordinate_source text,
  source_sample_hash text
)
LANGUAGE plpgsql
STABLE
SET search_path = matrix_map, pg_temp
AS $$
BEGIN
  RETURN QUERY
  WITH cluster_samples AS (
    SELECT
      s.id,
      s.latitude,
      s.longitude,
      s.coordinate_quality_tier,
      s.coordinate_source
    FROM matrix_map.samples s
    WHERE s.source_dra_id = p_source_dra_id
      AND matrix_map.canonical_five_decimal_cluster(s.latitude, s.longitude) = p_cluster_id
      -- F2 -- THE SAME COORDINATE-ELIGIBILITY PREDICATE the live preview applies
      -- to its base population (see fetch_admin_site_aggregate_live_preview).
      --
      -- WHY THIS IS REQUIRED, and why it is a correctness fix rather than tidying.
      -- Membership here was decided by DRA plus canonical key ALONE, and ROUNDING
      -- CARRIES A JUST-OUT-OF-RANGE ROW INTO AN IN-RANGE KEY: longitude
      -- 180.000001 is ineligible and the preview excludes it, but
      -- round(180.000001, 5) is 180.00000, so it rendered to the very same
      -- canonical id an eligible row produces and was still counted HERE.
      --
      -- NULL and NaN coordinates were already excluded, because the identity
      -- function is not STRICT: a NULL yields NULL and a NaN yields a 'NaN'
      -- rendering, neither of which equals any key an eligible pair produces. The
      -- reachable gap is precisely values within 0.000005 of a bound, which is
      -- why the predicate rather than the key comparison has to carry it.
      --
      -- The consequence was a broken write-preview contract, which is the whole
      -- point of F2: the lifecycle counts, dominant tier and source list an
      -- operator APPROVED in the preview could differ from the ones actually
      -- PERSISTED, and a cluster whose only medium-tier sample was ineligible
      -- could satisfy the medium-tier requirement while appearing nowhere in the
      -- preview at all.
      --
      -- Safe to change now, and only now: the live catalog carries no
      -- site_aggregate_publications table and no Option C function (preflight
      -- P1/P2 both confirmed absent), so there are ZERO persisted rows whose
      -- source_sample_hash this could reclassify as drifted. The identical change
      -- after publication would silently re-drift every existing candidate and
      -- would need a migration plan.
      AND s.latitude  IS NOT NULL
      AND s.longitude IS NOT NULL
      AND s.latitude   <> 'NaN'::double precision
      AND s.longitude  <> 'NaN'::double precision
      AND s.latitude  BETWEEN  -90 AND  90
      AND s.longitude BETWEEN -180 AND 180
  ),
  agg_base AS (
    SELECT
      (SELECT round(cs_rep.latitude::numeric, 5)::double precision FROM cluster_samples cs_rep ORDER BY cs_rep.id ASC LIMIT 1) AS rep_lat,
      (SELECT round(cs_rep.longitude::numeric, 5)::double precision FROM cluster_samples cs_rep ORDER BY cs_rep.id ASC LIMIT 1) AS rep_lng,
      count(*)::integer AS total_cnt,
      count(*) FILTER (WHERE cs_main.coordinate_quality_tier = 'high')::integer AS high_cnt,
      count(*) FILTER (WHERE cs_main.coordinate_quality_tier = 'medium')::integer AS med_cnt,
      count(*) FILTER (WHERE cs_main.coordinate_quality_tier = 'low')::integer AS low_cnt,
      count(DISTINCT matrix_map.canonical_five_decimal_cluster(cs_main.latitude, cs_main.longitude))::integer AS dp_cnt,
      (
        SELECT sub.tier
        FROM (
          SELECT cs_tier.coordinate_quality_tier AS tier, count(*) as cnt
          FROM cluster_samples cs_tier
          GROUP BY cs_tier.coordinate_quality_tier
        ) sub
        ORDER BY sub.cnt DESC, CASE sub.tier WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END ASC, sub.tier COLLATE "C" ASC NULLS LAST
        LIMIT 1
      ) AS dom_tier,
      (
        SELECT string_agg(sub.src, '; ' ORDER BY sub.src COLLATE "C" ASC)
        FROM (
          SELECT DISTINCT cs_src.coordinate_source AS src
          FROM cluster_samples cs_src
          -- Plain `trim` ON PURPOSE, not blank_trim. `coordinate_source` is an
          -- INTERNAL provenance column, never member-facing, and this predicate
          -- feeds `source_sample_hash`. Widening the stripped set here would
          -- change which rows contribute and therefore change the hash, silently
          -- reclassifying existing publications as drifted. Out of scope for a
          -- text-meaningfulness fix; revisit only with a drift-migration plan.
          WHERE cs_src.coordinate_source IS NOT NULL AND length(trim(cs_src.coordinate_source)) > 0
        ) sub
      ) AS dom_source,
      (
        SELECT string_agg(
          jsonb_build_array(
            cs_hash.id::text,
            matrix_map.canonical_five_decimal_cluster(cs_hash.latitude, cs_hash.longitude),
            cs_hash.coordinate_quality_tier,
            cs_hash.coordinate_source
          )::text,
          E'\n' ORDER BY cs_hash.id ASC
        )
        FROM cluster_samples cs_hash
      ) AS member_hash_input
    FROM cluster_samples cs_main
  )
  SELECT
    rep_lat,
    rep_lng,
    total_cnt,
    high_cnt,
    med_cnt,
    low_cnt,
    dp_cnt,
    dom_tier,
    dom_source,
    md5(member_hash_input)
  FROM agg_base
  WHERE total_cnt > 0;
END;
$$;

ALTER FUNCTION matrix_map.current_site_aggregate_snapshot(uuid, text) OWNER TO matrix_map_owner;
REVOKE EXECUTE ON FUNCTION matrix_map.current_site_aggregate_snapshot(uuid, text) FROM PUBLIC, anon, authenticated, service_role;

-- REAPPLY-SAFETY CORRECTION (accepted P1, 2026-07-27 restack).
--
-- This was an unguarded bare CREATE FUNCTION -- the ONLY one of the fourteen
-- functions in this file not reapply-safe. On any reapply it raised
-- 'function "lock_site_aggregate_publication_sources" already exists with same
-- argument types' and aborted the entire script roughly 490 lines before the
-- candidate-audit invariant helper is invoked, so the legacy-upgrade path that
-- helper exists to provide was unreachable in production. No prior gate caught
-- it because the positive replay only ever applies this file ONCE against a
-- clean database; the full-script negative replay (NEG_01) is what exposed it.
--
-- The fix is DROP-then-CREATE, deliberately NOT `CREATE OR REPLACE`:
--
--   * This is a SECURITY DEFINER function owned by postgres. `CREATE OR REPLACE`
--     would let a later edit silently swap the body of a privileged definer
--     function; the bare CREATE keeps that failing loudly. A regression test
--     (site-aggregate-publication-migration.test.ts) pins that property with an
--     explicit negative assertion, and it is preserved here rather than removed.
--   * A guarded create-only-if-absent would have been reapply-safe too, but on
--     reapply it becomes a silent no-op that PRESERVES a stale privileged body.
--     Drop-then-create always installs exactly the definition below.
--   * RESTRICT is explicit and CASCADE is never used: if any real catalog
--     dependency on this function ever exists, the DROP must FAIL CLOSED rather
--     than silently removing dependent objects. PostgreSQL does not record a
--     dependency for one function's body merely CALLING another (bodies are
--     opaque strings), so flip_site_aggregate_public does not block this drop.
--   * This matches the idiom this same file already uses for its trigger and
--     all three policies (DROP ... IF EXISTS immediately followed by CREATE).
--
-- OBJECT IDENTITY NOTE: a successful reapply intentionally creates a NEW
-- function OID. REAPPLY_01 proves SEMANTIC equivalence (identical definition,
-- owner, comment, grants, and catalog fingerprint), NOT object-identity
-- equivalence. That is the accepted trade for never preserving a stale body.
--
-- Signature, body, SECURITY DEFINER, search_path, owner (postgres), COMMENT,
-- REVOKE and GRANT posture below are all preserved exactly as they were.
DROP FUNCTION IF EXISTS matrix_map.lock_site_aggregate_publication_sources() RESTRICT;

CREATE FUNCTION matrix_map.lock_site_aggregate_publication_sources()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = matrix_map, pg_temp
AS $$
BEGIN
  LOCK TABLE matrix_map.dras IN SHARE MODE NOWAIT;
  LOCK TABLE matrix_map.samples IN SHARE MODE NOWAIT;
END;
$$;

ALTER FUNCTION matrix_map.lock_site_aggregate_publication_sources() OWNER TO postgres;

COMMENT ON FUNCTION matrix_map.lock_site_aggregate_publication_sources() IS
  'Helper function for flip_site_aggregate_public to lock underlying DRA and sample tables '
  'in SHARE MODE prior to snapshot validation during aggregate publication. '
  'Must remain owned by postgres (the target Supabase migration/table owner). '
  'WARNING: Re-definable definer functions MUST NOT call this helper, or any authenticated user '
  'could take table SHARE locks and stall writes.';

REVOKE ALL ON FUNCTION matrix_map.lock_site_aggregate_publication_sources()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION matrix_map.lock_site_aggregate_publication_sources()
  TO matrix_map_owner;

-- OPTIMISTIC CONCURRENCY ON PUBLISH.
--
-- The admin UI shows an operator the persisted `member_display_label` and asks
-- them to approve it. Publishing previously identified the publication ONLY by
-- id, so if another admin refreshed that candidate between the page load and
-- the confirmation, this function published whatever label was CURRENT -- and
-- the first operator became the author of a member-visible string they never
-- saw. Showing the label is necessary but does not BIND the approval to it.
--
-- `updated_at` is the token: the table's own trigger already advances it on
-- every candidate refresh and every publication flip, so it is exactly "the
-- version the operator reviewed". The check happens AFTER `SELECT ... FOR
-- UPDATE`, so no concurrent writer can slip between the comparison and the
-- mutation.
--
-- The four-argument overload is DROPPED rather than left alongside: leaving it
-- installed would let any authenticated caller reach the unguarded path
-- directly through PostgREST and bypass the contract entirely.
DROP FUNCTION IF EXISTS matrix_map.flip_site_aggregate_public(uuid, boolean, uuid, text) RESTRICT;
DROP FUNCTION IF EXISTS matrix_map.flip_site_aggregate_public(uuid, boolean, uuid, text, timestamptz) RESTRICT;

CREATE FUNCTION matrix_map.flip_site_aggregate_public(
  p_publication_id uuid,
  p_new_value boolean,
  p_actor_id uuid,
  p_reason text,
  p_expected_updated_at timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = matrix_map, public, pg_temp
AS $$
DECLARE
  v_uid uuid;
  v_claims jsonb;
  v_actor_email text;
  v_is_authorized boolean;
  v_row matrix_map.site_aggregate_publications%ROWTYPE;
  v_dra_exists boolean;
BEGIN
  v_uid := matrix_map.current_user_id();
  v_claims := matrix_map.jwt_claims();

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'flip_site_aggregate_public must be called from an authenticated user context'
      USING ERRCODE = '42501';
  END IF;

  IF v_uid <> p_actor_id THEN
    RAISE EXCEPTION 'flip_site_aggregate_public actor_id (%) must match caller jwt sub (%)', p_actor_id, v_uid
      USING ERRCODE = '42501';
  END IF;

  IF p_new_value = true AND lower(current_setting('transaction_isolation')) IS DISTINCT FROM 'read committed' THEN
    RAISE EXCEPTION 'flip_site_aggregate_public requires read committed transaction isolation when publishing'
      USING ERRCODE = 'UE500';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_uid
      AND role IN ('admin', 'matrix_admin')
  )
  INTO v_is_authorized;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'flip_site_aggregate_public requires admin or matrix_admin role'
      USING ERRCODE = '42501';
  END IF;

  IF p_reason IS NULL OR length(matrix_map.blank_trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'flip_site_aggregate_public requires a non-empty reason'
      USING ERRCODE = 'UE422';
  END IF;

  v_actor_email := v_claims ->> 'email';
  IF v_actor_email IS NULL OR length(matrix_map.blank_trim(v_actor_email)) = 0 THEN
    RAISE EXCEPTION 'flip_site_aggregate_public could not resolve actor email from JWT for sub %', v_uid
      USING ERRCODE = '42501';
  END IF;

  SELECT *
  INTO v_row
  FROM matrix_map.site_aggregate_publications
  WHERE id = p_publication_id
  FOR UPDATE;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'site aggregate publication % not found', p_publication_id
      USING ERRCODE = 'UE404';
  END IF;

  IF length(matrix_map.blank_trim(v_row.member_display_label)) = 0 THEN
    RAISE EXCEPTION 'site aggregate publication % requires a neutral member display label', p_publication_id
      USING ERRCODE = 'UE422';
  END IF;

  -- REVIEWED-VERSION GATE. Placed after FOR UPDATE and before every mutation
  -- below, so the row cannot change between the comparison and the write.
  --
  -- Asymmetric ON PURPOSE, and the asymmetry is the established
  -- visibility-reducing boundary rather than an oversight:
  --   PUBLISH increases member visibility, so it REQUIRES a token and must
  --   match exactly. A missing token is a caller that predates this contract
  --   and must fail rather than publish something unreviewed.
  --   UNPUBLISH only REMOVES member visibility. It is the emergency retraction
  --   path and must stay reachable even when the caller's view is stale, so a
  --   null or mismatched token is tolerated there.
  IF p_new_value = true THEN
    IF p_expected_updated_at IS NULL THEN
      RAISE EXCEPTION
        'flip_site_aggregate_public requires p_expected_updated_at when publishing publication %',
        p_publication_id
        USING ERRCODE = 'UE409';
    END IF;

    IF v_row.updated_at IS DISTINCT FROM p_expected_updated_at THEN
      RAISE EXCEPTION
        'site aggregate publication % changed since it was reviewed (expected %, found %); re-read and review the current candidate before publishing',
        p_publication_id, p_expected_updated_at, v_row.updated_at
        USING ERRCODE = 'UE409';
    END IF;
  END IF;

  IF v_row.is_published IS DISTINCT FROM p_new_value THEN
    IF p_new_value = true THEN
      PERFORM matrix_map.lock_site_aggregate_publication_sources();

      SELECT EXISTS (
        SELECT 1 FROM matrix_map.dras d
        WHERE d.id = v_row.source_dra_id
          AND d.is_deleted = false
      )
      INTO v_dra_exists;

      IF NOT v_dra_exists THEN
        RAISE EXCEPTION 'site aggregate publication % references a missing or soft-deleted DRA', p_publication_id
          USING ERRCODE = 'UE409';
      END IF;

      DECLARE
        v_snap RECORD;
      BEGIN
        SELECT * INTO v_snap
        FROM matrix_map.current_site_aggregate_snapshot(v_row.source_dra_id, v_row.coordinate_cluster_id);

        IF v_snap IS NULL OR v_snap.sample_count_total IS NULL OR v_snap.sample_count_total = 0 THEN
          RAISE EXCEPTION 'site aggregate publication % current snapshot is empty', p_publication_id
            USING ERRCODE = 'UE409';
        END IF;

        IF v_snap.sample_count_medium = 0 THEN
          RAISE EXCEPTION 'site aggregate publication % requires at least one medium-tier sample', p_publication_id
            USING ERRCODE = 'UE422';
        END IF;

        IF v_snap.representative_latitude IS DISTINCT FROM v_row.representative_latitude
           OR v_snap.representative_longitude IS DISTINCT FROM v_row.representative_longitude
           OR v_snap.sample_count_total IS DISTINCT FROM v_row.sample_count_total
           OR v_snap.sample_count_high IS DISTINCT FROM v_row.sample_count_high
           OR v_snap.sample_count_medium IS DISTINCT FROM v_row.sample_count_medium
           OR v_snap.sample_count_low IS DISTINCT FROM v_row.sample_count_low
           OR v_snap.distinct_point_count IS DISTINCT FROM v_row.distinct_point_count
           OR v_snap.coordinate_quality_tier IS DISTINCT FROM v_row.coordinate_quality_tier
           OR v_snap.coordinate_source IS DISTINCT FROM v_row.coordinate_source
           OR v_snap.source_sample_hash IS DISTINCT FROM v_row.source_sample_hash THEN
          RAISE EXCEPTION 'site aggregate publication % snapshot drift detected', p_publication_id
            USING ERRCODE = 'UE409';
        END IF;
      END;
    END IF;

    PERFORM set_config('matrix_map.audited_site_aggregate_publication', '1', true);

    UPDATE matrix_map.site_aggregate_publications
    SET
      is_published = p_new_value,
      published_at = CASE WHEN p_new_value THEN clock_timestamp() ELSE published_at END,
      published_by = CASE WHEN p_new_value THEN v_uid ELSE published_by END,
      publish_reason = CASE WHEN p_new_value THEN matrix_map.blank_trim(p_reason) ELSE publish_reason END,
      unpublished_at = CASE WHEN p_new_value THEN unpublished_at ELSE clock_timestamp() END,
      unpublished_by = CASE WHEN p_new_value THEN unpublished_by ELSE v_uid END,
      unpublish_reason = CASE WHEN p_new_value THEN unpublish_reason ELSE matrix_map.blank_trim(p_reason) END,
      updated_at = clock_timestamp()
    WHERE id = p_publication_id;

    PERFORM set_config('matrix_map.audited_site_aggregate_publication', '0', true);

    INSERT INTO matrix_map.site_aggregate_publication_audit
      (
        publication_id,
        source_dra_id,
        coordinate_cluster_id,
        prior_value,
        new_value,
        changed_at,
        changed_by,
        changed_by_email,
        reason,
        prior_snapshot,
        new_snapshot
      )
    SELECT
      p_publication_id,
      v_row.source_dra_id,
      v_row.coordinate_cluster_id,
      v_row.is_published,
      p_new_value,
      clock_timestamp(),
      v_uid,
      v_actor_email,
      matrix_map.blank_trim(p_reason),
      to_jsonb(v_row),
      to_jsonb(sap)
    FROM matrix_map.site_aggregate_publications sap
    WHERE sap.id = p_publication_id;
  END IF;
END;
$$;

ALTER FUNCTION matrix_map.flip_site_aggregate_public(uuid, boolean, uuid, text, timestamptz)
  OWNER TO matrix_map_owner;

REVOKE EXECUTE ON FUNCTION matrix_map.flip_site_aggregate_public(uuid, boolean, uuid, text, timestamptz)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION matrix_map.flip_site_aggregate_public(uuid, boolean, uuid, text, timestamptz)
  TO authenticated;

ALTER TABLE matrix_map.site_aggregate_publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE matrix_map.site_aggregate_publications FORCE ROW LEVEL SECURITY;
ALTER TABLE matrix_map.site_aggregate_publication_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE matrix_map.site_aggregate_publication_audit FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS site_aggregate_publications_no_direct_select
  ON matrix_map.site_aggregate_publications;
CREATE POLICY site_aggregate_publications_no_direct_select
  ON matrix_map.site_aggregate_publications
  FOR SELECT
  TO authenticated
  USING (false);

COMMENT ON POLICY site_aggregate_publications_no_direct_select
  ON matrix_map.site_aggregate_publications IS
  'No direct member/admin table reads. Members use fetch_published_site_aggregates() for safe '
  'bucketed payloads; admins use fetch_admin_site_aggregate_publications() for exact provenance.';

DROP POLICY IF EXISTS site_aggregate_publication_audit_no_direct_select
  ON matrix_map.site_aggregate_publication_audit;
CREATE POLICY site_aggregate_publication_audit_no_direct_select
  ON matrix_map.site_aggregate_publication_audit
  FOR SELECT
  TO authenticated
  USING (false);

COMMENT ON POLICY site_aggregate_publication_audit_no_direct_select
  ON matrix_map.site_aggregate_publication_audit IS
  'No direct audit table reads. Admins use fetch_site_aggregate_publication_audit().';

REVOKE ALL ON matrix_map.site_aggregate_publications
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON matrix_map.site_aggregate_publication_audit
  FROM PUBLIC, anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE ON matrix_map.site_aggregate_publications TO matrix_map_owner;
GRANT SELECT, INSERT ON matrix_map.site_aggregate_publication_audit TO matrix_map_owner;

CREATE TABLE IF NOT EXISTS matrix_map.site_aggregate_candidate_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- FIX 9 (accepted review finding): publication_id is NOT NULL with a FOREIGN
  -- KEY ON DELETE RESTRICT to site_aggregate_publications(id). Investigated
  -- first: neither the workplan (OPTION_C_CANDIDATE_LIFECYCLE_WORKPLAN_2026_07_25.md)
  -- nor this draft SQL expresses any intent for candidate audit rows to
  -- survive deletion of their publication -- there is in fact no DELETE path
  -- for matrix_map.site_aggregate_publications anywhere in this draft (rows
  -- are only ever created/updated via upsert_site_aggregate_candidate and
  -- flip_site_aggregate_public; nothing deletes them). The sibling table
  -- site_aggregate_publication_audit already uses this exact NOT NULL + FK
  -- ON DELETE RESTRICT pattern against the same parent table (see above), so
  -- this brings the candidate audit table into line with its sibling rather
  -- than inventing a new retention model. RESTRICT has no observable effect
  -- today (nothing deletes publications) but guards against a future
  -- accidental delete silently orphaning or losing audit history.
  publication_id uuid NOT NULL REFERENCES matrix_map.site_aggregate_publications(id) ON DELETE RESTRICT,
  source_dra_id uuid NOT NULL,
  coordinate_cluster_id text NOT NULL,
  action text NOT NULL CHECK (action IN ('create', 'refresh')),
  prior_snapshot jsonb,
  new_snapshot jsonb NOT NULL,
  reason text NOT NULL,
  changed_by uuid NOT NULL,
  changed_by_email text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE matrix_map.site_aggregate_candidate_audit IS
  'Audit log for Option C candidate creation and refresh. Written only by matrix_map.upsert_site_aggregate_candidate(...).';

CREATE INDEX IF NOT EXISTS site_aggregate_candidate_audit_publication_idx
  ON matrix_map.site_aggregate_candidate_audit (publication_id, changed_at DESC);

ALTER TABLE matrix_map.site_aggregate_candidate_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE matrix_map.site_aggregate_candidate_audit FORCE ROW LEVEL SECURITY;

-- REAPPLY-SAFETY CORRECTION (accepted P1, 2026-07-27 restack).
--
-- This CREATE POLICY had no preceding DROP, unlike its two siblings above
-- (site_aggregate_publications_no_direct_select and
-- site_aggregate_publication_audit_no_direct_select), so a reapply raised
-- 'policy ... already exists' and aborted the script. Dropping first and
-- recreating also guarantees the policy that ends up installed is the exact
-- fail-closed definition below -- a stale or hand-edited USING clause is
-- replaced rather than silently preserved.
DROP POLICY IF EXISTS site_aggregate_candidate_audit_no_direct_select
  ON matrix_map.site_aggregate_candidate_audit;
CREATE POLICY site_aggregate_candidate_audit_no_direct_select
  ON matrix_map.site_aggregate_candidate_audit
  FOR SELECT TO authenticated USING (false);

REVOKE ALL ON matrix_map.site_aggregate_candidate_audit FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON matrix_map.site_aggregate_candidate_audit TO matrix_map_owner;

-- ---------------------------------------------------------------------------
-- SECOND REVIEW ROUND CORRECTION R2-FIX-1 (accepted P1, 2026-07-27 restack).
-- The CREATE TABLE IF NOT EXISTS above is a no-op if a prior draft already
-- created matrix_map.site_aggregate_candidate_audit with a NULLABLE,
-- unconstrained publication_id: the NOT NULL + FK ON DELETE RESTRICT declared
-- in that CREATE TABLE (see the FIX 9 comment above it) never lands on such a
-- table. (The pre-apply runbook no longer grants generic permission to reapply
-- over an existing install -- that now requires a case-specific adjudication --
-- but the upgrade must still be CORRECT whenever such an adjudication
-- authorizes it.) TEST_22 only ever exercises a clean replay
-- (table created fresh with the invariant already declared), so it cannot
-- catch this. This block adds an idempotent, DATA-PREFLIGHTED upgrade that
-- runs on every apply and brings any pre-existing legacy-shaped table up to
-- the current invariant.
--
-- Implemented as a reusable function (parameterized by schema/table) rather
-- than an inline anonymous DO block so the test suite can invoke the EXACT
-- SAME code against a simulated legacy-shaped scratch table (see
-- test-option-c.sql TEST_23) -- proving the upgrade path itself works, not
-- merely that a fresh CREATE TABLE happens to already satisfy the invariant.
--
-- Scope note: this repairs the two documented legacy shapes (nullable
-- column; FK constraint absent). It does not attempt to repair an
-- already-present FK constraint on this column that points somewhere wrong
-- (e.g. a different column) -- no such state has ever been produced by any
-- version of this migration, so it is out of scope for this reapply fix.
-- ---------------------------------------------------------------------------
--
-- THIRD REVIEW ROUND CORRECTIONS (accepted P1/P2, 2026-07-27 restack).
--
-- FIX 1 [P1] -- composite-FK positional blind spot. Both the conforming-FK
-- probe and the incompatible-FK probe previously joined pg_attribute using
-- con.conkey[1] only. If publication_id is the SECOND or later column of a
-- COMPOSITE foreign key, that constraint was invisible to both probes: a
-- malformed table carrying the required single-column RESTRICT FK plus a
-- composite FK involving publication_id was reported clean. Fixed by
-- resolving publication_id's attnum ONCE (in the same query that already
-- reads attnotnull), then testing MEMBERSHIP in the whole con.conkey array
-- (v_pub_attnum = ANY(con.conkey)) everywhere a foreign key on this column is
-- located. The conforming-FK probe additionally still requires single-column
-- arity on both sides (array_length(conkey,1)=1 AND array_length(confkey,1)=1)
-- so a composite FK can never satisfy it even when it happens to reference
-- the right table.
--
-- FIX 2 [P2] -- the fail-closed scan was skipped once a conforming FK was
-- found. Previously: if a conforming FK was found, the whole incompatible-FK
-- scan was skipped and the function returned success -- so a table with the
-- required RESTRICT FK PLUS another (e.g. composite) FK on publication_id
-- passed at apply time. This was also inconsistent with the preflight (3.3c
-- in the runbook), which already requires total_fks_on_publication_id = 1 --
-- apply must not be laxer than preflight. Fixed by restructuring so the
-- function ALWAYS enumerates every foreign key involving publication_id
-- (v_fk_count, via the same membership test) and requires EXACTLY ONE that
-- matches the exact spec (v_conforming_count = 1 as well). Any count other
-- than "exactly one FK, and it is the conforming one" -> RAISE UE409 naming
-- one offending constraint; it is never dropped or repaired automatically. A
-- legitimate clean or already-conforming table (v_fk_count = 1 AND
-- v_conforming_count = 1, or v_fk_count = 0 and one gets added) still
-- proceeds without error.
--
-- FOURTH REVIEW ROUND CORRECTION (accepted P1, 2026-07-27 restack).
--
-- FIX 4 [P1] -- a NOT VALID foreign key satisfied the conforming-FK predicate.
-- The predicate below pinned referenced table/column, delete action, and
-- single-column arity on both sides, but never con.convalidated. PostgreSQL
-- enforces a NOT VALID foreign key for NEW rows only: rows already present
-- when the constraint was added are never checked. So a table carrying a
-- conforming-LOOKING but NOT VALID constraint was counted as conforming and
-- the function returned success, while historical audit rows could still
-- reference publications that do not exist -- exactly the integrity the
-- invariant is supposed to guarantee. Fixed by requiring con.convalidated in
-- the conforming count. A NOT VALID constraint now yields v_fk_count = 1 with
-- v_conforming_count = 0 and falls through to the SAME fail-closed branch:
-- UE409 naming the constraint. It is NOT dropped, NOT validated, NOT renamed,
-- and NOT repaired -- validating it could fail on pre-existing rows or mask a
-- real integrity breach, so that decision belongs to a human.
--
-- This is now the SOLE implementation of this invariant. The pre-apply
-- runbook's preflight no longer carries a second hand-maintained copy of the
-- rule (its section 3.3c was removed in the same change); the preflight
-- classifies OBJECT and SIGNATURE presence only, and this transactionally
-- atomic block is the single authority for upgrade and compatibility.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION matrix_map.apply_candidate_audit_publication_id_invariant(
  p_schema text,
  p_table text
)
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, pg_temp
AS $$
DECLARE
  v_col_not_null boolean;
  v_pub_attnum smallint;
  v_null_count bigint;
  v_fk_count integer;
  v_conforming_count integer;
  v_fk_name text;
BEGIN
  -- FIX 1: resolve publication_id's attnum ONCE here (alongside attnotnull,
  -- which this query already read), so every foreign-key probe below can test
  -- membership in con.conkey rather than assuming position 1.
  SELECT a.attnotnull, a.attnum INTO v_col_not_null, v_pub_attnum
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = p_schema AND c.relname = p_table
    AND a.attname = 'publication_id' AND a.attnum > 0 AND NOT a.attisdropped;

  IF v_col_not_null IS NULL THEN
    RAISE EXCEPTION 'apply_candidate_audit_publication_id_invariant: publication_id column not found on %.%', p_schema, p_table;
  END IF;

  IF v_col_not_null IS FALSE THEN
    -- Data preflight: never silently drop rows to force the invariant.
    EXECUTE format('SELECT count(*) FROM %I.%I WHERE publication_id IS NULL', p_schema, p_table)
      INTO v_null_count;

    IF v_null_count > 0 THEN
      RAISE EXCEPTION
        '%.% has % row(s) with a NULL publication_id; refusing to apply the NOT NULL upgrade because that would risk silent data loss. Resolve these rows (backfill or remove). Resolving them does not by itself authorize a reapply: on an existing installation, re-run the case-specific adjudication in the pre-apply runbook first.',
        p_schema, p_table, v_null_count
        USING ERRCODE = 'UE409';
    END IF;

    EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN publication_id SET NOT NULL', p_schema, p_table);
  END IF;

  -- FIX 2: ALWAYS enumerate every foreign key involving publication_id (any
  -- key position, via membership -- FIX 1), rather than short-circuiting the
  -- moment any single conforming FK is found.
  SELECT count(*) INTO v_fk_count
  FROM pg_constraint con
  JOIN pg_class c ON c.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = p_schema
    AND c.relname = p_table
    AND con.contype = 'f'
    AND v_pub_attnum = ANY(con.conkey);

  IF v_fk_count = 0 THEN
    -- No foreign key at all yet on this column: safe to add ours.
    v_fk_name := p_table || '_publication_id_fkey';
    BEGIN
      EXECUTE format(
        'ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (publication_id) REFERENCES matrix_map.site_aggregate_publications(id) ON DELETE RESTRICT',
        p_schema, p_table, v_fk_name
      );
    EXCEPTION WHEN duplicate_object THEN
      -- Reached only if a constraint with THIS NAME exists that is not itself
      -- a foreign key on publication_id (the count(*) above would otherwise
      -- have found it) -- i.e. a same-named non-FK constraint, or a race.
      -- Either way the invariant is NOT proven, so fail closed rather than
      -- reporting a success we cannot substantiate.
      RAISE EXCEPTION
        'Could not add the publication_id foreign key to %.%: a constraint named % already exists but is not a foreign key on publication_id. Refusing to report success without the invariant. Resolve manually. Resolving this one constraint does not establish that the rest of the live schema is compatible: on an existing installation, re-run the case-specific adjudication in the pre-apply runbook before any reapply.',
        p_schema, p_table, v_fk_name
        USING ERRCODE = 'UE409';
    END;

    RETURN;
  END IF;

  -- One or more foreign keys already involve publication_id. The invariant
  -- requires EXACTLY ONE, and it must match the full spec: referenced
  -- matrix_map.site_aggregate_publications(id), ON DELETE RESTRICT,
  -- single-column arity on BOTH sides -- a composite FK can never satisfy
  -- this (FIX 1), even one that happens to involve the right referenced
  -- table -- and VALIDATED (FIX 4): a NOT VALID constraint is enforced for
  -- new rows only, so it does not establish the invariant over rows that
  -- already exist.
  SELECT count(*) INTO v_conforming_count
  FROM pg_constraint con
  JOIN pg_class c ON c.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_class fc ON fc.oid = con.confrelid
  JOIN pg_namespace fn ON fn.oid = fc.relnamespace
  JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = con.conkey[1]
  JOIN pg_attribute fa ON fa.attrelid = con.confrelid AND fa.attnum = con.confkey[1]
  WHERE n.nspname = p_schema
    AND c.relname = p_table
    AND con.contype = 'f'
    AND v_pub_attnum = ANY(con.conkey)
    AND fn.nspname = 'matrix_map'
    AND fc.relname = 'site_aggregate_publications'
    AND con.confdeltype = 'r'
    AND array_length(con.conkey, 1) = 1
    AND array_length(con.confkey, 1) = 1
    AND a.attname = 'publication_id'
    AND fa.attname = 'id'
    -- FIX 4: a NOT VALID constraint never checked the rows that already
    -- existed when it was added, so it does not establish this invariant.
    AND con.convalidated;

  IF v_fk_count = 1 AND v_conforming_count = 1 THEN
    -- Exactly one foreign key on this column, and it is the conforming one:
    -- legitimate clean or already-conforming table. Proceed without error.
    RETURN;
  END IF;

  -- FAIL CLOSED: either more than one foreign key involves publication_id, or
  -- the single one present does not match the exact spec (e.g. ON DELETE
  -- CASCADE, wrong target, composite, or NOT VALID). No case is repaired,
  -- dropped, or validated opportunistically -- that belongs to a human with
  -- the context to authorise it.
  SELECT con.conname INTO v_fk_name
  FROM pg_constraint con
  JOIN pg_class c ON c.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = p_schema
    AND c.relname = p_table
    AND con.contype = 'f'
    AND v_pub_attnum = ANY(con.conkey)
  ORDER BY con.conname
  LIMIT 1;

  RAISE EXCEPTION
    '%.% has % existing foreign key(s) involving publication_id (e.g. %) that do not resolve to exactly one conforming foreign key (REFERENCES matrix_map.site_aggregate_publications(id) ON DELETE RESTRICT, single-column both sides, and VALIDATED). A NOT VALID constraint does not qualify: it is enforced for new rows only, so rows that already existed were never checked and may reference a nonexistent publication. Refusing to add, drop, validate, or repair automatically. Inspect and resolve manually. Resolving this one constraint does not establish that the rest of the live schema is compatible: on an existing installation, re-run the case-specific adjudication in the pre-apply runbook before any reapply.',
    p_schema, p_table, v_fk_count, v_fk_name
    USING ERRCODE = 'UE409';
END;
$$;

ALTER FUNCTION matrix_map.apply_candidate_audit_publication_id_invariant(text, text) OWNER TO matrix_map_owner;
REVOKE ALL ON FUNCTION matrix_map.apply_candidate_audit_publication_id_invariant(text, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION matrix_map.apply_candidate_audit_publication_id_invariant(text, text)
  TO matrix_map_owner;

-- Apply the invariant to the real table on every migration run. Idempotent:
-- a no-op when the table already conforms (including on a fresh CREATE TABLE
-- in this same run).
SELECT matrix_map.apply_candidate_audit_publication_id_invariant('matrix_map', 'site_aggregate_candidate_audit');

-- RETURN CONTRACT CHANGE (2026-07-28): this function now RETURNS uuid -- the
-- persisted publication id -- so a caller can verify its own committed write by
-- EXACT ID instead of scanning the paged candidate collection. A paged scan is
-- not a snapshot across independent statements (see the fetch RPC's comment),
-- so under a concurrent refresh it could report verification_failed for a row
-- that was in fact committed.
--
-- PostgreSQL cannot CREATE OR REPLACE a function whose return type changed, so
-- this is a reapply-safe DROP followed by a plain CREATE. RESTRICT is
-- deliberate, not IF EXISTS ... CASCADE: nothing else in this schema depends on
-- this function (it is invoked only by the API route; the two references
-- elsewhere in this file are comments), so RESTRICT will FAIL LOUDLY if a future
-- dependency is added rather than silently dropping it.
-- F2 IDENTITY-AUTHORITY CHANGE (2026-07-29): the caller no longer supplies the
-- cluster key as the thing this function trusts. It supplies a representative
-- COORDINATE PAIR plus the key it BELIEVES that pair renders to, and this
-- function derives the key itself, BEFORE any sample selection, and compares.
--
-- Why the pair and not the key. The previous contract took p_coordinate_cluster_id
-- and passed it straight to current_site_aggregate_snapshot, which selects samples
-- WHERE canonical_five_decimal_cluster(latitude, longitude) = p_cluster_id (:1133-1134).
-- Re-deriving a key from rows that were filtered BY that key necessarily reproduces
-- it, so a "derive and compare" placed after selection could never fail. The
-- coordinate pair is the INDEPENDENT locator: it is derived from, not filtered by,
-- the identity under test.
--
-- BOTH signatures are dropped. Leaving the 5-argument form installed would let
-- PostgREST resolve a call to the old, unvalidated function and silently restore
-- the defect, and an overload pair would make resolution ambiguous -- the same
-- reasoning already applied to fetch_admin_site_aggregate_publications at :508-514.
DROP FUNCTION IF EXISTS matrix_map.upsert_site_aggregate_candidate(uuid, text, text, uuid, text) RESTRICT;
DROP FUNCTION IF EXISTS matrix_map.upsert_site_aggregate_candidate(uuid, text, double precision, double precision, text, uuid, text) RESTRICT;

CREATE FUNCTION matrix_map.upsert_site_aggregate_candidate(
  p_source_dra_id uuid,
  p_expected_cluster_id text,
  p_representative_latitude double precision,
  p_representative_longitude double precision,
  p_member_display_label text,
  p_actor_id uuid,
  p_reason text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = matrix_map, public, pg_temp
AS $$
DECLARE
  v_uid uuid;
  -- The authoritative key. Derived here from the representative pair and used for
  -- EVERY downstream operation; p_expected_cluster_id is only ever compared, never
  -- used to locate, lock, select, insert or audit.
  v_derived_cluster text;
  v_claims jsonb;
  v_actor_email text;
  v_is_authorized boolean;
  v_existing_id uuid;
  v_is_published boolean;
  v_prior_snapshot jsonb;
  v_snap RECORD;
  v_action text;
  v_normalized_dra_id text;
  v_normalized_label text;
  v_persisted_row matrix_map.site_aggregate_publications%ROWTYPE;
BEGIN
  v_uid := matrix_map.current_user_id();
  v_claims := matrix_map.jwt_claims();

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'upsert_site_aggregate_candidate must be called from an authenticated user context' USING ERRCODE = '42501';
  END IF;

  IF v_uid <> p_actor_id THEN
    RAISE EXCEPTION 'upsert_site_aggregate_candidate actor_id (%) must match caller jwt sub (%)', p_actor_id, v_uid USING ERRCODE = '42501';
  END IF;

  IF lower(current_setting('transaction_isolation')) IS DISTINCT FROM 'read committed' THEN
    RAISE EXCEPTION 'upsert_site_aggregate_candidate requires read committed transaction isolation' USING ERRCODE = 'UE500';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_uid AND role IN ('admin', 'matrix_admin')
  ) INTO v_is_authorized;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'upsert_site_aggregate_candidate requires admin or matrix_admin role' USING ERRCODE = '42501';
  END IF;

  IF p_member_display_label IS NULL OR length(matrix_map.blank_trim(p_member_display_label)) = 0 THEN
    RAISE EXCEPTION 'upsert_site_aggregate_candidate requires a non-empty member_display_label' USING ERRCODE = 'UE422';
  END IF;

  -- DEFENSE IN DEPTH, NOT ROUTE-ONLY. `member_display_label` is stored and served to
  -- members verbatim. The API route rejects a label carrying the raw source_dra_id, but
  -- this RPC is GRANTed EXECUTE to `authenticated`, so any admin can call it directly
  -- (e.g. via the Supabase client library or REST) and bypass the route entirely. The
  -- guard must therefore live here too, before any write, so raw DRA provenance can never
  -- reach a published member label regardless of caller. Message stays free of the actual
  -- id value.
  --
  -- FIX 5 (accepted review finding): the prior guard only rejected the CANONICAL
  -- hyphenated rendering of p_source_dra_id. A caller can trivially embed the same
  -- uuid as a COMPACT (hyphens stripped), MIXED-CASE, or BRACE-WRAPPED ({...})
  -- rendering and slip past it. Normalize BOTH sides -- lowercase, then strip
  -- hyphens and braces -- down to the bare 32-hex-char form, and reject only when
  -- the normalized label CONTAINS that full 32-char run. This deliberately does
  -- NOT reject a label that merely shares a few hex characters with the id; the
  -- complete 32-character sequence must be present, so innocuous labels are safe.
  -- FIX 6 (accepted holistic finding): the prior normalization removed only
  -- hyphens and braces, and `blank_trim` is `btrim`, which strips characters
  -- from the ENDS only. An INTERIOR invisible character therefore survived: a
  -- label carrying the uuid interleaved with U+200B, U+200C, U+200D or U+FEFF
  -- failed this containment test while still RENDERING to members as the raw
  -- identifier -- defeating the very no-leak contract this guard exists to
  -- enforce.
  --
  -- Widening `blank_trim` was rejected as the fix. That set DELIBERATELY excludes
  -- U+200C ZWNJ and U+200D ZWJ because they are meaningful in legitimate
  -- persisted text and stripping them would corrupt real writing. This
  -- comparison value is a TEMPORARY normalized copy that is never stored, so it
  -- carries no such constraint and can canonicalize far more aggressively.
  --
  -- Canonical form: lowercase, then discard everything that is not an ASCII
  -- hexadecimal character. A uuid reduces to its bare 32-character hex run
  -- regardless of hyphens, braces, whitespace, zero-width characters or any
  -- other separator an attacker interleaves. The STORED label is untouched.
  --
  -- The sixteen characters are ENUMERATED, not written as the ranges `0-9a-f`.
  -- A review argued that PostgreSQL bracket RANGES are defined by the active
  -- collating sequence, so a non-ASCII character could fall inside [a-f],
  -- survive normalization, break the contiguous hex run and let an interleaved
  -- uuid evade position(). That was MEASURED on the target platform rather than
  -- argued -- PostgreSQL 17.10, database collation en_US.utf8, and again under
  -- explicit COLLATE "C" and COLLATE "en-US-x-icu" -- and did NOT reproduce: the
  -- range and enumerated forms were identical for a-acute, e-acute, a-ring,
  -- c-cedilla, sharp-s, Cyrillic a, fullwidth a, U+200B and U+200C. The
  -- enumeration is kept anyway. It costs nothing, and it removes reliance on an
  -- engine detail the PostgreSQL documentation does describe as
  -- collation-sensitive in principle.
  v_normalized_dra_id := regexp_replace(lower(p_source_dra_id::text), '[^0123456789abcdef]', '', 'g');
  v_normalized_label := regexp_replace(lower(matrix_map.blank_trim(p_member_display_label)), '[^0123456789abcdef]', '', 'g');

  IF position(v_normalized_dra_id IN v_normalized_label) > 0 THEN
    RAISE EXCEPTION 'upsert_site_aggregate_candidate member_display_label must not contain the source DRA identifier' USING ERRCODE = 'UE422';
  END IF;

  IF p_reason IS NULL OR length(matrix_map.blank_trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'upsert_site_aggregate_candidate requires a non-empty reason' USING ERRCODE = 'UE422';
  END IF;

  v_actor_email := v_claims ->> 'email';
  IF v_actor_email IS NULL OR length(matrix_map.blank_trim(v_actor_email)) = 0 THEN
    RAISE EXCEPTION 'upsert_site_aggregate_candidate could not resolve actor email from JWT' USING ERRCODE = '42501';
  END IF;

  -- F2 STEP 3 -- ELIGIBILITY. Validate the representative pair against the SAME
  -- predicate fetch_admin_site_aggregate_live_preview applies to its base
  -- population. The locator must be a coordinate this schema could itself have
  -- produced, and an ineligible pair is a caller defect rejected BEFORE any
  -- derivation, so no invalid value ever reaches the identity function.
  --
  -- NaN needs its own test: PostgreSQL defines NaN = NaN as TRUE for floats, so
  -- the usual `x = x` idiom does NOT detect it. The range bounds are expected to
  -- exclude NaN and both infinities unaided (PostgreSQL orders NaN above all
  -- non-NaN values); the explicit NaN tests are belt-and-braces and cost nothing.
  -- Both behaviours are pinned by executed tests rather than assumed.
  --
  -- No message below echoes a coordinate or a key (D-F2-6).
  IF p_representative_latitude IS NULL OR p_representative_longitude IS NULL THEN
    RAISE EXCEPTION 'upsert_site_aggregate_candidate requires a non-null representative coordinate pair' USING ERRCODE = 'UE422';
  END IF;

  IF p_representative_latitude = 'NaN'::double precision
     OR p_representative_longitude = 'NaN'::double precision THEN
    RAISE EXCEPTION 'upsert_site_aggregate_candidate representative coordinate pair must not be NaN' USING ERRCODE = 'UE422';
  END IF;

  IF p_representative_latitude NOT BETWEEN -90 AND 90
     OR p_representative_longitude NOT BETWEEN -180 AND 180 THEN
    RAISE EXCEPTION 'upsert_site_aggregate_candidate representative coordinate pair is outside the valid coordinate range' USING ERRCODE = 'UE422';
  END IF;

  -- F2 STEP 4 -- DERIVE, before any sample selection. This is the whole point of
  -- the contract: the coordinate pair is an INDEPENDENT locator, so the key this
  -- produces is not a restatement of anything the caller asserted.
  v_derived_cluster := matrix_map.canonical_five_decimal_cluster(
    p_representative_latitude,
    p_representative_longitude
  );

  -- F2 STEP 5 -- COMPARE. PRE-COMMIT, and deliberately ahead of the advisory lock
  -- and the FOR UPDATE lookup, so a mismatch writes nothing at all: no candidate
  -- row, no audit row, and no lock contention with a concurrent legitimate caller.
  -- IS DISTINCT FROM, not <>, so a NULL assertion is a mismatch rather than NULL.
  IF v_derived_cluster IS DISTINCT FROM p_expected_cluster_id THEN
    RAISE EXCEPTION 'upsert_site_aggregate_candidate cluster identity mismatch: the supplied representative coordinate pair does not render to the asserted cluster id' USING ERRCODE = 'UE412';
  END IF;

  -- FIX 2 (accepted review finding): serialize concurrent first-create races on
  -- the natural key BEFORE classifying create vs refresh. Without this, two
  -- concurrent callers for the SAME (source_dra_id, coordinate_cluster_id) that
  -- has never had a row can both see "not found" below and both classify
  -- v_action := 'create' -- only one INSERT actually wins; the other silently
  -- becomes a real refresh via ON CONFLICT DO UPDATE, so the loser would audit
  -- a 'create' with a null prior_snapshot for what was actually a refresh.
  -- Classifying from the RETURNING row's xmax (xmax = 0 => freshly inserted)
  -- would fix the create/refresh LABEL but not the prior_snapshot capture: this
  -- session's own pre-insert SELECT ... FOR UPDATE below could still race and
  -- see nothing even though a real update is what happens. Serializing the
  -- ENTIRE read-then-write sequence on the natural key with a transaction-scoped
  -- advisory lock fixes both at once: a second caller blocks here until the
  -- first caller's transaction ends, so by the time it proceeds, its own
  -- SELECT ... FOR UPDATE below correctly observes the just-committed row for
  -- every caller, not just the winner. Chosen over the xmax approach because it
  -- is the smaller, more clearly-correct change for both symptoms.
  -- F2 STEP 6 -- from here down, ONLY v_derived_cluster is used. The advisory lock
  -- must key on the derived value too: locking on the asserted one would let a
  -- caller serialize against a different natural key than the one it goes on to
  -- write, reopening the very create/refresh race this lock exists to close.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_source_dra_id::text || ':' || v_derived_cluster, 0));

  -- 1. Lock existing row (if any) to prevent concurrent publish/refresh races
  SELECT id, is_published, to_jsonb(t) INTO v_existing_id, v_is_published, v_prior_snapshot
  FROM matrix_map.site_aggregate_publications t
  WHERE source_dra_id = p_source_dra_id AND coordinate_cluster_id = v_derived_cluster
  FOR UPDATE;

  IF FOUND AND v_is_published THEN
    RAISE EXCEPTION 'candidate % is already published and cannot be refreshed silently', v_existing_id USING ERRCODE = 'UE409';
  END IF;

  v_action := CASE WHEN FOUND THEN 'refresh' ELSE 'create' END;

  -- 2. Lock sources and compute snapshot
  PERFORM matrix_map.lock_site_aggregate_publication_sources();

  SELECT * INTO v_snap
  FROM matrix_map.current_site_aggregate_snapshot(p_source_dra_id, v_derived_cluster);

  IF v_snap IS NULL OR v_snap.sample_count_total IS NULL OR v_snap.sample_count_total = 0 THEN
    RAISE EXCEPTION 'snapshot is empty' USING ERRCODE = 'UE409';
  END IF;

  IF v_snap.sample_count_medium = 0 THEN
    RAISE EXCEPTION 'candidate requires at least one medium-tier sample' USING ERRCODE = 'UE422';
  END IF;

  -- 3. Upsert
  PERFORM set_config('matrix_map.audited_site_aggregate_candidate', '1', true);

  INSERT INTO matrix_map.site_aggregate_publications (
    source_dra_id, coordinate_cluster_id, representative_latitude, representative_longitude,
    coordinate_quality_tier, coordinate_source, member_display_label, is_published,
    sample_count_total, sample_count_high, sample_count_medium, sample_count_low,
    distinct_point_count, data_snapshot_version, source_sample_hash, updated_at
  ) VALUES (
    p_source_dra_id, v_derived_cluster, v_snap.representative_latitude, v_snap.representative_longitude,
    v_snap.coordinate_quality_tier, v_snap.coordinate_source, matrix_map.blank_trim(p_member_display_label), false,
    v_snap.sample_count_total, v_snap.sample_count_high, v_snap.sample_count_medium, v_snap.sample_count_low,
    v_snap.distinct_point_count, md5(v_snap.source_sample_hash), v_snap.source_sample_hash, clock_timestamp()
  )
  ON CONFLICT (source_dra_id, coordinate_cluster_id) DO UPDATE SET
    representative_latitude = EXCLUDED.representative_latitude,
    representative_longitude = EXCLUDED.representative_longitude,
    coordinate_quality_tier = EXCLUDED.coordinate_quality_tier,
    coordinate_source = EXCLUDED.coordinate_source,
    member_display_label = EXCLUDED.member_display_label,
    sample_count_total = EXCLUDED.sample_count_total,
    sample_count_high = EXCLUDED.sample_count_high,
    sample_count_medium = EXCLUDED.sample_count_medium,
    sample_count_low = EXCLUDED.sample_count_low,
    distinct_point_count = EXCLUDED.distinct_point_count,
    data_snapshot_version = EXCLUDED.data_snapshot_version,
    source_sample_hash = EXCLUDED.source_sample_hash,
    updated_at = EXCLUDED.updated_at
  RETURNING id INTO v_existing_id;

  PERFORM set_config('matrix_map.audited_site_aggregate_candidate', '0', true);

  -- FIX 1 (accepted review finding): new_snapshot was previously to_jsonb(v_snap),
  -- the COMPUTED source snapshot from current_site_aggregate_snapshot(), which
  -- excludes member_display_label and other persisted candidate columns (id,
  -- is_published, data_snapshot_version, created_at/updated_at, ...). That left
  -- a create with no immutable record of the member-visible label just supplied,
  -- and a refresh did not record its new label either. prior_snapshot already
  -- held the complete PRIOR persisted row (to_jsonb(t) from the FOR UPDATE
  -- lookup above) -- only new_snapshot needed fixing. Re-select the complete
  -- persisted row by id and store ITS json as new_snapshot instead.
  SELECT * INTO v_persisted_row
  FROM matrix_map.site_aggregate_publications
  WHERE id = v_existing_id;

  -- 4. Audit
  INSERT INTO matrix_map.site_aggregate_candidate_audit (
    publication_id, source_dra_id, coordinate_cluster_id, action,
    prior_snapshot, new_snapshot, reason, changed_by, changed_by_email, changed_at
  ) VALUES (
    v_existing_id, p_source_dra_id, v_derived_cluster, v_action,
    v_prior_snapshot, to_jsonb(v_persisted_row), matrix_map.blank_trim(p_reason), v_uid, v_actor_email, clock_timestamp()
  );

  -- Returned ONLY after the persisted-row write and the audit write have both
  -- completed, so a caller that receives an id knows both landed in this
  -- transaction. This is the id the caller must use for its exact-ID readback.
  RETURN v_existing_id;
END;
$$;

ALTER FUNCTION matrix_map.upsert_site_aggregate_candidate(uuid, text, double precision, double precision, text, uuid, text) OWNER TO matrix_map_owner;
REVOKE ALL ON FUNCTION matrix_map.upsert_site_aggregate_candidate(uuid, text, double precision, double precision, text, uuid, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION matrix_map.upsert_site_aggregate_candidate(uuid, text, double precision, double precision, text, uuid, text) TO authenticated;

-- ===========================================================================
-- F2: LIVE PREVIEW RPC (2026-07-29)
-- ===========================================================================
--
-- WHY THIS EXISTS. The admin site-aggregates page built its live preview with
-- computeSiteAggregates(samples, dras, { tier: 'medium' }) -- clustering RAW
-- SAMPLES IN TYPESCRIPT -- while fetch_admin_site_aggregate_publications reads
-- only the persisted table. So nothing on the server could supply identities for
-- an unpublished live cluster, and the client was the de facto identity author.
-- This function is the server-side replacement, and it is what makes SQL the sole
-- identity authority (D-F2-1) rather than merely the preferred one.
--
-- TWO POPULATIONS, DELIBERATELY DISTINGUISHED. This is the substantive bug the
-- previous surface hid:
--   * the PREVIEW block is computed from the MEDIUM-tier population -- exactly
--     what { tier: 'medium' } produced, so the visible table and map are
--     unchanged;
--   * the LIFECYCLE block is computed from the ALL-TIER population -- exactly
--     what current_site_aggregate_snapshot (which applies NO tier filter) would
--     persist.
-- The page previously showed medium-only numbers while the persist path wrote
-- all-tier numbers. Both are now returned, separately, so the operator can see
-- what will actually be written.
--
-- THE LIFECYCLE REPRESENTATIVE PAIR IS THE WRITE LOCATOR. It is the CANONICAL
-- ROUNDED PAIR -- the numeric pair whose canonical rendering IS
-- canonical_cluster_id -- not an arbitrary first-row sample as at :1138-1139.
-- upsert_site_aggregate_candidate re-derives the key from this pair before
-- selecting anything, so the pair must round-trip exactly. That invariant is
-- asserted per returned row by executed test, not assumed.
--
-- ONE SOURCE OF TRUTH FOR CANONICALIZATION. lat5/lng5 are computed ONCE in
-- `base`. The grouping uses them, the canonical id is derived FROM them via the
-- shared function, and the locator is emitted FROM them. There is deliberately no
-- second spelling of the rounding anywhere in this function -- two independently
-- written canonicalizations are exactly how the client and server drifted apart.
--
-- SECURITY. matrix_map_owner holds BYPASSRLS, so this function reads past the
-- FORCE ROW LEVEL SECURITY on matrix_map.samples. The in-function role check is
-- therefore the SOLE access control, not defense in depth -- it runs FIRST, before
-- cursor and limit validation and before any row work, and fails closed.
-- search_path deliberately EXCLUDES public: every relation is schema-qualified,
-- and leaving public on a SECURITY DEFINER path is the schema most exposed to
-- object creation. Note that qualifying public.user_roles does not remove the
-- DEPENDENCY on schema public -- USAGE on it is still required, and is verified by
-- the catalog preflight rather than assumed.
--
-- AGGREGATE-ORACLE BOUNDARY. The logical unpaginated aggregate relation is fixed
-- by this body. Cursor parameters select a WINDOW and permit source_dra_id scan
-- pruning, but cannot change the grouping, tier rules, DRA scope or aggregate
-- values of rows in that relation. There is deliberately NO bbox, DRA-filter,
-- tier, radius, arbitrary-predicate or caller-sort parameter: a private aggregate
-- a caller can narrow is a spatial oracle. Cursor values are NOT
-- provenance-bearing -- a fabricated cursor is indistinguishable from an echoed
-- one and the boundary must not, and does not, rest on their origin.
CREATE OR REPLACE FUNCTION matrix_map.fetch_admin_site_aggregate_live_preview(
  p_after_source_dra_id uuid,
  p_after_canonical_cluster text,
  p_limit integer
)
RETURNS TABLE (
  source_dra_id uuid,
  source_dra_title text,
  canonical_cluster_id text,
  preview_representative_latitude double precision,
  preview_representative_longitude double precision,
  preview_coordinate_quality_tier text,
  -- DISPLAY/COMPATIBILITY value. See preview_coordinate_sources for the
  -- authoritative set.
  preview_coordinate_source text,
  /*
    THE AUTHORITATIVE PROVENANCE SET, sorted and DISTINCT.

    The flattened `..._coordinate_source` text beside this is a LOSSY
    serialization: `coordinate_source` is free-form text and may itself contain
    the '; ' separator, so the joined string cannot be split back into the set
    that produced it. Any consumer trying to recover set membership from the text
    can be wrong in both directions, and the one relationship a consumer most
    needs -- that the preview sources are a SUBSET of the lifecycle sources -- is
    exactly a set relationship.

    The array is therefore the contract and the text is kept only so existing
    display paths keep working. Both are built from the SAME expression over the
    SAME population, and both order by `b_source`, which carries COLLATE "C" from
    the base CTE, so the array order and the text order agree byte-for-byte.

    NULL, NOT AN EMPTY ARRAY, when no row contributes a source: `array_agg`
    with a FILTER that matches nothing returns NULL, exactly as `string_agg`
    does. Keeping them null together makes `text IS NULL <-> array IS NULL` an
    invariant a consumer can assert, which a coalesce to '{}' would break.
  */
  preview_coordinate_sources text[],
  preview_sample_count_total integer,
  preview_sample_count_high integer,
  preview_sample_count_medium integer,
  preview_sample_count_low integer,
  preview_distinct_point_count integer,
  lifecycle_representative_latitude double precision,
  lifecycle_representative_longitude double precision,
  lifecycle_coordinate_quality_tier text,
  -- DISPLAY/COMPATIBILITY value. See lifecycle_coordinate_sources.
  lifecycle_coordinate_source text,
  -- The ALL-TIER provenance set. Same contract as
  -- preview_coordinate_sources above; the preview set is a SUBSET of this one,
  -- because the preview population is the medium-tier subset of this population.
  lifecycle_coordinate_sources text[],
  lifecycle_sample_count_total integer,
  lifecycle_sample_count_high integer,
  lifecycle_sample_count_medium integer,
  lifecycle_sample_count_low integer,
  lifecycle_distinct_point_count integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, matrix_map, pg_temp
AS $$
DECLARE
  v_uid uuid;
  v_is_authorized boolean;
  -- Same ceiling as fetch_admin_site_aggregate_publications (:563).
  c_max_limit constant integer := 1000;
  -- A canonical cluster id is two 'FM9990.00000' renderings joined by a comma: at
  -- most 11 characters per axis (optional sign, up to 4 integer digits, the point,
  -- 5 decimals) plus the separator = 23. 32 leaves headroom without admitting an
  -- unbounded caller-supplied string into a comparison.
  c_max_cursor_len constant integer := 32;
BEGIN
  -- AUTHORIZATION FIRST. Not after validation, not interleaved with it. This is
  -- the only access control on an RLS-bypassing function.
  v_uid := matrix_map.current_user_id();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'fetch_admin_site_aggregate_live_preview requires authenticated user context'
      USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_uid
      AND ur.role IN ('admin', 'matrix_admin')
  ) INTO v_is_authorized;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'fetch_admin_site_aggregate_live_preview requires admin or matrix_admin role'
      USING ERRCODE = '42501';
  END IF;

  -- CURSOR PAIRING. Both fields or neither. A half-supplied cursor is a caller
  -- defect, not something to silently coerce into a first page.
  IF (p_after_source_dra_id IS NULL) <> (p_after_canonical_cluster IS NULL) THEN
    RAISE EXCEPTION 'fetch_admin_site_aggregate_live_preview cursor requires both fields or neither'
      USING ERRCODE = 'UE422';
  END IF;

  IF p_after_canonical_cluster IS NOT NULL
     AND length(p_after_canonical_cluster) > c_max_cursor_len THEN
    RAISE EXCEPTION 'fetch_admin_site_aggregate_live_preview cursor exceeds maximum canonical length'
      USING ERRCODE = 'UE422';
  END IF;

  -- BOUNDS BEFORE ROW WORK, fail closed. No argument defaults anywhere in this
  -- family: every caller states its own bounds (:508-512).
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > c_max_limit THEN
    RAISE EXCEPTION 'fetch_admin_site_aggregate_live_preview requires p_limit between 1 and %', c_max_limit
      USING ERRCODE = 'UE422';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      s.source_dra_id           AS b_source_dra_id,
      -- THE single rounding expression per axis in this function.
      round(s.latitude::numeric,  5) AS lat5,
      round(s.longitude::numeric, 5) AS lng5,
      s.coordinate_quality_tier AS b_tier,
      -- COLLATE "C" IS APPLIED HERE, at the single point the column enters the
      -- query, so the source aggregation below can order by the plain column and
      -- still get byte order. `string_agg(DISTINCT x ...)` requires its ORDER BY
      -- expression to appear in the DISTINCT list, and `x COLLATE "C"` is a
      -- DIFFERENT expression from `x` -- so collating at the source is what makes
      -- the set-based form legal at all, not a stylistic choice.
      s.coordinate_source COLLATE "C" AS b_source
    FROM matrix_map.samples s
    JOIN matrix_map.dras d
      ON d.id = s.source_dra_id
     AND d.is_deleted = false
    WHERE s.latitude  IS NOT NULL
      AND s.longitude IS NOT NULL
      -- NaN needs an explicit test: PostgreSQL defines NaN = NaN as TRUE for
      -- floats, so `x = x` does not detect it. The range bounds are expected to
      -- exclude NaN and both infinities unaided (NaN sorts above all non-NaN
      -- values); these tests are belt-and-braces and are pinned by executed tests.
      --
      -- This predicate does NOT trust samples_lng_lat_geometry_consistency. That
      -- constraint is NOT VALID, so rows predating validation were never checked,
      -- and live state cannot rule them out.
      AND s.latitude   <> 'NaN'::double precision
      AND s.longitude  <> 'NaN'::double precision
      AND s.latitude  BETWEEN  -90 AND  90
      AND s.longitude BETWEEN -180 AND 180
      -- WINDOW-EQUIVALENT SCAN PRUNE, pushed BELOW aggregation. `>=` and not `>`:
      -- the cursor's own DRA may still contain later clusters. This can only
      -- remove rows that could not have appeared in the requested window anyway,
      -- because the total order leads with source_dra_id.
      AND (p_after_source_dra_id IS NULL OR s.source_dra_id >= p_after_source_dra_id)
  ),
  grouped AS (
    SELECT
      b.b_source_dra_id AS g_source_dra_id,
      b.lat5            AS g_lat5,
      b.lng5            AS g_lng5,
      -- Derived FROM the grouping key, so the round-trip invariant
      -- canonical(rep_lat, rep_lng) = canonical_cluster_id holds by construction.
      matrix_map.canonical_five_decimal_cluster(
        b.lat5::double precision,
        b.lng5::double precision
      ) AS g_canonical_cluster_id,

      -- LIFECYCLE (ALL-TIER) -- what the upsert would persist.
      count(*)::integer                                                    AS g_life_total,
      count(*) FILTER (WHERE b.b_tier = 'high')::integer                   AS g_life_high,
      count(*) FILTER (WHERE b.b_tier = 'medium')::integer                 AS g_life_medium,
      count(*) FILTER (WHERE b.b_tier = 'low')::integer                    AS g_life_low,

      -- PREVIEW (MEDIUM ONLY) -- what { tier: 'medium' } produced client-side.
      -- high and low are 0 by construction, exactly as the current UI reports
      -- them; they are returned rather than omitted so the two blocks stay
      -- structurally identical and a consumer cannot confuse one for the other.
      count(*) FILTER (WHERE b.b_tier = 'medium')::integer                 AS g_prev_total,
      0::integer                                                           AS g_prev_high,
      count(*) FILTER (WHERE b.b_tier = 'medium')::integer                 AS g_prev_medium,
      0::integer                                                           AS g_prev_low,

      -- Dominant tier, all-tier population. Ties break high > medium > low,
      -- matching current_site_aggregate_snapshot (:1152) and the client's
      -- severity-ordered scan, so the marker cannot flip between runs.
      --
      -- WRITTEN AS AN EXPRESSION OVER THE FILTERED COUNTS, not as a correlated
      -- subquery. It used to be a per-group `SELECT ... FROM base b2 WHERE
      -- b2.b_source_dra_id = b.b_source_dra_id AND ... LIMIT 1`, which is
      -- precisely the "aggregate that executes once per returned group" V6
      -- section 8.2 forbids. MEASURED, not argued: with the 502,000-row PERF
      -- fixture, a single first-page `EXPLAIN (ANALYZE, BUFFERS)` of the inner
      -- SELECT had not returned after TEN MINUTES with the three correlated
      -- subqueries present, and completes in well under a second without them.
      --
      -- The rewrite is EXACTLY equivalent. The old form ranked only the tiers
      -- actually PRESENT in the group, by `cnt DESC` then severity. Here a tier
      -- with a zero count is excluded by its own `> 0` guard, and the branch
      -- order encodes the same severity tie-break:
      --   high  wins when its count is >= both others and non-zero;
      --   medium wins when its count is >= low's and non-zero;
      --   low  otherwise.
      -- The final `sub.tier COLLATE "C"` tie-break in the old form could only
      -- ever apply to a fourth tier value, and the CHECK constraint on
      -- coordinate_quality_tier admits exactly three, so nothing is lost.
      CASE
        WHEN count(*) FILTER (WHERE b.b_tier = 'high') >= count(*) FILTER (WHERE b.b_tier = 'medium')
         AND count(*) FILTER (WHERE b.b_tier = 'high') >= count(*) FILTER (WHERE b.b_tier = 'low')
         AND count(*) FILTER (WHERE b.b_tier = 'high') > 0
          THEN 'high'
        WHEN count(*) FILTER (WHERE b.b_tier = 'medium') >= count(*) FILTER (WHERE b.b_tier = 'low')
         AND count(*) FILTER (WHERE b.b_tier = 'medium') > 0
          THEN 'medium'
        WHEN count(*) FILTER (WHERE b.b_tier = 'low') > 0
          THEN 'low'
        ELSE NULL
      END::text AS g_life_tier,

      -- Multiple distinct sources are reported explicitly rather than silently
      -- picking one, so provenance is never misrepresented. Plain trim and the
      -- non-empty filter mirror the snapshot function (:1166) exactly.
      --
      -- SET-BASED, for the same reason as the dominant tier above: both of these
      -- were correlated subqueries re-scanning `base` once per group. The
      -- ordering is still byte order -- `b_source` carries COLLATE "C" from the
      -- base CTE -- and the empty case still yields NULL, because `string_agg`
      -- over an empty filtered set returns NULL exactly as the old subquery over
      -- an empty derived table did.
      string_agg(DISTINCT b.b_source, '; ' ORDER BY b.b_source)
        FILTER (WHERE b.b_source IS NOT NULL AND length(trim(b.b_source)) > 0)
        AS g_life_source,

      string_agg(DISTINCT b.b_source, '; ' ORDER BY b.b_source)
        FILTER (WHERE b.b_tier = 'medium'
                  AND b.b_source IS NOT NULL
                  AND length(trim(b.b_source)) > 0)
        AS g_prev_source,

      -- THE AUTHORITATIVE SETS, paired with the flattened text above.
      --
      -- Each array_agg mirrors its string_agg EXACTLY -- same DISTINCT, same
      -- ORDER BY b_source (which carries COLLATE "C" from the base CTE, so this
      -- is byte order and not the database's default collation), and the same
      -- FILTER. That is what lets a consumer verify the text is a faithful
      -- rendering of the array WITHOUT parsing the text back into a set, which
      -- is impossible when a source value can itself contain the '; ' separator.
      --
      -- Written as a pair rather than deriving the text from the array in SQL
      -- (e.g. array_to_string) deliberately: the text column's existing bytes
      -- must not change, because the drift hash and the persisted candidate
      -- compare against it.
      array_agg(DISTINCT b.b_source ORDER BY b.b_source)
        FILTER (WHERE b.b_source IS NOT NULL AND length(trim(b.b_source)) > 0)
        AS g_life_sources,

      array_agg(DISTINCT b.b_source ORDER BY b.b_source)
        FILTER (WHERE b.b_tier = 'medium'
                  AND b.b_source IS NOT NULL
                  AND length(trim(b.b_source)) > 0)
        AS g_prev_sources
    FROM base b
    GROUP BY b.b_source_dra_id, b.lat5, b.lng5
    -- ROW SCOPE: at least one medium-tier sample. A cluster with no medium sample
    -- is not previewable and must not appear, matching { tier: 'medium' }.
    HAVING count(*) FILTER (WHERE b.b_tier = 'medium') > 0
  )
  SELECT
    g.g_source_dra_id,
    d.title,
    g.g_canonical_cluster_id,

    -- The preview and lifecycle representative pairs COINCIDE by construction:
    -- both are the canonical rounded pair of the same grouping key, and the medium
    -- population is a subset of the same cluster. They are returned separately
    -- because the two blocks are structurally parallel, not because they can
    -- differ. The counts and tiers are what genuinely differ.
    g.g_lat5::double precision,
    g.g_lng5::double precision,
    -- Preview population is medium-only, so its dominant tier is 'medium' by
    -- construction -- again matching what the client reports today.
    'medium'::text,
    g.g_prev_source,
    g.g_prev_sources,
    g.g_prev_total,
    g.g_prev_high,
    g.g_prev_medium,
    g.g_prev_low,
    -- DISTINCT POINT COUNT is provably 1 here: the grouping key IS the rounded
    -- pair, so every member renders to one canonical id. This replicates BOTH
    -- existing authorities faithfully -- current_site_aggregate_snapshot computes
    -- count(DISTINCT canonical(...)) over rows already filtered to one cluster
    -- (:1144), and the client adds the cluster id, not the raw point, to its set
    -- (siteAggregates.ts). Both are therefore always 1. Emitting the literal is
    -- exact, not an approximation, and avoids a per-group DISTINCT aggregate for a
    -- constant. The degeneracy is PRE-EXISTING and shared; changing what this
    -- metric means is a semantic redesign and is deliberately NOT part of F2.
    1::integer,

    g.g_lat5::double precision,
    g.g_lng5::double precision,
    g.g_life_tier,
    g.g_life_source,
    g.g_life_sources,
    g.g_life_total,
    g.g_life_high,
    g.g_life_medium,
    g.g_life_low,
    1::integer
  FROM grouped g
  JOIN matrix_map.dras d
    ON d.id = g.g_source_dra_id
  -- KEYSET PAGE PREDICATE. Written out rather than as a row-wise tuple comparison
  -- because a tuple comparison gives no clean place to attach the collation, and
  -- the collation is load-bearing: the total order must not depend on the
  -- database's default collation.
  WHERE p_after_source_dra_id IS NULL
     OR g.g_source_dra_id > p_after_source_dra_id
     OR ( g.g_source_dra_id = p_after_source_dra_id
          AND g.g_canonical_cluster_id COLLATE "C" > p_after_canonical_cluster COLLATE "C" )
  ORDER BY g.g_source_dra_id,
           g.g_canonical_cluster_id COLLATE "C"
  -- TRUNCATION IS EXPLICIT: fewer than p_limit rows means the traversal is
  -- complete. The caller advances by passing back the last row's
  -- (source_dra_id, canonical_cluster_id).
  LIMIT p_limit;
END;
$$;

ALTER FUNCTION matrix_map.fetch_admin_site_aggregate_live_preview(uuid, text, integer)
  OWNER TO matrix_map_owner;
REVOKE ALL ON FUNCTION matrix_map.fetch_admin_site_aggregate_live_preview(uuid, text, integer)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION matrix_map.fetch_admin_site_aggregate_live_preview(uuid, text, integer)
  TO authenticated;

CREATE OR REPLACE FUNCTION matrix_map.fetch_site_aggregate_candidate_audit(p_publication_id uuid)
RETURNS TABLE (
  id uuid,
  publication_id uuid,
  source_dra_id uuid,
  coordinate_cluster_id text,
  action text,
  reason text,
  prior_snapshot jsonb,
  new_snapshot jsonb,
  changed_by uuid,
  changed_by_email text,
  changed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = matrix_map, public, pg_temp
AS $$
DECLARE
  v_uid uuid;
  v_is_authorized boolean;
BEGIN
  v_uid := matrix_map.current_user_id();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'fetch_site_aggregate_candidate_audit requires authenticated user context' USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_uid AND role IN ('admin', 'matrix_admin')
  ) INTO v_is_authorized;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'fetch_site_aggregate_candidate_audit requires admin or matrix_admin role' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT a.id, a.publication_id, a.source_dra_id, a.coordinate_cluster_id, a.action, a.reason,
         a.prior_snapshot, a.new_snapshot, a.changed_by, a.changed_by_email, a.changed_at
  FROM matrix_map.site_aggregate_candidate_audit a
  WHERE a.publication_id = p_publication_id
  ORDER BY a.changed_at DESC, a.id DESC LIMIT 50;
END;
$$;

ALTER FUNCTION matrix_map.fetch_site_aggregate_candidate_audit(uuid) OWNER TO matrix_map_owner;
REVOKE ALL ON FUNCTION matrix_map.fetch_site_aggregate_candidate_audit(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION matrix_map.fetch_site_aggregate_candidate_audit(uuid) TO authenticated;

REVOKE CREATE ON SCHEMA matrix_map FROM matrix_map_owner;

COMMIT;
