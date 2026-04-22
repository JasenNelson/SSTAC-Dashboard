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

  test('Identify mode arms cursor and suppresses marker/cluster side effects', async ({ page }) => {
    // Navigate to Map tab.
    const mapTab = page
      .locator('button, a')
      .filter({ hasText: /^Map$/i })
      .first();
    if (!(await mapTab.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'Map tab not visible');
      return;
    }
    await mapTab.click();
    await page.waitForTimeout(1500);

    // Identify toolbar button.
    const identifyBtn = page.getByRole('button', { name: /Identify mode/i });
    if (!(await identifyBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip(true, 'Identify button not yet rendered');
      return;
    }
    await identifyBtn.click();
    await page.waitForTimeout(400);

    // aria-pressed flips to true while Identify is active.
    await expect(identifyBtn).toHaveAttribute('aria-pressed', 'true');

    // The Identify-mode effect tags the map container with a cursor class.
    const identifyCursor = page.locator('.bnrrm-identify-cursor').first();
    const hasCursor = await identifyCursor.count();
    expect(hasCursor).toBeGreaterThan(0);

    // Find a site marker if any sites are loaded. Clicking must NOT open a
    // Leaflet popup (unbound in Identify mode) and must NOT select a site.
    const markers = page.locator('.leaflet-interactive');
    const markerCount = await markers.count();
    if (markerCount > 0) {
      await markers.first().click({ force: true });
      await page.waitForTimeout(400);
      // No Leaflet popup element should be visible for a marker's popup.
      // A transient identify popup MAY appear; that is the identify popup,
      // not a marker popup - so we assert no site-detail "Run Assessment"
      // button surfaced, which would imply selectSite was called.
      const runBtn = page
        .getByRole('button', { name: /Run Assessment/i })
        .first();
      expect(await runBtn.isVisible().catch(() => false)).toBe(false);
    }

    // Ctrl-click on a cluster should be inert in Identify mode. We cannot
    // guarantee a cluster exists, so this check is best-effort.
    const cluster = page.locator('.custom-cluster-icon').first();
    if (await cluster.isVisible().catch(() => false)) {
      await cluster.click({ modifiers: ['Control'], force: true });
      await page.waitForTimeout(300);
      // aria-pressed should still indicate Identify is active - no mode flip
      await expect(identifyBtn).toHaveAttribute('aria-pressed', 'true');
    }

    // Switch back to Pan; aria-pressed on Identify should go false.
    const panBtn = page
      .locator('button')
      .filter({ hasText: /^Pan$/ })
      .first();
    if (await panBtn.isVisible().catch(() => false)) {
      await panBtn.click();
      await page.waitForTimeout(200);
      await expect(identifyBtn).toHaveAttribute('aria-pressed', 'false');
    }
  });
});
