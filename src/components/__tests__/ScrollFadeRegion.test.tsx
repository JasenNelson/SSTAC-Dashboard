import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ScrollFadeRegion from '../ScrollFadeRegion';

// jsdom has no layout engine: scrollWidth/clientWidth are both always 0 by
// default, so the "content overflows" branch can never occur from a real
// render here. These tests stub the two properties on HTMLElement.prototype
// before mount (ScrollFadeRegion's effect reads them synchronously on
// mount, so no resize/observer trigger is needed) to exercise both branches
// deterministically. Real horizontal-scroll behaviour (whether the fade
// visually tracks scroll position, whether the caption actually reads well
// against page content) needs a real browser -- not verifiable in jsdom.

function stubScrollMetrics(scrollWidth: number, clientWidth: number) {
  Object.defineProperty(HTMLDivElement.prototype, 'scrollWidth', {
    configurable: true,
    value: scrollWidth,
  });
  Object.defineProperty(HTMLDivElement.prototype, 'clientWidth', {
    configurable: true,
    value: clientWidth,
  });
}

function restoreScrollMetrics() {
  delete (HTMLDivElement.prototype as unknown as Record<string, unknown>).scrollWidth;
  delete (HTMLDivElement.prototype as unknown as Record<string, unknown>).clientWidth;
}

