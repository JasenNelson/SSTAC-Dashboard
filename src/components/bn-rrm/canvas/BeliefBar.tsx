/**
 * BeliefBar Component
 *
 * Visualizes probability distribution for a node's states as horizontal bars.
 * Features:
 * - Click to set evidence (100% probability)
 * - Visual distinction for observed vs. inferred states
 * - Guideline reference lines (ISQG, PEL)
 * - Smooth animations
 */

'use client';

import { memo } from 'react';
import { cn } from '@/utils/cn';
import type { NodeState, BeliefDistribution, GuidelineReference } from '@/types/bn-rrm/network';

interface BeliefBarProps {
  states: NodeState[];
  beliefs: BeliefDistribution;
  evidence: string | null;
  guidelines?: GuidelineReference[];
  onStateClick?: (stateId: string) => void;
  compact?: boolean;
  showLabels?: boolean;
  showPercentages?: boolean;
}

export const BeliefBar = memo(function BeliefBar({
  states,
  beliefs,
  evidence,
  guidelines: _guidelines,
  onStateClick,
  compact = false,
  showLabels = true,
  showPercentages = true,
}: BeliefBarProps) {
  const maxProbability = Math.max(...Object.values(beliefs), 0.01);

  return (
    <div className={cn('w-full', compact ? 'space-y-1' : 'space-y-1.5')}>
      {states.map((state) => {
        const probability = beliefs[state.id] ?? 0;
        const isEvidence = evidence === state.id;
        const barWidth = (probability / maxProbability) * 100;

        return (
          <div
            key={state.id}
            className={cn(
              'group relative flex items-center gap-2',
              compact ? 'h-5' : 'h-6',
              onStateClick && 'cursor-pointer'
            )}
            onClick={() => onStateClick?.(state.id)}
            role={onStateClick ? 'button' : undefined}
            tabIndex={onStateClick ? 0 : undefined}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onStateClick?.(state.id);
              }
            }}
          >
            {/* State label */}
            {showLabels && (
              <span
                className={cn(
                  'shrink-0 text-xs font-medium truncate',
                  compact ? 'w-14' : 'w-20',
                  isEvidence ? 'text-blue-700 dark:text-blue-400' : 'text-slate-600 dark:text-slate-200'
                )}
                title={state.label}
              >
                {state.label}
              </span>
            )}

            {/* Bar container */}
            <div className="relative flex-1 h-full bg-slate-100 dark:bg-slate-700 rounded overflow-hidden">
              {/* Probability bar */}
              <div
                className={cn(
                  'absolute inset-y-0 left-0 rounded transition-all duration-500 ease-out',
                  isEvidence
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600'
                    : state.color
                    ? ''
                    : 'bg-slate-400',
                  onStateClick && 'group-hover:brightness-110'
                )}
                style={{
                  width: `${barWidth}%`,
                  backgroundColor: !isEvidence && state.color ? state.color : undefined,
                }}
              />

              {/* Evidence indicator */}
              {isEvidence && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[9px] font-bold text-white uppercase tracking-wider drop-shadow">
                    Observed
                  </span>
                </div>
              )}

              {/* Hover hint */}
              {onStateClick && !isEvidence && probability > 0.1 && (
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-[9px] text-white font-medium bg-black/40 px-1.5 py-0.5 rounded">
                    Click to observe
                  </span>
                </div>
              )}
            </div>

            {/* Percentage label */}
            {showPercentages && (
              <span
                className={cn(
                  'shrink-0 text-xs tabular-nums text-right font-medium',
                  compact ? 'w-8' : 'w-10',
                  isEvidence ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-200'
                )}
              >
                {(probability * 100).toFixed(0)}%
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
});

// =============================================================================
// COMPACT VERSION FOR USE IN NODES
// =============================================================================

interface CompactBeliefBarProps {
  states: NodeState[];
  beliefs: BeliefDistribution;
  evidence: string | null;
}

export const CompactBeliefBar = memo(function CompactBeliefBar({
  states,
  beliefs,
  evidence,
}: CompactBeliefBarProps) {
  return (
    <div className="flex h-2.5 w-full rounded overflow-hidden shadow-inner bg-slate-100 dark:bg-slate-700">
      {states.map((state) => {
        const probability = beliefs[state.id] ?? 0;
        const isEvidence = evidence === state.id;

        return (
          <div
            key={state.id}
            className={cn(
              'h-full transition-all duration-500',
              isEvidence && 'ring-2 ring-blue-500 ring-inset'
            )}
            style={{
              width: `${probability * 100}%`,
              backgroundColor: state.color || '#94a3b8',
              minWidth: probability > 0 ? '2px' : '0',
            }}
            title={`${state.label}: ${(probability * 100).toFixed(1)}%`}
          />
        );
      })}
    </div>
  );
});

// =============================================================================
// STACKED VERSION FOR IMPACT NODES
// =============================================================================

interface ImpactBeliefBarProps {
  beliefs: BeliefDistribution;
  evidence: string | null;
  onStateClick?: (stateId: string) => void;
}

const IMPACT_STATES = [
  { id: 'none', label: 'None', color: '#22c55e' },
  { id: 'minor', label: 'Minor', color: '#eab308' },
  { id: 'moderate', label: 'Moderate', color: '#f97316' },
  { id: 'severe', label: 'Severe', color: '#ef4444' },
];

export const ImpactBeliefBar = memo(function ImpactBeliefBar({
  beliefs,
  evidence,
  onStateClick,
}: ImpactBeliefBarProps) {
  return (
    <div className="space-y-2">
      <div className="flex h-8 w-full rounded-lg overflow-hidden shadow-inner">
        {IMPACT_STATES.map((state) => {
          const probability = beliefs[state.id] ?? 0;
          const isEvidence = evidence === state.id;

          return (
            <button
              key={state.id}
              onClick={() => onStateClick?.(state.id)}
              disabled={!onStateClick}
              className={cn(
                'h-full flex items-center justify-center transition-all duration-300',
                isEvidence && 'ring-2 ring-white ring-inset',
                onStateClick && 'hover:brightness-110 cursor-pointer'
              )}
              style={{
                width: `${probability * 100}%`,
                backgroundColor: state.color,
                minWidth: probability > 0.05 ? '28px' : probability > 0 ? '4px' : '0',
              }}
            >
              {probability >= 0.1 && (
                <span className="text-[11px] font-bold text-white drop-shadow">
                  {(probability * 100).toFixed(0)}%
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex justify-between text-[9px] text-slate-500 dark:text-slate-400">
        {IMPACT_STATES.map((state) => (
          <span key={state.id} className="flex items-center gap-1">
            <span
              className="w-2 h-2 rounded-full shadow-sm"
              style={{ backgroundColor: state.color }}
            />
            {state.label}
          </span>
        ))}
      </div>
    </div>
  );
});
