/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const test = require('node:test');
const { childEnvironment, assertNativeInvocation, monitorStatus, cleanupProven } = require('./native-local-runtime.cjs');
const { probe, stopped, portAvailable, spawnOwned } = require('./run-native-local-e2e.cjs');
const { loadNativeInputs } = require('./native-local-inputs.cjs');

const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

test('native-local runner passes the Playwright strict transform', () => {
  const filename = path.join(__dirname, 'run-native-local-e2e.cjs');
  const { transformHook } = require(path.join(__dirname, '..', '..', 'node_modules', 'playwright', 'lib', 'transform', 'transform.js'));
  assert.doesNotThrow(() => transformHook(fs.readFileSync(filename, 'utf8'), filename));
});

test('portable governed inputs validate another checkout and reject unsafe mutations', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'native-portable-'));
  const repo = path.join(base, 'other-checkout');
  const local = path.join(repo, '.tmp', 'native-local-e2e');
  const corpus = path.join(base, 'separate-corpus');
  const keys = ['v0.9.91/presentation.md', 'v0.9.91/figures/native-figure-models.json',
    'v0.9.91/appendix_l_media/image1.png'];
  const manifestPath = path.join(base, 'candidate-manifest.json');
  const configPath = path.join(local, 'config.json');
  try {
    fs.mkdirSync(local, { recursive: true });
    const objects = keys.map((key, index) => {
      const file = path.join(corpus, ...key.split('/'));
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const bytes = Buffer.from(`portable-${index}`);
      fs.writeFileSync(file, bytes);
      return { objectPath: key, sourcePath: file, bytes: bytes.length, sha256: sha256(bytes) };
    });
    const manifest = { schema: 'pr812-v0991-native-storage-proposal-v1', objectCount: 3,
      totalBytes: objects.reduce((total, item) => total + item.bytes, 0), objects };
    const manifestBytes = Buffer.from(JSON.stringify(manifest));
    fs.writeFileSync(manifestPath, manifestBytes);
    const config = { schema: 'matrix-v0991-native-local-launcher-v1', repoRoot: repo,
      corpusRoot: corpus, candidateManifestPath: manifestPath,
      candidateManifestSha256: sha256(manifestBytes), allowedInputRoots: [base] };
    const check = (value) => {
      const bytes = Buffer.from(JSON.stringify(value));
      fs.writeFileSync(configPath, bytes);
      return loadNativeInputs(repo, ['--config', configPath, '--config-sha256', sha256(bytes)]);
    };
    const valid = check(config);
    assert.equal(valid.root, fs.realpathSync.native(corpus));
    assert.equal(valid.evidenceRoot, path.join(repo, '.tmp', 'native-local-e2e', 'R9'));
    assert.throws(() => loadNativeInputs(repo, []), /NATIVE_CONFIG_REQUIRED/);
    assert.throws(() => loadNativeInputs(repo, ['--config', configPath, '--config-sha256', '0'.repeat(64)]),
      /NATIVE_CONFIG_HASH_MISMATCH/);
    assert.throws(() => check({ ...config, corpusRoot: manifestPath }), /NATIVE_CORPUS_WRONG_TYPE/);
    assert.throws(() => check({ ...config, allowedInputRoots: [repo] }), /NATIVE_INPUT_OUTSIDE_PERMITTED_ROOT/);
    assert.throws(() => check({ ...config, SUPABASE_SERVICE_ROLE_KEY: 'synthetic-secret' }),
      /NATIVE_PROVIDER_CREDENTIAL_REJECTED/);
    assert.throws(() => check({ ...config, evidenceRoot: path.join(base, 'unapproved-output'),
      allowedOutputRoots: [repo] }), /NATIVE_EVIDENCE_OUTSIDE_PERMITTED_ROOT/);
    assert.throws(() => check({ ...config, evidenceRoot: '' }), /NATIVE_CONFIG_SHAPE_MISMATCH/);
    assert.throws(() => check({ ...config, evidenceRoot: path.join(base, 'unapproved-output'),
      allowedOutputRoots: [path.parse(base).root] }), /NATIVE_OUTPUT_ALLOWLIST_TOO_BROAD/);
    const altered = { ...manifest, objects: manifest.objects.map((item) => ({ ...item })) };
    altered.objects[0].PROVIDER_API_KEY = 'synthetic-secret';
    const alteredBytes = Buffer.from(JSON.stringify(altered));
    fs.writeFileSync(manifestPath, alteredBytes);
    assert.throws(() => check({ ...config, candidateManifestSha256: sha256(alteredBytes) }),
      /NATIVE_PROVIDER_CREDENTIAL_REJECTED/);
    for (const name of ['run-native-local-e2e.cjs', 'native-local-inputs.cjs']) {
      assert.doesNotMatch(fs.readFileSync(path.join(__dirname, name), 'utf8'), /[A-Z]:\\\\Users\\\\/i);
    }
  } finally {
    const relative = path.relative(os.tmpdir(), base);
    assert.ok(relative && relative !== '..' && !relative.startsWith(`..${path.sep}`));
    fs.rmSync(base, { recursive: true });
  }
});

