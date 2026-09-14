'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';

import MathRenderer from '@/components/MathRenderer';
import type {
  AtlasRow,
  WorkspaceMode,
  WorkspaceModel,
} from '@/lib/matrix-options/revised-paper-review';
import {
  isPinEligible,
  placementDomainLabel,
  releaseNoteKey,
  REVIEW_LENSES,
} from '@/lib/matrix-options/revised-paper-review';
import type { PublicationLens } from '@/lib/matrix-options/revised-paper-structure';

export interface RevisedPaperWorkspaceProps {
  readonly model: WorkspaceModel;
  readonly readerText?: string;
}

const STANDALONE_SECTION_ANCHOR_LINE = /^[ \t]*<div[ \t]+id="[^"\r\n]+"[ \t]+class="section-anchor"[ \t]*>[ \t]*<\/div>[ \t]*(?:\r?\n|$)/gm;

export function normalizeReaderTextForDisplay(text: string): string {
  return text.replace(STANDALONE_SECTION_ANCHOR_LINE, '');
}

function humanReviewDateLabel(value: string | null): string {
  return value ?? 'None recorded';
}

function trustArtifactLabel(value: WorkspaceModel['trust']['artifactAuthentication']): string {
  return value === 'EXACT_BYTES_VERIFIED' ? 'Source copy verified' : 'Verification unavailable';
}

function trustProvenanceLabel(value: WorkspaceModel['trust']['provenance']): string {
  if (value === 'REPOSITORY_ARTIFACT') return 'Repository release';
  if (value === 'SOURCE_LINK_IN_PAPER') return 'Paper source link';
  if (value === 'UNKNOWN') return 'Provenance unknown';
  return 'Provenance unavailable';
}

function trustHumanReviewLabel(value: WorkspaceModel['trust']['humanReview']): string {
  if (value === 'RECORDED') return 'Review recorded';
  if (value === 'PARTIAL') return 'Partial review recorded';
  if (value === 'MULTIPLE') return 'Multiple reviews recorded';
  if (value === 'NONE_RECORDED') return 'Not recorded';
  return 'Review unavailable';
}

function trustMappingLabel(value: WorkspaceModel['trust']['mappingConfidence']): string {
  if (value === 'EXACT_SOURCE_RANGE') return 'Exact source mapping';
  if (value === 'EXPLICIT_INTERNAL_LINK') return 'Explicit paper link';
  if (value === 'STRUCTURAL_CONTAINER_ONLY') return 'Structural container only';
  if (value === 'UNMAPPED') return 'Mapping unavailable';
  return 'Mapping unavailable';
}

function trustStalenessLabel(value: WorkspaceModel['trust']['staleness']): string {
  if (value === 'CURRENT_EXACT_RELEASE') return 'Current release';
  if (value === 'CROSS_VERSION_NOT_EVALUATED') return 'Cross-version check unavailable';
  if (value === 'STALE') return 'Stale release';
  if (value === 'UNKNOWN') return 'Staleness unknown';
  return 'Staleness unavailable';
}

function assignmentStateLabel(assignment: WorkspaceModel['assignment']): string {
  if (assignment.state === 'ASSIGNMENT_UNAVAILABLE') return 'Assignment unavailable';
  if (assignment.state === 'NO_ASSIGNMENT') return 'No assignment';
  return 'Assigned';
}

function assignmentSourceLabel(assignment: WorkspaceModel['assignment']): string {
  if (assignment.state === 'ASSIGNMENT_UNAVAILABLE') return 'Assignments are not connected for this release.';
  if (assignment.state === 'NO_ASSIGNMENT') return 'No authoritative assignment exists for this release.';
  return assignment.title;
}

const nonterminalLabels: Record<string, string> = {
  UNASSIGNED: 'Unassigned',
  NOT_STARTED: 'Not started',
  UNAVAILABLE: 'Unavailable',
};

const dispositionLabels: Record<string, string> = {
  FEEDBACK_SUBMITTED: 'Feedback submitted',
  NO_FEEDBACK_CONFIRMED: 'No feedback confirmed',
  DEFERRED_WITH_REASON: 'Deferred with reason',
  ESCALATED_WITH_REASON: 'Escalated with reason',
};

