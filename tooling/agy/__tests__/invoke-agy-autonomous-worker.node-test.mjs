import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const CONTROLLER_SCRIPT_PATH = path.resolve('tooling/agy/Invoke-AgyAutonomousWorker.ps1');

function getSha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function runPwshScript(args, env = {}) {
  try {
    const stdout = execFileSync('pwsh', ['-NoProfile', '-File', CONTROLLER_SCRIPT_PATH, ...args], {
      encoding: 'utf8',
      env: { ...process.env, ...env },
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

function createFakeAgyScript(dir) {
  const fixturePath = path.join(dir, 'fake-agy-fixture.cjs');
  const cmdPath = path.join(dir, 'fake-agy.cmd');
  const breadcrumbPath = path.join(dir, 'launch_breadcrumb.txt');

  const fixtureContent = `
const fs = require('node:fs');
const args = process.argv.slice(2);

const customVersion = process.env.FAKE_AGY_VERSION_OUTPUT;
const versionExitCode = process.env.FAKE_AGY_VERSION_EXIT_CODE !== undefined
  ? parseInt(process.env.FAKE_AGY_VERSION_EXIT_CODE, 10)
  : 0;

if (args[0] === '--version') {
  const ver = customVersion !== undefined ? customVersion : '1.1.8';
  if (ver !== null && ver !== '') {
    process.stdout.write(ver + '\\n');
  }
  process.exit(versionExitCode);
}

// Worker mode execution
if (process.env.FAKE_AGY_RECORD_ARGS) {
  fs.writeFileSync(${JSON.stringify(breadcrumbPath)}, args.join('\\n') + '\\n', 'utf8');
} else {
  fs.writeFileSync(${JSON.stringify(breadcrumbPath)}, 'launched\\n', 'utf8');
}

if (process.env.FAKE_AGY_MUTATE_SETTINGS === 'MODIFY') {
  const settingsPath = require('node:path').join(process.env.USERPROFILE, '.gemini', 'antigravity-cli', 'settings.json');
  if (fs.existsSync(settingsPath)) {
    const content = fs.readFileSync(settingsPath, 'utf8');
    fs.writeFileSync(settingsPath, content + ' ', 'utf8');
  }
} else if (process.env.FAKE_AGY_MUTATE_SETTINGS === 'DELETE') {
  const settingsPath = require('node:path').join(process.env.USERPROFILE, '.gemini', 'antigravity-cli', 'settings.json');
  if (fs.existsSync(settingsPath)) {
    fs.unlinkSync(settingsPath);
  }
}

let logFile = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--log-file' && (i + 1) < args.length) {
    logFile = args[i + 1];
    break;
  }
}

if (logFile) {
  if (process.env.FAKE_AGY_LOG_TEXT !== undefined) {
    fs.writeFileSync(logFile, process.env.FAKE_AGY_LOG_TEXT, 'utf8');
  } else {
    fs.writeFileSync(logFile, '2026-07-30T14:30:00Z [INFO] AGY diagnostic log\\n', 'utf8');
  }
}

if (process.env.FAKE_AGY_STREAM_FILE && fs.existsSync(process.env.FAKE_AGY_STREAM_FILE)) {
  process.stdout.write(fs.readFileSync(process.env.FAKE_AGY_STREAM_FILE, 'utf8'));
} else if (process.env.FAKE_AGY_STREAM_CONTENT !== undefined) {
  process.stdout.write(process.env.FAKE_AGY_STREAM_CONTENT);
}

if (process.env.FAKE_AGY_STDERR_TEXT !== undefined) {
  process.stderr.write(process.env.FAKE_AGY_STDERR_TEXT + '\\n');
}

const workerExitCode = process.env.FAKE_AGY_EXIT_CODE !== undefined
  ? parseInt(process.env.FAKE_AGY_EXIT_CODE, 10)
  : 0;

process.exit(workerExitCode);
`;

  fs.writeFileSync(fixturePath, fixtureContent.replace(/\r?\n/g, '\n'), 'utf8');

  const nodeExec = process.execPath;
  const cmdContent = `@echo off\n"${nodeExec}" "${fixturePath}" %*\nexit /b %ERRORLEVEL%\n`;
  fs.writeFileSync(cmdPath, cmdContent.replace(/\r?\n/g, '\n'), 'utf8');

  return { cmdPath, breadcrumbPath };
}

function createCustomVersionFakeAgy(dir, versionOutput, exitCode = 0) {
  const id = Math.random().toString(36).substring(2);
  const fixturePath = path.join(dir, `version-agy-${id}.cjs`);
  const cmdPath = path.join(dir, `version-agy-${id}.cmd`);
  const breadcrumbPath = path.join(dir, `version-breadcrumb-${id}.txt`);

  const fixtureContent = `
const fs = require('node:fs');
const args = process.argv.slice(2);

if (args[0] === '--version') {
  const ver = ${versionOutput !== null ? JSON.stringify(versionOutput) : 'null'};
  if (ver !== null && ver !== '') {
    process.stdout.write(ver + '\\n');
  }
  process.exit(${exitCode});
}

// Worker mode execution
fs.writeFileSync(${JSON.stringify(breadcrumbPath)}, 'launched\\n', 'utf8');

let logFile = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--log-file' && (i + 1) < args.length) {
    logFile = args[i + 1];
    break;
  }
}

if (logFile) {
  if (process.env.FAKE_AGY_LOG_TEXT !== undefined) {
    fs.writeFileSync(logFile, process.env.FAKE_AGY_LOG_TEXT, 'utf8');
  } else {
    fs.writeFileSync(logFile, '2026-07-30T14:30:00Z [INFO] AGY diagnostic log\\n', 'utf8');
  }
}

if (process.env.FAKE_AGY_STREAM_FILE && fs.existsSync(process.env.FAKE_AGY_STREAM_FILE)) {
  process.stdout.write(fs.readFileSync(process.env.FAKE_AGY_STREAM_FILE, 'utf8'));
} else if (process.env.FAKE_AGY_STREAM_CONTENT !== undefined) {
  process.stdout.write(process.env.FAKE_AGY_STREAM_CONTENT);
}

if (process.env.FAKE_AGY_STDERR_TEXT !== undefined) {
  process.stderr.write(process.env.FAKE_AGY_STDERR_TEXT + '\\n');
}

const workerExitCode = process.env.FAKE_AGY_EXIT_CODE !== undefined
  ? parseInt(process.env.FAKE_AGY_EXIT_CODE, 10)
  : 0;

process.exit(workerExitCode);
`;

  fs.writeFileSync(fixturePath, fixtureContent.replace(/\r?\n/g, '\n'), 'utf8');

  const nodeExec = process.execPath;
  const cmdContent = `@echo off\n"${nodeExec}" "${fixturePath}" %*\nexit /b %ERRORLEVEL%\n`;
  fs.writeFileSync(cmdPath, cmdContent.replace(/\r?\n/g, '\n'), 'utf8');

  return { cmdPath, breadcrumbPath };
}

function createValidStreamFile(dir, cwd, model = 'gemini-3.1-pro-high') {
  const streamPath = path.join(dir, 'valid_stream.jsonl');
  const events = [
    { event: 'init', conversation_id: 'conv-123', init: { model, cwd, permission_mode: 'request-review' } },
    { event: 'step_update', step_update: { conversation_id: 'conv-123', step_index: 0, state: 'ACTIVE', step_type: 'tool', tool_name: 'view_file', tool_info: { parameters: { AbsolutePath: path.join(cwd, 'README.md') } } } },
    { event: 'step_update', step_update: { conversation_id: 'conv-123', step_index: 0, state: 'DONE', step_type: 'tool', tool_name: 'view_file', tool_info: { parameters: { AbsolutePath: path.join(cwd, 'README.md') } } } },
    { event: 'result', result: { conversation_id: 'conv-123', status: 'SUCCESS', response: 'Completed work unit successfully.' } }
  ];
  fs.writeFileSync(streamPath, events.map(e => JSON.stringify(e)).join('\n') + '\n', 'utf8');
  return streamPath;
}

function initGitWorkspace(workspaceDir) {
  try {
    execFileSync('git', ['init'], { cwd: workspaceDir, stdio: 'ignore' });
    try { execFileSync('git', ['checkout', '-b', 'main'], { cwd: workspaceDir, stdio: 'ignore' }); } catch(e) {}
    execFileSync('git', ['config', 'user.name', 'AGY Test Worker'], { cwd: workspaceDir, stdio: 'ignore' });
    execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: workspaceDir, stdio: 'ignore' });

    const dummyFile = path.join(workspaceDir, 'README.md');
    fs.writeFileSync(dummyFile, '# Test Workspace\n', 'utf8');

    execFileSync('git', ['add', 'README.md'], { cwd: workspaceDir, stdio: 'ignore' });
    execFileSync('git', ['commit', '-m', 'Initial commit'], { cwd: workspaceDir, stdio: 'ignore' });

    const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: workspaceDir, encoding: 'utf8' }).trim();
    const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: workspaceDir, encoding: 'utf8' }).trim();

    return { head, branch };
  } catch (err) {
    throw new Error(`Failed to initialize git test workspace: ${err.message}`);
  }
}

// -----------------------------------------------------------------------------
// STATIC & FORMAL INVARIANT TESTS
// -----------------------------------------------------------------------------

test('static analysis: controller uses foreground invocation and contains no forbidden process APIs', () => {
  const content = fs.readFileSync(CONTROLLER_SCRIPT_PATH, 'utf8');

  const forbiddenApis = [
    'Start-Process',
    'Start-Job',
    'System.Diagnostics.Process',
    'Get-WmiObject',
    'Get-CimInstance',
    'schtasks',
    'taskkill',
    'Stop-Process',
    'Tee-Object'
  ];

  for (const api of forbiddenApis) {
    assert.equal(
      content.includes(api),
      false,
      `Controller script must not contain forbidden API '${api}'`
    );
  }

  assert.ok(
    content.includes('& $resolvedAgyExec'),
    'Controller script must use PowerShell call operator & $resolvedAgyExec for AGY foreground execution'
  );
});

test('plain ASCII and LF line endings verification for all authored files', () => {
  const authoredFiles = [
    'tooling/agy/Invoke-AgyAutonomousWorker.ps1',
    'tooling/agy/__tests__/invoke-agy-autonomous-worker.node-test.mjs',
    'tooling/agy/README.md',
    'docs/AGY_USAGE.md',
    'SSTAC_AI_PIPELINE.md'
  ];

  for (const relPath of authoredFiles) {
    const absPath = path.resolve(relPath);
    if (!fs.existsSync(absPath)) continue;

    const rawBuffer = fs.readFileSync(absPath);
    for (let i = 0; i < rawBuffer.length; i++) {
      const byte = rawBuffer[i];
      assert.ok(
        byte <= 127,
        `File '${relPath}' contains non-ASCII byte 0x${byte.toString(16)} at index ${i}`
      );
    }

    const text = rawBuffer.toString('ascii');
    assert.equal(
      text.includes('\r\n'),
      false,
      `File '${relPath}' must use LF line endings, but contains CRLF`
    );
  }
});

test('affirmative --sandbox argument is passed to worker', () => {
  const workspaceDir = createTempDir('agy-sandbox-ws-');
  const profileDir = createTempDir('agy-sandbox-prof-');
  const receiptDir = createTempDir('agy-sandbox-rcpt-');
  const fakeAgyDir = createTempDir('agy-sandbox-fake-');

  try {
    initGitWorkspace(workspaceDir);
    const headHash = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: workspaceDir, encoding: 'utf8' }).trim();

    const promptFile = path.join(workspaceDir, 'PROMPT.md');
    fs.writeFileSync(promptFile, 'Test sandbox arg\n', 'utf8');
    const promptHash = getSha256('Test sandbox arg\n');

    const writableDir = path.join(workspaceDir, 'tooling');
    fs.mkdirSync(writableDir, { recursive: true });

    const { cmdPath, breadcrumbPath } = createFakeAgyScript(fakeAgyDir);
    const validStreamPath = createValidStreamFile(fakeAgyDir, workspaceDir);

    const res = runPwshScript([
      '-WorkspaceRoot', workspaceDir,
      '-PromptFile', promptFile,
      '-ExpectedPromptSha256', promptHash,
      '-ProfileRoot', profileDir,
      '-ReceiptRoot', receiptDir,
      '-WritablePaths', writableDir,
      '-ExpectedBaselineHead', headHash,
      '-ExpectedBranch', 'main',
      '-AgyExecutable', cmdPath
    ], {
      FAKE_AGY_STREAM_FILE: validStreamPath,
      FAKE_AGY_RECORD_ARGS: '1'
    });

    assert.equal(res.exitCode, 0, 'Should launch successfully');
    assert.ok(fs.existsSync(breadcrumbPath), 'Worker launched');
    const capturedArgs = fs.readFileSync(breadcrumbPath, 'utf8').split('\n');
    assert.ok(capturedArgs.includes('--sandbox'), 'Must pass affirmative --sandbox argument');
    const sandboxArgs = capturedArgs.filter(a => a.startsWith('--sandbox'));
    assert.equal(sandboxArgs.length, 1, 'Must have exactly one standalone --sandbox token');
    assert.equal(sandboxArgs[0], '--sandbox', 'Sandbox token must not have an attached value');
    const sandboxIdx = capturedArgs.indexOf('--sandbox');
    if (sandboxIdx >= 0 && sandboxIdx < capturedArgs.length - 1) {
      assert.ok(!['false', '0', 'no', 'off'].includes(capturedArgs[sandboxIdx + 1].toLowerCase()), 'Must not have an adjacent disabling value');
    }

  } finally {
    cleanTempDir(workspaceDir);
    cleanTempDir(profileDir);
    cleanTempDir(receiptDir);
    cleanTempDir(fakeAgyDir);
  }
});

test('controller rejects nonempty AllowedCommands before worker launch', () => {
  const workspaceDir = createTempDir('agy-allowcmd-ws-');
  const profileDir = createTempDir('agy-allowcmd-prof-');
  const receiptDir = createTempDir('agy-allowcmd-rcpt-');
  const fakeAgyDir = createTempDir('agy-allowcmd-fake-');

  try {
    initGitWorkspace(workspaceDir);
    const headHash = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: workspaceDir, encoding: 'utf8' }).trim();

    const promptFile = path.join(workspaceDir, 'PROMPT.md');
    fs.writeFileSync(promptFile, 'Test allowed cmds\n', 'utf8');
    const promptHash = getSha256('Test allowed cmds\n');

    const writableDir = path.join(workspaceDir, 'tooling');
    fs.mkdirSync(writableDir, { recursive: true });

    const { cmdPath, breadcrumbPath } = createFakeAgyScript(fakeAgyDir);

    const res = runPwshScript([
      '-WorkspaceRoot', workspaceDir,
      '-PromptFile', promptFile,
      '-ExpectedPromptSha256', promptHash,
      '-ProfileRoot', profileDir,
      '-ReceiptRoot', receiptDir,
      '-WritablePaths', writableDir,
      '-ExpectedBaselineHead', headHash,
      '-ExpectedBranch', 'main',
      '-AgyExecutable', cmdPath,
      '-AllowedCommands', 'npm run build'
    ], {});

    assert.notEqual(res.exitCode, 0, 'Should fail closed when AllowedCommands is not empty');
    assert.ok(res.stderr.includes('rejects all AllowedCommands'), 'Must emit explicit rejection message');
    assert.ok(!fs.existsSync(breadcrumbPath), 'Worker must not launch');

  } finally {
    cleanTempDir(workspaceDir);
    cleanTempDir(profileDir);
    cleanTempDir(receiptDir);
    cleanTempDir(fakeAgyDir);
  }
});

// -----------------------------------------------------------------------------
// DYNAMIC FUNCTIONAL TESTS
// -----------------------------------------------------------------------------

test('happy path foreground launcher execution returns GREEN with complete receipts', () => {
  const workspaceDir = createTempDir('agy-ctrl-ws-');
  const profileDir = createTempDir('agy-ctrl-prof-');
  const receiptDir = createTempDir('agy-ctrl-rcpt-');
  const fakeAgyDir = createTempDir('agy-ctrl-fake-');

  try {
    const { head, branch } = initGitWorkspace(workspaceDir);
    const promptFile = path.join(workspaceDir, 'PROMPT.md');
    const promptContent = 'Execute bounded unit test.\n';
    fs.writeFileSync(promptFile, promptContent, 'utf8');
    const promptHash = getSha256(promptContent);

    const writableDir = path.join(workspaceDir, 'tooling');
    fs.mkdirSync(writableDir, { recursive: true });

    const { cmdPath: fakeAgyPath, breadcrumbPath } = createFakeAgyScript(fakeAgyDir);
    const validStreamPath = createValidStreamFile(fakeAgyDir, workspaceDir);

    const res = runPwshScript([
      '-WorkspaceRoot', workspaceDir,
      '-PromptFile', promptFile,
      '-ExpectedPromptSha256', promptHash,
      '-ProfileRoot', profileDir,
      '-ReceiptRoot', receiptDir,
      '-WritablePaths', writableDir,
      '-ExpectedBaselineHead', head,
      '-ExpectedBranch', 'main',
      '-AgyExecutable', fakeAgyPath
    ], {
      FAKE_AGY_STREAM_FILE: validStreamPath,
      FAKE_AGY_EXIT_CODE: '0'
    });

    assert.equal(res.exitCode, 0, `Expected exit code 0, got ${res.exitCode}. Stderr: ${res.stderr}`);
    assert.ok(fs.existsSync(breadcrumbPath), 'Worker mode launch breadcrumb must exist for happy path');

    const requiredReceipts = [
      'RUN_STATE.md',
      'COMMAND_LOG.md',
      'HEARTBEAT.log',
      'RESUME_PROMPT.md',
      'PR_MANIFEST.md',
      'LAUNCH_CONTRACT.json',
      'PROMPT.sha256',
      'NATIVE_EXIT.txt',
      'VALIDATOR_EXIT.txt',
      'POSTFLIGHT_SETTINGS_AUTHORITY.json',
      'verdict.json',
      'MANIFEST.sha256',
      'stream.jsonl',
      'stderr.log',
      'log.txt'
    ];

    for (const file of requiredReceipts) {
      const p = path.join(receiptDir, file);
      assert.ok(fs.existsSync(p), `Receipt file '${file}' must exist in ReceiptRoot`);
    }

    const postflightObj = JSON.parse(fs.readFileSync(path.join(receiptDir, 'POSTFLIGHT_SETTINGS_AUTHORITY.json'), 'utf8'));
    assert.equal(postflightObj.status, 'MATCH', 'Postflight status must be MATCH');
    assert.equal(postflightObj.pre_launch_sha256, postflightObj.post_run_sha256, 'Pre and post hashes must match');

    const launchContract = JSON.parse(fs.readFileSync(path.join(receiptDir, 'LAUNCH_CONTRACT.json'), 'utf8'));
    assert.ok(typeof launchContract.node_executable === 'string' && launchContract.node_executable.length > 0, 'node_executable must be recorded in LAUNCH_CONTRACT.json');
    assert.ok(fs.existsSync(launchContract.node_executable), 'node_executable path must exist');
    assert.ok(typeof launchContract.node_version === 'string' && launchContract.node_version.length > 0, 'node_version must be recorded in LAUNCH_CONTRACT.json');

    const runStateText = fs.readFileSync(path.join(receiptDir, 'RUN_STATE.md'), 'utf8');
    assert.ok(runStateText.includes('Status: COMPLETED_GREEN'), 'RUN_STATE.md must record Status: COMPLETED_GREEN');

    const nativeExitText = fs.readFileSync(path.join(receiptDir, 'NATIVE_EXIT.txt'), 'utf8').trim();
    assert.equal(nativeExitText, '0', 'NATIVE_EXIT.txt must be 0');

    const validatorExitText = fs.readFileSync(path.join(receiptDir, 'VALIDATOR_EXIT.txt'), 'utf8').trim();
    assert.equal(validatorExitText, '0', 'VALIDATOR_EXIT.txt must be 0');

    const verdictObj = JSON.parse(fs.readFileSync(path.join(receiptDir, 'verdict.json'), 'utf8'));
    assert.equal(verdictObj.status, 'GREEN', 'Verdict status must be GREEN');
  } finally {
    cleanTempDir(workspaceDir);
    cleanTempDir(profileDir);
    cleanTempDir(receiptDir);
    cleanTempDir(fakeAgyDir);
  }
});

