'use client';

// Markdown renderer for the full methodology paper.
//
// Layout: two-column on md+ screens.
//   - Left: sticky sidebar with two TOCs --
//       (a) all-paper nav (jump to other sections)
//       (b) within-section H2 nav (anchor-scrolling)
//   - Right: rendered markdown body in Tailwind `prose` styling.
//
// Smaller breakpoints (below md) collapse to a single column with the
// sidebar above the body.
//
// Pipeline: react-markdown + remark-math + rehype-katex (matches the
// MathRenderer convention at src/components/MathRenderer.tsx). KaTeX
// CSS is imported once here; tree-shaking de-dupes if MathRenderer is
// also imported in the same render tree.
//
// No react-syntax-highlighter dep present in the dashboard; code
// blocks fall back to plain `<pre><code>` styled with bg-slate-100 /
// bg-slate-900 to match the design language.

import { useMemo } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { ArrowLeft, BookOpen, FileText } from 'lucide-react';

interface SectionNavItem {
  slug: string;
  title: string;
}

interface MarkdownPaperViewProps {
  content: string;
  title: string;
  /** Relative path under engine/docs/active/methodology/ for attribution. */
  sourcePath: string;
  /** Curated summary route this section bridges back to. */
  summaryRoute: string;
  /** Current section slug -- used to highlight in the all-paper TOC. */
  slug: string;
  /** All paper sections (compact labels) for the all-paper TOC. */
  allSections: SectionNavItem[];
}

// ---------------------------------------------------------------------------
// H2 extraction for within-section anchor TOC
// ---------------------------------------------------------------------------

interface InlineHeading {
  text: string;
  anchor: string;
}

function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

/**
 * Pull H2 headings out of the markdown source for the within-section
 * TOC. We deliberately use a simple regex pass rather than reusing the
 * react-markdown AST -- the TOC just needs anchors, not full parsing.
 *
 * Skips H2 headings inside fenced code blocks (```...```) by tracking
 * fence open/close state.
 */
function extractH2Headings(markdown: string): InlineHeading[] {
  const lines = markdown.split(/\r?\n/);
  const out: InlineHeading[] = [];
  const seen = new Set<string>();
  let inFence = false;
  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = /^##\s+(.+?)\s*#*\s*$/.exec(line);
    if (!m) continue;
    const text = m[1].trim();
    let anchor = slugifyHeading(text);
    // Disambiguate duplicates.
    let suffix = 1;
    const base = anchor;
    while (seen.has(anchor)) {
      suffix += 1;
      anchor = `${base}-${suffix}`;
    }
    seen.add(anchor);
    out.push({ text, anchor });
  }
  return out;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

export function MarkdownPaperView({
  content,
  title,
  sourcePath,
  summaryRoute,
  slug,
  allSections,
}: MarkdownPaperViewProps) {
  const headings = useMemo(() => extractH2Headings(content), [content]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* Header bar */}
      <header className="space-y-2 pb-4 border-b border-slate-200 dark:border-slate-700 mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Regulatory Review Methodology -- Full Paper
        </p>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <h1 className="text-2xl font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-slate-600 dark:text-slate-300 shrink-0" />
            <span>{title}</span>
          </h1>
          <div className="flex items-center gap-3 text-xs">
            <Link
              href="/regulatory-review/methodology/paper"
              className="inline-flex items-center gap-1 text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Paper TOC
            </Link>
            <Link
              href={summaryRoute}
              className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to summary
            </Link>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-[16rem_minmax(0,1fr)] gap-6">
        {/* Sidebar TOC */}
        <aside className="md:sticky md:top-6 md:self-start md:max-h-[calc(100vh-3rem)] md:overflow-y-auto space-y-5">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-4 border border-slate-200 dark:border-slate-700">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Paper sections
            </h2>
            <ul className="space-y-1">
              {allSections.map((s) => (
                <li key={s.slug}>
                  <Link
                    href={`/regulatory-review/methodology/paper/${s.slug}`}
                    className={`block text-xs px-2 py-1.5 rounded transition-colors ${
                      s.slug === slug
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 font-medium'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/40'
                    }`}
                  >
                    {s.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {headings.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-4 border border-slate-200 dark:border-slate-700">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                In this section
              </h2>
              <ul className="space-y-1">
                {headings.map((h) => (
                  <li key={h.anchor}>
                    <a
                      href={`#${h.anchor}`}
                      className="block text-xs px-2 py-1 rounded text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/40 hover:text-slate-800 dark:hover:text-slate-200"
                    >
                      {h.text}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>

        {/* Markdown body */}
        <article className="min-w-0">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 sm:p-8 border border-slate-200 dark:border-slate-700">
            <div
              className={[
                'prose prose-slate dark:prose-invert max-w-none',
                'prose-headings:scroll-mt-20',
                'prose-pre:bg-slate-100 dark:prose-pre:bg-slate-900',
                'prose-pre:text-slate-800 dark:prose-pre:text-slate-100',
                'prose-pre:border prose-pre:border-slate-200 dark:prose-pre:border-slate-700',
                'prose-code:bg-slate-100 dark:prose-code:bg-slate-900',
                'prose-code:px-1 prose-code:py-0.5 prose-code:rounded',
                'prose-code:before:hidden prose-code:after:hidden',
                'prose-a:text-blue-600 dark:prose-a:text-blue-400',
                'prose-table:text-sm',
              ].join(' ')}
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={{
                  h2: ({ children, ...props }) => {
                    const text = childrenToText(children);
                    const id = slugifyHeading(text);
                    return (
                      <h2 id={id} {...props}>
                        {children}
                      </h2>
                    );
                  },
                }}
              >
                {content}
              </ReactMarkdown>
            </div>

            <footer className="mt-8 pt-4 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-500 space-y-1">
              <p>
                Source:{' '}
                <code className="text-[11px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                  engine/docs/active/methodology/{sourcePath}
                </code>
              </p>
              <p className="italic">
                Read-only view. Edits must happen in the engine repository.
              </p>
            </footer>
          </div>
        </article>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Best-effort text extraction from react-markdown heading children for
 * anchor-id derivation. react-markdown passes a ReactNode tree (string |
 * elements with .props.children); we walk it depth-first and collect
 * strings. Non-string leaves fall back to empty string.
 */
function childrenToText(node: React.ReactNode): string {
  if (node === null || node === undefined || node === false) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(childrenToText).join('');
  if (
    typeof node === 'object' &&
    'props' in node &&
    node.props &&
    typeof node.props === 'object' &&
    'children' in node.props
  ) {
    return childrenToText((node.props as { children: React.ReactNode }).children);
  }
  return '';
}
