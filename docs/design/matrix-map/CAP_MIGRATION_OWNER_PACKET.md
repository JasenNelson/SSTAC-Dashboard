OWNER-GATED. Agent SQL writes are forbidden (AGENTS.md Supabase Protocol).
Apply ONLY via the Supabase Studio SQL Editor. Do NOT apply via MCP.

# Matrix Map Cap Migration Owner Packet

This migration raises the visible-row cap in `matrix_map.fetch_samples_with_hidden_summary` from 2500 to 5000. The cap is being raised because the province-wide valid sample count has grown to 4486, causing 1986 rows to be silently dropped for admins. This is a security-preserving `CREATE OR REPLACE` operation that maintains the same single-argument signature, which is required to preserve the function OWNER (`matrix_map_owner`) and existing grants.

## PRE-APPLY VERIFY (read-only)

Run the following queries FIRST to confirm the current state:

**1. Confirm current function owner + signature:**
```sql
SELECT p.proname, pg_get_userbyid(p.proowner) AS owner, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'matrix_map' AND p.proname = 'fetch_samples_with_hidden_summary';
```

**2. Confirm the province-wide valid-sample count (expected ~4486):**
```sql
SELECT COUNT(*)
FROM matrix_map.samples s
JOIN matrix_map.dras d ON d.id = s.source_dra_id
WHERE s.longitude IS NOT NULL
  AND s.latitude IS NOT NULL
  AND s.source_dra_id IS NOT NULL
  AND d.is_deleted = false;
```

## APPLY

Apply the following `CREATE OR REPLACE FUNCTION` statement EXACTLY as written. It includes the required `SECURITY DEFINER`, `search_path`, and `v_cap constant int := 5000`.

```sql
CREATE OR REPLACE FUNCTION matrix_map.fetch_samples_with_hidden_summary(p_bbox jsonb DEFAULT NULL::jsonb)
  RETURNS jsonb
  LANGUAGE plpgsql
  STABLE SECURITY DEFINER
  SET search_path TO 'matrix_map', 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_uid                 uuid;
  v_caller_email        text;
  v_is_admin            boolean;
  v_visible             jsonb;
  v_hidden_sample_count int;
  v_hidden_dra_ids      uuid[];
  v_hidden_dra_count    int;
  v_snapshot            text;
  v_has_bbox            boolean := false;
  v_min_lng             double precision;
  v_min_lat             double precision;
  v_max_lng             double precision;
  v_max_lat             double precision;
  v_total_in_bbox       int;
  v_cap                 constant int := 5000;  -- raised from 2500 (covers 4486 + headroom)
  v_truncated           boolean := false;
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

  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = v_uid
      AND role IN ('admin', 'matrix_admin')
  )
  INTO v_is_admin;

  BEGIN
    IF p_bbox IS NOT NULL
       AND jsonb_typeof(p_bbox -> 'min_lng') = 'number'
       AND jsonb_typeof(p_bbox -> 'min_lat') = 'number'
       AND jsonb_typeof(p_bbox -> 'max_lng') = 'number'
       AND jsonb_typeof(p_bbox -> 'max_lat') = 'number' THEN
      v_min_lng := (p_bbox ->> 'min_lng')::double precision;
      v_min_lat := (p_bbox ->> 'min_lat')::double precision;
      v_max_lng := (p_bbox ->> 'max_lng')::double precision;
      v_max_lat := (p_bbox ->> 'max_lat')::double precision;
      IF v_min_lng <= v_max_lng AND v_min_lat <= v_max_lat
         AND v_min_lng >= -180 AND v_max_lng <= 180
         AND v_min_lat >= -90  AND v_max_lat <= 90 THEN
        v_has_bbox := true;
      END IF;
    END IF;
  EXCEPTION WHEN others THEN
    v_has_bbox := false;
  END;

  SELECT COUNT(*)
  FROM matrix_map.samples s
  JOIN matrix_map.dras d ON d.id = s.source_dra_id
  WHERE s.longitude IS NOT NULL
    AND s.latitude IS NOT NULL
    AND s.source_dra_id IS NOT NULL
    AND d.is_deleted = false
    AND (v_is_admin OR d.public = true OR matrix_map.has_private_grant(d.id))
    AND (NOT v_has_bbox
         OR (s.longitude BETWEEN v_min_lng AND v_max_lng
             AND s.latitude BETWEEN v_min_lat AND v_max_lat))
  INTO v_total_in_bbox;

  v_truncated := v_total_in_bbox > v_cap;

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
      AND (NOT v_has_bbox
           OR (s.longitude BETWEEN v_min_lng AND v_max_lng
               AND s.latitude BETWEEN v_min_lat AND v_max_lat))
    ORDER BY s.bnrrm_station_id NULLS LAST, s.id
    LIMIT v_cap
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
    'data_snapshot_version', v_snapshot,
    'total_in_bbox',         v_total_in_bbox,
    'returned_sample_count', LEAST(v_total_in_bbox, v_cap),
    'truncated',             v_truncated,
    'bbox_applied',          v_has_bbox
  );
END;
$function$;
```

## POST-APPLY VERIFY (read-only)

Run the following queries to verify the function was updated successfully.

**1. Re-run owner + signature query to ensure owner is STILL `matrix_map_owner` and signature is unchanged:**
```sql
SELECT p.proname, pg_get_userbyid(p.proowner) AS owner, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'matrix_map' AND p.proname = 'fetch_samples_with_hidden_summary';
```

**2. Confirm the cap now returns the full set:**
```sql
SELECT
  (matrix_map.fetch_samples_with_hidden_summary()->>'returned_sample_count')::int AS count,
  (matrix_map.fetch_samples_with_hidden_summary()->>'truncated')::boolean AS truncated;
```
Expected output should be a count of up to 5000 (currently ~4486) and `truncated = false`.

## ROLLBACK

If rollback is necessary, re-apply the 2500 cap version from `20260623000001_matrix_map_fetch_samples_bbox_pagination.sql` using a `CREATE OR REPLACE` statement to downgrade back to `v_cap constant int := 2500;`.