test('exact native exit code capture is retained and not replaced by pipeline exit', () => {
  const workspaceDir = createTempDir('agy-ctrl-ws-');
  const profileDir = createTempDir('agy-ctrl-prof-');
  const receiptDir = createTempDir('agy-ctrl-rcpt-');
  const fakeAgyDir = createTempDir('agy-ctrl-fake-');

  try {
    const { head, branch } = initGitWorkspace(workspaceDir);
    const promptFile = path.join(workspaceDir, 'PROMPT.md');
    const promptContent = 'Execute bounded unit test.\n';
    fs.writeFileSync(promptFile, promptContent, 'utf8');
    const promptHash = getSha256(promptContent);

    const writableDir = path.join(workspaceDir, 'tooling');
    fs.mkdirSync(writableDir, { recursive: true });

    const { cmdPath: fakeAgyPath, breadcrumbPath } = createFakeAgyScript(fakeAgyDir);
    const validStreamPath = createValidStreamFile(fakeAgyDir, workspaceDir);

    const res = runPwshScript([
      '-WorkspaceRoot', workspaceDir,
      '-PromptFile', promptFile,
      '-ExpectedPromptSha256', promptHash,
      '-ProfileRoot', profileDir,
      '-ReceiptRoot', receiptDir,
      '-WritablePaths', writableDir,
      '-ExpectedBaselineHead', head,
      '-ExpectedBranch', 'main',
      '-AgyExecutable', fakeAgyPath
    ], {
      FAKE_AGY_STREAM_FILE: validStreamPath,
      FAKE_AGY_EXIT_CODE: '42'
    });

    assert.notEqual(res.exitCode, 0, 'Nonzero native AGY exit code must fail the controller script');
    assert.ok(fs.existsSync(breadcrumbPath), 'Worker mode launch breadcrumb must exist for native exit test');

    const nativeExitPath = path.join(receiptDir, 'NATIVE_EXIT.txt');
    assert.ok(fs.existsSync(nativeExitPath), 'NATIVE_EXIT.txt must be recorded');
    const nativeExitText = fs.readFileSync(nativeExitPath, 'utf8').trim();
    assert.equal(nativeExitText, '42', 'NATIVE_EXIT.txt must record the exact native exit code 42');
  } finally {
    cleanTempDir(workspaceDir);
    cleanTempDir(profileDir);
    cleanTempDir(receiptDir);
    cleanTempDir(fakeAgyDir);
  }
});

test('exact stdout/stderr/native-log separation', () => {
  const workspaceDir = createTempDir('agy-ctrl-ws-sep-');
  const profileDir = createTempDir('agy-ctrl-prof-sep-');
  const receiptDir = createTempDir('agy-ctrl-rcpt-sep-');
  const fakeAgyDir = createTempDir('agy-ctrl-fake-sep-');

  try {
    const { head, branch } = initGitWorkspace(workspaceDir);
    const promptFile = path.join(workspaceDir, 'PROMPT.md');
    const promptContent = 'Separation test prompt\n';
    fs.writeFileSync(promptFile, promptContent, 'utf8');
    const promptHash = getSha256(promptContent);

    const writableDir = path.join(workspaceDir, 'tooling');
    fs.mkdirSync(writableDir, { recursive: true });

    const { cmdPath: fakeAgyPath, breadcrumbPath } = createFakeAgyScript(fakeAgyDir);
    const validStreamPath = createValidStreamFile(fakeAgyDir, workspaceDir);

    const res = runPwshScript([
      '-WorkspaceRoot', workspaceDir,
      '-PromptFile', promptFile,
      '-ExpectedPromptSha256', promptHash,
      '-ProfileRoot', profileDir,
      '-ReceiptRoot', receiptDir,
      '-WritablePaths', writableDir,
      '-ExpectedBaselineHead', head,
      '-ExpectedBranch', 'main',
      '-AgyExecutable', fakeAgyPath
    ], {
      FAKE_AGY_STREAM_FILE: validStreamPath,
      FAKE_AGY_STDERR_TEXT: 'NATIVE_STDERR_OUTPUT_LINE',
      FAKE_AGY_LOG_TEXT: 'NATIVE_DIAGNOSTIC_LOG_LINE\n',
      FAKE_AGY_EXIT_CODE: '0'
    });

    assert.equal(res.exitCode, 0);
    assert.ok(fs.existsSync(breadcrumbPath), 'Worker mode launch breadcrumb must exist for separation test');

    const streamContent = fs.readFileSync(path.join(receiptDir, 'stream.jsonl'), 'utf8');
    assert.ok(streamContent.includes('"event":"init"'), 'stream.jsonl must contain stdout stream JSONL');

    const stderrContent = fs.readFileSync(path.join(receiptDir, 'stderr.log'), 'utf8');
    assert.ok(stderrContent.includes('NATIVE_STDERR_OUTPUT_LINE'), 'stderr.log must contain native stderr');

    const logContent = fs.readFileSync(path.join(receiptDir, 'log.txt'), 'utf8');
    assert.ok(logContent.includes('NATIVE_DIAGNOSTIC_LOG_LINE'), 'log.txt must contain native diagnostic log');
  } finally {
    cleanTempDir(workspaceDir);
    cleanTempDir(profileDir);
    cleanTempDir(receiptDir);
    cleanTempDir(fakeAgyDir);
  }
});

test('prompt expected-hash mismatch before launch', () => {
  const workspaceDir = createTempDir('agy-ctrl-ws-hash-');
  const profileDir = createTempDir('agy-ctrl-prof-hash-');
  const receiptDir = createTempDir('agy-ctrl-rcpt-hash-');
  const fakeAgyDir = createTempDir('agy-ctrl-fake-hash-');

  try {
    const { head, branch } = initGitWorkspace(workspaceDir);
    const promptFile = path.join(workspaceDir, 'PROMPT.md');
    fs.writeFileSync(promptFile, 'Original prompt content\n', 'utf8');
    const { cmdPath: fakeAgyPath, breadcrumbPath } = createFakeAgyScript(fakeAgyDir);

    const res = runPwshScript([
      '-WorkspaceRoot', workspaceDir,
      '-PromptFile', promptFile,
      '-ExpectedPromptSha256', '0000000000000000000000000000000000000000000000000000000000000000',
      '-ProfileRoot', profileDir,
      '-ReceiptRoot', receiptDir,
      '-WritablePaths', path.join(workspaceDir, 'tooling'),
      '-ExpectedBaselineHead', head,
      '-ExpectedBranch', 'main',
      '-AgyExecutable', fakeAgyPath
    ]);

    assert.notEqual(res.exitCode, 0, 'Prompt hash mismatch must fail before launch');
    assert.ok(res.stderr.includes('Prompt SHA-256 mismatch') || res.stdout.includes('Prompt SHA-256 mismatch'));
    assert.equal(fs.existsSync(path.join(receiptDir, 'PROMPT.sha256')), false, 'Launch records must not be initialized on hash mismatch');
    assert.equal(fs.existsSync(breadcrumbPath), false, 'Worker launch breadcrumb must be absent on hash mismatch');
  } finally {
    cleanTempDir(workspaceDir);
    cleanTempDir(profileDir);
    cleanTempDir(receiptDir);
    cleanTempDir(fakeAgyDir);
  }
});

test('exact prompt read and write denial', () => {
  const workspaceDir = createTempDir('agy-ctrl-ws-pden-');
  const profileDir = createTempDir('agy-ctrl-prof-pden-');
  const receiptDir = createTempDir('agy-ctrl-rcpt-pden-');
  const fakeAgyDir = createTempDir('agy-ctrl-fake-pden-');

  try {
    const { head, branch } = initGitWorkspace(workspaceDir);
    const promptFile = path.join(workspaceDir, 'PROMPT.md');
    const promptContent = 'Prompt read write denial test\n';
    fs.writeFileSync(promptFile, promptContent, 'utf8');
    const promptHash = getSha256(promptContent);

    const writableDir = path.join(workspaceDir, 'tooling');
    fs.mkdirSync(writableDir, { recursive: true });

    const { cmdPath: fakeAgyPath, breadcrumbPath } = createFakeAgyScript(fakeAgyDir);
    const validStreamPath = createValidStreamFile(fakeAgyDir, workspaceDir);

    const res = runPwshScript([
      '-WorkspaceRoot', workspaceDir,
      '-PromptFile', promptFile,
      '-ExpectedPromptSha256', promptHash,
      '-ProfileRoot', profileDir,
      '-ReceiptRoot', receiptDir,
      '-WritablePaths', writableDir,
      '-ExpectedBaselineHead', head,
      '-ExpectedBranch', 'main',
      '-AgyExecutable', fakeAgyPath
    ], {
      FAKE_AGY_STREAM_FILE: validStreamPath,
      FAKE_AGY_EXIT_CODE: '0'
    });

    assert.equal(res.exitCode, 0);
    assert.ok(fs.existsSync(breadcrumbPath), 'Worker mode launch breadcrumb must exist for prompt denial test');

    const launchContract = JSON.parse(fs.readFileSync(path.join(receiptDir, 'LAUNCH_CONTRACT.json'), 'utf8'));
    assert.ok(launchContract.protected_paths.includes(path.resolve(promptFile)), 'LAUNCH_CONTRACT protected_paths must include PromptFile');

    const manifestObj = JSON.parse(fs.readFileSync(path.join(profileDir, '.gemini', 'antigravity-cli', 'PROFILE_MANIFEST.json'), 'utf8'));
    assert.ok(manifestObj.protected_paths.includes(path.resolve(promptFile)), 'PROFILE_MANIFEST protected_paths must include PromptFile');
  } finally {
    cleanTempDir(workspaceDir);
    cleanTempDir(profileDir);
    cleanTempDir(receiptDir);
    cleanTempDir(fakeAgyDir);
  }
});

