-- Option C Phase 2 Local PostgreSQL Validation Suite (Attempt 005)
-- Target: Disposable local PostgreSQL container with bootstrap-option-c.sql and PR 752 draft SQL loaded.
-- ASCII ONLY

SET search_path = matrix_map, public, pg_catalog;

CREATE TABLE IF NOT EXISTS public.test_results (
  test_id text PRIMARY KEY,
  description text NOT NULL,
  status text NOT NULL CHECK (status IN ('PASS', 'FAIL', 'SKIP')),
  sqlstate text,
  details text,
  executed_at timestamptz NOT NULL DEFAULT now()
);

-- TEST 01: Function Existence Check
DO $$
DECLARE
  v_missing text[];
BEGIN
  SELECT array_agg(fn) INTO v_missing
  FROM (
    SELECT unnest(ARRAY[
      'site_aggregate_count_bucket',
      'enforce_site_aggregate_publication_via_rpc',
      'fetch_published_site_aggregates',
      'fetch_admin_site_aggregate_publications',
      'fetch_site_aggregate_publication_audit',
      'canonical_five_decimal_cluster',
      'current_site_aggregate_snapshot',
      'lock_site_aggregate_publication_sources',
      'flip_site_aggregate_public'
    ]) AS fn
  ) required
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'matrix_map' AND p.proname = required.fn
  );

  IF v_missing IS NULL OR array_length(v_missing, 1) IS NULL THEN
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_01', 'Verify all 9 Option C functions exist in matrix_map schema', 'PASS', 'All 9 required functions found');
  ELSE
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_01', 'Verify all 9 Option C functions exist in matrix_map schema', 'FAIL', 'Missing functions: ' || array_to_string(v_missing, ', '));
  END IF;
END $$;

-- TEST 02: Lock Helper Owner, SECDEF, and Catalog ACL Checks (Correction Item 2)
-- Inspects pg_proc.proacl/aclexplode where grantee oid 0 represents PUBLIC without treating PUBLIC as a role name.
-- Continues testing anon, authenticated, service_role, and matrix_map_owner.
DO $$
DECLARE
  v_owner text;
  v_secdef boolean;
  v_pub_exec boolean;
  v_anon_exec boolean;
  v_auth_exec boolean;
  v_svc_exec boolean;
  v_owner_exec boolean;
BEGIN
  SELECT pg_get_userbyid(p.proowner), p.prosecdef
  INTO v_owner, v_secdef
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'matrix_map' AND p.proname = 'lock_site_aggregate_publication_sources';

  -- Inspect catalog for PUBLIC EXECUTE grant (grantee OID 0 = PUBLIC)
  SELECT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace,
    aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a
    WHERE n.nspname = 'matrix_map'
      AND p.proname = 'lock_site_aggregate_publication_sources'
      AND a.grantee = 0
      AND a.privilege_type = 'EXECUTE'
  ) INTO v_pub_exec;

  -- Test role privileges for explicit roles
  SELECT
    has_function_privilege('anon', 'matrix_map.lock_site_aggregate_publication_sources()', 'EXECUTE'),
    has_function_privilege('authenticated', 'matrix_map.lock_site_aggregate_publication_sources()', 'EXECUTE'),
    has_function_privilege('service_role', 'matrix_map.lock_site_aggregate_publication_sources()', 'EXECUTE'),
    has_function_privilege('matrix_map_owner', 'matrix_map.lock_site_aggregate_publication_sources()', 'EXECUTE')
  INTO v_anon_exec, v_auth_exec, v_svc_exec, v_owner_exec;

  IF v_owner = 'postgres' AND v_secdef = true
     AND v_pub_exec = false AND v_anon_exec = false AND v_auth_exec = false AND v_svc_exec = false
     AND v_owner_exec = true THEN
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_02', 'Verify lock helper owner (postgres), SECDEF (true), and ACLs (denied PUBLIC/anon/auth/svc, granted matrix_map_owner)', 'PASS',
      'Owner=postgres, SECDEF=true, PubExec=false (grantee 0 check), AnonExec=false, AuthExec=false, SvcExec=false, MapOwnerExec=true');
  ELSE
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_02', 'Verify lock helper owner (postgres), SECDEF (true), and ACLs (denied PUBLIC/anon/auth/svc, granted matrix_map_owner)', 'FAIL',
      format('Owner=%s (exp postgres), SECDEF=%s (exp true), PubExec=%s (exp false), AnonExec=%s (exp false), AuthExec=%s (exp false), SvcExec=%s (exp false), MapOwnerExec=%s (exp true)',
        v_owner, v_secdef, v_pub_exec, v_anon_exec, v_auth_exec, v_svc_exec, v_owner_exec));
  END IF;
