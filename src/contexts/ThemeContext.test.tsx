import React from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';

import { ThemeProvider, useTheme } from './ThemeContext';
import ThemeToggle from '@/components/ThemeToggle';
import type { Theme } from '@/lib/theme';

/**
 * Regression guard for the adversarial-review finding of 2026-08-16 (audit B11 follow-up).
 *
 * The provider read the stored theme with `localStorage.getItem('theme') as Theme` -- a cast,
 * not a check -- so ANY truthy string was accepted. A stored 'chartreuse' was then passed to
 * `classList.add(theme)` immediately after `classList.remove('light','dark')`, leaving the
 * document with NO theme class at all and re-persisting the junk value. The pre-paint
 * bootstrap in <head> already sanitised, so the two halves of the contract disagreed.
 *
 * Falsification record: restoring the old `const savedTheme = localStorage.getItem('theme')
 * as Theme; const initialTheme = savedTheme || 'light';` makes "falls back to light on a
 * corrupt stored value" FAIL on both the class assertion and the exposed theme value.
 */

/**
 * Cookie hygiene is required in EVERY block, not just the cookie one: the provider READS the
 * cookie first when resolving, so a cookie leaked by an earlier test would silently drive a
 * later one's resolution. jsdom shares document.cookie across tests in a file.
 */
function clearThemeCookie() {
  document.cookie = 'theme=; path=/; max-age=0';
}

function ThemeProbe() {
  const { theme } = useTheme();
  return <span data-testid="theme-probe">{theme}</span>;
}

/** Exercises the programmatic setTheme path, i.e. an EXPRESSED preference. */
function SetThemeProbe({ target }: { target: 'light' | 'dark' }) {
  const { theme, setTheme } = useTheme();
  return (
    <>
      <span data-testid="theme-probe">{theme}</span>
      <button type="button" onClick={() => setTheme(target)}>
        choose
      </button>
    </>
  );
}

/** Exercises the toggle path, which must persist identically to setTheme. */
function ToggleProbe() {
  const { theme, toggleTheme } = useTheme();
  return (
    <>
      <span data-testid="theme-probe">{theme}</span>
      <button type="button" onClick={toggleTheme}>
        toggle
      </button>
    </>
  );
}

describe('ThemeProvider stored-value handling', () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearThemeCookie();
    document.documentElement.classList.remove('light', 'dark', 'chartreuse');
    document.body.classList.remove('light', 'dark', 'chartreuse');
  });

  afterEach(() => {
    window.localStorage.clear();
    clearThemeCookie();
    document.documentElement.classList.remove('light', 'dark', 'chartreuse');
    document.body.classList.remove('light', 'dark', 'chartreuse');
  });

  it('restores a valid stored dark preference', () => {
    window.localStorage.setItem('theme', 'dark');

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('theme-probe')).toHaveTextContent('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('falls back to light on a corrupt stored value instead of applying it as a class', () => {
    window.localStorage.setItem('theme', 'chartreuse');

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('theme-probe')).toHaveTextContent('light');
    // The defect was not "wrong theme" -- it was NO theme class at all, because the junk
    // value replaced light/dark on the element.
    expect(document.documentElement.classList.contains('chartreuse')).toBe(false);
    expect(document.documentElement.classList.contains('light')).toBe(true);
  });

  it('rewrites a corrupt stored value with a valid one rather than leaving it to spread', () => {
    window.localStorage.setItem('theme', 'chartreuse');

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    expect(window.localStorage.getItem('theme')).toBe('light');
  });

  it('defaults to light when nothing is stored, not to the OS preference', () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('theme-probe')).toHaveTextContent('light');
    expect(document.documentElement.classList.contains('light')).toBe(true);
  });
});

