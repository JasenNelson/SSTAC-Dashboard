// Component tests for CategorySelector (PR-A2).
// Plain ASCII only.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import CategorySelector from '../CategorySelector';

describe('CategorySelector (PR-A2 phase: HH disabled)', () => {
  it('renders all four category buttons inside a single radiogroup', () => {
    render(
      <CategorySelector activeCategory="eco-direct" onChange={() => {}} />,
    );
    const group = screen.getByRole('radiogroup', {
      name: /Matrix category selector/i,
    });
    expect(group).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(4);
  });

  it('marks the active category with aria-checked=true and the others false', () => {
    render(<CategorySelector activeCategory="eco-food" onChange={() => {}} />);
    const ecoFood = screen.getByTestId('category-selector-eco-food');
    const ecoDirect = screen.getByTestId('category-selector-eco-direct');
    expect(ecoFood).toHaveAttribute('aria-checked', 'true');
    expect(ecoDirect).toHaveAttribute('aria-checked', 'false');
  });

  it('disables HH buttons by default (PR-A2) and surfaces the tooltip + coming-soon label', () => {
    render(
      <CategorySelector activeCategory="eco-direct" onChange={() => {}} />,
    );
    const hhDirect = screen.getByTestId('category-selector-hh-direct');
    const hhFood = screen.getByTestId('category-selector-hh-food');
    expect(hhDirect).toBeDisabled();
    expect(hhDirect).toHaveAttribute('aria-disabled', 'true');
    expect(hhDirect).toHaveAttribute(
      'title',
      expect.stringMatching(/Coming soon/i),
    );
    expect(hhFood).toBeDisabled();
    // Visible "Coming soon" affordance on each disabled button.
    expect(hhDirect.textContent).toMatch(/Coming soon/i);
    expect(hhFood.textContent).toMatch(/Coming soon/i);
  });

  it('does NOT fire onChange when a disabled HH button is clicked (PR-A2)', () => {
    const onChange = vi.fn();
    render(
      <CategorySelector activeCategory="eco-direct" onChange={onChange} />,
    );
    fireEvent.click(screen.getByTestId('category-selector-hh-direct'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('enables HH buttons when hhEnabled=true (PR-A4 phase)', () => {
    const onChange = vi.fn();
    render(
      <CategorySelector
        activeCategory="eco-direct"
        onChange={onChange}
        hhEnabled
      />,
    );
    const hhDirect = screen.getByTestId('category-selector-hh-direct');
    expect(hhDirect).not.toBeDisabled();
    expect(hhDirect).not.toHaveAttribute('aria-disabled');
    fireEvent.click(hhDirect);
    expect(onChange).toHaveBeenCalledWith('hh-direct');
  });

  it('fires onChange with the new id when an enabled button is clicked', () => {
    const onChange = vi.fn();
    render(
      <CategorySelector activeCategory="eco-direct" onChange={onChange} />,
    );
    fireEvent.click(screen.getByTestId('category-selector-eco-food'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('eco-food');
  });

  it('skips disabled HH buttons during arrow-key navigation (PR-A2)', () => {
    // With HH disabled, ArrowRight from the last enabled button (eco-food)
    // wraps to the first enabled button (eco-direct), NOT to hh-direct.
    const onChange = vi.fn();
    render(<CategorySelector activeCategory="eco-food" onChange={onChange} />);
    const ecoFood = screen.getByTestId('category-selector-eco-food');
    fireEvent.keyDown(ecoFood, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith('eco-direct');
  });

  it('cycles through enabled categories with ArrowLeft (PR-A2)', () => {
    const onChange = vi.fn();
    render(
      <CategorySelector activeCategory="eco-direct" onChange={onChange} />,
    );
    const ecoDirect = screen.getByTestId('category-selector-eco-direct');
    fireEvent.keyDown(ecoDirect, { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenLastCalledWith('eco-food');
  });

  it('applies roving tabindex: only the selected enabled button is tabbable', () => {
    render(<CategorySelector activeCategory="eco-food" onChange={() => {}} />);
    expect(
      screen.getByTestId('category-selector-eco-food'),
    ).toHaveAttribute('tabindex', '0');
    expect(
      screen.getByTestId('category-selector-eco-direct'),
    ).toHaveAttribute('tabindex', '-1');
    expect(
      screen.getByTestId('category-selector-hh-direct'),
    ).toHaveAttribute('tabindex', '-1');
  });

  it('Home jumps to the first enabled button and End to the last enabled (PR-A2)', () => {
    const onChange = vi.fn();
    render(<CategorySelector activeCategory="eco-food" onChange={onChange} />);
    const ecoFood = screen.getByTestId('category-selector-eco-food');
    fireEvent.keyDown(ecoFood, { key: 'Home' });
    expect(onChange).toHaveBeenLastCalledWith('eco-direct');
    fireEvent.keyDown(ecoFood, { key: 'End' });
    // With HH disabled in PR-A2, 'End' wraps to eco-food.
    expect(onChange).toHaveBeenLastCalledWith('eco-food');
  });

  // Codex review 2026-05-19 P2: the spec requires Space + Enter to activate.
  // Native browsers fire onClick on a focused button when Enter or Space is
  // pressed; jsdom does NOT simulate that. The component handles Enter +
  // Space explicitly in onKeyDown so the contract holds in both
  // environments. Dispatch real keyDown events and verify onChange fires.
  it('activates with Enter keyDown (keyboard contract)', () => {
    const onChange = vi.fn();
    render(
      <CategorySelector activeCategory="eco-direct" onChange={onChange} />,
    );
    const ecoFood = screen.getByTestId('category-selector-eco-food');
    fireEvent.keyDown(ecoFood, { key: 'Enter' });
    expect(onChange).toHaveBeenLastCalledWith('eco-food');
  });

  it('activates with Space keyDown (keyboard contract)', () => {
    const onChange = vi.fn();
    render(
      <CategorySelector activeCategory="eco-direct" onChange={onChange} />,
    );
    const ecoFood = screen.getByTestId('category-selector-eco-food');
    fireEvent.keyDown(ecoFood, { key: ' ' });
    expect(onChange).toHaveBeenLastCalledWith('eco-food');
  });

  it('still activates with mouse click (click path independent of keyboard)', () => {
    const onChange = vi.fn();
    render(
      <CategorySelector activeCategory="eco-direct" onChange={onChange} />,
    );
    fireEvent.click(screen.getByTestId('category-selector-eco-food'));
    expect(onChange).toHaveBeenLastCalledWith('eco-food');
  });

  it('PR-A4 phase: ArrowRight from hh-food wraps to eco-direct (all 4 enabled)', () => {
    const onChange = vi.fn();
    render(
      <CategorySelector
        activeCategory="hh-food"
        onChange={onChange}
        hhEnabled
      />,
    );
    const hhFood = screen.getByTestId('category-selector-hh-food');
    fireEvent.keyDown(hhFood, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith('eco-direct');
  });

  // Cursor-agent review 2026-05-19 P2 #1: defense-in-depth -- if a stale
  // localStorage value (or buggy parent) hands us activeCategory='hh-direct'
  // while hhEnabled=false, all buttons would resolve to tabIndex=-1 under
  // the naive rule and a keyboard-only user could not enter the radiogroup
  // at all. The component falls back to making the first enabled button
  // tabbable.
  it('falls back to first enabled button when activeCategory is disabled', () => {
    render(
      <CategorySelector activeCategory="hh-direct" onChange={() => {}} />,
    );
    expect(
      screen.getByTestId('category-selector-eco-direct'),
    ).toHaveAttribute('tabindex', '0');
    // No other button is tabbable.
    expect(
      screen.getByTestId('category-selector-eco-food'),
    ).toHaveAttribute('tabindex', '-1');
    expect(
      screen.getByTestId('category-selector-hh-direct'),
    ).toHaveAttribute('tabindex', '-1');
    expect(
      screen.getByTestId('category-selector-hh-food'),
    ).toHaveAttribute('tabindex', '-1');
  });

  it('renders the visible short labels expected by the 1x4 row spec', () => {
    render(
      <CategorySelector activeCategory="eco-direct" onChange={() => {}} />,
    );
    // Visible labels per plan v3 section 4.1 + v4 Delta 2.
    expect(
      screen.getByTestId('category-selector-eco-direct').textContent,
    ).toMatch(/Ecological: Direct Contact/);
    expect(
      screen.getByTestId('category-selector-eco-food').textContent,
    ).toMatch(/Ecological: Food Web/);
    expect(
      screen.getByTestId('category-selector-hh-direct').textContent,
    ).toMatch(/Human Health: Direct Contact/);
    expect(
      screen.getByTestId('category-selector-hh-food').textContent,
    ).toMatch(/Human Health: Food Web/);
  });
});
