import { test, expect, type Browser, type BrowserContext, type Page, type Response } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
// Isomorphic contract modules (no server-only import), so the expected identity is COMPUTED from
// the same code the deployed app uses, not typed by hand. See computeExpectedIdentity() below.
import { sha256Object } from '../src/lib/matrix-options/paper/contracts';
import { getPaperRelease } from '../src/lib/matrix-options/paper/releases';
import { getReviewerGuideBinding } from '../src/lib/matrix-options/reviewer-guide';
import { getCohortManifest } from '../src/lib/matrix-options/cohort-contract';

/*
 * Production canary: Matrix Options paper v0.9.91 review workflow.
 * Package manifest (the approved scope of this run): e2e/canary/CANARY_PACKAGE.md.
 * Config: playwright.paper-canary.config.ts (the ONLY config that matches this file).
 *
 * Fail-closed: every required input is checked BEFORE any request is made; a missing input
 * throws (it never skips). Positive write journeys run through the production UI panel. The run is single-shot: a marker file is created before the first
 * write and a second run for the same runId refuses to start. Credentials and session tokens
 * are held in memory only and are never logged or written. All output goes to the private,
 * gitignored .tmp/canary-output/ tree.
 */

// Fixed in CANARY_PACKAGE.md. The env value must equal this constant.
const RUN_ID = 'canary-20261014-2849';
const SYNTHETIC_BASE = `CANARY ${RUN_ID} synthetic test text - not a review response`;

// Identity of the v0.9.91 review release. The manifest sha is the review-manifest digest of
// getReviewManifest('v0.9.91'); it is COMPUTED below with the same steps as
// src/lib/matrix-options/paper/review-manifest.ts (that module imports server-only and cannot be
// loaded here) and cross-checked against this pinned literal, so drift in either fails closed
// when the spec is loaded, before any request.
const DOCUMENT_VERSION = 'v0.9.91';
const PINNED_MANIFEST_SHA256 = '6d336b08b7214a17456ff943eb6f56f33e90d3477f4bd9fe1488c5fe0846a272';

interface ExpectedSeedRow { cohort_id: string; question_id: string; question_number: number }

function computeExpectedIdentity(): { manifestSha256: string; seedRows: ExpectedSeedRow[] } {
  const release = getPaperRelease(DOCUMENT_VERSION);
  if (!release) throw new Error(`Canary refused: unknown paper release ${DOCUMENT_VERSION}.`);
  const guide = getReviewerGuideBinding(release.documentVersion);
  const cohorts = getCohortManifest(release.documentVersion);
  const questionByNumber = new Map(guide.questions.map((question) => [question.number, question.id]));
  const cohortQuestionIds = Object.fromEntries(cohorts.cohorts.map((cohort) => [
    cohort.id,
    cohort.questionNumbers.map((number) => questionByNumber.get(number)).filter((id): id is string => Boolean(id)),
  ]));
  const identity = {
    schemaVersion: 'matrix-paper-review-manifest-v1',
    documentVersion: release.documentVersion,
    paperSha256: release.sha256,
    reviewerGuideReleaseIdentity: guide.releaseIdentity,
    cohortsReleaseIdentity: cohorts.releaseIdentity,
    reviewerGuideSha256: sha256Object(guide),
    cohortsSha256: sha256Object(cohorts),
    questionIds: guide.questions.map((question) => question.id),
    cohortQuestionIds,
  };
  const numberById = new Map(guide.questions.map((question) => [question.id, question.number]));
  const seedRows: ExpectedSeedRow[] = [];
  for (const [cohortId, ids] of Object.entries(cohortQuestionIds)) {
    for (const id of ids) seedRows.push({ cohort_id: cohortId, question_id: id, question_number: numberById.get(id) ?? -1 });
  }
  return { manifestSha256: sha256Object(identity), seedRows };
}

const EXPECTED = computeExpectedIdentity();
const EXPECTED_MANIFEST_SHA256 = EXPECTED.manifestSha256;
if (EXPECTED_MANIFEST_SHA256 !== PINNED_MANIFEST_SHA256) {
  throw new Error('Canary refused: the computed review manifest sha does not equal the pinned sha.');
}
if (EXPECTED.seedRows.length !== 12 || EXPECTED.seedRows.some((row) => row.question_number < 1)) {
  throw new Error('Canary refused: the computed v0.9.91 seed is not exactly 12 numbered questions.');
}
const CANARY_QUESTION_ID = 'rpq:v0.9.91:q01';
const CANARY_COHORT_ID = 'categories';

// Containment: probe writes use only this synthetic scope (never a canonical seed or real row).
const PROBE_DOCUMENT_VERSION = `canary-${RUN_ID}`;
const PROBE_QUESTION_ID = `canary-${RUN_ID}-probe`;
const ZERO_SHA = '0'.repeat(64);
const PROBE_EVENT_RESPONSE_ID = '00000000-0000-4000-8000-000000000000';

const TABLES = ['matrix_paper_review_questions', 'matrix_paper_review_responses', 'matrix_paper_review_response_events'] as const;
const RPCS = ['matrix_paper_review_save_draft', 'matrix_paper_review_submit'] as const;

// Artifact root is bound to THIS spec file's location, never to process.cwd(). assertApprovedRoot()
// (run first in beforeAll) requires it to equal the approved worktree, git's toplevel for it, and cwd.
const APPROVED_ROOT = 'C:\\Projects\\SSTAC-Dashboard-worktrees\\matrix-v0991-review-activation';
const REPO_ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(REPO_ROOT, '.tmp', 'canary-output');
const MARKER_FILE = path.join(OUT_DIR, `${RUN_ID}.started`);
const RESULTS_FILE = path.join(OUT_DIR, `results-${RUN_ID}.json`);

type Result = { name: string; ok: boolean; httpStatus?: number; code?: string; note?: string };
const results: Result[] = [];

function record(name: string, ok: boolean, extra: Partial<Result> = {}): void {
  results.push({ name, ok, ...extra });
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') throw new Error(`Canary refused: required input ${name} is not set.`);
  return value;
}

