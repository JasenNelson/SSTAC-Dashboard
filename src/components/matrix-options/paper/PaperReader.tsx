import Link from 'next/link';
import {
  AlertTriangle,
  Ban,
  Calculator,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileWarning,
  GitBranch,
  MessageCircleQuestion,
  PencilLine,
  Scale,
} from 'lucide-react';

import type {
  PaperContentProvider,
  PaperFigureAsset,
  PaperFragment,
  PaperManifest,
  PaperSection,
  PaperStatusAnnotation,
} from '@/lib/matrix-options/paper/contracts';
import { syntheticPaperProvider } from '@/lib/matrix-options/paper/provider';

function sectionHref(documentVersion: string, stableSectionId: string): string {
  return `/matrix-options/paper/v/${encodeURIComponent(documentVersion)}/${encodeURIComponent(stableSectionId)}`;
}

const AUTHORITY_LABELS = {
  STATUTE: 'Statute',
  REGULATION: 'Regulation',
  ENV_PROTOCOL: 'ENV protocol',
  ENV_POLICY: 'ENV policy',
  PROJECT_PLAN: 'Project plan',
  DRAFT_ANALYSIS: 'Draft analysis',
  NOT_APPLICABLE: 'Not applicable',
} as const satisfies Record<PaperStatusAnnotation['authorityKind'], string>;

const DECISION_AUTHORITY_LABELS = {
  ENV_LEGAL_DECISION_MAKER: 'ENV legal decision maker',
  PHASE2_PROJECT_GOVERNANCE: 'Phase 2 project governance',
  CONTENT_VALIDATOR_ONLY: 'Content validator only',
  NOT_APPLICABLE: 'Not applicable',
} as const satisfies Record<PaperStatusAnnotation['decisionAuthority'], string>;

const REVIEWER_ROLE_LABELS = {
  ADVISORY_ERROR_GAP_SOURCE_INPUT: 'Advisory error, gap, and source input only; not a decision or approval and does not grant authority',
  TECHNICAL_VALIDATION: 'Technical validation',
  CONTENT_STEWARDSHIP: 'Content stewardship',
  NOT_APPLICABLE: 'Not applicable',
} as const satisfies Record<PaperStatusAnnotation['reviewerRole'], string>;

export const PAPER_STATUS_PRESENTATIONS = {
  IN_FORCE_LEGAL_OR_POLICY: {
    label: 'In force - <authority-kind label>',
    signal: 'In-force authority source',
    iconName: 'scale',
    Icon: Scale,
    className: 'border-solid border-blue-950 bg-blue-950 text-white dark:border-blue-200 dark:bg-blue-950 dark:text-blue-50',
    explanation: 'Validated source subtype; this record identifies a source kind and does not create or expand authority.',
  },
  PROJECT_PLAN_DIRECTION: {
    label: 'Project-plan direction',
    signal: 'Project-plan direction',
    iconName: 'clipboard-list',
    Icon: ClipboardList,
    className: 'border-2 border-solid border-indigo-700 bg-transparent text-indigo-950 dark:border-indigo-300 dark:text-indigo-100',
    explanation: 'Outlined project-plan direction; this is not a completion or approval checkmark.',
  },
  OPEN_OPTION: {
    label: 'Open option',
    signal: 'Branching open option',
    iconName: 'git-branch',
    Icon: GitBranch,
    className: 'border-2 border-solid border-amber-600 bg-transparent text-amber-950 dark:border-amber-300 dark:text-amber-100',
    explanation: 'Branching alternative requiring evaluation or a decision.',
  },
  EMERGING_DRAFT_DIRECTION: {
    label: 'Emerging draft direction',
    signal: 'Not-adopted draft direction',
    iconName: 'pencil-line',
    Icon: PencilLine,
    className: 'border-2 border-dotted border-violet-700 bg-violet-50 text-violet-950 dark:border-violet-300 dark:bg-violet-950 dark:text-violet-100',
    explanation: 'Not adopted: this is preliminary rough-draft direction.',
  },
  ILLUSTRATIVE_VALUE_OR_CALCULATION: {
    label: 'Illustrative only',
    signal: 'Illustrative calculation',
    iconName: 'calculator',
    Icon: Calculator,
    className: 'border-solid border-cyan-700 bg-cyan-50 text-cyan-950 dark:border-cyan-300 dark:bg-cyan-950 dark:text-cyan-100',
    explanation: 'Illustrative calculation only; this is not a standard or a success state.',
  },
  KNOWN_GAP_OR_UNVERIFIED: {
    label: 'Gap / unverified',
    signal: 'Unverified-content warning',
    iconName: 'alert-triangle',
    Icon: AlertTriangle,
    className: 'border-solid border-rose-700 bg-rose-50 text-rose-950 dark:border-rose-300 dark:bg-rose-950 dark:text-rose-100',
    explanation: 'Warning: missing or unverified material requires follow-up.',
  },
  FUTURE_TASK: {
    label: 'Future task',
    signal: 'Scheduled future task',
    iconName: 'calendar-days',
    Icon: CalendarDays,
    className: 'border-2 border-dashed border-gray-600 bg-gray-50 text-gray-950 dark:border-gray-300 dark:bg-gray-950 dark:text-gray-100',
    explanation: 'Calendar and task marker for work scheduled later.',
  },
  OUT_OF_PHASE2_SCOPE: {
    label: 'Outside Phase 2',
    signal: 'Phase 2 boundary',
    iconName: 'ban',
    Icon: Ban,
    className: 'border-2 border-solid border-zinc-800 bg-transparent text-zinc-950 dark:border-zinc-300 dark:text-zinc-100',
    explanation: 'Boundary marker for a matter outside Phase 2.',
  },
  REVIEW_QUESTION: {
    label: 'Review question',
    signal: 'Advisory comment question',
    iconName: 'message-circle-question',
    Icon: MessageCircleQuestion,
    className: 'border-solid border-yellow-600 bg-yellow-100 text-yellow-950 dark:border-yellow-300 dark:bg-yellow-950 dark:text-yellow-100',
    explanation: 'Advisory review input is requested; this is not a decision, approval, endorsement, or authority grant.',
  },
} as const satisfies Record<PaperStatusAnnotation['statusCode'], {
  label: string;
  signal: string;
  iconName: string;
  Icon: typeof Scale;
  className: string;
  explanation: string;
}>;

