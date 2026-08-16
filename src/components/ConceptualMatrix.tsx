import React from 'react';

// Vision for Modernizing Schedule 3.4.
//
// Content authority: "Draft Project Plan - Phase 2 Sediment Standards (SABCS)",
// sections 1.2 (Project Purpose), 1.3 (Vision Statement) and 1.4 (Project
// Objectives). The three-part structure, the four receptor-pathway names, the
// matrix-vs-generic distinction, and the prioritization factors below are all
// taken from that document rather than paraphrased from memory -- this page is
// the product's statement of the project's own vision, so it must not drift
// from the plan it describes.
//
// Superseded design note: this view previously rendered a small decorative 2x2
// legend of four numbered squares ABOVE four separate detail cards. The numbers
// carried no meaning, the diagram held almost no content, and the split left a
// large page mostly empty. The matrix and the detail cards are now ONE object:
// the grid IS the content, each quadrant carries its own plain-language lead
// with the technical detail behind a disclosure.

interface Pathway {
  axis: 'ecological' | 'human-health';
  exposure: 'direct' | 'food';
  /** Official receptor-pathway name from the project plan, section 1.3. */
  officialName: string;
  icon: React.ReactNode;
  /** Plain-language takeaway. Always visible (decision #19: plain first). */
  lead: string;
  /** Technical receptor/method detail. Behind a disclosure. */
  detail: string;
}

const PATHWAYS: Pathway[] = [
  {
    axis: 'ecological',
    exposure: 'direct',
    officialName: 'Protect Ecological Health - Direct Exposure to Sediment Contaminants',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    lead: 'Protects the small animals that live in the mud itself.',
    detail:
      'Receptor: benthic invertebrates dwelling within the sediment matrix. Methods: Equilibrium Partitioning (EqP), Acid Volatile Sulfide (AVS) normalization.',
  },
  {
    axis: 'ecological',
    exposure: 'food',
    officialName: 'Protect Ecological Health - Exposure to Sediment Contaminants in Food',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    ),
    lead: 'Protects fish, birds, and other wildlife that eat contaminated prey.',
    detail:
      'Receptor: higher trophic-level aquatic life and wildlife exposed to bioaccumulative contaminants. Methods: Biota-Sediment Accumulation Factors (BSAF), trophic transfer modeling.',
  },
  {
    axis: 'human-health',
    exposure: 'direct',
    officialName: 'Protect Human Health - Direct Exposure to Sediment Contaminants',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    lead: 'Protects people who touch or accidentally swallow contaminated sediment.',
    detail:
      'Acute and chronic exposure via dermal absorption of wetted sediments and incidental ingestion during recreational or occupational activities.',
  },
  {
    axis: 'human-health',
    exposure: 'food',
    officialName: 'Protect Human Health - Exposure to Sediment Contaminants in Food',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
      </svg>
    ),
    lead: 'Protects people who rely on fish and shellfish from these waters as food.',
    detail:
      'Receptor: human populations reliant on aquatic environments for sustenance. Requires specialized modifiers for high-volume Indigenous traditional food consumption rates.',
  },
];

const AXIS_ROWS: { axis: Pathway['axis']; label: string }[] = [
  { axis: 'ecological', label: 'Ecological Health' },
  { axis: 'human-health', label: 'Human Health' },
];

const EXPOSURE_COLUMNS: { exposure: Pathway['exposure']; label: string }[] = [
  { exposure: 'direct', label: 'Direct Exposure' },
  { exposure: 'food', label: 'Exposure through Food' },
];

// Decision #3 (semantic palette): colour encodes the real receptor axis and
// nothing else, carried as a thin top border on an otherwise neutral surface.
// MUST use DIRECTIONAL `border-t-<colour>` utilities, never the all-sides
// `border-<colour>` form.
//
// `PathwayCell` composes these with CARD via a plain template literal, not
// `cn`/twMerge, so nothing de-duplicates conflicting utilities and raw stylesheet
// order decides the winner. CARD carries all-sides `border-slate-200
// dark:border-slate-700`, which is emitted AFTER `border-emerald-600` in the
// compiled CSS -- so the earlier all-sides colour lost and every quadrant rendered
// an identical slate border. Browser-verified: both axes computed
// `oklch(0.929 0.013 255.508)` (slate-200), i.e. decision #3's axis encoding did not
// render at all.
//
// `border-t-*` sits in a later cascade position than the all-sides `border-*`
// colour, so the directional form wins regardless of composition order. This is the
// same form `SCHEDULE_PARTS.accent` already uses, which is precisely why those three
// overview cards rendered correctly while these four did not.
const AXIS_STYLES: Record<Pathway['axis'], { border: string; icon: string; rowLabel: string }> = {
  ecological: {
    border: 'border-t-4 border-t-emerald-600 dark:border-t-emerald-400',
    icon: 'text-emerald-700 dark:text-emerald-400',
    rowLabel: 'text-emerald-800 dark:text-emerald-300',
  },
  'human-health': {
    border: 'border-t-4 border-t-sky-600 dark:border-t-sky-400',
    icon: 'text-sky-700 dark:text-sky-400',
    rowLabel: 'text-sky-800 dark:text-sky-300',
  },
};