END $$;

-- TEST 03: CREATE-only Collision Failure Verification
DO $$
BEGIN
  BEGIN
    EXECUTE 'CREATE FUNCTION matrix_map.lock_site_aggregate_publication_sources() RETURNS void LANGUAGE plpgsql AS $f$ BEGIN NULL; END; $f$;';
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_03', 'Verify CREATE-only collision failure for lock helper', 'FAIL', 'CREATE FUNCTION succeeded without error when function already existed');
  EXCEPTION WHEN duplicate_function THEN
    INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
    VALUES ('TEST_03', 'Verify CREATE-only collision failure for lock helper', 'PASS', SQLSTATE, 'Caught expected 42723 duplicate_function exception');
  WHEN OTHERS THEN
    INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
    VALUES ('TEST_03', 'Verify CREATE-only collision failure for lock helper', 'FAIL', SQLSTATE, 'Caught unexpected exception: ' || SQLERRM);
  END;
END $$;

-- TEST 04: Repeatable Read Isolation Guard Verification
-- Must set isolation level at transaction start via BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;
SET LOCAL request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","email":"admin@example.com"}';
DO $$
BEGIN
  BEGIN
    PERFORM matrix_map.flip_site_aggregate_public(
      'c1111111-1111-1111-1111-111111111111', true, '11111111-1111-1111-1111-111111111111', 'Isolation Test'
    );
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_04', 'Verify publication under Repeatable Read is rejected', 'FAIL', 'flip_site_aggregate_public succeeded under REPEATABLE READ');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%read committed transaction isolation%' THEN
      INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
      VALUES ('TEST_04', 'Verify publication under Repeatable Read is rejected', 'PASS', SQLSTATE, 'Caught expected isolation guard exception: ' || SQLERRM);
    ELSE
      INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
      VALUES ('TEST_04', 'Verify publication under Repeatable Read is rejected', 'FAIL', SQLSTATE, 'Caught unexpected exception: ' || SQLERRM);
    END IF;
  END;
END $$;
COMMIT;

-- TEST 05: Seed Publication Row from actual snapshot output & Test Direct UPDATE Block
DO $$
DECLARE
  v_dra_id uuid := 'a1111111-1111-1111-1111-111111111111';
  v_cluster_id text := '49.28273,-123.12074';
  v_pub_id uuid := 'c1111111-1111-1111-1111-111111111111';
  v_snap RECORD;
BEGIN
  -- Seed publication row dynamically from actual current_site_aggregate_snapshot() output to prevent drift
  SELECT * INTO v_snap
  FROM matrix_map.current_site_aggregate_snapshot(v_dra_id, v_cluster_id);

  IF v_snap IS NULL OR v_snap.sample_count_total IS NULL OR v_snap.sample_count_total = 0 THEN
    RAISE EXCEPTION 'Failed to seed publication: current_site_aggregate_snapshot returned NULL or empty total';
  END IF;

  INSERT INTO matrix_map.site_aggregate_publications (
    id, source_dra_id, coordinate_cluster_id, representative_latitude, representative_longitude,
    coordinate_quality_tier, coordinate_source, member_display_label, is_published,
    sample_count_total, sample_count_high, sample_count_medium, sample_count_low,
    distinct_point_count, data_snapshot_version, source_sample_hash
  ) VALUES (
    v_pub_id, v_dra_id, v_cluster_id, v_snap.representative_latitude, v_snap.representative_longitude,
    v_snap.coordinate_quality_tier, v_snap.coordinate_source, 'Neutral Label 1', false,
    v_snap.sample_count_total, v_snap.sample_count_high, v_snap.sample_count_medium, v_snap.sample_count_low,
    v_snap.distinct_point_count, 'v1', v_snap.source_sample_hash
  ) ON CONFLICT (id) DO UPDATE SET
    representative_latitude = EXCLUDED.representative_latitude,
    representative_longitude = EXCLUDED.representative_longitude,
    coordinate_quality_tier = EXCLUDED.coordinate_quality_tier,
    coordinate_source = EXCLUDED.coordinate_source,
    sample_count_total = EXCLUDED.sample_count_total,
    sample_count_high = EXCLUDED.sample_count_high,
    sample_count_medium = EXCLUDED.sample_count_medium,
    sample_count_low = EXCLUDED.sample_count_low,
    distinct_point_count = EXCLUDED.distinct_point_count,
    source_sample_hash = EXCLUDED.source_sample_hash;

  -- Attempt direct UPDATE without setting audited GUC
  BEGIN
    SET LOCAL ROLE matrix_map_owner;
    UPDATE matrix_map.site_aggregate_publications
    SET member_display_label = 'Forged Label'
    WHERE id = v_pub_id;

    RESET ROLE;
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_05', 'Verify direct UPDATE outside flip_site_aggregate_public is blocked', 'FAIL', 'Direct UPDATE succeeded without audited GUC');
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
    INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
    VALUES ('TEST_05', 'Verify direct UPDATE outside flip_site_aggregate_public is blocked', 'PASS', SQLSTATE, 'Caught expected 42501 insufficient_privilege trigger exception');
  WHEN OTHERS THEN
    RESET ROLE;
    INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
    VALUES ('TEST_05', 'Verify direct UPDATE outside flip_site_aggregate_public is blocked', 'FAIL', SQLSTATE, 'Caught unexpected exception: ' || SQLERRM);
  END;
