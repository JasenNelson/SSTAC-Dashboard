'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Loader2, AlertTriangle, Search, ChevronDown, ChevronRight } from 'lucide-react';
import StatusBadge, { type StatusType } from '@/components/regulatory-review/StatusBadge';
import TierBadge, { type TierType } from '@/components/regulatory-review/TierBadge';
import { type ConfidenceLevel } from '@/components/regulatory-review/ConfidenceMeter';
import EvidenceAccordion, { type EvidenceItem } from '@/components/regulatory-review/EvidenceAccordion';
import SimpleToast from '@/components/SimpleToast';
import MatchingDetailPanel from '@/components/regulatory-review/MatchingDetailPanel';
import ValidationForm, { type ValidationAssessment } from '@/components/regulatory-review/ValidationForm';
import type { MatchingDetail, AssessmentResult } from '@/lib/regulatory-review/types';

// ============================================================================
// Types
// ============================================================================

export type HumanResult = 'ACCEPT' | 'OVERRIDE_PASS' | 'OVERRIDE_FAIL' | 'DEFER' | 'NOT_APPLICABLE';
export type ReviewStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'DEFERRED';

export interface Assessment {
  id: string;
  csapId: string;
  csapText: string;
  section: string;
  sheet?: string;
  itemNumber?: number;
  tier: TierType;
  aiResult: 'PASS' | 'FAIL' | 'REQUIRES_JUDGMENT' | 'PARTIAL';
  aiConfidence: ConfidenceLevel;
  evidenceCoverage: number;
  evidenceFound: EvidenceItem[];
  reviewerNotes?: string;
  actionRequired?: string;
  judgment?: Judgment;
}

export interface Judgment {
  id?: number;
  assessmentId?: number;
  humanResult?: HumanResult;
  humanConfidence?: ConfidenceLevel;
  judgmentNotes?: string;
  overrideReason?: string;
  routedTo?: string;
  routingReason?: string;
  reviewerId?: string;
  reviewerName?: string;
  reviewedAt?: string;
  reviewStatus?: ReviewStatus;
}

export interface AssessmentDetailProps {
  assessment: Assessment;
  judgment?: Judgment;
  onSave: (judgment: Partial<Judgment>) => void;
  onSkip: () => void;
  onBack: () => void;
  isLoading?: boolean;
  submissionId?: string;
}

// ============================================================================
// Constants
// ============================================================================

const DECISION_OPTIONS: {
  value: HumanResult;
  label: string;
  description: string;
  colorClass: string;
  bgClass: string;
}[] = [
  {
    value: 'ACCEPT',
    label: 'Accept AI Result',
    description: 'Confirm the AI assessment is correct',
    colorClass: 'text-green-700 dark:text-green-300',
    bgClass: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700',
  },
  {
    value: 'OVERRIDE_PASS',
    label: 'Override: PASS',
    description: 'Override AI result to PASS',
    colorClass: 'text-blue-700 dark:text-blue-300',
    bgClass: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700',
  },
  {
    value: 'OVERRIDE_FAIL',
    label: 'Override: FAIL',
    description: 'Override AI result to FAIL',
    colorClass: 'text-red-700 dark:text-red-300',
    bgClass: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700',
  },
  {
    value: 'DEFER',
    label: 'Defer to SDM',
    description: 'Route to Statutory Decision Maker',
    colorClass: 'text-purple-700 dark:text-purple-300',
    bgClass: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-700',
  },
];

const CONFIDENCE_OPTIONS: ConfidenceLevel[] = ['HIGH', 'MEDIUM', 'LOW'];

const MIN_OVERRIDE_REASON_LENGTH = 10;

// ============================================================================
// Tier Logic - Determines which options are available
// ============================================================================

interface TierConstraints {
  allowAccept: boolean;
  allowOverridePass: boolean;
  allowOverrideFail: boolean;
  allowDefer: boolean;
  tooltipMessage?: string;
}

