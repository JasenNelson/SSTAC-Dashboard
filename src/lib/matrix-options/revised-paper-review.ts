import type {
  LensPlacement,
  PublicationLens,
  RevisedPaperQuestion,
  RevisedPaperStructure,
  StructureDomain,
} from './revised-paper-structure';

export const ATLAS_PAGE_SIZE = 40;
export const MAX_QUERY_SCALARS = 160;
export const MAX_QUERY_BYTES = 512;
export const REVIEW_LENSES: readonly PublicationLens[] = [
  'all',
  'core',
  'appendices',
  'evidence',
  'objects',
  'questions',
];

export type WorkspaceMode = 'my-review' | 'working-draft';
export type AssignmentState =
  | { readonly state: 'ASSIGNMENT_UNAVAILABLE'; readonly reasonCode: 'LIVE_ASSIGNMENT_SOURCE_NOT_AUTHORIZED' }
  | { readonly state: 'NO_ASSIGNMENT'; readonly reasonCode: 'AUTHORITATIVE_EMPTY' }
  | { readonly state: 'ASSIGNED'; readonly assignmentId: string; readonly title: string };

export type Disposition = 'FEEDBACK_SUBMITTED' | 'NO_FEEDBACK_CONFIRMED' | 'DEFERRED_WITH_REASON' | 'ESCALATED_WITH_REASON';
export type NonterminalCategory = 'UNASSIGNED' | 'NOT_STARTED' | 'UNAVAILABLE';

export const REVIEW_DISPOSITIONS: readonly Disposition[] = [
  'FEEDBACK_SUBMITTED',
  'NO_FEEDBACK_CONFIRMED',
  'DEFERRED_WITH_REASON',
  'ESCALATED_WITH_REASON',
];
export const REVIEW_NONTERMINAL_CATEGORIES: readonly NonterminalCategory[] = [
  'UNASSIGNED',
  'NOT_STARTED',
  'UNAVAILABLE',
];

export function parseWorkspaceMode(value: string | readonly string[] | undefined): WorkspaceMode {
  if (Array.isArray(value)) {
    if (value.length !== 1) throw new ReviewQueryError('REPEATED_PARAMETER');
    return parseWorkspaceMode(value[0]);
  }
  // Working Draft is the landing mode; `publication` is the legacy alias.
  if (value === undefined || value === 'working-draft' || value === 'publication') return 'working-draft';
  if (value === 'my-review') return 'my-review';
  throw new ReviewQueryError('INVALID_LENS');
}

export type TrustArtifact = 'EXACT_BYTES_VERIFIED' | 'UNAVAILABLE';
export type TrustProvenance = 'REPOSITORY_ARTIFACT' | 'SOURCE_LINK_IN_PAPER' | 'UNKNOWN' | 'UNAVAILABLE';
export type TrustHumanReview = 'RECORDED' | 'NONE_RECORDED' | 'PARTIAL' | 'MULTIPLE' | 'UNAVAILABLE';
export type TrustMapping = 'EXACT_SOURCE_RANGE' | 'EXPLICIT_INTERNAL_LINK' | 'STRUCTURAL_CONTAINER_ONLY' | 'UNMAPPED' | 'UNAVAILABLE';
export type TrustStaleness = 'CURRENT_EXACT_RELEASE' | 'CROSS_VERSION_NOT_EVALUATED' | 'STALE' | 'UNKNOWN' | 'UNAVAILABLE';

export interface TrustState {
  readonly artifactAuthentication: TrustArtifact;
  readonly provenance: TrustProvenance;
  readonly humanReview: TrustHumanReview;
  readonly humanReviewDate: string | null;
  readonly mappingConfidence: TrustMapping;
  readonly staleness: TrustStaleness;
}

export interface ReviewLedgerSummary {
  readonly dispositions: Readonly<Record<Disposition, number>>;
  readonly nonterminal: Readonly<Record<NonterminalCategory, number>>;
}

export interface AtlasQuery {
  readonly lens: PublicationLens;
  readonly q: string;
  readonly page: number;
}

export interface AtlasRow extends LensPlacement {
  readonly href: string;
}

export interface AtlasWindow {
  readonly query: AtlasQuery;
  readonly rows: readonly AtlasRow[];
  readonly totalMatches: number;
  readonly totalPages: number;
  readonly hasPrevious: boolean;
  readonly hasNext: boolean;
}