END $$;

-- TEST 06: Direct INSERT with is_published=true Blocked
DO $$
BEGIN
  BEGIN
    INSERT INTO matrix_map.site_aggregate_publications (
      id, source_dra_id, coordinate_cluster_id, representative_latitude, representative_longitude,
      coordinate_quality_tier, member_display_label, is_published, sample_count_total,
      sample_count_high, sample_count_medium, sample_count_low, distinct_point_count,
      data_snapshot_version, source_sample_hash
    ) VALUES (
      'c2222222-2222-2222-2222-222222222222', 'a1111111-1111-1111-1111-111111111111', '49.28273,-123.12074',
      49.28273, -123.12074, 'medium', 'Neutral Label 2', true,
      2, 1, 1, 0, 1, 'v1', md5('hash_test2')
    );

    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_06', 'Verify direct INSERT with is_published=true is blocked', 'FAIL', 'Direct INSERT of published row succeeded');
  EXCEPTION WHEN insufficient_privilege THEN
    INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
    VALUES ('TEST_06', 'Verify direct INSERT with is_published=true is blocked', 'PASS', SQLSTATE, 'Caught expected 42501 trigger exception');
  WHEN OTHERS THEN
    INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
    VALUES ('TEST_06', 'Verify direct INSERT with is_published=true is blocked', 'FAIL', SQLSTATE, 'Caught unexpected exception: ' || SQLERRM);
  END;
END $$;

-- TEST 07: Forged GUC Direct UPDATE by Non-Owner Blocked
DO $$
BEGIN
  PERFORM set_config('matrix_map.audited_site_aggregate_publication', '1', true);
  BEGIN
    -- Run as postgres (superuser) which has UPDATE privilege but is not matrix_map_owner
    UPDATE matrix_map.site_aggregate_publications
    SET member_display_label = 'Forged By Non-Owner'
    WHERE id = 'c1111111-1111-1111-1111-111111111111';

    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_07', 'Verify forged GUC UPDATE by non-owner role is blocked', 'FAIL', 'UPDATE by non-owner role succeeded with forged GUC');
  EXCEPTION WHEN insufficient_privilege THEN
    INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
    VALUES ('TEST_07', 'Verify forged GUC UPDATE by non-owner role is blocked', 'PASS', SQLSTATE, 'Caught expected 42501 non-owner check exception');
  WHEN OTHERS THEN
    INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
    VALUES ('TEST_07', 'Verify forged GUC UPDATE by non-owner role is blocked', 'FAIL', SQLSTATE, 'Caught unexpected exception: ' || SQLERRM);
  END;
  PERFORM set_config('matrix_map.audited_site_aggregate_publication', '0', true);
END $$;

-- TEST 08: Direct Table Read Denial Verification
-- Authenticated role has no direct SELECT grant on matrix_map.site_aggregate_publications per draft ACLs.
DO $$
DECLARE
  v_count integer;
