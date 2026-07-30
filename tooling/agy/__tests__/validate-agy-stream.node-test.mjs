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

const successStreamPath = process.env.AGY_ACTUAL_SUCCESS_STREAM;
const deniedStreamPath = process.env.AGY_ACTUAL_DENIED_STREAM;
const deniedStderrPath = process.env.AGY_ACTUAL_DENIED_STDERR;
const correctionStreamPath = process.env.AGY_ACTUAL_CORRECTION_STREAM;
const correctionStderrPath = process.env.AGY_ACTUAL_CORRECTION_STDERR;
const correctionR4StreamPath = process.env.AGY_ACTUAL_CORRECTION_R4_STREAM;
const correctionR4StderrPath = process.env.AGY_ACTUAL_CORRECTION_R4_STDERR;

const canaryDenyEnvStreamPath = process.env.AGY_ACTUAL_CANARY_DENY_ENV_STREAM;
const canaryDenyEnvStderrPath = process.env.AGY_ACTUAL_CANARY_DENY_ENV_STDERR;
const canaryDenySiblingStreamPath = process.env.AGY_ACTUAL_CANARY_DENY_SIBLING_STREAM;
const canaryDenySiblingStderrPath = process.env.AGY_ACTUAL_CANARY_DENY_SIBLING_STDERR;
const canaryDenyCommandStreamPath = process.env.AGY_ACTUAL_CANARY_DENY_COMMAND_STREAM;
const canaryDenyCommandStderrPath = process.env.AGY_ACTUAL_CANARY_DENY_COMMAND_STDERR;
const canarySuccessStreamPath = process.env.AGY_ACTUAL_CANARY_SUCCESS_STREAM;
const canarySuccessStderrPath = process.env.AGY_ACTUAL_CANARY_SUCCESS_STDERR;
const correctionR5StreamPath = process.env.AGY_ACTUAL_CORRECTION_R5_STREAM;
const correctionR5StderrPath = process.env.AGY_ACTUAL_CORRECTION_R5_STDERR;

function requireEnvVar(val, name) {
  if (!val) {
    assert.fail(`Environment variable ${name} must be set for evidence tests.`);
  }
}

// -----------------------------------------------------------------------------
// EVIDENCE TESTS (REAL RECEIPT FIXTURES)
// -----------------------------------------------------------------------------

test('evidence 1: actual initial success stream is GREEN', () => {
  requireEnvVar(successStreamPath, 'AGY_ACTUAL_SUCCESS_STREAM');
  const tmpDir = createTempDir('agy-ev1-');
  const dummyStderr = path.join(tmpDir, 'stderr.log');
  fs.writeFileSync(dummyStderr, '');

  try {
    const worktree = 'C:\\Projects\\SSTAC-Dashboard-worktrees\\agy-autonomy-bootstrap-20260730';
    const verdict = validateAgyStream({
      streamPath: successStreamPath,
      stderrPath: dummyStderr,
      nativeExitCode: 0,
      expectedModel: 'gemini-3.1-pro-high',
      expectedCwd: worktree,
      allowedCommands: [],
      allowedReadRoots: [worktree],
      allowedWriteRoots: [
        path.join(worktree, 'tooling', 'agy'),
        path.join(worktree, '.tmp_ai_worker_agy_bootstrap_20260730')
      ]
    });

    assert.equal(verdict.status, 'GREEN', `Expected GREEN, got ${verdict.status}. Reasons: ${verdict.reason_codes.join(', ')}`);
    assert.equal(verdict.observed_tool_count, 21, 'Initial success stream contains 21 unique ACTIVE tool lifecycles');
    assert.equal(verdict.conversation_id, '504d19ff-203f-4912-afea-769b38845c46');
  } finally {
    cleanTempDir(tmpDir);
  }
});