export interface RequestedDetail {
  readonly id: string;
  readonly domain: StructureDomain;
  readonly label: string;
  readonly startByte: number;
  readonly endByte: number;
  readonly ownerNodeId: string | null;
}

export interface QuestionPacketItem {
  readonly id: string;
  readonly label: string;
  readonly startByte: number;
  readonly endByte: number;
  readonly ownerNodeId: string;
  readonly supportNodeIds: readonly string[];
}

export interface ReaderContext {
  readonly selectedId: string | null;
  readonly selectedDomain: StructureDomain | null;
  readonly selectedLabel: string | null;
  readonly selectedStartByte: number | null;
  readonly selectedEndByte: number | null;
  readonly selectedOwnerNodeId: string | null;
  readonly ancestors: readonly string[];
  readonly neighborhood: readonly AtlasRow[];
}

export interface WorkspaceModel {
  readonly releaseIdentity: string;
  readonly documentVersion: string;
  readonly mode: WorkspaceMode;
  readonly assignment: AssignmentState;
  readonly atlas: AtlasWindow;
  readonly requestedDetail: RequestedDetail | null;
  readonly internalLinkMap: Readonly<Record<string, string>>;
  readonly readerContext: ReaderContext;
  readonly questionPacket: readonly QuestionPacketItem[];
  readonly trust: TrustState;
  readonly ledgers: ReviewLedgerSummary;
}

export class ReviewQueryError extends Error {
  readonly code: 'INVALID_LENS' | 'REPEATED_PARAMETER' | 'INVALID_PAGE' | 'PAGE_OUT_OF_RANGE' | 'QUERY_TOO_LONG';

  constructor(code: ReviewQueryError['code']) {
    super(`Invalid revised-paper review query: ${code}`);
    this.name = 'ReviewQueryError';
    this.code = code;
  }
}

const isLens = (value: string): value is PublicationLens => (
  value === 'all'
  || value === 'core'
  || value === 'appendices'
  || value === 'evidence'
  || value === 'objects'
  || value === 'questions'
);

function scalarParam(value: string | readonly string[] | undefined): string | undefined {
  if (value === undefined || typeof value === 'string') return value;
  if (value.length !== 1) throw new ReviewQueryError('REPEATED_PARAMETER');
  return value[0];
}

function normalizeSearch(value: string): string {
  return value.normalize('NFKC').toLowerCase();
}

export function parseAtlasQuery(
  input: Readonly<Record<string, string | readonly string[] | undefined>>,
): AtlasQuery {
  const lensValue = scalarParam(input.lens) ?? 'all';
  if (!isLens(lensValue)) throw new ReviewQueryError('INVALID_LENS');
  const q = (scalarParam(input.q) ?? '').trim();
  if (Array.from(q).length > MAX_QUERY_SCALARS || Buffer.byteLength(q, 'utf8') > MAX_QUERY_BYTES) {
    throw new ReviewQueryError('QUERY_TOO_LONG');
  }
  const pageValue = scalarParam(input.page) ?? '1';
  if (!/^[1-9][0-9]*$/.test(pageValue)) throw new ReviewQueryError('INVALID_PAGE');
  const page = Number(pageValue);
  if (!Number.isSafeInteger(page)) throw new ReviewQueryError('INVALID_PAGE');
  return { lens: lensValue, q, page };
}

export function parseDetailQuery(
  input: Readonly<Record<string, string | readonly string[] | undefined>>,
  defaultLens: PublicationLens,
): AtlasQuery {
  const parsed = parseAtlasQuery({
    ...input,
    lens: input.lens ?? defaultLens,
    q: input.q ?? '',
    page: input.page ?? '1',
  });
  return input.q === undefined && parsed.page > 1 ? { ...parsed, page: 1 } : parsed;
}

function placementMatches(placement: LensPlacement, normalizedQuery: string): boolean {
  if (!normalizedQuery) return true;
  return normalizeSearch(placement.label).includes(normalizedQuery);
}

function rowHref(documentVersion: string, placement: LensPlacement): string {
  const encodedVersion = encodeURIComponent(documentVersion);
  const encodedId = encodeURIComponent(placement.id);
  if (placement.domain === 'question') return `/matrix-options/paper/publication/v/${encodedVersion}/questions/${encodedId}`;
  if (placement.domain === 'node') return `/matrix-options/paper/publication/v/${encodedVersion}/nodes/${encodedId}`;
  return `/matrix-options/paper/publication/v/${encodedVersion}/nodes/${encodedId}`;
}