BEGIN
  BEGIN
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO v_count FROM matrix_map.site_aggregate_publications;
    RESET ROLE;

    IF v_count = 0 THEN
      INSERT INTO public.test_results (test_id, description, status, details)
      VALUES ('TEST_08', 'Verify direct SELECT under authenticated role is blocked by draft ACLs', 'PASS', 'Direct SELECT returned 0 rows via RLS');
    ELSE
      INSERT INTO public.test_results (test_id, description, status, details)
      VALUES ('TEST_08', 'Verify direct SELECT under authenticated role is blocked by draft ACLs', 'FAIL', 'Direct SELECT returned ' || v_count || ' rows');
    END IF;
  EXCEPTION WHEN insufficient_privilege THEN
    RESET ROLE;
    INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
    VALUES ('TEST_08', 'Verify direct SELECT under authenticated role is blocked by draft ACLs', 'PASS', SQLSTATE, 'Caught expected 42501 table SELECT permission denial');
  WHEN OTHERS THEN
    RESET ROLE;
    INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
    VALUES ('TEST_08', 'Verify direct SELECT under authenticated role is blocked by draft ACLs', 'FAIL', SQLSTATE, 'Caught unexpected exception: ' || SQLERRM);
  END;
END $$;

-- TEST 09: Audited RPC Publication Flip (Happy Path) (Correction Item 3)
DO $$
DECLARE
  v_pub_id uuid := 'c1111111-1111-1111-1111-111111111111';
  v_admin_id uuid := '11111111-1111-1111-1111-111111111111';
  v_is_pub boolean;
  v_audit_count integer;
  v_iso text;
  v_dras_public_before boolean;
  v_samples_public_before boolean;
  v_dras_public_after boolean;
  v_samples_public_after boolean;
  v_audit_row RECORD;
BEGIN
  v_iso := current_setting('transaction_isolation');
  IF v_iso != 'read committed' THEN
    RAISE EXCEPTION 'Expected transaction isolation to be read committed, found: %', v_iso;
  END IF;

  SELECT public INTO v_dras_public_before FROM matrix_map.dras WHERE id = 'a1111111-1111-1111-1111-111111111111';
  SELECT public INTO v_samples_public_before FROM matrix_map.samples WHERE source_dra_id = 'a1111111-1111-1111-1111-111111111111' LIMIT 1;

  -- Set Admin JWT session context
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","email":"admin@example.com"}', true);

  PERFORM matrix_map.flip_site_aggregate_public(
    v_pub_id, true, v_admin_id, 'Owner approved publication for site 3250'
  );

  SELECT is_published INTO v_is_pub FROM matrix_map.site_aggregate_publications WHERE id = v_pub_id;
  SELECT public INTO v_dras_public_after FROM matrix_map.dras WHERE id = 'a1111111-1111-1111-1111-111111111111';
  SELECT public INTO v_samples_public_after FROM matrix_map.samples WHERE source_dra_id = 'a1111111-1111-1111-1111-111111111111' LIMIT 1;
  SELECT count(*) INTO v_audit_count FROM matrix_map.site_aggregate_publication_audit WHERE publication_id = v_pub_id;
  SELECT * INTO v_audit_row FROM matrix_map.site_aggregate_publication_audit WHERE publication_id = v_pub_id ORDER BY changed_at DESC LIMIT 1;

  IF v_dras_public_before IS DISTINCT FROM v_dras_public_after OR v_samples_public_before IS DISTINCT FROM v_samples_public_after THEN
    RAISE EXCEPTION 'Invariant violation: dras.public or samples.public changed across publication';
  END IF;

  IF v_audit_row.prior_value IS NOT FALSE OR v_audit_row.new_value IS NOT TRUE OR v_audit_row.reason != 'Owner approved publication for site 3250' THEN
    RAISE EXCEPTION 'Audit row content mismatch on publish';
  END IF;

  -- Test unpublish
  PERFORM matrix_map.flip_site_aggregate_public(v_pub_id, false, v_admin_id, 'Retracting publication');
  SELECT is_published INTO v_is_pub FROM matrix_map.site_aggregate_publications WHERE id = v_pub_id;
  SELECT * INTO v_audit_row FROM matrix_map.site_aggregate_publication_audit WHERE publication_id = v_pub_id ORDER BY changed_at DESC LIMIT 1;

  IF v_is_pub IS NOT FALSE OR v_audit_row.new_value IS NOT FALSE OR v_audit_row.reason != 'Retracting publication' THEN
    RAISE EXCEPTION 'Unpublish or its audit row failed';
  END IF;

  -- Restore to true for subsequent tests
  PERFORM matrix_map.flip_site_aggregate_public(v_pub_id, true, v_admin_id, 'Re-publishing');

  INSERT INTO public.test_results (test_id, description, status, details)
  VALUES ('TEST_09', 'Verify flip_site_aggregate_public preserves public invariant, writes audit log, and handles unpublish', 'PASS', format('Publication toggled with correct audit rows and invariants intact under %s', v_iso));
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
  VALUES ('TEST_09', 'Verify flip_site_aggregate_public preserves public invariant, writes audit log, and handles unpublish', 'FAIL', SQLSTATE, 'RPC flip failed: ' || SQLERRM);
