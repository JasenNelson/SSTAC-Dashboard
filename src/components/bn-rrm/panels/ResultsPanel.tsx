/**
 * ResultsPanel Component
 *
 * Panel showing inference results:
 * - Forward inference: Current ecological risk probabilities
 * - Backward inference: Protective concentration derivation through causal pathways
 */

'use client';

import { memo, useState, useMemo, useEffect } from 'react';
import { useNetworkStore } from '@/stores/bn-rrm/networkStore';
import { cn } from '@/utils/cn';
import {
  ArrowRight,
  ArrowLeft,
  BarChart3,
  Target,
  AlertCircle,
  CheckCircle,
  Calculator,
  Download,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Beaker,
} from 'lucide-react';
import { InfoTooltip } from '@/components/bn-rrm/shared/InfoTooltip';
import { TOOLTIP } from '@/components/bn-rrm/shared/tooltip-definitions';

// =============================================================================
// RISK DISPLAY CONFIG
// =============================================================================

const RISK_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string; description: string }
> = {
  low: {
    label: 'Low Risk',
    color: 'text-green-700 dark:text-green-300',
    bgColor: 'bg-green-100 dark:bg-green-500/60',
    description: 'Reference-like conditions — minimal ecological concern',
  },
  moderate: {
    label: 'Moderate Risk',
    color: 'text-orange-700 dark:text-orange-300',
    bgColor: 'bg-orange-100 dark:bg-orange-500/60',
    description: 'Some concern — bioavailable contaminants or stressed community',
  },
  high: {
    label: 'High Risk',
    color: 'text-red-700 dark:text-red-300',
    bgColor: 'bg-red-100 dark:bg-red-500/60',
    description: 'Significant risk — multiple lines of evidence indicate impact',
  },
};

// Fallback for dummy model 4-class states
const DUMMY_RISK_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string; description: string }
> = {
  none: { label: 'None', color: 'text-green-700 dark:text-green-300', bgColor: 'bg-green-100 dark:bg-green-500/60', description: 'Reference condition' },
  minor: { label: 'Minor', color: 'text-yellow-700 dark:text-yellow-300', bgColor: 'bg-yellow-100 dark:bg-yellow-500/60', description: 'Slight deviation' },
  moderate: { label: 'Moderate', color: 'text-orange-700 dark:text-orange-300', bgColor: 'bg-orange-100 dark:bg-orange-500/60', description: 'Clear impact' },
  severe: { label: 'Severe', color: 'text-red-700 dark:text-red-300', bgColor: 'bg-red-100 dark:bg-red-500/60', description: 'Major impact' },
};

import {
  dagComputeSensitivity,
  dagProtectiveConcentration,
} from '@/lib/bn-rrm/bn-inference';
import type { BackwardInferenceRequest, BackwardInferenceResult } from '@/types/bn-rrm/network';

// =============================================================================
// RESULTS PANEL COMPONENT
// =============================================================================

type InferenceMode = 'forward' | 'backward';

interface ResultsPanelProps {
  className?: string;
}

