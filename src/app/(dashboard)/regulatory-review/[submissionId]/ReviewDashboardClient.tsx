'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Download, ChevronDown, ChevronRight, Filter, Search, FileText } from 'lucide-react';
import type { Submission, Assessment } from './page';
import {
  AssessmentTable,
  ExecutiveSummaryView,
  ExportPanel,
  AssessmentDetail,
  MemoPreviewPanel,
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
    dbId: assessment.dbId,
    csapId: assessment.policyId,
    citationLabel: assessment.citationLabel,
    csapText: assessment.policyTitle + (assessment.notes ? `\n\n${assessment.notes}` : ''),
    section: assessment.section,
    sheet: assessment.sheet || 'Other',
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

function getSectionLabel(assessment: Assessment): string {
  const label = assessment.subtopicLabel || assessment.topicLabel;
  if (label && label.trim().length > 0) {
    return label.trim();
  }
  return normalizeSection(assessment.section);
}

function getPolicyLabel(assessment: Assessment): string {
  return assessment.citationLabel || assessment.policyId;
}

function slugifySection(section: string): string {
  return section
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function getStageParamFromId(stageId: string | null): string | null {
  if (!stageId) return null;
  switch (stageId) {
    case 'STAGE_1':
      return 'STG1';
    case 'STAGE_2':
      return 'STG2';
    case 'STAGE_3':
      return 'STG3';
    case 'STAGE_4':
      return 'STG4';
    case 'CROSS_CUTTING':
      return 'CROSS';
    default:
      return stageId;
  }
}

function getStageIdFromParam(stageParam: string | null): string | null {
  if (!stageParam) return null;
  const normalized = stageParam.toUpperCase();
  if (normalized === 'STG1' || normalized === 'STAGE_1') return 'STAGE_1';
  if (normalized === 'STG2' || normalized === 'STAGE_2') return 'STAGE_2';
  if (normalized === 'STG3' || normalized === 'STAGE_3') return 'STAGE_3';
  if (normalized === 'STG4' || normalized === 'STAGE_4') return 'STAGE_4';
  if (normalized === 'CROSS' || normalized === 'CROSS_CUTTING') return 'CROSS_CUTTING';
  return null;
}

// ============================================================================
// Stage Group Definitions (Pyramid Navigation)
// ============================================================================

interface StageGroup {
  id: string;
  label: string;
  stageIds?: string[];
  topicIds?: string[];
  sheets?: string[];
  chipClass: string;
}

const STAGE_GROUPS: StageGroup[] = [
  {
    id: 'STAGE_1',
    label: 'Stage 1: Preliminary Investigation (PSI)',
    stageIds: ['SITE_DISCOVERY', 'PSI'],
    topicIds: ['SITE_IDENTIFICATION', 'SITE_INVESTIGATION'],
    sheets: ['STG1PSI', 'PCOC'],
    chipClass: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200',
  },
  {
    id: 'STAGE_2',
    label: 'Stage 2: Detailed Investigation (PSI/DSI)',
    stageIds: ['DSI'],
    topicIds: ['SITE_INVESTIGATION'],
    sheets: ['STG2PSIDSI', 'VAPOUR', 'PFAS'],
    chipClass: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-200',
  },
  {
    id: 'STAGE_3',
    label: 'Stage 3: Risk Assessment (SLRA/RAPG)',
    topicIds: ['RISK_ASSESSMENT'],
    sheets: ['SLRA', 'RAPG'],
    chipClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200',
  },
  {
    id: 'STAGE_4',
    label: 'Stage 4: Remediation Planning',
    stageIds: ['REMEDIATION_PLAN', 'REMEDIATION'],
    topicIds: ['REMEDIATION'],
    sheets: ['REMPLAN'],
    chipClass: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-200',
  },
  {
    id: 'CROSS_CUTTING',
    label: 'Cross-Cutting: Standards & Guidance',
    topicIds: ['STANDARDS_AND_CRITERIA'],
    sheets: ['CSAP', 'PROFJ', 'UNKNOWN', 'Other'],
    chipClass: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  },
];

const STAGE_GROUP_ORDER = STAGE_GROUPS.map((group) => group.id);

const STAGE_GROUP_BY_ID = new Map(STAGE_GROUPS.map((group) => [group.id, group]));
const STAGE_GROUP_BY_STAGE_ID = new Map(
  STAGE_GROUPS.flatMap((group) => (group.stageIds ?? []).map((stageId) => [stageId, group]))
);
const STAGE_GROUP_BY_TOPIC_ID = new Map(
  STAGE_GROUPS.flatMap((group) => (group.topicIds ?? []).map((topicId) => [topicId, group]))
);
const STAGE_GROUP_BY_SHEET = new Map(
  STAGE_GROUPS.flatMap((group) => (group.sheets ?? []).map((sheet) => [sheet, group]))
);
const CROSS_CUTTING_GROUP = STAGE_GROUP_BY_ID.get('CROSS_CUTTING')!;
const STAGE_1_GROUP = STAGE_GROUP_BY_ID.get('STAGE_1')!;
const STAGE_2_GROUP = STAGE_GROUP_BY_ID.get('STAGE_2')!;

function getStageGroupForAssessment(assessment: Assessment): StageGroup {
  const sheet = assessment.sheet || 'Other';
  const section = normalizeSection(assessment.section);
  const stageId = assessment.stageId?.toUpperCase();
  const topicId = assessment.topicId?.toUpperCase();

  if (stageId) {
    const mapped = STAGE_GROUP_BY_STAGE_ID.get(stageId);
    if (mapped) {
      return mapped;
    }
  }

  if (topicId) {
    if (topicId === 'SITE_INVESTIGATION') {
      if (section.includes('STAGE 2') || section.includes('DSI')) {
        return STAGE_2_GROUP;
      }
      if (section.includes('STAGE 1') || section.includes('PSI')) {
        return STAGE_1_GROUP;
      }
    }
    const mapped = STAGE_GROUP_BY_TOPIC_ID.get(topicId);
    if (mapped) {
      return mapped;
    }
  }

  // TIER2_SIM_20260125: NPG mixes Stage 1 & Stage 2 sections in a single sheet.
  if (sheet === 'NPG') {
    if (section.includes('STAGE 2') || section.includes('DSI')) {
      return STAGE_2_GROUP;
    }
    if (section.includes('STAGE 1') || section.includes('PSI')) {
      return STAGE_1_GROUP;
    }
    return CROSS_CUTTING_GROUP;
  }

  return STAGE_GROUP_BY_SHEET.get(sheet) ?? CROSS_CUTTING_GROUP;
}

// ============================================================================
// Main Component
// ============================================================================

export default function ReviewDashboardClient({
  submission,
  user,
}: ReviewDashboardClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const skipNextPageResetRef = useRef(false);
  const hasHydratedRef = useRef(false);
  const lastQueryRef = useRef<string>('');

  // State management
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | null>(null);
  const [tierFilter, setTierFilter] = useState<TierFilter>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pass' | 'fail' | 'pending' | 'flagged'>('all');
  const [sufficiencyFilter, setSufficiencyFilter] = useState<'all' | 'SUFFICIENT' | 'INSUFFICIENT' | 'NEEDS_MORE_EVIDENCE' | 'UNREVIEWED'>('all');
  const [unresolvedOnly, setUnresolvedOnly] = useState(false);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [selectedStageGroup, setSelectedStageGroup] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedStageGroups, setExpandedStageGroups] = useState<Set<string>>(new Set());
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>('policyId');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [tablePage, setTablePage] = useState(1);
  const [tablePageSize, setTablePageSize] = useState(25);
  const [isLoading, setIsLoading] = useState(false);
  const [showExportPanel, setShowExportPanel] = useState(false);
  const [showSearchPanel, setShowSearchPanel] = useState(true);
  const [showMemoPanel, setShowMemoPanel] = useState(false);
  const [viewMode, setViewMode] = useState<'exec' | 'db'>('exec');
  const [exportMemoType, setExportMemoType] = useState<'interim' | 'final'>('interim');
  const [judgments, setJudgments] = useState<Map<string, Judgment>>(() => {
    const map = new Map<string, Judgment>();
    submission.judgments?.forEach((judgment) => {
      if (judgment.assessmentId !== undefined && judgment.assessmentId !== null) {
        map.set(`ASM-${judgment.assessmentId}`, {
          ...judgment,
          humanResult: judgment.humanResult as Judgment['humanResult'],
          humanConfidence: judgment.humanConfidence as Judgment['humanConfidence'],
          evidenceSufficiency: judgment.evidenceSufficiency as Judgment['evidenceSufficiency'],
          reviewStatus: judgment.reviewStatus as Judgment['reviewStatus'],
        });
      }
    });
    return map;
  });
  const [reviewerName, setReviewerName] = useState(user.email);
  const [isEditingReviewer, setIsEditingReviewer] = useState(false);

  // Group assessments by normalized section
  const _sectionGroups = useMemo(() => {
    const groups = new Map<string, Assessment[]>();
    submission.assessments.forEach((assessment) => {
      const sectionLabel = getSectionLabel(assessment);
      if (!groups.has(sectionLabel)) {
        groups.set(sectionLabel, []);
      }
      groups.get(sectionLabel)!.push(assessment);
    });
    // Sort sections alphabetically
    return new Map([...groups.entries()].sort((a, b) => a[0].localeCompare(b[0])));
  }, [submission.assessments]);

  // Two-level hierarchy: Stage Group -> Sections -> Items
  // Sections are ordered by their first itemNumber to preserve source order
  const stageGroupHierarchy = useMemo(() => {
    const hierarchy = new Map<string, {
      group: StageGroup;
      sections: Map<string, { items: Assessment[]; minItemNumber: number }>;
    }>();

    submission.assessments.forEach((assessment) => {
      const sectionLabel = getSectionLabel(assessment);
      const group = getStageGroupForAssessment(assessment);

      if (!hierarchy.has(group.id)) {
        hierarchy.set(group.id, { group, sections: new Map() });
      }

      const entry = hierarchy.get(group.id)!;
      if (!entry.sections.has(sectionLabel)) {
        entry.sections.set(sectionLabel, { items: [], minItemNumber: Infinity });
      }

      const sectionData = entry.sections.get(sectionLabel)!;
      sectionData.items.push(assessment);

      const itemNumber = assessment.itemNumber ?? Infinity;
      if (itemNumber < sectionData.minItemNumber) {
        sectionData.minItemNumber = itemNumber;
      }
    });

    const result = new Map<string, { group: StageGroup; sections: Map<string, Assessment[]> }>();

    for (const stageId of STAGE_GROUP_ORDER) {
      const entry = hierarchy.get(stageId);
      if (!entry) continue;

      const sortedSections = [...entry.sections.entries()]
        .sort((a, b) => a[1].minItemNumber - b[1].minItemNumber)
        .map(([section, data]) => [section, data.items] as [string, Assessment[]]);

      result.set(stageId, { group: entry.group, sections: new Map(sortedSections) });
    }

    for (const [stageId, entry] of hierarchy.entries()) {
      if (!result.has(stageId)) {
        const sortedSections = [...entry.sections.entries()]
          .sort((a, b) => a[1].minItemNumber - b[1].minItemNumber)
          .map(([section, data]) => [section, data.items] as [string, Assessment[]]);
        result.set(stageId, { group: entry.group, sections: new Map(sortedSections) });
      }
    }

    return result;
  }, [submission.assessments]);

  const sectionSlugMap = useMemo(() => {
    const map = new Map<string, string>();
    submission.assessments.forEach((assessment) => {
      const sectionLabel = getSectionLabel(assessment);
      if (!map.has(sectionLabel)) {
        map.set(sectionLabel, slugifySection(sectionLabel));
      }
    });
    return map;
  }, [submission.assessments]);

  const sectionSlugReverseMap = useMemo(() => {
    const map = new Map<string, string>();
    sectionSlugMap.forEach((slug, section) => {
      if (!map.has(slug)) {
        map.set(slug, section);
      }
    });
    return map;
  }, [sectionSlugMap]);

  useEffect(() => {
    const queryString = searchParams.toString();
    if (hasHydratedRef.current && lastQueryRef.current === queryString) {
      return;
    }
    lastQueryRef.current = queryString;

    const params = new URLSearchParams(searchParams);
    const hasParams = params.toString().length > 0;

    const getPref = (key: string) => {
      if (typeof window === 'undefined') return null;
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    };

    const viewParam = params.get('view') || getPref('rr_view');
    if (viewParam === 'exec' || viewParam === 'db') {
      setViewMode(viewParam);
    }

    const stageParam = params.get('stage');
    const stageId = getStageIdFromParam(stageParam);
    if (stageId && stageId !== selectedStageGroup) {
      setSelectedStageGroup(stageId);
    }

    const topicParam = params.get('topic');
    if (topicParam) {
      const normalizedTopic = topicParam.toLowerCase();
      const resolvedSection =
        sectionSlugReverseMap.get(normalizedTopic)
        || sectionSlugReverseMap.get(topicParam)
        || sectionSlugReverseMap.get(slugifySection(topicParam.toUpperCase()));
      if (resolvedSection && resolvedSection !== selectedSection) {
        setSelectedSection(resolvedSection);
        if (!stageId) {
          const match = submission.assessments.find(
            (assessment) => getSectionLabel(assessment) === resolvedSection
          );
          if (match) {
            setSelectedStageGroup(getStageGroupForAssessment(match).id);
          }
        }
      }
    }

    const reqIdParam = params.get('reqId');
    if (reqIdParam) {
      const match = submission.assessments.find((assessment) => assessment.policyId === reqIdParam);
      if (match && match.id !== selectedAssessmentId) {
        setSelectedAssessmentId(match.id);
        if (!stageId) {
          setSelectedStageGroup(getStageGroupForAssessment(match).id);
        }
      }
    }

    const tierParam = params.get('tier') || getPref('rr_tier');
    if (tierParam) {
      const normalizedTier = tierParam.toUpperCase();
      if (normalizedTier === 'ALL') {
        setTierFilter('all');
      } else {
      const tierValue =
        normalizedTier === 'TIER_1' ? 'TIER_1_BINARY'
          : normalizedTier === 'TIER_2' ? 'TIER_2_PROFESSIONAL'
            : normalizedTier === 'TIER_3' ? 'TIER_3_STATUTORY'
              : normalizedTier;
      if (tierValue === 'TIER_1_BINARY' || tierValue === 'TIER_2_PROFESSIONAL' || tierValue === 'TIER_3_STATUTORY') {
        setTierFilter(tierValue as TierFilter);
      }
      }
    }

    const statusParam = params.get('status') || getPref('rr_status');
    if (statusParam) {
      const normalizedStatus = statusParam.toLowerCase();
      if (normalizedStatus === 'all') {
        setStatusFilter('all');
      } else {
      const mappedStatus =
        normalizedStatus === 'requires_judgment' || normalizedStatus === 'not_found'
          ? 'pending'
          : normalizedStatus;
      if (['pass', 'fail', 'pending', 'flagged'].includes(mappedStatus)) {
        setStatusFilter(mappedStatus as typeof statusFilter);
      }
      }
    }

    const suffParam = params.get('suff') || getPref('rr_suff');
    if (suffParam) {
      const normalizedSuff = suffParam.toUpperCase().replace(/-/g, '_');
      if (normalizedSuff === 'ALL') {
        setSufficiencyFilter('all');
      } else {
      const mappedSuff =
        normalizedSuff === 'NEEDS_MORE' ? 'NEEDS_MORE_EVIDENCE' : normalizedSuff;
      if (['SUFFICIENT', 'INSUFFICIENT', 'NEEDS_MORE_EVIDENCE', 'UNREVIEWED'].includes(mappedSuff)) {
        setSufficiencyFilter(mappedSuff as typeof sufficiencyFilter);
      }
      }
    }

    const unresolvedParam = params.get('unresolved') || getPref('rr_unresolved');
    if (unresolvedParam === 'true' || unresolvedParam === 'false') {
      setUnresolvedOnly(unresolvedParam === 'true');
    }

    const sortParam = params.get('sort') || getPref('rr_sort');
    if (sortParam) {
      const [field, order] = sortParam.split('_');
      if (field && (order === 'asc' || order === 'desc')) {
        setSortField(field as SortField);
        setSortOrder(order as SortOrder);
      }
    }

    const pageParam = params.get('page');
    if (pageParam) {
      const parsed = Number.parseInt(pageParam, 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        setTablePage(parsed);
        skipNextPageResetRef.current = true;
      }
    }

    const pageSizeParam = params.get('pageSize');
    if (pageSizeParam) {
      const parsed = Number.parseInt(pageSizeParam, 10);
      if ([25, 50, 100].includes(parsed)) {
        setTablePageSize(parsed);
      }
    }

    if (!hasParams) {
      const prefPage = getPref('rr_page');
      if (prefPage) {
        const parsed = Number.parseInt(prefPage, 10);
        if (!Number.isNaN(parsed) && parsed > 0) {
          setTablePage(parsed);
        }
      }
      const prefPageSize = getPref('rr_pageSize');
      if (prefPageSize) {
        const parsed = Number.parseInt(prefPageSize, 10);
        if ([25, 50, 100].includes(parsed)) {
          setTablePageSize(parsed);
        }
      }
    }
    hasHydratedRef.current = true;
  }, [
    searchParams,
    sectionSlugReverseMap,
    submission.assessments,
    selectedAssessmentId,
    selectedSection,
    selectedStageGroup,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem('rr_view', viewMode);
      window.localStorage.setItem('rr_tier', tierFilter);
      window.localStorage.setItem('rr_status', statusFilter);
      window.localStorage.setItem('rr_suff', sufficiencyFilter);
      window.localStorage.setItem('rr_unresolved', unresolvedOnly ? 'true' : 'false');
      window.localStorage.setItem('rr_sort', `${sortField}_${sortOrder}`);
      window.localStorage.setItem('rr_page', `${tablePage}`);
      window.localStorage.setItem('rr_pageSize', `${tablePageSize}`);
    } catch {
      // ignore storage failures
    }
  }, [
    viewMode,
    tierFilter,
    statusFilter,
    sufficiencyFilter,
    unresolvedOnly,
    sortField,
    sortOrder,
    tablePage,
    tablePageSize,
  ]);

  useEffect(() => {
    if (skipNextPageResetRef.current) {
      skipNextPageResetRef.current = false;
      return;
    }
    setTablePage(1);
  }, [
    tierFilter,
    statusFilter,
    sufficiencyFilter,
    unresolvedOnly,
    selectedSection,
    selectedStageGroup,
    searchQuery,
    sortField,
    sortOrder,
    viewMode,
  ]);

  useEffect(() => {
    if (selectedStageGroup) {
      setExpandedStageGroups(prev => (
        prev.has(selectedStageGroup) ? prev : new Set(prev).add(selectedStageGroup)
      ));
    }
  }, [selectedStageGroup]);

  useEffect(() => {
    if (selectedSection) {
      setExpandedSections(prev => (
        prev.has(selectedSection) ? prev : new Set(prev).add(selectedSection)
      ));
    }
  }, [selectedSection]);

  useEffect(() => {
    if (!hasHydratedRef.current) {
      return;
    }
    const params = new URLSearchParams();
    params.set('view', viewMode);

    const stageParam = getStageParamFromId(selectedStageGroup);
    if (stageParam) params.set('stage', stageParam);

    if (selectedSection) {
      const slug = sectionSlugMap.get(selectedSection) || slugifySection(selectedSection);
      params.set('topic', slug);
    }

    if (selectedAssessmentId) {
      const assessment = submission.assessments.find((item) => item.id === selectedAssessmentId);
      if (assessment?.policyId) {
        params.set('reqId', assessment.policyId);
      }
    }

    params.set('tier', tierFilter);
    const suffParam = sufficiencyFilter === 'NEEDS_MORE_EVIDENCE'
      ? 'needs_more_evidence'
      : sufficiencyFilter.toLowerCase();
    params.set('suff', suffParam);
    params.set('status', statusFilter);
    params.set('unresolved', unresolvedOnly ? 'true' : 'false');
    params.set('sort', `${sortField}_${sortOrder}`);
    params.set('page', `${tablePage}`);
    params.set('pageSize', `${tablePageSize}`);

    const nextQuery = params.toString();
    const currentQuery = searchParams.toString();
    if (nextQuery !== currentQuery) {
      router.replace(`${pathname}?${nextQuery}`, { scroll: false });
    }
  }, [
    viewMode,
    selectedStageGroup,
    selectedSection,
    selectedAssessmentId,
    tierFilter,
    sufficiencyFilter,
    statusFilter,
    unresolvedOnly,
    sortField,
    sortOrder,
    tablePage,
    tablePageSize,
    searchParams,
    pathname,
    router,
    sectionSlugMap,
    submission.assessments,
  ]);

  // Filter and sort assessments based on current filters
  const filteredAssessments = useMemo(() => {
    // First filter
    const filtered = submission.assessments.filter((assessment) => {
      const statusMatch = statusFilter === 'all' || assessment.status === statusFilter;
      const tierMatch = tierFilter === 'all' || assessment.tier === tierFilter;
      const sectionLabel = getSectionLabel(assessment);
      const sectionMatch = selectedSection === null || sectionLabel === selectedSection;
      const stageGroup = getStageGroupForAssessment(assessment);
      const stageGroupMatch = selectedStageGroup === null || stageGroup.id === selectedStageGroup;
      const sufficiency = judgments.get(assessment.id)?.evidenceSufficiency || 'UNREVIEWED';
      const sufficiencyMatch = sufficiencyFilter === 'all' || sufficiency === sufficiencyFilter;
      const unresolvedMatch = !unresolvedOnly || sufficiency === 'UNREVIEWED';

      // Search filter - match against CSAP ID, policy text, section, and notes
      let searchMatch = true;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const policyLabel = getPolicyLabel(assessment).toLowerCase();
        searchMatch =
          assessment.policyId.toLowerCase().includes(query) ||
          policyLabel.includes(query) ||
          assessment.policyTitle.toLowerCase().includes(query) ||
          (assessment.section || '').toLowerCase().includes(query) ||
          (assessment.topicLabel || '').toLowerCase().includes(query) ||
          (assessment.notes || '').toLowerCase().includes(query);
      }

      return statusMatch && tierMatch && sectionMatch && stageGroupMatch && sufficiencyMatch && unresolvedMatch && searchMatch;
    });

    // Then sort
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'policyId':
          comparison = getPolicyLabel(a).localeCompare(getPolicyLabel(b));
          break;
        case 'section': {
          const aLabel = getSectionLabel(a);
          const bLabel = getSectionLabel(b);
          comparison = aLabel.localeCompare(bLabel);
          break;
        }
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
  }, [
    submission.assessments,
    statusFilter,
    tierFilter,
    selectedSection,
    selectedStageGroup,
    sufficiencyFilter,
    unresolvedOnly,
    searchQuery,
    sortField,
    sortOrder,
    judgments,
  ]);

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
    let sufficient = 0;
    let insufficient = 0;
    let needsMoreEvidence = 0;
    let unreviewed = 0;

    submission.assessments.forEach((assessment) => {
      const sufficiency = judgments.get(assessment.id)?.evidenceSufficiency || 'UNREVIEWED';
      switch (sufficiency) {
        case 'SUFFICIENT':
          sufficient++;
          break;
        case 'INSUFFICIENT':
          insufficient++;
          break;
        case 'NEEDS_MORE_EVIDENCE':
          needsMoreEvidence++;
          break;
        default:
          unreviewed++;
          break;
      }
    });

    const reviewed = total - unreviewed;
    return { total, sufficient, insufficient, needsMoreEvidence, unreviewed, reviewed };
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
      const resolvedSufficiency =
        judgment.evidenceSufficiency || existingJudgment?.evidenceSufficiency;
      const resolvedReviewStatus =
        judgment.reviewStatus
        || existingJudgment?.reviewStatus
        || (resolvedSufficiency && resolvedSufficiency !== 'UNREVIEWED' ? 'COMPLETED' : 'IN_PROGRESS');

      const newJudgment: Judgment = {
        ...existingJudgment,
        ...judgment,
        reviewerId: user.id,
        reviewerName: user.email,
        reviewedAt: new Date().toISOString(),
        reviewStatus: resolvedReviewStatus,
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
      evidenceSufficiency: 'SUFFICIENT',
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
      const url = typeof assessment.dbId === 'number'
        ? `/api/regulatory-review/assessments/${assessment.dbId}`
        : `/api/regulatory-review/assessments/${assessment.policyId}?submissionId=${submission.id}`;
      await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newJudgment),
      });
    } catch (error) {
      console.error('Failed to save quick pass:', error);
    }
  }, [submission.assessments, submission.id, user]);

  // Toggle stage group expansion
  const toggleStageGroup = useCallback((stageGroup: string) => {
    setExpandedStageGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(stageGroup)) {
        newSet.delete(stageGroup);
      } else {
        newSet.add(stageGroup);
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

  // Select stage group and filter
  const handleStageGroupClick = useCallback((stageGroup: string) => {
    setSelectedStageGroup(prev => prev === stageGroup ? null : stageGroup);
    // Clear section selection when selecting a stage group
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
    setSufficiencyFilter('all');
    setUnresolvedOnly(false);
    setSelectedSection(null);
    setSelectedStageGroup(null);
    setSearchQuery('');
  }, []);

  const toggleSearchPanel = useCallback(() => {
    setShowSearchPanel(prev => {
      const next = !prev;
      if (next) {
        setShowMemoPanel(false);
      }
      return next;
    });
  }, []);

  const toggleMemoPanel = useCallback(() => {
    setShowMemoPanel(prev => {
      const next = !prev;
      if (next) {
        setShowSearchPanel(false);
      }
      return next;
    });
  }, []);

  const handleGenerateInterimMemo = useCallback(() => {
    setExportMemoType('interim');
    setShowExportPanel(true);
  }, []);

  const handleGenerateFinalMemo = useCallback(() => {
    setExportMemoType('final');
    setShowExportPanel(true);
  }, []);

  const handleExecutiveUpdateJudgment = useCallback(async (
    assessment: Assessment,
    update: Partial<Judgment>
  ) => {
    setIsLoading(true);
    try {
      const existingJudgment = judgments.get(assessment.id);
      const resolvedSufficiency =
        update.evidenceSufficiency || existingJudgment?.evidenceSufficiency;
      const resolvedReviewStatus =
        update.reviewStatus
        || existingJudgment?.reviewStatus
        || (resolvedSufficiency && resolvedSufficiency !== 'UNREVIEWED' ? 'COMPLETED' : 'IN_PROGRESS');

      const payload: Partial<Judgment> = {
        ...existingJudgment,
        ...update,
        reviewerId: user.id,
        reviewerName: user.email,
        reviewedAt: new Date().toISOString(),
        reviewStatus: resolvedReviewStatus,
      };

      const url = typeof assessment.dbId === 'number'
        ? `/api/regulatory-review/assessments/${assessment.dbId}`
        : `/api/regulatory-review/assessments/${assessment.policyId}?submissionId=${submission.id}`;

      const response = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        console.error('Failed to save executive judgment:', data?.error || response.statusText);
        return;
      }

      setJudgments(prev => {
        const updated = new Map(prev);
        updated.set(assessment.id, payload as Judgment);
        return updated;
      });
    } catch (error) {
      console.error('Failed to save executive judgment:', error);
    } finally {
      setIsLoading(false);
    }
  }, [judgments, submission.id, user]);

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
        evidenceSufficiency: j.evidenceSufficiency,
        includeInFinal: j.includeInFinal,
        finalMemoSummary: j.finalMemoSummary,
        followUpNeeded: j.followUpNeeded,
        reviewerName: j.reviewerName,
        reviewedAt: j.reviewedAt,
        reviewStatus: j.reviewStatus,
      });
    });
    return map;
  }, [judgments]);

  const getSufficiencyCounts = useCallback((items: Assessment[]) => {
    let sufficient = 0;
    let insufficient = 0;
    let needsMoreEvidence = 0;
    let unreviewed = 0;

    items.forEach((item) => {
      const sufficiency = judgments.get(item.id)?.evidenceSufficiency || 'UNREVIEWED';
      switch (sufficiency) {
        case 'SUFFICIENT':
          sufficient++;
          break;
        case 'INSUFFICIENT':
          insufficient++;
          break;
        case 'NEEDS_MORE_EVIDENCE':
          needsMoreEvidence++;
          break;
        default:
          unreviewed++;
          break;
      }
    });

    const total = items.length;
    const reviewed = total - unreviewed;
    return { sufficient, insufficient, needsMoreEvidence, unreviewed, reviewed, total };
  }, [judgments]);

  const memoStats = useMemo(() => {
    let finalIncludedCount = 0;
    let finalSummaryCount = 0;
    let followUpCount = 0;

    judgments.forEach((judgment) => {
      if (judgment.includeInFinal) {
        finalIncludedCount += 1;
        if (judgment.finalMemoSummary && judgment.finalMemoSummary.trim().length > 0) {
          finalSummaryCount += 1;
        }
      }
      if (judgment.followUpNeeded) {
        followUpCount += 1;
      }
    });

    return { finalIncludedCount, finalSummaryCount, followUpCount };
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
            {(tierFilter !== 'all'
              || statusFilter !== 'all'
              || sufficiencyFilter !== 'all'
              || unresolvedOnly
              || selectedSection
              || selectedStageGroup
              || searchQuery) && (
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
              <label htmlFor="rr-search" className="sr-only">Search CSAP items</label>
              <input
                id="rr-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search CSAP items..."
                className="w-full text-xs border border-gray-300 dark:border-gray-600 rounded pl-7 pr-2 py-1.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                  aria-label="Clear search"
                >
                  x
                </button>
              )}
            </div>
            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value as TierFilter)}
              aria-label="Filter by tier"
              className="w-full text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            >
              <option value="all">All Tiers</option>
              <option value="TIER_1_BINARY">Tier 1 - Binary</option>
              <option value="TIER_2_PROFESSIONAL">Tier 2 - Professional</option>
              <option value="TIER_3_STATUTORY">Tier 3 - Statutory</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              aria-label="Filter by AI status"
              className="w-full text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            >
              <option value="all">All AI Status</option>
              <option value="pass">Pass</option>
              <option value="fail">Fail</option>
              <option value="pending">Requires Judgment</option>
              <option value="flagged">Partial</option>
            </select>
            <select
              value={sufficiencyFilter}
              onChange={(e) => setSufficiencyFilter(e.target.value as typeof sufficiencyFilter)}
              aria-label="Filter by evidence sufficiency"
              className="w-full text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
            >
              <option value="all">All Evidence Sufficiency</option>
              <option value="SUFFICIENT">Sufficient</option>
              <option value="NEEDS_MORE_EVIDENCE">Needs More Evidence</option>
              <option value="INSUFFICIENT">Insufficient</option>
              <option value="UNREVIEWED">Unreviewed</option>
            </select>
            <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={unresolvedOnly}
                  onChange={(e) => setUnresolvedOnly(e.target.checked)}
                  className="h-3 w-3 rounded border-gray-300 dark:border-gray-600 text-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                />
              Unresolved Only
            </label>
          </div>
        </div>

        {/* Hierarchical Navigation: Stage Groups -> Sections -> Items */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-2">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider px-2">
              Topics ({stageGroupHierarchy.size})
            </span>
          </div>
          <nav className="space-y-0.5 px-2 pb-4">
            {Array.from(stageGroupHierarchy.entries()).map(([stageId, entry]) => {
              const { group, sections } = entry;
              const isStageExpanded = expandedStageGroups.has(stageId);
              const isStageSelected = selectedStageGroup === stageId;
              const allItems = Array.from(sections.values()).flat();
              const counts = getSufficiencyCounts(allItems);
              const stagePrefix = group.label.split(':')[0];

              return (
                <div key={stageId} className="mb-1">
                  {/* Stage Header */}
                  <div
                    onClick={() => handleStageGroupClick(stageId)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleStageGroupClick(stageId);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    className={`w-full flex items-center justify-between px-2 py-2 text-xs rounded-md transition-colors cursor-pointer font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 group ${
                      isStageSelected
                        ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300'
                        : 'bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleStageGroup(stageId);
                        }}
                        className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                        aria-label={isStageExpanded ? 'Collapse group' : 'Expand group'}
                      >
                        {isStageExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${group.chipClass}`}>{stagePrefix}</span>
                      <span className="truncate group-focus-within:whitespace-normal" title={group.label}>{group.label}</span>
                    </div>
                    <div className="flex items-center gap-1 ml-1 shrink-0">
                      {counts.sufficient > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 rounded">{counts.sufficient}</span>
                      )}
                      {counts.needsMoreEvidence > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 rounded">{counts.needsMoreEvidence}</span>
                      )}
                      {counts.insufficient > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 rounded">{counts.insufficient}</span>
                      )}
                      <span className="text-[10px] text-gray-500 dark:text-gray-400">{counts.reviewed}/{counts.total}</span>
                    </div>
                  </div>

                  {/* Sections within Stage */}
                  {isStageExpanded && (
                    <div className="ml-3 mt-1 space-y-0.5 border-l-2 border-gray-200 dark:border-gray-600 pl-2">
                      {Array.from(sections.entries()).map(([section, items]) => {
                        const isSectionExpanded = expandedSections.has(section);
                        const isSectionSelected = selectedSection === section;
                        const sectionCounts = getSufficiencyCounts(items);

                        return (
                          <div key={section}>
                            <div
                              onClick={() => handleSectionClick(section)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  handleSectionClick(section);
                                }
                              }}
                              role="button"
                              tabIndex={0}
                              className={`w-full flex items-center justify-between px-2 py-1.5 text-[11px] rounded transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 group ${
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
                                  className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                                  aria-label={isSectionExpanded ? 'Collapse section' : 'Expand section'}
                                >
                                  {isSectionExpanded ? (
                                    <ChevronDown className="w-3 h-3" />
                                  ) : (
                                    <ChevronRight className="w-3 h-3" />
                                  )}
                                </button>
                                <span className="truncate group-focus-within:whitespace-normal" title={section}>{section}</span>
                              </div>
                              <div className="flex items-center gap-1 ml-1 shrink-0">
                                {sectionCounts.sufficient > 0 && (
                                  <span className="text-[9px] px-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">{sectionCounts.sufficient}</span>
                                )}
                                {sectionCounts.needsMoreEvidence > 0 && (
                                  <span className="text-[9px] px-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded">{sectionCounts.needsMoreEvidence}</span>
                                )}
                                {sectionCounts.insufficient > 0 && (
                                  <span className="text-[9px] px-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded">{sectionCounts.insufficient}</span>
                                )}
                                <span className="text-[9px] text-gray-400">{sectionCounts.reviewed}/{sectionCounts.total}</span>
                              </div>
                            </div>

                            {/* Individual Items within Section */}
                            {isSectionExpanded && (
                              <div className="ml-4 mt-0.5 space-y-0.5">
                                {items.slice(0, 5).map((item) => (
                                  <button
                                    key={item.id}
                                    onClick={() => handleSelectAssessment(item.id)}
                                    title={item.policyId}
                                    className={`w-full text-left px-2 py-1 text-[10px] rounded truncate focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:whitespace-normal ${
                                      selectedAssessmentId === item.id
                                        ? 'bg-indigo-50 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 font-medium'
                                        : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                                    }`}
                                  >
                                    {getPolicyLabel(item)}
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
                {stats.sufficient}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                {stats.needsMoreEvidence}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                {stats.insufficient}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-gray-400" />
                {stats.unreviewed}
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                {stats.reviewed}/{stats.total}
              </span>
            </div>

            {/* Right: Meta + View + Panels + Export */}
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
              <div className="flex items-center gap-1 rounded bg-gray-100 dark:bg-gray-700 p-0.5">
                <button
                  onClick={() => setViewMode('exec')}
                  className={`px-2 py-1 rounded text-[11px] font-medium ${
                    viewMode === 'exec'
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'text-gray-500 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
                  } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2`}
                  aria-pressed={viewMode === 'exec'}
                >
                  Executive
                </button>
                <button
                  onClick={() => setViewMode('db')}
                  className={`px-2 py-1 rounded text-[11px] font-medium ${
                    viewMode === 'db'
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 shadow-sm'
                      : 'text-gray-500 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100'
                  } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2`}
                  aria-pressed={viewMode === 'db'}
                >
                  Database
                </button>
              </div>
              <button
                onClick={toggleSearchPanel}
                className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                  showSearchPanel
                    ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300'
                    : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2`}
              >
                <Search className="w-3 h-3" />
                Search
              </button>
              <button
                onClick={toggleMemoPanel}
                className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                  showMemoPanel
                    ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300'
                    : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2`}
              >
                <FileText className="w-3 h-3" />
                Memo
              </button>
              <button
                onClick={() => setShowExportPanel(true)}
                className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
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
              viewMode === 'exec' ? (
                <ExecutiveSummaryView
                  assessments={filteredAssessments}
                  judgments={judgments}
                  selectedId={selectedAssessmentId}
                  onReviewEvidence={handleSelectAssessment}
                  onUpdateJudgment={handleExecutiveUpdateJudgment}
                />
              ) : (
                <AssessmentTable
                  assessments={filteredAssessments}
                  judgments={judgments}
                  selectedId={selectedAssessmentId}
                  onSelect={handleSelectAssessment}
                  onQuickPass={handleQuickPass}
                  sortField={sortField}
                  sortOrder={sortOrder}
                  onSort={handleSort}
                  onClearFilters={clearFilters}
                  currentPage={tablePage}
                  pageSize={tablePageSize}
                  onPageChange={setTablePage}
                  onPageSizeChange={setTablePageSize}
                />
              )
            )}
          </div>

          {/* Right: Search Panel */}
          {showSearchPanel && !showMemoPanel && (
            <SearchPanel
              submissionId={submission.id}
              csapId={selectedForJudgment?.csapId}
              onClose={() => setShowSearchPanel(false)}
            />
          )}
          {showMemoPanel && !showSearchPanel && (
            <MemoPreviewPanel
              stats={stats}
              finalSummaryCount={memoStats.finalSummaryCount}
              finalIncludedCount={memoStats.finalIncludedCount}
              followUpCount={memoStats.followUpCount}
              onGenerateInterim={handleGenerateInterimMemo}
              onGenerateFinal={handleGenerateFinalMemo}
              onClose={() => setShowMemoPanel(false)}
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
        initialMemoType={exportMemoType}
      />
    </div>
  );
}
