import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';

import { readDisposableSignIns } from '../scripts/matrix-options/r2-fullstack-bootstrap/accounts.mjs';
import { assertBoundDockerEnv, createRunApiSender, proveRun } from '../scripts/matrix-options/r2-fullstack-bootstrap/custody.mjs';
import { GUIDED_ADMIN_CSV_COLUMNS } from '../src/lib/matrix-options/paper/guided-r2-admin';
import {
  R2_JOURNEY_REVIEWER_A_TARGETS, checkGuidedAdminCsvMatches, checkGuidedAdminViewMatches, expectedReviewFromDatabase, readGuidedAdminTable, safeEvidenceMessage,
  type ExpectedGuidedReview, type StoredGuidedCompletion, type StoredGuidedEntry,
} from '../src/lib/matrix-options/paper/guided-r2-admin-evidence';
import { GUIDED_DRAFT_CLOSED_GRACE_MS, GUIDED_DRAFT_HEARTBEAT_MS } from '../src/lib/matrix-options/paper/guided-r2-local-drafts';

// Matrix R2 DISPOSABLE local full-stack journey (playwright.r2-fullstack.config.ts only): the
// reviewer -> administrator product flow on one run's own local stack. Real page, real API routes,
// real Supabase auth/RLS/RPCs/storage, real R2 paper, all on loopback. Started by
// scripts/matrix-options/r2-fullstack-preview.ps1 (up, seed, build, start, then accept -RunId <id>).
// It uses ONLY the run's fresh disposable accounts; no production, test-account or .env.local
// credential exists anywhere in this flow, and nothing here touches a provider.
// Trusted preview: Playwright must never write its error-context (page snapshot) artifact. The
// wrapper and the config set this for the runner; this worker sets it again and the first test
// refuses to run without it.
process.env.PLAYWRIGHT_NO_COPY_PROMPT = '1';
const implRoot = process.env.R2_FULLSTACK_IMPL_ROOT || process.cwd();
assertBoundDockerEnv(process.env);
// The exact run the wrapper is acting on (explicit run id + worktree + candidate).
const runState = proveRun({ repoRoot: implRoot, runId: process.env.R2_PREVIEW_RUN_ID, candidateSha: process.env.R2_PREVIEW_CANDIDATE }) as unknown as { run_id: string; run_dir: string; project_id: string; ports: { app: number; api: number } };
if (process.env.R2_FULLSTACK_RUN_DIR && path.resolve(process.env.R2_FULLSTACK_RUN_DIR) !== path.resolve(runState.run_dir)) throw new Error('The journey run directory is not this run\'s.');
if (process.env.R2_FULLSTACK_BASE_URL !== `http://127.0.0.1:${runState.ports.app}`) throw new Error('The journey base URL is not this run\'s loopback app port.');
const stack = JSON.parse(fs.readFileSync(path.join(runState.run_dir, 'preview-env.json'), 'utf8')) as { API_URL: string; ANON_KEY: string };
if (stack.API_URL !== `http://127.0.0.1:${runState.ports.api}`) throw new Error('The local stack URL is not this run\'s loopback API.');
const signIns = readDisposableSignIns(JSON.parse(fs.readFileSync(path.join(runState.run_dir, 'sign-ins.json'), 'utf8')), runState.run_id) as Array<{ key: string; id: string; email: string; password: string; admin: boolean }>;
const user = (key: string) => {
  const found = signIns.find((entry) => entry.key === key);
  if (!found) throw new Error(`missing disposable account ${key}`);
  return found;
};
const R2 = 'phase2-review-2026-11-fa356b89';
const PAPER = `/matrix-options/paper/publication/v/${R2}`;
const ADMIN = '/admin/matrix-options-paper-reviews';
const identity = { documentVersion: R2, guidedManifestSha256: '25e9a8cf1ed7017a55773b144ac699ba474cc9e73941c3e03982f38bab9ab576', reviewManifestSha256: 'da22c5f0700a5f86efcd399a7dcedc1ff6319882e8a08f77212f228047b1a75e' };

/**
 * Every direct HTTP request of this journey (login, RPC, activation, row reads) goes through the one
 * run-owned guard (custody createRunApiSender): before each send the explicit run and its loopback
 * API destination (container, published mapping, listener identity) are proven again and must equal
 * the bound API URL; redirects are never followed and any redirect answer fails the request.
 */
