#!/usr/bin/env node
// Matrix R2 disposable local full-stack preview: run isolation and custody (LOCAL ONLY).
// Used by r2-fullstack-preview.ps1, bootstrap.mjs and the local journey. Every decision fails closed.
//
// Isolation. Every `up` creates a unique run id. Everything the run uses is derived from it and
// belongs to it alone: the Supabase/Docker project id (so its containers and volumes are new and
// named after the run), the run directory .tmp/r2-fullstack/runs/<run id>/ (config, logs, PID and
// process records, build stamp, sign-in state), and a port block. The ONLY machine-wide state is
// the port-block allocation: one slot file per block (C:\ProgramData\sstac-r2-preview\slots),
// created exclusively, naming the run that holds it, and removed only by that run's terminal
// release transition. Nothing fixed or pre-existing is ever attached.
//
// Lock. The wrapper holds an OS lock on <run dir>/wrapper.lock (an exclusive, no-sharing handle the
// OS releases when the wrapper process dies), so stale-lock recovery is the OS's, not ours. While
// it holds that handle, run-lock records the wrapper (pid AND creation time) as the run's `active`
// holder in the run state. A later wrapper that obtains the OS lock while the state still names a
// dead holder knows the earlier command was interrupted: its outcome is unknown and the run enters
// needs-reconcile, in which only status, reconcile and down are allowed. Custody commands that change
// the run must be direct children of the recorded holder.
//
// Ownership. Before the stack may start, preflight proves that no container or volume of the run's
// project and no listener on any of its ports exists. If anything exists, the run is persisted as
// terminal `refused` (phase never-started) with the evidence, and only this run's reservation (its
// slot) is released; nothing pre-existing is stopped, reset or removed. The stack is owned by the
// run only once its start intent is recorded after a clean preflight; stop is refused otherwise.
//
// Processes. Every child command is recorded BEFORE it is launched (launch intent), then with its
// full identity (pid, creation time, command-line digest), then with its outcome. A child whose
// identity or outcome is unknown keeps teardown unverified and the reservation held.
//
// Release. Terminal persistence, reservation release and lock release are one journaled transition:
// `releasing` (decision and evidence), the slot rename, then the terminal state with no active
// holder. An interruption at any boundary leaves a state that down or reconcile completes; a release
// is never published while the slot is still held, and the state never claims a holder after the
// wrapper unlocked.
//
//   node custody.mjs docker-bind | daemon-loopback
//   node custody.mjs run-new        --worktree <dir> --sha <40hex|inner-loop> --tree <40hex|-> --pid <wrapper>
//   node custody.mjs run-verify     --worktree <dir> --sha <..> --run <id>
//   node custody.mjs run-status     --worktree <dir> --sha <..> --run <id>                     read-only, also for closed runs
//   node custody.mjs run-lock       --worktree <dir> --sha <..> --run <id> --pid <wrapper> --command <name>
//   node custody.mjs run-unlock     --worktree <dir> --sha <..> --run <id> --pid <wrapper>
//   node custody.mjs run-bind       --worktree <dir> --sha <..> --run <id> --pid <wrapper>
//   node custody.mjs inputs-check   --worktree <dir> --sha <..> --run <id> --root <dir>
//   node custody.mjs generated-check --worktree <dir> --sha <..> --run <id> --pid <wrapper>
//   node custody.mjs preflight      --worktree <dir> --sha <..> --run <id> --pid <wrapper>      exit 6 = refused (terminal)
//   node custody.mjs run-record     --worktree <dir> --sha <..> --run <id> --pid <wrapper> --launch <id> --role <name>
//                                   --outcome <intent|running|exited|timeout|launch-failed> [--child <pid>] [--exit-code <n>] [--timeout <s>]
//   node custody.mjs run-set-app    --worktree <dir> --sha <..> --run <id> --pid <wrapper> --launch <id> --app-pid <n>
//   node custody.mjs run-unaccounted --worktree <dir> --sha <..> --run <id> --pid <wrapper> --launch <id> --role <name> --reason <stage>
//                                   [--child <pid>] [--created <utc>] [--command-sha256 <hex>]   launched child not recorded: needs-reconcile
//   node custody.mjs cli-guarded    --worktree <dir> --sha <..> --run <id> --pid <wrapper> --role <supabase-db-reset|supabase-stop>
//   node custody.mjs teardown-check --worktree <dir> --sha <..> --run <id>                     exit 5 unless verified
//   node custody.mjs down-plan      --worktree <dir> --sha <..> --run <id> --pid <wrapper>
//   node custody.mjs run-finalize   --worktree <dir> --sha <..> --run <id> --pid <wrapper> --kind <released|never-started>
//   node custody.mjs reconcile      --worktree <dir> --sha <..> --run <id> --pid <wrapper>
//   node custody.mjs consumed-report --worktree <dir> --sha <..> --run <id>
//   node custody.mjs listeners      --ports <a,b,..>                                           exit 2 when unknown
//   node custody.mjs listener-proof --worktree <dir> --sha <..> --run <id>                     exit 4 when not proven
import { spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_SLOT_DIR = process.platform === 'win32' ? 'C:\\ProgramData\\sstac-r2-preview\\slots' : '/var/tmp/sstac-r2-preview/slots';
export const SLOT_COUNT = 10;
export const PORT_BASE = 55500;
export const LOCAL_DOCKER_ENDPOINTS = Object.freeze(process.platform === 'win32'
  ? ['npipe:////./pipe/dockerDesktopLinuxEngine', 'npipe:////./pipe/docker_engine']
  : ['unix:///var/run/docker.sock', `unix://${path.join(os.homedir(), '.docker', 'run', 'docker.sock')}`]);
export const RUN_ID_PATTERN = /^r2pv-[0-9]{8}T[0-9]{6}Z-[0-9a-f]{8}$/;
const SHA_PATTERN = /^[0-9a-f]{40}$/;
const LAUNCH_PATTERN = /^[0-9a-f]{32}$/;
const RUN_SCHEMA = 'sstac-r2-preview-run/2';
/** libuv UV_FS_O_EXLOCK: open with no sharing (Windows). Node passes it through to CreateFileW. */
export const WINDOWS_EXCLUSIVE_OPEN = 0x10000000;
export const TERMINAL_STATUSES = Object.freeze(['released', 'refused']);
/** The only commands a run in needs-reconcile (or an interrupted release) accepts besides read-only status. */
export const RECONCILE_COMMANDS = Object.freeze(['down', 'reconcile']);
/** Children that create or change the run's stack, data or app: their presence means the run started. */
export const RESOURCE_ROLES = Object.freeze(['supabase-start', 'supabase-db-reset', 'bootstrap-post-start', 'bootstrap-seed', 'app', 'journey']);
/** Children that act on the run's stack: allowed only once the stack is owned by this run. */
export const OWNED_STACK_ROLES = Object.freeze(['supabase-db-reset', 'supabase-stop', 'bootstrap-ports', 'bootstrap-post-start', 'bootstrap-verify', 'bootstrap-seed', 'bootstrap-env', 'app', 'journey']);
const OUTCOMES = Object.freeze(['intent', 'running', 'exited', 'timeout', 'launch-failed']);
/** `gone` is set only by reconciliation, when an unaccounted child is proven absent. */
const FINISHED_OUTCOMES = Object.freeze(['exited', 'timeout', 'launch-failed', 'gone']);
const CREATED_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/;

export class CustodyError extends Error {
  constructor(code, message) { super(message); this.name = 'CustodyError'; this.code = code; }
}
/** @param {string} code @param {string} message @returns {never} */
const refuse = (code, message) => { throw new CustodyError(code, message); };
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

/**
 * @typedef {{ status: number | null, stdout: string, stderr: string, error?: Error }} ExecResult
 * @typedef {(command: string, args: string[], options?: object) => ExecResult} Exec
 * @typedef {Record<string, string | undefined>} Env
 * @typedef {{ pid: number, parent?: number, created: string | null, commandLine?: string }} ProcessRow
 * @typedef {{ pid: number, created: string, command_sha256?: string | null }} ProcessIdentity
 */
/** @param {string} command @param {string[]} args @param {object} [options] @returns {ExecResult} */
export function defaultExec(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, windowsHide: true, timeout: 60_000, ...options });
  return { status: result.error ? -1 : result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '', error: result.error };
}

export function normPath(value) {
  const resolved = path.resolve(String(value)).replace(/[\\/]+$/, '');
  return process.platform === 'win32' ? resolved.toLowerCase().split('\\').join('/') : resolved;
}

// ---------------------------------------------------------------- run identity and resources

export function newRunId(now = new Date(), random = () => randomBytes(4).toString('hex')) {
  return `r2pv-${now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')}-${random()}`;
}

/** Everything a run uses, derived from its id and its slot only. */
export function runResources(repoRoot, runId, slot) {
  if (!RUN_ID_PATTERN.test(runId ?? '')) refuse('bad_request', 'invalid run id.');
  if (!Number.isInteger(slot) || slot < 0 || slot >= SLOT_COUNT) refuse('bad_request', 'invalid slot.');
  const base = PORT_BASE + slot * 10;
  const projectId = `sstac-r2pv-${runId.slice(-8)}`;
  return {
    runDir: path.join(repoRoot, '.tmp', 'r2-fullstack', 'runs', runId),
    projectId, dbContainer: `supabase_db_${projectId}`, apiContainer: `supabase_kong_${projectId}`,
    ports: { shadow: base, api: base + 1, db: base + 2, app: base + 5, appInner: base + 6 },
  };
}
export const runPortList = (ports) => [ports.shadow, ports.api, ports.db, ports.app, ports.appInner];

// ---------------------------------------------------------------- 2. Docker binding

/** @param {{ host: string }} binding @param {Env} [env] @returns {Env} */
export function dockerEnv(binding, env = process.env) {
  const next = { ...env };
  for (const name of Object.keys(next)) if (/^(DOCKER_CONTEXT|DOCKER_TLS_VERIFY|DOCKER_CERT_PATH|DOCKER_TLS)$/i.test(name)) delete next[name];
  next.DOCKER_HOST = binding.host;
  return next;
}

