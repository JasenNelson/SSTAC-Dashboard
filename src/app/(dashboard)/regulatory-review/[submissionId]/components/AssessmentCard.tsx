'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { Info, Save, SkipForward, RotateCcw, AlertTriangle } from 'lucide-react';
import StatusBadge, { type StatusType } from '@/components/regulatory-review/StatusBadge';
import TierBadge, { type TierType } from '@/components/regulatory-review/TierBadge';
import ConfidenceMeter, { type ConfidenceLevel } from '@/components/regulatory-review/ConfidenceMeter';
import EvidenceAccordion, { type EvidenceItem } from '@/components/regulatory-review/EvidenceAccordion';
import {
  HumanResult,
  ReviewStatus,
  DiscretionTier,
  AssessmentResult,
  ConfidenceLevel as ConfidenceLevelEnum,
} from '@/lib/regulatory-review/types';
import type {
  Assessment,
  Judgment,
  UpdateJudgment,
} from '@/lib/regulatory-review/types';

// ============================================================================
// Props Interface
// ============================================================================

export interface AssessmentCardProps {
  /** Assessment data from AI evaluation */
  assessment: Assessment;
  /** Optional existing human judgment */
  judgment?: Judgment;
  /** Callback when judgment changes */
  onJudgmentChange?: (judgment: UpdateJudgment) => void;
  /** Callback when skipping to next assessment */
  onSkip?: () => void;
  /** Read-only mode for export/print */
  readOnly?: boolean;
}

// ============================================================================
// Type Mappings
// ============================================================================

/** Map AssessmentResult enum to StatusBadge StatusType */
const assessmentResultToStatus: Record<AssessmentResult, StatusType> = {
  [AssessmentResult.PASS]: 'PASS',
  [AssessmentResult.PARTIAL]: 'PARTIAL',
  [AssessmentResult.FAIL]: 'FAIL',
  [AssessmentResult.REQUIRES_JUDGMENT]: 'REQUIRES_JUDGMENT',
};

/** Map DiscretionTier enum to TierBadge TierType */
const discretionTierToTierType: Record<DiscretionTier, TierType> = {
  [DiscretionTier.TIER_1_BINARY]: 'TIER_1_BINARY',
  [DiscretionTier.TIER_2_PROFESSIONAL]: 'TIER_2_PROFESSIONAL',
  [DiscretionTier.TIER_3_STATUTORY]: 'TIER_3_STATUTORY',
};

/** Map ConfidenceLevel enum values */
const confidenceLevelMap: Record<ConfidenceLevelEnum, ConfidenceLevel> = {
  [ConfidenceLevelEnum.HIGH]: 'HIGH',
  [ConfidenceLevelEnum.MEDIUM]: 'MEDIUM',
  [ConfidenceLevelEnum.LOW]: 'LOW',
  [ConfidenceLevelEnum.NONE]: 'NONE',
};

// ============================================================================
// Human Decision Options
// ============================================================================

interface DecisionOption {
  value: HumanResult;
  label: string;
  description: string;
}

const DECISION_OPTIONS: DecisionOption[] = [
  {
    value: HumanResult.ACCEPT,
    label: 'Accept AI Result',
    description: 'Agree with the AI assessment as presented',
  },
  {
    value: HumanResult.OVERRIDE_PASS,
    label: 'Override: PASS',
    description: 'Override AI result - mark as passing',
  },
  {
    value: HumanResult.OVERRIDE_FAIL,
    label: 'Override: FAIL',
    description: 'Override AI result - mark as failing',
  },
  {
    value: HumanResult.DEFER,
    label: 'Defer to SDM',
    description: 'Route to Statutory Decision Maker',
  },
];

// ============================================================================
// Tier Constraint Logic
// ============================================================================

/**
 * Determine which human decision options are allowed based on discretion tier
 *
 * TIER_1_BINARY: All options allowed
 * TIER_2_PROFESSIONAL: Cannot Accept or Override PASS (AI cannot determine adequacy)
 * TIER_3_STATUTORY: Only Defer allowed (AI observes only)
 */
function getAllowedDecisions(tier: DiscretionTier): Set<HumanResult> {
  switch (tier) {
    case DiscretionTier.TIER_1_BINARY:
      // Full authority - all options available
      return new Set([
        HumanResult.ACCEPT,
        HumanResult.OVERRIDE_PASS,
        HumanResult.OVERRIDE_FAIL,
        HumanResult.DEFER,
      ]);

    case DiscretionTier.TIER_2_PROFESSIONAL:
      // Cannot accept AI result or override to PASS (AI cannot return ADEQUATE)
      return new Set([HumanResult.OVERRIDE_FAIL, HumanResult.DEFER]);

    case DiscretionTier.TIER_3_STATUTORY:
      // AI observes only - must defer to SDM
      return new Set([HumanResult.DEFER]);

    default:
      return new Set([HumanResult.DEFER]);
  }
}

