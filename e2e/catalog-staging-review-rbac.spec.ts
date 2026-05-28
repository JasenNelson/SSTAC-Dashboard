import { test, expect } from '@playwright/test';

test.describe('Catalog Staging Review RBAC', () => {
  test('unauthenticated users are redirected from /admin/catalog-staging-review', async ({ page }) => {
    await page.goto('/admin/catalog-staging-review');

    // The server component `page.tsx` redirects to /login when there is no
    // authenticated user; Playwright follows the redirect automatically.
    await expect(page).toHaveURL(/.*\/login.*/);
  });

  test.skip('authenticated users without admin or matrix_admin role are redirected to /dashboard', async ({ page }) => {
    // Requires a pre-authenticated non-admin fixture; mirrors the skipped
    // test in e2e/matrix-admin-rbac.spec.ts.
  });
});
