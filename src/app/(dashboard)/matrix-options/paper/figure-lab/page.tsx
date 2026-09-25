import { notFound } from 'next/navigation';

import { PaperFigure } from '@/components/matrix-options/paper/PaperFigure';
import {
  MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION_FLAG,
  MATRIX_OPTIONS_PAPER_WORKSPACE_FLAG,
  resolveMatrixOptionsPaperReviewNavigationGate,
} from '@/lib/matrix-options/navigation';
import { candidateBinding, candidateModel, figureCandidateAsset, FIGURE_CANDIDATE_PACKET } from '@/lib/matrix-options/paper/figure-candidates';
import { paperMarkdownSegments } from '@/lib/matrix-options/paper/derived-figures';
import { notDrawnFallback } from '@/lib/matrix-options/paper/figure-lab-fallback';
import {
  duplicateBinding,
  FIGURE_REGISTER,
  FIGURE_REGISTER_AUTHORITY,
  FIGURE_SOURCE_LEDGER,
  FINAL_BINDING_REQUIREMENT,
  layoutPrototypeBinding,
  layoutPrototypeModel,
  MATRIX_OPTIONS_PAPER_FIGURE_LAB_FLAG,
  type FigureRegisterRow,
} from '@/lib/matrix-options/paper/figure-register';
import { restoredFigurePrototypeBinding, type DiagramModel, type FigureBinding } from '@/lib/matrix-options/paper/figures';
import { loadRevisedPaperStructure } from '@/lib/matrix-options/revised-paper-structure';

/*
 * Internal figure lab (not part of the paper). Shows every row of the 20-figure
 * register -- rendered figures from the current paper, referenced duplicates,
 * and layout-only prototypes awaiting Matrix MC content -- plus the proposed
 * additional figures, for review by the owner and Matrix MC. Off unless
 * MATRIX_OPTIONS_PAPER_FIGURE_LAB is exactly "true" and the paper workspace is on.
 */
export const dynamic = 'force-dynamic';

interface LabFigure {
  readonly model: DiagramModel;
  readonly binding: FigureBinding;
}

function labFigureFor(row: FigureRegisterRow, drawn: ReadonlyMap<string, LabFigure>): LabFigure | null {
  if (row.reuseOf) {
    const asset = drawn.get(row.reuseOf);
    return asset ? { model: asset.model, binding: duplicateBinding(row, asset.binding) } : null;
  }
  const model = layoutPrototypeModel(row.number);
  if (model) return { model, binding: layoutPrototypeBinding(row) };
  return drawn.get(row.number) ?? null;
}

interface CandidateFigure extends LabFigure {
  readonly placement: string;
}

/**
 * A row's Matrix MC content candidate placement(s) (figure-candidates.ts), shown
 * under the "Matrix MC content candidate" sub-heading in addition to whatever
 * labFigureFor draws for the row's own historical number. Each candidate is
 * shown only at its accepted figure-register placement.
 */
function candidateFiguresForRow(row: FigureRegisterRow): readonly CandidateFigure[] {
  if (!row.semanticAssetId) return [];
  const asset = figureCandidateAsset(row.semanticAssetId);
  if (!asset) return [];
  const model = candidateModel(asset);
  const placements = row.number === 'G-2' ? asset.placements : asset.placements.filter((placement) => placement === row.number);
  return placements.map((placement) => ({ model, binding: candidateBinding(asset, placement), placement }));
}

const FIELD_CLASSES = 'grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-[12rem_1fr]';

