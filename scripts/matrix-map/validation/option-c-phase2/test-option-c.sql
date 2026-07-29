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

-- TEST 03: unguarded-bare-CREATE collision verification.
--
-- SCOPE, stated precisely so this is not misread: the statement executed below
-- is an AD-HOC bare CREATE FUNCTION written by this test. It is NOT the
-- migration's own statement. The migration guards its create with
-- `DROP FUNCTION IF EXISTS ... RESTRICT` and IS reapply-safe (proved by
-- REAPPLY_01); this test does NOT claim otherwise.
--
-- What it does prove, and why that still matters: the helper is SECURITY
-- DEFINER and owned by postgres, so an unguarded attempt to redefine it must
-- FAIL LOUDLY (42723 duplicate_function) rather than silently swap the body of
-- a privileged definer function. That is exactly the property the negative
-- assertion in site-aggregate-publication-migration.test.ts pins by forbidding
-- CREATE OR REPLACE, and it is why the migration uses DROP-then-CREATE instead
-- of CREATE OR REPLACE.
DO $$
BEGIN
  BEGIN
    EXECUTE 'CREATE FUNCTION matrix_map.lock_site_aggregate_publication_sources() RETURNS void LANGUAGE plpgsql AS $f$ BEGIN NULL; END; $f$;';
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_03', 'Verify an UNGUARDED direct bare CREATE FUNCTION against the already-installed lock helper COLLIDES with 42723 duplicate_function instead of silently replacing the privileged SECURITY DEFINER body. This probes the ad-hoc statement executed here, NOT the migration file, which guards its own bare CREATE with DROP FUNCTION IF EXISTS ... RESTRICT and is therefore reapply-safe', 'FAIL', 'CREATE FUNCTION succeeded without error when function already existed');
  EXCEPTION WHEN duplicate_function THEN
    INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
    VALUES ('TEST_03', 'Verify an UNGUARDED direct bare CREATE FUNCTION against the already-installed lock helper COLLIDES with 42723 duplicate_function instead of silently replacing the privileged SECURITY DEFINER body. This probes the ad-hoc statement executed here, NOT the migration file, which guards its own bare CREATE with DROP FUNCTION IF EXISTS ... RESTRICT and is therefore reapply-safe', 'PASS', SQLSTATE, 'Caught expected 42723 duplicate_function exception');
  WHEN OTHERS THEN
    INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
    VALUES ('TEST_03', 'Verify an UNGUARDED direct bare CREATE FUNCTION against the already-installed lock helper COLLIDES with 42723 duplicate_function instead of silently replacing the privileged SECURITY DEFINER body. This probes the ad-hoc statement executed here, NOT the migration file, which guards its own bare CREATE with DROP FUNCTION IF EXISTS ... RESTRICT and is therefore reapply-safe', 'FAIL', SQLSTATE, 'Caught unexpected exception: ' || SQLERRM);
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
      'c1111111-1111-1111-1111-111111111111', true, '11111111-1111-1111-1111-111111111111', 'Isolation Test',
      (SELECT updated_at FROM matrix_map.site_aggregate_publications WHERE id = 'c1111111-1111-1111-1111-111111111111')
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
    v_pub_id, true, v_admin_id, 'Owner approved publication for site 3250', (SELECT updated_at FROM matrix_map.site_aggregate_publications WHERE id = v_pub_id)
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
  PERFORM matrix_map.flip_site_aggregate_public(v_pub_id, false, v_admin_id, 'Retracting publication', NULL);
  SELECT is_published INTO v_is_pub FROM matrix_map.site_aggregate_publications WHERE id = v_pub_id;
  SELECT * INTO v_audit_row FROM matrix_map.site_aggregate_publication_audit WHERE publication_id = v_pub_id ORDER BY changed_at DESC LIMIT 1;

  IF v_is_pub IS NOT FALSE OR v_audit_row.new_value IS NOT FALSE OR v_audit_row.reason != 'Retracting publication' THEN
    RAISE EXCEPTION 'Unpublish or its audit row failed';
  END IF;

  -- Restore to true for subsequent tests
  PERFORM matrix_map.flip_site_aggregate_public(v_pub_id, true, v_admin_id, 'Re-publishing', (SELECT updated_at FROM matrix_map.site_aggregate_publications WHERE id = v_pub_id));

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

  SELECT * INTO v_row FROM matrix_map.fetch_published_site_aggregates(1000, 0) LIMIT 1;

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

  PERFORM matrix_map.flip_site_aggregate_public(v_pub_id, true, v_admin_id, 'publish before refresh guard test', (SELECT updated_at FROM matrix_map.site_aggregate_publications WHERE id = v_pub_id));

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
  PERFORM matrix_map.flip_site_aggregate_public(v_pub_id, false, v_admin_id, 'restore after refresh guard test', NULL);
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

  PERFORM matrix_map.flip_site_aggregate_public(v_pub_id, true, v_admin_id, 'idempotency baseline publish', (SELECT updated_at FROM matrix_map.site_aggregate_publications WHERE id = v_pub_id));
  SELECT count(*) INTO v_before FROM matrix_map.site_aggregate_publication_audit WHERE publication_id = v_pub_id;

  -- Same value again: a genuine no-op.
  PERFORM matrix_map.flip_site_aggregate_public(v_pub_id, true, v_admin_id, 'idempotency no-op publish', (SELECT updated_at FROM matrix_map.site_aggregate_publications WHERE id = v_pub_id));
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

  PERFORM matrix_map.flip_site_aggregate_public(v_pub_id, false, v_admin_id, 'restore after idempotency test', NULL);
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
  v_result := pg_get_function_result('matrix_map.fetch_published_site_aggregates(integer, integer)'::regprocedure);

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

-- ---------------------------------------------------------------------------
-- RESTACK CORRECTION DELTA (TEST_18 .. TEST_22)
-- Added by the restack branch to cover 4 accepted review findings against the
-- candidate lifecycle delta: audit completeness (FIX 1), the concurrent
-- first-create classification race (FIX 2), the bypassable label privacy
-- guard (FIX 5), and the candidate-audit publication_id invariant (FIX 9).
-- ---------------------------------------------------------------------------

-- TEST 18: Genuine two-backend concurrent candidate create/refresh race is
-- correctly serialized to exactly one create + one refresh (FIX 2).
--
-- REWRITTEN AGAIN under third-review-round finding (accepted P2): the prior
-- rewrite (R2-FIX-2) forced a real held-open-transaction race but only
-- confirmed Y was "busy" via dblink_is_busy, which merely proves Y has not
-- RETURNED yet -- for ANY reason (ordinary scheduling delay under load, or
-- blocking on the `INSERT ... ON CONFLICT` row-level wait rather than the
-- advisory lock). Y could in principle still be "busy" through the whole
-- barrier window without ever having reached pg_advisory_xact_lock at all,
-- then proceed once X commits and classify itself 'refresh' by coincidence.
-- Timing coincidence is not proof of serialization; that version could still
-- pass even with pg_advisory_xact_lock deleted from
-- upsert_site_aggregate_candidate.
--
-- This version proves Y is waiting on THE ADVISORY LOCK SPECIFICALLY, by
-- reading pg_locks directly (from a THIRD, independent backend -- this local
-- session, distinct from both conc_x and conc_y):
--   1. Capture each dblink connection's own backend PID via
--      `SELECT pg_backend_pid()` over that connection, BEFORE dispatching
--      the racing calls.
--   2. Compute the SAME advisory lock key the production RPC uses:
--      matrix_map.upsert_site_aggregate_candidate calls
--        pg_advisory_xact_lock(hashtextextended(p_source_dra_id::text || ':' || p_coordinate_cluster_id, 0))
--      (confirmed against the current definition in
--      docs/design/matrix-map/OPTION_C_PHASE2_SITE_AGGREGATE_PUBLICATIONS_DRAFT_2026_07_24.sql,
--      which this suite is not permitted to edit). This test computes the
--      identical hashtextextended() key from the same natural key.
--   3. pg_advisory_xact_lock(bigint) records the key in pg_locks as
--      classid = high 32 bits, objid = low 32 bits, objsubid = 1. This is
--      NOT assumed from documentation -- it was verified empirically against
--      the ACTUAL pg_locks catalog on this same postgis image (the family
--      this replay runs against) immediately before writing this test: a
--      held pg_advisory_xact_lock(123456789012345) produced pg_locks row
--      (classid=28744, objid=2249056121, objsubid=1, granted=true), matching
--      (123456789012345 >> 32, 123456789012345 & 4294967295) exactly; and,
--      because a naive signed `>>` on a bigint whose high 32 bits have the
--      sign bit set sign-extends (verified with a second held lock on key
--      X'8000000500000007'::bit(64)::bigint, where a naive `>> 32` yielded
--      -2147483643 but pg_locks.classid was the unsigned 2147483653), this
--      test masks the shifted high bits with `& 4294967295` to get the same
--      unsigned 32-bit value pg_locks stores, rather than assuming the shift
--      alone is safe.
--   4. Poll pg_locks (queried from this local session) requiring, in the
--      SAME poll iteration: (a) an UNGRANTED advisory row for Y's captured
--      PID whose classid/objid/objsubid match the computed key exactly, AND
--      (b) simultaneously, a GRANTED advisory row for X's captured PID on
--      that identical key (proving X's transaction has not ended and is the
--      thing Y is actually waiting on, not some other lock), AND (c)
--      dblink_is_busy(Y) still true at that same moment (proving Y has not
--      returned a result -- a completion check here, not the barrier itself).
--      Only once all three hold simultaneously is the serialization boundary
--      considered proven.
--   5. ONLY after that specific combination is observed does the test COMMIT
--      X (releasing the row + the advisory lock) and reap Y's result.
--   6. If the combination is not observed within a bounded number of polls,
--      the test FAILS LOUDLY ("serialization boundary never observed")
--      instead of falling through to a timing-based pass. If Y is instead
--      observed waiting on some OTHER lock/type (e.g. the row-level
--      `INSERT ... ON CONFLICT` wait it would take without the advisory
--      lock), that specific unexpected locktype/mode/key is named in the
--      failure detail rather than being silently retried into a generic
--      timeout.
--   7. Assert exactly one 'create' + one 'refresh' audit row, and that Y's
--      own audit action is specifically 'refresh' (X's is necessarily
--      'create', since it ran first).
--
-- HOW THIS TEST WOULD FAIL WITHOUT THE ADVISORY LOCK: with
-- pg_advisory_xact_lock removed from the RPC, Y's own pre-insert
-- `SELECT ... FOR UPDATE` runs under read committed and cannot see X's
-- uncommitted INSERT, so Y would still classify v_action := 'create' with
-- prior_snapshot = NULL, exactly like X did. Y would then reach its own
-- `INSERT ... ON CONFLICT DO UPDATE` statement, which DOES block on X's
-- uncommitted row, but that is a transactionid/tuple wait on the target row,
-- NOT an advisory-lock wait on the computed hashtextextended key -- so
-- step 4's required pg_locks row (locktype='advisory', matching
-- classid/objid/objsubid) would never appear for Y, and this test would FAIL
-- at step 6 ("serialization boundary never observed" or a named-mismatch
-- detail) rather than passing by timing coincidence. This was REASONED
-- through the RPC's SQL and PostgreSQL's documented lock-wait behavior; see
-- the closing report for whether an actual negative-control mutation run
-- (lock line commented out in a throwaway copy) was additionally performed,
-- versus this reasoning standing alone as REASONED EVIDENCE only.
--
-- If dblink is unavailable in the replay image, this SKIPs rather than
-- faking a pass.
-- Bootstrap sub-block: create the dblink extension (or record SKIP and stop).
-- Split out as its own DO block so this decision -- and the extension object
-- itself -- is committed before anything else runs.
DO $$
DECLARE
  v_dblink_ok boolean := true;
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS dblink;
  EXCEPTION WHEN OTHERS THEN
    v_dblink_ok := false;
  END;

  IF NOT v_dblink_ok THEN
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_18', 'Verify a genuine two-backend concurrent candidate create/refresh race serializes to exactly one create + one refresh (FIX 2)', 'SKIP',
      'dblink extension unavailable in this environment; a true two-session case for upsert_site_aggregate_candidate must be added to the harness .ps1 Start-Job pattern, which this suite was not permitted to edit');
  END IF;
END $$;

-- Fixture sample for the fresh race cluster. Deliberately a SEPARATE top-level
-- statement (not inside the DO block below) so it is auto-committed BEFORE
-- the dblink race runs. The two dblink connections opened below are genuinely
-- separate backend PROCESSES with their own read-committed transactions --
-- had this INSERT stayed inside the same transaction as the dblink dispatch,
-- neither remote backend could see it yet (an earlier revision hit exactly
-- this: both concurrent calls failed "snapshot is empty" because the sample
-- was still uncommitted in the local session's own transaction).
INSERT INTO matrix_map.samples (
  id, bnrrm_station_id, station_id, display_name, latitude, longitude,
  geometry, coordinate_quality_tier, coordinate_source, classification, classification_source, source_dra_id, public
) VALUES (
  'b5555555-5555-5555-5555-555555555555', 105, 'STN-005', 'Sample Station 5', 49.33000, -123.19000,
  extensions.st_setsrid(extensions.st_makepoint(-123.19000::double precision, 49.33000::double precision), 4326)::extensions.geography,
  'medium', 'bc_csr_centroid', 'reference', 'station_type', 'a1111111-1111-1111-1111-111111111111', false
)
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE
  v_admin_id uuid := '11111111-1111-1111-1111-111111111111';
  v_dra_id uuid := 'a1111111-1111-1111-1111-111111111111';
  v_new_lat double precision := 49.33000;
  v_new_lng double precision := -123.19000;
  v_cluster text;
  v_dblink_ok boolean;
  v_res_x integer;
  v_res_y integer;
  v_pub_count integer;
  v_create_count integer;
  v_refresh_count integer;
  v_y_action text;
  v_x_action text;
  v_existing uuid;
  v_claims_json text;
  v_i integer;
  v_lock_key bigint;
  v_lock_classid bigint;
  v_lock_objid bigint;
  v_x_pid integer;
  v_y_pid integer;
  v_barrier_observed boolean;
  v_x_still_granted boolean;
  v_y_still_busy boolean;
  v_wait_locktype text;
  v_wait_mode text;
  v_wait_classid bigint;
  v_wait_objid bigint;
  v_wait_objsubid smallint;
  v_mismatch_detail text;
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'dblink') INTO v_dblink_ok;
  IF NOT v_dblink_ok THEN
    -- Bootstrap block above already recorded the SKIP result.
    RETURN;
  END IF;

  v_cluster := matrix_map.canonical_five_decimal_cluster(v_new_lat, v_new_lng);

  SELECT id INTO v_existing FROM matrix_map.site_aggregate_publications
  WHERE source_dra_id = v_dra_id AND coordinate_cluster_id = v_cluster;
  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'test setup invariant violated: publication already exists for fresh concurrency cluster %', v_cluster;
  END IF;

  -- Compute the SAME advisory lock key the production RPC computes (see the
  -- header comment above this test for the exact expression + the empirical
  -- verification of the classid/objid/objsubid encoding it produces).
  v_lock_key := hashtextextended(v_dra_id::text || ':' || v_cluster, 0);
  v_lock_classid := (v_lock_key >> 32) & 4294967295;
  v_lock_objid := v_lock_key & 4294967295;

  v_claims_json := format('{"sub":"%s","email":"admin@example.com"}', v_admin_id);

  PERFORM dblink_connect('conc_x', 'dbname=sstac_replay user=postgres');
  PERFORM dblink_connect('conc_y', 'dbname=sstac_replay user=postgres');

  -- dblink_exec rejects any remote command that returns a result set ("statement
  -- returning results not allowed"), and `SELECT set_config(...)` returns one --
  -- use a plain SET command instead, which returns no rows and still persists
  -- for the life of this dblink connection (session-scope, matching is_local=false).
  PERFORM dblink_exec('conc_x', format('SET request.jwt.claims = %L', v_claims_json));
  PERFORM dblink_exec('conc_y', format('SET request.jwt.claims = %L', v_claims_json));

  -- Capture each dblink connection's own backend PID BEFORE dispatching the
  -- racing calls, so the pg_locks predicate below can be scoped to the exact
  -- backend process rather than inferred from timing.
  SELECT p.pid INTO v_x_pid FROM dblink('conc_x', 'SELECT pg_backend_pid()') AS p(pid integer);
  SELECT p.pid INTO v_y_pid FROM dblink('conc_y', 'SELECT pg_backend_pid()') AS p(pid integer);

  -- STEP 1: open an explicit transaction on X and run the upsert to
  -- completion (reaped below), but DO NOT COMMIT. The row is inserted and the
  -- advisory xact lock for this natural key is held by X's open transaction;
  -- neither is visible/released until X commits below.
  PERFORM dblink_exec('conc_x', 'BEGIN');
  PERFORM dblink_send_query('conc_x', format(
    $q$SELECT 1 FROM (SELECT matrix_map.upsert_site_aggregate_candidate(%L::uuid, %L, %L, %L::uuid, %L)) s$q$,
    v_dra_id, v_cluster, 'Concurrent Label X', v_admin_id, 'concurrent create race X'));
  SELECT t.r INTO v_res_x FROM dblink_get_result('conc_x') AS t(r integer);
  -- dblink_get_result must be called until it returns no rows to fully clear
  -- the connection's async command state -- otherwise a LATER command on
  -- this same connection (the COMMIT below) fails with "another command is
  -- already in progress". This second call drains the trailing empty marker.
  PERFORM 1 FROM dblink_get_result('conc_x') AS t(r integer);

  -- STEP 2: dispatch Y asynchronously against the SAME natural key while X's
  -- transaction (and its advisory lock + uncommitted row) is still open.
  PERFORM dblink_send_query('conc_y', format(
    $q$SELECT 1 FROM (SELECT matrix_map.upsert_site_aggregate_candidate(%L::uuid, %L, %L, %L::uuid, %L)) s$q$,
    v_dra_id, v_cluster, 'Concurrent Label Y', v_admin_id, 'concurrent create race Y'));

  -- STEP 3: prove the serialization boundary directly via pg_locks, queried
  -- from THIS local session (a third backend, independent of conc_x/conc_y).
  -- Require, in the SAME poll iteration:
  --   (a) an UNGRANTED advisory-lock row for Y's captured PID whose
  --       classid/objid/objsubid match the computed key exactly;
  --   (b) a GRANTED advisory-lock row for X's captured PID on that SAME key,
  --       proving X's transaction has not ended and IS the thing Y is
  --       waiting on;
  --   (c) dblink_is_busy(Y) still true at that same moment, proving Y has
  --       not returned a result (a completion check here, not the barrier
  --       itself).
  v_barrier_observed := false;
  v_mismatch_detail := NULL;
  FOR v_i IN 1..40 LOOP
    v_wait_locktype := NULL;
    SELECT locktype, mode, classid::bigint, objid::bigint, objsubid
      INTO v_wait_locktype, v_wait_mode, v_wait_classid, v_wait_objid, v_wait_objsubid
    FROM pg_locks
    WHERE pid = v_y_pid AND granted = false
    ORDER BY objid
    LIMIT 1;

    IF v_wait_locktype = 'advisory' AND v_wait_classid = v_lock_classid
       AND v_wait_objid = v_lock_objid AND v_wait_objsubid = 1 THEN
      SELECT EXISTS (
        SELECT 1 FROM pg_locks
        WHERE pid = v_x_pid AND locktype = 'advisory' AND granted = true
          AND classid::bigint = v_lock_classid AND objid::bigint = v_lock_objid AND objsubid = 1
      ) INTO v_x_still_granted;

      IF v_x_still_granted THEN
        v_y_still_busy := (dblink_is_busy('conc_y') <> 0);
        IF v_y_still_busy THEN
          v_barrier_observed := true;
          EXIT;
        END IF;
      END IF;
    ELSIF v_wait_locktype IS NOT NULL THEN
      -- Y is waiting, but not (yet, or ever) on the expected advisory key --
      -- record what it actually is so a genuine mismatch is diagnosable
      -- rather than silently retried into an unlabeled timeout. Kept as the
      -- LATEST observed mismatch (not appended) since only the final
      -- pre-timeout state matters for the failure detail.
      v_mismatch_detail := format('Y (pid %s) observed waiting on locktype=%s mode=%s classid=%s objid=%s objsubid=%s, expected advisory classid=%s objid=%s objsubid=1',
        v_y_pid, v_wait_locktype, v_wait_mode, v_wait_classid, v_wait_objid, v_wait_objsubid, v_lock_classid, v_lock_objid);
    END IF;

    PERFORM pg_sleep(0.25);
  END LOOP;

  IF NOT v_barrier_observed THEN
    -- The serialization boundary was never proven: either Y's ungranted
    -- advisory-lock row never appeared with X's matching granted row still
    -- held (timeout), or Y was seen waiting on something else entirely
    -- (named mismatch). Fail loudly rather than falling through to the old
    -- timing-based path; this run cannot demonstrate anything about the
    -- advisory lock.
    BEGIN PERFORM dblink_exec('conc_x', 'COMMIT'); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN SELECT t.r INTO v_res_y FROM dblink_get_result('conc_y') AS t(r integer); EXCEPTION WHEN OTHERS THEN v_res_y := NULL; END;
    BEGIN PERFORM 1 FROM dblink_get_result('conc_y') AS t(r integer); EXCEPTION WHEN OTHERS THEN NULL; END;
    PERFORM dblink_disconnect('conc_x');
    PERFORM dblink_disconnect('conc_y');
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_18', 'Verify a genuine two-backend concurrent candidate create/refresh race serializes to exactly one create + one refresh (FIX 2)', 'FAIL',
      COALESCE(v_mismatch_detail,
        format('serialization boundary never observed: no ungranted advisory-lock row for Y (pid %s) on key classid=%s objid=%s objsubid=1, with X (pid %s) simultaneously holding it granted, appeared within the poll window',
               v_y_pid, v_lock_classid, v_lock_objid, v_x_pid)));
    RETURN;
  END IF;

  -- STEP 4: only now release X (COMMIT), which releases both the row and the
  -- advisory lock; then reap Y's now-unblocked result.
  PERFORM dblink_exec('conc_x', 'COMMIT');
  SELECT t.r INTO v_res_y FROM dblink_get_result('conc_y') AS t(r integer);
  PERFORM 1 FROM dblink_get_result('conc_y') AS t(r integer);

  PERFORM dblink_disconnect('conc_x');
  PERFORM dblink_disconnect('conc_y');

  SELECT count(*) INTO v_pub_count FROM matrix_map.site_aggregate_publications
  WHERE source_dra_id = v_dra_id AND coordinate_cluster_id = v_cluster;

  SELECT count(*) INTO v_create_count FROM matrix_map.site_aggregate_candidate_audit
  WHERE source_dra_id = v_dra_id AND coordinate_cluster_id = v_cluster AND action = 'create';

  SELECT count(*) INTO v_refresh_count FROM matrix_map.site_aggregate_candidate_audit
  WHERE source_dra_id = v_dra_id AND coordinate_cluster_id = v_cluster AND action = 'refresh';

  -- STEP 5: X ran first and completed before Y was even dispatched, so X's
  -- action must be 'create'; Y -- forced to wait for X's commit -- must
  -- observe the now-committed row and record 'refresh'.
  SELECT action INTO v_x_action FROM matrix_map.site_aggregate_candidate_audit
  WHERE source_dra_id = v_dra_id AND coordinate_cluster_id = v_cluster
  ORDER BY changed_at ASC, id ASC LIMIT 1;

  SELECT action INTO v_y_action FROM matrix_map.site_aggregate_candidate_audit
  WHERE source_dra_id = v_dra_id AND coordinate_cluster_id = v_cluster
  ORDER BY changed_at DESC, id DESC LIMIT 1;

  IF v_pub_count = 1 AND v_create_count = 1 AND v_refresh_count = 1
     AND v_x_action = 'create' AND v_y_action = 'refresh' THEN
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_18', 'Verify a genuine two-backend concurrent candidate create/refresh race serializes to exactly one create + one refresh (FIX 2)', 'PASS',
      format('advisory-lock barrier proven via pg_locks (Y pid %s ungranted on classid=%s/objid=%s/objsubid=1 while X pid %s held it granted, and Y still busy); after X committed: 1 publication row, first action=%s (X), second action=%s (Y), x=%s, y=%s',
             v_y_pid, v_lock_classid, v_lock_objid, v_x_pid, v_x_action, v_y_action, v_res_x, v_res_y));
  ELSE
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_18', 'Verify a genuine two-backend concurrent candidate create/refresh race serializes to exactly one create + one refresh (FIX 2)', 'FAIL',
      format('barrier was proven via pg_locks but end-state assertions failed: pub_count=%s (exp 1), create_count=%s (exp 1), refresh_count=%s (exp 1), x_action=%s (exp create), y_action=%s (exp refresh); x=%s, y=%s',
             v_pub_count, v_create_count, v_refresh_count, v_x_action, v_y_action, v_res_x, v_res_y));
  END IF;
EXCEPTION WHEN OTHERS THEN
  BEGIN PERFORM dblink_disconnect('conc_x'); EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN PERFORM dblink_disconnect('conc_y'); EXCEPTION WHEN OTHERS THEN NULL; END;
  INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
  VALUES ('TEST_18', 'Verify a genuine two-backend concurrent candidate create/refresh race serializes to exactly one create + one refresh (FIX 2)', 'FAIL', SQLSTATE, SQLERRM);
END $$;

