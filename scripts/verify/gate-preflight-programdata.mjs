// Resolve the machine's registered ProgramData folder without inheriting secrets
// into the registry probe or changing the parent process environment.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const COMMON_APPDATA_KEY = 'HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Shell Folders';

export function resolveCanonicalProgramData({
  env = process.env,
  run = spawnSync,
  realpath = fs.realpathSync.native,
  stat = fs.statSync,
} = {}) {
  const systemRoot = env.SystemRoot ?? env.SYSTEMROOT;
  if (typeof systemRoot !== 'string' || !path.win32.isAbsolute(systemRoot) || systemRoot.includes('%')) {
    throw new Error('SystemRoot must be an absolute resolved Windows path');
  }
  const registryExe = path.win32.join(systemRoot, 'System32', 'reg.exe');
  const result = run(registryExe, ['query', COMMON_APPDATA_KEY, '/v', 'Common AppData'], {
    encoding: 'utf8',
    windowsHide: true,
    env: {
      SystemRoot: systemRoot,
      PATH: env.PATH,
      PATHEXT: env.PATHEXT,
    },
  });
  if (result.error || result.signal || result.status !== 0 || typeof result.stdout !== 'string') {
    throw new Error('Canonical ProgramData registry lookup failed');
  }
  const matches = result.stdout.split(/\r?\n/)
    .map((line) => line.match(/^\s*Common AppData\s+REG_SZ\s+(.+?)\s*$/i))
    .filter(Boolean);
  if (matches.length !== 1) throw new Error('Canonical ProgramData registry value is unavailable');
  const registryPath = matches[0][1];
  if (!path.win32.isAbsolute(registryPath) || registryPath.includes('%')) {
    throw new Error('ProgramData registry value is not a resolved absolute path');
  }
  const canonicalPath = realpath(registryPath);
  if (!path.win32.isAbsolute(canonicalPath) || canonicalPath.includes('%') || !stat(canonicalPath).isDirectory()) {
    throw new Error('ProgramData canonical directory is invalid');
  }
  return canonicalPath;
}

export function powerShellChildEnv(source, canonicalProgramData) {
  if (typeof canonicalProgramData !== 'string' ||
      !path.win32.isAbsolute(canonicalProgramData) || canonicalProgramData.includes('%')) {
    throw new Error('PowerShell ProgramData must be a resolved absolute path');
  }
  const child = Object.fromEntries(Object.entries(source)
    .filter(([name]) => name.toLowerCase() !== 'programdata'));
  child.ProgramData = canonicalProgramData;
  return child;
}

export function runPowerShellPortPreflight({
  source = process.env,
  scriptPath,
  args = [],
  resolve = resolveCanonicalProgramData,
  run = spawnSync,
  warn = console.warn,
} = {}) {
  let childEnv;
  try {
    childEnv = powerShellChildEnv(source, resolve({ env: source }));
  } catch {
    warn('gate-preflight: local port preflight could not be prepared; skipped.');
    return 0;
  }

  const result = run(
    'powershell',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, ...args],
    { stdio: 'inherit', env: childEnv },
  );
  if (result.error) {
    // A missing interpreter cannot check the port. Preserve the existing
    // startup-unavailable disposition without exposing a child error message.
    warn('gate-preflight: could not run the PowerShell preflight; continuing.');
    return 0;
  }
  // A signal death has no numeric status; it must not become success.
  if (result.signal) {
    warn('gate-preflight: preflight terminated by a signal; treating the port as unverified.');
    return 1;
  }
  return result.status ?? 0;
}
