import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PaperRail, PaperRailToggle, paperRailClassName } from '../PaperRail';

describe('PaperRail', () => {
  it('renders an open left rail with the Catalogue open classes, no height cap, and no inert', () => {
    render(<PaperRail id="left" side="left" open heading="Navigation" headingId="left-heading" testId="rail">content</PaperRail>);
    const rail = screen.getByTestId('rail');
    expect(rail.tagName).toBe('ASIDE');
    expect(rail).toHaveClass('w-full', 'p-6', 'lg:w-80', 'border-b', 'lg:border-r', 'overflow-hidden', 'motion-reduce:transition-none', 'print:hidden');
    expect(rail.className).not.toMatch(/max-h-/);
    expect(rail).not.toHaveAttribute('inert');
    expect(rail).toHaveAttribute('data-state', 'open');
    expect(rail).toHaveAttribute('aria-labelledby', 'left-heading');
    const heading = screen.getByRole('heading', { name: 'Navigation', level: 2 });
    expect(heading).toHaveAttribute('id', 'left-heading');
    expect(heading).toHaveAttribute('tabindex', '-1');
    expect(rail.firstElementChild).toHaveClass('w-full', 'min-w-0', 'lg:min-w-[270px]');
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
    expect(rail).toHaveClass('max-h-0', 'w-full', 'border-b-0', 'p-0', 'lg:max-h-none', 'lg:w-0');
    expect(rail).not.toHaveClass('p-6', 'lg:w-80', 'border-b');
    expect(rail).toHaveAttribute('inert');
    expect(rail).toHaveAttribute('data-state', 'closed');
  });

  it('uses the right-rail contract with the Calculator width', () => {
    expect(paperRailClassName('right', true).split(' ')).toEqual(expect.arrayContaining(['w-full', 'lg:w-96', 'border-t', 'lg:border-t-0', 'lg:border-l', 'shadow-2xl', 'print:hidden']));
    const closed = paperRailClassName('right', false).split(' ');
    expect(closed).toEqual(expect.arrayContaining(['max-h-0', 'w-full', 'border-t-0', 'lg:max-h-none', 'lg:w-0']));
    expect(closed).not.toContain('lg:w-96');
    render(<PaperRail id="right" side="right" open heading="Review Comments" headingId="right-heading" testId="rail">content</PaperRail>);
    expect(screen.getByTestId('rail').firstElementChild).toHaveClass('w-full', 'lg:w-[384px]');
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

  it('renders toggles with a text name, 44px target, aria-expanded, aria-controls, and the active or inactive contract', () => {
    const onClick = vi.fn();
    const { rerender } = render(<PaperRailToggle label="Navigation" open controls="rail-id" icon={<svg aria-hidden="true" />} onClick={onClick} />);
    const toggle = screen.getByRole('button', { name: 'Navigation' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveAttribute('aria-controls', 'rail-id');
    expect(toggle).not.toHaveAttribute('aria-pressed');
    expect(toggle).toHaveClass('flex', 'min-h-[44px]', 'focus-visible:ring-sky-500', 'bg-sky-50', 'text-sky-700');
    expect(toggle).not.toHaveClass('border', 'bg-white');
    fireEvent.click(toggle);
    expect(onClick).toHaveBeenCalledTimes(1);
    rerender(<PaperRailToggle label="Navigation" open={false} controls="rail-id" icon={<svg aria-hidden="true" />} onClick={onClick} />);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveClass('border', 'border-slate-200', 'bg-white', 'text-slate-700', 'shadow-xs');
    expect(toggle).not.toHaveClass('bg-sky-50');
  });
});