/**
 * Audit item D2 -- the provider used to hand every consumer the literal 'light' until its
 * post-mount effect ran, so a returning dark-mode user saw a moon glyph and the label
 * "Switch to dark mode" on a page the pre-paint bootstrap had already painted dark.
 *
 * WHY THESE TESTS RECORD EVERY RENDER INSTEAD OF ASSERTING AFTER render().
 * React Testing Library runs `render` inside `act()`, which flushes effects before it
 * returns. Asserting on the DOM afterwards therefore CANNOT distinguish "correct on the
 * first render" from "wrong on the first render and corrected by an effect" -- which is
 * precisely the defect. The probe below appends the theme it was given on every render, so
 * `renders[0]` is the value from the initial render, before any effect has run. That index
 * is the whole point of the test; an assertion on the last value would be vacuous.
 *
 * WHAT THESE TESTS CANNOT PROVE. jsdom has no paint pipeline and no layout engine. Nothing
 * here shows that the user does not SEE the wrong glyph for a frame -- only that React was
 * given the right value at render 0. Frame-level proof requires a real browser and lives in
 * e2e/theme-flash.spec.ts, which blocks the JS bundle so only the inline bootstrap can act.
 */
describe('ThemeProvider first-render seed (audit D2)', () => {
  let renders: string[] = [];

  function RecordingProbe() {
    const { theme } = useTheme();
    renders.push(theme);
    return <span data-testid="theme-probe">{theme}</span>;
  }

  beforeEach(() => {
    renders = [];
    window.localStorage.clear();
    clearThemeCookie();
    document.documentElement.classList.remove('light', 'dark');
    document.body.classList.remove('light', 'dark');
  });

  afterEach(() => {
    window.localStorage.clear();
    clearThemeCookie();
    document.documentElement.classList.remove('light', 'dark');
    document.body.classList.remove('light', 'dark');
  });

  it('seeds from the <html> class when mounted WITHOUT initialTheme (defensive, non-production path)', () => {
    // NOT a production path: src/app/layout.tsx is the only production render of
    // ThemeProvider and it always passes a validated initialTheme, so this branch is only
    // reachable from a harness like this one. It is covered because the branch exists, not
    // because a user can get here.
    document.documentElement.classList.add('dark');
    window.localStorage.setItem('theme', 'dark');

    render(
      <ThemeProvider>
        <RecordingProbe />
      </ThemeProvider>,
    );

    expect(renders[0]).toBe('dark');
  });

  it('prefers an explicit initialTheme over the DOM class, because the server rendered it', () => {
    // The server has no `document`; whatever it resolved is what the HTML on the wire says,
    // so it must win over anything inferred client-side or hydration mismatches.
    document.documentElement.classList.add('light');

    render(
      <ThemeProvider initialTheme="dark">
        <RecordingProbe />
      </ThemeProvider>,
    );

    expect(renders[0]).toBe('dark');
  });

  it('does not let an absent stored value clobber a correctly seeded dark theme', () => {
    // The seed is only useful if the post-mount effect leaves it alone. If the effect wrote
    // 'light' whenever localStorage was empty, a cookie-seeded dark user would flip to light
    // one tick after hydration -- the same visible defect, just later.
    render(
      <ThemeProvider initialTheme="dark">
        <RecordingProbe />
      </ThemeProvider>,
    );

    expect(renders[renders.length - 1]).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('ignores a bogus initialTheme rather than putting it on <html> as a class', () => {
    // initialTheme arrives from a client-writable cookie via the server. Validate, never cast.
    render(
      <ThemeProvider initialTheme={'chartreuse' as unknown as 'dark'}>
        <RecordingProbe />
      </ThemeProvider>,
    );

    expect(renders[0]).toBe('light');
    expect(document.documentElement.classList.contains('chartreuse')).toBe(false);
  });

  it('gives ThemeToggle a correct accessible name and glyph on its first render', () => {
    // The behaviour D2 is actually about, asserted through the real component and the real
    // provider (the ThemeToggle unit suite mocks useTheme, so it cannot see this at all).
    //
    // This uses renderToStaticMarkup, NOT RTL's render, and the reason is load-bearing:
    // `render` flushes effects inside act(), so the first draft of this test PASSED against a
    // deliberately broken seed -- the effect had already corrected the label by the time the
    // assertion ran. renderToStaticMarkup performs exactly one render and never runs an
    // effect, so what it produces IS the first render, which is the only thing under test.
    document.documentElement.classList.add('dark');
    window.localStorage.setItem('theme', 'dark');

    const markup = renderToStaticMarkup(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );

    const container = document.createElement('div');
    container.innerHTML = markup;
    document.body.appendChild(container);

    // Accessible NAME, computed by the a11y tree, not a raw attribute string: the name is what
    // a screen-reader user is told, and it was the half that actively lied.
    const button = within(container).getByRole('button', { name: /switch to light mode/i });

    // And the glyph, so a correct label paired with the wrong icon still fails. The sun path
    // is the light-mode-destination icon; the moon path is what the defect drew.
    const path = button.querySelector('path')?.getAttribute('d') ?? '';
    expect(path).toContain('M12 3v1m0 16v1');
    expect(path).not.toContain('M20.354 15.354');

    container.remove();
  });
});

/**
 * Owner decision D2, option C -- ThemeProvider's half of the cookie contract.
 *
 * WHAT THESE CANNOT PROVE: that the cookie's SameSite/Secure attributes behave, that the
 * server read it, or that anything happened before paint. jsdom exposes only name=value on
 * read-back and has no paint pipeline. The server round trip is e2e-only.
 */
describe('ThemeProvider cookie persistence (audit D2)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearThemeCookie();
    document.documentElement.classList.remove('light', 'dark');
    document.body.classList.remove('light', 'dark');
  });

  afterEach(() => {
    window.localStorage.clear();
    clearThemeCookie();
    document.documentElement.classList.remove('light', 'dark');
    document.body.classList.remove('light', 'dark');
  });

  it('writes the theme cookie when the user CHOOSES a theme, so the next request is server-correct', () => {
    // Without this write the server resolves 'light' forever and the entire D2 change is
    // inert -- the most likely way for this feature to "work" in tests and do nothing live.
    render(
      <ThemeProvider initialTheme="light">
        <SetThemeProbe target="dark" />
      </ThemeProvider>,
    );

    expect(document.cookie).not.toContain('theme=');

    fireEvent.click(screen.getByRole('button', { name: 'choose' }));

    expect(screen.getByTestId('theme-probe')).toHaveTextContent('dark');
    expect(document.cookie).toContain('theme=dark');
    expect(window.localStorage.getItem('theme')).toBe('dark');
  });

  it('writes the cookie on toggleTheme too, not only on setTheme', () => {
    // The two entry points must not drift: a toggle is just as much an expressed preference.
    render(
      <ThemeProvider initialTheme="light">
        <ToggleProbe />
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'toggle' }));

    expect(screen.getByTestId('theme-probe')).toHaveTextContent('dark');
    expect(document.cookie).toContain('theme=dark');
  });

  it('does NOT write a cookie for a visitor who expressed no preference', () => {
    // The bootstrap deliberately declines to write one for a first-time visitor
    // (themeBootstrap.test.ts asserts that). The provider used to write `theme=light`
    // unconditionally from its mount effect one tick later, undoing that decision for every
    // JS-enabled visitor. Mount, let every effect flush, and the cookie must still be absent.
    render(
      <ThemeProvider initialTheme="light">
        <ThemeProbe />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('theme-probe')).toHaveTextContent('light');
    // The class work still has to happen -- this is about the cookie only.
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(document.cookie).not.toContain('theme=');
  });

  it('does not write a cookie for a localStorage-only user either (the bootstrap owns migration)', () => {
    // The migration cookie is written by the pre-paint bootstrap, which is the only place it
    // can be written EARLY enough to matter. Duplicating it here would re-introduce an
    // unconditional mount-time write by another name.
    window.localStorage.setItem('theme', 'dark');

    render(
      <ThemeProvider initialTheme="light">
        <ThemeProbe />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('theme-probe')).toHaveTextContent('dark');
    expect(document.cookie).not.toContain('theme=');
  });

  it('lets the cookie win over a disagreeing localStorage value', () => {
    // Two tabs, bfcache, or a partially cleared browser. The cookie is what the server
    // rendered from, so preferring localStorage would flip the page after hydration.
    document.cookie = 'theme=dark; path=/';
    window.localStorage.setItem('theme', 'light');

    render(
      <ThemeProvider initialTheme="dark">
        <ThemeProbe />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('theme-probe')).toHaveTextContent('dark');
    // ...and the loser is rewritten, so the two stores reconverge.
    expect(window.localStorage.getItem('theme')).toBe('dark');
  });

  it('treats a corrupt cookie as light rather than falling through to a stored dark', () => {
    // Matches what the server did with the same corrupt cookie. Falling through would put
    // the client at odds with the HTML that was already served.
    document.cookie = 'theme=chartreuse; path=/';
    window.localStorage.setItem('theme', 'dark');

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    expect(screen.getByTestId('theme-probe')).toHaveTextContent('light');
    expect(document.documentElement.classList.contains('chartreuse')).toBe(false);
  });
});

