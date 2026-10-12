import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  powerShellChildEnv,
  resolveCanonicalProgramData,
  runPowerShellPortPreflight,
} from '../gate-preflight-programdata.mjs';

const registryOutput = '\n    Common AppData    REG_SZ    C:\\ProgramData\n';

test('registry lookup returns only a verified absolute ProgramData directory', () => {
  const source = { SystemRoot: 'C:\\Windows', PATH: 'C:\\Windows\\System32', PATHEXT: '.EXE', E2E_TEST_PASSWORD: 'synthetic-secret' };
  let probe;
  const value = resolveCanonicalProgramData({
    env: source,
    run(executable, args, options) {
      probe = { executable, args, options };
      return { status: 0, stdout: registryOutput };
    },
    realpath: (candidate) => candidate,
    stat: () => ({ isDirectory: () => true }),
  });
  assert.equal(value, 'C:\\ProgramData');
  assert.equal(probe.executable, 'C:\\Windows\\System32\\reg.exe');
  assert.deepEqual(probe.args.slice(-2), ['/v', 'Common AppData']);
  assert.deepEqual(Object.keys(probe.options.env).sort(), ['PATH', 'PATHEXT', 'SystemRoot'].sort());
  assert.equal(source.E2E_TEST_PASSWORD, 'synthetic-secret');
});

test('registry lookup rejects unexpanded, relative, non-directory and wrong-type values', () => {
  const options = { env: { SystemRoot: 'C:\\Windows' }, realpath: (candidate) => candidate, stat: () => ({ isDirectory: () => true }) };
  for (const output of [
    'Common AppData    REG_SZ    %SystemDrive%\\ProgramData',
    'Common AppData    REG_SZ    ProgramData',
    'Common AppData    REG_EXPAND_SZ    C:\\ProgramData',
  ]) {
    assert.throws(() => resolveCanonicalProgramData({ ...options, run: () => ({ status: 0, stdout: output }) }));
  }
  assert.throws(() => resolveCanonicalProgramData({ ...options, stat: () => ({ isDirectory: () => false }), run: () => ({ status: 0, stdout: registryOutput }) }));
});

test('PowerShell child receives only the added canonical key; upstream stays unchanged', () => {
  const upstream = { PATH: 'synthetic-path', E2E_TEST_PASSWORD: 'synthetic-secret', PROGRAMDATA: '%SystemDrive%\\ProgramData' };
  const snapshot = { ...upstream };
  const child = powerShellChildEnv(upstream, 'C:\\ProgramData');
  assert.deepEqual(upstream, snapshot);
  assert.equal(child.ProgramData, 'C:\\ProgramData');
  assert.equal(child.PATH, upstream.PATH);
  assert.equal(child.E2E_TEST_PASSWORD, upstream.E2E_TEST_PASSWORD);
  assert.equal(Object.keys(child).filter((name) => name.toLowerCase() === 'programdata').length, 1);
  assert.throws(() => powerShellChildEnv(upstream, '%SystemDrive%\\ProgramData'));
});

test('preparation failures skip with one fixed warning and never launch PowerShell', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'r15-gate-prep-failure-'));
  const cases = [
    () => resolveCanonicalProgramData({
      env: { SystemRoot: 'C:\\Windows' },
      run: () => ({ status: 1, stdout: 'secret registry output' }),
    }),
    () => resolveCanonicalProgramData({
      env: { SystemRoot: '%SystemDrive%\\Windows' },
      run: () => { throw new Error('registry must not run'); },
    }),
    () => resolveCanonicalProgramData({
      env: { SystemRoot: 'C:\\Windows' },
      run: () => ({ status: 0, stdout: registryOutput }),
      realpath: () => { throw new Error('secret realpath failure'); },
    }),
  ];
  for (const resolve of cases) {
    const warnings = [];
    let launches = 0;
    const status = runPowerShellPortPreflight({
      source: { SystemRoot: 'C:\\Windows', E2E_TEST_PASSWORD: 'synthetic-secret' },
      scriptPath: 'C:\\preflight.ps1',
      resolve,
      run: () => { launches += 1; throw new Error('must not launch PowerShell'); },
      warn: (message) => warnings.push(message),
    });
    assert.equal(status, 0);
    assert.equal(launches, 0);
    assert.deepEqual(warnings, ['gate-preflight: local port preflight could not be prepared; skipped.']);
    assert.doesNotMatch(warnings.join(' '), /secret|registry|realpath|SystemDrive|C:\\/i);
    assert.deepEqual(fs.readdirSync(tempRoot), []);
  }
});

