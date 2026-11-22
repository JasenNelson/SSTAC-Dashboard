import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PREVIEW_ACCOUNTS, SIGN_IN_MODE, disposableEmail, newDisposableSignIns, readDisposableSignIns } from '../../../../../scripts/matrix-options/r2-fullstack-bootstrap/accounts.mjs';
import { renderConfig } from '../../../../../scripts/matrix-options/r2-fullstack-bootstrap/bootstrap.mjs';
import {
  BOUND_FIXED_INPUTS,
  CustodyError,
  DESTRUCTIVE_CLI_ROLES,
  LISTENER_INVENTORY_SCHEMA,
  LOCAL_DOCKER_ENDPOINTS,
  SLOT_COUNT,
  STATE_OPS,
  SUPABASE_CLI,
  accountUnaccounted,
  apiDestination,
  assertBoundDockerEnv,
  assertHolder,
  assertRunWorkable,
  bindInputs,
  checkGenerated,
  consumedReport,
  createGuardedSender,
  createRun,
  createRunApiSender,
  daemonLoopbackConfigured,
  defaultProcessTable,
  dockerEnv,
  downPlan,
  finalizeRelease,
  identityAlive,
  listenerInventory,
  listenerInventoryResult,
  lockRun,
  markUnaccounted,
  osLockHeld,
  parseNetstat,
  preflightEvidence,
  processEvidence,
  promoteUnfinishedLaunches,
  proveOwnedListener,
  proveRun,
  readRunStatus,
  recordProcess,
  releaseSlot,
  resolveDockerBinding,
  runDestructiveCli,
  runPortList,
  runResources,
  sameDestination,
  setRunApp,
  teardownEvidence,
  treeDigests,
  unlockRun,
  verifyConsumed,
} from '../../../../../scripts/matrix-options/r2-fullstack-bootstrap/custody.mjs';

