import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

import { SESSION_TEARDOWN_PROJECT, SESSION_TEARDOWN_TAG } from './session-teardown';

// The ten package ids of the reviewed print-package catalog, read from the contract itself so the
// anonymous-denial test covers every artifact route rather than a hand-picked one.
const printPackageIds: string[] = (JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'matrix-options', 'paper', 'contracts', 'print-packages-v1.json'), 'utf8'),
) as { artifacts: Array<{ packageId: string }> }).artifacts.map((artifact) => artifact.packageId);

const realVersion = '1.0.11-remediated-7-8-successor-20260918-D';
const realReviewPath = `/matrix-options/paper/review/v/${realVersion}`;
const legacyFixtureVersion = 'slice-1a-fixture-v1';
const legacySectionPath = `/matrix-options/paper/v/${legacyFixtureVersion}/synthetic.framework.example`;
/*
 * M1R8-07 (informed Opus holistic pass, P3-8). These two numbers are EXPORTED by
 * src/components/matrix-options/paper/RevisedPaperWorkspace.tsx, and the unit
 * suite imports them from there. This file cannot: that module is a `use client`
 * React component whose import graph pulls react, react-dom, lucide-react,
 * next/navigation and MathRenderer's KaTeX bundle into Playwright's own test
 * process, for two integers, and there is no shared constants module to hold
 * them (creating one is part of M2's centralisation of scroll authority, which
 * is explicitly out of scope for this round).
 *
 * So they are restated here as NAMED constants rather than typed as bare
 * literals at their use sites, and the duplication is GUARDED rather than
 * trusted: 'M1R8-07: pins the reveal numbers that the paper e2e restates' in
 * RevisedPaperWorkspace.test.tsx reads THIS file's bytes and fails if either
 * number stops matching the exported constant it copies. Same technique as
 * PaperRailDrift.test.ts.
 */
/** Mirrors PAPER_PANEL_REVEAL_GAP_PX. */
const PAPER_PANEL_REVEAL_GAP_PX = 8;
/** Mirrors PAPER_REVEAL_SETTLE_TIMEOUT_MS: how long a reveal may own the scrollport. */
const PAPER_REVEAL_SETTLE_TIMEOUT_MS = 600;

// Mirrors src/lib/matrix-options/navigation.ts: an absent flag selects the
// reviewed workspace, exact 'true' enables it, and every other value is off.
const paperFlagEnabled = (value: string | undefined) => value === undefined || value === 'true';
const paperWorkspaceEnabled = paperFlagEnabled(process.env.MATRIX_OPTIONS_PAPER_WORKSPACE);
const reviewNavigationEnabled = paperWorkspaceEnabled && paperFlagEnabled(process.env.MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION);

test.describe('Matrix Options Paper disabled-route regressions', () => {
  test('flags-off old TWG query preserves the revised-paper status', async ({ page }, testInfo) => {
    test.skip(paperWorkspaceEnabled, 'This regression requires both paper flags to be off.');
    await page.goto('/matrix-options?view=TWG%20Review', { waitUntil: 'networkidle' });
    if (page.url().includes('/login')) test.skip(testInfo.project.name !== 'chromium-auth', 'Authenticated dashboard coverage runs in chromium-auth.');
    await expect(page).toHaveURL(/\/matrix-options\?view=TWG(?:%20|\+)Review$/);
    const status = page.getByTestId('revised-paper-status');
    await expect(status).toBeVisible();
    await expect(status.getByRole('heading', { name: 'Revised Matrix Options Paper', exact: true })).toBeVisible();
  });

  test('flags-off direct paper routes fail closed before follow-up paper requests', async ({ page }, testInfo) => {
    test.skip(paperWorkspaceEnabled, 'This regression requires both paper flags to be off.');
    for (const path of ['/matrix-options/paper', legacySectionPath, `/matrix-options/paper/v/${legacyFixtureVersion}/missing-section`]) {
      const paperRequests: string[] = [];
      const listener = (request: { url(): string }) => {
        if (new URL(request.url()).pathname.startsWith('/matrix-options/paper')) paperRequests.push(request.url());
      };
      page.on('request', listener);
      await page.goto(path, { waitUntil: 'networkidle' });
      if (page.url().includes('/login')) {
        page.off('request', listener);
        test.skip(testInfo.project.name !== 'chromium-auth', 'Authenticated dashboard coverage runs in chromium-auth.');
      }
      page.off('request', listener);
      await expect(page).toHaveURL(/\/matrix-options\?view=TWG(?:%20|\+)Review$/);
      await expect(page.getByTestId('revised-paper-status')).toBeVisible();
      expect(paperRequests).toHaveLength(1);
    }
  });

  test('flags-off non-paper destinations retain their selected tab', async ({ page }, testInfo) => {
    test.skip(paperWorkspaceEnabled, 'This regression requires both paper flags to be off.');
    for (const [viewId, label] of [
      ['The Guide', 'Guide'],
      ['Vision for Modernizing Schedule 3.4', 'Modernizing Schedule 3.4'],
      ['Interactive Map', 'Database'],
      ['Calculator', 'Calculator'],
      ['SSD Workbench', 'SSD Workbench'],
      ['References & Values', 'Catalogue'],
    ] as const) {
      await page.goto(`/matrix-options?view=${encodeURIComponent(viewId)}`, { waitUntil: 'domcontentloaded' });
      if (page.url().includes('/login')) test.skip(testInfo.project.name !== 'chromium-auth', 'Authenticated dashboard coverage runs in chromium-auth.');
      await expect(page.getByRole('tab', { name: label, exact: true })).toHaveAttribute('aria-selected', 'true');
    }
  });
});