function normPath(p: string): string {
  const n = path.resolve(p).replace(/\\/g, '/').replace(/\/+$/, '');
  return process.platform === 'win32' ? n.toLowerCase() : n;
}

function assertApprovedRoot(): void {
  const approved = normPath(APPROVED_ROOT);
  if (normPath(REPO_ROOT) !== approved) throw new Error('Canary refused: the spec file is not located in the approved worktree.');
  if (normPath(process.cwd()) !== approved) throw new Error('Canary refused: the working directory is not the approved worktree.');
  let top = '';
  try {
    top = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
  } catch { throw new Error('Canary refused: git toplevel could not be determined for the approved worktree.'); }
  if (normPath(top) !== approved) throw new Error('Canary refused: git toplevel does not equal the approved worktree.');
  try {
    execFileSync('git', ['check-ignore', '-q', '.tmp/canary-output'], { cwd: REPO_ROOT, stdio: 'ignore' });
  } catch { throw new Error('Canary refused: .tmp/canary-output is not gitignored.'); }
}

// Reparse-point guard: every existing component from the approved root down to `target` must be a
// real directory (lstat: no symlink / junction; Windows junctions report isSymbolicLink() true) whose
// real path equals the expected path (case-insensitive on Windows). Called before creating anything
// and again after directories are created (and again before the marker and results writes).
function assertNoReparse(target: string): void {
  const root = path.resolve(REPO_ROOT);
  const full = path.resolve(target);
  const rel = path.relative(root, full);
  if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('Canary refused: an artifact path is outside the approved root.');
  const parts = rel.split(path.sep).filter((seg) => seg !== '');
  const chain = [root, ...parts.map((_seg, i) => path.join(root, ...parts.slice(0, i + 1)))];
  for (const cur of chain) {
    let st: fs.Stats;
    try { st = fs.lstatSync(cur); } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw new Error('Canary refused: an artifact path component could not be inspected.');
    }
    if (st.isSymbolicLink()) throw new Error('Canary refused: an artifact path component is a symlink or junction.');
    if (!st.isDirectory()) throw new Error('Canary refused: an artifact path component is not a directory.');
    if (normPath(fs.realpathSync(cur)) !== normPath(cur)) throw new Error('Canary refused: an artifact path component resolves elsewhere (reparse point).');
  }
}

// Single-shot contract: one worker, no retries, no repeats (also refused at config load).
function assertSingleShot(testInfo: { retry: number; repeatEachIndex: number; project: { repeatEach: number; retries: number }; config: { workers: number } }): void {
  if (testInfo.project.repeatEach !== 1 || testInfo.repeatEachIndex !== 0) throw new Error('Canary refused: repeatEach must be 1.');
  if (testInfo.retry !== 0 || testInfo.project.retries !== 0) throw new Error('Canary refused: retries must be 0.');
  if (testInfo.config.workers !== 1) throw new Error('Canary refused: workers must be 1.');
}

// Reject output overrides (e.g. --output): project and test output dirs must be the config's
// private tree inside the approved root. Runs before any request.
function assertOutputContained(testInfo: { project: { outputDir: string }; outputDir: string }): void {
  const allowedRoot = normPath(OUT_DIR);
  const projectOut = normPath(testInfo.project.outputDir);
  const testOut = normPath(testInfo.outputDir);
  if (projectOut !== `${allowedRoot}/playwright`) throw new Error('Canary refused: project outputDir is not <approved root>/.tmp/canary-output/playwright (output override?).');
  if (!testOut.startsWith(`${allowedRoot}/`)) throw new Error('Canary refused: test outputDir is not inside <approved root>/.tmp/canary-output.');
  if (process.argv.some((arg) => arg === '--output' || arg.startsWith('--output='))) throw new Error('Canary refused: an --output override was supplied.');
}

const APPROVED_SUPABASE_URL = 'https://qyrhsieynzfgyuqzznap.supabase.co';
const APPROVED_SUPABASE_REF = 'qyrhsieynzfgyuqzznap';

// Classify the public key without ever printing it. Only a publishable key or an anon-role JWT
// for the approved project is accepted; a secret / service-role key is refused.
function assertPublicKey(key: string): void {
  if (key.startsWith('sb_secret_')) throw new Error('Canary refused: NEXT_PUBLIC_SUPABASE_ANON_KEY is a secret key.');
  if (key.startsWith('sb_publishable_')) return;
  const parts = key.split('.');
  if (parts.length === 3) {
    try {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as { role?: unknown; ref?: unknown };
      if (payload.role === 'anon' && payload.ref === APPROVED_SUPABASE_REF) return;
    } catch { /* falls through to refusal */ }
  }
  throw new Error('Canary refused: NEXT_PUBLIC_SUPABASE_ANON_KEY is not a publishable key or an anon-role key for the approved project.');
}

interface Credentials { email: string; password: string }
interface Inputs {
  baseUrl: string;
  supabaseUrl: string;
  anonKey: string;
  expectedSha: string;
  readerA: Credentials;
  readerB: Credentials;
  admin: Credentials;
}

function loadInputs(baseUrl: string): Inputs {
  if (requireEnv('CANARY_AUTHORIZED') !== 'yes') throw new Error('Canary refused: CANARY_AUTHORIZED must equal "yes".');
  if (requireEnv('CANARY_RUN_ID') !== RUN_ID) throw new Error('Canary refused: CANARY_RUN_ID does not equal the runId fixed in CANARY_PACKAGE.md.');
  const expectedSha = requireEnv('CANARY_EXPECTED_SHA');
  if (!/^[0-9a-f]{40}$/.test(expectedSha)) throw new Error('Canary refused: CANARY_EXPECTED_SHA must be a 40-hex commit sha.');
  if (baseUrl !== 'https://sstac-dashboard.vercel.app') throw new Error('Canary refused: baseURL is not the approved production target.');
  const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  if (supabaseUrl !== APPROVED_SUPABASE_URL) throw new Error('Canary refused: NEXT_PUBLIC_SUPABASE_URL is not the approved project URL.');
  const anonKey = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  assertPublicKey(anonKey);
  return {
    baseUrl,
    supabaseUrl,
    anonKey,
    expectedSha,
    readerA: { email: requireEnv('CANARY_READER_A_EMAIL'), password: requireEnv('CANARY_READER_A_PASSWORD') },
    readerB: { email: requireEnv('CANARY_READER_B_EMAIL'), password: requireEnv('CANARY_READER_B_PASSWORD') },
    admin: { email: requireEnv('CANARY_ADMIN_EMAIL'), password: requireEnv('CANARY_ADMIN_PASSWORD') },
  };
}