export function paperStatusLabel(annotation: PaperStatusAnnotation): string {
  const label = PAPER_STATUS_PRESENTATIONS[annotation.statusCode].label;
  return annotation.statusCode === 'IN_FORCE_LEGAL_OR_POLICY'
    ? label.replace('<authority-kind label>', AUTHORITY_LABELS[annotation.authorityKind])
    : label;
}

function paperTargetLabel(annotation: PaperStatusAnnotation): string {
  return annotation.target.kind === 'BLOCK'
    ? `Block ${annotation.target.blockId}`
    : `Entity ${annotation.target.entityId}`;
}

export function PaperStatusAnnotationCard({ annotation }: { annotation: PaperStatusAnnotation }) {
  const presentation = PAPER_STATUS_PRESENTATIONS[annotation.statusCode];
  const StatusIcon = presentation.Icon;
  return (
    <section
      data-status-code={annotation.statusCode}
      data-status-icon={presentation.iconName}
      data-annotation-id={annotation.annotationId}
      className={`rounded-lg border px-4 py-3 text-sm ${presentation.className}`}
    >
      <div className="flex items-start gap-2 font-semibold">
        <StatusIcon className="mt-0.5 h-4 w-4 shrink-0" role="img" aria-label={presentation.signal} />
        <span>{paperStatusLabel(annotation)}</span>
      </div>
      <p className="mt-1"><span className="font-semibold">Target:</span> {paperTargetLabel(annotation)}</p>
      <p className="mt-1"><span className="font-semibold">Status meaning:</span> {presentation.explanation}</p>
      <p className="mt-1"><span className="font-semibold">Authority:</span> {AUTHORITY_LABELS[annotation.authorityKind]}</p>
      <p className="mt-1"><span className="font-semibold">Decision authority:</span> {DECISION_AUTHORITY_LABELS[annotation.decisionAuthority]}</p>
      <p className="mt-1"><span className="font-semibold">Reviewer role:</span> {REVIEWER_ROLE_LABELS[annotation.reviewerRole]}</p>
      {annotation.statusCode === 'IN_FORCE_LEGAL_OR_POLICY' && (
        <>
          <p className="mt-1"><span className="font-semibold">Authority meaning:</span> The subtype identifies the kind of validated source; it does not create or expand authority.</p>
          <p className="mt-1"><span className="font-semibold">Source record:</span> {annotation.sourceLocator}</p>
        </>
      )}
      <p className="mt-1"><span className="font-semibold">Validation date:</span> <time dateTime={annotation.validatedAt}>{annotation.validatedAt.slice(0, 10)}</time></p>
      <p className="mt-1">{annotation.rationale}</p>
    </section>
  );
}