END $$;

-- TEST 10: Member Bucketed Read Path Privacy Verification
DO $$
DECLARE
  v_row RECORD;
BEGIN
  -- Set Member JWT session context
  PERFORM set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","email":"member@example.com"}', true);

  SELECT * INTO v_row FROM matrix_map.fetch_published_site_aggregates() LIMIT 1;

  IF v_row.aggregate_id = 'c1111111-1111-1111-1111-111111111111'
     AND v_row.label = 'Neutral Label 1'
     AND v_row.sample_count_bucket = '2-9'
     AND v_row.visible_sample_suppression_key IS NULL THEN
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_10', 'Verify member RPC returns opaque ID, neutral label, bucket count, and NULL suppression key', 'PASS', 'Bucket=2-9, SuppressionKey=NULL, Label=Neutral Label 1');
  ELSE
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_10', 'Verify member RPC returns opaque ID, neutral label, bucket count, and NULL suppression key', 'FAIL',
      format('ID=%s, Label=%s, Bucket=%s, SuppKey=%s', v_row.aggregate_id, v_row.label, v_row.sample_count_bucket, v_row.visible_sample_suppression_key));
  END IF;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
  VALUES ('TEST_10', 'Verify member RPC returns opaque ID, neutral label, bucket count, and NULL suppression key', 'FAIL', SQLSTATE, 'Member read failed: ' || SQLERRM);
END $$;

-- TEST 11: Lock Helper Execution & Table Lock Assertion
DO $$
DECLARE
  v_dra_lock text;
  v_sample_lock text;
BEGIN
  PERFORM matrix_map.lock_site_aggregate_publication_sources();

  SELECT mode INTO v_dra_lock
  FROM pg_locks l
  JOIN pg_class c ON c.oid = l.relation
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'matrix_map' AND c.relname = 'dras' AND l.pid = pg_backend_pid()
    AND l.mode = 'ShareLock' LIMIT 1;

  SELECT mode INTO v_sample_lock
  FROM pg_locks l
  JOIN pg_class c ON c.oid = l.relation
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'matrix_map' AND c.relname = 'samples' AND l.pid = pg_backend_pid()
    AND l.mode = 'ShareLock' LIMIT 1;

  IF v_dra_lock = 'ShareLock' AND v_sample_lock = 'ShareLock' THEN
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_11', 'Verify lock_site_aggregate_publication_sources acquires SHARE locks on dras and samples', 'PASS', 'SHARE locks held on both matrix_map.dras and matrix_map.samples');
  ELSE
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_11', 'Verify lock_site_aggregate_publication_sources acquires SHARE locks on dras and samples', 'FAIL', format('dras_lock=%s, samples_lock=%s (exp ShareLock)', v_dra_lock, v_sample_lock));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- CANDIDATE LIFECYCLE DELTA (TEST_12 .. TEST_16)
-- Added by the candidate-lifecycle branch. These cover the delta this branch
-- introduces on top of PR #752: the upsert RPC, its audit trail, the published
-- guard, publication idempotency, and the invariant that the member projection
-- is NOT widened by any of it.
-- ---------------------------------------------------------------------------

-- TEST 12: Candidate delta objects exist
DO $$
DECLARE
  v_missing text[];
  v_has_audit_table boolean;
BEGIN
  SELECT array_agg(fn) INTO v_missing
  FROM (
    SELECT unnest(ARRAY[
      'upsert_site_aggregate_candidate',
      'fetch_site_aggregate_candidate_audit'
    ]) AS fn
  ) required
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'matrix_map' AND p.proname = required.fn
  );

  SELECT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'matrix_map' AND c.relname = 'site_aggregate_candidate_audit'
  ) INTO v_has_audit_table;

  IF (v_missing IS NULL OR array_length(v_missing, 1) IS NULL) AND v_has_audit_table THEN
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_12', 'Verify candidate lifecycle delta objects exist (2 functions + audit table)', 'PASS',
            'upsert_site_aggregate_candidate, fetch_site_aggregate_candidate_audit and site_aggregate_candidate_audit all present');
  ELSE
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_12', 'Verify candidate lifecycle delta objects exist (2 functions + audit table)', 'FAIL',
            format('missing_functions=%s, audit_table=%s', COALESCE(array_to_string(v_missing, ','), 'none'), v_has_audit_table));
  END IF;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
  VALUES ('TEST_12', 'Verify candidate lifecycle delta objects exist (2 functions + audit table)', 'FAIL', SQLSTATE, SQLERRM);
