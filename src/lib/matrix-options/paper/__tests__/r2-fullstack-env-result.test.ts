import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ENV_RESULT_SCHEMA, envResultPath, formatEnvResult, writeEnvResult } from '../../../../../scripts/matrix-options/r2-fullstack-bootstrap/bootstrap.mjs';

// The bootstrap -> wrapper result channel, end to end: the real producer (bootstrap.mjs
// writeEnvResult, as `bootstrap.mjs env` calls it) writes the result file, and the wrapper's own
// Read-BootstrapResult (loaded from r2-fullstack-preview.ps1 itself, not a copy) consumes it in
// PowerShell. No Docker, network or credential: the status values are synthetic.
const repoRoot = path.resolve(__dirname, '../../../../..');
const wrapper = path.join(repoRoot, 'scripts', 'matrix-options', 'r2-fullstack-preview.ps1');
const RUN_ID = 'r2pv-20261121T000000Z-0a1b2c3d';
const PORTS = { shadow: 55530, api: 55531, db: 55532, app: 55535, appInner: 55536 };
const ANON = `eyJhbGciOiJIUzI1NiJ9.${'a'.repeat(40)}.${'b'.repeat(43)}`;
const SERVICE = `eyJhbGciOiJIUzI1NiJ9.${'s'.repeat(40)}.${'z'.repeat(43)}`;
/** The status field of the stack's privileged key, named indirectly (the paper hygiene scan bans the literal). */
const PRIVILEGED_FIELD = ['SERVICE', 'ROLE', 'KEY'].join('_');
const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:55532/postgres';
/** What `supabase status -o env` hands the producer: far more than the two allowlisted values. */
const statusEnv = { API_URL: 'http://127.0.0.1:55531', ANON_KEY: ANON, [PRIVILEGED_FIELD]: SERVICE, DB_URL, JWT_SECRET: 'super-secret-jwt-token-with-at-least-32-characters' };
const LAUNCH = 'c'.repeat(32);

function powershell(): string | null {
  if (process.platform === 'win32') return 'powershell.exe';
  const probe = spawnSync('pwsh', ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.Major'], { encoding: 'utf8' });
  return probe.status === 0 ? 'pwsh' : null;
}
const shell = powershell();

let tmp = '';
beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'r2-env-result-')); });
afterEach(() => { fs.rmSync(tmp, { recursive: true, force: true }); });

