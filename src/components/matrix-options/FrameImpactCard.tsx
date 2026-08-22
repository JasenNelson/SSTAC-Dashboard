import { cn } from '@/utils/cn';
import RegulatoryFrameNotice from './RegulatoryFrameNotice';
import FrameVariantFallbackNotice from './FrameVariantFallbackNotice';
import type { RegulatoryFrameId } from '@/lib/matrix-options/regulatoryFrames';
import type { ProvenancePathway } from '@/lib/matrix-options/provenance/pathways';

export interface FrameImpactCardProps {
  frameId: RegulatoryFrameId;
  pathway: ProvenancePathway;
  usedBaselineFallback: boolean;
  fallbackReason?: string;
  className?: string;
}

export default function FrameImpactCard({
  frameId,
  pathway,
  usedBaselineFallback,
  fallbackReason,
  className,
}: FrameImpactCardProps) {
  return (
    <details
      data-testid="frame-impact-card"
      role="region"
      aria-label="Regulatory frame impact"
      className={cn(
        'group mb-5 rounded-xl border border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/40 shadow-sm overflow-hidden',
        className,
      )}
    >
      <summary className="flex items-center justify-between p-3 px-4 cursor-pointer select-none bg-slate-100/70 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
          Regulatory frame impact
        </h4>
        <span className="text-xs font-medium text-sky-600 dark:text-sky-400">
          <span className="group-open:hidden">show [+]</span>
          <span className="hidden group-open:inline">hide [-]</span>
        </span>
      </summary>
      <div className="p-4 space-y-3 border-t border-slate-200 dark:border-slate-800">
        <RegulatoryFrameNotice frameId={frameId} pathway={pathway} />
        <FrameVariantFallbackNotice
          usedBaselineFallback={usedBaselineFallback}
          frameId={frameId}
          fallbackReason={fallbackReason}
        />
      </div>
    </details>
  );
}
