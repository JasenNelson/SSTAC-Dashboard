import { test, expect } from '@playwright/test';

// Skip-safe gate, identical in shape to admin-tier-rbac.spec.ts: admin secrets ALONE must not
// activate this spec in the base projects -- E2E_AUTH_ENABLED=true must also be set. When the
// admin fixture IS configured (chromium-admin-auth), the spec runs for real and fails loudly if
// the fixture is broken, so CI cannot go green without exercising the admin tier.
test.skip(
  !process.env.E2E_ADMIN_EMAIL ||
    !process.env.E2E_ADMIN_PASSWORD ||
    process.env.E2E_AUTH_ENABLED !== 'true',
  'admin-tier E2E requires E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD + E2E_AUTH_ENABLED=true (skip-safe)',
);

const SITE_AGG_PATH = '/admin/matrix-map/site-aggregates';

test.describe('Option C site-aggregates admin preview (read-only)', () => {
  test('authenticated admins can open the site-aggregates preview', async ({ page }, testInfo) => {
    await page.goto(SITE_AGG_PATH);

    // Bounce handling mirrors admin-tier-rbac.spec.ts:
    // - base chromium/firefox/webkit have no admin storageState, so a /login bounce is expected -> skip.
    // - chromium-admin-auth SHOULD authenticate; a bounce there means the fixture is broken -> FAIL.
    if (page.url().includes('/login') || page.url().includes('/dashboard')) {
      if (testInfo.project.name === 'chromium-admin-auth') {
        throw new Error(
          `admin-tier fixture broken: ${SITE_AGG_PATH} redirected to ${page.url()} in the ` +
            'chromium-admin-auth project (admin storageState missing or invalid).',
        );
      }
      test.skip();
      return;
    }

    // Positive RBAC: the admin session was NOT bounced.
    await expect(page).toHaveURL(new RegExp(SITE_AGG_PATH.replace(/\//g, '\\/')));

    // The page rendered its heading, not an empty/redirected shell.
    await expect(page.getByRole('heading', { name: /Site Aggregate Preview/i })).toBeVisible();

    // The summary panel is present (proves the aggregate computation ran, not just an auth shell).
    await expect(page.getByText(/Aggregate sites/i).first()).toBeVisible();

    // The read-only guarantee is stated to the admin in the UI.
    await expect(page.getByText(/Nothing here is published/i)).toBeVisible();
  });

  test('the preview exposes no publish or write control', async ({ page }, testInfo) => {
    await page.goto(SITE_AGG_PATH);

    if (page.url().includes('/login') || page.url().includes('/dashboard')) {
      if (testInfo.project.name === 'chromium-admin-auth') {
        throw new Error(
          `admin-tier fixture broken: ${SITE_AGG_PATH} redirected to ${page.url()} in the ` +
            'chromium-admin-auth project.',
        );
      }
      test.skip();
      return;
    }

    // This is a read-only preview. It must not offer a publish/flip affordance -- that lives on the
    // separate, deliberately-gated publish page. A button here would contradict the design.
    await expect(page.getByRole('button', { name: /publish|flip|make public/i })).toHaveCount(0);
  });
});
