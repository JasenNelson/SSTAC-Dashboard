import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationSql = readFileSync(
  join(
    process.cwd(),
    'docs/design/matrix-map/OPTION_C_PHASE2_SITE_AGGREGATE_PUBLICATIONS_DRAFT_2026_07_24.sql',
  ),
  'utf8',
);

function functionBody(name: string): string {
  let start = migrationSql.indexOf(`CREATE OR REPLACE FUNCTION matrix_map.${name}`);
  if (start === -1) {
    start = migrationSql.indexOf(`CREATE FUNCTION matrix_map.${name}`);
  }
  expect(start).toBeGreaterThanOrEqual(0);
  const nextReplace = migrationSql.indexOf('CREATE OR REPLACE FUNCTION matrix_map.', start + 1);
  const nextCreate = migrationSql.indexOf('CREATE FUNCTION matrix_map.', start + 1);
  let next = -1;
  if (nextReplace !== -1 && nextCreate !== -1) {
    next = Math.min(nextReplace, nextCreate);
  } else if (nextReplace !== -1) {
    next = nextReplace;
  } else {
    next = nextCreate;
  }
  return migrationSql.slice(start, next === -1 ? undefined : next);
}

function returnsTableBlock(name: string): string {
  const body = functionBody(name);
  const end = body.indexOf('LANGUAGE');
  expect(end).toBeGreaterThanOrEqual(0);
  return body.slice(0, end);
}

