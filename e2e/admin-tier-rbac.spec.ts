import { test, expect } from '@playwright/test';

// Skip-safe gate mirrors runAdminE2E in playwright.config.ts (hasAdminCreds && authEnabled):
// admin secrets ALONE must not activate this spec in the base projects -- E2E_AUTH_ENABLED=true
// must also be set, matching the member-tier gate (codex 2026-07-14).
test.skip(
  !process.env.E2E_ADMIN_EMAIL ||
    !process.env.E2E_ADMIN_PASSWORD ||
    process.env.E2E_AUTH_ENABLED !== 'true',
  'admin-tier E2E requires E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD + E2E_AUTH_ENABLED=true (skip-safe)',
);

test.describe('Admin-tier RBAC', () => {
  test('authenticated admins can access admin-only pages', async ({ page }, testInfo) => {
    await page.goto('/admin/matrix-review');

    // Bounce handling depends on the project (codex 2026-07-14 holistic):
    // - In the base chromium/firefox/webkit projects there is no admin storageState, so a /login
    //   bounce is expected -> skip (mirror how member specs tolerate the unauth bounce).
    // - In chromium-admin-auth the admin storageState SHOULD authenticate; a /login bounce there
    //   means the admin fixture is missing/invalid, so FAIL loudly -- CI must not go green without
    //   actually exercising the admin tier.
    if (page.url().includes('/login')) {
      if (testInfo.project.name === 'chromium-admin-auth') {
        throw new Error(
          'admin-tier fixture broken: /admin/matrix-review redirected to /login in the ' +
            'chromium-admin-auth project (admin storageState missing or invalid).',
        );
      }
      test.skip();
      return;
    }

    // READ-ONLY positive admin coverage; NEVER perform a publish/write here (that would be a live DB write).
    // Positive RBAC: the admin session was NOT bounced to /login or /dashboard.
    await expect(page).toHaveURL(/\/admin\/matrix-review/);
    // Admin-only content actually rendered (a heading is present, not an empty/redirected shell).
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });
});