/** @param {Env} [env] */
export function assertBoundDockerEnv(env = process.env) {
  if (!LOCAL_DOCKER_ENDPOINTS.includes(env.DOCKER_HOST ?? '')) refuse('docker_unbound', 'Docker is not bound to the verified local engine (run through r2-fullstack-preview.ps1).');
  for (const name of ['DOCKER_CONTEXT', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH']) if (env[name]) refuse('docker_unbound', `${name} must not be set while the local preview runs.`);
}

/**
 * Resolve and prove the local engine. A non-local DOCKER_HOST or context endpoint is refused before
 * any engine call; the only engine call goes to the already-proven local endpoint.
 */
/** @param {{ env?: Env, exec?: Exec }} [options] */
export function resolveDockerBinding({ env = process.env, exec = defaultExec } = {}) {
  if (env.DOCKER_TLS_VERIFY || env.DOCKER_CERT_PATH) refuse('docker_remote', 'Docker TLS settings indicate a remote engine; refused.');
  let host = env.DOCKER_HOST ?? '';
  let context = '';
  if (host) {
    if (!LOCAL_DOCKER_ENDPOINTS.includes(host)) refuse('docker_remote', 'DOCKER_HOST is not the local Docker Desktop endpoint; refused (value not shown).');
  } else {
    context = env.DOCKER_CONTEXT ?? '';
    if (!context) {
      const shown = exec('docker', ['context', 'show'], { env });
      if (shown.status !== 0) refuse('docker_unknown', 'could not read the active Docker context.');
      context = shown.stdout.trim();
    }
    if (!/^[A-Za-z0-9][A-Za-z0-9_.+-]*$/.test(context)) refuse('docker_unknown', 'the active Docker context name is not valid.');
    const inspected = exec('docker', ['context', 'inspect', context], { env });
    if (inspected.status !== 0) refuse('docker_unknown', 'could not inspect the active Docker context.');
    let parsed;
    try { parsed = JSON.parse(inspected.stdout); } catch { refuse('docker_unknown', 'the Docker context inspection is not JSON.'); }
    const endpoint = Array.isArray(parsed) && parsed.length === 1 ? parsed[0]?.Endpoints?.docker : undefined;
    if (!endpoint || typeof endpoint.Host !== 'string') refuse('docker_unknown', 'the Docker context has no docker endpoint.');
    if (endpoint.SkipTLSVerify) refuse('docker_remote', 'the Docker context skips TLS verification; refused.');
    if (!LOCAL_DOCKER_ENDPOINTS.includes(endpoint.Host)) refuse('docker_remote', `the Docker context ${context} does not point at the local Docker Desktop engine; refused.`);
    host = endpoint.Host;
  }
  const info = exec('docker', ['--host', host, 'info', '--format', '{{json .}}'], { env: dockerEnv({ host }, env) });
  if (info.status !== 0) refuse('docker_unavailable', 'the local Docker engine is not running.');
  let engine;
  try { engine = JSON.parse(info.stdout); } catch { refuse('docker_unknown', 'the Docker engine information is not JSON.'); }
  if (engine?.OperatingSystem !== 'Docker Desktop' || engine?.Name !== 'docker-desktop') refuse('docker_unknown', 'the engine does not identify itself as the local Docker Desktop engine; refused.');
  return { host, context: context || null };
}

/**
 * Before any stack starts: Docker Desktop must be configured to publish container ports on
 * 127.0.0.1 only (daemon.json "ip": "127.0.0.1"), because the Supabase CLI has no bind option.
 */
export function daemonLoopbackConfigured({ readFile = (file) => fs.readFileSync(file, 'utf8'), home = os.homedir() } = {}) {
  try {
    const config = JSON.parse(readFile(path.join(home, '.docker', 'daemon.json')));
    return config && config.ip === '127.0.0.1';
  } catch { return false; }
}

/** Published port bindings of exactly this run's containers; throws when unknown. */
/** @param {{ projectId: string, env?: Env, exec?: Exec }} options @returns {string[]} */
export function runPortBindings({ projectId, exec = defaultExec, env = process.env }) {
  assertBoundDockerEnv(env);
  const result = exec('docker', ['ps', '--filter', `name=${projectId}`, '--format', '{{.Ports}}'], { env });
  if (result.status !== 0) refuse('inventory_failed', 'docker ps failed; port bindings unknown.');
  return result.stdout.split(/[\r\n,]+/).map((value) => value.trim()).filter((value) => value.includes('->'));
}

/** Containers and volumes of exactly this run's project; throws when unknown. */
/** @param {{ projectId: string, env?: Env, exec?: Exec }} options */
export function runDockerResources({ projectId, exec = defaultExec, env = process.env }) {
  assertBoundDockerEnv(env);
  const containers = exec('docker', ['ps', '--all', '--filter', `name=${projectId}`, '--format', '{{.Names}}'], { env });
  const volumes = exec('docker', ['volume', 'ls', '--filter', `name=${projectId}`, '--format', '{{.Name}}'], { env });
  if (containers.status !== 0 || volumes.status !== 0) refuse('inventory_failed', 'docker inventory failed; run resources unknown.');
  const lines = (text) => text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.includes(projectId));
  return { containers: lines(containers.stdout), volumes: lines(volumes.stdout) };
}

/** One container's `docker inspect` object; throws when unknown or ambiguous. */
export function inspectContainer(name, { exec = defaultExec, env = process.env } = {}) {
  assertBoundDockerEnv(env);
  const result = exec('docker', ['inspect', '--type', 'container', name], { env });
  if (result.status !== 0) refuse('destination_unknown', `the run's API container ${name} could not be inspected.`);
  let parsed;
  try { parsed = JSON.parse(result.stdout); } catch { refuse('destination_unknown', 'the API container inspection is not JSON.'); }
  if (!Array.isArray(parsed) || parsed.length !== 1) refuse('destination_unknown', 'the API container inspection is ambiguous.');
  return parsed[0];
}

// ---------------------------------------------------------------- processes

/** @param {{ exec?: Exec }} [options] @returns {ProcessRow[]} */
export function defaultProcessTable({ exec = defaultExec } = {}) {
  const script = 'Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,@{n="Created";e={if ($_.CreationDate) { $_.CreationDate.ToUniversalTime().ToString("o") } else { $null }}},CommandLine | ConvertTo-Json -Compress';
  const result = exec('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script]);
  if (result.status !== 0) refuse('inventory_failed', 'the process table is unavailable.');
  let rows;
  try { rows = JSON.parse(result.stdout); } catch { refuse('inventory_failed', 'the process table could not be parsed.'); }
  if (!Array.isArray(rows) || rows.length === 0) refuse('inventory_failed', 'the process table is empty.');
  return rows.map((row) => ({ pid: row.ProcessId, parent: row.ParentProcessId, created: row.Created ?? null, commandLine: row.CommandLine ?? '' }));
}

/** @param {number} pid @param {ProcessRow[]} table @returns {ProcessIdentity} */
export function processIdentity(pid, table) {
  const row = table.find((entry) => entry.pid === pid);
  if (!row) refuse('process_unknown', `process ${pid} is not running.`);
  if (typeof row.created !== 'string' || row.created === '') refuse('process_unknown', `process ${pid} has no creation time; its identity cannot be proven.`);
  return { pid, created: row.created, command_sha256: typeof row.commandLine === 'string' && row.commandLine ? sha256(row.commandLine) : null };
}

/**
 * A reused pid (other creation time or other command line) is a different process; a row without a
 * creation time is ambiguous and throws.
 */
/** @param {ProcessIdentity | null | undefined} identity @param {ProcessRow[]} table */
export function identityAlive(identity, table) {
  if (!identity) return false;
  const row = table.find((entry) => entry.pid === identity.pid);
  if (!row) return false;
  if (typeof row.created !== 'string' || row.created === '') refuse('process_unknown', `process ${identity.pid} has no creation time; liveness is ambiguous.`);
  if (row.created !== identity.created) return false;
  if (identity.command_sha256 && typeof row.commandLine === 'string' && row.commandLine && sha256(row.commandLine) !== identity.command_sha256) return false;
  return true;
}

/** A complete process identity: pid, creation time and command-line digest (pid alone is never enough). */
export const completeIdentity = (identity) => Boolean(identity) && Number.isInteger(identity.pid) && identity.pid > 0
  && typeof identity.created === 'string' && identity.created !== '' && typeof identity.command_sha256 === 'string' && /^[0-9a-f]{64}$/.test(identity.command_sha256);

/**
 * An unaccounted launch that is the run's own recorded app: the app's complete identity is recorded
 * (state.app) and equals the launch's, and the run owns its stack. Down stops it normally.
 */
export function isRecordedOwnedApp(item, state) {
  const app = state.app;
  return item.role === 'app' && state.ownership?.stack === 'owned' && completeIdentity(app) && completeIdentity(item)
    && app.pid === item.pid && app.created === item.created && app.command_sha256 === item.command_sha256;
}

/** Unaccounted launches not yet resolved: not proven absent and not the run's recorded owned app. */
export const unresolvedUnaccounted = (state) => (state.unaccounted ?? []).filter((item) => !item.accounted && !isRecordedOwnedApp(item, state));

/**
 * Recorded launches whose child is alive, and launches whose child identity or outcome is unknown.
 * Every unresolved unaccounted launch counts as unknown, whatever its process record says.
 */
export function processEvidence(state, table) {
  const live = [];
  const unknown = [];
  for (const item of unresolvedUnaccounted(state)) unknown.push(item.role);
  for (const entry of state.processes ?? []) {
    if (entry.outcome === 'launch-failed' || entry.outcome === 'gone') continue;
    if (typeof entry.created !== 'string' || entry.created === '') {
      // Exited/timeout without an identity: the wrapper observed the end through its own handle.
      if (entry.outcome === 'intent' || entry.outcome === 'running') unknown.push(entry.role);
      continue;
    }
    if (identityAlive(entry, table)) live.push(entry.role);
  }
  if (state.app) { if (identityAlive(state.app, table)) live.push('app'); }
  return { liveProcesses: live, unknownProcesses: unknown };
}

// ---------------------------------------------------------------- OS lock

/**
 * True while some process holds the run's OS lock (an exclusive, no-sharing handle). The probe opens
 * the file with no sharing and closes it at once; a sharing violation means the lock is held.
 */
export function osLockHeld(file, { open = fs.openSync, close = fs.closeSync, platform = process.platform } = {}) {
  if (platform !== 'win32') refuse('unsupported', 'the preview run lock is a Windows OS lock.');
  let fd;
  try { fd = open(file, fs.constants.O_RDWR | WINDOWS_EXCLUSIVE_OPEN); } catch (error) {
    if (error && error.code === 'EBUSY') return true;
    if (error && error.code === 'ENOENT') return false;
    refuse('lock_unknown', 'the run lock state could not be determined.');
  }
  close(fd);
  return false;
}

// ---------------------------------------------------------------- slot allocation and run state

const slotFile = (dir, slot) => path.join(dir, `slot-${slot}.json`);
const slotTombstone = (dir, runId) => path.join(dir, `released-${runId}.json`);
const runFile = (runDir) => path.join(runDir, 'run.json');
export const lockFile = (runDir) => path.join(runDir, 'wrapper.lock');

function writeJsonAtomic(file, value) {
  const temp = `${file}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
  fs.renameSync(temp, file);
}
const readJson = (file) => { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (error) { return error && error.code === 'ENOENT' ? undefined : null; } };
/** The state file operations of one run; injectable so interruption boundaries can be tested. */
export const STATE_OPS = Object.freeze({
  read: (runDir) => readJson(runFile(runDir)),
  write: (runDir, value) => writeJsonAtomic(runFile(runDir), value),
  readSlot: (file) => readJson(file),
  rename: (from, to) => fs.renameSync(from, to),
});
const stateOf = (run, ops) => {
  const state = ops.read(run.run_dir);
  if (!state || state.schema !== RUN_SCHEMA || state.run_id !== run.run_id) refuse('run_unknown', `run ${run.run_id} has no valid state; nothing was done.`);
  return state;
};

/**
 * Runs of this worktree that need reconciliation (a new run is refused while any exists): marked
 * needs-reconcile, an interrupted release, or an open run whose recorded holder is dead.
 */
/** @param {string} repoRoot @param {ProcessRow[] | null} [table] */
export function unreconciledRuns(repoRoot, table = null) {
  const dir = path.join(repoRoot, '.tmp', 'r2-fullstack', 'runs');
  let names = [];
  try { names = fs.readdirSync(dir); } catch (error) { if (error && error.code === 'ENOENT') return []; refuse('run_io', 'the run directory could not be listed.'); }
  return names.filter((name) => RUN_ID_PATTERN.test(name)).filter((name) => {
    const state = readJson(runFile(path.join(dir, name)));
    if (!state || state.schema !== RUN_SCHEMA) return false;
    if (state.status === 'needs-reconcile' || state.status === 'releasing') return true;
    return Boolean(table && state.status === 'created' && state.active && !identityAlive(state.active, table));
  });
}

/**
 * Creates a new run: the first free slot is claimed by exclusive create (the only machine-wide
 * write), then the run directory and its state. A claimed slot is never overwritten. The creating
 * wrapper is recorded as the run's active holder; it takes the OS lock right after.
 */
/**
 * @param {{ repoRoot: string, worktree?: string, candidateSha: string, candidateTree: string | null, wrapper: ProcessIdentity,
 *   slotDir?: string, now?: () => Date, random?: () => string, processTable?: (() => ProcessRow[]) | null }} options
 */
export function createRun({ repoRoot, worktree = repoRoot, candidateSha, candidateTree, wrapper, slotDir = DEFAULT_SLOT_DIR, now = () => new Date(), random = undefined, processTable = null }) {
  if (!(candidateSha === 'inner-loop' || SHA_PATTERN.test(candidateSha ?? ''))) refuse('bad_request', 'the candidate SHA must be 40 hex (or inner-loop).');
  if (!(candidateTree === null || SHA_PATTERN.test(candidateTree ?? ''))) refuse('bad_request', 'the candidate tree must be 40 hex.');
  if (!wrapper || !Number.isInteger(wrapper.pid) || typeof wrapper.created !== 'string' || wrapper.created === '') refuse('bad_request', 'the wrapper identity is required.');
  const pending = unreconciledRuns(repoRoot, processTable ? processTable() : null);
  if (pending.length) refuse('needs_reconcile', `run ${pending[0]} of this worktree needs reconciliation; run status, reconcile or down -RunId ${pending[0]} first. Nothing was started.`);
  const at = now();
  const runId = newRunId(at, random);
  fs.mkdirSync(slotDir, { recursive: true });
  for (let slot = 0; slot < SLOT_COUNT; slot += 1) {
    let fd;
    try { fd = fs.openSync(slotFile(slotDir, slot), 'wx'); } catch (error) { if (error && error.code === 'EEXIST') continue; refuse('slot_io', 'the port-block slot could not be created.'); }
    const resources = runResources(repoRoot, runId, slot);
    try { fs.writeSync(fd, `${JSON.stringify({ run_id: runId, worktree: normPath(worktree), candidate_sha: candidateSha, project_id: resources.projectId, ports: resources.ports, claimed_at: at.toISOString() }, null, 2)}\n`); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    fs.mkdirSync(resources.runDir, { recursive: true });
    const state = {
      schema: RUN_SCHEMA, run_id: runId, slot, project_id: resources.projectId, ports: resources.ports, worktree: normPath(worktree),
      candidate_sha: candidateSha, candidate_tree: candidateTree, created_at: at.toISOString(), status: 'created',
      ownership: { stack: 'unproven' }, inputs: null, app: null, processes: [], interrupted: [],
      // `fresh`: the creating wrapper may take this holder record over once (its own run-lock).
      active: { pid: wrapper.pid, created: wrapper.created, command: 'up', since: at.toISOString(), fresh: true },
    };
    writeJsonAtomic(runFile(resources.runDir), state);
    return { ...state, run_dir: resources.runDir };
  }
  refuse('slots_full', `all ${SLOT_COUNT} local preview port blocks are held by other runs; nothing was started.`);
}

/**
 * Positive ownership: the slot file AND the run state both name this run, this worktree and this
 * candidate. A run whose terminal release was interrupted after its slot rename is still provable
 * through its slot tombstone, so the release can be completed.
 */
export function proveRun({ repoRoot, worktree = repoRoot, runId, candidateSha, slotDir = DEFAULT_SLOT_DIR }) {
  if (!RUN_ID_PATTERN.test(runId ?? '')) refuse('run_unknown', 'an explicit run id (printed by up) is required; nothing was touched.');
  const runDir = path.join(repoRoot, '.tmp', 'r2-fullstack', 'runs', runId);
  const state = readJson(runFile(runDir));
  if (!state || state.schema !== RUN_SCHEMA || state.run_id !== runId) refuse('run_unknown', `run ${runId} has no valid state in this worktree; nothing was touched.`);
  if (state.worktree !== normPath(worktree) || state.candidate_sha !== candidateSha) refuse('run_not_owner', `run ${runId} belongs to another worktree or candidate; nothing was touched.`);
  const names = (record) => record && record.run_id === runId && record.worktree === state.worktree && record.project_id === state.project_id;
  if (names(readJson(slotFile(slotDir, state.slot)))) return { ...state, run_dir: runDir, slot_released: false };
  if (state.status === 'releasing' && names(readJson(slotTombstone(slotDir, runId)))) return { ...state, run_dir: runDir, slot_released: true };
  refuse('run_not_owner', `the port block of run ${runId} is not held by it; nothing was touched.`);
}

/**
 * Read-only state of a run of this worktree and candidate, also after it closed (no slot needed):
 * status shows a refused or released run with the evidence of its decision.
 */
export function readRunStatus({ repoRoot, worktree = repoRoot, runId, candidateSha }) {
  if (!RUN_ID_PATTERN.test(runId ?? '')) refuse('run_unknown', 'an explicit run id (printed by up) is required.');
  const runDir = path.join(repoRoot, '.tmp', 'r2-fullstack', 'runs', runId);
  const state = readJson(runFile(runDir));
  if (!state || state.schema !== RUN_SCHEMA || state.run_id !== runId) refuse('run_unknown', `run ${runId} has no valid state in this worktree.`);
  if (state.worktree !== normPath(worktree) || state.candidate_sha !== candidateSha) refuse('run_not_owner', `run ${runId} belongs to another worktree or candidate.`);
  return { ...state, run_dir: runDir };
}

const sameHolder = (a, b) => Boolean(a && b && a.pid === b.pid && a.created === b.created);

/**
 * Records the wrapper as the run's active holder. The caller must be a direct child of the wrapper
 * and the wrapper must already hold the run's OS lock. A dead earlier holder means an interrupted
 * command: the run enters needs-reconcile, and then only down and reconcile proceed.
 */
export function lockRun({ run, wrapper, command, processTable, lockHeld, parentPid, now = () => new Date(), ops = STATE_OPS }) {
  if (!/^[a-z-]{2,32}$/.test(command ?? '')) refuse('bad_request', 'a command name is required.');
  if (!lockHeld()) refuse('run_unlocked', `the OS lock of run ${run.run_id} is not held; the wrapper must hold it first. Nothing was done.`);
  if (parentPid !== wrapper.pid) refuse('run_not_holder', 'custody must be called directly by the wrapper that holds the run lock.');
  const table = processTable();
  const me = processIdentity(wrapper.pid, table);
  if (me.created !== wrapper.created) refuse('process_unknown', 'the wrapper identity does not match the live process.');
  const state = stateOf(run, ops);
  let next = { ...state };
  const holder = state.active;
  // A holder record naming this same wrapper is taken over only when `up` just created it; otherwise
  // an earlier command of this process left it (it could not record what it launched): interrupted.
  if (holder && !(sameHolder(holder, me) && holder.fresh === true)) {
    if (!sameHolder(holder, me) && identityAlive(holder, table)) refuse('run_busy', `run ${run.run_id} is in use by live wrapper ${holder.pid} (${holder.command}); nothing was done.`);
    // The holder died (or left its record) while acting on the run: unknown outcome.
    next = {
      ...next, active: null, status: TERMINAL_STATUSES.includes(state.status) ? state.status : 'needs-reconcile',
      interrupted: [...(state.interrupted ?? []), { pid: holder.pid, created: holder.created, command: holder.command, since: holder.since, detected_at: now().toISOString(), detected_by: command }],
    };
    // Whatever that holder launched and did not finish recording is now an unaccounted child.
    if (!TERMINAL_STATUSES.includes(next.status)) next = promoteUnfinishedLaunches(next, now().toISOString());
  }
  if (TERMINAL_STATUSES.includes(next.status)) {
    if (next !== state) ops.write(run.run_dir, next);
    refuse('run_closed', `run ${run.run_id} is ${next.status}; nothing was done.`);
  }
  if ((next.status === 'needs-reconcile' || next.status === 'releasing') && !RECONCILE_COMMANDS.includes(command)) {
    if (next !== state) ops.write(run.run_dir, { ...next, active: null });
    refuse('needs_reconcile', `run ${run.run_id} is ${next.status}; only status, reconcile and down are allowed. Nothing was done.`);
  }
  next = { ...next, active: { pid: me.pid, created: me.created, command, since: now().toISOString() } };
  ops.write(run.run_dir, next);
  return { ...next, run_dir: run.run_dir };
}

/**
 * Interrupted-holder recovery: every launch record the interrupted holder left unfinished (intent or
 * running) enters the durable unaccounted-child path, with every identity field the record holds (a
 * complete identity is never collapsed; an existing unaccounted entry only gains fields it lacks).
 * The one exception is the run's recorded owned app (complete identity recorded and equal, owned
 * stack): it keeps its normal shutdown. Absence is never inferred here; reconciliation decides.
 */
export function promoteUnfinishedLaunches(state, at, reason = 'interrupted-holder') {
  const unaccounted = [...(state.unaccounted ?? [])];
  for (const record of state.processes ?? []) {
    if (FINISHED_OUTCOMES.includes(record.outcome)) continue;
    if (isRecordedOwnedApp(record, state)) continue;
    const index = unaccounted.findIndex((item) => item.launch_id === record.launch_id);
    if (index >= 0) {
      const item = unaccounted[index];
      unaccounted[index] = { ...item, pid: item.pid ?? record.pid ?? null, created: item.created ?? record.created ?? null, command_sha256: item.command_sha256 ?? record.command_sha256 ?? null };
      continue;
    }
    unaccounted.push({
      launch_id: record.launch_id, role: record.role, reason, pid: record.pid ?? null, created: record.created ?? null, command_sha256: record.command_sha256 ?? null,
      reported: null, at, accounted: null,
    });
  }
  return unaccounted.length === (state.unaccounted ?? []).length && unaccounted.every((item, index) => item === state.unaccounted[index]) ? state : { ...state, unaccounted };
}

/** Clears the active holder (the wrapper closes its OS lock only after this succeeded). */
export function unlockRun({ run, wrapper, lockHeld, parentPid, ops = STATE_OPS }) {
  if (!lockHeld()) refuse('run_unlocked', 'the run lock is not held; nothing to unlock.');
  if (parentPid !== wrapper.pid) refuse('run_not_holder', 'custody must be called directly by the wrapper that holds the run lock.');
  const state = stateOf(run, ops);
  if (!state.active) return 'unlocked';
  if (!sameHolder(state.active, wrapper)) refuse('run_not_holder', 'the run is held by another wrapper; nothing was unlocked.');
  ops.write(run.run_dir, { ...state, active: null });
  return 'unlocked';
}

/** Every changing custody command: the caller is the direct child of the recorded live holder. */
export function assertHolder({ state, wrapper, lockHeld, parentPid }) {
  if (!lockHeld()) refuse('run_unlocked', 'the run lock is not held; nothing was done.');
  if (parentPid !== wrapper.pid) refuse('run_not_holder', 'custody must be called directly by the wrapper that holds the run lock.');
  if (!sameHolder(state.active, wrapper)) refuse('run_not_holder', 'the caller is not the run\'s active holder; nothing was done.');
}

/** Gate for bootstrap commands and other run work: an open run with a live recorded holder. */
export function assertRunWorkable(state, table) {
  if (state.status !== 'created') refuse(state.status === 'needs-reconcile' ? 'needs_reconcile' : 'run_closed', `run ${state.run_id} is ${state.status}; nothing was done.`);
  if (!state.active || !identityAlive(state.active, table)) refuse('run_unlocked', `run ${state.run_id} has no live holder; run it through r2-fullstack-preview.ps1.`);
}

/**
 * Records one child command of the run. `intent` comes BEFORE the launch (so a crash between launch
 * and record leaves an unknown, never an unrecorded, child); `running` adds the full identity;
 * `exited`, `timeout` and `launch-failed` close it. The stack is owned only by a start intent after a
 * clean preflight, and stack roles are refused on a stack this run does not own.
 */
export function recordProcess({ run, entry, now = () => new Date(), ops = STATE_OPS }) {
  if (!LAUNCH_PATTERN.test(entry.launch_id ?? '') || !/^[a-z0-9-]{2,40}$/.test(entry.role ?? '') || !OUTCOMES.includes(entry.outcome)) refuse('bad_request', 'invalid launch record.');
  const state = stateOf(run, ops);
  const processes = state.processes ?? [];
  const prior = processes.find((item) => item.launch_id === entry.launch_id);
  const at = now().toISOString();
  let ownership = state.ownership ?? { stack: 'unproven' };
  let record;
  if (entry.outcome === 'intent') {
    if (prior) refuse('bad_request', 'this launch is already recorded.');
    if (entry.role === 'supabase-start') {
      if (ownership.stack !== 'preflight-empty') refuse('ownership_unproven', 'the stack may start only after this run proved that none of its resources pre-exist; nothing was started.');
      ownership = { ...ownership, stack: 'owned', owned_since: at, owned_by_launch: entry.launch_id };
    } else if (OWNED_STACK_ROLES.includes(entry.role) && ownership.stack !== 'owned') {
      refuse('ownership_unproven', `${entry.role} acts on a stack this run has not proven it created; nothing was done.`);
    }
    record = { launch_id: entry.launch_id, role: entry.role, outcome: 'intent', pid: null, created: null, command_sha256: null, parent: entry.parent ?? null, timeout_s: entry.timeout_s ?? null, exit_code: null, intent_at: at, at };
  } else {
    if (!prior || prior.role !== entry.role) refuse('bad_request', 'no matching launch intent was recorded; the record is refused.');
    if (FINISHED_OUTCOMES.includes(prior.outcome)) refuse('bad_request', 'this launch is already finished.');
    if (entry.outcome === 'running' && !Number.isInteger(entry.pid)) refuse('bad_request', 'a running launch needs the child pid.');
    if (Number.isInteger(prior.pid) && Number.isInteger(entry.pid) && prior.pid !== entry.pid) refuse('bad_request', 'the child pid changed between records.');
    // The identity first seen is kept; a later record never erases it.
    record = {
      ...prior, outcome: entry.outcome, at,
      pid: prior.pid ?? entry.pid ?? null, created: prior.created ?? entry.created ?? null, command_sha256: prior.command_sha256 ?? entry.command_sha256 ?? null,
      exit_code: entry.exit_code ?? prior.exit_code ?? null, timeout_s: entry.timeout_s ?? prior.timeout_s ?? null,
    };
  }
  const next = { ...state, ownership, processes: [...processes.filter((item) => item.launch_id !== entry.launch_id), record], status: entry.outcome === 'timeout' ? 'needs-reconcile' : state.status };
  ops.write(run.run_dir, next);
  return record;
}

/**
 * Records the app's root identity (and closes its launch intent as running).
 * @param {{ run: any, app: ProcessIdentity, launchId?: string | null, ops?: typeof STATE_OPS, now?: () => Date }} options
 */
export function setRunApp({ run, app, launchId = null, ops = STATE_OPS, now = () => new Date() }) {
  const state = stateOf(run, ops);
  if ((state.ownership?.stack) !== 'owned') refuse('ownership_unproven', 'the app serves only a stack this run owns.');
  const processes = (state.processes ?? []).map((item) => (launchId && item.launch_id === launchId && item.role === 'app'
    ? { ...item, outcome: 'running', pid: app.pid, created: app.created, command_sha256: app.command_sha256 ?? null, at: now().toISOString() } : item));
  ops.write(run.run_dir, { ...state, app, processes });
}

/**
 * A child was launched but its bookkeeping (pid/identity record, heartbeat, outcome record) failed:
 * the run moves to needs-reconcile (only status, reconcile and down proceed) with the complete child
 * identity known at launch merged into the launch record (a known identity is never erased). The
 * child is not stopped and not declared absent. This only ever restricts the run, so it needs the OS
 * lock and the holder's pid but no process-table proof (the table may be what failed).
 * @param {{ run: any, entry: { launch_id: string, role: string, reason: string, pid?: number | null, created?: string | null, command_sha256?: string | null },
 *   now?: () => Date, ops?: typeof STATE_OPS }} options
 */
export function markUnaccounted({ run, entry, now = () => new Date(), ops = STATE_OPS }) {
  if (!LAUNCH_PATTERN.test(entry.launch_id ?? '') || !/^[a-z0-9-]{2,40}$/.test(entry.role ?? '') || !/^[a-z0-9-]{2,40}$/.test(entry.reason ?? '')) refuse('bad_request', 'invalid unaccounted-child record.');
  const pid = Number.isInteger(entry.pid) && entry.pid > 0 ? entry.pid : null;
  const created = typeof entry.created === 'string' && CREATED_PATTERN.test(entry.created) ? entry.created : null;
  const commandSha = typeof entry.command_sha256 === 'string' && /^[0-9a-f]{64}$/.test(entry.command_sha256) ? entry.command_sha256 : null;
  const state = stateOf(run, ops);
  const at = now().toISOString();
  const processes = state.processes ?? [];
  const prior = processes.find((item) => item.launch_id === entry.launch_id);
  const record = prior
    ? { ...prior, pid: prior.pid ?? pid, created: prior.created ?? created, command_sha256: prior.command_sha256 ?? commandSha, at }
    : { launch_id: entry.launch_id, role: entry.role, outcome: 'intent', pid, created, command_sha256: commandSha, parent: null, timeout_s: null, exit_code: null, intent_at: null, at };
  const item = { launch_id: entry.launch_id, role: entry.role, reason: entry.reason, pid: record.pid, created: record.created, command_sha256: record.command_sha256, reported: { pid, created, command_sha256: commandSha }, at, accounted: null };
  const keep = TERMINAL_STATUSES.includes(state.status) || state.status === 'releasing';
  const next = {
    ...state, status: keep ? state.status : 'needs-reconcile',
    processes: [...processes.filter((other) => other.launch_id !== entry.launch_id), record],
    unaccounted: [...(state.unaccounted ?? []).filter((other) => other.launch_id !== entry.launch_id), item],
  };
  ops.write(run.run_dir, next);
  return item;
}

/**
 * Accounts for unaccounted children from positive evidence only: a child whose COMPLETE identity
 * (pid, creation time, command-line digest) is known is accounted once a known process table shows no
 * process with that identity. A pid-only or otherwise incomplete identity is never accounted (pid
 * absence, missing bookkeeping, a timeout or a failed heartbeat prove nothing); it stays unresolved and
 * keeps down refused. The run stays in needs-reconcile either way; only a verified down closes it.
 */
export function accountUnaccounted(state, table, now = () => new Date()) {
  if (!(state.unaccounted ?? []).some((item) => !item.accounted)) return state;
  if (!Array.isArray(table) || table.length === 0) refuse('inventory_failed', 'the process table is unknown; nothing was accounted.');
  const processes = [...(state.processes ?? [])];
  let changed = false;
  const unaccounted = state.unaccounted.map((item) => {
    if (item.accounted) return item;
    const index = processes.findIndex((entry) => entry.launch_id === item.launch_id);
    const record = index >= 0 ? processes[index] : null;
    const identity = [record, item].find((candidate) => completeIdentity(candidate));
    if (!identity || identityAlive(identity, table)) return item;
    changed = true;
    const at = now().toISOString();
    if (record && !FINISHED_OUTCOMES.includes(record.outcome)) processes[index] = { ...record, outcome: 'gone', at };
    return { ...item, accounted: { result: 'absent', by: 'complete-identity', at } };
  });
  return changed ? { ...state, processes, unaccounted } : state;
}

// ---------------------------------------------------------------- preflight, teardown, release

/** Nothing of the run may pre-exist: no container or volume of its project, no listener on its ports. */
export function preflightEvidence({ run, docker, listeners }) {
  const resources = docker(run.project_id);
  const busy = listeners(runPortList(run.ports));
  return {
    empty: resources.containers.length === 0 && resources.volumes.length === 0 && busy.length === 0,
    containers: resources.containers, volumes: resources.volumes,
    listeners: busy.map((item) => ({ address: item.address, port: item.port, pid: item.pid, family: item.family })),
  };
}

/**
 * Teardown evidence from the run's own records only. Verified when no container or volume of the
 * run's project exists, no listener holds any of its ports, no recorded process is alive and no
 * recorded launch has an unknown identity. Any probe failure throws (UNKNOWN), which keeps the slot.
 */
export function teardownEvidence({ run, docker, listeners, processTable }) {
  const resources = docker(run.project_id);
  const busy = listeners(runPortList(run.ports));
  const { liveProcesses, unknownProcesses } = processEvidence(run, processTable());
  const evidence = { containers: resources.containers.length, volumes: resources.volumes.length, listeners: busy.length, liveProcesses, unknownProcesses };
  return { verified: evidence.containers === 0 && evidence.volumes === 0 && evidence.listeners === 0 && liveProcesses.length === 0 && unknownProcesses.length === 0, ...evidence };
}

/** True when the run's own records show that nothing of its stack, data or app was ever launched. */
export function neverStarted(state) {
  return state.ownership?.stack !== 'owned' && !state.app && !(state.processes ?? []).some((item) => RESOURCE_ROLES.includes(item.role) && item.outcome !== 'launch-failed');
}

/**
 * The one terminal transition: `releasing` with the decision and evidence, the slot rename, then the
 * terminal state with no active holder. `released` needs verified teardown; `never-started` and
 * `refused` need the run's records to show nothing was ever launched and no recorded process alive
 * or unknown. Re-running it on a `releasing` run completes the journaled decision.
 */
export function finalizeRelease({ run, kind, evidence, slotDir = DEFAULT_SLOT_DIR, ops = STATE_OPS, now = () => new Date() }) {
  if (!['released', 'never-started', 'refused'].includes(kind)) refuse('bad_request', 'unknown release kind.');
  let state = stateOf(run, ops);
  if (TERMINAL_STATUSES.includes(state.status)) refuse('run_closed', `run ${run.run_id} is already ${state.status}.`);
  if (unresolvedUnaccounted(state).length) refuse('unaccounted_child', 'a launched child of the run is unaccounted; the port block is kept.');
  if (state.status === 'releasing') {
    if (state.release?.kind !== kind) refuse('release_conflict', `run ${run.run_id} is completing a ${state.release?.kind} release; nothing else was done.`);
  } else {
    if (kind === 'released' && !evidence?.verified) refuse('teardown_unverified', 'teardown is not verified; the port block is kept.');
    if (kind !== 'released') {
      if (!neverStarted(state)) refuse('ownership_unknown', 'this run launched resources; only a verified teardown may release it.');
      if (!evidence || evidence.liveProcesses?.length || evidence.unknownProcesses?.length || !Array.isArray(evidence.liveProcesses)) refuse('ownership_unknown', 'a recorded process of this run is alive or unknown; the reservation is kept.');
    }
    state = { ...state, status: 'releasing', release: { kind, evidence, started_at: now().toISOString() } };
    ops.write(run.run_dir, state);
  }
  const file = slotFile(slotDir, state.slot);
  const tombstone = slotTombstone(slotDir, state.run_id);
  const held = ops.readSlot(file);
  if (held && held.run_id === state.run_id) ops.rename(file, tombstone);
  else if (ops.readSlot(tombstone)?.run_id !== state.run_id) refuse('run_not_owner', 'the port block is neither held nor released by this run; the release is not completed.');
  const terminal = kind === 'refused' ? 'refused' : 'released';
  ops.write(run.run_dir, { ...state, status: terminal, phase: kind === 'released' ? 'torn-down' : 'never-started', active: null, release: { ...state.release, completed_at: now().toISOString() } });
  return terminal;
}

/** Compatibility helper: the verified-teardown release. */
export function releaseSlot({ run, slotDir = DEFAULT_SLOT_DIR, evidence, ops = STATE_OPS }) {
  return finalizeRelease({ run, kind: 'released', evidence, slotDir, ops });
}

/**
 * What `down` may do, from the run's own records. A stack is stopped only when the run owns it; a
 * never-started run only gives back its reservation; anything alive or unknown is refused.
 */
export function downPlan(state, evidence) {
  // An unaccounted launch (live, pid-only or otherwise unresolved) blocks every down action, including
  // a stack this run owns: nothing is stopped, reset or torn down until reconciliation proves the child
  // absent by its complete identity. The run's recorded owned app is not blocked: down stops it.
  const unresolved = unresolvedUnaccounted(state);
  if (unresolved.length) refuse('unaccounted_child', `launched children of the run are unaccounted (${unresolved.map((item) => `${item.role} pid ${item.pid ?? 'unknown'}`).join(', ')}); nothing was stopped, reset or torn down. Run reconcile once the child is gone; a pid-only identity needs the owner.`);
  if (state.status === 'releasing') return { action: 'resume-release', kind: state.release?.kind ?? null, stack: 'none', app: 'none' };
  if (state.ownership?.stack === 'owned') return { action: 'teardown', stack: 'stop', app: state.app ? 'stop' : 'none' };
  if (!neverStarted(state)) refuse('ownership_unknown', 'the run\'s records do not prove what it created; nothing was stopped and the reservation is kept.');
  if (evidence.liveProcesses.length || evidence.unknownProcesses.length) refuse('ownership_unknown', `recorded processes of the run are alive or unknown (${[...evidence.liveProcesses, ...evidence.unknownProcesses].join(', ')}); nothing was stopped and the reservation is kept.`);
  return { action: 'release-never-started', stack: 'none', app: 'none' };
}

// ---------------------------------------------------------------- inputs bound to the candidate

export const BOUND_FIXED_INPUTS = Object.freeze([
  'scripts/matrix-options/r2-fullstack-preview.ps1',
  'scripts/matrix-options/r2-fullstack-bootstrap/bootstrap.mjs',
  'scripts/matrix-options/r2-fullstack-bootstrap/custody.mjs',
  'scripts/matrix-options/r2-fullstack-bootstrap/accounts.mjs',
  'scripts/matrix-options/r2-fullstack-bootstrap/same-origin-proxy.mjs',
  'scripts/matrix-options/r2-fullstack-bootstrap/manifest.json',
  'scripts/matrix-options/r2-fullstack-bootstrap/config.toml',
  'src/lib/matrix-options/paper/contracts/accepted-figures-phase2-review-2026-11-fa356b89.json',
  'src/lib/matrix-options/paper/guided-r2-admin-evidence.ts',
  'e2e/matrix-options-paper-r2-fullstack.spec.ts',
  'playwright.r2-fullstack.config.ts',
]);

/** Every repository input of a run: the fixed files plus the manifest's migrations, fixtures and parity files. */
export function boundInputPaths(manifest) {
  const steps = [...(manifest.migrations ?? []), ...(manifest.postStart ?? [])].map((step) => step.source);
  const all = [...BOUND_FIXED_INPUTS, ...steps, manifest.parity?.query, manifest.parity?.baseline];
  if (all.some((item) => typeof item !== 'string' || item === '' || path.isAbsolute(item) || item.split(/[\\/]/).includes('..'))) refuse('input_unbound', 'the manifest names an invalid input path.');
  return [...new Set(all)];
}

/**
 * Binds the run's inputs to the exact candidate: path, byte count and SHA-256 of every input, and
 * for a committed candidate each file's git blob must equal the candidate commit's blob.
 * @param {{ repoRoot: string, candidateSha: string, readFile?: (file: string) => Buffer,
 *   git?: { committedBlobs: (sha: string, paths: string[]) => Record<string, string>, workingBlobs: (paths: string[]) => Record<string, string> } | null }} options
 */
export function bindInputs({ repoRoot, candidateSha, readFile = (file) => fs.readFileSync(file), git = null }) {
  const manifestBytes = readFile(path.join(repoRoot, 'scripts/matrix-options/r2-fullstack-bootstrap/manifest.json'));
  let manifest;
  try { manifest = JSON.parse(manifestBytes.toString('utf8')); } catch { refuse('input_unbound', 'the bootstrap manifest is not JSON.'); }
  const files = boundInputPaths(manifest).map((relative) => {
    let bytes;
    try { bytes = readFile(path.join(repoRoot, relative)); } catch { refuse('input_unbound', `input ${relative} is missing.`); }
    return { path: relative, bytes: bytes.length, sha256: sha256(bytes) };
  });
  if (candidateSha !== 'inner-loop') {
    if (!git) refuse('input_unbound', 'a committed candidate needs its git blobs.');
    const committed = git.committedBlobs(candidateSha, files.map((file) => file.path));
    const working = git.workingBlobs(files.map((file) => file.path));
    for (const file of files) {
      if (!committed[file.path] || committed[file.path] !== working[file.path]) refuse('input_mismatch', `input ${file.path} is not the candidate's committed file; nothing was started.`);
      file.git_blob = committed[file.path];
    }
  }
  return { candidate_sha: candidateSha, inner_loop: candidateSha === 'inner-loop', files, digest: sha256(JSON.stringify(files)) };
}