-- TEST 19: Candidate label guard rejects canonical, compact, mixed-case, and
-- brace-wrapped renderings of the raw source_dra_id, called directly against
-- the RPC (FIX 5).
DO $$
DECLARE
  v_admin_id uuid := '11111111-1111-1111-1111-111111111111';
  v_dra_id uuid := 'a1111111-1111-1111-1111-111111111111';
  v_cluster text;
  v_dra_text text := v_dra_id::text;
  v_compact text;
  v_variant text;
  v_failures text[] := ARRAY[]::text[];
  v_variants text[];
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","email":"admin@example.com"}', true);

  SELECT matrix_map.canonical_five_decimal_cluster(s.latitude, s.longitude)
  INTO v_cluster
  FROM matrix_map.samples s
  WHERE s.source_dra_id = v_dra_id ORDER BY s.id ASC LIMIT 1;

  v_compact := replace(v_dra_text, '-', '');

  v_variants := ARRAY[
    'Site ' || v_dra_text || ' West',
    'Site ' || v_compact || ' West',
    'Site ' || upper(v_dra_text) || ' West',
    'Site {' || v_dra_text || '} West'
  ];

  FOREACH v_variant IN ARRAY v_variants
  LOOP
    BEGIN
      PERFORM matrix_map.upsert_site_aggregate_candidate(
        v_dra_id, v_cluster, v_variant, v_admin_id, 'label privacy variant test'
      );
      v_failures := array_append(v_failures, 'NOT REJECTED: ' || v_variant);
    EXCEPTION WHEN SQLSTATE 'UE422' THEN
      NULL; -- expected
    END;
  END LOOP;

  IF array_length(v_failures, 1) IS NULL THEN
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_19', 'Verify candidate label guard rejects canonical, compact, mixed-case, and brace-wrapped raw-DRA-id renderings (FIX 5)', 'PASS',
            'all 4 renderings rejected with UE422');
  ELSE
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_19', 'Verify candidate label guard rejects canonical, compact, mixed-case, and brace-wrapped raw-DRA-id renderings (FIX 5)', 'FAIL',
            array_to_string(v_failures, ' | '));
  END IF;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
  VALUES ('TEST_19', 'Verify candidate label guard rejects canonical, compact, mixed-case, and brace-wrapped raw-DRA-id renderings (FIX 5)', 'FAIL', SQLSTATE, SQLERRM);
END $$;

-- TEST 20: An innocuous label sharing only a few hex characters with the raw
-- DRA id is NOT rejected -- the FIX 5 guard must not be overbroad.
DO $$
DECLARE
  v_admin_id uuid := '11111111-1111-1111-1111-111111111111';
  v_dra_id uuid := 'a1111111-1111-1111-1111-111111111111';
  v_new_sample_id uuid := 'b6666666-6666-6666-6666-666666666666';
  v_new_lat double precision := 49.34000;
  v_new_lng double precision := -123.20000;
  v_cluster text;
  v_label text := 'Site a111 West Reach';
  v_audit_count integer;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","email":"admin@example.com"}', true);

  INSERT INTO matrix_map.samples (
    id, bnrrm_station_id, station_id, display_name, latitude, longitude,
    geometry, coordinate_quality_tier, coordinate_source, classification, classification_source, source_dra_id, public
  ) VALUES (
    v_new_sample_id, 106, 'STN-006', 'Sample Station 6', v_new_lat, v_new_lng,
    extensions.st_setsrid(extensions.st_makepoint(v_new_lng, v_new_lat), 4326)::extensions.geography,
    'medium', 'bc_csr_centroid', 'reference', 'station_type', v_dra_id, false
  )
  ON CONFLICT (id) DO NOTHING;

  v_cluster := matrix_map.canonical_five_decimal_cluster(v_new_lat, v_new_lng);

  PERFORM matrix_map.upsert_site_aggregate_candidate(
    v_dra_id, v_cluster, v_label, v_admin_id, 'innocuous label acceptance test'
  );

  SELECT count(*) INTO v_audit_count FROM matrix_map.site_aggregate_candidate_audit
  WHERE source_dra_id = v_dra_id AND coordinate_cluster_id = v_cluster AND action = 'create';

  IF v_audit_count = 1 THEN
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_20', 'Verify an innocuous label sharing only a few hex chars with the raw DRA id is accepted, not rejected (FIX 5 is not overbroad)', 'PASS',
            format('label "%s" accepted; candidate created', v_label));
  ELSE
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_20', 'Verify an innocuous label sharing only a few hex chars with the raw DRA id is accepted, not rejected (FIX 5 is not overbroad)', 'FAIL',
            format('expected 1 create audit row, found %s', v_audit_count));
  END IF;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
  VALUES ('TEST_20', 'Verify an innocuous label sharing only a few hex chars with the raw DRA id is accepted, not rejected (FIX 5 is not overbroad)', 'FAIL', SQLSTATE, SQLERRM);
END $$;

-- TEST 21: Candidate audit new_snapshot (create + refresh) and prior_snapshot
-- (refresh) capture the COMPLETE persisted publication row, not just
-- member_display_label (FIX 1 production behavior; R2-FIX-3 test hardening,
-- accepted P2).
--
-- REWRITTEN under second-review-round finding R2-FIX-3: the prior version of
-- this test inspected only member_display_label three times and claimed that
-- proved the "full" row was captured -- a regression that truncated the
-- stored snapshots down to JUST the label would still have passed. This
-- version captures the COMPLETE persisted row as JSON, independently of the
-- RPC, at each point in time, and compares those whole objects against the
-- audit table's prior_snapshot/new_snapshot verbatim (to_jsonb equality, not
-- a single-key comparison).
--
-- No columns are excluded from the comparison, and here is why none are
-- needed: both the audit table's snapshot and this test's independently
-- captured "external" snapshot are reads of the SAME static, already-written
-- row (nothing recomputes a value between the two reads -- e.g. updated_at is
-- a stored column, not derived at SELECT time), and this test runs serially
-- within one session, so no concurrent writer can change the row between the
-- two captures. If a future version of this test ever needed to tolerate a
-- column that is legitimately recomputed between captures, it would be
-- stripped from both sides via `snapshot - 'column_name'` before comparison,
-- named explicitly here, with the reason documented at that point.
DO $$
DECLARE
  v_admin_id uuid := '11111111-1111-1111-1111-111111111111';
  v_dra_id uuid := 'a1111111-1111-1111-1111-111111111111';
  v_new_sample_id uuid := 'b7777777-7777-7777-7777-777777777777';
  v_new_lat double precision := 49.35000;
  v_new_lng double precision := -123.21000;
  v_cluster text;
  v_pub_id uuid;
  v_external_before jsonb;
  v_external_after_create jsonb;
  v_external_after_refresh jsonb;
  v_audit_create_new jsonb;
  v_audit_refresh_prior jsonb;
  v_audit_refresh_new jsonb;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","email":"admin@example.com"}', true);

  INSERT INTO matrix_map.samples (
    id, bnrrm_station_id, station_id, display_name, latitude, longitude,
    geometry, coordinate_quality_tier, coordinate_source, classification, classification_source, source_dra_id, public
  ) VALUES (
    v_new_sample_id, 107, 'STN-007', 'Sample Station 7', v_new_lat, v_new_lng,
    extensions.st_setsrid(extensions.st_makepoint(v_new_lng, v_new_lat), 4326)::extensions.geography,
    'medium', 'bc_csr_centroid', 'reference', 'station_type', v_dra_id, false
  )
  ON CONFLICT (id) DO NOTHING;

  v_cluster := matrix_map.canonical_five_decimal_cluster(v_new_lat, v_new_lng);

  -- PRECONDITION: no publication row yet for this fresh cluster (nothing to
  -- capture a meaningful "before" snapshot from).
  SELECT to_jsonb(t) INTO v_external_before
  FROM matrix_map.site_aggregate_publications t
  WHERE source_dra_id = v_dra_id AND coordinate_cluster_id = v_cluster;
  IF v_external_before IS NOT NULL THEN
    RAISE EXCEPTION 'test setup invariant violated: publication already exists for fresh cluster %', v_cluster;
  END IF;

  -- Create with an initial label.
  PERFORM matrix_map.upsert_site_aggregate_candidate(
    v_dra_id, v_cluster, 'Audit Fix1 Original', v_admin_id, 'audit completeness create'
  );

  SELECT id INTO v_pub_id FROM matrix_map.site_aggregate_publications
  WHERE source_dra_id = v_dra_id AND coordinate_cluster_id = v_cluster;

  -- Independently capture the FULL persisted row right after create.
  SELECT to_jsonb(t) INTO v_external_after_create
  FROM matrix_map.site_aggregate_publications t
  WHERE id = v_pub_id;

  SELECT new_snapshot INTO v_audit_create_new
  FROM matrix_map.site_aggregate_candidate_audit
  WHERE publication_id = v_pub_id AND action = 'create'
  ORDER BY changed_at DESC, id DESC LIMIT 1;

  -- Refresh with a DIFFERENT label.
  PERFORM matrix_map.upsert_site_aggregate_candidate(
    v_dra_id, v_cluster, 'Audit Fix1 Refreshed', v_admin_id, 'audit completeness refresh'
  );

  SELECT to_jsonb(t) INTO v_external_after_refresh
  FROM matrix_map.site_aggregate_publications t
  WHERE id = v_pub_id;

  SELECT prior_snapshot, new_snapshot
  INTO v_audit_refresh_prior, v_audit_refresh_new
  FROM matrix_map.site_aggregate_candidate_audit
  WHERE publication_id = v_pub_id AND action = 'refresh'
  ORDER BY changed_at DESC, id DESC LIMIT 1;

  IF v_audit_create_new = v_external_after_create
     AND v_audit_refresh_prior = v_external_after_create
     AND v_audit_refresh_new = v_external_after_refresh
     AND (v_audit_create_new ->> 'member_display_label') = 'Audit Fix1 Original'
     AND (v_audit_refresh_prior ->> 'member_display_label') = 'Audit Fix1 Original'
     AND (v_audit_refresh_new ->> 'member_display_label') = 'Audit Fix1 Refreshed' THEN
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_21', 'Verify candidate audit new_snapshot/prior_snapshot capture the COMPLETE persisted row (whole-object equality, not a single-key check) on create and refresh (R2-FIX-3)', 'PASS',
            'audit new_snapshot on create == independently-read full row after create; audit prior_snapshot on refresh == that same full row; audit new_snapshot on refresh == independently-read full row after refresh; whole-object jsonb equality, zero columns excluded');
  ELSE
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_21', 'Verify candidate audit new_snapshot/prior_snapshot capture the COMPLETE persisted row (whole-object equality, not a single-key check) on create and refresh (R2-FIX-3)', 'FAIL',
            format('create_new=%s vs external_after_create=%s; refresh_prior=%s vs external_after_create=%s; refresh_new=%s vs external_after_refresh=%s',
                   v_audit_create_new, v_external_after_create, v_audit_refresh_prior, v_external_after_create, v_audit_refresh_new, v_external_after_refresh));
  END IF;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
  VALUES ('TEST_21', 'Verify candidate audit new_snapshot/prior_snapshot capture the COMPLETE persisted row (whole-object equality, not a single-key check) on create and refresh (R2-FIX-3)', 'FAIL', SQLSTATE, SQLERRM);
END $$;

-- TEST 22: site_aggregate_candidate_audit.publication_id is NOT NULL with a
-- FOREIGN KEY ON DELETE RESTRICT to EXACTLY matrix_map.site_aggregate_publications(id)
-- (FIX 9 production behavior; R2-FIX-4 test hardening, accepted P2).
--
-- REWRITTEN under second-review-round finding R2-FIX-4: the prior version of
-- this test checked only the referenced relation NAME (fc.relname) and the
-- delete action -- it never checked the referenced relation's SCHEMA, and it
-- never verified the referenced COLUMN via confkey (only the LOCAL column via
-- conkey). A foreign key pointing at some OTHER schema's own
-- site_aggregate_publications table, or at a different unique column on the
-- correct table, would have passed. This version additionally joins
-- pg_namespace on confrelid's schema (must be exactly 'matrix_map') and joins
-- pg_attribute via confkey[1] on confrelid (must be exactly 'id'), so the
-- target is verified as EXACTLY matrix_map.site_aggregate_publications(id).
DO $$
DECLARE
  v_not_null boolean;
  v_has_fk boolean;
BEGIN
  SELECT a.attnotnull INTO v_not_null
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'matrix_map' AND c.relname = 'site_aggregate_candidate_audit'
    AND a.attname = 'publication_id' AND a.attnum > 0 AND NOT a.attisdropped;

  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_class fc ON fc.oid = con.confrelid
    JOIN pg_namespace fn ON fn.oid = fc.relnamespace
    JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = con.conkey[1]
    JOIN pg_attribute fa ON fa.attrelid = con.confrelid AND fa.attnum = con.confkey[1]
    WHERE n.nspname = 'matrix_map'
      AND c.relname = 'site_aggregate_candidate_audit'
      AND con.contype = 'f'
      AND fn.nspname = 'matrix_map'
      AND fc.relname = 'site_aggregate_publications'
      AND con.confdeltype = 'r'
      AND array_length(con.conkey, 1) = 1
      AND array_length(con.confkey, 1) = 1
      AND a.attname = 'publication_id'
      AND fa.attname = 'id'
  ) INTO v_has_fk;

  IF v_not_null = true AND v_has_fk = true THEN
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_22', 'Verify site_aggregate_candidate_audit.publication_id is NOT NULL with a FOREIGN KEY ON DELETE RESTRICT to exactly matrix_map.site_aggregate_publications(id) (R2-FIX-4)', 'PASS',
            'attnotnull=true; FK ON DELETE RESTRICT confirmed to target schema=matrix_map, table=site_aggregate_publications, column=id (via confrelid namespace + confkey->pg_attribute)');
  ELSE
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_22', 'Verify site_aggregate_candidate_audit.publication_id is NOT NULL with a FOREIGN KEY ON DELETE RESTRICT to exactly matrix_map.site_aggregate_publications(id) (R2-FIX-4)', 'FAIL',
            format('not_null=%s (exp true), has_restrict_fk_to_exact_target=%s (exp true)', v_not_null, v_has_fk));
  END IF;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
  VALUES ('TEST_22', 'Verify site_aggregate_candidate_audit.publication_id is NOT NULL with a FOREIGN KEY ON DELETE RESTRICT to exactly matrix_map.site_aggregate_publications(id) (R2-FIX-4)', 'FAIL', SQLSTATE, SQLERRM);
END $$;

-- ---------------------------------------------------------------------------
-- R2-FIX-1 UPGRADE-PATH PROOF (TEST_23)
-- Second-review-round finding R2-FIX-1 (accepted P1) added an idempotent,
-- data-preflighted upgrade function
-- matrix_map.apply_candidate_audit_publication_id_invariant(schema, table) to
-- the draft SQL, called once against the real table. TEST_22 above only ever
-- exercises a table created FRESH with the invariant already declared in its
-- CREATE TABLE, so it can never prove the upgrade path itself works. This
-- test builds a table in the LEGACY SHAPE the finding describes (publication_id
-- nullable, no FK) in a throwaway scratch schema, then invokes the SAME
-- production function against it (not a re-implementation of its logic), and
-- asserts the legacy table is promoted to NOT NULL + FK ON DELETE RESTRICT
-- targeting matrix_map.site_aggregate_publications(id).
-- ---------------------------------------------------------------------------

-- TEST 23: R2-FIX-1 upgrade function promotes a simulated legacy-shaped table
DO $$
DECLARE
  v_valid_pub_id uuid := 'c1111111-1111-1111-1111-111111111111';
  v_not_null_before boolean;
  v_has_fk_before boolean;
  v_not_null_after boolean;
  v_has_fk_after boolean;
BEGIN
  -- Build the legacy shape in an isolated scratch schema: publication_id
  -- nullable, no FK at all. Never touches the real
  -- matrix_map.site_aggregate_candidate_audit table.
  CREATE SCHEMA IF NOT EXISTS zz_fix1_legacy_probe;

  DROP TABLE IF EXISTS zz_fix1_legacy_probe.site_aggregate_candidate_audit;
  CREATE TABLE zz_fix1_legacy_probe.site_aggregate_candidate_audit (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    publication_id uuid,
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

  INSERT INTO zz_fix1_legacy_probe.site_aggregate_candidate_audit (
    publication_id, source_dra_id, coordinate_cluster_id, action, new_snapshot, reason, changed_by, changed_by_email
  ) VALUES (
    v_valid_pub_id, 'a1111111-1111-1111-1111-111111111111', '49.28273,-123.12074', 'create', '{}'::jsonb,
    'fix1 legacy probe seed row', '11111111-1111-1111-1111-111111111111', 'admin@example.com'
  );

  SELECT a.attnotnull INTO v_not_null_before
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'zz_fix1_legacy_probe' AND c.relname = 'site_aggregate_candidate_audit'
    AND a.attname = 'publication_id' AND a.attnum > 0 AND NOT a.attisdropped;

  SELECT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'zz_fix1_legacy_probe' AND c.relname = 'site_aggregate_candidate_audit'
      AND con.contype = 'f'
  ) INTO v_has_fk_before;

  IF v_not_null_before IS NOT FALSE OR v_has_fk_before IS NOT FALSE THEN
    RAISE EXCEPTION 'test setup invariant violated: legacy probe table did not start nullable/FK-less (not_null=%, has_fk=%)', v_not_null_before, v_has_fk_before;
  END IF;

  -- Run the SAME production upgrade function the migration calls against the
  -- real table, pointed instead at the scratch legacy-shaped table.
  PERFORM matrix_map.apply_candidate_audit_publication_id_invariant('zz_fix1_legacy_probe', 'site_aggregate_candidate_audit');

  SELECT a.attnotnull INTO v_not_null_after
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'zz_fix1_legacy_probe' AND c.relname = 'site_aggregate_candidate_audit'
    AND a.attname = 'publication_id' AND a.attnum > 0 AND NOT a.attisdropped;

  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_class fc ON fc.oid = con.confrelid
    JOIN pg_namespace fn ON fn.oid = fc.relnamespace
    JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = con.conkey[1]
    JOIN pg_attribute fa ON fa.attrelid = con.confrelid AND fa.attnum = con.confkey[1]
    WHERE n.nspname = 'zz_fix1_legacy_probe'
      AND c.relname = 'site_aggregate_candidate_audit'
      AND con.contype = 'f'
      AND fn.nspname = 'matrix_map'
      AND fc.relname = 'site_aggregate_publications'
      AND con.confdeltype = 'r'
      AND array_length(con.conkey, 1) = 1
      AND array_length(con.confkey, 1) = 1
      AND a.attname = 'publication_id'
      AND fa.attname = 'id'
  ) INTO v_has_fk_after;

  DROP TABLE IF EXISTS zz_fix1_legacy_probe.site_aggregate_candidate_audit;
  DROP SCHEMA IF EXISTS zz_fix1_legacy_probe;

  IF v_not_null_after = true AND v_has_fk_after = true THEN
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_23', 'Verify the R2-FIX-1 upgrade function promotes a legacy-shaped (nullable, no-FK) table to NOT NULL + FK ON DELETE RESTRICT targeting matrix_map.site_aggregate_publications(id)', 'PASS',
      format('scratch legacy table before: not_null=%s has_fk=%s; after apply_candidate_audit_publication_id_invariant(): not_null=%s has_fk=%s', v_not_null_before, v_has_fk_before, v_not_null_after, v_has_fk_after));
  ELSE
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_23', 'Verify the R2-FIX-1 upgrade function promotes a legacy-shaped (nullable, no-FK) table to NOT NULL + FK ON DELETE RESTRICT targeting matrix_map.site_aggregate_publications(id)', 'FAIL',
      format('not_null_after=%s (exp true), has_fk_after=%s (exp true)', v_not_null_after, v_has_fk_after));
  END IF;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    DROP TABLE IF EXISTS zz_fix1_legacy_probe.site_aggregate_candidate_audit;
    DROP SCHEMA IF EXISTS zz_fix1_legacy_probe;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
  VALUES ('TEST_23', 'Verify the R2-FIX-1 upgrade function promotes a legacy-shaped (nullable, no-FK) table to NOT NULL + FK ON DELETE RESTRICT targeting matrix_map.site_aggregate_publications(id)', 'FAIL', SQLSTATE, SQLERRM);
END $$;

-- ---------------------------------------------------------------------------
-- FAIL-CLOSED ON INCOMPATIBLE EXISTING FK (TEST_24)
-- apply_candidate_audit_publication_id_invariant previously FAILED OPEN: when
-- a legacy table already had a foreign key on publication_id that did NOT
-- match the required spec (e.g. ON DELETE CASCADE, or a same-named
-- constraint), the exact-spec probe returned false, the ADD CONSTRAINT hit
-- duplicate_object on the constraint name, and that exception was SWALLOWED -
-- so the incompatible CASCADE constraint survived while the function still
-- reported success. This test builds a table in that exact incompatible
-- shape (publication_id NOT NULL, FK ON DELETE CASCADE to
-- matrix_map.site_aggregate_publications(id), named exactly
-- '<table>_publication_id_fkey' so it also collides on the constraint name),
-- invokes the SAME production function against it, and asserts it now RAISEs
-- SQLSTATE 'UE409' AND leaves the incompatible constraint untouched
-- (still present, still ON DELETE CASCADE) rather than repairing or dropping
-- it.
-- ---------------------------------------------------------------------------

-- TEST 24: apply_candidate_audit_publication_id_invariant fails closed (UE409)
-- on a pre-existing incompatible FK and does not repair/drop it
DO $$
DECLARE
  v_valid_pub_id uuid := 'c1111111-1111-1111-1111-111111111111';
  v_raised_sqlstate text := NULL;
  v_constraint_name_before text;
  v_deltype_before text;
  v_constraint_name_after text;
  v_deltype_after text;
BEGIN
  -- Build the incompatible-FK shape in an isolated scratch schema. Never
  -- touches the real matrix_map.site_aggregate_candidate_audit table.
  CREATE SCHEMA IF NOT EXISTS zz_fk409_incompatible_probe;

  DROP TABLE IF EXISTS zz_fk409_incompatible_probe.site_aggregate_candidate_audit;
  CREATE TABLE zz_fk409_incompatible_probe.site_aggregate_candidate_audit (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    publication_id uuid NOT NULL,
    source_dra_id uuid NOT NULL,
    coordinate_cluster_id text NOT NULL,
    action text NOT NULL CHECK (action IN ('create', 'refresh')),
    prior_snapshot jsonb,
    new_snapshot jsonb NOT NULL,
    reason text NOT NULL,
    changed_by uuid NOT NULL,
    changed_by_email text NOT NULL,
    changed_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT site_aggregate_candidate_audit_publication_id_fkey
      FOREIGN KEY (publication_id) REFERENCES matrix_map.site_aggregate_publications(id) ON DELETE CASCADE
  );

  INSERT INTO zz_fk409_incompatible_probe.site_aggregate_candidate_audit (
    publication_id, source_dra_id, coordinate_cluster_id, action, new_snapshot, reason, changed_by, changed_by_email
  ) VALUES (
    v_valid_pub_id, 'a1111111-1111-1111-1111-111111111111', '49.28273,-123.12074', 'create', '{}'::jsonb,
    'fk409 incompatible probe seed row', '11111111-1111-1111-1111-111111111111', 'admin@example.com'
  );

  -- Capture the incompatible constraint's shape BEFORE calling the function.
  SELECT con.conname, con.confdeltype::text INTO v_constraint_name_before, v_deltype_before
  FROM pg_constraint con
  JOIN pg_class c ON c.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'zz_fk409_incompatible_probe' AND c.relname = 'site_aggregate_candidate_audit'
    AND con.contype = 'f';

  IF v_constraint_name_before IS NULL OR v_deltype_before IS DISTINCT FROM 'c' THEN
    RAISE EXCEPTION 'test setup invariant violated: probe table did not start with an ON DELETE CASCADE FK (name=%, deltype=%)', v_constraint_name_before, v_deltype_before;
  END IF;

  -- Call the SAME production function the migration calls. Expect it to RAISE
  -- SQLSTATE UE409 rather than silently succeeding (the pre-fix fail-open
  -- behaviour) -- catch it in an inner block so this DO block can continue to
  -- assert on the constraint's post-call state.
  BEGIN
    PERFORM matrix_map.apply_candidate_audit_publication_id_invariant('zz_fk409_incompatible_probe', 'site_aggregate_candidate_audit');
    -- No exception raised at all is itself the failure this test exists to
    -- catch, so record a sentinel that will not match 'UE409' below.
    v_raised_sqlstate := 'NO_RAISE';
  EXCEPTION WHEN OTHERS THEN
    v_raised_sqlstate := SQLSTATE;
  END;

  -- Re-probe AFTER the call: the incompatible constraint must still be
  -- present, same name, still ON DELETE CASCADE - i.e. not opportunistically
  -- repaired or dropped by the function.
  SELECT con.conname, con.confdeltype::text INTO v_constraint_name_after, v_deltype_after
  FROM pg_constraint con
  JOIN pg_class c ON c.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'zz_fk409_incompatible_probe' AND c.relname = 'site_aggregate_candidate_audit'
    AND con.contype = 'f';

  DROP TABLE IF EXISTS zz_fk409_incompatible_probe.site_aggregate_candidate_audit;
  DROP SCHEMA IF EXISTS zz_fk409_incompatible_probe;

  IF v_raised_sqlstate = 'UE409'
     AND v_constraint_name_after = v_constraint_name_before
     AND v_deltype_after = 'c' THEN
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_24', 'Verify apply_candidate_audit_publication_id_invariant FAILS CLOSED with SQLSTATE UE409 on a pre-existing INCOMPATIBLE foreign key (ON DELETE CASCADE, same constraint name) on publication_id, and does NOT drop or repair it', 'PASS',
      format('raised sqlstate=%s (exp UE409); incompatible FK survived unrepaired: name_before=%s deltype_before=%s -> name_after=%s deltype_after=%s (exp cascade/c preserved, name unchanged)', v_raised_sqlstate, v_constraint_name_before, v_deltype_before, v_constraint_name_after, v_deltype_after));
  ELSE
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_24', 'Verify apply_candidate_audit_publication_id_invariant FAILS CLOSED with SQLSTATE UE409 on a pre-existing INCOMPATIBLE foreign key (ON DELETE CASCADE, same constraint name) on publication_id, and does NOT drop or repair it', 'FAIL',
      format('raised sqlstate=%s (exp UE409); name_before=%s deltype_before=%s -> name_after=%s deltype_after=%s (exp name unchanged + deltype=c preserved)', v_raised_sqlstate, v_constraint_name_before, v_deltype_before, v_constraint_name_after, v_deltype_after));
  END IF;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    DROP TABLE IF EXISTS zz_fk409_incompatible_probe.site_aggregate_candidate_audit;
    DROP SCHEMA IF EXISTS zz_fk409_incompatible_probe;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
  VALUES ('TEST_24', 'Verify apply_candidate_audit_publication_id_invariant FAILS CLOSED with SQLSTATE UE409 on a pre-existing INCOMPATIBLE foreign key (ON DELETE CASCADE, same constraint name) on publication_id, and does NOT drop or repair it', 'FAIL', SQLSTATE, SQLERRM);
