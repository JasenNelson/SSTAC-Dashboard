import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { validateAgyStream } from '../validate-agy-stream.mjs';

const VALIDATOR_CLI_PATH = path.resolve('tooling/agy/validate-agy-stream.mjs');

function runValidatorCli(args) {
  try {
    const stdout = execFileSync(process.execPath, [VALIDATOR_CLI_PATH, ...args], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return { exitCode: 0, stdout, stderr: '' };
  } catch (err) {
    return {
      exitCode: err.status || 1,
      stdout: err.stdout ? err.stdout.toString() : '',
      stderr: err.stderr ? err.stderr.toString() : err.message
    };
  }
}

function createTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function cleanTempDir(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {}
}

// -----------------------------------------------------------------------------
// SYNTHETIC UNIT TESTS
// -----------------------------------------------------------------------------

test('valid successful synthetic receipt accepted', () => {
  const tmpDir = createTempDir('agy-val-');
  const streamPath = path.join(tmpDir, 'stream.jsonl');
  const stderrPath = path.join(tmpDir, 'stderr.log');

  try {
    const cwd = 'C:\\tmp\\test-cwd';
    const model = 'gemini-3.1-pro-high';

    const events = [
      { event: 'init', conversation_id: 'conv-123', init: { model, cwd, permission_mode: 'request-review' } },
      { event: 'step_update', step_update: { conversation_id: 'conv-123', step_index: 0, state: 'ACTIVE', step_type: 'tool', tool_name: 'run_command', tool_info: { parameters: { CommandLine: 'npm run test:ci' } } } },
      { event: 'step_update', step_update: { conversation_id: 'conv-123', step_index: 0, state: 'DONE', step_type: 'tool', tool_name: 'run_command', tool_info: { parameters: { CommandLine: 'npm run test:ci' }, output: 'OK' } } },
      { event: 'result', result: { conversation_id: 'conv-123', status: 'SUCCESS', response: 'Task completed.', duration_seconds: 2.5, usage: { total_tokens: 500 } } }
    ];

    fs.writeFileSync(streamPath, events.map(e => JSON.stringify(e)).join('\n'));
    fs.writeFileSync(stderrPath, '');

    const verdict = validateAgyStream({
      streamPath,
      stderrPath,
      nativeExitCode: 0,
      expectedModel: model,
      expectedCwd: cwd,
      allowedCommands: ['npm run test:ci'],
      allowedReadRoots: [cwd],
      expectedStatus: 'SUCCESS'
    });

    assert.equal(verdict.status, 'GREEN');
    assert.deepEqual(verdict.reason_codes, []);
    assert.equal(verdict.conversation_id, 'conv-123');
    assert.equal(verdict.observed_tool_count, 1);
    assert.equal(verdict.duration_seconds, 2.5);
    assert.deepEqual(verdict.observed_exact_commands, ['npm run test:ci']);
  } finally {
    cleanTempDir(tmpDir);
  }
});

test('conversation mismatch between step_update and init rejected with CONVERSATION_ID_MISMATCH', () => {
  const tmpDir = createTempDir('agy-val-');
  const streamPath = path.join(tmpDir, 'stream.jsonl');
  const stderrPath = path.join(tmpDir, 'stderr.log');

  try {
    const cwd = 'C:\\tmp\\test-cwd';
    const model = 'gemini-3.1-pro-high';

    const events = [
      { event: 'init', conversation_id: 'conv-123', init: { model, cwd, permission_mode: 'request-review' } },
      { event: 'step_update', step_update: { conversation_id: 'conv-OTHER', step_index: 0, state: 'ACTIVE', step_type: 'tool', tool_name: 'run_command', tool_info: { parameters: { CommandLine: 'npm run test:ci' } } } },
      { event: 'result', result: { conversation_id: 'conv-123', status: 'SUCCESS', response: 'Task completed.' } }
    ];

    fs.writeFileSync(streamPath, events.map(e => JSON.stringify(e)).join('\n'));
    fs.writeFileSync(stderrPath, '');

    const verdict = validateAgyStream({ streamPath, stderrPath, nativeExitCode: 0, expectedModel: model, expectedCwd: cwd, allowedCommands: ['npm run test:ci'], allowedReadRoots: [cwd] });
    assert.equal(verdict.status, 'RED');
    assert.ok(verdict.reason_codes.includes('CONVERSATION_ID_MISMATCH'));
  } finally {
    cleanTempDir(tmpDir);
  }
});

test('path mutation between ACTIVE and DONE rejected with INVALID_TOOL_LIFECYCLE', () => {
  const tmpDir = createTempDir('agy-val-');
  const streamPath = path.join(tmpDir, 'stream.jsonl');
  const stderrPath = path.join(tmpDir, 'stderr.log');

  try {
    const cwd = 'C:\\tmp\\test-cwd';
    const file1 = 'C:\\tmp\\test-cwd\\file1.txt';
    const file2 = 'C:\\tmp\\test-cwd\\file2.txt';

    const events = [
      { event: 'init', conversation_id: 'conv-123', init: { model: 'gemini-3.1-pro-high', cwd, permission_mode: 'request-review' } },
      { event: 'step_update', step_update: { conversation_id: 'conv-123', step_index: 0, state: 'ACTIVE', step_type: 'tool', tool_name: 'view_file', tool_info: { parameters: { AbsolutePath: file1 } } } },
      { event: 'step_update', step_update: { conversation_id: 'conv-123', step_index: 0, state: 'DONE', step_type: 'tool', tool_name: 'view_file', tool_info: { parameters: { AbsolutePath: file2 } } } },
      { event: 'result', result: { conversation_id: 'conv-123', status: 'SUCCESS', response: 'Task completed.' } }
    ];

    fs.writeFileSync(streamPath, events.map(e => JSON.stringify(e)).join('\n'));
    fs.writeFileSync(stderrPath, '');

    const verdict = validateAgyStream({ streamPath, stderrPath, nativeExitCode: 0, expectedModel: 'gemini-3.1-pro-high', expectedCwd: cwd, allowedReadRoots: [cwd] });
    assert.equal(verdict.status, 'RED');
    assert.ok(verdict.reason_codes.includes('INVALID_TOOL_LIFECYCLE'));
  } finally {
    cleanTempDir(tmpDir);
  }
});

test('command line mutation between ACTIVE and DONE rejected with INVALID_TOOL_LIFECYCLE', () => {
  const tmpDir = createTempDir('agy-val-');
  const streamPath = path.join(tmpDir, 'stream.jsonl');
  const stderrPath = path.join(tmpDir, 'stderr.log');

  try {
    const cwd = 'C:\\tmp\\test-cwd';

    const events = [
      { event: 'init', conversation_id: 'conv-123', init: { model: 'gemini-3.1-pro-high', cwd, permission_mode: 'request-review' } },
      { event: 'step_update', step_update: { conversation_id: 'conv-123', step_index: 0, state: 'ACTIVE', step_type: 'tool', tool_name: 'run_command', tool_info: { parameters: { CommandLine: 'npm run test:ci' } } } },
      { event: 'step_update', step_update: { conversation_id: 'conv-123', step_index: 0, state: 'DONE', step_type: 'tool', tool_name: 'run_command', tool_info: { parameters: { CommandLine: 'npm run pwned' } } } },
      { event: 'result', result: { conversation_id: 'conv-123', status: 'SUCCESS', response: 'Task completed.' } }
    ];

    fs.writeFileSync(streamPath, events.map(e => JSON.stringify(e)).join('\n'));
    fs.writeFileSync(stderrPath, '');

    const verdict = validateAgyStream({ streamPath, stderrPath, nativeExitCode: 0, expectedModel: 'gemini-3.1-pro-high', expectedCwd: cwd, allowedCommands: ['npm run test:ci', 'npm run pwned'], allowedReadRoots: [cwd] });
    assert.equal(verdict.status, 'RED');
    assert.ok(verdict.reason_codes.includes('INVALID_TOOL_LIFECYCLE'));
  } finally {
    cleanTempDir(tmpDir);
  }
});

test('tool-bearing event with step_type not tool rejected with INVALID_TOOL_LIFECYCLE', () => {
  const tmpDir = createTempDir('agy-val-');
  const streamPath = path.join(tmpDir, 'stream.jsonl');
  const stderrPath = path.join(tmpDir, 'stderr.log');

  try {
    const cwd = 'C:\\tmp\\test-cwd';

    const events = [
      { event: 'init', conversation_id: 'conv-123', init: { model: 'gemini-3.1-pro-high', cwd, permission_mode: 'request-review' } },
      { event: 'step_update', step_update: { conversation_id: 'conv-123', step_index: 0, state: 'ACTIVE', step_type: 'agent_thought', tool_name: 'view_file', tool_info: { parameters: { AbsolutePath: 'C:\\tmp\\test-cwd\\f.txt' } } } },
      { event: 'result', result: { conversation_id: 'conv-123', status: 'SUCCESS', response: 'Task completed.' } }
    ];

    fs.writeFileSync(streamPath, events.map(e => JSON.stringify(e)).join('\n'));
    fs.writeFileSync(stderrPath, '');

    const verdict = validateAgyStream({ streamPath, stderrPath, nativeExitCode: 0, expectedModel: 'gemini-3.1-pro-high', expectedCwd: cwd, allowedReadRoots: [cwd] });
    assert.equal(verdict.status, 'RED');
    assert.ok(verdict.reason_codes.includes('INVALID_TOOL_LIFECYCLE'));
  } finally {
    cleanTempDir(tmpDir);
  }
});

test('model slug mismatch without punctuation stripping rejected', () => {
  const tmpDir = createTempDir('agy-val-');
  const streamPath = path.join(tmpDir, 'stream.jsonl');
  const stderrPath = path.join(tmpDir, 'stderr.log');

  try {
    const cwd = 'C:\\tmp\\test-cwd';

    const events = [
      { event: 'init', conversation_id: 'conv-123', init: { model: 'gemini-3.1-pro-high', cwd, permission_mode: 'request-review' } },
      { event: 'result', result: { conversation_id: 'conv-123', status: 'SUCCESS', response: 'ok' } }
    ];

    fs.writeFileSync(streamPath, events.map(e => JSON.stringify(e)).join('\n'));
    fs.writeFileSync(stderrPath, '');

    const verdict = validateAgyStream({ streamPath, stderrPath, nativeExitCode: 0, expectedModel: 'gemini31prohigh', expectedCwd: cwd, allowedReadRoots: [cwd] });
    assert.equal(verdict.status, 'RED');
    assert.ok(verdict.reason_codes.includes('INIT_MODEL_MISMATCH'));
  } finally {
    cleanTempDir(tmpDir);
  }
});

test('absent or empty expectedModel is rejected with INIT_MODEL_MISMATCH', () => {
  const tmpDir = createTempDir('agy-mod-');
  const streamPath = path.join(tmpDir, 'stream.jsonl');
  const stderrPath = path.join(tmpDir, 'stderr.log');
  const cwd = 'C:\\tmp\\test-cwd';

  try {
    const events = [
      { event: 'init', conversation_id: 'c1', init: { model: 'gemini-3.1-pro-high', cwd, permission_mode: 'request-review' } },
      { event: 'result', result: { conversation_id: 'c1', status: 'SUCCESS', response: 'ok' } }
    ];
    fs.writeFileSync(streamPath, events.map(e => JSON.stringify(e)).join('\n'));
    fs.writeFileSync(stderrPath, '');

    const v1 = validateAgyStream({ streamPath, stderrPath, nativeExitCode: 0, expectedModel: undefined, expectedCwd: cwd, allowedReadRoots: [cwd] });
    assert.equal(v1.status, 'RED');
    assert.ok(v1.reason_codes.includes('INIT_MODEL_MISMATCH'));

    const v2 = validateAgyStream({ streamPath, stderrPath, nativeExitCode: 0, expectedModel: '   ', expectedCwd: cwd, allowedReadRoots: [cwd] });
    assert.equal(v2.status, 'RED');
    assert.ok(v2.reason_codes.includes('INIT_MODEL_MISMATCH'));
  } finally {
    cleanTempDir(tmpDir);
  }
});

test('denied read root nested inside allowed workspace root returns READ_PATH_DENIED', () => {
  const tmpDir = createTempDir('agy-den-');
  const streamPath = path.join(tmpDir, 'stream.jsonl');
  const stderrPath = path.join(tmpDir, 'stderr.log');
  const cwd = 'C:\\tmp\\test-cwd';

  try {
    const events = [
      { event: 'init', conversation_id: 'c1', init: { model: 'm', cwd, permission_mode: 'request-review' } },
      { event: 'step_update', step_update: { conversation_id: 'c1', step_index: 0, state: 'ACTIVE', step_type: 'tool', tool_name: 'view_file', tool_info: { parameters: { AbsolutePath: 'C:\\tmp\\test-cwd\\.env.canary' } } } },
      { event: 'step_update', step_update: { conversation_id: 'c1', step_index: 0, state: 'DONE', step_type: 'tool', tool_name: 'view_file', tool_info: { parameters: { AbsolutePath: 'C:\\tmp\\test-cwd\\.env.canary' } } } },
      { event: 'result', result: { conversation_id: 'c1', status: 'SUCCESS', response: 'ok' } }
    ];
    fs.writeFileSync(streamPath, events.map(e => JSON.stringify(e)).join('\n'));
    fs.writeFileSync(stderrPath, '');

    const verdict = validateAgyStream({
      streamPath,
      stderrPath,
      nativeExitCode: 0,
      expectedModel: 'm',
      expectedCwd: cwd,
      allowedReadRoots: [cwd],
      deniedReadRoots: ['C:\\tmp\\test-cwd\\.env.canary'],
      deniedWriteRoots: ['C:\\tmp\\test-cwd\\.env.canary']
    });

    assert.equal(verdict.status, 'RED');
    assert.ok(verdict.reason_codes.includes('READ_PATH_DENIED'));
  } finally {
    cleanTempDir(tmpDir);
  }
});

test('denied write root nested inside allowed write root returns WRITE_PATH_DENIED', () => {
  const tmpDir = createTempDir('agy-den-w-');
  const streamPath = path.join(tmpDir, 'stream.jsonl');
  const stderrPath = path.join(tmpDir, 'stderr.log');
  const cwd = 'C:\\tmp\\test-cwd';

  try {
    const events = [
      { event: 'init', conversation_id: 'c1', init: { model: 'm', cwd, permission_mode: 'request-review' } },
      { event: 'step_update', step_update: { conversation_id: 'c1', step_index: 0, state: 'ACTIVE', step_type: 'tool', tool_name: 'write_to_file', tool_info: { parameters: { TargetFile: 'C:\\tmp\\test-cwd\\protected\\secret.txt' } } } },
      { event: 'step_update', step_update: { conversation_id: 'c1', step_index: 0, state: 'DONE', step_type: 'tool', tool_name: 'write_to_file', tool_info: { parameters: { TargetFile: 'C:\\tmp\\test-cwd\\protected\\secret.txt' } } } },
      { event: 'result', result: { conversation_id: 'c1', status: 'SUCCESS', response: 'ok' } }
    ];
    fs.writeFileSync(streamPath, events.map(e => JSON.stringify(e)).join('\n'));
    fs.writeFileSync(stderrPath, '');

    const verdict = validateAgyStream({
      streamPath,
      stderrPath,
      nativeExitCode: 0,
      expectedModel: 'm',
      expectedCwd: cwd,
      allowedReadRoots: [cwd],
      allowedWriteRoots: [cwd],
      deniedReadRoots: ['C:\\tmp\\test-cwd\\protected'],
      deniedWriteRoots: ['C:\\tmp\\test-cwd\\protected']
    });

    assert.equal(verdict.status, 'RED');
    assert.ok(verdict.reason_codes.includes('WRITE_PATH_DENIED'));
  } finally {
    cleanTempDir(tmpDir);
  }
});

test('list_permissions tool invocation parameterless is allowed and GREEN', () => {
  const tmpDir = createTempDir('agy-lp-');
  const streamPath = path.join(tmpDir, 'stream.jsonl');
  const stderrPath = path.join(tmpDir, 'stderr.log');
  const cwd = 'C:\\tmp\\test-cwd';

  try {
    const events = [
      { event: 'init', conversation_id: 'c1', init: { model: 'm', cwd, permission_mode: 'request-review' } },
      { event: 'step_update', step_update: { conversation_id: 'c1', step_index: 0, state: 'ACTIVE', step_type: 'tool', tool_name: 'list_permissions', tool_info: { parameters: {} } } },
      { event: 'step_update', step_update: { conversation_id: 'c1', step_index: 0, state: 'DONE', step_type: 'tool', tool_name: 'list_permissions', tool_info: { parameters: {} } } },
      { event: 'result', result: { conversation_id: 'c1', status: 'SUCCESS', response: 'ok' } }
    ];
    fs.writeFileSync(streamPath, events.map(e => JSON.stringify(e)).join('\n'));
    fs.writeFileSync(stderrPath, '');

    const verdict = validateAgyStream({
      streamPath,
      stderrPath,
      nativeExitCode: 0,
      expectedModel: 'm',
      expectedCwd: cwd,
      allowedReadRoots: [cwd]
    });

    assert.equal(verdict.status, 'GREEN');
    assert.ok(verdict.observed_tool_names.includes('list_permissions'));
  } finally {
    cleanTempDir(tmpDir);
  }
});

test('list_permissions with parameters is rejected with FORBIDDEN_OR_UNKNOWN_TOOL', () => {
  const tmpDir = createTempDir('agy-lp-param-');
  const streamPath = path.join(tmpDir, 'stream.jsonl');
  const stderrPath = path.join(tmpDir, 'stderr.log');
  const cwd = 'C:\\tmp\\test-cwd';

  try {
    const events = [
      { event: 'init', conversation_id: 'c1', init: { model: 'm', cwd, permission_mode: 'request-review' } },
      { event: 'step_update', step_update: { conversation_id: 'c1', step_index: 0, state: 'ACTIVE', step_type: 'tool', tool_name: 'list_permissions', tool_info: { parameters: { invalidParam: true } } } },
      { event: 'result', result: { conversation_id: 'c1', status: 'SUCCESS', response: 'ok' } }
    ];
    fs.writeFileSync(streamPath, events.map(e => JSON.stringify(e)).join('\n'));
    fs.writeFileSync(stderrPath, '');

    const verdict = validateAgyStream({
      streamPath,
      stderrPath,
      nativeExitCode: 0,
      expectedModel: 'm',
      expectedCwd: cwd,
      allowedReadRoots: [cwd]
    });

    assert.equal(verdict.status, 'RED');
    assert.ok(verdict.reason_codes.includes('FORBIDDEN_OR_UNKNOWN_TOOL'));
  } finally {
    cleanTempDir(tmpDir);
  }
});

test('relative paths rejected in inputs and stream file tools', () => {
  const tmpDir = createTempDir('agy-val-');
  const streamPath = path.join(tmpDir, 'stream.jsonl');
  const stderrPath = path.join(tmpDir, 'stderr.log');

  try {
    const events = [
      { event: 'init', conversation_id: 'c1', init: { model: 'm', cwd: 'relative/cwd', permission_mode: 'request-review' } },
      { event: 'result', result: { conversation_id: 'c1', status: 'SUCCESS', response: 'ok' } }
    ];
    fs.writeFileSync(streamPath, events.map(e => JSON.stringify(e)).join('\n'));
    fs.writeFileSync(stderrPath, '');

    const v1 = validateAgyStream({ streamPath, stderrPath, nativeExitCode: 0, expectedModel: 'm', expectedCwd: 'relative/cwd', allowedReadRoots: ['C:\\tmp'] });
    assert.equal(v1.status, 'RED');
    assert.ok(v1.reason_codes.includes('INIT_CWD_MISMATCH'));

    const v2 = validateAgyStream({ streamPath, stderrPath, nativeExitCode: 0, expectedModel: 'm', expectedCwd: 'C:\\tmp', allowedReadRoots: ['relative/root'] });
    assert.equal(v2.status, 'RED');
    assert.ok(v2.reason_codes.includes('READ_PATH_OUTSIDE_SCOPE'));
  } finally {
    cleanTempDir(tmpDir);
  }
});

test('missing or invalid native exit code rejected', () => {
  const tmpDir = createTempDir('agy-val-');
  const streamPath = path.join(tmpDir, 'stream.jsonl');
  const stderrPath = path.join(tmpDir, 'stderr.log');
  const cwd = 'C:\\tmp\\test-cwd';

  try {
    fs.writeFileSync(streamPath, JSON.stringify({ event: 'init', conversation_id: 'c1', init: { model: 'm', cwd, permission_mode: 'request-review' } }) + '\n' + JSON.stringify({ event: 'result', result: { conversation_id: 'c1', status: 'SUCCESS', response: 'ok' } }) + '\n');
    fs.writeFileSync(stderrPath, '');

    const v1 = validateAgyStream({ streamPath, stderrPath, expectedModel: 'm', expectedCwd: cwd, allowedReadRoots: [cwd] });
    assert.equal(v1.status, 'RED');
    assert.ok(v1.reason_codes.includes('NATIVE_EXIT_CODE_MISSING'));

    const v2 = validateAgyStream({ streamPath, stderrPath, nativeExitCode: 'abc', expectedModel: 'm', expectedCwd: cwd, allowedReadRoots: [cwd] });
    assert.equal(v2.status, 'RED');
    assert.ok(v2.reason_codes.includes('NATIVE_EXIT_CODE_INVALID'));
  } finally {
    cleanTempDir(tmpDir);
  }
});

test('missing stderr file rejected with STDERR_MISSING', () => {
  const tmpDir = createTempDir('agy-val-');
  const streamPath = path.join(tmpDir, 'stream.jsonl');
  const cwd = 'C:\\tmp\\test-cwd';

  try {
    fs.writeFileSync(streamPath, JSON.stringify({ event: 'init', conversation_id: 'c1', init: { model: 'm', cwd, permission_mode: 'request-review' } }) + '\n' + JSON.stringify({ event: 'result', result: { conversation_id: 'c1', status: 'SUCCESS', response: 'ok' } }) + '\n');

    const v = validateAgyStream({ streamPath, stderrPath: path.join(tmpDir, 'nonexistent.log'), nativeExitCode: 0, expectedModel: 'm', expectedCwd: cwd, allowedReadRoots: [cwd] });
    assert.equal(v.status, 'RED');
    assert.ok(v.reason_codes.includes('STDERR_MISSING'));
  } finally {
    cleanTempDir(tmpDir);
  }
});

test('missing conversation_id rejected', () => {
  const tmpDir = createTempDir('agy-val-');
  const streamPath = path.join(tmpDir, 'stream.jsonl');
  const stderrPath = path.join(tmpDir, 'stderr.log');
  const cwd = 'C:\\tmp\\test-cwd';

  try {
    fs.writeFileSync(streamPath, JSON.stringify({ event: 'init', init: { model: 'm', cwd, permission_mode: 'request-review' } }) + '\n' + JSON.stringify({ event: 'result', result: { status: 'SUCCESS', response: 'ok' } }) + '\n');
    fs.writeFileSync(stderrPath, '');

    const v = validateAgyStream({ streamPath, stderrPath, nativeExitCode: 0, expectedModel: 'm', expectedCwd: cwd, allowedReadRoots: [cwd] });
    assert.equal(v.status, 'RED');
    assert.ok(v.reason_codes.includes('CONVERSATION_ID_MISSING'));
  } finally {
    cleanTempDir(tmpDir);
  }
});

// -----------------------------------------------------------------------------
// VALIDATOR CLI CONTRACT TESTS (R3-9 & R4-2)
// -----------------------------------------------------------------------------

test('validator CLI rejects unknown flag with CLI_ARGUMENT_INVALID', () => {
  const res = runValidatorCli(['--unknown-flag']);
  assert.notEqual(res.exitCode, 0);
  const json = JSON.parse(res.stdout);
  assert.equal(json.status, 'RED');
  assert.ok(json.reason_codes.includes('CLI_ARGUMENT_INVALID'));
});

test('validator CLI rejects missing required singleton with CLI_ARGUMENT_INVALID', () => {
  const res = runValidatorCli(['--stream', 's.jsonl', '--stderr', 'e.log']);
  assert.notEqual(res.exitCode, 0);
  const json = JSON.parse(res.stdout);
  assert.equal(json.status, 'RED');
  assert.ok(json.reason_codes.includes('CLI_ARGUMENT_INVALID'));
});

test('validator CLI rejects duplicate singleton with CLI_ARGUMENT_INVALID', () => {
  const res = runValidatorCli([
    '--stream', 's.jsonl',
    '--stream', 's2.jsonl',
    '--stderr', 'e.log',
    '--exit-code', '0',
    '--expected-model', 'm',
    '--expected-cwd', 'C:\\tmp',
    '--allowed-read-root', 'C:\\tmp',
    '--denied-read-root', 'C:\\tmp\\denied',
    '--denied-write-root', 'C:\\tmp\\denied'
  ]);
  assert.notEqual(res.exitCode, 0);
  const json = JSON.parse(res.stdout);
  assert.equal(json.status, 'RED');
  assert.ok(json.reason_codes.includes('CLI_ARGUMENT_INVALID'));
});

test('validator CLI rejects empty/missing flag value with CLI_ARGUMENT_INVALID', () => {
  const res = runValidatorCli([
    '--stream',
    '--stderr', 'e.log',
    '--exit-code', '0',
    '--expected-model', 'm',
    '--expected-cwd', 'C:\\tmp'
  ]);
  assert.notEqual(res.exitCode, 0);
  const json = JSON.parse(res.stdout);
  assert.equal(json.status, 'RED');
  assert.ok(json.reason_codes.includes('CLI_ARGUMENT_INVALID'));
});

test('validator CLI requires denied read and write roots', () => {
  const resNoDenied = runValidatorCli([
    '--stream', 's.jsonl',
    '--stderr', 'e.log',
    '--exit-code', '0',
    '--expected-model', 'm',
    '--expected-cwd', 'C:\\tmp',
    '--allowed-read-root', 'C:\\tmp'
  ]);
  assert.notEqual(resNoDenied.exitCode, 0);
  const jsonNoDenied = JSON.parse(resNoDenied.stdout);
  assert.equal(jsonNoDenied.status, 'RED');
  assert.ok(jsonNoDenied.reason_codes.includes('CLI_ARGUMENT_INVALID'));

  const resRelDeniedRead = runValidatorCli([
    '--stream', 's.jsonl',
    '--stderr', 'e.log',
    '--exit-code', '0',
    '--expected-model', 'm',
    '--expected-cwd', 'C:\\tmp',
    '--allowed-read-root', 'C:\\tmp',
    '--denied-read-root', 'relative/denied',
    '--denied-write-root', 'C:\\tmp\\denied'
  ]);
  assert.notEqual(resRelDeniedRead.exitCode, 0);
  const jsonRelRead = JSON.parse(resRelDeniedRead.stdout);
  assert.equal(jsonRelRead.status, 'RED');
  assert.ok(jsonRelRead.reason_codes.includes('READ_PATH_DENIED'));

  const resRelDeniedWrite = runValidatorCli([
    '--stream', 's.jsonl',
    '--stderr', 'e.log',
    '--exit-code', '0',
    '--expected-model', 'm',
    '--expected-cwd', 'C:\\tmp',
    '--allowed-read-root', 'C:\\tmp',
    '--denied-read-root', 'C:\\tmp\\denied',
    '--denied-write-root', 'relative/denied'
  ]);
  assert.notEqual(resRelDeniedWrite.exitCode, 0);
  const jsonRelWrite = JSON.parse(resRelDeniedWrite.stdout);
  assert.equal(jsonRelWrite.status, 'RED');
  assert.ok(jsonRelWrite.reason_codes.includes('WRITE_PATH_DENIED'));
});

test('validator CLI rejects relative allowed read root with READ_PATH_OUTSIDE_SCOPE', () => {
  const res = runValidatorCli([
    '--stream', 's.jsonl',
    '--stderr', 'e.log',
    '--exit-code', '0',
    '--expected-model', 'm',
    '--expected-cwd', 'C:\\tmp',
    '--allowed-read-root', 'relative/path',
    '--denied-read-root', 'C:\\tmp\\denied',
    '--denied-write-root', 'C:\\tmp\\denied'
  ]);
  assert.notEqual(res.exitCode, 0);
  const json = JSON.parse(res.stdout);
  assert.equal(json.status, 'RED');
  assert.ok(json.reason_codes.includes('READ_PATH_OUTSIDE_SCOPE'));
});

test('validator CLI rejects relative expected CWD with INIT_CWD_MISMATCH', () => {
  const res = runValidatorCli([
    '--stream', 's.jsonl',
    '--stderr', 'e.log',
    '--exit-code', '0',
    '--expected-model', 'm',
    '--expected-cwd', 'relative/cwd',
    '--allowed-read-root', 'C:\\tmp',
    '--denied-read-root', 'C:\\tmp\\denied',
    '--denied-write-root', 'C:\\tmp\\denied'
  ]);
  assert.notEqual(res.exitCode, 0);
  const json = JSON.parse(res.stdout);
  assert.equal(json.status, 'RED');
  assert.ok(json.reason_codes.includes('INIT_CWD_MISMATCH'));
});

test('validator CLI rejects absent allowed write root when write tool is present with WRITE_PATH_OUTSIDE_SCOPE', () => {
  const tmpDir = createTempDir('agy-cli-val-');
  const streamPath = path.join(tmpDir, 'stream.jsonl');
  const stderrPath = path.join(tmpDir, 'stderr.log');
  const cwd = 'C:\\tmp\\test-cwd';

  try {
    const events = [
      { event: 'init', conversation_id: 'conv-123', init: { model: 'm', cwd, permission_mode: 'request-review' } },
      { event: 'step_update', step_update: { conversation_id: 'conv-123', step_index: 0, state: 'ACTIVE', step_type: 'tool', tool_name: 'write_to_file', tool_info: { parameters: { TargetFile: 'C:\\tmp\\test-cwd\\out.txt' } } } },
      { event: 'step_update', step_update: { conversation_id: 'conv-123', step_index: 0, state: 'DONE', step_type: 'tool', tool_name: 'write_to_file', tool_info: { parameters: { TargetFile: 'C:\\tmp\\test-cwd\\out.txt' } } } },
      { event: 'result', result: { conversation_id: 'conv-123', status: 'SUCCESS', response: 'ok' } }
    ];
    fs.writeFileSync(streamPath, events.map(e => JSON.stringify(e)).join('\n'));
    fs.writeFileSync(stderrPath, '');

    const res = runValidatorCli([
      '--stream', streamPath,
      '--stderr', stderrPath,
      '--exit-code', '0',
      '--expected-model', 'm',
      '--expected-cwd', cwd,
      '--allowed-read-root', cwd,
      '--denied-read-root', path.join(cwd, '.env'),
      '--denied-write-root', path.join(cwd, '.env')
    ]);

    assert.notEqual(res.exitCode, 0);
    const json = JSON.parse(res.stdout);
    assert.equal(json.status, 'RED');
    assert.ok(json.reason_codes.includes('WRITE_PATH_OUTSIDE_SCOPE'));
  } finally {
    cleanTempDir(tmpDir);
  }
});