/** The consumed bytes of one input must be the bound bytes (no substitution after the binding). */
export function verifyConsumed(binding, relative, bytes) {
  const bound = binding?.files?.find((file) => file.path === relative);
  if (!bound) refuse('input_unbound', `input ${relative} is not bound to this run.`);
  if (bytes.length !== bound.bytes || sha256(bytes) !== bound.sha256) refuse('input_substituted', `input ${relative} changed after it was bound; nothing was done.`);
  return { path: relative, bytes: bound.bytes, sha256: bound.sha256 };
}

/** Exact file set and digests of a directory tree (relative slash paths). */
export function treeDigests(root) {
  const out = [];
  const walk = (dir, prefix) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
      const full = path.join(dir, entry.name);
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) refuse('input_substituted', `generated input ${relative} is a link.`);
      if (entry.isDirectory()) walk(full, relative);
      else if (entry.isFile()) { const bytes = fs.readFileSync(full); out.push({ path: relative, bytes: bytes.length, sha256: sha256(bytes) }); }
      else refuse('input_substituted', `generated input ${relative} is not a regular file.`);
    }
  };
  walk(root, '');
  return out;
}

/** The generated bundle in the run directory must be exactly what prepare recorded. */
export function checkGenerated(recorded, actual) {
  const key = (items) => JSON.stringify(items.map((item) => [item.path, item.bytes, item.sha256]));
  if (!Array.isArray(recorded) || recorded.length === 0 || key(recorded) !== key(actual)) refuse('input_substituted', 'the generated run bundle changed after it was prepared; nothing was started.');
  return true;
}

