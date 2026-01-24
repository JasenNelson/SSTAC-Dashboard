'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  FileText,
  Scale,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  BookOpen,
} from 'lucide-react';
import MatchingDetailPanel from './MatchingDetailPanel';
import ValidationForm, { type ValidationAssessment } from './ValidationForm';
import type { MatchingDetail, AssessmentResult } from '@/lib/regulatory-review/types';

interface MatchingDetailPageProps {
  assessmentId: string;
  onBack: () => void;
  onValidationSaved?: () => void;
}

export default function MatchingDetailPage({
  assessmentId,
  onBack,
  onValidationSaved,
}: MatchingDetailPageProps) {
  const [detail, setDetail] = useState<MatchingDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showExpandedPanel, setShowExpandedPanel] = useState(true);

  // Fetch matching detail
  useEffect(() => {
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
        setDetail(data.matchingDetail);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    }

    fetchDetail();
  }, [assessmentId]);

  // Handle validation save
  const handleSaveValidation = useCallback(
    async (validation: { assessment: ValidationAssessment; notes: string }) => {
      setIsSaving(true);

      try {
        const response = await fetch('/api/regulatory-review/matching-detail', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assessmentId: parseInt(assessmentId, 10),
            validation,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to save validation');
        }

        const data = await response.json();

        // Update local state with new validation
        setDetail((prev) =>
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

  // Get tier badge color
  const getTierBadgeClass = (tier: string) => {
    switch (tier) {
      case 'TIER_1_BINARY':
        return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200';
      case 'TIER_2_PROFESSIONAL':
        return 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200';
      case 'TIER_3_STATUTORY':
        return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
    }
  };

  // Get result badge color and icon
  const getResultBadge = (result: AssessmentResult) => {
    switch (result) {
      case 'PASS':
        return {
          class: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200',
          icon: CheckCircle2,
        };
      case 'FAIL':
        return {
          class: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200',
          icon: AlertCircle,
        };
      case 'PARTIAL':
        return {
          class: 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200',
          icon: AlertTriangle,
        };
      case 'REQUIRES_JUDGMENT':
        return {
          class: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200',
          icon: Scale,
        };
      default:
        return {
          class: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200',
          icon: AlertCircle,
        };
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="p-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Assessments
        </button>
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
            <AlertCircle className="w-5 h-5" />
            <span>{error || 'Failed to load matching detail'}</span>
          </div>
        </div>
      </div>
    );
  }

  const resultBadge = getResultBadge(detail.engineDetermination.result);
  const ResultIcon = resultBadge.icon;

  return (
    <div className="space-y-6">
      {/* Header with back button */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Assessments
        </button>

        <div className="flex items-center gap-2">
          {detail.validation && (
            <span className="px-2 py-1 rounded text-xs font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-200">
              Validated
            </span>
          )}
        </div>
      </div>

      {/* Assessment Header Card */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-5 h-5 text-gray-500" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {detail.csapId}
                </h2>
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium ${getTierBadgeClass(
                    detail.policyContext.discretionTier
                  )}`}
                >
                  {detail.policyContext.discretionTier.replace(/_/g, ' ')}
                </span>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                {detail.policyContext.verbatimText}
              </p>
            </div>
          </div>
        </div>

        {/* Engine Determination Summary */}
        <div className="p-4 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">Engine Result:</span>
                <span
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${resultBadge.class}`}
                >
                  <ResultIcon className="w-3 h-3" />
                  {detail.engineDetermination.result}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">Confidence:</span>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {detail.engineDetermination.confidence}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">Coverage:</span>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {Math.round(detail.engineDetermination.evidenceCoverage)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Evidence Context */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            Evidence Found ({detail.evidenceContext.length})
          </h3>

          {detail.evidenceContext.length === 0 ? (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-sm text-gray-500 dark:text-gray-400 italic">
              No evidence excerpts available for this assessment.
            </div>
          ) : (
            <div className="space-y-3">
              {detail.evidenceContext.map((evidence, index) => (
                <div
                  key={index}
                  className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                >
                  <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      {evidence.sourceDocument}
                    </span>
                    {evidence.pageRange && (
                      <span className="text-xs text-gray-500">
                        Pages {evidence.pageRange[0]}-{evidence.pageRange[1]}
                      </span>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                      {evidence.excerpt}
                    </p>
                    {evidence.fullContext && (
                      <details className="mt-2">
                        <summary className="text-xs text-indigo-600 dark:text-indigo-400 cursor-pointer hover:underline">
                          Show full context
                        </summary>
                        <p className="mt-2 text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                          {evidence.fullContext}
                        </p>
                      </details>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column - Validation Form */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Scale className="w-4 h-4" />
            Human Validation
          </h3>

          <ValidationForm
            engineResult={detail.engineDetermination.result}
            currentValidation={
              detail.validation
                ? {
                    assessment: detail.validation.assessment,
                    notes: detail.validation.notes,
                    timestamp: detail.validation.timestamp,
                  }
                : undefined
            }
            onSave={handleSaveValidation}
            isLoading={isSaving}
          />

          {/* Guidance box */}
          <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4">
            <h4 className="text-sm font-medium text-indigo-900 dark:text-indigo-200 mb-2">
              Validation Guidance
            </h4>
            <ul className="text-xs text-indigo-700 dark:text-indigo-300 space-y-1">
              <li>
                <strong>True Positive:</strong> Engine correctly flagged a real deficiency
              </li>
              <li>
                <strong>False Positive:</strong> Engine flagged something that isn&apos;t a
                deficiency
              </li>
              <li>
                <strong>True Negative:</strong> Engine correctly passed a satisfied requirement
              </li>
              <li>
                <strong>False Negative:</strong> Engine missed a real deficiency
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Matching Detail Panel (expandable) */}
      <MatchingDetailPanel
        detail={detail}
        isExpanded={showExpandedPanel}
        onToggle={() => setShowExpandedPanel(!showExpandedPanel)}
      />
    </div>
  );
}