const lensLabel: Record<PublicationLens, string> = {
  all: 'All',
  core: 'Core',
  appendices: 'Appendices',
  evidence: 'Evidence',
  objects: 'Objects',
  questions: 'Questions',
};

function queryHref(model: WorkspaceModel, mode: WorkspaceMode, lens = model.atlas.query.lens, page = 1): string {
  const query = new URLSearchParams({ mode, lens, page: String(page) });
  if (model.atlas.query.q) query.set('q', model.atlas.query.q);
  return `?${query.toString()}`;
}

function destinationHref(model: WorkspaceModel, destination: string): string {
  return `${destination}${queryHref(model, model.mode, model.atlas.query.lens, model.atlas.query.page)}`;
}

function AtlasRowView({ model, row }: { readonly model: WorkspaceModel; readonly row: AtlasRow }) {
  return (
    <li className="border-t border-slate-200 py-3 first:border-t-0 dark:border-slate-700">
      <a href={destinationHref(model, row.href)} className="group block rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600">
        <span className="flex min-w-0 flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          <span>{placementDomainLabel(row.domain)}</span>
          <span aria-hidden="true">|</span>
          <span>Source-linked placement</span>
        </span>
        <span className="mt-1 block min-w-0 break-words text-base font-semibold text-slate-950 group-hover:underline dark:text-white [overflow-wrap:anywhere]">{row.label}</span>
        <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">Authenticated source placement</span>
      </a>
    </li>
  );
}

function Ledger({ model }: { readonly model: WorkspaceModel }) {
  return (
    <section aria-labelledby="review-ledgers" className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <h2 id="review-ledgers" className="text-base font-bold">Review ledgers</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold">Disposition summary</h3>
          <dl className="mt-2 space-y-1 text-sm">
            {Object.entries(model.ledgers.dispositions).map(([key, value]) => (
              <div key={key} className="flex justify-between gap-4"><dt>{dispositionLabels[key] ?? key}</dt><dd className="font-mono">{value}{(key === 'DEFERRED_WITH_REASON' || key === 'ESCALATED_WITH_REASON') && <span className="ml-2 font-sans text-xs text-amber-700 dark:text-amber-300">unresolved</span>}</dd></div>
            ))}
          </dl>
        </div>
        <div>
          <h3 className="text-sm font-semibold">Nonterminal status</h3>
          <dl className="mt-2 space-y-1 text-sm">
            {Object.entries(model.ledgers.nonterminal).map(([key, value]) => (
              <div key={key} className="flex justify-between gap-4"><dt>{nonterminalLabels[key] ?? key}</dt><dd className="font-mono">{value}</dd></div>
            ))}
          </dl>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Counts are structural workspace state. No percentage, score, receipt, or human decision is inferred.</p>
    </section>
  );
}

