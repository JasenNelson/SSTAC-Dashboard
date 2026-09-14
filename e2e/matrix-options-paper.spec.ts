import { writeFile } from 'node:fs/promises';
import { expect, test, type Page, type TestInfo } from '@playwright/test';

const fixtureVersion = 'slice-1a-fixture-v1';
const sectionPath = `/matrix-options/paper/v/${fixtureVersion}/synthetic.framework.example`;
const paperWorkspaceEnabled = process.env.MATRIX_OPTIONS_PAPER_WORKSPACE === 'true';
const reviewNavigationEnabled =
  paperWorkspaceEnabled && process.env.MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION === 'true';
const unrelatedRequestPattern = /matrix-map|\/rest\/v1\/(?:matrix_|parameter_|sediment_)|\/rpc\/(?!get_my_user_role)|\/api\/matrix-options/;
const reviewVersionPath = `/matrix-options/paper/review/v/${fixtureVersion}`;
const reviewAssignmentPath = `${reviewVersionPath}/assignments/synthetic.assignment.orientation-001`;
const reviewPacketPath = `${reviewAssignmentPath}/packets/synthetic.packet.orientation-001`;
const reviewItemPath = `${reviewPacketPath}/items/synthetic.item.question-boundary-001`;

const matrixFlagObservation = () => {
  const read = (name: 'MATRIX_OPTIONS_PAPER_WORKSPACE' | 'MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION') => {
    const present = Object.prototype.hasOwnProperty.call(process.env, name);
    return { present, value: present ? process.env[name] ?? '' : null };
  };
  return {
    outer: read('MATRIX_OPTIONS_PAPER_WORKSPACE'),
    inner: read('MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION'),
  };
};

const asciiJson = (value: unknown) =>
  `${JSON.stringify(value, null, 2).replace(/[\u007f-\uffff]/g, (character) =>
    `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`)}\n`;

async function writeAndAttachM1Json(testInfo: TestInfo, name: string, value: unknown) {
  const artifactPath = testInfo.outputPath(name);
  await writeFile(artifactPath, asciiJson(value), { encoding: 'utf8', flag: 'wx' });
  await testInfo.attach(name, { path: artifactPath, contentType: 'application/json' });
}

const M1_READINESS_SCHEMA_VERSION = 'matrix-paper-m1-application-readiness-v1';
const M1_READINESS_RESULTS = ['GREEN', 'FAILED'] as const;
const M1_READINESS_DEADLINE_MS = 15_000;
type M1ReadinessResult = (typeof M1_READINESS_RESULTS)[number];
type M1JourneyId = 'E2E-1' | 'E2E-2' | 'E2E-3' | 'E2E-4' | 'E2E-5' | 'E2E-6';
type M1NavigationResult = 'NONE' | 'ERR_ABORTED' | 'OTHER_FAILURE';
type M1ExpectedLandmark = 'LEGACY' | 'M1' | 'PUBLICATION';

type M1ApplicationReadinessExpectation = {
  pathname: string;
  query: Array<[string, string]>;
  expectedLandmark: M1ExpectedLandmark;
  requiredFixtureMarker?: string;
  requiredSelectedItemMarker?: string;
  requireForbiddenM1MarkerAbsence?: boolean;
};

type M1ApplicationReadinessObservation = {
  schemaVersion: typeof M1_READINESS_SCHEMA_VERSION;
  journeyId: M1JourneyId;
  durationMs: number;
  pathname: string;
  exactPathname: boolean;
  canonicalQueryMultimap: boolean;
  expectedLandmarkPresent: boolean;
  requiredFixtureMarkerPresent: boolean;
  requiredSelectedItemMarkerPresent: boolean;
  forbiddenM1MarkerAbsent: boolean;
  result: M1ReadinessResult;
};

function classifyM1NavigationError(error: unknown): M1NavigationResult {
  return error instanceof Error && error.message.includes('ERR_ABORTED')
    ? 'ERR_ABORTED'
    : 'OTHER_FAILURE';
}

