// src/components/dashboard/__tests__/ShareButton.test.tsx
//
// A11y regression tests for ShareButton. Covers the gaps fixed in this PR:
//   1. Renders the trigger with the correct ARIA attributes.
//   2. Opens the fallback menu on click, moving focus to the first menu item
//      (required so Arrow-key navigation is reachable immediately -- the
//      Arrow handler lives on the menu container, and keydown events on the
//      sibling trigger button do not bubble into it).
//   3. Opens the fallback menu via keyboard (Enter/Space activate the
//      native <button>, exercised here via userEvent.keyboard).
//   4. Closes on Escape and returns focus to the trigger (asserted via
//      waitFor, since the focus restoration is deferred one
//      requestAnimationFrame tick).
//   5. Menu items are reachable and carry role="menuitem".
//
// ASCII only.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import ShareButton from '../ShareButton';

function renderShareButton() {
  return render(
    <ShareButton
      title="Test Dashboard"
      url="https://example.com/dashboard"
      description="Test description"
    />,
  );
}

beforeEach(() => {
  // jsdom has no navigator.share; ensure it stays undefined so the
  // component takes the fallback-menu branch instead of the native
  // Web Share API branch.
  Object.defineProperty(window.navigator, 'share', {
    value: undefined,
    configurable: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ShareButton', () => {
  it('renders the trigger button', () => {
    renderShareButton();
    expect(
      screen.getByRole('button', { name: /share dashboard/i }),
    ).toBeInTheDocument();
  });

  it('trigger has the expected ARIA attributes', () => {
    renderShareButton();
    const trigger = screen.getByRole('button', { name: /share dashboard/i });
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveAttribute('aria-controls', 'share-menu');
  });

  it('opens the menu on click, sets aria-expanded true, and focuses the first item', async () => {
    renderShareButton();
    const trigger = screen.getByRole('button', { name: /share dashboard/i });
    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const menu = screen.getByRole('menu', { name: /share options/i });
    expect(menu).toHaveAttribute('id', 'share-menu');

    const emailItem = screen.getByRole('menuitem', { name: /email/i });
    await waitFor(() => expect(emailItem).toHaveFocus());
  });

  it('opens the menu via keyboard activation (Enter) on the trigger', async () => {
    const user = userEvent.setup();
    renderShareButton();
    const trigger = screen.getByRole('button', { name: /share dashboard/i });

    trigger.focus();
    await user.keyboard('{Enter}');

    expect(screen.getByRole('menu', { name: /share options/i })).toBeInTheDocument();
  });

  it('menu items are reachable and carry role="menuitem"', () => {
    renderShareButton();
    fireEvent.click(screen.getByRole('button', { name: /share dashboard/i }));

    const items = screen.getAllByRole('menuitem');
    expect(items).toHaveLength(4);
    expect(screen.getByRole('menuitem', { name: /email/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /linkedin/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /copy link/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /print/i })).toBeInTheDocument();
  });

  it('closes on Escape from within the menu and returns focus to the trigger', async () => {
    renderShareButton();
    const trigger = screen.getByRole('button', { name: /share dashboard/i });
    fireEvent.click(trigger);

    const menu = screen.getByRole('menu', { name: /share options/i });
    // Opening the menu moves focus to the first item; confirm that before
    // exercising Escape so the subsequent focus-return assertion is
    // meaningful (i.e. focus genuinely moves, it isn't already on trigger).
    const emailItem = screen.getByRole('menuitem', { name: /email/i });
    await waitFor(() => expect(emailItem).toHaveFocus());

    fireEvent.keyDown(menu, { key: 'Escape' });

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    // Focus restoration is deferred via requestAnimationFrame in closeMenu;
    // waitFor polls with real timers until it lands on the trigger.
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('closes on Escape from the trigger button while the menu is open', async () => {
    renderShareButton();
    const trigger = screen.getByRole('button', { name: /share dashboard/i });
    fireEvent.click(trigger);
    expect(screen.getByRole('menu')).toBeInTheDocument();

    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('ArrowDown navigates forward through menu items starting from the auto-focused first item', async () => {
    renderShareButton();
    fireEvent.click(screen.getByRole('button', { name: /share dashboard/i }));

    const menu = screen.getByRole('menu');
    const emailItem = screen.getByRole('menuitem', { name: /email/i });
    const linkedInItem = screen.getByRole('menuitem', { name: /linkedin/i });

    // Opening the menu already focused emailItem (the first item); confirm
    // that, then navigate forward.
    await waitFor(() => expect(emailItem).toHaveFocus());
    fireEvent.keyDown(menu, { key: 'ArrowDown' });

    expect(document.activeElement).toBe(linkedInItem);
  });

  it('ArrowUp wraps from the first item to the last item', async () => {
    renderShareButton();
    fireEvent.click(screen.getByRole('button', { name: /share dashboard/i }));

    const menu = screen.getByRole('menu');
    const emailItem = screen.getByRole('menuitem', { name: /email/i });
    const printItem = screen.getByRole('menuitem', { name: /print/i });

    await waitFor(() => expect(emailItem).toHaveFocus());
    fireEvent.keyDown(menu, { key: 'ArrowUp' });

    expect(document.activeElement).toBe(printItem);
  });

  it('clicking the backdrop closes the menu', async () => {
    const { container } = renderShareButton();
    fireEvent.click(screen.getByRole('button', { name: /share dashboard/i }));
    const emailItem = screen.getByRole('menuitem', { name: /email/i });
    await waitFor(() => expect(emailItem).toHaveFocus());

    const backdrop = container.querySelector('[aria-hidden="true"]');
    expect(backdrop).not.toBeNull();
    fireEvent.click(backdrop as Element);

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
});
