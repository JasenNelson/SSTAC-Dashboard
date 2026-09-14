import { expect, test } from '@playwright/test';

const realVersion = '1.0.11-remediated-20260913';
const realReviewPath = `/matrix-options/paper/review/v/${realVersion}`;
const legacyFixtureVersion = 'slice-1a-fixture-v1';
const legacySectionPath = `/matrix-options/paper/v/${legacyFixtureVersion}/synthetic.framework.example`;
const paperWorkspaceEnabled = process.env.MATRIX_OPTIONS_PAPER_WORKSPACE === 'true';
const reviewNavigationEnabled = paperWorkspaceEnabled && process.env.MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION === 'true';

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
  test('authenticated real release opens node, object, question, and both modes', async ({ page }, testInfo) => {
    test.skip(!reviewNavigationEnabled, 'The standard E2E harness supplies both exact-true flags for this journey.');
    if (testInfo.project.name !== 'chromium-auth') test.skip(true, 'This journey is required only in the authenticated Chromium project.');

    for (const [mode, lens, expectedPath] of [
      ['my-review', 'all', '/nodes/'],
      ['publication', 'objects', '/nodes/'],
      ['my-review', 'questions', '/questions/'],
    ] as const) {
      await page.goto(`${realReviewPath}?mode=${mode}&lens=${lens}&page=1`, { waitUntil: 'domcontentloaded' });
      if (page.url().includes('/login')) throw new Error('REAL_V16_AUTH_REQUIRED_BUT_LOGIN_REDIRECTED');
      await expect(page.getByRole('main')).toHaveCount(1);
      const atlas = page.getByRole('list', { name: 'Current atlas page' });
      const firstLink = atlas.getByRole('link').first();
      await expect(firstLink).toHaveAttribute('href', new RegExp(`mode=${mode}`));
      await firstLink.click();
      await expect.poll(() => page.url()).toContain(expectedPath);
      await expect.poll(() => new URL(page.url()).searchParams.get('mode')).toBe(mode);
      await expect(page.getByTestId('trust-strip')).toBeVisible();
    }
  });

  test('authenticated real release reports unavailable assignment truthfully', async ({ page }, testInfo) => {
    test.skip(!reviewNavigationEnabled, 'The standard E2E harness supplies both exact-true flags for this journey.');
    if (testInfo.project.name !== 'chromium-auth') test.skip(true, 'This journey is required only in the authenticated Chromium project.');
    await page.goto(`${realReviewPath}?mode=my-review&lens=all&page=1`, { waitUntil: 'domcontentloaded' });
    if (page.url().includes('/login')) throw new Error('REAL_V16_AUTH_REQUIRED_BUT_LOGIN_REDIRECTED');
    await expect(page.getByText('Assignment unavailable', { exact: true })).toBeVisible();
    await expect(page.getByText(/Assignments are not connected for this release\./)).toBeVisible();
    await expect(page.getByText(/synthetic|fixture/i)).toHaveCount(0);
  });

  test('authenticated real release exercises reader references, controls, history, notes, and print bounds', async ({ page }, testInfo) => {
    test.skip(!reviewNavigationEnabled, 'The standard E2E harness supplies both exact-true flags for this journey.');
    if (testInfo.project.name !== 'chromium-auth') test.skip(true, 'This journey is required only in the authenticated Chromium project.');

    await page.goto(`${realReviewPath}?mode=my-review&lens=all&page=1`, { waitUntil: 'domcontentloaded' });
    if (page.url().includes('/login')) throw new Error('REAL_V16_AUTH_REQUIRED_BUT_LOGIN_REDIRECTED');

    await page.getByRole('link', { name: 'Publication', exact: true }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get('mode')).toBe('publication');
    await page.getByRole('link', { name: 'My Review', exact: true }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get('mode')).toBe('my-review');

    const next = page.getByRole('link', { name: 'Next', exact: true });
    await expect(next).toBeVisible();
    await next.click();
    await expect.poll(() => new URL(page.url()).searchParams.get('page')).toBe('2');
    await page.getByRole('link', { name: 'Previous', exact: true }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get('page')).toBe('1');

    // Use an isolated authenticated page and a unique, valid filtered root so Back
    // must restore this exact history entry without contaminating later checks.
    const historyPage = await page.context().newPage();
    const historyRoot = `${realReviewPath}?mode=my-review&lens=all&page=1&q=7.1`;
    await historyPage.goto(historyRoot, { waitUntil: 'networkidle' });
    const historyRootUrl = new URL(historyRoot, historyPage.url());
    await expect.poll(() => historyPage.url()).toBe(historyRootUrl.href);
    const firstAtlasLink = historyPage.getByRole('list', { name: 'Current atlas page' }).getByRole('link').first();
    const firstAtlasHref = new URL(await firstAtlasLink.getAttribute('href') ?? '', historyPage.url());
    expect(firstAtlasHref.pathname).toMatch(/^\/matrix-options\/paper\/publication\/v\/1\.0\.11-remediated-20260913\/nodes\//);
    expect(firstAtlasHref.searchParams.get('mode')).toBe('my-review');
    expect(firstAtlasHref.searchParams.get('lens')).toBe('all');
    expect(firstAtlasHref.searchParams.get('q')).toBe('7.1');
    expect(firstAtlasHref.searchParams.get('page')).toBe('1');
    await firstAtlasLink.click();
    await expect.poll(() => historyPage.url()).toContain('/nodes/');
    await historyPage.goBack({ waitUntil: 'networkidle' });
    await expect.poll(() => historyPage.url()).toBe(historyRootUrl.href);
    await historyPage.goForward({ waitUntil: 'networkidle' });
    await expect.poll(() => historyPage.url()).toContain('/nodes/');
    await expect.poll(() => new URL(historyPage.url()).searchParams.get('mode')).toBe('my-review');
    await expect.poll(() => new URL(historyPage.url()).searchParams.get('q')).toBe('7.1');
    await historyPage.close();

    await page.goto(`${realReviewPath}?mode=my-review&lens=all&page=1`, { waitUntil: 'networkidle' });
    await page.getByRole('list', { name: 'Current atlas page' }).getByRole('link').first().click();
    await expect.poll(() => page.url()).toContain('/nodes/');

    const readerReferences = page.locator('[data-reader-detail-id] a[href*="/matrix-options/paper/publication/v/"]');
    await expect.poll(() => readerReferences.count()).toBeGreaterThan(1);
    const referenceHrefs = await readerReferences.evaluateAll((links) => [...new Set(links.map((link) => (link as HTMLAnchorElement).href))]);
    expect(referenceHrefs.length).toBeGreaterThan(1);
    for (const href of referenceHrefs.slice(0, 2)) {
      await page.goto(href, { waitUntil: 'domcontentloaded' });
      await expect.poll(() => page.url()).toContain('/nodes/');
      await expect(page.getByTestId('trust-strip')).toBeVisible();
    }

    await page.goto(`${realReviewPath}?mode=my-review&lens=all&page=1`, { waitUntil: 'networkidle' });
    const contextToggle = page.getByTestId('trust-strip').locator('button[aria-controls="context-drawer"]');
    await expect(contextToggle).toHaveAttribute('aria-expanded', 'false');
    await contextToggle.click();
    await expect(contextToggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('dialog', { name: 'Context details' })).toBeVisible();
    await page.getByRole('textbox', { name: 'Note' }).fill('release-boundary smoke note');
    await expect(page.getByRole('status')).toContainText(/Saved locally|Retained for this session/);
    await page.getByRole('button', { name: 'Close context', exact: true }).click();
    await expect(contextToggle).toBeFocused();

    await page.goto(`${realReviewPath}?mode=my-review&lens=all&page=1`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('list', { name: 'Current atlas page' }).getByRole('link').first().click();
    const paperReader = page.locator('[data-reader-detail-id] .math-renderer');
    await expect(paperReader).toBeVisible();

    await page.setViewportSize({ width: 375, height: 812 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await page.emulateMedia({ media: 'print' });
    await expect(paperReader).toBeVisible();
    await expect(page.locator('header').filter({ hasText: 'SSTAC & TWG' })).toHaveCSS('display', 'none');
    await expect(page.locator('header').filter({ hasText: 'Policy Review' })).toHaveCSS('display', 'none');
    await expect(page.locator('[data-testid="workspace-shell"] > header')).toHaveCSS('display', 'none');
    await expect.poll(() => page.getByTestId('trust-strip').evaluate((element) => {
      let current: Element | null = element;
      while (current) {
        if (getComputedStyle(current).display === 'none') return true;
        current = current.parentElement;
      }
      return false;
    })).toBe(true);
    await page.emulateMedia({ media: 'screen' });
  });
});