let apiSender: ((pathname: string, init?: RequestInit) => Promise<Response>) | null = null;
function api(pathname: string, init: RequestInit = {}): Promise<Response> {
  apiSender ??= createRunApiSender({
    runId: runState.run_id, apiUrl: stack.API_URL,
    proveRunState: () => proveRun({ repoRoot: implRoot, runId: process.env.R2_PREVIEW_RUN_ID, candidateSha: process.env.R2_PREVIEW_CANDIDATE }),
  }) as (pathname: string, init?: RequestInit) => Promise<Response>;
  return apiSender(pathname, init);
}

/** SQL against THIS run's disposable database only (its own container). */
function sql(text: string): string[][] {
  assertBoundDockerEnv(process.env);
  const out = execFileSync('docker', ['exec', '-i', `supabase_db_${runState.project_id}`, 'psql', '-U', 'postgres', '-d', 'postgres', '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-At', '-F', '\t'], { input: text, encoding: 'utf8' });
  return out.split(/\r?\n/).filter(Boolean).map((line) => line.split('\t'));
}
function activation(): boolean { return sql(`select enabled from public.matrix_guided_r2_activation where document_version = '${R2}';`)[0][0] === 't'; }
function counts(userId: string) {
  const [row] = sql(`select (select count(*) from public.matrix_guided_r2_entries where user_id = '${userId}'), (select count(*) from public.matrix_guided_r2_completion where user_id = '${userId}'), (select count(*) from public.matrix_guided_r2_events where user_id = '${userId}');`);
  return { entries: Number(row[0]), completion: Number(row[1]), events: Number(row[2]) };
}
/**
 * The administrator's expected rows for one reviewer, derived independently of the export and view
 * under test: values and timestamps (JSON text in UTC, as the API serializes them) from this run's
 * disposable database, labels from the pinned journey fixture; the stored targets must be exactly the
 * fixture's targets.
 */