test('a launched PowerShell child keeps nonzero and signal failures nonzero', () => {
  const source = { SystemRoot: 'C:\\Windows', PROGRAMDATA: '%SystemDrive%\\ProgramData' };
  const warnings = [];
  const runs = [];
  const base = {
    source, scriptPath: 'C:\\preflight.ps1', args: ['-Kill'],
    resolve: () => 'C:\\ProgramData',
    run: (executable, args, options) => {
      runs.push({ executable, args, options });
      return runs.length === 1
        ? { status: 7, signal: null, error: null }
        : { status: null, signal: 'SIGTERM', error: null };
    },
    warn: (message) => warnings.push(message),
  };
  assert.equal(runPowerShellPortPreflight(base), 7);
  assert.equal(runPowerShellPortPreflight(base), 1);
  assert.equal(runs.length, 2);
  assert.equal(runs[0].executable, 'powershell');
  assert.deepEqual(runs[0].args.slice(-2), ['C:\\preflight.ps1', '-Kill']);
  assert.equal(runs[0].options.env.ProgramData, 'C:\\ProgramData');
  assert.equal(Object.keys(runs[0].options.env).filter((name) => name.toLowerCase() === 'programdata').length, 1);
  assert.deepEqual(warnings, ['gate-preflight: preflight terminated by a signal; treating the port as unverified.']);
});

test('stripped-environment preflight leaves a temporary cwd free of literal SystemDrive', { skip: process.platform !== 'win32' }, () => {
  const runtimeNames = ['PATH', 'PATHEXT', 'SystemRoot', 'ComSpec', 'TEMP', 'TMP', 'USERPROFILE', 'LOCALAPPDATA', 'APPDATA'];
  const runtime = Object.fromEntries(runtimeNames.map((name) => {
    const actual = Object.keys(process.env).find((key) => key.toLowerCase() === name.toLowerCase());
    assert.ok(actual, `Missing runtime key ${name}`);
    return [name, process.env[actual]];
  }));
  const canonical = resolveCanonicalProgramData({ env: runtime });
  assert.ok(path.win32.isAbsolute(canonical));
  assert.equal(fs.realpathSync.native(canonical).toLowerCase(), canonical.toLowerCase());
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'r15-gate-preflight-'));
  const script = fileURLToPath(new URL('../gate-preflight.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [script], {
    cwd: tempRoot, env: runtime, encoding: 'utf8', timeout: 30_000, windowsHide: true,
  });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /PREFLIGHT OK: port 3100 is free/);
  assert.equal(fs.existsSync(path.join(tempRoot, '%SystemDrive%')), false);
  assert.equal(Object.keys(runtime).some((name) => name.toLowerCase() === 'programdata'), false);
});

test('CI still skips the Windows preflight before resolving ProgramData', { skip: process.platform !== 'win32' }, () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'r15-gate-preflight-ci-'));
  const script = fileURLToPath(new URL('../gate-preflight.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [script], {
    cwd: tempRoot, env: { CI: 'true', SystemRoot: process.env.SystemRoot },
    encoding: 'utf8', timeout: 10_000, windowsHide: true,
  });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /gate-preflight: skipped -- CI/);
  assert.equal(fs.readdirSync(tempRoot).length, 0);
});