async function waitForM1ApplicationReadiness(
  page: Page,
  testInfo: TestInfo,
  input: {
    journeyId: M1JourneyId;
    attachmentName: string;
    startedAt: number;
    navigationResult: M1NavigationResult;
    expectation: M1ApplicationReadinessExpectation;
  },
): Promise<M1ApplicationReadinessObservation> {
  const deadline = input.startedAt + M1_READINESS_DEADLINE_MS;
  let observation: M1ApplicationReadinessObservation | undefined;
  while (true) {
    const current = new URL(page.url());
    const query = [...current.searchParams.entries()].sort(
      ([leftKey, leftValue], [rightKey, rightValue]) =>
        leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue),
    );
    const expectedQuery = [...input.expectation.query].sort(
      ([leftKey, leftValue], [rightKey, rightValue]) =>
        leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue),
    );
    const expectedLandmarkPresent =
      input.expectation.expectedLandmark === 'LEGACY'
        ? (await page.getByTestId('revised-paper-status').count()) > 0
        : input.expectation.expectedLandmark === 'M1'
          ? (await page.getByRole('navigation', { name: 'Review breadcrumb' }).count()) > 0
          : (await page.getByRole('main').count()) === 1;
    const requiredFixtureMarkerPresent = input.expectation.requiredFixtureMarker
      ? (await page.getByText(input.expectation.requiredFixtureMarker, { exact: false }).count()) > 0
      : true;
    const requiredSelectedItemMarkerPresent = input.expectation.requiredSelectedItemMarker
      ? (await page.getByText(input.expectation.requiredSelectedItemMarker, { exact: false }).count()) > 0
      : true;
    const forbiddenM1MarkerAbsent = input.expectation.requireForbiddenM1MarkerAbsence
      ? (await page.getByText('Synthetic fixture only.', { exact: false }).count()) === 0
      : true;
    const observedAt = performance.now();
    const rawDurationMs = Math.max(0, Math.ceil(observedAt - input.startedAt));
    const durationMs = Math.min(M1_READINESS_DEADLINE_MS, rawDurationMs);
    const withinDeadline = rawDurationMs <= M1_READINESS_DEADLINE_MS;
    const exactPathname = current.pathname === input.expectation.pathname;
    const canonicalQueryMultimap = JSON.stringify(query) === JSON.stringify(expectedQuery);
    const predicatesGreen =
      exactPathname &&
      canonicalQueryMultimap &&
      expectedLandmarkPresent &&
      requiredFixtureMarkerPresent &&
      requiredSelectedItemMarkerPresent &&
      forbiddenM1MarkerAbsent;
    const navigationGreen =
      input.navigationResult === 'NONE' ||
      (input.navigationResult === 'ERR_ABORTED' && predicatesGreen);
    observation = {
      schemaVersion: M1_READINESS_SCHEMA_VERSION,
      journeyId: input.journeyId,
      durationMs,
      pathname: current.pathname,
      exactPathname,
      canonicalQueryMultimap,
      expectedLandmarkPresent,
      requiredFixtureMarkerPresent,
      requiredSelectedItemMarkerPresent,
      forbiddenM1MarkerAbsent,
      result:
        predicatesGreen && navigationGreen && withinDeadline
          ? M1_READINESS_RESULTS[0]
          : M1_READINESS_RESULTS[1],
    };
    if (observation.result === 'GREEN') break;
    if (rawDurationMs >= M1_READINESS_DEADLINE_MS) break;
    const remainingMs = deadline - performance.now();
    if (remainingMs <= 0) continue;
    await page.waitForTimeout(Math.min(50, remainingMs));
  }
  if (!observation) throw new Error('M1_READINESS_OBSERVATION_MISSING');
  await writeAndAttachM1Json(testInfo, input.attachmentName, observation);
  return observation;
}