export const ResultsPanel = memo(function ResultsPanel({
  className,
}: ResultsPanelProps) {
  const [mode, setMode] = useState<InferenceMode>('forward');
  const [isExpanded, setIsExpanded] = useState(true);

  const { model, evidence, clearAllEvidence } = useNetworkStore();

  // Find the impact node (ecological_risk for trained, benthic_impact for dummy)
  const riskNode = useMemo(() => {
    if (!model) return null;
    return model.nodes.find((n) => n.category === 'impact');
  }, [model]);

  const evidenceCount = Object.keys(evidence).length;

  // Determine which risk config to use based on the impact node states
  const riskConfigMap = useMemo(() => {
    if (!riskNode) return RISK_CONFIG;
    // Check if states match 3-class (low/moderate/high) or 4-class (none/minor/moderate/severe)
    const stateIds = riskNode.states.map(s => s.id);
    if (stateIds.includes('none') || stateIds.includes('severe')) return DUMMY_RISK_CONFIG;
    return RISK_CONFIG;
  }, [riskNode]);

  // Calculate risk level based on impact node beliefs
  const riskAssessment = useMemo(() => {
    if (!riskNode) return null;

    const beliefs = riskNode.beliefs;
    const stateIds = riskNode.states.map(s => s.id);
    const probabilities: Record<string, number> = {};
    for (const s of stateIds) {
      probabilities[s] = beliefs[s] ?? 0;
    }

    // Find highest-severity state with meaningful probability
    const worstStates = [...stateIds].reverse(); // worst first
    let level: 'low' | 'medium' | 'high' | 'very-high' = 'low';
    let message = 'Low probability of ecological impact';

    const worstProb = probabilities[worstStates[0]] ?? 0;
    const secondWorstProb = probabilities[worstStates[1]] ?? 0;

    if (worstProb > 0.5) {
      level = 'very-high';
      message = 'High probability of significant ecological risk';
    } else if (worstProb + secondWorstProb > 0.4) {
      level = 'high';
      message = 'Elevated probability of moderate-to-high risk';
    } else if (secondWorstProb > 0.2 || worstProb > 0.15) {
      level = 'medium';
      message = 'Moderate risk — some causal pathways elevated';
    } else {
      level = 'low';
      message = 'Low risk — consistent with reference conditions';
    }

    return { level, message, probabilities };
  }, [riskNode]);

  return (
    <div className={cn('bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 flex flex-col', className)}>
      {/* Header with mode toggle */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">Inference Results</h3>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Mode toggle */}
        <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
          <button
            onClick={() => setMode('forward')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors',
              mode === 'forward'
                ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            )}
          >
            <ArrowRight className="w-4 h-4" />
            Forward
          </button>
          <button
            onClick={() => setMode('backward')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors',
              mode === 'backward'
                ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            )}
          >
            <ArrowLeft className="w-4 h-4" />
            Backward
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="flex-1 overflow-y-auto">
          {mode === 'forward' ? (
            <ForwardInferenceView
              riskAssessment={riskAssessment}
              evidenceCount={evidenceCount}
              riskConfigMap={riskConfigMap}
              model={model}
            />
          ) : (
            <BackwardInferenceView />
          )}
        </div>
      )}

      {/* Footer actions */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-700">
        <div className="flex gap-2">
          <button
            onClick={() => clearAllEvidence()}
            className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Reset
          </button>
          <button
            onClick={() => {
              const nodes = model ? Object.fromEntries(
                model.nodes.map(n => [n.id, { label: n.label, category: n.category, beliefs: n.beliefs, evidence: n.evidence }])
              ) : {};
              const data = { exportDate: new Date().toISOString(), evidence, nodes };
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `bn-rrm-results-${new Date().toISOString().split('T')[0]}.json`;
              a.style.display = 'none';
              document.body.appendChild(a);
              a.click();
              setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
            }}
            className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-blue-500 hover:bg-blue-600 rounded-lg text-sm font-medium text-white transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>
    </div>
  );
});

// =============================================================================
// FORWARD INFERENCE VIEW
// =============================================================================

interface ForwardInferenceViewProps {
  riskAssessment: {
    level: 'low' | 'medium' | 'high' | 'very-high';
    message: string;
    probabilities: Record<string, number>;
  } | null;
  evidenceCount: number;
  riskConfigMap: Record<string, { label: string; color: string; bgColor: string; description: string }>;
  model: import('@/types/bn-rrm/network').NetworkModel | null;
}