function TrustStrip({ model, drawerOpen, onOpen, openerRef }: { readonly model: WorkspaceModel; readonly drawerOpen: boolean; readonly onOpen: () => void; readonly openerRef: RefObject<HTMLButtonElement | null> }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900" data-trust-strip data-testid="trust-strip" aria-labelledby="trust-strip-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 id="trust-strip-title" className="text-sm font-bold">Release trust</h2><p className="mt-1 font-mono text-xs text-slate-600 dark:text-slate-300">{model.documentVersion}</p></div>
        <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100">{trustArtifactLabel(model.trust.artifactAuthentication)}</span>
      </div>
      <dl className="mt-3 grid min-w-0 gap-2 text-xs sm:grid-cols-2">
        <div className="min-w-0"><dt className="text-slate-500">Provenance</dt><dd className="min-w-0 break-words font-semibold [overflow-wrap:anywhere]">{trustProvenanceLabel(model.trust.provenance)}</dd></div>
        <div className="min-w-0"><dt className="text-slate-500">Human review</dt><dd className="min-w-0 break-words font-semibold [overflow-wrap:anywhere]">{trustHumanReviewLabel(model.trust.humanReview)}</dd></div>
        <div className="min-w-0"><dt className="text-slate-500">Review date</dt><dd className="min-w-0 break-words font-semibold [overflow-wrap:anywhere]">{humanReviewDateLabel(model.trust.humanReviewDate)}</dd></div>
        <div className="min-w-0"><dt className="text-slate-500">Mapping</dt><dd className="min-w-0 break-words font-semibold [overflow-wrap:anywhere]">{trustMappingLabel(model.trust.mappingConfidence)}</dd></div>
        <div className="min-w-0"><dt className="text-slate-500">Staleness</dt><dd className="min-w-0 break-words font-semibold [overflow-wrap:anywhere]">{trustStalenessLabel(model.trust.staleness)}</dd></div>
      </dl>
      <p className="mt-3 text-xs text-slate-600 dark:text-slate-300">Exact bytes do not establish scientific verification, adoption, publication, endorsement, or human review.</p>
      <button ref={openerRef} type="button" className="mt-3 min-h-[44px] rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold dark:border-slate-600" aria-controls="context-drawer" aria-expanded={drawerOpen} onClick={onOpen}>{drawerOpen ? 'Context open' : 'Open context'}</button>
    </section>
  );
}

