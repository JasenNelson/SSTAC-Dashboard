import 'server-only';

import { createHash } from 'node:crypto';
import { readFile, open } from 'node:fs/promises';
import { Readable } from 'node:stream';
import path from 'node:path';
import { NextResponse } from 'next/server';

import {
  DOWNLOAD_MANIFEST_SCHEMA,
  DOWNLOAD_MANIFEST_STATUS,
  DOWNLOAD_VALIDATION_STATE,
  type DownloadManifestPackage,
  type DownloadPackageKind,
  type ServerDownloadManifest,
  type VerifiedDownloadManifest,
  validateDownloadManifest,
} from '@/lib/matrix-options/paper/download-manifest';
import { getCohortManifest } from '@/lib/matrix-options/cohort-contract';
import {
  authenticateReviewerGuideAgainstPaper,
  getReviewerGuideContract,
  REVIEW_GUIDE_RELEASE_IDENTITY,
} from '@/lib/matrix-options/reviewer-guide';
import { getReviewManifest, type ReviewManifest } from '@/lib/matrix-options/paper/review-manifest';
import { loadRevisedPaper, REVISED_PAPER_RELEASE_IDENTITY, REVISED_PAPER_VERSION } from '@/lib/matrix-options/revised-paper';

export const DOWNLOAD_API_PREFIX = '/api/matrix-options/paper/downloads';
export const PRINT_PACKAGE_ARTIFACTS_STATE = 'UNAVAILABLE_MISSING_AUTHENTICATED_ARTIFACTS' as const;
export const PRINT_PACKAGE_ARTIFACT_DEPENDENCY = 'authenticated-pdf-docx-bytes-and-private-catalog-locator' as const;

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const STABLE_ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;
const DOCUMENT_VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const FILE_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*\.(pdf|docx)$/;
const QUESTION_ID_PREFIX = `rpq:${REVIEW_GUIDE_RELEASE_IDENTITY}:q`;
const PRIVATE_LOCATOR_PATTERN = /^private-print-package:[a-z0-9][a-z0-9._:-]*$/;
const PRIVATE_PACKAGE_ROOT = path.join(process.cwd(), 'private-packages');
const PRIVATE_CATALOG_PATH = path.join(PRIVATE_PACKAGE_ROOT, 'catalog.json');

interface PrivateCatalogEntry {
  readonly packageId: string;
  readonly kind: DownloadPackageKind;
  readonly label: string;
  readonly fileName: string;
  readonly cohortId: string;
  readonly order: number;
  readonly byteLength: number;
  readonly sha256: string;
  readonly path: string;
}

interface PrivateCatalogDocument {
  readonly artifacts: readonly PrivateCatalogEntry[];
}

export interface TrustedDownloadContext {
  readonly documentVersion: string;
  readonly manifestSha256: string;
  readonly paperSha256: string;
  readonly releaseIdentity: string;
  readonly paperReleaseIdentity: string;
  readonly cohortQuestionIds: Readonly<Record<string, readonly string[]>>;
  readonly reviewManifest: ReviewManifest;
}

export interface PrintPackageArtifact {
  readonly packageId: string;
  readonly kind: DownloadPackageKind;
  readonly label: string;
  readonly fileName: string;
  readonly sha256: string;
  readonly byteLength: number;
  readonly order: number;
  readonly cohortId: string;
  readonly documentVersion: string;
  readonly manifestSha256: string;
  /** Catalog-owned opaque locator. It is never joined with user input. */
  readonly serverAssetLocator: string;
}

export interface DownloadRequestBinding {
  readonly documentVersion: string;
  readonly manifestSha256: string;
  readonly cohortId: string;
  readonly questionId?: string;
}

export class DownloadBoundaryError extends Error {
  readonly status: 400 | 404 | 409 | 503;
  readonly code: string;