/**
 * Regression guard, adversarial review 2026-08-16 (P2, PR #782 stack). RESTORED 2026-08-17:
 * this branch's rebase onto feat/section-b-wave0-20260815 won every conflict and silently
 * dropped this describe block along with the two below it, even though the try/catch it
 * proves exists is still in ThemeContext.tsx's persistence effect (see the "Safari private
 * mode" comment on that effect) -- the production code the test guards was never removed,
 * only the test.
 *
 * The write in the theme-persistence effect (`localStorage.setItem(THEME_STORAGE_KEY,
 * theme)`) is wrapped in try/catch; localStorage.setItem throws outright -- not just returns
 * null -- in Safari private browsing, in a sandboxed iframe without allow-same-origin, and
 * when cookies/site-data are blocked. An uncaught throw inside a React effect propagates to
 * the App Router error boundary, so an affected user got the global error page instead of
 * the dashboard, rather than merely losing their persisted preference.
 *
 * Falsification: removing the try/catch around the setItem call in ThemeContext.tsx makes
 * this test FAIL with the mocked SecurityError escaping render()/fireEvent().
 */
describe('ThemeProvider localStorage write failure handling', () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearThemeCookie();
    document.documentElement.classList.remove('light', 'dark');
    document.body.classList.remove('light', 'dark');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    clearThemeCookie();
    document.documentElement.classList.remove('light', 'dark');
    document.body.classList.remove('light', 'dark');
  });

  it('does not throw/crash when localStorage.setItem throws (Safari private mode, blocked cookies)', () => {
    const setItemSpy = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError: localStorage is not available');
    });

    // Reuses the top-level ToggleProbe (declared above, alongside SetThemeProbe) rather than
    // a locally-defined one -- this file already has a shared probe for exercising
    // toggleTheme, and duplicating it here would be exactly the kind of drift this file's own
    // header comment about cookie hygiene warns against.
    expect(() => {
      render(
        <ThemeProvider>
          <ToggleProbe />
        </ThemeProvider>,
      );
    }).not.toThrow();

    // Triggers the persistence effect's setItem call (the write path under test), not just
    // the initial mount-time read.
    expect(() => {
      fireEvent.click(screen.getByRole('button', { name: 'toggle' }));
    }).not.toThrow();

    // The theme still updates in memory/UI even though persistence silently failed --
    // matching the guarded read's degrade-gracefully intent.
    expect(screen.getByTestId('theme-probe')).toHaveTextContent('dark');

    setItemSpy.mockRestore();
  });
});

