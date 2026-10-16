import { expect, test } from '@playwright/test';

// READ-ONLY production smoke for the Matrix Options copy audit. Opt-in: it self-skips unless
// PROD_SMOKE_EXPECTED_SHA is set (only the prod smoke config / containment wrapper sets it).
// It navigates and asserts only: no typing, no form submits, no export or apply clicks.
// It never logs hrefs or any page values.
test.use({ trace: 'off', screenshot: 'off', video: 'off' });
test.describe.configure({ mode: 'serial', retries: 0 });
test.skip(!process.env.PROD_SMOKE_EXPECTED_SHA, 'opt-in production smoke');

const PRIMARY_TABS = [
  'Modernizing Schedule 3.4',
  'Guide',
  'Options Paper',
  'Database',
  'Calculator',
  'SSD Workbench',
  'Catalogue',
];

test.beforeEach(({ trace, screenshot, video }, testInfo) => {
  if (trace !== 'off' || screenshot !== 'off' || video !== 'off' || testInfo.retry !== 0) {
    throw new Error('prod smoke must not record or retry');
  }
});

test.beforeAll(async ({}, testInfo) => {
  const origin = testInfo.project.use.baseURL;
  if (!origin) throw new Error('prod smoke: no base URL configured');
  const res = await fetch(`${origin}/api/health`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status !== 200) throw new Error(`prod smoke: /api/health returned ${res.status}`);
  const body = (await res.json()) as { sha?: unknown; env?: unknown };
  if (body.sha !== process.env.PROD_SMOKE_EXPECTED_SHA) {
    throw new Error('prod smoke: deployed sha does not match the expected sha');
  }
  if (body.env !== 'production') throw new Error('prod smoke: deployment env is not production');
});

test.describe('Matrix Options copy consistency (member)', () => {
  test('@member primary tabs are in order and the Guide names Options Paper only', async ({ page }) => {
    await page.goto('/matrix-options', { waitUntil: 'domcontentloaded' });
    const tablist = page.getByRole('tablist', { name: 'Matrix Options' });
    await expect(tablist).toBeVisible();
    await expect(tablist.getByRole('tab')).toHaveText(PRIMARY_TABS);

    await tablist.getByRole('tab', { name: 'Guide', exact: true }).click();
    const panel = page.getByRole('tabpanel').filter({ visible: true }).first();
    await expect(panel).toContainText('Options Paper');
    await expect(panel).not.toContainText('TWG Review');
  });

  test('@member Database tab shows the private-DRA banner controls when the banner renders', async ({ page }) => {
    await page.goto('/matrix-options', { waitUntil: 'domcontentloaded' });
    const tablist = page.getByRole('tablist', { name: 'Matrix Options' });
    await tablist.getByRole('tab', { name: 'Database', exact: true }).click();

    const banner = page.getByTestId('matrix-map-partial-visibility-banner');
    // Give the banner a bounded chance to render; absence is a legitimate state.
    const rendered = await banner.waitFor({ state: 'visible', timeout: 15_000 }).then(
      () => true,
      () => false,
    );
    test.info().annotations.push({ type: 'banner-rendered', description: String(rendered) });
    if (!rendered) return;

    await expect(banner.getByRole('button', { name: 'Refresh Database samples' })).toBeVisible();
    if (process.env.PROD_SMOKE_CONTACT_CONFIGURED === 'true') {
      const contact = banner.getByRole('link', { name: 'Contact admin' });
      await expect(contact).toBeVisible();
      // Boolean only: a failure must never print the configured address.
      const hrefIsMailto = ((await contact.getAttribute('href')) ?? '').startsWith('mailto:');
      expect(hrefIsMailto, 'Contact admin link is a mailto link').toBe(true);
    }
  });
});

test.describe('Admin copy consistency (admin)', () => {
  test('@admin /admin has no System Status or Recent Activity and links Options Paper Reviews', async ({ page }) => {
    await page.goto('/admin', { waitUntil: 'domcontentloaded' });
    const link = page.getByRole('link', { name: /Options Paper Reviews/ }).first();
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', '/admin/matrix-options-paper-reviews');
    const body = page.locator('body');
    await expect(body).not.toContainText('System Status');
    await expect(body).not.toContainText('Recent Activity');
  });

  test('@admin Options Paper Reviews page heading and nav state', async ({ page }) => {
    await page.goto('/admin/matrix-options-paper-reviews', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1, name: 'Options Paper Reviews' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Admin Quick Links' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Options Paper Reviews', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('@admin Database health page heading', async ({ page }) => {
    await page.goto('/admin/matrix-map/health', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Database -- Health');
  });
});
