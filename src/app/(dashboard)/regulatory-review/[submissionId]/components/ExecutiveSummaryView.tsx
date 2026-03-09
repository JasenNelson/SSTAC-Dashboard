import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { FileText, ArrowRight, ChevronLeft, ChevronRight, FileSearch } from 'lucide-react';
import StatusBadge, { type StatusType } from '@/components/regulatory-review/StatusBadge';
import SufficiencyBadge, { type SufficiencyStatus } from '@/components/regulatory-review/SufficiencyBadge';
import TierBadge, { type TierType } from '@/components/regulatory-review/TierBadge';
import type { Assessment, StructuredEvidenceItem } from '../page';
import type { Judgment } from './JudgmentPanel';

// ============================================================================
// Types
// ============================================================================

export interface ExecutiveSummaryViewProps {
  assessments: Assessment[];
  judgments: Map<string, Judgment>;
  selectedId: string | null;
  onReviewEvidence: (id: string) => void;
  onUpdateJudgment: (assessment: Assessment, update: Partial<Judgment>) => void;
}

type PageSize = 10 | 25 | 50;

// ============================================================================
// Helpers
// ============================================================================

const statusMap: Record<Assessment['status'], StatusType> = {
  pass: 'PASS',
  fail: 'FAIL',
  pending: 'REQUIRES_JUDGMENT',
  flagged: 'PARTIAL',
};

const PAGE_SIZE_OPTIONS: PageSize[] = [10, 25, 50];

function getSufficiency(judgment?: Judgment): SufficiencyStatus {
  return (judgment?.evidenceSufficiency as SufficiencyStatus) || 'UNREVIEWED';
}

function formatEvidenceLine(item: StructuredEvidenceItem): string {
  const page = item.pageReference ? `p. ${item.pageReference}` : 'p. ?';
  const location = item.location || 'Unknown source';
  const excerpt = item.excerpt || item.specDescription || 'No excerpt available';
  return `${location} (${page}) - ${excerpt}`;
}

// ============================================================================
// Component
// ============================================================================