test('zero, one, and many caller protected paths', () => {
  const workspaceDir = createTempDir('agy-ctrl-ws-protc-');
  const fakeAgyDir = createTempDir('agy-ctrl-fake-protc-');

  try {
    const { head, branch } = initGitWorkspace(workspaceDir);
    const promptFile = path.join(workspaceDir, 'PROMPT.md');
    const promptContent = 'Protected paths test\n';
    fs.writeFileSync(promptFile, promptContent, 'utf8');
    const promptHash = getSha256(promptContent);

    const protFile1 = path.join(workspaceDir, 'SECRET1.txt');
    const protFile2 = path.join(workspaceDir, 'SECRET2.txt');
    fs.writeFileSync(protFile1, 'secret1\n', 'utf8');
    fs.writeFileSync(protFile2, 'secret2\n', 'utf8');

    const writableDir = path.join(workspaceDir, 'tooling');
    fs.mkdirSync(writableDir, { recursive: true });

    const { cmdPath: fakeAgyPath } = createFakeAgyScript(fakeAgyDir);
    const validStreamPath = createValidStreamFile(fakeAgyDir, workspaceDir);

    function psQuote(str) {
      return "'" + str.replace(/'/g, "''") + "'";
    }

    // Case 0: Zero caller protected paths
    const prof0 = createTempDir('agy-ctrl-prof-prot0-');
    const rcpt0 = createTempDir('agy-ctrl-rcpt-prot0-');
    const breadcrumb0 = path.join(fakeAgyDir, 'launch_breadcrumb.txt');
    if (fs.existsSync(breadcrumb0)) fs.unlinkSync(breadcrumb0);

    try {
      const res0 = runPwshScript([
        '-WorkspaceRoot', workspaceDir,
        '-PromptFile', promptFile,
        '-ExpectedPromptSha256', promptHash,
        '-ProfileRoot', prof0,
        '-ReceiptRoot', rcpt0,
        '-WritablePaths', writableDir,
        '-ExpectedBaselineHead', head,
        '-ExpectedBranch', 'main',
        '-AgyExecutable', fakeAgyPath
      ], {
        FAKE_AGY_STREAM_FILE: validStreamPath,
        FAKE_AGY_EXIT_CODE: '0'
      });

      assert.equal(res0.exitCode, 0, `Case 0 (zero protected paths) exit code must be 0. Stderr: ${res0.stderr}`);
      assert.ok(fs.existsSync(breadcrumb0), 'Case 0 worker mode launch breadcrumb must exist');

      const launchContract0 = JSON.parse(fs.readFileSync(path.join(rcpt0, 'LAUNCH_CONTRACT.json'), 'utf8'));
      assert.equal(launchContract0.protected_paths.length, 1, 'Case 0 protected_paths must contain exactly 1 element (the prompt)');
      assert.deepEqual(
        launchContract0.protected_paths.map(p => path.resolve(p)).sort(),
        [path.resolve(promptFile)].sort()
      );
    } finally {
      cleanTempDir(prof0);
      cleanTempDir(rcpt0);
    }

    // Case 1: One caller protected path
    const prof1 = createTempDir('agy-ctrl-prof-prot1-');
    const rcpt1 = createTempDir('agy-ctrl-rcpt-prot1-');
    if (fs.existsSync(breadcrumb0)) fs.unlinkSync(breadcrumb0);

    try {
      const res1 = runPwshScript([
        '-WorkspaceRoot', workspaceDir,
        '-PromptFile', promptFile,
        '-ExpectedPromptSha256', promptHash,
        '-ProfileRoot', prof1,
        '-ReceiptRoot', rcpt1,
        '-WritablePaths', writableDir,
        '-ProtectedPaths', protFile1,
        '-ExpectedBaselineHead', head,
        '-ExpectedBranch', 'main',
        '-AgyExecutable', fakeAgyPath
      ], {
        FAKE_AGY_STREAM_FILE: validStreamPath,
        FAKE_AGY_EXIT_CODE: '0'
      });

      assert.equal(res1.exitCode, 0, `Case 1 (one protected path) exit code must be 0. Stderr: ${res1.stderr}`);
      assert.ok(fs.existsSync(breadcrumb0), 'Case 1 worker mode launch breadcrumb must exist');

      const launchContract1 = JSON.parse(fs.readFileSync(path.join(rcpt1, 'LAUNCH_CONTRACT.json'), 'utf8'));
      assert.equal(launchContract1.protected_paths.length, 2, 'Case 1 protected_paths must contain exactly 2 elements (prompt + 1 path)');
      assert.deepEqual(
        launchContract1.protected_paths.map(p => path.resolve(p)).sort(),
        [path.resolve(promptFile), path.resolve(protFile1)].sort()
      );
    } finally {
      cleanTempDir(prof1);
      cleanTempDir(rcpt1);
    }

    // Case 2: Multiple caller protected paths (invoked in-process with actual [string[]]@(...))
    const prof2 = createTempDir('agy-ctrl-prof-prot2-');
    const rcpt2 = createTempDir('agy-ctrl-rcpt-prot2-');
    if (fs.existsSync(breadcrumb0)) fs.unlinkSync(breadcrumb0);

    try {
      const psCommand = [
        `& ${psQuote(CONTROLLER_SCRIPT_PATH)}`,
        `-WorkspaceRoot ${psQuote(workspaceDir)}`,
        `-PromptFile ${psQuote(promptFile)}`,
        `-ExpectedPromptSha256 ${psQuote(promptHash)}`,
        `-ProfileRoot ${psQuote(prof2)}`,
        `-ReceiptRoot ${psQuote(rcpt2)}`,
        `-WritablePaths ${psQuote(writableDir)}`,
        `-ProtectedPaths @(${psQuote(protFile1)}, ${psQuote(protFile2)})`,
        `-ExpectedBaselineHead ${psQuote(head)}`,
        `-ExpectedBranch ${psQuote(branch)}`,
        `-AgyExecutable ${psQuote(fakeAgyPath)}`
      ].join(' ');

      let res2Exit = 0;
      let res2Stderr = '';
      try {
        execFileSync('pwsh', ['-NoProfile', '-Command', psCommand], {
          encoding: 'utf8',
          env: {
            ...process.env,
            FAKE_AGY_STREAM_FILE: validStreamPath,
            FAKE_AGY_EXIT_CODE: '0'
          },
          stdio: ['pipe', 'pipe', 'pipe']
        });
      } catch (err) {
        res2Exit = err.status || 1;
        res2Stderr = err.stderr ? err.stderr.toString() : err.message;
      }

      assert.equal(res2Exit, 0, `Case 2 (multi protected paths) exit code must be 0. Stderr: ${res2Stderr}`);
      assert.ok(fs.existsSync(breadcrumb0), 'Case 2 worker mode launch breadcrumb must exist');

      const launchContract2 = JSON.parse(fs.readFileSync(path.join(rcpt2, 'LAUNCH_CONTRACT.json'), 'utf8'));
      assert.equal(launchContract2.protected_paths.length, 3, 'Case 2 protected_paths must contain exactly 3 elements (prompt + 2 paths)');
      assert.deepEqual(
        launchContract2.protected_paths.map(p => path.resolve(p)).sort(),
        [path.resolve(promptFile), path.resolve(protFile1), path.resolve(protFile2)].sort()
      );
    } finally {
      cleanTempDir(prof2);
      cleanTempDir(rcpt2);
    }
  } finally {
    cleanTempDir(workspaceDir);
    cleanTempDir(fakeAgyDir);
  }
});

test('USERPROFILE environment variable restoration succeeds on both GREEN and thrown/RED paths', () => {
  const workspaceDir = createTempDir('agy-ctrl-ws-up-');
  const profileDir = createTempDir('agy-ctrl-prof-up-');
  const receiptDir = createTempDir('agy-ctrl-rcpt-up-');
  const fakeAgyDir = createTempDir('agy-ctrl-fake-up-');

  try {
    const { head, branch } = initGitWorkspace(workspaceDir);
    const promptFile = path.join(workspaceDir, 'PROMPT.md');
    const promptContent = 'Execute unit test.\n';
    fs.writeFileSync(promptFile, promptContent, 'utf8');
    const promptHash = getSha256(promptContent);

    const writableDir = path.join(workspaceDir, 'tooling');
    fs.mkdirSync(writableDir, { recursive: true });

    const { cmdPath: fakeAgyPath, breadcrumbPath } = createFakeAgyScript(fakeAgyDir);
    const validStreamPath = createValidStreamFile(fakeAgyDir, workspaceDir);

    const checkUserProfileCmd = `
$originalUserProfile = $env:USERPROFILE
try {
    & '${CONTROLLER_SCRIPT_PATH}' -WorkspaceRoot '${workspaceDir}' -PromptFile '${promptFile}' -ExpectedPromptSha256 '${promptHash}' -ProfileRoot '${profileDir}' -ReceiptRoot '${receiptDir}' -WritablePaths '${writableDir}' -ExpectedBaselineHead '${head}' -ExpectedBranch '${branch}' -AgyExecutable '${fakeAgyPath}' -ReplaceEmptyGeneratedProfile
} catch {}
if ($env:USERPROFILE -eq $originalUserProfile) {
    Write-Host "USERPROFILE_RESTORED_OK"
} else {
    Write-Host "USERPROFILE_MISMATCH"
}
`;
    const resRed = execFileSync('pwsh', ['-NoProfile', '-Command', checkUserProfileCmd], {
      encoding: 'utf8',
      env: { ...process.env, FAKE_AGY_STREAM_FILE: validStreamPath, FAKE_AGY_EXIT_CODE: '1' }
    });

    assert.ok(
      resRed.includes('USERPROFILE_RESTORED_OK'),
      'USERPROFILE must be restored to original process value after thrown/RED failure'
    );
    assert.ok(fs.existsSync(breadcrumbPath), 'Worker mode launch breadcrumb must exist for USERPROFILE test');
  } finally {
    cleanTempDir(workspaceDir);
    cleanTempDir(profileDir);
    cleanTempDir(receiptDir);
    cleanTempDir(fakeAgyDir);
  }
});

test('profile and receipt roots inside workspace or overlapping writable scope are rejected', () => {
  const workspaceDir = createTempDir('agy-ctrl-ws-ov-');
  const fakeAgyDir = createTempDir('agy-ctrl-fake-ov-');
  const writableDir = path.join(workspaceDir, 'tooling');
  fs.mkdirSync(writableDir, { recursive: true });

  try {
    const { head, branch } = initGitWorkspace(workspaceDir);
    const promptFile = path.join(workspaceDir, 'PROMPT.md');
    const promptContent = 'Test prompt\n';
    fs.writeFileSync(promptFile, promptContent, 'utf8');
    const promptHash = getSha256(promptContent);

    const { cmdPath: fakeAgyPath, breadcrumbPath } = createFakeAgyScript(fakeAgyDir);

    const innerProfile = path.join(workspaceDir, 'profile');
    const outerReceipt = createTempDir('agy-ctrl-rcpt-ov-');

    const resProf = runPwshScript([
      '-WorkspaceRoot', workspaceDir,
      '-PromptFile', promptFile,
      '-ExpectedPromptSha256', promptHash,
      '-ProfileRoot', innerProfile,
      '-ReceiptRoot', outerReceipt,
      '-WritablePaths', writableDir,
      '-ExpectedBaselineHead', head,
      '-ExpectedBranch', 'main',
      '-AgyExecutable', fakeAgyPath
    ]);
    assert.notEqual(resProf.exitCode, 0, 'ProfileRoot inside WorkspaceRoot must be rejected');
    assert.equal(fs.existsSync(breadcrumbPath), false, 'Worker launch breadcrumb must be absent on ProfileRoot overlap rejection');
    cleanTempDir(outerReceipt);

    const outerProfile = createTempDir('agy-ctrl-prof-ov-');
    const innerReceipt = path.join(writableDir, 'receipt');

    const resRcpt = runPwshScript([
      '-WorkspaceRoot', workspaceDir,
      '-PromptFile', promptFile,
      '-ExpectedPromptSha256', promptHash,
      '-ProfileRoot', outerProfile,
      '-ReceiptRoot', innerReceipt,
      '-WritablePaths', writableDir,
      '-ExpectedBaselineHead', head,
      '-ExpectedBranch', 'main',
      '-AgyExecutable', fakeAgyPath
    ]);
    assert.notEqual(resRcpt.exitCode, 0, 'ReceiptRoot inside WritablePaths must be rejected');
    assert.equal(fs.existsSync(breadcrumbPath), false, 'Worker launch breadcrumb must be absent on ReceiptRoot overlap rejection');
    cleanTempDir(outerProfile);
  } finally {
    cleanTempDir(workspaceDir);
    cleanTempDir(fakeAgyDir);
  }
});

test('prompt hash, baseline, branch, version, model, effort, and manifest bindings fail closed on mismatch', () => {
  const workspaceDir = createTempDir('agy-ctrl-ws-mm-');
  const profileDir = createTempDir('agy-ctrl-prof-mm-');
  const receiptDir = createTempDir('agy-ctrl-rcpt-mm-');
  const fakeAgyDir = createTempDir('agy-ctrl-fake-mm-');

  try {
    const { head, branch } = initGitWorkspace(workspaceDir);
    const promptFile = path.join(workspaceDir, 'PROMPT.md');
    const promptContent = 'Test prompt\n';
    fs.writeFileSync(promptFile, promptContent, 'utf8');
    const promptHash = getSha256(promptContent);

    const writableDir = path.join(workspaceDir, 'tooling');
    fs.mkdirSync(writableDir, { recursive: true });

    const { cmdPath: fakeAgyPath, breadcrumbPath } = createFakeAgyScript(fakeAgyDir);

    const resHead = runPwshScript([
      '-WorkspaceRoot', workspaceDir,
      '-PromptFile', promptFile,
      '-ExpectedPromptSha256', promptHash,
      '-ProfileRoot', profileDir,
      '-ReceiptRoot', receiptDir,
      '-WritablePaths', writableDir,
      '-ExpectedBaselineHead', '0000000000000000000000000000000000000000',
      '-ExpectedBranch', 'main',
      '-AgyExecutable', fakeAgyPath
    ]);
    assert.notEqual(resHead.exitCode, 0, 'Baseline HEAD mismatch must be rejected');
    assert.equal(fs.existsSync(breadcrumbPath), false, 'Worker launch breadcrumb must be absent on baseline HEAD mismatch');

    const resBranch = runPwshScript([
      '-WorkspaceRoot', workspaceDir,
      '-PromptFile', promptFile,
      '-ExpectedPromptSha256', promptHash,
      '-ProfileRoot', profileDir,
      '-ReceiptRoot', receiptDir,
      '-WritablePaths', writableDir,
      '-ExpectedBaselineHead', head,
      '-ExpectedBranch', 'nonexistent-branch-name',
      '-AgyExecutable', fakeAgyPath
    ]);
    assert.notEqual(resBranch.exitCode, 0, 'Branch mismatch must be rejected');
    assert.equal(fs.existsSync(breadcrumbPath), false, 'Worker launch breadcrumb must be absent on branch mismatch');

    const resVer = runPwshScript([
      '-WorkspaceRoot', workspaceDir,
      '-PromptFile', promptFile,
      '-ExpectedPromptSha256', promptHash,
      '-ProfileRoot', profileDir,
      '-ReceiptRoot', receiptDir,
      '-WritablePaths', writableDir,
      '-ExpectedBaselineHead', head,
      '-ExpectedBranch', 'main',
      '-ExpectedAgyVersion', '1.1.7',
      '-AgyExecutable', fakeAgyPath
    ]);
    assert.notEqual(resVer.exitCode, 0, 'Non-1.1.8 AGY version parameter must be rejected');
    assert.equal(fs.existsSync(breadcrumbPath), false, 'Worker launch breadcrumb must be absent on version parameter mismatch');

    const resMod = runPwshScript([
      '-WorkspaceRoot', workspaceDir,
      '-PromptFile', promptFile,
      '-ExpectedPromptSha256', promptHash,
      '-ProfileRoot', profileDir,
      '-ReceiptRoot', receiptDir,
      '-WritablePaths', writableDir,
      '-ExpectedBaselineHead', head,
      '-ExpectedBranch', 'main',
      '-ExpectedModel', 'gemini-2.5-flash',
      '-AgyExecutable', fakeAgyPath
    ]);
    assert.notEqual(resMod.exitCode, 0, 'Non-gemini-3.1-pro-high model parameter must be rejected');
    assert.equal(fs.existsSync(breadcrumbPath), false, 'Worker launch breadcrumb must be absent on model parameter mismatch');
  } finally {
    cleanTempDir(workspaceDir);
    cleanTempDir(profileDir);
    cleanTempDir(receiptDir);
    cleanTempDir(fakeAgyDir);
  }
});

test('exact version rejection cases (x1.1.8, 1.1.80, multiline output, nonzero exit, empty output)', () => {
  const workspaceDir = createTempDir('agy-ctrl-ws-ver-');
  const profileDir = createTempDir('agy-ctrl-prof-ver-');
  const receiptDir = createTempDir('agy-ctrl-rcpt-ver-');
  const fakeAgyDir = createTempDir('agy-ctrl-fake-ver-');

  try {
    const { head, branch } = initGitWorkspace(workspaceDir);
    const promptFile = path.join(workspaceDir, 'PROMPT.md');
    const promptContent = 'Version test prompt\n';
    fs.writeFileSync(promptFile, promptContent, 'utf8');
    const promptHash = getSha256(promptContent);
    const writableDir = path.join(workspaceDir, 'tooling');
    fs.mkdirSync(writableDir, { recursive: true });

    // Case 0: Accepted valid one-line 1.1.8 version output reaches worker mode
    const { cmdPath: v0, breadcrumbPath: b0 } = createCustomVersionFakeAgy(fakeAgyDir, '1.1.8', 0);
    const validStreamPath0 = createValidStreamFile(fakeAgyDir, workspaceDir);
    const prof0 = createTempDir('agy-ctrl-prof-v0-');
    const rcpt0 = createTempDir('agy-ctrl-rcpt-v0-');
    try {
      const r0 = runPwshScript([
        '-WorkspaceRoot', workspaceDir,
        '-PromptFile', promptFile,
        '-ExpectedPromptSha256', promptHash,
        '-ProfileRoot', prof0,
        '-ReceiptRoot', rcpt0,
        '-WritablePaths', writableDir,
        '-ExpectedBaselineHead', head,
        '-ExpectedBranch', 'main',
        '-AgyExecutable', v0
      ], {
        FAKE_AGY_STREAM_FILE: validStreamPath0,
        FAKE_AGY_EXIT_CODE: '0'
      });
      assert.equal(r0.exitCode, 0, `Accepted version probe '1.1.8' must succeed. Stderr: ${r0.stderr}`);
      assert.ok(fs.existsSync(b0), 'Accepted one-line version output 1.1.8 must reach worker mode (launch breadcrumb exists)');
      const verdictObj0 = JSON.parse(fs.readFileSync(path.join(rcpt0, 'verdict.json'), 'utf8'));
      assert.equal(verdictObj0.status, 'GREEN', 'Verdict status must be GREEN for exact version 1.1.8');
    } finally {
      cleanTempDir(prof0);
      cleanTempDir(rcpt0);
    }

    // Case 1: Prefixed x1.1.8
    const { cmdPath: v1, breadcrumbPath: b1 } = createCustomVersionFakeAgy(fakeAgyDir, 'x1.1.8', 0);
    const r1 = runPwshScript(['-WorkspaceRoot', workspaceDir, '-PromptFile', promptFile, '-ExpectedPromptSha256', promptHash, '-ProfileRoot', profileDir, '-ReceiptRoot', receiptDir, '-WritablePaths', writableDir, '-ExpectedBaselineHead', head, '-ExpectedBranch', 'main', '-AgyExecutable', v1]);
    assert.notEqual(r1.exitCode, 0, 'x1.1.8 version must be rejected');
    assert.ok(r1.stderr.includes('AGY version mismatch'), 'x1.1.8 rejection reason must be version mismatch');
    assert.equal(fs.existsSync(b1), false, 'x1.1.8 version rejection must not reach worker mode');

    // Case 2: Suffixed 1.1.80
    const { cmdPath: v2, breadcrumbPath: b2 } = createCustomVersionFakeAgy(fakeAgyDir, '1.1.80', 0);
    const r2 = runPwshScript(['-WorkspaceRoot', workspaceDir, '-PromptFile', promptFile, '-ExpectedPromptSha256', promptHash, '-ProfileRoot', profileDir, '-ReceiptRoot', receiptDir, '-WritablePaths', writableDir, '-ExpectedBaselineHead', head, '-ExpectedBranch', 'main', '-AgyExecutable', v2]);
    assert.notEqual(r2.exitCode, 0, '1.1.80 version must be rejected');
    assert.ok(r2.stderr.includes('AGY version mismatch'), '1.1.80 rejection reason must be version mismatch');
    assert.equal(fs.existsSync(b2), false, '1.1.80 version rejection must not reach worker mode');

    // Case 3: Multiline output
    const { cmdPath: v3, breadcrumbPath: b3 } = createCustomVersionFakeAgy(fakeAgyDir, '1.1.8\nextra line', 0);
    const r3 = runPwshScript(['-WorkspaceRoot', workspaceDir, '-PromptFile', promptFile, '-ExpectedPromptSha256', promptHash, '-ProfileRoot', profileDir, '-ReceiptRoot', receiptDir, '-WritablePaths', writableDir, '-ExpectedBaselineHead', head, '-ExpectedBranch', 'main', '-AgyExecutable', v3]);
    assert.notEqual(r3.exitCode, 0, 'Multiline version output must be rejected');
    assert.ok(r3.stderr.includes('multiline'), 'Multiline rejection reason must be multiline output');
    assert.equal(fs.existsSync(b3), false, 'Multiline version output must not reach worker mode');

    // Case 4: Nonzero exit code
    const { cmdPath: v4, breadcrumbPath: b4 } = createCustomVersionFakeAgy(fakeAgyDir, '1.1.8', 1);
    const r4 = runPwshScript(['-WorkspaceRoot', workspaceDir, '-PromptFile', promptFile, '-ExpectedPromptSha256', promptHash, '-ProfileRoot', profileDir, '-ReceiptRoot', receiptDir, '-WritablePaths', writableDir, '-ExpectedBaselineHead', head, '-ExpectedBranch', 'main', '-AgyExecutable', v4]);
    assert.notEqual(r4.exitCode, 0, 'Nonzero exit version probe must be rejected');
    assert.ok(r4.stderr.includes('nonzero exit code'), 'Nonzero exit rejection reason must be nonzero exit code');
    assert.equal(fs.existsSync(b4), false, 'Nonzero exit version probe must not reach worker mode');

    // Case 5: Empty output
    const { cmdPath: v5, breadcrumbPath: b5 } = createCustomVersionFakeAgy(fakeAgyDir, '', 0);
    const r5 = runPwshScript(['-WorkspaceRoot', workspaceDir, '-PromptFile', promptFile, '-ExpectedPromptSha256', promptHash, '-ProfileRoot', profileDir, '-ReceiptRoot', receiptDir, '-WritablePaths', writableDir, '-ExpectedBaselineHead', head, '-ExpectedBranch', 'main', '-AgyExecutable', v5]);
    assert.notEqual(r5.exitCode, 0, 'Empty version output must be rejected');
    assert.ok(r5.stderr.includes('output is empty'), 'Empty version output rejection reason must be empty output');
    assert.equal(fs.existsSync(b5), false, 'Empty version output must not reach worker mode');
  } finally {
    cleanTempDir(workspaceDir);
    cleanTempDir(profileDir);
    cleanTempDir(receiptDir);
    cleanTempDir(fakeAgyDir);
  }
});

test('AGY exit 0 plus terminal SUCCESS plus tool error remains RED', () => {
  const workspaceDir = createTempDir('agy-ctrl-ws-terr-');
  const profileDir = createTempDir('agy-ctrl-prof-terr-');
  const receiptDir = createTempDir('agy-ctrl-rcpt-terr-');
  const fakeAgyDir = createTempDir('agy-ctrl-fake-terr-');

  try {
    const { head, branch } = initGitWorkspace(workspaceDir);
    const promptFile = path.join(workspaceDir, 'PROMPT.md');
    const promptContent = 'Tool error test prompt\n';
    fs.writeFileSync(promptFile, promptContent, 'utf8');
    const promptHash = getSha256(promptContent);

    const writableDir = path.join(workspaceDir, 'tooling');
    fs.mkdirSync(writableDir, { recursive: true });

    const { cmdPath: fakeAgyPath, breadcrumbPath } = createFakeAgyScript(fakeAgyDir);

    const streamPath = path.join(fakeAgyDir, 'error_tool_stream.jsonl');
    const events = [
      { event: 'init', conversation_id: 'conv-123', init: { model: 'gemini-3.1-pro-high', cwd: workspaceDir, permission_mode: 'request-review' } },
      { event: 'step_update', step_update: { conversation_id: 'conv-123', step_index: 0, state: 'ACTIVE', step_type: 'tool', tool_name: 'view_file', tool_info: { parameters: { AbsolutePath: path.join(workspaceDir, 'README.md') } } } },
      { event: 'step_update', step_update: { conversation_id: 'conv-123', step_index: 0, state: 'ERROR', step_type: 'tool', tool_name: 'view_file', tool_info: { parameters: { AbsolutePath: path.join(workspaceDir, 'README.md') } } } },
      { event: 'result', result: { conversation_id: 'conv-123', status: 'SUCCESS', response: 'Completed with tool error.' } }
    ];
    fs.writeFileSync(streamPath, events.map(e => JSON.stringify(e)).join('\n') + '\n', 'utf8');

    const res = runPwshScript([
      '-WorkspaceRoot', workspaceDir,
      '-PromptFile', promptFile,
      '-ExpectedPromptSha256', promptHash,
      '-ProfileRoot', profileDir,
      '-ReceiptRoot', receiptDir,
      '-WritablePaths', writableDir,
      '-ExpectedBaselineHead', head,
      '-ExpectedBranch', 'main',
      '-AgyExecutable', fakeAgyPath
    ], {
      FAKE_AGY_STREAM_FILE: streamPath,
      FAKE_AGY_EXIT_CODE: '0'
    });

    assert.notEqual(res.exitCode, 0, 'Tool error step in stream must cause controller to fail closed (RED)');
    assert.ok(fs.existsSync(breadcrumbPath), 'Worker mode launch breadcrumb must exist for tool error test');

    const verdictPath = path.join(receiptDir, 'verdict.json');
    if (fs.existsSync(verdictPath)) {
      const verdictObj = JSON.parse(fs.readFileSync(verdictPath, 'utf8'));
      assert.equal(verdictObj.status, 'RED');
      assert.ok(verdictObj.reason_codes.includes('TOOL_ERROR'));
    }
  } finally {
    cleanTempDir(workspaceDir);
    cleanTempDir(profileDir);
    cleanTempDir(receiptDir);
    cleanTempDir(fakeAgyDir);
  }
});

test('dirty tracked files in git workspace are rejected', () => {
  const workspaceDir = createTempDir('agy-ctrl-ws-dt-');
  const profileDir = createTempDir('agy-ctrl-prof-dt-');
  const receiptDir = createTempDir('agy-ctrl-rcpt-dt-');
  const fakeAgyDir = createTempDir('agy-ctrl-fake-dt-');

  try {
    const { head, branch } = initGitWorkspace(workspaceDir);
    const promptFile = path.join(workspaceDir, 'PROMPT.md');
    const promptContent = 'Dirty test prompt\n';
    fs.writeFileSync(promptFile, promptContent, 'utf8');
    const promptHash = getSha256(promptContent);

    const writableDir = path.join(workspaceDir, 'tooling');
    fs.mkdirSync(writableDir, { recursive: true });

    const { cmdPath: fakeAgyPath, breadcrumbPath } = createFakeAgyScript(fakeAgyDir);

    fs.appendFileSync(path.join(workspaceDir, 'README.md'), 'dirty line\n', 'utf8');

    const res = runPwshScript([
      '-WorkspaceRoot', workspaceDir,
      '-PromptFile', promptFile,
      '-ExpectedPromptSha256', promptHash,
      '-ProfileRoot', profileDir,
      '-ReceiptRoot', receiptDir,
      '-WritablePaths', writableDir,
      '-ExpectedBaselineHead', head,
      '-ExpectedBranch', 'main',
      '-AgyExecutable', fakeAgyPath
    ]);

    assert.notEqual(res.exitCode, 0, 'Dirty tracked state in workspace must be rejected');
    assert.equal(fs.existsSync(breadcrumbPath), false, 'Worker launch breadcrumb must be absent on dirty workspace rejection');
  } finally {
    cleanTempDir(workspaceDir);
    cleanTempDir(profileDir);
    cleanTempDir(receiptDir);
    cleanTempDir(fakeAgyDir);
  }
});

test('forbidden broad workspace root C:\\Projects\\SSTAC-Dashboard is rejected', () => {
  const profileDir = createTempDir('agy-ctrl-prof-forb-');
  const receiptDir = createTempDir('agy-ctrl-rcpt-forb-');
  const fakeAgyDir = createTempDir('agy-ctrl-fake-forb-');

  try {
    const { cmdPath: fakeAgyPath, breadcrumbPath } = createFakeAgyScript(fakeAgyDir);

    const res = runPwshScript([
      '-WorkspaceRoot', 'C:\\Projects\\SSTAC-Dashboard',
      '-PromptFile', 'C:\\Projects\\SSTAC-Dashboard\\PROMPT.md',
      '-ExpectedPromptSha256', '0000000000000000000000000000000000000000000000000000000000000000',
      '-ProfileRoot', profileDir,
      '-ReceiptRoot', receiptDir,
      '-WritablePaths', 'C:\\Projects\\SSTAC-Dashboard\\tooling',
      '-ExpectedBaselineHead', 'f7329f150c0b683765f7bbe748a86ec3db8388e8',
      '-ExpectedBranch', 'main',
      '-AgyExecutable', fakeAgyPath
    ]);

    assert.notEqual(res.exitCode, 0, 'Primary checkout C:\\Projects\\SSTAC-Dashboard must be rejected as WorkspaceRoot');
    assert.equal(fs.existsSync(breadcrumbPath), false, 'Worker launch breadcrumb must be absent on forbidden workspace root rejection');
  } finally {
    cleanTempDir(profileDir);
    cleanTempDir(receiptDir);
    cleanTempDir(fakeAgyDir);
  }
});

// -----------------------------------------------------------------------------
// ADVERSARIAL BOUNDARY FIXTURES (LABELED FOR MISSION CONTROL)
// -----------------------------------------------------------------------------

test('[ADVERSARIAL BOUNDARY FIXTURE 1] Manifest settings_sha256 mismatch vs settings.json fails closed', () => {
  const workspaceDir = createTempDir('agy-ctrl-ws-adv1-');
  const profileDir = createTempDir('agy-ctrl-prof-adv1-');
  const receiptDir = createTempDir('agy-ctrl-rcpt-adv1-');
  const fakeAgyDir = createTempDir('agy-ctrl-fake-adv1-');
  const tempToolDir = createTempDir('agy-ctrl-tool-adv1-');

  try {
    const { head, branch } = initGitWorkspace(workspaceDir);
    const promptFile = path.join(workspaceDir, 'PROMPT.md');
    const promptContent = 'Adversarial test prompt 1\n';
    fs.writeFileSync(promptFile, promptContent, 'utf8');
    const promptHash = getSha256(promptContent);

    const writableDir = path.join(workspaceDir, 'tooling');
    fs.mkdirSync(writableDir, { recursive: true });

    const { cmdPath: fakeAgyPath, breadcrumbPath } = createFakeAgyScript(fakeAgyDir);

    const srcToolDir = path.resolve('tooling/agy');
    const copiedControllerPath = path.join(tempToolDir, 'Invoke-AgyAutonomousWorker.ps1');
    const copiedGenPath = path.join(tempToolDir, 'New-AgyExecutorProfile.ps1');
    const copiedValPath = path.join(tempToolDir, 'validate-agy-stream.mjs');

    fs.copyFileSync(path.join(srcToolDir, 'Invoke-AgyAutonomousWorker.ps1'), copiedControllerPath);
    fs.copyFileSync(path.join(srcToolDir, 'New-AgyExecutorProfile.ps1'), copiedGenPath);
    fs.copyFileSync(path.join(srcToolDir, 'validate-agy-stream.mjs'), copiedValPath);

    const origGenCode = fs.readFileSync(copiedGenPath, 'utf8');
    const tamperCode = `
# Deterministic test tamper of settings_sha256 after generation
$manifestPathToTamper = Join-Path $ProfileRoot '.gemini\\antigravity-cli\\PROFILE_MANIFEST.json'
if (Test-Path $manifestPathToTamper) {
    $manifestJson = Get-Content -Raw $manifestPathToTamper | ConvertFrom-Json
    $manifestJson.settings_sha256 = '0000000000000000000000000000000000000000000000000000000000000000'
    $manifestJson | ConvertTo-Json -Depth 10 | Set-Content -Path $manifestPathToTamper -Encoding utf8
}
`;
    fs.writeFileSync(copiedGenPath, (origGenCode + tamperCode).replace(/\r?\n/g, '\n'), 'utf8');

    let resExitCode = 0;
    try {
      execFileSync('pwsh', [
        '-NoProfile', '-File', copiedControllerPath,
        '-WorkspaceRoot', workspaceDir,
        '-PromptFile', promptFile,
        '-ExpectedPromptSha256', promptHash,
        '-ProfileRoot', profileDir,
        '-ReceiptRoot', receiptDir,
        '-WritablePaths', writableDir,
        '-ExpectedBaselineHead', head,
        '-ExpectedBranch', 'main',
        '-AgyExecutable', fakeAgyPath,
        '-ReplaceEmptyGeneratedProfile'
      ], {
        encoding: 'utf8',
        env: { ...process.env },
        stdio: ['pipe', 'pipe', 'pipe']
      });
    } catch (err) {
      resExitCode = err.status || 1;
    }

    assert.notEqual(
      resExitCode,
      0,
      '[ADVERSARIAL BOUNDARY FIXTURE 1] Tampered manifest settings_sha256 must fail closed'
    );
    assert.equal(fs.existsSync(breadcrumbPath), false, 'Worker launch breadcrumb must be absent on manifest settings_sha256 mismatch');
  } finally {
    cleanTempDir(workspaceDir);
    cleanTempDir(profileDir);
    cleanTempDir(receiptDir);
    cleanTempDir(fakeAgyDir);
    cleanTempDir(tempToolDir);
  }
});

test('[ADVERSARIAL BOUNDARY FIXTURE 2] Nonempty receipt root containing pre-existing extra file without -ReplaceEmptyGeneratedProfile fails closed', () => {
  const workspaceDir = createTempDir('agy-ctrl-ws-adv2-');
  const profileDir = createTempDir('agy-ctrl-prof-adv2-');
  const receiptDir = createTempDir('agy-ctrl-rcpt-adv2-');
  const fakeAgyDir = createTempDir('agy-ctrl-fake-adv2-');

  try {
    const { head, branch } = initGitWorkspace(workspaceDir);
    const promptFile = path.join(workspaceDir, 'PROMPT.md');
    const promptContent = 'Adversarial test prompt 2\n';
    fs.writeFileSync(promptFile, promptContent, 'utf8');
    const promptHash = getSha256(promptContent);

    const writableDir = path.join(workspaceDir, 'tooling');
    fs.mkdirSync(writableDir, { recursive: true });

    const { cmdPath: fakeAgyPath, breadcrumbPath } = createFakeAgyScript(fakeAgyDir);

    fs.writeFileSync(path.join(receiptDir, 'unauthorized_payload.txt'), 'malicious content\n', 'utf8');

    const res = runPwshScript([
      '-WorkspaceRoot', workspaceDir,
      '-PromptFile', promptFile,
      '-ExpectedPromptSha256', promptHash,
      '-ProfileRoot', profileDir,
      '-ReceiptRoot', receiptDir,
      '-WritablePaths', writableDir,
      '-ExpectedBaselineHead', head,
      '-ExpectedBranch', 'main',
      '-AgyExecutable', fakeAgyPath
    ]);

    assert.notEqual(
      res.exitCode,
      0,
      '[ADVERSARIAL BOUNDARY FIXTURE 2] Nonempty receipt root with unauthorized file must be rejected'
    );
    assert.equal(fs.existsSync(breadcrumbPath), false, 'Worker launch breadcrumb must be absent on nonempty receipt root rejection');
  } finally {
    cleanTempDir(workspaceDir);
    cleanTempDir(profileDir);
    cleanTempDir(receiptDir);
    cleanTempDir(fakeAgyDir);
  }
});

test('[ADVERSARIAL BOUNDARY FIXTURE 3] Nonempty receipt root containing valid artifact is accepted with -ReplaceEmptyGeneratedProfile', () => {
  const workspaceDir = createTempDir('agy-ctrl-ws-adv3-');
  const profileDir = createTempDir('agy-ctrl-prof-adv3-');
  const receiptDir = createTempDir('agy-ctrl-rcpt-adv3-');
  const fakeAgyDir = createTempDir('agy-ctrl-fake-adv3-');

  try {
    const { head, branch } = initGitWorkspace(workspaceDir);
    const promptFile = path.join(workspaceDir, 'PROMPT.md');
    const promptContent = 'Adversarial test prompt 3\n';
    fs.writeFileSync(promptFile, promptContent, 'utf8');
    const promptHash = getSha256(promptContent);

    const writableDir = path.join(workspaceDir, 'tooling');
    fs.mkdirSync(writableDir, { recursive: true });

    const { cmdPath: fakeAgyPath, breadcrumbPath } = createFakeAgyScript(fakeAgyDir);
    const validStreamPath = createValidStreamFile(fakeAgyDir, workspaceDir);

    fs.writeFileSync(path.join(receiptDir, 'POSTFLIGHT_WORKSPACE_AUTHORITY.json'), '{}', 'utf8');

    const res = runPwshScript([
      '-WorkspaceRoot', workspaceDir,
      '-PromptFile', promptFile,
      '-ExpectedPromptSha256', promptHash,
      '-ProfileRoot', profileDir,
      '-ReceiptRoot', receiptDir,
      '-WritablePaths', writableDir,
      '-ExpectedBaselineHead', head,
      '-ExpectedBranch', branch,
      '-AgyExecutable', fakeAgyPath,
      '-ReplaceEmptyGeneratedProfile'
    ], {
      FAKE_AGY_STREAM_FILE: validStreamPath,
      PATH: process.env.PATH
    });

    assert.equal(
      res.exitCode,
      0,
      '[ADVERSARIAL BOUNDARY FIXTURE 3] Nonempty receipt root with authorized file must be accepted'
    );
    assert.equal(fs.existsSync(breadcrumbPath), true, 'Worker launch breadcrumb must be present');
  } finally {
    cleanTempDir(workspaceDir);
    cleanTempDir(profileDir);
    cleanTempDir(receiptDir);
    cleanTempDir(fakeAgyDir);
  }
});

test('[REVIEWER BOUNDARY FIXTURE] native diagnostic log starting with JSON does not masquerade as structured stream when stdout is missing or malformed', () => {
  const workspaceDir = createTempDir('agy-ctrl-ws-rev-');
  const profileDir = createTempDir('agy-ctrl-prof-rev-');
  const receiptDir = createTempDir('agy-ctrl-rcpt-rev-');
  const fakeAgyDir = createTempDir('agy-ctrl-fake-rev-');

  try {
    const { head, branch } = initGitWorkspace(workspaceDir);
    const promptFile = path.join(workspaceDir, 'PROMPT.md');
    const promptContent = 'Execute reviewer boundary test prompt.\n';
    fs.writeFileSync(promptFile, promptContent, 'utf8');
    const promptHash = getSha256(promptContent);

    const writableDir = path.join(workspaceDir, 'tooling');
    fs.mkdirSync(writableDir, { recursive: true });

    const { cmdPath: fakeAgyPath, breadcrumbPath } = createFakeAgyScript(fakeAgyDir);

    const diagnosticLogText = JSON.stringify({ level: 'info', msg: 'Started AGY worker' }) + '\n2026-07-30 [DIAGNOSTIC] non-stream diagnostic line\n';

    const res = runPwshScript([
      '-WorkspaceRoot', workspaceDir,
      '-PromptFile', promptFile,
      '-ExpectedPromptSha256', promptHash,
      '-ProfileRoot', profileDir,
      '-ReceiptRoot', receiptDir,
      '-WritablePaths', writableDir,
      '-ExpectedBaselineHead', head,
      '-ExpectedBranch', 'main',
      '-AgyExecutable', fakeAgyPath
    ], {
      FAKE_AGY_LOG_TEXT: diagnosticLogText,
      FAKE_AGY_EXIT_CODE: '0'
    });

    assert.notEqual(res.exitCode, 0, 'Controller must fail closed when stdout is empty/malformed even if diagnostic log starts with valid JSON');
    assert.ok(fs.existsSync(breadcrumbPath), 'Worker mode launch breadcrumb must exist for reviewer boundary test');

    const logPath = path.join(receiptDir, 'log.txt');
    assert.ok(fs.existsSync(logPath), 'log.txt must contain the diagnostic log');
    const logContent = fs.readFileSync(logPath, 'utf8');
    assert.ok(logContent.startsWith('{"level":"info"'), 'log.txt starts with JSON object');

    const verdictObj = JSON.parse(fs.readFileSync(path.join(receiptDir, 'verdict.json'), 'utf8'));
    assert.equal(verdictObj.status, 'RED', 'Verdict status must be RED');
  } finally {
    cleanTempDir(workspaceDir);
    cleanTempDir(profileDir);
    cleanTempDir(receiptDir);
    cleanTempDir(fakeAgyDir);
  }
});

test('fake AGY modifying settings.json after launch fails closed with MISMATCH postflight receipt and sealed manifest', () => {
  const workspaceDir = createTempDir('agy-ctrl-ws-modset-');
  const profileDir = createTempDir('agy-ctrl-prof-modset-');
  const receiptDir = createTempDir('agy-ctrl-rcpt-modset-');
  const fakeAgyDir = createTempDir('agy-ctrl-fake-modset-');

  try {
    const { head, branch } = initGitWorkspace(workspaceDir);
    const promptFile = path.join(workspaceDir, 'PROMPT.md');
    const promptContent = 'Execute settings modification test.\n';
    fs.writeFileSync(promptFile, promptContent, 'utf8');
    const promptHash = getSha256(promptContent);

    const writableDir = path.join(workspaceDir, 'tooling');
    fs.mkdirSync(writableDir, { recursive: true });

    const { cmdPath: fakeAgyPath, breadcrumbPath } = createFakeAgyScript(fakeAgyDir);
    const validStreamPath = createValidStreamFile(fakeAgyDir, workspaceDir);

    const res = runPwshScript([
      '-WorkspaceRoot', workspaceDir,
      '-PromptFile', promptFile,
      '-ExpectedPromptSha256', promptHash,
      '-ProfileRoot', profileDir,
      '-ReceiptRoot', receiptDir,
      '-WritablePaths', writableDir,
      '-ExpectedBaselineHead', head,
      '-ExpectedBranch', 'main',
      '-AgyExecutable', fakeAgyPath
    ], {
      FAKE_AGY_STREAM_FILE: validStreamPath,
      FAKE_AGY_EXIT_CODE: '0',
      FAKE_AGY_MUTATE_SETTINGS: 'MODIFY'
    });

    assert.notEqual(res.exitCode, 0, 'Settings modification post-launch must fail the controller script');
    assert.ok(fs.existsSync(breadcrumbPath), 'Worker mode launch breadcrumb must exist');
    assert.ok(
      res.stderr.includes('post-run settings authority mismatch') || res.stdout.includes('post-run settings authority mismatch'),
      `Controller stderr/stdout must report post-run settings authority mismatch. Stderr: ${res.stderr}`
    );

    const postflightPath = path.join(receiptDir, 'POSTFLIGHT_SETTINGS_AUTHORITY.json');
    assert.ok(fs.existsSync(postflightPath), 'POSTFLIGHT_SETTINGS_AUTHORITY.json must exist');
    const postflightObj = JSON.parse(fs.readFileSync(postflightPath, 'utf8'));

    assert.equal(postflightObj.status, 'MISMATCH');
    assert.notEqual(postflightObj.pre_launch_sha256, postflightObj.post_run_sha256);
    assert.ok(postflightObj.pre_launch_sha256, 'pre_launch_sha256 must be present');
    assert.ok(postflightObj.post_run_sha256, 'post_run_sha256 must be present');

    const manifestShaContent = fs.readFileSync(path.join(receiptDir, 'MANIFEST.sha256'), 'utf8');
    assert.ok(manifestShaContent.includes('POSTFLIGHT_SETTINGS_AUTHORITY.json'), 'MANIFEST.sha256 must cover POSTFLIGHT_SETTINGS_AUTHORITY.json');

    const nativeExitText = fs.readFileSync(path.join(receiptDir, 'NATIVE_EXIT.txt'), 'utf8').trim();
    assert.equal(nativeExitText, '0', 'NATIVE_EXIT.txt must honestly record 0');

    const validatorExitText = fs.readFileSync(path.join(receiptDir, 'VALIDATOR_EXIT.txt'), 'utf8').trim();
    assert.equal(validatorExitText, '0', 'VALIDATOR_EXIT.txt must honestly record 0');

    const verdictObj = JSON.parse(fs.readFileSync(path.join(receiptDir, 'verdict.json'), 'utf8'));
    assert.equal(verdictObj.status, 'GREEN', 'Stream verdict must honestly remain GREEN');

    // Verify controller did NOT rewrite or repair settings.json
    const settingsPath = path.join(profileDir, '.gemini', 'antigravity-cli', 'settings.json');
    assert.ok(fs.existsSync(settingsPath), 'settings.json must still exist');
    const actualPostSettingsHash = getSha256(fs.readFileSync(settingsPath));
    assert.equal(actualPostSettingsHash, postflightObj.post_run_sha256, 'Controller must not rewrite or repair modified settings.json file');
  } finally {
    cleanTempDir(workspaceDir);
    cleanTempDir(profileDir);
    cleanTempDir(receiptDir);
    cleanTempDir(fakeAgyDir);
  }
});

test('deleting settings.json after launch fails closed with sealed diagnostic receipt', () => {
  const workspaceDir = createTempDir('agy-ctrl-ws-delset-');
  const profileDir = createTempDir('agy-ctrl-prof-delset-');
  const receiptDir = createTempDir('agy-ctrl-rcpt-delset-');
  const fakeAgyDir = createTempDir('agy-ctrl-fake-delset-');

  try {
    const { head, branch } = initGitWorkspace(workspaceDir);
    const promptFile = path.join(workspaceDir, 'PROMPT.md');
    const promptContent = 'Execute settings deletion test.\n';
    fs.writeFileSync(promptFile, promptContent, 'utf8');
    const promptHash = getSha256(promptContent);

    const writableDir = path.join(workspaceDir, 'tooling');
    fs.mkdirSync(writableDir, { recursive: true });

    const { cmdPath: fakeAgyPath, breadcrumbPath } = createFakeAgyScript(fakeAgyDir);
    const validStreamPath = createValidStreamFile(fakeAgyDir, workspaceDir);

    const res = runPwshScript([
      '-WorkspaceRoot', workspaceDir,
      '-PromptFile', promptFile,
      '-ExpectedPromptSha256', promptHash,
      '-ProfileRoot', profileDir,
      '-ReceiptRoot', receiptDir,
      '-WritablePaths', writableDir,
      '-ExpectedBaselineHead', head,
      '-ExpectedBranch', 'main',
      '-AgyExecutable', fakeAgyPath
    ], {
      FAKE_AGY_STREAM_FILE: validStreamPath,
      FAKE_AGY_EXIT_CODE: '0',
      FAKE_AGY_MUTATE_SETTINGS: 'DELETE'
    });

    assert.notEqual(res.exitCode, 0, 'Settings deletion post-launch must fail the controller script');
    assert.ok(fs.existsSync(breadcrumbPath), 'Worker mode launch breadcrumb must exist');

    const postflightPath = path.join(receiptDir, 'POSTFLIGHT_SETTINGS_AUTHORITY.json');
    assert.ok(fs.existsSync(postflightPath), 'POSTFLIGHT_SETTINGS_AUTHORITY.json must exist');
    const postflightObj = JSON.parse(fs.readFileSync(postflightPath, 'utf8'));

    assert.equal(postflightObj.status, 'MISMATCH');
    assert.ok(postflightObj.pre_launch_sha256, 'pre_launch_sha256 must be present');
    assert.notEqual(postflightObj.pre_launch_sha256, postflightObj.post_run_sha256);

    const manifestShaContent = fs.readFileSync(path.join(receiptDir, 'MANIFEST.sha256'), 'utf8');
    assert.ok(manifestShaContent.includes('POSTFLIGHT_SETTINGS_AUTHORITY.json'), 'MANIFEST.sha256 must cover POSTFLIGHT_SETTINGS_AUTHORITY.json');
  } finally {
    cleanTempDir(workspaceDir);
    cleanTempDir(profileDir);
    cleanTempDir(receiptDir);
    cleanTempDir(fakeAgyDir);
  }
});

test('missing Node executable fails before fake AGY launch breadcrumb', () => {
  const workspaceDir = createTempDir('agy-ctrl-ws-node-missing-');
  const profileDir = createTempDir('agy-ctrl-prof-node-missing-');
  const receiptDir = createTempDir('agy-ctrl-rcpt-node-missing-');
  const fakeAgyDir = createTempDir('agy-ctrl-fake-node-missing-');

  try {
    const { head, branch } = initGitWorkspace(workspaceDir);
    const promptFile = path.join(workspaceDir, 'PROMPT.md');
    const promptContent = 'Missing Node executable test prompt\n';
    fs.writeFileSync(promptFile, promptContent, 'utf8');
    const promptHash = getSha256(promptContent);

    const writableDir = path.join(workspaceDir, 'tooling');
    fs.mkdirSync(writableDir, { recursive: true });

    const { cmdPath: fakeAgyPath, breadcrumbPath } = createFakeAgyScript(fakeAgyDir);
    const missingNodePath = path.join(fakeAgyDir, 'nonexistent-node-bin.exe');

    const res = runPwshScript([
      '-WorkspaceRoot', workspaceDir,
      '-PromptFile', promptFile,
      '-ExpectedPromptSha256', promptHash,
      '-ProfileRoot', profileDir,
      '-ReceiptRoot', receiptDir,
      '-WritablePaths', writableDir,
      '-ExpectedBaselineHead', head,
      '-ExpectedBranch', 'main',
      '-AgyExecutable', fakeAgyPath,
      '-NodeExecutable', missingNodePath
    ]);

    assert.notEqual(res.exitCode, 0, 'Missing Node executable must cause controller to fail');
    assert.ok(res.stderr.includes('Node executable') || res.stdout.includes('Node executable'), 'Error message must mention Node executable resolution failure');
    assert.equal(fs.existsSync(breadcrumbPath), false, 'Worker launch breadcrumb must be absent when Node executable is missing');
  } finally {
    cleanTempDir(workspaceDir);
    cleanTempDir(profileDir);
    cleanTempDir(receiptDir);
    cleanTempDir(fakeAgyDir);
  }
});

test('executable that cannot syntax-check validator fails before fake AGY launch', () => {
  const workspaceDir = createTempDir('agy-ctrl-ws-node-chkfail-');
  const profileDir = createTempDir('agy-ctrl-prof-node-chkfail-');
  const receiptDir = createTempDir('agy-ctrl-rcpt-node-chkfail-');
  const fakeAgyDir = createTempDir('agy-ctrl-fake-node-chkfail-');
  const fakeNodeDir = createTempDir('agy-ctrl-fake-nodebin-');

  try {
    const { head, branch } = initGitWorkspace(workspaceDir);
    const promptFile = path.join(workspaceDir, 'PROMPT.md');
    const promptContent = 'Node check failure test prompt\n';
    fs.writeFileSync(promptFile, promptContent, 'utf8');
    const promptHash = getSha256(promptContent);

    const writableDir = path.join(workspaceDir, 'tooling');
    fs.mkdirSync(writableDir, { recursive: true });

    const { cmdPath: fakeAgyPath, breadcrumbPath } = createFakeAgyScript(fakeAgyDir);

    const fakeNodeFixture = path.join(fakeNodeDir, 'fake-node-check-fail.cjs');
    const fakeNodeCmd = path.join(fakeNodeDir, 'fake-node-check-fail.cmd');

    const fixtureContent = `
const args = process.argv.slice(2);
if (args[0] === '--version') {
  process.stdout.write('v20.0.0\\n');
  process.exit(0);
}
if (args[0] === '--check') {
  process.stderr.write('Preflight SyntaxError: Unexpected token\\n');
  process.exit(1);
}
process.exit(0);
`;
    fs.writeFileSync(fakeNodeFixture, fixtureContent.replace(/\r?\n/g, '\n'), 'utf8');
    const cmdContent = `@echo off\n"${process.execPath}" "${fakeNodeFixture}" %*\nexit /b %ERRORLEVEL%\n`;
    fs.writeFileSync(fakeNodeCmd, cmdContent.replace(/\r?\n/g, '\n'), 'utf8');

    const res = runPwshScript([
      '-WorkspaceRoot', workspaceDir,
      '-PromptFile', promptFile,
      '-ExpectedPromptSha256', promptHash,
      '-ProfileRoot', profileDir,
      '-ReceiptRoot', receiptDir,
      '-WritablePaths', writableDir,
      '-ExpectedBaselineHead', head,
      '-ExpectedBranch', 'main',
      '-AgyExecutable', fakeAgyPath,
      '-NodeExecutable', fakeNodeCmd
    ]);

    assert.notEqual(res.exitCode, 0, 'Validator preflight syntax check failure must fail controller script');
    assert.ok(res.stderr.includes('preflight') || res.stderr.includes('syntax check') || res.stdout.includes('preflight'), 'Error message must report validator preflight failure');
    assert.equal(fs.existsSync(breadcrumbPath), false, 'Worker launch breadcrumb must be absent when validator syntax check fails');
  } finally {
    cleanTempDir(workspaceDir);
    cleanTempDir(profileDir);
    cleanTempDir(receiptDir);
    cleanTempDir(fakeAgyDir);
    cleanTempDir(fakeNodeDir);
  }
});

test('production validator call uses resolved Node executable', () => {
  const workspaceDir = createTempDir('agy-ctrl-ws-node-prodval-');
  const profileDir = createTempDir('agy-ctrl-prof-node-prodval-');
  const receiptDir = createTempDir('agy-ctrl-rcpt-node-prodval-');
  const fakeAgyDir = createTempDir('agy-ctrl-fake-node-prodval-');
  const fakeNodeDir = createTempDir('agy-ctrl-fake-noderes-');

  try {
    const { head, branch } = initGitWorkspace(workspaceDir);
    const promptFile = path.join(workspaceDir, 'PROMPT.md');
    const promptContent = 'Production validator executable test prompt\n';
    fs.writeFileSync(promptFile, promptContent, 'utf8');
    const promptHash = getSha256(promptContent);

    const writableDir = path.join(workspaceDir, 'tooling');
    fs.mkdirSync(writableDir, { recursive: true });

    const { cmdPath: fakeAgyPath, breadcrumbPath } = createFakeAgyScript(fakeAgyDir);
    const validStreamPath = createValidStreamFile(fakeAgyDir, workspaceDir);

    const fakeNodeFixture = path.join(fakeNodeDir, 'fake-node-prodval.cjs');
    const fakeNodeCmd = path.join(fakeNodeDir, 'fake-node-prodval.cmd');
    const validatorInvocationBreadcrumb = path.join(fakeNodeDir, 'node_val_breadcrumb.txt');

    const fixtureContent = `
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const args = process.argv.slice(2);

if (args[0] === '--version') {
  process.stdout.write('v20.10.0-custom\\n');
  process.exit(0);
}
if (args[0] === '--check') {
  process.exit(0);
}

// Production validator call execution path
fs.writeFileSync(${JSON.stringify(validatorInvocationBreadcrumb)}, 'used-resolved-node\\n', 'utf8');
const res = spawnSync(${JSON.stringify(process.execPath)}, args, { stdio: 'inherit' });
process.exit(res.status !== null ? res.status : 1);
`;
    fs.writeFileSync(fakeNodeFixture, fixtureContent.replace(/\r?\n/g, '\n'), 'utf8');
    const cmdContent = `@echo off\n"${process.execPath}" "${fakeNodeFixture}" %*\nexit /b %ERRORLEVEL%\n`;
    fs.writeFileSync(fakeNodeCmd, cmdContent.replace(/\r?\n/g, '\n'), 'utf8');

    const res = runPwshScript([
      '-WorkspaceRoot', workspaceDir,
      '-PromptFile', promptFile,
      '-ExpectedPromptSha256', promptHash,
      '-ProfileRoot', profileDir,
      '-ReceiptRoot', receiptDir,
      '-WritablePaths', writableDir,
      '-ExpectedBaselineHead', head,
      '-ExpectedBranch', 'main',
      '-AgyExecutable', fakeAgyPath,
      '-NodeExecutable', fakeNodeCmd
    ], {
      FAKE_AGY_STREAM_FILE: validStreamPath,
      FAKE_AGY_EXIT_CODE: '0'
    });

    assert.equal(res.exitCode, 0, `Controller exit code must be 0. Stderr: ${res.stderr}`);
    assert.ok(fs.existsSync(breadcrumbPath), 'Worker mode launch breadcrumb must exist');
    assert.ok(fs.existsSync(validatorInvocationBreadcrumb), 'Production validator call must execute via resolved Node executable');

    const launchContract = JSON.parse(fs.readFileSync(path.join(receiptDir, 'LAUNCH_CONTRACT.json'), 'utf8'));
    assert.equal(launchContract.node_executable, path.resolve(fakeNodeCmd), 'LAUNCH_CONTRACT node_executable must record resolved Node executable');
    assert.equal(launchContract.node_version, 'v20.10.0-custom', 'LAUNCH_CONTRACT node_version must record observed Node version');

    const verdictObj = JSON.parse(fs.readFileSync(path.join(receiptDir, 'verdict.json'), 'utf8'));
    assert.equal(verdictObj.status, 'GREEN', 'Verdict status must be GREEN');
  } finally {
    cleanTempDir(workspaceDir);
    cleanTempDir(profileDir);
    cleanTempDir(receiptDir);
    cleanTempDir(fakeAgyDir);
    cleanTempDir(fakeNodeDir);
  }
});

// -----------------------------------------------------------------------------
// TRACKED DIRTY CONTINUATION CONTRACT TESTS
// -----------------------------------------------------------------------------

test('tracked dirty continuation: exact dirty path plus exact hash launches and records binding', () => {
  const workspaceDir = createTempDir('agy-ctrl-ws-cont-good-');
  const profileDir = createTempDir('agy-ctrl-prof-cont-good-');
  const receiptDir = createTempDir('agy-ctrl-rcpt-cont-good-');
  const fakeAgyDir = createTempDir('agy-ctrl-fake-cont-good-');

  try {
    const { branch } = initGitWorkspace(workspaceDir);
    const promptFile = path.join(workspaceDir, 'PROMPT.md');
    const promptContent = 'Continuation test prompt\n';
    fs.writeFileSync(promptFile, promptContent, 'utf8');
    const promptHash = getSha256(promptContent);

    const writableDir = path.join(workspaceDir, 'tooling');
    fs.mkdirSync(writableDir, { recursive: true });

    const trackedFile = path.join(writableDir, 'tracked-file.txt');
    fs.writeFileSync(trackedFile, 'initial content\n', 'utf8');
    execFileSync('git', ['add', trackedFile], { cwd: workspaceDir, stdio: 'ignore' });
    execFileSync('git', ['commit', '-m', 'Add tracked file'], { cwd: workspaceDir, stdio: 'ignore' });
    const newHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: workspaceDir, encoding: 'utf8' }).trim();

    const dirtyContent = 'modified content\n';
    fs.writeFileSync(trackedFile, dirtyContent, 'utf8');
    const dirtyHash = getSha256(dirtyContent);

    const { cmdPath: fakeAgyPath, breadcrumbPath } = createFakeAgyScript(fakeAgyDir);
    const validStreamPath = createValidStreamFile(fakeAgyDir, workspaceDir);

    const res = runPwshScript([
      '-WorkspaceRoot', workspaceDir,
      '-PromptFile', promptFile,
      '-ExpectedPromptSha256', promptHash,
      '-ProfileRoot', profileDir,
      '-ReceiptRoot', receiptDir,
      '-WritablePaths', writableDir,
      '-ExpectedBaselineHead', newHead,
      '-ExpectedBranch', 'main',
      '-ExpectedTrackedDirtyPaths', trackedFile,
      '-ExpectedTrackedDirtySha256', dirtyHash,
      '-AgyExecutable', fakeAgyPath
    ], {
      FAKE_AGY_STREAM_FILE: validStreamPath,
      FAKE_AGY_EXIT_CODE: '0'
    });

    assert.equal(res.exitCode, 0, `Expected exit code 0, got ${res.exitCode}. Stderr: ${res.stderr}`);
    assert.ok(fs.existsSync(breadcrumbPath), 'Worker launch breadcrumb must exist');

    const launchContract = JSON.parse(fs.readFileSync(path.join(receiptDir, 'LAUNCH_CONTRACT.json'), 'utf8'));
    assert.ok(Array.isArray(launchContract.tracked_dirty_files), 'tracked_dirty_files must be an array');
    assert.equal(launchContract.tracked_dirty_files.length, 1);
    assert.equal(launchContract.tracked_dirty_files[0].path, 'tooling/tracked-file.txt');
    assert.equal(launchContract.tracked_dirty_files[0].sha256, dirtyHash);
  } finally {
    cleanTempDir(workspaceDir);
    cleanTempDir(profileDir);
    cleanTempDir(receiptDir);
    cleanTempDir(fakeAgyDir);
  }
});

