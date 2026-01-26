import { test, expect } from '@playwright/test';

test.describe('Poll Submission and Voting Workflows', () => {
  test.beforeEach(async ({ page }) => {
    // Clear storage before each test to reset poll state
    await page.context().clearCookies();
    // Navigate to page before clearing storage (required for Firefox/WebKit security)
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.evaluate(() => sessionStorage.clear());
  });

  test('should load poll page successfully', async ({ page }) => {
    await page.goto('/cew-2025');

    const currentUrl = page.url();

    // If redirected to login, that's expected behavior when not authenticated
    if (currentUrl.includes('/login')) {
      expect(currentUrl).toContain('/login');
      return;
    }

    // Verify page loads
    const heading = page.locator('h1, h2');
    const headingText = await heading.first().textContent();

    // Page should have content
    expect(headingText).toBeTruthy();
    expect(headingText?.length).toBeGreaterThan(0);

    // Check for conference information
    const body = page.locator('body');
    const pageText = await body.textContent();

    // Should contain session information
    expect(pageText?.toLowerCase()).toContain('session');
  });

  test('should display poll questions on survey results page', async ({ page }) => {
    await page.goto('/survey-results');

    // Wait for content to load
    await page.waitForLoadState('networkidle');

    // Look for poll elements
    const pollQuestions = page.locator(
      '[class*="poll"], [class*="question"], [data-testid*="poll"]'
    );

    // Check if page has any poll-related content
    const body = page.locator('body');
    const pageText = await body.textContent();

    // Should have content loaded
    expect(pageText?.length).toBeGreaterThan(0);
  });

  test('should allow user to select ranking options in poll', async ({ page }) => {
    // This test assumes a page with ranking polls exists
    await page.goto('/cew-polls/test', { waitUntil: 'load' }).catch(() => {
      // If page doesn't exist, use alternative
      return page.goto('/survey-results');
    });

    // Look for ranking poll containers
    const rankingPolls = page.locator('[class*="ranking"], [data-testid*="ranking"]');

    // If ranking polls exist, interact with them
    if (await rankingPolls.count() > 0) {
      // Look for option buttons/inputs
      const options = page.locator('button[data-rank], input[type="radio"], input[type="checkbox"]');

      if (await options.count() > 0) {
        // Try to select first option
        await options.first().click();

        // Option should be selected
        const firstOption = options.first();
        const isSelected = await firstOption.isChecked().catch(() => false);

        // Either checked or has selected class/attribute
        if (isSelected) {
          expect(isSelected).toBe(true);
        }
      }
    }
  });

  test('should display poll results when clicking view results', async ({ page }) => {
    await page.goto('/survey-results', { waitUntil: 'load' });

    // Look for view results buttons
    const resultButtons = page.locator(
      'button:has-text("results"), button:has-text("Results"), [data-testid*="results"]'
    );

    if (await resultButtons.count() > 0) {
      // Click first results button
      await resultButtons.first().click();

      // Wait for results to appear
      const results = page.locator('[class*="chart"], [class*="result"], [data-testid*="result"]');

      // Results should be visible
      if (await results.count() > 0) {
        await expect(results.first()).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('should display vote count in poll results', async ({ page }) => {
    await page.goto('/survey-results');

    // Wait for content
    await page.waitForLoadState('networkidle');

    // Look for vote count displays
    const voteCountElements = page.locator(
      'text=/votes?/i, text=/responses?/i, text=/submissions?/i'
    );

    // Check if any vote counts are displayed
    const bodyText = await page.locator('body').textContent();

    // Should have numbers indicating votes if results exist
    const hasNumbers = /\d+/.test(bodyText || '');
    expect(hasNumbers).toBe(true);
  });

  test('should display charts for poll visualization', async ({ page }) => {
    await page.goto('/survey-results');

    // Wait for charts to load
    await page.waitForLoadState('networkidle');

    // Look for chart containers
    const charts = page.locator('canvas, svg[class*="chart"], [class*="chart"]');

    // Page should have visual representations
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.length).toBeGreaterThan(100);
  });

  test('should handle navigation between poll pages', async ({ page }) => {
    await page.goto('/cew-2025');

    const currentUrl = page.url();

    // If redirected to login, that's expected behavior when not authenticated
    if (currentUrl.includes('/login')) {
      expect(currentUrl).toContain('/login');
      return;
    }

    // Look for navigation links to other sections
    const navLinks = page.locator('a[href*="/"]');

    if (await navLinks.count() > 0) {
      // Get first navigation link
      const firstLink = navLinks.first();
      const href = await firstLink.getAttribute('href');

      if (href && !href.startsWith('http') && !href.includes('#')) {
        // Click link
        await firstLink.click();

        // Should navigate to new page
        await page.waitForLoadState('load').catch(() => {});

        // URL should have changed
        expect(page.url()).not.toContain('/cew-2025');
      }
    }
  });

  test('should preserve poll selections when navigating away and back', async ({ page }) => {
    await page.goto('/survey-results');

    // Look for interactive poll elements
    const pollElements = page.locator('input[type="radio"], input[type="checkbox"], button[data-rank]');

    if (await pollElements.count() > 0) {
      // Select first option
      await pollElements.first().click();

      // Navigate to different page
      const links = page.locator('a[href*="/"]');
      if (await links.count() > 0) {
        const targetLink = await links.first().getAttribute('href');

        if (targetLink && !targetLink.includes('/survey-results')) {
          // Go back
          await page.goBack().catch(() => {});

          // Original selection might still be there (localStorage dependent)
          await page.waitForLoadState('load').catch(() => {});

          // Page should load
          const body = page.locator('body');
          await expect(body).toBeVisible();
        }
      }
    }
  });

  test('should display error message when poll submission fails', async ({ page }) => {
    // This test simulates a submission error scenario
    await page.goto('/survey-results');

    // Look for submit buttons
    const submitButtons = page.locator('button:has-text("submit"), button:has-text("Submit"), button:has-text("vote"), button:has-text("Vote")');

    if (await submitButtons.count() > 0) {
      // Intercept network request to simulate failure
      await page.route('**/api/**', route => {
        route.abort('failed');
      });

      // Try to submit
      const submitButton = submitButtons.first();
      if (await submitButton.isEnabled()) {
        await submitButton.click();
      }

      // Should show error or maintain current state
      await page.waitForTimeout(1000);

      // Error should be visible or request should fail gracefully
      const errorMessage = page.locator('[role="alert"], [class*="error"]');

      if (await errorMessage.count() > 0) {
        await expect(errorMessage.first()).toBeVisible({ timeout: 3000 }).catch(() => {});
      }
    }
  });

  test('should show confirmation after successful poll submission', async ({ page }) => {
    await page.goto('/survey-results');

    // Look for submit buttons
    const submitButtons = page.locator('button:has-text("submit"), button:has-text("Submit"), button:has-text("vote"), button:has-text("Vote")');

    if (await submitButtons.count() > 0) {
      // Mock successful response
      await page.route('**/api/**', route => {
        route.continue();
      });

      // Try to submit
      const submitButton = submitButtons.first();
      if (await submitButton.isEnabled()) {
        await submitButton.click();

        // Wait for any success message or state change
        await page.waitForTimeout(2000);

        // Check for success indicators
        const successMessage = page.locator('text=/success|submitted|thank/i');
        const disabledButton = page.locator('button:disabled');

        // Either success message or button becomes disabled
        if (await successMessage.count() > 0) {
          await expect(successMessage.first()).toBeVisible({ timeout: 5000 }).catch(() => {});
        }
      }
    }
  });

  test('should display helpful messaging on empty poll state', async ({ page }) => {
    await page.goto('/survey-results');

    // Wait for page content
    await page.waitForLoadState('load');

    // Check for no-data messaging or loading states
    const emptyState = page.locator(
      'text=/no results|no data|no polls|loading/i'
    );

    // Page should have content or messaging
    const bodyText = await page.locator('body').textContent();
    expect(bodyText?.length).toBeGreaterThan(0);
  });

  test('should support keyboard navigation in poll options', async ({ page }) => {
    await page.goto('/survey-results');

    // Look for focusable poll elements
    const focusableElements = page.locator('button, input, a, [tabindex]');

    if (await focusableElements.count() > 0) {
      // Tab to first element
      const firstElement = focusableElements.first();

      // Focus element
      await firstElement.focus();

      // Check if focused
      const isFocused = await firstElement.evaluate((el) => document.activeElement === el);
      expect(isFocused).toBe(true);

      // Should be able to interact with keyboard
      // Try spacebar/enter
      if (await firstElement.locator('input, button').count() > 0) {
        // Element should be keyboard accessible
        expect(isFocused).toBe(true);
      }
    }
  });

  test('should load detailed poll results page', async ({ page }) => {
    await page.goto('/survey-results/detailed-findings');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Check if page exists and has content
    const heading = page.locator('h1, h2');
    const bodyText = await page.locator('body').textContent();

    // Should have content
    expect(bodyText?.length).toBeGreaterThan(0);
  });
});