function storedReview(userId: string): ExpectedGuidedReview {
  const [[json]] = sql(`set timezone = 'UTC';
select json_build_object(
    'entries', coalesce((select json_agg(json_build_object('targetKind', e.target_kind, 'targetId', e.target_id, 'draftChoiceId', e.draft_choice_id, 'draftRationale', e.draft_rationale,
      'draftText', e.draft_text, 'submittedChoiceId', e.submitted_choice_id, 'submittedRationale', e.submitted_rationale, 'submittedText', e.submitted_text,
      'revision', e.revision, 'submittedRevision', e.submitted_revision, 'updatedAt', e.updated_at, 'submittedAt', e.submitted_at) order by e.target_kind, e.target_id)
      from public.matrix_guided_r2_entries e where e.user_id = '${userId}'), '[]'::json),
    'completion', (select json_build_object('revision', c.revision, 'digest', c.submitted_set_digest, 'completedAt', c.submitted_at) from public.matrix_guided_r2_completion c where c.user_id = '${userId}'))::text;`);
  const parsed = JSON.parse(json) as { entries: StoredGuidedEntry[]; completion: StoredGuidedCompletion | null };
  return expectedReviewFromDatabase({ userId, identity, entries: parsed.entries, completion: parsed.completion, fixture: R2_JOURNEY_REVIEWER_A_TARGETS });
}
async function signedIn(browser: Browser, key: string, viewport = { width: 1440, height: 900 }): Promise<BrowserContext> {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.locator('form[data-hydrated="true"]').waitFor({ state: 'attached', timeout: 30_000 });
  await page.locator('input#email').fill(user(key).email);
  await page.locator('input#password').fill(user(key).password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 });
  await page.close();
  return context;
}
async function token(key: string): Promise<string> {
  const response = await api('/auth/v1/token?grant_type=password', { method: 'POST', headers: { apikey: stack.ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: user(key).email, password: user(key).password }) });
  expect(response.status).toBe(200);
  return (await response.json()).access_token as string;
}
async function rpc(name: string, args: Record<string, unknown>, bearer: string | null) {
  const response = await api(`/rest/v1/rpc/${name}`, { method: 'POST', headers: { apikey: stack.ANON_KEY, Authorization: `Bearer ${bearer ?? stack.ANON_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
  return { status: response.status, body: await response.json().catch(() => null) };
}
async function openPaper(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  const state = page.waitForResponse((response) => response.url().includes('/api/matrix-options/paper/guided-r2/state'), { timeout: 60_000 });
  expect((await page.goto(PAPER, { waitUntil: 'domcontentloaded' }))?.status()).toBe(200);
  expect(new URL(page.url()).pathname, 'the paper route must not bounce to sign-in').toBe(PAPER);
  expect((await state).status()).toBe(200);
  return page;
}
/**
 * A FRESH tab (new page, new tab session) is not the closed tab's successor: the product adopts the
 * closed tab's copy only after the closed-tab grace period, on a later heartbeat. From the close that is
 * at most one grace period plus one heartbeat; the bound adds fixed margin for the page load and the
 * render, and stays far below the test timeout. Derived from the product constants, never shorter.
 */
const FRESH_TAB_RECOVERY_TIMEOUT_MS = GUIDED_DRAFT_CLOSED_GRACE_MS + GUIDED_DRAFT_HEARTBEAT_MS + 15_000;
const panel = (page: Page) => page.getByRole('complementary', { name: 'Review this section' });
const navigation = (page: Page) => page.getByRole('complementary', { name: 'Review navigation' });
async function saveField(page: Page, selector: string) {
  await panel(page).locator(selector).locator('xpath=ancestor::section[1]').getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('status').filter({ hasText: /^Saved\.$/ })).toBeVisible();
}
async function legacyCsvDigest(browser: Browser): Promise<string> {
  const context = await signedIn(browser, 'admin');
  const response = await context.request.get('/api/matrix-options/paper/reviews/export');
  expect(response.status()).toBe(200);
  const digest = createHash('sha256').update(await response.body()).digest('hex');
  await context.close();
  return digest;
}
const legacyCounts = () => sql('select (select count(*) from public.matrix_paper_review_responses) || \'/\' || (select count(*) from public.matrix_paper_review_response_events);')[0][0];

test.describe.configure({ mode: 'serial' });
let legacyDigest = '';

test('0. legacy v0.9.91 baseline: read-only history and export captured before any guided write', async ({ browser }) => {
  expect(process.env.PLAYWRIGHT_NO_COPY_PROMPT, 'error-context capture must be disabled in this worker').toBe('1');
  expect(activation()).toBe(true);
  expect(legacyCounts()).toBe('2/12');
  expect(counts(user('reviewerA').id)).toEqual({ entries: 0, completion: 0, events: 0 });
  legacyDigest = await legacyCsvDigest(browser);
});

test('1-6. reviewer A: real paper, every input type, counts, expand, resize, scroll, Save all, reload, recovery, leave guard', async ({ browser }) => {
  const context = await signedIn(browser, 'reviewerA');
  let page = await openPaper(context);
  const scrollport = page.getByTestId('r2-paper-scrollport');
  expect(await scrollport.locator('section[id^="sec-phase2-"]').count()).toBeGreaterThan(10);
  await expect(page.getByRole('status').filter({ hasText: 'not open right now' })).toHaveCount(0);

  await navigation(page).getByRole('button', { name: /Overall approach and paper structure/ }).click();
  await panel(page).getByRole('radio', { name: 'Needs refinement' }).check();
  const rationale = panel(page).locator('#desktop-structure-approach-rationale');
  await rationale.fill('Keep the four pathways; clarify placement.');
  await expect(panel(page).locator('#desktop-structure-approach-rationale-count')).toHaveText('42 / 20000');
  const expand = rationale.locator('xpath=ancestor::section[1]').getByRole('button', { name: 'Expand editor' });
  await expand.click();
  await expect(rationale).toHaveAttribute('data-expanded', 'true');
  await rationale.locator('xpath=ancestor::section[1]').getByRole('button', { name: 'Collapse editor' }).click();
  await expect(rationale).not.toHaveAttribute('data-expanded', 'true');
  expect(await rationale.evaluate((element) => getComputedStyle(element).resize)).toBe('vertical');

  const windowBefore = await page.evaluate(() => window.scrollY);
  const paperBefore = await scrollport.evaluate((element) => element.scrollTop);
  await navigation(page).getByRole('button', { name: /Human-health protection/ }).click();
  await expect.poll(() => scrollport.evaluate((element) => element.scrollTop)).not.toBe(paperBefore);
  expect(await page.evaluate(() => window.scrollY)).toBe(windowBefore);

  await navigation(page).getByRole('button', { name: /Where standards apply/ }).click();
  await panel(page).locator('#desktop-site-assignment').fill('Estuary sites are ambiguous.');
  await panel(page).locator('#desktop-sec-phase2-5').fill('Section 5 needs a worked example.');
  await navigation(page).getByRole('button', { name: 'Whole-paper comments' }).click();
  await panel(page).locator('#desktop-whole-paper').fill('Clear and well organized overall.');
  await expect(panel(page).getByRole('button', { name: 'Save all unsaved changes (4)' })).toBeVisible();

  const leave = await page.evaluate(() => { const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented; });
  expect(leave).toBe(true);

  await panel(page).getByRole('button', { name: 'Save all unsaved changes (4)' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved 4 of 4. All changes are saved.' })).toBeVisible();
  const a = user('reviewerA');
  expect(counts(a.id)).toEqual({ entries: 4, completion: 0, events: 4 });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await navigation(page).getByRole('button', { name: /Where standards apply/ }).click();
  await expect(panel(page).locator('#desktop-site-assignment')).toHaveValue('Estuary sites are ambiguous.');
  await panel(page).locator('#desktop-site-assignment').fill('Estuary sites are ambiguous; tidal reaches too.');
  await page.close();
  page = await openPaper(context);
  await expect(page.getByRole('status').filter({ hasText: 'Unsaved local changes recovered.' })).toBeVisible({ timeout: FRESH_TAB_RECOVERY_TIMEOUT_MS });
  await navigation(page).getByRole('button', { name: /Where standards apply/ }).click();
  await expect(panel(page).locator('#desktop-site-assignment')).toHaveValue('Estuary sites are ambiguous; tidal reaches too.');
  await saveField(page, '#desktop-site-assignment');
  await context.close();
});

test('4b. mobile: focus-area picker brings the section into view', async ({ browser }) => {
  const context = await signedIn(browser, 'reviewerA', { width: 390, height: 844 });
  const page = await openPaper(context);
  await page.getByLabel('Go to a focus area').selectOption('human-health');
  await expect.poll(() => page.locator('#sec-phase2-6-1').evaluate((element) => {
    const box = element.getBoundingClientRect();
    return box.top < window.innerHeight && box.bottom > 0;
  })).toBe(true);
  await context.close();
});

test('7. two tabs: a 409 conflict resolves both ways with readable labels', async ({ browser }) => {
  const context = await signedIn(browser, 'reviewerA');
  const tab1 = await openPaper(context);
  const tab2 = await openPaper(context);
  for (const tab of [tab1, tab2]) await navigation(tab).getByRole('button', { name: /Overall approach and paper structure/ }).click();
  await panel(tab1).getByRole('radio', { name: 'Unsure' }).check();
  await saveField(tab1, '#desktop-structure-approach-rationale');
  await panel(tab2).getByRole('radio', { name: 'Sound as proposed' }).check();
  await panel(tab2).locator('#desktop-structure-approach-rationale').locator('xpath=ancestor::section[1]').getByRole('button', { name: 'Save' }).click();
  await expect(panel(tab2).getByText(/^Saved response: Unsure/)).toBeVisible();
  await panel(tab2).getByRole('button', { name: 'Use saved response' }).click();
  await expect(panel(tab2).getByRole('radio', { name: 'Unsure' })).toBeChecked();

  await panel(tab1).getByRole('radio', { name: 'Needs refinement' }).check();
  await saveField(tab1, '#desktop-structure-approach-rationale');
  await panel(tab2).getByRole('radio', { name: 'Sound as proposed' }).check();
  await panel(tab2).locator('#desktop-structure-approach-rationale').locator('xpath=ancestor::section[1]').getByRole('button', { name: 'Save' }).click();
  await expect(panel(tab2).getByText(/^Saved response: Needs refinement/)).toBeVisible();
  await panel(tab2).getByRole('button', { name: 'Keep my local response' }).click();
  await saveField(tab2, '#desktop-structure-approach-rationale');
  const [row] = sql(`select draft_choice_id from public.matrix_guided_r2_entries where user_id = '${user('reviewerA').id}' and target_id = 'structure-approach';`);
  expect(row[0]).toBe('sound');
  await context.close();
});

test('7b. two tabs edit before either saves: each tab keeps its own recovery copy and reload recovers it', async ({ browser }) => {
  const context = await signedIn(browser, 'reviewerA');
  const tab1 = await openPaper(context);
  const tab2 = await openPaper(context);
  for (const tab of [tab1, tab2]) await navigation(tab).getByRole('button', { name: /Where standards apply/ }).click();
  await panel(tab1).locator('#desktop-sec-phase2-5').fill('Tab one draft for section 5.');
  await panel(tab2).locator('#desktop-sec-phase2-5').fill('Tab two draft for section 5.');
  await saveField(tab1, '#desktop-sec-phase2-5');
  await panel(tab2).locator('#desktop-sec-phase2-5').locator('xpath=ancestor::section[1]').getByRole('button', { name: 'Save' }).click();
  await expect(panel(tab2).getByText('Conflict - compare with saved response before saving')).toBeVisible();
  // Reloading tab two recovers its own text and keeps it blocked as a conflict.
  await tab2.reload({ waitUntil: 'domcontentloaded' });
  await navigation(tab2).getByRole('button', { name: /Where standards apply/ }).click();
  await expect(panel(tab2).locator('#desktop-sec-phase2-5')).toHaveValue('Tab two draft for section 5.');
  await expect(panel(tab2).getByText('Conflict - compare with saved response before saving')).toBeVisible();
  await panel(tab2).getByRole('button', { name: 'Use saved response' }).click();
  await expect(panel(tab2).locator('#desktop-sec-phase2-5')).toHaveValue('Tab one draft for section 5.');
  await context.close();
});

test('8. Finish, edit, Changed since submit, Save all and finish again (completion revision 2)', async ({ browser }) => {
  const context = await signedIn(browser, 'reviewerA');
  const page = await openPaper(context);
  await navigation(page).getByRole('button', { name: 'My Review' }).click();
  await page.getByRole('button', { name: 'Finish review' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Review finished.' })).toBeVisible();
  await navigation(page).getByRole('button', { name: 'Whole-paper comments' }).click();
  await panel(page).locator('#desktop-whole-paper').fill('Clear overall; one late addition.');
  await saveField(page, '#desktop-whole-paper');
  await expect(panel(page).getByText('Changed since submit')).toBeVisible();
  await navigation(page).getByRole('button', { name: 'My Review' }).click();
  await page.getByTestId('r2-save-all-review').getByRole('button', { name: 'Save all and finish' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Review finished.' })).toBeVisible();
  expect(sql(`select revision from public.matrix_guided_r2_completion where user_id = '${user('reviewerA').id}';`)[0][0]).toBe('2');
  await context.close();
});

test('9. rate pacing with the real RPC: 3 manual saves, then Save all and finish across all 23 targets', async ({ browser }) => {
  test.setTimeout(240_000);
  const b = user('reviewerB');
  const context = await signedIn(browser, 'reviewerB');
  const page = await openPaper(context);
  await navigation(page).getByRole('button', { name: /Where standards apply/ }).click();
  for (const text of ['first', 'second', 'third']) {
    await panel(page).locator('#desktop-site-assignment').fill(`Manual save ${text}`);
    await saveField(page, '#desktop-site-assignment');
  }
  // Prime all 23 targets as recovery copies left by a crashed page instance (silent for over 10
  // minutes), each based on its current server revision; the reload adopts them.
  const revisions = Object.fromEntries(sql(`select target_kind || ':' || target_id, revision from public.matrix_guided_r2_entries where user_id = '${b.id}';`).map((row) => [row[0], Number(row[1])]));
  const targets = sql(`select target_kind, target_id, coalesce(array_to_string(option_ids, ','), '') from public.matrix_guided_r2_targets order by target_kind, target_id;`);
  expect(targets).toHaveLength(23);
  await page.evaluate(({ id, user: userKey, targets: list, revisions: revs }) => {
    for (const [kind, target, options] of list) {
      const key = ['mtwg-guided-r2-draft-v2', userKey, id.documentVersion, id.guidedManifestSha256, id.reviewManifestSha256, kind, target, '00000000000000aa'].join(':');
      const choice = kind === 'choice-prompt' ? options.split(',')[0] : null;
      window.localStorage.setItem(key, JSON.stringify({ baseRevision: revs[`${kind}:${target}`] ?? 0, choiceId: choice, rationale: '', text: kind === 'choice-prompt' ? '' : `Paced ${target}`, at: Date.now() - 11 * 60_000 }));
    }
  }, { id: identity, user: b.id, targets, revisions });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await navigation(page).getByRole('button', { name: 'My Review' }).click();
  await page.getByTestId('r2-save-all-review').getByRole('button', { name: 'Save all and finish' }).click();
  await expect(page.getByText(/Save limit reached - continuing in \d+s with \d+ remaining\./).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('status').filter({ hasText: 'Saved 23 of 23. Review finished.' })).toBeVisible({ timeout: 150_000 });
  expect(counts(b.id)).toEqual({ entries: 23, completion: 1, events: 27 });
  const perTarget = sql(`select count(*) from public.matrix_guided_r2_events where user_id = '${b.id}' and event_kind = 'save' group by target_kind, target_id having count(*) > case when target_id = 'site-assignment' then 4 else 1 end;`);
  expect(perTarget).toEqual([]);
  await context.close();
});

test('10-11. reviewer B cannot read reviewer A\'s rows; non-admin is denied administrator routes and export', async ({ browser }) => {
  const bToken = await token('reviewerB');
  const rows = await api('/rest/v1/matrix_guided_r2_entries?select=user_id', { headers: { apikey: stack.ANON_KEY, Authorization: `Bearer ${bToken}` } });
  expect(rows.status).toBe(200);
  const owners = new Set(((await rows.json()) as Array<{ user_id: string }>).map((row) => row.user_id));
  expect([...owners]).toEqual([user('reviewerB').id]);
  const context = await signedIn(browser, 'reviewerB');
  const state = await context.request.get(`/api/matrix-options/paper/guided-r2/state?${new URLSearchParams(identity)}`);
  const body = await state.json();
  expect(body.entries.every((entry: { user_id: string }) => entry.user_id === user('reviewerB').id)).toBe(true);
  expect([401, 403, 404]).toContain((await context.request.get('/api/matrix-options/paper/guided-r2/export')).status());
  expect([401, 403, 404]).toContain((await context.request.get(`/api/matrix-options/paper/guided-r2/export?userId=${user('reviewerA').id}`)).status());
  expect([401, 403, 404]).toContain((await context.request.get('/api/matrix-options/paper/reviews/export')).status());
  const page = await context.newPage();
  await page.goto(`${ADMIN}?view=guided`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('table', { name: /review responses/i })).toHaveCount(0);
  await context.close();
});

test('12. administrator: guided view and scoped CSV exactly match reviewer A; legacy view and export unchanged', async ({ browser }) => {
  const a = user('reviewerA');
  // Exactly the four reviewer-A targets of the reviewed fixture: no subset, no superset.
  const expected = storedReview(a.id);
  expect(expected.entries.map((entry) => `${entry.targetKind}:${entry.targetId}`)).toEqual(R2_JOURNEY_REVIEWER_A_TARGETS.map((target) => `${target.targetKind}:${target.targetId}`));
  expect(expected.entries).toHaveLength(4);
  expect(expected.completion?.revision).toBe(2);
  const context = await signedIn(browser, 'admin');
  const page = await context.newPage();
  await page.goto(`${ADMIN}?view=guided&userId=${a.id}`, { waitUntil: 'domcontentloaded' });
  const view = checkGuidedAdminViewMatches(await readGuidedAdminTable(page), expected);
  if (!view.ok) throw new Error(safeEvidenceMessage('Guided admin view', view));
  const csv = await context.request.get(`/api/matrix-options/paper/guided-r2/export?userId=${a.id}`);
  expect(csv.status()).toBe(200);
  const csvCheck = checkGuidedAdminCsvMatches(await csv.text(), expected, GUIDED_ADMIN_CSV_COLUMNS);
  if (!csvCheck.ok) throw new Error(safeEvidenceMessage('Guided admin CSV', csvCheck));
  // The default administrator view is the read-only legacy v0.9.91 history. Assertions are scoped to
  // the application's legacy panel (Next.js renders its own route announcer with role=alert).
  await page.goto(ADMIN, { waitUntil: 'domcontentloaded' });
  const legacyPanel = page.getByTestId('legacy-review-panel');
  await expect(legacyPanel).toHaveAttribute('data-state', 'ready');
  await expect(legacyPanel.getByRole('table', { name: 'Review responses' })).toBeVisible();
  await expect(legacyPanel.getByRole('alert')).toHaveCount(0);
  await context.close();
  expect(legacyCounts()).toBe('2/12');
  expect(await legacyCsvDigest(browser)).toBe(legacyDigest);
});

test('13. direct RPC and activation ACL, both directions (local disposable activation row)', async () => {
  const aToken = await token('reviewerA');
  const save = (bearer: string | null) => rpc('matrix_guided_r2_save', { p_document_version: R2, p_guided_manifest_sha256: identity.guidedManifestSha256, p_review_manifest_sha256: identity.reviewManifestSha256, p_target_kind: 'text-prompt', p_target_id: 'ecological-approach', p_choice_id: null, p_rationale: null, p_text: 'Direct RPC probe', p_expected_revision: 0, p_expected_user_id: user('reviewerA').id }, bearer);
  const update = await api(`/rest/v1/matrix_guided_r2_activation?document_version=eq.${R2}`, { method: 'PATCH', headers: { apikey: stack.ANON_KEY, Authorization: `Bearer ${aToken}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ enabled: false }) });
  expect([401, 403]).toContain(update.status);
  expect(activation()).toBe(true);
  // LOCAL ONLY: the disposable database's own activation row is switched off and on directly.
  sql(`update public.matrix_guided_r2_activation set enabled = false where document_version = '${R2}';`);
  const eventsBefore = counts(user('reviewerA').id).events;
  const closed = await save(aToken);
  expect(closed.body).toMatchObject({ outcome: 'release_read_only' });
  expect(counts(user('reviewerA').id).events).toBe(eventsBefore);
  expect([401, 403]).toContain((await save(null)).status);
  sql(`update public.matrix_guided_r2_activation set enabled = true where document_version = '${R2}';`);
  const open = await save(aToken);
  expect(open.body).toMatchObject({ outcome: 'ok' });
  expect([401, 403]).toContain((await save(null)).status);
});

