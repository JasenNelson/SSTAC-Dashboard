import React from 'react';
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
});
