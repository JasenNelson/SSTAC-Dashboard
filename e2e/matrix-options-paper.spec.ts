import { expect, test } from '@playwright/test';

const fixtureVersion = 'slice-1a-fixture-v1';
const sectionPath = `/matrix-options/paper/v/${fixtureVersion}/synthetic.framework.example`;
const paperWorkspaceEnabled = process.env.MATRIX_OPTIONS_PAPER_WORKSPACE === 'true';
const unrelatedRequestPattern = /matrix-map|\/rest\/v1\/(?:matrix_|parameter_|sediment_)|\/rpc\/(?!get_my_user_role)|\/api\/matrix-options/;

test.describe('Matrix Options Paper Slice 1A', () => {
  test('enabled old TWG query redirects before unrelated dashboard work', async ({ page }) => {
    test.skip(!paperWorkspaceEnabled, 'Enabled-state assertion runs in the companion enabled command.');
    const unrelatedRequests: string[] = [];
    page.on('request', (request) => {
      if (unrelatedRequestPattern.test(request.url())) unrelatedRequests.push(request.url());
    });
    await page.goto('/matrix-options?view=TWG%20Review', { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(new RegExp(`/matrix-options/paper/v/${fixtureVersion}$`));
    await expect(page.getByRole('heading', { name: 'Synthetic Matrix Options Paper Reader Fixture' })).toBeVisible();
    await expect(page.locator('[data-testid="twg-review-portal"]')).toHaveCount(0);
    expect(await page.content()).not.toContain('No external paper content.');
    expect(unrelatedRequests).toEqual([]);
  });

  test('disabled old TWG query preserves the legacy portal', async ({ page }) => {
    test.skip(paperWorkspaceEnabled, 'Disabled-state assertion runs in the companion disabled command.');
    await page.goto('/matrix-options?view=TWG%20Review', { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/\/matrix-options\?view=TWG(?:%20|\+)Review$/);
    await expect(page.locator('#matrix-dashboard-tabpanel')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Final Master Draft' })).toBeVisible();
  });

  test('disabled direct paper routes fall back before any follow-up paper request', async ({ page }) => {
    test.skip(paperWorkspaceEnabled, 'Disabled-state assertion runs in the companion disabled command.');
    const directPaths = [
      '/matrix-options/paper',
      `/matrix-options/paper/v/${fixtureVersion}`,
      sectionPath,
      `/matrix-options/paper/v/${fixtureVersion}/missing-section`,
    ];
    for (const directPath of directPaths) {
      const paperRequests: string[] = [];
      const listener = (request: { url(): string }) => {
        if (new URL(request.url()).pathname.startsWith('/matrix-options/paper')) paperRequests.push(request.url());
      };
      page.on('request', listener);
      await page.goto(directPath, { waitUntil: 'networkidle' });
      page.off('request', listener);
      await expect(page).toHaveURL(/\/matrix-options\?view=TWG(?:%20|\+)Review$/);
      await expect(page.getByRole('heading', { name: 'Final Master Draft' })).toBeVisible();
      expect(paperRequests).toHaveLength(1);
      expect(await page.content()).not.toContain('Synthetic Matrix Options Paper Reader Fixture');
    }
  });

  test('all six non-paper destinations retain their query and selected tab', async ({ page }) => {
    const destinations = [
      ['The Guide', 'Guide'],
      ['Vision for Modernizing Schedule 3.4', 'Modernizing Schedule 3.4'],
      ['Interactive Map', 'Database'],
      ['Calculator', 'Calculator'],
      ['SSD Workbench', 'SSD Workbench'],
      ['References & Values', 'Catalogue'],
    ] as const;
    for (const [viewId, label] of destinations) {
      await page.goto(`/matrix-options?view=${encodeURIComponent(viewId)}`, { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(new RegExp(`view=${encodeURIComponent(viewId).replace(/%/g, '%')}$`));
      await expect(page.getByRole('tab', { name: label, exact: true })).toHaveAttribute('aria-selected', 'true');
    }
  });

  test('direct section route reloads, tracks history, and makes no map or data API request', async ({ page }, testInfo) => {
    test.skip(!paperWorkspaceEnabled, 'Enabled-state assertion runs in the companion enabled command.');
    const unrelatedRequests: string[] = [];
    page.on('request', (request) => {
      if (unrelatedRequestPattern.test(request.url())) unrelatedRequests.push(request.url());
    });
    await page.goto(sectionPath, { waitUntil: 'domcontentloaded' });
    if (page.url().includes('/login')) {
      test.skip(testInfo.project.name !== 'chromium-auth', 'Authenticated Matrix Options fixture is exercised by chromium-auth.');
    }

    await page.reload({ waitUntil: 'networkidle' });
    await expect(page).toHaveURL(new RegExp(`${sectionPath}$`));
    await expect(page.getByRole('heading', { name: 'Invented worked example', level: 1 })).toBeVisible();
    await expect(page.getByText('Illustrative only', { exact: false }).first()).toBeVisible();
    expect(unrelatedRequests).toEqual([]);

    await page.getByRole('link', { name: 'Slice boundary appendix' }).last().click();
    await expect(page).toHaveURL(new RegExp('synthetic.appendix$'));
    await page.goBack();
    await expect(page).toHaveURL(new RegExp('synthetic.framework.example$'));
  });

  test('reader exposes accessible landmarks and switches to the mobile contents disclosure', async ({ page }, testInfo) => {
    test.skip(!paperWorkspaceEnabled, 'Enabled-state assertion runs in the companion enabled command.');
    await page.goto(sectionPath, { waitUntil: 'domcontentloaded' });
    if (page.url().includes('/login')) {
      test.skip(testInfo.project.name !== 'chromium-auth', 'Authenticated Matrix Options fixture is exercised by chromium-auth.');
    }
    await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Adjacent sections' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Download canonical PDF' })).toBeDisabled();
    await expect(page.getByRole('main')).toHaveCount(1);
    const selectedTab = page.getByRole('tab', { name: 'Options Paper', exact: true });
    const panel = page.getByRole('tabpanel');
    await expect(selectedTab).toHaveAttribute('id', 'matrix-tab-twg-review');
    await expect(selectedTab).toHaveAttribute('aria-controls', 'matrix-options-paper-tabpanel');
    await expect(panel).toHaveAttribute('id', 'matrix-options-paper-tabpanel');
    await expect(panel).toHaveAttribute('aria-labelledby', 'matrix-tab-twg-review');

    await page.setViewportSize({ width: 375, height: 812 });
    await expect(page.getByText('Document contents', { exact: true })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('not-found state preserves one main landmark and the selected tab-panel relationship', async ({ page }, testInfo) => {
    test.skip(!paperWorkspaceEnabled, 'Enabled-state assertion runs in the companion enabled command.');
    await page.goto(`/matrix-options/paper/v/${fixtureVersion}/missing-section`, { waitUntil: 'domcontentloaded' });
    if (page.url().includes('/login')) {
      test.skip(testInfo.project.name !== 'chromium-auth', 'Authenticated Matrix Options fixture is exercised by chromium-auth.');
    }
    await expect(page.getByRole('heading', { name: 'Paper version or section not found' })).toBeVisible();
    await expect(page.getByRole('main')).toHaveCount(1);
    const selectedTab = page.getByRole('tab', { name: 'Options Paper', exact: true });
    const panel = page.getByRole('tabpanel');
    await expect(selectedTab).toHaveAttribute('aria-controls', 'matrix-options-paper-tabpanel');
    await expect(panel).toHaveAttribute('aria-labelledby', 'matrix-tab-twg-review');
  });

  test('paper navigation supports keyboard activation and the reader survives dark, reduced-motion, zoom, and viewport variants', async ({ page }, testInfo) => {
    test.skip(!paperWorkspaceEnabled, 'Enabled-state assertion runs in the companion enabled command.');
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
    await page.goto(sectionPath, { waitUntil: 'domcontentloaded' });
    if (page.url().includes('/login')) {
      test.skip(testInfo.project.name !== 'chromium-auth', 'Authenticated Matrix Options fixture is exercised by chromium-auth.');
    }
    expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
    await page.locator('[data-primary-tablist-ready="true"]').waitFor({ state: 'attached' });
    const optionsPaperTab = page.getByRole('tab', { name: 'Options Paper', exact: true });
    await optionsPaperTab.focus();
    await page.keyboard.press('ArrowRight');
    const databaseTab = page.getByRole('tab', { name: 'Database', exact: true });
    await expect(databaseTab).toBeFocused();
    await expect(optionsPaperTab).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/matrix-options\?view=Interactive%20Map$/);

    for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 768, height: 1024 }]) {
      await page.setViewportSize(viewport);
      await page.goto(sectionPath, { waitUntil: 'domcontentloaded' });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    }

    await page.setViewportSize({ width: 750, height: 900 });
    await page.evaluate(() => { document.body.style.zoom = '200%'; });
    const tableOverflow = page.getByTestId('paper-table-overflow');
    const equationOverflow = page.getByTestId('paper-equation-overflow');
    await expect(tableOverflow).toBeVisible();
    await expect(equationOverflow).toBeVisible();
    expect(await tableOverflow.evaluate((element) => getComputedStyle(element).overflowX)).toBe('auto');
    expect(await equationOverflow.evaluate((element) => getComputedStyle(element).overflowX)).toBe('auto');
  });

  test('selected-section document stays bounded and records a browser performance baseline', async ({ page }, testInfo) => {
    test.skip(!paperWorkspaceEnabled, 'Enabled-state assertion runs in the companion enabled command.');
    await page.goto('/matrix-options?view=The%20Guide', { waitUntil: 'domcontentloaded' });
    if (page.url().includes('/login')) {
      test.skip(testInfo.project.name !== 'chromium-auth', 'Authenticated Matrix Options fixture is exercised by chromium-auth.');
    }
    await page.locator('[data-primary-tablist-ready="true"]').waitFor({ state: 'attached' });
    const measure = () => page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
      return {
        domBytes: new Blob([document.documentElement.outerHTML]).size,
        responseTransferBytes: navigation.transferSize,
        serverResponseStartMs: Math.round(navigation.responseStart),
        domContentLoadedMs: Math.round(navigation.domContentLoadedEventEnd),
        hydrationReadyObservedMs: Math.round(performance.now()),
        usedJSHeapBytes: memory?.usedJSHeapSize ?? null,
        fullLegacyPortalMounted: Boolean(document.querySelector('[data-testid="twg-review-portal"]')),
        matrixMapMounted: Boolean(document.querySelector('[data-testid="matrix-map"]')),
      };
    });
    const dashboardBaseline = await measure();
    const interactionStartedAt = Date.now();
    await page.getByRole('tab', { name: 'TWG Review', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Synthetic Matrix Options Paper Reader Fixture' })).toBeVisible();
    const response = await page.goto(sectionPath, { waitUntil: 'networkidle' });
    const selectedSection = await measure();
    const interactionToReaderMs = Date.now() - interactionStartedAt;
    const baseline = { dashboardBaseline, selectedSection, interactionToReaderMs };
    console.info(`SLICE1A_BROWSER_BASELINE ${JSON.stringify(baseline)}`);
    const responseBody = await response?.text();
    const renderedDocument = await page.content();
    const selectedFragmentMarker = 'An invented input of 12 example units produces 24 example units';
    const unrelatedFragmentMarkers = [
      'Use this workspace to test stable routes',
      'The example framework has three invented stages',
      'This appendix records that search, comments, guided review',
    ];
    expect(responseBody).toContain(selectedFragmentMarker);
    expect(renderedDocument).toContain(selectedFragmentMarker);
    for (const marker of unrelatedFragmentMarkers) {
      expect(responseBody).not.toContain(marker);
      expect(renderedDocument).not.toContain(marker);
    }
    expect(responseBody).not.toContain('No external paper content.');
    expect(renderedDocument).not.toContain('No external paper content.');
    expect(selectedSection.fullLegacyPortalMounted).toBe(false);
    expect(selectedSection.matrixMapMounted).toBe(false);
    await testInfo.attach('slice1a-browser-performance.json', {
      body: JSON.stringify(baseline, null, 2),
      contentType: 'application/json',
    });
  });
});