/** Receipt evidence: every consumed record of the run, each matching the binding. */
export function consumedReport(state, records) {
  if (!state.inputs) refuse('input_unbound', 'the run has no input binding.');
  for (const record of records) {
    if (record.run_id !== state.run_id) refuse('input_unbound', 'a consumed record belongs to another run.');
    for (const file of record.files ?? []) {
      const bound = state.inputs.files.find((item) => item.path === file.path);
      if (!bound || bound.sha256 !== file.sha256 || bound.bytes !== file.bytes) refuse('input_substituted', `consumed input ${file.path} does not match the binding.`);
    }
  }
  return { binding_digest: state.inputs.digest, candidate_sha: state.inputs.candidate_sha, bound: state.inputs.files, consumed: records };
}

// ---------------------------------------------------------------- destructive local Supabase CLI calls

export const SUPABASE_CLI = 'supabase@2.122.1';
/** The only destructive local CLI calls, each with fixed arguments (no caller-supplied argument). */
export const DESTRUCTIVE_CLI_ROLES = Object.freeze({ 'supabase-db-reset': Object.freeze(['db', 'reset']), 'supabase-stop': Object.freeze(['stop', '--no-backup']) });
const MANIFEST_INPUT = 'scripts/matrix-options/r2-fullstack-bootstrap/manifest.json';
const CONFIG_TEMPLATE_INPUT = 'scripts/matrix-options/r2-fullstack-bootstrap/config.toml';