function ForwardInferenceView({
  riskAssessment,
  evidenceCount,
  riskConfigMap,
  model,
}: ForwardInferenceViewProps) {
  if (!riskAssessment) {
    return (
      <div className="p-4 text-center text-slate-400 dark:text-slate-500">
        <Calculator className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="text-sm">No impact node found</p>
      </div>
    );
  }

  const levelConfig = {
    low: {
      icon: CheckCircle,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      borderColor: 'border-green-200 dark:border-green-700',
    },
    medium: {
      icon: AlertCircle,
      color: 'text-yellow-600 dark:text-yellow-400',
      bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
      borderColor: 'border-yellow-200 dark:border-yellow-700',
    },
    high: {
      icon: AlertCircle,
      color: 'text-orange-600 dark:text-orange-400',
      bgColor: 'bg-orange-50 dark:bg-orange-900/20',
      borderColor: 'border-orange-200 dark:border-orange-700',
    },
    'very-high': {
      icon: AlertCircle,
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      borderColor: 'border-red-200 dark:border-red-700',
    },
  };

  const config = levelConfig[riskAssessment.level];
  const Icon = config.icon;

  return (
    <div className="p-4 space-y-4">
      {/* Inference basis */}
      <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <Target className="w-4 h-4 text-slate-400 dark:text-slate-500" />
          <span className="text-slate-600 dark:text-slate-400">
            {evidenceCount === 0
              ? 'Prior probabilities only — no evidence set'
              : `Evidence from ${evidenceCount} node${evidenceCount > 1 ? 's' : ''}`}
          </span>
          <InfoTooltip
            {...(evidenceCount === 0 ? TOOLTIP.inferenceBasis.noEvidence : TOOLTIP.inferenceBasis.withEvidence)}
          />
        </div>
        {evidenceCount > 0 && model && (
          <div className="text-xs text-slate-500 dark:text-slate-400 pl-6">
            {model.nodes
              .filter(n => n.evidence !== undefined && n.evidence !== null)
              .map(n => n.label)
              .join(', ')}
          </div>
        )}
        <p className="text-xs text-slate-400 dark:text-slate-500 pl-6 italic">
          These are model estimates, not measured outcomes.
        </p>
      </div>

      {/* Risk summary card */}
      <div
        className={cn(
          'rounded-lg border-2 p-4',
          config.bgColor,
          config.borderColor
        )}
      >
        <div className="flex items-start gap-3">
          <Icon className={cn('w-6 h-6 mt-0.5', config.color)} />
          <div>
            <div className="flex items-center gap-1.5">
              <h4 className={cn('font-semibold', config.color)}>
                {riskAssessment.level === 'very-high'
                  ? 'Very High Risk'
                  : `${riskAssessment.level.charAt(0).toUpperCase() + riskAssessment.level.slice(1)} Risk`}
              </h4>
              <InfoTooltip
                {...TOOLTIP.riskClassification}
                position="left"
              />
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{riskAssessment.message}</p>
          </div>
        </div>
      </div>

      {/* Risk probability breakdown */}
      <div>
        <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
          <BarChart3 className="w-4 h-4" />
          Ecological Risk Distribution
          <InfoTooltip {...TOOLTIP.ecologicalRiskDistribution} />
        </h4>

        <div className="space-y-2">
          {Object.entries(riskConfigMap).map(([key, riskConf]) => {
            const probability = riskAssessment.probabilities[key] ?? 0;

            return (
              <div key={key} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className={cn('font-medium', riskConf.color)}>
                    {riskConf.label}
                  </span>
                  <span className="text-slate-600 dark:text-slate-400 tabular-nums">
                    {(probability * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500', riskConf.bgColor)}
                    style={{ width: `${probability * 100}%` }}
                  />
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500">{riskConf.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cumulative probability */}
      <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
          Cumulative Probability
          <InfoTooltip {...TOOLTIP.cumulativeProbability} />
        </h4>
        <div className="space-y-2 text-sm">
          {(() => {
            const probs = riskAssessment.probabilities;
            const stateKeys = Object.keys(probs);
            // For 3-class: P(low) and P(>=moderate)
            if (stateKeys.includes('low') && stateKeys.includes('high')) {
              return (
                <>
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">P(Risk = Low)</span>
                    <span className="font-medium text-green-600 dark:text-green-400">
                      {((probs.low ?? 0) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">P(Risk &ge; Moderate)</span>
                    <span className="font-medium text-orange-600 dark:text-orange-400">
                      {(((probs.moderate ?? 0) + (probs.high ?? 0)) * 100).toFixed(1)}%
                    </span>
                  </div>
                </>
              );
            }
            // For 4-class: P(<=minor) and P(>=moderate)
            return (
              <>
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">P(Impact &le; Minor)</span>
                  <span className="font-medium text-green-600 dark:text-green-400">
                    {(((probs.none ?? 0) + (probs.minor ?? 0)) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">P(Impact &ge; Moderate)</span>
                  <span className="font-medium text-orange-600 dark:text-orange-400">
                    {(((probs.moderate ?? 0) + (probs.severe ?? 0)) * 100).toFixed(1)}%
                  </span>
                </div>
              </>
            );
          })()}
        </div>
      </div>

      {/* Model info badge */}
      {model && (
        <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3 border border-blue-100 dark:border-blue-900/40">
          <p className="text-xs text-blue-700 dark:text-blue-300">
            <strong>{model.name ?? 'BN-RRM Causal Model'}</strong> — {model.nodes.length} nodes, {model.cpts.length} CPTs, {model.edges.length} causal edges
          </p>
          <p className="text-[10px] text-blue-500 dark:text-blue-400 mt-1 line-clamp-3">
            {model.description}
          </p>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// BACKWARD INFERENCE VIEW
// =============================================================================

function BackwardInferenceView() {
  const { model, evidence } = useNetworkStore();
  const [queryParameter, setQueryParameter] = useState('');
  const [targetRisk, setTargetRisk] = useState<string>('low');
  const [targetProbability, setTargetProbability] = useState(85);
  const [dagResult, setDagResult] = useState<BackwardInferenceResult | null>(null);

  // Find substance nodes for the query selector
  const substanceNodes = useMemo(() => {
    if (!model) return [];
    return model.nodes.filter(n => n.category === 'substance');
  }, [model]);

  // Default to first substance node when model changes (replaces hardcoded sed_cu)
  useEffect(() => {
    if (substanceNodes.length > 0 && !substanceNodes.some(n => n.id === queryParameter)) {
      setQueryParameter(substanceNodes[0].id);
    }
  }, [substanceNodes, queryParameter]);

  // Find impact node
  const impactNode = useMemo(() => {
    if (!model) return null;
    return model.nodes.find(n => n.category === 'impact');
  }, [model]);

  // Compute DAG sensitivity
  const sensitivity = useMemo(() => {
    if (model && impactNode) {
      const worstState = impactNode.states[impactNode.states.length - 1]?.id ?? 'high';
      return dagComputeSensitivity(model, impactNode.id, worstState, evidence);
    }
    return [];
  }, [model, impactNode, evidence]);

  // Run protective concentration calculation
  const handleCalculate = () => {
    if (!model || !impactNode) return;

    const request: BackwardInferenceRequest = {
      targetNode: impactNode.id,
      acceptableStates: [targetRisk],
      targetProbability: targetProbability / 100,
      queryNode: queryParameter,
      fixedEvidence: evidence,
    };

    const result = dagProtectiveConcentration(model, request);
    setDagResult(result);
  };

  return (
    <div className="p-4 space-y-4">
      {/* Explanation */}
      <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3 border border-blue-100 dark:border-blue-900/40">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          <strong>Backward inference</strong> traces through the causal chain to
          derive the substance state needed for a target protection level.
        </p>
      </div>

      {/* Protection Level Controls */}
      {impactNode && (
        <div className="space-y-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <Target className="w-4 h-4" />
            Protection Level
          </h4>

          {/* Target risk level */}
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Target Risk Level</label>
            <select
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
              value={targetRisk}
              onChange={(e) => setTargetRisk(e.target.value)}
            >
              {impactNode.states.map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Target probability slider */}
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
              Target Probability: <span className="font-semibold text-slate-700 dark:text-slate-200">{targetProbability}%</span>
            </label>
            <input
              type="range"
              min={50}
              max={99}
              value={targetProbability}
              onChange={(e) => setTargetProbability(Number(e.target.value))}
              className="w-full h-2 bg-slate-200 dark:bg-slate-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
            <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
              <span>50%</span>
              <span>75%</span>
              <span>99%</span>
            </div>
          </div>

          {/* Query substance */}
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Solve for Substance</label>
            <select
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
              value={queryParameter}
              onChange={(e) => { setQueryParameter(e.target.value); setDagResult(null); }}
            >
              {substanceNodes.map(n => (
                <option key={n.id} value={n.id}>{n.label}</option>
              ))}
            </select>
          </div>

          {/* Calculate button */}
          <button
            onClick={handleCalculate}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-500 hover:bg-blue-600 rounded-lg text-sm font-medium text-white transition-colors"
          >
            <Calculator className="w-4 h-4" />
            Calculate Protective Concentration
          </button>
        </div>
      )}

      {/* Backward inference result */}
      {dagResult && (
        <div className={cn(
          'border-2 rounded-lg p-4 transition-all',
          dagResult.achievedProbability >= targetProbability / 100
            ? 'border-green-200 dark:border-green-700 bg-green-50 dark:bg-green-900/20'
            : 'border-yellow-200 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20'
        )}>
          <div className="flex items-start gap-3">
            <Beaker className={cn(
              'w-6 h-6 mt-0.5',
              dagResult.achievedProbability >= targetProbability / 100 ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'
            )} />
            <div className="flex-1">
              <h4 className={cn(
                'font-semibold',
                dagResult.achievedProbability >= targetProbability / 100 ? 'text-green-800 dark:text-green-200' : 'text-yellow-800 dark:text-yellow-200'
              )}>
                Protective State: {dagResult.protectiveState}
              </h4>
              {dagResult.protectiveValue !== undefined && (
                <p className="text-2xl font-bold mt-1 text-slate-800 dark:text-slate-100">
                  &le; {dagResult.protectiveValue}
                </p>
              )}
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                P({targetRisk}) = {(dagResult.achievedProbability * 100).toFixed(1)}%
                {dagResult.achievedProbability >= targetProbability / 100
                  ? ' (target met)'
                  : ` (target: ${targetProbability}%)`}
              </p>
            </div>
          </div>

          {/* Computation steps */}
          <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
            <h5 className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Computation Steps</h5>
            <div className="space-y-0.5">
              {dagResult.computationSteps.map((step, i) => (
                <p key={i} className="text-xs text-slate-500 dark:text-slate-400 font-mono">{step}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sensitivity Analysis */}
      <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
          <BarChart3 className="w-4 h-4" />
          Sensitivity Analysis (Tornado)
          <InfoTooltip {...TOOLTIP.sensitivityAnalysis} />
        </h4>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
          Change in P(worst state) when each source node varies from best to worst
        </p>

        <div className="space-y-3">
          {sensitivity.map((item) => {
            const maxRange = Math.max(...sensitivity.map(s => s.range));
            const barWidth = maxRange > 0 ? (item.range / maxRange) * 100 : 0;

            return (
              <div key={item.parameter} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700 dark:text-slate-300">{item.label}</span>
                  <span className="text-slate-500 dark:text-slate-400 tabular-nums">
                    {(item.lowValueImpact * 100).toFixed(0)}% &rarr; {(item.highValueImpact * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="h-4 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden relative">
                  <div
                    className="h-full bg-gradient-to-r from-green-400 to-red-400 rounded-full transition-all duration-500"
                    style={{ width: `${barWidth}%` }}
                  />
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-slate-700 dark:text-slate-300">
                    {'\u0394'}{(item.range * 100).toFixed(0)}pp
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default ResultsPanel;
