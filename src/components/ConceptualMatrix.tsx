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
// Containerized text blocks design: matches The Guide's cohesive card architecture
// with clear section hierarchy, badge chips, elevated surfaces, and balanced padding.

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

const SECTION_CARD =
  'bg-white dark:bg-slate-800 rounded-2xl shadow-lg p-5 lg:p-8 border border-slate-200 dark:border-slate-700 space-y-6';

const INNER_CARD =
  'rounded-xl border border-slate-200 bg-slate-50/70 p-5 dark:border-slate-700 dark:bg-slate-900/60 transition-all';

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
      className={`flex h-full flex-col ${INNER_CARD} border-t-4 ${style.border} p-4 sm:p-5`}
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

      <div className="flex items-start gap-2.5">
        <span className={`mt-0.5 flex-shrink-0 ${style.icon}`}>{pathway.icon}</span>
        <p className="text-sm font-bold leading-snug text-slate-900 dark:text-white">
          {pathway.lead}
        </p>
      </div>

      <p className="mt-2.5 text-xs font-medium text-slate-500 dark:text-slate-400">
        {pathway.officialName}
      </p>

      {/* Collapsible technical detail. `mt-auto` pins the disclosure to the
          bottom so all four cells' controls line up even when their leads wrap
          to different heights. */}
      <details className="group mt-auto pt-3 border-t border-slate-200/60 dark:border-slate-700/60">
        <summary className="flex min-h-[44px] cursor-pointer items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white marker:content-none [&::-webkit-details-marker]:hidden transition-colors">
          <svg
            className="h-3.5 w-3.5 flex-shrink-0 transition-transform group-open:rotate-90 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span>Receptor and methods</span>
        </summary>
        <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300 pl-5">
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

