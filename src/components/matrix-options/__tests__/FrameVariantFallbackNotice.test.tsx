// Component tests for FrameVariantFallbackNotice.
// 5 tests covering full render surface.
// Plain ASCII only.

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import FrameVariantFallbackNotice from '../FrameVariantFallbackNotice';

describe('FrameVariantFallbackNotice', () => {
  it('T1: renders nothing when usedBaselineFallback is false', () => {
    const { container } = render(
      <FrameVariantFallbackNotice usedBaselineFallback={false} />,
    );
    expect(container.firstChild).toBeNull();
    expect(document.querySelector('[role="note"]')).toBeNull();
  });

  it('T2: renders default copy when usedBaselineFallback is true and no reason provided', () => {
    render(<FrameVariantFallbackNotice usedBaselineFallback={true} />);
    const notice = screen.getByRole('note');
    expect(notice).toBeInTheDocument();
    expect(notice.textContent).toMatch(/BC Protocol 1 v5 DRA baseline equation/);
    expect(notice.textContent).toMatch(
      /This frame has no specialized equation for this pathway/,
    );
  });

  it('T3: renders custom fallbackReason and suppresses the generic default sentence', () => {
    render(
      <FrameVariantFallbackNotice
        usedBaselineFallback={true}
        fallbackReason="CCME does not specify a method for this pathway"
      />,
    );
    const notice = screen.getByRole('note');
    expect(notice).toBeInTheDocument();
    expect(notice.textContent).toMatch(
      /CCME does not specify a method for this pathway/,
    );
    expect(notice.textContent).not.toMatch(
      /This frame has no specialized equation/,
    );
  });

  it('T4: applies className override to the notice container', () => {
    render(
      <FrameVariantFallbackNotice
        usedBaselineFallback={true}
        className="mt-10 test-override-class"
      />,
    );
    const notice = screen.getByRole('note');
    expect(notice.classList.contains('test-override-class')).toBe(true);
  });

  it('T5: renders exactly one element with role="note" containing readable text', () => {
    render(<FrameVariantFallbackNotice usedBaselineFallback={true} />);
    const notes = document.querySelectorAll('[role="note"]');
    expect(notes.length).toBe(1);
    expect((notes[0] as HTMLElement).textContent?.length ?? 0).toBeGreaterThan(0);
  });
});
