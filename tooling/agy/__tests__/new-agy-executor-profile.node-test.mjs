import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

const SCRIPT_PATH = path.resolve('tooling/agy/New-AgyExecutorProfile.ps1');

function runPwshScript(args, env = {}) {
  try {
    const stdout = execFileSync('pwsh', ['-NoProfile', '-File', SCRIPT_PATH, ...args], {
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

function runPwshScriptCommand(commandExpr) {
  try {
    const stdout = execFileSync('pwsh', ['-NoProfile', '-Command', commandExpr], {
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

function formatPsSingleQuote(val) {
  return `'${String(val).replace(/'/g, "''")}'`;
}

function formatPsArray(arr) {
  return `@(${arr.map(formatPsSingleQuote).join(',')})`;
}

function createTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function cleanTempDir(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {}
}

function initGitWorkspace(workspaceDir) {
  try {
    execFileSync('git', ['init'], { cwd: workspaceDir, stdio: 'ignore' });
    try { execFileSync('git', ['checkout', '-b', 'main'], { cwd: workspaceDir, stdio: 'ignore' }); } catch(e) {}
    execFileSync('git', ['config', 'user.name', 'AGY Test Worker'], { cwd: workspaceDir, stdio: 'ignore' });
    execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: workspaceDir, stdio: 'ignore' });
    return workspaceDir;
  } catch (err) {
    throw new Error(`Failed to initialize git test workspace: ${err.message}`);
  }
}

function assertStringArray(arr, name) {
  assert.ok(Array.isArray(arr), `${name} must be an array`);
  assert.ok(arr.every(item => typeof item === 'string'), `${name} must contain only strings`);
  assert.ok(!arr.some(item => typeof item === 'object'), `${name} must not contain objects`);
}

test('safe empty-command profile', () => {
  const profileDir = createTempDir('agy-test-profile-');
  const workspaceDir = createTempDir('agy-test-ws-');
  initGitWorkspace(workspaceDir);
  const writableDir = path.join(workspaceDir, 'tooling');

  try {
    const res = runPwshScript([
      '-WorkspaceRoot', workspaceDir,
      '-ProfileRoot', profileDir,
      '-WritablePaths', writableDir
    ]);

    assert.equal(res.exitCode, 0, `Expected exit code 0, got ${res.exitCode}. Stderr: ${res.stderr}`);

    const settingsPath = path.join(profileDir, '.gemini', 'antigravity-cli', 'settings.json');
    const manifestPath = path.join(profileDir, '.gemini', 'antigravity-cli', 'PROFILE_MANIFEST.json');

    assert.ok(fs.existsSync(settingsPath), 'settings.json should exist');
    assert.ok(fs.existsSync(manifestPath), 'PROFILE_MANIFEST.json should exist');

    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

    assert.equal(settings.artifactReviewPolicy, 'always-proceed');
    assert.equal(settings.enableTelemetry, false);
    assert.equal(settings.allowNonWorkspaceAccess, undefined, 'allowNonWorkspaceAccess must be absent');
    assert.equal(settings.toolPermission, undefined, 'toolPermission must be absent');

    assertStringArray(settings.permissions.allow, 'permissions.allow');
    assertStringArray(settings.permissions.deny, 'permissions.deny');

    const normWs = path.resolve(workspaceDir);
    const normWp = path.resolve(writableDir);

    assert.ok(settings.permissions.allow.includes(`read_file(${normWs})`), 'permissions.allow must contain workspace read_file rule');
    assert.ok(settings.permissions.allow.includes(`write_file(${normWp})`), 'permissions.allow must contain writable_path write_file rule');
    assert.ok(settings.permissions.deny.includes('command(*)'), 'command(*) must be in deny for empty allow');

    assert.equal(manifest.not_os_level_containment, true);
    assert.equal(manifest.expected_agy_version, '1.1.8');
    assert.ok(Array.isArray(manifest.writable_paths));
    assert.equal(manifest.writable_paths[0], normWp);
  } finally {
    cleanTempDir(profileDir);
    cleanTempDir(workspaceDir);
  }
});

test('normal profile generation handles multi-level nested relative writable paths', () => {
  const profileDir = createTempDir('agy-test-profile-');
  const workspaceDir = createTempDir('agy-test-ws-');
  initGitWorkspace(workspaceDir);
  const nestedWritableDir = path.join(workspaceDir, 'nested', 'sub', 'tooling');

  try {
    const res = runPwshScript([
      '-WorkspaceRoot', workspaceDir,
      '-ProfileRoot', profileDir,
      '-WritablePaths', nestedWritableDir
    ]);

    assert.equal(res.exitCode, 0, `Expected exit code 0, got ${res.exitCode}. Stderr: ${res.stderr}`);
    const settingsPath = path.join(profileDir, '.gemini', 'antigravity-cli', 'settings.json');
    assert.ok(fs.existsSync(settingsPath));
  } finally {
    cleanTempDir(profileDir);
    cleanTempDir(workspaceDir);
  }
});

test('safe exact-command profile', () => {
  const profileDir = createTempDir('agy-test-profile-');
  const workspaceDir = createTempDir('agy-test-ws-');
  initGitWorkspace(workspaceDir);
  const writableDir = path.join(workspaceDir, 'tooling');

  try {
    const allowedCmd = 'node tooling/agy/validate-agy-stream.mjs';
    const res = runPwshScript([
      '-WorkspaceRoot', workspaceDir,
      '-ProfileRoot', profileDir,
      '-WritablePaths', writableDir,
      '-AllowedCommands', allowedCmd
    ]);

    assert.equal(res.exitCode, 0, `Expected exit code 0, got ${res.exitCode}. Stderr: ${res.stderr}`);

    const settingsPath = path.join(profileDir, '.gemini', 'antigravity-cli', 'settings.json');
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));

    assertStringArray(settings.permissions.allow, 'permissions.allow');
    assertStringArray(settings.permissions.deny, 'permissions.deny');

    assert.ok(settings.permissions.allow.includes(`command(${allowedCmd})`));
    assert.ok(!settings.permissions.deny.includes('command(*)'), 'command(*) must NOT be in deny when exact commands are allowed');
  } finally {
    cleanTempDir(profileDir);
    cleanTempDir(workspaceDir);
  }
});

test('mandatory protected paths emitted and recorded when fixtures exist', () => {
  const profileDir = createTempDir('agy-test-profile-');
  const workspaceDir = createTempDir('agy-test-ws-');
  const writableDir = path.join(workspaceDir, 'tooling');

  const gitDir = path.join(workspaceDir, '.git');
  const envFile = path.join(workspaceDir, '.env');
  const pkgFile = path.join(workspaceDir, 'package.json');
  initGitWorkspace(workspaceDir);
  fs.writeFileSync(envFile, 'SECRET=123');
  fs.writeFileSync(pkgFile, '{}');

  try {
    const res = runPwshScript([
      '-WorkspaceRoot', workspaceDir,
      '-ProfileRoot', profileDir,
      '-WritablePaths', writableDir
    ]);

    assert.equal(res.exitCode, 0, `Expected exit code 0, got ${res.exitCode}. Stderr: ${res.stderr}`);

    const settings = JSON.parse(fs.readFileSync(path.join(profileDir, '.gemini', 'antigravity-cli', 'settings.json'), 'utf8'));
    const manifest = JSON.parse(fs.readFileSync(path.join(profileDir, '.gemini', 'antigravity-cli', 'PROFILE_MANIFEST.json'), 'utf8'));

    const normGit = path.resolve(gitDir);
    const normEnv = path.resolve(envFile);
    const normPkg = path.resolve(pkgFile);

    assert.ok(settings.permissions.deny.includes(`read_file(${normGit})`), '.git must have read_file deny');
    assert.ok(settings.permissions.deny.includes(`write_file(${normGit})`), '.git must have write_file deny');
    assert.ok(settings.permissions.deny.includes(`read_file(${normEnv})`), '.env must have read_file deny');
    assert.ok(settings.permissions.deny.includes(`write_file(${normEnv})`), '.env must have write_file deny');

    assert.ok(!settings.permissions.deny.includes(`read_file(${normPkg})`), 'package.json must NOT have read_file deny');
    assert.ok(settings.permissions.deny.includes(`write_file(${normPkg})`), 'package.json must have write_file deny');

    assert.ok(Array.isArray(manifest.mandatory_protected_paths), 'manifest must have mandatory_protected_paths');
    const gitEntry = manifest.mandatory_protected_paths.find(e => e.path === normGit);
    const pkgEntry = manifest.mandatory_protected_paths.find(e => e.path === normPkg);
    assert.equal(gitEntry.mode, 'read_write');
    assert.equal(pkgEntry.mode, 'write_only');
  } finally {
    cleanTempDir(profileDir);
    cleanTempDir(workspaceDir);
  }
});

test('unlisted .env* files dynamically discovered and protected', () => {
  const profileDir = createTempDir('agy-test-profile-');
  const workspaceDir = createTempDir('agy-test-ws-');
  initGitWorkspace(workspaceDir);
  const writableDir = path.join(workspaceDir, 'tooling');

  const envTestFile = path.join(workspaceDir, '.env.test');
  const envProdLocalFile = path.join(workspaceDir, '.env.production.local');
  fs.writeFileSync(envTestFile, 'FOO=BAR');
  fs.writeFileSync(envProdLocalFile, 'BAZ=QUX');

  try {
    const res = runPwshScript([
      '-WorkspaceRoot', workspaceDir,
      '-ProfileRoot', profileDir,
      '-WritablePaths', writableDir
    ]);

    assert.equal(res.exitCode, 0, `Expected exit code 0, got ${res.exitCode}. Stderr: ${res.stderr}`);

    const settings = JSON.parse(fs.readFileSync(path.join(profileDir, '.gemini', 'antigravity-cli', 'settings.json'), 'utf8'));
    const manifest = JSON.parse(fs.readFileSync(path.join(profileDir, '.gemini', 'antigravity-cli', 'PROFILE_MANIFEST.json'), 'utf8'));

    const normTest = path.resolve(envTestFile);
    const normProd = path.resolve(envProdLocalFile);

    assert.ok(settings.permissions.deny.includes(`read_file(${normTest})`), '.env.test must have read_file deny');
    assert.ok(settings.permissions.deny.includes(`write_file(${normTest})`), '.env.test must have write_file deny');
    assert.ok(settings.permissions.deny.includes(`read_file(${normProd})`), '.env.production.local must have read_file deny');
    assert.ok(settings.permissions.deny.includes(`write_file(${normProd})`), '.env.production.local must have write_file deny');

    const testEntry = manifest.mandatory_protected_paths.find(e => e.path === normTest);
    const prodEntry = manifest.mandatory_protected_paths.find(e => e.path === normProd);
    assert.ok(testEntry, '.env.test must be recorded in manifest');
    assert.equal(testEntry.mode, 'read_write');
    assert.ok(prodEntry, '.env.production.local must be recorded in manifest');
    assert.equal(prodEntry.mode, 'read_write');
  } finally {
    cleanTempDir(profileDir);
    cleanTempDir(workspaceDir);
  }
});

test('attempting to make mandatory protected path writable is rejected', () => {
  const profileDir = createTempDir('agy-test-profile-');
  const workspaceDir = createTempDir('agy-test-ws-');
  initGitWorkspace(workspaceDir);

  const gitDir = path.join(workspaceDir, '.git');

  try {
    const res = runPwshScript([
      '-WorkspaceRoot', workspaceDir,
      '-ProfileRoot', profileDir,
      '-WritablePaths', gitDir
    ]);

    assert.notEqual(res.exitCode, 0, 'Making mandatory protected path writable must be rejected');
    assert.ok(res.stderr.includes('Overlap detected'), 'Must fail specifically for overlap with mandatory protected path');
  } finally {
    cleanTempDir(profileDir);
    cleanTempDir(workspaceDir);
  }
});

test('reparse-point escape rejected', (t) => {
  const reparseWs = createTempDir('agy-test-ws-');
  initGitWorkspace(reparseWs);
  const reparseTarget = createTempDir('agy-test-target-');
  const junctionPath = path.join(reparseWs, 'escape-junction');

  try {
    try {
      fs.symlinkSync(reparseTarget, junctionPath, 'junction');
    } catch (e) {
      if (e.code === 'EPERM' || e.code === 'EACCES' || e.code === 'ENOSYS') {
        t.skip(`Failed to create junction fixture: ${e.code}`);
        return;
      }
      throw e;
    }
    assert.ok(fs.lstatSync(junctionPath).isSymbolicLink(), 'Fixture must be a symbolic link/reparse point');
    assert.strictEqual(fs.realpathSync(junctionPath), fs.realpathSync(reparseTarget), 'Fixture must resolve to target');

    const writableScope = path.join(junctionPath, 'write-scope');
    const profileDir = createTempDir('agy-test-profile-');

    try {
      const res = runPwshScript([
        '-WorkspaceRoot', reparseWs,
        '-ProfileRoot', profileDir,
        '-WritablePaths', writableScope
      ]);

      assert.notEqual(res.exitCode, 0, 'Writable path traversing junction inside workspace must be rejected');
      assert.ok(res.stderr.includes('reparse point') || res.stdout.includes('reparse point'), 'Should explicitly cite reparse point rule');
    } finally {
      cleanTempDir(profileDir);
    }
  } finally {
    cleanTempDir(reparseWs);
    cleanTempDir(reparseTarget);
  }
});

test('reparse-point profile root rejected', (t) => {
  const reparseTarget = createTempDir('agy-test-profile-target-');
  const reparseProfileRoot = path.join(createTempDir('agy-test-profile-base-'), 'profile-junction');

  try {
    try {
      fs.symlinkSync(reparseTarget, reparseProfileRoot, 'junction');
    } catch (e) {
      if (e.code === 'EPERM' || e.code === 'EACCES' || e.code === 'ENOSYS') {
        t.skip(`Failed to create junction fixture: ${e.code}`);
        return;
      }
      throw e;
    }
    assert.ok(fs.lstatSync(reparseProfileRoot).isSymbolicLink(), 'Fixture must be a symbolic link/reparse point');
    assert.strictEqual(fs.realpathSync(reparseProfileRoot), fs.realpathSync(reparseTarget), 'Fixture must resolve to target');

    const workspaceDir = createTempDir('agy-test-ws-');
    initGitWorkspace(workspaceDir);
    const writableDir = path.join(workspaceDir, 'tooling');

    try {
      const res = runPwshScript([
        '-WorkspaceRoot', workspaceDir,
        '-ProfileRoot', reparseProfileRoot,
        '-WritablePaths', writableDir
      ]);

      assert.notEqual(res.exitCode, 0, 'ProfileRoot traversing junction must be rejected');
      assert.ok(res.stderr.includes('reparse point'), 'Must explicitly cite reparse point rule');
    } finally {
      cleanTempDir(workspaceDir);
    }
  } finally {
    cleanTempDir(reparseTarget);
    cleanTempDir(path.dirname(reparseProfileRoot));
  }
});

test('deterministic settings content', () => {
  const profileDir1 = createTempDir('agy-test-profile1-');
  const profileDir2 = createTempDir('agy-test-profile2-');
  const workspaceDir = createTempDir('agy-test-ws-');
  initGitWorkspace(workspaceDir);
  const writableDir = path.join(workspaceDir, 'tooling');

  try {
    const args = [
      '-WorkspaceRoot', workspaceDir,
      '-WritablePaths', writableDir,
      '-AllowedCommands', 'npx --no-install tsc --noEmit'
    ];

    runPwshScript([...args, '-ProfileRoot', profileDir1]);
    runPwshScript([...args, '-ProfileRoot', profileDir2]);

    const s1 = fs.readFileSync(path.join(profileDir1, '.gemini', 'antigravity-cli', 'settings.json'), 'utf8');
    const s2 = fs.readFileSync(path.join(profileDir2, '.gemini', 'antigravity-cli', 'settings.json'), 'utf8');

    assert.equal(s1, s2, 'Generated settings.json content must be byte-for-byte identical');
  } finally {
    cleanTempDir(profileDir1);
    cleanTempDir(profileDir2);
    cleanTempDir(workspaceDir);
  }
});

test('old npx tsc --noEmit spelling is rejected', () => {
  const profileDir = createTempDir('agy-test-profile-');
  const workspaceDir = createTempDir('agy-test-ws-');
  initGitWorkspace(workspaceDir);
  const writableDir = path.join(workspaceDir, 'tooling');

  try {
    const res = runPwshScript([
      '-WorkspaceRoot', workspaceDir,
      '-ProfileRoot', profileDir,
      '-WritablePaths', writableDir,
      '-AllowedCommands', 'npx tsc --noEmit'
    ]);

    assert.notEqual(res.exitCode, 0, 'Old npx tsc --noEmit spelling must be rejected');
    assert.ok(res.stderr.includes('does not conform to the permitted grammar'), 'Must fail specifically for spelling');
  } finally {
    cleanTempDir(profileDir);
    cleanTempDir(workspaceDir);
  }
});

test('global settings are untouched', () => {
  const userHome = os.homedir();
  const globalGeminiDir = path.join(userHome, '.gemini');
  let globalMtime = null;

  if (fs.existsSync(globalGeminiDir)) {
    globalMtime = fs.statSync(globalGeminiDir).mtimeMs;
  }

  const profileDir = createTempDir('agy-test-profile-');
  const workspaceDir = createTempDir('agy-test-ws-');
  initGitWorkspace(workspaceDir);
  const writableDir = path.join(workspaceDir, 'tooling');

  try {
    runPwshScript([
      '-WorkspaceRoot', workspaceDir,
      '-ProfileRoot', profileDir,
      '-WritablePaths', writableDir
    ]);

    if (fs.existsSync(globalGeminiDir)) {
      const newMtime = fs.statSync(globalGeminiDir).mtimeMs;
      assert.equal(newMtime, globalMtime, 'Global ~/.gemini directory must not be touched');
    }
  } finally {
    cleanTempDir(profileDir);
    cleanTempDir(workspaceDir);
  }
});

test('broad workspace roots rejected', () => {
  const profileDir = createTempDir('agy-test-profile-');

  try {
    const forbiddenWorkspaces = [
      'C:\\Projects\\SSTAC-Dashboard',
      'C:\\Projects',
      'C:\\Projects\\SSTAC-Dashboard-worktrees',
      'C:\\'
    ];

    for (const ws of forbiddenWorkspaces) {
      const res = runPwshScript([
        '-WorkspaceRoot', ws,
        '-ProfileRoot', profileDir,
        '-WritablePaths', 'C:\\some\\path'
      ]);
      assert.notEqual(res.exitCode, 0, `Workspace root '${ws}' should have been rejected`);
    }
  } finally {
    cleanTempDir(profileDir);
  }
});

test('profile root equal to or inside workspace rejected', () => {
  const workspaceDir = createTempDir('agy-test-ws-');
  initGitWorkspace(workspaceDir);
  const profileDir = path.join(workspaceDir, 'profile');
  const writableDir = path.join(workspaceDir, 'tooling');

  try {
    const res = runPwshScript([
      '-WorkspaceRoot', workspaceDir,
      '-ProfileRoot', profileDir,
      '-WritablePaths', writableDir
    ]);
    assert.notEqual(res.exitCode, 0, 'ProfileRoot inside WorkspaceRoot should be rejected');
    assert.ok(res.stderr.includes('cannot equal or descend from WorkspaceRoot'), 'Must fail for ProfileRoot containment');
  } finally {
    cleanTempDir(workspaceDir);
  }
});

test('dirty/nonempty profile replacement rejected', () => {
  const profileDir = createTempDir('agy-test-profile-');
  const workspaceDir = createTempDir('agy-test-ws-');
  initGitWorkspace(workspaceDir);
  const writableDir = path.join(workspaceDir, 'tooling');

  try {
    fs.writeFileSync(path.join(profileDir, 'unrelated.txt'), 'data');

    const res = runPwshScript([
      '-WorkspaceRoot', workspaceDir,
      '-ProfileRoot', profileDir,
      '-WritablePaths', writableDir,
      '-ReplaceEmptyGeneratedProfile'
    ]);

    assert.notEqual(res.exitCode, 0, 'Nonempty profile containing non-generated files should be rejected even with -ReplaceEmptyGeneratedProfile');
    assert.ok(res.stderr.includes('contains non-generated item'), 'Must fail specifically for nonempty profile');
  } finally {
    cleanTempDir(profileDir);
    cleanTempDir(workspaceDir);
  }
});

test('wildcard and dangerous allow rules rejected', () => {
  const profileDir = createTempDir('agy-test-profile-');
  const workspaceDir = createTempDir('agy-test-ws-');
  initGitWorkspace(workspaceDir);
  const writableDir = path.join(workspaceDir, 'tooling');

  try {
    const dangerousCommands = [
      { cmd: 'command(*)', expected: 'contains forbidden characters' },
      { cmd: 'git *', expected: 'contains forbidden characters' },
      { cmd: 'node *.mjs', expected: 'contains forbidden characters' },
      { cmd: 'rm -rf /', expected: 'does not conform to the permitted grammar' }
    ];

    for (const item of dangerousCommands) {
      const res = runPwshScript([
        '-WorkspaceRoot', workspaceDir,
        '-ProfileRoot', profileDir,
        '-WritablePaths', writableDir,
        '-AllowedCommands', item.cmd
      ]);
      assert.notEqual(res.exitCode, 0, `Dangerous command '${item.cmd}' should have been rejected`);
      assert.ok(res.stderr.includes(item.expected), `Must fail specifically for invalid command`);
    }
  } finally {
    cleanTempDir(profileDir);
    cleanTempDir(workspaceDir);
  }
});

test('shell operators, redirection, substitutions, and newlines rejected', () => {
  const profileDir = createTempDir('agy-test-profile-');
  const workspaceDir = createTempDir('agy-test-ws-');
  initGitWorkspace(workspaceDir);
  const writableDir = path.join(workspaceDir, 'tooling');

  try {
    const maliciousCommands = [
      'node test.mjs; calc.exe',
      'npm run test && echo pwned',
      'node test.mjs > out.txt',
      'npm run test\nrm -rf',
      'cmd /d /c echo %PATH%',
      'node $(whoami).mjs'
    ];

    for (const cmd of maliciousCommands) {
      const res = runPwshScript([
        '-WorkspaceRoot', workspaceDir,
        '-ProfileRoot', profileDir,
        '-WritablePaths', writableDir,
        '-AllowedCommands', cmd
      ]);
      assert.notEqual(res.exitCode, 0, `Shell operator/metacharacter command '${cmd}' should have been rejected`);
      assert.ok(res.stderr.includes('contains forbidden characters'), 'Must fail specifically for shell metacharacters');
    }
  } finally {
    cleanTempDir(profileDir);
    cleanTempDir(workspaceDir);
  }
});

test('protected-path deny rules emitted', () => {
  const profileDir = createTempDir('agy-test-profile-');
  const workspaceDir = createTempDir('agy-test-ws-');
  initGitWorkspace(workspaceDir);
  const writableDir = path.join(workspaceDir, 'tooling');
  const protectedDir = createTempDir('agy-test-protected-');

  try {
    const res = runPwshScript([
      '-WorkspaceRoot', workspaceDir,
      '-ProfileRoot', profileDir,
      '-WritablePaths', writableDir,
      '-ProtectedPaths', protectedDir
    ]);

    assert.equal(res.exitCode, 0, `Expected exit code 0, got ${res.exitCode}. Stderr: ${res.stderr}`);

    const settingsPath = path.join(profileDir, '.gemini', 'antigravity-cli', 'settings.json');
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));

    const normProt = path.resolve(protectedDir);
    const hasReadDeny = settings.permissions.deny.includes(`read_file(${normProt})`);
    const hasWriteDeny = settings.permissions.deny.includes(`write_file(${normProt})`);

    assert.ok(hasReadDeny, 'Protected path read_file deny rule must be emitted');
    assert.ok(hasWriteDeny, 'Protected path write_file deny rule must be emitted');
  } finally {
    cleanTempDir(profileDir);
    cleanTempDir(workspaceDir);
    cleanTempDir(protectedDir);
  }
});

test('protected-path overlap with writable path rejected', () => {
  const profileDir = createTempDir('agy-test-profile-');
  const workspaceDir = createTempDir('agy-test-ws-');
  initGitWorkspace(workspaceDir);
  const sharedSubDir = path.join(workspaceDir, 'sub');
  fs.mkdirSync(sharedSubDir, { recursive: true });

  try {
    const res = runPwshScript([
      '-WorkspaceRoot', workspaceDir,
      '-ProfileRoot', profileDir,
      '-WritablePaths', sharedSubDir,
      '-ProtectedPaths', sharedSubDir
    ]);

    assert.notEqual(res.exitCode, 0, 'Overlap between WritablePaths and ProtectedPaths should be rejected');
    assert.ok(res.stderr.includes('Overlap detected'), 'Must fail specifically for overlap');
  } finally {
    cleanTempDir(profileDir);
    cleanTempDir(workspaceDir);
  }
});

test('no wildcard allow, unrestricted write, unsandboxed, or secret content', () => {
  const profileDir = createTempDir('agy-test-profile-');
  const workspaceDir = createTempDir('agy-test-ws-');
  initGitWorkspace(workspaceDir);
  const writableDir = path.join(workspaceDir, 'tooling');

  try {
    runPwshScript([
      '-WorkspaceRoot', workspaceDir,
      '-ProfileRoot', profileDir,
      '-WritablePaths', writableDir,
      '-AllowedCommands', 'npx --no-install tsc --noEmit'
    ]);

    const settingsPath = path.join(profileDir, '.gemini', 'antigravity-cli', 'settings.json');
    const settingsStr = fs.readFileSync(settingsPath, 'utf8');
    const settings = JSON.parse(settingsStr);

    for (const allowRule of settings.permissions.allow) {
      assert.notEqual(allowRule, '*', 'No wildcard allow permitted');
      assert.ok(!allowRule.startsWith('unsandboxed('), 'No unsandboxed allow permitted');
    }

    assert.equal(settingsStr.includes('API_KEY'), false, 'No secret content permitted');
    assert.equal(settingsStr.includes('PASSWORD'), false, 'No secret content permitted');
  } finally {
    cleanTempDir(profileDir);
    cleanTempDir(workspaceDir);
  }
});

test('manifest array schema invariant for zero, one, and multiple collection entries', () => {
  const profileDir = createTempDir('agy-test-manifest-arr-');
  const workspaceDir = createTempDir('agy-test-ws-arr-');
  initGitWorkspace(workspaceDir);
  const writableDir1 = path.join(workspaceDir, 'w1');
  const writableDir2 = path.join(workspaceDir, 'w2');
  const protDir1 = createTempDir('agy-test-prot1-');
  const protDir2 = createTempDir('agy-test-prot2-');
  fs.mkdirSync(writableDir1, { recursive: true });
  fs.mkdirSync(writableDir2, { recursive: true });

  try {
    const resZero = runPwshScript([
      '-WorkspaceRoot', workspaceDir,
      '-ProfileRoot', profileDir,
      '-WritablePaths', writableDir1,
      '-ReplaceEmptyGeneratedProfile'
    ]);
    assert.equal(resZero.exitCode, 0, `Expected exit code 0. Stderr: ${resZero.stderr}`);

    const manifestPath = path.join(profileDir, '.gemini', 'antigravity-cli', 'PROFILE_MANIFEST.json');
    const settingsPath = path.join(profileDir, '.gemini', 'antigravity-cli', 'settings.json');
    let manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    let settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));

    assert.ok(Array.isArray(manifest.allowed_commands), 'allowed_commands must be an array when empty');
    assert.equal(manifest.allowed_commands.length, 0);
    assert.ok(Array.isArray(manifest.writable_paths), 'writable_paths must be an array');
    assert.equal(manifest.writable_paths.length, 1);
    assert.ok(Array.isArray(manifest.protected_paths), 'protected_paths must be an array when empty');
    assert.equal(manifest.protected_paths.length, 0);
    assert.ok(Array.isArray(manifest.mandatory_protected_paths), 'mandatory_protected_paths must be an array');
    assert.ok(Array.isArray(settings.permissions.allow), 'settings.permissions.allow must be an array');
    assert.ok(Array.isArray(settings.permissions.deny), 'settings.permissions.deny must be an array');

    const resOne = runPwshScript([
      '-WorkspaceRoot', workspaceDir,
      '-ProfileRoot', profileDir,
      '-WritablePaths', writableDir1,
      '-AllowedCommands', 'npx --no-install tsc --noEmit',
      '-ProtectedPaths', protDir1,
      '-ReplaceEmptyGeneratedProfile'
    ]);
    assert.equal(resOne.exitCode, 0, `Expected exit code 0. Stderr: ${resOne.stderr}`);

    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));

    assert.ok(Array.isArray(manifest.allowed_commands), 'allowed_commands must be an array for 1 command');
    assert.equal(manifest.allowed_commands.length, 1);
    assert.equal(manifest.allowed_commands[0], 'npx --no-install tsc --noEmit');
    assert.ok(Array.isArray(manifest.protected_paths), 'protected_paths must be an array for 1 path');
    assert.equal(manifest.protected_paths.length, 1);
    assert.ok(Array.isArray(settings.permissions.allow), 'settings.permissions.allow must be an array');

    const scriptPathEscaped = formatPsSingleQuote(SCRIPT_PATH);
    const wsEscaped = formatPsSingleQuote(workspaceDir);
    const profEscaped = formatPsSingleQuote(profileDir);
    const wPaths = formatPsArray([writableDir1, writableDir2]);
    const aCmds = formatPsArray(['npx --no-install tsc --noEmit', 'cmd /d /c echo test']);
    const pPaths = formatPsArray([protDir1, protDir2]);

    const commandExpr = `& ${scriptPathEscaped} -WorkspaceRoot ${wsEscaped} -ProfileRoot ${profEscaped} -WritablePaths ${wPaths} -AllowedCommands ${aCmds} -ProtectedPaths ${pPaths} -ReplaceEmptyGeneratedProfile`;

    const resMulti = runPwshScriptCommand(commandExpr);
    assert.equal(resMulti.exitCode, 0, `Expected exit code 0. Stderr: ${resMulti.stderr}`);

    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));

    assert.ok(Array.isArray(manifest.allowed_commands), 'allowed_commands must be an array for multiple commands');
    assert.equal(manifest.allowed_commands.length, 2);
    assert.deepEqual(manifest.allowed_commands, ['npx --no-install tsc --noEmit', 'cmd /d /c echo test']);

    assert.ok(Array.isArray(manifest.writable_paths), 'writable_paths must be an array for multiple paths');
    assert.equal(manifest.writable_paths.length, 2);
    assert.deepEqual(manifest.writable_paths, [path.resolve(writableDir1), path.resolve(writableDir2)]);

    assert.ok(Array.isArray(manifest.protected_paths), 'protected_paths must be an array for multiple paths');
    assert.equal(manifest.protected_paths.length, 2);
    assert.deepEqual(manifest.protected_paths, [path.resolve(protDir1), path.resolve(protDir2)]);

    assert.ok(Array.isArray(manifest.mandatory_protected_paths), 'mandatory_protected_paths must be an array');
    const normGit = path.resolve(workspaceDir, '.git');
    const gitEntry = manifest.mandatory_protected_paths.find(e => e.path === normGit);
    assert.ok(gitEntry, '.git must be in mandatory_protected_paths for git workspace');
    assert.equal(gitEntry.mode, 'read_write');
  } finally {
    cleanTempDir(profileDir);
    cleanTempDir(workspaceDir);
    cleanTempDir(protDir1);
    cleanTempDir(protDir2);
  }
});