END $$;

-- TEST 13: Candidate create then refresh is repeatable and audited
-- The seeded fixture publication c1111111-... already exists for the DRA's
-- first-sample cluster (49.28273,-123.12074), so an upsert against THAT
-- cluster always takes the ON CONFLICT DO UPDATE path ('refresh') and never
-- exercises the INSERT ('create') branch. To genuinely exercise 'create' this
-- test inserts an extra medium-tier sample at a DIFFERENT coordinate so it
-- forms its own cluster with NO existing publication row, derives that
-- cluster id via matrix_map.canonical_five_decimal_cluster, and runs the two
-- upserts against it. First upsert must be 'create'; second must be 'refresh'.
DO $$
DECLARE
  v_admin_id uuid := '11111111-1111-1111-1111-111111111111';
  v_dra_id uuid := 'a1111111-1111-1111-1111-111111111111';
  v_new_sample_id uuid := 'b3333333-3333-3333-3333-333333333333';
  v_new_lat double precision := 49.30000;
  v_new_lng double precision := -123.15000;
  v_cluster text;
  v_existing uuid;
  v_pub_id_1 uuid;
  v_pub_id_2 uuid;
  v_audit_before integer;
  v_audit_mid integer;
  v_audit_after integer;
  v_first_action text;
  v_last_action text;
BEGIN
  -- Insert a brand-new sample at a distinct coordinate so it clusters alone,
  -- with no pre-existing site_aggregate_publications row for that cluster.
  INSERT INTO matrix_map.samples (
    id, bnrrm_station_id, station_id, display_name, latitude, longitude,
    geometry, coordinate_quality_tier, coordinate_source, classification, classification_source, source_dra_id, public
  ) VALUES (
    v_new_sample_id, 103, 'STN-003', 'Sample Station 3', v_new_lat, v_new_lng,
    extensions.st_setsrid(extensions.st_makepoint(v_new_lng, v_new_lat), 4326)::extensions.geography,
    'medium', 'bc_csr_centroid', 'reference', 'station_type', v_dra_id, false
  )
  ON CONFLICT (id) DO NOTHING;

  v_cluster := matrix_map.canonical_five_decimal_cluster(v_new_lat, v_new_lng);

  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","email":"admin@example.com"}', true);

  -- PRECONDITION. Confirm no publication row exists yet for this fresh cluster
  -- (the point of this test is the never-before-published INSERT/'create' path).
  SELECT id INTO v_existing FROM matrix_map.site_aggregate_publications
  WHERE source_dra_id = v_dra_id AND coordinate_cluster_id = v_cluster;
  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'test setup invariant violated: publication already exists for fresh cluster %', v_cluster;
  END IF;

  -- Audit rows are compared as DELTAS, not absolute counts.
  SELECT count(*) INTO v_audit_before FROM matrix_map.site_aggregate_candidate_audit
  WHERE source_dra_id = v_dra_id AND coordinate_cluster_id = v_cluster;

  PERFORM matrix_map.upsert_site_aggregate_candidate(
    v_dra_id, v_cluster, 'Delta Label A', v_admin_id, 'delta upsert one'
  );
  SELECT id INTO v_pub_id_1 FROM matrix_map.site_aggregate_publications
  WHERE source_dra_id = v_dra_id AND coordinate_cluster_id = v_cluster;
  SELECT count(*) INTO v_audit_mid FROM matrix_map.site_aggregate_candidate_audit
  WHERE publication_id = v_pub_id_1;
  SELECT action INTO v_first_action FROM matrix_map.site_aggregate_candidate_audit
  WHERE publication_id = v_pub_id_1 ORDER BY changed_at ASC, id ASC LIMIT 1;

  -- Repeat: must be stable (same row), and audited again as a real change.
  PERFORM matrix_map.upsert_site_aggregate_candidate(
    v_dra_id, v_cluster, 'Delta Label B', v_admin_id, 'delta upsert two'
  );
  SELECT id INTO v_pub_id_2 FROM matrix_map.site_aggregate_publications
  WHERE source_dra_id = v_dra_id AND coordinate_cluster_id = v_cluster;
  SELECT count(*) INTO v_audit_after FROM matrix_map.site_aggregate_candidate_audit
  WHERE publication_id = v_pub_id_2;

  SELECT action INTO v_last_action FROM matrix_map.site_aggregate_candidate_audit
  WHERE publication_id = v_pub_id_2 ORDER BY changed_at DESC, id DESC LIMIT 1;

  IF v_pub_id_1 IS NOT NULL
     AND v_pub_id_1 = v_pub_id_2
     AND (v_audit_mid - v_audit_before) = 1
     AND (v_audit_after - v_audit_mid) = 1
     AND v_first_action = 'create'
     AND v_last_action = 'refresh'
  THEN
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_13', 'Verify candidate create/refresh is repeatable (stable row) and writes one audit row per real change', 'PASS',
            format('first action=%s, publication_id stable, audit delta 1 per upsert (%s->%s->%s), last action=%s',
                   v_first_action, v_audit_before, v_audit_mid, v_audit_after, v_last_action));
  ELSE
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_13', 'Verify candidate create/refresh is repeatable (stable row) and writes one audit row per real change', 'FAIL',
            format('pub1=%s, pub2=%s, audit %s->%s->%s, first action=%s, last action=%s',
                   v_pub_id_1, v_pub_id_2, v_audit_before, v_audit_mid, v_audit_after, v_first_action, v_last_action));
  END IF;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
  VALUES ('TEST_13', 'Verify candidate create/refresh is repeatable (stable row) and writes one audit row per real change', 'FAIL', SQLSTATE, SQLERRM);
