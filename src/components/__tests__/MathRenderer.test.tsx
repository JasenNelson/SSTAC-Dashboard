import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import MathRenderer from '../MathRenderer';

// Decision #2 (docs/UI_DECISIONS_2026_08_15.md): wide GFM tables and KaTeX
// display-mode equations get the shared ScrollFadeRegion affordance instead
// of a bare overflow-x-auto div. jsdom cannot verify the fade/caption
// actually appearing on real overflow (see ScrollFadeRegion.test.tsx for
// that branch) -- these tests verify MathRenderer wires the right content
// through the right wrapper, structurally.

describe('MathRenderer', () => {
  it('round-4 Leg1a P2-2: re-rendering does not remount the markdown subtree', () => {
    // react-markdown resolves each element as `components[name] ?? name` and calls
    // createElement with it, so a NEW function identity is a NEW component type and
    // React unmounts/remounts that subtree instead of reconciling it. The `components`
    // object is now memoised on `fadeFrom` for exactly this reason.
    //
    // This matters because the `span` override matches EVERY inline node -- every span
    // KaTeX emits, and every span in the 7000-line Jermilova methodology. With an inline
    // object literal, any parent state change tore down and rebuilt the whole document,
    // dropping the reader's text selection and forcing a full relayout.
    //
    // Two-sided falsification:
    //  - Positive: the same DOM node instance survives a re-render with identical props.
    //  - Negative: node IDENTITY is the discriminating check. Asserting the table still
    //    "exists" after re-render passes either way -- a remounted subtree still renders
    //    a table. Only identity distinguishes reconcile from remount.
    //
    // BOTH overrides are checked, and the span half needs MATH content specifically.
    // Two earlier drafts of this test were blind to the `span` override: the first
    // asserted only on the table node, and the second used `inline code`, which
    // react-markdown renders as <code>, never touching the span override at all.
    // Only KaTeX emits the spans this override matches -- so the content below must
    // contain real math or the span half is vacuous. `span` is the override that
    // matters, since it matches EVERY inline node and its identity churn would remount
    // an entire document.
    const content = '$$E = mc^2$$\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n';
    const { container, rerender } = render(<MathRenderer content={content} />);

    const tableBefore = screen.getByRole('table');
    const katexSpanBefore = container.querySelector('.katex');
    expect(katexSpanBefore).not.toBeNull();

    rerender(<MathRenderer content={content} />);

    expect(screen.getByRole('table')).toBe(tableBefore);
    expect(container.querySelector('.katex')).toBe(katexSpanBefore);
  });

  it('updates the fade surface when fadeFrom changes, so the memo key is real', () => {
    // The memo is keyed on `fadeFrom`, and that key must be real: a caller switching
    // surfaces (e.g. the Calculator drawer's dark:bg-slate-950 vs a Guide card's
    // dark:bg-slate-800) must get the new gradient, not a stale one held by an
    // over-aggressive memo with an empty dep array.
    //
    // The gradient only renders while the region OVERFLOWS, and jsdom reports
    // scrollWidth/clientWidth as 0, so those must be stubbed or there is no gradient
    // node to inspect and the test would assert against an empty region. (The first
    // draft of this test did exactly that and failed for that reason, not because the
    // code was wrong.)
    Object.defineProperty(HTMLDivElement.prototype, 'scrollWidth', { configurable: true, value: 500 });
    Object.defineProperty(HTMLDivElement.prototype, 'clientWidth', { configurable: true, value: 100 });
    try {
      const content = '| A | B |\n| --- | --- |\n| 1 | 2 |\n';
      const { rerender } = render(
        <MathRenderer content={content} fadeFrom="from-white dark:from-slate-900" />,
      );
      expect(screen.getByTestId('scroll-fade-gradient').className).toContain('dark:from-slate-900');

      rerender(<MathRenderer content={content} fadeFrom="from-white dark:from-slate-950" />);

      const gradient = screen.getByTestId('scroll-fade-gradient');
      expect(gradient.className).toContain('dark:from-slate-950');
      expect(gradient.className).not.toContain('dark:from-slate-900');
    } finally {
      delete (HTMLDivElement.prototype as unknown as Record<string, unknown>).scrollWidth;
      delete (HTMLDivElement.prototype as unknown as Record<string, unknown>).clientWidth;
    }
  });

  it('wraps GFM tables in a ScrollFadeRegion', () => {
    const content = '| A | B |\n| --- | --- |\n| 1 | 2 |\n';
    render(<MathRenderer content={content} />);

    const region = screen.getByTestId('scroll-fade-region');
    expect(within(region).getByRole('table')).toBeInTheDocument();
  });

  it('wraps display-mode KaTeX output in a ScrollFadeRegion and renders typeset math, not raw LaTeX source', () => {
    // remark-math only treats $$...$$ as block/display math when the
    // delimiters are on their own line -- same requirement as the real
    // MatrixDashboard.tsx #8 call site (see its comment there).
    const content = '$$\nx = y^2\n$$';
    const { container } = render(<MathRenderer content={content} />);

    // Real KaTeX HTML output present (the katex-display block wrapper).
    expect(container.querySelector('.katex-display')).toBeInTheDocument();
    expect(container.querySelector('.katex')).toBeInTheDocument();
    // The katex-display block sits inside a scroll-fade region.
    const region = screen.getByTestId('scroll-fade-region');
    expect(region.querySelector('.katex-display')).toBeInTheDocument();
    // The raw LaTeX source is not left as literal pre-formatted visible
    // text (the bug decision #8 fixes) -- it may still appear inside
    // KaTeX's own invisible MathML <annotation> (for accessibility), which
    // is expected and not the same failure mode.
    expect(container.querySelector('pre')).not.toBeInTheDocument();
  });

  it('does not wrap inline math (katex, not katex-display) in a ScrollFadeRegion', () => {
    const content = 'Inline math $a+b$ in a sentence.';
    const { container } = render(<MathRenderer content={content} />);

    expect(container.querySelector('.katex-display')).not.toBeInTheDocument();
    expect(screen.queryByTestId('scroll-fade-region')).not.toBeInTheDocument();
    expect(container.querySelector('.katex')).toBeInTheDocument();
  });

  it('renders plain markdown content unaffected', () => {
    render(<MathRenderer content={'# Heading\n\nSome **bold** text.'} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Heading' })).toBeInTheDocument();
    expect(screen.getByText('bold')).toBeInTheDocument();
  });
  // ---------------------------------------------------------------------------
  // Audit #16 guard (2026-08-16). The duplicate-H1 fix demotes a document's leading
  // `# ` heading, but it is applied at the MatrixDashboard CALL SITES, never here.
  // MathRenderer is shared: JermilovaReviewPortal.tsx:819 renders its methodology
  // document through it and the page has NO other <h1>, so "simplifying" the fix by
  // moving demoteLeadingH1 into this component would delete that page's only title.
  //
  // Falsified: applying demoteLeadingH1 to `content` inside MathRenderer fails this
  // test with "Unable to find an accessible element with the role heading and level 1".
  // ---------------------------------------------------------------------------
  it('still renders a leading H1 as level 1 -- the duplicate-H1 fix must NOT live here', () => {
    render(<MathRenderer content={'# Jermilova BN-RRM Methodology\n\nBody.'} />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Jermilova BN-RRM Methodology' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { level: 2, name: 'Jermilova BN-RRM Methodology' }),
    ).not.toBeInTheDocument();
  });
});