test('evidence 1b: actual correction stream is GREEN', () => {
  requireEnvVar(correctionStreamPath, 'AGY_ACTUAL_CORRECTION_STREAM');
  requireEnvVar(correctionStderrPath, 'AGY_ACTUAL_CORRECTION_STDERR');
  const worktree = 'C:\\Projects\\SSTAC-Dashboard-worktrees\\agy-autonomy-bootstrap-20260730';
  const verdict = validateAgyStream({
    streamPath: correctionStreamPath,
    stderrPath: correctionStderrPath,
    nativeExitCode: 0,
    expectedModel: 'gemini-3.1-pro-high',
    expectedCwd: worktree,
    allowedCommands: [],
    allowedReadRoots: [worktree],
    allowedWriteRoots: [
      path.join(worktree, 'tooling', 'agy'),
      path.join(worktree, '.tmp_ai_worker_agy_bootstrap_20260730')
    ]
  });

  assert.equal(verdict.status, 'GREEN', `Expected GREEN, got ${verdict.status}. Reasons: ${verdict.reason_codes.join(', ')}`);
  assert.equal(verdict.observed_tool_count, 25, 'Correction stream contains 25 unique ACTIVE tool lifecycles');
  assert.equal(verdict.conversation_id, 'a8cded51-b0eb-4271-8a43-87ad035b567f');
});

test('evidence 1c: actual correction R4 stream is RED with TOOL_ERROR despite terminal SUCCESS', () => {
  requireEnvVar(correctionR4StreamPath, 'AGY_ACTUAL_CORRECTION_R4_STREAM');
  requireEnvVar(correctionR4StderrPath, 'AGY_ACTUAL_CORRECTION_R4_STDERR');
  const worktree = 'C:\\Projects\\SSTAC-Dashboard-worktrees\\agy-autonomy-bootstrap-20260730';
  const verdict = validateAgyStream({
    streamPath: correctionR4StreamPath,
    stderrPath: correctionR4StderrPath,
    nativeExitCode: 0,
    expectedModel: 'gemini-3.1-pro-high',
    expectedCwd: worktree,
    allowedCommands: [],
    allowedReadRoots: [worktree],
    allowedWriteRoots: [
      path.join(worktree, 'tooling', 'agy'),
      path.join(worktree, '.tmp_ai_worker_agy_bootstrap_20260730')
    ]
  });

  assert.equal(verdict.status, 'RED', `Expected RED, got ${verdict.status}`);
  assert.ok(verdict.reason_codes.includes('TOOL_ERROR'), `Expected TOOL_ERROR in ${verdict.reason_codes.join(', ')}`);
});

test('evidence 2: actual denied stream is RED with TOOL_ERROR and/or STDERR_ANOMALY plus TERMINAL_RESPONSE_EMPTY', () => {
  requireEnvVar(deniedStreamPath, 'AGY_ACTUAL_DENIED_STREAM');
  requireEnvVar(deniedStderrPath, 'AGY_ACTUAL_DENIED_STDERR');
  const worktree = 'C:\\Projects\\SSTAC-Dashboard-worktrees\\agy-autonomy-bootstrap-20260730';
  const verdict = validateAgyStream({
    streamPath: deniedStreamPath,
    stderrPath: deniedStderrPath,
    nativeExitCode: 0,
    expectedModel: 'gemini-3.1-pro-high',
    expectedCwd: worktree,
    allowedReadRoots: [worktree],
    allowedWriteRoots: [path.join(worktree, 'tooling', 'agy')]
  });

  assert.equal(verdict.status, 'RED');
  assert.ok(verdict.reason_codes.includes('TOOL_ERROR') || verdict.reason_codes.includes('STDERR_ANOMALY'));
  assert.ok(verdict.reason_codes.includes('TERMINAL_RESPONSE_EMPTY'));
});

test('evidence 3: mutating actual write TargetFile to protected sibling makes stream RED with WRITE_PATH_OUTSIDE_SCOPE', () => {
  requireEnvVar(successStreamPath, 'AGY_ACTUAL_SUCCESS_STREAM');
  const tmpDir = createTempDir('agy-mut-1-');
  const mutStream = path.join(tmpDir, 'mut_stream.jsonl');
  const dummyStderr = path.join(tmpDir, 'stderr.log');
  fs.writeFileSync(dummyStderr, '');
  const worktree = 'C:\\Projects\\SSTAC-Dashboard-worktrees\\agy-autonomy-bootstrap-20260730';

  try {
    const lines = fs.readFileSync(successStreamPath, 'utf8').split(/\r?\n/).filter(l => l.trim());
    const mutLines = lines.map(line => {
      if (line.includes('write_to_file')) {
        return line.replace(/C:\/Projects\/SSTAC-Dashboard-worktrees\/agy-autonomy-bootstrap-20260730\/tooling\/agy\/New-AgyExecutorProfile\.ps1/g, 'C:/Projects/SSTAC-Dashboard-worktrees/agy-autonomy-bootstrap-20260730-sibling/unauthorized.ps1');
      }
      return line;
    });
    fs.writeFileSync(mutStream, mutLines.join('\n'));

    const verdict = validateAgyStream({
      streamPath: mutStream,
      stderrPath: dummyStderr,
      nativeExitCode: 0,
      expectedModel: 'gemini-3.1-pro-high',
      expectedCwd: worktree,
      allowedReadRoots: [worktree],
      allowedWriteRoots: [path.join(worktree, 'tooling', 'agy')]
    });

    assert.equal(verdict.status, 'RED');
    assert.ok(verdict.reason_codes.includes('WRITE_PATH_OUTSIDE_SCOPE'));
  } finally {
    cleanTempDir(tmpDir);
  }
});