END $$;

-- ---------------------------------------------------------------------------
-- FIX 3 (accepted P2, 2026-07-27 restack): TEST_24 named its incompatible
-- CASCADE FK exactly the name the helper would try to add
-- ('<table>_publication_id_fkey'), so even if the incompatible-FK probe were
-- removed entirely, the pre-existing duplicate_object handler on the ADD
-- CONSTRAINT attempt would still raise UE409 -- TEST_24 alone does not isolate
-- the protection it claims to test. This test repeats the same incompatible
-- shape (publication_id NOT NULL, FK ON DELETE CASCADE to
-- matrix_map.site_aggregate_publications(id)) but with a NON-COLLIDING
-- constraint name ('zz_legacy_other_fk'), so ONLY the enumeration-based
-- fail-closed logic (FIX 2) can catch it -- the duplicate_object path cannot
-- fire because there is no name collision.
-- ---------------------------------------------------------------------------

-- TEST 25: apply_candidate_audit_publication_id_invariant fails closed (UE409)
-- on a pre-existing incompatible FK under a NON-COLLIDING constraint name
DO $$
DECLARE
  v_valid_pub_id uuid := 'c1111111-1111-1111-1111-111111111111';
  v_raised_sqlstate text := NULL;
  v_constraint_name_before text;
  v_deltype_before text;
  v_constraint_name_after text;
  v_deltype_after text;
BEGIN
  CREATE SCHEMA IF NOT EXISTS zz_fk409_noncollide_probe;

  DROP TABLE IF EXISTS zz_fk409_noncollide_probe.site_aggregate_candidate_audit;
  CREATE TABLE zz_fk409_noncollide_probe.site_aggregate_candidate_audit (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    publication_id uuid NOT NULL,
    source_dra_id uuid NOT NULL,
    coordinate_cluster_id text NOT NULL,
    action text NOT NULL CHECK (action IN ('create', 'refresh')),
    prior_snapshot jsonb,
    new_snapshot jsonb NOT NULL,
    reason text NOT NULL,
    changed_by uuid NOT NULL,
    changed_by_email text NOT NULL,
    changed_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT zz_legacy_other_fk
      FOREIGN KEY (publication_id) REFERENCES matrix_map.site_aggregate_publications(id) ON DELETE CASCADE
  );

  INSERT INTO zz_fk409_noncollide_probe.site_aggregate_candidate_audit (
    publication_id, source_dra_id, coordinate_cluster_id, action, new_snapshot, reason, changed_by, changed_by_email
  ) VALUES (
    v_valid_pub_id, 'a1111111-1111-1111-1111-111111111111', '49.28273,-123.12074', 'create', '{}'::jsonb,
    'fk409 non-colliding-name probe seed row', '11111111-1111-1111-1111-111111111111', 'admin@example.com'
  );

  SELECT con.conname, con.confdeltype::text INTO v_constraint_name_before, v_deltype_before
  FROM pg_constraint con
  JOIN pg_class c ON c.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'zz_fk409_noncollide_probe' AND c.relname = 'site_aggregate_candidate_audit'
    AND con.contype = 'f';

  IF v_constraint_name_before IS NULL OR v_deltype_before IS DISTINCT FROM 'c' OR v_constraint_name_before = 'site_aggregate_candidate_audit_publication_id_fkey' THEN
    RAISE EXCEPTION 'test setup invariant violated: probe table did not start with a non-colliding ON DELETE CASCADE FK (name=%, deltype=%)', v_constraint_name_before, v_deltype_before;
  END IF;

  BEGIN
    PERFORM matrix_map.apply_candidate_audit_publication_id_invariant('zz_fk409_noncollide_probe', 'site_aggregate_candidate_audit');
    v_raised_sqlstate := 'NO_RAISE';
  EXCEPTION WHEN OTHERS THEN
    v_raised_sqlstate := SQLSTATE;
  END;

  SELECT con.conname, con.confdeltype::text INTO v_constraint_name_after, v_deltype_after
  FROM pg_constraint con
  JOIN pg_class c ON c.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'zz_fk409_noncollide_probe' AND c.relname = 'site_aggregate_candidate_audit'
    AND con.contype = 'f';

  DROP TABLE IF EXISTS zz_fk409_noncollide_probe.site_aggregate_candidate_audit;
  DROP SCHEMA IF EXISTS zz_fk409_noncollide_probe;

  IF v_raised_sqlstate = 'UE409'
     AND v_constraint_name_after = v_constraint_name_before
     AND v_constraint_name_after = 'zz_legacy_other_fk'
     AND v_deltype_after = 'c' THEN
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_25', 'Verify apply_candidate_audit_publication_id_invariant FAILS CLOSED with SQLSTATE UE409 on a pre-existing INCOMPATIBLE foreign key under a NON-COLLIDING constraint name (zz_legacy_other_fk), isolating the enumeration-based fail-closed logic from the duplicate_object name-collision path (FIX 3)', 'PASS',
      format('raised sqlstate=%s (exp UE409); incompatible FK survived unrepaired under non-colliding name: name_before=%s deltype_before=%s -> name_after=%s deltype_after=%s', v_raised_sqlstate, v_constraint_name_before, v_deltype_before, v_constraint_name_after, v_deltype_after));
  ELSE
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_25', 'Verify apply_candidate_audit_publication_id_invariant FAILS CLOSED with SQLSTATE UE409 on a pre-existing INCOMPATIBLE foreign key under a NON-COLLIDING constraint name (zz_legacy_other_fk), isolating the enumeration-based fail-closed logic from the duplicate_object name-collision path (FIX 3)', 'FAIL',
      format('raised sqlstate=%s (exp UE409); name_before=%s deltype_before=%s -> name_after=%s deltype_after=%s (exp name unchanged=zz_legacy_other_fk + deltype=c preserved)', v_raised_sqlstate, v_constraint_name_before, v_deltype_before, v_constraint_name_after, v_deltype_after));
  END IF;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    DROP TABLE IF EXISTS zz_fk409_noncollide_probe.site_aggregate_candidate_audit;
    DROP SCHEMA IF EXISTS zz_fk409_noncollide_probe;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
  VALUES ('TEST_25', 'Verify apply_candidate_audit_publication_id_invariant FAILS CLOSED with SQLSTATE UE409 on a pre-existing INCOMPATIBLE foreign key under a NON-COLLIDING constraint name (zz_legacy_other_fk), isolating the enumeration-based fail-closed logic from the duplicate_object name-collision path (FIX 3)', 'FAIL', SQLSTATE, SQLERRM);
END $$;

-- ---------------------------------------------------------------------------
-- FIX 1 (accepted P1, 2026-07-27 restack): composite-FK positional blind
-- spot. Both probes previously joined pg_attribute via con.conkey[1] only, so
-- a foreign key with publication_id as the SECOND (or later) column of a
-- COMPOSITE key was invisible to both the conforming-FK probe and the
-- incompatible-FK probe. This test builds a table whose ONLY foreign key
-- involving publication_id is such a composite FK (publication_id is the
-- second column; the first column, ref_a, is what conkey[1] would resolve
-- to). Before the fix, the function would not find ANY foreign key on this
-- column via either probe (attnum = conkey[1] never matches, and the
-- membership test did not exist), so it would proceed to add a brand-new
-- redundant single-column foreign key alongside the pre-existing, unexamined
-- composite one instead of failing closed. After the fix, the function
-- resolves publication_id's attnum once and tests membership in the WHOLE
-- conkey array, so the composite FK is found, judged non-conforming (arity
-- check), and the function fails closed with UE409 -- it does not add a
-- redundant FK, and it does not drop or repair the composite one.
-- ---------------------------------------------------------------------------

-- TEST 26: apply_candidate_audit_publication_id_invariant detects a composite
-- FK with publication_id as a NON-FIRST key column (positional blind spot)
DO $$
DECLARE
  v_raised_sqlstate text := NULL;
  v_fk_count_before integer;
  v_fk_count_after integer;
  v_composite_present_after boolean;
BEGIN
  CREATE SCHEMA IF NOT EXISTS zz_fix1_composite_only_probe;

  DROP TABLE IF EXISTS zz_fix1_composite_only_probe.site_aggregate_candidate_audit;
  DROP TABLE IF EXISTS zz_fix1_composite_only_probe.ref_parent;

  CREATE TABLE zz_fix1_composite_only_probe.ref_parent (
    ref_a uuid NOT NULL,
    ref_b uuid NOT NULL,
    PRIMARY KEY (ref_a, ref_b)
  );

  CREATE TABLE zz_fix1_composite_only_probe.site_aggregate_candidate_audit (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ref_a uuid NOT NULL,
    publication_id uuid NOT NULL,
    source_dra_id uuid NOT NULL,
    coordinate_cluster_id text NOT NULL,
    action text NOT NULL CHECK (action IN ('create', 'refresh')),
    prior_snapshot jsonb,
    new_snapshot jsonb NOT NULL,
    reason text NOT NULL,
    changed_by uuid NOT NULL,
    changed_by_email text NOT NULL,
    changed_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT zz_composite_only_fk
      FOREIGN KEY (ref_a, publication_id) REFERENCES zz_fix1_composite_only_probe.ref_parent(ref_a, ref_b)
  );

  INSERT INTO zz_fix1_composite_only_probe.ref_parent (ref_a, ref_b)
  VALUES ('b1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111');

  INSERT INTO zz_fix1_composite_only_probe.site_aggregate_candidate_audit (
    ref_a, publication_id, source_dra_id, coordinate_cluster_id, action, new_snapshot, reason, changed_by, changed_by_email
  ) VALUES (
    'b1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111',
    'a1111111-1111-1111-1111-111111111111', '49.28273,-123.12074', 'create', '{}'::jsonb,
    'fix1 composite-only probe seed row', '11111111-1111-1111-1111-111111111111', 'admin@example.com'
  );

  SELECT count(*) INTO v_fk_count_before
  FROM pg_constraint con
  JOIN pg_class c ON c.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'zz_fix1_composite_only_probe' AND c.relname = 'site_aggregate_candidate_audit'
    AND con.contype = 'f';

  IF v_fk_count_before <> 1 THEN
    RAISE EXCEPTION 'test setup invariant violated: composite-only probe table did not start with exactly one (composite) FK (count=%)', v_fk_count_before;
  END IF;

  BEGIN
    PERFORM matrix_map.apply_candidate_audit_publication_id_invariant('zz_fix1_composite_only_probe', 'site_aggregate_candidate_audit');
    v_raised_sqlstate := 'NO_RAISE';
  EXCEPTION WHEN OTHERS THEN
    v_raised_sqlstate := SQLSTATE;
  END;

  SELECT count(*) INTO v_fk_count_after
  FROM pg_constraint con
  JOIN pg_class c ON c.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'zz_fix1_composite_only_probe' AND c.relname = 'site_aggregate_candidate_audit'
    AND con.contype = 'f';

  SELECT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'zz_fix1_composite_only_probe' AND c.relname = 'site_aggregate_candidate_audit'
      AND con.contype = 'f' AND con.conname = 'zz_composite_only_fk'
  ) INTO v_composite_present_after;

  DROP TABLE IF EXISTS zz_fix1_composite_only_probe.site_aggregate_candidate_audit;
  DROP TABLE IF EXISTS zz_fix1_composite_only_probe.ref_parent;
  DROP SCHEMA IF EXISTS zz_fix1_composite_only_probe;

  IF v_raised_sqlstate = 'UE409' AND v_fk_count_after = 1 AND v_composite_present_after IS TRUE THEN
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_26', 'Verify apply_candidate_audit_publication_id_invariant detects a composite foreign key with publication_id as a NON-FIRST key column (positional blind spot) via conkey membership, fails closed with UE409, and does not add a redundant FK or touch the composite one (FIX 1)', 'PASS',
      format('raised sqlstate=%s (exp UE409); fk_count before=%s after=%s (exp 1->1, no redundant add); composite constraint zz_composite_only_fk still present=%s (exp true)', v_raised_sqlstate, v_fk_count_before, v_fk_count_after, v_composite_present_after));
  ELSE
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_26', 'Verify apply_candidate_audit_publication_id_invariant detects a composite foreign key with publication_id as a NON-FIRST key column (positional blind spot) via conkey membership, fails closed with UE409, and does not add a redundant FK or touch the composite one (FIX 1)', 'FAIL',
      format('raised sqlstate=%s (exp UE409); fk_count before=%s after=%s (exp 1->1); composite_present_after=%s (exp true)', v_raised_sqlstate, v_fk_count_before, v_fk_count_after, v_composite_present_after));
  END IF;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    DROP TABLE IF EXISTS zz_fix1_composite_only_probe.site_aggregate_candidate_audit;
    DROP TABLE IF EXISTS zz_fix1_composite_only_probe.ref_parent;
    DROP SCHEMA IF EXISTS zz_fix1_composite_only_probe;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
  VALUES ('TEST_26', 'Verify apply_candidate_audit_publication_id_invariant detects a composite foreign key with publication_id as a NON-FIRST key column (positional blind spot) via conkey membership, fails closed with UE409, and does not add a redundant FK or touch the composite one (FIX 1)', 'FAIL', SQLSTATE, SQLERRM);
END $$;

-- ---------------------------------------------------------------------------
-- FIX 1 + FIX 2 combined (accepted P1/P2, 2026-07-27 restack): the literal
-- malformed-table scenario named in the review finding -- a table carrying
-- BOTH the required single-column RESTRICT FK to
-- matrix_map.site_aggregate_publications(id) AND an extra composite FK that
-- also involves publication_id (as its second key column). Before either fix,
-- the conforming-FK probe would find the correct single-column FK
-- (v_has_fk = true) and the whole incompatible-FK scan would be SKIPPED
-- (FIX 2's bug), and even if it had not been skipped, the composite FK would
-- still have been invisible to a conkey[1]-only probe (FIX 1's bug) -- so
-- this malformed table was reported clean. After both fixes, the function
-- enumerates ALL foreign keys involving publication_id (count = 2), which is
-- not exactly one conforming FK, so it fails closed with UE409 and leaves
-- both constraints untouched.
-- ---------------------------------------------------------------------------

-- TEST 27: apply_candidate_audit_publication_id_invariant fails closed when a
-- conforming single-column FK coexists with an extra composite FK on the
-- same column (the exact malformed shape named in the review finding)
DO $$
DECLARE
  v_valid_pub_id uuid := 'c1111111-1111-1111-1111-111111111111';
  v_raised_sqlstate text := NULL;
  v_fk_count_before integer;
  v_fk_count_after integer;
  v_single_present_after boolean;
  v_composite_present_after boolean;
BEGIN
  CREATE SCHEMA IF NOT EXISTS zz_fix12_composite_plus_probe;

  DROP TABLE IF EXISTS zz_fix12_composite_plus_probe.site_aggregate_candidate_audit;
  DROP TABLE IF EXISTS zz_fix12_composite_plus_probe.ref_parent;

  CREATE TABLE zz_fix12_composite_plus_probe.ref_parent (
    ref_a uuid NOT NULL,
    ref_b uuid NOT NULL,
    PRIMARY KEY (ref_a, ref_b)
  );

  CREATE TABLE zz_fix12_composite_plus_probe.site_aggregate_candidate_audit (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    ref_a uuid NOT NULL,
    publication_id uuid NOT NULL,
    source_dra_id uuid NOT NULL,
    coordinate_cluster_id text NOT NULL,
    action text NOT NULL CHECK (action IN ('create', 'refresh')),
    prior_snapshot jsonb,
    new_snapshot jsonb NOT NULL,
    reason text NOT NULL,
    changed_by uuid NOT NULL,
    changed_by_email text NOT NULL,
    changed_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT zz_composite_plus_single_fk
      FOREIGN KEY (publication_id) REFERENCES matrix_map.site_aggregate_publications(id) ON DELETE RESTRICT,
    CONSTRAINT zz_composite_plus_composite_fk
      FOREIGN KEY (ref_a, publication_id) REFERENCES zz_fix12_composite_plus_probe.ref_parent(ref_a, ref_b)
  );

  INSERT INTO zz_fix12_composite_plus_probe.ref_parent (ref_a, ref_b)
  VALUES ('b1111111-1111-1111-1111-111111111111', v_valid_pub_id);

  INSERT INTO zz_fix12_composite_plus_probe.site_aggregate_candidate_audit (
    ref_a, publication_id, source_dra_id, coordinate_cluster_id, action, new_snapshot, reason, changed_by, changed_by_email
  ) VALUES (
    'b1111111-1111-1111-1111-111111111111', v_valid_pub_id,
    'a1111111-1111-1111-1111-111111111111', '49.28273,-123.12074', 'create', '{}'::jsonb,
    'fix1+fix2 composite-plus probe seed row', '11111111-1111-1111-1111-111111111111', 'admin@example.com'
  );

  SELECT count(*) INTO v_fk_count_before
  FROM pg_constraint con
  JOIN pg_class c ON c.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'zz_fix12_composite_plus_probe' AND c.relname = 'site_aggregate_candidate_audit'
    AND con.contype = 'f';

  IF v_fk_count_before <> 2 THEN
    RAISE EXCEPTION 'test setup invariant violated: composite-plus probe table did not start with exactly two FKs (count=%)', v_fk_count_before;
  END IF;

  BEGIN
    PERFORM matrix_map.apply_candidate_audit_publication_id_invariant('zz_fix12_composite_plus_probe', 'site_aggregate_candidate_audit');
    v_raised_sqlstate := 'NO_RAISE';
  EXCEPTION WHEN OTHERS THEN
    v_raised_sqlstate := SQLSTATE;
  END;

  SELECT count(*) INTO v_fk_count_after
  FROM pg_constraint con
  JOIN pg_class c ON c.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'zz_fix12_composite_plus_probe' AND c.relname = 'site_aggregate_candidate_audit'
    AND con.contype = 'f';

  SELECT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'zz_fix12_composite_plus_probe' AND c.relname = 'site_aggregate_candidate_audit'
      AND con.contype = 'f' AND con.conname = 'zz_composite_plus_single_fk'
  ) INTO v_single_present_after;

  SELECT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'zz_fix12_composite_plus_probe' AND c.relname = 'site_aggregate_candidate_audit'
      AND con.contype = 'f' AND con.conname = 'zz_composite_plus_composite_fk'
  ) INTO v_composite_present_after;

  DROP TABLE IF EXISTS zz_fix12_composite_plus_probe.site_aggregate_candidate_audit;
  DROP TABLE IF EXISTS zz_fix12_composite_plus_probe.ref_parent;
  DROP SCHEMA IF EXISTS zz_fix12_composite_plus_probe;

  IF v_raised_sqlstate = 'UE409' AND v_fk_count_after = 2 AND v_single_present_after IS TRUE AND v_composite_present_after IS TRUE THEN
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_27', 'Verify apply_candidate_audit_publication_id_invariant fails closed with UE409 on the exact malformed shape named in the review finding -- a conforming single-column RESTRICT FK coexisting with an extra composite FK on publication_id -- and leaves BOTH constraints untouched (FIX 1 + FIX 2 combined)', 'PASS',
      format('raised sqlstate=%s (exp UE409); fk_count before=%s after=%s (exp 2->2, no repair/drop); single FK present after=%s, composite FK present after=%s (exp both true)', v_raised_sqlstate, v_fk_count_before, v_fk_count_after, v_single_present_after, v_composite_present_after));
  ELSE
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_27', 'Verify apply_candidate_audit_publication_id_invariant fails closed with UE409 on the exact malformed shape named in the review finding -- a conforming single-column RESTRICT FK coexisting with an extra composite FK on publication_id -- and leaves BOTH constraints untouched (FIX 1 + FIX 2 combined)', 'FAIL',
      format('raised sqlstate=%s (exp UE409); fk_count before=%s after=%s (exp 2->2); single_present_after=%s composite_present_after=%s (exp both true)', v_raised_sqlstate, v_fk_count_before, v_fk_count_after, v_single_present_after, v_composite_present_after));
  END IF;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    DROP TABLE IF EXISTS zz_fix12_composite_plus_probe.site_aggregate_candidate_audit;
    DROP TABLE IF EXISTS zz_fix12_composite_plus_probe.ref_parent;
    DROP SCHEMA IF EXISTS zz_fix12_composite_plus_probe;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
  VALUES ('TEST_27', 'Verify apply_candidate_audit_publication_id_invariant fails closed with UE409 on the exact malformed shape named in the review finding -- a conforming single-column RESTRICT FK coexisting with an extra composite FK on publication_id -- and leaves BOTH constraints untouched (FIX 1 + FIX 2 combined)', 'FAIL', SQLSTATE, SQLERRM);
END $$;

-- ---------------------------------------------------------------------------
-- POSITIVE CONTROL (2026-07-27 restack): proves the FIX 2 restructure (always
-- enumerate, require exactly one conforming FK) does not brick a legitimate
-- reapply. Builds a scratch table already in the EXACT conforming shape
-- (publication_id NOT NULL, single foreign key REFERENCES
-- matrix_map.site_aggregate_publications(id) ON DELETE RESTRICT, nothing
-- else), calls the SAME production function against it, and asserts: no
-- exception is raised, and the table's shape (NOT NULL + FK name/deltype/
-- arity) is unchanged afterward -- a true no-op.
-- ---------------------------------------------------------------------------

-- TEST 28: apply_candidate_audit_publication_id_invariant is a silent no-op
-- on an already-conforming table
DO $$
DECLARE
  v_valid_pub_id uuid := 'c1111111-1111-1111-1111-111111111111';
  v_raised_sqlstate text := NULL;
  v_not_null_before boolean;
  v_conname_before text;
  v_deltype_before text;
  v_not_null_after boolean;
  v_conname_after text;
  v_deltype_after text;
  v_fk_count_after integer;
BEGIN
  CREATE SCHEMA IF NOT EXISTS zz_positive_control_probe;

  DROP TABLE IF EXISTS zz_positive_control_probe.site_aggregate_candidate_audit;
  CREATE TABLE zz_positive_control_probe.site_aggregate_candidate_audit (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    publication_id uuid NOT NULL
      REFERENCES matrix_map.site_aggregate_publications(id) ON DELETE RESTRICT,
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

  INSERT INTO zz_positive_control_probe.site_aggregate_candidate_audit (
    publication_id, source_dra_id, coordinate_cluster_id, action, new_snapshot, reason, changed_by, changed_by_email
  ) VALUES (
    v_valid_pub_id, 'a1111111-1111-1111-1111-111111111111', '49.28273,-123.12074', 'create', '{}'::jsonb,
    'positive control probe seed row', '11111111-1111-1111-1111-111111111111', 'admin@example.com'
  );

  SELECT a.attnotnull INTO v_not_null_before
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'zz_positive_control_probe' AND c.relname = 'site_aggregate_candidate_audit'
    AND a.attname = 'publication_id' AND a.attnum > 0 AND NOT a.attisdropped;

  SELECT con.conname, con.confdeltype::text INTO v_conname_before, v_deltype_before
  FROM pg_constraint con
  JOIN pg_class c ON c.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'zz_positive_control_probe' AND c.relname = 'site_aggregate_candidate_audit'
    AND con.contype = 'f';

  IF v_not_null_before IS NOT TRUE OR v_conname_before IS NULL OR v_deltype_before IS DISTINCT FROM 'r' THEN
    RAISE EXCEPTION 'test setup invariant violated: positive-control probe table did not start already conforming (not_null=%, conname=%, deltype=%)', v_not_null_before, v_conname_before, v_deltype_before;
  END IF;

  BEGIN
    PERFORM matrix_map.apply_candidate_audit_publication_id_invariant('zz_positive_control_probe', 'site_aggregate_candidate_audit');
    v_raised_sqlstate := 'NO_RAISE';
  EXCEPTION WHEN OTHERS THEN
    v_raised_sqlstate := SQLSTATE;
  END;

  SELECT a.attnotnull INTO v_not_null_after
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'zz_positive_control_probe' AND c.relname = 'site_aggregate_candidate_audit'
    AND a.attname = 'publication_id' AND a.attnum > 0 AND NOT a.attisdropped;

  SELECT count(*) INTO v_fk_count_after
  FROM pg_constraint con
  JOIN pg_class c ON c.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'zz_positive_control_probe' AND c.relname = 'site_aggregate_candidate_audit'
    AND con.contype = 'f';

  SELECT con.conname, con.confdeltype::text INTO v_conname_after, v_deltype_after
  FROM pg_constraint con
  JOIN pg_class c ON c.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'zz_positive_control_probe' AND c.relname = 'site_aggregate_candidate_audit'
    AND con.contype = 'f';

  DROP TABLE IF EXISTS zz_positive_control_probe.site_aggregate_candidate_audit;
  DROP SCHEMA IF EXISTS zz_positive_control_probe;

  IF v_raised_sqlstate = 'NO_RAISE'
     AND v_not_null_after IS TRUE
     AND v_fk_count_after = 1
     AND v_conname_after = v_conname_before
     AND v_deltype_after = 'r' THEN
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_28', 'POSITIVE CONTROL: verify apply_candidate_audit_publication_id_invariant is a silent no-op (no exception, no shape change) on a table already in the exact conforming shape', 'PASS',
      format('raised=%s (exp NO_RAISE); not_null before=%s after=%s; fk_count after=%s (exp 1); conname before=%s after=%s; deltype before=%s after=%s', v_raised_sqlstate, v_not_null_before, v_not_null_after, v_fk_count_after, v_conname_before, v_conname_after, v_deltype_before, v_deltype_after));
  ELSE
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_28', 'POSITIVE CONTROL: verify apply_candidate_audit_publication_id_invariant is a silent no-op (no exception, no shape change) on a table already in the exact conforming shape', 'FAIL',
      format('raised=%s (exp NO_RAISE); not_null after=%s (exp true); fk_count after=%s (exp 1); conname after=%s (exp %s); deltype after=%s (exp r)', v_raised_sqlstate, v_not_null_after, v_fk_count_after, v_conname_after, v_conname_before, v_deltype_after));
  END IF;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    DROP TABLE IF EXISTS zz_positive_control_probe.site_aggregate_candidate_audit;
    DROP SCHEMA IF EXISTS zz_positive_control_probe;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
  VALUES ('TEST_28', 'POSITIVE CONTROL: verify apply_candidate_audit_publication_id_invariant is a silent no-op (no exception, no shape change) on a table already in the exact conforming shape', 'FAIL', SQLSTATE, SQLERRM);
