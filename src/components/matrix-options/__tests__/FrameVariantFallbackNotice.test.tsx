// Component tests for FrameVariantFallbackNotice.
// Covers both guard branches: the notice is suppressed for the default
// baseline frame (bc-protocol1-v5-dra) even when usedBaselineFallback is
// true, and it renders for a NON-default frame that fell back to baseline.
// Plain ASCII only.

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import FrameVariantFallbackNotice from '../FrameVariantFallbackNotice';
import { DEFAULT_REGULATORY_FRAME_ID } from '@/lib/matrix-options/regulatoryFrames';

// A frame that is guaranteed NOT to be the default baseline frame, used to
// exercise the "render the notice" branch.
const NON_DEFAULT_FRAME = 'us-epa-usace-sediment' as const;

describe('FrameVariantFallbackNotice', () => {
  it('T1: renders nothing when usedBaselineFallback is false', () => {
    const { container } = render(
      <FrameVariantFallbackNotice
        usedBaselineFallback={false}
        frameId={NON_DEFAULT_FRAME}
      />,
    );
    expect(container.firstChild).toBeNull();
    expect(document.querySelector('[role="note"]')).toBeNull();
  });

  it('T1b: renders nothing for the default baseline frame even when usedBaselineFallback is true', () => {
    const { container } = render(
      <FrameVariantFallbackNotice
        usedBaselineFallback={true}
        frameId={DEFAULT_REGULATORY_FRAME_ID}
      />,
    );
    expect(container.firstChild).toBeNull();
    expect(document.querySelector('[role="note"]')).toBeNull();
  });

  it('T2: renders default copy for a non-default frame when usedBaselineFallback is true and no reason provided', () => {
    render(
      <FrameVariantFallbackNotice
        usedBaselineFallback={true}
        frameId={NON_DEFAULT_FRAME}
      />,
    );
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
        frameId={NON_DEFAULT_FRAME}
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
        frameId={NON_DEFAULT_FRAME}
        className="mt-10 test-override-class"
      />,
    );
    const notice = screen.getByRole('note');
    expect(notice.classList.contains('test-override-class')).toBe(true);
  });

  it('T5: renders exactly one element with role="note" containing readable text', () => {
    render(
      <FrameVariantFallbackNotice
        usedBaselineFallback={true}
        frameId={NON_DEFAULT_FRAME}
      />,
    );
    const notes = document.querySelectorAll('[role="note"]');
    expect(notes.length).toBe(1);
    expect((notes[0] as HTMLElement).textContent?.length ?? 0).toBeGreaterThan(0);
  });
});