export default async function MatrixOptionsPaperFigureLabPage() {
  const gate = resolveMatrixOptionsPaperReviewNavigationGate(
    process.env[MATRIX_OPTIONS_PAPER_WORKSPACE_FLAG],
    process.env[MATRIX_OPTIONS_PAPER_REVIEW_NAVIGATION_FLAG],
  );
  if (gate !== 'REVIEW_NAVIGATION' || process.env[MATRIX_OPTIONS_PAPER_FIGURE_LAB_FLAG] !== 'true') notFound();

  const drawn = new Map<string, LabFigure>();
  const proposed: LabFigure[] = [];
  for (const segment of paperMarkdownSegments(loadRevisedPaperStructure().content)) {
    if (segment.kind !== 'figure' || !segment.binding) continue;
    if (segment.binding.kind === 'derived') proposed.push({ model: segment.model, binding: segment.binding });
    else drawn.set(segment.binding.id, { model: segment.model, binding: segment.binding });
  }

  return (
    <main data-testid="figure-lab" className="mx-auto w-full max-w-5xl px-4 py-8 text-[var(--db-text-primary)]">
      <h1 className="text-2xl font-bold">Paper figure lab</h1>
      <p className="mt-2 max-w-3xl text-sm text-[var(--db-text-secondary)] [overflow-wrap:anywhere]">
        Internal review view of the 20-figure register; it is not part of the paper. Content dispositions follow{' '}
        {FIGURE_REGISTER_AUTHORITY.file} (sha256 {FIGURE_REGISTER_AUTHORITY.sha256}). Figures marked as prototypes or
        proposals are not accepted content.
      </p>
      <p className="mt-2 max-w-3xl text-sm text-[var(--db-text-secondary)] [overflow-wrap:anywhere]">
        Seven rows carry one of six Matrix MC content candidates from {FIGURE_CANDIDATE_PACKET.packetFile} (sha256{' '}
        {FIGURE_CANDIDATE_PACKET.packetSha256}), reviewed {FIGURE_CANDIDATE_PACKET.verdict}: safe for L2 prototyping,
        not for final binding.
      </p>
      <p className="mt-2 max-w-3xl text-sm text-[var(--db-text-secondary)] [overflow-wrap:anywhere]">
        Every row&apos;s lineage below is checked against {FIGURE_SOURCE_LEDGER.file} (sha256{' '}
        {FIGURE_SOURCE_LEDGER.sha256}), reviewed by {FIGURE_SOURCE_LEDGER.reviewFile} (sha256{' '}
        {FIGURE_SOURCE_LEDGER.reviewSha256}) with verdict {FIGURE_SOURCE_LEDGER.verdict}. {FINAL_BINDING_REQUIREMENT}
      </p>
      {FIGURE_REGISTER.map((row) => {
        const figure = labFigureFor(row, drawn);
        const candidates = candidateFiguresForRow(row);
        // Owner decision 2026-09-24: the adjudicated SedS-labelled prototype is never applied on
        // the inline stakeholder paper; the lab still shows it as its own labelled figure here,
        // in addition to the plain (no-override) figure above and any Matrix MC content candidate
        // below. Only Figure 6-1 currently has an adjudicated label override.
        const sedsPrototypeBinding = figure && figure.binding.kind === 'restored' ? restoredFigurePrototypeBinding(figure.model) : null;
        const headingId = `figure-lab-${row.number.toLowerCase()}`;
        return (
          <section key={row.number} aria-labelledby={headingId} data-register-row={row.number} className="mt-10 border-t border-[var(--db-border)] pt-6">
            <h2 id={headingId} className="text-lg font-semibold">Figure {row.number}: {row.historicalCaption}</h2>
            <dl className={`mt-3 ${FIELD_CLASSES}`}>
              <dt className="font-semibold">Implementation</dt><dd data-field="implementation">{row.implementation}</dd>
              <dt className="font-semibold">Disposition</dt><dd>{row.disposition}</dd>
              <dt className="font-semibold">Current placement</dt><dd>{row.currentPlacement}</dd>
              <dt className="font-semibold">Historical placement</dt><dd>{row.historicalPlacement} (v0.9.87 p.{row.referencePdfPage})</dd>
              <dt className="font-semibold">Content source</dt><dd className="[overflow-wrap:anywhere]">{row.contentSource}</dd>
              {row.canonicalSemanticSource ? (
                <>
                  <dt className="font-semibold">Canonical semantic asset</dt><dd data-field="canonical-semantic-asset">{row.canonicalSemanticSource.semanticAssetId}</dd>
                  <dt className="font-semibold">Canonical semantic marker</dt><dd className="break-all" data-field="canonical-semantic-marker">{row.canonicalSemanticSource.marker}</dd>
                  <dt className="font-semibold">Stable local marker</dt><dd className="break-all" data-field="stable-local-marker">{row.canonicalSemanticSource.stableLocalMarker}</dd>
                  <dt className="font-semibold">Canonical semantic sha256</dt><dd className="break-all" data-field="canonical-semantic-sha256">{row.canonicalSemanticSource.semanticSha256}</dd>
                </>
              ) : null}
              {row.reuseOf ? (<><dt className="font-semibold">Reused asset</dt><dd>Figure {row.reuseOf}</dd></>) : null}
              <dt className="font-semibold">Visible status</dt><dd>{row.visibleStatus}</dd>
              <dt className="font-semibold">Accessible equivalent</dt><dd>{row.accessibleEquivalent}</dd>
              <dt className="font-semibold">Remaining Matrix MC decision</dt><dd>{row.remainingDecision}</dd>
              <dt className="font-semibold">Lineage kind</dt><dd data-field="lineage-kind">{row.lineage.kind}</dd>
              <dt className="font-semibold">Source file</dt><dd className="break-all">{row.lineage.sourceFile ?? 'none'}</dd>
              <dt className="font-semibold">Live file sha256</dt><dd className="break-all" data-field="live-file-sha256">{row.lineage.liveFileSha256 ?? 'none'}</dd>
              <dt className="font-semibold">Staged file sha256</dt><dd className="break-all" data-field="staged-file-sha256">{row.lineage.stagedFileSha256 ?? 'none'}</dd>
              <dt className="font-semibold">Fence sha256 + line</dt><dd className="break-all" data-field="fence-sha256">{row.lineage.fenceSha256 ? `${row.lineage.fenceSha256} (fence #${row.lineage.fenceOrdinal}, line ${row.lineage.fenceStartLine})` : 'none'}</dd>
              <dt className="font-semibold">Render binding</dt><dd>{row.lineage.renderBinding}</dd>
              <dt className="font-semibold">Carried encoding repairs</dt><dd>{row.lineage.carriedEncodingRepairs}</dd>
              <dt className="font-semibold">Lineage note</dt><dd className="[overflow-wrap:anywhere]">{row.lineage.note}</dd>
            </dl>
            <div className="reader-prose mt-4">
              {figure ? <PaperFigure model={figure.model} binding={figure.binding} /> : (
                <p role={notDrawnFallback(row).live ? 'status' : undefined}>{notDrawnFallback(row).text}</p>
              )}
            </div>
            {sedsPrototypeBinding ? (
              <div className="mt-6" data-seds-prototype-section={row.number}>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--db-text-secondary)]">Adjudicated label prototype (SedS names) -- lab only</h3>
                <div className="reader-prose mt-3">
                  <PaperFigure model={figure!.model} binding={sedsPrototypeBinding} />
                </div>
              </div>
            ) : null}
            {candidates.length > 0 ? (
              <div className="mt-6" data-candidate-section={row.number}>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--db-text-secondary)]">Matrix MC content candidate</h3>
                {candidates.map((candidate) => (
                  <div key={candidate.placement} className="reader-prose mt-3">
                    <PaperFigure model={candidate.model} binding={candidate.binding} />
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        );
      })}
      <section aria-labelledby="figure-lab-proposed" className="mt-12 border-t border-[var(--db-border)] pt-6">
        <h2 id="figure-lab-proposed" className="text-lg font-semibold">Proposed additional figures</h2>
        <p className="mt-2 text-sm text-[var(--db-text-secondary)]">Deterministic re-drawings of existing tables and lists, each bound to its exact source block. PROPOSED; not adopted.</p>
        <div className="reader-prose mt-4">
          {proposed.map((figure) => <PaperFigure key={figure.binding.id} model={figure.model} binding={figure.binding} />)}
        </div>
      </section>
    </main>
  );
}