// Non-destructive harness for the disposable preview (no Docker, network or real credential).
// Repositories, slot directories, process tables and locks are throwaway fakes; the OS-lock tests use
// a temporary file held by a short-lived local child process.
const SHA = 'a'.repeat(40);
const TREE = 'b'.repeat(40);
const repoRoot = path.resolve(__dirname, '../../../../..');
const read = (relative: string) => fs.readFileSync(path.join(repoRoot, relative), 'utf8');
let tmp = '';
let slotDir = '';
let worktreeA = '';
let worktreeB = '';
beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'r2-preview-'));
  slotDir = path.join(tmp, 'slots');
  worktreeA = path.join(tmp, 'wt-a');
  worktreeB = path.join(tmp, 'wt-b');
});
// Bounded retries: Windows releases a just-stopped child's handles (its working directory and
// redirected logs) shortly after the process is reported gone.
afterEach(async () => {
  for (let attempt = 0; ; attempt += 1) {
    try { fs.rmSync(tmp, { recursive: true, force: true }); return; } catch (error) {
      if (attempt >= 50 || !['EPERM', 'EBUSY', 'ENOTEMPTY'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
});
const code = (fn: () => unknown) => { try { fn(); } catch (error) { return error instanceof CustodyError ? error.code : 'other'; } return 'none'; };
let seq = 0;
const WRAPPER = { pid: 100, created: 't100' };
const newRun = (worktree: string, wrapper = WRAPPER, sha = SHA) =>
  createRun({ repoRoot: worktree, candidateSha: sha, candidateTree: TREE, wrapper, slotDir, random: () => (++seq).toString(16).padStart(8, '0') });
const prove = (worktree: string, runId: string, sha = SHA) => proveRun({ repoRoot: worktree, runId, candidateSha: sha, slotDir });
type Row = { pid: number; created: string | null; parent?: number; commandLine?: string };
const table = (...rows: Row[]) => () => rows;
const held = () => true;
const clean = { docker: () => ({ containers: [], volumes: [] }), listeners: () => [], processTable: table() };
const launchId = (n: number) => n.toString(16).padStart(32, '0');
const state = (run: { run_dir: string }) => STATE_OPS.read(run.run_dir);
/** The wrapper that created the run takes the lock (OS lock held, custody called by it). */
const lockAs = (run: { run_dir: string; run_id: string }, command: string, wrapper = WRAPPER, rows: Row[] = [WRAPPER]) =>
  lockRun({ run, wrapper, command, processTable: table(...rows), lockHeld: held, parentPid: wrapper.pid });
/** A clean preflight, then the stack start intent: the stack is owned by the run. */
const ownStack = (run: { run_dir: string; run_id: string }) => {
  STATE_OPS.write(run.run_dir, { ...state(run), inputs: { files: [], digest: 'x' }, ownership: { stack: 'preflight-empty' } });
  recordProcess({ run, entry: { launch_id: launchId(1), role: 'supabase-start', outcome: 'intent' } });
};

describe('run isolation: every resource derived from a unique run id', () => {
  it('two worktrees running the same SHA get distinct project ids, port blocks and run directories', () => {
    const a = newRun(worktreeA);
    const b = newRun(worktreeB);
    expect(a.run_id).not.toBe(b.run_id);
    expect(a.project_id).not.toBe(b.project_id);
    expect(a.slot).not.toBe(b.slot);
    expect(new Set([...runPortList(a.ports), ...runPortList(b.ports)]).size).toBe(10);
    expect(a.run_dir).not.toBe(b.run_dir);
    expect(code(() => prove(worktreeB, a.run_id))).toBe('run_unknown');
    expect(code(() => prove(worktreeA, b.run_id))).toBe('run_unknown');
  });

  it('two same-SHA runs in ONE worktree are distinct and each needs its own explicit token', () => {
    const first = newRun(worktreeA);
    const second = newRun(worktreeA, { pid: 200, created: 't200' });
    expect(second.project_id).not.toBe(first.project_id);
    expect(prove(worktreeA, first.run_id).project_id).toBe(first.project_id);
    expect(prove(worktreeA, second.run_id).project_id).toBe(second.project_id);
    expect(code(() => prove(worktreeA, ''))).toBe('run_unknown');
  });

  it('derives no fixed name: the project id, containers and ports come only from the run id and slot', () => {
    const resources = runResources(worktreeA, 'r2pv-20261121T000000Z-0a1b2c3d', 3);
    expect(resources).toMatchObject({ projectId: 'sstac-r2pv-0a1b2c3d', dbContainer: 'supabase_db_sstac-r2pv-0a1b2c3d', apiContainer: 'supabase_kong_sstac-r2pv-0a1b2c3d', ports: { shadow: 55530, api: 55531, db: 55532, app: 55535, appInner: 55536 } });
    expect(code(() => runResources(worktreeA, 'not-a-run', 0))).toBe('bad_request');
  });

  it('allocates port blocks atomically and refuses when all are held', () => {
    for (let index = 0; index < SLOT_COUNT; index += 1) newRun(path.join(tmp, `wt-${index}`));
    expect(code(() => newRun(worktreeA))).toBe('slots_full');
  });

  it('a stale or foreign run state never grants authority (the slot must name the same run and worktree)', () => {
    const run = newRun(worktreeA);
    fs.mkdirSync(path.join(worktreeB, '.tmp', 'r2-fullstack', 'runs', run.run_id), { recursive: true });
    fs.copyFileSync(path.join(run.run_dir, 'run.json'), path.join(worktreeB, '.tmp', 'r2-fullstack', 'runs', run.run_id, 'run.json'));
    expect(code(() => prove(worktreeB, run.run_id))).toBe('run_not_owner');
    finalizeRelease({ run, kind: 'never-started', evidence: { liveProcesses: [], unknownProcesses: [] }, slotDir });
    expect(code(() => prove(worktreeA, run.run_id))).toBe('run_not_owner');
    expect(code(() => prove(worktreeA, run.run_id, 'c'.repeat(40)))).toBe('run_not_owner');
    // The closed run's state (and its evidence) stays readable.
    expect(readRunStatus({ repoRoot: worktreeA, runId: run.run_id, candidateSha: SHA })).toMatchObject({ status: 'released', phase: 'never-started' });
  });
});

describe('OS-backed lock and holder records', () => {
  it('the creating wrapper holds the run; a second live wrapper is refused', () => {
    const run = newRun(worktreeA);
    expect(state(run).active).toMatchObject({ pid: 100, created: 't100', command: 'up' });
    const both: Row[] = [WRAPPER, { pid: 200, created: 't200' }];
    expect(code(() => lockAs(run, 'seed', { pid: 200, created: 't200' }, both))).toBe('run_busy');
    expect(code(() => lockAs(run, 'seed'))).toBe('none');
  });

  it('refuses unless the OS lock is held and custody is the holder\'s direct child', () => {
    const run = newRun(worktreeA);
    expect(code(() => lockRun({ run, wrapper: WRAPPER, command: 'seed', processTable: table(WRAPPER), lockHeld: () => false, parentPid: 100 }))).toBe('run_unlocked');
    expect(code(() => lockRun({ run, wrapper: WRAPPER, command: 'seed', processTable: table(WRAPPER), lockHeld: held, parentPid: 4242 }))).toBe('run_not_holder');
    expect(code(() => assertHolder({ state: state(run), wrapper: { pid: 200, created: 't200' }, lockHeld: held, parentPid: 200 }))).toBe('run_not_holder');
    expect(code(() => assertHolder({ state: state(run), wrapper: WRAPPER, lockHeld: held, parentPid: 100 }))).toBe('none');
  });

  it('crash: a dead holder means an interrupted command; the run needs reconciliation and accepts only down and reconcile', () => {
    const run = newRun(worktreeA);
    const next = { pid: 300, created: 't300' };
    // The first wrapper is gone (the OS released its lock); a new wrapper got the lock.
    expect(code(() => lockAs(run, 'seed', next, [next]))).toBe('needs_reconcile');
    expect(state(run)).toMatchObject({ status: 'needs-reconcile', active: null, interrupted: [expect.objectContaining({ pid: 100, command: 'up', detected_by: 'seed' })] });
    for (const command of ['build', 'start', 'accept', 'up']) expect(code(() => lockAs(run, command, next, [next])), command).toBe('needs_reconcile');
    expect(code(() => lockAs(run, 'reconcile', next, [next]))).toBe('none');
    unlockRun({ run, wrapper: next, lockHeld: held, parentPid: 300 });
    expect(code(() => lockAs(run, 'down', next, [next]))).toBe('none');
  });

  it('PID reuse: the recorded holder\'s pid alive with another creation time is a different process', () => {
    const run = newRun(worktreeA);
    const next = { pid: 300, created: 't300' };
    expect(code(() => lockAs(run, 'down', next, [{ pid: 100, created: 'reused-later' }, next]))).toBe('none');
    expect(state(run).interrupted).toEqual([expect.objectContaining({ pid: 100, created: 't100' })]);
    expect(identityAlive({ pid: 5, created: 'a' }, [{ pid: 5, created: 'b' }])).toBe(false);
    expect(identityAlive({ pid: 5, created: 'a', command_sha256: 'x'.repeat(64) }, [{ pid: 5, created: 'a', commandLine: 'other' }])).toBe(false);
    expect(identityAlive({ pid: 5, created: 'a' }, [{ pid: 5, created: 'a' }])).toBe(true);
    expect(code(() => identityAlive({ pid: 5, created: 'a' }, [{ pid: 5, created: null }]))).toBe('process_unknown');
  });

  it('unknown ownership blocks new work: up refuses while a run of the worktree needs reconciliation, and bootstrap refuses it', () => {
    const run = newRun(worktreeA);
    recordProcess({ run, entry: { launch_id: launchId(9), role: 'bootstrap-prepare', outcome: 'intent' } });
    recordProcess({ run, entry: { launch_id: launchId(9), role: 'bootstrap-prepare', outcome: 'running', pid: 9, created: 'c9' } });
    recordProcess({ run, entry: { launch_id: launchId(9), role: 'bootstrap-prepare', outcome: 'timeout', pid: 9 } });
    expect(state(run).status).toBe('needs-reconcile');
    expect(code(() => newRun(worktreeA, { pid: 200, created: 't200' }))).toBe('needs_reconcile');
    expect(code(() => assertRunWorkable(state(run), [WRAPPER]))).toBe('needs_reconcile');
    // An open run whose holder died (not yet detected) also blocks a new run when the table is known.
    const other = newRun(worktreeB);
    expect(code(() => createRun({ repoRoot: worktreeB, candidateSha: SHA, candidateTree: TREE, wrapper: { pid: 200, created: 't200' }, slotDir, processTable: table({ pid: 200, created: 't200' }) }))).toBe('needs_reconcile');
    expect(other.status).toBe('created');
  });

  it('unlock clears only this wrapper\'s holder record (the OS handle is closed after that)', () => {
    const run = newRun(worktreeA);
    expect(code(() => unlockRun({ run, wrapper: { pid: 200, created: 't200' }, lockHeld: held, parentPid: 200 }))).toBe('run_not_holder');
    expect(unlockRun({ run, wrapper: WRAPPER, lockHeld: held, parentPid: 100 })).toBe('unlocked');
    expect(state(run).active).toBeNull();
    expect(code(() => unlockRun({ run, wrapper: WRAPPER, lockHeld: () => false, parentPid: 100 }))).toBe('run_unlocked');
  });

  describe.skipIf(process.platform !== 'win32')('the real Windows OS lock (stale lock recovered by the OS)', () => {
    const children: ChildProcess[] = [];
    afterEach(() => { for (const child of children.splice(0)) child.kill(); });
    const holdWith = async (command: string, args: string[]) => {
      const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });
      children.push(child);
      await new Promise<void>((resolve, reject) => {
        child.stdout!.on('data', (chunk: Buffer) => { if (chunk.toString().includes('HELD')) resolve(); });
        child.on('exit', () => reject(new Error('holder exited early')));
        setTimeout(() => reject(new Error('holder did not start')), 20_000);
      });
      return child;
    };
    const waitFree = async (file: string) => { for (let index = 0; index < 50 && osLockHeld(file); index += 1) await new Promise((resolve) => setTimeout(resolve, 100)); };

    it('a live no-sharing handle is held; after the holder is killed the OS frees it', async () => {
      const file = path.join(tmp, 'wrapper.lock');
      expect(osLockHeld(file)).toBe(false);
      const child = await holdWith(process.execPath, ['-e', `const fs=require('fs');fs.openSync(${JSON.stringify(file)}, fs.constants.O_RDWR|fs.constants.O_CREAT|0x10000000);console.log('HELD');setInterval(()=>{},1000);`]);
      expect(osLockHeld(file)).toBe(true);
      child.kill();
      await waitFree(file);
      expect(osLockHeld(file)).toBe(false);
    }, 30_000);

    it('the wrapper\'s PowerShell handle (FileShare None) is seen as held', async () => {
      const file = path.join(tmp, 'wrapper.lock');
      const script = `$s = [System.IO.File]::Open('${file.replace(/'/g, "''")}', 'OpenOrCreate', 'ReadWrite', 'None'); Write-Output HELD; Start-Sleep -Seconds 60`;
      const child = await holdWith('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script]);
      expect(osLockHeld(file)).toBe(true);
      child.kill();
      await waitFree(file);
      expect(osLockHeld(file)).toBe(false);
    }, 40_000);
  });

  it('a probe that cannot decide fails closed', () => {
    const open = () => { const error = new Error('denied') as NodeJS.ErrnoException; error.code = 'EACCES'; throw error; };
    expect(code(() => osLockHeld('x', { open, platform: 'win32' }))).toBe('lock_unknown');
    expect(code(() => osLockHeld('x', { platform: 'linux' }))).toBe('unsupported');
  });
});

describe('launch intent, full child identity and stack ownership', () => {
  it('records the intent before the child, then its identity, and never loses the identity', () => {
    const run = newRun(worktreeA);
    recordProcess({ run, entry: { launch_id: launchId(2), role: 'bootstrap-prepare', outcome: 'intent', timeout_s: 120 } });
    expect(state(run).processes).toEqual([expect.objectContaining({ role: 'bootstrap-prepare', outcome: 'intent', pid: null, created: null })]);
    recordProcess({ run, entry: { launch_id: launchId(2), role: 'bootstrap-prepare', outcome: 'running', pid: 77, created: 'c77', command_sha256: 'f'.repeat(64) } });
    // The exit record comes after the child is gone (no table row): the identity first seen is kept.
    recordProcess({ run, entry: { launch_id: launchId(2), role: 'bootstrap-prepare', outcome: 'exited', pid: 77, created: null, exit_code: 0 } });
    expect(state(run).processes).toEqual([expect.objectContaining({ outcome: 'exited', pid: 77, created: 'c77', command_sha256: 'f'.repeat(64), exit_code: 0 })]);
    expect(code(() => recordProcess({ run, entry: { launch_id: launchId(3), role: 'bootstrap-env', outcome: 'running', pid: 1, created: 'c' } }))).toBe('bad_request');
  });

  it('the stack is owned only through a start intent after a clean preflight; stack roles are refused otherwise', () => {
    const run = newRun(worktreeA);
    expect(code(() => recordProcess({ run, entry: { launch_id: launchId(1), role: 'supabase-start', outcome: 'intent' } }))).toBe('ownership_unproven');
    for (const role of ['supabase-stop', 'supabase-db-reset', 'bootstrap-seed', 'app']) expect(code(() => recordProcess({ run, entry: { launch_id: launchId(5), role, outcome: 'intent' } })), role).toBe('ownership_unproven');
    ownStack(run);
    expect(state(run).ownership).toMatchObject({ stack: 'owned', owned_by_launch: launchId(1) });
    expect(code(() => recordProcess({ run, entry: { launch_id: launchId(6), role: 'supabase-stop', outcome: 'intent' } }))).toBe('none');
  });

  it('an unknown child (intent without identity, or running without a creation time) keeps teardown unverified', () => {
    const run = newRun(worktreeA);
    ownStack(run);
    expect(teardownEvidence({ run: prove(worktreeA, run.run_id), ...clean })).toMatchObject({ verified: false, unknownProcesses: ['supabase-start'] });
    recordProcess({ run, entry: { launch_id: launchId(1), role: 'supabase-start', outcome: 'running', pid: 50, created: null } });
    expect(teardownEvidence({ run: prove(worktreeA, run.run_id), ...clean })).toMatchObject({ verified: false, unknownProcesses: ['supabase-start'] });
    recordProcess({ run, entry: { launch_id: launchId(1), role: 'supabase-start', outcome: 'exited', pid: 50, exit_code: 0 } });
    expect(teardownEvidence({ run: prove(worktreeA, run.run_id), ...clean }).verified).toBe(true);
  });

  it('a timed-out child marks the run for reconciliation and keeps custody', () => {
    const run = newRun(worktreeA);
    ownStack(run);
    recordProcess({ run, entry: { launch_id: launchId(1), role: 'supabase-start', outcome: 'running', pid: 4242, created: 'c4242' } });
    recordProcess({ run, entry: { launch_id: launchId(1), role: 'supabase-start', outcome: 'timeout', pid: 4242, timeout_s: 900 } });
    const current = prove(worktreeA, run.run_id);
    expect(current.status).toBe('needs-reconcile');
    const evidence = teardownEvidence({ run: current, ...clean, processTable: table({ pid: 4242, created: 'c4242' }) });
    expect(evidence).toMatchObject({ verified: false, liveProcesses: ['supabase-start'] });
    expect(code(() => finalizeRelease({ run: current, kind: 'released', evidence, slotDir }))).toBe('teardown_unverified');
    expect(prove(worktreeA, run.run_id).run_id).toBe(run.run_id);
  });

  it('the recorded app tree must be gone before teardown is verified', () => {
    const run = newRun(worktreeA);
    ownStack(run);
    recordProcess({ run, entry: { launch_id: launchId(1), role: 'supabase-start', outcome: 'exited', pid: 1, created: 'c1' } });
    recordProcess({ run, entry: { launch_id: launchId(7), role: 'app', outcome: 'intent' } });
    setRunApp({ run, app: { pid: 500, created: 'app' }, launchId: launchId(7) });
    const current = prove(worktreeA, run.run_id);
    expect(current.processes.find((item: { role: string }) => item.role === 'app')).toMatchObject({ outcome: 'running', pid: 500, created: 'app' });
    expect(teardownEvidence({ run: current, ...clean, processTable: table({ pid: 500, created: 'app' }) }).verified).toBe(false);
    expect(teardownEvidence({ run: current, ...clean }).verified).toBe(true);
  });

  it.each([
    ['a container of the run', { docker: () => ({ containers: ['supabase_db_x'], volumes: [] }) }, 'containers'],
    ['a volume of the run', { docker: () => ({ containers: [], volumes: ['supabase_db_x'] }) }, 'volumes'],
    ['a listener on a run port', { listeners: () => [{ address: '127.0.0.1', port: 55501, pid: 1, family: 'ipv4' }] }, 'listeners'],
  ])('teardown stays unverified while %s remains', (_label, patch, field) => {
    const run = newRun(worktreeA);
    const evidence = teardownEvidence({ run, ...clean, ...patch });
    expect(evidence.verified).toBe(false);
    expect((evidence as Record<string, unknown>)[field]).toBe(1);
  });

  it('teardown inspects only the run\'s own project and ports; any unknown probe fails closed', () => {
    const run = newRun(worktreeA);
    const docker = vi.fn(() => ({ containers: [], volumes: [] }));
    const listeners = vi.fn(() => []);
    teardownEvidence({ run, docker, listeners, processTable: table() });
    expect(docker).toHaveBeenCalledWith(run.project_id);
    expect(listeners).toHaveBeenCalledWith(runPortList(run.ports));
    const failing = () => { throw new CustodyError('inventory_failed', 'x'); };
    expect(code(() => teardownEvidence({ run, ...clean, listeners: failing }))).toBe('inventory_failed');
    expect(code(() => teardownEvidence({ run, ...clean, docker: failing }))).toBe('inventory_failed');
  });
});

describe('ownership-safe refusal and down', () => {
  it('preflight finding a pre-existing listener persists a terminal refusal and releases only the reservation', () => {
    const run = newRun(worktreeA);
    const foreign = { address: '127.0.0.1', port: run.ports.api, pid: 999, family: 'ipv4' };
    const docker = vi.fn(() => ({ containers: [], volumes: [] }));
    const evidence = preflightEvidence({ run, docker, listeners: () => [foreign] });
    expect(evidence).toMatchObject({ empty: false, listeners: [foreign] });
    STATE_OPS.write(run.run_dir, { ...state(run), ownership: { stack: 'foreign', preflight: evidence } });
    expect(finalizeRelease({ run, kind: 'refused', evidence: { ...processEvidence(state(run), []), preexisting: evidence }, slotDir })).toBe('refused');
    expect(state(run)).toMatchObject({ status: 'refused', phase: 'never-started', active: null, ownership: { stack: 'foreign', preflight: { listeners: [foreign] } }, release: { kind: 'refused', evidence: { preexisting: { listeners: [foreign] } } } });
    expect(fs.existsSync(path.join(slotDir, `slot-${run.slot}.json`))).toBe(false);
    // Inventory only: nothing was asked to stop, reset or remove anything.
    expect(docker).toHaveBeenCalledTimes(1);
    // The refused run can no longer be acted on, and a stack start is refused for it.
    expect(code(() => lockAs(run, 'down'))).toBe('run_closed');
    expect(code(() => recordProcess({ run, entry: { launch_id: launchId(1), role: 'supabase-start', outcome: 'intent' } }))).toBe('ownership_unproven');
  });

  it.each([
    ['a container', { containers: ['supabase_db_x'], volumes: [] }, []],
    ['a volume', { containers: [], volumes: ['supabase_db_x'] }, []],
  ])('preflight refuses %s of the run\'s project', (_label, resources, busy) => {
    const run = newRun(worktreeA);
    expect(preflightEvidence({ run, docker: () => resources, listeners: () => busy }).empty).toBe(false);
  });

  it('down stops a stack only when the run owns it', () => {
    const run = newRun(worktreeA);
    const none = { liveProcesses: [], unknownProcesses: [] };
    expect(downPlan(state(run), none)).toEqual({ action: 'release-never-started', stack: 'none', app: 'none' });
    ownStack(run);
    expect(downPlan(state(run), none)).toMatchObject({ action: 'teardown', stack: 'stop' });
  });

  it('down refuses (keeps everything) when a never-started run has a live or unknown recorded process', () => {
    const run = newRun(worktreeA);
    expect(code(() => downPlan(state(run), { liveProcesses: ['bootstrap-prepare'], unknownProcesses: [] }))).toBe('ownership_unknown');
    expect(code(() => downPlan(state(run), { liveProcesses: [], unknownProcesses: ['bootstrap-prepare'] }))).toBe('ownership_unknown');
    expect(code(() => finalizeRelease({ run, kind: 'never-started', evidence: { liveProcesses: [], unknownProcesses: ['bootstrap-prepare'] }, slotDir }))).toBe('ownership_unknown');
    expect(fs.existsSync(path.join(slotDir, `slot-${run.slot}.json`))).toBe(true);
  });

  it('a run that launched resources is never released as never-started', () => {
    const run = newRun(worktreeA);
    ownStack(run);
    expect(code(() => finalizeRelease({ run, kind: 'never-started', evidence: { liveProcesses: [], unknownProcesses: [] }, slotDir }))).toBe('ownership_unknown');
  });
});

describe('terminal release: one journaled transition', () => {
  const failing = (step: 'write1' | 'rename' | 'write2') => {
    let writes = 0;
    return {
      ...STATE_OPS,
      write: (dir: string, value: unknown) => { writes += 1; if ((step === 'write1' && writes === 1) || (step === 'write2' && writes === 2)) throw new Error('disk full'); STATE_OPS.write(dir, value); },
      rename: (from: string, to: string) => { if (step === 'rename') throw new Error('rename failed'); STATE_OPS.rename(from, to); },
    };
  };
  const slotHeld = (run: { slot: number; run_id: string }) => STATE_OPS.readSlot(path.join(slotDir, `slot-${run.slot}.json`))?.run_id === run.run_id;
  const verified = { verified: true, liveProcesses: [], unknownProcesses: [] };

  it('releases the port block only after verified teardown, then a new run may use it', () => {
    const run = newRun(worktreeA);
    expect(code(() => releaseSlot({ run, slotDir, evidence: { verified: false } }))).toBe('teardown_unverified');
    expect(releaseSlot({ run, slotDir, evidence: teardownEvidence({ run, ...clean }) })).toBe('released');
    expect(state(run)).toMatchObject({ status: 'released', phase: 'torn-down', active: null });
    const next = newRun(worktreeB);
    expect(next.slot).toBe(run.slot);
    expect(next.project_id).not.toBe(run.project_id);
  });

  it.each(['write1', 'rename', 'write2'] as const)('an interruption at %s never publishes a release while the slot is held, and down completes it', (step) => {
    const run = newRun(worktreeA);
    expect(() => finalizeRelease({ run, kind: 'released', evidence: verified, slotDir, ops: failing(step) })).toThrow();
    const after = state(run);
    // Invariants at every boundary.
    expect(TERMINAL(after.status) && slotHeld(run)).toBe(false);
    if (TERMINAL(after.status)) expect(after.active).toBeNull();
    if (step === 'write1') { expect(after.status).toBe('created'); expect(slotHeld(run)).toBe(true); }
    else expect(after.status).toBe('releasing');
    // The wrapper's unlock (holder cleared) still works on an interrupted release.
    unlockRun({ run: prove(worktreeA, run.run_id), wrapper: WRAPPER, lockHeld: held, parentPid: 100 });
    expect(state(run).active).toBeNull();
    if (step === 'write1') return;
    // Only down or reconcile may continue it; down's plan resumes the journaled release.
    const next = { pid: 300, created: 't300' };
    expect(code(() => lockAs(prove(worktreeA, run.run_id), 'seed', next, [next]))).toBe('needs_reconcile');
    const locked = lockAs(prove(worktreeA, run.run_id), 'down', next, [next]);
    expect(downPlan(locked, { liveProcesses: [], unknownProcesses: [] })).toMatchObject({ action: 'resume-release', kind: 'released' });
    expect(finalizeRelease({ run: prove(worktreeA, run.run_id), kind: 'released', evidence: null, slotDir })).toBe('released');
    expect(state(run)).toMatchObject({ status: 'released', active: null });
    expect(slotHeld(run)).toBe(false);
    expect(code(() => finalizeRelease({ run, kind: 'never-started', evidence: verified, slotDir }))).toBe('run_closed');
  });

  it('a resumed release must keep its journaled kind', () => {
    const run = newRun(worktreeA);
    expect(() => finalizeRelease({ run, kind: 'released', evidence: verified, slotDir, ops: failing('rename') })).toThrow();
    expect(code(() => finalizeRelease({ run: prove(worktreeA, run.run_id), kind: 'never-started', evidence: verified, slotDir }))).toBe('release_conflict');
  });
});
const TERMINAL = (status: string) => status === 'released' || status === 'refused';

describe('inputs bound to the candidate', () => {
  const manifest = { migrations: [{ source: 'm1.sql' }], postStart: [{ source: 'p1.sql' }], parity: { query: 'q.sql', baseline: 'b.json' } };
  const files: Record<string, string> = { m1: 'migration', p1: 'post', q: 'query', b: '{}' };
  const readFile = (file: string) => {
    const base = path.basename(file);
    if (base === 'manifest.json') return Buffer.from(JSON.stringify(manifest));
    const key = base.replace(/\.(sql|json)$/, '');
    return Buffer.from(files[key] ?? `fixed:${base}`);
  };
  const git = (override: Record<string, string> = {}) => ({
    committedBlobs: (_sha: string, paths: string[]) => Object.fromEntries(paths.map((item) => [item, `blob-${item}`])),
    workingBlobs: (paths: string[]) => Object.fromEntries(paths.map((item) => [item, override[item] ?? `blob-${item}`])),
  });

  it('binds path, bytes and SHA-256 of every input; a committed candidate also needs equal git blobs', () => {
    const binding = bindInputs({ repoRoot: tmp, candidateSha: SHA, readFile, git: git() });
    expect(binding.files.map((file: { path: string }) => file.path)).toEqual([...BOUND_FIXED_INPUTS, 'm1.sql', 'p1.sql', 'q.sql', 'b.json']);
    expect(binding.files[BOUND_FIXED_INPUTS.length]).toMatchObject({ path: 'm1.sql', bytes: 9, sha256: createHash('sha256').update('migration').digest('hex'), git_blob: 'blob-m1.sql' });
    expect(code(() => bindInputs({ repoRoot: tmp, candidateSha: SHA, readFile, git: git({ 'q.sql': 'blob-local-edit' }) }))).toBe('input_mismatch');
    expect(bindInputs({ repoRoot: tmp, candidateSha: 'inner-loop', readFile }).inner_loop).toBe(true);
  });

  it('refuses a post-check substitution: consumed bytes must be the bound bytes', () => {
    const binding = bindInputs({ repoRoot: tmp, candidateSha: 'inner-loop', readFile });
    expect(verifyConsumed(binding, 'm1.sql', Buffer.from('migration'))).toMatchObject({ path: 'm1.sql', bytes: 9 });
    expect(code(() => verifyConsumed(binding, 'm1.sql', Buffer.from('migratioN')))).toBe('input_substituted');
    expect(code(() => verifyConsumed(binding, 'other.sql', Buffer.from('x')))).toBe('input_unbound');
  });

  it('the generated bundle must be exactly what prepare recorded; the receipt reports only consumed digests that match the binding', () => {
    const recorded = [{ path: 'config.toml', bytes: 3, sha256: 'a'.repeat(64) }];
    expect(checkGenerated(recorded, [...recorded])).toBe(true);
    expect(code(() => checkGenerated(recorded, [{ ...recorded[0], sha256: 'b'.repeat(64) }]))).toBe('input_substituted');
    expect(code(() => checkGenerated(recorded, [...recorded, { path: 'migrations/extra.sql', bytes: 1, sha256: 'c'.repeat(64) }]))).toBe('input_substituted');
    const binding = bindInputs({ repoRoot: tmp, candidateSha: 'inner-loop', readFile });
    const run = { run_id: 'r2pv-20261121T000000Z-0a1b2c3d', inputs: binding };
    const record = { run_id: run.run_id, command: 'prepare', files: [verifyConsumed(binding, 'm1.sql', Buffer.from('migration'))] };
    expect(consumedReport(run, [record])).toMatchObject({ binding_digest: binding.digest, consumed: [record] });
    expect(code(() => consumedReport(run, [{ ...record, files: [{ path: 'm1.sql', bytes: 9, sha256: 'd'.repeat(64) }] }]))).toBe('input_substituted');
    expect(code(() => consumedReport(run, [{ ...record, run_id: 'r2pv-20261121T000000Z-ffffffff' }]))).toBe('input_unbound');
  });

  it('binds the real manifest inputs of this repository', () => {
    const binding = bindInputs({ repoRoot, candidateSha: 'inner-loop' });
    const manifestFile = JSON.parse(read('scripts/matrix-options/r2-fullstack-bootstrap/manifest.json'));
    for (const step of [...manifestFile.migrations, ...manifestFile.postStart]) {
      expect(binding.files.find((file: { path: string }) => file.path === step.source)?.sha256, step.source).toBe(step.sha256);
    }
  });
});

describe('last-moment API destination verification', () => {
  const RUN = { run_id: 'r2pv-20261121T000000Z-0a1b2c3d', project_id: 'sstac-r2pv-0a1b2c3d', ports: { api: 55531 } };
  const container = (patch: Record<string, unknown> = {}) => ({ Name: '/supabase_kong_sstac-r2pv-0a1b2c3d', Id: 'e'.repeat(64), State: { Running: true, StartedAt: '2026-11-21T00:00:00Z' }, NetworkSettings: { Ports: { '8000/tcp': [{ HostIp: '127.0.0.1', HostPort: '55531' }] } }, ...patch });
  const proof = (inspect = () => container(), listeners = () => [{ address: '127.0.0.1', port: 55531, pid: 700 }], rows: Row[] = [{ pid: 700, created: 'docker' }]) =>
    () => apiDestination({ run: RUN, inspect, listeners, processTable: table(...rows) });

  it('proves the run\'s own container, published loopback port and listener identity', () => {
    expect(proof()()).toEqual({ url: 'http://127.0.0.1:55531', container: 'supabase_kong_sstac-r2pv-0a1b2c3d', containerId: 'e'.repeat(64), startedAt: '2026-11-21T00:00:00Z', hostIp: '127.0.0.1', hostPort: 55531, listenerPid: 700, listenerCreated: 'docker' });
    expect(code(proof(() => container({ NetworkSettings: { Ports: { '8000/tcp': [{ HostIp: '0.0.0.0', HostPort: '55531' }] } } })))).toBe('destination_unknown');
    expect(code(proof(() => container({ Name: '/supabase_kong_other' })))).toBe('destination_unknown');
    expect(code(proof(undefined, () => [{ address: '0.0.0.0', port: 55531, pid: 700 }]))).toBe('destination_unknown');
  });

  it.each([
    ['another container on the port', () => proof(() => container({ Id: 'f'.repeat(64) }))],
    ['a restarted container', () => proof(() => container({ State: { Running: true, StartedAt: '2026-11-21T01:00:00Z' } }))],
    ['another listener process', () => proof(undefined, () => [{ address: '127.0.0.1', port: 55531, pid: 701 }], [{ pid: 701, created: 'other' }])],
    ['a reused listener pid', () => proof(undefined, undefined, [{ pid: 700, created: 'reused' }])],
  ])('stops before the send when the destination changes between discovery and send: %s', async (_label, changed) => {
    const send = vi.fn(async () => new Response('{}', { status: 200 }));
    let current = proof();
    const sender = createGuardedSender({ initial: proof()(), prove: () => current(), send });
    expect((await sender('/auth/v1/admin/users', { method: 'POST' })).status).toBe(200);
    expect(send).toHaveBeenCalledTimes(1);
    current = changed();
    await expect(sender('/auth/v1/admin/users', { method: 'POST' })).rejects.toMatchObject({ code: 'destination_changed' });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('refuses redirects and requests that would leave the proven origin', async () => {
    const send = vi.fn(async (_url: string, init: RequestInit) => { expect(init.redirect).toBe('manual'); return new Response(null, { status: 307, headers: { location: 'http://example.test/' } }); });
    const sender = createGuardedSender({ initial: proof()(), prove: proof(), send });
    await expect(sender('/storage/v1/object/x', { method: 'POST' })).rejects.toMatchObject({ code: 'redirected' });
    await expect(sender('//example.test/x', {})).rejects.toMatchObject({ code: 'bad_request' });
    expect(sameDestination(proof()(), { ...proof()(), hostPort: 55532 })).toBe(false);
  });

  it('the bootstrap sends account creation and private uploads only through the guarded sender', () => {
    const bootstrap = read('scripts/matrix-options/r2-fullstack-bootstrap/bootstrap.mjs');
    expect(bootstrap.match(/fetch\(/g)).toHaveLength(1);
    expect(bootstrap).toContain('createGuardedSender({ initial, prove: proveDestination, send: (url, init) => fetch(url, init) })');
    for (const call of ["await send('/auth/v1/admin/users'", 'await send(`/storage/v1/object/', 'await send(`/auth/v1/admin/users/${value}`']) expect(bootstrap, call).toContain(call);
  });
});

describe('wrapper contract (static)', () => {
  const ps1 = read('scripts/matrix-options/r2-fullstack-preview.ps1');
  const section = (from: string, to: string) => ps1.slice(ps1.indexOf(from), ps1.indexOf(to));
  it('takes authority only from an explicit -RunId and never from a file', () => {
    expect(ps1).not.toMatch(/run\.json/);
    expect(ps1).toContain("Stop-WithError \"-RunId (the exact id printed by this session's up) is required for $Name; nothing was touched\"");
    for (const command of ['seed', 'build', 'start', 'down', 'accept', 'reconcile']) expect(ps1, command).toContain(`Enter-Run '${command}'`);
    expect(ps1).toContain("Write-Host \"R2_PREVIEW_RUN_ID=$($script:run.run_id)\"");
  });

  it('documents the owner launcher contract: no automatic down, explicit token, disposable sign-ins only', () => {
    expect(ps1).toContain('never call `down` (or any stop) automatically, at start or otherwise;');
    expect(ps1).toContain('later seed, build, start, accept, status and down call of the same session;');
    expect(ps1).toContain('show the owner only the disposable local sign-ins that `start` prints.');
  });

  it('has no real-credential mode, no fixed resources and no LAN-exposure override', () => {
    for (const text of [ps1, read('scripts/matrix-options/r2-fullstack-bootstrap/bootstrap.mjs'), read('scripts/matrix-options/r2-fullstack-bootstrap/accounts.mjs'), read('e2e/matrix-options-paper-r2-fullstack.spec.ts')]) {
      expect(text).not.toMatch(/\.env\.local'|readFileSync\([^)]*\.env|E2E_TEST|CANARY_READER_B|E2E_ADMIN|previewAccountCredentials|existing-accounts|local-stand-ins|AllowLanExposure/);
      expect(text).not.toMatch(/sstac-r2-preview['"]|supabase_db_sstac-r2-preview|55420|55421|55422|3210/);
    }
    expect(read('scripts/matrix-options/r2-fullstack-bootstrap/config.toml')).not.toMatch(/project_id = "sstac-r2-preview"|port = 5542/);
  });

  it('runs every long child bounded, records the launch intent BEFORE the child exists, and keeps the run on timeout', () => {
    const bounded = section('function Invoke-Bounded', 'function Invoke-Node');
    for (const fragment of ["'--outcome', 'intent'", "'--outcome', 'running'", "'--outcome', 'launch-failed'", '$process.WaitForExit(5000)', "Write-Heartbeat 'running'", '& taskkill /PID $process.Id /T /F', "'--outcome', 'timeout'", "throw \"TIMEOUT:"]) expect(bounded, fragment).toContain(fragment);
    expect(bounded.indexOf("'--outcome', 'intent'")).toBeLessThan(bounded.indexOf('Start-Process'));
    for (const child of ["Invoke-SupabaseCli 'supabase-start'", "Invoke-DestructiveCli 'supabase-db-reset'", "Invoke-DestructiveCli 'supabase-stop'", "Invoke-Bounded 'monitored-build'", "Invoke-Bounded 'journey'", "Invoke-Node 'bootstrap-seed'"]) expect(ps1, child).toContain(child);
    const up = section("  'up' {", "  'seed' {");
    expect(up).toContain("if ($original -match '^(TIMEOUT|REFUSED|UNACCOUNTED):') { Exit-Run; Stop-WithError $original }");
    const start = section("  'start' {", "  'status' {");
    expect(start.indexOf("'--role', 'app', '--outcome', 'intent'")).toBeLessThan(start.indexOf('Invoke-CimMethod -ClassName Win32_Process'));
  });

  it('binds inputs, proves an empty run before the first stack start, and refuses (never stops) on anything pre-existing', () => {
    const up = section("  'up' {", "  'seed' {");
    const order = ["'daemon-loopback'", "'run-new'", 'Lock-RunHandle', "'run-lock'", "'run-bind'", "'bootstrap-prepare'", "'preflight'", "'generated-check'", "'supabase-start'", "'bootstrap-ports'", "'supabase-db-reset'"];
    expect(order.every((fragment) => up.includes(fragment))).toBe(true);
    expect(up.indexOf('Use-DockerBinding')).toBeLessThan(up.indexOf("'daemon-loopback'"));
    for (let index = 1; index < order.length; index += 1) expect(up.indexOf(order[index - 1]), order[index]).toBeLessThan(up.indexOf(order[index]));
    // The refusal path closes nothing it does not own: it is terminal before the catch and only unlocks.
    expect(up).toContain("if ($pre.code -eq 6) { Set-RunTerminal; throw \"REFUSED:");
    expect(up).toContain("if ($state.ownership.stack -eq 'owned') { Close-RunVerified $original }");
    expect(up).toContain('else { Close-RunNeverStarted $original }');
  });

  it('down acts only from custody\'s ownership plan', () => {
    const down = section("  'down' {", "  'accept' {");
    expect(down).toContain("Invoke-Custody (@('down-plan') + (Get-OwnerArgs))");
    expect(down.indexOf("'teardown'")).toBeLessThan(down.indexOf("Close-RunVerified 'down'"));
    expect(down).toContain("'release-never-started' { Close-RunNeverStarted 'down' }");
    expect(down).not.toMatch(/Invoke-SupabaseCli/);
    const close = section('function Close-RunVerified', 'function Close-RunNeverStarted');
    expect(close.indexOf("'supabase-stop'")).toBeLessThan(close.indexOf('teardown-check'));
    expect(close.indexOf('teardown-check')).toBeLessThan(close.indexOf("'run-finalize'"));
    expect(close).toContain('the run and its port block are kept');
  });

  it('closes the OS handle only after the holder record is cleared', () => {
    const exit = section('function Exit-Run', 'function Set-RunTerminal');
    expect(exit.indexOf("Invoke-Custody (@('run-unlock')")).toBeLessThan(exit.lastIndexOf('Unlock-RunHandle'));
    expect(ps1).toContain("[System.IO.File]::Open($path, [System.IO.FileMode]::OpenOrCreate, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)");
    const enter = section('function Enter-Run', 'function Exit-Run');
    expect(enter.indexOf('Lock-RunHandle')).toBeLessThan(enter.indexOf("'run-lock'"));
  });

  it('the receipt records consumed digests, not digests computed at receipt time', () => {
    const accept = section("  'accept' {", "if ($journeyExit -ne 0) { exit 1 }");
    expect(accept).toContain("'consumed-report'");
    expect(accept).toContain('inputs = $consumed');
    expect(accept).not.toMatch(/Get-FileHash/);
    expect(accept.indexOf("'inputs-check'")).toBeLessThan(accept.indexOf("Invoke-Bounded 'journey'"));
  });
});

describe('disposable identities', () => {
  const RUN = 'r2pv-20261121T000000Z-0a1b2c3d';
  it('creates three fresh run-scoped local accounts with new random passwords', () => {
    const first = newDisposableSignIns(RUN);
    const second = newDisposableSignIns(RUN);
    expect(first.map((user) => user.key)).toEqual(PREVIEW_ACCOUNTS.map((account) => account.key));
    expect(first.map((user) => user.email)).toEqual(['reviewer-a-0a1b2c3d@r2-preview.local', 'reviewer-b-0a1b2c3d@r2-preview.local', 'admin-0a1b2c3d@r2-preview.local']);
    expect(first.every((user, index) => user.password !== second[index].password && user.password.length >= 16)).toBe(true);
  });

  const valid = () => ({ mode: SIGN_IN_MODE, run_id: RUN, users: newDisposableSignIns(RUN).map((user, index) => ({ ...user, id: `1111111${index}-1111-4111-8111-111111111111` })) });
  it('accepts only the exact disposable state of this run', () => {
    expect(readDisposableSignIns(valid(), RUN)).toHaveLength(3);
  });
  it.each([
    ['another mode', { ...valid(), mode: 'existing-accounts' }],
    ['another run', { ...valid(), run_id: 'r2pv-20261121T000000Z-ffffffff' }],
    ['a missing account', { ...valid(), users: valid().users.slice(0, 2) }],
    ['a non-local email', { ...valid(), users: valid().users.map((user, index) => (index === 0 ? { ...user, email: 'someone@example.test' } : user)) }],
    ['a missing password', { ...valid(), users: valid().users.map((user, index) => (index === 2 ? { ...user, password: undefined } : user)) }],
    ['missing state', null],
  ])('refuses %s', (_label, record) => {
    expect(() => readDisposableSignIns(record, RUN)).toThrow();
  });
  it('derives emails only for a valid run id', () => {
    expect(disposableEmail(RUN, 'reviewerA')).toBe('reviewer-a-0a1b2c3d@r2-preview.local');
    expect(() => disposableEmail('bad', 'reviewerA')).toThrow();
  });
});

describe('run-scoped Supabase config', () => {
  it('renders the pinned template with only the run\'s project id and ports', () => {
    const template = read('scripts/matrix-options/r2-fullstack-bootstrap/config.toml');
    const rendered = renderConfig(template, { project_id: 'sstac-r2pv-0a1b2c3d', ports: { shadow: 55530, api: 55531, db: 55532, app: 55535, appInner: 55536 } });
    expect(rendered).toContain('project_id = "sstac-r2pv-0a1b2c3d"');
    expect(rendered).toContain('port = 55531');
    expect(rendered).toContain('shadow_port = 55530');
    expect(rendered).toContain('site_url = "http://127.0.0.1:55535"');
    expect(rendered).not.toMatch(/@@[A-Z_]+@@/);
    const manifest = JSON.parse(read('scripts/matrix-options/r2-fullstack-bootstrap/manifest.json'));
    expect(manifest.configTemplateSha256).toBe(createHash('sha256').update(fs.readFileSync(path.join(repoRoot, 'scripts/matrix-options/r2-fullstack-bootstrap/config.toml'))).digest('hex'));
  });
});

describe('local Docker engine binding', () => {
  const desktopInfo = JSON.stringify({ Name: 'docker-desktop', OperatingSystem: 'Docker Desktop', ServerVersion: '27.0.0' });
  const local = { Endpoints: { docker: { Host: LOCAL_DOCKER_ENDPOINTS[0], SkipTLSVerify: false } } };
  const fakeExec = (contexts: Record<string, unknown>, info = desktopInfo) => vi.fn((_command: string, args: string[], _options?: { env?: Record<string, string> }) => {
    if (args[0] === 'context' && args[1] === 'show') return { status: 0, stdout: 'desktop-linux\n', stderr: '' };
    if (args[0] === 'context' && args[1] === 'inspect') return contexts[args[2]] === undefined ? { status: 1, stdout: '', stderr: '' } : { status: 0, stdout: JSON.stringify([contexts[args[2]]]), stderr: '' };
    return { status: 0, stdout: info, stderr: '' };
  });
  it('accepts the local Docker Desktop context and binds its exact endpoint', () => {
    expect(resolveDockerBinding({ env: {}, exec: fakeExec({ 'desktop-linux': local }) })).toMatchObject({ host: LOCAL_DOCKER_ENDPOINTS[0] });
  });
  it.each([['ssh', { DOCKER_HOST: 'ssh://x@remote' }], ['tcp', { DOCKER_HOST: 'tcp://10.0.0.5:2376' }], ['tls', { DOCKER_TLS_VERIFY: '1' }]])('refuses a %s engine before any engine call', (_label, env) => {
    const exec = vi.fn();
    expect(code(() => resolveDockerBinding({ env, exec }))).toBe('docker_remote');
    expect(exec).not.toHaveBeenCalled();
  });
  it('refuses a remote context and an unproven engine', () => {
    expect(code(() => resolveDockerBinding({ env: {}, exec: fakeExec({ 'desktop-linux': { Endpoints: { docker: { Host: 'tcp://192.168.1.20:2375' } } } }) }))).toBe('docker_remote');
    expect(code(() => resolveDockerBinding({ env: {}, exec: fakeExec({ 'desktop-linux': local }, JSON.stringify({ Name: 'buildbox', OperatingSystem: 'Ubuntu' })) }))).toBe('docker_unknown');
  });
  it('binds every child to the verified endpoint', () => {
    const child = dockerEnv({ host: LOCAL_DOCKER_ENDPOINTS[0] }, { DOCKER_CONTEXT: 'remote', PATH: 'p' });
    expect(child).toEqual({ DOCKER_HOST: LOCAL_DOCKER_ENDPOINTS[0], PATH: 'p' });
    expect(code(() => assertBoundDockerEnv({}))).toBe('docker_unbound');
  });
  it('requires Docker to publish on loopback before anything starts', () => {
    expect(daemonLoopbackConfigured({ readFile: () => JSON.stringify({ ip: '127.0.0.1' }), home: tmp })).toBe(true);
    expect(daemonLoopbackConfigured({ readFile: () => JSON.stringify({}), home: tmp })).toBe(false);
    expect(daemonLoopbackConfigured({ readFile: () => { throw new Error('missing'); }, home: tmp })).toBe(false);
  });
});

describe('IPv4 and IPv6 listener evidence', () => {
  const header = '\r\nActive Connections\r\n\r\n  Proto  Local Address          Foreign Address        State           PID\r\n';
  const exec = (outputs: Record<string, { status: number; stdout: string }>) => (_command: string, args: string[]) => ({ stderr: '', ...outputs[args[2]] });
  it('parses both families and reports only LISTENING rows', () => {
    expect(parseNetstat(`${header}  TCP    127.0.0.1:55505        0.0.0.0:0              LISTENING       500\r\n  TCP    127.0.0.1:50000        127.0.0.1:55505        ESTABLISHED     900\r\n`, 'ipv4')).toEqual([{ address: '127.0.0.1', port: 55505, pid: 500, family: 'ipv4' }]);
    expect(parseNetstat(`${header}  TCP    [::1]:55506            [::]:0                 LISTENING       601\r\n`, 'ipv6')).toEqual([{ address: '::1', port: 55506, pid: 601, family: 'ipv6' }]);
  });
  it.each([
    ['a localized header', '\r\nAktive Verbindungen\r\n\r\n  Proto  Lokale Adresse         Remoteadresse          Status           PID\r\n'],
    ['a localized state', `${header}  TCP    0.0.0.0:135            0.0.0.0:0              ABHOEREN         1\r\n`],
    ['a malformed row', `${header}  TCP    0.0.0.0:135            0.0.0.0:0              LISTENING\r\n`],
    ['an IPv6 row in the IPv4 table', `${header}  TCP    [::]:135               [::]:0                 LISTENING       1\r\n`],
  ])('treats %s as UNKNOWN, never as no listeners', (_label, text) => { expect(parseNetstat(text, 'ipv4')).toBeNull(); });
  it('requires both families', () => {
    const ok = { status: 0, stdout: header };
    expect(listenerInventory({ exec: exec({ TCP: ok, TCPv6: ok }) })).toEqual([]);
    expect(code(() => listenerInventory({ exec: exec({ TCP: ok, TCPv6: { status: 1, stdout: '' } }) }))).toBe('inventory_failed');
  });
});

describe('owned listener, candidate HEAD/tree and BUILD_ID proof', () => {
  const RUN = 'r2pv-20261121T000000Z-0a1b2c3d';
  const worktree = 'C:\\Projects\\SSTAC-Dashboard-worktrees\\matrix-r2-preview-0a1b2c3d';
  const run = { run_id: RUN, candidate_sha: SHA, candidate_tree: TREE, ports: { app: 55535 }, app: { pid: 100, created: 'root' } };
  const stamp = { run_id: RUN, candidate_sha: SHA, candidate_tree: TREE, build_id: 'BuildAbc12345', preview_worktree: worktree };
  const processes = [
    { pid: 100, parent: 4, created: 'root', commandLine: `cmd.exe /d /c "C:\\x\\runs\\${RUN}\\start-app-${RUN}.cmd"` },
    { pid: 500, parent: 100, created: 'later', commandLine: `node "proxy.mjs" --outer 55535 --inner 55536 --supabase http://127.0.0.1:55531 --app "${worktree}"` },
    { pid: 900, parent: 1, created: 'other', commandLine: 'node other.js' },
  ];
  const base = { run, stamp, listeners: () => [{ address: '127.0.0.1', port: 55535, pid: 500 }], processTable: () => processes,
    git: (_dir: string, args: string[]) => (args[1] === 'HEAD' ? SHA : TREE), readBuildId: () => 'BuildAbc12345', fetchStatus: async () => 200 };
  it('accepts only this run\'s app serving this run\'s build', async () => { expect(await proveOwnedListener(base)).toMatchObject({ ok: true }); });
  it.each([
    ['a process merely occupying the port', { listeners: () => [{ address: '127.0.0.1', port: 55535, pid: 900 }] }, 'inOwnedTree'],
    ['an extra IPv6 listener', { listeners: () => [{ address: '127.0.0.1', port: 55535, pid: 500 }, { address: '::', port: 55535, pid: 901 }] }, 'oneLoopbackListener'],
    ['a wrong BUILD_ID', { readBuildId: () => 'OtherBuild999' }, 'buildIdMatches'],
    ['another HEAD', { git: (_dir: string, args: string[]) => (args[1] === 'HEAD' ? 'c'.repeat(40) : TREE) }, 'worktreeAtCandidate'],
    ['another run\'s stamp', { stamp: { ...stamp, run_id: 'r2pv-20261121T000000Z-ffffffff' } }, 'stampIsThisRun'],
    ['a server not serving the build', { fetchStatus: async () => 404 }, 'servesBuild'],
  ])('rejects %s', async (_label, patch, failing) => {
    const result = await proveOwnedListener({ ...base, ...patch } as typeof base);
    expect(result.ok).toBe(false);
    expect((result.checks as Record<string, boolean>)[failing]).toBe(false);
  });
});

// ---------------------------------------------------------------- reduced fix R2

const WRAPPER_PS1 = path.join(repoRoot, 'scripts', 'matrix-options', 'r2-fullstack-preview.ps1');
const CUSTODY_MJS = path.join(repoRoot, 'scripts', 'matrix-options', 'r2-fullstack-bootstrap', 'custody.mjs');
const psQuote = (value: string) => `'${value.replace(/'/g, "''")}'`;
const textSection = (text: string, from: string, to: string) => text.slice(text.indexOf(from), text.indexOf(to, text.indexOf(from)));
/**
 * Runs the wrapper's OWN function definitions (parsed from r2-fullstack-preview.ps1, never copied) in
 * Windows PowerShell 5.1, with `body` as the driver. Nothing of the wrapper's command switch runs.
 * Output goes to a file and PowerShell gets no pipes: a child the wrapper launches inherits handles,
 * and a pipe it held would keep this call waiting for as long as that child lives.
 */
function runWrapperFunctions(functions: string[], body: string, env: Record<string, string> = {}, host = 'powershell.exe') {
  seq += 1;
  const script = path.join(tmp, `harness-${seq}.ps1`);
  const output = path.join(tmp, `harness-${seq}.out`);
  fs.writeFileSync(script, [
    "$ErrorActionPreference = 'Stop'",
    `$ast = [System.Management.Automation.Language.Parser]::ParseFile(${psQuote(WRAPPER_PS1)}, [ref]$null, [ref]$null)`,
    `$wanted = @(${functions.map(psQuote).join(', ')})`,
    '$found = @()',
    'foreach ($definition in $ast.FindAll({ param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] }, $true)) {',
    '  if ($wanted -contains $definition.Name) { . ([scriptblock]::Create($definition.Extent.Text)); $found += $definition.Name }',
    '}',
    `if ($found.Count -ne $wanted.Count) { ('HARNESS missing ' + (($wanted | Where-Object { $found -notcontains $_ }) -join ',')) | Out-File -LiteralPath ${psQuote(output)} -Encoding ascii; exit 9 }`,
    `. {`,
    body,
    `} *>&1 | ForEach-Object { "$_" } | Out-File -LiteralPath ${psQuote(output)} -Encoding ascii`,
  ].join('\r\n'), 'ascii');
  const result = spawnSync(host, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script], { stdio: 'ignore', env: { ...process.env, ...env }, timeout: 120_000, windowsHide: true });
  const lines = fs.existsSync(output) ? fs.readFileSync(output, 'utf8').split(/\r?\n/) : [];
  if (result.status !== 0 || result.error) throw new Error(`harness failed (exit ${result.status}): ${result.error?.message ?? lines.join(' | ')}`);
  return lines;
}
const writeStub = (name: string, source: string) => { const file = path.join(tmp, name); fs.writeFileSync(file, source); return file; };
const listenOn = (server: net.Server) => new Promise<number>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', () => resolve((server.address() as net.AddressInfo).port)); });
const closeServer = (server: net.Server) => new Promise<void>((resolve) => { server.close(() => resolve()); });
const printLine = (value: unknown) => `process.stdout.write(${JSON.stringify(`${typeof value === 'string' ? value : JSON.stringify(value)}\n`)})`;

describe('P1: the listener inventory survives the PowerShell boundary', () => {
  it('the producer always prints one object with the asked ports and an explicit count', () => {
    expect(listenerInventoryResult([55535, 55536], [])).toEqual({ schema: LISTENER_INVENTORY_SCHEMA, ports: [55535, 55536], count: 0, listeners: [] });
    expect(listenerInventoryResult([55535], [{ address: '127.0.0.1', port: 55535, pid: 7, family: 'ipv4', extra: 1 } as never])).toEqual({ schema: LISTENER_INVENTORY_SCHEMA, ports: [55535], count: 1, listeners: [{ address: '127.0.0.1', port: 55535, pid: 7, family: 'ipv4' }] });
  });

  it('start decodes the inventory through Get-ListenerInventory and treats any listener as busy', () => {
    const ps1 = read('scripts/matrix-options/r2-fullstack-preview.ps1');
    expect(ps1).toContain('if ((Get-ListenerInventory @([int]$ports.app, [int]$ports.appInner)).count -ne 0) { Stop-WithError');
    expect(ps1).not.toMatch(/@\(Invoke-Custody @\('listeners'/);
    expect(read('scripts/matrix-options/r2-fullstack-bootstrap/custody.mjs')).toContain('print(listenerInventoryResult(ports, listenersOn(ports)))');
  });

  const HOSTS = process.platform === 'win32' ? ['powershell.exe', 'pwsh.exe'].filter((host) => spawnSync('where.exe', [host], { stdio: 'ignore' }).status === 0) : [];
  it.skipIf(process.platform !== 'win32')('both decoder hosts are available on this machine (Windows PowerShell 5.1 and PowerShell 7)', () => {
    expect(HOSTS).toEqual(['powershell.exe', 'pwsh.exe']);
  });
  describe.skipIf(HOSTS.length === 0).each(HOSTS)('real producer -> %s -> wrapper decoder', (host) => {
    it('zero and one listener decode deterministically as structured objects; malformed output fails closed', async () => {
      const probe = net.createServer();
      const freePort = await listenOn(probe);
      await closeServer(probe);
      const server = net.createServer();
      const busyPort = await listenOn(server);
      try {
        const inventory = (fields: Record<string, unknown>) => ({ schema: LISTENER_INVENTORY_SCHEMA, ports: [1234], count: 0, listeners: [], ...fields });
        // Raw JSON text (JSON.stringify cannot write 1.0, 1e400 or an unquoted big number).
        const raw = (count: string, listeners: string) => `{"schema":"${LISTENER_INVENTORY_SCHEMA}","ports":[1234],"count":${count},"listeners":${listeners}}`;
        const entry = ({ pid = '5', port = '1234' }: { pid?: string; port?: string }) => `[{"address":"127.0.0.1","port":${port},"pid":${pid},"family":"ipv4"}]`;
        const ONE = entry({});
        const malformed: Record<string, string> = {
          'legacy-bare-empty-array': printLine('[]'),
          'legacy-bare-array': printLine([{ address: '127.0.0.1', port: 1234, pid: 5, family: 'ipv4' }]),
          'json-null': printLine('null'),
          scalar: printLine('0'),
          'empty-object': printLine('{}'),
          'not-json': printLine('ok'),
          'no-output': '',
          'count-mismatch': printLine(inventory({ count: 1 })),
          'missing-listeners': printLine({ schema: LISTENER_INVENTORY_SCHEMA, ports: [1234], count: 0 }),
          'listeners-null': printLine(inventory({ listeners: null })),
          'other-schema': printLine(inventory({ schema: 'other/1' })),
          'extra-field': printLine(inventory({ unknown: true })),
          'other-port': printLine(inventory({ count: 1, listeners: [{ address: '127.0.0.1', port: 9, pid: 5, family: 'ipv4' }] })),
          'other-asked-ports': printLine(inventory({ ports: [4321] })),
          'string-count': printLine(inventory({ count: '0' })),
          'bad-entry': printLine(inventory({ count: 1, listeners: [{ address: '127.0.0.1', port: 1234, pid: 'x', family: 'ipv4' }] })),
          'unknown-exit-2': `${printLine(inventory({}))}; process.exit(2)`,
          // Numbers: only integral JSON numbers within range (Int32 on 5.1, Int64 on 7) are accepted.
          'fraction-count': printLine(raw('0.5', '[]')),
          'integral-fraction-form-count': printLine(raw('1.0', ONE)),
          'exponent-count': printLine(raw('1e0', ONE)),
          'nonfinite-count': printLine(raw('1e400', ONE)),
          'overflow-count': printLine(raw('99999999999999999999', ONE)),
          'negative-count': printLine(raw('-1', '[]')),
          'boolean-count': printLine(raw('true', ONE)),
          'null-count': printLine(raw('null', '[]')),
          'fraction-pid': printLine(raw('1', entry({ pid: '5.5' }))),
          'negative-pid': printLine(raw('1', entry({ pid: '-5' }))),
          'overflow-pid': printLine(raw('1', entry({ pid: '4294967296' }))),
          'boolean-pid': printLine(raw('1', entry({ pid: 'true' }))),
          'string-port': printLine(raw('1', entry({ port: '"1234"' }))),
          'zero-port': printLine(raw('1', entry({ port: '0' }))),
          'fraction-port': printLine(raw('1', entry({ port: '1234.0' }))),
          'fraction-asked-port': printLine(`{"schema":"${LISTENER_INVENTORY_SCHEMA}","ports":[1234.5],"count":0,"listeners":[]}`),
          'malformed-json': printLine(`{"schema":"${LISTENER_INVENTORY_SCHEMA}","ports":[1234],"count":0,"listeners":[}`),
        };
        const cases = [
          { name: 'zero', custody: CUSTODY_MJS, ports: [freePort] },
          { name: 'one', custody: CUSTODY_MJS, ports: [busyPort] },
          ...Object.entries(malformed).map(([name, source]) => ({ name, custody: writeStub(`inventory-${name}.mjs`, source), ports: [1234] })),
        ];
        const casesFile = path.join(tmp, 'cases.json');
        fs.writeFileSync(casesFile, JSON.stringify(cases));
        const lines = runWrapperFunctions(['Write-Heartbeat', 'Stop-WithError', 'Invoke-CustodyRaw', 'Test-JsonInteger', 'Read-ListenerInventory', 'Get-ListenerInventory'], [
          '$script:run = $null',
          "Write-Output ('HOST ' + $PSVersionTable.PSVersion.Major)",
          `foreach ($case in (Get-Content -LiteralPath ${psQuote(casesFile)} -Raw | ConvertFrom-Json)) {`,
          '  $custody = $case.custody',
          '  try {',
          '    $inventory = Get-ListenerInventory ([int[]]@($case.ports))',
          // The decoded value itself, with its PowerShell shape: one object, an Int32 count, a real array.
          "    $shape = [pscustomobject]@{ value = $inventory; object = ($inventory -is [System.Management.Automation.PSCustomObject]); countType = $inventory.count.GetType().Name; listenersArray = ($inventory.listeners -is [System.Array]) }",
          "    Write-Output ('CASE ' + $case.name + ' OK ' + (ConvertTo-Json -InputObject $shape -Compress -Depth 6))",
          '  }',
          "  catch { Write-Output ('CASE ' + $case.name + ' ERROR ' + $_.Exception.Message) }",
          '}',
        ].join('\r\n'), {}, host);
        expect(lines).toContain(`HOST ${host === 'pwsh.exe' ? 7 : 5}`);
        const results: Record<string, { ok: boolean; value?: unknown; message?: string }> = Object.fromEntries(lines.filter((line) => line.startsWith('CASE ')).map((line) => {
          const [, name, kind, rest] = /^CASE (\S+) (OK|ERROR) (.*)$/.exec(line)!;
          return [name, kind === 'OK' ? { ok: true, value: JSON.parse(rest) } : { ok: false, message: rest }];
        }));
        expect(Object.keys(results).sort()).toEqual(cases.map((item) => item.name).sort());
        expect(results.zero).toEqual({ ok: true, value: { value: { count: 0, listeners: [] }, object: true, countType: 'Int32', listenersArray: true } });
        expect(results.one).toEqual({ ok: true, value: { value: { count: 1, listeners: [{ address: '127.0.0.1', port: busyPort, pid: process.pid, family: 'ipv4' }] }, object: true, countType: 'Int32', listenersArray: true } });
        for (const name of Object.keys(malformed)) {
          expect(results[name], name).toMatchObject({ ok: false });
          expect(results[name].message, name).toMatch(/the listener inventory is (malformed|unknown)/);
        }
      } finally { await closeServer(server); }
    }, 120_000);
  });
});

describe('P1: destructive Supabase CLI calls are re-verified immediately before use', () => {
  const MIGRATIONS = [
    { source: 'src/first.sql', target: '20260101000000_first.sql', text: 'create table first();\n' },
    { source: 'src/second.sql', target: '20260102000000_second.sql', text: 'create table second();\n' },
  ];
  const MANIFEST = 'scripts/matrix-options/r2-fullstack-bootstrap/manifest.json';
  const TEMPLATE = 'scripts/matrix-options/r2-fullstack-bootstrap/config.toml';
  const hex = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
  const ENV = { DOCKER_HOST: LOCAL_DOCKER_ENDPOINTS[0], PATH: 'p', SUPABASE_PROJECT_ID: 'elsewhere', SUPABASE_DB_PASSWORD: 'x', DATABASE_URL: 'postgres://remote', PGHOST: 'remote' };
  const write = (root: string, relative: string, content: string | Buffer) => { fs.mkdirSync(path.dirname(path.join(root, relative)), { recursive: true }); fs.writeFileSync(path.join(root, relative), content); };
  /** A run that owns its stack, with bound inputs and a prepared run bundle (as prepare writes it). */
  function preparedRun() {
    const template = fs.readFileSync(path.join(repoRoot, TEMPLATE));
    const manifest = { configTemplateSha256: hex(template), migrations: MIGRATIONS.map(({ source, target, text }) => ({ source, target, sha256: hex(text) })) };
    write(worktreeA, TEMPLATE, template);
    write(worktreeA, MANIFEST, JSON.stringify(manifest));
    for (const step of MIGRATIONS) write(worktreeA, step.source, step.text);
    const run = newRun(worktreeA);
    const files = [MANIFEST, TEMPLATE, ...MIGRATIONS.map((step) => step.source)].map((relative) => {
      const bytes = fs.readFileSync(path.join(worktreeA, relative));
      return { path: relative, bytes: bytes.length, sha256: hex(bytes) };
    });
    STATE_OPS.write(run.run_dir, { ...state(run), inputs: { files, digest: 'd' }, ownership: { stack: 'preflight-empty' } });
    recordProcess({ run, entry: { launch_id: launchId(1), role: 'supabase-start', outcome: 'intent' } });
    const supabaseDir = path.join(run.run_dir, 'supabase');
    write(supabaseDir, 'config.toml', renderConfig(template.toString('utf8'), run));
    for (const step of MIGRATIONS) write(supabaseDir, `migrations/${step.target}`, step.text);
    return { run, supabaseDir, generated: treeDigests(supabaseDir) };
  }
  const guarded = (run: { run_id: string }, role: string, invoke: (invocation: unknown) => number, patch: (current: Record<string, unknown>) => Record<string, unknown> = (current) => current, env: Record<string, string> = ENV) =>
    runDestructiveCli({ prove: () => patch(prove(worktreeA, run.run_id)), repoRoot: worktreeA, role, renderConfig, env, platform: 'win32', invoke });
  const ROLES = Object.keys(DESTRUCTIVE_CLI_ROLES);

  it.each(ROLES)('%s: invokes the CLI exactly once, with fixed arguments, the run\'s own workdir and no Supabase or database override', (role) => {
    const { run } = preparedRun();
    const stub = vi.fn((_invocation: unknown) => 0);
    expect(guarded(run, role, stub)).toBe(0);
    expect(stub).toHaveBeenCalledTimes(1);
    const invocation = stub.mock.calls[0][0] as { file: string; args: string[]; cwd: string; env: Record<string, string> };
    expect(invocation.file).toBe('cmd.exe');
    expect(invocation.args).toEqual(['/d', '/s', '/c', 'npx', '--yes', SUPABASE_CLI, ...DESTRUCTIVE_CLI_ROLES[role as keyof typeof DESTRUCTIVE_CLI_ROLES], '--workdir', run.run_dir]);
    expect(invocation.cwd).toBe(run.run_dir);
    expect(invocation.env).toEqual({ DOCKER_HOST: LOCAL_DOCKER_ENDPOINTS[0], PATH: 'p' });
  });

  type Prepared = ReturnType<typeof preparedRun>;
  const substitutions: Array<[string, string[], (prepared: Prepared) => void]> = [
    ['the run config bytes', ROLES, ({ supabaseDir }) => fs.appendFileSync(path.join(supabaseDir, 'config.toml'), '# substituted\n')],
    ['the run config project id', ROLES, ({ supabaseDir, run }) => fs.writeFileSync(path.join(supabaseDir, 'config.toml'), renderConfig(fs.readFileSync(path.join(repoRoot, TEMPLATE), 'utf8'), { ...run, project_id: 'sstac-r2pv-ffffffff' }))],
    ['the bound config template', ROLES, () => fs.appendFileSync(path.join(worktreeA, TEMPLATE), '# substituted\n')],
    ['the bound manifest', ROLES, () => fs.appendFileSync(path.join(worktreeA, MANIFEST), ' ')],
    ['a link to a hosted project', ROLES, ({ supabaseDir }) => write(supabaseDir, '.temp/project-ref', 'abcdefghijklmnopqrst')],
    ['a run migration', ['supabase-db-reset'], ({ supabaseDir }) => fs.appendFileSync(path.join(supabaseDir, 'migrations', MIGRATIONS[1].target), 'drop table first;\n')],
    ['an extra run migration', ['supabase-db-reset'], ({ supabaseDir }) => write(supabaseDir, 'migrations/20260103000000_extra.sql', 'select 1;\n')],
    ['a removed run migration', ['supabase-db-reset'], ({ supabaseDir }) => fs.rmSync(path.join(supabaseDir, 'migrations', MIGRATIONS[0].target))],
    ['a bound migration source', ['supabase-db-reset'], () => fs.appendFileSync(path.join(worktreeA, MIGRATIONS[0].source), '-- substituted\n')],
  ];
  it.each(substitutions.flatMap(([label, roles, mutate]) => roles.map((role) => [role, label, mutate] as const)))('%s: %s changed after the earlier check -> refused, the CLI stub is never called', (role, _label, mutate) => {
    const prepared = preparedRun();
    // The earlier check (generated-check, before the stack started) passed on the prepared bundle.
    expect(checkGenerated(prepared.generated, treeDigests(prepared.supabaseDir))).toBe(true);
    mutate(prepared);
    const stub = vi.fn(() => 0);
    expect(() => guarded(prepared.run, role, stub)).toThrow(CustodyError);
    expect(stub).not.toHaveBeenCalled();
  });

  it.each(ROLES)('%s: refuses when the run no longer owns an open stack, its workdir or project id moved, or Docker is unbound', (role) => {
    const { run } = preparedRun();
    const stub = vi.fn(() => 0);
    const refusals: Array<[string, string, (current: Record<string, unknown>) => Record<string, unknown>, Record<string, string>?]> = [
      ['ownership_unproven', role, (current) => ({ ...current, ownership: { stack: 'foreign' } })],
      ['ownership_unproven', role, (current) => ({ ...current, status: 'released' })],
      ['cli_unbound', role, (current) => ({ ...current, run_dir: path.join(worktreeB, '.tmp', 'r2-fullstack', 'runs', run.run_id) })],
      ['cli_unbound', role, (current) => ({ ...current, project_id: 'sstac-r2pv-ffffffff' })],
      ['docker_unbound', role, (current) => current, { PATH: 'p' }],
      ['bad_request', 'supabase-start', (current) => current],
    ];
    for (const [expected, target, patch, env] of refusals) expect(code(() => guarded(run, target, stub, patch, env)), expected).toBe(expected);
    expect(stub).not.toHaveBeenCalled();
  });

  it('every destructive call site of the wrapper passes through the one guarded helper', () => {
    const ps1 = read('scripts/matrix-options/r2-fullstack-preview.ps1');
    expect(textSection(ps1, 'function Invoke-DestructiveCli', 'function Get-RunPreviewWorktree')).toContain("Invoke-Bounded $Role 'node' (@($custody, 'cli-guarded') + (Get-OwnerArgs) + @('--role', $Role))");
    expect(ps1.match(/Invoke-DestructiveCli '/g)).toHaveLength(2);
    expect(ps1).toContain("(Invoke-DestructiveCli 'supabase-db-reset' $TimeoutSeconds)");
    expect(ps1).toContain("$code = Invoke-DestructiveCli 'supabase-stop' 300");
    // No destructive CLI argument exists in the wrapper; the only direct CLI call left is start.
    expect(ps1).not.toMatch(/'reset'|'--no-backup'|'stop', /);
    expect(ps1.match(/Invoke-SupabaseCli '/g)).toHaveLength(1);
    expect(ps1).toContain("if ($Role -ne 'supabase-start') { Stop-WithError");
    const custody = read('scripts/matrix-options/r2-fullstack-bootstrap/custody.mjs');
    expect(custody).toContain("case 'cli-guarded': {");
    expect(custody).toContain('const status = runDestructiveCli({');
    expect(custody.match(/spawnSync\(invocation\.file/g)).toHaveLength(1);
  });
});

describe('P2: a launched child whose bookkeeping fails moves the run to needs-reconcile', () => {
  it('a holder record is taken over once by its creating wrapper; one left by an earlier command of the same wrapper is an interruption', () => {
    const run = newRun(worktreeA);
    expect(code(() => lockAs(run, 'up'))).toBe('none');
    expect(state(run).active.fresh).toBeUndefined();
    // That command could not record its child and kept its holder record (no unlock): the same
    // wrapper's next command finds an interrupted holder.
    expect(code(() => lockAs(run, 'build'))).toBe('needs_reconcile');
    expect(state(run)).toMatchObject({ status: 'needs-reconcile', active: null, interrupted: [expect.objectContaining({ pid: 100, command: 'up' })] });
  });

  it('marks needs-reconcile with the launch identity, keeps a known identity, and accounts only from evidence', () => {
    const run = newRun(worktreeA);
    recordProcess({ run, entry: { launch_id: launchId(4), role: 'bootstrap-prepare', outcome: 'intent' } });
    markUnaccounted({ run, entry: { launch_id: launchId(4), role: 'bootstrap-prepare', reason: 'pid-record', pid: 4444, created: '2026-11-21T00:00:00.1234567Z', command_sha256: 'c'.repeat(64) } });
    expect(state(run)).toMatchObject({ status: 'needs-reconcile', unaccounted: [expect.objectContaining({ pid: 4444, created: '2026-11-21T00:00:00.1234567Z', reason: 'pid-record', accounted: null })] });
    expect(state(run).processes).toEqual([expect.objectContaining({ launch_id: launchId(4), outcome: 'intent', pid: 4444, created: '2026-11-21T00:00:00.1234567Z' })]);
    const alive = [{ pid: 4444, created: '2026-11-21T00:00:00.1234567Z', commandLine: '' }];
    expect(teardownEvidence({ run: prove(worktreeA, run.run_id), ...clean, processTable: () => alive })).toMatchObject({ verified: false, liveProcesses: ['bootstrap-prepare'] });
    const unchanged = state(run);
    expect(accountUnaccounted(unchanged, alive)).toBe(unchanged);
    // An unknown (empty) process table proves nothing.
    expect(code(() => accountUnaccounted(state(run), []))).toBe('inventory_failed');
    const others = [{ pid: 1, created: 'boot', commandLine: 'System' }];
    const accounted = accountUnaccounted(state(run), others);
    expect(accounted.unaccounted[0].accounted).toMatchObject({ result: 'absent', by: 'complete-identity' });
    expect(accounted.processes[0].outcome).toBe('gone');
    expect(processEvidence(accounted, others).unknownProcesses).toEqual([]);
    // A pid-only child is never accounted, even when no process with that pid exists.
    const other = newRun(worktreeB);
    markUnaccounted({ run: other, entry: { launch_id: launchId(5), role: 'app', reason: 'app-record', pid: 5555 } });
    expect(teardownEvidence({ run: prove(worktreeB, other.run_id), ...clean }).unknownProcesses).toEqual(['app', 'app']);
    expect(accountUnaccounted(state(other), [{ pid: 5555, created: 'someone' }]).unaccounted[0].accounted).toBeNull();
    expect(accountUnaccounted(state(other), others).unaccounted[0].accounted).toBeNull();
  });

  describe.skipIf(process.platform !== 'win32')('the wrapper\'s Invoke-Bounded with a failed pid record and a live child', () => {
    const children: number[] = [];
    const isAlive = (pid: number) => { try { process.kill(pid, 0); return true; } catch { return false; } };
    const stopChild = async (pid: number) => {
      try { process.kill(pid); } catch { /* already gone */ }
      for (let index = 0; index < 100 && isAlive(pid); index += 1) await new Promise((resolve) => setTimeout(resolve, 100));
    };
    // The launched child works in the temporary worktree: it must be gone before the directory is removed.
    afterEach(async () => { for (const pid of children.splice(0)) await stopChild(pid); });
    const stubSource = (failMark: boolean) => [
      "import fs from 'node:fs';",
      `import { markUnaccounted, recordProcess } from ${JSON.stringify(pathToFileURL(CUSTODY_MJS).href)};`,
      'const [command, ...rest] = process.argv.slice(2);',
      'const options = {};',
      'for (let index = 0; index < rest.length; index += 2) options[rest[index].slice(2)] = rest[index + 1];',
      "fs.appendFileSync(process.env.STUB_CALLS, JSON.stringify({ command, options }) + '\\n');",
      'const run = { run_id: options.run, run_dir: process.env.STUB_RUN_DIR };',
      "if (command === 'run-record' && options.outcome === 'running') { console.error('[r2-custody] FAIL (inventory_failed): the process table is unavailable.'); process.exit(2); }",
      "if (command === 'run-record') { recordProcess({ run, entry: { launch_id: options.launch, role: options.role, outcome: options.outcome, pid: options.child === undefined ? null : Number(options.child), created: null } }); process.stdout.write('{\"result\":\"recorded\"}\\n'); process.exit(0); }",
      `if (command === 'run-unaccounted' && !${failMark}) { markUnaccounted({ run, entry: { launch_id: options.launch, role: options.role, reason: options.reason, pid: Number(options.child), created: options.created ?? null, command_sha256: options['command-sha256'] ?? null } }); process.stdout.write('{"result":"needs-reconcile"}\\n'); process.exit(0); }`,
      "console.error('[r2-custody] FAIL (run_io): refused'); process.exit(1);",
    ].join('\n');
    const launchBounded = (run: { run_id: string; run_dir: string }, failMark: boolean) => {
      const calls = path.join(tmp, `calls-${failMark}.jsonl`);
      const lines = runWrapperFunctions(['Write-Heartbeat', 'Stop-WithError', 'Invoke-CustodyRaw', 'Invoke-Custody', 'Get-OwnerArgs', 'ConvertTo-ArgString', 'Protect-Log', 'Get-ChildIdentity', 'Set-RunUnaccounted', 'Get-UnaccountedMessage', 'Invoke-Bounded'], [
        `$repoRoot = ${psQuote(worktreeA)}; $owner = 'inner-loop'; $custody = ${psQuote(writeStub(`custody-stub-${failMark}.mjs`, stubSource(failMark)))}`,
        `$script:run = [pscustomobject]@{ run_id = ${psQuote(run.run_id)}; run_dir = ${psQuote(run.run_dir)} }`,
        "$script:keepHolder = $false; $script:lastLaunch = ''",
        "try { $code = Invoke-Bounded 'bootstrap-prepare' 'node' @('-e', 'setInterval(function(){},1000)') 120; Write-Output ('RESULT returned ' + $code) }",
        "catch { Write-Output ('RESULT ' + $_.Exception.Message) }",
        "Write-Output ('KEEP ' + $script:keepHolder)",
      ].join('\r\n'), { STUB_CALLS: calls, STUB_RUN_DIR: run.run_dir });
      const result = lines.find((line) => line.startsWith('RESULT ')) ?? '';
      const match = /^RESULT UNACCOUNTED: bootstrap-prepare \(pid (\d+)\) was launched but its pid-record bookkeeping failed/.exec(result);
      if (match) children.push(Number(match[1]));
      const recorded = fs.readFileSync(calls, 'utf8').trim().split('\n').map((line) => JSON.parse(line) as { command: string; options: Record<string, string> });
      return { result, pid: match ? Number(match[1]) : null, keep: lines.find((line) => line.startsWith('KEEP ')), recorded };
    };

    it('durable needs-reconcile with the full launch identity; competing mutations refused until the child is accounted for', async () => {
      const run = newRun(worktreeA);
      const launched = launchBounded(run, false);
      expect(launched.result).toMatch(/the run is marked needs-reconcile; the child was not stopped; only status, reconcile and down/);
      expect(launched.keep).toBe('KEEP False');
      const pid = launched.pid!;
      expect(isAlive(pid)).toBe(true);
      // No exit or timeout was recorded for it, and nothing stopped it.
      expect(launched.recorded.map((call) => `${call.command}:${call.options.outcome ?? call.options.reason}`)).toEqual(['run-record:intent', 'run-record:running', 'run-unaccounted:pid-record']);
      const mark = launched.recorded[2].options;
      expect(mark).toMatchObject({ child: String(pid), role: 'bootstrap-prepare' });
      expect(mark.created).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z$/);
      expect(mark['command-sha256']).toMatch(/^[0-9a-f]{64}$/);
      // Durable: the persisted run state.
      const persisted = state(run);
      expect(persisted).toMatchObject({ status: 'needs-reconcile', unaccounted: [expect.objectContaining({ pid, created: mark.created, command_sha256: mark['command-sha256'], accounted: null })] });
      // The identity the wrapper captured is the identity custody's own process table reports.
      const live = defaultProcessTable();
      expect(processEvidence(persisted, live).liveProcesses).toEqual(['bootstrap-prepare']);
      // Competing mutations are refused; only reconcile and (ownership-safe) down proceed.
      const next = { pid: 300, created: 't300' };
      for (const command of ['seed', 'build', 'start', 'accept', 'up']) expect(code(() => lockAs(run, command, next, [next])), command).toBe('needs_reconcile');
      expect(code(() => assertRunWorkable(state(run), [WRAPPER]))).toBe('needs_reconcile');
      expect(code(() => newRun(worktreeA, { pid: 200, created: 't200' }))).toBe('needs_reconcile');
      expect(code(() => lockAs(run, 'reconcile', next, [next]))).toBe('none');
      unlockRun({ run, wrapper: next, lockHeld: held, parentPid: 300 });
      // While the child lives it stays unaccounted and teardown is not verified.
      expect(accountUnaccounted(state(run), live).unaccounted[0].accounted).toBeNull();
      expect(teardownEvidence({ run: prove(worktreeA, run.run_id), ...clean, processTable: () => live }).verified).toBe(false);
      // Once it is gone, evidence accounts for it; the run still accepts only reconcile and down.
      await stopChild(pid);
      const after = defaultProcessTable();
      const accounted = accountUnaccounted(state(run), after);
      expect(accounted.unaccounted[0].accounted).toMatchObject({ result: 'absent', by: 'complete-identity' });
      expect(teardownEvidence({ run: { ...prove(worktreeA, run.run_id), ...accounted }, ...clean, processTable: () => after }).verified).toBe(true);
      expect(code(() => lockAs(run, 'seed', next, [next]))).toBe('needs_reconcile');
    }, 120_000);

    it('if custody cannot mark the run either, the wrapper keeps its holder record (the next command finds it interrupted)', async () => {
      const run = newRun(worktreeA);
      const launched = launchBounded(run, true);
      expect(launched.pid).not.toBeNull();
      expect(isAlive(launched.pid!)).toBe(true);
      await stopChild(launched.pid!);
      expect(launched.result).toMatch(/custody could not mark it, so the run keeps this wrapper as its holder/);
      expect(launched.keep).toBe('KEEP True');
      // The next command finds the retained holder interrupted: the unfinished launch (its identity was
      // never recorded) enters the unaccounted path as unresolved, and down stays refused.
      const next = { pid: 300, created: 't300' };
      expect(code(() => lockAs(run, 'down', next, [next]))).toBe('none');
      expect(state(run)).toMatchObject({ status: 'needs-reconcile', unaccounted: [expect.objectContaining({ role: 'bootstrap-prepare', reason: 'interrupted-holder', pid: null, created: null, accounted: null })] });
      expect(code(() => downPlan(accountUnaccounted(state(run), [{ pid: 1, created: 'boot', commandLine: 'System' }]), processEvidence(state(run), [])))).toBe('unaccounted_child');
      const ps1 = read('scripts/matrix-options/r2-fullstack-preview.ps1');
      expect(textSection(ps1, 'function Exit-Run', 'function Set-RunTerminal')).toContain("if (-not $script:terminal -and -not $script:keepHolder) { $null = Invoke-Custody (@('run-unlock')");
    }, 120_000);
  });

  it('the wrapper guards every post-launch bookkeeping step (bounded children and the app) and never auto-tears down an unaccounted child', () => {
    const ps1 = read('scripts/matrix-options/r2-fullstack-preview.ps1');
    const bounded = textSection(ps1, 'function Invoke-Bounded', 'function Invoke-Node');
    expect(bounded.indexOf('$identity = Get-ChildIdentity $process.Id')).toBeLessThan(bounded.indexOf("'--outcome', 'running'"));
    for (const stage of ["$stage = 'heartbeat'", "$stage = 'timeout-record'", "$stage = 'exit-record'"]) expect(bounded, stage).toContain(stage);
    expect(bounded).toContain('$marked = Set-RunUnaccounted $launch $Role $identity $stage');
    const start = textSection(ps1, "  'start' {", "  'status' {");
    expect(start.indexOf('$appIdentity = Get-ChildIdentity')).toBeLessThan(start.indexOf("Invoke-Custody (@('run-set-app')"));
    expect(start).toContain("$marked = Set-RunUnaccounted $appLaunch 'app' $appIdentity $stage");
    expect(textSection(ps1, "  'up' {", "  'seed' {")).toContain("'^(TIMEOUT|REFUSED|UNACCOUNTED):'");
  });
});

describe('P2: every direct journey request goes through the run-owned loopback guard', () => {
  const RUN_ID = 'r2pv-20261121T000000Z-0a1b2c3d';
  const API = 'http://127.0.0.1:55531';
  const openRun = { run_id: RUN_ID, project_id: 'sstac-r2pv-0a1b2c3d', ports: { api: 55531 }, status: 'created', ownership: { stack: 'owned' } };
  const kong = (patch: Record<string, unknown> = {}) => ({ Name: '/supabase_kong_sstac-r2pv-0a1b2c3d', Id: 'e'.repeat(64), State: { Running: true, StartedAt: '2026-11-21T00:00:00Z' }, NetworkSettings: { Ports: { '8000/tcp': [{ HostIp: '127.0.0.1', HostPort: '55531' }] } }, ...patch });
  type SenderOptions = Partial<Parameters<typeof createRunApiSender>[0]>;
  const guardFor = (send: (url: string, init: RequestInit) => Promise<Response>, options: SenderOptions = {}) => createRunApiSender({
    runId: RUN_ID, apiUrl: API, proveRunState: () => openRun, inspect: () => kong(), listeners: () => [{ address: '127.0.0.1', port: 55531, pid: 700, family: 'ipv4' }],
    processTable: () => [{ pid: 700, created: 'docker' }], send, ...options,
  });
  const JOURNEY = [
    ['login', '/auth/v1/token?grant_type=password', 'POST'],
    ['RPC', '/rest/v1/rpc/matrix_guided_r2_save', 'POST'],
    ['activation', '/rest/v1/matrix_guided_r2_activation?document_version=eq.phase2-review-2026-11-fa356b89', 'PATCH'],
  ] as const;

  it.each(JOURNEY.flatMap(([name, pathname, method]) => [307, 308].map((status) => [name, status, pathname, method] as const)))('%s: a synthetic HTTP %s fails closed and no second request is issued', async (_name, status, pathname, method) => {
    const send = vi.fn(async (_url: string, _init: RequestInit) => new Response(null, { status, headers: { location: 'http://127.0.0.1:55531/elsewhere' } }));
    const guarded = guardFor(send);
    await expect(guarded(pathname, { method })).rejects.toMatchObject({ code: 'redirected' });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toBe(`${API}${pathname}`);
    expect(send.mock.calls[0][1]).toMatchObject({ method, redirect: 'manual' });
  });

  it('a response that reports a followed redirect is refused; a direct answer is returned with redirects disabled', async () => {
    const followed = new Response('{}', { status: 200 });
    Object.defineProperty(followed, 'redirected', { value: true });
    await expect(guardFor(async () => followed)('/rest/v1/rpc/x', { method: 'POST' })).rejects.toMatchObject({ code: 'redirected' });
    const send = vi.fn(async (_url: string, _init: RequestInit) => new Response('{}', { status: 200 }));
    expect((await guardFor(send)('/rest/v1/rpc/x', { method: 'POST', redirect: 'follow' })).status).toBe(200);
    expect(send.mock.calls[0][1].redirect).toBe('manual');
  });

  it('refuses non-loopback, substituted or mismatched destinations before any request', async () => {
    const send = vi.fn(async (_url: string, _init: RequestInit) => new Response('{}', { status: 200 }));
    expect(code(() => guardFor(send, { apiUrl: 'http://localhost:55531' }))).toBe('destination_changed');
    expect(code(() => guardFor(send, { apiUrl: 'http://127.0.0.1:55532' }))).toBe('destination_changed');
    expect(code(() => guardFor(send, { inspect: () => kong({ NetworkSettings: { Ports: { '8000/tcp': [{ HostIp: '0.0.0.0', HostPort: '55531' }] } } }) }))).toBe('destination_unknown');
    expect(code(() => guardFor(send, { proveRunState: () => ({ ...openRun, run_id: 'r2pv-20261121T000000Z-ffffffff' }) }))).toBe('destination_unknown');
    expect(code(() => createGuardedSender({ initial: { url: 'http://10.0.0.5:55531', hostPort: 55531 }, prove: () => ({}), send }))).toBe('destination_unknown');
    expect(code(() => createGuardedSender({ initial: { url: 'https://127.0.0.1:55531', hostPort: 55531 }, prove: () => ({}), send }))).toBe('destination_unknown');
    // Substitution between requests: another container, then a run that no longer owns its stack.
    let container = kong();
    let run: Record<string, unknown> = openRun;
    const guarded = guardFor(send, { inspect: () => container, proveRunState: () => run });
    expect((await guarded('/rest/v1/rpc/x', { method: 'POST' })).status).toBe(200);
    container = kong({ Id: 'f'.repeat(64) });
    await expect(guarded('/rest/v1/rpc/x', { method: 'POST' })).rejects.toMatchObject({ code: 'destination_changed' });
    container = kong();
    run = { ...openRun, status: 'needs-reconcile' };
    await expect(guarded('/rest/v1/rpc/x', { method: 'POST' })).rejects.toMatchObject({ code: 'destination_unknown' });
    await expect(guardFor(send)('//example.test/x', {})).rejects.toMatchObject({ code: 'bad_request' });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('the journey sends login, RPC, activation and row reads only through that guard', () => {
    const spec = read('e2e/matrix-options-paper-r2-fullstack.spec.ts');
    expect(spec).not.toMatch(/\bfetch\(/);
    expect(spec).toContain('apiSender ??= createRunApiSender({');
    expect(spec).toContain('runId: runState.run_id, apiUrl: stack.API_URL,');
    for (const call of ["await api('/auth/v1/token?grant_type=password'", 'await api(`/rest/v1/rpc/${name}`', 'await api(`/rest/v1/matrix_guided_r2_activation?', "await api('/rest/v1/matrix_guided_r2_entries?select=user_id'"]) expect(spec, call).toContain(call);
    expect(spec.match(/await api\(/g)).toHaveLength(5);
  });
});

// ---------------------------------------------------------------- reduced fix R3

const sha256Hex = (value: string) => createHash('sha256').update(value).digest('hex');
const complete = (pid: number, created: string, commandLine: string) => ({ pid, created, command_sha256: sha256Hex(commandLine) });

describe('R3: down refuses while any unaccounted launch is unresolved', () => {
  const none = { liveProcesses: [], unknownProcesses: [] };
  const owned = (worktree = worktreeA) => { const run = newRun(worktree); ownStack(run); return run; };
  const child = complete(4242, '2026-11-21T00:00:00.1000000Z', 'node child.js');

  it('a live child with a complete identity blocks teardown of an owned stack until it is proven absent', () => {
    const run = owned();
    markUnaccounted({ run, entry: { launch_id: launchId(2), role: 'bootstrap-post-start', reason: 'heartbeat', ...child } });
    const liveTable = [{ pid: 4242, created: child.created, commandLine: 'node child.js' }];
    expect(code(() => downPlan(accountUnaccounted(state(run), liveTable), none))).toBe('unaccounted_child');
    expect(code(() => finalizeRelease({ run, kind: 'released', evidence: { verified: true, liveProcesses: [], unknownProcesses: [] }, slotDir }))).toBe('unaccounted_child');
    const gone = accountUnaccounted(state(run), [{ pid: 1, created: 'boot', commandLine: 'System' }]);
    expect(downPlan(gone, none)).toMatchObject({ action: 'teardown', stack: 'stop' });
  });

  it.each([
    ['pid only', { pid: 4242 }],
    ['no command-line digest', { pid: 4242, created: '2026-11-21T00:00:00.1000000Z' }],
    ['no creation time', { pid: 4242, command_sha256: child.command_sha256 }],
  ])('%s: never accounted, even when no process with that pid exists, so down stays refused', (_label, identity) => {
    const run = owned();
    markUnaccounted({ run, entry: { launch_id: launchId(3), role: 'supabase-db-reset', reason: 'pid-record', ...identity } });
    const accounted = accountUnaccounted(state(run), [{ pid: 1, created: 'boot', commandLine: 'System' }]);
    expect(accounted.unaccounted[0].accounted).toBeNull();
    expect(code(() => downPlan(accounted, none))).toBe('unaccounted_child');
    expect(teardownEvidence({ run: { ...prove(worktreeA, run.run_id), ...accounted }, ...clean, processTable: () => [{ pid: 1, created: 'boot', commandLine: 'System' }] })).toMatchObject({ verified: false, unknownProcesses: expect.arrayContaining(['supabase-db-reset']) });
  });

  it('a timed-out or heartbeat-failed record alone proves nothing: its unaccounted launch keeps down refused', () => {
    const run = owned();
    recordProcess({ run, entry: { launch_id: launchId(4), role: 'bootstrap-seed', outcome: 'intent' } });
    recordProcess({ run, entry: { launch_id: launchId(4), role: 'bootstrap-seed', outcome: 'timeout', pid: 4242 } });
    markUnaccounted({ run, entry: { launch_id: launchId(4), role: 'bootstrap-seed', reason: 'timeout-record', pid: 4242 } });
    expect(code(() => downPlan(accountUnaccounted(state(run), [{ pid: 1, created: 'boot', commandLine: 'System' }]), none))).toBe('unaccounted_child');
  });

  it('the recorded owned app (complete identity recorded and equal) keeps its normal shutdown; any other app launch is refused', () => {
    const run = owned();
    const app = complete(500, '2026-11-21T00:00:01.0000000Z', 'cmd.exe /d /c start-app.cmd');
    recordProcess({ run, entry: { launch_id: launchId(7), role: 'app', outcome: 'intent' } });
    setRunApp({ run, app, launchId: launchId(7) });
    // The app's heartbeat failed after it was recorded: its launch is unaccounted but it IS the recorded app.
    markUnaccounted({ run, entry: { launch_id: launchId(7), role: 'app', reason: 'heartbeat', ...app } });
    const live = [{ pid: 500, created: app.created, commandLine: 'cmd.exe /d /c start-app.cmd' }];
    expect(downPlan(accountUnaccounted(state(run), live), processEvidence(state(run), live))).toEqual({ action: 'teardown', stack: 'stop', app: 'stop' });
    // Another identity than the recorded app, or no recorded app at all: refused.
    const other = owned(worktreeB);
    markUnaccounted({ run: other, entry: { launch_id: launchId(8), role: 'app', reason: 'app-record', ...complete(501, app.created, 'cmd.exe') } });
    expect(code(() => downPlan(state(other), none))).toBe('unaccounted_child');
    STATE_OPS.write(other.run_dir, { ...state(other), app: { ...app } });
    expect(code(() => downPlan(state(other), none))).toBe('unaccounted_child');
  });

  describe.skipIf(process.platform !== 'win32')('the real wrapper down command (custody stub delegating to the real custody logic; Docker and the Supabase CLI faked)', () => {
    const stub = () => [
      "import fs from 'node:fs';",
      "import { createHash } from 'node:crypto';",
      `import * as custody from ${JSON.stringify(pathToFileURL(CUSTODY_MJS).href)};`,
      'const [command, ...rest] = process.argv.slice(2);',
      'const options = {};',
      'for (let index = 0; index < rest.length; index += 2) options[rest[index].slice(2)] = rest[index + 1];',
      "fs.appendFileSync(process.env.STUB_CALLS, JSON.stringify({ command, role: options.role ?? null, outcome: options.outcome ?? null }) + '\\n');",
      'const slotDir = process.env.STUB_SLOT_DIR;',
      "const print = (value) => process.stdout.write(JSON.stringify(value) + '\\n');",
      'const clean = { docker: () => ({ containers: [], volumes: [] }), listeners: () => [] };',
      'try {',
      '  const run = () => custody.proveRun({ repoRoot: options.worktree, runId: options.run, candidateSha: options.sha, slotDir });',
      '  const table = () => custody.defaultProcessTable();',
      '  const wrapper = () => custody.processIdentity(Number(options.pid), table());',
      '  switch (command) {',
      "    case 'docker-bind': print({ host: custody.LOCAL_DOCKER_ENDPOINTS[0], context: null }); break;",
      "    case 'run-verify': print(run()); break;",
      "    case 'run-lock': { const current = run(); print(custody.lockRun({ run: current, wrapper: wrapper(), command: options.command, processTable: table, lockHeld: () => true, parentPid: process.ppid })); break; }",
      "    case 'run-unlock': { const current = run(); print({ result: custody.unlockRun({ run: current, wrapper: wrapper(), lockHeld: () => true, parentPid: process.ppid }) }); break; }",
      "    case 'down-plan': { const current = run(); const rows = table(); const accounted = custody.accountUnaccounted(current, rows); if (accounted !== current) custody.STATE_OPS.write(current.run_dir, { ...custody.STATE_OPS.read(current.run_dir), processes: accounted.processes, unaccounted: accounted.unaccounted }); print(custody.downPlan(accounted, custody.processEvidence(accounted, rows))); break; }",
      "    case 'run-record': { const current = run(); const rows = table(); const child = options.child === undefined ? null : Number(options.child); const row = child === null ? undefined : rows.find((entry) => entry.pid === child); print(custody.recordProcess({ run: current, entry: { launch_id: options.launch, role: options.role, outcome: options.outcome, pid: child, created: row?.created ?? null, command_sha256: row?.commandLine ? createHash('sha256').update(row.commandLine).digest('hex') : null, exit_code: options['exit-code'] === undefined ? null : Number(options['exit-code']) } })); break; }",
      // The fake Supabase CLI: every destructive call is counted (one line per call) and nothing runs.
      "    case 'cli-guarded': if (process.env.STUB_CLI_COUNTER) fs.appendFileSync(process.env.STUB_CLI_COUNTER, options.role + '\\n'); print({ stub: 'the destructive Supabase CLI call ' + options.role + ' would run here' }); break;",
      "    case 'run-unaccounted': { if (process.env.STUB_FAIL_UNACCOUNTED === '1') throw Object.assign(new Error('the run state could not be written'), { code: 'run_io' }); const current = run(); print(custody.markUnaccounted({ run: current, entry: { launch_id: options.launch, role: options.role, reason: options.reason, pid: Number(options.child), created: options.created ?? null, command_sha256: options['command-sha256'] ?? null } })); break; }",
      "    case 'teardown-check': { const evidence = custody.teardownEvidence({ run: run(), ...clean, processTable: table }); print(evidence); if (!evidence.verified) process.exit(5); break; }",
      "    case 'run-finalize': { const current = run(); const evidence = custody.teardownEvidence({ run: current, ...clean, processTable: table }); print({ result: custody.finalizeRelease({ run: current, kind: options.kind, evidence, slotDir }), evidence }); break; }",
      "    default: throw new Error('unexpected custody command ' + command);",
      '  }',
      "} catch (error) { console.error('[r2-custody] FAIL (' + (error.code ?? 'internal') + '): ' + error.message); process.exit(1); }",
    ].join('\n');
    const children: number[] = [];
    const isAlive = (pid: number) => { try { process.kill(pid, 0); return true; } catch { return false; } };
    const stopChild = async (pid: number) => {
      try { process.kill(pid); } catch { /* already gone */ }
      for (let index = 0; index < 100 && isAlive(pid); index += 1) await new Promise((resolve) => setTimeout(resolve, 100));
    };
    afterEach(async () => { for (const pid of children.splice(0)) await stopChild(pid); });
    /** A repository copy holding the real wrapper and the custody stub, and one owned, needs-reconcile run in it. */
    function ownedRunWithUnaccounted(identity: Record<string, unknown>) {
      const repo = path.join(tmp, 'repo');
      fs.mkdirSync(path.join(repo, 'scripts', 'matrix-options', 'r2-fullstack-bootstrap'), { recursive: true });
      fs.copyFileSync(WRAPPER_PS1, path.join(repo, 'scripts', 'matrix-options', 'r2-fullstack-preview.ps1'));
      fs.writeFileSync(path.join(repo, 'scripts', 'matrix-options', 'r2-fullstack-bootstrap', 'custody.mjs'), stub());
      const run = createRun({ repoRoot: repo, candidateSha: 'inner-loop', candidateTree: null, wrapper: WRAPPER, slotDir });
      STATE_OPS.write(run.run_dir, { ...state(run), active: null, inputs: { files: [], digest: 'x' }, ownership: { stack: 'preflight-empty' } });
      recordProcess({ run, entry: { launch_id: launchId(1), role: 'supabase-start', outcome: 'intent' } });
      recordProcess({ run, entry: { launch_id: launchId(1), role: 'supabase-start', outcome: 'exited', pid: 999_999, created: 'long-gone', exit_code: 0 } });
      recordProcess({ run, entry: { launch_id: launchId(2), role: 'bootstrap-post-start', outcome: 'intent' } });
      markUnaccounted({ run, entry: { launch_id: launchId(2), role: 'bootstrap-post-start', reason: 'heartbeat', ...identity } });
      return { repo, run };
    }
    const down = (repo: string, runId: string, label: string, env: Record<string, string> = {}) => {
      const calls = path.join(tmp, `calls-${label}.jsonl`);
      const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(repo, 'scripts', 'matrix-options', 'r2-fullstack-preview.ps1'), '-Command', 'down', '-RunId', runId],
        { encoding: 'utf8', env: { ...process.env, STUB_CALLS: calls, STUB_SLOT_DIR: slotDir, ...env }, timeout: 120_000, windowsHide: true });
      const recorded = fs.existsSync(calls) ? fs.readFileSync(calls, 'utf8').trim().split('\n').map((line) => JSON.parse(line) as { command: string; role: string | null }) : [];
      return { status: result.status, output: `${result.stdout}\n${result.stderr}`, commands: recorded.map((call) => call.command), recorded };
    };
    const DESTRUCTIVE = ['cli-guarded', 'teardown-check', 'run-finalize'];

    it('owned stack + live unaccounted child: zero Supabase stop, reset or teardown calls until reconciliation proves the child absent', async () => {
      const live = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore', windowsHide: true });
      children.push(live.pid!);
      let row: { pid: number; created: string | null; commandLine?: string } | undefined;
      for (let index = 0; index < 50 && !row?.commandLine; index += 1) { row = defaultProcessTable().find((entry: { pid: number }) => entry.pid === live.pid); if (!row?.commandLine) await new Promise((resolve) => setTimeout(resolve, 100)); }
      const { repo, run } = ownedRunWithUnaccounted(complete(live.pid!, row!.created!, row!.commandLine!));
      const blocked = down(repo, run.run_id, 'blocked');
      expect(blocked.status).not.toBe(0);
      expect(blocked.output).toMatch(/unaccounted_child|launched children of the run are unaccounted/);
      expect(blocked.commands).toEqual(['docker-bind', 'run-verify', 'run-lock', 'down-plan', 'run-unlock']);
      expect(blocked.commands.filter((command) => DESTRUCTIVE.includes(command))).toEqual([]);
      expect(state(run)).toMatchObject({ status: 'needs-reconcile', unaccounted: [expect.objectContaining({ accounted: null })] });
      expect(STATE_OPS.readSlot(path.join(slotDir, `slot-${run.slot}.json`))?.run_id).toBe(run.run_id);
      // The child exits; reconciliation (down-plan) proves it absent by its complete identity; only now is the stack stopped.
      await stopChild(live.pid!);
      const closed = down(repo, run.run_id, 'closed');
      expect(closed.status, closed.output).toBe(0);
      const index = closed.commands.indexOf('down-plan');
      expect(closed.recorded.filter((call) => call.command === 'cli-guarded')).toEqual([{ command: 'cli-guarded', role: 'supabase-stop', outcome: null }]);
      expect(closed.commands.indexOf('cli-guarded')).toBeGreaterThan(index);
      expect(closed.commands.slice(index)).toEqual(expect.arrayContaining(['teardown-check', 'run-finalize']));
      expect(state(run)).toMatchObject({ status: 'released', unaccounted: [expect.objectContaining({ accounted: expect.objectContaining({ result: 'absent', by: 'complete-identity' }) })] });
    }, 120_000);

    it('the bounded launcher takes the child handle before anything else, so a fast child keeps its exit code', () => {
      const bounded = textSection(read('scripts/matrix-options/r2-fullstack-preview.ps1'), 'function Invoke-Bounded', 'function Invoke-Node');
      const handle = bounded.indexOf('$null = $process.Handle');
      expect(handle).toBeGreaterThan(bounded.indexOf('Start-Process -FilePath'));
      expect(handle).toBeLessThan(bounded.indexOf('$identity = Get-ChildIdentity $process.Id'));
    });

    it('a pid-only unaccounted child keeps down refused with zero destructive calls, even when that pid no longer exists', () => {
      const { repo, run } = ownedRunWithUnaccounted({ pid: 999_998 });
      for (const label of ['first', 'second']) {
        const blocked = down(repo, run.run_id, label);
        expect(blocked.status).not.toBe(0);
        expect(blocked.commands.filter((command) => DESTRUCTIVE.includes(command))).toEqual([]);
      }
      expect(state(run)).toMatchObject({ status: 'needs-reconcile', unaccounted: [expect.objectContaining({ pid: 999_998, accounted: null })] });
    }, 120_000);

    const rowOf = async (pid: number) => {
      for (let index = 0; index < 50; index += 1) {
        const row = defaultProcessTable().find((entry: { pid: number }) => entry.pid === pid) as { pid: number; created: string | null; commandLine?: string } | undefined;
        if (row?.created && row.commandLine) return row;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      throw new Error(`process ${pid} has no complete identity`);
    };

    it('fallback: bookkeeping AND run-unaccounted fail with the holder retained; the real wrapper down issues zero CLI calls until reconciliation proves the child absent, then exactly the recorded-app shutdown', async () => {
      const repo = path.join(tmp, 'repo');
      const stubPath = path.join(repo, 'scripts', 'matrix-options', 'r2-fullstack-bootstrap', 'custody.mjs');
      fs.mkdirSync(path.dirname(stubPath), { recursive: true });
      fs.copyFileSync(WRAPPER_PS1, path.join(repo, 'scripts', 'matrix-options', 'r2-fullstack-preview.ps1'));
      fs.writeFileSync(stubPath, stub());
      // An open run that owns its stack and serves a recorded app (a real process tree rooted at the
      // run's own launch script, recorded with its complete identity).
      const run = createRun({ repoRoot: repo, candidateSha: 'inner-loop', candidateTree: null, wrapper: WRAPPER, slotDir });
      STATE_OPS.write(run.run_dir, { ...state(run), active: null, inputs: { files: [], digest: 'x' }, ownership: { stack: 'preflight-empty' } });
      recordProcess({ run, entry: { launch_id: launchId(1), role: 'supabase-start', outcome: 'intent' } });
      recordProcess({ run, entry: { launch_id: launchId(1), role: 'supabase-start', outcome: 'exited', pid: 999_999, created: 'long-gone', exit_code: 0 } });
      const launchScript = path.join(run.run_dir, `start-app-${run.run_id}.cmd`);
      fs.writeFileSync(launchScript, `@echo off\r\n"${process.execPath}" -e "setInterval(function(){},1000)"\r\n`);
      const app = spawn('cmd.exe', ['/d', '/c', launchScript], { stdio: 'ignore', windowsHide: true });
      children.push(app.pid!);
      const appRow = await rowOf(app.pid!);
      const appServer = defaultProcessTable().find((entry: { parent?: number }) => entry.parent === app.pid);
      if (appServer) children.push(appServer.pid);
      recordProcess({ run, entry: { launch_id: launchId(7), role: 'app', outcome: 'intent' } });
      setRunApp({ run, app: complete(app.pid!, appRow.created!, appRow.commandLine!), launchId: launchId(7) });
      // The child's first heartbeat cannot be written (status.json is a directory), and custody cannot
      // record the unaccounted child either: the wrapper keeps its holder record.
      fs.mkdirSync(path.join(run.run_dir, 'status.json'));
      const calls = path.join(tmp, 'calls-fallback.jsonl');
      const lines = runWrapperFunctions(['Write-Heartbeat', 'Stop-WithError', 'Invoke-CustodyRaw', 'Invoke-Custody', 'Get-OwnerArgs', 'ConvertTo-ArgString', 'Protect-Log', 'Get-ChildIdentity', 'Set-RunUnaccounted', 'Get-UnaccountedMessage', 'Invoke-Bounded', 'Unlock-RunHandle', 'Exit-Run'], [
        `$repoRoot = ${psQuote(repo)}; $owner = 'inner-loop'; $custody = ${psQuote(stubPath)}`,
        `$script:run = [pscustomobject]@{ run_id = ${psQuote(run.run_id)}; run_dir = ${psQuote(run.run_dir)} }`,
        "$script:keepHolder = $false; $script:lastLaunch = ''; $script:terminal = $false; $script:lockStream = $null; $script:locked = $false",
        "$script:run = Invoke-Custody (@('run-lock') + (Get-OwnerArgs) + @('--command', 'seed')); $script:locked = $true",
        "try { $code = Invoke-Bounded 'bootstrap-seed' 'node' @('-e', 'setInterval(function(){},1000)') 120; Write-Output ('RESULT returned ' + $code) }",
        "catch { Write-Output ('RESULT ' + $_.Exception.Message) } finally { Exit-Run }",
        "Write-Output ('KEEP ' + $script:keepHolder)",
      ].join('\r\n'), { STUB_CALLS: calls, STUB_SLOT_DIR: slotDir, STUB_FAIL_UNACCOUNTED: '1' });
      const result = lines.find((line) => line.startsWith('RESULT ')) ?? '';
      const match = /^RESULT UNACCOUNTED: bootstrap-seed \(pid (\d+)\) was launched but its heartbeat bookkeeping failed/.exec(result);
      expect(match, result).not.toBeNull();
      const childPid = Number(match![1]);
      children.push(childPid);
      expect(result).toMatch(/custody could not mark it, so the run keeps this wrapper as its holder/);
      expect(lines).toContain('KEEP True');
      expect(isAlive(childPid)).toBe(true);
      // Retained holder, no durable unaccounted entry, a complete running record of the child.
      const retained = state(run);
      expect(retained.status).toBe('created');
      expect(retained.active).toMatchObject({ command: 'seed' });
      expect(retained.unaccounted ?? []).toEqual([]);
      const record = retained.processes.find((entry: { role: string }) => entry.role === 'bootstrap-seed');
      expect(record).toMatchObject({ outcome: 'running', pid: childPid });
      expect(record.created).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(record.command_sha256).toMatch(/^[0-9a-f]{64}$/);
      fs.rmSync(path.join(run.run_dir, 'status.json'), { recursive: true });

      // down through the real wrapper while the child lives: recovery promotes it, zero CLI calls.
      const counter = path.join(tmp, 'fake-supabase-cli.log');
      const cliCalls = () => (fs.existsSync(counter) ? fs.readFileSync(counter, 'utf8').split('\n').filter(Boolean) : []);
      const blocked = down(repo, run.run_id, 'fallback-blocked', { STUB_CLI_COUNTER: counter });
      expect(blocked.status).not.toBe(0);
      expect(blocked.output).toMatch(/unaccounted/);
      expect(cliCalls()).toEqual([]);
      expect(blocked.commands.filter((command) => DESTRUCTIVE.includes(command))).toEqual([]);
      const promoted = state(run);
      expect(promoted).toMatchObject({ status: 'needs-reconcile', interrupted: [expect.objectContaining({ command: 'seed', detected_by: 'down' })] });
      // Exactly the unfinished child, with its complete identity; the recorded app is not reclassified.
      expect(promoted.unaccounted).toEqual([expect.objectContaining({ launch_id: record.launch_id, role: 'bootstrap-seed', reason: 'interrupted-holder', pid: childPid, created: record.created, command_sha256: record.command_sha256, accounted: null })]);
      expect(isAlive(app.pid!)).toBe(true);

      // A second down while it still lives: still zero calls, still in the reconciliation path.
      expect(down(repo, run.run_id, 'fallback-blocked-again', { STUB_CLI_COUNTER: counter }).status).not.toBe(0);
      expect(cliCalls()).toEqual([]);
      expect(state(run)).toMatchObject({ status: 'needs-reconcile', unaccounted: [expect.objectContaining({ accounted: null })] });

      // The child exits: reconciliation proves it absent by its complete identity; the recorded app's
      // normal shutdown follows with exactly one fake CLI call (supabase stop) and nothing else.
      await stopChild(childPid);
      const closed = down(repo, run.run_id, 'fallback-closed', { STUB_CLI_COUNTER: counter });
      expect(closed.status, closed.output).toBe(0);
      expect(cliCalls()).toEqual(['supabase-stop']);
      for (let index = 0; index < 50 && isAlive(app.pid!); index += 1) await new Promise((resolve) => setTimeout(resolve, 100));
      expect(isAlive(app.pid!)).toBe(false);
      expect(state(run)).toMatchObject({ status: 'released', unaccounted: [expect.objectContaining({ accounted: expect.objectContaining({ result: 'absent', by: 'complete-identity' }) })] });
    }, 120_000);
  });
});

describe('R4: interrupted-holder recovery promotes unfinished launches', () => {
  const at = '2026-11-21T00:00:00.000Z';
  const childIdentity = complete(4242, '2026-11-21T00:00:00.1000000Z', 'node child.js');
  const appIdentity = complete(500, '2026-11-21T00:00:01.0000000Z', 'cmd.exe /d /c start-app.cmd');
  const base = (patch: Record<string, unknown> = {}) => ({
    ownership: { stack: 'owned' }, app: appIdentity, unaccounted: [],
    processes: [
      { launch_id: launchId(1), role: 'supabase-start', outcome: 'exited', pid: 1, created: 'c1', command_sha256: null },
      { launch_id: launchId(2), role: 'bootstrap-seed', outcome: 'running', ...childIdentity },
      { launch_id: launchId(3), role: 'bootstrap-verify', outcome: 'intent', pid: null, created: null, command_sha256: null },
      { launch_id: launchId(4), role: 'bootstrap-env', outcome: 'timeout', ...childIdentity },
      { launch_id: launchId(7), role: 'app', outcome: 'running', ...appIdentity },
    ],
    ...patch,
  });

  it('every unfinished record enters the unaccounted path with its full identity; finished records and the recorded owned app do not', () => {
    const promoted = promoteUnfinishedLaunches(base(), at);
    expect(promoted.unaccounted).toEqual([
      { launch_id: launchId(2), role: 'bootstrap-seed', reason: 'interrupted-holder', ...childIdentity, reported: null, at, accounted: null },
      { launch_id: launchId(3), role: 'bootstrap-verify', reason: 'interrupted-holder', pid: null, created: null, command_sha256: null, reported: null, at, accounted: null },
    ]);
    expect(code(() => downPlan(promoted, { liveProcesses: [], unknownProcesses: [] }))).toBe('unaccounted_child');
  });

  it('an app record that is not the recorded, identity-proven owned app is promoted like any other launch', () => {
    for (const patch of [{ app: null }, { app: { ...appIdentity, created: 'other' } }, { app: { ...appIdentity, command_sha256: null } }, { ownership: { stack: 'foreign' } }]) {
      expect(promoteUnfinishedLaunches(base(patch), at).unaccounted.map((item: { role: string }) => item.role), JSON.stringify(patch)).toEqual(['bootstrap-seed', 'bootstrap-verify', 'app']);
    }
  });

  it('an existing unaccounted entry only gains fields it lacks: a complete identity is never collapsed', () => {
    const existing = { launch_id: launchId(2), role: 'bootstrap-seed', reason: 'heartbeat', pid: 4242, created: null, command_sha256: null, reported: null, at: 'earlier', accounted: null };
    const merged = promoteUnfinishedLaunches(base({ unaccounted: [existing] }), at).unaccounted.find((item: { launch_id: string }) => item.launch_id === launchId(2));
    expect(merged).toEqual({ ...existing, ...childIdentity });
    const pidOnlyRecord = base({ unaccounted: [{ ...existing, ...childIdentity }], processes: [{ launch_id: launchId(2), role: 'bootstrap-seed', outcome: 'intent', pid: 4242, created: null, command_sha256: null }] });
    expect(promoteUnfinishedLaunches(pidOnlyRecord, at).unaccounted).toEqual([{ ...existing, ...childIdentity }]);
  });

  it('lockRun promotes on interrupted-holder recovery (and only then); absence still needs complete-identity evidence', () => {
    const run = newRun(worktreeA);
    ownStack(run);
    recordProcess({ run, entry: { launch_id: launchId(2), role: 'bootstrap-seed', outcome: 'intent' } });
    recordProcess({ run, entry: { launch_id: launchId(2), role: 'bootstrap-seed', outcome: 'running', ...childIdentity } });
    // The creating wrapper takes the run normally: nothing is promoted.
    expect(code(() => lockAs(run, 'up'))).toBe('none');
    expect(state(run).unaccounted ?? []).toEqual([]);
    // That wrapper died holding the run: the next command promotes the unfinished launches.
    const next = { pid: 300, created: 't300' };
    expect(code(() => lockAs(run, 'down', next, [next]))).toBe('none');
    expect(state(run).unaccounted.map((item: { role: string; pid: number }) => [item.role, item.pid])).toEqual([['supabase-start', null], ['bootstrap-seed', 4242]]);
    const live = [{ pid: 4242, created: childIdentity.created, commandLine: 'node child.js' }];
    expect(code(() => downPlan(accountUnaccounted(state(run), live), processEvidence(state(run), live)))).toBe('unaccounted_child');
    expect(code(() => finalizeRelease({ run: prove(worktreeA, run.run_id), kind: 'released', evidence: { verified: true, liveProcesses: [], unknownProcesses: [] }, slotDir }))).toBe('unaccounted_child');
  });
});

describe('R3: fresh-tab recovery acceptance timing', () => {
  const spec = read('e2e/matrix-options-paper-r2-fullstack.spec.ts');
  it('the fresh-tab recovery assertion has a bounded timeout derived from the product grace period and heartbeat', async () => {
    const drafts = await import('@/lib/matrix-options/paper/guided-r2-local-drafts');
    expect(spec).toContain("import { GUIDED_DRAFT_CLOSED_GRACE_MS, GUIDED_DRAFT_HEARTBEAT_MS } from '../src/lib/matrix-options/paper/guided-r2-local-drafts';");
    expect(spec).toContain('const FRESH_TAB_RECOVERY_TIMEOUT_MS = GUIDED_DRAFT_CLOSED_GRACE_MS + GUIDED_DRAFT_HEARTBEAT_MS + 15_000;');
    const bound = drafts.GUIDED_DRAFT_CLOSED_GRACE_MS + drafts.GUIDED_DRAFT_HEARTBEAT_MS + 15_000;
    const config = read('playwright.r2-fullstack.config.ts');
    expect(bound).toBeGreaterThan(Number(/expect: \{ timeout: (\d+)_?(\d*) \}/.exec(config)!.slice(1).join('')));
    expect(bound).toBeLessThan(Number(/timeout: (\d+)_(\d+),/.exec(config)!.slice(1).join('')));
    // The assertion that follows the closed tab and the fresh tab, and nothing else, uses it.
    expect(spec).toContain("  await page.close();\n  page = await openPaper(context);\n  await expect(page.getByRole('status').filter({ hasText: 'Unsaved local changes recovered.' })).toBeVisible({ timeout: FRESH_TAB_RECOVERY_TIMEOUT_MS });");
    expect(spec.match(/FRESH_TAB_RECOVERY_TIMEOUT_MS/g)).toHaveLength(2);
  });
  it('the separate crash-recovery priming keeps its timing (a crashed instance silent for over 10 minutes)', () => {
    expect(spec).toContain('at: Date.now() - 11 * 60_000');
    expect(spec).toContain("await expect(page.getByRole('status').filter({ hasText: 'Saved 23 of 23. Review finished.' })).toBeVisible({ timeout: 150_000 });");
  });
});