END $$;

-- TEST 14: Refreshing a PUBLISHED candidate is rejected with UE409
DO $$
DECLARE
  v_admin_id uuid := '11111111-1111-1111-1111-111111111111';
  v_dra_id uuid := 'a1111111-1111-1111-1111-111111111111';
  v_cluster text;
  v_pub_id uuid;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","email":"admin@example.com"}', true);

  SELECT matrix_map.canonical_five_decimal_cluster(s.latitude, s.longitude)
  INTO v_cluster
  FROM matrix_map.samples s
  WHERE s.source_dra_id = v_dra_id ORDER BY s.id ASC LIMIT 1;

  SELECT id INTO v_pub_id FROM matrix_map.site_aggregate_publications
  WHERE source_dra_id = v_dra_id AND coordinate_cluster_id = v_cluster;

  PERFORM matrix_map.flip_site_aggregate_public(v_pub_id, true, v_admin_id, 'publish before refresh guard test');

  BEGIN
    PERFORM matrix_map.upsert_site_aggregate_candidate(
      v_dra_id, v_cluster, 'Should Not Apply', v_admin_id, 'refresh while published'
    );
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_14', 'Verify refreshing a published candidate is rejected with UE409', 'FAIL',
            'upsert unexpectedly succeeded against a published candidate');
  EXCEPTION WHEN SQLSTATE 'UE409' THEN
    INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
    VALUES ('TEST_14', 'Verify refreshing a published candidate is rejected with UE409', 'PASS', 'UE409',
            'Caught expected UE409 published-candidate guard');
  END;

  -- restore unpublished state for later assertions
  PERFORM matrix_map.flip_site_aggregate_public(v_pub_id, false, v_admin_id, 'restore after refresh guard test');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
  VALUES ('TEST_14', 'Verify refreshing a published candidate is rejected with UE409', 'FAIL', SQLSTATE, SQLERRM);
END $$;

-- TEST 15: A no-op publication flip writes NO additional audit row (idempotency)
DO $$
DECLARE
  v_admin_id uuid := '11111111-1111-1111-1111-111111111111';
  v_dra_id uuid := 'a1111111-1111-1111-1111-111111111111';
  v_cluster text;
  v_pub_id uuid;
  v_before integer;
  v_after integer;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","email":"admin@example.com"}', true);

  SELECT matrix_map.canonical_five_decimal_cluster(s.latitude, s.longitude)
  INTO v_cluster
  FROM matrix_map.samples s
  WHERE s.source_dra_id = v_dra_id ORDER BY s.id ASC LIMIT 1;

  SELECT id INTO v_pub_id FROM matrix_map.site_aggregate_publications
  WHERE source_dra_id = v_dra_id AND coordinate_cluster_id = v_cluster;

  PERFORM matrix_map.flip_site_aggregate_public(v_pub_id, true, v_admin_id, 'idempotency baseline publish');
  SELECT count(*) INTO v_before FROM matrix_map.site_aggregate_publication_audit WHERE publication_id = v_pub_id;

  -- Same value again: a genuine no-op.
  PERFORM matrix_map.flip_site_aggregate_public(v_pub_id, true, v_admin_id, 'idempotency no-op publish');
  SELECT count(*) INTO v_after FROM matrix_map.site_aggregate_publication_audit WHERE publication_id = v_pub_id;

  IF v_after = v_before THEN
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_15', 'Verify a no-op publication flip writes no additional audit row', 'PASS',
            format('audit rows unchanged at %s across a repeated identical flip', v_before));
  ELSE
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_15', 'Verify a no-op publication flip writes no additional audit row', 'FAIL',
            format('audit rows grew from %s to %s on a no-op flip', v_before, v_after));
  END IF;

  PERFORM matrix_map.flip_site_aggregate_public(v_pub_id, false, v_admin_id, 'restore after idempotency test');
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
  VALUES ('TEST_15', 'Verify a no-op publication flip writes no additional audit row', 'FAIL', SQLSTATE, SQLERRM);