function queryHref(mode: WorkspaceMode, query: AtlasQuery): string {
  const params = new URLSearchParams({ mode, lens: query.lens, page: String(query.page) });
  if (query.q) params.set('q', query.q);
  return `?${params.toString()}`;
}

function createInternalLinkMap(
  structure: RevisedPaperStructure,
  query: AtlasQuery,
  mode: WorkspaceMode,
): Readonly<Record<string, string>> {
  const suffix = queryHref(mode, query);
  const linkMap = Object.fromEntries(
    structure.nodes
      .filter((node) => node.anchor)
      .map((node) => {
        const placement = structure.lenses.all.find((candidate) => candidate.id === node.id);
        if (!placement) throw new Error('Compiler node missing canonical placement');
        return [node.anchor, `${rowHref(structure.manifest.source.version, placement)}${suffix}`];
      }),
  );
  const explicitAnchorPattern = /<div id="((?:sec|app)-[^"\r\n]+)" class="section-anchor"><\/div>/g;
  for (const match of structure.content.matchAll(explicitAnchorPattern)) {
    const markerEnd = (match.index ?? 0) + match[0].length;
    const markerEndByte = new TextEncoder().encode(structure.content.slice(0, markerEnd)).length;
    const node = structure.nodes.find((candidate) => candidate.startByte >= markerEndByte);
    if (!node) continue;
    const placement = structure.lenses.all.find((candidate) => candidate.id === node.id);
    if (!placement) throw new Error('Compiler node missing canonical placement');
    linkMap[match[1]] = `${rowHref(structure.manifest.source.version, placement)}${suffix}`;
  }

  const sourceAnchorLabels = new Map<string, string>();
  const sourceLinkPattern = /\[([^\]\r\n]+)\]\(#((?:sec|app)-[A-Za-z0-9-]+)\)/g;
  for (const match of structure.content.matchAll(sourceLinkPattern)) {
    sourceAnchorLabels.set(match[2], match[1]);
  }
  const labelTerms = (label: string): string[] => label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter((term) => term.length > 2 && !/^\d+$/.test(term));
  const labelMatchScore = (sourceLabel: string, nodeLabel: string): number => {
    const normalizedNode = nodeLabel.toLowerCase();
    const sourceSection = sourceLabel.match(/\b\d+(?:\.\d+)+\b/)?.[0].replace(/\./g, '');
    const nodeSection = nodeLabel.match(/\b\d+(?:\.\d+)+\b/)?.[0].replace(/\./g, '');
    const sectionScore = sourceSection && sourceSection === nodeSection ? 100 : 0;
    return sectionScore + labelTerms(sourceLabel).filter((term) => normalizedNode.includes(term)).length;
  };

  // The verified source also contains a small set of hand-authored section
  // links whose IDs follow the paper's numeric heading convention (for
  // example, sec-7-1 for the heading "7.1 ...") but do not have a standalone
  // marker. Resolve those IDs against the compiler's canonical heading
  // anchors; never derive a destination from raw HTML.
  const sourceAnchorPattern = /#((?:sec|app)-[A-Za-z0-9-]+)/g;
  for (const match of structure.content.matchAll(sourceAnchorPattern)) {
    const anchor = match[1];
    if (linkMap[anchor]) continue;
    const headingSlug = anchor.replace(/^(?:sec|app)-/, '');
    const compactHeadingSlug = headingSlug.replace(/-/g, '');
    const prefixCandidates = structure.nodes.filter((node) => (
      node.anchor === headingSlug
      || node.anchor.replace(/-/g, '').startsWith(compactHeadingSlug)
    ));
    const sourceLabel = sourceAnchorLabels.get(anchor);
    const labelCandidates = sourceLabel
      ? structure.nodes
        .map((node) => ({ node, score: labelMatchScore(sourceLabel, node.label) }))
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score || a.node.startByte - b.node.startByte)
      : [];
    const semanticCandidates = labelCandidates.length > 0
      && labelCandidates[0].score > (labelCandidates[1]?.score ?? 0)
      ? [labelCandidates[0].node]
      : prefixCandidates;
    const aliasLabels: Readonly<Record<string, string>> = {
      'sec-7-5': '7.5.1 Scope',
      'sec-7-8': 'Policy-ready input categories - Phase 2 boundary',
    };
    const aliasCandidates = aliasLabels[anchor]
      ? structure.nodes.filter((node) => node.label === aliasLabels[anchor])
      : [];
    const aliasedCandidates = aliasCandidates.length > 0
      ? aliasCandidates
      : semanticCandidates;
    if (aliasedCandidates.length === 0) continue;
    const candidate = [...aliasedCandidates].sort((a, b) => a.anchor.length - b.anchor.length || a.startByte - b.startByte)[0];
    const placement = structure.lenses.all.find((candidatePlacement) => candidatePlacement.id === candidate.id);
    if (!placement) throw new Error('Compiler node missing canonical placement');
    linkMap[anchor] = `${rowHref(structure.manifest.source.version, placement)}${suffix}`;
  }
  return linkMap;
}

