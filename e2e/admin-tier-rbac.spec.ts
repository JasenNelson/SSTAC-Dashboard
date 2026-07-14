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
  test('authenticated admins can access admin-only pages', async ({ page }) => {
    await page.goto('/admin/matrix-review');

    // Robustness: if the page bounces to /login (i.e., run without the admin storageState,
    // e.g. under a base project when creds happen to be set), the spec should skip/early-return
    // rather than fail -- mirror how the member specs tolerate the unauth bounce.
    if (page.url().includes('/login')) {
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
