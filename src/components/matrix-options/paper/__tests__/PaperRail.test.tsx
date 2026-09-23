import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  PAPER_LEFT_RAIL_OPEN_WIDTH,
  PAPER_RAIL_CLOSED_CLASSES,
  PAPER_RIGHT_RAIL_OPEN_WIDTH,
  PaperRail,
  PaperRailToggle,
  paperRailClassName,
} from '../PaperRail';

/*
 * DECOUPLED 2026-09-22 (owner brief, see PaperRail.tsx header comment): the
 * rails no longer copy MatrixDashboard's fixed lg:w-80 / lg:w-96 classes.
 * Open rails take their width from the CSS custom properties
 * --paper-left-width / --paper-right-width; PaperRailDrift.test.ts pins that
 * contract structurally. This file keeps asserting the rail's own behavior:
 * open/closed class shape, inert, aria wiring, the Escape gesture-safety
 * guard, and the toggle contract.
 */
describe('PaperRail', () => {
  it('renders an open left rail with the width-var open classes, no height cap, and no inert', () => {
    render(<PaperRail id="left" side="left" open heading="Navigation" headingId="left-heading" testId="rail">content</PaperRail>);
    const rail = screen.getByTestId('rail');
    expect(rail.tagName).toBe('ASIDE');
    expect(rail).toHaveClass('w-full', PAPER_LEFT_RAIL_OPEN_WIDTH, 'border-b', 'lg:border-r', 'overflow-hidden', 'motion-reduce:transition-none', 'print:hidden');
    expect(rail.className).not.toMatch(/max-h-/);
    expect(rail).not.toHaveAttribute('inert');
    expect(rail).toHaveAttribute('data-state', 'open');
    expect(rail).toHaveAttribute('aria-labelledby', 'left-heading');
    const heading = screen.getByRole('heading', { name: 'Navigation', level: 2 });
    expect(heading).toHaveAttribute('id', 'left-heading');
    expect(heading).toHaveAttribute('tabindex', '-1');
    expect(rail.firstElementChild).toHaveClass('w-full', 'min-w-0', PAPER_LEFT_RAIL_OPEN_WIDTH);
  });

  it('derives the panel heading scroll margin from the measured sticky header height', () => {
    render(<PaperRail id="left" side="left" open heading="Navigation" headingId="left-heading" testId="rail">content</PaperRail>);
    const heading = screen.getByRole('heading', { name: 'Navigation', level: 2 });
    // The layout header is sticky and its height depends on width and content (129px
    // at 360, 77px at 768 in browser run-001), so a fixed scroll-mt-24 left the
    // revealed panel heading underneath it. RevisedPaperWorkspace measures the header
    // and publishes --paper-sticky-header-height for this class to consume.
    expect(heading).toHaveClass('scroll-mt-[calc(var(--paper-sticky-header-height,6rem)+0.5rem)]');
    expect(heading.className).not.toMatch(/scroll-mt-24/);
  });

  it('collapses a closed left rail by height below lg and by width at lg, and makes it inert', () => {
    render(<PaperRail id="left" side="left" open={false} heading="Navigation" headingId="left-heading" testId="rail">content</PaperRail>);
    const rail = screen.getByTestId('rail');
    for (const token of PAPER_RAIL_CLOSED_CLASSES.split(' ')) expect(rail).toHaveClass(token);
    expect(rail).not.toHaveClass('border-b', PAPER_LEFT_RAIL_OPEN_WIDTH);
    expect(rail).toHaveAttribute('inert');
    expect(rail).toHaveAttribute('data-state', 'closed');
  });

  it('uses the right-rail contract with the right-width CSS variable', () => {
    const open = paperRailClassName('right', true).split(' ');
    expect(open).toEqual(expect.arrayContaining(['w-full', PAPER_RIGHT_RAIL_OPEN_WIDTH, 'border-t', 'lg:border-t-0', 'lg:border-l', 'print:hidden']));
    const closed = paperRailClassName('right', false).split(' ');
    for (const token of PAPER_RAIL_CLOSED_CLASSES.split(' ')) expect(closed).toContain(token);
    expect(closed).not.toContain(PAPER_RIGHT_RAIL_OPEN_WIDTH);
    render(<PaperRail id="right" side="right" open heading="Review Comments" headingId="right-heading" testId="rail">content</PaperRail>);
    expect(screen.getByTestId('rail').firstElementChild).toHaveClass('w-full', PAPER_RIGHT_RAIL_OPEN_WIDTH);
  });

  it('calls onEscape only for an unhandled Escape inside an open rail and outside a select', () => {
    const onEscape = vi.fn();
    const { rerender } = render(<PaperRail id="left" side="left" open heading="Navigation" headingId="h" testId="rail" onEscape={onEscape}><button type="button">inside</button><select aria-label="choice"><option>a</option></select></PaperRail>);
    expect(fireEvent.keyDown(screen.getByRole('button', { name: 'inside' }), { key: 'Escape' })).toBe(false);
    expect(onEscape).toHaveBeenCalledTimes(1);
    expect(fireEvent.keyDown(screen.getByRole('combobox', { name: 'choice' }), { key: 'Escape' })).toBe(true);
    expect(fireEvent.keyDown(screen.getByRole('button', { name: 'inside' }), { key: 'Tab' })).toBe(true);
    expect(onEscape).toHaveBeenCalledTimes(1);
    rerender(<PaperRail id="left" side="left" open={false} heading="Navigation" headingId="h" testId="rail" onEscape={onEscape}><button type="button">inside</button></PaperRail>);
    expect(fireEvent.keyDown(screen.getByTestId('rail'), { key: 'Escape' })).toBe(true);
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('renders toggles with a text name, 44px target, aria-expanded, aria-controls, and the active/inactive token contract', () => {
    const onClick = vi.fn();
    const { rerender } = render(<PaperRailToggle label="Navigation" open controls="rail-id" icon={<svg aria-hidden="true" />} onClick={onClick} testId="nav-toggle" />);
    const toggle = screen.getByRole('button', { name: 'Navigation' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveAttribute('aria-controls', 'rail-id');
    expect(toggle).toHaveAttribute('data-testid', 'nav-toggle');
    expect(toggle).not.toHaveAttribute('aria-pressed');
    expect(toggle).toHaveClass('flex', 'min-h-[44px]', 'bg-[var(--db-accent-tint)]', 'text-[var(--db-text-primary)]');
    expect(toggle).not.toHaveClass('text-[var(--db-text-secondary)]');
    fireEvent.click(toggle);
    expect(onClick).toHaveBeenCalledTimes(1);
    rerender(<PaperRailToggle label="Navigation" open={false} controls="rail-id" icon={<svg aria-hidden="true" />} onClick={onClick} testId="nav-toggle" />);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveClass('text-[var(--db-text-secondary)]');
    expect(toggle).not.toHaveClass('bg-[var(--db-accent-tint)]');
  });

  it('hides the toggle label text between lg and xl but keeps it as the accessible name', () => {
    render(<PaperRailToggle label="Review Comments" open controls="rail-id" icon={<svg aria-hidden="true" />} onClick={vi.fn()} />);
    // Still findable by accessible name even while visually hidden lg..xl.
    const toggle = screen.getByRole('button', { name: 'Review Comments' });
    const label = within(toggle).getByText('Review Comments');
    expect(label).toHaveClass('lg:sr-only', 'xl:not-sr-only');
  });
});
