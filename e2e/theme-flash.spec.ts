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
 * Scope of that claim, stated precisely because this comment has now overclaimed TWICE.
 * Re-measured 2026-08-16 against the current tip by replacing THEME_BOOTSTRAP_SCRIPT with ''
 * and running the whole file: 3 failed, 6 passed -- measured when the file held 9 tests, before
 * the servedHtmlClasses guards existed. Those guards are pure functions the bootstrap cannot
 * affect, so the same experiment today reads 3 failed, 13 passed. The three that fail are
 * test 1 (serves the bootstrap inline in <head>), test 2 (applies dark with the bundle blocked), and the D2
 * migration test "migrates a localStorage-only user BEFORE hydration" -- that last one is
 * bootstrap-dependent too, which the previous version of this comment never said. Tests are
 * named rather than cited by line here on purpose: the previous version's `:151` pointer was
 * invalidated by the edit that introduced it.
 *
 * Test 3 PASSED with the bootstrap deleted, so it did not discriminate it. That is not rot in
 * the test; it is a consequence of D2. Since 6818d1fb the SERVER emits class="light" for a
 * request carrying no theme cookie (src/app/layout.tsx), so <html> is already light before any
 * script could run. Rather than leave a test that proves neither mechanism, test 3 was
 * REWRITTEN to assert on the SERVED MARKUP: it now fails if the server resolution is removed,
 * and is the no-cookie counterpart to the corrupt-cookie wire assertion in the D2 block. Note
 * a DOM-only assertion could not have done this -- with nothing stored the bootstrap also
 * resolves to light, so both mechanisms produce the same DOM and only the wire tells them
 * apart.
 *
 * Test 4 does NOT block anything and is NOT a flash test -- it is the guard that
 * ThemeProvider agrees with the bootstrap and does not flip the theme back after hydration.
 * It passes with or without the script, by design.
 *
 * Since D2 the server ALSO resolves the theme, from a cookie. Every test in THIS block still
 * runs with no theme cookie set, which is exactly the population the bootstrap serves
 * (first-time visitors and anyone whose cookie was stripped). D2 did retire one thing, and
 * only one: test 3's ability to discriminate the bootstrap, which is why it was rewritten into
 * a server-resolution assertion as described above. It is kept in THIS block because it shares
 * the block's no-cookie fixture and was rewritten in place -- so yes, it is a server-resolution
 * assertion living in a bootstrap block. What makes it discriminate is the WIRE read, not the
 * blocked bundle: the response body is byte-identical whether or not CHUNK_GLOB aborts, since
 * that route intercepts /_next chunks and not the document. The blocked bundle only keeps the
 * secondary DOM assertions from being a post-hydration observation. The cookie-path assertions
 * proper are the second describe block in this file.
 *
 * The glob carries a trailing `*` so it also matches Next's dev-mode cache-busted chunks
 * (`main-app.js?v=1786856270857`). Playwright anchors glob matches against the FULL url
 * including the query string, so `**\/_next\/**\/*.js` alone silently let those through.
 */

const CHUNK_GLOB = '**/_next/**/*.js*';

/**
 * The theme classes the SERVER put on <html>, read from the response body.
 *
 * Every assertion about the SERVER-RENDERED THEME CLASS goes through here, because the obvious
 * version is wrong in a way that passes. Slicing the opening tag out and running `toContain('dark')` over the whole
 * thing scores a hit on ANY attribute containing the word -- `data-theme="dark"`,
 * `data-mode="dark"` -- so it can report the server resolved the theme when it emitted no class
 * at all. Tokenising the class list is what makes these assertions mean what they say.
 *
 * It WALKS the tag's attributes rather than searching it for `class=`. That distinction is the
 * whole point of the second regex: a naive `/\sclass=(["'])(.*?)\1/` also matches class-like text
 * sitting INSIDE another attribute's value, so `<html data-note=" class='dark'">` would report
 * `['dark']` with no class attribute present at all -- a false PASS, which is worse than the
 * false pass this helper was written to remove. Consuming each quoted value as a unit means the
 * scan steps over such text instead of matching inside it.
 *
 * THE GUARANTEE IS SCOPED, and the scope is the point. Three earlier versions each carried an
 * UNCONDITIONAL claim in this comment, and each was falsified by constructed markup -- so this
 * one states its input domain instead of quantifying over all inputs.
 *
 * FOR MARKUP `react-dom/server` CAN EMIT -- an optional doctype, then `<html>` with quoted,
 * entity-escaped attribute values (verified: React escapes `<`, `>` and `"` in values, and
 * src/app/layout.tsx renders `<html lang="en" className={theme} suppressHydrationWarning>` after
 * a bare `<!DOCTYPE html>`) -- it returns the real class list of the document element, or `[]`.
 * Mechanisms: comments stripped first; the search ANCHORED to the prologue rather than finding
 * the first textual `<html`; the attribute scan STICKY so it cannot resume inside a value it
 * failed to parse; anything unparseable ends the walk and yields `[]`.
 *
 * OUTSIDE that domain it is not a spec-compliant parser and does not pretend to be. SEVERAL
 * constructions diverge from the HTML tokenizer -- a doctype carrying a public or system
 * identifier, or an internal subset, can smuggle a tag past the prologue anchor, and a
 * non-breaking space is whitespace to JS but not to the tokenizer. None is emittable by React.
 * One is written out in full because naming it is the whole lesson: a comment spliced INSIDE
 * the tag (`<html lang="en" <!--x--> class="dark">`) is removed by the strip, which splices a token the browser would never treat as an attribute of <html>
 * into the walk. React cannot emit that. It is a real divergence, it is not reachable here, and
 * it is written down rather than asserted away.
 *
 * Every call site makes a positive assertion, so a `[]` result fails loud rather than passing.
 *
 * Returns an empty array when no tag or no class attribute is found, so every caller must make
 * at least one POSITIVE assertion -- a lone `not.toContain(...)` would pass on nothing.
 */