describe('Option C Phase 2 aggregate publication migration draft', () => {
  it('adds aggregate publication and audit tables without changing sample or DRA publication state', () => {
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS matrix_map.site_aggregate_publications');
    expect(migrationSql).toContain(
      'CREATE TABLE IF NOT EXISTS matrix_map.site_aggregate_publication_audit',
    );
    expect(migrationSql).not.toMatch(/UPDATE\s+matrix_map\.dras\s+SET\s+public/i);
    expect(migrationSql).not.toMatch(/UPDATE\s+matrix_map\.samples\s+SET\s+public/i);
    expect(migrationSql).toContain('sample_count_total > 0');
  });

  it('keeps the member read surface RPC-only and payload-contained', () => {
    const memberRpc = functionBody('fetch_published_site_aggregates');
    const memberReturns = returnsTableBlock('fetch_published_site_aggregates');

    expect(memberRpc).toContain('RETURNS TABLE');
    expect(memberRpc).toContain('aggregate_id uuid');
    expect(memberRpc).toContain('sample_count_bucket text');
    expect(memberRpc).toContain('matrix_map.site_aggregate_count_bucket');
    expect(memberRpc).toContain('visible_sample_suppression_key text');
    expect(memberRpc).toContain('matrix_map.has_private_grant(d.id)');
    expect(memberRpc).toContain("ur.role IN ('admin', 'matrix_admin')");
    expect(memberRpc).toContain('sap.source_dra_id::text');
    expect(memberRpc).toContain('JOIN matrix_map.dras d ON d.id = sap.source_dra_id');
    expect(memberRpc).toContain('AND d.is_deleted = false');
    expect(memberReturns).not.toContain('source_dra_id');
    expect(memberReturns).not.toContain('sample_count_total');
    expect(memberReturns).not.toContain('sample_count_high');
    expect(memberReturns).not.toContain('sample_count_medium');
    expect(memberReturns).not.toContain('source_sample_hash');
    expect(memberReturns).not.toContain('title');
  });

  it('conditionally returns a DRA-derived suppression key only if the caller has pre-existing access', () => {
    const memberRpc = functionBody('fetch_published_site_aggregates');

    expect(memberRpc).toContain('CASE');
    expect(memberRpc).toMatch(/WHEN d\.public = true\s+OR matrix_map\.has_private_grant\(d\.id\)/);
    expect(memberRpc).toMatch(/OR EXISTS \(\s*SELECT 1\s*FROM public\.user_roles ur/);
    expect(memberRpc).toMatch(/THEN sap\.source_dra_id::text \|\| ':' \|\| sap\.coordinate_cluster_id/);
    expect(memberRpc).toContain('ELSE NULL');
    expect(memberRpc).toContain('END AS visible_sample_suppression_key');
  });

  it('does not grant direct member SELECT on the raw publication or audit tables', () => {
    expect(migrationSql).not.toMatch(
      /GRANT\s+SELECT\s+ON\s+matrix_map\.site_aggregate_publications\s+TO\s+authenticated/i,
    );
    expect(migrationSql).not.toMatch(
      /GRANT\s+SELECT\s+ON\s+matrix_map\.site_aggregate_publication_audit\s+TO\s+authenticated/i,
    );
    expect(migrationSql).toMatch(/REVOKE\s+ALL\s+ON\s+matrix_map\.site_aggregate_publications/i);
    expect(migrationSql).toMatch(/REVOKE\s+ALL\s+ON\s+matrix_map\.site_aggregate_publication_audit/i);
  });

  it('grants the SECURITY DEFINER owner the audit read needed by the audit RPC', () => {
    const auditRpc = functionBody('fetch_site_aggregate_publication_audit');

    expect(auditRpc).toContain('FROM matrix_map.site_aggregate_publication_audit a');
    expect(migrationSql).toMatch(
      /GRANT\s+SELECT\s*,\s*INSERT\s+ON\s+matrix_map\.site_aggregate_publication_audit\s+TO\s+matrix_map_owner/i,
    );
  });

  it('uses an audited RPC marker and trigger to block direct publication state changes', () => {
    const triggerFunction = functionBody('enforce_site_aggregate_publication_via_rpc');
    const flipRpc = functionBody('flip_site_aggregate_public');

    expect(triggerFunction).not.toContain('SECURITY DEFINER');
    expect(triggerFunction).toContain("current_user IS DISTINCT FROM 'matrix_map_owner'");
    expect(triggerFunction).toContain("TG_OP = 'INSERT'");
    expect(triggerFunction).toContain('NEW.is_published IS TRUE');
    expect(triggerFunction).toContain('matrix_map.audited_site_aggregate_publication');
    expect(migrationSql).toContain('BEFORE INSERT OR UPDATE ON matrix_map.site_aggregate_publications');
    expect(migrationSql).toContain('ENABLE ALWAYS');
    expect(flipRpc).toContain('SECURITY DEFINER');
    expect(flipRpc).toContain('matrix_map.current_user_id()');
    expect(flipRpc).toContain('v_uid <> p_actor_id');
    expect(flipRpc).toContain('matrix_map.audited_site_aggregate_publication');
    expect(flipRpc).toContain('matrix_map.site_aggregate_publication_audit');
  });

  it('limits execution grants to authenticated callers and keeps anon/public/service_role out', () => {
    expect(migrationSql).toMatch(
      /REVOKE\s+EXECUTE\s+ON\s+FUNCTION\s+matrix_map\.flip_site_aggregate_public/i,
    );
    expect(migrationSql).toMatch(
      /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+matrix_map\.flip_site_aggregate_public/i,
    );
    expect(migrationSql).not.toMatch(
      /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+matrix_map\.[^(]+\([^;]+TO\s+anon/i,
    );
  });

  it('enforces publish-time freshness and validates the aggregate snapshot before flip', () => {
    const flipRpc = functionBody('flip_site_aggregate_public');

    expect(flipRpc).toContain('matrix_map.current_site_aggregate_snapshot(');
    expect(flipRpc).toContain('v_snap.sample_count_medium = 0');
    expect(flipRpc).toContain('site aggregate publication % snapshot drift detected');

    expect(flipRpc).toContain('v_snap.representative_latitude IS DISTINCT FROM v_row.representative_latitude');
    expect(flipRpc).toContain('v_snap.representative_longitude IS DISTINCT FROM v_row.representative_longitude');
    expect(flipRpc).toContain('v_snap.sample_count_total IS DISTINCT FROM v_row.sample_count_total');
    expect(flipRpc).toContain('v_snap.sample_count_high IS DISTINCT FROM v_row.sample_count_high');
    expect(flipRpc).toContain('v_snap.sample_count_medium IS DISTINCT FROM v_row.sample_count_medium');
    expect(flipRpc).toContain('v_snap.sample_count_low IS DISTINCT FROM v_row.sample_count_low');
    expect(flipRpc).toContain('v_snap.distinct_point_count IS DISTINCT FROM v_row.distinct_point_count');
    expect(flipRpc).toContain('v_snap.coordinate_quality_tier IS DISTINCT FROM v_row.coordinate_quality_tier');
    expect(flipRpc).toContain('v_snap.coordinate_source IS DISTINCT FROM v_row.coordinate_source');
    expect(flipRpc).toContain('v_snap.source_sample_hash IS DISTINCT FROM v_row.source_sample_hash');
  });

  it('defines a deterministic snapshot helper computing drift fingerprint correctly', () => {
    const snapshotRpc = functionBody('current_site_aggregate_snapshot');

    expect(snapshotRpc).toContain('matrix_map.canonical_five_decimal_cluster(s.latitude, s.longitude) = p_cluster_id');

    // 1. dom_tier selects tier with greatest count, ties ordered high, then medium, then low, then ELSE 4, with lexical tie-break and NULLS LAST
    expect(snapshotRpc).toContain(
      "ORDER BY sub.cnt DESC, CASE sub.tier WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END ASC, sub.tier COLLATE \"C\" ASC NULLS LAST",
    );

    // 2. dom_source collects nonblank distinct coordinate_source, sorts lexically, joins with '; '
    expect(snapshotRpc).toContain("string_agg(sub.src, '; ' ORDER BY sub.src COLLATE \"C\" ASC)");
    expect(snapshotRpc).toContain("WHERE cs_src.coordinate_source IS NOT NULL AND length(trim(cs_src.coordinate_source)) > 0");

    // 3. distinct_point_count counts distinct canonical five-decimal cluster ids
    expect(snapshotRpc).toContain("count(DISTINCT matrix_map.canonical_five_decimal_cluster(cs_main.latitude, cs_main.longitude))::integer AS dp_cnt");

    // 4. source_sample_hash hashes an id-sorted per-sample canonical string
    expect(snapshotRpc).toContain("jsonb_build_array(");
    expect(snapshotRpc).toContain("cs_hash.id::text,");
    expect(snapshotRpc).toContain("matrix_map.canonical_five_decimal_cluster(cs_hash.latitude, cs_hash.longitude),");
    expect(snapshotRpc).toContain("cs_hash.coordinate_quality_tier,");
    expect(snapshotRpc).toContain("cs_hash.coordinate_source");
    expect(snapshotRpc).toContain("E'\\n' ORDER BY cs_hash.id ASC");
    expect(snapshotRpc).toContain("md5(member_hash_input)");

    // 5. representative coordinate matches the first sample by id after five-decimal canonicalization
    expect(snapshotRpc).toContain("SELECT round(cs_rep.latitude::numeric, 5)::double precision FROM cluster_samples cs_rep ORDER BY cs_rep.id ASC LIMIT 1");
    expect(snapshotRpc).toContain("SELECT round(cs_rep.longitude::numeric, 5)::double precision FROM cluster_samples cs_rep ORDER BY cs_rep.id ASC LIMIT 1");
  });

  it('defines a SECURITY DEFINER lock helper for source tables with strict search_path and grants', () => {
    const helperRpc = functionBody('lock_site_aggregate_publication_sources');

    expect(migrationSql).toContain(
      'CREATE FUNCTION matrix_map.lock_site_aggregate_publication_sources()',
    );
    expect(migrationSql).not.toContain(
      'CREATE OR REPLACE FUNCTION matrix_map.lock_site_aggregate_publication_sources()',
    );
    expect(helperRpc).toContain('SECURITY DEFINER');
    expect(helperRpc).toContain('SET search_path = matrix_map, pg_temp');
    expect(helperRpc).toContain('LOCK TABLE matrix_map.dras IN SHARE MODE');
    expect(helperRpc).toContain('LOCK TABLE matrix_map.samples IN SHARE MODE');

    // Helper must alter owner to postgres
    expect(migrationSql).toContain(
      'ALTER FUNCTION matrix_map.lock_site_aggregate_publication_sources() OWNER TO postgres;',
    );

    // Lock down execute permissions with REVOKE ALL and GRANT EXECUTE only to matrix_map_owner
    expect(migrationSql).toMatch(
      /REVOKE\s+ALL\s+ON\s+FUNCTION\s+matrix_map\.lock_site_aggregate_publication_sources\(\)\s+FROM\s+PUBLIC,\s*anon,\s*authenticated,\s*service_role;/i,
    );
    expect(migrationSql).not.toMatch(
      /GRANT\s+[^;\n]+\s+ON\s+FUNCTION\s+matrix_map\.lock_site_aggregate_publication_sources\(\)\s+TO\s+(PUBLIC|anon|authenticated|service_role)/i,
    );
    expect(migrationSql).toMatch(
      /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+matrix_map\.lock_site_aggregate_publication_sources\(\)\s+TO\s+matrix_map_owner;/i,
    );
  });

  it('enforces table SHARE lock order dras then samples', () => {
    const helperRpc = functionBody('lock_site_aggregate_publication_sources');

    const drasLockIndex = helperRpc.indexOf('LOCK TABLE matrix_map.dras IN SHARE MODE');
    const samplesLockIndex = helperRpc.indexOf('LOCK TABLE matrix_map.samples IN SHARE MODE');

    expect(drasLockIndex).toBeGreaterThan(-1);
    expect(samplesLockIndex).toBeGreaterThan(drasLockIndex);
  });

  it('calls the lock helper before reading dras or samples when flipping publication to true', () => {
    const flipRpc = functionBody('flip_site_aggregate_public');

    expect(flipRpc).toContain('PERFORM matrix_map.lock_site_aggregate_publication_sources()');

    const lockIndex = flipRpc.indexOf('PERFORM matrix_map.lock_site_aggregate_publication_sources()');
    const draReadIndex = flipRpc.indexOf('FROM matrix_map.dras d');
    const snapshotReadIndex = flipRpc.indexOf('matrix_map.current_site_aggregate_snapshot');
    const publishTrueIndex = flipRpc.indexOf('IF p_new_value = true THEN');

    expect(lockIndex).toBeGreaterThan(publishTrueIndex);
    expect(draReadIndex).toBeGreaterThan(lockIndex);
    expect(snapshotReadIndex).toBeGreaterThan(lockIndex);
  });

  it('enforces read committed transaction isolation check before any table SELECT in flip_site_aggregate_public', () => {
    const flipRpc = functionBody('flip_site_aggregate_public');

    expect(flipRpc).toContain("current_setting('transaction_isolation')");
    expect(flipRpc).toContain('p_new_value = true');

    const isolationCheckIndex = flipRpc.indexOf("current_setting('transaction_isolation')");
    const userRolesSelectIndex = flipRpc.indexOf('FROM public.user_roles');
    const tableSelectIndex = flipRpc.indexOf('FROM matrix_map.site_aggregate_publications');

    expect(isolationCheckIndex).toBeGreaterThan(-1);
    expect(userRolesSelectIndex).toBeGreaterThan(isolationCheckIndex);
    expect(tableSelectIndex).toBeGreaterThan(isolationCheckIndex);
  });
});