const CARD =
  'rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800';

// The three parts of Schedule 3.4 (project plan section 1.3). Rendered as a
// peer set of three cards so the reader sees the whole structure before any one
// part is expanded -- Part 1's four-quadrant detail then follows as its own
// section rather than competing with the overview.
const SCHEDULE_PARTS: {
  part: string;
  title: string;
  summary: string;
  accent: string;
  detailedBelow?: boolean;
}[] = [
  {
    part: 'Part 1',
    title: 'Matrix Numerical Sediment Standards',
    summary:
      'A refined approach for priority substances that require a high duty of care, spanning four receptor-pathways across human and ecological health.',
    // Neutral accent on purpose: Part 1 covers BOTH receptor axes, so giving it
    // either the ecological or the human-health hue would contradict decision
    // #3's rule that colour encodes a real axis and nothing else.
    accent: 'border-t-slate-600 dark:border-t-slate-400',
    detailedBelow: true,
  },
  {
    part: 'Part 2',
    title: 'Generic Standards: Human Health',
    summary:
      'Generic numerical sediment standards protecting human health, adopted from other jurisdictions where a matrix standard is not feasible.',
    accent: 'border-t-sky-600 dark:border-t-sky-400',
  },
  {
    part: 'Part 3',
    title: 'Generic Standards: Ecological Health',
    summary:
      'Generic numerical sediment standards protecting ecological health, derived by the same adoption procedure as Part 2.',
    accent: 'border-t-emerald-600 dark:border-t-emerald-400',
  },
];

// Project plan section 1.4 (Project Objectives), COMPRESSED and de-duplicated.
//
// 1.4's first three objectives restate Parts 1, 2 and 3, which the three cards
// above already carry -- including them here would make the page say the same
// thing twice in two shapes. Only the four objectives that are NOT about
// Schedule 3.4's structure appear below.
//
// `home` names the tab where that objective's work actually lives, so this page
// doubles as a map of the workspace. It is deliberately plain text, not a
// navigation control: wiring the Vision page into tab state would give it a new
// failure mode for no real gain. Left undefined where no tab genuinely owns the
// work -- naming a plausible-sounding one would be worse than saying nothing.
const OBJECTIVES: { title: string; body: string; home?: string }[] = [
  {
    title: 'Substance prioritization framework',
    body:
      'Identifies which substances require Matrix standards, based on their potential to cause unacceptable risk in BC aquatic receiving environments.',
  },
  {
    title: 'BC Aquatic Database',
    body:
      'Built by the Ministry of Environment and Parks from documents submitted to the Site Remediation Program and shared datasets. Establishes concentration ranges across BC, shows where substances occur, and indicates which sites need site-specific risk-based assessment.',
    home: 'Interactive Map',
  },
  {
    title: 'Policy-ready input parameters',
    body:
      'Toxicity Reference Values for human and ecological health, plus sediment grain size thresholds, receptor characteristics, exposure assumptions, and water lot use classifications. These feed the Phase 3 calculations; Protocol 28 provides the precedent for other media.',
    home: 'References & Values',
  },
  {
    title: 'Matrix Options Paper',
    body:
      'The Phase 2 deliverable: research findings, options considered, and the rationale behind each recommendation, together with a summary of the engagement that produced them.',
    home: 'TWG Review',
  },
];