export function createAtlasWindow(
  structure: RevisedPaperStructure,
  query: AtlasQuery,
): AtlasWindow {
  const placements = structure.lenses[query.lens];
  const normalizedQuery = normalizeSearch(query.q);
  const matching = placements.filter((placement) => placementMatches(placement, normalizedQuery));
  const totalPages = Math.max(1, Math.ceil(matching.length / ATLAS_PAGE_SIZE));
  if (query.page > totalPages) throw new ReviewQueryError('PAGE_OUT_OF_RANGE');
  const start = (query.page - 1) * ATLAS_PAGE_SIZE;
  const rows = matching.slice(start, start + ATLAS_PAGE_SIZE).map((placement) => ({
    ...placement,
    href: rowHref(structure.manifest.source.version, placement),
  }));
  return {
    query,
    rows,
    totalMatches: matching.length,
    totalPages,
    hasPrevious: query.page > 1,
    hasNext: query.page < totalPages,
  };
}

export function getProductionAssignment(): AssignmentState {
  return {
    state: 'ASSIGNMENT_UNAVAILABLE',
    reasonCode: 'LIVE_ASSIGNMENT_SOURCE_NOT_AUTHORIZED',
  };
}

export function createNoAssignmentForTest(): AssignmentState {
  return { state: 'NO_ASSIGNMENT', reasonCode: 'AUTHORITATIVE_EMPTY' };
}

export function createAssignedForTest(assignmentId: string, title: string): AssignmentState {
  if (!assignmentId || !title) throw new Error('Assigned contract requires an identifier and title');
  return { state: 'ASSIGNED', assignmentId, title };
}

function emptyRecord<T extends string>(keys: readonly T[]): Record<T, number> {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<T, number>;
}

export function createLedgerSummary(
  assignment: AssignmentState,
  itemCount: number,
): ReviewLedgerSummary {
  const dispositions = emptyRecord(REVIEW_DISPOSITIONS);
  const nonterminal = emptyRecord(REVIEW_NONTERMINAL_CATEGORIES);
  if (assignment.state === 'ASSIGNMENT_UNAVAILABLE') nonterminal.UNAVAILABLE = itemCount;
  else if (assignment.state === 'NO_ASSIGNMENT') nonterminal.UNASSIGNED = itemCount;
  else nonterminal.NOT_STARTED = itemCount;
  return { dispositions, nonterminal };
}

export function createTrustState(): TrustState {
  return {
    artifactAuthentication: 'EXACT_BYTES_VERIFIED',
    provenance: 'REPOSITORY_ARTIFACT',
    humanReview: 'NONE_RECORDED',
    humanReviewDate: null,
    mappingConfidence: 'EXACT_SOURCE_RANGE',
    staleness: 'CURRENT_EXACT_RELEASE',
  };
}

export function createQuestionPacket(structure: RevisedPaperStructure): readonly QuestionPacketItem[] {
  return structure.questions.map((question: RevisedPaperQuestion) => ({
    id: question.id,
    label: question.label,
    startByte: question.startByte,
    endByte: question.endByte,
    ownerNodeId: question.ownerNodeId,
    supportNodeIds: question.supportNodeIds,
  }));
}

