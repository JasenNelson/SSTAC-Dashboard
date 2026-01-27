'use client';

import React, { useState, useMemo } from 'react';
import {
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  FileText,
  Download,
} from 'lucide-react';
import type { Assessment } from '../page';

// Filter types
export type StatusFilter = 'all' | 'pass' | 'fail' | 'pending' | 'flagged';
export type TierFilter = 'all' | 'TIER_1_BINARY' | 'TIER_2_PROFESSIONAL' | 'TIER_3_STATUTORY';

export interface ReviewSidebarFilters {
  status: StatusFilter;
  tier: TierFilter;
}

export interface ReviewSidebarProps {
  assessments: Assessment[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  filters: ReviewSidebarFilters;
  onFilterChange: (filters: ReviewSidebarFilters) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

// Map sections to CSAP sheet groups
function getSheetGroup(section: string): string {
  const sectionLower = section.toLowerCase();

  if (sectionLower.includes('rapg') || sectionLower.includes('risk assessment')) {
    return 'RAPG';
  }
  if (sectionLower.includes('stg1psi') || sectionLower.includes('stage 1') || sectionLower.includes('preliminary site')) {
    return 'STG1PSI';
  }
  if (sectionLower.includes('slra') || sectionLower.includes('screening level')) {
    return 'SLRA';
  }
  if (sectionLower.includes('dsi') || sectionLower.includes('detailed site')) {
    return 'DSI';
  }
  if (sectionLower.includes('protocol')) {
    // Extract protocol number if present
    const match = section.match(/protocol\s*(\d+)/i);
    return match ? `P${match[1]}` : 'Protocols';
  }
  if (sectionLower.includes('csr section') || sectionLower.includes('csr-')) {
    return 'CSR';
  }
  if (sectionLower.includes('technical guidance') || sectionLower.includes('tg')) {
    return 'TG';
  }
  if (sectionLower.includes('ema')) {
    return 'EMA';
  }

  return 'Other';
}

// Status indicator dot component
function StatusDot({ status }: { status: Assessment['status'] }) {
  const colors: Record<Assessment['status'], string> = {
    pass: 'bg-green-500',
    fail: 'bg-red-500',
    pending: 'bg-yellow-400',
    flagged: 'bg-orange-500',
  };

  return (
    <span className={`inline-block w-2 h-2 rounded-full ${colors[status]}`} />
  );
}

// Compact tier badge component
function TierBadgeCompact({ tier }: { tier: Assessment['tier'] }) {
  const config: Record<Assessment['tier'], { bg: string; text: string; label: string }> = {
    TIER_1_BINARY: { bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-300', label: 'T1' },
    TIER_2_PROFESSIONAL: { bg: 'bg-purple-100 dark:bg-purple-900/40', text: 'text-purple-700 dark:text-purple-300', label: 'T2' },
    TIER_3_STATUTORY: { bg: 'bg-red-100 dark:bg-red-900/40', text: 'text-red-700 dark:text-red-300', label: 'T3' },
  };

  const { bg, text, label } = config[tier];

  return (
    <span className={`inline-flex items-center justify-center w-6 h-5 rounded text-[10px] font-semibold ${bg} ${text}`}>
      {label}
    </span>
  );
}

// Collapsible sheet section component
interface SheetSectionProps {
  sheetName: string;
  assessments: Assessment[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  isExpanded: boolean;
  onToggle: () => void;
}

function SheetSection({
  sheetName,
  assessments,
  selectedId,
  onSelect,
  isExpanded,
  onToggle,
}: SheetSectionProps) {
  const statusCounts = useMemo(() => {
    return assessments.reduce(
      (acc, a) => {
        acc[a.status]++;
        return acc;
      },
      { pass: 0, fail: 0, pending: 0, flagged: 0 } as Record<Assessment['status'], number>
    );
  }, [assessments]);

  const pendingCount = statusCounts.pending + statusCounts.flagged;

  return (
    <div className="border-b border-gray-100 dark:border-gray-700 last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="h-4 w-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
            {sheetName}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            ({assessments.length})
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {pendingCount > 0 && (
            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
              {pendingCount} pending
            </span>
          )}
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          )}
        </div>
      </button>

      <div
        className={`overflow-hidden transition-all duration-200 ease-in-out ${
          isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="py-1 px-2 space-y-1">
          {assessments.map((assessment) => (
            <button
              key={assessment.id}
              onClick={() => onSelect(assessment.id)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors ${
                selectedId === assessment.id
                  ? 'bg-indigo-100 dark:bg-indigo-900/40 border border-indigo-300 dark:border-indigo-600'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 border border-transparent'
              }`}
            >
              <StatusDot status={assessment.status} />
              <span
                className={`flex-1 text-xs truncate ${
                  selectedId === assessment.id
                    ? 'text-indigo-900 dark:text-indigo-100 font-medium'
                    : 'text-gray-700 dark:text-gray-300'
                }`}
                title={assessment.policyId}
              >
                {assessment.policyId.length > 18
                  ? `${assessment.policyId.slice(0, 18)}...`
                  : assessment.policyId}
              </span>
              <TierBadgeCompact tier={assessment.tier} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ReviewSidebar({
  assessments,
  selectedId,
  onSelect,
  filters,
  onFilterChange,
  isCollapsed = false,
  onToggleCollapse,
}: ReviewSidebarProps) {
  // Track expanded sections
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['CSR', 'Protocols']));

  // Group assessments by CSAP sheet
  const groupedAssessments = useMemo(() => {
    const groups: Record<string, Assessment[]> = {};

    assessments.forEach((assessment) => {
      const sheet = getSheetGroup(assessment.section);
      if (!groups[sheet]) {
        groups[sheet] = [];
      }
      groups[sheet].push(assessment);
    });

    // Sort groups by name
    const sortedGroups = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
    return sortedGroups;
  }, [assessments]);

  // Calculate progress stats
  const progressStats = useMemo(() => {
    const reviewed = assessments.filter((a) => a.status === 'pass' || a.status === 'fail').length;
    return { reviewed, total: assessments.length };
  }, [assessments]);

  // Status filter counts
  const statusCounts = useMemo(() => {
    return assessments.reduce(
      (acc, a) => {
        acc[a.status]++;
        acc.all++;
        return acc;
      },
      { all: 0, pass: 0, fail: 0, pending: 0, flagged: 0 } as Record<StatusFilter, number>
    );
  }, [assessments]);

  const toggleSection = (sectionName: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionName)) {
        next.delete(sectionName);
      } else {
        next.add(sectionName);
      }
      return next;
    });
  };

  // Collapsed state - show "Filters" label
  if (isCollapsed) {
    return (
      <div className="w-10 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col items-center transition-all duration-200">
        <button
          onClick={onToggleCollapse}
          className="w-full h-full flex flex-col items-center justify-center gap-2 py-4 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Show filters"
        >
          <ChevronRight className="h-4 w-4" />
          <span className="text-xs font-medium writing-mode-vertical" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
            Filters
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="w-[280px] bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full transition-all duration-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Review Items</h3>
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="p-1 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              title="Collapse sidebar"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Quick Status Filters */}
        <div className="flex flex-wrap gap-1 mb-3">
          {(['all', 'pending', 'fail', 'flagged'] as StatusFilter[]).map((status) => {
            const isActive = filters.status === status;
            const count = statusCounts[status];

            return (
              <button
                key={status}
                onClick={() => onFilterChange({ ...filters, status })}
                className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                  isActive
                    ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
                {count > 0 && ` (${count})`}
              </button>
            );
          })}
        </div>

        {/* Tier Filter Dropdown */}
        <select
          value={filters.tier}
          onChange={(e) => onFilterChange({ ...filters, tier: e.target.value as TierFilter })}
          className="w-full text-xs border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 transition-colors"
        >
          <option value="all">All Tiers</option>
          <option value="TIER_1_BINARY">Tier 1 - Binary</option>
          <option value="TIER_2_PROFESSIONAL">Tier 2 - Professional</option>
          <option value="TIER_3_STATUTORY">Tier 3 - Statutory</option>
        </select>
      </div>

      {/* Assessment Groups (Scrollable) */}
      <div className="flex-1 overflow-y-auto">
        {groupedAssessments.length > 0 ? (
          groupedAssessments.map(([sheetName, sheetAssessments]) => (
            <SheetSection
              key={sheetName}
              sheetName={sheetName}
              assessments={sheetAssessments}
              selectedId={selectedId}
              onSelect={onSelect}
              isExpanded={expandedSections.has(sheetName)}
              onToggle={() => toggleSection(sheetName)}
            />
          ))
        ) : (
          <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
            No assessments match filters
          </div>
        )}
      </div>

      {/* Bottom Area - Progress Summary */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        {/* Progress Bar */}
        <div className="mb-3">
          <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
            <span>Progress</span>
            <span className="font-medium">
              {progressStats.reviewed} of {progressStats.total} reviewed
            </span>
          </div>
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 dark:bg-indigo-400 rounded-full transition-all duration-300"
              style={{
                width: progressStats.total > 0
                  ? `${(progressStats.reviewed / progressStats.total) * 100}%`
                  : '0%',
              }}
            />
          </div>
        </div>

        {/* Export Button */}
        <button
          type="button"
          disabled
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Export results (coming soon)"
        >
          <Download className="h-4 w-4" />
          Export Results
        </button>
      </div>
    </div>
  );
}
