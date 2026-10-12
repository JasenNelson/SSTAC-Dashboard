/* Local E2E process and environment invariants. No private bytes are logged. */
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs');
const path = require('node:path');

const runtimeKeys = ['PATH', 'Path', 'PATHEXT', 'SystemRoot', 'SYSTEMROOT', 'WINDIR',
  'COMSPEC', 'ComSpec', 'TEMP', 'TMP', 'TMPDIR', 'USERPROFILE', 'APPDATA',
  'LOCALAPPDATA', 'PROGRAMDATA', 'PROCESSOR_ARCHITECTURE', 'NUMBER_OF_PROCESSORS'];
const envFileName = /^\.env(?:\.[A-Za-z0-9_-]+)*$/;
const envKey = /^[ \t]*(?:export[ \t]+)?([A-Za-z_][A-Za-z0-9_.-]*)[ \t]*=/;

function declaredEnvKeys(repo) {
  const keys = new Set();
  for (const name of fs.readdirSync(repo).filter((name) => envFileName.test(name))) {
    const file = path.join(repo, name);
    if (!fs.statSync(file).isFile()) continue;
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const match = envKey.exec(line);
      if (match) keys.add(match[1]);
    }
  }
  return keys;
}

function assertLoopbackOrigins(env) {
  for (const key of ['NEXT_PUBLIC_SUPABASE_URL', 'PLAYWRIGHT_TEST_BASE_URL']) {
    const url = new URL(env[key]);
    if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' ||
        url.username || url.password || url.search || url.hash) throw new Error('NATIVE_NON_LOOPBACK_ORIGIN');
  }
  if (env.PLAYWRIGHT_TEST_HOST !== '127.0.0.1') throw new Error('NATIVE_NON_LOOPBACK_HOST');
  for (const key of Object.keys(env)) {
    if (/^(?:https?_proxy|all_proxy)$/i.test(key) && env[key]) throw new Error('NATIVE_PROXY_ENV_NOT_ALLOWED');
    if (/^https?:\/\//i.test(env[key] ?? '')) {
      const url = new URL(env[key]);
      if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.username || url.password) {
        throw new Error('NATIVE_NON_LOOPBACK_ORIGIN');
      }
    }
  }
}

function assertNativeInvocation(env) {
  if (env.MATRIX_NATIVE_LOCAL_E2E !== 'true' ||
      env.MATRIX_NATIVE_LOCAL_ENTRYPOINT !== 'run-native-local-e2e.cjs' ||
      env.MATRIX_OPTIONS_PAPER_NATIVE_DELIVERY !== 'reviewed' ||
      env.E2E_AUTH_ENABLED !== 'false' ||
      env.E2E_TEST_EMAIL || env.E2E_TEST_PASSWORD ||
      env.PLAYWRIGHT_TEST_PORT !== '32631' ||
      env.PLAYWRIGHT_TEST_HOST !== '127.0.0.1' ||
      env.PLAYWRIGHT_TEST_BASE_URL !== 'http://127.0.0.1:32632' ||
      env.NEXT_PUBLIC_SUPABASE_URL !== 'http://127.0.0.1:32632' ||
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY !== 'local-public-key') {
    throw new Error('NATIVE_UNAPPROVED_ENTRYPOINT');
  }
  for (const [key, value] of Object.entries(env)) {
    if (/^(?:SUPABASE_SERVICE_ROLE_KEY|SUPABASE_ANON_KEY|SERVICE_ROLE_KEY|DATABASE_URL|DIRECT_URL|.*(?:SECRET|PRIVATE_KEY|ACCESS_TOKEN|API_KEY|PASSWORD|TOKEN))$/i.test(key) && value) {
      throw new Error('NATIVE_SECRET_ENV_NOT_ALLOWED');
    }
  }
  assertLoopbackOrigins(env);
}

function childEnvironment(repo, parent, synthetic) {
  const env = {};
  for (const key of runtimeKeys) if (parent[key] !== undefined) env[key] = parent[key];
  for (const key of declaredEnvKeys(repo)) env[key] = '';
  Object.assign(env, synthetic);
  for (const key of Object.keys(env)) {
    if (/^(?:SUPABASE_SERVICE_ROLE_KEY|DATABASE_URL|DIRECT_URL|.*(?:SECRET|PRIVATE_KEY|ACCESS_TOKEN))$/i.test(key) && env[key]) {
      throw new Error('NATIVE_SECRET_ENV_NOT_ALLOWED');
    }
  }
  assertLoopbackOrigins(env);
  assertNativeInvocation(env);
  return env;
}

function monitorStatus({ now, started, lastProgress, playwrightExit, nextExit, proxyHealthy, nextHealthy, stopping }) {
  if (stopping) return 'NATIVE_LOCAL_INTERRUPTED';
  if (nextExit !== null) return 'NATIVE_NEXT_EXITED';
  if (!proxyHealthy || !nextHealthy) return 'NATIVE_DEPENDENCY_UNHEALTHY';
  if (playwrightExit !== null) return playwrightExit === 0 ? 'COMPLETE' : 'NATIVE_PLAYWRIGHT_FAILED';
  if (now - started > 1200000) return 'NATIVE_ABSOLUTE_TIMEOUT';
  if (now - lastProgress > 180000) return 'NATIVE_STALL_TIMEOUT';
  return 'RUNNING';
}

function cleanupProven({ playwrightExited, nextExited, proxyClosed, innerFree, outerFree, treeKillsSucceeded }) {
  return playwrightExited && nextExited && proxyClosed && innerFree && outerFree && treeKillsSucceeded;
}

module.exports = { declaredEnvKeys, assertLoopbackOrigins, assertNativeInvocation, childEnvironment, monitorStatus, cleanupProven };