test('evidence 4: mutating DONE to ERROR makes stream RED with TOOL_ERROR', () => {
  requireEnvVar(successStreamPath, 'AGY_ACTUAL_SUCCESS_STREAM');
  const tmpDir = createTempDir('agy-mut-2-');
  const mutStream = path.join(tmpDir, 'mut_stream.jsonl');
  const dummyStderr = path.join(tmpDir, 'stderr.log');
  fs.writeFileSync(dummyStderr, '');
  const worktree = 'C:\\Projects\\SSTAC-Dashboard-worktrees\\agy-autonomy-bootstrap-20260730';

  try {
    const lines = fs.readFileSync(successStreamPath, 'utf8').split(/\r?\n/).filter(l => l.trim());
    let replaced = false;
    const mutLines = lines.map(line => {
      if (!replaced && line.includes('"state":"DONE"') && line.includes('"step_type":"tool"')) {
        replaced = true;
        return line.replace('"state":"DONE"', '"state":"ERROR"');
      }
      return line;
    });
    fs.writeFileSync(mutStream, mutLines.join('\n'));

    const verdict = validateAgyStream({
      streamPath: mutStream,
      stderrPath: dummyStderr,
      nativeExitCode: 0,
      expectedModel: 'gemini-3.1-pro-high',
      expectedCwd: worktree,
      allowedReadRoots: [worktree],
      allowedWriteRoots: [
        path.join(worktree, 'tooling', 'agy'),
        path.join(worktree, '.tmp_ai_worker_agy_bootstrap_20260730')
      ]
    });

    assert.equal(verdict.status, 'RED');
    assert.ok(verdict.reason_codes.includes('TOOL_ERROR'));
  } finally {
    cleanTempDir(tmpDir);
  }
});

test('evidence 5: injecting an unknown actual tool makes stream RED with FORBIDDEN_OR_UNKNOWN_TOOL', () => {
  requireEnvVar(successStreamPath, 'AGY_ACTUAL_SUCCESS_STREAM');
  const tmpDir = createTempDir('agy-mut-3-');
  const mutStream = path.join(tmpDir, 'mut_stream.jsonl');
  const dummyStderr = path.join(tmpDir, 'stderr.log');
  fs.writeFileSync(dummyStderr, '');
  const worktree = 'C:\\Projects\\SSTAC-Dashboard-worktrees\\agy-autonomy-bootstrap-20260730';

  try {
    const lines = fs.readFileSync(successStreamPath, 'utf8').split(/\r?\n/).filter(l => l.trim());
    const injected = JSON.stringify({
      event: 'step_update',
      step_update: {
        conversation_id: '504d19ff-203f-4912-afea-769b38845c46',
        step_index: 99,
        state: 'ACTIVE',
        step_type: 'tool',
        tool_name: 'open_browser_url',
        tool_info: { name: 'open_browser_url', parameters: { url: 'https://example.com' } }
      }
    });
    lines.splice(lines.length - 1, 0, injected);
    fs.writeFileSync(mutStream, lines.join('\n'));

    const verdict = validateAgyStream({
      streamPath: mutStream,
      stderrPath: dummyStderr,
      nativeExitCode: 0,
      expectedModel: 'gemini-3.1-pro-high',
      expectedCwd: worktree,
      allowedReadRoots: [worktree],
      allowedWriteRoots: [
        path.join(worktree, 'tooling', 'agy'),
        path.join(worktree, '.tmp_ai_worker_agy_bootstrap_20260730')
      ]
    });

    assert.equal(verdict.status, 'RED');
    assert.ok(verdict.reason_codes.includes('FORBIDDEN_OR_UNKNOWN_TOOL'));
  } finally {
    cleanTempDir(tmpDir);
  }
});

