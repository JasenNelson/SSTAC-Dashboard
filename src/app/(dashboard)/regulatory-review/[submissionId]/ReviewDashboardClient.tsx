'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Download, ChevronDown, ChevronRight, Filter, Search } from 'lucide-react';
import type { Submission, Assessment } from './page';
import {
  AssessmentTable,
  ExportPanel,
  AssessmentDetail,
  SearchPanel,
  type TierFilter,
  type SortField,
  type SortOrder,
  type JudgmentAssessment,
  type Judgment,
} from './components';
import type { LocalJudgment } from '@/lib/regulatory-review/memo-generator';

// ============================================================================
// Props
// ============================================================================

interface ReviewDashboardClientProps {
  submission: Submission;
  user: {
    id: string;
    email: string;
  };
}

// ============================================================================
// Type Adapters
// ============================================================================

// Transform page Assessment to JudgmentPanel Assessment format
function adaptAssessmentForJudgment(assessment: Assessment): JudgmentAssessment {
  // Map page status to AI result
  const statusToAiResult: Record<Assessment['status'], 'PASS' | 'FAIL' | 'REQUIRES_JUDGMENT' | 'PARTIAL'> = {
    pass: 'PASS',
    fail: 'FAIL',
    pending: 'REQUIRES_JUDGMENT',
    flagged: 'REQUIRES_JUDGMENT',
  };

  return {
    id: assessment.id,
    csapId: assessment.policyId,
    csapText: assessment.policyTitle + (assessment.notes ? `\n\n${assessment.notes}` : ''),
    section: assessment.section,
    sheet: assessment.section.split(' ')[0] || 'OTHER',
    tier: assessment.tier,
    aiResult: statusToAiResult[assessment.status],
    aiConfidence: assessment.aiConfidence || 'MEDIUM',
    evidenceCoverage: assessment.evidenceCoverage ?? (assessment.evidenceItems.length > 0 ? 0.8 : 0.2),
    // Use full structured evidence items from page data
    evidenceFound: assessment.evidenceItems.map((e) => ({
      specId: e.specId,
      specDescription: e.specDescription,
      evidenceType: e.evidenceType,
      location: e.location,
      pageReference: e.pageReference,
      excerpt: e.excerpt,
      confidence: e.confidence,
      matchReasons: e.matchReasons,
    })),
    reviewerNotes: assessment.notes,
    actionRequired: assessment.status === 'fail' || assessment.status === 'flagged'
      ? 'Review required'
      : undefined,
  };
}

// ============================================================================
// Section Name Normalization
// ============================================================================

// Normalize section names for consistent grouping and display
function normalizeSection(section: string | null | undefined): string {
  if (!section) return 'OTHER';

  let normalized = section.trim();

  // Fix known malformed sections
  const fixes: Record<string, string> = {
    'and Reporting': 'DOCUMENTATION AND REPORTING',
    'Third Parties/': 'THIRD PARTIES',
  };

  if (fixes[normalized]) {
    normalized = fixes[normalized];
  }

  // Normalize to uppercase for consistent grouping
  normalized = normalized.toUpperCase();

  // Remove trailing punctuation
  normalized = normalized.replace(/[\/,;:]+$/, '');

  return normalized || 'OTHER';
}

// ============================================================================
// Sheet Display Names (from CSAP Checklists)
// ============================================================================

// Map Excel sheet names to human-readable display names
// These sheets come from CSAP-NPG (STG1PSI, STG2PSIDSI, SLRA, REMPLAN) and CSAP-RAPG (RAPG)
const SHEET_DISPLAY_NAMES: Record<string, string> = {
  // CSAP-NPG Checklist Sheets (National Guidance Protocol)
  'STG1PSI': 'Stage 1 PSI - Preliminary Site Investigation',
  'STG2PSIDSI': 'Stage 2 PSI/DSI - Detailed Site Investigation',
  'SLRA': 'SLRA - Screening Level Risk Assessment',
  'REMPLAN': 'Remediation Plan',
  // CSAP-RAPG Checklist Sheets (Risk Assessment Procedure Guideline)
  'RAPG': 'RAPG - Risk Assessment Procedures',
  // Fallback
  'Other': 'Other',
};

