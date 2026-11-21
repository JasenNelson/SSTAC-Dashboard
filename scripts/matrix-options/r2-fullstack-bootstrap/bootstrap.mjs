#!/usr/bin/env node
// Matrix R2 disposable local full-stack preview bootstrap (LOCAL ONLY).
//
//   node bootstrap.mjs pin                 refresh manifest sha256 pins (maintainer use; review the diff)
//   node bootstrap.mjs prepare             verify every bound source; write the RUN's config + migrations
//   node bootstrap.mjs post-start          apply post-start fixtures through the run's db container
//   node bootstrap.mjs verify              fingerprint the run's db and compare with the production baseline
//   node bootstrap.mjs seed <sourceRoot>   seed the run's disposable accounts, legacy rows, the five R2 objects, enable local activation
//   node bootstrap.mjs env                 write the run's allowlisted env result (API_URL and ANON_KEY only)
//   node bootstrap.mjs ports               exit 0 only if every published port of the run binds 127.0.0.1
//
// Every command except `pin` acts on exactly one open run, proven through custody.mjs from the run id
// and candidate the wrapper exports (R2_PREVIEW_RUN_ID, R2_PREVIEW_CANDIDATE), with a live recorded
// holder. Every input it reads is read ONCE, checked against the run's binding (path, bytes,
// SHA-256, bound to the candidate before startup) and only those bytes are used; the digests actually
// consumed are written to the run's consumed records for the receipt. Sensitive requests (account
// creation, private object upload) re-prove the run-owned API destination immediately before each
// send and never follow a redirect. Fails closed; never contacts a non-loopback host and never reads
// .env.local or any test-account credential: the accounts it seeds are fresh, local-only and
// disposable (accounts.mjs).
import { createHash, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PREVIEW_ACCOUNTS, SIGN_IN_MODE, newDisposableSignIns } from './accounts.mjs';
import {
  CustodyError, apiDestination, assertBoundDockerEnv, assertRunWorkable, createGuardedSender, defaultProcessTable,
  inspectContainer, listenersOn, proveRun, runPortBindings, treeDigests, verifyConsumed,
} from './custody.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..', '..');
const SELF = 'scripts/matrix-options/r2-fullstack-bootstrap';
const CLI = 'supabase@2.122.1';
const R2_VERSION = 'phase2-review-2026-11-fa356b89';
const R2_PAPER = { sha256: 'fa356b89f2a80d783a39ef70b8f99b79794c5c5377e3b80567a1b23c624edda2', bytes: 74568 };
const CONTRACT = 'src/lib/matrix-options/paper/contracts/accepted-figures-phase2-review-2026-11-fa356b89.json';
export const ENV_RESULT_SCHEMA = 'r2-preview-env-result/1';
const LAUNCH_PATTERN = /^[0-9a-f]{32}$/;

const fail = (message) => { console.error(`[r2-bootstrap] FAIL: ${message}`); process.exit(1); };
const log = (message) => console.log(`[r2-bootstrap] ${new Date().toISOString()} ${message}`);
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const loopback = (value) => { try { return new URL(value).hostname === '127.0.0.1'; } catch { return false; } };

/** The one open run this invocation may act on, proven from the slot file and the run state. */
let currentRun = null;
function run() {
  if (currentRun) return currentRun;
  try {
    assertBoundDockerEnv(process.env);
    const state = proveRun({ repoRoot, runId: process.env.R2_PREVIEW_RUN_ID, candidateSha: process.env.R2_PREVIEW_CANDIDATE });
    assertRunWorkable(state, defaultProcessTable());
    if (!state.inputs) fail('the run inputs are not bound; nothing was done');
    currentRun = state;
  } catch (error) { fail(error instanceof CustodyError ? error.message : 'run custody check failed'); }
  return currentRun;
}

// ---------------------------------------------------------------- consumed inputs