  constructor(code: string, message: string, status: 400 | 404 | 409 | 503) {
    super(message);
    this.name = 'DownloadBoundaryError';
    this.code = code;
    this.status = status;
  }
}

function boundaryFailure(code: string, message: string, status: 400 | 404 | 409 | 503): never {
  throw new DownloadBoundaryError(code, message, status);
}

function isSha256(value: string): boolean {
  return SHA256_PATTERN.test(value);
}

function isStableId(value: string): boolean {
  return STABLE_ID_PATTERN.test(value);
}

function isAuthenticatedQuestionId(value: string): boolean {
  return value.startsWith(QUESTION_ID_PREFIX) && /^\d{2}$/.test(value.slice(QUESTION_ID_PREFIX.length));
}

function rawQueryValues(url: URL, key: string): readonly string[] {
  const rawSearch = url.search.startsWith('?') ? url.search.slice(1) : '';
  return rawSearch
    .split('&')
    .filter((part) => part.split('=', 1)[0] === key)
    .map((part) => part.slice(key.length + 1));
}

function queryValue(url: URL, key: string, required: boolean): string | undefined {
  const values = url.searchParams.getAll(key);
  const rawValues = rawQueryValues(url, key);
  if (values.length !== rawValues.length) boundaryFailure('UNSAFE_QUERY_ENCODING', `Encoded ${key} is not accepted.`, 400);
  if (values.length > 1) boundaryFailure('REPEATED_QUERY_PARAMETER', `Repeated ${key} is not accepted.`, 400);
  if (values.length === 0 || values[0] === undefined || values[0] === '') {
    if (required) boundaryFailure('MISSING_QUERY_PARAMETER', `Missing ${key}.`, 400);
    return undefined;
  }
  const rawValue = rawValues[0];
  if (rawValue === undefined || rawValue.includes('%') || rawValue.includes('/') || rawValue.includes('\\') || rawValue.includes('..')) {
    boundaryFailure('UNSAFE_QUERY_ENCODING', `Encoded or traversal-shaped ${key} is not accepted.`, 400);
  }
  return values[0];
}

export function validateOpaquePackageId(packageId: string): string {
  if (!packageId || packageId.includes('%') || packageId.includes('/') || packageId.includes('\\') || packageId.includes('..') || !isStableId(packageId)) {
    boundaryFailure('UNSAFE_PACKAGE_ID', 'Opaque package ID is invalid.', 400);
  }
  return packageId;
}

export function parseDownloadRequestBinding(url: URL): DownloadRequestBinding {
  const documentVersion = queryValue(url, 'documentVersion', true);
  const manifestSha256 = queryValue(url, 'manifestSha256', true);
  const cohortId = queryValue(url, 'cohortId', true);
  const questionId = queryValue(url, 'questionId', false);
  if (!documentVersion || !manifestSha256 || !cohortId) boundaryFailure('MISSING_QUERY_PARAMETER', 'Release and cohort binding is required.', 400);
  if (!DOCUMENT_VERSION_PATTERN.test(documentVersion)) boundaryFailure('UNSAFE_DOCUMENT_VERSION', 'Document version is not a safe release segment.', 400);
  if (!isSha256(manifestSha256)) boundaryFailure('UNSAFE_MANIFEST_HASH', 'Manifest hash is not a lowercase SHA-256.', 400);
  if (!isStableId(cohortId)) boundaryFailure('UNSAFE_COHORT', 'Cohort is not a safe release segment.', 400);
  if (questionId !== undefined && !isAuthenticatedQuestionId(questionId)) boundaryFailure('UNSAFE_QUESTION', 'Question is not a trusted release question ID.', 400);
  return { documentVersion, manifestSha256, cohortId, ...(questionId ? { questionId } : {}) };
}