// Get display name for a sheet
function getSheetDisplayName(sheet: string): string {
  return SHEET_DISPLAY_NAMES[sheet] || sheet;
}

// Sheet display order follows the contaminated sites investigation workflow:
// 1. STG1PSI - Initial site review (records, history, preliminary assessment)
// 2. STG2PSIDSI - Detailed investigation (sampling, testing, characterization)
// 3. SLRA - Screening level risk assessment (quick risk check)
// 4. RAPG - Detailed risk assessment (if SLRA indicates need)
// 5. REMPLAN - Remediation planning (how to clean up)
const SHEET_GROUP_ORDER = [
  'STG1PSI',
  'STG2PSIDSI',
  'SLRA',
  'RAPG',
  'REMPLAN',
  'Other',
];

// ============================================================================
// Main Component
// ============================================================================

export default function ReviewDashboardClient({
  submission,
  user,
}: ReviewDashboardClientProps) {
  // State management
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | null>(null);
  const [tierFilter, setTierFilter] = useState<TierFilter>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pass' | 'fail' | 'pending' | 'flagged'>('all');
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [selectedSheetGroup, setSelectedSheetGroup] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSheetGroups, setExpandedSheetGroups] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>('policyId');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [isLoading, setIsLoading] = useState(false);
  const [showExportPanel, setShowExportPanel] = useState(false);
  const [showSearchPanel, setShowSearchPanel] = useState(true);
  const [judgments, setJudgments] = useState<Map<string, Judgment>>(new Map());
  const [reviewerName, setReviewerName] = useState(user.email);
  const [isEditingReviewer, setIsEditingReviewer] = useState(false);

  // Group assessments by normalized section
  const _sectionGroups = useMemo(() => {
    const groups = new Map<string, Assessment[]>();
    submission.assessments.forEach((assessment) => {
      const section = normalizeSection(assessment.section);
      if (!groups.has(section)) {
        groups.set(section, []);
      }
      groups.get(section)!.push(assessment);
    });
    // Sort sections alphabetically
    return new Map([...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])));
  }, [submission.assessments]);

  // Two-level hierarchy: Sheet (Excel Tab) → Sections → Items
  // Sections are ordered by their first itemNumber to preserve source order
  const sheetGroupHierarchy = useMemo(() => {
    // First pass: collect assessments and track minimum itemNumber per section
    const hierarchy = new Map<string, Map<string, { items: Assessment[]; minItemNumber: number }>>();

    submission.assessments.forEach((assessment) => {
      const section = normalizeSection(assessment.section);
      const sheet = assessment.sheet || 'Other';

      if (!hierarchy.has(sheet)) {
        hierarchy.set(sheet, new Map());
      }

      const sectionsInSheet = hierarchy.get(sheet)!;
      if (!sectionsInSheet.has(section)) {
        sectionsInSheet.set(section, { items: [], minItemNumber: Infinity });
      }

      const sectionData = sectionsInSheet.get(section)!;
      sectionData.items.push(assessment);

      // Track the minimum itemNumber for source ordering
      if (assessment.itemNumber < sectionData.minItemNumber) {
        sectionData.minItemNumber = assessment.itemNumber;
      }
    });

    // Second pass: sort sheets by workflow order, sections by source order
    const sortedSheets = [...hierarchy.entries()].sort((a, b) => {
      const aIndex = SHEET_GROUP_ORDER.indexOf(a[0]);
      const bIndex = SHEET_GROUP_ORDER.indexOf(b[0]);
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return a[0].localeCompare(b[0]);
    });

    // Convert to final format with sections sorted by minItemNumber (source order)
    const result = new Map<string, Map<string, Assessment[]>>();
    for (const [sheet, sectionsMap] of sortedSheets) {
      const sortedSections = [...sectionsMap.entries()]
        .sort((a, b) => a[1].minItemNumber - b[1].minItemNumber)
        .map(([section, data]) => [section, data.items] as [string, Assessment[]]);

      result.set(sheet, new Map(sortedSections));
    }

    return result;
  }, [submission.assessments]);

  // Filter and sort assessments based on current filters
  const filteredAssessments = useMemo(() => {
    // First filter
    const filtered = submission.assessments.filter((assessment) => {
      const statusMatch = statusFilter === 'all' || assessment.status === statusFilter;
      const tierMatch = tierFilter === 'all' || assessment.tier === tierFilter;
      const normalizedSection = normalizeSection(assessment.section);
      const sectionMatch = selectedSection === null || normalizedSection === selectedSection;
      const sheetGroupMatch = selectedSheetGroup === null || (assessment.sheet || 'Other') === selectedSheetGroup;

      // Search filter - match against CSAP ID, policy text, section, and notes
      let searchMatch = true;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        searchMatch =
          assessment.policyId.toLowerCase().includes(query) ||
          assessment.policyTitle.toLowerCase().includes(query) ||
          (assessment.section || '').toLowerCase().includes(query) ||
          (assessment.notes || '').toLowerCase().includes(query);
      }

      return statusMatch && tierMatch && sectionMatch && sheetGroupMatch && searchMatch;
    });

    // Then sort
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'policyId':
          comparison = a.policyId.localeCompare(b.policyId);
          break;
        case 'section':
          comparison = (a.section || '').localeCompare(b.section || '');
          break;
        case 'status': {
          const statusOrder = { pass: 0, fail: 1, pending: 2, flagged: 3 };
          comparison = statusOrder[a.status] - statusOrder[b.status];
          break;
        }
        case 'tier': {
          const tierOrder = { TIER_1_BINARY: 0, TIER_2_PROFESSIONAL: 1, TIER_3_STATUTORY: 2 };
          comparison = (tierOrder[a.tier] ?? 99) - (tierOrder[b.tier] ?? 99);
          break;
        }
        case 'confidence': {
          const confOrder: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2, NONE: 3 };
          const aConf = a.aiConfidence || 'MEDIUM';
          const bConf = b.aiConfidence || 'MEDIUM';
          comparison = (confOrder[aConf] ?? 1) - (confOrder[bConf] ?? 1);
          break;
        }
        case 'evidence':
          comparison = (a.evidenceItems?.length || 0) - (b.evidenceItems?.length || 0);
          break;
        case 'reviewedAt':
          // Reviewed items first, then by date
          if (a.reviewedAt && b.reviewedAt) {
            comparison = new Date(a.reviewedAt).getTime() - new Date(b.reviewedAt).getTime();
          } else if (a.reviewedAt) {
            comparison = -1;
          } else if (b.reviewedAt) {
            comparison = 1;
          }
          break;
        default:
          comparison = 0;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [submission.assessments, statusFilter, tierFilter, selectedSection, selectedSheetGroup, searchQuery, sortField, sortOrder]);

  // Get selected assessment
  const selectedAssessment = useMemo(() => {
    return submission.assessments.find((a) => a.id === selectedAssessmentId) || null;
  }, [submission.assessments, selectedAssessmentId]);

  // Transform selected assessment for JudgmentPanel
  const selectedForJudgment = useMemo(() => {
    return selectedAssessment ? adaptAssessmentForJudgment(selectedAssessment) : null;
  }, [selectedAssessment]);

  // Calculate stats
  const stats = useMemo(() => {
    const total = submission.assessments.length;
    const pass = submission.assessments.filter((a) => a.status === 'pass').length;
    const fail = submission.assessments.filter((a) => a.status === 'fail').length;
    const pending = submission.assessments.filter((a) => a.status === 'pending').length;
    const flagged = submission.assessments.filter((a) => a.status === 'flagged').length;
    const reviewed = judgments.size;
    return { total, pass, fail, pending, flagged, reviewed };
  }, [submission.assessments, judgments]);

  // Handle sort change
  const handleSort = useCallback((field: SortField) => {
    if (field === sortField) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  }, [sortField, sortOrder]);

  // Handle judgment save
  const handleSaveJudgment = useCallback(async (judgment: Partial<Judgment>) => {
    if (!selectedAssessmentId) return;

    setIsLoading(true);
    try {
      const existingJudgment = judgments.get(selectedAssessmentId);
      const newJudgment: Judgment = {
        ...existingJudgment,
        ...judgment,
        reviewerId: user.id,
        reviewerName: user.email,
        reviewedAt: new Date().toISOString(),
        reviewStatus: 'COMPLETED',
      };

      setJudgments(prev => {
        const updated = new Map(prev);
        updated.set(selectedAssessmentId, newJudgment);
        return updated;
      });

      // Move to next unreviewed item
      const currentIndex = filteredAssessments.findIndex(a => a.id === selectedAssessmentId);
      const nextUnreviewed = filteredAssessments.slice(currentIndex + 1).find(
        a => !judgments.has(a.id) && a.id !== selectedAssessmentId
      );
      if (nextUnreviewed) {
        setSelectedAssessmentId(nextUnreviewed.id);
      }
    } catch (error) {
      console.error('Failed to save judgment:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedAssessmentId, judgments, filteredAssessments, user]);

  // Handle skip to next
  const handleSkip = useCallback(() => {
    const currentIndex = filteredAssessments.findIndex(a => a.id === selectedAssessmentId);
    const nextAssessment = filteredAssessments[currentIndex + 1];
    if (nextAssessment) {
      setSelectedAssessmentId(nextAssessment.id);
    }
  }, [filteredAssessments, selectedAssessmentId]);

  // Handle quick pass from table (TIER_1 only)
  const handleQuickPass = useCallback(async (assessmentId: string) => {
    const assessment = submission.assessments.find(a => a.id === assessmentId);
    if (!assessment || assessment.tier !== 'TIER_1_BINARY') return;

    const newJudgment: Judgment = {
      humanResult: 'ACCEPT',
      reviewerId: user.id,
      reviewerName: user.email,
      reviewedAt: new Date().toISOString(),
      reviewStatus: 'COMPLETED',
    };

    // Update local state
    setJudgments(prev => {
      const updated = new Map(prev);
      updated.set(assessmentId, newJudgment);
      return updated;
    });

    // Call API to persist
    try {
      const url = `/api/regulatory-review/assessments/${assessment.policyId}?submissionId=${submission.id}`;
      await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newJudgment),
      });
    } catch (error) {
      console.error('Failed to save quick pass:', error);
    }
  }, [submission.assessments, submission.id, user]);

  // Toggle sheet group expansion
  const toggleSheetGroup = useCallback((sheetGroup: string) => {
    setExpandedSheetGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sheetGroup)) {
        newSet.delete(sheetGroup);
      } else {
        newSet.add(sheetGroup);
      }
      return newSet;
    });
  }, []);

  // Toggle section expansion
  const toggleSection = useCallback((section: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  }, []);

  // Select sheet group and filter
  const handleSheetGroupClick = useCallback((sheetGroup: string) => {
    setSelectedSheetGroup(prev => prev === sheetGroup ? null : sheetGroup);
    // Clear section selection when selecting a sheet group
    if (selectedSection !== null) {
      setSelectedSection(null);
    }
  }, [selectedSection]);

  // Select section and filter
  const handleSectionClick = useCallback((section: string) => {
    setSelectedSection(prev => prev === section ? null : section);
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setTierFilter('all');
    setStatusFilter('all');
    setSelectedSection(null);
    setSelectedSheetGroup(null);
    setSearchQuery('');
  }, []);

  // Select assessment and show search panel
  const handleSelectAssessment = useCallback((id: string) => {
    setSelectedAssessmentId(id);
    setShowSearchPanel(true);
  }, []);

  // Get judgment for selected assessment
  const selectedJudgment = selectedAssessmentId ? judgments.get(selectedAssessmentId) : undefined;

  // Convert judgments to LocalJudgment format for ExportPanel
  const localJudgments = useMemo(() => {
    const map = new Map<string, LocalJudgment>();
    judgments.forEach((j, id) => {
      map.set(id, {
        humanResult: j.humanResult,
        humanConfidence: j.humanConfidence,
        judgmentNotes: j.judgmentNotes,
        overrideReason: j.overrideReason,
        reviewerName: j.reviewerName,
        reviewedAt: j.reviewedAt,
        reviewStatus: j.reviewStatus,
      });
    });
    return map;
  }, [judgments]);

  return (
    <div className="h-screen flex">
      {/* Left Panel: Filters + Section Navigation */}
      <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        {/* Filters Section */}
        <div className="p-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1">
              <Filter className="w-3 h-3" />
              Filters
            </span>
            {(tierFilter !== 'all' || statusFilter !== 'all' || selectedSection || selectedSheetGroup || searchQuery) && (
              <button
                onClick={clearFilters}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Clear
              </button>
            )}
          </div>
          <div className="space-y-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search CSAP items..."
                className="w-full text-xs border border-gray-300 dark:border-gray-600 rounded pl-7 pr-2 py-1.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              )}
            </div>
            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value as TierFilter)}
              className="w-full text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="all">All Tiers</option>
              <option value="TIER_1_BINARY">Tier 1 - Binary</option>
              <option value="TIER_2_PROFESSIONAL">Tier 2 - Professional</option>
              <option value="TIER_3_STATUTORY">Tier 3 - Statutory</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="w-full text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="all">All Status</option>
              <option value="pass">Pass</option>
              <option value="fail">Fail</option>
              <option value="pending">Pending</option>
              <option value="flagged">Flagged</option>
            </select>
          </div>
        </div>

        {/* Hierarchical Navigation: Sheet Groups → Sections → Items */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-2">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-2">
              Topics ({sheetGroupHierarchy.size})
            </span>
          </div>
          <nav className="space-y-0.5 px-2 pb-4">
            {Array.from(sheetGroupHierarchy.entries()).map(([sheet, sections]) => {
              const isSheetExpanded = expandedSheetGroups.has(sheet);
              const isSheetSelected = selectedSheetGroup === sheet;
              const displayName = getSheetDisplayName(sheet);

              // Calculate totals for this sheet
              const allItems = Array.from(sections.values()).flat();
              const sheetPassCount = allItems.filter(i => i.status === 'pass').length;
              const sheetFailCount = allItems.filter(i => i.status === 'fail').length;
              const sheetTotalCount = allItems.length;

              return (
                <div key={sheet} className="mb-1">
                  {/* Sheet Header (Excel Tab Level) */}
                  <div
                    onClick={() => handleSheetGroupClick(sheet)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSheetGroupClick(sheet)}
                    role="button"
                    tabIndex={0}
                    className={`w-full flex items-center justify-between px-2 py-2 text-xs rounded-md transition-colors cursor-pointer font-medium ${
                      isSheetSelected
                        ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300'
                        : 'bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSheetGroup(sheet);
                        }}
                        className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                        aria-label={isSheetExpanded ? 'Collapse group' : 'Expand group'}
                      >
                        {isSheetExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <span className="truncate" title={displayName}>{displayName}</span>
                    </div>
                    <div className="flex items-center gap-1 ml-1 shrink-0">
                      {sheetPassCount > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 rounded">{sheetPassCount}</span>
                      )}
                      {sheetFailCount > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 rounded">{sheetFailCount}</span>
                      )}
                      <span className="text-[10px] text-gray-500 dark:text-gray-400">{sheetTotalCount}</span>
                    </div>
                  </div>

                  {/* Sections within Sheet */}
                  {isSheetExpanded && (
                    <div className="ml-3 mt-1 space-y-0.5 border-l-2 border-gray-200 dark:border-gray-600 pl-2">
                      {Array.from(sections.entries()).map(([section, items]) => {
                        const isSectionExpanded = expandedSections.has(section);
                        const isSectionSelected = selectedSection === section;
                        const passCount = items.filter(i => i.status === 'pass').length;
                        const failCount = items.filter(i => i.status === 'fail').length;

                        return (
                          <div key={section}>
                            <div
                              onClick={() => handleSectionClick(section)}
                              onKeyDown={(e) => e.key === 'Enter' && handleSectionClick(section)}
                              role="button"
                              tabIndex={0}
                              className={`w-full flex items-center justify-between px-2 py-1.5 text-[11px] rounded transition-colors cursor-pointer ${
                                isSectionSelected
                                  ? 'bg-indigo-50 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400'
                                  : 'hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-600 dark:text-gray-400'
                              }`}
                            >
                              <div className="flex items-center gap-1 min-w-0">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleSection(section);
                                  }}
                                  className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                                  aria-label={isSectionExpanded ? 'Collapse section' : 'Expand section'}
                                >
                                  {isSectionExpanded ? (
                                    <ChevronDown className="w-3 h-3" />
                                  ) : (
                                    <ChevronRight className="w-3 h-3" />
                                  )}
                                </button>
                                <span className="truncate" title={section}>{section}</span>
                              </div>
                              <div className="flex items-center gap-1 ml-1 shrink-0">
                                {passCount > 0 && (
                                  <span className="text-[9px] px-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">{passCount}</span>
                                )}
                                {failCount > 0 && (
                                  <span className="text-[9px] px-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded">{failCount}</span>
                                )}
                                <span className="text-[9px] text-gray-400">{items.length}</span>
                              </div>
                            </div>

                            {/* Individual Items within Section */}
                            {isSectionExpanded && (
                              <div className="ml-4 mt-0.5 space-y-0.5">
                                {items.slice(0, 5).map((item) => (
                                  <button
                                    key={item.id}
                                    onClick={() => handleSelectAssessment(item.id)}
                                    className={`w-full text-left px-2 py-1 text-[10px] rounded truncate ${
                                      selectedAssessmentId === item.id
                                        ? 'bg-indigo-50 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 font-medium'
                                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                                    }`}
                                  >
                                    {item.policyId}
                                  </button>
                                ))}
                                {items.length > 5 && (
                                  <span className="block px-2 py-1 text-[10px] text-gray-400 italic">
                                    +{items.length - 5} more items
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Right Side: Header + Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header Bar */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2">
          <div className="flex items-center justify-between">
            {/* Left: Back + Title */}
            <div className="flex items-center gap-3">
              <Link
                href="/regulatory-review"
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {submission.type} for {submission.siteId}
              </div>
              <span className="text-gray-300 dark:text-gray-600">|</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Regulatory Review Dashboard
              </span>
            </div>

            {/* Center: Stats */}
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                {stats.pass}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                {stats.fail}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-yellow-400" />
                {stats.pending}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                {stats.reviewed}/{stats.total}
              </span>
            </div>

            {/* Right: Meta + Search + Export */}
            <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
              <span>Received: {new Date(submission.submittedAt).toLocaleDateString()}</span>
              <span className="flex items-center gap-1">
                Reviewer:
                {isEditingReviewer ? (
                  <input
                    type="text"
                    value={reviewerName}
                    onChange={(e) => setReviewerName(e.target.value)}
                    onBlur={() => setIsEditingReviewer(false)}
                    onKeyDown={(e) => e.key === 'Enter' && setIsEditingReviewer(false)}
                    autoFocus
                    className="px-1 py-0.5 border border-gray-300 dark:border-gray-600 rounded text-xs bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 w-32"
                  />
                ) : (
                  <button
                    onClick={() => setIsEditingReviewer(true)}
                    className="text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    {reviewerName}
                  </button>
                )}
              </span>
              <button
                onClick={() => setShowSearchPanel(!showSearchPanel)}
                className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                  showSearchPanel
                    ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300'
                    : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                <Search className="w-3 h-3" />
                Search
              </button>
              <button
                onClick={() => setShowExportPanel(true)}
                className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                <Download className="w-3 h-3" />
                Export
              </button>
            </div>
          </div>
        </div>

        {/* Content Area: Table/Detail + Search Panel */}
        <div className="flex-1 flex overflow-hidden">
          {/* Center: Assessment Table or Detail View */}
          <div className="flex-1 overflow-auto">
            {selectedForJudgment ? (
              <AssessmentDetail
                assessment={selectedForJudgment}
                judgment={selectedJudgment}
                onSave={handleSaveJudgment}
                onSkip={handleSkip}
                onBack={() => setSelectedAssessmentId(null)}
                isLoading={isLoading}
                submissionId={submission.id}
              />
            ) : (
              <AssessmentTable
                assessments={filteredAssessments}
                selectedId={selectedAssessmentId}
                onSelect={handleSelectAssessment}
                onQuickPass={handleQuickPass}
                sortField={sortField}
                sortOrder={sortOrder}
                onSort={handleSort}
                onClearFilters={clearFilters}
              />
            )}
          </div>

          {/* Right: Search Panel */}
          {showSearchPanel && (
            <SearchPanel
              submissionId={submission.id}
              csapId={selectedForJudgment?.csapId}
              onClose={() => setShowSearchPanel(false)}
            />
          )}
        </div>
      </div>

      {/* Export Panel Modal */}
      <ExportPanel
        submissionId={submission.id}
        siteId={submission.siteId}
        assessments={filteredAssessments}
        judgments={localJudgments}
        isOpen={showExportPanel}
        onClose={() => setShowExportPanel(false)}
      />
    </div>
  );
}