test('tracked dirty continuation: multiple tracked unstaged dirty files are parsed and recorded in deterministic order', () => {
  const workspaceDir = createTempDir('agy-ctrl-ws-cont-multi-');
  const profileDir = createTempDir('agy-ctrl-prof-cont-multi-');
  const receiptDir = createTempDir('agy-ctrl-rcpt-cont-multi-');
  const fakeAgyDir = createTempDir('agy-ctrl-fake-cont-multi-');

  try {
    const { branch } = initGitWorkspace(workspaceDir);
    const promptFile = path.join(workspaceDir, 'PROMPT.md');
    const promptContent = 'Multi continuation test prompt\n';
    fs.writeFileSync(promptFile, promptContent, 'utf8');
    const promptHash = getSha256(promptContent);

    const writableDir = path.join(workspaceDir, 'tooling');
    fs.mkdirSync(writableDir, { recursive: true });

    const trackedFile1 = path.join(writableDir, 'b-tracked-file.txt');
    const trackedFile2 = path.join(writableDir, 'a-tracked-file.txt');
    fs.writeFileSync(trackedFile1, 'initial content 1\n', 'utf8');
    fs.writeFileSync(trackedFile2, 'initial content 2\n', 'utf8');
    execFileSync('git', ['add', trackedFile1, trackedFile2], { cwd: workspaceDir, stdio: 'ignore' });
    execFileSync('git', ['commit', '-m', 'Add multi tracked files'], { cwd: workspaceDir, stdio: 'ignore' });
    const newHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: workspaceDir, encoding: 'utf8' }).trim();

    const dirtyContent1 = 'modified content 1\n';
    const dirtyContent2 = 'modified content 2\n';
    fs.writeFileSync(trackedFile1, dirtyContent1, 'utf8');
    fs.writeFileSync(trackedFile2, dirtyContent2, 'utf8');
    const dirtyHash1 = getSha256(dirtyContent1);
    const dirtyHash2 = getSha256(dirtyContent2);

    const { cmdPath: fakeAgyPath, breadcrumbPath } = createFakeAgyScript(fakeAgyDir);
    const validStreamPath = createValidStreamFile(fakeAgyDir, workspaceDir);

    const psCommand = '& $env:CONTROLLER_SCRIPT_PATH -WorkspaceRoot $env:TEST_WORKSPACE_DIR -PromptFile $env:TEST_PROMPT_FILE -ExpectedPromptSha256 $env:TEST_PROMPT_HASH -ProfileRoot $env:TEST_PROFILE_DIR -ReceiptRoot $env:TEST_RECEIPT_DIR -WritablePaths $env:TEST_WRITABLE_DIR -ExpectedBaselineHead $env:TEST_BASELINE_HEAD -ExpectedBranch $env:TEST_BRANCH -ExpectedTrackedDirtyPaths @($env:TEST_DIRTY_PATH_1, $env:TEST_DIRTY_PATH_2) -ExpectedTrackedDirtySha256 @($env:TEST_DIRTY_SHA_1, $env:TEST_DIRTY_SHA_2) -AgyExecutable $env:TEST_AGY_PATH';

    let resExit = 0;
    let resStderr = '';
    try {
      execFileSync('pwsh', ['-NoProfile', '-Command', psCommand], {
        encoding: 'utf8',
        env: {
          ...process.env,
          CONTROLLER_SCRIPT_PATH,
          TEST_WORKSPACE_DIR: workspaceDir,
          TEST_PROMPT_FILE: promptFile,
          TEST_PROMPT_HASH: promptHash,
          TEST_PROFILE_DIR: profileDir,
          TEST_RECEIPT_DIR: receiptDir,
          TEST_WRITABLE_DIR: writableDir,
          TEST_BASELINE_HEAD: newHead,
          TEST_BRANCH: branch,
          TEST_DIRTY_PATH_1: trackedFile1,
          TEST_DIRTY_PATH_2: trackedFile2,
          TEST_DIRTY_SHA_1: dirtyHash1,
          TEST_DIRTY_SHA_2: dirtyHash2,
          TEST_AGY_PATH: fakeAgyPath,
          FAKE_AGY_STREAM_FILE: validStreamPath,
          FAKE_AGY_EXIT_CODE: '0'
        },
        stdio: ['pipe', 'pipe', 'pipe']
      });
    } catch (err) {
      resExit = err.status || 1;
      resStderr = err.stderr ? err.stderr.toString() : err.message;
    }

    assert.equal(resExit, 0, `Expected exit code 0, got ${resExit}. Stderr: ${resStderr}`);
    assert.ok(fs.existsSync(breadcrumbPath), 'Worker launch breadcrumb must exist');

    const launchContract = JSON.parse(fs.readFileSync(path.join(receiptDir, 'LAUNCH_CONTRACT.json'), 'utf8'));
    assert.ok(Array.isArray(launchContract.tracked_dirty_files), 'tracked_dirty_files must be an array');
    assert.equal(launchContract.tracked_dirty_files.length, 2);
    assert.equal(launchContract.tracked_dirty_files[0].path, 'tooling/a-tracked-file.txt');
    assert.equal(launchContract.tracked_dirty_files[0].sha256, dirtyHash2);
    assert.equal(launchContract.tracked_dirty_files[1].path, 'tooling/b-tracked-file.txt');
    assert.equal(launchContract.tracked_dirty_files[1].sha256, dirtyHash1);
  } finally {
    cleanTempDir(workspaceDir);
    cleanTempDir(profileDir);
    cleanTempDir(receiptDir);
    cleanTempDir(fakeAgyDir);
  }
});

