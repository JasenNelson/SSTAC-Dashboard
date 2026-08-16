import { test, expect } from '@playwright/test';

/**
 * Audit B11 -- theme flash.
 *
 * jsdom cannot see this defect at all: it has no paint pipeline, and a unit test that
 * asserts "ThemeProvider ends up dark" passes just as happily when the dark class is
 * applied three frames after a white first paint. So the real proof lives here.
 *
 * The discriminating move is BLOCKING the JavaScript chunks. With the bundle blocked React
 * never hydrates and ThemeProvider's effects never run, so the only thing that can put
 * `dark` on <html> is the synchronous inline bootstrap in <head>.
 *
 * Scope of that claim, stated precisely because the first draft of this comment overclaimed:
 * tests 1, 2 and 3 fail if the bootstrap script is deleted (measured: 3 failed, 1 passed).
 * Test 4 does NOT block anything and is NOT a flash test -- it is the guard that
 * ThemeProvider agrees with the bootstrap and does not flip the theme back after hydration.
 * It passes with or without the script, by design.
 *
 * Since D2 the server ALSO resolves the theme, from a cookie. That does not retire any test
 * below: these four all run with no theme cookie set, which is exactly the population the
 * bootstrap still serves (first-time visitors and anyone whose cookie was stripped). The
 * cookie-path assertions are the second describe block in this file.
 *
 * The glob carries a trailing `*` so it also matches Next's dev-mode cache-busted chunks
 * (`main-app.js?v=1786856270857`). Playwright anchors glob matches against the FULL url
 * including the query string, so `**\/_next\/**\/*.js` alone silently let those through.
 */

const CHUNK_GLOB = '**/_next/**/*.js*';

test.describe('B11 theme bootstrap (no flash of light theme)', () => {
  test('serves the bootstrap inline in <head>, before any body content', async ({ page }) => {
    const response = await page.goto('/');
    const html = await response!.text();

    const headEnd = html.indexOf('</head>');
    const bodyStart = html.indexOf('<body');

    // Quote-AGNOSTIC signature, deliberately. This assertion used to search for the exact
    // substring "localStorage.getItem('theme')" with single quotes. When the script began
    // deriving its literals from the shared constants via JSON.stringify -- which emits DOUBLE
    // quotes -- the script was still served and still working, but this test reported
    // "absent from the served HTML" and three browsers failed. The property under test is that
    // the bootstrap ships INSIDE <head> before any body content; the quote style the generator
    // happens to emit is not part of that property and must not be able to fail it.
    const scriptMatch = /localStorage\.getItem\(\s*['"]theme['"]\s*\)/.exec(html);
    const scriptAt = scriptMatch ? scriptMatch.index : -1;

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

/**
 * Owner decision D2, option C -- cookie-based theme resolution.
 *
 * These are the assertions that CANNOT exist at unit level, and the reason is not incidental:
 * every one of them requires a real SERVER RENDER. jsdom has no server, no cookie jar the
 * server can see, and no paint pipeline. A green Vitest run proves the resolver functions
 * agree with each other; only this file proves the server actually used them.
 *
 * Run status: the session that wrote them could not execute them (two other suites held the
 * dev ports), but a subsequent full gate run on this branch did, and they passed. The
 * migration test below was rewritten afterwards -- see its own comment.
 */
test.describe('D2 cookie-resolved theme (server render)', () => {
  test('serves class="dark" on <html> from the cookie alone, with no script involved', async ({
    page,
    context,
    baseURL,
  }) => {
    // No localStorage seeded and no reliance on the bootstrap: this must come off the wire.
    await context.addCookies([
      { name: 'theme', value: 'dark', url: baseURL! },
    ]);

    const response = await page.goto('/');
    const html = await response!.text();

    const htmlTag = html.slice(html.indexOf('<html'), html.indexOf('>', html.indexOf('<html')));
    expect(htmlTag, 'server did not put the resolved theme on <html>').toContain('dark');
  });

  test('serves the CORRECT toggle label for a dark cookie, with the JS bundle blocked', async ({
    page,
    context,
    baseURL,
  }) => {
    // This is the D2 defect itself. With the bundle blocked React never hydrates, so the
    // accessible name in the DOM is exactly what the SERVER rendered. Before D2 this said
    // "Switch to dark mode" on a dark page.
    await context.addCookies([
      { name: 'theme', value: 'dark', url: baseURL! },
    ]);
    await page.route(CHUNK_GLOB, (route) => route.abort());

    await page.goto('/', { waitUntil: 'commit' });

    await expect(page.getByRole('button', { name: /switch to light mode/i }).first()).toBeVisible();
  });

  test('resolves a corrupt cookie to light rather than putting it on <html>', async ({
    page,
    context,
    baseURL,
  }) => {
    // The cookie is client-writable by necessity (the bootstrap must read it), so the server
    // must validate rather than interpolate.
    await context.addCookies([
      { name: 'theme', value: 'chartreuse', url: baseURL! },
    ]);

    const response = await page.goto('/');
    const html = await response!.text();
    const htmlTag = html.slice(html.indexOf('<html'), html.indexOf('>', html.indexOf('<html')));

    expect(htmlTag).not.toContain('chartreuse');
    expect(htmlTag).toContain('light');
  });

  test('migrates a localStorage-only user BEFORE hydration: the inline script writes the cookie', async ({
    page,
    context,
  }) => {
    // The section-5 migration. An existing user has localStorage and no cookie, so the SERVER
    // resolves light on this one request; the bootstrap must correct the class before paint
    // AND write the cookie so the next request is server-correct.
    //
    // THE BUNDLE IS BLOCKED ON PURPOSE, and this test is worthless without it. The first
    // version waited for networkidle, by which point ThemeProvider had mounted; deleting the
    // bootstrap's cookie write -- the only thing that makes the migration happen pre-paint --
    // left both assertions passing, because the provider's own write covered for it. With the
    // chunks aborted React never hydrates, so the inline <head> script is the only code that
    // can produce either the class or the cookie. (The provider no longer writes the cookie on
    // mount at all, but blocking is what makes that structurally impossible rather than a
    // property of today's ThemeContext.)
    await context.clearCookies();
    await page.route(CHUNK_GLOB, (route) => route.abort());
    await page.addInitScript(() => {
      window.localStorage.setItem('theme', 'dark');
    });

    await page.goto('/', { waitUntil: 'commit' });

    await expect(page.locator('html')).toHaveClass(/\bdark\b/);
    await expect(page.locator('html')).not.toHaveClass(/\blight\b/);

    await expect
      .poll(
        async () => (await context.cookies()).find((c) => c.name === 'theme')?.value ?? null,
        { message: 'the pre-paint bootstrap did not write the migration cookie' },
      )
      .toBe('dark');
  });

  test('toggling writes a cookie, so a full reload stays dark with no localStorage', async ({
    page,
    context,
  }) => {
    // End-to-end proof that the write path feeds the read path. Clearing localStorage before
    // the reload is what makes this about the COOKIE and not about the old mechanism.
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /switch to dark mode/i }).first().click();
    await expect(page.locator('html')).toHaveClass(/\bdark\b/);

    await page.evaluate(() => window.localStorage.removeItem('theme'));
    await page.route(CHUNK_GLOB, (route) => route.abort());
    const response = await page.goto('/', { waitUntil: 'commit' });

    const html = await response!.text();
    const htmlTag = html.slice(html.indexOf('<html'), html.indexOf('>', html.indexOf('<html')));
    expect(htmlTag).toContain('dark');

    const cookies = await context.cookies();
    expect(cookies.find((c) => c.name === 'theme')?.value).toBe('dark');
  });
});