const consumed = { files: [], sources: [], generated: [] };
/** Reads a bound repository input once, verifies it against the binding, and returns those bytes. */
function consume(relative) {
  let bytes;
  try { bytes = fs.readFileSync(path.join(repoRoot, relative)); } catch { fail(`missing source ${relative}`); }
  try { consumed.files.push(verifyConsumed(run().inputs, relative, bytes)); } catch (error) { fail(error instanceof CustodyError ? error.message : `input ${relative} could not be verified`); }
  return bytes;
}
/** The bootstrap's own code, as it is on disk now, must be the bound code. */
function selfCheck() { for (const name of ['bootstrap.mjs', 'custody.mjs', 'accounts.mjs']) consume(`${SELF}/${name}`); }
function writeConsumed(command) {
  const state = run();
  const launch = process.env.R2_PREVIEW_LAUNCH_ID ?? '';
  const dir = path.join(state.run_dir, 'consumed');
  fs.mkdirSync(dir, { recursive: true });
  const record = { run_id: state.run_id, command, launch_id: LAUNCH_PATTERN.test(launch) ? launch : null, at: new Date().toISOString(), ...consumed };
  fs.writeFileSync(path.join(dir, `${command}-${record.launch_id ?? 'unlaunched'}-${randomBytes(3).toString('hex')}.json`), `${JSON.stringify(record, null, 2)}\n`, { flag: 'wx' });
}

function exec(command, args, options = {}) {
  // npx is a .cmd shim on Windows; call it through cmd.exe with fixed, non-user arguments.
  const [file, argv] = process.platform === 'win32' && command === 'npx' ? ['cmd.exe', ['/d', '/s', '/c', 'npx', ...args]] : [command, args];
  const result = spawnSync(file, argv, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 10 * 60_000, ...options });
  if (result.error) fail(`${command} could not complete: ${result.error.message}`);
  return result;
}

