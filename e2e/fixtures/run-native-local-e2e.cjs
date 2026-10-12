/* Exact-candidate, localhost-only native paper E2E. No provider credentials or writes. */
/* eslint-disable @typescript-eslint/no-require-imports */
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const { startNativeLocalProxy } = require('./native-local-proxy.cjs');
const { childEnvironment, monitorStatus, cleanupProven } = require('./native-local-runtime.cjs');
const { loadNativeInputs } = require('./native-local-inputs.cjs');

const repo = path.resolve(__dirname, '..', '..');
const outerPort = 32632;
const innerPort = 32631;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let stopping = false;
let nextServer;
let playwright;
let proxy;
let proxyClosed = false;
let treeKillsSucceeded = true;
let lastProgress = Date.now();
let playwrightOutputTail = '';

async function portAvailable(port) {
  return new Promise((resolve) => {
    const check = net.createServer();
    check.once('error', () => resolve(false));
    check.listen(port, '127.0.0.1', () => check.close(() => resolve(true)));
  });
}

async function nextReady() {
  const deadline = Date.now() + 180000;
  let lastHeartbeat = 0;
  while (Date.now() < deadline && !stopping) {
    if (nextServer.exitCode !== null) throw new Error('NATIVE_NEXT_EXITED_BEFORE_READY');
    const ready = await probe(innerPort, '/login');
    if (ready) return;
    if (Date.now() - lastHeartbeat >= 15000) {
      process.stdout.write('NATIVE_NEXT_WAITING\n');
      lastHeartbeat = Date.now();
    }
    await wait(1000);
  }
  throw new Error(stopping ? 'NATIVE_LOCAL_INTERRUPTED' : 'NATIVE_NEXT_READINESS_TIMEOUT');
}

async function probe(port, pathname) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => { if (!settled) { settled = true; resolve(value); } };
    const request = http.get(`http://127.0.0.1:${port}${pathname}`, (response) => {
      response.resume();
      finish(response.statusCode === 200);
    });
    request.setTimeout(3000, () => { request.destroy(); finish(false); });
    request.on('error', () => finish(false));
  });
}

function collectActivity(child, captureLocation = false) {
  // Neither Next nor Playwright output is printed: their failure diagnostics
  // can contain private figure text, paths, and auth state.
  for (const stream of [child.stdout, child.stderr]) stream.on('data', (bytes) => {
    if (captureLocation) lastProgress = Date.now();
    if (captureLocation) playwrightOutputTail = (playwrightOutputTail + bytes.toString('utf8')).slice(-30000);
  });
}

function spawnOwned(executable, args, env) {
  if (process.platform !== 'win32') return spawn(executable, args,
    { cwd: repo, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  const helper = path.join(__dirname, 'native-local-job.ps1');
  const encoded = Buffer.from(JSON.stringify(args), 'utf8').toString('base64');
  return spawn('pwsh', ['-NoProfile', '-NonInteractive', '-File', helper,
    '-Executable', executable, '-ArgumentsBase64', encoded],
  { cwd: repo, env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
}

async function monitorPlaywright() {
  const started = Date.now();
  let lastHeartbeat = 0;
  for (;;) {
    const now = Date.now();
    const [proxyHealthy, nextHealthy] = await Promise.all([
      probe(outerPort, '/__native_local_health'), probe(innerPort, '/login'),
    ]);
    const status = monitorStatus({ now, started, lastProgress,
      playwrightExit: playwright.exitCode ?? (playwright.signalCode ? 1 : null),
      nextExit: nextServer.exitCode ?? (nextServer.signalCode ? 1 : null),
      proxyHealthy, nextHealthy, stopping });
    if (status === 'COMPLETE') return;
    if (status !== 'RUNNING') throw new Error(status);
    if (now - lastHeartbeat >= 15000) {
      process.stdout.write('NATIVE_PLAYWRIGHT_HEARTBEAT\n');
      lastHeartbeat = now;
    }
    await wait(5000);
  }
}

async function stopped(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === 'win32' && child.pid) {
    // Kill the owned process tree while its parent PID is still live. Next and
    // Playwright can each spawn workers that outlive a single-process signal.
    const killed = spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'],
      { stdio: 'ignore', windowsHide: true, timeout: 10000 });
    if (killed.error || killed.status !== 0) { treeKillsSucceeded = false; throw new Error('NATIVE_TREE_KILL_FAILED'); }
    await Promise.race([new Promise((resolve) => child.once('exit', resolve)), wait(5000)]);
    if (child.exitCode === null && child.signalCode === null) throw new Error('NATIVE_CHILD_STILL_RUNNING');
    return;
  }
  child.kill('SIGTERM');
  await Promise.race([new Promise((resolve) => child.once('exit', resolve)), wait(5000)]);
  if (child.exitCode === null && child.signalCode === null) {
    child.kill('SIGKILL');
    await Promise.race([new Promise((resolve) => child.once('exit', resolve)), wait(5000)]);
  }
  if (child.exitCode === null && child.signalCode === null) throw new Error('NATIVE_CHILD_STILL_RUNNING');
}

async function cleanup() {
  const errors = [];
  for (const child of [playwright, nextServer]) {
    try { await stopped(child); } catch (error) { errors.push(error); }
  }
  if (proxy) {
    proxy.closeAllConnections();
    proxy.closeOwnedConnections();
    try { await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('NATIVE_PROXY_CLOSE_TIMEOUT')), 5000);
      proxy.close((error) => {
        clearTimeout(timer);
        if (error) reject(error);
        else resolve();
      });
    });
      proxyClosed = true; } catch { errors.push(new Error('NATIVE_PROXY_CLOSE_FAILED')); }
  }
  const [innerFree, outerFree] = await Promise.all([portAvailable(innerPort), portAvailable(outerPort)]);
  if (!cleanupProven({ playwrightExited: !playwright || playwright.exitCode !== null || playwright.signalCode !== null,
    nextExited: !nextServer || nextServer.exitCode !== null || nextServer.signalCode !== null,
    proxyClosed: !proxy || proxyClosed, innerFree, outerFree, treeKillsSucceeded }) || errors.length) {
    throw new Error('NATIVE_LOCAL_CLEANUP_FAILED');
  }
  process.stdout.write('NATIVE_LOCAL_CLEANUP_COMPLETE\n');
}