function PathwayCell({ pathway, rowLabel, columnLabel }: {
  pathway: Pathway;
  rowLabel: string;
  columnLabel: string;
}) {
  const style = AXIS_STYLES[pathway.axis];
  return (
    <div
      className={`flex h-full flex-col ${CARD} ${style.border} p-4 sm:p-5`}
      data-testid={`pathway-${pathway.axis}-${pathway.exposure}`}
    >
      {/* Below md the grid collapses to one column, so the row/column headers
          are no longer adjacent to the cell and cannot label it. Each cell
          therefore carries its own coordinate label at narrow widths. Hidden
          at md+ where the real axis headers do that job, to avoid saying it
          twice. */}
      <p className={`mb-2 text-[11px] font-semibold uppercase tracking-wide md:hidden ${style.rowLabel}`}>
        {rowLabel} <span aria-hidden="true">/</span> {columnLabel}
      </p>

      <div className="flex items-start gap-2">
        <span className={`mt-0.5 flex-shrink-0 ${style.icon}`}>{pathway.icon}</span>
        <p className="text-sm font-bold leading-snug text-slate-900 dark:text-white">
          {pathway.lead}
        </p>
      </div>

      <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">
        {pathway.officialName}
      </p>

      {/* Collapsible technical detail. `mt-auto` pins the disclosure to the
          bottom so all four cells' controls line up even when their leads wrap
          to different heights. */}
      <details className="group mt-auto pt-3">
        <summary className="flex min-h-[44px] cursor-pointer items-center gap-1.5 text-xs font-semibold text-slate-700 marker:content-none dark:text-slate-200 [&::-webkit-details-marker]:hidden">
          <svg
            className="h-3.5 w-3.5 flex-shrink-0 transition-transform group-open:rotate-90"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          Receptor and methods
        </summary>
        <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
          {pathway.detail}
        </p>
      </details>
    </div>
  );
}

function find(
  axis: Pathway['axis'],
  exposure: Pathway['exposure'],
): Pathway | null {
  return PATHWAYS.find((p) => p.axis === axis && p.exposure === exposure) ?? null;
}

/**
 * Rendered when a receptor-pathway is missing from PATHWAYS.
 *
 * SUPERSEDES an earlier `throw` here (owner-decided 2026-08-15). The original
 * reasoning was "throwing beats rendering a silently empty quadrant" -- correct
 * that silence is the worse failure, but the consequence was disproportionate:
 * there is no error boundary between this component and the tabpanel, so a single
 * missing entry would white-screen the ENTIRE Vision tab rather than blank one
 * quadrant. A future edit adding a third exposure route without its matching
 * pathway would take down three healthy quadrants with it.
 *
 * A visible placeholder keeps the failure loud (it names the missing coordinate
 * on screen) while containing the blast radius to the one cell, and unlike a
 * thrown error it is directly assertable in a test.
 *
 * Unreachable against the current static 2x2 data; this is a guard, not a path.
 */
export function MissingPathwayCell({ rowLabel, columnLabel }: {
  rowLabel: string;
  columnLabel: string;
}) {
  return (
    <div
      data-testid="pathway-missing"
      role="note"
      className={`flex h-full flex-col justify-center ${CARD} border-t-4 border-t-rose-600 p-4 dark:border-t-rose-400 sm:p-5`}
    >
      <p className="text-sm font-bold text-rose-800 dark:text-rose-300">
        Missing content
      </p>
      <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
        No receptor-pathway is defined for {rowLabel} / {columnLabel}.
      </p>
    </div>
  );
}