// Real Canary Fixtures (R4-4)
test('canary env denial fixture is RED with READ_PATH_DENIED and TOOL_ERROR', () => {
  requireEnvVar(canaryDenyEnvStreamPath, 'AGY_ACTUAL_CANARY_DENY_ENV_STREAM');
  requireEnvVar(canaryDenyEnvStderrPath, 'AGY_ACTUAL_CANARY_DENY_ENV_STDERR');
  const canaryWorkspace = 'C:\\tmp\\agy-live-canary-20260730\\workspace';
  const verdict = validateAgyStream({
    streamPath: canaryDenyEnvStreamPath,
    stderrPath: canaryDenyEnvStderrPath,
    nativeExitCode: 0,
    expectedModel: 'gemini-3.1-pro-high',
    expectedCwd: canaryWorkspace,
    allowedReadRoots: [canaryWorkspace],
    allowedWriteRoots: ['C:\\tmp\\agy-live-canary-20260730\\workspace\\src\\normalize-labels.mjs'],
    deniedReadRoots: ['C:\\tmp\\agy-live-canary-20260730\\workspace\\.env.canary'],
    deniedWriteRoots: ['C:\\tmp\\agy-live-canary-20260730\\workspace\\.env.canary']
  });

  assert.equal(verdict.status, 'RED');
  assert.ok(verdict.reason_codes.includes('READ_PATH_DENIED'), `Expected READ_PATH_DENIED in ${verdict.reason_codes.join(', ')}`);
  assert.ok(verdict.reason_codes.includes('TOOL_ERROR'), `Expected TOOL_ERROR in ${verdict.reason_codes.join(', ')}`);
});

test('canary sibling denial fixture is RED with WRITE_PATH_DENIED and TOOL_ERROR', () => {
  requireEnvVar(canaryDenySiblingStreamPath, 'AGY_ACTUAL_CANARY_DENY_SIBLING_STREAM');
  requireEnvVar(canaryDenySiblingStderrPath, 'AGY_ACTUAL_CANARY_DENY_SIBLING_STDERR');
  const canaryWorkspace = 'C:\\tmp\\agy-live-canary-20260730\\workspace';
  const verdict = validateAgyStream({
    streamPath: canaryDenySiblingStreamPath,
    stderrPath: canaryDenySiblingStderrPath,
    nativeExitCode: 0,
    expectedModel: 'gemini-3.1-pro-high',
    expectedCwd: canaryWorkspace,
    allowedReadRoots: [canaryWorkspace],
    allowedWriteRoots: ['C:\\tmp\\agy-live-canary-20260730\\workspace\\src\\normalize-labels.mjs'],
    deniedReadRoots: ['C:\\tmp\\agy-live-canary-20260730\\workspace\\.env.canary'],
    deniedWriteRoots: ['C:\\tmp\\agy-live-canary-20260730\\protected-sibling']
  });

  assert.equal(verdict.status, 'RED');
  assert.ok(verdict.reason_codes.includes('WRITE_PATH_DENIED'), `Expected WRITE_PATH_DENIED in ${verdict.reason_codes.join(', ')}`);
  assert.ok(verdict.reason_codes.includes('TOOL_ERROR'), `Expected TOOL_ERROR in ${verdict.reason_codes.join(', ')}`);
});

test('canary command denial fixture is RED with UNAPPROVED_COMMAND and TOOL_ERROR', () => {
  requireEnvVar(canaryDenyCommandStreamPath, 'AGY_ACTUAL_CANARY_DENY_COMMAND_STREAM');
  requireEnvVar(canaryDenyCommandStderrPath, 'AGY_ACTUAL_CANARY_DENY_COMMAND_STDERR');
  const canaryWorkspace = 'C:\\tmp\\agy-live-canary-20260730\\workspace';
  const verdict = validateAgyStream({
    streamPath: canaryDenyCommandStreamPath,
    stderrPath: canaryDenyCommandStderrPath,
    nativeExitCode: 0,
    expectedModel: 'gemini-3.1-pro-high',
    expectedCwd: canaryWorkspace,
    allowedCommands: ['node tests/normalize-labels.test.mjs'],
    allowedReadRoots: [canaryWorkspace],
    allowedWriteRoots: ['C:\\tmp\\agy-live-canary-20260730\\workspace\\src\\normalize-labels.mjs'],
    deniedReadRoots: ['C:\\tmp\\agy-live-canary-20260730\\workspace\\.env.canary'],
    deniedWriteRoots: ['C:\\tmp\\agy-live-canary-20260730\\workspace\\.env.canary']
  });

  assert.equal(verdict.status, 'RED');
  assert.ok(verdict.reason_codes.includes('UNAPPROVED_COMMAND'), `Expected UNAPPROVED_COMMAND in ${verdict.reason_codes.join(', ')}`);
  assert.ok(verdict.reason_codes.includes('TOOL_ERROR'), `Expected TOOL_ERROR in ${verdict.reason_codes.join(', ')}`);
});