export function MissingPathwayCell({ rowLabel, columnLabel }: {
  rowLabel: string;
  columnLabel: string;
}) {
  return (
    <div
      data-testid="pathway-missing"
      role="note"
      className={`flex h-full flex-col justify-center ${INNER_CARD} border-t-4 border-t-rose-600 p-4 dark:border-t-rose-400 sm:p-5`}
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
    <div className="space-y-8">
      {/* Container 1: Hero & Vision Overview */}
      <div className={SECTION_CARD}>
        <header className="max-w-4xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300 text-xs font-bold uppercase tracking-wider border border-sky-200 dark:border-sky-800">
            Scientific Framework &amp; Policy Scope
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Modernizing Schedule 3.4
          </h2>
          {/* Project plan section 1.2 (Project Purpose), stated as purpose so the
              page opens with WHY before WHAT. */}
          <div className="space-y-3 pt-1">
            <p className="leading-relaxed text-slate-600 dark:text-slate-300 text-sm sm:text-base">
              <span className="font-semibold text-slate-900 dark:text-white">Purpose.</span>{' '}
              Phase 2 of the Sediment Standards Project develops a modern scientific
              framework for updating British Columbia&apos;s CSR Schedule 3.4 numerical
              sediment standards, integrating best-available science to protect aquatic
              ecosystems and the communities that depend on them.
            </p>
            <p className="leading-relaxed text-slate-600 dark:text-slate-300 text-sm sm:text-base">
              The vision is a fully integrated framework that protects ecological and
              human health across all exposure routes, delivered as three parts.
            </p>
          </div>
        </header>

        {/* Highlight Stats / Meta Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/60">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Framework Scope</div>
            <div className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">Three-Part Structure</div>
            <p className="text-xs text-slate-500 mt-0.5">Matrix + Generic standards</p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/60">
            <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Receptor Routes</div>
            <div className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">Four Pathways</div>
            <p className="text-xs text-slate-500 mt-0.5">Direct + Food exposure</p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/60">
            <div className="text-[11px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">Policy Integration</div>
            <div className="text-base font-extrabold text-slate-900 dark:text-white mt-0.5">Protocol 28 Precedent</div>
            <p className="text-xs text-slate-500 mt-0.5">Cross-media consistency</p>
          </div>
        </div>
      </div>

      {/* Container 2: The Three-Part Vision Architecture */}
      <section aria-labelledby="three-parts-heading" className={SECTION_CARD}>
        <div className="max-w-3xl space-y-2">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <span>Structure</span>
          </div>
          <h3
            id="three-parts-heading"
            className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white"
          >
            Schedule 3.4 will have three parts
          </h3>
          <p className="leading-relaxed text-slate-600 dark:text-slate-300 text-sm">
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
              className={`flex h-full flex-col ${INNER_CARD} border-t-4 ${p.accent} p-5 shadow-xs`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {p.part}
                </span>
                {p.detailedBelow && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                    Detailed Below
                  </span>
                )}
              </div>
              <h4 className="mt-2 text-base font-bold text-slate-900 dark:text-white leading-snug">
                {p.title}
              </h4>
              <p className="mt-2 text-xs sm:text-sm leading-relaxed text-slate-600 dark:text-slate-300 flex-1">
                {p.summary}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Container 3: Part 1 In Detail - The Matrix Framework 2x2 */}
      <section aria-labelledby="part-1-heading" className={SECTION_CARD}>
        <div className="max-w-3xl space-y-2">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sky-700 dark:text-sky-400">
            <span>Part 1 Focus</span>
          </div>
          <h3
            id="part-1-heading"
            className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white"
          >
            The Matrix framework
          </h3>
          <p className="leading-relaxed text-slate-600 dark:text-slate-300 text-sm">
            Priority substances are identified by considering biomagnification, toxicity,
            persistence, and local occurrence. Part 1 spans four receptor-pathways, each
            needing its own set of derivation equations.
          </p>
        </div>

        {/* The matrix 2x2 grid */}
        <div
          className="grid grid-cols-1 gap-3 md:grid-cols-[7.5rem_1fr_1fr] md:gap-4 pt-2"
          data-testid="schedule-34-matrix"
        >
          {/* Header row (md+ only) */}
          <div className="hidden md:block" aria-hidden="true" />
          {EXPOSURE_COLUMNS.map((col) => (
            <div
              key={`head-${col.exposure}`}
              className="hidden text-center text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 md:block pb-1"
            >
              {col.label}
            </div>
          ))}

          {AXIS_ROWS.map((row) => (
            <React.Fragment key={row.axis}>
              <div
                className={`hidden items-center justify-end pr-3 text-right text-xs font-bold uppercase tracking-wider md:flex ${AXIS_STYLES[row.axis].rowLabel}`}
              >
                {row.label}
              </div>
              {EXPOSURE_COLUMNS.map((col) => {
                const pathway = find(row.axis, col.exposure);
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

      {/* Container 4: How Parts 2 and 3 Get Their Values */}
      <section aria-labelledby="generic-heading" className={SECTION_CARD}>
        <div className="max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            <span>Parts 2 &amp; 3 Procedure</span>
          </div>
          <h3
            id="generic-heading"
            className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white"
          >
            How Parts 2 and 3 get their values
          </h3>
          <p className="leading-relaxed text-slate-600 dark:text-slate-300 text-sm sm:text-base">
            Parts 2 and 3 adopt values from other jurisdictions, following a procedure that
            accounts for their differing protection levels, species, and other factors
            relative to Canadian jurisdictions. This work can leverage the
            Director&apos;s Interim Standards.
          </p>
        </div>
      </section>

      {/* Container 5: What Else Phase 2 Delivers */}
      <section aria-labelledby="delivers-heading" className={SECTION_CARD}>
        <div className="max-w-3xl space-y-2">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <span>Phase 2 Deliverables</span>
          </div>
          <h3
            id="delivers-heading"
            className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white"
          >
            What else Phase 2 delivers
          </h3>
          <p className="leading-relaxed text-slate-600 dark:text-slate-300 text-sm">
            Modernizing Schedule 3.4 depends on four further pieces of work, each
            supporting the standards above.
          </p>
        </div>

        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2" data-testid="phase-2-objectives">
          {OBJECTIVES.map((o) => (
            <li
              key={o.title}
              className={`${INNER_CARD} p-5 shadow-xs flex flex-col justify-between`}
              data-testid={`objective-${o.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
            >
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-base font-bold text-slate-900 dark:text-white">
                    {o.title}
                  </h4>
                  {o.home && (
                    <span className="rounded-full bg-sky-100 dark:bg-sky-950 px-2.5 py-0.5 text-[11px] font-bold text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                      See {o.home}
                    </span>
                  )}
                </div>
                <p className="mt-2.5 text-xs sm:text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {o.body}
                </p>
              </div>
            </li>
          ))}
        </ul>

        {/* Bottom Takeaway Banner */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          Together, this multi-part approach of matrix and generic standards creates a
          defensible, scalable, and adaptable foundation for the contaminated sites
          regulatory framework.
        </div>
      </section>
    </div>
  );
}