/**
 * Immediately before each destructive local Supabase CLI call (db reset, stop): re-reads everything
 * that call depends on and returns its exact invocation, or refuses (nothing is invoked). Checked now:
 * the run still owns an open stack; the workdir is the run's own directory and the project id is the
 * one derived from the run id; the bound manifest and config template are still the bound bytes; the
 * run's config.toml bytes and digest equal the bound template rendered for this run, naming exactly
 * this run's project id; the run directory is not linked to a hosted project; and for db reset, the
 * run's migrations are exactly the manifest's targets, each byte-identical to its bound source. The
 * child environment carries no Supabase or database override and is bound to the local engine.
 * @param {{ repoRoot: string, state: any, role: string, renderConfig: (template: string, state: any) => string,
 *   readFile?: (file: string) => Buffer, listDir?: (dir: string) => string[], exists?: (file: string) => boolean, env?: Env, platform?: string }} options
 */
export function destructiveCliInvocation({ repoRoot, state, role, renderConfig, readFile = (file) => fs.readFileSync(file), listDir = (dir) => fs.readdirSync(dir), exists = (file) => fs.existsSync(file), env = process.env, platform = process.platform }) {
  const fixed = DESTRUCTIVE_CLI_ROLES[role];
  if (!fixed) refuse('bad_request', `${role} is not a guarded destructive CLI call; nothing was invoked.`);
  if (!state || !RUN_ID_PATTERN.test(state.run_id ?? '')) refuse('run_unknown', 'no proven run; nothing was invoked.');
  const open = role === 'supabase-stop' ? ['created', 'needs-reconcile'] : ['created'];
  if (!open.includes(state.status) || state.ownership?.stack !== 'owned') refuse('ownership_unproven', `${role} acts only on an open stack this run owns; nothing was invoked.`);
  if (normPath(state.run_dir ?? '') !== normPath(path.join(repoRoot, '.tmp', 'r2-fullstack', 'runs', state.run_id))) refuse('cli_unbound', `the ${role} workdir is not this run's own directory; nothing was invoked.`);
  if (state.project_id !== runResources(repoRoot, state.run_id, state.slot).projectId) refuse('cli_unbound', `the run's project id is not the one derived from its run id; ${role} was not invoked.`);
  assertBoundDockerEnv(env);
  if (!state.inputs) refuse('input_unbound', `the run has no input binding; ${role} was not invoked.`);
  const consume = (relative) => {
    let bytes;
    try { bytes = readFile(path.join(repoRoot, relative)); } catch { refuse('input_unbound', `input ${relative} is missing; ${role} was not invoked.`); }
    verifyConsumed(state.inputs, relative, bytes);
    return bytes;
  };
  let manifest;
  try { manifest = JSON.parse(consume(MANIFEST_INPUT).toString('utf8')); } catch (error) { if (error instanceof CustodyError) throw error; refuse('input_unbound', 'the bound manifest is not JSON.'); }
  const template = consume(CONFIG_TEMPLATE_INPUT);
  if (sha256(template) !== manifest.configTemplateSha256) refuse('input_substituted', `the config template is not the pinned template; ${role} was not invoked.`);
  const supabaseDir = path.join(state.run_dir, 'supabase');
  let config;
  try { config = readFile(path.join(supabaseDir, 'config.toml')); } catch { refuse('input_substituted', `the run's config.toml is missing; ${role} was not invoked.`); }
  let expected;
  try { expected = Buffer.from(renderConfig(template.toString('utf8'), state), 'utf8'); } catch { refuse('input_substituted', `the run's config could not be derived from the bound template; ${role} was not invoked.`); }
  if (config.length !== expected.length || sha256(config) !== sha256(expected)) refuse('input_substituted', `the run's config.toml changed after it was bound; ${role} was not invoked.`);
  const projectIds = [...config.toString('utf8').matchAll(/^\s*project_id\s*=\s*"([^"]*)"\s*$/gm)].map((match) => match[1]);
  if (projectIds.length !== 1 || projectIds[0] !== state.project_id) refuse('cli_unbound', `the run's config does not name exactly this run's project; ${role} was not invoked.`);
  if (exists(path.join(supabaseDir, '.temp', 'project-ref'))) refuse('cli_unbound', `the run directory is linked to a hosted project; ${role} was not invoked.`);
  const checked = { config_sha256: sha256(config), project_id: state.project_id, migrations: [] };
  if (role === 'supabase-db-reset') {
    const migrationsDir = path.join(supabaseDir, 'migrations');
    let names;
    try { names = [...listDir(migrationsDir)].sort(); } catch { refuse('input_substituted', `the run's migrations could not be listed; ${role} was not invoked.`); }
    const targets = (manifest.migrations ?? []).map((step) => step.target).sort();
    if (targets.length === 0 || JSON.stringify(names) !== JSON.stringify(targets)) refuse('input_substituted', `the run's migrations are not exactly the bound migrations; ${role} was not invoked.`);
    for (const step of manifest.migrations) {
      const source = consume(step.source);
      if (sha256(source) !== step.sha256) refuse('input_substituted', `migration source ${step.source} is not its pinned bytes; ${role} was not invoked.`);
      let copy;
      try { copy = readFile(path.join(migrationsDir, step.target)); } catch { refuse('input_substituted', `migration ${step.target} is missing; ${role} was not invoked.`); }
      if (copy.length !== source.length || sha256(copy) !== step.sha256) refuse('input_substituted', `migration ${step.target} changed after it was bound; ${role} was not invoked.`);
      checked.migrations.push({ target: step.target, sha256: step.sha256 });
    }
  }
  const childEnv = Object.fromEntries(Object.entries(env).filter(([name]) => !/^(SUPABASE_|DATABASE_URL$|PG)/i.test(name)));
  const cliArgs = ['--yes', SUPABASE_CLI, ...fixed, '--workdir', state.run_dir];
  const [file, args] = platform === 'win32' ? ['cmd.exe', ['/d', '/s', '/c', 'npx', ...cliArgs]] : ['npx', cliArgs];
  return { role, file, args, cwd: state.run_dir, env: childEnv, checked };
}

