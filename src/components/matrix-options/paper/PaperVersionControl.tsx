'use client';

import { useRef, useState } from 'react';
import { Check, ChevronDown, Layers } from 'lucide-react';

import { getPaperRelease, PAPER_RELEASES, PAPER_WITHHELD_NOTICE_ID } from '@/lib/matrix-options/paper/releases';
import type { PaperRelease } from '@/lib/matrix-options/paper/releases';
import { paperWorkspaceHref } from '@/lib/matrix-options/paper/url-state';
import type { PaperMode } from '@/lib/matrix-options/paper/url-state';
import { cn } from '@/utils/cn';

import { PaperPopover } from './PaperPopover';

/*
 * Draft version control for the paper workspace.
 *
 * Two parts, both small:
 * - a header button that names the draft on screen and opens a popover listing
 *   the bound drafts (the same anchored popover Download Files uses);
 * - a one-line status under the header, shown ONLY for a draft that is not the
 *   default, so a reader always knows the draft on screen is not the one the
 *   workspace opens by default.
 *
 * Switching drafts is plain navigation (a link), so it works with a new tab,
 * middle click and a copied address. The reader's place is carried by STABLE
 * section id, which is identical across drafts: the link goes to the other
 * draft's section route, which resolves the id in that draft (a retired section
 * lands on the section that replaced it; an id that draft does not have lands
 * on its start). The open question is never carried: question ids belong to one
 * draft, and a response belongs to the draft it was written for.
 */

export const PAPER_VERSION_PANEL_ID = 'paper-version-panel';

export interface PaperVersionLinkContext {
  readonly mode: PaperMode;
  /** My Review: the selected review topic (topic ids are the same in every draft). */
  readonly cohort: string | null;
  /** Working Draft: the stable id of the section being read, when it has one. */
  readonly stableSectionId: string | null;
}

/** Where switching to `release` goes, keeping the reader's mode and (where it exists) their place. */
export function paperVersionHref(release: Pick<PaperRelease, 'documentVersion'>, context: PaperVersionLinkContext): string {
  if (context.mode === 'my-review') return paperWorkspaceHref(release.documentVersion, { mode: 'my-review', cohort: context.cohort, q: null, section: null });
  if (context.stableSectionId) return `/matrix-options/paper/v/${encodeURIComponent(release.documentVersion)}/${encodeURIComponent(context.stableSectionId)}`;
  return paperWorkspaceHref(release.documentVersion, { mode: 'working-draft', cohort: null, q: null, section: null });
}

export interface PaperVersionControlProps extends PaperVersionLinkContext {
  readonly documentVersion: string;
  readonly buttonClassName: string;
  /** Called when the popover opens, so the header can close its other popovers. */
  readonly onOpen?: () => void;
}