function ExecutiveCard({
  assessment,
  judgment,
  selected,
  onReviewEvidence,
  onUpdateJudgment,
}: {
  assessment: Assessment;
  judgment?: Judgment;
  selected: boolean;
  onReviewEvidence: (id: string) => void;
  onUpdateJudgment: (assessment: Assessment, update: Partial<Judgment>) => void;
}) {
  const [summaryDraft, setSummaryDraft] = useState(judgment?.finalMemoSummary || '');
  const sufficiency = getSufficiency(judgment);
  const evidenceItems = assessment.evidenceItems.slice(0, 3);
  const includeInFinal = Boolean(judgment?.includeInFinal);
  const citationLabel = assessment.citationLabel || assessment.policyId;
  const showInternalId = assessment.citationLabel && assessment.citationLabel !== assessment.policyId;

  useEffect(() => {
    setSummaryDraft(judgment?.finalMemoSummary || '');
  }, [judgment?.finalMemoSummary]);

  const handleSummaryBlur = useCallback(() => {
    if ((judgment?.finalMemoSummary || '') !== summaryDraft) {
      onUpdateJudgment(assessment, { finalMemoSummary: summaryDraft });
    }
  }, [assessment, judgment?.finalMemoSummary, summaryDraft, onUpdateJudgment]);

  return (
    <div
      className={`border rounded-lg bg-white dark:bg-slate-800 shadow-sm transition ${
        selected
          ? 'border-sky-400 ring-1 ring-sky-200 dark:ring-sky-800'
          : 'border-slate-200 dark:border-slate-700'
      }`}
    >
      <div className="p-4 border-b border-slate-100 dark:border-slate-700">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{citationLabel}</span>
              {showInternalId && (
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                  ID: {assessment.policyId}
                </span>
              )}
              <TierBadge tier={assessment.tier as TierType} />
              <span className="text-[10px] uppercase tracking-wide text-slate-400">AI Proposed</span>
              <StatusBadge status={statusMap[assessment.status]} />
            </div>
            <h3 className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100 line-clamp-2">
              {assessment.policyTitle}
            </h3>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {assessment.section}
            </div>
          </div>
          <button
            onClick={() => onReviewEvidence(assessment.id)}
            className="inline-flex items-center gap-1 text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
          >
            Review Evidence
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Evidence Sufficiency
            </span>
            <SufficiencyBadge status={sufficiency} />
          </div>

          <select
            value={sufficiency}
            onChange={(e) => onUpdateJudgment(assessment, { evidenceSufficiency: e.target.value as SufficiencyStatus })}
            aria-label="Evidence sufficiency"
            className="w-full text-sm border border-slate-300 dark:border-slate-600 rounded px-3 py-2 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
          >
            <option value="UNREVIEWED">Unreviewed</option>
            <option value="SUFFICIENT">Sufficient</option>
            <option value="NEEDS_MORE_EVIDENCE">Needs More Evidence</option>
            <option value="INSUFFICIENT">Insufficient</option>
          </select>

          <div className="border rounded-md border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-900/40">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Evidence (Top 3)</span>
              <button
                onClick={() => onReviewEvidence(assessment.id)}
                className="text-xs text-sky-600 dark:text-sky-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
              >
                Open source
              </button>
            </div>
            {evidenceItems.length === 0 ? (
              <div className="text-xs text-slate-500 dark:text-slate-400">
                No evidence excerpts available.
              </div>
            ) : (
              <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                {evidenceItems.map((item, idx) => (
                  <li key={`${assessment.id}-evidence-${idx}`} className="flex gap-2">
                    <FileSearch className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span className="line-clamp-3">
                      {formatEvidenceLine(item)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Final Memo Curation
            </span>
            <label className="inline-flex items-center gap-2 text-xs text-slate-500 dark:text-slate-300">
              <input
                type="checkbox"
                checked={includeInFinal}
                onChange={(e) => onUpdateJudgment(assessment, { includeInFinal: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-sky-600 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
              />
              Include in Final
            </label>
          </div>

          <textarea
            value={summaryDraft}
            onChange={(e) => setSummaryDraft(e.target.value)}
            onBlur={handleSummaryBlur}
            placeholder="Final memo summary (1-3 short paragraphs)"
            className="w-full min-h-[120px] text-sm border border-slate-300 dark:border-slate-600 rounded px-3 py-2 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
          />

          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <FileText className="w-3.5 h-3.5" />
            Curated summaries appear in the FINAL memo export.
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ExecutiveSummaryView({
  assessments,
  judgments,
  selectedId,
  onReviewEvidence,
  onUpdateJudgment,
}: ExecutiveSummaryViewProps) {
  const [pageSize, setPageSize] = useState<PageSize>(25);
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(assessments.length / pageSize));

  useEffect(() => {
    setCurrentPage(1);
  }, [assessments.length, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const pagedAssessments = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return assessments.slice(start, start + pageSize);
  }, [assessments, currentPage, pageSize]);

  const handlePageChange = useCallback((next: number) => {
    setCurrentPage(Math.min(totalPages, Math.max(1, next)));
  }, [totalPages]);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Executive Summary View
          <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
            {assessments.length} items
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>Page size</span>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value) as PageSize)}
            aria-label="Page size"
            className="text-xs border border-slate-300 dark:border-slate-600 rounded px-2 py-1 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
          >
            {PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>
      </div>

      {pagedAssessments.length === 0 && (
        <div className="border border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-6 text-center text-sm text-slate-500 dark:text-slate-400">
          No assessments match the current filters.
        </div>
      )}

      <div className="space-y-4">
        {pagedAssessments.map((assessment) => (
          <ExecutiveCard
            key={assessment.id}
            assessment={assessment}
            judgment={judgments.get(assessment.id)}
            selected={selectedId === assessment.id}
            onReviewEvidence={onReviewEvidence}
            onUpdateJudgment={onUpdateJudgment}
          />
        ))}
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>Page {currentPage} of {totalPages}</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Prev
          </button>
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
          >
            Next
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