describe('ScrollFadeRegion', () => {
  afterEach(() => {
    cleanup();
    restoreScrollMetrics();
  });

  it('does not render the fade/caption when content fits (no overflow)', () => {
    stubScrollMetrics(100, 100);
    render(
      <ScrollFadeRegion>
        <div>content</div>
      </ScrollFadeRegion>,
    );

    expect(screen.getByTestId('scroll-fade-region')).toBeInTheDocument();
    expect(screen.queryByTestId('scroll-fade-gradient')).not.toBeInTheDocument();
    expect(screen.queryByTestId('scroll-fade-caption')).not.toBeInTheDocument();
  });

  it('round-4 P1: keeps every screen-only affordance out of print output', () => {
    // Round 2 fixed print CLIPPING by resetting overflow on the scroll container, but left
    // the container's decorative siblings printing: a gradient stripe painted over the right
    // edge of a printed table/equation, plus a stray "Swipe to see more" caption, in a
    // regulatory/methodology document. This is the branch's recurring "a fix creates the next
    // round's defect" pattern, and the "correct content hidden rather than corrupted" class
    // that gates cannot see (jsdom has no print rendering at all -- only the class contract
    // is assertable here; the visual result still needs a print-preview check).
    //
    // Two-sided falsification:
    //  - Positive: all three screen-only nodes carry `print:hidden`. Removing the utility
    //    from any one of them fails the corresponding expectation by name.
    //  - Negative: the CONTENT itself must NOT be print-hidden -- asserting that the scroll
    //    container and the caller's children stay printable rules out the obvious
    //    over-correction of hiding the whole region on paper, which would suppress the very
    //    table this batch was trying to stop clipping.
    stubScrollMetrics(500, 100);
    render(
      <ScrollFadeRegion>
        <div>wide regulatory table</div>
      </ScrollFadeRegion>,
    );

    // Scroll away from the start so BOTH gradients are mounted and checkable.
    // NOTE: must select `.overflow-x-auto` explicitly. A bare `querySelector('div')`
    // returns the inner `relative` positioning wrapper, NOT the scroll container --
    // setting scrollLeft on that wrapper is a no-op and the left fade never mounts.
    const scrollContainer = screen
      .getByTestId('scroll-fade-region')
      .querySelector('.overflow-x-auto');
    expect(scrollContainer).not.toBeNull();
    scrollContainer!.scrollLeft = 200;
    fireEvent.scroll(scrollContainer!);

    expect(screen.getByTestId('scroll-fade-gradient').className).toMatch(/\bprint:hidden\b/);
    expect(screen.getByTestId('scroll-fade-gradient-left').className).toMatch(/\bprint:hidden\b/);
    expect(screen.getByTestId('scroll-fade-caption').className).toMatch(/\bprint:hidden\b/);

    // Negative half: the printable content must survive.
    expect(screen.getByText('wide regulatory table')).toBeInTheDocument();
    expect(scrollContainer?.className).not.toMatch(/\bprint:hidden\b/);
    expect(screen.getByTestId('scroll-fade-region').className).not.toMatch(/\bprint:hidden\b/);
  });

  it('renders the fade + caption when content overflows the scroll container', () => {
    stubScrollMetrics(500, 100);
    render(
      <ScrollFadeRegion>
        <div>wide content</div>
      </ScrollFadeRegion>,
    );

    expect(screen.getByTestId('scroll-fade-gradient')).toBeInTheDocument();
    expect(screen.getByTestId('scroll-fade-caption')).toHaveTextContent(
      'Swipe to see more',
    );
  });

  it('renders a custom caption when provided', () => {
    stubScrollMetrics(500, 100);
    render(
      <ScrollFadeRegion captionText="Scroll to see more">
        <div>wide content</div>
      </ScrollFadeRegion>,
    );

    expect(screen.getByTestId('scroll-fade-caption')).toHaveTextContent(
      'Scroll to see more',
    );
  });

  it('P2-4: uses the fadeFrom override instead of the hardcoded default surface', () => {
    // Two-sided falsification: positive assertion below proves the override lands on the
    // gradient element; the negative half (default surface class must be ABSENT) proves this
    // isn't just appending the override alongside the old hardcoded value, which would still
    // paint the wrong-surface stripe underneath a caller like EvidenceLibrary's
    // dark:bg-slate-950 panel.
    stubScrollMetrics(500, 100);
    render(
      <ScrollFadeRegion fadeFrom="from-white dark:from-slate-950">
        <div>wide content</div>
      </ScrollFadeRegion>,
    );

    const gradient = screen.getByTestId('scroll-fade-gradient');
    expect(gradient.className).toMatch(/dark:from-slate-950/);
    expect(gradient.className).not.toMatch(/dark:from-slate-900/);
  });

  it('round-2 P2-3: re-checks overflow when the CONTENT changes, not only on container resize', async () => {
    // The regression this pins: round 1 changed the effect deps from [children] to [] and
    // relied on a ResizeObserver attached to the scroll CONTAINER. A width-constrained
    // container's own box never changes when its content grows -- only scrollWidth does --
    // so a table that starts fitting and later overflows (e.g. EvidenceLibrary's Sources
    // table gaining longer source names after a filter) never re-checked, and the fade and
    // "Swipe to see more" caption never appeared on a table with genuinely hidden columns.
    //
    // Two-sided falsification:
    //  - Negative half: the first block asserts NO fade while content fits, so the test
    //    cannot pass by the fade simply always being on.
    //  - Positive half: after a content-only mutation (no container resize, and jsdom fires
    //    no ResizeObserver at all here) the fade must appear. Reverting ScrollFadeRegion to
    //    container-only observation makes this half fail.
    stubScrollMetrics(100, 100);
    const { rerender } = render(
      <ScrollFadeRegion>
        <table>
          <tbody>
            <tr>
              <td>short</td>
            </tr>
          </tbody>
        </table>
      </ScrollFadeRegion>,
    );
    expect(screen.queryByTestId('scroll-fade-caption')).not.toBeInTheDocument();

    // Content grows past the (unchanged) container width.
    stubScrollMetrics(500, 100);
    rerender(
      <ScrollFadeRegion>
        <table>
          <tbody>
            <tr>
              <td>a considerably longer source name that overflows</td>
            </tr>
          </tbody>
        </table>
      </ScrollFadeRegion>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('scroll-fade-caption')).toBeInTheDocument();
    });
    expect(screen.getByTestId('scroll-fade-gradient')).toBeInTheDocument();
  });

  it('P3-2: hides the trailing fade once scrolled fully right, and restores it when scrolled back', () => {
    // Bug: hasOverflow was a boolean, so once a region overflowed the right-edge gradient
    // painted FOREVER -- including at scrollLeft === max, where it permanently washed out
    // the last ~20px of the final column with no way to reveal it (e.g. the Sources column
    // in the Values table). Two-sided:
    //  - Positive: not-yet-scrolled (scrollLeft 0 of 400 scrollable px) shows the fade --
    //    there IS more content to the right.
    //  - Negative: scrolled fully right (scrollLeft === scrollWidth - clientWidth) hides the
    //    fade -- there is nothing left to reveal, so painting a fade over the true final
    //    pixels would hide real content with no way to see it.
    //  - Restoring half: scrolling back away from the end brings the fade back, proving this
    //    tracks live position rather than latching permanently in either direction.
    stubScrollMetrics(500, 100);
    render(
      <ScrollFadeRegion>
        <div>wide content</div>
      </ScrollFadeRegion>,
    );
    const region = screen.getByTestId('scroll-fade-region');
    const scrollContainer = region.querySelector('.overflow-x-auto') as HTMLDivElement;

    expect(screen.getByTestId('scroll-fade-gradient')).toBeInTheDocument();

    scrollContainer.scrollLeft = 400; // scrollWidth(500) - clientWidth(100)
    fireEvent.scroll(scrollContainer);
    expect(screen.queryByTestId('scroll-fade-gradient')).not.toBeInTheDocument();

    scrollContainer.scrollLeft = 200;
    fireEvent.scroll(scrollContainer);
    expect(screen.getByTestId('scroll-fade-gradient')).toBeInTheDocument();
  });

  it('P3-2: shows a leading (left) fade only once scrolled away from the start', () => {
    // Symmetric case named in the fix: the trailing fade signals "more content to the
    // right"; a leading fade should signal "more content to the left" and only that.
    // Two-sided:
    //  - Negative: at scrollLeft 0 (the start) there is nothing further left, so no leading
    //    fade should render even though the region overflows.
    //  - Positive: after scrolling right (but not to the end) both fades are visible --
    //    content exists in both directions.
    stubScrollMetrics(500, 100);
    render(
      <ScrollFadeRegion>
        <div>wide content</div>
      </ScrollFadeRegion>,
    );
    const region = screen.getByTestId('scroll-fade-region');
    const scrollContainer = region.querySelector('.overflow-x-auto') as HTMLDivElement;

    expect(screen.queryByTestId('scroll-fade-gradient-left')).not.toBeInTheDocument();

    scrollContainer.scrollLeft = 200;
    fireEvent.scroll(scrollContainer);
    expect(screen.getByTestId('scroll-fade-gradient-left')).toBeInTheDocument();
    expect(screen.getByTestId('scroll-fade-gradient')).toBeInTheDocument();
  });

  it('P3-2: constrains the fade gradients to the scroll container box, not the caption', () => {
    // The gradient used to be an absolute sibling of the caption inside the SAME relative
    // wrapper, so its top-0/bottom-0 spanned down through the caption paragraph too, and a
    // positioned element paints above static inline text -- washing out the right end of
    // "Swipe to see more". Two-sided:
    //  - Positive: the caption still renders with its full text (nothing was deleted).
    //  - Negative: the gradient's parent is NOT the same element as the caption's parent --
    //    proving the gradient is scoped to an inner wrapper around the scroll container only
    //    and cannot geometrically overlap the caption below it.
    stubScrollMetrics(500, 100);
    render(
      <ScrollFadeRegion>
        <div>wide content</div>
      </ScrollFadeRegion>,
    );

    const caption = screen.getByTestId('scroll-fade-caption');
    const gradient = screen.getByTestId('scroll-fade-gradient');
    expect(caption).toHaveTextContent('Swipe to see more');
    expect(gradient.parentElement).not.toBe(caption.parentElement);
  });

  it('P3-1: ariaHidden prop hides the scroll container from AT and removes it from the tab order', () => {
    // Two-sided:
    //  - Positive: with ariaHidden, the scroll container carries aria-hidden="true" and
    //    tabIndex="-1" (a keyboard user cannot Tab onto it), and the caption is also hidden.
    //  - Negative (default off): without the prop, neither attribute is present -- callers
    //    that need the region to stay in the accessibility tree and tab order are unaffected.
    stubScrollMetrics(500, 100);
    const { rerender } = render(
      <ScrollFadeRegion>
        <div>wide content</div>
      </ScrollFadeRegion>,
    );
    let region = screen.getByTestId('scroll-fade-region');
    let scrollContainer = region.querySelector('.overflow-x-auto') as HTMLDivElement;
    expect(scrollContainer.getAttribute('aria-hidden')).toBeNull();
    expect(scrollContainer.getAttribute('tabindex')).toBeNull();

    rerender(
      <ScrollFadeRegion ariaHidden>
        <div>wide content</div>
      </ScrollFadeRegion>,
    );
    region = screen.getByTestId('scroll-fade-region');
    scrollContainer = region.querySelector('.overflow-x-auto') as HTMLDivElement;
    expect(scrollContainer.getAttribute('aria-hidden')).toBe('true');
    expect(scrollContainer.getAttribute('tabindex')).toBe('-1');
    expect(screen.getByTestId('scroll-fade-caption').getAttribute('aria-hidden')).toBe('true');
  });

  it('always renders the children regardless of overflow state', () => {
    stubScrollMetrics(100, 100);
    render(
      <ScrollFadeRegion>
        <table>
          <tbody>
            <tr>
              <td>row content</td>
            </tr>
          </tbody>
        </table>
      </ScrollFadeRegion>,
    );

    expect(screen.getByText('row content')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Deferred-findings triage, 2026-08-16.
// ---------------------------------------------------------------------------
describe('ScrollFadeRegion -- deferred triage', () => {
  afterEach(() => {
    cleanup();
    restoreScrollMetrics();
  });

  // Item 1. The caption was gated on `hasOverflow` alone -- a strict
  // scrollWidth > clientWidth -- while both fades use the 1px tolerance in `atEnd`.
  // At exactly 1px of overflow the region showed NO fade in either direction and still
  // said "Swipe to see more", promising content that cannot be revealed.
  //
  // Falsified: restoring `{hasOverflow && (` fails this test with the caption present.
  it('does not promise "Swipe to see more" at exactly 1px of overflow', () => {
    stubScrollMetrics(101, 100);
    render(
      <ScrollFadeRegion>
        <div>content</div>
      </ScrollFadeRegion>,
    );

    // At 1px overflow with scrollLeft 0: atStart is true, and atEnd is also true because
    // 0 + 100 >= 101 - 1. So neither fade renders -- and neither should the caption.
    expect(screen.queryByTestId('scroll-fade-gradient')).not.toBeInTheDocument();
    expect(screen.queryByTestId('scroll-fade-gradient-left')).not.toBeInTheDocument();
    expect(screen.queryByTestId('scroll-fade-caption')).not.toBeInTheDocument();
  });

  it('still shows the caption when there is genuinely somewhere to scroll', () => {
    stubScrollMetrics(400, 100);
    render(
      <ScrollFadeRegion>
        <div>content</div>
      </ScrollFadeRegion>,
    );

    // The other side of the same assertion: this must NOT become a test that simply
    // deletes the caption feature.
    expect(screen.getByTestId('scroll-fade-caption')).toBeInTheDocument();
    expect(screen.getByTestId('scroll-fade-gradient')).toBeInTheDocument();
  });

  // Systemic item. Print-safety now belongs to the component rather than to each caller.
  // Three caller-side print gaps were found in a single day because a scroll container that
  // clips on screen also clips on paper unless someone remembers to reset it.
  //
  // Falsified: removing the two print utilities from the scroll container fails this.
  //
  // WHAT THIS CANNOT SEE: jsdom does not implement @media print at all, so this asserts the
  // class contract only. That the printed output is actually unclipped needs a real
  // print-preview or a Playwright emulateMedia({ media: 'print' }) check.
  it('owns its own print-safety instead of relying on every caller to remember', () => {
    stubScrollMetrics(400, 100);
    const { container } = render(
      <ScrollFadeRegion className="rounded-lg border">
        <div>content</div>
      </ScrollFadeRegion>,
    );

    const scroller = container.querySelector('.overflow-x-auto');
    expect(scroller).not.toBeNull();
    const classes = (scroller as HTMLElement).className.split(/\s+/);
    expect(classes).toContain('print:overflow-visible');
    expect(classes).toContain('print:max-w-none');
    // The caller's own classes must survive the change.
    expect(classes).toContain('rounded-lg');
    expect(classes).toContain('border');
  });
});

// ---------------------------------------------------------------------------
// Audit round 2, triage P0-3. The systemic print fix reset `overflow` and `max-width` but NOT
// `max-height`, and three SSD result tables clip vertically (max-h-72 = 288px, roughly 7 rows
// of a 20-40 species SSD). On paper there is no scrollbar, no fade and no ellipsis: the table
// ends mid-list and reads as complete. The rows dropped are the per-species toxicity values the
// HCp is derived from, so this is the "correct value rendered invisible" class this project has
// shipped four times.
//
// jsdom implements no @media print, so this is a CLASS-CONTRACT assertion only -- it proves the
// utility is applied, not that the printed page is un-clipped. Real proof needs a print preview
// or Playwright emulateMedia({ media: 'print' }); that is recorded as owed.
//
// Falsified: removing print:max-h-none from the scroll container fails this.
// ---------------------------------------------------------------------------
describe('ScrollFadeRegion -- vertical print clipping', () => {
  afterEach(() => {
    cleanup();
    restoreScrollMetrics();
  });

  it('resets max-height for print, not only overflow and max-width', () => {
    stubScrollMetrics(400, 100);
    const { container } = render(
      <ScrollFadeRegion className="max-h-72">
        <div>content</div>
      </ScrollFadeRegion>,
    );

    const scroller = container.querySelector('.overflow-x-auto');
    expect(scroller).not.toBeNull();
    const classes = (scroller as HTMLElement).className.split(/\s+/);

    // All three axes of clipping must be reset, or a caller that caps height still truncates
    // on paper while the component claims to own print-safety.
    expect(classes).toContain('print:overflow-visible');
    expect(classes).toContain('print:max-w-none');
    expect(classes).toContain('print:max-h-none');

    // The caller's own height cap must survive on screen -- this is a print-only reset.
    expect(classes).toContain('max-h-72');
  });
});