test('tracked dirty continuation: wrong hash fails before fake AGY launch', () => {
  const workspaceDir = createTempDir('agy-ctrl-ws-cont-badhash-');
  const profileDir = createTempDir('agy-ctrl-prof-cont-badhash-');
  const receiptDir = createTempDir('agy-ctrl-rcpt-cont-badhash-');
  const fakeAgyDir = createTempDir('agy-ctrl-fake-cont-badhash-');

  try {
    const { branch } = initGitWorkspace(workspaceDir);
    const promptFile = path.join(workspaceDir, 'PROMPT.md');
    fs.writeFileSync(promptFile, 'Prompt\n', 'utf8');
    const promptHash = getSha256('Prompt\n');

    const writableDir = path.join(workspaceDir, 'tooling');
    fs.mkdirSync(writableDir, { recursive: true });

    const trackedFile = path.join(writableDir, 'tracked-file.txt');
    fs.writeFileSync(trackedFile, 'initial content\n', 'utf8');
    execFileSync('git', ['add', trackedFile], { cwd: workspaceDir, stdio: 'ignore' });
    execFileSync('git', ['commit', '-m', 'Add tracked file'], { cwd: workspaceDir, stdio: 'ignore' });
    const newHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: workspaceDir, encoding: 'utf8' }).trim();

    fs.writeFileSync(trackedFile, 'modified content\n', 'utf8');
    const wrongHash = '0000000000000000000000000000000000000000000000000000000000000000';

    const { cmdPath: fakeAgyPath, breadcrumbPath } = createFakeAgyScript(fakeAgyDir);

    const res = runPwshScript([
      '-WorkspaceRoot', workspaceDir,
      '-PromptFile', promptFile,
      '-ExpectedPromptSha256', promptHash,
      '-ProfileRoot', profileDir,
      '-ReceiptRoot', receiptDir,
      '-WritablePaths', writableDir,
      '-ExpectedBaselineHead', newHead,
      '-ExpectedBranch', 'main',
      '-ExpectedTrackedDirtyPaths', trackedFile,
      '-ExpectedTrackedDirtySha256', wrongHash,
      '-AgyExecutable', fakeAgyPath
    ]);

    assert.notEqual(res.exitCode, 0, 'Wrong hash must fail before launch');
    assert.equal(fs.existsSync(breadcrumbPath), false, 'Breadcrumb must be absent');
  } finally {
    cleanTempDir(workspaceDir);
    cleanTempDir(profileDir);
    cleanTempDir(receiptDir);
    cleanTempDir(fakeAgyDir);
  }
});

test('tracked dirty continuation: missing expected path or extra live dirty path fails before launch', () => {
  const workspaceDir = createTempDir('agy-ctrl-ws-cont-setmm-');
  const profileDir = createTempDir('agy-ctrl-prof-cont-setmm-');
  const receiptDir = createTempDir('agy-ctrl-rcpt-cont-setmm-');
  const fakeAgyDir = createTempDir('agy-ctrl-fake-cont-setmm-');

  try {
    const { branch } = initGitWorkspace(workspaceDir);
    const promptFile = path.join(workspaceDir, 'PROMPT.md');
    fs.writeFileSync(promptFile, 'Prompt\n', 'utf8');
    const promptHash = getSha256('Prompt\n');

    const writableDir = path.join(workspaceDir, 'tooling');
    fs.mkdirSync(writableDir, { recursive: true });

    const fileA = path.join(writableDir, 'fileA.txt');
    const fileB = path.join(writableDir, 'fileB.txt');
    fs.writeFileSync(fileA, 'A\n', 'utf8');
    fs.writeFileSync(fileB, 'B\n', 'utf8');
    execFileSync('git', ['add', fileA, fileB], { cwd: workspaceDir, stdio: 'ignore' });
    execFileSync('git', ['commit', '-m', 'Add files'], { cwd: workspaceDir, stdio: 'ignore' });
    const newHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: workspaceDir, encoding: 'utf8' }).trim();

    fs.writeFileSync(fileA, 'A modified\n', 'utf8');
    const hashA = getSha256('A modified\n');

    const { cmdPath: fakeAgyPath, breadcrumbPath } = createFakeAgyScript(fakeAgyDir);

    const hashB = getSha256('B\n');
    const psCmdMissing = '& $env:CONTROLLER_SCRIPT_PATH -WorkspaceRoot $env:TEST_WORKSPACE_DIR -PromptFile $env:TEST_PROMPT_FILE -ExpectedPromptSha256 $env:TEST_PROMPT_HASH -ProfileRoot $env:TEST_PROFILE_DIR -ReceiptRoot $env:TEST_RECEIPT_DIR -WritablePaths $env:TEST_WRITABLE_DIR -ExpectedBaselineHead $env:TEST_BASELINE_HEAD -ExpectedBranch $env:TEST_BRANCH -ExpectedTrackedDirtyPaths @($env:TEST_DIRTY_PATH_1, $env:TEST_DIRTY_PATH_2) -ExpectedTrackedDirtySha256 @($env:TEST_DIRTY_SHA_1, $env:TEST_DIRTY_SHA_2) -AgyExecutable $env:TEST_AGY_PATH';
    let resMissingExit = 0;
    try {
      execFileSync('pwsh', ['-NoProfile', '-Command', psCmdMissing], {
        encoding: 'utf8',
        env: {
          ...process.env,
          CONTROLLER_SCRIPT_PATH,
          TEST_WORKSPACE_DIR: workspaceDir,
          TEST_PROMPT_FILE: promptFile,
          TEST_PROMPT_HASH: promptHash,
          TEST_PROFILE_DIR: profileDir,
          TEST_RECEIPT_DIR: receiptDir,
          TEST_WRITABLE_DIR: writableDir,
          TEST_BASELINE_HEAD: newHead,
          TEST_BRANCH: branch,
          TEST_DIRTY_PATH_1: fileA,
          TEST_DIRTY_PATH_2: fileB,
          TEST_DIRTY_SHA_1: hashA,
          TEST_DIRTY_SHA_2: hashB,
          TEST_AGY_PATH: fakeAgyPath
        },
        stdio: ['pipe', 'pipe', 'pipe']
      });
    } catch (err) {
      resMissingExit = err.status || 1;
    }
    assert.notEqual(resMissingExit, 0, 'Missing live dirty path must fail closed');
    assert.equal(fs.existsSync(breadcrumbPath), false);

    fs.writeFileSync(fileB, 'B modified\n', 'utf8');
    const resExtra = runPwshScript([
      '-WorkspaceRoot', workspaceDir,
      '-PromptFile', promptFile,
      '-ExpectedPromptSha256', promptHash,
      '-ProfileRoot', profileDir,
      '-ReceiptRoot', receiptDir,
      '-WritablePaths', writableDir,
      '-ExpectedBaselineHead', newHead,
      '-ExpectedBranch', 'main',
      '-ExpectedTrackedDirtyPaths', fileA,
      '-ExpectedTrackedDirtySha256', hashA,
      '-AgyExecutable', fakeAgyPath
    ]);
    assert.notEqual(resExtra.exitCode, 0, 'Extra live dirty path must fail closed');
    assert.equal(fs.existsSync(breadcrumbPath), false);
  } finally {
    cleanTempDir(workspaceDir);
    cleanTempDir(profileDir);
    cleanTempDir(receiptDir);
    cleanTempDir(fakeAgyDir);
  }
});

test('tracked dirty continuation: expected dirty path outside WritablePaths fails before launch', () => {
  const workspaceDir = createTempDir('agy-ctrl-ws-cont-outscope-');
  const profileDir = createTempDir('agy-ctrl-prof-cont-outscope-');
  const receiptDir = createTempDir('agy-ctrl-rcpt-cont-outscope-');
  const fakeAgyDir = createTempDir('agy-ctrl-fake-cont-outscope-');

  try {
    const { head, branch } = initGitWorkspace(workspaceDir);
    const promptFile = path.join(workspaceDir, 'PROMPT.md');
    fs.writeFileSync(promptFile, 'Prompt\n', 'utf8');
    const promptHash = getSha256('Prompt\n');

    const writableDir = path.join(workspaceDir, 'tooling');
    fs.mkdirSync(writableDir, { recursive: true });

    const rootTrackedFile = path.join(workspaceDir, 'README.md');
    fs.writeFileSync(rootTrackedFile, '# Modified Root Readme\n', 'utf8');
    const dirtyHash = getSha256('# Modified Root Readme\n');

    const { cmdPath: fakeAgyPath, breadcrumbPath } = createFakeAgyScript(fakeAgyDir);

    const res = runPwshScript([
      '-WorkspaceRoot', workspaceDir,
      '-PromptFile', promptFile,
      '-ExpectedPromptSha256', promptHash,
      '-ProfileRoot', profileDir,
      '-ReceiptRoot', receiptDir,
      '-WritablePaths', writableDir,
      '-ExpectedBaselineHead', head,
      '-ExpectedBranch', 'main',
      '-ExpectedTrackedDirtyPaths', rootTrackedFile,
      '-ExpectedTrackedDirtySha256', dirtyHash,
      '-AgyExecutable', fakeAgyPath
    ]);

    assert.notEqual(res.exitCode, 0, 'Dirty file outside WritablePaths must fail before launch');
    assert.equal(fs.existsSync(breadcrumbPath), false);
  } finally {
    cleanTempDir(workspaceDir);
    cleanTempDir(profileDir);
    cleanTempDir(receiptDir);
    cleanTempDir(fakeAgyDir);
  }
});