function servedHtmlClasses(html: string): string[] {
  // Strip comments first, so `<html ...>` inside one cannot be mistaken for the document element.
  const source = html.replace(/<!--[\s\S]*?-->/g, '');

  // Anchor to the PROLOGUE rather than searching for the first textual `<html`. A search finds
  // `<html` anywhere, including inside a doctype system identifier
  // (`<!DOCTYPE html SYSTEM "<html class='dark'>">`) or a bogus comment (`<?x <html ...>>`), both
  // of which a reviewer used to make the old version report a class the document did not have.
  // Accepting only optional whitespace and at most one doctype means those inputs fail to match
  // and return [] -- the safe direction.
  const prologue = /^\s*(?:<!doctype[^>]*>\s*)?/i.exec(source);
  const start = prologue ? prologue[0].length : 0;
  if (!/^<html\b/i.test(source.slice(start))) return [];

  // STICKY (`y`) so each step must match at exactly lastIndex. A non-sticky `exec` loop is what
  // made the previous version wrong: on a failed match it slides forward one character at a time
  // and can resume INSIDE a later attribute's value, so `<html data-a=class="dark">` reported
  // `['dark']` from a tag with no class attribute. Anchored, that input simply fails to parse.
  // The optional value group accepts valueless attributes (`<html hidden class="dark">`).
  const attr = /\s+([a-zA-Z_:][-\w:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'))?/y;
  attr.lastIndex = start + '<html'.length;

  for (;;) {
    if (/^\s*\/?>/.test(source.slice(attr.lastIndex))) return []; // tag closed, no class
    const match = attr.exec(source);
    if (match === null) return []; // unparseable -> bail rather than guess
    const name = match[1].toLowerCase();
    if (name === 'class') return (match[2] ?? match[3] ?? '').split(/\s+/).filter(Boolean);
  }
}

/**
 * Guard the guard. Every server-rendered-class assertion below is only as trustworthy as
 * servedHtmlClasses, and
 * the failure mode that matters is a FALSE PASS -- returning a theme token that is not actually
 * in a class attribute. These cases need no browser; they are here rather than in a unit test
 * because the helper is local to this spec and should not outlive it.
 */
test.describe('servedHtmlClasses (the wire-assertion helper)', () => {
  test('reads the class list off the opening tag', () => {
    expect(servedHtmlClasses('<!DOCTYPE html><html lang="en" class="light">')).toEqual(['light']);
    expect(servedHtmlClasses("<html class='dark' lang='en'>")).toEqual(['dark']);
    expect(servedHtmlClasses('<html lang="en" class="dark extra">')).toEqual(['dark', 'extra']);
  });

  test('does NOT match class-like text inside another attribute value', () => {
    // The naive /\sclass=(["'])(.*?)\1/ returns ['dark'] here, reporting a resolved theme from a
    // document that carries no class attribute at all. That is the false pass this helper exists
    // to make impossible, so it is asserted rather than assumed.
    expect(servedHtmlClasses('<html data-note=" class=\'dark\'" lang="en">')).toEqual([]);
    expect(servedHtmlClasses('<html data-x="class=&quot;dark&quot;">')).toEqual([]);
  });

  test('does NOT resume scanning inside an attribute it could not parse', () => {
    // The first and third returned ['dark'] from the UNANCHORED scan -- on a failed match the
    // scanner slid forward and matched class-like text further along. Two independent reviewers
    // constructed them. Stated precisely, because a reviewer measured it: only those two
    // discriminate that version; the middle one discriminates the two versions before it. The
    // block as a whole is not an anti-regression net for every past version of this helper.
    expect(servedHtmlClasses('<html data-a=class="dark">')).toEqual([]);
    expect(servedHtmlClasses('<html data-note="x class=\'dark\' y>" lang="en">')).toEqual([]);
    expect(servedHtmlClasses('<html data-note=class="dark">')).toEqual([]);
  });

  test('does NOT take an <html> hiding in the prologue', () => {
    // Both of these made the previous version report a class the document does not have: the
    // search found the first TEXTUAL `<html`, inside a doctype system identifier and inside a
    // bogus comment respectively. Neither is reachable from react-dom/server, which escapes
    // `<`, `>` and `"` in attribute values -- they are asserted because the fix is an anchor,
    // and an anchor is exactly the kind of thing that quietly stops holding.
    expect(
      servedHtmlClasses('<!DOCTYPE html SYSTEM "<html class=\'dark\'>"><html class="light">'),
    ).toEqual([]);
    expect(servedHtmlClasses('<?x <html class=\'dark\'>><html class="light">')).toEqual([]);
    // The ordinary prologue still resolves normally.
    expect(servedHtmlClasses('<!DOCTYPE html><html class="light">')).toEqual(['light']);
    expect(servedHtmlClasses('\n  <!doctype html>\n<html class="dark">')).toEqual(['dark']);
  });

  test('takes the document element, not an <html> inside a comment', () => {
    expect(
      servedHtmlClasses('<!-- <html class="dark"> --><!DOCTYPE html><html class="light">'),
    ).toEqual(['light']);
  });

  test('treats a valueless class attribute as empty, and does not fall through to a later one', () => {
    // Browsers take the FIRST attribute and ignore the duplicate, so `class` with no value means
    // an empty class list -- NOT an invitation to keep looking for one that has a value.
    expect(servedHtmlClasses('<html class class="dark">')).toEqual([]);
    expect(servedHtmlClasses('<html hidden class="dark">')).toEqual(['dark']);
    expect(servedHtmlClasses('<html class="dark" class="light">')).toEqual(['dark']);
  });

  test('returns an empty list rather than guessing', () => {
    expect(servedHtmlClasses('<html lang="en">')).toEqual([]);
    expect(servedHtmlClasses('<div class="light"></div>')).toEqual([]);
    expect(servedHtmlClasses('')).toEqual([]);
  });
});

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

  test('serves light on <html> when nothing is stored, from the SERVER not the script', async ({ page }) => {
    await page.route(CHUNK_GLOB, (route) => route.abort());

    const response = await page.goto('/', { waitUntil: 'commit' });

    // Assert on the WIRE, not just the DOM. A DOM-only assertion here cannot tell the two
    // mechanisms apart: with nothing stored the bootstrap falls through to `t='light'` and adds
    // the class itself, so `expect(html).toHaveClass(/light/)` passes even with the server
    // resolution deleted. Reading the served markup is what makes this test discriminate.
    //
    // Parse the CLASS ATTRIBUTE, not substrings of the tag. An earlier version sliced the tag
    // out of the first 2000 chars and ran toContain over the whole thing, which would have been
    // fooled by any unrelated attribute carrying the word -- `data-theme="light"` or
    // `data-mode="dark"` would both have scored -- and produced a silently empty slice if the
    // tag were missing or pushed past the boundary. Tokenising the class list removes all three.
    const servedClasses = servedHtmlClasses(await response!.text());
    expect(servedClasses, 'server did not emit a theme class on <html>').toContain('light');
    expect(servedClasses).not.toContain('dark');

    // ...and the rendered result still agrees, which is what the user actually sees.
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
 * Run status: executed 2026-08-16 against this worktree on chromium -- 16 passed, the whole
 * file (9 browser tests plus the 7 servedHtmlClasses guards added later the same day). The
 * previous version of this note said a gate run "did, and they passed" without naming a run
 * anyone could find, which is an unverifiable claim of exactly the kind this file has been
 * repeatedly corrected for. Treat this line as a dated observation, not a standing guarantee.
 * The migration test below was rewritten afterwards -- see its own comment.
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

    const servedClasses = servedHtmlClasses(html);
    expect(servedClasses, 'server did not put the resolved theme on <html>').toContain('dark');
    expect(servedClasses).not.toContain('light');
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
    const servedClasses = servedHtmlClasses(html);

    // The POSITIVE assertion runs too. Without it an empty class list -- the shape returned when
    // no <html> tag or no class attribute is found -- would satisfy the negative ones, and this
    // test would pass on a server that emitted no theme at all.
    expect(servedClasses, 'server did not emit a theme class on <html>').toContain('light');
    expect(servedClasses).not.toContain('chartreuse');
    expect(servedClasses).not.toContain('dark');
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
    expect(servedHtmlClasses(html)).toContain('dark');

    const cookies = await context.cookies();
    expect(cookies.find((c) => c.name === 'theme')?.value).toBe('dark');
  });
});
