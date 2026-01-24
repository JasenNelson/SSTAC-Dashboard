'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Loader2, AlertTriangle } from 'lucide-react';
import PolicySearch from './PolicySearch';
import SubmissionSearch from './SubmissionSearch';
import StatusBadge, { type StatusType } from '@/components/regulatory-review/StatusBadge';
import TierBadge, { type TierType } from '@/components/regulatory-review/TierBadge';
import { type ConfidenceLevel } from '@/components/regulatory-review/ConfidenceMeter';
import { type EvidenceItem } from '@/components/regulatory-review/EvidenceAccordion';
import SimpleToast from '@/components/SimpleToast';

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

export interface JudgmentPanelProps {
  assessment: Assessment;
  judgment?: Judgment;
  onSave: (judgment: Partial<Judgment>) => void;
  onSkip: () => void;
  onClose: () => void;
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
  {
    value: 'NOT_APPLICABLE',
    label: 'Not Applicable',
    description: 'This requirement does not apply to this submission',
    colorClass: 'text-gray-700 dark:text-gray-300',
    bgClass: 'bg-gray-50 dark:bg-gray-800/50 border-gray-300 dark:border-gray-600',
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
  allowNotApplicable: boolean;
  tooltipMessage?: string;
}

function getTierConstraints(tier: TierType): TierConstraints {
  switch (tier) {
    case 'TIER_1_BINARY':
      // Full authority - all options available
      return {
        allowAccept: true,
        allowOverridePass: true,
        allowOverrideFail: true,
        allowDefer: true,
        allowNotApplicable: true,
      };

    case 'TIER_2_PROFESSIONAL':
      // Cannot accept or override to pass - only flag deficiencies or defer
      return {
        allowAccept: false,
        allowOverridePass: false,
        allowOverrideFail: true,
        allowDefer: true,
        allowNotApplicable: true,
        tooltipMessage:
          'TIER_2 items require professional judgment. Cannot accept AI result or override to PASS - only flag deficiencies or defer.',
      };

    case 'TIER_3_STATUTORY':
      // Observation only - only defer is allowed
      return {
        allowAccept: false,
        allowOverridePass: false,
        allowOverrideFail: false,
        allowDefer: true,
        allowNotApplicable: true,
        tooltipMessage:
          'TIER_3 items require Statutory Decision Maker determination. Only DEFER is allowed.',
      };

    default:
      return {
        allowAccept: true,
        allowOverridePass: true,
        allowOverrideFail: true,
        allowDefer: true,
        allowNotApplicable: true,
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
    case 'NOT_APPLICABLE':
      return constraints.allowNotApplicable;
    default:
      return false;
  }
}

// ============================================================================
// Helper Components
// ============================================================================

function EvidenceCoverageBar({ coverage }: { coverage: number }) {
  const getColorClass = (pct: number) => {
    if (pct >= 80) return 'bg-green-500 dark:bg-green-400';
    if (pct >= 50) return 'bg-yellow-500 dark:bg-yellow-400';
    return 'bg-red-500 dark:bg-red-400';
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
          Evidence Coverage
        </span>
        <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
          {coverage}%
        </span>
      </div>
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${getColorClass(coverage)}`}
          style={{ width: `${Math.min(100, Math.max(0, coverage))}%` }}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function JudgmentPanel({
  assessment,
  judgment,
  onSave,
  onSkip,
  onClose,
  isLoading = false,
  submissionId,
}: JudgmentPanelProps) {
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

  // Refs for keyboard navigation
  const panelRef = useRef<HTMLDivElement>(null);

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
  }, [assessment.id, judgment]);

  // Check if override reason is required
  const isOverrideSelected =
    selectedDecision === 'OVERRIDE_PASS' || selectedDecision === 'OVERRIDE_FAIL';

  // Validate form
  const validate = useCallback((): boolean => {
    const errors: Record<string, string> = {};

    if (!selectedDecision) {
      errors.decision = 'Please select a decision';
    }

    if (isOverrideSelected && overrideReason.length < MIN_OVERRIDE_REASON_LENGTH) {
      errors.overrideReason = `Override reason required (minimum ${MIN_OVERRIDE_REASON_LENGTH} characters)`;
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [selectedDecision, isOverrideSelected, overrideReason]);

  // Handle save
  const handleSave = useCallback(async () => {
    if (!validate()) return;

    setIsSaving(true);
    try {
      // Determine review status
      let reviewStatus: ReviewStatus = 'COMPLETED';
      if (selectedDecision === 'DEFER') {
        reviewStatus = 'DEFERRED';
      } else if (selectedDecision === 'NOT_APPLICABLE') {
        reviewStatus = 'COMPLETED';  // N/A is a completed state
      }

      // Build judgment payload
      const judgmentPayload: Partial<Judgment> = {
        humanResult: selectedDecision!,
        humanConfidence: isOverrideSelected ? confidence : undefined,
        judgmentNotes: notes || undefined,
        overrideReason: isOverrideSelected ? overrideReason : undefined,
        reviewStatus,
      };

      // Call API
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
        // Handle tier constraint error specially
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

      // Success
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
      // Don't handle if typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        // Allow Enter in textarea with Ctrl
        if (e.key === 'Enter' && e.ctrlKey && e.target instanceof HTMLTextAreaElement) {
          e.preventDefault();
          handleSave();
        }
        return;
      }

      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
        case 'Enter':
          e.preventDefault();
          handleSave();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave, onClose]);

  return (
    <>
      <div
        ref={panelRef}
        className="w-[400px] bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 flex flex-col h-full"
      >
        {/* Header - Sticky */}
        <div className="flex-shrink-0 p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 pr-2">
              {assessment.csapId}
            </h3>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title="Close panel (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-2">
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
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Brief AI Summary - compact reference */}
          <section className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">AI Result:</span>
              <StatusBadge status={statusMap[assessment.aiResult]} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">Evidence:</span>
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                {assessment.evidenceFound.length} items
              </span>
            </div>
          </section>

          {/* Policy Database Search */}
          <PolicySearch csapId={assessment.csapId} />

          {/* Judgment Form */}
          <section className="space-y-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Your Judgment
            </h4>

            {/* Decision Radio Group */}
            <div className="space-y-2">
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
              {validationErrors.decision && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  {validationErrors.decision}
                </p>
              )}
            </div>

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
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400"
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
                  Override Reason{' '}
                  <span className="text-red-500">*</span>
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
                  rows={3}
                  placeholder="Explain why you are overriding the AI result..."
                  className={`w-full px-3 py-2 text-sm border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 resize-none ${
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

            {/* Notes (optional) */}
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
                rows={4}
                placeholder="Add any additional notes or observations..."
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 resize-none"
              />
            </div>
          </section>

          {/* Submission Content Search */}
          <SubmissionSearch submissionId={submissionId} />
        </div>

        {/* Footer - Sticky */}
        <div className="flex-shrink-0 p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onSkip}
              disabled={isSaving || isLoading}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Skip
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || isLoading || !selectedDecision}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {(isSaving || isLoading) && <Loader2 className="w-4 h-4 animate-spin" />}
              Save
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">
            Press <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">Enter</kbd> to save,{' '}
            <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">Esc</kbd> to close
          </p>
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