test('tracked dirty continuation: any staged change fails even with otherwise correct continuation inputs', () => {
  const workspaceDir = createTempDir('agy-ctrl-ws-cont-staged-');
  const profileDir = createTempDir('agy-ctrl-prof-cont-staged-');
  const receiptDir = createTempDir('agy-ctrl-rcpt-cont-staged-');
  const fakeAgyDir = createTempDir('agy-ctrl-fake-cont-staged-');

  try {
    const { branch } = initGitWorkspace(workspaceDir);
    const promptFile = path.join(workspaceDir, 'PROMPT.md');
    fs.writeFileSync(promptFile, 'Prompt\n', 'utf8');
    const promptHash = getSha256('Prompt\n');

    const writableDir = path.join(workspaceDir, 'tooling');
    fs.mkdirSync(writableDir, { recursive: true });

    const trackedFile = path.join(writableDir, 'tracked-file.txt');
    fs.writeFileSync(trackedFile, 'initial content\n', 'utf8');
    execFileSync('git', ['add', trackedFile], { cwd: workspaceDir, stdio: 'ignore' });
    execFileSync('git', ['commit', '-m', 'Add tracked file'], { cwd: workspaceDir, stdio: 'ignore' });
    const newHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: workspaceDir, encoding: 'utf8' }).trim();

    fs.writeFileSync(trackedFile, 'modified content\n', 'utf8');
    const dirtyHash = getSha256('modified content\n');

    execFileSync('git', ['add', trackedFile], { cwd: workspaceDir, stdio: 'ignore' });

    const { cmdPath: fakeAgyPath, breadcrumbPath } = createFakeAgyScript(fakeAgyDir);

    const res = runPwshScript([
      '-WorkspaceRoot', workspaceDir,
      '-PromptFile', promptFile,
      '-ExpectedPromptSha256', promptHash,
      '-ProfileRoot', profileDir,
      '-ReceiptRoot', receiptDir,
      '-WritablePaths', writableDir,
      '-ExpectedBaselineHead', newHead,
      '-ExpectedBranch', 'main',
      '-ExpectedTrackedDirtyPaths', trackedFile,
      '-ExpectedTrackedDirtySha256', dirtyHash,
      '-AgyExecutable', fakeAgyPath
    ]);

    assert.notEqual(res.exitCode, 0, 'Staged change must fail closed even with continuation inputs');
    assert.equal(fs.existsSync(breadcrumbPath), false);
  } finally {
    cleanTempDir(workspaceDir);
    cleanTempDir(profileDir);
    cleanTempDir(receiptDir);
    cleanTempDir(fakeAgyDir);
  }
});

test('tracked dirty continuation: duplicates, count mismatch, invalid hash, missing file, and directory input fail before launch', () => {
  const workspaceDir = createTempDir('agy-ctrl-ws-cont-invalids-');
  const profileDir = createTempDir('agy-ctrl-prof-cont-invalids-');
  const receiptDir = createTempDir('agy-ctrl-rcpt-cont-invalids-');
  const fakeAgyDir = createTempDir('agy-ctrl-fake-cont-invalids-');

  try {
    const { branch } = initGitWorkspace(workspaceDir);
    const promptFile = path.join(workspaceDir, 'PROMPT.md');
    fs.writeFileSync(promptFile, 'Prompt\n', 'utf8');
    const promptHash = getSha256('Prompt\n');

    const writableDir = path.join(workspaceDir, 'tooling');
    fs.mkdirSync(writableDir, { recursive: true });

    const trackedFile = path.join(writableDir, 'tracked-file.txt');
    fs.writeFileSync(trackedFile, 'initial content\n', 'utf8');
    execFileSync('git', ['add', trackedFile], { cwd: workspaceDir, stdio: 'ignore' });
    execFileSync('git', ['commit', '-m', 'Add tracked file'], { cwd: workspaceDir, stdio: 'ignore' });
    const newHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: workspaceDir, encoding: 'utf8' }).trim();

    fs.writeFileSync(trackedFile, 'modified content\n', 'utf8');
    const dirtyHash = getSha256('modified content\n');

    const { cmdPath: fakeAgyPath, breadcrumbPath } = createFakeAgyScript(fakeAgyDir);

    // Case 1: Duplicates
    const psCmdDup = '& $env:CONTROLLER_SCRIPT_PATH -WorkspaceRoot $env:TEST_WORKSPACE_DIR -PromptFile $env:TEST_PROMPT_FILE -ExpectedPromptSha256 $env:TEST_PROMPT_HASH -ProfileRoot $env:TEST_PROFILE_DIR -ReceiptRoot $env:TEST_RECEIPT_DIR -WritablePaths $env:TEST_WRITABLE_DIR -ExpectedBaselineHead $env:TEST_BASELINE_HEAD -ExpectedBranch $env:TEST_BRANCH -ExpectedTrackedDirtyPaths @($env:TEST_DIRTY_PATH_1, $env:TEST_DIRTY_PATH_2) -ExpectedTrackedDirtySha256 @($env:TEST_DIRTY_SHA_1, $env:TEST_DIRTY_SHA_2) -AgyExecutable $env:TEST_AGY_PATH';
    let resDupExit = 0;
    try {
      execFileSync('pwsh', ['-NoProfile', '-Command', psCmdDup], {
        encoding: 'utf8',
        env: {
          ...process.env,
          CONTROLLER_SCRIPT_PATH,
          TEST_WORKSPACE_DIR: workspaceDir,
          TEST_PROMPT_FILE: promptFile,
          TEST_PROMPT_HASH: promptHash,
          TEST_PROFILE_DIR: profileDir,
          TEST_RECEIPT_DIR: receiptDir,
          TEST_WRITABLE_DIR: writableDir,
          TEST_BASELINE_HEAD: newHead,
          TEST_BRANCH: branch,
          TEST_DIRTY_PATH_1: trackedFile,
          TEST_DIRTY_PATH_2: trackedFile,
          TEST_DIRTY_SHA_1: dirtyHash,
          TEST_DIRTY_SHA_2: dirtyHash,
          TEST_AGY_PATH: fakeAgyPath
        },
        stdio: ['pipe', 'pipe', 'pipe']
      });
    } catch (err) {
      resDupExit = err.status || 1;
    }
    assert.notEqual(resDupExit, 0, 'Duplicate dirty paths must fail');
    assert.equal(fs.existsSync(breadcrumbPath), false);

    // Case 2: Count mismatch
    const psCmdCount = '& $env:CONTROLLER_SCRIPT_PATH -WorkspaceRoot $env:TEST_WORKSPACE_DIR -PromptFile $env:TEST_PROMPT_FILE -ExpectedPromptSha256 $env:TEST_PROMPT_HASH -ProfileRoot $env:TEST_PROFILE_DIR -ReceiptRoot $env:TEST_RECEIPT_DIR -WritablePaths $env:TEST_WRITABLE_DIR -ExpectedBaselineHead $env:TEST_BASELINE_HEAD -ExpectedBranch $env:TEST_BRANCH -ExpectedTrackedDirtyPaths $env:TEST_DIRTY_PATH_1 -ExpectedTrackedDirtySha256 @($env:TEST_DIRTY_SHA_1, $env:TEST_DIRTY_SHA_2) -AgyExecutable $env:TEST_AGY_PATH';
    let resCountExit = 0;
    try {
      execFileSync('pwsh', ['-NoProfile', '-Command', psCmdCount], {
        encoding: 'utf8',
        env: {
          ...process.env,
          CONTROLLER_SCRIPT_PATH,
          TEST_WORKSPACE_DIR: workspaceDir,
          TEST_PROMPT_FILE: promptFile,
          TEST_PROMPT_HASH: promptHash,
          TEST_PROFILE_DIR: profileDir,
          TEST_RECEIPT_DIR: receiptDir,
          TEST_WRITABLE_DIR: writableDir,
          TEST_BASELINE_HEAD: newHead,
          TEST_BRANCH: branch,
          TEST_DIRTY_PATH_1: trackedFile,
          TEST_DIRTY_SHA_1: dirtyHash,
          TEST_DIRTY_SHA_2: dirtyHash,
          TEST_AGY_PATH: fakeAgyPath
        },
        stdio: ['pipe', 'pipe', 'pipe']
      });
    } catch (err) {
      resCountExit = err.status || 1;
    }
    assert.notEqual(resCountExit, 0, 'Array count mismatch must fail');
    assert.equal(fs.existsSync(breadcrumbPath), false);

    // Case 3: Invalid hash
    const resHash = runPwshScript([
      '-WorkspaceRoot', workspaceDir,
      '-PromptFile', promptFile,
      '-ExpectedPromptSha256', promptHash,
      '-ProfileRoot', profileDir,
      '-ReceiptRoot', receiptDir,
      '-WritablePaths', writableDir,
      '-ExpectedBaselineHead', newHead,
      '-ExpectedBranch', 'main',
      '-ExpectedTrackedDirtyPaths', [trackedFile],
      '-ExpectedTrackedDirtySha256', ['invalid-sha256'],
      '-AgyExecutable', fakeAgyPath
    ]);
    assert.notEqual(resHash.exitCode, 0, 'Invalid hash syntax must fail');
    assert.equal(fs.existsSync(breadcrumbPath), false);

    // Case 4: Missing file
    const missingFilePath = path.join(writableDir, 'nonexistent-file.txt');
    const resMissing = runPwshScript([
      '-WorkspaceRoot', workspaceDir,
      '-PromptFile', promptFile,
      '-ExpectedPromptSha256', promptHash,
      '-ProfileRoot', profileDir,
      '-ReceiptRoot', receiptDir,
      '-WritablePaths', writableDir,
      '-ExpectedBaselineHead', newHead,
      '-ExpectedBranch', 'main',
      '-ExpectedTrackedDirtyPaths', [missingFilePath],
      '-ExpectedTrackedDirtySha256', [dirtyHash],
      '-AgyExecutable', fakeAgyPath
    ]);
    assert.notEqual(resMissing.exitCode, 0, 'Missing file path must fail');
    assert.equal(fs.existsSync(breadcrumbPath), false);

    // Case 5: Directory input
    const resDir = runPwshScript([
      '-WorkspaceRoot', workspaceDir,
      '-PromptFile', promptFile,
      '-ExpectedPromptSha256', promptHash,
      '-ProfileRoot', profileDir,
      '-ReceiptRoot', receiptDir,
      '-WritablePaths', writableDir,
      '-ExpectedBaselineHead', newHead,
      '-ExpectedBranch', 'main',
      '-ExpectedTrackedDirtyPaths', [writableDir],
      '-ExpectedTrackedDirtySha256', [dirtyHash],
      '-AgyExecutable', fakeAgyPath
    ]);
    assert.notEqual(resDir.exitCode, 0, 'Directory input must fail');
    assert.equal(fs.existsSync(breadcrumbPath), false);
  } finally {
    cleanTempDir(workspaceDir);
    cleanTempDir(profileDir);
    cleanTempDir(receiptDir);
    cleanTempDir(fakeAgyDir);
  }
});

function createMutatorFixture(fakeAgyDir, id) {
  const fixturePath = path.join(fakeAgyDir, `mutator-agy-${id}.cjs`);
  const cmdPath = path.join(fakeAgyDir, `mutator-agy-${id}.cmd`);
  const breadcrumbPath = path.join(fakeAgyDir, `launch_breadcrumb-${id}.json`);

  const fixtureContent = `
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const inheritedCwd = process.cwd();
const args = process.argv.slice(2);

if (args[0] === '--version') {
  process.stdout.write('1.1.8\\n');
  process.exit(0);
}

const expectedRoot = process.env.EXPECTED_MUTATION_ROOT || '';
let canonInherited = '';
let canonExpected = '';
try { canonInherited = fs.realpathSync(inheritedCwd).toLowerCase(); } catch(e){}
try { if (expectedRoot !== '') { canonExpected = fs.realpathSync(expectedRoot).toLowerCase(); } } catch(e){}

const breadcrumb = {
  status: (canonInherited === canonExpected && canonExpected !== '') ? 'MATCH' : 'MISMATCH',
  inheritedCwd,
  expectedRoot,
  canonInherited,
  canonExpected
};
fs.writeFileSync(${JSON.stringify(breadcrumbPath)}, JSON.stringify(breadcrumb), 'utf8');

if (breadcrumb.status !== 'MATCH') {
  process.exit(1);
}

const mutateType = process.env.MUTATE_TYPE;
const cwd = expectedRoot;

// Resolve common git metadata from validated root
const gitCommonDirRaw = execFileSync('git', ['rev-parse', '--git-common-dir'], { cwd, encoding: 'utf8' }).trim();
const absGitCommonDir = path.isAbsolute(gitCommonDirRaw) ? gitCommonDirRaw : path.join(cwd, gitCommonDirRaw);

if (mutateType === 'HEAD') {
  execFileSync('git', ['commit', '--allow-empty', '-m', 'Mutation'], { cwd, stdio: 'ignore' });
} else if (mutateType === 'INDEX') {
  fs.writeFileSync(path.join(cwd, 'staged_file.txt'), 'x', 'utf8');
  execFileSync('git', ['add', path.join(cwd, 'staged_file.txt')], { cwd, stdio: 'ignore' });
} else if (mutateType === 'CONFIG') {
  execFileSync('git', ['config', 'test.fake', '1'], { cwd, stdio: 'ignore' });
} else if (mutateType === 'HOOKS') {
  const hooksDir = path.join(absGitCommonDir, 'hooks');
  if (!fs.existsSync(hooksDir)) fs.mkdirSync(hooksDir, { recursive: true });
  fs.writeFileSync(path.join(hooksDir, 'pre-commit'), 'echo 1', 'utf8');
} else if (mutateType === 'REFS') {
  execFileSync('git', ['branch', 'other-branch'], { cwd, stdio: 'ignore' });
} else if (mutateType === 'CALLER_PROTECTED') {
  const protectedRel = process.env.PROTECTED_REL_PATH;
  if (!protectedRel || path.isAbsolute(protectedRel)) process.exit(1);
  const target = path.resolve(cwd, protectedRel);
  const rel = path.relative(cwd, target);
  if (rel.startsWith('..') || path.isAbsolute(rel)) process.exit(1);

  try { execFileSync('attrib', ['-H', target]); } catch(e){}
  fs.writeFileSync(target, 'mutated\\n', 'utf8');
  try { execFileSync('attrib', ['+H', target]); } catch(e){}

} else if (mutateType === 'ENV_FILE') {
  fs.writeFileSync(path.join(cwd, '.env.local'), 'SECRET=1', 'utf8');
} else if (mutateType === 'RENAME_FILE') {
  const oldPath = path.join(cwd, 'file_to_rename.txt');
  const newPath = path.join(cwd, 'renamed_file.txt');
  fs.renameSync(oldPath, newPath);
  execFileSync('git', ['add', oldPath, newPath], { cwd, stdio: 'ignore' });
}

let logFile = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--log-file' && (i + 1) < args.length) {
    logFile = args[i + 1];
    break;
  }
}
if (logFile) fs.writeFileSync(logFile, 'log\\n', 'utf8');
const streamFile = process.env.FAKE_AGY_STREAM_FILE;
if (streamFile && fs.existsSync(streamFile)) {
  process.stdout.write(fs.readFileSync(streamFile, 'utf8'));
}
process.exit(0);
`;
  fs.writeFileSync(fixturePath, fixtureContent.replace(/\r?\n/g, '\n'), 'utf8');
  const nodeExec = process.execPath;
  const cmdContent = `@echo off\n"${nodeExec}" "${fixturePath}" %*\nexit /b %ERRORLEVEL%\n`;
  fs.writeFileSync(cmdPath, cmdContent.replace(/\r?\n/g, '\n'), 'utf8');

  return { fixturePath, cmdPath, breadcrumbPath };
}

const mutations = [
  { type: 'HEAD', reason: 'MISMATCH_HEAD' },
  { type: 'INDEX', reason: 'STAGED_CHANGES' },
  { type: 'CONFIG', reason: 'MODIFIED_PREFLIGHT_FILE' },
  { type: 'HOOKS', reason: 'NEW_PROTECTED_FILE' },
  { type: 'REFS', reason: 'MODIFIED_PREFLIGHT_FILE' },
  { type: 'CALLER_PROTECTED', reason: 'MODIFIED_PREFLIGHT_FILE' },
  { type: 'ENV_FILE', reason: 'NEW_PROTECTED_FILE' },
  { type: 'RENAME_FILE', reason: 'MODIFIED_PREFLIGHT_FILE' }
];

for (const { type, reason } of mutations) {
  test(`linked worktree postflight detection proves failure on mutation: ${type}`, () => {
    const profileDir = createTempDir(`agy-ctrl-prof-wt-${type}-`);
    const receiptDir = createTempDir(`agy-ctrl-rcpt-wt-${type}-`);
    const fakeAgyDir = createTempDir(`agy-ctrl-fake-wt-${type}-`);
    const runMain = createTempDir(`agy-main-run-${type}-`);
    const runWt = createTempDir(`agy-wt-run-${type}-`);

    try {
      initGitWorkspace(runMain);
      fs.writeFileSync(path.join(runMain, 'file_to_rename.txt'), 'old', 'utf8');
      execFileSync('git', ['add', 'file_to_rename.txt'], { cwd: runMain, stdio: 'ignore' });
      execFileSync('git', ['commit', '-m', 'Add file_to_rename'], { cwd: runMain, stdio: 'ignore' });
      fs.rmSync(runWt, { recursive: true, force: true });
      execFileSync('git', ['worktree', 'add', runWt, '-b', 'wt-branch'], { cwd: runMain, stdio: 'ignore' });
      execFileSync('git', ['config', 'user.name', 'AGY Test Worker'], { cwd: runWt, stdio: 'ignore' });
      execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: runWt, stdio: 'ignore' });

      const currentHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: runWt, encoding: 'utf8' }).trim();
      const promptContent = 'Test linked worktree\n';
      const currentPromptFile = path.join(runWt, 'PROMPT.md');
      fs.writeFileSync(currentPromptFile, promptContent, 'utf8');
      const promptHash = getSha256(promptContent);

      const currentWritable = path.join(runWt, 'tooling');
      fs.mkdirSync(currentWritable, { recursive: true });
      const currentCallerProt = path.join(runWt, 'SECRET.txt');
      fs.writeFileSync(currentCallerProt, 'shh\n', 'utf8');

      const id = Math.random().toString(36).substring(2);
      const { cmdPath, breadcrumbPath } = createMutatorFixture(fakeAgyDir, id);
      const runValidStreamPath = createValidStreamFile(fakeAgyDir, runWt);

      const res = runPwshScript([
        '-WorkspaceRoot', runWt,
        '-PromptFile', currentPromptFile,
        '-ExpectedPromptSha256', promptHash,
        '-ProfileRoot', profileDir,
        '-ReceiptRoot', receiptDir,
        '-WritablePaths', currentWritable,
        '-ProtectedPaths', currentCallerProt,
        '-ExpectedBaselineHead', currentHead,
        '-ExpectedBranch', 'wt-branch',
        '-AgyExecutable', cmdPath
      ], {
        FAKE_AGY_STREAM_FILE: runValidStreamPath,
        MUTATE_TYPE: type,
        EXPECTED_MUTATION_ROOT: runWt,
        PROTECTED_REL_PATH: 'SECRET.txt'
      });

      assert.notEqual(res.exitCode, 0, `Mutation ${type} must fail closed`);
      assert.ok(fs.existsSync(breadcrumbPath), `Worker launched for ${type}`);

      const bc = JSON.parse(fs.readFileSync(breadcrumbPath, 'utf8'));
      assert.equal(bc.status, 'MATCH', 'Root guard failed unexpectedly on valid root');
      assert.equal(bc.canonExpected, fs.realpathSync(runWt).toLowerCase(), 'Breadcrumb canonical expected root must match actual worktree root');

      const authJsonPath = path.join(receiptDir, 'POSTFLIGHT_WORKSPACE_AUTHORITY.json');
      assert.ok(fs.existsSync(authJsonPath), `POSTFLIGHT_WORKSPACE_AUTHORITY.json missing for ${type}. Stderr: ${res.stderr}`);
      const auth = JSON.parse(fs.readFileSync(authJsonPath, 'utf8'));
      assert.notEqual(auth.status, 'MATCH', `Status must not be MATCH for ${type}`);
      assert.ok(auth.reason_codes.includes(reason), `Reason codes must include ${reason} for ${type}, got: ${auth.reason_codes.join(', ')}`);
      if (type === 'RENAME_FILE') {
        assert.ok(!auth.reason_codes.includes('STAGED_CHANGES'), 'RENAME_FILE must not contain STAGED_CHANGES reason code');
      }

    } finally {
      cleanTempDir(runMain);
      cleanTempDir(runWt);
      cleanTempDir(profileDir);
      cleanTempDir(receiptDir);
      cleanTempDir(fakeAgyDir);
    }
  });
}

