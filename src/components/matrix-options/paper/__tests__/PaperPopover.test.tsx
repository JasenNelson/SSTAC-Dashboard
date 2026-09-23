import { useRef, useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  computePopoverPlacement,
  PAPER_POPOVER_MARGIN_PX,
  PAPER_POPOVER_SHEET_MAX_WIDTH_PX,
  PaperPopover,
} from '../PaperPopover';

describe('computePopoverPlacement', () => {
  const viewport = { width: 1200, height: 800 };
  const popover = { width: 360, height: 200 };

  it('places below the trigger when there is enough room below', () => {
    const trigger = { top: 50, bottom: 70, left: 500, width: 100 };
    const placement = computePopoverPlacement(trigger, popover, viewport);
    expect(placement.side).toBe('below');
    expect(placement.sheet).toBe(false);
    expect(placement.top).toBe(trigger.bottom + PAPER_POPOVER_MARGIN_PX);
  });

  it('flips above the trigger when there is not enough room below but more room above', () => {
    const trigger = { top: 750, bottom: 770, left: 500, width: 100 };
    const placement = computePopoverPlacement(trigger, popover, viewport);
    expect(placement.side).toBe('above');
    expect(placement.sheet).toBe(false);
    // top = trigger.top - gap - height (height is the full popover height here, since it fits).
    expect(placement.top).toBe(trigger.top - PAPER_POPOVER_MARGIN_PX - popover.height);
  });

  it('clamps to the 8px right margin when the trigger sits near the right edge', () => {
    const trigger = { top: 50, bottom: 70, left: 1150, width: 40 };
    const placement = computePopoverPlacement(trigger, popover, viewport);
    expect(placement.left).toBe(viewport.width - placement.width - PAPER_POPOVER_MARGIN_PX);
  });

  it('clamps to the 8px left margin when the trigger sits near the left edge (off-screen centring)', () => {
    const trigger = { top: 50, bottom: 70, left: -100, width: 40 };
    const placement = computePopoverPlacement(trigger, popover, viewport);
    expect(placement.left).toBe(PAPER_POPOVER_MARGIN_PX);
  });

  it('switches to a full-width sheet under the 640px breakpoint', () => {
    const narrowViewport = { width: 500, height: 800 };
    const trigger = { top: 50, bottom: 90, left: 100, width: 200 };
    const placement = computePopoverPlacement(trigger, popover, narrowViewport);
    expect(narrowViewport.width).toBeLessThan(PAPER_POPOVER_SHEET_MAX_WIDTH_PX);
    expect(placement.sheet).toBe(true);
    expect(placement.side).toBe('below');
    expect(placement.left).toBe(PAPER_POPOVER_MARGIN_PX);
    expect(placement.width).toBe(narrowViewport.width - PAPER_POPOVER_MARGIN_PX * 2);
    expect(placement.top).toBe(trigger.bottom + PAPER_POPOVER_MARGIN_PX);
  });

  it('a wide-enough viewport at exactly the breakpoint is NOT a sheet (two-sided: the < comparison, not <=)', () => {
    const trigger = { top: 50, bottom: 70, left: 100, width: 100 };
    const placement = computePopoverPlacement(trigger, popover, { width: PAPER_POPOVER_SHEET_MAX_WIDTH_PX, height: 800 });
    expect(placement.sheet).toBe(false);
  });
});

function Harness({ open, onClose }: { readonly open: boolean; readonly onClose: (reason: 'escape' | 'outside' | 'blur' | 'action') => void }) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <div>
      <button ref={triggerRef} type="button">Open popover</button>
      <PaperPopover id="popover-id" open={open} triggerRef={triggerRef} label="Test popover" onClose={onClose} testId="popover">
        <button type="button">Inside action</button>
      </PaperPopover>
    </div>
  );
}

describe('PaperPopover', () => {
  it('renders nothing when closed', () => {
    render(<Harness open={false} onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders into document.body with role dialog and the given accessible name', () => {
    render(<Harness open onClose={vi.fn()} />);
    const dialog = screen.getByRole('dialog', { name: 'Test popover' });
    expect(dialog).toHaveAttribute('data-testid', 'popover');
    expect(dialog.parentElement).toBe(document.body);
  });

  it('Escape calls onClose("escape") and returns focus to the trigger', () => {
    const onClose = vi.fn();
    render(<Harness open onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledWith('escape');
    expect(screen.getByRole('button', { name: 'Open popover' })).toHaveFocus();
  });

  it('a pointerdown outside the popover and the trigger calls onClose("outside")', () => {
    const onClose = vi.fn();
    render(<Harness open onClose={onClose} />);
    fireEvent.pointerDown(document.body);
    expect(onClose).toHaveBeenCalledWith('outside');
  });

  it('a pointerdown on the trigger does not call onClose', () => {
    const onClose = vi.fn();
    render(<Harness open onClose={onClose} />);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Open popover' }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('a pointerdown inside the popover panel does not call onClose', () => {
    const onClose = vi.fn();
    render(<Harness open onClose={onClose} />);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Inside action' }));
    expect(onClose).not.toHaveBeenCalled();
  });
});

/** A child whose own state proves whether it stayed mounted across a close. */
function StatefulCounter() {
  const [count, setCount] = useState(0);
  return <button type="button" data-testid="counter" onClick={() => setCount((value) => value + 1)}>{count}</button>;
}

function KeepMountedHarness({ open, keepMounted }: { readonly open: boolean; readonly keepMounted: boolean }) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <div>
      <button ref={triggerRef} type="button">Open popover</button>
      <PaperPopover id="popover-id" open={open} triggerRef={triggerRef} label="Test popover" onClose={() => {}} testId="popover" keepMounted={keepMounted}>
        <StatefulCounter />
      </PaperPopover>
    </div>
  );
}

describe('PaperPopover keepMounted', () => {
  // (b) Two-sided: if keepMounted ever stopped keeping the panel in the DOM
  // while closed, the counter would unmount and this reopen would read '0'
  // instead of the '1' clicked before closing.
  it('(b) keepMounted keeps a child mounted (its state survives) across close and reopen', () => {
    const { rerender } = render(<KeepMountedHarness open keepMounted />);
    fireEvent.click(screen.getByTestId('counter'));
    expect(screen.getByTestId('counter')).toHaveTextContent('1');

    rerender(<KeepMountedHarness open={false} keepMounted />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // Still in the DOM (hidden/inert), so its state was never torn down.
    expect(screen.getByTestId('counter')).toHaveTextContent('1');

    rerender(<KeepMountedHarness open keepMounted />);
    expect(screen.getByTestId('counter')).toHaveTextContent('1');
  });

  // (b) Two-sided: if keepMounted={false} ever left the panel mounted while
  // closed (the pre-fix behaviour for every popover), the counter would still
  // read '1' here instead of being gone from the document.
  it('(b) without keepMounted, closing unmounts the child (its state is lost)', () => {
    const { rerender } = render(<KeepMountedHarness open keepMounted={false} />);
    fireEvent.click(screen.getByTestId('counter'));
    expect(screen.getByTestId('counter')).toHaveTextContent('1');

    rerender(<KeepMountedHarness open={false} keepMounted={false} />);
    expect(screen.queryByTestId('counter')).not.toBeInTheDocument();

    rerender(<KeepMountedHarness open keepMounted={false} />);
    // Remounted fresh: back to its initial state.
    expect(screen.getByTestId('counter')).toHaveTextContent('0');
  });
});
