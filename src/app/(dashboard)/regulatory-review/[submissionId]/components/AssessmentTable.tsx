'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  Check,
  CheckSquare,
  Square,
  MinusSquare,
  FileText,
  ChevronDownIcon,
  ChevronRightIcon,
} from 'lucide-react';
import StatusBadge, { type StatusType } from '@/components/regulatory-review/StatusBadge';
import SufficiencyBadge, { type SufficiencyStatus } from '@/components/regulatory-review/SufficiencyBadge';
import TierBadge, { type TierType } from '@/components/regulatory-review/TierBadge';
import ConfidenceMeter, { type ConfidenceLevel } from '@/components/regulatory-review/ConfidenceMeter';
import type { Judgment } from './JudgmentPanel';

// Assessment type matching the page.tsx definition with additional fields
export interface Assessment {
  id: string;
  policyId: string;
  citationLabel?: string;
  policyTitle: string;
  section: string;
  tier: TierType;
  status: 'pass' | 'fail' | 'pending' | 'flagged';
  evidence: string[];
  notes: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  aiConfidence?: ConfidenceLevel;
}

// Map internal status to StatusBadge type
const statusMap: Record<Assessment['status'], StatusType> = {
  pass: 'PASS',
  fail: 'FAIL',
  pending: 'REQUIRES_JUDGMENT',
  flagged: 'PARTIAL',
};

export type SortField = 'policyId' | 'section' | 'status' | 'tier' | 'confidence' | 'evidence' | 'reviewedAt';
export type SortOrder = 'asc' | 'desc';

