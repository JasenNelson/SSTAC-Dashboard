import { expect, test } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// Both modules are isomorphic and import nothing: the release entries (versions, hashes, the
// notice id and sentence) and the scroll authority's own bounds are read, not restated.
import { getPaperRelease, PAPER_WITHHELD_NOTICE_ID, R5_PAPER_VERSION, V0991_PAPER_VERSION } from '../src/lib/matrix-options/paper/releases';
import { appendixLSourceMediaContract } from '../src/lib/matrix-options/paper/accepted-source-media';
import { PAPER_LANDING_MAX_ATTEMPTS } from '../src/lib/matrix-options/paper/scroll-authority';
import {
  assertPrivateFixtureModeContract,
  privateFixtureModeForLeg,
  privateReleaseJourneysEnabled,
} from '../scripts/verify/matrix-paper-e2e-fixture-mode.mjs';
import { SESSION_TEARDOWN_PROJECT, SESSION_TEARDOWN_TAG } from './session-teardown';

const contractsDirectory = path.join(__dirname, '..', 'src', 'lib', 'matrix-options', 'paper', 'contracts');

// The ten package ids of the reviewed print-package catalog, read from the contract itself so the
// anonymous-denial test covers every artifact route rather than a hand-picked one.
const printPackageIds: string[] = (JSON.parse(
  fs.readFileSync(path.join(contractsDirectory, 'print-packages-v1.json'), 'utf8'),
) as { artifacts: Array<{ packageId: string }> }).artifacts.map((artifact) => artifact.packageId);

const realVersion = '1.0.11-remediated-7-8-successor-20260918-D';

/*
 * The current review draft is a PRIVATE release: its Markdown and figures are not in the
 * repository. A non-production server reads them from the directory this variable names (the
 * private fixture, <dir>/<version>/presentation.md and <dir>/<version>/figures/<ID>.png);
 * without it the release cannot be rendered here at all.
 *
 * Rules for everything below that touches that release:
 * - a journey that renders it lives in the one describe that is skipped unless
 *   PRIVATE_RELEASE_JOURNEYS is true, and that describe records no trace, screenshot or video;
 * - it never runs on GitHub Actions, whatever else is set;
 * - no text of the release is typed in this file. An assertion about its content compares a
 *   hash, a count, an id or a boolean, or reads the value from the fixture at run time; nothing
 *   read from the fixture or from the rendered release is put in a test title, an expect
 *   message, a log line or an attachment;
 * - everywhere else, a request that names the private version is aborted before it is sent.
 */
/*
 * What a run without those journeys means is stated, never assumed (the same two words the unit
 * suites use, src/lib/matrix-options/paper/__tests__/private-fixture.ts):
 * MATRIX_PAPER_PRIVATE_FIXTURE=required: the private journeys must run. It is a failure when
 *   the fixture variable is unset, on GitHub Actions, or when the authenticated project that
 *   runs them is not enabled;
 * MATRIX_PAPER_PRIVATE_FIXTURE=skip: they are skipped knowingly, fixture or not.
 * Outside GitHub Actions one of the two must be set: with neither, the guard test fails.
 */
const PRIVATE_FIXTURE_MODE = process.env.MATRIX_PAPER_PRIVATE_FIXTURE;
const ON_GITHUB_ACTIONS = process.env.GITHUB_ACTIONS === 'true';
const privateAssetDirectory = process.env.MATRIX_OPTIONS_PAPER_PRIVATE_ASSET_DIR;
const hasPrivatePresentation = (version: string): boolean => Boolean(
  privateAssetDirectory && fs.existsSync(path.join(privateAssetDirectory, version, 'presentation.md')),
);
const PRIVATE_R5_FIXTURE_PRESENT = hasPrivatePresentation(R5_PAPER_VERSION);
const PRIVATE_V0991_FIXTURE_PRESENT = hasPrivatePresentation(V0991_PAPER_VERSION);
const PRIVATE_RELEASE_JOURNEYS = privateReleaseJourneysEnabled({
  mode: PRIVATE_FIXTURE_MODE,
  githubActions: ON_GITHUB_ACTIONS,
  fixturePresent: PRIVATE_R5_FIXTURE_PRESENT,
});
const V0991_APPENDIX_L_JOURNEY = privateReleaseJourneysEnabled({
  mode: PRIVATE_FIXTURE_MODE,
  githubActions: ON_GITHUB_ACTIONS,
  fixturePresent: PRIVATE_V0991_FIXTURE_PRESENT,
});
const ANY_PRIVATE_RELEASE_JOURNEY = PRIVATE_RELEASE_JOURNEYS || V0991_APPENDIX_L_JOURNEY;
// Mirrors playwright.config.ts (runAuthenticatedE2E): the authenticated project exists only with
// both test credentials and E2E_AUTH_ENABLED exactly 'true'. Only whether they are set is read.
const AUTHENTICATED_PROJECT_ENABLED = Boolean(process.env.E2E_TEST_EMAIL && process.env.E2E_TEST_PASSWORD) && process.env.E2E_AUTH_ENABLED === 'true';
const privateRelease = getPaperRelease(R5_PAPER_VERSION)!;
const privateWorkspacePath = `/matrix-options/paper/publication/v/${R5_PAPER_VERSION}`;
const sha256Hex = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');

/*
 * Playwright's trace, screenshot and video options are worker-scoped: it rejects a test.use()
 * of them inside a describe group, so they are switched here, for the whole file, exactly when
 * the private journeys can run. Where they cannot (GitHub Actions, or no fixture) nothing of
 * the private release is ever requested, and the other journeys keep the configured recording.
 * The private describe checks the effective values again before every journey.
 */
test.use(ANY_PRIVATE_RELEASE_JOURNEY ? { trace: 'off', screenshot: 'off', video: 'off' } : {});

test.describe('v0.9.91 Appendix L inclusion fixture-mode contract', () => {
  test('v0.9.91 Appendix L inclusion rejects an unset fixture mode outside GitHub Actions', () => {
    expect(() => assertPrivateFixtureModeContract({
      mode: undefined,
      githubActions: false,
      fixturePresent: true,
      authenticatedProjectEnabled: true,
    })).toThrow('MATRIX_PAPER_PRIVATE_FIXTURE must be');
  });

  test('v0.9.91 Appendix L inclusion isolates the private fixture in non-private wrapper legs', () => {
    expect(privateFixtureModeForLeg('flags-off')).toBe('skip');
    expect(privateFixtureModeForLeg('authenticated-v16')).toBe('skip');
    expect(privateReleaseJourneysEnabled({ mode: 'skip', githubActions: false, fixturePresent: true })).toBe(false);
    expect(assertPrivateFixtureModeContract({
      mode: 'skip',
      githubActions: false,
      fixturePresent: true,
      authenticatedProjectEnabled: true,
    })).toBe(false);
  });

  test('v0.9.91 Appendix L inclusion runs in the focused required mode with fixture and authentication', () => {
    const mode = privateFixtureModeForLeg('appendix-l-inclusion-only');
    expect(mode).toBe('required');
    expect(privateReleaseJourneysEnabled({ mode, githubActions: false, fixturePresent: true })).toBe(true);
    expect(assertPrivateFixtureModeContract({
      mode,
      githubActions: false,
      fixturePresent: true,
      authenticatedProjectEnabled: true,
    })).toBe(true);
    expect(() => assertPrivateFixtureModeContract({
      mode,
      githubActions: false,
      fixturePresent: true,
      authenticatedProjectEnabled: false,
    })).toThrow('MATRIX_PAPER_PRIVATE_FIXTURE=required, but the authenticated project');
  });

  test('v0.9.91 Appendix L inclusion requires its version-specific fixture in required mode', () => {
    if (PRIVATE_FIXTURE_MODE === 'required') {
      expect(() => assertPrivateFixtureModeContract({
        mode: PRIVATE_FIXTURE_MODE,
        githubActions: ON_GITHUB_ACTIONS,
        fixturePresent: PRIVATE_V0991_FIXTURE_PRESENT,
        authenticatedProjectEnabled: AUTHENTICATED_PROJECT_ENABLED,
      })).not.toThrow();
      expect(V0991_APPENDIX_L_JOURNEY).toBe(!ON_GITHUB_ACTIONS && PRIVATE_V0991_FIXTURE_PRESENT);
    } else {
      expect(V0991_APPENDIX_L_JOURNEY).toBe(false);
    }
  });
});

/*
 * After a failed test Playwright also writes a text snapshot of the page it failed on
 * (error-context.md, which the HTML report embeds). For a private journey that is the paper's
 * text, so it is switched off the same way: this variable is read in this worker process when
 * a test fails.
 */
if (ANY_PRIVATE_RELEASE_JOURNEY) process.env.PLAYWRIGHT_NO_COPY_PROMPT = '1';
/** The whole failure message of a private journey that would run with any recording on. */
const PRIVATE_RECORDING_MESSAGE = 'A private release journey must not record a trace, a screenshot or a video.';

/** Aborts every request of this page whose address names the private release. */
const blockPrivateRelease = (page: Page) => page.route((url) => url.href.includes(R5_PAPER_VERSION), (route) => route.abort());
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

/*
 * The workspace header controls are server rendered, so being VISIBLE no
 * longer implies React has hydrated (they used to be portalled in after
 * mount). A click before hydration is lost. Every navigation of a workspace
 * journey therefore waits for the shell's data-hydrated marker when the page is
 * the workspace (pages that redirect elsewhere have no shell and are not held).
 */
const holdNavigationsUntilHydrated = (page: Page, testInfo: TestInfo) => {
  // Real-release pages render the whole paper server side; against a cold dev
  // server a single navigation can take most of the default budget.
  testInfo.setTimeout(Math.max(testInfo.timeout, 240000));
  const waitForWorkspace = () => page.waitForFunction(() => {
    const shell = document.querySelector('[data-testid="workspace-shell"]');
    return !shell || shell.getAttribute('data-hydrated') === 'true';
  }, null, { timeout: 180000 });
  const goto = page.goto.bind(page);
  page.goto = async (...args: Parameters<typeof page.goto>) => {
    const response = await goto(...args);
    await waitForWorkspace();
    return response;
  };
  const reload = page.reload.bind(page);
  page.reload = async (...args: Parameters<typeof page.reload>) => {
    const response = await reload(...args);
    await waitForWorkspace();
    return response;
  };
};

const workspacePath = `/matrix-options/paper/publication/v/${realVersion}`;
const canonicalWorkingDraft = `${workspacePath}?mode=working-draft`;
/**
 * Paper Navigation groups start collapsed unless they hold the URL target or
 * the section in view, which opens them shortly after load. Wait briefly for
 * that, then open the group explicitly -- never toggling an already-open one.
 */
const openOutlineGroup = async (page: Page, name: 'Main Report' | 'Appendices') => {
  const button = page.getByTestId('paper-outline-desktop').getByRole('button', { name, exact: true });
  await expect(button).toBeVisible({ timeout: 30000 });
  await expect.poll(() => button.getAttribute('aria-expanded'), { timeout: 3000 }).toBe('true').catch(() => undefined);
  if ((await button.getAttribute('aria-expanded')) !== 'true') await button.click();
  await expect(button).toHaveAttribute('aria-expanded', 'true');
};
/** Review questions start collapsed: open one explicitly (its row toggle). */
const openQuestion = async (page: Page, number: number) => {
  const toggle = page.getByTestId(`review-question-toggle-q${number}`);
  await expect(toggle).toBeVisible({ timeout: 30000 });
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
};
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
const waitForHydratedWorkspace = (page: Page) => page.waitForFunction(() => document.querySelector('[data-testid="workspace-shell"]')?.getAttribute('data-hydrated') === 'true', null, { timeout: 180000 });

