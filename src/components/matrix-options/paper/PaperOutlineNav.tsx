'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

import type { PaperOutlineEntry } from '@/lib/matrix-options/paper/full-document';
import { workingDraftSectionHref } from '@/lib/matrix-options/paper/url-state';

export type PaperOutlineNavEntry = Pick<PaperOutlineEntry, 'id' | 'anchor' | 'label' | 'depth' | 'parentId' | 'childIds'>;

export interface PaperOutlineNavProps {
  readonly outline: readonly PaperOutlineNavEntry[];
  /** Section currently in view (IntersectionObserver); gets aria-current="location". */
  readonly activeAnchor: string | null;
  /** Section requested by the URL or the last navigation; its ancestors start expanded. */
  readonly targetAnchor: string | null;
  /** Element id of the document column the stacked skip link targets. */
  readonly documentTargetId: string;
  readonly onNavigate: (anchor: string) => void;
  readonly onSkipToDocument?: () => void;
}

type OutlineVariant = 'desktop' | 'stacked';

export function isPlainPrimaryClick(event: MouseEvent): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

/** Ids of every ancestor of the entry whose anchor is `anchor`, nearest first. Unknown anchors yield none. */
export function outlineAncestorIds(outline: readonly PaperOutlineNavEntry[], anchor: string | null): readonly string[] {
  if (anchor === null) return [];
  const byId = new Map(outline.map((entry) => [entry.id, entry]));
  const start = outline.find((entry) => entry.anchor === anchor);
  const ancestors: string[] = [];
  const seen = new Set<string>();
  let parentId = start?.parentId ?? null;
  while (parentId !== null && !seen.has(parentId)) {
    const parent = byId.get(parentId);
    if (!parent) break;
    seen.add(parentId);
    ancestors.push(parent.id);
    parentId = parent.parentId;
  }
  return ancestors;
}

/**
 * Full-paper outline.
 * - lg and up (desktop variant): depth 1 and depth 2 entries are visible;
 *   anything deeper sits behind collapsed disclosures.
 * - below lg (stacked variant): only depth-1 entries are visible, each with a
 *   disclosure for its subsections, plus a "Skip to document" link so the
 *   document is reachable within one screen.
 * Ancestors of the target and active sections are expanded. Both variants are
 * server rendered; CSS shows exactly one of them. Every link and disclosure is
 * at least 44px tall at every width (M1-09).
 */
export function PaperOutlineNav({ outline, activeAnchor, targetAnchor, documentTargetId, onNavigate, onSkipToDocument }: PaperOutlineNavProps) {
  const indexed = useMemo(() => new Map(outline.map((entry, index) => [entry.id, { entry, index }])), [outline]);
  const roots = useMemo(() => outline.filter((entry) => entry.parentId === null || !indexed.has(entry.parentId)), [outline, indexed]);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set(outlineAncestorIds(outline, targetAnchor)));

  useEffect(() => {
    const required = [...outlineAncestorIds(outline, targetAnchor), ...outlineAncestorIds(outline, activeAnchor)];
    if (required.length === 0) return;
    setExpanded((previous) => (required.every((id) => previous.has(id)) ? previous : new Set([...previous, ...required])));
  }, [outline, targetAnchor, activeAnchor]);

  const toggle = useCallback((id: string) => {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const renderEntries = (entries: readonly PaperOutlineNavEntry[], variant: OutlineVariant, level: number): ReactNode => (
    <ul className={level === 0 ? 'space-y-0.5' : 'mt-0.5 space-y-0.5 border-l border-slate-200 pl-3 dark:border-slate-700'}>
      {entries.map((entry) => {
        const index = indexed.get(entry.id)?.index ?? 0;
        const children = entry.childIds
          .map((childId) => indexed.get(childId)?.entry)
          .filter((child): child is PaperOutlineNavEntry => child !== undefined);
        const alwaysOpen = variant === 'desktop' && entry.depth <= 1;
        const open = alwaysOpen || expanded.has(entry.id);
        const listId = `paper-outline-${variant}-children-${index}`;
        const active = entry.anchor === activeAnchor;
        return (
          <li key={entry.id}>
            <div className="flex min-w-0 items-start gap-1">
              {children.length > 0 && !alwaysOpen ? (
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={listId}
                  aria-label={`Subsections of ${entry.label}`}
                  onClick={() => toggle(entry.id)}
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-slate-600 hover:bg-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <ChevronRight aria-hidden="true" className={`h-4 w-4 motion-safe:transition-transform motion-reduce:transition-none ${open ? 'rotate-90' : ''}`} />
                </button>
              ) : (
                <span aria-hidden="true" className="w-11 shrink-0" />
              )}
              <a
                href={workingDraftSectionHref(entry.anchor)}
                aria-current={active ? 'location' : undefined}
                onClick={(event) => {
                  if (!isPlainPrimaryClick(event)) return;
                  event.preventDefault();
                  onNavigate(entry.anchor);
                }}
                className={`flex min-h-[44px] min-w-0 flex-1 items-center break-words rounded-md px-2 py-1.5 text-sm [overflow-wrap:anywhere] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 ${active ? 'bg-sky-100 font-semibold text-sky-900 dark:bg-sky-900/40 dark:text-sky-100' : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'}`}
              >
                {entry.label}
              </a>
            </div>
            {children.length > 0 && (
              <div id={alwaysOpen ? undefined : listId} hidden={!open}>
                {open ? renderEntries(children, variant, level + 1) : null}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );

  return (
    <div data-testid="paper-outline" className="min-w-0">
      <div data-testid="paper-outline-stacked" className="lg:hidden">
        <a
          href={`#${documentTargetId}`}
          onClick={(event) => {
            if (!onSkipToDocument || !isPlainPrimaryClick(event)) return;
            event.preventDefault();
            onSkipToDocument();
          }}
          className="mb-3 flex min-h-[44px] items-center rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-sky-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 dark:border-slate-600 dark:bg-slate-900 dark:text-sky-200"
        >
          Skip to document
        </a>
        <nav aria-label="Paper outline">{renderEntries(roots, 'stacked', 0)}</nav>
      </div>
      <div data-testid="paper-outline-desktop" className="hidden lg:block">
        <nav aria-label="Paper outline">{renderEntries(roots, 'desktop', 0)}</nav>
      </div>
    </div>
  );
}