function detailFromPlacement(structure: RevisedPaperStructure, placement: LensPlacement): RequestedDetail {
  if (placement.domain === 'node') return { ...placement, ownerNodeId: null };
  if (placement.domain === 'question') {
    const question = structure.questions.find((candidate) => candidate.id === placement.id);
    if (!question) throw new Error('Compiler question missing canonical placement');
    return { ...placement, ownerNodeId: question.ownerNodeId };
  }
  const object = structure.objects.find((candidate) => candidate.id === placement.id);
  if (!object) throw new Error('Compiler object missing canonical placement');
  return { ...placement, ownerNodeId: object.ownerNodeId };
}

function createReaderContext(
  structure: RevisedPaperStructure,
  atlas: AtlasWindow,
  requestedDetail: RequestedDetail | null,
): ReaderContext {
  const selected = requestedDetail ?? (atlas.rows[0] ? detailFromPlacement(structure, atlas.rows[0]) : null);
  if (!selected) {
    return {
      selectedId: null,
      selectedDomain: null,
      selectedLabel: null,
      selectedStartByte: null,
      selectedEndByte: null,
      selectedOwnerNodeId: null,
      ancestors: [],
      neighborhood: [],
    };
  }
  const contextNodeId = selected.domain === 'node' ? selected.id : selected.ownerNodeId;
  const selectedNode = contextNodeId ? structure.nodes.find((node) => node.id === contextNodeId) : undefined;
  if (!selectedNode) {
    return {
      selectedId: selected.id,
      selectedDomain: selected.domain,
      selectedLabel: selected.label,
      selectedStartByte: selected.startByte,
      selectedEndByte: selected.endByte,
      selectedOwnerNodeId: selected.ownerNodeId,
      ancestors: [],
      neighborhood: [],
    };
  }
  const selectedIndex = structure.nodes.findIndex((node) => node.id === selectedNode.id);
  const neighborhoodStart = Math.max(0, selectedIndex - 2);
  const neighborhood = structure.nodes
    .slice(neighborhoodStart, neighborhoodStart + 5)
    .map((node) => {
      const placement = structure.lenses.all.find((candidate) => candidate.id === node.id);
      if (!placement) throw new Error('Compiler node missing canonical placement');
      return { ...placement, href: rowHref(structure.manifest.source.version, placement) };
    });
  return {
    selectedId: selected.id,
    selectedDomain: selected.domain,
    selectedLabel: selected.label,
    selectedStartByte: selected.startByte,
    selectedEndByte: selected.endByte,
    selectedOwnerNodeId: selected.ownerNodeId,
    ancestors: selectedNode.ancestorIds,
    neighborhood,
  };
}

export function createWorkspaceModel(
  structure: RevisedPaperStructure,
  query: AtlasQuery = { lens: 'all', q: '', page: 1 },
  mode: WorkspaceMode = 'my-review',
  requestedDetail: RequestedDetail | null = null,
): WorkspaceModel {
  const assignment = getProductionAssignment();
  const atlas = createAtlasWindow(structure, query);
  return {
    releaseIdentity: structure.releaseIdentity,
    documentVersion: structure.manifest.source.version,
    mode,
    assignment,
    requestedDetail,
    internalLinkMap: createInternalLinkMap(structure, query, mode),
    atlas,
    readerContext: createReaderContext(structure, atlas, requestedDetail),
    questionPacket: createQuestionPacket(structure),
    trust: createTrustState(),
    ledgers: createLedgerSummary(assignment, structure.questions.length),
  };
}

export function isPinEligible(readerWidthPx: number, rootFontSizePx: number, horizontalOverflowPx: number): boolean {
  return Number.isFinite(readerWidthPx)
    && Number.isFinite(rootFontSizePx)
    && rootFontSizePx > 0
    && Number.isFinite(horizontalOverflowPx)
    && readerWidthPx >= 45 * rootFontSizePx
    && horizontalOverflowPx <= 1;
}

export function releaseNoteKey(releaseIdentity: string, itemId: string): string {
  return `matrix-paper-v16:notes:${releaseIdentity}:${itemId}`;
}

export function sourceRangeText(content: string, startByte: number, endByte: number): string {
  const bytes = new TextEncoder().encode(content);
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes.slice(startByte, endByte));
}

export function placementDomainLabel(domain: StructureDomain): string {
  if (domain === 'node') return 'Section';
  if (domain === 'question') return 'Review question';
  if (domain === 'object.figure') return 'Figure';
  if (domain === 'object.table') return 'Table';
  return 'Equation';
}
