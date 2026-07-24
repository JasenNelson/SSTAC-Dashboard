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
  const start = migrationSql.indexOf(`CREATE OR REPLACE FUNCTION matrix_map.${name}`);
  expect(start).toBeGreaterThanOrEqual(0);
  const next = migrationSql.indexOf('CREATE OR REPLACE FUNCTION matrix_map.', start + 1);
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
});
