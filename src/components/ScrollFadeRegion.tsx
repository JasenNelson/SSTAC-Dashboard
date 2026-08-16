'use client';

// Shared scroll-fade affordance for overflow-x-auto regions (decision #2,
// docs/UI_DECISIONS_2026_08_15.md). Wraps children in a horizontally
// scrollable container, runtime-checks whether the content actually
// overflows (scrollWidth > clientWidth), and only then renders a trailing
// gradient mask plus a small caption. The caption/gradient disappear again
// once content fits (e.g. on a wider viewport), per the decision text.
//
// jsdom has no layout engine: scrollWidth/clientWidth are always 0 there,
// so this component's overflow branch cannot be exercised by a real render
// in Vitest -- tests must stub those two properties on the scroll container
// before/after mount. See __tests__/ScrollFadeRegion.test.tsx.

import { useEffect, useRef, useState, type ReactNode } from 'react';

interface ScrollFadeRegionProps {
  children: ReactNode;
  /** Extra classes applied to the scrollable inner container (e.g. existing border/rounded chrome). */
  className?: string;
  /** Caption shown under the region while it overflows. */
  captionText?: string;
  /**
   * Tailwind `from-*`/`dark:from-*` classes for the trailing fade gradient, so it matches
   * the ACTUAL surface this instance is painted on rather than a hardcoded guess. A shared
   * component cannot assume every caller sits on the same background (P2-4): the default
   * below matches the common bg-white / dark:bg-slate-900 surface, but callers on a
   * different surface (e.g. dark:bg-slate-950) MUST override it or the fade paints a
   * visible mismatched stripe in dark mode.
   */
  fadeFrom?: string;
  /**
   * P3-1 fix: when true, aria-hidden AND tabIndex={-1} are applied to the scroll
   * container itself (not an ancestor wrapper). A caller that hides this region from
   * AT because an equivalent sr-only table already covers the content (e.g.
   * Phase2GanttChart) must not simply wrap the whole region in an outer
   * `aria-hidden="true"` div: Chrome 127+ makes any `overflow-x-auto` container with
   * no focusable children implicitly tabbable, so an outer wrapper leaves a
   * keyboard-focusable element inside a hidden subtree (axe `aria-hidden-focus`).
   * Setting aria-hidden + tabIndex={-1} directly on the scroll container hides the
   * same content from AT while also removing it from the tab order.
   */
  ariaHidden?: boolean;
}