// Sign in through the real login form in a FRESH context (no storage state is ever written).
async function freshSignedInContext(browser: Browser, baseUrl: string, who: Credentials): Promise<BrowserContext> {
  const context = await browser.newContext({ baseURL: baseUrl });
  try {
  const page = await context.newPage();
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.locator('form[data-hydrated="true"]').waitFor({ state: 'attached', timeout: 30_000 });
  await page.locator('input#email').fill(who.email);
  await page.locator('input#password').fill(who.password);
  const [tokenResp] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/auth/v1/token') && r.request().method() === 'POST', { timeout: 30_000 }),
    page.locator('button[type="submit"]').click(),
  ]);
  if (tokenResp.status() !== 200) throw new Error(`Canary sign-in failed with status ${tokenResp.status()} (identity withheld).`);
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 });
  await page.close();
  return context;
  } catch (error) {
    await context.close().catch(() => undefined);
    throw error;
  }
}

// Direct Supabase auth token (password grant) for PostgREST probes. Kept in memory only.
async function passwordToken(inputs: Inputs, who: Credentials): Promise<{ accessToken: string; userId: string }> {
  const response = await fetch(`${inputs.supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: inputs.anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: who.email, password: who.password }),
  });
  if (response.status !== 200) throw new Error(`Canary token request failed with status ${response.status} (identity withheld).`);
  const json = (await response.json()) as { access_token?: string; user?: { id?: string; is_anonymous?: boolean } };
  if (!json.access_token || !json.user?.id) throw new Error('Canary token response was malformed.');
  if (json.user.is_anonymous) throw new Error('Canary refused: signed-in identity is anonymous.');
  return { accessToken: json.access_token, userId: json.user.id };
}

interface RestOutcome { status: number; code: string | undefined; body: unknown }
async function rest(inputs: Inputs, bearer: string, method: string, pathAndQuery: string, body?: unknown): Promise<RestOutcome> {
  const response = await fetch(`${inputs.supabaseUrl}/rest/v1/${pathAndQuery}`, {
    method,
    headers: {
      apikey: inputs.anonKey,
      Authorization: `Bearer ${bearer}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let parsed: unknown = text;
  try { parsed = text ? JSON.parse(text) : null; } catch { /* keep text */ }
  const code = parsed && typeof parsed === 'object' && 'code' in parsed ? String((parsed as { code: unknown }).code) : undefined;
  return { status: response.status, code, body: parsed };
}

interface ReviewRow { id?: string; revision: number; draft_text: string | null; submitted_text: string | null; submitted_revision: number | null; question_id: string }
interface Bootstrap { status: number; persistence?: string; userKey?: string; rows: ReviewRow[] }

async function bootstrap(context: BrowserContext, timeoutMs?: number): Promise<Bootstrap> {
  const response = await context.request.get(`/api/matrix-options/paper/reviews?documentVersion=${encodeURIComponent(DOCUMENT_VERSION)}&manifestSha256=${EXPECTED_MANIFEST_SHA256}`,
    timeoutMs === undefined ? undefined : { timeout: timeoutMs });
  const json = (await response.json().catch(() => ({}))) as { persistence?: string; userKey?: string; rows?: ReviewRow[] };
  return { status: response.status(), persistence: json.persistence, userKey: json.userKey, rows: json.rows ?? [] };
}

function canaryRow(rows: ReviewRow[]): ReviewRow | undefined {
  return rows.find((row) => row.question_id === CANARY_QUESTION_ID);
}

// ---- UI-journey helpers. Every PUT that a tracked UI page issues to the review route is counted at
// request time and its status recorded at response time; the journey asserts the exact totals.
const REVIEW_ROUTE_PREFIX = '/api/matrix-options/paper/reviews/';
let putRequests = 0;
const putStatuses: number[] = [];
let expectedPuts = 0;

function isReviewPut(method: string, url: string): boolean {
  return method === 'PUT' && new URL(url).pathname.startsWith(REVIEW_ROUTE_PREFIX);
}
function trackPuts(page: Page): void {
  page.on('request', (r) => { if (isReviewPut(r.method(), r.url())) putRequests += 1; });
  page.on('response', (r) => { if (isReviewPut(r.request().method(), r.url())) putStatuses.push(r.status()); });
}
function isCanaryPut(r: Response): boolean {
  return r.request().method() === 'PUT' && decodeURIComponent(new URL(r.url()).pathname) === `${REVIEW_ROUTE_PREFIX}${CANARY_QUESTION_ID}`;
}

// Open the v0.9.91 review panel on the canary question (same selectors as the local M3 journey).
async function openPanel(page: Page): Promise<void> {
  await page.goto(`/matrix-options/paper/publication/v/${encodeURIComponent(DOCUMENT_VERSION)}/questions/${encodeURIComponent(CANARY_QUESTION_ID)}`, { waitUntil: 'domcontentloaded' });
  const toggle = page.getByTestId('review-question-toggle-q1');
  await expect(toggle).toBeVisible({ timeout: 30_000 });
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true', { timeout: 10_000 });
  await expect(page.getByRole('textbox', { name: 'Your response' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('review-save-status')).not.toHaveText('Loading your saved responses...', { timeout: 30_000 });
  // Saving must be available BEFORE any text is typed: the Save draft button is disabled only for
  // non-available persistence or an open conflict. Fail here with a clear reason, before the first write.
  await expect(page.getByTestId('review-save-draft'), 'Canary refused: saving is not available in the panel (persistence unavailable, not provisioned, unauthenticated or conflict); no write was attempted.').toBeEnabled({ timeout: 10_000 });
}

test.describe.configure({ mode: 'serial', retries: 0 });

test.describe('paper review production canary', () => {
  let inputs: Inputs;
  let aId = '';
  let bId = '';

  // Results are written ONLY by a run that passed its pre-write gates (runStarted), with 'wx'.
  let runStarted = false;
  let deployedShaStart = '';
  const outcomes: Array<{ test: string; status: string; ok: boolean; reason?: string }> = [];
  const DECLARED_TESTS = 3;

  async function assertDeployed(label: string): Promise<string> {
    const health = await fetch(`${inputs.baseUrl}/api/health`, { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
    const healthJson = (await health.json().catch(() => ({}))) as { sha?: string; env?: string };
    if (health.status !== 200 || healthJson.sha !== inputs.expectedSha || healthJson.env !== 'production') {
      throw new Error(`Canary refused (${label}): deployed sha/env does not equal CANARY_EXPECTED_SHA / production. No further write was made.`);
    }
    record(`identity: deployed sha equals CANARY_EXPECTED_SHA and env is production (${label})`, true, { httpStatus: 200 });
    return healthJson.sha;
  }

  // One UI-driven write: pre-write sha gate, no stray PUT since the last write, then the trigger (a typed
  // edit that autosaves, or a button click) must produce exactly one canary PUT with the expected status
  // and outcome. The returned row is the server's row, for API-level revision assertions.
  async function uiWrite(page: Page, label: string, status: number, outcome: string, trigger: () => Promise<void>): Promise<{ row: ReviewRow | null }> {
    await assertDeployed(label);
    expect(putRequests, 'a stray PUT was issued before this write').toBe(expectedPuts);
    const responsePromise = page.waitForResponse(isCanaryPut, { timeout: 30_000 });
    await trigger();
    expectedPuts += 1;
    const response = await responsePromise;
    const json = (await response.json().catch(() => ({}))) as { outcome?: string; row?: ReviewRow | null };
    expect([response.status(), json.outcome]).toEqual([status, outcome]);
    expect(putRequests).toBe(expectedPuts);
    await expect(page.getByTestId('review-save-status')).not.toHaveText('Saving...', { timeout: 30_000 });
    return { row: json.row ?? null };
  }

  // Read-only identity preflight (no writes): three distinct non-anonymous users; admin loads the
  // admin review page, readers A and B are redirected to /dashboard. Contexts always closed.
  async function preflightIdentities(browser: Browser): Promise<void> {
    const who: Array<[string, Credentials, boolean]> = [
      ['reader A', inputs.readerA, false], ['reader B', inputs.readerB, false], ['admin', inputs.admin, true],
    ];
    const ids: string[] = [];
    for (const [label, creds, isAdmin] of who) {
      const token = await passwordToken(inputs, creds); // throws if not 200 or anonymous
      ids.push(token.userId);
      const context = await freshSignedInContext(browser, inputs.baseUrl, creds);
      try {
        const page = await context.newPage();
        const response = await page.goto('/admin/matrix-options-paper-reviews', { waitUntil: 'domcontentloaded' });
        if (isAdmin) {
          if (response?.status() !== 200) throw new Error(`Canary refused: admin page did not load with 200 for ${label}.`);
          await page.getByRole('table', { name: 'Review responses' }).waitFor({ state: 'visible', timeout: 30_000 });
        } else {
          await page.waitForURL((url) => url.pathname === '/dashboard', { timeout: 30_000 }).catch(() => {
            throw new Error(`Canary refused: ${label} was not redirected to /dashboard from the admin page.`);
          });
        }
        await page.close();
      } finally { await context.close().catch(() => undefined); }
    }
    if (new Set(ids).size !== 3) throw new Error('Canary refused: reader A, reader B and admin are not three distinct users.');
  }

  // Plan s5 step 9 schema-cache convergence: reader A's authenticated review GET (v0.9.91 under the
  // pinned manifest sha) must return persistence 'available'. Bounded poll: every 5 s, max 60 s in
  // total. On failure the run STOPS here, before the marker is written (no runId is burned).
  async function waitForPersistenceAvailable(browser: Browser): Promise<void> {
    const deadline = Date.now() + 60_000;
    const context = await freshSignedInContext(browser, inputs.baseUrl, inputs.readerA);
    try {
      for (;;) {
        const remaining = Math.max(1, deadline - Date.now());
        const boot = await bootstrap(context, remaining).catch(() => ({ status: 0, persistence: undefined } as Bootstrap));
        if (boot.status === 200 && boot.persistence === 'available') return;
        if (Date.now() + 5_000 > deadline) {
          throw new Error('Canary refused: reader A review GET did not report persistence available within 60 s. No marker written; runId not burned.');
        }
        await new Promise((resolve) => setTimeout(resolve, 5_000));
      }
    } finally { await context.close().catch(() => undefined); }
  }

  test.beforeAll(async ({ browser }, testInfo) => {
    // 0. Artifact root / worktree binding: before anything else, including env inspection.
    assertApprovedRoot();
    assertSingleShot(testInfo);
    if (!String(testInfo.config.configFile ?? '').replace(/[\\]/g, '/').endsWith('/playwright.paper-canary.config.ts')) {
      throw new Error('Canary refused: the spec is not running under playwright.paper-canary.config.ts.');
    }
    // 1. Inputs first: nothing below runs, and no request is made, if any is missing or wrong.
    inputs = loadInputs(String(testInfo.project.use.baseURL ?? ''));
    assertNoReparse(path.join(OUT_DIR, 'playwright'));
    fs.mkdirSync(OUT_DIR, { recursive: true });
    assertNoReparse(path.join(OUT_DIR, 'playwright'));
    assertNoReparse(OUT_DIR);
    // 2. Single-run guard (a refused run never touches the first run's evidence).
    if (fs.existsSync(MARKER_FILE) || fs.existsSync(RESULTS_FILE)) {
      throw new Error(`Canary refused: ${RUN_ID} has already been started. The canary runs once; a new run needs a new approved package.`);
    }
    // 2b. Output containment (before any network request): no --output style override may relocate artifacts.
    assertOutputContained(testInfo);
    // 3. Pre-write identity gate: the deployed sha must equal the approved sha, env production.
    deployedShaStart = await assertDeployed('before first write');
    // 4. Read-only identity preflight, then readiness poll, then (only then) mark the run started.
    await preflightIdentities(browser);
    await waitForPersistenceAvailable(browser);
    assertNoReparse(path.join(OUT_DIR, 'playwright'));
    fs.writeFileSync(MARKER_FILE, `${new Date().toISOString()}
`, { flag: 'wx' });
    runStarted = true;
  });

  test.afterEach(async ({}, testInfo) => {
    if (!runStarted) return;
    const ok = testInfo.status === testInfo.expectedStatus;
    // Short failure reason: first line of the error message only (never credentials or tokens).
    const reason = ok ? undefined : String(testInfo.error?.message ?? 'unknown').split('\n')[0].slice(0, 300);
    outcomes.push({ test: testInfo.title, status: testInfo.status ?? 'unknown', ok, ...(reason === undefined ? {} : { reason }) });
  });

  test.afterAll(async () => {
    if (!runStarted) return;
    let deployedShaEnd = 'unavailable';
    let finalOk = false;
    try {
      const health = await fetch(`${inputs.baseUrl}/api/health`, { cache: 'no-store', signal: AbortSignal.timeout(10_000) });
      const healthJson = (await health.json()) as { sha?: string; env?: string };
      deployedShaEnd = String(healthJson.sha ?? 'unknown');
      finalOk = health.status === 200 && healthJson.sha === inputs.expectedSha && healthJson.env === 'production';
    } catch { /* recorded as unavailable; finalOk stays false */ }
    record('identity: final deployed sha equals CANARY_EXPECTED_SHA and env is production (end of run)', finalOk, { note: finalOk ? undefined : 'final health check failed or sha/env mismatch' });
    const allOk = outcomes.length === DECLARED_TESTS && outcomes.every((o) => o.ok) && results.length > 0 && results.every((r) => r.ok) && finalOk;
    assertNoReparse(path.join(OUT_DIR, 'playwright'));
    fs.writeFileSync(RESULTS_FILE, JSON.stringify({
      runId: RUN_ID, finishedAt: new Date().toISOString(), allOk,
      expectedSha: inputs.expectedSha, deployedShaStart, deployedShaEnd,
      declaredTests: DECLARED_TESTS, outcomes, results,
    }, null, 2), { flag: 'wx' });
  });

  test('identity and positive journeys (reader A)', async ({ browser }) => {
    test.setTimeout(10 * 60_000);
    const a1 = await freshSignedInContext(browser, inputs.baseUrl, inputs.readerA);
    try {
      const boot = await bootstrap(a1);
      expect(boot.status).toBe(200);
      expect(boot.persistence).toBe('available');
      aId = String(boot.userKey);
      expect(aId).toMatch(/^[0-9a-f-]{36}$/);
      // Precondition: the managed reader has no prior row on the canary question, so counts are exact.
      expect(canaryRow(boot.rows)).toBeUndefined();
      record('identity: bootstrap available for v0.9.91 under the computed manifest sha', true, { httpStatus: 200 });

      // Identity vs the seed (read-only, reader A's own token): exactly the 12 computed
      // (cohort, question, number) rows for v0.9.91, all under the computed manifest sha.
      const authA = await passwordToken(inputs, inputs.readerA);
      expect(authA.userId).toBe(aId);
      const seed = await rest(inputs, authA.accessToken, 'GET',
        `matrix_paper_review_questions?select=document_version,manifest_sha256,cohort_id,question_id,question_number&document_version=eq.${encodeURIComponent(DOCUMENT_VERSION)}`);
      expect(seed.status).toBe(200);
      const seedRows = (Array.isArray(seed.body) ? seed.body : []) as Array<{ manifest_sha256: string; cohort_id: string; question_id: string; question_number: number }>;
      expect(seedRows).toHaveLength(12);
      expect(seedRows.every((row) => row.manifest_sha256 === EXPECTED_MANIFEST_SHA256)).toBe(true);
      const keyOf = (row: { cohort_id: string; question_id: string; question_number: number }) => `${row.cohort_id}|${row.question_id}|${row.question_number}`;
      expect(seedRows.map(keyOf).sort()).toEqual(EXPECTED.seedRows.map(keyOf).sort());
      expect(EXPECTED.seedRows.some((row) => row.cohort_id === CANARY_COHORT_ID && row.question_id === CANARY_QUESTION_ID)).toBe(true);
      record('identity: seed holds exactly the 12 computed v0.9.91 cohort/question rows under the computed manifest sha', true, { httpStatus: 200 });

      // Precondition: reader A has no events on the canary question, so the event count is exact.
      // Every response/event assertion is scoped to user id + document_version + pinned manifest sha + question id.
      const scope = `user_id=eq.${encodeURIComponent(aId)}&document_version=eq.${encodeURIComponent(DOCUMENT_VERSION)}&manifest_sha256=eq.${EXPECTED_MANIFEST_SHA256}&question_id=eq.${encodeURIComponent(CANARY_QUESTION_ID)}`;
      const respBefore = await rest(inputs, authA.accessToken, 'GET', `matrix_paper_review_responses?select=id&${scope}`);
      expect(respBefore.status).toBe(200);
      expect(Array.isArray(respBefore.body) ? respBefore.body.length : -1).toBe(0);
      const eventsBefore = await rest(inputs, authA.accessToken, 'GET', `matrix_paper_review_response_events?select=id&${scope}`);
      expect(eventsBefore.status).toBe(200);
      expect(Array.isArray(eventsBefore.body) ? eventsBefore.body.length : -1).toBe(0);

      // ---- Positive write journeys, driven THROUGH THE PRODUCTION UI (the deployed v0.9.91 review panel).
      // Every write below is one PUT issued by the page itself (autosave or a button). Each is preceded by
      // the deployed-sha gate; every PUT any UI page issues is counted (page.on('request')) and the count
      // must equal the expected write count exactly (no stray autosave). API-level row/event assertions stay.
      const pageA = await a1.newPage();
      trackPuts(pageA);
      await openPanel(pageA);
      const textareaA = pageA.getByRole('textbox', { name: 'Your response' });
      const statusA = pageA.getByTestId('review-save-status');

      // W1 type -> autosave -> 'Draft saved' (creates the row, revision 1).
      const w1 = await uiWrite(pageA, 'before W1 (UI autosave)', 200, 'ok', () => textareaA.fill(SYNTHETIC_BASE));
      expect(w1.row?.revision).toBe(1);
      await expect(statusA).toContainText(/Draft saved/, { timeout: 30_000 });
      record('journey (UI): type, autosave, Draft saved (W1)', true, { httpStatus: 200 });

      // Reload -> the textarea shows the saved text (no PUT may result).
      await pageA.reload({ waitUntil: 'domcontentloaded' });
      await openPanel(pageA);
      await expect(textareaA).toHaveValue(SYNTHETIC_BASE, { timeout: 30_000 });
      record('journey (UI): reload restores the draft text', true);

      // W2 edit via typing -> autosave (revision 2).
      const t1 = `${SYNTHETIC_BASE} edit-1`;
      const w2 = await uiWrite(pageA, 'before W2 (UI autosave)', 200, 'ok', () => textareaA.fill(t1));
      expect(w2.row?.revision).toBe(2);
      await expect(statusA).toContainText(/Draft saved/, { timeout: 30_000 });
      // W3 click 'Submit response' (revision 3).
      const w3 = await uiWrite(pageA, 'before W3 (UI submit)', 200, 'ok', () => pageA.getByRole('button', { name: 'Submit response', exact: true }).click());
      expect([w3.row?.revision, w3.row?.submitted_text]).toEqual([3, t1]);
      await expect(pageA.getByRole('button', { name: 'Re-submit response', exact: true })).toBeVisible({ timeout: 30_000 });
      // W4 edit -> draft autosave (revision 4; submitted text stays edit-1).
      const t2 = `${SYNTHETIC_BASE} edit-2`;
      const w4 = await uiWrite(pageA, 'before W4 (UI autosave)', 200, 'ok', () => textareaA.fill(t2));
      expect([w4.row?.revision, w4.row?.submitted_text]).toEqual([4, t1]);
      // W5 click Submit again (resubmit, revision 5).
      const w5 = await uiWrite(pageA, 'before W5 (UI resubmit)', 200, 'ok', () => pageA.getByRole('button', { name: 'Re-submit response', exact: true }).click());
      expect([w5.row?.revision, w5.row?.submitted_text]).toEqual([5, t2]);
      record('journey (UI): edit, submit, edit, resubmit (W2-W5)', true, { httpStatus: 200 });

      // API-level restoration in a FRESH authenticated context.
      const a3 = await freshSignedInContext(browser, inputs.baseUrl, inputs.readerA);
      try {
        const restored = canaryRow((await bootstrap(a3)).rows);
        expect(restored?.draft_text).toBe(t2);
        expect(restored?.submitted_text).toBe(t2);
        record('journey: restoration in a fresh authenticated context', true, { httpStatus: 200 });

        // UI restoration (read-only): open the v0.9.91 review panel on the canary question in this
        // fresh context and assert the textarea shows the saved text. Any PUT is aborted and counted.
        const uiPage = await a3.newPage();
        let putsAttempted = 0;
        await uiPage.route('**/api/matrix-options/paper/reviews/**', async (route) => {
          if (route.request().method() === 'PUT') { putsAttempted += 1; await route.abort(); return; }
          await route.continue();
        });
        await openPanel(uiPage);
        await expect(uiPage.getByTestId('review-comment-draft')).toHaveValue(t2, { timeout: 30_000 });
        // Bounded settle window (covers the 1.5 s autosave debounce), then assert zero PUTs.
        await uiPage.waitForTimeout(2_000);
        expect(putsAttempted).toBe(0);
        await uiPage.close();
        record('journey: UI restoration shows the saved text, zero PUTs', true);
      } finally { await a3.close(); }

      // Stale-revision conflicts between two contexts of reader A, both through the panel. Each path is
      // clicked exactly once:
      //  conflict 1 -> "Use saved": A2 (loaded at revision 5) types after A1 saved revision 6 -> its autosave
      //    PUT gets 409 + the saved row; the conflict UI is shown; A2 clicks 'Use saved' (no write);
      //  conflict 2 -> "Keep mine":  A1 saves revision 7; A2 types -> 409; A2 clicks 'Keep mine' -> PUT 200 (revision 8).
      const a2 = await freshSignedInContext(browser, inputs.baseUrl, inputs.readerA);
      try {
        const pageB = await a2.newPage();
        trackPuts(pageB);
        await openPanel(pageB);
        const textareaB = pageB.getByRole('textbox', { name: 'Your response' });
        await expect(textareaB).toHaveValue(t2, { timeout: 30_000 });

        const t3 = `${SYNTHETIC_BASE} edit-3`;
        const w6 = await uiWrite(pageA, 'before W6 (UI autosave, context A1)', 200, 'ok', () => textareaA.fill(t3));
        expect(w6.row?.revision).toBe(6);
        const stale1 = await uiWrite(pageB, 'before stale-1 (UI autosave, context A2)', 409, 'stale_revision', () => textareaB.fill(`${SYNTHETIC_BASE} stale-1`));
        expect(stale1.row?.draft_text).toBe(t3);
        await expect(pageB.getByTestId('review-conflict')).toBeVisible({ timeout: 30_000 });
        await expect(pageB.getByTestId('review-conflict')).toContainText(t3);
        await pageB.getByRole('button', { name: 'Use saved', exact: true }).click();
        await expect(textareaB).toHaveValue(t3, { timeout: 30_000 });
        await expect(pageB.getByTestId('review-conflict')).toBeHidden();
        record('journey (UI): stale-revision conflict, Use saved path', true, { httpStatus: 409, code: 'stale_revision' });

        const t4 = `${SYNTHETIC_BASE} edit-4`;
        const w7 = await uiWrite(pageA, 'before W7 (UI autosave, context A1)', 200, 'ok', () => textareaA.fill(t4));
        expect(w7.row?.revision).toBe(7);
        const stale2 = await uiWrite(pageB, 'before stale-2 (UI autosave, context A2)', 409, 'stale_revision', () => textareaB.fill(`${SYNTHETIC_BASE} keep-mine`));
        expect(stale2.row?.draft_text).toBe(t4);
        await expect(pageB.getByTestId('review-conflict')).toBeVisible({ timeout: 30_000 });
        const w8 = await uiWrite(pageB, 'before W8 (UI Keep mine, context A2)', 200, 'ok', () => pageB.getByRole('button', { name: 'Keep mine', exact: true }).click());
        expect([w8.row?.revision, w8.row?.draft_text]).toEqual([8, `${SYNTHETIC_BASE} keep-mine`]);
        await expect(pageB.getByTestId('review-conflict')).toBeHidden({ timeout: 30_000 });
        record('journey (UI): stale-revision conflict (409), Keep mine path ends in PUT 200 (W8)', true, { httpStatus: 200, note: 'stale-2 was 409 stale_revision; Keep mine re-based and the final PUT returned 200' });
      } finally { await a2.close(); }

      // No stray autosave: after a settle window the page-issued PUT count and statuses are EXACT:
      // 8 successful writes (W1-W8) + 2 stale-revision 409s = 10 PUTs.
      await pageA.waitForTimeout(3_000);
      expect(putRequests).toBe(10);
      expect(putStatuses).toEqual([200, 200, 200, 200, 200, 200, 409, 200, 409, 200]);
      record('journey (UI): exactly 10 PUTs issued by the panels (8 writes + 2 stale 409s), no stray autosave', true);

      // Closing read-only checks: final row, and exactly 8 events (one per W1-W8; stale attempts none).
      const finalRow = canaryRow((await bootstrap(a1)).rows);
      expect(finalRow?.revision).toBe(8);
      expect(finalRow?.submitted_revision).toBe(5);
      expect(finalRow?.draft_text).toBe(`${SYNTHETIC_BASE} keep-mine`);
      expect(finalRow?.submitted_text).toBe(t2);
      const respAfter = await rest(inputs, authA.accessToken, 'GET', `matrix_paper_review_responses?select=id&${scope}`);
      expect(respAfter.status).toBe(200);
      const respRows = (Array.isArray(respAfter.body) ? respAfter.body : []) as Array<{ id: string }>;
      expect(respRows).toHaveLength(1);
      const createdId = respRows[0].id;
      if (w1.row?.id) expect(createdId).toBe(w1.row.id);
      const events = await rest(inputs, authA.accessToken, 'GET', `matrix_paper_review_response_events?select=action,revision,response_id&order=revision.asc&${scope}`);
      expect(events.status).toBe(200);
      const eventRows = (Array.isArray(events.body) ? events.body : []) as Array<{ action: string; revision: number; response_id: string }>;
      expect(eventRows.every((e) => e.response_id === createdId)).toBe(true);
      expect(eventRows.map((e) => `${e.revision}:${e.action}`)).toEqual([
        '1:save-draft', '2:save-draft', '3:submit', '4:save-draft', '5:submit', '6:save-draft', '7:save-draft', '8:save-draft',
      ]);
      record('journey: final row revision 8 / submitted_revision 5 and exactly 8 events (W1-W8)', true, { httpStatus: 200 });
    } finally { await a1.close(); }
  });

  test('admin page and CSV export show reader A row', async ({ browser }) => {
    expect(aId).not.toBe('');
    const admin = await freshSignedInContext(browser, inputs.baseUrl, inputs.admin);
    try {
      const filter = `userId=${encodeURIComponent(aId)}&questionId=${encodeURIComponent(CANARY_QUESTION_ID)}`;
      const page = await admin.newPage();
      await page.goto(`/admin/matrix-options-paper-reviews?${filter}`, { waitUntil: 'domcontentloaded' });
      // The page has two <main> elements (layout + client); target the uniquely named table.
      const table = page.getByRole('table', { name: 'Review responses' });
      await expect(table).toBeVisible({ timeout: 30_000 });
      const rows = table.locator('tbody tr');
      await expect(rows).toHaveCount(1);
      await expect(rows.first()).toContainText(aId);
      await expect(rows.first()).toContainText(CANARY_QUESTION_ID);
      await expect(rows.first()).toContainText(`${SYNTHETIC_BASE} keep-mine`);
      await expect(rows.first()).toContainText(`${SYNTHETIC_BASE} edit-2`);
      record('journey: admin page shows reader A row', true, { httpStatus: 200 });
      await page.close();

      const csv = await admin.request.get(`/api/matrix-options/paper/reviews/export?${filter}`);
      expect(csv.status()).toBe(200);
      const csvText = await csv.text();
      expect(csvText).toContain(RUN_ID);
      expect(csvText).toContain(aId);
      record('journey: CSV export contains reader A row', true, { httpStatus: 200 });
    } finally { await admin.close(); }
  });

  test('negative probes', async ({ browser }) => {
    expect(aId).not.toBe('');
    await assertDeployed('before negative probes (write-capable if grants were broken)');
    const authB = await passwordToken(inputs, inputs.readerB);
    const tokenB = authB.accessToken;
    bId = authB.userId;
    expect(bId).not.toBe(aId);

    const insertBody: Record<(typeof TABLES)[number], (userId: string) => Record<string, unknown>> = {
      matrix_paper_review_questions: () => ({ document_version: PROBE_DOCUMENT_VERSION, manifest_sha256: ZERO_SHA, cohort_id: 'canary', question_id: PROBE_QUESTION_ID, question_number: 9999 }),
      matrix_paper_review_responses: (userId) => ({ user_id: userId, document_version: PROBE_DOCUMENT_VERSION, manifest_sha256: ZERO_SHA, cohort_id: 'canary', question_id: PROBE_QUESTION_ID, draft_text: 'canary probe' }),
      matrix_paper_review_response_events: (userId) => ({ response_id: PROBE_EVENT_RESPONSE_ID, user_id: userId, document_version: PROBE_DOCUMENT_VERSION, manifest_sha256: ZERO_SHA, cohort_id: 'canary', question_id: PROBE_QUESTION_ID, action: 'save-draft', revision: 1, text_sha256: ZERO_SHA, text_length: 0 }),
    };
    const updateBody: Record<(typeof TABLES)[number], Record<string, unknown>> = {
      matrix_paper_review_questions: { cohort_id: 'canary-x' },
      matrix_paper_review_responses: { draft_text: 'canary probe x' },
      matrix_paper_review_response_events: { text_length: 0 },
    };
    const syntheticFilter = `document_version=eq.${encodeURIComponent(PROBE_DOCUMENT_VERSION)}&question_id=eq.${encodeURIComponent(PROBE_QUESTION_ID)}`;

    const expectDenied = (label: string, outcome: RestOutcome, status: number) => {
      record(label, outcome.status === status && outcome.code === '42501', { httpStatus: outcome.status, code: outcome.code });
      expect(`${outcome.status}/${outcome.code}`, label).toBe(`${status}/42501`);
    };

    // Anon key (anon role): INSERT/UPDATE/DELETE on all three tables and both RPCs -> 401 / 42501.
    for (const table of TABLES) {
      expectDenied(`anon INSERT ${table}`, await rest(inputs, inputs.anonKey, 'POST', table, insertBody[table](bId)), 401);
      expectDenied(`anon UPDATE ${table}`, await rest(inputs, inputs.anonKey, 'PATCH', `${table}?${syntheticFilter}`, updateBody[table]), 401);
      expectDenied(`anon DELETE ${table}`, await rest(inputs, inputs.anonKey, 'DELETE', `${table}?${syntheticFilter}`), 401);
    }
    for (const rpc of RPCS) {
      expectDenied(`anon RPC ${rpc}`, await rest(inputs, inputs.anonKey, 'POST', `rpc/${rpc}`, {
        p_document_version: PROBE_DOCUMENT_VERSION, p_manifest_sha256: ZERO_SHA, p_cohort_id: 'canary', p_question_id: PROBE_QUESTION_ID, p_text: 'canary probe', p_expected_revision: null,
      }), 401);
    }

    // Reader B (ordinary authenticated): direct INSERT/UPDATE/DELETE on all three tables -> 403 / 42501.
    for (const table of TABLES) {
      expectDenied(`reader B INSERT ${table}`, await rest(inputs, tokenB, 'POST', table, insertBody[table](bId)), 403);
      expectDenied(`reader B UPDATE ${table}`, await rest(inputs, tokenB, 'PATCH', `${table}?${syntheticFilter}`, updateBody[table]), 403);
      expectDenied(`reader B DELETE ${table}`, await rest(inputs, tokenB, 'DELETE', `${table}?${syntheticFilter}`), 403);
    }

    // Reader B direct select on responses/events scoped to reader A's user id -> 200 with zero rows.
    for (const table of ['matrix_paper_review_responses', 'matrix_paper_review_response_events'] as const) {
      const out = await rest(inputs, tokenB, 'GET', `${table}?select=id&user_id=eq.${encodeURIComponent(aId)}`);
      const ok = out.status === 200 && Array.isArray(out.body) && out.body.length === 0;
      record(`reader B select ${table} for reader A id`, ok, { httpStatus: out.status });
      expect(ok, `reader B select ${table}`).toBe(true);
    }

    // Reader B route-level and page-level probes, in a fresh B context.
    const b = await freshSignedInContext(browser, inputs.baseUrl, inputs.readerB);
    try {
      const boot = await bootstrap(b);
      const sawA = boot.rows.some((row) => JSON.stringify(row).includes(RUN_ID)) || boot.userKey === aId;
      record('reader B GET reviews route shows none of reader A rows', boot.status === 200 && !sawA, { httpStatus: boot.status });
      expect(boot.status).toBe(200);
      expect(sawA).toBe(false);

      const page = await b.newPage();
      await page.goto('/admin/matrix-options-paper-reviews', { waitUntil: 'domcontentloaded' });
      await page.waitForURL((url) => url.pathname === '/dashboard', { timeout: 30_000 });
      record('reader B admin page redirects to /dashboard', true, { note: 'final path /dashboard' });
      await page.close();

      const exportResponse = await b.request.get('/api/matrix-options/paper/reviews/export');
      record('reader B export is forbidden', exportResponse.status() === 403, { httpStatus: exportResponse.status() });
      expect(exportResponse.status()).toBe(403);
    } finally { await b.close(); }

    // No session at all: the write route answers 401 `unauthenticated`; the read route answers 401.
    const anonContext = await browser.newContext({ baseURL: inputs.baseUrl });
    try {
      const putResponse = await anonContext.request.put(`/api/matrix-options/paper/reviews/${encodeURIComponent(CANARY_QUESTION_ID)}`, {
        data: { documentVersion: DOCUMENT_VERSION, manifestSha256: EXPECTED_MANIFEST_SHA256, cohortId: CANARY_COHORT_ID, action: 'save-draft', text: 'x', expectedRevision: null },
      });
      const putJson = (await putResponse.json().catch(() => ({}))) as { outcome?: string };
      record('no session PUT -> 401 unauthenticated', putResponse.status() === 401 && putJson.outcome === 'unauthenticated', { httpStatus: putResponse.status(), code: putJson.outcome });
      expect(putResponse.status()).toBe(401);
      expect(putJson.outcome).toBe('unauthenticated');
      const getResponse = await anonContext.request.get(`/api/matrix-options/paper/reviews?documentVersion=${encodeURIComponent(DOCUMENT_VERSION)}&manifestSha256=${EXPECTED_MANIFEST_SHA256}`);
      record('no session GET -> 401', getResponse.status() === 401, { httpStatus: getResponse.status() });
      expect(getResponse.status()).toBe(401);
    } finally { await anonContext.close(); }
  });
});