test('D4: Git discovery failures terminate profile generator and produce no output', () => {
  const workspaceDir = createTempDir('agy-d4-ws-');
  const fakeGitPath = path.join(workspaceDir, 'git.cmd');

  try {
    const writableDir = path.join(workspaceDir, 'tooling');
    fs.mkdirSync(writableDir, { recursive: true });
    initGitWorkspace(workspaceDir);

    const resolveRes = runPwshScriptCommand('(Get-Command git.exe).Source');
    const realGitPath = resolveRes.stdout.trim();
    if (!realGitPath) { throw new Error('Could not resolve git.exe'); }

    // Case 1: git rev-parse --absolute-git-dir fails
    const profileDir1 = createTempDir('agy-d4-prof1-');
    try {
      let fakeGitScript1 = "@echo off\n" +
        "if \"%1\"==\"rev-parse\" if \"%2\"==\"--absolute-git-dir\" (echo fatal: not a git repository && exit /b 128)\n" +
        "\"" + realGitPath + "\" %*\n";
      fs.writeFileSync(fakeGitPath, fakeGitScript1, 'utf8');

      let resFail1 = runPwshScript([
        '-WorkspaceRoot', workspaceDir,
        '-ProfileRoot', profileDir1,
        '-WritablePaths', writableDir
      ], {
        PATH: workspaceDir + ';' + process.env.PATH
      });

      assert.notEqual(resFail1.exitCode, 0, 'Generator must fail if absolute-git-dir fails');
      assert.ok(resFail1.stderr.includes('git rev-parse --absolute-git-dir failed'), 'Must emit specific absolute-git-dir error');

      const geminiDir1 = path.join(profileDir1, '.gemini', 'antigravity-cli');
      assert.ok(!fs.existsSync(path.join(geminiDir1, 'settings.json')), 'settings.json must not be emitted on failure 1');
      assert.ok(!fs.existsSync(path.join(geminiDir1, 'PROFILE_MANIFEST.json')), 'PROFILE_MANIFEST.json must not be emitted on failure 1');
    } finally {
      cleanTempDir(profileDir1);
    }

    // Case 2: git rev-parse --git-common-dir fails
    const profileDir2 = createTempDir('agy-d4-prof2-');
    try {
      let fakeGitScript2 = "@echo off\n" +
        "if \"%1\"==\"rev-parse\" if \"%2\"==\"--git-common-dir\" (echo fatal: not a git repository && exit /b 128)\n" +
        "\"" + realGitPath + "\" %*\n";
      fs.writeFileSync(fakeGitPath, fakeGitScript2, 'utf8');

      let resFail2 = runPwshScript([
        '-WorkspaceRoot', workspaceDir,
        '-ProfileRoot', profileDir2,
        '-WritablePaths', writableDir
      ], {
        PATH: workspaceDir + ';' + process.env.PATH
      });

      assert.notEqual(resFail2.exitCode, 0, 'Generator must fail if git-common-dir fails');
      assert.ok(resFail2.stderr.includes('git rev-parse --git-common-dir failed'), 'Must emit specific git-common-dir error');

      const geminiDir2 = path.join(profileDir2, '.gemini', 'antigravity-cli');
      assert.ok(!fs.existsSync(path.join(geminiDir2, 'settings.json')), 'settings.json must not be emitted on failure 2');
      assert.ok(!fs.existsSync(path.join(geminiDir2, 'PROFILE_MANIFEST.json')), 'PROFILE_MANIFEST.json must not be emitted on failure 2');
    } finally {
      cleanTempDir(profileDir2);
    }
  } finally {
    cleanTempDir(workspaceDir);
  }
});
