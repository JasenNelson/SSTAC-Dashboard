'use client';

import { InfoTooltip } from './InfoTooltip';

type ModeIndicatorMode = 'screening' | 'assessment' | 'both';

interface ModeIndicatorProps {
  mode: ModeIndicatorMode;
  className?: string;
}

const MODE_CONFIG: Record<ModeIndicatorMode, {
  label: string;
  border: string;
  text: string;
  bg: string;
  tooltipTitle: string;
  tooltipDescription: string;
}> = {
  screening: {
    label: 'Screening Mode',
    border: 'border-blue-400 dark:border-blue-500',
    text: 'text-blue-700 dark:text-blue-300',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    tooltipTitle: 'Screening Mode',
    tooltipDescription:
      'Uses only chemistry data (no toxicity or community observations). Represents the minimum-data scenario for rapid site triage.',
  },
  assessment: {
    label: 'Assessment Mode',
    border: 'border-green-400 dark:border-green-500',
    text: 'text-green-700 dark:text-green-300',
    bg: 'bg-green-50 dark:bg-green-900/20',
    tooltipTitle: 'Assessment Mode',
    tooltipDescription:
      'Uses all available evidence including toxicity and community data. Represents the full weight-of-evidence scenario.',
  },
  both: {
    label: 'Screening vs Assessment',
    border: 'border-purple-400 dark:border-purple-500',
    text: 'text-purple-700 dark:text-purple-300',
    bg: 'bg-purple-50 dark:bg-purple-900/20',
    tooltipTitle: 'Screening vs Assessment Comparison',
    tooltipDescription:
      'Compares predictions when only chemistry is available (screening) against predictions using all evidence (assessment). Shows where additional data changes the risk determination.',
  },
};

export function ModeIndicator({ mode, className }: ModeIndicatorProps) {
  const config = MODE_CONFIG[mode];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${config.border} ${config.text} ${config.bg} ${className ?? ''}`}
    >
      {config.label}
      <InfoTooltip
        title={config.tooltipTitle}
        description={config.tooltipDescription}
        iconSize={12}
      />
    </span>
  );
}