/**
 * The one path to a destructive local CLI call: the run is proven again (fresh state), everything the
 * call depends on is re-verified, and only then is the CLI invoked, once. A refusal invokes nothing.
 * @param {{ prove: () => any, invoke: (invocation: ReturnType<typeof destructiveCliInvocation>) => number } & Omit<Parameters<typeof destructiveCliInvocation>[0], 'state'>} options
 */
export function runDestructiveCli({ prove, invoke, ...options }) {
  const invocation = destructiveCliInvocation({ ...options, state: prove() });
  return invoke(invocation);
}

// ---------------------------------------------------------------- API destination

/**
 * The run-owned API destination, proven now: the run's own API container (exact name, id, running)
 * publishes exactly 127.0.0.1:<run api port>, and exactly one listener holds that port, on 127.0.0.1,
 * with a proven process identity.
 */
export function apiDestination({ run, inspect, listeners, processTable }) {
  const name = `supabase_kong_${run.project_id}`;
  const info = inspect(name);
  if (!info || info.Name !== `/${name}` || !/^[0-9a-f]{64}$/.test(info.Id ?? '') || info.State?.Running !== true) refuse('destination_unknown', 'the run\'s API container is not proven; nothing was sent.');
  const published = info.NetworkSettings?.Ports?.['8000/tcp'];
  if (!Array.isArray(published) || published.length !== 1 || published[0]?.HostIp !== '127.0.0.1' || published[0]?.HostPort !== String(run.ports.api)) refuse('destination_unknown', 'the run\'s API container does not publish exactly its loopback API port; nothing was sent.');
  const onPort = listeners([run.ports.api]);
  if (onPort.length !== 1 || onPort[0].address !== '127.0.0.1') refuse('destination_unknown', 'the run\'s API port does not have exactly one loopback listener; nothing was sent.');
  const owner = processIdentity(onPort[0].pid, processTable());
  return {
    url: `http://127.0.0.1:${run.ports.api}`, container: name, containerId: info.Id, startedAt: info.State?.StartedAt ?? null,
    hostIp: '127.0.0.1', hostPort: run.ports.api, listenerPid: owner.pid, listenerCreated: owner.created,
  };
}
const DESTINATION_FIELDS = ['url', 'container', 'containerId', 'startedAt', 'hostIp', 'hostPort', 'listenerPid', 'listenerCreated'];
export const sameDestination = (a, b) => Boolean(a && b) && DESTINATION_FIELDS.every((field) => a[field] === b[field]);

/**
 * Sensitive bootstrap requests and every direct request of the local journey: the destination must be
 * the run's own loopback API origin (http, 127.0.0.1, its proven port; and, when given, exactly the
 * bound API URL); immediately before each send it is proven again and must equal the one first
 * discovered; automatic redirects are disabled and any redirect answer is refused, so no redirected
 * request is ever sent. Nothing is sent when a proof fails.
 * @param {{ initial: any, prove: () => any, send: (url: string, init: any) => Promise<any>, expected?: string }} options
 */
export function createGuardedSender({ initial, prove, send, expected = undefined }) {
  if (!initial || typeof initial.url !== 'string') refuse('destination_unknown', 'no proven API destination.');
  let origin;
  try { origin = new URL(initial.url); } catch { refuse('destination_unknown', 'the proven API destination is not a URL; nothing was sent.'); }
  if (origin.protocol !== 'http:' || origin.hostname !== '127.0.0.1' || origin.port !== String(initial.hostPort) || origin.username || origin.password
    || origin.pathname !== '/' || origin.search || origin.hash || initial.url !== origin.origin) refuse('destination_unknown', 'the API destination is not the run\'s loopback origin; nothing was sent.');
  if (expected !== undefined && expected !== initial.url) refuse('destination_changed', 'the proven API destination is not the bound local API destination; nothing was sent.');
  return async (pathname, init = {}) => {
    if (typeof pathname !== 'string' || !pathname.startsWith('/') || pathname.startsWith('//')) refuse('bad_request', 'invalid API path.');
    const current = prove();
    if (!sameDestination(initial, current)) refuse('destination_changed', 'the run\'s API destination changed after it was discovered; nothing was sent.');
    const target = new URL(pathname, initial.url);
    if (target.origin !== origin.origin) refuse('destination_changed', 'the request would leave the proven API origin; nothing was sent.');
    const response = await send(target.href, { ...init, redirect: 'manual' });
    if (response.type === 'opaqueredirect' || response.redirected || (response.status >= 300 && response.status < 400)) refuse('redirected', 'the local API answered with a redirect; it is not followed.');
    return response;
  };
}

