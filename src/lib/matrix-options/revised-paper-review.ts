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

export type WorkspaceMode = 'my-review' | 'publication';
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
  if (value === undefined || value === 'my-review') return 'my-review';
  if (value === 'publication') return 'publication';
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
  readonly ancestors: readonly string[];
  readonly neighborhood: readonly AtlasRow[];
}

export interface WorkspaceModel {
  readonly releaseIdentity: string;
  readonly documentVersion: string;
  readonly mode: WorkspaceMode;
  readonly assignment: AssignmentState;
  readonly atlas: AtlasWindow;
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

function createReaderContext(structure: RevisedPaperStructure, atlas: AtlasWindow): ReaderContext {
  const selected = atlas.rows[0] ?? null;
  if (!selected) return { selectedId: null, ancestors: [], neighborhood: [] };
  const selectedNode = structure.nodes.find((node) => node.id === selected.id);
  if (!selectedNode) return { selectedId: selected.id, ancestors: [], neighborhood: [selected] };
  const selectedIndex = structure.nodes.findIndex((node) => node.id === selected.id);
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
    ancestors: selectedNode.ancestorIds,
    neighborhood,
  };
}

export function createWorkspaceModel(
  structure: RevisedPaperStructure,
  query: AtlasQuery = { lens: 'all', q: '', page: 1 },
  mode: WorkspaceMode = 'my-review',
): WorkspaceModel {
  const assignment = getProductionAssignment();
  const atlas = createAtlasWindow(structure, query);
  return {
    releaseIdentity: structure.releaseIdentity,
    documentVersion: structure.manifest.source.version,
    mode,
    assignment,
    atlas,
    readerContext: createReaderContext(structure, atlas),
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