test('14. hard delete cascades guided rows; soft delete retains them (disposable database only)', async () => {
  // The bootstrap holds the run's local service-role key and prints only ids and status codes.
  const syntheticPassword = `local-deletion-probe-${randomUUID()}`;
  const probe = (...args: string[]) => JSON.parse(execFileSync('node', [path.join(implRoot, 'scripts', 'matrix-options', 'r2-fullstack-bootstrap', 'bootstrap.mjs'), 'probe-user', ...args],
    { encoding: 'utf8', env: { ...process.env, R2_PROBE_PASSWORD: syntheticPassword } }).trim().split(/\r?\n/).at(-1) ?? '{}');
  const make = async (email: string) => {
    const id = probe('create', email).id as string;
    const login = await api('/auth/v1/token?grant_type=password', { method: 'POST', headers: { apikey: stack.ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: syntheticPassword }) });
    const bearer = (await login.json()).access_token as string;
    const saved = await rpc('matrix_guided_r2_save', { p_document_version: R2, p_guided_manifest_sha256: identity.guidedManifestSha256, p_review_manifest_sha256: identity.reviewManifestSha256, p_target_kind: 'whole-paper-comment', p_target_id: 'whole-paper', p_choice_id: null, p_rationale: null, p_text: 'Deletion probe', p_expected_revision: 0, p_expected_user_id: id }, bearer);
    expect(saved.body).toMatchObject({ outcome: 'ok' });
    expect(counts(id)).toMatchObject({ entries: 1, events: 1 });
    return id;
  };
  const soft = await make(`soft-delete-${Date.now()}@r2-preview.local`);
  expect(probe('delete', soft, 'soft').status).toBe(200);
  expect(counts(soft)).toMatchObject({ entries: 1, events: 1 });
  const hard = await make(`hard-delete-${Date.now()}@r2-preview.local`);
  expect(probe('delete', hard, 'hard').status).toBe(200);
  expect(counts(hard)).toEqual({ entries: 0, completion: 0, events: 0 });
});