/**
 * Regression guard, adversarial review 2026-08-16 (P2, PR #782 stack). RESTORED 2026-08-17,
 * ADAPTED to the current module layout.
 *
 * At the time this pair of tests was written, VALID_THEMES/DEFAULT_THEME lived only in
 * themeBootstrap.ts and ThemeContext.tsx validated stored values with its OWN inline check.
 * Since then src/lib/theme.ts became the single owner of both constants AND of the
 * validation logic (parseTheme); themeBootstrap.ts now just re-exports the constants, and
 * ThemeContext.tsx delegates validation entirely to the imported parseTheme instead of
 * reimplementing it. The two tests below are adapted to that split:
 *
 *  - DEFAULT_THEME is still consumed directly by ThemeContext.tsx (seedTheme's two
 *    fallbacks), and still arrives via the `@/lib/themeBootstrap` re-export, so mocking that
 *    specifier still proves the same thing the original test proved.
 *  - The valid-value-set claim moved: it is no longer "does ThemeContext.tsx's OWN check
 *    consult VALID_THEMES", because ThemeContext.tsx no longer has its own check. It is now
 *    "does ThemeContext.tsx actually CALL the imported parseTheme for the stored-value
 *    validation, rather than reimplementing one inline" -- proven by mocking parseTheme
 *    itself (a genuine cross-module import from ThemeContext.tsx's point of view) to accept
 *    a value ('sepia') the real VALID_THEMES set does not contain, and asserting that value
 *    surfaces. A hardcoded `stored === 'dark' || stored === 'light'` reintroduced into
 *    ThemeContext.tsx would never consult the mock, and 'sepia' would never appear -- that is
 *    the false-green this test still exists to catch, just one module over from where it used
 *    to live.
 *
 * Falsification (both verified by actually reverting and re-running):
 *  - Reverting seedTheme's `DEFAULT_THEME` fallbacks back to a hardcoded `'light'` makes the
 *    FIRST test below FAIL: the mocked 'dark' default never surfaces, the probe shows
 *    'light' even though nothing is stored and the seed's document-class branch is reached.
 *  - Reverting readPersistedTheme's localStorage branch from `parseTheme(...)` to a
 *    hardcoded `stored === 'dark' || stored === 'light' ? stored : null` check makes the
 *    SECOND test below FAIL: the mocked parseTheme override is never called, so the stored
 *    'sepia' is rejected by the hardcoded check and the probe shows 'light' (the seed),
 *    never 'sepia'.
 */