export interface AssessmentTableProps {
  assessments: Assessment[];
  judgments: Map<string, Judgment>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onQuickPass?: (id: string) => void;
  sortField: SortField;
  sortOrder: SortOrder;
  onSort: (field: SortField) => void;
  onClearFilters?: () => void;
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

// Page size options
const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

export default function AssessmentTable({
  assessments,
  judgments,
  selectedId,
  onSelect,
  onQuickPass,
  sortField,
  sortOrder,
  onSort,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: AssessmentTableProps) {
  // Selection state for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Expanded rows for evidence preview
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Calculate pagination
  const totalItems = assessments.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);

  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      onPageChange(totalPages);
    }
  }, [currentPage, totalPages, onPageChange]);
  const paginatedAssessments = assessments.slice(startIndex, endIndex);

  // Reset to page 1 when assessments change
  React.useEffect(() => {
    onPageChange(1);
  }, [assessments.length, onPageChange]);

  // Selection handlers
  const isAllSelected = paginatedAssessments.length > 0 &&
    paginatedAssessments.every(a => selectedIds.has(a.id));
  const isSomeSelected = paginatedAssessments.some(a => selectedIds.has(a.id)) && !isAllSelected;

  const handleSelectAll = useCallback(() => {
    if (isAllSelected) {
      // Deselect all visible
      const newSelected = new Set(selectedIds);
      paginatedAssessments.forEach(a => newSelected.delete(a.id));
      setSelectedIds(newSelected);
    } else {
      // Select all visible
      const newSelected = new Set(selectedIds);
      paginatedAssessments.forEach(a => newSelected.add(a.id));
      setSelectedIds(newSelected);
    }
  }, [isAllSelected, paginatedAssessments, selectedIds]);

  const handleSelectRow = useCallback((id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  }, [selectedIds]);

  const handleRowClick = useCallback((id: string) => {
    // Select the row (updates right panel) AND expand it
    onSelect(id);
    // Only one row can be expanded at a time - replace any existing expanded rows
    setExpandedRows(new Set([id]));
  }, [onSelect]);

  const handleRowKeyDown = useCallback((event: React.KeyboardEvent, id: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleRowClick(id);
    }
  }, [handleRowClick]);

  // Expand/collapse row
  const toggleRowExpand = useCallback((id: string, event: React.MouseEvent) => {
    event.stopPropagation();
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  }, [expandedRows]);

  // Bulk action handlers
  const tier1PassCount = useMemo(() => {
    return paginatedAssessments.filter(
      a => a.tier === 'TIER_1_BINARY' && a.status === 'pass' && !a.reviewedAt
    ).length;
  }, [paginatedAssessments]);

  const handleAcceptAllTier1Pass = useCallback(() => {
    // This would trigger an API call in production
    console.log('Accept all TIER_1 PASS assessments');
    // For now, just log - actual implementation would call backend
  }, []);

  const handleMarkSelectedReviewed = useCallback(() => {
    // This would trigger an API call in production
    console.log('Mark selected as reviewed:', Array.from(selectedIds));
    // For now, just log - actual implementation would call backend
    setSelectedIds(new Set());
  }, [selectedIds]);

  // Sort indicator component
  const SortIndicator = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ChevronsUpDown className="w-4 h-4 text-gray-400" />;
    }
    return sortOrder === 'asc' ? (
      <ChevronUp className="w-4 h-4 text-indigo-600" />
    ) : (
      <ChevronDown className="w-4 h-4 text-indigo-600" />
    );
  };

  // Sortable header component
  const SortableHeader = ({
    field,
    children,
    className = '',
  }: {
    field: SortField;
    children: React.ReactNode;
    className?: string;
  }) => (
    <th
      className={`px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 select-none sticky top-0 bg-gray-50 dark:bg-gray-800 z-10 ${className}`}
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        <SortIndicator field={field} />
      </div>
    </th>
  );

  // Empty state
  if (assessments.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
        <FileText className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
          No assessments found
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-md mb-4">
          No assessments match your current filters. Try adjusting your filter criteria or clearing all filters.
        </p>
        {/* Clear filters button would be passed as prop */}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Bulk Actions Toolbar */}
      <div className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          {/* Select All Checkbox */}
          <button
            onClick={handleSelectAll}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title={isAllSelected ? 'Deselect all' : 'Select all visible'}
          >
            {isAllSelected ? (
              <CheckSquare className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            ) : isSomeSelected ? (
              <MinusSquare className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            ) : (
              <Square className="w-5 h-5 text-gray-400 dark:text-gray-500" />
            )}
          </button>

          {/* Selection count */}
          {selectedIds.size > 0 && (
            <span className="text-sm text-gray-600 dark:text-gray-300">
              {selectedIds.size} selected
            </span>
          )}

          {/* Bulk action buttons */}
          <div className="flex items-center gap-2 ml-4">
            <button
              onClick={handleAcceptAllTier1Pass}
              disabled={tier1PassCount === 0}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200 hover:bg-green-200 dark:hover:bg-green-900/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Accept All TIER_1 PASS ({tier1PassCount})
            </button>
            <button
              onClick={handleMarkSelectedReviewed}
              disabled={selectedIds.size === 0}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-200 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Mark Selected as Reviewed
            </button>
          </div>
        </div>

        {/* Results count */}
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {totalItems} assessment{totalItems !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Table Container with sticky header and horizontal scroll */}
      <div className="flex-1 overflow-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              {/* Checkbox column */}
              <th className="w-12 px-4 py-3 sticky top-0 bg-gray-50 dark:bg-gray-800 z-10">
                <span className="sr-only">Select</span>
              </th>
              {/* Expand column */}
              <th className="w-10 px-2 py-3 sticky top-0 bg-gray-50 dark:bg-gray-800 z-10">
                <span className="sr-only">Expand</span>
              </th>
              <SortableHeader field="policyId">
                <span className="hidden sm:inline">Citation</span>
                <span className="sm:hidden">Citation</span>
              </SortableHeader>
              <SortableHeader field="section" className="hidden md:table-cell">
                Section
              </SortableHeader>
              <SortableHeader field="status">
                AI Status
              </SortableHeader>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider sticky top-0 bg-gray-50 dark:bg-gray-800 z-10">
                Reviewer Sufficiency
              </th>
              <SortableHeader field="tier">
                Tier
              </SortableHeader>
              <SortableHeader field="confidence" className="hidden lg:table-cell">
                Confidence
              </SortableHeader>
              <SortableHeader field="evidence" className="hidden lg:table-cell">
                Evidence
              </SortableHeader>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden xl:table-cell sticky top-0 bg-gray-50 dark:bg-gray-800 z-10">
                Notes
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider hidden xl:table-cell sticky top-0 bg-gray-50 dark:bg-gray-800 z-10">
                Final
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider sticky top-0 bg-gray-50 dark:bg-gray-800 z-10">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {paginatedAssessments.map((assessment, index) => {
              const isSelected = selectedId === assessment.id;
              const isChecked = selectedIds.has(assessment.id);
              const isExpanded = expandedRows.has(assessment.id);
              const isEven = index % 2 === 0;
              const judgment = judgments.get(assessment.id);
              const sufficiencyStatus = (judgment?.evidenceSufficiency || 'UNREVIEWED') as SufficiencyStatus;
              const hasNotes = Boolean(judgment?.judgmentNotes);
              const includeInFinal = Boolean(judgment?.includeInFinal);

              return (
                <React.Fragment key={assessment.id}>
                  <tr
                    onClick={() => handleRowClick(assessment.id)}
                    onKeyDown={(event) => handleRowKeyDown(event, assessment.id)}
                    role="button"
                    tabIndex={0}
                    className={`
                      cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2
                      ${isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-900/20 border-l-4 border-l-indigo-500'
                        : isEven
                          ? 'bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800'
                          : 'bg-gray-50/50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }
                    `}
                  >
                    {/* Checkbox */}
                    <td className="w-12 px-4 py-3">
                      <button
                        onClick={(e) => handleSelectRow(assessment.id, e)}
                        className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                        aria-label={isChecked ? 'Deselect row' : 'Select row'}
                        aria-pressed={isChecked}
                      >
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        ) : (
                          <Square className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                        )}
                      </button>
                    </td>

                    {/* Expand button */}
                    <td className="w-10 px-2 py-3">
                      <button
                        onClick={(e) => toggleRowExpand(assessment.id, e)}
                        className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                        title={isExpanded ? 'Collapse' : 'Expand evidence'}
                        aria-label={isExpanded ? 'Collapse evidence' : 'Expand evidence'}
                        aria-expanded={isExpanded}
                      >
                        {isExpanded ? (
                          <ChevronDownIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                        ) : (
                          <ChevronRightIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                        )}
                      </button>
                    </td>

                    {/* Citation / Internal ID */}
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap">
                      <div className="font-medium">
                        {assessment.citationLabel || assessment.policyId}
                      </div>
                      {assessment.citationLabel && assessment.citationLabel !== assessment.policyId && (
                        <div className="text-[11px] text-gray-500 dark:text-gray-400 font-mono">
                          ID: {assessment.policyId}
                        </div>
                      )}
                    </td>

                    {/* Section - truncated with focus reveal */}
                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 max-w-[200px] hidden md:table-cell">
                      <span
                        tabIndex={0}
                        title={assessment.section}
                        className="block truncate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:whitespace-normal focus-visible:break-words focus-visible:overflow-visible"
                      >
                        {assessment.section}
                      </span>
                    </td>

                    {/* AI Result */}
                    <td className="px-4 py-3">
                      <StatusBadge status={statusMap[assessment.status]} />
                    </td>

                    {/* Reviewer Sufficiency */}
                    <td className="px-4 py-3">
                      <SufficiencyBadge status={sufficiencyStatus} />
                    </td>

                    {/* Tier */}
                    <td className="px-4 py-3">
                      <TierBadge tier={assessment.tier} />
                    </td>

                    {/* Confidence */}
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <ConfidenceMeter
                        confidence={assessment.aiConfidence || 'MEDIUM'}
                        showLabel={false}
                      />
                    </td>

                    {/* Evidence count */}
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                        {assessment.evidence.length}
                      </span>
                    </td>

                    {/* Notes */}
                    <td className="px-4 py-3 hidden xl:table-cell">
                      {hasNotes ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-200">
                          Notes
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>

                    {/* Final */}
                    <td className="px-4 py-3 hidden xl:table-cell">
                      {includeInFinal ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
                          Included
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right">
                      {/* Quick PASS button - only for TIER_1 items */}
                      {assessment.tier === 'TIER_1_BINARY' && onQuickPass ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onQuickPass(assessment.id);
                          }}
                          disabled={assessment.reviewedAt !== null}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${
                            assessment.reviewedAt !== null
                              ? 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500 cursor-not-allowed'
                              : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-200 hover:bg-green-200 dark:hover:bg-green-900/50'
                          }`}
                          title={assessment.reviewedAt !== null ? 'Already reviewed' : 'Accept AI result as PASS'}
                          aria-disabled={assessment.reviewedAt !== null}
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">PASS</span>
                        </button>
                      ) : (
                        <span
                          className="inline-flex items-center px-2.5 py-1.5 text-xs text-gray-400 dark:text-gray-500"
                          title={`${assessment.tier === 'TIER_2_PROFESSIONAL' ? 'Requires professional judgment' : 'Requires SDM review'}`}
                        >
                          -
                        </span>
                      )}
                    </td>
                  </tr>

                  {/* Expanded evidence row */}
                  {isExpanded && (
                    <tr className="bg-gray-50 dark:bg-gray-800/70">
                      <td colSpan={12} className="px-8 py-4">
                        <div className="text-sm space-y-4">
                          {/* CSAP Question - Full text, never truncated */}
                          <div>
                            <div className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                              CSAP Question
                            </div>
                            <p className="text-base text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
                              {assessment.policyTitle}
                            </p>
                          </div>

                          {/* Evidence */}
                          <div>
                            <div className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Evidence ({assessment.evidence.length})
                            </div>
                            {assessment.evidence.length > 0 ? (
                              <ul className="space-y-2 text-gray-600 dark:text-gray-400">
                                {assessment.evidence.map((item, idx) => (
                                  <li key={idx} className="flex items-start gap-2">
                                    <span className="text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0">-</span>
                                    <span className="whitespace-pre-wrap">{item}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-gray-500 dark:text-gray-500 italic">No evidence recorded</p>
                            )}
                          </div>

                          {/* Notes */}
                          {assessment.notes && (
                            <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                              <div className="font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</div>
                              <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{assessment.notes}</p>
                            </div>
                          )}

                          {judgment?.evidenceSufficiency && (
                            <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                              <div className="font-medium text-gray-700 dark:text-gray-300 mb-1">Reviewer Evidence Sufficiency</div>
                              <SufficiencyBadge status={sufficiencyStatus} />
                            </div>
                          )}

                          {judgment?.judgmentNotes && (
                            <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                              <div className="font-medium text-gray-700 dark:text-gray-300 mb-1">Reviewer Notes</div>
                              <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{judgment.judgmentNotes}</p>
                            </div>
                          )}

                          {judgment?.finalMemoSummary && (
                            <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                              <div className="font-medium text-gray-700 dark:text-gray-300 mb-1">Final Memo Summary</div>
                              <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{judgment.finalMemoSummary}</p>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          {/* Page size selector */}
          <div className="flex items-center gap-2">
            <label htmlFor="page-size" className="text-sm text-gray-600 dark:text-gray-400">
              Show
            </label>
            <select
              id="page-size"
              value={pageSize}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value));
                onPageChange(1);
              }}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <span className="text-sm text-gray-600 dark:text-gray-400">per page</span>
          </div>
        </div>

        {/* Page info and navigation */}
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {startIndex + 1}-{endIndex} of {totalItems}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </button>
            <span className="px-3 text-sm text-gray-600 dark:text-gray-400">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