export default function ScrollFadeRegion({
  children,
  className = '',
  captionText = 'Swipe to see more',
  fadeFrom = 'from-white dark:from-slate-900',
  ariaHidden = false,
}: ScrollFadeRegionProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // P3-2 fix: hasOverflow alone painted the trailing fade FOREVER once a region
  // overflowed, even after the user scrolled all the way right -- the last ~20px
  // of the final column stayed washed out with no way to reveal it. Track actual
  // scroll position so each edge's fade shows only while there is more content
  // in that direction (symmetric: a leading fade appears once scrolled away from
  // the start too).
  const [scrollState, setScrollState] = useState({
    hasOverflow: false,
    atStart: true,
    atEnd: true,
  });

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;

    const checkOverflow = () => {
      const hasOverflow = el.scrollWidth > el.clientWidth;
      const atStart = el.scrollLeft <= 0;
      // 1px tolerance: fractional scroll positions (subpixel zoom/DPR) can leave
      // scrollLeft + clientWidth a hair short of scrollWidth at the true end.
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
      setScrollState({ hasOverflow, atStart, atEnd });
    };

    checkOverflow();

    // Round-2 P2-3: the previous comment claimed a ResizeObserver on the scroll
    // CONTAINER also catches "size changes caused by children content changing".
    // It does not. The container is width-constrained by its parent, so its own
    // border box never changes when the content inside it grows -- only
    // `scrollWidth` does. Concretely: the Sources table (EvidenceLibrary,
    // `min-w-full`, auto layout) gains longer source names after a filter change,
    // starts overflowing, and with container-only observation nothing re-checks,
    // so the fade and the "Swipe to see more" caption never appear on a table
    // with genuinely hidden columns -- exactly the round-1 P1-1 failure mode.
    //
    // Chosen fix: observe the CONTENT element (the scroll container's first
    // element child -- the table / grid / equation that actually resizes) in
    // addition to the container, and use a MutationObserver to (a) re-point that
    // observation when React swaps the child out and (b) catch content changes
    // that alter scrollWidth without resizing the observed child's own box.
    // Rejected alternatives: `[children]` (round-1's version) rebuilt both
    // observers on every parent render -- per-render churn; a polling
    // requestAnimationFrame loop is unbounded work for a passive affordance.
    // The MutationObserver is scoped to the scroll container only, and the
    // fade/caption it can toggle render as SIBLINGS outside that container, so
    // there is no observe -> render -> observe feedback loop.
    let resizeObserver: ResizeObserver | null = null;
    let observedChild: Element | null = null;

    const syncChildObservation = () => {
      const child = el.firstElementChild;
      if (child === observedChild) return;
      if (observedChild) resizeObserver?.unobserve(observedChild);
      observedChild = child;
      if (observedChild) resizeObserver?.observe(observedChild);
    };

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(checkOverflow);
      resizeObserver.observe(el);
      syncChildObservation();
    }

    let mutationObserver: MutationObserver | null = null;
    if (typeof MutationObserver !== 'undefined') {
      mutationObserver = new MutationObserver(() => {
        syncChildObservation();
        checkOverflow();
      });
      mutationObserver.observe(el, {
        childList: true,
        subtree: true,
        characterData: true,
      });
    }

    window.addEventListener('resize', checkOverflow);

    return () => {
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      window.removeEventListener('resize', checkOverflow);
    };
    // Empty dep array is still correct: both observers are content-aware now, so
    // `children` is not needed as a re-run trigger and re-adding it would only
    // reintroduce the per-render teardown/rebuild churn.
  }, []);

  const { hasOverflow, atStart, atEnd } = scrollState;
  const showRightFade = hasOverflow && !atEnd;
  const showLeftFade = hasOverflow && !atStart;

  return (
    <div className="relative" data-testid="scroll-fade-region">
      {/* Inner wrapper scopes the fade gradients' top-0/bottom-0 to the scroll
          container's own box only. Previously the gradients were absolutely
          positioned against the OUTER relative wrapper, which also contains the
          caption `<p>` below -- so top-0/bottom-0 spanned down through the
          caption too, and a positioned gradient paints above that static inline
          text, washing out the right end of "Swipe to see more". */}
      <div className="relative">
        <div
          ref={scrollRef}
          className={`overflow-x-auto ${className}`.trim()}
          aria-hidden={ariaHidden || undefined}
          tabIndex={ariaHidden ? -1 : undefined}
          onScroll={() => {
            const el = scrollRef.current;
            if (!el) return;
            setScrollState({
              hasOverflow: el.scrollWidth > el.clientWidth,
              atStart: el.scrollLeft <= 0,
              atEnd: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1,
            });
          }}
        >
          {children}
        </div>
        {/* Leg-1 round-4 P1: these three nodes are SCREEN-ONLY affordances and must
            not print. Round 2's print fix reset overflow on the scroll container so
            wide tables and display equations stop clipping on paper -- but it did
            nothing about the container's decorative siblings, so a printed
            methodology or values document got a gradient stripe painted over the
            right edge of a table plus a stray "Swipe to see more" line. `print:hidden`
            is the established idiom for this in this codebase (33 other uses). */}
        {showRightFade && (
          <div
            aria-hidden="true"
            data-testid="scroll-fade-gradient"
            className={`pointer-events-none absolute bottom-0 right-0 top-0 w-8 bg-gradient-to-l to-transparent print:hidden ${fadeFrom}`}
          />
        )}
        {showLeftFade && (
          <div
            aria-hidden="true"
            data-testid="scroll-fade-gradient-left"
            className={`pointer-events-none absolute bottom-0 left-0 top-0 w-8 bg-gradient-to-r to-transparent print:hidden ${fadeFrom}`}
          />
        )}
      </div>
      {hasOverflow && (
        <p
          data-testid="scroll-fade-caption"
          aria-hidden={ariaHidden || undefined}
          className="mt-1 text-right text-xs text-slate-500 print:hidden dark:text-slate-400"
        >
          {captionText}
        </p>
      )}
    </div>
  );
}