export default function ConceptualMatrix() {
  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Vision for Modernizing Schedule 3.4
        </h2>
        {/* Project plan section 1.2 (Project Purpose), stated as purpose so the
            page opens with WHY before WHAT. */}
        <p className="mt-3 leading-relaxed text-slate-600 dark:text-slate-300">
          <span className="font-semibold text-slate-900 dark:text-white">Purpose.</span>{' '}
          Phase 2 of the Sediment Standards Project develops a modern scientific
          framework for updating British Columbia&apos;s CSR Schedule 3.4 numerical
          sediment standards, integrating best-available science to protect aquatic
          ecosystems and the communities that depend on them.
        </p>
        <p className="mt-3 leading-relaxed text-slate-600 dark:text-slate-300">
          The vision is a fully integrated framework that protects ecological and
          human health across all exposure routes, delivered as three parts.
        </p>
      </header>

      {/* ---- Section 1: the whole structure, before any one part expands ---- */}
      <section aria-labelledby="three-parts-heading" className="space-y-4">
        <div className="max-w-3xl">
          <h3
            id="three-parts-heading"
            className="text-xl font-bold text-slate-900 dark:text-white"
          >
            Schedule 3.4 will have three parts
          </h3>
          <p className="mt-2 leading-relaxed text-slate-600 dark:text-slate-300">
            Matrix standards are developed for priority substances that pose a threat to
            human and ecological health. It is not feasible to develop them for every
            substance, because the required information is not always available, so the
            remaining substances are covered by generic standards adopted from other
            jurisdictions.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3" data-testid="schedule-34-parts">
          {SCHEDULE_PARTS.map((p) => (
            <div
              key={p.part}
              data-testid={`schedule-part-${p.part.replace(' ', '-').toLowerCase()}`}
              className={`flex h-full flex-col ${CARD} border-t-4 ${p.accent} p-5`}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {p.part}
              </p>
              <h4 className="mt-1 text-base font-bold text-slate-900 dark:text-white">
                {p.title}
              </h4>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {p.summary}
              </p>
              {p.detailedBelow && (
                <p className="mt-auto pt-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Detailed below
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ---- Section 2: Part 1 in detail ---- */}
      <section aria-labelledby="part-1-heading" className="space-y-4">
        <div className="max-w-3xl">
          <h3
            id="part-1-heading"
            className="text-xl font-bold text-slate-900 dark:text-white"
          >
            The Matrix framework
          </h3>
          <p className="mt-2 leading-relaxed text-slate-600 dark:text-slate-300">
            Priority substances are identified by considering biomagnification, toxicity,
            persistence, and local occurrence. Part 1 spans four receptor-pathways, each
            needing its own set of derivation equations.
          </p>
        </div>

        {/* The matrix. At md+ this is a true 3-column grid: a row-label column
            plus one column per exposure route, with a header row above. Below
            md it collapses to a single stack and each cell self-labels. */}
        <div
          className="grid grid-cols-1 gap-3 md:grid-cols-[7.5rem_1fr_1fr] md:gap-4"
          data-testid="schedule-34-matrix"
        >
          {/* Header row (md+ only) */}
          <div className="hidden md:block" aria-hidden="true" />
          {EXPOSURE_COLUMNS.map((col) => (
            <div
              key={`head-${col.exposure}`}
              className="hidden text-center text-sm font-semibold uppercase tracking-wide text-slate-700 md:block dark:text-slate-300"
            >
              {col.label}
            </div>
          ))}

          {AXIS_ROWS.map((row) => (
            <React.Fragment key={row.axis}>
              <div
                className={`hidden items-center justify-end pr-1 text-right text-sm font-semibold uppercase tracking-wide md:flex ${AXIS_STYLES[row.axis].rowLabel}`}
              >
                {row.label}
              </div>
              {EXPOSURE_COLUMNS.map((col) => {
                const pathway = find(row.axis, col.exposure);
                // A missing pathway degrades THIS cell only. See MissingPathwayCell
                // for why this replaced a render-time throw.
                return pathway ? (
                  <PathwayCell
                    key={`${row.axis}-${col.exposure}`}
                    pathway={pathway}
                    rowLabel={row.label}
                    columnLabel={col.label}
                  />
                ) : (
                  <MissingPathwayCell
                    key={`${row.axis}-${col.exposure}`}
                    rowLabel={row.label}
                    columnLabel={col.label}
                  />
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </section>

      {/* ---- Section 3: how the generic parts get their values ---- */}
      <section aria-labelledby="generic-heading" className="max-w-3xl space-y-2">
        <h3
          id="generic-heading"
          className="text-xl font-bold text-slate-900 dark:text-white"
        >
          How Parts 2 and 3 get their values
        </h3>
        <p className="leading-relaxed text-slate-600 dark:text-slate-300">
          Parts 2 and 3 adopt values from other jurisdictions, following a procedure that
          accounts for their differing protection levels, species, and other factors
          relative to Canadian jurisdictions. This work can leverage the
          Director&apos;s Interim Standards.
        </p>
      </section>

      {/* ---- Section 4: the rest of what Phase 2 delivers (plan section 1.4) ---- */}
      <section aria-labelledby="delivers-heading" className="space-y-4">
        <div className="max-w-3xl">
          <h3
            id="delivers-heading"
            className="text-xl font-bold text-slate-900 dark:text-white"
          >
            What else Phase 2 delivers
          </h3>
          <p className="mt-2 leading-relaxed text-slate-600 dark:text-slate-300">
            Modernizing Schedule 3.4 depends on four further pieces of work, each
            supporting the standards above.
          </p>
        </div>

        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2" data-testid="phase-2-objectives">
          {OBJECTIVES.map((o) => (
            <li
              key={o.title}
              className={`${CARD} p-5`}
              data-testid={`objective-${o.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
            >
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <h4 className="text-base font-bold text-slate-900 dark:text-white">
                  {o.title}
                </h4>
                {o.home && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-200">
                    See {o.home}
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {o.body}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <p className="max-w-3xl border-l-2 border-slate-300 pl-4 text-sm leading-relaxed text-slate-600 dark:border-slate-600 dark:text-slate-300">
        Together, this multi-part approach of matrix and generic standards creates a
        defensible, scalable, and adaptable foundation for the contaminated sites
        regulatory framework.
      </p>
    </div>
  );
}