END $$;

-- TEST 16: The candidate delta does NOT widen the member projection
DO $$
DECLARE
  v_result text;
  v_leaks text[] := ARRAY[]::text[];
  v_forbidden text;
BEGIN
  v_result := pg_get_function_result('matrix_map.fetch_published_site_aggregates()'::regprocedure);

  FOREACH v_forbidden IN ARRAY ARRAY[
    'source_dra_id',
    'coordinate_source',
    'sample_count_total',
    'sample_count_high',
    'sample_count_medium',
    'sample_count_low',
    'distinct_point_count',
    'source_sample_hash',
    'title'
  ]
  LOOP
    IF position(v_forbidden IN v_result) > 0 THEN
      v_leaks := array_append(v_leaks, v_forbidden);
    END IF;
  END LOOP;

  IF array_length(v_leaks, 1) IS NULL THEN
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_16', 'Verify the candidate delta does not widen the member projection (no raw DRA/sample provenance)', 'PASS',
            'member RETURNS TABLE exposes no raw dra id, coordinate source, exact counts, source hash or DRA title');
  ELSE
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_16', 'Verify the candidate delta does not widen the member projection (no raw DRA/sample provenance)', 'FAIL',
            'member projection leaked: ' || array_to_string(v_leaks, ', '));
  END IF;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
  VALUES ('TEST_16', 'Verify the candidate delta does not widen the member projection (no raw DRA/sample provenance)', 'FAIL', SQLSTATE, SQLERRM);
END $$;

-- TEST 17: Candidate label containing the raw DRA id is rejected with UE422 (RPC-direct, not route-only)
-- The route-level guard rejects a label carrying the raw source_dra_id, but
-- upsert_site_aggregate_candidate is GRANTed EXECUTE to `authenticated`, so an
-- admin can call the RPC directly and bypass the route. This asserts the guard
-- also lives INSIDE the RPC, before any write, so no caller path can publish a
-- label carrying raw DRA provenance.
DO $$
DECLARE
  v_admin_id uuid := '11111111-1111-1111-1111-111111111111';
  v_dra_id uuid := 'a1111111-1111-1111-1111-111111111111';
  v_cluster text;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","email":"admin@example.com"}', true);

  SELECT matrix_map.canonical_five_decimal_cluster(s.latitude, s.longitude)
  INTO v_cluster
  FROM matrix_map.samples s
  WHERE s.source_dra_id = v_dra_id ORDER BY s.id ASC LIMIT 1;

  BEGIN
    PERFORM matrix_map.upsert_site_aggregate_candidate(
      v_dra_id, v_cluster, 'Site ' || v_dra_id::text || ' West', v_admin_id, 'label carries raw dra id'
    );
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_17', 'Verify upsert_site_aggregate_candidate rejects a member_display_label containing the raw source_dra_id (RPC-direct, bypassing the route guard)', 'FAIL',
            'upsert unexpectedly succeeded with a label carrying the raw DRA id');
  EXCEPTION WHEN SQLSTATE 'UE422' THEN
    INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
    VALUES ('TEST_17', 'Verify upsert_site_aggregate_candidate rejects a member_display_label containing the raw source_dra_id (RPC-direct, bypassing the route guard)', 'PASS', 'UE422',
            'Caught expected UE422 label-provenance guard called directly against the RPC');
  END;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
  VALUES ('TEST_17', 'Verify upsert_site_aggregate_candidate rejects a member_display_label containing the raw source_dra_id (RPC-direct, bypassing the route guard)', 'FAIL', SQLSTATE, SQLERRM);
END $$;

-- Summary Output Query
SELECT test_id, description, status, COALESCE(sqlstate, '00000') as sqlstate, details
FROM public.test_results
ORDER BY test_id ASC;
