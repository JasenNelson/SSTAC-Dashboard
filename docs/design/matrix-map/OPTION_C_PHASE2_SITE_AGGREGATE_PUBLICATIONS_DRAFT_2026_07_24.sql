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

GRANT CREATE ON SCHEMA matrix_map TO matrix_map_owner;

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
    CHECK (length(trim(member_display_label)) > 0),
  CONSTRAINT site_aggregate_publications_publish_metadata
    CHECK (
      is_published = false
      OR (
        published_at IS NOT NULL
        AND published_by IS NOT NULL
        AND publish_reason IS NOT NULL
        AND length(trim(publish_reason)) > 0
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
      RAISE EXCEPTION
        'site aggregate publication UPDATE seen outside matrix_map.flip_site_aggregate_public audited path'
        USING ERRCODE = '42501';
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

CREATE OR REPLACE FUNCTION matrix_map.fetch_published_site_aggregates()
RETURNS TABLE (
  aggregate_id uuid,
  label text,
  representative_latitude double precision,
  representative_longitude double precision,
  coordinate_quality_tier text,
  coordinate_source text,
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
BEGIN
  v_uid := matrix_map.current_user_id();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'fetch_published_site_aggregates requires authenticated user context'
      USING ERRCODE = '42501';
  END IF;

  v_email := matrix_map.jwt_claims() ->> 'email';
  IF v_email IS NULL OR NOT matrix_map.is_email_allowlisted(v_email) THEN
    RAISE EXCEPTION 'fetch_published_site_aggregates requires an allowlisted member'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    sap.id AS aggregate_id,
    sap.member_display_label AS label,
    sap.representative_latitude,
    sap.representative_longitude,
    sap.coordinate_quality_tier,
    sap.coordinate_source,
    matrix_map.site_aggregate_count_bucket(sap.sample_count_total) AS sample_count_bucket,
    sap.data_snapshot_version,
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
  ORDER BY sap.member_display_label ASC, sap.id ASC;
END;
$$;

ALTER FUNCTION matrix_map.fetch_published_site_aggregates()
  OWNER TO matrix_map_owner;

REVOKE EXECUTE ON FUNCTION matrix_map.fetch_published_site_aggregates()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION matrix_map.fetch_published_site_aggregates()
  TO authenticated;

CREATE OR REPLACE FUNCTION matrix_map.fetch_admin_site_aggregate_publications(p_publication_id uuid DEFAULT NULL)
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
  unpublish_reason text
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

  RETURN QUERY
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
    sap.unpublish_reason
  FROM matrix_map.site_aggregate_publications sap
  JOIN matrix_map.dras d ON d.id = sap.source_dra_id
  WHERE p_publication_id IS NULL OR sap.id = p_publication_id
  ORDER BY sap.sample_count_total DESC, sap.member_display_label ASC, sap.id ASC;
END;
$$;

ALTER FUNCTION matrix_map.fetch_admin_site_aggregate_publications(uuid)
  OWNER TO matrix_map_owner;

REVOKE EXECUTE ON FUNCTION matrix_map.fetch_admin_site_aggregate_publications(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION matrix_map.fetch_admin_site_aggregate_publications(uuid)
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
  ORDER BY a.changed_at DESC
  LIMIT 50;
END;
$$;

ALTER FUNCTION matrix_map.fetch_site_aggregate_publication_audit(uuid)
  OWNER TO matrix_map_owner;

REVOKE EXECUTE ON FUNCTION matrix_map.fetch_site_aggregate_publication_audit(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION matrix_map.fetch_site_aggregate_publication_audit(uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION matrix_map.flip_site_aggregate_public(
  p_publication_id uuid,
  p_new_value boolean,
  p_actor_id uuid,
  p_reason text
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

  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'flip_site_aggregate_public requires a non-empty reason';
  END IF;

  v_actor_email := v_claims ->> 'email';
  IF v_actor_email IS NULL OR length(trim(v_actor_email)) = 0 THEN
    RAISE EXCEPTION 'flip_site_aggregate_public could not resolve actor email from JWT for sub %', v_uid;
  END IF;

  SELECT *
  INTO v_row
  FROM matrix_map.site_aggregate_publications
  WHERE id = p_publication_id
  FOR UPDATE;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'site aggregate publication % not found', p_publication_id;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM matrix_map.dras d
    WHERE d.id = v_row.source_dra_id
      AND d.is_deleted = false
  )
  INTO v_dra_exists;

  IF NOT v_dra_exists THEN
    RAISE EXCEPTION 'site aggregate publication % references a missing or soft-deleted DRA', p_publication_id;
  END IF;

  IF length(trim(v_row.member_display_label)) = 0 THEN
    RAISE EXCEPTION 'site aggregate publication % requires a neutral member display label', p_publication_id;
  END IF;

  IF v_row.is_published IS DISTINCT FROM p_new_value THEN
    PERFORM set_config('matrix_map.audited_site_aggregate_publication', '1', true);

    UPDATE matrix_map.site_aggregate_publications
    SET
      is_published = p_new_value,
      published_at = CASE WHEN p_new_value THEN now() ELSE published_at END,
      published_by = CASE WHEN p_new_value THEN v_uid ELSE published_by END,
      publish_reason = CASE WHEN p_new_value THEN trim(p_reason) ELSE publish_reason END,
      unpublished_at = CASE WHEN p_new_value THEN unpublished_at ELSE now() END,
      unpublished_by = CASE WHEN p_new_value THEN unpublished_by ELSE v_uid END,
      unpublish_reason = CASE WHEN p_new_value THEN unpublish_reason ELSE trim(p_reason) END,
      updated_at = now()
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
      now(),
      v_uid,
      v_actor_email,
      trim(p_reason),
      to_jsonb(v_row),
      to_jsonb(sap)
    FROM matrix_map.site_aggregate_publications sap
    WHERE sap.id = p_publication_id;
  END IF;
END;
$$;

ALTER FUNCTION matrix_map.flip_site_aggregate_public(uuid, boolean, uuid, text)
  OWNER TO matrix_map_owner;

REVOKE EXECUTE ON FUNCTION matrix_map.flip_site_aggregate_public(uuid, boolean, uuid, text)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION matrix_map.flip_site_aggregate_public(uuid, boolean, uuid, text)
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

GRANT SELECT, UPDATE ON matrix_map.site_aggregate_publications TO matrix_map_owner;
GRANT SELECT, INSERT ON matrix_map.site_aggregate_publication_audit TO matrix_map_owner;

REVOKE CREATE ON SCHEMA matrix_map FROM matrix_map_owner;