test.describe('Matrix Options Paper disabled-route regressions', () => {
  test.beforeEach(async ({ page }) => {
    if (!PRIVATE_RELEASE_JOURNEYS) await blockPrivateRelease(page);
  });

  test('flags-off old TWG query preserves the revised-paper status', async ({ page }, testInfo) => {
    test.skip(paperWorkspaceEnabled, 'This regression requires both paper flags to be off.');
    await page.goto('/matrix-options?view=TWG%20Review', { waitUntil: 'networkidle' });
    if (page.url().includes('/login')) test.skip(testInfo.project.name !== 'chromium-auth', 'Authenticated dashboard coverage runs in chromium-auth.');
    await expect(page).toHaveURL(/\/matrix-options\?view=TWG(?:%20|\+)Review$/);
    const status = page.getByTestId('revised-paper-status');
    await expect(status).toBeVisible();
    await expect(status.getByRole('heading', { name: 'Revised Matrix Options Paper', exact: true })).toBeVisible();
  });

  // One independent test per flags-off path, each with its own normal test budget: a
  // landing page that hydrates slowly under a loaded full suite then costs one path's
  // budget, not all three.
  for (const [pathName, path] of [
    ['paper root', '/matrix-options/paper'],
    ['legacy section', legacySectionPath],
    ['missing section', `/matrix-options/paper/v/${legacyFixtureVersion}/missing-section`],
  ] as const) {
    test(`flags-off direct paper routes fail closed before follow-up paper requests: ${pathName}`, async ({ page }, testInfo) => {
      test.skip(paperWorkspaceEnabled, 'This regression requires both paper flags to be off.');
      const paperRequests: string[] = [];
      const listener = (request: { url(): string }) => {
        if (new URL(request.url()).pathname.startsWith('/matrix-options/paper')) paperRequests.push(request.url());
      };
      page.on('request', listener);
      // Neither 'networkidle' nor the 'load' event: under a loaded full suite the landing page
      // can stay pending (slow hydration, a remote session check), so both can stay unmet past
      // the test budget although the redirect has already landed. The fail-closed contract is
      // asserted directly instead: the redirect target renders and HYDRATES (the primary
      // tablist's mount-only ready marker, see e2e/fixtures/matrix-options-nav.ts), then a
      // 1000ms quiet window follows in which no further /matrix-options/paper request may start.
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      if (page.url().includes('/login')) {
        page.off('request', listener);
        test.skip(testInfo.project.name !== 'chromium-auth', 'Authenticated dashboard coverage runs in chromium-auth.');
      }
      await expect(page).toHaveURL(/\/matrix-options\?view=TWG(?:%20|\+)Review$/);
      await expect(page.getByTestId('revised-paper-status')).toBeVisible();
      await expect(page.locator('[role="tablist"][data-primary-tablist-ready="true"]')).toBeVisible({ timeout: 30000 });
      await page.waitForTimeout(1000);
      page.off('request', listener);
      expect(paperRequests).toHaveLength(1);
    });
  }

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
  test.beforeEach(async ({ page }, testInfo) => {
    // These journeys are the default draft's. Its version control lists the private draft, so
    // a request that names it is aborted here rather than trusted not to happen.
    if (!PRIVATE_RELEASE_JOURNEYS) await blockPrivateRelease(page);
    holdNavigationsUntilHydrated(page, testInfo);
  });

  test.setTimeout(120000);
  /** Below lg: open the stacked Appendices group (never toggling it closed). */
  const openStackedAppendices = async (page: Page) => {
    const button = page.getByTestId('paper-outline-stacked').getByRole('button', { name: 'Appendices', exact: true });
    await expect(button).toBeVisible({ timeout: 30000 });
    if ((await button.getAttribute('aria-expanded')) !== 'true') await button.click();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
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
    const navigationToggle = page.getByTestId('navigation-toggle');
    await expect(navigationToggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('navigation-rail')).toHaveAttribute('data-state', 'open');
    await openOutlineGroup(page, 'Main Report');
    await expect(page.getByTestId('paper-outline-desktop').getByRole('link').first()).toBeVisible();
    await expect(page.getByTestId('paper-load-progress')).toContainText('of 17 sections', { timeout: 30000 });
    // Print is ALWAYS enabled now -- it loads whatever is missing itself.
    await expect(page.getByTestId('paper-print-button')).toBeEnabled();

    await page.getByTestId('paper-load-full-document-button').click();
    await expect(page.getByTestId('paper-load-full-document-button')).toHaveText('Entire paper loaded', { timeout: 180000 });
    const sections = page.locator('[data-testid="paper-document"] section[data-paper-chunk]');
    await expect(sections).toHaveCount(341, { timeout: 30000 });
    await expect(page.locator('[data-paper-section-placeholder]')).toHaveCount(0);
    // paper-find-guidance no longer exists; the same guarantee (browser Find can
    // now search the whole paper) is announced in the load-progress status line.
    await expect(page.getByTestId('paper-load-progress')).toContainText('Browser Find (Ctrl+F) searches all of it.');
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

  test('authenticated real release Print loads the whole paper itself and opens the browser print dialog exactly once', async ({ page }, testInfo) => {
    requireJourney(testInfo.project.name);
    test.setTimeout(240000);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.addInitScript(() => {
      (window as typeof window & { __printCalls: number }).__printCalls = 0;
      window.print = () => {
        (window as typeof window & { __printCalls: number }).__printCalls += 1;
      };
    });
    await page.goto(canonicalWorkingDraft, { waitUntil: 'domcontentloaded' });
    failOnLogin(page.url());
    const printButton = page.getByTestId('paper-print-button');
    // Print is ALWAYS enabled -- a reader never needs "Load entire paper for
    // search" first just to print, and pressing it more than once while it is
    // working must still print only once.
    await expect(printButton).toBeEnabled();
    // Three presses in one task: the second and third arrive while the first is
    // still loading, which is exactly the duplicate-print case being guarded.
    await printButton.evaluate((button: HTMLButtonElement) => { button.click(); button.click(); button.click(); });
    await expect(page.getByTestId('paper-load-progress')).toHaveText(
      'Entire paper loaded. Browser Find (Ctrl+F) searches all of it.',
      { timeout: 180000 },
    );
    await expect
      .poll(() => page.evaluate(() => (window as typeof window & { __printCalls: number }).__printCalls), { timeout: 10000 })
      .toBe(1);
  });

  test('authenticated real release lands a navigated unloaded section below the sticky header at 360 and 768', async ({ page }, testInfo) => {
    requireJourney(testInfo.project.name);
    for (const width of [360, 768]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(canonicalWorkingDraft, { waitUntil: 'domcontentloaded' });
      failOnLogin(page.url());
      // Below lg the stacked Paper Navigation groups start collapsed; the last
      // appendix row is a depth-1 section that is never part of the initial
      // window, so this navigates into a placeholder.
      await openStackedAppendices(page);
      const entries = page.locator('[data-testid="paper-outline-stacked"] li[data-appendix] > div > a');
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
      await openStackedAppendices(page);
      const entries = page.locator('[data-testid="paper-outline-stacked"] li[data-appendix] > div > a');
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
    await openOutlineGroup(page, 'Main Report');
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

  test('authenticated real release Working Draft desktop outline nests Section 7.8 under 7.0 and keeps 8.0 as a sibling', async ({ page }, testInfo) => {
    requireJourney(testInfo.project.name);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(canonicalWorkingDraft, { waitUntil: 'domcontentloaded' });
    failOnLogin(page.url());
    // The nearest ancestor <li> of a specific outline link, scoped to the
    // desktop outline: exactly the entry's own list item, never an outer
    // ancestor's, so nesting (not merely co-presence) is what is asserted.
    const outlineItemFor = (label: string) => page.locator(
      `xpath=//*[@data-testid="paper-outline-desktop"]//a[normalize-space(.)="${label}"]/ancestor::li[1]`,
    );
    await openOutlineGroup(page, 'Main Report');
    const topicItem = outlineItemFor('7.0 Phase 2 Research Topics Supporting the Matrix Options Paper');
    // Chapters (level 2) start collapsed on desktop; open 7.0's own disclosure.
    const expandTopic = topicItem.getByRole('button', { name: /^Subsections of 7\.0 / });
    if ((await expandTopic.getAttribute('aria-expanded')) === 'false') await expandTopic.click();
    await expect(topicItem.getByRole('link', { name: 'Section 7.8: Input Parameter Inventory and Selection Options', exact: true })).toBeVisible();
    // 8.0 is a sibling topic, not a descendant of 7.0's list item.
    await expect(topicItem.getByRole('link', { name: '8.0 Evaluation Criteria', exact: true })).toHaveCount(0);

    const sectionItem = outlineItemFor('Section 7.8: Input Parameter Inventory and Selection Options');
    const expandSection = sectionItem.getByRole('button', { name: /^Subsections of/ });
    if ((await expandSection.count()) > 0) await expandSection.first().click();
    await expect(sectionItem.getByRole('link', { name: 'Policy-ready input categories - Phase 2 boundary', exact: true })).toBeVisible();
  });

  test('authenticated real release Working Draft outline navigation and Jump to topic stay in sync, and Back restores the outline question', async ({ page }, testInfo) => {
    requireJourney(testInfo.project.name);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(canonicalWorkingDraft, { waitUntil: 'domcontentloaded' });
    failOnLogin(page.url());
    const outline = page.getByTestId('paper-outline-desktop');
    await openOutlineGroup(page, 'Main Report');
    const outlineLink = outline.getByRole('link', { name: '7.7 BC Aquatic Database', exact: true });
    if ((await outlineLink.count()) === 0 || !(await outlineLink.first().isVisible())) {
      await page.getByRole('button', { name: /^Subsections of 7\.0/ }).first().click();
    }
    await outlineLink.first().click();
    // Paper navigation HIGHLIGHTS the related question; it never opens an editor.
    await expect(page.getByTestId('review-question-row-q12')).toHaveAttribute('data-highlighted', 'true', { timeout: 30000 });
    await expect(page.getByTestId('review-question-row-q12')).toHaveAttribute('data-open', 'false');
    await expect(page.locator('#active-question-heading')).toHaveCount(0);

    // An explicit choice opens the question.
    await page.getByRole('combobox', { name: 'Jump to topic' }).selectOption('8');
    await expect(page.locator('#active-question-heading')).toHaveText(/^Question 8/, { timeout: 30000 });
    await expect
      .poll(() => new URL(page.url()).searchParams.get('section'), { timeout: 30000 })
      .toBe('section-78-input-parameter-inventory-and-selection-options');

    // Back returns to the outline entry, which names a SECTION, not a question:
    // the explicitly opened editor closes and Question 12 is highlighted again.
    await page.goBack();
    await expect(page.getByTestId('review-question-row-q12')).toHaveAttribute('data-highlighted', 'true', { timeout: 30000 });
    await expect(page.locator('[data-testid^="review-question-row-q"][data-open="true"]')).toHaveCount(0);
    expect(new URL(page.url()).searchParams.get('q')).toBeNull();
  });

  test('authenticated real release reports unavailable assignment truthfully', async ({ page }, testInfo) => {
    requireJourney(testInfo.project.name);
    await page.goto(`${workspacePath}?mode=my-review`, { waitUntil: 'domcontentloaded' });
    failOnLogin(page.url());
    // The assignment claim now lives inside the "About this draft" popover, not
    // the main UI (RevisedPaperWorkspace's assignment/status row was removed).
    await page.getByRole('button', { name: 'About this draft' }).click();
    const aboutPopover = page.getByTestId('about-draft-popover');
    await expect(aboutPopover).toBeVisible();
    await expect(aboutPopover.getByText(/Assignments are not connected for this release\./)).toBeVisible();
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
    await expect(page.getByRole('navigation', { name: 'Review topics' }).getByRole('button', { name: /questions$/ })).toHaveCount(5);
    await expect(page.getByTestId('review-comments-toggle')).toHaveAttribute('aria-expanded', 'true');
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
  test('M2: authenticated real release question index opens a question, a typed draft survives a reload, and the char count/progress update', async ({ page }, testInfo) => {
    requireJourney(testInfo.project.name);
    await page.goto(`${workspacePath}?mode=my-review`, { waitUntil: 'domcontentloaded' });
    failOnLogin(page.url());

    const questionIndex = page.getByTestId('review-question-index');
    await expect(questionIndex.getByTestId(/^review-question-toggle-q/)).toHaveCount(12);
    await openQuestion(page, 4);
    await expect(page.getByTestId('review-save-status')).not.toHaveText('Loading your saved responses...', { timeout: 30000 });
    await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe(`rpq:${realVersion}:q04`);
    await expect(page.getByRole('combobox', { name: 'Jump to topic' })).toHaveValue('4');

    const textarea = page.getByRole('textbox', { name: 'Your response' });
    await textarea.fill('E2E authenticated draft text for question 4.');
    await expect(page.getByTestId('review-comment-char-count')).toHaveText(/^44 \/ 20000$/);
    // review-progress no longer names the active question ("N of 12 submitted"
    // [, drafts] is a whole-review summary); the active question is read from
    // the question heading and the topic combobox instead.
    await expect(page.locator('#active-question-heading')).toHaveText(/^Question 4:/);
    await expect(page.getByRole('combobox', { name: 'Jump to topic' })).toHaveValue('4');
    await expect(page.getByTestId('review-progress-count')).toHaveText(/^\d+ of 12 complete$/);
    await page.getByTestId('review-progress-toggle').click();
    await expect(page.getByTestId('review-progress')).toContainText(/^\d+ of 12 submitted/);
    await expect(page.getByTestId('review-progress')).toContainText(/1 draft\b/);
    await expect(questionIndex.getByTestId('review-question-toggle-q4')).toContainText(/Draft in this browser only|Draft saved|Unsaved changes/);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('textbox', { name: 'Your response' })).toHaveValue('E2E authenticated draft text for question 4.');
  });

  test('M2: authenticated real release per-portion "Open in Working Draft" link opens the canonical Working Draft on that section', async ({ page }, testInfo) => {
    requireJourney(testInfo.project.name);
    await page.goto(`${workspacePath}?mode=my-review`, { waitUntil: 'domcontentloaded' });
    failOnLogin(page.url());
    const link = page.getByTestId('cohort-paper-stack').getByRole('link', { name: /^Open .+ in Working Draft$/ }).first();
    // With nothing open the link names only the section (following it opens no editor).
    expect(new URL((await link.getAttribute('href')) ?? '', page.url()).searchParams.get('q')).toBeNull();
    await openQuestion(page, 1);
    const href = await link.getAttribute('href');
    // The link also carries the active question (q) so the review panel keeps it:
    // q is REQUIRED, and it survives into the Working Draft URL.
    const target = new URL(href ?? '', page.url());
    expect(target.searchParams.get('mode')).toBe('working-draft');
    const linkedQuestion = target.searchParams.get('q');
    expect(linkedQuestion).toMatch(/\S/);
    expect(target.searchParams.get('section')).toMatch(/\S/);
    await link.click();
    await expect.poll(() => new URL(page.url()).searchParams.get('mode'), { timeout: 30000 }).toBe('working-draft');
    expect(new URL(page.url()).searchParams.get('q')).toBe(linkedQuestion);
    await expect(page.getByRole('link', { name: 'Working Draft', exact: true })).toHaveAttribute('aria-current', 'page', { timeout: 90000 });
  });

  test('M2: authenticated real release Previous/Next question walk all 12 questions in cohort order, bounded at both ends', async ({ page }, testInfo) => {
    requireJourney(testInfo.project.name);
    await page.goto(`${workspacePath}?mode=my-review`, { waitUntil: 'domcontentloaded' });
    failOnLogin(page.url());
    await openQuestion(page, 1);
    await expect(page.getByTestId('review-save-status')).not.toHaveText('Loading your saved responses...', { timeout: 30000 });
    const previous = page.getByRole('button', { name: 'Previous question' });
    const next = page.getByRole('button', { name: 'Next question' });
    const select = page.getByRole('combobox', { name: 'Jump to topic' });
    const activeQuestionHeading = page.locator('#active-question-heading');

    await expect(previous).toBeDisabled();
      // Prev/Next walk the questions in TOPIC order (cohorts-v1.json), not
      // numeric order: Inputs and evidence holds 8, 9 and 12, then Methods and
      // water type holds 10 and 11.
      const topicOrder = [1, 2, 3, 4, 5, 6, 7, 8, 9, 12, 10, 11];
      for (let step = 1; step < topicOrder.length; step += 1) {
        await next.click();
        // review-progress is a whole-review summary now, not per-question; which
        // question is active is read from the heading and the topic combobox.
        await expect(activeQuestionHeading).toHaveText(new RegExp(`^Question ${topicOrder[step]}:`));
        await expect(select).toHaveValue(String(topicOrder[step]));
      }
    await expect(next).toBeDisabled();
    await expect(activeQuestionHeading).toHaveText(/^Question 11:/);
    await expect(select).toHaveValue('11');
    await previous.click();
    await expect(next).toBeEnabled();
    await expect(select).toHaveValue('10');
  });

  test('M3: intercepted response save, submit, reload and CAS conflict expose the authenticated workflow', async ({ page }, testInfo) => {
    requireJourney(testInfo.project.name);
    const questionId = `rpq:${realVersion}:q01`;
    // The signed-in E2E reviewer's own id, read from the real route (which names
    // it even while persistence is unavailable): a made-up id would be a
    // different reviewer, and the page's identity guard would rightly stop saving.
    let userKey = '';
    let reviewManifestSha256 = '';
    let savedRow: Record<string, unknown> | null = null;
    let forceConflict = false;
    await page.route('**/api/matrix-options/paper/reviews?*', async (route) => {
      reviewManifestSha256 = new URL(route.request().url()).searchParams.get('manifestSha256') ?? '';
      if (!userKey) {
        const real = await route.fetch();
        userKey = String(((await real.json().catch(() => ({}))) as { userKey?: unknown }).userKey ?? '');
        expect(userKey).toMatch(/\S/);
      }
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
    await openQuestion(page, 1);
    const textarea = page.getByRole('textbox', { name: 'Your response' });
    await textarea.fill('intercepted M3 response');
    await page.getByRole('button', { name: 'Save draft' }).click();
    await expect(page.getByTestId('review-save-status')).toContainText(/Draft saved/);
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
      await openQuestion(page, 1);
      await expect(page.getByTestId('review-comment-draft')).toBeVisible();
      const reviewComments = page.getByTestId('review-comments-toggle');
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
        { toggle: page.getByTestId('navigation-toggle'), heading: page.locator('#paper-navigation-rail-heading'), selector: '#paper-navigation-rail-heading', panel: '#paper-navigation-rail' },
        { toggle: page.getByTestId('review-comments-toggle'), heading: page.locator('#paper-review-comments-rail-heading'), selector: '#paper-review-comments-rail-heading', panel: '#paper-review-comments-rail' },
        // Download Files is no longer an in-flow panel revealed by scrolling: it is
        // an anchored popover (its focus and Escape contract is covered by the
        // "Download Files popover closes on Escape" test), so it has no landing.
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

    // Open the download files popover and handle React hydration races
    const downloadToggle = page.getByTestId('workspace-header-controls').getByRole('button', { name: 'Download Files', exact: true });

    // Wait for the client-only Navigation toggle to become visible as a hydration sentinel
    const navigationButton = page.getByTestId('navigation-toggle');
    await expect(navigationButton).toBeVisible();

    // Wait for the button to be interactive and hydrated
    await expect(downloadToggle).toBeVisible();
    await expect(downloadToggle).toBeEnabled();
    await downloadToggle.click();
    await expect(downloadToggle).toHaveAttribute('aria-expanded', 'true');

    // Verify the popover opens with the content-only panel inside it
    const popover = page.getByTestId('download-files-popover');
    await expect(popover).toBeVisible();
    await expect(popover).toHaveAttribute('role', 'dialog');
    const panel = page.getByTestId('download-files-panel');
    await expect(panel).toBeVisible();

    // Verify PDF and DOCX packages are present. Both modes now list every topic
    // with a verified manifest (My Review is no longer filtered to one cohort):
    // five topics x {PDF, DOCX}. Topic order puts Categories first.
    const packageItems = panel.getByRole('listitem');
    await expect(packageItems).toHaveCount(10);

    // Package labels are plain "<topic> - <kind>"; file names, byte counts and
    // SHA-256 hashes are no longer displayed (they still gate the fetch below).
    const pdfItem = packageItems.nth(0);
    const docxItem = packageItems.nth(1);
    const noPackageInternalsPattern = /sha-?256|bytes|\.pdf|\.docx/i;

    await expect(pdfItem).toContainText('Sediment Uses - PDF');
    await expect(pdfItem).not.toContainText(noPackageInternalsPattern);

    await expect(docxItem).toContainText('Sediment Uses - DOCX');
    await expect(docxItem).not.toContainText(noPackageInternalsPattern);

    // The download controls are BUTTONS, not links: the panel fetches and verifies
    // the response before writing anything, so a JSON error can never be saved as
    // a .pdf. There is therefore no href to read - the route URL is derived from
    // the package id, exactly as the manifest builds it.
    await expect(pdfItem.getByRole('button', { name: 'Sediment Uses - PDF' })).toBeVisible();
    await expect(docxItem.getByRole('button', { name: 'Sediment Uses - DOCX' })).toBeVisible();
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

  test('M2: authenticated real release Download Files popover closes on Escape with focus return, and becomes a full-width sheet at 360', async ({ page }, testInfo) => {
    requireJourney(testInfo.project.name);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${workspacePath}?mode=my-review`, { waitUntil: 'domcontentloaded' });
    failOnLogin(page.url());
    const downloadToggle = page.getByTestId('workspace-header-controls').getByRole('button', { name: 'Download Files', exact: true });
    await expect(downloadToggle).toBeVisible();
    await downloadToggle.click();
    const popover = page.getByTestId('download-files-popover');
    await expect(popover).toBeVisible();

    await page.keyboard.press('Escape');
    // The popover stays mounted (hidden, inert) so an in-flight download keeps its status.
    await expect(popover).toBeHidden();
    await expect(page.getByRole('dialog', { name: 'Download files' })).toHaveCount(0);
    await expect(downloadToggle).toBeFocused();

    await page.setViewportSize({ width: 360, height: 800 });
    await downloadToggle.click();
    await expect(popover).toBeVisible();
    await expect(popover).toHaveAttribute('data-sheet', 'true');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('M2: authenticated real release body text fills the reading frame, Comfortable/Wide set the frame maximum, and the frame follows the panels', async ({ page }, testInfo) => {
    requireJourney(testInfo.project.name);
    await page.setViewportSize({ width: 2523, height: 1294 });
    await page.goto(canonicalWorkingDraft, { waitUntil: 'domcontentloaded' });
    failOnLogin(page.url());
    const frame = page.getByTestId('paper-reading-frame');
    const handle = page.getByTestId('paper-resize-left');
    // Both panels open at their screen-size preset (the preset depends on the viewport).
    await expect.poll(async () => Number(await handle.getAttribute('aria-valuenow')), { timeout: 30000 }).toBeGreaterThan(0);
    // Geometry of the frame, its content box, and the long paragraphs and headings of the paper.
    const geometry = () => page.evaluate(() => {
      const frameElement = document.querySelector('[data-testid="paper-reading-frame"]') as HTMLElement;
      const box = frameElement.getBoundingClientRect();
      const style = getComputedStyle(frameElement);
      const contentLeft = box.left + parseFloat(style.paddingLeft);
      const contentRight = box.right - parseFloat(style.paddingRight);
      const prose = Array.from(document.querySelectorAll('[data-testid="paper-document"] .reader-prose .math-renderer > p'))
        .filter((element) => (element.textContent ?? '').length > 150 && element.getClientRects().length > 0).slice(0, 4)
        .map((element) => { const rect = element.getBoundingClientRect(); return { left: rect.left, right: rect.right, maxWidth: getComputedStyle(element).maxWidth, marginLeft: getComputedStyle(element).marginLeft }; });
      const headings = Array.from(document.querySelectorAll('[data-testid="paper-document"] .reader-prose .math-renderer > :is(h2, h3, h4)'))
        .filter((element) => element.getClientRects().length > 0).slice(0, 4)
        .map((element) => element.getBoundingClientRect().left);
      // Every body block type (headings, lists, quotes, rules, paragraphs): its BOX, not its text.
      const blocks = Array.from(document.querySelectorAll('[data-testid="paper-document"] .reader-prose .math-renderer > :is(h2, h3, h4, p, ul, ol, dl, blockquote, hr)'))
        .filter((element) => element.getClientRects().length > 0).slice(0, 40)
        .map((element) => { const rect = element.getBoundingClientRect(); return { tag: element.tagName, width: rect.width, card: (element.closest('.reader-prose') as HTMLElement).getBoundingClientRect().width }; });
      return { width: box.width, maxWidth: style.maxWidth, contentLeft, contentRight, prose, headings, blocks, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    await expect.poll(async () => (await geometry()).prose.length, { timeout: 30000 }).toBeGreaterThan(0);
    // The owner's viewport, both panels open: Comfortable caps the FRAME at 80rem, and
    // every long paragraph shares its first line's left edge with the headings and runs
    // to (near) the frame's right edge -- no narrow centred island inside the frame.
    let g = await geometry();
    expect(g.maxWidth).toBe('1280px');
    expect(g.width).toBeLessThanOrEqual(1280.5);
    expect(g.overflow).toBeLessThanOrEqual(1);
    // Headings and paragraphs share one left edge (the previous ch measure staggered each level).
    expect(g.headings.length).toBeGreaterThan(0);
    // Every body block's box spans its prose container: no heading, list, quote or rule is capped.
    const tags = new Set(g.blocks.map((block) => block.tag));
    for (const tag of ['H2', 'P', 'UL']) expect(tags.has(tag)).toBe(true);
    for (const block of g.blocks) expect({ tag: block.tag, spans: block.width >= block.card - 1 }).toEqual({ tag: block.tag, spans: true });
    const edges = [...g.headings, ...g.prose.map((item) => item.left)];
    expect(Math.max(...edges) - Math.min(...edges)).toBeLessThanOrEqual(1);
    for (const item of g.prose) {
      expect(item.maxWidth).toBe('none');
      expect(item.marginLeft).toBe('0px');
      // Two-sided: the previous per-block measure left ~300px free on each side at this width.
      expect(item.right - item.left).toBeGreaterThan((g.contentRight - g.contentLeft) * 0.85);
    }
    // Wide raises the frame maximum and persists per device.
    await page.getByTestId('reader-width-wide').click();
    await expect(frame).toHaveAttribute('data-reader-width', 'wide');
    await expect.poll(async () => (await geometry()).maxWidth).toBe('1536px');
    g = await geometry();
    expect(g.width).toBeGreaterThan(1280.5);
    for (const item of g.prose) expect(item.right - item.left).toBeGreaterThan((g.contentRight - g.contentLeft) * 0.85);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('paper-reading-frame')).toHaveAttribute('data-reader-width', 'wide', { timeout: 30000 });
    // Below its maximum the frame is fluid: widening the navigation panel narrows it at once.
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect.poll(async () => handle.getAttribute('aria-valuenow'), { timeout: 30000 }).toBe('288');
    // The rails animate their width after a viewport change: take the baseline once it has settled.
    let before = -1;
    await expect.poll(async () => { const width = Math.round((await geometry()).width); const settled = width === before; before = width; return settled; }, { timeout: 30000 }).toBe(true);
    expect(before).toBeLessThan(1280);
    await handle.focus();
    for (let step = 0; step < 4; step += 1) await page.keyboard.press('ArrowRight');
    await expect.poll(async () => (await geometry()).width).toBeLessThan(before - 20);
    await page.getByTestId('paper-reset-panel-widths').click();
    await expect.poll(async () => Math.round((await geometry()).width)).toBe(before);
    // Print is uncapped in both preferences.
    await page.emulateMedia({ media: 'print' });
    await expect.poll(async () => (await geometry()).maxWidth).toBe('none');
    await page.emulateMedia({ media: 'screen' });
    await page.getByTestId('reader-width-comfortable').click();
    await expect(page.getByTestId('paper-reading-frame')).toHaveAttribute('data-reader-width', 'comfortable');
    await page.emulateMedia({ media: 'print' });
    await expect.poll(async () => (await geometry()).maxWidth).toBe('none');
    await page.emulateMedia({ media: 'screen' });
  });

  test('M2: authenticated real release Paper Navigation groups start collapsed, list every appendix but no contents heading, and the paper relabels its contents headings', async ({ page }, testInfo) => {
    requireJourney(testInfo.project.name);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(canonicalWorkingDraft, { waitUntil: 'domcontentloaded' });
    failOnLogin(page.url());
    await expect(page.getByTestId('navigation-rail').getByRole('heading', { name: 'Paper Navigation' })).toBeVisible();
    const outline = page.getByTestId('paper-outline-desktop');
    // Nothing on screen is in the appendices, so that group stays collapsed.
    await expect(outline.getByRole('button', { name: 'Appendices', exact: true })).toHaveAttribute('aria-expanded', 'false');
    await openOutlineGroup(page, 'Main Report');
    await openOutlineGroup(page, 'Appendices');
    for (const letter of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'K', 'L']) {
      await expect(outline.getByRole('link', { name: new RegExp(`^Appendix ${letter}: `) }).first()).toBeVisible();
    }
    await expect(outline.getByRole('link', { name: 'Master Table of Contents', exact: true })).toHaveCount(0);
    const paper = page.getByTestId('paper-document');
    await expect(paper.getByRole('heading', { name: 'Paper contents', exact: true })).toBeVisible({ timeout: 60000 });
    await expect(paper.getByRole('heading', { name: 'Master Table of Contents', exact: true })).toHaveCount(0);
    // An appendix's own contents heading, reached by its stable anchor.
    await page.goto(`${canonicalWorkingDraft}&section=master-table-of-contents-1`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('paper-document').getByRole('heading', { name: 'Appendix contents', exact: true }).first()).toBeVisible({ timeout: 60000 });
  });

  test('authenticated real release draws the paper figures: Section 6.0 Figure 6-1 with its own labels (no SedS names), and Appendix A Figure A-1', async ({ page }, testInfo) => {
    requireJourney(testInfo.project.name);
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const [section, selector, caption, sample] of [
      ['60-proposed-matrix-standards-framework', 'figure[data-paper-figure="6-1"]', 'Figure 6-1. CSR Schedule 3.4 Part 1: the four receptor-pathways.', 'PATHWAY 1: HH-DIR'],
      ['11-scope-and-objective-of-the-bioavailability-monograph', 'figure[data-paper-figure="A-1"]', 'Figure A-1. The two bioavailability pathways.', 'HUMAN HEALTH SHORELINE EXPOSURE'],
    ] as const) {
      await page.goto(`${canonicalWorkingDraft}&section=${section}`, { waitUntil: 'domcontentloaded' });
      failOnLogin(page.url());
      const figure = page.getByTestId('paper-document').locator(selector);
      await expect(figure).toBeVisible({ timeout: 60000 });
      await expect(figure.locator('figcaption')).toContainText(caption);
      await expect(figure).toContainText(sample);
      // The figure is named by its caption for assistive technology.
      await expect(figure).toHaveAttribute('aria-labelledby', /paper-figure-caption-/);
      // The flattened summary text never reaches the page.
      await expect(page.getByTestId('paper-document').getByText(/^Diagram summary \d+\.$/)).toHaveCount(0);
      if (section === '60-proposed-matrix-standards-framework') {
        // Owner decision 2026-09-24: the default-on inline stakeholder paper never shows the
        // adjudicated SedS pathway names or their override authority (that prototype is
        // figure-lab only). Asserted here, while section 6.0 is loaded (a prior round asserted
        // this after navigating away to Appendix A, where the figure is not in the DOM at all,
        // so the negated matchers timed out on a missing element rather than testing anything).
        // Two-sided against the positive `sample` ('PATHWAY 1: HH-DIR') and `toBeVisible`
        // assertions above, which already pin the plain own-label figure.
        await expect(figure).not.toContainText('SedS');
        await expect(figure).not.toHaveAttribute('data-label-authority');
      }
    }
    // Owner decision: no derived (PX-*) figure renders inline; the table/list it would have
    // redrawn (Section 7.7.3's proposed four-stage verification and validation process) still
    // renders as plain text -- assert the real source wording (the derived-figure builder's
    // synthesized "Stage N: <lead>" label never appears in the source and only ever existed on
    // the removed PX-4 node, so a locator for it can never resolve while PX is inline-absent).
    await page.goto(`${canonicalWorkingDraft}&section=773-proposed-data-verification-and-validation-process`, { waitUntil: 'domcontentloaded' });
    failOnLogin(page.url());
    await expect(page.getByTestId('paper-document').locator('figure[data-derived-figure]')).toHaveCount(0);
    const verificationItem = page
      .getByTestId('paper-document')
      .locator('li')
      .filter({ hasText: 'Sample Identity and Co-Location Verification:' });
    await expect(verificationItem).toHaveCount(1);
    await expect(verificationItem).toBeVisible({ timeout: 60000 });
    // No horizontal overflow on a phone with a figure on screen.
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(`${canonicalWorkingDraft}&section=60-proposed-matrix-standards-framework`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('paper-document').locator('figure[data-paper-figure="6-1"]')).toBeVisible({ timeout: 60000 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  });

  test('M2: authenticated real release a question deep link opens that question; without one every question starts collapsed', async ({ page }, testInfo) => {
    requireJourney(testInfo.project.name);
    await page.goto(`${canonicalWorkingDraft}&q=${encodeURIComponent(`rpq:${realVersion}:q08`)}`, { waitUntil: 'domcontentloaded' });
    failOnLogin(page.url());
    await expect(page.getByTestId('review-question-row-q8')).toHaveAttribute('data-open', 'true', { timeout: 30000 });
    await expect(page.locator('#active-question-heading')).toHaveText(/^Question 8:/);
    await expect(page.locator('[data-testid^="review-question-row-q"][data-open="true"]')).toHaveCount(1);

    await page.goto(`${workspacePath}?mode=my-review`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('review-question-index')).toBeVisible();
    await expect(page.locator('[data-testid^="review-question-row-q"][data-open="true"]')).toHaveCount(0);
    await expect(page.getByTestId('review-progress-toggle')).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByTestId('review-progress-count')).toHaveText(/^\d+ of 12 complete$/);
    await expect(page.getByRole('navigation', { name: 'Review topics' }).getByRole('button', { name: '1. Sediment Uses, 3 questions' })).toBeVisible();
    await expect(page.getByTestId('review-question-index').getByRole('heading', { name: '4. Inputs and Evidence' })).toBeVisible();
  });

  test('M2: authenticated real release the navigation panel resize handle steps by keyboard, persists across reload, and resets', async ({ page }, testInfo) => {
    requireJourney(testInfo.project.name);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(canonicalWorkingDraft, { waitUntil: 'domcontentloaded' });
    failOnLogin(page.url());
    const handle = page.getByTestId('paper-resize-left');
    await expect(handle).toHaveAttribute('aria-valuenow', /^\d+$/);
    // The width settles once the layout has been measured (preset per layout class).
    await expect.poll(async () => handle.getAttribute('aria-valuenow'), { timeout: 30000 }).toBe('288');
    const before = Number(await handle.getAttribute('aria-valuenow'));

    // The hit area must not cover the scrollbar of the column to its LEFT (the
    // navigation rail and the document column both scroll, with their scrollbars
    // on their right edges). The rails animate their width (200 ms) while their
    // presets settle, so geometry is read only from a SETTLED layout: one atomic
    // snapshot per frame (all boxes in the same frame), accepted once no
    // animation is running and two consecutive frames report identical boxes.
    await expect(page.getByTestId('paper-resize-right')).toBeVisible(); // the review-comments rail defaults open at this width
    type Box = { x: number; width: number };
    type Geometry = { running: number; rail: Box; left: Box; column: Box; right: Box };
    const snapshot = () => page.evaluate(() => new Promise<string>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        const box = (testId: string) => {
          const rect = document.querySelector(`[data-testid="${testId}"]`)?.getBoundingClientRect();
          return rect ? { x: rect.x, width: rect.width } : null;
        };
        // CSS transitions only (finite): an unrelated infinite animation elsewhere must not block settling.
        const running = document.getAnimations().filter((animation) => animation.playState === 'running' && animation instanceof CSSTransition).length;
        resolve(JSON.stringify({ running, rail: box('navigation-rail'), left: box('paper-resize-left'), column: box('paper-document-column'), right: box('paper-resize-right') }));
      }));
    }));
    const firstSnapshot = await snapshot();
    let previous = '';
    let settled: Geometry | null = null;
    for (let frame = 0; frame < 120 && !settled; frame += 1) {
      const current = await snapshot();
      if (current === previous && (JSON.parse(current) as Geometry).running === 0) settled = JSON.parse(current) as Geometry;
      previous = current;
    }
    // Diagnostic record: the first (possibly mid-transition) and the settled geometry.
    await testInfo.attach('panel-geometry', { body: JSON.stringify({ first: JSON.parse(firstSnapshot), settled }, null, 2), contentType: 'application/json' });
    console.log(`[panel-geometry] first=${firstSnapshot} settled=${JSON.stringify(settled)}`);
    expect(settled, 'layout never reached two identical animation-free frames').not.toBeNull();
    const geometry = settled!;
    expect(geometry.left.x).toBeGreaterThanOrEqual(geometry.rail.x + geometry.rail.width - 1);
    expect(geometry.left.width).toBeGreaterThanOrEqual(24);
    // Same for the right handle: the document column to its left scrolls.
    expect(geometry.right.x).toBeGreaterThanOrEqual(geometry.column.x + geometry.column.width - 1);

    await handle.focus();
    await page.keyboard.press('ArrowRight');
    await expect(handle).toHaveAttribute('aria-valuenow', String(before + 16));

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('paper-resize-left')).toHaveAttribute('aria-valuenow', String(before + 16), { timeout: 30000 });

    await page.getByTestId('paper-reset-panel-widths').click();
    await expect(page.getByTestId('paper-resize-left')).toHaveAttribute('aria-valuenow', String(before));
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
    test.skip(!PRIVATE_RELEASE_JOURNEYS, 'The R5 session-teardown journey needs its version-specific private fixture.');
    test.skip(!reviewNavigationEnabled, 'The standard E2E harness supplies both exact-true flags for this journey.');
    test.skip(testInfo.project.name !== SESSION_TEARDOWN_PROJECT, 'Session-ending tests run only after every shared-session test has finished.');
    const logoutRequests: string[] = [];
    await page.route('**/auth/v1/logout**', async (route) => {
      logoutRequests.push(route.request().url());
      await route.fulfill({ status: 204, body: '', headers: { 'access-control-allow-origin': route.request().headers()['origin'] ?? '*', 'access-control-allow-credentials': 'true' } });
    });
    await page.goto(`${workspacePath}?mode=my-review`, { waitUntil: 'domcontentloaded' });
    failOnLogin(page.url());
    await expect(page.getByTestId('review-question-index')).toBeVisible();
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

/** The committed figures contract of the private draft: ids, sizes and hashes, no text. */
const privateFigureContract = JSON.parse(fs.readFileSync(path.join(contractsDirectory, `accepted-figures-${R5_PAPER_VERSION}.json`), 'utf8')) as {
  assets: Array<{ id: string; file: string; sha256: string; width: number; height: number }>;
  placements: Array<{ figureId: string; assetId: string; sectionAnchor: string }>;
};
/** Where the app asks for an accepted figure (acceptedFigureAssetHref). */
const privateFigureHref = (asset: { file: string; sha256: string }) => `/api/matrix-options/paper/v/${encodeURIComponent(R5_PAPER_VERSION)}/figures/${encodeURIComponent(asset.file)}?sha256=${asset.sha256}`;
/** Where the app asks for one section (PaperSectionWindow's sectionUrl). */
const privateSectionHref = (anchor: string, paperSha256: string) => `/api/matrix-options/paper/v/${encodeURIComponent(R5_PAPER_VERSION)}/sections/${encodeURIComponent(anchor)}?paper=${encodeURIComponent(paperSha256)}`;
/** The private presentation, read in this test process only. Call it inside a private journey. */
const readPrivatePresentationBytes = () => fs.readFileSync(path.join(process.env.MATRIX_OPTIONS_PAPER_PRIVATE_ASSET_DIR ?? '', R5_PAPER_VERSION, 'presentation.md'));

/*
 * Always-run guards of the private draft. None renders it: the first reads only the
 * environment (and, where the fixture exists, its length and hash), the second proves the
 * block that keeps every other page away from it, the third sends requests that carry no
 * session. They carry the standard harness's journey name so that the authenticated run
 * selects them as well.
 */
test.describe('Matrix Options Paper private draft guards', () => {
  test('authenticated real release private draft journeys are not silently skipped where the fixture is required', () => {
    const privateJourneysEnabled = assertPrivateFixtureModeContract({
      mode: PRIVATE_FIXTURE_MODE,
      githubActions: ON_GITHUB_ACTIONS,
      fixturePresent: PRIVATE_R5_FIXTURE_PRESENT || PRIVATE_V0991_FIXTURE_PRESENT,
      authenticatedProjectEnabled: AUTHENTICATED_PROJECT_ENABLED,
    });
    if (!privateJourneysEnabled) return;
    for (const version of [R5_PAPER_VERSION, V0991_PAPER_VERSION]) {
      if (!hasPrivatePresentation(version)) continue;
      const release = getPaperRelease(version)!;
      const bytes = fs.readFileSync(path.join(privateAssetDirectory!, version, 'presentation.md'));
      expect(bytes.length).toBe(release.bytes);
      expect(sha256Hex(bytes)).toBe(release.sha256);
    }
  });

  test('authenticated real release a page outside the private journeys cannot request the private draft', async ({ page }) => {
    test.skip(PRIVATE_RELEASE_JOURNEYS, 'The block is installed only where the private journeys cannot run.');
    // The block every other describe installs, proven on the real address.
    await blockPrivateRelease(page);
    // The control first: with the block installed, the page still reaches an address that
    // does not name the private draft.
    expect((await page.goto('/login', { waitUntil: 'domcontentloaded' }))?.ok()).toBe(true);
    // Then the private draft's own address: the navigation is refused in the browser and the
    // server is never asked.
    const answered: string[] = [];
    page.on('response', (response) => {
      if (response.url().includes(R5_PAPER_VERSION)) answered.push(response.url());
    });
    const refused = await page.goto(`${privateWorkspacePath}?mode=working-draft`).then(() => false, () => true);
    expect(refused).toBe(true);
    expect(answered).toEqual([]);
  });

  test('authenticated real release private draft routes give a request with no session no content', async ({ playwright, baseURL }) => {
    // storageState is EXPLICITLY empty: in the authenticated project a bare request context
    // inherits the stored session, and a 401 proven with a session attached proves nothing.
    const anonymous = await playwright.request.newContext({ baseURL: baseURL!, storageState: { cookies: [], origins: [] } });
    try {
      expect((await anonymous.storageState()).cookies).toHaveLength(0);
      /*
       * Both routes check the feature gate first and the session second. With the paper flags
       * off (the flags-off regression run) the gate answers 404 before a session is looked at;
       * with them on, no session is 401. Either way: JSON, no-store, and nothing but the error.
       */
      const denied = reviewNavigationEnabled ? { status: 401, body: { error: 'Unauthorized' } } : { status: 404, body: { error: 'Not found' } };
      const asset = privateFigureContract.assets[0];
      const otherSha256 = '0'.repeat(64);
      for (const address of [
        privateSectionHref('any-section', privateRelease.sha256),
        privateFigureHref(asset),
        // 401 comes before the hash comparisons: a wrong hash with no session is not a 409.
        privateSectionHref('any-section', otherSha256),
        privateFigureHref({ file: asset.file, sha256: otherSha256 }),
      ]) {
        const response = await anonymous.get(address, { maxRedirects: 0 });
        expect(response.status(), address).toBe(denied.status);
        expect(response.headers()['cache-control'], address).toBe('no-store');
        expect(response.headers()['content-type'] ?? '', address).toContain('application/json');
        expect(await response.json(), address).toEqual(denied.body);
      }
    } finally {
      await anonymous.dispose();
    }
  });
});

/*
 * Journeys of the private draft. They read only: the review API is intercepted wherever a
 * response could be written, so nothing is saved to the review record for either draft.
 *
 * What is asserted about the draft's own content is a count, an id, a hash or a boolean
 * computed in this process, so a failure prints numbers and never paper text. Text the
 * application itself defines (labels, the notice, status lines) is asserted as text.
 */
test.describe('Matrix Options Paper private draft journeys', () => {
  test.skip(!PRIVATE_RELEASE_JOURNEYS, 'The private draft renders only where its fixture is available, never on GitHub Actions, and not when MATRIX_PAPER_PRIVATE_FIXTURE is skip.');
  // Decided here rather than inside each journey, so the flags-off run opens no page for them.
  test.skip(!reviewNavigationEnabled, 'The standard E2E harness supplies both exact-true flags for these journeys.');
  test.beforeEach(({ page, trace, screenshot, video }, testInfo) => {
    // Fail closed: the file-level test.use above is what switches recording off for these journeys.
    if (trace !== 'off' || screenshot !== 'off' || video !== 'off') throw new Error(PRIVATE_RECORDING_MESSAGE);
    holdNavigationsUntilHydrated(page, testInfo);
  });
  test.setTimeout(120000);

  const privateStart = `${privateWorkspacePath}?mode=working-draft`;
  const privateWorkspacePattern = privateWorkspacePath.replace(/[.]/g, '[.]');
  const noticeText = privateRelease.withheld!.notice;
  const withheldStableSectionId = privateRelease.withheld!.stableSectionId;
  const oldWithheldAddress = `/matrix-options/paper/v/${R5_PAPER_VERSION}/${withheldStableSectionId}`;
  const noticeLandingAddress = `${privateStart}#${PAPER_WITHHELD_NOTICE_ID}`;
  /** Every heading of a Markdown text with the anchor the reader gives it (duplicates are numbered). */
  const headingsOf = (text: string) => {
    const seen = new Map<string, number>();
    return Array.from(text.matchAll(/^(#{1,6})[ \t]+(.+?)[ \t]*$/gm), (match) => {
      const base = match[2].trim().toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s+/g, '-').replace(/-+/g, '-');
      const count = seen.get(base) ?? 0;
      seen.set(base, count + 1);
      return { level: match[1].length, anchor: count === 0 ? base : `${base}-${count}`, index: match.index ?? 0 };
    });
  };
  /** The private presentation and its headings; this file's own heading parse agrees with the compiler's count. */
  const readPrivateHeadings = () => {
    const presentation = readPrivatePresentationBytes().toString('utf8');
    const headings = headingsOf(presentation);
    expect(headings.length).toBe(340);
    // The draft's top-level sections are its level-2 headings (it has no level-1 heading).
    expect(headings.filter((heading) => heading.level === 2).length).toBe(98);
    return { presentation, headings };
  };
  /** Whether the text an element shows matches, decided in the page: the text itself never reaches a failure message. */
  const shows = (page: Page, selector: string, pattern: RegExp) => page.locator(selector).first().evaluate((element, source) => new RegExp(source).test((element.textContent ?? '').replace(/\s+/g, ' ').trim()), pattern.source);
  const sectionOf = (href: string | null) => new URLSearchParams((href ?? '').replace(/^\?/, '')).get('section') ?? '';

  test('authenticated real release offers the private draft as a selectable non-default draft and draws all 20 figure placements', async ({ page, playwright, baseURL }, testInfo) => {
    requireJourney(testInfo.project.name);
    test.setTimeout(420000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const { presentation, headings } = readPrivateHeadings();
    // The alternative text of each placement block (marker, blank, caption, blank, status, blank, image), as a hash.
    const lines = presentation.split('\n');
    const altSha256 = new Map<string, string>();
    lines.forEach((line, index) => {
      const marker = /^<!-- MATRIX_FIGURE_PLACEMENT: ([0-9A-Z]+-[0-9]+) -->[ \t]*$/.exec(line);
      const image = marker ? /^!\[(.*)\]\(assets\/[A-Za-z0-9-]+\.png\)[ \t]*$/.exec(lines[index + 6] ?? '') : null;
      if (marker && image) altSha256.set(marker[1], sha256Hex(image[1]));
    });
    expect(altSha256.size).toBe(20);
    // The section that lists the figures: the top-level heading above the first link to a figure anchor.
    const firstFigureLink = presentation.search(/\]\(#fig-[a-z0-9-]+\)/);
    expect(firstFigureLink).toBeGreaterThan(0);
    const figureListAnchor = headings.filter((heading) => heading.level === 2 && heading.index < firstFigureLink).at(-1)?.anchor ?? '';
    expect(figureListAnchor.length).toBeGreaterThan(0);

    // The default entry is still the predecessor, with no working-draft status line.
    await page.goto('/matrix-options/paper', { waitUntil: 'domcontentloaded' });
    failOnLogin(page.url());
    await expect.poll(() => pathAndQuery(page.url()), { timeout: 30000 }).toBe(canonicalWorkingDraft);
    await expect(page.getByTestId('paper-version-status')).toHaveCount(0);
    const toggle = page.getByTestId('paper-version-toggle');
    await expect(toggle).toContainText('Earlier draft');
    await expect(page.getByTestId('paper-document').locator('figure[data-accepted-figure]')).toHaveCount(0);

    // Choosing the private draft is plain navigation to its own version. Hydrated first: what
    // is asserted above is already true of the server-rendered page, where a click is lost.
    await waitForHydratedWorkspace(page);
    await toggle.click();
    const popover = page.getByTestId('paper-version-popover');
    await expect(popover.getByTestId('paper-version-option-1.0.11-remediated-7-8-successor-20260918-D')).toHaveAttribute('aria-current', 'true');
    await popover.getByTestId(`paper-version-option-${R5_PAPER_VERSION}`).click();
    await expect.poll(() => new RegExp(`^${privateWorkspacePattern}[?]mode=working-draft`).test(pathAndQuery(page.url())), { timeout: 60000 }).toBe(true);
    await waitForHydratedWorkspace(page);
    await expect(page.getByTestId('paper-version-toggle')).toContainText('Current draft');
    const status = page.getByTestId('paper-version-status');
    await expect(status).toBeVisible();
    await expect(status).toContainText('Current review draft. A preview: not the default draft. Responses to this draft are separate from the earlier draft.');
    await expect(page.getByRole('link', { name: 'Working Draft', exact: true })).toHaveAttribute('href', privateStart);
    await expect(page.locator('h1')).toHaveCount(1);

    // Every accepted figure, proven the way a reader reaches one: from the draft's list of
    // figures. Each of its links is the app's own mapping of a figure to the section that holds
    // it (a figure can sit in a subsection of the section the contract anchors it to, and this
    // draft loads those subsections as sections of their own), so the test follows the links and
    // computes no address. The whole draft is deliberately NOT loaded here. 98 sections plus 17
    // images is most of one user's request budget for a minute, and this file runs in parallel
    // with the other full-load journeys under the same shared e2e user.
    await expect(page.getByTestId('paper-load-progress')).toContainText('of 98 sections', { timeout: 30000 });
    expect(privateFigureContract.placements).toHaveLength(20);
    expect(privateFigureContract.assets).toHaveLength(17);
    const drawn = new Map<string, { src: string; altSha256: string; section: string }>();
    const paperDocument = page.getByTestId('paper-document');
    await page.goto(`${privateStart}&section=${figureListAnchor}`, { waitUntil: 'domcontentloaded' });
    await expect(paperDocument.getByRole('link', { name: /^Figure 6-1[.]/ })).toBeVisible({ timeout: 60000 });
    // Only the figure id and the address leave the page: the link text stays there.
    const figureLinks = new Map<string, string>(await paperDocument.locator('a').evaluateAll((nodes) => nodes.flatMap((node): Array<[string, string]> => {
      const id = /^Figure ([0-9A-Z]+-[0-9]+)[.]/.exec((node.textContent ?? '').trim())?.[1];
      return id ? [[id, node.getAttribute('href') ?? '']] : [];
    })));
    // One link for each of the 20 placements, and nothing else.
    expect([...figureLinks.keys()].sort()).toEqual(privateFigureContract.placements.map((placement) => placement.figureId).sort());
    for (const placement of privateFigureContract.placements) {
      if (drawn.has(placement.figureId)) continue;
      const href = figureLinks.get(placement.figureId) ?? '';
      expect(/^[?]mode=working-draft&section=[a-z0-9-]+$/.test(href), `figure list link for ${placement.figureId}`).toBe(true);
      await page.goto(`${privateWorkspacePath}${href}`, { waitUntil: 'domcontentloaded' });
      await expect.poll(() => /[?]mode=working-draft&section=/.test(pathAndQuery(page.url())), { timeout: 60000 }).toBe(true);
      await expect(paperDocument.locator(`figure[data-accepted-figure="${placement.figureId}"]`)).toHaveCount(1, { timeout: 60000 });
      const windowFigures = paperDocument.locator('figure[data-accepted-figure]');
      // Every image in this window is served by the authenticated figures route, and it decodes.
      await expect.poll(() => windowFigures.locator('img').evaluateAll((images) => images.filter((image) => !(image as HTMLImageElement).complete || (image as HTMLImageElement).naturalWidth === 0).length), { timeout: 120000 }).toBe(0);
      await expect(paperDocument.locator('[data-accepted-figure-load-failed], [data-testid="accepted-figure-load-failed"]')).toHaveCount(0);
      for (const entry of await windowFigures.evaluateAll((nodes) => nodes.map((node) => ({ id: node.getAttribute('data-accepted-figure') ?? '', section: node.getAttribute('data-section-anchor') ?? '', src: node.querySelector('img')?.getAttribute('src') ?? '', alt: node.querySelector('img')?.getAttribute('alt') ?? '' })))) {
        drawn.set(entry.id, { src: entry.src, altSha256: sha256Hex(entry.alt), section: entry.section });
      }
      // In every window: no figure that failed to bind, none of the predecessor's redraws or the
      // figure-lab PX figures, nothing of the source markup, no element id used twice, no sideways scroll.
      await expect(paperDocument.locator('[data-accepted-figure-unavailable]')).toHaveCount(0);
      // No figure of this private draft links to its image in a tab of its own.
      await expect(windowFigures.locator('a, [target], .paper-figure__actions')).toHaveCount(0);
      await expect(paperDocument.locator('figure[data-paper-figure]')).toHaveCount(0);
      await expect(paperDocument.locator('figure[data-derived-figure]')).toHaveCount(0);
      const windowText = await paperDocument.innerText();
      for (const marker of ['MATRIX_FIGURE_PLACEMENT', '[]{#', ':::', 'assets/FIG']) expect(windowText.includes(marker), marker).toBe(false);
      // A section opened by its own address is server-rendered, so the source Markdown of that
      // section travels in the framework's page data (script elements the reader never sees).
      // The marker must be nowhere else: no rendered text, comment, attribute or template.
      expect(await page.evaluate(() => {
        const found: string[] = [];
        const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_COMMENT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const parent = node.parentElement;
          if (parent?.tagName === 'SCRIPT') continue;
          if ((node.nodeValue ?? '').includes('MATRIX_FIGURE_PLACEMENT')) found.push(`${node.nodeType === Node.COMMENT_NODE ? 'comment' : 'text'} in ${parent?.tagName ?? 'document'}`);
        }
        for (const element of Array.from(document.querySelectorAll('*'))) {
          for (const attribute of Array.from(element.attributes)) if (attribute.value.includes('MATRIX_FIGURE_PLACEMENT')) found.push(`attribute ${attribute.name} on ${element.tagName}`);
          if (element instanceof HTMLTemplateElement && element.innerHTML.includes('MATRIX_FIGURE_PLACEMENT')) found.push('template');
        }
        return found;
      })).toEqual([]);
      expect(await page.evaluate(() => {
        const seen = new Set<string>();
        let duplicates = 0;
        for (const element of Array.from(document.querySelectorAll('[id]'))) {
          if (seen.has(element.id)) duplicates += 1;
          seen.add(element.id);
        }
        return duplicates;
      })).toBe(0);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    }
    // All twenty placements were drawn, each in the section the contract binds it to, from 17
    // distinct assets, with the alternative text of its own block.
    expect([...drawn.keys()].sort()).toEqual(privateFigureContract.placements.map((placement) => placement.figureId).sort());
    for (const placement of privateFigureContract.placements) {
      const asset = privateFigureContract.assets.find((candidate) => candidate.id === placement.assetId)!;
      expect(drawn.get(placement.figureId), placement.figureId).toEqual({ src: privateFigureHref(asset), altSha256: altSha256.get(placement.figureId), section: placement.sectionAnchor });
    }
    const sources = [...new Set([...drawn.values()].map((entry) => entry.src))];
    expect(sources).toHaveLength(17);
    const figures = paperDocument.locator('figure[data-accepted-figure]');
    // Print: the figures stay, the screen-only controls go.
    await page.emulateMedia({ media: 'print' });
    await expect(figures.first()).toBeVisible();
    await expect(page.getByTestId('paper-version-status')).toHaveCSS('display', 'none');
    // The withheld-appendix notice is outside the header and prints with the paper.
    await expect(page.getByTestId('paper-withheld-notice')).toBeVisible();
    await page.emulateMedia({ media: 'screen' });
    // A figure of this private draft has no link of its own, on screen or in print: nothing in
    // a figure opens the image by itself in a tab outside the page's session gate.
    await expect(figures.locator('a, [target], .paper-figure__actions')).toHaveCount(0);
    await expect(paperDocument.getByText('Open full-size image')).toHaveCount(0);

    // What it has instead is the full-size viewer: a button under every figure, and a dialog IN
    // the page (inside its session gate). Opened from the keyboard, it asks the authenticated
    // figures route for the bytes again and draws them: the image is given no address at all.
    // (Sections go on loading around the reading position, so "the first figure" is not a
    // fixed element: the figure under test is named by its own id.)
    await expect.poll(() => figures.evaluateAll((nodes) => nodes.filter((node) => node.querySelectorAll('button[data-testid="accepted-figure-view-full-size"]').length !== 1).length)).toBe(0);
    const viewedFigureId = (await figures.first().getAttribute('data-accepted-figure')) ?? '';
    expect(privateFigureContract.placements.some((placement) => placement.figureId === viewedFigureId)).toBe(true);
    const viewButton = paperDocument.locator(`figure[data-accepted-figure="${viewedFigureId}"]`).getByRole('button', { name: `View full-size image of Figure ${viewedFigureId}`, exact: true });
    await expect(viewButton).toHaveCount(1);
    await expect(viewButton).toBeEnabled();
    const viewer = page.getByTestId('accepted-figure-viewer');
    await expect(viewer).toHaveCount(0);
    const viewerRequests: Array<{ path: string; status: number; headers: Promise<Record<string, string>> }> = [];
    // Only the viewer asks for a figure with fetch; the figures in the page are image loads
    // (and sections around the reading position go on loading theirs).
    const recordFigureRequest = (response: { url: () => string; status: () => number; request: () => { resourceType: () => string; allHeaders: () => Promise<Record<string, string>> } }) => {
      const address = new URL(response.url());
      if (address.pathname.includes('/figures/') && response.request().resourceType() === 'fetch') viewerRequests.push({ path: address.pathname, status: response.status(), headers: response.request().allHeaders() });
    };
    page.on('response', recordFigureRequest);
    await viewButton.focus();
    await page.keyboard.press('Enter');
    await expect(viewer).toHaveAttribute('data-view', 'shown', { timeout: 60000 });
    // One new request, to the application's own figures route (never to Storage), asking for no cached answer.
    expect(viewerRequests).toHaveLength(1);
    expect(viewerRequests[0].path.startsWith(`/api/matrix-options/paper/v/${encodeURIComponent(R5_PAPER_VERSION)}/figures/`)).toBe(true);
    // It is a full request, not a revalidation of a kept copy: it offers no validator, and the
    // route answers it 200 with the bytes (a revalidation would be answered 304).
    const viewerRequestHeaders = await viewerRequests[0].headers;
    expect(viewerRequestHeaders['if-none-match']).toBeUndefined();
    expect(viewerRequests[0].status).toBe(200);
    // The dialog is modal, holds the focus, has a name, and the image in it is DRAWN (a canvas
    // of the asset's bound pixel size with something on it), so it has no address at all: no
    // element in the dialog loads from one, and nothing in it names one.
    const viewedAsset = privateFigureContract.assets.find((candidate) => candidate.id === privateFigureContract.placements.find((placement) => placement.figureId === viewedFigureId)?.assetId)!;
    expect(await viewer.evaluate((dialog) => {
      const canvas = dialog.querySelector('canvas') as HTMLCanvasElement;
      // A sample of the drawn pixels: a canvas nothing was drawn on is fully transparent.
      const sample = canvas.getContext('2d')!.getImageData(Math.floor(canvas.width / 4), Math.floor(canvas.height / 4), Math.ceil(canvas.width / 2), 1).data;
      let opaque = 0;
      for (let index = 3; index < sample.length; index += 4) if (sample[index] > 0) opaque += 1;
      const box = dialog.getBoundingClientRect();
      return {
        modal: (dialog as HTMLDialogElement).open && dialog.matches(':modal'),
        focusInside: dialog.contains(document.activeElement),
        width: canvas.width,
        height: canvas.height,
        drawn: opaque > 0,
        isAnImageWithAName: canvas.getAttribute('role') === 'img' && (canvas.getAttribute('aria-label') ?? '').length > 0,
        elementsWithAnAddress: dialog.querySelectorAll('img, a, [src], [href], [target]').length,
        namesAnAddress: /https?:|blob:|data:|[/]storage[/]|[/]api[/]|token=/.test(dialog.innerHTML),
        insideWindow: box.left >= 0 && box.top >= 0 && box.right <= window.innerWidth && box.bottom <= window.innerHeight,
      };
    })).toEqual({ modal: true, focusInside: true, width: viewedAsset.width, height: viewedAsset.height, drawn: true, isAnImageWithAName: true, elementsWithAnAddress: 0, namesAnAddress: false, insideWindow: true });
    await expect(viewer).toHaveAccessibleName(/^Figure [0-9A-Z]+-[0-9]+, full size$/);
    // "Fit to window" off shows the image at its own pixel size; the page behind does not scroll sideways.
    const fitToggle = viewer.getByRole('button', { name: 'Fit to window' });
    await expect(fitToggle).toHaveAttribute('aria-pressed', 'true');
    expect(await viewer.locator('canvas').evaluate((canvas) => { const stage = canvas.parentElement!.getBoundingClientRect(); const box = canvas.getBoundingClientRect(); return box.width > 0 && box.right <= stage.right + 1 && box.bottom <= stage.bottom + 1; })).toBe(true);
    await fitToggle.click();
    await expect(fitToggle).toHaveAttribute('aria-pressed', 'false');
    expect(await viewer.locator('canvas').evaluate((canvas) => Math.abs(canvas.getBoundingClientRect().width - (canvas as HTMLCanvasElement).width) <= 1)).toBe(true);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    // Escape closes it and focus is back on the button it was opened from.
    await page.keyboard.press('Escape');
    await expect(viewer).toHaveCount(0);
    await expect(viewButton).toBeFocused();
    // "Close" does the same, and every open asks the route again.
    await page.keyboard.press('Space');
    await expect(viewer).toHaveAttribute('data-view', 'shown', { timeout: 60000 });
    expect(viewerRequests).toHaveLength(2);
    await viewer.getByRole('button', { name: 'Close' }).click();
    await expect(viewer).toHaveCount(0);
    await expect(viewButton).toBeFocused();
    page.off('response', recordFigureRequest);

    // A signed-out request never receives a figure of this draft. storageState is EXPLICITLY
    // empty: in this project a bare request context inherits the stored session.
    const signedOut = await playwright.request.newContext({ baseURL: baseURL!, storageState: { cookies: [], origins: [] } });
    try {
      expect((await signedOut.storageState()).cookies).toHaveLength(0);
      const denied = await signedOut.get(sources[0]);
      expect(denied.status()).toBe(401);
      expect(denied.headers()['content-type'] ?? '').not.toContain('image/');
      // Two-sided: the same address is served to the signed-in reader.
      expect((await page.request.get(sources[0])).status()).toBe(200);
    } finally {
      await signedOut.dispose();
    }

    // Phone width: the figure scrolls inside its own plate, the page never scrolls sideways.
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(`/matrix-options/paper/v/${R5_PAPER_VERSION}/sec-6-0`, { waitUntil: 'domcontentloaded' });
    await expect.poll(() => /[?]mode=working-draft&section=/.test(pathAndQuery(page.url())), { timeout: 60000 }).toBe(true);
    const phoneFigure = page.getByTestId('paper-document').locator('figure#fig-6-1');
    await expect(phoneFigure).toBeVisible({ timeout: 60000 });
    expect(await shows(page, 'figure#fig-6-1 figcaption', /Figure 6-1[.]/)).toBe(true);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    // Phone width, the viewer: the dialog fits the window, the fitted image fits the dialog, and
    // the page behind still does not scroll sideways.
    await waitForHydratedWorkspace(page);
    const phoneViewButton = phoneFigure.getByRole('button', { name: 'View full-size image of Figure 6-1' });
    await expect(phoneViewButton).toBeEnabled({ timeout: 60000 });
    await phoneViewButton.click();
    const phoneViewer = page.getByTestId('accepted-figure-viewer');
    await expect(phoneViewer).toHaveAttribute('data-view', 'shown', { timeout: 60000 });
    expect(await phoneViewer.evaluate((dialog) => {
      const box = dialog.getBoundingClientRect();
      const image = dialog.querySelector('canvas')!.getBoundingClientRect();
      const close = dialog.querySelector('[data-testid="accepted-figure-viewer-close"]')!.getBoundingClientRect();
      return {
        dialogInsideWindow: box.left >= 0 && box.top >= 0 && box.right <= window.innerWidth && box.bottom <= window.innerHeight,
        imageInsideDialog: image.width > 0 && image.left >= box.left - 1 && image.right <= box.right + 1 && image.bottom <= box.bottom + 1,
        closeIsATouchTarget: close.height >= 44 && close.right <= box.right,
      };
    })).toEqual({ dialogInsideWindow: true, imageInsideDialog: true, closeIsATouchTarget: true });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    await phoneViewer.getByRole('button', { name: 'Close' }).click();
    await expect(phoneViewer).toHaveCount(0);
    await expect(phoneViewButton).toBeFocused();

    // A retired predecessor id lands where the section that replaced it lands; the status line returns to the default draft.
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/matrix-options/paper/v/${R5_PAPER_VERSION}/sec-7-8`, { waitUntil: 'domcontentloaded' });
    await expect.poll(() => /[?]mode=working-draft&section=[a-z0-9-]+$/.test(pathAndQuery(page.url())), { timeout: 60000 }).toBe(true);
    const replacementLanding = pathAndQuery(page.url());
    await page.goto(`/matrix-options/paper/v/${R5_PAPER_VERSION}/sec-7-8-1`, { waitUntil: 'domcontentloaded' });
    await expect.poll(() => pathAndQuery(page.url()) === replacementLanding, { timeout: 60000 }).toBe(true);
    // Hydrated first, like every other interaction here (without this wait the click failed
    // to navigate in 1 of 4 runs).
    await waitForHydratedWorkspace(page);
    await page.getByTestId('paper-version-status').getByRole('link', { name: 'Go to the earlier draft' }).click();
    await expect.poll(() => new RegExp(`^${workspacePath.replace(/[.]/g, '[.]')}[?]mode=working-draft`).test(pathAndQuery(page.url())), { timeout: 60000 }).toBe(true);
    await waitForHydratedWorkspace(page);
    await expect(page.getByTestId('paper-version-status')).toHaveCount(0);
  });

  // Session-ending, so it runs ONLY in the session-teardown project, and the one request the
  // app's Logout sends to GoTrue is answered here instead of delivered (see the logout journey
  // of the default draft above: no session of the shared account is revoked).
  test(`${SESSION_TEARDOWN_TAG} authenticated real release private draft: after sign-out, Back shows no figure, no full-size viewer and nothing of the draft`, async ({ page }, testInfo) => {
    test.skip(!PRIVATE_RELEASE_JOURNEYS, 'The R5 session-teardown journey needs its version-specific private fixture.');
    test.skip(testInfo.project.name !== SESSION_TEARDOWN_PROJECT, 'Session-ending tests run only after every shared-session test has finished.');
    test.setTimeout(420000);
    const logoutRequests: string[] = [];
    await page.route('**/auth/v1/logout**', async (route) => {
      logoutRequests.push(route.request().url());
      await route.fulfill({ status: 204, body: '', headers: { 'access-control-allow-origin': route.request().headers()['origin'] ?? '*', 'access-control-allow-credentials': 'true' } });
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/matrix-options/paper/v/${R5_PAPER_VERSION}/sec-6-0`, { waitUntil: 'domcontentloaded' });
    failOnLogin(page.url());
    await expect.poll(() => /[?]mode=working-draft&section=/.test(pathAndQuery(page.url())), { timeout: 60000 }).toBe(true);
    await waitForHydratedWorkspace(page);
    const figure = page.getByTestId('paper-document').locator('figure#fig-6-1');
    await expect(figure).toBeVisible({ timeout: 60000 });
    // The reader uses the viewer, then closes it: the page is the one a kept copy would show again.
    const viewButton = figure.getByRole('button', { name: 'View full-size image of Figure 6-1' });
    await expect(viewButton).toBeEnabled({ timeout: 60000 });
    await viewButton.click();
    const viewer = page.getByTestId('accepted-figure-viewer');
    await expect(viewer).toHaveAttribute('data-view', 'shown', { timeout: 60000 });
    await page.keyboard.press('Escape');
    await expect(viewer).toHaveCount(0);
    // Sign out with the application's own control.
    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 120000 });
    expect(logoutRequests).toHaveLength(1);
    /** What of the private draft is in the document: counts only. */
    const privateContent = () => page.evaluate(() => ({
      workspace: document.querySelectorAll('[data-testid="workspace-shell"], [data-testid="paper-document"], #paper-withheld-notice').length,
      figures: document.querySelectorAll('figure[data-accepted-figure], figure[data-accepted-figure] img').length,
      viewer: document.querySelectorAll('[data-testid="accepted-figure-viewer"], [data-testid="accepted-figure-view-full-size"], dialog').length,
    }));
    expect(await privateContent()).toEqual({ workspace: 0, figures: 0, viewer: 0 });
    // Back, then Forward. Signing out on the private page makes its session gate leave by a
    // hard navigation that REPLACES the page's own history entry, so Back has no entry of the
    // draft to return to. Wherever each step ends, it is not the draft, and nothing of the
    // draft is in the document.
    const settled = async () => {
      let last = page.url();
      for (let stable = 0; stable < 8;) {
        await page.waitForTimeout(250);
        if (page.url() === last) stable += 1;
        else { last = page.url(); stable = 0; }
      }
      await page.waitForLoadState('domcontentloaded').catch(() => undefined);
      return { onTheDraft: page.url().includes(R5_PAPER_VERSION), ...(await privateContent()) };
    };
    await page.goBack({ waitUntil: 'commit' }).catch(() => undefined);
    expect(await settled()).toEqual({ onTheDraft: false, workspace: 0, figures: 0, viewer: 0 });
    await page.goForward({ waitUntil: 'commit' }).catch(() => undefined);
    expect(await settled()).toEqual({ onTheDraft: false, workspace: 0, figures: 0, viewer: 0 });
    // Asking for the draft's address again is answered by the sign-in page.
    await page.goto(`/matrix-options/paper/v/${R5_PAPER_VERSION}/sec-6-0`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/login/, { timeout: 120000 });
    expect(await privateContent()).toEqual({ workspace: 0, figures: 0, viewer: 0 });
    // And a signed-out browser is not given the figure by its route either.
    const asset = privateFigureContract.assets[0];
    const refused = await page.request.get(privateFigureHref(asset), { maxRedirects: 0 });
    expect(refused.status()).toBe(401);
    expect(refused.headers()['content-type'] ?? '').not.toContain('image/');
  });

  test('authenticated real release private draft My Review keeps responses separate: earlier answers are read-only reference, Q11 needs a new response, and a save carries only what was typed', async ({ page }, testInfo) => {
    requireJourney(testInfo.project.name);
    test.setTimeout(240000);
    await page.setViewportSize({ width: 1440, height: 900 });
    const earlier = 'E2E earlier answer to the previous draft.';
    const response = '[data-testid="active-question-response"]';
    const heading = '#active-question-heading';
    let userKey = '';
    const reads: Array<{ version: string | null; method: string }> = [];
    const writes: string[] = [];
    await page.route('**/api/matrix-options/paper/reviews?*', async (route) => {
      const url = new URL(route.request().url());
      const version = url.searchParams.get('documentVersion');
      const manifest = url.searchParams.get('manifestSha256') ?? '';
      reads.push({ version, method: route.request().method() });
      if (!userKey) {
        // The signed-in reviewer's own id, from the real (read-only) route.
        const real = await route.fetch();
        userKey = String(((await real.json().catch(() => ({}))) as { userKey?: unknown }).userKey ?? '');
        expect(/\S/.test(userKey)).toBe(true);
      }
      const earlierRow = (number: number, cohortId: string) => ({ id: `lineage-${number}`, document_version: realVersion, manifest_sha256: manifest, cohort_id: cohortId, question_id: `rpq:${realVersion}:q${String(number).padStart(2, '0')}`, draft_text: null, submitted_text: earlier, revision: 2, submitted_revision: 2, submitted_at: '2026-09-20T10:00:00.000Z', updated_at: '2026-09-20T10:00:00.000Z' });
      // The reviewer answered Q1 and Q11 of the previous draft; this draft has no responses yet.
      const rows = version === realVersion ? [earlierRow(1, 'categories'), earlierRow(11, 'methods-water-type')] : [];
      await route.fulfill({ status: 200, headers: { 'Cache-Control': 'no-store' }, contentType: 'application/json', body: JSON.stringify({ persistence: 'available', userKey, rows }) });
    });
    // Every save or submit is answered HERE and never reaches the server, so this journey writes
    // nothing to the review record. It is answered the way a record that has not been provisioned
    // for this draft answers: unknown_identity.
    const writeBodies: Array<Record<string, unknown>> = [];
    await page.route('**/api/matrix-options/paper/reviews/**', async (route) => {
      writes.push(`${route.request().method()} ${decodeURIComponent(new URL(route.request().url()).pathname)}`);
      writeBodies.push(JSON.parse(route.request().postData() ?? '{}') as Record<string, unknown>);
      await route.fulfill({ status: 404, contentType: 'application/json', headers: { 'Cache-Control': 'no-store' }, body: JSON.stringify({ outcome: 'unknown_identity' }) });
    });

    await page.goto(`${privateWorkspacePath}?mode=my-review`, { waitUntil: 'domcontentloaded' });
    failOnLogin(page.url());
    await expect(page.getByTestId('paper-version-status')).toContainText('Responses to this draft are separate from the earlier draft.');
    await expect(page.getByTestId('review-progress-count')).toHaveText('0 of 12 complete');

    // Q1: identical wording, so the earlier answer is shown for reference and the editor is empty.
    await openQuestion(page, 1);
    await expect.poll(() => shows(page, heading, /^Question 1: /), { timeout: 30000 }).toBe(true);
    const reference = page.getByTestId('review-lineage-reference');
    await expect(reference).toBeVisible({ timeout: 30000 });
    await reference.locator('summary').click();
    await expect(page.getByTestId('review-lineage-text')).toHaveText(earlier);
    await expect(page.getByRole('textbox', { name: 'Your response' })).toHaveValue('');
    await expect(page.getByTestId('review-lineage-changed')).toHaveCount(0);

    // Q11: reworded, so nothing is carried over although the reviewer answered the earlier Q11.
    await openQuestion(page, 11);
    await expect.poll(() => shows(page, heading, /^Question 11: \S/), { timeout: 30000 }).toBe(true);
    // Kept in this process to compare with the default draft's Q11 below; never printed.
    const privateQuestion11 = sha256Hex(await page.locator(heading).innerText());
    await expect(page.getByTestId('review-lineage-changed')).toBeVisible();
    await expect(page.getByTestId('review-lineage-reference')).toHaveCount(0);
    await expect(page.getByText(earlier)).toHaveCount(0);
    await expect(page.getByRole('textbox', { name: 'Your response' })).toHaveValue('');
    await expect(page.getByRole('button', { name: 'Submit response' })).toBeDisabled();

    // Reads only so far: each under its own draft identity, and no write of any kind from
    // merely viewing the earlier answer or the reworded question.
    expect(reads.every((read) => read.method === 'GET')).toBe(true);
    expect(new Set(reads.map((read) => read.version))).toEqual(new Set([R5_PAPER_VERSION, realVersion]));
    expect(writes).toEqual([]);

    // Now a real save attempt on Q1, whose earlier answer is on screen as reference. The save
    // carries ONLY what was typed, under this draft's identity: never the earlier answer.
    await openQuestion(page, 1);
    await expect(page.getByTestId('review-lineage-reference')).toBeVisible({ timeout: 30000 });
    const typed = 'E2E typed answer for the current review draft.';
    // Nothing is clicked: the save is sent by the autosave timer (1.5 s after typing stops), so
    // this test proves the timer is live here before it proves that it stops.
    await page.getByRole('textbox', { name: 'Your response' }).fill(typed);
    expect(writes).toHaveLength(0);
    await expect.poll(() => writes.length, { timeout: 30000 }).toBe(1);
    expect(writes[0]).toBe(`PUT /api/matrix-options/paper/reviews/rpq:${R5_PAPER_VERSION}:q01`);
    expect(writeBodies[0]).toMatchObject({ documentVersion: R5_PAPER_VERSION, cohortId: 'categories', action: 'save-draft', text: typed });
    expect(JSON.stringify(writeBodies[0]).includes(earlier)).toBe(false);
    expect(JSON.stringify(writeBodies[0]).includes(realVersion)).toBe(false);
    // A record that does not know this draft is said plainly, not as a retryable error, and the text stays.
    await expect.poll(() => shows(page, response, /Responses to this draft cannot be saved to the review record yet[.] What you type is kept in this browser only, and is cleared when you sign out[.]/), { timeout: 30000 }).toBe(true);
    expect(await shows(page, response, /Could not save/)).toBe(false);
    await expect(page.getByTestId('review-persistence-retry')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Save draft' })).toBeDisabled();
    await expect(page.getByRole('textbox', { name: 'Your response' })).toHaveValue(typed);
    // The earlier answer is still only a reference.
    await expect(page.getByTestId('review-lineage-text')).toHaveText(earlier);
    // No retry and no further autosave: the reviewer keeps typing after the refusal, twice the
    // autosave delay passes, and it is still exactly the one refused save. The text stays.
    const typedMore = `${typed} More, typed after the refusal.`;
    await page.getByRole('textbox', { name: 'Your response' }).fill(typedMore);
    await page.waitForTimeout(3000);
    expect(writes).toHaveLength(1);
    await expect(page.getByRole('textbox', { name: 'Your response' })).toHaveValue(typedMore);

    // The default draft is unchanged: its own questions (its Q11 is not this draft's reworded
    // one), no lineage note, no working-draft status.
    await page.goto(`${workspacePath}?mode=my-review`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('paper-version-status')).toHaveCount(0);
    await openQuestion(page, 11);
    await expect(page.locator(heading)).toHaveText(/^Question 11: On water type/);
    expect(sha256Hex(await page.locator(heading).innerText()) === privateQuestion11).toBe(false);
    await expect(page.getByTestId('review-lineage-changed')).toHaveCount(0);
    await expect(page.getByTestId('review-lineage-reference')).toHaveCount(0);
    // Viewing the default draft sent nothing either: still only the one intercepted save.
    expect(writes).toHaveLength(1);
  });

  test('authenticated real release private draft has no Appendix L: one notice, no Appendix L in the paper or its navigation, and old Appendix L addresses land on the notice', async ({ page }, testInfo) => {
    requireJourney(testInfo.project.name);
    test.setTimeout(420000);
    await page.setViewportSize({ width: 1440, height: 900 });
    /*
     * The release artifact ends before Appendix L, so there is no withheld text anywhere to look
     * for: the server holds none (the artifact is proven by length and hash where it is read).
     * What a browser can still show is structure, and that is what is asserted: the paper ends
     * with the artifact's last top-level section, nothing names Appendix L as a section or a
     * link, and every old address of it lands on the one notice.
     */
    const { presentation, headings } = readPrivateHeadings();
    const lastSectionAnchor = headings.filter((heading) => heading.level === 2).at(-1)?.anchor ?? '';
    expect(lastSectionAnchor.length).toBeGreaterThan(0);
    const notice = page.getByTestId('paper-withheld-notice');
    const paper = page.getByTestId('paper-document');
    const atNoticeLanding = () => pathAndQuery(page.url()) === privateStart && new URL(page.url()).hash === `#${PAPER_WITHHELD_NOTICE_ID}`;

    // 1. The old stable address of Appendix L lands on the notice of this draft's Working Draft.
    await page.goto(oldWithheldAddress, { waitUntil: 'domcontentloaded' });
    failOnLogin(page.url());
    await expect.poll(atNoticeLanding, { timeout: 60000 }).toBe(true);
    await waitForHydratedWorkspace(page);
    // One notice, in neither the paper nor the header, showing the sentence the release entry defines.
    await expect(notice).toHaveCount(1);
    await expect(notice).toBeVisible();
    await expect(notice.getByTestId('paper-withheld-notice-text')).toHaveText(noticeText);
    // It is editorial, and says so: the workspace's own label, then that one sentence.
    await expect(notice.getByTestId('paper-withheld-notice-label')).toHaveText('Workspace note');
    await expect(notice).toHaveText(`Workspace note${noticeText}`);
    expect(noticeText).toBe('Appendix L is under revision and is not included in this presentation.');
    await expect(notice).toHaveAttribute('id', PAPER_WITHHELD_NOTICE_ID);
    await expect(page.getByText(noticeText, { exact: true })).toHaveCount(1);
    await expect(paper.getByText(noticeText)).toHaveCount(0);
    await expect(page.getByTestId('workspace-header').getByText(noticeText)).toHaveCount(0);

    // 2. Navigation and section list: every appendix up to K, no Appendix L, 98 sections.
    const outline = page.getByTestId('paper-outline-desktop');
    await openOutlineGroup(page, 'Appendices');
    for (const letter of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'K']) {
      await expect(outline.getByRole('link', { name: new RegExp(`^Appendix ${letter}: `) }).first()).toBeVisible();
    }
    await expect(outline.getByRole('link', { name: /^Appendix L\b/ })).toHaveCount(0);
    await expect(page.getByTestId('paper-load-progress')).toContainText('of 98 sections', { timeout: 30000 });
    const sections = paper.locator('[data-paper-section], [data-paper-section-placeholder]');
    await expect(sections).toHaveCount(98);
    await expect(paper.getByRole('heading', { name: /^Appendix L\b/ })).toHaveCount(0);
    await expect(paper.getByRole('heading', { name: /^Appendix K: / }).first()).toBeAttached();

    // 2b. The paper's own contents list, opened so that it is on the page: its heading is shown
    //     as "Table of Contents"; the entry for Appendix K is a link (the control); there is NO
    //     entry for Appendix L, as a link or as text, and no link on the page names the withheld id.
    await page.goto(`${privateStart}&section=master-table-of-contents`, { waitUntil: 'domcontentloaded' });
    await waitForHydratedWorkspace(page);
    await expect(paper.getByRole('heading', { name: 'Table of Contents', exact: true }).first()).toBeVisible({ timeout: 60000 });
    const contentsEntry = (letter: string) => paper.locator('li').filter({ hasText: new RegExp(`^\\s*Appendix ${letter}: `) });
    /** Any list entry that opens with the appendix's designation, with or without a title after it. */
    const listEntryNaming = (letter: string) => paper.locator('li').filter({ hasText: new RegExp(`^\\s*Appendix ${letter}(?![A-Za-z0-9])`) });
    await expect(contentsEntry('K').first()).toBeVisible({ timeout: 60000 });
    // Checked only now, with the list itself rendered (a placeholder could not show an entry).
    await expect(paper.getByRole('heading', { name: 'Master Table of Contents', exact: true })).toHaveCount(0);
    expect(await contentsEntry('K').locator('a').count()).toBeGreaterThan(0);
    await expect(contentsEntry('L')).toHaveCount(0);
    await expect(listEntryNaming('L')).toHaveCount(0);
    await expect(paper.getByText(/Appendix L\s*:/)).toHaveCount(0);
    await expect(page.locator(`a[href*="${withheldStableSectionId}"]`)).toHaveCount(0);

    // 2c. The artifact names Appendix L in two list entries: the contents line above, and one
    //     line of a list of the appendices. The section that holds the second is opened so that
    //     the list is on the page: its entry for Appendix K is there (the control), and there is
    //     no entry for Appendix L. Only the section's address is taken from the artifact.
    const namingEntries = (letter: string) => Array.from(presentation.matchAll(new RegExp(`^[ \\t]*(?:[-*+]|[0-9]{1,9}[.)])[ \\t]+[\\[*_]*Appendix[ \\t]+${letter}(?![A-Za-z0-9])`, 'gim')), (match) => headings.filter((heading) => heading.level === 2 && heading.index < (match.index ?? 0)).at(-1)?.anchor ?? '');
    const sectionsNamingL = namingEntries('L');
    expect(sectionsNamingL.length).toBe(2);
    expect(sectionsNamingL.every((anchor) => anchor.length > 0)).toBe(true);
    expect(sectionsNamingL[0] === 'master-table-of-contents').toBe(true);
    // The control entry is in the same two sections (compared here, never printed).
    expect(JSON.stringify(namingEntries('K')) === JSON.stringify(sectionsNamingL)).toBe(true);
    await page.goto(`${privateStart}&section=${sectionsNamingL[1]}`, { waitUntil: 'domcontentloaded' });
    await waitForHydratedWorkspace(page);
    await expect.poll(() => paper.locator('[data-paper-section]').evaluateAll((nodes, anchor) => nodes.filter((node) => node.getAttribute('data-paper-section') === anchor).length, sectionsNamingL[1]), { timeout: 60000 }).toBe(1);
    await expect(listEntryNaming('K').first()).toBeVisible({ timeout: 60000 });
    await expect(listEntryNaming('L')).toHaveCount(0);
    await expect(paper.getByText(/Appendix L\s*:/)).toHaveCount(0);

    // 3. The paper ends with the artifact's last top-level section.
    await page.goto(`${privateStart}&section=${lastSectionAnchor}`, { waitUntil: 'domcontentloaded' });
    await expect.poll(() => pathAndQuery(page.url()) === `${privateStart}&section=${lastSectionAnchor}`, { timeout: 60000 }).toBe(true);
    await waitForHydratedWorkspace(page);
    await expect.poll(() => paper.locator('[data-paper-section]').evaluateAll((nodes, anchor) => nodes.filter((node) => node.getAttribute('data-paper-section') === anchor).length, lastSectionAnchor), { timeout: 60000 }).toBe(1);
    expect((await sections.last().getAttribute('data-paper-section')) === lastSectionAnchor).toBe(true);

    // 4. An address that names no section of this draft is dropped: the draft opens at its start.
    await page.goto(`${privateStart}&section=no-such-section-of-this-draft`, { waitUntil: 'domcontentloaded' });
    await expect.poll(() => pathAndQuery(page.url()), { timeout: 60000 }).toBe(privateStart);
    await waitForHydratedWorkspace(page);
    await expect(notice).toHaveCount(1);
    await expect(page.locator('h1')).toHaveCount(1);

    // 5. Back and Forward across the old Appendix L address, which redirects: Back returns to
    //    where the reader was, Forward to the notice the old address landed on.
    await page.goto(privateStart, { waitUntil: 'domcontentloaded' });
    await waitForHydratedWorkspace(page);
    await page.goto(oldWithheldAddress, { waitUntil: 'domcontentloaded' });
    await expect.poll(atNoticeLanding, { timeout: 60000 }).toBe(true);
    await waitForHydratedWorkspace(page);
    await page.goBack({ waitUntil: 'domcontentloaded' });
    await expect.poll(() => pathAndQuery(page.url()) === privateStart && new URL(page.url()).hash === '', { timeout: 60000 }).toBe(true);
    await waitForHydratedWorkspace(page);
    await expect(notice).toHaveCount(1);
    await page.goForward({ waitUntil: 'domcontentloaded' });
    await expect.poll(atNoticeLanding, { timeout: 60000 }).toBe(true);
    await waitForHydratedWorkspace(page);
    await expect(notice).toHaveCount(1);

    // 6. Print (Working Draft): the header and its status line go, the notice stays.
    await page.emulateMedia({ media: 'print' });
    await expect(page.getByTestId('workspace-header')).toHaveCSS('display', 'none');
    await expect(notice).toBeVisible();
    await expect(notice.getByTestId('paper-withheld-notice-text')).toHaveText(noticeText);
    await page.emulateMedia({ media: 'screen' });

    // 7. My Review: the same single notice on screen; hidden in print, where no paper text prints.
    await page.goto(`${privateWorkspacePath}?mode=my-review`, { waitUntil: 'domcontentloaded' });
    await waitForHydratedWorkspace(page);
    await expect(notice).toHaveCount(1);
    await expect(notice).toBeVisible();
    await expect(notice.getByTestId('paper-withheld-notice-text')).toHaveText(noticeText);
    await page.emulateMedia({ media: 'print' });
    await expect(notice).toHaveCSS('display', 'none');
    await page.emulateMedia({ media: 'screen' });

    // 8. The default draft is unchanged: no notice, and its own Appendix L still opens.
    await page.goto(`/matrix-options/paper/v/${realVersion}/${withheldStableSectionId}`, { waitUntil: 'domcontentloaded' });
    await expect.poll(() => pathAndQuery(page.url()), { timeout: 60000 }).toMatch(new RegExp(`^${workspacePath.replace(/[.]/g, '[.]')}[?]mode=working-draft&section=appendix-l`));
    await waitForHydratedWorkspace(page);
    await expect(notice).toHaveCount(0);
    await expect(page.getByTestId('paper-document').getByRole('heading', { name: /^Appendix L: / }).first()).toBeVisible({ timeout: 60000 });

    // 9. Switching drafts from there carries the stable id of the section being read, and
    //    this draft lands it on the notice.
    await page.getByTestId('paper-version-toggle').click();
    const currentDraft = page.getByTestId(`paper-version-option-${R5_PAPER_VERSION}`);
    await expect(currentDraft).toBeVisible();
    await expect.poll(() => currentDraft.getAttribute('href'), { timeout: 30000 }).toBe(oldWithheldAddress);
    await currentDraft.click();
    await expect.poll(atNoticeLanding, { timeout: 60000 }).toBe(true);
    await waitForHydratedWorkspace(page);
    await expect(notice).toHaveCount(1);
    await expect(notice.getByTestId('paper-withheld-notice-text')).toHaveText(noticeText);
    await expect.poll(() => page.evaluate(() => document.activeElement?.id ?? ''), { timeout: 30000 }).toBe(PAPER_WITHHELD_NOTICE_ID);
  });

  /*
   * The landing on the withheld notice, measured in a real layout engine.
   *
   * One reading: where the notice and the sticky layout header are, what has focus, and what
   * is painted at the notice's centre. It is taken only from a SETTLED layout: the workspace
   * has hydrated, the layout header's own navigation has mounted, and the notice and header
   * rectangles have been identical for more consecutive animation frames than the scroll
   * authority's bounded landing corrections can span (PAPER_LANDING_MAX_ATTEMPTS checks, two
   * frames apart). A layout that never settles is reported as such and fails.
   */
  interface NoticeLanding {
    readonly settled: boolean;
    readonly frames: number;
    readonly headerBottom: number;
    readonly noticeTop: number;
    readonly noticeBottom: number;
    readonly noticeLeft: number;
    readonly noticeRight: number;
    readonly viewportWidth: number;
    readonly viewportHeight: number;
    readonly scrollY: number;
    readonly activeElementId: string;
    readonly centreIsNotice: boolean;
    readonly hash: string;
  }
  const NOTICE_SETTLE_FRAMES = 2 * PAPER_LANDING_MAX_ATTEMPTS + 2;
  const measureNoticeLanding = async (page: Page): Promise<NoticeLanding> => {
    await page.waitForFunction(() => document.querySelector('[data-testid="workspace-shell"]')?.getAttribute('data-hydrated') === 'true'
      && document.querySelector('[data-testid="workspace-header-controls"]') !== null
      && document.querySelector('[data-testid="paper-layout-header"] [role="tablist"][data-primary-tablist-ready="true"]') !== null, null, { timeout: 180000 });
    return page.evaluate(({ noticeId, stableId, settleFrames }) => new Promise<NoticeLanding>((resolve) => {
      const read = () => {
        const notice = document.getElementById(noticeId);
        const header = document.querySelector('[data-testid="paper-layout-header"]');
        if (!notice || !header) return null;
        const rect = notice.getBoundingClientRect();
        return { headerBottom: header.getBoundingClientRect().bottom, noticeTop: rect.top, noticeBottom: rect.bottom, noticeLeft: rect.left, noticeRight: rect.right };
      };
      let previous = '';
      let stable = 0;
      let frames = 0;
      const step = () => {
        const current = read();
        const key = JSON.stringify(current);
        stable = current !== null && key === previous ? stable + 1 : 0;
        previous = key;
        frames += 1;
        const settled = current !== null && stable >= settleFrames;
        if (!settled && frames < 600) {
          requestAnimationFrame(step);
          return;
        }
        const notice = document.getElementById(noticeId);
        const box = current ?? { headerBottom: 0, noticeTop: 0, noticeBottom: 0, noticeLeft: 0, noticeRight: 0 };
        const centre = document.elementFromPoint((box.noticeLeft + box.noticeRight) / 2, (box.noticeTop + box.noticeBottom) / 2);
        const focused = document.activeElement;
        const fragment = window.location.hash;
        resolve({
          settled,
          frames,
          ...box,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          scrollY: window.scrollY,
          // Any other id or fragment is a section anchor, which is made from a heading: it stays in the page.
          activeElementId: focused === notice && notice !== null ? noticeId : focused === null || focused === document.body ? '' : 'other',
          centreIsNotice: notice !== null && centre !== null && notice.contains(centre),
          hash: fragment === '' || fragment === `#${noticeId}` || fragment === `#${stableId}` ? fragment : '#other',
        });
      };
      requestAnimationFrame(step);
    }), { noticeId: PAPER_WITHHELD_NOTICE_ID, stableId: withheldStableSectionId, settleFrames: NOTICE_SETTLE_FRAMES });
  };
  /** Numbers and ids only: one line per reading, and the same record attached to the test. */
  const recordNoticeLanding = async (testInfo: TestInfo, record: Record<string, unknown>) => {
    const line = JSON.stringify(record);
    console.log(`[notice-landing] ${line}`);
    await testInfo.attach('notice-landing', { body: line, contentType: 'application/json' });
  };
  /** The notice has focus, is wholly inside the viewport, starts at or below the sticky header, and is what is painted at its centre. */
  const expectLandedOnNotice = (landing: NoticeLanding, step: string) => {
    expect.soft(landing.settled, `${step}: layout settled`).toBe(true);
    expect.soft(landing.activeElementId, `${step}: focused element`).toBe(PAPER_WITHHELD_NOTICE_ID);
    expect.soft(landing.headerBottom, `${step}: sticky header bottom`).toBeGreaterThan(0);
    expect.soft(landing.noticeBottom - landing.noticeTop, `${step}: notice height`).toBeGreaterThan(0);
    expect.soft(landing.noticeTop, `${step}: notice top against the sticky header bottom`).toBeGreaterThanOrEqual(landing.headerBottom);
    expect.soft(landing.noticeBottom, `${step}: notice bottom against the viewport height`).toBeLessThanOrEqual(landing.viewportHeight);
    expect.soft(landing.noticeLeft, `${step}: notice left edge`).toBeGreaterThanOrEqual(0);
    expect.soft(landing.noticeRight, `${step}: notice right edge against the viewport width`).toBeLessThanOrEqual(landing.viewportWidth);
    expect.soft(landing.centreIsNotice, `${step}: the notice is what is painted at its centre`).toBe(true);
  };

  for (const viewport of [{ width: 360, height: 800 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 1440, height: 900 }]) {
    const size = `${viewport.width}x${viewport.height}`;
    test(`authenticated real release private draft lands every address of the withheld appendix on the notice, below the sticky header, at ${size}`, async ({ page }, testInfo) => {
      requireJourney(testInfo.project.name);
      test.setTimeout(480000);
      await page.setViewportSize(viewport);
      const land = async (step: string, mode: string, extra: Record<string, unknown> = {}) => {
        const landing = await measureNoticeLanding(page);
        await recordNoticeLanding(testInfo, { viewport: size, step, mode, ...extra, ...landing });
        expectLandedOnNotice(landing, `${size} ${step}`);
        return landing;
      };

      // (a) The first response to the old address, redirects not followed, names the notice
      //     as where to go. A loading boundary sits above every paper page, so a redirect
      //     decided inside a page can be answered as an HTTP redirect (Location) or, once the
      //     response has started, as 200 with the framework's redirect <meta>. Either form is
      //     read; which one was served is recorded with the status and the Location.
      const first = await page.request.get(oldWithheldAddress, { maxRedirects: 0 });
      const redirectStatus = first.status();
      const redirectLocation = (first.headers()['location'] ?? '').replace(/^https?:\/\/[^/]+/, '');
      const redirectMeta = redirectStatus === 200 ? (/<meta[^>]*id="__next-page-redirect"[^>]*>/.exec(await first.text())?.[0] ?? '') : '';
      const metaTarget = (/content="[0-9]+;url=([^"]*)"/.exec(redirectMeta)?.[1] ?? '').replace(/&amp;/g, '&');
      const redirect = {
        redirectStatus,
        redirectLocation,
        redirectForm: [307, 308].includes(redirectStatus) ? 'http' : metaTarget ? 'meta-refresh' : 'none',
        redirectTarget: [307, 308].includes(redirectStatus) ? redirectLocation : metaTarget,
      };
      await recordNoticeLanding(testInfo, { viewport: size, step: 'redirect', ...redirect });
      expect.soft(redirect.redirectForm, `${size} redirect: the first response redirects`).not.toBe('none');
      expect.soft(redirect.redirectTarget, `${size} redirect: target`).toBe(noticeLandingAddress);

      // (b) Following the old address lands on the notice.
      await page.goto(oldWithheldAddress, { waitUntil: 'domcontentloaded' });
      failOnLogin(page.url());
      await expect.poll(() => pathAndQuery(page.url()), { timeout: 60000 }).toBe(privateStart);
      expect.soft((await land('old-address', 'working-draft', redirect)).hash, `${size} old-address: fragment`).toBe(`#${PAPER_WITHHELD_NOTICE_ID}`);

      // (c) The same after a reload.
      await page.reload({ waitUntil: 'domcontentloaded' });
      await land('reload', 'working-draft');

      // (d) An outline entry opens its section; Back returns to the notice; Forward returns to that section.
      const outline = page.getByTestId(viewport.width >= 1024 ? 'paper-outline-desktop' : 'paper-outline-stacked');
      const mainReport = outline.getByRole('button', { name: 'Main Report', exact: true });
      await expect(mainReport).toBeVisible({ timeout: 30000 });
      if ((await mainReport.getAttribute('aria-expanded')) !== 'true') await mainReport.click();
      await expect(mainReport).toHaveAttribute('aria-expanded', 'true');
      const entry = outline.getByRole('link').nth(2);
      const anchor = sectionOf(await entry.getAttribute('href'));
      expect(anchor.length).toBeGreaterThan(0);
      await entry.click();
      const atSection = () => page.evaluate((id) => new URLSearchParams(window.location.search).get('section') === id && document.activeElement?.id === id, anchor);
      await expect.poll(atSection, { timeout: 60000 }).toBe(true);
      await page.goBack();
      await expect.poll(() => new URL(page.url()).searchParams.get('section') === null, { timeout: 30000 }).toBe(true);
      await land('back', 'working-draft');
      await page.goForward();
      // Forward restores the section: it is addressed again and back in view. A restore from
      // history moves the paper, not the focus (the workspace's rule for Back and Forward), so
      // what has focus is recorded and not asserted.
      const sectionRestored = () => page.evaluate(({ id, noticeId }) => {
        const section = document.getElementById(id);
        const sectionTop = section ? section.getBoundingClientRect().top : Number.NaN;
        const headerBottom = document.querySelector('[data-testid="paper-layout-header"]')?.getBoundingClientRect().bottom ?? 0;
        const focused = document.activeElement;
        return {
          addressed: new URLSearchParams(window.location.search).get('section') === id,
          // The same 2px allowance the section landings of the default draft use.
          inView: Number.isFinite(sectionTop) && sectionTop >= headerBottom - 2 && sectionTop < window.innerHeight,
          sectionTop: Number.isFinite(sectionTop) ? sectionTop : null,
          headerBottom,
          viewportHeight: window.innerHeight,
          scrollY: window.scrollY,
          focus: focused !== null && focused === section ? 'section' : focused?.id === noticeId ? noticeId : focused === null || focused === document.body ? '' : 'other',
        };
      }, { id: anchor, noticeId: PAPER_WITHHELD_NOTICE_ID });
      await expect.poll(async () => {
        const state = await sectionRestored();
        return state.addressed && state.inView;
      }, { timeout: 60000 }).toBe(true).catch(() => undefined);
      const forward = await sectionRestored();
      await recordNoticeLanding(testInfo, { viewport: size, step: 'forward', mode: 'working-draft', ...forward });
      expect.soft(forward.addressed, `${size} forward: the section is addressed again`).toBe(true);
      expect.soft(forward.inView, `${size} forward: the section is in view below the sticky header`).toBe(true);
      //     Still at that section, away from the notice: a fragment change to the withheld
      //     section's stable id (what following an in-page link to it does) lands on the notice.
      await page.evaluate((id) => {
        window.location.hash = id;
      }, withheldStableSectionId);
      await land('hashchange-stable-id', 'working-draft');

      // (e) The withheld section's own stable id as the fragment is the same landing.
      await page.goto(`${privateStart}#${withheldStableSectionId}`, { waitUntil: 'domcontentloaded' });
      await land('fragment-stable-id', 'working-draft');

      // (f) Both modes: My Review, by either fragment.
      await page.goto(`${privateWorkspacePath}?mode=my-review#${PAPER_WITHHELD_NOTICE_ID}`, { waitUntil: 'domcontentloaded' });
      await land('fragment-notice-id', 'my-review');
      // Between two My Review addresses that differ only in their fragment a navigation would
      // stay in the document, so the Working Draft is opened in between: a full load each time.
      await page.goto(privateStart, { waitUntil: 'domcontentloaded' });
      await page.goto(`${privateWorkspacePath}?mode=my-review#${withheldStableSectionId}`, { waitUntil: 'domcontentloaded' });
      await land('fragment-stable-id', 'my-review');
      // Not asserted: a fragment on an address the server first has to make canonical (no mode,
      // a retired mode). The canonicalising redirect of every paper page drops it, and no old
      // link to the withheld appendix has that form.
    });
  }
});

test.describe('Matrix Options Paper v0.9.91 Appendix L inclusion', () => {
  test.skip(!V0991_APPENDIX_L_JOURNEY, 'The private v0.9.91 source fixture is required and is never requested in a public or fixture-free run.');
  test.skip(!reviewNavigationEnabled, 'The standard E2E harness supplies both exact-true paper flags for this journey.');
  test.beforeEach(({ page, trace, screenshot, video }, testInfo) => {
    if (trace !== 'off' || screenshot !== 'off' || video !== 'off') throw new Error(PRIVATE_RECORDING_MESSAGE);
    holdNavigationsUntilHydrated(page, testInfo);
  });

  test('authenticated section navigation renders the source image through its hash-bound route', async ({ page }, testInfo) => {
    requireJourney(testInfo.project.name);
    const media = appendixLSourceMediaContract();
    const canonicalPath = `/matrix-options/paper/publication/v/${V0991_PAPER_VERSION}`;
    const imageResponsePromise = page.waitForResponse((response) => response.url().includes(`/figures/${encodeURIComponent(media.file)}?sha256=${media.sha256}`), { timeout: 60000 });
    await page.goto(`${canonicalPath}?mode=working-draft`, { waitUntil: 'domcontentloaded' });
    failOnLogin(page.url());
    await waitForHydratedWorkspace(page);
    await openOutlineGroup(page, 'Appendices');
    const appendixLLink = page.getByTestId('paper-outline-desktop').getByRole('link', { name: 'Appendix L: Phase 2 Project Plan V2', exact: true });
    await expect(appendixLLink).toBeVisible({ timeout: 60000 });
    expect(await appendixLLink.getAttribute('href')).toBe('?mode=working-draft&section=app-l');
    await appendixLLink.click();
    await expect.poll(() => pathAndQuery(page.url()), { timeout: 60000 }).toContain(`${canonicalPath}?mode=working-draft&section=app-l`);
    await waitForHydratedWorkspace(page);

    const paper = page.getByTestId('paper-document');
    await expect(paper.getByRole('heading', { name: 'Appendix L: Phase 2 Project Plan V2', exact: true })).toBeVisible({ timeout: 60000 });
    const image = paper.locator('[data-appendix-source-media] img');
    await expect(image).toBeVisible({ timeout: 60000 });
    const src = await image.getAttribute('src');
    expect(src).toContain(`/figures/${encodeURIComponent(media.file)}?sha256=${media.sha256}`);
    expect(await image.getAttribute('alt')).not.toBeNull();
    expect(sha256Hex(await image.getAttribute('alt') ?? '')).toBe(sha256Hex(media.alt));
    await expect(image).toHaveAttribute('width', String(media.width));
    await expect(image).toHaveAttribute('height', String(media.height));
    expect(await image.evaluate((element) => (element as HTMLImageElement).style.width)).toBe(media.widthAttribute);
    await expect.poll(() => image.evaluate((element) => {
      const rendered = element as HTMLImageElement;
      return rendered.complete && rendered.naturalWidth === 1875 && rendered.naturalHeight === 913;
    }), { timeout: 60000 }).toBe(true);

    const response = await imageResponsePromise;
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('image/png');
    expect(response.headers().etag).toBe(`"${media.sha256}"`);
    expect(sha256Hex(await response.body())).toBe(media.sha256);
  });

});
