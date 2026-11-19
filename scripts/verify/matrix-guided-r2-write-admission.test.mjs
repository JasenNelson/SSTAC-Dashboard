import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { test } = process.env.VITEST === 'true' ? await import('vitest') : await import('node:test');

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const migration = readFileSync(path.join(repoRoot, 'supabase/migrations/20261118000001_matrix_guided_r2_all_users_write_admission.sql'), 'utf8');
const route = readFileSync(path.join(repoRoot, 'src/lib/matrix-options/paper/guided-r2-route.ts'), 'utf8');
const saveRoute = readFileSync(path.join(repoRoot, 'src/app/api/matrix-options/paper/guided-r2/targets/[targetId]/route.ts'), 'utf8');
const completeRoute = readFileSync(path.join(repoRoot, 'src/app/api/matrix-options/paper/guided-r2/complete/route.ts'), 'utf8');

function body(name) {
  const start = migration.indexOf(`create or replace function public.${name}(`);
  assert.notEqual(start, -1, `missing ${name}`);
  const marker = name === 'matrix_guided_r2_reviewer_allowed' ? '$function$' : '$$';
  const open = migration.indexOf(`as ${marker}`, start);
  assert.notEqual(open, -1, `missing ${name} body`);
  const close = migration.indexOf(`${marker};`, open + marker.length + 3);
  assert.notEqual(close, -1, `unterminated ${name} body`);
  return migration.slice(open + marker.length + 3, close);
}

function assertWriteOrder(sql, name) {
  const barrier = sql.indexOf('select enabled into v_active');
  const disabled = sql.indexOf("if v_active is distinct from true then return jsonb_build_object('outcome','release_read_only'); end if;");
  const user = sql.indexOf('v_user := auth.uid()');
  const reviewer = sql.indexOf('public.matrix_guided_r2_reviewer_allowed(');
  const liveUserLock = sql.indexOf('from auth.users u where u.id = v_user and u.deleted_at is null for share of u');
  const firstWrite = Math.min(...['update public.matrix_guided_r2_entries', 'insert into public.matrix_guided_r2_entries', 'insert into public.matrix_guided_r2_completion', 'insert into public.matrix_guided_r2_events'].map((needle) => {
    const at = sql.indexOf(needle);
    return at === -1 ? Infinity : at;
  }));
  assert.ok(Number.isFinite(firstWrite), `${name}: expected a write to guard`);
  assert.ok(barrier >= 0 && barrier < disabled, `${name}: disabled barrier missing`);
  assert.ok(disabled < user && user < reviewer, `${name}: reviewer check must follow disabled barrier and auth`);
  assert.match(sql.slice(reviewer, liveUserLock), /is distinct from true then\s+return jsonb_build_object\('outcome','reviewer_not_allowed'\);/);
  assert.ok(reviewer < liveUserLock && liveUserLock < firstWrite, `${name}: live-user lock must precede all writes`);
  assert.match(sql.slice(reviewer, firstWrite), /if not found then return jsonb_build_object\('outcome','reviewer_not_allowed'\); end if;/);
}

test('both direct write RPCs preserve the disabled barrier and reject nonreviewers before any write', () => {
  for (const name of ['matrix_guided_r2_save', 'matrix_guided_r2_complete']) {
    assertWriteOrder(body(name), name);
  }
});

test('contract check catches the original direct-RPC defect', () => {
  for (const name of ['matrix_guided_r2_save', 'matrix_guided_r2_complete']) {
    const weakened = body(name).replace('public.matrix_guided_r2_reviewer_allowed(', 'public.missing_admission(');
    assert.throws(() => assertWriteOrder(weakened, name));
    const nullPermissive = body(name).replace(
      'p_document_version,p_guided_manifest_sha256,p_review_manifest_sha256) is distinct from true then',
      'p_document_version,p_guided_manifest_sha256,p_review_manifest_sha256) then',
    );
    assert.throws(() => assertWriteOrder(nullPermissive, name));
  }
});

test('admission is release-bound, nonanonymous, and backed by a live user row', () => {
  const admission = body('matrix_guided_r2_reviewer_allowed');
  assert.match(admission, /p_document_version is distinct from 'phase2-review-2026-11-fa356b89'/);
  assert.match(admission, /v_claims -> 'is_anonymous' is distinct from 'false'::jsonb/);
  assert.match(admission, /v_claims ->> 'sub' is distinct from v_user::text/);
  assert.match(admission, /from auth\.users u\s+where u\.id = v_user and u\.deleted_at is null/);
  assert.doesNotMatch(migration, /update public\.matrix_guided_r2_activation\s+set enabled\s*=\s*true/i);
  assert.match(migration, /select enabled into strict v_enabled from public\.matrix_guided_r2_activation[\s\S]*?for share;\s+if v_enabled is distinct from false then/);
});

test('application and direct RPCs name the same admission function', () => {
  assert.match(route, /supabase\.rpc\('matrix_guided_r2_reviewer_allowed'/);
  assert.match(saveRoute, /guidedReviewerGate\(/);
  assert.match(completeRoute, /guidedReviewerGate\(/);
  assert.match(body('matrix_guided_r2_save'), /public\.matrix_guided_r2_reviewer_allowed\(/);
  assert.match(body('matrix_guided_r2_complete'), /public\.matrix_guided_r2_reviewer_allowed\(/);
  for (const table of ['entries', 'completion']) {
    assert.match(migration, new RegExp(`alter policy matrix_guided_r2_${table}_own_read[\\s\\S]*?public\\.matrix_guided_r2_reviewer_allowed\\(`));
  }
});

test('migration rejects unexpected EXECUTE grantees before and after replacement', () => {
  assert.equal((migration.match(/pg_catalog\.aclexplode\(/g) ?? []).length, 2);
  assert.equal((migration.match(/a\.grantee not in \(p\.proowner,'authenticated'::regrole\)/g) ?? []).length, 2);
  assert.equal((migration.match(/a\.is_grantable/g) ?? []).length, 2);
  assert.match(migration, /revoke all on function public\.matrix_guided_r2_save[\s\S]*?from public, anon, authenticated, service_role;/);
  assert.equal((migration.match(/c\.relkind = 'r' and c\.relrowsecurity/g) ?? []).length, 2);
});