function getTierConstraints(tier: TierType): TierConstraints {
  switch (tier) {
    case 'TIER_1_BINARY':
      return {
        allowAccept: true,
        allowOverridePass: true,
        allowOverrideFail: true,
        allowDefer: true,
      };

    case 'TIER_2_PROFESSIONAL':
      return {
        allowAccept: false,
        allowOverridePass: false,
        allowOverrideFail: true,
        allowDefer: true,
        tooltipMessage:
          'TIER_2 items require professional judgment. Cannot accept AI result or override to PASS.',
      };

    case 'TIER_3_STATUTORY':
      return {
        allowAccept: false,
        allowOverridePass: false,
        allowOverrideFail: false,
        allowDefer: true,
        tooltipMessage:
          'TIER_3 items require Statutory Decision Maker determination. Only DEFER is allowed.',
      };

    default:
      return {
        allowAccept: true,
        allowOverridePass: true,
        allowOverrideFail: true,
        allowDefer: true,
      };
  }
}

function isOptionAllowed(option: HumanResult, constraints: TierConstraints): boolean {
  switch (option) {
    case 'ACCEPT':
      return constraints.allowAccept;
    case 'OVERRIDE_PASS':
      return constraints.allowOverridePass;
    case 'OVERRIDE_FAIL':
      return constraints.allowOverrideFail;
    case 'DEFER':
      return constraints.allowDefer;
    default:
      return false;
  }
}

// ============================================================================
// Helper Components
// ============================================================================

