'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

import type { PaperOutlineEntry } from '@/lib/matrix-options/paper/full-document';
import { buildPaperNavGroups, paperNavGroupKey, paperNavPath } from '@/lib/matrix-options/paper/paper-nav-groups';
import type { PaperNavGroup, PaperNavNode } from '@/lib/matrix-options/paper/paper-nav-groups';
import { workingDraftSectionHref } from '@/lib/matrix-options/paper/url-state';
import { cn } from '@/utils/cn';

/**
 * `parentId`, `childIds` and `level` are the READER hierarchy
 * (outline-hierarchy.ts), which follows the paper's section numbering; `depth`
 * is the authored heading depth, kept only because the section loader groups
 * by depth-1 headings (owningSectionIndex). Display never reads `depth`.
 */
export type PaperOutlineNavEntry = Pick<PaperOutlineEntry, 'id' | 'anchor' | 'label' | 'depth' | 'parentId' | 'childIds'> & { readonly level: number };

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
 * Paper Navigation.
 * - Two presentation groups, "Main Report" and "Appendices"
 *   (paper-nav-groups.ts). Both start collapsed unless they contain the URL
 *   target or the section in view; navigating or deep-linking to a section
 *   opens only its group and its ancestors, and nothing is ever closed for the
 *   reader.
 * - Main Report: its chapters are collapsible. Appendices: each appendix is
 *   one collapsible row with a compact letter badge (one restrained tint).
 * - Exact "Master Table of Contents" entries are not listed.
 * - Below lg a "Skip to document" link leads the list. Every link and
 *   disclosure is at least 44px tall at every width (M1-09).
 */
export function PaperOutlineNav({ outline, activeAnchor, targetAnchor, documentTargetId, onNavigate, onSkipToDocument }: PaperOutlineNavProps) {
  const groups = useMemo(() => buildPaperNavGroups(outline), [outline]);
  const indexed = useMemo(() => new Map(outline.map((entry, index) => [entry.id, index])), [outline]);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set(paperNavPath(groups, outline, targetAnchor)));

  // Disclosures the reader closed by hand: scrolling (the section in view)
  // never reopens them; an explicit target (a navigation or deep link) does.
  const [closedByReader, setClosedByReader] = useState<ReadonlySet<string>>(() => new Set());
  useEffect(() => {
    const required = [
      ...paperNavPath(groups, outline, targetAnchor),
      ...paperNavPath(groups, outline, activeAnchor).filter((id) => !closedByReader.has(id)),
    ];
    if (required.length === 0) return;
    setExpanded((previous) => (required.every((id) => previous.has(id)) ? previous : new Set([...previous, ...required])));
  }, [groups, outline, targetAnchor, activeAnchor, closedByReader]);

  const toggle = useCallback((id: string) => {
    setExpanded((previous) => {
      const next = new Set(previous);
      const closing = next.has(id);
      if (closing) next.delete(id);
      else next.add(id);
      setClosedByReader((closed) => {
        const updated = new Set(closed);
        if (closing) updated.add(id);
        else updated.delete(id);
        return updated;
      });
      return next;
    });
  }, []);

  const disclosureClasses = 'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-[var(--db-text-secondary)] hover:bg-[var(--db-depth-1)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--db-focus-ring)]';
  const chevron = (open: boolean) => <ChevronRight aria-hidden="true" className={cn('h-4 w-4 motion-safe:transition-transform motion-reduce:transition-none', open && 'rotate-90')} />;

  const renderNodes = (nodes: readonly PaperNavNode<PaperOutlineNavEntry>[], variant: OutlineVariant, level: number): ReactNode => (
    <ul className={level === 0 ? 'space-y-0.5' : 'mt-0.5 space-y-0.5 border-l border-[var(--db-border)] pl-3'}>
      {nodes.map((node) => {
        const { entry } = node;
        const index = indexed.get(entry.id) ?? 0;
        const open = expanded.has(entry.id);
        const listId = `paper-outline-${variant}-children-${index}`;
        const active = entry.anchor === activeAnchor;
        return (
          <li key={entry.id} data-appendix={node.badge}>
            <div className="flex min-w-0 items-start gap-1">
              {node.children.length > 0 ? (
                <button type="button" aria-expanded={open} aria-controls={listId} aria-label={`Subsections of ${entry.label}`} onClick={() => toggle(entry.id)} className={disclosureClasses}>
                  {chevron(open)}
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
                className={cn(
                  'flex min-h-[44px] min-w-0 flex-1 items-center gap-2 break-words rounded-md px-2 py-1.5 text-sm [overflow-wrap:anywhere] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--db-focus-ring)]',
                  active ? 'bg-[var(--db-accent-tint)] font-semibold text-[var(--db-text-primary)]' : 'text-[var(--db-text-primary)] hover:bg-[var(--db-depth-1)]',
                )}
              >
                {node.badge ? (
                  <span aria-hidden="true" className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-[var(--db-sediment-tint-border)] bg-[var(--db-sediment-tint)] text-[0.6875rem] font-semibold text-[var(--db-text-primary)]">{node.badge}</span>
                ) : null}
                <span className="min-w-0">{entry.label}</span>
              </a>
            </div>
            {node.children.length > 0 && (
              <div id={listId} hidden={!open}>
                {open ? renderNodes(node.children, variant, level + 1) : null}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );

  const renderGroups = (variant: OutlineVariant): ReactNode => (
    <ul className="space-y-2">
      {groups.map((group: PaperNavGroup<PaperOutlineNavEntry>) => {
        if (group.nodes.length === 0) return null;
        const key = paperNavGroupKey(group.id);
        const open = expanded.has(key);
        const listId = `paper-outline-${variant}-group-${group.id}`;
        return (
          <li key={group.id} data-testid={`paper-nav-group-${group.id}`} data-open={open ? 'true' : 'false'}>
            <button
              type="button"
              aria-expanded={open}
              aria-controls={listId}
              onClick={() => toggle(key)}
              className="flex min-h-[44px] w-full min-w-0 items-center gap-1 rounded-md pr-2 text-left text-sm font-semibold text-[var(--db-text-primary)] hover:bg-[var(--db-depth-1)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--db-focus-ring)]"
            >
              <span aria-hidden="true" className="inline-flex h-11 w-11 shrink-0 items-center justify-center text-[var(--db-text-secondary)]">{chevron(open)}</span>
              <span className="min-w-0 flex-1">{group.label}</span>
            </button>
            <div id={listId} hidden={!open}>
              {open ? renderNodes(group.nodes, variant, 0) : null}
            </div>
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
          className="mb-3 flex min-h-[44px] items-center rounded-md border border-[var(--db-border-strong)] bg-[var(--db-surface)] px-3 text-sm font-semibold text-[var(--db-accent-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--db-focus-ring)]"
        >
          Skip to document
        </a>
        <nav aria-label="Paper navigation">{renderGroups('stacked')}</nav>
      </div>
      <div data-testid="paper-outline-desktop" className="hidden lg:block">
        <nav aria-label="Paper navigation">{renderGroups('desktop')}</nav>
      </div>
    </div>
  );
}