/**
 * Get tooltip explanation for why an option is disabled
 */
function getDisabledTooltip(option: HumanResult, tier: DiscretionTier): string | null {
  if (tier === DiscretionTier.TIER_2_PROFESSIONAL) {
    if (option === HumanResult.ACCEPT) {
      return 'TIER_2 items require professional judgment - AI cannot determine adequacy';
    }
    if (option === HumanResult.OVERRIDE_PASS) {
      return 'Cannot mark as PASS - requires QP professional judgment';
    }
  }

  if (tier === DiscretionTier.TIER_3_STATUTORY) {
    if (option !== HumanResult.DEFER) {
      return 'TIER_3 statutory matters must be deferred to Statutory Decision Maker';
    }
  }

  return null;
}

// ============================================================================
// Sub-Components
// ============================================================================

/** Review status indicator badge */
function ReviewStatusBadge({ status }: { status: 'pending' | 'reviewed' | 'deferred' }) {
  const config = {
    pending: {
      bg: 'bg-yellow-100 dark:bg-yellow-900/30',
      text: 'text-yellow-800 dark:text-yellow-200',
      label: 'Pending Review',
    },
    reviewed: {
      bg: 'bg-green-100 dark:bg-green-900/30',
      text: 'text-green-800 dark:text-green-200',
      label: 'Reviewed',
    },
    deferred: {
      bg: 'bg-purple-100 dark:bg-purple-900/30',
      text: 'text-purple-800 dark:text-purple-200',
      label: 'Deferred',
    },
  };

  const { bg, text, label } = config[status];

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${bg} ${text}`}>
      {label}
    </span>
  );
}

/** Keywords display as small tags */
function KeywordTags({ keywords }: { keywords: string[] }) {
  if (keywords.length === 0) {
    return (
      <span className="text-sm text-gray-400 dark:text-gray-500 italic">
        No keywords matched
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {keywords.map((keyword, index) => (
        <span
          key={index}
          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
        >
          {keyword}
        </span>
      ))}
    </div>
  );
}

/** Evidence coverage percentage bar */
function EvidenceCoverageBar({ coverage }: { coverage: number }) {
  const getColorClass = (pct: number) => {
    if (pct >= 80) return 'bg-green-500 dark:bg-green-400';
    if (pct >= 50) return 'bg-yellow-500 dark:bg-yellow-400';
    return 'bg-red-500 dark:bg-red-400';
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${getColorClass(coverage)} transition-all duration-300`}
          style={{ width: `${Math.min(100, Math.max(0, coverage))}%` }}
        />
      </div>
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 tabular-nums">
        {coverage}%
      </span>
    </div>
  );
}

