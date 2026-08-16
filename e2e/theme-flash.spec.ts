import { test, expect } from '@playwright/test';

/**
 * Audit B11 -- theme flash.
 *
 * jsdom cannot see this defect at all: it has no paint pipeline, and a unit test that
 * asserts "ThemeProvider ends up dark" passes just as happily when the dark class is
 * applied three frames after a white first paint. So the real proof lives here.
 *
 * The discriminating move is BLOCKING every JavaScript chunk. With the bundle blocked React
 * never hydrates and ThemeProvider's effects never run, so the only thing that can put
 * `dark` on <html> is the synchronous inline bootstrap in <head>. Delete that script and
 * these tests fail; they cannot pass vacuously.
 */

const CHUNK_GLOB = '**/_next/**/*.js';

test.describe('B11 theme bootstrap (no flash of light theme)', () => {
  test('serves the bootstrap inline in <head>, before any body content', async ({ page }) => {
    const response = await page.goto('/');
    const html = await response!.text();

    const headEnd = html.indexOf('</head>');
    const bodyStart = html.indexOf('<body');
    const scriptAt = html.indexOf("localStorage.getItem('theme')");

    expect(scriptAt, 'theme bootstrap script is absent from the served HTML').toBeGreaterThan(-1);
    expect(headEnd, 'served document has no </head>').toBeGreaterThan(-1);
    // Position, not mere presence: a script that ships at the end of <body> would still be
    // "present" while doing nothing about the flash.
    expect(scriptAt).toBeLessThan(headEnd);
    expect(scriptAt).toBeLessThan(bodyStart);
  });

  test('applies dark to <html> with the JS bundle blocked (proves it is pre-hydration)', async ({ page }) => {
    await page.route(CHUNK_GLOB, (route) => route.abort());
    await page.addInitScript(() => {
      window.localStorage.setItem('theme', 'dark');
    });

    await page.goto('/', { waitUntil: 'commit' });

    await expect(page.locator('html')).toHaveClass(/\bdark\b/);
    await expect(page.locator('html')).not.toHaveClass(/\blight\b/);
  });

  test('applies light to <html> with the JS bundle blocked when nothing is stored', async ({ page }) => {
    await page.route(CHUNK_GLOB, (route) => route.abort());

    await page.goto('/', { waitUntil: 'commit' });

    await expect(page.locator('html')).toHaveClass(/\blight\b/);
    await expect(page.locator('html')).not.toHaveClass(/\bdark\b/);
  });

  test('does not flip back to light after React hydrates', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('theme', 'dark');
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // ThemeProvider's own effect must agree with the bootstrap, or the user sees a second
    // flash in the other direction after hydration.
    await expect(page.locator('html')).toHaveClass(/\bdark\b/);
  });
});