END $$;

-- ---------------------------------------------------------------------------
-- FOURTH REVIEW ROUND CORRECTION (accepted P1, 2026-07-27 restack).
--
-- FIX 4 [P1] -- NOT VALID negative control. Before this fix, the conforming-FK
-- predicate pinned referenced table/column, delete action, and single-column
-- arity, but never con.convalidated. A foreign key added NOT VALID is enforced
-- for NEW rows only: rows already present when it was added are never checked.
-- So a table carrying a conforming-LOOKING but NOT VALID constraint was counted
-- as conforming and the helper reported success, while historical audit rows
-- could still reference publications that do not exist.
--
-- This probe seeds exactly that shape: a NULLABLE publication_id holding a row
-- that references a NONEXISTENT publication, plus a foreign key that matches the
-- conforming spec in every respect EXCEPT that it was created NOT VALID (and
-- under the CANONICAL constraint name, which is the realistic legacy shape).
--
-- The nullable column is deliberate and load-bearing. It forces the helper to
-- execute its ALTER TABLE ... SET NOT NULL branch BEFORE reaching the foreign
-- key logic that raises. PL/pgSQL's BEGIN ... EXCEPTION establishes an implicit
-- savepoint, and PostgreSQL DDL is transactional, so asserting the column is
-- STILL NULLABLE afterwards proves the partial upgrade was rolled back rather
-- than left half-applied. A NOT NULL column would have made that assertion
-- vacuous.
-- ---------------------------------------------------------------------------

-- TEST 29: apply_candidate_audit_publication_id_invariant fails closed (UE409)
-- on a conforming-looking but NOT VALID FK, and repairs nothing
DO $$
DECLARE
  v_orphan_pub_id uuid := 'dddddddd-dead-4dea-8dea-dddddddddddd';
  v_raised_sqlstate text := NULL;
  v_not_null_before boolean;
  v_conname_before text;
  v_deltype_before text;
  v_convalidated_before boolean;
  v_fk_count_before integer;
  v_not_null_after boolean;
  v_conname_after text;
  v_deltype_after text;
  v_convalidated_after boolean;
  v_fk_count_after integer;
BEGIN
  CREATE SCHEMA IF NOT EXISTS zz_fk409_notvalid_probe;

  DROP TABLE IF EXISTS zz_fk409_notvalid_probe.site_aggregate_candidate_audit;
  CREATE TABLE zz_fk409_notvalid_probe.site_aggregate_candidate_audit (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    publication_id uuid,
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

  -- A pre-existing row pointing at a publication that does NOT exist. This is
  -- precisely the integrity breach a NOT VALID constraint fails to catch.
  INSERT INTO zz_fk409_notvalid_probe.site_aggregate_candidate_audit (
    publication_id, source_dra_id, coordinate_cluster_id, action, new_snapshot, reason, changed_by, changed_by_email
  ) VALUES (
    v_orphan_pub_id, 'a1111111-1111-1111-1111-111111111111', '49.28273,-123.12074', 'create', '{}'::jsonb,
    'fk409 NOT VALID probe seed row referencing a nonexistent publication', '11111111-1111-1111-1111-111111111111', 'admin@example.com'
  );

  -- NOT VALID: succeeds despite the orphan row above, because existing rows are
  -- not checked. Canonical constraint name, conforming in every other respect.
  ALTER TABLE zz_fk409_notvalid_probe.site_aggregate_candidate_audit
    ADD CONSTRAINT site_aggregate_candidate_audit_publication_id_fkey
    FOREIGN KEY (publication_id) REFERENCES matrix_map.site_aggregate_publications(id)
    ON DELETE RESTRICT NOT VALID;

  SELECT a.attnotnull INTO v_not_null_before
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'zz_fk409_notvalid_probe' AND c.relname = 'site_aggregate_candidate_audit'
    AND a.attname = 'publication_id' AND a.attnum > 0 AND NOT a.attisdropped;

  SELECT count(*) INTO v_fk_count_before
  FROM pg_constraint con
  JOIN pg_class c ON c.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'zz_fk409_notvalid_probe' AND c.relname = 'site_aggregate_candidate_audit'
    AND con.contype = 'f';

  SELECT con.conname, con.confdeltype::text, con.convalidated
    INTO v_conname_before, v_deltype_before, v_convalidated_before
  FROM pg_constraint con
  JOIN pg_class c ON c.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'zz_fk409_notvalid_probe' AND c.relname = 'site_aggregate_candidate_audit'
    AND con.contype = 'f';

  IF v_not_null_before IS DISTINCT FROM false
     OR v_convalidated_before IS DISTINCT FROM false
     OR v_deltype_before IS DISTINCT FROM 'r'
     OR v_fk_count_before <> 1 THEN
    RAISE EXCEPTION 'test setup invariant violated: probe did not start as nullable + single NOT VALID RESTRICT FK (not_null=%, convalidated=%, deltype=%, fk_count=%)',
      v_not_null_before, v_convalidated_before, v_deltype_before, v_fk_count_before;
  END IF;

  BEGIN
    PERFORM matrix_map.apply_candidate_audit_publication_id_invariant('zz_fk409_notvalid_probe', 'site_aggregate_candidate_audit');
    v_raised_sqlstate := 'NO_RAISE';
  EXCEPTION WHEN OTHERS THEN
    v_raised_sqlstate := SQLSTATE;
  END;

  SELECT a.attnotnull INTO v_not_null_after
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'zz_fk409_notvalid_probe' AND c.relname = 'site_aggregate_candidate_audit'
    AND a.attname = 'publication_id' AND a.attnum > 0 AND NOT a.attisdropped;

  SELECT count(*) INTO v_fk_count_after
  FROM pg_constraint con
  JOIN pg_class c ON c.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'zz_fk409_notvalid_probe' AND c.relname = 'site_aggregate_candidate_audit'
    AND con.contype = 'f';

  SELECT con.conname, con.confdeltype::text, con.convalidated
    INTO v_conname_after, v_deltype_after, v_convalidated_after
  FROM pg_constraint con
  JOIN pg_class c ON c.oid = con.conrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'zz_fk409_notvalid_probe' AND c.relname = 'site_aggregate_candidate_audit'
    AND con.contype = 'f';

  DROP TABLE IF EXISTS zz_fk409_notvalid_probe.site_aggregate_candidate_audit;
  DROP SCHEMA IF EXISTS zz_fk409_notvalid_probe;

  -- PASS requires ALL of: UE409 raised (not silent success); the constraint not
  -- dropped, not renamed, not replaced (count and name unchanged); NOT
  -- validated (convalidated still false); delete action untouched; and the
  -- column's ORIGINAL nullability restored, proving the SET NOT NULL the helper
  -- attempted before raising was rolled back rather than left half-applied.
  IF v_raised_sqlstate = 'UE409'
     AND v_fk_count_after = v_fk_count_before
     AND v_fk_count_after = 1
     AND v_conname_after = v_conname_before
     AND v_conname_after = 'site_aggregate_candidate_audit_publication_id_fkey'
     AND v_convalidated_after = false
     AND v_deltype_after = 'r'
     AND v_not_null_after = v_not_null_before
     AND v_not_null_after = false THEN
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_29', 'NEGATIVE CONTROL: verify apply_candidate_audit_publication_id_invariant FAILS CLOSED with SQLSTATE UE409 on a conforming-looking but NOT VALID foreign key, and does not drop, rename, replace, validate, or otherwise repair it, and leaves the original column nullability unchanged (FIX 4)', 'PASS',
      format('raised=%s (exp UE409); convalidated before=%s after=%s (exp false); conname before=%s after=%s; deltype before=%s after=%s (exp r); fk_count before=%s after=%s (exp 1); not_null before=%s after=%s (exp false, proving the attempted SET NOT NULL rolled back)', v_raised_sqlstate, v_convalidated_before, v_convalidated_after, v_conname_before, v_conname_after, v_deltype_before, v_deltype_after, v_fk_count_before, v_fk_count_after, v_not_null_before, v_not_null_after));
  ELSE
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_29', 'NEGATIVE CONTROL: verify apply_candidate_audit_publication_id_invariant FAILS CLOSED with SQLSTATE UE409 on a conforming-looking but NOT VALID foreign key, and does not drop, rename, replace, validate, or otherwise repair it, and leaves the original column nullability unchanged (FIX 4)', 'FAIL',
      format('raised=%s (exp UE409); convalidated after=%s (exp false); conname after=%s (exp %s); deltype after=%s (exp r); fk_count after=%s (exp 1); not_null after=%s (exp false)', v_raised_sqlstate, v_convalidated_after, v_conname_after, v_conname_before, v_deltype_after, v_fk_count_after, v_not_null_after));
  END IF;
EXCEPTION WHEN OTHERS THEN
  BEGIN
    DROP TABLE IF EXISTS zz_fk409_notvalid_probe.site_aggregate_candidate_audit;
    DROP SCHEMA IF EXISTS zz_fk409_notvalid_probe;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
  VALUES ('TEST_29', 'NEGATIVE CONTROL: verify apply_candidate_audit_publication_id_invariant FAILS CLOSED with SQLSTATE UE409 on a conforming-looking but NOT VALID foreign key, and does not drop, rename, replace, validate, or otherwise repair it, and leaves the original column nullability unchanged (FIX 4)', 'FAIL', SQLSTATE, SQLERRM);
END $$;

-- ---------------------------------------------------------------------------
-- SERVER-AUTHORITATIVE DRIFT (TEST_30 .. TEST_35), 2026-07-27 restack.
--
-- fetch_admin_site_aggregate_publications now returns snapshot_drift_state,
-- derived server-side by comparing the persisted source_sample_hash against the
-- one recomputed by current_site_aggregate_snapshot through a LEFT LATERAL
-- join. It is the SOLE authority on drift; the client only reads it.
--
-- These assertions exist because the previous client-side reimplementation
-- could not be reconciled with the SQL over an unconstrained text column
-- (population, blank handling, trim semantics and collation order all
-- diverged), each divergence producing PERMANENT drift no refresh could clear.
-- ---------------------------------------------------------------------------

-- TEST 30: a freshly created candidate reports 'match'
DO $$
DECLARE
  v_dra_id uuid := 'a1111111-1111-1111-1111-111111111111';
  v_admin_id uuid := '11111111-1111-1111-1111-111111111111';
  v_lat double precision := 49.30001;
  v_lng double precision := -123.30001;
  v_cluster text;
  v_pub_id uuid;
  v_state text;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","email":"admin@example.com"}', true);

  INSERT INTO matrix_map.samples (
    id, bnrrm_station_id, station_id, display_name, latitude, longitude,
    geometry, coordinate_quality_tier, coordinate_source, classification, classification_source, source_dra_id, public
  ) VALUES (
    'd0000030-0000-4000-8000-000000000030', 130, 'STN-130', 'Drift Station 30', v_lat, v_lng,
    extensions.st_setsrid(extensions.st_makepoint(v_lng, v_lat), 4326)::extensions.geography,
    'medium', 'bc_csr_centroid', 'reference', 'station_type', v_dra_id, false
  ) ON CONFLICT (id) DO NOTHING;

  v_cluster := matrix_map.canonical_five_decimal_cluster(v_lat, v_lng);
  PERFORM matrix_map.upsert_site_aggregate_candidate(v_dra_id, v_cluster, 'Drift 30', v_admin_id, 'drift test 30');
  SELECT id INTO v_pub_id FROM matrix_map.site_aggregate_publications
  WHERE source_dra_id = v_dra_id AND coordinate_cluster_id = v_cluster;

  SELECT snapshot_drift_state INTO v_state
  FROM matrix_map.fetch_admin_site_aggregate_publications(v_pub_id, 1000, 0);

  IF v_state = 'match' THEN
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_30', 'Verify fetch_admin_site_aggregate_publications reports snapshot_drift_state=match for a freshly created candidate whose persisted hash equals the recomputed hash', 'PASS', format('state=%s', v_state));
  ELSE
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_30', 'Verify fetch_admin_site_aggregate_publications reports snapshot_drift_state=match for a freshly created candidate whose persisted hash equals the recomputed hash', 'FAIL', format('state=%s (exp match)', v_state));
  END IF;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
  VALUES ('TEST_30', 'Verify fetch_admin_site_aggregate_publications reports snapshot_drift_state=match for a freshly created candidate whose persisted hash equals the recomputed hash', 'FAIL', SQLSTATE, SQLERRM);
END $$;

-- TEST 31: a coordinate_source-ONLY change reports 'drift'
DO $$
DECLARE
  v_dra_id uuid := 'a1111111-1111-1111-1111-111111111111';
  v_admin_id uuid := '11111111-1111-1111-1111-111111111111';
  v_lat double precision := 49.31001;
  v_lng double precision := -123.31001;
  v_cluster text;
  v_pub_id uuid;
  v_state_before text;
  v_state_after text;
  v_total_before integer;
  v_total_after integer;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","email":"admin@example.com"}', true);

  INSERT INTO matrix_map.samples (
    id, bnrrm_station_id, station_id, display_name, latitude, longitude,
    geometry, coordinate_quality_tier, coordinate_source, classification, classification_source, source_dra_id, public
  ) VALUES (
    'd0000031-0000-4000-8000-000000000031', 131, 'STN-131', 'Drift Station 31', v_lat, v_lng,
    extensions.st_setsrid(extensions.st_makepoint(v_lng, v_lat), 4326)::extensions.geography,
    'medium', 'bc_csr_centroid', 'reference', 'station_type', v_dra_id, false
  ) ON CONFLICT (id) DO NOTHING;

  v_cluster := matrix_map.canonical_five_decimal_cluster(v_lat, v_lng);
  PERFORM matrix_map.upsert_site_aggregate_candidate(v_dra_id, v_cluster, 'Drift 31', v_admin_id, 'drift test 31');
  SELECT id INTO v_pub_id FROM matrix_map.site_aggregate_publications
  WHERE source_dra_id = v_dra_id AND coordinate_cluster_id = v_cluster;

  SELECT snapshot_drift_state, sample_count_total INTO v_state_before, v_total_before
  FROM matrix_map.fetch_admin_site_aggregate_publications(v_pub_id, 1000, 0);

  -- Change ONLY the provenance label. Counts, coordinates and tier are untouched.
  UPDATE matrix_map.samples SET coordinate_source = 'surveyed'
  WHERE id = 'd0000031-0000-4000-8000-000000000031';

  SELECT snapshot_drift_state, sample_count_total INTO v_state_after, v_total_after
  FROM matrix_map.fetch_admin_site_aggregate_publications(v_pub_id, 1000, 0);

  IF v_state_before = 'match' AND v_state_after = 'drift' AND v_total_before = v_total_after THEN
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_31', 'Verify a coordinate_source-ONLY change (counts, coordinates and tier unchanged) flips snapshot_drift_state from match to drift', 'PASS',
      format('before=%s after=%s; total unchanged %s->%s', v_state_before, v_state_after, v_total_before, v_total_after));
  ELSE
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_31', 'Verify a coordinate_source-ONLY change (counts, coordinates and tier unchanged) flips snapshot_drift_state from match to drift', 'FAIL',
      format('before=%s (exp match) after=%s (exp drift); total %s->%s (exp unchanged)', v_state_before, v_state_after, v_total_before, v_total_after));
  END IF;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
  VALUES ('TEST_31', 'Verify a coordinate_source-ONLY change (counts, coordinates and tier unchanged) flips snapshot_drift_state from match to drift', 'FAIL', SQLSTATE, SQLERRM);
END $$;

-- TEST 32: a sample-IDENTITY-only substitution reports 'drift'
DO $$
DECLARE
  v_dra_id uuid := 'a1111111-1111-1111-1111-111111111111';
  v_admin_id uuid := '11111111-1111-1111-1111-111111111111';
  v_lat double precision := 49.32001;
  v_lng double precision := -123.32001;
  v_cluster text;
  v_pub_id uuid;
  v_state_before text;
  v_state_after text;
  v_row_before jsonb;
  v_row_after jsonb;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","email":"admin@example.com"}', true);

  INSERT INTO matrix_map.samples (
    id, bnrrm_station_id, station_id, display_name, latitude, longitude,
    geometry, coordinate_quality_tier, coordinate_source, classification, classification_source, source_dra_id, public
  ) VALUES (
    'd0000032-0000-4000-8000-00000000a032', 132, 'STN-132', 'Drift Station 32', v_lat, v_lng,
    extensions.st_setsrid(extensions.st_makepoint(v_lng, v_lat), 4326)::extensions.geography,
    'medium', 'bc_csr_centroid', 'reference', 'station_type', v_dra_id, false
  ) ON CONFLICT (id) DO NOTHING;

  v_cluster := matrix_map.canonical_five_decimal_cluster(v_lat, v_lng);
  PERFORM matrix_map.upsert_site_aggregate_candidate(v_dra_id, v_cluster, 'Drift 32', v_admin_id, 'drift test 32');
  SELECT id INTO v_pub_id FROM matrix_map.site_aggregate_publications
  WHERE source_dra_id = v_dra_id AND coordinate_cluster_id = v_cluster;

  SELECT snapshot_drift_state,
         jsonb_build_object('total', sample_count_total, 'high', sample_count_high,
                            'medium', sample_count_medium, 'low', sample_count_low,
                            'points', distinct_point_count, 'tier', coordinate_quality_tier,
                            'src', coordinate_source)
    INTO v_state_before, v_row_before
  FROM matrix_map.fetch_admin_site_aggregate_publications(v_pub_id, 1000, 0);

  -- SUBSTITUTE the sample: same coordinate, tier and source, DIFFERENT id.
  -- Every visible aggregate field is preserved; only sample identity changes.
  DELETE FROM matrix_map.samples WHERE id = 'd0000032-0000-4000-8000-00000000a032';
  INSERT INTO matrix_map.samples (
    id, bnrrm_station_id, station_id, display_name, latitude, longitude,
    geometry, coordinate_quality_tier, coordinate_source, classification, classification_source, source_dra_id, public
  ) VALUES (
    'd0000032-0000-4000-8000-00000000b032', 132, 'STN-132', 'Drift Station 32', v_lat, v_lng,
    extensions.st_setsrid(extensions.st_makepoint(v_lng, v_lat), 4326)::extensions.geography,
    'medium', 'bc_csr_centroid', 'reference', 'station_type', v_dra_id, false
  );

  SELECT snapshot_drift_state,
         jsonb_build_object('total', sample_count_total, 'high', sample_count_high,
                            'medium', sample_count_medium, 'low', sample_count_low,
                            'points', distinct_point_count, 'tier', coordinate_quality_tier,
                            'src', coordinate_source)
    INTO v_state_after, v_row_after
  FROM matrix_map.fetch_admin_site_aggregate_publications(v_pub_id, 1000, 0);

  -- The persisted aggregate FIELDS are identical; only the hash differs. This
  -- is the case no field-by-field client comparison could ever have seen.
  IF v_state_before = 'match' AND v_state_after = 'drift' AND v_row_before = v_row_after THEN
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_32', 'Verify a sample-IDENTITY-only substitution (same coordinate, tier, source and counts; different sample id) is reported as drift via source_sample_hash, which no field-by-field comparison could detect', 'PASS',
      format('before=%s after=%s; visible fields identical: %s', v_state_before, v_state_after, v_row_before::text));
  ELSE
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_32', 'Verify a sample-IDENTITY-only substitution (same coordinate, tier, source and counts; different sample id) is reported as drift via source_sample_hash, which no field-by-field comparison could detect', 'FAIL',
      format('before=%s (exp match) after=%s (exp drift); fields before=%s after=%s (exp identical)', v_state_before, v_state_after, v_row_before::text, v_row_after::text));
  END IF;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
  VALUES ('TEST_32', 'Verify a sample-IDENTITY-only substitution (same coordinate, tier, source and counts; different sample id) is reported as drift via source_sample_hash, which no field-by-field comparison could detect', 'FAIL', SQLSTATE, SQLERRM);
END $$;

-- TEST 33: a MIXED-TIER cluster reports 'match' after refresh (no false drift)
DO $$
DECLARE
  v_dra_id uuid := 'a1111111-1111-1111-1111-111111111111';
  v_admin_id uuid := '11111111-1111-1111-1111-111111111111';
  v_lat double precision := 49.33001;
  v_lng double precision := -123.33001;
  v_cluster text;
  v_pub_id uuid;
  v_state text;
  v_high integer;
  v_medium integer;
  v_low integer;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","email":"admin@example.com"}', true);

  -- One cluster spanning all THREE tiers. This is the shape that made the old
  -- medium-only client comparison report drift forever.
  INSERT INTO matrix_map.samples (
    id, bnrrm_station_id, station_id, display_name, latitude, longitude,
    geometry, coordinate_quality_tier, coordinate_source, classification, classification_source, source_dra_id, public
  ) VALUES
    ('d0000033-0000-4000-8000-000000000331', 1331, 'STN-1331', 'Drift Station 33a', v_lat, v_lng,
     extensions.st_setsrid(extensions.st_makepoint(v_lng, v_lat), 4326)::extensions.geography,
     'medium', 'bc_csr_centroid', 'reference', 'station_type', v_dra_id, false),
    ('d0000033-0000-4000-8000-000000000332', 1332, 'STN-1332', 'Drift Station 33b', v_lat, v_lng,
     extensions.st_setsrid(extensions.st_makepoint(v_lng, v_lat), 4326)::extensions.geography,
     'high', 'surveyed', 'reference', 'station_type', v_dra_id, false),
    ('d0000033-0000-4000-8000-000000000333', 1333, 'STN-1333', 'Drift Station 33c', v_lat, v_lng,
     extensions.st_setsrid(extensions.st_makepoint(v_lng, v_lat), 4326)::extensions.geography,
     'low', 'other', 'reference', 'station_type', v_dra_id, false)
  ON CONFLICT (id) DO NOTHING;

  v_cluster := matrix_map.canonical_five_decimal_cluster(v_lat, v_lng);
  PERFORM matrix_map.upsert_site_aggregate_candidate(v_dra_id, v_cluster, 'Drift 33', v_admin_id, 'drift test 33');
  SELECT id INTO v_pub_id FROM matrix_map.site_aggregate_publications
  WHERE source_dra_id = v_dra_id AND coordinate_cluster_id = v_cluster;

  SELECT snapshot_drift_state, sample_count_high, sample_count_medium, sample_count_low
    INTO v_state, v_high, v_medium, v_low
  FROM matrix_map.fetch_admin_site_aggregate_publications(v_pub_id, 1000, 0);

  IF v_state = 'match' AND v_high = 1 AND v_medium = 1 AND v_low = 1 THEN
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_33', 'Verify a MIXED-TIER cluster (high + medium + low at one coordinate) reports snapshot_drift_state=match after refresh, proving the server compares the same all-tier population it persisted and does not false-drift', 'PASS',
      format('state=%s; tiers high=%s medium=%s low=%s', v_state, v_high, v_medium, v_low));
  ELSE
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_33', 'Verify a MIXED-TIER cluster (high + medium + low at one coordinate) reports snapshot_drift_state=match after refresh, proving the server compares the same all-tier population it persisted and does not false-drift', 'FAIL',
      format('state=%s (exp match); tiers high=%s medium=%s low=%s (exp 1/1/1)', v_state, v_high, v_medium, v_low));
  END IF;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
  VALUES ('TEST_33', 'Verify a MIXED-TIER cluster (high + medium + low at one coordinate) reports snapshot_drift_state=match after refresh, proving the server compares the same all-tier population it persisted and does not false-drift', 'FAIL', SQLSTATE, SQLERRM);
END $$;