const synthetic = {
  NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:32632',
  PLAYWRIGHT_TEST_BASE_URL: 'http://127.0.0.1:32632',
  PLAYWRIGHT_TEST_HOST: '127.0.0.1',
  PLAYWRIGHT_TEST_PORT: '32631',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'local-public-key',
  MATRIX_NATIVE_LOCAL_E2E: 'true',
  MATRIX_NATIVE_LOCAL_ENTRYPOINT: 'run-native-local-e2e.cjs',
  MATRIX_OPTIONS_PAPER_NATIVE_DELIVERY: 'reviewed',
  E2E_AUTH_ENABLED: 'false',
};

test('env files are shadowed and ambient provider secrets are not inherited', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'native-env-'));
  try {
    fs.writeFileSync(path.join(repo, '.env.local'), '  DATABASE_URL=provider\nNEXT_PUBLIC_SUPABASE_URL=provider\nexport SERVICE_ROLE_KEY=provider\n');
    const env = childEnvironment(repo, { PATH: 'synthetic-path', DATABASE_URL: 'secret',
      SERVICE_ROLE_KEY: 'secret', E2E_TEST_PASSWORD: 'secret', HTTP_PROXY: 'http://provider' }, synthetic);
    assert.equal(env.PATH, 'synthetic-path');
    assert.equal(env.DATABASE_URL, '');
    assert.equal(env.SERVICE_ROLE_KEY, '');
    assert.equal(env.E2E_TEST_PASSWORD, undefined);
    assert.equal(env.HTTP_PROXY, undefined);
    assert.equal(env.NEXT_PUBLIC_SUPABASE_URL, synthetic.NEXT_PUBLIC_SUPABASE_URL);
  } finally { fs.unlinkSync(path.join(repo, '.env.local')); fs.rmdirSync(repo); }
});

test('only loopback origins may reach child startup', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'native-origin-'));
  try {
    assert.throws(() => childEnvironment(repo, {}, { ...synthetic,
      NEXT_PUBLIC_SUPABASE_URL: 'https://example.invalid' }), /NATIVE_NON_LOOPBACK_ORIGIN/);
  } finally { fs.rmdirSync(repo); }
});

test('direct native invocation fails on unapproved entrypoint, secrets, or origin', () => {
  assert.doesNotThrow(() => assertNativeInvocation(synthetic));
  assert.throws(() => assertNativeInvocation({ ...synthetic, MATRIX_NATIVE_LOCAL_ENTRYPOINT: '' }), /NATIVE_UNAPPROVED_ENTRYPOINT/);
  for (const key of ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY', 'DATABASE_URL', 'PROVIDER_API_KEY']) {
    assert.throws(() => assertNativeInvocation({ ...synthetic, [key]: 'synthetic-secret' }), /NATIVE_SECRET_ENV_NOT_ALLOWED/);
  }
  assert.throws(() => assertNativeInvocation({ ...synthetic, PLAYWRIGHT_TEST_BASE_URL: 'http://example.invalid' }), /NATIVE_UNAPPROVED_ENTRYPOINT/);
});

