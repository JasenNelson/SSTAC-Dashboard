// Component tests for CategorySelector (PR-A2).
// Plain ASCII only.

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import CategorySelector from '../CategorySelector';

describe('CategorySelector (PR-A4 phase: HH wire-up enabled by default)', () => {
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

  // PR-A4 HH wire-up enabled by default: hhEnabled defaults to true so
  // all four category buttons are interactive (HH categories route to the
  // HITL-reviewed placeholder panels in MatrixDashboard).
  it('enables HH buttons by default (PR-A4 HH wire-up enabled by default)', () => {
    const onChange = vi.fn();
    render(
      <CategorySelector activeCategory="eco-direct" onChange={onChange} />,
    );
    const hhDirect = screen.getByTestId('category-selector-hh-direct');
    const hhFood = screen.getByTestId('category-selector-hh-food');
    expect(hhDirect).not.toBeDisabled();
    expect(hhDirect).not.toHaveAttribute('aria-disabled');
    expect(hhDirect).not.toHaveAttribute('title');
    expect(hhFood).not.toBeDisabled();
    expect(hhFood).not.toHaveAttribute('aria-disabled');
    // No "Coming soon" affordance on enabled buttons.
    expect(hhDirect.textContent).not.toMatch(/Coming soon/i);
    expect(hhFood.textContent).not.toMatch(/Coming soon/i);
    // Click fires onChange with the HH id.
    fireEvent.click(hhDirect);
    expect(onChange).toHaveBeenCalledWith('hh-direct');
  });

  // Explicit hhEnabled=false preserves the PR-A2 disabled-by-default
  // behavior for any future caller that wants to gate HH again.
  it('disables HH buttons when hhEnabled=false (explicit PR-A2 opt-out) and surfaces tooltip + coming-soon label', () => {
    render(
      <CategorySelector
        activeCategory="eco-direct"
        onChange={() => {}}
        hhEnabled={false}
      />,
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
    expect(hhDirect.textContent).toMatch(/Coming soon/i);
    expect(hhFood.textContent).toMatch(/Coming soon/i);
  });

  it('does NOT fire onChange when a disabled HH button is clicked (hhEnabled=false)', () => {
    const onChange = vi.fn();
    render(
      <CategorySelector
        activeCategory="eco-direct"
        onChange={onChange}
        hhEnabled={false}
      />,
    );
    fireEvent.click(screen.getByTestId('category-selector-hh-direct'));
    expect(onChange).not.toHaveBeenCalled();
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

  it('skips disabled HH buttons during arrow-key navigation (hhEnabled=false)', () => {
    // PR-A4 HH wire-up enabled by default flipped hhEnabled's default
    // true; to exercise the disabled-skip path we pass hhEnabled={false}
    // explicitly. ArrowRight from the last enabled button (eco-food)
    // wraps to the first enabled button (eco-direct), NOT to hh-direct.
    const onChange = vi.fn();
    render(
      <CategorySelector
        activeCategory="eco-food"
        onChange={onChange}
        hhEnabled={false}
      />,
    );
    const ecoFood = screen.getByTestId('category-selector-eco-food');
    fireEvent.keyDown(ecoFood, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith('eco-direct');
  });

  it('PR-A4 HH wire-up enabled by default: ArrowRight from eco-food advances to hh-direct (all 4 enabled)', () => {
    const onChange = vi.fn();
    render(<CategorySelector activeCategory="eco-food" onChange={onChange} />);
    const ecoFood = screen.getByTestId('category-selector-eco-food');
    fireEvent.keyDown(ecoFood, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith('hh-direct');
  });

  it('cycles through enabled categories with ArrowLeft (hhEnabled=false)', () => {
    const onChange = vi.fn();
    render(
      <CategorySelector
        activeCategory="eco-direct"
        onChange={onChange}
        hhEnabled={false}
      />,
    );
    const ecoDirect = screen.getByTestId('category-selector-eco-direct');
    fireEvent.keyDown(ecoDirect, { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenLastCalledWith('eco-food');
  });

  it('PR-A4 HH wire-up enabled by default: ArrowLeft from eco-direct wraps to hh-food (all 4 enabled)', () => {
    const onChange = vi.fn();
    render(
      <CategorySelector activeCategory="eco-direct" onChange={onChange} />,
    );
    const ecoDirect = screen.getByTestId('category-selector-eco-direct');
    fireEvent.keyDown(ecoDirect, { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenLastCalledWith('hh-food');
  });

  it('applies roving tabindex: only the selected enabled button is tabbable', () => {
    render(<CategorySelector activeCategory="eco-food" onChange={() => {}} />);
    expect(
      screen.getByTestId('category-selector-eco-food'),
    ).toHaveAttribute('tabindex', '0');
    expect(
      screen.getByTestId('category-selector-eco-direct'),
    ).toHaveAttribute('tabindex', '-1');
    // Roving tabindex: enabled but non-selected HH buttons are -1 too;
    // only the selected enabled button gets tabindex=0.
    expect(
      screen.getByTestId('category-selector-hh-direct'),
    ).toHaveAttribute('tabindex', '-1');
    expect(
      screen.getByTestId('category-selector-hh-food'),
    ).toHaveAttribute('tabindex', '-1');
  });

  it('Home jumps to the first enabled button and End to the last enabled (hhEnabled=false)', () => {
    const onChange = vi.fn();
    render(
      <CategorySelector
        activeCategory="eco-food"
        onChange={onChange}
        hhEnabled={false}
      />,
    );
    const ecoFood = screen.getByTestId('category-selector-eco-food');
    fireEvent.keyDown(ecoFood, { key: 'Home' });
    expect(onChange).toHaveBeenLastCalledWith('eco-direct');
    fireEvent.keyDown(ecoFood, { key: 'End' });
    // With HH disabled, 'End' wraps to eco-food.
    expect(onChange).toHaveBeenLastCalledWith('eco-food');
  });

  it('PR-A4 HH wire-up enabled by default: End jumps to hh-food (last enabled of all four)', () => {
    const onChange = vi.fn();
    render(<CategorySelector activeCategory="eco-direct" onChange={onChange} />);
    const ecoDirect = screen.getByTestId('category-selector-eco-direct');
    fireEvent.keyDown(ecoDirect, { key: 'End' });
    expect(onChange).toHaveBeenLastCalledWith('hh-food');
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
  // tabbable. PR-A4 HH wire-up enabled by default flipped the default, so
  // this disabled-fallback path is exercised with explicit hhEnabled={false}.
  it('falls back to first enabled button when activeCategory is disabled (hhEnabled=false)', () => {
    render(
      <CategorySelector
        activeCategory="hh-direct"
        onChange={() => {}}
        hhEnabled={false}
      />,
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