/**
 * The run-owned API sender for the local journey's direct requests (login, RPC, activation): before
 * each send, the explicit run is proven again (still open, still owning its stack) and its API
 * destination (container, published loopback mapping, listener identity) is proven again; the
 * destination must equal the bound local API URL. Built on createGuardedSender.
 * @param {{ runId: string, apiUrl: string, proveRunState: () => any, inspect?: (name: string) => any, listeners?: (ports: number[]) => any[],
 *   processTable?: () => ProcessRow[], send?: (url: string, init: any) => Promise<any> }} options
 */
export function createRunApiSender({ runId, apiUrl, proveRunState, inspect = (name) => inspectContainer(name), listeners = (ports) => listenersOn(ports), processTable = () => defaultProcessTable(), send = (url, init) => fetch(url, init) }) {
  const prove = () => {
    const state = proveRunState();
    if (!state || state.run_id !== runId) refuse('destination_unknown', 'the request is not for the proven run; nothing was sent.');
    if (state.status !== 'created' || state.ownership?.stack !== 'owned') refuse('destination_unknown', `run ${runId} does not own an open stack; nothing was sent.`);
    return apiDestination({ run: state, inspect, listeners, processTable });
  };
  return createGuardedSender({ initial: prove(), prove, send, expected: apiUrl });
}

// ---------------------------------------------------------------- listeners

const TCP_STATES = new Set(['LISTENING', 'ESTABLISHED', 'TIME_WAIT', 'CLOSE_WAIT', 'SYN_SENT', 'SYN_RECEIVED', 'FIN_WAIT_1', 'FIN_WAIT_2', 'LAST_ACK', 'CLOSING', 'CLOSED', 'DELETE_TCB', 'BOUND']);
const HEADER = /^\s*Proto\s+Local Address\s+Foreign Address\s+State\s+PID\s*$/;
const IPV4_ROW = /^\s*TCP\s+(\d{1,3}(?:\.\d{1,3}){3}):(\d{1,5})\s+(\d{1,3}(?:\.\d{1,3}){3}):(\d{1,5}|\*)\s+(\S+)\s+(\d+)\s*$/;
const IPV6_ROW = /^\s*TCP\s+\[([0-9A-Fa-f:.]+(?:%[0-9A-Za-z]+)?)\]:(\d{1,5})\s+\[([0-9A-Fa-f:.]+(?:%[0-9A-Za-z]+)?)\]:(\d{1,5}|\*)\s+(\S+)\s+(\d+)\s*$/;

/** Strict `netstat -ano -p TCP|TCPv6` parser; null (UNKNOWN) for any unrecognized header, line, row or state. */
export function parseNetstat(text, family = 'ipv4') {
  if (typeof text !== 'string') return null;
  const lines = text.split(/\r?\n/);
  const headerAt = lines.findIndex((line) => HEADER.test(line));
  if (headerAt < 0) return null;
  for (const line of lines.slice(0, headerAt)) if (line.trim() !== '' && line.trim() !== 'Active Connections') return null;
  const row = family === 'ipv6' ? IPV6_ROW : IPV4_ROW;
  const listeners = [];
  for (const line of lines.slice(headerAt + 1)) {
    if (line.trim() === '') continue;
    const match = row.exec(line);
    if (!match || !TCP_STATES.has(match[5])) return null;
    const port = Number(match[2]);
    if (port < 0 || port > 65535) return null;
    if (match[5] === 'LISTENING') listeners.push({ address: match[1], port, pid: Number(match[6]), family });
  }
  return listeners;
}

/** IPv4 + IPv6 listener inventory; any failure is UNKNOWN (throws), never zero listeners. */
/** @param {{ exec?: Exec }} [options] */
export function listenerInventory({ exec = defaultExec } = {}) {
  const all = [];
  for (const [protocol, family] of [['TCP', 'ipv4'], ['TCPv6', 'ipv6']]) {
    const result = exec('netstat', ['-ano', '-p', protocol]);
    if (result.status !== 0) refuse('inventory_failed', `the ${family} listener inventory failed; listener state is unknown.`);
    const parsed = parseNetstat(result.stdout, family);
    if (parsed === null) refuse('inventory_failed', `the ${family} listener inventory could not be fully parsed; listener state is unknown.`);
    all.push(...parsed);
  }
  return all;
}
export function listenersOn(ports, options) { const wanted = new Set(ports); return listenerInventory(options).filter((entry) => wanted.has(entry.port)); }

export const LISTENER_INVENTORY_SCHEMA = 'r2-listener-inventory/1';
/**
 * The `listeners` command's result across the PowerShell boundary: always ONE object, never a bare
 * array (Windows PowerShell does not round-trip an empty JSON array as a value), with the asked
 * ports and an explicit count, so zero listeners, one listener and malformed output stay distinct.
 */
export function listenerInventoryResult(ports, listeners) {
  return { schema: LISTENER_INVENTORY_SCHEMA, ports: [...ports], count: listeners.length, listeners: listeners.map(({ address, port, pid, family }) => ({ address, port, pid, family })) };
}

/**
 * Owned-listener proof: exactly one listener on the run's app port (IPv4 and IPv6 together), bound
 * to 127.0.0.1, inside the process tree whose root the run recorded (pid AND creation time) and
 * which runs the run's own launch script; the listening process serves the stamp's preview worktree;
 * that worktree is at the candidate HEAD and tree; its .next/BUILD_ID equals the run's build stamp;
 * and the listener serves that BUILD_ID.
 */
export async function proveOwnedListener({ run, stamp, listeners, processTable, git, readBuildId, fetchStatus }) {
  const port = run?.ports?.app;
  const checks = { appRecorded: false, oneLoopbackListener: false, inOwnedTree: false, rootLaunchesWorktree: false, stampIsThisRun: false, worktreeAtCandidate: false, buildIdMatches: false, servesBuild: false };
  try {
    checks.appRecorded = Boolean(run?.app && Number.isInteger(run.app.pid));
    const onPort = listeners([port]);
    const listener = onPort.length === 1 && onPort[0].address === '127.0.0.1' ? onPort[0] : null;
    checks.oneLoopbackListener = Boolean(listener);
    checks.stampIsThisRun = stamp?.run_id === run?.run_id && typeof stamp?.preview_worktree === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(stamp?.build_id ?? '');
    if (checks.appRecorded && listener) {
      const byPid = new Map(processTable().map((row) => [row.pid, row]));
      const root = byPid.get(run.app.pid);
      let current = byPid.get(listener.pid);
      for (let hop = 0; current && hop < 8 && current.pid !== run.app.pid; hop += 1) current = byPid.get(current.parent);
      checks.inOwnedTree = Boolean(root && current && current.pid === run.app.pid && root.created === run.app.created);
      const listenerRow = byPid.get(listener.pid);
      checks.rootLaunchesWorktree = Boolean(root && listenerRow && checks.stampIsThisRun
        && String(root.commandLine).toLowerCase().includes(`start-app-${run.run_id}.cmd`.toLowerCase())
        && String(listenerRow.commandLine).toLowerCase().includes(`--app "${stamp.preview_worktree}"`.toLowerCase()));
    }
    if (checks.stampIsThisRun) {
      const head = git(stamp.preview_worktree, ['rev-parse', 'HEAD']);
      const tree = git(stamp.preview_worktree, ['rev-parse', 'HEAD^{tree}']);
      const expectedSha = run.candidate_sha === 'inner-loop' ? stamp.candidate_sha : run.candidate_sha;
      checks.worktreeAtCandidate = SHA_PATTERN.test(head) && head === stamp.candidate_sha && head === expectedSha && tree === stamp.candidate_tree
        && (run.candidate_tree === null || tree === run.candidate_tree);
      checks.buildIdMatches = readBuildId(stamp.preview_worktree) === stamp.build_id;
      if (checks.oneLoopbackListener && checks.buildIdMatches) checks.servesBuild = (await fetchStatus(`http://127.0.0.1:${port}/_next/static/${stamp.build_id}/_buildManifest.js`)) === 200;
    }
  } catch (error) {
    return { ok: false, checks, error: error instanceof CustodyError ? error.code : 'proof_failed' };
  }
  return { ok: Object.values(checks).every(Boolean), checks };
}

// ---------------------------------------------------------------- CLI

function args(argv) {
  const out = {};
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    if (!/^--[a-z-]+$/.test(name ?? '') || argv[index + 1] === undefined) refuse('bad_request', 'usage: see the header of custody.mjs');
    out[name.slice(2)] = argv[index + 1];
  }
  return out;
}

/** git helpers for the input binding (one call each for the committed and the working blobs). */
function repoGit(repoRoot) {
  return {
    committedBlobs(sha, paths) {
      const out = defaultExec('git', ['-C', repoRoot, 'ls-tree', '-z', sha, '--', ...paths]);
      if (out.status !== 0) refuse('input_mismatch', 'the candidate tree could not be read.');
      const blobs = {};
      for (const record of out.stdout.split('\0').filter(Boolean)) { const match = /^\d+ blob ([0-9a-f]{40})\t(.+)$/.exec(record); if (match) blobs[match[2]] = match[1]; }
      return blobs;
    },
    workingBlobs(paths) {
      const out = defaultExec('git', ['-C', repoRoot, 'hash-object', '--stdin-paths'], { input: `${paths.join('\n')}\n` });
      if (out.status !== 0) refuse('input_mismatch', 'the working inputs could not be hashed.');
      const ids = out.stdout.split(/\r?\n/).filter(Boolean);
      if (ids.length !== paths.length) refuse('input_mismatch', 'the working inputs could not be hashed.');
      return Object.fromEntries(paths.map((item, index) => [item, ids[index]]));
    },
  };
}

function readConsumedRecords(runDir) {
  const dir = path.join(runDir, 'consumed');
  let names = [];
  try { names = fs.readdirSync(dir).filter((name) => name.endsWith('.json')).sort(); } catch (error) { if (!error || error.code !== 'ENOENT') refuse('run_io', 'the consumed records could not be read.'); }
  return names.map((name) => { const record = readJson(path.join(dir, name)); if (!record) refuse('run_io', `consumed record ${name} is unreadable.`); return record; });
}

