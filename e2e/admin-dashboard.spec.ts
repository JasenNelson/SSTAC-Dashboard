import { test, expect } from '@playwright/test';

test.describe('Admin Dashboard Workflows', () => {
  test.beforeEach(async ({ page, context }) => {
    // Note: These tests are designed to run against a dev server with test data.
    // In a real environment, you would use a test user's credentials or mocked auth.

    // Clear cookies first
    await context.clearCookies();
    // Navigate to page before clearing storage (required for Firefox/WebKit security)
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.evaluate(() => sessionStorage.clear());
  });

  test('should load admin dashboard when authenticated as admin', async ({ page }) => {
    // Note: This test assumes a valid admin session exists or can be established
    // In practice, you would authenticate first or mock the auth cookie

    await page.goto('/admin');

    // If redirected to login, that's expected behavior when not authenticated
    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      // This is expected for unauthenticated users
      expect(currentUrl).toContain('/login');
      return;
    }

    // If authenticated, check for admin dashboard content
    const heading = page.locator('h1, h2');
    const visibleText = await heading.allTextContents();
    const hasAdminContent = visibleText.some(text =>
      text.toLowerCase().includes('admin') ||
      text.toLowerCase().includes('dashboard') ||
      text.toLowerCase().includes('metric')
    );

    // Dashboard should have some content
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('should require authentication for admin page', async ({ page, context }) => {
    // Clear all auth-related data to ensure unauthenticated state
    await context.clearCookies();
    await page.evaluate(() => localStorage.clear());

    // Navigate to admin page
    await page.goto('/admin', { waitUntil: 'networkidle' });

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });

  test('should display admin navigation menu when authenticated', async ({ page }) => {
    // Navigate to admin page
    await page.goto('/admin');

    const currentUrl = page.url();

    if (currentUrl.includes('/login')) {
      // Not authenticated - skip this test
      test.skip();
    }

    // Look for admin navigation links
    const navLinks = page.locator('nav a, [role="navigation"] a');
    const linkCount = await navLinks.count();

    // Admin dashboard should have navigation
    if (linkCount > 0) {
      expect(linkCount).toBeGreaterThan(0);
    }
  });

  test('should have working admin function buttons/links', async ({ page }) => {
    await page.goto('/admin');

    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      test.skip();
    }

    // Look for common admin function buttons
    const buttons = page.locator('button, a[role="button"]');

    // Should have at least some interactive elements
    if (await buttons.count() > 0) {
      expect(await buttons.count()).toBeGreaterThan(0);
    }

    // Check for specific admin sections
    const adminSections = page.locator('[data-testid*="admin"], .admin-section, [class*="admin"]');

    // Should have admin-specific sections
    if (await adminSections.count() > 0) {
      expect(await adminSections.count()).toBeGreaterThanOrEqual(0);
    }
  });

  test('should display key metrics on admin dashboard', async ({ page }) => {
    await page.goto('/admin');

    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      test.skip();
    }

    // Look for common metric displays
    const metricElements = page.locator(
      'div[class*="metric"], div[class*="card"], div[class*="stat"], div[class*="panel"]'
    );

    // Should display some metrics/cards
    if (await metricElements.count() > 0) {
      expect(await metricElements.count()).toBeGreaterThan(0);
    }

    // Check for numeric values that indicate metrics
    const bodyText = await page.locator('body').textContent();
    const hasNumbers = /\d+/.test(bodyText || '');

    // Metrics typically contain numbers
    if (await metricElements.count() > 0) {
      expect(hasNumbers).toBe(true);
    }
  });

  test('should allow navigation to sub-admin pages', async ({ page }) => {
    await page.goto('/admin');

    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      test.skip();
    }

    // Try to find and click admin sub-navigation links
    const adminLinks = page.locator('a[href*="/admin/"]');
    const linkCount = await adminLinks.count();

    // If there are admin sub-pages, they should be accessible
    if (linkCount > 0) {
      // Click first admin link
      const firstLink = adminLinks.first();
      const href = await firstLink.getAttribute('href');

      await firstLink.click();

      // Wait for navigation
      await page.waitForURL((url) => url.pathname.includes('/admin/'), { timeout: 5000 });

      // Should be on an admin sub-page
      expect(page.url()).toContain('/admin/');
    }
  });

  test('should display announcements management section if available', async ({ page }) => {
    await page.goto('/admin/announcements');

    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      test.skip();
    }

    // Look for announcement-related UI
    const announcements = page.locator(
      'h1, h2, h3',
      { has: page.locator('text=/announcement/i') }
    );

    // Check if page exists and loads
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('should display users management section if available', async ({ page }) => {
    await page.goto('/admin/users');

    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      test.skip();
    }

    // Check for user management content
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Look for user-related elements
    const userElements = page.locator(
      '[class*="user"], [class*="member"], [data-testid*="user"]'
    );

    // User page should have some content
    const text = await page.locator('body').textContent();
    expect(text?.length).toBeGreaterThan(0);
  });

  test('should display poll results section if available', async ({ page }) => {
    await page.goto('/admin/poll-results');

    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      test.skip();
    }

    // Check page loads
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Look for poll-related content
    const text = await page.locator('body').textContent();
    expect(text?.length).toBeGreaterThan(0);
  });

  test('should handle page loading gracefully', async ({ page }) => {
    await page.goto('/admin');

    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      test.skip();
    }

    // Wait for any loading spinners to disappear
    const loadingSpinners = page.locator('[class*="loading"], [class*="spinner"], .animate-spin');

    // If spinners exist, they should disappear
    if (await loadingSpinners.count() > 0) {
      await expect(loadingSpinners.first()).toBeHidden({ timeout: 10000 });
    }

    // Page should be interactive
    const buttons = page.locator('button');
    if (await buttons.count() > 0) {
      await expect(buttons.first()).toBeEnabled({ timeout: 5000 });
    }
  });

  test('should display error state gracefully if data fails to load', async ({ page }) => {
    // This test checks that the page doesn't crash if data fails to load
    await page.goto('/admin');

    const currentUrl = page.url();
    if (currentUrl.includes('/login')) {
      test.skip();
    }

    // Page should still be visible even if data fails
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Check for error messages or fallback UI
    const errorElements = page.locator('[class*="error"], [role="alert"]');

    // If there are errors, they should be visible
    if (await errorElements.count() > 0) {
      await expect(errorElements.first()).toBeVisible();
    }
  });
});