export function validateTrustedCohortQuestion(
  binding: Pick<DownloadRequestBinding, 'cohortId' | 'questionId'>,
  context: Pick<TrustedDownloadContext, 'cohortQuestionIds'>,
): void {
  const questionIds = context.cohortQuestionIds[binding.cohortId];
  if (!questionIds) boundaryFailure('UNKNOWN_COHORT', 'Cohort is not in the trusted release.', 409);
  if (binding.questionId !== undefined && !questionIds.includes(binding.questionId)) boundaryFailure('COHORT_QUESTION_MISMATCH', 'Question is not a member of the cohort.', 409);
}

function releaseContextFrom(
  paper: ReturnType<typeof loadRevisedPaper>,
  reviewManifest: ReviewManifest,
): TrustedDownloadContext {
  if (
    paper.releaseIdentity !== REVISED_PAPER_RELEASE_IDENTITY ||
    paper.documentVersion !== reviewManifest.documentVersion ||
    paper.sha256 !== reviewManifest.paperSha256
  ) {
    boundaryFailure('RELEASE_IDENTITY_MISMATCH', 'Request is not bound to the trusted paper release.', 409);
  }
  return {
    documentVersion: reviewManifest.documentVersion,
    manifestSha256: reviewManifest.sha256,
    paperSha256: paper.sha256,
    releaseIdentity: `matrix-options-paper-${reviewManifest.documentVersion}-${paper.sha256}`,
    paperReleaseIdentity: paper.releaseIdentity,
    cohortQuestionIds: reviewManifest.cohortQuestionIds,
    reviewManifest,
  };
}

export async function loadTrustedDownloadReleaseContext(): Promise<TrustedDownloadContext> {
  try {
    const paper = loadRevisedPaper(REVISED_PAPER_VERSION);
    await authenticateReviewerGuideAgainstPaper(getReviewerGuideContract(), paper.content);
    const cohorts = getCohortManifest();
    const reviewManifest = getReviewManifest();
    const context = releaseContextFrom(paper, reviewManifest);
    for (const cohort of cohorts.cohorts) {
      if (!Array.isArray(context.cohortQuestionIds[cohort.id])) boundaryFailure('COHORT_MANIFEST_MISMATCH', 'Trusted cohort membership is incomplete.', 503);
    }
    return context;
  } catch (error) {
    if (error instanceof DownloadBoundaryError) throw error;
    boundaryFailure('TRUSTED_RELEASE_UNAVAILABLE', 'The authenticated paper, guide, cohort, or review manifest is unavailable.', 503);
  }
}

export async function loadTrustedDownloadContext(binding: DownloadRequestBinding): Promise<TrustedDownloadContext> {
  const context = await loadTrustedDownloadReleaseContext();
  if (context.documentVersion !== binding.documentVersion || context.manifestSha256 !== binding.manifestSha256) {
    boundaryFailure('RELEASE_IDENTITY_MISMATCH', 'Request is not bound to the trusted paper release.', 409);
  }
  validateTrustedCohortQuestion(binding, context);
  return context;
}

function validateCatalogArtifact(artifact: PrintPackageArtifact, context: TrustedDownloadContext, cohortId?: string): void {
  if (
    !validateOpaquePackageId(artifact.packageId) ||
    !['PDF', 'DOCX'].includes(artifact.kind) ||
    typeof artifact.label !== 'string' ||
    !artifact.label.trim() ||
    /[\r\n\u0000-\u001f\u007f]/.test(artifact.label) ||
    !FILE_NAME_PATTERN.test(artifact.fileName) ||
    !isSha256(artifact.sha256) ||
    !Number.isSafeInteger(artifact.byteLength) ||
    artifact.byteLength <= 0 ||
    !Number.isSafeInteger(artifact.order) ||
    artifact.order < 0 ||
    !isStableId(artifact.cohortId) ||
    !isSha256(artifact.manifestSha256) ||
    !PRIVATE_LOCATOR_PATTERN.test(artifact.serverAssetLocator)
  ) {
    boundaryFailure('INVALID_PRINT_PACKAGE_CATALOG', 'Print package catalog entry is invalid.', 503);
  }
  if (artifact.documentVersion !== context.documentVersion || artifact.manifestSha256 !== context.manifestSha256 || (cohortId !== undefined && artifact.cohortId !== cohortId)) {
    boundaryFailure('CATALOG_RELEASE_MISMATCH', 'Print package catalog entry is not bound to the trusted release.', 409);
  }
  if (!context.cohortQuestionIds[artifact.cohortId]) boundaryFailure('CATALOG_COHORT_MISMATCH', 'Print package catalog cohort is not trusted.', 409);
}

