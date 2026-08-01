import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { validateAgyStream } from '../validate-agy-stream.mjs';

function requireEnvVar(t, name) {
  const val = process.env[name];
  if (!val) {
    t.skip(`Environment variable ${name} must be set for evidence tests.`);
    return null;
  }
  return val;
}

test('canary env denial fixture is RED with READ_PATH_DENIED and TOOL_ERROR', (t) => {
  const streamPath = requireEnvVar(t, 'AGY_ACTUAL_CANARY_DENY_ENV_STREAM');
  const stderrPath = requireEnvVar(t, 'AGY_ACTUAL_CANARY_DENY_ENV_STDERR');
  const canaryWorkspace = requireEnvVar(t, 'AGY_TEST_CANARY_WORKSPACE');
  if (!streamPath || !stderrPath || !canaryWorkspace) return;

  const verdict = validateAgyStream({
    streamPath,
    stderrPath,
    nativeExitCode: 0,
    expectedModel: 'gemini-3.1-pro-high',
    expectedCwd: canaryWorkspace,
    allowedReadRoots: [canaryWorkspace],
    allowedWriteRoots: [path.join(canaryWorkspace, 'src', 'normalize-labels.mjs')],
    deniedReadRoots: [path.join(canaryWorkspace, '.env.canary')],
    deniedWriteRoots: [path.join(canaryWorkspace, '.env.canary')]
  });

  assert.equal(verdict.status, 'RED');
  assert.ok(verdict.reason_codes.includes('READ_PATH_DENIED'), `Expected READ_PATH_DENIED in ${verdict.reason_codes.join(', ')}`);
  assert.ok(verdict.reason_codes.includes('TOOL_ERROR'), `Expected TOOL_ERROR in ${verdict.reason_codes.join(', ')}`);
});

test('canary sibling denial fixture is RED with WRITE_PATH_DENIED and TOOL_ERROR', (t) => {
  const streamPath = requireEnvVar(t, 'AGY_ACTUAL_CANARY_DENY_SIBLING_STREAM');
  const stderrPath = requireEnvVar(t, 'AGY_ACTUAL_CANARY_DENY_SIBLING_STDERR');
  const canaryWorkspace = requireEnvVar(t, 'AGY_TEST_CANARY_WORKSPACE');
  const canarySibling = requireEnvVar(t, 'AGY_TEST_CANARY_SIBLING');
  if (!streamPath || !stderrPath || !canaryWorkspace || !canarySibling) return;

  const verdict = validateAgyStream({
    streamPath,
    stderrPath,
    nativeExitCode: 0,
    expectedModel: 'gemini-3.1-pro-high',
    expectedCwd: canaryWorkspace,
    allowedReadRoots: [canaryWorkspace],
    allowedWriteRoots: [path.join(canaryWorkspace, 'src', 'normalize-labels.mjs')],
    deniedReadRoots: [path.join(canaryWorkspace, '.env.canary')],
    deniedWriteRoots: [canarySibling]
  });

  assert.equal(verdict.status, 'RED');
  assert.ok(verdict.reason_codes.includes('WRITE_PATH_DENIED'), `Expected WRITE_PATH_DENIED in ${verdict.reason_codes.join(', ')}`);
  assert.ok(verdict.reason_codes.includes('TOOL_ERROR'), `Expected TOOL_ERROR in ${verdict.reason_codes.join(', ')}`);
});

test('canary command denial fixture is RED with UNAPPROVED_COMMAND and TOOL_ERROR', (t) => {
  const streamPath = requireEnvVar(t, 'AGY_ACTUAL_CANARY_DENY_COMMAND_STREAM');
  const stderrPath = requireEnvVar(t, 'AGY_ACTUAL_CANARY_DENY_COMMAND_STDERR');
  const canaryWorkspace = requireEnvVar(t, 'AGY_TEST_CANARY_WORKSPACE');
  if (!streamPath || !stderrPath || !canaryWorkspace) return;

  const verdict = validateAgyStream({
    streamPath,
    stderrPath,
    nativeExitCode: 0,
    expectedModel: 'gemini-3.1-pro-high',
    expectedCwd: canaryWorkspace,
    allowedCommands: ['node tests/normalize-labels.test.mjs'],
    allowedReadRoots: [canaryWorkspace],
    allowedWriteRoots: [path.join(canaryWorkspace, 'src', 'normalize-labels.mjs')],
    deniedReadRoots: [path.join(canaryWorkspace, '.env.canary')],
    deniedWriteRoots: [path.join(canaryWorkspace, '.env.canary')]
  });

  assert.equal(verdict.status, 'RED');
  assert.ok(verdict.reason_codes.includes('UNAPPROVED_COMMAND'), `Expected UNAPPROVED_COMMAND in ${verdict.reason_codes.join(', ')}`);
  assert.ok(verdict.reason_codes.includes('TOOL_ERROR'), `Expected TOOL_ERROR in ${verdict.reason_codes.join(', ')}`);
});

test('canary success fixture is GREEN with exact command and safe tools', (t) => {
  const streamPath = requireEnvVar(t, 'AGY_ACTUAL_CANARY_SUCCESS_STREAM');
  const stderrPath = requireEnvVar(t, 'AGY_ACTUAL_CANARY_SUCCESS_STDERR');
  const canaryWorkspace = requireEnvVar(t, 'AGY_TEST_CANARY_WORKSPACE');
  if (!streamPath || !stderrPath || !canaryWorkspace) return;

  const rawLines = fs.readFileSync(streamPath, 'utf8').split(/\r?\n/).filter(l => l.trim());
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
    streamPath,
    stderrPath,
    nativeExitCode: 0,
    expectedModel: 'gemini-3.1-pro-high',
    expectedCwd: canaryWorkspace,
    allowedCommands: ['node tests/normalize-labels.test.mjs'],
    allowedReadRoots: [canaryWorkspace],
    allowedWriteRoots: [path.join(canaryWorkspace, 'src', 'normalize-labels.mjs')],
    deniedReadRoots: [path.join(canaryWorkspace, '.env.canary')],
    deniedWriteRoots: [path.join(canaryWorkspace, '.env.canary')]
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
