// FrameVariantFallbackNotice.tsx
// Sibling to RegulatoryFrameNotice. Renders a muted notice when the
// equation dispatch layer fell back to the BC Protocol 1 v5 DRA baseline
// because the selected regulatory frame has no defined variant for this
// pathway. Renders null when usedBaselineFallback is false.
//
// Design authority: docs/PHASE_4_FRAME_VARIANT_FALLBACK_NOTICE_SPEC.md
// See docs/STREAM_C_EQUATION_DISPATCH_DESIGN.md Section 3.3 for placement.
// Plain ASCII only.

import { memo } from 'react';
import { cn } from '@/utils/cn';
import {
  DEFAULT_REGULATORY_FRAME_ID,
  type RegulatoryFrameId,
} from '@/lib/matrix-options/regulatoryFrames';

interface FrameVariantFallbackNoticeProps {
  /**
   * True when getEquation() returned the baseline variant because no
   * frame-specific variant is defined for this frame+pathway pair.
   * When false, the component renders null (zero DOM cost).
   *
   * Required (not optional) so every call site is forced to forward the
   * value from getEquation() rather than silently omitting it.
   */
  usedBaselineFallback: boolean;

  /**
   * The currently selected regulatory frame. When this is the default
   * baseline frame (bc-protocol1-v5-dra), the notice is suppressed even if
   * usedBaselineFallback is true: the baseline frame using the baseline
   * equation is the expected state, not a fallback worth flagging. Required
   * so every call site forwards the selected frame.
   */
  frameId: RegulatoryFrameId;

  /**
   * Optional human-readable explanation returned by getEquation() in its
   * fallbackReason field. When omitted, a generic default sentence is used.
   * Sourced from equationDispatch.ts resolveBaselineFallbackReason().
   */
  fallbackReason?: string;

  /**
   * Optional Tailwind className override for layout adjustments.
   * Follows the same pattern as RegulatoryFrameNotice (line 14 of
   * RegulatoryFrameNotice.tsx).
   */
  className?: string;
}

/**
 * FrameVariantFallbackNotice
 *
 * Renders null when usedBaselineFallback is false (a frame+pathway that has a
 * defined variant) OR when the selected frameId is the default baseline frame
 * (bc-protocol1-v5-dra). The baseline frame using the baseline equation is the
 * expected, unremarkable state -- flagging it as a "fallback" is noise. The
 * notice is therefore reserved for a NON-baseline frame that had no specialized
 * variant and silently fell back to the baseline equation. Once a non-baseline
 * frame ships a variant, usedBaselineFallback becomes false and the notice
 * renders null for that frame too.
 *
 * When usedBaselineFallback is true and the frame is non-default, renders a
 * compact muted slate notice block informing the HITL that the result on screen
 * is the BC Protocol 1 baseline, not a frame-specific derivation.
 *
 * Uses role="note" (not role="status") because the fallback state is static
 * during a calculation session and does not need a live-region interrupt
 * announcement. See component spec section 3 (Accessibility) for rationale.
 *
 * Memoized for stability: the component re-renders only when
 * usedBaselineFallback, fallbackReason, or className changes.
 */
const FrameVariantFallbackNotice = memo(function FrameVariantFallbackNotice({
  usedBaselineFallback,
  frameId,
  fallbackReason,
  className,
}: FrameVariantFallbackNoticeProps) {
  if (!usedBaselineFallback || frameId === DEFAULT_REGULATORY_FRAME_ID) {
    return null;
  }

  return (
    <div
      role="note"
      data-testid="frame-variant-fallback-notice"
      className={cn(
        'mt-2 mb-5 rounded-md border border-slate-200 bg-slate-50',
        'px-4 py-2.5 text-xs text-slate-600',
        'dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400',
        className,
      )}
    >
      <p>
        {'Using BC Protocol 1 v5 DRA baseline equation. '}
        {fallbackReason ?? 'This frame has no specialized equation for this pathway.'}
      </p>
    </div>
  );
});

export default FrameVariantFallbackNotice;
