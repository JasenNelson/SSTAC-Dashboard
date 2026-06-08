import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface MathRendererProps {
  content: string;
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
export default function MathRenderer({ content }: MathRendererProps) {
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
        // KaTeX display math
        '[&_.math-display]:my-8 [&_.math-display]:py-2 [&_.math-display]:overflow-x-auto',
      ].join(' ')}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          table: ({ node: _node, ...props }) => (
            <div className="math-renderer-table-wrapper overflow-x-auto max-w-full my-6">
              <table {...props} />
            </div>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