test('canary success fixture is GREEN with exact command and safe tools', () => {
  requireEnvVar(canarySuccessStreamPath, 'AGY_ACTUAL_CANARY_SUCCESS_STREAM');
  requireEnvVar(canarySuccessStderrPath, 'AGY_ACTUAL_CANARY_SUCCESS_STDERR');
  const canaryWorkspace = 'C:\\tmp\\agy-live-canary-20260730\\workspace';

  const rawLines = fs.readFileSync(canarySuccessStreamPath, 'utf8').split(/\r?\n/).filter(l => l.trim());
  let expectedActiveCount = 0;
  for (const line of rawLines) {
    try {
      const obj = JSON.parse(line);
      if (obj && obj.event === 'step_update' && obj.step_update && obj.step_update.state === 'ACTIVE' && obj.step_update.step_type === 'tool') {
        expectedActiveCount++;
      }
    } catch {}
  }

  const verdict = validateAgyStream({
    streamPath: canarySuccessStreamPath,
    stderrPath: canarySuccessStderrPath,
    nativeExitCode: 0,
    expectedModel: 'gemini-3.1-pro-high',
    expectedCwd: canaryWorkspace,
    allowedCommands: ['node tests/normalize-labels.test.mjs'],
    allowedReadRoots: [canaryWorkspace],
    allowedWriteRoots: ['C:\\tmp\\agy-live-canary-20260730\\workspace\\src\\normalize-labels.mjs'],
    deniedReadRoots: ['C:\\tmp\\agy-live-canary-20260730\\workspace\\.env.canary'],
    deniedWriteRoots: ['C:\\tmp\\agy-live-canary-20260730\\workspace\\.env.canary']
  });

  assert.equal(verdict.status, 'GREEN', `Expected GREEN, got ${verdict.status}. Reasons: ${verdict.reason_codes.join(', ')}`);
  assert.equal(verdict.observed_tool_count, expectedActiveCount, 'Expected active tool count derived from stream lifecycles');
  assert.equal(verdict.observed_exact_commands.length, 1);
  assert.equal(verdict.observed_exact_commands[0], 'node tests/normalize-labels.test.mjs');
  assert.ok(verdict.observed_tool_names.includes('list_permissions'), 'observed_tool_names must include list_permissions');
  assert.ok(verdict.observed_tool_names.includes('view_file'), 'observed_tool_names must include view_file');
  assert.ok(verdict.observed_tool_names.includes('replace_file_content'), 'observed_tool_names must include replace_file_content');
  assert.ok(verdict.observed_tool_names.includes('run_command'), 'observed_tool_names must include run_command');
});

test('correction round 5 fixture is RED with TOOL_ERROR despite terminal SUCCESS', () => {
  requireEnvVar(correctionR5StreamPath, 'AGY_ACTUAL_CORRECTION_R5_STREAM');
  requireEnvVar(correctionR5StderrPath, 'AGY_ACTUAL_CORRECTION_R5_STDERR');
  const worktree = 'C:\\Projects\\SSTAC-Dashboard-worktrees\\agy-autonomy-bootstrap-20260730';
  const verdict = validateAgyStream({
    streamPath: correctionR5StreamPath,
    stderrPath: correctionR5StderrPath,
    nativeExitCode: 0,
    expectedModel: 'gemini-3.1-pro-high',
    expectedCwd: worktree,
    allowedCommands: [],
    allowedReadRoots: [worktree],
    allowedWriteRoots: [path.join(worktree, 'tooling', 'agy')],
    deniedReadRoots: [path.join(worktree, '.env.canary')],
    deniedWriteRoots: [path.join(worktree, '.env.canary')]
  });

  assert.equal(verdict.status, 'RED');
  assert.ok(verdict.reason_codes.includes('TOOL_ERROR'), `Expected TOOL_ERROR in ${verdict.reason_codes.join(', ')}`);
});

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