function validateCompleteCatalog(artifacts: readonly PrintPackageArtifact[], context: TrustedDownloadContext, cohortId?: string): readonly PrintPackageArtifact[] {
  const byCohort = new Map<string, PrintPackageArtifact[]>();
  for (const artifact of artifacts) {
    let group = byCohort.get(artifact.cohortId);
    if (!group) {
      group = [];
      byCohort.set(artifact.cohortId, group);
    }
    group.push(artifact);
  }

  if (cohortId !== undefined && !byCohort.has(cohortId)) {
    boundaryFailure('PRINT_PACKAGE_ARTIFACTS_INCOMPLETE', 'Exactly one authenticated PDF and one DOCX artifact are required.', 503);
  }

  const ids = new Set<string>();
  for (const [groupCohort, group] of byCohort.entries()) {
    if (group.length !== 2) boundaryFailure('PRINT_PACKAGE_ARTIFACTS_INCOMPLETE', 'Exactly one authenticated PDF and one DOCX artifact are required per cohort.', 503);
    const kinds = new Set<DownloadPackageKind>();
    const orders = new Set<number>();
    for (const artifact of group) {
      validateCatalogArtifact(artifact, context, cohortId);
      if (ids.has(artifact.packageId)) boundaryFailure('INVALID_PRINT_PACKAGE_CATALOG', 'Print package catalog contains duplicate package IDs.', 503);
      if (kinds.has(artifact.kind)) boundaryFailure('INVALID_PRINT_PACKAGE_CATALOG', 'Print package catalog contains duplicate package kinds.', 503);
      if (orders.has(artifact.order)) boundaryFailure('INVALID_PRINT_PACKAGE_CATALOG', 'Print package catalog contains duplicate package orders.', 503);
      ids.add(artifact.packageId);
      kinds.add(artifact.kind);
      orders.add(artifact.order);
    }
    if (!kinds.has('PDF') || !kinds.has('DOCX')) boundaryFailure('INVALID_PRINT_PACKAGE_CATALOG', 'Print package catalog must contain PDF and DOCX.', 503);
  }
  return artifacts;
}