-- TEST 34: a publication with NO live snapshot reports 'unknown', not 'match'
DO $$
DECLARE
  v_dra_id uuid := 'a1111111-1111-1111-1111-111111111111';
  v_admin_id uuid := '11111111-1111-1111-1111-111111111111';
  v_lat double precision := 49.34001;
  v_lng double precision := -123.34001;
  v_cluster text;
  v_pub_id uuid;
  v_state_before text;
  v_state_after text;
  v_row_count integer;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","email":"admin@example.com"}', true);

  INSERT INTO matrix_map.samples (
    id, bnrrm_station_id, station_id, display_name, latitude, longitude,
    geometry, coordinate_quality_tier, coordinate_source, classification, classification_source, source_dra_id, public
  ) VALUES (
    'd0000034-0000-4000-8000-000000000034', 134, 'STN-134', 'Drift Station 34', v_lat, v_lng,
    extensions.st_setsrid(extensions.st_makepoint(v_lng, v_lat), 4326)::extensions.geography,
    'medium', 'bc_csr_centroid', 'reference', 'station_type', v_dra_id, false
  ) ON CONFLICT (id) DO NOTHING;

  v_cluster := matrix_map.canonical_five_decimal_cluster(v_lat, v_lng);
  PERFORM matrix_map.upsert_site_aggregate_candidate(v_dra_id, v_cluster, 'Drift 34', v_admin_id, 'drift test 34');
  SELECT id INTO v_pub_id FROM matrix_map.site_aggregate_publications
  WHERE source_dra_id = v_dra_id AND coordinate_cluster_id = v_cluster;

  SELECT snapshot_drift_state INTO v_state_before
  FROM matrix_map.fetch_admin_site_aggregate_publications(v_pub_id, 1000, 0);

  -- Remove the live samples. The publication persists and stays member-visible,
  -- so the admin row MUST still be returned (LEFT, not INNER) and must report
  -- unknown rather than a confirmed match.
  DELETE FROM matrix_map.samples WHERE id = 'd0000034-0000-4000-8000-000000000034';

  SELECT count(*) INTO v_row_count
  FROM matrix_map.fetch_admin_site_aggregate_publications(v_pub_id, 1000, 0);

  SELECT snapshot_drift_state INTO v_state_after
  FROM matrix_map.fetch_admin_site_aggregate_publications(v_pub_id, 1000, 0);

  IF v_state_before = 'match' AND v_state_after = 'unknown' AND v_row_count = 1 THEN
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_34', 'Verify a publication whose live aggregate has vanished still appears (LEFT LATERAL, not INNER) and reports snapshot_drift_state=unknown rather than a confirmed match, so the orphan keeps its Unpublish route', 'PASS',
      format('before=%s after=%s; row still returned (count=%s)', v_state_before, v_state_after, v_row_count));
  ELSE
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_34', 'Verify a publication whose live aggregate has vanished still appears (LEFT LATERAL, not INNER) and reports snapshot_drift_state=unknown rather than a confirmed match, so the orphan keeps its Unpublish route', 'FAIL',
      format('before=%s (exp match) after=%s (exp unknown); row_count=%s (exp 1)', v_state_before, v_state_after, v_row_count));
  END IF;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
  VALUES ('TEST_34', 'Verify a publication whose live aggregate has vanished still appears (LEFT LATERAL, not INNER) and reports snapshot_drift_state=unknown rather than a confirmed match, so the orphan keeps its Unpublish route', 'FAIL', SQLSTATE, SQLERRM);
END $$;

-- TEST 35: AUTHORIZATION -- the authoritative helper stays unreachable directly,
-- and the admin RPC keeps its exact role boundary
DO $$
DECLARE
  v_anon_exec boolean;
  v_auth_exec boolean;
  v_svc_exec boolean;
  v_pub_exec boolean;
  v_member_sqlstate text := NULL;
  v_admin_ok boolean := false;
BEGIN
  -- The snapshot helper is the authority the admin RPC calls INTERNALLY. It must
  -- remain non-executable by every client-facing role; the RPC reaches it only
  -- by being SECURITY DEFINER owned by matrix_map_owner, which owns it.
  SELECT
    has_function_privilege('anon', 'matrix_map.current_site_aggregate_snapshot(uuid, text)', 'EXECUTE'),
    has_function_privilege('authenticated', 'matrix_map.current_site_aggregate_snapshot(uuid, text)', 'EXECUTE'),
    has_function_privilege('service_role', 'matrix_map.current_site_aggregate_snapshot(uuid, text)', 'EXECUTE'),
    has_function_privilege('public', 'matrix_map.current_site_aggregate_snapshot(uuid, text)', 'EXECUTE')
  INTO v_anon_exec, v_auth_exec, v_svc_exec, v_pub_exec;

  -- A MEMBER (authenticated but without admin/matrix_admin) must still be
  -- refused by the admin RPC with 42501, unchanged by the drift addition.
  PERFORM set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","email":"member@example.com"}', true);
  BEGIN
    PERFORM * FROM matrix_map.fetch_admin_site_aggregate_publications(NULL, 1, 0);
    v_member_sqlstate := 'NO_RAISE';
  EXCEPTION WHEN OTHERS THEN
    v_member_sqlstate := SQLSTATE;
  END;

  -- An ADMIN must still succeed.
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","email":"admin@example.com"}', true);
  BEGIN
    PERFORM * FROM matrix_map.fetch_admin_site_aggregate_publications(NULL, 1, 0);
    v_admin_ok := true;
  EXCEPTION WHEN OTHERS THEN
    v_admin_ok := false;
  END;

  IF v_anon_exec = false AND v_auth_exec = false AND v_svc_exec = false AND v_pub_exec = false
     AND v_member_sqlstate = '42501' AND v_admin_ok THEN
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_35', 'Verify adding server-side drift did NOT expose the authoritative helper: current_site_aggregate_snapshot remains non-executable by anon/authenticated/service_role/PUBLIC, while fetch_admin_site_aggregate_publications still refuses a member with 42501 and still serves an admin', 'PASS',
      format('snapshot EXECUTE anon=%s auth=%s svc=%s public=%s; member=%s admin_ok=%s', v_anon_exec, v_auth_exec, v_svc_exec, v_pub_exec, v_member_sqlstate, v_admin_ok));
  ELSE
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_35', 'Verify adding server-side drift did NOT expose the authoritative helper: current_site_aggregate_snapshot remains non-executable by anon/authenticated/service_role/PUBLIC, while fetch_admin_site_aggregate_publications still refuses a member with 42501 and still serves an admin', 'FAIL',
      format('snapshot EXECUTE anon=%s auth=%s svc=%s public=%s (exp all false); member=%s (exp 42501) admin_ok=%s (exp true)', v_anon_exec, v_auth_exec, v_svc_exec, v_pub_exec, v_member_sqlstate, v_admin_ok));
  END IF;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
  VALUES ('TEST_35', 'Verify adding server-side drift did NOT expose the authoritative helper: current_site_aggregate_snapshot remains non-executable by anon/authenticated/service_role/PUBLIC, while fetch_admin_site_aggregate_publications still refuses a member with 42501 and still serves an admin', 'FAIL', SQLSTATE, SQLERRM);
END $$;

-- TEST 36: a SOFT-DELETED DRA fails closed to 'unknown', not 'match'
DO $$
DECLARE
  v_dra_id uuid := 'd0000036-0000-4000-8000-000000000036';
  v_admin_id uuid := '11111111-1111-1111-1111-111111111111';
  v_lat double precision := 49.36001;
  v_lng double precision := -123.36001;
  v_cluster text;
  v_pub_id uuid;
  v_state_before text;
  v_state_after text;
  v_row_count integer;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","email":"admin@example.com"}', true);

  INSERT INTO matrix_map.dras (id, title, citation, public, is_deleted)
  VALUES (v_dra_id, 'Soft Delete DRA 36', 'Citation 36', false, false)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO matrix_map.samples (
    id, bnrrm_station_id, station_id, display_name, latitude, longitude,
    geometry, coordinate_quality_tier, coordinate_source, classification, classification_source, source_dra_id, public
  ) VALUES (
    'd0000036-0000-4000-8000-000000000360', 1360, 'STN-1360', 'Drift Station 36', v_lat, v_lng,
    extensions.st_setsrid(extensions.st_makepoint(v_lng, v_lat), 4326)::extensions.geography,
    'medium', 'bc_csr_centroid', 'reference', 'station_type', v_dra_id, false
  ) ON CONFLICT (id) DO NOTHING;

  v_cluster := matrix_map.canonical_five_decimal_cluster(v_lat, v_lng);
  PERFORM matrix_map.upsert_site_aggregate_candidate(v_dra_id, v_cluster, 'Drift 36', v_admin_id, 'drift test 36');
  SELECT id INTO v_pub_id FROM matrix_map.site_aggregate_publications
  WHERE source_dra_id = v_dra_id AND coordinate_cluster_id = v_cluster;

  SELECT snapshot_drift_state INTO v_state_before
  FROM matrix_map.fetch_admin_site_aggregate_publications(v_pub_id, 1000, 0);

  -- Soft-delete the DRA. Its samples REMAIN, so the snapshot still recomputes
  -- an identical hash -- the naive comparison would still say 'match' while
  -- flip_site_aggregate_public would refuse the publish with UE409.
  UPDATE matrix_map.dras SET is_deleted = true WHERE id = v_dra_id;

  SELECT count(*) INTO v_row_count
  FROM matrix_map.fetch_admin_site_aggregate_publications(v_pub_id, 1000, 0);

  SELECT snapshot_drift_state INTO v_state_after
  FROM matrix_map.fetch_admin_site_aggregate_publications(v_pub_id, 1000, 0);

  -- Clean up so later runs are unaffected.
  UPDATE matrix_map.dras SET is_deleted = false WHERE id = v_dra_id;

  IF v_state_before = 'match' AND v_state_after = 'unknown' AND v_row_count = 1 THEN
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_36', 'Verify a candidate whose DRA has been SOFT-DELETED reports snapshot_drift_state=unknown rather than match, so the admin surface disables Publish before dispatch instead of failing at flip_site_aggregate_public, while the row (and its Unpublish route) remains reachable', 'PASS',
      format('before=%s after=%s; row still returned (count=%s)', v_state_before, v_state_after, v_row_count));
  ELSE
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_36', 'Verify a candidate whose DRA has been SOFT-DELETED reports snapshot_drift_state=unknown rather than match, so the admin surface disables Publish before dispatch instead of failing at flip_site_aggregate_public, while the row (and its Unpublish route) remains reachable', 'FAIL',
      format('before=%s (exp match) after=%s (exp unknown); row_count=%s (exp 1)', v_state_before, v_state_after, v_row_count));
  END IF;
EXCEPTION WHEN OTHERS THEN
  UPDATE matrix_map.dras SET is_deleted = false WHERE id = 'd0000036-0000-4000-8000-000000000036';
  INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
  VALUES ('TEST_36', 'Verify a candidate whose DRA has been SOFT-DELETED reports snapshot_drift_state=unknown rather than match, so the admin surface disables Publish before dispatch instead of failing at flip_site_aggregate_public, while the row (and its Unpublish route) remains reachable', 'FAIL', SQLSTATE, SQLERRM);
END $$;

-- ===========================================================================
-- F3: matrix_map.blank_trim is the SINGLE text-meaningfulness authority.
-- ===========================================================================
-- PostgreSQL `trim(text)` strips U+0020 ONLY, so every `length(trim(x)) > 0`
-- predicate accepted a tab-only or NBSP-only member-facing label. Non-ASCII
-- characters are written with chr() so this file stays plain ASCII.

DO $$
DECLARE
  v_blank_inputs text[] := ARRAY[
    chr(9),      -- tab
    chr(10),     -- line feed
    chr(11),     -- vertical tab
    chr(12),     -- form feed
    chr(13),     -- carriage return
    chr(32),     -- space
    chr(160),    -- no-break space
    chr(5760),   -- U+1680 ogham space mark
    chr(8192),   -- U+2000 en quad
    chr(8202),   -- U+200A hair space
    chr(8203),   -- U+200B zero width space
    chr(8232),   -- U+2028 line separator
    chr(8233),   -- U+2029 paragraph separator
    chr(8239),   -- U+202F narrow no-break space
    chr(8287),   -- U+205F medium mathematical space
    chr(12288),  -- U+3000 ideographic space
    chr(65279),  -- U+FEFF zero width no-break space (BOM)
    chr(9) || chr(160) || chr(65279)
  ];
  v_input text;
  v_failures text := '';
BEGIN
  FOREACH v_input IN ARRAY v_blank_inputs LOOP
    IF length(matrix_map.blank_trim(v_input)) <> 0 THEN
      v_failures := v_failures || format('codepoint %s not stripped; ', ascii(v_input));
    END IF;
  END LOOP;

  IF v_failures = '' THEN
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_37', 'Verify matrix_map.blank_trim reduces every supported whitespace class (ASCII controls, NBSP, Unicode separator spaces, ZWSP, BOM, and mixed runs) to the empty string, so a visually blank member-facing label cannot pass validation', 'PASS',
      format('%s blank classes stripped', array_length(v_blank_inputs, 1)));
  ELSE
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_37', 'Verify matrix_map.blank_trim reduces every supported whitespace class (ASCII controls, NBSP, Unicode separator spaces, ZWSP, BOM, and mixed runs) to the empty string, so a visually blank member-facing label cannot pass validation', 'FAIL', v_failures);
  END IF;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
  VALUES ('TEST_37', 'Verify matrix_map.blank_trim reduces every supported whitespace class (ASCII controls, NBSP, Unicode separator spaces, ZWSP, BOM, and mixed runs) to the empty string, so a visually blank member-facing label cannot pass validation', 'FAIL', SQLSTATE, SQLERRM);
END $$;

DO $$
DECLARE
  v_kept text[] := ARRAY[
    'Site aggregate 1',
    chr(233) || 'tude',
    chr(20320) || chr(22909),
    chr(8205),
    chr(8204),
    chr(9) || 'Padded' || chr(160)
  ];
  v_expected text[] := ARRAY[
    'Site aggregate 1',
    chr(233) || 'tude',
    chr(20320) || chr(22909),
    chr(8205),
    chr(8204),
    'Padded'
  ];
  v_failures text := '';
  i integer;
BEGIN
  FOR i IN 1 .. array_length(v_kept, 1) LOOP
    IF matrix_map.blank_trim(v_kept[i]) IS DISTINCT FROM v_expected[i] THEN
      v_failures := v_failures || format('index %s altered; ', i);
    END IF;
  END LOOP;

  IF v_failures = '' THEN
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_38', 'Verify matrix_map.blank_trim PRESERVES meaningful text including non-ASCII letters, CJK, and the orthographically significant ZWJ and ZWNJ, and trims only the blank edges of padded values', 'PASS',
      format('%s positive controls preserved', array_length(v_kept, 1)));
  ELSE
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_38', 'Verify matrix_map.blank_trim PRESERVES meaningful text including non-ASCII letters, CJK, and the orthographically significant ZWJ and ZWNJ, and trims only the blank edges of padded values', 'FAIL', v_failures);
  END IF;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
  VALUES ('TEST_38', 'Verify matrix_map.blank_trim PRESERVES meaningful text including non-ASCII letters, CJK, and the orthographically significant ZWJ and ZWNJ, and trims only the blank edges of padded values', 'FAIL', SQLSTATE, SQLERRM);
END $$;

DO $$
DECLARE
  v_dra_id uuid := 'a1111111-1111-1111-1111-111111111111';
  v_admin_id uuid := '11111111-1111-1111-1111-111111111111';
  v_cluster text;
  v_raised boolean := false;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","email":"admin@example.com"}', true);
  -- Reuse the TEST_30 cluster: a REAL, populated cluster, so the only reason
  -- this can fail is the blank label -- not a missing snapshot.
  v_cluster := matrix_map.canonical_five_decimal_cluster(49.30001, -123.30001);
  BEGIN
    PERFORM matrix_map.upsert_site_aggregate_candidate(
      v_dra_id, v_cluster, chr(9), v_admin_id, 'blank label attempt'
    );
  EXCEPTION WHEN sqlstate 'UE422' THEN
    v_raised := true;
  END;

  IF v_raised THEN
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_39', 'Verify upsert_site_aggregate_candidate REJECTS a tab-only member_display_label with UE422 at the SQL boundary, proving the defense-in-depth claim holds independently of the API route JavaScript validation', 'PASS', 'UE422 raised');
  ELSE
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_39', 'Verify upsert_site_aggregate_candidate REJECTS a tab-only member_display_label with UE422 at the SQL boundary, proving the defense-in-depth claim holds independently of the API route JavaScript validation', 'FAIL', 'tab-only label was ACCEPTED');
  END IF;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
  VALUES ('TEST_39', 'Verify upsert_site_aggregate_candidate REJECTS a tab-only member_display_label with UE422 at the SQL boundary, proving the defense-in-depth claim holds independently of the API route JavaScript validation', 'FAIL', SQLSTATE, SQLERRM);
END $$;

-- ===========================================================================
-- F4: pagination happens INSIDE fetch_admin_site_aggregate_publications.
-- ===========================================================================

DO $$
DECLARE
  v_total integer;
  v_page1 uuid[];
  v_page2 uuid[];
  v_all uuid[];
  v_distinct integer;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","email":"admin@example.com"}', true);
  SELECT count(*) INTO v_total FROM matrix_map.site_aggregate_publications;

  SELECT array_agg(publication_id) INTO v_page1
  FROM matrix_map.fetch_admin_site_aggregate_publications(NULL, 1, 0);

  SELECT array_agg(publication_id) INTO v_page2
  FROM matrix_map.fetch_admin_site_aggregate_publications(NULL, 1, 1);

  v_all := coalesce(v_page1, ARRAY[]::uuid[]) || coalesce(v_page2, ARRAY[]::uuid[]);
  SELECT count(DISTINCT u) INTO v_distinct FROM unnest(v_all) AS u;

  -- NO VACUOUS PASS. With fewer than two published rows this control proves
  -- nothing about LIMIT/OFFSET, so it FAILS rather than reporting green.
  IF v_total >= 2 AND array_length(v_all, 1) = 2 AND v_distinct = 2 THEN
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_40', 'Verify consecutive single-row pages of fetch_admin_site_aggregate_publications return distinct publications with no gap and no duplicate, proving the in-function LIMIT and OFFSET use a stable total ordering', 'PASS',
      format('total=%s rows=%s distinct=%s', v_total, array_length(v_all, 1), v_distinct));
  ELSE
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_40', 'Verify consecutive single-row pages of fetch_admin_site_aggregate_publications return distinct publications with no gap and no duplicate, proving the in-function LIMIT and OFFSET use a stable total ordering', 'FAIL',
      format('total=%s rows=%s distinct=%s', v_total, array_length(v_all, 1), v_distinct));
  END IF;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
  VALUES ('TEST_40', 'Verify consecutive single-row pages of fetch_admin_site_aggregate_publications return distinct publications with no gap and no duplicate, proving the in-function LIMIT and OFFSET use a stable total ordering', 'FAIL', SQLSTATE, SQLERRM);
END $$;

DO $$
DECLARE
  v_ok integer := 0;
  v_failures text := '';
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","email":"admin@example.com"}', true);
  BEGIN PERFORM * FROM matrix_map.fetch_admin_site_aggregate_publications(NULL, NULL, 0);
    v_failures := v_failures || 'null_limit accepted; ';
  EXCEPTION WHEN sqlstate 'UE422' THEN v_ok := v_ok + 1; END;

  BEGIN PERFORM * FROM matrix_map.fetch_admin_site_aggregate_publications(NULL, 0, 0);
    v_failures := v_failures || 'zero_limit accepted; ';
  EXCEPTION WHEN sqlstate 'UE422' THEN v_ok := v_ok + 1; END;

  BEGIN PERFORM * FROM matrix_map.fetch_admin_site_aggregate_publications(NULL, -1, 0);
    v_failures := v_failures || 'negative_limit accepted; ';
  EXCEPTION WHEN sqlstate 'UE422' THEN v_ok := v_ok + 1; END;

  BEGIN PERFORM * FROM matrix_map.fetch_admin_site_aggregate_publications(NULL, 1001, 0);
    v_failures := v_failures || 'oversized_limit accepted; ';
  EXCEPTION WHEN sqlstate 'UE422' THEN v_ok := v_ok + 1; END;

  BEGIN PERFORM * FROM matrix_map.fetch_admin_site_aggregate_publications(NULL, 1, NULL);
    v_failures := v_failures || 'null_offset accepted; ';
  EXCEPTION WHEN sqlstate 'UE422' THEN v_ok := v_ok + 1; END;

  BEGIN PERFORM * FROM matrix_map.fetch_admin_site_aggregate_publications(NULL, 1, -1);
    v_failures := v_failures || 'negative_offset accepted; ';
  EXCEPTION WHEN sqlstate 'UE422' THEN v_ok := v_ok + 1; END;

  IF v_ok = 6 THEN
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_41', 'Verify fetch_admin_site_aggregate_publications FAILS CLOSED with UE422 on a null, zero, negative, or oversized p_limit and on a null or negative p_offset, so an invalid bound cannot be coerced into an unbounded scan', 'PASS', format('%s/6 invalid bounds rejected', v_ok));
  ELSE
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_41', 'Verify fetch_admin_site_aggregate_publications FAILS CLOSED with UE422 on a null, zero, negative, or oversized p_limit and on a null or negative p_offset, so an invalid bound cannot be coerced into an unbounded scan', 'FAIL', v_failures);
  END IF;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
  VALUES ('TEST_41', 'Verify fetch_admin_site_aggregate_publications FAILS CLOSED with UE422 on a null, zero, negative, or oversized p_limit and on a null or negative p_offset, so an invalid bound cannot be coerced into an unbounded scan', 'FAIL', SQLSTATE, SQLERRM);
END $$;

DO $$
DECLARE
  v_pub_id uuid;
  v_rows integer;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","email":"admin@example.com"}', true);
  SELECT id INTO v_pub_id FROM matrix_map.site_aggregate_publications ORDER BY id ASC LIMIT 1;

  IF v_pub_id IS NULL THEN
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_42', 'Verify an exact-id readback through fetch_admin_site_aggregate_publications stays bounded to a single row under explicit pagination bounds', 'PASS', 'no publications present; vacuously bounded');
  ELSE
    SELECT count(*) INTO v_rows
    FROM matrix_map.fetch_admin_site_aggregate_publications(v_pub_id, 1, 0);

    IF v_rows = 1 THEN
      INSERT INTO public.test_results (test_id, description, status, details)
      VALUES ('TEST_42', 'Verify an exact-id readback through fetch_admin_site_aggregate_publications stays bounded to a single row under explicit pagination bounds', 'PASS', format('rows=%s', v_rows));
    ELSE
      INSERT INTO public.test_results (test_id, description, status, details)
      VALUES ('TEST_42', 'Verify an exact-id readback through fetch_admin_site_aggregate_publications stays bounded to a single row under explicit pagination bounds', 'FAIL', format('rows=%s exp 1', v_rows));
    END IF;
  END IF;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
  VALUES ('TEST_42', 'Verify an exact-id readback through fetch_admin_site_aggregate_publications stays bounded to a single row under explicit pagination bounds', 'FAIL', SQLSTATE, SQLERRM);
END $$;

-- ===========================================================================
-- F9: publish is bound to the REVIEWED version, not merely to the id.
-- ===========================================================================
-- Admin A reads a label/version, Admin B refreshes the candidate, Admin A
-- publishes with the stale token. Without the gate, A publishes a
-- member-visible string A never saw.

DO $$
DECLARE
  v_dra_id uuid := 'a1111111-1111-1111-1111-111111111111';
  v_admin_id uuid := '11111111-1111-1111-1111-111111111111';
  v_cluster text;
  v_pub_id uuid;
  v_seen_updated_at timestamptz;
  v_audit_before integer;
  v_audit_after integer;
  v_is_published boolean;
  v_raised boolean := false;
  v_state text;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","email":"admin@example.com"}', true);

  INSERT INTO matrix_map.samples (
    id, bnrrm_station_id, station_id, display_name, latitude, longitude,
    geometry, coordinate_quality_tier, coordinate_source, classification, classification_source, source_dra_id, public
  ) VALUES (
    'd0000043-0000-4000-8000-000000000043', 143, 'STN-143', 'Version Station 43', 49.43001, -123.43001,
    extensions.st_setsrid(extensions.st_makepoint(-123.43001, 49.43001), 4326)::extensions.geography,
    'medium', 'bc_csr_centroid', 'reference', 'station_type', v_dra_id, false
  ) ON CONFLICT (id) DO NOTHING;

  v_cluster := matrix_map.canonical_five_decimal_cluster(49.43001, -123.43001);

  -- Admin A creates and REVIEWS this version.
  PERFORM matrix_map.upsert_site_aggregate_candidate(v_dra_id, v_cluster, 'Reviewed Label A', v_admin_id, 'create 43');
  SELECT id, updated_at INTO v_pub_id, v_seen_updated_at
  FROM matrix_map.site_aggregate_publications
  WHERE source_dra_id = v_dra_id AND coordinate_cluster_id = v_cluster;

  -- Admin B refreshes it to a DIFFERENT member-visible label.
  PERFORM pg_sleep(0.01);
  PERFORM matrix_map.upsert_site_aggregate_candidate(v_dra_id, v_cluster, 'Substituted Label B', v_admin_id, 'refresh 43 by another admin');

  SELECT count(*) INTO v_audit_before FROM matrix_map.site_aggregate_publication_audit WHERE publication_id = v_pub_id;

  -- Admin A publishes using the version A actually reviewed.
  BEGIN
    PERFORM matrix_map.flip_site_aggregate_public(v_pub_id, true, v_admin_id, 'publish 43', v_seen_updated_at);
  EXCEPTION WHEN sqlstate 'UE409' THEN
    v_raised := true;
  END;

  SELECT is_published INTO v_is_published FROM matrix_map.site_aggregate_publications WHERE id = v_pub_id;
  SELECT count(*) INTO v_audit_after FROM matrix_map.site_aggregate_publication_audit WHERE publication_id = v_pub_id;

  IF v_raised AND v_is_published = false AND v_audit_after = v_audit_before THEN
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_43', 'Verify publishing with a STALE expected_updated_at raises UE409, leaves the publication unpublished, and writes NO publication audit row, so an operator cannot publish a member-visible label substituted after they reviewed it', 'PASS',
      format('raised=%s published=%s audit_before=%s audit_after=%s', v_raised, v_is_published, v_audit_before, v_audit_after));
  ELSE
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_43', 'Verify publishing with a STALE expected_updated_at raises UE409, leaves the publication unpublished, and writes NO publication audit row, so an operator cannot publish a member-visible label substituted after they reviewed it', 'FAIL',
      format('raised=%s (exp t) published=%s (exp f) audit_before=%s audit_after=%s (exp equal)', v_raised, v_is_published, v_audit_before, v_audit_after));
  END IF;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
  VALUES ('TEST_43', 'Verify publishing with a STALE expected_updated_at raises UE409, leaves the publication unpublished, and writes NO publication audit row, so an operator cannot publish a member-visible label substituted after they reviewed it', 'FAIL', SQLSTATE, SQLERRM);