function psql(sql, { tuples = false, redact = false } = {}) {
  const args = ['exec', '-i', `supabase_db_${run().project_id}`, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-X', '-q'];
  if (tuples) args.push('-At', '-F', '\t');
  const result = exec('docker', args, { input: sql });
  if (result.status !== 0) fail(redact ? 'psql failed (output withheld: the statement carries an account identity)' : `psql failed: ${(result.stderr || result.stdout).trim().split('\n').slice(-6).join(' | ')}`);
  return result.stdout;
}

/** Real seed data is loaded only when every published port of THIS run is bound to 127.0.0.1. */
function publishedPortsLoopbackOnly() {
  try {
    const bindings = runPortBindings({ projectId: run().project_id });
    return bindings.length > 0 && bindings.every((binding) => binding.startsWith('127.0.0.1:'));
  } catch (error) { fail(error instanceof CustodyError ? error.message : 'docker ps failed'); }
}

function cliStatusEnv() {
  const { run_dir: runDir } = run();
  const result = exec('npx', ['--yes', CLI, 'status', '-o', 'env', '--workdir', runDir], { cwd: runDir });
  if (result.status !== 0) fail('supabase status failed; is the run\'s local stack running?');
  const env = {};
  for (const line of result.stdout.split(/\r?\n/)) {
    const match = /^([A-Z_]+)="?(.*?)"?$/.exec(line.trim());
    if (match) env[match[1]] = match[2];
  }
  for (const key of ['API_URL', 'ANON_KEY', 'SERVICE_ROLE_KEY', 'DB_URL']) if (!env[key]) fail(`supabase status is missing ${key}`);
  if (!loopback(env.API_URL) || !loopback(env.DB_URL)) fail('the run\'s local stack endpoint is not loopback');
  if (env.API_URL !== `http://127.0.0.1:${run().ports.api}`) fail('the local stack API is not this run\'s loopback endpoint');
  return env;
}

/** The proven run-owned API destination now (container, published port, listener identity). */
function proveDestination() {
  const state = run();
  return apiDestination({ run: state, inspect: (name) => inspectContainer(name), listeners: (ports) => listenersOn(ports), processTable: () => defaultProcessTable() });
}
/** A sender that re-proves the destination before every sensitive request. */
function guardedSender() {
  let initial;
  try { initial = proveDestination(); } catch (error) { fail(error instanceof CustodyError ? error.message : 'the API destination could not be proven'); }
  const send = createGuardedSender({ initial, prove: proveDestination, send: (url, init) => fetch(url, init) });
  return async (pathname, init) => {
    try { return await send(pathname, init); } catch (error) { fail(error instanceof CustodyError ? error.message : 'the request could not be sent'); }
  };
}

function pin() {
  const manifestPath = path.join(here, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  for (const step of [...manifest.migrations, ...manifest.postStart]) step.sha256 = sha256(fs.readFileSync(path.join(repoRoot, step.source)));
  manifest.parity.querySha256 = sha256(fs.readFileSync(path.join(repoRoot, manifest.parity.query)));
  manifest.parity.baselineSha256 = sha256(fs.readFileSync(path.join(repoRoot, manifest.parity.baseline)));
  manifest.configTemplateSha256 = sha256(fs.readFileSync(path.join(here, 'config.toml')));
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  log('manifest pins refreshed; review the diff before committing');
}

/**
 * Reads the manifest and every source it pins exactly once, each checked against the run binding and
 * against the manifest pin. Returns the verified bytes; callers use only these bytes.
 */
function loadPinned() {
  const manifest = JSON.parse(consume(`${SELF}/manifest.json`).toString('utf8'));
  const steps = [...manifest.migrations, ...manifest.postStart];
  const seen = new Set();
  const bytes = new Map();
  for (const step of steps) {
    for (const dependency of step.dependsOn ?? []) if (!seen.has(dependency)) fail(`step ${step.order} depends on ${dependency}, which is not earlier`);
    seen.add(step.order);
    const content = consume(step.source);
    if (sha256(content) !== step.sha256) fail(`hash mismatch for ${step.source}: pinned ${step.sha256}, found ${sha256(content)}`);
    bytes.set(step.source, content);
  }
  for (const [file, pinned] of [[manifest.parity.query, manifest.parity.querySha256], [manifest.parity.baseline, manifest.parity.baselineSha256]]) {
    const content = consume(file);
    if (sha256(content) !== pinned) fail(`hash mismatch for ${file}`);
    bytes.set(file, content);
  }
  const config = consume(`${SELF}/config.toml`);
  if (sha256(config) !== manifest.configTemplateSha256) fail('hash mismatch for config.toml');
  bytes.set('config.toml', config);
  const targets = manifest.migrations.map((step) => step.target);
  if ([...targets].sort().join() !== targets.join()) fail('migration targets are not in apply order');
  return { manifest, bytes };
}

/** The run's own Supabase config: the pinned template with only the run's project id and ports. */
export function renderConfig(template, state) {
  const values = { PROJECT_ID: state.project_id, API_PORT: state.ports.api, DB_PORT: state.ports.db, SHADOW_PORT: state.ports.shadow, APP_PORT: state.ports.app };
  const rendered = template.replace(/@@([A-Z_]+)@@/g, (whole, name) => (name in values ? String(values[name]) : whole));
  if (/@@[A-Z_]+@@/.test(rendered)) throw new Error('config template has an unknown placeholder');
  return rendered;
}

function prepare() {
  const { manifest, bytes } = loadPinned();
  const state = run();
  const supabaseDir = path.join(state.run_dir, 'supabase');
  const migrationsDir = path.join(supabaseDir, 'migrations');
  if (fs.existsSync(supabaseDir)) fail('this run was already prepared; a run is prepared once');
  fs.mkdirSync(migrationsDir, { recursive: true });
  let rendered;
  try { rendered = renderConfig(bytes.get('config.toml').toString('utf8'), state); } catch (error) { fail(error.message); }
  fs.writeFileSync(path.join(supabaseDir, 'config.toml'), rendered, { flag: 'wx' });
  for (const step of manifest.migrations) {
    fs.writeFileSync(path.join(migrationsDir, step.target), bytes.get(step.source), { flag: 'wx' });
    if (sha256(fs.readFileSync(path.join(migrationsDir, step.target))) !== step.sha256) fail(`copy of ${step.source} is not byte-identical`);
  }
  // The generated bundle is recorded once; generated-check refuses any change before the stack starts.
  consumed.generated = treeDigests(supabaseDir);
  fs.writeFileSync(path.join(state.run_dir, 'generated-bundle.json'), `${JSON.stringify({ run_id: state.run_id, files: consumed.generated }, null, 2)}\n`, { flag: 'wx' });
  log(`prepared ${manifest.migrations.length} byte-identical migrations for project ${state.project_id}`);
}

function postStart() {
  const { manifest, bytes } = loadPinned();
  for (const step of manifest.postStart) {
    psql(bytes.get(step.source).toString('utf8'));
    log(`applied post-start fixture ${path.basename(step.source)}`);
  }
}

function verify() {
  const { manifest, bytes } = loadPinned();
  const baseline = JSON.parse(bytes.get(manifest.parity.baseline).toString('utf8')).rows;
  const local = psql(bytes.get(manifest.parity.query).toString('utf8'), { tuples: true })
    .split(/\r?\n/).filter(Boolean).map((line) => { const [kind, name, fp] = line.split('\t'); return { kind, name, fp }; });
  const key = (row) => `${row.kind}|${row.name}`;
  const localMap = new Map(local.map((row) => [key(row), row.fp]));
  const baselineMap = new Map(baseline.map((row) => [key(row), row.fp]));
  const missing = baseline.filter((row) => !localMap.has(key(row))).map(key);
  const extra = local.filter((row) => !baselineMap.has(key(row))).map(key);
  const differ = baseline.filter((row) => localMap.has(key(row)) && localMap.get(key(row)) !== row.fp).map(key);
  const report = { checkedAt: new Date().toISOString(), baselineRows: baseline.length, localRows: local.length, missing, extra, differ };
  fs.writeFileSync(path.join(run().run_dir, 'fingerprint-diff.json'), `${JSON.stringify(report, null, 2)}\n`);
  if (missing.length || extra.length || differ.length) {
    for (const item of missing) console.error(`  missing: ${item}`);
    for (const item of extra) console.error(`  extra:   ${item}`);
    for (const item of differ) console.error(`  differs: ${item}`);
    fail(`fingerprint differs from the production baseline (${missing.length} missing, ${extra.length} extra, ${differ.length} different)`);
  }
  log(`fingerprint parity OK: ${local.length}/${baseline.length} objects equal the pinned production baseline`);
}

async function seed(sourceRoot) {
  if (!sourceRoot || !path.isAbsolute(sourceRoot)) fail('seed needs the absolute R2 source root');
  const state = run();
  // Accounts and the private R2 paper are loaded only into a stack bound to 127.0.0.1.
  if (!publishedPortsLoopbackOnly()) fail('the run\'s stack is reachable beyond 127.0.0.1; nothing was seeded');
  const signInsFile = path.join(state.run_dir, 'sign-ins.json');
  if (fs.existsSync(signInsFile)) fail('this run was already seeded; a run is seeded once');
  const contract = JSON.parse(consume(CONTRACT).toString('utf8'));
  if (contract.paperSha256 !== R2_PAPER.sha256) fail('figures contract is bound to a different paper');
  // The five private R2 objects are read once and verified against the release contract before any account exists.
  const objects = [{ file: path.join(sourceRoot, 'deliverables', 'Matrix_Options_Paper_R2_draft.md'), name: `${R2_VERSION}/presentation.md`, sha: R2_PAPER.sha256, bytes: R2_PAPER.bytes, type: 'text/markdown' },
    ...contract.assets.map((asset) => ({ file: path.join(sourceRoot, 'src', 'figures', asset.file), name: `${R2_VERSION}/figures/${asset.file}`, sha: asset.sha256, bytes: asset.bytes, type: 'image/png' }))];
  if (objects.length !== 5) fail(`expected 5 R2 objects, contract gives ${objects.length}`);
  for (const object of objects) {
    let content;
    try { content = fs.readFileSync(object.file); } catch { fail(`source object ${path.basename(object.file)} is missing`); }
    if (content.byteLength !== object.bytes || sha256(content) !== object.sha) fail(`source object ${path.basename(object.file)} does not match the release contract`);
    object.content = content;
    consumed.sources.push({ path: path.relative(sourceRoot, object.file).split(path.sep).join('/'), bytes: content.byteLength, sha256: object.sha });
  }
  const env = cliStatusEnv();
  const send = guardedSender();
  const headers = { apikey: env.SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' };
  const fresh = newDisposableSignIns(state.run_id);
  const users = [];
  for (const account of fresh) {
    const response = await send('/auth/v1/admin/users', { method: 'POST', headers, body: JSON.stringify({ email: account.email, password: account.password, email_confirm: true }) });
    if (!response.ok) fail(`could not create the local ${account.key} account (${response.status})`);
    users.push({ ...account, id: (await response.json()).id });
  }
  const ids = Object.fromEntries(users.map((user) => [user.key, user.id]));
  const admins = PREVIEW_ACCOUNTS.filter((account) => account.admin).map((account) => `('${ids[account.key]}'::uuid, 'admin')`).join(', ');
  psql(`insert into public.user_roles (user_id, role) values ${admins} on conflict do nothing;`);

  // Two synthetic legacy v0.9.91 responses (reviewer B and the admin), six events each: read-only
  // legacy history for the local admin view and export. Reviewer A starts with no legacy rows.
  psql(`do $seed$
declare q record; u uuid; t text; r uuid; n int := 0; k int;
begin
  if exists (select 1 from public.matrix_paper_review_responses) then return; end if;
  for q in select * from public.matrix_paper_review_questions order by question_number limit 2 loop
    n := n + 1;
    u := case n when 1 then '${ids.reviewerB}'::uuid else '${ids.admin}'::uuid end;
    t := 'Synthetic local preview legacy response ' || n;
    insert into public.matrix_paper_review_responses (user_id, document_version, manifest_sha256, cohort_id, question_id, draft_text, submitted_text, revision, submitted_revision, submitted_at)
      values (u, q.document_version, q.manifest_sha256, q.cohort_id, q.question_id, t, t, 6, 6, now()) returning id into r;
    for k in 1..6 loop
      insert into public.matrix_paper_review_response_events (response_id, user_id, document_version, manifest_sha256, cohort_id, question_id, action, revision, text_sha256, text_length)
        values (r, u, q.document_version, q.manifest_sha256, q.cohort_id, q.question_id, case when k = 6 then 'submit' else 'save-draft' end, k, encode(extensions.digest(convert_to(t, 'UTF8'), 'sha256'), 'hex'), length(t));
    end loop;
  end loop;
end
$seed$;`);

  for (const object of objects) {
    const response = await send(`/storage/v1/object/matrix-paper-review-assets/${object.name.split('/').map(encodeURIComponent).join('/')}`, {
      method: 'POST', headers: { apikey: env.SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SERVICE_ROLE_KEY}`, 'Content-Type': object.type, 'x-upsert': 'true' }, body: object.content,
    });
    if (!response.ok) fail(`upload of ${object.name} failed (${response.status})`);
  }
  log('uploaded 5 hash-verified R2 objects to the run\'s local bucket');

  // LOCAL ONLY: the disposable database's activation row is enabled so the local journey can write.
  psql(`update public.matrix_guided_r2_activation set enabled = true where document_version = '${R2_VERSION}';`);
  const counts = psql(`select (select count(*) from public.matrix_paper_review_responses) || '/' || (select count(*) from public.matrix_paper_review_response_events);`, { tuples: true }).trim();
  // Disposable sign-ins: the run's only credential state, gitignored and run-scoped.
  fs.writeFileSync(signInsFile, `${JSON.stringify({ mode: SIGN_IN_MODE, run_id: state.run_id, users }, null, 2)}\n`, { flag: 'wx' });
  log(`seeded 3 disposable local accounts; legacy responses/events ${counts}`);
}

// ---------------------------------------------------------------- env result channel

/**
 * The dedicated bootstrap -> wrapper result for the app's build: exactly API_URL and ANON_KEY of the
 * run's stack, as three LF-terminated ASCII lines. No other value (DB_URL, the service-role key, any
 * connection material) can be written: the input is reduced to the two allowlisted fields and each
 * must match its exact form. The wrapper (Read-BootstrapResult) refuses anything else.
 */
export function formatEnvResult({ runId, ports }, statusEnv) {
  const apiUrl = statusEnv?.API_URL;
  const anonKey = statusEnv?.ANON_KEY;
  if (!/^r2pv-[0-9]{8}T[0-9]{6}Z-[0-9a-f]{8}$/.test(runId ?? '')) throw new Error('invalid run id');
  if (apiUrl !== `http://127.0.0.1:${ports?.api}`) throw new Error('the API URL is not the run\'s loopback API');
  if (typeof anonKey !== 'string' || !/^[A-Za-z0-9_.-]{20,4096}$/.test(anonKey)) throw new Error('the anon key is malformed');
  return `R2_PREVIEW_RESULT=${ENV_RESULT_SCHEMA} ${runId}\nAPI_URL=${apiUrl}\nANON_KEY=${anonKey}\n`;
}
/** Where the result of one launch goes (never a log the wrapper scrubs). */
export const envResultPath = (runDir, launchId) => {
  if (!LAUNCH_PATTERN.test(launchId ?? '')) throw new Error('invalid launch id');
  return path.join(runDir, 'results', `bootstrap-env-${launchId}.result`);
};
/** Writes the result once (exclusive create): a second producer for the same launch is refused. */
export function writeEnvResult(file, state, statusEnv) {
  const text = formatEnvResult({ runId: state.run_id, ports: state.ports }, statusEnv);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, { encoding: 'ascii', flag: 'wx' });
  return file;
}

function produceEnv() {
  const state = run();
  let file;
  try { file = envResultPath(state.run_dir, process.env.R2_PREVIEW_LAUNCH_ID); } catch { fail('env needs the wrapper\'s launch id'); }
  try { writeEnvResult(file, state, cliStatusEnv()); } catch (error) { fail(`the env result was not written: ${error.message}`); }
  // Only the location is logged; the values travel in the result file alone.
  log(`env result written for launch ${process.env.R2_PREVIEW_LAUNCH_ID}`);
}

/** Journey helper: create or delete a disposable local probe user; prints ids/status only. */
async function probeUser(action, value, mode) {
  const env = cliStatusEnv();
  const send = guardedSender();
  const headers = { apikey: env.SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' };
  if (action === 'create') {
    const password = process.env.R2_PROBE_PASSWORD;
    if (!password || !/@r2-preview\.local$/.test(value ?? '')) fail('probe-user create needs an @r2-preview.local email and R2_PROBE_PASSWORD');
    const response = await send('/auth/v1/admin/users', { method: 'POST', headers, body: JSON.stringify({ email: value, password, email_confirm: true }) });
    if (!response.ok) fail(`probe-user create failed (${response.status})`);
    process.stdout.write(`${JSON.stringify({ id: (await response.json()).id })}\n`);
    return;
  }
  if (action === 'delete' && /^[0-9a-f-]{36}$/.test(value ?? '') && (mode === 'soft' || mode === 'hard')) {
    const response = await send(`/auth/v1/admin/users/${value}`, { method: 'DELETE', headers, body: JSON.stringify({ should_soft_delete: mode === 'soft' }) });
    process.stdout.write(`${JSON.stringify({ status: response.status })}\n`);
    return;
  }
  fail('usage: probe-user create <email> | probe-user delete <id> soft|hard');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, argument, extra, mode] = process.argv.slice(2);
  if (command === 'pin') pin();
  else {
    if (!['prepare', 'post-start', 'verify', 'seed', 'env', 'probe-user', 'ports'].includes(command)) fail('usage: bootstrap.mjs pin|prepare|post-start|verify|seed <sourceRoot>|env|ports|probe-user');
    selfCheck();
    switch (command) {
      case 'prepare': prepare(); break;
      case 'post-start': postStart(); break;
      case 'verify': verify(); break;
      case 'seed': await seed(argument); break;
      case 'env': produceEnv(); break;
      case 'probe-user': await probeUser(argument, extra, mode); break;
      case 'ports': {
        const loopbackOnly = publishedPortsLoopbackOnly();
        log(loopbackOnly ? 'every published port of the run is bound to 127.0.0.1' : 'a published port of the run is reachable beyond 127.0.0.1');
        writeConsumed(command);
        process.exit(loopbackOnly ? 0 : 3);
      }
    }
    writeConsumed(command);
  }
}