async function sampleM1Contrast(page: Page) {
  return page.locator('[data-m1-contrast]').evaluateAll((elements) => {
    type Color = { r: number; g: number; b: number; a: number };
    type ColorResolution = { color: Color | null; gap: string | null };
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const resolveColor = (value: string): ColorResolution => {
      if (typeof CSS === 'undefined' || !CSS.supports('color', value)) {
        return { color: null, gap: 'unsupported CSS color syntax' };
      }
      if (!context) return { color: null, gap: 'Canvas 2D sRGB conversion unavailable' };
      try {
        context.fillStyle = 'rgba(1, 2, 3, 0.498039)';
        const sentinel = context.fillStyle;
        context.fillStyle = value;
        if (context.fillStyle === sentinel) {
          return { color: null, gap: 'Canvas 2D rejected or ambiguously retained CSS color' };
        }
        context.clearRect(0, 0, 1, 1);
        context.fillRect(0, 0, 1, 1);
        const [r, g, b, alpha] = context.getImageData(0, 0, 1, 1).data;
        return { color: { r, g, b, a: alpha / 255 }, gap: null };
      } catch {
        return { color: null, gap: 'Canvas 2D sRGB conversion failed' };
      }
    };
    const composite = (front: Color, back: Color): Color => {
      const a = front.a + back.a * (1 - front.a);
      if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
      return {
        r: (front.r * front.a + back.r * back.a * (1 - front.a)) / a,
        g: (front.g * front.a + back.g * back.a * (1 - front.a)) / a,
        b: (front.b * front.a + back.b * back.a * (1 - front.a)) / a,
        a,
      };
    };
    const luminance = (color: Color) => {
      const channel = (value: number) => {
        const normalized = value / 255;
        return normalized <= 0.04045
          ? normalized / 12.92
          : ((normalized + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b);
    };
    return elements.map((element) => {
      let current: Element | null = element;
      let background: Color = { r: 0, g: 0, b: 0, a: 0 };
      let gap: string | null = null;
      while (current && background.a < 1 && !gap) {
        const style = getComputedStyle(current);
        if (
          style.backgroundImage !== 'none' ||
          style.filter !== 'none' ||
          style.backdropFilter !== 'none' ||
          style.mixBlendMode !== 'normal' ||
          style.opacity !== '1'
        ) {
          gap = 'unsupported visible compositing stack';
          break;
        }
        const layerResolution = resolveColor(style.backgroundColor);
        if (!layerResolution.color) {
          gap = `${layerResolution.gap}: background`;
          break;
        }
        background = composite(background, layerResolution.color);
        current = current.parentElement;
      }
      if (!gap && background.a < 1) gap = 'missing opaque ancestor background';
      const foregroundResolution = resolveColor(getComputedStyle(element).color);
      if (!gap && !foregroundResolution.color) gap = `${foregroundResolution.gap}: foreground`;
      if (gap || !foregroundResolution.color) {
        return { id: element.getAttribute('data-m1-contrast'), ratio: null, gap };
      }
      const visibleForeground = composite(foregroundResolution.color, background);
      const high = Math.max(luminance(visibleForeground), luminance(background));
      const low = Math.min(luminance(visibleForeground), luminance(background));
      return {
        id: element.getAttribute('data-m1-contrast'),
        ratio: (high + 0.05) / (low + 0.05),
        gap: null,
      };
    });
  });
}

const formatM1ContrastDiagnostics = (
  samples: Array<{ id: string | null; ratio: number | null; gap: string | null }>,
) => samples.map((sample) =>
  `${sample.id ?? '<missing-id>'}: ratio=${sample.ratio === null ? 'null' : sample.ratio.toFixed(3)}; gap=${sample.gap ?? 'none'}`,
).join('\n');

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

  test('disabled old TWG query preserves the revised-paper status', async ({ page }, testInfo) => {
    test.skip(paperWorkspaceEnabled, 'Disabled-state assertion runs in the companion disabled command.');
    await page.goto('/matrix-options?view=TWG%20Review', { waitUntil: 'networkidle' });
    if (page.url().includes('/login')) {
      test.skip(testInfo.project.name !== 'chromium-auth', 'Authenticated Matrix Options fixture is exercised by chromium-auth.');
    }
    await expect(page).toHaveURL(/\/matrix-options\?view=TWG(?:%20|\+)Review$/);
    await expect(page.locator('#matrix-dashboard-tabpanel')).toBeVisible();
    const revisedPaperStatus = page.getByTestId('revised-paper-status');
    await expect(revisedPaperStatus).toBeVisible();
    await expect(revisedPaperStatus.getByRole('heading', { name: 'Revised Matrix Options Paper', exact: true })).toBeVisible();
  });

  test('disabled direct paper routes fall back before any follow-up paper request', async ({ page }, testInfo) => {
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
      if (page.url().includes('/login')) {
        page.off('request', listener);
        test.skip(testInfo.project.name !== 'chromium-auth', 'Authenticated Matrix Options fixture is exercised by chromium-auth.');
      }
      page.off('request', listener);
      await expect(page).toHaveURL(/\/matrix-options\?view=TWG(?:%20|\+)Review$/);
      const revisedPaperStatus = page.getByTestId('revised-paper-status');
      await expect(revisedPaperStatus).toBeVisible();
      await expect(revisedPaperStatus.getByRole('heading', { name: 'Revised Matrix Options Paper', exact: true })).toBeVisible();
      expect(paperRequests).toHaveLength(1);
      expect(await page.content()).not.toContain('Synthetic Matrix Options Paper Reader Fixture');
    }
  });

  test('all six non-paper destinations retain their query and selected tab', async ({ page }, testInfo) => {
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
      if (page.url().includes('/login')) {
        test.skip(testInfo.project.name !== 'chromium-auth', 'Authenticated Matrix Options fixture is exercised by chromium-auth.');
      }
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

test.describe('M1 Review Navigation', () => {
  test('E2E-1 assigned ordinary flow', async ({ page }, testInfo) => {
    test.skip(!reviewNavigationEnabled, 'Both exact-true flags are required for M1 assigned evidence.');
    const observedRequests: string[] = [];
    page.on('request', (request) => observedRequests.push(new URL(request.url()).pathname));
    await page.context().addCookies([
      { name: 'theme', value: 'dark', url: String(testInfo.project.use.baseURL) },
    ]);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const readinessStartedAt = performance.now();
    let navigationResult: M1NavigationResult = 'NONE';
    try {
      await page.goto(`${reviewVersionPath}?scenario=assigned`, { waitUntil: 'domcontentloaded' });
    } catch (error) {
      navigationResult = classifyM1NavigationError(error);
    }
    if (page.url().includes('/login')) {
      test.skip(
        testInfo.project.name !== 'chromium-auth',
        'Authenticated Matrix Options fixture is exercised by chromium-auth.',
      );
    }
    const prefetchedBeforeNavigation = observedRequests.filter((path) =>
      path.startsWith(reviewAssignmentPath) ||
      path.startsWith(reviewPacketPath) ||
      path.startsWith(reviewItemPath) ||
      path === `/matrix-options/paper/v/${fixtureVersion}`);

    await page.getByRole('link', { name: 'Open synthetic assignment' }).click();
    await page.getByRole('link', { name: 'Open assigned Question context' }).click();
    const itemResponsePromise = page.waitForResponse((response) =>
      new URL(response.url()).pathname === reviewItemPath,
    );
    await page.getByRole('link', { name: 'Open assigned Question context' }).click();
    const itemResponse = await itemResponsePromise;
    const readiness = await waitForM1ApplicationReadiness(page, testInfo, {
      journeyId: 'E2E-1',
      attachmentName: 'm1-e2e-1-readiness.json',
      startedAt: readinessStartedAt,
      navigationResult,
      expectation: {
        pathname: reviewItemPath,
        query: [],
        expectedLandmark: 'M1',
        requiredFixtureMarker: fixtureVersion,
        requiredSelectedItemMarker: 'This appendix records that search, comments, guided review',
      },
    });
    expect(readiness.result).toBe('GREEN');
    expect(prefetchedBeforeNavigation).toEqual([]);
    await expect(page).toHaveURL(new RegExp(`${reviewItemPath}$`));
    await expect(page.locator('html')).toHaveClass(/dark/);
    await expect(page.locator('html')).not.toHaveClass(/light/);
    const contrast = await sampleM1Contrast(page);
    await testInfo.attach('m1-e2e-1-assigned-contrast.json', {
      body: asciiJson(contrast),
      contentType: 'application/json',
    });
    expect(contrast.length).toBeGreaterThan(0);
    expect(
      contrast.every((sample) => sample.gap === null && (sample.ratio ?? 0) >= 4.5),
      formatM1ContrastDiagnostics(contrast),
    ).toBe(true);
    await expect(page.getByText('slice-1a-fixture-v1', { exact: true })).toBeVisible();
    await expect(page.getByText('synthetic.matrix-options-paper', { exact: true })).toBeVisible();
    await expect(page.getByText('synthetic.slice-1a.generation-001', { exact: true })).toBeVisible();
    await expect(
      page.locator('dt', { hasText: 'Manifest SHA-256' }).locator('..').locator('dd'),
    ).toHaveText(/^[a-f0-9]{64}$/);
    await expect(page.getByText('Technical validation', { exact: true })).toBeVisible();
    await expect(page.getByText('Advisory only; no decision authority', { exact: true })).toBeVisible();
    await expect(page.getByText('Synthetic fixture only.', { exact: false })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Publication escape' })).toHaveCount(1);
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(page.getByRole('navigation', { name: 'Review breadcrumb' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Packet navigation' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Supporting publication links' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Slice boundary appendix', level: 1 })).toBeVisible();
    await expect(page.getByText('This appendix records that search, comments, guided review', { exact: false })).toBeVisible();
    const itemHtml = await page.content();
    const itemResponseHtml = await itemResponse.text();
    expect(itemHtml).not.toContain('Use this workspace to test stable routes');
    expect(itemHtml).not.toContain('The example framework has three invented stages');
    expect(itemHtml).not.toContain('An invented input of 12 example units');
    expect(itemResponseHtml).toContain('This appendix records that search, comments, guided review');
    expect(itemResponseHtml).not.toContain('Use this workspace to test stable routes');
    expect(itemResponseHtml).not.toContain('The example framework has three invented stages');
    expect(itemResponseHtml).not.toContain('An invented input of 12 example units');

    const supportingLink = page.getByRole('link', { name: 'Supporting reader orientation' });
    const supportingHref = await supportingLink.getAttribute('href');
    expect(supportingHref).toBe(`/matrix-options/paper/v/${fixtureVersion}/synthetic.orientation`);
    expect(supportingHref).not.toContain('synthetic.appendix');
    await page.setViewportSize({ width: 750, height: 900 });
    await page.evaluate(() => { document.body.style.zoom = '200%'; });
    const documentScrollWidthDelta = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    const structuralHtml = await page.content();
    const selectedFragmentMarker = 'This appendix records that search, comments, guided review';
    const unrelatedFragmentMarkers = [
      'Use this workspace to test stable routes',
      'The example framework has three invented stages',
      'An invented input of 12 example units',
    ];
    const browserMetrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      const heap = (performance as Performance & { memory?: { usedJSHeapSize?: number } }).memory;
      const viewportWidth = document.documentElement.clientWidth;
      const overflowingElements = Array.from(document.body.querySelectorAll('*'))
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            tagName: element.tagName.toLowerCase(),
            role: element.getAttribute('role'),
            ariaLabel: element.getAttribute('aria-label'),
            textSample: (element.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 120),
            boundingRect: {
              left: Math.round(rect.left),
              right: Math.round(rect.right),
              top: Math.round(rect.top),
              bottom: Math.round(rect.bottom),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
            },
            scrollWidth: element.scrollWidth,
            clientWidth: element.clientWidth,
          };
        })
        .filter(({ boundingRect }) => boundingRect.left < -1 || boundingRect.right > viewportWidth + 1)
        .slice(0, 12);
      return {
        responseTransferBytes:
          navigation && Number.isFinite(navigation.transferSize) ? navigation.transferSize : null,
        domElementCount: document.querySelectorAll('*').length,
        overflowingElements,
        browserHeapUsedBytes:
          heap && Number.isFinite(heap.usedJSHeapSize) ? heap.usedJSHeapSize ?? null : null,
        userAgent: navigator.userAgent,
      };
    });
    await writeAndAttachM1Json(testInfo, 'm1-review-navigation-structural-observations.json', {
      route: new URL(page.url()).pathname,
      flags: matrixFlagObservation(),
      viewport: page.viewportSize(),
      responseTransferBytes: browserMetrics.responseTransferBytes,
      serializedHtmlUtf8Bytes: Buffer.byteLength(structuralHtml, 'utf8'),
      domElementCount: browserMetrics.domElementCount,
      documentScrollWidthDelta,
      overflowingElements: browserMetrics.overflowingElements,
      reviewCounts: {
        assignments: await page.getByRole('navigation', { name: 'Review breadcrumb' }).getByRole('link', { name: 'Assignment' }).count(),
        packets: await page.getByRole('navigation', { name: 'Packet navigation' }).count(),
        items: await page.getByRole('region', { name: 'Atomic review item context' }).count(),
      },
      selectedFragmentMarkerPresent: structuralHtml.includes(selectedFragmentMarker),
      unrelatedFragmentMarkerPresence: unrelatedFragmentMarkers.map((marker) => ({
        marker,
        present: structuralHtml.includes(marker),
      })),
      browserHeapUsedBytes: browserMetrics.browserHeapUsedBytes,
      identity: {
        projectName: testInfo.project.name,
        browserName: testInfo.project.use.browserName ?? null,
        userAgent: browserMetrics.userAgent,
        nodeVersion: process.version,
      },
      observedRequests,
      supportingHref,
      contrast,
    });
    expect(documentScrollWidthDelta).toBeLessThanOrEqual(1);

    await supportingLink.click();
    await expect(page).toHaveURL((url) =>
      url.pathname === supportingHref && url.search === '' && url.hash === '',
    );
    await expect(page.getByRole('heading', { name: 'Reader orientation', level: 1 })).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`${reviewItemPath}$`));
    await page.getByRole('navigation', { name: 'Publication escape' }).getByRole('link').click();
    await expect(page).toHaveURL(new RegExp(`/matrix-options/paper/v/${fixtureVersion}$`));
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`${reviewItemPath}$`));
    await page.goForward();
    await expect(page).toHaveURL(new RegExp(`/matrix-options/paper/v/${fixtureVersion}$`));

    const freshPage = await page.context().newPage();
    await freshPage.goto(reviewItemPath, { waitUntil: 'domcontentloaded' });
    await expect(freshPage.getByRole('heading', { name: 'Slice boundary appendix', level: 1 })).toBeVisible();
    const duplicate = await page.context().newPage();
    await duplicate.goto(reviewItemPath, { waitUntil: 'domcontentloaded' });
    await expect(duplicate.getByRole('region', { name: 'Atomic review item context' })).toBeVisible();
  });

  test('E2E-2 true no-assignment', async ({ page }, testInfo) => {
    test.skip(!reviewNavigationEnabled, 'Both exact-true flags are required for M1 no-assignment evidence.');
    await page.context().addCookies([
      { name: 'theme', value: 'light', url: String(testInfo.project.use.baseURL) },
    ]);
    const path = `${reviewVersionPath}?scenario=no-assignment`;
    const readinessStartedAt = performance.now();
    let navigationResult: M1NavigationResult = 'NONE';
    try {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
    } catch (error) {
      navigationResult = classifyM1NavigationError(error);
    }
    if (page.url().includes('/login')) {
      test.skip(testInfo.project.name !== 'chromium-auth', 'Authenticated Matrix Options fixture is exercised by chromium-auth.');
    }
    const readiness = await waitForM1ApplicationReadiness(page, testInfo, {
      journeyId: 'E2E-2',
      attachmentName: 'm1-e2e-2-readiness.json',
      startedAt: readinessStartedAt,
      navigationResult,
      expectation: {
        pathname: reviewVersionPath,
        query: [['scenario', 'no-assignment']],
        expectedLandmark: 'M1',
        requiredFixtureMarker: fixtureVersion,
      },
    });
    expect(readiness.result).toBe('GREEN');
    await page.setViewportSize({ width: 375, height: 812 });
    await expect(page.locator('html')).toHaveClass(/light/);
    await expect(page.locator('html')).not.toHaveClass(/dark/);
    const contrast = await sampleM1Contrast(page);
    await testInfo.attach('m1-e2e-2-no-assignment-contrast.json', {
      body: asciiJson(contrast),
      contentType: 'application/json',
    });
    expect(contrast.length).toBeGreaterThan(0);
    expect(
      contrast.every((sample) => sample.gap === null && (sample.ratio ?? 0) >= 4.5),
      formatM1ContrastDiagnostics(contrast),
    ).toBe(true);
    await expect(page.getByText('No assignment is attached to this exact synthetic release.', { exact: false })).toBeVisible();
    await expect(page.getByText('This is not a no-assignment result.', { exact: false })).toHaveCount(0);
    await expect(page.getByRole('table')).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'Publication escape' })).toHaveCount(1);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.goto('/matrix-options/paper', { waitUntil: 'domcontentloaded' });
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`${reviewVersionPath}\\?scenario=no-assignment$`));
    await page.goForward();
    await expect(page).toHaveURL(/\/matrix-options\/paper/);
  });

  test('E2E-3 assignment unavailable', async ({ page }, testInfo) => {
    test.skip(!reviewNavigationEnabled, 'Both exact-true flags are required for M1 unavailable evidence.');
    await page.setViewportSize({ width: 768, height: 1024 });
    const path = `${reviewVersionPath}?scenario=assignment-unavailable`;
    const readinessStartedAt = performance.now();
    let navigationResult: M1NavigationResult = 'NONE';
    try {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
    } catch (error) {
      navigationResult = classifyM1NavigationError(error);
    }
    if (page.url().includes('/login')) {
      test.skip(testInfo.project.name !== 'chromium-auth', 'Authenticated Matrix Options fixture is exercised by chromium-auth.');
    }
    const readiness = await waitForM1ApplicationReadiness(page, testInfo, {
      journeyId: 'E2E-3',
      attachmentName: 'm1-e2e-3-readiness.json',
      startedAt: readinessStartedAt,
      navigationResult,
      expectation: {
        pathname: reviewVersionPath,
        query: [['scenario', 'assignment-unavailable']],
        expectedLandmark: 'M1',
        requiredFixtureMarker: fixtureVersion,
      },
    });
    expect(readiness.result).toBe('GREEN');
    await expect(page.getByText('Assignment information could not be loaded.', { exact: false })).toBeVisible();
    await expect(page.getByText('No assignment is attached', { exact: false })).toHaveCount(0);
    const retry = page.getByRole('link', { name: 'Retry assignment load' });
    await retry.focus();
    await expect(retry).toBeFocused();
    const sameUrlRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url() === page.url()) sameUrlRequests.push(request.url());
    });
    await retry.press('Enter');
    await expect(page).toHaveURL(new RegExp(`${reviewVersionPath}\\?scenario=assignment-unavailable$`));
    expect(sameUrlRequests.length).toBeGreaterThan(0);
    expect(page.url()).not.toMatch(/nonce|cache/);
    await page.getByRole('navigation', { name: 'Publication escape' }).getByRole('link').click();
    await expect(page.getByRole('heading', { name: 'Synthetic Matrix Options Paper Reader Fixture' })).toBeVisible();
  });

  test('E2E-4 direct-route gate matrix', async ({ page }, testInfo) => {
    await writeAndAttachM1Json(testInfo, 'm1-effective-flags.json', matrixFlagObservation());
    const directRoutes = [reviewVersionPath, reviewAssignmentPath, reviewPacketPath, reviewItemPath];
    for (const [directRouteIndex, directRoute] of directRoutes.entries()) {
      const paperRequests: string[] = [];
      const listener = (request: { url(): string }) => {
        const pathname = new URL(request.url()).pathname;
        if (pathname.startsWith('/matrix-options/paper')) paperRequests.push(pathname);
      };
      page.on('request', listener);
      const readinessStartedAt = performance.now();
      let navigationResult: M1NavigationResult = 'NONE';
      try {
        await page.goto(directRoute, { waitUntil: 'domcontentloaded' });
      } catch (error) {
        navigationResult = classifyM1NavigationError(error);
      }
      if (page.url().includes('/login')) {
        test.skip(testInfo.project.name !== 'chromium-auth', 'Authenticated Matrix Options fixture is exercised by chromium-auth.');
      }
      const expectedPathname = !paperWorkspaceEnabled
        ? '/matrix-options'
        : !reviewNavigationEnabled
          ? `/matrix-options/paper/v/${fixtureVersion}`
          : directRoute;
      const readiness = await waitForM1ApplicationReadiness(page, testInfo, {
        journeyId: 'E2E-4',
        attachmentName: `m1-e2e-4-readiness-${directRouteIndex + 1}.json`,
        startedAt: readinessStartedAt,
        navigationResult,
        expectation: {
          pathname: expectedPathname,
          query: !paperWorkspaceEnabled ? [['view', 'TWG Review']] : [],
          expectedLandmark: !paperWorkspaceEnabled
            ? 'LEGACY'
            : reviewNavigationEnabled
              ? 'M1'
              : 'PUBLICATION',
          requiredFixtureMarker: paperWorkspaceEnabled ? fixtureVersion : undefined,
          requiredSelectedItemMarker:
            reviewNavigationEnabled && directRoute === reviewItemPath
              ? 'This appendix records that search, comments, guided review'
              : undefined,
          requireForbiddenM1MarkerAbsence: !reviewNavigationEnabled,
        },
      });
      expect(readiness.result).toBe('GREEN');
      if (!paperWorkspaceEnabled) {
        await expect(page).toHaveURL(/\/matrix-options\?view=TWG(?:%20|\+)Review$/);
        expect(paperRequests).toHaveLength(1);
      } else if (!reviewNavigationEnabled) {
        expect(paperRequests[0]).toBe(directRoute);
        expect(paperRequests).toContain('/matrix-options/paper');
        await expect(page).toHaveURL(new RegExp(`/matrix-options/paper/v/${fixtureVersion}$`));
        await expect(page.getByText('Synthetic fixture only.', { exact: false })).toHaveCount(0);
      } else {
        await expect(page.getByText('Synthetic fixture only.', { exact: false })).toBeVisible();
      }
      page.off('request', listener);
    }
  });

  test('E2E-5 existing reader regression', async ({ page }, testInfo) => {
    test.skip(!reviewNavigationEnabled, 'Both exact-true flags are required for the M1 reader regression run.');
    const unrelatedRequests: string[] = [];
    page.on('request', (request) => {
      if (unrelatedRequestPattern.test(request.url())) unrelatedRequests.push(request.url());
    });
    await page.goto(sectionPath, { waitUntil: 'domcontentloaded' });
    if (page.url().includes('/login')) {
      test.skip(testInfo.project.name !== 'chromium-auth', 'Authenticated Matrix Options fixture is exercised by chromium-auth.');
    }
    const readinessStartedAt = performance.now();
    let navigationResult: M1NavigationResult = 'NONE';
    try {
      await page.reload({ waitUntil: 'domcontentloaded' });
    } catch (error) {
      navigationResult = classifyM1NavigationError(error);
    }
    const readiness = await waitForM1ApplicationReadiness(page, testInfo, {
      journeyId: 'E2E-5',
      attachmentName: 'm1-e2e-5-readiness.json',
      startedAt: readinessStartedAt,
      navigationResult,
      expectation: {
        pathname: sectionPath,
        query: [],
        expectedLandmark: 'PUBLICATION',
        requiredFixtureMarker: 'Synthetic Matrix Options Paper Reader Fixture',
        requiredSelectedItemMarker: 'An invented input of 12 example units',
        requireForbiddenM1MarkerAbsence: true,
      },
    });
    expect(readiness.result).toBe('GREEN');
    await expect(page).toHaveURL(new RegExp(`${sectionPath}$`));
    await expect(page.getByRole('heading', { name: 'Invented worked example', level: 1 })).toBeVisible();
    await expect(page.getByText('Synthetic fixture only.', { exact: false })).toHaveCount(0);
    await expect(page.getByText('An invented input of 12 example units', { exact: false })).toBeVisible();
    expect(unrelatedRequests).toEqual([]);
  });

  test('E2E-6 exact-identity failure', async ({ page }, testInfo) => {
    test.skip(!reviewNavigationEnabled, 'Both exact-true flags are required for M1 identity-failure evidence.');
    await page.setViewportSize({ width: 1024, height: 768 });
    const mismatchScenarios = ['same-version-different-generation', 'different-manifest'] as const;
    for (const [scenarioIndex, scenario] of mismatchScenarios.entries()) {
      const path = `${reviewVersionPath}?scenario=${scenario}`;
      const readinessStartedAt = performance.now();
      let navigationResult: M1NavigationResult = 'NONE';
      try {
        await page.goto(path, { waitUntil: 'domcontentloaded' });
      } catch (error) {
        navigationResult = classifyM1NavigationError(error);
      }
      if (page.url().includes('/login')) {
        test.skip(testInfo.project.name !== 'chromium-auth', 'Authenticated Matrix Options fixture is exercised by chromium-auth.');
      }
      const readiness = await waitForM1ApplicationReadiness(page, testInfo, {
        journeyId: 'E2E-6',
        attachmentName: `m1-e2e-6-readiness-${scenarioIndex + 1}.json`,
        startedAt: readinessStartedAt,
        navigationResult,
        expectation: {
          pathname: reviewVersionPath,
          query: [['scenario', scenario]],
          expectedLandmark: 'M1',
          requiredFixtureMarker: fixtureVersion,
        },
      });
      expect(readiness.result).toBe('GREEN');
      await expect(page.getByRole('heading', { name: 'Review fixture integrity check failed' })).toBeVisible();
      await expect(page.getByText('Synthetic orientation assignment', { exact: false })).toHaveCount(0);
      await expect(page.getByText('Trust record', { exact: false })).toHaveCount(0);
      await expect(page.getByRole('navigation', { name: 'Publication escape' })).toHaveCount(1);
    }
    await page.reload({ waitUntil: 'domcontentloaded' });
    const freshPage = await page.context().newPage();
    await freshPage.goto(`${reviewVersionPath}?scenario=different-manifest`, { waitUntil: 'domcontentloaded' });
    await expect(freshPage.getByRole('heading', { name: 'Review fixture integrity check failed' })).toBeVisible();
  });
});
