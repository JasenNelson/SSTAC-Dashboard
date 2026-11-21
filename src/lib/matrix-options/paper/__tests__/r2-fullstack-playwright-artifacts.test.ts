import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// The trusted local preview must never write Playwright's error-context.md (the failed page's
// accessibility snapshot, which can carry reviewer text or sign-in form state). Playwright is NOT
// run here: the config is loaded as the runner would load it, and the installed Playwright's own
// artifacts recorder (extracted from node_modules, not re-implemented) is driven with a synthetic
// failing test and a fake page, to prove which conditions create the prohibited artifact.
const repoRoot = path.resolve(__dirname, '../../../../..');
const playwrightLib = path.join(repoRoot, 'node_modules', 'playwright', 'lib', 'index.js');
const read = (relative: string) => fs.readFileSync(path.join(repoRoot, relative), 'utf8');

/** The installed ArtifactsRecorder class source (the code that writes error-context.md). */
function recorderSource(): string {
  const source = fs.readFileSync(playwrightLib, 'utf8');
  const start = source.indexOf('class ArtifactsRecorder {');
  if (start < 0) throw new Error('ArtifactsRecorder not found in the installed Playwright');
  const end = source.indexOf('\n}\n', start);
  return source.slice(start, end + 2);
}

/** Runs one synthetic failing test through the real recorder; returns the files it wrote. */
async function failingTestArtifacts(env: Record<string, string | undefined>, outputDir: string) {
  class SnapshotRecorderStub { fixOrdinal() {} async captureTemporary() {} async persistTemporary() {} async maybeCapture() {} }
  const sandbox = { import_fs: { default: fs }, process: { env }, SnapshotRecorder: SnapshotRecorderStub, normalizeScreenshotMode: () => 'off', kTracingStarted: Symbol('tracing'), Symbol, Promise, Array, Object, Error };
  const ArtifactsRecorder = vm.runInNewContext(`${recorderSource()}\nArtifactsRecorder`, sandbox) as new (playwright: unknown, dir: string, screenshot: string) => {
    _testInfo: unknown; _stopTracing: () => Promise<void>; willCloseBrowserContext(context: unknown): Promise<void>; didFinishTest(): Promise<void>;
  };
  const attachments: Array<{ name: string; path: string }> = [];
  const page = { _wrapApiCall: async (fn: () => Promise<unknown>) => fn(), _snapshotForAI: async () => '- textbox "Rationale": Private reviewer text' };
  const context = { pages: () => [page], tracing: {} };
  const playwright = { _allContexts: () => [context], request: { _contexts: new Set() } };
  const recorder = new ArtifactsRecorder(playwright, outputDir, 'off');
  recorder._testInfo = { errors: [{ message: 'synthetic failure' }], attachments, outputPath: (name: string) => path.join(outputDir, name), _attach: (attachment: { name: string; path: string }) => attachments.push(attachment) };
  recorder._stopTracing = async () => {};
  await recorder.willCloseBrowserContext(context);
  await recorder.didFinishTest();
  return { files: fs.readdirSync(outputDir), attachments: attachments.map((item) => item.name) };
}

let tmp = '';
const saved = { base: process.env.R2_FULLSTACK_BASE_URL, prompt: process.env.PLAYWRIGHT_NO_COPY_PROMPT };
beforeEach(() => { tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'r2-pw-artifacts-')); });
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
  if (saved.base === undefined) delete process.env.R2_FULLSTACK_BASE_URL; else process.env.R2_FULLSTACK_BASE_URL = saved.base;
  if (saved.prompt === undefined) delete process.env.PLAYWRIGHT_NO_COPY_PROMPT; else process.env.PLAYWRIGHT_NO_COPY_PROMPT = saved.prompt;
});

describe('Playwright error-context capture is disabled for the trusted preview', () => {
  it('the installed Playwright gates error-context.md on PLAYWRIGHT_NO_COPY_PROMPT (pins the mechanism)', () => {
    const source = recorderSource();
    expect(source).toContain('if (process.env.PLAYWRIGHT_NO_COPY_PROMPT)');
    expect(source).toContain('this._testInfo.outputPath("error-context.md")');
  });

  it('two-sided: a synthetic failing test writes error-context.md without the switch', async () => {
    const result = await failingTestArtifacts({}, tmp);
    expect(result.files).toEqual(['error-context.md']);
    expect(result.attachments).toEqual(['error-context']);
    expect(fs.readFileSync(path.join(tmp, 'error-context.md'), 'utf8')).toContain('Private reviewer text');
  });

  it('the effective config sets the switch, and then the same failing test creates no context artifact', async () => {
    delete process.env.PLAYWRIGHT_NO_COPY_PROMPT;
    process.env.R2_FULLSTACK_BASE_URL = 'http://127.0.0.1:55535';
    const config = (await import('../../../../../playwright.r2-fullstack.config')).default as { use?: Record<string, unknown>; workers?: number; retries?: number };
    expect(process.env.PLAYWRIGHT_NO_COPY_PROMPT).toBe('1');
    expect(config.use).toMatchObject({ trace: 'off', screenshot: 'off', video: 'off', baseURL: 'http://127.0.0.1:55535' });
    expect(config).toMatchObject({ workers: 1, retries: 0 });
    // The worker inherits the runner's environment; the recorder reads it there.
    const result = await failingTestArtifacts(process.env, tmp);
    expect(result).toEqual({ files: [], attachments: [] });
  });

  it('the worker sets and asserts the switch itself, and the wrapper sets it for the journey', () => {
    const spec = read('e2e/matrix-options-paper-r2-fullstack.spec.ts');
    expect(spec.indexOf("process.env.PLAYWRIGHT_NO_COPY_PROMPT = '1';")).toBeGreaterThan(-1);
    expect(spec.indexOf("process.env.PLAYWRIGHT_NO_COPY_PROMPT = '1';")).toBeLessThan(spec.indexOf('test('));
    expect(spec).toContain("expect(process.env.PLAYWRIGHT_NO_COPY_PROMPT, 'error-context capture must be disabled in this worker').toBe('1');");
    const ps1 = read('scripts/matrix-options/r2-fullstack-preview.ps1');
    const accept = ps1.slice(ps1.indexOf("  'accept' {"));
    expect(accept.indexOf("$env:PLAYWRIGHT_NO_COPY_PROMPT = '1'")).toBeGreaterThan(-1);
    expect(accept.indexOf("$env:PLAYWRIGHT_NO_COPY_PROMPT = '1'")).toBeLessThan(accept.indexOf("Invoke-Bounded 'journey'"));
  });
});