END $$;

DO $$
DECLARE
  v_dra_id uuid := 'a1111111-1111-1111-1111-111111111111';
  v_admin_id uuid := '11111111-1111-1111-1111-111111111111';
  v_cluster text;
  v_pub_id uuid;
  v_current timestamptz;
  v_label text;
  v_member_label text;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","email":"admin@example.com"}', true);
  v_cluster := matrix_map.canonical_five_decimal_cluster(49.43001, -123.43001);

  -- Re-read the CURRENT version, then publish: this must succeed, and members
  -- must receive exactly the label that was re-read.
  SELECT id, updated_at, member_display_label INTO v_pub_id, v_current, v_label
  FROM matrix_map.site_aggregate_publications
  WHERE source_dra_id = v_dra_id AND coordinate_cluster_id = v_cluster;

  PERFORM matrix_map.flip_site_aggregate_public(v_pub_id, true, v_admin_id, 'publish 43 after re-read', v_current);

  SELECT label INTO v_member_label
  FROM matrix_map.fetch_published_site_aggregates(1000, 0)
  WHERE label = v_label;

  IF v_member_label IS NOT DISTINCT FROM v_label THEN
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_44', 'Verify re-reading the current version then publishing SUCCEEDS and members are served exactly the reviewed member_display_label', 'PASS',
      format('label=%s', v_label));
  ELSE
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_44', 'Verify re-reading the current version then publishing SUCCEEDS and members are served exactly the reviewed member_display_label', 'FAIL',
      format('reviewed=%s member_saw=%s', v_label, coalesce(v_member_label, '<absent>')));
  END IF;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
  VALUES ('TEST_44', 'Verify re-reading the current version then publishing SUCCEEDS and members are served exactly the reviewed member_display_label', 'FAIL', SQLSTATE, SQLERRM);
END $$;

DO $$
DECLARE
  v_dra_id uuid := 'a1111111-1111-1111-1111-111111111111';
  v_admin_id uuid := '11111111-1111-1111-1111-111111111111';
  v_cluster text;
  v_pub_id uuid;
  v_null_raised boolean := false;
  v_stale_raised boolean := false;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","email":"admin@example.com"}', true);
  v_cluster := matrix_map.canonical_five_decimal_cluster(49.43001, -123.43001);
  SELECT id INTO v_pub_id FROM matrix_map.site_aggregate_publications
  WHERE source_dra_id = v_dra_id AND coordinate_cluster_id = v_cluster;

  -- Unpublish first so the publish attempts below are state-changing.
  PERFORM matrix_map.flip_site_aggregate_public(v_pub_id, false, v_admin_id, 'unpublish before token tests', NULL);

  BEGIN
    PERFORM matrix_map.flip_site_aggregate_public(v_pub_id, true, v_admin_id, 'publish with null token', NULL);
  EXCEPTION WHEN sqlstate 'UE409' THEN v_null_raised := true; END;

  BEGIN
    PERFORM matrix_map.flip_site_aggregate_public(v_pub_id, true, v_admin_id, 'publish with stale token', '2000-01-01T00:00:00Z'::timestamptz);
  EXCEPTION WHEN sqlstate 'UE409' THEN v_stale_raised := true; END;

  IF v_null_raised AND v_stale_raised THEN
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_45', 'Verify a DIRECT authenticated RPC publish with a NULL or STALE expected_updated_at fails closed with UE409, so the reviewed-version contract is enforced at the SQL boundary and not only in the API route', 'PASS', 'null and stale both rejected');
  ELSE
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_45', 'Verify a DIRECT authenticated RPC publish with a NULL or STALE expected_updated_at fails closed with UE409, so the reviewed-version contract is enforced at the SQL boundary and not only in the API route', 'FAIL',
      format('null_raised=%s stale_raised=%s (both exp t)', v_null_raised, v_stale_raised));
  END IF;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
  VALUES ('TEST_45', 'Verify a DIRECT authenticated RPC publish with a NULL or STALE expected_updated_at fails closed with UE409, so the reviewed-version contract is enforced at the SQL boundary and not only in the API route', 'FAIL', SQLSTATE, SQLERRM);
END $$;

DO $$
DECLARE
  v_overloads integer;
BEGIN
  SELECT count(*) INTO v_overloads
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'matrix_map'
    AND p.proname = 'flip_site_aggregate_public'
    AND pg_catalog.oidvectortypes(p.proargtypes) = 'uuid, boolean, uuid, text';

  IF v_overloads = 0 THEN
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_46', 'Verify the four-argument flip_site_aggregate_public overload is ABSENT, so a direct authenticated PostgREST caller cannot resolve the pre-token signature and bypass the reviewed-version contract', 'PASS', 'no four-argument overload');
  ELSE
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_46', 'Verify the four-argument flip_site_aggregate_public overload is ABSENT, so a direct authenticated PostgREST caller cannot resolve the pre-token signature and bypass the reviewed-version contract', 'FAIL', format('found %s', v_overloads));
  END IF;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
  VALUES ('TEST_46', 'Verify the four-argument flip_site_aggregate_public overload is ABSENT, so a direct authenticated PostgREST caller cannot resolve the pre-token signature and bypass the reviewed-version contract', 'FAIL', SQLSTATE, SQLERRM);
END $$;

DO $$
DECLARE
  v_dra_id uuid := 'a1111111-1111-1111-1111-111111111111';
  v_admin_id uuid := '11111111-1111-1111-1111-111111111111';
  v_cluster text;
  v_pub_id uuid;
  v_current timestamptz;
  v_published_after boolean;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","email":"admin@example.com"}', true);
  v_cluster := matrix_map.canonical_five_decimal_cluster(49.43001, -123.43001);
  SELECT id, updated_at INTO v_pub_id, v_current FROM matrix_map.site_aggregate_publications
  WHERE source_dra_id = v_dra_id AND coordinate_cluster_id = v_cluster;

  PERFORM matrix_map.flip_site_aggregate_public(v_pub_id, true, v_admin_id, 'publish before retraction test', v_current);

  -- EMERGENCY RETRACTION with a deliberately stale token. Unpublish only
  -- REDUCES member visibility, so it must remain reachable from a stale view.
  PERFORM matrix_map.flip_site_aggregate_public(v_pub_id, false, v_admin_id, 'emergency retraction with stale token', '2000-01-01T00:00:00Z'::timestamptz);

  SELECT is_published INTO v_published_after FROM matrix_map.site_aggregate_publications WHERE id = v_pub_id;

  IF v_published_after = false THEN
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_47', 'Verify UNPUBLISH still succeeds with a stale or missing expected_updated_at, preserving the emergency retraction path, because retraction only REDUCES member visibility and must not be blocked by a stale operator view', 'PASS', 'retraction succeeded with stale token');
  ELSE
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_47', 'Verify UNPUBLISH still succeeds with a stale or missing expected_updated_at, preserving the emergency retraction path, because retraction only REDUCES member visibility and must not be blocked by a stale operator view', 'FAIL', 'retraction was blocked');
  END IF;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
  VALUES ('TEST_47', 'Verify UNPUBLISH still succeeds with a stale or missing expected_updated_at, preserving the emergency retraction path, because retraction only REDUCES member visibility and must not be blocked by a stale operator view', 'FAIL', SQLSTATE, SQLERRM);
END $$;

-- ===========================================================================
-- F12: the drift-lookup predicate is served by an index, not a filter.
-- ===========================================================================

DO $$
DECLARE
  v_indexdef text;
BEGIN
  SELECT indexdef INTO v_indexdef
  FROM pg_indexes
  WHERE schemaname = 'matrix_map' AND indexname = 'samples_dra_canonical_cluster';

  IF v_indexdef IS NOT NULL
     AND v_indexdef LIKE '%source_dra_id%'
     AND v_indexdef LIKE '%canonical_five_decimal_cluster%' THEN
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_48', 'Verify the composite expression index on (source_dra_id, canonical_five_decimal_cluster(latitude, longitude)) exists, since samples_source_dra_id alone leaves the cluster predicate as an unindexable per-row filter that the admin page pays once per publication', 'PASS', v_indexdef);
  ELSE
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_48', 'Verify the composite expression index on (source_dra_id, canonical_five_decimal_cluster(latitude, longitude)) exists, since samples_source_dra_id alone leaves the cluster predicate as an unindexable per-row filter that the admin page pays once per publication', 'FAIL', coalesce(v_indexdef, '<index absent>'));
  END IF;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
  VALUES ('TEST_48', 'Verify the composite expression index on (source_dra_id, canonical_five_decimal_cluster(latitude, longitude)) exists, since samples_source_dra_id alone leaves the cluster predicate as an unindexable per-row filter that the admin page pays once per publication', 'FAIL', SQLSTATE, SQLERRM);
END $$;

DO $$
DECLARE
  v_plan text := '';
  v_line text;
  v_dra_id uuid := 'a1111111-1111-1111-1111-111111111111';
BEGIN
  -- PLANNER-USABILITY, not merely presence. The replay dataset is tiny, so the
  -- planner would rationally choose a sequential scan on size alone; disabling
  -- seqscan asks the question that actually matters -- CAN this predicate be
  -- served by the index? The old single-column index could not, because the
  -- cluster half was a function call it could not satisfy.
  SET LOCAL enable_seqscan = off;
  FOR v_line IN
    EXECUTE format(
      'EXPLAIN SELECT 1 FROM matrix_map.samples WHERE source_dra_id = %L '
      'AND matrix_map.canonical_five_decimal_cluster(latitude, longitude) = %L',
      v_dra_id, '49.30001,-123.30001')
  LOOP
    v_plan := v_plan || v_line || ' ';
  END LOOP;
  RESET enable_seqscan;

  IF v_plan LIKE '%samples_dra_canonical_cluster%' THEN
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_49', 'Verify the planner can serve the snapshot lookup predicate (source_dra_id AND canonical cluster) from the composite expression index rather than filtering every row of the DRA, which is the difference the offline measurement showed between a 58 s and a 0.2 s admin page', 'PASS', v_plan);
  ELSE
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_49', 'Verify the planner can serve the snapshot lookup predicate (source_dra_id AND canonical cluster) from the composite expression index rather than filtering every row of the DRA, which is the difference the offline measurement showed between a 58 s and a 0.2 s admin page', 'FAIL', v_plan);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RESET enable_seqscan;
  INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
  VALUES ('TEST_49', 'Verify the planner can serve the snapshot lookup predicate (source_dra_id AND canonical cluster) from the composite expression index rather than filtering every row of the DRA, which is the difference the offline measurement showed between a 58 s and a 0.2 s admin page', 'FAIL', SQLSTATE, SQLERRM);
END $$;

-- ===========================================================================
-- F13: the MEMBER rpc paginates inside PostgreSQL.
-- ===========================================================================

DO $$
DECLARE
  v_overloads integer;
BEGIN
  SELECT count(*) INTO v_overloads
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'matrix_map'
    AND p.proname = 'fetch_published_site_aggregates'
    AND pg_catalog.oidvectortypes(p.proargtypes) = '';

  IF v_overloads = 0 THEN
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_50', 'Verify the no-argument fetch_published_site_aggregates overload is ABSENT, so PostgREST cannot resolve an unbounded member path that materializes the whole published set before trimming', 'PASS', 'no unbounded overload');
  ELSE
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_50', 'Verify the no-argument fetch_published_site_aggregates overload is ABSENT, so PostgREST cannot resolve an unbounded member path that materializes the whole published set before trimming', 'FAIL', format('found %s', v_overloads));
  END IF;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
  VALUES ('TEST_50', 'Verify the no-argument fetch_published_site_aggregates overload is ABSENT, so PostgREST cannot resolve an unbounded member path that materializes the whole published set before trimming', 'FAIL', SQLSTATE, SQLERRM);
END $$;

DO $$
DECLARE
  v_ok integer := 0;
  v_failures text := '';
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","email":"admin@example.com"}', true);

  BEGIN PERFORM * FROM matrix_map.fetch_published_site_aggregates(NULL, 0);
    v_failures := v_failures || 'null_limit accepted; ';
  EXCEPTION WHEN sqlstate 'UE422' THEN v_ok := v_ok + 1; END;

  BEGIN PERFORM * FROM matrix_map.fetch_published_site_aggregates(0, 0);
    v_failures := v_failures || 'zero_limit accepted; ';
  EXCEPTION WHEN sqlstate 'UE422' THEN v_ok := v_ok + 1; END;

  BEGIN PERFORM * FROM matrix_map.fetch_published_site_aggregates(1001, 0);
    v_failures := v_failures || 'oversized_limit accepted; ';
  EXCEPTION WHEN sqlstate 'UE422' THEN v_ok := v_ok + 1; END;

  BEGIN PERFORM * FROM matrix_map.fetch_published_site_aggregates(1, -1);
    v_failures := v_failures || 'negative_offset accepted; ';
  EXCEPTION WHEN sqlstate 'UE422' THEN v_ok := v_ok + 1; END;

  IF v_ok = 4 THEN
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_51', 'Verify fetch_published_site_aggregates FAILS CLOSED with UE422 on a null, zero or oversized p_limit and on a negative p_offset, so an invalid member-page bound cannot be coerced into an unbounded scan', 'PASS', format('%s/4 rejected', v_ok));
  ELSE
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_51', 'Verify fetch_published_site_aggregates FAILS CLOSED with UE422 on a null, zero or oversized p_limit and on a negative p_offset, so an invalid member-page bound cannot be coerced into an unbounded scan', 'FAIL', v_failures);
  END IF;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
  VALUES ('TEST_51', 'Verify fetch_published_site_aggregates FAILS CLOSED with UE422 on a null, zero or oversized p_limit and on a negative p_offset, so an invalid member-page bound cannot be coerced into an unbounded scan', 'FAIL', SQLSTATE, SQLERRM);
END $$;

DO $$
DECLARE
  v_dra_id uuid := 'a1111111-1111-1111-1111-111111111111';
  v_admin_id uuid := '11111111-1111-1111-1111-111111111111';
  v_cluster text;
  v_pub_id uuid;
  v_cur timestamptz;
  i integer;
BEGIN
  -- Seed TWO published aggregates so the member pagination control below has
  -- something to page through. Without them it could only pass vacuously.
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","email":"admin@example.com"}', true);
  FOR i IN 1..2 LOOP
    INSERT INTO matrix_map.samples (
      id, bnrrm_station_id, station_id, display_name, latitude, longitude,
      geometry, coordinate_quality_tier, coordinate_source, classification, classification_source, source_dra_id, public
    ) VALUES (
      ('d0000052-0000-4000-8000-00000000005' || i)::uuid, 1520 + i, 'STN-152' || i, 'Member Page Station ' || i,
      49.52000 + i * 0.001, -123.52000 - i * 0.001,
      extensions.st_setsrid(extensions.st_makepoint(-123.52000 - i * 0.001, 49.52000 + i * 0.001), 4326)::extensions.geography,
      'medium', 'bc_csr_centroid', 'reference', 'station_type', v_dra_id, false
    ) ON CONFLICT (id) DO NOTHING;

    v_cluster := matrix_map.canonical_five_decimal_cluster(49.52000 + i * 0.001, -123.52000 - i * 0.001);
    PERFORM matrix_map.upsert_site_aggregate_candidate(v_dra_id, v_cluster, 'Member Page Label ' || i, v_admin_id, 'seed member page ' || i);
    SELECT id, updated_at INTO v_pub_id, v_cur FROM matrix_map.site_aggregate_publications
    WHERE source_dra_id = v_dra_id AND coordinate_cluster_id = v_cluster;
    PERFORM matrix_map.flip_site_aggregate_public(v_pub_id, true, v_admin_id, 'seed publish ' || i, v_cur);
  END LOOP;
END $$;

DO $$
DECLARE
  v_total integer;
  v_p1 uuid[];
  v_p2 uuid[];
  v_all uuid[];
  v_distinct integer;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","email":"admin@example.com"}', true);

  SELECT count(*) INTO v_total FROM matrix_map.site_aggregate_publications WHERE is_published = true;

  SELECT array_agg(aggregate_id) INTO v_p1 FROM matrix_map.fetch_published_site_aggregates(1, 0);
  SELECT array_agg(aggregate_id) INTO v_p2 FROM matrix_map.fetch_published_site_aggregates(1, 1);

  v_all := coalesce(v_p1, ARRAY[]::uuid[]) || coalesce(v_p2, ARRAY[]::uuid[]);
  SELECT count(DISTINCT u) INTO v_distinct FROM unnest(v_all) AS u;

  -- NO VACUOUS PASS. With fewer than two published rows this control proves
  -- nothing about LIMIT/OFFSET, so it FAILS rather than reporting green.
  IF v_total >= 2 AND array_length(v_all, 1) = 2 AND v_distinct = 2 THEN
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_52', 'Verify consecutive single-row MEMBER pages return distinct aggregates with no gap and no duplicate, proving the in-function LIMIT and OFFSET sit under a stable total ordering', 'PASS',
      format('published=%s rows=%s distinct=%s', v_total, array_length(v_all, 1), v_distinct));
  ELSE
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_52', 'Verify consecutive single-row MEMBER pages return distinct aggregates with no gap and no duplicate, proving the in-function LIMIT and OFFSET sit under a stable total ordering', 'FAIL',
      format('published=%s rows=%s distinct=%s', v_total, array_length(v_all, 1), v_distinct));
  END IF;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
  VALUES ('TEST_52', 'Verify consecutive single-row MEMBER pages return distinct aggregates with no gap and no duplicate, proving the in-function LIMIT and OFFSET sit under a stable total ordering', 'FAIL', SQLSTATE, SQLERRM);
END $$;

-- G1 SEED for TEST_53. The member projection control below must be able to
-- OBSERVE the 3-decimal rounding, which means the SOURCE coordinates have to
-- carry MORE than three decimals AND have to move under that rounding. The
-- TEST_52 seed above uses `49.52000 + i * 0.001`, which is already exactly three
-- decimals, so it could never have exercised rounding at all.
--
-- SOURCE -> EXPECTED table (each step computed independently of the code under
-- test; `round(numeric, n)` in PostgreSQL is half-away-from-zero):
--
--   label                     source lat/lng   stored round(.,5)   member round(.,3)
--   G1 Projection Station A   49.5266749       49.52667            49.527   (up)
--                             -123.5312351     -123.53124          -123.531 (down)
--   G1 Projection Station B   49.5313982       49.53140            49.531   (down)
--                             -123.5268531     -123.52685          -123.527  (up)
--
-- Every one of the four expected values DIFFERS from both the source value and
-- the 5-decimal persisted value, so removing the member rounding, or changing it
-- to 2 or 4 decimals, changes the returned value and FAILS TEST_53. Two rows,
-- with both a round-up and a round-down case per axis, so a one-sided rounding
-- change cannot hide.
DO $$
DECLARE
  v_dra_id uuid := 'a1111111-1111-1111-1111-111111111111';
  v_admin_id uuid := '11111111-1111-1111-1111-111111111111';
  v_cluster text;
  v_pub_id uuid;
  v_cur timestamptz;
  v_lats double precision[] := ARRAY[49.5266749, 49.5313982];
  v_lngs double precision[] := ARRAY[-123.5312351, -123.5268531];
  v_labels text[] := ARRAY['G1 Projection Station A', 'G1 Projection Station B'];
  i integer;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","email":"admin@example.com"}', true);
  FOR i IN 1..2 LOOP
    INSERT INTO matrix_map.samples (
      id, bnrrm_station_id, station_id, display_name, latitude, longitude,
      geometry, coordinate_quality_tier, coordinate_source, classification, classification_source, source_dra_id, public
    ) VALUES (
      ('d0000053-0000-4000-8000-00000000005' || i)::uuid, 1530 + i, 'STN-153' || i, 'G1 Projection Station ' || i,
      v_lats[i], v_lngs[i],
      extensions.st_setsrid(extensions.st_makepoint(v_lngs[i], v_lats[i]), 4326)::extensions.geography,
      'medium', 'bc_csr_centroid', 'reference', 'station_type', v_dra_id, false
    ) ON CONFLICT (id) DO NOTHING;

    v_cluster := matrix_map.canonical_five_decimal_cluster(v_lats[i], v_lngs[i]);
    PERFORM matrix_map.upsert_site_aggregate_candidate(v_dra_id, v_cluster, v_labels[i], v_admin_id, 'seed g1 projection ' || i);
    SELECT id, updated_at INTO v_pub_id, v_cur FROM matrix_map.site_aggregate_publications
    WHERE source_dra_id = v_dra_id AND coordinate_cluster_id = v_cluster;
    PERFORM matrix_map.flip_site_aggregate_public(v_pub_id, true, v_admin_id, 'seed g1 publish ' || i, v_cur);
  END LOOP;
END $$;

DO $$
DECLARE
  v_cols text;
  v_dra_id uuid := 'a1111111-1111-1111-1111-111111111111';
  v_expected_rows constant integer := 2;
  v_returned integer;
  v_null_or_missing integer;
  v_conforming integer;
  v_semantics_ok boolean := false;
  v_detail text;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","email":"admin@example.com"}', true);
  -- MEMBER PROJECTION MUST BE UNCHANGED by the pagination work: same opaque
  -- columns, no raw source_dra_id, no exact counts.
  SELECT string_agg(a.attname, ',' ORDER BY a.attnum) INTO v_cols
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  JOIN LATERAL unnest(p.proargnames, p.proargmodes) WITH ORDINALITY AS a(attname, attmode, attnum) ON true
  WHERE n.nspname = 'matrix_map'
    AND p.proname = 'fetch_published_site_aggregates'
    AND a.attmode = 't';

  -- Column NAMES alone would stay green if the rounding, the bucketing or the
  -- expression behind an unchanged alias were altered, so check the VALUES too --
  -- against INDEPENDENTLY CALCULATED literals, never against a re-application of
  -- the same rounding to the returned value (which is a tautology and proves
  -- nothing). LEFT JOIN from `expected` so a MISSING row is counted as missing
  -- rather than silently reducing the population being checked.
  WITH expected(label, exp_lat, exp_lng, exp_bucket) AS (
    VALUES
      ('G1 Projection Station A'::text, 49.527::numeric, (-123.531)::numeric, '1'::text),
      ('G1 Projection Station B'::text, 49.531::numeric, (-123.527)::numeric, '1'::text)
  ),
  actual AS (
    SELECT r.aggregate_id, r.label,
           r.representative_latitude AS lat,
           r.representative_longitude AS lng,
           r.sample_count_bucket AS bucket
    FROM matrix_map.fetch_published_site_aggregates(1000, 0) r
    WHERE r.label IN ('G1 Projection Station A', 'G1 Projection Station B')
  ),
  paired AS (
    SELECT e.label, e.exp_lat, e.exp_lng, e.exp_bucket,
           a.aggregate_id, a.lat, a.lng, a.bucket
    FROM expected e
    LEFT JOIN actual a ON a.label = e.label
  )
  SELECT
    (SELECT count(*) FROM actual),
    -- NULL (or absent) FAILS. It is counted FIRST and required to be zero on its
    -- own, so a NULL can never short-circuit past the coordinate, bucket and
    -- opaque-id checks the way an `IS NULL OR (...)` guard would.
    (SELECT count(*) FROM paired p
      WHERE p.aggregate_id IS NULL
         OR p.lat IS NULL
         OR p.lng IS NULL
         OR p.bucket IS NULL),
    (SELECT count(*) FROM paired p
      WHERE p.aggregate_id IS NOT NULL
        AND p.lat IS NOT NULL
        AND p.lng IS NOT NULL
        AND p.bucket IS NOT NULL
        -- exact 3-decimal coordinates, compared to source-derived literals
        AND p.lat::numeric = p.exp_lat
        AND p.lng::numeric = p.exp_lng
        -- exact bucket, not merely a member of the bucket vocabulary
        AND p.bucket = p.exp_bucket
        -- the opaque id is the publication id, never the raw source DRA id
        AND p.aggregate_id <> v_dra_id
        AND NOT EXISTS (SELECT 1 FROM matrix_map.dras d WHERE d.id = p.aggregate_id))
  INTO v_returned, v_null_or_missing, v_conforming;

  -- Three INDEPENDENT requirements, all mandatory: the expected row count, no
  -- NULL/absent value anywhere, and every row conforming on every field.
  v_semantics_ok :=
    v_returned = v_expected_rows
    AND v_null_or_missing = 0
    AND v_conforming = v_expected_rows;

  v_detail := format('cols=%s returned=%s expected_rows=%s null_or_missing=%s conforming=%s',
    coalesce(v_cols, '<none>'), v_returned, v_expected_rows, v_null_or_missing, v_conforming);

  IF v_semantics_ok AND v_cols = 'aggregate_id,label,representative_latitude,representative_longitude,coordinate_quality_tier,sample_count_bucket,data_snapshot_version,visible_sample_suppression_key' THEN
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_53', 'Verify the MEMBER-safe projection is byte-for-byte unchanged after adding pagination: same opaque aggregate id, label, rounded coordinates, bucketed counts and conditional suppression key, with no raw source_dra_id and no exact sample counts', 'PASS', v_detail);
  ELSE
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_53', 'Verify the MEMBER-safe projection is byte-for-byte unchanged after adding pagination: same opaque aggregate id, label, rounded coordinates, bucketed counts and conditional suppression key, with no raw source_dra_id and no exact sample counts', 'FAIL', coalesce(v_detail, '<none>'));
  END IF;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
  VALUES ('TEST_53', 'Verify the MEMBER-safe projection is byte-for-byte unchanged after adding pagination: same opaque aggregate id, label, rounded coordinates, bucketed counts and conditional suppression key, with no raw source_dra_id and no exact sample counts', 'FAIL', SQLSTATE, SQLERRM);
