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
  const endMarker = `ALTER FUNCTION matrix_map.${name}`;
  const next = migrationSql.indexOf(endMarker, start + 1);
  return migrationSql.slice(start, next === -1 ? undefined : next);
}

/** Count non-overlapping occurrences of a literal. */
function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at === -1) return count;
    count += 1;
    from = at + needle.length;
  }
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

  it('guards the lock helper create with an ordered DROP ... RESTRICT so the migration is reapply-safe without CREATE OR REPLACE', () => {
    // WHY THIS EXISTS. The helper was an unguarded bare CREATE FUNCTION, so any
    // reapply of this file aborted with 42723 duplicate_function roughly 490
    // lines before the candidate-audit invariant helper is invoked -- making
    // the legacy-upgrade path unreachable in production. No prior gate caught
    // it because the positive replay only ever applies this file ONCE against a
    // clean database; the full-script negative replay (NEG_01) exposed it.
    //
    // The fix must NOT be CREATE OR REPLACE (see the negative assertion below
    // and the test above): this is a SECURITY DEFINER function owned by
    // postgres. Nor may it be a create-only-if-absent guard, which on reapply
    // becomes a silent no-op that preserves a STALE privileged body.
    // DROP-then-CREATE always installs exactly the definition in this file.
    const DROP_STMT =
      'DROP FUNCTION IF EXISTS matrix_map.lock_site_aggregate_publication_sources() RESTRICT;';
    const CREATE_STMT = 'CREATE FUNCTION matrix_map.lock_site_aggregate_publication_sources()';

    // Asserted against COMMENT-STRIPPED SQL. Counting raw text would let a
    // commented-out `-- DROP FUNCTION IF EXISTS ... RESTRICT;` satisfy the
    // contract while the executable script still collided on reapply. The
    // explanatory comment block above this statement in the migration mentions
    // both forms in prose, so this distinction is load-bearing here, not
    // theoretical.
    const executable = migrationSql
      .split('\n')
      .map((line) => line.replace(/--.*$/, ''))
      .join('\n');

    // COUNT-anchored on executable SQL: exactly one of each.
    expect(countOccurrences(executable, DROP_STMT)).toBe(1);
    expect(countOccurrences(executable, CREATE_STMT)).toBe(1);

    // ORDER-anchored: the drop must precede the create. A DROP placed after the
    // CREATE would still satisfy a pair of bare toContain assertions while
    // leaving the reapply broken -- and would additionally uninstall the helper.
    const dropAt = executable.indexOf(DROP_STMT);
    const createAt = executable.indexOf(CREATE_STMT);
    expect(dropAt).toBeGreaterThanOrEqual(0);
    expect(createAt).toBeGreaterThanOrEqual(0);
    expect(dropAt).toBeLessThan(createAt);

    // ADJACENCY: nothing executable may run between the drop and the recreate.
    // An intervening statement would execute against a database where this
    // SECURITY DEFINER helper does not exist -- including anything that calls
    // it. Only whitespace is permitted in the gap.
    const between = executable.slice(dropAt + DROP_STMT.length, createAt);
    expect(between.trim()).toBe('');

    // RESTRICT is explicit and CASCADE is forbidden for this function: if a real
    // catalog dependency ever exists, the drop must FAIL CLOSED rather than
    // silently removing dependent objects.
    expect(migrationSql).not.toMatch(
      /DROP\s+FUNCTION[^;]*lock_site_aggregate_publication_sources[^;]*CASCADE/i,
    );

    // OBJECT IDENTITY: a successful reapply intentionally creates a NEW function
    // OID. REAPPLY_01 proves SEMANTIC equivalence (definition, owner, comment,
    // grants, catalog fingerprint), not object-identity equivalence. That is the
    // accepted trade for never preserving a stale privileged body.
  });

  it('self-test: the order/count assertions reject a post-create drop and a CASCADE drop', () => {
    // Proves the anchoring above actually discriminates, rather than asserting
    // in a comment that it does.
    const DROP_STMT =
      'DROP FUNCTION IF EXISTS matrix_map.lock_site_aggregate_publication_sources() RESTRICT;';
    const CREATE_STMT = 'CREATE FUNCTION matrix_map.lock_site_aggregate_publication_sources()';

    const wrongOrder = `${CREATE_STMT} RETURNS void;\n${DROP_STMT}\n`;
    expect(wrongOrder.indexOf(DROP_STMT)).toBeGreaterThan(wrongOrder.indexOf(CREATE_STMT));

    const duplicated = `${DROP_STMT}\n${DROP_STMT}\n${CREATE_STMT}\n`;
    expect(countOccurrences(duplicated, DROP_STMT)).toBe(2);

    const cascade =
      'DROP FUNCTION IF EXISTS matrix_map.lock_site_aggregate_publication_sources() CASCADE;';
    expect(cascade).toMatch(
      /DROP\s+FUNCTION[^;]*lock_site_aggregate_publication_sources[^;]*CASCADE/i,
    );
    expect(DROP_STMT).not.toMatch(
      /DROP\s+FUNCTION[^;]*lock_site_aggregate_publication_sources[^;]*CASCADE/i,
    );
  });

  it('defines a SECURITY DEFINER lock helper for source tables with strict search_path and grants', () => {
    const helperRpc = functionBody('lock_site_aggregate_publication_sources');

    expect(migrationSql).toContain(
      'CREATE FUNCTION matrix_map.lock_site_aggregate_publication_sources()',
    );
    // PRESERVED, not weakened. This helper is SECURITY DEFINER and owned by
    // postgres; CREATE OR REPLACE would let a later edit silently swap the body
    // of a privileged definer function instead of failing loudly.
    expect(migrationSql).not.toContain(
      'CREATE OR REPLACE FUNCTION matrix_map.lock_site_aggregate_publication_sources()',
    );
    expect(helperRpc).toContain('SECURITY DEFINER');
    expect(helperRpc).toContain('SET search_path = matrix_map, pg_temp');
    expect(helperRpc).toContain('LOCK TABLE matrix_map.dras IN SHARE MODE NOWAIT');
    expect(helperRpc).toContain('LOCK TABLE matrix_map.samples IN SHARE MODE NOWAIT');

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

    const drasLockIndex = helperRpc.indexOf('LOCK TABLE matrix_map.dras IN SHARE MODE NOWAIT');
    const samplesLockIndex = helperRpc.indexOf('LOCK TABLE matrix_map.samples IN SHARE MODE NOWAIT');

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

describe('F3 -- one SQL text-meaningfulness authority (blank_trim)', () => {
  it('defines blank_trim as IMMUTABLE, STRICT and search_path-fixed', () => {
    const body = functionBody('blank_trim');
    expect(body).toContain('IMMUTABLE');
    expect(body).toContain('STRICT');
    expect(body).toContain('SET search_path = pg_catalog');
  });

  it('uses CREATE OR REPLACE, because a CHECK constraint depends on it', () => {
    // A DROP ... RESTRICT would fail on reapply once a constraint depends on
    // the function. The signature never changes, so REPLACE is the reapply-safe
    // form here -- deliberately unlike the lock helper.
    expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION matrix_map.blank_trim(p_text text)');
    expect(migrationSql).not.toContain('DROP FUNCTION IF EXISTS matrix_map.blank_trim');
  });

  it('assigns ownership to matrix_map_owner BEFORE revoking, so writes still work', () => {
    // Load-bearing. A CHECK constraint calling this function is evaluated with
    // the privileges of whoever performs the INSERT, and every write happens
    // inside a SECURITY DEFINER RPC owned by matrix_map_owner. Without the
    // ALTER, the function keeps the script-runner's ownership, the REVOKEs
    // strip the inherited PUBLIC grant, and every candidate write fails 42501.
    // The offline replay caught exactly that; this test keeps it caught.
    const alterIdx = migrationSql.indexOf(
      'ALTER FUNCTION matrix_map.blank_trim(text) OWNER TO matrix_map_owner;',
    );
    const revokeIdx = migrationSql.indexOf(
      'REVOKE ALL ON FUNCTION matrix_map.blank_trim(text) FROM PUBLIC;',
    );
    expect(alterIdx).toBeGreaterThan(-1);
    expect(revokeIdx).toBeGreaterThan(-1);
    expect(alterIdx).toBeLessThan(revokeIdx);
  });

  it('revokes execute from every PostgREST-reachable role', () => {
    for (const role of ['PUBLIC', 'anon', 'authenticated', 'service_role']) {
      expect(migrationSql).toContain(
        `REVOKE ALL ON FUNCTION matrix_map.blank_trim(text) FROM ${role};`,
      );
    }
  });

  it('strips more than the ASCII space, including NBSP and BOM', () => {
    const body = functionBody('blank_trim');
    // Written as escapes so the file stays ASCII; these are the classes the
    // old `trim()` let through.
    for (const escape of ['\\u0009', '\\u00A0', '\\u2028', '\\u3000', '\\uFEFF']) {
      expect(body).toContain(escape);
    }
  });

  it('does NOT strip ZWNJ or ZWJ, which carry orthographic meaning', () => {
    const body = functionBody('blank_trim');
    expect(body).not.toContain('\\u200C');
    expect(body).not.toContain('\\u200D');
  });

  it('routes every member-facing and audit text predicate through it', () => {
    // The defect was `length(trim(x)) > 0` in the constraints and RPCs. Those
    // exact predicates must be gone from the validation surface.
    expect(migrationSql).not.toContain('length(trim(member_display_label))');
    expect(migrationSql).not.toContain('length(trim(publish_reason))');
    expect(migrationSql).not.toContain('length(trim(p_reason))');
    expect(migrationSql).not.toContain('length(trim(p_member_display_label))');
    expect(migrationSql).not.toContain('length(trim(v_actor_email))');
    expect(migrationSql).toContain('length(matrix_map.blank_trim(member_display_label)) > 0');
    expect(migrationSql).toContain('length(matrix_map.blank_trim(publish_reason)) > 0');
  });

  it('persists trimmed values through the same authority, not a bare trim', () => {
    expect(migrationSql).not.toContain('      trim(p_reason),');
    expect(migrationSql).toContain('matrix_map.blank_trim(p_reason)');
    expect(migrationSql).toContain('matrix_map.blank_trim(p_member_display_label)');
  });
});

describe('F4 -- pagination happens inside the admin RPC', () => {
  it('takes explicit bounds with NO argument defaults', () => {
    expect(migrationSql).toContain(
      'CREATE FUNCTION matrix_map.fetch_admin_site_aggregate_publications(\n' +
        '  p_publication_id uuid,\n' +
        '  p_limit integer,\n' +
        '  p_offset integer\n' +
        ')',
    );
    // A default would let a caller omit its bounds and reintroduce the defect,
    // and an overload pair would make PostgREST resolution ambiguous.
    expect(migrationSql).not.toContain('p_limit integer DEFAULT');
    expect(migrationSql).not.toContain('p_offset integer DEFAULT');
  });

  it('drops BOTH the pre-pagination and current signatures', () => {
    expect(migrationSql).toContain(
      'DROP FUNCTION IF EXISTS matrix_map.fetch_admin_site_aggregate_publications(uuid) RESTRICT;',
    );
    expect(migrationSql).toContain(
      'DROP FUNCTION IF EXISTS matrix_map.fetch_admin_site_aggregate_publications(uuid, integer, integer) RESTRICT;',
    );
  });

  it('applies LIMIT/OFFSET BEFORE the drift LATERAL', () => {
    // The whole point: RETURN QUERY materializes before any outer .range(), so
    // an unbounded main query evaluates the snapshot for every publication.
    const body = functionBody('fetch_admin_site_aggregate_publications');
    const limitIdx = body.indexOf('LIMIT p_limit OFFSET p_offset');
    const lateralIdx = body.indexOf('LEFT JOIN LATERAL matrix_map.current_site_aggregate_snapshot');
    expect(limitIdx).toBeGreaterThan(-1);
    expect(lateralIdx).toBeGreaterThan(-1);
    expect(limitIdx).toBeLessThan(lateralIdx);
  });

  it('materializes the page so the planner cannot inline it back into the join', () => {
    const body = functionBody('fetch_admin_site_aggregate_publications');
    expect(body).toContain('WITH page AS MATERIALIZED');
    expect(body).toContain('FROM page sap');
  });

  it('orders by a TOTAL key before paginating, so pages cannot overlap or skip', () => {
    const body = functionBody('fetch_admin_site_aggregate_publications');
    const order = 'ORDER BY sap.sample_count_total DESC, sap.member_display_label ASC, sap.id ASC';
    const orderIdx = body.indexOf(order);
    const limitIdx = body.indexOf('LIMIT p_limit OFFSET p_offset');
    expect(orderIdx).toBeGreaterThan(-1);
    expect(orderIdx).toBeLessThan(limitIdx);
  });

  it('validates bounds and fails closed with UE422', () => {
    const body = functionBody('fetch_admin_site_aggregate_publications');
    expect(body).toContain('c_max_limit constant integer := 1000');
    expect(body).toContain('p_limit IS NULL OR p_limit < 1 OR p_limit > c_max_limit');
    expect(body).toContain('p_offset IS NULL OR p_offset < 0');
    expect(countOccurrences(body, "USING ERRCODE = 'UE422'")).toBeGreaterThanOrEqual(2);
  });

  it('keeps ownership, self-authorization, search_path and grants on the new signature', () => {
    const body = functionBody('fetch_admin_site_aggregate_publications');
    expect(body).toContain('SECURITY DEFINER');
    expect(body).toContain('SET search_path = matrix_map, public, pg_temp');
    expect(body).toContain('requires admin or matrix_admin role');
    expect(migrationSql).toContain(
      'ALTER FUNCTION matrix_map.fetch_admin_site_aggregate_publications(uuid, integer, integer)\n  OWNER TO matrix_map_owner;',
    );
    expect(migrationSql).toContain(
      'REVOKE EXECUTE ON FUNCTION matrix_map.fetch_admin_site_aggregate_publications(uuid, integer, integer)',
    );
    expect(migrationSql).toContain(
      'GRANT EXECUTE ON FUNCTION matrix_map.fetch_admin_site_aggregate_publications(uuid, integer, integer)',
    );
  });
});

describe('F4 -- the admin page delegates its RPC loops to the extracted loaders', () => {
  // THE BOUNDS INVARIANT -- the admin RPC must receive its bounds as ARGUMENTS,
  // never as an outer `.range()` -- is now proved BEHAVIOURALLY, by asserting
  // the actual recorded `p_limit`/`p_offset` arguments of every consumer's real
  // calls element-for-element. See site-aggregate-pagination-behaviour.test.ts
  // and the per-route tests. The former source-token + fixed-character-window
  // guard that stood here was RETIRED: it located the call by exact source text
  // and inspected a fixed 600-character window, which claimed more than it
  // enforced. Do NOT reintroduce it, and do not substitute another source-text,
  // regex, token-window or AST approximation for the behavioural assertions.
  //
  // What remains here is the EXTRACTION guard below, which is not a restatement
  // of the bounds invariant: it keeps the loops in a module whose arguments are
  // executable in a test at all.

  it('the admin page delegates to the extracted loaders and calls the RPC nowhere itself', () => {
    // Guards the extraction: if the loop were pasted back into the server
    // component, its arguments would again be unexecutable in a test -- the
    // exact gap that let a `(page + 1) * PAGE_SIZE` mutation go unnoticed.
    const page = readFileSync(
      join(process.cwd(), 'src/app/(dashboard)/admin/matrix-map/site-aggregates/page.tsx'),
      'utf8',
    );
    expect(page).toContain("from '@/lib/matrix-map/site-aggregate-admin-loaders'");
    expect(page).not.toContain("rpc('fetch_admin_site_aggregate_publications'");
  });
});