export async function loadAuthenticatedPrintPackageCatalog(
  context: TrustedDownloadContext,
  cohortId?: string,
): Promise<readonly PrintPackageArtifact[] | null> {
  try {
    let raw: string;
    try {
      raw = await readFile(PRIVATE_CATALOG_PATH, 'utf8');
    } catch (err: any) {
      if (err.code === 'ENOENT') return null;
      throw err;
    }
    const catalog = JSON.parse(raw) as PrivateCatalogDocument;
    if (!Array.isArray(catalog.artifacts)) boundaryFailure('INVALID_PRINT_PACKAGE_CATALOG', 'Private package catalog is invalid.', 503);
    const entries = catalog.artifacts.filter((entry) => cohortId === undefined || entry.cohortId === cohortId);
    const artifacts: PrintPackageArtifact[] = [];
    for (const entry of entries) {
      if (!entry || typeof entry !== 'object' || !isStableId(entry.packageId) || !isStableId(entry.cohortId)) {
        boundaryFailure('INVALID_PRINT_PACKAGE_CATALOG', 'Private package catalog entry is invalid.', 503);
      }
      if (!entry.path.startsWith('private-packages/') || entry.path.includes('..') || entry.path.includes('\\')) {
        boundaryFailure('INVALID_PRINT_PACKAGE_CATALOG', 'Private package catalog path is invalid.', 503);
      }
      const artifact: PrintPackageArtifact = {
        packageId: entry.packageId,
        kind: entry.kind,
        label: entry.label,
        fileName: entry.fileName,
        sha256: entry.sha256.toLowerCase(),
        byteLength: entry.byteLength,
        order: entry.order,
        cohortId: entry.cohortId,
        documentVersion: context.documentVersion,
        manifestSha256: context.manifestSha256,
        serverAssetLocator: `private-print-package:${entry.packageId}`,
      };
      validateCatalogArtifact(artifact, context, cohortId);
      const absolutePath = path.join(process.cwd(), entry.path);
      if (!absolutePath.startsWith(PRIVATE_PACKAGE_ROOT + path.sep)) {
        boundaryFailure('INVALID_PRINT_PACKAGE_CATALOG', 'Private package locator escaped the sealed root.', 503);
      }
      const bytes = await readFile(absolutePath);
      const digest = createHash('sha256').update(bytes).digest('hex');
      if (bytes.byteLength !== artifact.byteLength || digest !== artifact.sha256) {
        boundaryFailure('PRIVATE_PACKAGE_INTEGRITY_MISMATCH', 'Private package bytes do not match the authenticated catalog.', 503);
      }
      artifacts.push(artifact);
    }
    return validateCompleteCatalog(artifacts, context, cohortId);
  } catch (error) {
    if (error instanceof DownloadBoundaryError) throw error;
    boundaryFailure('PRINT_PACKAGE_ARTIFACTS_UNAVAILABLE', 'Authenticated print-package artifacts are unavailable.', 503);
  }
}

export function buildValidatedDownloadManifest(
  artifacts: readonly PrintPackageArtifact[],
  context: TrustedDownloadContext,
  cohortId: string,
): ServerDownloadManifest {
  const completeCatalog = validateCompleteCatalog(artifacts, context, cohortId);
  const packages: readonly DownloadManifestPackage[] = completeCatalog.map((artifact) => {
    return {
      packageId: artifact.packageId,
      kind: artifact.kind,
      label: artifact.label.trim(),
      fileName: artifact.fileName,
      path: `opaque/${artifact.packageId}`,
      href: `${DOWNLOAD_API_PREFIX}/${artifact.packageId}`,
      sha256: artifact.sha256,
      byteLength: artifact.byteLength,
      documentVersion: context.documentVersion,
      manifestSha256: context.manifestSha256,
      order: artifact.order,
    };
  });
  try {
    return validateDownloadManifest(
      {
        schemaVersion: DOWNLOAD_MANIFEST_SCHEMA,
        validationState: DOWNLOAD_VALIDATION_STATE,
        status: DOWNLOAD_MANIFEST_STATUS,
        releaseIdentity: context.releaseIdentity,
        documentVersion: context.documentVersion,
        manifestSha256: context.manifestSha256,
        packages,
      },
      { documentVersion: context.documentVersion, manifestSha256: context.manifestSha256, releaseIdentity: context.releaseIdentity },
    );
  } catch {
    boundaryFailure('INVALID_PRINT_PACKAGE_CATALOG', 'Print package catalog failed manifest validation.', 503);
  }
}

export function selectOpaquePackageArtifact(
  artifacts: readonly PrintPackageArtifact[] | null,
  packageId: string,
  context: TrustedDownloadContext,
  ): PrintPackageArtifact {
  const id = validateOpaquePackageId(packageId);
  if (!artifacts) boundaryFailure('PRINT_PACKAGE_ARTIFACTS_UNAVAILABLE', 'Authenticated print-package artifacts are unavailable.', 503);
  const validated = validateCompleteCatalog(artifacts, context);
  const artifact = validated.find((entry) => entry.packageId === id);
  if (!artifact) boundaryFailure('ARTIFACT_NOT_FOUND', 'Opaque package ID is not in the authenticated catalog.', 404);
  return artifact;
}