function EvidenceCoverageBar({ coverage }: { coverage: number }) {
  const pct = Math.round(coverage * 100);
  const getColorClass = (p: number) => {
    if (p >= 80) return 'bg-green-500 dark:bg-green-400';
    if (p >= 50) return 'bg-yellow-500 dark:bg-yellow-400';
    return 'bg-red-500 dark:bg-red-400';
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
          Evidence Coverage
        </span>
        <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
          {pct}%
        </span>
      </div>
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${getColorClass(pct)}`}
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function AssessmentDetail({
  assessment,
  judgment,
  onSave,
  onSkip,
  onBack,
  isLoading = false,
  submissionId,
}: AssessmentDetailProps) {
  // Form state
  const [selectedDecision, setSelectedDecision] = useState<HumanResult | null>(
    judgment?.humanResult || null
  );
  const [confidence, setConfidence] = useState<ConfidenceLevel>(
    judgment?.humanConfidence || 'MEDIUM'
  );
  const [notes, setNotes] = useState(judgment?.judgmentNotes || '');
  const [overrideReason, setOverrideReason] = useState(judgment?.overrideReason || '');

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // HITL Baseline Validation state
  const [isBaselineExpanded, setIsBaselineExpanded] = useState(false);
  const [matchingDetail, setMatchingDetail] = useState<MatchingDetail | null>(null);
  const [isLoadingBaseline, setIsLoadingBaseline] = useState(false);
  const [baselineError, setBaselineError] = useState<string | null>(null);
  const [isSavingBaseline, setIsSavingBaseline] = useState(false);

  // Get tier constraints
  const tierConstraints = getTierConstraints(assessment.tier);

  // Map AI result to StatusBadge type
  const statusMap: Record<Assessment['aiResult'], StatusType> = {
    PASS: 'PASS',
    FAIL: 'FAIL',
    REQUIRES_JUDGMENT: 'REQUIRES_JUDGMENT',
    PARTIAL: 'PARTIAL',
  };

  // Reset form when assessment changes
  useEffect(() => {
    setSelectedDecision(judgment?.humanResult || null);
    setConfidence(judgment?.humanConfidence || 'MEDIUM');
    setNotes(judgment?.judgmentNotes || '');
    setOverrideReason(judgment?.overrideReason || '');
    setValidationErrors({});
    // Reset baseline validation state
    setIsBaselineExpanded(false);
    setMatchingDetail(null);
    setBaselineError(null);
  }, [assessment.id, judgment]);

  // Fetch matching detail when baseline section is expanded
  useEffect(() => {
    if (!isBaselineExpanded || matchingDetail) return;

    async function fetchMatchingDetail() {
      setIsLoadingBaseline(true);
      setBaselineError(null);

      try {
        const response = await fetch(
          `/api/regulatory-review/matching-detail?assessmentId=${assessment.id}`
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to fetch matching detail');
        }

        const data = await response.json();
        setMatchingDetail(data.matchingDetail);
      } catch (err) {
        setBaselineError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoadingBaseline(false);
      }
    }

    fetchMatchingDetail();
  }, [isBaselineExpanded, assessment.id, matchingDetail]);

  // Handle baseline validation save
  const handleSaveBaselineValidation = useCallback(
    async (validation: { assessment: ValidationAssessment; notes: string }) => {
      setIsSavingBaseline(true);

      try {
        const response = await fetch('/api/regulatory-review/matching-detail', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assessmentId: assessment.id,
            validation,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to save validation');
        }

        const data = await response.json();

        // Update local state with new validation
        setMatchingDetail((prev) =>
          prev
            ? {
                ...prev,
                validation: {
                  assessment: data.validation.assessment,
                  notes: data.validation.notes || '',
                  reviewerId: data.validation.reviewerId || '',
                  timestamp: data.validation.timestamp,
                },
              }
            : null
        );

        setToast({ message: 'Baseline validation saved', type: 'success' });
      } catch (err) {
        console.error('Error saving baseline validation:', err);
        setToast({
          message: err instanceof Error ? err.message : 'Failed to save validation',
          type: 'error',
        });
        throw err;
      } finally {
        setIsSavingBaseline(false);
      }
    },
    [assessment.id]
  );

  // Check if override reason is required
  const isOverrideSelected =
    selectedDecision === 'OVERRIDE_PASS' || selectedDecision === 'OVERRIDE_FAIL';

  // Validate form (only validates override reason if override is selected)
  const validate = useCallback((): boolean => {
    const errors: Record<string, string> = {};

    if (isOverrideSelected && overrideReason.length < MIN_OVERRIDE_REASON_LENGTH) {
      errors.overrideReason = `Override reason required (minimum ${MIN_OVERRIDE_REASON_LENGTH} characters)`;
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [isOverrideSelected, overrideReason]);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!validate()) return;

    setIsSaving(true);
    try {
      // Determine review status based on whether a decision was made
      let reviewStatus: ReviewStatus = 'IN_PROGRESS';
      if (selectedDecision) {
        reviewStatus = selectedDecision === 'DEFER' ? 'DEFERRED' : 'COMPLETED';
      }

      const judgmentPayload: Partial<Judgment> = {
        humanResult: selectedDecision || undefined,
        humanConfidence: isOverrideSelected ? confidence : undefined,
        judgmentNotes: notes || undefined,
        overrideReason: isOverrideSelected ? overrideReason : undefined,
        reviewStatus,
      };

      const url = submissionId
        ? `/api/regulatory-review/assessments/${assessment.csapId}?submissionId=${submissionId}`
        : `/api/regulatory-review/assessments/${assessment.id}`;

      const response = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(judgmentPayload),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.tierConstraint) {
          setToast({
            message: data.error || 'Tier constraint violation',
            type: 'error',
          });
        } else {
          throw new Error(data.error || 'Failed to save judgment');
        }
        return;
      }

      setToast({ message: 'Judgment saved successfully', type: 'success' });
      onSave(judgmentPayload);
    } catch (error) {
      console.error('Error saving judgment:', error);
      setToast({
        message: error instanceof Error ? error.message : 'Failed to save judgment',
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  }, [
    validate,
    selectedDecision,
    isOverrideSelected,
    confidence,
    notes,
    overrideReason,
    assessment.csapId,
    assessment.id,
    submissionId,
    onSave,
  ]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        if (e.key === 'Enter' && e.ctrlKey && e.target instanceof HTMLTextAreaElement) {
          e.preventDefault();
          handleSave();
        }
        return;
      }

      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          onBack();
          break;
        case 'Enter':
          e.preventDefault();
          handleSave();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave, onBack]);

  return (
    <>
      <div className="h-full flex flex-col bg-white dark:bg-gray-900">
        {/* Header */}
        <div className="flex-shrink-0 p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={onBack}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title="Back to list (Esc)"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {assessment.csapId}
            </h2>
            <TierBadge tier={assessment.tier} />
            {tierConstraints.tooltipMessage && (
              <div className="group relative">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <div className="absolute left-0 top-full mt-1 w-64 p-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                  {tierConstraints.tooltipMessage}
                </div>
              </div>
            )}
          </div>
          <p className="text-base text-gray-600 dark:text-gray-400 leading-relaxed">
            {assessment.csapText}
          </p>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-6">
            {/* AI Assessment Summary */}
            <section className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                AI Assessment
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Result</span>
                  <StatusBadge status={statusMap[assessment.aiResult]} />
                </div>
                <div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 block mb-1">Confidence</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {assessment.aiConfidence}
                  </span>
                </div>
                <div>
                  <EvidenceCoverageBar coverage={assessment.evidenceCoverage} />
                </div>
              </div>
            </section>

            {/* Evidence Found */}
            <section>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                Evidence Found
              </h3>
              <EvidenceAccordion evidenceItems={assessment.evidenceFound} />
            </section>

            {/* Judgment Form */}
            <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Your Judgment
              </h3>

              {/* Decision Radio Group */}
              <div className="grid grid-cols-2 gap-3">
                {DECISION_OPTIONS.map((option) => {
                  const isAllowed = isOptionAllowed(option.value, tierConstraints);
                  const isSelected = selectedDecision === option.value;

                  return (
                    <label
                      key={option.value}
                      className={`
                        relative flex items-start p-3 rounded-lg border-2 cursor-pointer transition-all
                        ${
                          isAllowed
                            ? isSelected
                              ? `${option.bgClass} border-current`
                              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                            : 'opacity-50 cursor-not-allowed bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                        }
                      `}
                      title={!isAllowed ? tierConstraints.tooltipMessage : undefined}
                    >
                      <input
                        type="radio"
                        name="decision"
                        value={option.value}
                        checked={isSelected}
                        onChange={() => isAllowed && setSelectedDecision(option.value)}
                        disabled={!isAllowed}
                        className="sr-only"
                      />
                      <div
                        className={`
                          flex-shrink-0 w-4 h-4 mt-0.5 rounded-full border-2 mr-3
                          ${
                            isSelected
                              ? 'border-current bg-current'
                              : 'border-gray-300 dark:border-gray-600'
                          }
                        `}
                      >
                        {isSelected && (
                          <div className="w-full h-full flex items-center justify-center">
                            <div className="w-1.5 h-1.5 rounded-full bg-white" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div
                          className={`text-sm font-medium ${
                            isSelected ? option.colorClass : 'text-gray-900 dark:text-gray-100'
                          }`}
                        >
                          {option.label}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {option.description}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
              {validationErrors.decision && (
                <p className="text-xs text-red-600 dark:text-red-400">
                  {validationErrors.decision}
                </p>
              )}

              {/* Confidence Select (shown when overriding) */}
              {isOverrideSelected && (
                <div>
                  <label
                    htmlFor="confidence"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Override Confidence
                  </label>
                  <select
                    id="confidence"
                    value={confidence}
                    onChange={(e) => setConfidence(e.target.value as ConfidenceLevel)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {CONFIDENCE_OPTIONS.map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Override Reason (required for overrides) */}
              {isOverrideSelected && (
                <div>
                  <label
                    htmlFor="overrideReason"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Override Reason <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    id="overrideReason"
                    value={overrideReason}
                    onChange={(e) => {
                      setOverrideReason(e.target.value);
                      if (validationErrors.overrideReason) {
                        setValidationErrors((prev) => {
                          const next = { ...prev };
                          delete next.overrideReason;
                          return next;
                        });
                      }
                    }}
                    rows={2}
                    placeholder="Explain why you are overriding the AI result..."
                    className={`w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none ${
                      validationErrors.overrideReason
                        ? 'border-red-300 dark:border-red-600'
                        : 'border-gray-300 dark:border-gray-600'
                    }`}
                  />
                  {validationErrors.overrideReason && (
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                      {validationErrors.overrideReason}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {overrideReason.length}/{MIN_OVERRIDE_REASON_LENGTH} min characters
                  </p>
                </div>
              )}

              {/* Notes */}
              <div>
                <label
                  htmlFor="notes"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                >
                  Notes <span className="text-gray-400">(optional)</span>
                </label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Add any additional notes or observations..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>
            </section>

            {/* HITL Baseline Validation Section */}
            <section className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <button
                onClick={() => setIsBaselineExpanded(!isBaselineExpanded)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  <Search className="w-4 h-4 text-gray-500" />
                  <span>Matching Details & Baseline Validation</span>
                  {matchingDetail?.validation && (
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-200">
                      Validated
                    </span>
                  )}
                </div>
                {isBaselineExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
              </button>

              {isBaselineExpanded && (
                <div className="border-t border-gray-200 dark:border-gray-700">
                  {isLoadingBaseline ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                      <span className="ml-2 text-sm text-gray-500">Loading matching details...</span>
                    </div>
                  ) : baselineError ? (
                    <div className="p-4 text-sm text-red-600 dark:text-red-400">
                      Error: {baselineError}
                    </div>
                  ) : matchingDetail ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-gray-200 dark:divide-gray-700">
                      {/* Left: Matching Detail Panel */}
                      <div className="p-4">
                        <MatchingDetailPanel
                          detail={matchingDetail}
                          isExpanded={true}
                          onToggle={() => {}}
                        />
                      </div>

                      {/* Right: Validation Form */}
                      <div className="p-4 bg-gray-50/50 dark:bg-gray-800/50">
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
                          Baseline Validation
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                          Was the engine&apos;s matching correct? This data establishes baseline accuracy metrics.
                        </p>
                        <ValidationForm
                          engineResult={assessment.aiResult as AssessmentResult}
                          currentValidation={
                            matchingDetail.validation
                              ? {
                                  assessment: matchingDetail.validation.assessment,
                                  notes: matchingDetail.validation.notes,
                                  timestamp: matchingDetail.validation.timestamp,
                                }
                              : undefined
                          }
                          onSave={handleSaveBaselineValidation}
                          isLoading={isSavingBaseline}
                        />

                        {/* Guidance box */}
                        <div className="mt-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-3">
                          <h5 className="text-xs font-medium text-indigo-900 dark:text-indigo-200 mb-2">
                            Validation Guide
                          </h5>
                          <ul className="text-xs text-indigo-700 dark:text-indigo-300 space-y-1">
                            <li><strong>True Positive:</strong> Engine correctly flagged a deficiency</li>
                            <li><strong>False Positive:</strong> Engine incorrectly flagged (no real issue)</li>
                            <li><strong>True Negative:</strong> Engine correctly passed (satisfied)</li>
                            <li><strong>False Negative:</strong> Engine missed a real deficiency</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </section>
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Press <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-xs">Enter</kbd> to save,{' '}
              <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-xs">Esc</kbd> to go back
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onSkip}
                disabled={isSaving || isLoading}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Skip
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || isLoading}
                className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {(isSaving || isLoading) && <Loader2 className="w-4 h-4 animate-spin" />}
                {selectedDecision ? 'Save Judgment' : 'Save Notes'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <SimpleToast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </>
  );
}
