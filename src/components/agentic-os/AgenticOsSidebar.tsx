'use client';

// Agentic OS left-rail sidebar.
//
// Two zones:
//   1. Category navigation (top): switches between sibling routes
//      (Projects, AI Subscriptions, and future GitHub/Vercel/NotebookLM
//      panels which render as disabled "coming soon" entries until they
//      ship in a later PR).
//   2. View-specific sub-nav (below, via {children}): each route owns its
//      sidebar sub-nav. Projects renders Views filter + Running indicators
//      + Quick actions. Subscriptions has minimal/none.
//
// The active category determines the violet left-border highlight in the
// top zone. The hook into the actual URL routing is done by the layout
// (which infers the active category from pathname and passes it in here)
// rather than by this component, so the sidebar stays presentational and
// trivially unit-testable.

import Link from 'next/link';
import type { ReactNode } from 'react';

export type SidebarCategory =
  | 'projects'
  | 'subscriptions'
  | 'github'
  | 'vercel'
  | 'notebooklm';

interface CategoryDef {
  readonly id: SidebarCategory;
  readonly label: string;
  /** Route slug appended to /admin/agentic-os. Empty string is the root. */
  readonly slug: string;
  /** When true, the entry renders as disabled "future panel (PR-2)". */
  readonly future: boolean;
  /** Short tooltip shown on hover. */
  readonly title: string;
}

// Order is presentation order. Add new sibling routes here when they ship.
const CATEGORIES: ReadonlyArray<CategoryDef> = [
  {
    id: 'projects',
    label: 'Projects',
    slug: '',
    future: false,
    title: 'Per-project actions, convergence graph, launches (Patterns A/B/C/D)',
  },
  {
    id: 'subscriptions',
    label: 'AI Subs',
    slug: 'subscriptions',
    future: false,
    title: 'AI provider subscriptions, usage links, live-check actions',
  },
  {
    id: 'github',
    label: 'GitHub',
    slug: 'github',
    future: true,
    title: 'Future panel (PR-2): repo + PR status across all projects',
  },
  {
    id: 'vercel',
    label: 'Vercel',
    slug: 'vercel',
    future: true,
    title: 'Future panel (PR-2): deployment + preview status',
  },
  {
    id: 'notebooklm',
    label: 'NotebookLM',
    slug: 'notebooklm',
    future: true,
    title: 'Future panel (PR-2): NotebookLM workspaces + sources',
  },
];

interface Props {
  /** Currently active category. Drives the violet left-border highlight. */
  activeCategory: SidebarCategory;
  /**
   * Optional view-specific sub-nav. Rendered below the category zone, inside
   * the scrolling area. Each sibling route is responsible for its own
   * sub-nav content (Projects: Views + Running + Quick actions;
   * Subscriptions: optional "last updated" pointer; etc.).
   */
  children?: ReactNode;
}

export default function AgenticOsSidebar({ activeCategory, children }: Props) {
  return (
    <aside
      aria-label="Agentic OS navigation"
      className="border-r border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden"
    >
      <nav
        aria-label="Agentic OS sections"
        className="border-b border-slate-200 dark:border-slate-700 py-2"
      >
        <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
          Sources
        </div>
        {CATEGORIES.map((cat) => {
          const selected = cat.id === activeCategory;
          const href = cat.slug
            ? `/admin/agentic-os/${cat.slug}`
            : '/admin/agentic-os';
          // Future entries render as inert <span role="note"> with the
          // "coming soon" treatment, matching the Quick actions disabled
          // styling so the disabled state is visually consistent across
          // the page. role="note" keeps screen readers from announcing
          // them as interactive controls.
          if (cat.future) {
            // role="note" + plain <span> conveys non-interactive to AT.
            // jsx-a11y rejects aria-disabled here (the role doesn't support
            // it); the styling + lack of tabIndex/focus already carries the
            // disabled affordance. data-future-panel is retained as a test
            // hook and for future programmatic discovery.
            return (
              <span
                key={cat.id}
                role="note"
                title={cat.title}
                data-future-panel="true"
                className="w-full flex items-center justify-between px-3 py-1.5 text-left text-xs italic text-slate-500 dark:text-slate-400 opacity-50 select-none border-l-2 border-transparent"
              >
                <span>{cat.label}</span>
                <span className="text-[10px] font-mono not-italic">
                  PR-2
                </span>
              </span>
            );
          }
          return (
            <Link
              key={cat.id}
              href={href}
              aria-current={selected ? 'page' : undefined}
              title={cat.title}
              className={`block w-full px-3 py-1.5 text-left text-[13px] focus:outline-none focus-visible:ring-1 focus-visible:ring-violet-500 ${
                selected
                  ? 'bg-slate-100 dark:bg-slate-800 border-l-2 border-violet-500 text-slate-900 dark:text-slate-100 font-semibold'
                  : 'border-l-2 border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              {cat.label}
            </Link>
          );
        })}
      </nav>

      {/* View-specific sub-nav slot. Routes render their own filter / lists /
          quick-actions here. Empty when a route has no sub-nav. */}
      <div className="flex-1 overflow-y-auto">{children}</div>
    </aside>
  );
}
