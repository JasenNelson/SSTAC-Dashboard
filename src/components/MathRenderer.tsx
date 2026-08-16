import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import ScrollFadeRegion from './ScrollFadeRegion';

interface MathRendererProps {
  content: string;
  /**
   * Tailwind `from-*`/`dark:from-*` classes forwarded to every ScrollFadeRegion this
   * renderer creates (tables + display equations).
   *
   * Round-2 P2-2: there is no single correct default here, so this is a REQUIRED-in-practice
   * prop for any caller not on the plain bg-white / dark:bg-slate-900 surface. MathRenderer is
   * mounted on at least two different dark surfaces -- `dark:bg-slate-950` (the Calculator
   * equation drawer) and `dark:bg-slate-800` (the Guide section cards) -- so a hardcoded
   * default paints a visible mismatched stripe on one of them whichever value is picked.
   * Callers pass their own surface; the default below only covers the bg-white /
   * dark:bg-slate-900 case.
   */
  fadeFrom?: string;
}

// MathRenderer styles markdown via inline arbitrary-variant selectors
// instead of `@tailwindcss/typography`'s `prose` class (the plugin is not
// installed; `prose` here is a no-op kept for visual parity with the
// matrix-options TWG portal). Tailwind v4 preflight resets browser
// defaults for strong / code / table / blockquote / em / etc., so the
// selectors below must cover EVERY markdown element we use, not just
// h1/h2/h3/p/ul/li. Without this expanded coverage, the Jermilova
// methodology MD (7365 lines, 56 fenced code blocks, 596 table rows,
// frequent **bold** + `inline code`) renders as a wall of undifferentiated
// text -- the markdown IS parsed, the elements just have no visible
// styling.
//
// remark-gfm enables GitHub-flavored markdown extensions (tables, strike,
// task lists, autolink) which the methodology paper uses for the LOO
// kappa tables + comparison-dimension status tables.
export default function MathRenderer({
  content,
  fadeFrom = 'from-white dark:from-slate-900',
}: MathRendererProps) {
  // Memoised on `fadeFrom` so the override functions keep a stable identity across
  // renders. react-markdown resolves each element as `components[name] ?? name` and
  // calls createElement with it, so a NEW function identity is a NEW component type,
  // and React unmounts and remounts that subtree instead of reconciling it.
  //
  // This was harmless while only `table` was overridden. The `span` override added in
  // this batch matches EVERY inline node -- including the hundreds of spans KaTeX emits
  // per equation and every span in the 7000-line Jermilova methodology -- so an inline
  // object literal here would tear down and rebuild the entire document on any parent
  // state change, dropping the reader's text selection mid-document and forcing a full
  // relayout.
  const markdownComponents = React.useMemo(
    () => ({
      table: ({ node: _node, ...props }: { node?: unknown } & React.ComponentPropsWithoutRef<'table'>) => (
        <ScrollFadeRegion className="math-renderer-table-wrapper max-w-full my-6" fadeFrom={fadeFrom}>
          <table {...props} />
        </ScrollFadeRegion>
      ),
      // rehype-katex replaces remark-math's `math-display` node with its
      // own KaTeX output, whose real overflow-prone wrapper carries the
      // `katex-display` class (block/display-mode equations only --
      // inline `katex` spans are left alone since they don't overflow).
      span: ({ node: _node, className, ...props }: { node?: unknown } & React.ComponentPropsWithoutRef<'span'>) => {
        const classNameString = typeof className === 'string' ? className : '';
        if (classNameString.split(/\s+/).includes('katex-display')) {
          return (
            <ScrollFadeRegion className={`${classNameString} py-2`} fadeFrom={fadeFrom}>
              <span className={classNameString} {...props} />
            </ScrollFadeRegion>
          );
        }
        return <span className={className} {...props} />;
      },
    }),
    [fadeFrom],
  );

  return (
    <div
      className={[
        // Base typography
        'math-renderer max-w-none leading-relaxed text-slate-800 dark:text-slate-200',
        // Headings
        '[&>h1]:mb-6 [&>h1]:mt-2 [&>h1]:text-3xl [&>h1]:font-bold [&>h1]:text-slate-900 dark:[&>h1]:text-white',
        '[&>h2]:mb-4 [&>h2]:mt-8 [&>h2]:text-2xl [&>h2]:font-bold [&>h2]:text-slate-800 dark:[&>h2]:text-slate-100 [&>h2]:border-b [&>h2]:border-slate-200 dark:[&>h2]:border-slate-700 [&>h2]:pb-2',
        '[&>h3]:mb-4 [&>h3]:mt-6 [&>h3]:text-xl [&>h3]:font-bold [&>h3]:text-slate-800 dark:[&>h3]:text-slate-100',
        '[&>h4]:mb-3 [&>h4]:mt-5 [&>h4]:text-lg [&>h4]:font-semibold [&>h4]:text-slate-800 dark:[&>h4]:text-slate-100',
        // Paragraphs
        '[&>p]:mb-5 [&>p]:leading-relaxed',
        // Inline emphasis
        '[&_strong]:font-bold [&_strong]:text-slate-900 dark:[&_strong]:text-white',
        '[&_em]:italic',
        // Inline code
        '[&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:bg-slate-100 dark:[&_code]:bg-slate-800 [&_code]:text-[0.92em] [&_code]:text-rose-600 dark:[&_code]:text-rose-300 [&_code]:font-mono',
        // Fenced code blocks (pre > code overrides the inline-code styling)
        '[&>pre]:bg-slate-900 dark:[&>pre]:bg-slate-950 [&>pre]:text-slate-100 [&>pre]:rounded-lg [&>pre]:p-4 [&>pre]:my-6 [&>pre]:overflow-x-auto [&>pre]:text-sm [&>pre]:leading-relaxed',
        '[&>pre>code]:bg-transparent [&>pre>code]:text-inherit [&>pre>code]:p-0 [&>pre>code]:rounded-none [&>pre>code]:text-[0.95em]',
        // Lists
        '[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-5 [&_ul]:space-y-1.5',
        '[&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-5 [&_ol]:space-y-1.5',
        '[&_li]:leading-relaxed',
        '[&_li>p]:mb-2',
        // Tables (GFM)
        '[&_table]:w-full [&_table]:border-collapse [&_table]:text-sm',
        '[&_th]:px-4 [&_th]:py-3 [&_th]:text-left [&_th]:font-bold [&_th]:bg-slate-100 dark:[&_th]:bg-slate-800 [&_th]:text-slate-800 dark:[&_th]:text-slate-200 [&_th]:border [&_th]:border-slate-200 dark:[&_th]:border-slate-700 [&_th]:break-words',
        '[&_td]:px-4 [&_td]:py-3 [&_td]:border [&_td]:border-slate-200 dark:[&_td]:border-slate-700 [&_td]:align-top [&_td]:break-words',
        '[&_tbody>tr:nth-child(even)]:bg-slate-50 dark:[&_tbody>tr:nth-child(even)]:bg-slate-900/40',
        // Blockquotes
        '[&>blockquote]:border-l-4 [&>blockquote]:border-sky-400 dark:[&>blockquote]:border-sky-600 [&>blockquote]:pl-4 [&>blockquote]:my-5 [&>blockquote]:italic [&>blockquote]:text-slate-700 dark:[&>blockquote]:text-slate-300',
        // Horizontal rules
        '[&>hr]:my-8 [&>hr]:border-t [&>hr]:border-slate-200 dark:[&>hr]:border-slate-700',
        // Links
        '[&_a]:text-sky-600 dark:[&_a]:text-sky-400 [&_a]:underline [&_a]:underline-offset-2 [&_a]:decoration-sky-400/60 hover:[&_a]:text-sky-700 dark:hover:[&_a]:text-sky-300',
        // NOTE: no `.math-display` utility here (P3, docs/BATCH_FIXES_ROUND1.md) --
        // rehype-katex@7.0.1 splices out remark-math's `math-display` element entirely and
        // replaces it with its own `katex-display` wrapper (handled below via the `span`
        // component override + ScrollFadeRegion), so a `[&_.math-display]:*` selector here
        // could never match anything.
      ].join(' ')}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={markdownComponents}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
