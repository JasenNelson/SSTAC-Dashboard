// Regulatory Review methodology -- full paper landing (server entry).
//
// Server component responsibilities:
//   1. PAGE-LEVEL auth + admin-role guard (defense in depth alongside
//      regulatory-review/layout.tsx -- codex 2026-05-16 P2 pattern).
//   2. Render a TOC of all 10 methodology paper sections (PLAN + 4
//      body parts + 5 appendices) as links into
//      /regulatory-review/methodology/paper/[section].
//
// Intent: bridge users from the curated TSX scenario summaries into
// the full 67k-word methodology paper rendered inline.

import type { Metadata } from 'next';
import Link from 'next/link';
import { BookOpen, FileText, ArrowLeft } from 'lucide-react';
import { requireMethodologyPageAccess } from '@/lib/regulatory-review/methodology-page-auth-guard';
import { ALL_SECTIONS } from '@/lib/regulatory-review/methodology-paper-loader';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Methodology Paper | Regulatory Review',
  description:
    'Full methodology paper for the Regulatory Review AI Agent (RRAA): ' +
    'PLAN + Parts I-IX + Appendices A/B/C/D/G, rendered inline.',
};

export default async function MethodologyPaperLandingPage() {
  await requireMethodologyPageAccess();

  const bodyParts = ALL_SECTIONS.filter(
    (s) => s.slug === 'plan' || s.slug.startsWith('parts-') || s.slug === 'part-vi',
  );
  const appendices = ALL_SECTIONS.filter((s) => s.slug.startsWith('appendix-'));

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-6">
      <header className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Regulatory Review Methodology
        </p>
        <h1 className="text-2xl font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-slate-600 dark:text-slate-300" />
          Full Methodology Paper
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Full methodology paper - the source of truth behind the curated
          tier summaries. Each section links to the full markdown rendered
          inline.
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-500">
          <Link
            href="/regulatory-review/methodology"
            className="inline-flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-300"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to methodology overview
          </Link>
        </p>
      </header>

      <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 border border-slate-200 dark:border-slate-700">
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
          <FileText className="h-4 w-4 text-slate-500 dark:text-slate-400" />
          PLAN + Body (Parts I-IX)
        </h2>
        <ul className="space-y-2">
          {bodyParts.map((section) => (
            <li key={section.slug}>
              <Link
                href={`/regulatory-review/methodology/paper/${section.slug}`}
                className="block rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-3 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50/40 dark:hover:bg-blue-900/10 transition-colors"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                    {section.title}
                  </span>
                  <code className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
                    {section.file}
                  </code>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-6 border border-slate-200 dark:border-slate-700">
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-3 flex items-center gap-2">
          <FileText className="h-4 w-4 text-slate-500 dark:text-slate-400" />
          Appendices
        </h2>
        <ul className="space-y-2">
          {appendices.map((section) => (
            <li key={section.slug}>
              <Link
                href={`/regulatory-review/methodology/paper/${section.slug}`}
                className="block rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-3 hover:border-violet-300 dark:hover:border-violet-700 hover:bg-violet-50/40 dark:hover:bg-violet-900/10 transition-colors"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                    {section.title}
                  </span>
                  <code className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
                    {section.file}
                  </code>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <footer className="pt-4 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-500 space-y-1">
        <p>
          Source files live in the engine repository at{' '}
          <code className="text-[11px] bg-slate-100 dark:bg-slate-800 px-1 rounded">
            Regulatory-Review/engine/docs/active/methodology/
          </code>
          . Files are read-only from this viewer; edits must happen in the
          engine repo.
        </p>
      </footer>
    </div>
  );
}