test('root guard direct negative tests: missing, mismatched, sibling prefix, and traversal fail closed safely', () => {
  const fakeAgyDir = createTempDir('agy-rootguard-fake-');
  const baseDir = createTempDir('agy-rootguard-base-');
  const otherDir = path.join(baseDir, 'root-other');
  const ambientDir = path.join(baseDir, 'root');

  try {
    fs.mkdirSync(otherDir, { recursive: true });
    fs.mkdirSync(ambientDir, { recursive: true });

    const id = Math.random().toString(36).substring(2);
    const { fixturePath, breadcrumbPath } = createMutatorFixture(fakeAgyDir, id);

    // Case 1: Missing root
    if (fs.existsSync(breadcrumbPath)) fs.unlinkSync(breadcrumbPath);
    let exitCodeMissing = 0;
    try {
      execFileSync(process.execPath, [fixturePath], {
        cwd: ambientDir,
        env: { ...process.env, EXPECTED_MUTATION_ROOT: '' },
        stdio: 'pipe'
      });
    } catch (e) { exitCodeMissing = e.status; }
    assert.equal(exitCodeMissing, 1, 'Missing root must exit 1');
    const bcMissing = JSON.parse(fs.readFileSync(breadcrumbPath, 'utf8'));
    assert.equal(bcMissing.status, 'MISMATCH');

    // Case 2: Mismatched root
    if (fs.existsSync(breadcrumbPath)) fs.unlinkSync(breadcrumbPath);
    let exitCodeMismatch = 0;
    try {
      execFileSync(process.execPath, [fixturePath], {
        cwd: ambientDir,
        env: { ...process.env, EXPECTED_MUTATION_ROOT: otherDir },
        stdio: 'pipe'
      });
    } catch (e) { exitCodeMismatch = e.status; }
    assert.equal(exitCodeMismatch, 1, 'Mismatched root must exit 1');
    const bcMismatch = JSON.parse(fs.readFileSync(breadcrumbPath, 'utf8'));
    assert.equal(bcMismatch.status, 'MISMATCH');

    // Case 3: Absolute protected path traversal
    if (fs.existsSync(breadcrumbPath)) fs.unlinkSync(breadcrumbPath);
    let exitCodeAbs = 0;
    try {
      execFileSync(process.execPath, [fixturePath], {
        cwd: ambientDir,
        env: { ...process.env, EXPECTED_MUTATION_ROOT: ambientDir, MUTATE_TYPE: 'CALLER_PROTECTED', PROTECTED_REL_PATH: path.resolve(ambientDir, '..', 'evil.txt') },
        stdio: 'pipe'
      });
    } catch (e) { exitCodeAbs = e.status; }
    assert.equal(exitCodeAbs, 1, 'Absolute protected path must exit 1');

    // Case 4: Sibling prefix / traversal
    if (fs.existsSync(breadcrumbPath)) fs.unlinkSync(breadcrumbPath);
    let exitCodeTrav = 0;
    try {
      execFileSync(process.execPath, [fixturePath], {
        cwd: ambientDir,
        env: { ...process.env, EXPECTED_MUTATION_ROOT: ambientDir, MUTATE_TYPE: 'CALLER_PROTECTED', PROTECTED_REL_PATH: '../root-other/evil.txt' },
        stdio: 'pipe'
      });
    } catch (e) { exitCodeTrav = e.status; }
    assert.equal(exitCodeTrav, 1, 'Traversal protected path must exit 1');
    assert.equal(fs.existsSync(path.join(otherDir, 'evil.txt')), false, 'Traversal must not mutate sibling directory');

  } finally {
    cleanTempDir(fakeAgyDir);
    cleanTempDir(baseDir);
  }
});

test('Get-GitCriticalSnapshot hashes directories correctly while excluding node_modules and .git', () => {
  const workspaceDir = createTempDir('agy-snapshot-ws-');
  const profileDir = createTempDir('agy-snapshot-prof-');
  const receiptDir = createTempDir('agy-snapshot-rcpt-');
  const fakeAgyDir = createTempDir('agy-snapshot-fake-');

  try {
    initGitWorkspace(workspaceDir);
    const headHash = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: workspaceDir, encoding: 'utf8' }).trim();

    const promptFile = path.join(workspaceDir, 'PROMPT.md');
    fs.writeFileSync(promptFile, 'Test snapshot\\n', 'utf8');
    const promptHash = getSha256('Test snapshot\\n');

    const writableDir = path.join(workspaceDir, 'tooling');
    fs.mkdirSync(writableDir, { recursive: true });

    const protectedDir = path.join(workspaceDir, 'protected_dir');
    fs.mkdirSync(protectedDir, { recursive: true });

    const file1 = path.join(protectedDir, 'file1.txt');
    fs.writeFileSync(file1, 'content1\\n', 'utf8');
    const file2 = path.join(protectedDir, 'sub', 'file2.txt');
    fs.mkdirSync(path.join(protectedDir, 'sub'), { recursive: true });
    fs.writeFileSync(file2, 'content2\\n', 'utf8');

    // These should be excluded
    const nodeModulesDir = path.join(protectedDir, 'node_modules', 'pkg');
    fs.mkdirSync(nodeModulesDir, { recursive: true });
    fs.writeFileSync(path.join(nodeModulesDir, 'bad.txt'), 'bad\\n', 'utf8');

    const gitDir = path.join(protectedDir, '.git', 'objects');
    fs.mkdirSync(gitDir, { recursive: true });
    fs.writeFileSync(path.join(gitDir, 'bad.txt'), 'bad\\n', 'utf8');

    const id = Math.random().toString(36).substring(2);
    const { cmdPath } = createMutatorFixture(fakeAgyDir, id);
    const validStreamPath = createValidStreamFile(fakeAgyDir, workspaceDir);

    const res = runPwshScript([
      '-WorkspaceRoot', workspaceDir,
      '-PromptFile', promptFile,
      '-ExpectedPromptSha256', promptHash,
      '-ProfileRoot', profileDir,
      '-ReceiptRoot', receiptDir,
      '-WritablePaths', writableDir,
      '-ProtectedPaths', protectedDir,
      '-ExpectedBaselineHead', headHash,
      '-ExpectedBranch', 'main',
      '-AgyExecutable', cmdPath
    ], {
      FAKE_AGY_STREAM_FILE: validStreamPath,
      MUTATE_TYPE: 'NONE',
      EXPECTED_MUTATION_ROOT: workspaceDir
    });

    assert.equal(res.exitCode, 0, 'Should launch successfully');

    const postflightPath = path.join(receiptDir, 'POSTFLIGHT_WORKSPACE_AUTHORITY.json');
    assert.ok(fs.existsSync(postflightPath), 'Postflight receipt must exist');
    const postflight = JSON.parse(fs.readFileSync(postflightPath, 'utf8'));

    const keys = Object.keys(postflight.critical_path_hashes_post);
    assert.ok(keys.includes(file1), 'Snapshot must include file1.txt');
    assert.ok(keys.includes(file2), 'Snapshot must include file2.txt');

    const excludedBad = keys.find(k => k.includes('node_modules') || k.includes('.git\\\\objects') || k.includes('.git/objects'));
    assert.ok(!excludedBad, 'Snapshot must not include node_modules or .git files');

    assert.equal(postflight.command_exit_codes['post_rev_parse_head'], 0, 'post_rev_parse_head must be 0');

  } finally {
    cleanTempDir(workspaceDir);
    cleanTempDir(profileDir);
    cleanTempDir(receiptDir);
    cleanTempDir(fakeAgyDir);
  }
});

test('Preflight critical Git exits fail closed (show-ref)', () => {
  const workspaceDir = createTempDir('agy-preflight-ws-');
  const profileDir = createTempDir('agy-preflight-prof-');
  const receiptDir = createTempDir('agy-preflight-rcpt-');
  const fakeAgyDir = createTempDir('agy-preflight-fake-');
  const fakeGitDir = createTempDir('agy-fake-git-');

  try {
    initGitWorkspace(workspaceDir);
    const headHash = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: workspaceDir, encoding: 'utf8' }).trim();
    const promptFile = path.join(workspaceDir, 'PROMPT.md');
    fs.writeFileSync(promptFile, 'Test preflight\n', 'utf8');
    const promptHash = getSha256('Test preflight\n');
    const writableDir = path.join(workspaceDir, 'tooling');
    fs.mkdirSync(writableDir, { recursive: true });

    // Create a fake git that fails on show-ref
    const isWindows = process.platform === 'win32';
    const whereCmd = isWindows ? 'where' : 'which';
    const realGitExe = execFileSync(whereCmd, ['git'], { encoding: 'utf8' }).split('\n')[0].trim();
    const breadcrumbPathGit = path.join(fakeGitDir, 'git-calls.txt');
    fs.writeFileSync(breadcrumbPathGit, '', 'utf8');

    const fakeGitScript = `
      const fs = require('fs');
      const args = process.argv.slice(2);
      fs.appendFileSync(${JSON.stringify(breadcrumbPathGit)}, args.join(' ') + '\\n');
      if (args[0] === 'show-ref') {
        console.error('fatal: No match');
        process.exit(1);
      }
      const { execFileSync } = require('child_process');
      try {
        execFileSync(${JSON.stringify(realGitExe)}, args, { stdio: 'inherit' });
      } catch (e) {
        process.exit(e.status || 1);
      }
    `;
    fs.writeFileSync(path.join(fakeGitDir, 'git.js'), fakeGitScript, 'utf8');
    const nodeExec = process.execPath;
    fs.writeFileSync(path.join(fakeGitDir, 'git.cmd'), `@echo off\n"${nodeExec}" "${path.join(fakeGitDir, 'git.js')}" %*\nexit /b %ERRORLEVEL%\n`, 'utf8');

    const id = Math.random().toString(36).substring(2);
    const { cmdPath, breadcrumbPath } = createMutatorFixture(fakeAgyDir, id);
    const validStreamPath = createValidStreamFile(fakeAgyDir, workspaceDir);

    const env = { ...process.env, PATH: `${fakeGitDir};${process.env.PATH}`, FAKE_AGY_STREAM_FILE: validStreamPath, MUTATE_TYPE: 'NONE', EXPECTED_MUTATION_ROOT: workspaceDir };

    let res = null;
    try {
      res = execFileSync('pwsh', [
        '-NoProfile', '-NonInteractive', '-File',
        path.join(process.cwd(), 'tooling', 'agy', 'Invoke-AgyAutonomousWorker.ps1'),
        '-WorkspaceRoot', workspaceDir,
        '-PromptFile', promptFile,
        '-ExpectedPromptSha256', promptHash,
        '-ProfileRoot', profileDir,
        '-ReceiptRoot', receiptDir,
        '-WritablePaths', writableDir,
        '-ProtectedPaths', workspaceDir,
        '-ExpectedBaselineHead', headHash,
        '-ExpectedBranch', 'main',
        '-AgyExecutable', cmdPath
      ], { env, encoding: 'utf8', stdio: 'pipe' });
    } catch (e) {
      res = e;
    }

    assert.notEqual(res.status || res.exitCode, 0, 'Preflight git show-ref failure must fail closed');
    assert.ok(res.stderr.includes('git show-ref failed'), 'Error message must mention git show-ref failed');

    const gitCalls = fs.readFileSync(breadcrumbPathGit, 'utf8');
    assert.ok(gitCalls.includes('show-ref'), 'Fake git must have intercepted show-ref');

    // Confirm AGY worker was never launched by checking if breadcrumbPath exists
    assert.ok(!fs.existsSync(breadcrumbPath), 'AGY worker mutator breadcrumb must not exist if preflight fails');

  } finally {
    cleanTempDir(workspaceDir);
    cleanTempDir(profileDir);
    cleanTempDir(receiptDir);
    cleanTempDir(fakeAgyDir);
    cleanTempDir(fakeGitDir);
  }
});

function setupLimitsTest(name) {
  const ws = createTempDir(name + '-ws-');
  const prof = createTempDir(name + '-prof-');
  const rcpt = createTempDir(name + '-rcpt-');
  const fake = createTempDir(name + '-fake-');
  initGitWorkspace(ws);
  const headHash = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ws, encoding: 'utf8' }).trim();
  const promptFile = path.join(ws, 'PROMPT.md');
  fs.writeFileSync(promptFile, 'Test limits\n', 'utf8');
  const promptHash = getSha256('Test limits\n');
  const writableDir = path.join(ws, 'tooling');
  fs.mkdirSync(writableDir, { recursive: true });
  return { ws, prof, rcpt, fake, headHash, promptFile, promptHash, writableDir };
}

test('Snapshot limits fail closed (depth limit)', () => {
  const { ws, prof, rcpt, fake, headHash, promptFile, promptHash, writableDir } = setupLimitsTest('agy-depth');
  try {
    const deepDir = path.join(ws, 'deep');
    let currDeep = deepDir;
    for (let i = 0; i <= 11; i++) {
        fs.mkdirSync(currDeep, { recursive: true });
        currDeep = path.join(currDeep, `sub${i}`);
    }

    const id1 = Math.random().toString(36).substring(2);
    const { cmdPath: cmdPath1 } = createMutatorFixture(fake, id1);
    const validStreamPath = createValidStreamFile(fake, ws);

    const resDepth = runPwshScript([
      '-WorkspaceRoot', ws,
      '-PromptFile', promptFile,
      '-ExpectedPromptSha256', promptHash,
      '-ProfileRoot', prof,
      '-ReceiptRoot', rcpt,
      '-WritablePaths', writableDir,
      '-ProtectedPaths', deepDir,
      '-ExpectedBaselineHead', headHash,
      '-ExpectedBranch', 'main',
      '-AgyExecutable', cmdPath1
    ], { FAKE_AGY_STREAM_FILE: validStreamPath, MUTATE_TYPE: 'NONE', EXPECTED_MUTATION_ROOT: ws });

    assert.notEqual(resDepth.exitCode, 0, 'Must fail closed on depth limit');
    assert.ok(resDepth.stderr.includes('exceeds maximum depth'), 'Error message must mention maximum depth');
  } finally {
    cleanTempDir(ws); cleanTempDir(prof); cleanTempDir(rcpt); cleanTempDir(fake);
  }
});

test('Snapshot limits fail closed (size limit)', () => {
  const { ws, prof, rcpt, fake, headHash, promptFile, promptHash, writableDir } = setupLimitsTest('agy-size');
  try {
    const sizeDir = path.join(ws, 'size');
    fs.mkdirSync(sizeDir, { recursive: true });
    const buf = Buffer.alloc(11 * 1024 * 1024, 'a');
    fs.writeFileSync(path.join(sizeDir, 'big.txt'), buf);

    const id2 = Math.random().toString(36).substring(2);
    const { cmdPath: cmdPath2 } = createMutatorFixture(fake, id2);
    const validStreamPath = createValidStreamFile(fake, ws);

    const resSize = runPwshScript([
      '-WorkspaceRoot', ws,
      '-PromptFile', promptFile,
      '-ExpectedPromptSha256', promptHash,
      '-ProfileRoot', prof,
      '-ReceiptRoot', rcpt,
      '-WritablePaths', writableDir,
      '-ProtectedPaths', sizeDir,
      '-ExpectedBaselineHead', headHash,
      '-ExpectedBranch', 'main',
      '-AgyExecutable', cmdPath2
    ], { FAKE_AGY_STREAM_FILE: validStreamPath, MUTATE_TYPE: 'NONE', EXPECTED_MUTATION_ROOT: ws });

    assert.notEqual(resSize.exitCode, 0, 'Must fail closed on size limit');
    assert.ok(resSize.stderr.includes('exceeded maximum cumulative size'), 'Error message must mention maximum cumulative size');
  } finally {
    cleanTempDir(ws); cleanTempDir(prof); cleanTempDir(rcpt); cleanTempDir(fake);
  }
});

test('Snapshot limits fail closed (file count limit)', () => {
  const { ws, prof, rcpt, fake, headHash, promptFile, promptHash, writableDir } = setupLimitsTest('agy-filecnt');
  try {
    const fileCountDir = path.join(ws, 'filecount');
    fs.mkdirSync(fileCountDir, { recursive: true });
    for (let i = 0; i <= 1000; i++) {
        fs.writeFileSync(path.join(fileCountDir, `f${i}.txt`), 'a', 'utf8');
    }

    const id = Math.random().toString(36).substring(2);
    const { cmdPath } = createMutatorFixture(fake, id);
    const validStreamPath = createValidStreamFile(fake, ws);

    const res = runPwshScript([
      '-WorkspaceRoot', ws, '-PromptFile', promptFile, '-ExpectedPromptSha256', promptHash,
      '-ProfileRoot', prof, '-ReceiptRoot', rcpt, '-WritablePaths', writableDir,
      '-ProtectedPaths', fileCountDir, '-ExpectedBaselineHead', headHash, '-ExpectedBranch', 'main',
      '-AgyExecutable', cmdPath
    ], { FAKE_AGY_STREAM_FILE: validStreamPath, MUTATE_TYPE: 'NONE', EXPECTED_MUTATION_ROOT: ws });

    assert.notEqual(res.exitCode, 0, 'Must fail closed');
    assert.ok(res.stderr.includes('exceeds 1000 file limit'), 'Error message must mention file limit');
  } finally {
    cleanTempDir(ws); cleanTempDir(prof); cleanTempDir(rcpt); cleanTempDir(fake);
  }
});

test('Snapshot limits fail closed (directory queue limit)', () => {
  const { ws, prof, rcpt, fake, headHash, promptFile, promptHash, writableDir } = setupLimitsTest('agy-queue');
  try {
    const queueDir = path.join(ws, 'queue');
    fs.mkdirSync(queueDir, { recursive: true });
    for (let i = 0; i <= 1000; i++) {
        fs.mkdirSync(path.join(queueDir, `q${i}`), { recursive: true });
    }

    const id = Math.random().toString(36).substring(2);
    const { cmdPath } = createMutatorFixture(fake, id);
    const validStreamPath = createValidStreamFile(fake, ws);

    const res = runPwshScript([
      '-WorkspaceRoot', ws, '-PromptFile', promptFile, '-ExpectedPromptSha256', promptHash,
      '-ProfileRoot', prof, '-ReceiptRoot', rcpt, '-WritablePaths', writableDir,
      '-ProtectedPaths', queueDir, '-ExpectedBaselineHead', headHash, '-ExpectedBranch', 'main',
      '-AgyExecutable', cmdPath
    ], { FAKE_AGY_STREAM_FILE: validStreamPath, MUTATE_TYPE: 'NONE', EXPECTED_MUTATION_ROOT: ws });

    assert.notEqual(res.exitCode, 0, 'Must fail closed');
    assert.ok(res.stderr.includes('exceeds maximum directory queue entries'), 'Error message must mention queue limit');
  } finally {
    cleanTempDir(ws); cleanTempDir(prof); cleanTempDir(rcpt); cleanTempDir(fake);
  }
});

test('Snapshot limits fail closed (reparse hidden child)', (t) => {
  const { ws, prof, rcpt, fake, headHash, promptFile, promptHash, writableDir } = setupLimitsTest('agy-reparse-child');
  try {
    const targetDir = path.join(ws, 'target');
    fs.mkdirSync(targetDir, { recursive: true });
    const reparseDir = path.join(ws, 'reparse');
    fs.mkdirSync(reparseDir, { recursive: true });

    let canHide = true;
    try {
        const junc = path.join(reparseDir, 'sym');
        fs.symlinkSync(targetDir, junc, 'junction');
        execFileSync('attrib', ['+H', junc], { encoding: 'utf8' });
        const attrs = execFileSync('attrib', [junc], { encoding: 'utf8' });
        if (!attrs.includes('H')) {
            canHide = false;
        }
    } catch(e) {
        canHide = false;
    }

    if (!canHide) {
        t.skip('Skipping reparse test due to lack of symlink or hidden attribute privilege');
        return;
    }

    const id = Math.random().toString(36).substring(2);
    const { cmdPath } = createMutatorFixture(fake, id);
    const validStreamPath = createValidStreamFile(fake, ws);
    const res = runPwshScript([
      '-WorkspaceRoot', ws, '-PromptFile', promptFile, '-ExpectedPromptSha256', promptHash,
      '-ProfileRoot', prof, '-ReceiptRoot', rcpt, '-WritablePaths', writableDir,
      '-ProtectedPaths', reparseDir, '-ExpectedBaselineHead', headHash, '-ExpectedBranch', 'main',
      '-AgyExecutable', cmdPath
    ], { FAKE_AGY_STREAM_FILE: validStreamPath, MUTATE_TYPE: 'NONE', EXPECTED_MUTATION_ROOT: ws });

    assert.notEqual(res.exitCode, 0, 'Must fail on child reparse');
    assert.ok(res.stderr.includes('Reparse point encountered'), 'Error message must mention Reparse point');
  } finally {
    cleanTempDir(ws); cleanTempDir(prof); cleanTempDir(rcpt); cleanTempDir(fake);
  }
});