/** Tier constraint warning banner */
function TierConstraintBanner({ tier }: { tier: DiscretionTier }) {
  if (tier === DiscretionTier.TIER_1_BINARY) return null;

  const config: Record<
    string,
    {
      icon: typeof AlertTriangle;
      bg: string;
      border: string;
      text: string;
      message: string;
    }
  > = {
    [DiscretionTier.TIER_2_PROFESSIONAL]: {
      icon: AlertTriangle,
      bg: 'bg-amber-50 dark:bg-amber-900/20',
      border: 'border-amber-200 dark:border-amber-800',
      text: 'text-amber-800 dark:text-amber-200',
      message: 'TIER_2: AI flags deficiencies only. Cannot accept as ADEQUATE. Professional judgment required.',
    },
    [DiscretionTier.TIER_3_STATUTORY]: {
      icon: AlertTriangle,
      bg: 'bg-red-50 dark:bg-red-900/20',
      border: 'border-red-200 dark:border-red-800',
      text: 'text-red-800 dark:text-red-200',
      message: 'TIER_3: Statutory matter. AI observes only. Must defer to Statutory Decision Maker.',
    },
  };

  const tierConfig = config[tier];
  if (!tierConfig) return null;

  const Icon = tierConfig.icon;

  return (
    <div className={`flex items-start gap-2 p-3 rounded-lg border ${tierConfig.bg} ${tierConfig.border}`}>
      <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${tierConfig.text}`} />
      <p className={`text-xs ${tierConfig.text}`}>{tierConfig.message}</p>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function AssessmentCard({
  assessment,
  judgment,
  onJudgmentChange,
  onSkip,
  readOnly = false,
}: AssessmentCardProps) {
  // Local state for form fields (before save)
  const [localDecision, setLocalDecision] = useState<HumanResult | undefined>(
    judgment?.humanResult
  );
  const [localConfidence, setLocalConfidence] = useState<ConfidenceLevelEnum | undefined>(
    judgment?.humanConfidence
  );
  const [localNotes, setLocalNotes] = useState(judgment?.judgmentNotes || '');
  const [localOverrideReason, setLocalOverrideReason] = useState(
    judgment?.overrideReason || ''
  );
  const [isDirty, setIsDirty] = useState(false);

  // Derived state
  const allowedDecisions = useMemo(
    () => getAllowedDecisions(assessment.discretionTier),
    [assessment.discretionTier]
  );

  const isOverride =
    localDecision === HumanResult.OVERRIDE_PASS ||
    localDecision === HumanResult.OVERRIDE_FAIL;
  const needsOverrideReason = isOverride && !localOverrideReason.trim();

  const reviewStatus = useMemo(() => {
    if (judgment?.reviewStatus === ReviewStatus.COMPLETED) return 'reviewed';
    if (judgment?.reviewStatus === ReviewStatus.DEFERRED) return 'deferred';
    return 'pending';
  }, [judgment?.reviewStatus]);

  // Convert evidence items for EvidenceAccordion
  const evidenceItems: EvidenceItem[] = useMemo(
    () =>
      assessment.evidenceFound.map((item) => ({
        specId: item.specId,
        location: item.location,
        excerpt: item.excerpt,
        // Fallback to 'MEDIUM' if confidence is not a valid enum value
        confidence: confidenceLevelMap[item.confidence] || 'MEDIUM',
        matchReasons: item.matchReasons,
      })),
    [assessment.evidenceFound]
  );

  // Handlers
  const handleDecisionChange = useCallback((value: HumanResult) => {
    setLocalDecision(value);
    setIsDirty(true);
  }, []);

  const handleConfidenceChange = useCallback((value: ConfidenceLevelEnum) => {
    setLocalConfidence(value);
    setIsDirty(true);
  }, []);

  const handleNotesChange = useCallback((value: string) => {
    setLocalNotes(value);
    setIsDirty(true);
  }, []);

  const handleOverrideReasonChange = useCallback((value: string) => {
    setLocalOverrideReason(value);
    setIsDirty(true);
  }, []);

  const handleSave = useCallback(() => {
    if (!onJudgmentChange || !localDecision) return;

    if (isOverride && !localOverrideReason.trim()) {
      // Validation: require override reason
      return;
    }

    const update: UpdateJudgment = {
      humanResult: localDecision,
      humanConfidence: localConfidence,
      judgmentNotes: localNotes || undefined,
      overrideReason: isOverride ? localOverrideReason : undefined,
      reviewStatus:
        localDecision === HumanResult.DEFER
          ? ReviewStatus.DEFERRED
          : ReviewStatus.COMPLETED,
    };

    onJudgmentChange(update);
    setIsDirty(false);
  }, [
    onJudgmentChange,
    localDecision,
    localConfidence,
    localNotes,
    localOverrideReason,
    isOverride,
  ]);

  const handleClear = useCallback(() => {
    setLocalDecision(undefined);
    setLocalConfidence(undefined);
    setLocalNotes('');
    setLocalOverrideReason('');
    setIsDirty(false);
  }, []);

  const handleSkip = useCallback(() => {
    if (onSkip) {
      onSkip();
    }
  }, [onSkip]);

  // Render
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden print:shadow-none print:border-gray-300">
      {/* Card Header */}
      <div className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm font-semibold text-gray-900 dark:text-white">
              {assessment.csapId}
            </span>
            <StatusBadge
              status={assessmentResultToStatus[assessment.aiResult]}
              showIcon={true}
            />
            <TierBadge tier={discretionTierToTierType[assessment.discretionTier]} />
          </div>
          <ReviewStatusBadge status={reviewStatus} />
        </div>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {assessment.section} - Sheet: {assessment.sheet}, Item #{assessment.itemNumber}
        </p>
      </div>

      {/* Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-gray-200 dark:divide-gray-700">
        {/* Left Column: AI Assessment */}
        <div className="p-4 sm:p-6 space-y-6">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            AI Assessment
          </h3>

          {/* Question / CSAP Text */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Requirement
            </label>
            <p className="text-sm text-gray-900 dark:text-gray-100 leading-relaxed">
              {assessment.csapText}
            </p>
          </div>

          {/* Result, Tier, Confidence Row */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                AI Result
              </label>
              <StatusBadge
                status={assessmentResultToStatus[assessment.aiResult]}
                showIcon={true}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Discretion Tier
              </label>
              <TierBadge tier={discretionTierToTierType[assessment.discretionTier]} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                AI Confidence
              </label>
              <ConfidenceMeter
                confidence={confidenceLevelMap[assessment.aiConfidence] || 'MEDIUM'}
                showLabel={true}
              />
            </div>
          </div>

          {/* Evidence Coverage */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
              Evidence Coverage
            </label>
            <EvidenceCoverageBar coverage={assessment.evidenceCoverage} />
          </div>

          {/* Evidence Found */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
              Evidence Found
            </label>
            <EvidenceAccordion evidenceItems={evidenceItems} />
          </div>

          {/* Regulatory Authority */}
          {assessment.regulatoryAuthority && (
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Regulatory Authority
              </label>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {assessment.regulatoryAuthority}
              </p>
            </div>
          )}

          {/* Keywords Matched */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
              Keywords Matched
            </label>
            <KeywordTags keywords={assessment.keywordsMatched} />
          </div>

          {/* Reviewer Notes from AI */}
          {assessment.reviewerNotes && (
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                AI Review Notes
              </label>
              <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                {assessment.reviewerNotes}
              </p>
            </div>
          )}

          {/* Action Required */}
          {assessment.actionRequired && (
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Action Required
              </label>
              <p className="text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">
                {assessment.actionRequired}
              </p>
            </div>
          )}
        </div>

        {/* Right Column: Human Judgment */}
        <div className="p-4 sm:p-6 space-y-6 bg-gray-50/50 dark:bg-gray-800/50 print:bg-white">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Human Judgment
          </h3>

          {/* Tier Constraint Warning */}
          <TierConstraintBanner tier={assessment.discretionTier} />

          {/* Decision Radio Buttons */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-3">
              Decision
            </label>
            <div className="space-y-2">
              {DECISION_OPTIONS.map((option) => {
                const isAllowed = allowedDecisions.has(option.value);
                const tooltip = getDisabledTooltip(option.value, assessment.discretionTier);
                const isSelected = localDecision === option.value;

                return (
                  <label
                    key={option.value}
                    className={`flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                        : isAllowed
                          ? 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                          : 'border-gray-200 dark:border-gray-700 opacity-50 cursor-not-allowed'
                    } ${readOnly ? 'pointer-events-none' : ''}`}
                    title={tooltip || undefined}
                  >
                    <input
                      type="radio"
                      name="decision"
                      value={option.value}
                      checked={isSelected}
                      disabled={!isAllowed || readOnly}
                      onChange={() => handleDecisionChange(option.value)}
                      className="mt-0.5 h-4 w-4 text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 border-gray-300 dark:border-gray-600 disabled:opacity-50"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${
                          isAllowed
                            ? 'text-gray-900 dark:text-white'
                            : 'text-gray-500 dark:text-gray-400'
                        }`}>
                          {option.label}
                        </span>
                        {!isAllowed && tooltip && (
                          <div className="group relative">
                            <Info className="w-4 h-4 text-gray-400" />
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                              {tooltip}
                            </div>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {option.description}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Override Confidence (shown when overriding) */}
          {isOverride && (
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                Override Confidence
              </label>
              <select
                value={localConfidence || ''}
                onChange={(e) => handleConfidenceChange(e.target.value as ConfidenceLevelEnum)}
                disabled={readOnly}
                className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 disabled:opacity-50"
              >
                <option value="">Select confidence...</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>
          )}

          {/* Judgment Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
              Notes
            </label>
            <textarea
              value={localNotes}
              onChange={(e) => handleNotesChange(e.target.value)}
              disabled={readOnly}
              placeholder="Add notes about your review..."
              rows={3}
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 disabled:opacity-50 resize-none"
            />
          </div>

          {/* Override Reason (required for overrides) */}
          {isOverride && (
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                Override Reason <span className="text-red-500">*</span>
              </label>
            <textarea
              value={localOverrideReason}
              onChange={(e) => handleOverrideReasonChange(e.target.value)}
              disabled={readOnly}
              placeholder="Required: Explain why you are overriding the AI result..."
              rows={3}
                className={`w-full text-sm border rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 disabled:opacity-50 resize-none ${
                  needsOverrideReason
                    ? 'border-red-300 dark:border-red-600 focus-visible:ring-red-500'
                    : 'border-gray-300 dark:border-gray-600'
                }`}
              />
              {needsOverrideReason && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                  Override reason is required when overriding AI result
                </p>
              )}
            </div>
          )}

          {/* Action Buttons */}
          {!readOnly && (
            <div className="flex items-center gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={handleSave}
                disabled={!localDecision || needsOverrideReason}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Save className="w-4 h-4" />
                Save
              </button>
              <button
                onClick={handleSkip}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 transition-colors"
              >
                <SkipForward className="w-4 h-4" />
                Skip
              </button>
              <button
                onClick={handleClear}
                disabled={!isDirty && !localDecision}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Clear
              </button>
            </div>
          )}

          {/* Existing Judgment Display (in read-only or when saved) */}
          {judgment?.reviewedAt && (
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Reviewed by {judgment.reviewerName || 'Unknown'} on{' '}
                {new Date(judgment.reviewedAt).toLocaleDateString('en-CA', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
