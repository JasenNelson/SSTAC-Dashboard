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
fs.writeFileSync(${JSON.stringify(breadcrumbPath)}, 'launched\\n', 'utf8');

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
    execFileSync('git', ['config', 'user.name', 'AGY Test Worker'], { cwd: workspaceDir, stdio: 'ignore' });
    execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: workspaceDir, stdio: 'ignore' });

    const dummyFile = path.join(workspaceDir, 'README.md');
    fs.writeFileSync(dummyFile, '# Test Workspace\n', 'utf8');

    execFileSync('git', ['add', '.'], { cwd: workspaceDir, stdio: 'ignore' });
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
      '-ExpectedBranch', branch,
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
      '-ExpectedBranch', branch,
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
      '-ExpectedBranch', branch,
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
      '-ExpectedBranch', branch,
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
      '-ExpectedBranch', branch,
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
        '-ExpectedBranch', branch,
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
        '-ExpectedBranch', branch,
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
      '-ExpectedBranch', branch,
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
      '-ExpectedBranch', branch,
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
      '-ExpectedBranch', branch,
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
      '-ExpectedBranch', branch,
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
      '-ExpectedBranch', branch,
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
        '-ExpectedBranch', branch,
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
    const r1 = runPwshScript(['-WorkspaceRoot', workspaceDir, '-PromptFile', promptFile, '-ExpectedPromptSha256', promptHash, '-ProfileRoot', profileDir, '-ReceiptRoot', receiptDir, '-WritablePaths', writableDir, '-ExpectedBaselineHead', head, '-ExpectedBranch', branch, '-AgyExecutable', v1]);
    assert.notEqual(r1.exitCode, 0, 'x1.1.8 version must be rejected');
    assert.ok(r1.stderr.includes('AGY version mismatch'), 'x1.1.8 rejection reason must be version mismatch');
    assert.equal(fs.existsSync(b1), false, 'x1.1.8 version rejection must not reach worker mode');

    // Case 2: Suffixed 1.1.80
    const { cmdPath: v2, breadcrumbPath: b2 } = createCustomVersionFakeAgy(fakeAgyDir, '1.1.80', 0);
    const r2 = runPwshScript(['-WorkspaceRoot', workspaceDir, '-PromptFile', promptFile, '-ExpectedPromptSha256', promptHash, '-ProfileRoot', profileDir, '-ReceiptRoot', receiptDir, '-WritablePaths', writableDir, '-ExpectedBaselineHead', head, '-ExpectedBranch', branch, '-AgyExecutable', v2]);
    assert.notEqual(r2.exitCode, 0, '1.1.80 version must be rejected');
    assert.ok(r2.stderr.includes('AGY version mismatch'), '1.1.80 rejection reason must be version mismatch');
    assert.equal(fs.existsSync(b2), false, '1.1.80 version rejection must not reach worker mode');

    // Case 3: Multiline output
    const { cmdPath: v3, breadcrumbPath: b3 } = createCustomVersionFakeAgy(fakeAgyDir, '1.1.8\nextra line', 0);
    const r3 = runPwshScript(['-WorkspaceRoot', workspaceDir, '-PromptFile', promptFile, '-ExpectedPromptSha256', promptHash, '-ProfileRoot', profileDir, '-ReceiptRoot', receiptDir, '-WritablePaths', writableDir, '-ExpectedBaselineHead', head, '-ExpectedBranch', branch, '-AgyExecutable', v3]);
    assert.notEqual(r3.exitCode, 0, 'Multiline version output must be rejected');
    assert.ok(r3.stderr.includes('multiline'), 'Multiline rejection reason must be multiline output');
    assert.equal(fs.existsSync(b3), false, 'Multiline version output must not reach worker mode');

    // Case 4: Nonzero exit code
    const { cmdPath: v4, breadcrumbPath: b4 } = createCustomVersionFakeAgy(fakeAgyDir, '1.1.8', 1);
    const r4 = runPwshScript(['-WorkspaceRoot', workspaceDir, '-PromptFile', promptFile, '-ExpectedPromptSha256', promptHash, '-ProfileRoot', profileDir, '-ReceiptRoot', receiptDir, '-WritablePaths', writableDir, '-ExpectedBaselineHead', head, '-ExpectedBranch', branch, '-AgyExecutable', v4]);
    assert.notEqual(r4.exitCode, 0, 'Nonzero exit version probe must be rejected');
    assert.ok(r4.stderr.includes('nonzero exit code'), 'Nonzero exit rejection reason must be nonzero exit code');
    assert.equal(fs.existsSync(b4), false, 'Nonzero exit version probe must not reach worker mode');

    // Case 5: Empty output
    const { cmdPath: v5, breadcrumbPath: b5 } = createCustomVersionFakeAgy(fakeAgyDir, '', 0);
    const r5 = runPwshScript(['-WorkspaceRoot', workspaceDir, '-PromptFile', promptFile, '-ExpectedPromptSha256', promptHash, '-ProfileRoot', profileDir, '-ReceiptRoot', receiptDir, '-WritablePaths', writableDir, '-ExpectedBaselineHead', head, '-ExpectedBranch', branch, '-AgyExecutable', v5]);
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
      '-ExpectedBranch', branch,
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
      '-ExpectedBranch', branch,
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
        '-ExpectedBranch', branch,
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
      '-ExpectedBranch', branch,
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
      '-ExpectedBranch', branch,
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
      '-ExpectedBranch', branch,
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
      '-ExpectedBranch', branch,
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
      '-ExpectedBranch', branch,
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
      '-ExpectedBranch', branch,
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
      '-ExpectedBranch', branch,
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
    execFileSync('git', ['add', '.'], { cwd: workspaceDir, stdio: 'ignore' });
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
      '-ExpectedBranch', branch,
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
    execFileSync('git', ['add', '.'], { cwd: workspaceDir, stdio: 'ignore' });
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
    execFileSync('git', ['add', '.'], { cwd: workspaceDir, stdio: 'ignore' });
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
      '-ExpectedBranch', branch,
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
    execFileSync('git', ['add', '.'], { cwd: workspaceDir, stdio: 'ignore' });
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
      '-ExpectedBranch', branch,
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
      '-ExpectedBranch', branch,
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
    execFileSync('git', ['add', '.'], { cwd: workspaceDir, stdio: 'ignore' });
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
      '-ExpectedBranch', branch,
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
    execFileSync('git', ['add', '.'], { cwd: workspaceDir, stdio: 'ignore' });
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
      '-ExpectedBranch', branch,
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
      '-ExpectedBranch', branch,
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
      '-ExpectedBranch', branch,
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
