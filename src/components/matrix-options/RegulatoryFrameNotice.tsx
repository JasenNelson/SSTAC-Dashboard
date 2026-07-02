import { cn } from '@/utils/cn';
import {
  getPathwayApplicability,
  getRegulatoryFrame,
  pathwayApplicabilityLabel,
  pathwayApplicabilityTone,
  type RegulatoryFrameId,
} from '@/lib/matrix-options/regulatoryFrames';
import type { ProvenancePathway } from '@/lib/matrix-options/provenance/types';

interface RegulatoryFrameNoticeProps {
  frameId: RegulatoryFrameId;
  pathway: ProvenancePathway;
  className?: string;
}

function toneClasses(tone: string): string {
  if (tone === 'emerald') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200';
  }
  if (tone === 'amber') {
    return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200';
  }
  if (tone === 'sky') {
    return 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-900/20 dark:text-sky-200';
  }
  return 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200';
}

export default function RegulatoryFrameNotice({
  frameId,
  pathway,
  className,
}: RegulatoryFrameNoticeProps) {
  const frame = getRegulatoryFrame(frameId);
  const applicability = getPathwayApplicability(frameId, pathway);
  const tone = pathwayApplicabilityTone(applicability.status);
  const primarySource = frame.sourceHierarchy[0];
  // The static-fallback suppression fix (2026-07-02) only affects the two eco calculators, so the
  // suppression copy is scoped to eco pathways; other pathways keep the original default-behavior note.
  const isEcoPathway =
    pathway === 'eco-direct-eqp' || pathway === 'eco-food-bsaf';

  return (
    <section
      data-testid={`regulatory-frame-notice-${pathway}`}
      className={cn(
        'mb-5 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-800 dark:bg-slate-950/40',
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Regulatory frame
          </p>
          <h4 className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
            {frame.shortLabel}
          </h4>
        </div>
        <span
          className={cn(
            'inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold',
            toneClasses(tone),
          )}
        >
          {pathwayApplicabilityLabel(applicability.status)}
        </span>
      </div>
      <p className="mt-2 leading-relaxed text-slate-600 dark:text-slate-300">
        {applicability.note}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        Source hierarchy: {primarySource?.label ?? 'Project-approved sources'}.
        {' '}
        {frame.safeUseNote}
      </p>
      <p
        className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400"
        data-testid={`regulatory-frame-effect-${pathway}`}
      >
        Current effect: frame selection changes value lookup filters, source
        hierarchy, and pathway warnings.{' '}
        {isEcoPathway
          ? 'For this eco pathway, a reference-only or unsupported frame now ' +
            'suppresses the calculator input default (left blank) instead of ' +
            'showing an unsupported static value; supported (needs-review or ' +
            'better) frames still seed the input from the source-priority ' +
            'catalog or the current default.'
          : 'It does not change calculator input defaults until a source-backed ' +
            'value is approved as the default.'}
      </p>
    </section>
  );
}