export function contentDispositionForCatalog(artifact: PrintPackageArtifact): string {
  if (!FILE_NAME_PATTERN.test(artifact.fileName)) boundaryFailure('INVALID_PRINT_PACKAGE_CATALOG', 'Catalog filename is invalid.', 503);
  return `attachment; filename="${artifact.fileName}"`;
}

export async function streamAuthenticatedPrintPackageArtifact(
  artifact: PrintPackageArtifact,
): Promise<NextResponse> {
  validateOpaquePackageId(artifact.packageId);
  if (!PRIVATE_LOCATOR_PATTERN.test(artifact.serverAssetLocator)) boundaryFailure('INVALID_PRINT_PACKAGE_CATALOG', 'Private package locator is invalid.', 503);
  if (artifact.serverAssetLocator !== `private-print-package:${artifact.packageId}`) boundaryFailure('INVALID_PRINT_PACKAGE_CATALOG', 'Private package locator does not match the package ID.', 503);
  const raw = await readFile(PRIVATE_CATALOG_PATH, 'utf8');
  const catalog = JSON.parse(raw) as PrivateCatalogDocument;
  const entry = catalog.artifacts.find((candidate) => candidate.packageId === artifact.packageId);
  if (!entry || !entry.path.startsWith('private-packages/') || entry.path.includes('..') || entry.path.includes('\\')) {
    boundaryFailure('ARTIFACT_NOT_FOUND', 'Opaque package ID is not in the authenticated catalog.', 404);
  }
  const absolutePath = path.join(process.cwd(), entry.path);
  if (!absolutePath.startsWith(PRIVATE_PACKAGE_ROOT + path.sep)) boundaryFailure('INVALID_PRINT_PACKAGE_CATALOG', 'Private package locator escaped the sealed root.', 503);
  
  let handle: import('node:fs/promises').FileHandle | null = null;
  let digest: string;
  let byteLength = 0;
  
  try {
    handle = await open(absolutePath, 'r');
    const hash = createHash('sha256');
    const verifyStream = handle.createReadStream({ autoClose: false });
    
    for await (const chunk of verifyStream) {
      byteLength += chunk.length;
      hash.update(chunk);
    }
    digest = hash.digest('hex');
    
    if (byteLength !== artifact.byteLength || digest !== artifact.sha256.toLowerCase() || digest !== entry.sha256.toLowerCase()) {
      await handle.close();
      handle = null;
      boundaryFailure('PRIVATE_PACKAGE_INTEGRITY_MISMATCH', 'Private package bytes do not match the authenticated artifact.', 503);
    }
    
    const nodeStream = handle.createReadStream({ start: 0, autoClose: true });
    const webStream = Readable.toWeb(nodeStream);
    
    return new NextResponse(webStream as any, {
      status: 200,
      headers: {
        'Content-Type': artifact.kind === 'PDF' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Length': String(byteLength),
        'Content-Disposition': contentDispositionForCatalog(artifact),
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    if (handle) {
      await handle.close().catch(() => {});
    }
    throw error;
  }
}

export type DownloadManifestLoadState =
  | { readonly status: 'pending'; readonly manifest: null }
  | { readonly status: 'ready'; readonly manifest: VerifiedDownloadManifest };

export async function loadDownloadManifestState(binding: DownloadRequestBinding): Promise<DownloadManifestLoadState> {
  const context = await loadTrustedDownloadContext(binding);
  const catalog = await loadAuthenticatedPrintPackageCatalog(context, binding.cohortId);
  if (catalog === null) return { status: 'pending', manifest: null };
  return { status: 'ready', manifest: buildValidatedDownloadManifest(catalog, context, binding.cohortId) };
}