export function RevisedPaperWorkspace({ model, readerText }: RevisedPaperWorkspaceProps) {
  const displayReaderText = readerText ? normalizeReaderTextForDisplay(readerText) : '';
  const selectedRow = model.atlas.rows[0];
  const noteId = selectedRow?.id ?? 'workspace';
  const noteKey = useMemo(() => releaseNoteKey(model.releaseIdentity, noteId), [model.releaseIdentity, noteId]);
  const [note, setNote] = useState('');
  const [pinPreference, setPinPreference] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pinEligible, setPinEligible] = useState(false);
  const [measuredLayout, setMeasuredLayout] = useState({ widthPx: 0, overflowPx: 0 });
  const readerColumnRef = useRef<HTMLElement>(null);
  const drawerOpenerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setNote(window.localStorage.getItem(noteKey) ?? '');
  }, [noteKey]);

  useEffect(() => {
    const readerColumn = readerColumnRef.current;
    if (!readerColumn) return undefined;
    const measure = () => {
      const rootFontSizePx = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
      const documentOverflow = Math.max(
        0,
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
        (document.body?.scrollWidth ?? 0) - document.documentElement.clientWidth,
      );
      const widthPx = readerColumn.getBoundingClientRect().width;
      setMeasuredLayout({ widthPx, overflowPx: documentOverflow });
      setPinEligible(isPinEligible(widthPx, rootFontSizePx, documentOverflow));
    };
    measure();
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    resizeObserver?.observe(readerColumn);
    resizeObserver?.observe(document.documentElement);
    const rootMutationObserver = typeof MutationObserver === 'undefined' ? null : new MutationObserver(measure);
    rootMutationObserver?.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] });
    window.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('resize', measure);
    document.fonts?.addEventListener('loadingdone', measure);
    return () => {
      resizeObserver?.disconnect();
      rootMutationObserver?.disconnect();
      window.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('resize', measure);
      document.fonts?.removeEventListener('loadingdone', measure);
    };
  }, []);

  useEffect(() => {
    if (!pinEligible && pinPreference) setDrawerOpen(false);
  }, [pinEligible, pinPreference]);

  const saveNote = (value: string) => {
    setNote(value);
    window.localStorage.setItem(noteKey, value);
  };

  const pinActive = pinEligible && pinPreference;
  const closeDrawer = () => {
    setDrawerOpen(false);
    drawerOpenerRef.current?.focus();
  };
  const togglePin = () => {
    if (!pinEligible) return;
    setPinPreference((current) => {
      const next = !current;
      if (next) setDrawerOpen(true);
      else {
        setDrawerOpen(false);
        drawerOpenerRef.current?.focus();
      }
      return next;
    });
  };
  return (
    <main className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950 dark:text-slate-100" data-pin-eligible={pinEligible ? 'true' : 'false'} data-pin-preference={pinPreference ? 'true' : 'false'} data-reader-width-px={measuredLayout.widthPx} data-page-overflow-px={measuredLayout.overflowPx}>
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 print:hidden">
        <div className="mx-auto flex max-w-[120rem] flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">Matrix Options Paper</p>
            <h1 className="text-xl font-bold">Review workspace</h1>
            <p className="font-mono text-xs text-slate-500 dark:text-slate-400">{model.documentVersion}</p>
          </div>
          <nav aria-label="Workspace mode" className="flex min-h-[44px] items-center gap-1 rounded-lg border border-slate-200 p-1 dark:border-slate-700">
            <a href={queryHref(model, 'my-review')} aria-current={model.mode === 'my-review' ? 'page' : undefined} className={`rounded-md px-3 py-2 text-sm font-semibold ${model.mode === 'my-review' ? 'bg-sky-700 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}>My Review</a>
            <a href={queryHref(model, 'publication')} aria-current={model.mode === 'publication' ? 'page' : undefined} className={`rounded-md px-3 py-2 text-sm font-semibold ${model.mode === 'publication' ? 'bg-sky-700 text-white' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}>Publication</a>
          </nav>
        </div>
      </header>

      <div className="mx-auto grid max-w-[120rem] gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[14rem_minmax(0,1fr)_18rem] print:block print:max-w-none print:px-0 print:py-0">
        <aside className="lg:sticky lg:top-4 lg:self-start print:hidden" aria-label="Workspace navigation">
          <details className="rounded-xl border border-slate-200 bg-white p-3 lg:hidden dark:border-slate-700 dark:bg-slate-900">
            <summary className="cursor-pointer font-semibold">Publication lenses</summary>
            <LensNav model={model} />
          </details>
          <div className="hidden rounded-xl border border-slate-200 bg-white p-3 lg:block dark:border-slate-700 dark:bg-slate-900"><h2 className="mb-2 text-sm font-bold">Publication lenses</h2><LensNav model={model} /></div>
        </aside>

        <section className="min-w-0 space-y-5" aria-label="Publication workspace" ref={readerColumnRef}>
          <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900 print:hidden">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h2 className="text-lg font-bold">{model.mode === 'my-review' ? 'My Review cockpit' : 'Publication cockpit'}</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">One authenticated paper release, one bounded server window.</p></div>
              <span className="max-w-full break-words rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-950 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100 [overflow-wrap:anywhere]">{assignmentStateLabel(model.assignment)}</span>
            </div>
            <p className="mt-4 min-w-0 break-words text-sm [overflow-wrap:anywhere]">Assignment source: {assignmentSourceLabel(model.assignment)}</p>
          </section>

          <section aria-labelledby="atlas-heading" className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900 print:hidden">
            <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 id="atlas-heading" className="text-lg font-bold">Publication Atlas</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{model.atlas.totalMatches} matching placements; page {model.atlas.query.page} of {model.atlas.totalPages}.</p></div></div>
            <form method="get" className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end" role="search">
              <input type="hidden" name="mode" value={model.mode} /><input type="hidden" name="lens" value={model.atlas.query.lens} />
              <label className="flex-1 text-sm font-semibold">Search labels<input name="q" defaultValue={model.atlas.query.q} maxLength={160} className="mt-1 block min-h-[44px] w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-normal dark:border-slate-600 dark:bg-slate-950" /></label>
              <button type="submit" className="min-h-[44px] rounded-md bg-sky-700 px-4 py-2 font-semibold text-white hover:bg-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600">Search</button>
            </form>
            <ol className="mt-4" aria-label="Current atlas page">{model.atlas.rows.map((row) => <AtlasRowView key={`${row.id}-${row.startByte}`} model={model} row={row} />)}</ol>
            <nav aria-label="Atlas pages" className="mt-4 flex flex-wrap gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
              {model.atlas.hasPrevious && <a href={queryHref(model, model.mode, model.atlas.query.lens, model.atlas.query.page - 1)} className="min-h-[44px] rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold dark:border-slate-600">Previous</a>}
              {model.atlas.hasNext && <a href={queryHref(model, model.mode, model.atlas.query.lens, model.atlas.query.page + 1)} className="min-h-[44px] rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold dark:border-slate-600">Next</a>}
            </nav>
          </section>

          <section aria-labelledby="reader-heading" className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900 print:col-span-full print:w-full print:max-w-none print:border-0 print:bg-transparent print:p-0">
            <h2 id="reader-heading" className="text-lg font-bold">Canonical reader</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Reader content is sourced from the authenticated release and selected range.</p>
            {selectedRow && <h3 className="mt-4 text-base font-semibold">{selectedRow.label}</h3>}
            {model.readerContext.selectedId && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Selected canonical section is linked to {model.readerContext.ancestors.length} authenticated ancestors and {model.readerContext.neighborhood.length} nearby headings.</p>}
            {readerText && <div className="mt-3 min-w-0 rounded-lg bg-slate-50 p-4 dark:bg-slate-950"><MathRenderer content={displayReaderText} /></div>}
            <section aria-labelledby="question-packet-heading" className="mt-5 rounded-lg border border-slate-200 p-4 dark:border-slate-700 print:hidden"><h3 id="question-packet-heading" className="font-semibold">Unassigned publication questions</h3><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">This packet is structural only; no assignment, inventory, progress, or disposition is created.</p><ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">{model.questionPacket.map((question) => <li key={question.id}><a className="underline" href={destinationHref(model, `/matrix-options/paper/publication/v/${encodeURIComponent(model.documentVersion)}/questions/${encodeURIComponent(question.id)}`)}>{question.label}</a></li>)}</ol></section>
          </section>

          <div className="print:hidden"><Ledger model={model} /></div>
        </section>

        <aside className={`space-y-5 ${pinActive ? 'lg:sticky lg:top-4 lg:self-start' : ''} print:hidden`} aria-label="Context and notes" data-testid="context-rail" data-pinned={pinActive ? 'true' : 'false'}>
          <TrustStrip model={model} drawerOpen={drawerOpen} onOpen={() => setDrawerOpen(true)} openerRef={drawerOpenerRef} />
          {drawerOpen && <div id="context-drawer" role="dialog" aria-labelledby="context-drawer-title" className="space-y-5 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900" data-testid="context-drawer">
            <div className="flex items-center justify-between gap-3"><h2 id="context-drawer-title" className="font-bold">Context details</h2><button type="button" className="min-h-[44px] rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold dark:border-slate-600" onClick={closeDrawer}>Close context</button></div>
            <section><h3 className="font-bold">Device-local note</h3><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Stored only on this device and release/item namespaced.</p><label className="mt-3 block text-sm font-semibold">Note<textarea value={note} onChange={(event) => saveNote(event.target.value)} className="mt-1 block min-h-24 w-full rounded-md border border-slate-300 bg-white p-2 font-normal dark:border-slate-600 dark:bg-slate-950" /></label></section>
            <section className="text-sm"><h3 className="font-bold">Context rail</h3><p className="mt-1">Pinning is {pinActive ? 'on.' : pinEligible ? 'available at or above 45rem.' : 'disabled below 45rem.'}</p><button type="button" className="mt-3 min-h-[44px] rounded-md border border-slate-300 px-3 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600" aria-pressed={pinActive} disabled={!pinEligible} onClick={togglePin}>{pinActive ? 'Unpin context' : 'Pin context'}</button></section>
          </div>}
        </aside>
      </div>
    </main>
  );
}

function LensNav({ model }: { readonly model: WorkspaceModel }) {
  return <nav aria-label="Publication lenses"><ul className="space-y-1">{REVIEW_LENSES.map((lens) => <li key={lens}><a href={queryHref(model, model.mode, lens)} aria-current={model.atlas.query.lens === lens ? 'page' : undefined} className="flex min-h-[44px] items-center justify-between rounded-md px-2 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"><span>{lensLabel[lens]}</span><span className="font-mono text-xs">{lens === model.atlas.query.lens ? model.atlas.totalMatches : '-'}</span></a></li>)}</ul></nav>;
}
