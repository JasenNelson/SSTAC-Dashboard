import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { ThemeProvider } from '@/contexts/ThemeContext';
import Home from '../page';

function renderHome() {
  return render(
    <ThemeProvider>
      <Home />
    </ThemeProvider>,
  );
}

describe('Home (logged-out landing page)', () => {
  it('renders an editorial header with no gradient class and no emoji status pill', () => {
    const { container } = renderHome();

    expect(
      screen.getByRole('heading', { level: 1, name: /Sediment Standards Project/i }),
    ).toBeInTheDocument();
    expect(container.innerHTML).not.toMatch(/bg-gradient-to-r/);
    expect(container.textContent).not.toMatch(/\u{1F680}/u); // no rocket emoji
    expect(
      screen.getByText(/Current Focus: Phase 2/i),
    ).toBeInTheDocument();
  });

  // Round-2 P1-1 regression guard: the round-1 hero rewrite deleted the only public
  // statement of the two active Phase 2 workstreams. Decision #10 authorised dropping the
  // gradient and keeping the description short -- not deleting that sentence.
  // Two-sided falsification: deleting either name from the hero paragraph fails the
  // corresponding expectation; both present passes. The assertion is SCOPED to the hero
  // element, so it cannot be satisfied by the ProjectPhases block further down the page
  // (which also names the two workstreams) -- that is what makes it a real guard for the
  // hero sentence specifically, and it also reads rendered text only, so a JSX comment
  // cannot satisfy it.
  it('names both active Phase 2 workstreams (Derivation Options + BN-RRM) in the hero', () => {
    renderHome();

    const hero = screen.getByTestId('landing-hero-workstreams');
    expect(hero.textContent).toMatch(/Matrix Sediment Standards Derivation Options/i);
    expect(hero.textContent).toMatch(/BN-RRM/i);
  });

  it('renders the 3 nav cards with one consistent neutral icon-tile style', () => {
    renderHome();

    const dashboardCard = screen.getByRole('link', { name: /Dashboard/i });
    const surveyCard = screen.getByRole('link', { name: /Survey Results/i });
    const cewCard = screen.getByRole('link', { name: /CEW 2025/i });
    expect(dashboardCard).toBeInTheDocument();
    expect(surveyCard).toBeInTheDocument();
    expect(cewCard).toBeInTheDocument();

    // No per-card decorative hue tiles remain on the 3 nav cards specifically
    // (the unrelated "About" section icon at the top of the page is out of
    // scope for decision #11/#3 and deliberately untouched).
    for (const card of [dashboardCard, surveyCard, cewCard]) {
      expect(card.innerHTML).not.toMatch(/bg-green-100|bg-purple-100|bg-sky-100/);
      expect(card.querySelector('.bg-slate-100.dark\\:bg-slate-700')).not.toBeNull();
    }
  });

  it('keeps the 3 nav cards outside any navigation landmark', () => {
    render(
      <ThemeProvider>
        <Home />
      </ThemeProvider>,
    );
    // Round-2 P3-5: this used to assert `queryByRole('navigation')` was absent from the
    // WHOLE page, which would fail the landing-page header nav that is explicitly recorded
    // as intended future work -- the test would have blocked the very change it does not
    // care about. Narrowed to the thing this batch actually decided: the three nav CARDS
    // are plain links in the card grid, not items inside a <nav> landmark. Adding a header
    // <nav> later is now free.
    for (const name of [/Dashboard/i, /Survey Results/i, /CEW 2025/i]) {
      const card = screen.getByRole('link', { name });
      expect(card.closest('nav')).toBeNull();
    }
  });
  // ---------------------------------------------------------------------------
  // Audit #18 (2026-08-16): sign-in was reachable only from a "Get Involved" box
  // below every content card, at the very bottom of the page. Moved into the
  // header, which is the only part of this page visible without scrolling.
  // ---------------------------------------------------------------------------
  describe('#18 authentication links in the header', () => {
    it('exposes Log In and Create Account inside the header account nav', () => {
      renderHome();

      const accountNav = screen.getByRole('navigation', { name: /Account/i });
      const logIn = within(accountNav).getByRole('link', { name: 'Log In' });
      const createAccount = within(accountNav).getByRole('link', { name: 'Create Account' });

      expect(logIn).toHaveAttribute('href', '/login');
      expect(createAccount).toHaveAttribute('href', '/signup');

      // textContent, not just the accessible name: an icon-only control with a matching
      // aria-label would satisfy getByRole and still show the user nothing readable.
      expect(logIn.textContent).toBe('Log In');
      expect(createAccount.textContent).toBe('Create Account');
    });

    it('places them in the header, not somewhere further down the page', () => {
      const { container } = renderHome();

      const header = container.querySelector('header');
      expect(header).not.toBeNull();
      expect(within(header as HTMLElement).getByRole('link', { name: 'Log In' })).toBeInTheDocument();
      expect(
        within(header as HTMLElement).getByRole('link', { name: 'Create Account' }),
      ).toBeInTheDocument();
    });

    it('no longer renders the bottom-of-page Get Involved box', () => {
      renderHome();

      // The half that makes this a real guard: reinstating the box would put a SECOND
      // pair of these links on the page, so the header queries above would become
      // ambiguous -- and this heading assertion catches the box directly.
      expect(screen.queryByRole('heading', { name: /Get Involved/i })).not.toBeInTheDocument();
      expect(screen.getAllByRole('link', { name: 'Log In' })).toHaveLength(1);
      expect(screen.getAllByRole('link', { name: 'Create Account' })).toHaveLength(1);
    });
  });
  // ---------------------------------------------------------------------------
  // Section B Wave A (2026-08-16): B1 sign-in labels, B2 main landmark + skip link,
  // B3 heading hierarchy, B6 acronym expansions, B7a footer, B9 next/link.
  // ---------------------------------------------------------------------------
  describe('Wave A landing-page accessibility and copy', () => {
    it('B2: the skip link href resolves to the main landmark', () => {
      const { container } = renderHome();

      const skipLink = screen.getByRole('link', { name: /Skip to main content/i });
      const href = skipLink.getAttribute('href') ?? '';
      expect(href.startsWith('#')).toBe(true);

      // The assertion that matters. Checking only that an anchor exists would pass for a
      // skip link pointing at a target that is not on the page, which does nothing at all.
      const target = container.querySelector(href);
      expect(target).not.toBeNull();
      expect(target?.tagName.toLowerCase()).toBe('main');
    });

    it('B2: the skip link is the first focusable element on the page', () => {
      const { container } = renderHome();

      const focusable = container.querySelectorAll('a[href], button, input, [tabindex]');
      expect(focusable.length).toBeGreaterThan(0);
      expect(focusable[0].textContent).toMatch(/Skip to main content/i);
    });

    // Review correction: the first version of this test walked every heading asserting no
    // level stepped down by more than one. That was VACUOUS -- ProjectPhases renders h3s
    // before the card grid, so deleting the new h2 left the sequence [1,2,3,3,3,3,3,3],
    // every delta still <= 1, and the test passed with the defect present. It now asserts
    // the actual defect: each CARD h3 must be owned by the new h2.
    it('B3: each nav-card h3 is owned by a preceding level-2 heading', () => {
      const { container } = renderHome();

      const headings = Array.from(
        container.querySelectorAll('h1, h2, h3, h4, h5, h6'),
      ) as HTMLElement[];

      for (const name of ['Dashboard', 'Survey Results', 'CEW 2025']) {
        const index = headings.findIndex(
          (h) => h.tagName === 'H3' && h.textContent?.trim() === name,
        );
        expect(index).toBeGreaterThan(-1);

        const owner = headings
          .slice(0, index)
          .reverse()
          .find((h) => Number(h.tagName.slice(1)) <= 2);

        expect(owner?.textContent?.trim()).toBe('Explore the Project');
      }
    });

    it('B1: each auth-gated card says sign-in is required', () => {
      renderHome();

      for (const name of [/Dashboard/i, /Survey Results/i, /CEW 2025/i]) {
        const card = screen.getByRole('link', { name });
        expect(card.textContent).toMatch(/Sign-in required/i);
      }
    });

    it('B6: TWG and BN-RRM are expanded on first use', () => {
      const { container } = renderHome();
      const text = container.textContent ?? '';

      expect(text).toMatch(/Technical\s+Working\s+Group\s+\(TWG\)/);
      expect(text).toMatch(/BN-RRM\s+\(Bayesian\s+Network\s+Relative\s+Risk\s+Model\)/);
    });

    // Owner decision D7 = option C: no year at all, for anyone. A copyright year carries no
    // legal weight, and every alternative had a real cost -- a render-time year bakes in the
    // BUILD's clock on a statically prerendered page, and a mount-resolved year leaves no-JS
    // readers and crawlers with nothing anyway. Omitting it is the honest and simplest answer.
    //
    // Falsified: restoring any hard-coded year, or a getFullYear() call, fails the
    // no-four-digit-year assertion below.
    it('B7a: the footer carries no year at all and no rights boilerplate', () => {
      const { container } = renderHome();

      const footer = container.querySelector('footer');
      expect(footer).not.toBeNull();
      const text = footer?.textContent ?? '';

      // No four-digit year, not merely "not 2025" -- that weaker form would pass the moment
      // someone hard-coded 2026 instead, which is the exact defect this replaces.
      expect(text).not.toMatch(/[0-9]{4}/);
      expect(text).not.toMatch(/all rights reserved/i);

      // Pair the absence checks with an existence check, or this certifies an empty footer.
      expect(text).toMatch(/SSTAC/);
      expect(text).toMatch(/TWG Dashboard/);
    });

    // page.tsx must stay hook-free. The earlier mount-resolved year introduced useState and
    // useEffect here, which would have blocked audit item B10 (dropping 'use client' from this
    // file, which requires zero hooks). Option C removes them again; this guard stops them
    // returning by accident.
    it('B7a: the landing page needs no client hooks to render its footer', () => {
      const source = fs.readFileSync(
        path.join(process.cwd(), 'src', 'app', 'page.tsx'),
        'utf8',
      );

      expect(source.includes('useState')).toBe(false);
      expect(source.includes('useEffect')).toBe(false);
    });

    // Review correction: the first version of this test counted anchors with root-relative
    // hrefs. That was VACUOUS for B9 -- next/link renders a bare <a href> in jsdom, so
    // reverting all three Links to raw anchors left the DOM byte-identical and the test
    // green. It also asserted an exact count, which would break on any unrelated future
    // link. B9 is a SOURCE-level property, so it is asserted at source level.
    it('B9: no route link on this page is a raw anchor', () => {
      const source = fs.readFileSync(
        path.join(process.cwd(), 'src', 'app', 'page.tsx'),
        'utf8',
      );

      const rawRouteAnchors = source.match(/<a\s[^>]*href="\/[^"#]/g) ?? [];
      expect(rawRouteAnchors).toEqual([]);

      // Pair the absence check with an existence check, or it certifies an empty file.
      expect(source.includes('<Link')).toBe(true);
      expect(source.split('<Link').length - 1).toBeGreaterThanOrEqual(5);
      // The one raw anchor that SHOULD remain is the in-page skip link.
      expect(source.includes('MAIN_CONTENT_ID}`}')).toBe(true);
    });

    it('B9: the three gated cards do not prefetch routes that only redirect', () => {
      const source = fs.readFileSync(
        path.join(process.cwd(), 'src', 'app', 'page.tsx'),
        'utf8',
      );

      // App Router prefetches on viewport entry in production; all three destinations sit
      // behind the auth middleware, so for a logged-out visitor every prefetch is guaranteed
      // to produce nothing but a redirect.
      expect((source.match(/prefetch=\{false\}/g) ?? []).length).toBe(3);
    });
  });
});