async function main([command, ...rest]) {
  const options = args(rest);
  const print = (value) => process.stdout.write(`${JSON.stringify(value)}\n`);
  const repoRoot = options.worktree;
  const run = () => proveRun({ repoRoot, runId: options.run, candidateSha: options.sha });
  const wrapper = () => processIdentity(Number(options.pid), defaultProcessTable());
  const lockHeld = (current) => () => osLockHeld(lockFile(current.run_dir));
  /** The proven run whose live holder is this command's parent wrapper. */
  const held = () => {
    const current = run();
    const me = wrapper();
    assertHolder({ state: current, wrapper: me, lockHeld: lockHeld(current), parentPid: process.ppid });
    return current;
  };
  const docker = (projectId) => runDockerResources({ projectId });
  const listeners = (ports) => listenersOn(ports);
  const table = () => defaultProcessTable();
  switch (command) {
    case 'docker-bind': print(resolveDockerBinding()); return;
    case 'daemon-loopback': { const ok = daemonLoopbackConfigured(); print({ loopback: ok }); if (!ok) process.exit(3); return; }
    case 'run-new': print(createRun({ repoRoot, candidateSha: options.sha, candidateTree: options.tree === '-' ? null : options.tree, wrapper: wrapper(), processTable: table })); return;
    case 'run-verify': print(run()); return;
    case 'run-status': print(readRunStatus({ repoRoot, runId: options.run, candidateSha: options.sha })); return;
    case 'run-lock': { const current = run(); print(lockRun({ run: current, wrapper: wrapper(), command: String(options.command ?? ''), processTable: table, lockHeld: lockHeld(current), parentPid: process.ppid })); return; }
    case 'run-unlock': { const current = run(); print({ result: unlockRun({ run: current, wrapper: wrapper(), lockHeld: lockHeld(current), parentPid: process.ppid }) }); return; }
    case 'run-bind': {
      const current = held();
      if (current.inputs) refuse('bad_request', 'the run inputs are already bound; a run is bound once.');
      const binding = bindInputs({ repoRoot, candidateSha: current.candidate_sha, git: current.candidate_sha === 'inner-loop' ? null : repoGit(repoRoot) });
      STATE_OPS.write(current.run_dir, { ...STATE_OPS.read(current.run_dir), inputs: binding });
      print({ result: 'bound', digest: binding.digest, files: binding.files.length });
      return;
    }
    case 'inputs-check': {
      const current = run();
      if (!current.inputs) refuse('input_unbound', 'the run has no input binding.');
      const root = options.root;
      if (!root || !path.isAbsolute(root)) refuse('bad_request', '--root (absolute) is required.');
      const files = current.inputs.files.map((file) => verifyConsumed(current.inputs, file.path, fs.readFileSync(path.join(root, file.path))));
      print({ result: 'inputs-match', root: normPath(root), files: files.length, digest: current.inputs.digest });
      return;
    }
    case 'generated-check': {
      const current = held();
      const recorded = readJson(path.join(current.run_dir, 'generated-bundle.json'));
      checkGenerated(recorded?.files, treeDigests(path.join(current.run_dir, 'supabase')));
      print({ result: 'generated-match', files: recorded.files.length });
      return;
    }
    case 'preflight': {
      const current = held();
      assertBoundDockerEnv();
      if (current.ownership?.stack !== 'unproven') refuse('bad_request', 'preflight runs once, before the stack starts.');
      if (!current.inputs) refuse('input_unbound', 'bind the run inputs before preflight.');
      const evidence = preflightEvidence({ run: current, docker, listeners });
      if (evidence.empty) {
        const state = STATE_OPS.read(current.run_dir);
        STATE_OPS.write(current.run_dir, { ...state, ownership: { stack: 'preflight-empty', preflight: { ...evidence, at: new Date().toISOString() } } });
        print({ result: 'empty', evidence });
        return;
      }
      // Something of the run's project or ports pre-exists: never touch it. Persist the refusal and
      // release only this run's reservation.
      const state = STATE_OPS.read(current.run_dir);
      STATE_OPS.write(current.run_dir, { ...state, ownership: { stack: 'foreign', preflight: { ...evidence, at: new Date().toISOString() } } });
      const proc = processEvidence(state, table());
      const status = finalizeRelease({ run: current, kind: 'refused', evidence: { ...proc, preexisting: evidence } });
      print({ result: status, phase: 'never-started', evidence });
      process.exit(6);
      return;
    }
    case 'run-record': {
      const current = held();
      const processes = defaultProcessTable();
      const child = options.child === undefined ? null : Number(options.child);
      const row = child === null ? undefined : processes.find((entry) => entry.pid === child);
      const record = recordProcess({ run: current, entry: {
        launch_id: String(options.launch ?? ''), role: String(options.role ?? ''), outcome: String(options.outcome ?? ''),
        pid: child, created: row?.created ?? null, command_sha256: row?.commandLine ? sha256(row.commandLine) : null, parent: Number(options.pid),
        exit_code: options['exit-code'] === undefined ? null : Number(options['exit-code']), timeout_s: options.timeout === undefined ? null : Number(options.timeout),
      } });
      print({ result: 'recorded', outcome: record.outcome, identity: record.created ? 'known' : 'unknown' });
      return;
    }
    case 'run-set-app': { const current = held(); setRunApp({ run: current, app: processIdentity(Number(options['app-pid']), defaultProcessTable()), launchId: options.launch ?? null }); print({ result: 'recorded' }); return; }
    case 'run-unaccounted': {
      // Restricting only (moves the run to needs-reconcile): the OS lock, the direct-child relation
      // and the recorded holder pid suffice; the process table is consulted only to complete an
      // identity the wrapper could not read, and its failure never blocks the mark.
      const current = run();
      const holderPid = Number(options.pid);
      if (!lockHeld(current)()) refuse('run_unlocked', 'the run lock is not held; nothing was done.');
      if (process.ppid !== holderPid || current.active?.pid !== holderPid) refuse('run_not_holder', 'custody must be called directly by the wrapper that holds the run lock.');
      const child = options.child === undefined ? null : Number(options.child);
      let created = options.created ?? null;
      let commandSha = options['command-sha256'] ?? null;
      if (Number.isInteger(child) && (!created || !commandSha)) {
        try { const row = defaultProcessTable().find((entry) => entry.pid === child); created = created ?? row?.created ?? null; commandSha = commandSha ?? (row?.commandLine ? sha256(row.commandLine) : null); } catch { /* the identity stays as reported */ }
      }
      const item = markUnaccounted({ run: current, entry: { launch_id: String(options.launch ?? ''), role: String(options.role ?? ''), reason: String(options.reason ?? ''), pid: child, created, command_sha256: commandSha } });
      print({ result: 'needs-reconcile', identity: item.created ? 'known' : 'pid-only' });
      return;
    }
    case 'cli-guarded': {
      // The only path to a destructive local CLI call (db reset, stop): re-verified now, then invoked once.
      const { renderConfig } = await import('./bootstrap.mjs');
      const status = runDestructiveCli({
        prove: held, repoRoot, role: String(options.role ?? ''), renderConfig,
        invoke: (invocation) => { const result = spawnSync(invocation.file, invocation.args, { cwd: invocation.cwd, env: invocation.env, stdio: 'inherit', windowsHide: true }); return result.error ? 1 : (result.status ?? 1); },
      });
      process.exit(status);
      return;
    }
    case 'teardown-check': {
      assertBoundDockerEnv();
      const evidence = teardownEvidence({ run: run(), docker, listeners, processTable: table });
      print(evidence);
      if (!evidence.verified) process.exit(5);
      return;
    }
    case 'down-plan': {
      const current = held();
      const processes = defaultProcessTable();
      const accounted = accountUnaccounted(current, processes);
      if (accounted !== current) STATE_OPS.write(current.run_dir, { ...STATE_OPS.read(current.run_dir), processes: accounted.processes, unaccounted: accounted.unaccounted });
      print(downPlan(accounted, processEvidence(accounted, processes)));
      return;
    }
    case 'run-finalize': {
      const current = held();
      const kind = String(options.kind ?? '');
      let evidence = null;
      if (current.status !== 'releasing') {
        if (kind === 'released') { assertBoundDockerEnv(); evidence = teardownEvidence({ run: current, docker, listeners, processTable: table }); }
        else evidence = processEvidence(current, defaultProcessTable());
      }
      try { print({ result: finalizeRelease({ run: current, kind, evidence }), evidence }); } catch (error) {
        if (error instanceof CustodyError && error.code === 'teardown_unverified') { print({ result: 'kept', evidence }); process.exit(5); }
        throw error;
      }
      return;
    }
    case 'reconcile': {
      // Evidence only: records what is known now. It never stops anything and never clears
      // needs-reconcile; only a verified down (or a never-started release) closes the run.
      const current = held();
      const processes = defaultProcessTable();
      // An unaccounted child is accounted only when evidence proves it absent.
      const accounted = accountUnaccounted(current, processes);
      const report = { at: new Date().toISOString(), status: current.status, ownership: current.ownership?.stack ?? null, interrupted: current.interrupted ?? [], unaccounted: accounted.unaccounted ?? [], ...processEvidence(accounted, processes) };
      try { assertBoundDockerEnv(); report.resources = runDockerResources({ projectId: current.project_id }); report.listeners = listenersOn(runPortList(current.ports)).length; } catch (error) { report.inventory = error instanceof CustodyError ? error.code : 'unknown'; }
      STATE_OPS.write(current.run_dir, { ...STATE_OPS.read(current.run_dir), processes: accounted.processes, unaccounted: accounted.unaccounted, last_reconcile: report });
      print(report);
      return;
    }
    case 'consumed-report': { const current = run(); print(consumedReport(current, readConsumedRecords(current.run_dir))); return; }
    case 'listeners': {
      const ports = String(options.ports ?? '').split(',').map(Number);
      if (!ports.length || ports.some((port) => !Number.isInteger(port))) refuse('bad_request', '--ports a,b');
      print(listenerInventoryResult(ports, listenersOn(ports))); return;
    }
    case 'listener-proof': {
      const current = run();
      const stamp = JSON.parse(fs.readFileSync(path.join(current.run_dir, 'build-stamp.json'), 'utf8'));
      const result = await proveOwnedListener({
        run: current, stamp, listeners, processTable: table,
        git: (dir, gitArgs) => { const out = defaultExec('git', ['-C', dir, ...gitArgs]); return out.status === 0 ? out.stdout.trim() : ''; },
        readBuildId: (dir) => fs.readFileSync(path.join(dir, '.next', 'BUILD_ID'), 'utf8').trim(),
        fetchStatus: async (url) => (await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(10_000) })).status,
      });
      print({ ...result, run_id: current.run_id });
      if (!result.ok) process.exit(4);
      return;
    }
    default: refuse('bad_request', 'usage: see the header of custody.mjs');
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => {
    const code = error instanceof CustodyError ? error.code : 'internal';
    console.error(`[r2-custody] FAIL (${code}): ${error.message}`);
    process.exit(code === 'inventory_failed' ? 2 : 1);
  });
}