test.describe('Matrix Options Paper real V16 acceptance', () => {
  test.setTimeout(120000);
  const workspacePath = `/matrix-options/paper/publication/v/${realVersion}`;
  const canonicalWorkingDraft = `${workspacePath}?mode=working-draft`;
  const pathAndQuery = (url: string) => {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}`;
  };
  const requireJourney = (projectName: string) => {
    test.skip(!reviewNavigationEnabled, 'The standard E2E harness supplies both exact-true flags for this journey.');
    if (projectName !== 'chromium-auth') test.skip(true, 'This journey is required only in the authenticated Chromium project.');
  };
  const failOnLogin = (url: string) => {
    if (url.includes('/login')) throw new Error('REAL_V16_AUTH_REQUIRED_BUT_LOGIN_REDIRECTED');
  };

  test('authenticated real release lands every legacy entry on the canonical Working Draft', async ({ page }, testInfo) => {
    requireJourney(testInfo.project.name);
    for (const entry of [
      '/matrix-options/paper',
      `/matrix-options/paper/v/${realVersion}`,
      `/matrix-options/paper/v/${realVersion}/ignored-section`,
      realReviewPath,
      `${realReviewPath}?mode=my-review&lens=all&page=1`,
      `${realReviewPath}/assignments/assignment/packets/packet/items/item`,
      workspacePath,
      `${workspacePath}?mode=publication`,
    ]) {
      await page.goto(entry, { waitUntil: 'domcontentloaded' });
      failOnLogin(page.url());
      await expect.poll(() => pathAndQuery(page.url()), { timeout: 30000 }).toBe(canonicalWorkingDraft);
    }
    await expect(page.getByRole('link', { name: 'Working Draft', exact: true })).toHaveAttribute('aria-current', 'page', { timeout: 30000 });
    await expect(page.getByRole('link', { name: 'Publication', exact: true })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Publication Atlas' })).toHaveCount(0);
    await expect(page.getByRole('list', { name: 'Current atlas page' })).toHaveCount(0);
    await expect(page.getByTestId('trust-strip')).toHaveCount(0);
    await expect(page.getByTestId('context-drawer')).toHaveCount(0);
    await expect(page.getByRole('textbox', { name: 'Note' })).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  const isSectionRequest = (url: string) => /\/api\/matrix-options\/paper\/v\/[^/]+\/sections\//.test(url);

  test('authenticated real release serves an initial section window and reaches the last heading after Load full document', async ({ page }, testInfo) => {
    requireJourney(testInfo.project.name);
    /*
     * M1R6-06 (codex r5-luna-1 R5-S1-E2E). Loading all 338 chunks is given 180 s
     * by the toHaveText assertion below, but an assertion timeout cannot outlive
     * the TEST timeout, and the repository default is Playwright's 30 s. On a
     * slower CI runner the test was therefore aborted long before the 180 s it
     * asks for could help, and the failure read as a load timeout rather than as
     * a budget that was never granted. browser run-004 only passed this spec
     * because its own config raised the per-test timeout to 300 s; the repo's
     * default would not have. The budget belongs in the spec, so it travels with
     * the assertion that needs it.
     */
    test.setTimeout(240000);
    await page.setViewportSize({ width: 1440, height: 900 });

    // S1: the document response itself carries only the initial window plus the
    // ordered placeholders for the other 15 depth-1 sections.
    const initialHtml = await (await page.request.get(canonicalWorkingDraft)).text();
    const initialChunks = (initialHtml.match(/data-paper-chunk="/g) ?? []).length;
    const placeholders = (initialHtml.match(/data-paper-section-placeholder="/g) ?? []).length;
    expect(initialChunks).toBeGreaterThan(0);
    expect(initialChunks).toBeLessThan(341);
    expect(placeholders).toBe(16);

    let inFlight = 0;
    let maxInFlight = 0;
    const cacheControl: string[] = [];
    page.on('request', (request) => {
      if (!isSectionRequest(request.url())) return;
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
    });
    const settle = (request: { url(): string }) => {
      if (isSectionRequest(request.url())) inFlight -= 1;
    };
    page.on('requestfinished', settle);
    page.on('requestfailed', settle);
    page.on('response', (response) => {
      if (isSectionRequest(response.url())) cacheControl.push(response.headers()['cache-control'] ?? '');
    });

    await page.goto(canonicalWorkingDraft, { waitUntil: 'domcontentloaded' });
    failOnLogin(page.url());
    const navigationToggle = page.getByTestId('paper-header-actions').getByRole('button', { name: 'Navigation', exact: true });
    await expect(navigationToggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('navigation-rail')).toHaveAttribute('data-state', 'open');
    await expect(page.getByTestId('paper-outline-desktop').getByRole('link').first()).toBeVisible();
    await expect(page.getByTestId('paper-load-progress')).toContainText('of 17 sections', { timeout: 30000 });
    await expect(page.getByTestId('paper-print-button')).toBeDisabled();

    await page.getByTestId('paper-load-full-document-button').click();
    await expect(page.getByTestId('paper-load-full-document-button')).toHaveText('Full document loaded', { timeout: 180000 });
    const sections = page.locator('[data-testid="paper-document"] section[data-paper-chunk]');
    await expect(sections).toHaveCount(341, { timeout: 30000 });
    await expect(page.locator('[data-paper-section-placeholder]')).toHaveCount(0);
    await expect(page.getByTestId('paper-find-guidance')).toBeVisible();
    await expect(page.getByTestId('paper-print-button')).toBeEnabled();
    // Sections are named groups (M1-09), not region landmarks.
    await expect(page.getByRole('group', { name: 'Technical Appendices Compendium', exact: true })).toHaveCount(1);
    await expect(page.locator('[data-testid="paper-document"] [role="region"]')).toHaveCount(0);
    await expect(page.locator('h1')).toHaveCount(1);
    const last = sections.last();
    await last.scrollIntoViewIfNeeded();
    await expect(last).toBeVisible();
    await expect(page.locator('.katex-error')).toHaveCount(0);
    const columnBox = await page.getByTestId('paper-document-column').boundingBox();
    expect(columnBox?.height ?? 0).toBeGreaterThan(0);

    // At most two section requests are ever in flight, and none is cacheable.
    expect(maxInFlight).toBeGreaterThan(0);
    expect(maxInFlight).toBeLessThanOrEqual(2);
    expect(cacheControl.length).toBeGreaterThan(0);
    expect(cacheControl.every((value) => value.includes('no-store'))).toBe(true);

    await page.emulateMedia({ media: 'print' });
    await expect(page.getByTestId('navigation-rail')).toHaveCSS('display', 'none');
    await expect(page.getByTestId('paper-document')).toBeVisible();
    await page.emulateMedia({ media: 'screen' });
  });

  test('authenticated real release lands a navigated unloaded section below the sticky header at 360 and 768', async ({ page }, testInfo) => {
    requireJourney(testInfo.project.name);
    for (const width of [360, 768]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(canonicalWorkingDraft, { waitUntil: 'domcontentloaded' });
      failOnLogin(page.url());
      // Below lg the stacked outline lists the depth-1 sections; the last one is
      // never part of the initial window, so this navigates into a placeholder.
      const entries = page.getByTestId('paper-outline-stacked').getByRole('link');
      const target = entries.nth((await entries.count()) - 1);
      const href = await target.getAttribute('href');
      const anchor = new URLSearchParams((href ?? '').replace(/^\?/, '')).get('section') ?? '';
      expect(anchor.length).toBeGreaterThan(0);
      const section = page.locator(`[data-paper-chunk="${anchor}"]`);
      await expect(section).toHaveCount(0);
      await target.click();
      await expect(section).toHaveCount(1, { timeout: 60000 });
      await expect.poll(() => page.evaluate(() => document.activeElement?.id ?? '')).toBe(anchor);
      const stickyBottom = await page.evaluate(() => document.querySelector('header.sticky')?.getBoundingClientRect().bottom ?? 0);
      expect(stickyBottom).toBeGreaterThan(0);
      const box = await section.boundingBox();
      expect(box).not.toBeNull();
      expect(box?.y ?? -1).toBeGreaterThanOrEqual(stickyBottom - 2);
      expect(box?.y ?? Number.POSITIVE_INFINITY).toBeLessThan(800);
    }
  });

  test('authenticated real release lands a deep-linked unloaded section on its reading line at 360 and 768', async ({ page }, testInfo) => {
    requireJourney(testInfo.project.name);
    for (const width of [360, 768]) {
      await page.setViewportSize({ width, height: 800 });
      // The last stacked outline entry is never part of the initial window, so
      // entering by URL exercises the same loader path as run-002's failing
      // `working-draft.deep-link` check.
      await page.goto(canonicalWorkingDraft, { waitUntil: 'domcontentloaded' });
      failOnLogin(page.url());
      const entries = page.getByTestId('paper-outline-stacked').getByRole('link');
      const href = await entries.nth((await entries.count()) - 1).getAttribute('href');
      const anchor = new URLSearchParams((href ?? '').replace(/^\?/, '')).get('section') ?? '';
      expect(anchor.length).toBeGreaterThan(0);
      // M1R5-03 (codex r4-luna-1, accepted). The scenario is only exercised if
      // this section is genuinely absent from the DEFAULT initial window. Without
      // this assertion the test would still pass if the initial window ever grew
      // to include it -- and a deep link that needs no loading at all cannot
      // exhibit the defect. That is the defect class that let round 4's broken
      // deep-link fix be certified as working.
      await expect(page.locator(`[data-paper-chunk="${anchor}"]`)).toHaveCount(0);

      await page.goto(`${canonicalWorkingDraft}&section=${encodeURIComponent(anchor)}`, { waitUntil: 'domcontentloaded' });
      failOnLogin(page.url());
      const section = page.locator(`[data-paper-chunk="${anchor}"]`);
      await expect(section).toHaveCount(1, { timeout: 60000 });
      await expect.poll(() => page.evaluate(() => document.activeElement?.id ?? '')).toBe(anchor);

      // M1R4-03. Run-002 measured this landing 56px short at 360 and 4px short
      // at 768, stable for 2.5s: the correction was spent within about three
      // frames of the mount while the prefetch observer kept loading the
      // sections above the target. The landing must still be on the reading line
      // once those loads have finished, so this polls rather than sampling once.
      await expect
        .poll(async () => page.evaluate((id) => {
          const element = document.getElementById(id);
          if (!element) return 9999;
          const margin = Number.parseFloat(getComputedStyle(element).scrollMarginTop) || 0;
          return Math.abs(Math.round(element.getBoundingClientRect().top - margin));
        }, anchor), { timeout: 20000 })
        .toBeLessThanOrEqual(2);

      const landed = await page.evaluate((id) => ({
        top: Math.round(document.getElementById(id)?.getBoundingClientRect().top ?? -1),
        stickyBottom: Math.round(document.querySelector('header.sticky')?.getBoundingClientRect().bottom ?? 0),
      }), anchor);
      expect(landed.stickyBottom).toBeGreaterThan(0);
      expect(landed.top).toBeGreaterThanOrEqual(landed.stickyBottom - 2);
      expect(landed.top).toBeLessThan(800);
    }
  });

  test('authenticated real release deep links a section, restores it on reload, and updates it from the outline', async ({ page }, testInfo) => {
    requireJourney(testInfo.project.name);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(canonicalWorkingDraft, { waitUntil: 'domcontentloaded' });
    failOnLogin(page.url());
    const outline = page.getByTestId('paper-outline-desktop');
    const entry = outline.getByRole('link').nth(5);
    // Outline hrefs are the canonical Working Draft section query (M1-04).
    const sectionOf = (href: string | null) => new URLSearchParams((href ?? '').replace(/^\?/, '')).get('section') ?? '';
    const anchor = sectionOf(await entry.getAttribute('href'));
    expect(anchor.length).toBeGreaterThan(0);
    await entry.click();
    await expect.poll(() => new URL(page.url()).searchParams.get('section')).toBe(anchor);
    await expect.poll(() => new URL(page.url()).searchParams.get('mode'), { timeout: 30000 }).toBe('working-draft');
    await expect.poll(() => page.evaluate(() => document.activeElement?.id ?? '')).toBe(anchor);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect.poll(() => page.evaluate(() => document.activeElement?.id ?? '')).toBe(anchor);
    // M1-01: the active entry is the focused target, not the predecessor whose tail is still visible.
    await expect.poll(async () => sectionOf(await outline.locator('a[aria-current="location"]').first().getAttribute('href'))).toBe(anchor);
    await expect(outline.locator('a[aria-current="location"]')).toHaveCount(1);

    const firstNodeHref = await page.locator('[data-testid="paper-document"] section[data-paper-chunk]').nth(7).getAttribute('id');
    await page.goto(`${canonicalWorkingDraft}&section=${firstNodeHref ?? ''}`, { waitUntil: 'domcontentloaded' });
    await expect.poll(() => page.evaluate(() => document.activeElement?.id ?? '')).toBe(firstNodeHref ?? '');
  });

  test('authenticated real release reports unavailable assignment truthfully', async ({ page }, testInfo) => {
    requireJourney(testInfo.project.name);
    await page.goto(`${workspacePath}?mode=my-review`, { waitUntil: 'domcontentloaded' });
    failOnLogin(page.url());
    await expect(page.getByText('Assignment unavailable', { exact: true })).toBeVisible();
    await expect(page.getByText(/Assignments are not connected for this release\./)).toBeVisible();
    await expect(page.getByText(/synthetic|fixture/i)).toHaveCount(0);
  });

  test('authenticated real release opens My Review with cohort portions, Review Comments, and question deep links', async ({ page }, testInfo) => {
    requireJourney(testInfo.project.name);
    await page.goto(`${workspacePath}?mode=my-review`, { waitUntil: 'domcontentloaded' });
    failOnLogin(page.url());
    await expect.poll(() => pathAndQuery(page.url())).toBe(`${workspacePath}?mode=my-review`);
    await expect(page.getByRole('link', { name: 'My Review', exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByTestId('cohort-portions-unavailable')).toHaveCount(0);
    await expect(page.getByTestId('cohort-paper').first()).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Review cohorts' }).getByRole('button', { name: /questions$/ })).toHaveCount(5);
    await expect(page.getByTestId('paper-header-actions').getByRole('button', { name: 'Review Comments', exact: true })).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('review-comments-rail')).toHaveAttribute('data-state', 'open');

    const questionId = `rpq:${realVersion}:q04`;
    await page.goto(`${workspacePath}/questions/${encodeURIComponent(questionId)}`, { waitUntil: 'domcontentloaded' });
    await expect.poll(() => new URL(page.url()).searchParams.get('mode')).toBe('my-review');
    await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe(questionId);
    await expect(page.getByRole('combobox', { name: 'Jump to topic' })).toHaveValue('4');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('combobox', { name: 'Jump to topic' })).toHaveValue('4');
  });

  /*
   * M2 (PLAN-R4 3.B.3): local-buffer-only draft text, the saved-questions
   * resume chip, and Prev/Next spanning all 12 questions in cohort order.
   */
  test('M2: authenticated real release saved-questions chip resumes a question, a typed draft survives a reload, and the char count/progress line update', async ({ page }, testInfo) => {
    requireJourney(testInfo.project.name);
    await page.goto(`${workspacePath}?mode=my-review`, { waitUntil: 'domcontentloaded' });
    failOnLogin(page.url());
    await expect(page.getByTestId('review-save-status')).not.toHaveText('Loading saved responses...', { timeout: 30000 });

    const savedQuestions = page.getByTestId('review-saved-questions');
    await expect(savedQuestions.getByRole('button')).toHaveCount(12);
    await savedQuestions.getByRole('button', { name: /^Question 4:/ }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe(`rpq:${realVersion}:q04`);
    await expect(page.getByRole('combobox', { name: 'Jump to topic' })).toHaveValue('4');

    const textarea = page.getByRole('textbox', { name: 'Your response' });
    await textarea.fill('E2E authenticated draft text for question 4.');
    await expect(page.getByTestId('review-comment-char-count')).toHaveText(/^44 \/ 20000$/);
    await expect(page.getByTestId('review-progress')).toContainText('Question 4 of 12');
    await expect(page.getByTestId('review-progress')).toContainText('1 drafted');
    await expect(savedQuestions.getByRole('button', { name: /^Question 4:/ })).toContainText('Drafted');

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('textbox', { name: 'Your response' })).toHaveValue('E2E authenticated draft text for question 4.');
  });

  test('M2: authenticated real release per-portion "Open in Working Draft" link opens the canonical Working Draft on that section', async ({ page }, testInfo) => {
    requireJourney(testInfo.project.name);
    await page.goto(`${workspacePath}?mode=my-review`, { waitUntil: 'domcontentloaded' });
    failOnLogin(page.url());
    const link = page.getByTestId('cohort-paper-stack').getByRole('link', { name: 'Open in Working Draft' }).first();
    const href = await link.getAttribute('href');
    expect(href).toMatch(/mode=working-draft&section=/);
    await link.click();
    await expect.poll(() => new URL(page.url()).searchParams.get('mode'), { timeout: 30000 }).toBe('working-draft');
    await expect(page.getByRole('link', { name: 'Working Draft', exact: true })).toHaveAttribute('aria-current', 'page', { timeout: 30000 });
  });

  test('M2: authenticated real release Previous/Next question walk all 12 questions in cohort order, bounded at both ends', async ({ page }, testInfo) => {
    requireJourney(testInfo.project.name);
    await page.goto(`${workspacePath}?mode=my-review`, { waitUntil: 'domcontentloaded' });
    failOnLogin(page.url());
    await expect(page.getByTestId('review-save-status')).not.toHaveText('Loading saved responses...', { timeout: 30000 });
    const previous = page.getByRole('button', { name: 'Previous question' });
    const next = page.getByRole('button', { name: 'Next question' });
    const select = page.getByRole('combobox', { name: 'Jump to topic' });

    await expect(previous).toBeDisabled();
      for (let step = 0; step < 11; step += 1) {
        await next.click();
        await expect(page.getByTestId('review-progress')).toContainText(`Question ${step + 2} of 12`);
      }
    await expect(next).toBeDisabled();
    await expect(page.getByTestId('review-progress')).toContainText('Question 12 of 12');
    await previous.click();
    await expect(next).toBeEnabled();
    await expect(select).not.toHaveValue('12');
  });

  test('M3: intercepted response save, submit, reload and CAS conflict expose the authenticated workflow', async ({ page }, testInfo) => {
    requireJourney(testInfo.project.name);
    const questionId = `rpq:${realVersion}:q01`;
    const userKey = '11111111-1111-4111-8111-111111111111';
    let reviewManifestSha256 = '';
    let savedRow: Record<string, unknown> | null = null;
    let forceConflict = false;
    await page.route('**/api/matrix-options/paper/reviews?*', async (route) => {
      reviewManifestSha256 = new URL(route.request().url()).searchParams.get('manifestSha256') ?? '';
      await route.fulfill({ status: 200, headers: { 'Cache-Control': 'no-store' }, contentType: 'application/json', body: JSON.stringify({ persistence: 'available', userKey, rows: savedRow ? [savedRow] : [] }) });
    });
    await page.route('**/api/matrix-options/paper/reviews/**', async (route) => {
      const body = JSON.parse(route.request().postData() ?? '{}') as { action?: string; text?: string; expectedRevision?: number | null };
      if (forceConflict) {
        await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ outcome: 'stale_revision', row: { ...savedRow, draft_text: 'saved in another tab', revision: 9 } }) });
        return;
      }
      const revision = Number(savedRow?.revision ?? 0) + 1;
      savedRow = { id: 'response-1', document_version: realVersion, manifest_sha256: reviewManifestSha256, cohort_id: 'categories', question_id: questionId, draft_text: body.text ?? '', submitted_text: body.action === 'submit' ? body.text ?? '' : (savedRow?.submitted_text ?? null), revision, submitted_revision: body.action === 'submit' ? revision : (savedRow?.submitted_revision ?? null), submitted_at: body.action === 'submit' ? new Date().toISOString() : (savedRow?.submitted_at ?? null), updated_at: new Date().toISOString() };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ outcome: 'ok', row: savedRow }) });
    });
    await page.goto(`${workspacePath}?mode=my-review`, { waitUntil: 'domcontentloaded' });
    failOnLogin(page.url());
    const textarea = page.getByRole('textbox', { name: 'Your response' });
    await textarea.fill('intercepted M3 response');
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(page.getByTestId('review-save-status')).toContainText('Saved');
    await page.getByRole('button', { name: 'Submit response' }).click();
    await expect(page.getByRole('button', { name: 'Re-submit response' })).toBeVisible();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('textbox', { name: 'Your response' })).toHaveValue('intercepted M3 response');
    forceConflict = true;
    await page.getByRole('textbox', { name: 'Your response' }).fill('local conflict text');
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(page.getByTestId('review-conflict')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Keep mine' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Use saved' })).toBeVisible();
    await page.getByRole('button', { name: 'Use saved' }).click();
    await expect(page.getByRole('textbox', { name: 'Your response' })).toHaveValue('saved in another tab');
    // The Logout assertion that used to end this test now lives in the dedicated
    // SESSION_TEARDOWN_TAG test below. Logout calls supabase.auth.signOut() with the default
    // GLOBAL scope, which revokes every session of the E2E user - including the shared
    // storage-state session every later test in this project starts from. Run here, it sent
    // each subsequent authenticated test to /login.
  });

  test('M2: authenticated real release rails keep review and download controls usable across phone, tablet, desktop, and wide layouts', async ({ page }, testInfo) => {
    requireJourney(testInfo.project.name);
    for (const width of [320, 767, 768, 1023, 1024, 1440]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(`${workspacePath}?mode=my-review`, { waitUntil: 'domcontentloaded' });
      failOnLogin(page.url());
      await expect(page.getByTestId('review-comment-draft')).toBeVisible();
      const reviewComments = page.getByTestId('paper-header-actions').getByRole('button', { name: 'Review Comments', exact: true });
      const downloads = page.getByTestId('workspace-header-controls').getByRole('button', { name: 'Download Files', exact: true });
      await expect(reviewComments).toBeVisible();
      await expect(downloads).toBeVisible();
      for (const control of [reviewComments, downloads]) {
        const box = await control.boundingBox();
        expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    }
  });

  test('authenticated real release rails close with focus rescue and reveal opened panels at 360 and 768', async ({ page }, testInfo) => {
    requireJourney(testInfo.project.name);
    for (const width of [360, 768]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(`${workspacePath}?mode=my-review`, { waitUntil: 'domcontentloaded' });
      failOnLogin(page.url());
      /*
       * M1R5-03 (codex r4-luna-1, accepted). The rail expands under a 300ms
       * transition, so geometry read straight after toBeFocused() can be an
       * INTERMEDIATE position: the assertion could pass, or fail, on a frame
       * that is not the landing. Poll until the heading's top stops moving
       * first. run-003's own harness samples a landing until it settles; the
       * repo e2e must be at least as strict.
       */
      const settledHeadingGeometry = async (selector: string) => {
        let previous: number | null = null;
        let stable = 0;
        let latest = { top: Number.NaN, stickyBottom: 0, atMaxScroll: false, viewportHeight: 0 };
        /*
         * M1R8-06 (informed Opus holistic pass, P3-7). Two samples 100 ms apart
         * can be "stable" about 300 ms after the panel opens, while the
         * component may still OWN the scrollport for PAPER_REVEAL_SETTLE_TIMEOUT_MS
         * and still apply a deadline correction after that -- so the landing the
         * assertions below judged would not be the resting one. The settle
         * criterion is therefore tied to the component's own bound: no reading is
         * accepted until the sampling window has outlasted the ownership window.
         */
        const startedAt = Date.now();
        const elapsed = () => Date.now() - startedAt;
        for (let attempt = 0; attempt < 40; attempt += 1) {
          latest = await page.evaluate((id) => {
            const element = document.querySelector(id);
            const header = document.querySelector('header.sticky');
            const root = document.documentElement;
            return {
              // M1R6-05: UNROUNDED, so the occlusion guard below is exactly the
              // unit predicate and not a rounded approximation of it.
              top: element ? element.getBoundingClientRect().top : Number.NaN,
              stickyBottom: header ? header.getBoundingClientRect().bottom : 0,
              atMaxScroll: root.scrollHeight > window.innerHeight && window.scrollY + window.innerHeight >= root.scrollHeight - 1,
              viewportHeight: window.innerHeight,
            };
          }, selector);
          if (previous !== null && Math.abs(latest.top - previous) < 0.1) {
            stable += 1;
            if (stable >= 2 && elapsed() > PAPER_REVEAL_SETTLE_TIMEOUT_MS) return latest;
          } else {
            stable = 0;
          }
          previous = latest.top;
          await page.waitForTimeout(100);
        }
        /*
         * M1R7-05 (codex r6-luna-1). Falling out of this loop used to return the
         * last sample, so geometry that never settled was asserted on as though
         * it had -- the same "a check only verifies if its scope could have
         * failed" class as the caller below, in the measurement rather than the
         * assertion. An unsettled landing makes every assertion that follows
         * meaningless, so it fails here, loudly, naming what did not settle.
         */
        throw new Error(`M1R7-05/M1R8-06: ${selector} never settled: 40 polls without two consecutive stable tops sampled beyond the ${PAPER_REVEAL_SETTLE_TIMEOUT_MS}ms reveal-ownership window; elapsed ${elapsed()}ms, last top ${latest.top}, sticky bottom ${latest.stickyBottom}. The landing assertions below would have run on an intermediate frame, or on one the deadline correction had not reached yet.`);
      };

      /**
       * M1R6-02 (browser run-004 section 9, caveat 1). Polls a panel's own
       * height until it stops changing, so a panel is only ever re-opened from a
       * SETTLED closed state.
       */
      const settledPanelHeight = async (selector: string) => {
        let previous: number | null = null;
        let stable = 0;
        for (let attempt = 0; attempt < 40; attempt += 1) {
          const height = await page.evaluate((id) => {
            const element = document.querySelector(id);
            return element ? element.getBoundingClientRect().height : 0;
          }, selector);
          if (previous !== null && Math.abs(height - previous) < 0.1) {
            stable += 1;
            if (stable >= 2) return height;
          } else {
            stable = 0;
          }
          previous = height;
          await page.waitForTimeout(100);
        }
        /*
         * M1R7-05 (codex r6-luna-1), the finding as codex wrote it. This used to
         * return the last polled height after 40 attempts and the caller ignored
         * the result, so a collapse that never settled let the panel be re-opened
         * from a half-collapsed state -- which is EXACTLY the sequence browser
         * run-004 section 7.2 identified as the one that hides the 24px defect
         * (the rail is still nearly expanded, so almost no expansion remains
         * after the reveal's correction measures). Silently skipping this
         * precondition does not weaken the test a little; it turns it into a
         * different test that cannot fail for the reason it was written.
         */
        throw new Error(`M1R7-05: ${selector} never settled: 40 polls (about 4s) without two consecutive stable heights; last height ${previous ?? 'none'}. Re-opening from an unsettled collapse is the one sequence that hides the landing defect this test exists to catch.`);
      };

      const panels = [
        { toggle: page.getByTestId('paper-header-actions').getByRole('button', { name: 'Navigation', exact: true }), heading: page.locator('#paper-navigation-rail-heading'), selector: '#paper-navigation-rail-heading', panel: '#paper-navigation-rail' },
        { toggle: page.getByTestId('paper-header-actions').getByRole('button', { name: 'Review Comments', exact: true }), heading: page.locator('#paper-review-comments-rail-heading'), selector: '#paper-review-comments-rail-heading', panel: '#paper-review-comments-rail' },
        { toggle: page.getByTestId('workspace-header-controls').getByRole('button', { name: 'Download Files', exact: true }), heading: page.locator('#paper-download-files-heading'), selector: '#paper-download-files-heading', panel: '#paper-download-files-panel' },
      ];
      for (const { toggle, heading, selector, panel } of panels) {
        if ((await toggle.getAttribute('aria-expanded')) === 'true') {
          await toggle.click();
          await expect(toggle).toHaveAttribute('aria-expanded', 'false');
          await expect(toggle).toBeFocused();
          /*
           * M1R6-02 (codex r4-luna-1 [P1], REINSTATED by browser run-004). This
           * wait is the whole reason this assertion can fail at all. The test
           * used to close a panel and re-open it IMMEDIATELY, and run-004
           * section 7.2 measured that this is the ONE sequence in which the
           * landing is genuinely 0: the rail is still nearly expanded, so almost
           * no expansion remains after the reveal's correction measures. The
           * same build, in the same session, measured +24 at rest when the
           * collapse was allowed to finish first -- which is what a reader
           * actually does. The settle poll below was already correct and would
           * have settled on 161 just as readily as on 137; it is the SEQUENCE
           * that hid the 24px, not the sampling. So: let the collapse finish.
           */
          await settledPanelHeight(panel);
        }
        await toggle.click();
        await expect(toggle).toHaveAttribute('aria-expanded', 'true');
        await expect(heading).toBeFocused();
        await expect(heading).toBeVisible();
        const landing = await settledHeadingGeometry(selector);
        expect(landing.stickyBottom).toBeGreaterThan(0);
        /*
         * Occlusion -- the defect this work stream fixed -- fails here whatever
         * the scroll position is. This is the assertion that must stay able to
         * fail, and the clamp branch below never relaxes it.
         *
         * M1R6-05 (codex r5-luna-1 R5-04-E2E). This guard used to read
         * `>= stickyBottom - 1`, which ADMITTED a 1px occlusion: a heading at 76
         * under a sticky bottom of 77 passed here, and because atMaxScroll then
         * skipped the reading-line assertion, an occluded landing could pass the
         * whole check. The unit predicate panelRevealLandingSatisfied rejects
         * exactly that geometry (`if (headingTop < stickyHeaderHeight) return
         * false`, proven both ways in run-004 section 10: "occluded by 1px at
         * maximum scroll -> false", "exactly on the line -> true"). Two
         * assertions of the same contract must not disagree about their
         * boundary, so this is now the predicate's boundary exactly, on the same
         * unrounded geometry the predicate would see.
         */
        expect(landing.top).toBeGreaterThanOrEqual(landing.stickyBottom);
        expect(landing.top).toBeLessThan(landing.viewportHeight);
        // M1R4-02 (PLAN-R4 3.A item 4). Browser run-002 measured Navigation and
        // Review Comments at 24px and 20px under a 129px sticky header at 360
        // and 768 -- the rails' own padding -- because a rail is an
        // overflow:hidden scroll container and clips the scroll-margin box. The
        // reveal now corrects by an explicit measured delta, so the heading must
        // land ON the reading line (header + the 0.5rem the scroll-margin
        // utility adds, i.e. PAPER_PANEL_REVEAL_GAP_PX), not merely below the
        // header. Asserting only "below the header" is what let 24px pass here
        // while the browser run failed it.
        //
        // M1R5-04 (browser run-003 sections 6.2 and 7, DECISION (a)). The one
        // exception is a scrollport already at MAXIMUM SCROLL: My Review's
        // Review Comments heading at 768x1024 is the last element of the stacked
        // layout and landed at 348 needing 85 because the +263px correction had
        // nowhere to go. The reading line is not a contract the browser can
        // honour there, so at maximum scroll the contract is visible, focused
        // and below the sticky header -- all three already asserted above.
        if (!landing.atMaxScroll) {
          expect(Math.abs(landing.top - (landing.stickyBottom + PAPER_PANEL_REVEAL_GAP_PX))).toBeLessThanOrEqual(2);
        }
        await toggle.click();
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
        await expect(toggle).toBeFocused();
      }
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    }
  });

  test('authenticated real release user can view download controls and download all expected PDFs and DOCXs', async ({ page }, testInfo) => {
    requireJourney(testInfo.project.name);
    test.setTimeout(120000); // Allow time for compilation and downloads
    await page.goto(`${workspacePath}?mode=my-review`, { waitUntil: 'domcontentloaded' });
    failOnLogin(page.url());

    // Open the download files panel and handle React hydration races
    const downloadToggle = page.getByTestId('workspace-header-controls').getByRole('button', { name: 'Download Files', exact: true });

    // Wait for the client-only Navigation button to become visible as a hydration sentinel
    const navigationButton = page.getByTestId('paper-header-actions').getByRole('button', { name: 'Navigation', exact: true });
    await expect(navigationButton).toBeVisible();

    // Wait for the button to be interactive and hydrated
    await expect(downloadToggle).toBeVisible();
    await expect(downloadToggle).toBeEnabled();
    await downloadToggle.click();
    await expect(downloadToggle).toHaveAttribute('aria-expanded', 'true');

    // Verify the panel opens and the heading is visible
    const panel = page.getByTestId('download-files-panel');
    await expect(panel).toBeVisible();

    // Verify PDF and DOCX packages are present (2 total packages for the active cohort)
    const packageItems = panel.getByRole('listitem');
    await expect(packageItems).toHaveCount(2);

    // Verify exact package IDs, metadata, lengths, and hashes rendered in the UI
    const pdfItem = packageItems.nth(0);
    const docxItem = packageItems.nth(1);

    await expect(pdfItem).toContainText('categories PDF');
    await expect(pdfItem).toContainText('matrix-options-categories-preview.pdf - 110968 bytes - SHA-256 b1cf2731823687c30612fbf56e5b87049b32cd9ec0b4f5dbaf2d9ff06d19ff7f');

    await expect(docxItem).toContainText('categories DOCX');
    await expect(docxItem).toContainText('matrix-options-categories-preview.docx - 38137 bytes - SHA-256 7572fae5c934b2da8c6fdc9c37a948f2efd392dde76bb65fbbf07f119f8c93b3');

    // The download controls are BUTTONS, not links: the panel fetches and verifies
    // the response before writing anything, so a JSON error can never be saved as
    // a .pdf. There is therefore no href to read - the route URL is derived from
    // the package id, exactly as the manifest builds it.
    await expect(pdfItem.getByRole('button', { name: 'Download PDF' })).toBeVisible();
    await expect(docxItem.getByRole('button', { name: 'Download DOCX' })).toBeVisible();
    const pdfHref = '/api/matrix-options/paper/downloads/categories-pdf';
    const docxHref = '/api/matrix-options/paper/downloads/categories-docx';

    // Everything above is provable TODAY. Everything below requires the private
    // Supabase bucket to be provisioned; until then the artifact route correctly
    // fails closed with 503 and these exact-byte assertions cannot pass.
    //
    // This is an explicit, visible skip bound to an env flag - NOT a weakened
    // assertion and NOT treating 503 as success. After the owner-approved
    // provisioning, set MATRIX_TWG_PACKAGES_PROVISIONED=true and these become
    // hard assertions again.
    test.skip(
      process.env.MATRIX_TWG_PACKAGES_PROVISIONED !== 'true',
      'Artifact bytes require the matrix-twg-packages bucket. Set MATRIX_TWG_PACKAGES_PROVISIONED=true after provisioning.',
    );

    // Validate actual response status, headers, lengths, and hashes for PDF
    const pdfResponse = await page.request.get(pdfHref!);
    expect(pdfResponse.status()).toBe(200);
    expect(pdfResponse.headers()['content-type']).toBe('application/pdf');
    expect(pdfResponse.headers()['content-length']).toBe('110968');
    const pdfBody = await pdfResponse.body();
    const crypto = await import('crypto');
    const pdfHash = crypto.createHash('sha256').update(pdfBody).digest('hex');
    expect(pdfHash).toBe('b1cf2731823687c30612fbf56e5b87049b32cd9ec0b4f5dbaf2d9ff06d19ff7f');

    // Validate actual response status, headers, lengths, and hashes for DOCX
    const docxResponse = await page.request.get(docxHref!);
    expect(docxResponse.status()).toBe(200);
    expect(docxResponse.headers()['content-type']).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    expect(docxResponse.headers()['content-length']).toBe('38137');
    const docxBody = await docxResponse.body();
    const docxHash = crypto.createHash('sha256').update(docxBody).digest('hex');
    expect(docxHash).toBe('7572fae5c934b2da8c6fdc9c37a948f2efd392dde76bb65fbbf07f119f8c93b3');
  });

  test('unauthenticated and anonymous users are securely denied access to the print package manifest and artifacts', async ({ playwright, baseURL }) => {
    // storageState is EXPLICITLY empty. In the chromium-auth project a bare
    // playwright.request.newContext() inherits the project's stored session, so this test
    // used to send AUTHENTICATED requests: the manifest route (which authenticates before it
    // parses its query) answered 400 MISSING_QUERY_PARAMETER instead of 401.
    const anonContext = await playwright.request.newContext({ baseURL: baseURL!, storageState: { cookies: [], origins: [] } });
    try {
      // The context must carry no credential at all, or every 401 below proves nothing.
      expect((await anonContext.storageState()).cookies).toHaveLength(0);

      // 1. Manifest endpoint
      const manifestResponse = await anonContext.get('/api/matrix-options/paper/downloads');
      expect(manifestResponse.status()).toBe(401);
      const manifestJson = await manifestResponse.json();
      expect(manifestJson.code).toBe('UNAUTHORIZED');

      // 2. EVERY package artifact endpoint, from the reviewed print-package catalog.
      expect(printPackageIds).toHaveLength(10);
      for (const packageId of printPackageIds) {
        const artifactResponse = await anonContext.get(`/api/matrix-options/paper/downloads/${packageId}`);
        expect(artifactResponse.status(), packageId).toBe(401);
        const artifactJson = await artifactResponse.json();
        expect(artifactJson.code, packageId).toBe('UNAUTHORIZED');
      }
    } finally {
      await anonContext.dispose();
    }
  });

  // Runs ONLY in the chromium-auth-session-teardown project: chromium-auth's Playwright TEARDOWN, so it
  // starts after every shared-session test has finished. Playwright re-adds teardown suites without
  // applying the CLI --grep, so any run that selects chromium-auth (including the standard harness,
  // scripts/verify/matrix-paper-e2e.mjs) also runs it; the chromium-auth projects grepInvert the tag.
  //
  // The app's Logout is a GLOBAL sign-out. Sent for real, it would revoke EVERY session of the shared
  // E2E account - including sessions held by any other run using that account at the same moment
  // (another local run, a concurrent CI workflow), which Playwright ordering cannot protect. So only
  // the GoTrue logout request is intercepted: the app's real logout path runs end to end (button ->
  // signOut -> local session cleared -> redirect -> middleware refuses the protected route), and the
  // test proves the app asked GoTrue for a GLOBAL sign-out, without revoking anyone's session.
  // If the intercept ever stops matching, the request-count assertion fails the test.
  test(`${SESSION_TEARDOWN_TAG} authenticated real release logout ends the session and returns to /login`, async ({ page }, testInfo) => {
    test.skip(!reviewNavigationEnabled, 'The standard E2E harness supplies both exact-true flags for this journey.');
    test.skip(testInfo.project.name !== SESSION_TEARDOWN_PROJECT, 'Session-ending tests run only after every shared-session test has finished.');
    const logoutRequests: string[] = [];
    await page.route('**/auth/v1/logout**', async (route) => {
      logoutRequests.push(route.request().url());
      await route.fulfill({ status: 204, body: '', headers: { 'access-control-allow-origin': route.request().headers()['origin'] ?? '*', 'access-control-allow-credentials': 'true' } });
    });
    await page.goto(`${workspacePath}?mode=my-review`, { waitUntil: 'domcontentloaded' });
    failOnLogin(page.url());
    await expect(page.getByRole('textbox', { name: 'Your response' })).toBeVisible();
    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page).toHaveURL(/\/login/);
    // The app asked GoTrue to end the session, exactly once, with GLOBAL scope.
    expect(logoutRequests).toHaveLength(1);
    expect(new URL(logoutRequests[0]).searchParams.get('scope')).toBe('global');
    // The browser no longer holds the Supabase session cookie.
    const authCookies = (await page.context().cookies()).filter((cookie) => /^sb-.+-auth-token/.test(cookie.name));
    expect(authCookies).toHaveLength(0);
    // And the session is really gone for this browser: the protected workspace redirects to /login.
    await page.goto(`${workspacePath}?mode=my-review`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/login/);
  });
});