test('watchdog distinguishes live, stalled, absolute timeout, child failure, and unhealthy dependency', () => {
  const live = { now: 10000, started: 0, lastProgress: 9000, playwrightExit: null,
    nextExit: null, proxyHealthy: true, nextHealthy: true, stopping: false };
  assert.equal(monitorStatus(live), 'RUNNING');
  assert.equal(monitorStatus({ ...live, playwrightExit: 0 }), 'COMPLETE');
  assert.equal(monitorStatus({ ...live, playwrightExit: 1 }), 'NATIVE_PLAYWRIGHT_FAILED');
  assert.equal(monitorStatus({ ...live, nextExit: 1 }), 'NATIVE_NEXT_EXITED');
  assert.equal(monitorStatus({ ...live, proxyHealthy: false }), 'NATIVE_DEPENDENCY_UNHEALTHY');
  assert.equal(monitorStatus({ ...live, now: 200000, lastProgress: 0 }), 'NATIVE_STALL_TIMEOUT');
  assert.equal(monitorStatus({ ...live, now: 1210000, lastProgress: 1209000 }), 'NATIVE_ABSOLUTE_TIMEOUT');
});

test('cleanup marker requires children, proxy, tree kills and both ports', () => {
  const good = { playwrightExited: true, nextExited: true, proxyClosed: true,
    innerFree: true, outerFree: true, treeKillsSucceeded: true };
  assert.equal(cleanupProven(good), true);
  for (const key of Object.keys(good)) assert.equal(cleanupProven({ ...good, [key]: false }), false);
});

test('readiness probe sees a local healthy server and its closure', async () => {
  const server = http.createServer((request, response) => {
    response.writeHead(request.url === '/ready' ? 200 : 503);
    response.end();
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  try {
    assert.equal(await probe(port, '/ready'), true);
    assert.equal(await probe(port, '/unready'), false);
  } finally { await new Promise((resolve) => server.close(resolve)); }
  assert.equal(await portAvailable(port), true);
});

test('owned child is terminated before cleanup can be proven', async () => {
  const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'],
    { stdio: 'ignore', windowsHide: true });
  await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
  try {
    assert.equal(child.exitCode, null);
    await stopped(child);
    assert.equal(child.exitCode !== null || child.signalCode !== null, true);
  } finally { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); }
});

test('job kills a descendant after its direct parent exits', { skip: process.platform !== 'win32' }, async () => {
  const script = "const {spawn}=require('node:child_process');const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{detached:true,stdio:'ignore',windowsHide:true});child.unref();console.log('DESCENDANT_PID_'+child.pid);";
  const owned = spawnOwned(process.execPath, ['-e', script], process.env);
  let output = '';
  owned.stdout.on('data', (bytes) => { output += bytes.toString('utf8'); });
  owned.stderr.on('data', (bytes) => { output += bytes.toString('utf8'); });
  const exit = await Promise.race([
    new Promise((resolve, reject) => {
      owned.once('error', reject);
      owned.once('exit', (code) => resolve(code));
    }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('NATIVE_JOB_SMOKE_TIMEOUT')), 15000)),
  ]).finally(async () => { if (owned.exitCode === null && owned.signalCode === null) await stopped(owned); });
  assert.equal(exit, 0, output);
  assert.match(output, /NATIVE_JOB_DRAINED/);
  const pid = Number(/DESCENDANT_PID_(\d+)/.exec(output)?.[1]);
  assert.ok(Number.isInteger(pid) && pid > 0);
  assert.throws(() => process.kill(pid, 0), /ESRCH|EPERM/);
});