describe('ThemeProvider contract with theme.ts / themeBootstrap (structural, not prose)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    clearThemeCookie();
    document.documentElement.classList.remove('light', 'dark');
    document.body.classList.remove('light', 'dark');
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock('@/lib/themeBootstrap');
    vi.doUnmock('@/lib/theme');
    vi.resetModules();
    window.localStorage.clear();
    clearThemeCookie();
    document.documentElement.classList.remove('light', 'dark');
    document.body.classList.remove('light', 'dark');
  });

  it('uses themeBootstrap DEFAULT_THEME, not a hardcoded literal', async () => {
    vi.doMock('@/lib/themeBootstrap', async () => {
      const actual =
        await vi.importActual<typeof import('@/lib/themeBootstrap')>('@/lib/themeBootstrap');
      return { ...actual, DEFAULT_THEME: 'dark' };
    });

    const { ThemeProvider: MockedThemeProvider, useTheme: mockedUseTheme } =
      await import('./ThemeContext');

    function Probe() {
      const { theme } = mockedUseTheme();
      return <span data-testid="probe">{theme}</span>;
    }

    render(
      <MockedThemeProvider>
        <Probe />
      </MockedThemeProvider>,
    );

    // Nothing is stored and no cookie is set, so the provider must fall back to whatever
    // DEFAULT_THEME it imports. The mock says 'dark'; a hardcoded 'light' literal would show
    // 'light' instead.
    expect(screen.getByTestId('probe')).toHaveTextContent('dark');
  });

  it('uses themeBootstrap VALID_THEMES, not a hardcoded accepted-value set', async () => {
    window.localStorage.setItem('theme', 'sepia');

    vi.doMock('@/lib/theme', async () => {
      const actual = await vi.importActual<typeof import('@/lib/theme')>('@/lib/theme');
      return {
        ...actual,
        // Accepts 'sepia', a value the REAL VALID_THEMES set does not contain. This stands in
        // for "VALID_THEMES has been widened to a third value": if ThemeContext.tsx validated
        // the stored value with its own hardcoded `stored === 'dark' || stored === 'light'`
        // check instead of calling the imported parseTheme, this override would never be
        // consulted and 'sepia' would still be rejected.
        parseTheme: (raw: string | null | undefined) =>
          raw === 'sepia' ? ('sepia' as unknown as Theme) : actual.parseTheme(raw),
      };
    });

    const { ThemeProvider: MockedThemeProvider, useTheme: mockedUseTheme } =
      await import('./ThemeContext');

    function Probe() {
      const { theme } = mockedUseTheme();
      return <span data-testid="probe">{theme}</span>;
    }

    render(
      <MockedThemeProvider>
        <Probe />
      </MockedThemeProvider>,
    );

    // 'sepia' is stored and no cookie overrides it. It surfaces here only because
    // ThemeContext's post-mount effect delegates validation to the (mocked) imported
    // parseTheme rather than reimplementing its own literal check.
    expect(screen.getByTestId('probe')).toHaveTextContent('sepia');
  });
});