async function main() {
  const { root, model, evidenceRoot } = loadNativeInputs(repo, process.argv.slice(2));
  if (!(await portAvailable(innerPort)) || !(await portAvailable(outerPort))) {
    throw new Error('NATIVE_LOCAL_PORT_OCCUPIED');
  }
  const env = childEnvironment(repo, process.env, {
    MATRIX_NATIVE_LOCAL_E2E: 'true', MATRIX_NATIVE_LOCAL_CORPUS_ROOT: root,
    MATRIX_NATIVE_LOCAL_ENTRYPOINT: 'run-native-local-e2e.cjs',
    MATRIX_NATIVE_LOCAL_EVIDENCE_ROOT: evidenceRoot,
    MATRIX_OPTIONS_PAPER_PRIVATE_ASSET_DIR: '',
    MATRIX_OPTIONS_PAPER_NATIVE_DELIVERY: 'reviewed',
    MATRIX_OPTIONS_PAPER_NATIVE_MODEL_SHA256: model.sha256,
    MATRIX_OPTIONS_PAPER_NATIVE_MODEL_BYTES: String(model.bytes),
    MATRIX_OPTIONS_PAPER_WORKSPACE: 'true', MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION: 'true',
    NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${outerPort}`,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'local-public-key', AGENTIC_OS_SPAWN_STUB: 'true',
    E2E_AUTH_ENABLED: 'false', E2E_TEST_EMAIL: '', E2E_TEST_PASSWORD: '',
    PLAYWRIGHT_TEST_HOST: '127.0.0.1', PLAYWRIGHT_TEST_PORT: String(innerPort),
    PLAYWRIGHT_TEST_BASE_URL: `http://127.0.0.1:${outerPort}`,
  });
  try {
    proxy = await startNativeLocalProxy({ outerPort, innerPort, root });
    process.stdout.write(`NATIVE_PROXY_READY 127.0.0.1:${outerPort}\n`);
    const nextCli = path.join(repo, 'node_modules', 'next', 'dist', 'bin', 'next');
    nextServer = spawnOwned(process.execPath, [nextCli, 'dev', '--hostname', '127.0.0.1', '--port', String(innerPort)], env);
    collectActivity(nextServer);
    nextServer.once('error', () => { stopping = true; });
    await nextReady();
    process.stdout.write(`NATIVE_NEXT_READY 127.0.0.1:${innerPort}\n`);
    const playwrightCli = path.join(repo, 'node_modules', '@playwright', 'test', 'cli.js');
    playwright = spawnOwned(process.execPath, [playwrightCli, 'test', 'e2e/matrix-options-paper-native.spec.ts',
      '--project=chromium', '--reporter=line'], env);
    collectActivity(playwright, true);
    playwright.once('error', () => { stopping = true; });
    process.stdout.write('NATIVE_PLAYWRIGHT_STARTED\n');
    await monitorPlaywright();
    process.stdout.write('NATIVE_LOCAL_E2E_PASSED\n');
  } finally {
    await cleanup();
  }
}

if (require.main === module) {
  process.on('SIGINT', () => { stopping = true; });
  process.on('SIGTERM', () => { stopping = true; });
  main().catch((error) => {
    const locations = [...playwrightOutputTail.matchAll(/matrix-options-paper-native\.spec\.ts:(\d+):(\d+)/g)];
    if (locations.length) process.stderr.write(`NATIVE_TEST_SOURCE_LINES_${[...new Set(locations.map((match) => match[1]))].join('_')}\n`);
    const codes = [...new Set(playwrightOutputTail.match(/NATIVE_[A-Z_]+/g) ?? [])];
    if (codes.length) process.stderr.write(`NATIVE_TEST_CODES_${codes.join('_')}\n`);
    const visual = /NATIVE_VISUAL_BLANK (\{"visible":"(?:visible|hidden|collapse)","display":"[a-z-]+","top":-?\d+,"height":\d+,"print":(?:true|false)\})/.exec(playwrightOutputTail);
    if (visual) process.stderr.write(`${visual[0]}\n`);
    const overflow = /Native figure overflow [^:\r\n]+: (\{[^\r\n]+\})/.exec(playwrightOutputTail);
    if (overflow) {
      try {
        const parsed = JSON.parse(overflow[1]);
        process.stderr.write(`NATIVE_OVERFLOW_METRICS ${JSON.stringify({ documentOverflow: parsed.documentOverflow,
          figureOverflow: parsed.figureOverflow, figureVerticalOverflow: parsed.figureVerticalOverflow,
          canvasOverflow: parsed.canvasOverflow, canvasVerticalOverflow: parsed.canvasVerticalOverflow,
          hiddenNodes: parsed.hiddenNodes, clippedDescendants: parsed.clippedDescendants,
          figure: parsed.figure })}\n`);
      } catch { process.stderr.write('NATIVE_OVERFLOW_METRICS_UNAVAILABLE\n'); }
    }
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { probe, stopped, portAvailable, spawnOwned };