export function PaperVersionControl({ documentVersion, buttonClassName, onOpen, ...context }: PaperVersionControlProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const current = getPaperRelease(documentVersion);
  if (!current) return null;
  const close = () => {
    setOpen(false);
    triggerRef.current?.focus({ preventScroll: true });
  };
  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        data-testid="paper-version-toggle"
        title={`Draft version: ${current.label}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={PAPER_VERSION_PANEL_ID}
        onClick={() => {
          if (!open) onOpen?.();
          setOpen((value) => !value);
        }}
        className={cn(buttonClassName, 'border border-[var(--db-border-strong)] text-[var(--db-text-primary)] hover:bg-[var(--db-depth-1)]', open && 'bg-[var(--db-depth-1)]')}
      >
        <Layers aria-hidden="true" className="h-4 w-4" />
        {/* The space is its own text node: whitespace at the edge of a visually hidden span is not reliably kept in the accessible name.
            Between lg and xl the header has no room for the label beside Download Files (the rail toggles are icon-only there too),
            so the label is visually hidden and the button keeps its full accessible name and a tooltip. */}
        <span><span className="sr-only">Draft version:</span>{' '}<span data-testid="paper-version-toggle-label" className="lg:sr-only xl:not-sr-only">{current.shortLabel}</span></span>
        <ChevronDown aria-hidden="true" className={cn('h-3.5 w-3.5 transition-transform motion-reduce:transition-none', open && 'rotate-180')} />
      </button>
      <PaperPopover id={PAPER_VERSION_PANEL_ID} testId="paper-version-popover" open={open} triggerRef={triggerRef} label="Draft version" width={340} onClose={() => setOpen(false)}>
        <div className="space-y-2 p-2 text-sm">
          <h2 className="font-semibold">Draft version</h2>
          <ul className="space-y-1">
            {PAPER_RELEASES.map((release) => {
              const selected = release.documentVersion === current.documentVersion;
              const body = (
                <>
                  <span className="flex items-center gap-2 font-medium text-[var(--db-text-primary)]">
                    {release.label}
                    {selected ? <Check aria-hidden="true" className="h-4 w-4 text-[var(--db-accent-strong)] dark:text-[var(--db-accent)]" /> : null}
                  </span>
                  <span className="mt-0.5 block text-xs text-[var(--db-text-secondary)]">{release.summary}</span>
                </>
              );
              return (
                <li key={release.documentVersion}>
                  {selected ? (
                    <div data-testid={`paper-version-option-${release.documentVersion}`} aria-current="true" className="rounded-md bg-[var(--db-accent-tint)] px-3 py-2">
                      {body}
                      <span className="sr-only">You are viewing this draft.</span>
                    </div>
                  ) : (
                    <a
                      href={paperVersionHref(release, context)}
                      data-testid={`paper-version-option-${release.documentVersion}`}
                      className="block min-h-[44px] rounded-md px-3 py-2 hover:bg-[var(--db-depth-1)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--db-focus-ring)]"
                    >
                      {body}
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
          <button type="button" onClick={close} className="inline-flex min-h-[44px] items-center rounded-md px-2 text-sm font-medium text-[var(--db-accent-strong)] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--db-focus-ring)] dark:text-[var(--db-accent)]">Close</button>
        </div>
      </PaperPopover>
    </>
  );
}

/**
 * The status line for a draft that is not the default. Nothing is rendered for
 * the default draft, so its header is exactly what it was.
 */
export function PaperVersionStatus({ documentVersion, ...context }: { readonly documentVersion: string } & PaperVersionLinkContext) {
  const current = getPaperRelease(documentVersion);
  const fallback = PAPER_RELEASES.find((release) => release.activation === 'DEFAULT');
  if (!current || current.activation === 'DEFAULT' || !fallback) return null;
  return (
    <p data-testid="paper-version-status" role="note" className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--db-review-tint-border)] bg-[var(--db-review-tint)] px-4 py-1.5 text-sm text-[var(--db-text-primary)] sm:px-6 print:hidden">
      <span className="min-w-0">
        <strong className="font-semibold">{current.label}.</strong> A preview: not the default draft. Responses to this draft are separate from the earlier draft.
      </span>
      {/* A full 44px touch target on phones and tablets; from lg up the line stays one compact row. */}
      <a href={paperVersionHref(fallback, context)} data-testid="paper-version-status-default-link" className="inline-flex min-h-[44px] items-center font-medium lg:min-h-[32px] text-[var(--db-accent-strong)] underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--db-focus-ring)] dark:text-[var(--db-accent)]">
        Go to the earlier draft
      </a>
    </p>
  );
}

/**
 * The one notice for a release that does not present a section of its source
 * (releases.ts `withheld`). Nothing is rendered for any other release. It is
 * EDITORIAL: a sentence of the workspace about the presentation, never a sentence
 * of the paper. It says so itself ("Workspace note", the tinted band the status
 * line above it uses, the interface typeface) and is no part of the paper text. It sits
 * outside the paper and outside the workspace header, which does not print: in
 * the Working Draft it prints above the paper, whose printout lacks the section
 * too; in My Review, where no paper text prints, it is hidden in print.
 *
 * It is also where a link to the withheld section lands (the workspace scrolls
 * to it and focuses it), so it carries the notice id and can take focus without
 * being a tab stop. It sits outside the document column, so the page is its
 * scrollport at every width: its scroll margin is the sticky header height plus
 * the gap a paper section keeps, with no lg override.
 */
export function PaperWithheldNotice({ documentVersion, mode }: { readonly documentVersion: string; readonly mode: PaperMode }) {
  const notice = getPaperRelease(documentVersion)?.withheld?.notice;
  if (!notice) return null;
  return (
    <p id={PAPER_WITHHELD_NOTICE_ID} tabIndex={-1} data-testid="paper-withheld-notice" role="note" data-editorial-notice="" className={cn('flex min-w-0 shrink-0 scroll-mt-[calc(var(--paper-sticky-header-height,6rem)+0.5rem)] flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b border-[var(--db-review-tint-border)] bg-[var(--db-review-tint)] px-4 py-1.5 font-[family-name:var(--db-font-ui)] text-sm text-[var(--db-text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--db-focus-ring)] sm:px-6 print:border print:border-black print:bg-transparent print:px-2 print:py-1 print:mb-3 print:text-black', mode === 'my-review' && 'print:hidden')}>
      {/* Said by the workspace, not by the paper: the label and the tinted band (a ruled box in print) mark it as editorial. */}
      <span data-testid="paper-withheld-notice-label" className="shrink-0 text-xs font-semibold uppercase tracking-wide text-[var(--db-text-secondary)] print:text-black">Workspace note</span>
      <span data-testid="paper-withheld-notice-text" className="min-w-0">{notice}</span>
    </p>
  );
}