function Contents({ manifest, currentSectionId }: { manifest: PaperManifest; currentSectionId?: string }) {
  return (
    <nav aria-label="Options Paper contents">
      <ol className="space-y-1 text-sm">
        {manifest.sections.map((section) => (
          <li key={section.stableSectionId} style={{ paddingLeft: `${(section.depth - 1) * 16}px` }}>
            <Link
              href={sectionHref(manifest.documentVersion, section.stableSectionId)}
              aria-current={currentSectionId === section.stableSectionId ? 'page' : undefined}
              className={`block rounded-md px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 ${
                currentSectionId === section.stableSectionId
                  ? 'bg-sky-100 font-semibold text-sky-900 dark:bg-sky-950 dark:text-sky-100'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              <span className="mr-2 text-slate-500 dark:text-slate-400">{section.number}</span>
              {section.title}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function Figure({
  figure,
  caption,
  alternativeDescription,
}: {
  figure: PaperFigureAsset;
  caption: string;
  alternativeDescription: string;
}) {
  const classNames = {
    primary: 'fill-sky-100 stroke-sky-700 dark:fill-sky-950 dark:stroke-sky-300',
    secondary: 'fill-indigo-100 stroke-indigo-700 dark:fill-indigo-950 dark:stroke-indigo-300',
    accent: 'fill-amber-100 stroke-amber-700 dark:fill-amber-950 dark:stroke-amber-300',
  } as const;
  const titleId = `${figure.figureId}-title`;
  const descriptionId = `${figure.figureId}-description`;
  return (
    <figure className="my-6 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
      <svg
        viewBox={figure.viewBox}
        role="img"
        aria-labelledby={`${titleId} ${descriptionId}`}
        className="h-auto w-full"
      >
        <title id={titleId}>{caption}</title>
        <desc id={descriptionId}>{alternativeDescription}</desc>
        {figure.paths.map((path, index) => (
          <path
            key={`${figure.figureId}-${index}`}
            d={path.d}
            className={classNames[path.className]}
            strokeWidth="4"
          />
        ))}
      </svg>
      <figcaption className="mt-3 text-sm text-slate-600 dark:text-slate-300">{caption}</figcaption>
    </figure>
  );
}

function FragmentBody({
  manifest,
  fragment,
  figureAssets,
}: {
  manifest: PaperManifest;
  fragment: PaperFragment;
  figureAssets: Map<string, PaperFigureAsset>;
}) {
  return (
    <div className="space-y-5 text-base leading-7 text-slate-800 dark:text-slate-100">
      {fragment.blocks.map((block) => {
        if (block.kind === 'paragraph') return <p key={block.blockId}>{block.text}</p>;
        if (block.kind === 'heading') {
          if (block.level === 2) return <h2 key={block.blockId} className="text-2xl font-bold">{block.text}</h2>;
          if (block.level === 3) return <h3 key={block.blockId} className="text-xl font-bold">{block.text}</h3>;
          if (block.level === 4) return <h4 key={block.blockId} className="text-lg font-bold">{block.text}</h4>;
          return <h5 key={block.blockId} className="font-bold">{block.text}</h5>;
        }
        if (block.kind === 'list') {
          return (
            <ul key={block.blockId} className="list-disc space-y-2 pl-6">
              {block.items.map((item) => <li key={item}>{item}</li>)}
            </ul>
          );
        }
        if (block.kind === 'callout') {
          return (
            <aside key={block.blockId} className="rounded-lg border-l-4 border-amber-500 bg-amber-50 p-4 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100">
              <p className="font-semibold">{block.label}</p>
              <p>{block.text}</p>
            </aside>
          );
        }
        if (block.kind === 'equation') {
          return (
            <div key={block.blockId} data-testid="paper-equation-overflow" className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900" role="group" aria-label={block.label}>
              <p className="mb-2 text-sm font-semibold text-slate-600 dark:text-slate-300">{block.label}</p>
              <code className="block w-max min-w-full whitespace-nowrap font-mono text-sm">{block.expression}</code>
            </div>
          );
        }
        if (block.kind === 'table') {
          return (
            <div key={block.blockId} data-testid="paper-table-overflow" className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
              <table className="min-w-[760px] border-collapse text-left text-sm">
                <caption className="bg-slate-50 px-4 py-3 text-left font-semibold dark:bg-slate-900">{block.caption}</caption>
                <thead><tr>{block.columns.map((column) => <th key={column} scope="col" className="border-t border-slate-200 px-4 py-3 dark:border-slate-700">{column}</th>)}</tr></thead>
                <tbody>{block.rows.map((row, rowIndex) => <tr key={`${block.tableId}-${rowIndex}`}>{row.map((cell, cellIndex) => <td key={`${block.tableId}-${rowIndex}-${cellIndex}`} className="border-t border-slate-200 px-4 py-3 dark:border-slate-700">{cell}</td>)}</tr>)}</tbody>
              </table>
            </div>
          );
        }
        const indexEntry = manifest.figures.find((entry) => entry.figureId === block.figureId)!;
        return (
          <Figure
            key={block.blockId}
            figure={figureAssets.get(block.figureId)!}
            caption={indexEntry.caption}
            alternativeDescription={indexEntry.alternativeDescription}
          />
        );
      })}
    </div>
  );
}

function ContextHeader({ manifest }: { manifest: PaperManifest }) {
  return (
    <div className="border-b border-violet-200 bg-violet-50 px-4 py-3 text-violet-950 dark:border-violet-900 dark:bg-violet-950/60 dark:text-violet-100" role="status">
      <div className="mx-auto flex max-w-7xl items-start gap-3">
        <FileWarning className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-semibold">Synthetic rough draft | Version {manifest.documentVersion}</p>
          <p className="text-sm">{manifest.authorityBannerText}</p>
        </div>
      </div>
    </div>
  );
}

function Breadcrumbs({ manifest, section }: { manifest: PaperManifest; section?: PaperSection }) {
  const ancestors: PaperSection[] = [];
  let cursor = section?.parentStableSectionId ?? null;
  while (cursor) {
    const parent = manifest.sections.find((candidate) => candidate.stableSectionId === cursor);
    if (!parent) break;
    ancestors.unshift(parent);
    cursor = parent.parentStableSectionId;
  }
  return (
    <nav aria-label="Breadcrumb" className="mb-5 text-sm text-slate-600 dark:text-slate-300">
      <ol className="flex flex-wrap items-center gap-2">
        <li><Link className="underline" href={`/matrix-options/paper/v/${manifest.documentVersion}`}>Options Paper</Link></li>
        {ancestors.map((ancestor) => (
          <li key={ancestor.stableSectionId} className="flex items-center gap-2">
            <span aria-hidden="true">/</span>
            <Link className="underline" href={sectionHref(manifest.documentVersion, ancestor.stableSectionId)}>{ancestor.title}</Link>
          </li>
        ))}
        {section && <li className="flex items-center gap-2" aria-current="page"><span aria-hidden="true">/</span>{section.title}</li>}
      </ol>
    </nav>
  );
}

export async function PaperVersionLanding({
  documentVersion,
  provider = syntheticPaperProvider,
}: {
  documentVersion: string;
  provider?: PaperContentProvider;
}) {
  const { manifest } = await provider.getVerifiedRelease(documentVersion);
  return (
    <>
      <ContextHeader manifest={manifest} />
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Breadcrumbs manifest={manifest} />
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <article>
            <p className="text-sm font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">Reader orientation</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">{manifest.title}</h1>
            <p className="mt-4 max-w-3xl text-lg text-slate-700 dark:text-slate-200">
              This route identifies one immutable synthetic fixture version. Select a section to verify deep links, browser history, and server-rendered content.
            </p>
            <dl className="mt-6 grid gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2 dark:border-slate-700 dark:bg-slate-800">
              <div><dt className="text-sm text-slate-500">Document version</dt><dd className="font-mono font-semibold">{manifest.documentVersion}</dd></div>
              <div><dt className="text-sm text-slate-500">Publication state</dt><dd className="font-semibold">Synthetic rough draft</dd></div>
              <div><dt className="text-sm text-slate-500">Authority</dt><dd>None; fixture only</dd></div>
              <div><dt className="text-sm text-slate-500">Promotion</dt><dd>Not promotable</dd></div>
            </dl>
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950/40">
              <h2 className="font-bold">Review focus for Slice 1A</h2>
              <p className="mt-2">Validate the reader shell and integrity boundary only. Comments, guided review, search, and production publishing are intentionally absent.</p>
            </div>
            <Link
              href={sectionHref(manifest.documentVersion, manifest.sections[0].stableSectionId)}
              className="mt-7 inline-flex min-h-[44px] items-center rounded-lg bg-sky-700 px-5 py-2 font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2"
            >
              Start with {manifest.sections[0].title}
            </Link>
          </article>
          <aside className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            <h2 className="mb-3 font-bold">Contents</h2>
            <Contents manifest={manifest} />
          </aside>
        </div>
      </div>
    </>
  );
}

export async function PaperSectionReader({
  documentVersion,
  stableSectionId,
  provider = syntheticPaperProvider,
}: {
  documentVersion: string;
  stableSectionId: string;
  provider?: PaperContentProvider;
}) {
  const { manifest } = await provider.getVerifiedRelease(documentVersion);
  const section = manifest.sections.find((candidate) => candidate.stableSectionId === stableSectionId);
  if (!section) return null;
  const fragment = await provider.getFragment(documentVersion, stableSectionId);
  const figureAssets = new Map<string, PaperFigureAsset>();
  for (const block of fragment.blocks) {
    if (block.kind === 'figure') {
      figureAssets.set(block.figureId, await provider.getFigure(documentVersion, block.figureId));
    }
  }
  const annotations = manifest.statusAnnotations.filter((annotation) => section.statusAnnotationIds.includes(annotation.annotationId));
  const previous = manifest.sections[section.order - 1];
  const next = manifest.sections[section.order + 1];

  return (
    <>
      <ContextHeader manifest={manifest} />
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-5 lg:hidden">
          <details className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            <summary className="cursor-pointer font-semibold">Document contents</summary>
            <div className="mt-3"><Contents manifest={manifest} currentSectionId={stableSectionId} /></div>
          </details>
        </div>
        <div className="grid gap-8 lg:grid-cols-[18rem_minmax(0,1fr)] xl:grid-cols-[20rem_minmax(0,1fr)]">
          <aside className="hidden self-start rounded-xl border border-slate-200 bg-white p-4 lg:sticky lg:top-20 lg:block dark:border-slate-700 dark:bg-slate-800">
            <h2 className="mb-3 font-bold">Contents</h2>
            <Contents manifest={manifest} currentSectionId={stableSectionId} />
          </aside>
          <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8 dark:border-slate-700 dark:bg-slate-800">
            <Breadcrumbs manifest={manifest} section={section} />
            <p className="text-sm font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">Section {section.number}</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950 dark:text-white">{section.title}</h1>
            <div className="mt-4 space-y-3" aria-label="Validated status annotations">
              {annotations.map((annotation) => <PaperStatusAnnotationCard key={annotation.annotationId} annotation={annotation} />)}
            </div>
            <div className="mt-7">
              <FragmentBody manifest={manifest} fragment={fragment} figureAssets={figureAssets} />
            </div>
            <section aria-label="Canonical PDF" className="mt-8 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
              <h2 className="font-bold">Canonical PDF</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{manifest.canonicalPdf.label}. Browser print is not a canonical substitute.</p>
              <button type="button" disabled className="mt-3 min-h-[44px] rounded-md bg-slate-200 px-4 text-slate-500 disabled:cursor-not-allowed dark:bg-slate-700 dark:text-slate-400">Download canonical PDF</button>
            </section>
            <nav aria-label="Adjacent sections" className="mt-8 flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-between dark:border-slate-700">
              {previous ? <Link className="inline-flex min-h-[44px] items-center gap-2 rounded-md px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700" href={sectionHref(documentVersion, previous.stableSectionId)}><ChevronLeft className="h-4 w-4" />{previous.title}</Link> : <span />}
              {next ? <Link className="inline-flex min-h-[44px] items-center gap-2 rounded-md px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700" href={sectionHref(documentVersion, next.stableSectionId)}>{next.title}<ChevronRight className="h-4 w-4" /></Link> : <span />}
            </nav>
          </article>
        </div>
      </div>
    </>
  );
}