END $$;

-- ---------------------------------------------------------------------------
-- G3: EXECUTABLE CONTROLS for matrix_map.assert_conforming_dra_cluster_index.
--
-- The apply-time guard for `samples_dra_canonical_cluster` used to be two
-- substring probes (`indexdef LIKE '%source_dra_id%'` AND
-- `LIKE '%canonical_five_decimal_cluster%'`). Every negative case below CONTAINS
-- both tokens and therefore PASSED that guard and was accepted, while defeating
-- the index's purpose. These controls call the SHIPPED function -- not a copy of
-- its predicate -- so the guard cannot regress without failing here.
--
-- Each negative control also proves the guard is READ-ONLY: after UE409 the
-- offending index must still exist with a byte-identical definition, so nothing
-- was dropped, renamed, reindexed or repaired.
-- ---------------------------------------------------------------------------

DROP SCHEMA IF EXISTS zz_g3_idx_probe CASCADE;
CREATE SCHEMA zz_g3_idx_probe;
CREATE TABLE zz_g3_idx_probe.samples (
  id uuid PRIMARY KEY,
  source_dra_id uuid,
  latitude double precision,
  longitude double precision
);
CREATE TABLE zz_g3_idx_probe.other_samples (
  id uuid PRIMARY KEY,
  source_dra_id uuid,
  latitude double precision,
  longitude double precision
);

DO $$
DECLARE
  v_raised text;
BEGIN
  -- POSITIVE CONTROL: clean first apply. No relation of that name exists, so the
  -- guard must ACCEPT and let CREATE INDEX build the intended definition.
  BEGIN
    PERFORM matrix_map.assert_conforming_dra_cluster_index('zz_g3_idx_probe', 'g3_absent_idx', 'zz_g3_idx_probe.samples'::regclass);
    v_raised := 'NO_RAISE';
  EXCEPTION WHEN OTHERS THEN
    v_raised := SQLSTATE;
  END;

  IF v_raised = 'NO_RAISE' THEN
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_54', 'POSITIVE CONTROL: verify assert_conforming_dra_cluster_index ACCEPTS a clean first apply, where no relation of the index name exists, so the guard cannot block the state it exists to permit', 'PASS', format('raised=%s (exp NO_RAISE)', v_raised));
  ELSE
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_54', 'POSITIVE CONTROL: verify assert_conforming_dra_cluster_index ACCEPTS a clean first apply, where no relation of the index name exists, so the guard cannot block the state it exists to permit', 'FAIL', format('raised=%s (exp NO_RAISE)', v_raised));
  END IF;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
  VALUES ('TEST_54', 'POSITIVE CONTROL: verify assert_conforming_dra_cluster_index ACCEPTS a clean first apply, where no relation of the index name exists, so the guard cannot block the state it exists to permit', 'FAIL', SQLSTATE, SQLERRM);
END $$;

DO $$
DECLARE
  v_raised text;
  v_def_before text;
  v_def_after text;
BEGIN
  -- POSITIVE CONTROL: an EXACTLY conforming index must be accepted, otherwise
  -- the guard would block every legitimate reapply (which REAPPLY_01 exercises
  -- end to end against the real index).
  EXECUTE 'CREATE INDEX g3_conforming_idx ON zz_g3_idx_probe.samples (source_dra_id, matrix_map.canonical_five_decimal_cluster(latitude, longitude))';
  SELECT pg_get_indexdef(c.oid) INTO v_def_before
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'zz_g3_idx_probe' AND c.relname = 'g3_conforming_idx';

  BEGIN
    PERFORM matrix_map.assert_conforming_dra_cluster_index('zz_g3_idx_probe', 'g3_conforming_idx', 'zz_g3_idx_probe.samples'::regclass);
    v_raised := 'NO_RAISE';
  EXCEPTION WHEN OTHERS THEN
    v_raised := SQLSTATE;
  END;

  SELECT pg_get_indexdef(c.oid) INTO v_def_after
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'zz_g3_idx_probe' AND c.relname = 'g3_conforming_idx';

  IF v_raised = 'NO_RAISE' AND v_def_after IS NOT NULL AND v_def_after = v_def_before THEN
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_55', 'POSITIVE CONTROL: verify assert_conforming_dra_cluster_index ACCEPTS an exactly conforming btree index on (source_dra_id, canonical_five_decimal_cluster(latitude, longitude)) and leaves its definition untouched', 'PASS', format('raised=%s (exp NO_RAISE); def unchanged', v_raised));
  ELSE
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_55', 'POSITIVE CONTROL: verify assert_conforming_dra_cluster_index ACCEPTS an exactly conforming btree index on (source_dra_id, canonical_five_decimal_cluster(latitude, longitude)) and leaves its definition untouched', 'FAIL', format('raised=%s (exp NO_RAISE); def_before=%s def_after=%s', v_raised, v_def_before, v_def_after));
  END IF;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
  VALUES ('TEST_55', 'POSITIVE CONTROL: verify assert_conforming_dra_cluster_index ACCEPTS an exactly conforming btree index on (source_dra_id, canonical_five_decimal_cluster(latitude, longitude)) and leaves its definition untouched', 'FAIL', SQLSTATE, SQLERRM);
END $$;

DO $$
DECLARE
  v_raised text;
  v_def_before text;
  v_def_after text;
BEGIN
  -- NEGATIVE CONTROL: REVERSED KEY ORDER. Contains both substring tokens, so the
  -- old LIKE guard accepted it; a btree leading on the cluster expression cannot
  -- satisfy the snapshot's source_dra_id-first predicate.
  EXECUTE 'CREATE INDEX g3_reversed_idx ON zz_g3_idx_probe.samples (matrix_map.canonical_five_decimal_cluster(latitude, longitude), source_dra_id)';
  SELECT pg_get_indexdef(c.oid) INTO v_def_before
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'zz_g3_idx_probe' AND c.relname = 'g3_reversed_idx';

  BEGIN
    PERFORM matrix_map.assert_conforming_dra_cluster_index('zz_g3_idx_probe', 'g3_reversed_idx', 'zz_g3_idx_probe.samples'::regclass);
    v_raised := 'NO_RAISE';
  EXCEPTION WHEN OTHERS THEN
    v_raised := SQLSTATE;
  END;

  SELECT pg_get_indexdef(c.oid) INTO v_def_after
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'zz_g3_idx_probe' AND c.relname = 'g3_reversed_idx';

  IF v_raised = 'UE409' AND v_def_after IS NOT NULL AND v_def_after = v_def_before THEN
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_56', 'NEGATIVE CONTROL: verify assert_conforming_dra_cluster_index FAILS CLOSED with UE409 on a same-named index whose KEY ORDER is reversed, and does not drop, rename, reindex or repair it', 'PASS', format('raised=%s (exp UE409); def unchanged', v_raised));
  ELSE
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_56', 'NEGATIVE CONTROL: verify assert_conforming_dra_cluster_index FAILS CLOSED with UE409 on a same-named index whose KEY ORDER is reversed, and does not drop, rename, reindex or repair it', 'FAIL', format('raised=%s (exp UE409); def_before=%s def_after=%s', v_raised, v_def_before, v_def_after));
  END IF;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
  VALUES ('TEST_56', 'NEGATIVE CONTROL: verify assert_conforming_dra_cluster_index FAILS CLOSED with UE409 on a same-named index whose KEY ORDER is reversed, and does not drop, rename, reindex or repair it', 'FAIL', SQLSTATE, SQLERRM);
END $$;

DO $$
DECLARE
  v_raised text;
  v_def_before text;
  v_def_after text;
BEGIN
  -- NEGATIVE CONTROL: PARTIAL PREDICATE. A WHERE clause makes the index unusable
  -- for rows outside it, so the snapshot predicate is still unindexed for them.
  EXECUTE 'CREATE INDEX g3_partial_idx ON zz_g3_idx_probe.samples (source_dra_id, matrix_map.canonical_five_decimal_cluster(latitude, longitude)) WHERE latitude IS NOT NULL';
  SELECT pg_get_indexdef(c.oid) INTO v_def_before
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'zz_g3_idx_probe' AND c.relname = 'g3_partial_idx';

  BEGIN
    PERFORM matrix_map.assert_conforming_dra_cluster_index('zz_g3_idx_probe', 'g3_partial_idx', 'zz_g3_idx_probe.samples'::regclass);
    v_raised := 'NO_RAISE';
  EXCEPTION WHEN OTHERS THEN
    v_raised := SQLSTATE;
  END;

  SELECT pg_get_indexdef(c.oid) INTO v_def_after
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'zz_g3_idx_probe' AND c.relname = 'g3_partial_idx';

  IF v_raised = 'UE409' AND v_def_after IS NOT NULL AND v_def_after = v_def_before THEN
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_57', 'NEGATIVE CONTROL: verify assert_conforming_dra_cluster_index FAILS CLOSED with UE409 on a same-named PARTIAL index carrying a WHERE predicate, and does not drop, rename, reindex or repair it', 'PASS', format('raised=%s (exp UE409); def unchanged', v_raised));
  ELSE
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_57', 'NEGATIVE CONTROL: verify assert_conforming_dra_cluster_index FAILS CLOSED with UE409 on a same-named PARTIAL index carrying a WHERE predicate, and does not drop, rename, reindex or repair it', 'FAIL', format('raised=%s (exp UE409); def_before=%s def_after=%s', v_raised, v_def_before, v_def_after));
  END IF;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
  VALUES ('TEST_57', 'NEGATIVE CONTROL: verify assert_conforming_dra_cluster_index FAILS CLOSED with UE409 on a same-named PARTIAL index carrying a WHERE predicate, and does not drop, rename, reindex or repair it', 'FAIL', SQLSTATE, SQLERRM);
END $$;

DO $$
DECLARE
  v_raised text;
  v_def_before text;
  v_def_after text;
BEGIN
  -- NEGATIVE CONTROL: CHANGED EXPRESSION ARGUMENTS. Same function, arguments
  -- swapped -- a DIFFERENT definition of cluster identity. Both substring tokens
  -- are present, and the pg_depend function identity check also passes, so this
  -- is the case that specifically requires comparing argument ORDER.
  EXECUTE 'CREATE INDEX g3_swapped_idx ON zz_g3_idx_probe.samples (source_dra_id, matrix_map.canonical_five_decimal_cluster(longitude, latitude))';
  SELECT pg_get_indexdef(c.oid) INTO v_def_before
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'zz_g3_idx_probe' AND c.relname = 'g3_swapped_idx';

  BEGIN
    PERFORM matrix_map.assert_conforming_dra_cluster_index('zz_g3_idx_probe', 'g3_swapped_idx', 'zz_g3_idx_probe.samples'::regclass);
    v_raised := 'NO_RAISE';
  EXCEPTION WHEN OTHERS THEN
    v_raised := SQLSTATE;
  END;

  SELECT pg_get_indexdef(c.oid) INTO v_def_after
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'zz_g3_idx_probe' AND c.relname = 'g3_swapped_idx';

  IF v_raised = 'UE409' AND v_def_after IS NOT NULL AND v_def_after = v_def_before THEN
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_58', 'NEGATIVE CONTROL: verify assert_conforming_dra_cluster_index FAILS CLOSED with UE409 when the indexed expression calls the SAME function with SWAPPED arguments (longitude, latitude), a different definition of cluster identity, and does not repair it', 'PASS', format('raised=%s (exp UE409); def unchanged', v_raised));
  ELSE
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_58', 'NEGATIVE CONTROL: verify assert_conforming_dra_cluster_index FAILS CLOSED with UE409 when the indexed expression calls the SAME function with SWAPPED arguments (longitude, latitude), a different definition of cluster identity, and does not repair it', 'FAIL', format('raised=%s (exp UE409); def_before=%s def_after=%s', v_raised, v_def_before, v_def_after));
  END IF;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
  VALUES ('TEST_58', 'NEGATIVE CONTROL: verify assert_conforming_dra_cluster_index FAILS CLOSED with UE409 when the indexed expression calls the SAME function with SWAPPED arguments (longitude, latitude), a different definition of cluster identity, and does not repair it', 'FAIL', SQLSTATE, SQLERRM);
END $$;

-- CUSTOM OPERATOR CLASSES that deliberately REUSE the names `uuid_ops` and
-- `text_ops`. Operator-class names are unique only per (access method, schema),
-- so these are entirely legal, and each gets its OWN operator family -- a family
-- that is not the one the drift snapshot's equality predicate is planned
-- against. A guard that compares `pg_opclass.opcname` accepts an index built
-- with either of them. TEST_59 below proves this guard does not.
CREATE OPERATOR CLASS zz_g3_idx_probe.uuid_ops FOR TYPE uuid USING btree AS
  OPERATOR 1 <, OPERATOR 2 <=, OPERATOR 3 =, OPERATOR 4 >=, OPERATOR 5 >,
  FUNCTION 1 uuid_cmp(uuid, uuid);
CREATE OPERATOR CLASS zz_g3_idx_probe.text_ops FOR TYPE text USING btree AS
  OPERATOR 1 <(text, text), OPERATOR 2 <=(text, text), OPERATOR 3 =(text, text),
  OPERATOR 4 >=(text, text), OPERATOR 5 >(text, text),
  FUNCTION 1 bttextcmp(text, text);

DO $$
DECLARE
  v_names text[] := ARRAY['g3_opclass_idx', 'g3_custom_uuid_opc_idx', 'g3_custom_text_opc_idx'];
  v_ddls text[] := ARRAY[
    'CREATE INDEX g3_opclass_idx ON zz_g3_idx_probe.samples (source_dra_id, matrix_map.canonical_five_decimal_cluster(latitude, longitude) text_pattern_ops)',
    'CREATE INDEX g3_custom_uuid_opc_idx ON zz_g3_idx_probe.samples (source_dra_id zz_g3_idx_probe.uuid_ops, matrix_map.canonical_five_decimal_cluster(latitude, longitude))',
    'CREATE INDEX g3_custom_text_opc_idx ON zz_g3_idx_probe.samples (source_dra_id, matrix_map.canonical_five_decimal_cluster(latitude, longitude) zz_g3_idx_probe.text_ops)'
  ];
  -- Which key position each case is meant to attack: 0 = neither (the built-in
  -- text_pattern_ops case is checked by name-shape below), 1 = first key,
  -- 2 = second key. The two custom cases MUST be proven to have actually been
  -- built with a non-pg_catalog class whose NAME equals the expected literal --
  -- otherwise the control would not be exercising the defect at all.
  v_attacked smallint[] := ARRAY[0, 1, 2];
  v_expected_names text[] := ARRAY['', 'uuid_ops', 'text_ops'];
  v_raised text;
  v_def_before text;
  v_def_after text;
  v_used_name text;
  v_used_ns text;
  v_setup_ok boolean;
  v_failures text := '';
  v_ok integer := 0;
  i integer;
BEGIN
  -- NEGATIVE CONTROL: INCOMPATIBLE OPERATOR CLASS, three ways.
  --   1. text_pattern_ops -- a real built-in class that orders by raw bytes, so
  --      an equality lookup through the default collation cannot use it the way
  --      the measured snapshot predicate needs.
  --   2. a CUSTOM class named `uuid_ops` in another schema, at the FIRST key.
  --   3. a CUSTOM class named `text_ops` in another schema, at the SECOND key.
  -- Cases 2 and 3 attack each key position INDEPENDENTLY, and both would satisfy
  -- a name-based comparison exactly.
  FOR i IN 1..array_length(v_names, 1) LOOP
    EXECUTE v_ddls[i];
    SELECT pg_get_indexdef(c.oid) INTO v_def_before
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'zz_g3_idx_probe' AND c.relname = v_names[i];

    -- SETUP PROOF. For the custom cases, confirm the index really is built with
    -- a class that (a) carries the expected NAME and (b) does NOT live in
    -- pg_catalog. Without this the control could silently degrade into a
    -- duplicate of case 1.
    IF v_attacked[i] = 0 THEN
      v_setup_ok := true;
      v_used_name := '<n/a>'; v_used_ns := '<n/a>';
    ELSE
      SELECT oc.opcname, n.nspname INTO v_used_name, v_used_ns
      FROM pg_index idx
      JOIN pg_opclass oc ON oc.oid = idx.indclass[v_attacked[i] - 1]
      JOIN pg_namespace n ON n.oid = oc.opcnamespace
      WHERE idx.indexrelid = format('zz_g3_idx_probe.%s', v_names[i])::regclass;
      v_setup_ok := (v_used_name = v_expected_names[i] AND v_used_ns <> 'pg_catalog');
    END IF;

    BEGIN
      PERFORM matrix_map.assert_conforming_dra_cluster_index('zz_g3_idx_probe', v_names[i], 'zz_g3_idx_probe.samples'::regclass);
      v_raised := 'NO_RAISE';
    EXCEPTION WHEN OTHERS THEN
      v_raised := SQLSTATE;
    END;

    SELECT pg_get_indexdef(c.oid) INTO v_def_after
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'zz_g3_idx_probe' AND c.relname = v_names[i];

    IF v_setup_ok AND v_raised = 'UE409' AND v_def_after IS NOT NULL AND v_def_after = v_def_before THEN
      v_ok := v_ok + 1;
    ELSE
      v_failures := v_failures || format('%s: setup_ok=%s used=%s.%s raised=%s def_before=%s def_after=%s; ',
        v_names[i], v_setup_ok, v_used_ns, v_used_name, v_raised, v_def_before, v_def_after);
    END IF;
  END LOOP;

  IF v_ok = 3 THEN
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_59', 'NEGATIVE CONTROL: verify assert_conforming_dra_cluster_index FAILS CLOSED with UE409 on a same-named index built with an INCOMPATIBLE operator class -- the built-in text_pattern_ops, and CUSTOM same-named uuid_ops and text_ops classes from another schema exercised at each key position independently -- proving the decision is made on catalog OID identity and not on opcname, and does not drop, rename, reindex or repair any of them', 'PASS', format('%s/3 rejected with the definition unchanged and the custom class proven in use', v_ok));
  ELSE
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_59', 'NEGATIVE CONTROL: verify assert_conforming_dra_cluster_index FAILS CLOSED with UE409 on a same-named index built with an INCOMPATIBLE operator class -- the built-in text_pattern_ops, and CUSTOM same-named uuid_ops and text_ops classes from another schema exercised at each key position independently -- proving the decision is made on catalog OID identity and not on opcname, and does not drop, rename, reindex or repair any of them', 'FAIL', format('%s/3 rejected; %s', v_ok, v_failures));
  END IF;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
  VALUES ('TEST_59', 'NEGATIVE CONTROL: verify assert_conforming_dra_cluster_index FAILS CLOSED with UE409 on a same-named index built with an INCOMPATIBLE operator class -- the built-in text_pattern_ops, and CUSTOM same-named uuid_ops and text_ops classes from another schema exercised at each key position independently -- proving the decision is made on catalog OID identity and not on opcname, and does not drop, rename, reindex or repair any of them', 'FAIL', SQLSTATE, SQLERRM);
END $$;

DO $$
DECLARE
  v_names text[] := ARRAY['g3_unique_idx', 'g3_include_idx', 'g3_desc_idx'];
  v_ddls text[] := ARRAY[
    'CREATE UNIQUE INDEX g3_unique_idx ON zz_g3_idx_probe.samples (source_dra_id, matrix_map.canonical_five_decimal_cluster(latitude, longitude))',
    'CREATE INDEX g3_include_idx ON zz_g3_idx_probe.samples (source_dra_id, matrix_map.canonical_five_decimal_cluster(latitude, longitude)) INCLUDE (latitude)',
    'CREATE INDEX g3_desc_idx ON zz_g3_idx_probe.samples (source_dra_id DESC, matrix_map.canonical_five_decimal_cluster(latitude, longitude))'
  ];
  v_raised text;
  v_def_before text;
  v_def_after text;
  v_failures text := '';
  v_ok integer := 0;
  i integer;
BEGIN
  -- NEGATIVE CONTROL: MATERIALLY DIFFERENT DEFINITION. Three shapes that all
  -- contain both substring tokens: UNIQUE (changes write semantics and can
  -- reject legitimate rows), an INCLUDE payload column, and a DESC key. Each
  -- must be rejected, and each must survive the rejection unmodified.
  FOR i IN 1..array_length(v_names, 1) LOOP
    EXECUTE v_ddls[i];
    SELECT pg_get_indexdef(c.oid) INTO v_def_before
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'zz_g3_idx_probe' AND c.relname = v_names[i];

    BEGIN
      PERFORM matrix_map.assert_conforming_dra_cluster_index('zz_g3_idx_probe', v_names[i], 'zz_g3_idx_probe.samples'::regclass);
      v_raised := 'NO_RAISE';
    EXCEPTION WHEN OTHERS THEN
      v_raised := SQLSTATE;
    END;

    SELECT pg_get_indexdef(c.oid) INTO v_def_after
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'zz_g3_idx_probe' AND c.relname = v_names[i];

    IF v_raised = 'UE409' AND v_def_after IS NOT NULL AND v_def_after = v_def_before THEN
      v_ok := v_ok + 1;
    ELSE
      v_failures := v_failures || format('%s: raised=%s def_before=%s def_after=%s; ', v_names[i], v_raised, v_def_before, v_def_after);
    END IF;
  END LOOP;

  IF v_ok = 3 THEN
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_60', 'NEGATIVE CONTROL: verify assert_conforming_dra_cluster_index FAILS CLOSED with UE409 on same-named indexes that are UNIQUE, carry an INCLUDE column, or use a DESC key, and leaves each of them unmodified', 'PASS', format('%s/3 rejected with the definition unchanged', v_ok));
  ELSE
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_60', 'NEGATIVE CONTROL: verify assert_conforming_dra_cluster_index FAILS CLOSED with UE409 on same-named indexes that are UNIQUE, carry an INCLUDE column, or use a DESC key, and leaves each of them unmodified', 'FAIL', format('%s/3 rejected; %s', v_ok, v_failures));
  END IF;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
  VALUES ('TEST_60', 'NEGATIVE CONTROL: verify assert_conforming_dra_cluster_index FAILS CLOSED with UE409 on same-named indexes that are UNIQUE, carry an INCLUDE column, or use a DESC key, and leaves each of them unmodified', 'FAIL', SQLSTATE, SQLERRM);
END $$;

DO $$
DECLARE
  v_raised_wrong_table text;
  v_raised_non_index text;
  v_def_before text;
  v_def_after text;
  v_non_index_still_table boolean;
BEGIN
  -- NEGATIVE CONTROL: WRONG-TABLE COLLISION and NAME-OCCUPIED-BY-A-NON-INDEX.
  -- Relation names are unique per schema, so an index of the expected name
  -- sitting on a DIFFERENT table, or a TABLE holding the name outright, are both
  -- reachable collisions that the substring guard could not even express.
  EXECUTE 'CREATE INDEX g3_wrongtable_idx ON zz_g3_idx_probe.other_samples (source_dra_id, matrix_map.canonical_five_decimal_cluster(latitude, longitude))';
  SELECT pg_get_indexdef(c.oid) INTO v_def_before
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'zz_g3_idx_probe' AND c.relname = 'g3_wrongtable_idx';

  BEGIN
    PERFORM matrix_map.assert_conforming_dra_cluster_index('zz_g3_idx_probe', 'g3_wrongtable_idx', 'zz_g3_idx_probe.samples'::regclass);
    v_raised_wrong_table := 'NO_RAISE';
  EXCEPTION WHEN OTHERS THEN
    v_raised_wrong_table := SQLSTATE;
  END;

  SELECT pg_get_indexdef(c.oid) INTO v_def_after
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'zz_g3_idx_probe' AND c.relname = 'g3_wrongtable_idx';

  EXECUTE 'CREATE TABLE zz_g3_idx_probe.g3_name_taken (id uuid PRIMARY KEY)';
  BEGIN
    PERFORM matrix_map.assert_conforming_dra_cluster_index('zz_g3_idx_probe', 'g3_name_taken', 'zz_g3_idx_probe.samples'::regclass);
    v_raised_non_index := 'NO_RAISE';
  EXCEPTION WHEN OTHERS THEN
    v_raised_non_index := SQLSTATE;
  END;

  SELECT (c.relkind = 'r') INTO v_non_index_still_table
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'zz_g3_idx_probe' AND c.relname = 'g3_name_taken';

  IF v_raised_wrong_table = 'UE409'
     AND v_def_after IS NOT NULL AND v_def_after = v_def_before
     AND v_raised_non_index = 'UE409'
     AND v_non_index_still_table = true THEN
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_61', 'NEGATIVE CONTROL: verify assert_conforming_dra_cluster_index FAILS CLOSED with UE409 when an otherwise-conforming index of the expected name sits on a DIFFERENT table, and when the name is held by a non-index relation, and drops or repairs neither', 'PASS', format('wrong_table raised=%s (exp UE409, def unchanged); non_index raised=%s (exp UE409, table intact)', v_raised_wrong_table, v_raised_non_index));
  ELSE
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_61', 'NEGATIVE CONTROL: verify assert_conforming_dra_cluster_index FAILS CLOSED with UE409 when an otherwise-conforming index of the expected name sits on a DIFFERENT table, and when the name is held by a non-index relation, and drops or repairs neither', 'FAIL', format('wrong_table raised=%s def_before=%s def_after=%s; non_index raised=%s still_table=%s', v_raised_wrong_table, v_def_before, v_def_after, v_raised_non_index, v_non_index_still_table));
  END IF;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
  VALUES ('TEST_61', 'NEGATIVE CONTROL: verify assert_conforming_dra_cluster_index FAILS CLOSED with UE409 when an otherwise-conforming index of the expected name sits on a DIFFERENT table, and when the name is held by a non-index relation, and drops or repairs neither', 'FAIL', SQLSTATE, SQLERRM);