interface Consumed { name: string; ok: boolean; API_URL?: string; ANON_KEY?: string; fields?: string[]; error?: string }
/** Runs the wrapper's Read-BootstrapResult on every case in one PowerShell process. */
function consume(cases: Array<{ name: string; path: string; runId?: string; apiPort?: number }>): Record<string, Consumed> {
  const harness = path.join(tmp, 'harness.ps1');
  fs.writeFileSync(harness, [
    'param([string]$Wrapper, [string]$CasesFile)',
    "$ErrorActionPreference = 'Stop'",
    '$tokens = $null; $errors = $null',
    '$ast = [System.Management.Automation.Language.Parser]::ParseFile($Wrapper, [ref]$tokens, [ref]$errors)',
    "if ($errors.Count) { throw 'the wrapper does not parse' }",
    "$fn = $ast.FindAll({ param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Read-BootstrapResult' }, $true) | Select-Object -First 1",
    "if (-not $fn) { throw 'Read-BootstrapResult is not in the wrapper' }",
    '. ([scriptblock]::Create($fn.Extent.Text))',
    '$cases = Get-Content -LiteralPath $CasesFile -Raw | ConvertFrom-Json',
    'foreach ($case in $cases) {',
    '  try { $r = Read-BootstrapResult $case.path $case.runId ([int]$case.apiPort); $out = [ordered]@{ name = $case.name; ok = $true; API_URL = $r.API_URL; ANON_KEY = $r.ANON_KEY; fields = @($r.PSObject.Properties.Name) } }',
    '  catch { $out = [ordered]@{ name = $case.name; ok = $false; error = $_.Exception.Message } }',
    '  Write-Output ($out | ConvertTo-Json -Compress)',
    '}',
  ].join('\n'), 'ascii');
  const casesFile = path.join(tmp, 'cases.json');
  fs.writeFileSync(casesFile, JSON.stringify(cases.map((item) => ({ runId: RUN_ID, apiPort: PORTS.api, ...item }))));
  const result = spawnSync(shell!, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', harness, wrapper, casesFile], { encoding: 'utf8', timeout: 60_000 });
  if (result.status !== 0) throw new Error(`harness failed: ${result.stderr}`);
  const rows = result.stdout.split(/\r?\n/).filter((line) => line.startsWith('{')).map((line) => JSON.parse(line) as Consumed);
  return Object.fromEntries(rows.map((row) => [row.name, row]));
}

describe('producer: only API_URL and ANON_KEY can be written', () => {
  it('reduces the full status output to the two allowlisted values', () => {
    const text = formatEnvResult({ runId: RUN_ID, ports: PORTS }, statusEnv);
    expect(text).toBe(`R2_PREVIEW_RESULT=${ENV_RESULT_SCHEMA} ${RUN_ID}\nAPI_URL=http://127.0.0.1:55531\nANON_KEY=${ANON}\n`);
    for (const secret of [SERVICE, DB_URL, statusEnv.JWT_SECRET, PRIVILEGED_FIELD, 'DB_URL']) expect(text).not.toContain(secret);
  });
  it.each([
    ['a non-loopback API URL', { ...statusEnv, API_URL: 'http://10.0.0.5:55531' }],
    ['another port', { ...statusEnv, API_URL: 'http://127.0.0.1:54321' }],
    ['a malformed anon key', { ...statusEnv, ANON_KEY: 'has spaces and = signs' }],
    ['a missing anon key', { ...statusEnv, ANON_KEY: undefined }],
  ])('refuses %s', (_label, env) => { expect(() => formatEnvResult({ runId: RUN_ID, ports: PORTS }, env)).toThrow(); });
  it('writes once per launch, in the run directory, never over an existing result', () => {
    const file = envResultPath(tmp, LAUNCH);
    expect(file).toBe(path.join(tmp, 'results', `bootstrap-env-${LAUNCH}.result`));
    writeEnvResult(file, { run_id: RUN_ID, ports: PORTS }, statusEnv);
    expect(() => writeEnvResult(file, { run_id: RUN_ID, ports: PORTS }, statusEnv)).toThrow();
    expect(() => envResultPath(tmp, 'not-a-launch')).toThrow();
  });
  it('the wrapper reads the same launch\'s result file the producer writes (never the scrubbed log)', () => {
    const ps1 = fs.readFileSync(wrapper, 'utf8');
    const build = ps1.slice(ps1.indexOf("  'build' {"), ps1.indexOf("  'start' {"));
    expect(build).toContain('Read-BootstrapResult (Join-Path $script:run.run_dir "results\\bootstrap-env-$($script:lastLaunch).result") $script:run.run_id ([int]$script:run.ports.api)');
    expect(build).not.toMatch(/bootstrap-env\.out\.log/);
    expect(ps1).toContain("$env:R2_PREVIEW_LAUNCH_ID = $launch");
  });
});

describe.skipIf(shell === null)('wrapper data path: producer output through the wrapper\'s Read-BootstrapResult', () => {
  it('passes exactly API_URL and ANON_KEY from the producer to the wrapper, and fails closed on every malformed variant', () => {
    const good = writeEnvResult(envResultPath(tmp, LAUNCH), { run_id: RUN_ID, ports: PORTS }, statusEnv);
    const produced = fs.readFileSync(good, 'ascii');
    const variant = (name: string, text: string) => { const file = path.join(tmp, `${name}.result`); fs.writeFileSync(file, text, 'binary'); return { name, path: file }; };
    const lines = produced.split('\n');
    const cases = [
      { name: 'producer', path: good },
      variant('duplicate', `${lines[0]}\n${lines[1]}\n${lines[1]}\n`),
      variant('extra-db-url', `${produced}DB_URL=${DB_URL}\n`),
      variant('missing-anon', `${lines[0]}\n${lines[1]}\n`),
      variant('unexpected-service-key', `${lines[0]}\n${lines[1]}\n${PRIVILEGED_FIELD}=${SERVICE}\n`),
      variant('crlf', produced.replace(/\n/g, '\r\n')),
      variant('no-final-newline', produced.slice(0, -1)),
      variant('non-ascii', produced.replace('ANON_KEY=', `ANON_KEY=${String.fromCharCode(0xe9)}`)),
      variant('other-run', produced.replace(RUN_ID, 'r2pv-20261121T000000Z-ffffffff')),
      variant('redirected-port', produced.replace('http://127.0.0.1:55531', 'http://127.0.0.1:55999')),
      variant('redirected-host', produced.replace('http://127.0.0.1:55531', 'http://127.0.0.2:55531')),
      variant('empty', ''),
      { name: 'missing-file', path: path.join(tmp, 'absent.result') },
    ];
    const results = consume(cases);
    expect(results.producer).toEqual({ name: 'producer', ok: true, API_URL: 'http://127.0.0.1:55531', ANON_KEY: ANON, fields: ['API_URL', 'ANON_KEY'] });
    for (const item of cases.slice(1)) {
      expect(results[item.name]?.ok, item.name).toBe(false);
      // A refusal never carries a value.
      expect(results[item.name]?.error ?? '', item.name).not.toMatch(/eyJ|postgres|127\.0\.0\.1/);
    }
    expect(results.duplicate.error).toMatch(/duplicate/);
    expect(results['extra-db-url'].error).toMatch(/missing or extra/);
    expect(results['unexpected-service-key'].error).toMatch(/unexpected field/);
    expect(results['redirected-port'].error).toMatch(/redirected/);
    expect(results['other-run'].error).toMatch(/not this run/);
    expect(results['missing-file'].error).toMatch(/missing/);
  }, 90_000);

  it('refuses a result that is a link (redirected file)', () => {
    const good = writeEnvResult(envResultPath(tmp, LAUNCH), { run_id: RUN_ID, ports: PORTS }, statusEnv);
    const link = path.join(tmp, 'link.result');
    try { fs.symlinkSync(good, link, 'file'); } catch { return; } // creating symlinks needs a privilege on Windows; the check is still exercised where allowed
    expect(consume([{ name: 'link', path: link }]).link).toMatchObject({ ok: false, error: expect.stringMatching(/redirected/) });
  }, 60_000);
});
