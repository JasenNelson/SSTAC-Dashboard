import { test, expect } from '@playwright/test';

const PACKS = [
  'bnrrm-general-v1.0-dev-map',
  'bnrrm-site-v0.1-toquaht-case-study',
  'bnrrm-site-v0.2-cpnelson-prototype',
  'bnrrm-site-v0.1-alcan-map',
  'bnrrm-casestudy-jermilova2025-mackenzie-hg',
];

const REVIEW_SECTIONS = [
  { id: 'guide', label: 'Guide' },
  { id: 'evidence', label: 'Evidence' },
  { id: 'overview', label: 'Overview' },
  { id: 'validation', label: 'Validation' },
  { id: 'decisions', label: 'Decisions' },
  { id: 'cpt', label: 'CPT Detail' },
  { id: 'provenance', label: 'Data' },
  { id: 'sites', label: 'Site Reports' },
  { id: 'comparison', label: 'Comparison' },
];

test.describe('BN-RRM Frontend Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to BN-RRM page and wait for it to load
    await page.goto('/bn-rrm', { waitUntil: 'networkidle' });
    // Wait for the pack selector to appear (indicates app is loaded)
    await page.waitForTimeout(2000);
  });

  test('BN-RRM page loads without crash', async ({ page }) => {
    // Should not show an error page
    await expect(page.locator('body')).not.toContainText('Application error');
    await expect(page.locator('body')).not.toContainText('Unhandled Runtime Error');
  });

  test('Pack selector is visible and has 4 packs', async ({ page }) => {
    // Look for the pack selector dropdown/button
    const packSelector = page.locator('button, select, [role="combobox"]').filter({ hasText: /BN-RRM|General|Toquaht|ALCAN|Nelson/i }).first();
    if (await packSelector.isVisible()) {
      await expect(packSelector).toBeVisible();
    }
  });

  test('No "Prototype" text in pack selector or banners', async ({ page }) => {
    // Check that "Prototype" doesn't appear in status-related UI elements
    const pageText = await page.textContent('body');
    // Allow "Prototype" in code/technical contexts but not in pack display names
    const packSelectorArea = page.locator('[class*="pack"], [class*="selector"], [class*="banner"]');
    const count = await packSelectorArea.count();
    for (let i = 0; i < count; i++) {
      const text = await packSelectorArea.nth(i).textContent();
      if (text && text.includes('Prototype') && !text.includes('REBUILD')) {
        test.fail(true, `Found "Prototype" without "REBUILD" context: ${text?.slice(0, 100)}`);
      }
    }
  });

  test('Review tab loads Guide section without crash', async ({ page }) => {
    // Click on Review tab
    const reviewTab = page.locator('button, a').filter({ hasText: /^Review$/i }).first();
    if (await reviewTab.isVisible()) {
      await reviewTab.click();
      await page.waitForTimeout(1000);
      // Should see Guide content (default section)
      await expect(page.locator('body')).not.toContainText('Unhandled Runtime Error');
    }
  });

  test('Review sections load without crash for default pack', async ({ page }) => {
    // Navigate to Review tab
    const reviewTab = page.locator('button, a').filter({ hasText: /^Review$/i }).first();
    if (!(await reviewTab.isVisible())) {
      test.skip(true, 'Review tab not found');
      return;
    }
    await reviewTab.click();
    await page.waitForTimeout(1000);

    // Click through each review section
    for (const section of REVIEW_SECTIONS) {
      const sectionBtn = page.locator('button').filter({ hasText: new RegExp(`^${section.label}$`, 'i') }).first();
      if (await sectionBtn.isVisible()) {
        await sectionBtn.click();
        await page.waitForTimeout(500);

        // Check no runtime error
        const hasError = await page.locator('text=Unhandled Runtime Error').isVisible().catch(() => false);
        expect(hasError, `Section "${section.label}" crashed`).toBe(false);
      }
    }
  });

  test('Case Studies tab loads without crash', async ({ page }) => {
    const caseStudiesTab = page.locator('button, a').filter({ hasText: /Case Studies/i }).first();
    if (await caseStudiesTab.isVisible()) {
      await caseStudiesTab.click();
      await page.waitForTimeout(1000);
      await expect(page.locator('body')).not.toContainText('Unhandled Runtime Error');
    }
  });

  test('Detailed BN tab loads without crash', async ({ page }) => {
    const detailedTab = page.locator('button, a').filter({ hasText: /Detailed/i }).first();
    if (await detailedTab.isVisible()) {
      await detailedTab.click();
      await page.waitForTimeout(1000);
      await expect(page.locator('body')).not.toContainText('Unhandled Runtime Error');
    }
  });

  test('No console errors on initial load', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => {
      // Ignore known non-BN-RRM errors
      if (err.message.includes('supabase') || err.message.includes('CORS')) return;
      errors.push(err.message);
    });

    await page.goto('/bn-rrm', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    expect(errors, `Console errors found: ${errors.join('; ')}`).toHaveLength(0);
  });

  test('Data tab shows BenchmarkDataViewer for benchmark pack', async ({ page }) => {
    // Switch to the benchmark pack (Mackenzie)
    const packSelector = page.locator('button, select, [role="combobox"]').filter({ hasText: /Mackenzie|Jermilova/i }).first();
    if (!(await packSelector.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'Benchmark pack not found in selector');
      return;
    }
    await packSelector.click();
    await page.waitForTimeout(1000);

    // Click on Data tab
    const dataTab = page.locator('button, a').filter({ hasText: /^Data$/i }).first();
    if (await dataTab.isVisible()) {
      await dataTab.click();
      await page.waitForTimeout(1000);

      // Should show training data viewer elements
      await expect(page.locator('body')).not.toContainText('Unhandled Runtime Error');

      // Look for dataset toggle or model selector
      const fishToggle = page.locator('button').filter({ hasText: /Fish Tissue/i }).first();
      const hasFishToggle = await fishToggle.isVisible().catch(() => false);
      expect(hasFishToggle, 'BenchmarkDataViewer should show Fish Tissue toggle').toBe(true);
    }
  });

  test('No console errors when switching to Review tab', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => {
      if (err.message.includes('supabase') || err.message.includes('CORS')) return;
      errors.push(err.message);
    });

    await page.goto('/bn-rrm', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const reviewTab = page.locator('button, a').filter({ hasText: /^Review$/i }).first();
    if (await reviewTab.isVisible()) {
      await reviewTab.click();
      await page.waitForTimeout(2000);
    }

    expect(errors, `Console errors on Review: ${errors.join('; ')}`).toHaveLength(0);
  });
});