END $$;

DROP SCHEMA IF EXISTS zz_g3_idx_probe CASCADE;

-- ---------------------------------------------------------------------------
-- FIX 6: label identifier containment is canonicalized to ASCII HEX.
--
-- The prior normalization stripped only hyphens and braces, and `blank_trim` is
-- `btrim`, which only strips from the ENDS. A label carrying the source uuid
-- interleaved with INTERIOR invisible characters therefore passed the guard
-- while still rendering to members as the raw identifier.
--
-- Widening `blank_trim` was rejected: it deliberately excludes U+200C ZWNJ and
-- U+200D ZWJ because they are meaningful in legitimate persisted text. The
-- comparison value is a temporary copy, so it canonicalizes to ASCII hex only.
--
-- Every evasion below is built with chr() so THIS FILE stays plain ASCII.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_dra_id uuid := 'a1111111-1111-1111-1111-111111111111';
  v_admin_id uuid := '11111111-1111-1111-1111-111111111111';
  v_cluster text := matrix_map.canonical_five_decimal_cluster(49.5266749, -123.5312351);
  v_hex text := replace(lower(v_dra_id::text), '-', '');
  v_zwsp text := chr(8203);   -- U+200B ZERO WIDTH SPACE
  v_zwnj text := chr(8204);   -- U+200C ZERO WIDTH NON-JOINER
  v_zwj  text := chr(8205);   -- U+200D ZERO WIDTH JOINER
  v_bom  text := chr(65279);  -- U+FEFF ZERO WIDTH NO-BREAK SPACE
  v_labels text[];
  v_names text[];
  v_raised text;
  v_audit_before bigint;
  v_audit_after bigint;
  v_pub_before bigint;
  v_pub_after bigint;
  v_rejected integer := 0;
  v_failures text := '';
  v_innocuous_ok boolean := false;
  i integer;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","email":"admin@example.com"}', true);

  v_names := ARRAY[
    'canonical hyphenated', 'compact', 'mixed case', 'brace wrapped',
    'U+200B interleaved', 'U+200C interleaved', 'U+200D interleaved',
    'U+FEFF interleaved', 'space interleaved', 'punctuation interleaved'];
  v_labels := ARRAY[
    'Site ' || lower(v_dra_id::text),
    'Site ' || v_hex,
    'Site ' || upper(v_dra_id::text),
    'Site {' || lower(v_dra_id::text) || '}',
    'Site ' || array_to_string(regexp_split_to_array(v_hex, ''), v_zwsp),
    'Site ' || array_to_string(regexp_split_to_array(v_hex, ''), v_zwnj),
    'Site ' || array_to_string(regexp_split_to_array(v_hex, ''), v_zwj),
    'Site ' || array_to_string(regexp_split_to_array(v_hex, ''), v_bom),
    'Site ' || array_to_string(regexp_split_to_array(v_hex, ''), ' '),
    'Site ' || array_to_string(regexp_split_to_array(v_hex, ''), '.')];

  SELECT count(*) INTO v_audit_before FROM matrix_map.site_aggregate_candidate_audit;
  SELECT count(*) INTO v_pub_before FROM matrix_map.site_aggregate_publications;

  FOR i IN 1..array_length(v_labels, 1) LOOP
    BEGIN
      PERFORM matrix_map.upsert_site_aggregate_candidate(v_dra_id, v_cluster, v_labels[i], v_admin_id, 'fix6 probe');
      v_raised := 'NO_RAISE';
    EXCEPTION WHEN OTHERS THEN
      v_raised := SQLSTATE;
    END;
    IF v_raised = 'UE422' THEN
      v_rejected := v_rejected + 1;
    ELSE
      v_failures := v_failures || format('%s: raised=%s; ', v_names[i], v_raised);
    END IF;
  END LOOP;

  -- NOT OVERBROAD: a label sharing only a few hex characters must still be
  -- accepted. Uses an already-published cluster's own label so the call is a
  -- legitimate refresh shape rather than a new write.
  BEGIN
    PERFORM matrix_map.upsert_site_aggregate_candidate(
      v_dra_id,
      matrix_map.canonical_five_decimal_cluster(49.5313982, -123.5268531),
      'Beach access cafe deadbeef site',
      v_admin_id, 'fix6 innocuous probe');
    v_innocuous_ok := true;
  EXCEPTION WHEN sqlstate 'UE409' THEN
    -- already published: the LABEL guard passed, which is what this asserts.
    v_innocuous_ok := true;
  WHEN OTHERS THEN
    v_innocuous_ok := false;
    v_failures := v_failures || format('innocuous label rejected with %s; ', SQLSTATE);
  END;

  SELECT count(*) INTO v_audit_after FROM matrix_map.site_aggregate_candidate_audit;
  SELECT count(*) INTO v_pub_after FROM matrix_map.site_aggregate_publications;

  IF v_rejected = array_length(v_labels, 1)
     AND v_innocuous_ok
     AND v_audit_after = v_audit_before
     AND v_pub_after = v_pub_before THEN
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_62', 'Verify the member_display_label identifier guard canonicalizes to ASCII HEX so the source DRA uuid cannot be smuggled through in canonical, compact, mixed-case, brace-wrapped, or U+200B/U+200C/U+200D/U+FEFF/space/punctuation-interleaved form, each rejected with UE422 and writing NO candidate or audit row, while an innocuous label sharing only a few hex characters is still accepted', 'PASS',
      format('%s/%s rejected with UE422; innocuous accepted; audit %s->%s; publications %s->%s', v_rejected, array_length(v_labels, 1), v_audit_before, v_audit_after, v_pub_before, v_pub_after));
  ELSE
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_62', 'Verify the member_display_label identifier guard canonicalizes to ASCII HEX so the source DRA uuid cannot be smuggled through in canonical, compact, mixed-case, brace-wrapped, or U+200B/U+200C/U+200D/U+FEFF/space/punctuation-interleaved form, each rejected with UE422 and writing NO candidate or audit row, while an innocuous label sharing only a few hex characters is still accepted', 'FAIL',
      format('%s/%s rejected; innocuous_ok=%s; audit %s->%s; publications %s->%s; %s', v_rejected, array_length(v_labels, 1), v_innocuous_ok, v_audit_before, v_audit_after, v_pub_before, v_pub_after, v_failures));
  END IF;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
  VALUES ('TEST_62', 'Verify the member_display_label identifier guard canonicalizes to ASCII HEX so the source DRA uuid cannot be smuggled through in canonical, compact, mixed-case, brace-wrapped, or U+200B/U+200C/U+200D/U+FEFF/space/punctuation-interleaved form, each rejected with UE422 and writing NO candidate or audit row, while an innocuous label sharing only a few hex characters is still accepted', 'FAIL', SQLSTATE, SQLERRM);
END $$;

-- ---------------------------------------------------------------------------
-- FIX 7: p_offset now has a fail-closed UPPER bound of 24000 on BOTH RPCs,
-- derived from the client contract PAGE_SIZE=1000 / MAX_PAGES=25.
--
-- The rejection must happen BEFORE the publication query is executed. That is
-- asserted by timing-independent means: the oversized call is issued inside a
-- statement-level trap and the number of sequential scans on
-- site_aggregate_publications, read from pg_stat_xact_user_tables, must not
-- increase across the rejected call.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_ok integer := 0;
  v_raised text;
  v_scans_before bigint;
  v_scans_after bigint;
  v_no_query boolean;
  v_failures text := '';
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","email":"admin@example.com"}', true);

  -- 24000 is the largest LEGITIMATE offset and must be ACCEPTED.
  BEGIN
    PERFORM * FROM matrix_map.fetch_published_site_aggregates(1, 24000);
    v_ok := v_ok + 1;
  EXCEPTION WHEN OTHERS THEN
    v_failures := v_failures || format('24000 rejected with %s; ', SQLSTATE);
  END;

  SELECT coalesce(sum(seq_scan + idx_scan), 0) INTO v_scans_before
  FROM pg_stat_xact_user_tables
  WHERE schemaname = 'matrix_map' AND relname = 'site_aggregate_publications';

  BEGIN PERFORM * FROM matrix_map.fetch_published_site_aggregates(1, 24001);
    v_failures := v_failures || '24001 accepted; ';
  EXCEPTION WHEN sqlstate 'UE422' THEN v_ok := v_ok + 1;
  WHEN OTHERS THEN v_failures := v_failures || format('24001 raised %s; ', SQLSTATE);
  END;

  SELECT coalesce(sum(seq_scan + idx_scan), 0) INTO v_scans_after
  FROM pg_stat_xact_user_tables
  WHERE schemaname = 'matrix_map' AND relname = 'site_aggregate_publications';
  v_no_query := (v_scans_after = v_scans_before);

  BEGIN PERFORM * FROM matrix_map.fetch_published_site_aggregates(1, 2147483647);
    v_failures := v_failures || 'int max accepted; ';
  EXCEPTION WHEN sqlstate 'UE422' THEN v_ok := v_ok + 1;
  WHEN OTHERS THEN v_failures := v_failures || format('int max raised %s; ', SQLSTATE);
  END;

  BEGIN PERFORM * FROM matrix_map.fetch_published_site_aggregates(1, -1);
    v_failures := v_failures || 'negative accepted; ';
  EXCEPTION WHEN sqlstate 'UE422' THEN v_ok := v_ok + 1;
  WHEN OTHERS THEN v_failures := v_failures || format('negative raised %s; ', SQLSTATE);
  END;

  IF v_ok = 4 AND v_no_query THEN
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_63', 'Verify fetch_published_site_aggregates enforces the bounded-pagination contract: p_offset 24000 (the last legitimate client page) is ACCEPTED, 24001 and 2147483647 and a negative offset each FAIL CLOSED with UE422, and the oversized rejection happens BEFORE the publication query is executed', 'PASS',
      format('%s/4 as expected; publication scans unchanged across the rejected call (%s -> %s)', v_ok, v_scans_before, v_scans_after));
  ELSE
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_63', 'Verify fetch_published_site_aggregates enforces the bounded-pagination contract: p_offset 24000 (the last legitimate client page) is ACCEPTED, 24001 and 2147483647 and a negative offset each FAIL CLOSED with UE422, and the oversized rejection happens BEFORE the publication query is executed', 'FAIL',
      format('%s/4; scans %s -> %s; %s', v_ok, v_scans_before, v_scans_after, v_failures));
  END IF;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
  VALUES ('TEST_63', 'Verify fetch_published_site_aggregates enforces the bounded-pagination contract: p_offset 24000 (the last legitimate client page) is ACCEPTED, 24001 and 2147483647 and a negative offset each FAIL CLOSED with UE422, and the oversized rejection happens BEFORE the publication query is executed', 'FAIL', SQLSTATE, SQLERRM);
END $$;

DO $$
DECLARE
  v_ok integer := 0;
  v_dra_id uuid := 'a1111111-1111-1111-1111-111111111111';
  v_scans_before bigint;
  v_scans_after bigint;
  v_no_query boolean;
  v_failures text := '';
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","email":"admin@example.com"}', true);

  BEGIN
    PERFORM * FROM matrix_map.fetch_admin_site_aggregate_publications(v_dra_id, 1, 24000);
    v_ok := v_ok + 1;
  EXCEPTION WHEN OTHERS THEN
    v_failures := v_failures || format('24000 rejected with %s; ', SQLSTATE);
  END;

  SELECT coalesce(sum(seq_scan + idx_scan), 0) INTO v_scans_before
  FROM pg_stat_xact_user_tables
  WHERE schemaname = 'matrix_map' AND relname = 'site_aggregate_publications';

  BEGIN PERFORM * FROM matrix_map.fetch_admin_site_aggregate_publications(v_dra_id, 1, 24001);
    v_failures := v_failures || '24001 accepted; ';
  EXCEPTION WHEN sqlstate 'UE422' THEN v_ok := v_ok + 1;
  WHEN OTHERS THEN v_failures := v_failures || format('24001 raised %s; ', SQLSTATE);
  END;

  SELECT coalesce(sum(seq_scan + idx_scan), 0) INTO v_scans_after
  FROM pg_stat_xact_user_tables
  WHERE schemaname = 'matrix_map' AND relname = 'site_aggregate_publications';
  v_no_query := (v_scans_after = v_scans_before);

  BEGIN PERFORM * FROM matrix_map.fetch_admin_site_aggregate_publications(v_dra_id, 1, 2147483647);
    v_failures := v_failures || 'int max accepted; ';
  EXCEPTION WHEN sqlstate 'UE422' THEN v_ok := v_ok + 1;
  WHEN OTHERS THEN v_failures := v_failures || format('int max raised %s; ', SQLSTATE);
  END;

  BEGIN PERFORM * FROM matrix_map.fetch_admin_site_aggregate_publications(v_dra_id, 1, -1);
    v_failures := v_failures || 'negative accepted; ';
  EXCEPTION WHEN sqlstate 'UE422' THEN v_ok := v_ok + 1;
  WHEN OTHERS THEN v_failures := v_failures || format('negative raised %s; ', SQLSTATE);
  END;

  IF v_ok = 4 AND v_no_query THEN
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_64', 'Verify fetch_admin_site_aggregate_publications enforces the SAME bounded-pagination contract as the member RPC: p_offset 24000 ACCEPTED, 24001 and 2147483647 and a negative offset each FAIL CLOSED with UE422, and the oversized rejection happens BEFORE the publication query is executed', 'PASS',
      format('%s/4 as expected; publication scans unchanged across the rejected call (%s -> %s)', v_ok, v_scans_before, v_scans_after));
  ELSE
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_64', 'Verify fetch_admin_site_aggregate_publications enforces the SAME bounded-pagination contract as the member RPC: p_offset 24000 ACCEPTED, 24001 and 2147483647 and a negative offset each FAIL CLOSED with UE422, and the oversized rejection happens BEFORE the publication query is executed', 'FAIL',
      format('%s/4; scans %s -> %s; %s', v_ok, v_scans_before, v_scans_after, v_failures));
  END IF;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
  VALUES ('TEST_64', 'Verify fetch_admin_site_aggregate_publications enforces the SAME bounded-pagination contract as the member RPC: p_offset 24000 ACCEPTED, 24001 and 2147483647 and a negative offset each FAIL CLOSED with UE422, and the oversized rejection happens BEFORE the publication query is executed', 'FAIL', SQLSTATE, SQLERRM);
END $$;

-- ---------------------------------------------------------------------------
-- TEST_65 / TEST_66 / TEST_67 -- the upsert RETURN CONTRACT (2026-07-28).
--
-- upsert_site_aggregate_candidate now RETURNS uuid so a caller can verify its
-- own committed write by EXACT ID rather than by paging the candidate
-- collection. Paging is not a snapshot across independent statements, so under
-- a concurrent refresh a scan could report "not found" for a row that WAS
-- committed. These tests prove the returned id is the REAL persisted id -- a
-- function that returned a fresh gen_random_uuid(), or NULL, would satisfy the
-- "returns a uuid" type contract while making the caller's readback useless.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_admin_id uuid := '11111111-1111-1111-1111-111111111111';
  v_dra_id uuid := 'a1111111-1111-1111-1111-111111111111';
  v_sample_id uuid := 'b6565656-6565-6565-6565-656565656565';
  v_lat double precision := 49.36500;
  v_lng double precision := -123.24500;
  v_cluster text;
  v_returned_create uuid;
  v_returned_refresh uuid;
  v_persisted_id uuid;
  v_row_count integer;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","email":"admin@example.com"}', true);

  INSERT INTO matrix_map.samples (
    id, bnrrm_station_id, station_id, display_name, latitude, longitude,
    geometry, coordinate_quality_tier, coordinate_source, classification, classification_source, source_dra_id, public
  ) VALUES (
    v_sample_id, 165, 'STN-165', 'Sample Station 165', v_lat, v_lng,
    extensions.st_setsrid(extensions.st_makepoint(v_lng, v_lat), 4326)::extensions.geography,
    'medium', 'bc_csr_centroid', 'reference', 'station_type', v_dra_id, false
  )
  ON CONFLICT (id) DO NOTHING;

  v_cluster := matrix_map.canonical_five_decimal_cluster(v_lat, v_lng);

  -- CREATE: capture the RETURNED id (not PERFORM -- the return value is the
  -- subject of this test).
  v_returned_create := matrix_map.upsert_site_aggregate_candidate(
    v_dra_id, v_cluster, 'Return Contract Create', v_admin_id, 'return contract create'
  );

  -- The id the row ACTUALLY has, looked up independently by natural key.
  SELECT id INTO v_persisted_id
  FROM matrix_map.site_aggregate_publications
  WHERE source_dra_id = v_dra_id AND coordinate_cluster_id = v_cluster;

  IF v_returned_create IS NOT NULL AND v_returned_create = v_persisted_id THEN
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_65', 'Verify upsert_site_aggregate_candidate CREATE returns the ACTUAL persisted publication id, matching an independent natural-key lookup (not null, not a freshly generated uuid)', 'PASS',
      format('returned=%s persisted=%s', v_returned_create, v_persisted_id));
  ELSE
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_65', 'Verify upsert_site_aggregate_candidate CREATE returns the ACTUAL persisted publication id, matching an independent natural-key lookup (not null, not a freshly generated uuid)', 'FAIL',
      format('returned=%s persisted=%s', v_returned_create, v_persisted_id));
  END IF;

  -- REFRESH the SAME natural key: must return the SAME id, and must not have
  -- created a second row.
  v_returned_refresh := matrix_map.upsert_site_aggregate_candidate(
    v_dra_id, v_cluster, 'Return Contract Refreshed', v_admin_id, 'return contract refresh'
  );

  SELECT count(*) INTO v_row_count
  FROM matrix_map.site_aggregate_publications
  WHERE source_dra_id = v_dra_id AND coordinate_cluster_id = v_cluster;

  IF v_returned_refresh = v_returned_create AND v_row_count = 1 THEN
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_66', 'Verify upsert_site_aggregate_candidate REFRESH returns the SAME publication id as the original create for the same natural key, and does not create a second row', 'PASS',
      format('create=%s refresh=%s rows=%s', v_returned_create, v_returned_refresh, v_row_count));
  ELSE
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_66', 'Verify upsert_site_aggregate_candidate REFRESH returns the SAME publication id as the original create for the same natural key, and does not create a second row', 'FAIL',
      format('create=%s refresh=%s rows=%s', v_returned_create, v_returned_refresh, v_row_count));
  END IF;

  -- The returned id must be usable for the EXACT-ID readback the route now
  -- performs: p_publication_id set, p_limit 1, p_offset 0, exactly one row.
  SELECT count(*) INTO v_row_count
  FROM matrix_map.fetch_admin_site_aggregate_publications(v_returned_refresh, 1, 0);

  IF v_row_count = 1 THEN
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_67', 'Verify the id returned by upsert_site_aggregate_candidate resolves through fetch_admin_site_aggregate_publications(p_publication_id, 1, 0) to EXACTLY ONE row, so post-commit verification never needs to page the collection', 'PASS',
      format('rows=%s for id=%s', v_row_count, v_returned_refresh));
  ELSE
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_67', 'Verify the id returned by upsert_site_aggregate_candidate resolves through fetch_admin_site_aggregate_publications(p_publication_id, 1, 0) to EXACTLY ONE row, so post-commit verification never needs to page the collection', 'FAIL',
      format('rows=%s for id=%s', v_row_count, v_returned_refresh));
  END IF;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
  VALUES ('TEST_65', 'Verify upsert_site_aggregate_candidate CREATE returns the ACTUAL persisted publication id, matching an independent natural-key lookup (not null, not a freshly generated uuid)', 'FAIL', SQLSTATE, SQLERRM);
END $$;

-- ---------------------------------------------------------------------------
-- TEST_68 -- the DROP/CREATE return-contract change preserved the SECURITY
-- posture. Changing a return type requires DROP + CREATE rather than CREATE OR
-- REPLACE, and a DROP silently discards OWNER and every GRANT. If the recreate
-- forgot to restore them the function would fail closed for `authenticated`
-- (or, worse, be executable by roles it was revoked from).
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_owner text;
  v_rettype text;
  v_authenticated_exec boolean;
  v_public_exec boolean;
  v_anon_exec boolean;
  v_service_exec boolean;
  v_oid oid;
BEGIN
  SELECT p.oid, pg_get_userbyid(p.proowner), pg_catalog.format_type(p.prorettype, NULL)
  INTO v_oid, v_owner, v_rettype
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'matrix_map'
    AND p.proname = 'upsert_site_aggregate_candidate';

  v_authenticated_exec := has_function_privilege('authenticated', v_oid, 'EXECUTE');
  v_public_exec := has_function_privilege('public', v_oid, 'EXECUTE');
  v_anon_exec := has_function_privilege('anon', v_oid, 'EXECUTE');
  v_service_exec := has_function_privilege('service_role', v_oid, 'EXECUTE');

  IF v_rettype = 'uuid'
     AND v_owner = 'matrix_map_owner'
     AND v_authenticated_exec
     AND NOT v_public_exec
     AND NOT v_anon_exec
     AND NOT v_service_exec THEN
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_68', 'Verify the DROP/CREATE return-contract change left upsert_site_aggregate_candidate RETURNING uuid, OWNED BY matrix_map_owner, EXECUTE granted to authenticated, and revoked from PUBLIC, anon and service_role', 'PASS',
      format('rettype=%s owner=%s authenticated=%s public=%s anon=%s service_role=%s', v_rettype, v_owner, v_authenticated_exec, v_public_exec, v_anon_exec, v_service_exec));
  ELSE
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_68', 'Verify the DROP/CREATE return-contract change left upsert_site_aggregate_candidate RETURNING uuid, OWNED BY matrix_map_owner, EXECUTE granted to authenticated, and revoked from PUBLIC, anon and service_role', 'FAIL',
      format('rettype=%s owner=%s authenticated=%s public=%s anon=%s service_role=%s', v_rettype, v_owner, v_authenticated_exec, v_public_exec, v_anon_exec, v_service_exec));
  END IF;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
  VALUES ('TEST_68', 'Verify the DROP/CREATE return-contract change left upsert_site_aggregate_candidate RETURNING uuid, OWNED BY matrix_map_owner, EXECUTE granted to authenticated, and revoked from PUBLIC, anon and service_role', 'FAIL', SQLSTATE, SQLERRM);
END $$;

-- ---------------------------------------------------------------------------
-- TEST_69 -- exactly ONE overload of upsert_site_aggregate_candidate exists.
-- The DROP is signature-scoped; if a future edit changed the argument list
-- without dropping the old signature, BOTH would exist and PostgREST could
-- resolve to the void-returning legacy one, silently reinstating the paged-scan
-- failure mode this change removes.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_count integer;
  v_sigs text;
BEGIN
  SELECT count(*), COALESCE(string_agg(pg_catalog.pg_get_function_identity_arguments(p.oid) || ' -> ' || pg_catalog.format_type(p.prorettype, NULL), ' | '), '')
  INTO v_count, v_sigs
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'matrix_map'
    AND p.proname = 'upsert_site_aggregate_candidate';

  IF v_count = 1 AND v_sigs LIKE '%-> uuid' THEN
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_69', 'Verify exactly ONE upsert_site_aggregate_candidate overload exists after the DROP/CREATE, returning uuid, so no legacy void-returning signature survives for PostgREST to resolve to', 'PASS', v_sigs);
  ELSE
    INSERT INTO public.test_results (test_id, description, status, details)
    VALUES ('TEST_69', 'Verify exactly ONE upsert_site_aggregate_candidate overload exists after the DROP/CREATE, returning uuid, so no legacy void-returning signature survives for PostgREST to resolve to', 'FAIL',
      format('count=%s sigs=%s', v_count, v_sigs));
  END IF;
EXCEPTION WHEN OTHERS THEN
  INSERT INTO public.test_results (test_id, description, status, sqlstate, details)
  VALUES ('TEST_69', 'Verify exactly ONE upsert_site_aggregate_candidate overload exists after the DROP/CREATE, returning uuid, so no legacy void-returning signature survives for PostgREST to resolve to', 'FAIL', SQLSTATE, SQLERRM);
END $$;

-- Summary Output Query
SELECT test_id, description, status, COALESCE(sqlstate, '00000') as sqlstate, details
FROM public.test_results
ORDER BY test_id ASC;