test('Snapshot limits fail closed (reparse root)', (t) => {
  const { ws, prof, rcpt, fake, headHash, promptFile, promptHash, writableDir } = setupLimitsTest('agy-reparse-root');
  try {
    const targetDir = path.join(ws, 'target');
    fs.mkdirSync(targetDir, { recursive: true });
    const rootJunction = path.join(ws, 'root_junc');

    let supportsSymlink = true;
    try {
        fs.symlinkSync(targetDir, rootJunction, 'junction');
    } catch(e) {
        supportsSymlink = false;
    }

    if (!supportsSymlink) {
        t.skip('Skipping reparse root test due to lack of symlink privilege');
        return;
    }

    const id2 = Math.random().toString(36).substring(2);
    const { cmdPath: cmdPath2 } = createMutatorFixture(fake, id2);
    const validStreamPath2 = createValidStreamFile(fake, ws);
    const res2 = runPwshScript([
      '-WorkspaceRoot', ws, '-PromptFile', promptFile, '-ExpectedPromptSha256', promptHash,
      '-ProfileRoot', prof, '-ReceiptRoot', rcpt, '-WritablePaths', writableDir,
      '-ProtectedPaths', rootJunction, '-ExpectedBaselineHead', headHash, '-ExpectedBranch', 'main',
      '-AgyExecutable', cmdPath2
    ], { FAKE_AGY_STREAM_FILE: validStreamPath2, MUTATE_TYPE: 'NONE', EXPECTED_MUTATION_ROOT: ws });

    assert.notEqual(res2.exitCode, 0, 'Must fail on root reparse');
    assert.ok(res2.stderr.toLowerCase().includes('reparse point'), 'Error message must mention Reparse point');
  } finally {
    cleanTempDir(ws); cleanTempDir(prof); cleanTempDir(rcpt); cleanTempDir(fake);
  }
});

test('Snapshot limits fail closed (hidden file mutation)', (t) => {
  const { ws, prof, rcpt, fake, headHash, promptFile, promptHash, writableDir } = setupLimitsTest('agy-hidden');
  try {
    const hiddenDir = path.join(ws, 'hidden');
    fs.mkdirSync(hiddenDir, { recursive: true });
    const hiddenFilePath = path.join(hiddenDir, '.hidden_file');
    fs.writeFileSync(hiddenFilePath, 'hidden', 'utf8');

    let canHide = true;
    try {
        execFileSync('attrib', ['+H', hiddenFilePath], { encoding: 'utf8' });
        const attrs = execFileSync('attrib', [hiddenFilePath], { encoding: 'utf8' });
        // The output of attrib typically starts with the attributes, e.g., "A  SH... " or "    H   ..."
        if (!attrs.includes('H')) {
            canHide = false;
        }
    } catch(e) {
        canHide = false;
    }

    if (!canHide) {
        t.skip('Platform cannot represent true hidden file attribute');
        return;
    }

    const idHidden = Math.random().toString(36).substring(2);
    const { cmdPath: cmdPathHidden } = createMutatorFixture(fake, idHidden);
    const validStreamPathHidden = createValidStreamFile(fake, ws);

    // Test mutation of hidden file.
    const envHidden = {
        ...process.env,
        FAKE_AGY_STREAM_FILE: validStreamPathHidden,
        MUTATE_TYPE: 'CALLER_PROTECTED',
        PROTECTED_REL_PATH: 'hidden/.hidden_file',
        EXPECTED_MUTATION_ROOT: ws
    };

    let resHidden = runPwshScript([
        '-WorkspaceRoot', ws,
        '-PromptFile', promptFile,
        '-ExpectedPromptSha256', promptHash,
        '-ProfileRoot', prof,
        '-ReceiptRoot', rcpt,
        '-WritablePaths', writableDir,
        '-ProtectedPaths', hiddenDir,
        '-ExpectedBaselineHead', headHash,
        '-ExpectedBranch', 'main',
        '-AgyExecutable', cmdPathHidden
    ], envHidden);
    assert.notEqual(resHidden.exitCode, 0, 'Mutating hidden protected file must fail'); console.log('STDERR:\n' + resHidden.stderr);

    const mutContent = fs.readFileSync(hiddenFilePath, 'utf8');
    assert.ok(mutContent.includes('mutated'), 'File must be physically mutated to trigger detection');
  } finally {
    cleanTempDir(ws); cleanTempDir(prof); cleanTempDir(rcpt); cleanTempDir(fake);
  }
});

test('Snapshot limits skip pruned directories (.git and node_modules)', () => {
  const { ws, prof, rcpt, fake, headHash, promptFile, promptHash, writableDir } = setupLimitsTest('agy-prune');
  try {
    const pruneDir = path.join(ws, 'prune');
    const gitDir = path.join(pruneDir, '.git');
    const nmDir = path.join(pruneDir, 'node_modules');
    fs.mkdirSync(gitDir, { recursive: true });
    fs.mkdirSync(nmDir, { recursive: true });

    // Create depth 12 inside pruned dirs (beyond depth limit of 10)
    let currGit = gitDir;
    let currNm = nmDir;
    for (let i = 0; i <= 12; i++) {
        fs.mkdirSync(path.join(currGit, `sub${i}`), { recursive: true });
        currGit = path.join(currGit, `sub${i}`);
        fs.mkdirSync(path.join(currNm, `sub${i}`), { recursive: true });
        currNm = path.join(currNm, `sub${i}`);
    }

    const idPrune = Math.random().toString(36).substring(2);
    const { cmdPath } = createMutatorFixture(fake, idPrune);
    const validStreamPath = createValidStreamFile(fake, ws);
    const resPrune = runPwshScript([
        '-WorkspaceRoot', ws, '-PromptFile', promptFile, '-ExpectedPromptSha256', promptHash,
        '-ProfileRoot', prof, '-ReceiptRoot', rcpt, '-WritablePaths', writableDir,
        '-ProtectedPaths', pruneDir, '-ExpectedBaselineHead', headHash, '-ExpectedBranch', 'main',
        '-AgyExecutable', cmdPath
    ], { FAKE_AGY_STREAM_FILE: validStreamPath, MUTATE_TYPE: 'NONE', EXPECTED_MUTATION_ROOT: ws });

    if (resPrune.exitCode !== 0) { console.error('STDERR:', resPrune.stderr); console.error('STDOUT:', resPrune.stdout); }
    assert.equal(resPrune.exitCode, 0, 'Must succeed because .git and node_modules are pruned and not traversed');
  } finally {
    cleanTempDir(ws); cleanTempDir(prof); cleanTempDir(rcpt); cleanTempDir(fake);
  }
});

test('Snapshot deterministic order and overlap deduplication', () => {
  const { ws, prof, rcpt, fake, headHash, writableDir } = setupLimitsTest('agy-overlap');
  try {
    const overlapDir = path.join(ws, 'overlap');
    fs.mkdirSync(overlapDir, { recursive: true });
    for(let i=0; i<5; i++) {
        fs.writeFileSync(path.join(overlapDir, `f${i}.txt`), `file ${i}`, 'utf8');
    }
    const promptFile = path.join(overlapDir, 'PROMPT.md');
    fs.writeFileSync(promptFile, 'Test limits\n', 'utf8');
    const promptHash = getSha256('Test limits\n');

    const id = Math.random().toString(36).substring(2);
    const { cmdPath } = createMutatorFixture(fake, id);
    const validStreamPath = createValidStreamFile(fake, ws);

    const res = runPwshScript([
        '-WorkspaceRoot', ws, '-PromptFile', promptFile, '-ExpectedPromptSha256', promptHash,
        '-ProfileRoot', prof, '-ReceiptRoot', rcpt, '-WritablePaths', writableDir,
        '-ProtectedPaths', overlapDir, '-ExpectedBaselineHead', headHash, '-ExpectedBranch', 'main',
        '-AgyExecutable', cmdPath
    ], { FAKE_AGY_STREAM_FILE: validStreamPath, MUTATE_TYPE: 'NONE', EXPECTED_MUTATION_ROOT: ws });

    assert.equal(res.exitCode, 0, 'Must succeed with duplicate overlapping paths');

    const authPath = path.join(rcpt, 'POSTFLIGHT_WORKSPACE_AUTHORITY.json');
    const authJson = JSON.parse(fs.readFileSync(authPath, 'utf8'));
    const preSnapshot = authJson.critical_path_hashes_pre;

    const overlapFiles = Object.keys(preSnapshot).filter(k => k.toLowerCase().startsWith(overlapDir.toLowerCase() + path.sep));
    assert.equal(overlapFiles.length, 6, 'Overlapping paths must be deduplicated exactly (5 files + PROMPT.md)');
    const relativePaths = overlapFiles.map(k => k.substring(overlapDir.length + 1)).sort();
    assert.deepEqual(relativePaths, ['PROMPT.md', 'f0.txt', 'f1.txt', 'f2.txt', 'f3.txt', 'f4.txt'], 'Must contain exactly the 6 expected files each once');
    const keys = Object.keys(preSnapshot);
    const sortedKeys = [...keys].sort((a,b) => {
      const uA = a.toUpperCase();
      const uB = b.toUpperCase();
      return uA < uB ? -1 : (uA > uB ? 1 : 0);
    });
    assert.deepEqual(keys, sortedKeys, 'Snapshot keys must be deterministically sorted by upper-case code units');
  } finally {
    cleanTempDir(ws); cleanTempDir(prof); cleanTempDir(rcpt); cleanTempDir(fake);
  }
});

test('Snapshot local counter leakage (valid large tree passes preflight and postflight)', () => {
  const { ws, prof, rcpt, fake, headHash, promptFile, promptHash, writableDir } = setupLimitsTest('agy-leak');
  try {
    const validDir = path.join(ws, 'valid');
    fs.mkdirSync(validDir, { recursive: true });
    // Near limit (e.g. 600 files). If it leaked, preflight + postflight = 1200 > 1000 limit.
    for(let i=0; i<600; i++) {
        fs.writeFileSync(path.join(validDir, `v${i}.txt`), 'v', 'utf8');
    }

    const id = Math.random().toString(36).substring(2);
    const { cmdPath } = createMutatorFixture(fake, id);
    const validStreamPath = createValidStreamFile(fake, ws);

    const res = runPwshScript([
        '-WorkspaceRoot', ws, '-PromptFile', promptFile, '-ExpectedPromptSha256', promptHash,
        '-ProfileRoot', prof, '-ReceiptRoot', rcpt, '-WritablePaths', writableDir,
        '-ProtectedPaths', validDir, '-ExpectedBaselineHead', headHash, '-ExpectedBranch', 'main',
        '-AgyExecutable', cmdPath
    ], { FAKE_AGY_STREAM_FILE: validStreamPath, MUTATE_TYPE: 'NONE', EXPECTED_MUTATION_ROOT: ws });

    if(res.exitCode!==0) console.error('LEAK ERR:', res.stderr, res.stdout); assert.equal(res.exitCode, 0, 'Must succeed when preflight and postflight count is under limit');
  } finally {
    cleanTempDir(ws); cleanTempDir(prof); cleanTempDir(rcpt); cleanTempDir(fake);
  }
});

test('D1 D2: Postflight receipt correctly handles preflight codes and show-ref duplication', () => {
  const workspaceDir = createTempDir('agy-b-ws-');
  const profileDir = createTempDir('agy-b-prof-');
  const receiptDir = createTempDir('agy-b-rcpt-');
  const fakeAgyDir = createTempDir('agy-b-fake-');

  // D1: Place fake git outside WorkspaceRoot
  const fakeGitPath = path.join(fakeAgyDir, 'git.cmd');
  const fakeGitLog = path.join(fakeAgyDir, 'fake-git.log');

  try {
    const { head, branch } = initGitWorkspace(workspaceDir);
    fs.mkdirSync(path.join(workspaceDir, 'tooling'), { recursive: true });

    // Resolve real git for the shim
    const resolveRes = execFileSync('where.exe', ['git.exe'], { encoding: 'utf8' });
    const realGitPath = resolveRes.split(/\r?\n/)[0].trim();
    if (!realGitPath) { throw new Error('Could not resolve git.exe'); }
    assert.ok(path.isAbsolute(realGitPath), 'Resolved git path must be absolute');
    assert.ok(fs.statSync(realGitPath).isFile(), 'Resolved git path must be a regular file');
    assert.ok(realGitPath.toLowerCase().endsWith('.exe'), 'Resolved git path must end in .exe');

    const fakeGitScript = "@echo off\necho %* >> \"" + fakeGitLog + "\"\n\"" + realGitPath + "\" %*\n";
    fs.writeFileSync(fakeGitPath, fakeGitScript, 'utf8');

    const promptFile = path.join(workspaceDir, 'PROMPT.md');
    fs.writeFileSync(promptFile, 'Execute test\n', 'utf8');
    const promptHash = getSha256('Execute test\n');

    const { cmdPath: fakeAgyPath, breadcrumbPath } = createFakeAgyScript(fakeAgyDir);
    const validStreamPath = createValidStreamFile(fakeAgyDir, workspaceDir);

    // D2: Valid custom fake AGY that doesn't mutate on --version
    const customFakeAgyScript = "const fs = require('fs');\n" +
      "const args = process.argv.slice(2);\n" +
      "if (args[0] === '--version') {\n" +
      "  console.log('1.1.8');\n" +
      "  process.exit(0);\n" +
      "}\n" +
      "fs.writeFileSync(require('path').join(process.env.WORKSPACE_DIR, 'tooling', 'file_d.txt'), 'D', 'utf8');\n" +
      "require(process.env.FAKE_AGY_PATH);\n";

    const customFakeAgyPath = path.join(fakeAgyDir, 'custom-fake-agy.cjs');
    fs.writeFileSync(customFakeAgyPath, customFakeAgyScript, 'utf8');

    const customFakeAgyCmd = path.join(fakeAgyDir, 'custom-fake-agy.cmd');
    const customFakeAgyCmdContent = "@echo off\n\"" + process.execPath + "\" \"" + customFakeAgyPath + "\" %*\n";
    fs.writeFileSync(customFakeAgyCmd, customFakeAgyCmdContent, 'utf8');

    const res = runPwshScript([
      '-WorkspaceRoot', workspaceDir,
      '-PromptFile', promptFile,
      '-ExpectedPromptSha256', promptHash,
      '-ProfileRoot', profileDir,
      '-ReceiptRoot', receiptDir,
      '-WritablePaths', path.join(workspaceDir, 'tooling'),
      '-ExpectedBaselineHead', head,
      '-ExpectedBranch', branch,
      '-AgyExecutable', customFakeAgyCmd
    ], {
      FAKE_AGY_STREAM_FILE: validStreamPath,
      FAKE_AGY_PATH: path.join(fakeAgyDir, 'fake-agy-fixture.cjs').replace(/\\/g, '/'),
      WORKSPACE_DIR: workspaceDir,
      PATH: fakeAgyDir + ';' + process.env.PATH
    });

    assert.equal(res.exitCode, 0, 'Controller must succeed ' + res.stderr);

    const authPath = path.join(receiptDir, 'POSTFLIGHT_WORKSPACE_AUTHORITY.json');
    assert.ok(fs.existsSync(authPath), 'Authority file must exist');
    const auth = JSON.parse(fs.readFileSync(authPath, 'utf8'));

    const requiredKeys = ['pre_abs_git_dir', 'pre_common_git_dir', 'pre_rev_parse_head', 'pre_rev_parse_branch', 'pre_status_uno', 'pre_status_uall', 'pre_show_ref', 'post_rev_parse_head', 'post_rev_parse_branch', 'post_show_ref', 'post_status'];
    for (const key of requiredKeys) {
      assert.strictEqual(auth.command_exit_codes[key], 0, 'Key ' + key + ' must be 0');
    }

    const gitLogs = fs.readFileSync(fakeGitLog, 'utf8').split('\n');
    const showRefCalls = gitLogs.filter(l => l.includes('show-ref'));
    assert.equal(showRefCalls.length, 2, 'show-ref must be called exactly twice (once pre, once post)');

    const observedCount = auth.observed_status_paths.filter(p => p.includes('file_d.txt')).length;
    assert.equal(observedCount, 1, 'Observed status path must appear exactly once without duplicates');
  } finally {
    cleanTempDir(workspaceDir);
    cleanTempDir(profileDir);
    cleanTempDir(receiptDir);
    cleanTempDir(fakeAgyDir);
  }
});

test('D3: Ordinal-ignore-case ordering of mixed-case snapshot keys', () => {
  const workspaceDir = createTempDir('agy-c3-ws-');
  const profileDir = createTempDir('agy-c3-prof-');
  const receiptDir = createTempDir('agy-c3-rcpt-');
  const fakeAgyDir = createTempDir('agy-c3-fake-');

  try {
    const { head, branch } = initGitWorkspace(workspaceDir);

    const protectedDir = path.join(workspaceDir, 'protected_docs');
    fs.mkdirSync(protectedDir, { recursive: true });

    // Explicit paths
    const pathA = path.join(protectedDir, 'File_A.txt');
    const pathB = path.join(protectedDir, 'file_[b].txt');
    const pathC = path.join(protectedDir, 'file_c.txt');

    fs.writeFileSync(pathA, 'A', 'utf8');
    fs.writeFileSync(pathB, 'B', 'utf8');
    fs.writeFileSync(pathC, 'C', 'utf8');

    const writableDir = path.join(workspaceDir, 'tooling');
    fs.mkdirSync(writableDir, { recursive: true });

    const promptFile = path.join(workspaceDir, 'PROMPT.md');
    fs.writeFileSync(promptFile, 'Execute test\n', 'utf8');
    const promptHash = getSha256('Execute test\n');

    const { cmdPath: fakeAgyPath, breadcrumbPath } = createFakeAgyScript(fakeAgyDir);
    const validStreamPath = createValidStreamFile(fakeAgyDir, workspaceDir);

    const res = runPwshScript([
      '-WorkspaceRoot', workspaceDir,
      '-PromptFile', promptFile,
      '-ExpectedPromptSha256', promptHash,
      '-ProfileRoot', profileDir,
      '-ReceiptRoot', receiptDir,
      '-WritablePaths', writableDir,
      '-ProtectedPaths', protectedDir,
      '-ExpectedBaselineHead', head,
      '-ExpectedBranch', branch,
      '-AgyExecutable', fakeAgyPath
    ], {
      FAKE_AGY_STREAM_FILE: validStreamPath,
      PATH: process.env.PATH
    });

    assert.equal(res.exitCode, 0, 'Controller must succeed ' + res.stderr);

    const authPath = path.join(receiptDir, 'POSTFLIGHT_WORKSPACE_AUTHORITY.json');
    assert.ok(fs.existsSync(authPath), 'Authority file must exist');
    const auth = JSON.parse(fs.readFileSync(authPath, 'utf8'));

    const preSnapshot = auth.critical_path_hashes_pre;
    const postSnapshot = auth.critical_path_hashes_post;

    const absA = path.resolve(pathA);
    const absB = path.resolve(pathB);
    const absC = path.resolve(pathC);

    // Assert exactly present in both snapshots
    assert.ok(preSnapshot[absA], 'File_A.txt must be in preSnapshot');
    assert.ok(preSnapshot[absB], 'file_[b].txt must be in preSnapshot');
    assert.ok(preSnapshot[absC], 'file_c.txt must be in preSnapshot');

    assert.ok(postSnapshot[absA], 'File_A.txt must be in postSnapshot');
    assert.ok(postSnapshot[absB], 'file_[b].txt must be in postSnapshot');
    assert.ok(postSnapshot[absC], 'file_c.txt must be in postSnapshot');

    // Assert ordinal-ignore-case sort on full key arrays
    const compareOrdinalIgnoreCaseAscii = (a, b) => {
      const upperA = a.toUpperCase();
      const upperB = b.toUpperCase();
      if (upperA < upperB) return -1;
      if (upperA > upperB) return 1;
      return 0;
    };

    const keysPre = Object.keys(preSnapshot);
    const sortedPre = [...keysPre].sort(compareOrdinalIgnoreCaseAscii);
    assert.deepEqual(keysPre, sortedPre, 'critical_path_hashes_pre must be sorted OrdinalIgnoreCase');

    const keysPost = Object.keys(postSnapshot);
    const sortedPost = [...keysPost].sort(compareOrdinalIgnoreCaseAscii);
    assert.deepEqual(keysPost, sortedPost, 'critical_path_hashes_post must be sorted OrdinalIgnoreCase');

    const idxA_pre = keysPre.indexOf(absA);
    const idxC_pre = keysPre.indexOf(absC);
    const idxB_pre = keysPre.indexOf(absB);
    assert.ok(idxA_pre < idxC_pre && idxC_pre < idxB_pre, 'preSnapshot relative order must be A, C, B');

    const idxA_post = keysPost.indexOf(absA);
    const idxC_post = keysPost.indexOf(absC);
    const idxB_post = keysPost.indexOf(absB);
    assert.ok(idxA_post < idxC_post && idxC_post < idxB_post, 'postSnapshot relative order must be A, C, B');
  } finally {
    cleanTempDir(workspaceDir);
    cleanTempDir(profileDir);
    cleanTempDir(receiptDir);
    cleanTempDir(fakeAgyDir);
  }
});
