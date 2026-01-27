'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Search, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import MatchingDetailPanel from './MatchingDetailPanel';
import ValidationForm, { type ValidationAssessment } from './ValidationForm';
import type { MatchingDetail, AssessmentResult } from '@/lib/regulatory-review/types';

interface AssessmentCardWithValidationProps {
  /** Assessment ID for fetching matching details */
  assessmentId: number;
  /** Engine result from the assessment */
  engineResult: AssessmentResult;
  /** Children - the actual AssessmentCard content */
  children: React.ReactNode;
  /** Callback when validation is saved */
  onValidationSaved?: () => void;
}

/**
 * Wrapper component that adds expandable matching detail and baseline validation
 * to an existing AssessmentCard.
 */
export default function AssessmentCardWithValidation({
  assessmentId,
  engineResult,
  children,
  onValidationSaved,
}: AssessmentCardWithValidationProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [matchingDetail, setMatchingDetail] = useState<MatchingDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch matching detail when expanded
  useEffect(() => {
    if (!isExpanded || matchingDetail) return;

    async function fetchDetail() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/regulatory-review/matching-detail?assessmentId=${assessmentId}`
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to fetch matching detail');
        }

        const data = await response.json();
        setMatchingDetail(data.matchingDetail);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    }

    fetchDetail();
  }, [isExpanded, assessmentId, matchingDetail]);

  // Handle validation save
  const handleSaveValidation = useCallback(
    async (validation: { assessment: ValidationAssessment; notes: string }) => {
      setIsSaving(true);

      try {
        const response = await fetch('/api/regulatory-review/matching-detail', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assessmentId,
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

        onValidationSaved?.();
      } catch (err) {
        console.error('Error saving validation:', err);
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [assessmentId, onValidationSaved]
  );

  return (
    <div className="relative">
      {/* Original AssessmentCard content */}
      {children}

      {/* Matching Detail Toggle Button */}
      <div className="border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors text-sm"
        >
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <Search className="w-4 h-4" />
            <span>Matching Details & Baseline Validation</span>
            {matchingDetail?.validation && (
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-200">
                Validated
              </span>
            )}
          </div>
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          )}
        </button>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
            </div>
          ) : error ? (
            <div className="p-4 text-sm text-red-600 dark:text-red-400">
              Error: {error}
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
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Baseline Validation
                </h4>
                <ValidationForm
                  engineResult={engineResult}
                  currentValidation={
                    matchingDetail.validation
                      ? {
                          assessment: matchingDetail.validation.assessment,
                          notes: matchingDetail.validation.notes,
                          timestamp: matchingDetail.validation.timestamp,
                        }
                      : undefined
                  }
                  onSave={handleSaveValidation}
                  isLoading={isSaving}
                />
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
