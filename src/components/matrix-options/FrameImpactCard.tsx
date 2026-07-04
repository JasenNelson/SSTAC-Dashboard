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
    <section
      data-testid="frame-impact-card"
      role="region"
      aria-label="Regulatory frame impact"
      className={cn(
        'rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3 dark:border-slate-800 dark:bg-slate-900/40',
        className,
      )}
    >
      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
        Regulatory frame impact
      </h4>
      <RegulatoryFrameNotice frameId={frameId} pathway={pathway} />
      <FrameVariantFallbackNotice
        usedBaselineFallback={usedBaselineFallback}
        frameId={frameId}
        fallbackReason={fallbackReason}
      />
    </section>
  );
}
