import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '../../../../../');
const drafts = path.join(root, 'docs/apply-drafts');
const read = (name: string) => fs.readFileSync(path.join(drafts, name), 'utf8');
const correction = read('MATRIX_GUIDED_R2_POLICY_CORRECTION.sql');

describe('guided R2 activation policy candidate', () => {
  it('preserves the exact installed R3 history source', () => {
    const installed = fs.readFileSync(path.join(root, 'supabase/migrations/20261117003834_matrix_guided_r2_inactive_20261116.sql'));
    expect(createHash('sha256').update(installed).digest('hex')).toBe('2c1ca572802df4a609ae15edd4e119aa81419edcf872953544f71de36fddc595');
  });

  it('binds all three user data tables and the empty allowlist to auth users', () => {
    for (const table of ['entries', 'completion', 'events']) {
      expect(correction).toMatch(new RegExp(`constraint matrix_guided_r2_${table}_user_fk[\\s\\S]*?foreign key \\(user_id\\) references auth\\.users\\(id\\) on delete cascade not valid`, 'i'));
      expect(correction).toContain(`validate constraint matrix_guided_r2_${table}_user_fk`);
    }
    expect(correction).toMatch(/constraint matrix_guided_r2_reviewer_allowlist_user_fk\s+foreign key \(user_id\) references auth\.users\(id\) on delete cascade/i);
    expect(correction).toContain('matrix_guided_r2_reviewer_allowlist_release_fk');
    expect(correction).toContain('alter table public.matrix_guided_r2_reviewer_allowlist enable row level security');
    expect(correction).not.toMatch(/insert\s+into\s+public\.matrix_guided_r2_reviewer_allowlist/i);
  });

  it('retains disabled-first RPCs and release-specific admission', () => {
    for (const name of ['save', 'complete']) {
      const body = correction.split(`create or replace function public.matrix_guided_r2_${name}(`)[1]?.split('$$;')[0];
      expect(body).toBeTruthy();
      expect(body!.indexOf("'release_read_only'")).toBeLessThan(body!.indexOf('v_user := auth.uid()'));
      expect(body!.indexOf('v_user := auth.uid()')).toBeLessThan(body!.indexOf('matrix_guided_r2_reviewer_allowlist a'));
      expect(body!.indexOf('matrix_guided_r2_reviewer_allowlist a')).toBeLessThan(body!.indexOf('p_expected_user_id is distinct from v_user'));
      expect(body).toContain("'reviewer_not_allowed'");
      expect(body).toContain('u.deleted_at is null');
      expect(body).toContain('for share of a,u');
    }
    expect(correction).toMatch(/create trigger matrix_guided_r2_events_append_only_trigger before update on/i);
    expect(correction).not.toMatch(/create trigger[^;]*before update or delete/i);
  });

  it('keeps provider bodies transaction-free and hash sidecars exact', () => {
    for (const stem of ['PREFLIGHT', 'CORRECTION', 'POSTFLIGHT', 'KILL_SWITCH_BODY', 'KILL_SWITCH_POSTFLIGHT', 'REVERSAL']) {
      const filename = `MATRIX_GUIDED_R2_POLICY_${stem}.sql`;
      const sql = read(filename);
      const sidecar = read(`${filename}.sha256`).trim();
      expect(sidecar).toBe(`${createHash('sha256').update(sql).digest('hex')}  ${filename}`);
      if (['CORRECTION', 'KILL_SWITCH_BODY', 'REVERSAL'].includes(stem)) expect(sql).not.toMatch(/^\s*(begin|commit)\s*;/im);
    }
  });

  it('retains the full prior R3 postflight query set for regression comparison', () => {
    expect(read('MATRIX_GUIDED_R2_POLICY_POSTFLIGHT.sql')).toContain(read('MATRIX_GUIDED_R2_POSTFLIGHT_2026_11_16.sql').trim());
  });

  it('checks the corrected security surface and exact kill-switch identity', () => {
    const postflight = read('MATRIX_GUIDED_R2_POLICY_POSTFLIGHT.sql');
    expect(postflight).toContain('zero_allowlist_policies');
    expect(postflight).toContain('public_has_zero_allowlist_grants');
    expect(postflight).toContain('allowlist_privilege_denied');
    expect(postflight).toContain('exact_execute_grant');
    expect(postflight).toContain('exact_cascading_user_fk');
    for (const role of ['PUBLIC', 'anon', 'authenticated', ['service', 'role'].join('_')]) {
      expect(postflight).toContain(`,'${role}',`);
    }
    for (const table of ['entries', 'completion', 'events', 'reviewer_allowlist']) {
      expect(postflight).toContain(`matrix_guided_r2_${table}_user_fk`);
    }
    const killSwitch = read('MATRIX_GUIDED_R2_POLICY_KILL_SWITCH_BODY.sql');
    const disabledAssertion = killSwitch.split('if exists (select 1 from public.matrix_guided_r2_activation')[1]?.split('then')[0];
    expect(disabledAssertion).toContain('document_version =');
    expect(disabledAssertion).toContain('guided_manifest_sha256 =');
    expect(disabledAssertion).toContain('review_manifest_sha256 =');
  });
});
